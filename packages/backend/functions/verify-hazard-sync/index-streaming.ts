import type { APIGatewayProxyEvent } from 'aws-lambda';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const bedrockAgent = new BedrockAgentRuntimeClient({});
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const TRACES_TABLE = process.env.TRACES_TABLE_NAME!;
const AGENT_ID = process.env.BEDROCK_AGENT_ID!;
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID!;

interface VerifyRequest {
  hazardId: string;
  hazardType: string;
  lat: number;
  lon: number;
  confidence: number;
  timestamp: string;
  geohash: string;
}

// Streaming handler for real-time trace events
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream: any): Promise<void> => {
    const write = (data: any) => {
      responseStream.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const request: VerifyRequest = JSON.parse(event.body || '{}');
      const { hazardId, hazardType, lat, lon, confidence, timestamp, geohash } = request;
      const sessionId = `verify-${hazardId.replace(/#/g, '-')}-${Date.now()}`;

      write({ type: 'start', hazardId });

      // Simulated streaming (agent not configured)
      if (AGENT_ID === 'placeholder' || AGENT_ALIAS_ID === 'placeholder') {
        const steps = [
          {
            thought: `Analyzing ${hazardType} at ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            action: 'query_database',
            actionInput: { geohash },
            observation: `Found ${Math.floor(Math.random() * 5) + 1} similar reports`,
          },
          {
            thought: 'Calculating verification score',
            action: 'calculate_score',
            actionInput: { confidence },
            observation: `Score calculated based on ${(confidence * 100).toFixed(1)}% confidence`,
          },
        ];

        for (const step of steps) {
          write({ type: 'step', step });
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        const score = confidence >= 0.6 ? Math.floor(70 + Math.random() * 25) : 50;
        write({ type: 'complete', traceId: sessionId, verificationScore: score });
        responseStream.end();
        return;
      }

      // Real Bedrock streaming
      const prompt = `Verify hazard: ${hazardType} at ${lat},${lon} (confidence: ${confidence})`;
      const agentResponse = await bedrockAgent.send(
        new InvokeAgentCommand({
          agentId: AGENT_ID,
          agentAliasId: AGENT_ALIAS_ID,
          sessionId,
          inputText: prompt,
          enableTrace: true,
        })
      );

      const steps: any[] = [];
      let completion = '';

      for await (const evt of agentResponse.completion) {
        const trace = evt.trace?.trace || evt.trace;
        
        if (trace?.orchestrationTrace?.modelInvocationOutput?.rawResponse?.content) {
          try {
            const parsed = JSON.parse(trace.orchestrationTrace.modelInvocationOutput.rawResponse.content);
            const content = parsed.output?.message?.content || [];
            
            let thought = '';
            let action = '';
            let actionInput = {};
            
            for (const item of content) {
              if (item.text) {
                const match = item.text.match(/<thinking>(.*?)<\/thinking>/s);
                if (match) {
                  thought = match[1].trim().split('\n')[0].replace(/^\(\d+\)\s*/, '').substring(0, 100);
                }
              }
              if (item.toolUse) {
                action = item.toolUse.name.replace('GET__QueryAndVerify__', '');
                actionInput = item.toolUse.input || {};
              }
            }
            
            if (action) {
              const step = { thought: thought || `Executing ${action}`, action, actionInput, observation: '' };
              steps.push(step);
              write({ type: 'step', step });
            }
          } catch (e) {}
        }
        
        if (trace?.orchestrationTrace?.observation?.actionGroupInvocationOutput?.text && steps.length > 0) {
          steps[steps.length - 1].observation = trace.orchestrationTrace.observation.actionGroupInvocationOutput.text.substring(0, 150);
          write({ type: 'step', step: steps[steps.length - 1] });
        }

        if (evt.chunk) {
          completion += new TextDecoder().decode(evt.chunk.bytes);
        }
      }

      const scoreMatch = completion.match(/score[:\s]+(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

      await dynamodb.send(new PutCommand({
        TableName: TRACES_TABLE,
        Item: { traceId: sessionId, hazardId, steps, verificationScore: score, createdAt: new Date().toISOString(), ttl: Math.floor(Date.now() / 1000) + 604800 },
      }));

      write({ type: 'complete', traceId: sessionId, verificationScore: score });
      responseStream.end();
    } catch (error) {
      console.error(error);
      write({ type: 'error', error: 'Failed' });
      responseStream.end();
    }
  }
);
