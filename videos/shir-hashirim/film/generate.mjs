#!/usr/bin/env node
// Generates the film clips with Veo 3 (one or two 8-second takes per verse) into film/clips/chapter-N/.
// Skips clips that already exist, so it can be stopped and run again.
//   node film/generate.mjs --dry-run                 how many clips, how many seconds, and an estimated cost
//   node film/generate.mjs --chapter 1 [--limit 3]   generate (needs GEMINI_API_KEY)
//   options: --model veo-3.0-fast-generate-001 · --price 0.4 (dollars per second, for the estimate)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chapters, timeline, clipPath, takePrompt, project, CLIP } from './common.mjs';
import { NEGATIVE } from './shots.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
const only = args.chapter ? [Number(args.chapter)] : chapters.map((c) => c.n);
const jobs = [];
for (const ch of chapters.filter((c) => only.includes(c.n))) {
  for (const s of timeline(ch).slots) for (let k = 0; k < s.takes; k++) jobs.push({ n: ch.n, i: s.i, k, file: clipPath(ch.n, s.i, k) });
}
const todo = jobs.filter((j) => !fs.existsSync(j.file));
const price = Number(args.price || 0.4);
console.log(`${jobs.length} clips (${jobs.length * CLIP}s), ${todo.length} still to make: about $${Math.round(todo.length * CLIP * price)} at $${price}/s (check the current Veo price)`);
if (args['dry-run']) process.exit(0);
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(2); }

const veo = path.join(project, '..', '..', '.claude', 'skills', 'veo3', 'scripts', 'veo3.mjs');
let done = 0;
for (const j of todo.slice(0, args.limit ? Number(args.limit) : undefined)) {
  fs.mkdirSync(path.dirname(j.file), { recursive: true });
  console.log(`chapter ${j.n} verse ${j.i + 1}${'ab'[j.k]} …`);
  const r = spawnSync('node', [veo, '--prompt', takePrompt(j.n, j.i, j.k), '--aspect', '16:9', '--resolution', '1080p', '--negative', NEGATIVE,
    ...(args.model ? ['--model', args.model] : []), '--out', j.file], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`failed: chapter ${j.n} verse ${j.i + 1}${'ab'[j.k]}, stopping (run again to continue)`); process.exit(1); }
  done++;
}
console.log(`made ${done} clips`);
