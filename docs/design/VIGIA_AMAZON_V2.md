# VIGIA-AMAZON — Master Design Spec V2

**Status:** Active · supersedes everything in `docs/design/archive/` (`solana_design.md`, `solana_BME_design.md`, `solana_lambda_migration.md`, the old `README.md`) and the prior `archive/` dump at repo root.
**Scope:** the cloud backend + VIGIA IDE — AWS Lambda functions, CDK infrastructure, the rewards/attestation pipeline, Solana protocol, and the road-infrastructure IDE frontend.
**Audited:** 2026-07-25 against `main` (commit `b83c597`). Review + improvement spec only; nothing here is implemented yet.
**Companion specs:** [vigia-raspi V2](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md), [vigia-public V2](../../vigia-public/docs/design/VIGIA_PUBLIC_V2.md), [vigia2 V2](../../../../AndroidStudioProjects/vigia2/docs/design/VIGIA2_V2.md).

---

## 0. Reading guide

IDs: `A-CRIT-n`, `A-SEC-n`, `A-BUG-n`, `A-QUAL-n`, `A-AZ-n`. Severities P0/P1/P2 as in the sibling specs. The prior security audit (S.1–S.9 in the archived raspi GAP_TRACKER) fixed the reward-farming, double-spend, Sybil, and slash-enforcement issues — those are **verified still-correct** here and not re-listed except where a residual remains.

**The single biggest V2 decision (A-AZ-1):** the rewards + identity layer is Solana-coupled end-to-end. The IC-2027 narrative is *municipal SaaS + hardware-attested data integrity*, not DePIN tokens. This spec both hardens the current AWS/Solana system (so the pilot keeps running) **and** specifies the Azure-native replacement to migrate to in November. Both are in scope; do not conflate them.

---

## Review Reconciliation (v2.1 — cross-reviewed and verified against source, 2026-07-25)

An independent second review (Codex) cross-checked this spec; every item was re-verified by reading the cited files. **Authoritative where it conflicts with the original findings.**

### RETRACTED / REVISED

- **A-SEC-5 (Stripe webhook) — RETRACTED (already implemented).** `stripe-webhook/index.ts:39` verifies `Stripe-Signature` via `stripe.webhooks.constructEvent` over the raw body and 400s unverified events. No action needed. However, the same file's `Number(intent.metadata?.micro_vga ?? '0')` (:49) shares the A-BUG-1 precision loss — folded into A-BUG-1.
- **A-SEC-4 (IAM scope) — REFINED.** Valid, but Location is a v2 `geo-places` action: scope to `arn:aws:geo-places:<region>::provider/default`, not a legacy place-index ARN. Confirm against the AWS service-authorization reference at implementation.
- **A-QUAL-1 (duplicate pipe) — RECLASSIFIED.** Deployed-state drift, not establishable from the repo; treat as an operational cleanup/verification item, not a code finding.
- **A-SEC-2 (secret exposure) — BROADENED.** The runtime-fetch requirement applies to every injected secret, not only Sarvam — audit the Stripe secret-key injection the same way.

### New CONFIRMED findings

- **A-CRIT-1 — Sessions CRUD fully unauthenticated and trusts client identity/integrity (P0).** `session-stack.ts:104-110` attaches no authorizer to POST/GET/PUT/DELETE `/sessions`. `sessions/handler.ts` reads `data.userId/verifiedCount/contributorId` from the request body and derives `fileHash`/`parentHash` from client-supplied values; GET uses `queryStringParameters.userId`. Any caller can read/update/delete any user's sessions and forge the supposedly hash-chained ledger. Fix: Cognito authorizer on all routes; derive identity from JWT claims; reject client-supplied identity/integrity fields; condition every write on the authenticated owner.
- **A-SEC-6 — claim-device wallet-uniqueness race (P1).** `claim-device/index.ts` reads the wallet GSI, then writes with a condition on `device_id` only. Two concurrent claims (same wallet, different devices) both observe an empty GSI and both succeed, breaking "one wallet, one device." Fix: a DynamoDB `TransactWriteItems` with a wallet-sentinel uniqueness item. *(The dual proof-of-possession — wallet_sig + device_sig — is correctly implemented; only the uniqueness enforcement is raceable.)*

**Note on device binding:** the server side (`claim-device`) correctly requires both signatures; binding fails end-to-end because the *client* sends an empty device signature and the *Pi* has no sign-challenge command — see vigia2 M-CRIT-2 and vigia-raspi R-SEC-6/R-CRIT-6.

### Revised priority (amazon)

1. A-CRIT-1 Sessions lockdown.
2. A-SEC-1 sarvam-proxy auth; A-SEC-2 runtime secrets (incl. Stripe).
3. A-BUG-1 BigInt payout math (incl. webhook :49); A-SEC-6 transactional claim.
4. A-SEC-3 CORS allow-list; A-SEC-4 IAM (provider ARN); remaining hardening.

Removed from scope: A-SEC-5.

---

## 1. Architecture recap (as-built, verified)

```
Pi (mTLS) ─► AWS IoT Core ─Rule─► AttestationFn ─┬─ ECDSA P-256 verify (@noble/curves)
                                                 ├─ DynamoDB anti-replay (conditional write)
                                                 ├─ H3 res-10 geo-dedup ─► HazardsTable
                                                 └─ AttestationLogTable
Android (Ed25519) ─API GW─► ValidatorFn ─► HazardsTable
DynamoDB Streams ─► OrchestratorFn ─┬─ 2% VLM sample (Bedrock Nova-Lite) ─► Bedrock Agent (ReAct)
                                    └─ 98% fast path ─► tryCreditReward (atomic dedup+balance+ledger)
                                                          └─ slash-node ─► Solana + blacklist
register-device (Ed25519 PoP) ─► DeviceRegistry     stripe-payout (wallet proof) ─► Stripe Connect
sarvam-proxy (STT/TTS)     rewards-balance (wallet proof)     IDE frontend (Next.js) + diff/branch workers
```

Verified-correct (keep): `tryCreditReward` atomic transaction (S.1/S.2), Ed25519 proof-of-possession on `register-device` (S.3), blacklist enforcement in `ValidatorFn` (S.4), attestation verifies signature before advancing sequence (S.5), `stripe-payout` domain-separated proof + atomic pre-debit + idempotency key + re-credit-on-failure (a genuinely well-built function), API GW request-model validation with range checks.

---

## 2. P0 — Critical findings

### A-SEC-1 — `sarvam-proxy` has no authentication in code; the "Cognito JWT required" claim is false
**File:** `packages/backend/functions/sarvam-proxy/index.ts:32-123` (handler never inspects `Authorization`); `packages/infrastructure/lib/stacks/ingestion-stack.ts:411-436` (no authorizer attached to `/sarvam-proxy/*`).
**Failure:** the file header says *"Caller must be authenticated (Cognito JWT via Authorization header) so the proxy cannot be abused by anonymous callers"* — but nothing validates the JWT, and the route has **no API Gateway authorizer**. The only guard is `reservedConcurrentExecutions: 10` (a comment even admits it's a stopgap "until the Cognito authorizer lands"). Anyone on the internet can call `/sarvam-proxy/stt|tts` and burn the Sarvam key's paid quota (bounded only by concurrency). This is an open, billable proxy.
**V2 fix:** attach the existing `CognitoUserPoolsAuthorizer` (already built in `enterprise-stack.ts:126`) to both `/sarvam-proxy` methods, and defensively re-verify the JWT `aud`/`exp` in-handler. Add per-user usage-plan throttling. Update the header comment to match reality once fixed.

### A-SEC-2 — Sarvam secret is baked into the Lambda env as plaintext via `unsafeUnwrap()`
**File:** `packages/infrastructure/lib/stacks/ingestion-stack.ts:419-423` — `SARVAM_API_KEY: sarvamSecret.secretValue.unsafeUnwrap()`.
**Failure:** `unsafeUnwrap()` resolves the secret at **synth time** and writes it into the CloudFormation template and the Lambda's environment variables. Anyone with `lambda:GetFunctionConfiguration`, CloudFormation read, or template access sees the key in cleartext — it also lands in CloudTrail/console. This defeats the purpose of Secrets Manager. (Note the Fargate stack does this correctly via `ecs.Secret` — see `infrastructure/cdk/fargate-stack.ts`.)
**V2 fix:** fetch the secret at **runtime** with `GetSecretValue` (cache in the execution context), or use the Lambda "secrets from Secrets Manager" env integration / extension. Never `unsafeUnwrap()` into env. Rotate the key after this change (assume the current one is exposed).

### A-BUG-1 — Reward balance precision loss above 2^53 (`Number(BigInt(...))`)
**File:** `packages/backend/functions/stripe-payout/index.ts:117` — `const pendingMicro = Number(BigInt(item.pending_balance?.toString() ?? '0'))`.
**Failure:** micro-VGA (1e-6 VGA) balances are stored/compared as BigInt for correctness, then coerced to a JS `Number` for the payout math. Above 2^53 micro-VGA (~9.007e9 VGA) the conversion silently loses precision — a user could be paid slightly more or less than owed, and the DynamoDB conditional (`pending_balance >= :claim`) is checked in BigInt but the debit `:neg = -pendingMicro` is the lossy Number, so the ledger can drift. Low likelihood at pilot scale, but it is a money-handling correctness bug and exactly the kind of thing a technical review pokes at.
**V2 fix:** keep the entire payout path in BigInt; convert to USD cents with integer math (`(pendingMicro * BigInt(vgaToUsdCents)) / 1_000_000n`) and only cross to Number at the Stripe API boundary (which itself takes integer cents). Add a unit test at 2^53+1.

---

## 3. P1 — High findings

### A-SEC-3 — CORS `*` on money/identity endpoints
**Files:** `register-device/index.ts:15`, `sarvam-proxy/index.ts:23`, `stripe-payout/index.ts:36`, `rewards-balance` — all `Access-Control-Allow-Origin: *`. Also `ingestion-stack.ts:311` and `session-stack.ts` use `Cors.ALL_ORIGINS`.
**Failure:** wildcard CORS on endpoints that move money or expose balances. The signature-proof headers (`X-Wallet-*`) mitigate CSRF for the mutating ones, but `*` still lets any origin script the API on behalf of a tricked user and broadens the abuse surface. `rewards-balance` leaking any wallet's balance cross-origin was flagged as A.7 in the archived audit and is still open.
**V2 fix:** replace `*` with an allow-list of the known frontends (IDE, app web, landing). For endpoints that must stay public, keep `*` only on genuinely non-credentialed reads and document why.

### A-SEC-4 — IAM `resources: ['*']` on Location + (per archived A.8) Bedrock
**Files:** `session-stack.ts:76` and `:137` (`geo-places:*` on `*`); Bedrock policy in `intelligence-stack.ts` (archived A.8).
**Failure:** over-broad IAM. A compromised Location/Bedrock Lambda can call those services against any resource in the account.
**V2 fix:** scope Location actions to the specific place-index ARNs; scope Bedrock to the exact model + agent ARNs (`arn:aws:bedrock:...:foundation-model/amazon.nova-lite-v1:0`, the agent alias ARN). Least-privilege per function role.

### A-SEC-5 — Verify Stripe webhook signature
**File:** `packages/backend/functions/stripe-webhook/index.ts` (83 lines — flagged for verification during audit).
**Failure/риск:** if the webhook handler does not call `stripe.webhooks.constructEvent` with the signing secret, an attacker can POST forged `payout.paid` / `account.updated` events to manipulate payout state. Must confirm.
**V2 fix:** verify `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` (Secrets Manager, runtime-fetched) before processing any event; reject unverified. Idempotency on `event.id`.

### A-BUG-2 — `register-device` proof binds to the address, not to a fresh challenge (replay window)
**File:** `packages/backend/functions/register-device/index.ts:41-45` — signs `VIGIA-REGISTER:<device_address>` with no timestamp/nonce.
**Failure:** the proof-of-possession message is static per device, so a captured registration signature is replayable forever. Registration is idempotent (conditional write), so the practical impact is low — but a captured proof could be used to (re)assert control semantics if the record is ever deleted/reset. Contrast `stripe-payout`/`rewards-balance`, which correctly bind `:timestamp`.
**V2 fix:** include a timestamp in the signed message (`VIGIA-REGISTER:<addr>:<tsMs>`) with a ±5-min freshness window, matching the payout/balance pattern. Coordinate with the Android `WalletRepositoryImpl` signer (which currently signs the static form).

### A-QUAL-1 — Legacy duplicate EventBridge pipe still double-invokes the orchestrator (S.9)
**Failure:** `vigia-hazards-to-orchestrator` is a third stream consumer that double-invokes the orchestrator (double VLM spend, double reward-credit attempts — the latter is saved only by `tryCreditReward` dedup). Archived audit S.9 left it open pending manual deletion.
**V2 fix:** `aws pipes delete-pipe --name vigia-hazards-to-orchestrator`; codify the single-consumer topology in CDK so it can't drift back.

---

## 4. P2 — Quality / hardening

- **A-QUAL-2** — `VLM_SAMPLE_RATE` relies on a code default (0.02) and is not a CDK env var (archived A.9); make it an explicit, tunable env var so sampling can be raised for the demo without a code change.
- **A-QUAL-3** — `orchestrator/index.ts` prompt construction (`invokeAgent`, line 67-86) interpolates `hazardType`/`geohash`/`vlmReasoning` into the agent prompt; ensure these are schema-constrained enums / numeric before interpolation (prompt-injection hygiene, even though inputs are internal today).
- **A-QUAL-4** — `slash-node` is an internal async invoke with no caller auth; confirm it is **never** wired to an API Gateway route (a slashing endpoint reachable externally would be catastrophic). Add an assertion/test on the CDK topology.
- **A-QUAL-5** — `LOCATION_API_KEY: process.env.LOCATION_API_KEY || ''` (`session-stack.ts:126`) ships an empty key silently; fail fast at deploy if unset, or fetch from Secrets Manager.
- **A-QUAL-6** — Consolidate the two verify-hazard-sync variants (`index.ts` + `index-streaming.ts`, 400 lines) — dead/duplicate code risk; keep one.
- **A-QUAL-7** — Structured logging + no PII/secret in logs across all handlers (spot-checked OK, but make it a lint rule).

---

## 5. Azure-native migration (November window)

### A-AZ-1 — Rewards + identity: Solana → Azure Confidential Ledger + Cosmos DB + UPI
The central V2 move. Property-for-property mapping (see roadmap §5):

| Today (AWS + Solana) | Azure-native V2 |
|---|---|
| `register-device` Ed25519 PoP → DeviceRegistry (DynamoDB) | Same crypto, Azure Function; device identity via **IoT Hub DPS X.509** (ATECC608). Add timestamp per A-BUG-2. |
| `tryCreditReward` DynamoDB TransactWrite | **Cosmos DB transactional batch** — near-mechanical port of the atomic dedup+balance+ledger pattern. |
| Solana ledger entries | **Azure Confidential Ledger** (TEE-backed, append-only, cryptographic receipts): `{device_id, event_hash, ISS, amount, ts}`; receipt surfaced to the app so any driver/auditor verifies independently. |
| `slash-node` on-chain slash | Validator Function writes a negative ACL entry + flips `blacklisted` (keep the existing enforcement). |
| Token payout via Stripe Connect | **UPI payouts** (Razorpay/Cashfree Payouts Function). A driver can spend UPI; not a token. Delete the empty Stripe stubs on the client. |

**Policy-weighted rewards (the upgrade):** first-discovery > re-confirmation; never-scanned rural km > redundant highway passes; work-order-filed → completion bonus on verified repair. Wire `lib/costCalculator.ts` (repair cost / prevented damage / ROI) into the credit amount so rewards become a data-acquisition policy instrument. Every step auditable in ACL.
**Note:** ACL is an *integrity* service, not an AI service — it does **not** count toward the IC "2+ Microsoft AI services" requirement (Foundry Local, Foundry agents, Azure OpenAI, Azure AI Speech, IoT Hub cover that). ACL wins the security narrative + technical review.

### A-AZ-2 — Bedrock → Azure OpenAI (three surfaces, not one)
Bedrock is load-bearing in (a) `orchestrator` VLM sampling (Nova-Lite), (b) the Bedrock ReAct Agent, (c) — cross-repo — the vigia-public search engine. Port (a)→Azure OpenAI vision, (b)→Foundry Agent Service, keep AWS running until 2 clean dual-run weeks. See [vigia-public V2 §P-AZ](../../vigia-public/docs/design/VIGIA_PUBLIC_V2.md).

### A-AZ-3 — Frame-hash validation (H2, cross-repo)
`ValidatorFn` / `AttestationFn` must recompute `sha256(frame)` and compare against the signed value once the edge + Android signers include it. See [vigia-raspi V2 R-SEC-4](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md).

### A-AZ-4 — IDE (frontend) forward work
The road-infrastructure IDE (Next.js frontend + diff/branch web workers) is out of the critical security path but is the "design road infrastructure" demo surface. V2: ensure its agent calls route through the same Azure OpenAI/Foundry endpoints, and that its map/diff data reads carry the same auth as the rest.

---

## 6. Priority-ordered work plan

| Order | ID | Item | Effort |
|---|---|---|---|
| 1 | A-SEC-1 | Attach Cognito authorizer to sarvam-proxy + in-handler JWT check | ~0.5 d |
| 2 | A-SEC-2 | Runtime secret fetch (kill unsafeUnwrap); rotate key | ~0.5 d |
| 3 | A-SEC-5 | Stripe webhook signature verification | ~0.5 d |
| 4 | A-BUG-1 | BigInt-clean payout math + test | ~0.5 d |
| 5 | A-SEC-3/4 | CORS allow-list + IAM least-privilege | ~1 d |
| 6 | A-BUG-2, A-QUAL-1 | Timestamped registration proof; delete duplicate pipe | ~0.5 d |
| 7 | A-QUAL-2..7 | Hardening batch | ~1.5 d |
| 8 | A-AZ-1..4 | Azure migration (Nov window) | see roadmap |

**Definition of done for V2:** no open/unauthenticated billable endpoint; no secret in any template or env var; all money math in BigInt with tests; least-privilege IAM; and (post-migration) the rewards ledger demonstrably tamper-evident via Confidential Ledger receipts the driver can verify.
