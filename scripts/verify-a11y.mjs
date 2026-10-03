import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SUBMITLINE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const violations = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    for (const state of ['blank', 'populated']) {
      if (state === 'populated') {
        await page.getByRole('button', { name: /Load example/ }).click();
        await page.getByRole('button', { name: /Run judge-view preflight/ }).click();
        await page.getByText('Link unavailable').waitFor({ timeout: 30_000 });
        await page.getByText('Repository public').waitFor({ timeout: 30_000 });
        await page.getByText('Video metadata available').waitFor({ timeout: 30_000 });
        const embedTitle = await page.locator('iframe').getAttribute('title');
        if (!embedTitle?.trim()) throw new Error('The video embed needs an accessible title.');
      }
      // YouTube controls its cross-origin embed markup. The iframe itself is still
      // checked for an accessible title; exclude only its third-party internals.
      const result = await new AxeBuilder({ page }).exclude('iframe').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      violations.push(...result.violations.map((issue) => ({
        width, state, id: issue.id, impact: issue.impact,
        nodes: issue.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      })));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ violations }, null, 2));
if (violations.length) process.exitCode = 1;
