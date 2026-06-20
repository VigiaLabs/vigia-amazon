/**
 * StripePayoutFn — backend for VIGIA token → fiat payout via Stripe.
 *
 * Routes (all under POST /stripe/):
 *   POST /stripe/onboard-session    — creates a Stripe Connect Express account
 *                                     and returns the onboarding URL
 *   POST /stripe/payout-session     — creates a PaymentIntent for pending balance
 *                                     payout to the connected account
 *   POST /stripe/financial-session  — creates a Financial Connections session
 *                                     client_secret for bank-account linking
 *
 * The Stripe secret key is stored in Secrets Manager (vigia/stripe-secret-key)
 * and injected as STRIPE_SECRET_KEY. Publishable key is returned to the client
 * for SDK initialisation (pk_test_* / pk_live_* — non-secret).
 *
 * Security: all routes require a valid wallet_address + ownership proof
 * (X-Wallet-Timestamp + X-Wallet-Signature) identical to the rewards-balance gate.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const REWARDS_TABLE        = process.env.REWARDS_LEDGER_TABLE_NAME!;
const STRIPE_PUBLISHABLE   = process.env.STRIPE_PUBLISHABLE_KEY!;
// Minimum payout: 1 VGA token = 1 USD cent (exchange rate is governance-controlled)
const VGA_TO_USD_CENTS     = Number(process.env.VGA_TO_USD_CENTS ?? '100');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Wallet-Timestamp,X-Wallet-Signature',
};

function err(status: number, message: string): APIGatewayProxyResult {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

function ok(body: object): APIGatewayProxyResult {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function verifyWalletOwnership(
  wallet: string,
  headers: Record<string, string | undefined>,
): Promise<boolean> {
  const ts  = headers['x-wallet-timestamp'] ?? headers['X-Wallet-Timestamp'];
  const sig = headers['x-wallet-signature']  ?? headers['X-Wallet-Signature'];
  if (!ts || !sig) return false;
  const tsMs = Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return false;
  try {
    const pubBytes = bs58.decode(wallet);
    if (pubBytes.length !== 32) return false;
    const msg = new TextEncoder().encode(`VIGIA-BALANCE:${wallet}:${tsMs}`);
    return nacl.sign.detached.verify(msg, bs58.decode(sig), pubBytes);
  } catch { return false; }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const body   = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  const wallet = (body.wallet_address as string) ?? '';

  if (!wallet) return err(400, 'wallet_address required');
  if (!await verifyWalletOwnership(wallet, event.headers as Record<string, string | undefined>)) {
    return err(401, 'INVALID_WALLET_PROOF');
  }

  const path = event.path ?? '';

  // ── Connect Express onboarding ────────────────────────────────────────────
  if (path.endsWith('/onboard-session')) {
    const account = await stripe.accounts.create({
      type:         'express',
      metadata:     { vigia_wallet: wallet },
      capabilities: { transfers: { requested: true } },
    });

    const link = await stripe.accountLinks.create({
      account:     account.id,
      refresh_url: `${process.env.FRONTEND_URL ?? 'https://vigia.app'}/wallet?stripe=refresh`,
      return_url:  `${process.env.FRONTEND_URL ?? 'https://vigia.app'}/wallet?stripe=complete`,
      type:        'account_onboarding',
    });

    // Persist connect account ID against the wallet for later payouts
    await dynamo.send(new UpdateCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: wallet },
      UpdateExpression: 'SET stripe_account_id = :aid',
      ExpressionAttributeValues: { ':aid': account.id },
    }));

    return ok({ onboarding_url: link.url, account_id: account.id });
  }

  // ── Payout session (PaymentIntent to connected account) ───────────────────
  if (path.endsWith('/payout-session')) {
    const res = await dynamo.send(new GetCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: wallet },
    }));
    const item = res.Item ?? {};
    const stripeAccountId: string | undefined = item.stripe_account_id;
    if (!stripeAccountId) return err(400, 'Stripe account not linked — complete onboarding first');

    const pendingMicro = Number(BigInt(item.pending_balance?.toString() ?? '0'));
    if (pendingMicro <= 0) return err(400, 'No pending balance to claim');

    // Convert micro-VGA (1e-6 VGA) to USD cents: pendingMicro / 1e6 * VGA_TO_USD_CENTS
    const amountCents = Math.floor((pendingMicro / 1_000_000) * VGA_TO_USD_CENTS);
    if (amountCents < 100) return err(400, 'Minimum payout is 1.00 USD');

    // P0-4 fix: atomically debit the claimed balance BEFORE any money moves. The
    // conditional update fails if a concurrent or replayed payout already drained
    // it, so the same balance can never be cashed out twice.
    try {
      await dynamo.send(new UpdateCommand({
        TableName: REWARDS_TABLE,
        Key: { wallet_address: wallet },
        UpdateExpression:    'ADD pending_balance :neg, paid_out_total :claim',
        ConditionExpression: 'pending_balance >= :claim',
        ExpressionAttributeValues: { ':neg': -pendingMicro, ':claim': pendingMicro },
      }));
    } catch (e: unknown) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') {
        return err(409, 'Balance already claimed or changed — refresh and retry');
      }
      throw e;
    }

    // P0-4 fix: deterministic idempotency key bound to the signed request timestamp,
    // so a retried/replayed request reuses the same PaymentIntent instead of
    // creating a second fiat transfer.
    const proofTs = event.headers['x-wallet-timestamp'] ?? event.headers['X-Wallet-Timestamp'] ?? '';

    try {
      const intent = await stripe.paymentIntents.create({
        amount:                amountCents,
        currency:              'usd',
        payment_method_types:  ['us_bank_account'],
        transfer_data:         { destination: stripeAccountId },
        metadata:              { vigia_wallet: wallet, micro_vga: pendingMicro.toString() },
      }, { idempotencyKey: `payout#${wallet}#${proofTs}` });

      return ok({
        client_secret:     intent.client_secret,
        publishable_key:   STRIPE_PUBLISHABLE,
        amount_cents:      amountCents,
        pending_micro_vga: pendingMicro,
      });
    } catch (e) {
      // Stripe failed after we debited — re-credit so the user keeps their tokens.
      await dynamo.send(new UpdateCommand({
        TableName: REWARDS_TABLE,
        Key: { wallet_address: wallet },
        UpdateExpression: 'ADD pending_balance :claim, paid_out_total :neg',
        ExpressionAttributeValues: { ':claim': pendingMicro, ':neg': -pendingMicro },
      }));
      throw e;
    }
  }

  // ── Financial Connections session (bank-account linking) ─────────────────
  if (path.endsWith('/financial-session')) {
    const res = await dynamo.send(new GetCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: wallet },
    }));
    const stripeAccountId: string | undefined = res.Item?.stripe_account_id;
    if (!stripeAccountId) return err(400, 'Stripe account not linked — complete onboarding first');

    const session = await stripe.financialConnections.sessions.create({
      account_holder: { type: 'account', account: stripeAccountId },
      permissions:    ['payment_method', 'balances'],
    });

    return ok({
      client_secret:   session.client_secret,
      publishable_key: STRIPE_PUBLISHABLE,
    });
  }

  return err(404, 'Not found');
};
