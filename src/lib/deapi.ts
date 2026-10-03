import type { VideoJob } from './types';
import { normalizeJobState, parseVideoObservations } from './video';

const apiBase = 'https://api.deapi.ai/api/v2';

function providerError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const inner = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record;
    const message = inner.error_reason ?? inner.message ?? inner.error ?? record.message;
    if (typeof message === 'string' && message.trim()) return message.slice(0, 500);
  }
  return fallback;
}

export async function startDescription(
  videoUrl: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const form = new FormData();
  form.set('video_url', videoUrl);
  form.set('model', 'Marlin_2B');
  form.set('preset', 'balanced');
  form.set('include_metadata', 'true');
  form.set('return_result_in_response', 'true');
  const response = await fetcher(apiBase + '/videos/descriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    body: form,
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError(payload, 'deAPI rejected the video request (HTTP ' + response.status + ').'));
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : undefined;
  const requestId = data && typeof data === 'object' ? (data as Record<string, unknown>).request_id : undefined;
  if (typeof requestId !== 'string' || !requestId) throw new Error('deAPI did not return a request ID.');
  return requestId;
}

export async function readDescriptionJob(
  requestId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<VideoJob> {
  const response = await fetcher(apiBase + '/jobs/' + encodeURIComponent(requestId), {
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError(payload, 'Could not read the deAPI job (HTTP ' + response.status + ').'));
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : undefined;
  if (!data || typeof data !== 'object') throw new Error('deAPI returned an unreadable job.');
  const job = data as Record<string, unknown>;
  const state = normalizeJobState(job.status ?? job.state);
  if (state === 'unknown') throw new Error('deAPI returned an undocumented job state.');
  const parsed = parseVideoObservations(job.result);
  return {
    requestId, state, observations: parsed.observations, duration: parsed.duration,
    error: state === 'error' ? providerError(payload, 'deAPI could not analyze this video.') : undefined,
  };
}
