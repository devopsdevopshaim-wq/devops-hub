/* 2D floor plan (SVG, 1 unit = 1 m). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  const CAT_CLASS = {
    'ישיבה': 'seat', 'שולחנות': 'table', 'אחסון': 'store', 'חשמל': 'appl', 'טקסטיל': 'rug',
    'תאורה': 'light', 'עיצוב': 'plant', 'מטבח': 'kitchen', 'שינה': 'bed', 'עבודה': 'table',
    'רחצה': 'bath', 'חוץ': 'table', 'גינה': 'table', 'בריכה': 'bath', 'עצים': 'plant'
  };
  const SHORT = {
    sofa3: 'ספה', sofa2: 'ספה', sofaL: 'ספה פינתית', armchair: 'כורסה', coffeeTable: 'שולחן', tvConsole: 'מזנון',
    diningTable: 'שולחן אוכל', bedDouble: 'מיטה זוגית', bedSingle: 'מיטה', bunk: 'קומותיים', wardrobe: 'ארון',
    desk: 'שולחן עבודה', sofaBed: 'ספה נפתחת', dresser: 'קומודה', bookshelf: 'ספרייה', fridge: 'מקרר',
    island: 'אי', bathtub: 'אמבטיה', pool: 'בריכה', deck: 'דק', outdoorSofa: 'ישיבה', outdoorDining: 'אוכל בחוץ', grill: 'גריל', playSet: 'משחקים', sunLounger: '', waterfall: 'מפל', fountain: 'מזרקה', shower: 'מקלחון', outdoorSet: 'פינת ישיבה', washer: 'כביסה',
    shoeCabinet: 'נעליים', vanity: 'כיור', toilet: 'אסלה', kitchenBase: '', cooktop: '', sink: '', dishwasher: 'מדיח'
  };

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f = (v) => Math.round(v * 1000) / 1000;

  function render(svg, plan, opts) {
    const IH = window.IH;
    opts = opts || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const B = plan.bounds || { x0: -0.9, y0: plan.rooms.some((r) => r.outdoor) ? -1.8 : 0, x1: plan.W, y1: plan.D };
    const vx0 = Math.min(-0.9, B.x0 - 0.5), vy0 = Math.min(-0.9, B.y0 - 0.7);
    const vb = [vx0, vy0, Math.max(plan.W + 0.9, B.x1 + 0.9) - vx0, Math.max(plan.D + 0.9, B.y1 + 0.9) - vy0];
    svg.setAttribute('viewBox', vb.map(f).join(' '));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `תוכנית דירה ${plan.W.toFixed(1)} על ${plan.D.toFixed(1)} מטר`);

    const gFloor = el('g', { class: 'fp-floors' }, svg);
    const gItems = el('g', { class: 'fp-items' }, svg);
    const gWalls = el('g', { class: 'fp-walls' }, svg);
    const gLabels = el('g', { class: 'fp-labels' }, svg);
    const gDims = el('g', { class: 'fp-dims' }, svg);

    // plot: ground, house footprint shadow and boundary walls
    if (plan.yard) {
      const y = plan.yard;
      el('rect', { x: f(y.x0), y: f(y.y0), width: f(y.x1 - y.x0), height: f(y.y1 - y.y0), class: 'fp-ground fp-ground-' + y.ground }, gFloor);
      el('rect', { x: -0.1, y: -0.1, width: f(plan.W + 0.2), height: f(plan.D + 0.2), class: 'fp-house' }, gFloor);
      y.walls.forEach((w) => el('line', { x1: f(w.x1), y1: f(w.y1), x2: f(w.x2), y2: f(w.y2), class: 'fp-plotwall' }, gWalls));
    }

    // floors
    plan.rooms.forEach((r) => {
      if (r.yard) return;
      const kind = r.outdoor ? 'deck' : ['bath', 'wc', 'ensuite', 'utility'].includes(r.kind) ? 'wet' : ['kitchen', 'corridor'].includes(r.kind) || plan.style.floorKind !== 'wood' ? 'tile' : 'wood';
      el('rect', { x: f(r.x), y: f(r.y), width: f(r.w), height: f(r.d), class: 'fp-floor fp-floor-' + kind, 'data-room': r.id }, gFloor);
    });

    // furniture (rugs first, uppers last)
    const order = (it) => (it.type === 'rug' ? 0 : it.z >= 1 ? 2 : 1);
    plan.items.slice().sort((a, b) => order(a) - order(b)).forEach((it) => {
      const c = IH.CATALOG[it.type] || {};
      const g = el('g', { class: 'fp-item cat-' + (CAT_CLASS[c.cat] || 'store') + (it.z >= 1 ? ' is-upper' : '') + (it.type === 'rug' ? ' is-rug' : ''), 'data-id': it.id, tabindex: '0' }, gItems);
      el('title', {}, g).textContent = (c.name || it.type) + (it.note ? ' · ' + it.note : '');
      drawItem(g, it);
      if (opts.selected === it.id) g.classList.add('is-selected');
      const label = SHORT[it.type];
      const minSide = Math.min(it.w, it.d);
      const size = 0.15;
      if (label && minSide >= 0.38 && Math.max(it.w, it.d) >= label.length * size * 0.55 && it.type !== 'rug' && it.z < 1) {
        const vertical = it.d > it.w * 1.3 && it.w < label.length * size * 0.55;
        const t = el('text', { x: f(it.x + it.w / 2), y: f(it.y + it.d / 2), class: 'fp-item-label', 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
        if (vertical) t.setAttribute('transform', `rotate(-90 ${f(it.x + it.w / 2)} ${f(it.y + it.d / 2)})`);
        t.textContent = label;
      }
    });

    // kitchen work triangle
    if (plan.triangle && opts.triangle !== false) {
      el('polygon', { points: plan.triangle.pts.map((p) => f(p.x) + ',' + f(p.y)).join(' '), class: 'fp-triangle' }, gItems);
    }

    // walls
    plan.segs.forEach((s) => drawWall(gWalls, s));

    // room labels
    plan.rooms.forEach((r) => {
      if (r.kind === 'corridor') return;
      const cx = r.x + r.w / 2;
      let cy = r.y + r.d / 2;
      const occ = plan.items.filter((it) => it.room === r.id && it.type !== 'rug' && it.z < 1);
      // nudge the label to the emptiest band of the room
      const bands = [0.5, 0.3, 0.7, 0.2, 0.8].map((t) => r.y + r.d * t);
      const free = bands.find((y) => !occ.some((it) => y > it.y - 0.2 && y < it.y + it.d + 0.2 && cx > it.x - 0.6 && cx < it.x + it.w + 0.6));
      if (free !== undefined) cy = free;
      const g = el('g', { class: 'fp-room-label' }, gLabels);
      const t1 = el('text', { x: f(cx), y: f(cy - 0.05), 'font-size': 0.22, 'text-anchor': 'middle', class: 'fp-room-name' }, g);
      t1.textContent = r.name;
      const t2 = el('text', { x: f(cx), y: f(cy + 0.22), 'font-size': 0.16, 'text-anchor': 'middle', class: 'fp-room-area' }, g);
      t2.textContent = `${(r.w * r.d).toFixed(1)} מ״ר`;
    });

    // overall dimensions
    dim(gDims, 0, plan.D + 0.45, plan.W, plan.D + 0.45, `${plan.W.toFixed(2)} מ׳`);
    dim(gDims, plan.W + 0.45, 0, plan.W + 0.45, plan.D, `${plan.D.toFixed(2)} מ׳`, true);
    // scale bar
    const sb = el('g', { class: 'fp-scale' }, gDims);
    el('rect', { x: -0.6, y: f(plan.D + 0.35), width: 1, height: 0.06 }, sb);
    const st = el('text', { x: -0.1, y: f(plan.D + 0.65), 'font-size': 0.15, 'text-anchor': 'middle' }, sb);
    st.textContent = '1 מ׳';

    svg.onclick = (e) => {
      const g = e.target.closest && e.target.closest('.fp-item');
      if (g && opts.onSelect) opts.onSelect(g.getAttribute('data-id'));
    };
    svg.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest && e.target.closest('.fp-item');
      if (g && opts.onSelect) { e.preventDefault(); opts.onSelect(g.getAttribute('data-id')); }
    };
  }

  function dim(g, x1, y1, x2, y2, label, vertical) {
    el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: 'fp-dim-line' }, g);
    const tick = 0.12;
    [[x1, y1], [x2, y2]].forEach(([x, y]) => el('line', { x1: f(x - tick), y1: f(y + tick), x2: f(x + tick), y2: f(y - tick), class: 'fp-dim-tick' }, g));
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const t = el('text', { x: f(cx), y: f(cy - 0.08), 'font-size': 0.2, 'text-anchor': 'middle', class: 'fp-dim-text' }, g);
    if (vertical) t.setAttribute('transform', `rotate(-90 ${f(cx - 0.08)} ${f(cy)})`);
    t.textContent = label;
  }

  function drawWall(g, s) {
    const horiz = s.y1 === s.y2;
    const len = horiz ? s.x2 - s.x1 : s.y2 - s.y1;
    const th = s.ext ? 0.2 : 0.1;
    const P = (t, off) => horiz ? [s.x1 + t, s.y1 + (off || 0)] : [s.x1 + (off || 0), s.y1 + t];
    let t = 0;
    const pieces = [];
    s.open.forEach((o) => {
      if (o.t0 > t) pieces.push([t, o.t0]);
      t = Math.max(t, o.t1);
    });
    if (t < len) pieces.push([t, len]);
    pieces.forEach(([a, b]) => {
      const [x1, y1] = P(a - (a === 0 ? th / 2 : 0));
      const [x2, y2] = P(b + (b === len ? th / 2 : 0));
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: 'fp-wall' + (s.ext ? ' is-ext' : ''), 'stroke-width': th }, g);
    });
    s.open.forEach((o) => {
      const w = o.t1 - o.t0;
      if (o.type === 'window' || o.type === 'slider') {
        const off = th / 2 - 0.03;
        [-off, 0, off].forEach((k, i) => {
          const [x1, y1] = P(o.t0, k), [x2, y2] = P(o.t1, k);
          el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: i === 1 ? 'fp-glass' : 'fp-frame' }, g);
        });
        const [a1, b1] = P(o.t0, -th / 2), [a2, b2] = P(o.t0, th / 2);
        const [c1, d1] = P(o.t1, -th / 2), [c2, d2] = P(o.t1, th / 2);
        el('line', { x1: f(a1), y1: f(b1), x2: f(a2), y2: f(b2), class: 'fp-frame' }, g);
        el('line', { x1: f(c1), y1: f(d1), x2: f(c2), y2: f(d2), class: 'fp-frame' }, g);
        if (o.type === 'slider') {
          const [s1, t1] = P(o.t0, -0.03), [s2, t2] = P(o.t0 + w * 0.55, -0.03);
          const [s3, t3] = P(o.t0 + w * 0.45, 0.03), [s4, t4] = P(o.t1, 0.03);
          el('line', { x1: f(s1), y1: f(t1), x2: f(s2), y2: f(t2), class: 'fp-leaf' }, g);
          el('line', { x1: f(s3), y1: f(t3), x2: f(s4), y2: f(t4), class: 'fp-leaf' }, g);
        }
        return;
      }
      // hinged door: leaf + swing arc
      const into = o.into || (horiz ? 'S' : 'E');
      const sign = into === 'S' || into === 'E' ? 1 : -1;
      const hingeT = o.hinge === 'end' ? o.t1 : o.t0;
      const freeT = o.hinge === 'end' ? o.t0 : o.t1;
      const [hx, hy] = P(hingeT);
      const [fx, fy] = P(freeT);
      const [lx, ly] = horiz ? [hx, hy + sign * w] : [hx + sign * w, hy];
      el('line', { x1: f(hx), y1: f(hy), x2: f(lx), y2: f(ly), class: 'fp-leaf' }, g);
      // sweep direction: cross product of (free - hinge) and (leaf - hinge)
      const cross = (fx - hx) * (ly - hy) - (fy - hy) * (lx - hx);
      el('path', { d: `M${f(fx)} ${f(fy)} A${f(w)} ${f(w)} 0 0 ${cross > 0 ? 1 : 0} ${f(lx)} ${f(ly)}`, class: 'fp-swing' }, g);
    });
  }

  function drawItem(g, it) {
    const { x, y, w, d, face } = it;
    const R = (xx, yy, ww, dd, cls, extra) => el('rect', Object.assign({ x: f(xx), y: f(yy), width: f(Math.max(ww, 0.01)), height: f(Math.max(dd, 0.01)), class: cls }, extra || {}), g);
    // "back" strip on the side opposite the face
    const back = (t) => {
      if (face === 'S') return R(x, y, w, t, 'fp-back');
      if (face === 'N') return R(x, y + d - t, w, t, 'fp-back');
      if (face === 'E') return R(x, y, t, d, 'fp-back');
      return R(x + w - t, y, t, d, 'fp-back');
    };
    const G = (cls, extra) => R(x, y, w, d, cls, extra);
    switch (it.type) {
      case 'lawn': case 'gravel':
        return;
      case 'deck':
        G('fp-deck');
        for (let yy = y + 0.14; yy < y + d; yy += 0.14) el('line', { x1: f(x), y1: f(yy), x2: f(x + w), y2: f(yy), class: 'fp-detail' }, g);
        return;
      case 'pergola':
        G('fp-upper');
        for (let xx = x + 0.5; xx < x + w; xx += 0.5) el('line', { x1: f(xx), y1: f(y), x2: f(xx), y2: f(y + d), class: 'fp-pergola' }, g);
        return;
      case 'poolDeck': G('fp-paving'); return;
      case 'pool':
        G('fp-pool', { rx: 0.1 });
        R(x + 0.12, y + 0.12, w - 0.24, d - 0.24, 'fp-pool-water', { rx: 0.08 });
        return;
      case 'waterfall': case 'fountain': G('fp-stone', { rx: 0.05 }); R(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 'fp-pool-water'); return;
      case 'oliveTree': case 'citrusTree': case 'palmTree': {
        const cx = x + w / 2, cy = y + d / 2, rr = Math.min(w, d) / 2;
        el('circle', { cx: f(cx), cy: f(cy), r: f(rr * (it.type === 'palmTree' ? 1.2 : 1.35)), class: 'fp-canopy fp-canopy-' + it.type }, g);
        el('circle', { cx: f(cx), cy: f(cy), r: 0.09, class: 'fp-trunk' }, g);
        return;
      }
      case 'planterBed': {
        G('fp-bed', { rx: 0.05 });
        const cols = it.colors || ['#7a9a5a'];
        let k = 0;
        for (let yy = y + 0.3; yy < y + d - 0.2; yy += 0.45) {
          el('circle', { cx: f(x + w / 2 + ((k % 2) ? 0.15 : -0.15)), cy: f(yy), r: 0.2, fill: cols[k % cols.length], class: 'fp-shrub' }, g);
          k++;
        }
        return;
      }
      case 'path':
        for (let yy = y + 0.1; yy < y + d - 0.3; yy += 0.65) R(x + 0.1, yy, w - 0.2, 0.45, 'fp-stone', { rx: 0.06 });
        return;
      case 'gardenLight': case 'irrigation':
        el('circle', { cx: f(x + w / 2), cy: f(y + d / 2), r: 0.1, class: 'fp-light' }, g);
        return;
      case 'playSet': G('fp-shape'); el('line', { x1: f(x), y1: f(y), x2: f(x + w), y2: f(y + d), class: 'fp-detail' }, g); return;
      case 'rug':
        R(x, y, w, d, 'fp-shape fp-rug', { rx: 0.04 });
        break;
      case 'kitchenUpper':
      case 'hood':
        R(x, y, w, d, 'fp-upper');
        break;
      case 'pendant':
        el('circle', { cx: f(x + w / 2), cy: f(y + d / 2), r: f(w / 2), class: 'fp-upper' }, g);
        break;
      case 'tv':
        R(x, y, w, d, 'fp-tv');
        break;
      case 'cooktop':
        R(x, y, w, d, 'fp-shape');
        [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([a, b]) => el('circle', { cx: f(x + w * a), cy: f(y + d * b), r: f(Math.min(w, d) * 0.14), class: 'fp-detail' }, g));
        break;
      case 'sink':
        R(x, y, w, d, 'fp-shape');
        R(x + w * 0.18, y + d * 0.18, w * 0.64, d * 0.64, 'fp-detail', { rx: 0.06 });
        break;
      case 'toilet': {
        R(x, y, w, d, 'fp-shape', { rx: 0.08 });
        el('ellipse', { cx: f(x + w / 2), cy: f(y + d / 2), rx: f(w * 0.3), ry: f(d * 0.3), class: 'fp-detail' }, g);
        break;
      }
      case 'bathtub':
        R(x, y, w, d, 'fp-shape');
        R(x + 0.07, y + 0.07, w - 0.14, d - 0.14, 'fp-detail', { rx: 0.2 });
        break;
      case 'shower':
        R(x, y, w, d, 'fp-shape');
        el('line', { x1: f(x), y1: f(y), x2: f(x + w), y2: f(y + d), class: 'fp-detail' }, g);
        el('line', { x1: f(x + w), y1: f(y), x2: f(x), y2: f(y + d), class: 'fp-detail' }, g);
        break;
      case 'diningTable':
      case 'coffeeTable':
      case 'sideTable':
      case 'desk':
      case 'island':
        R(x, y, w, d, 'fp-shape', { rx: it.type === 'coffeeTable' ? 0.08 : 0.02 });
        break;
      case 'plant':
      case 'floorLamp':
      case 'stool':
        el('circle', { cx: f(x + w / 2), cy: f(y + d / 2), r: f(Math.min(w, d) / 2), class: 'fp-shape' }, g);
        if (it.type === 'plant') el('circle', { cx: f(x + w / 2), cy: f(y + d / 2), r: f(Math.min(w, d) / 4), class: 'fp-detail' }, g);
        break;
      case 'bedDouble':
      case 'bedSingle':
      case 'bunk': {
        R(x, y, w, d, 'fp-shape', { rx: 0.03 });
        // pillows at the head (the back side)
        const n = it.type === 'bedDouble' ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n;
          if (face === 'W') R(x + w - 0.42, y + d * k - d / n * 0.4, 0.3, d / n * 0.8, 'fp-detail', { rx: 0.05 });
          else if (face === 'E') R(x + 0.12, y + d * k - d / n * 0.4, 0.3, d / n * 0.8, 'fp-detail', { rx: 0.05 });
          else if (face === 'N') R(x + w * k - w / n * 0.4, y + d - 0.42, w / n * 0.8, 0.3, 'fp-detail', { rx: 0.05 });
          else R(x + w * k - w / n * 0.4, y + 0.12, w / n * 0.8, 0.3, 'fp-detail', { rx: 0.05 });
        }
        // duvet fold line
        if (face === 'W') el('line', { x1: f(x + w * 0.55), y1: f(y), x2: f(x + w * 0.55), y2: f(y + d), class: 'fp-detail' }, g);
        if (face === 'E') el('line', { x1: f(x + w * 0.45), y1: f(y), x2: f(x + w * 0.45), y2: f(y + d), class: 'fp-detail' }, g);
        if (face === 'N') el('line', { x1: f(x), y1: f(y + d * 0.55), x2: f(x + w), y2: f(y + d * 0.55), class: 'fp-detail' }, g);
        if (face === 'S') el('line', { x1: f(x), y1: f(y + d * 0.45), x2: f(x + w), y2: f(y + d * 0.45), class: 'fp-detail' }, g);
        break;
      }
      case 'sofa2': case 'sofa3': case 'sofaL': case 'armchair': case 'sofaBed': case 'chair': case 'officeChair':
        R(x, y, w, d, 'fp-shape', { rx: 0.05 });
        back(it.type === 'chair' || it.type === 'officeChair' ? 0.1 : 0.2);
        (it.parts || []).forEach((p) => R(p.x, p.y, p.w, p.d, 'fp-shape', { rx: 0.05 }));
        break;
      default:
        R(x, y, w, d, 'fp-shape');
        if (['wardrobe', 'tvConsole', 'kitchenBase', 'dresser', 'bookshelf', 'shoeCabinet', 'fridge', 'washer', 'dishwasher', 'vanity', 'nightstand'].includes(it.type)) back(0.05);
    }
  }

  window.IH = window.IH || {};
  window.IH.renderPlan = render;
})();
