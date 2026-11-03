// More screens for the promo's "how it works" part (videos/promo-src/cap/how-*.png, 2400x1350).
// Run from the repo root with a static server on :8765:  node videos/promo-src/capture/cap4.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'cap'), REAL = path.join(__dirname, '..', '..', '..', 'frame-studio', 'media', 'real');
const URL = 'http://localhost:8765/frame-studio/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2400 / 1440 });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.route(/n8n|workers\.dev/, r => r.fulfill({ contentType: 'application/json', body: '{"ok":false}' }));
  await p.addInitScript(() => {
    localStorage.setItem('fs-wow-v1', '1');
    localStorage.setItem('fs-mate-print-my', JSON.stringify([{ name: 'מגנטים 7.5×10', o: { paper: '15x20', msize: '75x100', mode: 'real' }, printer: 'DNP DS620' }, { name: 'תמונות 10×15', o: { paper: '10x15', msize: '', mode: 'page' }, printer: 'DNP DS620' }, { name: 'A4 משרד', o: { paper: 'A4', msize: '75x100', mode: 'real' }, printer: '' }]));
    window.FSDesktop = { isDesktop: true, print: { printers: () => Promise.resolve([{ name: 'DNP DS620', label: 'DNP DS620', default: true }]), run: () => Promise.resolve({ ok: true }) } };
  });
  const shot = (n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  await p.goto(URL + 'studio.html'); await p.waitForTimeout(3500);
  await p.evaluate(() => { document.body.classList.remove('gated'); document.querySelectorAll('#gate, .gate, #intro, .intro, #op-splash').forEach(e => e.remove()); FS.mate.open(); });
  await p.waitForTimeout(1200); await shot('how-empty');
  const names = ['wedding-1', 'wedding-2', 'wedding-3', 'engagement-1', 'engagement-2', 'henna-3', 'barmitzvah-1', 'barmitzvah-3', 'brit-1', 'birthday-3', 'holiday-2', 'company-3'].map(n => n + '.webp');
  await p.evaluate(async (names) => { for (const n of names) { const r = await fetch('media/real/' + n); await FS.addPhotoFile(new File([await r.blob()], n, { type: 'image/webp' })); } FS.emit('photos-added', { from: 0, n: names.length }); }, names);
  await p.waitForTimeout(2500); await shot('how-grid');
  // the edit screen: several photos at once, before | after
  await p.evaluate(() => { FS.state.marked = {}; FS.state.photos.slice(0, 6).forEach(x => FS.state.marked[x.id] = true); });
  await p.click('nav button[data-v="edit"]'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const b = document.querySelector('#mt [data-pp], #mt .mt-auto, #mt [data-e="auto"]'); });
  await shot('how-edit');
  // the full editor, with a frame
  await p.click('nav button[data-v="design"]'); await p.waitForTimeout(2000);
  await p.evaluate(() => { const s = document.getElementById('mt-dframe'); if (s && s.options.length > 3) { s.selectedIndex = 3; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.waitForTimeout(2500); await shot('how-design');
  // the print window with the saved settings
  await p.click('nav button[data-v="print"]'); await p.waitForTimeout(2200); await shot('how-print');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // the quick tools in the AI view
  await p.click('nav button[data-v="ai"]'); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelectorAll('#mt .fold:not(.closed) .fold-h').forEach(h => h.click()); [...document.querySelectorAll('#mt .fold-h')].forEach(h => { if (/מיד, על המחשב|גיבורי על|עריכות חכמות/.test(h.textContent)) h.click(); }); });
  await p.waitForTimeout(900); await shot('how-tools');
  // the studio's frames
  await p.evaluate(() => { const s = document.querySelector('#mt-switch [data-sw="studio"]'); if (s) s.click(); FS.select(0); });
  await p.waitForTimeout(800); await p.evaluate(() => FS.openTab('frames')); await p.waitForTimeout(2500); await shot('how-frames');
  console.log('errors', errs); await b.close();
})();
