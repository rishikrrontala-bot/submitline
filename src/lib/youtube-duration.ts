import { formatTimestamp } from './video';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_RESPONSE_BYTES = 16_384;

export type DurationAssessment = 'too-short' | 'too-long' | 'near-limit' | 'in-range' | 'unknown';

export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!match || match.slice(1).every((part) => part === undefined)) return undefined;
  const seconds = Number(match[1] || 0) * 86_400 + Number(match[2] || 0) * 3_600
    + Number(match[3] || 0) * 60 + Number(match[4] || 0);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

export function parseVideoListDuration(payload: unknown, expectedId: string): number | undefined {
  if (!payload || typeof payload !== 'object' || !VIDEO_ID.test(expectedId)) return undefined;
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return undefined;
  const video = items.find((item): item is { id: string; contentDetails?: { duration?: unknown } } =>
    Boolean(item && typeof item === 'object' && (item as { id?: unknown }).id === expectedId));
  return parseIsoDuration(video?.contentDetails?.duration);
}

// The Data API says duration can differ slightly from playback (for example, by one second):
// https://developers.google.com/youtube/v3/docs/videos#contentDetails.duration
// Values within one second of either rule boundary need a human check.
export function assessTwoToThreeMinuteDuration(seconds: number): DurationAssessment {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return 'unknown';
  if (seconds < 119) return 'too-short';
  if (seconds > 181) return 'too-long';
  if (seconds <= 120 || seconds >= 180) return 'near-limit';
  return 'in-range';
}

export function youtubeDurationEvidence(seconds: number): {
  status: 'blocked' | 'review'; label: string; detail: string; observation: string;
} {
  const assessment = assessTwoToThreeMinuteDuration(seconds);
  const time = formatTimestamp(seconds);
  const observation = 'YouTube Data API contentDetails.duration reports ' + time + '.';
  if (assessment === 'too-short' || assessment === 'too-long') return {
    status: 'blocked', label: assessment === 'too-short' ? 'Video below two minutes' : 'Video above three minutes',
    detail: 'YouTube Data API reports ' + time + '. LovHack requires 02:00–03:00; replace or edit the video and recheck.',
    observation,
  };
  if (assessment === 'near-limit') return {
    status: seconds < 120 || seconds > 180 ? 'blocked' : 'review',
    label: seconds < 120 || seconds > 180 ? 'Video just outside duration limit' : 'Video near duration limit',
    detail: 'YouTube Data API reports ' + time + ', close to LovHack’s 02:00–03:00 boundary. API duration can differ slightly from playback; inspect the original video while logged out and adjust its length if needed.',
    observation,
  };
  if (assessment === 'in-range') return {
    status: 'review', label: 'Length in range; playback needs review',
    detail: 'YouTube Data API reports ' + time + ', within LovHack’s 02:00–03:00 window. Confirm the video plays and shows the right demo while logged out.',
    observation,
  };
  return {
    status: 'review', label: 'Video duration unverified',
    detail: 'The reported duration could not be interpreted. Confirm the 2–3 minute length and playback while logged out.',
    observation: 'YouTube Data API duration was unreadable.',
  };
}

async function readSmallJson(response: Response): Promise<unknown> {
  const declaredSize = response.headers.get('content-length');
  if (declaredSize && Number(declaredSize) > MAX_RESPONSE_BYTES) return undefined;
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return undefined; }
}

export async function fetchYouTubeDuration(
  videoId: string,
  apiKey: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<number | undefined> {
  if (!VIDEO_ID.test(videoId) || !apiKey?.trim() || apiKey.length > 256) return undefined;
  const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
  endpoint.searchParams.set('part', 'contentDetails');
  endpoint.searchParams.set('id', videoId);
  endpoint.searchParams.set('key', apiKey.trim());
  try {
    const response = await fetcher(endpoint, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return undefined;
    return parseVideoListDuration(await readSmallJson(response), videoId);
  } catch {
    return undefined;
  }
}
