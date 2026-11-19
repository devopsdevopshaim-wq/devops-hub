// A real run of 🙂 שחזור פנים (frame-studio/js/ai-restore.js): the studio page in Chromium, GFPGAN downloaded from Hugging Face,
// a group photo made soft (small, JPEG 50), restored; before/after crops of the faces saved to out/.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const logs = []; p.on('pageerror', (e) => logs.push('ERR ' + e)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  await p.goto('http://localhost:8099/frame-studio/studio.html'); await p.waitForTimeout(4000);
  fs.mkdirSync('out', { recursive: true });
  for (const f of ['real/company-1.webp', 'real/barmitzvah-1.webp', 'real/wedding-1.webp']) {
    const r = await p.evaluate(async (f) => {
      const im = await FS.loadImg('/frame-studio/media/' + f);
      const W = 640, H = Math.round(W * im.naturalHeight / im.naturalWidth), c = FS.canvas(W, H); c.getContext('2d').drawImage(im, 0, 0, W, H);
      const soft = await FS.loadImg(c.toDataURL('image/jpeg', 0.5));
      FS.__gfpOk = true;
      const t = Date.now(); let last = '';
      const res = await FS.restoreFaces(soft, (x, ph) => { last = ph + ' ' + Math.round(x * 100); });
      return { ms: Date.now() - t, faces: res && res.faces, last, a: soft.src, b: res && res.canvas ? res.canvas.toDataURL('image/jpeg', 0.92) : '' };
    }, f);
    console.log(f, 'faces', r.faces, r.ms + 'ms', r.last);
    const name = f.split('/')[1].replace('.webp', '');
    if (r.b) fs.writeFileSync('out/' + name + '.html', `<body style="margin:0;display:flex"><img src="${r.a}" style="width:50%"><img src="${r.b}" style="width:50%">`);
    if (r.b) { const q = await b.newPage({ viewport: { width: 1280, height: 960 } }); await q.goto('file://' + process.cwd() + '/out/' + name + '.html'); await q.screenshot({ path: 'out/' + name + '.png', fullPage: true }); await q.close(); fs.unlinkSync('out/' + name + '.html'); }
  }
  console.log('page messages:', logs.slice(0, 8).join(' | '));
  await b.close();
})();
