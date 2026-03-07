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

    // Call the agent chat Lambda via API Gateway
    const innovationApiUrl = process.env.NEXT_PUBLIC_INNOVATION_API_URL;
    if (!innovationApiUrl) {
      console.error('[agent/chat] NEXT_PUBLIC_INNOVATION_API_URL not configured');
      return NextResponse.json(
        { error: 'Innovation API URL not configured' },
        { status: 503 }
      );
    }

    console.log('[agent/chat] Calling:', `${innovationApiUrl}/agent/chat`);
    console.log('[agent/chat] Input text:', inputText);

    const response = await fetch(`${innovationApiUrl}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: inputText,
        sessionId: sessionId ?? `chat-${Date.now()}`,
      }),
    });

    console.log('[agent/chat] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[agent/chat] Lambda error:', errorText);
      throw new Error(`Lambda returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[agent/chat] Response data:', data);

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

