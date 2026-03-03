import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface DiffAnalysisRequest {
  diffMap: any;
  userQuery?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export const handler = async (event: any) => {
  const body: DiffAnalysisRequest = JSON.parse(event.body || '{}');
  const { diffMap, userQuery, conversationHistory = [] } = body;

  // Build context from diff data
  const context = buildDiffContext(diffMap);
  
  // Build prompt
  const prompt = userQuery 
    ? `${context}\n\nUser Question: ${userQuery}`
    : `${context}\n\nProvide a comprehensive analysis of the road infrastructure changes between these two sessions. Include:\n1. Overall degradation assessment\n2. Key areas of concern\n3. Specific recommendations for maintenance\n4. Confidence level in your analysis`;

  try {
    // Use Amazon Nova Lite for cost efficiency
    const command = new InvokeAgentCommand({
      agentId: process.env.AGENT_ID!,
      agentAliasId: process.env.AGENT_ALIAS_ID!,
      sessionId: diffMap.diffId,
      inputText: prompt,
      enableTrace: true,
    });

    const response = await client.send(command);
    
    // Extract response text
    let responseText = '';
    let traces: any[] = [];
    
    if (response.completion) {
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          const text = new TextDecoder().decode(chunk.chunk.bytes);
          responseText += text;
        }
        if (chunk.trace) {
          traces.push(chunk.trace);
        }
      }
    }

    // Parse response into structured format
    const analysis = parseAnalysisResponse(responseText, diffMap);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        analysis,
        traces,
        conversationId: diffMap.diffId,
      }),
    };
  } catch (error) {
    console.error('Agent invocation failed:', error);
    
    // Fallback to rule-based analysis
    const fallbackAnalysis = generateFallbackAnalysis(diffMap);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        analysis: fallbackAnalysis,
        traces: [],
        conversationId: diffMap.diffId,
        fallback: true,
      }),
    };
  }
};

function buildDiffContext(diffMap: any): string {
  const { sessionA, sessionB, changes, summary } = diffMap;
  
  return `
ROAD INFRASTRUCTURE COMPARISON ANALYSIS

Session A: ${sessionA.displayName}
- Timestamp: ${new Date(sessionA.timestamp).toLocaleString()}
- Location: ${sessionA.location?.city}, ${sessionA.location?.state}, ${sessionA.location?.country}

Session B: ${sessionB.displayName}
- Timestamp: ${new Date(sessionB.timestamp).toLocaleString()}
- Location: ${sessionB.location?.city}, ${sessionB.location?.state}, ${sessionB.location?.country}

Time Span: ${summary.timeSpanDays.toFixed(1)} days

CHANGES DETECTED:
- New Hazards: ${summary.totalNew}
  ${changes.newHazards.slice(0, 5).map((h: any) => `  • ${h.type} (Severity: ${h.severity}) at ${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`).join('\n')}
  ${summary.totalNew > 5 ? `  ... and ${summary.totalNew - 5} more` : ''}

- Fixed Hazards: ${summary.totalFixed}
  ${changes.fixedHazards.slice(0, 5).map((h: any) => `  • ${h.type} (Was: ${h.severity}) at ${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`).join('\n')}
  ${summary.totalFixed > 5 ? `  ... and ${summary.totalFixed - 5} more` : ''}

- Worsened Hazards: ${summary.totalWorsened}
  ${changes.worsenedHazards.slice(0, 5).map((h: any) => `  • ${h.type} (${h.oldSeverity} → ${h.newSeverity}) at ${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`).join('\n')}
  ${summary.totalWorsened > 5 ? `  ... and ${summary.totalWorsened - 5} more` : ''}

- Unchanged Hazards: ${summary.totalUnchanged}

SUMMARY STATISTICS:
- Net Change: ${summary.netChange > 0 ? '+' : ''}${summary.netChange}
- Degradation Score: ${summary.degradationScore.toFixed(1)}/100
`;
}

function parseAnalysisResponse(responseText: string, diffMap: any): any {
  // Extract key sections from response
  const lines = responseText.split('\n');
  let summary = '';
  let degradationAssessment = '';
  let recommendations: string[] = [];
  
  let currentSection = 'summary';
  
  for (const line of lines) {
    if (line.toLowerCase().includes('degradation') || line.toLowerCase().includes('assessment')) {
      currentSection = 'degradation';
    } else if (line.toLowerCase().includes('recommendation') || line.toLowerCase().includes('action')) {
      currentSection = 'recommendations';
    } else if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().match(/^\d+\./)) {
      if (currentSection === 'recommendations') {
        recommendations.push(line.trim().replace(/^[-•\d.]\s*/, ''));
      }
    } else if (line.trim()) {
      if (currentSection === 'summary') {
        summary += line + ' ';
      } else if (currentSection === 'degradation') {
        degradationAssessment += line + ' ';
      }
    }
  }

  return {
    traceId: `trace-${Date.now()}`,
    summary: summary.trim() || responseText.substring(0, 200),
    degradationAssessment: degradationAssessment.trim() || 'Analysis in progress',
    recommendations: recommendations.length > 0 ? recommendations : ['Monitor high-severity areas', 'Schedule maintenance inspection'],
    confidence: 0.85,
    analyzedAt: Date.now(),
  };
}

function generateFallbackAnalysis(diffMap: any): any {
  const { summary, changes } = diffMap;
  
  let degradationLevel = 'moderate';
  let degradationText = '';
  
  if (summary.degradationScore > 70) {
    degradationLevel = 'severe';
    degradationText = 'The road infrastructure has experienced severe degradation';
  } else if (summary.degradationScore > 50) {
    degradationLevel = 'significant';
    degradationText = 'The road infrastructure shows significant deterioration';
  } else if (summary.degradationScore > 30) {
    degradationLevel = 'moderate';
    degradationText = 'The road infrastructure has moderate changes';
  } else {
    degradationLevel = 'minimal';
    degradationText = 'The road infrastructure shows minimal degradation';
  }

  const recommendations = [];
  
  if (summary.totalNew > 10) {
    recommendations.push('Immediate inspection required for newly identified hazards');
  }
  if (summary.totalWorsened > 5) {
    recommendations.push('Prioritize repair of worsening hazards to prevent further deterioration');
  }
  if (summary.degradationScore > 60) {
    recommendations.push('Allocate emergency maintenance budget for critical areas');
  }
  if (summary.totalFixed > 0) {
    recommendations.push(`Continue maintenance efforts - ${summary.totalFixed} hazards successfully addressed`);
  }

  return {
    traceId: `fallback-${Date.now()}`,
    summary: `${degradationText} over ${summary.timeSpanDays.toFixed(1)} days. ${summary.totalNew} new hazards detected, ${summary.totalFixed} hazards fixed, and ${summary.totalWorsened} hazards worsened. Net change: ${summary.netChange > 0 ? '+' : ''}${summary.netChange} hazards.`,
    degradationAssessment: `Degradation Level: ${degradationLevel.toUpperCase()} (Score: ${summary.degradationScore.toFixed(1)}/100). ${summary.netChange > 0 ? 'Infrastructure quality is declining' : 'Infrastructure quality is stable or improving'}.`,
    recommendations: recommendations.length > 0 ? recommendations : ['Continue regular monitoring', 'Schedule routine maintenance'],
    confidence: 0.75,
    analyzedAt: Date.now(),
  };
}
