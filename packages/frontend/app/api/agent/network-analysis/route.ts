import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { enforceAgentRateLimit } from '@/app/lib/server/agent-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceAgentRateLimit(req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, retryAfter: rl.retryAfterMs },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) },
        }
      );
    }

    const body = await req.json();
    const { geohash, radiusKm, query, context } = body;
    const activeGeohash = geohash ?? context?.geohash;

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Agent configuration missing' },
        { status: 503 }
      );
    }

    const client = new BedrockAgentRuntimeClient({ region });

    // Build input text based on whether we have a specific node or global query
    let inputText = query;
    
    if (!inputText) {
      if (activeGeohash) {
        // Node-specific query - explicitly provide geohash in the query
        inputText = `Analyze network health for geohash ${activeGeohash} within ${radiusKm || 10}km radius. Use the analyze_node_connectivity tool with geohash="${activeGeohash}" and radiusKm=${radiusKm || 10}.`;
      } else {
        // Global query - analyze overall network health
        inputText = `Analyze global network connectivity health across all regions. Use scan_all_hazards with minConfidence=0.7 and limit=50 to get an overview of high-priority hazards. Provide insights on total hazards detected, hazard distribution by type, and overall network coverage quality.`;
      }
    } else if (activeGeohash && !query.includes('geohash')) {
      // User provided a query but didn't include geohash - append it
      inputText = `${query} Use geohash ${activeGeohash} for the analysis.`;
    }

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: `network-analysis-${Date.now()}`,
      inputText,
      enableTrace: true,
    });

    // Set a timeout for the Bedrock request (30 seconds)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Agent request timed out after 30 seconds')), 30000)
    );

    const response = await Promise.race([
      client.send(command),
      timeoutPromise
    ]) as any;

    let completion = '';
    const traces: any[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          completion += new TextDecoder().decode(event.chunk.bytes);
        }
        if (event.trace) {
          traces.push(event.trace);
        }
      }
    }

    return NextResponse.json({
      analysis: completion || 'No response from agent.',
      sessionId: response.sessionId,
      traces,
    });
  } catch (err: any) {
    console.error('[network-analysis] Error:', err);
    
    // Handle specific Bedrock errors
    if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
      return NextResponse.json(
        { error: 'Agent request timed out. The query may be too complex. Try a simpler query or select a specific node.' },
        { status: 504 }
      );
    }
    
    if (err.message?.includes('Bedrock') || err.message?.includes('model')) {
      return NextResponse.json(
        { error: 'Bedrock service error. Please try again in a moment.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Network analysis failed' },
      { status: 500 }
    );
  }
}
