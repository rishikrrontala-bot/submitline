import { chromium } from 'playwright-core';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: join(process.cwd(), 'proof'), size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
try {
  await page.goto(process.env.SUBMITLINE_URL || 'http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Load example/ }).click();
  await page.locator('#live-url').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Run judge-view preflight/ }).click();
  await page.getByText('Link unavailable').waitFor({ timeout: 30_000 });
  await page.getByText('Link unavailable').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4500);
  await page.locator('#live-url').fill('https://example.com/');
  await page.locator('#live-url').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Recheck/ }).first().click();
  await page.getByText('Reachable without credentials').waitFor({ timeout: 30_000 });
  await page.getByText('Reachable without credentials').scrollIntoViewIfNeeded();
  await page.waitForTimeout(5500);
} finally {
  const recording = page.video();
  await context.close();
  if (recording) await rename(await recording.path(), join(process.cwd(), 'proof', 'raw-blocked-to-fixed.webm'));
  await browser.close();
}
console.log('Saved proof/raw-blocked-to-fixed.webm');
