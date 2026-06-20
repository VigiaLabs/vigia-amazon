/**
 * StripeWebhookFn — POST /stripe/webhook
 *
 * Completes the P0-4 fix: /payout-session debits pending_balance up front and creates
 * a PaymentIntent. This webhook reconciles the ASYNCHRONOUS outcome:
 *   - payment_intent.payment_failed / canceled → re-credit the debited balance so the
 *     user does not lose tokens for a settlement that never completed.
 *   - payment_intent.succeeded → log (balance already debited at request time).
 *
 * Security: the Stripe-Signature header is verified against STRIPE_WEBHOOK_SECRET via
 * stripe.webhooks.constructEvent over the RAW request body. Unverified events are 400'd.
 *
 * Idempotency: re-credit is guarded by a per-intent string-set (refunded_intents) so
 * Stripe redeliveries cannot re-credit the same intent twice.
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const REWARDS_TABLE  = process.env.REWARDS_LEDGER_TABLE_NAME!;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const sig = event.headers['stripe-signature'] ?? event.headers['Stripe-Signature'];
  if (!sig) return { statusCode: 400, body: 'Missing Stripe-Signature' };

  // constructEvent requires the RAW body exactly as sent.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf-8');

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (e: any) {
    console.error('[StripeWebhook] signature verification failed:', e.message);
    return { statusCode: 400, body: 'Webhook signature verification failed' };
  }

  if (stripeEvent.type === 'payment_intent.payment_failed' ||
      stripeEvent.type === 'payment_intent.canceled') {
    const intent = stripeEvent.data.object as Stripe.PaymentIntent;
    const wallet = intent.metadata?.vigia_wallet;
    const micro  = Number(intent.metadata?.micro_vga ?? '0');

    if (wallet && Number.isFinite(micro) && micro > 0) {
      try {
        await dynamo.send(new UpdateCommand({
          TableName: REWARDS_TABLE,
          Key: { wallet_address: wallet },
          UpdateExpression:
            'ADD pending_balance :amt, paid_out_total :neg, refunded_intents :iset',
          // Idempotent: skip if this intent was already reconciled.
          ConditionExpression:
            'attribute_not_exists(refunded_intents) OR NOT contains(refunded_intents, :iid)',
          ExpressionAttributeValues: {
            ':amt':  micro,
            ':neg':  -micro,
            ':iset': new Set([intent.id]),
            ':iid':  intent.id,
          },
        }));
        console.log(`[StripeWebhook] re-credited ${micro} micro-VGA to ${wallet} (intent ${intent.id}, ${stripeEvent.type})`);
      } catch (e: any) {
        if (e.name === 'ConditionalCheckFailedException') {
          console.log(`[StripeWebhook] intent ${intent.id} already reconciled — skip`);
        } else {
          throw e;
        }
      }
    }
  } else {
    console.log(`[StripeWebhook] ignoring event type ${stripeEvent.type}`);
  }

  // Always 200 on a verified event so Stripe stops retrying.
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
