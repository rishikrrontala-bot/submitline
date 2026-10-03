import test from 'node:test';
import assert from 'node:assert/strict';
import { readDescriptionJob, startDescription } from '../src/lib/deapi';

test('Video Description start sends the documented model and URL in multipart form', async () => {
  let inspected = false;
  const mock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.match(String(input), /\/api\/v2\/videos\/descriptions$/);
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-key');
    const form = init?.body as FormData;
    assert.equal(form.get('model'), 'Marlin_2B');
    assert.equal(form.get('video_url'), 'https://www.youtube.com/watch?v=y-FgiJwzyMM');
    assert.equal(form.get('return_result_in_response'), 'true');
    inspected = true;
    return Response.json({ data: { request_id: 'job_123456' } });
  }) as typeof fetch;
  assert.equal(await startDescription('https://www.youtube.com/watch?v=y-FgiJwzyMM', 'test-key', mock), 'job_123456');
  assert.equal(inspected, true);
});

test('job polling maps done result and preserves visual event timestamp', async () => {
  const mock = (async () => Response.json({
    data: { status: 'done', result: JSON.stringify({ events: [{ start: 42, end: 47, description: 'A dashboard appears.' }], meta: { duration: 130 } }) },
  })) as typeof fetch;
  const job = await readDescriptionJob('job_123456', 'test-key', mock);
  assert.equal(job.state, 'done');
  assert.equal(job.observations[0].start, 42);
  assert.equal(job.duration, 130);
});

test('provider errors remain errors, not successful evidence', async () => {
  const mock = (async () => Response.json({ data: { status: 'error', error_reason: 'Video could not be decoded.' } })) as typeof fetch;
  const job = await readDescriptionJob('job_123456', 'test-key', mock);
  assert.equal(job.state, 'error');
  assert.match(job.error || '', /could not be decoded/);
  assert.equal(job.observations.length, 0);
});
