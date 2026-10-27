/* שכבות — the game: save, dig generation, canvas rendering, effects, screens. */
(function () {
  'use strict';
  const D = window.SHCHAVOT;
  const { RARITY, ERAS, FINDS, BY_ID, ITEMS, SITES } = D;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const COLS = 9, ROWS = 13;
  const fmt = (n) => Math.round(n).toLocaleString('he-IL');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ERA = Object.fromEntries(ERAS.map((e) => [e.id, e]));
  const ERA_COLOR = { ottoman: '#3fa7a0', crusader: '#c0392b', byzantine: '#d4a017', roman: '#a33d6b', second: '#3b7dd8', first: '#8e5bd1', canaan: '#2e9d5b', prehistory: '#a0663a' };

  /* ---------- random ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

  /* ---------- images ---------- */
  const IMG = {};
  function image(key, svgStr) {
    if (!IMG[key]) { const im = new Image(); im.decoding = 'async'; im.src = D.svgUrl(svgStr); IMG[key] = im; }
    return IMG[key];
  }
  FINDS.forEach((f) => image(f.id, f.svg));
  Object.values(ITEMS).forEach((it) => image(it.id, it.svg));

  /* ---------- save ---------- */
  const KEY = 'shchavot.v1';
  const fresh = () => ({ coins: 0, xp: 0, lvl: 1, up: {}, museum: {}, frags: 0, maps: 0, stats: { tiles: 0, finds: 0, perfect: 0, digs: 0, bestDig: 0 }, quests: null, daily: null, tut: {}, sound: true });
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return Object.assign(fresh(), s); } catch (e) { /* private mode */ }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage off: the run still plays */ } }
  const up = (id) => S.up[id] || 0;
  SFX.setEnabled(S.sound);

  /* ---------- progression ---------- */
  const xpFor = (l) => Math.round(30 * l + 14 * l * l);
  let pendingLevels = [];
  function addXP(n) {
    S.xp += n;
    while (S.xp >= xpFor(S.lvl)) {
      S.xp -= xpFor(S.lvl); S.lvl++; pendingLevels.push(S.lvl);
      SFX.levelup();
      toast(`⭐ עלית לרמה ${S.lvl}!`, 'gold');
      const site = SITES.find((s) => s.level === S.lvl);
      if (site) setTimeout(() => toast(`🗺️ אתר חדש נפתח: ${site.name}`, 'gold'), 900);
    }
  }
  const UPS = [
    { id: 'pick', icon: '⛏️', name: 'מכוש מחושל', max: 6, base: 60, desc: (l) => `עוצמת המכוש ${4 + l}${l < 6 ? ` ← ${5 + l}` : ''}. שובר סלע מהר יותר.` },
    { id: 'stamina', icon: '💪', name: 'כושר גופני', max: 10, base: 45, desc: (l) => `אנרגיה בכל חפירה: ${42 + 8 * l}${l < 10 ? ` ← ${50 + 8 * l}` : ''}` },
    { id: 'detector', icon: '📡', name: 'גלאי מתכות', max: 4, base: 110, desc: (l) => `ניצוצות מגלים ממצאים במרחק ${1 + l}${l < 4 ? ` ← ${2 + l}` : ''} משבצות מהחפירה.` },
    { id: 'sonar', icon: '🔊', name: 'סונאר קרקע', max: 4, base: 140, desc: (l) => `${1 + l}${l < 4 ? ` ← ${2 + l}` : ''} סריקות בכל חפירה. כל סריקה חושפת שטח של 5×5.` },
    { id: 'restore', icon: '🧤', name: 'ידיים של משמר', max: 5, base: 130, desc: (l) => `הנזק לממצאים קטן ב־${12 * l}%${l < 5 ? ` ← ${12 * (l + 1)}%` : ''}.` },
    { id: 'luck', icon: '🍀', name: 'אינטואיציה של חוקר', max: 8, base: 190, desc: (l) => `סיכוי לממצאים נדירים +${20 * l}%${l < 8 ? ` ← +${20 * (l + 1)}%` : ''}` },
    { id: 'funding', icon: '📜', name: 'מענק מחקר', max: 4, base: 240, desc: (l) => `${l}${l < 4 ? ` ← ${l + 1}` : ''} ממצאים נוספים בכל אתר.` },
    { id: 'dynamite', icon: '🧨', name: 'חומר נפץ', max: 3, base: 320, desc: (l) => `${l}${l < 3 ? ` ← ${l + 1}` : ''} פיצוצים בכל חפירה. מפוצץ 3×3 בלי אנרגיה, אבל מסוכן לממצאים.` },
  ];
  const upCost = (u) => Math.round(u.base * Math.pow(1.65, up(u.id)));

  function loadout(daily) {
    if (daily) return { energy: 60, pick: 5, sonar: 2, dyn: 1, det: 2, restore: 0, luck: 0, funding: 0 };
    return { energy: 42 + 8 * up('stamina'), pick: 4 + up('pick'), sonar: 1 + up('sonar'), dyn: up('dynamite'), det: 1 + up('detector'), restore: up('restore'), luck: up('luck'), funding: up('funding') };
  }
  const eraComplete = (era) => FINDS.filter((f) => f.era === era).every((f) => S.museum[f.id] && S.museum[f.id].n);

  /* ---------- daily quests ---------- */
  const QPOOL = [
    { type: 'tiles', goal: 60, text: 'חפרו 60 משבצות' },
    { type: 'finds', goal: 6, text: 'מצאו 6 ממצאים' },
    { type: 'rare', goal: 1, text: 'מצאו ממצא נדיר או יותר' },
    { type: 'perfect', goal: 3, text: 'חשפו 3 ממצאים במצב מושלם' },
    { type: 'brush', goal: 40, text: '40 מכות מברשת עדינות' },
    { type: 'coins', goal: 400, text: 'הרוויחו 400 מטבעות' },
    { type: 'items', goal: 3, text: 'אספו 3 חפצים באדמה' },
    { type: 'clear', goal: 1, text: 'חשפו את כל הממצאים באתר אחד' },
  ];
  function ensureQuests() {
    const d = today();
    if (S.quests && S.quests.date === d) return;
    const R = rng(hashStr('q' + d));
    const pool = QPOOL.slice();
    const list = [];
    while (list.length < 3) { const q = pool.splice(Math.floor(R() * pool.length), 1)[0]; list.push({ type: q.type, goal: q.goal, prog: 0, claimed: false }); }
    S.quests = { date: d, list };
  }
  const questReward = () => 60 + S.lvl * 30;
  function quest(type, n = 1) {
    ensureQuests();
    for (const q of S.quests.list) {
      if (q.type !== type || q.claimed || q.prog >= q.goal) continue;
      q.prog = Math.min(q.goal, q.prog + n);
      if (q.prog >= q.goal) toast('✅ משימה יומית הושלמה! הפרס מחכה במפה', 'green');
    }
  }

  /* ---------- materials ---------- */
  const MATS = [
    { id: 'top', name: 'אדמת חמרה', hp: 2, c: ['#a36a3c', '#6e4426'], sp: '#c99462', hard: 0.15 },
    { id: 'sand', name: 'חול', hp: 2, c: ['#e6c48c', '#b8925a'], sp: '#f7e2b8', hard: 0.1 },
    { id: 'clay', name: 'חרסית', hp: 3, c: ['#bf7644', '#87482a'], sp: '#e0a272', hard: 0.3 },
    { id: 'earth', name: 'אדמה דחוסה', hp: 3, c: ['#86643f', '#57402a'], sp: '#ad8b61', hard: 0.35 },
    { id: 'chalk', name: 'קירטון', hp: 4, c: ['#e2d8c4', '#ada08a'], sp: '#fbf6ea', hard: 0.45 },
    { id: 'lime', name: 'אבן גיר', hp: 5, c: ['#c8b590', '#927e5e'], sp: '#e8dbbc', hard: 0.6 },
    { id: 'rock', name: 'סלע', hp: 7, c: ['#949089', '#5e5954'], sp: '#c0bab2', hard: 0.8 },
    { id: 'boulder', name: 'סלע ענק', hp: 12, c: ['#75706b', '#403d3a'], sp: '#a29d97', hard: 1 },
  ];

  /* ---------- dig generation ---------- */
  function rollRarity(R, lo, depthIdx) {
    const ws = Object.entries(RARITY).map(([k, r]) => [k, r.w * (r.rank >= 2 ? (1 + 0.2 * lo.luck) * (1 + 0.3 * depthIdx) : 1)]);
    let t = R() * ws.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of ws) { t -= w; if (t <= 0) return k; }
    return 'common';
  }
  function pickFind(R, era, rarity) {
    const rank = RARITY[rarity].rank;
    for (let rk = rank; rk >= 0; rk--) {
      const pool = FINDS.filter((f) => f.era === era && RARITY[f.rarity].rank === rk);
      if (pool.length) return pool[Math.floor(R() * pool.length)];
    }
    return FINDS.filter((f) => f.era === era)[0];
  }

  function genDig(site, siteIdx, opts) {
    const R = rng(opts.seed);
    const lo = opts.lo;
    const eras = site.eras;
    const per = (ROWS - 1) / eras.length;
    const rowEra = [];
    for (let r = 0; r < ROWS; r++) rowEra[r] = r === 0 ? 0 : Math.min(eras.length - 1, Math.floor((r - 1) / per));
    const hpBonus = Math.floor(siteIdx * 0.5);
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const t = r / (ROWS - 1);
      for (let c = 0; c < COLS; c++) {
        let m = r === 0 ? 0 : clamp(Math.round(1 + t * (2.4 + Math.min(2.2, siteIdx * 0.55)) + (R() - 0.5) * 1.8), 1, 6);
        if (r > 3 && siteIdx > 0 && R() < 0.035 + 0.035 * t) m = 7;
        const hp = MATS[m].hp + (m ? hpBonus : 0);
        row.push({ m, hp, max: hp, broken: false, art: -1, item: -1, v: Math.floor(R() * 3), seed: Math.floor(R() * 1e9) });
      }
      grid.push(row);
    }
    const free = (x, y, w, h) => {
      if (x < 0 || y < 1 || x + w > COLS || y + h > ROWS) return false;
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (grid[r][c].art >= 0 || grid[r][c].item >= 0) return false;
      return true;
    };
    const place = (w, h, eraIdx) => {
      const rows = []; for (let r = 1; r < ROWS; r++) if (rowEra[r] === eraIdx) rows.push(r);
      const y0 = rows[0], y1 = rows[rows.length - 1];
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(R() * (COLS - w + 1));
        const y = h > y1 - y0 + 1 ? clamp(y0 + Math.floor(R() * 2), 1, ROWS - h) : y0 + Math.floor(R() * (y1 - y0 - h + 2));
        if (free(x, y, w, h)) return { x, y };
      }
      for (let i = 0; i < 200; i++) {
        const x = Math.floor(R() * (COLS - w + 1)), y = 1 + Math.floor(R() * (ROWS - h));
        if (free(x, y, w, h)) return { x, y };
      }
      return null;
    };
    const arts = [], items = [];
    const mark = (list, idx, key, p, w, h) => { for (let r = p.y; r < p.y + h; r++) for (let c = p.x; c < p.x + w; c++) grid[r][c][key] = idx; };
    const addArt = (f, eraIdx, special) => {
      const p = place(f.w, f.h, eraIdx);
      if (!p) return null;
      const a = { f, x: p.x, y: p.y, w: f.w, h: f.h, cond: 100, done: false, exposed: 0, seed: Math.floor(R() * 1e9), special: !!special };
      arts.push(a); mark(arts, arts.length - 1, 'art', p, f.w, f.h);
      return a;
    };

    // a treasure map hides an epic or legendary find in the deepest layer
    let mapArt = null;
    if (opts.useMap) {
      const eraIdx = eras.length - 1;
      const rarity = R() < 0.3 + 0.05 * lo.luck ? 'legendary' : 'epic';
      mapArt = addArt(pickFind(R, eras[eraIdx], rarity), eraIdx, true);
    }
    if (opts.first) {
      const f = pickFind(R, eras[0], 'uncommon');
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(R() * (COLS - f.w + 1)), y = 1 + Math.floor(R() * 2);
        if (free(x, y, f.w, f.h)) { arts.push({ f, x, y, w: f.w, h: f.h, cond: 100, done: false, exposed: 0, seed: Math.floor(R() * 1e9) }); mark(arts, arts.length - 1, 'art', { x, y }, f.w, f.h); break; }
      }
    }
    const count = opts.daily ? 7 : 4 + lo.funding + Math.floor(siteIdx * 0.5);
    for (let i = 0; i < count; i++) {
      const eraIdx = i < eras.length ? i : Math.floor(R() * eras.length);
      const f = pickFind(R, eras[eraIdx], rollRarity(R, lo, eraIdx));
      addArt(f, eraIdx);
    }
    const addItem = (it) => {
      const p = place(it.w, it.h, Math.floor(R() * eras.length));
      if (!p) return;
      items.push({ it, x: p.x, y: p.y, w: it.w, h: it.h, done: false, exposed: 0 });
      mark(items, items.length - 1, 'item', p, it.w, it.h);
    };
    addItem(ITEMS.canteen); addItem(ITEMS.canteen);
    addItem(ITEMS.pouch); addItem(ITEMS.pouch);
    if (R() < 0.5) addItem(ITEMS.pouch);
    if (R() < 0.38) addItem(ITEMS.mapfrag);
    if (R() < 0.14) addItem(ITEMS.chest);

    return {
      site, siteIdx, daily: !!opts.daily, counted: !!opts.counted, grid, arts, items, rowEra, eras, lo,
      energy: lo.energy, maxEnergy: lo.energy, sonar: lo.sonar, dyn: lo.dyn,
      found: [], coins: 0, xp: 0, bought: 0, over: false, mapArt, glints: [], tiles: 0,
    };
  }

  /* ---------- the pit (canvas) ---------- */
  const cv = $('#pit');
  const ctx = cv.getContext('2d');
  let dpr = 1, W = 360, CELL = 40, SURF = 36, H = 560;
  let TEX = null, DARK = null, SURFIMG = null;
  let dig = null, tool = 'pick', lastTool = 'pick';
  let parts = [], floats = [], flyers = [], rings = [], shake = 0, flash = 0, hover = null, running = false, lastT = 0;

  function makeTex(mat, v, dark) {
    const c = document.createElement('canvas');
    const px = Math.ceil(CELL * dpr);
    c.width = c.height = px;
    const x = c.getContext('2d');
    x.scale(px / CELL, px / CELL);
    const R = rng(hashStr(mat.id) + v * 977 + (dark ? 5 : 0));
    const g = x.createLinearGradient(0, 0, CELL * 0.3, CELL);
    g.addColorStop(0, mat.c[0]); g.addColorStop(1, mat.c[1]);
    x.fillStyle = g; x.fillRect(0, 0, CELL, CELL);
    if (mat.id === 'chalk' || mat.id === 'lime') {
      x.strokeStyle = 'rgba(90,70,40,.18)'; x.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const y = CELL * (0.2 + i * 0.3 + R() * 0.1); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(CELL * 0.3, y - 3, CELL * 0.6, y + 3, CELL, y - 1); x.stroke(); }
    }
    for (let i = 0; i < 70; i++) {
      x.fillStyle = R() < 0.5 ? mat.sp : 'rgba(0,0,0,.6)';
      x.globalAlpha = 0.12 + R() * 0.2;
      const s = 0.6 + R() * 1.8;
      x.fillRect(R() * CELL, R() * CELL, s, s);
    }
    x.globalAlpha = 1;
    const pebbles = mat.id === 'boulder' ? 0 : 1 + Math.floor(R() * (mat.hard > 0.4 ? 3 : 2));
    for (let i = 0; i < pebbles; i++) {
      const px2 = 4 + R() * (CELL - 8), py = 4 + R() * (CELL - 8), rr = 1.5 + R() * CELL * 0.08;
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(px2 + 0.8, py + 1, rr, rr * 0.75, 0, 0, 7); x.fill();
      x.fillStyle = R() < 0.5 ? mat.sp : mat.c[1]; x.beginPath(); x.ellipse(px2, py, rr, rr * 0.75, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(px2 - rr * 0.3, py - rr * 0.3, rr * 0.35, rr * 0.25, 0, 0, 7); x.fill();
    }
    if (mat.id === 'boulder' || mat.id === 'rock') {
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(CELL * 0.1, CELL * (0.3 + R() * 0.4)); x.lineTo(CELL * 0.5, CELL * (0.4 + R() * 0.2)); x.lineTo(CELL * 0.9, CELL * (0.3 + R() * 0.4)); x.stroke();
      if (mat.id === 'boulder') {
        const rg2 = x.createRadialGradient(CELL * 0.35, CELL * 0.3, 2, CELL / 2, CELL / 2, CELL * 0.7);
        rg2.addColorStop(0, 'rgba(255,255,255,.22)'); rg2.addColorStop(1, 'rgba(0,0,0,.25)');
        x.fillStyle = rg2; x.fillRect(0, 0, CELL, CELL);
      }
    }
    if (dark) {
      x.fillStyle = 'rgba(20,10,4,.62)'; x.fillRect(0, 0, CELL, CELL);
    } else {
      x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(0, 0, CELL, 1.5);
      x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(CELL - 1.5, 0, 1.5, CELL);
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, CELL - 2, CELL, 2);
      x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, 0, 1.5, CELL);
    }
    return c;
  }
  function makeSurface(site) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * dpr); c.height = Math.ceil(SURF * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, 0, SURF);
    g.addColorStop(0, site.sky[0]); g.addColorStop(1, site.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, SURF);
    const sun = x.createRadialGradient(W * 0.18, SURF * 0.35, 1, W * 0.18, SURF * 0.35, SURF * 0.7);
    sun.addColorStop(0, 'rgba(255,250,220,1)'); sun.addColorStop(0.25, 'rgba(255,230,150,.9)'); sun.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = sun; x.fillRect(0, 0, W, SURF);
    const R = rng(hashStr(site.id));
    const hills = (col, base, amp) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, SURF);
      for (let i = 0; i <= 12; i++) x.lineTo((W * i) / 12, base - R() * amp);
      x.lineTo(W, SURF); x.fill();
    };
    hills('rgba(120,110,140,.35)', SURF * 0.7, SURF * 0.3);
    hills('rgba(110,90,60,.5)', SURF * 0.85, SURF * 0.2);
    // camp: tent, flag and sieve
    const tx = W * 0.72, ty = SURF * 0.86;
    x.fillStyle = '#e9dcc0'; x.beginPath(); x.moveTo(tx - 16, ty); x.lineTo(tx, ty - 17); x.lineTo(tx + 16, ty); x.fill();
    x.fillStyle = '#c9b48e'; x.beginPath(); x.moveTo(tx, ty - 17); x.lineTo(tx + 16, ty); x.lineTo(tx + 4, ty); x.fill();
    x.fillStyle = '#3a2a18'; x.beginPath(); x.moveTo(tx - 3, ty); x.lineTo(tx, ty - 9); x.lineTo(tx + 3, ty); x.fill();
    x.strokeStyle = '#4a3420'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(W * 0.88, ty); x.lineTo(W * 0.88, ty - 22); x.stroke();
    x.fillStyle = '#e74c3c'; x.beginPath(); x.moveTo(W * 0.88, ty - 22); x.lineTo(W * 0.88 + 10, ty - 19); x.lineTo(W * 0.88, ty - 16); x.fill();
    x.strokeStyle = '#7a5a30'; x.lineWidth = 1; x.beginPath(); x.moveTo(W * 0.3, ty); x.lineTo(W * 0.33, ty - 12); x.lineTo(W * 0.36, ty); x.stroke();
    x.fillStyle = '#5a7a3a';
    x.fillRect(0, SURF - 4, W, 4);
    for (let i = 0; i < W; i += 3) { const hgt = 2 + R() * 5; x.fillStyle = R() < 0.5 ? '#6f9a44' : '#4f7a2e'; x.fillRect(i, SURF - 4 - hgt, 1.6, hgt); }
    return c;
  }

  function layout() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const wrap = $('.pit-wrap');
    const availW = Math.min(wrap.clientWidth || window.innerWidth - 24, 540);
    const head = $('.dig-head').offsetHeight + $('.tools').offsetHeight + 34;
    const availH = Math.max(320, window.innerHeight - head);
    CELL = Math.floor(Math.min(availW / COLS, availH / (ROWS + 0.9)));
    W = CELL * COLS; SURF = Math.round(CELL * 0.9); H = SURF + CELL * ROWS;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    TEX = MATS.map((m) => [0, 1, 2].map((v) => makeTex(m, v, false)));
    DARK = MATS.map((m) => makeTex(m, 0, true));
    if (dig) SURFIMG = makeSurface(dig.site);
  }

  const cellAt = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H - SURF;
    const c = Math.floor(x / CELL), rr = Math.floor(y / CELL);
    if (c < 0 || c >= COLS || rr < 0 || rr >= ROWS) return null;
    return { r: rr, c };
  };
  const G = (r, c) => (dig && r >= 0 && r < ROWS && c >= 0 && c < COLS ? dig.grid[r][c] : null);
  const cx = (c) => c * CELL + CELL / 2, cy = (r) => SURF + r * CELL + CELL / 2;

  /* ---------- effects ---------- */
  function burst(x, y, colors, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const s = (60 + Math.random() * 160) * power;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 520, life: 0.5 + Math.random() * 0.5, t: 0, size: 1.5 + Math.random() * CELL * 0.09, color: colors[i % colors.length], kind: 'chunk', rot: Math.random() * 6 });
    }
  }
  function dust(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * CELL * 0.6, y: y + (Math.random() - 0.5) * CELL * 0.4, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 25, g: 0, life: 0.7 + Math.random() * 0.5, t: 0, size: CELL * (0.18 + Math.random() * 0.15), color, kind: 'dust' });
  }
  function sparkle(x, y, color = '#fff6c0', n = 1, spread = CELL * 0.4) {
    for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 20, g: 0, life: 0.6 + Math.random() * 0.5, t: 0, size: 2 + Math.random() * 3.2, color, kind: 'star' });
  }
  function floatText(x, y, text, color = '#fff', big = false) { floats.push({ x, y, text, color, t: 0, life: big ? 1.6 : 1.1, big }); }

  /* ---------- tutorial tips ---------- */
  let tipTimer = 0;
  function tip(key, html, ms = 4800) {
    if (S.tut[key]) return;
    S.tut[key] = 1; save();
    const el = $('#tip');
    el.innerHTML = html; el.classList.add('show');
    clearTimeout(tipTimer); tipTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* ---------- striking ---------- */
  const TOOL = {
    pick: { name: 'מכוש', harm: 9 },
    trowel: { name: 'כף', dmg: 2, harm: 4 },
    brush: { name: 'מברשת', dmg: 1, harm: 0 },
  };
  function strike(r, c) {
    if (!dig || dig.over || !G(r, c)) return;
    if (tool === 'sonar') return useSonar(r, c);
    if (tool === 'dyn') return useDynamite(r, c);
    const cell = G(r, c);
    if (cell.broken) return;
    if (dig.energy <= 0) return outOfEnergy();
    dig.energy--;
    const dmg = tool === 'pick' ? dig.lo.pick : TOOL[tool].dmg;
    if (tool === 'brush') { quest('brush'); }
    hitCell(r, c, dmg, tool);
    if (navigator.vibrate && tool === 'pick') try { navigator.vibrate(6); } catch (e) { /* no haptics */ }
    hud();
    if (dig.energy <= 0) setTimeout(() => { if (dig && !dig.over && dig.energy <= 0) outOfEnergy(); }, 900);
  }

  function hitCell(r, c, dmg, how) {
    const cell = G(r, c);
    if (!cell || cell.broken) return;
    const mat = MATS[cell.m];
    const before = cell.hp;
    cell.hp -= dmg;
    const excess = Math.max(0, dmg - before);
    const x = cx(c), y = cy(r);
    if (how === 'pick') { SFX.hit(mat.hard); shake = Math.max(shake, 3.2); }
    else if (how === 'trowel') { SFX.trowel(); shake = Math.max(shake, 1.4); }
    else if (how === 'brush') { SFX.brush(); }
    burst(x, y, [mat.c[0], mat.c[1], mat.sp], how === 'brush' ? 2 : 4, how === 'brush' ? 0.4 : 0.8);
    if (how === 'brush') dust(x, y, 'rgba(230,210,170,.45)', 3);

    if (cell.art >= 0 && excess > 0) {
      const a = dig.arts[cell.art];
      const harm = (how === 'pick' ? TOOL.pick.harm : how === 'trowel' ? TOOL.trowel.harm : how === 'dyn' ? 7 : 0) * excess * (1 - 0.12 * dig.lo.restore);
      if (harm > 0 && !a.done) {
        const was = a.cond;
        a.cond = Math.max(5, Math.round(a.cond - harm));
        if (a.cond < was) {
          SFX.crack();
          floatText(x, y - CELL * 0.2, `−${was - a.cond}% שבר!`, '#ff6b5b');
          burst(x, y, ['#ffffff', '#ffd27a'], 6, 0.9);
          tip('damage', '💥 אוי! המכה פגעה בממצא. <b>ליד ממצאים עדיף לעבוד עם המברשת או עם הכף.</b>');
        }
      }
    }

    if (cell.hp <= 0) {
      cell.hp = 0; cell.broken = true;
      dig.tiles++; S.stats.tiles++; quest('tiles');
      dig.xp += 1; addXP(1);
      SFX.breakTile(mat.hard);
      burst(x, y, [mat.c[0], mat.c[1], mat.sp], 10, 1);
      dust(x, y, 'rgba(200,170,120,.5)', 4);
      if (cell.art >= 0) {
        const a = dig.arts[cell.art];
        a.exposed++;
        if (a.exposed === 1) {
          SFX.reveal(); sparkle(x, y, RARITY[a.f.rarity].color, 6);
          tip('reveal', '🪶 מצאתם משהו! <b>עברו למברשת</b> כדי לחשוף אותו בלי לשבור. מכה חזקה מדי פוגעת בממצא.', 6000);
          pulseTool('brush');
        }
        if (a.exposed === a.w * a.h && !a.done) completeArt(a);
      }
      if (cell.item >= 0) {
        const it = dig.items[cell.item];
        it.exposed++;
        if (it.exposed === it.w * it.h && !it.done) collectItem(it);
      }
      computeGlints();
    }
  }

  function computeGlints() {
    const g = [];
    const R = dig.lo.det;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = dig.grid[r][c];
      if (cell.broken || cell.art < 0 || dig.arts[cell.art].done) continue;
      let near = false;
      for (let dr = -R; dr <= R && !near; dr++) for (let dc = -R; dc <= R && !near; dc++) { const n = G(r + dr, c + dc); if (n && n.broken) near = true; }
      if (near) g.push([r, c]);
    }
    if (g.length && !dig.glints.length) tip('glint', '✨ <b>ניצוצות באדמה</b>: ממצא מחכה ממש מתחת. בגלאי מתכות משודרג רואים אותם מרחוק יותר.');
    dig.glints = g;
  }

  const condLabel = (c) => (c >= 100 ? ['מושלם', '#ffd34d'] : c >= 80 ? ['מצוין', '#7ee08a'] : c >= 55 ? ['טוב', '#cfe07e'] : c >= 30 ? ['פגום', '#ffb35b'] : ['שבור', '#ff6b5b']);

  function completeArt(a) {
    a.done = true;
    const rar = RARITY[a.f.rarity];
    const perfect = a.cond >= 100;
    const mult = dig.daily ? 2 : dig.site.mult;
    const eraBonus = eraComplete(a.f.era) ? 1.15 : 1;
    const value = Math.round(a.f.value * mult * (0.25 + 0.75 * a.cond / 100) * (perfect ? 1.5 : 1) * eraBonus);
    const m = S.museum[a.f.id] || { n: 0, best: 0 };
    const isNew = !m.n;
    m.n++; m.best = Math.max(m.best, a.cond);
    S.museum[a.f.id] = m;
    dig.found.push({ id: a.f.id, cond: a.cond, value, perfect, isNew });
    dig.coins += value; S.coins += value;
    S.stats.finds++; if (perfect) S.stats.perfect++;
    quest('finds'); quest('coins', value);
    if (rar.rank >= 2) quest('rare');
    if (perfect) quest('perfect');
    dig.xp += rar.xp; addXP(rar.xp);
    SFX.find(rar.rank);
    if (rar.rank >= 3) { flash = rar.rank === 4 ? 0.9 : 0.5; shake = 6; }
    const x = a.x * CELL, y = SURF + a.y * CELL;
    flyers.push({ im: IMG[a.f.id], x, y, w: a.w * CELL, h: a.h * CELL, t: 0, color: rar.color, rank: rar.rank });
    for (let i = 0; i < 6 + rar.rank * 6; i++) sparkle(x + Math.random() * a.w * CELL, y + Math.random() * a.h * CELL, rar.color, 1, 4);
    floatText(x + (a.w * CELL) / 2, y, `+${fmt(value)} 🪙${perfect ? ' מושלם!' : ''}`, perfect ? '#ffd34d' : '#fff', true);
    save(); hud();
    const eraNowDone = isNew && eraComplete(a.f.era);
    setTimeout(() => {
      if (isNew || rar.rank >= 2) showFind(a.f, a.cond, value, isNew, perfect);
      if (eraNowDone) toast(`🏛️ השלמתם את אוסף ${ERA[a.f.era].name}! מעכשיו +15% לערך הממצאים מהתקופה`, 'gold', 5000);
      if (dig && !dig.over && dig.arts.every((z) => z.done)) setTimeout(() => endDig('cleared'), isNew || rar.rank >= 2 ? 50 : 700);
    }, 950);
  }

  function collectItem(it) {
    it.done = true;
    const x = (it.x + it.w / 2) * CELL, y = SURF + (it.y + it.h / 2) * CELL;
    const mult = dig.daily ? 2 : dig.site.mult;
    quest('items');
    flyers.push({ im: IMG[it.it.id], x: it.x * CELL, y: SURF + it.y * CELL, w: it.w * CELL, h: it.h * CELL, t: 0, color: '#ffffff', rank: 0 });
    if (it.it.id === 'canteen') {
      dig.energy += 8; SFX.water(); floatText(x, y, '+8 ⚡', '#7fd3ff', true);
    } else if (it.it.id === 'pouch' || it.it.id === 'chest') {
      const v = Math.round((it.it.id === 'chest' ? 120 + Math.random() * 120 : 15 + Math.random() * 25) * mult);
      dig.coins += v; S.coins += v; quest('coins', v);
      SFX.coin(); floatText(x, y, `+${fmt(v)} 🪙`, '#ffd34d', true);
      for (let i = 0; i < (it.it.id === 'chest' ? 30 : 10); i++) sparkle(x, y, '#ffd34d', 1, CELL);
      if (it.it.id === 'chest') { shake = 5; toast(`📦 תיבת אוצר! +${fmt(v)} מטבעות`, 'gold'); }
    } else if (it.it.id === 'mapfrag') {
      SFX.reveal();
      if (!dig.daily) {
        S.frags++;
        if (S.frags >= 3) { S.frags -= 3; S.maps++; toast('🗺️ הרכבתם מפת אוצר! בחפירה הבאה מחכה בעומק ממצא נדיר ביותר, מסומן ב־X', 'gold', 5200); }
        else toast(`🗺️ קרע של מפת אוצר (${S.frags}/3)`, 'gold');
      }
      floatText(x, y, '🗺️ קרע מפה', '#ffe7a8', true);
    }
    save(); hud(); topbar();
  }

  function useSonar(r, c) {
    if (dig.sonar <= 0) { SFX.deny(); return; }
    dig.sonar--;
    SFX.sonar();
    rings.push({ x: cx(c), y: cy(r), t: 0, life: 1.1, color: '#7fe7ff' });
    dig.sonarFx = { r, c, t: 0 };
    setTool(lastTool); hud();
  }
  function useDynamite(r, c) {
    if (dig.dyn <= 0) { SFX.deny(); return; }
    dig.dyn--;
    SFX.boom(); shake = 11; flash = 0.6;
    rings.push({ x: cx(c), y: cy(r), t: 0, life: 0.6, color: '#ffb347' });
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) hitCell(r + dr, c + dc, 10, 'dyn');
    burst(cx(c), cy(r), ['#ffdd57', '#ff8a3d', '#5a4a3a', '#2a2018'], 30, 1.6);
    dust(cx(c), cy(r), 'rgba(90,80,70,.6)', 12);
    setTool(lastTool); hud();
  }

  function outOfEnergy() {
    if (!dig || dig.over || $('#modal').classList.contains('open')) return;
    if (dig.dyn > 0) { toast('⚡ נגמרה האנרגיה, אבל נשאר לכם חומר נפץ 🧨', 'gold'); return; }
    const cost = Math.round(25 * (dig.daily ? 2 : dig.site.mult) * (1 + dig.bought));
    const half = dig.arts.filter((a) => !a.done && a.exposed > 0).length;
    const canBuy = !dig.daily && S.coins >= cost;
    SFX.deny();
    modal(`
      <div class="m-ico">😮‍💨</div>
      <h2>נגמר הכוח לחפור</h2>
      ${half ? `<p class="hot">יש ${half === 1 ? 'ממצא אחד שנחשף' : `${half} ממצאים שנחשפו`} רק בחלקו. עוד כמה מכות והוא שלכם!</p>` : '<p>אפשר לסיים כאן, או לשתות קפה שחור ולהמשיך.</p>'}
      <div class="m-actions">
        ${dig.daily ? '' : `<button class="btn gold" id="m-buy" ${canBuy ? '' : 'disabled'}>☕ +10 אנרגיה · ${fmt(cost)} 🪙</button>`}
        <button class="btn ghost" id="m-end">סיום החפירה</button>
      </div>`, (root) => {
      const b = $('#m-buy', root);
      if (b) b.onclick = () => { S.coins -= cost; dig.bought++; dig.energy += 10; save(); topbar(); hud(); closeModal(); SFX.water(); };
      $('#m-end', root).onclick = () => { closeModal(); endDig('energy'); };
    }, false);
  }

  /* ---------- drawing ---------- */
  function drawCracks(x, y, w, h, n, seed, alpha = 0.75) {
    const R = rng(seed);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let px = x + R() * w, py = y + R() * h;
      ctx.beginPath(); ctx.moveTo(px, py);
      const segs = 3 + Math.floor(R() * 3);
      for (let k = 0; k < segs; k++) { px += (R() - 0.5) * w * 0.35; py += (R() - 0.5) * h * 0.35; ctx.lineTo(px, py); }
      ctx.strokeStyle = `rgba(20,12,6,${alpha})`; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.restore();
  }

  function draw(dt) {
    const t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (SURFIMG) ctx.drawImage(SURFIMG, 0, 0, W, SURF);

    // dug cells show the darker layer wall behind
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = dig.grid[r][c];
      if (cell.broken) ctx.drawImage(DARK[cell.m], c * CELL, SURF + r * CELL, CELL, CELL);
    }
    // finds and items, under the soil that still covers them
    for (const a of dig.arts) {
      if (a.done || !a.exposed) continue;
      const x = a.x * CELL, y = SURF + a.y * CELL;
      const im = IMG[a.f.id];
      if (im.complete) {
        ctx.save();
        ctx.shadowColor = RARITY[a.f.rarity].glow; ctx.shadowBlur = 8 + Math.sin(t * 3) * 4;
        ctx.drawImage(im, x + 2, y + 2, a.w * CELL - 4, a.h * CELL - 4);
        ctx.restore();
      }
      if (a.cond < 100) drawCracks(x + 4, y + 4, a.w * CELL - 8, a.h * CELL - 8, Math.ceil((100 - a.cond) / 14), a.seed);
    }
    for (const it of dig.items) {
      if (it.done || !it.exposed) continue;
      const im = IMG[it.it.id];
      if (im.complete) ctx.drawImage(im, it.x * CELL + 3, SURF + it.y * CELL + 3, it.w * CELL - 6, it.h * CELL - 6);
    }
    // soil
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = dig.grid[r][c];
      const x = c * CELL, y = SURF + r * CELL;
      if (cell.broken) {
        const above = r === 0 ? null : dig.grid[r - 1][c];
        if (r === 0 || (above && !above.broken)) {
          const g = ctx.createLinearGradient(0, y, 0, y + CELL * 0.45);
          g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(x, y, CELL, CELL * 0.45);
        }
        const left = G(r, c - 1), right = G(r, c + 1);
        if (left && !left.broken) { const g = ctx.createLinearGradient(x, 0, x + CELL * 0.25, 0); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, CELL * 0.25, CELL); }
        if (right && !right.broken) { const g = ctx.createLinearGradient(x + CELL, 0, x + CELL * 0.75, 0); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + CELL * 0.75, y, CELL * 0.25, CELL); }
        continue;
      }
      ctx.drawImage(TEX[cell.m][cell.v], x, y, CELL, CELL);
      if (cell.hp < cell.max) drawCracks(x + 3, y + 3, CELL - 6, CELL - 6, 1 + Math.floor((1 - cell.hp / cell.max) * 4), cell.seed, 0.6);
      const below = G(r + 1, c);
      if (below && below.broken) { ctx.fillStyle = 'rgba(255,240,210,.12)'; ctx.fillRect(x, y + CELL - 2, CELL, 2); }
    }
    // era bands: a tick and a name on the side of each layer
    let prev = -1;
    for (let r = 0; r < ROWS; r++) {
      const e = dig.rowEra[r];
      if (e === prev) continue;
      prev = e;
      const y = SURF + r * CELL;
      const era = ERA[dig.eras[e]];
      ctx.save();
      if (r > 0) { ctx.strokeStyle = 'rgba(255,240,200,.28)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); }
      ctx.font = `600 ${Math.max(9, CELL * 0.24)}px Heebo, sans-serif`;
      const label = `${era.short} · ${era.years}`;
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(20,12,6,.55)';
      roundRect(W - tw - 3, y + 3, tw, CELL * 0.34, 5); ctx.fill();
      ctx.fillStyle = ERA_COLOR[era.id] ? lighten(ERA_COLOR[era.id]) : '#fff';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label, W - 8, y + 3 + CELL * 0.17);
      ctx.restore();
    }
    // treasure map X
    if (dig.mapArt && !dig.mapArt.done) {
      const a = dig.mapArt;
      const x = (a.x + a.w / 2) * CELL, y = SURF * 0.55 + Math.sin(t * 4) * 2;
      ctx.save(); ctx.strokeStyle = '#e8321e'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke(); ctx.restore();
    }
    // glints
    for (const [r, c] of dig.glints) if (Math.random() < dt * 1.6) sparkle(c * CELL + CELL / 2, SURF + r * CELL + CELL / 2, '#fff3b0', 1, CELL * 0.8);
    // sonar
    if (dig.sonarFx) {
      const s = dig.sonarFx; s.t += dt;
      const k = s.t < 0.3 ? s.t / 0.3 : s.t > 2.8 ? Math.max(0, (3.4 - s.t) / 0.6) : 1;
      if (s.t > 3.4) dig.sonarFx = null;
      else {
        ctx.save();
        const x0 = (s.c - 2) * CELL, y0 = SURF + (s.r - 2) * CELL;
        ctx.beginPath(); ctx.rect(Math.max(0, x0), Math.max(SURF, y0), CELL * 5, CELL * 5); ctx.clip();
        ctx.fillStyle = `rgba(20,80,110,${0.35 * k})`; ctx.fillRect(x0, y0, CELL * 5, CELL * 5);
        const seen = new Set();
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const cell = G(s.r + dr, s.c + dc);
          if (!cell) continue;
          if (cell.art >= 0 && !seen.has('a' + cell.art)) {
            seen.add('a' + cell.art);
            const a = dig.arts[cell.art];
            if (a.done) continue;
            ctx.globalAlpha = 0.75 * k;
            ctx.drawImage(IMG[a.f.id], a.x * CELL + 2, SURF + a.y * CELL + 2, a.w * CELL - 4, a.h * CELL - 4);
            ctx.globalAlpha = k; ctx.strokeStyle = RARITY[a.f.rarity].color; ctx.lineWidth = 2.5;
            roundRect(a.x * CELL + 1, SURF + a.y * CELL + 1, a.w * CELL - 2, a.h * CELL - 2, 6); ctx.stroke();
          }
          if (cell.item >= 0 && !seen.has('i' + cell.item)) {
            seen.add('i' + cell.item);
            const it = dig.items[cell.item];
            if (it.done) continue;
            ctx.globalAlpha = 0.65 * k;
            ctx.drawImage(IMG[it.it.id], it.x * CELL + 4, SURF + it.y * CELL + 4, it.w * CELL - 8, it.h * CELL - 8);
          }
        }
        ctx.globalAlpha = 1;
        const sweep = (s.t * 1.4) % 1;
        ctx.strokeStyle = `rgba(127,231,255,${0.6 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx(s.c), cy(s.r), sweep * CELL * 3.2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    // hover
    if (hover && !dig.over) {
      const cell = G(hover.r, hover.c);
      if (cell) {
        ctx.save();
        const col = tool === 'pick' ? '#ffcf6b' : tool === 'trowel' ? '#a8e08a' : tool === 'brush' ? '#ffffff' : tool === 'sonar' ? '#7fe7ff' : '#ff8a3d';
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        const span = tool === 'sonar' ? 2 : tool === 'dyn' ? 1 : 0;
        roundRect((hover.c - span) * CELL + 1, SURF + (hover.r - span) * CELL + 1, CELL * (span * 2 + 1) - 2, CELL * (span * 2 + 1) - 2, 5); ctx.stroke();
        if (!cell.broken && span === 0) {
          ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,.5)';
          const w = CELL * 0.7, x = hover.c * CELL + (CELL - w) / 2, y = SURF + hover.r * CELL + CELL - 7;
          ctx.fillRect(x, y, w, 3.5);
          ctx.fillStyle = col; ctx.fillRect(x, y, (w * cell.hp) / cell.max, 3.5);
        }
        ctx.restore();
      }
    }
    // rings
    rings = rings.filter((g) => (g.t += dt) < g.life);
    for (const g of rings) {
      const k = g.t / g.life;
      ctx.strokeStyle = g.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(g.x, g.y, k * CELL * 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // particles
    parts = parts.filter((p) => (p.t += dt) < p.life);
    for (const p of parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.t / p.life;
      if (p.kind === 'chunk') {
        ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 8); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = k * 0.6; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = k; ctx.fillStyle = p.color;
        star(p.x, p.y, p.size * (0.6 + Math.sin(p.t * 20) * 0.25));
      }
    }
    ctx.globalAlpha = 1;
    // finds lifting out of the ground
    flyers = flyers.filter((f) => (f.t += dt) < 1.15);
    for (const f of flyers) {
      const k = f.t;
      let x = f.x, y = f.y, s = 1, a = 1;
      if (k < 0.5) { const e = k / 0.5; s = 1 + 0.3 * Math.sin(e * Math.PI / 2); y -= e * CELL * 0.4; }
      else { const e = (k - 0.5) / 0.65; const ee = e * e; s = 1.3 - 0.9 * ee; x += (W * 0.08 - x) * ee; y += (-CELL - y) * ee - CELL * 0.4 * (1 - ee); a = 1 - ee * 0.7; }
      const w = f.w * s, h = f.h * s;
      ctx.save(); ctx.globalAlpha = a;
      if (f.rank >= 2 && k < 0.6) {
        ctx.translate(x + f.w / 2, y + f.h / 2); ctx.rotate(k * 2);
        ctx.fillStyle = f.color; ctx.globalAlpha = 0.25 * (1 - k);
        for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(CELL * 3, -CELL * 0.25); ctx.lineTo(CELL * 3, CELL * 0.25); ctx.fill(); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = a;
      }
      ctx.shadowColor = f.color; ctx.shadowBlur = 22;
      if (f.im && f.im.complete) ctx.drawImage(f.im, x + (f.w - w) / 2, y + (f.h - h) / 2, w, h);
      ctx.restore();
    }
    // floating text
    floats = floats.filter((f) => (f.t += dt) < f.life);
    for (const f of floats) {
      const k = f.t / f.life;
      ctx.save();
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      ctx.font = `800 ${f.big ? Math.max(14, CELL * 0.42) : Math.max(11, CELL * 0.32)}px Heebo, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = f.y - k * CELL * 1.2;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      ctx.restore();
    }
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = `rgba(255,248,220,${flash})`; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 1.8); }
    shake *= Math.pow(0.0008, dt);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function star(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); }
  function lighten(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.min(255, Math.round(v + (255 - v) * 0.45)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (dig) draw(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  let held = false, holdTimer = 0;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    SFX.unlock();
    const p = cellAt(e); hover = p;
    if (!p) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    strike(p.r, p.c);
    held = true; clearInterval(holdTimer);
    if (tool === 'pick' || tool === 'trowel' || tool === 'brush') holdTimer = setInterval(() => { if (held && hover) strike(hover.r, hover.c); }, 190);
  });
  cv.addEventListener('pointermove', (e) => { hover = cellAt(e); });
  const release = () => { held = false; clearInterval(holdTimer); };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('pointerleave', () => { if (!held) hover = null; });
  document.addEventListener('keydown', (e) => {
    if (!dig || $('#scr-dig').hidden || $('#modal').classList.contains('open')) return;
    const k = { 1: 'pick', 2: 'trowel', 3: 'brush', 4: 'sonar', 5: 'dyn' }[e.key];
    if (k) setTool(k);
  });

  /* ---------- dig HUD ---------- */
  function setTool(t) {
    if (!dig) return;
    if (t === 'sonar' && dig.sonar <= 0) { SFX.deny(); toast('אין סריקות סונאר. אפשר להוסיף במחנה 🔊'); return; }
    if (t === 'dyn' && dig.dyn <= 0) { SFX.deny(); toast(up('dynamite') || dig.daily ? 'נגמר חומר הנפץ' : 'חומר נפץ נפתח במחנה 🧨'); return; }
    if (t !== 'sonar' && t !== 'dyn') lastTool = t;
    tool = t; SFX.click();
    hud();
  }
  function pulseTool(t) { const b = $(`.tool[data-t="${t}"]`); if (b) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); } }
  $$('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.t)));

  function hud() {
    if (!dig) return;
    const e = dig.energy, m = Math.max(dig.maxEnergy, e);
    $('#en-fill').style.width = `${clamp((e / m) * 100, 0, 100)}%`;
    $('#en-fill').classList.toggle('low', e <= 5);
    $('#en-num').textContent = e;
    const done = dig.arts.filter((a) => a.done).length;
    $('#finds-num').textContent = `${done}/${dig.arts.length}`;
    $('#dig-coins').textContent = fmt(dig.coins);
    $$('.tool').forEach((b) => b.classList.toggle('on', b.dataset.t === tool));
    $('#t-pick-n').textContent = dig.lo.pick;
    $('#t-sonar-n').textContent = dig.sonar;
    $('#t-dyn-n').textContent = dig.dyn;
    $('.tool[data-t="sonar"]').classList.toggle('empty', dig.sonar <= 0);
    $('.tool[data-t="dyn"]').classList.toggle('empty', dig.dyn <= 0);
    const hint = { pick: 'מכוש: חזק ומהיר, אבל מכה עודפת שוברת ממצאים', trowel: 'כף: 2 נזק, פוגעת בממצאים רק מעט', brush: 'מברשת: 1 נזק, לא פוגעת לעולם', sonar: 'סונאר: הקישו על נקודה כדי לסרוק 5×5', dyn: 'חומר נפץ: הקישו כדי לפוצץ 3×3. זהירות!' }[tool];
    $('#tool-hint').textContent = hint;
  }

  /* ---------- start / end ---------- */
  function startDig(siteIdx, daily) {
    let site, seed, counted = false, useMap = false;
    if (daily) {
      const d = today();
      const R = rng(hashStr('daily' + d));
      const start = Math.floor(R() * (ERAS.length - 2));
      site = { id: 'daily-' + d, name: 'חפירת היום', place: d.split('-').reverse().join('.'), eras: ERAS.slice(start, start + 3).map((e) => e.id), mult: 2, sky: ['#ffb27a', '#ffe3b0'] };
      seed = hashStr('dig' + d);
      counted = !(S.daily && S.daily.date === d);
      siteIdx = 3;
    } else {
      site = SITES[siteIdx];
      seed = (Math.random() * 2 ** 32) >>> 0;
      if (S.maps > 0) { S.maps--; useMap = true; }
    }
    const lo = loadout(daily);
    dig = genDig(site, siteIdx, { seed, lo, daily, counted, useMap, first: !daily && S.stats.digs === 0 });
    if (daily && counted) { S.daily = { date: today(), done: false, score: 0 }; }
    save();
    tool = 'pick'; lastTool = 'pick';
    $$('.tool.pulse').forEach((b) => b.classList.remove('pulse'));
    parts = []; floats = []; flyers = []; rings = []; shake = 0; flash = 0; pendingLevels = [];
    show('dig');
    $('#dig-site').textContent = site.name;
    $('#dig-place').textContent = daily ? `${site.place} · ${counted ? 'נספר לשיא היומי' : 'אימון'}` : site.place;
    requestAnimationFrame(() => {
      layout(); SURFIMG = makeSurface(site); hud();
      if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
      tip('start', '⛏️ <b>הקישו על האדמה כדי לחפור.</b> כל מכה עולה ⚡ אחת. החזיקו את האצבע כדי לחפור ברצף.', 5200);
      if (useMap) toast('🗺️ מפת האוצר בשימוש! חפשו את ה־X בעומק', 'gold', 4200);
    });
  }

  function endDig(reason) {
    if (!dig || dig.over) return;
    dig.over = true;
    held = false; clearInterval(holdTimer);
    S.stats.digs++;
    const cleared = dig.arts.every((a) => a.done);
    let bonus = 0;
    if (cleared) {
      bonus = Math.round(dig.coins * 0.25 + dig.energy * 3 * (dig.daily ? 2 : dig.site.mult));
      dig.coins += bonus; S.coins += bonus;
      quest('clear'); quest('coins', bonus);
    }
    S.stats.bestDig = Math.max(S.stats.bestDig, dig.coins);
    if (dig.daily && dig.counted && S.daily) { S.daily.done = true; S.daily.score = dig.coins; S.daily.finds = dig.found.length; S.daily.total = dig.arts.length; S.daily.grid = shareGrid(); }
    save(); topbar();
    SFX[cleared ? 'levelup' : 'end']();
    if (cleared) confetti(70);
    const missed = dig.arts.filter((a) => !a.done);
    const rows = dig.found.map((f) => {
      const d = BY_ID[f.id]; const [cl, cc] = condLabel(f.cond);
      return `<li><img src="${D.svgUrl(d.svg)}" alt=""><span class="n">${d.name}${f.isNew ? ' <em class="new">חדש!</em>' : ''}<small style="color:${RARITY[d.rarity].color}">${RARITY[d.rarity].name}</small></span><span class="c" style="color:${cc}">${cl}</span><b>${fmt(f.value)} 🪙</b></li>`;
    }).join('');
    const missHtml = missed.length
      ? `<div class="missed"><h4>${cleared ? '' : 'עוד חיכו לכם באדמה…'}</h4><div class="miss-row">${missed.map((a) => `<span class="miss" style="--rc:${RARITY[a.f.rarity].color}" title="${a.exposed ? a.f.name : RARITY[a.f.rarity].name}"><img src="${D.svgUrl(a.f.svg)}" alt="" class="${a.exposed ? 'half' : 'sil'}"><small>${a.exposed ? a.f.name : RARITY[a.f.rarity].name}</small></span>`).join('')}</div></div>`
      : '';
    const lv = pendingLevels.length ? `<div class="lvup">⭐ עליתם לרמה ${S.lvl}!</div>` : '';
    modal(`
      <div class="m-ico">${cleared ? '🏆' : '🏺'}</div>
      <h2>${cleared ? 'האתר נחשף במלואו!' : dig.daily ? 'חפירת היום הסתיימה' : 'סוף יום החפירה'}</h2>
      <p class="sub">${dig.site.name} · ${dig.tiles} משבצות · ${dig.found.length} ממצאים</p>
      ${rows ? `<ul class="sum">${rows}</ul>` : '<p class="sub">הפעם האדמה שמרה את סודותיה. נסו להתחיל בסונאר 🔊</p>'}
      ${bonus ? `<div class="bonus">✨ בונוס על חשיפת האתר כולו: +${fmt(bonus)} 🪙</div>` : ''}
      <div class="total"><span>סה״כ</span><b>${fmt(dig.coins)} 🪙</b><span>+${dig.xp} XP</span></div>
      ${lv}${missHtml}
      <div class="m-actions">
        ${dig.daily ? '<button class="btn gold" id="m-share">📤 שתפו את התוצאה</button>' : '<button class="btn gold" id="m-again">⛏️ עוד חפירה כאן</button>'}
        <button class="btn ghost" id="m-map">למפת האתרים</button>
      </div>`, (root) => {
      const again = $('#m-again', root);
      if (again) again.onclick = () => { closeModal(); startDig(dig.siteIdx, false); };
      const sh = $('#m-share', root);
      if (sh) sh.onclick = () => shareDaily();
      $('#m-map', root).onclick = () => { closeModal(); show('map'); };
    }, false);
  }

  function shareGrid() {
    const sq = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨' };
    return dig.arts.map((a) => (a.done ? (a.cond >= 100 ? '⭐' : sq[a.f.rarity]) : '⬛')).join('');
  }
  function shareDaily() {
    const d = S.daily && S.daily.date === today() ? S.daily : null;
    const score = d ? d.score : dig ? dig.coins : 0;
    const grid = d ? d.grid : dig ? shareGrid() : '';
    const text = `🏺 שכבות · חפירת היום ${today().split('-').reverse().slice(0, 2).join('.')}\n💰 ${fmt(score)} מטבעות\n${grid}\nמי חופר יותר טוב ממני? 👇\n${location.href.split('#')[0]}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  /* ---------- the find card ---------- */
  function showFind(f, cond, value, isNew, perfect) {
    const r = RARITY[f.rarity];
    const [cl, cc] = condLabel(cond);
    if (r.rank >= 3) confetti(r.rank === 4 ? 90 : 45, r.color);
    modal(`
      <div class="find r${r.rank}" style="--rc:${r.color}">
        <div class="rays"></div>
        <div class="ribbon">${isNew ? '✦ ממצא חדש לאוסף ✦' : r.name}</div>
        <div class="art" style="aspect-ratio:${f.w}/${f.h}"><img src="${D.svgUrl(f.svg)}" alt="${f.name}"></div>
      </div>
      <h2 class="fname">${f.name}</h2>
      <p class="sub"><span class="rar" style="color:${r.color}">${r.name}</span> · ${ERA[f.era].name} · ${ERA[f.era].years}</p>
      <div class="cond"><span>מצב</span><div class="bar"><i style="width:${cond}%;background:${cc}"></i></div><b style="color:${cc}">${cl}${perfect ? ' ×1.5' : ''}</b></div>
      <p class="fact">${f.fact}</p>
      <div class="m-actions"><button class="btn gold" id="m-ok">${isNew ? '🏛️ למוזיאון!' : `+${fmt(value)} 🪙 המשך`}</button></div>`, (root) => {
      $('#m-ok', root).onclick = closeModal;
    });
  }

  /* ---------- modal / toast / confetti ---------- */
  let modalQueue = [];
  function modal(html, bind, dismiss = true) {
    const el = $('#modal');
    if (el.classList.contains('open')) { modalQueue.push([html, bind, dismiss]); return; }
    const card = $('#modal-card');
    card.innerHTML = html;
    el.dataset.dismiss = dismiss ? '1' : '';
    el.classList.add('open');
    if (bind) bind(card);
    const b = card.querySelector('button'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 50);
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    SFX.click();
    if (modalQueue.length) setTimeout(() => modal(...modalQueue.shift()), 180);
    else if (dig && !dig.over && dig.energy <= 0) setTimeout(outOfEnergy, 300);
  }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal').dataset.dismiss) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').classList.contains('open') && $('#modal').dataset.dismiss) closeModal(); });

  function toast(text, kind = '', ms = 3000) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = text;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
  }
  function confetti(n, color) {
    const host = $('#fx');
    const cols = color ? [color, '#fff6c0', '#ffffff', color] : ['#ffd34d', '#ff6b5b', '#5ab0ff', '#6fd17a', '#c27dff'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      p.style.animationDelay = Math.random() * 0.4 + 's';
      p.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
      p.style.setProperty('--rot', Math.random() * 900 + 'deg');
      host.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  /* ---------- screens ---------- */
  function show(name) {
    $$('.screen').forEach((s) => { s.hidden = s.id !== 'scr-' + name; });
    document.body.dataset.screen = name;
    $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === name));
    if (name !== 'dig') running = false;
    if (name === 'map') renderMap();
    if (name === 'museum') renderMuseum();
    if (name === 'camp') renderCamp();
    topbar();
    window.scrollTo(0, 0);
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => { SFX.unlock(); SFX.click(); show(b.dataset.go); }));
  $('#dig-exit').addEventListener('click', () => {
    if (!dig || dig.over) return show('map');
    modal(`<div class="m-ico">🏕️</div><h2>לסיים את החפירה?</h2><p>הממצאים שכבר אספתם נשמרים. מה שעוד באדמה יישאר שם.</p>
      <div class="m-actions"><button class="btn gold" id="m-stay">להמשיך לחפור</button><button class="btn ghost" id="m-quit">סיום</button></div>`, (root) => {
      $('#m-stay', root).onclick = closeModal;
      $('#m-quit', root).onclick = () => { closeModal(); endDig('quit'); };
    });
  });

  function topbar() {
    $('#lvl').textContent = S.lvl;
    $('#xp-fill').style.width = `${clamp((S.xp / xpFor(S.lvl)) * 100, 0, 100)}%`;
    $('#coins').textContent = fmt(S.coins);
    $('#frags').textContent = S.maps ? `🗺️×${S.maps}` : `${S.frags}/3`;
    $('#snd').textContent = S.sound ? '🔊' : '🔇';
  }
  $('#snd').addEventListener('click', () => { S.sound = !S.sound; SFX.setEnabled(S.sound); save(); topbar(); SFX.click(); });

  function renderMap() {
    ensureQuests(); save();
    const d = today();
    const dd = S.daily && S.daily.date === d ? S.daily : null;
    $('#daily').innerHTML = `
      <div class="daily-l"><span class="tag">אתגר יומי</span><h3>חפירת היום</h3><p>אותו אתר בדיוק לכל השחקנים: 60 אנרגיה, אותם כלים ואותם ממצאים. הניסיון הראשון נספר.</p></div>
      <div class="daily-r">${dd && dd.done
        ? `<div class="score">${fmt(dd.score)} 🪙</div><div class="grid">${dd.grid || ''}</div><button class="btn gold sm" id="d-share">📤 שיתוף</button><button class="btn ghost sm" id="d-play">אימון</button>`
        : '<button class="btn gold" id="d-play">⛏️ לחפור עכשיו</button>'}</div>`;
    $('#d-play').onclick = () => startDig(0, true);
    const ds = $('#d-share'); if (ds) ds.onclick = shareDaily;

    $('#quests').innerHTML = `<h3>משימות היום <small>מתחלפות בחצות</small></h3>` + S.quests.list.map((q, i) => {
      const def = QPOOL.find((z) => z.type === q.type);
      const done = q.prog >= q.goal;
      return `<div class="q ${q.claimed ? 'claimed' : done ? 'ready' : ''}"><span class="qt">${def.text}</span><div class="bar"><i style="width:${(q.prog / q.goal) * 100}%"></i></div><span class="qp">${q.claimed ? '✔' : `${q.prog}/${q.goal}`}</span>${done && !q.claimed ? `<button class="btn gold sm" data-claim="${i}">+${questReward()} 🪙</button>` : ''}</div>`;
    }).join('');
    $$('[data-claim]').forEach((b) => b.onclick = () => {
      const q = S.quests.list[+b.dataset.claim];
      if (q.claimed) return;
      q.claimed = true; S.coins += questReward(); SFX.coin(); confetti(25); save(); renderMap(); topbar();
    });

    $('#maps-note').innerHTML = S.maps ? `🗺️ יש לכם <b>${S.maps === 1 ? 'מפת אוצר' : `${S.maps} מפות אוצר`}</b>. היא תופעל אוטומטית בחפירה הבאה באתר רגיל.` : `🗺️ קרעי מפת אוצר: <b>${S.frags}/3</b>. מוצאים אותם באדמה.`;

    $('#sites').innerHTML = SITES.map((s, i) => {
      const locked = S.lvl < s.level;
      const all = FINDS.filter((f) => s.eras.includes(f.era));
      const got = all.filter((f) => S.museum[f.id] && S.museum[f.id].n).length;
      const strata = s.eras.map((e) => `<i style="background:${ERA_COLOR[e]}"></i>`).join('');
      return `<button class="site ${locked ? 'locked' : ''}" data-site="${i}" ${locked ? 'aria-disabled="true"' : ''}>
        <div class="thumb" style="--s0:${s.sky[0]};--s1:${s.sky[1]}"><div class="strata">${strata}</div>${locked ? `<div class="lock">🔒 רמה ${s.level}</div>` : `<div class="mult">×${s.mult} ערך</div>`}</div>
        <div class="info"><h4>${s.name}</h4><small>${s.place}</small><p>${s.blurb}</p>
        <div class="chips">${s.eras.map((e) => `<span style="--ec:${ERA_COLOR[e]}">${ERA[e].short}</span>`).join('')}</div>
        <div class="prog"><div class="bar"><i style="width:${(got / all.length) * 100}%"></i></div><small>${got}/${all.length} באוסף</small></div></div></button>`;
    }).join('');
    $$('.site').forEach((b) => b.onclick = () => {
      const i = +b.dataset.site;
      if (S.lvl < SITES[i].level) { SFX.deny(); toast(`האתר ייפתח ברמה ${SITES[i].level}. חפרו עוד כדי לעלות רמה ⭐`); return; }
      SFX.click(); startDig(i, false);
    });
  }

  let museumEra = 'all';
  function renderMuseum() {
    const found = FINDS.filter((f) => S.museum[f.id] && S.museum[f.id].n).length;
    $('#mus-head').innerHTML = `<div class="big">${found}<small>/${FINDS.length}</small></div><div><h2>המוזיאון שלי</h2><p>כל ממצא חדש נכנס לכאן. אוסף שלם של תקופה מעלה את ערך הממצאים שלה ב־15%.</p><div class="bar"><i style="width:${(found / FINDS.length) * 100}%"></i></div></div>`;
    $('#mus-tabs').innerHTML = [['all', 'הכל']].concat(ERAS.map((e) => [e.id, e.short])).map(([id, n]) => {
      const done = id !== 'all' && eraComplete(id);
      return `<button class="chip ${museumEra === id ? 'on' : ''}" data-era="${id}" style="--ec:${ERA_COLOR[id] || '#f2c14e'}">${n}${done ? ' 🏆' : ''}</button>`;
    }).join('');
    $$('#mus-tabs .chip').forEach((b) => b.onclick = () => { museumEra = b.dataset.era; SFX.click(); renderMuseum(); });
    const list = FINDS.filter((f) => museumEra === 'all' || f.era === museumEra)
      .sort((a, b) => ERAS.findIndex((e) => e.id === a.era) - ERAS.findIndex((e) => e.id === b.era) || RARITY[a.rarity].rank - RARITY[b.rarity].rank);
    $('#mus-grid').innerHTML = list.map((f) => {
      const m = S.museum[f.id];
      const r = RARITY[f.rarity];
      return `<button class="exhibit ${m ? '' : 'unknown'}" data-id="${f.id}" style="--rc:${r.color}">
        <div class="pic"><img src="${D.svgUrl(f.svg)}" alt="" style="aspect-ratio:${f.w}/${f.h}"></div>
        <b>${m ? f.name : '???'}</b><small style="color:${r.color}">${r.name}</small>${m ? `<span class="cnt">×${m.n}${m.best >= 100 ? ' ⭐' : ''}</span>` : ''}</button>`;
    }).join('');
    $$('.exhibit').forEach((b) => b.onclick = () => {
      const f = BY_ID[b.dataset.id], m = S.museum[f.id];
      if (!m) { toast(`עוד לא נמצא. מחפשים אותו ב${ERA[f.era].name} 🔎`); return; }
      showFind(f, m.best, 0, false, m.best >= 100);
      const ok = $('#m-ok'); if (ok) ok.textContent = 'סגירה';
    });
    $('#stats').innerHTML = `<span>⛏️ ${fmt(S.stats.tiles)} משבצות</span><span>🏺 ${fmt(S.stats.finds)} ממצאים</span><span>⭐ ${fmt(S.stats.perfect)} מושלמים</span><span>🏆 שיא חפירה: ${fmt(S.stats.bestDig)} 🪙</span>`;
  }
  $('#reset').addEventListener('click', () => {
    modal(`<div class="m-ico">⚠️</div><h2>לאפס את כל ההתקדמות?</h2><p>המוזיאון, המטבעות והשדרוגים יימחקו לגמרי.</p><div class="m-actions"><button class="btn danger" id="m-yes">כן, לאפס</button><button class="btn ghost" id="m-no">ביטול</button></div>`, (root) => {
      $('#m-yes', root).onclick = () => { S = fresh(); save(); closeModal(); show('home'); };
      $('#m-no', root).onclick = closeModal;
    });
  });

  function renderCamp() {
    $('#ups').innerHTML = UPS.map((u) => {
      const l = up(u.id), maxed = l >= u.max, cost = upCost(u);
      return `<div class="up ${maxed ? 'max' : ''}"><div class="ui">${u.icon}</div><div class="ut"><h4>${u.name}</h4><p>${u.desc(l)}</p>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn ${maxed ? 'ghost' : 'gold'} sm" data-up="${u.id}" ${maxed || S.coins < cost ? 'disabled' : ''}>${maxed ? 'מקסימום' : `${fmt(cost)} 🪙`}</button></div>`;
    }).join('');
    $$('[data-up]').forEach((b) => b.onclick = () => {
      const u = UPS.find((z) => z.id === b.dataset.up);
      const cost = upCost(u);
      if (S.coins < cost || up(u.id) >= u.max) return;
      S.coins -= cost; S.up[u.id] = up(u.id) + 1; save();
      SFX.levelup(); toast(`${u.icon} ${u.name} שודרג לרמה ${up(u.id)}!`, 'gold');
      renderCamp(); topbar();
    });
  }

  /* ---------- home ---------- */
  $('#play').addEventListener('click', () => { SFX.unlock(); SFX.click(); show('map'); });
  (function heroFloaters() {
    const host = $('#hero-finds');
    const pick = ['r_head', 's_shekel', 'o_dallah', 'b_amphora', 'k_ivory', 'c_sword', 'f_bulla', 'p_handaxe'];
    host.innerHTML = pick.map((id, i) => `<img src="${D.svgUrl(BY_ID[id].svg)}" alt="" style="--i:${i}">`).join('');
  })();
  if (S.stats.digs > 0) $('#play').textContent = 'להמשיך לחפור ⛏️';

  window.addEventListener('resize', () => { if (dig && !$('#scr-dig').hidden) { layout(); } });
  topbar();
  show('home');

  // exposed for checks in the browser console
  window.SHCHAVOT_GAME = { state: () => S, dig: () => dig, startDig, endDig, MATS };
})();
