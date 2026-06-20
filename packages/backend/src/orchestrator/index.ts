import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';
import { submitHazardToChain } from '../solana/submit-hazard';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock  = new BedrockRuntimeClient({ region: 'us-east-1' });
const bedrockAgent = new BedrockAgentRuntimeClient({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({});
const s3       = new S3Client({});

const COOLDOWN_TABLE  = process.env.COOLDOWN_TABLE_NAME!;
const TRACES_TABLE    = process.env.TRACES_TABLE_NAME!;
const HAZARDS_TABLE   = process.env.HAZARDS_TABLE_NAME!;
const LEDGER_TABLE    = process.env.LEDGER_TABLE_NAME!;
const REWARDS_TABLE   = process.env.REWARDS_LEDGER_TABLE_NAME!;
// P0-5 fix: device→wallet bindings. Rewards are attributed to the wallet bound to
// the attesting Pi, never to a client-supplied field.
const BINDINGS_TABLE  = process.env.DEVICE_BINDINGS_TABLE_NAME ?? '';
const FRAMES_BUCKET   = process.env.FRAMES_BUCKET_NAME!;
const AGENT_ID        = process.env.BEDROCK_AGENT_ID!;
const SLASH_FUNCTION  = process.env.SLASH_FUNCTION_NAME ?? '';
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID!;
const ONE_TOKEN      = BigInt('1000000000000000000');

// VLM sampling rate — fraction of events that run the expensive Bedrock VLM+Agent
// verification. The remainder are scored from edge ONNX confidence. Probabilistic
// verification is economically sound only because rewards are deduped per
// (wallet, geohash) per 30-day window, blacklisted devices are rejected at ingest,
// and sampled spoofs are slashed on-chain. Tunable without redeploying code.
const VLM_SAMPLE_RATE = Number(process.env.VLM_SAMPLE_RATE ?? '0.02');
const REWARD_DEDUP_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

async function countVerifiedAtGeohash(geohash: string): Promise<number> {
  const res = await dynamodb.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'status-timestamp-index',
    KeyConditionExpression: '#s = :v',
    FilterExpression: 'geohash = :g',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':v': 'VERIFIED', ':g': geohash },
    Select: 'COUNT',
  }));
  return res.Count ?? 0;
}

// Reward dedup + atomic credit are handled together by tryCreditReward (below).

function calcScore(count: number, vlmConf: number) {
  const discoveryBonus = count === 0 ? 40 : Math.min(count * 10, 30);
  return { discoveryBonus, totalScore: discoveryBonus + vlmConf * 60 };
}

interface AgentResult {
  finalAnswer: string;
  reactSteps: Array<{ thought?: string; action?: string; actionInput?: Record<string, unknown>; observation?: string }>;
  verificationScore: number | null;
}

// Invoke the Bedrock Agent with VLM context as text input.
// Retries up to 3 times on transient model timeout errors.
async function invokeAgent(geohash: string, hazardType: string, vlmReasoning: string, vlmConfidence: number): Promise<AgentResult> {
  const prompt =
    `A dashcam frame was analysed by a vision model for a reported ${hazardType} at geohash ${geohash}.\n` +
    `VLM reasoning: "${vlmReasoning}"\n` +
    `VLM confidence: ${vlmConfidence.toFixed(2)}\n\n` +
    `Please verify this hazard: query existing hazards at geohash ${geohash}, calculate the verification score, and give your final verdict with reasoning.`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const sessionId = `orch-${geohash}-${Date.now()}`;
      const reactSteps: AgentResult['reactSteps'] = [];
      let finalAnswer = '';
      let verificationScore: number | null = null;

      const response = await bedrockAgent.send(new InvokeAgentCommand({
        agentId: AGENT_ID,
        agentAliasId: AGENT_ALIAS_ID,
        sessionId,
        inputText: prompt,
        enableTrace: true,
      }));

      for await (const event of response.completion!) {
        if (event.trace?.trace?.orchestrationTrace) {
          const orch = event.trace.trace.orchestrationTrace;

          // Capture agent's reasoning (rationale field is the primary source)
          if (orch.rationale?.text) {
            reactSteps.push({ thought: orch.rationale.text });
          } else if (orch.modelInvocationInput?.text) {
            const thinking = orch.modelInvocationInput.text.match(/<thinking>([\s\S]*?)<\/thinking>/)?.[1]?.trim();
            if (thinking) reactSteps.push({ thought: thinking });
          }

          if (orch.invocationInput?.actionGroupInvocationInput) {
            const inv = orch.invocationInput.actionGroupInvocationInput;
            const lastStep = reactSteps[reactSteps.length - 1];
            const actionInput: Record<string, unknown> = {};
            inv.parameters?.forEach((p: any) => { actionInput[p.name] = p.value; });
            if (lastStep && !lastStep.action) { lastStep.action = inv.apiPath ?? inv.function ?? 'unknown'; lastStep.actionInput = actionInput; }
            else reactSteps.push({ action: inv.apiPath ?? inv.function ?? 'unknown', actionInput });
          }

          if (orch.observation?.actionGroupInvocationOutput?.text) {
            const obs = orch.observation.actionGroupInvocationOutput.text;
            const lastStep = reactSteps[reactSteps.length - 1];
            if (lastStep) lastStep.observation = obs;
            const scoreMatch = obs.match(/"verificationScore"\s*:\s*([\d.]+)/);
            if (scoreMatch) verificationScore = parseFloat(scoreMatch[1]);
          }

          if (orch.observation?.finalResponse?.text) finalAnswer = orch.observation.finalResponse.text;
        }
        if (event.chunk?.bytes) finalAnswer += new TextDecoder().decode(event.chunk.bytes);
      }

      console.log(`[Orch] Agent ReAct steps: ${reactSteps.length} | score from agent: ${verificationScore} (attempt ${attempt})`);
      return { finalAnswer, reactSteps, verificationScore };

    } catch (err: any) {
      const isTransient = err.message?.includes('timeout') || err.message?.includes('Dependency resource');
      console.warn(`[Orch] Agent attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (!isTransient || attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s backoff
    }
  }
  throw new Error('Agent failed after all retries');
}

// Atomically credit exactly one reward per (wallet, geohash) per 30-day window.
// The dedup lock (conditional Put), balance increment, and ledger write commit as a
// single transaction: if the lock already exists the whole transaction is cancelled
// and nothing is credited. This closes the read-then-write double-credit race and the
// fast-path farming hole (rewards on every path are now recorded and deduped here).
// Returns true iff a reward was actually credited.
async function tryCreditReward(
  walletAddress: string, geohash: string, hazardId: string, createdAt: string,
): Promise<boolean> {
  if (!walletAddress) return false;
  const dedupKey = `rwd#${walletAddress}#${geohash}`;
  const nowSec   = Math.floor(Date.now() / 1000);
  const entry = {
    ledgerId: `ledger-${hazardId}`, timestamp: createdAt,
    contributorId: walletAddress, hazardId, geohash, credits: 1,
  };
  try {
    await dynamodb.send(new TransactWriteCommand({
      TransactItems: [
        { Put: {
            TableName: COOLDOWN_TABLE,
            Item: { cooldownKey: dedupKey, hazardId, processedAt: createdAt, ttl: nowSec + REWARD_DEDUP_TTL_SECONDS },
            ConditionExpression: 'attribute_not_exists(cooldownKey)',
        } },
        { Update: {
            TableName: REWARDS_TABLE,
            Key: { wallet_address: walletAddress },
            UpdateExpression: 'ADD pending_balance :amt, total_earned :amt SET last_updated = :now, nonce = if_not_exists(nonce, :zero), last_hazard_id = :hid',
            ExpressionAttributeValues: { ':amt': ONE_TOKEN as any, ':now': createdAt, ':zero': 0, ':hid': hazardId },
        } },
        { Put: {
            TableName: LEDGER_TABLE,
            Item: { ...entry, currentHash: createHash('sha256').update(JSON.stringify(entry)).digest('hex') },
        } },
      ],
    }));
    return true;
  } catch (e: any) {
    if (e.name === 'TransactionCanceledException') return false; // already rewarded in window
    throw e;
  }
}

// P0-5 fix: hardware-attested-ONLY rewards. Returns the wallet 1:1-bound to the
// attesting Pi (DeviceBindingsTable), or '' for non-attested / mobile / unbound
// hazards — which mint nothing. To farm, an attacker now needs a physically
// provisioned, CA-certified Pi bound to a wallet, not just a self-generated keypair.
async function rewardWalletForHazard(source: string, deviceId: string): Promise<string> {
  if (source !== 'hardware_attested' || !deviceId || !BINDINGS_TABLE) return '';
  try {
    const res = await dynamodb.send(new GetCommand({
      TableName: BINDINGS_TABLE,
      Key: { device_id: deviceId },
      ProjectionExpression: 'wallet_pubkey',
    }));
    return (res.Item?.wallet_pubkey as string) ?? '';
  } catch (e: any) {
    console.error('[Orch] device-binding lookup failed:', e.message);
    return '';
  }
}

export const handler = async (event: any) => {
  // EventBridge Pipes sends events as a flat array; DynamoDB Streams sends {Records: [...]}
  const records: any[] = Array.isArray(event) ? event : (event.Records ?? []);
  for (const record of records) {
    if (record.eventName !== 'INSERT') continue;
    const img = record.dynamodb?.NewImage;
    if (!img) continue;

    const geohash             = img.geohash.S!;
    const timestamp           = img.timestamp.S!;
    const hazardType          = img.hazardType.S!;
    // Hardware-attested hazards carry severity_score (RRI), not a client confidence.
    const confidence          = img.confidence?.N ? parseFloat(img.confidence.N)
                              : img.severity_score?.N ? parseFloat(img.severity_score.N) : 0;
    const driverWalletAddress = img.driverWalletAddress?.S ?? '';
    // P0-5 fix: `source` is set to 'hardware_attested' by AttestationFn after ECDSA
    // P-256 verification; any other source (mobile self-asserted) mints nothing.
    const source              = img.source?.S ?? 'mobile';
    const lastDeviceId        = img.last_device_id?.S ?? img.device_id?.S ?? '';
    const s3_key              = img.s3_key?.S ?? null;
    const lat                 = parseFloat(img.lat?.N ?? '0');
    const lon                 = parseFloat(img.lon?.N ?? '0');
    const hazardId            = `${geohash}#${timestamp}`;
    const cooldownKey         = `proc#${hazardId}`; // per-hazard processing dedup (namespaced from reward dedup)

    const cooldown = await dynamodb.send(new GetCommand({ TableName: COOLDOWN_TABLE, Key: { cooldownKey } }));
    if (cooldown.Item) { console.log(`[Orch] SKIP cooldown active: ${cooldownKey}`); continue; }

    const traceId   = `orch-${geohash}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    // 2% VLM sampling — only run the expensive Bedrock+Agent pipeline on 2% of events.
    // The other 98% are scored deterministically from edge ONNX confidence alone.
    // Hardware-attested events skip VLM sampling — the ECDSA proof IS the verification
    // and they carry no dashcam frame. Mobile events keep VLM sampling (map quality
    // only; mobile mints no reward — see rewardWalletForHazard).
    const runVlm = source !== 'hardware_attested' && Math.random() < VLM_SAMPLE_RATE;
    console.log(`[Orch] ── START hazardId=${hazardId} type=${hazardType} onnx=${confidence.toFixed(2)} s3_key=${s3_key ?? 'null'} vlm_sample=${runVlm}`);

    if (!runVlm) {
      // Fast path: deterministic verdict from ONNX confidence (no Bedrock calls).
      const verdict = confidence >= 0.65 ? 'VERIFIED' : 'REJECTED';
      const totalScore = Math.round(confidence * 100);
      console.log(`[Orch] FAST_PATH hazardId=${hazardId} onnx=${confidence.toFixed(2)} verdict=${verdict}`);

      await dynamodb.send(new UpdateCommand({
        TableName: HAZARDS_TABLE, Key: { geohash, timestamp },
        UpdateExpression: 'SET #s = :s, verificationScore = :score',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': verdict, ':score': totalScore },
      }));

      if (verdict === 'VERIFIED') {
        // P0-5 fix: mint only for hardware-attested hazards, to the device-bound wallet.
        const rewardWallet = await rewardWalletForHazard(source, lastDeviceId);
        if (rewardWallet) {
          await tryCreditReward(rewardWallet, geohash, hazardId, createdAt);
        }
        // else: mobile/unbound hazard — no reward (hardware-attested-only).
        // STUB: future mobile-hazard rewards (gated on proof-of-location) hook in here.
        // TODO: mirror attested credits to Solana on this fast path (chain submit
        // currently lives in the VLM path only).
      }

      await dynamodb.send(new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId, hazardId,
          vlm_reasoning: 'VLM skipped — deterministic fast path (98% sample)',
          vlm_confidence: null, onnx_confidence: confidence,
          total_score: totalScore, verdict, createdAt,
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      }));
      await dynamodb.send(new PutCommand({
        TableName: COOLDOWN_TABLE,
        Item: { cooldownKey, processedAt: createdAt, ttl: Math.floor(Date.now() / 1000) + 30 },
      }));
      console.log(`[Orch] ── DONE hazardId=${hazardId} verdict=${verdict} (fast path) traceId=${traceId}`);
      continue;
    }

    // ── §3 Fail-Closed VLM Quarantine (2% sample path) ───────────────────────
    let vlmConfidence: number;
    let vlmReasoning: string;

    try {
      if (!s3_key) throw new Error('No frame (s3_key is null)');

      console.log(`[Orch] S3 fetch: bucket=${FRAMES_BUCKET} key=${s3_key}`);
      const s3Obj    = await s3.send(new GetObjectCommand({ Bucket: FRAMES_BUCKET, Key: s3_key }));
      const imgBytes = Buffer.from(await s3Obj.Body!.transformToByteArray());
      console.log(`[Orch] S3 fetch OK: ${imgBytes.length} bytes`);

      console.log(`[Orch] Bedrock converse → amazon.nova-lite-v1:0`);
      const vlmRes = await bedrock.send(new ConverseCommand({
        modelId: 'amazon.nova-lite-v1:0',
        messages: [{
          role: 'user',
          content: [
            { image: { format: 'jpeg', source: { bytes: imgBytes } } },
            { text: 'Analyze this dashcam frame. Is this a genuine physical road hazard? Return your reasoning and a confidence float (0.0 to 1.0). Respond ONLY with valid JSON: {"reasoning": "...", "confidence": 0.8}' },
          ],
        }],
      }));

      const vlmText = (vlmRes.output?.message?.content?.[0] as any)?.text ?? '{}';
      console.log(`[Orch] VLM raw response: ${vlmText}`);
      // Nova may wrap JSON in prose — extract the first {...} block, fail-closed on garbage.
      const jsonMatch = vlmText.match(/\{[\s\S]*\}/);
      const vlm     = JSON.parse(jsonMatch ? jsonMatch[0] : '{}') as { reasoning?: string; confidence?: number };
      const parsedConf = Number(vlm.confidence);
      vlmConfidence = Number.isFinite(parsedConf) ? Math.max(0, Math.min(1, parsedConf)) : 0;
      vlmReasoning  = vlm.reasoning ?? 'No reasoning provided';
      console.log(`[Orch] VLM parsed: confidence=${vlmConfidence.toFixed(3)} reasoning="${vlmReasoning}"`);

      // §3a: Explicit spoof detection — confidence < 0.1 means VLM is certain this is fake.
      // Trigger slash asynchronously (don't block the pipeline on the on-chain tx).
      if (vlmConfidence < 0.1 && driverWalletAddress && SLASH_FUNCTION) {
        console.log(`[Orch] SPOOF DETECTED — triggering slash for wallet=${driverWalletAddress}`);
        lambdaClient.send(new InvokeCommand({
          FunctionName: SLASH_FUNCTION,
          InvocationType: 'Event', // async — don't wait
          Payload: Buffer.from(JSON.stringify({
            walletAddress: driverWalletAddress,
            hazardId,
            reason: `VLM spoof detection: confidence=${vlmConfidence.toFixed(3)} reasoning="${vlmReasoning}"`,
          })),
        })).catch(e => console.error('[Orch] Slash invoke failed (non-blocking):', e.message));
      }

    } catch (err) {
      // §3: Any failure → quarantine. No reward is credited on this path.
      console.error(`[Orch] VLM QUARANTINE hazardId=${hazardId} reason:`, (err as Error).message);
      await dynamodb.send(new UpdateCommand({
        TableName: HAZARDS_TABLE, Key: { geohash, timestamp },
        UpdateExpression: 'SET #s = :s',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'UNVERIFIED_VLM_FAILED' },
      }));
      await dynamodb.send(new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId, hazardId,
          vlm_reasoning: 'VLM unavailable. Edge ONNX confidence recorded. Reward suspended.',
          vlm_confidence: null, onnx_confidence: confidence,
          discovery_bonus: null, total_score: null,
          verdict: 'UNVERIFIED_VLM_FAILED', createdAt,
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      }));
      await dynamodb.send(new PutCommand({
        TableName: COOLDOWN_TABLE,
        Item: { cooldownKey, processedAt: createdAt, ttl: Math.floor(Date.now() / 1000) + 30 },
      }));
      continue;
    }

    // ── §4 Agent Verification (ReAct) ────────────────────────────────────────
    console.log(`[Orch] Invoking Bedrock Agent for ReAct verification...`);
    const agentResult = await invokeAgent(geohash, hazardType, vlmReasoning, vlmConfidence);

    // Agent score takes precedence; fall back to deterministic formula if agent didn't return one
    const agentScore = agentResult.verificationScore;
    const discoveryBonus = agentScore == null ? (vlmConfidence >= 0.5 ? 40 : 0) : null;
    const totalScore = agentScore ?? (discoveryBonus! + vlmConfidence * 60);
    const verdict = totalScore >= 65 ? 'VERIFIED' : 'REJECTED';

    console.log(
      `[Orch] SCORE hazardId=${hazardId}` +
      ` | agent_score=${agentScore ?? 'n/a'}` +
      ` | vlm_confidence=${vlmConfidence.toFixed(3)}` +
      ` | total=${totalScore.toFixed(1)}/100` +
      ` | threshold=65` +
      ` | verdict=${verdict}` +
      ` | react_steps=${agentResult.reactSteps.length}`
    );

    await dynamodb.send(new UpdateCommand({
      TableName: HAZARDS_TABLE, Key: { geohash, timestamp },
      UpdateExpression: 'SET #s = :s, verificationScore = :score',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': verdict, ':score': Math.round(totalScore) },
    }));

    let rewardSkippedReason: string | null = null;

    if (verdict === 'VERIFIED') {
      // P0-5 fix: mint only for hardware-attested hazards, to the device-bound wallet.
      // The VLM path only runs for non-attested (mobile) hazards, so this resolves to
      // '' today and mints nothing — kept device-bound for when the paths converge.
      const rewardWallet = await rewardWalletForHazard(source, lastDeviceId);
      const credited = rewardWallet
        ? await tryCreditReward(rewardWallet, geohash, hazardId, createdAt)
        : false;
      if (!credited) {
        rewardSkippedReason = rewardWallet
          ? `Already rewarded to this contributor at geohash ${geohash} within the last 30 days.`
          : 'Reward skipped — hardware-attested hazards only (no device-bound wallet).';
        console.log(`[Orch] REWARD SKIP wallet=${rewardWallet || 'none'} geohash=${geohash}`);
      }

      // ── Submit to Solana (non-blocking — don't crash pipeline if chain is down) ──
      if (credited && rewardWallet) {
        const { latLngToCell } = await import('h3-js');
        const h3Index = BigInt('0x' + latLngToCell(lat, lon, 9));
        const epochDay = Math.floor(Date.now() / 1000 / 86400);
        const sigHash = createHash('sha256').update(hazardId).digest();
        try {
          const solResult = await submitHazardToChain({
            h3Index, epochDay,
            discovererPubkey: rewardWallet,
            vlmConfidence: vlmConfidence,
            onnxConfidence: confidence,
            signatureHash: sigHash,
          });
          console.log(`[Orch] Solana ${solResult.type} tx=${solResult.signature}`);
        } catch (e: any) {
          console.error(`[Orch] Solana submit failed:`, e.message);
        }
      }
    }

    await dynamodb.send(new PutCommand({
      TableName: TRACES_TABLE,
      Item: {
        traceId, hazardId,
        vlm_reasoning: vlmReasoning,
        vlm_confidence: vlmConfidence,
        onnx_confidence: confidence,
        agent_final_answer: agentResult.finalAnswer,
        react_steps: agentResult.reactSteps,
        discovery_bonus: discoveryBonus,
        total_score: Math.round(totalScore),
        verdict, createdAt,
        ...(rewardSkippedReason && { reward_skipped_reason: rewardSkippedReason }),
        ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
      },
    }));

    await dynamodb.send(new PutCommand({
      TableName: COOLDOWN_TABLE,
      Item: { cooldownKey, processedAt: createdAt, ttl: Math.floor(Date.now() / 1000) + 30 },
    }));

    console.log(`[Orch] ── DONE hazardId=${hazardId} verdict=${verdict} traceId=${traceId}`);
  }
};
