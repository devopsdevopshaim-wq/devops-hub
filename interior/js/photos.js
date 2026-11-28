/* Room photos: for every room, four walls and the floor (photos or frames taken from a video).
   The old furniture is erased from the photo (fill from the surroundings, or a clone stamp) and
   the planned furniture is laid on it as cut-outs that the 3D engine renders from the same point
   of view the photo was taken from. Everything stays in this browser (IndexedDB). */
(function () {
  'use strict';
  const IH = window.IH;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const app = () => IH.app;
  const esc = (s) => app().esc(s);

  const WALLS = [['top', 'קיר 1'], ['right', 'קיר 2'], ['bottom', 'קיר 3'], ['left', 'קיר 4'], ['floor', 'רצפה']];
  const wallName = (w) => (WALLS.find((x) => x[0] === w) || ['', ''])[1];
  const MAX = 1800;
  const OPEN_NAMES = { window: 'חלון', slider: 'יציאה החוצה', door: 'דלת', entry: 'דלת כניסה' };

  /* ---------- storage ---------- */
  const mem = new Map();
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const rq = indexedDB.open('matar-media', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('media');
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((res) => {
      if (!d) { res(undefined); return; }
      try {
        const t = d.transaction('media', mode);
        const r = fn(t.objectStore('media'));
        t.oncomplete = () => res(r && r.result);
        t.onerror = () => res(undefined);
        t.onabort = () => res(undefined);
      } catch (e) { res(undefined); }
    }));
  }
  async function get(k) {
    if (mem.has(k)) return mem.get(k);
    const v = await tx('readonly', (s) => s.get(k));
    if (v) mem.set(k, v);
    return v;
  }
  function put(k, v) { mem.set(k, v); return tx('readwrite', (s) => s.put(v, k)); }
  function del(k) { mem.delete(k); return tx('readwrite', (s) => s.delete(k)); }
  const pkey = (room, wall) => `photo:${room}:${wall}`;
  const vkey = (room) => `video:${room}`;

  // object URLs made for the current screen, released on the next render
  let urls = [];
  function url(blob) { const u = URL.createObjectURL(blob); urls.push(u); return u; }
  function releaseUrls() { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; }

  /* ---------- images ---------- */
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }
  function toBlob(canvas, type, q) {
    return new Promise((res) => canvas.toBlob((b) => res(b), type || 'image/jpeg', q || 0.9));
  }
  function fitCanvas(src, sw, sh) {
    const k = Math.min(1, MAX / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  async function fileToCanvas(file) {
    const u = URL.createObjectURL(file);
    try {
      const img = await loadImage(u);
      return fitCanvas(img, img.naturalWidth, img.naturalHeight);
    } finally { URL.revokeObjectURL(u); }
  }
  async function saveOriginal(room, wall, canvas) {
    const blob = await toBlob(canvas);
    await put(pkey(room, wall), { orig: blob, w: canvas.width, h: canvas.height, t: Date.now() });
  }

  /* ---------- the plan side ---------- */
  function photoRooms() {
    const plan = app().plan;
    if (!plan) return [];
    return plan.rooms.filter((r) => !r.outdoor && r.kind !== 'corridor' && plan.items.some((it) => it.room === r.id && IH.CATALOG[it.type]));
  }
  function wallFeatures(r, wall) {
    if (wall === 'floor') return [];
    const eps = 0.2, out = new Set();
    app().plan.segs.forEach((s) => {
      const horiz = s.y1 === s.y2;
      s.open.forEach((o) => {
        const t = (o.t0 + o.t1) / 2;
        const ax = horiz ? s.x1 + t : s.x1, ay = horiz ? s.y1 : s.y1 + t;
        const inX = ax > r.x && ax < r.x + r.w, inY = ay > r.y && ay < r.y + r.d;
        const on = {
          top: horiz && Math.abs(ay - r.y) < eps && inX,
          bottom: horiz && Math.abs(ay - (r.y + r.d)) < eps && inX,
          left: !horiz && Math.abs(ax - r.x) < eps && inY,
          right: !horiz && Math.abs(ax - (r.x + r.w)) < eps && inY
        }[wall];
        if (on && OPEN_NAMES[o.type]) out.add(OPEN_NAMES[o.type]);
      });
    });
    return Array.from(out);
  }
  function wallLabel(r, wall) {
    const f = wallFeatures(r, wall);
    return wallName(wall) + (f.length ? ' · ' + f.join(', ') : '');
  }
  // the room cut out of the floor plan, walls numbered, and where to stand for the chosen wall
  function roomMap(svg, r, wall) {
    const plan = app().plan;
    IH.renderPlan(svg, plan, { triangle: false });
    $$('.fp-labels, .fp-dims', svg).forEach((g) => g.remove());
    const m = 0.7;
    svg.setAttribute('viewBox', `${r.x - m} ${r.y - m} ${r.w + 2 * m} ${r.d + 2 * m}`);
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'ph-map-marks');
    const pos = { top: [r.x + r.w / 2, r.y - 0.36], right: [r.x + r.w + 0.36, r.y + r.d / 2], bottom: [r.x + r.w / 2, r.y + r.d + 0.36], left: [r.x - 0.36, r.y + r.d / 2] };
    let html = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.d}" class="ph-map-room"/>`;
    WALLS.slice(0, 4).forEach(([k], i) => {
      const [x, y] = pos[k];
      html += `<g class="ph-map-wall${k === wall ? ' is-on' : ''}"><circle cx="${x}" cy="${y}" r="0.3"/><text x="${x}" y="${y}" dy="0.12">${i + 1}</text></g>`;
    });
    if (wall && wall !== 'floor') {
      const V = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[wall];
      const cx = r.x + r.w / 2, cy = r.y + r.d / 2;
      const across = V[0] ? r.w : r.d;
      const px = cx - V[0] * (across / 2 - 0.35), py = cy - V[1] * (across / 2 - 0.35);
      const ang = Math.atan2(V[1], V[0]) * 180 / Math.PI;
      html += `<g class="ph-map-cam" transform="translate(${px} ${py}) rotate(${ang})"><path d="M0 0 L1.3 -0.8 L1.3 0.8 Z"/><rect x="-0.28" y="-0.2" width="0.4" height="0.4" rx="0.06"/></g>`;
    } else if (wall === 'floor') {
      html += `<g class="ph-map-cam"><circle cx="${r.x + r.w / 2}" cy="${r.y + r.d / 2}" r="0.3"/></g>`;
    }
    g.innerHTML = html;
    svg.appendChild(g);
  }

  /* ---------- screen ---------- */
  let current = null;
  let homeFrames = [];
  const roomFrames = {};

  function show() {
    if (!app() || !app().plan) return;
    const rooms = photoRooms();
    if (!rooms.find((r) => r.id === current)) current = rooms.length ? rooms[0].id : null;
    releaseUrls();
    renderHome();
    $('#ph-rooms').innerHTML = rooms.map((r) => `<button type="button" data-ph-room="${r.id}" aria-pressed="${r.id === current}">${esc(r.name)}<span class="ph-count" data-count="${r.id}"></span></button>`).join('');
    rooms.forEach(async (r) => {
      let n = 0;
      for (const [w] of WALLS) if (await get(pkey(r.id, w))) n++;
      const el = $(`[data-count="${r.id}"]`);
      if (el) el.textContent = n ? ` ${n}/5` : '';
    });
    renderRoom();
    if (ed && !rooms.find((r) => r.id === ed.room.id)) closeEditor();
  }

  async function renderHome() {
    const host = $('#ph-home');
    const v = await get(vkey('home'));
    host.innerHTML = `
      <div class="ph-home-head">
        <div><h2>סרטון של כל הבית</h2><p>מעלים סרטון אחד של כל הדירה, והמערכת מוציאה ממנו תמונות. לכל תמונה בוחרים לאיזה חדר וקיר היא שייכת.</p></div>
        <div class="ph-home-actions">
          <label class="btn btn-small">${v ? 'החלפת הסרטון' : 'העלאת סרטון'}<input type="file" accept="video/*" data-up-video="home" hidden></label>
          ${v ? '<button type="button" class="btn btn-small btn-ghost" data-rm-video="home">מחיקה</button>' : ''}
          <button type="button" class="btn btn-small btn-ghost" data-movie="all">סרטון לפני/אחרי של כל הבית</button>
        </div>
      </div>
      ${v ? videoBlock('home', v) : ''}
      <div class="ph-movie" data-movie-out="all" hidden></div>`;
    if (v) renderFrames('home');
  }

  function videoBlock(id, v) {
    return `<div class="ph-video">
      <video controls playsinline preload="metadata" src="${url(v.blob)}" data-video="${id}"></video>
      <div class="ph-video-tools">
        <label>צילום הפריים הנוכחי אל ${assignSelect(id, 'now')}</label>
        <button type="button" class="btn btn-small btn-ghost" data-frames="${id}">הוצאת 10 תמונות מהסרטון</button>
      </div>
      <div class="ph-frames" data-frames-out="${id}"></div>
    </div>`;
  }
  function assignSelect(id, frame) {
    const rooms = photoRooms();
    const opts = id === 'home'
      ? rooms.map((r) => `<optgroup label="${esc(r.name)}">${WALLS.map(([w, n]) => `<option value="${r.id}|${w}">${esc(r.name)}: ${n}</option>`).join('')}</optgroup>`).join('')
      : WALLS.map(([w]) => `<option value="${id}|${w}">${esc(wallLabel(rooms.find((r) => r.id === id), w))}</option>`).join('');
    return `<select data-assign="${id}" data-frame="${frame}"><option value="">בחירה…</option>${opts}</select>`;
  }
  function renderFrames(id) {
    const out = $(`[data-frames-out="${id}"]`);
    const list = id === 'home' ? homeFrames : (roomFrames[id] || []);
    if (!out) return;
    out.innerHTML = list.map((f, i) => `<figure class="ph-frame"><img src="${f.url}" alt="תמונה ${i + 1} מהסרטון"><figcaption>${assignSelect(id, i)}</figcaption></figure>`).join('');
  }

  async function renderRoom() {
    const host = $('#ph-room');
    const plan = app().plan;
    const r = plan.rooms.find((x) => x.id === current);
    if (!r) { host.innerHTML = '<p class="muted">אין בתכנון חדרים עם ריהוט.</p>'; return; }
    const recs = {};
    for (const [w] of WALLS) recs[w] = await get(pkey(r.id, w));
    const v = await get(vkey(r.id));
    if (current !== r.id) return;
    const done = Object.values(recs).filter((x) => x && x.after).length;
    host.innerHTML = `
      <header class="ph-room-head">
        <div><h2>${esc(r.name)}</h2><p class="muted">${(r.w * r.d).toFixed(1)} מ״ר · <bdi dir="ltr">${r.w.toFixed(2)}×${r.d.toFixed(2)}</bdi> מ׳ · ${plan.items.filter((it) => it.room === r.id && IH.CATALOG[it.type]).length} פריטים בתכנון</p></div>
        <div class="ph-room-actions">
          <label class="btn btn-small">העלאת כמה תמונות יחד<input type="file" accept="image/*" multiple data-up-many hidden></label>
          <button type="button" class="btn btn-small btn-ghost" data-movie="${r.id}" ${done ? '' : 'disabled'}>סרטון לפני/אחרי</button>
          <button type="button" class="btn btn-small btn-ghost" data-print="cover,photos,list,stores">הדפסת התמונות והרשימה</button>
        </div>
      </header>
      <div class="ph-room-grid">
        <figure class="ph-map"><svg class="plan" id="ph-map-svg" role="img" aria-label="מיקום הקירות בחדר"></svg>
          <figcaption>המספרים הם הקירות. המשולש מראה איפה לעמוד ולאן לכוון את המצלמה.</figcaption></figure>
        <div class="ph-slots">${WALLS.map(([w]) => slotCard(r, w, recs[w])).join('')}</div>
      </div>
      <section class="ph-room-video">
        <div class="ph-home-head">
          <div><h3>סרטון של החדר</h3><p class="muted">מסתובבים לאט מאמצע החדר. אחר כך בוחרים פריים לכל קיר.</p></div>
          <div class="ph-home-actions">
            <label class="btn btn-small">${v ? 'החלפת הסרטון' : 'העלאת סרטון'}<input type="file" accept="video/*" data-up-video="${r.id}" hidden></label>
            ${v ? `<button type="button" class="btn btn-small btn-ghost" data-rm-video="${r.id}">מחיקה</button>` : ''}
          </div>
        </div>
        ${v ? videoBlock(r.id, v) : ''}
      </section>
      <div class="ph-movie" data-movie-out="${r.id}" hidden></div>`;
    roomMap($('#ph-map-svg'), r, ed && ed.room.id === r.id ? ed.wall : null);
    $$('.ph-slot', host).forEach((el) => {
      el.addEventListener('mouseenter', () => roomMap($('#ph-map-svg'), r, el.dataset.wall));
      el.addEventListener('focusin', () => roomMap($('#ph-map-svg'), r, el.dataset.wall));
    });
    if (v) renderFrames(r.id);
  }

  function slotCard(r, w, rec) {
    const img = rec ? url(rec.after || rec.edited || rec.orig) : null;
    return `<article class="ph-slot${rec ? ' has-photo' : ''}" data-wall="${w}">
      <header><b>${esc(wallName(w))}</b><span>${esc(wallFeatures(r, w).join(', ') || (w === 'floor' ? 'מלמעלה' : 'קיר מלא'))}</span></header>
      <div class="ph-thumb">${img ? `<img src="${img}" alt="${esc(r.name)}, ${esc(wallName(w))}">${rec.after ? '<span class="pill">עם הריהוט החדש</span>' : ''}` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z M12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`}</div>
      <div class="ph-slot-actions">
        <label class="btn btn-small${rec ? ' btn-ghost' : ''}">${rec ? 'החלפה' : 'העלאת תמונה'}<input type="file" accept="image/*" data-up="${w}" hidden></label>
        ${rec ? `<button type="button" class="btn btn-small" data-edit="${w}">עריכה והצבת ריהוט</button><button type="button" class="link-btn" data-rm="${w}">מחיקה</button>` : ''}
      </div>
    </article>`;
  }

  /* ---------- video ---------- */
  function once(el, ev) { return new Promise((res) => el.addEventListener(ev, res, { once: true })); }
  function grab(video) {
    const c = fitCanvas(video, video.videoWidth, video.videoHeight);
    return c;
  }
  async function extractFrames(id) {
    const v = await get(vkey(id));
    if (!v) return;
    const btn = $(`[data-frames="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'מוציא תמונות…'; }
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    const u = URL.createObjectURL(v.blob);
    video.src = u;
    await once(video, 'loadedmetadata');
    let dur = video.duration;
    if (!isFinite(dur)) { video.currentTime = 1e9; await once(video, 'seeked'); dur = video.duration || video.currentTime || 10; }
    const out = [];
    for (let i = 0; i < 10; i++) {
      video.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / 10);
      await once(video, 'seeked');
      const c = grab(video);
      out.push({ canvas: c, url: c.toDataURL('image/jpeg', 0.7) });
    }
    URL.revokeObjectURL(u);
    if (id === 'home') homeFrames = out; else roomFrames[id] = out;
    renderFrames(id);
    if (btn) { btn.disabled = false; btn.textContent = 'הוצאת 10 תמונות מהסרטון'; }
  }

  /* ---------- editor ---------- */
  let ed = null;

  async function openEditor(roomId, wall) {
    const plan = app().plan;
    const room = plan.rooms.find((r) => r.id === roomId);
    const rec = await get(pkey(roomId, wall));
    if (!room || !rec) return;
    const img = await loadImage(URL.createObjectURL(rec.edited || rec.orig));
    const W = rec.w, H = rec.h;
    ed = { room, wall, rec, W, H, tool: 'move', size: Math.round(Math.max(W, H) / 30), undo: [], sprites: [], sel: null,
      layout: JSON.parse(JSON.stringify(rec.layout || {})), maskOn: false };
    ed.layout.items = ed.layout.items || {};
    ed.layout.bright = ed.layout.bright || 100;
    ed.layout.warm = ed.layout.warm || 0;
    const host = $('#ph-editor');
    host.hidden = false;
    host.innerHTML = `
      <div class="ed-head">
        <div><p class="eyebrow">${esc(room.name)}</p><h2>${esc(wallLabel(room, wall))}</h2></div>
        <button type="button" class="ic-close" data-ed-close aria-label="סגירת העורך">×</button>
      </div>
      <div class="ed-steps"><span><b>1</b> מוחקים את הרהיטים הישנים</span><span><b>2</b> מציבים את הריהוט החדש</span><span><b>3</b> שומרים, מורידים או מדפיסים</span></div>
      <div class="ed-tools" role="toolbar" aria-label="כלים">
        <div class="ed-toolset" role="group" aria-label="כלי">
          <button type="button" data-tool="move" aria-pressed="true">הזזת רהיטים</button>
          <button type="button" data-tool="brush" aria-pressed="false">סימון ישן: מכחול</button>
          <button type="button" data-tool="rect" aria-pressed="false">סימון ישן: מלבן</button>
          <button type="button" data-tool="clone" aria-pressed="false">חותמת שכפול</button>
        </div>
        <label class="ed-range">גודל מכחול <input type="range" min="6" max="200" value="${ed.size}" data-size></label>
        <button type="button" class="btn btn-small" data-erase disabled>מחיקת המסומן</button>
        <button type="button" class="link-btn" data-clear-mask>ניקוי הסימון</button>
        <button type="button" class="link-btn" data-undo disabled>ביטול פעולה</button>
        <button type="button" class="link-btn" data-restore>חזרה לתמונה המקורית</button>
      </div>
      <p class="ed-hint" id="ed-hint" aria-live="polite"></p>
      <div class="ed-main">
        <div class="ed-stage-wrap">
          <div class="ed-stage" style="aspect-ratio:${W}/${H};--ar:${(W / H).toFixed(4)}" data-tool="move">
            <canvas class="ed-base" width="${W}" height="${H}"></canvas>
            <div class="ed-layer"></div>
            <canvas class="ed-mask" width="${W}" height="${H}"></canvas>
          </div>
        </div>
        <aside class="ed-side">
          <div class="ed-group">
            <h3>הריהוט החדש</h3>
            <button type="button" class="btn btn-small" data-place>הצבה מחדש לפי התכנון</button>
            <label class="ed-check"><input type="checkbox" data-together> הזזה של כל הריהוט יחד</label>
            <div class="ed-row"><span>גודל הכול</span><button type="button" class="btn btn-small btn-ghost" data-scale-all="0.95" aria-label="הקטנה">−</button><button type="button" class="btn btn-small btn-ghost" data-scale-all="1.05" aria-label="הגדלה">+</button></div>
            <label class="ed-range">בהירות <input type="range" min="50" max="150" value="${ed.layout.bright}" data-bright></label>
            <label class="ed-range">גוון חם / קר <input type="range" min="-30" max="30" value="${ed.layout.warm}" data-warm></label>
            <label class="ed-check"><input type="checkbox" data-labels${ed.layout.labels ? ' checked' : ''}> שם ומחיר על התמונה</label>
            <label class="ed-check"><input type="checkbox" data-before> להציג את החדר בלי הריהוט החדש</label>
          </div>
          <div class="ed-group ed-selected" id="ed-selected" hidden></div>
          <div class="ed-group">
            <h3>פריטים בתמונה</h3>
            <ul class="ed-items" id="ed-items"></ul>
          </div>
          <div class="ed-actions">
            <button type="button" class="btn" data-save>שמירה</button>
            <button type="button" class="btn btn-ghost" data-download>הורדת התמונה</button>
          </div>
        </aside>
      </div>`;
    const base = $('.ed-base', host);
    base.getContext('2d').drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(img.src);
    ed.base = base;
    ed.mask = $('.ed-mask', host);
    ed.stage = $('.ed-stage', host);
    ed.layer = $('.ed-layer', host);
    bindStage();
    applyFilter();
    place(false);
    roomMap($('#ph-map-svg'), room, wall);
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    ed = null;
    const host = $('#ph-editor');
    host.hidden = true;
    host.innerHTML = '';
  }

  function hint(t) { const h = $('#ed-hint'); if (h) h.textContent = t || ''; }

  // render the planned furniture from the photo's point of view
  function place(reset) {
    const tour = app().tour;
    if (!tour) {
      hint('מנוע התלת-ממד עוד נטען או לא זמין בדפדפן הזה, ולכן אי אפשר להציב רהיטים. נסו שוב בעוד רגע.');
      return;
    }
    hint('מכין את הרהיטים מהזווית של התמונה…');
    setTimeout(() => {
      if (!ed) return;
      const k = Math.min(1, 1500 / Math.max(ed.W, ed.H));
      const layers = tour.renderLayers(ed.room.id, ed.wall, Math.round(ed.W * k), Math.round(ed.H * k));
      if (reset) ed.layout.items = {};
      ed.sprites = layers.map((l, i) => {
        const saved = ed.layout.items[l.id];
        return Object.assign({ id: l.id, type: l.type, url: l.canvas.toDataURL('image/png'), canvas: l.canvas, ratio: l.h / l.w, z: i, flip: false, hidden: false,
          x: l.x, y: l.y, w: l.w, h: l.h }, saved || {});
      });
      drawSprites();
      listItems();
      hint(ed.sprites.length
        ? (ed.wall === 'floor' ? 'הריהוט מוצג במבט מלמעלה. ' : '') + 'גררו רהיט כדי להזיז אותו, והפינה הצבעונית משנה את גודלו. אם המצלמה לא עמדה בדיוק במקום, הזיזו את הכול יחד.'
        : 'אין בתכנון רהיטים שנראים מהזווית הזאת. נסו קיר אחר.');
      scheduleSave();
    }, 30);
  }

  function drawSprites() {
    const L = ed.layer;
    L.innerHTML = ed.sprites.map((s) => `<div class="ed-sprite${s.id === ed.sel ? ' is-sel' : ''}" data-id="${s.id}" style="left:${(s.x * 100).toFixed(3)}%;top:${(s.y * 100).toFixed(3)}%;width:${(s.w * 100).toFixed(3)}%;height:${(s.h * 100).toFixed(3)}%;z-index:${s.z + 1}" ${s.hidden ? 'hidden' : ''}>
        <img src="${s.url}" alt="" draggable="false" style="${s.flip ? 'transform:scaleX(-1)' : ''}">
        ${ed.layout.labels ? `<span class="ed-label">${esc(itemName(s))}</span>` : ''}
        <span class="ed-handle" data-handle aria-hidden="true"></span>
      </div>`).join('');
    L.hidden = !!ed.before;
  }
  function itemName(s) {
    const c = IH.CATALOG[s.type];
    const it = app().plan.items.find((x) => x.id === s.id);
    return c ? `${c.name} · ${app().money(app().price(it))}` : s.type;
  }
  function listItems() {
    const plan = app().plan;
    $('#ed-items').innerHTML = ed.sprites.filter((s) => IH.CATALOG[s.type]).map((s) => {
      const it = plan.items.find((x) => x.id === s.id);
      const c = IH.CATALOG[s.type];
      const stores = app().storesFor(it).slice(0, 2).map((id) => IH.STORES[id].name).join(' · ');
      return `<li${s.id === ed.sel ? ' class="is-sel"' : ''}>
        <label class="ed-check"><input type="checkbox" data-vis="${s.id}" ${s.hidden ? '' : 'checked'}> <span>${esc(c.name)}</span></label>
        <span class="num">${app().money(app().price(it))}</span>
        <span class="ed-where">${esc(stores)} · <button type="button" class="link-btn" data-where="${s.id}">דגמים וטלפונים</button></span>
      </li>`;
    }).join('') || '<li class="muted">אין פריטים</li>';
  }
  function renderSelected() {
    const box = $('#ed-selected');
    const s = ed.sprites.find((x) => x.id === ed.sel);
    if (!s) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<h3>${esc(IH.CATALOG[s.type] ? IH.CATALOG[s.type].name : s.type)}</h3>
      <div class="ed-row">
        <button type="button" class="btn btn-small btn-ghost" data-sp="flip">היפוך</button>
        <button type="button" class="btn btn-small btn-ghost" data-sp="front">קדימה</button>
        <button type="button" class="btn btn-small btn-ghost" data-sp="back">אחורה</button>
        <button type="button" class="btn btn-small btn-ghost" data-sp="hide">הסתרה</button>
        <button type="button" class="btn btn-small btn-ghost" data-sp="reset">למקום המקורי</button>
      </div>
      <p class="muted">אפשר להזיז גם עם החיצים במקלדת.</p>`;
  }
  function applyFilter() {
    ed.layer.style.filter = spriteFilter();
  }
  function spriteFilter() {
    const b = (ed.layout.bright || 100) / 100, w = ed.layout.warm || 0;
    return `brightness(${b})` + (w > 0 ? ` sepia(${(w / 100).toFixed(2)})` : w < 0 ? ` saturate(${(1 + w / 60).toFixed(2)}) hue-rotate(${(w * -0.4).toFixed(1)}deg)` : '');
  }
  function remember() {
    ed.sprites.forEach((s) => { ed.layout.items[s.id] = { x: s.x, y: s.y, w: s.w, h: s.h, z: s.z, flip: s.flip, hidden: s.hidden }; });
    scheduleSave();
  }

  /* ----- pointer work on the photo ----- */
  function bindStage() {
    const st = ed.stage;
    const pt = (e) => {
      const r = st.getBoundingClientRect();
      return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, r };
    };
    let drag = null;
    st.addEventListener('pointerdown', (e) => {
      if (!ed) return;
      const p = pt(e);
      if (ed.tool === 'move') {
        const sp = e.target.closest('.ed-sprite');
        if (!sp) { ed.sel = null; drawSprites(); renderSelected(); listItems(); return; }
        e.preventDefault();
        st.setPointerCapture(e.pointerId);
        ed.sel = sp.dataset.id;
        const s = ed.sprites.find((x) => x.id === ed.sel);
        const together = $('[data-together]').checked;
        drag = { p, s, handle: !!e.target.closest('[data-handle]'), start: ed.sprites.map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h })), together };
        $$('.ed-sprite', st).forEach((el) => el.classList.toggle('is-sel', el.dataset.id === ed.sel));
        renderSelected();
        listItems();
        return;
      }
      e.preventDefault();
      st.setPointerCapture(e.pointerId);
      const x = p.fx * ed.W, y = p.fy * ed.H;
      if (ed.tool === 'brush') { drag = { brush: true, lx: x, ly: y }; dab(x, y, x, y); }
      else if (ed.tool === 'rect') { drag = { rect: true, x0: x, y0: y, snap: ed.mask.getContext('2d').getImageData(0, 0, ed.W, ed.H) }; }
      else if (ed.tool === 'clone') {
        if (!ed.src || e.altKey || ed.pickSrc) {
          ed.src = { x, y };
          ed.off = null;
          ed.pickSrc = false;
          hint('נקודת המקור נבחרה. עכשיו ״מציירים״ על הרהיט הישן, והמרקם מהמקור יועתק עליו.');
          return;
        }
        pushUndo();
        if (!ed.off) ed.off = { x: ed.src.x - x, y: ed.src.y - y };
        const snap = document.createElement('canvas');
        snap.width = ed.W; snap.height = ed.H;
        snap.getContext('2d').drawImage(ed.base, 0, 0);
        drag = { clone: true, snap, lx: x, ly: y };
        cloneDab(snap, x, y);
      }
    });
    st.addEventListener('pointermove', (e) => {
      if (!drag || !ed) return;
      const p = pt(e);
      if (drag.s) {
        const dx = p.fx - drag.p.fx, dy = p.fy - drag.p.fy;
        if (drag.handle) {
          const i = ed.sprites.indexOf(drag.s), s0 = drag.start[i];
          const w = Math.max(0.02, s0.w + dx);
          drag.s.w = w; drag.s.h = w * (s0.h / s0.w);
        } else {
          ed.sprites.forEach((s, i) => {
            if (!drag.together && s !== drag.s) return;
            s.x = drag.start[i].x + dx; s.y = drag.start[i].y + dy;
          });
        }
        moveEls();
        return;
      }
      const x = p.fx * ed.W, y = p.fy * ed.H;
      if (drag.brush) { dab(drag.lx, drag.ly, x, y); drag.lx = x; drag.ly = y; }
      else if (drag.rect) {
        const m = ed.mask.getContext('2d');
        m.putImageData(drag.snap, 0, 0);
        m.fillStyle = 'rgba(214,64,40,0.45)';
        m.fillRect(Math.min(drag.x0, x), Math.min(drag.y0, y), Math.abs(x - drag.x0), Math.abs(y - drag.y0));
        ed.maskOn = true;
        $('[data-erase]').disabled = false;
      } else if (drag.clone) {
        const d = Math.hypot(x - drag.lx, y - drag.ly), step = Math.max(1, ed.size / 4);
        for (let t = step; t <= d; t += step) cloneDab(drag.snap, drag.lx + ((x - drag.lx) * t) / d, drag.ly + ((y - drag.ly) * t) / d);
        drag.lx = x; drag.ly = y;
      }
    });
    const end = () => {
      if (!drag || !ed) { drag = null; return; }
      if (drag.s) remember();
      if (drag.clone) scheduleSave(true);
      drag = null;
    };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
  }
  function moveEls() {
    ed.sprites.forEach((s) => {
      const el = $(`.ed-sprite[data-id="${s.id}"]`, ed.layer);
      if (!el) return;
      el.style.left = (s.x * 100).toFixed(3) + '%';
      el.style.top = (s.y * 100).toFixed(3) + '%';
      el.style.width = (s.w * 100).toFixed(3) + '%';
      el.style.height = (s.h * 100).toFixed(3) + '%';
    });
  }
  function dab(x0, y0, x1, y1) {
    const m = ed.mask.getContext('2d');
    m.strokeStyle = m.fillStyle = 'rgba(214,64,40,0.45)';
    m.lineCap = 'round';
    m.lineWidth = ed.size;
    m.beginPath(); m.moveTo(x0, y0); m.lineTo(x1, y1); m.stroke();
    ed.maskOn = true;
    $('[data-erase]').disabled = false;
  }
  function cloneDab(snap, x, y) {
    const c = ed.base.getContext('2d'), r = ed.size / 2;
    const sx = x + ed.off.x, sy = y + ed.off.y;
    c.save();
    c.globalAlpha = 0.55;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    c.drawImage(snap, sx - r, sy - r, 2 * r, 2 * r, x - r, y - r, 2 * r, 2 * r);
    c.restore();
  }
  function pushUndo() {
    ed.undo.push(ed.base.getContext('2d').getImageData(0, 0, ed.W, ed.H));
    if (ed.undo.length > 6) ed.undo.shift();
    $('[data-undo]').disabled = false;
  }

  /* ----- erase: fill the marked area from its surroundings (push-pull), with matching grain ----- */
  function eraseMarked() {
    if (!ed || !ed.maskOn) return;
    pushUndo();
    const W = ed.W, H = ed.H;
    const md = ed.mask.getContext('2d').getImageData(0, 0, W, H).data;
    let mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = md[i * 4 + 3] > 10 ? 1 : 0;
    mask = dilate(mask, W, H, Math.max(2, Math.round(Math.max(W, H) / 500)));
    const ctx = ed.base.getContext('2d');
    const img = ctx.getImageData(0, 0, W, H);
    inpaint(img.data, mask, W, H);
    ctx.putImageData(img, 0, 0);
    ed.mask.getContext('2d').clearRect(0, 0, W, H);
    ed.maskOn = false;
    $('[data-erase]').disabled = true;
    hint('נמחק. אם נשארו שאריות או קצוות, סמנו שוב ומחקו, או השתמשו בחותמת השכפול כדי להעתיק מרקם של רצפה או קיר.');
    scheduleSave(true);
  }
  function dilate(m, W, H, r) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      let run = -1e9;
      for (let x = 0; x < W; x++) { if (m[y * W + x]) run = x; if (x - run <= r) tmp[y * W + x] = 1; }
      run = 1e9;
      for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) run = x; if (run - x <= r) tmp[y * W + x] = 1; }
    }
    for (let x = 0; x < W; x++) {
      let run = -1e9;
      for (let y = 0; y < H; y++) { if (tmp[y * W + x]) run = y; if (y - run <= r) out[y * W + x] = 1; }
      run = 1e9;
      for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) run = y; if (run - y <= r) out[y * W + x] = 1; }
    }
    return out;
  }
  function inpaint(d, mask, W, H) {
    // level 0: colors and weights (0 where marked)
    const levels = [];
    let w = W, h = H;
    let R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h), A = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) if (!mask[i]) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; A[i] = 1; }
    levels.push({ w, h, R, G, B, A });
    // push: average the known pixels down to 1×1
    while (w > 1 || h > 1) {
      const nw = Math.ceil(w / 2), nh = Math.ceil(h / 2);
      const r = new Float32Array(nw * nh), g = new Float32Array(nw * nh), b = new Float32Array(nw * nh), a = new Float32Array(nw * nh);
      const L = levels[levels.length - 1];
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        let sr = 0, sg = 0, sb = 0, sa = 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const xx = Math.min(w - 1, x * 2 + i), yy = Math.min(h - 1, y * 2 + j), k = yy * w + xx;
          const wa = L.A[k];
          sr += L.R[k] * wa; sg += L.G[k] * wa; sb += L.B[k] * wa; sa += wa;
        }
        const k = y * nw + x;
        if (sa > 0) { r[k] = sr / sa; g[k] = sg / sa; b[k] = sb / sa; }
        a[k] = Math.min(1, sa);
      }
      w = nw; h = nh;
      levels.push({ w, h, R: r, G: g, B: b, A: a });
    }
    // pull: fill each finer level from the coarser one
    for (let l = levels.length - 2; l >= 0; l--) {
      const F = levels[l], C = levels[l + 1];
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
        const k = y * F.w + x, a = F.A[k];
        if (a >= 1) continue;
        const cx = Math.min(C.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), cy = Math.min(C.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
        const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(C.w - 1, x0 + 1), y1 = Math.min(C.h - 1, y0 + 1);
        const fx = cx - x0, fy = cy - y0;
        const s = (arr) => (arr[y0 * C.w + x0] * (1 - fx) + arr[y0 * C.w + x1] * fx) * (1 - fy) + (arr[y1 * C.w + x0] * (1 - fx) + arr[y1 * C.w + x1] * fx) * fy;
        F.R[k] = F.R[k] * a + s(C.R) * (1 - a);
        F.G[k] = F.G[k] * a + s(C.G) * (1 - a);
        F.B[k] = F.B[k] * a + s(C.B) * (1 - a);
        F.A[k] = 1;
      }
    }
    // grain: measure the fine noise just outside the marked area and add the same amount inside
    const band = dilate(mask, W, H, 14);
    let sum = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) {
      const k = y * W + x;
      if (band[k] && !mask[k] && !mask[k + 1]) { sum += Math.abs(d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2] - d[(k + 1) * 4] - d[(k + 1) * 4 + 1] - d[(k + 1) * 4 + 2]) / 3; n++; }
    }
    const amp = n ? Math.min(14, (sum / n) * 0.9) : 2;
    const L0 = levels[0];
    for (let i = 0; i < W * H; i++) {
      if (!mask[i]) continue;
      const g = (Math.random() + Math.random() - 1) * amp;
      d[i * 4] = L0.R[i] + g; d[i * 4 + 1] = L0.G[i] + g; d[i * 4 + 2] = L0.B[i] + g;
    }
  }

  /* ----- composite, save, download ----- */
  function composite(opts) {
    const c = document.createElement('canvas');
    c.width = ed.W; c.height = ed.H;
    const x = c.getContext('2d');
    x.drawImage(ed.base, 0, 0);
    const sp = ed.sprites.filter((s) => !s.hidden).sort((a, b) => a.z - b.z);
    x.save();
    try { x.filter = spriteFilter(); } catch (e) { /* older Safari */ }
    sp.forEach((s) => {
      const dx = s.x * ed.W, dy = s.y * ed.H, dw = s.w * ed.W, dh = s.h * ed.H;
      x.save();
      if (s.flip) { x.translate(dx + dw, dy); x.scale(-1, 1); x.drawImage(s.canvas, 0, 0, dw, dh); } else x.drawImage(s.canvas, dx, dy, dw, dh);
      x.restore();
    });
    x.restore();
    if (ed.layout.labels || (opts && opts.labels)) {
      const fs = Math.max(12, Math.round(ed.W / 70));
      x.font = `600 ${fs}px Assistant, Arial, sans-serif`;
      x.direction = 'rtl';
      x.textBaseline = 'middle';
      sp.filter((s) => IH.CATALOG[s.type]).forEach((s) => {
        const t = itemName(s);
        const tw = x.measureText(t).width + fs;
        const cx = (s.x + s.w / 2) * ed.W, cy = Math.max(fs, s.y * ed.H - fs * 0.2);
        x.fillStyle = 'rgba(28,26,22,0.78)';
        roundRect(x, cx - tw / 2, cy - fs * 0.75, tw, fs * 1.5, fs * 0.4);
        x.fill();
        x.fillStyle = '#fff';
        x.textAlign = 'center';
        x.fillText(t, cx, cy);
      });
    }
    return c;
  }
  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
    x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
    x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
    x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t);
    x.closePath();
  }
  let saveTimer = null, baseDirty = false;
  function scheduleSave(base) {
    if (base) baseDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 900);
  }
  async function save(show) {
    if (!ed) return;
    clearTimeout(saveTimer);
    const e = ed;
    remember();
    clearTimeout(saveTimer);
    const rec = Object.assign({}, e.rec);
    if (baseDirty) { rec.edited = await toBlob(e.base); baseDirty = false; }
    rec.layout = e.layout;
    rec.after = e.sprites.length ? await toBlob(composite()) : null;
    e.rec = rec;
    await put(pkey(e.room.id, e.wall), rec);
    if (show) hint('נשמר. התמונה תופיע בהדפסה ובסרטון לפני/אחרי.');
    const card = $(`.ph-slot[data-wall="${e.wall}"] .ph-thumb`);
    const mv = $(`[data-movie="${e.room.id}"]`);
    if (mv && rec.after) mv.disabled = false;
    if (card && rec.after) card.innerHTML = `<img src="${url(rec.after)}" alt=""><span class="pill">עם הריהוט החדש</span>`;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- before / after movie ---------- */
  async function makeMovie(which) {
    const out = $(`[data-movie-out="${which}"]`);
    const rooms = which === 'all' ? photoRooms() : photoRooms().filter((r) => r.id === which);
    const shots = [];
    for (const r of rooms) for (const [w] of WALLS) {
      const rec = await get(pkey(r.id, w));
      if (rec && rec.after) shots.push({ title: `${r.name} · ${wallName(w)}`, before: rec.orig, after: rec.after });
    }
    out.hidden = false;
    if (!shots.length) { out.innerHTML = '<p class="muted">עוד אין תמונות עם ריהוט חדש. פתחו תמונה, הציבו ריהוט ושמרו.</p>'; return; }
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mime = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    if (!mime) { out.innerHTML = '<p class="muted">הדפדפן הזה לא יכול ליצור סרטון. אפשר להוריד כל תמונה בנפרד או להדפיס.</p>'; return; }
    out.innerHTML = '<p class="muted">מכין סרטון…</p>';
    const imgs = [];
    for (const s of shots) imgs.push({ title: s.title, b: await loadImage(URL.createObjectURL(s.before)), a: await loadImage(URL.createObjectURL(s.after)) });
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const x = c.getContext('2d');
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const fit = (img) => { const k = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight); const w = img.naturalWidth * k, h = img.naturalHeight * k; return [(c.width - w) / 2, (c.height - h) / 2, w, h]; };
    const T = 4.2;
    const total = imgs.length * T;
    rec.start(200);
    const t0 = performance.now();
    await new Promise((res) => {
      function frame() {
        const t = (performance.now() - t0) / 1000;
        if (t >= total) { res(); return; }
        const i = Math.floor(t / T), lt = t - i * T, s = imgs[i];
        x.fillStyle = '#16140f'; x.fillRect(0, 0, c.width, c.height);
        const [l, tp, w, h] = fit(s.b);
        const mix = Math.min(1, Math.max(0, (lt - 1.3) / 0.9));
        x.globalAlpha = 1; x.drawImage(s.b, l, tp, w, h);
        x.globalAlpha = mix; x.drawImage(s.a, l, tp, w, h);
        x.globalAlpha = 1;
        x.font = '600 30px Assistant, Arial, sans-serif';
        x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'top';
        const label = `${s.title} · ${mix < 0.5 ? 'לפני' : 'אחרי'}`;
        const tw = x.measureText(label).width;
        x.fillStyle = 'rgba(22,20,15,0.72)'; x.fillRect(c.width - tw - 56, 28, tw + 32, 48);
        x.fillStyle = '#fff'; x.fillText(label, c.width - 40, 38);
        requestAnimationFrame(frame);
      }
      frame();
    });
    rec.stop();
    await once(rec, 'stop');
    imgs.forEach((s) => { URL.revokeObjectURL(s.b.src); URL.revokeObjectURL(s.a.src); });
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const u = url(blob);
    out.innerHTML = `<video controls playsinline src="${u}"></video><p><a class="btn btn-small" href="${u}" download="before-after.${ext}">הורדת הסרטון</a></p>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (!t.closest || !t.closest('#view-photos')) return;
    if (t.matches('[data-up]') && t.files[0]) {
      await saveOriginal(current, t.dataset.up, await fileToCanvas(t.files[0]));
      show();
      openEditor(current, t.dataset.up);
      return;
    }
    if (t.matches('[data-up-many]') && t.files.length) {
      const free = [];
      for (const [w] of WALLS) if (!(await get(pkey(current, w)))) free.push(w);
      const order = free.concat(WALLS.map((x) => x[0]).filter((w) => !free.includes(w)));
      const files = Array.from(t.files).slice(0, 5);
      for (let i = 0; i < files.length; i++) await saveOriginal(current, order[i], await fileToCanvas(files[i]));
      show();
      return;
    }
    if (t.matches('[data-up-video]') && t.files[0]) {
      const id = t.dataset.upVideo;
      const ok = await put(vkey(id), { blob: t.files[0], name: t.files[0].name });
      if (ok === undefined && !mem.has(vkey(id))) alert('לא הצלחתי לשמור את הסרטון בדפדפן. נסו סרטון קצר יותר.');
      if (id === 'home') homeFrames = []; else delete roomFrames[id];
      show();
      setTimeout(() => extractFrames(id), 100);
      return;
    }
    if (t.matches('[data-assign]') && t.value) {
      const [room, wall] = t.value.split('|');
      const id = t.dataset.assign, fr = t.dataset.frame;
      let canvas;
      if (fr === 'now') {
        const v = $(`video[data-video="${id}"]`);
        if (!v || !v.videoWidth) { t.value = ''; return; }
        canvas = grab(v);
      } else canvas = (id === 'home' ? homeFrames : roomFrames[id])[+fr].canvas;
      await saveOriginal(room, wall, canvas);
      t.value = '';
      t.closest('label, figcaption').insertAdjacentHTML('beforeend', `<span class="pill ph-ok">נשמר ל${esc(wallName(wall))}</span>`);
      if (room !== current) current = room;
      renderRoom();
      return;
    }
    if (!ed) return;
    if (t.matches('[data-vis]')) { const s = ed.sprites.find((x) => x.id === t.dataset.vis); s.hidden = !t.checked; drawSprites(); remember(); }
    if (t.matches('[data-labels]')) { ed.layout.labels = t.checked; drawSprites(); scheduleSave(); }
    if (t.matches('[data-before]')) { ed.before = t.checked; drawSprites(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!ed || !t.closest || !t.closest('#ph-editor')) return;
    if (t.matches('[data-size]')) ed.size = +t.value;
    if (t.matches('[data-bright]')) { ed.layout.bright = +t.value; applyFilter(); scheduleSave(); }
    if (t.matches('[data-warm]')) { ed.layout.warm = +t.value; applyFilter(); scheduleSave(); }
  });
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !t.closest('#view-photos')) return;
    const d = t.dataset;
    if (d.phRoom) { current = d.phRoom; $$('[data-ph-room]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); renderRoom(); return; }
    if (d.edit) { openEditor(current, d.edit); return; }
    if (d.rm) { if (confirm('למחוק את התמונה?')) { await del(pkey(current, d.rm)); if (ed && ed.wall === d.rm && ed.room.id === current) closeEditor(); show(); } return; }
    if (d.rmVideo) { await del(vkey(d.rmVideo)); if (d.rmVideo === 'home') homeFrames = []; else delete roomFrames[d.rmVideo]; show(); return; }
    if (d.frames) { extractFrames(d.frames); return; }
    if (d.movie) { t.disabled = true; try { await makeMovie(d.movie); } finally { t.disabled = false; } return; }
    if (!ed) return;
    if (d.edClose !== undefined) { await save(); closeEditor(); renderRoom(); return; }
    if (d.tool) {
      ed.tool = d.tool;
      $$('[data-tool]', $('#ph-editor')).forEach((b) => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b === t)); });
      ed.stage.dataset.tool = d.tool;
      if (d.tool === 'clone') { ed.pickSrc = true; hint('לחצו על אזור נקי של רצפה או קיר כדי לבחור ממנו מרקם, ואז ״ציירו״ על הרהיט הישן.'); }
      else if (d.tool === 'brush' || d.tool === 'rect') hint('סמנו את הרהיט הישן (כולל הצל שלו), ואז ״מחיקת המסומן״. עובד הכי טוב על קיר ורצפה אחידים.');
      else hint('גררו רהיט כדי להזיז אותו. הפינה הצבעונית משנה גודל.');
      return;
    }
    if (d.erase !== undefined) { eraseMarked(); return; }
    if (d.clearMask !== undefined) { ed.mask.getContext('2d').clearRect(0, 0, ed.W, ed.H); ed.maskOn = false; $('[data-erase]').disabled = true; return; }
    if (d.undo !== undefined) { const u = ed.undo.pop(); if (u) { ed.base.getContext('2d').putImageData(u, 0, 0); scheduleSave(true); } t.disabled = !ed.undo.length; return; }
    if (d.restore !== undefined) {
      if (!confirm('לבטל את כל המחיקות ולחזור לתמונה המקורית?')) return;
      pushUndo();
      const img = await loadImage(URL.createObjectURL(ed.rec.orig));
      ed.base.getContext('2d').drawImage(img, 0, 0, ed.W, ed.H);
      URL.revokeObjectURL(img.src);
      ed.rec = Object.assign({}, ed.rec, { edited: null });
      scheduleSave();
      return;
    }
    if (d.place !== undefined) { place(true); return; }
    if (d.scaleAll) {
      const k = +d.scaleAll, vis = ed.sprites.filter((s) => !s.hidden);
      if (!vis.length) return;
      const cx = vis.reduce((a, s) => a + s.x + s.w / 2, 0) / vis.length, cy = Math.max(...vis.map((s) => s.y + s.h));
      ed.sprites.forEach((s) => { s.x = cx + (s.x - cx) * k; s.y = cy + (s.y - cy) * k; s.w *= k; s.h *= k; });
      moveEls(); remember();
      return;
    }
    if (d.where) { await save(); app().show(d.where); return; }
    if (d.sp) {
      const s = ed.sprites.find((x) => x.id === ed.sel);
      if (!s) return;
      const zs = ed.sprites.map((x) => x.z);
      if (d.sp === 'flip') s.flip = !s.flip;
      if (d.sp === 'front') s.z = Math.max(...zs) + 1;
      if (d.sp === 'back') s.z = Math.min(...zs) - 1;
      if (d.sp === 'hide') { s.hidden = true; ed.sel = null; renderSelected(); }
      if (d.sp === 'reset') { delete ed.layout.items[s.id]; place(false); return; }
      drawSprites(); listItems(); remember();
      return;
    }
    if (d.save !== undefined) { await save(true); return; }
    if (d.download !== undefined) {
      const b = await toBlob(composite(), 'image/jpeg', 0.92);
      download(b, `${ed.room.name}-${wallName(ed.wall)}.jpg`);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!ed || !ed.sel || location.hash !== '#photos') return;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
    const step = e.shiftKey ? 0.02 : 0.004;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    const together = $('[data-together]').checked;
    ed.sprites.forEach((s) => { if (together || s.id === ed.sel) { s.x += mv[0]; s.y += mv[1]; } });
    moveEls(); remember();
  });
  window.addEventListener('ih-plan', () => { if (location.hash === '#photos') show(); });

  // for print.js: every saved photo with its before and after images
  async function records() {
    const out = [];
    for (const r of photoRooms()) for (const [w] of WALLS) {
      const rec = await get(pkey(r.id, w));
      if (rec) out.push({ room: r, wall: w, title: `${r.name} · ${wallLabel(r, w)}`, before: rec.orig, after: rec.after || rec.edited || null, layout: rec.layout || {} });
    }
    return out;
  }

  IH.photos = { show, records, WALLS, wallName };
  if (location.hash === '#photos') show();
})();
