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

    console.log('[agent/chat] Config:', { agentId, agentAliasId, region, hasCustomCreds: !!process.env.BEDROCK_ACCESS_KEY_ID });

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Bedrock Agent not configured', agentId, agentAliasId },
        { status: 503 }
      );
    }

    const client = new BedrockAgentRuntimeClient({ 
      region,
      credentials: process.env.BEDROCK_ACCESS_KEY_ID ? {
        accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID!,
        secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY!,
      } : undefined,
      requestHandler: {
        requestTimeout: 60000, // Increase to 60 seconds for complex queries
      } as any
    });

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

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId ?? `chat-${Date.now()}`,
      inputText,
      enableTrace: true, // Enable trace events
    });

    console.log('[agent/chat] Invoking agent with sessionId:', command.input.sessionId);
    const response = await client.send(command);
    console.log('[agent/chat] Agent response received');

    let completion = '';
    const traces: any[] = [];
    const thinkingSteps: string[] = [];
    let eventCount = 0;
    
    if (response.completion) {
      for await (const event of response.completion) {
        eventCount++;
        console.log(`[agent/chat] Event ${eventCount}:`, JSON.stringify(event, null, 2));
        
        if (event.chunk?.bytes) {
          const chunk = new TextDecoder().decode(event.chunk.bytes);
          console.log(`[agent/chat] Chunk received: ${chunk.substring(0, 100)}...`);
          completion += chunk;
        }
        // Capture trace events
        if (event.trace) {
          traces.push(event.trace);
          
          // Extract thinking/rationale
          const rationale = event.trace.trace?.orchestrationTrace?.rationale?.text;
          if (rationale) {
            thinkingSteps.push(rationale);
          }
        }
      }
    }

    console.log(`[agent/chat] Total events: ${eventCount}, Completion length: ${completion.length}`);

    return NextResponse.json({
      content: completion || 'No response from agent. The agent may be processing your request. Try asking with more specific context.',
      sessionId: response.sessionId,
      traces, // Include traces in response
      thinking: thinkingSteps, // Include extracted thinking steps
    });
  } catch (err: any) {
    console.error('[agent/chat] Error:', err);
    console.error('[agent/chat] Error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.$metadata?.httpStatusCode,
    });
    
    // Check for credential errors
    if (err.name === 'CredentialsProviderError' || err.message?.includes('credentials')) {
      return NextResponse.json(
        { 
          error: 'AWS credentials not configured in Amplify. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to environment variables.',
          details: err.message
        },
        { status: 500 }
      );
    }
    
    if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
      return NextResponse.json(
        { 
          content: "I'm currently experiencing high load. Try asking with specific context:\n\n• 'What hazards in geohash drt2yzr need attention?'\n• 'Analyze network health for current map area'\n• 'Find optimal path from (42.36, -71.06) to (42.37, -71.05)'\n\nOr ask about global data: 'Show all hazards globally'",
          sessionId: `error-${Date.now()}`
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Agent invocation failed', details: err.name },
      { status: 500 }
    );
  }
}

