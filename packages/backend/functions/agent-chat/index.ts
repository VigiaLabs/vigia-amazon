import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const bedrockAgent = new BedrockAgentRuntimeClient({});

const AGENT_ID = process.env.BEDROCK_AGENT_ID!;
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { query, sessionId } = JSON.parse(event.body || '{}');

    if (!query) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Query is required' }),
      };
    }

    const command = new InvokeAgentCommand({
      agentId: AGENT_ID,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId: sessionId ?? `chat-${Date.now()}`,
      inputText: query,
      enableTrace: true,
    });

    const response = await bedrockAgent.send(command);

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
          if (rationale) {
            thinkingSteps.push(rationale);
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: completion || 'No response from agent.',
        sessionId: response.sessionId,
        traces,
        thinking: thinkingSteps,
      }),
    };
  } catch (error: any) {
    console.error('[AgentChat] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Agent invocation failed' }),
    };
  }
};
