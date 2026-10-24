/* wall.html: the big screen in the hall. The event's photos (the guests' and the printed magnets) run as a slideshow with
   their greetings; a new photo jumps the line and shows first, marked "חדש". A QR code in the corner invites more guests.
   It asks the server for new photos every few seconds and keeps going without the internet with what it already has. */
(function () {
  'use strict';
  var L = window.FL, esc = L.esc, stage = document.getElementById('stage');
  var all = [], fresh = [], seen = {}, i = -1, since = 0, cur = null, timer = 0, SHOW = 8000;
  var FX = ['fx-fade', 'fx-zoom', 'fx-slide', 'fx-rise', 'fx-turn', 'fx-blur'];

  function msg(t) { stage.innerHTML = '<div class="w-empty">' + t + '</div>'; }
  if (!L.e || !L.v) { msg('הקישור למסך לא שלם.'); return; }

  function poll(first) {
    return L.call({ action: 'feed', e: L.e, v: L.v, since: since }).then(function (r) {
      if (!r.ok) { if (first) msg(esc(L.msg(r))); return; }
      document.getElementById('w-title').textContent = r.title; document.title = r.title + ' · מסך האירוע';
      document.getElementById('w-biz').textContent = r.biz && r.biz.name ? r.biz.name + ' · מגנטים לאירועים' : '';
      if (first) qr(r.k);
      r.photos.forEach(function (p) { if (seen[p.id]) return; seen[p.id] = 1; all.push(p); if (!first) fresh.push(p); since = Math.max(since, p.at); });
      document.getElementById('w-count').textContent = all.length ? '📸 ' + all.length + ' תמונות' : '';
      if (!all.length && !cur) invite(r.k);
      if (all.length && !timer) { next(); timer = setInterval(next, SHOW); }
      else if (fresh.length && cur && Date.now() - cur.at > 2500) { clearInterval(timer); next(); timer = setInterval(next, SHOW); }
    });
  }
  function guestUrl(k) { return L.site('live.html?e=' + L.e + '&k=' + k); }
  function qr(k) {
    var box = document.getElementById('w-qr'); if (!k) { box.hidden = true; return; }
    L.qr(guestUrl(k), 360).then(function (c) { var t = document.getElementById('w-qrc'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); box.hidden = false; }).catch(function () {});
  }
  function invite(k) {
    stage.innerHTML = '<div class="w-empty"><p>📸 עוד אין תמונות</p>' + (k ? '<canvas id="w-big"></canvas><p>סורקים, מצלמים, והתמונה מודפסת כמגנט 🧲</p>' : '') + '</div>';
    if (k) L.qr(guestUrl(k), 520).then(function (c) { var t = document.getElementById('w-big'); if (!t) return; t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); });
  }
  function next() {
    var isNew = fresh.length > 0, p = isNew ? fresh.shift() : all.length ? all[(i = (i + 1) % all.length)] : null; if (!p) return;
    L.img(p.id).then(function (src) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { place(p, src, isNew); };
      im.onerror = function () { /* gone (hidden by the studio): skip it */ all = all.filter(function (x) { return x !== p; }); };
      im.src = src;
    });
  }
  function place(p, src, isNew) {
    var fx = FX[Math.floor(Math.random() * FX.length)], el = document.createElement('div');
    el.className = 'w-slide ' + fx;
    el.innerHTML = '<div class="w-bg" style="background-image:url(\'' + src + '\')"></div><img class="w-img kb' + (Math.random() < 0.5 ? ' kb2' : '') + '" src="' + src + '" alt="">' +
      (isNew && p.src === 'guest' ? '<span class="w-new">✨ חדש</span>' : '') +
      (p.text || p.name ? '<div class="w-cap">' + (p.text ? '<p>“' + esc(p.text) + '”</p>' : '') + (p.name ? '<b>' + esc(p.name) + '</b>' : '') + (p.audio ? ' <span title="ברכה קולית באלבום">🎙️</span>' : '') + '</div>' : '');
    stage.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
    var old = cur && cur.el; cur = { el: el, at: Date.now() };
    if (old) { old.classList.add('out'); setTimeout(function () { old.remove(); }, 1600); }
    Array.prototype.slice.call(stage.children, 0, -2).forEach(function (x) { x.remove(); });
  }
  document.getElementById('w-full').addEventListener('click', function () {
    var d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(function () {});
  });
  /* the mouse pointer and the button hide while nobody moves the mouse */
  var idle; document.addEventListener('mousemove', function () { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(function () { document.body.classList.add('idle'); }, 3000); });
  poll(true); setInterval(poll, 6000);
})();
