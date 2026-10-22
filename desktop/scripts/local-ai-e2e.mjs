// End-to-end check of the local AI engine (local-ai.js) on a real machine: install stable-diffusion.cpp and
// FLUX.2 klein 4B from the real GitHub / Hugging Face, then run a few of the studio's own AI designs on a real photo.
// Run by .github/workflows/local-ai-e2e.yml (Windows runner, CPU build). Writes <out>/<id>.png and <out>/results.json.
//   node scripts/local-ai-e2e.mjs <root> <out> <photo.jpg|png> [ids]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createEngine } = require('../local-ai.js');
const [root, out, photo, idList] = process.argv.slice(2);
const ids = (idList || '3d,anime,oil,royal').split(',');
fs.mkdirSync(out, { recursive: true });

// the prompts exactly as the studio sends them (FS.AI_STYLES + KEEP in frame-studio/js/styles.js)
const src = fs.readFileSync(new URL('../../frame-studio/js/styles.js', import.meta.url), 'utf8');
const unq = (s) => s.replace(/\\'/g, "'");
const keep = unq(/var KEEP = '((?:[^'\\]|\\.)*)';/.exec(src)[1]);
const prompt = (id) => { const m = new RegExp("\\['" + id + "', '[^']*', '[^']*', '((?:[^'\\\\]|\\\\.)*)'\\]").exec(src); return m && unq(m[1]) + keep; };

const results = { started: new Date().toISOString(), cpu: os.cpus()[0].model, cores: os.cpus().length, ramGB: Math.round(os.totalmem() / 2 ** 30), runs: [] };
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const engine = createEngine({ root, log: (m) => console.log('[engine]', m), timeoutMs: 40 * 60 * 1000 });

let t0 = Date.now(), lastPct = -1;
try {
  const st = await engine.install((p) => {
    const pct = p.total ? Math.floor((p.done / p.total) * 100) : 0;
    if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; console.log('install', p.phase, pct + '%', Math.round(p.done / 1e6) + '/' + Math.round(p.total / 1e6) + ' MB'); }
  }, { variant: 'cpu' });
  results.install = { ms: Date.now() - t0, state: st && st.state, status: engine.status() };
} catch (e) {
  results.install = { ms: Date.now() - t0, error: String(e && e.message || e), status: engine.status() };
  save(); console.error('install failed', e); process.exit(1);
}
console.log('installed in', Math.round(results.install.ms / 1000), 's', JSON.stringify(results.install.status.files));
save();

const image = fs.readFileSync(photo).toString('base64');
for (const id of ids) {
  const p = prompt(id);
  if (!p) { results.runs.push({ id, error: 'no such style' }); continue; }
  t0 = Date.now();
  const r = await engine.run({ mode: 'restyle', prompt: p, imageB64: image, w: 512, h: 768, seed: 7 }, (q) => { if (q && q.pct) process.stdout.write('\r' + id + ' ' + q.pct + '%   '); });
  const ms = Date.now() - t0;
  console.log('\n' + id, r.ok ? 'ok' : 'FAILED', Math.round(ms / 1000) + 's', r.ok ? '' : (r.error + ' ' + (r.detail || '')));
  if (r.ok) fs.writeFileSync(path.join(out, id + '.png'), Buffer.from(r.image, 'base64'));
  results.runs.push({ id, ok: !!r.ok, ms, error: r.ok ? undefined : r.error, detail: r.ok ? undefined : String(r.detail || '').slice(-1500) });
  save();
}
results.finished = new Date().toISOString();
save();
if (!results.runs.some((r) => r.ok)) process.exit(1);
