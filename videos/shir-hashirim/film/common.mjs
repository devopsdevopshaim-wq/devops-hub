// Shared by generate.mjs and edit.mjs: the text, how long each verse stays on screen, and how many takes it needs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promptFor } from './shots.mjs';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const project = path.join(here, '..');
const text = JSON.parse(fs.readFileSync(path.join(project, '..', '..', 'torah-hub', 'library', 'shir-hashirim.json'), 'utf8'));
export const chapters = text.chapters.filter((c) => c.verses);
export const INTRO = 5, OUTRO = 5;
// the length of one generated clip: 8 s from Veo 3, about 5 s from Wan on your own computer (CLIP_SECONDS=5)
export const CLIP = Number(process.env.CLIP_SECONDS || 8);
const r2 = (x) => Math.round(x * 100) / 100;

// a calm reading pace, the same as the text videos; a recorded reading (audio/chapter-N.timing.json) replaces it
const estimate = (he) => Math.max(6, he.split(/[\s־]+/).length * 0.68 + 2);

export function timeline(ch) {
  const base = `chapter-${ch.n}`;
  const audio = ['wav', 'mp3', 'm4a'].map((x) => `audio/${base}.${x}`).find((f) => fs.existsSync(path.join(project, f)));
  const tf = path.join(project, 'audio', `${base}.timing.json`);
  const timing = audio && fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : null;
  let t = INTRO;
  const slots = ch.verses.map((v, i) => {
    let start, dur;
    if (timing) { start = INTRO + timing[i][0]; dur = (i + 1 < timing.length ? INTRO + timing[i + 1][0] : INTRO + timing[i][1] + 1.5) - start; }
    else { start = t; dur = estimate(v.he); t += dur; }
    // a clip can be slowed to about 0.65x and still look natural; a longer verse gets more takes
    const takes = Math.min(4, Math.ceil(dur / (CLIP / 0.65)));
    return { v, i, start: r2(start), dur: r2(dur), takes };
  });
  const last = slots[slots.length - 1];
  return { slots, audio, outroStart: r2(last.start + last.dur), total: r2(last.start + last.dur + OUTRO) };
}

export const clipPath = (n, i, take) => path.join(project, 'film', 'clips', `chapter-${n}`, `v${String(i + 1).padStart(2, '0')}${'abcd'[take]}.mp4`);

export function takePrompt(n, i, take) {
  const p = promptFor(n, i);
  const angle = ['', 'Second angle: a closer, slower shot continuing the same moment, different composition.',
    'Third angle: a wide shot from further away, the same moment in its landscape.', 'Fourth angle: a detail shot of hands, fabric or nature in the same moment.'][take];
  return take ? p.replace(/^[^.]*\./, angle) : p;
}
