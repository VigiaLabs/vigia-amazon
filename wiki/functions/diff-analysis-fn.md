---
title: "DiffAnalysisFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/functions/diff-analysis/index.ts
related: ["[[bedrock-agent]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# DiffAnalysisFn

Temporal road infrastructure diff analysis via Bedrock Agent. Takes a `diffMap` (comparing two road sessions) and returns structured analysis with degradation assessment and recommendations.

**File:** `packages/backend/functions/diff-analysis/index.ts`
**Runtime:** Node.js 20.x

## Handler Logic

1. Builds `context` string from `diffMap` (sessionA, sessionB, changes: newHazards, fixedHazards, worsenedHazards, degradationScore, timeSpanDays).
2. `InvokeAgentCommand` with `agentId: process.env.AGENT_ID`, `sessionId: diffMap.diffId`, `enableTrace:true`.
3. Streams response (`for await`). Extracts text from `chunk.bytes`; collects traces.
4. `parseAnalysisResponse()` — section-parses Bedrock text for summary, degradation assessment, recommendations.
5. Fallback on agent error: `generateFallbackAnalysis()` — rule-based from degradationScore thresholds.

## Links

- [[bedrock-agent]] — ReAct agent called for analysis
- [[intelligence-stack]] — CDK construct owning this Lambda
