// Copies the studio site into desktop/app/devops-hub/ so main.js can serve it as
// https://devopsdevopshaim-wq.github.io/devops-hub/... from disk.
// Run from anywhere: node desktop/scripts/copy-app.mjs
import { cpSync, rmSync, mkdirSync, existsSync, statSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');
const repo = join(desktop, '..');
const out = join(desktop, 'app', 'devops-hub');

// Paths (relative to frame-studio/) left out of the bundle. Missing files fall back to the network at runtime.
const SKIP = [
  'tools',            // build scripts of the site, not used by pages
  'sitemap.xml',
  'models/selfie_multiclass_256x256.tflite',    // the fine background cut-out (16 MB): read from the web when online; offline the small one is used
  'media/promo.mp4',  // marketing videos of the business site (index/show), ~12 MB; streamed from the web if opened
  'media/explainer.mp4',
];

// Files outside frame-studio/ that its pages reference via ../portfolio/...
const PORTFOLIO = ['api.json', 'js/failover.js', 'js/track.js', 'css/mobile.css'];

rmSync(join(desktop, 'app'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const src = join(repo, 'frame-studio');
if (!existsSync(join(src, 'studio.html'))) throw new Error('frame-studio/studio.html not found at ' + src);

cpSync(src, join(out, 'frame-studio'), {
  recursive: true,
  filter: (p) => {
    const rel = relative(src, p).split(sep).join('/');
    if (!rel) return true;
    return !SKIP.some((s) => rel === s || rel.startsWith(s + '/'));
  },
});

for (const f of PORTFOLIO) {
  const from = join(repo, 'portfolio', f);
  if (!existsSync(from)) { console.warn('warning: missing portfolio/' + f + ' (pages will fall back to the network)'); continue; }
  mkdirSync(dirname(join(out, 'portfolio', f)), { recursive: true });
  cpSync(from, join(out, 'portfolio', f));
}

// Record what was bundled (version of the site) for diagnostics.
let siteVersion = '';
try { siteVersion = JSON.parse(readFileSync(join(src, 'version.json'), 'utf8')).v || ''; } catch { /* optional */ }
writeFileSync(join(desktop, 'app', 'bundle.json'), JSON.stringify({ siteVersion, builtAt: new Date().toISOString() }, null, 1));

let files = 0, bytes = 0;
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n), s = statSync(p);
    if (s.isDirectory()) walk(p); else { files++; bytes += s.size; }
  }
})(out);
console.log(`copied ${files} files, ${(bytes / 1048576).toFixed(1)} MB into ${relative(repo, out)} (site version ${siteVersion || '?'})`);
