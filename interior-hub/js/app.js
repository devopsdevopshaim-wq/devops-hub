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

  const DEFAULTS = { home: 'apartment', area: 100, rooms: 4, adults: 2, kids: 2, style: 'scandi', budget: 'mid', region: 'center', seats: 'auto', kitchen: 'auto', mamad: true, balcony: true, office: false, yard: 250, gardenStyle: 'med', pool: true, water: true, pergola: true, grill: true };
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
    const h = $(`#f-home-${state.home}`); if (h) h.checked = true;
    $('#f-yard').value = state.yard;
    $('#o-yard').textContent = state.yard;
    $('#f-gstyle').value = state.gardenStyle;
    ['pool', 'water', 'pergola', 'grill'].forEach((k) => { $('#f-' + k).checked = state[k]; });
    syncHomeFields();
  }
  function syncHomeFields() {
    const house = state.home === 'house';
    $('#garden-fields').hidden = !house;
    $('#c-balcony').hidden = house;
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
      office: $('#f-office').checked,
      home: val('home') || 'apartment',
      yard: +$('#f-yard').value,
      gardenStyle: $('#f-gstyle').value,
      pool: $('#f-pool').checked,
      water: $('#f-water').checked,
      pergola: $('#f-pergola').checked,
      grill: $('#f-grill').checked
    };
    $('#o-area').textContent = state.area;
    $('#o-yard').textContent = state.yard;
    syncHomeFields();
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
    // each part draws on its own: a failure in one (say, the 3D view) never blanks the rest
    [renderHead, renderPlan, renderTour, renderNotes, renderRenders, renderGarden, renderRooms, renderBudget, renderItemCard].forEach((fn) => {
      try { fn(); } catch (err) { reportError(fn.name, err); }
    });
    window.dispatchEvent(new Event('ih-plan'));
  }

  // a visible note instead of a silent blank area, with the technical reason for support
  function reportError(where, err) {
    if (window.console) console.error(where, err);
    if (where === 'renderTour') { tourFailed(err); return; }
    let bar = $('#err-bar');
    if (!bar) {
      bar = document.createElement('p');
      bar.id = 'err-bar';
      bar.className = 'err-bar';
      $('#main').prepend(bar);
    }
    bar.textContent = `חלק מהעמוד לא נטען (${where}: ${err && err.message ? err.message : err}). רעננו את העמוד; אם זה חוזר, צלמו את השורה הזו ושלחו.`;
  }
  function tourFailed(err) {
    const fb = $('#tour-fallback');
    fb.innerHTML = `הדפדפן לא פתח את התלת-ממד${err && err.message ? ` (${esc(err.message)})` : ''}. בדרך כלל זה נפתר כשסוגרים את כל חלונות הדפדפן ופותחים מחדש, או כשמפעילים ״האצת חומרה״ בהגדרות הדפדפן. התוכנית הדו-ממדית וכל הרשימות זמינות. <button type="button" class="btn btn-small" onclick="location.reload()">טעינה מחדש</button>`;
    fb.hidden = false;
    const t2 = $('#tab-2d');
    if (t2 && t2.getAttribute('aria-selected') !== 'true') t2.click();
  }

  function roomsLabel() {
    return `דירת ${state.rooms} חדרים, ${state.area} מ״ר`;
  }

  function renderHead() {
    const s = plan.style;
    $('#plan-eyebrow').textContent = userEdited ? 'התכנון שלכם' : 'תכנון לדוגמה · שנו את הדרישות מימין';
    $('#plan-title').textContent = roomsLabel();
    // the headline carries the home's real frontage as a drafting dimension line
    const dim = $('#plan-dim');
    dim.style.width = `min(100%, ${Math.round(plan.W * 44)}px)`;
    dim.querySelector('span').innerHTML = `<bdi dir="ltr">${plan.W.toFixed(2)}</bdi> מ׳`;
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
    if (!hasWebGL()) { tourFailed(null); return; }
    if (!IH.Tour) {
      // the 3D module loads after this script; build the tour as soon as it arrives
      if (!waitingTour) {
        waitingTour = true;
        window.addEventListener('ih-tour-ready', () => { try { renderTour(); } catch (err) { tourFailed(err); } }, { once: true });
        setTimeout(() => {
          if (IH.Tour) return;
          $('#tour-fallback').textContent = 'הסיור התלת-ממדי לא נטען. פתחו את האתר מכתובת אינטרנט (GitHub Pages או שרת מקומי) ולא מקובץ במחשב. התוכנית וכל הרשימות זמינות למטה.';
          $('#tour-fallback').hidden = false;
        }, 8000);
      }
      return;
    }
    if (!tour && tourBroken) return;
    if (!tour) {
      tourBroken = true;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a8662b';
      tour = new IH.Tour(host, {
        accent,
        onSelect: (id) => select(id, true),
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
        onMove: updateMini,
        // the card that opens inside the headset when a piece of furniture is clicked
        describe: (id) => {
          const it = plan.items.find((x) => x.id === id);
          const c = it && IH.CATALOG[it.type];
          if (!c) return null;
          const lines = [`${dims(it)} ס״מ · הערכה ${money(price(it))}`];
          const m = (IH.MODELS[it.type] || []).find((x) => x.price);
          if (m) lines.push(`${sellerName(m.seller)}: ${m.name} · ${money(m.price)}`);
          storesFor(it).slice(0, 3).forEach((sid) => {
            const st = IH.STORES[sid], b = IH.nearestBranch(sid, state.region);
            const phone = (b && b.phone) || st.hotline;
            lines.push(`${st.name}${phone ? ' · ' + phone : ''}${b ? ' · ' + b.city : ''}`);
          });
          return { eyebrow: roomName(it.room), title: c.name, lines };
        },
        onLock: (on) => {
          const h = $('#look-hint');
          if (!tour || !tour.looking) { h.hidden = true; return; }
          h.hidden = false;
          h.textContent = on ? 'העכבר מסתכל · חיצים או WASD הולכים · לחיצה על רהיט מציגה מחיר · Esc משחרר את העכבר, ו-Esc נוסף יוצא' : 'לחצו על המסך כדי להסתכל עם העכבר · Esc או ״יציאה״ חוזרים לעמוד';
        },
        onQualityOff: () => { const qb = $('#btn-quality'); qb.setAttribute('aria-pressed', 'false'); qb.textContent = 'איכות רגילה'; },
        onPhotoFail: () => { $('#pt-text').textContent = 'כרטיס המסך לא הצליח לחשב צילום מציאותי. הסיור הרגיל ממשיך לעבוד.'; $('#pt-save').disabled = true; },
        onError: (err) => tourFailed(err),
        onLost: (lost) => {
          const fb = $('#tour-fallback');
          if (!lost) { fb.hidden = true; return; }
          fb.innerHTML = 'כרטיס המסך של המחשב עצר את התלת-ממד (זה קורה לפעמים אחרי חישוב כבד). <button type="button" class="btn btn-small" onclick="location.reload()">טעינה מחדש</button>';
          fb.hidden = false;
        }
      });
      host.appendChild($('#tour-tip'));
      tourBroken = false;
    }
    if (tour.pt) stopPhoto();
    tour.load(plan);
    if (!tour.lost) $('#tour-fallback').hidden = true;
    const qb = $('#btn-quality');
    qb.setAttribute('aria-pressed', String(tour.quality));
    qb.textContent = tour.quality ? 'איכות גבוהה' : 'איכות רגילה';
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
  let waitingTour = false;
  let tourBroken = false;
  function updateMini(x, z, yaw) {
    if (!miniMe) return;
    miniMe.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${(-yaw * 180 / Math.PI).toFixed(1)})`);
  }
  // tested once per visit; the test context is released so it doesn't count against the browser's limit
  let webglOk = null;
  function hasWebGL() {
    if (webglOk !== null) return webglOk;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      webglOk = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { webglOk = false; }
    return webglOk;
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
    return Math.round((p * qty(it)) / 10) * 10;
  }
  function qty(it) {
    const c = IH.CATALOG[it.type];
    if (c.unit === 'm2') return Math.max(1, it.area || it.w * it.d);
    if (c.unit === 'm') return Math.max(0.6, it.len || Math.max(it.w, it.d));
    return 1;
  }
  function totalBudget() {
    return plan.items.reduce((s, it) => s + price(it), 0);
  }
  function storesFor(it) {
    const c = IH.CATALOG[it.type];
    if (!c) return [];
    const all = c.stores[state.budget] || [];
    // local shops (nurseries) only for buyers in their region; online and national chains always
    const out = all.filter((id) => { const s = IH.STORES[id]; return s && (!s.local || s.branches.some((b) => b.region === state.region)); });
    return out.length ? out : all.slice(0, 1);
  }
  function dims(it) {
    const side = it.face === 'E' || it.face === 'W';
    const w = side ? it.d : it.w, d = side ? it.w : it.d;
    if (it.type === 'rug') return `${cm(Math.min(it.w, it.d))}×${cm(Math.max(it.w, it.d))}`;
    const c = IH.CATALOG[it.type];
    if (c && c.unit === 'm2') return `${Math.round(qty(it))} מ״ר`;
    if (/Tree$/.test(it.type)) return `גובה ${(it.h).toFixed(1)} מ׳`;
    if (it.type === 'pool') return it.note;
    return `${cm(w)}×${cm(d)}×${cm(it.h)}`;
  }

  function storeBlock(id, compact) {
    const s = IH.STORES[id];
    const b = IH.nearestBranch(id, state.region);
    const phone = (b && b.phone) || s.hotline;
    const lines = [];
    lines.push(`<div class="store-line">
      <div class="store-id"><strong>${esc(s.name)}</strong> <span class="latin">${esc(s.latin)}</span></div>
      ${phone ? `<div class="store-contact">
        <span class="phone" dir="ltr">${esc(phone)}</span>
        <button type="button" class="copy" data-copy="${esc(phone)}" aria-label="העתקת המספר ${esc(phone)}">העתקה</button>
        <a class="call" href="tel:${esc(phone.replace(/[^\d*+]/g, ''))}">חיוג</a>
      </div>` : `<div class="store-contact"><a href="${s.site}" target="_blank" rel="noopener">הזמנה באתר ${esc(s.name)}</a></div>`}
      ${b ? `<div class="store-addr">${esc(b.addr)}, ${esc(b.city)} · <a href="${IH.wazeUrl(id, b)}" target="_blank" rel="noopener">Waze</a> · <a href="${IH.mapsUrl(id, b)}" target="_blank" rel="noopener">מפות</a></div>`
        : `<div class="store-addr">${esc(s.hotlineNote)} · <a href="${s.branchesUrl}" target="_blank" rel="noopener">רשימת הסניפים</a></div>`}
      ${!compact && b && b.phone && s.hotline !== b.phone ? `<div class="store-addr">${esc(s.hotlineNote)}: <span class="phone sm" dir="ltr">${esc(s.hotline)}</span></div>` : ''}
      ${!compact ? (s.extra || []).map(([k, v]) => `<div class="store-addr">${esc(k)}: <span class="phone sm" dir="ltr">${esc(v)}</span></div>`).join('') : ''}
    </div>`);
    return lines.join('');
  }

  // real models from several stores: published prices where found, IKEA product pages, and a
  // search of the piece on every other chain in the style's budget tier
  const sellerName = (id) => (IH.STORES[id] ? IH.STORES[id].name : id);
  const modelPrice = (m) => (m.price ? `${m.from ? 'החל מ-' : ''}${money(m.price)}` : 'המחיר באתר');
  function modelRows(it) {
    const c = IH.CATALOG[it.type];
    const rows = [];
    (IH.MODELS[it.type] || []).forEach((m) => rows.push({ seller: sellerName(m.seller), name: m.name, price: modelPrice(m), url: m.url, found: !!m.price }));
    (IH.PRODUCTS[it.type] || []).forEach((p) => rows.push({ seller: 'איקאה', name: p.name, price: 'המחיר באתר', url: p.url, found: false }));
    const listed = new Set(rows.map((r) => r.seller));
    storesFor(it).forEach((sid) => {
      const st = IH.STORES[sid];
      if (!st || listed.has(st.name)) return;
      const u = sid === 'ikea' ? null : IH.storeSearchUrl(sid, c.name);
      if (u) rows.push({ seller: st.name, name: `${c.name} בקטלוג`, price: `כ-${money(price(it))}`, url: u, est: true });
    });
    return rows;
  }
  function modelsBlock(it, limit) {
    const rows = modelRows(it).slice(0, limit || 99);
    if (!rows.length) return '';
    return `<div class="models"><h4>דגמים ומחירים מכמה חנויות</h4>
      <div class="models-scroll"><table class="models-table">
        <thead><tr><th scope="col">חנות</th><th scope="col">דגם</th><th scope="col">מחיר</th></tr></thead>
        <tbody>${rows.map((r) => `<tr${r.found ? ' class="is-found"' : ''}><td>${esc(r.seller)}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${rich(r.name)}</a></td><td class="num">${esc(r.price)}${r.est ? '<span class="muted"> הערכה</span>' : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="models-note">מחירים מודגשים פורסמו באתר המוכר (בדיקה: ${IH.STORES_CHECKED}). מחירים משתנים ומבצעים מתחלפים; המחיר הסופי רק מול החנות.</p>
    </div>`;
  }
  const productsBlock = (it) => modelsBlock(it);

  /* ---------- selected item card ---------- */
  function select(id, fromTour) {
    selected = id;
    const it = plan.items.find((x) => x.id === id);
    renderPlan();
    renderItemCard();
    renderTourCard(true);
    $$('.item-row').forEach((r) => r.classList.toggle('is-selected', r.dataset.id === id));
    if (tour && it) tour.lookAtItem(id);
  }

  function renderTourCard(show) {
    const card = $('#tour-card');
    const it = selected && plan.items.find((x) => x.id === selected);
    if (!it || !IH.CATALOG[it.type] || !show) { card.hidden = true; return; }
    const c = IH.CATALOG[it.type];
    card.hidden = false;
    card.innerHTML = `
      <div class="tc-head">
        <div><p class="eyebrow">${esc(roomName(it.room))}</p><h3>${esc(c.name)}${it.note ? ` <span class="ic-note">${rich(it.note)}</span>` : ''}</h3></div>
        <button type="button" class="ic-close" data-tc-close aria-label="סגירה">×</button>
      </div>
      <p class="tc-meta"><span class="num"><bdi dir="ltr">${dims(it)}</bdi></span> · הערכה ${esc(IH.TIERS[state.budget])}: <b class="num">${money(price(it))}</b></p>
      ${modelsBlock(it, 5)}
      <button type="button" class="btn btn-small" data-tc-more>כל הפרטים, הטלפונים והכתובות</button>`;
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
      ${productsBlock(it)}
      <h4>איפה קונים · ${esc(IH.REGIONS[state.region])}</h4>
      <div class="ic-stores">${storesFor(it).map((s) => storeBlock(s)).join('')}</div>`;
    card.querySelector('.ic-close').onclick = () => { selected = null; renderItemCard(); renderPlan(); if (tour) tour.highlight(null); };
  }

  /* ---------- room lists ---------- */
  /* ---------- AI renders: assets/renders/<style>-<room>.jpg, shown only when the file exists ---------- */
  const RENDER_ROOMS = [['living', 'סלון'], ['kitchen', 'מטבח ופינת אוכל'], ['master', 'חדר שינה הורים'], ['kid', 'חדר ילדים'], ['bath', 'חדר רחצה']];
  const renderSrc = (room) => `assets/renders/${state.style}-${room}.jpg`;
  function renderRenders() {
    const grid = $('#render-grid');
    const kinds = new Set(plan.rooms.map((r) => r.kind));
    const list = RENDER_ROOMS.filter(([k]) => k !== 'kid' || kinds.has('kid'));
    grid.innerHTML = list.map(([k, name]) => `<figure class="render" data-render="${k}" hidden><img src="${renderSrc(k)}" alt="הדמיה: ${esc(name)}, סגנון ${esc(plan.style.name)}" decoding="async"><figcaption>${esc(name)}</figcaption></figure>`).join('');
    let shown = 0;
    $$('.render', grid).forEach((f) => {
      const img = f.querySelector('img');
      img.addEventListener('load', () => { f.hidden = false; shown++; $('#renders').hidden = false; });
      img.addEventListener('error', () => f.remove());
    });
    $('#renders').hidden = shown === 0;
  }

  function renderRooms() {
    const rooms = plan.rooms.filter((r) => plan.items.some((it) => it.room === r.id && IH.CATALOG[it.type]));
    const ord = { living: 0, dining: 1, kitchen: 2, master: 3, ensuite: 4, kid: 5, adult: 6, office: 7, guest: 8, bath: 9, wc: 10, utility: 11, corridor: 12, balcony: 13, yard: 14 };
    rooms.sort((a, b) => (ord[a.kind] ?? 20) - (ord[b.kind] ?? 20));
    $('#room-list').innerHTML = rooms.map(roomSection).join('');
  }

  function roomSection(r) {
    const its = groupItems(plan.items.filter((it) => it.room === r.id && IH.CATALOG[it.type]));
    const checks = plan.checks.filter((c) => c.room === r.id);
    const sum = its.reduce((s, g) => s + g.total, 0);
    const meta = r.yard ? `${Math.round(plan.yard.area)} מ״ר סביב הבית` : `${(r.w * r.d).toFixed(1)} מ״ר · <bdi dir="ltr">${r.w.toFixed(2)}×${r.d.toFixed(2)}</bdi> מ׳`;
    return `<section class="room" id="room-${r.id}">
        <header class="room-head">
          <div>
            <h3>${esc(r.name)}</h3>
            <p class="room-meta">${meta}</p>
          </div>
          <div class="room-side">
            <span class="room-sum num">${money(sum)}</span>
            <button type="button" class="link-btn" data-goto="${r.id}">${r.yard ? 'לסיור בחצר' : 'לסיור בחדר'}</button>
          </div>
        </header>
        ${checks.length ? `<ul class="checks-list">${checks.map((c) => `<li class="${c.ok ? 'ok' : 'warn'}"><span class="pill">${c.ok ? 'תקין' : 'לתשומת לב'}</span><span>${rich(c.text)}</span></li>`).join('')}</ul>` : ''}
        <ul class="items">${its.map(itemRow).join('')}</ul>
      </section>`;
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
          ${productsBlock(it)}
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
    ['ריהוט ועיצוב', ['ikea', 'beitili', 'iddesign', 'aminach', 'tollmans', 'kastiel', 'natuzzi', 'kuka']],
    ['שינה ומזרנים', ['hollandia', 'aminach']],
    ['מטבחים', ['regba', 'ikea']],
    ['חשמל ומכשירים', ['shekem', 'payngo']],
    ['טקסטיל ושטיחים', ['foxhome', 'golf']],
    ['רחצה, תאורה ומרפסת', ['homecenter', 'ace']],
    ['חדרי ילדים ותינוקות', ['shilav', 'ikea', 'aminach']],
    ['ספות ורהיטים מעוצבים', ['iddesign', 'kuka']],
    ['משתלות', ['ganyarak', 'rgnursery', 'azur', 'ganod', 'yagur', 'bialik', 'beithai', 'kaduri', 'hadarnoy']],
    ['בריכות שחייה', ['adel', 'hagag']]
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
      ${s.hotline ? `<div class="store-hot"><span class="label">${esc(s.hotlineNote)}</span>
        <span class="phone" dir="ltr">${esc(s.hotline)}</span>
        <button type="button" class="copy" data-copy="${esc(s.hotline)}" aria-label="העתקת המספר ${esc(s.hotline)}">העתקה</button>
      </div>` : `<p class="muted">${esc(s.hotlineNote)}</p>`}
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
  const GARDEN_RULES = [
    ['אזורים בחצר', [
      ['דק', 'מול יציאת הסלון, באותו גובה של הרצפה בפנים (עד 2 ס״מ הפרש) ובשיפוע 1% החוצה.'],
      ['אוכל וגריל', 'ליד המטבח, בצל פרגולה; הגריל 3 מ׳ לפחות מחלונות פתוחים וחומרים דליקים.'],
      ['בריכה', 'בחלק השמשי והרחוק מהבית, עם 1.2 מ׳ ריצוף מחוספס מסביב.']
    ], 'עקרונות אדריכלות נוף; משרד החקלאות, הנחיות לגינון חסכוני במים'],
    ['בריכה ובטיחות', [
      ['1.2 מ׳', 'גובה מינימלי לגדר בטיחות סביב בריכה כשיש ילדים, עם שער שנסגר וננעל מעצמו.'],
      ['3.5×7 מ׳', 'מידה נפוצה לבריכה ביתית; עומק 1.2–1.5 מ׳ בלי קפיצות.'],
      ['3 מ׳', 'מרחק מינימלי של עצים מהבריכה: פחות עלים במים, שורשים רחוקים מהמבנה.']
    ], 'הנחיות בטיחות מקובלות לבריכות פרטיות'],
    ['צמחייה ומים', [
      ['טפטוף', 'לעצים ולערוגות; ממטירים רק למדשאה, בבוקר מוקדם. חוסך עד 50% מים.'],
      ['6 שעות', 'שמש ישירה שמדשאה טבעית צריכה ביום; בצל חלקי עדיף חצץ וצמחי צל.'],
      ['צמחים', 'זית, הדרים, לבנדר, רוזמרין ובוגנוויליה מתאימים לאקלים הים-תיכוני וחסכוניים במים.']
    ], 'משרד החקלאות, שירותי ההדרכה; רשות המים'],
    ['תאורה בחוץ', [
      ['2700K', 'גוון חם לתאורת גינה; פנס שביל כל 2–3 מ׳ בגובה נמוך.'],
      ['פחת', 'כל נקודת חשמל בחוץ (משאבה, מפל, תאורה) מוגנת במפסק פחת ובקופסה אטומה.']
    ], 'IES; תקנות החשמל']
  ];
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
  function rulesHtml(list) {
    return list.map(([title, rows, src]) => `
      <section class="rule">
        <h2>${title}</h2>
        <dl>${rows.map(([k, v]) => `<div><dt>${rich(k)}</dt><dd>${rich(v)}</dd></div>`).join('')}</dl>
        <p class="rule-src">מקור: ${src}</p>
      </section>`).join('');
  }
  function renderRules() {
    $('#rules').innerHTML = rulesHtml(RULES.concat(GARDEN_RULES));
  }

  /* ---------- garden tab ---------- */
  function renderGarden() {
    const house = !!plan.yard;
    $('#garden-empty').hidden = house;
    $('#garden-body').hidden = !house;
    $('#garden-rules').innerHTML = rulesHtml(GARDEN_RULES);
    $('#garden-stores').innerHTML = ['ganyarak', 'rgnursery', 'azur', 'ganod', 'yagur', 'bialik', 'beithai', 'kaduri', 'hadarnoy', 'adel', 'hagag', 'homecenter', 'ace'].map((id) => storeCard(id, state.region)).join('');
    if (!house) { $('#garden-actions').innerHTML = ''; return; }
    const y = plan.yard;
    const yr = plan.rooms.find((r) => r.yard);
    const its = plan.items.filter((it) => it.room === yr.id && IH.CATALOG[it.type]);
    const sum = its.reduce((a, it) => a + price(it), 0);
    const pool = its.find((it) => it.type === 'pool');
    $('#garden-lede').textContent = `חצר ${y.styleName} של כ-${Math.round(y.area)} מ״ר סביב הבית: ${y.blurb}`;
    $('#garden-facts').innerHTML = [
      ['שטח החצר', `${Math.round(y.area)} מ״ר`],
      ['סגנון', y.styleName],
      ['בריכה', pool ? pool.note : 'אין'],
      ['עצים', String(its.filter((it) => /Tree$/.test(it.type)).length)],
      ['תקציב משוער', money(sum)]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('#garden-actions').innerHTML = `<button type="button" class="btn" data-garden-tour>לסיור בחצר ב-360°</button>`;
    IH.renderPlan($('#garden-svg'), plan, { selected, onSelect: (id) => { location.hash = '#plan'; route(); $('#tab-3d').click(); select(id, true); $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    const warn = plan.checks.filter((c) => c.room === yr.id && !c.ok);
    const gnotes = plan.notes.filter((n) => /חצר|בריכה|ג׳קוזי/.test(n));
    $('#garden-notes').innerHTML = warn.length || gnotes.length ? `<h2 class="notes-title">שימו לב</h2><ul>${gnotes.map((n) => `<li class="note">${rich(n)}</li>`).concat(warn.map((c) => `<li class="note is-warn">${rich(c.text)}</li>`)).join('')}</ul>` : '';
    $('#garden-list').innerHTML = roomSection(yr);
  }

  /* ---------- navigation and events ---------- */
  function route() {
    const h = (location.hash || '#plan').slice(1);
    const view = ['plan', 'stores', 'rules', 'garden', 'photos'].includes(h) ? h : 'plan';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('.mainnav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === view ? 'page' : 'false'));
    if (view === 'stores') renderStores();
    if (view === 'photos' && IH.photos) IH.photos.show();
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
    $('#btn-quality').addEventListener('click', (e) => {
      if (!tour) return;
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      tour.setQuality(on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.textContent = on ? 'איכות גבוהה' : 'איכות רגילה';
    });
    $('#btn-photo').addEventListener('click', startPhoto);
    // immersive walk-through: computer (mouse look) or phone (motion sensors, cardboard)
    const vrMenu = $('#vr-menu');
    $('#btn-vr').addEventListener('click', (e) => {
      const open = vrMenu.hidden;
      vrMenu.hidden = !open;
      e.currentTarget.setAttribute('aria-expanded', String(open));
      const touch = matchMedia('(pointer: coarse)').matches;
      const mouse = matchMedia('(any-pointer: fine)').matches;
      vrMenu.querySelector('[data-vr="look"]').hidden = touch && !mouse;
      vrMenu.querySelector('[data-vr="gyro"]').hidden = !touch;
      vrMenu.querySelector('[data-vr="stereo"]').hidden = !touch;
    });
    document.addEventListener('click', (e) => {
      if (!vrMenu.hidden && !e.target.closest('#vr-menu, #btn-vr')) { vrMenu.hidden = true; $('#btn-vr').setAttribute('aria-expanded', 'false'); }
    });
    vrMenu.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-vr]');
      if (!b || !tour) return;
      vrMenu.hidden = true;
      $('#btn-vr').setAttribute('aria-expanded', 'false');
      const kind = b.dataset.vr;
      enterImmersive(kind === 'stereo');
      if (kind === 'look') { tour.startLook(); return; }
      try {
        await tour.startGyro(kind === 'stereo');
      } catch (err) {
        exitImmersive();
        const fb = $('#tour-fallback');
        fb.textContent = 'הטלפון לא נתן גישה לחיישני התנועה. אשרו ״תנועה והתמצאות״ בהגדרות הדפדפן ונסו שוב.';
        fb.hidden = false;
        setTimeout(() => { fb.hidden = true; }, 5000);
      }
    });
    $('#vr-exit').addEventListener('click', exitImmersive);
    // Esc first frees the mouse (the browser does that), a second Esc leaves the immersive view
    let freedAt = 0;
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) freedAt = Date.now(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !$('#tour').classList.contains('is-full') || document.pointerLockElement) return;
      if (Date.now() - freedAt < 250) return;
      exitImmersive();
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fullReal) exitImmersive(); });
    $('#pt-close').addEventListener('click', stopPhoto);
    $('#pt-save').addEventListener('click', async () => {
      if (!tour) return;
      const url = await tour.grabPhoto();
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `matar-${state.style}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
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
    $('#btn-to-house').addEventListener('click', () => {
      state.home = 'house';
      if (state.area < 120) state.area = 160;
      if (state.rooms < 5) state.rooms = 5;
      writeForm(); save(); userEdited = true; run();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-tc-close]')) { $('#tour-card').hidden = true; return; }
      if (e.target.closest('[data-tc-more]')) { $('#item-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-garden-tour]')) {
        location.hash = '#plan';
        route();
        setTimeout(() => {
          $('#tab-3d').click();
          const yr = plan.rooms.find((r) => r.yard);
          if (tour && yr) tour.goToRoom(yr.id);
          $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
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
        if (location.hash === '#garden') { location.hash = '#plan'; route(); }
        select(show.dataset.show);
        $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const go = e.target.closest('[data-goto]');
      if (go && tour) {
        if (location.hash === '#garden') { location.hash = '#plan'; route(); }
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
  /* ---------- immersive screen: real full screen where allowed, otherwise the tour fills the window ---------- */
  let fullReal = false;
  function enterImmersive(landscape) {
    const el = $('#tour');
    el.classList.add('is-full');
    document.body.classList.add('tour-full');
    $('#vr-exit').hidden = false;
    $('#tour-card').hidden = true;
    fullReal = false;
    try {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = req && req.call(el);
      if (p && p.then) p.then(() => {
        fullReal = true;
        if (landscape && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
      else if (req) fullReal = true;
    } catch (e) { /* the window-filling fallback stays */ }
    if (tour) tour.resize();
  }
  function exitImmersive() {
    const el = $('#tour');
    if (tour) { tour.stopGyro(); tour.stopLook(); }
    el.classList.remove('is-full');
    document.body.classList.remove('tour-full');
    $('#vr-exit').hidden = true;
    $('#look-hint').hidden = true;
    const wasReal = fullReal;
    fullReal = false;
    try { if (wasReal && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    if (tour) tour.resize();
  }

  /* ---------- photoreal still of the current view ---------- */
  async function startPhoto() {
    if (!tour || tour.pt) return;
    const panel = $('#pt-panel');
    const mobile = matchMedia('(pointer: coarse)').matches;
    panel.hidden = false;
    $('#tour').classList.add('is-photo');
    $('#pt-save').disabled = true;
    $('#pt-text').textContent = tour.software ? 'מכין את הסצנה… בדפדפן הזה אין האצת גרפיקה, ולכן החישוב יהיה איטי. במחשב עם כרטיס מסך זה לוקח כדקה.' : 'מכין את הסצנה…';
    $('#pt-bar').style.width = '2%';
    $('#tour-card').hidden = true;
    try {
      await tour.startPhoto((v, phase, n) => {
        $('#pt-bar').style.width = (v * 100).toFixed(1) + '%';
        if (phase === 'build') return;
        const done = v >= 1;
        $('#pt-text').textContent = done
          ? 'התמונה מוכנה. אור השמש והשמיים נכנס מהחלונות, עם החזרים וצללים רכים.'
          : `מחשב אור אמיתי: ${Math.round(v * 100)}% (${n} מעברים). התמונה מתחדדת עם הזמן.`;
        $('#pt-save').disabled = n < 8;
      }, tour.software ? 24 : mobile ? 90 : 220);
    } catch (e) {
      $('#pt-text').textContent = 'הדפדפן הזה לא מצליח לחשב צילום מציאותי. נסו במחשב או בדפדפן Chrome מעודכן.';
      tour.stopPhoto();
    }
  }
  function stopPhoto() {
    if (tour) tour.stopPhoto();
    $('#pt-panel').hidden = true;
    $('#tour').classList.remove('is-photo');
  }

  function selectText(node) {
    if (!node) return;
    const r = document.createRange();
    r.selectNodeContents(node);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // shared with photos.js and print.js
  IH.app = {
    get plan() { return plan; },
    get state() { return state; },
    get tour() { return tour; },
    price, qty, dims, storesFor, modelRows, roomName, totalBudget, groupItems, storeCard, rulesHtml,
    RULES, GARDEN_RULES, esc, rich, money,
    show(id) {
      location.hash = '#plan';
      route();
      $('#tab-3d').click();
      select(id, true);
      $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  load();
  buildForm();
  bindEvents();
  renderRules();
  run();
  route();
})();
