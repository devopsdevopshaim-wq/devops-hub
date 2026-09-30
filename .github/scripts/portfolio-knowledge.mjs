// Builds portfolio/knowledge.json: what Guy's n8n agent knows about every
// project beyond the one-line description. For each project with a public repo
// it reads the code (a shallow clone) and extracts screens, actions,
// libraries, storage and automation signals.
// Usage: node .github/scripts/portfolio-knowledge.mjs [clonesDir]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/projects.json'), 'utf8'));
const clones = path.resolve(process.argv[2] || '/tmp/portfolio-clones');
fs.mkdirSync(clones, { recursive: true });

// Sites that live inside this repo rather than in their own.
const LOCAL = { 'vacation-hub': 'vacation-hub', 'book-studio': 'book-studio' };

const SIGNALS = [
  [/^dockerfile$/i, 'file', 'אפשר להריץ אותו בקונטיינר Docker (יש Dockerfile)'],
  [/^docker-compose\.ya?ml$/i, 'file', 'מוגדר להרצה עם docker-compose'],
  [/^nginx\.conf$/i, 'file', 'יש הגדרת Nginx כשרת אינטרנט'],
  [/\.sh$/i, 'file', 'יש סקריפט התקנה או הפעלה אוטומטי (shell)'],
  [/^server\.(py|js|mjs)$/i, 'file', 'יש שרת צד־שרת משלו'],
  [/^requirements\.txt$/i, 'file', 'שרת Python עם תלויות מוגדרות'],
  [/^package\.json$/i, 'file', 'פרויקט Node.js עם תלויות מוגדרות'],
  [/^\.github\/workflows\//i, 'file', 'יש GitHub Actions שרצים אוטומטית'],
  [/\/webhook(-test)?\/|n8n\.cloud|localhost:5678/, 'code', 'שולח בקשות ל־Webhook של n8n, שמפעיל תהליכים אוטומטיים'],
  [/setInterval\(/, 'code', 'מריץ פעולות מתוזמנות בדפדפן (setInterval)'],
  [/new Notification\(|Notification\.requestPermission/, 'code', 'שולח התראות דפדפן'],
  [/XLSX\.|SheetJS/, 'code', 'ייבוא וייצוא אוטומטי של קבצי Excel'],
  [/Papa\.parse|PapaParse/, 'code', 'קריאת קבצי CSV אוטומטית'],
  [/jsPDF|html2canvas/, 'code', 'הפקת דוחות PDF אוטומטית'],
  [/speechSynthesis/, 'code', 'הקראה בקול (Web Speech)'],
  [/SpeechRecognition/, 'code', 'זיהוי דיבור'],
  [/Html5Qrcode|html5-qrcode/, 'code', 'סריקת ברקוד ו־QR במצלמה'],
  [/localStorage/, 'code', 'שומר נתונים בדפדפן (localStorage) בלי שרת'],
  [/indexedDB/, 'code', 'שומר נתונים בבסיס נתונים בדפדפן (IndexedDB)'],
  [/serviceWorker/, 'code', 'עובד גם בלי אינטרנט (Service Worker)'],
  [/api\.anthropic\.com|anthropic-version|claude-(opus|sonnet|haiku|fable)/i, 'code', 'קורא ישירות ל־Claude API של Anthropic'],
  [/hebcal/i, 'code', 'מושך זמנים ותאריכים עבריים מ־Hebcal'],
];

const text = (s) => String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const uniq = (a) => [...new Set(a.filter(Boolean))];

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === '.git' || f.name === 'node_modules' || f.name === 'vendor') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, base, out);
    else out.push({ rel: path.relative(base, p).split(path.sep).join('/'), size: fs.statSync(p).size });
  }
  return out;
}

function sourceDir(p) {
  if (LOCAL[p.id]) return path.join(ROOT, LOCAL[p.id]);
  if (!p.repo || p.private || p.repo === 'devops-hub') return null;
  const dir = path.join(clones, p.repo);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    try {
      execFileSync('git', ['clone', '-q', '--depth', '1', `https://github.com/${data.owner}/${p.repo}`, dir], { stdio: 'ignore', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
    } catch { return null; }
  }
  return dir;
}

function analyse(p, dir) {
  const files = walk(dir);
  const html = files.filter((f) => /\.html?$/i.test(f.rel));
  const code = files.filter((f) => /\.(html?|m?js|py|sh|ya?ml|json|conf)$/i.test(f.rel) && f.size < 1_500_000);
  const main = (p.start && html.find((f) => f.rel === p.start)) || html.find((f) => f.rel === 'index.html') || html[0];
  let src = '';
  for (const f of code) src += '\n' + fs.readFileSync(path.join(dir, f.rel), 'utf8');
  const page = main ? fs.readFileSync(path.join(dir, main.rel), 'utf8') : '';
  // index.html that only redirects to the real start page
  const redirect = page.match(/http-equiv="refresh"[^>]*url=([^"]+)"/i);
  const real = redirect ? fs.readFileSync(path.join(dir, decodeURIComponent(redirect[1])), 'utf8') : page;

  const headings = uniq([...real.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => text(m[1])).filter((s) => s.length > 1 && s.length < 90 && !s.includes('${'))).slice(0, 24);
  const actions = uniq([...real.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => text(m[1])).filter((s) => s.length > 1 && s.length < 40 && !/[{}+]/.test(s))).slice(0, 30);
  const libs = uniq([...src.matchAll(/src="https?:\/\/[^"]*?\/((?:npm\/)?[@\w.-]+?)(?:@[\d.]+)?\/[^"]*"/g)].map((m) => m[1].replace(/^npm\//, ''))).slice(0, 12);
  const apis = uniq([...src.matchAll(/fetch\(\s*[`'"](https?:\/\/[^/`'"]+)/g)].map((m) => m[1])).slice(0, 8);
  const functions = uniq([...src.matchAll(/function\s+([A-Za-z_]\w{3,})\s*\(/g)].map((m) => m[1])).slice(0, 40);
  const automation = uniq(SIGNALS.filter(([re, kind]) => kind === 'file' ? files.some((f) => re.test(path.basename(f.rel)) || re.test(f.rel)) : re.test(src)).map(([, , he]) => he));
  const readme = files.find((f) => /^readme\.md$/i.test(f.rel));
  const readmeText = readme ? fs.readFileSync(path.join(dir, readme.rel), 'utf8').replace(/\s+/g, ' ').slice(0, 1200) : '';

  return {
    files: files.length,
    sizeKB: Math.round(files.reduce((s, f) => s + f.size, 0) / 1024),
    versions: html.length,
    fileList: files.map((f) => f.rel).slice(0, 30),
    pageTitle: text((real.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ''),
    screens: headings,
    actions,
    libraries: libs,
    externalApis: apis,
    functions,
    automation,
    // the upload script wrote a one-line README; only real ones are useful
    readme: readmeText.length > 80 && !/^# .{0,80} Site: https:\/\/\S+ $/.test(readmeText) ? readmeText : undefined
  };
}

const projects = data.projects.map((p) => {
  const base = { id: p.id, title: p.title, field: data.categories[p.category], desc: p.desc, features: p.features, tech: p.tech, story: p.story, address: p.url || (p.repo && !p.private && !p.localhost ? `https://${data.owner}.github.io/${p.repo}/` : p.localhost || null) };
  const dir = sourceDir(p);
  if (!dir) return base;
  try { return { ...base, code: analyse(p, dir) }; } catch (e) { console.log('skip', p.id, e.message); return base; }
});

// How this portfolio itself is automated — asked about often.
const pipeline = [
  'כל פרויקט יושב במאגר GitHub משלו ומתפרסם אוטומטית ב־GitHub Pages.',
  'האתר עצמו מתפרסם מחדש אוטומטית בכל שינוי בענף main (GitHub Actions: Deploy vacation-hub to GitHub Pages).',
  'צילומי המסך של כל הפרויקטים מצולמים אוטומטית ב־GitHub Actions עם Playwright, במחשב ובטלפון, ונשמרים באתר.',
  'הוספת פרויקט: טופס "הוספת פרויקט" פותח Issue ב־GitHub; GitHub Action קורא אותו, מוסיף את הפרויקט לרשימה, מצלם אותו ומפרסם — בלי לגעת בקוד.',
  'קובץ הידע הזה נבנה מחדש אוטומטית בכל פרסום: GitHub Actions מוריד את הקוד של כל פרויקט ומחלץ ממנו מסכים, פעולות, ספריות ואוטומציות.',
  'גיא (המדריך באתר) מדבר עם סוכן AI ב־n8n Cloud: Webhook ← טעינת הידע ← בחירת הפרויקטים הרלוונטיים ← סוכן Claude עם זיכרון שיחה ← תשובה לאתר.',
  'מספר הכניסות לכל פרויקט נספר בשירות Abacus, וההמלצות נשמרות כ־Issues ב־GitHub דרך utterances.',
  'בהעלאה הראשונה, סקריפט PowerShell יצר מאגר נפרד לכל תיקייה במחשב, הפעיל Pages, ודילג על קבצים שנראים כמו מפתחות API.'
];

const out = { builtAt: new Date().toISOString(), owner: data.owner, categories: data.categories, pipeline, projects };
fs.writeFileSync(path.join(ROOT, 'portfolio/knowledge.json'), JSON.stringify(out) + '\n');
const withCode = projects.filter((p) => p.code).length;
console.log(`knowledge.json: ${projects.length} projects, ${withCode} analysed from code, ${Math.round(JSON.stringify(out).length / 1024)} KB`);
