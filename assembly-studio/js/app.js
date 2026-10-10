/* מכלול — ממשק המשתמש */
const P = window.AsmPrompts;
const S = window.AsmStore;
const D = window.AsmDoc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = D.esc;

const MODEL_EXT = ['sldasm', 'sldprt', 'step', 'stp', 'iges', 'igs', 'stl', 'obj', 'glb', 'gltf'];
const SW_EXT = ['sldasm', 'sldprt'];
const DRAWING_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'slddrw'];
const extOf = (n) => String(n).split('.').pop().toLowerCase();
/* הסוג נקבע לפי הסיומת, כדי שגם קבצים שהועלו בגרסה קודמת של האתר ייפתחו נכון */
const kindOf = (n) => { const e = extOf(n); return MODEL_EXT.includes(e) ? 'model' : DRAWING_EXT.includes(e) ? 'drawing' : 'doc'; };
const baseName = (n) => String(n).replace(/\.[^.]+$/, '');

const state = {
  project: null,
  viewer: null,
  viewerError: '',
  sheets: [],     // [{ id, title, file, blob, url }]
  videos: [],     // [{ id, name, blob, url }]
  refs: [],       // עמודי שרטוט ותמונות: [{ id, parentId, title, blob, url, text }]
  previews: [],   // תמונות תצוגה מקבצי SolidWorks: [{ name, blob, url }]
  notes: [],      // הערות מקריאת קבצי SolidWorks
  ai: { server: false, needCode: false, github: false, code: sessionStorage.getItem('asm-code') || '' },
  step: 'files'
};

/* ---------- כלים קטנים ---------- */
let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 4200);
}
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function safeName(s) { return String(s || 'assembly').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'assembly'; }
function fmtSize(b) { return b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
function blobToDataUrl(blob) { return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); }
let saveTimer;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
function save() { if (state.project) return S.saveProject(state.project); }

/* ---------- מנוע התלת-ממד (נטען רק כשצריך) ---------- */
async function viewer() {
  if (state.viewer) return state.viewer;
  if (state.viewerError) return null;
  try {
    const mod = await import('./viewer.js');
    state.viewer = new mod.Studio3D($('#viewerHome'));
    return state.viewer;
  } catch (e) {
    state.viewerError = 'לא הצלחתי לטעון את מנוע התלת-ממד (' + e.message + '). בדקו חיבור לאינטרנט.';
    return null;
  }
}
function placeViewer(slotId) {
  const slot = $('#' + slotId);
  if (!slot) return;
  if (state.viewer) { state.viewer.attach(slot); slot.classList.toggle('empty', !state.viewer.hasGeometry()); }
  else if (state.viewerError) { slot.classList.add('empty'); slot.dataset.msg = state.viewerError; }
}

/* ---------- ניתוב ---------- */
function route() {
  const h = location.hash.replace(/^#/, '') || 'home';
  const [view, arg] = h.split('/');
  if (view === 'open' && arg) { openProject(arg, 'files'); return; }
  if (view === 'p') {
    if (!state.project) { location.hash = '#home'; return; }
    showView('project');
    showStep(arg || 'files');
    return;
  }
  if (view === 'tasks') { showView('tasks'); renderTasks(); return; }
  showView('home'); renderHome();
}
function showView(v) {
  $$('.view').forEach((el) => { el.hidden = el.id !== 'view-' + v; });
  $('#stepsNav').hidden = v !== 'project';
  if (state.viewer && state.viewer.playing) stopPlay();
  window.scrollTo(0, 0);
}
function showStep(step) {
  state.step = step;
  $$('.panel').forEach((el) => { el.hidden = el.id !== 'panel-' + step; });
  $$('#stepsNav a').forEach((a) => a.setAttribute('aria-current', a.dataset.step === step ? 'step' : 'false'));
  $('#projTitle').textContent = state.project.name || 'פרויקט ללא שם';
  if (state.viewer && state.viewer.playing) stopPlay();
  ({ files: renderFiles, parts: renderParts, plan: renderPlan, video: renderVideo, drawings: renderDrawings, doc: renderDoc })[step]?.();
}

/* ---------- פרויקטים ---------- */
function blankProject(extra) {
  return Object.assign({ id: S.uid('asm'), name: '', system: 'machine', crew: 2, description: '', environment: '', files: [], parts: [], plan: null, plans: 0, createdAt: Date.now() }, extra || {});
}
async function newProject(extra) {
  const p = blankProject(extra);
  await S.saveProject(p);
  await openProject(p.id, 'files');
}
async function openProject(id, step) {
  const p = await S.getProject(id);
  if (!p) { toast('הפרויקט לא נמצא', true); location.hash = '#home'; return; }
  state.project = p;
  localStorage.setItem('asm-current', id);
  state.sheets.forEach((s) => URL.revokeObjectURL(s.url));
  state.videos.forEach((v) => URL.revokeObjectURL(v.url));
  state.refs.forEach((r) => URL.revokeObjectURL(r.url));
  state.sheets = []; state.videos = []; state.refs = [];
  const files = await S.projectFiles(id);
  files.filter((f) => f.kind === 'drawing').sort((a, b) => a.order - b.order).forEach((f) => state.sheets.push({ ...f, url: URL.createObjectURL(f.blob) }));
  files.filter((f) => f.kind === 'ref').sort((a, b) => a.createdAt - b.createdAt || a.page - b.page).forEach((f) => state.refs.push({ ...f, url: URL.createObjectURL(f.blob) }));
  files.filter((f) => f.kind === 'video').sort((a, b) => a.createdAt - b.createdAt).forEach((f) => state.videos.push({ ...f, url: URL.createObjectURL(f.blob) }));
  if (location.hash !== '#p/' + step) location.hash = '#p/' + step;
  else route();
  await loadModel(files);
  await ensureRefs();
}

/* כל קובץ שרטוט (PDF, תמונה, SLDDRW) הופך לתמונות עמוד, פעם אחת, ונשמר */
async function ensureRefs() {
  const p = state.project;
  const files = await S.projectFiles(p.id);
  const done = new Set(files.filter((f) => f.kind === 'ref').map((f) => f.parentId));
  const todo = files.filter((f) => kindOf(f.name) === 'drawing' && !done.has(f.id));
  if (!todo.length) return;
  for (const f of todo) {
    const e = extOf(f.name);
    const add = async (blob, page, title, text) => {
      const r = { id: S.uid('r'), projectId: p.id, kind: 'ref', parentId: f.id, page, title, name: title, text: text || '', blob, createdAt: Date.now() };
      await S.saveFile(r);
      state.refs.push({ ...r, url: URL.createObjectURL(blob) });
    };
    try {
      if (e === 'pdf') {
        toast('קורא את השרטוט ' + f.name + '…');
        const { pdfPages } = await import('./pages.js');
        const { pages, total } = await pdfPages(f.blob);
        for (const pg of pages) await add(pg.blob, pg.page, f.name + (total > 1 ? ' · עמוד ' + pg.page : ''), pg.text);
        if (total > pages.length) toast('נקראו ' + pages.length + ' עמודים ראשונים מתוך ' + total);
      } else if (e === 'slddrw') {
        const { readSolidWorks } = await import('./solidworks.js');
        const r = await readSolidWorks(f.name, new Uint8Array(await f.blob.arrayBuffer()));
        if (r.preview) await add(r.preview, 1, f.name + ' (תמונת תצוגה)');
        else toast('בשרטוט ' + f.name + ' לא נמצאה תמונת תצוגה. שמרו אותו כ-PDF והעלו.', true);
      } else await add(f.blob, 1, f.name);
    } catch (err) { toast('השרטוט ' + f.name + ' לא נקרא: ' + err.message, true); }
  }
  if (state.step === 'files') renderRefs();
}

async function loadModel(files) {
  const p = state.project;
  const all = files || await S.projectFiles(p.id);
  const models = all.filter((f) => f.kind !== 'ref' && kindOf(f.name) === 'model');
  const v = (models.length || p.demo) ? await viewer() : state.viewer;
  if (v) v.clear();
  state.previews.forEach((x) => URL.revokeObjectURL(x.url));
  state.previews = []; state.notes = [];
  let geo = [];
  const extra = new Map(); // חלקים בלי גאומטריה: שם → כמות
  if (v && p.demo) geo = v.demo();
  else if (v && models.length) {
    $('#modelStats').textContent = 'טוען מודל…';
    const parts = models.filter((f) => extOf(f.name) === 'sldprt');
    const resolve = async (name) => {
      const f = parts.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
      return f ? new Uint8Array(await f.blob.arrayBuffer()) : null;
    };
    // קודם המכלולים; חלקים שהמכלול כבר משתמש בהם לא נטענים שוב
    const ordered = models.slice().sort((x, y) => (extOf(y.name) === 'sldasm') - (extOf(x.name) === 'sldasm'));
    const used = new Set(), unused = [];
    for (const f of ordered) {
      const e = extOf(f.name);
      try {
        if (SW_EXT.includes(e)) {
          if (e === 'sldprt' && used.has(f.name.toLowerCase())) continue;
          if (e === 'sldprt' && used.size) { unused.push(f.name); continue; }
          const r = await v.loadSolidWorks(f.name, f.blob, resolve);
          r.components.forEach((c) => { if (c.file) used.add(c.file.toLowerCase()); });
          r.noGeo.forEach((k) => extra.set(k, (extra.get(k) || 0) + 1));
          if (r.preview && (e === 'sldasm' || !ordered.some((x) => extOf(x.name) === 'sldasm'))) state.previews.push({ name: f.name, blob: r.preview, url: URL.createObjectURL(r.preview) });
          state.notes.push(...r.notes.map((n) => f.name + ': ' + n));
        } else await v.loadFile(f.name, f.blob);
      } catch (err) { toast(f.name + ': ' + err.message, true); }
    }
    if (unused.length) state.notes.push(unused.length + ' קבצי חלקים לא שייכים למכלול ולכן לא הוצגו: ' + unused.join(', '));
    geo = v.finalize();
  }
  mergeParts(geo, extra);
  if (v && v.hasGeometry()) { p.bounds = v.bounds(); applyPlanToViewer(); }
  await save();
  const slot = { files: 'slot-files', parts: 'slot-parts', video: 'slot-video' }[state.step];
  if (slot) placeViewer(slot);
  if (state.step === 'files') { renderStats(); renderRefs(); }
  if (state.step === 'parts') renderParts();
}

/* ממזג את החלקים מהמודל עם העריכות של המשתמש. extra: רכיבים שאין להם רשת (שם → כמות) */
function mergeParts(geo, extra) {
  const p = state.project;
  const old = new Map(p.parts.map((x) => [x.key, x]));
  const keep = (g) => {
    const o = old.get(g.key) || {};
    return { ...g, name: o.name || g.name, type: o.type || P.guessType(g.name), material: o.material || '', notes: o.notes || '', dims: o.dims || g.dims || '', ref: o.ref || '' };
  };
  const out = geo.map(keep);
  const have = new Map(out.map((x) => [x.key, x]));
  (extra || new Map()).forEach((qty, key) => {
    if (have.has(key)) { have.get(key).qty += qty; return; }
    const x = keep({ key, name: key, qty, geo: false, fromFile: true });
    out.push(x); have.set(key, x);
  });
  // פריטים שנוספו ידנית או מניתוח שרטוט נשארים
  p.parts.forEach((x) => { if (!x.geo && !x.fromFile && !have.has(x.key)) { out.push(x); have.set(x.key, x); } });
  p.parts = out;
}

function renderHome() {
  S.listProjects().then((list) => {
    const grid = $('#projectGrid');
    $('#noProjects').hidden = list.length > 0;
    grid.innerHTML = list.map((p) => `
      <article class="project-card">
        <h3><a href="#open/${esc(p.id)}">${esc(p.name || 'פרויקט ללא שם')}</a></h3>
        <p class="muted">${esc(P.SYSTEMS[p.system] || '')}</p>
        <p class="stats"><span>${p.parts.length} פריטים</span><span>${p.plan ? p.plan.steps.length + ' שלבים' : 'אין תכנית'}</span><span>${new Date(p.updatedAt || p.createdAt).toLocaleDateString('he-IL')}</span></p>
        <div class="btn-row"><a class="btn small" href="#open/${esc(p.id)}">פתיחה</a><button class="btn ghost small danger" data-del="${esc(p.id)}" type="button">מחיקה</button></div>
      </article>`).join('');
  });
}

/* ---------- 1. קבצים ותיאור ---------- */
function renderFiles() {
  const p = state.project;
  const f = $('#projectForm');
  f.name.value = p.name; f.system.value = p.system; f.crew.value = p.crew || 2;
  f.description.value = p.description; f.environment.value = p.environment || '';
  const list = $('#fileList');
  const kindLabel = (n) => {
    const e = extOf(n);
    if (SW_EXT.includes(e)) return ['model', e === 'sldasm' ? 'מכלול SolidWorks' : 'חלק SolidWorks'];
    if (MODEL_EXT.includes(e)) return ['model', 'תלת-ממד'];
    if (DRAWING_EXT.includes(e)) return ['native', 'שרטוט לניתוח'];
    return ['doc', 'מסמך מצורף'];
  };
  list.innerHTML = p.files.map((file) => {
    const [k, l] = kindLabel(file.name);
    return `<li><span class="badge ${k}">${l}</span><b>${esc(file.name)}</b><span class="muted">${fmtSize(file.size)}</span><button type="button" class="icon-btn" data-rmfile="${esc(file.id)}" aria-label="הסרת ${esc(file.name)}">✕</button></li>`;
  }).join('') || (p.demo ? '<li class="muted">מכלול לדוגמה: יחידת הנעה עם מנוע, מצמד, ציר על שני מיסבים וגלגלת.</li>' : '');
  placeViewer('slot-files');
  renderStats();
  renderRefs();
}
function renderRefs() {
  const items = state.previews.map((x) => ({ title: x.name + ' (תמונת תצוגה)', url: x.url }))
    .concat(state.refs.map((r) => ({ title: r.title, url: r.url })));
  $('#refWrap').hidden = !items.length;
  $('#refGallery').innerHTML = items.map((x) => `<figure><a href="${x.url}" target="_blank" rel="noopener"><img src="${x.url}" alt="${esc(x.title)}" loading="lazy"></a><figcaption>${esc(x.title)}</figcaption></figure>`).join('');
  $('#swNotes').innerHTML = state.notes.map((n) => `<li>${esc(n)}</li>`).join('');
}
function renderStats() {
  const p = state.project, v = state.viewer;
  const el = $('#modelStats');
  if (v && v.hasGeometry()) {
    const n = v.occ.length;
    const extra = p.parts.filter((x) => !x.geo).length;
    el.textContent = `${p.parts.length} פריטים שונים, ${n} חלקים בתלת-ממד${extra ? ` ועוד ${extra} פריטים בלי גאומטריה` : ''}. מידות כלליות: ${p.bounds.map((x) => Math.round(x)).join(' × ')} מ״מ. גוררים לסיבוב, גלגלת לזום.`;
  } else el.textContent = p.parts.length ? `${p.parts.length} פריטים ברשימה, בלי תלת-ממד.` : state.refs.length ? 'אין מודל תלת-ממד. אפשר לבנות רשימת חלקים ותכנית מהשרטוטים בשלב 3.' : 'עוד לא נטען מודל.';
}

async function addFiles(fileList) {
  const p = state.project;
  const files = Array.from(fileList);
  if (!files.length) return;
  let models = 0;
  for (const file of files) {
    const e = extOf(file.name);
    const kind = kindOf(file.name);
    if (kind === 'model') models++;
    const id = S.uid('f');
    await S.saveFile({ id, projectId: p.id, kind, name: file.name, blob: file, createdAt: Date.now() });
    p.files.push({ id, name: file.name, size: file.size, kind });
    if (e === 'sldasm' && !p.name) p.name = baseName(file.name);
  }
  if (p.demo && models) p.demo = false;
  await save();
  renderFiles();
  toast(models ? 'טוען ' + models + ' קבצי תלת-ממד…' : 'הקבצים נוספו');
  if (models) await loadModel();
  await ensureRefs();
  renderFiles();
}

async function removeFile(id) {
  const p = state.project;
  p.files = p.files.filter((f) => f.id !== id);
  await S.deleteFile(id);
  for (const r of state.refs.filter((x) => x.parentId === id)) { await S.deleteFile(r.id); URL.revokeObjectURL(r.url); }
  state.refs = state.refs.filter((x) => x.parentId !== id);
  p.parts = p.parts.filter((x) => !x.fromFile);
  await save();
  await loadModel();
  renderFiles();
}

/* ---------- 2. רשימת חלקים ---------- */
function renderParts() {
  const p = state.project;
  const tb = $('#bomTable tbody');
  const types = Object.entries(P.TYPE_LABELS);
  tb.innerHTML = p.parts.map((x, i) => `
    <tr data-key="${esc(x.key)}">
      <td class="num">${i + 1}</td>
      <td><input data-f="name" value="${esc(x.name)}" aria-label="שם החלק ${i + 1}"></td>
      <td><select data-f="type" aria-label="סוג">${types.map(([k, l]) => `<option value="${k}"${x.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${x.geo ? `<span class="num">${x.qty}</span>` : `<input data-f="qty" type="number" min="1" value="${x.qty || 1}" class="qty" aria-label="כמות">`}</td>
      <td class="num">${x.size ? x.size.map((n) => Math.round(n)).join('×') : `<input data-f="dims" value="${esc(x.dims || '')}" placeholder="—" aria-label="מידות">`}</td>
      <td><input data-f="material" value="${esc(x.material || '')}" placeholder="למשל: פלדה 37" aria-label="חומר"></td>
      <td><input data-f="notes" value="${esc(x.notes || '')}" aria-label="הערות"></td>
      <td>${x.geo ? '' : `<button type="button" class="icon-btn" data-rmpart="${esc(x.key)}" aria-label="מחיקת פריט">✕</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="muted">אין עדיין חלקים. העלו קובץ STEP או הוסיפו פריטים ידנית.</td></tr>';
  placeViewer('slot-parts');
}

/* ---------- 3. תכנית ---------- */
function bomIndex() { return new Map(state.project.parts.map((x, i) => [x.key, i + 1])); }

/* הופך part_ids (מספרי שורות) למפתחות, כדי שעריכת ה-BOM לא תשבור את התכנית */
function attachKeys(plan) {
  const parts = state.project.parts;
  const used = new Set();
  plan.steps.forEach((st) => {
    st.keys = (st.part_ids || []).map((id) => parts[id - 1] && parts[id - 1].key).filter((k) => k && !used.has(k) && used.add(k));
    delete st.part_ids;
  });
  plan.spares.forEach((s) => { s.key = s.part_id && parts[s.part_id - 1] ? parts[s.part_id - 1].key : ''; delete s.part_id; });
  // חלקים שנשכחו נכנסים לשלב האחרון
  const missing = parts.filter((x) => !used.has(x.key)).map((x) => x.key);
  if (missing.length && plan.steps.length) plan.steps[plan.steps.length - 1].keys.push(...missing);
  return plan;
}
/* התכנית בפורמט המסמך: part_ids לפי הסדר הנוכחי של ה-BOM */
function planForDoc() {
  const plan = state.project.plan;
  if (!plan) return null;
  const idx = bomIndex();
  return {
    ...plan,
    steps: plan.steps.map((s) => ({ ...s, part_ids: s.keys.map((k) => idx.get(k)).filter(Boolean) })),
    spares: plan.spares.map((s) => ({ ...s, part_id: idx.get(s.key) || 0 }))
  };
}

function applyPlanToViewer() {
  const v = state.viewer, plan = state.project.plan;
  if (!v || !v.hasGeometry()) return;
  v.title = state.project.name;
  if (!plan) { v.setPlan([v.parts().map((x) => x.key)], [{ title: 'כל החלקים' }]); return; }
  v.setPlan(plan.steps.map((s) => s.keys), plan.steps.map((s) => ({ title: s.title, line: s.instructions[0] || '' })));
}

function projectPayload() {
  const p = state.project;
  return {
    name: p.name, system: p.system, crew: p.crew, description: p.description, environment: p.environment, bounds: p.bounds,
    planNote: $('#planNote').value.trim(), files: p.files.map((f) => ({ name: f.name })),
    drawings: state.previews.map((x) => x.name + ' (תמונת תצוגה)').concat(state.refs.map((r) => r.title)),
    drawingText: state.refs.map((r) => r.text ? '[' + r.title + '] ' + r.text : '').filter(Boolean).join('\n\n'),
    parts: p.parts.map((x) => ({ name: x.name, qty: x.qty, type: x.type, size: x.size, dims: x.dims, center: x.center, geo: x.geo, material: x.material, notes: x.notes }))
  };
}

/* תמונות לשליחה ל-Claude: עמודי השרטוט, תמונות התצוגה של SolidWorks ומבט על המודל */
async function analysisImages() {
  const { toDataUrl } = await import('./pages.js');
  const out = [];
  for (const r of state.refs.slice(0, 10)) out.push({ title: r.title, src: await toDataUrl(r.blob, 1800) });
  for (const x of state.previews.slice(0, 3)) out.push({ title: x.name + ' (תמונת תצוגה)', src: await toDataUrl(x.blob, 1000) });
  const v = state.viewer;
  if (v && v.hasGeometry()) { v.resetPose(); v.home(); out.push({ title: 'מבט תלת-ממדי על המודל', src: v.snapshot(1200, 800) }); }
  return out;
}

/* רשימת החלקים ש-Claude בנה: השורות הראשונות הן החלקים שכבר יש, והשאר נוספים */
function applyBom(bom) {
  const p = state.project;
  const used = new Set(p.parts.map((x) => x.key));
  bom.forEach((b, i) => {
    const cur = p.parts[i];
    if (cur && (cur.geo || cur.fromFile)) {
      if (!cur.material && b.material && !/לא צוין/.test(b.material)) cur.material = b.material;
      if (!cur.notes && b.notes) cur.notes = b.notes;
      if (!cur.ref && b.ref) cur.ref = b.ref;
      if (!cur.size && !cur.dims && b.size) cur.dims = b.size;
      return;
    }
    let key = b.name.trim() || 'פריט ' + (i + 1);
    while (used.has(key) && !(cur && cur.key === key)) key += '·';
    used.add(key);
    const item = { key, name: b.name, qty: Math.max(1, b.qty || 1), type: ['part', 'fastener', 'purchased', 'sub'].includes(b.type) ? b.type : P.guessType(b.name), geo: false, fromDrawing: true, material: /לא צוין/.test(b.material || '') ? '' : (b.material || ''), dims: b.size || '', ref: b.ref || '', notes: b.notes || '' };
    if (cur) p.parts[i] = item; else p.parts.push(item);
  });
  // פריטים ישנים מניתוח קודם שלא חזרו ברשימה החדשה יוצאים
  p.parts = p.parts.filter((x, i) => i < bom.length || x.geo || x.fromFile || !x.fromDrawing);
}

async function acceptPlan(raw, source) {
  const p = state.project;
  const norm = P.normalize(raw);
  if (norm.bom && norm.bom.length) applyBom(norm.bom);
  delete norm.bom;
  const plan = attachKeys(norm);
  plan.source = source;
  plan.createdAt = Date.now();
  p.plan = plan;
  p.plans = (p.plans || 0) + 1;
  await save();
  applyPlanToViewer();
  renderPlan();
  const task = await openTask(plan);
  toast('התכנית נוצרה ונפתחה משימה חדשה: ' + task.title);
}

async function genBasic() {
  if (!state.project.parts.length) { toast('אין חלקים. העלו קובץ מודל או הוסיפו פריטים ברשימת החלקים.', true); return; }
  await acceptPlan(P.basicPlan(projectPayload()), 'basic');
}

async function genAi() {
  const p = state.project;
  if (!p.description.trim() && !p.parts.length && !state.refs.length && !state.previews.length) { toast('כתבו תיאור של המערכת או העלו קבצים ושרטוטים לפני יצירת תכנית.', true); location.hash = '#p/files'; return; }
  if (!state.ai.server) { openPaste(); return; }
  if (state.ai.needCode && !state.ai.code) { if (!(await askCode())) return; }
  const prog = $('#planProgress');
  prog.hidden = false; prog.classList.add('busy');
  const label = $('span', prog);
  label.textContent = state.refs.length ? 'Claude מנתח את השרטוטים ובונה רשימת חלקים ותכנית…' : 'Claude בונה את התכנית…';
  $('#genAi').disabled = true;
  try {
    const images = await analysisImages();
    const headers = { 'content-type': 'application/json' };
    if (state.ai.code) headers['x-access-code'] = state.ai.code;
    const r = await fetch('api/plan', { method: 'POST', headers, body: JSON.stringify({ project: projectPayload(), images }) });
    if (r.status === 401) { state.ai.code = ''; sessionStorage.removeItem('asm-code'); throw new Error('קוד הגישה שגוי'); }
    if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'שגיאת שרת ' + r.status); }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', err = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.t) { text += m.t; label.textContent = 'Claude כותב את התכנית… ' + Math.round(text.length / 100) / 10 + 'K תווים'; }
        if (m.error) err = m.error;
      }
    }
    if (err) throw new Error(err);
    await acceptPlan(P.parsePlan(text), 'claude');
  } catch (e) {
    toast('יצירת התכנית נכשלה: ' + e.message, true);
  } finally {
    prog.hidden = true; prog.classList.remove('busy');
    $('#genAi').disabled = false;
  }
}

function openPaste() {
  $('#pasteBox').value = ''; $('#pasteErr').textContent = '';
  const imgs = state.previews.map((x) => ({ name: x.name + '.png', url: x.url })).concat(state.refs.map((r) => ({ name: r.title + '.jpg', url: r.url })));
  $('#pasteImgs').hidden = !imgs.length;
  $('#pasteAttach').hidden = !imgs.length;
  $('#pasteImgList').innerHTML = imgs.map((x) => `<a class="btn ghost small" href="${x.url}" download="${esc(safeName(x.name))}">${esc(x.name)}</a>`).join('');
  $('#pasteDialog').showModal();
}
function askCode() {
  return new Promise((resolve) => {
    const d = $('#codeDialog');
    $('#codeInput').value = '';
    d.onclose = () => {
      if (d.returnValue === 'ok' && $('#codeInput').value) { state.ai.code = $('#codeInput').value; sessionStorage.setItem('asm-code', state.ai.code); resolve(true); } else resolve(false);
    };
    d.showModal();
  });
}

function renderPlan() {
  const p = state.project, plan = p.plan;
  $('#ghWrap').hidden = !state.ai.github;
  // בלי שרת, התכנית האוטומטית היא הדרך הראשית, ו-Claude.ai הוא תוספת לא חובה
  const auto = !state.ai.server;
  $('#genBasic').className = 'btn' + (auto ? '' : ' ghost');
  $('#genAi').className = 'btn' + (auto ? ' ghost' : '');
  $('#genBasic').textContent = (plan ? 'תכנית אוטומטית חדשה' : 'יצירת תכנית אוטומטית');
  $('#genAi').textContent = auto ? 'ניתוח השרטוט עם Claude.ai (לא חובה)' : (plan ? 'תכנית חדשה עם Claude' : 'יצירת תכנית עם Claude');
  $('#genBasic').parentNode.insertBefore(auto ? $('#genBasic') : $('#genAi'), auto ? $('#genAi') : $('#genBasic'));
  const hint = $('#planHint');
  if (!p.parts.length) hint.textContent = 'אין עדיין רשימת חלקים. כדי לקבל תכנית אוטומטית, העלו בשלב 1 את קובץ ה-SLDASM יחד עם כל קבצי ה-SLDPRT שלו.';
  else hint.textContent = auto ? `התכנית האוטומטית נבנית מהמודל עצמו (${p.parts.length} פריטים), בלי AI ובלי חשבון: הבסיס קודם, אחר כך החלקים מלמטה למעלה, והברגים עם החלק שהם מחברים. אחרי שהיא נוצרת אפשר לערוך כל שלב.` : '';
  $('#planEditor').hidden = !plan;
  if (!plan) return;
  $$('[data-plan]').forEach((el) => { el.value = plan[el.dataset.plan] || ''; });
  $$('[data-plan-list]').forEach((el) => { el.value = (plan[el.dataset.planList] || []).join('\n'); });
  $('#pl-maint').value = plan.maintenance.map((m) => m.task + ' | ' + m.interval).join('\n');
  const mins = plan.steps.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  $('#planMeta').textContent = `מקור: ${plan.source === 'claude' ? 'Claude' : plan.source === 'paste' ? 'Claude.ai (הדבקה)' : 'תכנית בסיסית'} · ${plan.steps.length} שלבים · כ-${Math.round(mins / 6) / 10} שעות עבודה · צוות של ${plan.crew || p.crew} · גרסה ${p.plans}`;
  renderSteps();
  renderSpares();
}

function renderSteps() {
  const p = state.project, plan = p.plan;
  const idx = bomIndex();
  const byKey = new Map(p.parts.map((x) => [x.key, x]));
  const opts = p.parts.map((x) => `<option value="${esc(x.key)}">${idx.get(x.key)}. ${esc(x.name)}</option>`).join('');
  $('#stepsList').innerHTML = plan.steps.map((st, i) => `
    <li class="step-card" data-i="${i}">
      <div class="step-head">
        <span class="step-num">${i + 1}</span>
        <input data-s="title" value="${esc(st.title)}" aria-label="כותרת שלב ${i + 1}">
        <div class="step-tools">
          <button type="button" class="icon-btn" data-act="show" title="הצגה בתלת-ממד" aria-label="הצגת השלב">👁</button>
          <button type="button" class="icon-btn" data-act="up" aria-label="הזזה למעלה"${i ? '' : ' disabled'}>↑</button>
          <button type="button" class="icon-btn" data-act="down" aria-label="הזזה למטה"${i < plan.steps.length - 1 ? '' : ' disabled'}>↓</button>
          <button type="button" class="icon-btn" data-act="del" aria-label="מחיקת השלב">✕</button>
        </div>
      </div>
      <div class="chips">${st.keys.map((k) => `<span class="chip">${idx.get(k) || '?'}. ${esc(byKey.get(k)?.name || k)} ×${byKey.get(k)?.qty || 1}<button type="button" data-act="rmpart" data-key="${esc(k)}" aria-label="הוצאה מהשלב">×</button></span>`).join('')}
        <select data-act="addpart" aria-label="הוספת חלק לשלב"><option value="">+ חלק לשלב</option>${opts}</select></div>
      <div class="form-grid">
        <div class="field span-2"><label>הוראות (שורה לכל פעולה)</label><textarea data-s="instructions" rows="${Math.max(3, st.instructions.length + 1)}">${esc(st.instructions.join('\n'))}</textarea></div>
        <div class="field"><label>מחברים</label><input data-s="fasteners" value="${esc(st.fasteners)}"></div>
        <div class="field"><label>מומנט הידוק</label><input data-s="torque" value="${esc(st.torque)}"></div>
        <div class="field"><label>בדיקה בסוף השלב</label><input data-s="check" value="${esc(st.check)}"></div>
        <div class="field"><label>זמן (דקות)</label><input data-s="minutes" type="number" min="0" value="${Number(st.minutes) || 0}"></div>
        <div class="field span-2"><label>זהירות</label><input data-s="caution" value="${esc(st.caution)}"></div>
      </div>
    </li>`).join('');
}

function renderSpares() {
  const p = state.project, plan = p.plan;
  const cats = Object.entries(P.SPARE_LABELS);
  $('#sparesTable tbody').innerHTML = plan.spares.map((s, i) => `
    <tr data-i="${i}">
      <td><input data-sp="name" value="${esc(s.name || (p.parts.find((x) => x.key === s.key) || {}).name || '')}" aria-label="פריט"></td>
      <td><select data-sp="category" aria-label="קטגוריה">${cats.map(([k, l]) => `<option value="${k}"${s.category === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input data-sp="qty" type="number" min="0" class="qty" value="${Number(s.qty) || 0}" aria-label="כמות"></td>
      <td><input data-sp="interval" value="${esc(s.interval)}" aria-label="תדירות"></td>
      <td><input data-sp="reason" value="${esc(s.reason)}" aria-label="סיבה"></td>
      <td><button type="button" class="icon-btn" data-rmspare="${i}" aria-label="מחיקה">✕</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">אין חלקי חילוף.</td></tr>';
}

/* ---------- משימות ---------- */
async function openTask(plan) {
  const p = state.project;
  const task = {
    id: S.uid('task'), projectId: p.id, projectName: p.name || 'פרויקט ללא שם',
    title: 'הרכבת ' + (p.name || 'מכלול') + ' — תכנית ' + p.plans,
    status: 'todo', createdAt: Date.now(),
    subtasks: plan.steps.map((s, i) => ({ title: (i + 1) + '. ' + s.title, done: false }))
  };
  if (state.ai.github && $('#ghIssue').checked) {
    try {
      const headers = { 'content-type': 'application/json' };
      if (state.ai.code) headers['x-access-code'] = state.ai.code;
      const body = plan.summary + '\n\n' + plan.steps.map((s, i) => `- [ ] ${i + 1}. ${s.title}`).join('\n') + '\n\n**חלקי חילוף:** ' + plan.spares.map((s) => s.name).filter(Boolean).join(', ');
      const r = await fetch('api/task', { method: 'POST', headers, body: JSON.stringify({ title: task.title, body }) });
      const j = await r.json();
      if (r.ok && j.url) task.github = j.url; else toast('פתיחת Issue נכשלה: ' + (j.error || r.status), true);
    } catch (e) { toast('פתיחת Issue נכשלה: ' + e.message, true); }
  }
  await S.saveTask(task);
  p.taskId = task.id;
  await save();
  updateTaskCount();
  return task;
}
async function updateTaskCount() {
  const list = await S.listTasks();
  $('#taskCount').textContent = list.filter((t) => t.status !== 'done').length;
}
const NEXT = { todo: 'doing', doing: 'done', done: 'done' };
const PREV = { todo: 'todo', doing: 'todo', done: 'doing' };
async function renderTasks() {
  const list = await S.listTasks();
  $$('#kanban .col').forEach((col) => {
    const items = list.filter((t) => t.status === col.dataset.status);
    $('.count', col).textContent = items.length;
    $('.cards', col).innerHTML = items.map((t) => {
      const done = t.subtasks.filter((s) => s.done).length, all = t.subtasks.length || 1;
      return `<article class="task-card" data-id="${esc(t.id)}" draggable="true">
        <button type="button" class="task-open" data-open="${esc(t.id)}"><b>${esc(t.title)}</b></button>
        <p class="muted small">${esc(t.projectName)} · ${new Date(t.createdAt).toLocaleDateString('he-IL')}${t.github ? ' · GitHub' : ''}</p>
        <div class="meter" role="img" aria-label="${done} מתוך ${all} שלבים"><i style="width:${Math.round(done / all * 100)}%"></i></div>
        <p class="small">${done}/${t.subtasks.length} שלבים</p>
        <div class="btn-row tight">
          ${t.status !== 'todo' ? `<button type="button" class="btn ghost small" data-move="${esc(t.id)}" data-to="${PREV[t.status]}">→ אחורה</button>` : ''}
          ${t.status !== 'done' ? `<button type="button" class="btn ghost small" data-move="${esc(t.id)}" data-to="${NEXT[t.status]}">קדימה ←</button>` : ''}
        </div>
      </article>`;
    }).join('') || '<p class="muted small">אין משימות</p>';
  });
  updateTaskCount();
}
async function moveTask(id, to) {
  const t = (await S.listTasks()).find((x) => x.id === id);
  if (!t) return;
  t.status = to;
  if (to === 'done') t.subtasks.forEach((s) => { s.done = true; });
  await S.saveTask(t);
  renderTasks();
}
let openTaskId = null;
async function showTask(id) {
  const t = (await S.listTasks()).find((x) => x.id === id);
  if (!t) return;
  openTaskId = id;
  $('#tdTitle').textContent = t.title;
  $('#tdMeta').textContent = `${t.projectName} · נפתחה ${new Date(t.createdAt).toLocaleString('he-IL')} · ${({ todo: 'לביצוע', doing: 'בביצוע', done: 'הושלם' })[t.status]}`;
  $('#tdSubs').innerHTML = t.subtasks.map((s, i) => `<li><label class="check"><input type="checkbox" data-sub="${i}"${s.done ? ' checked' : ''}> ${esc(s.title)}</label></li>`).join('');
  $('#tdOpen').href = '#open/' + t.projectId;
  $('#tdGh').hidden = !t.github; if (t.github) $('#tdGh').href = t.github;
  $('#taskDialog').showModal();
}
async function toggleSub(i, on) {
  const t = (await S.listTasks()).find((x) => x.id === openTaskId);
  t.subtasks[i].done = on;
  const done = t.subtasks.filter((s) => s.done).length;
  t.status = done === t.subtasks.length ? 'done' : done ? 'doing' : 'todo';
  await S.saveTask(t);
  renderTasks();
}

/* ---------- 4. סרטונים ---------- */
function needGeometry(slotMsg) {
  const v = state.viewer;
  if (v && v.hasGeometry()) return false;
  toast(slotMsg || 'צריך מודל תלת-ממד (STEP, STL, OBJ או GLB). העלו קובץ בלשונית ״קבצים ותיאור״.', true);
  return true;
}
function renderVideo() {
  const plan = state.project.plan;
  const sel = $('#vidStep');
  sel.innerHTML = '<option value="all">כל התכנית</option>' + (plan ? plan.steps.map((s, i) => `<option value="${i}">שלב ${i + 1}: ${esc(s.title)}</option>`).join('') : '');
  placeViewer('slot-video');
  renderVideoList();
}
function renderVideoList() {
  $('#videoList').innerHTML = state.videos.map((v) => `
    <li><video src="${v.url}" controls preload="metadata"></video>
      <div class="vid-meta"><b>${esc(v.name)}</b><span class="muted small">${fmtSize(v.blob.size)}</span>
      <a class="btn small" href="${v.url}" download="${esc(v.name)}">הורדה</a>
      <button type="button" class="btn ghost small danger" data-rmvid="${esc(v.id)}">מחיקה</button></div></li>`).join('') || '<li class="muted">עוד לא הוקלטו סרטונים.</li>';
}
function playOpts() {
  const val = $('#vidStep').value, per = Number($('#vidSpeed').value);
  if (val === 'all') return { stepSeconds: per };
  const i = Number(val);
  return { from: i, to: i, stepSeconds: per, intro: false, outro: false };
}
function showCaption(cap) {
  const c = $('#caption');
  if (!cap) { c.hidden = true; return; }
  c.hidden = false;
  $('small', c).textContent = cap.kicker; $('b', c).textContent = cap.title; $('span', c).textContent = cap.line;
}
function play() {
  if (needGeometry()) return;
  if (!state.project.plan) toast('אין עדיין תכנית, מציג את כל החלקים כשלב אחד. צרו תכנית בשלב 3.');
  applyPlanToViewer();
  state.viewer.play({ ...playOpts(), onFrame: showCaption, onEnd: () => showCaption(null) });
}
function stopPlay() { if (state.viewer) state.viewer.stop(); showCaption(null); }

let recording = false;
async function recordClip(opts, name) {
  const prog = $('#recProgress');
  prog.hidden = false;
  const bar = $('.bar', prog), label = $('span', prog);
  label.textContent = 'מקליט: ' + name;
  const { blob, mime } = await state.viewer.record({ ...opts, onProgress: (u) => { bar.style.width = Math.round(u * 100) + '%'; } });
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const file = { id: S.uid('v'), projectId: state.project.id, kind: 'video', name: name + '.' + ext, blob, createdAt: Date.now() };
  await S.saveFile(file);
  state.videos.push({ ...file, url: URL.createObjectURL(blob) });
  renderVideoList();
}
async function record(all) {
  if (recording || needGeometry()) return;
  if (!state.project.plan) { toast('קודם צרו תכנית הרכבה (שלב 3).', true); return; }
  recording = true;
  stopPlay();
  applyPlanToViewer();
  $$('#recAll, #recSteps, #playBtn').forEach((b) => { b.disabled = true; });
  const base = safeName(state.project.name);
  const per = Number($('#vidSpeed').value);
  try {
    if (all) await recordClip({ stepSeconds: per }, base + ' - הרכבה מלאה');
    else {
      const steps = state.project.plan.steps;
      for (let i = 0; i < steps.length; i++) await recordClip({ from: i, to: i, stepSeconds: per + 0.8, intro: false, outro: false }, base + ' - שלב ' + (i + 1));
    }
    toast('ההקלטה הסתיימה');
  } catch (e) {
    toast(e.message, true);
  } finally {
    recording = false;
    $('#recProgress').hidden = true;
    $$('#recAll, #recSteps, #playBtn').forEach((b) => { b.disabled = false; });
  }
}

/* ---------- 5. שרטוטים ---------- */
function renderDrawings() {
  $('#sheetGrid').innerHTML = state.sheets.map((s) => `
    <figure class="sheet-card"><a href="${s.url}" target="_blank" rel="noopener"><img src="${s.url}" alt="${esc(s.title)}" loading="lazy"></a>
      <figcaption><b>${esc(s.title)}</b><a class="btn ghost small" href="${s.url}" download="${esc(s.file)}">PNG</a></figcaption></figure>`).join('') ||
    '<p class="muted">עוד לא נוצרו שרטוטים. לחצו ״יצירת שרטוטים״. מומלץ ליצור קודם תכנית הרכבה, כדי לקבל גם גיליון לכל שלב.</p>';
}
async function genDrawings() {
  if (needGeometry()) return;
  const p = state.project;
  const btn = $('#genDrawings');
  btn.disabled = true; btn.textContent = 'משרטט…';
  await new Promise((r) => setTimeout(r, 30));
  try {
    applyPlanToViewer();
    const bom = p.parts.map((x) => ({ key: x.key, name: x.name, qty: x.qty }));
    const plan = p.plan ? { steps: p.plan.steps.map((s) => ({ title: s.title, keys: s.keys })) } : null;
    const sheets = state.viewer.drawings({ id: p.id, name: p.name }, bom, plan);
    for (const old of state.sheets) { URL.revokeObjectURL(old.url); await S.deleteFile(old.id); }
    state.sheets = [];
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      const blob = await new Promise((r) => s.canvas.toBlob(r, 'image/png'));
      const f = { id: S.uid('d'), projectId: p.id, kind: 'drawing', order: i, title: s.title, file: s.file, name: s.file, blob, createdAt: Date.now() };
      await S.saveFile(f);
      state.sheets.push({ ...f, url: URL.createObjectURL(blob) });
    }
    renderDrawings();
    toast(sheets.length + ' גיליונות שרטוט נוצרו');
  } catch (e) {
    toast('השרטוט נכשל: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'יצירת שרטוטים מחדש';
  }
}

/* ---------- 6. תיק הרכבה ---------- */
let docHtmlCache = '';
async function buildDoc(forWord) {
  const p = state.project;
  const sheets = [];
  if (!forWord) for (const s of state.sheets) sheets.push({ title: s.title, src: await blobToDataUrl(s.blob) });
  const v = state.viewer;
  let snapshot = null;
  if (!forWord && v && v.hasGeometry()) { v.resetPose(); v.home(); snapshot = v.snapshot(1400, 800); }
  return D.build({
    project: p, bom: p.parts, plan: planForDoc(), sheets, snapshot,
    videos: state.videos.map((x) => x.name), rev: $('#docRev').value || 'A', by: $('#docBy').value, forWord
  });
}
async function renderDoc() {
  const by = localStorage.getItem('asm-by');
  if (by && !$('#docBy').value) $('#docBy').value = by;
  docHtmlCache = await buildDoc(false);
  $('#docFrame').srcdoc = docHtmlCache;
}

/* ---------- חיבור לשרת ---------- */
async function checkServer() {
  const badge = $('#aiBadge');
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const j = await r.json();
    Object.assign(state.ai, { server: Boolean(j.ai), needCode: j.needCode, github: Boolean(j.github) });
    badge.textContent = j.ai ? 'מחובר ל-Claude' : 'שרת בלי מפתח API';
    badge.className = 'ai-badge ' + (j.ai ? 'ok' : 'warn');
  } catch {
    badge.textContent = 'מצב העתק-הדבק';
    badge.className = 'ai-badge warn';
    badge.title = 'אין שרת. תכנית עם Claude נוצרת דרך Claude.ai בהעתק-הדבק.';
  }
}

/* ---------- אירועים ---------- */
function bind() {
  $('#f-system').innerHTML = Object.entries(P.SYSTEMS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  window.addEventListener('hashchange', route);
  $('#newProjectTop').onclick = () => newProject();
  $('#newProjectHero').onclick = () => newProject();
  $('#demoBtn').onclick = () => newProject({
    demo: true, name: 'יחידת הנעה לדוגמה', system: 'pump',
    description: 'יחידת הנעה למסוע: מנוע חשמלי על תושבת, מצמד גמיש, ציר על שני בתי מיסב וגלגלת הנעה. הכול מורכב על פלטת בסיס מפלדה שמתברגת לרצפה. חשוב יישור מדויק בין המנוע לציר.',
    environment: 'מפעל, עבודה ב-2 משמרות'
  });
  $('#projectGrid').onclick = async (e) => {
    const id = e.target.dataset.del;
    if (!id || !confirm('למחוק את הפרויקט וכל הקבצים שלו?')) return;
    for (const f of await S.projectFiles(id)) await S.deleteFile(f.id);
    await S.deleteProject(id);
    renderHome();
  };
  $$('[data-go]').forEach((b) => { b.onclick = () => { location.hash = '#p/' + b.dataset.go; }; });

  // שלב 1
  $('#projectForm').addEventListener('input', (e) => {
    const p = state.project, el = e.target;
    p[el.name] = el.type === 'number' ? Number(el.value) : el.value;
    if (el.name === 'name') { $('#projTitle').textContent = el.value; if (state.viewer) state.viewer.title = el.value; }
    saveSoon();
  });
  $('#projectForm').addEventListener('submit', (e) => e.preventDefault());
  $('#fileInput').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  $('#fileList').onclick = (e) => { if (e.target.dataset.rmfile) removeFile(e.target.dataset.rmfile); };

  // שלב 2
  const bom = $('#bomTable');
  bom.addEventListener('input', (e) => {
    const tr = e.target.closest('tr'); const f = e.target.dataset.f;
    if (!tr || !f) return;
    const part = state.project.parts.find((x) => x.key === tr.dataset.key);
    part[f] = f === 'qty' ? Math.max(1, Number(e.target.value) || 1) : e.target.value;
    saveSoon();
  });
  bom.addEventListener('click', (e) => {
    if (e.target.dataset.rmpart) {
      const key = e.target.dataset.rmpart;
      state.project.parts = state.project.parts.filter((x) => x.key !== key);
      if (state.project.plan) state.project.plan.steps.forEach((s) => { s.keys = s.keys.filter((k) => k !== key); });
      save(); renderParts(); return;
    }
    const tr = e.target.closest('tr[data-key]');
    if (tr && state.viewer) { $$('tr.sel', bom).forEach((r) => r.classList.remove('sel')); tr.classList.add('sel'); state.viewer.highlight([tr.dataset.key]); }
  });
  $('#addPart').onclick = () => {
    const key = 'פריט ' + (state.project.parts.length + 1) + '#' + Date.now().toString(36).slice(-3);
    state.project.parts.push({ key, name: 'פריט חדש', qty: 1, type: 'purchased', geo: false, material: '', notes: '' });
    save(); renderParts();
    $('#bomTable tbody tr:last-child input').focus();
  };
  $('#bomCsv').onclick = () => download(safeName(state.project.name) + ' - BOM.csv', D.bomCsv(state.project.parts), 'text/csv;charset=utf-8');

  // שלב 3
  $('#genAi').onclick = genAi;
  $('#genBasic').onclick = genBasic;
  $('#copyPrompt').onclick = async () => {
    const txt = P.copyPrompt(projectPayload());
    try { await navigator.clipboard.writeText(txt); toast('הבקשה הועתקה. הדביקו אותה ב-Claude.ai'); } catch { $('#pasteBox').value = txt; toast('לא הצלחתי להעתיק אוטומטית. הבקשה מופיעה בתיבה: סמנו, העתיקו ונקו את התיבה.'); }
  };
  $('#pasteDialog').addEventListener('close', () => {});
  $('#pasteOk').onclick = async (e) => {
    e.preventDefault();
    try {
      const plan = P.parsePlan($('#pasteBox').value);
      $('#pasteDialog').close();
      await acceptPlan(plan, 'paste');
    } catch (err) { $('#pasteErr').textContent = err.message; }
  };
  const editor = $('#planEditor');
  editor.addEventListener('input', (e) => {
    const plan = state.project.plan, el = e.target;
    if (!plan) return;
    if (el.dataset.plan) plan[el.dataset.plan] = el.value;
    else if (el.dataset.planList) plan[el.dataset.planList] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    else if (el.id === 'pl-maint') plan.maintenance = el.value.split('\n').filter((s) => s.trim()).map((s) => { const [task, interval] = s.split('|'); return { task: task.trim(), interval: (interval || '').trim() }; });
    else if (el.dataset.s) {
      const st = plan.steps[Number(el.closest('[data-i]').dataset.i)];
      st[el.dataset.s] = el.dataset.s === 'instructions' ? el.value.split('\n').map((s) => s.trim()).filter(Boolean) : el.dataset.s === 'minutes' ? Number(el.value) || 0 : el.value;
    } else if (el.dataset.sp) {
      const sp = plan.spares[Number(el.closest('tr').dataset.i)];
      sp[el.dataset.sp] = el.dataset.sp === 'qty' ? Number(el.value) || 0 : el.value;
    }
    saveSoon();
  });
  editor.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act !== 'addpart' || !el.value) return;
    const plan = state.project.plan, i = Number(el.closest('[data-i]').dataset.i);
    plan.steps.forEach((s) => { s.keys = s.keys.filter((k) => k !== el.value); });
    plan.steps[i].keys.push(el.value);
    save(); applyPlanToViewer(); renderSteps();
  });
  editor.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act], [data-rmspare]');
    if (!el) return;
    const plan = state.project.plan;
    if (el.dataset.rmspare != null) { plan.spares.splice(Number(el.dataset.rmspare), 1); save(); renderSpares(); return; }
    const li = el.closest('[data-i]'); if (!li) return;
    const i = Number(li.dataset.i), act = el.dataset.act;
    if (act === 'up' && i > 0) [plan.steps[i - 1], plan.steps[i]] = [plan.steps[i], plan.steps[i - 1]];
    else if (act === 'down' && i < plan.steps.length - 1) [plan.steps[i + 1], plan.steps[i]] = [plan.steps[i], plan.steps[i + 1]];
    else if (act === 'del') {
      if (!confirm('למחוק את השלב? החלקים שלו יעברו לשלב הקודם.')) return;
      const [gone] = plan.steps.splice(i, 1);
      if (plan.steps.length) plan.steps[Math.max(0, i - 1)].keys.push(...gone.keys);
    } else if (act === 'rmpart') {
      plan.steps[i].keys = plan.steps[i].keys.filter((k) => k !== el.dataset.key);
    } else if (act === 'show') {
      if (state.viewer && state.viewer.hasGeometry()) { location.hash = '#p/video'; setTimeout(() => { $('#vidStep').value = String(i); play(); }, 60); }
      else toast('אין מודל תלת-ממד להצגה.', true);
      return;
    } else return;
    save(); applyPlanToViewer(); renderSteps();
  });
  $('#addStep').onclick = () => {
    state.project.plan.steps.push({ title: 'שלב חדש', keys: [], instructions: [], fasteners: '', torque: '—', check: '', caution: '', minutes: 10 });
    save(); renderSteps();
  };
  $('#addSpare').onclick = () => {
    state.project.plan.spares.push({ key: '', name: '', qty: 1, category: 'wear', reason: '', interval: '' });
    save(); renderSpares();
  };

  // שלב 4
  $('#playBtn').onclick = play;
  $('#stopBtn').onclick = stopPlay;
  $('#recAll').onclick = () => record(true);
  $('#recSteps').onclick = () => record(false);
  $('#videoList').onclick = async (e) => {
    const id = e.target.dataset.rmvid;
    if (!id) return;
    await S.deleteFile(id);
    const v = state.videos.find((x) => x.id === id);
    if (v) URL.revokeObjectURL(v.url);
    state.videos = state.videos.filter((x) => x.id !== id);
    renderVideoList();
  };

  // שלב 5
  $('#genDrawings').onclick = genDrawings;

  // שלב 6
  $('#docPrint').onclick = () => { const w = $('#docFrame').contentWindow; w.focus(); w.print(); };
  $('#docHtml').onclick = () => download(safeName(state.project.name) + ' - תיק הרכבה.html', docHtmlCache, 'text/html;charset=utf-8');
  $('#docWord').onclick = async () => download(safeName(state.project.name) + ' - תיק הרכבה.doc', '﻿' + await buildDoc(true), 'application/msword');
  $('#sparesCsv').onclick = () => download(safeName(state.project.name) + ' - חלקי חילוף.csv', D.sparesCsv(planForDoc(), state.project.parts), 'text/csv;charset=utf-8');
  let docTimer;
  ['#docRev', '#docBy'].forEach((s) => $(s).addEventListener('input', () => {
    localStorage.setItem('asm-by', $('#docBy').value);
    clearTimeout(docTimer); docTimer = setTimeout(renderDoc, 500);
  }));

  // משימות
  $('#kanban').addEventListener('click', (e) => {
    const m = e.target.closest('[data-move]');
    if (m) { moveTask(m.dataset.move, m.dataset.to); return; }
    const o = e.target.closest('[data-open]');
    if (o) showTask(o.dataset.open);
  });
  $('#kanban').addEventListener('dragstart', (e) => { const c = e.target.closest('.task-card'); if (c) e.dataTransfer.setData('text/plain', c.dataset.id); });
  $$('#kanban .col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); moveTask(e.dataTransfer.getData('text/plain'), col.dataset.status); });
  });
  $('#tdSubs').addEventListener('change', (e) => { if (e.target.dataset.sub != null) toggleSub(Number(e.target.dataset.sub), e.target.checked); });
  $('#tdClose').onclick = () => $('#taskDialog').close();
  $('#tdOpen').onclick = () => $('#taskDialog').close();
  $('#tdDelete').onclick = async () => {
    if (!confirm('למחוק את המשימה?')) return;
    await S.deleteTask(openTaskId); $('#taskDialog').close(); renderTasks();
  };
  $('#exportTasks').onclick = async () => {
    const list = await S.listTasks();
    const rows = [['משימה', 'פרויקט', 'סטטוס', 'שלבים שבוצעו', 'נפתחה', 'GitHub']].concat(list.map((t) => [t.title, t.projectName, t.status, t.subtasks.filter((s) => s.done).length + '/' + t.subtasks.length, new Date(t.createdAt).toLocaleDateString('he-IL'), t.github || '']));
    download('משימות הרכבה.csv', D.csv(rows), 'text/csv;charset=utf-8');
  };
}

async function start() {
  bind();
  S.persist();
  checkServer();
  updateTaskCount();
  const h = location.hash;
  const last = localStorage.getItem('asm-current');
  if (h.startsWith('#p/') && last) await openProject(last, h.split('/')[1] || 'files');
  else route();
}
start();
