// Examples for the flyer's back page: two collages made by the studio, and the funny effects on a real photo.
// Run from the repo root with a static server on :8765:  node videos/promo-src/capture/cap6.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'cap');
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.addInitScript(() => { localStorage.setItem('fs-wow-v1', '1'); localStorage.setItem('fs-mate', 'off'); localStorage.setItem('fs-auto-copies', '0'); });
  await p.goto('http://localhost:8765/frame-studio/studio.html'); await p.waitForTimeout(3000);
  await p.evaluate(async () => { document.body.classList.remove('gated', 'intro-on'); document.querySelectorAll('#gate, .gate, #intro, .intro, #op-splash').forEach(e => e.remove());
    for (const n of ['wedding-1', 'wedding-2', 'wedding-3', 'engagement-1', 'engagement-2', 'company-3', 'henna-3', 'barmitzvah-1', 'brit-1']) { const r = await fetch('media/real/' + n + '.webp'); await FS.addPhotoFile(new File([await r.blob()], n + '.webp', { type: 'image/webp' })); }
    if (FS.mate && FS.mate.isOn()) FS.mate.close(); FS.select(0); });
  await p.waitForTimeout(1500);
  const save = (name, dataUrl) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

  // collages: the studio's own collage tool, its result is a new photo at the end
  const collage = async (opts) => {
    await p.evaluate(() => FS.openTab('collage')); await p.waitForTimeout(800);
    await p.evaluate((o) => {
      const click = (s) => { const e = document.querySelector(s); if (e) e.click(); };
      FS.state.marked = {}; FS.state.photos.slice(o.from, o.from + o.n).forEach(x => FS.state.marked[x.id] = true);
      click('#cl-marked'); click('#cl-mode [data-m="' + o.mode + '"]'); click('#cl-shape [data-s="' + o.shape + '"]'); click('#cl-deco [data-d="' + o.deco + '"]'); click('#cl-bgs [data-b="' + o.bgs + '"]');
      const sw = document.querySelector('#cl-sw [data-c="' + o.bg + '"]') || [...document.querySelectorAll('#cl-sw button')].find(x => (x.style.background || '').replace(/\s/g, '') && x.getAttribute('style').indexOf(o.bg) >= 0); if (sw) sw.click();
      const t = document.getElementById('cl-title'); t.value = o.title; t.dispatchEvent(new Event('input', { bubbles: true }));
    }, opts);
    await p.waitForTimeout(900);
    const before = await p.evaluate(() => FS.state.photos.length);
    await p.click('#cl-make'); await p.waitForTimeout(3000);
    return p.evaluate((before) => { const ph = FS.state.photos[FS.state.photos.length - 1]; if (FS.state.photos.length <= before) return null; return FS.renderFull(ph, 0.5, false).toDataURL('image/jpeg', 0.88); }, before);
  };
  const c1 = await collage({ from: 0, n: 6, mode: 'auto', shape: 'rect', deco: 'border', bgs: 'soft', bg: '#f6f0e4', title: 'נועה & דניאל · 20.11.2026' });
  if (c1) save('collage-1.jpg', c1); else console.log('collage 1 not made');
  const c2 = await collage({ from: 3, n: 5, mode: 'hero', shape: 'rect', deco: 'border', bgs: 'solid', bg: '#2a2238', title: 'אירוע השנה 2026' });
  if (c2) save('collage-2.jpg', c2); else console.log('collage 2 not made');

  // the funny effects, on the couple (photo 1: two faces)
  for (const id of ['bighead', 'bigeyes', 'carica', 'swap', 'disguise', 'crown', 'clown']) {
    const d = await p.evaluate(async (id) => { const im = await FS.loadImg(FS.state.photos[1].src); try { const c = await FS.funFx(id, im); const k = 900 / c.width, s = FS.canvas(900, c.height * k); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); return s.toDataURL('image/jpeg', 0.88); } catch (e) { return null; } }, id);
    if (d) save('fun-' + id + '.jpg', d); else console.log('fun', id, 'failed');
  }
  console.log('errors', errs); await b.close();
})();
