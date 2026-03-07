import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { geohash, radiusKm, query, context } = body;

    // Use API Gateway instead of direct Bedrock call
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API URL not configured' },
        { status: 503 }
      );
    }

    // Forward to your Lambda via API Gateway
    const response = await fetch(`${apiUrl}/agent/network-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geohash, radiusKm, query, context }),
    });

    if (!response.ok) {
      throw new Error(`API Gateway error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[network-analysis] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Network analysis failed' },
      { status: 500 }
    );
  }
}
