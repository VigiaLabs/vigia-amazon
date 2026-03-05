import { NextRequest, NextResponse } from 'next/server';

// Increase API route timeout for complex agent queries
export const maxDuration = 60; // 60 seconds

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, diffContext, context } = await req.json();

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

    // Call the agent chat Lambda via API Gateway
    const innovationApiUrl = process.env.NEXT_PUBLIC_INNOVATION_API_URL;
    if (!innovationApiUrl) {
      return NextResponse.json(
        { error: 'Innovation API URL not configured' },
        { status: 503 }
      );
    }

    const response = await fetch(`${innovationApiUrl}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: inputText,
        sessionId: sessionId ?? `chat-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lambda returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      content: data.content || 'No response from agent.',
      sessionId: data.sessionId || sessionId,
      traces: data.traces || [],
      thinking: data.thinking || [],
    });
  } catch (err: any) {
    console.error('[agent/chat] Error:', err);
    
    return NextResponse.json(
      { error: err.message || 'Agent invocation failed' },
      { status: 500 }
    );
  }
}

