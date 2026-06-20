---
title: "Anti-Replay Sequence Watermark"
type: security
tags: [#security, ingestion]
source: packages/backend/functions/attestation/index.ts
related: ["[[attestation-fn]]", "[[vigia-pi-device-registry]]", "[[ecdsa-p256-verify]]", "[[hazard-attestation-flow]]"]
updated: 2026-06-20
---

# Anti-Replay Sequence Watermark

Prevents replay attacks on ECDSA-signed Pi attestations. The Pi firmware increments a monotonic `sequence` counter (uint32) per attestation. Lambda enforces strict monotonicity in DynamoDB.

## DynamoDB Update (attestation/index.ts:296)

```ts
await ddb.send(new UpdateCommand({
  TableName: REGISTRY_TABLE,
  Key: { device_id },
  ConditionExpression: 'attribute_not_exists(last_seq) OR last_seq < :seq',
  UpdateExpression: 'SET last_seq = :seq',
  ExpressionAttributeValues: { ':seq': sequence },
}));
```

`ConditionalCheckFailedException` → reject (seq ≤ watermark = replay or reorder).

## Ordering Constraint

The anti-replay check runs AFTER `p256.verify()` succeeds. This is intentional:
- If it ran before verify, a forged packet with seq=MAX_UINT32 would poison the watermark and block all future legitimate packets.

## Links

- [[attestation-fn]] — runs this check
- [[vigia-pi-device-registry]] — stores `last_seq` per device
- [[ecdsa-p256-verify]] — runs first (before anti-replay)
- [[hazard-attestation-flow]] — end-to-end flow
