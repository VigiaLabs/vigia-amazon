import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { start, end, constraints, query, context } = body;

    // If query is provided (natural language), use it directly
    // Otherwise, require start/end coordinates
    if (!query && (!start || !end || !start.lat || !end.lat)) {
      return NextResponse.json(
        { error: 'Either query or start/end coordinates required' },
        { status: 400 }
      );
    }

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

    // Use custom query or construct from parameters
    let inputText;
    if (query) {
      inputText = query;
    } else {
      const avoidTypes = constraints?.avoidHazardTypes?.join(', ') || 'none';
      inputText = `Find an optimal road path from coordinates (${start.lat}, ${start.lon}) to (${end.lat}, ${end.lon}), avoiding these hazard types: ${avoidTypes}. Use find_optimal_path to get the waypoints and hazards avoided. Then use calculate_construction_roi to analyze if building a new road would be cost-effective.`;
    }

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: `urban-planning-${Date.now()}`,
      inputText,
    });

    const response = await client.send(command);

    let completion = '';
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          completion += new TextDecoder().decode(event.chunk.bytes);
        }
      }
    }

    return NextResponse.json({
      analysis: completion || 'No response from agent.',
      sessionId: response.sessionId,
    });
  } catch (err: any) {
    console.error('[urban-planning] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Urban planning analysis failed' },
      { status: 500 }
    );
  }
}
