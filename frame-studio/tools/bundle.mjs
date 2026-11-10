#!/usr/bin/env node
// Bundles the studio for publishing: in a COPY of frame-studio (the deploy's /tmp/site/frame-studio), every run of
// consecutive <script src="js/…"> tags in studio.html becomes one file, and every run of consecutive local
// <link rel="stylesheet" href="css/…"> tags becomes one file, in the same order and the same place, so nothing runs or
// cascades differently: 56 scripts → 1, 17 stylesheets → 4. The files are minified with esbuild (whitespace and syntax only:
// names stay, since the scripts share globals) when it can be fetched, and are just joined when not. The bundles are named
// by their content (dist/studio-<hash>.js), so a new version is never served from an old cache, and sw.js keeps them for
// offline use. The source files are untouched; the repository's studio.html keeps the separate tags for development.
//   node frame-studio/tools/bundle.mjs <published frame-studio folder>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] || 'frame-studio');
const page = path.join(dir, 'studio.html');
let html = fs.readFileSync(page, 'utf8');
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });

const JS = /^<script src="(js\/[\w.-]+\.js)(?:\?v=\d+)?"><\/script>$/;
const CSS = /^<link rel="stylesheet" href="(css\/[\w.-]+\.css)(?:\?v=\d+)?" \/>$/;
const minify = (file, kind) => {
  const out = file + '.min';
  const r = spawnSync('npx', ['--yes', 'esbuild@0.24.0', file, '--minify-whitespace', '--minify-syntax', '--legal-comments=none', '--log-level=error', '--outfile=' + out, ...(kind === 'css' ? ['--loader:.css=css'] : [])], { encoding: 'utf8', timeout: 180000 });
  if (r.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) { fs.renameSync(out, file); return true; }
  console.log('esbuild did not run (' + String(r.stderr || r.error || '').slice(0, 160) + '); the bundle is joined, not minified');
  return false;
};
const made = [];
function bundle(lines, kind) {
  const re = kind === 'js' ? JS : CSS, out = [];
  let run = [];
  const flush = () => {
    if (run.length < 2) { out.push(...run.map((r) => r.line)); run = []; return; }
    const body = run.map((r) => {
      const src = fs.readFileSync(path.join(dir, r.file), 'utf8');
      return kind === 'js' ? '\n;/* ' + r.file + ' */\n' + src + '\n' : '\n/* ' + r.file + ' */\n' + src + '\n';
    }).join('');
    const tmp = path.join(dir, 'dist', 'tmp-' + made.length + '.' + kind);
    fs.writeFileSync(tmp, body);
    const min = minify(tmp, kind);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex').slice(0, 10);
    const name = 'dist/studio-' + made.length + '-' + hash + '.' + kind;
    fs.renameSync(tmp, path.join(dir, name));
    made.push({ name, files: run.length, kb: Math.round(fs.statSync(path.join(dir, name)).size / 1024), min });
    out.push(kind === 'js' ? `<script src="${name}"></script>` : `<link rel="stylesheet" href="${name}" />`);
    run = [];
  };
  for (const line of lines) {
    const m = re.exec(line.trim());
    if (m && fs.existsSync(path.join(dir, m[1]))) run.push({ line, file: m[1] }); else { flush(); out.push(line); }
  }
  flush();
  return out;
}
let lines = html.split('\n');
lines = bundle(lines, 'css');
lines = bundle(lines, 'js');
html = lines.join('\n');
fs.writeFileSync(page, html);
// the offline copy (sw.js) keeps the bundles too
const sw = path.join(dir, 'sw.js');
if (fs.existsSync(sw) && made.length) {
  const s = fs.readFileSync(sw, 'utf8').replace("var FILES = ['./',", "var FILES = ['./', " + made.map((m) => "'" + m.name + "'").join(', ') + ',');
  fs.writeFileSync(sw, s);
}
for (const m of made) console.log(m.name, m.files + ' files', m.kb + ' KB', m.min ? 'minified' : 'joined');
