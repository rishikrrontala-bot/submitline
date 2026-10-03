import type { VideoJob, VideoObservation } from './types';

const supportedHosts = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com',
  'twitch.tv', 'www.twitch.tv', 'kick.com', 'www.kick.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
]);

export function supportedVideoUrl(raw: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  return url.protocol === 'https:' && supportedHosts.has(url.hostname.toLowerCase());
}

export function youtubeId(raw: string): string | undefined {
  let url: URL;
  try { url = new URL(raw); } catch { return undefined; }
  const host = url.hostname.toLowerCase();
  const id = host === 'youtu.be' ? url.pathname.slice(1) :
    ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
      ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] : undefined;
  return url.protocol === 'https:' && id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
}

export function normalizeJobState(value: unknown): VideoJob['state'] | 'unknown' {
  return value === 'pending' || value === 'processing' || value === 'done' || value === 'error' ? value : 'unknown';
}

function seconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }
  return undefined;
}

export function parseVideoObservations(raw: unknown): { observations: VideoObservation[]; duration?: number } {
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { observations: [] }; }
  }
  if (!data || typeof data !== 'object') return { observations: [] };
  const record = data as Record<string, unknown>;
  const events = Array.isArray(record.events) && record.events.length ? record.events : Array.isArray(record.scenes) ? record.scenes : [];
  const observations: VideoObservation[] = events.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const event = item as Record<string, unknown>;
    const start = seconds(event.start ?? event.start_time ?? event.timestamp);
    const end = seconds(event.end ?? event.end_time);
    const description = typeof event.description === 'string' ? event.description.trim().slice(0, 1000) : '';
    if (start === undefined || !description) return [];
    return [{ start, end, description, source: 'deapi' as const }];
  });
  const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {};
  return { observations: observations.slice(0, 100), duration: seconds(meta.duration) };
}

export function formatTimestamp(value: number): string {
  const total = Math.floor(Math.max(0, value));
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

export function observationLabel(observation: VideoObservation): string {
  return 'Visual observation at ' + formatTimestamp(observation.start);
}

export function videoJumpUrl(raw: string, secondsValue: number): string | undefined {
  let url: URL;
  try { url = new URL(raw); } catch { return undefined; }
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'https:' && (youtubeId(raw) || host === 'twitch.tv' || host === 'www.twitch.tv')) {
    url.searchParams.set('t', Math.floor(secondsValue) + 's');
    return url.toString();
  }
  return undefined;
}
