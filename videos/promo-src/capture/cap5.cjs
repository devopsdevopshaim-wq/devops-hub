// The v109–v110 screens for the promo (videos/promo-src/cap/hub-*.png, ai-*.jpg, 2400x1350 for the screens).
// The event hub's automatic line and live board, the command bar, and the new built-in AI on one photo.
// Run from the repo root with a static server on :8765:  node videos/promo-src/capture/cap5.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'cap'), URL = 'http://localhost:8765/frame-studio/';
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2400 / 1440 });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.route(/n8n|workers\.dev/, r => r.fulfill({ contentType: 'application/json', body: '{"ok":false}' }));
  const now = Date.now();
  await p.addInitScript((now) => {
    localStorage.setItem('fs-wow-v1', '1');
    localStorage.setItem('fs-qprint', JSON.stringify({ printer: 'DNP DS620', paper: '15x20', msize: '75x100', noPreview: true }));
    localStorage.setItem('frame-studio-printer', JSON.stringify({ name: 'DNP DS620', type: 'dye', inkCap: 400, paperCap: 400, inkUsed: 180, paperUsed: 190 }));
    const jobs = []; for (let i = 0; i < 44; i++) jobs.push({ t: now - (210 - i * 4.8) * 60000, sheets: 2, items: 3 + (i % 3), sizes: {}, ids: [], paper: '15x20', printer: 'DNP DS620' });
    localStorage.setItem('frame-studio-printlog', JSON.stringify({ start: now - 4 * 3600e3, name: 'החתונה של נועה ודניאל', jobs }));
    localStorage.setItem('fs-hub-money', JSON.stringify({ guests: 280, price: 0, cost: 0, extra: 0 }));
    window.FSDesktop = { isDesktop: true, notify() {}, print: { printers: () => Promise.resolve([{ name: 'DNP DS620', label: 'DNP DS620', default: true }]), run: () => Promise.resolve({ ok: true }) } };
  }, now);
  const shot = (n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  await p.goto(URL + 'studio.html'); await p.waitForTimeout(3500);
  await p.evaluate(() => { document.body.classList.remove('gated'); document.querySelectorAll('#gate, .gate, #intro, .intro, #op-splash').forEach(e => e.remove()); FS.mate.open(); });
  await p.waitForTimeout(800);
  // the camera's folder, fed one photo at a time
  await p.evaluate(() => {
    window.__files = [];
    const dir = { name: 'Camera-WiFi', values() { const l = window.__files.slice(); let i = 0; return { next: () => Promise.resolve(i < l.length ? { done: false, value: { kind: 'file', name: l[i].name, getFile: ((f) => () => Promise.resolve(f))(l[i++]) } } : { done: true }) }; } };
    window.showDirectoryPicker = () => Promise.resolve(dir);
  });
  await p.click('.mt-hubtab'); await p.waitForTimeout(400);
  await p.click('#hub-mode [data-m="approve"]');
  await p.click('#hub-pick'); await p.waitForTimeout(800);
  for (const n of ['henna-3', 'wedding-2', 'brit-1', 'engagement-1', 'barmitzvah-3', 'wedding-1']) {
    await p.evaluate(async (n) => { const r = await fetch('media/real/' + n + '.webp'); window.__files.push(new File([await r.blob()], n + '.webp', { type: 'image/webp', lastModified: Date.now() })); }, n);
    await p.waitForTimeout(900);
  }
  await p.waitForTimeout(12000);
  // two of them printed, the rest waiting for a click
  await p.evaluate(() => { const b = document.querySelectorAll('#hub-q [data-a="go"]'); if (b[b.length - 1]) b[b.length - 1].click(); });
  await p.waitForTimeout(1500); await shot('hub-auto');
  await p.click('.hub-tabs [data-hp="live"]'); await p.waitForTimeout(1500); await shot('hub-live');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.type('סרטון'); await p.waitForTimeout(400); await shot('cmdk');
  await p.keyboard.press('Escape');
  // the new AI, each on its own copy of the same photo
  const res = await p.evaluate(async () => {
    const out = {}, r = await fetch('media/real/wedding-3.webp'), bl = await r.blob();
    for (const k of ['orig', 'bokeh', 'hall', 'cutpro']) {
      const from = FS.state.photos.length; await FS.addPhotoFile(new File([bl], 'w3-' + k + '.webp', { type: 'image/webp' })); const ph = FS.state.photos[from]; await FS.loadImg(ph.src);
      if (k !== 'orig') await FS.localPlus[k](ph, 0, 1, () => false);
      FS.busy && FS.busy();
      out[k] = FS.renderFull(ph, 1, false).toDataURL('image/jpeg', 0.9);
    }
    return out;
  });
  for (const k of Object.keys(res)) fs.writeFileSync(path.join(OUT, 'ai-' + k + '.jpg'), Buffer.from(res[k].split(',')[1], 'base64'));
  console.log('errors', errs); await b.close();
})();
