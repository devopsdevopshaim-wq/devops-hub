// Adds a project to portfolio/projects.json from an "add-project" issue.
// The issue body carries a ```json block written by the form on the site.
// Prints the new project's id to $GITHUB_OUTPUT.
import fs from 'node:fs';

const file = 'portfolio/projects.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const body = process.env.ISSUE_BODY || '';
const m = body.match(/```json\s*([\s\S]*?)```/);
if (!m) throw new Error('No ```json block in the issue body');
const input = JSON.parse(m[1]);

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
const title = clean(input.title, 80);
const url = clean(input.url, 500);
if (!title || !/^https?:\/\//.test(url)) throw new Error('A title and an http(s) address are required');
const category = Object.keys(data.categories).includes(input.category) ? input.category : 'web';

const entry = { id: '', title, desc: clean(input.desc, 300), category };
const gh = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
const pages = url.match(/^https?:\/\/([^.]+)\.github\.io\/([^/#?]+)/i);
if (gh && gh[1].toLowerCase() === data.owner.toLowerCase()) entry.repo = gh[2].replace(/\.git$/, '');
else if (pages && pages[1].toLowerCase() === data.owner.toLowerCase()) entry.repo = pages[2];
else entry.url = url;

const features = (Array.isArray(input.features) ? input.features : []).map((f) => clean(f, 120)).filter(Boolean).slice(0, 6);
const tech = (Array.isArray(input.tech) ? input.tech : []).map((t) => clean(t, 30)).filter(Boolean).slice(0, 8);
if (features.length) entry.features = features;
if (tech.length) entry.tech = tech;
if (clean(input.story, 400)) entry.story = clean(input.story, 400);

// id: repo name, else an ASCII slug of the address, else "project-N"
let base = (entry.repo || url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-')).toLowerCase().replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
let id = base, n = 2;
const taken = new Set(data.projects.map((p) => p.id));
while (taken.has(id)) id = `${base}-${n++}`;
entry.id = id;
const ordered = { id, ...entry };

// new projects go after the featured ones so they are easy to spot
const firstPlain = data.projects.findIndex((p) => !p.featured);
data.projects.splice(firstPlain < 0 ? data.projects.length : firstPlain, 0, ordered);
fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `id=${id}\ntitle=${title}\n`);
console.log('added', ordered);
