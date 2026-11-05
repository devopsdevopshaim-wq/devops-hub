// The flyer to files: an A4 PDF for print, the same as a 300 dpi PNG, and a 1080×1350 post for Instagram / Facebook.
// Run from the repo root with a static server on :8765:  node videos/promo-src/flyer/render.cjs [outDir]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, '..', '..', '..', 'frame-studio', 'media', 'flyer');
const URL = 'http://localhost:8765/videos/promo-src/flyer/flyer.html';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const a4 = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2480 / 794 });
  await a4.goto(URL, { waitUntil: 'networkidle' }); await a4.evaluate(() => document.fonts.ready); await a4.waitForTimeout(500);
  await a4.pdf({ path: path.join(OUT, 'optimus-flyer-a4.pdf'), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const pages = await a4.$$('.page');   // front and back, each its own picture
  await pages[0].screenshot({ path: path.join(OUT, 'optimus-flyer-a4.png') });
  if (pages[1]) await pages[1].screenshot({ path: path.join(OUT, 'optimus-flyer-a4-back.png') });
  const post = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await post.goto(URL + '?fmt=post', { waitUntil: 'networkidle' }); await post.evaluate(() => document.fonts.ready); await post.waitForTimeout(500);
  await post.screenshot({ path: path.join(OUT, 'optimus-flyer-post.png') });
  await b.close(); console.log('flyer ->', OUT);
})();
