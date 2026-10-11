#!/usr/bin/env node
// Renders one Hailuo clip through the MiniMax API: start the job, wait for it, save the MP4.
// Key: MINIMAX_API_KEY. Usage: see ../SKILL.md
import fs from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
const key = process.env.MINIMAX_API_KEY;
if (!args.prompt) { console.error('missing --prompt'); process.exit(2); }
if (!key) { console.error('MINIMAX_API_KEY is not set: paste the prompt into hailuoai.video instead'); process.exit(2); }

const API = (args.host || 'https://api.minimax.io') + '/v1';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const fail = (msg, body) => { console.error(msg, body ? JSON.stringify(body) : ''); process.exit(1); };
const ok = (j) => !j.base_resp || j.base_resp.status_code === 0;

const body = {
  model: args.model || 'MiniMax-Hailuo-02',
  prompt: args.prompt,
  duration: Number(args.duration || 6),
  resolution: args.resolution || '768P',
  prompt_optimizer: !args['no-optimizer']
};
if (args.image) {
  const mime = /\.png$/i.test(args.image) ? 'image/png' : 'image/jpeg';
  body.first_frame_image = `data:${mime};base64,` + fs.readFileSync(args.image).toString('base64');
}

const start = await fetch(`${API}/video_generation`, { method: 'POST', headers, body: JSON.stringify(body) });
const job = await start.json();
if (!start.ok || !ok(job) || !job.task_id) fail(`start failed (${start.status})`, job);
console.error('task:', job.task_id);

let fileId;
const until = Date.now() + 20 * 60 * 1000;
while (!fileId) {
  if (Date.now() > until) fail('timed out, task: ' + job.task_id);
  await new Promise((r) => setTimeout(r, 10000));
  const r = await fetch(`${API}/query/video_generation?task_id=${encodeURIComponent(job.task_id)}`, { headers });
  const q = await r.json();
  if (!r.ok || !ok(q)) fail(`query failed (${r.status})`, q);
  if (q.status === 'Fail') fail('\nrender failed', q);
  if (q.status === 'Success') fileId = q.file_id;
  else process.stderr.write('.');
}

const fr = await fetch(`${API}/files/retrieve?file_id=${encodeURIComponent(fileId)}`, { headers });
const f = await fr.json();
const url = f.file && f.file.download_url;
if (!fr.ok || !url) fail('\nno download url', f);
const vid = await fetch(url);
if (!vid.ok) fail('download failed ' + vid.status);
const out = args.out || `hailuo-${Date.now()}.mp4`;
fs.writeFileSync(out, Buffer.from(await vid.arrayBuffer()));
console.log(out);
