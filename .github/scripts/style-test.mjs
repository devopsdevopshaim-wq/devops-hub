// A real look at one AI style on the live server: the studio's own prompt (frame-studio/js/styles.js) on a few photos,
// the way the studio sends a restyle (the photo under 512 px, w/h for the output). Pictures go to out/.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ID = process.env.STYLE || 'big-head', SITE = 'https://devopsdevopshaim-wq.github.io';
const src = fs.readFileSync('frame-studio/js/styles.js', 'utf8');
const m = new RegExp("\\['" + ID + "', '[^']*', '[^']*', '((?:[^'\\\\]|\\\\.)*)'\\]").exec(src);
if (!m) throw new Error('style not found');
const prompt = m[1];
fs.mkdirSync('out', { recursive: true });
for (const f of (process.env.PHOTOS || 'frame-studio/media/real/barmitzvah-1.webp,frame-studio/media/real/birthday-2.webp').split(',')) {
  const name = f.split('/').pop().replace(/\.\w+$/, '');
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${f}').convert('RGB'); im.thumbnail((512,512)); im.save('out/${name}-in.jpg', quality=88); print(im.size)`]);
  const img = fs.readFileSync(`out/${name}-in.jpg`).toString('base64');
  const t = Date.now();
  const r = await fetch('https://spider-auth.devopsdevopshaim.workers.dev/hasadna-hubs', { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'restyle', prompt, image: img, mime: 'image/jpeg', w: 1024, h: 768 }) });
  const j = await r.json().catch(() => ({}));
  console.log(name, r.status, j.ok ? 'ok ' + j.source + ' ' + j.model : j.error + ' ' + String(j.detail || '').slice(0, 200), Math.round((Date.now() - t) / 1000) + 's');
  if (j.ok) fs.writeFileSync(`out/${name}-${ID}.${/png/.test(j.mime) ? 'png' : 'jpg'}`, Buffer.from(j.image, 'base64'));
}
