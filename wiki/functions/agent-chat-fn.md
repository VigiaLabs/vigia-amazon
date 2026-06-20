---
title: "AgentChatFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/functions/agent-chat/index.ts
related: ["[[bedrock-agent]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# AgentChatFn

Pass-through Bedrock Agent chat with ReAct trace streaming. Designed for the frontend's natural-language agent chat interface.

**File:** `packages/backend/functions/agent-chat/index.ts`
**Runtime:** Node.js 20.x

## Handler Logic

1. Parses `{ query, sessionId }` from body.
2. `InvokeAgentCommand` with `agentId: AGENT_ID`, `agentAliasId: AGENT_ALIAS_ID`, `sessionId: sessionId ?? 'chat-<Date.now()>'`, `enableTrace:true`.
3. Streams response: accumulates `completion` text from `event.chunk.bytes`; collects `traces` array; extracts `rationale.text` from orchestration traces into `thinkingSteps[]`.
4. Returns: `{ content, sessionId, traces, thinking }`.

## Links

- [[bedrock-agent]] — TAWWC3SQ0L agent invoked
- [[ingestion-stack]] — CDK construct owning this Lambda (registered as entry point in architecture scan)
