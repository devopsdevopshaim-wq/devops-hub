/* שכבות — the game: save, dig generation, canvas rendering, effects, screens. */
(function () {
  'use strict';
  const D = window.SHCHAVOT;
  const { RARITY, ERAS, FINDS, BY_ID, ITEMS, SITES } = D;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const COLS = 9, ROWS = 13;
  const SUB = 4, FC = COLS * SUB, FR = ROWS * SUB; // the fine ground the tools actually carve
  const fmt = (n) => Math.round(n).toLocaleString('he-IL');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const { ICONS, scene } = window.SHCHAVOT_ICONS;
  const ICO_URL = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, D.svgUrl(v)]));
  const ico = (name, cls = 'ico') => `<img class="${cls}" src="${ICO_URL[name]}" alt="">`;
  const PH = window.SHCHAVOT_PHOTOS || { sites: {}, finds: {} };
  const PHIMG = {};
  const photo = (src) => { if (!PHIMG[src]) { const im = new Image(); im.decoding = 'async'; im.src = src; PHIMG[src] = im; } return PHIMG[src]; };
  const sitePhoto = (site) => PH.sites[site.id && site.id.startsWith('daily') ? 'daily' : site.id];
  const credit = (p) => `צילום: ${esc(p.artist)} · ${esc(p.license)} · <a href="${p.page}" target="_blank" rel="noopener">ויקישיתוף</a>`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
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
  const fresh = () => ({ music: true, coins: 0, xp: 0, lvl: 1, up: {}, museum: {}, frags: 0, maps: 0, stats: { tiles: 0, finds: 0, perfect: 0, digs: 0, bestDig: 0 }, quests: null, daily: null, tut: {}, sound: true });
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return Object.assign(fresh(), s); } catch (e) { /* private mode */ }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage off: the run still plays */ } }
  const up = (id) => S.up[id] || 0;
  SFX.setEnabled(S.sound);
  if (S.music === undefined) S.music = true;
  MUSIC.set(S.music);
  document.addEventListener('pointerdown', () => MUSIC.kick());

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
    { id: 'detector', icon: '📡', name: 'גלאי מתכות', max: 4, base: 110, desc: (l) => `ניצוצות מגלים ממצאים במרחק ${1 + l}${l < 4 ? ` ← ${2 + l}` : ''} צעדים משולי הבור.` },
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
    { type: 'tiles', goal: 60, text: '60 מכות חפירה' },
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

  D.MATS3D = MATS;

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
    const waveK = R() * 6;
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const t = r / (ROWS - 1);
      for (let c = 0; c < COLS; c++) {
        // layers run sideways and wave a little, like real strata
        const wave = Math.sin(c * 0.7 + waveK) * 0.55 + Math.sin(c * 1.9 + waveK * 2) * 0.25;
        let m = r === 0 ? 0 : clamp(Math.round(1 + ((r + wave) / (ROWS - 1)) * (2.4 + Math.min(2.2, siteIdx * 0.55)) + (R() - 0.5) * 0.7), 1, 6);
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

    // the ground itself: every cell is SUB×SUB small pieces, each a little harder or softer than its neighbours
    const RF = rng((opts.seed ^ 0x9e3779b9) >>> 0);
    const N = FC * FR;
    const fhp = new Float32Array(N), fmax = new Float32Array(N), fmat = new Uint8Array(N), fdug = new Uint8Array(N);
    const fart = new Int16Array(N).fill(-1), fitem = new Int16Array(N).fill(-1);
    // strata that wave across the section, lenses of other material, and stones
    const span = 2.4 + Math.min(2.2, siteIdx * 0.55);
    const k1 = RF() * 6, k2 = RF() * 6, k3 = RF() * 6;
    const lenses = Array.from({ length: 5 + Math.floor(RF() * 4) }, () => ({ x: RF() * FC, y: 4 + RF() * (FR - 4), rx: 3 + RF() * 8, ry: 1 + RF() * 2.2, m: 1 + Math.floor(RF() * 6) }));
    const stones = Array.from({ length: 3 + Math.floor(RF() * 3) + Math.min(5, siteIdx) }, () => ({ x: 1 + RF() * (FC - 2), y: 6 + RF() * (FR - 7), r: 1.3 + RF() * 1.6, m: siteIdx > 0 && RF() < 0.45 ? 7 : 6, seed: Math.floor(RF() * 1e9) }));
    for (let fy = 0; fy < FR; fy++) for (let fx = 0; fx < FC; fx++) {
      const cell = grid[(fy / SUB) | 0][(fx / SUB) | 0], i = fy * FC + fx;
      const wave = Math.sin(fx * 0.17 + k1) * 2.4 + Math.sin(fx * 0.43 + k2) * 1 + Math.sin(fx * 0.9 + k3) * 0.35;
      let m = fy < 2 + (Math.sin(fx * 0.5 + k1) > 0.6 ? 1 : 0) ? 0 : clamp(Math.round(1 + ((fy + wave) / (FR - 1)) * span + (RF() - 0.5) * 0.35), 1, 6);
      for (const l of lenses) if (fy > 2 && ((fx - l.x) / l.rx) ** 2 + ((fy - l.y + Math.sin(fx * 0.4) * 0.6) / l.ry) ** 2 < 1) m = l.m;
      for (const st of stones) if ((fx + 0.5 - st.x) ** 2 + (fy + 0.5 - st.y) ** 2 < st.r * st.r) m = st.m;
      fmat[i] = m; fart[i] = cell.art; fitem[i] = cell.item;
      fhp[i] = fmax[i] = (MATS[m].hp + (m ? hpBonus : 0)) * 0.6 * (0.85 + RF() * 0.3);
    }
    arts.forEach((a) => { a.total = a.w * a.h * SUB * SUB; a.exposed = 0; });
    items.forEach((it) => { it.total = it.w * it.h * SUB * SUB; it.exposed = 0; });

    return {
      fhp, fmax, fmat, fdug, fart, fitem, stones,
      site, siteIdx, daily: !!opts.daily, counted: !!opts.counted, grid, arts, items, rowEra, eras, lo,
      energy: lo.energy, maxEnergy: lo.energy, sonar: lo.sonar, dyn: lo.dyn,
      found: [], coins: 0, xp: 0, bought: 0, over: false, mapArt, glints: [], tiles: 0,
    };
  }

  /* ---------- the 3D excavation (js/dig3d.js) ---------- */
  let dig = null, tool = 'pick', lastTool = 'pick', pendingFinds = 0, flash = 0;
  const G3 = () => window.DIG3D;
  const V = (x, y, z) => G3().vec(x, y, z);
  const floatText = (p, text, color = '#fff', big = false) => G3() && G3().fx.float(p, text, color, big);
  const sparkle = (p, color, n, spread) => G3() && G3().fx.sparkle(p, color, n, spread);
  const shakeCam = (a) => G3() && G3().fx.shake(a);
  function flashScreen(a) { const el = $('#flash'); el.style.transition = 'none'; el.style.opacity = a; requestAnimationFrame(() => { el.style.transition = 'opacity .9s'; el.style.opacity = 0; }); }

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
    pick: { name: 'מכוש', r: 0.75, harm: 26, color: '#ffcf6b' },
    trowel: { name: 'כף', r: 0.55, p: 3, harm: 10, color: '#a8f08a' },
    brush: { name: 'מברשת', r: 0.45, p: 2.4, harm: 0, color: '#ffffff' },
    dyn: { r: 1.6, p: 12, harm: 22, color: '#ff8a3d' },
    sonar: { r: 2.9, color: '#7fe7ff' },
  };
  function strike(p) {
    if (!dig || dig.over || !G3()) return;
    if (tool === 'sonar') return useSonar(p);
    if (tool === 'dyn') return useDynamite(p);
    if (dig.energy <= 0) return outOfEnergy();
    const T = TOOL[tool];
    const res = G3().carve(p, { r: T.r, power: tool === 'pick' ? dig.lo.pick : T.p, harm: T.harm, kind: tool });
    if (!res.touched) return; // nothing left to dig there: free
    dig.energy--;
    if (tool === 'brush') quest('brush');
    if (navigator.vibrate && tool === 'pick') try { navigator.vibrate(8); } catch (e) { /* no haptics */ }
    applyCarve(p, res, tool);
    hud();
    if (dig.energy <= 0) setTimeout(() => { if (dig && !dig.over && dig.energy <= 0) outOfEnergy(); }, 900);
  }

  function applyCarve(p, res, how) {
    const g = G3();
    if (how === 'pick') { SFX.hit(res.hard); shakeCam(0.12); }
    else if (how === 'trowel') { SFX.trowel(); shakeCam(0.05); }
    else if (how === 'brush') SFX.brush();
    if (res.removed > 0.01) SFX.breakTile(res.hard);
    if (res.stoneHit) { SFX.hit(1); floatText(p, 'סלע!', '#d8d2c8'); }
    if (res.stoneBroke) { SFX.breakTile(1); shakeCam(0.18); floatText(p, 'הסלע נשבר', '#ffd9a0'); }
    const amt = Math.min(1, res.removed / 30);
    g.fx.burst(p, res.colors, how === 'brush' ? 3 : 5 + Math.round(amt * 14), how === 'brush' ? 0.45 : 0.8 + amt * 0.4);
    g.fx.dust(p, how === 'brush' ? '#e8d6b4' : '#bfa47c', how === 'brush' ? 7 : 4 + Math.round(amt * 6), 0.5);
    for (const [a, h] of res.harmed) {
      if (a.done) continue;
      const was = a.cond;
      a.cond = Math.max(5, Math.round(a.cond - h * (1 - 0.12 * dig.lo.restore)));
      if (a.cond < was) {
        SFX.crack();
        floatText(g.artCenter(a), `−${was - a.cond}% שבר!`, '#ff6b5b');
        g.fx.burst(g.artCenter(a), ['#ffffff', '#ffd27a'], 8, 0.7);
        tip('damage', '💥 אוי! המכה פגעה בממצא. <b>ליד ממצאים עדיף לעבוד עם המברשת או עם הכף.</b>');
      }
    }
    if (res.removed > 0.01) {
      dig.tiles++; S.stats.tiles++; quest('tiles');
      dig.xp += 1; addXP(1);
      if (how !== 'dyn') {
        const nowMs = performance.now();
        dig.combo = nowMs - (dig.lastBreak || 0) < 1500 ? (dig.combo || 0) + 1 : 1;
        dig.lastBreak = nowMs;
        if (dig.combo >= 3) comboPop(dig.combo);
        if (dig.combo % 5 === 0) {
          const cb = Math.round(2 * (dig.daily ? 2 : dig.site.mult) * Math.min(4, dig.combo / 5));
          dig.coins += cb; S.coins += cb; quest('coins', cb); dig.xp += 2; addXP(2);
          floatText(p, `🔥 רצף! +${cb}`, '#ffb347'); SFX.coin();
        }
      }
    }
    for (const a of res.first) {
      if (!a.f) continue;
      SFX.reveal(); sparkle(g.artCenter(a), RARITY[a.f.rarity].color, 10, 0.6);
      tip('reveal', '🪶 מצאתם משהו! <b>עברו למברשת</b> וחשפו אותו בעדינות. מכה חזקה מדי פוגעת בממצא.', 6000);
      pulseTool('brush');
    }
    for (const z of res.done) { if (z.done) continue; if (z.f) completeArt(z); else collectItem(z); }
  }
  let comboTimer = 0;
  function comboPop(n) {
    const el = $('#combo'); el.textContent = `רצף ×${n}`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(comboTimer); comboTimer = setTimeout(() => el.classList.remove('pop'), 1400);
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
    if (rar.rank >= 3) { flashScreen(rar.rank === 4 ? 0.85 : 0.45); shakeCam(0.25); }
    G3().fx.lift(a, rar.color, rar.rank);
    floatText(G3().artCenter(a), `+${fmt(value)} 🪙${perfect ? ' מושלם!' : ''}`, perfect ? '#ffd34d' : '#fff', true);
    save(); hud();
    const eraNowDone = isNew && eraComplete(a.f.era);
    pendingFinds++;
    setTimeout(() => {
      pendingFinds--;
      if (isNew || rar.rank >= 2) showFind(a.f, a.cond, value, isNew, perfect);
      if (eraNowDone) toast(`🏛️ השלמתם את אוסף ${ERA[a.f.era].name}! מעכשיו +15% לערך הממצאים מהתקופה`, 'gold', 5000);
      if (dig && !dig.over && dig.arts.every((z) => z.done)) setTimeout(() => endDig('cleared'), isNew || rar.rank >= 2 ? 50 : 700);
    }, 950);
  }

  function collectItem(it) {
    it.done = true;
    const at = G3().artCenter(it);
    const mult = dig.daily ? 2 : dig.site.mult;
    quest('items');
    G3().fx.lift(it, '#ffffff', 0);
    if (it.it.id === 'canteen') {
      dig.energy += 8; SFX.water(); floatText(at, '+8 ⚡', '#7fd3ff', true);
    } else if (it.it.id === 'pouch' || it.it.id === 'chest') {
      const v = Math.round((it.it.id === 'chest' ? 120 + Math.random() * 120 : 15 + Math.random() * 25) * mult);
      dig.coins += v; S.coins += v; quest('coins', v);
      SFX.coin(); floatText(at, `+${fmt(v)} 🪙`, '#ffd34d', true);
      sparkle(at, '#ffd34d', it.it.id === 'chest' ? 30 : 10, 0.8);
      if (it.it.id === 'chest') { shakeCam(0.2); toast(`📦 תיבת אוצר! +${fmt(v)} מטבעות`, 'gold'); }
    } else if (it.it.id === 'mapfrag') {
      SFX.reveal();
      if (!dig.daily) {
        S.frags++;
        if (S.frags >= 3) { S.frags -= 3; S.maps++; toast('🗺️ הרכבתם מפת אוצר! בחפירה הבאה מחכה בעומק ממצא נדיר ביותר, מסומן ב־X', 'gold', 5200); }
        else toast(`🗺️ קרע של מפת אוצר (${S.frags}/3)`, 'gold');
      }
      floatText(at, '🗺️ קרע מפה', '#ffe7a8', true);
    }
    save(); hud(); topbar();
  }

  function useSonar(p) {
    if (dig.sonar <= 0) { SFX.deny(); return; }
    dig.sonar--;
    SFX.sonar();
    G3().sonar(p);
    setTool(lastTool); hud();
  }
  function useDynamite(p) {
    if (dig.dyn <= 0) { SFX.deny(); return; }
    dig.dyn--;
    SFX.boom(); shakeCam(0.6); flashScreen(0.5);
    const res = G3().carve(p, { r: TOOL.dyn.r, power: TOOL.dyn.p, harm: TOOL.dyn.harm, kind: 'dyn' });
    G3().fx.burst(p, ['#ffdd57', '#ff8a3d', '#5a4a3a', '#2a2018'], 60, 1.6);
    G3().fx.dust(p, '#6a5a4a', 30, 1.6);
    applyCarve(p, res, 'dyn');
    setTool(lastTool); hud();
  }

  function outOfEnergy() {
    if (!dig || dig.over || $('#modal').classList.contains('open')) return;
    if (pendingFinds > 0) { setTimeout(outOfEnergy, 400); return; }
    if (dig.dyn > 0) { toast('⚡ נגמרה האנרגיה, אבל נשאר לכם חומר נפץ 🧨', 'gold'); return; }
    const cost = Math.round(25 * (dig.daily ? 2 : dig.site.mult) * (1 + dig.bought));
    const half = dig.arts.filter((a) => !a.done && a.exposed > 0).length;
    const canBuy = !dig.daily && S.coins >= cost;
    SFX.deny();
    modal(`
      <div class="m-ico">${ico('bolt', 'big')}</div>
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

  /* ---------- input (the engine picks the point, the game decides) ---------- */
  let held = false, holdTimer = 0, hoverP = null;
  const toolRadius = () => (TOOL[tool] || TOOL.pick).r;
  function hoverAt(p) {
    hoverP = p;
    if (!G3()) return;
    G3().setHover(p, toolRadius(), (TOOL[tool] || TOOL.pick).color);
    const g = $('#gauge');
    if (p && dig) {
      const e = G3().eraAt(p.x, p.z);
      if (e) { g.classList.add('on'); $('#g-depth').textContent = e.depth.toFixed(1) + ' מ׳'; $('#g-era').textContent = ERA[e.era].name; $('#g-years').textContent = ERA[e.era].years; $('#g-fill').style.height = Math.min(100, (e.depth / (13 * 0.34)) * 100) + '%'; }
    }
  }
  const digHandlers = {
    down(p) {
      SFX.unlock();
      hoverAt(p); strike(p);
      held = true; clearInterval(holdTimer);
      if (tool === 'pick' || tool === 'trowel' || tool === 'brush') holdTimer = setInterval(() => { if (held && hoverP) strike(hoverP); }, tool === 'brush' ? 130 : 210);
    },
    move(p) { hoverAt(p); },
    release() { held = false; clearInterval(holdTimer); },
  };
  document.addEventListener('keydown', (e) => {
    if (!dig || $('#scr-dig').hidden || $('#modal').classList.contains('open')) return;
    const k = { 1: 'pick', 2: 'trowel', 3: 'brush', 4: 'sonar', 5: 'dyn' }[e.key];
    if (k) setTool(k);
    if (e.key === 'q' || e.key === 'ArrowLeft') G3().rotate(-1);
    if (e.key === 'e' || e.key === 'ArrowRight') G3().rotate(1);
  });
  $('#rot-l').addEventListener('click', () => G3() && G3().rotate(-1));
  $('#rot-r').addEventListener('click', () => G3() && G3().rotate(1));

  /* ---------- dig HUD ---------- */
  function setTool(t) {
    if (!dig) return;
    if (t === 'sonar' && dig.sonar <= 0) { SFX.deny(); toast('אין סריקות סונאר. אפשר להוסיף במחנה 🔊'); return; }
    if (t === 'dyn' && dig.dyn <= 0) { SFX.deny(); toast(up('dynamite') || dig.daily ? 'נגמר חומר הנפץ' : 'חומר נפץ נפתח במחנה 🧨'); return; }
    if (t !== 'sonar' && t !== 'dyn') lastTool = t;
    tool = t; SFX.click();
    if (hoverP) hoverAt(hoverP);
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
    countTo($('#dig-coins'), dig.coins);
    $$('.tool').forEach((b) => b.classList.toggle('on', b.dataset.t === tool));
    $('#t-pick-n').textContent = dig.lo.pick;
    $('#t-sonar-n').textContent = dig.sonar;
    $('#t-dyn-n').textContent = dig.dyn;
    $('.tool[data-t="sonar"]').classList.toggle('empty', dig.sonar <= 0);
    $('.tool[data-t="dyn"]').classList.toggle('empty', dig.dyn <= 0);
    const hint = { pick: 'מכוש: חזק ורחב, שובר סלע, אבל מכה עודפת שוברת ממצאים', trowel: 'כף: מדויקת, פוגעת בממצאים רק מעט', brush: 'מברשת: מנקה אדמה רכה ולא פוגעת לעולם. על סלע היא חלשה', sonar: 'סונאר: הקישו על נקודה כדי לסרוק 5×5', dyn: 'חומר נפץ: הקישו כדי לפוצץ 3×3. זהירות!' }[tool];
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
    pendingLevels = [];
    show('dig');
    $('#dig-site').textContent = site.name;
    const bgp = sitePhoto(site);
    $('#scr-dig').style.setProperty('--bgphoto', bgp ? `url("${bgp.src}")` : 'none');
    $('#dig-place').textContent = daily ? `${site.place} · ${counted ? 'נספר לשיא היומי' : 'אימון'}` : site.place;
    requestAnimationFrame(() => {
      hud();
      if (!G3() || !G3().start($('#pit3d'), dig, site, digHandlers)) { toast('הדפדפן הזה לא תומך בתלת־ממד (WebGL). נסו בכרום או בספארי מעודכנים.', '', 6000); return; }
      tip('start', '⛏️ <b>הקישו על הקרקע בריבוע החפירה.</b> כל מכה עולה ⚡ אחת. החזיקו לחפירה ברצף, ושתי אצבעות מסובבות את המצלמה.', 6000);
      if (useMap) toast('🗺️ מפת האוצר בשימוש! בעומק הבור מחכה ממצא נדיר ביותר', 'gold', 4200);
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
      return `<li><img src="${D.svgUrl(d.svg)}" alt=""><span class="n">${d.name}${f.isNew ? ' <em class="new">חדש!</em>' : ''}<small style="color:${RARITY[d.rarity].color}">${RARITY[d.rarity].name}</small></span><span class="c" style="color:${cc}">${cl}</span><b>${fmt(f.value)} ${ico('coin', 'ico sm')}</b></li>`;
    }).join('');
    const missHtml = missed.length
      ? `<div class="missed"><h4>${cleared ? '' : 'עוד חיכו לכם באדמה…'}</h4><div class="miss-row">${missed.map((a) => `<span class="miss" style="--rc:${RARITY[a.f.rarity].color}" title="${a.exposed ? a.f.name : RARITY[a.f.rarity].name}"><img src="${D.svgUrl(a.f.svg)}" alt="" class="${a.exposed ? 'half' : 'sil'}"><small>${a.exposed ? a.f.name : RARITY[a.f.rarity].name}</small></span>`).join('')}</div></div>`
      : '';
    const lv = pendingLevels.length ? `<div class="lvup">${ico('star')} עליתם לרמה ${S.lvl}!</div>` : '';
    if (pendingLevels.length) {
      const unlocked = SITES.filter((z) => pendingLevels.includes(z.level));
      confetti(60);
      modal(`<div class="levelup"><div class="lv-rays"></div><div class="lv-star">${ico('star')}<b>${S.lvl}</b></div></div>
        <h2 class="lv-title">רמה חדשה!</h2><p class="sub">החוקר שלכם מתקדם. עוד מטבעות, עוד אתרים, עוד סודות.</p>
        ${unlocked.map((z) => `<div class="lv-site"><div class="mini">${PH.sites[z.id] ? `<img src="${PH.sites[z.id].src}" alt="">` : scene(z, z.eras.map((e) => ERA_COLOR[e]))}</div><div><small>אתר חדש נפתח</small><b>${z.name}</b></div></div>`).join('')}
        <div class="m-actions"><button class="btn gold" id="m-lv">מעולה!</button></div>`, (root) => { $('#m-lv', root).onclick = closeModal; }, false);
    }
    modal(`
      <div class="m-ico">${ico(cleared ? 'trophy' : 'vase', 'big')}</div>
      <h2>${cleared ? 'האתר נחשף במלואו!' : dig.daily ? 'חפירת היום הסתיימה' : 'סוף יום החפירה'}</h2>
      <p class="sub">${dig.site.name} · ${dig.tiles} מכות · ${dig.found.length} ממצאים</p>
      ${rows ? `<ul class="sum">${rows}</ul>` : '<p class="sub">הפעם האדמה שמרה את סודותיה. נסו להתחיל בסונאר 🔊</p>'}
      ${bonus ? `<div class="bonus">✨ בונוס על חשיפת האתר כולו: +${fmt(bonus)} 🪙</div>` : ''}
      <div class="total"><span>סה״כ</span><b>${fmt(dig.coins)} ${ico('coin', 'ico md')}</b><span>+${dig.xp} XP</span></div>
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
      <div class="find r${r.rank} ${r.rank >= 3 ? 'holo' : ''}" style="--rc:${r.color}">
        <div class="rays"></div>
        <div class="ribbon">${isNew ? '✦ ממצא חדש לאוסף ✦' : r.name}</div>
        <div class="art" style="aspect-ratio:${f.w}/${f.h}"><img src="${D.svgUrl(f.svg)}" alt="${f.name}"></div>
      </div>
      <h2 class="fname">${f.name}</h2>
      <p class="sub"><span class="rar" style="color:${r.color}">${r.name}</span> · ${ERA[f.era].name} · ${ERA[f.era].years}</p>
      <div class="cond"><span>מצב</span><div class="bar"><i style="width:${cond}%;background:${cc}"></i></div><b style="color:${cc}">${cl}${perfect ? ' ×1.5' : ''}</b></div>
      <p class="fact">${f.fact}</p>
      ${PH.finds[f.id] ? `<figure class="real"><img src="${PH.finds[f.id].src}" alt="${esc(PH.finds[f.id].caption)}"><figcaption><b>📷 בעולם האמיתי</b>${esc(PH.finds[f.id].caption)}<small>${credit(PH.finds[f.id])}</small></figcaption></figure>` : ''}
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
    if (name !== 'dig' && name !== 'home' && G3()) G3().stop();
    if (name === 'home') homeScene(); else SHCHAVOT_HERO.stop();
    SHCHAVOT_HERO.bg(name === 'map' || name === 'museum' || name === 'camp');
    if (name === 'map') renderMap();
    if (name === 'museum') renderMuseum();
    if (name === 'camp') renderCamp();
    topbar();
    window.scrollTo(0, 0);
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => { SFX.unlock(); SFX.click(); show(b.dataset.go); }));
  $('#dig-exit').addEventListener('click', () => {
    if (!dig || dig.over) return show('map');
    modal(`<div class="m-ico">${ico('camp', 'big')}</div><h2>לסיים את החפירה?</h2><p>הממצאים שכבר אספתם נשמרים. מה שעוד באדמה יישאר שם.</p>
      <div class="m-actions"><button class="btn gold" id="m-stay">להמשיך לחפור</button><button class="btn ghost" id="m-quit">סיום</button></div>`, (root) => {
      $('#m-stay', root).onclick = closeModal;
      $('#m-quit', root).onclick = () => { closeModal(); endDig('quit'); };
    });
  });

  function topbar() {
    $('#lvl').textContent = S.lvl;
    $('#xp-fill').style.width = `${clamp((S.xp / xpFor(S.lvl)) * 100, 0, 100)}%`;
    countTo($('#coins'), S.coins);
    $('#frags').textContent = S.maps ? `🗺️×${S.maps}` : `${S.frags}/3`;
    $('#snd').innerHTML = ico(S.sound ? 'soundOn' : 'soundOff');
    $('#mus').innerHTML = ico(S.music ? 'music' : 'musicOff');
  }
  function countTo(el, to) {
    const from = +(el.dataset.v || 0);
    el.dataset.v = to;
    if (from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) * 2);
    el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump');
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1 && el.dataset.v == to) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  $('#mus').addEventListener('click', () => { S.music = !S.music; MUSIC.set(S.music); if (S.music) MUSIC.kick(); save(); topbar(); SFX.click(); });
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
      return `<button class="site ${locked ? 'locked' : ''}" data-site="${i}" ${locked ? 'aria-disabled="true"' : ''}>
        <div class="thumb">${PH.sites[s.id] ? `<img class="ph" src="${PH.sites[s.id].src}" alt="${esc(PH.sites[s.id].caption)}" loading="lazy"><div class="strata">${s.eras.map((e) => `<i style="background:${ERA_COLOR[e]}"></i>`).join('')}</div>` : scene(s, s.eras.map((e) => ERA_COLOR[e]))}${locked ? `<div class="lock">${ico('lock')}רמה ${s.level}</div>` : `<div class="mult">×${s.mult} ערך</div>`}<span class="shine"></span></div>
        <div class="info"><h4>${s.name}</h4><small>${s.place}</small><p>${s.blurb}</p>
        <div class="chips">${s.eras.map((e) => `<span style="--ec:${ERA_COLOR[e]}">${ERA[e].short}</span>`).join('')}</div>
        <div class="prog"><div class="bar"><i style="width:${(got / all.length) * 100}%"></i></div><small>${got}/${all.length} באוסף</small></div></div></button>`;
    }).join('');
    $$('.site').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`); b.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`); b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`); });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); });
    });
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
      return `<button class="exhibit ${m ? '' : 'unknown'} ${f.rarity === 'legendary' ? 'leg' : ''}" data-id="${f.id}" style="--rc:${r.color}">
        <div class="pic"><img src="${D.svgUrl(f.svg)}" alt="" style="aspect-ratio:${f.w}/${f.h}"></div>
        <b>${m ? f.name : '???'}</b>${m && PH.finds[f.id] ? '<span class="phb" title="יש צילום אמיתי">📷</span>' : ''}<small style="color:${r.color}">${r.name}</small>${m ? `<span class="cnt">×${m.n}${m.best >= 100 ? ' ⭐' : ''}</span>` : ''}</button>`;
    }).join('');
    $$('.exhibit').forEach((b) => b.onclick = () => {
      const f = BY_ID[b.dataset.id], m = S.museum[f.id];
      if (!m) { toast(`עוד לא נמצא. מחפשים אותו ב${ERA[f.era].name} 🔎`); return; }
      showFind(f, m.best, 0, false, m.best >= 100);
      const ok = $('#m-ok'); if (ok) ok.textContent = 'סגירה';
    });
    $('#stats').innerHTML = `<span>⛏️ ${fmt(S.stats.tiles)} מכות חפירה</span><span>🏺 ${fmt(S.stats.finds)} ממצאים</span><span>⭐ ${fmt(S.stats.perfect)} מושלמים</span><span>🏆 שיא חפירה: ${fmt(S.stats.bestDig)} 🪙</span>`;
  }
  $('#credits').addEventListener('click', () => {
    const rows = [...Object.values(PH.sites), ...Object.values(PH.finds)].map((p) => `<li><img src="${p.src}" alt="" loading="lazy"><span><b>${esc(p.caption)}</b><small>${credit(p)}</small></span></li>`).join('');
    modal(`<h2>קרדיטים לצילומים</h2><p class="sub">כל הצילומים מוויקישיתוף, ברישיונות חופשיים. תודה לצלמים.</p><ul class="creds">${rows}</ul><div class="m-actions"><button class="btn gold" id="m-cr">סגירה</button></div>`, (root) => { $('#m-cr', root).onclick = closeModal; });
  });
  $('#reset').addEventListener('click', () => {
    modal(`<div class="m-ico">⚠️</div><h2>לאפס את כל ההתקדמות?</h2><p>המוזיאון, המטבעות והשדרוגים יימחקו לגמרי.</p><div class="m-actions"><button class="btn danger" id="m-yes">כן, לאפס</button><button class="btn ghost" id="m-no">ביטול</button></div>`, (root) => {
      $('#m-yes', root).onclick = () => { S = fresh(); save(); closeModal(); show('home'); };
      $('#m-no', root).onclick = closeModal;
    });
  });

  function renderCamp() {
    $('#ups').innerHTML = UPS.map((u) => {
      const l = up(u.id), maxed = l >= u.max, cost = upCost(u);
      const UI = { pick: 'pick', stamina: 'bolt', detector: 'sonar', sonar: 'sonar', restore: 'brush', luck: 'star', funding: 'map', dynamite: 'dyn' };
      return `<div class="up ${maxed ? 'max' : ''}"><div class="ui">${ico(UI[u.id])}</div><div class="ut"><h4>${u.name}</h4><p>${u.desc(l)}</p>
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
  if (S.stats.digs > 0) $('#play').textContent = 'להמשיך לחפור';
  $$('[data-ico]').forEach((el) => { el.innerHTML = ico(el.dataset.ico); });

  // the opening screen: a half-dug trench at Megiddo with its finds showing, in 3D when the engine is ready
  function homeScene() {
    const go = () => {
      if (document.body.dataset.screen !== 'home') return;
      const demo = genDig(SITES[5], 5, { seed: 20260, lo: loadout(true) });
      demo.arts = demo.arts.filter((a) => RARITY[a.f.rarity].rank >= 1).slice(0, 6);
      if (G3() && G3().showcase($('#hero3d'), demo, SITES[5])) { SHCHAVOT_HERO.stop(); document.body.classList.add('has3d'); }
      else SHCHAVOT_HERO.start();
    };
    if (G3()) go(); else { SHCHAVOT_HERO.start(); window.addEventListener('dig3d-ready', go, { once: true }); }
  }
  topbar();
  show('home');

  // exposed for checks in the browser console
  window.SHCHAVOT_GAME = { state: () => S, dig: () => dig, startDig, endDig, MATS };
})();
