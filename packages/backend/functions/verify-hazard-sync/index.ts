import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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
    const request: VerifyRequest = JSON.parse(event.body || '{}');
    const { hazardId, hazardType, lat, lon, confidence, timestamp, geohash } = request;
    const sessionId = `verify-${hazardId.replace(/#/g, '-')}-${Date.now()}`;

    // Store hazard as unverified immediately
    await dynamodb.send(
      new PutCommand({
        TableName: process.env.HAZARDS_TABLE_NAME!,
        Item: {
          hazardId,
          geohash,
          hazardType,
          lat,
          lon,
          confidence,
          timestamp,
          status: 'unverified',
          verificationAttemptedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        },
      })
    );

    // Log telemetry submission to traces
    await dynamodb.send(
      new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId: `telemetry-${sessionId}`,
          hazardId,
          type: 'telemetry_submission',
          message: `📤 Received hazard telemetry: ${hazardType} at ${lat.toFixed(4)},${lon.toFixed(4)} (confidence: ${(confidence * 100).toFixed(1)}%)`,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      })
    );

    // Simulation mode with realistic agent reasoning
    if (AGENT_ID === 'placeholder' || AGENT_ALIAS_ID === 'placeholder') {
      const similarCount = Math.floor(Math.random() * 5) + 3;
      const score = confidence >= 0.6 ? Math.floor(70 + Math.random() * 25) : Math.floor(40 + Math.random() * 30);
      
      const steps = [
        {
          thought: `Analyzing ${hazardType} detection at coordinates ${lat.toFixed(4)}, ${lon.toFixed(4)}. Initial confidence is ${(confidence * 100).toFixed(1)}%. Need to query historical data to validate spatial clustering.`,
          action: 'queryHazards',
          actionInput: { geohash, radius: '500m' },
          observation: `Found ${similarCount} similar hazard reports in the vicinity within the last 30 days`,
        },
        {
          thought: `With ${similarCount} similar reports and ${(confidence * 100).toFixed(1)}% ML confidence, this appears to be a legitimate hazard. Calculating composite verification score based on spatial correlation (${similarCount} reports), temporal consistency, and ML confidence.`,
          action: 'calculateScore',
          actionInput: { confidence, similarReports: similarCount },
          observation: `Verification score: ${score}/100 (spatial: ${Math.floor(score * 0.35)}, confidence: ${Math.floor(score * 0.40)}, temporal: ${Math.floor(score * 0.25)})`,
        },
      ];
      
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId: `sim-${sessionId}`,
          steps,
          verificationScore: score,
          reasoning: `Verified ${hazardType} with score ${score}/100. High spatial correlation with ${similarCount} similar reports and strong ML confidence of ${(confidence * 100).toFixed(1)}%.`,
        }),
      };
    }

    // Real Bedrock Agent
    const prompt = `New hazard detected:
- Type: ${hazardType}
- Location: ${lat}, ${lon} (geohash: ${geohash})
- Confidence: ${confidence}
- Timestamp: ${timestamp}

Verify this hazard and return your reasoning with a verification score (0-100).`;

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

    for await (const event of agentResponse.completion) {
      const trace = event.trace?.trace || event.trace;
      const orch = trace?.orchestrationTrace;
      
      if (orch?.modelInvocationOutput?.rawResponse?.content) {
        try {
          const parsed = JSON.parse(orch.modelInvocationOutput.rawResponse.content);
          const messageContent = parsed.output?.message?.content || [];
          
          let thought = '';
          let action = '';
          let actionInput = {};
          
          for (const item of messageContent) {
            if (item.text) {
              const thinkMatch = item.text.match(/<thinking>(.*?)<\/thinking>/s);
              if (thinkMatch) {
                // Extract full reasoning, not just first line
                const lines = thinkMatch[1].trim().split('\n')
                  .map((l: string) => l.trim())
                  .filter((l: string) => l && !l.match(/^\(\d+\)$/))
                  .map((l: string) => l.replace(/^\(\d+\)\s*/, ''));
                
                thought = lines.slice(0, 3).join(' ').substring(0, 200);
              }
            }
            if (item.toolUse) {
              action = item.toolUse.name.replace('GET__QueryAndVerify__', '');
              actionInput = item.toolUse.input || {};
            }
          }
          
          if (action) {
            steps.push({
              thought: thought || `Executing ${action}`,
              action,
              actionInput,
              observation: '',
            });
          }
        } catch (e) {}
      }
      
      // Parse observation to meaningful text
      if (orch?.observation?.actionGroupInvocationOutput?.text && steps.length > 0) {
        const obsText = orch.observation.actionGroupInvocationOutput.text;
        let meaningfulObs = obsText;
        
        try {
          const obsJson = JSON.parse(obsText);
          
          if (steps[steps.length - 1].action === 'queryHazards') {
            const count = obsJson.count || obsJson.hazards?.length || 0;
            meaningfulObs = `Found ${count} similar hazard${count !== 1 ? 's' : ''} in the area`;
          } else if (steps[steps.length - 1].action === 'calculateScore') {
            const score = obsJson.verificationScore || 0;
            const breakdown = obsJson.breakdown || {};
            meaningfulObs = `Verification score: ${score}/100 (spatial: ${breakdown.countScore || 0}, confidence: ${breakdown.confidenceScore || 0}, temporal: ${breakdown.temporalScore || 0})`;
          } else {
            meaningfulObs = obsText.substring(0, 150);
          }
        } catch (e) {
          meaningfulObs = obsText.substring(0, 150);
        }
        
        steps[steps.length - 1].observation = meaningfulObs;
      }

      if (event.chunk) {
        completion += new TextDecoder().decode(event.chunk.bytes);
      }
    }

    const scoreMatch = completion.match(/verification[_\s]?score[:\s]+(\d+)/i);
    const verificationScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    await dynamodb.send(
      new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId: sessionId,
          hazardId,
          reasoning: completion,
          verificationScore,
          steps,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      })
    );

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId: sessionId, steps, verificationScore, reasoning: completion }),
    };
  } catch (error) {
    console.error('[VerifyHazardSync] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Verification failed' }),
    };
  }
};
