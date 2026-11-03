// Screens of the program and the site for the 2026 promo (videos/promo-src/cap/pro-*.png, 2400x1350).
// Run from the repo root with a static server on :8765:  python3 -m http.server 8765 & node videos/promo-src/capture/cap3.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'cap'), REAL = path.join(__dirname, '..', '..', '..', 'frame-studio', 'media', 'real');
const URL = 'http://localhost:8765/frame-studio/';
const EV = [
  { id: 'ev1aaa', title: 'החתונה של נועה ודניאל', date: '2026-11-20', couple: { name: 'נועה כהן', phone: '050-1234567', email: 'noa@example.com' }, open: true, price: 2290, cost: 2.5, k: 'a1'.repeat(12), v: 'b2'.repeat(12), n: { in: 84, wishes: 31, prints: 160, scans: 212, leads: 18 } },
  { id: 'ev2bbb', title: 'בר המצווה של יונתן', date: '2026-10-02', couple: { name: 'משפחת לוי', phone: '052-7654321' }, open: false, price: 1490, cost: 2.5, k: 'c3'.repeat(12), v: 'd4'.repeat(12), n: { in: 40, prints: 95, scans: 96, leads: 7 } },
  { id: 'ev3ccc', title: 'חינה של נועה', date: '2026-11-15', couple: { name: 'נועה כהן', phone: '0501234567' }, open: false, price: 1490, cost: 2.5, k: 'e5'.repeat(12), v: 'f6'.repeat(12), n: { in: 22, prints: 50, scans: 61, leads: 5 } },
  { id: 'ev4ddd', title: 'אירוע השנה של טק־ליין', date: '2026-09-12', couple: { name: 'טק־ליין בע״מ', phone: '03-5551234' }, open: false, price: 3190, cost: 2.5, k: 'a7'.repeat(12), v: 'b8'.repeat(12), n: { in: 130, prints: 240, scans: 310, leads: 22 } }
];
const LEADS = [
  ['דנה', '052-1112233', 'wedding', '2027-06', 'guest'], ['אורי', '054-9988776', 'barmitzvah', '2027-02', 'album'], ['מיכל', '050-7766554', 'brit', '2026-12', 'guest'],
  ['', '053-4455667', '', '', 'album'], ['רוני', '058-2233445', 'birthday', '2027-01', 'guest'], ['שירה', '052-6655443', 'engagement', '2027-03', 'guest']
].map((x, i) => ({ name: x[0], phone: x[1], soon: x[2], when: x[3], from: x[4], at: Date.now() - i * 86400000, e: 'ev1aaa', title: EV[0].title, date: EV[0].date }));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2400 / 1440 });
  async function mock(p) {
    await p.route(/n8n/, r => r.abort());
    await p.route(/workers\.dev/, (r) => { let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
      const a = body.action; r.fulfill({ contentType: 'application/json', body: JSON.stringify(a === 'ev-list' ? { ok: true, events: EV } : a === 'main-get' ? { ok: true, m: '0123456789abcdef0123', e: 'ev1aaa' } : a === 'leads' ? { ok: true, leads: LEADS } : { ok: false }) }); });
  }
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  const errs = [];
  // ---- the program
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await mock(p);
  await p.addInitScript(() => {
    localStorage.setItem('fs-wow-v1', '1');
    localStorage.setItem('fs-qprint', JSON.stringify({ printer: 'DNP DS620', paper: '15x20', msize: '75x100' }));
    window.FSDesktop = { isDesktop: true, print: { printers: () => Promise.resolve([{ name: 'DNP DS620', label: 'DNP DS620', default: true }]), run: () => Promise.resolve({ ok: true }) } };
  });
  await p.goto(URL + 'studio.html'); await p.waitForTimeout(3500);
  await p.evaluate(() => { document.body.classList.remove('gated'); document.querySelectorAll('#gate, .gate, #intro, .intro, #op-splash').forEach(e => e.remove()); });
  const names = fs.readdirSync(REAL).filter(f => f.endsWith('.webp')).sort((a, b) => (a.startsWith('wedding') ? -1 : 0) - (b.startsWith('wedding') ? -1 : 0));
  await p.evaluate(async (names) => { for (const n of names) { const r = await fetch('media/real/' + n); await FS.addPhotoFile(new File([await r.blob()], n, { type: 'image/webp' })); } FS.emit('photos-added', { from: 0, n: names.length }); }, names);
  await p.waitForTimeout(2000); await p.evaluate(() => FS.mate.open()); await p.waitForTimeout(1500);
  await shot(p, 'pro-grid');
  // copies advice
  await p.click('.mt-sub [data-go="advise"]'); await p.waitForSelector('.ca-dlg', { timeout: 240000 }); await p.waitForTimeout(900);
  await shot(p, 'pro-copies');
  await p.click('#ca-go'); await p.waitForTimeout(1200);
  await p.evaluate(() => { FS.state.marked = {}; FS.state.photos.slice(0, 4).forEach(x => FS.state.marked[x.id] = true); FS.emit('doc'); });
  await p.waitForTimeout(1200); await shot(p, 'pro-grid2');
  // instant print preview
  await p.click('#mt-fab'); await p.waitForTimeout(1600); await shot(p, 'pro-print');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  // AI view: crafts + effects open
  await p.click('nav button[data-v="ai"]'); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelectorAll('#mt .fold.closed .fold-h').forEach((h) => { if (/פאזלים|מהממים/.test(h.textContent)) h.click(); }); });
  await p.waitForTimeout(800); await shot(p, 'pro-ai');
  await p.evaluate(() => { const c = [...document.querySelectorAll('#mt .fold-h')].find(h => /מהממים/.test(h.textContent)); if (c) c.scrollIntoView({ block: 'start' }); });
  await p.waitForTimeout(600); await shot(p, 'pro-wow');
  // puzzle, cube, cube puzzle
  await p.evaluate(() => { const c = [...document.querySelectorAll('#mt .fold-h')].find(h => /פאזלים/.test(h.textContent)); if (c) c.scrollIntoView({ block: 'start' }); });
  await p.click('#mt-crafts [data-cr="puzzle"]'); await p.waitForTimeout(1500);
  await p.click('[data-o="pieces"] [data-v="24"]'); await p.check('[data-c="lift"]'); await p.waitForTimeout(1200); await shot(p, 'pro-puzzle');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.evaluate(() => { FS.state.marked = {}; FS.state.photos.slice(0, 6).forEach(x => FS.state.marked[x.id] = true); });
  await p.click('nav button[data-v="ai"]'); await p.waitForTimeout(600);
  await p.click('#mt-crafts [data-cr="cube"]'); await p.waitForTimeout(2200); await shot(p, 'pro-cube');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // the live event: the studio, signed in (mocked)
  await p.evaluate(() => { const s = document.querySelector('#mt-switch [data-sw="studio"]'); if (s) s.click(); FS.account.session = () => ({ token: 't', email: 'o@x', role: 'admin' }); FS.select(0); });
  await p.waitForTimeout(800);
  await p.evaluate(() => FS.openTab('live')); await p.waitForTimeout(1800);
  await p.evaluate(() => { const c = document.getElementById('lv-albqr'); if (c && !c.checked) c.click(); });
  await p.click('#lv-albqr-all'); await p.waitForTimeout(1800);
  await shot(p, 'pro-live');
  await p.click('#lv-log'); await p.waitForTimeout(900); await shot(p, 'pro-record');
  await p.click('[data-t="ld"]'); await p.waitForTimeout(700); await shot(p, 'pro-leads');
  await p.click('[data-t="ev"]'); await p.waitForTimeout(300); await p.click('[data-qr="ev1aaa"]'); await p.waitForTimeout(1500); await shot(p, 'pro-codes');
  // a magnet print with its QR (for the "QR on every magnet" scene)
  const img = await p.evaluate(() => FS.renderFull(FS.state.photos[0], 0.9, false).toDataURL('image/jpeg', 0.92));
  fs.writeFileSync(path.join(OUT, 'pro-qrprint.jpg'), Buffer.from(img.split(',')[1], 'base64'));
  // ---- the site
  const s = await ctx.newPage(); s.on('pageerror', e => errs.push('site: ' + e.message)); await mock(s);
  await s.goto(URL + 'index.html?skip'); await s.waitForTimeout(6500); await shot(s, 'pro-site');
  await s.evaluate(() => document.getElementById('mwall').scrollIntoView()); await s.waitForTimeout(2500); await shot(s, 'pro-wall');
  await s.evaluate(() => document.getElementById('packages').scrollIntoView()); await s.waitForTimeout(2500); await shot(s, 'pro-packages');
  // ---- the guest's phone page
  const g = await ctx.newPage(); await mock(g);
  await g.route(/workers\.dev/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, title: 'החתונה של נועה ודניאל', date: '2026-11-20', open: true, biz: { name: 'פריים מגנטים' } }) }));
  await g.setViewportSize({ width: 430, height: 932 });
  await g.goto(URL + 'live.html?e=ev1aaa&k=' + 'a1'.repeat(12)); await g.waitForTimeout(2500);
  await g.screenshot({ path: path.join(OUT, 'pro-guest.png'), fullPage: true });
  console.log('errors', errs); await b.close();
})();
