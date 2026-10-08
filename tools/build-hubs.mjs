#!/usr/bin/env node
// Makes the five standalone sites (finance-hub, marketing-hub, aia-studio, wellness-hub, torah-hub) self-contained.
//
// They were thin shells that loaded their styles, scripts and data from the full system (a Render app that sleeps), and
// called its server. This script copies what each site needs from a checkout of the full system into the site's own
// folder, rewrites the absolute addresses, and adds the browser runtime that answers the server calls
// (tools/hubs/runtime.js). Run it again after the full system changes:
//
//     node tools/build-hubs.mjs /path/to/magnet-studio
//
// Only files the browser already receives are copied (public/, data/ json files and the server modules that compute
// answers). No keys, no accounts, no private data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const src = path.resolve(process.argv[2] || '');
if (!src || !fs.existsSync(path.join(src, 'public', 'js'))) {
  console.error('usage: node tools/build-hubs.mjs /path/to/magnet-studio');
  process.exit(1);
}
const HEBCAL = process.env.HEBCAL_BUNDLE || path.join(here, 'hubs', 'hebcal-core.mjs');

const HUBS = {
  'finance-hub': {
    pages: ['index.html'], css: ['finance.css', 'style.css', 'tab-themes.css'], js: ['finance.js', 'pnks-core.js'],
    libs: ['financeAdvisor', 'marketData'], data: []
  },
  'marketing-hub': {
    pages: ['index.html'], css: ['marketing.css', 'style.css', 'tab-themes.css'], js: ['marketing.js'],
    libs: ['adStudio'], data: []
  },
  'aia-studio': {
    pages: ['index.html'], css: ['aia.css', 'style.css', 'tab-themes.css'], js: ['aia.js'],
    libs: [], data: [], aia: true
  },
  'wellness-hub': {
    pages: ['index.html', 'fitness.html'], css: ['health.css', 'fitness.css', 'style.css', 'tab-themes.css'], js: ['health.js', 'fitness.js', 'exercise-figures.js'],
    libs: ['healthAdvisor'], data: ['exercises.json']
  },
  'torah-hub': {
    pages: ['index.html', 'holidays.html', 'library.html'], css: ['style.css', 'torah-theme.css', 'torah.css', 'holidays.css', 'library.css', 'tab-themes.css'],
    js: ['pnks-core.js', 'torah.js', 'holidays.js', 'library.js'],
    libs: ['sefariaLibrary', 'holidayHalacha', 'holidayResources', 'holidayStories', 'shabbatClient'],
    data: ['holiday-resources.json', 'holiday-stories.json'], library: true, hebcal: true
  }
};
// where a link to another page of the full system goes now
const LINKS = {
  '/aia.html': '../aia-studio/', '/finance.html': '../finance-hub/', '/marketing.html': '../marketing-hub/',
  '/health.html': '../wellness-hub/', '/fitness.html': '../wellness-hub/fitness.html', '/torah.html': '../torah-hub/',
  '/holidays.html': '../torah-hub/holidays.html', '/library.html': '../torah-hub/library.html'
};

const read = (p) => fs.readFileSync(p, 'utf8');
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const copy = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };

// the root-relative addresses of this site's own files become relative to the site
function rel(s) {
  return s.replace(/(["'`(=])\/(css|js|library|icons|data|vendor|img)\//g, '$1$2/');
}
function links(s, hub) {
  return s.replace(/(["'`])(\/(?:aia|finance|marketing|health|fitness|torah|holidays|library)\.html)(?=[#?"'`])/g, (m, q, p) => {
    let to = LINKS[p];
    // inside the same site the pages sit next to each other
    if (to.startsWith('../' + hub + '/')) to = to.slice(('../' + hub + '/').length) || 'index.html';
    else if (to === '../' + hub + '/') to = 'index.html';
    return q + to;
  });
}

function page(file, hub) {
  let s = read(file);
  s = s.replace(/<base href="[^"]*"\s*\/?>\s*/g, '');
  // the shim that sent the full system's cookie with cross-site calls, and the anchor fix that the <base> needed
  s = s.replace(/<script>\s*\/\/ שולח את עוגיית ההתחברות[\s\S]*?<\/script>\s*/, '');
  s = rel(s);
  s = links(s, hub);
  s = s.replace(/<script src="\/?js\/pnks-offline\.js"><\/script>\s*/g, '');
  // the runtime goes first, so it is there before any script calls the server
  if (!/hub\/runtime\.js/.test(s)) s = s.replace(/(<meta name="viewport"[^>]*>)/, '$1\n<script src="hub/runtime.js"></script>');
  // the bar at the top: this is a site of its own now
  s = s.replace(/ · חלק ממערכת HKDAILY/g, '');
  s = s.replace(/<a href="https:\/\/hapinkas-hayomi\.onrender\.com\/?"[^>]*>למערכת המלאה ←<\/a>/g, '<a href="../portfolio/">כל האתרים שלי ←</a>');
  // the sync to the business calendar belongs to the full system
  s = s.replace(/\s*<button class="btn ghost" id="hol-sync">[^<]*<\/button>/, '');
  return s;
}

function stripNotUsed(s) { return s; }

function build(hub, cfg) {
  const out = path.join(repo, hub);
  const site = path.join(repo, hub);                       // the existing pages (the shells) are the starting point
  for (const f of cfg.pages) put(path.join(out, f), page(path.join(site, f), hub));
  for (const f of cfg.css) put(path.join(out, 'css', f), read(path.join(src, 'public', 'css', f)));
  for (const f of cfg.js) {
    let s = rel(links(read(path.join(src, 'public', 'js', f)), hub));
    s = s.replace('$("hol-sync").addEventListener(', '($("hol-sync") || { addEventListener() {} }).addEventListener(');
    if (f === 'pnks-core.js') s = s.replace(/setTimeout\(function \(\) \{\s*if \(!window\.PNKS\.__offline[\s\S]*?\}, 0\);/, '');   // the offline engine belongs to the full system
    put(path.join(out, 'js', f), s);
  }
  const manifest = { data: cfg.data, library: {} };
  for (const f of cfg.data) copy(path.join(src, 'data', f), path.join(out, 'data', f));
  if (cfg.library) {
    const dir = path.join(src, 'public', 'library');
    for (const f of fs.readdirSync(dir)) {
      let b = fs.readFileSync(path.join(dir, f));
      if (/\.(html|js|css)$/.test(f)) b = Buffer.from(rel(links(b.toString('utf8'), hub)));
      fs.mkdirSync(path.join(out, 'library'), { recursive: true });
      fs.writeFileSync(path.join(out, 'library', f), b);
      manifest.library[f] = b.length;
    }
  }
  // the server modules, unchanged
  fs.rmSync(path.join(out, 'hub'), { recursive: true, force: true });
  for (const l of cfg.libs) copy(path.join(src, 'lib', l + '.js'), path.join(out, 'hub', 'lib', l + '.js'));
  if (cfg.aia) {
    const a = read(path.join(src, 'lib', 'aiaStudio.js'));
    const from = a.indexOf('  const TYPE_HE = {'), to = a.indexOf('  // ---------- API ----------');
    const md = a.indexOf('  // המרת חבילה ל-Markdown להורדה'), mdEnd = a.indexOf('  return {\n    createProject');
    if (from < 0 || to < 0 || md < 0 || mdEnd < 0) throw new Error('aiaStudio.js changed: update tools/build-hubs.mjs');
    const t = read(path.join(here, 'hubs', 'aiaBrowser.template.js'))
      .replace('/*__FROM_SERVER__*/', a.slice(from, to)).replace('/*__MARKDOWN__*/', a.slice(md, mdEnd));
    put(path.join(out, 'hub', 'lib', 'aiaBrowser.js'), t);
  }
  if (cfg.hebcal) copy(HEBCAL, path.join(out, 'hub', 'hebcal-core.mjs'));
  put(path.join(out, 'hub', 'manifest.json'), JSON.stringify(manifest));
  copy(path.join(here, 'hubs', 'runtime.js'), path.join(out, 'hub', 'runtime.js'));
  console.log(hub, '→', cfg.pages.length, 'pages,', cfg.css.length, 'css,', cfg.js.length, 'js,', cfg.libs.length + (cfg.aia ? 1 : 0), 'modules');
}

for (const [hub, cfg] of Object.entries(HUBS)) build(hub, cfg);
