/* שכבות — "משלחת עולמית": the world expedition. Choose a real site on the globe, read the sources, survey the site
   with test pits, dig where the clues point, then clean the find in the lab and sift the soil.
   The globe is globe3d.js, the dig is the 3D excavation of dig3d.js, the save and modals come from game.js. */
(function () {
  'use strict';
  const W = window.SHCHAVOT_WORLD, WP = window.SHCHAVOT_WORLD_PHOTOS || { sites: {} };
  const A = window.SHCHAVOT_GAME.api;
  const D = window.SHCHAVOT;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const S = () => A.S();
  const esc = A.esc;
  const credit = (p) => `צילום: ${esc(p.artist)} · ${esc(p.license)} · <a href="${p.page}" target="_blank" rel="noopener">ויקישיתוף</a>`;

  function state() {
    const s = S();
    if (!s.world) s.world = { found: {}, small: {}, seen: {} };
    return s.world;
  }
  const isFound = (id) => !!state().found[id];
  const photo = (id, kind) => WP.sites[id] && WP.sites[id][kind];

  /* ---------- the find objects the dig and the lab use ---------- */
  // in the ground a find is a lump of earth; its true face shows only after cleaning
  const LUMP = (w, h, seed) => {
    let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, k = 0.78 + r() * 0.2; pts.push(`${(50 + Math.cos(a) * 46 * k).toFixed(1)},${(50 + Math.sin(a) * 40 * k).toFixed(1)}`); }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx=".4" cy=".35"><stop offset="0" stop-color="#b08a5c"/><stop offset="1" stop-color="#5e4128"/></radialGradient></defs><polygon points="${pts.join(' ')}" fill="url(#g)" stroke="#3e2a18" stroke-width="2"/><circle cx="38" cy="40" r="6" fill="#d9b25a" opacity=".55"/><circle cx="62" cy="58" r="3" fill="#e6c46a" opacity=".5"/></svg>`;
  };
  const finds = {};
  function treasureFind(site) {
    if (finds[site.id]) return finds[site.id];
    const t = site.treasure, ph = photo(site.id, 'find');
    const f = { id: 'w_' + site.id, name: t.name, era: 'w_' + site.id, rarity: t.rarity, value: t.value, w: 2, h: 2, svg: LUMP(2, 2, site.id.length * 97), fact: t.desc, world: site.id };
    finds[site.id] = f;
    D.BY_ID[f.id] = f;
    // the find card and the museum use the real photo; the credits list it
    if (ph) window.SHCHAVOT_PHOTOS.finds[f.id] = { ...ph, cut: ph.src };
    return f;
  }
  function smallFind(i, era) {
    const sm = W.SMALL[i % W.SMALL.length];
    const f = { id: 'ws_' + sm.id, name: sm.name, era, rarity: sm.value > 12 ? 'uncommon' : 'common', value: sm.value * 3, w: 1, h: 1, svg: LUMP(1, 1, i * 31 + 7), fact: 'ממצא קטן שנמצא בשכבה. ממצאים כאלה עוזרים לתארך את השכבה ולהבין מי חי בה.', world: 'small' };
    D.BY_ID[f.id] = f;
    return f;
  }
  W.SITES.forEach(treasureFind);

  /* ---------- the globe screen ---------- */
  let region = 'all', current = null;
  function renderWorld() {
    const st = state();
    const n = W.SITES.filter((s) => isFound(s.id)).length;
    $('#w-found').textContent = `${n}/${W.SITES.length}`;
    $('#w-regions').innerHTML = [['all', 'כל העולם']].concat(Object.entries(W.REGIONS)).map(([id, name]) => `<button class="chip ${region === id ? 'on' : ''}" data-r="${id}">${name}</button>`).join('');
    $$('#w-regions .chip').forEach((b) => b.onclick = () => { region = b.dataset.r; SFX.click(); renderWorld(); });
    const list = W.SITES.filter((s) => region === 'all' || s.region === region);
    $('#w-list').innerHTML = list.map((s) => {
      const ph = photo(s.id, 'site') || photo(s.id, 'find');
      return `<button class="w-card ${isFound(s.id) ? 'found' : ''}" data-id="${s.id}">
        <div class="w-pic">${ph ? `<img src="${ph.src}" alt="" loading="lazy">` : `<span>${s.flag}</span>`}</div>
        <b>${s.flag} ${s.name}</b><small>${s.country}</small>
        <em>${isFound(s.id) ? '✓ נמצא' : s.cost ? `${s.cost} 🪙` : 'חינם'}</em></button>`;
    }).join('');
    $$('#w-list .w-card').forEach((b) => b.onclick = () => { SFX.click(); const s = W.BY[b.dataset.id]; if (window.GLOBE3D) GLOBE3D.focus(s.id); dossier(s); });
    st.seen.world = 1;
  }
  function startGlobe() {
    const go = () => {
      if (document.body.dataset.screen !== 'world' || !window.GLOBE3D) return;
      GLOBE3D.start($('#world3d'), W.SITES, { isFound, onPick: (s) => { SFX.click(); dossier(s); } });
    };
    if (window.GLOBE3D) go(); else window.addEventListener('globe3d-ready', go, { once: true });
  }

  /* ---------- the dossier: the sources about a site ---------- */
  function dossier(s) {
    current = s;
    const done = isFound(s.id), ph = photo(s.id, 'site'), fp = photo(s.id, 'find');
    const st = state().found[s.id];
    A.modal(`
      <div class="dossier">
        ${ph ? `<figure class="d-photo"><img src="${ph.src}" alt="${esc(ph.caption)}"><figcaption>${esc(ph.caption)} · <small>${credit(ph)}</small></figcaption></figure>` : ''}
        <h2>${s.flag} ${s.name}</h2>
        <p class="sub">${s.country} · ${s.years} · ${s.era}</p>
        <div class="d-sec"><h4>📜 מה אומרים המקורות</h4>${s.sources.map((x) => `<blockquote><b>${esc(x.ref)}</b>${esc(x.text)}</blockquote>`).join('')}</div>
        <div class="d-sec"><h4>🎯 מה מחפשים</h4><p><b>${s.treasure.name}</b></p></div>
        ${done ? `<div class="d-sec found"><h4>🏛️ הסיפור האמיתי</h4><p>${esc(s.story)}</p><p>${esc(s.treasure.desc)}</p>
          ${fp ? `<figure class="d-photo small"><img src="${fp.src}" alt="${esc(fp.caption)}"><figcaption>${esc(fp.caption)} · <small>${credit(fp)}</small></figcaption></figure>` : ''}
          <p class="sub">מצאתם אותו במצב ${st.cond}%</p></div>` : `<p class="sub">איך התגלה האוצר באמת? הסיפור נפתח אחרי שתמצאו אותו.</p>`}
      </div>
      <div class="m-actions">
        <button class="btn gold" id="m-go">${done ? '⛏️ לחפור שוב באתר' : '🧭 לצאת למשלחת'}${s.cost ? ` · ${s.cost} ${A.ico('coin', 'ico md')}` : ''}</button>
        <button class="btn ghost" id="m-close">סגירה</button>
      </div>`, (root) => {
      $('#m-go', root).onclick = () => {
        if (S().coins < s.cost) { SFX.deny(); A.toast(`למשלחת לכאן צריך ${s.cost} מטבעות. אפשר להרוויח בשלבי התותח או בחפירות בארץ 🪙`, '', 4500); return; }
        S().coins -= s.cost; A.save(); A.topbar();
        A.closeModal(); survey(s);
      };
      $('#m-close', root).onclick = A.closeModal;
    });
  }

  /* ---------- the survey: a map of the site, the clues, and test pits ---------- */
  const N = 5;
  let sv = null;
  const TERRAIN = {
    desert: ['#d9b77f', '#c49a5e', '#e8cfa0'], hills: ['#bfa679', '#9c8a5c', '#d4c39a'], green: ['#8fae6a', '#6f8f4e', '#a9c485'],
    sea: ['#2f6f99', '#1f5577', '#4c8bb3'], jungle: ['#4f7d45', '#365f33', '#6c9a5a'],
  };
  function survey(s) {
    sv = { s, probes: 3, done: {}, mode: 'probe' };
    A.show('survey');
    $('#sv-title').textContent = `${s.flag} ${s.name}`;
    $('#sv-sub').textContent = `סקר שטח · ${s.country}`;
    $('#sv-hints').innerHTML = s.hints.map((h, i) => `<li class="${i === 0 ? '' : 'locked'}">${i === 0 ? esc(h) : '🔒 רמז נוסף ייפתח אחרי בור ניסיון'}</li>`).join('');
    $('#sv-sources').innerHTML = s.sources.map((x) => `<li><b>${esc(x.ref)}</b> ${esc(x.text)}</li>`).join('');
    setMode('probe');
    drawMap();
  }
  function setMode(m) {
    sv.mode = m;
    $$('.sv-mode').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('#sv-probes').textContent = sv.probes;
    $('#sv-help').textContent = m === 'probe' ? 'הקישו על משבצת כדי לחפור בור ניסיון קטן ולראות מה יש באדמה.' : 'הקישו על המשבצת שבה תפתחו את שטח החפירה.';
  }
  $$('.sv-mode').forEach((b) => b.addEventListener('click', () => { SFX.click(); setMode(b.dataset.m); }));
  $('#sv-back').addEventListener('click', () => { SFX.click(); A.show('world'); });

  function drawMap() {
    const cv = $('#sv-map'), dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.min(cv.parentElement.clientWidth, 520);
    cv.style.width = cv.style.height = size + 'px'; cv.width = cv.height = size * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = sv.s, cell = size / N, T = TERRAIN[s.terrain] || TERRAIN.desert;
    // the ground, drawn like an old survey map
    g.fillStyle = T[0]; g.fillRect(0, 0, size, size);
    let seed = s.id.length * 131;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? T[1] : T[2]; g.globalAlpha = 0.25; g.beginPath(); g.arc(rnd() * size, rnd() * size, 3 + rnd() * 18, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // contour lines
    g.strokeStyle = 'rgba(60,40,20,.18)'; g.lineWidth = 1;
    for (let k = 1; k < 6; k++) { g.beginPath(); for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2, r = k * size * 0.09 * (1 + Math.sin(t * 3 + k) * 0.08); const x = size * 0.55 + Math.cos(t) * r, y = size * 0.45 + Math.sin(t) * r * 0.8; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    // the grid
    g.strokeStyle = 'rgba(40,24,10,.55)'; g.setLineDash([4, 4]);
    for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke(); g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke(); }
    g.setLineDash([]);
    g.font = `700 ${Math.max(10, cell * 0.13)}px Heebo, sans-serif`; g.fillStyle = 'rgba(40,24,10,.6)'; g.textAlign = 'center';
    for (let c = 0; c < N; c++) g.fillText('אבגדה'[c], (c + 0.5) * cell, 12);
    for (let r = 0; r < N; r++) g.fillText(String(r + 1), 8, (r + 0.5) * cell + 4);
    // landmarks
    for (const [em, c, r, label] of s.map.marks) {
      const x = (c + 0.5) * cell, y = (r + 0.5) * cell;
      g.font = `${cell * 0.38}px serif`; g.textBaseline = 'middle'; g.fillText(em, x, y - cell * 0.08);
      g.font = `800 ${Math.max(10, cell * 0.12)}px Heebo, sans-serif`;
      const tw = g.measureText(label).width + 8;
      g.fillStyle = 'rgba(255,248,230,.86)'; g.fillRect(x - tw / 2, y + cell * 0.18, tw, cell * 0.17);
      g.fillStyle = '#3a2410'; g.fillText(label, x, y + cell * 0.27);
    }
    // what the test pits showed
    for (const key of Object.keys(sv.done)) {
      const [c, r] = key.split(',').map(Number), d = sv.done[key];
      g.fillStyle = ['rgba(200,40,20,.55)', 'rgba(230,140,30,.45)', 'rgba(240,210,80,.35)', 'rgba(120,120,120,.35)'][d];
      g.fillRect(c * cell + 3, r * cell + 3, cell - 6, cell - 6);
      g.font = `${cell * 0.3}px serif`; g.fillStyle = '#000'; g.fillText(['🔥', '🏺', '·', '✕'][d], (c + 0.5) * cell, (r + 0.25) * cell);
    }
    g.textBaseline = 'alphabetic';
  }
  $('#sv-map').addEventListener('click', (e) => {
    if (!sv) return;
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * N), row = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (c < 0 || c >= N || row < 0 || row >= N) return;
    const [tc, tr] = sv.s.map.t;
    const d = Math.max(Math.abs(c - tc), Math.abs(row - tr));
    if (sv.mode === 'probe') {
      const key = c + ',' + row;
      if (sv.done[key] !== undefined) return;
      if (sv.probes <= 0) { SFX.deny(); A.toast('נגמרו בורות הניסיון. בחרו איפה לחפור ⛏️'); setMode('dig'); return; }
      sv.probes--; SFX.trowel();
      const lvl = Math.min(3, d);
      sv.done[key] = lvl;
      A.toast(['🔥 שכבה עשירה: חרסים, פחם ושברי מתכת מהתקופה!', '🏺 כמה חרסים מהתקופה. קרוב.', '· כמעט כלום: מעט חרסים שנסחפו.', '✕ אדמה נקייה, בלי שרידים.'][lvl], lvl === 0 ? 'gold' : '', 3400);
      // every test pit opens another clue
      const opened = 3 - sv.probes;
      $$('#sv-hints li').forEach((li, i) => { if (i <= opened && li.classList.contains('locked')) { li.classList.remove('locked'); li.textContent = sv.s.hints[i]; } });
      $('#sv-probes').textContent = sv.probes;
      if (!sv.probes) setMode('dig');
      drawMap();
    } else {
      SFX.click();
      A.modal(`<div class="m-ico">⛏️</div><h2>לפתוח שטח חפירה במשבצת ${'אבגדה'[c]}${row + 1}?</h2><p class="sub">אחרי שפותחים שטח אי אפשר להזיז אותו. בחרו לפי המקורות ולפי בורות הניסיון.</p>
        <div class="m-actions"><button class="btn gold" id="m-dig">לחפור כאן</button><button class="btn ghost" id="m-no">עוד לחשוב</button></div>`, (root) => {
        $('#m-dig', root).onclick = () => { A.closeModal(); startDig(sv.s, d); };
        $('#m-no', root).onclick = A.closeModal;
      });
    }
  });

  /* ---------- the dig ---------- */
  function startDig(s, d) {
    A.registerEra('w_' + s.id, { name: s.era, short: s.era, years: s.years });
    A.registerEra('w_late', { name: 'שכבות מאוחרות', short: 'מאוחר', years: 'אחרי התקופה' });
    const hit = d === 0;
    const main = treasureFind(s);
    const smalls = [0, 1, 2, 3].map((i) => smallFind(Math.floor(Math.random() * 8) + i, i % 2 ? 'w_' + s.id : 'w_late'));
    A.startWorldDig({
      id: 'world-' + s.id, name: s.name, place: `${s.flag} ${s.country}`, eras: ['w_late', 'w_' + s.id], mult: 1 + s.cost / 120,
      sky: ['#9fc8f0', '#f3dcb0'], world: s.id,
    }, { main: hit ? main : null, smalls, near: d });
    if (!hit) setTimeout(() => A.toast(d === 1 ? '🧭 קרוב! אבל לפי השכבות, הממצא הגדול לא בדיוק כאן.' : '🧭 בשטח הזה יש בעיקר שכבות מאוחרות. אולי הקשבתם פחות למקורות…', '', 5200), 1500);
  }

  /* ---------- the lab: cleaning a find ---------- */
  let soilImg = null;
  function soil() { if (!soilImg) { soilImg = new Image(); soilImg.src = 'photos/soil-detail.jpg'; } return soilImg; }
  soil();
  function lab(a, value, isNew, perfect, done) {
    const f = a.f, ph = window.SHCHAVOT_PHOTOS.finds[f.id];
    const el = $('#lab');
    el.hidden = false; document.body.classList.add('in-lab');
    $('#lab-title').textContent = 'מעבדת השימור';
    $('#lab-sub').textContent = `${f.name} · עוד מכוסה באדמה ובגיר`;
    const cv = $('#lab-cv'), dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.min(el.clientWidth - 32, 460, el.clientHeight - 260);
    cv.style.width = cv.style.height = size + 'px'; cv.width = cv.height = Math.round(size * dpr);
    const g = cv.getContext('2d');
    const W2 = cv.width;
    // the object itself
    const obj = new Image(); obj.src = ph ? ph.src : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg);
    // two layers over it: loose earth (the brush) and hard crust (the needle)
    const dirt = document.createElement('canvas'); dirt.width = dirt.height = W2;
    const crust = document.createElement('canvas'); crust.width = crust.height = W2;
    const dg = dirt.getContext('2d'), cg = crust.getContext('2d');
    const paintDirt = () => {
      dg.fillStyle = '#7a5a38'; dg.fillRect(0, 0, W2, W2);
      if (soilImg.complete && soilImg.naturalWidth) { const pat = dg.createPattern(soilImg, 'repeat'); dg.globalAlpha = 0.85; dg.fillStyle = pat; dg.fillRect(0, 0, W2, W2); dg.globalAlpha = 1; }
      for (let i = 0; i < 400; i++) { dg.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 40},${20 + Math.random() * 25},${0.2 + Math.random() * 0.4})`; dg.beginPath(); dg.arc(Math.random() * W2, Math.random() * W2, 2 + Math.random() * 12 * dpr, 0, 7); dg.fill(); }
      const nCrust = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < nCrust; i++) {
        const x = W2 * (0.2 + Math.random() * 0.6), y = W2 * (0.2 + Math.random() * 0.6), r = W2 * (0.05 + Math.random() * 0.06);
        const gr = cg.createRadialGradient(x, y, r * 0.2, x, y, r); gr.addColorStop(0, '#d8cdb6'); gr.addColorStop(0.7, '#b9ab90'); gr.addColorStop(1, 'rgba(185,171,144,0)');
        cg.fillStyle = gr; cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fill();
      }
    };
    let tool = 'brush', cond = a.cond, scratches = 0, washed = 0, last = null, finished = false;
    const draw = () => {
      g.clearRect(0, 0, W2, W2);
      g.fillStyle = '#1b130c'; g.fillRect(0, 0, W2, W2);
      if (obj.complete && obj.naturalWidth) {
        const k = Math.min(W2 / obj.naturalWidth, W2 / obj.naturalHeight) * 0.94, w = obj.naturalWidth * k, h = obj.naturalHeight * k;
        g.filter = `saturate(${0.5 + washed * 0.5}) brightness(${0.8 + washed * 0.2})`;
        g.drawImage(obj, (W2 - w) / 2, (W2 - h) / 2, w, h);
        g.filter = 'none';
      }
      g.drawImage(dirt, 0, 0); g.drawImage(crust, 0, 0);
    };
    const coverage = () => {
      // how much is still covered, read from a coarse sample of both layers
      const step = Math.max(4, Math.round(W2 / 60));
      const dd = dg.getImageData(0, 0, W2, W2).data, cd = cg.getImageData(0, 0, W2, W2).data;
      let cov = 0, cr = 0, n = 0;
      for (let y = 0; y < W2; y += step) for (let x = 0; x < W2; x += step) { const i = (y * W2 + x) * 4 + 3; n++; if (dd[i] > 40) cov++; if (cd[i] > 60) cr++; }
      return { dirt: cov / n, crust: cr / n };
    };
    const scrub = (x, y, px, py) => {
      const sp = px == null ? 0 : Math.hypot(x - px, y - py) / dpr;
      const ctx = tool === 'needle' ? cg : dg;
      const rad = (tool === 'needle' ? 7 : tool === 'water' ? 34 : 22) * dpr;
      // the brush is gentle but slow; brushing too fast scratches the find
      if (tool === 'brush' && sp > 38) { scratches++; cond = Math.max(30, cond - 1); flashBad(); }
      if (tool === 'needle') {
        // the needle takes off crust, and gouges clean surface
        const under = cg.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 4, 4).data[3];
        if (under < 30 && Math.random() < 0.08) { scratches++; cond = Math.max(30, cond - 1); flashBad(); }
        dg.globalCompositeOperation = 'destination-out'; dg.beginPath(); dg.arc(x, y, rad, 0, 7); dg.fill(); dg.globalCompositeOperation = 'source-over';
      }
      if (tool === 'water') { washed = Math.min(1, washed + 0.01); }
      ctx.globalCompositeOperation = 'destination-out';
      const steps = Math.max(1, Math.ceil(sp / 6));
      for (let i = 0; i < steps; i++) {
        const t = steps === 1 ? 1 : i / (steps - 1), cx = px == null ? x : px + (x - px) * t, cy = py == null ? y : py + (y - py) * t;
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        // the brush lifts only some earth with each stroke; water rinses what's left
        const a0 = tool === 'brush' ? 0.22 : tool === 'water' ? (coverNow.dirt < 0.2 ? 0.35 : 0.04) : 0.9;
        gr.addColorStop(0, `rgba(0,0,0,${a0})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (tool === 'brush' && Math.random() < 0.3) SFX.brush();
    };
    let coverNow = { dirt: 1, crust: 1 }, badT = 0;
    const flashBad = () => { const now = performance.now(); if (now - badT < 400) return; badT = now; SFX.crack(); cv.classList.remove('bad'); void cv.offsetWidth; cv.classList.add('bad'); $('#lab-tip').textContent = tool === 'brush' ? 'לאט! מברשת מהירה מדי שורטת את הממצא.' : 'זהירות: המחט חורצת משטח שכבר נקי.'; };
    const hud = () => {
      const cleanPct = Math.round((1 - Math.max(coverNow.dirt, coverNow.crust * 0.8)) * 100);
      $('#lab-clean').style.width = clamp(cleanPct, 0, 100) + '%';
      $('#lab-cond').textContent = cond + '%';
      $('#lab-pct').textContent = clamp(cleanPct, 0, 100) + '%';
      $('#lab-tool-water').classList.toggle('ready', coverNow.dirt < 0.2);
      if (!finished && coverNow.dirt < 0.05 && coverNow.crust < 0.02 && washed > 0.4) finish();
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let timer = 0;
    const tick = () => { coverNow = coverage(); hud(); };
    const toXY = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W2 / r.width), (e.clientY - r.top) * (W2 / r.height)]; };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); last = toXY(e); scrub(last[0], last[1]); draw(); };
    cv.onpointermove = (e) => { if (!last) return; const p = toXY(e); scrub(p[0], p[1], last[0], last[1]); last = p; draw(); };
    cv.onpointerup = cv.onpointercancel = () => { last = null; tick(); };
    $$('.lab-tool').forEach((b) => b.onclick = () => {
      if (b.dataset.t === 'water' && coverNow.dirt > 0.2) { SFX.deny(); $('#lab-tip').textContent = 'קודם מנקים את רוב העפר במברשת. מים על בוץ רק מורחים אותו.'; return; }
      tool = b.dataset.t; SFX.click();
      $$('.lab-tool').forEach((x) => x.classList.toggle('on', x === b));
      $('#lab-tip').textContent = { brush: 'מברשת רכה: תנועות קצרות ואיטיות מסירות את העפר.', needle: 'מחט שיניים: מסירים בעדינות את גושי הגיר הלבנים.', water: 'מים וספוג: שוטפים את הממצא בסוף, כדי לראות את הצבעים.' }[tool];
    });
    $$('.lab-tool').forEach((x) => x.classList.toggle('on', x.dataset.t === 'brush'));
    $('#lab-tip').textContent = 'מברשת רכה: תנועות קצרות ואיטיות מסירות את העפר.';
    const finish = () => {
      finished = true; clearInterval(timer);
      SFX.find(D.RARITY[f.rarity].rank); A.confetti(60);
      washed = 1; dg.clearRect(0, 0, W2, W2); cg.clearRect(0, 0, W2, W2); draw();
      $('#lab-tip').textContent = 'הממצא נקי! ✨';
      setTimeout(close, 1300);
    };
    const close = () => {
      el.hidden = true; document.body.classList.remove('in-lab');
      cv.onpointerdown = cv.onpointermove = cv.onpointerup = null;
      clearInterval(timer);
      a.cond = cond;
      done(cond);
    };
    $('#lab-skip').onclick = () => { SFX.click(); cond = Math.max(30, cond - 10); close(); };
    const begin = () => { paintDirt(); draw(); tick(); timer = setInterval(tick, 500); };
    if (soilImg.complete) begin(); else soilImg.onload = begin;
    obj.onload = draw;
  }

  /* ---------- the sieve: sifting the soil from the dig ---------- */
  function sieve(dig, done) {
    const el = $('#sieve');
    el.hidden = false; document.body.classList.add('in-lab');
    const cv = $('#sieve-cv'), dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.min(el.clientWidth - 32, 440, el.clientHeight - 240);
    cv.style.width = cv.style.height = size + 'px'; cv.width = cv.height = Math.round(size * dpr);
    const g = cv.getContext('2d'), W2 = cv.width, C = W2 / 2, RAD = W2 * 0.46;
    const R = () => Math.random();
    const inCircle = () => { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * RAD * 0.88; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
    const grains = Array.from({ length: 900 }, () => { const [x, y] = inCircle(); return { x, y, r: (1.2 + R() * 2.6) * dpr, c: ['#8a6440', '#a07a50', '#6e4e30', '#b8925f'][Math.floor(R() * 4)] }; });
    const pebbles = Array.from({ length: 10 + Math.floor(R() * 6) }, () => { const [x, y] = inCircle(); return { x, y, r: (7 + R() * 8) * dpr, c: ['#8e8a84', '#a39d94', '#6f6a64'][Math.floor(R() * 3)], pebble: true }; });
    const nFinds = 2 + Math.floor(R() * 3) + (dig.arts.some((a) => a.done && a.f.world && a.f.world !== 'small') ? 1 : 0);
    const items = Array.from({ length: nFinds }, () => { const [x, y] = inCircle(); const sm = W.SMALL[Math.floor(R() * W.SMALL.length)]; return { x, y, r: 15 * dpr, sm }; });
    let shake = 0, lastX = null, got = 0, coins = 0, over = false;
    const draw = () => {
      g.clearRect(0, 0, W2, W2);
      // the sieve: a wooden ring and a wire mesh
      g.fillStyle = '#5a3e24'; g.beginPath(); g.arc(C, C, RAD + 12 * dpr, 0, 7); g.fill();
      g.fillStyle = '#2a1e14'; g.beginPath(); g.arc(C, C, RAD, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(C, C, RAD, 0, 7); g.clip();
      g.strokeStyle = 'rgba(200,190,170,.25)'; g.lineWidth = 1;
      for (let i = -RAD; i < RAD; i += 9 * dpr) { g.beginPath(); g.moveTo(C + i, C - RAD); g.lineTo(C + i, C + RAD); g.stroke(); g.beginPath(); g.moveTo(C - RAD, C + i); g.lineTo(C + RAD, C + i); g.stroke(); }
      for (const p of grains) { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
      for (const p of pebbles) { g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.75, p.x % 3, 0, 7); g.fill(); }
      g.font = `${26 * dpr}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const it of items) { if (it.got) continue; g.globalAlpha = grains.length > 250 ? 0.35 : 1; g.fillText(it.sm.icon, it.x, it.y); }
      g.globalAlpha = 1;
      g.restore();
    };
    const left = () => grains.length / 900;
    const loop = () => {
      if (over) return;
      requestAnimationFrame(loop);
      if (shake > 0.2) {
        // shaking jiggles everything and lets the fine earth fall through the mesh
        for (const p of grains) { p.x += (R() - 0.5) * shake * 1.6 * dpr; p.y += (R() - 0.5) * shake * 1.6 * dpr; }
        for (const p of [...pebbles, ...items]) { p.x += (R() - 0.5) * shake * 0.5 * dpr; p.y += (R() - 0.5) * shake * 0.5 * dpr; const d = Math.hypot(p.x - C, p.y - C); if (d > RAD * 0.9) { p.x = C + (p.x - C) * 0.97; p.y = C + (p.y - C) * 0.97; } }
        for (let i = grains.length - 1; i >= 0; i--) if (R() < 0.006 * shake) grains.splice(i, 1);
        shake *= 0.9;
        draw();
        $('#sieve-pct').style.width = Math.round((1 - left()) * 100) + '%';
        if (left() < 0.25 && !$('#sieve-tip').dataset.done) { $('#sieve-tip').dataset.done = 1; $('#sieve-tip').textContent = 'העפר עבר! עכשיו הקישו על מה שנשאר ברשת: חלק סתם אבנים, וחלק ממצאים.'; }
      }
    };
    const toXY = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W2 / r.width), (e.clientY - r.top) * (W2 / r.height)]; };
    cv.onpointerdown = (e) => {
      cv.setPointerCapture(e.pointerId); lastX = e.clientX;
      if (left() > 0.3) return;
      const [x, y] = toXY(e);
      const it = items.find((q) => !q.got && Math.hypot(q.x - x, q.y - y) < 22 * dpr);
      if (it) {
        it.got = true; got++; coins += it.sm.value; SFX.coin();
        const st = state(); st.small[it.sm.id] = (st.small[it.sm.id] || 0) + 1;
        A.toast(`${it.sm.icon} ${it.sm.name} +${it.sm.value} 🪙`, 'gold', 1800);
        draw();
        if (got === items.length) setTimeout(finish, 600);
        return;
      }
      const pb = pebbles.find((q) => Math.hypot(q.x - x, q.y - y) < q.r + 6 * dpr);
      if (pb) { SFX.deny(); pebbles.splice(pebbles.indexOf(pb), 1); draw(); A.toast('סתם אבן 🪨', '', 1200); }
    };
    cv.onpointermove = (e) => { if (lastX == null) return; shake = Math.min(6, shake + Math.abs(e.clientX - lastX) * 0.08); lastX = e.clientX; if (Math.random() < 0.1) SFX.brush(); };
    cv.onpointerup = cv.onpointercancel = () => { lastX = null; };
    const finish = () => {
      if (over) return;
      over = true;
      el.hidden = true; document.body.classList.remove('in-lab');
      S().coins += coins; dig.coins += coins; S().stats.finds += got;
      A.save(); A.topbar();
      if (got) A.toast(`🧺 בניפוי נמצאו ${got} ממצאים קטנים · +${coins} 🪙`, 'gold', 3500);
      done();
    };
    $('#sieve-done').onclick = () => { SFX.click(); finish(); };
    $('#sieve-tip').dataset.done = ''; $('#sieve-tip').textContent = 'גררו את המסננת מצד לצד כדי לנער אותה. העפר הדק יעבור, ומה שגדול יישאר.';
    $('#sieve-pct').style.width = '0%';
    draw(); loop();
  }

  /* ---------- what the dig does when a world treasure comes out ---------- */
  function treasureDone(a, cond) {
    const s = W.BY[a.f.world];
    if (!s) return;
    const st = state(), first = !st.found[s.id];
    st.found[s.id] = { cond: Math.max(cond, (st.found[s.id] || {}).cond || 0), at: Date.now() };
    A.save();
    if (window.GLOBE3D) GLOBE3D.setFound(s.id);
    if (first) setTimeout(() => A.toast(`🌍 ${s.treasure.name} נוסף לאוסף העולמי!`, 'gold', 4200), 400);
  }

  window.SHCHAVOT_WORLDGAME = {
    onShow(name) {
      if (name === 'world') { renderWorld(); startGlobe(); } else if (window.GLOBE3D) GLOBE3D.stop();
      if (name === 'survey' && sv) requestAnimationFrame(drawMap);
    },
    lab, sieve, treasureDone, state,
    _survey: () => sv,
  };
  addEventListener('resize', () => { if (document.body.dataset.screen === 'survey' && sv) drawMap(); });
})();
