/* שכבות — "ניפוץ": the cannon game's rules and screens (level map, HUD, win and fail).
   The 3D world and physics live in smash3d.js; the save, coins, museum and modals come from game.js. */
(function () {
  'use strict';
  const D = window.SHCHAVOT;
  const { RARITY, FINDS, SITES } = D;
  const A = window.SHCHAVOT_GAME.api;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const S = () => A.S();
  const PER_CHAPTER = 5;

  function state() {
    const s = S();
    if (!s.smash) s.smash = { lvl: 1, stars: {}, boost: { bomb: 2, triple: 2 } };
    if (!s.smash.weapon) s.smash.weapon = 'cannon';
    if (!s.smash.seen) s.smash.seen = { cannon: 1 };
    return s.smash;
  }
  const chapterOf = (n) => Math.floor((n - 1) / PER_CHAPTER);
  const siteOf = (n) => SITES[chapterOf(n) % SITES.length];
  const totalStars = () => Object.values(state().stars).reduce((a, b) => a + b, 0);
  const starsFor = (left, start) => (left / start >= 0.34 ? 3 : left / start >= 0.15 ? 2 : 1);
  // what the player can throw with, and the level each one opens at
  const WEAPON = {
    cannon: { name: 'תותח', from: 1, hint: 'כדור אש מהיר: טוב לכל דבר' },
    sling: { name: 'הקלע של דוד', from: 2, hint: 'אבן קטנה, מהירה ומדויקת: מנפצת כל כד שהיא נוגעת בו' },
    catapult: { name: 'קטפולטה', from: 3, hint: 'סלע בוער וכבד שנופל על המגדל מלמעלה ומרסק אותו' },
  };
  const BOOST = {
    bomb: { name: 'פצצה', icon: '💣', price: 120, hint: 'הכדור הבא מתפוצץ ומעיף את כל מה שסביבו' },
    triple: { name: 'שלישייה', icon: '☄️', price: 90, hint: 'הירייה הבאה יוצאת שלוש פעמים בבת אחת' },
  };

  /* ---------- the level map ---------- */
  function renderLevels() {
    const st = state();
    const last = Math.max(st.lvl + 7, 15);
    const rows = [];
    for (let n = 1; n <= last; n++) {
      if ((n - 1) % PER_CHAPTER === 0) {
        const site = siteOf(n), ph = A.PH.sites[site.id];
        rows.push(`<div class="lv-chapter"><div class="lv-ch-img">${ph ? `<img src="${ph.src}" alt="">` : ''}</div><div><small>פרק ${chapterOf(n) + 1}</small><b>${site.name}</b><span>${site.place}</span></div></div>`);
      }
      const stars = st.stars[n] || 0, open = n <= st.lvl, cur = n === st.lvl;
      const x = [50, 74, 82, 66, 40, 22, 18, 34][(n - 1) % 8];
      rows.push(`<button class="lv-node ${stars ? 'done' : ''} ${cur ? 'cur' : ''} ${open ? '' : 'locked'}" data-n="${n}" style="--x:${x}%" ${open ? '' : 'aria-disabled="true"'} aria-label="שלב ${n}${stars ? `, ${stars} כוכבים` : ''}">
        <span class="num">${open ? n : A.ico('lock')}</span>
        <span class="stars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span>
        ${cur ? '<em class="you">שחקו!</em>' : ''}
      </button>`);
    }
    $('#lv-path').innerHTML = rows.join('');
    $('#lv-stars').textContent = totalStars();
    $('#lv-bomb').textContent = st.boost.bomb;
    $('#lv-triple').textContent = st.boost.triple;
    $$('#lv-path .lv-node').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.n;
      if (n > state().lvl) { SFX.deny(); A.toast('🔒 קודם מסיימים את השלב שלפניו'); return; }
      SFX.click(); startLevel(n);
    }));
    const cur = $('#lv-path .lv-node.cur');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }), 30);
  }

  /* ---------- a level ---------- */
  let run = null;
  function startLevel(n) {
    if (!window.SMASH3D || !SMASH3D.supported) { A.toast('הדפדפן הזה לא מציג תלת־ממד, נסו דפדפן אחר 🙏'); return; }
    A.show('smash');
    const site = siteOf(n);
    run = { n, site, coins: 0, start: 0, balls: 0, cleared: 0, best: 0 };
    $('#sm-title').textContent = `שלב ${n}`;
    $('#sm-site').textContent = site.name;
    $('#sm-coins').textContent = '0';
    $('#sm-fill').style.width = '0%';
    hudBoost();
    const st = state();
    if (WEAPON[st.weapon].from > st.lvl) st.weapon = 'cannon';
    hudWeapons();
    const info = SMASH3D.start($('#smash3d'), n, handlers, { weapon: st.weapon });
    run.start = info.balls;
    hint(n === 1 ? 'הקישו על המגדל כדי לירות 💥 צריך להפיל הכול מהבמה' : `צריך להפיל הכול מהבמה · ${info.balls} יריות`, n === 1 ? 6000 : 3200);
    // a launcher that has just opened is introduced once
    const fresh = Object.keys(WEAPON).find((k) => WEAPON[k].from <= st.lvl && !st.seen[k]);
    if (fresh) {
      st.seen[fresh] = 1; A.save();
      setTimeout(() => A.modal(`<div class="sm-win"><div class="sm-ribbon">כלי חדש!</div>
        <div class="sm-newweapon">${$(`.weapon[data-w="${fresh}"] svg`).outerHTML}</div>
        <h2>${WEAPON[fresh].name}</h2><p class="sub">${WEAPON[fresh].hint}</p>
        <p class="sub">בוחרים במה לירות בכפתורים שלמטה, ואפשר להחליף לפני כל ירייה.</p></div>
        <div class="m-actions"><button class="btn gold" id="m-try">לנסות עכשיו</button><button class="btn ghost" id="m-later">אחר כך</button></div>`, (root) => {
        $('#m-try', root).onclick = () => { A.closeModal(); pickWeapon(fresh); };
        $('#m-later', root).onclick = A.closeModal;
      }), 700);
    }
  }
  function hudWeapons() {
    const st = state();
    $$('.weapon').forEach((b) => {
      const W = WEAPON[b.dataset.w], open = W.from <= st.lvl;
      b.classList.toggle('on', b.dataset.w === st.weapon);
      b.classList.toggle('locked', !open);
      const lock = $('.lock', b);
      if (lock) lock.textContent = open ? '' : `שלב ${W.from}`;
    });
  }
  function pickWeapon(k) {
    const st = state(), W = WEAPON[k];
    if (W.from > st.lvl) { SFX.deny(); A.toast(`🔒 ${W.name} נפתח בשלב ${W.from}`); return; }
    st.weapon = k; A.save();
    if (window.SMASH3D) SMASH3D.weapon(k);
    SFX.click(); hudWeapons();
    hint(`${W.name}: ${W.hint}`, 2600);
  }
  $$('.weapon').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); pickWeapon(b.dataset.w); }));
  let hintT = 0;
  function hint(text, ms) {
    const el = $('#sm-hint'); el.textContent = text; el.classList.add('on');
    clearTimeout(hintT); hintT = setTimeout(() => el.classList.remove('on'), ms);
  }
  function hudBoost() {
    const st = state();
    $('#b-bomb').textContent = st.boost.bomb || '+';
    $('#b-triple').textContent = st.boost.triple || '+';
    $$('.boost').forEach((b) => b.classList.toggle('armed', window.SMASH3D && SMASH3D.armed() === b.dataset.b));
  }
  function floatAt(x, y, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'sm-float ' + cls; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  const VALUE = { jar: 6, block: 3, slab: 3, column: 4, cone: 3, chest: 25, coin: 15 };
  const handlers = {
    onBalls(n) {
      if (!run) return;
      run.balls = n;
      const el = $('#sm-balls'); el.textContent = n;
      el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump');
      el.parentElement.classList.toggle('low', n <= 3);
      const sp = run.start ? starsFor(n, run.start) : 3;
      $$('#sm-rate i').forEach((s, k) => s.classList.toggle('on', k < sp));
      hudBoost();
    },
    onProgress(f) { $('#sm-fill').style.width = Math.round(f * 100) + '%'; },
    onClear(e) {
      if (!run) return;
      const v = Math.round((VALUE[e.type] || 2) * (1 + chapterOf(run.n) * 0.15));
      run.coins += v; run.cleared++;
      $('#sm-coins').textContent = A.fmt(run.coins);
      floatAt(e.x, e.y, `+${v}`, e.type === 'coin' ? 'gold' : '');
      if (e.type === 'coin') SFX.coin();
      if (e.combo >= 3 && e.combo > run.best) {
        run.best = e.combo;
        const bonus = e.combo * 4;
        run.coins += bonus; $('#sm-coins').textContent = A.fmt(run.coins);
        const c = $('#sm-combo');
        c.innerHTML = `<b>${e.combo >= 8 ? 'מטורף!' : e.combo >= 5 ? 'מדהים!' : 'קומבו!'}</b><span>×${e.combo} · +${bonus}</span>`;
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
      }
    },
    onEmpty() { SFX.deny(); },
    onWin({ ballsLeft }) { win(ballsLeft); },
    onFail({ progress }) { fail(progress); },
  };

  // the chest holds a real find from the eras of this chapter's site
  function chestFind(n, stars) {
    const site = siteOf(n);
    const R = A.rng(A.hashStr('chest' + n + ':' + (S().stats.digs + Object.keys(state().stars).length)));
    const ranks = stars === 3 ? [0.25, 0.35, 0.25, 0.11, 0.04] : stars === 2 ? [0.45, 0.32, 0.16, 0.06, 0.01] : [0.65, 0.25, 0.08, 0.02, 0];
    let r = R(), rank = 0;
    for (; rank < 4 && r > ranks[rank]; rank++) r -= ranks[rank];
    const names = Object.keys(RARITY).sort((a, b) => RARITY[a].rank - RARITY[b].rank);
    for (let k = rank; k >= 0; k--) {
      const pool = FINDS.filter((f) => site.eras.includes(f.era) && f.rarity === names[k]);
      if (pool.length) {
        // a find not yet in the museum is preferred
        const fresh = pool.filter((f) => !S().museum[f.id]);
        const list = fresh.length && R() < 0.7 ? fresh : pool;
        return list[Math.floor(R() * list.length)];
      }
    }
    return FINDS[Math.floor(R() * FINDS.length)];
  }

  function win(ballsLeft) {
    const s = S(), st = state(), n = run.n;
    const stars = starsFor(ballsLeft, run.start);
    const before = st.stars[n] || 0;
    st.stars[n] = Math.max(before, stars);
    const first = n === st.lvl;
    if (first) st.lvl = n + 1;
    const site = siteOf(n);
    const f = chestFind(n, stars);
    const cond = [0, 70, 88, 100][stars];
    const perfect = cond >= 100;
    const findValue = Math.round(f.value * site.mult * (0.25 + 0.75 * cond / 100) * (perfect ? 1.5 : 1));
    const m = s.museum[f.id] || { n: 0, best: 0 };
    const isNew = !m.n;
    m.n++; m.best = Math.max(m.best, cond); s.museum[f.id] = m;
    s.stats.finds++; if (perfect) s.stats.perfect++;
    const ballBonus = ballsLeft * 10;
    const starBonus = Math.max(0, stars - before) * 30;
    const total = run.coins + ballBonus + starBonus + findValue;
    s.coins += total;
    // three stars earns a booster
    let gift = '';
    if (stars === 3 && before < 3) { const k = n % 2 ? 'bomb' : 'triple'; st.boost[k]++; gift = k; }
    A.addXP(12 + n * 2 + RARITY[f.rarity].xp);
    A.save(); A.topbar();
    SFX.levelup();
    A.confetti(80);
    const r = RARITY[f.rarity];
    A.modal(`
      <div class="sm-win">
        <div class="sm-ribbon">שלב ${n} הושלם!</div>
        <div class="sm-stars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}" style="--d:${0.25 + k * 0.28}s">★</i>`).join('')}</div>
        <div class="sm-chest" style="--rc:${r.color}"><div class="rays"></div><img src="${A.artUrl(f)}" alt="${A.esc(f.name)}"></div>
        <p class="sm-found">${isNew ? '<em class="new">חדש למוזיאון!</em> ' : ''}בתיבה: <b>${f.name}</b> <span style="color:${r.color}">${r.name}</span></p>
        <ul class="sm-sum">
          <li><span>ניפוצים</span><b>${A.fmt(run.coins)}</b></li>
          <li><span>יריות שנשארו ×${ballsLeft}</span><b>${A.fmt(ballBonus)}</b></li>
          ${starBonus ? `<li><span>כוכבים חדשים</span><b>${starBonus}</b></li>` : ''}
          <li><span>הממצא</span><b>${A.fmt(findValue)}</b></li>
          <li class="tot"><span>סה״כ</span><b>${A.fmt(total)} ${A.ico('coin', 'ico md')}</b></li>
        </ul>
        ${gift ? `<p class="sm-gift">🎁 שלושה כוכבים! קיבלתם ${BOOST[gift].icon} ${BOOST[gift].name}</p>` : ''}
      </div>
      <div class="m-actions">
        <button class="btn gold" id="m-next">לשלב ${n + 1} ▶</button>
        ${isNew ? '<button class="btn ghost" id="m-find">על הממצא</button>' : ''}
        <button class="btn ghost" id="m-again">שוב</button>
        <button class="btn ghost" id="m-lv">למפה</button>
      </div>`, (root) => {
      setTimeout(() => $$('.sm-stars i.on', root).forEach((el, k) => setTimeout(() => SFX.star(k), k * 280)), 250);
      $('#m-next', root).onclick = () => { A.closeModal(); startLevel(n + 1); };
      $('#m-again', root).onclick = () => { A.closeModal(); startLevel(n); };
      $('#m-lv', root).onclick = () => { A.closeModal(); A.show('levels'); };
      const fb = $('#m-find', root);
      if (fb) fb.onclick = () => { A.closeModal(); A.showFind(f, cond, findValue, true, perfect); };
    }, false);
    if (chapterOf(n + 1) !== chapterOf(n) && first) setTimeout(() => A.toast(`🗺️ פרק חדש נפתח: ${siteOf(n + 1).name}`, 'gold', 4200), 1200);
  }

  function fail(progress) {
    const n = run.n, price = 40 + n * 6;
    SFX.end();
    A.modal(`
      <div class="sm-win fail">
        <div class="sm-ribbon blue">נגמרו היריות</div>
        <div class="sm-pct"><b>${Math.round(progress * 100)}%</b><span>מהמגדל נפל</span></div>
        <p class="sub">${progress > 0.7 ? 'עוד קצת והוא היה כולו על הדשא!' : 'כוונו לבסיס: מה שנופל מלמטה מפיל את מה שמעליו'}</p>
      </div>
      <div class="m-actions">
        <button class="btn gold" id="m-more" ${S().coins < price ? 'disabled' : ''}>+5 יריות · ${price} ${A.ico('coin', 'ico md')}</button>
        <button class="btn ghost" id="m-retry">לנסות שוב</button>
        <button class="btn ghost" id="m-lv">למפה</button>
      </div>`, (root) => {
      $('#m-more', root).onclick = () => {
        if (S().coins < price) return;
        S().coins -= price; A.save(); A.topbar(); A.closeModal();
        SMASH3D.addBalls(5);
      };
      $('#m-retry', root).onclick = () => { A.closeModal(); startLevel(n); };
      $('#m-lv', root).onclick = () => { A.closeModal(); A.show('levels'); };
    }, false);
  }

  /* ---------- boosters ---------- */
  $$('.boost').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = b.dataset.b, st = state(), B = BOOST[k];
    if (SMASH3D.armed() === k) { SMASH3D.arm(k); st.boost[k]++; A.save(); hudBoost(); return; }
    if (!st.boost[k]) {
      if (S().coins < B.price) { SFX.deny(); A.toast(`${B.icon} ${B.name} עולה ${B.price} מטבעות`); return; }
      A.modal(`<div class="m-ico" style="font-size:54px">${B.icon}</div><h2>${B.name}</h2><p class="sub">${B.hint}</p>
        <div class="m-actions"><button class="btn gold" id="m-buy">לקנות · ${B.price} ${A.ico('coin', 'ico md')}</button><button class="btn ghost" id="m-no">לא עכשיו</button></div>`, (root) => {
        $('#m-buy', root).onclick = () => { S().coins -= B.price; st.boost[k]++; A.save(); A.topbar(); A.closeModal(); hudBoost(); SFX.coin(); };
        $('#m-no', root).onclick = A.closeModal;
      });
      return;
    }
    if (SMASH3D.armed()) { const prev = SMASH3D.armed(); SMASH3D.arm(prev); st.boost[prev]++; }
    st.boost[k]--; SMASH3D.arm(k); A.save(); SFX.click();
    hint(`${B.icon} ${B.hint}`, 2600);
    hudBoost();
  }));

  $('#sm-pause').addEventListener('click', () => {
    SFX.click();
    A.modal(`<h2>הפסקה</h2><p class="sub">שלב ${run ? run.n : ''} · ${run ? run.site.name : ''}</p>
      <div class="m-actions"><button class="btn gold" id="m-go">להמשיך</button><button class="btn ghost" id="m-retry">להתחיל מחדש</button><button class="btn ghost" id="m-lv">למפת השלבים</button></div>`, (root) => {
      $('#m-go', root).onclick = A.closeModal;
      $('#m-retry', root).onclick = () => { A.closeModal(); startLevel(run.n); };
      $('#m-lv', root).onclick = () => { A.closeModal(); A.show('levels'); };
    });
  });

  window.SHCHAVOT_SMASH = {
    onShow(name) { if (name === 'levels') renderLevels(); },
    startLevel,
    state,
  };
})();
