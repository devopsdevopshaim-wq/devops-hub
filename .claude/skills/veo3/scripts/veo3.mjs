#!/usr/bin/env node
// Renders one Veo 3 clip through the Gemini API: start the job, wait for it, save the MP4.
// Key: GEMINI_API_KEY (or GOOGLE_API_KEY). Usage: see ../SKILL.md
import fs from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!args.prompt) { console.error('missing --prompt'); process.exit(2); }
if (!key) { console.error('GEMINI_API_KEY is not set: paste the prompt into Gemini / Flow instead'); process.exit(2); }

const API = 'https://generativelanguage.googleapis.com/v1beta';
const model = args.model || 'veo-3.0-generate-001';
const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };

const instance = { prompt: args.prompt };
if (args.image) {
  const mimeType = /\.png$/i.test(args.image) ? 'image/png' : 'image/jpeg';
  instance.image = { bytesBase64Encoded: fs.readFileSync(args.image).toString('base64'), mimeType };
}
const parameters = { aspectRatio: args.aspect || '16:9' };
if (args.resolution) parameters.resolution = args.resolution;
if (args.negative) parameters.negativePrompt = args.negative;

const start = await fetch(`${API}/models/${model}:predictLongRunning`, { method: 'POST', headers, body: JSON.stringify({ instances: [instance], parameters }) });
let op = await start.json();
if (!start.ok) { console.error(start.status, JSON.stringify(op.error || op)); process.exit(1); }
console.error('job:', op.name);

const until = Date.now() + 15 * 60 * 1000;
while (!op.done) {
  if (Date.now() > until) { console.error('timed out, job:', op.name); process.exit(1); }
  await new Promise((r) => setTimeout(r, 10000));
  const r = await fetch(`${API}/${op.name}`, { headers });
  op = await r.json();
  if (!r.ok) { console.error(r.status, JSON.stringify(op.error || op)); process.exit(1); }
  process.stderr.write('.');
}
if (op.error) { console.error('\n' + JSON.stringify(op.error)); process.exit(1); }

const samples = op.response?.generateVideoResponse?.generatedSamples || [];
if (!samples.length) { console.error('\nno video returned (blocked by the safety filter?):', JSON.stringify(op.response)); process.exit(1); }
const out = args.out || `veo3-${Date.now()}.mp4`;
const vid = await fetch(samples[0].video.uri, { headers: { 'x-goog-api-key': key } });
if (!vid.ok) { console.error('download failed', vid.status); process.exit(1); }
fs.writeFileSync(out, Buffer.from(await vid.arrayBuffer()));
console.log(out);
