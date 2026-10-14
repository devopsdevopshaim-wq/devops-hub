import fs from 'node:fs';
import crypto from 'node:crypto';
const combined = [process.env.SPIDER].filter(Boolean).join('\n');
const KEY = (process.env.N8N_API_KEY || (combined.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) || [])[0] || '').trim();
const SHARED = KEY ? crypto.createHmac('sha256', KEY).update('spider-shared-v1').digest('hex') : '';
const API = JSON.parse(fs.readFileSync('portfolio/api.json', 'utf8')).base;
if (!SHARED) { console.log('no shared key'); process.exit(1); }
fs.mkdirSync('portfolio/img/candidates', { recursive: true });
const base = 'Photorealistic half-body portrait photograph of a professional woman in her late thirties, wavy light-brown hair with subtle highlights, wearing a modern headset with a thin microphone, a tailored navy blazer over a white blouse and a thin gold necklace, seated at a clean modern office desk with hands relaxed on the desk, facing the camera, warm natural smile, soft window light, shallow depth of field, blurred dark navy office background with a plant, 85mm lens, natural skin texture, high detail';
let ok = 0;
for (let seed = 1; seed <= 6; seed++) {
  const r = await fetch(API + '/maya-gen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: SHARED, prompt: base, seed: seed * 7919 }) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
  const b64 = j.image;
  if (!b64) { console.log('seed', seed, 'failed', r.status, t.slice(0, 300)); continue; }
  fs.writeFileSync(`portfolio/img/candidates/c${seed}.jpg`, Buffer.from(b64, 'base64')); ok++; console.log('seed', seed, 'ok');
}
process.exit(ok ? 0 : 1);
