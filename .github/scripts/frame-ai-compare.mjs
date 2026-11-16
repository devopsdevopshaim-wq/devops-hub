// Compares the picture engines on one real-looking event photo with the studio's "on the real person" looks, and writes each result
// (with its time and model) to <out>/<look>-<variant>.jpg plus report.json, for a person to look at. Nothing here is secret: it calls
// the public hubs server like the studio does.
//   node .github/scripts/frame-ai-compare.mjs <out>
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const S = 'https://spider-auth.devopsdevopshaim.workers.dev/hasadna-hubs';
const O = { Origin: 'https://devopsdevopshaim-wq.github.io', 'Content-Type': 'text/plain' };
const img = (n) => fs.readFileSync(path.join('.github/ai-compare', n)).toString('base64');
const big = img('wedding-1024.jpg'), small = img('wedding-496.jpg');
const KEEP = ' This must stay a real photograph of the very same people: identical faces, features, skin tone, age, body and expression, so their family recognises them at once. Photorealistic, natural skin texture, professional camera and lighting. No cartoon, no painting, no text, no watermark.';
// the studio's own prompts (v164 kids/fantasy, as restyleOnce sends them: look + MAGIC_KEEP + REAL_KEEP + shape + people + quality)
const MAGIC = ' Original designs only: no existing characters, films, brands or logos. Joyful, magical and fit for children, rich detail, the faces uncovered and clearly visible.';
const REAL = ' This must stay a real photograph of the very same people: identical faces, features, skin tone, age, body and expression, so their family recognises them at once. Photorealistic, natural skin texture, professional camera and lighting. Keep the same framing, camera angle and the people\'s size in the picture; change only the clothes, the look and the surroundings. No cartoon, no painting, no text, no watermark.';
const tail = (land, n) => ' The output image must have the same ' + (land ? 'landscape' : 'portrait') + ' aspect ratio.' + (n ? ' There are exactly ' + n + ' people in the photo. The result must show exactly these ' + n + ' people: do not add or remove anyone, no extra figures or faces.' : '') + ' High-end professional result: the face sharp, well lit and fully visible (never covered by a mask, hood or shadow), rich true-to-life detail, clean cinematic colour grading, like a magazine cover or a big-budget film still.';
const LOOKS = {
  portal: 'Show the people stepping out of a glowing magic portal into a new world of floating rocks and two moons.' + MAGIC + REAL,
  dragon: 'Show each person riding a majestic dragon above misty mountains and a castle at sunset, wind in their hair.' + MAGIC + REAL,
  princess: 'Dress each child as a little princess or prince in a sparkling gown or royal suit with a small crown, in a pastel fairytale palace hall with chandeliers and soft magical light.' + MAGIC + REAL
};
const land = img('land-1024.jpg');
const VARIANTS = {
  'auto-port': { image: big, w: 683, h: 1024, land: false, n: 2 },
  'auto-land': { image: land, w: 1024, h: 683, land: true, n: 2 },
  'k9b-land': { image: land, w: 1024, h: 683, land: true, n: 2, engine: 'flux', fluxModel: 'klein-9b' },
  'dev-land': { image: land, w: 1024, h: 683, land: true, n: 2, engine: 'flux', fluxModel: 'dev' },
  'free-land': { image: land, w: 1024, h: 683, land: true, n: 2, engine: 'free' },
};
const report = [];
for (const [look, prompt] of Object.entries(LOOKS)) {
  for (const [v, extra] of Object.entries(VARIANTS)) {
    const t0 = Date.now();
    let r = {};
    try {
      const { land: L, n, image, ...rest } = extra;
      const res = await fetch(S, { method: 'POST', headers: O, body: JSON.stringify({ action: 'restyle', prompt: prompt + tail(L, n), image, small: image, mime: 'image/jpeg', ...rest }) });
      r = await res.json().catch(() => ({ ok: false, error: 'http-' + res.status }));
    } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    const s = Math.round((Date.now() - t0) / 100) / 10;
    if (r.ok && r.image) fs.writeFileSync(path.join(out, `${look}-${v}.jpg`), Buffer.from(r.image, 'base64'));
    const row = { look, variant: v, ok: !!(r.ok && r.image), seconds: s, model: r.model || '', source: r.source || '', error: r.error || '', detail: String(r.detail || r.skipped || '').slice(0, 300) };
    report.push(row); console.log(JSON.stringify(row));
  }
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
