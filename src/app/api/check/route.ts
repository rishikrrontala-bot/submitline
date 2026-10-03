import { NextResponse } from 'next/server';
import { checkLink } from '@/lib/link-check';
import type { CheckKind } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Enter a link to check.' }, { status: 400 });
  const data = input as Record<string, unknown>;
  const kind = data.kind;
  const url = data.url;
  if (!['live', 'repo', 'video'].includes(String(kind)) || typeof url !== 'string' || url.length > 2048) {
    return NextResponse.json({ error: 'Enter a valid check type and URL.' }, { status: 400 });
  }
  const result = await checkLink(kind as CheckKind, url);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
