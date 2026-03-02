# Agent "Thinking" Visualization Implementation

## Overview
Implemented Gemini/Perplexity-style "thinking" visualization for the Bedrock Agent verification process, making the demo more interactive by allowing users to manually trigger hazard verification and watch the agent's reasoning in real-time.

## Changes Made

### 1. Backend - Bedrock Agent Trace Capture

#### `packages/backend/src/orchestrator/index.ts`
- **Enabled ReAct tracing**: Added `enableTrace: true` to `InvokeAgentCommand`
- **Enhanced trace parsing**: Modified `parseAgentResponse()` to capture structured ReAct steps:
  - `thought`: Agent's reasoning
  - `action`: Function/tool being called
  - `actionInput`: Parameters passed to the action
  - `observation`: Result from the action
  - `finalAnswer`: Final conclusion
- **Store structured traces**: Save ReAct steps array to DynamoDB

#### `packages/backend/functions/verify-hazard-sync/index.ts` (NEW)
- **Synchronous verification endpoint**: New Lambda function for real-time verification
- **Streaming trace capture**: Parses Bedrock Agent response and returns structured ReAct steps
- **Fallback handling**: Auto-verification when Bedrock Agent is not configured
- **Cost-efficient**: Uses same Nova Lite model, no additional cost for traces

### 2. Frontend - Live Thinking Animation

#### `packages/frontend/app/components/AgentTracesTab.tsx`
- **Thinking indicator**: Animated pulsing dots while agent is processing
- **Live step rendering**: Each ReAct step appears with smooth animations as it's received
- **Visual hierarchy**:
  - 💭 Thought (gray, italic)
  - 🔧 Action (blue, bold)
  - 👁️ Observation (gray)
  - ✅ Final Answer (green)
- **Timer display**: Shows elapsed thinking time
- **Score display**: Shows verification score with color coding (green ≥70, red <70)
- **Event-driven updates**: Listens for custom events from verification panel

#### `packages/frontend/app/components/HazardVerificationPanel.tsx`
- **Removed polling**: Replaced async polling with synchronous API call
- **Event emission**: Dispatches custom events for Agent Traces tab:
  - `verification-start`: When verification begins
  - `verification-step`: For each ReAct step (staggered by 500ms)
  - `verification-complete`: When verification finishes
- **Interactive flow**: User manually triggers verification, watches agent think

#### `packages/frontend/app/globals.css`
- **Thinking animations**:
  - `@keyframes fadeIn`: Smooth fade-in for thinking indicator
  - `@keyframes slideIn`: Slide-in animation for each ReAct step
  - `.animate-fadeIn` and `.animate-slideIn` utility classes

### 3. Infrastructure - API Gateway Integration

#### `packages/infrastructure/lib/stacks/intelligence-stack.ts`
- **New Lambda function**: `verifyHazardSyncFn` for synchronous verification
- **Bedrock permissions**: Granted `bedrock:InvokeAgent` permission
- **DynamoDB access**: Write access to traces table

#### `packages/infrastructure/lib/stacks/ingestion-stack.ts`
- **New API endpoint**: `POST /verify-hazard-sync`
- **Lambda integration**: Wired up synchronous verification function
- **CORS enabled**: Allows frontend to call the endpoint

#### `packages/infrastructure/lib/vigia-stack.ts`
- **Stack wiring**: Connected intelligence stack's `verifyHazardSyncFn` to ingestion stack

## User Experience Flow

1. **Hazard Detection**: User uploads video, hazards are detected and marked as "pending"
2. **Manual Trigger**: User clicks "Verify" button on a pending hazard
3. **Thinking Animation**: Agent Traces tab shows:
   - Pulsing dots indicator
   - "Agent is thinking... (Xs)" timer
   - Each ReAct step appears with smooth animations
4. **Completion**: Final answer and verification score displayed
5. **Status Update**: Hazard marked as "verified" or "rejected" based on score

## Technical Details

### ReAct Trace Structure
```typescript
interface ReActStep {
  thought: string;        // Agent's reasoning
  action: string;         // Function being called
  actionInput: object;    // Parameters
  observation: string;    // Function result
  finalAnswer?: string;   // Only on last step
}
```

### Event Flow
```
HazardVerificationPanel
  ↓ (user clicks verify)
POST /verify-hazard-sync
  ↓ (Bedrock Agent processes)
Lambda returns ReAct steps
  ↓ (emit events)
AgentTracesTab listens
  ↓ (animate each step)
Live thinking visualization
```

### Cost Impact
- **No additional cost**: `enableTrace: true` is a built-in Bedrock feature
- **Same pricing**: Uses existing Nova Lite model (~$0.06/1M input tokens)
- **Efficient**: Synchronous call eliminates polling overhead

## Demo Benefits

1. **Transparency**: Users see exactly how the agent makes decisions
2. **Interactivity**: Manual verification makes demo more engaging
3. **Educational**: Shows AI reasoning process in real-time
4. **Professional**: Matches UX patterns from Gemini/Perplexity
5. **Debuggable**: Developers can inspect agent reasoning for issues

## Testing

To test the feature:
1. Deploy infrastructure: `npm run cdk:deploy`
2. Upload a video with hazards
3. Click "Verify" on a pending hazard
4. Watch the Agent Traces tab for live thinking animation
5. Verify the hazard status updates correctly

## Future Enhancements

- WebSocket streaming for true real-time updates (currently uses staggered events)
- Collapsible trace history
- Export trace logs for debugging
- Trace replay for training/demos
