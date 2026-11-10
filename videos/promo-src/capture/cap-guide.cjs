// The screens of the tutorial film "אופטימוס · מדריך" (videos/promo-src/optimus-guide/cap/*.png → .webp by guide.py):
// the start screen, every view of the quick workspace, and every tab of the full studio, each with real event photos
// loaded and an example on screen. Run from the repo root with a static server on :8765:
//   node videos/promo-src/capture/cap-guide.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'optimus-guide', 'cap'), URL = 'http://localhost:8765/frame-studio/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2400 / 1440 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/n8n|workers\.dev/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":false}' }));
  const now = Date.now();
  await p.addInitScript((now) => {
    localStorage.setItem('fs-wow-v1', '1'); localStorage.setItem('fs-guide-seen', '1');
    localStorage.setItem('frame-session', JSON.stringify({ token: 't', role: 'admin', email: 'owner@example.com' }));
    localStorage.setItem('frame-studio-printer', JSON.stringify({ name: 'MITSUBISHI CP-D90DW', type: 'dye', inkCap: 400, paperCap: 400, inkUsed: 120, paperUsed: 120, learned: now }));
    const jobs = []; for (let i = 0; i < 30; i++) jobs.push({ t: now - (150 - i * 4.8) * 60000, sheets: 2, items: 4, sizes: {}, ids: [], paper: '15x20', printer: 'MITSUBISHI CP-D90DW' });
    localStorage.setItem('frame-studio-printlog', JSON.stringify({ start: now - 3 * 3600e3, name: 'החתונה של נועה ודניאל', jobs }));
    window.FSDesktop = { isDesktop: true, version: '1.0.10', notify() {}, print: { printers: () => Promise.resolve([{ name: 'MITSUBISHI CP-D90DW', label: 'MITSUBISHI CP-D90DW', default: true }]), run: () => Promise.resolve({ ok: true }), status: (n) => Promise.resolve({ ok: true, printers: {} }), queue: () => Promise.resolve({ ok: true, status: 'Normal', jobs: [] }) } };
  }, now);
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const clean = () => p.evaluate(() => { document.body.classList.remove('gated'); document.querySelectorAll('#gate, #op-splash, #wow1').forEach((e) => e.remove()); if (FS.closeDialog) FS.closeDialog(); });
  await p.goto(URL + 'studio.html'); await p.waitForTimeout(4500);
  await clean(); await shot('start');
  // real event photos, into the quick workspace
  await p.evaluate(() => { if (FS.closeIntro) FS.closeIntro(); });
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    const names = ['wedding-1', 'wedding-2', 'wedding-3', 'engagement-1', 'barmitzvah-1', 'birthday-2', 'brit-1', 'henna-3'];
    for (const n of names) { const r = await fetch('media/real/' + n + '.webp'); await FS.addPhotoFile(new File([await r.blob()], n + '.webp', { type: 'image/webp' })); }
    FS.mate.open();
  });
  await p.waitForTimeout(3500); await clean(); await shot('quick-main');
  for (const v of ['edit', 'design', 'ai']) {
    await p.evaluate((v) => { const b = document.querySelector('#mt [data-v="' + v + '"]'); if (b) b.click(); }, v);
    await p.waitForTimeout(2200); await shot('quick-' + v);
  }
  await p.evaluate(() => { const b = document.querySelector('#mt [data-v="main"]'); if (b) b.click(); FS.mate.print(); });
  await p.waitForTimeout(2200); await shot('quick-print');
  await p.evaluate(() => { if (FS.closeDialog) FS.closeDialog(); document.querySelectorAll('.mt-pw, #mt-print, .mt-print').forEach((e) => { const x = e.querySelector('[data-x], .x, .mt-x'); if (x) x.click(); }); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { FS.mate.show('hub'); }); await p.waitForTimeout(2200); await shot('quick-hub');
  // the full studio, tab by tab, with the first photo open
  await p.evaluate(() => { FS.mate.close(); }); await p.waitForTimeout(1500); await clean();
  for (const t of ['photos', 'adjust', 'filters', 'frames', 'styles', 'ai', 'live', 'collage', 'curate', 'customers', 'output']) {
    await p.evaluate((t) => FS.openTab(t), t); await p.waitForTimeout(2000);
    if (t === 'frames') await p.evaluate(() => { const f = document.querySelectorAll('.frame-grid button, .frames button, [data-frame]')[2]; if (f) f.click(); });
    if (t === 'filters') await p.evaluate(() => { const f = document.querySelectorAll('[data-filter], .filter-grid button')[3]; if (f) f.click(); });
    await shot('tab-' + t);
  }
  console.log('errors:', errs.slice(0, 5));
  await b.close();
})();
