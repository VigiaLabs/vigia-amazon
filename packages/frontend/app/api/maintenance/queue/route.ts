import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const apiUrl = process.env.NEXT_PUBLIC_INNOVATION_API_URL || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
    
    const response = await fetch(`${apiUrl}/maintenance/queue?${searchParams.toString()}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
