// End to end on the live server: the studio page's own FS.restyleTry (people count, the people check, retries) with one
// AI style on a few event photos. Prints the people found before and after, and saves before/after pictures to out/.
const { chromium } = require('playwright');
const fs = require('fs');
const SITE = 'https://devopsdevopshaim-wq.github.io', WORKER = 'https://spider-auth.devopsdevopshaim.workers.dev';
const STYLE = process.env.STYLE || 'big-head';
const PHOTOS = (process.env.PHOTOS || 'real/barmitzvah-1.webp,real/birthday-2.webp,real/company-1.webp').split(',');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const logs = []; p.on('console', (m) => { if (/AI|people|faces/i.test(m.text())) logs.push(m.text()); }); p.on('pageerror', (e) => logs.push('ERR ' + e));
  // the studio's server calls go to the live worker, with the site's own origin (the worker only answers the site)
  await p.route(/hasadna-hubs/, async (r) => {
    const res = await r.fetch({ url: WORKER + '/hasadna-hubs', headers: { ...r.request().headers(), origin: SITE } });
    r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
  });
  await p.goto('http://localhost:8099/frame-studio/studio.html'); await p.waitForTimeout(4000);
  fs.mkdirSync('out', { recursive: true });
  for (const f of PHOTOS) {
    const r = await p.evaluate(async ({ f, STYLE }) => {
      const st = (FS.AI_WOW || []).concat(FS.AI_STYLES || []).find((x) => x[0] === STYLE); if (!st) return { err: 'no style' };
      const im = await FS.loadImg('/frame-studio/media/' + f);
      const doc = FS.newDoc(im), ph = { id: 't' + Math.random(), src: im.src, doc, cache: {} };
      FS.aiBatch(true);
      const before = FS.mainFaces(await FS.detectFaces(im)).length;
      const t = Date.now();
      try {
        const out = await FS.restyleTry(ph, st[3]);
        const after = FS.mainFaces(await FS.detectFaces(out)).length;
        const c = FS.canvas(out.naturalWidth, out.naturalHeight); c.getContext('2d').drawImage(out, 0, 0);
        return { before, after, n0: ph._n0, ms: Date.now() - t, src: out.aiSource, a: im.src, b: c.toDataURL('image/jpeg', 0.9) };
      } catch (e) { return { before, n0: ph._n0, ms: Date.now() - t, err: String(e && e.message || e) }; }
    }, { f, STYLE });
    const name = f.split('/').pop().replace(/\.\w+$/, '');
    console.log(name, '| people in the photo:', r.n0, '(main ' + r.before + ') | in the design:', r.after, '|', r.err || 'ok ' + r.src, '|', Math.round(r.ms / 1000) + 's');
    if (r.b) { const q = await b.newPage({ viewport: { width: 1400, height: 700 } }); await q.setContent(`<body style="margin:0;display:flex;gap:8px;background:#222"><img src="${new URL(r.a, 'http://localhost:8099').href}" style="height:690px"><img src="${r.b}" style="height:690px">`); await q.waitForTimeout(800); await q.screenshot({ path: 'out/' + name + '.png' }); await q.close(); }
  }
  console.log('page:', logs.slice(0, 25).join('\n  '));
  await b.close();
})();
