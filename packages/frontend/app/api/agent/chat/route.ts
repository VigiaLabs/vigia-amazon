import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// Increase API route timeout for complex agent queries
export const maxDuration = 60; // 60 seconds

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, diffContext, context } = await req.json();

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Bedrock Agent not configured' },
        { status: 503 }
      );
    }

    // Build context-aware prompt
    let inputText = query;
    const contextParts: string[] = [];

    // Add pinned sessions context
    if (context?.pinnedSessions && context.pinnedSessions.length > 0) {
      contextParts.push(`Pinned sessions: ${context.pinnedSessions.join(', ')}`);
    }

    // Add map/session context if available
    if (context) {
      if (context.sessionId) {
        contextParts.push(`Current session: ${context.sessionId}`);
      }
      if (context.viewport) {
        const { north, south, east, west } = context.viewport;
        contextParts.push(`Map viewport: north=${north}, south=${south}, east=${east}, west=${west}`);
      }
      if (context.selectedHazards && context.selectedHazards.length > 0) {
        contextParts.push(`Selected hazards: ${context.selectedHazards.slice(0, 5).join(', ')}`);
      }
      if (context.geohash) {
        contextParts.push(`Current geohash: ${context.geohash}`);
      }
      
      // Add route context if available
      if (context.type === 'route-calculated' && context.fastest && context.safest) {
        contextParts.push(`Route calculated between (${context.pinA?.lat}, ${context.pinA?.lon}) and (${context.pinB?.lat}, ${context.pinB?.lon})`);
        contextParts.push(`Fastest route: ${context.fastest.distance_km}km, ${context.fastest.duration_minutes}min, ${context.fastest.hazards_count} hazards`);
        contextParts.push(`Safest route: ${context.safest.distance_km}km, ${context.safest.duration_minutes}min, ${context.safest.hazards_count} hazards, avoided ${context.safest.hazards_avoided} hazards`);
        contextParts.push(`Recommendation: ${context.recommendation}`);
      }
    }

    // Add diff context if comparing sessions
    if (diffContext) {
      contextParts.push(`Comparing sessions: ${diffContext.sessionA} vs ${diffContext.sessionB}`);
      contextParts.push(`Changes: ${diffContext.totalNew || 0} new, ${diffContext.totalFixed || 0} fixed`);
    }

    // Construct final prompt with context
    if (contextParts.length > 0) {
      inputText = `[Context]\n${contextParts.join('\n')}\n\n[Query]\n${query}`;
    }

    // Check if query is asking for global context
    const isGlobalQuery = /\b(all|global|entire|everywhere|total)\b/i.test(query);
    if (isGlobalQuery && !query.includes('geohash') && !query.includes('location')) {
      inputText += '\n\nNote: User is asking for global/all hazards across the entire system.';
    }

    const client = new BedrockAgentRuntimeClient({
      region,
      requestHandler: {
        requestTimeout: 60000,
      } as any,
    });

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId ?? `chat-${Date.now()}`,
      inputText,
      enableTrace: true,
    });

    const response = await client.send(command);

    let completion = '';
    const traces: any[] = [];
    const thinkingSteps: string[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          completion += new TextDecoder().decode(event.chunk.bytes);
        }
        if (event.trace) {
          traces.push(event.trace);
          const rationale = event.trace.trace?.orchestrationTrace?.rationale?.text;
          if (rationale) thinkingSteps.push(rationale);
        }
      }
    }

    return NextResponse.json({
      content:
        completion ||
        'No response from agent. The agent may be processing your request. Try asking with more specific context.',
      sessionId: response.sessionId,
      traces,
      thinking: thinkingSteps,
    });
  } catch (err: any) {
    console.error('[agent/chat] Error:', err);

    if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
      return NextResponse.json(
        {
          content:
            "I'm currently experiencing high load. Try asking with specific context:\n\n• 'What hazards in geohash drt2yzr need attention?'\n• 'Analyze network health for current map area'\n• 'Find optimal path from (42.36, -71.06) to (42.37, -71.05)'\n\nOr ask about global data: 'Show all hazards globally'",
          sessionId: `error-${Date.now()}`,
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Agent invocation failed' },
      { status: 500 }
    );
  }
}

