# VIGIA-AMAZON — Master Design Spec V2 (rev 2.2)

**Status:** Active, internally reconciled. Supersedes v2.0/v2.1 and everything in `docs/design/archive/`.
**Scope:** cloud backend + VIGIA IDE — Lambda functions, CDK infra, rewards/attestation pipeline, Solana protocol, IDE frontend.
**Audited against:** `main` + `fix/v2-p0-security@9981f0e`. Two independent cross-reviews (Codex ×2) + first-party source re-verification.
**Companion specs:** [vigia-raspi V2](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md) · [vigia-public V2](../../vigia-public/docs/design/VIGIA_PUBLIC_V2.md) · [vigia2 V2](../../../../AndroidStudioProjects/vigia2/docs/design/VIGIA2_V2.md).
**Cross-repo protocol findings** (identity/sequencing, pairing) are defined in [vigia-raspi V2 §5](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md) and referenced here as A-CRIT-3 / A-SEC-6.

---

## 0. How to read

**Finding status:** `OPEN` · `IMPLEMENTED` · `IMPLEMENTED-PARTIAL` · `RETRACTED` · `SUPERSEDED` · `RECLASSIFIED` · `CLOSED` (already-correct). A finding appears once, with one status.
**Severity:** `P0` · `P1` · `P2`. OPEN/PARTIAL findings carry file:line · failure · fix · **acceptance** · deps. Resolved items (§6) are not scheduled. The status matrix (§1) is authoritative.

---

## 1. Implementation status matrix (keyed by branch@commit)

| ID | Title | Sev | Status | Where |
|----|-------|-----|--------|-------|
| A-CRIT-1 | Sessions CRUD unauthenticated / owner-spoofable | P0 | IMPLEMENTED | `fix/v2-p0-security@9981f0e` (auth + ownership only; **integrity split to A-CRIT-2**) |
| A-CRIT-2 | Session ledger invalid by construction | P0 | OPEN | new; hash-chain + transactionality |
| A-CRIT-3 | Canonical device id + QoS1-safe idempotency | P0 | OPEN | cross-repo, see raspi §5.1 |
| A-SEC-1 | sarvam-proxy unauthenticated (open billable) | P0 | OPEN | + Express engine, see public spec |
| A-SEC-2 | Injected secret in Lambda env config | P1 | OPEN | rationale corrected below |
| A-SEC-3 | Wildcard CORS on money/identity routes | P1 | OPEN | — |
| A-SEC-4 | Wildcard IAM (Location/Bedrock) | P1 | OPEN | correct ARN below |
| A-SEC-6 | claim-device race + phone-key delegation | P1 | OPEN | cross-repo, see raspi §5.2 |
| A-BUG-1 | Payout number precision + fixed-point money | P1 | OPEN | includes webhook :49 |
| A-QUAL-2..7 | Hardening batch | P2 | OPEN | see §3 |
| A-QUAL-8 | cdk CLI schema 53 < library 54 | P2 | OPEN | tooling; blocks `cdk synth` |
| A-SEC-5 | Stripe webhook signature verify | — | CLOSED | already implemented; §6 |
| A-QUAL-1 | Legacy duplicate EventBridge pipe | — | RECLASSIFIED | operational drift; §6 |

Verified-correct and retained: `tryCreditReward` atomic transaction; Ed25519 PoP on `register-device`; blacklist enforcement in `ValidatorFn`; attestation verifies signature before advancing sequence; `stripe-payout` domain-separated proof + atomic pre-debit + idempotency key + re-credit-on-failure; API GW request-model range validation.

---

## 2. Architecture recap (as-built)

```
Pi (mTLS) → IoT Core →Rule→ AttestationFn (ECDSA verify, anti-replay, H3 dedup) → HazardsTable + AttestationLog
Android (Ed25519) →APIGW→ ValidatorFn → HazardsTable
Streams → OrchestratorFn: 2% VLM (Nova-Lite) → Bedrock Agent; 98% fast path → tryCreditReward → slash-node (Solana + blacklist)
register-device (Ed25519 PoP) · claim-device (dual PoP) · stripe-payout/webhook (wallet proof) · sarvam-proxy · rewards-balance
Sessions CRUD + ledger validator · geohash/places (Location) · IDE frontend (Next.js) + diff/branch workers
```

---

## 3. Open findings

### A-CRIT-2 — Session ledger is invalid by construction (P0, OPEN)
**Files:** `packages/backend/src/sessions/handler.ts`, `packages/backend/src/ledger/validator.ts:23-85`.
**Failure (multiple, compounding):**
- **Chain semantics wrong.** Creation passes the *session file hash* as `previousHash`; the validator expects the first entry to be `genesis`; updates pass the session's `fileHash`, not the preceding ledger entry's `currentHash`. The chain does not actually link.
- **PUT does not recompute `fileHash`.** It mutates `verifiedCount`/`status` only, so the stored file hash no longer matches the record (the A-CRIT-1 comment claiming integrity fields are recomputed is accurate only for POST).
- **Content still caller-controlled.** `verifiedCount`, `hazardCount`, timestamp, geohash, status, hazards, metadata are client-supplied and feed the hash — so the "chain" attests attacker-chosen content.
- **Not transactional.** Session write and ledger write are separate `PutCommand`s; a ledger failure leaves a mutated session with no audit record. Concurrent PUTs read the same prior state and fork the history. DELETE writes no tombstone.
- **Validator is broken + leaky.** It queries a single global partition `ledgerId = 'ledger'` (hot partition; no owner scope), filters by session client-side, stops at DynamoDB's page limit (can falsely report truncated history as valid), is vulnerable to same-millisecond sort-key collisions, and leaks `error.message` at :85.
**Fix (redesign):** partition ledger by `ownerSub#sessionId`; monotonic version or ULID sort key; `TransactWriteItems` for the session mutation + ledger entry together, conditioned on the expected prior version/hash; derive `verifiedCount`/hashes server-side; record deletion as a tombstone; validator queries the session partition directly, walks the whole chain, scopes to the authenticated owner, and returns generic errors.
**Acceptance:** tests for update/delete concurrency, chain continuity across paginated history, tamper detection, tombstoned deletes, and owner-scoped validation. This is a **separate P0 from A-CRIT-1** — A-CRIT-1 is not "fully closed" until this lands.
**Depends on:** A-CRIT-1 (auth/ownership, done).

### A-SEC-1 — sarvam-proxy is an open, billable endpoint (P0, OPEN)
**Files:** `functions/sarvam-proxy/index.ts` (no JWT check); `infrastructure/lib/stacks/ingestion-stack.ts` (`/sarvam-proxy/*` has no authorizer, only `reservedConcurrentExecutions: 10`). Also the standalone Express engine exposes `/sarvam-proxy/stt|tts` unauthenticated ([vigia-public server/index.ts](../../vigia-public/docs/design/VIGIA_PUBLIC_V2.md)).
**Failure:** anyone can drain the Sarvam key's paid quota; the header comment claiming "Cognito JWT required" is false.
**Fix:** attach the existing `CognitoUserPoolsAuthorizer` to both proxy methods + defensive in-handler `aud`/`exp` check; per-user usage-plan throttling; do the same on the Express engine. Update the misleading comment.
**Acceptance:** unauthenticated call → 401; authenticated call within quota → 200; load test shows quota bounded per user.

### A-SEC-2 — Injected secret readable via Lambda function config (P1, OPEN — rationale corrected)
**File:** `ingestion-stack.ts` `SARVAM_API_KEY: sarvamSecret.secretValue.unsafeUnwrap()`.
**Correction:** `unsafeUnwrap()` on a `fromSecretNameV2` secret emits a CloudFormation **dynamic reference** (`{{resolve:secretsmanager:…}}`) that resolves at *deploy* time — it does **not** embed plaintext in the synthesized template. The real problem is that the resolved secret lands in the Lambda's **environment configuration**, readable by anyone with `lambda:GetFunctionConfiguration`.
**Fix:** fetch the secret at runtime via `GetSecretValue` (cache in the execution context) or the Lambda Secrets extension; least-privilege IAM to the specific secret ARN; rotate after the change. Apply to **all** injected secrets, including the Stripe secret key — not only Sarvam.
**Acceptance:** no resolved secret in any Lambda env var; `GetFunctionConfiguration` reveals no key material; function still authenticates to Sarvam/Stripe.

### A-SEC-3 — Wildcard CORS on money/identity routes (P1, OPEN)
`register-device`, `sarvam-proxy`, `stripe-payout`, `rewards-balance` return `Access-Control-Allow-Origin: *`; `ingestion-stack`/`session-stack` use `Cors.ALL_ORIGINS`. Signature proofs mitigate CSRF on the mutating ones, but `rewards-balance` leaking any wallet's balance cross-origin is still open. **Fix:** allow-list the known frontends; keep `*` only on genuinely non-credentialed reads and document why. **Acceptance:** cross-origin script from an unlisted origin is blocked by the browser for credentialed routes.

### A-SEC-4 — Wildcard IAM (P1, OPEN — correct ARN)
`session-stack.ts:76,137` grant `geo-places:*` on `*`; Bedrock policy in `intelligence-stack` is `*`. **Fix:** scope Location v2 actions to `arn:aws:geo-places:<region>::provider/default` (the v2 `provider` resource type — **not** a legacy place-index ARN); scope Bedrock to the exact model + agent-alias ARNs. **Acceptance:** each role's policy names specific resource ARNs; deploy still functions.

### A-SEC-6 — claim-device race + phone-key delegation (P1, OPEN)
**File:** `functions/claim-device/index.ts`. **(a) Race:** wallet-uniqueness is a GSI read followed by a `Put` conditioned on `device_id` only; two concurrent claims (same wallet, different devices) both pass. Fix with `TransactWriteItems` + a wallet-sentinel item. **(b) Key hierarchy:** the claim binds wallet↔device but never binds/delegates the Android BLE P-256 key, which the Pi needs for its allow-list — see [raspi §5.2](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md). The dual PoP (wallet_sig + device_sig) is correctly implemented; the gaps are the race and the missing delegation. **Acceptance:** concurrent distinct-device claims for one wallet → exactly one succeeds; claim record carries a wallet→phone delegation the Pi can consume.

### A-BUG-1 — Money math precision (P1, OPEN — refined)
**Files:** `stripe-payout/index.ts:117` (`Number(BigInt(...))`), `stripe-webhook/index.ts:49` (`Number(intent.metadata?.micro_vga ?? '0')`).
**Failure:** micro-VGA balances coerced to JS `Number` lose precision above 2^53; the payout condition is checked in BigInt but debited as the lossy Number, so the ledger can drift. **Refinement (Codex):** also handle DynamoDB number **deserialization** before `BigInt`, and use **fixed-point/rational** conversion for the USD rate rather than `BigInt()` on a possibly-fractional rate. **Fix:** keep the whole payout path in integer/BigInt; `(pendingMicro * rateNumerator) / rateDenominator`; cross to `Number` only at the Stripe integer-cents boundary. **Acceptance:** unit test at 2^53+1 micro-VGA and a fractional rate; ledger balances exactly.

### A-QUAL-2..8 (P2, OPEN)
`VLM_SAMPLE_RATE` as an explicit CDK env var (A-QUAL-2); schema-constrain orchestrator prompt interpolation (A-QUAL-3); assert `slash-node` is never API-routed (A-QUAL-4); fail-fast on empty `LOCATION_API_KEY` (A-QUAL-5); consolidate the two `verify-hazard-sync` variants (A-QUAL-6); no-PII/secret logging lint (A-QUAL-7); **upgrade the CDK CLI to ≥ 2.1128.0** — current CLI supports cloud-assembly schema 53 while the library emits schema 54, so `cdk synth` fails (A-QUAL-8).

---

## 5. Cross-repo protocol findings

- **A-CRIT-3** = canonical device identity + reboot/QoS1-safe idempotent sequencing. Cloud side: the attestation/validator path must accept `(deviceId, bootEpoch, sequence, payloadHash)` idempotently (QoS-1 redelivery credited once), reject the same tuple with a different payloadHash, reject old sequences within an epoch, reject reused/revoked boot epochs, and maintain a used-epoch registry. Full spec in [raspi §5.1](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md).
- **A-SEC-6 delegation** = the claim record must carry the wallet→Android-BLE-key delegation. Full spec in [raspi §5.2](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md).

---

## 6. Resolved / retracted / reclassified (not scheduled)

- **A-SEC-5 — CLOSED (already implemented).** `stripe-webhook/index.ts:39` verifies `Stripe-Signature` via `constructEvent` over the raw body and 400s unverified events; refund reconciliation is idempotent. (Its `Number()` at :49 is tracked under A-BUG-1, not here.)
- **A-QUAL-1 — RECLASSIFIED.** The legacy duplicate EventBridge pipe is deploy-state drift, not establishable from the repo; operational cleanup/verification item only.

---

## 7. Priority-ordered work plan (OPEN/PARTIAL only)

1. **A-CRIT-2** ledger redesign (transactional, owner-partitioned, server-derived) — do **before** calling A-CRIT-1 fully closed.
2. **A-CRIT-3** canonical id + QoS1 idempotency (cross-repo; cloud side).
3. **A-SEC-1** sarvam-proxy + Express auth.
4. **A-SEC-2** runtime secrets (Sarvam + Stripe); **A-BUG-1** money math.
5. **A-SEC-6** transactional claim + delegation; **A-SEC-3** CORS; **A-SEC-4** IAM.
6. **A-QUAL-2..8** hardening (incl. CDK CLI upgrade to unblock `cdk synth`).

---

## 8. Azure-native migration (November window)

- **A-AZ-1 — Rewards + identity: Solana → Azure Confidential Ledger + Cosmos DB + UPI.** Property-for-property port: `register-device` PoP (add timestamp per A-SEC-6) → Azure Function + DPS X.509 identity; `tryCreditReward` → Cosmos transactional batch; Solana ledger → Confidential Ledger receipts; slash → negative ACL entry + blacklist; Stripe → UPI payouts. Policy-weighted rewards via `costCalculator` ROI. ACL is an integrity service, **not** an AI service — it does not count toward the IC "2+ AI services" requirement.
- **A-AZ-2 — Bedrock → Azure OpenAI (3 surfaces):** orchestrator VLM, Bedrock ReAct Agent, and the vigia-public search engine. Dual-run until parity.
- **A-AZ-3 — frame-hash validation** once the edge/Android signers include it — but see the [raspi R-SEC-4 re-scope](../../../vigia-raspi/.claude/design/VIGIA_RASPI_V2.md): it needs the uploaded hashed artifact + a Pi-side signature, not the Pico.
- **A-AZ-4 — IDE** agent calls route through the same Azure OpenAI/Foundry endpoints with consistent auth.

---

## Appendix — verification method
Re-verified by reading cited files at `fix/v2-p0-security@9981f0e` / `design/v2-specs`. Backend build + 23 tests pass (incl. new ownership tests); tests do **not** yet cover update/delete concurrency, schema validation, ledger atomicity, or chain validation (A-CRIT-2). `cdk synth` blocked by the CLI/library schema mismatch (A-QUAL-8), not by these changes.
