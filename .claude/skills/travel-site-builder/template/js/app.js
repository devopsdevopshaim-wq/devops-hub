/* ===========================================================
   מסע — לוגיקת האפליקציה
   ללא תלויות (מלבד Leaflet למפות). עובד גם בפתיחה ישירה של index.html.
   =========================================================== */
(function () {
  'use strict';

  const DATA = window.APP_DATA;
  const DESTS = DATA.destinations;
  const byId = Object.fromEntries(DESTS.map(d => [d.id, d]));
  const CFG = window.APP_CONFIG || { agency: {}, partners: {} };
  const AG = CFG.agency || {}, PT = CFG.partners || {};
  const BRAND = (CFG.brand && CFG.brand.name) || 'מסע';
  /* n8n: window.APP_N8N מוזרק כשהאתר מוגש מתוך n8n; אחרת מ-config.js */
  const N8N = Object.assign({ base: '', deal: 'masa-deal', chat: 'masa-chat' }, CFG.n8n || {}, window.APP_N8N || {});
  const n8nUrl = (hook) => N8N.base ? N8N.base.replace(/\/$/, '') + '/' + hook : '';
  /* text/plain = בקשה "פשוטה" בלי preflight של CORS; n8n מפענח את ה-JSON */
  function n8nPost(hook, payload, timeoutMs) {
    const url = n8nUrl(hook);
    if (!url || !window.fetch) return Promise.reject(new Error('n8n not configured'));
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), timeoutMs || 30000);
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .finally(() => t && clearTimeout(t));
  }
  const MONEY = window.APP_MONEY || { currencies: {}, byDest: {} };
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

  const sessionId = (() => { let v = store.get('session', null); if (!v) { v = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); store.set('session', v); } return v; })();

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
    tab: 'overview',
    types: [],        // סוגי חופשה שנבחרו (family, couple, …)
    kids: 0,          // מתוך המטיילים — כמה ילדים
    stay: 'all',      // סינון סוג לינה בלשונית המלונות ובדיל
    funTag: 'all'     // סינון בלשונית הבילוי
  };
  if (saved && saved.start && parse(saved.start) >= today) {
    st.start = parse(saved.start);
    st.end = saved.end ? parse(saved.end) : null;
    st.travelers = saved.travelers || 2;
    st.region = saved.region || 'all';
    st.style = saved.style || 'mid';
    st.types = Array.isArray(saved.types) ? saved.types : [];
    st.kids = Math.min(saved.kids || 0, st.travelers - 1);
  }
  st.calMonth = new Date(st.start.getFullYear(), st.start.getMonth(), 1);
  const savePlan = () => store.set('plan', { start: iso(st.start), end: st.end ? iso(st.end) : null, travelers: st.travelers, region: st.region, style: st.style, types: st.types, kids: st.kids });

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

  /* ---------- סוגי חופשה, סוגי לינה ותגיות ---------- */
  const TRIP_TYPES = [
    ['family', 'משפחות עם ילדים'], ['couple', 'זוגות ורומנטיקה'], ['nature', 'טבע וטיולים'],
    ['relax', 'ספא ובטן-גב'], ['culture', 'תרבות והיסטוריה'], ['night', 'בילויים וחיי לילה'],
    ['food', 'קולינריה'], ['adventure', 'אקסטרים והרפתקאות'], ['religious', 'שומרי שבת וכשרות']
  ];
  const TYPE_LABEL = Object.fromEntries(TRIP_TYPES);
  const STAY_KIND = { hotel: 'מלון', boutique: 'בוטיק', resort: 'ריזורט', spa: 'מלון ספא', zimmer: 'צימר', cabins: 'בקתות', farm: 'חוות אירוח', kibbutz: 'מלון קיבוץ', lodge: 'לינה מדברית', hostel: 'אכסניה' };
  const STAY_FILTERS = [['all', 'הכל'], ['hotel', 'מלונות'], ['zimmer', 'צימרים, בקתות וחוות'], ['spa', 'ספא'], ['family', 'למשפחות'], ['couple', 'לזוגות'], ['budget', 'חסכוני']];
  const TAG_LABEL = { family: 'משפחות', couple: 'זוגות', spa: 'ספא', pool: 'בריכה', adults: 'מבוגרים בלבד', nature: 'טבע', budget: 'חסכוני', view: 'נוף', culture: 'תרבות', night: 'לילה', food: 'אוכל', adventure: 'אקסטרים', relax: 'רוגע' };
  function stayMatches(h, f) {
    const kind = h.kind || 'hotel', tags = h.tags || [];
    if (f === 'all') return true;
    if (f === 'hotel') return ['hotel', 'boutique', 'resort', 'spa'].includes(kind);
    if (f === 'zimmer') return ['zimmer', 'cabins', 'farm', 'lodge', 'kibbutz'].includes(kind);
    if (f === 'spa') return kind === 'spa' || tags.includes('spa');
    if (f === 'budget') return h.tier === 'budget' || tags.includes('budget');
    return tags.includes(f);
  }
  const activeTypes = (s) => { const t = (s.types || []).slice(); if ((s.kids || 0) > 0 && !t.includes('family')) t.push('family'); return t; };
  function typeFit(d, s) {
    const types = activeTypes(s), v = d.vibes || {};
    let pts = 0; const good = [], weak = [];
    types.forEach(t => {
      const x = v[t] === undefined ? 1 : v[t];
      pts += (x - 1.5) * 10;
      if (x >= 3) good.push(t); else if (x <= 0) weak.push(t);
    });
    if (types.includes('religious') && d.region === 'abroad' && !d.kosher.length) { pts -= 10; weak.push('religious'); }
    return { pts, good, weak, types };
  }

  /* ---------- הערכת יעד לתאריכים ---------- */
  const IDEAL = { eilat: 28, deadsea: 29, telaviv: 27, dubai: 28, bangkok: 31, athens: 26, barcelona: 26 };
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
    let score = 100 - Math.abs(temp - ideal) * 3;
    const best = d.bestMonths.includes(m + 1);
    if (best) score += 8;
    const nights = nightsOf(s);
    const longHaul = d.flightTime >= 9;
    const tooShort = longHaul && nights < 6;
    if (tooShort) score -= 28;
    if (d.region === 'il' && nights <= 3) score += 6;
    if (!longHaul && d.region === 'abroad' && nights <= 5) score += 4;
    const fit = typeFit(d, s);
    score += fit.pts;
    return { score: Math.round(Math.max(0, Math.min(99, score))), raw: score, temp, best, tooShort, month: m, est: estimate(d, s), fit };
  }
  function ranked(s, region) {
    return DESTS
      .filter(d => region === 'all' || d.region === region)
      .map(d => ({ d, e: evaluate(d, s) }))
      .sort((a, b) => b.e.raw - a.e.raw);
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
      case 'booking': return `https://www.booking.com/searchresults.he.html?ss=${city}&checkin=${a}&checkout=${b}&group_adults=${n}&no_rooms=${rooms}${PT.bookingAid ? '&aid=' + enc(PT.bookingAid) : ''}`;
      case 'airbnb': return `https://www.airbnb.com/s/${city}/homes?checkin=${a}&checkout=${b}&adults=${n}`;
      case 'expedia': return `https://www.expedia.com/Hotel-Search?destination=${city}&startDate=${a}&endDate=${b}&adults=${n}${PT.expediaAffcid ? '&affcid=' + enc(PT.expediaAffcid) : ''}`;
      case 'discovercars': return `https://www.discovercars.com/${PT.discoverCarsAid ? '?a_aid=' + enc(PT.discoverCarsAid) : ''}`;
      case 'getyourguide': return `https://www.getyourguide.com/s/?q=${city}&date_from=${a}&date_to=${b}${PT.getYourGuidePartner ? '&partner_id=' + enc(PT.getYourGuidePartner) : ''}`;
      case 'aviasales': {
        const dm = (x) => pad(x.getDate()) + pad(x.getMonth() + 1);
        return `https://www.aviasales.com/search/TLV${dm(s.start)}${d.iata}${dm(s.end || addDays(s.start, 3))}${n}${PT.travelpayoutsMarker ? '?marker=' + enc(PT.travelpayoutsMarker) : ''}`;
      }
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
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc('חופשה ב' + d.name)}&dates=${c(s.start)}/${c(end)}&details=${enc('תוכנן ב' + BRAND + ' — ' + d.tagline)}&location=${enc(d.nameEn)}`;
  }

  /* ---------- פוסטר, תמונות וסרטונים ---------- */
  const poster = (d, w, h) => window.Posters.svg(d, { w: w || 300, h: h || 340 });
  const MEDIA = window.APP_MEDIA || {};
  const mediaOf = (d) => MEDIA[d.id] || { photos: [], videos: [] };
  const commonsImg = (file, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${enc(file)}?width=${w || 1280}`;
  const commonsPage = (file) => `https://commons.wikimedia.org/wiki/File:${enc(file)}`;
  /* תמונה אמיתית מעל הפוסטר; אם לא נטענה — הפוסטר נשאר */
  function photoTag(d, w, i) {
    const p = mediaOf(d).photos[i || 0];
    return p ? `<img class="photo" src="${esc(commonsImg(p[0], w))}" alt="${esc(p[1])} — ${esc(d.name)}" loading="lazy" decoding="async">` : '';
  }
  const ytWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  /* נגן מוטמע עובד רק מאתר אינטרנט (לא מקובץ מקומי ולא בתצוגה המקדימה) */
  const EMBED_OK = /^https?:$/.test(location.protocol) && !/claude|anthropic/i.test(location.hostname);
  function videoCard(d, v, opts) {
    const [id, title, by, lang] = v;
    const o = opts || {};
    return `
      <a class="yt-card" href="${ytWatch(id)}" target="_blank" rel="noopener" data-yt="${esc(id)}">
        <span class="yt-frame">
          ${poster(d, 480, 270)}
          <img class="photo" src="${ytThumb(id)}" alt="" loading="lazy">
          <span class="play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span>
          ${lang === 'he' ? '<span class="yt-lang">עברית</span>' : ''}
        </span>
        <span class="yt-meta">
          ${o.showDest ? `<span class="eyebrow">${esc(d.name)}</span>` : ''}
          <b dir="auto">${esc(title)}</b>
          <span class="fine">${by ? esc(by) + ' · ' : ''}YouTube</span>
        </span>
      </a>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const v = b.dataset.copy;
    const target = b.dataset.copyTarget ? $(b.dataset.copyTarget) : b.previousElementSibling;
    try {
      navigator.clipboard.writeText(v).then(() => toast(b.dataset.copyMsg || 'הועתק: ' + v), () => { selectText(target); toast('סמנו והעתיקו ידנית'); });
    } catch (err) { selectText(target); toast('סמנו והעתיקו ידנית'); }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-deal]'); if (!a) return;
    dealState.dest = a.dataset.deal; dealState.hotel = 0; dealState.id = null;
  });
  document.addEventListener('load', (e) => { if (e.target.classList && e.target.classList.contains('photo')) e.target.classList.add('loaded'); }, true);
  document.addEventListener('error', (e) => { if (e.target.classList && e.target.classList.contains('photo')) e.target.remove(); }, true);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-yt]');
    if (!a || !EMBED_OK || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const ifr = document.createElement('iframe');
    ifr.src = `https://www.youtube-nocookie.com/embed/${a.dataset.yt}?autoplay=1&rel=0`;
    ifr.title = a.querySelector('b').textContent;
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.allowFullscreen = true;
    const frame = a.querySelector('.yt-frame');
    frame.innerHTML = '';
    frame.appendChild(ifr);
    const card = document.createElement('div');
    card.className = 'yt-card playing';
    while (a.firstChild) card.appendChild(a.firstChild);
    a.replaceWith(card);
  });

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
    if (raw.startsWith('stays-')) { view = 'stays'; if (REGION_LABEL[raw.slice(6)]) staysState.r = raw.slice(6); }
    if (raw.startsWith('go-')) { view = 'go'; arg = raw.slice(3); }
    if (!$('#view-' + view)) view = 'home';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
    $$('.mainnav [data-nav]').forEach(a => {
      const on = a.dataset.nav === view || (view === 'dest' && a.dataset.nav === 'explore');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const R = { home: renderHome, explore: renderExplore, dest: () => renderDest(arg), deal: renderDeal, sites: renderSites, airport: renderAirport, budget: renderBudget, trips: renderTrips, help: renderHelp, stays: renderStays, go: () => renderGo(arg) };
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
    const SLIDES = ['paris', 'tokyo', 'athens', 'eilat', 'newyork', 'barcelona', 'prague'].map(id => byId[id]).filter(Boolean);
    el.innerHTML = `
      <section class="hero-band">
        <div class="hero-slides" aria-hidden="true">${SLIDES.map((d, i) => `<div class="slide ${i === 0 ? 'on' : ''}" data-cap="${esc(d.name)} · ${esc((mediaOf(d).photos[0] || [])[1] || '')}">${poster(d, 1600, 760)}${photoTag(d, 1920, 0)}</div>`).join('')}</div>
        <div class="wrap hero">
          <div class="hero-copy">
            <span class="eyebrow hero-eyebrow">TLV → העולם · ${DESTS.length} יעדים</span>
            <h1 class="h-display">סמנו תאריכים ביומן.<br><span>אנחנו נמצא לאן לטוס.</span></h1>
            <p class="lead">מדרגים את היעדים לפי מזג האוויר בתאריכים שלכם, בונים דיל עם מלון, טיסה ורכב, וסוגרים מול סוכן או ישירות אצל הספק. כולל זמני הגעה לנתב״ג, מסעדות כשרות ומישלן, תחבורה, כסף ומסלולים.</p>
            <div class="hero-ctas">
              <a class="btn btn-amber" href="#planner" id="goPlan">בחירת תאריכים</a>
              <a class="btn btn-glass" href="#deal">סגירת דיל</a>
              <a class="btn btn-glass" href="#sites">כל אתרי החופשות</a>
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
        <div class="wrap hero-cap"><span id="heroCap"></span></div>
      </section>

      <div class="wrap">
        <div class="features">
          <a class="feature" href="#deal"><span class="f-ico">${ICON_F.deal}</span><b>סגירת דיל</b><span>מלון, טיסה ורכב בסיכום אחד, מול סוכן או ישירות</span></a>
          <a class="feature" href="#sites"><span class="f-ico">${ICON_F.sites}</span><b>כל האתרים</b><span>${(window.APP_SITES || []).reduce((a, g) => a + g.items.length, 0)} אתרי חופשות עם התאריכים שלכם</span></a>
          <a class="feature" href="#airport"><span class="f-ico">${ICON_F.plane}</span><b>זמני שדה תעופה</b><span>מתי לצאת מהבית ומתי נוחתים</span></a>
          <a class="feature" href="#dest-paris.money"><span class="f-ico">${ICON_F.money}</span><b>כסף בכל מדינה</b><span>מטבע, שער חי, ממיר ומחירים</span></a>
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
            <div class="field">
              <span class="label">מתוכם ילדים</span>
              <div class="stepper">
                <button type="button" data-kids="-1" aria-label="פחות ילדים">−</button>
                <output id="kidsOut">${st.kids}</output>
                <button type="button" data-kids="1" aria-label="יותר ילדים">+</button>
              </div>
            </div>
            <div class="field">
              <span class="label">איזו חופשה? אפשר לבחור כמה</span>
              <div class="type-chips" id="typeChips">${typeChipsHTML()}</div>
            </div>
            <p class="fine">המחירים משוערים לכל הקבוצה, כולל טיסה, לינה, אוכל, תחבורה ואטרקציות.</p>
          </div>
        </div>

        <div class="section-head mt">
          <div>
            <span class="eyebrow">מטיילים ממליצים</span>
            <h2 class="h-section">שמעו ממי שכבר היה שם</h2>
            <p class="lead">סרטונים אמיתיים של מטיילים ויוצרי תוכן. בכל עמוד יעד יש עוד.</p>
          </div>
        </div>
        <div class="yt-grid">${(window.APP_MEDIA_FEATURED || []).map(([id, i]) => byId[id] && mediaOf(byId[id]).videos[i] ? videoCard(byId[id], mediaOf(byId[id]).videos[i], { showDest: true }) : '').join('')}</div>

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
      st.kids = Math.min(st.kids, st.travelers - 1);
      $('#travOut').textContent = st.travelers; $('#kidsOut').textContent = st.kids; updatePlan();
    });
    $$('[data-kids]', el).forEach(b => b.onclick = () => {
      st.kids = Math.max(0, Math.min(st.travelers - 1, st.kids + Number(b.dataset.kids)));
      $('#kidsOut').textContent = st.kids; updatePlan();
    });
    bindTypeChips($('#typeChips'), updatePlan);
    bindSeg('#regionSeg', 'region');
    bindSeg('#styleSeg', 'style');
    drawCal();
    updatePlan();
    tickClock();
    $('#goPlan').onclick = (e) => { e.preventDefault(); $('#planner').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    startSlides();
  }

  function startSlides() {
    clearInterval(startSlides._t);
    const slides = $$('.hero-slides .slide');
    const cap = $('#heroCap');
    let i = 0;
    const show = () => { slides.forEach((x, k) => x.classList.toggle('on', k === i)); if (cap) cap.textContent = slides[i] ? slides[i].dataset.cap : ''; };
    show();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || slides.length < 2) return;
    startSlides._t = setInterval(() => { if (!document.body.contains(slides[0])) return clearInterval(startSlides._t); i = (i + 1) % slides.length; show(); }, 6000);
  }
  const ICON_F = {
    deal: '<svg viewBox="0 0 24 24"><path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z" fill="currentColor"/></svg>',
    sites: '<svg viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" fill="currentColor"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor"/></svg>',
    money: '<svg viewBox="0 0 24 24"><path d="M3 6h18v12H3zm9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 8v2a2 2 0 0 0 2-2zm12 0a2 2 0 0 0 2 2V8zM5 16h2a2 2 0 0 0-2-2zm14-2a2 2 0 0 0-2 2h2z" fill="currentColor"/></svg>'
  };

  function typeChipsHTML() {
    return TRIP_TYPES.map(([k, v]) => `<button type="button" class="type-chip" data-type="${k}" aria-pressed="${st.types.includes(k)}">${v}</button>`).join('');
  }
  function bindTypeChips(box, after) {
    if (!box) return;
    box.onclick = (e) => {
      const b = e.target.closest('[data-type]'); if (!b) return;
      const k = b.dataset.type;
      st.types = st.types.includes(k) ? st.types.filter(x => x !== k) : st.types.concat(k);
      $$('[data-type]', box).forEach(x => x.setAttribute('aria-pressed', String(st.types.includes(x.dataset.type))));
      after();
    };
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
        <a class="result-poster" href="#dest-${d.id}" aria-label="${esc(d.name)}">${poster(d, 300, 300)}${photoTag(d, 400, 0)}<span class="result-rank">#${i + 1}</span></a>
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
          ${fitChips(e.fit)}
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
          <div class="result-links"><a class="btn btn-amber btn-sm" href="#deal" data-deal="${d.id}">סגירת דיל</a><button class="btn btn-sm" type="button" data-save="${d.id}">שמירה</button></div>
        </div>
      </article>`;
  }

  function fitChips(fit) {
    if (!fit || !fit.types.length) return '';
    return `<div class="result-facts fit-row">
      ${fit.good.length ? `<span class="chip chip-good">מצוין ל: ${fit.good.map(t => TYPE_LABEL[t]).join(', ')}</span>` : ''}
      ${fit.weak.length ? `<span class="chip chip-warn">פחות מתאים ל: ${fit.weak.map(t => TYPE_LABEL[t]).join(', ')}</span>` : ''}
    </div>`;
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
          <div class="type-chips" id="exTypes">${typeChipsHTML()}</div>
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
      if (activeTypes(st).length) {
        const sc = (d) => typeFit(d, st).pts;
        list.sort((a, b) => sc(b) - sc(a));
      }
      $('#destGrid').innerHTML = list.length ? list.map(destCard).join('') : `<div class="empty">לא נמצאו יעדים. נסו חיפוש אחר.</div>`;
    };
    bindSeg('#exSeg', 'exploreFilter', draw);
    bindTypeChips($('#exTypes'), () => { savePlan(); draw(); });
    $('#exSearch').oninput = draw;
    draw();
  }

  function destCard(d) {
    const e = evaluate(d, st.end ? st : { ...st, end: addDays(st.start, 4) });
    return `
      <a class="dest-card" href="#dest-${d.id}">
        <div class="dest-art">
          ${poster(d, 300, 340)}
          ${photoTag(d, 640, 0)}
          <div class="poster-title"><span class="name">${esc(d.name)}</span><span class="code">${d.iata === 'TLV' ? 'ISR' : d.iata}</span></div>
        </div>
        <div class="dest-info">
          <p>${esc(d.tagline)}</p>
          <div class="dest-meta">
            <span class="chip">${esc(d.country)}</span>
            ${d.flightTime ? `<span class="chip">${d.flightTime} ש׳ טיסה</span>` : '<span class="chip">ללא טיסה</span>'}
            <span class="chip">${e.temp}° ב${MONTHS_S[e.month]}</span>
            ${e.best ? '<span class="chip chip-good">עונה טובה</span>' : ''}
            ${e.fit.good.length ? `<span class="chip chip-good">${e.fit.good.map(t => TYPE_LABEL[t]).join(' · ')}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  /* =========================================================
     עמוד יעד
     ========================================================= */
  const TABS = [
    ['overview', 'סקירה'], ['gallery', 'תמונות'], ['flights', 'טיסה ושדה'], ['hotels', 'לינה'], ['fun', 'בילוי ואטרקציות'], ['car', 'השכרת רכב'],
    ['food', 'מסעדות'], ['money', 'כסף ותשלומים'], ['contacts', 'אנשי קשר'], ['transit', 'תחבורה ועלויות'], ['routes', 'מסלולים'], ['map', 'מפה'], ['videos', 'סרטונים וממליצים']
  ];

  function renderDest(id) {
    const d = byId[id];
    const el = $('#view-dest');
    if (!d) { location.hash = '#explore'; return; }
    const tabs = TABS.filter(([k]) => k !== 'fun' || (d.fun && d.fun.length));
    if (!tabs.some(t => t[0] === st.tab)) st.tab = 'overview';
    el.innerHTML = `
      <div class="wrap">
        <div class="crumbs"><a href="#explore">יעדים</a><span>›</span><span>${esc(d.name)}</span></div>
        <div class="dest-hero">
          ${poster(d, 1200, 460)}
          ${photoTag(d, 1600, 0)}
          <div class="dest-hero-body">
            <span class="eyebrow" style="color:#F4B942">${esc(d.country)} · ${esc(d.nameEn)}</span>
            <h1 class="h-display">${esc(d.name)}</h1>
            <p>${esc(d.about)}</p>
            <div class="result-links">
              <a class="btn btn-amber btn-sm" href="#deal" id="destDeal">סגירת דיל ל${esc(d.name)}</a>
              <button class="btn btn-sm" type="button" id="destSave">שמירה לחופשות שלי</button>
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
          ${tabs.map(([k, v]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === st.tab}">${v}</button>`).join('')}
        </div>
        <div id="tabBody" role="tabpanel"></div>
      </div>`;
    $('#destSave').onclick = () => saveTrip(d.id);
    $('#destDeal').onclick = () => { dealState.dest = d.id; dealState.hotel = 0; dealState.id = null; };
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
              ${fitChips(e.fit)}
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
          ${d.vibes ? `<div class="card mt">
            <div class="row"><h3>למי ${esc(d.name)} מתאים?</h3><span class="fine">0–3 · לפי אופי היעד</span></div>
            <div class="vibes">${TRIP_TYPES.map(([k, v]) => {
              const x = d.vibes[k] || 0, on = activeTypes(st).includes(k);
              return `<div class="vibe ${on ? 'on' : ''}"><span>${v}</span><span class="dots" aria-label="${x} מתוך 3">${[1, 2, 3].map(i => `<i class="${i <= x ? 'f' : ''}"></i>`).join('')}</span></div>`;
            }).join('')}</div>
          </div>` : ''}
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
      hotels: () => {
        const counts = Object.fromEntries(STAY_FILTERS.map(([k]) => [k, d.hotels.filter(h => stayMatches(h, k)).length]));
        const list = d.hotels.filter(h => stayMatches(h, st.stay));
        return `
        <div class="filters" style="justify-content:flex-start">
          <div class="seg" id="stayFilter">${STAY_FILTERS.filter(([k]) => k === 'all' || counts[k]).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${st.stay === k}">${v} <span class="cnt">${counts[k]}</span></button>`).join('')}</div>
        </div>
        <div class="card">
          <div class="row"><h3>לינה ב${esc(d.name)}</h3><span class="fine">מחיר ללילה לחדר זוגי / יחידה, משוער</span></div>
          <ul class="list">
            ${list.length ? list.map(h => stayRow(d, s, h)).join('') : '<li class="fine">אין מקומות בקטגוריה הזו ביעד. נסו סינון אחר.</li>'}
          </ul>
        </div>
        ${d.region === 'il' ? `<div class="card mt row"><div><h3>רוצים עוד אפשרויות?</h3><p class="fine">כל המלונות, הצימרים והבקתות ב${esc(REGION_LABEL[nearestPlace(d.coords).p.r])}, עם מפה, טלפונים וניווט.</p></div><a class="btn btn-primary" href="#stays-${nearestPlace(d.coords).p.r}">לכל הלינה באזור</a></div>` : ''}
        ${d.region === 'il' ? `<p class="note mt">מחפשים עוד צימרים? ${ext(`https://www.booking.com/searchresults.he.html?ss=${enc(d.nameEn)}&checkin=${iso(s.start)}&checkout=${iso(s.end)}&group_adults=${s.travelers}`, 'עוד מקומות לינה ב-Booking', '')} · ${ext(`https://www.airbnb.com/s/${enc(d.nameEn)}/homes?checkin=${iso(s.start)}&checkout=${iso(s.end)}&adults=${s.travelers}`, 'בתים ובקתות ב-Airbnb', '')}</p>` : ''}
        <div class="section-head mt"><h2 class="h-section" style="font-size:36px">עוד לינה בתאריכים שלכם</h2></div>
        ${siteLinks(d, s, ['hotel'])}`;
      },
      fun: () => {
        const tags = [...new Set((d.fun || []).flatMap(f => f.tags || []))];
        const list = (d.fun || []).filter(f => st.funTag === 'all' || (f.tags || []).includes(st.funTag));
        const rel = activeTypes(st).includes('religious') && d.region === 'il';
        return `
        <div class="filters" style="justify-content:flex-start">
          <div class="seg" id="funFilter"><button type="button" data-v="all" aria-pressed="${st.funTag === 'all'}">הכל</button>${tags.map(t => `<button type="button" data-v="${t}" aria-pressed="${st.funTag === t}">${TAG_LABEL[t] || t}</button>`).join('')}</div>
        </div>
        ${rel ? '<p class="warn-note" style="margin-bottom:14px">שומרי שבת: בישראל רוב התחבורה הציבורית לא פועלת בשבת, וחלק מהאטרקציות פתוחות בשבת בתשלום מראש בלבד. הערות על שבת מופיעות ליד כל מקום כשידוע.</p>' : ''}
        <div class="fun-grid">${list.map(f => `
          <article class="card fun-card">
            <div class="row"><span class="eyebrow">${esc(f.type || '')}</span>${(f.tags || []).slice(0, 3).map(t => `<span class="chip">${TAG_LABEL[t] || t}</span>`).join('')}</div>
            <h3>${esc(f.name)}</h3>
            ${f.note ? `<p class="fine">${esc(f.note)}</p>` : ''}
            ${contactHTML(f)}
            <div class="result-links">${ext(gmaps(f.name + ' ' + (f.addr || d.nameEn)), 'ניווט', 'btn btn-sm')}</div>
          </article>`).join('')}
        </div>
        <p class="fine mt">שעות פתיחה ומחירים משתנים — כדאי להתקשר או לבדוק באתר לפני ההגעה.</p>`;
      },
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
            <ul class="list">${d.kosher.map(r => `<li><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.area)} · ${esc(r.note)}</div>${contactHTML(r)}</div>${ext(gmaps(r.name + ' ' + d.nameEn), 'מפה', 'btn btn-sm btn-ghost')}</li>`).join('')}</ul>
            ${ext(gmaps('kosher restaurant ' + d.nameEn), 'כל המסעדות הכשרות במפה', 'btn btn-sm')}
          </div>
          <div class="card">
            <div class="row"><h3>${d.michelin.length ? 'מישלן' : 'מסעדות שף'}</h3>${d.michelin.length ? '<span class="stars" aria-label="כוכבי מישלן">✦✦✦</span>' : ''}</div>
            <p class="fine">${esc(d.michelinNote)}</p>
            <ul class="list">${(d.michelin.length ? d.michelin : d.food.slice(0, 2)).map(r => `<li><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.cuisine || r.type)} · ${esc(r.area)}</div>${contactHTML(r)}</div>
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
          ${d.region === 'il' ? `<div class="card row" style="margin-bottom:14px"><div><h3>איך מגיעים ל${esc(d.name)}?</h3><p class="fine">מסלול ברכב, Waze, קווי אוטובוס ורכבת מכל עיר בארץ.</p></div><a class="btn btn-primary" href="#go-${(IL.places.find(p => p.dest === d.id) || {}).id || ''}">ניווט וקווים</a></div>` : ''}
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
      money: () => moneyTab(d),
      contacts: () => contactsTab(d),
      gallery: () => {
        const ph = mediaOf(d).photos;
        if (!ph.length) return '<div class="empty">אין עדיין תמונות ליעד הזה.</div>';
        return `
          <div class="gallery">${ph.map((p, i) => `
            <figure class="${i === 0 ? 'wide' : ''}">
              <div class="g-img">${poster(d, 800, 500)}<img class="photo" src="${esc(commonsImg(p[0], i === 0 ? 1600 : 900))}" alt="${esc(p[1])}" loading="lazy"></div>
              <figcaption><span>${esc(p[1])}</span>${ext(commonsPage(p[0]), 'צלם ורישיון', 'fine')}</figcaption>
            </figure>`).join('')}
          </div>
          <p class="fine mt">התמונות מ-Wikimedia Commons ברישיונות Creative Commons. שם הצלם ותנאי הרישיון מופיעים בעמוד של כל תמונה.</p>`;
      },
      videos: () => {
        const vids = mediaOf(d).videos;
        const more = [
          [`${d.nameEn} 4K walking tour`, 'סיור הליכה 4K'],
          [`${d.nameEn} food tour`, 'סיור אוכל'],
          [`טיול ל${d.name}`, 'ולוגים בעברית']
        ];
        return `
          <div class="section-head" style="margin-bottom:14px">
            <div><span class="eyebrow">מטיילים ממליצים</span><h2 class="h-section" style="font-size:36px">מה אומרים מי שהיו ב${esc(d.name)}</h2></div>
          </div>
          <div class="yt-grid">${vids.map(v => videoCard(d, v)).join('')}</div>
          <p class="fine" style="margin-top:10px">סרטונים אמיתיים של מטיילים ויוצרי תוכן ב-YouTube. ${EMBED_OK ? 'לחיצה מנגנת כאן בעמוד.' : 'לחיצה פותחת את הסרטון ב-YouTube.'}</p>
          <h3 class="mt" style="margin-bottom:12px">עוד סרטונים</h3>
          <div class="pass-meta">${more.map(([q, t]) => ext(ytSearch(q), esc(t), 'chip')).join('')}</div>`;
      }
    };
    body.innerHTML = T[st.tab]();
    $$('[data-air]', body).forEach(a => a.onclick = () => { airState.dest = a.dataset.air; });
    if (st.tab === 'map') initMap(d);
    if (st.tab === 'money') bindConverter(d);
    const sf = $('#stayFilter'); if (sf) sf.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st.stay = b.dataset.v; drawTab(d); };
    const ff = $('#funFilter'); if (ff) ff.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st.funTag = b.dataset.v; drawTab(d); };
  }

  function stayBadges(h) {
    return `<span class="tier ${h.tier === 'lux' ? 'tier-lux' : ''}">${{ lux: 'יוקרה', mid: 'בינוני', budget: 'חסכוני' }[h.tier]}</span>
      ${h.kind && h.kind !== 'hotel' ? `<span class="tier kind">${STAY_KIND[h.kind] || h.kind}</span>` : ''}`;
  }
  function stayRow(d, s, h) {
    return `<li>
      <div><div class="t">${esc(h.name)} ${stayBadges(h)}</div>
        <div class="s">${esc(h.area)} · ${esc(h.note)}</div>
        ${(h.tags || []).length ? `<div class="tag-row">${h.tags.map(t => `<span class="mini">${TAG_LABEL[t] || t}</span>`).join('')}</div>` : ''}
        ${contactHTML(h)}</div>
      <div class="actions"><span class="chip num">כ-${money(h.price)}</span>
        ${ext(`https://www.booking.com/searchresults.he.html?ss=${enc(h.name + ' ' + d.nameEn)}&checkin=${iso(s.start)}&checkout=${iso(s.end)}&group_adults=${s.travelers}`, 'בדיקת זמינות', 'btn btn-sm')}
        ${ext(gmaps(h.name + ' ' + d.nameEn), 'במפה', 'btn btn-sm btn-ghost')}</div>
    </li>`;
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
     אנשי קשר של ספקים
     ========================================================= */
  const ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.3 8.3 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8.9 5.5 8.4 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.7-5.6a16 16 0 0 0 0-4h3.4a8.3 8.3 0 0 1 0 4z" fill="currentColor"/></svg>'
  };
  const telHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
  function contactHTML(x) {
    if (!x || (!x.addr && !x.phone && !x.web)) return '';
    return `<div class="contact">
      ${x.addr ? `<a class="c-item" href="${esc(gmaps(x.name + ', ' + x.addr))}" target="_blank" rel="noopener">${ICON.pin}<span dir="ltr">${esc(x.addr)}</span></a>` : ''}
      ${x.phone ? `<span class="c-item">${ICON.phone}<a href="${telHref(x.phone)}" dir="ltr" class="mono">${esc(x.phone)}</a><button type="button" class="c-copy" data-copy="${esc(x.phone)}" aria-label="העתקת מספר">העתקה</button></span>` : ''}
      ${x.web ? `<a class="c-item" href="${esc(x.web)}" target="_blank" rel="noopener">${ICON.web}<span>אתר רשמי</span></a>` : ''}
    </div>`;
  }
  const CAR_WEB = { Sixt: 'https://www.sixt.com/', Hertz: 'https://www.hertz.com/', Avis: 'https://www.avis.com/', Europcar: 'https://www.europcar.com/', Enterprise: 'https://www.enterprise.com/', National: 'https://www.nationalcar.com/', 'שלמה סיקסט': 'https://www.shlomo.co.il/', 'אלדן': 'https://www.eldan.co.il/' };
  function contactsTab(d) {
    const group = (title, items) => items.length ? `
      <div class="card"><h3>${title}</h3><ul class="list">${items.map(x => `<li><div><div class="t">${esc(x.name)}</div>${x.sub ? `<div class="s">${esc(x.sub)}</div>` : ''}${contactHTML(x)}</div></li>`).join('')}</ul></div>` : '';
    const hotels = d.hotels.map(h => ({ ...h, sub: `${{ lux: 'יוקרה', mid: 'בינוני', budget: 'חסכוני' }[h.tier]} · ${h.area}` }));
    const kosher = d.kosher.map(k => ({ ...k, sub: k.area }));
    const chef = d.michelin.filter(m => m.phone).map(m => ({ ...m, sub: `${'✦'.repeat(m.stars)} ${m.cuisine}` }));
    const cars = d.car.companies.map(c => ({ name: c, sub: `השכרה ב-${d.airport.code}`, web: CAR_WEB[c] || '' }));
    return `
      <p class="lead" style="margin-bottom:16px">כתובות, טלפונים ואתרים רשמיים של ספקי השירות. לחיצה על כתובת פותחת ניווט; לחיצה על מספר מחייגת (במכשיר שתומך בזה).</p>
      <div class="grid-2">
        ${group('מלונות', hotels)}
        <div class="stack-v">
          ${group('מסעדות כשרות', kosher)}
          ${group('מסעדות מישלן', chef)}
          ${group('בילוי ואטרקציות', (d.fun || []).filter(f => f.phone || f.addr).map(f => ({ ...f, sub: f.type })))}
          ${group('השכרת רכב', cars)}
          <div class="card"><h3>חירום ומידע</h3><ul class="list">
            <li><span class="t">חירום מקומי</span><span class="mono" dir="ltr">${esc(d.emergency)}</span></li>
            <li><span class="t">חדר המצב של משרד החוץ</span><span><span class="mono" dir="ltr">+972 2 530 3155</span></span></li>
            <li><span class="t">מידע טיסות נתב״ג</span><span class="mono" dir="ltr">*6663</span></li>
          </ul></div>
        </div>
      </div>
      <p class="fine mt">הפרטים נאספו ממקורות פומביים (אתרי המלונות והמסעדות, Yelp, Tripadvisor). מומלץ לאמת לפני הגעה.</p>`;
  }

  /* =========================================================
     כסף ושערי מטבע
     ========================================================= */
  const RATES = { live: false, date: '', map: {} };
  const rateOf = (d) => RATES.map[d.currency.code] || d.currency.rate;
  const fmtRate = (r) => r >= 1 ? r.toFixed(2) : r >= 0.1 ? r.toFixed(3) : r.toFixed(4);
  function applyRates(j) {
    const codes = ['EUR', 'GBP', 'USD', 'CZK', 'THB', 'JPY'];
    codes.forEach(c => { if (j.rates && j.rates[c]) RATES.map[c] = 1 / j.rates[c]; });
    if (RATES.map.USD) RATES.map.AED = RATES.map.USD / 3.6725; // הדירהם צמוד לדולר
    RATES.map.ILS = 1;
    RATES.live = true; RATES.date = j.date || '';
  }
  function loadRates() {
    const cached = store.get('rates', null);
    if (cached && cached.fetched === iso(today)) { applyRates(cached); return; }
    const urls = ['https://api.frankfurter.app/latest?from=ILS', 'https://api.frankfurter.dev/v1/latest?base=ILS'];
    const tryNext = (i) => {
      if (i >= urls.length || !window.fetch) return;
      fetch(urls[i]).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
        applyRates(j); store.set('rates', { ...j, fetched: iso(today) });
        if (location.hash.includes('.money')) route();
      }).catch(() => tryNext(i + 1));
    };
    tryNext(0);
  }
  function moneyTab(d) {
    const code = d.currency.code;
    const c = MONEY.currencies[code] || {};
    const m = MONEY.byDest[d.id] || {};
    const r = rateOf(d);
    const isIL = code === 'ILS';
    return `
      <div class="money-hero">
        <div class="coin" aria-hidden="true">${esc(c.symbol || code)}</div>
        <div>
          <span class="eyebrow">המטבע ב${esc(d.country)}</span>
          <h2 class="h-section" style="font-size:44px">${esc(d.currency.name)} <span class="mono fine" style="font-size:18px">${esc(code)}</span></h2>
          ${isIL ? '<p class="lead">משלמים בשקלים — אין צורך בהמרה.</p>' : `<p class="lead"><b class="num">1 ${esc(code)} ≈ ₪${fmtRate(r)}</b> · <b class="num">₪100 ≈ ${Math.round(100 / r).toLocaleString('he-IL')} ${esc(code)}</b></p>
          <span class="chip ${RATES.live ? 'chip-good' : ''}">${RATES.live ? `שער יציג של הבנק המרכזי האירופי · ${esc(RATES.date)}` : 'שער משוער — השער החי לא נטען'}</span>`}
        </div>
      </div>
      ${isIL ? '' : `
      <div class="panel converter">
        <div class="field"><label for="cvIls">שקלים (₪)</label><input class="input" id="cvIls" type="number" min="0" step="10" value="1000" inputmode="decimal"></div>
        <span class="cv-eq" aria-hidden="true">⇄</span>
        <div class="field"><label for="cvLoc">${esc(d.currency.name)} (${esc(code)})</label><input class="input" id="cvLoc" type="number" min="0" step="1" inputmode="decimal"></div>
      </div>`}
      <div class="grid-3 mt">
        <div class="card"><h3>שטרות ומטבעות</h3><ul class="list">
          <li><span class="t">שטרות</span><span>${esc(c.notes || '—')}</span></li>
          <li><span class="t">מטבעות</span><span>${esc(c.coins || '—')}</span></li>
        </ul></div>
        <div class="card"><h3>איך משלמים</h3><p>${esc(m.pay || '')}</p><p class="fine"><b>כספומטים:</b> ${esc(m.atm || '')}</p></div>
        <div class="card"><h3>מס, טיפים והחזרים</h3><p>${esc(m.tax || '—')}</p><p class="fine"><b>טיפ:</b> ${esc(d.tipping)}</p></div>
      </div>
      ${m.prices ? `<div class="card mt"><h3>כמה דברים עולים</h3><div class="table-wrap"><table class="tbl">
        <thead><tr><th>מה</th><th>מחיר מקומי</th>${isIL ? '' : '<th>בשקלים</th>'}</tr></thead>
        <tbody>${m.prices.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${(c.symbol || '')}${v.toLocaleString('he-IL')}</td>${isIL ? '' : `<td class="num">${money(v * r)}</td>`}</tr>`).join('')}</tbody>
      </table></div><p class="fine">מחירים טיפוסיים ומשוערים.</p></div>` : ''}
      ${isIL ? '' : `<p class="warn-note mt">בתשלום באשראי או במשיכה מכספומט בחו״ל, כשהמכשיר שואל "לחייב בשקלים או ב-${esc(code)}?" — בחרו ${esc(code)}. חיוב בשקלים (DCC) כמעט תמיד בשער גרוע יותר.</p>`}`;
  }
  function bindConverter(d) {
    const a = $('#cvIls'), b = $('#cvLoc'); if (!a || !b) return;
    const r = rateOf(d);
    const fromIls = () => { b.value = a.value === '' ? '' : Math.round((+a.value / r) * 100) / 100; };
    const fromLoc = () => { a.value = b.value === '' ? '' : Math.round(+b.value * r * 100) / 100; };
    a.oninput = fromIls; b.oninput = fromLoc; fromIls();
  }

  /* =========================================================
     סגירת דיל
     ========================================================= */
  const dealState = Object.assign({ dest: 'paris', hotel: 0, flight: 'eco', car: 'none', ins: true, transfer: false, esim: true, name: '', phone: '', notes: '', id: null }, store.get('dealDraft', {}) || {});
  const saveDeal = () => store.set('dealDraft', { dest: dealState.dest, hotel: dealState.hotel, flight: dealState.flight, car: dealState.car, ins: dealState.ins, transfer: dealState.transfer, esim: dealState.esim, name: dealState.name, phone: dealState.phone, notes: dealState.notes });
  const CAR_OPTS = [['none', 'בלי רכב', 0], ['small', 'רכב קטן', 1], ['family', 'רכב משפחתי', 1.35], ['suv', 'SUV / 7 מקומות', 1.8]];
  function dealCalc(d, s) {
    const nights = Math.max(1, nightsOf(s)), days = nights + 1, n = s.travelers, rooms = Math.ceil(n / 2);
    const peak = isPeak(s);
    const h = d.hotels[dealState.hotel] || d.hotels[0];
    const abroad = d.region === 'abroad';
    const carF = (CAR_OPTS.find(c => c[0] === dealState.car) || CAR_OPTS[0])[2];
    const lines = [];
    if (d.flightTime && dealState.flight !== 'none') lines.push(['flight', dealState.flight === 'biz' ? 'טיסות — מחלקת עסקים' : 'טיסות — מחלקת תיירים', d.costs.flight * n * (peak ? 1.3 : 1) * (dealState.flight === 'biz' ? 3.2 : 1)]);
    lines.push(['hotel', `${h.name} · ${nights} לילות · ${rooms} ${rooms > 1 ? 'חדרים' : 'חדר'}`, h.price * nights * rooms * (peak ? 1.2 : 1)]);
    if (carF) lines.push(['car', `${CAR_OPTS.find(c => c[0] === dealState.car)[1]} · ${days} ימים`, d.costs.car * days * carF]);
    if (dealState.ins) lines.push(['ins', `ביטוח נסיעות · ${n} מבוטחים`, (abroad ? 22 : 8) * n * days]);
    if (dealState.transfer) lines.push(['transfer', 'העברות שדה–מלון הלוך וחזור', abroad ? 380 : 200]);
    if (dealState.esim && abroad) lines.push(['esim', `eSIM גלישה · ${n} מכשירים`, 45 * n]);
    const total = lines.reduce((a, l) => a + l[2], 0);
    return { lines, total, nights, days, n, rooms, h, peak };
  }
  function dealId(d, s) {
    if (!dealState.id) dealState.id = `MSA-${yymmdd(s.start)}-${d.iata === 'TLV' ? 'ISR' : d.iata}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    return dealState.id;
  }
  function dealText(d, s, c) {
    return [
      `בקשה לסגירת דיל ${dealId(d, s)}`,
      `יעד: ${d.name} (${d.country})`,
      `תאריכים: ${fmt(s.start)}.${s.start.getFullYear()} – ${fmt(s.end)}.${s.end.getFullYear()} · ${c.nights} לילות`,
      `מטיילים: ${c.n}`,
      ...c.lines.map(l => `• ${l[1]}: ${money(l[2])}`),
      `סה״כ משוער: ${money(c.total)}`,
      dealState.name ? `שם: ${dealState.name}` : '',
      dealState.phone ? `טלפון: ${dealState.phone}` : '',
      dealState.notes ? `הערות: ${dealState.notes}` : ''
    ].filter(Boolean).join('\n');
  }

  function renderDeal() {
    const el = $('#view-deal');
    if (!byId[dealState.dest]) dealState.dest = 'paris';
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">בונים את הדיל</span>
            <h1 class="h-section">סגירת דיל</h1>
            <p class="lead">בוחרים יעד, מלון, טיסה, רכב ותוספות. מקבלים סיכום עם מספר דיל, וסוגרים מול הסוכן או מזמינים ישירות אצל כל ספק.</p>
          </div>
        </div>
        <div class="deal-layout">
          <div class="stack-v" id="dealSteps"></div>
          <aside class="deal-pass" id="dealPass" aria-live="polite"></aside>
        </div>
      </div>`;
    drawDeal();
  }

  function drawDeal() {
    const d = byId[dealState.dest];
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    const steps = $('#dealSteps'); if (!steps) return;
    const opt = (name, val, cur, label, sub) => `<label class="opt ${val === cur ? 'on' : ''}"><input type="radio" name="${name}" value="${val}" ${val === cur ? 'checked' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    steps.innerHTML = `
      <section class="step-card">
        <header><span class="step-n">1</span><h3>יעד ותאריכים</h3></header>
        <div class="form-grid">
          <div class="field"><label for="dlDest">יעד</label>
            <select class="input" id="dlDest">${DESTS.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.country)}</option>`).join('')}</select></div>
          <div class="field"><span class="label">תאריכים ומטיילים</span>
            <div class="date-pill"><span class="num">${fmt(s.start)} – ${fmt(s.end)}</span><span>${nightsOf(s)} לילות · ${s.travelers} מטיילים</span><a href="#home">שינוי ביומן</a></div></div>
        </div>
      </section>
      <section class="step-card">
        <header><span class="step-n">2</span><h3>לינה</h3></header>
        <div class="seg" id="dlStay">${STAY_FILTERS.filter(([k]) => k === 'all' || d.hotels.some(h => stayMatches(h, k))).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${st.stay === k}">${v}</button>`).join('')}</div>
        <div class="hotel-opts">${d.hotels.map((h, i) => stayMatches(h, st.stay) || i === dealState.hotel ? `
          <label class="hotel-opt ${i === dealState.hotel ? 'on' : ''}">
            <input type="radio" name="dlHotel" value="${i}" ${i === dealState.hotel ? 'checked' : ''}>
            <span class="ho-top"><b>${esc(h.name)}</b><span>${stayBadges(h)}</span></span>
            <span class="fine">${esc(h.area)} · ${esc(h.note)}</span>
            <span class="ho-price num">כ-${money(h.price)} ללילה</span>
            ${h.phone ? `<span class="fine mono" dir="ltr">${esc(h.phone)}</span>` : ''}
          </label>` : '').join('')}</div>
      </section>
      ${d.flightTime ? `<section class="step-card">
        <header><span class="step-n">3</span><h3>טיסה</h3></header>
        <div class="opts">${opt('dlFlight', 'eco', dealState.flight, 'מחלקת תיירים', `TLV → ${d.airport.code} · כ-${d.flightTime} ש׳`)}${opt('dlFlight', 'biz', dealState.flight, 'מחלקת עסקים', 'מושב נפתח, טרקלין')}${opt('dlFlight', 'none', dealState.flight, 'יש לי כבר טיסה', '')}</div>
      </section>` : ''}
      <section class="step-card">
        <header><span class="step-n">${d.flightTime ? 4 : 3}</span><h3>רכב</h3></header>
        <p class="fine">${esc(d.car.need)} · נהיגה בצד ${esc(d.drivingSide)}</p>
        <div class="opts">${CAR_OPTS.map(c => opt('dlCar', c[0], dealState.car, c[1], c[2] ? `כ-${money(d.costs.car * c[2])} ליום` : '')).join('')}</div>
      </section>
      <section class="step-card">
        <header><span class="step-n">${d.flightTime ? 5 : 4}</span><h3>תוספות</h3></header>
        <div class="opts">
          <label class="opt ${dealState.ins ? 'on' : ''}"><input type="checkbox" id="dlIns" ${dealState.ins ? 'checked' : ''}><span><b>ביטוח נסיעות</b><small>רפואי, כבודה וביטולים</small></span></label>
          <label class="opt ${dealState.transfer ? 'on' : ''}"><input type="checkbox" id="dlTransfer" ${dealState.transfer ? 'checked' : ''}><span><b>העברות מהשדה</b><small>נהג ממתין בנחיתה</small></span></label>
          ${d.region === 'abroad' ? `<label class="opt ${dealState.esim ? 'on' : ''}"><input type="checkbox" id="dlEsim" ${dealState.esim ? 'checked' : ''}><span><b>eSIM גלישה</b><small>מחובר מהנחיתה</small></span></label>` : ''}
        </div>
      </section>
      <section class="step-card">
        <header><span class="step-n">${d.flightTime ? 6 : 5}</span><h3>פרטי המזמין</h3></header>
        <div class="form-grid">
          <div class="field"><label for="dlName">שם מלא</label><input class="input" id="dlName" autocomplete="name" value="${esc(dealState.name)}"></div>
          <div class="field"><label for="dlPhone">טלפון</label><input class="input" id="dlPhone" type="tel" autocomplete="tel" dir="ltr" value="${esc(dealState.phone)}"></div>
        </div>
        <div class="field"><label for="dlNotes">בקשות מיוחדות</label><textarea class="input" id="dlNotes" rows="2" placeholder="לדוגמה: חדר עם נוף, ארוחות כשרות, עגלת תינוק">${esc(dealState.notes)}</textarea></div>
      </section>`;

    const re = () => { saveDeal(); drawDeal(); };
    $('#dlDest').onchange = (e) => { dealState.dest = e.target.value; dealState.hotel = 0; dealState.id = null; re(); };
    $$('input[name=dlHotel]').forEach(i => i.onchange = () => { dealState.hotel = +i.value; re(); });
    $('#dlStay').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st.stay = b.dataset.v; drawDeal(); };
    $$('input[name=dlFlight]').forEach(i => i.onchange = () => { dealState.flight = i.value; re(); });
    $$('input[name=dlCar]').forEach(i => i.onchange = () => { dealState.car = i.value; re(); });
    [['#dlIns', 'ins'], ['#dlTransfer', 'transfer'], ['#dlEsim', 'esim']].forEach(([sel, k]) => { const x = $(sel); if (x) x.onchange = () => { dealState[k] = x.checked; re(); }; });
    [['#dlName', 'name'], ['#dlPhone', 'phone'], ['#dlNotes', 'notes']].forEach(([sel, k]) => { $(sel).oninput = (e) => { dealState[k] = e.target.value; saveDeal(); drawPass(); }; });
    drawPass();
  }

  function drawPass() {
    const d = byId[dealState.dest];
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    const c = dealCalc(d, s);
    const id = dealId(d, s);
    const text = dealText(d, s, c);
    const wa = AG.whatsapp ? `https://wa.me/${String(AG.whatsapp).replace(/\D/g, '')}?text=${enc(text)}` : '';
    const mail = AG.email ? `mailto:${AG.email}?subject=${enc('בקשה לסגירת דיל ' + id)}&body=${enc(text)}` : '';
    const direct = [
      ['לינה', c.h.name, `https://www.booking.com/searchresults.he.html?ss=${enc(c.h.name + ' ' + d.nameEn)}&checkin=${iso(s.start)}&checkout=${iso(s.end)}&group_adults=${c.n}&no_rooms=${c.rooms}${PT.bookingAid ? '&aid=' + enc(PT.bookingAid) : ''}`],
      d.flightTime && dealState.flight !== 'none' ? ['טיסות', `TLV → ${d.airport.code}`, siteUrl('skyscanner', d, s)] : null,
      dealState.car !== 'none' ? ['רכב', `איסוף ב-${d.airport.code}`, PT.discoverCarsAid ? siteUrl('discovercars', d, s) : siteUrl('kayakcars', d, s)] : null,
      dealState.ins ? ['ביטוח', 'PassportCard', 'https://www.passportcard.co.il/'] : null,
      ['אטרקציות', d.name, siteUrl('getyourguide', d, s)]
    ].filter(Boolean);
    $('#dealPass').innerHTML = `
      <div class="dp-top">
        ${poster(d, 600, 260)}${photoTag(d, 800, 0)}
        <div class="dp-route"><span class="mono">TLV</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" transform="rotate(-90 12 12)"/></svg><span class="mono">${d.iata === 'TLV' ? 'ISR' : d.airport.code}</span></div>
        <div class="dp-name"><b>${esc(d.name)}</b><span>${fmt(s.start)} – ${fmt(s.end)} · ${c.nights} לילות · ${c.n} מטיילים</span></div>
      </div>
      <div class="dp-body">
        <div class="dp-id"><span class="label">מספר דיל</span><span class="mono">${esc(id)}</span></div>
        <ul class="dp-lines">${c.lines.map(l => `<li><span>${esc(l[1])}</span><span class="num">${money(l[2])}</span></li>`).join('')}</ul>
        <div class="dp-total"><span>סה״כ משוער</span><b class="num">${money(c.total)}</b></div>
        <div class="fine num">${money(c.total / c.n)} לאדם${c.peak ? ' · כולל תוספת עונת שיא' : ''}</div>

        <div class="dp-actions">
          ${N8N.base ? `<button type="button" class="btn btn-primary" id="dealSend">שליחת הדיל לסוכן</button>` : ''}
          ${wa ? `<a class="btn ${N8N.base ? '' : 'btn-amber'}" href="${esc(wa)}" target="_blank" rel="noopener">סגירת הדיל מול הסוכן בוואטסאפ</a>` : ''}
          ${mail ? `<a class="btn" href="${esc(mail)}">שליחת הדיל במייל לסוכן</a>` : ''}
          ${AG.phone ? `<div class="copy-row"><span>טלפון הסוכן</span><span class="mono" dir="ltr">${esc(AG.phone)}</span></div>` : ''}
          ${!wa && !mail ? `<p class="note">חיבור לסוכן עוד לא הוגדר באתר. אפשר להעתיק את פרטי הדיל ולשלוח לסוכן, או להזמין ישירות אצל הספקים למטה.</p>` : ''}
          <textarea class="input dp-text" id="dealText" rows="6" readonly>${esc(text)}</textarea>
          <button type="button" class="btn" data-copy="${esc(text)}" data-copy-target="#dealText" data-copy-msg="פרטי הדיל הועתקו">העתקת פרטי הדיל</button>
          <button type="button" class="btn btn-ghost" id="dealSave">שמירה לחופשות שלי</button>
        </div>

        <div class="dp-direct">
          <span class="label">או הזמנה ישירה אצל הספק</span>
          ${direct.map(([k, v, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span class="kind">${k}</span><b>${esc(v)}</b><span class="go">להזמנה ←</span></a>`).join('')}
        </div>
        <p class="fine">המחירים משוערים. המחיר הסופי נקבע אצל הספק או הסוכן בזמן ההזמנה.</p>
      </div>`;
    $('#dealSave').onclick = () => saveTrip(d.id, { end: s.end, travelers: s.travelers, budget: c.total });
    const send = $('#dealSend');
    if (send) send.onclick = () => {
      if (!dealState.phone.trim()) { toast('הוסיפו טלפון כדי שהסוכן יוכל לחזור אליכם'); $('#dlPhone').focus(); return; }
      send.disabled = true; send.textContent = 'שולח…';
      n8nPost(N8N.deal, {
        dealId: id, createdAt: new Date().toISOString(), sessionId,
        destination: { id: d.id, name: d.name, country: d.country },
        dates: { start: iso(s.start), end: iso(s.end), nights: c.nights }, travelers: c.n,
        items: c.lines.map(l => ({ key: l[0], label: l[1], priceILS: Math.round(l[2]) })), totalILS: Math.round(c.total),
        customer: { name: dealState.name, phone: dealState.phone, notes: dealState.notes }, text
      }, 20000).then(() => {
        send.textContent = 'הדיל נשלח ✓'; toast(`הדיל ${id} נשלח. הסוכן יחזור אליכם בהקדם.`);
      }).catch(() => {
        send.disabled = false; send.textContent = 'שליחת הדיל לסוכן';
        toast(wa ? 'השליחה לא הצליחה — אפשר לשלוח בוואטסאפ' : 'השליחה לא הצליחה — העתיקו את פרטי הדיל ושלחו לסוכן');
      });
    };
  }

  /* =========================================================
     כל האתרים
     ========================================================= */
  const sitesState = { q: '', dest: null };
  function renderSites() {
    const el = $('#view-sites');
    if (!sitesState.dest) sitesState.dest = dealState.dest || 'paris';
    const s = st.end ? st : { ...st, end: addDays(st.start, 4) };
    const groups = window.APP_SITES || [];
    const total = groups.reduce((a, g) => a + g.items.length, 0);
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${total} אתרים</span>
            <h1 class="h-section">כל אתרי החופשות במקום אחד</h1>
            <p class="lead">טיסות, מלונות, חבילות, רכב, אטרקציות וביטוח. באתרים המסומנים היעד והתאריכים שלכם כבר ממולאים.</p>
          </div>
        </div>
        <div class="panel sites-bar">
          <div class="field"><label for="stDest">יעד</label>
            <select class="input" id="stDest">${DESTS.map(x => `<option value="${x.id}" ${x.id === sitesState.dest ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="date-pill"><span class="num">${fmt(s.start)} – ${fmt(s.end)}</span><span>${s.travelers} מטיילים</span><a href="#home">שינוי</a></div>
          <div class="field" style="flex:1;min-width:180px"><label for="stQ">חיפוש אתר</label><input class="input" id="stQ" type="search" placeholder="לדוגמה: Booking, איסתא, רכב" value="${esc(sitesState.q)}"></div>
        </div>
        <div id="sitesList"></div>
      </div>`;
    const draw = () => {
      const d = byId[sitesState.dest];
      const q = sitesState.q.trim().toLowerCase();
      const html = groups.map(g => {
        const items = g.items.filter(it => !q || (it.n + ' ' + it.d + ' ' + g.cat).toLowerCase().includes(q));
        if (!items.length) return '';
        return `<section class="sites-group"><h2>${esc(g.cat)}</h2><div class="site-links">${items.map(it => {
          const deep = it.deep && !(d.flightTime === 0 && ['skyscanner', 'gflights', 'kayak'].includes(it.deep));
          const href = deep ? siteUrl(it.deep, d, s) : it.u;
          return `<a class="site-link" href="${esc(href)}" target="_blank" rel="noopener">
            <span class="site-mark" aria-hidden="true">${esc(it.n.replace(/[^A-Za-zא-ת]/g, '').slice(0, 1).toUpperCase())}</span>
            <b>${esc(it.n)}</b><span>${esc(it.d)}</span>
            ${deep ? `<span class="chip chip-good" style="justify-self:start;margin-top:4px">${esc(d.name)} · ${fmt(s.start)}–${fmt(s.end)}</span>` : ''}
          </a>`;
        }).join('')}</div></section>`;
      }).join('');
      $('#sitesList').innerHTML = html || '<div class="empty">לא נמצאו אתרים.</div>';
    };
    $('#stDest').onchange = (e) => { sitesState.dest = e.target.value; draw(); };
    $('#stQ').oninput = (e) => { sitesState.q = e.target.value; draw(); };
    draw();
  }

  /* =========================================================
     ישראל: כל הלינה בארץ (OpenStreetMap חי) וניווט בין מקומות
     ========================================================= */
  const IL = window.APP_IL || { regions: [], places: [], bus: [], rail: [], links: {} };
  const placeById = Object.fromEntries(IL.places.map(p => [p.id, p]));
  const REGION_LABEL = Object.fromEntries(IL.regions);
  function kmBetween(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearestPlace(c) {
    let best = IL.places[0], bd = Infinity;
    IL.places.forEach(p => { const k = kmBetween(c, p.c); if (k < bd) { bd = k; best = p; } });
    return { p: best, km: bd };
  }
  const waze = (c) => `https://waze.com/ul?ll=${c[0]},${c[1]}&navigate=yes`;
  const gdir = (from, to, mode) => `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from[0]},${from[1]}` : ''}&destination=${to[0]},${to[1]}&travelmode=${mode || 'driving'}`;
  const moovit = (from, fromName, to, toName) => `https://moovitapp.com/?to=${enc(toName)}&tll=${to[0]}_${to[1]}${from ? `&from=${enc(fromName)}&fll=${from[0]}_${from[1]}` : ''}&lang=he`;
  const safeWeb = (u) => { u = String(u || '').trim().split(';')[0]; if (!u) return ''; if (/^www\./i.test(u)) u = 'https://' + u; return /^https?:\/\//i.test(u) ? u : ''; };

  const OSM_KIND = { hotel: 'מלון', guest_house: 'צימר / בית הארחה', chalet: 'בקתה / צימר', hostel: 'אכסניה', motel: 'מוטל', apartment: 'דירת נופש', camp_site: 'קמפינג / חניון לילה' };
  const OSM_COLOR = { hotel: '#0F6E6C', guest_house: '#C0612B', chalet: '#8A4FB5', hostel: '#2F6FB3', motel: '#6B7A8F', apartment: '#B3862F', camp_site: '#3F8F3A' };
  const KIND_FILTERS = [['all', 'הכל'], ['hotel', 'מלונות'], ['zimmer', 'צימרים ובקתות'], ['hostel', 'אכסניות'], ['apartment', 'דירות נופש'], ['camp_site', 'קמפינג']];
  const kindMatch = (x, k) => k === 'all' || (k === 'zimmer' ? (x.k === 'guest_house' || x.k === 'chalet') : k === 'hostel' ? (x.k === 'hostel' || x.k === 'motel') : x.k === k);
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  const OSM_Q = '[out:json][timeout:90];area["ISO3166-1"="IL"][admin_level=2]->.il;(nwr["tourism"~"^(hotel|guest_house|hostel|chalet|motel|apartment|camp_site)$"](area.il););out center tags;';
  const ilStays = { osm: null, loading: null, src: '', date: '', err: '' };

  function slimOsm(e) {
    const t = e.tags || {};
    const c = e.lat != null ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null;
    const name = t['name:he'] || t.name || t['name:en'];
    if (!name || !c || t.disused || t['disused:tourism']) return null;
    const np = nearestPlace(c);
    const city = t['addr:city'] || t['addr:place'] || '';
    const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    return {
      id: e.type[0] + e.id, n: name, en: t['name:en'] && t['name:en'] !== name ? t['name:en'] : '',
      k: t.tourism, c: [+c[0].toFixed(5), +c[1].toFixed(5)], city, addr: [street, city].filter(Boolean).join(', '),
      ph: (t.phone || t['contact:phone'] || t['contact:mobile'] || '').split(';')[0].trim(),
      web: safeWeb(t.website || t['contact:website'] || t.url), st: parseFloat(t.stars) || 0,
      img: /^https:\/\//.test(t.image || '') ? t.image : '', wc: /^File:/i.test(t.wikimedia_commons || '') ? t.wikimedia_commons.slice(5) : '',
      wd: /^Q\d+$/.test(t.wikidata || '') ? t.wikidata : '', near: np.p.id, r: np.p.r
    };
  }
  /* המקומות שנבדקו ידנית ביעדי הארץ — תמיד מוצגים, וגם כגיבוי כשאין חיבור ל-OpenStreetMap */
  const CUR_KIND = { zimmer: 'guest_house', farm: 'guest_house', kibbutz: 'guest_house', cabins: 'chalet', lodge: 'chalet', hostel: 'hostel' };
  const curatedStays = DESTS.filter(d => d.region === 'il').flatMap(d => d.hotels.map((h, i) => {
    const np = nearestPlace(d.coords);
    return { id: 'cur-' + d.id + '-' + i, n: h.name, en: '', k: CUR_KIND[h.kind] || 'hotel', c: d.coords, approx: true, city: h.area, addr: h.addr || '', ph: h.phone || '', web: h.web || '', st: 0, img: '', wc: '', wd: '', near: np.p.id, r: np.p.r, cur: true, dest: d.id, price: h.price, note: h.note, tier: h.tier };
  }));

  function loadIlStays() {
    if (ilStays.osm) return Promise.resolve(ilStays.osm);
    if (ilStays.loading) return ilStays.loading;
    const cached = store.get('ilStays', null);
    if (cached && cached.list && Date.now() - cached.t < 7 * 864e5) {
      ilStays.osm = cached.list; ilStays.src = 'cache'; ilStays.date = new Date(cached.t).toLocaleDateString('he-IL');
      return Promise.resolve(ilStays.osm);
    }
    if (!window.fetch) return Promise.reject(new Error('no fetch'));
    const tryAt = (i) => {
      if (i >= OVERPASS.length) return Promise.reject(new Error('all mirrors failed'));
      const ctl = window.AbortController ? new AbortController() : null;
      const t = ctl && setTimeout(() => ctl.abort(), 75000);
      return fetch(OVERPASS[i], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + enc(OSM_Q), signal: ctl ? ctl.signal : undefined })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
        .then(j => { if (!j || !Array.isArray(j.elements) || !j.elements.length) throw new Error('empty'); return j; })
        .finally(() => t && clearTimeout(t))
        .catch(() => tryAt(i + 1));
    };
    ilStays.loading = tryAt(0).then(j => {
      const list = j.elements.map(slimOsm).filter(Boolean);
      ilStays.osm = list; ilStays.src = 'live'; ilStays.date = new Date().toLocaleDateString('he-IL');
      store.set('ilStays', { t: Date.now(), list });
      return list;
    }).catch(err => { ilStays.err = String(err.message || err); ilStays.loading = null; throw err; });
    return ilStays.loading;
  }
  function allIlStays() {
    const osm = ilStays.osm || [];
    const names = new Set(osm.flatMap(x => [x.n, x.en].filter(Boolean).map(v => v.toLowerCase())));
    return curatedStays.filter(x => !names.has(x.n.toLowerCase())).concat(osm);
  }

  const staysState = { r: 'all', k: 'all', q: '', phone: false, sort: 'rec', shown: 48 };
  let ilMap = null, ilLayer = null;
  const wdImg = {};
  function stayScore(x) { return (x.cur ? 100 : 0) + (x.ph ? 8 : 0) + (x.web ? 6 : 0) + (x.addr ? 3 : 0) + (x.img || x.wc || x.wd ? 5 : 0) + x.st; }
  function filteredStays() {
    const q = staysState.q.trim().toLowerCase();
    const list = allIlStays().filter(x => (staysState.r === 'all' || x.r === staysState.r) && kindMatch(x, staysState.k) && (!staysState.phone || x.ph)
      && (!q || [x.n, x.en, x.city, x.addr, (placeById[x.near] || {}).name].join(' ').toLowerCase().includes(q)));
    const by = { rec: (a, b) => stayScore(b) - stayScore(a), name: (a, b) => a.n.localeCompare(b.n, 'he'), stars: (a, b) => (b.st - a.st) || (stayScore(b) - stayScore(a)) }[staysState.sort];
    return list.sort(by);
  }
  const stayDates = () => (st.end ? st : { ...st, end: addDays(st.start, 2) });
  function stayDealText(x, s) {
    const p = placeById[x.near] || {};
    return [`בקשת דיל ללינה בארץ`, `מקום: ${x.n}${x.city ? ' · ' + x.city : ''} (${p.name || ''})`, x.ph ? `טלפון המקום: ${x.ph}` : '', `תאריכים: ${fmt(s.start)}.${s.start.getFullYear()} – ${fmt(s.end)}.${s.end.getFullYear()} · ${nightsOf(s)} לילות`, `מטיילים: ${s.travelers}`, 'אשמח להצעת מחיר / דיל.'].filter(Boolean).join('\n');
  }
  function stayCard(x, s) {
    const p = placeById[x.near] || { name: '' };
    const kname = OSM_KIND[x.k] || 'לינה';
    const where = x.city || p.name;
    const q = x.n + ' ' + (x.en ? x.en + ' ' : '') + where;
    const photo = x.img || (x.wc ? commonsImg(x.wc, 640) : '') || wdImg[x.wd] || '';
    const book = `https://www.booking.com/searchresults.he.html?ss=${enc(x.n + ' ' + where)}&checkin=${iso(s.start)}&checkout=${iso(s.end)}&group_adults=${s.travelers}&no_rooms=${Math.ceil(s.travelers / 2)}${PT.bookingAid ? '&aid=' + enc(PT.bookingAid) : ''}`;
    const text = stayDealText(x, s);
    const wa = AG.whatsapp ? `https://wa.me/${String(AG.whatsapp).replace(/\D/g, '')}?text=${enc(text)}` : AG.email ? `mailto:${AG.email}?subject=${enc('בקשת דיל: ' + x.n)}&body=${enc(text)}` : '';
    return `<article class="stay-card" data-sid="${esc(x.id)}">
      <div class="sc-img" style="--k:${OSM_COLOR[x.k] || '#0F6E6C'}">
        <span class="sc-glyph" aria-hidden="true">${x.k === 'camp_site' ? '⛺' : x.k === 'hotel' ? '🏨' : x.k === 'hostel' ? '🛏' : '🏡'}</span>
        ${photo ? `<img class="photo" src="${esc(photo)}" alt="${esc(x.n)}" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="sc-body">
        <div class="sc-top"><span class="tier kind">${esc(kname)}</span>${x.st ? `<span class="tier">${'★'.repeat(Math.min(5, Math.round(x.st)))}</span>` : ''}${x.cur ? '<span class="tier tier-lux">נבדק ע״י הצוות</span>' : ''}</div>
        <h3 dir="auto">${esc(x.n)}</h3>
        ${x.en ? `<div class="fine" dir="ltr">${esc(x.en)}</div>` : ''}
        <div class="fine">${esc(p.name ? (x.city && x.city !== p.name ? x.city + ' · ליד ' + p.name : 'ליד ' + p.name) : x.city)} · ${esc(REGION_LABEL[x.r] || '')}</div>
        ${x.note ? `<div class="fine">${esc(x.note)}${x.price ? ` · <b class="num">כ-${money(x.price)}</b> ללילה (משוער)` : ''}</div>` : ''}
        ${contactHTML({ name: x.n, addr: x.addr, phone: x.ph, web: x.web })}
        <div class="sc-actions">
          ${x.approx ? '' : ext(waze(x.c), 'Waze', 'btn btn-sm')}
          ${ext(x.approx ? `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}` : gdir(null, x.c), 'ניווט Google', 'btn btn-sm btn-ghost')}
          <a class="btn btn-sm btn-ghost" href="#go" data-goto="${esc(x.id)}">איך מגיעים (רכב / אוטובוס)</a>
        </div>
        <div class="sc-actions">
          ${ext(book, 'דילים ומחירים · Booking', 'btn btn-sm btn-primary')}
          ${ext(`https://www.google.com/travel/search?q=${enc(q)}`, 'השוואת מחירים · Google', 'btn btn-sm btn-ghost')}
          ${ext(gmaps(q), 'תמונות וביקורות עדכניות', 'btn btn-sm btn-ghost')}
          ${wa ? ext(wa, 'דיל דרך הסוכן', 'btn btn-sm btn-deal') : ''}
        </div>
      </div>
    </article>`;
  }
  function fillWikidataPhotos(root) {
    $$('.stay-card', root).forEach(card => {
      const x = stayIndex[card.dataset.sid];
      if (!x || !x.wd || x.img || x.wc || wdImg[x.wd] === '' || !window.fetch) return;
      if (wdImg[x.wd]) return;
      wdImg[x.wd] = '';
      fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${x.wd}&property=P18&format=json&origin=*`)
        .then(r => r.json()).then(j => {
          const f = (((j.claims || {}).P18 || [])[0] || {}).mainsnak;
          const file = f && f.datavalue && f.datavalue.value;
          if (!file) return;
          wdImg[x.wd] = commonsImg(file, 640);
          const box = $(`.stay-card[data-sid="${x.id}"] .sc-img`);
          if (box && !box.querySelector('img')) box.insertAdjacentHTML('beforeend', `<img class="photo" src="${esc(wdImg[x.wd])}" alt="${esc(x.n)}" loading="lazy">`);
        }).catch(() => {});
    });
  }
  let stayIndex = {};

  function renderStays() {
    const el = $('#view-stays');
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">לינה בכל הארץ</span>
            <h1 class="h-section">כל המלונות והצימרים בישראל</h1>
            <p class="lead">מלונות, צימרים, בקתות, אכסניות, דירות נופש וחניוני לילה מכל האזורים, עם כתובת, טלפון, אתר, מפה וניווט. לכל מקום יש קישור לדילים ולמחירים לתאריכים שלכם, ואפשר לבקש דיל דרך הסוכן.</p>
          </div>
        </div>
        <div class="panel sites-bar stays-bar">
          <div class="field"><label for="syRegion">אזור</label>
            <select class="input" id="syRegion"><option value="all">כל הארץ</option>${IL.regions.map(([k, v]) => `<option value="${k}" ${staysState.r === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div class="field" style="flex:1;min-width:180px"><label for="syQ">חיפוש לפי שם או יישוב</label><input class="input" id="syQ" type="search" placeholder="לדוגמה: ראש פינה, מלון דן, צימר" value="${esc(staysState.q)}"></div>
          <div class="field"><label for="sySort">מיון</label>
            <select class="input" id="sySort">${[['rec', 'הכי מפורטים קודם'], ['stars', 'כוכבים'], ['name', 'שם']].map(([k, v]) => `<option value="${k}" ${staysState.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" id="syPhone" ${staysState.phone ? 'checked' : ''}> רק עם טלפון</label>
          <div class="date-pill"><span class="num">${fmt(stayDates().start)} – ${fmt(stayDates().end)}</span><span>${st.travelers} מטיילים</span><a href="#home">שינוי</a></div>
        </div>
        <div class="seg" id="syKind" style="margin:8px 0 12px">${KIND_FILTERS.map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${staysState.k === k}">${v}</button>`).join('')}</div>
        <p class="fine" id="syStatus" aria-live="polite"></p>
        <div class="map-box stays-map" dir="ltr">
          <div id="ilMap" style="width:100%;height:100%"></div>
          <div class="map-fallback" id="ilMapFallback" hidden dir="rtl"><div><strong>המפה לא נטענה בסביבה הזו</strong><div class="fine">בכל כרטיס יש כפתורי ניווט ב-Waze וב-Google Maps.</div></div></div>
        </div>
        <div class="stay-grid mt" id="syList"></div>
        <div class="center mt"><button type="button" class="btn" id="syMore" hidden>עוד מקומות</button></div>
        <div class="card mt">
          <h3>איך עובדים הדילים?</h3>
          <p class="fine">המחירים משתנים כל יום ולכן לא מוצגים כאן מחירים קבועים. "דילים ומחירים" פותח את Booking עם השם והתאריכים שלכם, "השוואת מחירים" פותח את Google שמשווה בין אתרי ההזמנה, ו"דיל דרך הסוכן" שולח לסוכן בקשה עם כל הפרטים לקבלת הצעה. לצימרים קטנים הכי משתלם להתקשר ישירות למספר שבכרטיס.</p>
          <p class="fine">מקור הרשימה: OpenStreetMap (© תורמי OpenStreetMap, רישיון ODbL) — מאגר פתוח שמתעדכן כל הזמן. מקומות מסומנים "נבדק ע״י הצוות" נבדקו ידנית. פרטים במאגר הפתוח עלולים להיות חסרים או לא מעודכנים; מומלץ לאמת בטלפון לפני הגעה.</p>
        </div>
      </div>`;
    const draw = (fit) => {
      const s = stayDates();
      const list = filteredStays();
      stayIndex = Object.fromEntries(list.map(x => [x.id, x]));
      const shown = list.slice(0, staysState.shown);
      $('#syList').innerHTML = shown.length ? shown.map(x => stayCard(x, s)).join('') : '<div class="empty">לא נמצאו מקומות. נסו אזור או סינון אחר.</div>';
      const more = $('#syMore'); more.hidden = list.length <= staysState.shown; more.textContent = `עוד מקומות (${list.length - shown.length})`;
      const src = ilStays.osm ? `${ilStays.src === 'live' ? 'עודכן עכשיו' : 'עודכן ב-' + ilStays.date} מ-OpenStreetMap` : ilStays.loading ? 'טוען את כל מקומות הלינה בארץ מ-OpenStreetMap…' : 'מוצגים רק המקומות שנבדקו ידנית — הרשימה המלאה נטענת מהאינטרנט (באתר החי ב-GitHub Pages).';
      $('#syStatus').innerHTML = `<b class="num">${list.length.toLocaleString('he-IL')}</b> מקומות לינה${staysState.r !== 'all' ? ' ב' + esc(REGION_LABEL[staysState.r]) : ' בכל הארץ'} · ${src}`;
      drawIlMarkers(list, fit);
      fillWikidataPhotos($('#syList'));
    };
    initIlMap();
    $('#syRegion').onchange = (e) => { staysState.r = e.target.value; staysState.shown = 48; draw(true); };
    $('#sySort').onchange = (e) => { staysState.sort = e.target.value; draw(); };
    $('#syPhone').onchange = (e) => { staysState.phone = e.target.checked; staysState.shown = 48; draw(); };
    $('#syQ').oninput = (e) => { staysState.q = e.target.value; staysState.shown = 48; clearTimeout(draw._t); draw._t = setTimeout(() => draw(true), 250); };
    $('#syKind').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; staysState.k = b.dataset.v; staysState.shown = 48; $$('#syKind button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); };
    $('#syMore').onclick = () => { staysState.shown += 48; draw(); };
    draw(true);
    if (!ilStays.osm) loadIlStays().then(() => { if (!$('#view-stays').hidden) draw(true); }, () => { if (!$('#view-stays').hidden) draw(); });
  }
  function initIlMap() {
    if (ilMap) { ilMap.remove(); ilMap = null; }
    if (!window.L) { $('#ilMapFallback').hidden = false; return; }
    ilMap = L.map('ilMap', { scrollWheelZoom: false, preferCanvas: true }).setView([31.5, 34.9], 7);
    let ok = 0, bad = 0;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(ilMap);
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', () => { bad++; if (bad >= 4 && ok === 0) $('#ilMapFallback').hidden = false; });
    ilLayer = L.layerGroup().addTo(ilMap);
  }
  function drawIlMarkers(list, fit) {
    if (!ilMap || !ilLayer) return;
    ilLayer.clearLayers();
    const pts = [];
    list.filter(x => !x.approx).forEach(x => {
      const p = placeById[x.near] || {};
      L.circleMarker(x.c, { radius: 6, color: '#fff', weight: 1.5, fillColor: OSM_COLOR[x.k] || '#0F6E6C', fillOpacity: .9 })
        .bindPopup(`<div dir="rtl" style="min-width:180px"><b>${esc(x.n)}</b><br><span>${esc(OSM_KIND[x.k] || '')} · ${esc(x.city || p.name || '')}</span>${x.ph ? `<br><a href="${telHref(x.ph)}" dir="ltr">${esc(x.ph)}</a>` : ''}<br><a href="${esc(waze(x.c))}" target="_blank" rel="noopener">Waze</a> · <a href="${esc(gdir(null, x.c))}" target="_blank" rel="noopener">Google</a> · <a href="#go" data-goto="${esc(x.id)}">איך מגיעים</a></div>`)
        .addTo(ilLayer);
      pts.push(x.c);
    });
    if (fit) {
      if (staysState.r !== 'all' && pts.length > 1) ilMap.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
      else if (staysState.r === 'all') ilMap.setView([31.5, 34.9], 7);
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]'); if (!a) return;
    const x = stayIndex[a.dataset.goto] || allIlStays().find(y => y.id === a.dataset.goto);
    if (!x) return;
    goState.to = 'custom'; goState.toCustom = { name: x.n, c: x.c, approx: !!x.approx, q: x.n + ' ' + (x.city || '') };
  });

  /* ---------- ניווט בארץ ---------- */
  const goState = { from: 'tlv', to: 'eilat', fromCustom: null, toCustom: null };
  let goMap = null;
  const osrmCache = {};
  const goPoint = (which) => {
    const v = goState[which], cu = goState[which + 'Custom'];
    if ((v === 'custom' || v === 'me') && cu) return { id: v, name: cu.name, c: cu.c, approx: cu.approx, q: cu.q, near: nearestPlace(cu.c).p };
    const p = placeById[v] || IL.places[0];
    return { id: p.id, name: p.name, c: p.c, near: p };
  };
  function busBetween(a, b) {
    return IL.bus.filter(l => (l.a === a && l.b.includes(b)) || (l.a === b && l.b.includes(a)))
      .map(l => ({ ...l, rev: l.a !== a }));
  }
  function busTransfers(a, b) {
    const out = [];
    IL.places.forEach(h => {
      if (h.id === a || h.id === b) return;
      const x = busBetween(a, h.id), y = busBetween(h.id, b);
      if (x.length && y.length) out.push({ hub: h, x: x[0], y: y[0] });
    });
    return out.slice(0, 3);
  }
  const railBetween = (a, b) => IL.rail.find(r => (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a));
  const busLi = (l, fromName) => `<li><div><div class="t"><span class="bus-no">${esc(l.lines)}</span> ${esc(l.op)}</div>
      <div class="s">${l.rev ? `בכיוון ההפוך: יוצא מ${esc(fromName)} (בדקו את התחנה ב-Moovit)` : `יוצא מ: ${esc(l.from)}`} · ${esc(l.time)}</div>${l.note ? `<div class="s">${esc(l.note)}</div>` : ''}</div></li>`;

  function renderGo(arg) {
    if (arg && placeById[arg]) { goState.to = arg; goState.toCustom = null; }
    const el = $('#view-go');
    const opts = (which) => {
      const cur = goState[which], cu = goState[which + 'Custom'];
      return (cu && (cur === 'custom' || cur === 'me') ? `<option value="${cur}" selected>${esc(cu.name)}</option>` : '')
        + (which === 'from' ? '<option value="me">📍 המיקום שלי</option>' : '')
        + IL.regions.map(([rk, rv]) => `<optgroup label="${esc(rv)}">${IL.places.filter(p => p.r === rk).map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
    };
    el.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">דרכי הגעה בארץ</span>
            <h1 class="h-section">ניווט ממקום למקום</h1>
            <p class="lead">בוחרים מאיפה ולאן, ומקבלים מסלול ברכב על המפה עם מרחק וזמן, כפתורי Waze ו-Google Maps, וקווי האוטובוס והרכבת שמחברים בין המקומות.</p>
          </div>
        </div>
        <div class="panel sites-bar go-bar">
          <div class="field"><label for="goFrom">מאיפה</label><select class="input" id="goFrom">${opts('from')}</select></div>
          <button type="button" class="btn btn-ghost" id="goSwap" aria-label="החלפת כיוון">⇄</button>
          <div class="field"><label for="goTo">לאן</label><select class="input" id="goTo">${opts('to')}</select></div>
        </div>
        <div class="grid-2 mt">
          <div class="stack-v">
            <div class="card" id="goCar"></div>
            <div class="card" id="goBus"></div>
          </div>
          <div class="map-box" dir="ltr">
            <div id="goMap" style="width:100%;height:100%"></div>
            <div class="map-fallback" id="goMapFallback" hidden dir="rtl"><div><strong>המפה לא נטענה בסביבה הזו</strong><div class="fine">כפתורי Waze ו-Google Maps פותחים את המסלול.</div></div></div>
          </div>
        </div>
        <div class="card mt">
          <h3>קווי אוטובוס בין-עירוניים עיקריים</h3>
          <div class="table-wrap"><table class="bus-table">
            <thead><tr><th>קו</th><th>מפעיל</th><th>בין</th><th>יוצא מ</th><th>זמן</th><th>הערות</th></tr></thead>
            <tbody>${IL.bus.map(l => `<tr><td><span class="bus-no">${esc(l.lines)}</span></td><td>${esc(l.op)}</td><td>${esc(placeById[l.a].name)} ↔ ${l.b.map(b => esc(placeById[b].name)).join(', ')}</td><td>${esc(l.from)}</td><td style="white-space:nowrap">${esc(l.time)}</td><td class="fine">${esc(l.note)}</td></tr>`).join('')}</tbody>
          </table></div>
          <h3 class="mt">רכבת ישראל</h3>
          <ul class="list">${IL.rail.map(r => `<li><span class="t">${esc(placeById[r[0]].name)} ↔ ${esc(placeById[r[1]].name)}</span><span class="fine">${esc(r[2])}${r[3] ? ' · ' + esc(r[3]) : ''}</span></li>`).join('')}</ul>
          <p class="fine mt">קווים, רציפים ולוחות זמנים משתנים, ורוב הקווים והרכבת לא פועלים בשבת ובחגים. לפני נסיעה בדקו ב-${ext(IL.links.moovit, 'Moovit')}, ב-${ext(IL.links.egged, 'אגד')} (כולל הזמנת מקום לאילת) וב-${ext(IL.links.rail, 'רכבת ישראל')}. התשלום באוטובוס ברב-קו, באפליקציה או בכרטיס אשראי ללא מגע.</p>
        </div>
      </div>`;
    const onPick = (which) => (e) => {
      const v = e.target.value;
      if (v === 'me') {
        if (!navigator.geolocation) { toast('הדפדפן לא תומך במיקום'); return; }
        toast('מאתר מיקום…');
        navigator.geolocation.getCurrentPosition(pos => {
          goState[which] = 'me'; goState[which + 'Custom'] = { name: 'המיקום שלי', c: [+pos.coords.latitude.toFixed(5), +pos.coords.longitude.toFixed(5)] };
          renderGo();
        }, () => toast('לא הצלחנו לאתר מיקום. בחרו יישוב מהרשימה.'), { timeout: 10000 });
        return;
      }
      goState[which] = v; if (v !== 'custom') goState[which + 'Custom'] = null;
      drawGo();
    };
    $('#goFrom').onchange = onPick('from');
    $('#goTo').onchange = onPick('to');
    $('#goSwap').onclick = () => { [goState.from, goState.to] = [goState.to, goState.from]; [goState.fromCustom, goState.toCustom] = [goState.toCustom, goState.fromCustom]; renderGo(); };
    if (goMap) { goMap.remove(); goMap = null; }
    if (window.L) {
      goMap = L.map('goMap', { scrollWheelZoom: false }).setView([31.5, 34.9], 7);
      let ok = 0, bad = 0;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(goMap);
      tiles.on('tileload', () => { ok++; });
      tiles.on('tileerror', () => { bad++; if (bad >= 4 && ok === 0) $('#goMapFallback').hidden = false; });
      goMap._route = L.layerGroup().addTo(goMap);
    } else $('#goMapFallback').hidden = false;
    drawGo();
  }

  function drawGo() {
    const A = goPoint('from'), B = goPoint('to');
    const car = $('#goCar'), bus = $('#goBus'); if (!car) return;
    const air = kmBetween(A.c, B.c);
    const estKm = air * 1.3, estMin = estKm / 70 * 60;
    const dur = (m) => m >= 60 ? `${Math.floor(m / 60)} ש׳ ${pad(Math.round(m % 60))} דק׳` : `${Math.round(m)} דק׳`;
    const same = A.c[0] === B.c[0] && A.c[1] === B.c[1];
    const destQ = B.approx ? B.q : null;
    const carHTML = (kmv, min, live) => `
      <div class="row"><h3>ברכב פרטי</h3><span class="chip ${live ? 'chip-good' : ''}">${live ? 'מסלול אמיתי' : 'הערכה'}</span></div>
      <div class="go-stats"><div><span class="fine">מרחק</span><b class="num">${Math.round(kmv)} ק״מ</b></div><div><span class="fine">זמן נסיעה</span><b class="num">${dur(min)}</b></div></div>
      <p class="fine">${esc(A.name)} ← ${esc(B.name)} · בלי פקקים. ${live ? '' : 'המסלול המדויק נטען מהאינטרנט באתר החי.'} ${B.approx ? 'מיקום היעד משוער — Google ימצא את הכתובת לפי השם.' : ''}</p>
      <div class="sc-actions">
        ${B.approx ? '' : ext(waze(B.c), 'ניווט ב-Waze', 'btn btn-sm btn-primary')}
        ${ext(destQ ? `https://www.google.com/maps/dir/?api=1&origin=${A.c[0]},${A.c[1]}&destination=${enc(destQ)}&travelmode=driving` : gdir(A.c, B.c, 'driving'), 'Google Maps', 'btn btn-sm btn-ghost')}
      </div>
      <p class="fine">כביש 6 הוא כביש אגרה (חיוב אוטומטי לפי לוחית רישוי). ברכב שכור האגרה מחויבת דרך חברת ההשכרה.</p>`;
    car.innerHTML = same ? '<h3>ברכב פרטי</h3><p class="fine">בחרו מוצא ויעד שונים.</p>' : carHTML(estKm, estMin, false);

    /* תחבורה ציבורית */
    const a = A.near.id, b = B.near.id;
    const direct = a === b ? [] : busBetween(a, b);
    const rail = a === b ? null : railBetween(a, b);
    const bothRail = A.near.rail && B.near.rail && a !== b;
    const tr = direct.length || rail ? [] : busTransfers(a, b);
    const nearNote = [A, B].filter(x => x.id === 'custom' || x.id === 'me').map(x => `הקרוב ל${esc(x.name)}: ${esc(x.near.name)}`).join(' · ');
    bus.innerHTML = same ? '' : `
      <h3>בתחבורה ציבורית</h3>
      ${nearNote ? `<p class="fine">${nearNote}</p>` : ''}
      ${direct.length ? `<ul class="list">${direct.map(l => busLi(l, A.near.name)).join('')}</ul>` : ''}
      ${rail ? `<ul class="list"><li><div><div class="t"><span class="bus-no">🚆</span> רכבת ישראל</div><div class="s">${esc(A.near.name)} ↔ ${esc(B.near.name)} · ${esc(rail[2])}${rail[3] ? ' · ' + esc(rail[3]) : ''}</div></div></li></ul>`
        : bothRail ? `<p class="fine">🚆 יש תחנות רכבת בשני המקומות — בדקו חיבור (לפעמים עם החלפה) ב-${ext(IL.links.rail, 'רכבת ישראל')}.</p>` : ''}
      ${tr.length ? `<p class="fine">אין קו ישיר בטבלה שלנו. אפשרות עם החלפה:</p><ul class="list">${tr.map(t => `<li><div><div class="t">דרך ${esc(t.hub.name)}</div><div class="s"><span class="bus-no">${esc(t.x.lines)}</span> עד ${esc(t.hub.name)}, ומשם <span class="bus-no">${esc(t.y.lines)}</span></div></div></li>`).join('')}</ul>` : ''}
      ${!direct.length && !rail && !tr.length && !bothRail ? '<p class="fine">אין לנו קו ישיר בטבלה בין המקומות האלה. Moovit ו-Google יציגו את כל הקווים והחיבורים העדכניים.</p>' : ''}
      <div class="sc-actions">
        ${ext(moovit(A.c, A.name, B.c, B.name), 'קווים ושעות ב-Moovit', 'btn btn-sm btn-primary')}
        ${ext(destQ ? `https://www.google.com/maps/dir/?api=1&origin=${A.c[0]},${A.c[1]}&destination=${enc(destQ)}&travelmode=transit` : gdir(A.c, B.c, 'transit'), 'תחבורה ציבורית ב-Google', 'btn btn-sm btn-ghost')}
      </div>
      <p class="fine">רוב הקווים והרכבת לא פועלים בשבת ובחגים.</p>`;

    if (goMap) {
      const layer = goMap._route; layer.clearLayers();
      const pin = (n) => L.divIcon({ className: '', html: `<div class="pin"><span>${n}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
      L.marker(A.c, { icon: pin('א') }).addTo(layer).bindPopup(esc(A.name));
      L.marker(B.c, { icon: pin('ב') }).addTo(layer).bindPopup(esc(B.name));
      if (!same) goMap.fitBounds([A.c, B.c], { padding: [40, 40] });
    }
    if (same || !window.fetch) return;
    const key = A.c.join() + '|' + B.c.join();
    const apply = (r) => {
      if (!r || $('#goCar') !== car) return;
      car.innerHTML = carHTML(r.km, r.min, true);
      if (goMap) { L.polyline(r.line, { color: '#0F6E6C', weight: 5, opacity: .85 }).addTo(goMap._route); goMap.fitBounds(r.line, { padding: [30, 30] }); }
    };
    if (osrmCache[key]) { apply(osrmCache[key]); return; }
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), 12000);
    fetch(`https://router.project-osrm.org/route/v1/driving/${A.c[1]},${A.c[0]};${B.c[1]},${B.c[0]}?overview=full&geometries=geojson`, { signal: ctl ? ctl.signal : undefined })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => {
        const rt = j.routes && j.routes[0]; if (!rt) return;
        osrmCache[key] = { km: rt.distance / 1000, min: rt.duration / 60, line: rt.geometry.coordinates.map(p => [p[1], p[0]]) };
        if (goPoint('from').c === A.c && goPoint('to').c === B.c) apply(osrmCache[key]);
      })
      .catch(() => {})
      .finally(() => t && clearTimeout(t));
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
    if (st.types.includes('religious')) items.push(d.region === 'il' ? 'לתכנן הגעה לפני שבת (אין תחבורה ציבורית)' : 'לבדוק בית חב״ד וזמני שבת ביעד');
    if (st.kids > 0) items.push('עגלה, כיסא בטיחות ופעילויות לילדים');
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
        <a class="trip-art" href="#dest-${d.id}" aria-label="${esc(d.name)}">${poster(d, 240, 320)}${photoTag(d, 400, 0)}</a>
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
    ['איך מזמינים?', BRAND + ' לא מוכר כרטיסים. כל כפתור הזמנה פותח את האתר של הספק (Skyscanner, Booking, Airbnb, Kayak ועוד) עם היעד והתאריכים שלכם, ושם משלמים.'],
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
    if (has('מטבע', 'כסף', 'שער', 'מזומן', 'כספומט', 'להמיר')) {
      if (!d) return need('כסף ומטבע');
      const c = MONEY.currencies[d.currency.code] || {};
      return `<b>כסף ב${esc(d.country)}:</b> ${esc(d.currency.name)} (${esc(d.currency.code)}${c.symbol ? ' ' + esc(c.symbol) : ''}). 1 ${esc(d.currency.code)} ≈ ₪${fmtRate(rateOf(d))}.<br>${esc((MONEY.byDest[d.id] || {}).pay || '')}<br><a href="#dest-${d.id}.money">ממיר ומחירים טיפוסיים</a>`;
    }
    if (has('טלפון', 'כתובת', 'איש קשר', 'אנשי קשר', 'ליצור קשר')) {
      if (!d) return need('אנשי קשר');
      return `כתובות וטלפונים של מלונות ומסעדות ב${esc(d.name)}: <a href="#dest-${d.id}.contacts">לרשימה המלאה</a>`;
    }
    if (has('דיל', 'לסגור', 'להזמין', 'הזמנה', 'סוכן')) {
      if (d) { dealState.dest = d.id; dealState.hotel = 0; dealState.id = null; }
      return `בעמוד <a href="#deal">סגירת דיל</a> בוחרים מלון, טיסה, רכב ותוספות, ומקבלים סיכום עם מספר דיל. משם סוגרים מול הסוכן או מזמינים ישירות אצל הספקים.`;
    }
    if (has('כשר')) {
      if (!d) return need('מסעדות כשרות');
      return `<b>אוכל כשר ב${esc(d.name)}</b><br>${esc(d.kosherNote)}<br>${d.kosher.map(r => `• ${esc(r.name)} — ${esc(r.area)}`).join('<br>')}<br><a href="#dest-${d.id}.food">לכל המסעדות</a>`;
    }
    if (has('מישלן', 'כוכב', 'שף')) {
      if (!d) return need('מסעדות מישלן');
      if (!d.michelin.length) return `${esc(d.michelinNote)}<br>${d.food.map(r => `• ${esc(r.name)} — ${esc(r.type)}`).join('<br>')}`;
      return `<b>מישלן ב${esc(d.name)}</b><br>${d.michelin.map(r => `• ${esc(r.name)} — ${'✦'.repeat(r.stars)} ${esc(r.cuisine)}`).join('<br>')}<br><a href="#dest-${d.id}.food">פרטים</a>`;
    }
    if (has('איך מגיעים', 'איך להגיע', 'ניווט', 'קו ', 'קווים', 'אוטובוס ל', 'לנסוע מ')) {
      const found = IL.places.filter(p => q.includes(p.name.split(' (')[0])).sort((x, y) => q.indexOf(x.name.split(' (')[0]) - q.indexOf(y.name.split(' (')[0]));
      if (found.length >= 2) { goState.from = found[0].id; goState.to = found[1].id; goState.fromCustom = goState.toCustom = null; }
      else if (found.length === 1) { goState.to = found[0].id; goState.toCustom = null; }
      if (!found.length && !(d && d.region === 'il')) return 'בעמוד <a href="#go">ניווט בארץ</a> בוחרים מאיפה ולאן, ומקבלים מסלול ברכב, Waze וקווי אוטובוס ורכבת.';
      if (!found.length) { const p = IL.places.find(x => x.dest === d.id); if (p) goState.to = p.id; }
      const A = goPoint('from'), B = goPoint('to');
      const lines = busBetween(A.near.id, B.near.id);
      return `<b>${esc(A.name)} ← ${esc(B.name)}</b><br>${lines.length ? lines.map(l => `• קו ${esc(l.lines)} (${esc(l.op)}), ${esc(l.time)}`).join('<br>') : 'אין קו ישיר בטבלה שלנו — Moovit יציג חיבורים.'}<br><a href="#go">מסלול ברכב, Waze וכל האפשרויות</a>`;
    }
    if (has('כל המלונות', 'כל הצימרים', 'כל הלינה', 'לינה בארץ')) return 'בעמוד <a href="#stays">לינה בארץ</a> יש את כל המלונות, הצימרים, האכסניות והקמפינג בישראל, עם מפה, טלפונים, ניווט ודילים.';
    if (has('צימר', 'בקתה', 'בקתות', 'חווה')) {
      const pool = (d ? [d] : DESTS.filter(x => x.region === 'il')).flatMap(x => x.hotels.filter(h => stayMatches(h, 'zimmer')).map(h => ({ x, h })));
      if (!pool.length) return 'לא מצאתי צימרים ביעד הזה. נסו את הגליל והגולן או מצפה רמון.';
      st.stay = 'zimmer';
      return `<b>צימרים, בקתות וחוות אירוח:</b><br>${pool.slice(0, 6).map(({ x, h }) => `• <a href="#dest-${x.id}.hotels">${esc(h.name)}</a> — ${esc(x.name)}${h.phone ? ` · <span dir="ltr">${esc(h.phone)}</span>` : ''}`).join('<br>')}`;
    }
    if (has('בילוי', 'אטרקצי', 'מה לעשות', 'לילה', 'מוזיאון')) {
      const withFun = d ? (d.fun ? [d] : []) : DESTS.filter(x => x.fun);
      if (!withFun.length) return d ? `ב${esc(d.name)} כדאי לעבור על <a href="#dest-${d.id}.routes">המסלולים</a>.` : need('בילוי ואטרקציות');
      if (!d) return `בילוי ואטרקציות יש בכל יעדי הארץ: ${withFun.map(x => `<a href="#dest-${x.id}.fun">${esc(x.name)}</a>`).join(', ')}.`;
      return `<b>בילוי ב${esc(d.name)}:</b><br>${d.fun.map(f => `• ${esc(f.name)}${f.phone ? ` · <span dir="ltr">${esc(f.phone)}</span>` : ''}`).join('<br>')}<br><a href="#dest-${d.id}.fun">לכל האטרקציות</a>`;
    }
    const wantTypes = TRIP_TYPES.filter(([k]) => ({ family: ['משפח', 'ילד'], couple: ['זוג', 'רומנט', 'ירח דבש'], nature: ['טבע'], relax: ['ספא', 'רוגע', 'בטן גב'], culture: ['תרבות', 'היסטורי'], night: ['חיי לילה', 'מסיב'], food: ['קולינרי', 'אוכל טוב'], adventure: ['אקסטרים', 'הרפתק'], religious: ['שבת', 'דתי'] })[k].some(w => q.includes(w))).map(([k]) => k);
    if (wantTypes.length && !d) {
      st.types = [...new Set(st.types.concat(wantTypes))]; savePlan();
      const top = ranked(st, st.region).slice(0, 4);
      return `לחופשת ${wantTypes.map(t => TYPE_LABEL[t]).join(' + ')} הכי מתאימים עכשיו:<br>${top.map(({ d: x, e }) => `• <a href="#dest-${x.id}">${esc(x.name)}</a> — התאמה ${e.score}%${e.fit.good.length ? ' · ' + e.fit.good.map(t => TYPE_LABEL[t]).join(', ') : ''}`).join('<br>')}<br>סימנתי את זה גם ב<a href="#home">מתכנן</a>.`;
    }
    if (has('מלון', 'לינה', 'לישון')) {
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
    if (has('מסלול', 'טיול', 'לראות')) {
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

  const CHIPS = ['חופשה משפחתית בארץ', 'צימרים בגליל', 'מה לעשות באילת?', 'ספא ורוגע לזוג', 'איך מגיעים מתל אביב לאילת?', 'איזה כסף יש ביפן?'];
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
      if (!$('#chatLog').children.length) botSay('שלום! אני העוזר של ' + esc(BRAND) + '. אפשר לשאול אותי על כל יעד — מלונות, כשרות, מישלן, תחבורה, מזג אוויר, תקציב וזמני שדה תעופה.');
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
  /* תשובת הסוכן מ-n8n: טקסט עם **הדגשה**, קישורים ושורות — מומר ל-HTML בטוח */
  function agentHTML(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((#[\w.-]+|https?:\/\/[^\s)]+)\)/g, (m, label, href) => href[0] === '#' ? `<a href="${href}">${label}</a>` : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`)
      .replace(/\n/g, '<br>');
  }
  function ask(q) {
    botSay(esc(q), 'me');
    const local = () => botSay(answer(q));
    if (!N8N.base) { setTimeout(local, 250); return; }
    const typing = document.createElement('div');
    typing.className = 'msg bot typing'; typing.textContent = 'מקליד…';
    $('#chatLog').appendChild(typing);
    const page = (location.hash.match(/^#dest-([\w-]+)/) || [])[1] || '';
    n8nPost(N8N.chat, {
      sessionId, message: q,
      context: { page: location.hash || '#home', destination: page, plan: { start: iso(st.start), end: st.end ? iso(st.end) : null, travelers: st.travelers, style: st.style } }
    }, 45000).then(r => {
      typing.remove();
      const reply = r && (r.reply || r.output || r.text);
      if (reply) botSay(agentHTML(String(reply))); else local();
    }).catch(() => { typing.remove(); local(); });
  }

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
  $$('[data-brand]').forEach(e => { e.textContent = BRAND; });
  if (CFG.brand && CFG.brand.title) document.title = CFG.brand.title;
  initTheme();
  initChat();
  loadRates();
  const agl = $('#agencyLine');
  if (agl && (AG.name || AG.phone || AG.email)) agl.textContent = [AG.name, AG.phone, AG.email, AG.license ? 'רישיון ' + AG.license : ''].filter(Boolean).join(' · ');
  route();
})();
