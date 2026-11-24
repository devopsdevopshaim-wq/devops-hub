/* חיווט חי לשאלת תכנון: לוחצים על התנאים ורואים איך הזרם עובר — היום ואחרי השינוי.
   המודל מגיע מ-WAsk.design (r.live): מקורות (התנאים), ממסרי היתר וסליליהם, שרשרת המגעים בציוד, ויציאות הבקר. */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (k) => String(k || '').replace(/^-/, '');
const tagOf = (k) => String(k || '').split(':')[0];

/* מצב: האם כל רכיב דולק, לפי התנאים ובקשת הפעולה */
export function evaluate(L, st, mode) {
  const on = (c) => c < 0 ? true : !!st.cond[c];
  const relays = {};
  L.permits.forEach((p) => {
    const src = mode === 'after' ? p.after : p.today;
    relays[p.tag] = mode === 'after' && p.series ? src.every((s) => on(s.cond)) : src.some((s) => on(s.cond));
  });
  const chainOk = {};
  L.chains.forEach((ch) => { chainOk[ch.target] = ch.relays.every((t) => relays[t]); });
  const allConds = L.conds.every((c) => !c.ok || on(c.i));
  const outs = L.outputs.map((o) => {
    const cmd = !!st.cmd && (mode === 'after' ? allConds : true);
    const permit = chainOk[o.target] !== undefined ? chainOk[o.target] : true;
    return { ...o, cmd, permit, moves: cmd && permit };
  });
  return { relays, chainOk, outs };
}

/* ציור פאנל אחד (SVG) */
function panel(L, st, mode, gate) {
  const ev = evaluate(L, st, mode);
  const srcN = Math.max(1, L.conds.length), relN = Math.max(1, L.permits.length);
  const ch = L.chains.find((c) => !gate || c.target === gate) || L.chains[0];
  const H = 330;
  const sx = (i) => 40 + i * (210 / Math.max(1, srcN - 1 || 1)) + (srcN === 1 ? 70 : 0);
  const rx = (i) => 40 + i * (210 / Math.max(1, relN - 1 || 1)) + (relN === 1 ? 70 : 0);
  const RAIL = 34, SW0 = 64, SW1 = 96, NODE = 118, COIL = 214, ZERO = 286;
  let g = '';
  /* פסי הזנה */
  g += `<line class="lv-rail p24" x1="20" y1="${RAIL}" x2="300" y2="${RAIL}"/><text class="lv-rl" x="20" y="${RAIL - 8}">+24V</text>`;
  g += `<line class="lv-rail p0" x1="20" y1="${ZERO}" x2="300" y2="${ZERO}"/><text class="lv-rl z" x="20" y="${ZERO + 18}">0V</text>`;
  /* המקורות (התנאים): מגע שנסגר כשהתנאי מתקיים */
  L.conds.forEach((c, i) => {
    const x = sx(i), live = !!st.cond[i];
    g += `<line class="lv-w live" x1="${x}" y1="${RAIL}" x2="${x}" y2="${SW0}"/>`;
    g += live ? `<line class="lv-sw on" x1="${x}" y1="${SW0}" x2="${x}" y2="${SW1}"/>` : `<line class="lv-sw" x1="${x}" y1="${SW0}" x2="${x + 15}" y2="${SW1 - 4}"/>`;
    g += `<circle class="lv-dot" cx="${x}" cy="${SW0}" r="2.5"/><circle class="lv-dot" cx="${x}" cy="${SW1}" r="2.5"/>`;
    g += `<line class="lv-w ${live ? 'live' : ''}" x1="${x}" y1="${SW1}" x2="${x}" y2="${NODE}"/>`;
    const tg = short(c.tags[0] || '');
    g += `<text class="lv-t b" x="${x + 24}" y="${SW0 + 12}">${esc(tg)}</text><text class="lv-t s" x="${x + 24}" y="${SW0 + 26}">${esc(c.signal || c.text)}</text>`;
  });
  /* חוטים מהמקורות לסלילים */
  let lane = 0;
  const pinShown = {}, pinCount = {};
  L.permits.forEach((p, j) => {
    const x2 = rx(j), src = mode === 'after' ? p.after : p.today;
    const series = mode === 'after' && p.series;
    if (series) {
      /* טור: מקור 1 → מקור 2 → סליל */
      const xs = src.map((s) => sx(Math.max(0, s.cond)));
      const y = NODE + 18 + lane * 9; lane++;
      const live = src.every((s) => s.cond < 0 || st.cond[s.cond]);
      g += `<path class="lv-w ${live ? 'live' : ''}" d="M${xs[0]} ${NODE} V${y} H${x2} V${COIL - 14}"/>`;
    } else {
      src.forEach((s) => {
        const x1 = sx(Math.max(0, s.cond)), live = s.cond < 0 || !!st.cond[s.cond];
        const y = NODE + 18 + lane * 9; lane++;
        g += `<path class="lv-w ${live ? 'live' : ''}" d="M${x1} ${NODE} V${y} H${x2} V${COIL - 14}"/>`;
        if (!pinShown[s.pin]) { pinShown[s.pin] = 1; const k = (pinCount[x1] = (pinCount[x1] || 0) + 1); g += `<text class="lv-t s pin" x="${x1 + 5}" y="${NODE + 2 + (k - 1) * 12}">${esc(short(s.pin))}</text>`; }
      });
    }
    const on = ev.relays[p.tag];
    g += `<rect class="lv-coil ${on ? 'on' : ''}" x="${x2 - 16}" y="${COIL - 14}" width="32" height="22" rx="3"/>`;
    g += `<text class="lv-t b" x="${x2 + 22}" y="${COIL + 1}">${esc(short(p.tag))}</text><text class="lv-t s" x="${x2 + 22}" y="${COIL + 14}">${on ? 'דולק' : 'כבוי'}</text>`;
    g += `<line class="lv-w ${on ? 'live0' : ''}" x1="${x2}" y1="${COIL + 8}" x2="${x2}" y2="${ZERO}"/>`;
  });
  /* השרשרת בציוד (למשל STO של השער): מגעי ההיתר בטור — ציור נפרד, כדי שבטלפון יירד מתחת */
  const left = g; g = '';
  const CX = 90;
  if (ch) {
    const pins = ch.pins, steps = [];
    for (let i = 0; i < pins.length; i++) {
      const a = pins[i], b = pins[i + 1];
      if (b && tagOf(a) === tagOf(b) && L.permits.some((p) => p.tag === tagOf(a))) { steps.push({ k: 'c', tag: tagOf(a), t: short(a).split(':')[1] + '-' + short(b).split(':')[1] }); i++; }
      else steps.push({ k: 'p', pin: a });
    }
    const n = steps.length, y0 = 62, dy = Math.min(60, 210 / Math.max(1, n - 1));
    g += `<text class="lv-t b" x="${CX}" y="26" text-anchor="middle">היתר לציוד ${esc(short(ch.target))}</text>`;
    let live = true, y = y0;
    steps.forEach((s, i) => {
      const yy = y0 + i * dy;
      if (i) g += `<line class="lv-w ${live ? 'live' : ''}" x1="${CX}" y1="${y}" x2="${CX}" y2="${yy - (s.k === 'c' ? 12 : 0)}"/>`;
      if (s.k === 'p') {
        g += `<circle class="lv-term" cx="${CX}" cy="${yy}" r="5"/><text class="lv-t s pin" x="${CX + 12}" y="${yy + 4}">${esc(short(s.pin))}</text>`;
        y = yy;
      } else {
        const on = ev.relays[s.tag];
        g += on ? `<line class="lv-sw on" x1="${CX}" y1="${yy - 12}" x2="${CX}" y2="${yy + 12}"/>` : `<line class="lv-sw" x1="${CX}" y1="${yy - 12}" x2="${CX + 13}" y2="${yy + 9}"/>`;
        g += `<text class="lv-t b" x="${CX + 22}" y="${yy - 1}">${esc(short(s.tag))}</text><text class="lv-t s" x="${CX + 22}" y="${yy + 12}">מגע ${esc(s.t)}</text>`;
        live = live && on;
        y = yy + 12;
      }
    });
    const ok = ev.chainOk[ch.target];
    g += `<text class="lv-t b ${ok ? 'okc' : 'errc'}" x="${CX}" y="${H - 14}" text-anchor="middle">${ok ? 'היתר: יש' : 'היתר: אין (חסום)'}</text>`;
  } else {
    g += `<text class="lv-t s" x="${CX}" y="60" text-anchor="middle">אין שרשרת היתר בחומרה</text>`;
  }
  const svg = `<svg class="lv-svg a" viewBox="0 0 315 ${H}" role="img" aria-label="מקורות וסלילים — ${mode === 'after' ? 'אחרי השינוי' : 'היום'}">${left}</svg><svg class="lv-svg c" viewBox="0 0 230 ${H}" role="img" aria-label="שרשרת ההיתר — ${mode === 'after' ? 'אחרי השינוי' : 'היום'}">${g}</svg>`;
  const res = ev.outs.map((o) => `<li class="${o.moves ? 'ok' : 'bad'}"><span class="led ${o.moves ? 'ok' : st.cmd ? 'err' : ''}"></span><span><b>${esc(o.signal)}</b> <span class="mono small" dir="ltr">${esc(short(o.pin))}</span> — ${o.moves ? 'פועל' : !o.cmd ? (st.cmd ? 'חסום: הבקר לא נותן פקודה (תנאי חסר)' + (o.permit ? '' : ' וגם אין היתר בחומרה') : 'אין פקודה') : 'חסום: יש פקודה, אבל אין היתר בחומרה'}</span></li>`).join('');
  return `<div class="lv-panel ${mode}"><h5>${mode === 'after' ? 'אחרי השינוי' : 'היום (לפי השרטוט)'}</h5><div class="lv-svgs">${svg}</div><ul class="lv-res">${res}</ul></div>`;
}

export function liveHtml(r) {
  const L = r.live;
  if (!L || (!L.permits.length && !L.outputs.length)) return '';
  return `<div class="card lv-card" id="lvCard">
    <div class="card-head"><h2>חיווט חי: מה קורה בכל מצב</h2><span class="muted small">לחצו על התנאים</span></div>
    <div class="lv-ctl" id="lvCtl"></div>
    <div class="lv-grid" id="lvGrid"></div>
    <p class="small muted">אדום = יש מתח. משמאל המקורות (התנאים) והסלילים של ממסרי ההיתר, מימין המגעים שלהם בטור במעגל של הציוד. "אחרי השינוי" כולל את שינוי החיווט ואת התנאי בבקר.</p>
  </div>`;
}

export function bindLive(root, r) {
  const L = r.live;
  const host = root.querySelector('#lvCard');
  if (!L || !host) return;
  const st = { cond: L.conds.map(() => true), cmd: true };
  const draw = () => {
    host.querySelector('#lvCtl').innerHTML = L.conds.map((c, i) => `<button type="button" class="lv-tg ${st.cond[i] ? 'on' : ''}" data-lvc="${i}" aria-pressed="${st.cond[i]}"><span class="led ${st.cond[i] ? 'ok' : ''}"></span>${esc(c.text)}<span class="muted small"> · ${esc(c.signal || '')}</span></button>`).join('')
      + `<button type="button" class="lv-tg ${st.cmd ? 'on' : ''}" data-lvcmd aria-pressed="${st.cmd}"><span class="led ${st.cmd ? 'ok' : ''}"></span>פקודה מהבקר: ${esc(r.action.text)}</button>`;
    host.querySelector('#lvGrid').innerHTML = panel(L, st, 'today') + panel(L, st, 'after');
  };
  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lvc]');
    if (b) { const i = Number(b.dataset.lvc); st.cond[i] = !st.cond[i]; draw(); return; }
    if (e.target.closest('[data-lvcmd]')) { st.cmd = !st.cmd; draw(); }
  });
  draw();
}

/* כל החיווט של התשובה, עם הסטטוס אחרי השינוי */
export function wiringTable(r, wireById) {
  const removed = {}, kept = {};
  (r.plan.rewire || []).forEach((x) => x.steps.forEach((s) => { if (s.op === 'remove' && s.wire) removed[s.wire] = 1; if (s.op === 'keep' && s.wire) kept[s.wire] = 1; }));
  const adds = [];
  (r.plan.rewire || []).forEach((x) => x.steps.forEach((s) => { if (s.op === 'add') adds.push({ text: s.text, relay: x.relay }); }));
  const rows = r.wires.map(wireById).filter(Boolean).sort((a, b) => (removed[b.id] ? 1 : 0) - (removed[a.id] ? 1 : 0) || (a.page || 0) - (b.page || 0));
  const tr = rows.map((w) => `<tr class="${removed[w.id] ? 'rm' : ''}" data-id="${esc(w.id)}"><td class="mono">${esc(w.no || '')}</td><td class="mono" dir="ltr">${esc(w.from.tag + ':' + w.from.term)}</td><td class="mono" dir="ltr">${esc(w.to.tag + ':' + w.to.term)}</td><td>${esc(w.desc || '')}</td><td>${w.page || ''}</td><td>${removed[w.id] ? '<b class="errc">להוריד</b>' : kept[w.id] ? 'נשאר' : 'ללא שינוי'}</td></tr>`).join('')
    + adds.map((a) => { const [f, t] = a.text.split(' → '); return `<tr class="add"><td class="mono">חדש</td><td class="mono" dir="ltr">${esc(f)}</td><td class="mono" dir="ltr">${esc(t)}</td><td>הזנת הסליל של ${esc(short(a.relay))}</td><td></td><td><b class="okc">לחבר</b></td></tr>`; }).join('');
  return `<div class="card lv-wires"><div class="card-head"><h2>כל החיווט של התשובה — אחרי השינוי</h2><span class="muted small">${rows.length} חוטים · ${Object.keys(removed).length} להוריד · ${adds.length} לחבר</span></div>
    <div class="table-wrap"><table class="tbl wires ask-wires lv-tbl"><thead><tr><th>חוט</th><th>מ-</th><th>אל</th><th>תיאור</th><th>עמ'</th><th>אחרי השינוי</th></tr></thead><tbody>${tr}</tbody></table></div></div>`;
}
