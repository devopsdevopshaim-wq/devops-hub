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
    if (!s.world.gear) s.world.gear = { detector: 0, brush: 0, pick: 0, crew: 0 };
    if (!s.world.xp) s.world.xp = 0;
    return s.world;
  }

  /* ---------- the archaeologist's career: rank, equipment, the site of the day ---------- */
  const RANKS = [[0, 'מתנדב בחפירה'], [60, 'סטודנט לארכיאולוגיה'], [180, 'ארכיאולוג שטח'], [400, 'ראש שטח'], [800, 'מנהל משלחת'], [1500, 'פרופסור לארכיאולוגיה'], [3000, 'אגדה בעולם הארכיאולוגיה']];
  const rankOf = (xp) => { let i = 0; while (i < RANKS.length - 1 && xp >= RANKS[i + 1][0]) i++; return i; };
  function gainXp(n) {
    const st = state(), before = rankOf(st.xp);
    st.xp += n;
    const after = rankOf(st.xp);
    if (after > before) { SFX.levelup(); A.confetti(60); setTimeout(() => A.toast(`🎓 קודמתם: ${RANKS[after][1]}!`, 'gold', 5000), 300); }
    A.save();
  }
  const GEAR = {
    detector: { name: 'גלאי מתכות', icon: '📡', per: 'טווח +30%', base: 150 },
    brush: { name: 'מברשות ומחטים', icon: '🖌️', per: 'חשיפה +35%', base: 120 },
    pick: { name: 'מכושים', icon: '⛏️', per: 'חפירה +25%', base: 120 },
    crew: { name: 'פועלים', icon: '👷', per: '+20 ⚡ בכל משלחת', base: 180 },
  };
  const gearPrice = (k) => Math.round(GEAR[k].base * Math.pow(1.8, state().gear[k]));
  // the site of the day: the same for everyone today, double the reward and no fee
  function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function dailySite() { let h = 0; for (const ch of today()) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return W.SITES[h % W.SITES.length]; }
  const isDaily = (s) => s.id === dailySite().id && state().dailyDone !== today();
  function gearPanel() {
    const st = state();
    A.modal(`<h2>🎒 ציוד המשלחת</h2><p class="sub">ציוד טוב יותר מוצא יותר, מהר יותר, ושובר פחות.</p>
      <div class="gear">${Object.entries(GEAR).map(([k, g]) => `<div class="gear-row"><span class="gi">${g.icon}</span><div><b>${g.name} · דרגה ${st.gear[k]}</b><small>${g.per}</small></div>
        <button class="btn gold sm" data-g="${k}" ${S().coins < gearPrice(k) || st.gear[k] >= 5 ? 'disabled' : ''}>${st.gear[k] >= 5 ? 'מקסימום' : `${A.fmt(gearPrice(k))} 🪙`}</button></div>`).join('')}</div>
      <div class="m-actions"><button class="btn ghost" id="m-gx">סגירה</button></div>`, (root) => {
      $$('[data-g]', root).forEach((b) => b.onclick = () => { const k = b.dataset.g, pr = gearPrice(k); if (S().coins < pr) return; S().coins -= pr; st.gear[k]++; A.save(); A.topbar(); SFX.coin(); A.closeModal(); setTimeout(gearPanel, 200); renderWorld(); });
      $('#m-gx', root).onclick = A.closeModal;
    });
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
    const ri = rankOf(st.xp), next = RANKS[ri + 1];
    $('#w-rank').innerHTML = `<b>🎓 ${RANKS[ri][1]}</b><div class="w-xp"><i style="width:${next ? Math.round((st.xp - RANKS[ri][0]) / (next[0] - RANKS[ri][0]) * 100) : 100}%"></i></div><small>${next ? `${st.xp}/${next[0]} נק׳ ניסיון` : 'הדרגה הגבוהה ביותר'}</small>`;
    const ds = dailySite();
    $('#w-daily').innerHTML = isDaily(ds) ? `⭐ משלחת היום: <b>${ds.flag} ${ds.name}</b> · בחינם ופי 2 מטבעות` : `✓ משלחת היום הושלמה. מחר אתר חדש!`;
    $('#w-daily').onclick = () => { if (window.GLOBE3D) GLOBE3D.focus(ds.id); dossier(ds); };
    $('#w-regions').innerHTML = [['all', 'כל העולם']].concat(Object.entries(W.REGIONS)).map(([id, name]) => `<button class="chip ${region === id ? 'on' : ''}" data-r="${id}">${name}</button>`).join('');
    $$('#w-regions .chip').forEach((b) => b.onclick = () => { region = b.dataset.r; SFX.click(); renderWorld(); });
    const list = W.SITES.filter((s) => region === 'all' || s.region === region);
    $('#w-list').innerHTML = list.map((s) => {
      const ph = photo(s.id, 'site') || photo(s.id, 'find');
      return `<button class="w-card ${isFound(s.id) ? 'found' : ''}" data-id="${s.id}">
        <div class="w-pic">${ph ? `<img src="${ph.src}" alt="" loading="lazy">` : `<span>${s.flag}</span>`}</div>
        <b>${s.flag} ${s.name}</b><small>${s.country}</small>
        <em>${isDaily(s) ? '⭐ משלחת היום' : isFound(s.id) ? '✓ נמצא' : s.cost ? `${s.cost} 🪙` : 'חינם'}</em></button>`;
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
        <button class="btn gold" id="m-go">${done ? '⛏️ לחפור שוב באתר' : '🧭 לצאת למשלחת'}${isDaily(s) ? ' · ⭐ חינם, פי 2' : s.cost ? ` · ${s.cost} ${A.ico('coin', 'ico md')}` : ''}</button>
        <button class="btn ghost" id="m-close">סגירה</button>
      </div>`, (root) => {
      $('#m-go', root).onclick = () => {
        const cost = isDaily(s) ? 0 : s.cost;
        if (S().coins < cost) { SFX.deny(); A.toast(`למשלחת לכאן צריך ${cost} מטבעות. אפשר להרוויח באתרים בארץ ישראל, בשלבי התותח או בחפירות 🪙`, '', 4500); return; }
        S().coins -= cost; A.save(); A.topbar();
        A.closeModal(); expedition(s);
      };
      $('#m-close', root).onclick = A.closeModal;
    });
  }

  /* ---------- on site: walking, searching, digging (site3d.js) ---------- */
  const N = 5;
  const TERRAIN = {
    desert: ['#d9b77f', '#c49a5e', '#e8cfa0'], hills: ['#bfa679', '#9c8a5c', '#d4c39a'], green: ['#8fae6a', '#6f8f4e', '#a9c485'],
    sea: ['#2f6f99', '#1f5577', '#4c8bb3'], jungle: ['#4f7d45', '#365f33', '#6c9a5a'],
  };
  let ex = null;
  function expedition(s) {
    ex = { s, sherds: 0, near: 0, hints: 1, smalls: [], coins: 0, found: false, detector: false, mult: isDaily(s) ? 2 : 1, hot: 0, dug: false, revealed: false };
    const g = state().gear;
    Object.assign(handlers, { detector: 1 + g.detector * 0.3, brush: 1 + g.brush * 0.35, pick: 1 + g.pick * 0.25, energy: 80 + g.crew * 20 });
    A.show('site');
    $('#st-name').textContent = `${s.flag} ${s.name}`;
    $('#st-sub').textContent = s.country;
    $('#st-signal').style.width = '0%';
    setSiteMode('walk');
    const go = () => {
      if (document.body.dataset.screen !== 'site' || !window.SITE3D) return;
      SITE3D.start($('#site3d'), s, handlers).then((ok) => {
        if (!ok) return;
        energyBar(SITE3D.energy());
        task();
        if (!state().seen.site) { state().seen.site = 1; A.save(); siteGuide(); }
      });
    };
    if (window.SITE3D) go(); else addEventListener('site3d-ready', go, { once: true });
  }
  // the next thing to do, always in view
  function task() {
    if (!ex) return;
    const steps = [
      [ex.near >= 2, '🔍 חפשו חרסים על הקרקע (הם מנצנצים). הקישו על חרס כדי להרים אותו. חרסים מהתקופה אומרים שאתם קרובים.'],
      [ex.hot > 0.6, '📡 הפעילו את גלאי המתכות והלכו לאט. איפה שהוא מצפצף הכי מהר, מתחת יש מתכת.'],
      [ex.dug, '⛏️ הגלאי צורח? עמדו שם ולחצו "לחפור כאן". שטח החפירה ייפתח ממש מולכם.'],
      [ex.revealed, '⛏️ הקישו בתוך הבור כדי לחפור עם המכוש, עד שמשהו בולט מהאדמה (בערך מטר עומק).'],
      [ex.found, '🖌️ עברו למברשת והקישו ליד הממצא כדי לנקות סביבו בעדינות. מכוש עליו ישבור אותו!'],
    ];
    const i = steps.findIndex(([ok]) => !ok);
    $('#st-step').textContent = i < 0 ? '✓' : `${i + 1}/${steps.length}`;
    $('#st-do').textContent = i < 0 ? '🏆 מצאתם את האוצר! אפשר להמשיך לחפש ממצאים קטנים, או לסיים את המשלחת (✕ למעלה).' : steps[i][1];
  }
  function siteGuide() {
    A.modal(`<h2>🧭 ככה עובדים בשטח</h2><div class="howto">
      <div><span>👆</span><p><b>להסתכל וללכת:</b> גוררים את המסך כדי להסתכל מסביב, ומקישים על הקרקע כדי ללכת לשם.</p></div>
      <div><span>🏺</span><p><b>לחפש סימנים:</b> חרסים על הקרקע מנצנצים. הרימו אותם: חרס מהתקופה אומר שאתם קרובים, ופותח רמז ביומן 📜.</p></div>
      <div><span>📡</span><p><b>הגלאי:</b> מצפצף מהר יותר מעל מתכת קבורה. כשהוא כמעט צורח, חופרים שם.</p></div>
      <div><span>⛏️🖌️</span><p><b>לחפור:</b> מכוש עד שמשהו בולט, ואז מברשת. הממצא עובר למעבדה לניקוי.</p></div></div>
      <p class="sub">השורה הצהובה למעלה תמיד אומרת מה הצעד הבא.</p>
      <div class="m-actions"><button class="btn gold" id="m-gd">יוצאים לשטח</button></div>`, (r) => { $('#m-gd', r).onclick = A.closeModal; });
  }
  function energyBar(e) { $('#st-en').style.width = Math.max(0, Math.min(100, e / (handlers.energy || 80) * 100)) + '%'; $('#st-en-n').textContent = Math.max(0, Math.round(e)); }
  function setSiteMode(m) {
    document.body.dataset.sitemode = m;
    $$('.st-walk').forEach((b) => { b.hidden = m !== 'walk'; });
    $$('.st-dig').forEach((b) => { b.hidden = m !== 'dig'; });
  }
  const handlers = {
    onSherd(near) {
      ex.sherds++; if (near) ex.near++;
      task();
      gainXp(near ? 3 : 1);
      SFX.reveal();
      A.toast(near ? `🏺 שבר חרס מ${ex.s.era}! השרידים של התקופה קרובים.` : '🏺 שבר חרס מתקופה מאוחרת יותר.', near ? 'gold' : '', 2600);
      // sherds of the right period open more of the excavation reports
      const want = ex.near >= 4 ? 3 : ex.near >= 1 ? 2 : 1;
      if (want > ex.hints) { ex.hints = want; setTimeout(() => A.toast(`🧭 רמז חדש: ${ex.s.hints[want - 1]}`, 'gold', 6500), 900); }
    },
    onBeep(x) { SFX.beep(x); },
    onStep() { SFX.step(); },
    onSignal(x) {
      $('#st-signal').style.width = Math.round(x * 100) + '%'; $('#st-meter').classList.toggle('hot', x > 0.55);
      if (ex && x > ex.hot) { ex.hot = x; if (x > 0.6) task(); }
    },
    onReveal(kind) { if (kind === 'main') { ex.revealed = true; task(); } SFX.reveal(); A.toast(kind === 'main' ? '✨ משהו גדול בולט מהאדמה! עברו למברשת ונקו סביבו בזהירות.' : '🪶 משהו קטן בולט מהאדמה. מברשת!', kind === 'main' ? 'gold' : '', 4200); },
    onExpose(kind, x) { $('#st-expose').style.width = Math.round(x * 100) + '%'; },
    onDamage(cond) { SFX.crack(); A.toast(`💥 המכוש פגע בממצא! מצב ${cond}%. ליד ממצאים עובדים עם מברשת.`, '', 3000); },
    onEnergy(e, empty) {
      energyBar(e);
      if (empty) outOfEnergy();
    },
    onDig() { SFX.hit(0.3); },
    onFind(b) {
      if (b.kind === 'main') {
        ex.found = true; task();
        const f = treasureFind(ex.s), a = { f, cond: b.cond };
        lab(a, 0, true, false, (cond) => treasure(f, cond));
      } else {
        const sm = W.SMALL[Math.floor(Math.random() * W.SMALL.length)], v = sm.value * 2 * ex.mult;
        ex.smalls.push(sm); ex.coins += v;
        const st = state(); st.small[sm.id] = (st.small[sm.id] || 0) + 1;
        S().coins += v; S().stats.finds++; A.save(); A.topbar();
        gainXp(8);
        SFX.coin(); A.toast(`${sm.icon} ${sm.name} · +${v} 🪙`, 'gold', 2600);
      }
    },
  };
  function treasure(f, cond) {
    const s = ex.s, t = s.treasure, r = D.RARITY[t.rarity];
    const value = Math.round(t.value * (0.25 + 0.75 * cond / 100) * (cond >= 100 ? 1.5 : 1) * ex.mult);
    gainXp(Math.round(40 + t.value / 10));
    if (ex.mult > 1) state().dailyDone = today();
    const m = S().museum[f.id] || { n: 0, best: 0 };
    const isNew = !m.n;
    m.n++; m.best = Math.max(m.best, cond); S().museum[f.id] = m;
    S().coins += value; S().stats.finds++; if (cond >= 100) S().stats.perfect++;
    ex.coins += value;
    A.addXP(r.xp);
    treasureDone({ f }, cond);
    A.save(); A.topbar();
    A.showFind(f, cond, value, isNew, cond >= 100);
    setTimeout(() => A.toast('🏛️ הסיפור האמיתי של הגילוי נפתח בתיק האתר', 'gold', 4000), 600);
  }
  function outOfEnergy() {
    const price = 60;
    A.modal(`<div class="m-ico">😮‍💨</div><h2>הצוות עייף</h2><p class="sub">נגמר הכוח לחפור היום. אפשר לשכור עוד פועלים, או לסיים את המשלחת ולנפות את העפר.</p>
      <div class="m-actions"><button class="btn gold" id="m-more" ${S().coins < price ? 'disabled' : ''}>+30 ⚡ · ${price} ${A.ico('coin', 'ico md')}</button><button class="btn ghost" id="m-end">לסיים את המשלחת</button></div>`, (root) => {
      $('#m-more', root).onclick = () => { S().coins -= price; A.save(); A.topbar(); SITE3D.addEnergy(30); energyBar(SITE3D.energy()); A.closeModal(); };
      $('#m-end', root).onclick = () => { A.closeModal(); endExpedition(); };
    }, false);
  }
  function endExpedition() {
    if (!ex) return;
    const e = ex;
    sieve({ arts: e.found ? [{ done: true, f: { world: e.s.id } }] : [], coins: 0 }, () => {
      const t = e.s.treasure;
      A.modal(`<div class="m-ico">${e.found ? '🏆' : '🧭'}</div><h2>${e.found ? 'משלחת מוצלחת!' : 'המשלחת הסתיימה'}</h2>
        <p class="sub">${e.s.flag} ${e.s.name} · ${e.sherds} חרסים · ${e.smalls.length} ממצאים קטנים</p>
        ${e.found ? `<p>מצאתם את <b>${t.name}</b>. הסיפור האמיתי נפתח בתיק האתר.</p>` : `<p class="sub">${t.name} עדיין באדמה. חזרו עם עוד רמזים: חרסים מהתקופה מראים איפה חיו האנשים, והגלאי מצפצף מעל מתכת.</p>`}
        <div class="total"><span>הרווחתם</span><b>${A.fmt(e.coins)} ${A.ico('coin', 'ico md')}</b></div>
        <div class="m-actions"><button class="btn gold" id="m-world">🌍 למפת העולם</button></div>`, (root) => { $('#m-world', root).onclick = () => { A.closeModal(); A.show('world'); }; }, false);
    });
    ex = null;
  }
  // the site's survey map, with the archaeologist on it
  function drawMap(cv) {
    const s = ex.s, dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.min(innerWidth - 60, 420);
    cv.style.width = cv.style.height = size + 'px'; cv.width = cv.height = size * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = size / N, T = TERRAIN[s.terrain] || TERRAIN.desert;
    g.fillStyle = T[0]; g.fillRect(0, 0, size, size);
    let seed = s.id.length * 131;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 220; i++) { g.fillStyle = rnd() < 0.5 ? T[1] : T[2]; g.globalAlpha = 0.25; g.beginPath(); g.arc(rnd() * size, rnd() * size, 3 + rnd() * 16, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(40,24,10,.45)'; g.setLineDash([4, 4]);
    for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke(); g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke(); }
    g.setLineDash([]); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [em, c, r, label] of s.map.marks) {
      const x = (c + 0.5) * cell, y = (r + 0.5) * cell;
      g.font = `${cell * 0.34}px serif`; g.fillText(em, x, y - cell * 0.08);
      g.font = `800 ${Math.max(10, cell * 0.11)}px Heebo, sans-serif`;
      const tw = g.measureText(label).width + 8;
      g.fillStyle = 'rgba(255,248,230,.86)'; g.fillRect(x - tw / 2, y + cell * 0.16, tw, cell * 0.16);
      g.fillStyle = '#3a2410'; g.fillText(label, x, y + cell * 0.24);
    }
    g.font = `700 11px Heebo, sans-serif`; g.fillStyle = '#3a2410'; g.fillText('צפון ↑', size - 26, 12);
    const w = window.SITE3D && SITE3D.where();
    if (w) {
      const x = w.col * cell, y = w.row * cell;
      g.fillStyle = '#c0392b'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#3a2410'; g.font = '800 12px Heebo, sans-serif'; g.fillText('אתם כאן', x, y - 16);
    }
  }
  $('#w-gear').addEventListener('click', () => { SFX.click(); gearPanel(); });
  $('#st-map').addEventListener('click', () => {
    if (!ex) return; SFX.click();
    A.modal(`<h2>🗺️ מפת הסקר</h2><p class="sub">כל משבצת היא 10 על 10 מטרים.</p><canvas id="m-mapcv" style="border-radius:10px;box-shadow:0 0 0 2px #6b4a1c"></canvas><div class="m-actions"><button class="btn gold" id="m-ok2">חזרה לשטח</button></div>`, (root) => { drawMap($('#m-mapcv', root)); $('#m-ok2', root).onclick = A.closeModal; });
  });
  $('#st-notes').addEventListener('click', () => {
    if (!ex) return; SFX.click();
    const s = ex.s;
    A.modal(`<div class="dossier"><h2>📜 יומן המשלחת</h2><p class="sub">${s.flag} ${s.name}</p>
      <div class="d-sec"><h4>🧭 רמזים מהשטח ומהדוחות</h4>${s.hints.map((h, i) => `<p>${i < ex.hints ? esc(h) : '🔒 מצאו עוד חרסים מהתקופה כדי לפתוח רמז'}</p>`).join('')}</div>
      <div class="d-sec"><h4>📜 המקורות</h4>${s.sources.map((x) => `<blockquote><b>${esc(x.ref)}</b>${esc(x.text)}</blockquote>`).join('')}</div>
      <div class="d-sec"><h4>🎯 מה מחפשים</h4><p>${s.treasure.name}</p><p class="sub">חרסים שמצאתם: ${ex.sherds} (מהתקופה: ${ex.near})</p></div></div>
      <div class="m-actions"><button class="btn gold" id="m-ok3">חזרה לשטח</button></div>`, (root) => { $('#m-ok3', root).onclick = A.closeModal; });
  });
  $('#st-photo').addEventListener('click', () => {
    if (!ex) return; SFX.click();
    const ph = photo(ex.s.id, 'site');
    if (!ph) { A.toast('לאתר הזה אין עדיין צילום חופשי בוויקישיתוף'); return; }
    A.modal(`<figure class="d-photo"><img src="${ph.src}" alt="${esc(ph.caption)}"><figcaption>${esc(ph.caption)} · <small>${credit(ph)}</small></figcaption></figure><p class="sub">כך נראה המקום באמת היום.</p><div class="m-actions"><button class="btn gold" id="m-ok4">חזרה לשטח</button></div>`, (root) => { $('#m-ok4', root).onclick = A.closeModal; });
  });
  $('#st-detector').addEventListener('click', (e) => {
    SFX.click();
    ex.detector = SITE3D.detector(!ex.detector);
    e.currentTarget.classList.toggle('on', ex.detector);
    $('#st-meter').hidden = !ex.detector;
    if (ex.detector) A.toast('📡 הגלאי פועל: הוא מצפצף מהר יותר ככל שמתקרבים למתכת קבורה.', '', 3500);
  });
  $('#st-dighere').addEventListener('click', () => {
    if (!ex || !window.SITE3D) return;
    if (SITE3D.energy() < 5) { outOfEnergy(); return; }
    SFX.trowel();
    const res = SITE3D.digHere();
    if (res && res.steep) { SFX.deny(); A.toast('⛰️ כאן תלול מדי לחפור. מצאו משטח ישר יותר, או עמדו מול פתח המערה.', '', 3500); return; }
    SITE3D.addEnergy(-5); energyBar(SITE3D.energy());
    ex.dug = true; task();
    setSiteMode('dig'); pickTool('pick');
    $('#st-expose').style.width = '0%';
    A.toast('⛏️ פתחתם שטח חפירה של 3×3 מטרים. הקישו בתוכו כדי לחפור. הממצאים מהתקופה נמצאים בעומק של כמטר.', 'gold', 5200);
  });
  $('#st-leave').addEventListener('click', () => { SFX.click(); SITE3D.leaveTrench(); setSiteMode('walk'); });
  function pickTool(t) { SITE3D.setTool(t); $$('.st-tool').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); }
  $$('.st-tool').forEach((b) => b.addEventListener('click', () => { SFX.click(); pickTool(b.dataset.t); }));
  $('#st-end').addEventListener('click', () => {
    SFX.click();
    A.modal(`<h2>לסיים את המשלחת?</h2><p class="sub">העפר מהחפירות יעבור ניפוי, ותחזרו למפת העולם.</p><div class="m-actions"><button class="btn gold" id="m-y">לסיים</button><button class="btn ghost" id="m-n">להמשיך לחפש</button></div>`, (root) => { $('#m-y', root).onclick = () => { A.closeModal(); endExpedition(); }; $('#m-n', root).onclick = A.closeModal; });
  });

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
      if (name === 'world') {
        renderWorld(); startGlobe();
        if (!state().seen.globe) {
          state().seen.globe = 1; A.save();
          setTimeout(() => A.modal(`<h2>🌍 משלחת עולמית</h2><div class="howto">
            <div><span>📍</span><p>כל סיכה על כדור הארץ היא <b>אתר אמיתי</b> שבו נמצא אוצר אמיתי. סובבו את הכדור באצבע, או בחרו מהרשימה למטה.</p></div>
            <div><span>📜</span><p>בכל אתר קוראים קודם <b>מה אומרים המקורות</b>: התנ״ך, היסטוריונים קדומים, דוחות חפירה. מהם מבינים איפה לחפש.</p></div>
            <div><span>⭐</span><p><b>משלחת היום</b> חינם ונותנת פי 2 מטבעות. כדאי להתחיל בה, או בקומראן.</p></div></div>
            <div class="m-actions"><button class="btn gold" id="m-g1">בואו נתחיל</button></div>`, (r) => { $('#m-g1', r).onclick = A.closeModal; }), 900);
        }
      } else if (window.GLOBE3D) GLOBE3D.stop();
      if (name !== 'site' && window.SITE3D) SITE3D.stop();
    },
    lab, sieve, treasureDone, state,
    _ex: () => ex,
  };
})();
