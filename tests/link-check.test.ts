import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLink, classifyHttpStatus } from '../src/lib/link-check';
import { isPublicAddress, parsePublicUrl, UnsafeTargetError } from '../src/lib/url-safety';

test('server check rejects loopback, private, metadata, IPv6 loopback, and credentialed URLs', () => {
  for (const url of [
    'http://127.0.0.1/', 'http://10.1.2.3/', 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'https://localhost/', 'https://user:pass@example.com/',
    'file:///etc/passwd', 'http://8.8.8.8:8080/',
  ]) assert.throws(() => parsePublicUrl(url), UnsafeTargetError, url);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2001:4860:4860::8888'), true);
  assert.equal(isPublicAddress('fc00::1'), false);
});

test('link status labels separate reachable, blocked, and automated-access uncertainty', () => {
  assert.equal(classifyHttpStatus(200).status, 'verified');
  assert.equal(classifyHttpStatus(200, 'https://example.com/login').status, 'blocked');
  assert.equal(classifyHttpStatus(401).status, 'blocked');
  assert.equal(classifyHttpStatus(403).status, 'review');
  assert.equal(classifyHttpStatus(429).status, 'review');
  assert.equal(classifyHttpStatus(404).status, 'blocked');
  assert.equal(classifyHttpStatus(503).status, 'blocked');
});

test('an unsafe target is blocked before any network request', async () => {
  const result = await checkLink('live', 'http://127.0.0.1:80/private');
  assert.equal(result.status, 'blocked');
  assert.equal(result.label, 'Unsafe link rejected');
  assert.equal(result.inputUrl, 'http://127.0.0.1:80/private');
});
