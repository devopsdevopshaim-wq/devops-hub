import { buildPlan, defaultConfig, applyProfile, PROFILES, WIFI_GENS, SERVICES, lookup } from './planner.js';
import { allConfigs } from './configgen.js';
import { riserSvg, logicSvg, rackSvg, resolveSvgVars, TYPE_META } from './diagram.js';
import { Monitor, drawScope, fmtRate, fmtBytes, stats as seriesStats } from './monitor.js';
import { hbars } from './charts.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v) => Number(v).toLocaleString('he-IL');
const ip = (s) => `<span class="ip">${esc(s)}</span>`;

const STORE = 'netplan.cfg';
const PREFS = 'netplan.prefs';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const state = {
  cfg: migrate(store.get(STORE, null)) || defaultConfig(),
  plan: null,
  files: null,
  tab: 'overview',
  rendered: new Set(),
  monitor: null,
  monTarget: { kind: 'wan', id: 'WAN', title: 'הקו הראשי (WAN)' },
};

function migrate(c) {
  if (!c || c.version !== 1) return null;
  const d = defaultConfig();
  return { ...d, ...c, site: { ...d.site, ...c.site }, perRoom: { ...d.perRoom, ...c.perRoom }, addressing: { ...d.addressing, ...c.addressing } };
}

// ---------------------------------------------------------------- utilities
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
function announce(msg) { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }

function download(name, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv(rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k) => { cur[k] = cur[k] ?? {}; cur = cur[k]; });
  cur[ks.at(-1)] = v;
}
const slug = (s) => String(s).replace(/[^\w֐-׿-]+/g, '-');

// ---------------------------------------------------------------- planning
function recompute({ save = true } = {}) {
  const errBox = $('#formErrors');
  try {
    const plan = buildPlan(state.cfg);
    state.plan = plan;
    state.files = null;
    errBox.innerHTML = '';
    $('#globalAlert').innerHTML = '';
    $$('#planForm [aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    if (save) {
      const ok = store.set(STORE, state.cfg);
      $('#saveState').textContent = ok ? 'נשמר בדפדפן ✓' : 'לא ניתן לשמור בדפדפן (מצב פרטי?)';
    }
    if (state.monitor) state.monitor.setPlan(plan);
    state.rendered.clear();
    state.rendered.add('plan'); // the form is the source of truth; re-rendering it would steal focus while typing
    renderTab(state.tab);
  } catch (e) {
    const list = e.list || [e.message];
    errBox.innerHTML = `<div class="alert bad">${icon('bad')}<div><b>לא ניתן לבנות תכנית:</b><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
    if (state.tab !== 'plan') $('#globalAlert').innerHTML = `<div class="alert bad">${icon('bad')}<div>יש שגיאה בהגדרות. <a href="#plan" data-goto="plan">לתיקון במסך הגדרת המבנה</a></div></div>`;
  }
}

function icon(kind) {
  const p = {
    bad: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    warn: '<path d="M12 3l10 18H2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    ok: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  }[kind];
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}

// ---------------------------------------------------------------- tabs
const TABS = $$('.tab').map((t) => t.dataset.tab);
function activate(tab, { focus = false, push = true } = {}) {
  if (!TABS.includes(tab)) tab = 'overview';
  state.tab = tab;
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  $$('.panel').forEach((p) => { p.hidden = p.id !== tab; });
  if (push && location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  renderTab(tab);
  if (focus) $(`#${tab}`).focus({ preventScroll: false });
  if (tab === 'monitor' || tab === 'stats') ensureMonitor();
}

function renderTab(tab) {
  if (!state.plan || state.rendered.has(tab)) return;
  state.rendered.add(tab);
  ({
    overview: renderOverview, plan: renderForm, topology: renderTopology, racks: renderRacks,
    addresses: renderSubnets, rooms: renderRooms, configs: renderConfigs, monitor: renderMonitor,
    stats: renderStats, guide: () => {},
  })[tab]?.();
}

$('.tabbar').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) activate(t.dataset.tab); });
$('.tabbar').addEventListener('keydown', (e) => {
  const i = TABS.indexOf(state.tab);
  let j = null;
  if (e.key === 'ArrowLeft') j = (i + 1) % TABS.length; // RTL: left = next
  if (e.key === 'ArrowRight') j = (i - 1 + TABS.length) % TABS.length;
  if (e.key === 'Home') j = 0;
  if (e.key === 'End') j = TABS.length - 1;
  if (j != null) { e.preventDefault(); activate(TABS[j]); $(`#tab-${TABS[j]}`).focus(); }
});
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) { e.preventDefault(); activate(g.dataset.goto, { focus: true }); window.scrollTo({ top: 0 }); }
});
window.addEventListener('hashchange', () => activate(location.hash.slice(1), { push: false }));

// ---------------------------------------------------------------- overview
function renderOverview() {
  const p = state.plan;
  const s = p.stats;
  $('#heroTitle').innerHTML = `תכנית התקשורת של <span class="gold">${esc(p.cfg.site.name)}</span>`;
  $('#heroText').textContent = `${s.buildings > 1 ? `${s.buildings} מבנים, ` : ''}${s.floors} קומות ו-${n(s.rooms)} חדרים (${PROFILES[p.cfg.profile]?.label || 'מותאם'}). ${p.recommendation.summary}`;
  const kpi = (label, value, sub = '') => `<div class="kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;
  const ep = s.endpoints;
  const totalEp = Object.values(ep).reduce((a, b) => a + b, 0);
  $('#kpis').innerHTML = [
    kpi('חדרים', n(s.rooms), `${s.floors} קומות`),
    kpi('נקודות קצה', n(totalEp), `${n(s.outlets)} כבלים לארונות`),
    kpi('ארונות תקשורת', n(s.idfs), `+ ארון ראשי MDF`),
    kpi('מתגי גישה', n(s.switches), `${n(s.accessPorts)} פורטים`),
    kpi('רשתות / VLAN', `${n(s.subnets)} / ${n(s.vlans)}`, `${p.mode === 'room' ? 'רשת לכל חדר' : 'רשת לכל קומה'}`),
    kpi('כתובות IP שמורות', n(s.addresses.reserved), `מתוך ${n(s.addresses.total)} ב-${s.addresses.base}`),
    kpi('הספק PoE', `${(s.poeW / 1000).toFixed(1)} kW`, `שמור ${(s.poeReserveW / 1000).toFixed(1)} kW`),
    kpi('אינטרנט בשעת שיא', fmtRate(s.internetMbps), `חבילה ${fmtRate(s.wanMbps)}`),
  ].join('');
  const w = [];
  for (const x of p.warnings) w.push(`<div class="alert warn">${icon('warn')}<div>${esc(x)}</div></div>`);
  for (const x of p.notes) w.push(`<div class="alert info">${icon('info')}<div>${esc(x)}</div></div>`);
  if (!p.warnings.length) w.push(`<div class="alert ok">${icon('ok')}<div>התכנית תקינה: אין חריגות בפורטים, ב-PoE, בכתובות או בעומס הקישורים.</div></div>`);
  $('#warnings').innerHTML = w.join('');
  const r = p.recommendation;
  $('#recommend').innerHTML = `
    <div class="alert bad">${icon('bad')}<div><b>Hub:</b> ${esc(r.hub)}</div></div>
    <p><b>מתג גישה בכל ארון:</b> ${esc(r.access)}</p>
    <p><b>ליבה:</b> ${esc(r.core)}</p>
    <p><b>נתב / חומת אש:</b> ${esc(r.router)}</p>
    ${r.wifi ? `<p><b>Wi-Fi:</b> ${esc(r.wifi)}</p>` : ''}`;
  $('#bomTable').innerHTML = `<caption class="sr-only">רשימת ציוד</caption><thead><tr><th scope="col">פריט</th><th scope="col" class="num">כמות</th><th scope="col">הערה</th></tr></thead><tbody>${p.bom.map((b) => `<tr><td>${esc(b.item)}</td><td class="num"><b>${n(b.qty)}</b></td><td class="small muted">${esc(b.note)}</td></tr>`).join('')}</tbody>`;
  $('#servicesTable').innerHTML = servicesTableHtml(p);
}

function servicesTableHtml(p) {
  const s = p.services;
  const rows = [
    ['Gateway לשרתים', p.site.servers.gateway, `VLAN ${p.site.servers.vlan} · ${p.site.servers.cidr}`],
    ['DNS ראשי + DHCP ראשי', s.dns1, 'Active Directory / BIND + Kea'],
    ['DNS משני + DHCP משני', s.dns2, 'זוג ב-High Availability'],
    ['NTP', s.ntp, 'סנכרון שעון לכל הציוד'],
    ['ניטור NMS + Syslog', s.nms, 'SNMPv3, איסוף לוגים, NetFlow'],
    ['RADIUS / NAC', s.radius, '802.1X ל-Wi-Fi ולמתגים'],
    ['מקליט מצלמות NVR', s.nvr, 'יעד יחיד למצלמות'],
    ['בקר Wi-Fi', s.wlc, 'אם לא משתמשים בענן'],
    ['מרכזיית IP / SBC', s.pbx, 'טלפוניה'],
    ['חומת אש (פנים)', p.site.transit.fw, `VLAN ${p.site.transit.vlan} · ${p.site.transit.cidr}`],
    ['ליבה מול חומת האש', p.site.transit.core, 'Default route ← חומת אש'],
  ];
  return `<caption class="sr-only">שירותי ליבה</caption><thead><tr><th scope="col">שירות</th><th scope="col">כתובת</th><th scope="col">הערה</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="ip">${esc(r[1])}</td><td class="small muted">${esc(r[2])}</td></tr>`).join('')}</tbody>`;
}

// ---------------------------------------------------------------- form
const PRESETS = [
  { title: 'ארון אחד · 40 חדרים', sub: 'קומה אחת, ארון תקשורת יחיד', make: () => ({ ...applyProfile(defaultConfig(), 'office'), site: { name: 'משרדי החברה', code: 'HQ', domain: 'corp.local' }, buildings: [{ name: 'בניין A', code: 'A', floors: 1, firstFloor: 1, roomsPerFloor: 40 }] }) },
  { title: 'בניין 8 קומות × 35 חדרים', sub: 'משרדים, ארון בכל קומה', make: () => ({ ...applyProfile(defaultConfig(), 'office'), site: { name: 'מגדל הייטק', code: 'HQ', domain: 'corp.local' }, buildings: [{ name: 'מגדל', code: 'A', floors: 8, firstFloor: 1, roomsPerFloor: 35 }] }) },
  { title: 'מלון 10 קומות × 30 חדרים', sub: 'רשת מבודדת לכל חדר', make: () => ({ ...applyProfile(defaultConfig(), 'hotel'), site: { name: 'מלון החוף', code: 'HTL', domain: 'hotel.local' }, buildings: [{ name: 'מלון', code: 'H', floors: 10, firstFloor: 1, roomsPerFloor: 30 }] }) },
  { title: 'קמפוס · 3 מבנים', sub: 'ליבה, הפצה לכל מבנה ו-OSPF', make: () => ({ ...applyProfile(defaultConfig(), 'office'), site: { name: 'קמפוס הייטק', code: 'CMP', domain: 'campus.local' }, uplinkGbps: 25, buildings: [{ name: 'בניין A', code: 'A', floors: 6, firstFloor: 0, roomsPerFloor: 35 }, { name: 'בניין B', code: 'B', floors: 4, firstFloor: 0, roomsPerFloor: 50 }, { name: 'בניין C', code: 'C', floors: 3, firstFloor: -1, roomsPerFloor: 20 }] }) },
  { title: 'בית ספר · 3 קומות', sub: 'כיתות עם Wi-Fi צפוף', make: () => ({ ...applyProfile(defaultConfig(), 'school'), site: { name: 'בית ספר', code: 'SCH', domain: 'school.local' }, buildings: [{ name: 'אגף ראשי', code: 'A', floors: 3, firstFloor: 0, roomsPerFloor: 24 }] }) },
];

function renderForm() {
  const c = state.cfg;
  $('#presets').innerHTML = PRESETS.map((p, i) => `<button type="button" class="preset" data-preset="${i}"><b>${esc(p.title)}</b><span>${esc(p.sub)}</span></button>`).join('');
  $('#f-profile').innerHTML = Object.entries(PROFILES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('#f-wifigen').innerHTML = Object.entries(WIFI_GENS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $$('#planForm [data-path]').forEach((el) => {
    const v = getPath(c, el.dataset.path);
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
  });
  $('#f-rprefix').closest('.field').hidden = c.addressing.mode !== 'room';
  $('#f-v6p').closest('.field').hidden = !c.addressing.ipv6;
  renderBuildings();
}

function renderBuildings() {
  $('#bldgRows').innerHTML = state.cfg.buildings.map((b, i) => `
    <tr>
      <td><label class="sr-only" for="b${i}n">שם מבנה ${i + 1}</label><input id="b${i}n" type="text" value="${esc(b.name)}" data-b="${i}" data-k="name"></td>
      <td><label class="sr-only" for="b${i}c">קוד מבנה ${i + 1}</label><input id="b${i}c" type="text" dir="ltr" maxlength="3" value="${esc(b.code)}" data-b="${i}" data-k="code" style="width:70px"></td>
      <td><label class="sr-only" for="b${i}f">קומות במבנה ${i + 1}</label><input id="b${i}f" type="number" min="1" max="89" value="${b.floors}" data-b="${i}" data-k="floors" data-num></td>
      <td><label class="sr-only" for="b${i}s">קומה ראשונה במבנה ${i + 1}</label><input id="b${i}s" type="number" min="-9" max="89" value="${b.firstFloor}" data-b="${i}" data-k="firstFloor" data-num></td>
      <td><label class="sr-only" for="b${i}r">חדרים בקומה במבנה ${i + 1}</label><input id="b${i}r" type="number" min="1" max="999" value="${b.roomsPerFloor}" data-b="${i}" data-k="roomsPerFloor" data-num></td>
      <td>${state.cfg.buildings.length > 1 ? `<button type="button" class="btn sm ghost" data-del="${i}" aria-label="מחיקת ${esc(b.name)}">מחיקה</button>` : ''}</td>
    </tr>`).join('');
}

let debounce;
function scheduleRecompute() { clearTimeout(debounce); debounce = setTimeout(() => recompute(), 250); }

$('#planForm').addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.b != null) {
    const b = state.cfg.buildings[+el.dataset.b];
    b[el.dataset.k] = el.dataset.num != null ? Number(el.value) : (el.dataset.k === 'code' ? el.value.toUpperCase() : el.value);
    scheduleRecompute();
    return;
  }
  if (!el.dataset.path) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num != null) v = Number(v);
  if (el.dataset.path === 'profile') {
    state.cfg = applyProfile(state.cfg, v);
    state.rendered.delete('plan');
    renderForm();
    recompute();
    announce(`נטענו ערכי ברירת מחדל ל${PROFILES[v].label}`);
    return;
  }
  setPath(state.cfg, el.dataset.path, v);
  if (el.dataset.path === 'addressing.mode') $('#f-rprefix').closest('.field').hidden = v !== 'room';
  if (el.dataset.path === 'addressing.ipv6') $('#f-v6p').closest('.field').hidden = !v;
  scheduleRecompute();
});
$('#planForm').addEventListener('submit', (e) => e.preventDefault());
$('#addBldg').addEventListener('click', () => {
  const used = new Set(state.cfg.buildings.map((b) => b.code));
  const code = 'ABCDEFGHIJ'.split('').find((c) => !used.has(c)) || 'Z';
  state.cfg.buildings.push({ name: `בניין ${code}`, code, floors: 3, firstFloor: 1, roomsPerFloor: 20 });
  renderBuildings();
  recompute();
  $(`#b${state.cfg.buildings.length - 1}n`).focus();
});
$('#bldgRows').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]');
  if (!d) return;
  state.cfg.buildings.splice(+d.dataset.del, 1);
  renderBuildings();
  recompute();
  $('#addBldg').focus();
});
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const p = PRESETS[+b.dataset.preset];
  state.cfg = p.make();
  state.rendered.clear();
  renderForm();
  state.rendered.add('plan');
  recompute();
  toast(`נטענה התבנית: ${p.title}`);
});
$('#exportBtn').addEventListener('click', () => download(`netplan-${slug(state.cfg.site.code)}.json`, JSON.stringify(state.cfg, null, 2), 'application/json'));
$('#importLbl').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#importFile').click(); } });
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const c = migrate(JSON.parse(await f.text()));
    if (!c) throw new Error('הקובץ אינו פרויקט נט־פלאן');
    state.cfg = c;
    state.rendered.clear();
    renderForm();
    recompute();
    toast('הפרויקט נטען');
  } catch (err) { toast(`שגיאה בטעינה: ${err.message}`); }
  e.target.value = '';
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('לאפס את כל ההגדרות לברירת המחדל?')) return;
  state.cfg = defaultConfig();
  state.rendered.clear();
  renderForm();
  recompute();
});

// ---------------------------------------------------------------- topology
function renderTopology() {
  const p = state.plan;
  $('#riser').innerHTML = riserSvg(p);
  $('#riserLegend').innerHTML = `<span><i class="dot" style="background:var(--cyan)"></i> סיב אופטי ${esc(p.uplink.label)} מארון קומה</span><span><i class="dot" style="background:var(--gold)"></i> ליבה / הפצה</span><span><i class="dot" style="background:var(--bad)"></i> חומת אש</span><span class="muted">לחיצה על ארון פותחת אותו במסך הארונות</span>`;
  const sel = $('#logicIdf');
  sel.innerHTML = p.idfs.map((x) => `<option value="${esc(x.id)}">${esc(x.id)} · ${x.rooms.length} חדרים</option>`).join('');
  drawLogic();
}
function drawLogic() {
  const idf = state.plan.idfs.find((x) => x.id === $('#logicIdf').value) || state.plan.idfs[0];
  $('#logic').innerHTML = logicSvg(state.plan, idf);
}
$('#logicIdf').addEventListener('change', drawLogic);
$('#riser').addEventListener('click', (e) => { const g = e.target.closest('[data-idf]'); if (g) openRack(g.dataset.idf); });
$('#riser').addEventListener('keydown', (e) => { const g = e.target.closest('[data-idf]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRack(g.dataset.idf); } });
$('#dlTopo').addEventListener('click', () => download(`netplan-${slug(state.cfg.site.code)}-riser.svg`, resolveSvgVars(riserSvg(state.plan)), 'image/svg+xml'));

function openRack(id) {
  activate('racks');
  $('#rackSel').value = id;
  drawRack();
  $('#rackTitle').focus?.();
}

// ---------------------------------------------------------------- racks
function renderRacks() {
  const p = state.plan;
  const sel = $('#rackSel');
  const prev = sel.value;
  sel.innerHTML = `<option value="MDF">MDF · ארון ראשי</option>` + p.idfs.map((x) => `<option value="${esc(x.id)}">${esc(x.id)}</option>`).join('');
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else sel.value = p.idfs[0].id;
  $('#portLegend').innerHTML = Object.entries(TYPE_META).map(([, m]) => `<span><i class="dot" style="background:${m.color}"></i>${m.he}</span>`).join('') + '<span><i class="dot" style="background:var(--s-spare)"></i>פנוי</span>';
  drawRack();
}
$('#rackSel').addEventListener('change', drawRack);

function drawRack() {
  const p = state.plan;
  const id = $('#rackSel').value;
  $('#portInfo').hidden = true;
  if (id === 'MDF') {
    $('#rackTitle').textContent = 'ארון ראשי (MDF)';
    $('#rackSvg').innerHTML = rackSvg(p.mdf, 'ארון ראשי');
    $('#rackFacts').innerHTML = `<dt>גודל</dt><dd>${p.mdf.sizeU}U · ${esc(p.mdf.kind)}</dd><dt>ליבה</dt><dd>${p.coreNames.join(' + ')}</dd><dt>חומת אש</dt><dd>${p.fwNames.join(' + ')}</dd><dt>קישורי סיב</dt><dd>${n(p.stats.fiberLinks)}</dd>`;
    const rows = Object.entries(p.coreDown).flatMap(([dev, list]) => list.map((x) => `<tr><td>${esc(dev)}</td><td class="ip">${esc(x.port)}</td><td>${esc(x.idf)}</td><td class="ip">${esc(x.host)} ${esc(x.local || '')}</td></tr>`));
    $('#switchFaces').innerHTML = '<p class="muted">בארון הראשי אין שקעי קצה. הטבלה מציגה את קישורי הסיב לארונות.</p>';
    $('#wireTable').innerHTML = `<thead><tr><th scope="col">מתג ליבה/הפצה</th><th scope="col">פורט</th><th scope="col">ארון</th><th scope="col">צד מרוחק</th></tr></thead><tbody>${rows.join('')}</tbody>`;
    return;
  }
  const idf = p.idfs.find((x) => x.id === id);
  $('#rackTitle').textContent = `${idf.id} · ${idf.host}`;
  $('#rackSvg').innerHTML = rackSvg(idf.rack, idf.id);
  $('#rackFacts').innerHTML = `
    <dt>ארון</dt><dd>${idf.rack.sizeU}U · ${esc(idf.rack.kind)}</dd>
    <dt>חדרים</dt><dd><span class="ltr">${idf.rooms[0].no}–${idf.rooms.at(-1).no}</span> (${idf.rooms.length})</dd>
    <dt>מתגים</dt><dd><span class="ltr">${idf.members} × ${p.cfg.switchPorts}</span> (<span class="ltr">${idf.portsUsed}/${idf.portsTotal}</span> בשימוש)</dd>
    <dt>לוחות ניתוב</dt><dd><span class="ltr">${idf.patchPanels} × 24</span></dd>
    <dt>PoE</dt><dd>${n(idf.poeDrawW)}W בפועל · ${n(idf.poeReserveW)}W שמור · ספק ${idf.poeBudgetPerSwitch}W למתג</dd>
    <dt>Uplink</dt><dd><span class="ltr">${idf.uplinks} × ${esc(p.uplink.label)}</span> · יחס מנוי־יתר <span class="ltr">${idf.oversub}:1</span></dd>
    <dt>עומס שיא</dt><dd>${fmtRate(idf.busyMbps)}</dd>
    <dt>כתובת ניהול</dt><dd>${ip(idf.mgmtIp)}</dd>
    <dt>UPS</dt><dd>${ip(idf.upsIp)}</dd>`;
  const faces = [];
  for (let m = 1; m <= idf.members; m++) {
    const ports = [];
    for (let k = 1; k <= p.cfg.switchPorts; k++) {
      const o = idf.outlets.find((x) => x.member === m && x.port === k);
      const color = o ? TYPE_META[o.type].color : 'var(--s-spare)';
      const label = o ? `פורט ${k}: ${o.label}, ${TYPE_META[o.type].he}, ${o.ip}` : `פורט ${k}: פנוי`;
      ports.push(`<button class="port ${o ? 'used' : ''}" style="background:${color}" data-m="${m}" data-p="${k}" aria-label="${esc(label)}" title="${esc(label)}">${k}</button>`);
    }
    const ups = idf.coreLinks.filter((l) => l.local.includes(`${m}/1/`)).map((l) => `<span class="port used" style="background:var(--gold);width:34px" title="${esc(`${l.local} → ${l.remote}`)}">${esc(l.local.split('/').pop())}</span>`).join('');
    faces.push(`<div class="switch-face"><div class="sf-head"><b>${esc(idf.host)} · מתג ${m}</b><span class="ltr">Gi${m}/0/1–${p.cfg.switchPorts}</span></div><div style="display:flex;align-items:center"><div class="ports">${ports.join('')}</div><div class="uplinks" aria-label="Uplinks">${ups}</div></div></div>`);
  }
  $('#switchFaces').innerHTML = faces.join('');
  $('#wireTable').innerHTML = `<caption class="sr-only">טבלת חיווט ${esc(idf.id)}</caption><thead><tr><th scope="col">שקע</th><th scope="col">סוג</th><th scope="col">לוח ניתוב</th><th scope="col">פורט במתג</th><th scope="col">VLAN</th><th scope="col">IP</th><th scope="col" class="num">PoE</th></tr></thead><tbody>${idf.outlets.map((o) => `<tr><td class="ip">${esc(o.label)}</td><td><span class="chip"><i class="dot" style="background:${TYPE_META[o.type].color}"></i>${TYPE_META[o.type].he}</span></td><td class="ip">${esc(o.patch)}</td><td class="ip">Gi${o.member}/0/${o.port}</td><td class="ip">${o.vlan}${o.voiceVlan ? ` +${o.voiceVlan}` : ''}</td><td class="ip">${esc(o.ip)}${o.phoneIp ? `<br>${esc(o.phoneIp)}` : ''}</td><td class="num">${o.poeW ? `${o.poeW}W` : '—'}</td></tr>`).join('')}</tbody>`;
}
$('#switchFaces').addEventListener('click', (e) => {
  const b = e.target.closest('.port[data-m]');
  if (!b) return;
  const idf = state.plan.idfs.find((x) => x.id === $('#rackSel').value);
  const o = idf.outlets.find((x) => x.member === +b.dataset.m && x.port === +b.dataset.p);
  const box = $('#portInfo');
  box.hidden = false;
  box.innerHTML = o
    ? `${icon('info')}<div><b class="ltr">Gi${o.member}/0/${o.port}</b> ← ${esc(o.label)} (${TYPE_META[o.type].he}) · לוח <span class="ltr">${esc(o.patch)}</span> · VLAN ${o.vlan}${o.voiceVlan ? ` + קול ${o.voiceVlan}` : ''} · IP ${ip(o.ip)} · מסכה ${ip(o.mask)} · Gateway ${ip(o.gateway)}${o.room ? ` · <button class="btn sm" data-room="${esc(o.room)}">כרטיס חדר</button>` : ''}</div>`
    : `${icon('info')}<div>פורט <span class="ltr">Gi${b.dataset.m}/0/${b.dataset.p}</span> פנוי. הוא כבוי ומשויך ל-VLAN 999 עד שיוקצה.</div>`;
});

// ---------------------------------------------------------------- subnets
function renderSubnets() {
  const p = state.plan;
  const types = [...new Set(p.subnets.map((s) => s.key))];
  const sel = $('#snType');
  const prev = sel.value;
  sel.innerHTML = '<option value="">הכול</option>' + types.map((k) => `<option value="${k}">${esc(SERVICES[k]?.he || k)}</option>`).join('');
  sel.value = types.includes(prev) ? prev : '';
  $('#blocksInfo').innerHTML = `גושי כתובות: ${p.blocks.map((b) => `${b.building == null ? 'ליבה' : esc(p.buildings[b.building].name)} ${ip(b.cidr)}`).join(' · ')}${p.cfg.addressing.ipv6 ? ` · IPv6 ${ip(p.cfg.addressing.ipv6Effective)}` : ''}`;
  drawSubnets();
}
function drawSubnets() {
  const p = state.plan;
  const q = $('#snFilter').value.trim().toLowerCase();
  const t = $('#snType').value;
  const rows = p.subnets.filter((s) => (!t || s.key === t) && (!q || [s.name, s.cidr, s.vlan, s.purpose, s.gateway].join(' ').toLowerCase().includes(q)));
  const shown = rows.slice(0, 600);
  $('#subnetTable').innerHTML = `<caption>${n(rows.length)} רשתות${rows.length > shown.length ? ` (מוצגות ${shown.length})` : ''}</caption><thead><tr>
    <th scope="col">VLAN</th><th scope="col">שם</th><th scope="col">ייעוד</th><th scope="col">רשת</th><th scope="col">מסכה</th><th scope="col">Gateway</th><th scope="col">טווח DHCP</th><th scope="col" class="num">כתובות</th><th scope="col">ניצול</th><th scope="col">IPv6</th></tr></thead><tbody>${shown.map((s) => {
    const used = Math.min(1, s.reserved / s.usable);
    return `<tr><td class="ip"><b>${s.vlan ?? '—'}</b></td><td class="ip">${esc(s.name)}</td><td>${esc(s.purpose)}</td><td class="ip">${esc(s.cidr)}</td><td class="ip">${esc(s.mask)}</td><td class="ip">${esc(s.gateway || '—')}</td><td class="ip small">${s.poolStart && s.dhcp ? `${esc(s.poolStart)} – ${esc(s.poolEnd.split('.').pop())}` : (s.dhcp ? 'הזמנות בלבד' : 'סטטי')}</td><td class="num">${n(s.usable)}</td><td><div class="bar" title="${Math.round(used * 100)}% שמור"><span style="width:${(used * 100).toFixed(1)}%"></span></div><span class="small muted">${n(s.reserved)} שמורות</span></td><td class="ip small">${esc(s.ipv6 || '—')}</td></tr>`;
  }).join('')}</tbody>`;
}
$('#snFilter').addEventListener('input', drawSubnets);
$('#snType').addEventListener('change', drawSubnets);
$('#csvSubnets').addEventListener('click', () => {
  const p = state.plan;
  download(`netplan-${slug(p.cfg.site.code)}-subnets.csv`, csv([
    ['VLAN', 'Name', 'Purpose', 'Network', 'Mask', 'Gateway', 'DHCP start', 'DHCP end', 'Usable', 'Reserved', 'IPv6'],
    ...p.subnets.map((s) => [s.vlan ?? '', s.name, s.purpose, s.cidr, s.mask, s.gateway ?? '', s.dhcp ? s.poolStart ?? '' : '', s.dhcp ? s.poolEnd ?? '' : '', s.usable, s.reserved, s.ipv6 ?? '']),
  ]), 'text/csv;charset=utf-8');
});

// ---------------------------------------------------------------- rooms
function renderRooms() {
  const p = state.plan;
  const bs = $('#roomB');
  const prevB = bs.value;
  bs.innerHTML = p.buildings.map((b) => `<option value="${b.index}">${esc(b.name)}</option>`).join('');
  if (prevB && p.buildings[+prevB]) bs.value = prevB;
  fillFloors($('#roomF'), +bs.value);
  drawRooms();
}
function fillFloors(sel, bi) {
  const prev = sel.value;
  const b = state.plan.buildings[bi] || state.plan.buildings[0];
  sel.innerHTML = `<option value="all">כל הקומות</option>` + b.floors.map((f) => `<option value="${f.index}">קומה ${esc(f.label)}</option>`).join('');
  sel.value = [...sel.options].some((o) => o.value === prev) ? prev : '0';
}
$('#roomB').addEventListener('change', () => { fillFloors($('#roomF'), +$('#roomB').value); drawRooms(); });
$('#roomF').addEventListener('change', drawRooms);
$('#roomQ').addEventListener('input', drawRooms);

function roomRows(rooms) {
  return rooms.map((r) => r.outlets.map((o, k) => `<tr>${k === 0 ? `<th scope="row" rowspan="${r.outlets.length}"><button class="btn sm" data-room="${esc(r.id)}" aria-label="כרטיס הגדרות לחדר ${esc(r.no)}">${esc(r.no)}</button><div class="small muted ltr">${esc(r.idf)}</div></th>` : ''}
    <td class="ip">${esc(o.label)}</td><td>${TYPE_META[o.type].he}${o.hasPhone ? ' + טלפון' : ''}</td><td class="ip">${esc(o.patch)}</td><td class="ip">${esc(o.switch)} Gi${o.member}/0/${o.port}</td><td class="ip">${o.vlan}${o.voiceVlan && o.type !== 'voice' ? `/${o.voiceVlan}` : ''}</td><td class="ip"><b>${esc(o.ip)}</b>${o.phoneIp ? `<br>${esc(o.phoneIp)}` : ''}</td><td class="ip">${esc(o.mask)}</td><td class="ip">${esc(o.gateway)}</td></tr>`).join('')).join('');
}
const ROOM_HEAD = '<thead><tr><th scope="col">חדר</th><th scope="col">שקע</th><th scope="col">סוג</th><th scope="col">לוח ניתוב</th><th scope="col">מתג ופורט</th><th scope="col">VLAN</th><th scope="col">כתובת IP</th><th scope="col">מסכה</th><th scope="col">Gateway</th></tr></thead>';

function drawRooms() {
  const p = state.plan;
  const b = p.buildings[+$('#roomB').value] || p.buildings[0];
  const f = $('#roomF').value;
  const q = $('#roomQ').value.trim();
  let rooms = f === 'all' ? b.floors.flatMap((x) => x.rooms) : (b.floors[+f] || b.floors[0]).rooms;
  if (q) rooms = b.floors.flatMap((x) => x.rooms).filter((r) => r.no.includes(q));
  const shown = rooms.slice(0, 200);
  $('#roomTable').innerHTML = `<caption>${n(rooms.length)} חדרים${rooms.length > shown.length ? ` · מוצגים ${shown.length}, צמצמו לפי קומה` : ''}</caption>${ROOM_HEAD}<tbody>${roomRows(shown)}</tbody>`;
}
$('#csvRooms').addEventListener('click', () => {
  const p = state.plan;
  const rows = [['Building', 'Floor', 'Room', 'Cabinet', 'Outlet', 'Type', 'Patch', 'Switch', 'Port', 'VLAN', 'Voice VLAN', 'IP', 'Phone IP', 'Mask', 'Gateway', 'DNS1', 'DNS2']];
  for (const r of p.rooms) {
    for (const o of r.outlets) rows.push([r.bCode, p.buildings[r.building].floors[r.floor].label, r.no, r.idf, o.label, o.type, o.patch, o.switch, `Gi${o.member}/0/${o.port}`, o.vlan, o.voiceVlan ?? '', o.ip, o.phoneIp ?? '', o.mask, o.gateway, p.services.dns1, p.services.dns2]);
  }
  for (const idf of p.idfs) for (const o of idf.outlets.filter((x) => !x.room)) rows.push([p.buildings[idf.building].code, p.buildings[idf.building].floors[idf.floor].label, '', idf.id, o.label, o.type, o.patch, o.switch, `Gi${o.member}/0/${o.port}`, o.vlan, '', o.ip, '', o.mask, o.gateway, p.services.dns1, p.services.dns2]);
  download(`netplan-${slug(p.cfg.site.code)}-rooms.csv`, csv(rows), 'text/csv;charset=utf-8');
});

// room card drawer
let drawerReturn = null;
function openRoom(id) {
  const p = state.plan;
  const r = p.rooms.find((x) => x.id === id);
  if (!r) return;
  drawerReturn = document.activeElement;
  const b = p.buildings[r.building];
  const dnsFor = (o) => (o.subnet?.key === 'guest' || o.subnet?.key === 'room' ? '1.1.1.1, 8.8.8.8' : `${p.services.dns1}, ${p.services.dns2}`);
  $('#drawerTitle').textContent = `חדר ${r.no} · ${b.name}`;
  $('#drawerBody').innerHTML = `
    <p class="muted">קומה ${esc(b.floors[r.floor].label)} · ארון <span class="ltr">${esc(r.idf)}</span>${r.subnet ? ` · רשת פרטית לחדר <span class="ip">${esc(r.subnet.cidr)}</span> (VLAN ${r.subnet.vlan})` : ''}</p>
    <div class="alert info">${icon('info')}<div>מומלץ להשאיר את המכשירים על DHCP (קבלת כתובת אוטומטית). שרת ה-DHCP מזהה את השקע בקיר (Option 82) ומחלק לכל מכשיר את הכתובת הקבועה שלו. אם מגדירים ידנית, משתמשים בערכים שבטבלה.</div></div>
    ${r.outlets.map((o) => `
      <div class="card" style="padding:14px;margin-top:10px">
        <h3 style="margin-bottom:8px"><i class="dot" style="background:${TYPE_META[o.type].color}"></i> <span class="ltr">${esc(o.label)}</span> · ${TYPE_META[o.type].he}${o.hasPhone ? ' + טלפון' : ''}</h3>
        <dl class="kv">
          <dt>כתובת IP</dt><dd>${ip(o.ip)}</dd>
          <dt>מסכה</dt><dd>${ip(o.mask)} ‏(<span class="ltr">/${o.prefix}</span>)</dd>
          <dt>Gateway</dt><dd>${ip(o.gateway)}</dd>
          <dt>DNS</dt><dd>${ip(dnsFor(o))}</dd>
          <dt>דומיין</dt><dd class="ltr">${esc(p.cfg.site.domain)}</dd>
          <dt>VLAN</dt><dd>${o.vlan} · <span class="ltr">${esc(o.vlanName)}</span>${o.voiceVlan ? ` · קול ${o.voiceVlan}` : ''}</dd>
          ${o.phoneIp ? `<dt>טלפון</dt><dd>${ip(o.phoneIp)} · Gateway ${ip(o.phoneSubnet.gateway)}</dd>` : ''}
          <dt>חיבור פיזי</dt><dd><span class="ltr">${esc(o.patch)}</span> ← <span class="ltr">${esc(o.switch)} Gi${o.member}/0/${o.port}</span></dd>
          ${o.subnet?.ipv6 ? `<dt>IPv6</dt><dd>${ip(o.subnet.ipv6)} (SLAAC/DHCPv6)</dd>` : ''}
        </dl>
      </div>`).join('')}
    ${b.guest || b.wifi ? `<div class="card" style="padding:14px;margin-top:10px"><h3>Wi-Fi באזור</h3><dl class="kv">${b.wifi ? `<dt>ארגוני</dt><dd>VLAN ${b.wifi.vlan} · ${ip(b.wifi.cidr)}</dd>` : ''}${b.guest ? `<dt>אורחים</dt><dd>VLAN ${b.guest.vlan} · ${ip(b.guest.cidr)}</dd>` : ''}</dl></div>` : ''}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-scope-room="${esc(r.id)}">צריכת נתונים בסקופ</button><button class="btn" data-print-room="${esc(r.id)}">הדפסת כרטיס החדר</button></div>`;
  $('#drawer').hidden = false;
  $('#drawerClose').focus();
}
function closeDrawer() { $('#drawer').hidden = true; drawerReturn?.focus?.(); }
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-room]');
  if (r) { openRoom(r.dataset.room); return; }
  const s = e.target.closest('[data-scope-room]');
  if (s) { const room = state.plan.rooms.find((x) => x.id === s.dataset.scopeRoom); closeDrawer(); setMonTarget({ kind: 'room', id: room.id, title: `חדר ${room.no} (${room.id})` }); activate('monitor'); return; }
  const pr = e.target.closest('[data-print-room]');
  if (pr) { printRoom(pr.dataset.printRoom); }
});
$('#drawerClose').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

// ---------------------------------------------------------------- configs
function ensureFiles() {
  if (!state.files) state.files = allConfigs(state.plan);
  return state.files;
}
function renderConfigs() {
  const files = ensureFiles();
  $('#fileList').innerHTML = files.map((f, i) => `<li><button class="btn sm ghost" data-file="${i}" aria-pressed="false"><span class="ltr">${esc(f.name)}</span> <span class="muted small">${esc(f.title)}</span></button></li>`).join('');
  showFile(0);
}
function highlight(text, isJson) {
  const e = esc(text);
  if (isJson) return e.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2');
  return e.split('\n').map((l) => {
    if (/^\s*!/.test(l)) return `<span class="c">${l}</span>`;
    return l.replace(/^(\s*)(interface|vlan|router|hostname|ip access-list|line|aaa|radius server|snmp-server|stackwise-virtual)\b/, '$1<span class="k">$2</span>')
      .replace(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g, '<span class="v">$1</span>');
  }).join('\n');
}
let currentFile = 0;
function showFile(i) {
  const f = ensureFiles()[i];
  currentFile = i;
  $$('#fileList [data-file]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.file === i)));
  $('#cfgTitle').innerHTML = `<span class="ltr">${esc(f.name)}</span>`;
  $('#cfgView').innerHTML = highlight(f.text, f.name.endsWith('.json'));
}
$('#fileList').addEventListener('click', (e) => { const b = e.target.closest('[data-file]'); if (b) showFile(+b.dataset.file); });
$('#copyCfg').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(ensureFiles()[currentFile].text); toast('הועתק ללוח'); } catch { toast('ההעתקה נחסמה בדפדפן'); }
});
$('#dlCfg').addEventListener('click', () => { const f = ensureFiles()[currentFile]; download(f.name, f.text, f.name.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8'); });
$('#dlAll').addEventListener('click', () => {
  const files = ensureFiles();
  const bundle = files.map((f) => `${'#'.repeat(78)}\n### FILE: ${f.name}\n${'#'.repeat(78)}\n${f.text}`).join('\n\n');
  download(`netplan-${slug(state.cfg.site.code)}-configs.txt`, bundle);
});

// ---------------------------------------------------------------- monitor
function ensureMonitor() {
  if (state.monitor) return;
  state.monitor = new Monitor(state.plan);
  state.monitor.onTick(onMonTick);
  state.monitor.start();
}
function renderMonitor() {
  ensureMonitor();
  const p = state.plan;
  const sel = $('#monTarget');
  sel.innerHTML = `<option value="wan:WAN">הקו הראשי · WAN (אינטרנט)</option><option value="core:CORE">כל הרשת · ליבה</option>` + p.idfs.map((x) => `<option value="idf:${esc(x.id)}">ארון ${esc(x.id)}</option>`).join('');
  sel.value = `${state.monTarget.kind}:${state.monTarget.id}`;
  if (sel.value === '') sel.value = 'wan:WAN';
  const hb = $('#heatB');
  hb.innerHTML = p.buildings.map((b) => `<option value="${b.index}">${esc(b.name)}</option>`).join('');
  fillFloors($('#heatF'), 0);
  $('#heatF').querySelector('option[value="all"]')?.remove();
  onMonTick(state.monitor);
}
function setMonTarget(t) {
  state.monTarget = t;
  const sel = $('#monTarget');
  const v = `${t.kind}:${t.id}`;
  if ([...sel.options].some((o) => o.value === v)) sel.value = v;
  if (state.monitor) onMonTick(state.monitor);
}
$('#monTarget').addEventListener('change', (e) => {
  const [kind, ...rest] = e.target.value.split(':');
  const id = rest.join(':');
  setMonTarget({ kind, id, title: e.target.selectedOptions[0].textContent });
});
$('#monIp').addEventListener('change', (e) => {
  const q = e.target.value.trim();
  if (!q) return;
  const m = state.monitor;
  if (m.byIp.has(q)) { const ep = m.eps[m.byIp.get(q)]; setMonTarget({ kind: 'ip', id: q, title: `${q} · ${ep.label}` }); return; }
  const r = state.plan.rooms.find((x) => x.no === q || x.id.toLowerCase() === q.toLowerCase());
  if (r) { setMonTarget({ kind: 'room', id: r.id, title: `חדר ${r.no} (${r.id})` }); return; }
  toast('לא נמצאה כתובת או חדר כזה');
});
$('#monSrc').addEventListener('change', (e) => {
  const v = e.target.value;
  $('#monUrlField').hidden = v !== 'json';
  $('#monCsvField').hidden = v !== 'csv';
  if (v === 'sim') state.monitor.setSource('sim');
  updateSrcBadge();
});
$('#monUrl').addEventListener('change', (e) => { if (e.target.value) state.monitor.setSource('json', { url: e.target.value }); updateSrcBadge(); });
$('#monCsv').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) { state.monitor.setSource('csv', { text: await f.text() }); updateSrcBadge(); toast(`נטענו ${state.monitor.live.size} שורות`); } });
$('#monPause').addEventListener('click', (e) => {
  const m = state.monitor;
  m.paused = !m.paused;
  e.currentTarget.setAttribute('aria-pressed', String(m.paused));
  e.currentTarget.textContent = m.paused ? 'המשך' : 'השהיה';
});
function updateSrcBadge() {
  const m = state.monitor;
  const b = $('#srcBadge');
  if (m.source === 'sim') { b.className = 'badge-sim'; b.innerHTML = '<span class="pulse" aria-hidden="true"></span> נתוני הדגמה (סימולציה)'; return; }
  b.className = 'badge-sim badge-live';
  b.innerHTML = m.error ? `⚠ ${esc(m.error)}` : `<span class="pulse" aria-hidden="true"></span> נתונים חיים · ${m.live.size} כתובות`;
}

const HEAT = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
function onMonTick(m) {
  if (state.tab === 'stats') renderLiveKpis(m);
  if (state.tab !== 'monitor') return;
  if (m.source !== 'sim') updateSrcBadge();
  const t = state.monTarget;
  const s = m.series(t);
  const reduce = document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const max = drawScope($('#scopeCanvas'), s.rx, s.tx, { reduceMotion: reduce });
  $('#hudTitle').textContent = t.title;
  $('#hudScale').textContent = `סקאלה ${fmtRate(max)} · ${s.count} מכשירים`;
  const r = seriesStats(s.rx);
  const x = seriesStats(s.tx);
  const tot = Array.from(s.rx, (v, i) => v + s.tx[i]);
  const st = seriesStats(tot);
  const ro = (l, v) => `<div class="readout"><div class="r-l">${l}</div><div class="r-v">${v}</div></div>`;
  $('#readouts').innerHTML = [
    ro('הורדה עכשיו', fmtRate(r.now)), ro('העלאה עכשיו', fmtRate(x.now)), ro('ממוצע (2 דק׳)', fmtRate(st.avg)),
    ro('שיא (2 דק׳)', fmtRate(st.peak)), ro('אחוזון 95', fmtRate(st.p95)), ro('נפח היום (משוער)', fmtBytes(s.bytes)),
  ].join('');
  $('#scopeCanvas').setAttribute('aria-label', `תעבורה ${t.title}: הורדה ${fmtRate(r.now)}, העלאה ${fmtRate(x.now)}, שיא ${fmtRate(st.peak)}`);
  if (m.ticks % 2 === 0) {
    const top = m.top(10);
    $('#topTalkers').innerHTML = `<thead><tr><th scope="col">מכשיר</th><th scope="col">IP</th><th scope="col">ארון</th><th scope="col" class="num">קצב</th></tr></thead><tbody>${top.map(({ e, v }) => `<tr><td><button class="btn sm ghost" data-mon-ip="${esc(e.ip)}"><span class="ltr">${esc(e.label)}</span></button></td><td class="ip">${esc(e.ip)}</td><td class="ip small">${esc(e.idf)}</td><td class="num">${fmtRate(v)}</td></tr>`).join('')}</tbody>`;
    const loads = m.idfLoad();
    const p = state.plan;
    $('#uplinkBars').innerHTML = p.idfs.map((idf) => {
      const cap = idf.uplinks * p.uplinkGbps * 1000;
      const v = loads.get(idf.id) || 0;
      const pct = Math.min(100, (v / cap) * 100);
      const col = pct > 70 ? 'var(--bad)' : pct > 40 ? 'var(--warn)' : 'var(--ok)';
      return `<div style="display:grid;grid-template-columns:120px 1fr 90px;gap:10px;align-items:center;margin-bottom:6px"><span class="ip small">${esc(idf.id)}</span><div class="bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(0)}" aria-label="ניצול ${esc(idf.id)}"><span style="width:${pct.toFixed(1)}%;background:${col}"></span></div><span class="small ip">${pct.toFixed(1)}% · ${fmtRate(v)}</span></div>`;
    }).join('');
    const b = p.buildings[+$('#heatB').value] || p.buildings[0];
    const fl = b.floors[+$('#heatF').value] || b.floors[0];
    const rl = m.roomLoad();
    const vals = fl.rooms.map((rm) => rl.get(rm.id) || 0);
    const hi = Math.max(1, ...vals);
    $('#heat').innerHTML = fl.rooms.map((rm, i) => {
      const k = Math.min(4, Math.floor((vals[i] / hi) * 4.999));
      const dark = k >= 2;
      return `<button data-heat-room="${esc(rm.id)}" style="background:${HEAT[k]};color:${dark ? '#fff' : '#0b1a33'}" aria-label="חדר ${esc(rm.no)}: ${fmtRate(vals[i])}">${esc(rm.no)}<small style="color:inherit">${fmtRate(vals[i])}</small></button>`;
    }).join('');
  }
}
$('#heatB').addEventListener('change', () => { fillFloors($('#heatF'), +$('#heatB').value); $('#heatF').querySelector('option[value="all"]')?.remove(); onMonTick(state.monitor); });
$('#heatF').addEventListener('change', () => onMonTick(state.monitor));
document.addEventListener('click', (e) => {
  const h = e.target.closest('[data-heat-room]');
  if (h) { const r = state.plan.rooms.find((x) => x.id === h.dataset.heatRoom); setMonTarget({ kind: 'room', id: r.id, title: `חדר ${r.no} (${r.id})` }); $('#scopeCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  const t = e.target.closest('[data-mon-ip]');
  if (t) { const ipv = t.dataset.monIp; const ep = state.monitor.eps[state.monitor.byIp.get(ipv)]; setMonTarget({ kind: 'ip', id: ipv, title: `${ipv} · ${ep.label}` }); }
});
window.addEventListener('resize', () => { if (state.monitor && state.tab === 'monitor') onMonTick(state.monitor); });

// ---------------------------------------------------------------- stats
function renderStats() {
  ensureMonitor();
  const p = state.plan;
  const s = p.stats;
  const kpi = (l, v, sub = '') => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${sub}</div></div>`;
  const usedPorts = p.idfs.reduce((a, x) => a + x.portsUsed, 0);
  $('#statKpis').innerHTML = [
    kpi('ניצול פורטים', `${Math.round((usedPorts / s.accessPorts) * 100)}%`, `${n(usedPorts)} / ${n(s.accessPorts)}`),
    kpi('ניצול כתובות', `${((s.addresses.reserved / s.addresses.total) * 100).toFixed(1)}%`, `${n(s.addresses.reserved)} / ${n(s.addresses.total)}`),
    kpi('PoE בפועל', `${n(s.poeW)}W`, `שמור ${n(s.poeReserveW)}W`),
    kpi('תעבורת שיא פנימית', fmtRate(s.busyMbps), 'סכום כל הארונות'),
    kpi('כבל נחושת', `${n(Math.round(s.cableM / 1000 * 10) / 10)} ק״מ`, `${n(s.outlets)} ריצות`),
    kpi('קישורי סיב', n(s.fiberLinks), p.uplink.label),
    kpi('יחידות ארון', `${n(s.rackU)}U`, `${s.idfs} ארונות + MDF`),
    kpi('יחס מנוי־יתר ממוצע', `${(p.idfs.reduce((a, x) => a + x.oversub, 0) / p.idfs.length).toFixed(1)}:1`, 'יעד: עד 20:1'),
  ].join('');
  const ep = s.endpoints;
  const order = ['data', 'voice', 'ap', 'cam', 'iot', 'iptv', 'print'];
  hbars($('#chEndpoints'), order.filter((k) => ep[k] > 0).map((k) => ({ label: TYPE_META[k].he, value: ep[k], color: TYPE_META[k].color })));
  const byKey = {};
  for (const x of p.subnets) { byKey[x.key] = byKey[x.key] || { usable: 0, reserved: 0 }; byKey[x.key].usable += x.usable; byKey[x.key].reserved += x.reserved; }
  hbars($('#chAddr'), Object.entries(byKey).map(([k, v]) => ({ label: SERVICES[k]?.name || k, value: v.reserved, cap: v.usable, color: 'var(--s-data)', tip: `${SERVICES[k]?.he || k}: ${n(v.reserved)} שמורות מתוך ${n(v.usable)}` })), { valueLabel: 'שמורות', capLabel: 'גודל הרשתות' });
  const idfs = p.idfs.slice(0, 40);
  hbars($('#chPorts'), idfs.map((x) => ({ label: x.id, value: x.portsUsed, cap: x.portsTotal, color: 'var(--s-data)' })), { valueLabel: 'בשימוש', capLabel: 'פורטים במתגים' });
  hbars($('#chPoe'), idfs.map((x) => ({ label: x.id, value: x.poeDrawW, cap: x.poeBudgetPerSwitch * x.members, color: 'var(--s-voice)' })), { unit: 'W', valueLabel: 'צריכה', capLabel: 'תקציב ספקי המתגים' });
  hbars($('#chBusy'), idfs.map((x) => ({ label: x.id, value: x.busyMbps, cap: x.uplinkGbps * 1000, color: 'var(--s-ap)' })), { unit: ' Mbps', valueLabel: 'עומס שיא משוער', capLabel: 'קיבולת Uplink' });
  renderLiveKpis(state.monitor);
}
function renderLiveKpis(m) {
  if (!m) return;
  const t = m.totals();
  const kpi = (l, v, sub = '') => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${sub}</div></div>`;
  $('#liveKpis').innerHTML = [
    kpi('תעבורה פנימית עכשיו', fmtRate(t.now), m.source === 'sim' ? 'סימולציה' : 'נתונים חיים'),
    kpi('אינטרנט עכשיו', fmtRate(t.wanNow), `מתוך ${fmtRate(state.plan.stats.wanMbps)}`),
    kpi('שיא אינטרנט (2 דק׳)', fmtRate(t.wanPeak), ''),
    kpi('נפח פנימי היום', fmtBytes(t.bytes), 'משוער'),
    kpi('נפח אינטרנט היום', fmtBytes(t.wanBytes), 'משוער'),
  ].join('');
}

// ---------------------------------------------------------------- global search
const qIn = $('#q');
const qOut = $('#qResults');
let qHits = [];
let qSel = -1;
function describeHit(h) {
  const p = state.plan;
  if (h.kind === 'endpoint') {
    const o = h.o;
    return { title: `${o.label} · ${o.ip}`, sub: `${TYPE_META[o.type].he}${o.roomNo ? ` · חדר ${o.roomNo}` : ''} · ${o.switch} Gi${o.member}/0/${o.port} · VLAN ${o.vlan}`, go: () => (o.room ? (activate('rooms'), openRoom(o.room)) : (openRack(h.idf.id))) };
  }
  if (h.kind === 'idf') return { title: `${h.idf.id} · ${h.idf.host}`, sub: `ארון · ${h.idf.rooms.length} חדרים · ניהול ${h.idf.mgmtIp}`, go: () => openRack(h.idf.id) };
  return { title: `VLAN ${h.s.vlan ?? '—'} · ${h.s.name}`, sub: `${h.s.cidr} · Gateway ${h.s.gateway ?? '—'} · ${h.s.purpose}`, go: () => { activate('addresses'); $('#snFilter').value = h.s.name; drawSubnets(); void p; } };
}
qIn.addEventListener('input', () => {
  const v = qIn.value.trim();
  if (!v || !state.plan) { qOut.hidden = true; qIn.setAttribute('aria-expanded', 'false'); return; }
  let hits = lookup(state.plan, v);
  if (!hits.length) {
    const r = state.plan.rooms.filter((x) => x.no.startsWith(v)).slice(0, 8);
    hits = r.flatMap((x) => x.outlets.slice(0, 1).map((o) => ({ kind: 'endpoint', o, idf: state.plan.idfs.find((d) => d.id === x.idf) })));
  }
  qHits = hits.slice(0, 12).map(describeHit);
  qSel = -1;
  qOut.innerHTML = qHits.length
    ? qHits.map((h, i) => `<li role="option" id="qh${i}" aria-selected="false" data-i="${i}"><div class="hit-title ltr">${esc(h.title)}</div><div class="hit-sub">${esc(h.sub)}</div></li>`).join('')
    : '<li role="option" aria-disabled="true">לא נמצאו תוצאות</li>';
  qOut.hidden = false;
  qIn.setAttribute('aria-expanded', 'true');
});
qIn.addEventListener('keydown', (e) => {
  if (qOut.hidden) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + qHits.length) % qHits.length;
    $$('li', qOut).forEach((li, i) => li.setAttribute('aria-selected', String(i === qSel)));
    qIn.setAttribute('aria-activedescendant', `qh${qSel}`);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const h = qHits[qSel >= 0 ? qSel : 0];
    if (h) { qOut.hidden = true; h.go(); }
  } else if (e.key === 'Escape') { qOut.hidden = true; qIn.setAttribute('aria-expanded', 'false'); }
});
qOut.addEventListener('mousedown', (e) => {
  const li = e.target.closest('[data-i]');
  if (!li) return;
  e.preventDefault();
  qOut.hidden = true;
  qHits[+li.dataset.i].go();
});
qIn.addEventListener('blur', () => setTimeout(() => { qOut.hidden = true; qIn.setAttribute('aria-expanded', 'false'); }, 150));

// ---------------------------------------------------------------- accessibility & theme
const prefs = store.get(PREFS, {});
function applyPrefs() {
  const r = document.documentElement;
  if (prefs.theme) r.dataset.theme = prefs.theme; else delete r.dataset.theme;
  if (prefs.contrast) r.dataset.contrast = prefs.contrast; else delete r.dataset.contrast;
  if (prefs.motion) r.dataset.motion = prefs.motion; else delete r.dataset.motion;
  r.style.setProperty('--fs', `${prefs.fs || 16}px`);
  $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String((prefs.theme || '') === b.dataset.themeSet)));
  $('#contrastBtn').setAttribute('aria-pressed', String(!!prefs.contrast));
  $('#motionBtn').setAttribute('aria-pressed', String(!!prefs.motion));
  store.set(PREFS, prefs);
}
$('#a11yBtn').addEventListener('click', (e) => {
  const m = $('#a11yMenu');
  m.hidden = !m.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!m.hidden));
  if (!m.hidden) m.querySelector('button').focus();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#a11yMenu') && !e.target.closest('#a11yBtn')) { $('#a11yMenu').hidden = true; $('#a11yBtn').setAttribute('aria-expanded', 'false'); }
});
$('#a11yMenu').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#a11yMenu').hidden = true; $('#a11yBtn').focus(); } });
$('#a11yMenu').addEventListener('click', (e) => {
  const f = e.target.closest('[data-fs]');
  if (f) { const d = +f.dataset.fs; prefs.fs = d === 0 ? 16 : Math.max(13, Math.min(24, (prefs.fs || 16) + d * 2)); }
  const t = e.target.closest('[data-theme-set]');
  if (t) prefs.theme = t.dataset.themeSet || undefined;
  if (e.target.closest('#contrastBtn')) prefs.contrast = prefs.contrast ? undefined : 'high';
  if (e.target.closest('#motionBtn')) prefs.motion = prefs.motion ? undefined : 'reduce';
  applyPrefs();
  if (state.tab === 'topology') { state.rendered.delete('topology'); renderTab('topology'); }
});

// ---------------------------------------------------------------- print
$('#printBtn').addEventListener('click', () => $('#printDlg').showModal());
$('#printDlg').addEventListener('close', () => {
  if ($('#printDlg').returnValue !== 'print') return;
  const parts = $$('#printOpts input:checked').map((x) => x.value);
  buildPrint(parts);
  setTimeout(() => window.print(), 60);
});

function buildPrint(parts) {
  const p = state.plan;
  const s = p.stats;
  const date = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const out = [];
  out.push(`<div class="pr-cover"><div class="eyebrow">נט־פלאן · תכנית תקשורת</div><h1>${esc(p.cfg.site.name)}</h1><p>${esc(date)} · ${s.buildings} מבנים · ${s.floors} קומות · ${n(s.rooms)} חדרים · טווח ${esc(p.cfg.addressing.base)}${p.cfg.addressing.ipv6 ? ` · IPv6 ${esc(p.cfg.addressing.ipv6Effective)}` : ''}</p>
    <div class="kpis">${[['חדרים', n(s.rooms)], ['ארונות', n(s.idfs)], ['מתגים', n(s.switches)], ['VLAN', n(s.vlans)], ['רשתות', n(s.subnets)], ['כתובות שמורות', n(s.addresses.reserved)], ['PoE', `${n(s.poeW)}W`], ['נקודות גישה', n(s.endpoints.ap)]].map(([l, v]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`).join('')}</div></div>`);
  const sec = (title, body) => out.push(`<section class="pr-section"><h2>${esc(title)}</h2>${body}</section>`);
  if (parts.includes('summary')) {
    const r = p.recommendation;
    sec('סיכום והמלצות ציוד', `<p>${esc(r.summary)}</p><p><b>Hub:</b> ${esc(r.hub)}</p><p><b>מתגי גישה:</b> ${esc(r.access)}</p><p><b>ליבה:</b> ${esc(r.core)}</p><p><b>נתב / חומת אש:</b> ${esc(r.router)}</p>${r.wifi ? `<p><b>Wi-Fi:</b> ${esc(r.wifi)}</p>` : ''}
      ${p.warnings.length ? `<h3>נקודות לתשומת לב</h3><ul>${p.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <h3>רשימת ציוד</h3><table><thead><tr><th>פריט</th><th>כמות</th><th>הערה</th></tr></thead><tbody>${p.bom.map((b) => `<tr><td>${esc(b.item)}</td><td>${n(b.qty)}</td><td>${esc(b.note)}</td></tr>`).join('')}</tbody></table>
      <h3>שירותי ליבה</h3><table>${servicesTableHtml(p)}</table>`);
  }
  if (parts.includes('topology')) {
    sec('שרטוט הרשת', `<div class="diagram">${resolveSvgVars(riserSvg(p))}</div>`);
  }
  if (parts.includes('subnets')) {
    sec('רשתות ו-VLAN-ים', `<table><thead><tr><th>VLAN</th><th>שם</th><th>ייעוד</th><th>רשת</th><th>מסכה</th><th>Gateway</th><th>DHCP</th><th>IPv6</th></tr></thead><tbody>${p.subnets.map((x) => `<tr><td>${x.vlan ?? ''}</td><td class="ip">${esc(x.name)}</td><td>${esc(x.purpose)}</td><td class="ip">${esc(x.cidr)}</td><td class="ip">${esc(x.mask)}</td><td class="ip">${esc(x.gateway ?? '')}</td><td class="ip">${x.dhcp && x.poolStart ? `${esc(x.poolStart)}–${esc(x.poolEnd)}` : ''}</td><td class="ip">${esc(x.ipv6 ?? '')}</td></tr>`).join('')}</tbody></table>`);
  }
  if (parts.includes('rooms')) {
    for (const b of p.buildings) {
      for (const f of b.floors) sec(`כתובות לפי חדר · ${b.name} · קומה ${f.label}`, `<table>${ROOM_HEAD.replace(/<button[^>]*>|<\/button>/g, '')}<tbody>${roomRows(f.rooms).replace(/<button[^>]*>|<\/button>/g, '')}</tbody></table>`);
    }
  }
  if (parts.includes('racks')) {
    sec('ארון ראשי (MDF)', `<div style="max-width:330px">${resolveSvgVars(rackSvg(p.mdf, 'MDF'))}</div>`);
    for (const idf of p.idfs) {
      sec(`ארון ${idf.id}`, `<div style="display:grid;grid-template-columns:330px 1fr;gap:16px"><div>${resolveSvgVars(rackSvg(idf.rack, idf.id))}</div><div><p>מתגים: ${idf.members}×${p.cfg.switchPorts} · לוחות ניתוב: ${idf.patchPanels} · PoE ${n(idf.poeDrawW)}W · ניהול ${esc(idf.mgmtIp)} · Uplink ${idf.uplinks}×${esc(p.uplink.label)}</p>
        <table><thead><tr><th>שקע</th><th>לוח</th><th>פורט</th><th>VLAN</th><th>IP</th></tr></thead><tbody>${idf.outlets.map((o) => `<tr><td class="ip">${esc(o.label)}</td><td class="ip">${esc(o.patch)}</td><td class="ip">Gi${o.member}/0/${o.port}</td><td>${o.vlan}</td><td class="ip">${esc(o.ip)}</td></tr>`).join('')}</tbody></table></div></div>`);
    }
  }
  if (parts.includes('configs')) {
    for (const f of ensureFiles()) sec(`הגדרות · ${f.name}`, `<pre class="codebox">${esc(f.text)}</pre>`);
  }
  $('#printRoot').innerHTML = out.join('');
}

function printRoom(id) {
  const p = state.plan;
  const r = p.rooms.find((x) => x.id === id);
  $('#printRoot').innerHTML = `<div class="pr-cover"><div class="eyebrow">נט־פלאן · כרטיס חדר</div><h1>חדר ${esc(r.no)} · ${esc(p.buildings[r.building].name)}</h1><p>${esc(p.cfg.site.name)} · ארון ${esc(r.idf)}</p></div>
    <table>${ROOM_HEAD.replace(/<button[^>]*>|<\/button>/g, '')}<tbody>${roomRows([r]).replace(/<button[^>]*>|<\/button>/g, '')}</tbody></table>
    <p style="margin-top:12px">DNS: ${esc(p.services.dns1)}, ${esc(p.services.dns2)} · דומיין: ${esc(p.cfg.site.domain)} · NTP: ${esc(p.services.ntp)}</p>`;
  setTimeout(() => window.print(), 60);
}

// ---------------------------------------------------------------- boot
applyPrefs();
recompute({ save: false });
renderForm();
state.rendered.add('plan');
activate(location.hash.slice(1) || 'overview', { push: false });
window.scrollTo(0, 0);
