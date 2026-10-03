import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
async function font(relativePath) {
  const bytes = await readFile(join(root, relativePath));
  return `data:font/woff2;base64,${bytes.toString('base64')}`;
}
const serif = await font('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2');
const serifItalic = await font('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2');
const sans = await font('node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2');
const mono = await font('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:Instrument;src:url('${serif}') format('woff2');font-weight:400}
@font-face{font-family:Instrument;src:url('${serifItalic}') format('woff2');font-weight:400;font-style:italic}
@font-face{font-family:DM;src:url('${sans}') format('woff2');font-weight:700}
@font-face{font-family:Jet;src:url('${mono}') format('woff2');font-weight:700}
*{box-sizing:border-box}
body{margin:0;width:1280px;height:720px;overflow:hidden;background:#f4f1ea;color:#100f0d}
.top{height:8px;background:#100f0d}
.canvas{position:relative;height:628px;padding:33px 57px}
.header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #100f0d;padding-bottom:27px}
.logo{font:700 34px/.9 DM,sans-serif;letter-spacing:-.065em}
.logo span{color:#da532c}
.edition{font:700 13px/1 Jet,monospace;letter-spacing:.13em}
.kicker{position:absolute;left:59px;top:144px;color:#b83e20;font:700 14px/1.2 Jet,monospace;letter-spacing:.14em}
.headline{position:absolute;left:53px;top:194px;margin:0;width:700px;font:400 136px/.78 Instrument,Georgia,serif;letter-spacing:-.055em}
.headline em{display:block;color:#da532c;font-style:italic;font-size:172px;line-height:.94;letter-spacing:-.06em;margin-left:155px}
.sub{position:absolute;left:59px;bottom:56px;width:615px;border-top:1px solid #100f0d;padding-top:17px;font:700 23px/1.2 DM,sans-serif;letter-spacing:-.025em}
.sub span{color:#da532c}
.evidence{position:absolute;right:57px;top:148px;width:420px;height:409px;background:#100f0d;color:#f4f1ea;padding:27px 30px;box-shadow:18px 18px 0 #e3dcd3}
.evidence small{display:block;color:#da532c;font:700 11px/1.4 Jet,monospace;letter-spacing:.14em}
.evidence .rule{height:1px;background:#7a7772;margin-top:21px}
.row{display:flex;align-items:baseline;justify-content:space-between;height:145px;border-bottom:1px solid #595752}
.row b{font:400 133px/.98 Instrument,Georgia,serif;letter-spacing:-.06em}
.row span{font:700 11px/1.4 Jet,monospace;letter-spacing:.12em;text-transform:uppercase}
.row.bad b,.row.bad span{color:#ed683d}
.row.good b{color:#f4f1ea}
.row.good span{color:#c8d5ce}
.arrow{position:absolute;left:50%;top:196px;transform:translateX(-50%);border:2px solid #ed683d;background:#100f0d;border-radius:50%;width:53px;height:53px;display:grid;place-items:center;color:#ed683d;font:700 28px/1 DM,sans-serif}
.foot{height:84px;background:#100f0d;color:#f4f1ea;display:flex;justify-content:space-between;align-items:center;padding:0 57px}
.foot strong{font:700 17px/1.1 DM,sans-serif;letter-spacing:.01em}
.foot span{font:700 12px/1 Jet,monospace;letter-spacing:.13em;text-transform:uppercase;color:#d2cdc4}
</style></head><body>
<div class="top"></div>
<main class="canvas">
  <header class="header"><div class="logo">submitline<span>.</span></div><div class="edition">PRODUCT DEMO &nbsp;/&nbsp; 02:36</div></header>
  <div class="kicker">SUBMISSION PREFLIGHT &nbsp;/&nbsp; LOVHACK SEASON 3</div>
  <h1 class="headline">Before they <em>click.</em></h1>
  <div class="sub">Catch the <span>broken link</span> before a judge does.</div>
  <div class="evidence"><small>01 / THE LIVE DEMO LINK</small><div class="rule"></div><div class="row bad"><b>404</b><span>Blocked</span></div><div class="arrow">↓</div><div class="row good"><b>200</b><span>Reachable</span></div></div>
</main>
<footer class="foot"><strong>A final look from the other side of the link.</strong><span>Built by Rishik Rontala</span></footer>
</body></html>`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const path = join(root, 'proof', 'submitline-thumbnail.png');
  await page.screenshot({ path });
  const size = (await stat(path)).size;
  if (size > 2_000_000) throw new Error(`Thumbnail is over 2 MB: ${size}`);
  console.log(`${path} (${size} bytes, 1280×720)`);
} finally {
  await browser.close();
}
