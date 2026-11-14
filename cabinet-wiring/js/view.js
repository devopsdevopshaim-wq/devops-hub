/* ארון־פלאן — ציור הארון ב-SVG: פלטה, תעלות, מסילות, רכיבים, דלת, שטח וכל החוטים.
   מעבר עכבר על חוט → הסבר; לחיצה → בחירה; גלגלת / צביטה → זום; גרירה → הזזה. */
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* העיצוב של השרטוט בתוך ה-SVG עצמו, כדי שגם ההדפסה והייצוא ייראו אותו דבר */
export const SVG_STYLE = `
  svg, text { direction: ltr; }
  text { font-family: 'IBM Plex Sans Hebrew', Arial, sans-serif; unicode-bidi: plaintext; }
  .t-cap { font-size: 15px; fill: #a4adb4; font-family: 'IBM Plex Mono', monospace; }
  .t-rail { font-size: 12px; fill: #56606c; font-weight: 700; }
  .t-zone { font-size: 16px; fill: #c9d2dc; font-weight: 700; }
  .t-tag { font-size: 10px; fill: #20252c; font-weight: 700; }
  .t-tag.in, .t-tag.out { fill: #fff; }
  .t-name { font-size: 9px; fill: #e8edf4; }
  .t-mk { font-size: 6.5px; fill: rgba(255,255,255,.72); font-weight: 700; letter-spacing: .02em; font-family: Arial, sans-serif; }
  .t-pn { font-size: 5.6px; fill: rgba(255,255,255,.85); font-family: 'IBM Plex Mono', monospace; }
  .t-name.dim { fill: #b9c3cf; }
  .t-motor { font-size: 34px; fill: #e8edf4; font-weight: 800; }
  .t-term { font-size: 4.2px; fill: #20252c; dominant-baseline: middle; }
  .t-pin { font-size: 5px; fill: #20252c; font-weight: 700; paint-order: stroke; stroke: #e7ebef; stroke-width: 1.4px; }
  .dim { stroke: #a4adb4; stroke-width: 1.2; }
  .dim-ext { stroke: #7d8894; stroke-width: .8; }
  .t-dim { font-size: 9px; fill: #a4adb4; font-family: 'IBM Plex Mono', monospace; }
  .t-dimb { font-size: 12px; fill: #e9ebe8; font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
  .tb-cell { fill: #f4f5f3; stroke: #2b3035; stroke-width: 1.2; }
  .tb-l { font-size: 8.5px; fill: #5f6870; }
  .tb-v { font-size: 12px; fill: #1c2126; font-weight: 600; }
  .tb-v.big { font-size: 16px; }
  .pin { fill: #f2c21b; stroke: #6b5200; stroke-width: .5; }
  .w polyline { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .w .case { stroke: #0b0d10; opacity: .55; }
  .w .hit { stroke: transparent; stroke-width: 10px; cursor: pointer; pointer-events: stroke; }
  .w { transition: opacity .15s; }
  .has-hl .w:not(.hl) { opacity: .12; }
  .has-sel .w:not(.sel) { opacity: .16; }
  .w.sel .case { stroke: #e0904f; opacity: 1; stroke-width: 7px; }
  .w.done .core { stroke-dasharray: none; }
  .w:hover .case { stroke: #e0904f; opacity: .9; }
  .comp { cursor: pointer; }
  /* שרטוט הרכבה: החוטים מוסתרים, ומופיעים רק כשבוחרים רכיב, חוט או תפקיד */
  svg.has-flt:not(.lay) .w:not(.flt) { display: none; }
  svg.lay .w { opacity: 0; pointer-events: none; }
  svg.lay.has-flt .w.flt, svg.lay .w.hl, svg.lay .w.sel { opacity: 1; pointer-events: auto; }
  svg.lay.has-hl .w:not(.hl) { opacity: 0; }
  .frm { fill: none; stroke: #8d959f; }
  .frm-o { stroke-width: 2.2; }
  .frm-i { stroke-width: .9; }
  .frm-t { stroke: #8d959f; stroke-width: .9; }
  .t-frm { font-size: 13px; fill: #a4adb4; font-family: 'IBM Plex Mono', monospace; font-weight: 600; dominant-baseline: middle; }
  .comp.end > rect:first-of-type, .comp.end > circle:first-of-type { stroke: #e0904f; stroke-width: 3px; }
  .t-rl { font-size: 10px; font-weight: 700; fill: #2f6f4f; }
  .t-rl.rec { fill: #b0651f; font-weight: 600; font-style: italic; }
  .comp.nd > rect:first-of-type { stroke: #e0904f; stroke-width: 2px; stroke-dasharray: 5 3; }
  .pin-hit { fill: transparent; pointer-events: none; }
  /* מעבדה — עריכה: לוחצים על הדק ואז על הדק נוסף ונוצר חוט */
  svg.pinmode .pin-hit { pointer-events: all; cursor: crosshair; }
  svg.pinmode .pn:hover .pin-hit { fill: rgba(224,144,79,.35); }
  svg.pinmode .pn.pick .pin-hit { fill: rgba(224,144,79,.75); stroke: #e0904f; stroke-width: 1; }
  svg.pinmode .pin { r: 2.4px; }
  /* מעבדה — הדמיה חיה: חוטים שיש בהם מתח זוהרים בצבע הפוטנציאל וזורמים */
  svg.sim .w:not(.live) polyline { stroke-opacity: .22; }
  svg.sim .w.live .case { opacity: .95; stroke-width: 5px; }
  svg.sim.flow .w.live .case { stroke-dasharray: 7 6; animation: flow .9s linear infinite; }
  svg.sim .w.p-L1 .case { stroke: #ff8a3d; } svg.sim .w.p-L2 .case { stroke: #c46cff; } svg.sim .w.p-L3 .case { stroke: #ffd23d; }
  svg.sim .w.p-N .case { stroke: #4da3ff; } svg.sim .w.p-PE .case { stroke: #3ddc84; animation: none; stroke-dasharray: none; opacity: .5; }
  svg.sim .w.p-24 .case { stroke: #ff4d6d; } svg.sim .w.p-0V .case { stroke: #5b8cff; }
  svg.sim .w.short .case { stroke: #ff1f1f; stroke-width: 8px; stroke-dasharray: 3 3; }
  svg.sim.flow .w.short .case { animation: flow .3s linear infinite; }
  svg.sim .comp { cursor: pointer; }
  svg.sim .comp.op > rect:first-of-type, svg.sim .comp.op > circle:first-of-type { stroke: #e9ebe8; stroke-dasharray: 3 2; }
  svg.sim .comp.s-on > rect:first-of-type { stroke: #3ddc84; stroke-width: 2.5px; stroke-dasharray: none; }
  svg.sim .comp.s-off > rect:first-of-type { stroke: #8d959f; stroke-width: 2.5px; opacity: .75; }
  svg.sim .comp.s-en > rect:first-of-type { stroke: #3ddc84; stroke-width: 4px; stroke-dasharray: none; }
  svg.sim .comp.s-en > rect:nth-of-type(2) { fill: rgba(61,220,132,.55); }
  svg.sim .comp.s-trip > rect:first-of-type, svg.sim .comp.s-fault > rect:first-of-type, svg.sim .comp.s-fault > circle:first-of-type { stroke: #ff1f1f; stroke-width: 4px; stroke-dasharray: 4 2; }
  svg.sim .comp.s-press > circle:nth-of-type(2) { r: 9px; stroke: #fff; stroke-width: 2px; }
  svg.sim .comp.s-lit > circle:nth-of-type(2) { filter: drop-shadow(0 0 6px #fff) brightness(1.5); opacity: 1; }
  svg.sim .comp.ty-lamp:not(.s-lit) > circle:nth-of-type(2) { opacity: .25; }
  svg.sim .comp.s-run > circle:first-of-type { stroke: #3ddc84; stroke-width: 5px; stroke-dasharray: 14 8; animation: spin 1.1s linear infinite; transform-box: fill-box; transform-origin: center; }
  svg.sim .comp.s-run.ccw > circle:first-of-type { animation-direction: reverse; }
  svg.sim .comp.s-sense > rect:first-of-type { stroke: #ffd23d; stroke-width: 4px; }
  @keyframes flow { to { stroke-dashoffset: -26; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { svg.sim .w.live .case, svg.sim .comp.s-run > circle:first-of-type { animation: none; } }
`;

/* קיצור שם היצרן לתווית על הרכיב */
export function makerShort(m) {
  const t = String(m || '');
  if (/schneider/i.test(t)) return 'Schneider';
  if (/phoenix/i.test(t)) return 'PHOENIX';
  if (/weidm/i.test(t)) return 'Weidmüller';
  if (/mean\s*well/i.test(t)) return 'MEAN WELL';
  return t.split(/\s+/)[0].slice(0, 12);
}

function lampColor(name) {
  const n = String(name || '');
  if (/ירוק|green|גרין/i.test(n)) return '#3ddc84';
  if (/אדום|red/i.test(n)) return '#ff4d4d';
  if (/צהוב|כתום|amber|yellow|orange/i.test(n)) return '#ffc93c';
  if (/כחול|blue/i.test(n)) return '#4da3ff';
  if (/לבן|white/i.test(n)) return '#f2f2f2';
  return '#bbb';
}

export class CabinetView {
  constructor(host, { onHover, onSelect, onComp, onPin, mini = false } = {}) {
    this.host = host;
    this.onPin = onPin || null;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onComp = onComp || (() => {});
    this.mini = mini;
    this.layoutMode = !mini;
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'cab-svg' + (mini ? ' mini' : ''));
    this.svg.setAttribute('role', 'img');
    host.innerHTML = '';
    host.appendChild(this.svg);
    this.vb = null;
    this.pointers = new Map();
    this.bind();
  }

  render(project, L, { C } = {}) {
    this.p = project; this.L = L; this.C = C;
    const compBy = {};
    project.components.forEach((c) => { compBy[c.tag] = c; });
    const out = [];
    out.push(`<style>${SVG_STYLE}</style>`);
    out.push(`<defs>
      <marker id="arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#a4adb4"/></marker>
      <pattern id="duct-slots" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#8f98a3"/><rect x="1" y="0" width="3" height="10" fill="#7c858f"/></pattern>
      <pattern id="duct-slots-v" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#8f98a3"/><rect x="0" y="1" width="10" height="3" fill="#7c858f"/></pattern>
    </defs>`);
    const P = L.plate;
    out.push(`<g class="plate"><rect x="-12" y="-12" width="${P.w + 24}" height="${P.h + 24}" rx="6" fill="#56606c"/>
      <rect x="0" y="0" width="${P.w}" height="${P.h}" fill="#d3d8de" stroke="#9aa3ad"/>
      <text x="${P.w / 2}" y="${P.h + 30}" class="t-cap" text-anchor="middle">פלטת הרכבה ${P.w}×${P.h} מ"מ</text></g>`);
    /* תעלות */
    out.push('<g class="ducts">');
    L.ducts.forEach((d) => {
      out.push(`<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="url(#${d.kind === 'v' ? 'duct-slots-v' : 'duct-slots'})" stroke="#6c757f" opacity=".62"/>`);
    });
    out.push('</g>');
    /* מסילות */
    out.push('<g class="rails">');
    L.rails.forEach((r, i) => {
      out.push(`<rect x="${r.x1}" y="${r.y - 17.5}" width="${r.x2 - r.x1}" height="35" fill="#b9c0c8" stroke="#8d959f"/>`);
      out.push(`<text x="${r.x1 - 4}" y="${r.y + 3}" class="t-rail" text-anchor="end">${i + 1}</text>`);
      if (!this.mini) out.push(`<text x="${r.x2 + 4}" y="${r.y + 3}" class="t-dim">TS35 · ${Math.round(r.x2 - r.x1)}</text>`);
      /* מסילה מהשרטוט: השם שלה; מסילה שהשרטוט לא מגדיר: מסומנת כהמלצה */
      if (!this.mini && L.mode === 'drawing' && r.top != null) {
        const lbl = r.fromDrawing ? (r.label || 'לפי השרטוט') : 'לפי המלצה — לא מופיע בשרטוט';
        out.push(`<text x="${r.x1}" y="${r.top - 5}" class="t-rl ${r.fromDrawing ? 'drw' : 'rec'}">${esc(lbl)}</text>`);
      }
    });
    out.push('</g>');
    /* מידות: רוחב וגובה הפלטה, ומיקום כל מסילה מראש הפלטה */
    if (!this.mini) {
      const tick = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="dim-ext"/>`;
      out.push(`<g class="dims">${tick(0, -14, 0, -46)}${tick(P.w, -14, P.w, -46)}
        <line x1="0" y1="-36" x2="${P.w}" y2="-36" class="dim" marker-start="url(#arr)" marker-end="url(#arr)"/>
        <rect x="${P.w / 2 - 34}" y="-46" width="68" height="18" fill="#262e39"/><text x="${P.w / 2}" y="-33" class="t-dimb" text-anchor="middle">${P.w}</text>
        ${tick(-14, 0, -46, 0)}${tick(-14, P.h, -46, P.h)}
        <line x1="-36" y1="0" x2="-36" y2="${P.h}" class="dim" marker-start="url(#arr)" marker-end="url(#arr)"/>
        <g transform="translate(-36 ${P.h / 2}) rotate(-90)"><rect x="-34" y="-10" width="68" height="18" fill="#262e39"/><text x="0" y="3" class="t-dimb" text-anchor="middle">${P.h}</text></g>
        ${L.rails.map((r) => `<line x1="-14" y1="${r.y}" x2="-6" y2="${r.y}" class="dim-ext"/><text x="-16" y="${r.y + 3}" class="t-dim" text-anchor="end">${Math.round(r.y)}</text>`).join('')}
      </g>`);
    }
    /* דלת ושטח */
    if (L.door) {
      const d = L.door;
      out.push(`<g class="zone"><rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="8" fill="#3a4350" stroke="#7d8894" stroke-dasharray="6 4"/>
        <text x="${d.x + d.w / 2}" y="${d.y + 22}" class="t-zone" text-anchor="middle">דלת הארון</text></g>`);
    }
    if (L.field) {
      const f = L.field;
      out.push(`<g class="zone"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="8" fill="none" stroke="#7d8894" stroke-dasharray="10 6"/>
        <text x="${f.x + 14}" y="${f.y + 22}" class="t-zone">בשטח (מחוץ לארון)</text></g>`);
    }
    /* רכיבים */
    out.push('<g class="comps">');
    Object.values(L.comps).forEach((b) => {
      const c = compBy[b.tag] || {};
      const info = (C && C.TYPES[c.type]) || { fill: '#444', he: '' };
      const name = esc(c.name || info.he);
      const nd = L.mode === 'drawing' && b.zone === 'cabinet' && !b.fromDrawing ? ' nd' : '';
      out.push(`<g class="comp ty-${esc(c.type || 'x')}${nd}" data-tag="${esc(b.tag)}" tabindex="-1"><title>${esc(b.tag)} — ${name}</title>`);
      if (c.type === 'terminal') {
        const terms = Object.keys(L.pins).filter((k) => k.startsWith(b.tag + ':')).map((k) => ({ t: k.slice(b.tag.length + 1), x: L.pins[k].x }));
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#7b828c" rx="1"/>`);
        terms.forEach((t, i) => {
          const pe = /^PE/i.test(t.t);
          out.push(`<rect x="${t.x - 3}" y="${b.y + 1}" width="6" height="${b.h - 2}" fill="${pe ? '#3aa655' : i % 2 ? '#a9b0b9' : '#c4cad1'}" stroke="#5d646d" stroke-width=".4"/>`);
          out.push(`<text x="${t.x}" y="${b.y + b.h / 2}" class="t-term" text-anchor="middle" transform="rotate(-90 ${t.x} ${b.y + b.h / 2})">${esc(t.t)}</text>`);
        });
        out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h + 12}" class="t-tag" text-anchor="middle">${esc(b.tag)}</text>`);
      } else if (c.type === 'pe_bar') {
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#c8a86a" stroke="#8a6d36" rx="2"/><rect x="${b.x}" y="${b.y + b.h - 5}" width="${b.w}" height="5" fill="#2f9e44"/>`);
        out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h + 12}" class="t-tag" text-anchor="middle">${esc(b.tag)} ⏚</text>`);
      } else if (b.zone === 'door') {
        const r = Math.min(b.w, b.h) / 2;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (c.type === 'estop') out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#f2c21b"/><circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="#c4161c" stroke="#7a0d10"/>`);
        else if (c.type === 'lamp') out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#222" stroke="#999"/><circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="${lampColor(c.name + ' ' + c.desc)}" opacity=".9"/>`);
        else if (c.type === 'button' || c.type === 'selector') out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#222" stroke="#999"/><circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="${c.type === 'selector' ? '#333' : lampColor(c.name + ' ' + c.desc)}"/>${c.type === 'selector' ? `<rect x="${cx - 3}" y="${cy - r + 8}" width="6" height="${2 * r - 16}" fill="#ddd"/>` : ''}`);
        else out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="${info.fill}" stroke="#999"/>`);
        out.push(`<text x="${cx}" y="${b.y + b.h + 12}" class="t-tag out" text-anchor="middle">${esc(b.tag)}</text>`);
      } else if (c.type === 'motor') {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        out.push(`<circle cx="${cx}" cy="${cy}" r="${b.w / 2}" fill="${info.fill}" stroke="#9aa3ad" stroke-width="2"/><text x="${cx}" y="${cy + 2}" class="t-motor" text-anchor="middle">M</text><text x="${cx}" y="${cy + 22}" class="t-name" text-anchor="middle">3~</text>`);
        out.push(`<text x="${cx}" y="${b.y + b.h + 16}" class="t-tag out" text-anchor="middle">${esc(b.tag)}</text><text x="${cx}" y="${b.y + b.h + 28}" class="t-name dim" text-anchor="middle">${name}</text>`);
      } else {
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="${info.fill}" stroke="#20252c"/>`);
        out.push(`<rect x="${b.x + 2}" y="${b.y + b.h * 0.38}" width="${b.w - 4}" height="${b.h * 0.24}" rx="2" fill="rgba(255,255,255,.1)"/>`);
        out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 3}" class="t-tag in" text-anchor="middle">${esc(b.tag)}</text>`);
        if (c.maker && b.zone === 'cabinet' && b.h > 40 && !this.mini) {
          out.push(`<text x="${b.x + b.w / 2}" y="${b.y + 11}" class="t-mk" text-anchor="middle">${esc(makerShort(c.maker))}</text>`);
          if (c.partNo && b.w >= 30) out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h - 6}" class="t-pn" text-anchor="middle">${esc(String(c.partNo).split(/\s[+(]/)[0].slice(0, Math.max(6, Math.floor(b.w / 4.2))))}</text>`);
        }
        if (b.zone === 'field') out.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h + 14}" class="t-name dim" text-anchor="middle">${name}</text>`);
      }
      out.push('</g>');
    });
    out.push('</g>');
    /* חוטים */
    out.push('<g class="wires">');
    project.wires.forEach((w) => {
      const r = L.routes[w.id];
      if (!r) return;
      const col = (C && C.COLORS[w.color]) || { hex: '#222' };
      const vis = C ? C.sectionVis(w.section) : 2;
      const pts = r.pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      out.push(`<g class="w" data-id="${esc(w.id)}" data-func="${esc(w.func)}">`);
      out.push(`<polyline class="case" points="${pts}" stroke-width="${vis + 1.3}"/>`);
      out.push(`<polyline class="core" points="${pts}" stroke="${col.hex}" stroke-width="${vis}"/>`);
      if (col.stripe) out.push(`<polyline class="core" points="${pts}" stroke="${col.stripe}" stroke-width="${vis}" stroke-dasharray="6 6"/>`);
      out.push(`<polyline class="hit" points="${pts}"/>`);
      out.push('</g>');
    });
    out.push('</g>');
    /* פינים */
    if (!this.mini) {
      out.push('<g class="pins">');
      Object.entries(L.pins).forEach(([k, pn]) => {
        if (pn.slice) return;
        const term = k.slice(k.indexOf(':') + 1);
        const ty = pn.side === 'top' ? pn.y - 3 : pn.side === 'bottom' ? pn.y + 7 : pn.y + 2;
        const tx = pn.side === 'left' ? pn.x - 4 : pn.x;
        out.push(`<g class="pn" data-k="${esc(k)}"><circle cx="${pn.x}" cy="${pn.y}" r="5" class="pin-hit"/><circle cx="${pn.x}" cy="${pn.y}" r="1.7" class="pin"/></g><text x="${tx}" y="${ty}" class="t-pin" text-anchor="${pn.side === 'left' ? 'end' : 'middle'}">${esc(term)}</text>`);
      });
      out.push('</g>');
    }
    /* טבלת כותרת כמו בשרטוט אמיתי */
    let extraH = 0;
    if (!this.mini) {
      const m = project.meta || {};
      const tw = 420, th = 104, tx = Math.max(P.w, L.bounds.w) - tw, ty = L.bounds.h + 30;
      const date = new Intl.DateTimeFormat('he-IL').format(new Date());
      const cell = (x, y, w, h, lbl, val, cls = '') => `<rect x="${tx + x}" y="${ty + y}" width="${w}" height="${h}" class="tb-cell"/><text x="${tx + x + w - 6}" y="${ty + y + 12}" class="tb-l" text-anchor="end">${esc(lbl)}</text><text x="${tx + x + w - 6}" y="${ty + y + h - 8}" class="tb-v ${cls}" text-anchor="end">${esc(val)}</text>`;
      out.push(`<g class="tblock">
        ${cell(0, 0, tw, 40, 'פרויקט', m.title || project.name || '', 'big')}
        ${cell(0, 40, 140, 32, 'גיליון', 'פריסת ארון — מבט חזית')}${cell(140, 40, 140, 32, 'מס׳ שרטוט', m.drawingNo || '—')}${cell(280, 40, 140, 32, 'גרסה', String(m.revision || '—').slice(0, 18))}
        ${cell(0, 72, 105, 32, 'מידות', 'מ"מ')}${cell(105, 72, 105, 32, 'רכיבים', String(project.components.length))}${cell(210, 72, 105, 32, 'חוטים', String(project.wires.length))}${cell(315, 72, 105, 32, 'תאריך', date)}
      </g>`);
      extraH = th + 40;
    }
    /* מסגרת שרטוט עם רשת אזורים (עמודות 1..n, שורות A..), כמו בגיליון הנדסי */
    const bx = this.mini ? -30 : -80, by = this.mini ? -30 : -70, bw = L.bounds.w + (this.mini ? 60 : 110), bh = L.bounds.h + (this.mini ? 60 : 100) + extraH;
    this.grid = null;
    if (!this.mini) {
      const ox = bx - 30, oy = by - 30, ow = bw + 60, oh = bh + 60, ix = bx - 10, iy = by - 10, iw = bw + 20, ih = bh + 20;
      const cols = Math.max(6, Math.min(12, Math.round(iw / 170))), rows = Math.max(4, Math.min(10, Math.round(ih / 170)));
      const f = [`<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" class="frm frm-o"/>`, `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" class="frm frm-i"/>`];
      for (let i = 0; i < cols; i++) {
        const x = ix + (i * iw) / cols, xm = ix + ((i + 0.5) * iw) / cols;
        if (i) f.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${iy}" class="frm-t"/><line x1="${x}" y1="${iy + ih}" x2="${x}" y2="${oy + oh}" class="frm-t"/>`);
        f.push(`<text x="${xm}" y="${(oy + iy) / 2}" class="t-frm" text-anchor="middle">${i + 1}</text><text x="${xm}" y="${(iy + ih + oy + oh) / 2}" class="t-frm" text-anchor="middle">${i + 1}</text>`);
      }
      for (let j = 0; j < rows; j++) {
        const y = iy + (j * ih) / rows, ym = iy + ((j + 0.5) * ih) / rows, ch = String.fromCharCode(65 + j);
        if (j) f.push(`<line x1="${ox}" y1="${y}" x2="${ix}" y2="${y}" class="frm-t"/><line x1="${ix + iw}" y1="${y}" x2="${ox + ow}" y2="${y}" class="frm-t"/>`);
        f.push(`<text x="${(ox + ix) / 2}" y="${ym}" class="t-frm" text-anchor="middle">${ch}</text><text x="${(ix + iw + ox + ow) / 2}" y="${ym}" class="t-frm" text-anchor="middle">${ch}</text>`);
      }
      out.push(`<g class="frame">${f.join('')}</g>`);
      this.grid = { ix, iy, iw, ih, cols, rows };
    }
    this.svg.innerHTML = out.join('');
    this.svg.classList.toggle('lay', Boolean(this.layoutMode) && !this.mini);
    this.bounds = this.mini ? { x: bx, y: by, w: bw, h: bh } : { x: bx - 36, y: by - 36, w: bw + 72, h: bh + 72 };
    if (!this.vb) this.fit(); else this.apply();
    if (this.selected) this.select(this.selected, false);
  }

  fit() { this.vb = { ...this.bounds }; this.apply(); }
  apply() { const v = this.vb; this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }
  zoom(k, cx, cy) {
    const v = this.vb; if (!v) return;
    const nx = cx == null ? v.x + v.w / 2 : cx, ny = cy == null ? v.y + v.h / 2 : cy;
    const nw = Math.max(80, Math.min(this.bounds.w * 3, v.w * k));
    const f = nw / v.w;
    this.vb = { x: nx - (nx - v.x) * f, y: ny - (ny - v.y) * f, w: nw, h: v.h * f };
    this.apply();
  }
  toSvg(ev) {
    const r = this.svg.getBoundingClientRect(), v = this.vb;
    const s = Math.max(v.w / r.width, v.h / r.height);
    const ox = (r.width * s - v.w) / 2, oy = (r.height * s - v.h) / 2;
    return { x: v.x - ox + (ev.clientX - r.left) * s, y: v.y - oy + (ev.clientY - r.top) * s, s };
  }

  /* מתמקד בחוט: מזיז את התצוגה כך ששני הקצוות נראים */
  focusWire(id) {
    const r = this.L && this.L.routes[id];
    if (!r) return;
    const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]);
    const x1 = Math.min(...xs) - 60, x2 = Math.max(...xs) + 60, y1 = Math.min(...ys) - 60, y2 = Math.max(...ys) + 60;
    this.vb = { x: x1, y: y1, w: Math.max(200, x2 - x1), h: Math.max(160, y2 - y1) };
    this.apply();
  }

  select(id, notify = true) {
    this.selected = id;
    this.svg.querySelectorAll('.w.sel').forEach((g) => g.classList.remove('sel'));
    this.svg.querySelectorAll('.comp.end').forEach((g) => g.classList.remove('end'));
    this.svg.classList.toggle('has-sel', Boolean(id));
    if (id) {
      const g = this.svg.querySelector(`.w[data-id="${CSS.escape(id)}"]`);
      if (g) { g.classList.add('sel'); g.parentNode.appendChild(g); }
      const w = this.p && this.p.wires.find((x) => x.id === id);
      if (w) [w.from.tag, w.to.tag].forEach((t) => { const c = this.svg.querySelector(`.comp[data-tag="${CSS.escape(t)}"]`); if (c) c.classList.add('end'); });
    }
    if (notify) this.onSelect(id);
  }

  /* מדגיש את כל החוטים של רכיב, או מסנן לפי קבוצת מזהים */
  highlight(ids) {
    const set = ids ? new Set(ids) : null;
    this.svg.classList.toggle('has-hl', Boolean(set));
    this.svg.querySelectorAll('.w').forEach((g) => g.classList.toggle('hl', Boolean(set && set.has(g.dataset.id))));
  }
  setDone(doneSet) {
    this.svg.querySelectorAll('.w').forEach((g) => g.classList.toggle('done', doneSet.has(g.dataset.id)));
  }
  filter(visibleSet) {
    this.svg.classList.toggle('has-flt', Boolean(visibleSet));
    this.svg.querySelectorAll('.w').forEach((g) => g.classList.toggle('flt', Boolean(visibleSet && visibleSet.has(g.dataset.id))));
  }
  /* שרטוט הרכבה (בלי חוטים) או תצוגה עם כל החוטים */
  setLayout(on) { this.layoutMode = on; this.svg.classList.toggle('lay', Boolean(on) && !this.mini); }
  /* מעבדה: מצב בחירת הדקים לחיווט */
  setPinMode(on, picked) {
    this.pinMode = Boolean(on);
    this.svg.classList.toggle('pinmode', this.pinMode);
    this.svg.querySelectorAll('.pn.pick').forEach((g) => g.classList.remove('pick'));
    if (on && picked) { const g = this.svg.querySelector(`.pn[data-k="${CSS.escape(picked)}"]`); if (g) g.classList.add('pick'); }
  }
  /* מעבדה: מציג את תוצאת ההדמיה — חוטים חיים, קצרים ומצב כל רכיב */
  setSim(res, { operable } = {}) {
    const on = Boolean(res);
    this.svg.classList.toggle('sim', on);
    const potCls = (p) => (/^L[123]$/.test(p) ? 'p-' + p : p === 'N' ? 'p-N' : p === 'PE' ? 'p-PE' : /^\+/.test(p) ? 'p-24' : p === '0V' ? 'p-0V' : '');
    this.svg.querySelectorAll('.w').forEach((g) => {
      g.classList.remove('live', 'short', 'p-L1', 'p-L2', 'p-L3', 'p-N', 'p-PE', 'p-24', 'p-0V');
      if (!on) return;
      const pots = res.wires[g.dataset.id];
      if (res.shortWires[g.dataset.id]) g.classList.add('live', 'short');
      else if (pots && pots.length) { g.classList.add('live'); const c = potCls(pots.find((p) => p !== 'PE') || pots[0]); if (c) g.classList.add(c); }
    });
    /* זרימה מונפשת רק בלוח קטן: מאות קווים מונפשים מאטים את הדפדפן */
    this.svg.classList.toggle('flow', on && Object.keys(res.wires).length <= 90);
    const st = (res && res.state) || {};
    this.svg.querySelectorAll('.comp').forEach((g) => {
      g.classList.remove('op', 's-on', 's-off', 's-en', 's-trip', 's-fault', 's-lit', 's-run', 'ccw', 's-press', 's-sense');
      if (!on) return;
      const t = g.dataset.tag, o = res.comps[t] || {};
      if (operable && operable.has(t)) g.classList.add('op');
      if (o.on === true) g.classList.add('s-on');
      if (o.on === false) g.classList.add('s-off');
      if (o.energized) g.classList.add('s-en');
      if (o.tripped) g.classList.add('s-trip');
      if (o.fault) g.classList.add('s-fault');
      if (o.lit) g.classList.add('s-lit');
      if (o.running) { g.classList.add('s-run'); if (o.dir === 'שמאלה') g.classList.add('ccw'); }
      if ((st.pressed && st.pressed[t]) || (g.classList.contains('ty-selector') && st.on && st.on[t])) g.classList.add('s-press');
      if (st.sense && st.sense[t]) g.classList.add('s-sense');
    });
  }

  /* אזור בשרטוט (למשל C4) של נקודה */
  zoneOf(x, y) {
    const g = this.grid; if (!g) return '';
    const c = Math.min(g.cols, Math.max(1, Math.floor((x - g.ix) / (g.iw / g.cols)) + 1));
    const r = Math.min(g.rows, Math.max(1, Math.floor((y - g.iy) / (g.ih / g.rows)) + 1));
    return String.fromCharCode(64 + r) + c;
  }

  bind() {
    const svg = this.svg;
    svg.addEventListener('pointerover', (e) => {
      const g = e.target.closest('.w');
      if (g) this.onHover(g.dataset.id, e);
    });
    svg.addEventListener('pointermove', (e) => {
      const g = e.target.closest('.w');
      if (g && e.pointerType === 'mouse') this.onHover(g.dataset.id, e);
    });
    svg.addEventListener('pointerout', (e) => {
      const g = e.target.closest('.w');
      if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) this.onHover(null, e);
    });
    svg.addEventListener('click', (e) => {
      if (this.dragged) return;
      const pn = this.pinMode && e.target.closest('.pn');
      if (pn) { this.onPin && this.onPin(pn.dataset.k); return; }
      const g = e.target.closest('.w');
      if (g) { this.select(g.dataset.id === this.selected ? null : g.dataset.id); return; }
      const c = e.target.closest('.comp');
      if (c) { this.onComp(c.dataset.tag); return; }
      this.select(null);
    });
    if (this.mini) return;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = this.toSvg(e);
      this.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragged = false;
      this.start = { vb: { ...this.vb }, x: e.clientX, y: e.clientY, dist: this.pinchDist() };
    });
    svg.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.start) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = svg.getBoundingClientRect();
      const s = Math.max(this.start.vb.w / r.width, this.start.vb.h / r.height);
      if (this.pointers.size === 2 && this.start.dist) {
        const d = this.pinchDist();
        const k = this.start.dist / d;
        const v = this.start.vb;
        const nw = Math.max(80, Math.min(this.bounds.w * 3, v.w * k));
        const f = nw / v.w;
        this.vb = { x: v.x + v.w * (1 - f) / 2, y: v.y + v.h * (1 - f) / 2, w: nw, h: v.h * f };
        this.dragged = true; this.apply(); return;
      }
      const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        if (!this.dragged) svg.setPointerCapture(e.pointerId);
        this.dragged = true;
      }
      if (this.dragged) { this.vb = { ...this.start.vb, x: this.start.vb.x - dx * s, y: this.start.vb.y - dy * s }; this.apply(); }
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (!this.pointers.size) { this.start = null; setTimeout(() => { this.dragged = false; }, 0); }
      else this.start = { vb: { ...this.vb }, x: [...this.pointers.values()][0].x, y: [...this.pointers.values()][0].y, dist: this.pinchDist() };
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }
  pinchDist() {
    if (this.pointers.size !== 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
