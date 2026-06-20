---
title: "Fail-Closed VLM Quarantine"
type: security
tags: [#security, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[bedrock-nova-lite]]", "[[s3-frames-bucket]]", "[[hazards-table]]", "[[adr-vlm-sample-rate]]"]
updated: 2026-06-20
---

# Fail-Closed VLM Quarantine

When the VLM path is taken (2% sample) and any error occurs (S3 fetch failure, Bedrock timeout, JSON parse failure), the hazard is quarantined rather than rewarded or rejected. Prevents attackers from triggering VLM failures to bypass visual verification.

## Quarantine Code (orchestrator/index.ts:291-316)

```ts
} catch (vlmError) {
  await ddb.send(new UpdateCommand({
    Key: { hazardId },
    UpdateExpression: 'SET #s = :status',
    ExpressionAttributeValues: { ':status': 'UNVERIFIED_VLM_FAILED' },
  }));
  // put cooldown to prevent retry
  await putCooldown(`proc#${geohash}#${timestamp}`, 30);
  return; // NO reward, NO reject → quarantined
}
```

## Why Not REJECTED?

REJECTED implies the submission was evaluated and found fraudulent. `UNVERIFIED_VLM_FAILED` is an explicit audit signal: "we couldn't verify this; investigate." The submitter receives no reward, but no on-chain slash either (since we lack VLM evidence). A human reviewer can inspect S3 frame if it exists.

## Links

- [[orchestrator-fn]] — implements this catch block
- [[bedrock-nova-lite]] — source of potential VLM failures
- [[s3-frames-bucket]] — S3 fetch is first potential failure point
- [[hazards-table]] — status written as UNVERIFIED_VLM_FAILED
- [[adr-vlm-sample-rate]] — sampling decision and tradeoff discussion
