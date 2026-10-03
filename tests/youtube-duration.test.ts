import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTwoToThreeMinuteDuration, fetchYouTubeDuration, parseIsoDuration, parseVideoListDuration, youtubeDurationEvidence } from '../src/lib/youtube-duration';

const videoId = 'y-FgiJwzyMM';

test('YouTube ISO 8601 durations parse without guessing malformed or live values', () => {
  assert.equal(parseIsoDuration('PT1M52S'), 112);
  assert.equal(parseIsoDuration('PT2M'), 120);
  assert.equal(parseIsoDuration('PT3M'), 180);
  assert.equal(parseIsoDuration('P1DT2H3M4S'), 93_784);
  assert.equal(parseIsoDuration('P1D'), 86_400);
  for (const value of ['PT', 'P', '1:52', 'PT1.5M', 'PT-2M', 'PT0S', null]) {
    assert.equal(parseIsoDuration(value), undefined, String(value));
  }
  assert.equal(parseVideoListDuration({ items: [{ id: 'otherVideo1', contentDetails: { duration: 'PT2M' } }] }, videoId), undefined);
  assert.equal(parseVideoListDuration({ items: [{ id: videoId, contentDetails: { duration: 'PT1M52S' } }] }, videoId), 112);
});

test('out-of-range durations block; boundary uncertainty is explained without claiming a pass', () => {
  assert.equal(assessTwoToThreeMinuteDuration(112), 'too-short');
  assert.equal(assessTwoToThreeMinuteDuration(185), 'too-long');
  assert.equal(assessTwoToThreeMinuteDuration(145), 'in-range');
  for (const second of [119, 120, 180, 181]) assert.equal(assessTwoToThreeMinuteDuration(second), 'near-limit');
  assert.equal(youtubeDurationEvidence(112).status, 'blocked');
  assert.match(youtubeDurationEvidence(112).detail, /01:52.*02:00–03:00/);
  assert.equal(youtubeDurationEvidence(150).status, 'review');
  assert.match(youtubeDurationEvidence(150).detail, /Confirm.*logged out/);
  assert.equal(youtubeDurationEvidence(119).status, 'blocked');
  assert.equal(youtubeDurationEvidence(120).status, 'review');
  assert.equal(youtubeDurationEvidence(181).status, 'blocked');
  assert.doesNotMatch(youtubeDurationEvidence(150).detail, /verified|plays successfully/i);
});

test('duration request is fixed to the official API, bounded, and fails closed to unknown', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, 'https://www.googleapis.com/youtube/v3/videos');
    assert.equal(url.searchParams.get('part'), 'contentDetails');
    assert.equal(url.searchParams.get('id'), videoId);
    assert.equal(url.searchParams.get('key'), 'test-key');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    return Response.json({ items: [{ id: videoId, contentDetails: { duration: 'PT1M52S' } }] });
  };
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', fetcher), 112);
  assert.equal(calls, 1);
  assert.equal(await fetchYouTubeDuration(videoId, undefined, fetcher), undefined);
  assert.equal(await fetchYouTubeDuration('bad-id', 'test-key', fetcher), undefined);
  assert.equal(calls, 1);

  const oversized: typeof fetch = async () => new Response('x'.repeat(16_385));
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', oversized), undefined);
  const unavailable: typeof fetch = async () => new Response('{}', { status: 403 });
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', unavailable), undefined);
  const malformed: typeof fetch = async () => new Response('not JSON');
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', malformed), undefined);
  const invalidPayload: typeof fetch = async () => Response.json({ items: [{ id: videoId, contentDetails: { duration: 'not ISO 8601' } }] });
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', invalidPayload), undefined);
  const wrongVideo: typeof fetch = async () => Response.json({ items: [{ id: 'otherVideo1', contentDetails: { duration: 'PT2M30S' } }] });
  assert.equal(await fetchYouTubeDuration(videoId, 'test-key', wrongVideo), undefined);
});
