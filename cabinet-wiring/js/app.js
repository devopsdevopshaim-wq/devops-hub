/* ארון־פלאן — ממשק המשתמש */
import { loadAll, loadAllAsync, saveAll, files } from './store.js';
import { readPdf, blobToBase64 } from './pdf.js';
import { CabinetView } from './view.js';
import { Cabinet3D } from './view3d.js';
import { englishSteps, Speaker, sfx } from './voice.js';
import { wireSvg } from './wirerender.js';
import { bookHtml, labelsHtml, siteBookHtml } from './book.js';
import { Site3D } from './site3d.js';
import { SitePlan } from './siteplan.js';

const C = window.WCat, E = window.WEngine, Pr = window.WPrompts, Demo = window.WDemo, S = window.WSite;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newId = (p = 'w') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let state = loadAll();
let raw = null;          // הפרויקט כפי שנשמר
let P = null, L = null;  // אחרי השלמה ופריסה
let pages = [];          // עמודי ה-PDF של הפרויקט הנוכחי
let curPage = 1;
let selected = null;
let tab = 'plan';
let cabView = null, miniView = null;
let server = { ai: false, needCode: false, checked: false };
/* השרת של האתרים העצמאיים (n8n): קורא את עמודי התכנית עם Gemini כשאין שרת Claude משלכם */
const HUB = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
let hub = { ai: false, checked: false };
let view3d = null, built3d = 0, ver = 0;
/* תכניות שכבר נקראו במלואן: מזוהות לפי הטקסט של ה-PDF */
const LIBRARY = [window.WPlan208B].filter(Boolean);
const wf = { funcs: new Set(), search: '', color: '', state: '' };
const cabFuncs = new Set();
let wiring = { group: 'all', idx: 0 };
let aiAbort = null;
let site = null, siteSel = null, sitePlan = null, site3d = null, siteSugg = [], siteData = null;
const cabCache = new Map();
const siteName = (sid) => { const x = sid && state.sites.find((st) => st.id === sid); return x ? x.name : ''; };

/* ---------- הודעות ---------- */
let toastT = 0;
function toast(msg, ms = 3800) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- שמירה ---------- */
function save() {
  if (!raw) return;
  raw.updated = Date.now();
  const i = state.projects.findIndex((p) => p.id === raw.id);
  if (i >= 0) state.projects[i] = raw; else state.projects.unshift(raw);
  state.current = raw.id;
  if (!saveAll(state)) toast('האחסון בדפדפן מלא. כדאי לייצא את הפרויקט ל-JSON.');
}

function derive() {
  if (!raw) { P = L = null; return; }
  raw.wires.forEach((w) => { if (!w.id) w.id = newId(); });
  const first = E.enrich(raw);
  const L1 = E.layout(first);
  const withLen = { ...raw, wires: raw.wires.map((w) => ({ ...w, length: (L1.routes[w.id] || {}).len || null })) };
  P = E.enrich(withLen);
  P.meta = raw.meta || {};
  P.notes = raw.notes || [];
  P.name = raw.name;
  L = E.layout(P);
  ver++;
}

const doneSet = () => new Set(Object.keys((raw && raw.done) || {}).filter((k) => raw.done[k]));
const wireById = (id) => P && P.wires.find((w) => w.id === id);
const compBy = () => Object.fromEntries((P ? P.components : []).map((c) => [c.tag, c]));

function newProject(name, extra = {}) {
  return {
    id: newId('p'), name: name || 'פרויקט חדש', created: Date.now(), updated: Date.now(), source: 'manual',
    meta: {}, components: [], wires: [], notes: [], settings: {}, done: {}, stepsDone: {}, pdf: null, hint: '', ...extra
  };
}

async function openProject(id, toTab) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) { location.hash = '#home'; return; }
  raw = p; state.current = id; saveAll(state);
  selected = null; closeDrawer();
  derive();
  await loadPages();
  if (cabView) cabView.vb = null;
  if (toTab) location.hash = '#p/' + toTab; else route();
}

/* ---------- ניווט ---------- */
function route() {
  const h = location.hash.replace(/^#/, '');
  const m = /^p\/(\w+)/.exec(h);
  const ms = /^site\/([\w-]+)/.exec(h);
  if (ms) { site = state.sites.find((x) => x.id === ms[1]) || null; if (site) { tab = 'site'; siteSel = null; showView('site'); return; } location.hash = '#home'; return; }
  if (m && raw) { tab = m[1]; showView(tab); }
  else { tab = 'home'; showView('home'); }
}

function showView(v) {
  $$('.view').forEach((s) => { s.hidden = s.dataset.view !== v; });
  $('#tabs').hidden = v === 'home' || v === 'site';
  $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === v ? 'page' : 'false'));
  if (v === 'home') { renderHome(); closeDrawer(); return; }
  if (v === 'site') { closeDrawer(); speaker.stop(); renderSite(); return; }
  if (v === 'wiring') closeDrawer();
  $('#projTitle').textContent = raw.name;
  const ps = raw.siteId && state.sites.find((x) => x.id === raw.siteId);
  $('#siteBack').hidden = !ps;
  if (ps) { $('#siteBack').href = '#site/' + ps.id; $('#siteBack').textContent = '→ ' + ps.name; }
  updatePill();
  ({ plan: renderPlan, parts: renderParts, wires: renderWires, cabinet: renderCabinet, three: renderThree, wiring: renderWiring, assembly: renderAssembly, export: renderExport }[v] || renderPlan)();
}

function rerender() { if (tab !== 'home') showView(tab); if (selected && !$('#drawer').hidden) openDrawer(selected); }

function updatePill() {
  if (!P) return;
  const d = P.wires.filter((w) => raw.done[w.id]).length;
  $('#progressPill').textContent = `${d}/${P.wires.length} חוטים חוברו`;
}

/* ---------- דף הבית ---------- */
function renderHome() {
  const sl = $('#siteList');
  sl.innerHTML = state.sites.length ? state.sites.map((s) => {
    const n = s.cabinets.filter((pid) => state.projects.some((p) => p.id === pid)).length;
    return `<li><div><a href="#site/${esc(s.id)}">${esc(s.name)}</a>
      <div class="meta">${n} ארונות · ${s.links.length} כבלים · ${s.files.length} קבצים${s.address ? ' · ' + esc(s.address) : ''}</div></div>
      <a class="btn ghost small" href="#site/${esc(s.id)}">פתיחה</a></li>`;
  }).join('') : '<li class="muted">אין עדיין אתרים. לחצו "אתר חדש" וגררו אליו את כל קבצי התכניות של הפרויקט.</li>';
  const ul = $('#projList');
  if (!state.projects.length) { ul.innerHTML = '<li class="muted">אין עדיין פרויקטים. העלו PDF או פתחו את הדוגמה.</li>'; return; }
  ul.innerHTML = state.projects.map((p) => {
    const d = Object.values(p.done || {}).filter(Boolean).length;
    return `<li><div><a href="#" data-open="${esc(p.id)}">${esc(p.name)}</a>
      <div class="meta">${p.wires.length} חוטים · ${d} חוברו · ${new Date(p.updated).toLocaleDateString('he-IL')}${p.pdf ? ' · PDF' : ''}${siteName(p.siteId) ? ' · אתר: ' + esc(siteName(p.siteId)) : ''}</div></div>
      <button class="btn ghost small" type="button" data-open="${esc(p.id)}">פתיחה</button></li>`;
  }).join('');
}

/* ---------- PDF ---------- */
async function loadPages() {
  pages.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  pages = [];
  curPage = 1;
  if (!raw || !raw.pdf) return;
  for (let i = 1; i <= raw.pdf.pages; i++) {
    const rec = await files.get(`${raw.id}:p${i}`);
    if (rec) pages.push({ ...rec, url: URL.createObjectURL(rec.img) });
  }
}

async function handleFile(file, intoCurrent = false) {
  if (!file) return;
  if (/\.json$/i.test(file.name) || file.type === 'application/json') return importJson(file);
  if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast('צריך קובץ PDF (או JSON).'); return; }
  if (!intoCurrent || !raw) {
    raw = newProject(file.name.replace(/\.pdf$/i, ''));
    save(); derive(); await loadPages(); selected = null; closeDrawer();
    if (cabView) cabView.vb = null;
  }
  location.hash = '#p/plan';
  $('#planStatus').textContent = 'קורא את ה-PDF…';
  try {
    const res = await readPdf(file, { onPage: (i, n) => { $('#planStatus').textContent = `קורא עמוד ${i} מתוך ${n}…`; } });
    await files.delPrefix(raw.id + ':');
    await files.put(`${raw.id}:pdf`, file);
    for (const pg of res.pages) await files.put(`${raw.id}:p${pg.page}`, pg);
    raw.pdf = { name: file.name, pages: res.pages.length, total: res.total, size: file.size };
    save();
    await loadPages();
    let msg = `נקראו ${res.pages.length} עמודים` + (res.total > res.pages.length ? ` (מתוך ${res.total}; נשמרים עד 40)` : '') + '.';
    const ex = E.extractFromText(res.pages);
    const allText = res.pages.map((pg) => pg.items.map((it) => it.s).join(' ')).join('\n');
    const lib = LIBRARY.find((l) => l.matches(allText));
    if (lib && !raw.wires.length) {
      const lp = lib.project();
      raw.settings = { ...lp.settings, ...(raw.settings || {}) };
      applyResult({ components: lp.components, wires: lp.wires, meta: lp.meta, notes: lp.notes }, 'library', true);
      if (raw.name === file.name.replace(/\.pdf$/i, '')) raw.name = lp.name;
      msg += ` זוהתה ${lib.title}: נטענה קריאה מלאה של כל השרטוטים (${lp.wires.length} חוטים, ${lp.components.length} רכיבים) עם חתכים וצבעים לפי התקנות.`;
      raw.status = msg; save(); derive(); toast(msg, 8000);
      location.hash = '#p/three';
      return;
    }
    if (ex.wires.length >= 3 && !raw.wires.length) {
      applyResult({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text', true);
      msg += ` נמצאו ${ex.wires.length} חוטים בטקסט של ה-PDF. בדקו אותם ברשימת החוטים.`;
    } else if (!raw.wires.length) {
      msg += aiReady() ? ' אין בטקסט רשימת חוטים, אז השרטוטים נקראים עכשיו אוטומטית, עמוד אחרי עמוד.' : ' לא נמצאה בטקסט רשימת חוטים. זו תכנית גרפית: לחצו "Claude.ai בהעתק-הדבק".';
    }
    raw.status = msg;
    save(); derive(); rerender();
    toast(msg, 6000);
    if (!raw.wires.length && aiReady()) runAuto();
  } catch (e) {
    $('#planStatus').textContent = 'שגיאה: ' + e.message;
    toast('לא הצלחתי לקרוא את ה-PDF: ' + e.message, 7000);
  }
}

async function importJson(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j && j.app === 'cabinet-wiring' && j.project) {
      const p = { ...j.project, id: newId('p'), pdf: null, updated: Date.now() };
      raw = p; save(); derive(); await loadPages();
      toast('הפרויקט יובא.');
      location.hash = '#p/wires'; route();
      return;
    }
    const res = Pr.fromJson(j);
    if (!raw) { raw = newProject(file.name.replace(/\.json$/i, '')); save(); }
    applyResult(res, 'json');
    location.hash = '#p/wires'; route();
  } catch (e) { toast('ה-JSON לא נקרא: ' + e.message, 6000); }
}

function applyResult(res, source, silent) {
  if (raw.wires.length && !silent && !confirm(`להחליף את ${raw.wires.length} החוטים הקיימים בתוצאה החדשה (${res.wires.length} חוטים)?`)) return false;
  const key = (w) => [E.normTag(w.from.tag), E.normTerm(w.from.term), E.normTag(w.to.tag), E.normTerm(w.to.term)].join('|');
  const oldDone = new Set(raw.wires.filter((w) => raw.done[w.id]).map(key));
  raw.components = res.components || [];
  raw.wires = (res.wires || []).map((w) => ({ ...w, id: newId() }));
  raw.done = {};
  raw.wires.forEach((w) => { if (oldDone.has(key(w))) raw.done[w.id] = 1; });
  const meta = {};
  Object.entries(res.meta || {}).forEach(([k, v]) => { if (v) meta[k] = v; });
  raw.meta = { ...(raw.meta || {}), ...meta };
  if (meta.title && (/^פרויקט חדש$|\.pdf$/i.test(raw.name) || (raw.pdf && raw.name === raw.pdf.name.replace(/\.pdf$/i, '')))) raw.name = meta.title;
  raw.notes = res.notes || [];
  raw.source = source;
  raw.status = `נטענו ${raw.wires.length} חוטים ו-${raw.components.length} רכיבים (${({ claude: 'Claude', paste: 'Claude.ai', text: 'שליפה מהטקסט', json: 'JSON', gemini: 'קריאה אוטומטית', library: 'קריאה מלאה של התכנית' })[source] || source}).`;
  save(); derive();
  if (!silent) { toast(raw.status); rerender(); }
  return true;
}

/* ---------- 1. תכנית ---------- */
function renderPlan() {
  const has = pages.length > 0;
  $('#pdfEmpty').hidden = has;
  $('#thumbs').hidden = !has; $('#pageWrap').hidden = !has; $('#pageHint').hidden = !has;
  $('#planStatus').textContent = raw.status || (raw.wires.length ? `${raw.wires.length} חוטים בפרויקט.` : 'העלו PDF או הוסיפו חוטים ידנית.');
  $('#hint').value = raw.hint || '';
  const ai = $('#runClaude');
  ai.disabled = !aiReady() || !raw.pdf || Boolean(aiAbort);
  ai.title = !aiReady() ? 'השרת לקריאה אוטומטית לא זמין כרגע. השתמשו ב-Claude.ai בהעתק-הדבק.' : !raw.pdf ? 'צריך PDF' : '';
  $('#runLocal').disabled = !has;
  const m = raw.meta || {};
  $('#mTitle').value = m.title || ''; $('#mDrawing').value = m.drawingNo || ''; $('#mRev').value = m.revision || '';
  $('#mSupply').value = m.supply || ''; $('#mControl').value = m.control || '';
  $('#notes').innerHTML = raw.notes && raw.notes.length ? '<strong>הערות מהקריאה</strong><ul>' + raw.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '';
  const inf = P.wires.filter((w) => w.colorSource === 'standard').length;
  $('#statsCard').innerHTML = P.wires.length ? `<h2>סיכום</h2><div class="stat-grid">
    <div class="stat"><b>${P.wires.length}</b><span>חוטים</span></div>
    <div class="stat"><b>${P.components.length}</b><span>רכיבים</span></div>
    <div class="stat"><b>${inf}</b><span>צבע לפי תקן</span></div></div>
    <p class="small muted" style="margin:8px 0 0">${Object.entries(P.stats.byFunc).map(([f, n]) => `${esc(C.FUNCS[f].short)}: ${n}`).join(' · ')}</p>` : '';
  if (has) renderPages();
}

function pageMatches(w, pg) {
  if (!w || !pg) return [];
  const tags = [w.from, w.to].map((e) => ({ body: E.tagBody(e.tag), full: e.tag.toUpperCase(), term: e.term.toUpperCase() }));
  const out = [];
  pg.items.forEach((it) => {
    const s = it.s.toUpperCase().replace(/\s+/g, '');
    let kind = '';
    if (tags.some((t) => s === t.full || s === t.body || s === '-' + t.body || s.includes(t.body + ':' + t.term))) kind = 'tag';
    else if (w.no && w.no.length >= 2 && !w.noInferred && s === w.no.toUpperCase()) kind = 'no';
    if (kind) out.push({ ...it, kind });
  });
  return out;
}

function renderPages() {
  const w = selected && wireById(selected);
  const hits = pages.map((pg) => pageMatches(w, pg).length);
  $('#thumbs').innerHTML = pages.map((pg, i) => `<button type="button" role="tab" aria-selected="${pg.page === curPage}" data-page="${pg.page}" class="${hits[i] ? 'hit' : ''}" aria-label="עמוד ${pg.page}"><img src="${pg.url}" alt=""><span>${pg.page}</span></button>`).join('');
  const pg = pages.find((x) => x.page === curPage) || pages[0];
  if (!pg) return;
  $('#pageImg').src = pg.url;
  $('#pageImg').alt = 'עמוד ' + pg.page + ' של התכנית';
  const marks = pageMatches(w, pg);
  $('#marks').innerHTML = marks.map((it) => `<div class="mark ${it.kind === 'no' ? 'no' : ''}" style="left:${(it.x * 100).toFixed(2)}%;top:${(it.y * 100).toFixed(2)}%;width:${Math.max(0.6, it.w * 100).toFixed(2)}%;height:${Math.max(0.6, it.h * 100).toFixed(2)}%"></div>`).join('');
  $('#pageHint').textContent = w ? (marks.length ? `מסומנים ${marks.length} מקומות של חוט ${w.no} (${w.from.tag}, ${w.to.tag}) בעמוד ${pg.page}.` : `חוט ${w.no} לא נמצא בטקסט של עמוד ${pg.page}.`) : 'כשבוחרים חוט, המיקומים של התגים ומספר החוט מסומנים על העמוד.';
}

function showWireInPdf(id) {
  const w = wireById(id);
  if (!w || !pages.length) { toast('אין PDF בפרויקט.'); return; }
  let best = w.page && pages.find((p) => p.page === w.page) ? w.page : 0;
  if (!best) {
    let n = 0;
    pages.forEach((pg) => { const k = pageMatches(w, pg).length; if (k > n) { n = k; best = pg.page; } });
  }
  if (best) curPage = best;
  location.hash = '#p/plan';
  setTimeout(() => { const m = $('#marks .mark'); if (m) m.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); }, 120);
}

/* ---------- Claude ---------- */
async function checkServer() {
  const b = $('#aiBadge');
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const j = await r.json();
    server = { ...j, checked: true };
    b.textContent = j.ai ? 'Claude מחובר' : 'שרת בלי מפתח: העתק-הדבק';
    b.className = 'ai-badge ' + (j.ai ? 'ok' : 'warn');
  } catch {
    server = { ai: false, checked: true };
    b.textContent = 'Claude בהעתק-הדבק';
    b.className = 'ai-badge warn';
    b.title = 'האתר פתוח בלי השרת. הקריאה עם Claude עובדת בהעתק-הדבק ל-Claude.ai.';
  }
  try {
    const j = await hubCall({ action: 'status' }, 12000);
    hub = { ai: Boolean(j && j.ok && j.ai), checked: true };
  } catch { hub = { ai: false, checked: true }; }
  if (!server.ai && hub.ai) { b.textContent = 'קריאה אוטומטית פעילה'; b.className = 'ai-badge ok'; b.title = 'השרטוטים נקראים אוטומטית (Gemini דרך השרת של האתר).'; }
  if (raw && tab === 'plan') renderPlan();
}

const aiReady = () => server.ai || hub.ai;
const runAuto = () => (server.ai ? runClaude() : runHub());

async function hubCall(payload, ms = 115000, signal) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  if (signal) signal.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), signal: ctl.signal });
    return await r.json().catch(() => ({ ok: false, error: r.status === 413 ? 'too-big' : 'bad-response' }));
  } finally { clearTimeout(t); }
}

/* עמוד מוקטן ל-JPEG בבסיס 64 (בערך 250–450KB) */
async function pageJpeg(blob, max = 1700) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}

const HUB_ERR = {
  quota: 'המכסה היומית של הקריאה האוטומטית נגמרה. נסו מחר, או השתמשו ב-Claude.ai בהעתק-הדבק.',
  'rate-limited': 'יותר מדי בקשות בשעה האחרונה. חכו כמה דקות ולחצו שוב "קריאה אוטומטית".',
  'no-key': 'הקריאה האוטומטית לא מוגדרת בשרת. השתמשו ב-Claude.ai בהעתק-הדבק.',
  'too-big': 'העמודים גדולים מדי לשליחה. המערכת תנסה פחות עמודים בכל פעם.',
  offline: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
  forbidden: 'השרת מקבל בקשות רק מהאתר עצמו (github.io).'
};

/* קריאה אוטומטית דרך השרת של האתר: כמה עמודים בכל בקשה, ואיחוד לרשימה אחת */
async function runHub() {
  if (!pages.length) { toast('אין עמודים בפרויקט. העלו PDF.'); return; }
  raw.hint = $('#hint').value.trim(); save();
  const prog = $('#aiProgress'), txt = $('#aiText'), bar = $('#aiBar');
  prog.hidden = false; bar.style.width = '3%';
  $('#runClaude').disabled = true;
  aiAbort = new AbortController();
  const results = [], failed = [];
  let per = 3;
  const queue = pages.map((p) => p.page);
  const total = queue.length;
  let done = 0;
  try {
    while (queue.length) {
      if (aiAbort.signal.aborted) throw Object.assign(new Error('stop'), { name: 'AbortError' });
      const batch = queue.splice(0, per);
      txt.textContent = `קורא את השרטוטים: עמודים ${batch[0]}–${batch[batch.length - 1]} מתוך ${total}… (${results.reduce((n, r) => n + r.wires.length, 0)} חוטים עד עכשיו)`;
      const imgs = [];
      for (const n of batch) { const pg = pages.find((x) => x.page === n); imgs.push({ data: await pageJpeg(pg.img), mime: 'image/jpeg' }); }
      const known = Pr.merge(results).components.map((c) => c.tag);
      const text = batch.map((n) => { const pg = pages.find((x) => x.page === n); return `--- עמוד ${n} ---\n` + E.textLines([pg]).map((l) => l.text).join('\n'); }).join('\n');
      const j = await hubCall({ action: 'ai', tag: 'wiring', prompt: Pr.chunkPrompt({ pages: batch, known, hint: raw.hint, text }), images: imgs }, 118000, aiAbort.signal);
      if (!j || !j.ok) {
        const err = (j && j.error) || 'ai-failed';
        if (err === 'too-big' && batch.length > 1) { queue.unshift(...batch); per = Math.max(1, Math.floor(batch.length / 2)); continue; }
        if (['quota', 'rate-limited', 'no-key', 'forbidden', 'offline'].includes(err)) throw new Error(HUB_ERR[err]);
        failed.push(...batch);
      } else {
        try { const r = Pr.parse(j.text); r.wires.forEach((w) => { if (!w.page) w.page = batch[0]; }); results.push(r); }
        catch { failed.push(...batch); }
      }
      done += batch.length;
      bar.style.width = Math.round(4 + 92 * done / total) + '%';
    }
    const res = Pr.merge(results);
    if (failed.length) res.notes.unshift(`עמודים ${failed.join(', ')} לא נקראו (שגיאה בשרת או תשובה לא תקינה). אפשר ללחוץ שוב "קריאה אוטומטית", או להוסיף את החוטים שלהם ידנית.`);
    if (!res.wires.length && !res.components.length) throw new Error('לא נמצאו רכיבים או חוטים בשרטוטים. אם זה סריקה מטושטשת, נסו קובץ חד יותר או Claude.ai בהעתק-הדבק.');
    bar.style.width = '100%';
    if (applyResult(res, 'gemini')) {
      txt.textContent = `הסתיים: ${res.wires.length} חוטים ו-${res.components.length} רכיבים מ-${total} עמודים.`;
      toast(`נקראו ${res.wires.length} חוטים ו-${res.components.length} רכיבים. עברו ל"ארון בתלת־ממד" או ל"רשימת חוטים".`, 7000);
    }
  } catch (e) {
    if (e.name === 'AbortError') txt.textContent = 'נעצר.';
    else { txt.textContent = e.message; toast(e.message, 8000); }
  } finally {
    aiAbort = null;
    $('#runClaude').disabled = !aiReady();
    setTimeout(() => { prog.hidden = true; }, 6000);
  }
}

function pagesText() {
  return pages.map((p) => `--- עמוד ${p.page} ---\n` + E.textLines([p]).map((l) => l.text).join('\n')).join('\n').slice(0, 60000);
}

async function runClaude() {
  const blob = await files.get(`${raw.id}:pdf`);
  if (!blob) { toast('ה-PDF לא נמצא בדפדפן. העלו אותו שוב.'); return; }
  if (blob.size > 30 * 1024 * 1024) { toast('הקובץ גדול מ-30MB. פצלו אותו לכמה קבצים או השתמשו בהעתק-הדבק.', 7000); return; }
  raw.hint = $('#hint').value.trim(); save();
  const prog = $('#aiProgress'), txt = $('#aiText'), bar = $('#aiBar');
  prog.hidden = false; bar.style.width = '4%'; txt.textContent = 'שולח את התכנית ל-Claude…';
  $('#runClaude').disabled = true;
  aiAbort = new AbortController();
  let acc = '';
  try {
    const headers = { 'content-type': 'application/json' };
    const code = localStorage.getItem('cabinet-wiring-code');
    if (code) headers['x-access-code'] = code;
    const r = await fetch('api/analyze', {
      method: 'POST', headers, signal: aiAbort.signal,
      body: JSON.stringify({ pdf: await blobToBase64(blob), name: raw.pdf.name, hint: raw.hint, text: pagesText() })
    });
    if (r.status === 401) {
      const c = prompt('השרת מבקש קוד גישה:');
      if (c) { localStorage.setItem('cabinet-wiring-code', c); prog.hidden = true; $('#runClaude').disabled = false; return runClaude(); }
      throw new Error('נדרש קוד גישה');
    }
    if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'שגיאת שרת ' + r.status); }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', final = null;
    const t0 = Date.now();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.t) acc += msg.t;
        if (msg.error) throw new Error(msg.error);
        if (msg.done) final = msg;
      }
      const n = (acc.match(/"fromTag"/g) || []).length;
      const secs = Math.round((Date.now() - t0) / 1000);
      txt.textContent = acc ? `Claude כותב: ${n} חוטים עד עכשיו (${secs} שניות)` : `Claude קורא את התכנית… (${secs} שניות)`;
      bar.style.width = Math.min(95, 6 + n * 0.8) + '%';
    }
    if (final && final.stop === 'max_tokens') toast('התשובה נקטעה באמצע (תכנית ארוכה מאוד). נטען מה שהתקבל.', 7000);
    if (final && final.stop === 'refusal') throw new Error('הבקשה נדחתה.');
    const res = Pr.parse(acc);
    bar.style.width = '100%';
    applyResult(res, 'claude');
    txt.textContent = `הסתיים: ${res.wires.length} חוטים.`;
  } catch (e) {
    if (e.name === 'AbortError') txt.textContent = 'נעצר.';
    else { txt.textContent = 'שגיאה: ' + e.message; toast('הקריאה עם Claude נכשלה: ' + e.message, 7000); }
  } finally {
    aiAbort = null; $('#runClaude').disabled = !server.ai;
    setTimeout(() => { prog.hidden = true; }, 4000);
  }
}

async function openPaste() {
  raw.hint = $('#hint').value.trim(); save();
  $('#pasteBox').value = ''; $('#pasteErr').textContent = '';
  const a = $('#pdfDownload');
  const blob = raw.pdf ? await files.get(`${raw.id}:pdf`) : null;
  if (blob) { a.href = URL.createObjectURL(blob); a.download = raw.pdf.name; a.hidden = false; } else a.hidden = true;
  $('#pasteDialog').showModal();
}

/* ---------- 2. רכיבים ---------- */
function renderParts() {
  const q = $('#partsSearch').value.trim().toUpperCase();
  const count = {};
  P.wires.forEach((w) => { count[w.from.tag] = (count[w.from.tag] || 0) + 1; count[w.to.tag] = (count[w.to.tag] || 0) + 1; });
  const rawTags = new Set(raw.components.map((c) => E.normTag(c.tag)));
  const list = P.components.filter((c) => !q || c.tag.includes(q) || (c.name || '').toUpperCase().includes(q)).sort((a, b) => E.natCmp(a.tag, b.tag));
  $('#partsCount').textContent = `(${P.components.length})`;
  const typeOpts = (v) => Object.entries(C.TYPES).map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(t.he)}</option>`).join('');
  const rc = (tag) => raw.components.find((c) => E.normTag(c.tag) === tag) || {};
  $('#partsTable').innerHTML = `<thead><tr><th>תג</th><th>סוג</th><th>שם</th><th>מיקום</th><th>מסילה</th><th>יצרן</th><th>מק"ט</th><th>חוטים</th><th></th></tr></thead><tbody>` +
    list.map((c) => {
      const r = rc(c.tag);
      return `<tr data-tag="${esc(c.tag)}">
      <td><input class="mono" data-k="tag" value="${esc(c.tag)}" size="7" aria-label="תג">${rawTags.has(c.tag) ? '' : ' <span class="tag-auto">אוטו\'</span>'}</td>
      <td><select data-k="type" aria-label="סוג">${typeOpts(c.type)}</select></td>
      <td><input data-k="name" value="${esc(c.name)}" aria-label="שם"></td>
      <td><select data-k="location" aria-label="מיקום"><option value="">לפי סוג (${esc(C.ZONES[E.typeInfo(c.type).zone])})</option>${Object.entries(C.ZONES).map(([k, v]) => `<option value="${k}" ${r.location === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><select data-k="rail" aria-label="מסילה"><option value="">אוטו'</option>${[1, 2, 3, 4].map((n) => `<option ${String(r.rail) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><input data-k="maker" value="${esc(c.maker || '')}" size="9" aria-label="יצרן"></td>
      <td><input class="mono" data-k="partNo" value="${esc(c.partNo || '')}" size="12" aria-label="מק&quot;ט"></td>
      <td><button class="btn ghost small" type="button" data-hl="${esc(c.tag)}" title="הצגת החוטים בציור">${count[c.tag] || 0}</button></td>
      <td class="row gap"><button class="btn ghost small" type="button" data-comp="${esc(c.tag)}">כרטיס</button><button class="icon-btn" type="button" data-del="${esc(c.tag)}" aria-label="מחיקת ${esc(c.tag)}">✕</button></td></tr>`;
    }).join('') + '</tbody>';
}

function updateComp(tag, k, v) {
  let c = raw.components.find((x) => E.normTag(x.tag) === tag);
  if (!c) { const d = P.components.find((x) => x.tag === tag) || { tag }; c = { tag, name: d.name, type: d.type }; raw.components.push(c); }
  if (k === 'tag') {
    const nt = E.normTag(v);
    if (!nt) return;
    raw.wires.forEach((w) => { if (E.normTag(w.from.tag) === tag) w.from.tag = nt; if (E.normTag(w.to.tag) === tag) w.to.tag = nt; });
    c.tag = nt;
  } else c[k] = v;
  save(); derive(); renderParts();
}

/* ---------- 3. רשימת חוטים ---------- */
function filteredWires() {
  const q = wf.search.toUpperCase();
  return P.wires.filter((w) => {
    if (wf.funcs.size && !wf.funcs.has(w.func)) return false;
    if (wf.color && w.color !== wf.color) return false;
    if (wf.state === 'done' && !raw.done[w.id]) return false;
    if (wf.state === 'todo' && raw.done[w.id]) return false;
    if (wf.state === 'std' && w.colorSource !== 'standard' && !w.sectionInferred) return false;
    if (q) {
      const hay = [w.no, w.from.tag + ':' + w.from.term, w.to.tag + ':' + w.to.term, w.desc, w.potential, w.wireType].join(' ').toUpperCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function funcChips(host, set, onChange) {
  const present = [...new Set(P.wires.map((w) => w.func))].sort((a, b) => C.FUNCS[a].order - C.FUNCS[b].order);
  host.innerHTML = present.map((f) => {
    const col = C.COLORS[C.FUNCS[f].color];
    const n = P.wires.filter((w) => w.func === f).length;
    return `<button type="button" class="chip" data-f="${f}" aria-pressed="${set.has(f)}"><span class="sw" style="${swStyle(col)}"></span>${esc(C.FUNCS[f].short)} (${n})</button>`;
  }).join('');
  host.onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const f = b.dataset.f;
    if (set.has(f)) set.delete(f); else set.add(f);
    b.setAttribute('aria-pressed', set.has(f));
    onChange();
  };
}

function swStyle(col) {
  if (!col) return 'background:#999';
  return col.stripe ? `background:repeating-linear-gradient(90deg,${col.hex} 0 5px,${col.stripe} 5px 10px)` : `background:${col.hex}`;
}

function renderWires() {
  funcChips($('#funcChips'), wf.funcs, renderWireRows);
  const sel = $('#wireColor');
  const used = [...new Set(P.wires.map((w) => w.color))];
  sel.innerHTML = '<option value="">כל הצבעים</option>' + used.map((c) => `<option value="${c}" ${wf.color === c ? 'selected' : ''}>${esc(C.COLORS[c].he)} (${c})</option>`).join('');
  renderWireRows();
}

function renderWireRows() {
  const list = filteredWires();
  $('#wiresCount').textContent = `(${list.length} מתוך ${P.wires.length})`;
  $('#wiresTable').innerHTML = `<thead><tr><th></th><th>מס'</th><th>מ-</th><th>אל-</th><th>צבע</th><th>ממ"ר</th><th>סוג</th><th>תפקיד</th><th>אורך</th><th>תיאור</th></tr></thead><tbody>` +
    list.map((w) => {
      const r = L.routes[w.id];
      const col = C.COLORS[w.color];
      return `<tr data-id="${esc(w.id)}" class="${raw.done[w.id] ? 'done' : ''} ${selected === w.id ? 'sel' : ''}" tabindex="0">
        <td class="st"></td><td class="mono">${esc(w.no)}${w.noInferred ? '<span class="inf">*</span>' : ''}</td>
        <td class="ep" translate="no">${esc(w.from.tag)}:${esc(w.from.term)}</td><td class="ep" translate="no">${esc(w.to.tag)}:${esc(w.to.term)}</td>
        <td style="white-space:nowrap"><span class="sw" style="${swStyle(col)}"></span>${esc(col.he)}${w.colorSource === 'standard' ? '<span class="inf">*</span>' : ''}</td>
        <td>${esc(C.fmtSection(w.section))}${w.sectionInferred ? '<span class="inf">*</span>' : ''}</td>
        <td class="mono">${esc(w.wireType)}${w.wireTypeInferred ? '<span class="inf">*</span>' : ''}</td>
        <td><span class="fbadge">${esc(C.FUNCS[w.func].short)}</span></td>
        <td>${r && r.len ? Math.round(r.len / 10) + ' ס"מ' : (r && r.ext ? 'שטח' : '')}</td>
        <td class="desc small">${esc(w.desc || w.explain || w.auto.purpose).slice(0, 140)}</td></tr>`;
    }).join('') + '</tbody>';
}

/* ---------- 4. פריסת ארון ---------- */
function ensureCab() {
  if (!cabView) {
    cabView = new CabinetView($('#cabHost'), {
      onHover: (id, ev) => showTip(id, ev),
      onSelect: (id) => select(id, 'cab'),
      onComp: (tag) => openComp(tag)
    });
  }
}

function renderCabinet() {
  ensureCab();
  cabView.render(P, L, { C });
  cabView.setDone(doneSet());
  funcChips($('#cabChips'), cabFuncs, applyCabFilter);
  applyCabFilter();
  const used = {};
  P.wires.forEach((w) => { const k = w.color; used[k] = (used[k] || 0) + 1; });
  $('#legend').innerHTML = Object.entries(used).map(([k, n]) => `<span><span class="sw" style="${swStyle(C.COLORS[k])}"></span>${esc(C.COLORS[k].he)} · ${n}</span>`).join('') +
    `<span>פלטה ${L.plate.w}×${L.plate.h} מ"מ · ${L.rails.length} מסילות</span>`;
}

function applyCabFilter() {
  if (!cabView) return;
  cabView.filter(cabFuncs.size ? new Set(P.wires.filter((w) => cabFuncs.has(w.func)).map((w) => w.id)) : null);
}

/* ---------- 5. תלת־ממד ---------- */
async function renderThree() {
  if (!view3d) {
    view3d = new Cabinet3D($('#threeHost'), {
      onHover: (id, ev) => showTip(id, ev),
      onSelect: (id) => { if (id) { selected = id; openDrawer(id); } else { selected = null; closeDrawer(); } },
      onComp: (tag) => showComp3d(tag)
    });
  }
  funcChips($('#t3Chips'), cabFuncs, () => view3d.highlightIds(cabFuncs.size ? P.wires.filter((w) => cabFuncs.has(w.func)).map((w) => w.id) : null));
  renderEncCard();
  if (built3d !== ver) {
    try {
      await view3d.build(P, L, E, C);
      built3d = ver;
      $('#threeWait').hidden = true;
    } catch (e) {
      $('#threeWait').hidden = false;
      $('#threeWait').textContent = 'התלת־ממד לא נטען (' + e.message + '). בדקו חיבור לאינטרנט או נסו דפדפן אחר.';
      return;
    }
  }
  if (pending3d) { const t = pending3d; pending3d = null; openComp(t); view3d.focusComp(t); }
}

function renderEncCard() {
  const enc = E.enclosure(P, L);
  const m = raw.meta || {};
  const byFunc = Object.entries(P.stats.byFunc).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byFunc.map((x) => x[1]));
  const zones = (z) => P.components.filter((c) => c.zone === z).length;
  $('#encCard').innerHTML = `<h2>כרטיס הארון</h2>
    <p class="big">${enc.w}×${enc.h}×${enc.d}</p>
    <p class="small muted" style="margin:0 0 12px">רוחב × גובה × עומק במ"מ, לפי הפלטה והרכיב העמוק ביותר (${enc.deepest} מ"מ)</p>
    <dl>
      <dt>מעטפת</dt><dd>${esc(enc.material)}</dd>
      <dt>הגנה</dt><dd>${esc(enc.ip)}</dd>
      <dt>הזנה</dt><dd>${esc(m.supply || '—')}</dd>
      <dt>פיקוד</dt><dd>${esc(m.control || ({ dc24: '24V DC', ac230: '230V AC', ac24: '24V AC' })[E.settingsOf(raw).control])}</dd>
      <dt>פלטה</dt><dd class="mono">${L.plate.w}×${L.plate.h}</dd>
      <dt>מסילות DIN</dt><dd>${enc.rails} · ${enc.railM} מ' TS35</dd>
      <dt>תעלות</dt><dd>${enc.ducts} · ${enc.ductM} מ'</dd>
      <dt>רכיבים</dt><dd>${zones('cabinet')} בארון · ${zones('door')} בדלת · ${zones('field')} בשטח</dd>
      <dt>חוטים</dt><dd>${P.wires.length} · כ-${enc.wireM} מ' בתוך הארון</dd>
    </dl>
    <h3>חוטים לפי תפקיד</h3>
    <div class="bars">${byFunc.map(([f, n]) => `<div><span>${esc(C.FUNCS[f].short)}</span><i style="width:${Math.round(100 * n / max)}%;background:${C.COLORS[C.FUNCS[f].color].hex === '#f4f4f4' ? '#9aa3ab' : C.COLORS[C.FUNCS[f].color].hex}"></i><span>${n}</span></div>`).join('')}</div>`;
}

function showComp3d(tag) {
  openComp(tag);
}

function showTip(id, ev) {
  const tip = $('#tip');
  if (!id) { tip.hidden = true; return; }
  const w = wireById(id);
  if (!w) return;
  const col = C.COLORS[w.color];
  const r = L.routes[w.id];
  tip.innerHTML = `<b>חוט ${esc(w.no)}</b> · ${esc(C.FUNCS[w.func].he)}<br>
    <span class="sw" style="${swStyle(col)}"></span>${esc(col.he)} · ${esc(C.fmtSection(w.section))} ממ"ר · ${esc(w.wireType)}${r && r.len ? ' · כ-' + Math.round(r.len / 10) + ' ס"מ' : ''}<br>
    <span class="ep" translate="no">${esc(w.from.tag)}:${esc(w.from.term)}</span> ← <span class="ep" translate="no">${esc(w.to.tag)}:${esc(w.to.term)}</span>
    <p>${esc(w.explain || w.auto.purpose)}</p>${raw.done[w.id] ? '<p class="done-flag">✓ חובר</p>' : ''}`;
  tip.hidden = false;
  const pad = 14, rect = tip.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + rect.width > innerWidth - 8) x = ev.clientX - rect.width - pad;
  if (y + rect.height > innerHeight - 8) y = ev.clientY - rect.height - pad;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
}

/* ---------- בחירת חוט ומגירה ---------- */
function select(id, from) {
  selected = id || null;
  $$('#wiresTable tr.sel').forEach((tr) => tr.classList.remove('sel'));
  if (id) { const tr = $(`#wiresTable tr[data-id="${CSS.escape(id)}"]`); if (tr) tr.classList.add('sel'); }
  if (cabView && from !== 'cab') cabView.select(selected, false);
  if (tab === 'plan' && pages.length) renderPages();
  if (selected) openDrawer(selected); else closeDrawer();
}

function endBlock(lbl, e, comp, role) {
  return `<div class="end"><div class="lbl">${lbl}</div><button type="button" class="ep ep-link" data-comp="${esc(e.tag)}" translate="no" title="כרטיס הרכיב ${esc(e.tag)}">${esc(e.tag)}:${esc(e.term)}</button>
    <div class="small">${esc(comp ? (comp.name || E.typeInfo(comp.type).he) : '')} · ${esc(C.ZONES[comp && comp.zone] || '')}</div>
    <div class="small muted">${esc(role.role)}</div></div>`;
}

function wireDetailHtml(w, opts = {}) {
  const cb = compBy();
  const A = cb[w.from.tag], B = cb[w.to.tag];
  const col = C.COLORS[w.color];
  const r = L.routes[w.id];
  const a = w.auto;
  const fer = a.ferrule, ferT = a.ferruleTwin;
  return `
    ${opts.big ? '' : `<div class="sw big" style="${swStyle(col)}"></div>`}
    <div class="ends">${endBlock('מאיפה', w.from, A, E.termRole(A && A.type, w.from.term))}${opts.big ? '<div class="arrow">←</div>' : ''}${endBlock('לאן', w.to, B, E.termRole(B && B.type, w.to.term))}</div>
    <div class="spec">
      <div><span>צבע</span><b>${esc(col.he)}</b>${w.colorSource === 'standard' ? '<div class="small inf">לפי התקן</div>' : ''}</div>
      <div><span>חתך</span><b>${esc(C.fmtSection(w.section))} ממ"ר</b><div class="small muted">${esc(a.awg)}</div></div>
      <div><span>סוג חוט</span><b class="mono">${esc(w.wireType)}</b></div>
      <div><span>אורך משוער</span><b>${r && r.len ? Math.round(r.len / 10) + ' ס"מ' : 'לפי השטח'}</b>${r && r.door ? '<div class="small muted">כולל לולאת ציר לדלת</div>' : ''}</div>
      <div><span>שרוול קצה</span><b>${esc(C.COLORS[fer.color].he)} ${fer.size}</b><div class="small muted">${w.twinFrom || w.twinTo ? 'TWIN בקצה <span class="mono">' + esc(w.twinFrom ? w.from.tag + ':' + w.from.term : w.to.tag + ':' + w.to.term) + '</span>' : 'בודד'}</div></div>
      <div><span>קילוף</span><b>${fer.strip} מ"מ</b></div>
      <div><span>תפקיד</span><b>${esc(C.FUNCS[w.func].short)}</b><div class="small muted">${esc(w.potential || '')}</div></div>
      <div><span>עמוד בתכנית</span><b>${w.page || '—'}</b></div>
    </div>
    <div class="explain"><h3>הסבר על החוט</h3>
      ${w.desc ? `<p><strong>${esc(w.desc)}</strong></p>` : ''}
      ${w.explain ? `<p>${esc(w.explain)}</p>` : ''}
      <p>${esc(a.purpose)}</p>
      ${a.wireTypeHe ? `<p class="small muted">${esc(a.wireTypeHe)}</p>` : ''}
    </div>
    <h3 class="small">איך מחווטים</h3>
    <ol class="howto small">${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}${w.twinFrom || w.twinTo ? `<li>${esc(ferT.text)} בהדק המשותף (שני חוטים בשרוול אחד).</li>` : ''}</ol>
    <p class="small"><strong>בדיקה:</strong> ${esc(a.check)}</p>`;
}

function openDrawer(id) {
  const w = wireById(id);
  if (!w) { closeDrawer(); return; }
  drawerMode = { kind: 'wire', id };
  setDrawer(`חוט ${w.no} · ${C.FUNCS[w.func].he}`, wireDetailHtml(w), 'wire');
  $('#dDone').textContent = raw.done[w.id] ? 'ביטול סימון' : 'סימון כמחווט ✓';
  $('#dShowPdf').disabled = !pages.length;
}
function closeDrawer() {
  if (drawerMode && drawerMode.kind === 'comp' && !drawerMode.site && !$('#drawer').hidden) {
    if (cabView && cabView.hlTag) { cabView.highlight(null); cabView.hlTag = null; }
    if (view3d && view3d.hlSet) view3d.highlightIds(cabFuncs.size && P ? P.wires.filter((w) => cabFuncs.has(w.func)).map((w) => w.id) : null);
  }
  $('#drawer').hidden = true;
}

function toggleDone(id, v) {
  raw.done[id] = v === undefined ? !raw.done[id] : v;
  if (!raw.done[id]) delete raw.done[id];
  save(); updatePill();
  if (cabView) cabView.setDone(doneSet());
  const tr = $(`#wiresTable tr[data-id="${CSS.escape(id)}"]`); if (tr) tr.classList.toggle('done', Boolean(raw.done[id]));
  if (selected === id && !$('#drawer').hidden) openDrawer(id);
}

/* ---------- 6. חיווט שלב אחר שלב: עמדת החיווט ---------- */
const STEPS = ['חיתוך', 'קילוף ושרוול', 'שרוולי סימון', 'חיבור מאיפה', 'חיבור לאן', 'בדיקת משיכה'];
const session = { marks: [], streak: 0, checks: {}, milestones: {} };
const speaker = new Speaker();
const vpref = (() => { try { return JSON.parse(localStorage.getItem('cabinet-wiring-voice') || '{}'); } catch { return {}; } })();
const saveV = () => { try { localStorage.setItem('cabinet-wiring-voice', JSON.stringify(vpref)); } catch { /* פרטי */ } };
speaker.rate = Number(vpref.rate) || 0.95;
speaker.voiceName = vpref.voice || '';

function wiringGroups() { return E.wireOrder(P, L); }
function wiringList() {
  const groups = wiringGroups();
  const sel = $('#wGroup');
  sel.innerHTML = `<option value="all">כל החוטים בסדר החיווט (${P.wires.length})</option>` + groups.map((g) => {
    const d = g.wires.filter((w) => raw.done[w.id]).length;
    return `<option value="${g.group.id}" ${wiring.group === g.group.id ? 'selected' : ''}>${esc(g.group.he)} (${d}/${g.wires.length})</option>`;
  }).join('');
  if (/^comp:/.test(wiring.group)) {
    const t = wiring.group.slice(5);
    const ws = groups.flatMap((g) => g.wires).filter((w) => w.from.tag === t || w.to.tag === t);
    const c = compBy()[t] || {};
    sel.insertAdjacentHTML('afterbegin', `<option value="${esc(wiring.group)}" selected>הרכיב ${esc(t)} ${esc(c.name || '')} (${ws.filter((w) => raw.done[w.id]).length}/${ws.length})</option>`);
    return ws;
  }
  return (wiring.group === 'all' ? groups : groups.filter((g) => g.group.id === wiring.group)).flatMap((g) => g.wires);
}

function stationStats() {
  const total = P.wires.length, d = P.wires.filter((w) => raw.done[w.id]).length;
  const pct = total ? Math.round(100 * d / total) : 0;
  $('#wRing').style.strokeDasharray = `${pct} 100`;
  $('#wPct').textContent = pct + '%';
  $('#stDone').textContent = d;
  $('#stLeft').textContent = total - d;
  $('#stStreak').textContent = session.streak;
  /* זמן לסיום: לפי הקצב של החוטים האחרונים בסשן הזה */
  const m = session.marks.slice(-12);
  let eta = '—';
  if (m.length >= 3 && total - d > 0) {
    const per = (m[m.length - 1] - m[0]) / (m.length - 1);
    const min = Math.round(per * (total - d) / 60000);
    eta = min < 60 ? `${min} דק'` : `${Math.floor(min / 60)} ש' ${min % 60} דק'`;
  }
  $('#stEta').textContent = eta;
  $('#wProgText').textContent = `${d} מתוך ${total} חוברו`;
  $('#wGroups').innerHTML = wiringGroups().map((g) => {
    const gd = g.wires.filter((w) => raw.done[w.id]).length;
    const col = C.COLORS[C.FUNCS[g.group.funcs[0]].color];
    return `<button type="button" class="gpill${wiring.group === g.group.id ? ' on' : ''}${gd === g.wires.length ? ' full' : ''}" data-g="${g.group.id}">
      <span class="sw" style="${swStyle(col)}"></span><span class="gp-name">${esc(g.group.he)}</span><span class="gp-n">${gd}/${g.wires.length}</span>
      <i style="width:${Math.round(100 * gd / g.wires.length)}%"></i></button>`;
  }).join('');
}

function renderWiring() {
  stationStats();
  const list = wiringList();
  const card = $('#wireCard');
  if (!list.length) { card.innerHTML = '<p class="muted">אין חוטים בפרויקט. העלו תכנית או הוסיפו חוטים ברשימת החוטים.</p>'; return; }
  if (selected && list.some((w) => w.id === selected)) wiring.idx = list.findIndex((w) => w.id === selected);
  wiring.idx = Math.max(0, Math.min(list.length - 1, wiring.idx));
  const w = list[wiring.idx];
  const cb = compBy();
  const A = cb[w.from.tag] || {}, B = cb[w.to.tag] || {};
  const r = L.routes[w.id];
  const route = E.routeHe(L, w.id);
  const checks = session.checks[w.id] || (session.checks[w.id] = raw.done[w.id] ? STEPS.map(() => true) : STEPS.map(() => false));
  card.innerHTML = `<div class="head">
      <div><div class="big-no" translate="no">${esc(w.no)}</div>
        <div class="small muted">חוט ${wiring.idx + 1} מתוך ${list.length} · ${esc(C.FUNCS[w.func].he)}${w.page ? ` · עמוד ${w.page} בתכנית` : ''}</div></div>
      <span class="fbadge big">${esc(C.FUNCS[w.func].short)}</span>
    </div>
    <div class="wr-wrap">${wireSvg(w, { C, len: r && r.len ? Math.round(r.len / 10) : 0, done: raw.done[w.id],
      fromLabel: [w.from.tag + ':' + w.from.term, (A.name || '').slice(0, 30)], toLabel: [w.to.tag + ':' + w.to.term, (B.name || '').slice(0, 30)] })}</div>
    ${route.length ? `<p class="route"><b>מסלול:</b> ${route.map((x) => `<span>${esc(x)}</span>`).join('<i>←</i>')}</p>` : ''}
    <ol class="chk" aria-label="שלבי החיווט של החוט">${STEPS.map((t, i) => `<li><button type="button" data-chk="${i}" aria-pressed="${checks[i]}"><span class="n">${i + 1}</span>${esc(t)}</button></li>`).join('')}</ol>
    ${wireDetailHtml(w, { big: true })}
    <div class="confetti" aria-hidden="true"></div>`;
  $('#wDone').textContent = raw.done[w.id] ? 'ביטול הסימון' : 'חוברו שני הקצוות ✓';
  $('#wDone').classList.toggle('is-done', Boolean(raw.done[w.id]));
  if (!miniView) miniView = new CabinetView($('#miniHost'), { mini: true, onHover: (id, ev) => showTip(id, ev), onSelect: () => {} });
  if (miniView.ver !== ver) { miniView.render(P, L, { C }); miniView.ver = ver; }
  miniView.setDone(doneSet());
  miniView.select(w.id, false);
  miniView.focusWire(w.id);
  selected = w.id;
  /* כתוביות באנגלית */
  const en = englishSteps(w, P, L, C, E);
  $('#vSubs').innerHTML = en.map((t, i) => `<li data-i="${i}">${esc(t)}</li>`).join('');
  wiring.en = en;
  if (vpref.auto && wiring.lastSpoken !== w.id) { wiring.lastSpoken = w.id; speak(); }
}

function speak() {
  if (!speaker.ok) { toast('הדפדפן לא תומך בהקראה. נסו Chrome, Edge או Safari.'); return; }
  speaker.onSentence = (i) => { $$('#vSubs li').forEach((li) => li.classList.toggle('on', Number(li.dataset.i) === i)); const li = $(`#vSubs li[data-i="${i}"]`); if (li) li.scrollIntoView({ block: 'nearest' }); };
  speaker.onEnd = () => $$('#vSubs li').forEach((li) => li.classList.remove('on'));
  speaker.speak(wiring.en || []);
}

function fillVoices() {
  const sel = $('#vVoice');
  const vs = speaker.voices;
  const best = speaker.pick();
  sel.innerHTML = vs.length ? vs.map((v) => `<option value="${esc(v.name)}" ${best && best.name === v.name ? 'selected' : ''}>${esc(v.name)}${speaker.isFemale(v) ? ' ♀' : ''} (${esc(v.lang)})</option>`).join('') : '<option>אין קולות באנגלית במכשיר</option>';
  $('#vNote').textContent = !speaker.ok ? 'הדפדפן לא תומך בהקראה.' : best && speaker.isFemale(best) ? `קול נשי: ${best.name}. הקולות מגיעים ממערכת ההפעלה; ב-Chrome ו-Edge יש קולות איכותיים במיוחד.` : 'לא נמצא במכשיר קול נשי באנגלית, אז הקול מוגבה מעט. אפשר להוסיף קול (למשל Microsoft Jenny / Aria ב-Windows, Samantha ב-Mac/iPhone) ולבחור אותו כאן.';
}

function celebrate(card) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = card.querySelector('.confetti');
  if (!box) return;
  const cols = ['#c4743a', '#a85a26', '#1f4fd1', '#2f9e44', '#f2c21b', '#2b3035'];
  box.innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="--x:${Math.round((Math.random() - 0.5) * 360)}px;--y:${Math.round(-60 - Math.random() * 160)}px;--r:${Math.round(Math.random() * 540)}deg;background:${cols[i % cols.length]};animation-delay:${Math.random() * 80}ms"></i>`).join('');
  setTimeout(() => { box.innerHTML = ''; }, 1100);
}

function markCurrent() {
  const list = wiringList(); const w = list[wiring.idx]; if (!w) return;
  const was = raw.done[w.id];
  toggleDone(w.id);
  if (was) { session.streak = 0; session.checks[w.id] = STEPS.map(() => false); renderWiring(); return; }
  session.marks.push(Date.now()); session.streak++;
  session.checks[w.id] = STEPS.map(() => true);
  if (vpref.sfx !== false) sfx('click');
  const card = $('#wireCard');
  card.querySelector('.wire-render') && card.querySelector('.wire-render').classList.add('is-done');
  celebrate(card);
  /* אבני דרך: רבע, חצי, שלושה רבעים, הכל */
  const d = P.wires.filter((x) => raw.done[x.id]).length, pct = Math.floor(100 * d / P.wires.length);
  const ms = [25, 50, 75, 100].filter((m) => pct >= m && !session.milestones[m]).pop();
  if (ms) {
    [25, 50, 75, 100].forEach((m) => { if (m <= ms) session.milestones[m] = true; });
    if (vpref.sfx !== false) setTimeout(() => sfx('milestone'), 150);
    toast(ms === 100 ? 'כל החוטים חוברו! עכשיו לבדיקות: "הרכבה ובדיקות".' : `${ms}% מהחוטים חוברו. ממשיכים!`, 5000);
    if (vpref.auto && speaker.ok) speaker.say(ms === 100 ? 'Excellent. All wires are connected. Proceed to inspection and testing.' : `Great work. ${ms} percent complete.`);
  }
  if (P.wires.every((x) => raw.done[x.id])) { setTimeout(renderWiring, 700); return; }
  setTimeout(() => wiringStep(1), 650);
}

function wiringStep(dir) {
  const list = wiringList();
  if (!list.length) return;
  let i = wiring.idx;
  const skip = $('#wSkipDone').checked;
  for (let k = 0; k < list.length; k++) {
    i = (i + dir + list.length) % list.length;
    if (!skip || !raw.done[list[i].id]) break;
  }
  wiring.idx = i; selected = list[i].id;
  if (vpref.sfx !== false) sfx('step');
  renderWiring();
}

/* ---------- 6. הרכבה ---------- */
function renderAssembly() {
  const steps = E.assemblySteps(P, L);
  raw.stepsDone = raw.stepsDone || {};
  $('#stepsList').innerHTML = steps.map((s) => {
    let extra = '';
    if (s.wires) {
      const d = s.wires.filter((id) => raw.done[id]).length;
      extra = `<div class="st-actions"><span class="small muted">${d}/${s.wires.length} חוברו</span><button class="btn ghost small" type="button" data-wgroup="${s.id.replace('wire-', '')}">לחיווט שלב אחר שלב</button></div>`;
    }
    const isDone = s.wires ? s.wires.every((id) => raw.done[id]) : raw.stepsDone[s.id];
    return `<li class="${isDone ? 'done' : ''}"><div class="st-head"><strong>${esc(s.title)}</strong>${s.wires ? '' : `<label class="check"><input type="checkbox" data-step="${s.id}" ${raw.stepsDone[s.id] ? 'checked' : ''}> בוצע</label>`}</div>
      <ul>${s.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${extra}</li>`;
  }).join('');
  $('#cutTable').innerHTML = `<thead><tr><th>סוג</th><th>ממ"ר</th><th>צבע</th><th>חוטים</th><th>אורך</th></tr></thead><tbody>` +
    E.cutList(P, L).map((c) => `<tr><td class="mono">${esc(c.wireType)}</td><td>${esc(C.fmtSection(c.section))}</td><td><span class="sw" style="${swStyle(C.COLORS[c.color])}"></span>${esc(C.COLORS[c.color].he)}</td><td>${c.count}</td><td>${c.mm ? (c.mm / 1000 * 1.1).toFixed(1) + ' מ\'' : ''}${c.ext ? (c.mm ? ' + ' : '') + c.ext + ' לשטח' : ''}</td></tr>`).join('') + '</tbody>';
  /* שרוולים: לכל הדק בארון או בדלת — בודד, או TWIN כשיש שני חוטים */
  const cb = compBy();
  const pins = {};
  P.wires.forEach((w) => [w.from, w.to].forEach((e) => {
    const c = cb[e.tag];
    if (!c || c.zone === 'field' || /גשר|פס הארקה/.test(w.wireType)) return;
    const k = e.tag + ':' + e.term;
    (pins[k] = pins[k] || []).push(w.section);
  }));
  const fer = {};
  let warn = 0;
  Object.values(pins).forEach((secs) => {
    if (secs.length > 2) warn++;
    const twin = secs.length === 2;
    const f = C.ferrule(Math.max(...secs), twin);
    const k = (twin ? 'TWIN ' : '') + f.size + '|' + f.color;
    fer[k] = fer[k] || { twin, f, n: 0 };
    fer[k].n++;
  });
  $('#ferruleTable').innerHTML = `<thead><tr><th>פריט</th><th>כמות</th></tr></thead><tbody>` +
    Object.values(fer).sort((a, b) => a.f.size - b.f.size).map((x) => `<tr><td><span class="sw" style="${swStyle(C.COLORS[x.f.color])}"></span>${x.twin ? 'שרוול TWIN' : 'שרוול'} ${x.f.size} ממ"ר (${esc(C.COLORS[x.f.color].he)})</td><td>${x.n}</td></tr>`).join('') +
    `<tr><td>שרוולי סימון לחוטים (2 לכל חוט)</td><td>${P.wires.length * 2}</td></tr>` +
    (warn ? `<tr><td colspan="2" class="inf">${warn} הדקים עם יותר משני חוטים: צריך גשר או מהדק נוסף.</td></tr>` : '') + '</tbody>';
}

/* ---------- 7. הדפסה והגדרות ---------- */
function renderExport() {
  const s = E.settingsOf(raw);
  $('#sName').value = raw.name;
  $('#sPhase').value = s.phaseColors; $('#sControl').value = s.control; $('#sTech').value = s.termTech; $('#sPlate').value = String(s.plateWidth);
  const secOpts = (v) => C.SECTIONS.map((x) => `<option value="${x}" ${Number(v) === x ? 'selected' : ''}>${x}</option>`).join('');
  $('#sPow').innerHTML = secOpts(s.powerSection); $('#sCtl').innerHTML = secOpts(s.controlSection); $('#sPe').innerHTML = secOpts(s.peSection);
}

function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileBase = () => ((raw && raw.name) || (site && site.name) || 'cabinet').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);

function drawingSvg() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:900px';
  document.body.appendChild(host);
  const v = new CabinetView(host, {});
  v.render(P, L, { C });
  v.setDone(doneSet());
  const b = v.bounds;
  v.svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
  v.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  v.svg.setAttribute('width', Math.round(b.w)); v.svg.setAttribute('height', Math.round(b.h));
  const out = v.svg.outerHTML;
  host.remove();
  return out;
}

function openPrint(html) {
  const win = window.open('', '_blank');
  if (!win) { download(fileBase() + '.html', html, 'text/html'); toast('החלון נחסם. הקובץ ירד: פתחו אותו והדפיסו.'); return; }
  win.document.open(); win.document.write(html); win.document.close();
}

/* ---------- עריכת חוט ---------- */
function openWireDialog(id) {
  const w = id ? raw.wires.find((x) => x.id === id) : null;
  const d = id ? wireById(id) : null;
  const f = $('#wireForm');
  $('#wdTitle').textContent = w ? `עריכת חוט ${d.no}` : 'חוט חדש';
  f.func.innerHTML = `<option value="">אוטומטי${d ? ' (' + C.FUNCS[d.func].short + ')' : ''}</option>` + Object.entries(C.FUNCS).map(([k, v]) => `<option value="${k}">${esc(v.he)}</option>`).join('');
  f.color.innerHTML = `<option value="">לפי התקן${d ? ' (' + C.COLORS[d.color].he + ')' : ''}</option>` + Object.entries(C.COLORS).map(([k, v]) => `<option value="${k}">${esc(v.he)} (${k})</option>`).join('');
  f.section.innerHTML = `<option value="">ברירת מחדל${d ? ' (' + d.section + ')' : ''}</option>` + C.SECTIONS.map((x) => `<option value="${x}">${x}</option>`).join('');
  $('#tagList').innerHTML = P.components.map((c) => `<option value="${esc(c.tag)}">${esc(c.name)}</option>`).join('');
  const v = w || {};
  f.no.value = v.no || ''; f.func.value = C.FUNCS[v.func] ? v.func : '';
  f.fromTag.value = v.from ? v.from.tag : ''; f.fromTerm.value = v.from ? v.from.term : '';
  f.toTag.value = v.to ? v.to.tag : ''; f.toTerm.value = v.to ? v.to.term : '';
  f.color.value = C.colorCode(v.color) && v.colorSource !== 'standard' ? C.colorCode(v.color) : '';
  f.section.value = v.section && !d?.sectionInferred ? String(Number(v.section)) : '';
  f.wireType.value = v.wireType || ''; f.potential.value = v.potential || ''; f.page.value = v.page || '';
  f.desc.value = v.desc || ''; f.explain.value = v.explain || '';
  f.dataset.id = id || '';
  $('#wdDelete').hidden = !w;
  $('#wireDialog').showModal();
}

function saveWireDialog() {
  const f = $('#wireForm');
  const id = f.dataset.id;
  const data = {
    no: f.no.value.trim(), func: f.func.value, from: { tag: E.normTag(f.fromTag.value), term: E.normTerm(f.fromTerm.value) },
    to: { tag: E.normTag(f.toTag.value), term: E.normTerm(f.toTerm.value) }, color: f.color.value, colorSource: f.color.value ? 'drawing' : '',
    section: f.section.value ? Number(f.section.value) : null, wireType: f.wireType.value.trim(), potential: f.potential.value.trim(),
    page: f.page.value ? Number(f.page.value) : null, desc: f.desc.value.trim(), explain: f.explain.value.trim()
  };
  if (!data.from.tag || !data.to.tag || !data.from.term || !data.to.term) { toast('צריך תג והדק בשני הקצוות.'); return false; }
  if (id) { const w = raw.wires.find((x) => x.id === id); Object.assign(w, data); }
  else { const w = { ...data, id: newId() }; raw.wires.push(w); selected = w.id; }
  save(); derive(); rerender();
  toast('החוט נשמר.');
  return true;
}

/* ---------- חיבור אירועים ---------- */
function bind() {
  window.addEventListener('hashchange', route);
  /* קבצים */
  const pick = (inp, into) => inp.addEventListener('change', () => { handleFile(inp.files[0], into); inp.value = ''; });
  pick($('#pdfInput'), false); pick($('#pdfInputTop'), false); pick($('#pdfInputPlan'), true);
  $('#jsonInput').addEventListener('change', (e) => { importJson(e.target.files[0]); e.target.value = ''; });
  const drop = $('#drop');
  drop.addEventListener('click', () => $('#pdfInput').click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#pdfInput').click(); } });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0], false));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    if (e.target.closest('#drop, #siteDrop')) return;
    e.preventDefault();
    if (tab === 'site' && site) { if (e.dataTransfer.files.length) siteIngest(e.dataTransfer.files); return; }
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], tab !== 'home');
  });
  bindSite();
  bindComp();

  $('#openDemo').onclick = () => {
    raw = newProject('דוגמה: לוח משאבה עם בקר', Demo.project());
    raw.id = newId('p'); raw.done = {}; raw.stepsDone = {};
    raw.wires.forEach((w) => { w.id = newId(); });
    raw.status = 'פרויקט לדוגמה: 57 חוטים, 18 רכיבים. עברו ל"פריסת ארון" ועמדו על חוט כדי לראות את ההסבר.';
    save(); derive(); pages = [];
    location.hash = '#p/cabinet';
  };
  $('#newEmpty').onclick = () => { raw = newProject('פרויקט חדש'); save(); derive(); pages = []; location.hash = '#p/wires'; };
  $('#projList').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) { e.preventDefault(); openProject(b.dataset.open, 'plan'); } });

  /* תכנית */
  $('#thumbs').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { curPage = Number(b.dataset.page); renderPages(); } });
  $('#pageZoom').onclick = (e) => { const on = $('#page').classList.toggle('zoom'); e.target.setAttribute('aria-pressed', on); e.target.textContent = on ? 'הקטנה' : 'הגדלה'; };
  $('#runClaude').onclick = runAuto;
  $('#aiStop').onclick = () => aiAbort && aiAbort.abort();
  $('#runPaste').onclick = openPaste;
  $('#runLocal').onclick = () => {
    const ex = E.extractFromText(pages);
    if (!ex.wires.length) { toast('לא נמצאו בטקסט שורות עם שני קצוות (כמו ‎-X1:3 ‎-K1:A1). לתכנית גרפית השתמשו ב-Claude.', 7000); return; }
    applyResult({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text');
  };
  $('#hint').addEventListener('change', (e) => { raw.hint = e.target.value; save(); });
  [['#mTitle', 'title'], ['#mDrawing', 'drawingNo'], ['#mRev', 'revision'], ['#mSupply', 'supply'], ['#mControl', 'control']].forEach(([s, k]) => {
    $(s).addEventListener('change', (e) => { raw.meta = raw.meta || {}; raw.meta[k] = e.target.value; save(); P.meta = raw.meta; });
  });
  $('#copyPrompt').onclick = async () => {
    const txt = Pr.copyPrompt({ hint: raw.hint, text: pages.length ? pagesText().slice(0, 20000) : '' });
    try { await navigator.clipboard.writeText(txt); toast('הבקשה הועתקה. הדביקו אותה ב-Claude.ai יחד עם ה-PDF.'); }
    catch { $('#pasteBox').value = txt; toast('לא הצלחתי להעתיק אוטומטית. הבקשה בתיבה: העתיקו אותה ונקו את התיבה.'); }
  };
  $('#pasteOk').onclick = () => {
    try {
      const res = Pr.parse($('#pasteBox').value);
      if (applyResult(res, 'paste')) $('#pasteDialog').close();
    } catch (err) { $('#pasteErr').textContent = err.message; }
  };

  /* רכיבים */
  $('#partsSearch').addEventListener('input', renderParts);
  $('#partsTable').addEventListener('change', (e) => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    updateComp(el.closest('tr').dataset.tag, el.dataset.k, el.value);
  });
  $('#partsTable').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const tag = del.dataset.del;
      const n = raw.wires.filter((w) => E.normTag(w.from.tag) === tag || E.normTag(w.to.tag) === tag).length;
      if (n && !confirm(`ל-${tag} מחוברים ${n} חוטים. למחוק גם אותם?`)) return;
      raw.components = raw.components.filter((c) => E.normTag(c.tag) !== tag);
      raw.wires = raw.wires.filter((w) => E.normTag(w.from.tag) !== tag && E.normTag(w.to.tag) !== tag);
      save(); derive(); renderParts(); return;
    }
    const hl = e.target.closest('[data-hl]');
    if (hl) { location.hash = '#p/cabinet'; setTimeout(() => openComp(hl.dataset.hl), 80); }
  });
  $('#addPart').onclick = () => {
    const tag = E.normTag(prompt('תג הרכיב (למשל ‎-K5):') || '');
    if (!tag) return;
    if (raw.components.some((c) => E.normTag(c.tag) === tag)) { toast('התג כבר קיים.'); return; }
    raw.components.push({ tag, name: '' });
    save(); derive(); renderParts();
  };

  /* חוטים */
  $('#wireSearch').addEventListener('input', (e) => { wf.search = e.target.value.trim(); renderWireRows(); });
  $('#wireColor').addEventListener('change', (e) => { wf.color = e.target.value; renderWireRows(); });
  $('#wireState').addEventListener('change', (e) => { wf.state = e.target.value; renderWireRows(); });
  $('#wiresTable').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) select(tr.dataset.id); });
  $('#wiresTable').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') select(tr.dataset.id); });
  $('#addWire').onclick = () => openWireDialog(null);
  const csvW = () => download(fileBase() + '-wires.csv', E.wireListCsv(P, L), 'text/csv;charset=utf-8');
  $('#csvWires').onclick = csvW; $('#csvWires2').onclick = csvW;

  /* ארון */
  $('#zoomIn').onclick = () => cabView && cabView.zoom(1 / 1.3);
  $('#zoomOut').onclick = () => cabView && cabView.zoom(1.3);
  $('#zoomFit').onclick = () => { if (cabView) { cabView.fit(); cabView.highlight(null); cabView.hlTag = null; } };
  $('#cabSearch').addEventListener('change', (e) => {
    const q = e.target.value.trim(); if (!q) return;
    const tag = E.normTag(q);
    if (compBy()[tag]) { openComp(tag); const b = L.comps[tag]; if (b) { cabView.vb = { x: b.x - 150, y: b.y - 150, w: b.w + 300, h: b.h + 300 }; cabView.apply(); } return; }
    const w = P.wires.find((x) => x.no === q || x.no.toUpperCase() === q.toUpperCase());
    if (w) { select(w.id); cabView.focusWire(w.id); } else toast('לא נמצא רכיב או חוט בשם הזה.');
  });

  /* תלת־ממד */
  $('#t3Door').onclick = (e) => { if (!view3d) return; const open = !view3d.doorOpen; view3d.setDoor(open); e.currentTarget.textContent = open ? 'לסגור את הדלת' : 'לפתוח את הדלת'; e.currentTarget.setAttribute('aria-pressed', open); };
  $('#t3Covers').onclick = (e) => { if (!view3d) return; const on = !view3d.coversOn; view3d.setCovers(on); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('on', on); };
  $$('[data-view3]').forEach((b) => { b.onclick = () => view3d && view3d.view(b.dataset.view3); });
  $('#t3Png').onclick = () => {
    if (!view3d || !view3d.renderer) return;
    const a = document.createElement('a'); a.href = view3d.png(); a.download = fileBase() + '-3d.png';
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* מגירה */
  $('#dClose').onclick = () => select(null);
  $('#dDone').onclick = () => selected && toggleDone(selected);
  $('#dShowCab').onclick = () => { const id = selected; location.hash = '#p/cabinet'; setTimeout(() => { if (cabView) { cabView.select(id, false); cabView.focusWire(id); } }, 60); };
  $('#dShowPdf').onclick = () => selected && showWireInPdf(selected);
  $('#dWire').onclick = () => { wiring.group = 'all'; location.hash = '#p/wiring'; };
  $('#dEdit').onclick = () => selected && openWireDialog(selected);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#drawer').hidden && !document.querySelector('dialog[open]')) select(null);
  });

  /* חיווט */
  $('#wPrev').onclick = () => wiringStep(-1);
  $('#wNext').onclick = () => wiringStep(1);
  $('#wDone').onclick = markCurrent;
  $('#wGroup').addEventListener('change', (e) => { wiring.group = e.target.value; wiring.idx = 0; selected = null; renderWiring(); });
  $('#wGroups').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; wiring.group = wiring.group === b.dataset.g ? 'all' : b.dataset.g; wiring.idx = 0; selected = null; renderWiring(); });
  $('#wSkipDone').addEventListener('change', renderWiring);
  $('#wireCard').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chk]'); if (!b) return;
    const list = wiringList(); const w = list[wiring.idx]; if (!w) return;
    const c = session.checks[w.id]; const i = Number(b.dataset.chk);
    c[i] = !c[i];
    b.setAttribute('aria-pressed', c[i]);
    if (c[i] && vpref.sfx !== false) sfx('step');
    if (c.every(Boolean) && !raw.done[w.id]) markCurrent();
  });
  document.addEventListener('keydown', (e) => {
    if (tab !== 'wiring' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.target.closest('input, select, textarea, [contenteditable]')) return;
    if (e.key === 'Enter' || e.key === ' ') { if (e.target.closest('button') && e.key === ' ') return; e.preventDefault(); markCurrent(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); wiringStep(1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); wiringStep(-1); }
    else if (e.key === 'r' || e.key === 'R' || e.key === 'ר') speak();
    else if (/^[1-6]$/.test(e.key)) { const b = $(`#wireCard [data-chk="${Number(e.key) - 1}"]`); if (b) b.click(); }
  });
  /* קול */
  $('#vPlay').onclick = speak;
  $('#vStop').onclick = () => speaker.stop();
  $('#vAuto').checked = Boolean(vpref.auto);
  $('#vSfx').checked = vpref.sfx !== false;
  $('#vRate').value = speaker.rate;
  $('#vAuto').onchange = (e) => { vpref.auto = e.target.checked; saveV(); if (e.target.checked) { wiring.lastSpoken = null; speak(); } else speaker.stop(); };
  $('#vSfx').onchange = (e) => { vpref.sfx = e.target.checked; saveV(); };
  $('#vRate').oninput = (e) => { speaker.rate = Number(e.target.value); vpref.rate = speaker.rate; saveV(); };
  $('#vVoice').onchange = (e) => { speaker.voiceName = e.target.value; vpref.voice = e.target.value; saveV(); fillVoices(); speak(); };
  speaker.onVoices = fillVoices;
  fillVoices();
  window.addEventListener('hashchange', () => { if (!/wiring/.test(location.hash)) speaker.stop(); });

  /* הרכבה */
  $('#stepsList').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-step]'); if (!cb) return;
    raw.stepsDone[cb.dataset.step] = cb.checked; save(); renderAssembly();
  });
  $('#stepsList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wgroup]'); if (!b) return;
    wiring.group = b.dataset.wgroup; wiring.idx = 0; selected = null; location.hash = '#p/wiring';
  });

  /* הגדרות וייצוא */
  const setS = (k, v) => { raw.settings = raw.settings || {}; raw.settings[k] = v; save(); derive(); if (cabView) cabView.vb = null; toast('ההגדרה נשמרה. הצבעים, החתכים והפריסה חושבו מחדש.'); };
  $('#sName').addEventListener('change', (e) => { raw.name = e.target.value.trim() || raw.name; save(); $('#projTitle').textContent = raw.name; });
  $('#sPhase').addEventListener('change', (e) => setS('phaseColors', e.target.value));
  $('#sControl').addEventListener('change', (e) => setS('control', e.target.value));
  $('#sTech').addEventListener('change', (e) => setS('termTech', e.target.value));
  $('#sPlate').addEventListener('change', (e) => setS('plateWidth', e.target.value === 'auto' ? 'auto' : Number(e.target.value)));
  $('#sPow').addEventListener('change', (e) => setS('powerSection', Number(e.target.value)));
  $('#sCtl').addEventListener('change', (e) => setS('controlSection', Number(e.target.value)));
  $('#sPe').addEventListener('change', (e) => setS('peSection', Number(e.target.value)));
  $('#printBook').onclick = () => openPrint(bookHtml({ P, L, svg: drawingSvg(), done: doneSet(), C, E, steps: E.assemblySteps(P, L) }));
  $('#printLabels').onclick = () => openPrint(labelsHtml({ P, C }));
  $('#csvBom').onclick = () => download(fileBase() + '-components.csv', E.bomCsv(P), 'text/csv;charset=utf-8');
  $('#svgOut').onclick = () => download(fileBase() + '-cabinet.svg', drawingSvg(), 'image/svg+xml');
  $('#jsonOut').onclick = () => download(fileBase() + '.json', JSON.stringify({ app: 'cabinet-wiring', version: 1, project: { ...raw, pdf: null } }, null, 1), 'application/json');
  $('#resetDone').onclick = () => { if (confirm('לאפס את כל סימוני החיווט?')) { raw.done = {}; raw.stepsDone = {}; save(); updatePill(); toast('הסימונים אופסו.'); } };
  $('#delProject').onclick = async () => {
    if (!confirm(`למחוק את "${raw.name}" מהדפדפן?`)) return;
    await files.delPrefix(raw.id + ':');
    state.projects = state.projects.filter((p) => p.id !== raw.id);
    state.sites.forEach((st) => { st.cabinets = st.cabinets.filter((x) => x !== raw.id); st.files = st.files.filter((f) => f.pid !== raw.id); st.links = st.links.filter((l) => l.a.pid !== raw.id && l.b.pid !== raw.id); });
    raw = null; P = L = null; state.current = null; saveAll(state);
    location.hash = '#home';
  };

  /* דיאלוג חוט */
  $('#wireForm').addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'ok') { if (!saveWireDialog()) e.preventDefault(); }
  });
  $('#wdDelete').onclick = () => {
    const id = $('#wireForm').dataset.id;
    if (!id || !confirm('למחוק את החוט?')) return;
    raw.wires = raw.wires.filter((w) => w.id !== id); delete raw.done[id];
    $('#wireDialog').close(); select(null); save(); derive(); rerender();
  };
}

/* ---------- כרטיס רכיב: לוחצים על כל רכיב (בציור, בתלת־ממד, ברשימה, באתר) ומקבלים מה הוא עושה ואת כל החיווט שלו ---------- */
let drawerMode = null, navInDrawer = false, pending3d = null;
const drawerHist = [];

function compHtml(cP, cL, tag, done) {
  const info = E.compWiring(cP, tag);
  if (!info) return null;
  const c = info.comp, t = E.typeInfo(c.type);
  const by = Object.fromEntries(cP.components.map((x) => [x.tag, x]));
  const b = cL.comps[tag] || {};
  const rail = b.rail != null && b.zone === 'cabinet' ? cL.rails[b.rail] : null;
  const nDone = info.rows.filter((r) => done[r.wire.id]).length;
  const ep = (e) => `<button type="button" class="ep-link" data-comp="${esc(e.tag)}" translate="no">${esc(e.tag)}:${esc(e.term)}</button>`;
  const nm = (tg) => { const x = by[tg]; return x ? (x.name || E.typeInfo(x.type).he) : ''; };
  const rows = info.rows.map((r) => {
    const w = r.wire, col = C.COLORS[w.color] || C.COLORS.BK;
    const via = r.via.map((lvl) => `<div class="via">${lvl.map((e) => `<span>← חוט <b class="mono">${esc(e.wire.no)}</b> ${ep(e.at)} <span class="muted">${esc(nm(e.at.tag)).slice(0, 34)}</span></span>`).join('')}</div>`).join('');
    return `<tr class="${done[w.id] ? 'done' : ''}">
      <td class="st"></td>
      <td><b class="mono" translate="no">${esc(r.term)}</b><div class="small muted">${esc(r.role.role)}</div></td>
      <td><button type="button" class="wno" data-wire="${esc(w.id)}" translate="no">${esc(w.no)}</button><div class="small muted">${esc(C.FUNCS[w.func].short)}</div></td>
      <td><span class="sw" style="${swStyle(col)}"></span>${esc(col.he)}<div class="small muted">${esc(C.fmtSection(w.section))} ממ"ר</div></td>
      <td>${ep(r.other)}<div class="small muted">${esc(nm(r.other.tag))}</div>${via}</td></tr>`;
  }).join('');
  return `<div class="comp-head"><span class="ctag mono" translate="no">${esc(tag)}</span><div><b>${esc(c.name || t.he)}</b><div class="small muted">${esc(t.he)} · ${esc(C.ZONES[c.zone] || '')}</div></div></div>
    <p class="comp-purpose">${esc(info.purpose)}</p>
    <dl class="kv">
      ${c.desc ? `<dt>תיאור</dt><dd>${esc(c.desc)}</dd>` : ''}
      ${c.maker || c.partNo ? `<dt>יצרן / מק"ט</dt><dd>${esc([c.maker, c.partNo].filter(Boolean).join(' · '))}</dd>` : ''}
      ${rail ? `<dt>מיקום</dt><dd>מסילה ${b.rail + 1} (${esc(C.ROWS[rail.row])}), ${Math.round(b.x)} מ"מ משמאל הפלטה</dd>` : ''}
      ${b.w && c.zone === 'cabinet' ? `<dt>מידות</dt><dd class="mono">${Math.round(b.w)}×${Math.round(b.h)}×${E.depthOf(c.type)} מ"מ</dd>` : ''}
      ${info.strips.length ? `<dt>דרך המהדקים</dt><dd class="mono">${esc(info.strips.join(', '))}</dd>` : ''}
      ${info.cable ? `<dt>כבל לשטח</dt><dd class="mono">${esc(info.cable)}</dd>` : ''}
      <dt>חוטים</dt><dd>${info.rows.length}${info.rows.length ? ` · ${nDone} חוברו` : ''}</dd>
    </dl>
    <h3 class="comp-h">${c.zone === 'field' ? 'החיווט מהמכשיר אל הלוח' : 'החיווט של הרכיב'}</h3>
    ${info.rows.length ? `<div class="table-wrap"><table class="tbl comp-tbl"><thead><tr><th></th><th>הדק</th><th>חוט</th><th>צבע וחתך</th><th>מחובר אל</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted">לחיצה על מספר חוט פותחת את כל הפרטים שלו. לחיצה על הדק עוברת לרכיב שבצד השני.</p>` : '<p class="muted">לרכיב הזה אין חוטים ברשימה.</p>'}`;
}

function setDrawer(title, html, kind) {
  if (!navInDrawer) drawerHist.length = 0;
  navInDrawer = false;
  $('#dTitle').textContent = title;
  $('#dBody').innerHTML = html;
  $('#dBody').scrollTop = 0;
  $('#cActions').hidden = kind !== 'comp';
  $('#dActions').hidden = kind !== 'wire';
  $('#dBack').hidden = !drawerHist.length;
  $('#drawer').setAttribute('aria-label', kind === 'comp' ? 'פרטי הרכיב' : 'פרטי החוט');
  $('#drawer').hidden = false;
}

const compWireIds = (cP, tag) => cP.wires.filter((w) => w.from.tag === tag || w.to.tag === tag).map((w) => w.id);

function openComp(tag) {
  if (!P) return;
  const html = compHtml(P, L, tag, raw.done || {});
  if (!html) { toast(`הרכיב ${tag} לא נמצא בפרויקט.`); return; }
  const c = compBy()[tag];
  drawerMode = { kind: 'comp', id: tag };
  setDrawer(`${tag} · ${c.name || E.typeInfo(c.type).he}`, html, 'comp');
  ['#cWire', '#cShowCab', '#cShow3d', '#cShowPdf'].forEach((s) => { $(s).hidden = false; });
  $('#cOpen').hidden = true;
  const ids = compWireIds(P, tag);
  $('#cWire').disabled = !ids.length;
  $('#cShowPdf').disabled = !pages.length || !P.wires.some((w) => ids.includes(w.id) && w.page);
  if (tab === 'cabinet' && cabView) { cabView.highlight(ids.length ? ids : null); cabView.hlTag = tag; }
  if (tab === 'three' && view3d) { view3d.selected = null; view3d.highlightIds(ids); }
}

function openSiteComp(pid, tag) {
  const c = siteData && siteData.cabs.find((x) => x.id === pid);
  if (!c) return;
  const html = compHtml(c.P, c.L, tag, c.raw.done || {});
  if (!html) return;
  const comp = c.P.components.find((x) => x.tag === tag);
  drawerMode = { kind: 'comp', id: tag, site: pid };
  setDrawer(`${tag} · ${comp.name || E.typeInfo(comp.type).he} · ${c.name}`, html, 'comp');
  ['#cWire', '#cShowCab', '#cShow3d', '#cShowPdf'].forEach((s) => { $(s).hidden = true; });
  $('#cOpen').hidden = false;
}

function compPdfWire(tag) { return P.wires.find((w) => (w.from.tag === tag || w.to.tag === tag) && w.page); }

function bindComp() {
  $('#dBody').addEventListener('click', async (e) => {
    const wb = e.target.closest('[data-wire]'), cb = e.target.closest('[data-comp]');
    if (!wb && !cb) return;
    e.preventDefault(); e.stopPropagation();
    if (drawerMode && drawerMode.site) {
      const pid = drawerMode.site;
      if (cb) { drawerHist.push(drawerMode); navInDrawer = true; openSiteComp(pid, cb.dataset.comp); return; }
      await openProject(pid, 'wires');
      setTimeout(() => select(wb.dataset.wire), 120);
      return;
    }
    if (drawerMode) drawerHist.push(drawerMode);
    navInDrawer = true;
    if (wb) select(wb.dataset.wire, 'drawer'); else openComp(cb.dataset.comp);
  });
  $('#dBack').onclick = () => {
    const m = drawerHist.pop();
    if (!m) return;
    navInDrawer = true;
    if (m.site) openSiteComp(m.site, m.id);
    else if (m.kind === 'wire') select(m.id, 'drawer');
    else openComp(m.id);
  };
  const tagNow = () => drawerMode && drawerMode.kind === 'comp' ? drawerMode.id : null;
  $('#cWire').onclick = () => { const t = tagNow(); if (!t) return; wiring.group = 'comp:' + t; wiring.idx = 0; selected = null; closeDrawer(); location.hash = '#p/wiring'; };
  $('#cShowCab').onclick = () => {
    const t = tagNow(); if (!t) return;
    location.hash = '#p/cabinet';
    setTimeout(() => {
      if (!cabView) return;
      cabView.highlight(compWireIds(P, t)); cabView.hlTag = t;
      const b = L.comps[t]; if (b) { cabView.vb = { x: b.x - 220, y: b.y - 180, w: b.w + 440, h: b.h + 360 }; cabView.apply(); }
      openComp(t);
    }, 80);
  };
  $('#cShow3d').onclick = () => {
    const t = tagNow(); if (!t) return;
    if (tab === 'three' && view3d && built3d === ver) { view3d.highlightIds(compWireIds(P, t)); view3d.focusComp(t); return; }
    pending3d = t; location.hash = '#p/three';
  };
  $('#cShowPdf').onclick = () => { const t = tagNow(); const w = t && compPdfWire(t); if (w) showWireInPdf(w.id); };
  $('#cOpen').onclick = async () => {
    const m = drawerMode; if (!m || !m.site) return;
    pending3d = m.id;
    await openProject(m.site, 'three');
  };
  /* תג רכיב בכל מקום בממשק של הפרויקט (רשימת רכיבים, קצוות של חוט) */
  document.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-comp]');
    if (!cb || !cb.isConnected || cb.closest('#dBody') || tab === 'site' || tab === 'home') return;
    e.preventDefault();
    openComp(cb.dataset.comp);
  });
}

/* ---------- אתרי התקנה: כמה ארונות, הכבלים ביניהם, הקבצים ומערך ההתקנה ---------- */
function newSite() {
  const s = { id: newId('s'), name: 'אתר חדש', address: '', created: Date.now(), cabinets: [], files: [], layout: {}, room: null, trayH: 2.6, links: [], ignored: [], stepsDone: {} };
  state.sites.unshift(s);
  saveAll(state);
  location.hash = '#site/' + s.id;
  setTimeout(() => { const n = $('#siteName'); if (n) { n.focus(); n.select(); } }, 80);
}

/* כל ארון באתר: השלמה, פריסה ומעטפת (נשמר בזיכרון לפי זמן העדכון) */
function siteCab(r) {
  const k = r.id + ':' + r.updated;
  if (cabCache.has(k)) return cabCache.get(k);
  const P1 = E.enrich(r);
  P1.meta = r.meta || {}; P1.name = r.name;
  const L1 = E.layout(P1);
  const enc = E.enclosure(P1, L1);
  const c = { id: r.id, name: r.name, raw: r, P: P1, L: L1, enc, done: P1.wires.filter((w) => r.done && r.done[w.id]).length };
  cabCache.set(k, c);
  return c;
}

function computeSite() {
  const cabs = site.cabinets.map((pid) => state.projects.find((p) => p.id === pid)).filter(Boolean).map(siteCab);
  const dims = {};
  cabs.forEach((c) => { dims[c.id] = { w: c.enc.w / 1000, h: (c.enc.h + (c.enc.plinth || 60)) / 1000, d: c.enc.d / 1000 }; });
  S.autoLayout(site, cabs, dims);
  const ids = new Set(cabs.map((c) => c.id));
  const links = site.links.filter((l) => ids.has(l.a.pid) && ids.has(l.b.pid)).map((l) => ({ ...l, cable: S.cableFor(l), length: S.linkLength(site, l, dims) }));
  const taken = new Set([...site.links.map((l) => l.id), ...(site.ignored || [])]);
  siteSugg = cabs.length > 1 ? S.suggest(cabs).filter((l) => !taken.has(l.id)) : [];
  const steps = S.installSteps(site, cabs, links, dims);
  return (siteData = { cabs, dims, links, steps });
}
const cabName = (pid) => { const c = siteData && siteData.cabs.find((x) => x.id === pid); return c ? c.name : '?'; };
const linkNo = (lid) => siteData.links.findIndex((l) => l.id === lid) + 1;
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

function renderSite() {
  if (!site) return;
  const { cabs, links, steps } = computeSite();
  if (document.activeElement !== $('#siteName')) $('#siteName').value = site.name;
  if (document.activeElement !== $('#siteAddr')) $('#siteAddr').value = site.address || '';
  $('#roomW').value = site.room.w; $('#roomD').value = site.room.d; $('#trayH').value = site.trayH || 2.6;
  const wires = cabs.reduce((s, c) => s + c.P.wires.length, 0), done = cabs.reduce((s, c) => s + c.done, 0);
  const meters = links.reduce((s, l) => s + (l.length || 0), 0);
  $('#siteStats').innerHTML = [['ארונות', cabs.length], ['חוטים בארונות', wires], ['חוברו', wires ? Math.round(done / wires * 100) + '%' : '—'], ['כבלים בין ארונות', links.length], ['מטר כבל', Math.round(meters)], ['קבצים', site.files.length]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('');
  /* כרטיסי ארונות */
  $('#siteCabs').innerHTML = cabs.length ? cabs.map((c, i) => {
    const pct = c.P.wires.length ? Math.round(c.done / c.P.wires.length * 100) : 0;
    const ext = S.externals(c.P);
    const lk = links.filter((l) => l.a.pid === c.id || l.b.pid === c.id).length;
    return `<article class="cab-card${siteSel && siteSel.pid === c.id ? ' on' : ''}" data-pid="${esc(c.id)}">
      <header><span class="cc-no num">${i + 1}</span><h3 title="${esc(c.name)}">${esc(c.name)}</h3></header>
      <p class="cc-meta"><span class="mono">${esc(c.P.meta.drawingNo || '')}</span> ${esc(c.enc.text)}</p>
      <div class="cc-bar" role="img" aria-label="${pct}% חוברו"><i style="width:${pct}%"></i></div>
      <p class="cc-nums num">${c.P.wires.length} חוטים · ${c.P.components.length} רכיבים · ${ext.length} מכשירי שטח · ${lk} כבלים</p>
      ${c.P.wires.length ? '' : '<p class="cc-warn">עוד לא נקראו השרטוטים של הארון הזה. פתחו אותו ולחצו "קריאת השרטוטים".</p>'}
      <div class="row gap flexwrap"><a class="btn small" href="#" data-open-cab="${esc(c.id)}">פתיחת הארון</a>
        <button class="btn ghost small" type="button" data-rot="${esc(c.id)}" title="סיבוב הארון ב-90°">סיבוב</button>
        <button class="btn ghost small" type="button" data-unlink="${esc(c.id)}">הוצאה מהאתר</button></div>
    </article>`;
  }).join('') : '<p class="muted empty-note">אין עדיין ארונות. גררו לכאן את קבצי ה-PDF של תכניות החיווט: כל קובץ הופך לארון.</p>';
  /* ארונות קיימים שאפשר להוסיף */
  const free = state.projects.filter((p) => !site.cabinets.includes(p.id));
  $('#siteAddCab').innerHTML = '<option value="">הוספת ארון קיים…</option>' + free.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.siteId ? ' (' + esc(siteName(p.siteId)) + ')' : ''}</option>`).join('');
  $('#siteAddCab').hidden = !free.length;
  /* תכנית ו-3D */
  if (!sitePlan) sitePlan = new SitePlan($('#planHost'), { onChange: () => { saveAll(state); renderSite(); }, onPick: (pid, lid) => siteSelect(pid, lid) });
  sitePlan.render(site, cabs, links, siteSel);
  buildSite3d(cabs, links);
  renderLinks();
  renderSiteSteps(steps);
  renderSiteFiles();
  renderSiteSel();
}

async function buildSite3d(cabs, links) {
  if (!site3d) {
    site3d = new Site3D($('#site3dHost'), {
      onHover: (lid, ev) => siteTip(lid, ev),
      onPick: (pid, lid) => siteSelect(pid, lid, true),
      onOpen: (pid) => openProject(pid, 'three')
    });
  }
  try {
    await site3d.build(site, cabs, links);
    $('#site3dWait').hidden = true;
    if (siteSel) { if (siteSel.pid) site3d.select(siteSel.pid); if (siteSel.lid) site3d.highlightLink(siteSel.lid); }
  } catch (e) {
    $('#site3dWait').hidden = false;
    $('#site3dWait').textContent = 'התלת־ממד לא נטען (' + e.message + '). בדקו חיבור לאינטרנט או נסו דפדפן אחר.';
  }
}

function siteTip(lid, ev) {
  const tip = $('#tip');
  const l = lid && siteData.links.find((x) => x.id === lid);
  if (!l) { tip.hidden = true; return; }
  tip.innerHTML = `<b>כבל W${linkNo(l.id)}</b> · ${esc(l.cable.type)}<br>${esc(cabName(l.a.pid))} ← ${esc(cabName(l.b.pid))}<br>
    כ-${l.length || '?'} מ' · ${l.cores.length} גידים בשימוש<p>${esc(l.cable.why)}</p><p class="muted">${esc(l.reason)}</p>`;
  tip.hidden = false;
  const pad = 14, rect = tip.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + rect.width > innerWidth - 8) x = ev.clientX - rect.width - pad;
  if (y + rect.height > innerHeight - 8) y = ev.clientY - rect.height - pad;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
}

function siteSelect(pid, lid, from3d) {
  siteSel = pid || lid ? { pid, lid } : null;
  $('#tip').hidden = true;
  if (site3d && !from3d) { site3d.select(pid); site3d.highlightLink(lid); }
  if (sitePlan) sitePlan.render(site, siteData.cabs, siteData.links, siteSel);
  $$('#siteCabs .cab-card').forEach((c) => c.classList.toggle('on', c.dataset.pid === pid));
  $$('#linkTable tr[data-lid]').forEach((r) => r.classList.toggle('sel', r.dataset.lid === lid));
  renderSiteSel();
}

function renderSiteSel() {
  const box = $('#siteSel');
  if (!siteSel || !siteData) { box.hidden = true; return; }
  if (siteSel.lid) {
    const l = siteData.links.find((x) => x.id === siteSel.lid);
    if (!l) { box.hidden = true; return; }
    box.innerHTML = `<div class="card-head"><h2>כבל W${linkNo(l.id)}: ${esc(cabName(l.a.pid))} ← ${esc(cabName(l.b.pid))}</h2><button class="btn ghost small" type="button" data-close-sel>סגירה</button></div>
      <dl class="kv-row"><div><dt>סוג כבל</dt><dd class="mono">${esc(l.cable.type)}</dd></div><div><dt>אורך לחיתוך</dt><dd class="num">${l.length || '?'} מ'</dd></div><div><dt>גידים בשימוש</dt><dd class="num">${l.cores.length} מתוך ${l.cable.cores}</dd></div><div><dt>מקור</dt><dd>${l.auto ? 'זוהה אוטומטית' : 'ידני'}</dd></div></dl>
      <p>${esc(l.cable.why)} ${esc(l.reason)}</p>
      <p class="muted small">האורך: עלייה מראש הארון למגש בגובה ${site.trayH || 2.6} מ', לאורך המגש, ירידה לארון השני, חצי מטר בכל ארון עד המהדק ועוד 10% רזרבה.</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>גיד</th><th>ב${esc(cabName(l.a.pid))}</th><th>ב${esc(cabName(l.b.pid))}</th><th>אות</th><th>תפקיד</th><th>חתך</th></tr></thead><tbody>
      ${l.cores.map((k, i) => `<tr><td class="num">${i + 1}</td><td><span class="ep">${esc(k.a)}</span></td><td><span class="ep">${esc(k.b)}</span></td><td class="mono">${esc(k.label)}</td><td>${esc((C.FUNCS[k.func] || {}).he || '')}</td><td class="num">${esc(k.section || '')}</td></tr>`).join('')}
      ${l.cable.cores > l.cores.length ? `<tr class="spare"><td colspan="6" class="muted">${l.cable.cores - l.cores.length} גידים רזרביים: מקפלים, מבודדים ומסמנים "רזרבה" בשני הקצוות.</td></tr>` : ''}
      </tbody></table></div>`;
  } else {
    const c = siteData.cabs.find((x) => x.id === siteSel.pid);
    if (!c) { box.hidden = true; return; }
    const ext = S.externals(c.P), L1 = site.layout[c.id] || {};
    box.innerHTML = `<div class="card-head"><h2>${esc(c.name)}</h2><div class="row gap"><a class="btn small" href="#" data-open-cab="${esc(c.id)}">פתיחת הארון</a><button class="btn ghost small" type="button" data-close-sel>סגירה</button></div></div>
      <dl class="kv-row"><div><dt>מעטפת</dt><dd>${esc(c.enc.text)}</dd></div><div><dt>מיקום</dt><dd class="num">${(L1.x || 0).toFixed(2)} / ${(L1.z || 0).toFixed(2)} מ'</dd></div><div><dt>הזנה</dt><dd>${esc(c.P.meta.supply || '—')}</dd></div><div><dt>חוטים</dt><dd class="num">${c.done}/${c.P.wires.length}</dd></div></dl>
      ${compGroups(c, ext)}
      <p class="muted small">לחיצה על רכיב פותחת את הכרטיס שלו: מה הוא עושה, כל ההדקים, החוטים, הצבעים ולאן כל חוט מגיע.</p>`;
  }
  box.hidden = false;
}

function compGroups(c, ext) {
  const cnt = {};
  c.P.wires.forEach((w) => { cnt[w.from.tag] = (cnt[w.from.tag] || 0) + 1; cnt[w.to.tag] = (cnt[w.to.tag] || 0) + 1; });
  const extBy = Object.fromEntries(ext.map((g) => [g.device, g]));
  const zones = [['field', 'ציוד בשטח'], ['door', 'בדלת הארון'], ['cabinet', 'בתוך הארון']];
  return zones.map(([z, he]) => {
    const list = c.P.components.filter((x) => x.zone === z).sort((a, b) => E.natCmp(a.tag, b.tag));
    if (!list.length) return '';
    return `<h3 class="comp-group-h">${he} <span class="muted">(${list.length})</span></h3><div class="comp-chips">${list.map((x) => {
      const g = extBy[x.tag];
      return `<button type="button" class="comp-chip z-${z}" data-scomp="${esc(x.tag)}" title="${esc(E.typeInfo(x.type).he)}${g ? ' · ' + g.cores.length + ' גידים דרך ' + esc(g.strips.join(', ')) : ''}"><b class="mono" translate="no">${esc(x.tag)}</b><span>${esc((x.name || E.typeInfo(x.type).he).slice(0, 26))}</span><i class="num">${cnt[x.tag] || 0}</i></button>`;
    }).join('')}</div>`;
  }).join('');
}

function renderLinks() {
  const { links } = siteData;
  $('#linkCount').textContent = links.length ? `${links.length} כבלים · כ-${Math.round(links.reduce((s, l) => s + (l.length || 0), 0))} מ'` : '';
  $('#linkSuggest').innerHTML = siteSugg.map((l) => `<div class="sugg"><div><b>הצעה:</b> ${esc(cabName(l.a.pid))}${l.a.device ? ' · <span class="ep">' + esc(l.a.device) + '</span>' : ''} ← ${esc(cabName(l.b.pid))}${l.b.device ? ' · <span class="ep">' + esc(l.b.device) + '</span>' : ''} <span class="muted">(${l.cores.length} גידים)</span><div class="muted small">${esc(l.reason)}</div></div>
    <div class="row gap"><button class="btn small" type="button" data-acc="${esc(l.id)}">הוספה</button><button class="btn ghost small" type="button" data-ign="${esc(l.id)}">התעלמות</button></div></div>`).join('');
  $('#linkTable').innerHTML = links.length ? `<thead><tr><th>כבל</th><th>מארון</th><th>לארון</th><th>סוג כבל</th><th>גידים</th><th>אורך</th><th>למה</th><th></th></tr></thead><tbody>${links.map((l, i) => `<tr data-lid="${esc(l.id)}" class="${siteSel && siteSel.lid === l.id ? 'sel' : ''}" tabindex="0">
      <td class="mono"><span class="kind-dot ${esc(l.kind)}"></span>W${i + 1}</td>
      <td>${esc(cabName(l.a.pid))}<div class="muted small ep">${esc([l.a.device, ...(l.a.strips || [])].filter(Boolean).join(' · '))}</div></td>
      <td>${esc(cabName(l.b.pid))}<div class="muted small ep">${esc([l.b.device, ...(l.b.strips || [])].filter(Boolean).join(' · '))}</div></td>
      <td class="mono">${esc(l.cable.type)}</td><td class="num">${l.cores.length}/${l.cable.cores}</td><td class="num">${l.length || '?'} מ'</td>
      <td class="desc small">${esc(l.reason)}</td>
      <td><button class="btn ghost small danger" type="button" data-del-link="${esc(l.id)}" aria-label="מחיקת הכבל W${i + 1}">מחיקה</button></td></tr>`).join('')}</tbody>`
    : `<tbody><tr><td class="muted">${siteData.cabs.length > 1 ? 'אין עדיין כבלים. הוסיפו מההצעות למעלה או ידנית למטה.' : 'כשיהיו באתר שני ארונות או יותר, יופיעו כאן הכבלים ביניהם.'}</td></tr></tbody>`;
  /* הוספה ידנית */
  const opts = siteData.cabs.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  ['#laCab', '#lbCab'].forEach((s, i) => { const el = $(s); const v = el.value; el.innerHTML = opts; if (v && siteData.cabs.some((c) => c.id === v)) el.value = v; else if (siteData.cabs[i]) el.value = siteData.cabs[i].id; });
  fillDevs('#laCab', '#laDev'); fillDevs('#lbCab', '#lbDev');
}

function fillDevs(cabSel, devSel) {
  const c = siteData.cabs.find((x) => x.id === $(cabSel).value);
  const ext = c ? S.externals(c.P) : [];
  $(devSel).innerHTML = '<option value="__pwr">הזנת כוח (L1 L2 L3 N PE)</option>' + ext.map((g) => `<option value="${esc(g.device)}">${esc(g.device)} ${esc(g.name)} (${g.cores.length} גידים)</option>`).join('');
}

function addManualLink() {
  const ca = siteData.cabs.find((x) => x.id === $('#laCab').value), cb = siteData.cabs.find((x) => x.id === $('#lbCab').value);
  if (!ca || !cb || ca === cb) { toast('בחרו שני ארונות שונים.'); return; }
  const da = $('#laDev').value, db = $('#lbDev').value;
  let l;
  if (da === '__pwr' || db === '__pwr') {
    const sec = S.powerSection(Number((/(\d+)\s*A\b/.exec(ca.P.meta.supply || cb.P.meta.supply || '') || [])[1]) || 16);
    l = { id: 'm-' + Date.now().toString(36), auto: false, kind: 'power', reason: 'הזנת כוח, הוגדרה ידנית',
      a: { pid: ca.id, device: '', strips: [] }, b: { pid: cb.id, device: '', strips: ['הזנה'] },
      cores: ['L1', 'L2', 'L3', 'N', 'PE'].map((t) => ({ a: t, b: t, label: t, func: t === 'PE' ? 'pe' : t === 'N' ? 'neutral' : 'power', section: sec })) };
  } else l = S.manualLink(ca, da, cb, db);
  if (!l) { toast('לא נמצאו גידים בקבוצות שנבחרו.'); return; }
  site.links.push(l); saveAll(state);
  siteSel = { lid: l.id };
  renderSite();
  toast(`נוסף כבל W${site.links.length} עם ${l.cores.length} גידים.`);
}

function renderSiteSteps(steps) {
  site.stepsDone = site.stepsDone || {};
  const d = steps.filter((s) => site.stepsDone[s.id]).length;
  $('#siteSteps').innerHTML = steps.map((s) => `<li class="${site.stepsDone[s.id] ? 'done' : ''}">
    <div class="st-head"><strong>${esc(s.title)}</strong><label class="check"><input type="checkbox" data-sstep="${esc(s.id)}" ${site.stepsDone[s.id] ? 'checked' : ''}> בוצע</label></div>
    <ul>${s.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    ${s.pid || s.link ? `<div class="st-actions">${s.pid ? `<a class="btn ghost small" href="#" data-open-cab="${esc(s.pid)}" data-to="assembly">להרכבה ולבדיקות של הארון</a>` : ''}${s.link ? `<button class="btn ghost small" type="button" data-show-link="${esc(s.link)}">טבלת הגידים</button>` : ''}</div>` : ''}
  </li>`).join('');
  $('#siteSteps').dataset.progress = `${d}/${steps.length}`;
}

function renderSiteFiles() {
  const ul = $('#siteFileList');
  if (!site.files.length) { ul.innerHTML = '<li class="muted">אין עדיין קבצים. כל קובץ שגוררים לאתר נשמר כאן, בנפרד לכל אתר.</li>'; return; }
  const icon = (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'PDF' : /^image\//.test(f.type) ? 'IMG' : /\.dwg$|\.dxf$/i.test(f.name) ? 'CAD' : /sheet|excel|csv|\.xlsx?$/i.test(f.type + f.name) ? 'XLS' : /word|\.docx?$/i.test(f.type + f.name) ? 'DOC' : 'FILE';
  ul.innerHTML = site.files.map((f) => `<li><span class="f-ic">${icon(f)}</span><div class="f-main"><a href="#" data-fget="${esc(f.id)}">${esc(f.name)}</a>
    <div class="muted small">${fmtSize(f.size || 0)} · ${new Date(f.added).toLocaleDateString('he-IL')}${f.pid ? ' · ארון: ' + esc(cabName(f.pid)) : ''}</div></div>
    ${f.pid ? `<a class="btn ghost small" href="#" data-open-cab="${esc(f.pid)}" data-to="plan">התכנית</a>` : `<button class="btn ghost small danger" type="button" data-fdel="${esc(f.id)}" aria-label="מחיקת ${esc(f.name)}">מחיקה</button>`}</li>`).join('');
}

async function siteFileBlob(f) { return files.get(f.pid ? `${f.pid}:pdf` : `site:${site.id}:f:${f.id}`); }

/* קליטת קבצים לאתר: כל PDF הופך לארון (עם קריאת השרטוטים), כל קובץ אחר נשמר בקבצי האתר */
let ingesting = Promise.resolve();
function siteIngest(list) {
  const s = site, arr = [...list];
  if (!s || !arr.length) return;
  const ol = $('#siteImport');
  const rows = arr.map((f) => { const li = document.createElement('li'); li.innerHTML = `<span class="mono">${esc(f.name)}</span><span class="st">ממתין…</span>`; ol.appendChild(li); return li; });
  ingesting = ingesting.then(async () => {
    const keepRaw = raw, keepCur = state.current;
    let cabs = 0, other = 0;
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i], st = rows[i].querySelector('.st');
      rows[i].className = 'busy';
      try {
        if (s.files.some((x) => x.name === f.name && x.size === f.size)) { st.textContent = 'כבר קיים באתר, דילגתי'; rows[i].className = 'skip'; continue; }
        if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { st.textContent = 'קורא…'; st.textContent = await ingestPdf(s, f, (a, b) => { st.textContent = `קורא עמוד ${a} מתוך ${b}…`; }); cabs++; }
        else {
          const fid = newId('f');
          await files.put(`site:${s.id}:f:${fid}`, f);
          s.files.push({ id: fid, name: f.name, type: f.type, size: f.size, added: Date.now() });
          st.textContent = 'נשמר בקבצי האתר'; other++;
        }
        rows[i].className = 'ok';
      } catch (e) { st.textContent = 'שגיאה: ' + e.message; rows[i].className = 'err'; }
      saveAll(state);
    }
    raw = keepRaw; state.current = keepCur;
    if (raw) derive();
    saveAll(state);
    if (site === s && tab === 'site') renderSite();
    toast(`נקלטו ${cabs} תכניות (ארונות) ו-${other} קבצים נוספים.`, 5000);
  });
}

async function ingestPdf(s, f, onPage) {
  raw = newProject(f.name.replace(/\.pdf$/i, ''), { siteId: s.id });
  save();
  const p = raw;
  const res = await readPdf(f, { onPage });
  await files.put(`${p.id}:pdf`, f);
  for (const pg of res.pages) await files.put(`${p.id}:p${pg.page}`, pg);
  p.pdf = { name: f.name, pages: res.pages.length, total: res.total, size: f.size };
  s.cabinets.push(p.id);
  s.files.push({ id: newId('f'), name: f.name, type: 'application/pdf', size: f.size, added: Date.now(), pid: p.id });
  const allText = res.pages.map((pg) => pg.items.map((it) => it.s).join(' ')).join('\n');
  const lib = LIBRARY.find((l) => l.matches(allText));
  let msg;
  if (lib) {
    const lp = lib.project();
    p.settings = { ...lp.settings, ...(p.settings || {}) };
    applyResult({ components: lp.components, wires: lp.wires, meta: lp.meta, notes: lp.notes }, 'library', true);
    p.name = lp.name;
    msg = `${lib.title}: ${lp.wires.length} חוטים, ${lp.components.length} רכיבים`;
  } else {
    const ex = E.extractFromText(res.pages);
    if (ex.wires.length >= 3) { applyResult({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text', true); msg = `${ex.wires.length} חוטים מהטקסט`; }
    else msg = `${res.pages.length} עמודים נשמרו. תכנית גרפית: פתחו את הארון לקריאת השרטוטים`;
  }
  p.status = 'חלק מהאתר "' + s.name + '". ' + msg + '.';
  save();
  return 'ארון חדש · ' + msg;
}

function bindSite() {
  $('#newSite').onclick = newSite;
  $('#siteName').addEventListener('change', (e) => { site.name = e.target.value.trim() || site.name; saveAll(state); });
  $('#siteAddr').addEventListener('change', (e) => { site.address = e.target.value.trim(); saveAll(state); });
  const num = (sel, fn) => $(sel).addEventListener('change', (e) => { const v = Number(e.target.value); if (v > 0) { fn(v); saveAll(state); renderSite(); } });
  num('#roomW', (v) => { site.room.w = Math.max(2, Math.min(60, v)); });
  num('#roomD', (v) => { site.room.d = Math.max(2, Math.min(60, v)); });
  num('#trayH', (v) => { site.trayH = Math.max(1.5, Math.min(6, v)); });
  $('#siteFiles').addEventListener('change', (e) => { siteIngest(e.target.files); e.target.value = ''; });
  const drop = $('#siteDrop');
  drop.addEventListener('click', () => $('#siteFiles').click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#siteFiles').click(); } });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => siteIngest(e.dataTransfer.files));
  $('#siteAddCab').addEventListener('change', (e) => {
    const p = state.projects.find((x) => x.id === e.target.value); if (!p) return;
    state.sites.forEach((st) => { if (st !== site) st.cabinets = st.cabinets.filter((x) => x !== p.id); });
    p.siteId = site.id; site.cabinets.push(p.id); saveAll(state); renderSite();
    toast(`"${p.name}" נוסף לאתר.`);
  });
  $('#v-site').addEventListener('click', async (e) => {
    const t = e.target;
    const open = t.closest('[data-open-cab]');
    if (open) { e.preventDefault(); openProject(open.dataset.openCab, open.dataset.to || 'plan'); return; }
    const rot = t.closest('[data-rot]');
    if (rot) { const l = site.layout[rot.dataset.rot]; if (l) { l.rot = ((l.rot || 0) + 90) % 360; saveAll(state); renderSite(); } return; }
    const un = t.closest('[data-unlink]');
    if (un) {
      const pid = un.dataset.unlink;
      if (!confirm(`להוציא את "${cabName(pid)}" מהאתר? הארון עצמו נשאר ברשימת הארונות.`)) return;
      site.cabinets = site.cabinets.filter((x) => x !== pid); delete site.layout[pid];
      site.links = site.links.filter((l) => l.a.pid !== pid && l.b.pid !== pid);
      site.files = site.files.filter((f) => f.pid !== pid);
      const p = state.projects.find((x) => x.id === pid); if (p) delete p.siteId;
      if (siteSel && siteSel.pid === pid) siteSel = null;
      saveAll(state); renderSite(); return;
    }
    const acc = t.closest('[data-acc]');
    if (acc) { const l = siteSugg.find((x) => x.id === acc.dataset.acc); if (l) { site.links.push(l); saveAll(state); renderSite(); toast(`נוסף כבל W${site.links.length}.`); } return; }
    const ign = t.closest('[data-ign]');
    if (ign) { site.ignored = [...(site.ignored || []), ign.dataset.ign]; saveAll(state); renderSite(); return; }
    const del = t.closest('[data-del-link]');
    if (del) { if (!confirm('למחוק את הכבל מהאתר?')) return; site.links = site.links.filter((l) => l.id !== del.dataset.delLink); if (site.links.length === 0 || (siteSel && siteSel.lid === del.dataset.delLink)) siteSel = null; saveAll(state); renderSite(); return; }
    const show = t.closest('[data-show-link]');
    if (show) { siteSelect(null, show.dataset.showLink); $('#siteSel').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.closest('[data-close-sel]')) { siteSelect(null, null); return; }
    const sc = t.closest('[data-scomp]');
    if (sc && siteSel && siteSel.pid) { openSiteComp(siteSel.pid, sc.dataset.scomp); return; }
    const fget = t.closest('[data-fget]');
    if (fget) {
      e.preventDefault();
      const f = site.files.find((x) => x.id === fget.dataset.fget); if (!f) return;
      const b = await siteFileBlob(f);
      if (!b) { toast('הקובץ לא נמצא בדפדפן הזה.'); return; }
      if (/^image\/|pdf/.test(f.type || b.type)) { const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); }
      else download(f.name, b, f.type);
      return;
    }
    const fdel = t.closest('[data-fdel]');
    if (fdel) {
      const f = site.files.find((x) => x.id === fdel.dataset.fdel); if (!f || !confirm(`למחוק את "${f.name}" מקבצי האתר?`)) return;
      await files.delPrefix(`site:${site.id}:f:${f.id}`);
      site.files = site.files.filter((x) => x !== f); saveAll(state); renderSiteFiles(); return;
    }
    const card = t.closest('.cab-card');
    if (card && !t.closest('button, a')) siteSelect(card.dataset.pid, null);
  });
  $('#linkTable').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-lid]'); if (tr && !e.target.closest('button')) siteSelect(null, tr.dataset.lid); });
  $('#linkTable').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-lid]'); if (tr && e.key === 'Enter') siteSelect(null, tr.dataset.lid); });
  $('#siteSteps').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-sstep]'); if (!cb) return;
    site.stepsDone[cb.dataset.sstep] = cb.checked; saveAll(state);
    cb.closest('li').classList.toggle('done', cb.checked);
  });
  $('#laCab').addEventListener('change', () => fillDevs('#laCab', '#laDev'));
  $('#lbCab').addEventListener('change', () => fillDevs('#lbCab', '#lbDev'));
  $('#linkAdd').onclick = addManualLink;
  $('#site3dHome').onclick = () => site3d && site3d.home();
  $('#site3dPng').onclick = () => {
    if (!site3d || !site3d.renderer) return;
    const a = document.createElement('a'); a.href = site3d.png(); a.download = site.name.replace(/[\\/:*?"<>|]+/g, '_') + '-3d.png';
    document.body.appendChild(a); a.click(); a.remove();
  };
  $('#sitePrint').onclick = () => {
    const d = siteData || computeSite();
    openPrint(siteBookHtml({ site, cabs: d.cabs, links: d.links, steps: d.steps, plan: sitePlan ? sitePlan.svg.outerHTML : '', img: site3d && site3d.renderer ? site3d.png() : '', C, S }));
  };
  $('#siteDelete').onclick = async () => {
    if (!confirm(`למחוק את האתר "${site.name}"? הארונות שלו יישארו ברשימת הארונות, וקבצי האתר שאינם תכניות יימחקו.`)) return;
    await files.delPrefix(`site:${site.id}:`);
    state.projects.forEach((p) => { if (p.siteId === site.id) delete p.siteId; });
    state.sites = state.sites.filter((x) => x !== site);
    site = null; saveAll(state);
    location.hash = '#home';
  };
}

/* ---------- התחלה ---------- */
async function start() {
  try { state = await loadAllAsync(); } catch { /* נשארים עם localStorage */ }
  bind();
  /* פסי הלבן-כחול בחוטי ‎0V של קטע הפתיחה מופיעים אחרי שהחוטים נמתחו */
  setTimeout(() => { const r = $('.run'); if (r) r.classList.add('drawn'); }, 2300);
  const cur = state.current && state.projects.find((p) => p.id === state.current);
  if (cur) { raw = cur; derive(); await loadPages(); }
  if (!raw && /^#p\//.test(location.hash)) location.hash = '#home';
  route();
  checkServer();
}
start();
