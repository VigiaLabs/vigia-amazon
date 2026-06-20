---
title: "H3 Geo-Deduplication"
type: security
tags: [#security, intelligence]
source: packages/backend/functions/attestation/index.ts, packages/backend/src/orchestrator/index.ts
related: ["[[attestation-fn]]", "[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[hazards-table]]", "[[adr-h3-dedup-model]]"]
updated: 2026-06-20
---

# H3 Geo-Deduplication

Prevents duplicate hazard reports from inflating rewards or maintenance queues. Uses H3 hexagonal hierarchical spatial indexing.

**Library:** `h3-js` (v4.4.0)

## Resolution Usage

| Context | Resolution | Approximate Cell Size | Time Window |
|---|---|---|---|
| [[attestation-fn]] (Pi path) | 10 | ~15m | 24h |
| [[orchestrator-fn]] / [[verify-hazard-sync-fn]] (mobile path) | 9 | ~174m | 12h |

## Dedup Logic (attestation/index.ts:173)

```ts
const h3Index = latLngToCell(lat, lon, 10);
// Query h3-hazardtype-index GSI:
// h3_index = h3Index AND hazardType = type AND timestamp > (now - 24h)
// If match: UPDATE existing (increment observation_count)
// Else:     PUT new record
```

The [[hazards-table]] GSI `h3-hazardtype-index` makes this lookup O(1) in DynamoDB (keyed by h3_index PK + hazardType SK).

## Links

- [[attestation-fn]] — uses res-10 for Pi dedup
- [[orchestrator-fn]], [[verify-hazard-sync-fn]] — use res-9 for mobile dedup
- [[hazards-table]] — `h3-hazardtype-index` GSI queried for dedup check
- [[adr-h3-dedup-model]] — design decision: why H3 over geohash
