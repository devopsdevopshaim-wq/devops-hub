/* tv.html: a TV in the hall joins the event without typing a long address. It shows a 6-digit code; the owner types it in
   Optimus (🎉 אירוע חי ← 📺 שליטה במסך) and the TV moves to the event's screen. A secret only this page holds goes with
   every look, so nobody can take the event's link by guessing codes. The last event is remembered for "↩ חזרה". */
(function () {
  'use strict';
  var L = window.FL, code = '', secret = '', made = 0, TTL = 18 * 60000, KL = 'fs-tv-last';
  var $ = function (id) { return document.getElementById(id); };
  function go(e, v) { try { localStorage.setItem(KL, JSON.stringify({ e: e, v: v, at: Date.now() })); } catch (x) { /* private */ } location.replace('wall.html?e=' + e + '&v=' + v + '&host=1'); }
  function fresh() {
    return L.call({ action: 'tv-pair-new' }).then(function (r) {
      if (!r || !r.ok) { $('tv-st').textContent = r && r.error === 'offline' ? 'אין אינטרנט במסך. בודקים את החיבור…' : 'מנסים שוב…'; return; }
      code = r.code; secret = r.secret; made = Date.now();
      $('tv-code').textContent = code.slice(0, 3) + ' ' + code.slice(3); $('tv-st').textContent = 'מחכים לחיבור…';
    });
  }
  function look() {
    if (!code || Date.now() - made > TTL) return fresh();
    return L.call({ action: 'tv-pair-get', code: code, secret: secret }).then(function (r) {
      if (r && r.ok && r.e && r.v) { $('tv-st').textContent = '✔ מחובר! עוברים למסך…'; go(r.e, r.v); }
      else if (r && r.error === 'not-found') code = '';
    });
  }
  var last = null; try { last = JSON.parse(localStorage.getItem(KL) || 'null'); } catch (x) { /* private */ }
  if (last && last.e && Date.now() - (last.at || 0) < 3 * 864e5) { var b = $('tv-last'); b.hidden = false; b.onclick = function () { go(last.e, last.v); }; }
  (function loop() { look().then(function () { setTimeout(loop, 2000); }, function () { setTimeout(loop, 4000); }); })();
})();
