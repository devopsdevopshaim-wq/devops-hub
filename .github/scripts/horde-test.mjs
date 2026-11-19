// A real AI Horde run of the hubs server's last free fallback (the same code as the live server), with the anonymous key unless
// AI_HORDE_KEY is set: FLUX "out of allowance", no Pollinations key, so only AI Horde can answer. Writes the picture for a look.
import fs from 'node:fs';
import { run, workflow, nodeCode } from '../../n8n/test/harness.mjs';
const code0 = nodeCode(workflow('hasadna-hubs.json'), 'Hubs · Serve');
globalThis.__WAI = { run: async () => { throw new Error('4006: daily free allocation of 10,000 neurons (test)'); } };
const key = process.env.AI_HORDE_KEY || '0000000000';
const code = 'const ENV = { AI: globalThis.__WAI, AI_HORDE_KEY: ' + JSON.stringify(key) + ' };\n' + code0;
const photo = fs.readFileSync('frame-studio/media/demo/couple.jpg').toString('base64');
fs.mkdirSync('horde-out', { recursive: true });
for (const [name, prompt] of [['anime', 'anime style illustration of the same people, same faces, same poses, studio ghibli colors'], ['pixar', '3d animated movie style of the same people, same faces, same poses, soft cinematic light']]) {
  const t = Date.now();
  const r = (await run(code, { json: { body: JSON.stringify({ action: 'restyle', prompt, image: photo, mime: 'image/jpeg', w: 1024, h: 768, engine: 'horde' }), headers: { 'x-forwarded-for': '1.2.3.' + name.length, origin: 'https://devopsdevopshaim-wq.github.io' } }, sd: {} }))[0].json;
  const s = Math.round((Date.now() - t) / 1000);
  console.log(name, '→', r.code, r.body.ok ? 'ok ' + r.body.model + ' ' + r.body.mime : r.body.error + ' ' + String(r.body.detail || '').slice(0, 300), s + 's', key === '0000000000' ? '(anonymous)' : '(key)');
  if (r.body.ok) fs.writeFileSync('horde-out/' + name + '.' + (r.body.mime === 'image/png' ? 'png' : r.body.mime === 'image/jpeg' ? 'jpg' : 'webp'), Buffer.from(r.body.image, 'base64'));
}
