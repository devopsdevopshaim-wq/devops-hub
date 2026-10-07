/* Design editing on top of the planned home: swap a piece for a real product, add products from the
   catalog, move, turn, duplicate or remove pieces. The site's plan stays the starting point; the
   user's changes are kept per set of requirements (so changing the brief and coming back restores
   them) and replayed on the plan after every planning run. */
(function () {
  'use strict';
  const IH = window.IH;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const app = () => IH.app;
  const esc = (s) => app().esc(s);
  const money = (n) => app().money(n);
  const STORE_KEY = 'matar.edits.v2';
  const R = (v) => Math.round(v * 100) / 100;

  /* ---------- storage ---------- */
  let store = {};
  try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { store = {}; }
  function persist() {
    try {
      const keys = Object.keys(store);
      if (keys.length > 8) keys.slice(0, keys.length - 8).forEach((k) => delete store[k]);
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) { /* storage full or blocked: edits live for this visit */ }
  }
  // the requirements that shape the plan; style, budget and region only restyle it
  const GEOMETRY = ['home', 'area', 'rooms', 'custom', 'roomList', 'adults', 'kids', 'mamad', 'balcony', 'office', 'kitchen', 'seats', 'yard', 'gardenStyle', 'pool', 'water', 'pergola', 'grill'];
  function briefKey() { const st = app().state; return JSON.stringify(GEOMETRY.map((k) => (k === 'roomList' && !st.custom ? null : st[k]))); }
  function cur() { const k = briefKey(); return store[k] || (store[k] = { items: {}, n: 0 }); }
  let undo = [];
  let editing = false;

  // replay the user's changes on a fresh plan
  function apply(plan) {
    const e = cur();
    const ids = Object.keys(e.items);
    if (!ids.length) { plan.edited = 0; return plan; }
    plan.items = plan.items.filter((it) => e.items[it.id] !== null);
    plan.items.forEach((it) => { const s = e.items[it.id]; if (s) Object.assign(it, clone(s)); });
    ids.forEach((id) => { const s = e.items[id]; if (s && s.added && !plan.items.some((it) => it.id === id)) plan.items.push(clone(s)); });
    plan.edited = ids.length;
    return plan;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const FIELDS = ['id', 'type', 'room', 'x', 'y', 'w', 'd', 'face', 'z', 'h', 'note', 'len', 'area', 'parts', 'product', 'added', 'wall'];
  function snap(it) { const o = {}; FIELDS.forEach((k) => { if (it[k] !== undefined) o[k] = it[k]; }); return clone(o); }

  function commit(fn, keepId) {
    undo.push(JSON.stringify(cur()));
    if (undo.length > 40) undo.shift();
    fn(cur());
    persist();
    app().rerun(keepId);
    renderBar();
  }
  const itemById = (id) => app().plan.items.find((x) => x.id === id);

  /* ---------- geometry helpers ---------- */
  function bounds() {
    const p = app().plan;
    return p.bounds || { x0: 0, y0: p.rooms.some((r) => r.outdoor) ? -1.8 : 0, x1: p.W, y1: p.D };
  }
  function roomAt(x, y, prefer) {
    const rooms = app().plan.rooms.filter((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d);
    if (prefer && rooms.some((r) => r.id === prefer)) return prefer;
    const r = rooms.find((rm) => rm.kind !== 'corridor' && !rm.yard) || rooms[0];
    return r ? r.id : prefer;
  }
  function shift(it, dx, dy) {
    const B = bounds();
    dx = Math.max(B.x0 - it.x, Math.min(B.x1 - it.x - it.w, dx));
    dy = Math.max(B.y0 - it.y, Math.min(B.y1 - it.y - it.d, dy));
    it.x = R(it.x + dx); it.y = R(it.y + dy);
    (it.parts || []).forEach((p) => { p.x = R(p.x + dx); p.y = R(p.y + dy); });
    it.room = roomAt(it.x + it.w / 2, it.y + it.d / 2, it.room);
  }
  const TURN = { S: 'W', W: 'N', N: 'E', E: 'S' };
  // a quarter turn clockwise around the piece's centre (plan y points down)
  function turn(it) {
    const cx = it.x + it.w / 2, cy = it.y + it.d / 2;
    const rot = (r) => {
      const px = r.x + r.w / 2 - cx, py = r.y + r.d / 2 - cy;
      const nx = cx - py, ny = cy + px;
      const w = r.w; r.w = r.d; r.d = w;
      r.x = R(nx - r.w / 2); r.y = R(ny - r.d / 2);
    };
    rot(it);
    (it.parts || []).forEach(rot);
    it.face = TURN[it.face || 'S'];
  }
  // world footprint of a product facing a direction
  function footprint(prod, type, face) {
    const D = DIMS[type] || [1, 1, 1];
    const w = prod && prod.w ? prod.w : D[0], d = prod && prod.d ? prod.d : D[1];
    const side = face === 'E' || face === 'W';
    return side ? { w: d, d: w } : { w, d };
  }
  // corner sofas: the main seat runs the width, the chaise sits in front of one end
  function chaise(it, depth) {
    const main = 0.95, cd = Math.max(0.5, depth - main);
    const f = it.face || 'S';
    if (f === 'S') { it.parts = [{ x: it.x, y: R(it.y + main), w: 0.9, d: R(cd) }]; it.d = main; }
    else if (f === 'N') { it.parts = [{ x: R(it.x + it.w - 0.9), y: R(it.y - cd + (it.d - main)), w: 0.9, d: R(cd) }]; it.y = R(it.y + it.d - main); it.d = main; }
    else if (f === 'E') { it.parts = [{ x: R(it.x + main), y: R(it.y + it.d - 0.9), w: R(cd), d: 0.9 }]; it.w = main; }
    else { it.parts = [{ x: R(it.x + it.w - main - cd), y: it.y, w: R(cd), d: 0.9 }]; it.x = R(it.x + it.w - main); it.w = main; }
  }
  // default sizes (width, depth, height) and heights off the floor for pieces added from the catalog
  const DIMS = {
    sofa3: [2.2, 0.95, 0.85], sofa2: [1.8, 0.9, 0.85], sofaL: [2.8, 1.65, 0.85], sofaBed: [2.1, 1.0, 0.85], armchair: [0.8, 0.85, 0.8],
    coffeeTable: [1.1, 0.6, 0.42], sideTable: [0.5, 0.5, 0.55], diningTable: [1.6, 0.9, 0.75], desk: [1.2, 0.6, 0.75],
    chair: [0.48, 0.52, 0.85], officeChair: [0.62, 0.6, 1.2], stool: [0.4, 0.4, 0.65], bedDouble: [1.7, 2.1, 0.9],
    bedSingle: [1.0, 2.05, 0.8], bunk: [1.0, 2.05, 1.6], nightstand: [0.45, 0.4, 0.55], dresser: [1.0, 0.5, 0.8],
    wardrobe: [1.5, 0.6, 2.2], bookshelf: [0.8, 0.3, 1.8], tvConsole: [1.8, 0.42, 0.45], rug: [2.4, 1.7, 0.01],
    floorLamp: [0.4, 0.4, 1.6], pendant: [0.5, 0.5, 0.35], plant: [0.5, 0.5, 1.2]
  };
  const Z = { pendant: 1.55 };

  /* ---------- operations ---------- */
  function move(id, dx, dy) {
    const it = itemById(id);
    if (!it) return;
    commit((e) => { const s = snap(it); shift(s, dx, dy); e.items[id] = s; }, id);
  }
  function rotate(id) {
    const it = itemById(id);
    if (!it) return;
    commit((e) => { const s = snap(it); turn(s); const B = bounds(); shift(s, Math.max(0, B.x0 - s.x), Math.max(0, B.y0 - s.y)); e.items[id] = s; }, id);
  }
  function remove(id) {
    const it = itemById(id);
    if (!it) return;
    commit((e) => { if (it.added) delete e.items[id]; else e.items[id] = null; });
  }
  function duplicate(id) {
    const it = itemById(id);
    if (!it) return;
    commit((e) => {
      const s = snap(it);
      s.id = 'u' + (++e.n);
      s.added = true;
      const spot = freeSpot(it.room, s.w, s.d, it.face, [it]) || { x: it.x + 0.2, y: it.y + 0.2 };
      const dx = spot.x - s.x, dy = spot.y - s.y;
      s.x = R(spot.x); s.y = R(spot.y);
      (s.parts || []).forEach((p) => { p.x = R(p.x + dx); p.y = R(p.y + dy); });
      e.items[s.id] = s;
    }, null);
  }
  function choose(id, pid) {
    const it = itemById(id), prod = IH.PRODUCT_BY_ID[pid];
    if (!it || !prod) return;
    commit((e) => {
      const s = snap(it);
      const cx = s.x + s.w / 2, cy = s.y + s.d / 2;
      const wasL = s.type === 'sofaL';
      s.type = prod.type;
      s.product = pid;
      if (prod.w && prod.d) {
        const fp = footprint(prod, prod.type, s.face);
        s.w = R(fp.w); s.d = R(fp.d);
        s.x = R(cx - s.w / 2); s.y = R(cy - s.d / 2);
        if (prod.h && !['pendant', 'rug'].includes(prod.type)) s.h = prod.h;
        delete s.parts;
        if (prod.type === 'sofaL') chaise(s, prod.d);
      } else if (wasL && prod.type !== 'sofaL') delete s.parts;
      s.room = roomAt(cx, cy, s.room);
      e.items[id] = s;
    }, id);
  }
  // add a product (or a plain piece of a type) to a room, at the first free place along a wall
  function add(pid, type, roomId) {
    const prod = pid ? IH.PRODUCT_BY_ID[pid] : null;
    type = prod ? prod.type : type;
    const D = DIMS[type] || [1, 1, 1];
    const room = app().plan.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    let placed = null;
    commit((e) => {
      const id = 'u' + (++e.n);
      let spot = null;
      for (const face of ['S', 'N', 'E', 'W']) {
        const fp = footprint(prod, type, face);
        spot = freeSpot(roomId, fp.w, fp.d, face);
        if (spot) { spot.face = face; spot.w = fp.w; spot.d = fp.d; break; }
      }
      if (!spot) { const fp = footprint(prod, type, 'S'); spot = { x: room.x + room.w / 2 - fp.w / 2, y: room.y + room.d / 2 - fp.d / 2, face: 'S', w: fp.w, d: fp.d }; }
      const s = { id, type, room: roomId, x: R(spot.x), y: R(spot.y), w: R(spot.w), d: R(spot.d), face: spot.face, z: Z[type] || 0, h: (prod && prod.h) || D[2], added: true };
      if (prod) s.product = pid;
      if (type === 'sofaL') chaise(s, prod && prod.d ? prod.d : D[1]);
      e.items[id] = s;
      placed = id;
    }, null);
    if (placed) setTimeout(() => app().show(placed), 60);
    return placed;
  }
  // first free rectangle in a room: backs against a wall for the given face, then anywhere
  function freeSpot(roomId, w, d, face, ignore) {
    const p = app().plan, room = p.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    const solid = p.items.filter((it) => it.type !== 'rug' && !(it.z >= 1) && !['pendant', 'kitchenUpper', 'hood', 'tv', 'lawn', 'gravel', 'irrigation'].includes(it.type) && !(ignore || []).includes(it));
    const rects = [];
    solid.forEach((it) => { rects.push(it); (it.parts || []).forEach((q) => rects.push(q)); });
    const free = (x, y) => x >= room.x - 1e-6 && y >= room.y - 1e-6 && x + w <= room.x + room.w + 1e-6 && y + d <= room.y + room.d + 1e-6 &&
      !rects.some((r) => x < r.x + r.w + 0.08 && r.x < x + w + 0.08 && y < r.y + r.d + 0.08 && r.y < y + d + 0.08);
    const step = 0.1;
    const wallY = { S: room.y + 0.02, N: room.y + room.d - d - 0.02 };
    const wallX = { E: room.x + 0.02, W: room.x + room.w - w - 0.02 };
    if (wallY[face] !== undefined) for (let x = room.x + 0.05; x + w <= room.x + room.w; x += step) if (free(x, wallY[face])) return { x, y: wallY[face] };
    if (wallX[face] !== undefined) for (let y = room.y + 0.05; y + d <= room.y + room.d; y += step) if (free(wallX[face], y)) return { x: wallX[face], y };
    for (let y = room.y + 0.3; y + d <= room.y + room.d - 0.2; y += step) for (let x = room.x + 0.3; x + w <= room.x + room.w - 0.2; x += step) if (free(x, y)) return { x, y };
    return null;
  }
  function doUndo() {
    if (!undo.length) return;
    store[briefKey()] = JSON.parse(undo.pop());
    persist();
    app().rerun(null);
    renderBar();
  }
  function reset() {
    if (!Object.keys(cur().items).length) return;
    if (!confirm('לחזור לעיצוב שהאתר הציע ולמחוק את כל השינויים שלכם?')) return;
    commit((e) => { e.items = {}; e.n = 0; });
  }

  /* ---------- the item's action row (item card and the card inside the tour) ---------- */
  function actionsHtml(it) {
    if (!it || !IH.CATALOG[it.type]) return '';
    const n = productsFor(it.type).length;
    return `<div class="ed-acts" data-item="${it.id}">
      <button type="button" class="btn btn-small" data-ed="swap">החלפה במוצר אחר${n ? ` <span class="ed-count">${n}</span>` : ''}</button>
      <span class="ed-nudge" role="group" aria-label="הזזה">
        <button type="button" data-ed="up" aria-label="הזזה למעלה בתוכנית">↑</button><button type="button" data-ed="down" aria-label="הזזה למטה בתוכנית">↓</button><button type="button" data-ed="right" aria-label="הזזה ימינה">→</button><button type="button" data-ed="left" aria-label="הזזה שמאלה">←</button>
      </span>
      <button type="button" class="btn btn-small btn-ghost" data-ed="rotate">סיבוב 90°</button>
      <button type="button" class="btn btn-small btn-ghost" data-ed="dup">שכפול</button>
      <button type="button" class="btn btn-small btn-ghost ed-del" data-ed="del">מחיקה</button>
    </div>`;
  }
  function productsFor(type) {
    const group = IH.swapGroup(type);
    return IH.PRODUCT_DB.filter((p) => group.includes(p.type));
  }

  /* ---------- the bar above the stage ---------- */
  function renderBar() {
    const bar = $('#edit-bar');
    if (!bar || !app().plan) return;
    const n = Object.keys(cur().items).length;
    bar.hidden = !editing;
    $('#btn-edit').setAttribute('aria-pressed', String(editing));
    $('#btn-edit').classList.toggle('is-on', editing);
    $('#ed-n').textContent = n ? `${n} שינויים שלכם` : 'העיצוב של האתר, בלי שינויים';
    $('#ed-undo').disabled = !undo.length;
    $('#ed-reset').disabled = !n;
    document.body.classList.toggle('is-editing', editing);
  }
  function setEditing(on) {
    editing = on;
    renderBar();
    app().rerender();
  }

  /* ---------- catalog window ---------- */
  let catMode = null; // { kind: 'swap', id } | { kind: 'add' }
  function openCatalog(mode) {
    catMode = mode;
    const dlg = $('#catalog-dlg');
    const it = mode.kind === 'swap' ? itemById(mode.id) : null;
    const types = it ? IH.swapGroup(it.type) : null;
    $('#cat-title').textContent = it ? `החלפת ${IH.CATALOG[it.type].name}` : 'הוספת פריט מהקטלוג';
    $('#cat-sub').textContent = it ? `${app().roomName(it.room)} · מוצרים אמיתיים מכמה חנויות. בחירה מחליפה את הפריט בתוכנית, בתלת-ממד ובתקציב.` : 'בוחרים חדר ומוצר. הפריט נכנס למקום פנוי בחדר, ואפשר להזיז אותו אחר כך.';
    // sections: the swap group, or every section for adding
    const sections = types ? [[null, types]] : IH.ADD_SECTIONS;
    $('#cat-tabs').innerHTML = types ? '' : sections.map(([name], i) => `<button type="button" role="tab" data-cat-tab="${i}" aria-selected="${i === 0}">${esc(name)}</button>`).join('');
    $('#cat-room-row').hidden = !!types;
    if (!types) {
      const rooms = app().plan.rooms.filter((r) => r.kind !== 'corridor' && !r.yard);
      const sel = $('#cat-room');
      const pick = (app().selected && itemById(app().selected)) ? itemById(app().selected).room : (rooms.find((r) => r.kind === 'living') || rooms[0]).id;
      sel.innerHTML = rooms.map((r) => `<option value="${r.id}"${r.id === pick ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
    }
    const stores = [...new Set(IH.PRODUCT_DB.map((p) => p.seller))].filter((s) => IH.STORES[s]);
    $('#cat-store').innerHTML = '<option value="">כל החנויות</option>' + stores.map((s) => `<option value="${s}">${esc(IH.STORES[s].name)}</option>`).join('');
    $('#cat-sort').value = 'price';
    dlg.dataset.section = '0';
    renderCatalog();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function renderCatalog() {
    const dlg = $('#catalog-dlg');
    const it = catMode.kind === 'swap' ? itemById(catMode.id) : null;
    const types = it ? IH.swapGroup(it.type) : IH.ADD_SECTIONS[+dlg.dataset.section || 0][1];
    const store = $('#cat-store').value, sort = $('#cat-sort').value;
    let list = IH.PRODUCT_DB.filter((p) => types.includes(p.type) && (!store || p.seller === store) && IH.CATALOG[p.type]);
    list.sort((a, b) => sort === 'price' ? (a.price || 1e9) - (b.price || 1e9) : sort === 'style' ? (b.tags.includes(app().state.style) ? 1 : 0) - (a.tags.includes(app().state.style) ? 1 : 0) : 0);
    $$('[data-cat-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.catTab === dlg.dataset.section)));
    const plain = types.filter((t) => IH.CATALOG[t]).map((t) => ({ plain: t }));
    const cards = list.map((p) => {
      const st = IH.STORES[p.seller];
      const chosen = it && it.product === p.id;
      const sw = p.look && (p.look.color || (p.look.finish && FINISH_SW[p.look.finish]));
      const dims = p.w && p.d ? `${Math.round(p.w * 100)}×${Math.round(p.d * 100)}${p.h ? '×' + Math.round(p.h * 100) : ''} ס״מ` : '';
      const fits = p.tags.includes(app().state.style);
      return `<li class="pc${chosen ? ' is-chosen' : ''}">
        <div class="pc-sw" style="${sw ? `--sw:${sw}` : ''}" aria-hidden="true"><span>${esc(IH.CATALOG[p.type].name)}</span></div>
        <div class="pc-body">
          <p class="pc-store">${esc(st ? st.name : p.seller)}${fits ? ' · <span class="pc-fit">מתאים לסגנון</span>' : ''}</p>
          <h4 class="pc-name">${app().rich(p.name)}</h4>
          <p class="pc-meta">${dims ? `<span class="num" dir="ltr">${dims}</span>` : ''}</p>
          <p class="pc-price">${p.price ? `${p.from ? 'החל מ-' : ''}<b class="num">${money(p.price)}</b>` : '<span class="muted">המחיר באתר</span>'}</p>
        </div>
        <div class="pc-act">
          ${chosen ? '<span class="pill">נבחר</span>' : `<button type="button" class="btn btn-small" data-pick="${p.id}">${it ? 'בחירה' : 'הוספה'}</button>`}
          <a href="${esc(p.url)}" target="_blank" rel="noopener" class="link-btn">לאתר החנות</a>
        </div>
      </li>`;
    });
    // a plain piece (the site's own estimate and stores) can be added too
    const plainCards = it ? [] : plain.map(({ plain: t }) => `<li class="pc pc-plain">
        <div class="pc-sw" aria-hidden="true"><span>${esc(IH.CATALOG[t].name)}</span></div>
        <div class="pc-body"><p class="pc-store">לבחירה אחר כך</p><h4 class="pc-name">${esc(IH.CATALOG[t].name)} (כללי)</h4><p class="pc-meta muted">מחיר משוער לפי התקציב; אפשר להחליף לדגם בהמשך</p></div>
        <div class="pc-act"><button type="button" class="btn btn-small btn-ghost" data-plain="${t}">הוספה</button></div>
      </li>`);
    $('#cat-list').innerHTML = cards.concat(plainCards).join('') || '<li class="muted">אין מוצרים לחנות הזו בקטגוריה הזו.</li>';
    $('#cat-count').textContent = `${list.length} מוצרים`;
  }
  const FINISH_SW = { white: '#f1efea', oak: '#cdb08a', walnut: '#6e4f3a', black: '#2a2a2b', grey: '#9c9b96', natural: '#c9a37a' };

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'btn-edit') { setEditing(!editing); return; }
    if (t.id === 'ed-add') { openCatalog({ kind: 'add' }); return; }
    if (t.id === 'ed-undo') { doUndo(); return; }
    if (t.id === 'ed-reset') { reset(); return; }
    if (t.dataset.ed) {
      const box = t.closest('[data-item]');
      const id = box && box.dataset.item;
      if (!id) return;
      const step = 0.1;
      switch (t.dataset.ed) {
        case 'swap': openCatalog({ kind: 'swap', id }); break;
        case 'up': move(id, 0, -step); break;
        case 'down': move(id, 0, step); break;
        case 'left': move(id, -step, 0); break;
        case 'right': move(id, step, 0); break;
        case 'rotate': rotate(id); break;
        case 'dup': duplicate(id); break;
        case 'del': remove(id); break;
      }
      return;
    }
    if (t.dataset.catTab !== undefined) { $('#catalog-dlg').dataset.section = t.dataset.catTab; renderCatalog(); return; }
    if (t.dataset.pick) {
      const dlg = $('#catalog-dlg');
      if (catMode.kind === 'swap') { dlg.close(); choose(catMode.id, t.dataset.pick); }
      else { const room = $('#cat-room').value; dlg.close(); add(t.dataset.pick, null, room); }
      return;
    }
    if (t.dataset.plain) { const room = $('#cat-room').value; $('#catalog-dlg').close(); add(null, t.dataset.plain, room); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'cat-store' || e.target.id === 'cat-sort') renderCatalog();
  });
  // a pick from the model table in the item card ("בחירה" on a product row)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-choose]');
    if (b) choose(b.dataset.item, b.dataset.choose);
  });

  IH.editor = {
    apply, actionsHtml, productsFor, move, renderBar,
    get editing() { return editing; },
    get count() { return Object.keys(cur().items).length; }
  };
})();
