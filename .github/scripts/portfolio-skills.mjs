// Builds one Claude skill per project: <out>/<id>/SKILL.md, a <id>.zip ready to
// upload to claude.ai (Settings → Capabilities → Skills) and all-skills.zip for
// Claude Code (unzip into ~/.claude/skills). The content comes from
// portfolio/knowledge.json (what the deploy learned from each project's code),
// or from projects.json when the knowledge file is missing.
// Usage: node .github/scripts/portfolio-skills.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.resolve(process.argv[2] || 'portfolio/skills');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/projects.json'), 'utf8'));
let know = null;
try { know = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/knowledge.json'), 'utf8')); } catch {}
const byId = {};
(know ? know.projects : []).forEach((k) => { byId[k.id] = k; });

// Sites that live inside this repository rather than in their own.
const LOCAL = { 'vacation-hub': 'vacation-hub/', 'book-studio': 'book-studio/', 'electro-fix': 'electro-fix/', interior: 'interior-hub/', 'assembly-studio': 'assembly-studio/', netplan: 'netplan/', automation: 'automation/' };

const owner = data.owner;
const one = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (a, n = 12) => (a || []).filter(Boolean).slice(0, n);
const bullets = (a) => a.map((x) => `- ${x}`).join('\n');

function address(p) {
  if (p.url) return p.url;
  if (p.repo && !p.private && !p.localhost) return `https://${owner}.github.io/${p.repo}/${p.start ? encodeURIComponent(p.start) : ''}`;
  return p.localhost || '';
}

function skill(p) {
  const k = byId[p.id] || {};
  const code = k.code || {};
  const url = address(p);
  const repoUrl = p.repo && !p.private ? `https://github.com/${owner}/${p.repo}` : '';
  const field = data.categories[p.category] || '';
  const desc = one(
    `${p.title} (${p.id}) — ${one(p.desc, 300)} ` +
    `Use when the user asks about "${p.title}" or ${p.id}: what it does, how to use it, explaining it to someone, troubleshooting it, or changing and extending its code.`,
    1000
  ).replace(/"/g, '\\"');

  const parts = [
    `---\nname: ${p.id}\ndescription: "${desc}"\n---\n`,
    `# ${p.title}\n`,
    one(p.desc, 600) + '\n',
    bullets([
      url ? `כתובת: ${url}` : null,
      repoUrl ? `קוד: ${repoUrl}` : null,
      LOCAL[p.id] ? `הקוד יושב בתיקייה \`${LOCAL[p.id]}\` במאגר https://github.com/${owner}/devops-hub` : null,
      field ? `תחום: ${field}` : null,
      `עמוד הפרויקט בתיק העבודות: https://${owner}.github.io/devops-hub/portfolio/#p/${p.id}`
    ].filter(Boolean)) + '\n'
  ];

  if (list(p.features).length) parts.push(`## מה הוא יודע לעשות\n\n${bullets(list(p.features))}\n`);

  const use = [];
  if (list(code.screens).length) use.push(`מסכים וחלקים בעמוד: ${list(code.screens, 14).join(' · ')}`);
  if (list(code.actions).length) use.push(`כפתורים ופעולות: ${list(code.actions, 18).join(' · ')}`);
  if (use.length) parts.push(`## איך משתמשים\n\n${bullets(use)}\n\nכשמסבירים למישהו: מתחילים מהמסך הראשון, ומתארים את הפעולות לפי הסדר שבו הן מופיעות.\n`);

  const how = [];
  if (list(p.tech).length) how.push(`טכנולוגיות: ${list(p.tech).join(', ')}`);
  if (list(code.libraries).length) how.push(`ספריות: ${list(code.libraries).join(', ')}`);
  if (list(code.externalApis).length) how.push(`שירותים חיצוניים: ${list(code.externalApis).join(', ')}`);
  list(code.automation, 10).forEach((a) => how.push(a));
  if (code.files) how.push(`${code.files} קבצים, כ־${code.sizeKB}KB${code.versions > 1 ? `, ${code.versions} גרסאות HTML` : ''}`);
  if (how.length) parts.push(`## איך זה בנוי\n\n${bullets(how)}\n`);
  if (list(code.fileList, 20).length) parts.push(`קבצים עיקריים:\n\n${list(code.fileList, 20).map((f) => '- `' + f + '`').join('\n')}\n`);
  if (list(code.functions, 25).length) parts.push(`פונקציות בקוד: ${list(code.functions, 25).map((f) => '`' + f + '`').join(', ')}\n`);

  const change = [];
  if (LOCAL[p.id]) {
    change.push(`מורידים את המאגר: \`git clone https://github.com/${owner}/devops-hub.git\` ועובדים בתיקייה \`${LOCAL[p.id]}\`.`);
    change.push('כל שינוי שנדחף ל־main מתפרסם לבד ל־GitHub Pages תוך כ־2 דקות (Action: Deploy vacation-hub to GitHub Pages).');
  } else if (repoUrl) {
    change.push(`מורידים את הקוד: \`git clone ${repoUrl}.git\``);
    change.push('עורכים, ודוחפים ל־main. GitHub Pages מעדכן את האתר תוך דקה בערך.');
  } else if (p.private) {
    change.push('המאגר פרטי: צריך הרשאה מבעל המאגר כדי לעבוד על הקוד.');
  } else if (url) {
    change.push(`האתר מתארח מחוץ ל־GitHub Pages (${new URL(url).host}). השינויים נעשים בפרויקט המקורי שלו בשירות הזה.`);
  }
  change.push('לפני כל שינוי קוראים את הקבצים עצמם. הרשימות כאן הן תקציר, לא תחליף לקוד.');
  parts.push(`## איך משנים ומפרסמים\n\n${bullets(change)}\n`);

  if (p.story) parts.push(`## למה זה נבנה\n\n${one(p.story, 600)}\n`);
  if (code.readme) parts.push(`## מתוך ה־README\n\n${one(code.readme, 1200)}\n`);

  parts.push(`## כללים\n\n${bullets([
    'עונים בעברית, אלא אם המשתמש כותב בשפה אחרת.',
    'לא ממציאים יכולות שלא מופיעות כאן או בקוד. אם לא יודעים, אומרים, ומציעים לבדוק בקוד.',
    'מי שמעוניין במערכת כזו לעסק שלו: אפשר לפנות לבעל הפרויקט דרך עמוד השירותים https://' + owner + '.github.io/devops-hub/portfolio/services.html'
  ])}\n`);
  return parts.join('\n');
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const projects = data.projects.filter((p) => !p.hidden && !p.pending && /^[a-z0-9-]{1,64}$/.test(p.id));
const index = [];
for (const p of projects) {
  fs.mkdirSync(path.join(OUT, p.id), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.id, 'SKILL.md'), skill(p));
  index.push({ id: p.id, title: p.title, zip: p.id + '.zip' });
}
let zipped = false;
try {
  for (const p of projects) execFileSync('zip', ['-q', '-r', `${p.id}.zip`, p.id], { cwd: OUT });
  execFileSync('zip', ['-q', '-r', 'all-skills.zip', ...projects.map((p) => p.id)], { cwd: OUT });
  zipped = true;
} catch (e) { console.log('::warning::zip is not available; publishing the folders only:', e.message); }
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ builtAt: new Date().toISOString(), zipped, skills: index }, null, 1) + '\n');
console.log(`wrote ${projects.length} skills to ${OUT}${zipped ? ' (+ zips)' : ''}${know ? '' : ' (without knowledge.json)'}`);
