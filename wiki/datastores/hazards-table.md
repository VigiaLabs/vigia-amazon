---
title: "HazardsTable"
type: datastore
tags: [#datastore, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[validator-fn]]", "[[attestation-fn]]", "[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[hazards-getter-fn]]", "[[eventbridge-pipes]]", "[[bedrock-router-fn]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# HazardsTable

Central hazard store. DynamoDB table with on-demand billing and DynamoDB Streams (`NEW_AND_OLD_IMAGES`).

**CDK name:** `HazardsTable`
**Source:** `ingestion-stack.ts:59`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `hazardId` | String (PK) | UUID |
| `timestamp` | String (SK) | ISO-8601 UTC |
| `status` | String | PENDING / UNVERIFIED / UNVERIFIED_VLM_FAILED / VERIFIED / REJECTED |
| `hazardType` | String | POTHOLE, DEBRIS, FLOODING, ACCIDENT, etc. |
| `lat`, `lon` | Number | WGS-84 |
| `confidence` | Number | 0–1 (ONNX output or stated confidence) |
| `driverWalletAddress` | String | Submitting wallet (mobile) or device_id (Pi) |
| `h3_index` | String | H3 cell at res-9 or res-10 |
| `geohash` | String | ngeohash precision-7 (mobile) |
| `s3_key` | String | Optional: `frames/<geohash>/<ts>.jpg` |
| `observation_count` | Number | Incremented on dedup upsert (Pi path) |
| `verification_score` | Number | Bedrock Agent score 0–100 |
| `vlm_reasoning` | String | Nova Lite reasoning text |
| `ttl` | Number | Unix epoch (30-day lifecycle) |

## GSIs

| Index | PK | SK | Projection |
|---|---|---|---|
| `status-timestamp-index` | `status` | `timestamp` | ALL |
| `h3-hazardtype-index` | `h3_index` | `hazardType` | KEYS_ONLY |

## DynamoDB Stream

NEW_AND_OLD_IMAGES stream. [[eventbridge-pipes]] connects this stream to [[orchestrator-fn]] via an INSERT-only filter (EventBridge Pipes evaluates `dynamodb:StreamRecord.eventName === "INSERT"`).

## Links

- [[validator-fn]] — writes PENDING on mobile ingest
- [[attestation-fn]] — upserts on Pi MQTT ingest
- [[orchestrator-fn]] — reads via EventBridge stream; updates status to VERIFIED/REJECTED
- [[verify-hazard-sync-fn]] — writes UNVERIFIED + updates to VERIFIED
- [[hazards-getter-fn]] — ScanCommand (Limit=100)
- [[eventbridge-pipes]] — sourced on this table's stream
- [[bedrock-router-fn]] — queries for surrounding hazards
- [[ingestion-stack]] — CDK construct owning this table
