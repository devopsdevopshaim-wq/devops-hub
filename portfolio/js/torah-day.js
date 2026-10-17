/* "היום והפרשה" on the main page: this week's Torah portion with Shabbat in and out times, quick access to the classic commentaries and to
   Talmud passages that touch the portion's first verse (live from Sefaria), a proverb for each day, and a day plan built around the day's
   halachic times. Times and the portion come from Hebcal; every part degrades to plain links when a service does not answer. */
(function () {
  'use strict';
  var root = document.getElementById('torah-day');
  if (!root) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('td-' + k); localStorage.setItem('td-' + k, v); } catch (e) { return null; } }
  function getJSON(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 9000);
    return fetch(url, { signal: ctl ? ctl.signal : undefined }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // ---------------------------------------------------------------- places (Hebcal geoname ids) and the candle-lighting minutes customary there
  var CITIES = { jer: ['ירושלים', 281184, 40], tlv: ['תל אביב', 293397, 18], hai: ['חיפה', 294801, 30], bsh: ['באר שבע', 295530, 18], rch: ['רחובות', 293788, 18], bnb: ['בני ברק', 295432, 18] };
  var city = store('city'); if (!CITIES[city]) city = 'jer';

  var DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  var fmtTime = function (d) { try { return new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }); } catch (e) { return ''; } };
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }

  // ---------------------------------------------------------------- Sefaria helpers
  var SEF = 'https://www.sefaria.org';
  function urlRef(ref) { return SEF + '/' + encodeURIComponent(String(ref).trim().replace(/ (\d)/, '.$1').replace(/:/g, '.').replace(/ /g, '_')).replace(/%2E/g, '.').replace(/%2C/g, ','); }
  var COMM = [
    ['רש״י', 'Rashi on '], ['רמב״ן', 'Ramban on '], ['אבן עזרא', 'Ibn Ezra on '], ['ספורנו', 'Sforno on '], ['אור החיים', 'Or HaChaim on '], ['כלי יקר', 'Kli Yakar on '],
    ['רשב״ם', 'Rashbam on '], ['חזקוני', 'Chizkuni, '], ['בעל הטורים', 'Baal HaTurim on '], ['רבנו בחיי', 'Rabbeinu Bahya, '], ['אונקלוס', 'Onkelos ']
  ];
  var BOOKS_HE = { Genesis: 'Bereshit', Exodus: 'Shemot', Leviticus: 'Vayikra', Numbers: 'Bamidbar', Deuteronomy: 'Devarim' };
  function commRef(c, book, ref) { return c[1] + (c[1].indexOf('Bahya') >= 0 ? (BOOKS_HE[book] || book) : book) + ' ' + ref; }
  function flat(x, out) { out = out || []; if (Array.isArray(x)) x.forEach(function (y) { flat(y, out); }); else if (typeof x === 'string' && x.trim()) out.push(x); return out; }
  function plain(h) { var d = document.createElement('div'); d.innerHTML = h; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function sefText(ref) {
    return getJSON(SEF + '/api/v3/texts/' + encodeURIComponent(ref) + '?version=hebrew', 10000).then(function (j) {
      var v = (j.versions || [])[0]; var parts = v ? flat(v.text) : [];
      return { heRef: j.heRef || '', text: parts.length ? plain(parts[0]) : '' };
    });
  }

  // ---------------------------------------------------------------- the weekly portion
  function loadShabbat() {
    var c = CITIES[city];
    var url = 'https://www.hebcal.com/shabbat?cfg=json&geonameid=' + c[1] + '&b=' + c[2] + '&M=on&lg=he';
    return getJSON(url).then(function (j) {
      var out = { city: c[0], parsha: null, candles: null, havdalah: null, leyning: null, link: '' };
      (j.items || []).forEach(function (it) {
        if (it.category === 'parashat' && !out.parsha) { out.parsha = it.hebrew || it.title; out.leyning = it.leyning || null; out.link = it.link || ''; }
        else if (it.category === 'candles' && !out.candles) out.candles = it.date;
        else if (it.category === 'havdalah' && !out.havdalah) out.havdalah = it.date;
      });
      return out;
    });
  }

  function parseRef(ref) { // "Genesis 1:1-6:8" -> { book, start }
    var m = /^(.+?) (\d+:\d+)/.exec(ref || ''); return m ? { book: m[1], start: m[2], whole: ref } : null;
  }

  // ---------------------------------------------------------------- the day's times
  function loadTimes(d) {
    var c = CITIES[city];
    return getJSON('https://www.hebcal.com/zmanim?cfg=json&geonameid=' + c[1] + '&date=' + ymd(d)).then(function (j) { return j.times || {}; });
  }
  function loadDaf(d) {
    return getJSON('https://www.hebcal.com/hebcal?v=1&cfg=json&F=on&lg=he&start=' + ymd(d) + '&end=' + ymd(d)).then(function (j) {
      var it = (j.items || []).filter(function (x) { return x.category === 'dafyomi'; })[0];
      return it ? (it.hebrew || it.title).replace(/^דף יומי:?\s*/, '') : '';
    });
  }

  // ---------------------------------------------------------------- proverbs: one for each day of the year, cycling
  var PROVERBS = [
    ['מוות וחיים ביד לשון', 'משלי יח, כא'], ['מענה רך ישיב חמה', 'משלי טו, א'], ['לב שמח ייטיב גהה', 'משלי יז, כב'], ['דבר בעתו מה טוב', 'משלי טו, כג'],
    ['טוב ארך אפיים מגבור, ומשל ברוחו מלכד עיר', 'משלי טז, לב'], ['קנה חכמה מה טוב מחרוץ', 'משלי טז, טז'], ['ראשית חכמה קנה חכמה, ובכל קנינך קנה בינה', 'משלי ד, ז'],
    ['בטח אל ה׳ בכל לבך, ואל בינתך אל תשען', 'משלי ג, ה'], ['בכל דרכיך דעהו, והוא יישר אורחותיך', 'משלי ג, ו'], ['דרכיה דרכי נועם, וכל נתיבותיה שלום', 'משלי ג, יז'],
    ['עץ חיים היא למחזיקים בה', 'משלי ג, יח'], ['המהלך את חכמים יחכם', 'משלי יג, כ'], ['יש מדבר כמדקרות חרב, ולשון חכמים מרפא', 'משלי יב, יח'],
    ['כי שבע יפול צדיק וקם', 'משלי כד, טז'], ['אל תתהלל ביום מחר, כי לא תדע מה ילד יום', 'משלי כז, א'], ['ברזל בברזל יחד, ואיש יחד פני רעהו', 'משלי כז, יז'],
    ['חנוך לנער על פי דרכו, גם כי יזקין לא יסור ממנה', 'משלי כב, ו'], ['נר ה׳ נשמת אדם', 'משלי כ, כז'], ['תחילת חכמה יראת ה׳', 'תהלים קיא, י'], ['טוב שם משמן טוב', 'קהלת ז, א'],
    ['אם אין אני לי, מי לי? וכשאני לעצמי, מה אני? ואם לא עכשיו, אימתי?', 'אבות א, יד'], ['עשה לך רב, וקנה לך חבר, והוי דן את כל האדם לכף זכות', 'אבות א, ו'],
    ['הוי מתלמידיו של אהרן: אוהב שלום ורודף שלום, אוהב את הבריות ומקרבן לתורה', 'אבות א, יב'], ['איזהו חכם? הלומד מכל אדם', 'אבות ד, א'], ['איזהו גיבור? הכובש את יצרו', 'אבות ד, א'],
    ['איזהו עשיר? השמח בחלקו', 'אבות ד, א'], ['איזהו מכובד? המכבד את הבריות', 'אבות ד, א'], ['והוי זהיר במצווה קלה כבחמורה', 'אבות ב, א'], ['אל תפרוש מן הציבור', 'אבות ב, ד'],
    ['לא עליך המלאכה לגמור, ולא אתה בן חורין להיבטל ממנה', 'אבות ב, טז'], ['הוי מקבל את כל האדם בסבר פנים יפות', 'אבות א, טו'], ['אמור מעט ועשה הרבה', 'אבות א, טו'],
    ['על שלושה דברים העולם עומד: על התורה, ועל העבודה, ועל גמילות חסדים', 'אבות א, ב'], ['יפה תלמוד תורה עם דרך ארץ', 'אבות ב, ב'], ['כל המקיים נפש אחת, כאילו קיים עולם מלא', 'סנהדרין לז ע״א'],
    ['לא הבישן למד, ולא הקפדן מלמד', 'אבות ב, ה'], ['אל תהי בז לכל אדם, ואל תהי מפליג לכל דבר', 'אבות ד, ג'], ['הוי רץ למצווה קלה ובורח מן העבירה', 'אבות ד, ב'],
    ['הרבה למדתי מרבותיי, ומחבריי יותר מהם, ומתלמידיי יותר מכולם', 'תענית ז ע״א']
  ];

  // ---------------------------------------------------------------- day plan: [time key or fixed hh:mm, title, note]
  function planFor(d, t, daf, aliyah) {
    var dow = d.getDay(), hm = function (k, fb) { return t[k] ? fmtTime(t[k]) : fb; };
    var rows = [];
    if (dow === 6) { // Shabbat
      rows.push(['', 'שבת קודש', 'ללא עבודה ומסכים. מנוחה, תפילה ולימוד']);
      rows.push([hm('sunrise', '06:00'), 'תפילת שחרית', 'עד ' + hm('sofZmanShma', '09:00') + ' קריאת שמע']);
      rows.push(['', 'קריאת פרשת השבוע', aliyah || 'שניים מקרא ואחד תרגום']);
      rows.push([hm('chatzot', '12:00'), 'סעודת שבת וזמן משפחה', 'שיחה על הפרשה, שירים, מנוחה']);
      rows.push([hm('minchaGedola', '13:00'), 'מנוחה ולימוד', 'לימוד חופשי או הליכה']);
      rows.push([hm('sunset', '17:30'), 'מנחה וסעודה שלישית', 'דברי תורה ושירה']);
      rows.push([hm('tzeit85deg', '18:30'), 'הבדלה', 'שבוע טוב ומבורך']);
      return rows;
    }
    rows.push([hm('alotHaShachar', '05:00'), 'קימה', 'מודה אני, נטילת ידיים, ברכות השחר, כוס מים']);
    rows.push([hm('sunrise', '06:00'), 'שחרית', 'קריאת שמע עד ' + hm('sofZmanShma', '09:00') + ', תפילה עד ' + hm('sofZmanTfilla', '10:00')]);
    rows.push(['', 'לימוד בוקר · 30 דקות', aliyah ? 'קריאה יומית בפרשה: ' + aliyah : 'חומש עם רש״י']);
    rows.push(['', 'עבודה עמוקה · 90 דקות', 'המשימה הכי חשובה של היום, בלי הודעות']);
    rows.push(['', 'פגישות ותקשורת', 'שיחות, מיילים והודעות בבלוק אחד']);
    rows.push([hm('chatzot', '12:00'), 'הפסקת צהריים', 'ארוחה, הליכה קצרה, מנוחה']);
    rows.push([hm('minchaGedola', '12:30'), 'עבודה שנייה · 2 עד 3 שעות', 'משימות בינוניות, סיום חוטים פתוחים']);
    if (daf) rows.push(['', 'דף יומי', daf]);
    if (dow === 5) {
      rows.push(['', 'הכנות לשבת', 'סידור הבית, בישולים, מקלחת ולבוש שבת']);
      rows.push([t.candles ? fmtTime(t.candles) : '', 'הדלקת נרות ומנחה', 'כניסת שבת. הטלפון נכבה']);
    } else {
      rows.push([hm('plagHaMincha', '17:00'), 'מנחה', 'לפני השקיעה ' + hm('sunset', '')]);
      rows.push([hm('tzeit85deg', '18:30'), 'ערבית וארוחת ערב', 'זמן משפחה, בלי עבודה']);
      rows.push(['', 'סיכום היום · 10 דקות', 'שלוש הצלחות, מה נשאר למחר, שלוש משימות עיקריות']);
      rows.push(['', 'קריאת שמע שעל המיטה', 'שינה בזמן קבוע']);
    }
    return rows;
  }

  // ---------------------------------------------------------------- render
  var state = { sh: null, times: {}, daf: '' };
  var today = new Date();

  // the weekday plan is the visitor's own: rows can be edited, added and removed (kept in this browser); Shabbat keeps the built-in plan
  function customPlan() { try { var c = JSON.parse(store('plan') || 'null'); return Array.isArray(c) && c.length ? c : null; } catch (e) { return null; } }
  var editing = false;

  function render() {
    var sh = state.sh, ref = sh && sh.leyning && sh.leyning.torah, pr = parseRef(ref);
    var pv = PROVERBS[dayOfYear(today) % PROVERBS.length];
    var dow = today.getDay();
    var aliyah = sh && sh.leyning && sh.leyning[String(Math.min(dow + 1, 7))];
    var parshaCard = '<article class="td-card td-parsha">' +
      '<p class="eyebrow">פרשת השבוע</p>' +
      '<h3>' + esc(sh ? sh.parsha.replace(/^פרשת\s*/, '') : 'פרשת השבוע') + '</h3>' +
      (ref ? '<p class="td-ref">' + esc(ref.replace(/-/g, ' – ')) + '</p>' : '') +
      '<div class="td-times">' +
        '<div><span>כניסת שבת</span><b>' + (sh && sh.candles ? fmtTime(sh.candles) : '—') + '</b></div>' +
        '<div><span>יציאת שבת</span><b>' + (sh && sh.havdalah ? fmtTime(sh.havdalah) : '—') + '</b></div>' +
      '</div>' +
      '<label class="td-city">מקום <select id="td-city">' + Object.keys(CITIES).map(function (k) { return '<option value="' + k + '"' + (k === city ? ' selected' : '') + '>' + CITIES[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<div class="td-links">' + (ref ? '<a href="' + urlRef(ref) + '" target="_blank" rel="noopener">הפרשה בספריא ↗</a>' : '') +
      (sh && sh.link ? '<a href="' + esc(sh.link) + '" target="_blank" rel="noopener">עוד על הפרשה ↗</a>' : '') + '</div>' +
      '</article>';

    var provCard = '<article class="td-card td-proverb"><p class="eyebrow">פתגם יומי · יום ' + DAYS[dow] + '</p><blockquote>' + esc(pv[0]) + '</blockquote><cite>' + esc(pv[1]) + '</cite></article>';

    var todayRef = aliyah && parseRef(aliyah);
    var commCard = '<article class="td-card td-comm"><p class="eyebrow">פירושים וניסוחים</p><h3>מגדולי המפרשים</h3>' +
      (pr ? '<div class="td-chips">' + COMM.map(function (c) { return '<a class="td-chip" href="' + urlRef(commRef(c, pr.book, pr.whole.replace(pr.book + ' ', ''))) + '" target="_blank" rel="noopener">' + esc(c[0]) + '</a>'; }).join('') + '</div>' +
        '<div class="td-pick"><span>ניסוחים על:</span>' +
          '<button type="button" class="td-more" data-v="' + esc(pr.book + ' ' + pr.start) + '">פסוק הפתיחה של הפרשה</button>' +
          (todayRef ? '<button type="button" class="td-more" data-v="' + esc(todayRef.book + ' ' + todayRef.start) + '">קריאת היום (' + esc(todayRef.start.replace(':', ', ')) + ')</button>' : '') +
        '</div><div class="td-snips" id="td-snips" aria-live="polite"></div>' : '<p class="td-muted">הפרשה עוד לא נטענה. נסו לרענן.</p>') +
      '</article>';

    var base = planFor(today, Object.assign({}, state.times, { candles: sh && sh.candles }), state.daf, aliyah ? aliyah.replace(/-/g, ' – ') : '');
    var custom = dow !== 6 ? customPlan() : null;
    var rows = custom || base;
    var key = 'done-' + ymd(today), done = {}; try { done = JSON.parse(store(key) || '{}') || {}; } catch (e) { done = {}; }
    var list = editing
      ? rows.map(function (r, i) { return '<li class="td-edit" data-i="' + i + '"><input class="e-t" value="' + esc(r[0]) + '" placeholder="שעה" aria-label="שעה"><input class="e-x" value="' + esc(r[1]) + '" placeholder="מה עושים" aria-label="פעילות"><input class="e-n" value="' + esc(r[2]) + '" placeholder="הערה" aria-label="הערה"><button type="button" class="e-d" aria-label="מחיקה">✕</button></li>'; }).join('') + '<li><button type="button" class="td-more" id="td-add">+ שורה</button></li>'
      : rows.map(function (r, i) { return '<li><label><input type="checkbox" data-i="' + i + '"' + (done[i] ? ' checked' : '') + '><span class="td-t">' + esc(r[0]) + '</span><span class="td-x"><b>' + esc(r[1]) + '</b><small>' + esc(r[2]) + '</small></span></label></li>'; }).join('');
    var planCard = '<article class="td-card td-plan"><p class="eyebrow">סדר יום · ' + CITIES[city][0] + '</p><h3>היום, יום ' + DAYS[dow] + '</h3><ol class="td-rows">' + list + '</ol>' +
      (dow !== 6 ? '<div class="td-planbar">' + (editing ? '<button type="button" class="td-more" id="td-save">שמירה</button><button type="button" class="td-link" id="td-reset">חזרה לברירת המחדל</button>' : '<button type="button" class="td-more" id="td-editbtn">עריכת סדר היום</button>') + '</div>' : '') +
      '</article>';

    $('#td-grid').innerHTML = '<div class="td-col">' + parshaCard + provCard + '</div><div class="td-col">' + commCard + '</div><div class="td-col">' + planCard + '</div>';

    $('#td-city').addEventListener('change', function (e) { city = e.target.value; store('city', city); load(); });
    Array.prototype.forEach.call(root.querySelectorAll('.td-rows input[type=checkbox]'), function (cb) {
      cb.addEventListener('change', function () { done[cb.dataset.i] = cb.checked ? 1 : 0; store(key, JSON.stringify(done)); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.td-pick .td-more'), function (btn) {
      btn.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('.td-pick .td-more'), function (x) { x.classList.remove('on'); }); btn.classList.add('on'); loadSnips(pr, btn.dataset.v); });
    });
    function collect() { return Array.prototype.map.call(root.querySelectorAll('.td-edit'), function (li) { return [$('.e-t', li).value.trim(), $('.e-x', li).value.trim(), $('.e-n', li).value.trim()]; }).filter(function (r) { return r[1]; }); }
    var eb = $('#td-editbtn'); if (eb) eb.addEventListener('click', function () { if (!custom) store('plan', JSON.stringify(base)); editing = true; render(); });
    var sv = $('#td-save'); if (sv) sv.addEventListener('click', function () { var c = collect(); if (c.length) store('plan', JSON.stringify(c)); editing = false; render(); });
    var rs = $('#td-reset'); if (rs) rs.addEventListener('click', function () { try { localStorage.removeItem('td-plan'); } catch (e) {} editing = false; render(); });
    var ad = $('#td-add'); if (ad) ad.addEventListener('click', function () { var c = collect(); c.push(['', '', '']); store('plan', JSON.stringify(c.length ? c : base)); render(); });
    Array.prototype.forEach.call(root.querySelectorAll('.e-d'), function (x) { x.addEventListener('click', function () { var li = x.closest('li'), c = collect(); c.splice(Number(li.dataset.i), 1); store('plan', JSON.stringify(c)); render(); }); });
  }

  // wording of the commentators on a verse (the portion's first verse, or the first verse of today's reading) and Talmud passages that cite it
  function loadSnips(pr, verse) {
    var box = $('#td-snips'), vref = verse.replace(/^(\S+(?: \S+)*?) (\d+:\d+).*$/, '$1|$2').split('|'), book = vref[0], at = vref[1] || pr.start;
    box.innerHTML = '<p class="td-muted">טוען מספריא…</p>';
    var calls = COMM.slice(0, 10).map(function (c) {
      var ref = commRef(c, book, at);
      return sefText(ref).then(function (r) { return r.text ? { who: c[0], text: r.text, href: urlRef(ref) } : null; }).catch(function () { return null; });
    });
    var talmud = getJSON(SEF + '/api/related/' + encodeURIComponent(book + '.' + at.replace(':', '.')), 12000).then(function (j) {
      var seen = {}, out = [];
      (j.links || []).forEach(function (l) {
        if (l.category !== 'Talmud') return;
        var ref = l.sourceRef || l.ref; if (!ref) return;
        var k = ref.replace(/:\d+.*$/, ''); if (seen[k]) return; seen[k] = 1;
        out.push({ ref: ref, he: l.sourceHeRef || l.heRef || ref });
      });
      out = out.slice(0, 6);
      return Promise.all(out.map(function (x) { return sefText(x.ref).then(function (r) { x.text = r.text; return x; }).catch(function () { return x; }); }));
    }).catch(function () { return []; });
    Promise.all([Promise.all(calls), talmud]).then(function (res) {
      var comms = res[0].filter(Boolean), tal = res[1];
      function cut(t, n) { return t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + '…' : t; }
      var html = comms.map(function (c) { return '<div class="td-snip"><b>' + esc(c.who) + '</b><p>' + esc(cut(c.text, 300)) + '</p><a href="' + c.href + '" target="_blank" rel="noopener">לפירוש המלא ↗</a></div>'; }).join('');
      if (tal.length) html += '<div class="td-snip td-tal"><b>מהתלמוד</b>' + tal.map(function (x) { return '<div class="td-tl"><a href="' + urlRef(x.ref) + '" target="_blank" rel="noopener">' + esc(x.he) + ' ↗</a>' + (x.text ? '<p>' + esc(cut(x.text, 220)) + '</p>' : '') + '</div>'; }).join('') + '</div>';
      box.innerHTML = html || '<p class="td-muted">לא הצלחתי להביא את הטקסטים כרגע. הקישורים למעלה פותחים אותם בספריא.</p>';
    });
  }

  function load() {
    Promise.all([
      loadShabbat().catch(function () { return null; }),
      loadTimes(today).catch(function () { return {}; }),
      loadDaf(today).catch(function () { return ''; })
    ]).then(function (r) { state.sh = r[0]; state.times = r[1] || {}; state.daf = r[2] || ''; render(); });
  }

  var shut = store('shut') === '1';
  root.innerHTML = '<div class="wrap"><header class="sec-head td-head"><div><p class="eyebrow">תורה ויום</p><h2>הפרשה, הפתגם וסדר היום</h2></div><button type="button" class="td-link" id="td-toggle" aria-expanded="' + (!shut) + '">' + (shut ? 'הצגה' : 'הסתרה') + '</button></header><div class="td-grid" id="td-grid"' + (shut ? ' hidden' : '') + '><p class="td-muted">טוען…</p></div></div>';
  $('#td-toggle').addEventListener('click', function () {
    shut = !shut; store('shut', shut ? '1' : '0'); $('#td-grid').hidden = shut; this.textContent = shut ? 'הצגה' : 'הסתרה'; this.setAttribute('aria-expanded', String(!shut));
  });
  render(); // instant: the proverb and the day plan do not need the network
  load();
})();
