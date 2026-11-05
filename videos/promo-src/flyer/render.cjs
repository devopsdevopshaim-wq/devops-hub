// The flyer to files: one A4 page as a PDF for print and as a 300 dpi PNG (for WhatsApp, Facebook, email).
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
  await (await a4.$('.page')).screenshot({ path: path.join(OUT, 'optimus-flyer-a4.png') });
  await b.close(); console.log('flyer ->', OUT);
})();
