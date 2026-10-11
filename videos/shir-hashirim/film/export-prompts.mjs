#!/usr/bin/env node
// Writes film/prompts.json: every shot to make (file, prompt, negative prompt) for a generator that runs outside this repo,
// such as local/wan_generate.py on your own computer. CLIP_SECONDS=5 for Wan (its clips are about 5 seconds).
import fs from 'node:fs';
import path from 'node:path';
import { chapters, timeline, clipPath, takePrompt, project, here } from './common.mjs';
import { NEGATIVE } from './shots.mjs';

const shots = [];
for (const ch of chapters) for (const s of timeline(ch).slots) for (let k = 0; k < s.takes; k++) {
  shots.push({
    file: path.relative(here, clipPath(ch.n, s.i, k)),
    // Wan makes no sound: the audio sentence is dropped
    prompt: takePrompt(ch.n, s.i, k).replace(/\s*Audio:.*$/, ''),
    negative: NEGATIVE
  });
}
fs.writeFileSync(path.join(here, 'prompts.json'), JSON.stringify(shots, null, 1) + '\n');
console.log(`film/prompts.json: ${shots.length} shots`);
