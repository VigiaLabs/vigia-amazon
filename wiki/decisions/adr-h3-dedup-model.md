---
title: "ADR: H3 Geo-Deduplication Model"
type: decision
tags: [#decision, intelligence]
source: packages/backend/functions/attestation/index.ts, packages/backend/src/orchestrator/index.ts
related: ["[[h3-geo-dedup]]", "[[attestation-fn]]", "[[orchestrator-fn]]", "[[hazards-table]]"]
updated: 2026-06-20
---

# ADR: H3 Geo-Deduplication Model

## Context

Multiple devices may report the same hazard (e.g., 5 cars all observe the same pothole within seconds). Without deduplication, the system would create 5 hazard records, trigger 5 orchestrator runs, and potentially credit 5 rewards for a single event.

## Decision

Use H3 hexagonal grid for spatial deduplication:
- Pi path (single-observer precision): **res-10** (~15m cells), 24-hour window
- Mobile path (crowd density): **res-9** (~174m cells), 12-hour window

## Why H3 over Geohash?

- **Uniform cell size:** H3 hexagons are more uniform than geohash rectangles, reducing edge-case latitude distortions.
- **Resolution hierarchy:** H3 res-10 → res-9 is a predictable 7× area increase, useful for the Pi→mobile resolution mismatch.
- **GSI-native:** Storing `h3_index` as a DynamoDB attribute enables O(1) `h3-hazardtype-index` GSI lookup vs range-based geohash prefix queries.

## Consequences

- Two hazards 200m apart at res-9 may both be credited (they are in different H3 cells) — acceptable as they likely represent different physical hazards.
- Pi observations at res-10 (15m) provide finer dedup than mobile at res-9 (174m), reflecting higher Pi GPS precision.

## Links

- [[h3-geo-dedup]] — mechanism note
- [[attestation-fn]] — uses res-10
- [[orchestrator-fn]], [[verify-hazard-sync-fn]] — use res-9
- [[hazards-table]] — `h3-hazardtype-index` GSI
