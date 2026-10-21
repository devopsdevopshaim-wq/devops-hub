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
    e: (q.get('e') || '').replace(/[^a-z0-9]/g, ''), k: (q.get('k') || '').replace(/[^a-f0-9]/g, ''), v: (q.get('v') || '').replace(/[^a-f0-9]/g, ''),
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
