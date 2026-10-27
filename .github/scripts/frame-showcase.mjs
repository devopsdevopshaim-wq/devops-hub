// A real run of "frames from the invitation" (FS.INV_FRAME_STYLES) on the studio page itself, with the public hubs server, for a
// person to look at: the invitation (its art from the image AI, its Hebrew words set on it here), each AI frame as a see-through
// PNG and with an event photo in its window, a contact sheet of all of them, and report.json (time, engine, errors). Nothing here
// is secret. The studio must be served at http://localhost:8099/ (frame-studio/).
//   node .github/scripts/frame-showcase.mjs <out> [portrait|landscape|both]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const SHAPES = { portrait: [[1181, 1772]], landscape: [[1772, 1181]], both: [[1181, 1772], [1772, 1181]] }[process.argv[3] || 'portrait'];
const S = 'https://spider-auth.devopsdevopshaim.workers.dev/hasadna-hubs';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript((s) => {
  window.HUB_SERVER = s; sessionStorage.setItem('op-splash', '1');
  localStorage.setItem('frame-session', JSON.stringify({ token: 'x'.repeat(48), role: 'admin', email: 'a@b.c', at: Date.now() })); localStorage.setItem('fs-intro-seen', '1'); localStorage.setItem('fs-frames-clean-v1', '1');
}, S);
/* the server answers the site's origin only: the page's calls go through here with that origin */
await ctx.route((u) => /hasadna-hubs/.test(u.href), async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  try {
    const r = await route.fetch({ url: S, headers: { 'content-type': 'text/plain;charset=UTF-8', origin: 'https://devopsdevopshaim-wq.github.io' }, timeout: 140000 });
    await route.fulfill({ status: r.status(), body: await r.body(), headers: { 'content-type': 'application/json', ...CORS } });
  } catch (e) { await route.fulfill({ status: 200, body: JSON.stringify({ ok: false, error: 'timeout', detail: String(e.message || e).slice(0, 200) }), headers: { 'content-type': 'application/json', ...CORS } }); }
});
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8099/studio.html?skip'); await p.waitForTimeout(3000);
await p.evaluate(() => { document.body.classList.remove('gated'); const g = document.getElementById('gate'); if (g) g.remove(); });
const save = (name, dataUrl) => fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
const report = [];

/* 1. the invitation: its art from the image AI (no letters), the words in Hebrew set on it here; a drawn one when the AI cannot */
const inv = await p.evaluate(async () => {
  const words = [['נועה & דניאל', '700 112px "Frank Ruhl Libre"', '#5B4632', 0.47], ['שמחים להזמינכם לחגוג איתנו', '400 40px Heebo', '#6E5A44', 0.56], ['את יום נישואינו', '400 40px Heebo', '#6E5A44', 0.6], ['יום חמישי · 12.12.2026', '500 38px Heebo', '#A07A3E', 0.67], ['גני הדר · ראשון לציון', '400 34px Heebo', '#6E5A44', 0.71]];
  const t0 = Date.now(); let src = '', how = 'drawn', err = '';
  const r = await FS.askServer({ action: 'image', w: 832, h: 1216, prompt: 'Create one image: a luxurious wedding invitation card, flat front view filling the whole image edge to edge, cream deckled paper texture, delicate watercolour blush roses, peonies and eucalyptus greenery cascading from the top corners and gathered at the bottom, a fine gold foil border, a large calm empty cream area in the middle, no text, no letters, no words, print quality, highly detailed. Aspect ratio portrait (832x1216). No text, no watermark.' });
  if (r && r.ok && r.image) { src = 'data:' + (r.mime || 'image/png') + ';base64,' + r.image; how = r.source + ' ' + (r.model || ''); } else err = (r && (r.error + ' ' + (r.detail || ''))) || 'none';
  const c = document.createElement('canvas'); c.width = 1000; c.height = 1400; const x = c.getContext('2d');
  if (src) { const im = await FS.loadImg(src); const s = Math.max(1000 / im.naturalWidth, 1400 / im.naturalHeight); x.drawImage(im, (1000 - im.naturalWidth * s) / 2, (1400 - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); }
  else {
    x.fillStyle = '#F6F0E4'; x.fillRect(0, 0, 1000, 1400); x.strokeStyle = '#B9935A'; x.lineWidth = 4; x.strokeRect(46, 46, 908, 1308); x.lineWidth = 1.5; x.strokeRect(62, 62, 876, 1276);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rx = 500 + Math.cos(a) * 455, ry = 700 + Math.sin(a) * 640; x.fillStyle = ['#D9A5A0', '#8FA37E', '#C9A26A', '#E7C3BC'][i % 4]; x.beginPath(); x.ellipse(rx, ry, 30, 14, a, 0, 7); x.fill(); }
  }
  await document.fonts.load('700 112px "Frank Ruhl Libre"'); await document.fonts.load('400 40px Heebo');
  x.textAlign = 'center'; x.direction = 'rtl';
  words.forEach((w) => { x.font = w[1]; x.fillStyle = w[2]; x.fillText(w[0], 500, 1400 * w[3]); });
  return { url: c.toDataURL('image/jpeg', 0.92), how, err, s: Math.round((Date.now() - t0) / 100) / 10 };
});
save('invitation.jpg', inv.url); report.push({ step: 'invitation', how: inv.how, error: inv.err, seconds: inv.s }); console.log('invitation', inv.how, inv.err, inv.s + 's');

/* 2. every design direction, one after another (the free allowance is shared; a pause between asks) */
const styles = await p.evaluate(() => FS.INV_FRAME_STYLES.map((s) => s[0]));
for (const [W, H] of SHAPES) {
  for (let i = 0; i < styles.length; i++) {
    const r = await p.evaluate(async ([i, W, H, invUrl]) => {
      const inv = await FS.loadImg(invUrl), st = FS.INV_FRAME_STYLES[i], t0 = Date.now(); let last = null;
      const ask = FS.askServer; FS.askServer = (body) => ask(body).then((a) => { last = a; return a; });
      try {
        const f = await FS.aiFrameFromInvite(inv, W, H, Object.assign({ extra: st[1] }, st[2]));
        const photo = await FS.loadImg('media/real/' + (W > H ? 'wedding-2' : 'wedding-1') + '.webp'), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), h = f.hole;
        const k = Math.max(h.w / photo.naturalWidth, h.h / photo.naturalHeight); x.drawImage(photo, h.x + (h.w - photo.naturalWidth * k) / 2, h.y + (h.h - photo.naturalHeight * k) / 2, photo.naturalWidth * k, photo.naturalHeight * k); x.drawImage(f.canvas, 0, 0);
        return { ok: true, frame: f.canvas.toDataURL('image/png'), comp: c.toDataURL('image/jpeg', 0.9), how: last && (last.source + ' ' + (last.model || '')), s: Math.round((Date.now() - t0) / 100) / 10 };
      } catch (e) { return { ok: false, err: String(e && e.message), detail: (last && String(last.detail || last.skipped || '')).slice(0, 300), s: Math.round((Date.now() - t0) / 100) / 10 }; }
      finally { FS.askServer = ask; }
    }, [i, W, H, inv.url]);
    const tag = String(i + 1).padStart(2, '0') + (W > H ? '-land' : '-port');
    if (r.ok) { save(tag + '-frame.png', r.frame); save(tag + '-photo.jpg', r.comp); }
    const row = { n: tag, style: styles[i], ok: r.ok, seconds: r.s, how: r.how || '', error: r.err || '', detail: r.detail || '' };
    report.push(row); console.log(JSON.stringify(row));
    await new Promise((ok) => setTimeout(ok, 2500));
  }
}

/* 3. a contact sheet of the frames with the photo, four in a row, with their names */
const files = fs.readdirSync(out).filter((f) => /-photo\.jpg$/.test(f)).sort();
if (files.length) {
  const sheet = await p.evaluate(async ([items]) => {
    const cols = 4, cw = 420, pad = 24, cap = 46, ims = await Promise.all(items.map((it) => FS.loadImg(it.url)));
    const rows = []; let row = [], y = pad, H = pad;
    ims.forEach((im, i) => { row.push(i); if (row.length === cols || i === ims.length - 1) { rows.push(row); row = []; } });
    const rh = rows.map((r) => Math.max(...r.map((i) => cw * ims[i].naturalHeight / ims[i].naturalWidth)) + cap + pad); H += rh.reduce((a, b) => a + b, 0);
    const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#121317'; x.fillRect(0, 0, c.width, c.height);
    rows.forEach((r, ri) => { r.forEach((i, ci) => { const im = ims[i], h = cw * im.naturalHeight / im.naturalWidth, X = pad + ci * (cw + pad); x.drawImage(im, X, y, cw, h); x.fillStyle = '#E9D9B6'; x.font = '600 24px Heebo'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(items[i].name, X + cw / 2, y + h + 32); }); y += rh[ri]; });
    return c.toDataURL('image/jpeg', 0.86);
  }, [files.map((f) => ({ url: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(out, f)).toString('base64'), name: (report.find((r) => r.n === f.slice(0, -10)) || {}).style || f }))]);
  save('sheet.jpg', sheet);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log('done:', files.length, 'frames');
await b.close();
