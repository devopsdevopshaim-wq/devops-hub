// The studio itself (served from the repository) against the live AI server, the way the owner uses it: 5 event photos, one
// design, the batch. Writes before/after pictures and report.json to <out> (pushed to the branch ci-ai-e2e). Nothing secret.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('.');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } const t = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.tflite': 'application/octet-stream', '.onnx': 'application/octet-stream', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); }); }).listen(8099);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 850 } }); const p = await ctx.newPage(); const logs = [];
  p.on('console', (m) => { const t = m.text(); if (/AI|guard|crisp|keepPeople|lost|extra|not-same/i.test(t)) logs.push(t.slice(0, 300)); });
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
  // the live server, as the published site calls it
  await p.route(/workers\.dev|n8n\.cloud/, async (route) => { const h = Object.assign({}, route.request().headers(), { origin: 'https://devopsdevopshaim-wq.github.io' }); route.continue({ headers: h }); });
  await p.addInitScript(() => { localStorage.setItem('fs-wow-v1', '1'); localStorage.setItem('fs-guide-seen', '1'); });
  await p.goto('http://localhost:8099/frame-studio/studio.html'); await p.waitForTimeout(4000);
  const photos = ['company-1', 'birthday-1', 'wedding-3', 'brit-2', 'barmitzvah-2'];
  const looks = [['kids', 0], ['fantasy', 15], ['real', 0]];
  const report = [];
  for (const [kind, li] of looks) {
    const r = await p.evaluate(async ({ photos, kind, li }) => {
      document.body.classList.remove('gated'); document.querySelectorAll('#gate,#op-splash,#wow1,#intro').forEach((e) => e.remove());
      FS.state.photos.splice(0); for (const n of photos) { const r = await fetch('media/real/' + n + '.webp'); await FS.addPhotoFile(new File([await r.blob()], n + '.webp', { type: 'image/webp' })); }
      const L = kind === 'kids' ? FS.AI_KIDS : kind === 'fantasy' ? FS.AI_FANTASY : FS.AI_REAL, look = L[li];
      const t = performance.now(); await FS.runAI(look[2], look[0], FS.state.photos);
      const res = FS.state.photos.map((q) => { const c = FS.canvas(360, 540); c.getContext('2d').drawImage(FS.img(q.origSrc || q.src), 0, 0, 360, 540); const d = FS.canvas(360, 540); d.getContext('2d').drawImage(FS.img(q.src), 0, 0, 360, 540); return { name: q.name, applied: !!q.origSrc, red: q.aiBad || '', n0: q._n0, score: q.aiScore, before: c.toDataURL('image/jpeg', .8), after: d.toDataURL('image/jpeg', .8) }; });
      return { look: look[0], seconds: Math.round((performance.now() - t) / 1000), toast: (document.querySelector('#toast') || {}).textContent, res };
    }, { photos, kind, li });
    r.res.forEach((x, i) => { fs.writeFileSync(path.join(out, kind + '-' + i + '-before.jpg'), Buffer.from(x.before.split(',')[1], 'base64')); fs.writeFileSync(path.join(out, kind + '-' + i + '-after.jpg'), Buffer.from(x.after.split(',')[1], 'base64')); delete x.before; delete x.after; });
    report.push(r); console.log(JSON.stringify(r));
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ report, logs: logs.slice(-80) }, null, 2));
  console.log(logs.slice(-40).join('\n'));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
