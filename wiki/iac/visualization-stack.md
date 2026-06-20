---
title: "VisualizationStack (CDK)"
type: iac
tags: [iac, visualization]
source: packages/infrastructure/lib/stacks/visualization-stack.ts
related: ["[[vigia-stack]]", "[[hazards-table]]"]
updated: 2026-06-20
---

# VisualizationStack

CDK construct reserved for the public-facing hazard map / routing layer. Currently a
**placeholder** — it accepts the [[hazards-table]] via `VisualizationStackProps` but
provisions no resources yet.

- **Planned (Phase 6):** Amazon Location Service Map (MapLibre GL JS), Route Calculator,
  and a Route Hazard Analyzer Lambda that overlays attested hazards from [[hazards-table]]
  onto driver routes.
- **Status:** wired into [[vigia-stack]] as construct #7 but inert until Location Service
  resources are added (`visualization-stack.ts:9-13`).

## Links
Composed by [[vigia-stack]] · will read [[hazards-table]].
