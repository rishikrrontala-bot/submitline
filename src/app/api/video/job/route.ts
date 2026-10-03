import { NextResponse } from 'next/server';
import { readDescriptionJob } from '@/lib/deapi';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get('requestId') || '';
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(requestId)) return NextResponse.json({ error: 'Invalid video job ID.' }, { status: 400 });
  const apiKey = process.env.DEAPI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Video analysis is not configured on this server.' }, { status: 503 });
  try {
    const job = await readDescriptionJob(requestId, apiKey);
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read the video job.' }, { status: 502 });
  }
}
