/* ארון־פלאן — תכנית חיווט מסודרת לתשובה על שאלה: גיליון בסגנון שרטוט חשמל.
   כל אות הוא מסלול זרם אנכי, מלמעלה (‎+24V או יציאת הבקר) למטה (כניסה בבקר או ‎0V),
   עם סמלים: מגע NO / NC, סליל, מהדק, כרטיס בקר, עומס, וציוד בשטח במסגרת מקווקוות. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

const STYLE = `
  svg, text { direction: ltr; }
  text { font-family: 'IBM Plex Sans Hebrew', Arial, sans-serif; unicode-bidi: plaintext; fill: #1c2126; }
  .ln { stroke: #1c2126; stroke-width: 1.6; fill: none; }
  .wl { stroke-width: 2.2; fill: none; }
  .sym { stroke: #1c2126; stroke-width: 1.8; fill: #fff; }
  .dot { fill: #1c2126; }
  .tag { font: 700 11px 'IBM Plex Mono', monospace; }
  .trm { font: 600 9px 'IBM Plex Mono', monospace; fill: #3b434b; }
  .wno { font: 700 10px 'IBM Plex Mono', monospace; fill: #a85a26; }
  .wmeta { font-size: 8.5px; fill: #5f6870; }
  .nm { font-size: 9px; fill: #5f6870; }
  .hd { font-size: 10.5px; font-weight: 700; }
  .hd2 { font-size: 9px; fill: #5f6870; }
  .rail { font: 700 11px 'IBM Plex Mono', monospace; fill: #b3261e; }
  .rail0 { fill: #1f4f8f; }
  .fld { fill: rgba(47, 125, 79, .06); stroke: #2f7d4f; stroke-width: 1.2; stroke-dasharray: 6 4; }
  .fldt { font-size: 9px; fill: #2f7d4f; font-weight: 700; }
  .plc { fill: #e3ecf8; stroke: #1f4f8f; stroke-width: 1.6; }
  .plct { font: 700 10px 'IBM Plex Mono', monospace; fill: #1f4f8f; }
  .frm { fill: none; stroke: #6d757c; }
  .frmt { font: 600 11px 'IBM Plex Mono', monospace; fill: #6d757c; }
  .tb { fill: #f4f5f3; stroke: #2b3035; stroke-width: 1.1; }
  .tbl { font-size: 8.5px; fill: #5f6870; }
  .tbv { font-size: 12px; font-weight: 700; }
  .pg { font: 600 8.5px 'IBM Plex Mono', monospace; fill: #5f6870; }
`;

/* סוג המעבר בתוך רכיב לפי התיאור שלו */
const insideKind = (label) => (/סליל/.test(label) ? 'coil' : /\(NC\)/.test(label) ? 'nc' : /עומס|הרכיב/.test(label) ? 'load' : 'no');

export function schematicSvg(P, r, { C, title = '', drawingNo = '' } = {}) {
  const by = {};
  P.components.forEach((c) => { by[c.tag] = c; });
  const wireOf = {};
  P.wires.forEach((w) => { wireOf[w.id] = w; });
  /* עמודות: מסלולי האותות, ואחריהם המגעים של ממסרים שהיציאות מפעילות */
  const cols = [];
  (r.circuits || []).forEach((c) => {
    cols.push({ kind: 'path', title: c.signal || c.pin, out: c.out, steps: c.steps, complete: c.complete });
    if (c.contacts && c.contacts.length) {
      const groups = {};
      c.contacts.forEach((x) => { (groups[x.tag] = groups[x.tag] || []).push(x); });
      Object.values(groups).forEach((list) => {
        /* זוג מגע (11-14, 13-14): שני ההדקים של המגע והיציאה של כל אחד */
        const t = list.map((x) => x.term);
        const pair = t.length >= 2 ? [list[0], list[1]] : [list[0]];
        cols.push({ kind: 'contact', title: `מגע של ${list[0].tag}`, relay: list[0].tag, pair });
      });
    }
  });
  const COLW = 168, X0 = 70, TOP = 96, SEG = 58, SYM = 66;
  /* מיקומים אנכיים בכל עמודה */
  const colH = cols.map((c) => (c.kind === 'path' ? c.steps.reduce((h, s, i) => h + (i ? (s.via && s.via.wire ? SEG : SYM) : 0), 0) + 120 : 300));
  const H = Math.max(420, Math.max(...colH, 0) + TOP + 40);
  const W = Math.max(720, X0 * 2 + cols.length * COLW);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" class="schem-svg" viewBox="0 0 ${W} ${H + 120}" width="${W}" role="img" aria-label="${esc('תכנית חיווט: ' + (r.question || ''))}"><style>${STYLE}</style>`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H + 120}" fill="#fff"/>`);
  /* מסגרת עם מספרי מסלולים */
  out.push(`<rect x="14" y="14" width="${W - 28}" height="${H + 92}" class="frm" stroke-width="2"/><rect x="30" y="34" width="${W - 60}" height="${H + 56}" class="frm" stroke-width=".8"/>`);
  cols.forEach((c, i) => {
    const cx = X0 + i * COLW + COLW / 2;
    out.push(`<text x="${cx}" y="28" class="frmt" text-anchor="middle">${i + 1}</text>`);
    if (i) out.push(`<line x1="${X0 + i * COLW}" y1="14" x2="${X0 + i * COLW}" y2="34" class="frm"/>`);
  });
  const wireLine = (x, y1, y2, w, pageNo) => {
    const col = C && w && C.COLORS[w.color] ? C.COLORS[w.color] : null;
    const hex = col ? col.hex : '#1c2126';
    const parts = [`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="wl" stroke="${hex === '#f4f4f4' || hex === '#ffffff' ? '#9aa2a8' : hex}"/>`];
    if (col && col.stripe) parts.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="wl" stroke="${col.stripe}" stroke-dasharray="5 5"/>`);
    const my = (y1 + y2) / 2;
    if (w) {
      parts.push(`<text x="${x + 7}" y="${my - 2}" class="wno">${esc(w.no || '')}</text>`);
      parts.push(`<text x="${x + 7}" y="${my + 9}" class="wmeta">${esc([col ? col.he : '', w.section ? w.section + ' ממ"ר' : ''].filter(Boolean).join(' · '))}</text>`);
      if (pageNo) parts.push(`<text x="${x - 7}" y="${my + 3}" class="pg" text-anchor="end">/${esc(pageNo)}</text>`);
    }
    return parts.join('');
  };
  const nodeLabel = (x, y, st, full) => {
    const c = by[st.tag] || {};
    if (c.type === 'terminal') {
      return `<circle cx="${x}" cy="${y}" r="5" class="sym"/><line x1="${x - 3.5}" y1="${y + 3.5}" x2="${x + 3.5}" y2="${y - 3.5}" class="ln" stroke-width="1"/>` +
        `<text x="${x - 10}" y="${y - 1}" class="tag" text-anchor="end">${esc(st.tag)}</text><text x="${x - 10}" y="${y + 10}" class="trm" text-anchor="end">${esc(st.term)}</text>`;
    }
    if (full) return `<circle cx="${x}" cy="${y}" r="3.2" class="dot"/><text x="${x - 8}" y="${y - 1}" class="tag" text-anchor="end">${esc(st.tag)}</text><text x="${x - 8}" y="${y + 10}" class="trm" text-anchor="end">${esc(st.term)}</text><text x="${x}" y="${y + 22}" class="nm" text-anchor="middle">${esc(cut(c.name, 24))}</text>`;
    return `<circle cx="${x}" cy="${y}" r="2.6" class="dot"/><text x="${x - 8}" y="${y + 3}" class="trm" text-anchor="end">${esc(st.term)}</text>`;
  };
  const symbol = (x, y1, y2, kind, st, prev) => {
    const my = (y1 + y2) / 2, c = by[st.tag] || {};
    const lbl = `<text x="${x - 22}" y="${my - 2}" class="tag" text-anchor="end">${esc(st.tag)}</text><text x="${x - 22}" y="${my + 9}" class="nm" text-anchor="end">${esc(cut(c.name, 22))}</text>`;
    const tt = `<text x="${x + 8}" y="${y1 + 11}" class="trm">${esc(prev.term)}</text><text x="${x + 8}" y="${y2 - 4}" class="trm">${esc(st.term)}</text>`;
    let g = '';
    if (kind === 'coil') g = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${my - 10}" class="ln"/><rect x="${x - 15}" y="${my - 10}" width="30" height="20" class="sym"/><line x1="${x}" y1="${my + 10}" x2="${x}" y2="${y2}" class="ln"/>`;
    else if (kind === 'load') g = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${my - 12}" class="ln"/><circle cx="${x}" cy="${my}" r="12" class="sym"/><path d="M${x - 8} ${my - 8} L${x + 8} ${my + 8} M${x + 8} ${my - 8} L${x - 8} ${my + 8}" class="ln"/><line x1="${x}" y1="${my + 12}" x2="${x}" y2="${y2}" class="ln"/>`;
    else if (kind === 'nc') g = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${my - 12}" class="ln"/><line x1="${x}" y1="${my - 12}" x2="${x + 12}" y2="${my + 10}" class="ln" stroke-width="2"/><line x1="${x}" y1="${my + 12}" x2="${x}" y2="${y2}" class="ln"/><line x1="${x}" y1="${my + 6}" x2="${x + 13}" y2="${my + 6}" class="ln"/>`;
    else g = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${my - 12}" class="ln"/><line x1="${x}" y1="${my - 12}" x2="${x - 11}" y2="${my + 10}" class="ln" stroke-width="2"/><line x1="${x}" y1="${my + 12}" x2="${x}" y2="${y2}" class="ln"/>`;
    return g + lbl + tt;
  };
  const plcBox = (x, y, st, isTop) => {
    const c = by[st.tag] || {};
    const h = 34, yy = isTop ? y - h : y;
    return `<rect x="${x - 52}" y="${yy}" width="104" height="${h}" rx="3" class="plc"/><text x="${x}" y="${yy + 14}" class="plct" text-anchor="middle">${esc(st.tag)} : ${esc(st.term)}</text><text x="${x}" y="${yy + 27}" class="nm" text-anchor="middle">${esc(cut(c.partNo || c.name, 20))}</text>`;
  };
  cols.forEach((col, i) => {
    const x = X0 + i * COLW + COLW / 2;
    out.push(`<text x="${x}" y="52" class="hd" text-anchor="middle">${esc(cut(col.title, 26))}</text>`);
    if (col.kind === 'contact') {
      /* המגע של הממסר ולאן הוא מחובר */
      const [a, b] = col.pair;
      let y = TOP;
      out.push(`<text x="${x}" y="66" class="hd2" text-anchor="middle">מופעל מהסליל במסלול ${i}</text>`);
      out.push(nodeLabel(x, y, { tag: a.to.split(':')[0], term: a.to.split(':').slice(1).join(':') }, true));
      out.push(wireLine(x, y, y + SEG, wireOf[a.wire], a.page)); y += SEG;
      if (b) {
        out.push(symbol(x, y, y + SYM, /2$/.test(b.term) || /2$/.test(a.term) ? 'nc' : 'no', { tag: a.tag, term: b.term }, { term: a.term })); y += SYM;
        out.push(wireLine(x, y, y + SEG, wireOf[b.wire], b.page)); y += SEG;
        out.push(nodeLabel(x, y, { tag: b.to.split(':')[0], term: b.to.split(':').slice(1).join(':') }, true));
      }
      return;
    }
    const steps = col.steps;
    const ys = [];
    let y = TOP;
    steps.forEach((st, k) => { if (k) y += st.via && st.via.wire ? SEG : SYM; ys.push(y); });
    /* ציוד בשטח: מסגרת מקווקוות */
    const fi = steps.map((s, k) => (s.zone === 'field' ? k : -1)).filter((k) => k >= 0);
    if (fi.length) {
      const y1 = ys[fi[0]] - (fi[0] === 0 ? 6 : 18), y2 = ys[fi[fi.length - 1]] + 18;
      out.push(`<rect x="${x - COLW / 2 + 8}" y="${y1}" width="${COLW - 16}" height="${y2 - y1}" rx="4" class="fld"/><text x="${x + COLW / 2 - 12}" y="${y2 - 5}" class="fldt" text-anchor="end">בשטח</text>`);
    }
    /* ראש המסלול: מקור המתח או יציאת הבקר */
    const first = steps[0], fc = by[first.tag] || {};
    if (/plc|io/.test(fc.type)) out.push(plcBox(x, ys[0], first, true));
    else {
      const w1 = steps[1] && steps[1].via && steps[1].via.wire ? wireOf[steps[1].via.wire] : null;
      const pot = (w1 && w1.potential) || (fc.type === 'psu' ? '+24V' : /24|^L[123]$|^12/i.test(first.term) ? first.term : '');
      if (pot) out.push(`<line x1="${x - 40}" y1="${ys[0] - 14}" x2="${x + 40}" y2="${ys[0] - 14}" class="ln" stroke="#b3261e" stroke-width="2.4"/><text x="${x + 44}" y="${ys[0] - 10}" class="rail">${esc(pot)}</text><line x1="${x}" y1="${ys[0] - 14}" x2="${x}" y2="${ys[0]}" class="ln"/>`);
      out.push(nodeLabel(x, ys[0], first));
      const nextInside = steps[1] && steps[1].via && steps[1].via.inside;
      if (fc.type !== 'terminal' && !nextInside) out.push(`<text x="${x + 8}" y="${ys[0] - 2}" class="tag">${esc(first.tag)}</text>`);
    }
    for (let k = 1; k < steps.length; k++) {
      const st = steps[k], v = st.via || {};
      if (v.wire) {
        out.push(wireLine(x, ys[k - 1], ys[k], wireOf[v.wire], v.page));
        const c = by[st.tag] || {};
        const last = k === steps.length - 1;
        if (last && /plc|io/.test(c.type)) out.push(plcBox(x, ys[k], st, false));
        else out.push(nodeLabel(x, ys[k], st, last));
      } else {
        out.push(symbol(x, ys[k - 1], ys[k], insideKind(v.inside || ''), st, steps[k - 1]));
        out.push(`<circle cx="${x}" cy="${ys[k]}" r="2.6" class="dot"/>`);
      }
    }
    /* סוף המסלול */
    const lastSt = steps[steps.length - 1], lc = by[lastSt.tag] || {};
    const yEnd = ys[ys.length - 1];
    if (!/plc|io/.test(lc.type)) {
      if (col.out && /A2|X2|^2$|-$|0V/i.test(lastSt.term)) out.push(`<line x1="${x}" y1="${yEnd}" x2="${x}" y2="${yEnd + 16}" class="ln"/><line x1="${x - 40}" y1="${yEnd + 16}" x2="${x + 40}" y2="${yEnd + 16}" class="ln" stroke="#1f4f8f" stroke-width="2.4"/><text x="${x + 44}" y="${yEnd + 20}" class="rail rail0">0V</text>`);
      else if (!col.complete) out.push(`<text x="${x}" y="${yEnd + 24}" class="nm" text-anchor="middle">ממשיך מחוץ לארון</text>`);
    }
  });
  /* טבלת כותרת */
  const tx = W - 30 - 430, ty = H + 34 - 2;
  const cell = (xx, w, lbl, val) => `<rect x="${tx + xx}" y="${ty}" width="${w}" height="56" class="tb"/><text x="${tx + xx + w - 6}" y="${ty + 13}" class="tbl" text-anchor="end">${esc(lbl)}</text><text x="${tx + xx + w - 6}" y="${ty + 40}" class="tbv" text-anchor="end">${esc(val)}</text>`;
  out.push(cell(0, 200, 'שאלה', cut(r.question, 30)) + cell(200, 120, 'פרויקט', cut(title, 16)) + cell(320, 110, 'מס׳ שרטוט', cut(drawingNo || '—', 14)));
  out.push(`<text x="40" y="${ty + 20}" class="tbl">מספר ליד כל קו = מספר החוט · ‎/7 = העמוד בתכנית · מסגרת ירוקה = ציוד בשטח</text>`);
  out.push(`<text x="40" y="${ty + 34}" class="tbl">נבנה מהחיווט שבתכנית. לפני עבודה — לאמת מול השרטוט המקורי.</text>`);
  out.push('</svg>');
  return out.join('');
}
