/* Growing the business from the studio: reviews for the site and the request for one, ready WhatsApp Business replies
   built from the real packages and payment options, a lead sent from the site's chat (studio.html#lead=...) opening as a
   new deal, and a QR sign that sends guests to their event's gallery (gallery.html?a=<album>). */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, esc = FS.esc;
  var QR_LIB = 'vendor/qrcode.js';
  function site() { return FS.BIZ_SITE || {}; }
  function siteUrl(path) { return location.href.replace(/[^/]*([?#].*)?$/, '') + (path || ''); }
  function copy(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { FS.toast(msg || '📋 הועתק'); }, function () { prompt('להעתקה:', t); }); }

  /* ---------- reviews ---------- */
  var RKEY = 'frame-studio-reviews';
  function reviews() {
    try { var l = JSON.parse(localStorage.getItem(RKEY) || 'null'); if (l) return l; } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(site().reviews || []));
  }
  FS.dealTabs.reviews = { label: '⭐ המלצות', draw: function (v) {
    var list = reviews(), g = FS.BIZ.googleReviews || site().googleReviews || '';
    function draw() {
      v.innerHTML = '<div class="rv-ed"><p class="hint">המלצות אמיתיות מלקוחות מופיעות באתר בחלק "מה אומרים עלינו". כדאי לבקש רשות מהלקוח לפני שמפרסמים. אחרי אירוע, הכפתור "⭐ בקשת המלצה" בעסקה שולח ללקוח בקשה בוואטסאפ.</p>' +
        '<label class="rv-g"><span>קישור לכתיבת ביקורת בגוגל (מפרופיל העסק ב־Google)</span><input id="rv-google" dir="ltr" value="' + esc(g) + '" placeholder="https://g.page/r/…/review"></label>' +
        '<div class="rv-list">' + list.map(function (r, i) {
          return '<article class="rv" data-i="' + i + '"><div class="rv-top"><input data-k="name" value="' + esc(r.name || '') + '" placeholder="שם (למשל: נועה ודניאל)"><select data-k="type">' + FS.EVENTS.map(function (e) { return '<option value="' + e.id + '"' + (r.type === e.id ? ' selected' : '') + '>' + e.icon + ' ' + e.name + '</option>'; }).join('') + '</select>' +
            '<span class="rv-stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-s="' + n + '" class="' + (n <= (r.stars || 5) ? 'on' : '') + '" aria-label="' + n + ' כוכבים">★</button>'; }).join('') + '</span><button type="button" class="link" data-del>✕</button></div>' +
            '<textarea data-k="text" rows="3" placeholder="מה הלקוח כתב">' + esc(r.text || '') + '</textarea></article>';
        }).join('') + '<button class="pkg-add rv-add" id="rv-add"><b>＋</b><span>המלצה</span></button></div>' +
        '<div class="pv-foot"><a class="btn" href="./#reviews" target="_blank" rel="noopener">👁 לראות באתר</a><div class="inline"><button class="btn" id="rv-save">💾 שמירה</button><button class="btn primary" id="rv-publish">🌐 שמירה ופרסום באתר</button></div></div></div>';
      $$('.rv', v).forEach(function (el) {
        var r = list[Number(el.dataset.i)];
        $$('[data-k]', el).forEach(function (f) { f.addEventListener('input', function () { r[f.dataset.k] = f.value; }); f.addEventListener('change', function () { r[f.dataset.k] = f.value; }); });
        $$('[data-s]', el).forEach(function (b) { b.addEventListener('click', function () { r.stars = Number(b.dataset.s); $$('[data-s]', el).forEach(function (x) { x.classList.toggle('on', Number(x.dataset.s) <= r.stars); }); }); });
        $('[data-del]', el).addEventListener('click', function () { list.splice(Number(el.dataset.i), 1); draw(); });
      });
      $('#rv-add', v).addEventListener('click', function () { list.push({ name: '', type: 'wedding', stars: 5, text: '' }); draw(); var n = $$('.rv [data-k=name]', v); n[n.length - 1].focus(); });
      $('#rv-save', v).addEventListener('click', function () { if (save()) FS.toast('💾 נשמר אצלך'); });
      $('#rv-publish', v).addEventListener('click', function () {
        if (!save()) return; var out = clean();
        FS.publishSite(function (base) { base.reviews = out; base.googleReviews = FS.BIZ.googleReviews || ''; }, 'frame-studio: reviews', '🌐 ההמלצות יתעדכנו באתר תוך כשתי דקות');
      });
    }
    function clean() { return list.filter(function (r) { return String(r.text || '').trim(); }).map(function (r) { return { name: String(r.name || '').trim(), type: r.type, stars: r.stars || 5, text: String(r.text).trim() }; }); }
    function save() {
      var u = $('#rv-google', v).value.trim();
      if (u && !/^https:\/\/\S+$/i.test(u)) { FS.toast('הקישור לגוגל צריך להתחיל ב־https://'); return false; }
      FS.BIZ.googleReviews = u; FS.saveBiz();
      try { localStorage.setItem(RKEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
      return true;
    }
    draw();
  } };

  /* ---------- ready WhatsApp Business replies ---------- */
  function texts() {
    var B = FS.BIZ, p = FS.deals.pay(), pk = (FS.getPackages ? FS.getPackages() : []).filter(function (x) { return !x.hidden; }), first = String(B.owner || '').split(' ')[0];
    var pays = [p.bit ? 'ביט: ' + p.bit : '', p.paybox ? 'פייבוקס: ' + p.paybox : '', p.card ? 'אשראי: ' + p.card : '', p.account ? 'העברה: ' + [p.bankName, p.bankNo ? 'בנק ' + p.bankNo : '', p.branch ? 'סניף ' + p.branch : '', 'חשבון ' + p.account, p.holder ? 'ע״ש ' + p.holder : ''].filter(Boolean).join(', ') : '', p.paypal ? 'PayPal: ' + p.paypal : '', p.cash || p.check ? [p.cash ? 'מזומן' : '', p.check ? 'צ׳ק' : ''].filter(Boolean).join(' או ') : ''].filter(Boolean);
    var site = siteUrl('');
    return [
      { k: 'greet', t: '👋 הודעת פתיחה', where: 'כלים לעסקים ← הודעת פתיחה', body: 'היי! הגעתם ל' + B.name + ' 🧲\nמגנטים לאירועים: צילום והדפסה במקום, מסגרת בעיצוב אישי, מגנט ביד תוך דקה.\n\nכדי שאחזור אליכם עם הצעה, כתבו לי:\n1. סוג האירוע\n2. תאריך\n3. מספר אורחים משוער\n4. מקום האירוע\n\nבינתיים אפשר להציץ בעיצובים ובחבילות: ' + site + '\n' + (first ? first + ', ' : '') + B.name },
      { k: 'away', t: '🌙 הודעת היעדרות', where: 'כלים לעסקים ← הודעת היעדרות', body: 'תודה שפניתם ל' + B.name + ' 🧲\nכרגע אני באירוע או מחוץ לשעות הפעילות' + (B.hours ? ' (' + B.hours + ')' : '') + ', ואחזור אליכם בהקדם.\nבינתיים אפשר לבדוק אם התאריך שלכם פנוי ולראות חבילות כאן: ' + site },
      { k: 'prices', t: '💰 /מחירים', where: 'תשובות מהירות', body: 'אלה החבילות שלנו 🧲\n' + (pk.length ? pk.map(function (x) { return '• ' + x.name + (x.price ? ' · ' + x.price : '') + ([x.hours, x.magnets].filter(Boolean).length ? ' (' + [x.hours, x.magnets].filter(Boolean).join(', ') + ')' : ''); }).join('\n') : '(עדכנו חבילות ב"💰 חבילות")') + '\n\nכל החבילות כוללות הובלה, הקמה ועמדת הדפסה. מה התאריך ואיפה האירוע? אבדוק זמינות 📅' },
      { k: 'date', t: '📅 /תאריך', where: 'תשובות מהירות', body: 'בשמחה! אבדוק את התאריך 📅\nתכתבו לי בבקשה: תאריך, שעה, מקום האירוע ומספר אורחים משוער, ואחזור עם אישור והצעה מסודרת.' },
      { k: 'close', t: '🤝 /סגירה', where: 'תשובות מהירות', body: 'מעולה, סגרנו! 🎉\nכדי לשריין את התאריך צריך מקדמה. אשלח לכם עכשיו מסמך סגירה עם כל הפרטים וקישור לתשלום.\nאפשר לשלם ב: ' + (pays.length ? pays.join(' · ') : 'ביט / העברה') },
      { k: 'pay', t: '💳 /תשלום', where: 'תשובות מהירות', body: 'אפשרויות התשלום:\n' + (pays.length ? pays.map(function (x) { return '• ' + x; }).join('\n') : '(ממלאים אפשרויות תשלום בלשונית ⚙️)') + '\n\nאחרי התשלום שלחו לי צילום מסך ואשלח אישור תשלום 🙏' },
      { k: 'thanks', t: '⭐ /תודה', where: 'תשובות מהירות', body: 'היה כיף גדול באירוע שלכם! תודה שבחרתם ב' + B.name + ' 🧲\n' + (FS.BIZ.googleReviews ? 'נשמח מאוד לכמה מילים בגוגל, זה עוזר לנו המון: ' + FS.BIZ.googleReviews : 'נשמח לכמה מילים על החוויה, אפשר פשוט לענות כאן 🙏') }
    ];
  }
  FS.waTexts = texts;
  FS.dealTabs.wa = { label: '💬 תשובות לוואטסאפ', draw: function (v) {
    v.innerHTML = '<div class="wa-ed"><p class="hint">הודעות מוכנות לוואטסאפ ביזנס, מהחבילות ומאפשרויות התשלום שלך. מעתיקים לתוך האפליקציה: <b>הגדרות ← כלים לעסקים</b>. בתשובה מהירה כותבים בצ׳אט "/" ובוחרים.</p><div class="wa-list">' +
      texts().map(function (x) { return '<article class="wa-card"><header><b>' + x.t + '</b><small>' + x.where + '</small></header><textarea rows="7" data-k="' + x.k + '">' + esc(x.body) + '</textarea><button class="btn small" data-copy="' + x.k + '">📋 העתקה</button></article>'; }).join('') + '</div></div>';
    $$('[data-copy]', v).forEach(function (b) { b.addEventListener('click', function () { copy($('textarea[data-k=' + b.dataset.copy + ']', v).value, '📋 הועתק. מדביקים בוואטסאפ ביזנס.'); }); });
  } };

  /* ---------- a lead from the site's chat: studio.html#lead=<base64url JSON> opens a new deal ---------- */
  function fromLink() {
    var m = /#lead=([\w-]+)/.exec(location.hash); if (!m) return;
    var L = null; try { L = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return; }
    history.replaceState(null, '', location.pathname + location.search);
    var str = function (x, n) { return String(x == null ? '' : x).slice(0, n || 120); };
    var pre = { client: { name: str(L.name), phone: str(L.phone, 30), email: '', idNo: '', address: '' }, type: FS.EVENTS.some(function (e) { return e.id === L.type; }) ? L.type : 'wedding',
      date: /^\d{4}-\d{2}-\d{2}$/.test(L.date || '') ? L.date : '', venue: str(L.venue), guests: (String(L.guests || '').match(/\d+/g) || ['']).pop(), pkg: str(L.pkg, 60), notes: 'פנייה מהצ׳אט באתר' + (L.guests ? ' · אורחים: ' + str(L.guests, 20) : '') + (L.note ? ' · שאלה: ' + str(L.note, 400) : '') };
    function go() { FS.openDeals(null, pre); FS.toast('📥 פנייה מהאתר נפתחה כעסקה חדשה. בודקים, משלימים ושומרים.', 6000); }
    if (FS.closeIntro && $('#intro')) FS.closeIntro(go); else go();
  }
  setTimeout(fromLink, 300);

  /* ---------- QR sign for guests: their event's gallery ---------- */
  var qrP = null;
  function qrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return qrP || (qrP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = QR_LIB; s.onload = function () { ok(window.qrcode); }; s.onerror = function () { qrP = null; no(new Error('qr')); }; document.head.appendChild(s); }));
  }
  FS.qrCanvas = function (text, px) {
    return qrLib().then(function (Q) {
      var q = Q(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(), m = 4, k = Math.max(4, Math.floor((px || 600) / (n + m * 2))), c = FS.canvas((n + m * 2) * k, (n + m * 2) * k), x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#1d1633';
      for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect((col + m) * k, (r + m) * k, k, k);
      return c;
    });
  };
  FS.guestSign = function (a) {
    if (!a) return;
    var url = siteUrl('gallery.html?a=' + encodeURIComponent(a.id)), B = FS.BIZ;
    FS.qrCanvas(url, 900).then(function (c) {
      var ev = FS.event(a.type);
      var body = FS.dialog('📱 QR לאורחים', '<div class="qr-box"><img src="' + c.toDataURL() + '" alt="QR"><div><p><b>' + esc(a.title) + '</b><br><small dir="ltr">' + esc(url) + '</small></p>' +
        '<p class="hint">האורחים סורקים ומגיעים לגלריה של האירוע, ומשם מורידים את התמונות לטלפון. אפשר להדפיס שלט לשולחן או לשלוח את הקישור לבעלי האירוע.</p>' +
        '<div class="inline"><button class="btn primary" id="qr-print">🖨 הדפסת שלט</button><button class="btn" id="qr-copy">🔗 העתקת קישור</button><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">👁 פתיחה</a></div></div></div>');
      $('#qr-copy', body).addEventListener('click', function () { copy(url, '🔗 הקישור לגלריה הועתק'); });
      $('#qr-print', body).addEventListener('click', function () {
        FS.printDoc('<div class="sign"><p class="sign-ev">' + ev.icon + ' ' + esc(a.title) + '</p><h1>התמונות שלכם מהאירוע 📸</h1><p class="sign-sub">סורקים, בוחרים ושומרים לטלפון</p><img src="' + c.toDataURL() + '" alt=""><p class="sign-biz"><b>' + esc(B.name) + '</b>' + (B.phone ? ' · ' + esc(B.phone) : '') + '<br>רוצים מגנטים גם באירוע שלכם? 🧲</p></div>');
      });
    }, function () { FS.toast('לא הצלחתי לטעון את מחולל ה־QR. בודקים חיבור לאינטרנט.'); });
  };
})();
