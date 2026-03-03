import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, diffContext } = await req.json();

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    if (!agentId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_BEDROCK_AGENT_ID is not set.' },
        { status: 503 }
      );
    }
    if (!agentAliasId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID is not configured — set your alias ID in .env.local.' },
        { status: 503 }
      );
    }

    // Create client per-request so env vars are always available
    const client = new BedrockAgentRuntimeClient({ region });

    // Build prompt with diff context prepended
    let inputText = query;
    if (diffContext) {
      inputText = [
        `[Infrastructure Diff Context]`,
        `Sessions: "${diffContext.sessionA}" vs "${diffContext.sessionB}"`,
        `Time span: ${diffContext.timeSpanDays?.toFixed(1) ?? 'N/A'} days`,
        `New hazards: ${diffContext.totalNew ?? 0}`,
        `Fixed hazards: ${diffContext.totalFixed ?? 0}`,
        `Worsened hazards: ${diffContext.totalWorsened ?? 0}`,
        `Degradation score: ${diffContext.degradationScore?.toFixed(1) ?? 'N/A'}/100`,
        `[User Question]`,
        query,
      ].join('\n');
    }

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId ?? `diff-chat-${Date.now()}`,
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
      content: completion || 'No response from agent.',
      sessionId: response.sessionId,
    });
  } catch (err: any) {
    // Surface the real AWS / network error name + message to the UI
    const name = err?.name ?? 'Error';
    const message = err?.message ?? 'Agent invocation failed.';
    console.error(`[agent/chat] ${name}:`, message);
    return NextResponse.json(
      { error: `${name}: ${message}` },
      { status: 500 }
    );
  }
}

