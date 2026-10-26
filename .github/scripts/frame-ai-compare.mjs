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
const LOOKS = {
  hollywood: 'Dress the people as glamorous Hollywood stars on a red carpet with flashing cameras and velvet ropes.' + KEEP,
  gala: 'Dress the people in black-tie evening wear at a luxurious gala with chandeliers and warm light.' + KEEP,
  hero: 'Dress each person in a heroic superhero suit with a flowing cape and a bold emblem, standing proudly on a city rooftop at sunset. Original costume design, no logos, the faces uncovered and clearly visible. Like a still from a big-budget superhero movie.' + KEEP,
};
const VARIANTS = {
  'klein4b-496': { engine: 'flux', fluxModel: 'klein-4b', small },
  'dev-496': { engine: 'flux', fluxModel: 'dev', small },
  'dev-1024': { engine: 'flux', fluxModel: 'dev', small: big },
  'klein9b-1024': { engine: 'flux', fluxModel: 'klein-9b', small: big },
  'free': { engine: 'free' },
};
const report = [];
for (const [look, prompt] of Object.entries(LOOKS)) {
  for (const [v, extra] of Object.entries(VARIANTS)) {
    const t0 = Date.now();
    let r = {};
    try {
      const res = await fetch(S, { method: 'POST', headers: O, body: JSON.stringify({ action: 'restyle', prompt, image: big, mime: 'image/jpeg', w: 683, h: 1024, ...extra }) });
      r = await res.json().catch(() => ({ ok: false, error: 'http-' + res.status }));
    } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    const s = Math.round((Date.now() - t0) / 100) / 10;
    if (r.ok && r.image) fs.writeFileSync(path.join(out, `${look}-${v}.jpg`), Buffer.from(r.image, 'base64'));
    const row = { look, variant: v, ok: !!(r.ok && r.image), seconds: s, model: r.model || '', source: r.source || '', error: r.error || '', detail: String(r.detail || r.skipped || '').slice(0, 300) };
    report.push(row); console.log(JSON.stringify(row));
  }
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
