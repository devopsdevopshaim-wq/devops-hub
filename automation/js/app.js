import { APPLICATIONS, BRANDS, PROTOCOLS, PLCS, TEMPLATES, PARAMS, PARAM_FUNCS } from './catalog.js';
import { buildPlant, defaultConfig, motorRow, chooseFamily } from './engine.js';
import { generatePlc, tagList } from './plccode.js';
import { topologySvg, singleLineSvg, resolveSvgVars } from './diagram.js';
import { STATUSES, loadProjects, saveProjects, newProject, logChange } from './projects.js';
import { hbars } from './charts.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v, d = 0) => Number(v).toLocaleString('he-IL', { maximumFractionDigits: d });
const ip = (s) => `<span class="ip">${esc(s)}</span>`;
const slug = (s) => String(s).replace(/[^\w֐-׿-]+/g, '-');

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
function migrate(c) {
  if (!c || c.version !== 1) return null;
  const d = defaultConfig(c.template || 'pumping');
  return { ...d, ...c, site: { ...d.site, ...c.site }, network: { ...d.network, ...c.network }, motors: Array.isArray(c.motors) ? c.motors : d.motors };
}
const projects = loadProjects(store, () => defaultConfig('pumping'), migrate);
const active = () => projects.list.find((p) => p.id === projects.active);
const state = { cfg: active().cfg, plant: null, tab: 'overview', rendered: new Set(), code: null };

function icon(kind) {
  const p = {
    bad: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    warn: '<path d="M12 3l10 18H2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    ok: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  }[kind];
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}
function toast(msg) {
  $$('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
function download(name, text, type = 'text/plain;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv(rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c[k] = c[k] ?? {}; c = c[k]; }); c[ks.at(-1)] = v; }
const addrText = (a) => a.name ? `${a.name} · ${a.ip}` : a.ip ? a.ip : a.slave != null ? `Slave ${a.slave} · קו ${a.segment}` : a.mac != null ? `MAC ${a.mac} · מופע ${a.instance}` : a.node != null ? `Node ${a.node}` : a.position != null ? `מיקום ${a.position} · ${a.station}` : '—';

// ------------------------------------------------------------- compute & persist
function persist() {
  const p = active();
  p.cfg = state.cfg;
  p.updated = new Date().toISOString();
  $('#saveState').textContent = saveProjects(store, projects) ? 'נשמר בדפדפן ✓' : 'לא ניתן לשמור בדפדפן';
}
function recompute({ save = true } = {}) {
  try {
    state.plant = buildPlant(state.cfg);
    state.code = null;
    $('#formErrors').innerHTML = '';
    $('#globalAlert').innerHTML = '';
    if (save) persist();
    sim.sync();
    state.rendered.clear();
    state.rendered.add('plant');
    renderTab(state.tab);
  } catch (e) {
    const list = e.list || [e.message];
    $('#formErrors').innerHTML = `<div class="alert bad">${icon('bad')}<div><b>לא ניתן לחשב:</b><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
    if (state.tab !== 'plant') $('#globalAlert').innerHTML = `<div class="alert bad">${icon('bad')}<div>יש שגיאה בהגדרות. <a href="#plant" data-goto="plant">לתיקון</a></div></div>`;
  }
}

// ------------------------------------------------------------- tabs
const TABS = $$('.tab').map((t) => t.dataset.tab);
function activate(tab, { focus = false } = {}) {
  if (!TABS.includes(tab)) tab = 'overview';
  state.tab = tab;
  $$('.tab').forEach((t) => { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
  $$('.panel').forEach((p) => { p.hidden = p.id !== tab; });
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  renderTab(tab);
  if (focus) $(`#${tab}`).focus();
}
function renderTab(tab) {
  if (!state.plant || state.rendered.has(tab)) return;
  state.rendered.add(tab);
  ({ overview: renderOverview, plant: renderForm, drives: renderDrives, params: renderParams, comm: renderComm, plc: renderPlc, control: renderControl, energy: renderEnergy })[tab]?.();
}
$('.tabbar').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) activate(t.dataset.tab); });
$('.tabbar').addEventListener('keydown', (e) => {
  const i = TABS.indexOf(state.tab);
  const j = { ArrowLeft: (i + 1) % TABS.length, ArrowRight: (i - 1 + TABS.length) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
  if (j != null) { e.preventDefault(); activate(TABS[j]); $(`#tab-${TABS[j]}`).focus(); }
});
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); activate(g.dataset.goto, { focus: true }); window.scrollTo({ top: 0 }); } });
window.addEventListener('hashchange', () => activate(location.hash.slice(1)));

// ------------------------------------------------------------- overview
function kpi(l, v, sub = '') { return `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${sub}</div></div>`; }
function renderOverview() {
  const P = state.plant;
  const c = P.cfg;
  const s = P.stats;
  $('#heroTitle').innerHTML = `${esc(active().name)} <span class="chip">${esc(STATUSES[active().status])}</span>`;
  $('#heroText').textContent = `${s.drives} ממירים · ${n(s.totalKw, 1)} kW מותקנים · ${PROTOCOLS[c.protocol].he} · בקר ${PLCS[c.plc].he}. כל הממירים, ההגנות, הפרמטרים, הכתובות וקוד הבקר מחושבים אוטומטית.`;
  $('#kpis').innerHTML = [
    kpi('ממירים', n(s.drives), `${s.brands > 1 ? `${s.brands} יצרנים` : esc(BRANDS[c.brand].he)}`),
    kpi('הספק מותקן', `${n(s.totalKw, 1)} kW`, `${n(s.totalKva)} kVA מהרשת`),
    kpi('שנאי מומלץ', `${n(s.trafoNeed)} kVA`, `קיים: ${n(c.transformerKVA)} kVA`),
    kpi('פיזור חום בלוחות', `${n(s.heatW / 1000, 1)} kW`, `אוורור ${n(s.airflow)} מ״ק/שעה`),
    kpi('מחזור תקשורת', P.network.cycleMs ? `${n(P.network.cycleMs, 1)} ms` : '—', PROTOCOLS[c.protocol].he),
    kpi('חיסכון אנרגיה בשנה', `${n(s.saveKwh / 1000, 0)} MWh`, `≈ ₪${n(s.saveMoney)} · ${n(s.saveCo2, 1)} טון CO₂`),
  ].join('');
  $('#warnings').innerHTML = [
    ...P.warnings.map((w) => `<div class="alert warn">${icon('warn')}<div>${esc(w)}</div></div>`),
    ...(P.warnings.length ? [] : [`<div class="alert ok">${icon('ok')}<div>אין חריגות: כל הממירים נתמכים בפרוטוקול שנבחר, ועומס הרשת והשנאי תקינים.</div></div>`]),
    ...P.notes.map((w) => `<div class="alert info">${icon('info')}<div>${esc(w)}</div></div>`),
  ].join('');
  $('#choices').innerHTML = `
    <dt>יצרן ברירת מחדל</dt><dd>${esc(BRANDS[c.brand].he)}</dd>
    <dt>פרוטוקול</dt><dd>${esc(PROTOCOLS[c.protocol].he)}</dd>
    <dt>בקר</dt><dd>${esc(PLCS[c.plc].he)}</dd>
    <dt>הזנה</dt><dd><span class="ltr">${c.supplyV} V · ${c.hz} Hz</span></dd>
    <dt>סביבת EMC</dt><dd>${c.environment === 'commercial' ? 'ראשונה (מסחרית)' : 'שנייה (תעשייתית)'}</dd>
    <dt>רשת</dt><dd>${ip(c.network.subnet)}</dd>`;
  $('#bomTable').innerHTML = `<caption class="sr-only">רשימת ציוד</caption><thead><tr><th scope="col">פריט</th><th scope="col" class="num">כמות</th><th scope="col">הערה</th></tr></thead><tbody>${P.bom.map((b) => `<tr><td>${esc(b.item)}</td><td class="num"><b>${n(b.qty)}</b></td><td class="small muted">${esc(b.note)}</td></tr>`).join('')}</tbody>`;
}

// ------------------------------------------------------------- plant form
function fillSelect(sel, entries, cur) { sel.innerHTML = entries.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join(''); if (cur != null) sel.value = String(cur); }
function renderForm() {
  const c = state.cfg;
  const p = active();
  $('#pj-name').value = p.name;
  fillSelect($('#pj-status'), Object.entries(STATUSES), p.status);
  fillSelect($('#tplSel'), [['', 'בחרו תבנית…'], ...Object.entries(TEMPLATES).map(([k, t]) => [k, `${t.he} (${t.motors.length} מנועים)`])], '');
  fillSelect($('#f-brand'), Object.entries(BRANDS).map(([k, b]) => [k, b.he]));
  fillSelect($('#f-proto'), Object.entries(PROTOCOLS).map(([k, x]) => [k, x.he]));
  fillSelect($('#f-plc'), Object.entries(PLCS).map(([k, x]) => [k, x.he]));
  $$('#plantForm [data-path]').forEach((el) => { const v = getPath(c, el.dataset.path); if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; });
  $('#pj-del').hidden = projects.list.length < 2;
  renderMotors();
}
function renderMotors() {
  const apps = Object.entries(APPLICATIONS);
  const brands = [['', 'לפי הפרויקט'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.he])];
  $('#motorRows').innerHTML = state.cfg.motors.map((m, i) => `<tr>
    <td><input type="text" dir="ltr" style="width:92px" aria-label="תג מנוע ${i + 1}" data-m="${i}" data-k="tag" value="${esc(m.tag)}"></td>
    <td><input type="text" aria-label="תיאור מנוע ${i + 1}" data-m="${i}" data-k="name" value="${esc(m.name)}"></td>
    <td><select aria-label="סוג עומס ${i + 1}" data-m="${i}" data-k="app">${apps.map(([k, a]) => `<option value="${k}" ${k === m.app ? 'selected' : ''}>${esc(a.he)}</option>`).join('')}</select></td>
    <td><input type="number" step="0.01" min="0.1" style="width:90px" aria-label="הספק מנוע ${i + 1}" data-m="${i}" data-k="kw" data-num value="${m.kw}"></td>
    <td><input type="number" min="0" max="6000" style="width:90px" aria-label="מהירות מנוע ${i + 1}" data-m="${i}" data-k="rpm" data-num value="${m.rpm || 0}"></td>
    <td><input type="number" min="0" max="2000" style="width:80px" aria-label="אורך כבל ${i + 1}" data-m="${i}" data-k="cableM" data-num value="${m.cableM}"></td>
    <td><select aria-label="יצרן למנוע ${i + 1}" data-m="${i}" data-k="brand">${brands.map(([k, b]) => `<option value="${k}" ${k === (m.brand || '') ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></td>
    <td class="nowrap"><button type="button" class="btn sm ghost" data-dup="${i}" aria-label="שכפול ${esc(m.tag)}">שכפול</button>${state.cfg.motors.length > 1 ? `<button type="button" class="btn sm ghost" data-del="${i}" aria-label="מחיקת ${esc(m.tag)}">מחיקה</button>` : ''}</td>
  </tr>`).join('');
}
let deb;
const schedule = () => { clearTimeout(deb); deb = setTimeout(() => recompute(), 250); };
$('#plantForm').addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.m != null) {
    const m = state.cfg.motors[+el.dataset.m];
    m[el.dataset.k] = el.dataset.num != null ? Number(el.value) : el.value;
    schedule(); return;
  }
  if (!el.dataset.path) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num != null) v = Number(v);
  setPath(state.cfg, el.dataset.path, v);
  schedule();
});
$('#plantForm').addEventListener('submit', (e) => e.preventDefault());
$('#motorRows').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]');
  const u = e.target.closest('[data-dup]');
  if (d) { state.cfg.motors.splice(+d.dataset.del, 1); renderMotors(); recompute(); }
  if (u) {
    const src = state.cfg.motors[+u.dataset.dup];
    const copy = { ...src, tag: nextTag(src.tag) };
    state.cfg.motors.splice(+u.dataset.dup + 1, 0, copy);
    renderMotors(); recompute();
  }
});
function nextTag(tag) {
  const tags = new Set(state.cfg.motors.map((m) => m.tag));
  const m = String(tag).match(/^(.*?)(\d+)$/);
  let k = m ? +m[2] : 0;
  let t;
  do { k++; t = m ? `${m[1]}${String(k).padStart(m[2].length, '0')}` : `${tag}-${k}`; } while (tags.has(t));
  return t;
}
$('#addMotor').addEventListener('click', () => {
  state.cfg.motors.push(motorRow(nextTag('M-100'), 'מנוע חדש', 'pump', 7.5));
  renderMotors(); recompute();
  $$('#motorRows tr').at(-1).querySelector('input').focus();
});
$('#tplLoad').addEventListener('click', () => {
  const k = $('#tplSel').value;
  if (!k) { toast('בחרו תבנית'); return; }
  if (!confirm(`להחליף את רשימת המנועים בתבנית "${TEMPLATES[k].he}"?`)) return;
  const keep = { brand: state.cfg.brand, protocol: state.cfg.protocol, plc: state.cfg.plc };
  state.cfg = { ...defaultConfig(k), ...keep };
  logChange(active(), `נטענה התבנית ${TEMPLATES[k].he}`);
  state.rendered.delete('plant'); renderForm(); recompute();
});

// projects
function renderProjects() {
  fillSelect($('#projSel'), projects.list.map((p) => [p.id, `${p.name} · ${STATUSES[p.status]}`]), projects.active);
}
function switchProject(id) {
  projects.active = id;
  state.cfg = migrate(active().cfg) || defaultConfig();
  sim.reset();
  renderProjects(); renderForm(); recompute();
}
$('#projSel').addEventListener('change', (e) => switchProject(e.target.value));
$('#newProjBtn').addEventListener('click', () => {
  const k = prompt(`סוג המתקן החדש:\n${Object.entries(TEMPLATES).map(([key, t], i) => `${i + 1}. ${t.he}`).join('\n')}\n0. ריק (מנוע אחד)\n\nהקלידו מספר:`, '1');
  if (k == null) return;
  const keys = Object.keys(TEMPLATES);
  const key = keys[+k - 1];
  const cfg = key ? defaultConfig(key) : { ...defaultConfig('pumping'), motors: [motorRow('M-101', 'מנוע 1', 'pump', 7.5)], site: { name: 'מתקן חדש', code: 'NEW', number: 1 } };
  const p = newProject(cfg, { name: cfg.site.name, status: 'plan' });
  logChange(p, 'המתקן נוצר');
  projects.list.push(p);
  switchProject(p.id);
  activate('plant', { focus: true });
  toast('נוצר מתקן חדש. עדכנו את רשימת המנועים.');
});
$('#pj-name').addEventListener('input', (e) => { active().name = e.target.value || 'ללא שם'; persist(); renderProjects(); });
$('#pj-status').addEventListener('change', (e) => { active().status = e.target.value; logChange(active(), `מצב: ${STATUSES[e.target.value]}`); persist(); renderProjects(); });
$('#pj-dup').addEventListener('click', () => {
  const p = newProject(JSON.parse(JSON.stringify(state.cfg)), { name: `${active().name} (עותק)` });
  projects.list.push(p); switchProject(p.id); toast('נוצר עותק');
});
$('#pj-del').addEventListener('click', () => {
  if (projects.list.length < 2 || !confirm(`למחוק את "${active().name}"?`)) return;
  projects.list = projects.list.filter((x) => x.id !== projects.active);
  switchProject(projects.list[0].id);
});
$('#exportBtn').addEventListener('click', () => { const p = active(); download(`driveplan-${slug(p.name)}.json`, JSON.stringify({ driveplanProject: 1, name: p.name, status: p.status, cfg: state.cfg, log: p.log }, null, 2), 'application/json'); });
$('#importLbl').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#importFile').click(); } });
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    const c = migrate(raw.driveplanProject ? raw.cfg : raw);
    if (!c) throw new Error('הקובץ אינו פרויקט דרייב־פלאן');
    const p = newProject(c, { name: raw.name || c.site.name, status: raw.status || 'plan' });
    p.log = raw.log || [];
    projects.list.push(p); switchProject(p.id); toast('הפרויקט נטען');
  } catch (err) { toast(`שגיאה: ${err.message}`); }
  e.target.value = '';
});

// ------------------------------------------------------------- drives & electrical
function renderDrives() {
  const P = state.plant;
  $('#driveTable').innerHTML = `<caption class="sr-only">ממירים</caption><thead><tr>
    <th scope="col">תג</th><th scope="col">מנוע</th><th scope="col">ממיר</th><th scope="col">דירוג</th><th scope="col">ממשק תקשורת</th>
    <th scope="col">הגנה</th><th scope="col">כבל הזנה</th><th scope="col">כבל מנוע</th><th scope="col">אביזרים</th></tr></thead><tbody>${P.drives.map((d) => `<tr>
    <th scope="row"><span class="ip">${esc(d.tag)}</span><div class="small muted">${esc(d.name)}</div></th>
    <td class="small">${esc(APPLICATIONS[d.app].he)}<br><span class="ltr">${d.kw} kW · ${d.In} A · ${d.V} V</span></td>
    <td><b>${esc(BRANDS[d.brand].he)}</b><br>${esc(d.family)}</td>
    <td class="small"><span class="ltr">${d.driveKw} kW · ${d.driveI} A</span><br>${d.duty === 'HD' ? 'עומס כבד (150%)' : 'עומס רגיל (110%)'}</td>
    <td class="small">${esc(d.commOpt)}</td>
    <td class="small"><span class="ltr">${d.fuse} A</span><br>זרם כניסה <span class="ltr">${d.Iin} A</span></td>
    <td class="small">${esc(d.inCable.text)}</td>
    <td class="small">${esc(d.motorCable.text)} מסוכך<br><span class="ltr">${d.cableM} m</span></td>
    <td class="small">${d.accessories.map((a) => `<div title="${esc(a.why)}">• ${esc(a.he)}</div>`).join('')}</td></tr>`).join('')}</tbody>`;
  const s = P.stats;
  $('#elecKpis').innerHTML = [
    kpi('הספק מותקן', `${n(s.totalKw, 1)} kW`), kpi('צריכה מהרשת', `${n(s.totalKva)} kVA`), kpi('שנאי מומלץ', `${n(s.trafoNeed)} kVA`),
    kpi('הפסדי ממירים', `${n(s.heatW)} W`, 'כ-2.5% מההספק'), kpi('אוורור לוחות', `${n(s.airflow)} מ״ק/שעה`, 'להפרש טמפרטורה של 10°C'),
  ].join('');
  const h = P.harmonics;
  $('#harmBox').innerHTML = `<div class="alert ${h.recommend === 'active' ? 'warn' : h.recommend === 'choke' ? 'info' : 'ok'}">${icon(h.recommend === 'active' ? 'warn' : 'info')}<div><b>הרמוניות:</b> הממירים הם ${h.share}% מעומס השנאי. THDi משוער: כ-${h.thdiNoChoke}% בלי משנק, כ-${h.thdiChoke}% עם משנק DC או AC, וכ-${h.thdiAfe}% עם AFE או מסנן אקטיבי. ${h.recommend === 'active' ? 'מומלץ מסנן הרמוניות אקטיבי מרכזי או ממירים בתצורת Low Harmonic.' : h.recommend === 'choke' ? 'מספיקים משנקים בכל ממיר.' : 'העומס נמוך ביחס לשנאי.'}</div></div>`;
  $('#sld').innerHTML = singleLineSvg(P);
  fillSelect($('#cmpSel'), P.drives.map((d) => [d.i, `${d.tag} · ${d.kw} kW`]), $('#cmpSel').value || 0);
  drawCompare();
}
function drawCompare() {
  const d = state.plant.drives[+$('#cmpSel').value] || state.plant.drives[0];
  const proto = state.cfg.protocol;
  $('#cmpTable').innerHTML = `<caption class="small muted" style="font-weight:400">כל היצרנים עבור ${esc(d.tag)} (${d.driveKw} kW, ${esc(APPLICATIONS[d.app].he)}) ב-${esc(PROTOCOLS[proto].he)}. לחיצה על "בחירה" מחליפה את היצרן למנוע הזה.</caption>
    <thead><tr><th scope="col">יצרן</th><th scope="col">סדרה מתאימה</th><th scope="col">ממשק ${esc(PROTOCOLS[proto].he)}</th><th scope="col">מפת פרמטרים</th><th scope="col"><span class="sr-only">בחירה</span></th></tr></thead>
    <tbody>${Object.entries(BRANDS).map(([k, b]) => {
    const f = chooseFamily(k, d.app, d.driveKw);
    const c = b.comm[proto] || 'Gateway';
    return `<tr${k === d.brand ? ' style="background:color-mix(in srgb, var(--gold) 10%, transparent)"' : ''}><td><b>${esc(b.he)}</b></td><td>${esc(f.name)}</td><td class="small">${/gateway/i.test(c) ? `<span class="chip">${esc(c)}</span>` : esc(c)}</td><td class="small">${PARAMS[k] ? '✓ מלאה' : 'שמות פונקציות'}</td><td>${k === d.brand ? '<span class="chip">נבחר</span>' : `<button class="btn sm" data-pick="${k}">בחירה</button>`}</td></tr>`;
  }).join('')}</tbody>`;
}
$('#cmpSel').addEventListener('change', drawCompare);
$('#cmpTable').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  const d = state.plant.drives[+$('#cmpSel').value];
  state.cfg.motors[d.i].brand = b.dataset.pick === state.cfg.brand ? '' : b.dataset.pick;
  logChange(active(), `${d.tag}: יצרן ${BRANDS[b.dataset.pick].he}`);
  recompute();
  state.rendered.delete('plant');
  toast(`${d.tag} ← ${BRANDS[b.dataset.pick].he}`);
});
$('#csvDrives').addEventListener('click', () => {
  const P = state.plant;
  download(`driveplan-${slug(active().name)}-drives.csv`, csv([['Tag', 'Name', 'Load', 'Motor kW', 'Motor A', 'V', 'Brand', 'Family', 'Drive kW', 'Duty', 'Comm', 'Fuse A', 'Input cable', 'Motor cable', 'Cable m', 'Accessories'],
    ...P.drives.map((d) => [d.tag, d.name, d.app, d.kw, d.In, d.V, BRANDS[d.brand].he, d.family, d.driveKw, d.duty, d.commOpt, d.fuse, d.inCable.text, d.motorCable.text, d.cableM, d.accessories.map((a) => a.he).join(' | ')])]), 'text/csv;charset=utf-8');
});
$('#dlSld').addEventListener('click', () => download(`driveplan-${slug(active().name)}-sld.svg`, resolveSvgVars(singleLineSvg(state.plant)), 'image/svg+xml'));

// ------------------------------------------------------------- parameters
function renderParams() {
  const P = state.plant;
  fillSelect($('#prmDrive'), P.drives.map((d) => [d.i, `${d.tag} · ${d.name}`]), $('#prmDrive').value || 0);
  fillSelect($('#prmBrand'), [['', 'היצרן שנבחר'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.he])], $('#prmBrand').value || '');
  drawParams();
}
function sheetFor(d, brandOverride) {
  if (!brandOverride || brandOverride === d.brand) return { brand: d.brand, rows: d.params };
  const cfg = JSON.parse(JSON.stringify(state.cfg));
  cfg.motors = [cfg.motors[d.i]];
  cfg.motors[0].brand = brandOverride;
  const alt = buildPlant(cfg).drives[0];
  // keep the real addresses of this drive
  alt.params.forEach((r, k) => { if (['commAddr', 'commIp'].includes(r.key)) r.value = d.params[k].value; });
  return { brand: brandOverride, rows: alt.params, family: alt.family };
}
function drawParams() {
  const d = state.plant.drives[+$('#prmDrive').value] || state.plant.drives[0];
  const sh = sheetFor(d, $('#prmBrand').value);
  $('#prmTable').innerHTML = `<caption>${esc(d.tag)} · ${esc(BRANDS[sh.brand].he)} ${esc(sh.family || d.family)} · ${d.kw} kW</caption><thead><tr><th scope="col">#</th><th scope="col">פונקציה</th><th scope="col">פרמטר</th><th scope="col">ערך להזנה</th></tr></thead><tbody>${sh.rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.he)}</td><td class="ip"><b>${esc(r.id)}</b></td><td><bdi dir="auto">${esc(r.value)}</bdi></td></tr>`).join('')}</tbody>`;
}
$('#prmDrive').addEventListener('change', drawParams);
$('#prmBrand').addEventListener('change', drawParams);
$('#csvParams').addEventListener('click', () => {
  const rows = [['Drive', 'Brand', 'Family', '#', 'Function', 'Parameter', 'Value']];
  for (const d of state.plant.drives) d.params.forEach((r, i) => rows.push([d.tag, BRANDS[d.brand].he, d.family, i + 1, r.he, r.id, r.value]));
  download(`driveplan-${slug(active().name)}-parameters.csv`, csv(rows), 'text/csv;charset=utf-8');
});

// ------------------------------------------------------------- communication
function netRules(P) {
  const m = PROTOCOLS[P.cfg.protocol].medium;
  const r = {
    rs485: ['כבל זוג שזור מסוכך (120Ω), חיווט בשרשרת בלבד, בלי ענפים', 'נגד סיום 120Ω בשני הקצוות, ו-Bias פעם אחת בצד המאסטר', `עד ${P.network.rs485?.lengthM || 1200} מ׳ לקו בקצב שנבחר, ועד 31 התקנים בלי Repeater`, 'סיכוך מוארק בנקודה אחת, ו-0V משותף (GND) בין כל ההתקנים', 'אותם קצב, פורמט וזוגיות בכל הממירים'],
    ethernet: ['כבל תעשייתי מסוכך Cat5e/6, עד 100 מ׳ בין מתגים', 'מתגים מנוהלים. ב-PROFINET: Conformance Class B ו-MRP. ב-EtherNet/IP: ‏IGMP Snooping', 'הפרדת רשת התהליך מהרשת המשרדית (VLAN או חומת אש, IEC 62443)', 'כתובות קבועות לממירים. ב-PROFINET שם התקן ייחודי באותיות קטנות', 'גיבוי הגדרות המתגים ושמירת MAC/IP בטבלת הכתובות'],
    can: ['כבל CAN זוג שזור 120Ω, טופולוגיית קו', 'נגד סיום 120Ω בשני הקצוות בלבד', 'Node ID ייחודי וקצב אחיד לכל ההתקנים', 'Heartbeat ‏(1017h) לזיהוי ניתוק'],
  }[m];
  return r || [];
}
function renderComm() {
  const P = state.plant;
  const c = P.cfg;
  const pr = PROTOCOLS[c.protocol];
  $('#netSummary').innerHTML = `
    <dt>פרוטוקול</dt><dd>${esc(pr.he)}</dd>
    <dt>טופולוגיה</dt><dd>${{ line: 'קו / שרשרת', star: 'כוכב', ring: c.redundancy ? 'טבעת (MRP)' : 'כוכב' }[pr.topology]}</dd>
    ${pr.medium === 'ethernet' ? `<dt>רשת</dt><dd>${ip(c.network.subnet)} · Gateway ${ip(P.drives[0]?.addr.gw || '')}</dd>` : ''}
    ${pr.medium === 'rs485' && c.protocol !== 'profibus' ? `<dt>הגדרות קו</dt><dd><span class="ltr">${c.network.rtuBaud} bps · ${c.network.rtuFormat}</span></dd>` : ''}
    ${pr.medium === 'can' ? `<dt>קצב</dt><dd><span class="ltr">${c.network.canBitrate} kbit/s</span></dd>` : ''}
    <dt>זמני מחזור</dt><dd>${esc(P.network.load?.text || '—')}</dd>`;
  $('#netRules').innerHTML = netRules(P).map((x) => `<li>${esc(x)}</li>`).join('');
  $('#netDevices').innerHTML = `<thead><tr><th scope="col">התקן</th><th scope="col">כתובת</th><th scope="col">הערה</th></tr></thead><tbody>${P.network.devices.map((x) => `<tr><td>${esc(x.name)}</td><td class="ip">${esc(x.ip)}</td><td class="small">${esc(x.model || x.note)}</td></tr>`).join('')}</tbody>`;
  $('#addrTable').innerHTML = `<thead><tr><th scope="col">תג</th><th scope="col">ממיר</th><th scope="col">כתובת</th><th scope="col">מסכה / פורט</th><th scope="col">פרטים</th></tr></thead><tbody>${P.drives.map((d) => {
    const a = d.addr;
    return `<tr><td class="ip"><b>${esc(d.tag)}</b></td><td class="small">${esc(BRANDS[d.brand].he)} ${esc(d.family)}</td><td class="ip">${esc(addrText(a))}</td><td class="ip small">${a.mask ? `${esc(a.mask)}${a.port ? ` · ${a.port}` : ''}` : '—'}</td><td class="small">${a.unit != null ? `Unit ID ${a.unit}` : ''}${a.instance != null ? `Device Instance ${a.instance}` : ''}${a.name ? 'שם PROFINET (להגדרה מה-TIA/PRONETA)' : ''}${a.segment ? `קו RS-485 ${a.segment}` : ''}</td></tr>`;
  }).join('')}</tbody>`;
  fillSelect($('#dmSel'), P.drives.map((d) => [d.i, `${d.tag} · ${BRANDS[d.brand].he}`]), $('#dmSel').value || 0);
  drawDataMap();
  $('#topo').innerHTML = topologySvg(P);
}
function drawDataMap() {
  const d = state.plant.drives[+$('#dmSel').value] || state.plant.drives[0];
  const m = d.datamap;
  const tbl = (rows, title) => `<div><h4>${title}</h4><div class="table-wrap"><table><thead><tr><th scope="col">כתובת / אובייקט</th><th scope="col">תוכן</th><th scope="col">סוג</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="ip"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="small">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#dataMap').innerHTML = `<p><b>${esc(m.title)}</b> · ${esc(m.unit)}${m.rpi ? ` · RPI ${esc(m.rpi)}` : ''}</p>
    ${m.generic ? `<div class="alert warn">${icon('warn')}<div>למפת הרגיסטרים של ${esc(BRANDS[d.brand].he)} יש לעיין בטבלת ה-Modbus במדריך התקשורת של הסדרה.</div></div>` : ''}
    <div class="grid g2">${tbl(m.out, 'מהבקר לממיר (כתיבה)')}${tbl(m.inp, 'מהממיר לבקר (קריאה)')}</div>
    <h4 style="margin-top:12px">ערכי מילת הפיקוד</h4>
    <div class="table-wrap"><table><tbody>
      <tr><td>מוכן / עצירה</td><td class="ip">${esc(m.words.ready)}</td></tr>
      <tr><td>הפעלה</td><td class="ip"><b>${esc(m.words.run)}</b></td></tr>
      <tr><td>איפוס תקלה</td><td class="ip">${esc(m.words.reset)}</td></tr>
      <tr><td>קנה מידה לייחוס</td><td class="ip">${esc(m.scale)}</td></tr>
    </tbody></table></div>
    ${m.bits.length ? `<h4 style="margin-top:12px">ביטים במילת המצב</h4><div class="legend">${m.bits.map((b) => `<span class="chip"><span class="ltr">${esc(b[0])}</span> ${esc(b[1])}</span>`).join('')}</div>` : ''}`;
}
$('#dmSel').addEventListener('change', drawDataMap);
$('#csvComm').addEventListener('click', () => {
  const P = state.plant;
  download(`driveplan-${slug(active().name)}-addresses.csv`, csv([['Tag', 'Brand', 'Family', 'Protocol', 'IP', 'Mask', 'Gateway', 'PROFINET name', 'Slave/Node/MAC', 'Segment', 'BACnet instance', 'Comm module'],
    ...P.drives.map((d) => { const a = d.addr; return [d.tag, BRANDS[d.brand].he, d.family, PROTOCOLS[P.cfg.protocol].he, a.ip || '', a.mask || '', a.gw || '', a.name || '', a.slave ?? a.node ?? a.mac ?? a.position ?? '', a.segment || '', a.instance || '', d.commOpt]; })]), 'text/csv;charset=utf-8');
});
$('#dlTopo').addEventListener('click', () => download(`driveplan-${slug(active().name)}-network.svg`, resolveSvgVars(topologySvg(state.plant)), 'image/svg+xml'));

// ------------------------------------------------------------- PLC
function renderPlc() {
  const P = state.plant;
  state.code = generatePlc(P);
  $('#plcTips').innerHTML = `${icon('info')}<div><b>${esc(PLCS[P.cfg.plc].he)}:</b> ${esc(PLCS[P.cfg.plc].tips)}</div>`;
  $('#codeView').innerHTML = esc(state.code)
    .replace(/(\(\*[\s\S]*?\*\))/g, '<span class="c">$1</span>')
    .replace(/\b(FUNCTION_BLOCK|END_FUNCTION_BLOCK|PROGRAM|END_PROGRAM|VAR_INPUT|VAR_OUTPUT|VAR|END_VAR|IF|THEN|ELSIF|ELSE|END_IF|AND|OR|NOT)\b/g, '<span class="k">$1</span>');
  const rows = tagList(P);
  $('#tagTable').innerHTML = `<thead><tr>${rows[0].map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 || i === 4 || i === 6 ? 'ip' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
$('#copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.code || generatePlc(state.plant)); toast('הקוד הועתק'); } catch { toast('ההעתקה נחסמה'); } });
$('#dlCode').addEventListener('click', () => download(`driveplan-${slug(active().name)}.st`, state.code || generatePlc(state.plant)));
$('#csvTags').addEventListener('click', () => download(`driveplan-${slug(active().name)}-tags.csv`, csv(tagList(state.plant)), 'text/csv;charset=utf-8'));

// ------------------------------------------------------------- control panel (simulation)
const sim = {
  drives: new Map(), timer: null, hist: new Map(), log: [],
  reset() { this.drives.clear(); this.hist.clear(); },
  sync() {
    if (!state.plant) return;
    const keep = new Map();
    for (const d of state.plant.drives) {
      const old = this.drives.get(d.tag);
      keep.set(d.tag, old ? { ...old, d } : { d, run: false, sp: 80, hz: 0, amps: 0, kw: 0, temp: 28, fault: null, kwh: 0 });
      if (!this.hist.has(d.tag)) this.hist.set(d.tag, { hz: new Float32Array(150), a: new Float32Array(150) });
    }
    this.drives = keep;
  },
  start() { if (!this.timer) this.timer = setInterval(() => this.step(0.2), 200); },
  event(text) {
    this.log.unshift(`${new Date().toLocaleTimeString('he-IL')} · ${text}`);
    if (this.log.length > 80) this.log.length = 80;
    if (state.tab === 'control') $('#eventLog').innerHTML = this.log.map((l) => `<li>${esc(l)}</li>`).join('');
  },
  step(dt) {
    for (const s of this.drives.values()) {
      const { d } = s;
      const app = d.appMeta;
      const target = s.run && !s.fault ? Math.max(app.fmin, (s.sp / 100) * app.fmax) : 0;
      const rate = app.fmax / (s.hz < target ? app.accel : app.decel);
      if (s.fault) s.hz = Math.max(0, s.hz - app.fmax * dt / 1.5); // coast
      else if (s.hz < target) s.hz = Math.min(target, s.hz + rate * dt);
      else s.hz = Math.max(target, s.hz - rate * dt);
      const r = s.hz / d.hz;
      const load = app.torque === 'VT' ? r ** 2 : 0.8;
      s.kw = s.hz > 0.1 ? d.kw * 0.85 * load * r + (Math.random() - 0.5) * d.kw * 0.01 : 0;
      s.amps = s.hz > 0.1 ? d.In * (0.32 + 0.6 * load) * (1 + (Math.random() - 0.5) * 0.02) : 0;
      s.temp += ((28 + 30 * (s.amps / d.In)) - s.temp) * 0.01;
      s.kwh += (s.kw * dt) / 3600;
      if ($('#faultSim').checked && s.hz > 1 && !s.fault && Math.random() < 0.0008) {
        s.fault = ['זרם יתר (OC)', 'אובדן תקשורת', 'מתח יתר ב-DC', 'עומס יתר במנוע'][Math.floor(Math.random() * 4)];
        this.event(`${d.tag}: תקלה, ${s.fault}`);
      }
      const h = this.hist.get(d.tag);
      h.hz.copyWithin(0, 1); h.a.copyWithin(0, 1);
      h.hz[149] = s.hz; h.a[149] = (s.amps / d.In) * 100;
    }
    if (state.tab === 'control') drawControl(false);
  },
};

function frameText(s) {
  const d = s.d;
  const m = d.datamap;
  const running = s.run && !s.fault;
  const cw = running ? m.words.run : m.words.ready;
  let ref;
  if (m.scale === 16384) ref = `0x${Math.round((s.sp / 100) * 16384).toString(16).toUpperCase().padStart(4, '0')}`;
  else if (m.scale === 'rpm') ref = `${Math.round((s.sp / 100) * d.rpm)} rpm`;
  else if (/0\.01 Hz/.test(m.scale)) ref = `${Math.round((s.sp / 100) * d.appMeta.fmax * 100)}`;
  else if (/0\.1 Hz/.test(m.scale)) ref = `${Math.round((s.sp / 100) * d.appMeta.fmax * 10)}`;
  else if (/20000/.test(m.scale)) ref = `${Math.round(s.sp * 200)}`;
  else if (/8192/.test(m.scale)) ref = `${Math.round((s.sp / 100) * 8192)}`;
  else ref = `${s.sp}%`;
  const out = m.out[0]?.[0];
  return `${out}: ${cw} · ${m.out[1]?.[0] || 'REF'}: ${ref}`;
}

function renderControl() {
  sim.sync();
  sim.start();
  fillSelect($('#trendSel'), state.plant.drives.map((d) => [d.tag, `${d.tag} · ${d.name}`]), $('#trendSel').value || state.plant.drives[0].tag);
  drawControl(true);
  $('#eventLog').innerHTML = sim.log.map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="muted">אין אירועים.</li>';
}
function drawControl(full) {
  const grid = $('#vfdGrid');
  if (full || grid.children.length !== sim.drives.size) {
    grid.innerHTML = [...sim.drives.values()].map((s) => `
      <article class="vfd" data-tag="${esc(s.d.tag)}" aria-label="${esc(s.d.tag)}">
        <header><b class="ip">${esc(s.d.tag)}</b><span class="vfd-state" aria-live="polite"></span></header>
        <div class="small muted">${esc(s.d.name)} · ${s.d.kw} kW · ${esc(BRANDS[s.d.brand].he)}</div>
        <div class="vfd-hz"><span class="v"></span><small>Hz</small></div>
        <div class="bar vfd-bar"><span></span></div>
        <div class="vfd-vals small"></div>
        <label class="small" for="sp-${esc(s.d.tag)}">מהירות רצויה: <b class="sp-val"></b></label>
        <input id="sp-${esc(s.d.tag)}" type="range" min="0" max="100" value="${s.sp}" data-sp="${esc(s.d.tag)}">
        <div class="vfd-btns"><button class="btn sm primary" data-cmd="start">הפעלה</button><button class="btn sm" data-cmd="stop">עצירה</button><button class="btn sm ghost" data-cmd="reset">איפוס</button></div>
        <code class="vfd-frame small"></code>
      </article>`).join('');
  }
  let total = 0;
  for (const el of $$('.vfd', grid)) {
    const s = sim.drives.get(el.dataset.tag);
    if (!s) continue;
    total += s.kw;
    const st = s.fault ? ['bad', `תקלה: ${s.fault}`] : s.hz > 0.1 ? (s.run ? (Math.abs(s.hz - Math.max(s.d.appMeta.fmin, (s.sp / 100) * s.d.appMeta.fmax)) < 0.2 ? ['ok', 'פועל'] : ['warn', 'מאיץ / מאט']) : ['warn', 'מאט']) : ['idle', 'עצור'];
    el.dataset.st = st[0];
    el.querySelector('.vfd-state').textContent = st[1];
    el.querySelector('.v').textContent = s.hz.toFixed(1);
    el.querySelector('.vfd-bar span').style.width = `${(s.hz / s.d.appMeta.fmax) * 100}%`;
    el.querySelector('.vfd-vals').innerHTML = `<span>${s.amps.toFixed(1)} A</span><span>${Math.max(0, s.kw).toFixed(1)} kW</span><span>${s.temp.toFixed(0)}°C</span><span>${s.kwh.toFixed(2)} kWh</span>`;
    el.querySelector('.sp-val').textContent = `${s.sp}%`;
    el.querySelector('.vfd-frame').textContent = frameText(s);
  }
  $('#plantPower').textContent = `הספק כולל: ${total.toFixed(1)} kW`;
  drawTrend();
}
function drawTrend() {
  const tag = $('#trendSel').value;
  const h = sim.hist.get(tag);
  const s = sim.drives.get(tag);
  const cv = $('#trend');
  if (!h || !cv) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth;
  const hh = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hh);
  ctx.direction = 'ltr';
  const pl = 50; const pt = 36; const pw = w - pl - 12; const ph = hh - pt - 22;
  ctx.strokeStyle = 'rgba(80,255,200,.12)';
  for (let i = 0; i <= 4; i++) { const y = pt + (ph * i) / 4; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(170,255,225,.75)'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) ctx.fillText(String(Math.round(s.d.appMeta.fmax * (1 - i / 4))), pl - 6, pt + (ph * i) / 4 + 4);
  const tr = (arr, max, col) => {
    ctx.beginPath();
    arr.forEach((v, i) => { const x = pl + (pw * i) / (arr.length - 1); const y = pt + ph - (Math.min(v, max) / max) * ph; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  };
  tr(h.hz, s.d.appMeta.fmax, '#3cf2b4');
  tr(h.a, 120, '#ffc861');
  $('#trendTitle').textContent = `${s.d.tag} · ${s.d.name}`;
  $('#trendVal').textContent = `${s.hz.toFixed(1)} Hz · ${s.amps.toFixed(1)} A · 30 שנ׳`;
}
$('#vfdGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cmd]');
  if (!b) return;
  const s = sim.drives.get(b.closest('.vfd').dataset.tag);
  const cmd = b.dataset.cmd;
  if (cmd === 'start') { if (s.fault) { toast('יש לאפס את התקלה תחילה'); return; } s.run = true; sim.event(`${s.d.tag}: הפעלה · ${frameText({ ...s, run: true })}`); }
  if (cmd === 'stop') { s.run = false; sim.event(`${s.d.tag}: עצירה`); }
  if (cmd === 'reset' && s.fault) { s.fault = null; sim.event(`${s.d.tag}: איפוס תקלה · ${s.d.datamap.words.reset}`); }
  drawControl(false);
});
$('#vfdGrid').addEventListener('input', (e) => {
  const r = e.target.closest('[data-sp]');
  if (r) { sim.drives.get(r.dataset.sp).sp = +r.value; drawControl(false); }
});
$('#allStart').addEventListener('click', () => { for (const s of sim.drives.values()) if (!s.fault) s.run = true; sim.event('הפעלת כל הממירים'); });
$('#allStop').addEventListener('click', () => { for (const s of sim.drives.values()) s.run = false; sim.event('עצירת כל הממירים'); });
$('#allReset').addEventListener('click', () => { for (const s of sim.drives.values()) s.fault = null; sim.event('איפוס כל התקלות'); });
$('#trendSel').addEventListener('change', drawTrend);

// ------------------------------------------------------------- energy
function renderEnergy() {
  const P = state.plant;
  const s = P.stats;
  $('#enKpis').innerHTML = [kpi('חיסכון שנתי', `${n(s.saveKwh)} kWh`), kpi('חיסכון כספי', `₪${n(s.saveMoney)}`, `₪${P.cfg.kwhPrice} ל-kWh · ${n(P.cfg.hours)} שעות`), kpi('הפחתת פליטות', `${n(s.saveCo2, 1)} טון CO₂`, 'מקדם 0.47 ק״ג ל-kWh')].join('');
  hbars($('#enChart'), P.energy.map((e) => ({ label: e.tag, value: e.saveKwh, color: 'var(--s-ap)', tip: `${e.tag}: ${n(e.saveKwh)} kWh, ‏${e.pct}%` })), { unit: ' kWh' });
  $('#enTable').innerHTML = P.energy.length
    ? `<thead><tr><th scope="col">תג</th><th scope="col">תיאור</th><th scope="col" class="num">kW</th><th scope="col" class="num">ויסות מכני (kWh)</th><th scope="col" class="num">עם ממיר (kWh)</th><th scope="col" class="num">חיסכון</th><th scope="col" class="num">₪ בשנה</th></tr></thead><tbody>${P.energy.map((e) => `<tr><td class="ip">${esc(e.tag)}</td><td>${esc(e.name)}</td><td class="num">${e.kw}</td><td class="num">${n(e.throttle)}</td><td class="num">${n(e.vfd)}</td><td class="num"><b>${e.pct}%</b></td><td class="num">${n(e.saveMoney)}</td></tr>`).join('')}</tbody>`
    : '<caption>אין במתקן משאבות, מפוחים או מדחסים. בעומס קבוע הממיר חוסך בעיקר בזכות התנעה רכה.</caption>';
}

// ------------------------------------------------------------- accessibility
const prefs = store.get('driveplan.prefs', {});
function applyPrefs() {
  const r = document.documentElement;
  for (const k of ['theme', 'contrast', 'motion']) { if (prefs[k]) r.dataset[k] = prefs[k]; else delete r.dataset[k]; }
  r.style.setProperty('--fs', `${prefs.fs || 16}px`);
  $('#contrastBtn').setAttribute('aria-pressed', String(!!prefs.contrast));
  $('#motionBtn').setAttribute('aria-pressed', String(!!prefs.motion));
  store.set('driveplan.prefs', prefs);
}
$('#a11yBtn').addEventListener('click', (e) => { const m = $('#a11yMenu'); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) m.querySelector('button').focus(); });
document.addEventListener('click', (e) => { if (!e.target.closest('#a11yMenu, #a11yBtn')) { $('#a11yMenu').hidden = true; $('#a11yBtn').setAttribute('aria-expanded', 'false'); } });
$('#a11yMenu').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#a11yMenu').hidden = true; $('#a11yBtn').focus(); } });
$('#a11yMenu').addEventListener('click', (e) => {
  const f = e.target.closest('[data-fs]');
  if (f) { const d = +f.dataset.fs; prefs.fs = d === 0 ? 16 : Math.max(13, Math.min(24, (prefs.fs || 16) + d * 2)); }
  const t = e.target.closest('[data-theme-set]');
  if (t) prefs.theme = t.dataset.themeSet || undefined;
  if (e.target.closest('#contrastBtn')) prefs.contrast = prefs.contrast ? undefined : 'high';
  if (e.target.closest('#motionBtn')) prefs.motion = prefs.motion ? undefined : 'reduce';
  applyPrefs();
});

// ------------------------------------------------------------- print
$('#printBtn').addEventListener('click', () => $('#printDlg').showModal());
$('#printDlg').addEventListener('close', () => {
  if ($('#printDlg').returnValue !== 'print') return;
  buildPrint($$('#printOpts input:checked').map((x) => x.value));
  setTimeout(() => window.print(), 60);
});
function buildPrint(parts) {
  const P = state.plant;
  const c = P.cfg;
  const out = [];
  const sec = (t, b) => out.push(`<section class="pr-section"><h2>${esc(t)}</h2>${b}</section>`);
  out.push(`<div class="pr-cover"><div class="eyebrow">דרייב־פלאן · תיק מתקן</div><h1>${esc(active().name)}</h1><p>${esc(STATUSES[active().status])} · ${new Date().toLocaleDateString('he-IL')} · ${P.drives.length} ממירים · ${n(P.stats.totalKw, 1)} kW · ${esc(PROTOCOLS[c.protocol].he)} · ${esc(PLCS[c.plc].he)}</p></div>`);
  if (parts.includes('summary')) sec('סיכום ורשימת ציוד', `${P.warnings.length ? `<ul>${P.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}<table><thead><tr><th>פריט</th><th>כמות</th><th>הערה</th></tr></thead><tbody>${P.bom.map((b) => `<tr><td>${esc(b.item)}</td><td>${n(b.qty)}</td><td>${esc(b.note)}</td></tr>`).join('')}</tbody></table>`);
  if (parts.includes('drives')) sec('ממירים, הגנות וכבלים', `<table><thead><tr><th>תג</th><th>מנוע</th><th>ממיר</th><th>תקשורת</th><th>נתיך</th><th>כבל הזנה</th><th>כבל מנוע</th><th>אביזרים</th></tr></thead><tbody>${P.drives.map((d) => `<tr><td>${esc(d.tag)}</td><td>${d.kw} kW · ${d.In} A</td><td>${esc(BRANDS[d.brand].he)} ${esc(d.family)} ${d.driveKw} kW ${d.duty}</td><td>${esc(d.commOpt)}</td><td>${d.fuse} A</td><td>${esc(d.inCable.text)}</td><td>${esc(d.motorCable.text)}</td><td>${d.accessories.map((a) => esc(a.he)).join('<br>')}</td></tr>`).join('')}</tbody></table>`);
  if (parts.includes('sld')) sec('תרשים חד־קווי', `<div class="diagram">${resolveSvgVars(singleLineSvg(P))}</div>`);
  if (parts.includes('params')) for (const d of P.drives) sec(`פרמטרים · ${d.tag} · ${BRANDS[d.brand].he} ${d.family}`, `<table><thead><tr><th>פונקציה</th><th>פרמטר</th><th>ערך</th><th>✓</th></tr></thead><tbody>${d.params.map((r) => `<tr><td>${esc(r.he)}</td><td class="ip">${esc(r.id)}</td><td><bdi dir="auto">${esc(r.value)}</bdi></td><td>☐</td></tr>`).join('')}</tbody></table>`);
  if (parts.includes('comm')) sec('תקשורת וכתובות', `<p>${esc(P.network.load?.text || '')}</p><table><thead><tr><th>תג</th><th>כתובת</th><th>מפת נתונים</th></tr></thead><tbody>${P.drives.map((d) => `<tr><td>${esc(d.tag)}</td><td class="ip">${esc(addrText(d.addr))}</td><td>${esc(d.datamap.title)}: ${d.datamap.out.map((o) => esc(o[0])).join(', ')} ← / → ${d.datamap.inp.map((o) => esc(o[0])).join(', ')}</td></tr>`).join('')}</tbody></table><div class="diagram">${resolveSvgVars(topologySvg(P))}</div>`);
  if (parts.includes('energy')) sec('חיסכון באנרגיה', `<p>חיסכון שנתי: ${n(P.stats.saveKwh)} kWh, כ-₪${n(P.stats.saveMoney)}.</p><table><thead><tr><th>תג</th><th>מכני</th><th>ממיר</th><th>חיסכון</th></tr></thead><tbody>${P.energy.map((e) => `<tr><td>${esc(e.tag)}</td><td>${n(e.throttle)}</td><td>${n(e.vfd)}</td><td>${e.pct}%</td></tr>`).join('')}</tbody></table>`);
  if (parts.includes('plc')) sec('קוד בקר', `<pre class="codebox">${esc(generatePlc(P))}</pre>`);
  $('#printRoot').innerHTML = out.join('');
}

// ------------------------------------------------------------- boot
applyPrefs();
renderProjects();
recompute({ save: false });
renderForm();
sim.sync();
activate(location.hash.slice(1) || 'overview');
window.scrollTo(0, 0);
