// Realistic event photos for the business site, the designer and the studio's sample, instead of the drawn figures.
// Run by .github/workflows/frame-studio-photos.yml (it has the internet; Pollinations' FLUX, with POLLINATIONS_TOKEN when set).
// Writes frame-studio/media/real/<event>-<n>.webp (portrait, 900x1350) and js/real-photos.js (FS.REAL_PHOTOS).
// These are AI-generated people, not customers: the site says so in its footer note. Real event photos can replace them
// one for one (same file names).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'media', 'real');
const LOOK = 'Israeli people with Mediterranean and Middle Eastern features, candid professional event photography, photorealistic, natural imperfect skin, real documentary photo, natural skin texture, real people, warm evening light, 50mm lens, shallow depth of field, soft bokeh lights in the background, sharp focus on faces, Canon EOS R5, no text, no watermark, no logo';
const SHOTS = {
  wedding: [
    'an Israeli bride in a white gown and a groom in a navy suit laughing and hugging at their outdoor wedding reception',
    'a happy young couple at their wedding dancing close, the bride holding the groom, string lights above',
    'a bride and groom posing cheek to cheek, smiling at the camera, at an elegant wedding hall'
  ],
  barmitzvah: [
    'a 13 year old boy wearing a kippah and a suit, smiling proudly with his parents at his bar mitzvah party',
    'a teenage boy at his bar mitzvah celebration lifted joyfully by friends, festive hall',
    'a 12 year old girl in a pastel dress at her bat mitzvah party, smiling with her mother'
  ],
  brit: [
    'young parents holding their newborn baby wrapped in a white blanket at a family celebration, grandparents smiling',
    'a smiling mother holding her baby girl at the baby naming celebration, flowers around',
    'a proud father kissing his newborn son on the forehead at a family event'
  ],
  birthday: [
    'a woman celebrating her 30th birthday, blowing candles on a cake with friends cheering',
    'friends laughing together at a birthday party with balloons and confetti',
    'a little girl at her birthday party wearing a party crown, smiling in front of a cake'
  ],
  henna: [
    'a bride and groom at a moroccan henna ceremony in traditional red and gold embroidered clothes, smiling',
    'a smiling bride in a golden traditional henna dress and headpiece at a henna celebration',
    'family dancing joyfully at a traditional henna celebration, colorful lanterns'
  ],
  company: [
    'colleagues laughing together at a company year end party, holding drinks, modern venue',
    'two smiling coworkers posing for a photo at a corporate event, branded backdrop blurred',
    'a group of friendly employees taking a group photo at a company celebration'
  ],
  engagement: [
    'a young couple just engaged, the woman showing her ring and laughing, the man hugging her, golden hour',
    'an engaged couple smiling at each other at their engagement party, fairy lights'
  ],
  holiday: [
    'a smiling family of four around a festive holiday dinner table with candles',
    'grandparents and grandchildren smiling together at a family holiday gathering, warm light'
  ]
};
const TOKEN = process.env.POLLINATIONS_TOKEN || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the site's own server first: its image chain (Gemini, OpenAI, FLUX on Cloudflare) gives real-looking people with no watermark
const HUB = 'https://spider-auth.devopsdevopshaim.workers.dev/hasadna-hubs';
async function viaServer(prompt) {
  const r = await fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Origin: 'https://devopsdevopshaim-wq.github.io' },
    body: JSON.stringify({ action: 'image', prompt: 'Create one image: ' + prompt + ', ' + LOOK + '. Portrait orientation (832x1248). No text, no watermark.', w: 832, h: 1248 }), signal: AbortSignal.timeout(150000) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok || !j.image) throw new Error('server: ' + (j.error || r.status) + ' ' + String(j.detail || '').slice(0, 120));
  console.log('  via', j.source || 'server', j.model || '');
  return Buffer.from(j.image, 'base64');
}
async function one(prompt, seed) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { const b = await viaServer(prompt); if (b.length > 20000) return { buf: b, mark: false }; throw new Error('too small'); }
    catch (e) { console.log('  server', attempt, e.message); await sleep(5000 * attempt); }
  }
  return { buf: await pollinations(prompt, seed), mark: true };
}
async function pollinations(prompt, seed) {
  const q = new URLSearchParams({ width: '832', height: '1248', model: 'flux', nologo: 'true', seed: String(seed), enhance: 'false', private: 'true' });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', ' + LOOK) + '?' + q, { headers: TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}, signal: AbortSignal.timeout(180000) });
      if (!r.ok) throw new Error('http ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 20000) throw new Error('too small');
      return buf;
    } catch (e) { console.log('  retry', attempt, e.message); await sleep(8000 * attempt); }
  }
  throw new Error('failed: ' + prompt.slice(0, 60));
}
mkdirSync(OUT, { recursive: true });
const manifest = {};
let seed = 4100;
for (const [type, list] of Object.entries(SHOTS)) {
  manifest[type] = [];
  for (let i = 0; i < list.length; i++) {
    const name = `${type}-${i + 1}.webp`;
    console.log(name);
    const got = await one(list[i], seed++);
    let img = sharp(got.buf);
    if (got.mark) { const m = await img.metadata(); img = sharp(got.buf).extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * 0.93) }); }   /* the free service's corner mark */
    await img.resize(900, 1350, { fit: 'cover', position: 'attention' }).webp({ quality: 84 }).toFile(join(OUT, name));
    manifest[type].push('media/real/' + name);
    await sleep(3000);
  }
}
writeFileSync(join(ROOT, 'js', 'real-photos.js'),
  '/* Realistic sample photos per event type (AI-generated people, made by tools/real-photos.mjs). Used instead of the drawn figures\n' +
  '   by the business site, the designer and the studio\'s sample photo. Replace any file with a real photo of the same name. */\n' +
  'window.FS = window.FS || {};\nwindow.FS.REAL_PHOTOS = ' + JSON.stringify(manifest, null, 1) + ';\n');
console.log('done', Object.values(manifest).flat().length);
