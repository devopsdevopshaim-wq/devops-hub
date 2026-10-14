/* ארון־פלאן — ממשק המשתמש */
import { loadAll, loadAllAsync, saveAll, files } from './store.js';
import { readPdf, blobToBase64 } from './pdf.js';
import { CabinetView } from './view.js';
import { Cabinet3D } from './view3d.js';
import { englishSteps, Speaker, sfx, inAppBrowser } from './voice.js';
import { wireSvg } from './wirerender.js';
import { bookHtml, labelsHtml, siteBookHtml } from './book.js';
import { Site3D } from './site3d.js';
import { SitePlan } from './siteplan.js';
import { partSvg } from './partart.js';

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
/* גרסת האתר בתוך claude.ai: שם השרטוטים נקראים עם Claude, בלי מפתחות */
const CLAUDE_APP = window.CLAUDE_APP || '';
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
function save() { if (raw) saveProject(raw); }
function saveProject(p) {
  p.updated = Date.now();
  const i = state.projects.findIndex((x) => x.id === p.id);
  if (i >= 0) state.projects[i] = p; else state.projects.unshift(p);
  if (p === raw) state.current = p.id;
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
  /* אותו לשונית בארון אחר: ה-hash לא משתנה, אז מציירים ישירות */
  if (toTab && location.hash !== '#p/' + toTab) location.hash = '#p/' + toTab; else route();
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
  { const cur = $(`#tabs a[data-tab="${v}"]`); if (cur && !$('#tabs').hidden) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  if (v === 'home') { renderHome(); closeDrawer(); return; }
  if (v === 'site') { closeDrawer(); speaker.stop(); renderSite(); return; }
  if (v === 'wiring') closeDrawer();
  $('#projTitle').textContent = raw.name;
  const ps = raw.siteId && state.sites.find((x) => x.id === raw.siteId);
  $('#siteBack').hidden = !ps;
  if (ps) { $('#siteBack').href = '#site/' + ps.id; $('#siteBack').textContent = '→ ' + ps.name; }
  updateCabSwitch();
  updatePill();
  ({ plan: renderPlan, parts: renderParts, wires: renderWires, cabinet: renderCabinet, conn: renderConn, three: renderThree, wiring: renderWiring, assembly: renderAssembly, lab: renderLab, export: renderExport }[v] || renderPlan)();
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
/* עמודים שנקראו בסשן הזה נשמרים גם בזיכרון: אם האחסון בדפדפן חסום, התכנית עדיין מוצגת */
const pageCache = new Map();
async function loadPages() {
  pages.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  pages = [];
  curPage = 1;
  if (!raw || !raw.pdf) return;
  const src = raw.pdfFrom || raw.id;
  const mem = pageCache.get(src) || [];
  for (let i = 1; i <= raw.pdf.pages; i++) {
    const rec = (await files.get(`${src}:p${i}`)) || mem.find((x) => x.page === i);
    if (rec) pages.push({ ...rec, url: URL.createObjectURL(rec.img) });
  }
}

const isPdf = (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const isImage = (f) => /^image\/(jpe?g|png|webp|gif|bmp|heic|heif)/i.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);
const isPlan = (f) => isPdf(f) || isImage(f);

/* תכנית שצולמה או נסרקה לתמונה: עמוד אחד */
async function readImage(f) {
  let bmp;
  try { bmp = await createImageBitmap(f); }
  catch { throw new Error(`הדפדפן לא מצליח לפתוח את התמונה ${f.name}${/heic|heif/i.test(f.type + f.name) ? ' (HEIC: שמרו אותה כ-JPG)' : ''}.`); }
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const img = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  return { pages: [{ page: 1, w: c.width, h: c.height, items: [], img }], total: 1 };
}
const isJson = (f) => /\.json$/i.test(f.name) || f.type === 'application/json';
const baseName = (n) => String(n || '').replace(/\.[^.]+$/, '');

/* קריאה של כמה קבצי PDF לפרויקט אחד: העמודים מתווספים ברצף (עמוד 1 של הקובץ השני ממשיך אחרי האחרון של הראשון) */
async function readPdfsInto(p, list, { replace, status }) {
  if (replace) {
    await files.delPrefix(p.id + ':'); p.pdf = null; p.aiPages = {}; pageCache.delete(p.id);
    /* תכנית חדשה: הקריאה של הקובץ הקודם כבר לא שייכת אליה */
    p.wires = []; p.components = []; p.done = {}; p.stepsDone = {}; p.notes = []; p.meta = {}; p.source = 'manual';
  }
  const mem = pageCache.get(p.id) || [];
  let off = p.pdf ? p.pdf.pages : 0;
  const parts = p.pdf && p.pdf.files ? p.pdf.files.slice() : p.pdf ? [{ name: p.pdf.name, pages: p.pdf.pages, from: 1, size: p.pdf.size }] : [];
  const added = [];
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    const res = isImage(f) && !isPdf(f) ? await readImage(f) : await readPdf(f, { onPage: (i, n) => status && status(`קורא את ${f.name}${list.length > 1 ? ` (${k + 1}/${list.length})` : ''}: עמוד ${i} מתוך ${n}…`, (k + i / n) / list.length) });
    await files.put(`${p.id}:pdf${parts.length ? parts.length + 1 : ''}`, f);
    for (const pg of res.pages) {
      const rec = { ...pg, page: pg.page + off, file: f.name };
      mem.push(rec);
      await files.put(`${p.id}:p${rec.page}`, rec);
      added.push(rec);
    }
    parts.push({ name: f.name, pages: res.pages.length, total: res.total, from: off + 1, size: f.size });
    off += res.pages.length;
  }
  pageCache.set(p.id, mem);
  p.pdf = { name: parts.map((x) => x.name).join(' + '), pages: off, total: parts.reduce((a, x) => a + (x.total || x.pages), 0), size: parts.reduce((a, x) => a + (x.size || 0), 0), files: parts };
  return { all: mem.slice().sort((a, b) => a.page - b.page), added, parts };
}

/* מה יש בעמודים: תכנית מוכרת מהספרייה, רשימת חוטים בטקסט, או שרטוט שצריך לקרוא */
function detectContent(p, allPages) {
  const allText = allPages.map((pg) => pg.items.map((it) => it.s).join(' ')).join('\n');
  const lib = LIBRARY.find((l) => l.matches(allText));
  if (lib && !p.wires.length) {
    const lp = lib.project();
    p.settings = { ...lp.settings, ...(p.settings || {}) };
    applyResult({ components: lp.components, wires: lp.wires, meta: lp.meta, notes: lp.notes }, 'library', true, p);
    if (!p.name || p.pdf && p.name === baseName(p.pdf.files[0].name)) p.name = lp.name;
    return { kind: 'library', msg: `זוהתה ${lib.title}: נטענה קריאה מלאה של כל השרטוטים (${lp.wires.length} חוטים, ${lp.components.length} רכיבים) עם חתכים וצבעים לפי התקנות.` };
  }
  const ex = E.extractFromText(allPages);
  if (ex.wires.length >= 3 && !p.wires.length) {
    applyResult({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text', true, p);
    return { kind: 'text', msg: `נמצאו ${ex.wires.length} חוטים בטקסט של ה-PDF. בדקו אותם ברשימת החוטים.` };
  }
  if (p.wires.length) return { kind: 'kept', msg: 'החוטים הקיימים נשמרו.' };
  return { kind: 'graphic', msg: aiReady() ? 'זו תכנית גרפית: השרטוטים נקראים עכשיו, עמוד אחרי עמוד.' : (CLAUDE_APP ? 'זו תכנית גרפית (שרטוטים בלי רשימת חוטים בטקסט). לקריאה אוטומטית של השרטוטים פתחו את גרסת Claude של האתר (הכפתור בצד), או השתמשו ב-Claude.ai בהעתק-הדבק.' : 'זו תכנית גרפית (שרטוטים בלי רשימת חוטים בטקסט). לקריאת השרטוטים השתמשו ב-Claude.ai בהעתק-הדבק.') };
}

/* קבצים שנבחרו או נגררו: אחד → תכנית; כמה PDF → אתר חדש שבו כל קובץ הוא ארון */
/* פס התקדמות קבוע מתחת לכותרת: רואים שהקובץ נקרא גם כשהמסך במקום אחר (במיוחד בטלפון) */
function busy(text, frac) {
  const b = $('#busyBar');
  if (!text) { b.hidden = true; return; }
  b.hidden = false;
  $('#busyText').textContent = text;
  $('#busyFill').style.width = frac == null ? '' : Math.round(Math.max(0.03, Math.min(1, frac)) * 100) + '%';
  b.classList.toggle('indet', frac == null);
}

async function handleFiles(list, { into = false, append = false, ask = false } = {}) {
  const arr = [...(list || [])];
  if (!arr.length) return;
  const json = arr.find(isJson);
  if (json && arr.length === 1) return importJson(json);
  const pdfs = arr.filter(isPlan);
  if (!pdfs.length) { toast('צריך קובץ PDF או תמונה של התכנית (או JSON שיוצא מהאתר). לשמירת קבצים מסוג אחר פתחו אתר התקנה.'); return; }
  const skipped = arr.filter((f) => !isPlan(f) && !isJson(f));
  if (skipped.length) toast(`${skipped.length} קבצים שאינם PDF או תמונה לא נפתחו כתכנית (${skipped.slice(0, 3).map((f) => f.name).join(', ')}). אפשר לשמור אותם באתר התקנה.`, 7000);
  /* כמה קבצים: כל קובץ ארון נפרד (אתר התקנה), או כולם תכנית אחת */
  if (!into && !append && !ask && pdfs.length > 1) {
    const c = await askChoice(`נבחרו ${pdfs.length} קבצים:\n${pdfs.slice(0, 8).map((f) => '• ' + f.name).join('\n')}${pdfs.length > 8 ? '\n…' : ''}\n\nאיך לפתוח אותם?`, 'כל קובץ = ארון נפרד (אתר התקנה)', 'כל הקבצים = תכנית אחת');
    if (!c) return;
    if (c === 'alt') return handleFile(pdfs, {});
  }
  /* קובץ שנגרר לתוך ארון פתוח: שואלים אם זה עוד דפים של אותה תכנית או ארון חדש */
  if (ask && raw) {
    const c = await askChoice(`${pdfs.length === 1 ? `"${pdfs[0].name}"` : `${pdfs.length} קבצים`}: להוסיף לתכנית של "${raw.name}", או לפתוח ${pdfs.length > 1 ? 'אתר חדש' : 'ארון חדש'}?`, 'להוסיף לתכנית הזו', pdfs.length > 1 ? 'אתר חדש' : 'ארון חדש');
    if (!c) return;
    if (c === 'alt') { into = false; append = false; } else { append = true; }
  }
  if (!into && !append && pdfs.length > 1) {
    const s = { id: newId('s'), name: 'אתר ' + new Date().toLocaleDateString('he-IL'), address: '', created: Date.now(), cabinets: [], files: [], layout: {}, room: null, trayH: 2.6, links: [], ignored: [], stepsDone: {} };
    state.sites.unshift(s); saveAll(state);
    location.hash = '#site/' + s.id;
    toast(`נבחרו ${pdfs.length} תכניות: נפתח אתר חדש וכל תכנית הופכת לארון. אפשר לשנות את שם האתר למעלה.`, 7000);
    setTimeout(() => siteIngest(arr), 60);
    return;
  }
  if (into && raw && raw.wires.length && !(await askConfirm(`להחליף את התכנית של "${raw.name}" בקובץ החדש? ${raw.wires.length} החוטים שנקראו מהתכנית הקודמת יימחקו, והתכנית החדשה תיקרא מההתחלה.`, { ok: 'להחליף את התכנית', danger: true }))) return;
  return handleFile(pdfs, { into, append });
}

/* קבצים נקראים אחד אחרי השני, וכל קריאה כותבת לפרויקט שלה גם אם בינתיים עברו לארון אחר */
let readQueue = Promise.resolve();
function handleFile(pdfs, opts) { const job = readQueue.then(() => readJob(pdfs, opts)); readQueue = job.catch(() => {}); return job; }

async function readJob(pdfs, { into = false, append = false } = {}) {
  if (!Array.isArray(pdfs)) pdfs = [pdfs];
  let p = raw;
  if (!(into || append) || !p) {
    p = newProject(baseName(pdfs[0].name));
    raw = p; save(); derive(); await loadPages(); selected = null; closeDrawer();
    if (cabView) cabView.vb = null;
  }
  if (!append && p.pdf) {
    const old = baseName(p.pdf.files ? p.pdf.files[0].name : p.pdf.name);
    if (p.name === old) p.name = baseName(pdfs[0].name);
  }
  location.hash = '#p/plan';
  const st = (t, frac) => { p.status = t; busy(t, frac); if (p === raw && tab === 'plan') $('#planStatus').textContent = t; };
  st('קורא את ה-PDF…', 0.02);
  try {
    const { all, parts } = await readPdfsInto(p, pdfs, { replace: !append, status: st });
    saveProject(p);
    if (p === raw) await loadPages();
    const n = parts.reduce((a, x) => a + x.pages, 0);
    let msg = (append ? `נוספו ${pdfs.length} קבצים לתכנית. ` : '') + `בתכנית ${n} עמודים${parts.length > 1 ? ` מ-${parts.length} קבצים` : ''}.`;
    if (parts.some((x) => x.total > x.pages)) msg += ' (מכל קובץ נשמרים עד 40 עמודים.)';
    st('מזהה את התוכן…', 0.98);
    const d = detectContent(p, all);
    msg += ' ' + d.msg;
    p.status = msg; saveProject(p);
    busy(null);
    toast(msg, 7000);
    if (p !== raw) return;
    derive();
    if (!pages.length) toast('הקבצים נקראו, אבל הדפדפן לא מאפשר לשמור אותם (גלישה בסתר או דפדפן מובנה). התכנית תוצג עד שתסגרו את הדף.', 8000);
    if (d.kind === 'library') { location.hash = '#p/three'; return; }
    rerender();
    if (d.kind === 'graphic' && aiReady()) runAuto();
  } catch (e) {
    busy(null);
    p.status = 'שגיאה בקריאת ה-PDF: ' + e.message; saveProject(p);
    if (p === raw && tab === 'plan') $('#planStatus').textContent = p.status;
    toast('לא הצלחתי לקרוא את ה-PDF: ' + e.message, 9000);
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
    await applyAsk(res, 'json');
    location.hash = '#p/wires'; route();
  } catch (e) { toast('ה-JSON לא נקרא: ' + e.message, 6000); }
}

/* החלפת החוטים הקיימים בתוצאה חדשה — רק אחרי אישור */
async function applyAsk(res, source) {
  if (raw.wires.length && !(await askConfirm(`להחליף את ${raw.wires.length} החוטים הקיימים בתוצאה החדשה (${res.wires.length} חוטים)?`, { ok: 'להחליף' }))) return false;
  return applyResult(res, source);
}

function applyResult(res, source, silent, p = raw) {
  /* כל מוליך הוא חוט: חוט "תלת־פאזי" אחד מתפרק לחוט לכל פאזה */
  const exp = E.expandMultiCore(res.components || [], res.wires || []);
  if (exp.added) res = { ...res, wires: exp.wires, notes: [`${exp.added} חוטים נוספו כשחוטים שאיחדו כמה מוליכים (למשל 1/3/5 או L1-L3) פורקו לחוט לכל מוליך.`, ...(res.notes || [])] };
  const key = (w) => [E.normTag(w.from.tag), E.normTerm(w.from.term), E.normTag(w.to.tag), E.normTerm(w.to.term)].join('|');
  const oldDone = new Set(p.wires.filter((w) => p.done[w.id]).map(key));
  p.components = res.components || [];
  p.wires = (res.wires || []).map((w) => ({ ...w, id: newId() }));
  p.done = {};
  p.wires.forEach((w) => { if (oldDone.has(key(w))) p.done[w.id] = 1; });
  const meta = {};
  Object.entries(res.meta || {}).forEach(([k, v]) => { if (v) meta[k] = v; });
  p.meta = { ...(p.meta || {}), ...meta };
  if (meta.title && (/^פרויקט חדש$|\.pdf$/i.test(p.name) || (p.pdf && p.name === baseName(p.pdf.name)) || (p.pdf && p.pdf.files && p.name === baseName(p.pdf.files[0].name)))) p.name = meta.title;
  p.notes = res.notes || [];
  p.source = source;
  p.status = `נטענו ${p.wires.length} חוטים ו-${p.components.length} רכיבים (${({ claude: 'Claude', paste: 'Claude.ai', text: 'שליפה מהטקסט', json: 'JSON', gemini: 'קריאה אוטומטית', library: 'קריאה מלאה של התכנית' })[source] || source}).`;
  saveProject(p);
  if (p === raw) derive();
  if (!silent && p === raw) { toast(p.status); rerender(); }
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
  ai.title = !aiReady() ? 'הקריאה האוטומטית זמינה בגרסת Claude של האתר.' : !raw.pdf ? 'צריך PDF' : '';
  const alt = $('#aiAlt');
  alt.hidden = aiReady() || !CLAUDE_APP || (raw.wires.length > 0 && raw.source === 'library');
  if (!alt.hidden) alt.querySelector('a').href = CLAUDE_APP;
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
    if (claudeAi) return;
    b.textContent = j.ai ? 'Claude מחובר' : 'שרת בלי מפתח: העתק-הדבק';
    b.className = 'ai-badge ' + (j.ai ? 'ok' : 'warn');
  } catch {
    server = { ai: false, checked: true };
    if (!claudeAi) b.textContent = 'Claude בהעתק-הדבק';
    if (!claudeAi) b.className = 'ai-badge warn';
    if (!claudeAi) b.title = 'האתר פתוח בלי השרת. הקריאה עם Claude עובדת בהעתק-הדבק ל-Claude.ai.';
  }
  try {
    const j = await hubCall({ action: 'status' }, 12000);
    hub = { ai: Boolean(j && j.ok && j.ai), checked: true };
  } catch { hub = { ai: false, checked: true }; }
  if (!claudeAi && !server.ai && hub.ai) { b.textContent = 'קריאה אוטומטית פעילה'; b.className = 'ai-badge ok'; b.title = 'השרטוטים נקראים אוטומטית (Gemini דרך השרת של האתר).'; }
  if (raw && tab === 'plan') renderPlan();
}

const aiReady = () => Boolean(claudeAi) || server.ai || hub.ai;
const runAuto = () => (claudeAi ? runSample() : server.ai ? runClaude() : runHub());

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
/* ---------- קריאת השרטוטים עם Claude, כשהאתר פתוח בתוך claude.ai (בלי מפתחות: על החשבון של מי שמשתמש) ---------- */
let claudeAi = null;   // { fn, maxImages }
async function checkClaude() {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  try {
    const fn = await window.claude.use('sample');
    if (!fn) return;
    const lim = await fn.limits().catch(() => null);
    const maxImages = lim && lim.images ? lim.images.maxCount : 0;
    if (!maxImages) return;
    claudeAi = { fn, maxImages };
    const b = $('#aiBadge');
    b.textContent = 'Claude מחובר · קריאה אוטומטית'; b.className = 'ai-badge ok';
    b.title = 'השרטוטים נקראים עם Claude, על החשבון שלכם ב-claude.ai.';
    if (raw && tab === 'plan') renderPlan();
  } catch { /* לא בתוך claude.ai */ }
}

/* תמונה של אזור מהעמוד: כל העמוד, או רבע שלו עם חפיפה — כדי שמספרי הדקים קטנים יהיו קריאים */
async function pageCrop(blob, rx, ry, rw, rh, max = 1600) {
  const bmp = await createImageBitmap(blob);
  const sx = bmp.width * rx, sy = bmp.height * ry, sw = bmp.width * rw, sh = bmp.height * rh;
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
const TILES = [[0, 0, 0.56, 0.56], [0.44, 0, 0.56, 0.56], [0, 0.44, 0.56, 0.56], [0.44, 0.44, 0.56, 0.56]];

const SAMPLE_ERR = {
  not_granted: 'לא אישרתם ל-Claude לקרוא את השרטוטים. אפשר לאשר מתפריט ההרשאות של הדף ולנסות שוב.',
  sampling_disabled: 'Claude לא זמין בחשבון הזה.',
  rate_limited: 'הגעתם למגבלת השימוש ב-Claude. חכו קצת ולחצו שוב "קריאה אוטומטית" — העמודים שכבר נקראו נשמרים.',
  session_expired: 'צריך להתחבר שוב ל-claude.ai.',
  images_unavailable: 'הדף הזה לא יכול לשלוח תמונות ל-Claude.'
};

/* עמודי התכנית של כל פרויקט (לא רק הפתוח): מהאחסון בדפדפן, או מהזיכרון אם האחסון חסום */
async function pagesOf(p) {
  if (!p.pdf) return [];
  const src = p.pdfFrom || p.id;
  const mem = pageCache.get(src) || [];
  const out = [];
  for (let i = 1; i <= p.pdf.pages; i++) {
    const rec = (await files.get(`${src}:p${i}`)) || mem.find((x) => x.page === i);
    if (rec) out.push(rec);
  }
  return out;
}
const needsReading = (p) => Boolean(p.pdf) && !p.wires.length;

/* קריאה עם Claude של פרויקט אחד. עמודים שכבר נקראו לא נשלחים שוב; התוצאה נשמרת בפרויקט */
async function claudeRead(p, pgs, { signal, onProgress = () => {} } = {}) {
  p.aiPages = p.aiPages || {};
  const queue = pgs.map((x) => x.page).filter((n) => !p.aiPages[n]);
  const total = pgs.length;
  const results = Object.values(p.aiPages);
  const failed = [];
  let fatal = null, running = 0;
  const tiles = claudeAi.maxImages >= 5 ? TILES : claudeAi.maxImages >= 3 ? [[0, 0, 0.56, 1], [0.44, 0, 0.56, 1]] : [];
  const report = (extra) => onProgress({ done: total - queue.length - running, total, wires: results.reduce((n, r) => n + r.wires.length, 0), extra });
  const one = async (n) => {
    const pg = pgs.find((x) => x.page === n);
    const imgs = [await pageCrop(pg.img, 0, 0, 1, 1)];
    for (const t of tiles) imgs.push(await pageCrop(pg.img, ...t));
    const known = Pr.merge(results).components.map((c) => c.tag);
    const text = E.textLines([pg]).map((l) => l.text).join('\n');
    const prompt = Pr.chunkPrompt({ pages: [n], known, hint: p.hint, text })
      + `\n\nהתמונה הראשונה היא עמוד ${n} כולו. ${imgs.length > 1 ? `אחריה ${imgs.length - 1} הגדלות של חלקי אותו עמוד (עם חפיפה), כדי לקרוא מספרי הדקים וחוטים קטנים. אל תכפיל חוט שמופיע בשתי הגדלות.` : ''} החזר JSON אחד בלבד.`;
    const r = await claudeAi.fn(prompt, { images: imgs, modelTier: 'complex', signal });
    const parsed = Pr.parse(r.text);
    parsed.wires.forEach((w) => { if (!w.page) w.page = n; });
    p.aiPages[n] = parsed;
    results.push(parsed);
    saveProject(p);
  };
  const worker = async () => {
    while (queue.length && !fatal && !(signal && signal.aborted)) {
      const n = queue.shift();
      running++; report(`עמוד ${n}`);
      try { await one(n); }
      catch (e) {
        if (e && e.code === 'cancelled') queue.unshift(n);
        else if (e && SAMPLE_ERR[e.code]) { fatal = SAMPLE_ERR[e.code]; queue.unshift(n); }
        else failed.push(n);
      } finally { running--; report(); }
    }
  };
  report();
  await Promise.all([worker(), worker()]);
  const res = Pr.merge(results);
  if (failed.length) res.notes.unshift(`עמודים ${failed.join(', ')} לא נקראו. לחצו שוב "קריאה אוטומטית" כדי לנסות רק אותם.`);
  if (res.wires.length || res.components.length) applyResult(res, 'claude', true, p);
  return { res, failed, fatal, aborted: Boolean(signal && signal.aborted), total };
}

async function runSample() {
  if (!pages.length) { toast('אין עמודים בפרויקט. העלו PDF.'); return; }
  raw.hint = $('#hint').value.trim(); save();
  const p = raw;
  const prog = $('#aiProgress'), txt = $('#aiText'), bar = $('#aiBar');
  prog.hidden = false; bar.style.width = '3%';
  $('#runClaude').disabled = true;
  aiAbort = new AbortController();
  let out = null;
  try {
    out = await claudeRead(p, pages.slice(), { signal: aiAbort.signal, onProgress: ({ done, total, wires, extra }) => {
      const t = `Claude קורא את השרטוטים: ${done} מתוך ${total} עמודים נקראו · ${wires} חוטים עד עכשיו${extra ? ' · ' + extra : ''}`;
      txt.textContent = t; bar.style.width = Math.round(4 + 92 * done / total) + '%'; busy(t, done / total);
    } });
    const { res, fatal, aborted, total } = out;
    if (aborted) txt.textContent = `נעצר. ${Object.keys(p.aiPages).length} עמודים נקראו ונשמרו; "קריאה אוטומטית" ממשיכה מאיפה שעצרנו.`;
    if (fatal) { txt.textContent = fatal; toast(fatal, 9000); }
    if (res.wires.length || res.components.length) {
      bar.style.width = '100%';
      if (!fatal && !aborted) txt.textContent = `הסתיים: ${res.wires.length} חוטים ו-${res.components.length} רכיבים מ-${total} עמודים.`;
      toast(`נקראו ${res.wires.length} חוטים ו-${res.components.length} רכיבים. עברו ל"ארון בתלת־ממד" או ל"רשימת חוטים".`, 7000);
      if (p === raw) rerender();
    } else if (!fatal && !aborted) txt.textContent = 'לא נמצאו רכיבים או חוטים בשרטוטים. אם זו סריקה מטושטשת, נסו קובץ חד יותר.';
  } finally {
    busy(null);
    aiAbort = null;
    $('#runClaude').disabled = !aiReady();
    if (!(out && out.fatal)) setTimeout(() => { prog.hidden = true; }, 8000);
  }
}

/* כל הארונות באתר שעוד לא נקראו — אחד אחרי השני */
let siteReading = null;
async function readSiteCabinets(s) {
  if (!claudeAi || siteReading) return;
  const todo = s.cabinets.map((pid) => state.projects.find((x) => x.id === pid)).filter((p) => p && needsReading(p));
  if (!todo.length) { toast('כל הארונות באתר כבר נקראו.'); return; }
  siteReading = new AbortController();
  const signal = siteReading.signal;
  let okN = 0, fatal = null;
  try {
    for (let k = 0; k < todo.length && !signal.aborted && !fatal; k++) {
      const p = todo[k];
      const pgs = await pagesOf(p);
      if (!pgs.length) continue;
      const out = await claudeRead(p, pgs, { signal, onProgress: ({ done, total, wires }) => {
        busy(`Claude קורא ארון ${k + 1} מתוך ${todo.length} — ${p.name}: עמוד ${done}/${total} · ${wires} חוטים`, (k + done / total) / todo.length);
        const card = $(`#siteCabs .cab-card[data-pid="${CSS.escape(p.id)}"] .cc-warn`);
        if (card) card.textContent = `Claude קורא… ${done}/${total} עמודים · ${wires} חוטים`;
      } });
      fatal = out.fatal;
      if (out.res.wires.length) okN++;
      if (site === s && tab === 'site') renderSite();
    }
  } finally {
    busy(null); siteReading = null;
    if (fatal) toast(fatal, 9000);
    else if (!signal.aborted) toast(`הסתיים: ${okN} מתוך ${todo.length} ארונות נקראו.`, 7000);
    if (site === s && tab === 'site') renderSite();
  }
}

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
    if (await applyAsk(res, 'gemini')) {
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
      const c = await askText('השרת מבקש קוד גישה:');
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
    await applyAsk(res, 'claude');
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
  renderRealParts();
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

function renderWireCheck() {
  const box = $('#wireCheck');
  const issues = E.checkWiring(P);
  box.hidden = !issues.length;
  if (!issues.length) return;
  const multi = issues.filter((i) => i.kind === 'multi').length;
  box.innerHTML = `<div class="card-head"><h2>בדיקת שלמות החיווט · ${issues.length} ${issues.length === 1 ? 'ממצא' : 'ממצאים'}</h2>${multi ? '<button class="btn small" type="button" id="wcFix">פירוק אוטומטי לחוט לכל מוליך</button>' : ''}</div>
    <ul class="wc-list">${issues.slice(0, 60).map((i) => `<li class="wc-${esc(i.kind)}"><button type="button" class="ep-link" data-comp="${esc(i.tag)}" translate="no">${esc(i.tag)}</button> ${esc(i.msg.replace(i.tag + ': ', ''))}</li>`).join('')}</ul>
    <p class="muted small">הבדיקה: לכל רכיב רב־קטבי (מפסק ראשי, מאמ"ת 3P, מגען, מגן מנוע) — חוט לכל קוטב בכניסה וביציאה; מנוע — U, V, W ו-PE; סליל — A1 ו-A2; ספק — L ו-N. ממצא הוא דבר לבדוק מול התכנית, לא בהכרח טעות.</p>`;
  const fx = $('#wcFix');
  if (fx) fx.onclick = () => {
    const r = E.expandMultiCore(raw.components, raw.wires);
    raw.wires = r.wires.map((w) => ({ ...w, id: w.id && !raw.wires.some((x) => x !== w && x.id === w.id) ? w.id : newId() }));
    const seen = new Set(); raw.wires.forEach((w) => { if (seen.has(w.id)) w.id = newId(); seen.add(w.id); });
    save(); derive(); renderWires();
    toast(r.added ? `נוספו ${r.added} חוטים: כל מוליך הוא עכשיו חוט נפרד.` : 'לא נמצאו חוטים לפירוק אוטומטי.', 6000);
  };
}

function renderWires() {
  renderWireCheck();
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
  renderSplitCard();
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
  if (vpref.auto !== false && wiring.lastSpoken !== w.id) { wiring.lastSpoken = w.id; speak(); }
}

const VOICE_MSG = {
  unsupported: () => inAppBrowser()
    ? 'הקישור נפתח בתוך אפליקציה (וואטסאפ, פייסבוק וכו\'), ושם אין קול. פתחו את האתר בדפדפן: תפריט ⋮ ← "פתיחה בדפדפן" / "Open in browser".'
    : 'הדפדפן הזה לא יודע להקריא. פתחו את האתר ב-Chrome, Edge או Safari.',
  'no-voices': () => 'במכשיר לא מותקן קול לדיבור. אנדרואיד: הגדרות ← נגישות ← המרת טקסט לדיבור ← "Speech Services by Google" והורדת קול English. iPhone: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← English. אחר כך רעננו את הדף.',
  silent: () => 'הקול לא התחיל. בדקו שהמכשיר לא על שקט ושעוצמת המדיה פתוחה, ולחצו ▶ Play.',
  'not-allowed': () => 'הדפדפן משמיע קול רק אחרי לחיצה בדף. לחצו ▶ Play.',
  'audio-busy': () => 'אפליקציה אחרת משתמשת ברמקול. סגרו אותה ולחצו ▶ Play.',
  'synthesis-unavailable': () => 'מנוע הדיבור של המכשיר לא זמין כרגע. נסו לרענן את הדף.'
};
function voiceWarn(kind) {
  const box = $('#vWarn');
  if (!kind) { box.hidden = true; return; }
  const m = (VOICE_MSG[kind] || VOICE_MSG.silent)();
  const android = /Android/i.test(navigator.userAgent);
  box.innerHTML = esc(m) + (inAppBrowser() && android ? ` <a class="btn small" href="intent://${esc(location.host + location.pathname + location.hash)}#Intent;scheme=https;package=com.android.chrome;end">פתיחה ב-Chrome</a>` : '');
  box.hidden = false;
}
function speak() {
  if (!speaker.ok) { voiceWarn('unsupported'); return; }
  const card = $('.voice-card');
  speaker.onSentence = (i) => { $$('#vSubs li').forEach((li) => li.classList.toggle('on', Number(li.dataset.i) === i)); const li = $(`#vSubs li[data-i="${i}"]`); if (li) li.scrollIntoView({ block: 'nearest', inline: 'nearest' }); };
  speaker.onStart = (v) => { voiceWarn(null); card.classList.add('speaking'); if (v) $('#vNote').textContent = `מדבר עכשיו: ${v.name}`; };
  speaker.onEnd = () => { card.classList.remove('speaking'); $$('#vSubs li').forEach((li) => li.classList.remove('on')); };
  speaker.onFail = (k) => { card.classList.remove('speaking'); voiceWarn(k); };
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

const dataUrlBlob = (u) => { const [h, b] = u.split(','); const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: (/data:([^;]+)/.exec(h) || [])[1] || 'application/octet-stream' }); };
let dlCap;
async function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  /* בתוך claude.ai הורדה עוברת דרך אישור של הצופה */
  if (dlCap === undefined) dlCap = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (dlCap) {
    try { await dlCap.save({ filename: name, data: blob }); }
    catch (e) { if (e && e.code !== 'declined') toast(e && e.code === 'rejected_extension' ? 'אי אפשר להוריד קובץ מהסוג הזה כאן.' : 'ההורדה לא זמינה כאן.'); }
    return;
  }
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
  const win = window.claude ? null : window.open('', '_blank');
  if (win) { win.document.open(); win.document.write(html); win.document.close(); return; }
  /* בלי חלון חדש (נחסם, או בתוך claude.ai): התיק נפתח בתוך הדף */
  const d = $('#bookDialog');
  $('#bookFrame').srcdoc = html;
  d.showModal();
}

/* ---------- אישור ושאלה בתוך הדף (confirm/prompt לא עובדים בכל מקום) ---------- */
function askConfirm(msg, { ok = 'אישור', danger = false } = {}) {
  return askDialog(msg, { ok, danger });
}
function askText(msg, value = '') { return askDialog(msg, { input: true, value }); }
function askChoice(msg, ok, alt) { return askDialog(msg, { ok, alt }); }
function askDialog(msg, { ok = 'אישור', danger = false, input = false, value = '', alt = '' } = {}) {
  const d = $('#askDialog');
  $('#askMsg').textContent = msg;
  const inp = $('#askInput');
  inp.hidden = !input; inp.value = value;
  const okB = $('#askOk');
  okB.textContent = ok; okB.classList.toggle('danger-solid', danger);
  const altB = $('#askAlt'); altB.hidden = !alt; altB.textContent = alt;
  return new Promise((resolve) => {
    const done = () => { d.removeEventListener('close', done); resolve(alt ? (d.returnValue === 'ok' ? 'ok' : d.returnValue === 'alt' ? 'alt' : null) : d.returnValue === 'ok' ? (input ? inp.value.trim() : true) : (input ? null : false)); };
    d.addEventListener('close', done);
    d.returnValue = '';
    d.showModal();
    (input ? inp : okB).focus();
  });
}

/* ---------- עריכת חוט ---------- */
function openWireDialog(id, pre = null) {
  const w = id ? raw.wires.find((x) => x.id === id) : null;
  const d = id ? wireById(id) : null;
  const f = $('#wireForm');
  $('#wdTitle').textContent = w ? `עריכת חוט ${d.no}` : 'חוט חדש';
  f.func.innerHTML = `<option value="">אוטומטי${d ? ' (' + C.FUNCS[d.func].short + ')' : ''}</option>` + Object.entries(C.FUNCS).map(([k, v]) => `<option value="${k}">${esc(v.he)}</option>`).join('');
  f.color.innerHTML = `<option value="">לפי התקן${d ? ' (' + C.COLORS[d.color].he + ')' : ''}</option>` + Object.entries(C.COLORS).map(([k, v]) => `<option value="${k}">${esc(v.he)} (${k})</option>`).join('');
  f.section.innerHTML = `<option value="">ברירת מחדל${d ? ' (' + d.section + ')' : ''}</option>` + C.SECTIONS.map((x) => `<option value="${x}">${x}</option>`).join('');
  $('#tagList').innerHTML = P.components.map((c) => `<option value="${esc(c.tag)}">${esc(c.name)}</option>`).join('');
  const v = w || pre || {};
  f.no.value = v.no || ''; f.func.value = C.FUNCS[v.func] ? v.func : '';
  f.fromTag.value = v.from ? v.from.tag : ''; f.fromTerm.value = v.from ? v.from.term : '';
  f.toTag.value = v.to ? v.to.tag : ''; f.toTerm.value = v.to ? v.to.term : '';
  f.color.value = C.colorCode(v.color) && v.colorSource !== 'standard' ? C.colorCode(v.color) : '';
  f.section.value = v.section && !d?.sectionInferred ? String(Number(v.section)) : '';
  f.wireType.value = v.wireType || ''; f.potential.value = v.potential || ''; f.page.value = v.page || '';
  f.desc.value = v.desc || ''; f.explain.value = v.explain || '';
  f.dataset.id = id || '';
  f.dataset.added = (!w && pre && pre.added) || '';
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
  else { const w = { ...data, id: newId() }; if (f.dataset.added) w.added = f.dataset.added; raw.wires.push(w); selected = w.id; }
  save(); derive(); rerender();
  toast('החוט נשמר.');
  return true;
}

/* ---------- חיבור אירועים ---------- */
function bind() {
  window.addEventListener('hashchange', route);
  /* קבצים */
  const pick = (inp, opts) => inp.addEventListener('change', () => { const fl = [...inp.files]; inp.value = ''; handleFiles(fl, opts); });
  pick($('#pdfInput'), {}); pick($('#pdfInputTop'), {}); pick($('#pdfInputPlan'), { into: true }); pick($('#pdfAddPlan'), { append: true });
  $('#jsonInput').addEventListener('change', (e) => { importJson(e.target.files[0]); e.target.value = ''; });
  const drop = $('#drop');
  drop.addEventListener('click', () => $('#pdfInput').click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#pdfInput').click(); } });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files, {}));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    if (e.target.closest('#drop, #siteDrop')) return;
    e.preventDefault();
    if (tab === 'site' && site) { if (e.dataTransfer.files.length) siteIngest(e.dataTransfer.files); return; }
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, tab !== 'home' && raw ? { ask: true } : {});
  });
  bindSite();
  bindComp();
  bindConn();
  bindRealParts();
  if (CLAUDE_APP) { $('#homeClaude').hidden = false; $('#homeClaude').href = CLAUDE_APP; }
  $('#bookPrint').onclick = () => { try { $('#bookFrame').contentWindow.print(); } catch { toast('ההדפסה לא זמינה כאן. פתחו את האתר בדפדפן רגיל כדי להדפיס.'); } };
  $('#bookPrint').hidden = Boolean(window.claude);

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
  $('#runLocal').onclick = async () => {
    const ex = E.extractFromText(pages);
    if (!ex.wires.length) { toast('לא נמצאו בטקסט שורות עם שני קצוות (כמו ‎-X1:3 ‎-K1:A1). לתכנית גרפית השתמשו ב-Claude.', 7000); return; }
    await applyAsk({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text');
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
  $('#pasteOk').onclick = async () => {
    try {
      const res = Pr.parse($('#pasteBox').value);
      if (await applyAsk(res, 'paste')) $('#pasteDialog').close();
    } catch (err) { $('#pasteErr').textContent = err.message; }
  };

  /* רכיבים */
  $('#partsSearch').addEventListener('input', renderParts);
  $('#partsTable').addEventListener('change', (e) => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    updateComp(el.closest('tr').dataset.tag, el.dataset.k, el.value);
  });
  $('#partsTable').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const tag = del.dataset.del;
      const n = raw.wires.filter((w) => E.normTag(w.from.tag) === tag || E.normTag(w.to.tag) === tag).length;
      if (n && !(await askConfirm(`לרכיב ${tag} מחוברים ${n} חוטים. למחוק גם אותם?`, { ok: 'למחוק', danger: true }))) return;
      raw.components = raw.components.filter((c) => E.normTag(c.tag) !== tag);
      raw.wires = raw.wires.filter((w) => E.normTag(w.from.tag) !== tag && E.normTag(w.to.tag) !== tag);
      save(); derive(); renderParts(); return;
    }
    const hl = e.target.closest('[data-hl]');
    if (hl) { location.hash = '#p/cabinet'; setTimeout(() => openComp(hl.dataset.hl), 80); }
  });
  $('#addPart').onclick = async () => {
    const tag = E.normTag((await askText('תג הרכיב (למשל ‎-K5):')) || '');
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
  const setLay = (on) => { if (cabView) cabView.setLayout(on); $('#cabLay').setAttribute('aria-pressed', on); $('#cabAll').setAttribute('aria-pressed', !on); };
  $('#cabLay').onclick = () => setLay(true);
  $('#cabAll').onclick = () => setLay(false);
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
    download(fileBase() + '-3d.png', dataUrlBlob(view3d.png()), 'image/png');
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
  $('#wSpeak').onclick = () => { if ($('.voice-card').classList.contains('speaking')) { speaker.stop(); $('.voice-card').classList.remove('speaking'); } else speak(); };
  $('#vStop').onclick = () => { speaker.stop(); $('.voice-card').classList.remove('speaking'); };
  $('#vAuto').checked = vpref.auto !== false;
  if (!speaker.ok) voiceWarn('unsupported');
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
  $('#resetDone').onclick = async () => { if (await askConfirm('לאפס את כל סימוני החיווט?', { ok: 'לאפס', danger: true })) { raw.done = {}; raw.stepsDone = {}; save(); updatePill(); toast('הסימונים אופסו.'); } };
  $('#delProject').onclick = async () => {
    if (!(await askConfirm(`למחוק את "${raw.name}" מהדפדפן?`, { ok: 'למחוק', danger: true }))) return;
    /* ארונות שפוצלו מהארון הזה משתמשים בעמודי התכנית שלו — לא מוחקים אותם */
    if (!state.projects.some((p) => p.pdfFrom === raw.id)) await files.delPrefix(raw.id + ':');
    state.projects = state.projects.filter((p) => p.id !== raw.id);
    state.sites.forEach((st) => { st.cabinets = st.cabinets.filter((x) => x !== raw.id); st.files = st.files.filter((f) => f.pid !== raw.id); st.links = st.links.filter((l) => l.a.pid !== raw.id && l.b.pid !== raw.id); });
    raw = null; P = L = null; state.current = null; saveAll(state);
    location.hash = '#home';
  };

  /* דיאלוג חוט */
  $('#wireForm').addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'ok') { if (!saveWireDialog()) e.preventDefault(); }
  });
  $('#wdDelete').onclick = async () => {
    const id = $('#wireForm').dataset.id;
    if (!id || !(await askConfirm('למחוק את החוט?', { ok: 'למחוק', danger: true }))) return;
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
    ${partBlock(c)}
    <dl class="kv">
      ${c.desc ? `<dt>תיאור</dt><dd>${esc(c.desc)}</dd>` : ''}
      ${c.maker || c.partNo ? `<dt>יצרן / מק"ט</dt><dd>${esc([c.maker, c.partNo].filter(Boolean).join(' · '))}</dd>` : ''}
      ${rail ? `<dt>מיקום</dt><dd>מסילה ${b.rail + 1} (${esc(C.ROWS[rail.row])}), ${Math.round(b.x)} מ"מ משמאל הפלטה</dd>` : ''}
      ${b.w && cL === L && cabView && cabView.grid ? `<dt>אזור בשרטוט</dt><dd class="mono">${esc(cabView.zoneOf(b.x + b.w / 2, b.y + b.h / 2))}</dd>` : ''}
      ${b.w && c.zone === 'cabinet' ? `<dt>מידות</dt><dd class="mono">${Math.round(b.w)}×${Math.round(b.h)}×${E.depthOf(c.type)} מ"מ</dd>` : ''}
      ${info.strips.length ? `<dt>דרך המהדקים</dt><dd class="mono">${esc(info.strips.join(', '))}</dd>` : ''}
      ${info.cable ? `<dt>כבל לשטח</dt><dd class="mono">${esc(info.cable)}</dd>` : ''}
      <dt>חוטים</dt><dd>${info.rows.length}${info.rows.length ? ` · ${nDone} חוברו` : ''}</dd>
    </dl>
    <h3 class="comp-h">${c.zone === 'field' ? 'החיווט מהמכשיר אל הלוח' : 'החיווט של הרכיב'}</h3>
    ${info.rows.length ? `<div class="table-wrap"><table class="tbl comp-tbl"><thead><tr><th></th><th>הדק</th><th>חוט</th><th>צבע וחתך</th><th>מחובר אל</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted">לחיצה על מספר חוט פותחת את כל הפרטים שלו. לחיצה על הדק עוברת לרכיב שבצד השני.</p>` : '<p class="muted">לרכיב הזה אין חוטים ברשימה.</p>'}`;
}

/* החלק עצמו: ציור, יצרן ומק"ט, וקישורים לדף המוצר ולתמונות אמיתיות */
function partBlock(c) {
  if (c.zone === 'field' && !c.partNo) return '';
  const links = c.partNo ? window.WParts.productLinks(c.maker, c.partNo) : null;
  return `<div class="part-box">
    <div class="part-pic">${partSvg(c)}</div>
    <div class="part-info">
      ${c.partNo ? `<div class="part-mk">${esc(c.maker || '')}</div><div class="part-pn mono" translate="no">${esc(c.partNo)}</div>${c.partExact === false ? '<div class="small warn-t">סדרה בלבד — לבחור מק"ט בקטלוג</div>' : ''}${c.partDesc ? `<div class="small muted">${esc(c.partDesc)}</div>` : ''}`
        : '<div class="small muted">עוד אין מק"ט. בלשונית "רכיבים" ← "חלקים אמיתיים" אפשר לשבץ מק"ט של Schneider, ABB או Siemens לכל הלוח.</div>'}
      ${links ? `<div class="part-links">${links.product ? `<a class="btn small" href="${esc(links.product)}" target="_blank" rel="noopener">דף המוצר אצל היצרן ↗</a>` : ''}<a class="btn ghost small" href="${esc(links.images)}" target="_blank" rel="noopener">תמונות אמיתיות ↗</a><a class="btn ghost small" href="${esc(links.datasheet)}" target="_blank" rel="noopener">דף נתונים ↗</a></div>` : ''}
      <p class="small muted part-note">הציור מראה את סוג החלק. התמונה האמיתית, המידות ודף הנתונים — בדף המוצר אצל היצרן.</p>
    </div>
  </div>`;
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

/* ---------- חיבורים ומהדקים: לכל פס מהדקים — פנימה, החוצה, ולארונות אחרים באתר ---------- */
let pendingConn = null;
const siteOf = (p) => p && p.siteId ? state.sites.find((x) => x.id === p.siteId) : null;
const projName = (pid) => { const p = state.projects.find((x) => x.id === pid); return p ? p.name : '?'; };

function renderConn() {
  const by = compBy();
  const strips = P.components.filter((c) => c.type === 'terminal').sort((a, b) => E.natCmp(a.tag, b.tag));
  const st = siteOf(raw);
  const xr = st ? S.crossRefs(st, raw.id) : {};
  const nm = (tg) => { const c = by[tg]; return c ? (c.name || E.typeInfo(c.type).he) : ''; };
  const sw = (w) => `<span class="sw" style="${swStyle(C.COLORS[w.color] || C.COLORS.BK)}"></span>`;
  let nTerm = 0, nExt = 0, nX = 0;
  const html = strips.map((sc) => {
    const tag = sc.tag;
    const rows = {};
    const row = (t) => rows[E.normTerm(t)] || (rows[E.normTerm(t)] = { term: t, inn: [], ext: [], x: [] });
    Object.keys(L.pins).filter((k) => k.startsWith(tag + ':')).forEach((k) => row(k.slice(tag.length + 1)));
    P.wires.forEach((w) => {
      [[w.from, w.to], [w.to, w.from]].forEach(([a, b]) => {
        if (a.tag !== tag) return;
        const oc = by[b.tag];
        const side = b.tag === tag ? 'inn' : oc && oc.zone !== 'cabinet' ? 'ext' : 'inn';
        row(a.term)[side].push({ w, b, bridge: b.tag === tag });
      });
    });
    Object.keys(xr).forEach((k) => { if (k.startsWith(tag.toUpperCase() + ':')) row(k.slice(tag.length + 1)).x.push(...xr[k]); });
    const list = Object.values(rows).sort((a, b) => E.natCmp(String(a.term), String(b.term)));
    nTerm += list.length;
    const ent = (e) => `<div class="cx"><button type="button" class="wno" data-wire="${esc(e.w.id)}" translate="no">${esc(e.w.no)}</button>${sw(e.w)}<button type="button" class="ep-link" data-comp="${esc(e.b.tag)}" translate="no">${esc(e.b.tag)}:${esc(e.b.term)}</button><span class="cx-n">${e.bridge ? 'גשר בין הדקים' : esc(nm(e.b.tag)).slice(0, 40)}</span></div>`;
    const xent = (x) => { const ok = S.refKey(x.peerRef); return `<div class="cx cx-x"><button type="button" class="xcab" data-xcab="${esc(x.peer)}" data-xref="${esc(ok ? x.peerRef : '')}"><span class="xcab-arrow" aria-hidden="true">⇄</span><b>${esc(projName(x.peer))}</b><span class="mono" translate="no">${ok ? esc(x.peerRef) : 'הדק לא הוגדר'}</span></button><span class="cx-n">כבל W${x.no} · גיד ${x.core}${x.label ? ' · ' + esc(x.label) : ''}</span></div>`; };
    const body = list.map((r) => {
      nExt += r.ext.length; nX += r.x.length;
      const pe = /^PE/i.test(r.term);
      return `<div class="tr${r.x.length ? ' has-x' : ''}" data-row="${esc(S.refKey(tag + ':' + r.term))}">
        <div class="tc tc-in">${r.inn.map(ent).join('') || '<span class="cx-empty">—</span>'}</div>
        <div class="tc tc-t"><span class="tblk${pe ? ' pe' : ''}" translate="no">${esc(r.term)}</span></div>
        <div class="tc tc-out">${r.ext.map(ent).join('')}${r.x.map(xent).join('')}${!r.ext.length && !r.x.length ? '<span class="cx-empty">—</span>' : ''}</div>
      </div>`;
    }).join('');
    const ext = S.externals(P).filter((g) => g.strips.includes(tag));
    return `<section class="card ts" id="ts-${esc(tag.replace(/[^\w-]/g, '_'))}" data-strip="${esc(tag)}">
      <div class="ts-head"><span class="ctag mono" translate="no">${esc(tag)}</span><div><b>${esc(sc.name || 'פס מהדקים')}</b><div class="small muted">${list.length} הדקים${ext.length ? ' · לשטח: ' + ext.map((g) => esc(g.device)).join(', ') : ''}</div></div>
        <button type="button" class="btn ghost small" data-comp="${esc(tag)}">כרטיס הפס</button></div>
      <div class="ts-cols"><span>בתוך הארון</span><span>הדק</span><span>החוצה: שטח וארונות אחרים</span></div>
      <div class="ts-body">${body}</div>
    </section>`;
  }).join('');
  $('#connStrips').innerHTML = html || '<div class="card"><p class="muted">אין בפרויקט פסי מהדקים. כשהתכנית תיקרא, יופיעו כאן כל ההדקים והחיבורים שלהם.</p></div>';
  $('#connStats').innerHTML = [['פסי מהדקים', strips.length], ['הדקים', nTerm], ['חיבורים לשטח', nExt], ['גידים לארונות אחרים', nX]].map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('');
  $('#connNav').innerHTML = strips.map((sc) => `<button type="button" class="chip" data-goto="${esc(sc.tag)}" translate="no">${esc(sc.tag)}</button>`).join('');
  /* כבלים לארונות אחרים */
  const box = $('#connX');
  const links = st ? st.links.map((l, i) => ({ l, no: i + 1 })).filter(({ l }) => l.a.pid === raw.id || l.b.pid === raw.id) : [];
  box.hidden = !st;
  if (st) {
    box.innerHTML = `<div class="card-head"><h2>כבלים לארונות אחרים באתר "${esc(st.name)}"</h2><a class="btn ghost small" href="#site/${esc(st.id)}">לאתר</a></div>
      ${links.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>כבל</th><th>לארון</th><th>סוג</th><th>גידים</th><th>מהדקים כאן</th><th></th></tr></thead><tbody>${links.map(({ l, no }) => {
        const mineA = l.a.pid === raw.id, peer = mineA ? l.b.pid : l.a.pid;
        const here = [...new Set(l.cores.map((k) => (mineA ? k.a : k.b).split(':')[0]).filter(Boolean))].join(', ');
        const first = l.cores.find((k) => /:/.test(mineA ? k.b : k.a));
        return `<tr><td class="mono">W${no}</td><td>${esc(projName(peer))}</td><td class="mono">${esc(S.cableFor(l).type)}</td><td class="num">${l.cores.length}</td><td class="mono">${esc(here)}</td>
          <td><button type="button" class="btn small" data-xcab="${esc(peer)}" data-xref="${esc(first ? (mineA ? first.b : first.a) : '')}">פתיחת החיבורים בארון השני</button></td></tr>`;
      }).join('')}</tbody></table></div>` : `<p class="muted">עוד לא הוגדרו כבלים בין הארון הזה לארונות אחרים. במסך האתר יש הצעות לכבלים לפי שמות האותות, ואפשר להוסיף ידנית.</p>`}`;
  }
  if (pendingConn) { const r = pendingConn; pendingConn = null; setTimeout(() => flashConn(r), 60); }
}

function flashConn(ref) {
  const key = S.refKey(ref);
  const el = key && $(`#connStrips [data-row="${CSS.escape(key)}"]`);
  if (!el) { toast(`ההדק ${ref} לא נמצא בפסי המהדקים של הארון הזה.`); return; }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

function bindConn() {
  $('#v-conn').addEventListener('click', async (e) => {
    const w = e.target.closest('[data-wire]');
    if (w) { select(w.dataset.wire); return; }
    const g = e.target.closest('[data-goto]');
    if (g) { const sec = $(`#connStrips [data-strip="${CSS.escape(g.dataset.goto)}"]`); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const x = e.target.closest('[data-xcab]');
    if (x) {
      if (!state.projects.some((p) => p.id === x.dataset.xcab)) { toast('הארון השני כבר לא קיים.'); return; }
      pendingConn = x.dataset.xref || null;
      if (!pendingConn) toast('לגיד הזה עוד לא הוגדר הדק בארון השני. אפשר להשלים אותו בטבלת הכבלים במסך האתר.', 6000);
      await openProject(x.dataset.xcab, 'conn');
      if (tab === 'conn' && pendingConn) renderConn();
    }
  });
  $('#cabSwitch').addEventListener('change', (e) => { const pid = e.target.value; if (pid && pid !== raw.id) openProject(pid, tab === 'home' || tab === 'site' ? 'plan' : tab); });
}

function updateCabSwitch() {
  const sel = $('#cabSwitch');
  const st = siteOf(raw);
  const list = st ? st.cabinets.map((pid) => state.projects.find((x) => x.id === pid)).filter(Boolean) : [];
  sel.hidden = list.length < 2;
  $('#projTitle').hidden = !sel.hidden;
  if (sel.hidden) return;
  sel.innerHTML = list.map((p) => `<option value="${esc(p.id)}" ${p.id === raw.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

/* ---------- חלקים אמיתיים ---------- */
const WP = window.WParts, WS = window.WSplit;
function partOpts() {
  const s = (raw.settings && raw.settings.parts) || {};
  return { brand: s.brand || 'schneider', terminals: s.terminals || 'phoenix', psu: s.psu || 'main', relay: s.relay || 'main', coil: s.coil || 'dc24', overwrite: Boolean(s.overwrite) };
}
function renderRealParts() {
  const o = partOpts();
  const opt = (obj, v) => Object.entries(obj).map(([k, he]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(he)}</option>`).join('');
  $('#rpBrand').innerHTML = opt(WP.BRANDS, o.brand);
  $('#rpTerm').innerHTML = opt(WP.TERM_BRANDS, o.terminals);
  $('#rpPsu').innerHTML = opt(WP.PSU_BRANDS, o.psu);
  $('#rpRelay').innerHTML = opt(WP.RELAY_BRANDS, o.relay);
  $('#rpCoil').value = o.coil;
  $('#rpOver').checked = o.overwrite;
  const cab = P.components.filter((c) => c.zone !== 'field');
  const withPn = cab.filter((c) => c.partNo).length;
  $('#rpSummary').textContent = `${withPn} מתוך ${cab.length} רכיבים עם מק"ט`;
  const rows = WP.orderList(P, L, o);
  const enc = WP.enclosureFor(E.enclosure(P, L), o.brand);
  $('#rpOrder').innerHTML = `<h3 class="comp-h">רשימת הזמנה</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>יצרן</th><th>מק"ט</th><th>תיאור</th><th>כמות</th><th>תגים</th></tr></thead><tbody>
    <tr class="enc-row"><td>${esc(enc.maker)}</td><td class="mono">${esc(enc.partNo)} <span class="tag-auto">סדרה</span></td><td>${esc(enc.desc)}</td><td class="num">1</td><td class="muted small">מעטפת</td></tr>
    ${rows.map((r) => { const lk = r.partNo !== 'חסר מק"ט' ? WP.productLinks(r.maker, r.partNo) : null; return `<tr class="${r.partNo === 'חסר מק"ט' ? 'missing' : ''}"><td>${esc(r.maker)}</td><td class="mono">${lk && (lk.product || lk.images) ? `<a href="${esc(lk.product || lk.images)}" target="_blank" rel="noopener" title="דף המוצר / תמונות">${esc(r.partNo)} ↗</a>` : esc(r.partNo)}</td><td>${esc(r.desc)}</td><td class="num">${r.qty}</td><td class="mono small">${esc(r.tags.slice(0, 8).join(' '))}${r.tags.length > 8 ? '…' : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function saveRpOpts() {
  raw.settings = raw.settings || {};
  raw.settings.parts = { brand: $('#rpBrand').value, terminals: $('#rpTerm').value, psu: $('#rpPsu').value, relay: $('#rpRelay').value, coil: $('#rpCoil').value, overwrite: $('#rpOver').checked };
  save();
}
function applyRealParts() {
  saveRpOpts();
  const o = partOpts();
  const list = WP.assign(P, L, o);
  let n = 0, series = 0;
  list.forEach((r) => {
    let c = raw.components.find((x) => E.normTag(x.tag) === r.tag);
    if (!c) { const d = P.components.find((x) => x.tag === r.tag) || { tag: r.tag }; c = { tag: r.tag, name: d.name, type: d.type }; raw.components.push(c); }
    c.maker = r.maker; c.partNo = r.partNo; c.partSeries = r.series; c.partExact = r.exact; c.partDesc = r.desc;
    if (!c.desc || c.partAuto) { c.desc = r.desc; c.partAuto = true; }
    n++; if (!r.exact) series++;
  });
  save(); derive(); renderParts(); renderRealParts();
  if (cabView) cabView.vb = null;
  toast(n ? `שובצו ${n} מק"טים (${series} מהם לפי סדרה בלבד). החלקים מופיעים בשרטוט, בתלת־ממד ובכרטיס של כל רכיב.` : 'לכל הרכיבים כבר יש מק"ט מהתכנית. כדי להחליף, סמנו "להחליף גם מק"טים שכבר כתובים".', 7000);
}
function bindRealParts() {
  ['#rpBrand', '#rpTerm', '#rpPsu', '#rpRelay', '#rpCoil', '#rpOver'].forEach((s) => $(s).addEventListener('change', () => { saveRpOpts(); renderRealParts(); }));
  $('#rpApply').onclick = applyRealParts;
  $('#rpCsv').onclick = () => {
    const rows = WP.orderList(P, L, partOpts());
    const enc = WP.enclosureFor(E.enclosure(P, L), partOpts().brand);
    const csv = '﻿' + [['יצרן', 'מק"ט', 'תיאור', 'כמות', 'תגים'], [enc.maker, enc.partNo, enc.desc, 1, 'מעטפת'], ...rows.map((r) => [r.maker, r.partNo, r.desc, r.qty, r.tags.join(' ')])]
      .map((r) => r.map((v) => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\r\n');
    download(fileBase() + '-order.csv', csv, 'text/csv;charset=utf-8');
  };
}

/* ---------- פיצול לכמה ארונות ---------- */
function renderSplitCard() {
  const box = $('#splitCard');
  if (!P.components.length) { box.hidden = true; return; }
  box.hidden = false;
  const adv = WS.advise(P, L);
  const n = adv.need ? adv.count : 2;
  box.innerHTML = `<div class="card-head"><h2>פיצול לכמה ארונות</h2>${adv.need ? '<span class="pill-warn">מומלץ לפצל</span>' : ''}</div>
    <p>${esc(adv.reason)}</p>
    <div class="row gap flexwrap split-form">
      <label class="field"><span>מספר ארונות</span><select id="spN">${[2, 3, 4, 5, 6].map((k) => `<option value="${k}" ${k === n ? 'selected' : ''}>${k}${adv.need && k === adv.count ? ' (מומלץ)' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>איך לחלק</span><select id="spMode"><option value="auto">אוטומטי: כוח והגנות / פיקוד, או לפי שורות</option><option value="power-control">ארון כוח וארון פיקוד</option><option value="sequential">לפי סדר המסילות, בגודל שווה</option></select></label>
      <button class="btn ghost small" type="button" id="spPreview">תצוגה מקדימה</button>
    </div>
    <div id="spOut"></div>`;
  $('#spPreview').onclick = () => previewSplit();
  $('#spN').onchange = () => { $('#spOut').innerHTML = ''; };
  $('#spMode').onchange = () => { $('#spOut').innerHTML = ''; };
}
function splitSettings() {
  const s = { ...(raw.settings || {}) };
  s.plateWidth = !s.plateWidth || s.plateWidth === 'auto' ? 1100 : Math.min(1100, Number(s.plateWidth) || 1100);
  return s;
}
function previewSplit() {
  const n = Number($('#spN').value), mode = $('#spMode').value;
  const r = WS.split(P, L, n, { mode });
  const st = splitSettings();
  const rows = r.cabinets.map((c) => {
    const P2 = E.enrich({ components: c.components, wires: c.wires, settings: st });
    const enc = E.enclosure(P2, E.layout(P2));
    return `<tr><td>ארון ${c.index + 1}</td><td>${esc(c.role)}</td><td class="num">${c.components.filter((x) => x.zone !== 'field').length}</td><td class="num">${c.wires.length}</td><td class="mono">${esc(enc.text)}</td></tr>`;
  }).join('');
  const lk = r.links.map((l) => `<li>ארון ${l.a + 1} ↔ ארון ${l.b + 1}: ${l.cores.length} גידים (${l.kind === 'power' ? 'כולל כוח' : 'פיקוד'}) דרך המהדקים <span class="mono">-XC${l.b + 1}</span> / <span class="mono">-XC${l.a + 1}</span></li>`).join('');
  $('#spOut').innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>ארון</th><th>תפקיד</th><th>רכיבים</th><th>חוטים</th><th>מעטפת</th></tr></thead><tbody>${rows}</tbody></table></div>
    <ul class="small">${lk || '<li>אין חוטים שעוברים בין הארונות.</li>'}</ul>
    <p class="muted small">חוט שעובר בין שני ארונות הופך לשני חוטים: עד מהדק ממשק בכל ארון, וגיד אחד בכבל ביניהם (גיד אחד לכל רשת). הארון המקורי נשמר כמו שהוא.</p>
    <button class="btn" type="button" id="spGo">יצירת ${n} הארונות ואתר ההתקנה</button>`;
  $('#spGo').onclick = () => doSplit(n, mode);
}
async function doSplit(n, mode) {
  if (!(await askConfirm(`לפצל את "${raw.name}" ל-${n} ארונות? נוצרים ${n} ארונות חדשים עם החיווט שלהם ואתר התקנה עם הכבלים ביניהם. הארון המקורי נשאר.`, { ok: 'לפצל' }))) return;
  const r = WS.split(P, L, n, { mode });
  const orig = raw;
  let st = siteOf(orig);
  if (!st) {
    st = { id: newId('s'), name: orig.name + ' — אתר', address: '', created: Date.now(), cabinets: [], files: [], layout: {}, room: null, trayH: 2.6, links: [], ignored: [], stepsDone: {} };
    state.sites.unshift(st);
  }
  const settings = splitSettings();
  const ids = r.cabinets.map((c) => {
    const p = newProject(`${orig.name} · ארון ${c.index + 1} (${c.role})`, {
      siteId: st.id, source: 'split', settings: { ...settings },
      meta: { ...(orig.meta || {}), drawingNo: ((orig.meta && orig.meta.drawingNo) || '') + '/' + (c.index + 1) },
      components: c.components.map((x) => { const y = { ...x }; if (y.zone) y.location = y.zone; return y; }),
      wires: c.wires.map((w) => ({ ...w, id: newId() })),
      notes: [`פוצל מהארון "${orig.name}": ארון ${c.index + 1} מתוך ${n} (${c.role}). חוטים שעוברים לארונות האחרים מחוברים למהדקי הממשק ‎-XC.`],
      pdf: orig.pdf, pdfFrom: orig.pdfFrom || orig.id, hint: orig.hint || ''
    });
    p.status = `ארון ${c.index + 1} מתוך ${n} שפוצלו מ"${orig.name}".`;
    saveProject(p);
    return p.id;
  });
  st.cabinets = st.cabinets.filter((x) => x !== orig.id).concat(ids);
  r.links.forEach((l, i) => st.links.push({ id: 'split-' + Date.now().toString(36) + '-' + i, auto: false, kind: l.kind, reason: `פיצול "${orig.name}": חוטים שעוברים בין ארון ${l.a + 1} לארון ${l.b + 1}`,
    a: { pid: ids[l.a], device: '', strips: ['-XC' + (l.b + 1)] }, b: { pid: ids[l.b], device: '', strips: ['-XC' + (l.a + 1)] }, cores: l.cores }));
  orig.splitInto = st.id;
  saveProject(orig); saveAll(state);
  toast(`נוצרו ${n} ארונות ו-${r.links.length} כבלים ביניהם באתר "${st.name}".`, 7000);
  location.hash = '#site/' + st.id;
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
  /* ארונות שעוד צריך לקרוא את השרטוטים שלהם */
  const unread = cabs.filter((c) => needsReading(c.raw));
  const sr = $('#siteRead');
  sr.hidden = !unread.length;
  if (unread.length) {
    sr.innerHTML = claudeAi
      ? `<div><b>${unread.length} ${unread.length === 1 ? 'ארון מחכה' : 'ארונות מחכים'} לקריאת השרטוטים</b><span>${unread.map((c) => esc(c.name)).join(' · ')}</span></div>${siteReading ? '<button class="btn ghost small" type="button" data-site-stop>עצירה</button>' : '<button class="btn small" type="button" data-site-read>קריאת כל הארונות עם Claude</button>'}`
      : `<div><b>${unread.length} ${unread.length === 1 ? 'ארון' : 'ארונות'} עם שרטוטים שעוד לא נקראו</b><span>${unread.map((c) => esc(c.name)).join(' · ')}. התכניות נשמרו ואפשר לדפדף בהן, אבל את החוטים מהשרטוטים קורא Claude — בגרסת Claude של האתר. שם מעלים את אותם קבצים, וכל הארונות נקראים אחד אחרי השני.</span></div>${CLAUDE_APP ? `<a class="btn small" href="${esc(CLAUDE_APP)}" target="_blank" rel="noopener">פתיחה בגרסת Claude ↗</a>` : ''}`;
  }
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
  $$('#linkDiagram .ic-l').forEach((g) => g.classList.toggle('on', g.dataset.lid === lid));
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
  $('#linkDiagram').innerHTML = linkDiagram(siteData.cabs, links);
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

/* תכנית חיבורים בין ארונות: כל ארון עמודה, כל כבל קו עם מספר, סוג, אורך ומספר גידים */
function linkDiagram(cabs, links) {
  if (cabs.length < 2) return '';
  const order = cabs.slice().sort((a, b) => ((site.layout[a.id] || {}).x || 0) - ((site.layout[b.id] || {}).x || 0));
  const W = 168, G = 96, top = 18, boxH = 74, lane = 40;
  const xOf = {}; order.forEach((c, i) => { xOf[c.id] = 24 + i * (W + G) + W / 2; });
  const width = 48 + order.length * W + (order.length - 1) * G;
  const height = top + boxH + 30 + Math.max(1, links.length) * lane + 10;
  const o = [];
  o.push(`<style>.ic-box rect{fill:#2b3035}.ic-box .n{font:600 14px 'IBM Plex Sans Hebrew',sans-serif;fill:#fff}.ic-box .s{font:500 11px 'IBM Plex Mono',monospace;fill:#a4adb4}.ic-box{cursor:pointer}.ic-box:hover rect{fill:#a85a26}
    .ic-l path{fill:none;stroke-width:3.5;stroke-linejoin:round}.ic-l.power path{stroke:#1c1c1c}.ic-l.control path{stroke:#7d868e}.ic-l.comm path{stroke:#8e44ad}.ic-l{cursor:pointer}.ic-l:hover path,.ic-l.on path{stroke:#c4743a;stroke-width:5}
    .ic-l text{font:600 12px 'IBM Plex Mono',monospace;fill:#1c2126;paint-order:stroke;stroke:#f8f8f6;stroke-width:4px}.ic-l .sub{font:500 11px 'IBM Plex Sans Hebrew',sans-serif;fill:#5f6870}.ic-dot{fill:#c4743a}</style>`);
  order.forEach((c) => {
    const x = xOf[c.id] - W / 2;
    const strips = [...new Set(links.flatMap((l) => l.a.pid === c.id ? l.a.strips || [] : l.b.pid === c.id ? l.b.strips || [] : []))].slice(0, 4).join(' ');
    o.push(`<g class="ic-box" data-open-cab="${esc(c.id)}" data-to="conn"><title>פתיחת החיבורים של ${esc(c.name)}</title><rect x="${x}" y="${top}" width="${W}" height="${boxH}" rx="6"/>
      <text class="n" x="${x + W / 2}" y="${top + 30}" text-anchor="middle" style="direction:ltr;unicode-bidi:plaintext">${esc(String(c.name).slice(0, 20))}</text>
      <text class="s" x="${x + W / 2}" y="${top + 54}" text-anchor="middle">${esc(strips || (c.P.meta.drawingNo || ''))}</text></g>`);
  });
  links.forEach((l, i) => {
    const xa = xOf[l.a.pid], xb = xOf[l.b.pid];
    if (xa == null || xb == null) return;
    const y = top + boxH + 30 + i * lane, off = ((i % 5) - 2) * 10;
    const d = `M${xa + off} ${top + boxH} V${y} H${xb + off} V${top + boxH}`;
    o.push(`<g class="ic-l ${esc(l.kind)}${siteSel && siteSel.lid === l.id ? ' on' : ''}" data-lid="${esc(l.id)}"><title>W${i + 1}: ${esc(cabName(l.a.pid))} ← ${esc(cabName(l.b.pid))}</title><path d="${d}"/>
      <circle class="ic-dot" cx="${xa + off}" cy="${top + boxH}" r="4"/><circle class="ic-dot" cx="${xb + off}" cy="${top + boxH}" r="4"/>
      <text x="${(xa + xb) / 2}" y="${y - 6}" text-anchor="middle">W${i + 1} · ${esc(l.cable.type)} · ${l.length || '?'} מ'</text>
      <text class="sub" x="${(xa + xb) / 2}" y="${y + 15}" text-anchor="middle">${l.cores.length} גידים</text></g>`);
  });
  return `<svg class="ic-svg" viewBox="0 0 ${width} ${height}" style="max-width:${width}px;min-width:${Math.min(width, 560)}px" role="img" aria-label="תכנית חיבורים בין הארונות">${o.join('')}</svg>`;
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
    let cabs = 0, other = 0;
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i], st = rows[i].querySelector('.st');
      rows[i].className = 'busy';
      try {
        if (s.files.some((x) => x.name === f.name && x.size === f.size)) { st.textContent = 'כבר קיים באתר, דילגתי'; rows[i].className = 'skip'; continue; }
        if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { st.textContent = 'קורא…'; st.textContent = await ingestPdf(s, f, (t, frac) => { st.textContent = t; busy(`קובץ ${i + 1} מתוך ${arr.length}: ${t}`, (i + (frac || 0)) / arr.length); }); cabs++; }
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
    busy(null);
    saveAll(state);
    if (site === s && tab === 'site') renderSite();
    toast(`נקלטו ${cabs} תכניות (ארונות) ו-${other} קבצים נוספים.`, 5000);
    /* בגרסת Claude: מיד קוראים את השרטוטים של כל הארונות החדשים */
    if (claudeAi && s.cabinets.some((pid) => { const p = state.projects.find((x) => x.id === pid); return p && needsReading(p); })) readSiteCabinets(s);
  });
}

async function ingestPdf(s, f, onPage) {
  const p = newProject(baseName(f.name), { siteId: s.id });
  saveProject(p);
  const { all } = await readPdfsInto(p, [f], { replace: true, status: (t, frac) => onPage(t, frac) });
  s.cabinets.push(p.id);
  s.files.push({ id: newId('f'), name: f.name, type: 'application/pdf', size: f.size, added: Date.now(), pid: p.id });
  const d = detectContent(p, all);
  const msg = d.kind === 'library' ? `${p.name}: ${p.wires.length} חוטים, ${p.components.length} רכיבים` : d.kind === 'text' ? `${p.wires.length} חוטים מהטקסט` : `${p.pdf.pages} עמודים · תכנית גרפית, לקריאה עם Claude`;
  p.status = 'חלק מהאתר "' + s.name + '". ' + d.msg;
  saveProject(p);
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
  $('#siteFolder').addEventListener('change', (e) => { siteIngest([...e.target.files].filter((f) => !/^\./.test(f.name))); e.target.value = ''; });
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
      if (!(await askConfirm(`להוציא את "${cabName(pid)}" מהאתר? הארון עצמו נשאר ברשימת הארונות.`, { ok: 'להוציא' }))) return;
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
    if (del) { if (!(await askConfirm('למחוק את הכבל מהאתר?', { ok: 'למחוק', danger: true }))) return; site.links = site.links.filter((l) => l.id !== del.dataset.delLink); if (site.links.length === 0 || (siteSel && siteSel.lid === del.dataset.delLink)) siteSel = null; saveAll(state); renderSite(); return; }
    const show = t.closest('[data-show-link]');
    if (show) { siteSelect(null, show.dataset.showLink); $('#siteSel').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.closest('[data-close-sel]')) { siteSelect(null, null); return; }
    if (t.closest('[data-site-read]')) { readSiteCabinets(site).then(() => {}); setTimeout(renderSite, 50); return; }
    if (t.closest('[data-site-stop]')) { if (siteReading) siteReading.abort(); return; }
    const sc = t.closest('[data-scomp]');
    if (sc && siteSel && siteSel.pid) { openSiteComp(siteSel.pid, sc.dataset.scomp); return; }
    const fget = t.closest('[data-fget]');
    if (fget) {
      e.preventDefault();
      const f = site.files.find((x) => x.id === fget.dataset.fget); if (!f) return;
      const b = await siteFileBlob(f);
      if (!b) { toast('הקובץ לא נמצא בדפדפן הזה.'); return; }
      if (/^image\/|pdf/.test(f.type || b.type)) { const u = URL.createObjectURL(b); const w = window.open(u, '_blank'); if (!w) download(f.name, b, f.type); setTimeout(() => URL.revokeObjectURL(u), 60000); }
      else download(f.name, b, f.type);
      return;
    }
    const fdel = t.closest('[data-fdel]');
    if (fdel) {
      const f = site.files.find((x) => x.id === fdel.dataset.fdel); if (!f || !(await askConfirm(`למחוק את "${f.name}" מקבצי האתר?`, { ok: 'למחוק', danger: true }))) return;
      await files.delPrefix(`site:${site.id}:f:${f.id}`);
      site.files = site.files.filter((x) => x !== f); saveAll(state); renderSiteFiles(); return;
    }
    const card = t.closest('.cab-card');
    if (card && !t.closest('button, a')) siteSelect(card.dataset.pid, null);
  });
  $('#linkDiagram').addEventListener('click', (e) => { const g = e.target.closest('.ic-l'); if (g) siteSelect(null, g.dataset.lid); });
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
    download(site.name.replace(/[\\/:*?"<>|]+/g, '_') + '-3d.png', dataUrlBlob(site3d.png()), 'image/png');
  };
  $('#sitePrint').onclick = () => {
    const d = siteData || computeSite();
    openPrint(siteBookHtml({ site, cabs: d.cabs, links: d.links, steps: d.steps, plan: sitePlan ? sitePlan.svg.outerHTML : '', img: site3d && site3d.renderer ? site3d.png() : '', C, S }));
  };
  $('#siteDelete').onclick = async () => {
    if (!(await askConfirm(`למחוק את האתר "${site.name}"? הארונות שלו יישארו ברשימת הארונות, וקבצי האתר שאינם תכניות יימחקו.`, { ok: 'למחוק את האתר', danger: true }))) return;
    await files.delPrefix(`site:${site.id}:`);
    state.projects.forEach((p) => { if (p.siteId === site.id) delete p.siteId; });
    state.sites = state.sites.filter((x) => x !== site);
    site = null; saveAll(state);
    location.hash = '#home';
  };
}

/* ---------- 9. מעבדה: בדיקת תקינות, הדמיה חיה, הוספת רכיבים וחיווט ---------- */
const Sim = window.WSim;
const lab = { mode: 'check', view: null, st: null, res: null, log: [], pick: null, sel: null, pid: null, outFilter: '', ctl: null };
const CHECK_CATS = [
  ['power', 'בדיקת הפעלה (הדמיה)', 'מרימים את המפסק הראשי בהדמיה ובודקים שאין קצר, הגנה שנופלת או סליל שנשרף'],
  ['short', 'קצרים בתכנון', 'שני פוטנציאלים שונים (פאזות, אפס, ‎+24V, ‎0V) באותה רשת חוטים'],
  ['coil', 'מתח סלילים', 'סליל 24V DC שמחובר ל-AC או סליל 230V שמחובר ל-DC'],
  ['pe', 'הארקה', 'כל רכיב מתכתי או עם כניסת 230V מחובר ל-PE'],
  ['color', 'צבעי חוטים', 'הארקה רק ירוק-צהוב, וירוק-צהוב רק להארקה; רשת אחת בצבע אחד'],
  ['section', 'חתך מול ההגנה', 'חתך החוט ביציאה של כל מאמ"ת מתאים לזרם שלו'],
  ['terminal', 'עומס על הדקים', 'לא יותר מ-2 חוטים בהדק רכיב (TWIN) ו-4 בהדק מעבר'],
  ['dup', 'חוטים כפולים', 'אין שני חוטים בין אותם הדקים ואין חוט שחוזר לאותו הדק'],
  ['complete', 'שלמות החיווט', 'לכל רכיב יש את החיבורים שהוא צריך כדי לעבוד']
];
const POT_HE = { L1: 'פאזה L1 · 230V', L2: 'פאזה L2 · 230V', L3: 'פאזה L3 · 230V', N: 'אפס N', PE: 'הארקה PE', '+24': '‎+24V DC', '+12': '‎+12V DC', '0V': '‎0V DC' };
const TAG_PREFIX = { main_switch: 'Q', mcb: 'F', rcd: 'F', fuse: 'F', mpcb: 'Q', overload: 'F', contactor: 'K', relay: 'K', timer: 'K', psu: 'G', transformer: 'T', plc: 'A', io: 'A', terminal: 'X', pe_bar: 'PE', button: 'S', selector: 'S', estop: 'S', lamp: 'H', motor: 'M', sensor: 'B', valve: 'Y', fan: 'E', heater: 'E', socket: 'X', thermostat: 'B', meter: 'P', door_meter: 'P', vfd: 'T', softstarter: 'T', other: 'U', field: 'U' };

function nextTag(type) {
  const pre = TAG_PREFIX[type] || 'U';
  const re = new RegExp('^-' + pre + '(\\d+)$');
  let n = 0;
  P.components.forEach((c) => { const m = re.exec(c.tag); if (m) n = Math.max(n, Number(m[1])); });
  return '-' + pre + (n + 1);
}

function ensureLab() {
  if (lab.view) return;
  lab.view = new CabinetView($('#labHost'), {
    onHover: (id, ev) => labTip(id, ev),
    onSelect: (id) => { lab.sel = id; if (lab.mode === 'edit') renderLabBar(); else if (id) openDrawer(id); else closeDrawer(); },
    onComp: (tag) => labComp(tag),
    onPin: (k) => labPin(k)
  });
  lab.view.layoutMode = false;
}

function labState() {
  if (lab.pid !== raw.id || !lab.st) { lab.st = Sim.initialState(P); lab.pid = raw.id; lab.log = []; lab.res = null; lab.view && (lab.view.vb = null); }
  /* רכיבים חדשים: מצב ההתחלה שלהם */
  const init = Sim.initialState(P);
  Object.keys(init.on).forEach((t) => { if (!(t in lab.st.on)) lab.st.on[t] = init.on[t]; });
  return lab.st;
}

function renderLab() {
  ensureLab();
  labState();
  lab.view.render(P, L, { C });
  lab.view.setLayout(false);
  lab.view.highlight(null);
  $$('#v-lab [data-lmode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lmode === lab.mode)));
  $('#labHint').textContent = {
    check: 'בדיקה אוטומטית של כל החיווט: קצרים, צבעים, חתכים, הארקה, מתח סלילים ועומס על הדקים — וגם הפעלה מדומה של הלוח. לחיצה על ממצא מראה אותו בשרטוט.',
    sim: 'הלוח עובד לפניכם: מרימים מפסקים, לוחצים על לחצנים ומפעילים יציאות בקר — וכל חוט שיש בו מתח זוהר בצבע הפוטנציאל שלו. לחיצה על רכיב בשרטוט מפעילה אותו.',
    edit: 'מוסיפים רכיב לפרויקט, ואז לוחצים על הדק אחד ועל הדק שני בשרטוט כדי לחווט ביניהם. אחר כך עוברים להדמיה ובודקים שזה עובד.'
  }[lab.mode];
  lab.view.setPinMode(lab.mode === 'edit', lab.pick);
  if (lab.mode === 'sim') { if (!lab.res) simRun(null, true); else paintSim(); }
  else lab.view.setSim(null);
  if (lab.sel && P.wires.some((w) => w.id === lab.sel)) lab.view.select(lab.sel, false); else lab.sel = null;
  renderLabBar();
  ({ check: renderLabCheck, sim: renderLabSim, edit: renderLabEdit }[lab.mode])();
}

/* ---------- בדיקות ---------- */
function powerTest() {
  const st = Sim.initialState(P);
  Object.keys(st.on).forEach((t) => { st.on[t] = true; });
  const r = Sim.run(P, st);
  const out = [];
  r.shorts.forEach((sh) => out.push({ sev: 'err', msg: 'קצר כשמפעילים את הלוח: ' + sh.what.join(' מול ') + '.', wires: P.wires.filter((w) => r.shortWires[w.id]).map((w) => w.id) }));
  Object.entries(r.tripped).forEach(([t, why]) => out.push({ sev: 'err', msg: `${t} נופל מיד בהפעלה — ${why}.`, tag: t }));
  Object.entries(r.burnt).forEach(([t, why]) => out.push({ sev: 'err', msg: `${t}: ${why} — הסליל נשרף.`, tag: t }));
  Object.entries(r.comps).forEach(([t, o]) => { if (o.fault && !r.burnt[t]) out.push({ sev: 'warn', msg: `${t}: ${o.fault}.`, tag: t }); });
  const live = Object.keys(r.wires).length;
  return { items: out, live, total: P.wires.length, on: Object.values(r.comps).filter((o) => o.on && !o.tripped).length };
}

function renderLabCheck() {
  const cats = Sim.checks(P);
  const pt = powerTest();
  cats.power = pt.items;
  const sc = Sim.score(cats);
  lab.cats = cats;
  const cls = sc.err ? 'bad' : sc.warn ? 'warn' : '';
  const verdict = sc.err ? `${sc.err} תקלות שצריך לתקן` : sc.warn ? 'הלוח תקין, עם הערות לבדיקה' : 'הלוח תקין — כל הבדיקות עברו';
  $('#labSide').innerHTML = `
    <div class="lab-verdict ${cls}"><span class="led ${sc.err ? 'err' : sc.warn ? 'warn' : 'ok'}"></span><span class="big">${sc.err || sc.warn || '✓'}</span>
      <span>${esc(verdict)}<small>${P.components.length} רכיבים · ${P.wires.length} חוטים · בהפעלה ${pt.live} חוטים מקבלים מתח${sc.warn && sc.err ? ' · ' + sc.warn + ' הערות' : ''}</small></span></div>
    ${CHECK_CATS.map(([k, he, what]) => {
      const it = cats[k] || [], e = it.filter((i) => i.sev === 'err').length;
      return `<details class="chk-cat" ${it.length && (e || it.length < 6) ? 'open' : ''}><summary><span class="led ${e ? 'err' : it.length ? 'warn' : 'ok'}"></span><span class="grow">${esc(he)}</span><span class="cnt mono">${it.length ? it.length : 'תקין'}</span></summary>
        <p class="muted small" style="margin:4px 0 0">${esc(what)}</p>
        ${it.length ? `<ul>${it.slice(0, 60).map((i, n) => `<li class="${i.sev}"><button type="button" data-cat="${k}" data-n="${n}">${isoTags(i.msg)}</button></li>`).join('')}${it.length > 60 ? `<li class="muted small">ועוד ${it.length - 60}…</li>` : ''}</ul>` : ''}
      </details>`;
    }).join('')}
    <p class="muted small">הבדיקות מבוססות על הכללים המקובלים (IEC 60204-1, צבעים וחתכים נפוצים). הן לא מחליפות בדיקת חשמלאי מוסמך ומדידות בלוח האמיתי.</p>`;
}

function labFocusTag(tag) {
  const b = L.comps[tag];
  if (!b || !lab.view.vb) return;
  lab.view.vb = { x: b.x - 160, y: b.y - 120, w: b.w + 320, h: b.h + 240 };
  lab.view.apply();
}
function showFinding(i) {
  if (!i) return;
  if (i.wires && i.wires.length) {
    lab.view.highlight(i.wires);
    lab.view.focusWire(i.wires[0]);
  } else if (i.tag) {
    const ids = compWireIds(P, i.tag);
    lab.view.highlight(ids.length ? ids : null);
    labFocusTag(i.tag);
  }
}

/* ---------- הדמיה ---------- */
function simRun(action, quiet) {
  const st = labState();
  const res = Sim.run(P, st, lab.res);
  st.tripped = { ...res.tripped };
  st.burnt = { ...res.burnt };
  res.state = st;
  const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (action) lab.log.unshift({ t: now, msg: action, bad: false });
  res.events.forEach((m) => lab.log.unshift({ t: now, msg: m, bad: /נפל|נשרף|קצר|חסרה/.test(m) }));
  lab.log = lab.log.slice(0, 120);
  lab.res = res;
  paintSim();
  if (!quiet) { renderLabBar(); renderLabSim(); }
  if (!quiet && vpref.sfx !== false) {
    try { if (res.events.some((m) => /נפל|נשרף|קצר/.test(m))) sfx('err'); else if (res.events.some((m) => /נמשך|שוחרר/.test(m))) sfx('click'); } catch { /* אין צליל */ }
  }
}

function operable() {
  const c = lab.ctl || Sim.controls(P);
  return new Set([...c.main, ...c.protect, ...c.overload, ...c.buttons, ...c.estops, ...c.selectors, ...c.sensors, ...c.switches].map((x) => x.tag));
}
function paintSim() { lab.ctl = Sim.controls(P); lab.view.setSim(lab.res, { operable: operable() }); }

function operate(tag) {
  const c = compBy()[tag];
  if (!c) return;
  const st = labState();
  let msg = '';
  if (/main_switch|mcb|rcd|mpcb|fuse/.test(c.type)) {
    if (st.tripped[tag]) { delete st.tripped[tag]; st.on[tag] = false; msg = `${tag} אופס אחרי נפילה (כבוי — לחיצה נוספת מרימה)`; }
    else { st.on[tag] = !st.on[tag]; msg = `${tag} ${st.on[tag] ? 'הורם' : 'הורד'}`; }
  } else if (c.type === 'overload') {
    if (st.tripped[tag]) { delete st.tripped[tag]; msg = `${tag} אופס`; } else { st.tripped[tag] = 'הופעל לבדיקה'; msg = `${tag} הופעל (בדיקת הגנת עומס)`; }
  } else if (c.type === 'button' || c.type === 'estop') {
    st.pressed[tag] = !st.pressed[tag];
    msg = c.type === 'estop' ? `${tag} ${st.pressed[tag] ? 'נלחץ — עצירת חירום' : 'שוחרר (סיבוב)'}` : `${tag} ${st.pressed[tag] ? 'לחוץ' : 'שוחרר'}`;
  } else if (c.type === 'selector') { st.on[tag] = !st.on[tag]; msg = `${tag} בורר ${st.on[tag] ? 'במצב 1' : 'במצב 0'}`; }
  else if (c.type === 'sensor') { st.sense[tag] = !st.sense[tag]; msg = `${tag} ${st.sense[tag] ? 'מזהה' : 'לא מזהה'}`; }
  else if (c.type === 'thermostat' || c.type === 'other') { st.on[tag] = st.on[tag] === false; msg = `${tag} ${st.on[tag] ? 'סגור' : 'פתוח'}`; }
  else return false;
  simRun(msg);
  return true;
}

function labComp(tag) {
  if (lab.mode === 'sim') { if (operable().has(tag)) { operate(tag); return; } }
  if (lab.mode === 'edit') { lab.selComp = tag; renderLabBar(); }
  openComp(tag);
}

function labTip(id, ev) {
  showTip(id, ev);
  if (!id || lab.mode !== 'sim' || !lab.res) return;
  const pots = lab.res.wires[id] || [];
  const sh = lab.res.shortWires[id];
  $('#tip').insertAdjacentHTML('beforeend', `<p class="pot"><b>${sh ? '⚠ קצר: ' + esc(sh.join(' / ')) : pots.length ? 'מתח: ' + esc(pots.map((p) => POT_HE[p] || p).join(' · ')) : 'אין מתח בחוט'}</b></p>`);
}

/* תגים כמו ‎-A1:DQA.0 בתוך טקסט עברי: עוטפים בבידוד כדי שהמינוס יישאר במקום */
const isoTags = (t) => esc(t).replace(/(^|[\s(])(-[A-Za-z][\w.:+\/-]*)/g, '$1\u2066$2\u2069');
const btnCtl = (tag, name, stTxt, pressed, extra = '') => `<button type="button" data-op="${esc(tag)}" aria-pressed="${pressed}" ${extra}><span class="led ${pressed ? 'ok' : 'off'}"></span><span class="tg">${esc(tag)}</span><span class="nm">${esc(name)}</span><span class="st">${esc(stTxt)}</span></button>`;

function renderLabSim() {
  const r = lab.res, st = lab.st, ctl = lab.ctl || Sim.controls(P);
  if (!r) return;
  const comps = r.comps;
  const en = Object.keys(comps).filter((t) => comps[t].energized), run = Object.keys(comps).filter((t) => comps[t].running), lit = Object.keys(comps).filter((t) => comps[t].lit);
  const bad = Object.keys(comps).filter((t) => comps[t].tripped || comps[t].fault);
  const live = Object.keys(r.wires).length;
  const prot = (x) => { const o = comps[x.tag] || {}; return btnCtl(x.tag, x.name, o.tripped ? 'נפל' : o.on ? 'מורם' : 'כבוי', Boolean(o.on), o.tripped ? 'class="trip"' : ''); };
  const grp = (title, list, fn) => list.length ? `<h3>${esc(title)} <span class="cnt">${list.length}</span></h3><div class="sim-ctl">${list.map(fn).join('')}</div>` : '';
  const f = lab.outFilter.toLowerCase();
  const outs = ctl.outputs.filter((o) => !f || o.key.toLowerCase().includes(f) || String(o.name).toLowerCase().includes(f));
  $('#labSide').innerHTML = `
    <div class="sim-stat">
      <div><b>${live}</b><span>חוטים חיים</span></div><div><b>${en.length}</b><span>סלילים נמשכו</span></div>
      <div><b>${run.length}</b><span>עומסים פועלים</span></div><div class="${bad.length || r.shorts.length ? 'bad' : ''}"><b>${bad.length + r.shorts.length}</b><span>תקלות</span></div>
    </div>
    ${en.length || run.length || lit.length || bad.length ? `<h3>מצב עכשיו</h3><ul class="sim-state">
      ${bad.map((t) => `<li><span class="led err"></span><span class="tg">${esc(t)}</span><span>${esc(comps[t].tripped || comps[t].fault)}</span></li>`).join('')}
      ${en.map((t) => `<li><span class="led ok"></span><span class="tg">${esc(t)}</span><span>נמשך</span></li>`).join('')}
      ${run.map((t) => `<li><span class="led ok"></span><span class="tg">${esc(t)}</span><span>פועל${comps[t].dir ? ' · סיבוב ' + esc(comps[t].dir) : ''}</span></li>`).join('')}
      ${lit.map((t) => `<li><span class="led warn"></span><span class="tg">${esc(t)}</span><span>דולקת</span></li>`).join('')}
    </ul>` : '<p class="muted small">אין עדיין עומס פעיל. מרימים את המפסק הראשי למעלה ומפעילים לחצנים או יציאות בקר.</p>'}
    ${grp('הגנות ומפסקים', ctl.protect, prot)}
    ${grp('ממסרים תרמיים', ctl.overload, (x) => btnCtl(x.tag, x.name, st.tripped[x.tag] ? 'הופעל' : 'תקין', !st.tripped[x.tag]))}
    ${grp('לחצני חירום', ctl.estops, (x) => btnCtl(x.tag, x.name, st.pressed[x.tag] ? 'לחוץ' : 'משוחרר', Boolean(st.pressed[x.tag])))}
    ${grp('לחצנים', ctl.buttons, (x) => btnCtl(x.tag, x.name, st.pressed[x.tag] ? 'לחוץ' : 'משוחרר', Boolean(st.pressed[x.tag])))}
    ${grp('בוררים', ctl.selectors, (x) => btnCtl(x.tag, x.name, st.on[x.tag] ? '1' : '0', Boolean(st.on[x.tag])))}
    ${grp('חיישנים', ctl.sensors, (x) => btnCtl(x.tag, x.name, st.sense[x.tag] ? 'מזהה' : '—', Boolean(st.sense[x.tag])))}
    ${grp('מפסקי גבול ותרמוסטטים', ctl.switches, (x) => btnCtl(x.tag, x.name, st.on[x.tag] === false ? 'פתוח' : 'סגור', st.on[x.tag] !== false))}
    ${ctl.outputs.length ? `<h3>יציאות בקר <span class="cnt">${ctl.outputs.length}</span></h3>
      <p class="muted small" style="margin:0 0 6px">מדמה את התכנית של הבקר: מדליקים יציאה ורואים מה היא מפעילה.</p>
      ${ctl.outputs.length > 16 ? `<input type="search" class="sim-filter" id="simOutF" placeholder="סינון יציאות (תג או מספר)…" value="${esc(lab.outFilter)}" aria-label="סינון יציאות בקר">` : ''}
      <div class="sim-ctl outs">${outs.slice(0, 160).map((o) => `<button type="button" data-out="${esc(o.key)}" aria-pressed="${Boolean(st.out[o.key])}" title="${esc(o.name)}">${esc(o.key)}</button>`).join('')}</div>` : ''}
    <h3>יומן אירועים <span class="cnt">${lab.log.length}</span></h3>
    <ol class="sim-log">${lab.log.length ? lab.log.map((l) => `<li class="${l.bad ? 'bad' : ''}"><time>${esc(l.t)}</time>${isoTags(l.msg)}</li>`).join('') : '<li>ההדמיה מוכנה. ההזנה מחוברת והמפסק הראשי מנותק.</li>'}</ol>`;
}

function renderLabBar() {
  const bar = $('#labBar');
  if (lab.mode === 'check') {
    bar.innerHTML = `<span>הלוח במצב בדיקה. לחיצה על ממצא מימין מסמנת את החוטים או הרכיב בשרטוט.</span><span class="grow"></span><button class="btn ghost small" type="button" id="labClearHl">ניקוי סימון</button>`;
    return;
  }
  if (lab.mode === 'sim') {
    const st = lab.st, ctl = lab.ctl || Sim.controls(P);
    const ms = ctl.main[0];
    const msO = ms && lab.res ? (lab.res.comps[ms.tag] || {}) : {};
    bar.innerHTML = `
      <button class="btn small ${st.feed ? '' : 'ghost'}" type="button" id="simFeed" aria-pressed="${st.feed}"><span class="led ${st.feed ? 'ok' : 'off'}"></span> הזנת רשת ${st.feed ? 'מחוברת' : 'מנותקת'}</button>
      ${ms ? `<button class="btn small ${msO.on ? '' : 'ghost'}" type="button" data-op="${esc(ms.tag)}" aria-pressed="${Boolean(msO.on)}"><span class="led ${msO.tripped ? 'err' : msO.on ? 'ok' : 'off'}"></span> מפסק ראשי <span class="mono" dir="ltr">${esc(ms.tag)}</span> ${msO.on ? 'מורם' : 'מנותק'}</button>` : ''}
      <button class="btn ghost small" type="button" id="simAllOn">הכל למעלה</button>
      <button class="btn ghost small" type="button" id="simReset">איפוס</button>
      <span class="grow"></span>
      <span class="pot-legend"><span><i style="background:#ff8a3d"></i>L1</span><span><i style="background:#c46cff"></i>L2</span><span><i style="background:#ffd23d"></i>L3</span><span><i style="background:#4da3ff"></i>N</span><span><i style="background:#ff4d6d"></i>+24V</span><span><i style="background:#5b8cff"></i>0V</span><span><i style="background:#ff1f1f"></i>קצר</span></span>`;
    return;
  }
  const w = lab.sel && wireById(lab.sel);
  const pk = lab.pick;
  bar.innerHTML = `
    <span class="lab-pick">${pk ? `מ-<span class="ep mono" dir="ltr">${esc(pk)}</span> — לחצו על ההדק השני` : 'חיווט: לחצו על הדק (נקודה צהובה) ואז על הדק נוסף'}</span>
    ${pk ? '<button class="btn ghost small" type="button" id="labPickX">ביטול</button>' : ''}
    <span class="grow"></span>
    ${w ? `<span>חוט <b class="mono">${esc(w.no)}</b></span><button class="btn ghost small" type="button" id="labWEdit">עריכה</button><button class="btn ghost small" type="button" id="labWDel">מחיקה</button>` : ''}`;
}

/* ---------- עריכה: הוספת רכיב וחיווט ---------- */
function labPin(k) {
  if (lab.mode !== 'edit') return;
  if (!lab.pick) { lab.pick = k; lab.view.setPinMode(true, k); renderLabBar(); return; }
  if (lab.pick === k) { lab.pick = null; lab.view.setPinMode(true, null); renderLabBar(); return; }
  const a = lab.pick, i = a.indexOf(':'), j = k.indexOf(':');
  lab.pick = null;
  lab.view.setPinMode(true, null);
  renderLabBar();
  openWireDialog(null, { from: { tag: a.slice(0, i), term: a.slice(i + 1) }, to: { tag: k.slice(0, j), term: k.slice(j + 1) }, added: 'lab' });
}

function renderLabEdit() {
  const types = Object.entries(C.TYPES);
  const added = raw.components.filter((c) => c.added === 'lab');
  const addedW = raw.wires.filter((w) => w.added === 'lab');
  $('#labSide').innerHTML = `
    <h3>הוספת רכיב</h3>
    <form class="lab-form" id="labAdd">
      <label class="field full"><span>סוג</span><select name="type">${types.map(([k, v]) => `<option value="${k}" ${k === (lab.addType || 'contactor') ? 'selected' : ''}>${esc(v.he)}</option>`).join('')}</select></label>
      <label class="field"><span>תג</span><input name="tag" dir="ltr" value="${esc(nextTag(lab.addType || 'contactor'))}" required></label>
      <label class="field"><span>קטבים / הדקים</span><input name="poles" type="number" min="1" max="48" value="${esc(lab.addPoles || '')}" placeholder="לפי הסוג"></label>
      <label class="field full"><span>שם</span><input name="name" placeholder="למשל: מגען משאבה 2"></label>
      <label class="field full"><span>דירוג</span><input name="rating" dir="auto" placeholder="C16 · 24V DC · 4kW · 3P"></label>
      <label class="check full"><input type="checkbox" name="real" checked> לשבץ חלק אמיתי (מק"ט) לפי המותג שנבחר</label>
      <button class="btn full" type="submit">הוספת הרכיב ללוח</button>
    </form>
    <p class="muted small">הרכיב נכנס לפריסה עם כל ההדקים שלו (נקודות צהובות). לחיווט: לוחצים על הדק ועל הדק נוסף, ממלאים צבע וחתך, ושומרים.</p>
    <h3>נוספו במעבדה <span class="cnt">${added.length + addedW.length}</span></h3>
    ${added.length || addedW.length ? `<ul class="lab-added">
      ${added.map((c) => `<li><span class="mono" dir="ltr">${esc(c.tag)}</span><span class="grow">${esc(c.name || E.typeInfo(c.type).he)}${c.partNo ? ' · ' + esc(c.partNo) : ''}</span><button class="btn ghost small" type="button" data-show="${esc(c.tag)}">הצגה</button><button class="btn ghost small" type="button" data-delc="${esc(c.tag)}" aria-label="מחיקת ${esc(c.tag)}">✕</button></li>`).join('')}
      ${addedW.map((w) => `<li><span class="mono">${esc(wireById(w.id) ? wireById(w.id).no : '')}</span><span class="grow" dir="ltr">${esc(w.from.tag)}:${esc(w.from.term)} → ${esc(w.to.tag)}:${esc(w.to.term)}</span><button class="btn ghost small" type="button" data-wedit="${esc(w.id)}">עריכה</button><button class="btn ghost small" type="button" data-delw="${esc(w.id)}" aria-label="מחיקת החוט">✕</button></li>`).join('')}
    </ul>` : '<p class="muted small">עוד לא נוסף כלום.</p>'}`;
}

async function labAddComp(f) {
  const type = f.type.value, tag = E.normTag(f.tag.value);
  if (!tag) { toast('צריך תג.'); return; }
  if (P.components.some((c) => c.tag === tag)) { toast(`התג ${tag} כבר קיים. בחרו תג אחר.`); return; }
  const poles = Number(f.poles.value) || 0;
  const rating = f.rating.value.trim();
  const c = { tag, type, name: f.name.value.trim() || E.typeInfo(type).he, desc: rating, added: 'lab' };
  c.terms = Sim.defaultTerms(type, { poles: poles || (/3P|3\s*קטב/i.test(rating) ? 3 : 0), count: poles || 6 });
  if (f.real.checked && WP) {
    try {
      const r = WP.pick({ ...c, zone: E.typeInfo(type).zone }, partOpts(), P, L);
      if (r && r.partNo) { c.maker = r.maker; c.partNo = r.partNo; c.partSeries = r.series; c.partExact = r.exact; c.partDesc = r.desc; if (!c.desc) { c.desc = r.desc; c.partAuto = true; } }
    } catch { /* בלי מק"ט */ }
  }
  raw.components.push(c);
  lab.addType = type; lab.addPoles = f.poles.value;
  save(); derive();
  if (lab.view) lab.view.vb = null;
  renderLab();
  labFocusTag(tag);
  toast(`${tag} נוסף ללוח עם ההדקים ${c.terms.join(' ')}. עכשיו אפשר לחווט אותו.`, 6000);
}

async function labDelComp(tag) {
  const n = raw.wires.filter((w) => w.from.tag === tag || w.to.tag === tag).length;
  if (!(await askConfirm(`למחוק את ${tag}${n ? ` ואת ${n} החוטים שלו` : ''}?`, { ok: 'למחוק', danger: true }))) return;
  raw.components = raw.components.filter((c) => c.tag !== tag);
  raw.wires = raw.wires.filter((w) => { const k = w.from.tag === tag || w.to.tag === tag; if (k) delete raw.done[w.id]; return !k; });
  save(); derive(); renderLab();
}
async function labDelWire(id) {
  if (!(await askConfirm('למחוק את החוט?', { ok: 'למחוק', danger: true }))) return;
  raw.wires = raw.wires.filter((w) => w.id !== id); delete raw.done[id];
  if (lab.sel === id) lab.sel = null;
  save(); derive(); renderLab();
}

function bindLab() {
  $$('#v-lab [data-lmode]').forEach((b) => { b.onclick = () => { lab.mode = b.dataset.lmode; lab.pick = null; closeDrawer(); if (lab.view) lab.view.vb = null; renderLab(); }; });
  $('#labZin').onclick = () => lab.view && lab.view.zoom(1 / 1.3);
  $('#labZout').onclick = () => lab.view && lab.view.zoom(1.3);
  $('#labFit').onclick = () => lab.view && lab.view.fit();
  $('#labSide').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.cat) { showFinding((lab.cats[t.dataset.cat] || [])[Number(t.dataset.n)]); return; }
    if (t.dataset.op) { operate(t.dataset.op); return; }
    if (t.dataset.out) { const k = t.dataset.out; lab.st.out[k] = !lab.st.out[k]; simRun(`יציאה ${k} ${lab.st.out[k] ? 'הודלקה' : 'כובתה'}`); return; }
    if (t.dataset.show) { labFocusTag(t.dataset.show); lab.view.highlight(compWireIds(P, t.dataset.show)); return; }
    if (t.dataset.delc) { labDelComp(t.dataset.delc); return; }
    if (t.dataset.delw) { labDelWire(t.dataset.delw); return; }
    if (t.dataset.wedit) openWireDialog(t.dataset.wedit);
  });
  $('#labSide').addEventListener('input', (e) => {
    if (e.target.id === 'simOutF') { lab.outFilter = e.target.value; const pos = e.target.selectionStart; renderLabSim(); const i = $('#simOutF'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
  });
  $('#labSide').addEventListener('change', (e) => {
    if (e.target.name === 'type' && e.target.form && e.target.form.id === 'labAdd') { lab.addType = e.target.value; e.target.form.tag.value = nextTag(e.target.value); }
  });
  $('#labSide').addEventListener('submit', (e) => { if (e.target.id === 'labAdd') { e.preventDefault(); labAddComp(e.target); } });
  $('#labBar').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.op) { operate(t.dataset.op); return; }
    if (t.id === 'simFeed') { lab.st.feed = !lab.st.feed; simRun(lab.st.feed ? 'הזנת הרשת חוברה' : 'הזנת הרשת נותקה'); }
    if (t.id === 'simAllOn') { const ctl = lab.ctl || Sim.controls(P); [...ctl.main, ...ctl.protect].forEach((x) => { delete lab.st.tripped[x.tag]; lab.st.on[x.tag] = true; }); simRun('כל המפסקים וההגנות הורמו'); }
    if (t.id === 'simReset') { lab.st = Sim.initialState(P); lab.res = null; lab.log = []; simRun('איפוס — הכל חזר למצב ההתחלה'); }
    if (t.id === 'labClearHl') { lab.view.highlight(null); lab.view.fit(); }
    if (t.id === 'labPickX') { lab.pick = null; lab.view.setPinMode(true, null); renderLabBar(); }
    if (t.id === 'labWEdit' && lab.sel) openWireDialog(lab.sel);
    if (t.id === 'labWDel' && lab.sel) labDelWire(lab.sel);
  });
}

/* ---------- התחלה ---------- */
async function start() {
  /* קודם מחברים את הכפתורים, כדי שהאתר יגיב גם אם האחסון בדפדפן איטי או חסום */
  bind();
  bindLab();
  try { state = await loadAllAsync(); } catch { /* נשארים עם localStorage */ }
  /* פסי הלבן-כחול בחוטי ‎0V של קטע הפתיחה מופיעים אחרי שהחוטים נמתחו */
  setTimeout(() => { const r = $('.run'); if (r) r.classList.add('drawn'); }, 2300);
  const cur = state.current && state.projects.find((p) => p.id === state.current);
  if (cur) { raw = cur; derive(); await loadPages(); }
  if (!raw && /^#p\//.test(location.hash)) location.hash = '#home';
  route();
  checkClaude();
  checkServer();
}
start();
