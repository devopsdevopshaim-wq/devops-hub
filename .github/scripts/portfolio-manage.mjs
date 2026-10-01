// Applies admin actions from a "ניהול:" issue to portfolio/projects.json.
// The issue body carries a ```json block: { "ops": [ { "op": "...", ... } ] }.
//   delete {id}      remove the project (and its screenshots)
//   hide / show {id} keep it but take it off / put it back on the public site
//   feature / unfeature {id}
//   approve {id}     publish a project a contributor added
//   edit {id, fields: {title, desc, category, url}}
//   add-contributor / remove-contributor {user}
//   music-add {style, title, url} / music-remove {url}        (portfolio/media.json)
//   video-add {title, desc, url, download} / video-remove {url}
// Writes a Hebrew summary to $GITHUB_OUTPUT (summary=...).
import fs from 'node:fs';

const file = 'portfolio/projects.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const m = (process.env.ISSUE_BODY || '').match(/```json\s*([\s\S]*?)```/);
if (!m) throw new Error('No ```json block in the issue body');
const { ops } = JSON.parse(m[1]);
if (!Array.isArray(ops) || !ops.length) throw new Error('No ops');

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const find = (id) => data.projects.find((p) => p.id === id);
data.contributors = Array.isArray(data.contributors) ? data.contributors : [];
const done = [];
const removedShots = [];
const mediaFile = 'portfolio/media.json';
let media = null;
const loadMedia = () => {
  if (!media) {
    try { media = JSON.parse(fs.readFileSync(mediaFile, 'utf8')); } catch { media = {}; }
    media.music = Array.isArray(media.music) ? media.music : [];
    media.videos = Array.isArray(media.videos) ? media.videos : [];
  }
  return media;
};
const httpsUrl = (u) => /^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u).slice(0, 500) : null;
const isYouTube = (u) => /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(u);

for (const o of ops.slice(0, 100)) {
  const p = o.id ? find(String(o.id)) : null;
  const name = p ? p.title : o.id;
  switch (o.op) {
    case 'delete':
      if (!p) continue;
      data.projects = data.projects.filter((x) => x !== p);
      removedShots.push(p.id);
      done.push(`נמחק: ${name}`);
      break;
    case 'hide':
      if (!p) continue; p.hidden = true; done.push(`הוסתר: ${name}`); break;
    case 'show':
      if (!p) continue; delete p.hidden; done.push(`מוצג שוב: ${name}`); break;
    case 'feature':
      if (!p) continue; p.featured = true; done.push(`סומן כנבחר: ${name}`); break;
    case 'unfeature':
      if (!p) continue; delete p.featured; done.push(`הוסר מהנבחרים: ${name}`); break;
    case 'approve':
      if (!p) continue; delete p.pending; delete p.addedBy; done.push(`אושר: ${name}`); break;
    case 'edit': {
      if (!p) continue;
      const f = o.fields || {};
      if (f.title) p.title = clean(f.title, 80);
      if (f.desc !== undefined) p.desc = clean(f.desc, 300);
      if (f.category && data.categories[f.category]) p.category = f.category;
      if (f.url && /^https?:\/\//.test(f.url) && p.url) p.url = clean(f.url, 500);
      done.push(`עודכן: ${p.title}`);
      break;
    }
    case 'add-contributor': {
      const u = clean(o.user, 39).replace(/^@/, '');
      if (!/^[A-Za-z0-9-]+$/.test(u)) continue;
      if (!data.contributors.some((c) => c.toLowerCase() === u.toLowerCase())) data.contributors.push(u);
      done.push(`נוסף תורם: ${u}`);
      break;
    }
    case 'music-add': {
      const url = httpsUrl(o.url);
      if (!url || !isYouTube(url) || !clean(o.style, 30)) continue;
      const m = loadMedia();
      m.music = m.music.filter((x) => x.url !== url);
      m.music.push({ style: clean(o.style, 30), title: clean(o.title, 80), url });
      done.push(`תחנה חדשה: ${clean(o.style, 30)}`);
      break;
    }
    case 'music-remove': {
      const m = loadMedia();
      const before = m.music.length;
      m.music = m.music.filter((x) => x.url !== o.url);
      if (m.music.length !== before) done.push('הוסרה תחנה');
      break;
    }
    case 'video-add': {
      const url = httpsUrl(o.url);
      if (!url || !clean(o.title, 80)) continue;
      const m = loadMedia();
      m.videos = m.videos.filter((x) => x.url !== url);
      // YouTube videos are for watching only
      m.videos.push({ title: clean(o.title, 80), desc: clean(o.desc, 160), url, download: !!o.download && !isYouTube(url) });
      done.push(`סרטון חדש: ${clean(o.title, 80)}`);
      break;
    }
    case 'video-remove': {
      const m = loadMedia();
      const before = m.videos.length;
      m.videos = m.videos.filter((x) => x.url !== o.url);
      if (m.videos.length !== before) done.push('הוסר סרטון');
      break;
    }
    case 'remove-contributor': {
      const u = clean(o.user, 39).replace(/^@/, '').toLowerCase();
      data.contributors = data.contributors.filter((c) => c.toLowerCase() !== u);
      done.push(`הוסר תורם: ${u}`);
      break;
    }
  }
}
if (!done.length) throw new Error('Nothing to change');

fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
if (media) fs.writeFileSync(mediaFile, JSON.stringify(media, null, 1) + '\n');
for (const id of removedShots) {
  for (const f of [`portfolio/shots/${id}.jpg`, `portfolio/shots/${id}-m.jpg`]) if (fs.existsSync(f)) fs.unlinkSync(f);
}
const idx = 'portfolio/shots/index.json';
if (removedShots.length && fs.existsSync(idx)) {
  const s = JSON.parse(fs.readFileSync(idx, 'utf8'));
  for (const id of removedShots) delete s[id];
  fs.writeFileSync(idx, JSON.stringify(s, null, 2) + '\n');
}
const summary = done.join(' · ');
fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `summary=${summary.replace(/\n/g, ' ')}\n`);
console.log(summary);
