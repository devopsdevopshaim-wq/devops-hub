/* ארון־פלאן — תכנית ההתקנה במבט על: החדר, הארונות (גוררים כדי להזיז, קשת פתיחת הדלת), ותוואי הכבלים.
   יחידות ה-SVG בסנטימטרים. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class SitePlan {
  constructor(host, { onChange, onPick } = {}) {
    this.host = host;
    this.onChange = onChange || (() => {});
    this.onPick = onPick || (() => {});
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'plan-svg');
    host.innerHTML = '';
    host.appendChild(this.svg);
    this.bind();
  }

  render(site, cabs, links, sel) {
    this.site = site; this.cabs = cabs; this.links = links;
    const R = site.room, cm = (m) => Math.round(m * 100);
    const o = [];
    o.push(`<defs><pattern id="pg" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#d3d7d6" stroke-width="1"/></pattern>
      <marker id="pa" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="#5f6870"/></marker></defs>`);
    o.push(`<rect x="0" y="0" width="${cm(R.w)}" height="${cm(R.d)}" fill="url(#pg)" stroke="#2b3035" stroke-width="6"/>`);
    o.push(`<text x="${cm(R.w) / 2}" y="-14" class="pl-dim" text-anchor="middle">${R.w} מ'</text><line x1="0" y1="-30" x2="${cm(R.w)}" y2="-30" class="pl-dl" marker-start="url(#pa)" marker-end="url(#pa)"/>`);
    o.push(`<g transform="translate(-22 ${cm(R.d) / 2}) rotate(-90)"><text class="pl-dim" text-anchor="middle">${R.d} מ'</text></g>`);
    o.push(`<text x="12" y="22" class="pl-wall">קיר אחורי</text>`);
    /* כבלים */
    const pos = {};
    cabs.forEach((c) => { const l = site.layout[c.id]; if (l) pos[c.id] = l; });
    links.forEach((l, i) => {
      const A = pos[l.a.pid], B = pos[l.b.pid]; if (!A || !B) return;
      const off = ((i % 6) - 2.5) * 4;
      const d = `M${cm(A.x) + off} ${cm(A.z)} L${cm(B.x) + off} ${cm(A.z)} L${cm(B.x) + off} ${cm(B.z)}`;
      o.push(`<path d="${d}" class="pl-cable ${l.kind}${sel && sel.lid === l.id ? ' on' : ''}" data-lid="${esc(l.id)}"/>`);
      o.push(`<text x="${(cm(A.x) + cm(B.x)) / 2}" y="${cm(A.z) - 8 + off}" class="pl-cl" text-anchor="middle">W${i + 1}</text>`);
    });
    /* ארונות */
    cabs.forEach((c, i) => {
      const l = pos[c.id]; if (!l) return;
      const rot = l.rot || 0, sw = rot % 180 === 0;
      const w = cm(sw ? c.enc.w / 1000 : c.enc.d / 1000), d = cm(sw ? c.enc.d / 1000 : c.enc.w / 1000);
      const x = cm(l.x) - w / 2, y = cm(l.z) - d / 2;
      /* צד הדלת לפי הסיבוב: 0 = כלפי החדר (למטה בשרטוט) */
      const dw = cm(c.enc.w / 1000);
      const arc = rot === 0 ? `M${x + w} ${y + d} A${dw} ${dw} 0 0 1 ${x} ${y + d + dw}` : rot === 180 ? `M${x} ${y} A${dw} ${dw} 0 0 1 ${x + w} ${y - dw}` : rot === 90 ? `M${x} ${y + d} A${dw} ${dw} 0 0 1 ${x - dw} ${y}` : `M${x + w} ${y} A${dw} ${dw} 0 0 1 ${x + w + dw} ${y + d}`;
      o.push(`<path d="${arc}" class="pl-door"/>`);
      o.push(`<g class="pl-cab${sel && sel.pid === c.id ? ' on' : ''}" data-pid="${esc(c.id)}"><rect x="${x}" y="${y}" width="${w}" height="${d}" rx="3"/>
        <text x="${cm(l.x)}" y="${cm(l.z) + 6}" text-anchor="middle" class="pl-no">${i + 1}</text>
        <text x="${cm(l.x)}" y="${y - 10 - (i % 2) * 18}" text-anchor="middle" class="pl-name">${esc(String(c.name).slice(0, 18))}</text></g>`);
    });
    const pad = 60;
    this.svg.setAttribute('viewBox', `${-pad} ${-pad} ${cm(R.w) + pad * 2} ${cm(R.d) + pad * 2}`);
    this.svg.innerHTML = `<style>
      .pl-dim { font: 600 16px 'IBM Plex Mono', monospace; fill: #3b434b; }
      .pl-dl { stroke: #5f6870; stroke-width: 1.5; }
      .pl-wall { font: 14px 'IBM Plex Sans Hebrew', sans-serif; fill: #7d868e; }
      .pl-cab { cursor: grab; }
      .pl-cab rect { fill: #c3c8c4; stroke: #2b3035; stroke-width: 3; }
      .pl-cab.on rect { fill: #f3e4d6; stroke: #a85a26; stroke-width: 5; }
      .pl-cab .pl-name { font-size: 13px; fill: #3b434b; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
      .pl-cab .pl-no { font-family: 'IBM Plex Mono', monospace; font-size: 17px; }
      .pl-cab text { font: 600 15px 'IBM Plex Sans Hebrew', sans-serif; fill: #1c2126; pointer-events: none; direction: ltr; unicode-bidi: plaintext; }
      .pl-door { fill: none; stroke: #9aa2a8; stroke-width: 2; stroke-dasharray: 6 5; }
      .pl-cable { fill: none; stroke: #7d868e; stroke-width: 5; stroke-linejoin: round; opacity: .8; cursor: pointer; }
      .pl-cable.power { stroke: #1c1c1c; stroke-width: 7; }
      .pl-cable.comm { stroke: #8e44ad; }
      .pl-cable.on { stroke: #c4743a; opacity: 1; stroke-width: 9; }
      .pl-cl { font: 600 13px 'IBM Plex Mono', monospace; fill: #5f6870; }
    </style>` + o.join('');
  }

  bind() {
    const s = this.svg;
    let drag = null;
    const pt = (e) => { const p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(s.getScreenCTM().inverse()); };
    s.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.pl-cab');
      const c = e.target.closest('.pl-cable');
      if (c) { this.onPick(null, c.dataset.lid); return; }
      if (!g) return;
      const p = pt(e), l = this.site.layout[g.dataset.pid];
      drag = { pid: g.dataset.pid, dx: p.x - l.x * 100, dz: p.y - l.z * 100, moved: false };
      s.setPointerCapture(e.pointerId);
    });
    s.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = pt(e), l = this.site.layout[drag.pid];
      /* הצמדה ל-5 ס"מ, ובתוך החדר */
      const snap = (v) => Math.round(v / 5) * 5 / 100;
      const nx = Math.max(0.1, Math.min(this.site.room.w - 0.1, snap(p.x - drag.dx)));
      const nz = Math.max(0.1, Math.min(this.site.room.d - 0.1, snap(p.y - drag.dz)));
      if (nx !== l.x || nz !== l.z) { l.x = nx; l.z = nz; drag.moved = true; this.render(this.site, this.cabs, this.links, { pid: drag.pid }); }
    });
    const up = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved) this.onChange(d.pid); else this.onPick(d.pid, null);
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
  }
}
