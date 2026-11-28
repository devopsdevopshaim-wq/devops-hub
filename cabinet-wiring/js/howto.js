/* "מה התכנית של X": מה נמצא בכל התכניות, שלבי הביצוע, ומעבדה שבודקת כל שלב.
   הלוגיקה ב-WAsk.howto / labRead / labDiag; כאן רק התצוגה והמעבדה. */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pin = (k) => `<span class="ep mono" dir="ltr">${esc(k)}</span>`;
const short = (k) => String(k || '').replace(/^-/, '');

/* קריאה שהמשתמש הקליד → מספר (OL = אינסוף) */
function parseReading(s) {
  const t = String(s || '').trim().toUpperCase().replace(',', '.');
  if (!t) return null;
  if (/^(OL|∞|INF|פתוח|O\.L)/.test(t)) return Infinity;
  if (/^(דולק|ON|1)$/.test(t)) return 1;
  if (/^(כבוי|OFF|0)$/.test(t)) return 0;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
/* האם הקריאה תואמת את הצפוי */
function judge(t, exp, got) {
  if (got == null) return null;
  if (t.kind === 'ohm') return exp.v === Infinity ? got > 1e5 : got < 3;
  if (t.kind === 'volt') return exp.v > 0 ? got > 18 && got < 30 : got < 3;
  if (t.kind === 'plc') return (got ? 1 : 0) === exp.v;
  return null;
}

export function howtoHtml(r, ctx) {
  const { C, swStyle } = ctx;
  const sw = (code) => { const c = C.COLORS[code]; return c ? `<span class="sw" style="${swStyle(c)}"></span>${esc(c.he || code)}` : esc(code || ''); };
  const searched = r.searched.map((p) => `<li>${esc(p.name)} <span class="muted small">· ${p.wires} חוטים</span></li>`).join('');
  const found = r.found.length ? `<ul class="ht-list">${r.found.map((h) => `<li class="ok"><span class="led ok"></span>${esc(h.project)}: ${pin(h.pin)} — ${esc(h.signal)}${h.page ? ` <button type="button" class="pg-link" data-askpage="${h.page}">עמ׳ ${h.page}</button>` : ''}</li>`).join('')}</ul>` : `<p class="ht-miss"><span class="led warn"></span>לא נמצא ${esc(r.title)} באף אחת מהתכניות. למטה תכנית מומלצת, שנבנתה מהנתונים של הארון.</p>`;
  const related = r.related.length ? `<details class="ht-rel"><summary>אותות קשורים בתכניות (${r.related.length})</summary><ul>${r.related.map((h) => `<li>${esc(h.project)}: ${pin(h.pin)} — ${esc(h.signal)}${h.page ? ` · עמ׳ ${h.page}` : ''}</li>`).join('')}</ul></details>` : '';
  const stages = r.stages.map((sg, si) => {
    const items = sg.items.length ? `<div class="table-wrap"><table class="tbl wires ht-tbl"><thead><tr><th>חוט</th><th>מ-</th><th>אל</th><th>צבע</th><th>ממ"ר</th><th>עמ׳</th></tr></thead><tbody>${sg.items.map((x) => `<tr class="${x.isNew ? 'new' : ''}"><td class="mono">${esc(x.no)}${x.isNew ? ' <span class="badge-new">חדש</span>' : ''}</td><td class="ep" dir="ltr">${esc(x.from)}</td><td class="ep" dir="ltr">${esc(x.to)}</td><td style="white-space:nowrap">${sw(x.color)}</td><td>${esc(C.fmtSection ? C.fmtSection(x.section) : x.section || '')}</td><td>${x.page ? `<button type="button" class="pg-link" data-askpage="${x.page}">${x.page}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
    const tests = sg.tests.map((t) => `<li class="ht-test" data-ht="${esc(t.id)}">
        <div class="ht-th"><span class="led" data-htled></span><b>${esc(t.title)}</b></div>
        <div class="small muted">${esc(t.how)}</div>
        <div class="ht-row">
          <span class="ht-exp">צפוי: <b data-htexp></b></span>
          <span class="ht-sim">במעבדה: <b data-htsim></b></span>
          <label class="ht-in"><span class="small">מדדתי</span><input type="text" inputmode="decimal" placeholder="${t.kind === 'ohm' ? '0 / OL' : t.kind === 'volt' ? 'V' : '1 / 0'}" data-htval aria-label="הקריאה שנמדדה: ${esc(t.title)}"></label>
          <button type="button" class="btn ghost small" data-htset>להעמיד במעבדה</button>
          <button type="button" class="btn ghost small" data-htok>תקין</button>
          <button type="button" class="btn ghost small" data-htbad>לא תקין</button>
        </div>
        <div class="ht-diag small" data-htdiag hidden></div>
      </li>`).join('');
    return `<section class="ht-stage" data-stage="${si}"><h3><span class="ht-n">${si + 1}</span>${esc(sg.title)} <span class="led" data-stled></span></h3>
      <ul class="ht-text">${sg.text.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${items}
      ${tests ? `<h4 class="ht-h">בדיקות בשלב הזה</h4><ul class="ht-tests">${tests}</ul>` : ''}</section>`;
  }).join('');
  const faults = [['', 'בלי תקלה']].concat(r.chain.segs.map((s, i) => s.kind === 'wire' ? [`break:${i}`, `חוט קטוע: ${short(r.chain.nodes[i].pin)} → ${short(r.chain.nodes[i + 1].pin)}`] : null).filter(Boolean)).concat(r.chain.segs.some((s) => s.kind === 'switch') ? [['swap', 'חובר למגע NO במקום NC']] : []);
  return `<div class="card ht-card" id="htCard">
    <div class="card-head"><h2>${esc(r.title)}</h2><span class="ht-src ${r.source}">${r.source === 'drawing' ? 'מהשרטוט' : 'המלצה — לא בתכנית'}</span></div>
    <div class="ht-grid">
      <section><h4>נבדקו ${r.searched.length} תכניות</h4><ul class="ht-list small">${searched}</ul></section>
      <section><h4>מה נמצא</h4>${found}${related}</section>
    </div>
    <div class="ht-lab" id="htLab">
      <div class="ht-labh"><h4>מעבדה</h4><span class="small muted" id="htProg"></span></div>
      <div class="ht-ctl">
        <button type="button" class="lv-tg" data-htpow aria-pressed="false"><span class="led"></span>מתח ‎24V</button>
        <button type="button" class="lv-tg" data-htact aria-pressed="false"><span class="led"></span>המפסק לחוץ</button>
        <label class="ht-fault"><span class="small">תקלה מדומה</span><select id="htFault">${faults.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>
      </div>
      <div class="ht-chain" id="htChain"></div>
    </div>
    <div class="ht-stages">${stages}</div>
  </div>`;
}

export function bindHowto(root, r, WA) {
  const host = root.querySelector('#htCard');
  if (!host) return;
  const st = { power: false, act: false, fault: null };
  const res = {};
  const tests = [];
  r.stages.forEach((sg) => sg.tests.forEach((t) => tests.push(t)));
  const byId = Object.fromEntries(tests.map((t) => [t.id, t]));
  const read = (t, cond) => WA.labRead(r.chain, { ...t, ...(cond || {}) }, cond ? { power: cond.power, fault: st.fault } : { power: t.power, fault: null });
  /* השרשרת החיה: צמתים צבועים לפי המתח */
  const drawChain = () => {
    const N = r.chain.nodes, S = r.chain.segs;
    const v = N.map((n, i) => WA.labRead(r.chain, { kind: 'volt', node: i, act: st.act }, { power: st.power, fault: st.fault }).v);
    host.querySelector('#htChain').innerHTML = N.map((n, i) => {
      const live = st.power && v[i] > 0;
      const node = `<div class="htn ${live ? 'live' : ''} ${n.isNew ? 'new' : ''} ${n.zone === 'field' ? 'fld' : ''}"><b dir="ltr">${esc(short(n.pin))}</b><span class="small">${esc(n.name || '')}</span><span class="htv">${st.power ? (live ? '24V' : '0V') : '—'}</span></div>`;
      if (!i) return node;
      const s = S[i - 1];
      const broken = st.fault && st.fault.kind === 'break' && st.fault.seg === i - 1;
      const closed = WA.labRead(r.chain, { kind: 'ohm', seg: i - 1, act: st.act }, { power: false, fault: st.fault }).v < 1;
      const segH = s.kind === 'switch'
        ? `<div class="hts sw ${closed ? 'closed' : 'open'} ${live && v[i - 1] > 0 ? 'live' : ''}" title="${esc(s.label)}"><span>${closed ? '━' : '╱'}</span><small>${s.nc ? 'NC' : 'NO'}${st.fault && st.fault.kind === 'swap' ? '→NO' : ''}</small></div>`
        : `<div class="hts ${broken ? 'broken' : ''} ${st.power && v[i - 1] > 0 && !broken ? 'live' : ''}"><span>${broken ? '✕' : '→'}</span><small dir="ltr">${esc(s.no || '')}</small></div>`;
      return segH + node;
    }).join('');
  };
  const drawTests = () => {
    let ok = 0;
    tests.forEach((t) => {
      const li = host.querySelector(`[data-ht="${t.id}"]`);
      if (!li) return;
      const exp = read(t);
      const sim = WA.labRead(r.chain, t, { power: t.power, fault: st.fault });
      li.querySelector('[data-htexp]').textContent = exp.text;
      const simEl = li.querySelector('[data-htsim]');
      simEl.textContent = sim.text;
      simEl.classList.toggle('errc', sim.v !== exp.v);
      const v = res[t.id];
      const led = li.querySelector('[data-htled]');
      led.className = 'led' + (v === true ? ' ok' : v === false ? ' err' : '');
      li.classList.toggle('pass', v === true); li.classList.toggle('fail', v === false);
      const dg = li.querySelector('[data-htdiag]');
      const showDiag = v === false || sim.v !== exp.v;
      dg.hidden = !showDiag;
      if (showDiag) dg.textContent = (v === false ? 'לא תקין. ' : 'בתקלה המדומה הקריאה שונה מהצפוי. ') + WA.labDiag(r.chain, t);
      if (v === true) ok++;
    });
    host.querySelectorAll('[data-stage]').forEach((sec) => {
      const ids = [...sec.querySelectorAll('[data-ht]')].map((x) => x.dataset.ht);
      const led = sec.querySelector('[data-stled]');
      if (!ids.length) { led.className = 'led off'; led.hidden = true; return; }
      const all = ids.every((id) => res[id] === true), bad = ids.some((id) => res[id] === false);
      led.className = 'led' + (all ? ' ok' : bad ? ' err' : '');
      led.title = all ? 'השלב נבדק ותקין' : bad ? 'יש בדיקה שנכשלה' : 'עוד לא נבדק';
    });
    host.querySelector('#htProg').textContent = `${ok} מתוך ${tests.length} בדיקות תקינות`;
  };
  const drawCtl = () => {
    const p = host.querySelector('[data-htpow]'), a = host.querySelector('[data-htact]');
    p.classList.toggle('on', st.power); p.setAttribute('aria-pressed', st.power); p.querySelector('.led').className = 'led' + (st.power ? ' ok' : '');
    a.classList.toggle('on', st.act); a.setAttribute('aria-pressed', st.act); a.querySelector('.led').className = 'led' + (st.act ? ' warn' : '');
  };
  const all = () => { drawCtl(); drawChain(); drawTests(); };
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-htpow]')) { st.power = !st.power; all(); return; }
    if (e.target.closest('[data-htact]')) { st.act = !st.act; all(); return; }
    const li = e.target.closest('[data-ht]');
    if (!li) return;
    const t = byId[li.dataset.ht];
    if (e.target.closest('[data-htset]')) { st.power = !!t.power; st.act = !!t.act; all(); host.querySelector('#htLab').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    if (e.target.closest('[data-htok]')) { res[t.id] = true; drawTests(); return; }
    if (e.target.closest('[data-htbad]')) { res[t.id] = false; drawTests(); }
  });
  host.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-htval]');
    if (!inp) return;
    const t = byId[inp.closest('[data-ht]').dataset.ht];
    const got = parseReading(inp.value);
    const j = judge(t, read(t), got);
    if (j == null) delete res[t.id]; else res[t.id] = j;
    drawTests();
  });
  host.querySelector('#htFault').addEventListener('change', (e) => {
    const v = e.target.value;
    st.fault = !v ? null : v === 'swap' ? { kind: 'swap' } : { kind: 'break', seg: Number(v.split(':')[1]) };
    all();
  });
  all();
}

export function howtoText(r) {
  const L = [`${r.title}: ${r.source === 'drawing' ? 'נמצא בתכנית ' + r.home.name : 'לא נמצא בתכניות (' + r.searched.map((p) => p.name).join(', ') + ') — תכנית מומלצת'}.`];
  L.push('המסלול: ' + r.chain.nodes.map((n) => n.pin).join(' → '));
  return L.join('\n');
}
