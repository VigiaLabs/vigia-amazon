import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const { hazardIds } = await req.json();

    if (!hazardIds || !Array.isArray(hazardIds) || hazardIds.length === 0) {
      return NextResponse.json(
        { error: 'hazardIds array required' },
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

    const inputText = `Prioritize these hazards for repair: ${hazardIds.join(', ')}. Use the prioritize_repair_queue tool to rank them by severity, traffic density, and age. Then use estimate_repair_cost to calculate the total budget required.`;

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: `maintenance-priority-${Date.now()}`,
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
    console.error('[maintenance-priority] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Maintenance priority analysis failed' },
      { status: 500 }
    );
  }
}
