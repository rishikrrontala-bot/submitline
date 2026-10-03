import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp, normalizeJobState, observationLabel, parseVideoObservations, supportedVideoUrl, videoJumpUrl, youtubeId } from '../src/lib/video';

test('only documented deAPI job states are recognized', () => {
  for (const state of ['pending', 'processing', 'done', 'error'] as const) assert.equal(normalizeJobState(state), state);
  assert.equal(normalizeJobState('completed'), 'unknown');
  assert.equal(normalizeJobState('failed'), 'unknown');
});

test('serialized deAPI events become timestamped observations with honest labels', () => {
  const parsed = parseVideoObservations(JSON.stringify({
    events: [{ start: '00:42', end: 50, description: 'The project workspace appears on screen.' }],
    meta: { duration: 145 },
  }));
  assert.equal(parsed.duration, 145);
  assert.equal(parsed.observations.length, 1);
  assert.equal(parsed.observations[0].start, 42);
  assert.equal(observationLabel(parsed.observations[0]), 'Visual observation at 00:42');
  assert.equal(formatTimestamp(145), '02:25');
  assert.doesNotMatch(observationLabel(parsed.observations[0]), /verified|works/i);
});

test('unreadable model output yields no fabricated scenes', () => {
  assert.deepEqual(parseVideoObservations('not json').observations, []);
  assert.deepEqual(parseVideoObservations({ events: [{ start: 1, description: '' }] }).observations, []);
});

test('supported video hosts and YouTube jump links are precise', () => {
  const url = 'https://www.youtube.com/watch?v=y-FgiJwzyMM';
  assert.equal(supportedVideoUrl(url), true);
  assert.equal(supportedVideoUrl('https://evil.youtube.com/watch?v=y-FgiJwzyMM'), false);
  assert.equal(youtubeId(url), 'y-FgiJwzyMM');
  assert.equal(youtubeId('https://evil.youtube.com/watch?v=y-FgiJwzyMM'), undefined);
  assert.equal(youtubeId('http://www.youtube.com/watch?v=y-FgiJwzyMM'), undefined);
  assert.match(videoJumpUrl(url, 42)!, /t=42s/);
  assert.equal(videoJumpUrl('https://evil.youtube.com/watch?v=y-FgiJwzyMM', 42), undefined);
  assert.equal(videoJumpUrl('https://evil.twitch.tv/video/123', 42), undefined);
  assert.equal(videoJumpUrl('https://www.tiktok.com/@someone/video/123', 42), undefined);
});
