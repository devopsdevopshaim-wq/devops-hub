/* ===========================================================
   מסע — לוגיקת האפליקציה
   ללא תלויות (מלבד Leaflet למפות). עובד גם בפתיחה ישירה של index.html.
   =========================================================== */
(function () {
  'use strict';

  const DATA = window.APP_DATA;
  const DESTS = DATA.destinations;
  const byId = Object.fromEntries(DESTS.map(d => [d.id, d]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const ext = (href, text, cls) => `<a href="${esc(href)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}>${text}</a>`;

  /* ---------- אחסון מקומי (בטוח) ---------- */
  const store = {
    get(k, def) { try { const v = localStorage.getItem('masa.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('masa.' + k, JSON.stringify(v)); } catch (e) { /* אחסון חסום */ } }
  };

  /* ---------- תאריכים ---------- */
  const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const DOW_S = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const MONTHS_S = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((parse(iso(b)) - parse(iso(a))) / 864e5);
  const fmt = (d) => `${d.getDate()}.${d.getMonth() + 1}`;
  const fmtLong = (d) => `יום ${DOW[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
  const today = parse(iso(new Date()));
  const holidayMap = Object.fromEntries(DATA.holidays.map(h => [h.date, h.name]));
  const money = (n) => '₪' + Math.round(n).toLocaleString('he-IL');
  const hm = (mins) => { const m = ((Math.round(mins) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };

  /* ---------- מצב ---------- */
  function defaultStart() {
    let d = addDays(today, 14);
    while (d.getDay() !== 4) d = addDays(d, 1); // יום חמישי
    return d;
  }
  const saved = store.get('plan', null);
  const st = {
    start: defaultStart(),
    end: addDays(defaultStart(), 4),
    picking: 'start',
    travelers: 2,
    region: 'all',
    style: 'mid',
    calMonth: null,
    exploreFilter: 'all',
    tab: 'overview'
  };
  if (saved && saved.start && parse(saved.start) >= today) {
    st.start = parse(saved.start);
    st.end = saved.end ? parse(saved.end) : null;
    st.travelers = saved.travelers || 2;
    st.region = saved.region || 'all';
    st.style = saved.style || 'mid';
  }
  st.calMonth = new Date(st.start.getFullYear(), st.start.getMonth(), 1);
  const savePlan = () => store.set('plan', { start: iso(st.start), end: st.end ? iso(st.end) : null, travelers: st.travelers, region: st.region, style: st.style });

  const nightsOf = (s) => s.end ? diffDays(s.start, s.end) : 0;

  function holidaysBetween(a, b) {
    const out = [];
    if (!a || !b) return out;
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (holidayMap[iso(d)]) out.push({ d: new Date(d), name: holidayMap[iso(d)] });
    return out;
  }
  function workdaysBetween(a, b) {
    let n = 0;
    if (!a || !b) return 0;
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (d.getDay() <= 4 && !holidayMap[iso(d)]) n++;
    return n;
  }

  /* ---------- הערכת יעד לתאריכים ---------- */
  const IDEAL = { eilat: 28, telaviv: 27, dubai: 28, bangkok: 31, athens: 26, barcelona: 26 };
  function weatherWord(t) {
    if (t < 8) return 'קר';
    if (t < 16) return 'קריר';
    if (t < 26) return 'נעים';
    if (t < 33) return 'חם';
    return 'חם מאוד';
  }
  function isPeak(s) {
    const m = s.start.getMonth() + 1;
    return m === 7 || m === 8 || holidaysBetween(s.start, s.end || s.start).some(h => /פסח|סוכות|ראש השנה|חנוכה|חופש/.test(h.name));
  }
  function estimate(d, s) {
    const nights = Math.max(1, nightsOf(s));
    const days = nights + 1;
    const n = s.travelers;
    const rooms = Math.ceil(n / 2);
    const peak = isPeak(s);
    const styleF = { budget: 0.7, mid: 1, lux: 1.7 }[s.style];
    const needCar = /^(חיוני|מומלץ|כן|שימושי)/.test(d.car.need);
    const lines = {
      flight: d.costs.flight * n * (peak ? 1.3 : 1) * (s.style === 'lux' ? 1.6 : 1),
      hotel: d.costs.hotel[s.style] * nights * rooms * (peak ? 1.2 : 1),
      car: needCar ? d.costs.car * days : 0,
      food: d.costs.food * n * days * styleF,
      transport: d.costs.transport * n * days * (needCar ? 0.4 : 1),
      fun: 90 * n * days * styleF
    };
    const total = Object.values(lines).reduce((a, b) => a + b, 0);
    return { lines, total, peak, nights, days };
  }
  function evaluate(d, s) {
    const mid = s.end ? addDays(s.start, Math.floor(nightsOf(s) / 2)) : s.start;
    const m = mid.getMonth();
    const temp = d.climate[m];
    const ideal = IDEAL[d.id] || 23;
    let score = 100 - Math.abs(temp - ideal) * 3.6;
    const best = d.bestMonths.includes(m + 1);
    if (best) score += 8;
    const nights = nightsOf(s);
    const longHaul = d.flightTime >= 9;
    const tooShort = longHaul && nights < 6;
    if (tooShort) score -= 28;
    if (d.region === 'il' && nights <= 3) score += 6;
    if (!longHaul && d.region === 'abroad' && nights <= 5) score += 4;
    return { score: Math.round(Math.max(0, Math.min(99, score))), temp, best, tooShort, month: m, est: estimate(d, s) };
  }
  function ranked(s, region) {
    return DESTS
      .filter(d => region === 'all' || d.region === region)
      .map(d => ({ d, e: evaluate(d, s) }))
      .sort((a, b) => b.e.score - a.e.score);
  }

  /* ---------- קישורים לאתרי הזמנה ---------- */
  const yymmdd = (d) => String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
  function siteUrl(id, d, s) {
    const a = iso(s.start), b = iso(s.end || addDays(s.start, 3));
    const n = s.travelers, rooms = Math.ceil(n / 2), city = enc(d.nameEn);
    switch (id) {
      case 'skyscanner': return `https://www.skyscanner.co.il/transport/flights/tlv/${d.iata.toLowerCase()}/${yymmdd(s.start)}/${yymmdd(s.end || addDays(s.start, 3))}/?adultsv2=${n}`;
      case 'gflights': return `https://www.google.com/travel/flights?q=${enc(`Flights from TLV to ${d.iata} on ${a} through ${b}`)}`;
      case 'kayak': return `https://www.kayak.com/flights/TLV-${d.iata}/${a}/${b}/${n}adults`;
      case 'booking': return `https://www.booking.com/searchresults.he.html?ss=${city}&checkin=${a}&checkout=${b}&group_adults=${n}&no_rooms=${rooms}`;
      case 'airbnb': return `https://www.airbnb.com/s/${city}/homes?checkin=${a}&checkout=${b}&adults=${n}`;
      case 'expedia': return `https://www.expedia.com/Hotel-Search?destination=${city}&startDate=${a}&endDate=${b}&adults=${n}`;
      case 'kayakcars': return `https://www.kayak.com/cars/${city}/${a}/${b}`;
      case 'rentalcars': return 'https://www.rentalcars.com/';
      case 'tripadvisor': return `https://www.tripadvisor.com/Search?q=${city}`;
      case 'issta': return 'https://www.issta.co.il/';
      case 'gulliver': return 'https://www.gulliver.co.il/';
      case 'elal': return 'https://www.elal.com/he/';
    }
    return '#';
  }
  const sitesFor = (d) => DATA.bookingSites.filter(x => !(d.flightTime === 0 && (x.kind === 'flight' || x.kind === 'package')) && !(d.region === 'il' && x.id === 'elal'));
  const KIND = { flight: 'טיסות', hotel: 'לינה', car: 'רכב', info: 'מידע', package: 'חבילות' };
  const gmaps = (q) => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
  const ytSearch = (q) => `https://www.youtube.com/results?search_query=${enc(q)}`;
  function gcal(d, s) {
    const c = (x) => iso(x).replace(/-/g, '');
    const end = addDays(s.end || s.start, 1);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc('חופשה ב' + d.name)}&dates=${c(s.start)}/${c(end)}&details=${enc('תוכנן במסע — ' + d.tagline)}&location=${enc(d.nameEn)}`;
  }

  /* ---------- פוסטר ---------- */
  const poster = (d, w, h) => window.Posters.svg(d, { w: w || 300, h: h || 340 });

  /* ---------- ניתוב ---------- */
  function route() {
    const raw = (location.hash || '#home').slice(1);
    let view = raw, arg = null;
    if (raw.startsWith('dest-')) {
      view = 'dest';
      const parts = raw.slice(5).split('.');
      arg = parts[0];
      if (parts[1]) st.tab = parts[1];
    }
    if (!$('#view-' + view)) view = 'home';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
    $$('.mainnav [data-nav]').forEach(a => {
      const on = a.dataset.nav === view || (view === 'dest' && a.dataset.nav === 'explore');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const R = { home: renderHome, explore: renderExplore, dest: () => renderDest(arg), airport: renderAirport, budget: renderBudget, trips: renderTrips, help: renderHelp };
    R[view]();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* =========================================================
     דף הבית — תכנון לפי תאריכים
     ========================================================= */
  function renderHome() {
    const el = $('#view-home');
    el.innerHTML = `
      <div class="wrap">
        <div class="hero">
          <div class="hero-copy">
            <span class="eyebrow">TLV → העולם</span>
            <h1 class="h-display">סמנו תאריכים ביומן.<br><span>אנחנו נמצא לאן לטוס.</span></h1>
            <p class="lead">מסע מדרג ${DESTS.length} יעדים בארץ ובחו״ל לפי מזג האוויר בתאריכים שבחרתם, אורך החופשה והתקציב. מכאן ממשיכים לטיסות, זמני הגעה לנתב״ג, מלונות, רכב, מסעדות כשרות ומישלן, תחבורה ציבורית ומסלולים.</p>
            <div class="hero-stats">
              <div><b class="num">${DESTS.length}</b><span>יעדים</span></div>
              <div><b class="num">${DATA.bookingSites.length}</b><span>אתרי הזמנה מחוברים</span></div>
              <div><b class="num">${DESTS.reduce((a, d) => a + d.routes.length, 0)}</b><span>מסלולי טיול</span></div>
            </div>
          </div>
          <div class="board" aria-label="לוח המראות — היעדים המומלצים לתאריכים שלכם">
            <div class="board-top">
              <span class="board-title">DEPARTURES · המראות מומלצות</span>
              <span class="board-clock" id="clock">--:--</span>
            </div>
            <div class="board-rows" id="boardRows"></div>
          </div>
        </div>

        <div class="panel planner" id="planner">
          <div class="planner-cal">
            <div class="cal-nav">
              <button class="icon-btn" type="button" id="calPrev" aria-label="החודש הקודם"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>
              <strong id="calHint" class="fine">בחרו תאריך יציאה</strong>
              <button class="icon-btn" type="button" id="calNext" aria-label="החודש הבא"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>
            </div>
            <div class="cal-months" id="calMonths"></div>
            <div class="cal-legend">
              <span><i style="background:var(--teal)"></i>יציאה / חזרה</span>
              <span><i style="background:var(--teal-soft)"></i>ימי החופשה</span>
              <span><i style="background:var(--amber);border-radius:50%"></i>חג או מועד</span>
            </div>
          </div>
          <div class="planner-side">
            <div id="passWrap"></div>
            <div class="controls-row">
              <div class="field">
                <span class="label">מטיילים</span>
                <div class="stepper">
                  <button type="button" data-step="-1" aria-label="פחות מטיילים">−</button>
                  <output id="travOut">${st.travelers}</output>
                  <button type="button" data-step="1" aria-label="יותר מטיילים">+</button>
                </div>
              </div>
              <div class="field">
                <span class="label">איפה</span>
                <div class="seg" id="regionSeg">
                  <button type="button" data-v="all">הכל</button>
                  <button type="button" data-v="il">בארץ</button>
                  <button type="button" data-v="abroad">בחו״ל</button>
                </div>
              </div>
            </div>
            <div class="field">
              <span class="label">סגנון חופשה</span>
              <div class="seg" id="styleSeg">
                <button type="button" data-v="budget">חסכוני</button>
                <button type="button" data-v="mid">בינוני</button>
                <button type="button" data-v="lux">יוקרה</button>
              </div>
            </div>
            <p class="fine">המחירים משוערים לכל הקבוצה, כולל טיסה, לינה, אוכל, תחבורה ואטרקציות.</p>
          </div>
        </div>

        <div class="section-head mt">
          <div>
            <span class="eyebrow">התאמה לתאריכים</span>
            <h2 class="h-section">היעדים שמתאימים לכם</h2>
          </div>
          <a class="btn" href="#explore">כל היעדים</a>
        </div>
        <div class="results" id="results"></div>
      </div>`;

    $('#calPrev').onclick = () => { st.calMonth = new Date(st.calMonth.getFullYear(), st.calMonth.getMonth() - 1, 1); drawCal(); };
    $('#calNext').onclick = () => { st.calMonth = new Date(st.calMonth.getFullYear(), st.calMonth.getMonth() + 1, 1); drawCal(); };
    $$('[data-step]', el).forEach(b => b.onclick = () => {
      st.travelers = Math.max(1, Math.min(12, st.travelers + Number(b.dataset.step)));
      $('#travOut').textContent = st.travelers; updatePlan();
    });
    bindSeg('#regionSeg', 'region');
    bindSeg('#styleSeg', 'style');
    drawCal();
    updatePlan();
    tickClock();
  }

  function bindSeg(sel, key, after) {
    const seg = $(sel);
    const sync = () => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st[key])));
    sync();
    seg.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      st[key] = b.dataset.v; sync();
      (after || updatePlan)();
    };
  }

  function drawCal() {
    const wrap = $('#calMonths'); if (!wrap) return;
    const months = [0, 1].map(i => new Date(st.calMonth.getFullYear(), st.calMonth.getMonth() + i, 1));
    wrap.innerHTML = months.map(m0 => {
      const first = m0.getDay();
      const dim = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
      let cells = DOW_S.map(d => `<div class="cal-dow">${d}</div>`).join('');
      for (let i = 0; i < first; i++) cells += '<div></div>';
      for (let day = 1; day <= dim; day++) {
        const d = new Date(m0.getFullYear(), m0.getMonth(), day);
        const key = iso(d);
        const cls = ['cal-day'];
        if (d.getDay() >= 5) cls.push('is-weekend');
        if (+d === +today) cls.push('is-today');
        if (+d === +st.start) cls.push('is-start');
        if (st.end && +d === +st.end) cls.push('is-end');
        if (st.end && d > st.start && d < st.end) cls.push('in-range');
        const hol = holidayMap[key];
        const label = `${fmtLong(d)}${hol ? ' — ' + hol : ''}`;
        cells += `<button type="button" class="${cls.join(' ')}" data-date="${key}" ${d < today ? 'disabled' : ''} aria-label="${label}" title="${hol || ''}">${day}${hol ? '<span class="hol"></span>' : ''}</button>`;
      }
      return `<div class="cal-month"><h4>${MONTHS[m0.getMonth()]} ${m0.getFullYear()}</h4><div class="cal-grid">${cells}</div></div>`;
    }).join('');
    $('#calHint').textContent = st.picking === 'end' ? 'עכשיו בחרו תאריך חזרה' : 'בחרו תאריך יציאה';

    wrap.onclick = (e) => {
      const b = e.target.closest('.cal-day'); if (!b || b.disabled) return;
      const d = parse(b.dataset.date);
      if (st.picking === 'end' && d > st.start) { st.end = d; st.picking = 'start'; }
      else { st.start = d; st.end = null; st.picking = 'end'; }
      drawCal(); updatePlan();
    };
    wrap.onmouseover = (e) => {
      if (st.picking !== 'end') return;
      const b = e.target.closest('.cal-day'); if (!b) return;
      const h = parse(b.dataset.date);
      $$('.cal-day', wrap).forEach(x => {
        const d = parse(x.dataset.date);
        x.classList.toggle('in-range', d > st.start && d < h);
      });
    };
  }

  function passHTML() {
    const n = nightsOf(st);
    const plane = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" transform="rotate(-90 12 12)"/></svg>';
    const hols = holidaysBetween(st.start, st.end || st.start);
    const work = workdaysBetween(st.start, st.end || st.start);
    return `
      <div class="pass">
        <div>
          <div class="lbl">יציאה</div>
          <div class="big num">${fmt(st.start)}</div>
          <div class="sub">יום ${DOW[st.start.getDay()]}</div>
        </div>
        <div class="mid">${plane}<span class="nights">${st.end ? n + ' לילות' : '—'}</span></div>
        <div style="text-align:left">
          <div class="lbl">חזרה עד</div>
          <div class="big num">${st.end ? fmt(st.end) : '?'}</div>
          <div class="sub">${st.end ? 'יום ' + DOW[st.end.getDay()] : 'בחרו ביומן'}</div>
        </div>
      </div>
      <div class="pass-meta" style="margin-top:10px">
        ${st.end ? `<span class="chip">${work} ימי עבודה (א׳–ה׳) לקחת חופש</span>` : ''}
        ${hols.map(h => `<span class="chip chip-amber">${esc(h.name)} · ${fmt(h.d)}</span>`).join('')}
        ${st.end && isPeak(st) ? '<span class="chip chip-warn">עונת שיא — מחירים גבוהים</span>' : ''}
        ${st.end ? `<span class="chip">${diffDays(today, st.start)} ימים עד היציאה</span>` : ''}
      </div>`;
  }

  function updatePlan() {
    savePlan();
    const pw = $('#passWrap'); if (pw) pw.innerHTML = passHTML();
    const res = $('#results'); if (!res) return;
    if (!st.end) {
      res.innerHTML = `<div class="empty panel"><strong>בחרו תאריך חזרה ביומן</strong><span>ברגע שיהיה טווח תאריכים, נדרג את היעדים ונציג קישורים להזמנה.</span></div>`;
      drawBoard([]);
      return;
    }
    const list = ranked(st, st.region);
    drawBoard(list.slice(0, 5));
    res.innerHTML = list.slice(0, 8).map((r, i) => resultCard(r, i)).join('');
    $$('[data-save]', res).forEach(b => b.onclick = () => saveTrip(b.dataset.save));
  }

  function resultCard({ d, e }, i) {
    const perP = e.est.total / st.travelers;
    const scoreCls = e.score >= 75 ? 'chip-good' : e.score >= 50 ? 'chip-warn' : 'chip-bad';
    const key = sitesFor(d).filter(s => ['skyscanner', 'booking', 'kayakcars'].includes(s.id) || (d.flightTime === 0 && s.id === 'airbnb'));
    return `
      <article class="result">
        <a class="result-poster" href="#dest-${d.id}" aria-label="${esc(d.name)}">${poster(d, 300, 300)}<span class="result-rank">#${i + 1}</span></a>
        <div class="result-body">
          <h3><a href="#dest-${d.id}" style="color:inherit;text-decoration:none">${esc(d.name)}</a><small>${esc(d.country)}</small></h3>
          <p class="fine">${esc(d.tagline)}</p>
          <div class="result-facts">
            <span class="chip ${scoreCls}">התאמה ${e.score}%</span>
            <span class="chip">${e.temp}° · ${weatherWord(e.temp)} ב${MONTHS[e.month]}</span>
            ${e.best ? '<span class="chip chip-good">עונה מומלצת</span>' : ''}
            ${d.flightTime ? `<span class="chip">${d.flightTime} ש׳ טיסה</span>` : '<span class="chip">נסיעה, בלי טיסה</span>'}
            ${e.tooShort ? '<span class="chip chip-bad">קצר מדי לטיסה ארוכה</span>' : ''}
          </div>
          <div class="result-links">
            ${key.map(s => ext(siteUrl(s.id, d, st), s.name, 'btn btn-sm')).join('')}
            <a class="btn btn-sm btn-ghost" href="#dest-${d.id}">כל המידע</a>
          </div>
        </div>
        <div class="result-price">
          <div>
            <div class="label">משוער לכל הקבוצה</div>
            <div class="amount">${money(e.est.total)}</div>
            <div class="per">${money(perP)} לאדם · ${e.est.nights} לילות</div>
          </div>
          <button class="btn btn-amber btn-sm" type="button" data-save="${d.id}">שמירה לחופשות שלי</button>
        </div>
      </article>`;
  }

  function drawBoard(rows) {
    const el = $('#boardRows'); if (!el) return;
    if (!rows.length) { el.innerHTML = `<div class="board-row"><span class="code">---</span><span class="city">בחרו תאריכים</span><span class="t">--:--</span><span class="st">WAIT</span></div>`; return; }
    el.innerHTML = rows.map(({ d, e }) => {
      const code = d.iata === 'TLV' ? 'CAR' : d.iata;
      const flaps = code.split('').map(c => `<span class="flap">${c}</span>`).join('');
      const t = d.flightTime ? `${Math.floor(d.flightTime)}h${d.flightTime % 1 ? '30' : '00'}` : 'ROAD';
      const status = e.best ? 'BEST' : e.score >= 60 ? 'GOOD' : 'OK';
      return `<a class="board-row" href="#dest-${d.id}" style="color:inherit;text-decoration:none">
        <span class="code">${flaps}</span><span class="city">${esc(d.name)} <span class="fine" style="color:#8C9AB0">${e.temp}°</span></span>
        <span class="t">${t}</span><span class="st">${status}</span></a>`;
    }).join('');
  }

  function tickClock() {
    const c = $('#clock'); if (!c) return;
    const now = new Date();
    c.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    clearTimeout(tickClock._t);
    tickClock._t = setTimeout(tickClock, 15000);
  }

  /* =========================================================
     יעדים
     ========================================================= */
  function renderExplore() {
    const el = $('#view-explore');
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${DESTS.length} יעדים</span>
            <h1 class="h-section">לאן בא לכם?</h1>
            <p class="lead">בכל יעד: טיסות וזמני שדה, מלונות, השכרת רכב, מסעדות כשרות ומישלן, תחבורה ציבורית, מסלולים, מפה וסרטונים.</p>
          </div>
        </div>
        <div class="filters">
          <div class="seg" id="exSeg">
            <button type="button" data-v="all">הכל</button>
            <button type="button" data-v="il">בארץ</button>
            <button type="button" data-v="abroad">בחו״ל</button>
            <button type="button" data-v="short">עד 4 ש׳ טיסה</button>
            <button type="button" data-v="kosher">הרבה אוכל כשר</button>
          </div>
          <label class="field" style="min-width:220px">
            <span class="sr">חיפוש יעד</span>
            <input class="input" id="exSearch" type="search" placeholder="חיפוש: פריז, יוון, ים…">
          </label>
        </div>
        <div class="dest-grid" id="destGrid"></div>
      </div>`;
    const draw = () => {
      const q = ($('#exSearch').value || '').trim().toLowerCase();
      const f = st.exploreFilter;
      const list = DESTS.filter(d => {
        if (f === 'il' && d.region !== 'il') return false;
        if (f === 'abroad' && d.region !== 'abroad') return false;
        if (f === 'short' && !(d.flightTime > 0 && d.flightTime <= 4)) return false;
        if (f === 'kosher' && !['paris', 'london', 'newyork', 'jerusalem', 'rome', 'telaviv', 'galilee', 'eilat', 'prague'].includes(d.id)) return false;
        if (!q) return true;
        return [d.name, d.nameEn, d.country, d.tagline, d.about].join(' ').toLowerCase().includes(q);
      });
      $('#destGrid').innerHTML = list.length ? list.map(destCard).join('') : `<div class="empty">לא נמצאו יעדים. נסו חיפוש אחר.</div>`;
    };
    bindSeg('#exSeg', 'exploreFilter', draw);
    $('#exSearch').oninput = draw;
    draw();
  }

  function destCard(d) {
    const e = evaluate(d, st.end ? st : { ...st, end: addDays(st.start, 4) });
    return `
      <a class="dest-card" href="#dest-${d.id}">
        <div class="dest-art">
          ${poster(d, 300, 340)}
          <div class="poster-title"><span class="name">${esc(d.name)}</span><span class="code">${d.iata === 'TLV' ? 'ISR' : d.iata}</span></div>
        </div>
        <div class="dest-info">
          <p>${esc(d.tagline)}</p>
          <div class="dest-meta">
            <span class="chip">${esc(d.country)}</span>
            ${d.flightTime ? `<span class="chip">${d.flightTime} ש׳ טיסה</span>` : '<span class="chip">ללא טיסה</span>'}
            <span class="chip">${e.temp}° ב${MONTHS_S[e.month]}</span>
            ${e.best ? '<span class="chip chip-good">עונה טובה</span>' : ''}
          </div>
        </div>
      </a>`;
  }

  /* =========================================================
     עמוד יעד
     ========================================================= */
  const TABS = [
    ['overview', 'סקירה'], ['flights', 'טיסה ושדה'], ['hotels', 'מלונות'], ['car', 'השכרת רכב'],
    ['food', 'מסעדות'], ['transit', 'תחבורה ועלויות'], ['routes', 'מסלולים'], ['map', 'מפה'], ['videos', 'סרטונים']
  ];

  function renderDest(id) {
    const d = byId[id];
    const el = $('#view-dest');
    if (!d) { location.hash = '#explore'; return; }
    if (!TABS.some(t => t[0] === st.tab)) st.tab = 'overview';
    el.innerHTML = `
      <div class="wrap">
        <div class="crumbs"><a href="#explore">יעדים</a><span>›</span><span>${esc(d.name)}</span></div>
        <div class="dest-hero">
          ${poster(d, 1200, 460)}
          <img class="photo" src="${esc(d.photo)}" alt="${esc(d.name)}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.remove()">
          <div class="dest-hero-body">
            <span class="eyebrow" style="color:#F4B942">${esc(d.country)} · ${esc(d.nameEn)}</span>
            <h1 class="h-display">${esc(d.name)}</h1>
            <p>${esc(d.about)}</p>
            <div class="result-links">
              <button class="btn btn-amber btn-sm" type="button" id="destSave">שמירה לחופשות שלי</button>
              <a class="btn btn-sm" href="#budget" id="destBudget">חישוב עלויות</a>
              ${d.flightTime ? '<a class="btn btn-sm" href="#airport" id="destAirport">מתי לצאת לשדה?</a>' : ''}
            </div>
          </div>
        </div>
        <div class="facts">
          ${fact('מטבע', `${d.currency.name} (${d.currency.code})${d.currency.rate !== 1 ? ` · ≈ ₪${d.currency.rate}` : ''}`)}
          ${fact('הפרש שעות', d.tzDiff === 0 ? 'כמו בישראל' : `${d.tzDiff > 0 ? '+' : ''}${d.tzDiff} שעות`)}
          ${fact('זמן טיסה', d.flightTime ? `כ-${d.flightTime} שעות` : 'אין טיסה')}
          ${fact('שפה', d.language)}
          ${fact('ויזה', d.visa)}
          ${fact('שקע חשמל', d.plug)}
          ${fact('חירום', d.emergency)}
          ${fact('נהיגה', 'בצד ' + d.drivingSide)}
        </div>
        <div class="tabs" role="tablist" id="destTabs">
          ${TABS.map(([k, v]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === st.tab}">${v}</button>`).join('')}
        </div>
        <div id="tabBody" role="tabpanel"></div>
      </div>`;
    $('#destSave').onclick = () => saveTrip(d.id);
    $('#destBudget').onclick = () => { budgetState.dest = d.id; budgetState.custom = null; };
    const ap = $('#destAirport'); if (ap) ap.onclick = () => { airState.dest = d.id; };
    $('#destTabs').onclick = (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      st.tab = b.dataset.tab;
      $$('[data-tab]', $('#destTabs')).forEach(x => x.setAttribute('aria-selected', String(x === b)));
      drawTab(d);
    };
    drawTab(d);
  }
  const fact = (k, v) => `<div class="fact"><span class="label">${k}</span><b>${esc(v)}</b></div>`;

  function drawTab(d) {
    const body = $('#tabBody');
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    const T = {
      overview: () => {
        const e = evaluate(d, s);
        const max = 45;
        const bars = d.climate.map((t, i) => {
          const best = d.bestMonths.includes(i + 1);
          const sel = i === e.month;
          return `<div style="display:grid;gap:4px;justify-items:center;align-content:end;height:150px">
              <span class="fine num" style="font-size:11.5px;${sel ? 'color:var(--ink);font-weight:700' : ''}">${t}°</span>
              <span style="width:100%;max-width:26px;height:${Math.max(4, (t / max) * 110)}px;border-radius:6px 6px 2px 2px;background:${sel ? 'var(--amber)' : best ? 'var(--teal)' : 'var(--line)'}"></span>
              <span class="fine" style="font-size:11px">${MONTHS_S[i]}</span></div>`;
        }).join('');
        return `
          <div class="grid-2">
            <div class="card">
              <h3>מזג אוויר לאורך השנה</h3>
              <p class="fine">טמפרטורת מקסימום ממוצעת. <span style="color:var(--teal);font-weight:600">טורקיז</span> = עונה מומלצת, <span style="color:var(--amber-ink);font-weight:600">ענבר</span> = החודש של התאריכים שבחרתם.</p>
              <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;align-items:end">${bars}</div>
            </div>
            <div class="card">
              <h3>בתאריכים שלכם</h3>
              <div class="pass-meta">
                <span class="chip ${e.score >= 75 ? 'chip-good' : e.score >= 50 ? 'chip-warn' : 'chip-bad'}">התאמה ${e.score}%</span>
                <span class="chip">${e.temp}° · ${weatherWord(e.temp)}</span>
                ${e.best ? '<span class="chip chip-good">עונה מומלצת</span>' : '<span class="chip">מחוץ לעונה המומלצת</span>'}
              </div>
              <ul class="list">
                <li><span class="t">תאריכים</span><span class="num">${fmt(s.start)} – ${fmt(s.end)} · ${nightsOf(s)} לילות</span></li>
                <li><span class="t">עלות משוערת</span><span class="num">${money(e.est.total)} ל-${s.travelers} מטיילים</span></li>
                <li><span class="t">טיפים</span><span>${esc(d.tipping)}</span></li>
                <li><span class="t">חודשים מומלצים</span><span>${d.bestMonths.map(m => MONTHS_S[m - 1]).join(', ')}</span></li>
              </ul>
              ${d.region === 'abroad' ? `<p class="warn-note">לפני נסיעה בדקו את ${ext('https://www.gov.il/he/departments/news/travel-warnings', 'אזהרות המסע של המטה לביטחון לאומי')} ואת תוקף הדרכון (6 חודשים לפחות).</p>` : ''}
            </div>
          </div>
          <div class="section-head mt"><h2 class="h-section" style="font-size:36px">הזמנה לתאריכים שבחרתם</h2><span class="fine">${fmt(s.start)} – ${fmt(s.end)} · ${s.travelers} מטיילים</span></div>
          ${siteLinks(d, s)}`;
      },
      flights: () => {
        const tr = DATA.origin.terminals[0];
        return `
          <div class="grid-2">
            <div class="card">
              <h3>יציאה מישראל</h3>
              <ul class="list">
                <li><span class="t">שדה יציאה</span><span>${d.id === 'eilat' ? 'נתב״ג טרמינל 1 / חיפה' : DATA.origin.airport}</span></li>
                <li><span class="t">להגיע לשדה</span><span>${d.id === 'eilat' ? 'כשעה וחצי לפני טיסת פנים' : `${tr.arrive / 60} שעות לפני טיסה בינלאומית (${tr.name})`}</span></li>
                <li><span class="t">סגירת צ׳ק-אין</span><span>${d.id === 'eilat' ? '30' : DATA.origin.checkinCloses} דק׳ לפני ההמראה</span></li>
                <li><span class="t">משך הטיסה</span><span>${d.flightTime ? `כ-${d.flightTime} שעות` : 'אין טיסה — נסיעה ברכב או ברכבת'}</span></li>
                <li><span class="t">הפרש שעות</span><span>${d.tzDiff === 0 ? 'ללא' : (d.tzDiff > 0 ? '+' : '') + d.tzDiff + ' שעות מישראל'}</span></li>
              </ul>
              <p class="fine">${DATA.origin.info}</p>
              ${d.flightTime ? `<a class="btn btn-primary" href="#airport" data-air="${d.id}">חישוב מדויק: מתי לצאת מהבית</a>` : ''}
            </div>
            <div class="card">
              <h3>נחיתה: ${esc(d.airport.name)} <span class="mono fine">${d.airport.code}</span></h3>
              <div class="table-wrap"><table class="tbl">
                <thead><tr><th>איך מגיעים לעיר</th><th>זמן</th><th>עלות</th></tr></thead>
                <tbody>${d.airport.toCity.map(o => `<tr><td>${esc(o.mode)}</td><td class="num">${esc(o.time)}</td><td class="num">${esc(o.cost)}</td></tr>`).join('')}</tbody>
              </table></div>
              <p class="note">${esc(d.airport.note)}</p>
            </div>
          </div>
          ${d.flightTime ? `<div class="section-head mt"><h2 class="h-section" style="font-size:36px">חיפוש טיסות לתאריכים שלכם</h2></div>${siteLinks(d, s, ['flight', 'package'])}` : ''}`;
      },
      hotels: () => `
        <div class="card">
          <div class="row"><h3>מלונות מומלצים ב${esc(d.name)}</h3><span class="fine">מחיר ללילה לחדר זוגי, משוער</span></div>
          <ul class="list">
            ${d.hotels.map(h => `<li>
              <div><div class="t">${esc(h.name)} <span class="tier ${h.tier === 'lux' ? 'tier-lux' : ''}">${{ lux: 'יוקרה', mid: 'בינוני', budget: 'חסכוני' }[h.tier]}</span></div>
                <div class="s">${esc(h.area)} · ${esc(h.note)}</div></div>
              <div class="actions"><span class="chip num">כ-${money(h.price)}</span>
                ${ext(`https://www.booking.com/searchresults.he.html?ss=${enc(h.name + ' ' + d.nameEn)}&checkin=${iso(s.start)}&checkout=${iso(s.end)}&group_adults=${s.travelers}`, 'בדיקת זמינות', 'btn btn-sm')}
                ${ext(gmaps(h.name + ' ' + d.nameEn), 'במפה', 'btn btn-sm btn-ghost')}</div>
            </li>`).join('')}
          </ul>
        </div>
        <div class="section-head mt"><h2 class="h-section" style="font-size:36px">עוד לינה בתאריכים שלכם</h2></div>
        ${siteLinks(d, s, ['hotel'])}`,
      car: () => `
        <div class="grid-2">
          <div class="card">
            <h3>צריך רכב?</h3>
            <p style="font-size:18px;font-weight:600">${esc(d.car.need)}</p>
            <ul class="list">
              <li><span class="t">מחיר משוער ליום</span><span class="num">${money(d.costs.car)}</span></li>
              <li><span class="t">נהיגה בצד</span><span>${esc(d.drivingSide)}</span></li>
              <li><span class="t">ל-${nightsOf(s) + 1} ימים</span><span class="num">כ-${money(d.costs.car * (nightsOf(s) + 1))}</span></li>
            </ul>
            <div class="pass-meta">${d.car.companies.map(c => ext(gmaps(c + ' car rental ' + d.airport.code + ' airport'), esc(c), 'chip')).join('')}</div>
          </div>
          <div class="card">
            <h3>טיפים לנהיגה ב${esc(d.name)}</h3>
            <ul class="route-stops">${d.car.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="section-head mt"><h2 class="h-section" style="font-size:36px">השוואת מחירי השכרה</h2></div>
        ${siteLinks(d, s, ['car'])}`,
      food: () => `
        <div class="grid-3">
          <div class="card">
            <div class="row"><h3>מסעדות כשרות</h3><span class="chip chip-good">כשר</span></div>
            <p class="fine">${esc(d.kosherNote)}</p>
            <ul class="list">${d.kosher.map(r => `<li><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.area)} · ${esc(r.note)}</div></div>${ext(gmaps(r.name + ' ' + d.nameEn), 'מפה', 'btn btn-sm btn-ghost')}</li>`).join('')}</ul>
            ${ext(gmaps('kosher restaurant ' + d.nameEn), 'כל המסעדות הכשרות במפה', 'btn btn-sm')}
          </div>
          <div class="card">
            <div class="row"><h3>${d.michelin.length ? 'מישלן' : 'מסעדות שף'}</h3>${d.michelin.length ? '<span class="stars" aria-label="כוכבי מישלן">✦✦✦</span>' : ''}</div>
            <p class="fine">${esc(d.michelinNote)}</p>
            <ul class="list">${(d.michelin.length ? d.michelin : d.food.slice(0, 2)).map(r => `<li><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.cuisine || r.type)} · ${esc(r.area)}</div></div>
              ${r.stars ? `<span class="stars" aria-label="${r.stars} כוכבים">${'✦'.repeat(r.stars)}</span>` : ''}</li>`).join('')}</ul>
            ${d.michelin.length ? ext('https://guide.michelin.com/', 'מדריך מישלן הרשמי', 'btn btn-sm') : ''}
          </div>
          <div class="card">
            <div class="row"><h3>אוכל מקומי מומלץ</h3><span class="chip">לא בהכרח כשר</span></div>
            <ul class="list">${d.food.map(r => `<li><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.type)} · ${esc(r.area)}</div></div><span class="chip">${esc(r.price)}</span></li>`).join('')}</ul>
            ${ext(`https://www.tripadvisor.com/Search?q=${enc('restaurants ' + d.nameEn)}`, 'עוד ב-Tripadvisor', 'btn btn-sm')}
          </div>
        </div>
        <p class="fine mt">סטטוס כשרות ודירוגי מישלן משתנים. בדקו תעודת כשרות בתוקף ואת המדריך העדכני לפני ביקור.</p>`,
      transit: () => {
        const days = nightsOf(s) + 1;
        return `
          <div class="grid-2">
            <div class="card">
              <h3>תחבורה ציבורית</h3>
              <ul class="list">
                <li><span class="t">מערכת</span><span>${esc(d.transit.system)}</span></li>
                <li><span class="t">כרטיס / תשלום</span><span>${esc(d.transit.card)}</span></li>
                <li><span class="t">נסיעה בודדת</span><span class="num">${esc(d.transit.single)}</span></li>
                <li><span class="t">כרטיס יומי</span><span class="num">${esc(d.transit.day)}</span></li>
                <li><span class="t">אפליקציות</span><span>${d.transit.apps.map(esc).join(' · ')}</span></li>
              </ul>
              <p class="note">${esc(d.transit.notes)}</p>
            </div>
            <div class="card">
              <h3>עלויות נסיעה משוערות</h3>
              <div class="table-wrap"><table class="tbl">
                <thead><tr><th>מה</th><th>לאדם</th><th>ל-${s.travelers} × ${days} ימים</th></tr></thead>
                <tbody>
                  <tr><td>תחבורה ציבורית ביום</td><td class="num">${money(d.costs.transport)}</td><td class="num">${money(d.costs.transport * s.travelers * days)}</td></tr>
                  <tr><td>השכרת רכב ביום (לרכב)</td><td class="num">—</td><td class="num">${money(d.costs.car * days)}</td></tr>
                </tbody>
              </table></div>
              <h3 style="margin-top:8px">מהשדה לעיר</h3>
              <div class="table-wrap"><table class="tbl">
                <tbody>${d.airport.toCity.map(o => `<tr><td>${esc(o.mode)}</td><td class="num">${esc(o.time)}</td><td class="num">${esc(o.cost)}</td></tr>`).join('')}</tbody>
              </table></div>
              <div class="result-links">${ext(gmaps('public transport ' + d.nameEn), 'תחנות במפה', 'btn btn-sm')}${ext('https://moovitapp.com/', 'Moovit', 'btn btn-sm btn-ghost')}</div>
            </div>
          </div>`;
      },
      routes: () => `
        <div class="grid-2">
          ${d.routes.map(r => `
            <div class="card route">
              <div class="row"><h3>${esc(r.name)}</h3><span class="chip chip-amber">${r.days} ${r.days === 1 ? 'יום' : 'ימים'}</span></div>
              <p class="fine">${esc(r.desc)}</p>
              <ol class="route-stops">${r.stops.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
              ${ext('https://www.google.com/maps/dir/' + r.stops.map(x => enc(x + ', ' + d.nameEn)).join('/'), 'פתיחת המסלול ב-Google Maps', 'btn btn-sm btn-primary')}
            </div>`).join('')}
        </div>`,
      map: () => `
        <div class="map-box" dir="ltr">
          <div id="leafMap" style="width:100%;height:100%"></div>
          <div class="map-fallback" id="mapFallback" hidden dir="rtl">
            <div style="display:grid;gap:10px;justify-items:center">
              <strong>המפה האינטראקטיבית לא נטענה בסביבה הזו</strong>
              <span class="fine">אפשר לפתוח כל נקודה ישירות ב-Google Maps:</span>
              <div class="pass-meta" style="justify-content:center">${d.pois.map(p => ext(`https://www.google.com/maps/search/?api=1&query=${p.c[0]},${p.c[1]}`, esc(p.name), 'chip')).join('')}</div>
            </div>
          </div>
        </div>
        <ul class="list mt">${d.pois.map((p, i) => `<li><span><span class="mono" style="color:var(--teal)">${pad(i + 1)}</span> <span class="t">${esc(p.name)}</span></span>${ext(`https://www.google.com/maps/search/?api=1&query=${p.c[0]},${p.c[1]}`, 'ניווט', 'btn btn-sm btn-ghost')}</li>`).join('')}</ul>`,
      videos: () => {
        const vids = [
          [`${d.nameEn} travel guide`, 'מדריך טיול', 'סקירה מלאה של היעד'],
          [`${d.nameEn} 4K walking tour`, 'סיור הליכה 4K', 'להרגיש את הרחובות לפני הטיסה'],
          [`${d.nameEn} food tour`, 'סיור אוכל', 'מה לאכול ואיפה'],
          [`טיול ל${d.name}`, 'ולוגים בעברית', 'המלצות של מטיילים ישראלים']
        ];
        return `
          <div class="grid-2">${vids.map(([q, t, sub]) => `
            <a class="video-card" href="${ytSearch(q)}" target="_blank" rel="noopener">
              ${poster(d, 480, 300)}
              <span class="play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span>
              <span class="cap"><b>${esc(t)} · ${esc(d.name)}</b><span>${esc(sub)} — נפתח ב-YouTube</span></span>
            </a>`).join('')}
          </div>`;
      }
    };
    body.innerHTML = T[st.tab]();
    $$('[data-air]', body).forEach(a => a.onclick = () => { airState.dest = a.dataset.air; });
    if (st.tab === 'map') initMap(d);
  }

  function siteLinks(d, s, kinds) {
    const list = sitesFor(d).filter(x => !kinds || kinds.includes(x.kind));
    return `<div class="site-links">${list.map(x => `
      <a class="site-link" href="${esc(siteUrl(x.id, d, s))}" target="_blank" rel="noopener">
        <span class="kind">${KIND[x.kind]}</span><b>${esc(x.name)}</b><span>${esc(x.desc)}</span>
      </a>`).join('')}</div>`;
  }

  let map = null;
  function initMap(d) {
    const fb = $('#mapFallback');
    if (!window.L) { fb.hidden = false; return; }
    if (map) { map.remove(); map = null; }
    map = L.map('leafMap', { scrollWheelZoom: false }).setView(d.coords, d.zoom);
    let ok = 0, bad = 0;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', () => { bad++; if (bad >= 4 && ok === 0) fb.hidden = false; });
    const pts = [];
    d.pois.forEach((p, i) => {
      const icon = L.divIcon({ className: '', html: `<div class="pin"><span>${i + 1}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
      L.marker(p.c, { icon }).addTo(map).bindPopup(`<b>${esc(p.name)}</b><br><a href="https://www.google.com/maps/search/?api=1&query=${p.c[0]},${p.c[1]}" target="_blank" rel="noopener">Google Maps</a>`);
      pts.push(p.c);
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    setTimeout(() => { if (ok === 0 && bad > 0) fb.hidden = false; }, 5000);
  }

  /* =========================================================
     זמני הגעה לשדה התעופה
     ========================================================= */
  const airState = { dest: 'paris', date: null, time: '10:30', city: 'תל אביב', mode: 'car', parking: false };

  function renderAirport() {
    const el = $('#view-airport');
    if (!airState.date) airState.date = iso(st.start);
    const flyable = DESTS.filter(d => d.flightTime > 0);
    if (!byId[airState.dest] || !byId[airState.dest].flightTime) airState.dest = 'paris';
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">נתב״ג · TLV</span>
            <h1 class="h-section">מתי לצאת מהבית?</h1>
            <p class="lead">הזינו את שעת הטיסה ומאיפה אתם יוצאים. נחשב מתי לצאת, מתי נסגר הצ׳ק-אין, מתי נוחתים בשעון המקומי ומתי תגיעו למלון.</p>
          </div>
        </div>
        <div class="airport-layout">
          <form class="panel" style="padding:20px;display:grid;gap:16px" id="airForm">
            <div class="form-grid">
              <div class="field"><label for="afDest">יעד</label>
                <select class="input" id="afDest">${flyable.map(d => `<option value="${d.id}" ${d.id === airState.dest ? 'selected' : ''}>${esc(d.name)} (${d.airport.code})</option>`).join('')}</select></div>
              <div class="field"><label for="afCity">יוצאים מ</label>
                <select class="input" id="afCity">${DATA.origin.cities.filter(c => c.name !== 'אילת').map(c => `<option ${c.name === airState.city ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
              <div class="field"><label for="afDate">תאריך הטיסה</label><input class="input" id="afDate" type="date" value="${airState.date}"></div>
              <div class="field"><label for="afTime">שעת המראה</label><input class="input" id="afTime" type="time" value="${airState.time}"></div>
            </div>
            <div class="field">
              <span class="label">איך מגיעים לשדה</span>
              <div class="seg" id="afMode">
                <button type="button" data-v="car">רכב פרטי</button>
                <button type="button" data-v="train">רכבת</button>
                <button type="button" data-v="taxi">מונית</button>
              </div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;font-size:15px">
              <input type="checkbox" id="afPark" ${airState.parking ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--teal)">
              חונים בחניון ארוך טווח (הסעה לטרמינל)
            </label>
            <div id="afCost"></div>
          </form>
          <div class="board" id="airBoard"></div>
        </div>
      </div>`;
    const upd = () => {
      airState.dest = $('#afDest').value; airState.city = $('#afCity').value;
      airState.date = $('#afDate').value || iso(st.start); airState.time = $('#afTime').value || '10:30';
      airState.parking = $('#afPark').checked;
      drawAirBoard();
    };
    ['#afDest', '#afCity', '#afDate', '#afTime', '#afPark'].forEach(s => $(s).addEventListener('change', upd));
    $('#afTime').addEventListener('input', upd);
    const seg = $('#afMode');
    const sync = () => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === airState.mode)));
    seg.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; airState.mode = b.dataset.v; sync(); drawAirBoard(); };
    $('#airForm').onsubmit = (e) => e.preventDefault();
    sync();
    drawAirBoard();
  }

  function drawAirBoard() {
    const d = byId[airState.dest];
    const city = DATA.origin.cities.find(c => c.name === airState.city) || DATA.origin.cities[0];
    const domestic = d.region === 'il';
    const [hh, mm] = airState.time.split(':').map(Number);
    const dep = hh * 60 + mm;
    const date = parse(airState.date);
    const notes = [];
    let mode = airState.mode;
    if (mode === 'train' && !city.train) { notes.push(`אין רכבת ישירה מ${city.name} לנתב״ג — חושב לפי רכב.`); mode = 'car'; }
    const travel = mode === 'car' ? city.car : mode === 'train' ? city.train + 15 : city.car;
    const arriveBefore = domestic ? 90 : DATA.origin.terminals[0].arrive;
    const checkin = domestic ? 30 : DATA.origin.checkinCloses;
    const traffic = (date.getDay() === 0 && dep < 12 * 60) || (date.getDay() === 4 && dep > 15 * 60) ? 20 : 0;
    const buffer = 20 + traffic + (airState.parking && mode === 'car' ? 25 : 0);
    const atAirport = dep - arriveBefore;
    const leave = atAirport - travel - buffer;
    const land = dep + d.flightTime * 60 + d.tzDiff * 60;
    const transfer = parseInt((d.airport.toCity[0].time.match(/\d+/) || [40])[0], 10) + 30;
    const leaveDate = addDays(date, Math.floor(leave / 1440));
    const landDay = Math.floor(land / 1440);

    if (traffic) notes.push('עומסי תנועה צפויים (יום ראשון בבוקר / חמישי אחה״צ) — הוספנו 20 דקות.');
    if (mode === 'train' && ((leaveDate.getDay() === 5 && leave % 1440 > 14 * 60) || leaveDate.getDay() === 6)) notes.push('רכבת ישראל אינה פועלת מיום שישי אחה״צ עד מוצאי שבת. תכננו מונית או רכב.');
    if (airState.parking && mode === 'car') notes.push('חניון ארוך טווח: הוספנו 25 דקות להסעה לטרמינל.');

    const rows = [
      { t: leave, k: false, b: 'יציאה מהבית', s: `${city.name} · ${mode === 'car' ? 'רכב' : mode === 'train' ? 'רכבת' : 'מונית'} · כ-${travel} דק׳ + ${buffer} דק׳ מרווח`, day: leaveDate },
      { t: atAirport, k: true, b: `הגעה ל${domestic ? 'טרמינל 1' : 'טרמינל 3'}`, s: `${arriveBefore / 60} שעות לפני ההמראה` },
      { t: dep - checkin, k: false, b: 'סגירת צ׳ק-אין ומסירת מזוודות', s: `${checkin} דק׳ לפני ההמראה` },
      { t: dep - DATA.origin.gateCloses, k: false, b: 'סגירת שער העלייה', s: `${DATA.origin.gateCloses} דק׳ לפני ההמראה` },
      { t: dep, k: true, b: `המראה ל${d.name}`, s: `טיסה של כ-${d.flightTime} שעות` },
      { t: land, k: true, b: `נחיתה ב${d.airport.name}`, s: `שעון מקומי${d.tzDiff ? ` (${d.tzDiff > 0 ? '+' : ''}${d.tzDiff} מישראל)` : ''}${landDay > 0 ? ` · +${landDay} ימים` : ''}` },
      { t: land + transfer, k: false, b: 'הגעה למלון (משוער)', s: `${d.airport.toCity[0].mode} + ביקורת גבולות ומזוודות` }
    ];
    $('#airBoard').innerHTML = `
      <div class="board-top">
        <span class="board-title">${fmt(date)} · TLV → ${d.airport.code}</span>
        <span class="board-clock">${esc(airState.time)}</span>
      </div>
      <div class="timeline">${rows.map(r => `
        <div class="tl-row ${r.k ? 'key' : ''}">
          <div class="tl-time">${hm(r.t)}</div>
          <div class="tl-what"><b>${esc(r.b)}</b><span>${esc(r.s)}${r.day && +r.day !== +date ? ` · ${fmtLong(r.day)}` : ''}</span></div>
        </div>`).join('')}
      </div>
      ${notes.length ? `<div class="board-note">${notes.map(esc).join('<br>')}</div>` : ''}
      <div class="board-note" style="background:transparent;color:#93A1B6;border-top-color:rgba(255,255,255,.06)">ההמלצות מבוססות על הנחיות רשות שדות התעופה. בדקו עדכונים ב-${DATA.origin.info.replace('מוקד מידע רשות שדות התעופה: ', '')} ובאתר חברת התעופה.</div>`;

    const taxiCost = city.taxi ? `מונית מ${city.name}: כ-${money(city.taxi)}` : '';
    $('#afCost').innerHTML = `<div class="note">${taxiCost}${taxiCost ? ' · ' : ''}חניון ארוך טווח בנתב״ג: כ-₪70–₪90 ליום · רכבת: כ-₪15–₪45 לכיוון.</div>`;
  }

  /* =========================================================
     מחשבון עלויות
     ========================================================= */
  const budgetState = { dest: 'paris', custom: null };
  const BLINES = [
    ['flight', 'טיסות', '#0F6E6C'], ['hotel', 'לינה', '#E9A23B'], ['car', 'השכרת רכב', '#5B7DB1'],
    ['food', 'אוכל ומסעדות', '#C8553D'], ['transport', 'תחבורה ציבורית ומוניות', '#8E6FB5'], ['fun', 'אטרקציות וכניסות', '#4E9F6A']
  ];

  function renderBudget() {
    const el = $('#view-budget');
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">תקציב</span>
            <h1 class="h-section">כמה החופשה תעלה?</h1>
            <p class="lead">הערכה לפי היעד, מספר הלילות, המטיילים וסגנון החופשה. אפשר לשנות כל שורה ידנית.</p>
          </div>
        </div>
        <div class="budget-layout">
          <div class="panel" style="padding:20px;display:grid;gap:18px">
            <div class="form-grid">
              <div class="field"><label for="bDest">יעד</label>
                <select class="input" id="bDest">${DESTS.map(d => `<option value="${d.id}" ${d.id === budgetState.dest ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
              <div class="field"><label for="bNights">לילות</label><input class="input" id="bNights" type="number" min="1" max="60" value="${nightsOf(s)}"></div>
              <div class="field"><label for="bTrav">מטיילים</label><input class="input" id="bTrav" type="number" min="1" max="12" value="${s.travelers}"></div>
              <div class="field"><span class="label">סגנון</span>
                <div class="seg" id="bStyle"><button type="button" data-v="budget">חסכוני</button><button type="button" data-v="mid">בינוני</button><button type="button" data-v="lux">יוקרה</button></div></div>
            </div>
            <div class="budget-lines" id="bLines"></div>
            <div class="result-links">
              <button class="btn" type="button" id="bReset">איפוס להערכה</button>
              <button class="btn btn-amber" type="button" id="bSave">שמירה לחופשות שלי</button>
            </div>
          </div>
          <div class="total-card" id="bTotal"></div>
        </div>
      </div>`;
    const calc = () => {
      const d = byId[$('#bDest').value];
      const nights = Math.max(1, +$('#bNights').value || 1);
      const trav = Math.max(1, +$('#bTrav').value || 1);
      const fake = { start: s.start, end: addDays(s.start, nights), travelers: trav, style: st.style };
      return { d, nights, trav, est: estimate(d, fake) };
    };
    const drawLines = () => {
      const { est } = calc();
      $('#bLines').innerHTML = BLINES.map(([k, label, c]) => `
        <div class="bline">
          <span class="sw" style="background:${c}"></span>
          <label for="bl-${k}">${label}<br><span class="hint">הערכה: ${money(est.lines[k])}</span></label>
          <input class="input" id="bl-${k}" type="number" min="0" step="50" value="${Math.round(budgetState.custom && budgetState.custom[k] != null ? budgetState.custom[k] : est.lines[k])}">
        </div>`).join('');
      $$('#bLines input').forEach(inp => inp.oninput = () => {
        budgetState.custom = budgetState.custom || {};
        budgetState.custom[inp.id.slice(3)] = +inp.value || 0;
        drawTotal();
      });
      drawTotal();
    };
    const drawTotal = () => {
      const { d, nights, trav } = calc();
      const vals = BLINES.map(([k]) => +$('#bl-' + k).value || 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const local = d.currency.rate !== 1 ? `${Math.round(total / d.currency.rate).toLocaleString('he-IL')} ${d.currency.code}` : '';
      $('#bTotal').innerHTML = `
        <div class="row" style="display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap">
          <div><span class="label">סה״כ משוער · ${esc(d.name)}</span><div class="total-amount">${money(total)}</div>
          ${local ? `<span class="fine" style="color:#93A1B6">≈ ${local} · שער ${d.currency.rate}</span>` : ''}</div>
          <span class="chip chip-amber">${nights} לילות · ${trav} מטיילים</span>
        </div>
        <div class="stack" role="img" aria-label="חלוקת התקציב">${BLINES.map(([k, , c], i) => vals[i] ? `<span style="width:${(vals[i] / total) * 100}%;background:${c}"></span>` : '').join('')}</div>
        <div class="legend">${BLINES.map(([k, l, c], i) => `<div><span><i style="background:${c}"></i>${l}</span><span class="v">${total ? Math.round(vals[i] / total * 100) : 0}%</span></div>`).join('')}</div>
        <div class="split">
          <div><b>${money(total / trav)}</b><span>לאדם</span></div>
          <div><b>${money(total / (nights + 1))}</b><span>ליום</span></div>
          <div><b>${money(total / trav / (nights + 1))}</b><span>לאדם ליום</span></div>
        </div>
        <p class="fine" style="color:#8C9AB0">הערכה בלבד. מחירי טיסות ומלונות משתנים לפי מועד ההזמנה, עונה וזמינות.</p>`;
      budgetState._total = total;
    };
    bindSeg('#bStyle', 'style', () => { budgetState.custom = null; drawLines(); });
    ['#bDest', '#bNights', '#bTrav'].forEach(x => $(x).addEventListener('input', () => { budgetState.custom = null; budgetState.dest = $('#bDest').value; drawLines(); }));
    $('#bReset').onclick = () => { budgetState.custom = null; drawLines(); toast('התקציב אופס להערכה'); };
    $('#bSave').onclick = () => {
      const { d, nights, trav } = calc();
      saveTrip(d.id, { end: addDays(s.start, nights), travelers: trav, budget: budgetState._total });
    };
    drawLines();
  }

  /* =========================================================
     החופשות שלי
     ========================================================= */
  function checklistFor(d) {
    const items = ['הזמנת טיסה', 'הזמנת מלון', 'ביטוח נסיעות', 'צ׳ק-אין אונליין', 'אישור יציאה מהעבודה'];
    if (d.region === 'abroad') {
      items.unshift('דרכון בתוקף 6 חודשים לפחות');
      if (/ESTA/.test(d.visa)) items.push('אישור ESTA');
      if (/ETA/.test(d.visa) && !/ESTA/.test(d.visa)) items.push('אישור ETA');
      items.push(`מתאם חשמל (${d.plug})`, 'eSIM / חבילת גלישה', `מזומן ב${d.currency.name}`);
      if (/בינלאומי/.test(d.car.tips.join(' '))) items.push('רישיון נהיגה בינלאומי');
    }
    if (/חיוני|מומלץ|כן/.test(d.car.need)) items.push('השכרת רכב');
    if (d.kosher.length) items.push('שמירת מסעדות כשרות');
    return items.map(t => ({ t, done: false }));
  }

  function saveTrip(destId, extra) {
    const d = byId[destId];
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    const trips = store.get('trips', []);
    const e = estimate(d, { ...s, ...(extra || {}) });
    trips.unshift({
      id: Date.now().toString(36),
      dest: destId,
      start: iso(s.start),
      end: iso((extra && extra.end) || s.end),
      travelers: (extra && extra.travelers) || s.travelers,
      style: s.style,
      budget: Math.round((extra && extra.budget) || e.total),
      checklist: checklistFor(d),
      notes: ''
    });
    store.set('trips', trips);
    toast(`נשמר: ${d.name} · ${fmt(s.start)}–${fmt((extra && extra.end) || s.end)}`);
  }

  function sampleTrip() {
    const d = byId.athens;
    const start = addDays(today, 24), end = addDays(start, 5);
    const cl = checklistFor(d);
    cl.slice(0, 3).forEach(x => { x.done = true; });
    return { id: 'sample', sample: true, dest: 'athens', start: iso(start), end: iso(end), travelers: 2, style: 'mid', budget: Math.round(estimate(d, { start, end, travelers: 2, style: 'mid' }).total), checklist: cl, notes: 'מעבורת להידרה ביום השלישי' };
  }

  function renderTrips() {
    const el = $('#view-trips');
    let trips = store.get('trips', []);
    const showingSample = !trips.length;
    if (showingSample) trips = [sampleTrip()];
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">ניהול</span>
            <h1 class="h-section">החופשות שלי</h1>
            <p class="lead">כל חופשה שמרתם עם ספירה לאחור, תקציב, רשימת משימות והערות. החופשות נשמרות בדפדפן במכשיר הזה.</p>
          </div>
          <a class="btn btn-primary" href="#home">תכנון חופשה חדשה</a>
        </div>
        ${showingSample ? '<p class="note" style="margin-bottom:16px">זו חופשה לדוגמה כדי להראות איך זה נראה. שמרו יעד מדף הבית או מעמוד יעד והיא תופיע כאן.</p>' : ''}
        <div class="stack-v" id="tripList">${trips.map(tripCard).join('')}</div>
      </div>`;

    const list = $('#tripList');
    const find = (id) => trips.find(t => t.id === id);
    const persist = () => { if (!showingSample) store.set('trips', trips); };
    list.onchange = (e) => {
      const card = e.target.closest('[data-trip]'); if (!card) return;
      const t = find(card.dataset.trip);
      if (e.target.matches('input[type=checkbox]')) {
        t.checklist[+e.target.dataset.i].done = e.target.checked;
        const done = t.checklist.filter(x => x.done).length;
        $('.progress span', card).style.width = (done / t.checklist.length * 100) + '%';
        $('.prog-txt', card).textContent = `${done}/${t.checklist.length} משימות`;
      }
      if (e.target.matches('textarea')) t.notes = e.target.value;
      persist();
    };
    list.onclick = (e) => {
      const card = e.target.closest('[data-trip]'); if (!card) return;
      const t = find(card.dataset.trip);
      if (e.target.matches('[data-del]')) { $('.confirm-slot', card).innerHTML = `<div class="confirm-bar"><span>למחוק את החופשה ל${esc(byId[t.dest].name)}?</span><button type="button" class="btn btn-sm btn-danger" data-del-yes>מחיקה</button><button type="button" class="btn btn-sm" data-del-no>ביטול</button></div>`; }
      if (e.target.matches('[data-del-no]')) $('.confirm-slot', card).innerHTML = '';
      if (e.target.matches('[data-del-yes]')) {
        if (showingSample) { toast('זו חופשה לדוגמה'); $('.confirm-slot', card).innerHTML = ''; return; }
        trips = trips.filter(x => x.id !== t.id); store.set('trips', trips); renderTrips(); toast('החופשה נמחקה');
      }
      if (e.target.matches('[data-add]')) {
        const inp = $('input[data-new]', card); const v = inp.value.trim(); if (!v) return;
        t.checklist.push({ t: v, done: false }); persist();
        card.outerHTML = tripCard(t);
      }
    };
  }

  function tripCard(t) {
    const d = byId[t.dest];
    const s = parse(t.start), e = parse(t.end);
    const until = diffDays(today, s);
    const done = t.checklist.filter(x => x.done).length;
    const cd = until > 0 ? `עוד ${until} ימים` : until === 0 ? 'היום!' : diffDays(today, e) >= 0 ? 'בחופשה' : 'הסתיימה';
    return `
      <article class="trip" data-trip="${esc(t.id)}">
        <a class="trip-art" href="#dest-${d.id}" aria-label="${esc(d.name)}">${poster(d, 240, 320)}</a>
        <div class="trip-body">
          <div class="trip-top">
            <div>
              <h3>${esc(d.name)} ${t.sample ? '<span class="sample-flag">דוגמה</span>' : ''}</h3>
              <span class="fine num">${fmtLong(s)} – ${fmtLong(e)} · ${diffDays(s, e)} לילות · ${t.travelers} מטיילים</span>
            </div>
            <span class="countdown">${cd}</span>
          </div>
          <div class="pass-meta">
            <span class="chip chip-amber num">תקציב ${money(t.budget)}</span>
            <span class="chip">${d.flightTime ? d.flightTime + ' ש׳ טיסה' : 'ללא טיסה'}</span>
            <span class="chip">${esc(d.currency.name)}</span>
          </div>
          <div style="display:grid;gap:6px">
            <div class="row" style="display:flex;justify-content:space-between"><span class="label">הכנות לחופשה</span><span class="fine prog-txt">${done}/${t.checklist.length} משימות</span></div>
            <div class="progress"><span style="width:${done / t.checklist.length * 100}%"></span></div>
          </div>
          <ul class="checklist">${t.checklist.map((c, i) => `<li><label><input type="checkbox" data-i="${i}" ${c.done ? 'checked' : ''}><span>${esc(c.t)}</span></label></li>`).join('')}</ul>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="sr" for="new-${esc(t.id)}">משימה חדשה</label>
            <input class="input" id="new-${esc(t.id)}" data-new placeholder="הוספת משימה…" style="flex:1;min-width:160px">
            <button type="button" class="btn" data-add>הוספה</button>
          </div>
          <div class="field">
            <label for="notes-${esc(t.id)}">הערות</label>
            <textarea class="input" id="notes-${esc(t.id)}" rows="2">${esc(t.notes)}</textarea>
          </div>
          <div class="trip-actions">
            <a class="btn btn-primary btn-sm" href="#dest-${d.id}">פרטי היעד</a>
            ${ext(gcal(d, { start: s, end: e }), 'הוספה ליומן Google', 'btn btn-sm')}
            ${d.flightTime ? ext(siteUrl('skyscanner', d, { start: s, end: e, travelers: t.travelers }), 'טיסות', 'btn btn-sm') : ''}
            ${ext(siteUrl('booking', d, { start: s, end: e, travelers: t.travelers }), 'מלונות', 'btn btn-sm')}
            <button type="button" class="btn btn-sm btn-ghost btn-danger" data-del>מחיקה</button>
          </div>
          <div class="confirm-slot"></div>
        </div>
      </article>`;
  }

  /* =========================================================
     עזרה ותמיכה
     ========================================================= */
  const FAQ = [
    ['איך בוחרים תאריכים?', 'בדף הבית לחצו על יום היציאה ביומן ואחר כך על יום החזרה. הימים שבאמצע נצבעים, ומעל היומן מופיע כרטיס עם מספר הלילות, ימי העבודה שצריך לקחת חופש, וחגים שנופלים בתקופה.'],
    ['איך מחושבת ההתאמה של יעד?', 'לפי מזג האוויר הממוצע בחודש הנסיעה, האם זו העונה המומלצת ליעד, ואורך החופשה ביחס לזמן הטיסה. טיסה של 11 שעות ל-3 לילות מקבלת ציון נמוך.'],
    ['האם המחירים מדויקים?', 'לא. אלה הערכות לפי מחירים ממוצעים, עונה וסגנון חופשה. המחיר האמיתי מופיע באתרי ההזמנה — לחצו על Skyscanner, Booking וכו׳ והתאריכים שבחרתם כבר ימולאו שם.'],
    ['איך מזמינים?', 'מסע לא מוכר כרטיסים. כל כפתור הזמנה פותח את האתר של הספק (Skyscanner, Booking, Airbnb, Kayak ועוד) עם היעד והתאריכים שלכם, ושם משלמים.'],
    ['מתי צריך להגיע לנתב״ג?', 'בדרך כלל 3 שעות לפני טיסה בינלאומית. בעמוד "זמני שדה תעופה" מזינים שעת טיסה ועיר יציאה ומקבלים לוח זמנים מלא עד ההגעה למלון.'],
    ['איפה נשמרות החופשות שלי?', 'בדפדפן במכשיר שלכם בלבד. הן לא נשלחות לשום שרת. אם תנקו את נתוני הדפדפן או תעברו מכשיר, הן לא יופיעו.'],
    ['איך יודעים אם מסעדה כשרה?', 'בכל יעד בלשונית "מסעדות" יש רשימת מקומות ואזורים עם אוכל כשר, וקישור למפה. סטטוס כשרות משתנה — תמיד בדקו תעודה בתוקף במקום, או פנו לבית חב״ד המקומי.'],
    ['איך מוסיפים יעד חדש לאתר?', 'כל היעדים נמצאים בקובץ js/data.js. מעתיקים יעד קיים, משנים את הפרטים ושומרים — היעד יופיע אוטומטית בכל המקומות באתר.']
  ];

  function renderHelp() {
    const el = $('#view-help');
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">תמיכה</span>
            <h1 class="h-section">עזרה ותמיכה</h1>
            <p class="lead">מדריך מהיר, שאלות נפוצות, מספרי חירום ועוזר שעונה על שאלות. אפשר לפתוח את העוזר מכל עמוד בכפתור "צריכים עזרה?".</p>
          </div>
          <button class="btn btn-amber" type="button" id="openChat">פתיחת העוזר</button>
        </div>

        <div class="steps">
          <div class="card step"><h3>מסמנים תאריכים</h3><p class="fine">בוחרים יום יציאה ויום חזרה ביומן בדף הבית.</p></div>
          <div class="card step"><h3>בוחרים יעד</h3><p class="fine">היעדים מדורגים לפי מזג אוויר, עונה ואורך החופשה.</p></div>
          <div class="card step"><h3>בודקים הכל</h3><p class="fine">טיסה, שדה, מלון, רכב, מסעדות, תחבורה, מסלולים ומפה.</p></div>
          <div class="card step"><h3>שומרים ומזמינים</h3><p class="fine">שומרים ב"החופשות שלי" ומזמינים באתרי הספקים.</p></div>
        </div>

        <div class="grid-2 mt">
          <div>
            <h2 class="h-section" style="font-size:36px;margin-bottom:14px">שאלות נפוצות</h2>
            <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
          </div>
          <div class="stack-v">
            <div class="card">
              <h3>מספרים חשובים</h3>
              ${[
                ['חדר המצב של משרד החוץ (24/7)', '+972-2-5303155'],
                ['רשות שדות התעופה — מידע טיסות', '*6663'],
                ['מד״א (בישראל)', '101'],
                ['חירום באירופה', '112'],
                ['חירום בארה״ב', '911']
              ].map(([k, v]) => `<div class="copy-row"><span>${k}</span><span style="display:flex;gap:8px;align-items:center"><span class="mono">${v}</span><button type="button" class="btn btn-sm" data-copy="${v}">העתקה</button></span></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:0">')}
            </div>
            <div class="card">
              <h3>קישורים שימושיים</h3>
              <div class="pass-meta">
                ${ext('https://www.gov.il/he/departments/news/travel-warnings', 'אזהרות מסע', 'chip')}
                ${ext('https://www.iaa.gov.il/', 'רשות שדות התעופה', 'chip')}
                ${ext('https://esta.cbp.dhs.gov/', 'ESTA לארה״ב', 'chip')}
                ${ext('https://www.gov.uk/eta', 'ETA לבריטניה', 'chip')}
                ${ext('https://travel-europe.europa.eu/etias_en', 'ETIAS לאירופה', 'chip')}
                ${ext('https://www.gov.il/he/service/passport_renewal', 'חידוש דרכון', 'chip')}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    $('#openChat').onclick = () => openChat(true);
    $$('[data-copy]', el).forEach(b => b.onclick = () => {
      const v = b.dataset.copy;
      const done = () => toast('הועתק: ' + v);
      try {
        navigator.clipboard.writeText(v).then(done, () => { selectText(b.previousElementSibling); toast('סמנו והעתיקו ידנית'); });
      } catch (e) { selectText(b.previousElementSibling); }
    });
  }
  function selectText(node) {
    try { const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* */ }
  }

  /* =========================================================
     עוזר צ׳אט
     ========================================================= */
  const ALIASES = { newyork: ['ניו יורק', 'ניויורק', 'ארה"ב', 'ארהב', 'אמריקה', 'new york', 'nyc'], bangkok: ['בנגקוק', 'תאילנד', 'thailand'], athens: ['אתונה', 'יוון', 'greece', 'איים'], tokyo: ['טוקיו', 'יפן', 'japan'], galilee: ['גליל', 'גולן', 'צפון', 'כנרת'], telaviv: ['תל אביב', 'ת"א', 'תא'], london: ['לונדון', 'אנגליה', 'בריטניה'], paris: ['פריז', 'צרפת'], rome: ['רומא', 'איטליה'], barcelona: ['ברצלונה', 'ספרד'], prague: ['פראג', 'צ׳כיה', 'צכיה'], dubai: ['דובאי', 'אמירויות'], eilat: ['אילת'], jerusalem: ['ירושלים'] };
  function findDest(q) {
    const low = q.toLowerCase();
    for (const d of DESTS) {
      const names = [d.name, d.nameEn.toLowerCase(), d.country].concat(ALIASES[d.id] || []);
      if (names.some(n => n && low.includes(n.toLowerCase()))) return d;
    }
    return null;
  }
  function answer(q) {
    const d = findDest(q);
    const has = (...w) => w.some(x => q.includes(x));
    const need = (what) => `על איזה יעד? לדוגמה: "${what} בפריז". היעדים: ${DESTS.map(x => x.name).join(', ')}.`;
    if (has('כשר')) {
      if (!d) return need('מסעדות כשרות');
      return `<b>אוכל כשר ב${esc(d.name)}</b><br>${esc(d.kosherNote)}<br>${d.kosher.map(r => `• ${esc(r.name)} — ${esc(r.area)}`).join('<br>')}<br><a href="#dest-${d.id}.food">לכל המסעדות</a>`;
    }
    if (has('מישלן', 'כוכב', 'שף')) {
      if (!d) return need('מסעדות מישלן');
      if (!d.michelin.length) return `${esc(d.michelinNote)}<br>${d.food.map(r => `• ${esc(r.name)} — ${esc(r.type)}`).join('<br>')}`;
      return `<b>מישלן ב${esc(d.name)}</b><br>${d.michelin.map(r => `• ${esc(r.name)} — ${'✦'.repeat(r.stars)} ${esc(r.cuisine)}`).join('<br>')}<br><a href="#dest-${d.id}.food">פרטים</a>`;
    }
    if (has('מלון', 'לינה', 'לישון', 'צימר')) {
      if (!d) return need('מלונות');
      return `<b>מלונות ב${esc(d.name)}</b><br>${d.hotels.map(h => `• ${esc(h.name)} (${esc(h.area)}) כ-${money(h.price)} ללילה`).join('<br>')}<br><a href="#dest-${d.id}.hotels">בדיקת זמינות לתאריכים</a>`;
    }
    if (has('רכב', 'השכר', 'לנהוג', 'נהיגה')) {
      if (!d) return need('השכרת רכב');
      return `<b>רכב ב${esc(d.name)}:</b> ${esc(d.car.need)}. נהיגה בצד ${esc(d.drivingSide)}, כ-${money(d.costs.car)} ליום.<br>${d.car.tips.map(t => '• ' + esc(t)).join('<br>')}<br><a href="#dest-${d.id}.car">השוואת מחירים</a>`;
    }
    if (has('תחבורה', 'מטרו', 'אוטובוס', 'רכבת', 'תחתית')) {
      if (!d) return need('תחבורה ציבורית');
      return `<b>תחבורה ב${esc(d.name)}:</b> ${esc(d.transit.system)}.<br>כרטיס: ${esc(d.transit.card)} · נסיעה: ${esc(d.transit.single)} · יומי: ${esc(d.transit.day)}<br><a href="#dest-${d.id}.transit">עוד פרטים ועלויות</a>`;
    }
    if (has('שדה', 'נתב', 'להגיע', 'צ׳ק', "צ'ק", 'המראה', 'טיסה', 'לטוס')) {
      if (d && d.flightTime) return `<b>טיסה ל${esc(d.name)}:</b> כ-${d.flightTime} שעות, הפרש שעות ${d.tzDiff}. מומלץ להגיע לנתב״ג 3 שעות לפני. בנחיתה: ${esc(d.airport.toCity[0].mode)} (${esc(d.airport.toCity[0].time)}, ${esc(d.airport.toCity[0].cost)}).<br><a href="#airport">חישוב מתי לצאת מהבית</a>`;
      return 'לטיסות בינלאומיות מומלץ להגיע לנתב״ג 3 שעות לפני ההמראה. הצ׳ק-אין נסגר שעה לפני. <a href="#airport">חשבו כאן מתי לצאת מהבית</a> לפי עיר ושעת טיסה.';
    }
    if (has('ויזה', 'דרכון', 'esta', 'ESTA', 'אשרה')) {
      if (!d) return 'לרוב מדינות אירופה אין צורך בוויזה. לארה״ב צריך ESTA, לבריטניה ETA. שאלו למשל "ויזה ליפן".';
      return `<b>כניסה ל${esc(d.country)}:</b> ${esc(d.visa)}`;
    }
    if (has('מזג', 'אוויר', 'חם', 'קר', 'עונה', 'מתי')) {
      if (!d) return need('מזג אוויר');
      return `<b>${esc(d.name)}:</b> החודשים המומלצים — ${d.bestMonths.map(m => MONTHS[m - 1]).join(', ')}. בחודש שבחרתם כ-${d.climate[st.start.getMonth()]}°.`;
    }
    if (has('מחיר', 'עול', 'תקציב', 'כמה')) {
      if (!d) return 'במחשבון העלויות אפשר לבחור יעד, לילות ומטיילים. <a href="#budget">פתיחת המחשבון</a>';
      const e = estimate(d, st.end ? st : { ...st, end: addDays(st.start, 4) });
      budgetState.dest = d.id; budgetState.custom = null;
      return `הערכה ל${esc(d.name)}: <b>${money(e.total)}</b> ל-${st.travelers} מטיילים, ${e.nights} לילות. <a href="#budget">פירוט ועריכה</a>`;
    }
    if (has('מסלול', 'טיול', 'לראות', 'אטרקצי')) {
      if (!d) return need('מסלולים');
      return d.routes.map(r => `<b>${esc(r.name)}</b> (${r.days} ימים): ${r.stops.map(esc).join(' ← ')}`).join('<br>') + `<br><a href="#dest-${d.id}.routes">למסלולים</a>`;
    }
    if (has('מפה')) return d ? `<a href="#dest-${d.id}.map">המפה של ${esc(d.name)}</a>` : need('מפה');
    if (has('סרטון', 'וידאו', 'יוטיוב')) return d ? `<a href="#dest-${d.id}.videos">סרטונים על ${esc(d.name)}</a>` : need('סרטונים');
    if (has('לאן', 'המלצ', 'כדאי', 'יעד')) {
      if (!st.end) return 'סמנו קודם תאריך יציאה וחזרה ביומן ב<a href="#home">דף הבית</a>.';
      const top = ranked(st, st.region).slice(0, 3);
      return `לתאריכים ${fmt(st.start)}–${fmt(st.end)} הכי מתאימים:<br>${top.map(({ d: x, e }) => `• <a href="#dest-${x.id}">${esc(x.name)}</a> — ${e.temp}°, התאמה ${e.score}%`).join('<br>')}`;
    }
    if (has('איך', 'עזרה', 'להשתמש', 'שומר', 'שמיר')) return 'מסמנים תאריכים בדף הבית, בוחרים יעד מהרשימה, ובעמוד היעד יש לשוניות לכל נושא. "שמירה לחופשות שלי" מוסיפה את החופשה לרשימה עם משימות. <a href="#help">מדריך מלא</a>';
    if (d) return `<b>${esc(d.name)}</b> — ${esc(d.tagline)}. טיסה: ${d.flightTime ? d.flightTime + ' ש׳' : 'אין'}, מטבע: ${esc(d.currency.name)}.<br><a href="#dest-${d.id}">לעמוד היעד</a>`;
    return 'לא הבנתי עד הסוף. אפשר לשאול על יעד, מלונות, רכב, מסעדות כשרות, מישלן, תחבורה, מזג אוויר, תקציב או זמני הגעה לשדה. נסו אחת מההצעות למטה.';
  }

  const CHIPS = ['לאן כדאי לטוס בתאריכים שלי?', 'מסעדות כשרות ברומא', 'מתי לצאת לנתב״ג?', 'תחבורה בלונדון', 'מישלן בפריז', 'ויזה לארה״ב'];
  function botSay(html, who) {
    const log = $('#chatLog');
    const m = document.createElement('div');
    m.className = 'msg ' + (who || 'bot');
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
  }
  function openChat(open) {
    const c = $('#chat'), fab = $('#helpFab');
    c.hidden = !open; fab.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!$('#chatLog').children.length) botSay('שלום! אני העוזר של מסע. אפשר לשאול אותי על כל יעד — מלונות, כשרות, מישלן, תחבורה, מזג אוויר, תקציב וזמני שדה תעופה.');
      $('#chatInput').focus();
    }
  }
  function initChat() {
    $('#helpFab').onclick = () => openChat($('#chat').hidden);
    $('#chatClose').onclick = () => openChat(false);
    $('#chatChips').innerHTML = CHIPS.map(c => `<button type="button">${esc(c)}</button>`).join('');
    $('#chatChips').onclick = (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); };
    $('#chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('#chatInput').value.trim(); if (v) { ask(v); $('#chatInput').value = ''; } };
    $('#chatLog').onclick = (e) => { if (e.target.closest('a[href^="#"]') && window.innerWidth < 700) openChat(false); };
  }
  function ask(q) { botSay(esc(q), 'me'); setTimeout(() => botSay(answer(q)), 250); }

  /* ---------- ערכת צבעים ---------- */
  function initTheme() {
    const t = store.get('theme', null);
    if (t) document.documentElement.setAttribute('data-theme', t);
    $('#themeBtn').onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('theme', next);
    };
  }

  /* ---------- הפעלה ---------- */
  initTheme();
  initChat();
  route();
})();
