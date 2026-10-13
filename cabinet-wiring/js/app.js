/* ארון־פלאן — ממשק המשתמש */
import { loadAll, saveAll, files } from './store.js';
import { readPdf, blobToBase64 } from './pdf.js';
import { CabinetView } from './view.js';
import { bookHtml, labelsHtml } from './book.js';

const C = window.WCat, E = window.WEngine, Pr = window.WPrompts, Demo = window.WDemo;
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
const wf = { funcs: new Set(), search: '', color: '', state: '' };
const cabFuncs = new Set();
let wiring = { group: 'all', idx: 0 };
let aiAbort = null;

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
  P.name = raw.name;
  L = E.layout(P);
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
  if (m && raw) { tab = m[1]; showView(tab); }
  else { tab = 'home'; showView('home'); }
}

function showView(v) {
  $$('.view').forEach((s) => { s.hidden = s.dataset.view !== v; });
  $('#tabs').hidden = v === 'home';
  $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === v ? 'page' : 'false'));
  if (v === 'home') { renderHome(); closeDrawer(); return; }
  if (v === 'wiring') closeDrawer();
  $('#projTitle').textContent = raw.name;
  updatePill();
  ({ plan: renderPlan, parts: renderParts, wires: renderWires, cabinet: renderCabinet, wiring: renderWiring, assembly: renderAssembly, export: renderExport }[v] || renderPlan)();
}

function rerender() { if (tab !== 'home') showView(tab); if (selected && !$('#drawer').hidden) openDrawer(selected); }

function updatePill() {
  if (!P) return;
  const d = P.wires.filter((w) => raw.done[w.id]).length;
  $('#progressPill').textContent = `${d}/${P.wires.length} חוטים חוברו`;
}

/* ---------- דף הבית ---------- */
function renderHome() {
  const ul = $('#projList');
  if (!state.projects.length) { ul.innerHTML = '<li class="muted">אין עדיין פרויקטים. העלו PDF או פתחו את הדוגמה.</li>'; return; }
  ul.innerHTML = state.projects.map((p) => {
    const d = Object.values(p.done || {}).filter(Boolean).length;
    return `<li><div><a href="#" data-open="${esc(p.id)}">${esc(p.name)}</a>
      <div class="meta">${p.wires.length} חוטים · ${d} חוברו · ${new Date(p.updated).toLocaleDateString('he-IL')}${p.pdf ? ' · PDF' : ''}</div></div>
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
    if (ex.wires.length >= 3 && !raw.wires.length) {
      applyResult({ components: ex.components, wires: ex.wires, meta: {}, notes: [] }, 'text', true);
      msg += ` נמצאו ${ex.wires.length} חוטים בטקסט של ה-PDF. בדקו אותם ברשימת החוטים.`;
    } else if (!raw.wires.length) {
      msg += ' לא נמצאה בטקסט רשימת חוטים. זו כנראה תכנית גרפית: לחצו "קריאה עם Claude".';
    }
    raw.status = msg;
    save(); derive(); rerender();
    toast(msg, 6000);
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
  if (meta.title && /^פרויקט חדש$|\.pdf$/i.test(raw.name)) raw.name = meta.title;
  raw.notes = res.notes || [];
  raw.source = source;
  raw.status = `נטענו ${raw.wires.length} חוטים ו-${raw.components.length} רכיבים (${({ claude: 'Claude', paste: 'Claude.ai', text: 'שליפה מהטקסט', json: 'JSON' })[source] || source}).`;
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
  ai.disabled = !server.ai || !raw.pdf;
  ai.title = !server.ai ? 'אין שרת עם מפתח Claude. השתמשו ב-Claude.ai בהעתק-הדבק, או הריצו את השרת (README).' : !raw.pdf ? 'צריך PDF' : '';
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
  if (raw && tab === 'plan') renderPlan();
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
      <td><button class="icon-btn" type="button" data-del="${esc(c.tag)}" aria-label="מחיקת ${esc(c.tag)}">✕</button></td></tr>`;
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
        <td class="ep">${esc(w.from.tag)}:${esc(w.from.term)}</td><td class="ep">${esc(w.to.tag)}:${esc(w.to.term)}</td>
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
      onComp: (tag) => highlightComp(tag)
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

function highlightComp(tag) {
  const ids = P.wires.filter((w) => w.from.tag === tag || w.to.tag === tag).map((w) => w.id);
  const c = compBy()[tag] || {};
  if (cabView) cabView.highlight(cabView.hlTag === tag ? null : ids);
  cabView.hlTag = cabView.hlTag === tag ? null : tag;
  if (cabView.hlTag) toast(`${tag} — ${c.name || ''}: ${ids.length} חוטים מודגשים. לחיצה נוספת מבטלת.`);
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
    <span class="ep">${esc(w.from.tag)}:${esc(w.from.term)}</span> ← <span class="ep">${esc(w.to.tag)}:${esc(w.to.term)}</span>
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
  return `<div class="end"><div class="lbl">${lbl}</div><div class="ep">${esc(e.tag)}:${esc(e.term)}</div>
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
  $('#dTitle').textContent = `חוט ${w.no} · ${C.FUNCS[w.func].he}`;
  $('#dBody').innerHTML = wireDetailHtml(w);
  $('#dDone').textContent = raw.done[w.id] ? 'ביטול סימון' : 'סימון כמחווט ✓';
  $('#dShowPdf').disabled = !pages.length;
  $('#drawer').hidden = false;
}
function closeDrawer() { $('#drawer').hidden = true; }

function toggleDone(id, v) {
  raw.done[id] = v === undefined ? !raw.done[id] : v;
  if (!raw.done[id]) delete raw.done[id];
  save(); updatePill();
  if (cabView) cabView.setDone(doneSet());
  const tr = $(`#wiresTable tr[data-id="${CSS.escape(id)}"]`); if (tr) tr.classList.toggle('done', Boolean(raw.done[id]));
  if (selected === id && !$('#drawer').hidden) openDrawer(id);
}

/* ---------- 5. חיווט שלב אחר שלב ---------- */
function wiringList() {
  const groups = E.wireOrder(P, L);
  const sel = $('#wGroup');
  sel.innerHTML = `<option value="all">כל החוטים בסדר החיווט (${P.wires.length})</option>` + groups.map((g) => {
    const d = g.wires.filter((w) => raw.done[w.id]).length;
    return `<option value="${g.group.id}" ${wiring.group === g.group.id ? 'selected' : ''}>${esc(g.group.he)} (${d}/${g.wires.length})</option>`;
  }).join('');
  return (wiring.group === 'all' ? groups : groups.filter((g) => g.group.id === wiring.group)).flatMap((g) => g.wires);
}

function renderWiring() {
  const list = wiringList();
  const card = $('#wireCard');
  const d = P.wires.filter((w) => raw.done[w.id]).length;
  $('#wProgBar').style.width = (P.wires.length ? (100 * d / P.wires.length) : 0) + '%';
  $('#wProgText').textContent = `${d} מתוך ${P.wires.length} חוברו`;
  if (!list.length) { card.innerHTML = '<p class="muted">אין חוטים בפרויקט. העלו תכנית או הוסיפו חוטים ברשימת החוטים.</p>'; return; }
  if (selected && list.some((w) => w.id === selected)) wiring.idx = list.findIndex((w) => w.id === selected);
  wiring.idx = Math.max(0, Math.min(list.length - 1, wiring.idx));
  const w = list[wiring.idx];
  const col = C.COLORS[w.color];
  card.innerHTML = `<div class="head"><div><div class="big-no">${esc(w.no)}</div><div class="small muted">חוט ${wiring.idx + 1} מתוך ${list.length} · ${esc(C.FUNCS[w.func].he)}</div></div>
    <div style="min-width:120px;text-align:center"><div class="sw big" style="${swStyle(col)}"></div><div class="small">${esc(col.he)} · ${esc(C.fmtSection(w.section))} ממ"ר</div></div></div>
    ${raw.done[w.id] ? '<p class="done-flag">✓ החוט הזה כבר סומן כמחובר</p>' : ''}
    ${wireDetailHtml(w, { big: true })}`;
  $('#wDone').textContent = raw.done[w.id] ? 'ביטול הסימון' : 'חוברו שני הקצוות ✓';
  if (!miniView) miniView = new CabinetView($('#miniHost'), { mini: true, onHover: (id, ev) => showTip(id, ev), onSelect: () => {} });
  miniView.render(P, L, { C });
  miniView.setDone(doneSet());
  miniView.select(w.id, false);
  miniView.focusWire(w.id);
  selected = w.id;
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
const fileBase = () => (raw.name || 'cabinet').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);

function drawingSvg() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:900px';
  document.body.appendChild(host);
  const v = new CabinetView(host, { mini: true });
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
  document.addEventListener('drop', (e) => { if (!e.target.closest('#drop')) { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], tab !== 'home'); } });

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
  $('#runClaude').onclick = runClaude;
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
    if (hl) { location.hash = '#p/cabinet'; setTimeout(() => highlightComp(hl.dataset.hl), 50); }
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
    if (compBy()[tag]) { cabView.hlTag = null; highlightComp(tag); const b = L.comps[tag]; if (b) { cabView.vb = { x: b.x - 150, y: b.y - 150, w: b.w + 300, h: b.h + 300 }; cabView.apply(); } return; }
    const w = P.wires.find((x) => x.no === q || x.no.toUpperCase() === q.toUpperCase());
    if (w) { select(w.id); cabView.focusWire(w.id); } else toast('לא נמצא רכיב או חוט בשם הזה.');
  });

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
  $('#wDone').onclick = () => {
    const list = wiringList(); const w = list[wiring.idx]; if (!w) return;
    const was = raw.done[w.id];
    toggleDone(w.id);
    if (!was) {
      if (P.wires.every((x) => raw.done[x.id])) { toast('כל החוטים חוברו. עכשיו לבדיקות: "הרכבה ובדיקות".', 6000); renderWiring(); return; }
      wiringStep(1);
    } else renderWiring();
  };
  $('#wGroup').addEventListener('change', (e) => { wiring.group = e.target.value; wiring.idx = 0; selected = null; renderWiring(); });
  $('#wSkipDone').addEventListener('change', renderWiring);

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

/* ---------- התחלה ---------- */
async function start() {
  bind();
  const cur = state.current && state.projects.find((p) => p.id === state.current);
  if (cur) { raw = cur; derive(); await loadPages(); }
  if (!raw && /^#p\//.test(location.hash)) location.hash = '#home';
  route();
  checkServer();
}
start();
