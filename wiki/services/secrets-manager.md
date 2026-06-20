---
title: "AWS Secrets Manager"
type: aws-service
tags: [#aws-service, security]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts, packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[stripe-payout-fn]]", "[[sarvam-proxy-fn]]", "[[slash-node-fn]]", "[[orchestrator-fn]]", "[[ingestion-stack]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# AWS Secrets Manager

Secrets Manager stores all external service credentials. No secrets are hard-coded in Lambda environment variables at the source layer — they are injected at CDK synthesis time via `secret.secretValue.unsafeUnwrap()` (deploy-time resolution from the same account) or retrieved at runtime.

## Managed Secrets

| Secret Name | Injected Into | Used By |
|---|---|---|
| `vigia/stripe-secret-key` | `STRIPE_SECRET_KEY` env var | [[stripe-payout-fn]] |
| `vigia/stripe-publishable-key` | `STRIPE_PUBLISHABLE_KEY` env var | [[stripe-payout-fn]] (returned to client for SDK init) |
| `vigia/sarvam-api-key` | `SARVAM_API_KEY` env var | [[sarvam-proxy-fn]] |
| `vigia-solana-authority-ro47l5` | Runtime `GetSecretValue` call | [[orchestrator-fn]] (via `src/solana/authority.ts`), [[slash-node-fn]] |

## Runtime Pattern (Solana Authority)

`packages/backend/src/solana/authority.ts` lazy-loads and caches the authority keypair:
```ts
const { SecretString } = await sm.send(new GetSecretValueCommand({
  SecretId: process.env.SOLANA_AUTHORITY_SECRET_ARN!,
}));
const { privateKey } = JSON.parse(SecretString!);
_authority = Keypair.fromSecretKey(Uint8Array.from(privateKey));
```

IAM grants `secretsmanager:GetSecretValue` scoped to the specific secret ARN on [[orchestrator-fn]] and [[slash-node-fn]].

## Links

- [[stripe-payout-fn]] — consumes stripe keys
- [[sarvam-proxy-fn]] — consumes Sarvam API key
- [[orchestrator-fn]], [[slash-node-fn]] — runtime Solana authority fetch
- [[stripe]] — external service keyed by these secrets
- [[sarvam-ai]] — external service keyed by these secrets
