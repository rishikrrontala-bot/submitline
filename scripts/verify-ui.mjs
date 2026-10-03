import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = process.env.SUBMITLINE_URL || 'http://127.0.0.1:3000';
const proofDir = join(process.cwd(), 'proof');
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const pageErrors = [];
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  desktop.on('pageerror', (error) => pageErrors.push(error.message));
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: join(proofDir, 'desktop-full.png'), fullPage: true });
  await desktop.getByRole('button', { name: /Load example/ }).click();
  await desktop.getByRole('button', { name: /Run judge-view preflight/ }).click();
  await desktop.getByText('Repository public').waitFor({ timeout: 30_000 });
  await desktop.getByText('Link unavailable').waitFor({ timeout: 30_000 });
  await desktop.getByText('Video metadata available').waitFor({ timeout: 30_000 });
  await desktop.screenshot({ path: join(proofDir, 'sample-result.png'), fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (error) => pageErrors.push(error.message));
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  const width = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  await mobile.screenshot({ path: join(proofDir, 'mobile-full.png'), fullPage: true });
  if (width.content > width.viewport) throw new Error('Mobile horizontal overflow: ' + JSON.stringify(width));
  if (pageErrors.length) throw new Error('Browser errors: ' + pageErrors.join(' | '));
  console.log(JSON.stringify({ desktop: 'passed', sampleChecks: 'passed', mobile: 'passed', width, pageErrors }, null, 2));
} finally {
  await browser.close();
}
