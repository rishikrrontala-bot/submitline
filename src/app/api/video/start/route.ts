import { NextResponse } from 'next/server';
import { startDescription } from '@/lib/deapi';
import { supportedVideoUrl } from '@/lib/video';
import { parsePublicUrl } from '@/lib/url-safety';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Enter a video URL.' }, { status: 400 });
  const data = input as Record<string, unknown>;
  if (data.consent !== true) return NextResponse.json({ error: 'Confirm that deAPI will process the public video URL before analysis.' }, { status: 400 });
  if (typeof data.url !== 'string' || data.url.length > 2048 || !supportedVideoUrl(data.url)) {
    return NextResponse.json({ error: 'Use a public HTTPS video URL from YouTube, X, Twitch, Kick, or TikTok.' }, { status: 400 });
  }
  try { parsePublicUrl(data.url); }
  catch { return NextResponse.json({ error: 'The video URL contains unsafe or unsupported address details.' }, { status: 400 }); }
  const apiKey = process.env.DEAPI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Video analysis is not configured on this server. Link checks and manual review remain available.' }, { status: 503 });
  try {
    const requestId = await startDescription(data.url, apiKey);
    return NextResponse.json({ requestId, state: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'deAPI could not start analysis.' }, { status: 502 });
  }
}
