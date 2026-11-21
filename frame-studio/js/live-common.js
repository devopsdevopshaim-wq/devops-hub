/* The live event's public pages (live.html for guests, wall.html for the big screen, album.html for the couple) share this:
   the server's address, one call, photo links, a toast and the QR drawing. Nothing here is signed in: the keys in the link
   decide what a page may do (the guests' key uploads, the viewing key reads). */
(function () {
  'use strict';
  var DEFAULT = 'https://spider-auth.devopsdevopshaim.workers.dev';
  var base = fetch('../portfolio/api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (j) { var b = String((j && j.base) || '').replace(/\/+$/, ''); return /^https:\/\/[\w.-]+(:\d+)?$/.test(b) ? b : DEFAULT; }).catch(function () { return DEFAULT; });
  var q = new URLSearchParams(location.search);
  var L = window.FL = {
    m: (q.get('m') || '').replace(/[^a-f0-9]/g, ''),
    e: (q.get('e') || '').replace(/[^a-z0-9]/g, ''), k: (q.get('k') || '').replace(/[^a-f0-9]/g, ''), v: (q.get('v') || '').replace(/[^a-f0-9]/g, ''), c: (q.get('c') || '').replace(/[^a-z0-9]/g, ''),
    base: base,
    call: function (body) {
      return base.then(function (u) { return fetch(u + '/frame-live', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }); })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; });
    },
    img: function (id, audio) { return base.then(function (u) { return u + '/frame-live-img?e=' + L.e + '&p=' + id + '&v=' + L.v + (audio ? '&a=1' : ''); }); },
    site: function (path) { return new URL(path, location.href).href; },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    toast: function (t, ms) {
      var el = document.getElementById('toast'); if (!el) return;
      el.textContent = t; el.classList.add('on'); clearTimeout(L._t); L._t = setTimeout(function () { el.classList.remove('on'); }, ms || 3200);
    },
    /* 📲 a guest's details, only if they want: the phone (for the photos on WhatsApp), a coming event of their own, and a
       clear consent. lead.html(id, title, sub) draws it; lead.read(root, id) reads it; lead.send(d) sends it with this page's key */
    lead: {
      SOON: [['', 'אין כרגע'], ['wedding', '💍 חתונה'], ['engagement', '💞 אירוסין'], ['henna', '🌿 חינה'], ['barmitzvah', '✡️ בר מצווה'], ['batmitzvah', '🎀 בת מצווה'], ['brit', '👶 ברית / בריתה'], ['birthday', '🎂 יום הולדת'], ['company', '🏢 אירוע חברה'], ['other', '✨ אחר']],
      html: function (id, title, sub, biz) {
        var y = new Date().getFullYear(), m = new Date().getMonth(), months = [];
        for (var i = 0; i < 24; i++) { var d = new Date(y, m + i, 1); months.push([d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2), d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })]); }
        return '<section class="card lv-lead" id="' + id + '"><h2>' + title + ' <small>(לא חובה)</small></h2>' + (sub ? '<p class="lv-lead-sub">' + sub + '</p>' : '') +
          '<label class="lv-f">טלפון<input type="tel" inputmode="tel" autocomplete="tel" maxlength="20" data-l="phone" placeholder="050-0000000" dir="ltr"></label>' +
          '<div class="lv-row2"><label class="lv-f">יש לכם אירוע בקרוב?<select data-l="soon">' + L.lead.SOON.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="lv-f">מתי?<select data-l="when"><option value="">לא יודעים עדיין</option>' + months.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select></label></div>' +
          '<label class="lv-consent"><input type="checkbox" data-l="consent"> אני מאשר/ת ל' + L.esc(biz || 'צלם המגנטים') + ' לשמור את הטלפון ולפנות אליי בוואטסאפ לגבי התמונות ולגבי אירועים. אפשר לבקש מחיקה בכל עת. <a href="privacy.html" target="_blank" rel="noopener">מדיניות פרטיות</a></label></section>';
      },
      read: function (root) { var g = function (k) { var el = root.querySelector('[data-l="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; }; return { phone: g('phone'), soon: g('soon'), when: g('when'), consent: g('consent') === true }; },
      send: function (d, name) {
        if (!d.phone || !d.consent) return Promise.resolve({ ok: false, error: d.phone ? 'no-consent' : 'none' });
        return L.call({ action: 'lead', e: L.e, k: L.k || undefined, v: L.k ? undefined : L.v, phone: d.phone, name: name || '', soon: d.soon, when: d.when, consent: true });
      }
    },
    heDate: function (iso) { var d = new Date(String(iso) + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); },
    /* a QR code as a canvas (vendor/qrcode.js, loaded on first use) */
    qr: function (text, px, dark, light) {
      var ready = window.qrcode ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      return ready.then(function () {
        var Q = window.qrcode(0, 'M'); Q.addData(text); Q.make();
        var n = Q.getModuleCount(), m = 3, k = Math.max(3, Math.floor((px || 400) / (n + m * 2))), c = document.createElement('canvas'); c.width = c.height = (n + m * 2) * k;
        var x = c.getContext('2d'); x.fillStyle = light || '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = dark || '#1d1633';
        for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (Q.isDark(r, col)) x.fillRect((col + m) * k, (r + m) * k, k, k);
        return c;
      });
    },
    MSG: { 'not-found': 'הקישור לא תקין או שהאירוע נסגר.', closed: 'העלאת התמונות לאירוע הזה נסגרה.', full: 'האירוע הגיע למספר התמונות המקסימלי.', 'rate-limited': 'הרבה תמונות ברצף. מחכים דקה ומנסים שוב.',
      offline: 'אין חיבור לאינטרנט. בודקים את הרשת ומנסים שוב.', 'bad-image': 'התמונה לא נקראה. מנסים תמונה אחרת.', 'too-big': 'התמונה גדולה מדי.', 'card-number': 'אסור לשלוח מספר כרטיס אשראי.' },
    msg: function (r) { return L.MSG[r && r.error] || 'משהו השתבש. מנסים שוב.'; }
  };
})();
