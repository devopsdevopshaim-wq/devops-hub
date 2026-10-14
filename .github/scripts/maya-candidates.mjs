import fs from 'node:fs';
const tok = process.env.CLOUDFLARE_API_TOKEN, acc = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!tok) { console.log('no token'); process.exit(1); }
let id = acc;
if (!id) { const r = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { Authorization: 'Bearer ' + tok } }); const j = await r.json(); id = j.result && j.result[0] && j.result[0].id; }
fs.mkdirSync('portfolio/img/candidates', { recursive: true });
const base = 'Photorealistic half-body portrait photograph of a professional woman in her late thirties, wavy light-brown hair with subtle highlights, wearing a modern headset with a thin microphone, a tailored navy blazer over a white blouse and a thin gold necklace, seated at a clean modern office desk with hands relaxed on the desk, facing the camera, warm natural smile, soft window light, shallow depth of field, blurred dark navy office background with a plant, 85mm lens, natural skin texture, high detail';
let ok = 0;
for (let seed = 1; seed <= 6; seed++) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/@cf/black-forest-labs/flux-1-schnell`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: base, steps: 8, seed: seed * 7919 }) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
  const b64 = j.result && j.result.image;
  if (!b64) { console.log('seed', seed, 'failed', r.status, t.slice(0, 300)); continue; }
  fs.writeFileSync(`portfolio/img/candidates/c${seed}.jpg`, Buffer.from(b64, 'base64')); ok++; console.log('seed', seed, 'ok');
}
process.exit(ok ? 0 : 1);
