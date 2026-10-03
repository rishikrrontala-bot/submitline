import { chromium } from 'playwright-core';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const rehearsal = process.argv.includes('--rehearse');
const proof = join(process.cwd(), 'proof');
await mkdir(proof, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true,
  ...(rehearsal ? {} : { recordVideo: { dir: proof, size: { width: 1280, height: 720 } } }),
});
const page = await context.newPage();
const timeline = [];
let origin;

async function scroll(locator) {
  if (!await locator.isVisible()) throw new Error(`Cannot scroll to ${locator}`);
  await locator.evaluate((node, quick) => node.scrollIntoView({ behavior: quick ? 'instant' : 'smooth', block: 'center' }), rehearsal);
  await page.waitForTimeout(rehearsal ? 80 : 1050);
}
async function point(locator, click = false) {
  if (!await locator.isVisible()) throw new Error(`Cannot point to ${locator}`);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounds for ${locator}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: rehearsal ? 2 : 16 });
  await page.waitForTimeout(rehearsal ? 20 : 300);
  if (click) { await locator.click(); await page.waitForTimeout(rehearsal ? 50 : 350); }
}
async function overlay(id, title, lines, duration) {
  await page.evaluate(({ id, title, lines, duration }) => {
    const head = document.querySelector('#demo-head');
    const caption = document.querySelector('#demo-caption');
    if (!head || !caption) throw new Error('Demo overlay was not injected');
    head.innerHTML = `<span>${id} / 11</span> ${title}`;
    caption.textContent = lines[0];
    clearTimeout(window.__demoCue);
    window.__demoCue = setTimeout(() => caption.textContent = lines[1], duration * 500);
  }, { id, title, lines, duration });
}
async function scene(id, title, seconds, lines, action) {
  console.log(`${rehearsal ? 'REHEARSE' : 'RECORD'} ${id} ${title}`);
  const start = (performance.now() - origin) / 1000;
  await overlay(id, title, lines, seconds);
  await action();
  const actionTime = (performance.now() - origin) / 1000 - start;
  if (!rehearsal && actionTime < seconds) await page.waitForTimeout((seconds - actionTime) * 1000);
  const end = (performance.now() - origin) / 1000;
  timeline.push({ id, title, start, end, narration: lines.join(' '), captions: lines });
  console.log(`  ${start.toFixed(1)}–${end.toFixed(1)}s`);
}

try {
  await page.goto(process.env.SUBMITLINE_URL || 'http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `
    nextjs-portal { display: none !important; }
    *, *::before, *::after { cursor: none !important; }
    #demo-pointer { position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none; transform: translate(-100px,-100px); filter: drop-shadow(0 2px 3px #100f0d66); }
    #demo-head { position: fixed; top: 20px; left: 22px; z-index: 2147483645; pointer-events: none; padding: 8px 13px; background: #100f0d; color: #f4f1ea; font: 700 10px/1.3 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; }
    #demo-head span { color: #ed683d; padding-right: 9px; }
    #demo-caption { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2147483646; pointer-events: none; min-height: 78px; padding: 11px 92px 15px; display: grid; place-items: center; background: #100f0df2; color: #f4f1ea; text-align: center; text-wrap: balance; font: 500 20px/1.35 'DM Sans', sans-serif; }
    .demo-card { position: fixed; inset: 0; z-index: 2147483644; display: grid; align-content: center; padding: 100px 100px 140px; background: #f4f1ea; color: #100f0d; opacity: 0; pointer-events: none; transition: opacity .7s; }
    .demo-card.visible { opacity: 1; }
    .demo-card small { color: #b83e20; font: 700 12px/1.3 'JetBrains Mono', monospace; letter-spacing: .17em; text-transform: uppercase; }
    .demo-card h2 { font: 400 112px/.87 'Instrument Serif', Georgia, serif; letter-spacing: -.05em; margin: 30px 0 20px; }
    .demo-card h2 em { color: #da532c; }
    .demo-card p { font: 500 23px/1.4 'DM Sans', sans-serif; }
    #demo-end { background: #100f0d; color: #f4f1ea; }
    #demo-end strong { font: 700 16px/1.4 'DM Sans', sans-serif; }
  ` });
  await page.evaluate(() => {
    const pointer = document.createElement('div'); pointer.id = 'demo-pointer';
    pointer.innerHTML = '<svg width="27" height="29" viewBox="0 0 27 29" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2L22 15L13 16L9 26L3 2Z" fill="#F4F1EA" stroke="#100F0D" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.append(pointer);
    document.addEventListener('mousemove', (event) => { pointer.style.transform = `translate(${event.clientX}px,${event.clientY}px)`; });
    const head = document.createElement('div'); head.id = 'demo-head'; document.body.append(head);
    const caption = document.createElement('div'); caption.id = 'demo-caption'; document.body.append(caption);
    const intro = document.createElement('div'); intro.id = 'demo-intro'; intro.className = 'demo-card'; intro.innerHTML = '<small>Submission preflight / LovHack Season 3</small><h2>Before they <em>click.</em></h2><p>See what a judge can reach before you submit.</p>'; document.body.append(intro);
    const end = document.createElement('div'); end.id = 'demo-end'; end.className = 'demo-card'; end.innerHTML = '<small>Submission preflight / LovHack Season 3</small><h2>submitline<em>.</em></h2><strong>Built by Rishik Rontala</strong><p>One last look before they click.</p>'; document.body.append(end);
  });
  origin = performance.now();
  await scene('01', 'THE LAST CLICK', 12, [
    'A judge does not see your local build. They see a link.',
    'If that link fails, strong work disappears before it can be judged.'
  ], async () => {
    await page.evaluate(() => document.querySelector('#demo-intro').classList.add('visible'));
    await page.waitForTimeout(rehearsal ? 100 : 5000);
    await page.evaluate(() => document.querySelector('#demo-intro').classList.remove('visible'));
    await point(page.getByRole('link', { name: /Check my submission/ }));
  });
  await scene('02', 'THE JUDGE VIEW', 13, [
    'Submitline gives a hackathon entry one last outside-in check.',
    'The draft and judge view sit side by side, tied to LovHack’s published requirements.'
  ], async () => {
    await point(page.getByRole('link', { name: /Check my submission/ }), true);
    await scroll(page.locator('#entry'));
    await point(page.locator('.entry-panel .panel-head'));
    await point(page.locator('.results-panel .panel-head'));
  });
  await scene('03', 'A REAL CONTRACT', 12, [
    'Each requirement keeps its source nearby.',
    'A live demo matters when possible; a repository is optional; a two-to-three-minute video is required.'
  ], async () => {
    await scroll(page.locator('.requirement').first());
    await point(page.locator('.requirement').first().locator('.source-row a'));
    await scroll(page.locator('.requirement').nth(2));
  });
  await scene('04', 'A DELIBERATE FAILURE', 13, [
    'For this walkthrough, I load Northstar, a clearly marked fictional example.',
    'Its live address is intentionally broken. These are test inputs, not a real hackathon entry.'
  ], async () => {
    const sample = page.getByRole('button', { name: /Load example/ });
    await scroll(sample); await point(sample, true);
    await scroll(page.locator('.sample-note')); await point(page.locator('.sample-note'));
    await scroll(page.locator('#live-url')); await point(page.locator('#live-url'));
  });
  await scene('05', 'THE WHOLE ENTRY', 12, [
    'The example includes its story, technologies, build-period work, reuse disclosure, repository, and video link.',
    'Submitline does not flatten those different obligations into one score.'
  ], async () => {
    await scroll(page.locator('#repo-url')); await point(page.locator('#repo-url'));
    await point(page.locator('#video-url'));
    await scroll(page.locator('#build-notes')); await point(page.locator('#build-notes'));
    await point(page.locator('#reuse-notes'));
  });
  await scene('06', 'PREFLIGHT', 20, [
    'Now I run the preflight. The server checks these URLs without a sign-in.',
    'The live address returns HTTP four-oh-four: a blocker a judge would hit too.'
  ], async () => {
    const run = page.getByRole('button', { name: /Run judge-view preflight/ });
    await scroll(run); await point(run, true);
    await page.getByText('Link unavailable').waitFor({ timeout: 45000 });
    await scroll(page.locator('.evidence-row').first()); await point(page.locator('.evidence-row').first());
  });
  await scene('07', 'NO FALSE PASS', 15, [
    'The public repository can be confirmed. The video link exposes metadata.',
    'But metadata is not playback or proof of what the demo shows, so that remains human review.'
  ], async () => {
    await scroll(page.locator('.evidence-row').nth(1));
    await point(page.locator('.evidence-row').nth(1)); await point(page.locator('.evidence-row').nth(2));
  });
  await scene('08', 'FIX ONLY WHAT FAILED', 17, [
    'I replace the dead address and recheck only that item.',
    'The fresh request reaches example dot com. Reachability is evidence, not proof of functionality.'
  ], async () => {
    const input = page.locator('#live-url'); await scroll(input); await point(input, true);
    await input.fill(''); await input.pressSequentially('https://example.com/', { delay: rehearsal ? 1 : 45 });
    await point(input.locator('..').getByRole('button', { name: /Recheck/ }), true);
    await page.getByText('Reachable without credentials').waitFor({ timeout: 40000 });
    await scroll(page.getByText('Reachable without credentials'));
  });
  await scene('09', 'EVIDENCE, NOT A SCORE', 13, [
    'Each status states what was observed and points back to its rule.',
    'Entrants still confirm their claims and watch the public video while logged out.'
  ], async () => {
    await scroll(page.locator('.result-counts')); await point(page.locator('.result-counts'));
    await scroll(page.locator('.requirement').first());
    await point(page.locator('.requirement').first().locator('.confirm-line'));
  });
  await scene('10', 'VIDEO, HONESTLY', 15, [
    'With consent and a deAPI key, Video Description can return timestamped observations of visible scenes.',
    'No key is configured for this recording, so no model result is shown.'
  ], async () => {
    await scroll(page.getByRole('heading', { name: 'Inside the video' }));
    await point(page.getByRole('heading', { name: 'Inside the video' }));
    await point(page.getByText('No model observations yet.'));
  });
  await scene('11', 'READY TO SUBMIT', 14, [
    'Finally, I export the checklist: rules, observed links, and the manual checks that remain.',
    'Submitline. Built by Rishik Rontala. One last look before they click.'
  ], async () => {
    const exportButton = page.getByRole('button', { name: /Export final checklist/ });
    await scroll(exportButton);
    const downloadPromise = page.waitForEvent('download');
    await point(exportButton, true);
    await (await downloadPromise).saveAs(join(proof, 'demo-export.md'));
    await page.evaluate(() => document.querySelector('#demo-end').classList.add('visible'));
  });
  if (!rehearsal) await writeFile(join(proof, 'demo-timeline.json'), JSON.stringify(timeline, null, 2));
} finally {
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), join(proof, 'demo-capture.webm'));
  await browser.close();
}
console.log(rehearsal ? 'Demo rehearsal passed.' : 'Saved proof/demo-capture.webm and proof/demo-timeline.json.');
