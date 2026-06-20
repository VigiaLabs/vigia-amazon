---
title: "S3 Hazard Frames Bucket"
type: aws-service
tags: [#aws-service, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[validator-fn]]", "[[orchestrator-fn]]", "[[bedrock-nova-lite]]", "[[ingestion-stack]]", "[[hazard-verification-flow]]"]
updated: 2026-06-20
---

# S3 Hazard Frames Bucket

CDK name: `HazardFramesBucket`. Implements the S3 Pointer Pattern: frames are uploaded at ingest time by [[validator-fn]] and fetched asynchronously by [[orchestrator-fn]] for VLM analysis.

## Configuration

- `blockPublicAccess: BLOCK_ALL`
- `removalPolicy: DESTROY`, `autoDeleteObjects: true`
- Lifecycle rule: `expiration: 30 days`

## Write Path

[[validator-fn]] (`packages/backend/src/validator/index.ts`):
```ts
s3_key = `frames/${geohash}/${timestamp}.jpg`;
await s3.send(new PutObjectCommand({
  Bucket: process.env.FRAMES_BUCKET_NAME!,
  Key: s3_key, Body: Buffer.from(frame_base64, 'base64'),
  ContentType: 'image/jpeg',
}));
```
`s3_key` is stored in [[hazards-table]] for later retrieval.

## Read Path

[[orchestrator-fn]] (`packages/backend/src/orchestrator/index.ts`, 2% VLM path):
```ts
const s3Obj = await s3.send(new GetObjectCommand({ Bucket: FRAMES_BUCKET, Key: s3_key }));
const imgBytes = Buffer.from(await s3Obj.Body!.transformToByteArray());
```
Then passed to [[bedrock-nova-lite]] as `image.source.bytes`.

## IAM

- [[validator-fn]]: `framesbucket.grantPut`
- [[orchestrator-fn]]: `framesBucket.grantRead`

## Links

- [[validator-fn]] — writes frames on mobile telemetry ingest
- [[orchestrator-fn]] — reads frames for VLM analysis
- [[bedrock-nova-lite]] — consumes frame bytes
- [[hazards-table]] — stores `s3_key` pointer
- [[ingestion-stack]] — CDK construct owning this resource
