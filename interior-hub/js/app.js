/* Page wiring: form -> plan -> 2D drawing, 3D tour, room lists, stores, budget. */
(function () {
  'use strict';
  const IH = window.IH;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // numbers joined by a dash or × read left to right even inside Hebrew text
  const rich = (s) => esc(s).replace(/\d[\d.,]*(?:\s?[–×-]\s?\d[\d.,]*)+/g, (m) => `<bdi dir="ltr">${m}</bdi>`);
  const money = (n) => '₪' + Math.round(n).toLocaleString('he-IL');
  const cm = (m) => Math.round(m * 100);
  const STORE_KEY = 'matar.brief.v1';

  const DEFAULTS = { area: 100, rooms: 4, adults: 2, kids: 2, style: 'scandi', budget: 'mid', region: 'center', seats: 'auto', kitchen: 'auto', mamad: true, balcony: true, office: false };
  let state = Object.assign({}, DEFAULTS);
  let plan = null;
  let tour = null;
  let selected = null;
  let userEdited = false;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { Object.assign(state, JSON.parse(raw)); userEdited = true; }
    } catch (e) { /* storage unavailable */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------- form ---------- */
  function buildForm() {
    const st = $('#f-style');
    st.innerHTML = Object.entries(IH.STYLES).map(([k, s]) => `
      <label class="style-opt">
        <input type="radio" name="style" value="${k}" id="f-style-${k}">
        <span class="style-card">
          <span class="style-sw" aria-hidden="true"><i style="background:${s.wall}"></i><i style="background:${s.floor}"></i><i style="background:${s.fabric}"></i><i style="background:${s.accent}"></i></span>
          <span class="style-name">${s.name}</span>
        </span>
      </label>`).join('');
    const regions = Object.entries(IH.REGIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('#f-region').innerHTML = regions;
    $('#s-region').innerHTML = regions;
    writeForm();

    const form = $('#brief');
    form.addEventListener('input', onForm);
    form.addEventListener('change', onForm);
    form.addEventListener('submit', (e) => e.preventDefault());
    $$('.stepper button', form).forEach((b) => b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input');
      const v = Math.max(+inp.min, Math.min(+inp.max, (+inp.value || 0) + +b.dataset.step));
      inp.value = v;
      onForm();
    }));
  }
  function writeForm() {
    $('#f-area').value = state.area;
    $('#o-area').textContent = state.area;
    const r = $(`#f-rooms-${state.rooms}`); if (r) r.checked = true;
    $('#f-adults').value = state.adults;
    $('#f-kids').value = state.kids;
    const s = $(`#f-style-${state.style}`); if (s) s.checked = true;
    const b = $(`#f-budget-${state.budget}`); if (b) b.checked = true;
    $('#f-region').value = state.region;
    $('#s-region').value = state.region;
    $('#f-seats').value = String(state.seats);
    $('#f-kitchen').value = state.kitchen;
    $('#f-mamad').checked = state.mamad;
    $('#f-balcony').checked = state.balcony;
    $('#f-office').checked = state.office;
  }
  let timer = null;
  function onForm() {
    const f = $('#brief');
    const val = (n) => { const el = f.querySelector(`[name="${n}"]:checked`); return el ? el.value : null; };
    state = {
      area: +$('#f-area').value,
      rooms: +val('rooms'),
      adults: Math.max(1, Math.min(6, +$('#f-adults').value || 1)),
      kids: Math.max(0, Math.min(8, +$('#f-kids').value || 0)),
      style: val('style') || 'scandi',
      budget: val('budget') || 'mid',
      region: $('#f-region').value,
      seats: $('#f-seats').value === 'auto' ? 'auto' : +$('#f-seats').value,
      kitchen: $('#f-kitchen').value,
      mamad: $('#f-mamad').checked,
      balcony: $('#f-balcony').checked,
      office: $('#f-office').checked
    };
    $('#o-area').textContent = state.area;
    $('#s-region').value = state.region;
    userEdited = true;
    save();
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  }

  /* ---------- run the planner ---------- */
  function run() {
    const p = IH.planHome(state);
    if (p.error) {
      $('#plan-title').textContent = 'צריך עוד קצת שטח';
      $('#plan-lede').textContent = p.error;
      return;
    }
    plan = p;
    selected = null;
    renderHead();
    renderPlan();
    renderTour();
    renderNotes();
    renderRooms();
    renderBudget();
    renderItemCard();
  }

  function roomsLabel() {
    return `דירת ${state.rooms} חדרים, ${state.area} מ״ר`;
  }

  function renderHead() {
    const s = plan.style;
    $('#plan-eyebrow').textContent = userEdited ? 'התכנון שלכם' : 'תכנון לדוגמה · שנו את הדרישות מימין';
    $('#plan-title').textContent = roomsLabel();
    const people = state.adults + state.kids;
    $('#plan-lede').textContent = `${people} נפשות, סגנון ${s.name}: ${s.blurb}`;
    $('#brief-summary').textContent = `${state.rooms} חד׳ · ${state.area} מ״ר · ${s.name}`;
    const n = plan.items.filter((it) => IH.CATALOG[it.type]).length;
    const facts = [
      ['מידות חוץ', `${plan.W.toFixed(1)}×${plan.D.toFixed(1)} מ׳`],
      ['מטבח', plan.kitchenShapeName],
      ['טלוויזיה', `${plan.tvIn}״`],
      [plan.rooms.some((r) => r.kind === 'dining') ? 'שולחן אוכל' : 'דלפק', `${plan.seats} מקומות`],
      ['פריטים', String(n)],
      ['תקציב משוער', money(totalBudget())]
    ];
    $('#facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  }

  function renderPlan() {
    IH.renderPlan($('#plan-svg'), plan, { selected, onSelect: select });
  }

  function renderTour() {
    const host = $('#tour');
    if (!window.THREE || !hasWebGL()) {
      $('#tour-fallback').hidden = false;
      $('#tab-2d').click();
      return;
    }
    if (!tour) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a8662b';
      tour = new IH.Tour(host, {
        accent,
        onSelect: select,
        onHover: (id, e) => {
          const tip = $('#tour-tip');
          if (!id) { tip.hidden = true; return; }
          const it = plan.items.find((x) => x.id === id);
          const c = IH.CATALOG[it.type];
          tip.textContent = c ? c.name : '';
          const r = host.getBoundingClientRect();
          tip.style.left = (e.clientX - r.left) + 'px';
          tip.style.top = (e.clientY - r.top - 34) + 'px';
          tip.hidden = !c;
        },
        onMove: updateMini
      });
      host.appendChild($('#tour-tip'));
    }
    tour.load(plan);
    $$('.tour-modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === tour.mode)));
    $('#tour-rooms').innerHTML = plan.rooms.filter((r) => r.kind !== 'corridor').map((r) => `<button type="button" data-room="${r.id}">${esc(r.name)}</button>`).join('');
    const mini = $('#tour-mini');
    IH.renderPlan(mini, plan, { triangle: false });
    $$('.fp-labels, .fp-dims', mini).forEach((g) => g.remove());
    const ns = 'http://www.w3.org/2000/svg';
    const me = document.createElementNS(ns, 'g');
    me.setAttribute('class', 'mini-me');
    me.innerHTML = '<path d="M0 0 L-0.9 -1.6 A1.8 1.8 0 0 1 0.9 -1.6 Z" class="mini-cone"/><circle r="0.28" class="mini-dot"/>';
    mini.appendChild(me);
    miniMe = me;
  }
  let miniMe = null;
  function updateMini(x, z, yaw) {
    if (!miniMe) return;
    miniMe.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${(-yaw * 180 / Math.PI).toFixed(1)})`);
  }
  function hasWebGL() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }

  function renderNotes() {
    const warn = plan.checks.filter((c) => !c.ok);
    const items = plan.notes.map((n) => `<li class="note">${rich(n)}</li>`).concat(warn.map((c) => `<li class="note is-warn"><b>${esc(roomName(c.room))}:</b> ${rich(c.text)}</li>`));
    $('#notes').innerHTML = items.length ? `<h2 class="notes-title">שימו לב</h2><ul>${items.join('')}</ul>` : '';
  }
  const roomName = (id) => { const r = plan.rooms.find((x) => x.id === id); return r ? r.name : ''; };

  /* ---------- prices and stores ---------- */
  function price(it) {
    const c = IH.CATALOG[it.type];
    if (!c) return 0;
    const p = c.price[IH.TIER_INDEX[state.budget]];
    const q = c.unit === 'm' ? Math.max(0.6, it.len || Math.max(it.w, it.d)) : 1;
    return Math.round((p * q) / 10) * 10;
  }
  function totalBudget() {
    return plan.items.reduce((s, it) => s + price(it), 0);
  }
  function storesFor(it) {
    const c = IH.CATALOG[it.type];
    return c ? c.stores[state.budget] || [] : [];
  }
  function dims(it) {
    const side = it.face === 'E' || it.face === 'W';
    const w = side ? it.d : it.w, d = side ? it.w : it.d;
    if (it.type === 'rug') return `${cm(Math.min(it.w, it.d))}×${cm(Math.max(it.w, it.d))}`;
    return `${cm(w)}×${cm(d)}×${cm(it.h)}`;
  }

  function storeBlock(id, compact) {
    const s = IH.STORES[id];
    const b = IH.nearestBranch(id, state.region);
    const phone = (b && b.phone) || s.hotline;
    const lines = [];
    lines.push(`<div class="store-line">
      <div class="store-id"><strong>${esc(s.name)}</strong> <span class="latin">${esc(s.latin)}</span></div>
      <div class="store-contact">
        <span class="phone" dir="ltr">${esc(phone)}</span>
        <button type="button" class="copy" data-copy="${esc(phone)}" aria-label="העתקת המספר ${esc(phone)}">העתקה</button>
        <a class="call" href="tel:${esc(phone.replace(/[^\d*+]/g, ''))}">חיוג</a>
      </div>
      ${b ? `<div class="store-addr">${esc(b.addr)}, ${esc(b.city)} · <a href="${IH.wazeUrl(id, b)}" target="_blank" rel="noopener">Waze</a> · <a href="${IH.mapsUrl(id, b)}" target="_blank" rel="noopener">מפות</a></div>`
        : `<div class="store-addr">${esc(s.hotlineNote)} · <a href="${s.branchesUrl}" target="_blank" rel="noopener">רשימת הסניפים</a></div>`}
      ${!compact && b && b.phone && s.hotline !== b.phone ? `<div class="store-addr">${esc(s.hotlineNote)}: <span class="phone sm" dir="ltr">${esc(s.hotline)}</span></div>` : ''}
      ${!compact ? (s.extra || []).map(([k, v]) => `<div class="store-addr">${esc(k)}: <span class="phone sm" dir="ltr">${esc(v)}</span></div>`).join('') : ''}
    </div>`);
    return lines.join('');
  }

  /* ---------- selected item card ---------- */
  function select(id) {
    selected = id;
    const it = plan.items.find((x) => x.id === id);
    renderPlan();
    renderItemCard();
    $$('.item-row').forEach((r) => r.classList.toggle('is-selected', r.dataset.id === id));
    if (tour && it) tour.lookAtItem(id);
  }

  function renderItemCard() {
    const card = $('#item-card');
    const it = selected && plan.items.find((x) => x.id === selected);
    if (!it || !IH.CATALOG[it.type]) { card.hidden = true; return; }
    const c = IH.CATALOG[it.type];
    card.hidden = false;
    card.innerHTML = `
      <div class="ic-head">
        <div>
          <p class="eyebrow">${esc(roomName(it.room))} · ${esc(c.cat)}</p>
          <h3>${esc(c.name)}${it.note ? ` <span class="ic-note">${rich(it.note)}</span>` : ''}</h3>
        </div>
        <button type="button" class="ic-close" aria-label="סגירה">×</button>
      </div>
      <dl class="ic-facts">
        <div><dt>מידות (ס״מ)</dt><dd class="num"><bdi dir="ltr">${dims(it)}</bdi></dd></div>
        <div><dt>מחיר משוער · ${IH.TIERS[state.budget]}</dt><dd class="num">${money(price(it))}</dd></div>
      </dl>
      <p class="ic-rule"><b>למה כאן:</b> ${rich(c.rule)}</p>
      <h4>איפה קונים · ${esc(IH.REGIONS[state.region])}</h4>
      <div class="ic-stores">${storesFor(it).map((s) => storeBlock(s)).join('')}</div>`;
    card.querySelector('.ic-close').onclick = () => { selected = null; renderItemCard(); renderPlan(); if (tour) tour.highlight(null); };
  }

  /* ---------- room lists ---------- */
  function renderRooms() {
    const rooms = plan.rooms.filter((r) => plan.items.some((it) => it.room === r.id && IH.CATALOG[it.type]));
    const ord = { living: 0, dining: 1, kitchen: 2, master: 3, ensuite: 4, kid: 5, adult: 6, office: 7, guest: 8, bath: 9, wc: 10, utility: 11, corridor: 12, balcony: 13 };
    rooms.sort((a, b) => (ord[a.kind] ?? 20) - (ord[b.kind] ?? 20));
    $('#room-list').innerHTML = rooms.map((r) => {
      const its = groupItems(plan.items.filter((it) => it.room === r.id && IH.CATALOG[it.type]));
      const checks = plan.checks.filter((c) => c.room === r.id);
      const sum = its.reduce((s, g) => s + g.total, 0);
      return `<section class="room" id="room-${r.id}">
        <header class="room-head">
          <div>
            <h3>${esc(r.name)}</h3>
            <p class="room-meta">${(r.w * r.d).toFixed(1)} מ״ר · <bdi dir="ltr">${r.w.toFixed(2)}×${r.d.toFixed(2)}</bdi> מ׳</p>
          </div>
          <div class="room-side">
            <span class="room-sum num">${money(sum)}</span>
            <button type="button" class="link-btn" data-goto="${r.id}">לסיור בחדר</button>
          </div>
        </header>
        ${checks.length ? `<ul class="checks-list">${checks.map((c) => `<li class="${c.ok ? 'ok' : 'warn'}"><span class="pill">${c.ok ? 'תקין' : 'לתשומת לב'}</span><span>${rich(c.text)}</span></li>`).join('')}</ul>` : ''}
        <ul class="items">${its.map(itemRow).join('')}</ul>
      </section>`;
    }).join('');
  }

  // identical pieces in one room (chairs, stools, nightstands) share a row
  function groupItems(list) {
    const groups = [];
    list.forEach((it) => {
      const key = it.type + '|' + dims(it) + '|' + (it.note || '');
      const g = groups.find((x) => x.key === key);
      if (g) { g.n++; g.total += price(it); g.ids.push(it.id); } else groups.push({ key, it, n: 1, total: price(it), ids: [it.id] });
    });
    return groups;
  }

  function itemRow(g) {
    const it = g.it;
    const c = IH.CATALOG[it.type];
    const stores = storesFor(it);
    return `<li class="item-row${g.ids.includes(selected) ? ' is-selected' : ''}" data-id="${it.id}">
      <details>
        <summary>
          <span class="ir-name">${esc(c.name)}${g.n > 1 ? ` <span class="ir-n">×${g.n}</span>` : ''}${it.note ? ` <span class="ir-note">${rich(it.note)}</span>` : ''}</span>
          <span class="ir-dims num"><bdi dir="ltr">${dims(it)}</bdi> ס״מ</span>
          <span class="ir-price num">${money(g.total)}</span>
          <span class="ir-where">${stores.map((s) => esc(IH.STORES[s].name)).join(' · ')}</span>
        </summary>
        <div class="ir-body">
          <p class="ic-rule"><b>למה כאן:</b> ${rich(c.rule)}</p>
          <div class="ic-stores">${stores.map((s) => storeBlock(s, true)).join('')}</div>
          <button type="button" class="link-btn" data-show="${it.id}">הצגה בתוכנית ובסיור</button>
        </div>
      </details>
    </li>`;
  }

  /* ---------- budget ---------- */
  function renderBudget() {
    const by = {};
    plan.items.forEach((it) => {
      const c = IH.CATALOG[it.type];
      if (!c) return;
      by[c.cat] = (by[c.cat] || 0) + price(it);
    });
    const total = totalBudget();
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 1;
    const tiers = ['eco', 'mid', 'prem'].map((t) => {
      const sum = plan.items.reduce((s, it) => {
        const c = IH.CATALOG[it.type];
        if (!c) return s;
        const q = c.unit === 'm' ? Math.max(0.6, it.len || Math.max(it.w, it.d)) : 1;
        return s + c.price[IH.TIER_INDEX[t]] * q;
      }, 0);
      return `<div class="tier${t === state.budget ? ' is-on' : ''}"><dt>${IH.TIERS[t]}</dt><dd class="num">${money(sum)}</dd></div>`;
    }).join('');
    $('#budget').innerHTML = `
      <dl class="tiers">${tiers}</dl>
      <table class="bars">
        <caption class="sr">פילוח התקציב לפי קטגוריה</caption>
        <tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td><span class="bar" style="width:${Math.max(2, (v / max) * 100).toFixed(1)}%"></span></td><td class="num">${money(v)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row">סה״כ</th><td></td><td class="num">${money(total)}</td></tr></tfoot>
      </table>`;
  }

  /* ---------- stores page ---------- */
  const STORE_GROUPS = [
    ['ריהוט ועיצוב', ['ikea', 'beitili', 'aminach', 'tollmans', 'kastiel', 'natuzzi']],
    ['שינה ומזרנים', ['hollandia', 'aminach']],
    ['מטבחים', ['regba', 'ikea']],
    ['חשמל ומכשירים', ['shekem', 'payngo']],
    ['טקסטיל ושטיחים', ['foxhome', 'golf']],
    ['רחצה, תאורה ומרפסת', ['homecenter', 'ace']]
  ];
  function renderStores() {
    const region = $('#s-region').value || state.region;
    $('#store-grid').innerHTML = STORE_GROUPS.map(([title, ids]) => `
      <section class="store-group">
        <h2>${title}</h2>
        <div class="store-cards">${ids.map((id) => storeCard(id, region)).join('')}</div>
      </section>`).join('');
  }
  function storeCard(id, region) {
    const s = IH.STORES[id];
    const near = IH.nearestBranch(id, region);
    const branches = s.branches.slice().sort((a, b) => (a === near ? -1 : b === near ? 1 : 0));
    return `<article class="store-card">
      <header><h3>${esc(s.name)} <span class="latin">${esc(s.latin)}</span></h3><p>${esc(s.kind)}</p></header>
      <div class="store-hot"><span class="label">${esc(s.hotlineNote)}</span>
        <span class="phone" dir="ltr">${esc(s.hotline)}</span>
        <button type="button" class="copy" data-copy="${esc(s.hotline)}" aria-label="העתקת המספר ${esc(s.hotline)}">העתקה</button>
      </div>
      ${(s.extra || []).map(([k, v]) => `<div class="store-hot"><span class="label">${esc(k)}</span><span class="phone" dir="ltr">${esc(v)}</span><button type="button" class="copy" data-copy="${esc(v)}" aria-label="העתקת המספר ${esc(v)}">העתקה</button></div>`).join('')}
      ${s.office ? `<p class="muted">משרדי החברה: ${esc(s.office)}</p>` : ''}
      ${branches.length ? `<ul class="branches">${branches.map((b) => `<li${b === near ? ' class="is-near"' : ''}>
          <span class="b-city">${esc(b.city)}${b === near ? ' <span class="pill">הקרוב אליכם</span>' : ''}</span>
          <span class="b-addr">${rich(b.addr)}</span>
          ${b.phone ? `<span class="phone" dir="ltr">${esc(b.phone)}</span>` : ''}
          <span class="b-links"><a href="${IH.wazeUrl(id, b)}" target="_blank" rel="noopener">Waze</a> · <a href="${IH.mapsUrl(id, b)}" target="_blank" rel="noopener">מפות</a></span>
        </li>`).join('')}</ul>` : '<p class="muted">הסניפים מתעדכנים באתר הרשת.</p>'}
      <p class="store-links"><a href="${s.branchesUrl}" target="_blank" rel="noopener">כל הסניפים ושעות הפתיחה</a> · <a href="${s.site}" target="_blank" rel="noopener">לאתר</a></p>
    </article>`;
  }

  /* ---------- rules page ---------- */
  const RULES = [
    ['מעברים', [
      ['90 ס״מ', 'מעבר ראשי בבית (מסדרון, מאחורי ספה, סביב שולחן אוכל).'],
      ['60–75 ס״מ', 'בצדי המיטה, כדי להיכנס ולצאת בנוחות ולהציע מצעים.'],
      ['105–120 ס״מ', 'בין אי מטבח לארונות, ו-120 ס״מ כששני אנשים מבשלים יחד.']
    ], 'Neufert, Architects\' Data; NKBA Kitchen & Bath Planning Guidelines'],
    ['מטבח', [
      ['משולש עבודה', 'כיור, כיריים ומקרר: כל צלע 1.2–2.7 מ׳ וסכום עד 7.9 מ׳, בלי מעבר ראשי שחוצה אותו.'],
      ['משטח', '40 ס״מ פנויים ליד הכיריים ו-60 ס״מ ליד הכיור. גובה 90 ס״מ, עומק 60.'],
      ['קולט', '65–75 ס״מ מעל כיריים גז, 55–65 מעל אינדוקציה.']
    ], 'NKBA Kitchen Planning Guidelines'],
    ['סלון וטלוויזיה', [
      ['מרחק צפייה', '1.2–1.6 × אלכסון המסך (זווית צפייה 30°–40°). מרכז המסך בגובה 100–110 ס״מ.'],
      ['שולחן סלון', 'שני שלישים מאורך הספה, 40–45 ס״מ ממנה.'],
      ['שטיח', 'גדול מספיק כדי שלפחות הרגליים הקדמיות של כל המושבים יעמדו עליו.']
    ], 'SMPTE EG-18, THX viewing-angle guidance; מדריכי עיצוב של Houzz ו-Architectural Digest'],
    ['פינת אוכל', [
      ['60 ס״מ', 'רוחב לכל סועד לאורך השולחן.'],
      ['90 ס״מ', 'פנויים מסביב, כדי להזיז כיסא ולעבור מאחוריו.'],
      ['75–85 ס״מ', 'בין משטח השולחן לתחתית המנורה התלויה.']
    ], 'Neufert, Architects\' Data'],
    ['חדרי שינה', [
      ['ראש המיטה', 'על קיר מלא, רצוי לא מתחת לחלון ולא מול הדלת בקו ישר.'],
      ['ארון', 'עומק 60 ס״מ. מול ארון עם דלתות ציר נדרשים 90 ס״מ; אחרת דלתות הזזה.'],
      ['שולחן עבודה', 'בניצב לחלון: אור מהצד ובלי סנוור במסך.']
    ], 'Neufert; הנחיות ארגונומיה למשרד ביתי'],
    ['ממ״ד', [
      ['דלת וחלון', 'משאירים את פתח דלת ההדף ואת חלון הפלדה פנויים, בלי רהיט שחוסם סגירה.'],
      ['מסנן אוורור', 'גישה חופשית למערכת הסינון, בלי ארון צמוד אליה.'],
      ['מדפים', 'לא תולים פריטים כבדים מעל המיטה.']
    ], 'פיקוד העורף, הנחיות לשימוש במרחב מוגן דירתי'],
    ['צבע ותאורה', [
      ['60-30-10', '60% צבע בסיס (קירות, רצפה), 30% צבע משני (רהיטים גדולים), 10% צבע הדגשה (כריות, אקססוריז).'],
      ['שלוש שכבות', 'תאורה כללית, תאורת משימה (קריאה, בישול) ותאורת אווירה. 2700K–3000K לאזורי מגורים.'],
      ['וילונות', 'מסילה קרובה לתקרה ורחבה מהחלון ב-15–25 ס״מ לכל צד, כדי שהחלון ייראה גדול.']
    ], 'עקרונות עיצוב מקובלים; IES Lighting Handbook']
  ];
  function renderRules() {
    $('#rules').innerHTML = RULES.map(([title, rows, src]) => `
      <section class="rule">
        <h2>${title}</h2>
        <dl>${rows.map(([k, v]) => `<div><dt>${rich(k)}</dt><dd>${rich(v)}</dd></div>`).join('')}</dl>
        <p class="rule-src">מקור: ${src}</p>
      </section>`).join('');
  }

  /* ---------- navigation and events ---------- */
  function route() {
    const h = (location.hash || '#plan').slice(1);
    const view = ['plan', 'stores', 'rules'].includes(h) ? h : 'plan';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('.mainnav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === view ? 'page' : 'false'));
    if (view === 'stores') renderStores();
    if (tour) tour.resize();
  }

  function bindEvents() {
    window.addEventListener('hashchange', route);
    $$('.stage-bar [role=tab]').forEach((t) => t.addEventListener('click', () => {
      $$('.stage-bar [role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      $('#panel-3d').hidden = t.dataset.stage !== '3d';
      $('#panel-2d').hidden = t.dataset.stage !== '2d';
      $('#stage-hint').textContent = t.dataset.stage === '3d'
        ? 'גררו כדי להסתכל מסביב · חיצים או WASD כדי ללכת · לחיצה על רהיט מציגה איפה קונים'
        : 'לחיצה על רהיט מציגה מידות, מחיר ואיפה קונים';
      if (tour && t.dataset.stage === '3d') tour.resize();
    }));
    $$('.tour-modes button').forEach((b) => b.addEventListener('click', () => {
      if (!tour) return;
      tour.setMode(b.dataset.mode);
      $$('.tour-modes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('#btn-spin').addEventListener('click', () => tour && tour.startSpin());
    $('#tour-rooms').addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]');
      if (b && tour) tour.goToRoom(b.dataset.room);
    });
    $$('.tour-pad [data-hold]').forEach((b) => {
      const k = b.dataset.hold;
      const on = (e) => { e.preventDefault(); if (tour) { tour.hold[k] = true; tour.spin = 0; tour.walkTo = null; } };
      const off = () => { if (tour) tour.hold[k] = false; };
      b.addEventListener('pointerdown', on);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, off));
    });
    document.addEventListener('click', (e) => {
      const cp = e.target.closest('.copy');
      if (cp) {
        const txt = cp.dataset.copy;
        const done = () => { cp.textContent = 'הועתק'; setTimeout(() => { cp.textContent = 'העתקה'; }, 1400); };
        try {
          navigator.clipboard.writeText(txt).then(done, () => selectText(cp.previousElementSibling));
        } catch (err) { selectText(cp.previousElementSibling); }
        return;
      }
      const show = e.target.closest('[data-show]');
      if (show) {
        select(show.dataset.show);
        $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const go = e.target.closest('[data-goto]');
      if (go && tour) {
        $('#tab-3d').click();
        tour.goToRoom(go.dataset.goto);
        $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    $('#s-region').addEventListener('change', renderStores);
    const mq = window.matchMedia('(max-width: 900px)');
    const syncBrief = () => { $('#brief-details').open = !mq.matches; };
    syncBrief();
    mq.addEventListener ? mq.addEventListener('change', syncBrief) : mq.addListener(syncBrief);
  }
  function selectText(node) {
    if (!node) return;
    const r = document.createRange();
    r.selectNodeContents(node);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  load();
  buildForm();
  bindEvents();
  renderRules();
  run();
  route();
})();
