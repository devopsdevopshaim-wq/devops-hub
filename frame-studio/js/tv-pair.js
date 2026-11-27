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
  if (last && last.e && Date.now() - (last.at || 0) < 3 * 864e5) {
    var b = $('tv-last'); b.hidden = false; b.onclick = function () { go(last.e, last.v); };
    /* in the screen app (אופטימוס מסך: ?app=1), after a power cut or a restart it goes back to the event by itself in 10 seconds,
       unless the owner asked for a new code (the remote's Menu key opens ?app=1&pair=1) or presses OK to stay here */
    var q = location.search;
    if (/[?&]app=1/.test(q) && !/[?&]pair=1/.test(q)) {
      var n = 10, stay = false, t = setInterval(function () {
        if (stay) return clearInterval(t);
        b.textContent = '↩ חוזרים לאירוע האחרון בעוד ' + n + ' שנ׳ · OK כדי להישאר כאן';
        if (--n < 0) { clearInterval(t); go(last.e, last.v); }
      }, 1000);
      var hold = function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Backspace') { stay = true; b.textContent = '↩ חזרה למסך של האירוע הקודם'; document.removeEventListener('keydown', hold, true); e.preventDefault(); } };
      document.addEventListener('keydown', hold, true);
    }
    b.focus();
  }
  /* the screen app's version, small at the bottom */
  try { if (window.OptimusScreen) $('tv-ver').textContent = 'אופטימוס מסך ' + window.OptimusScreen.version(); } catch (x) { /* older app */ }
  (function loop() { look().then(function () { setTimeout(loop, 2000); }, function () { setTimeout(loop, 4000); }); })();
})();
