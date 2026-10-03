import http from 'node:http';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import type { CheckKind, CheckResult, EvidenceStatus } from './types';
import { parsePublicUrl, resolvePublicAddress, UnsafeTargetError } from './url-safety';

interface HttpObservation { status: number; headers: IncomingHttpHeaders; body: string; finalUrl: string }

function requestOnce(url: URL, method: 'HEAD' | 'GET', address: string, family: 4 | 6): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method, timeout: 9_000, family, ...{ autoSelectFamily: false },
      headers: { 'User-Agent': 'Submitline/1.0 (+https://lovhack-season-3.devpost.com/)', Accept: 'text/html,application/json;q=0.9,*/*;q=0.5' },
      lookup: (_host, _options, callback) => callback(null, address, family),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 64_000) chunks.push(chunk);
        else response.destroy();
      });
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', (error) => {
        if (size > 64_000) resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') });
        else reject(error);
      });
    });
    request.on('timeout', () => request.destroy(new Error('The host did not respond in time.')));
    request.on('error', reject);
    request.end();
  });
}

async function fetchPublicHeaders(input: string, method: 'HEAD' | 'GET' = 'HEAD'): Promise<HttpObservation> {
  let url = parsePublicUrl(input);
  for (let hop = 0; hop <= 4; hop += 1) {
    const { address, family } = await resolvePublicAddress(url);
    const result = await requestOnce(url, method, address, family);
    if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
      if (hop === 4) throw new Error('The link redirects too many times.');
      url = parsePublicUrl(new URL(result.headers.location, url).toString());
      continue;
    }
    if (method === 'HEAD' && [403, 405, 501].includes(result.status)) return fetchPublicHeaders(url.toString(), 'GET');
    return { ...result, finalUrl: url.toString() };
  }
  throw new Error('The link redirects too many times.');
}

export function classifyHttpStatus(status: number, finalUrl = ''): { status: EvidenceStatus; label: string; detail: string } {
  if (status >= 200 && status < 300) {
    if (/\/(?:login|signin|sign-in)(?:[/?#]|$)/i.test(finalUrl)) return { status: 'blocked', label: 'Login gate detected', detail: 'The link redirects to a sign-in page.' };
    return { status: 'verified', label: 'Reachable without credentials', detail: 'The server returned HTTP ' + status + ' to an unauthenticated request. This does not prove the app works in a browser.' };
  }
  if (status === 401) return { status: 'blocked', label: 'Sign-in required', detail: 'The server returned HTTP 401 to an unauthenticated request.' };
  if (status === 403 || status === 429) return { status: 'review', label: 'Browser review needed', detail: 'The host returned HTTP ' + status + '; it may block automated requests. Open it while logged out.' };
  if (status === 404 || status === 410) return { status: 'blocked', label: 'Link unavailable', detail: 'The server returned HTTP ' + status + '.' };
  if (status >= 500) return { status: 'blocked', label: 'Server error', detail: 'The server returned HTTP ' + status + '.' };
  return { status: 'review', label: 'Response needs review', detail: 'The server returned HTTP ' + status + '. Check the link in a logged-out browser.' };
}

function makeResult(kind: CheckKind, inputUrl: string, result: Partial<CheckResult> & Pick<CheckResult, 'status' | 'label' | 'detail'>): CheckResult {
  return { kind, inputUrl, checkedAt: new Date().toISOString(), observation: result.observation || result.detail, ...result };
}

export async function checkLink(kind: CheckKind, inputUrl: string): Promise<CheckResult> {
  try {
    const url = parsePublicUrl(inputUrl.trim());
    if (kind === 'video' && ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase())) {
      const oembedUrl = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url.toString()) + '&format=json';
      const result = await fetchPublicHeaders(oembedUrl, 'GET');
      if (result.status === 200) {
        let metadata: { title?: string; author_name?: string } = {};
        try { metadata = JSON.parse(result.body); } catch { /* unreadable metadata remains review */ }
        if (metadata.title) return makeResult(kind, inputUrl, {
          status: 'review', label: 'Video metadata available',
          detail: 'YouTube returned the title “' + metadata.title.slice(0, 120) + '” without authentication. Confirm playback and 2–3 minute length while logged out.',
          observation: 'Unauthenticated YouTube oEmbed metadata returned a video title.',
          finalUrl: url.toString(), httpStatus: 200, title: metadata.title.slice(0, 120),
        });
        return makeResult(kind, inputUrl, { status: 'review', label: 'Video metadata unclear', detail: 'YouTube replied, but its video metadata was unreadable.', httpStatus: 200 });
      }
      const classified = classifyHttpStatus(result.status, result.finalUrl);
      return makeResult(kind, inputUrl, { ...classified, status: classified.status === 'verified' ? 'review' : classified.status, httpStatus: result.status, finalUrl: url.toString() });
    }
    if (kind === 'repo' && url.hostname.toLowerCase() === 'github.com') {
      const path = url.pathname.split('/').filter(Boolean);
      if (path.length < 2) return makeResult(kind, inputUrl, { status: 'blocked', label: 'Repository path missing', detail: 'Enter a GitHub owner and repository name.' });
      const apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(path[0]) + '/' + encodeURIComponent(path[1].replace(/\.git$/, ''));
      const result = await fetchPublicHeaders(apiUrl, 'GET');
      if (result.status === 200) {
        let metadata: { private?: boolean; html_url?: string; full_name?: string } = {};
        try { metadata = JSON.parse(result.body); } catch { /* malformed API response remains review */ }
        if (metadata.private === false && metadata.full_name) return makeResult(kind, inputUrl, {
          status: 'verified', label: 'Repository public', detail: "GitHub's unauthenticated API reports " + metadata.full_name + ' as public.',
          observation: 'Public repository metadata returned by GitHub without authentication.', finalUrl: metadata.html_url || url.toString(), httpStatus: 200,
        });
        return makeResult(kind, inputUrl, { status: 'review', label: 'Repository visibility unclear', detail: 'GitHub replied, but its public visibility field could not be confirmed.', httpStatus: 200 });
      }
      const classified = classifyHttpStatus(result.status, result.finalUrl);
      return makeResult(kind, inputUrl, { ...classified, httpStatus: result.status, finalUrl: result.finalUrl });
    }
    const response = await fetchPublicHeaders(url.toString());
    const classified = classifyHttpStatus(response.status, response.finalUrl);
    if (kind === 'repo' && classified.status === 'verified') {
      return makeResult(kind, inputUrl, { status: 'review', label: 'Repository visibility needs review', detail: 'The host returned HTTP ' + response.status + ', but this does not prove the repository is public.', finalUrl: response.finalUrl, httpStatus: response.status });
    }
    if (kind === 'video') {
      return makeResult(kind, inputUrl, { status: classified.status === 'verified' ? 'review' : classified.status, label: classified.status === 'verified' ? 'Video page reachable' : classified.label, detail: classified.status === 'verified' ? 'The video page returned HTTP ' + response.status + '; confirm playback in a logged-out browser.' : classified.detail, finalUrl: response.finalUrl, httpStatus: response.status });
    }
    return makeResult(kind, inputUrl, { ...classified, finalUrl: response.finalUrl, httpStatus: response.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The link could not be checked.';
    const unsafe = error instanceof UnsafeTargetError;
    const missing = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(detail);
    return makeResult(kind, inputUrl, {
      status: unsafe || missing ? 'blocked' : 'review',
      label: unsafe ? 'Unsafe link rejected' : missing ? 'Host unavailable' : 'Check could not complete',
      detail: unsafe ? detail : detail + ' Try again or inspect it while logged out.',
    });
  }
}
