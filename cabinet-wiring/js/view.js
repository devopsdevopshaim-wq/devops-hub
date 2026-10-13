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
  .t-name.dim { fill: #b9c3cf; }
  .t-motor { font-size: 34px; fill: #e8edf4; font-weight: 800; }
  .t-term { font-size: 4.2px; fill: #20252c; dominant-baseline: middle; }
  .t-pin { font-size: 5px; fill: #20252c; font-weight: 700; paint-order: stroke; stroke: #e7ebef; stroke-width: 1.4px; }
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
  .comp.end > rect:first-of-type, .comp.end > circle:first-of-type { stroke: #e0904f; stroke-width: 3px; }
`;

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
  constructor(host, { onHover, onSelect, onComp, mini = false } = {}) {
    this.host = host;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onComp = onComp || (() => {});
    this.mini = mini;
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
    });
    out.push('</g>');
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
      out.push(`<g class="comp" data-tag="${esc(b.tag)}" tabindex="-1"><title>${esc(b.tag)} — ${name}</title>`);
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
        out.push(`<circle cx="${pn.x}" cy="${pn.y}" r="1.7" class="pin"/><text x="${tx}" y="${ty}" class="t-pin" text-anchor="${pn.side === 'left' ? 'end' : 'middle'}">${esc(term)}</text>`);
      });
      out.push('</g>');
    }
    this.svg.innerHTML = out.join('');
    this.bounds = { x: -30, y: -30, w: L.bounds.w + 60, h: L.bounds.h + 60 };
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
    this.svg.querySelectorAll('.w').forEach((g) => { g.style.display = !visibleSet || visibleSet.has(g.dataset.id) ? '' : 'none'; });
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
