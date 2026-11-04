/* The opening's magnet: it develops from the white of the flash while the clock runs, the way it happens at the event
   (css/atelier.css). Once per visit; with "reduce motion" the finished print and the final time show at once. */
/* 🧲 the magnet wall: every event's photos as printed magnets, two rows drifting opposite ways; it stops under the
   pointer, and with "reduce motion" it is a still row that scrolls by hand. */
(function () {
  'use strict';
  var wall = document.getElementById('mwall'); if (!wall) return;
  var P = [['wedding-1', 'חתונה'], ['barmitzvah-1', 'בר מצווה'], ['henna-3', 'חינה'], ['birthday-3', 'יום הולדת'], ['brit-2', 'ברית'], ['company-1', 'אירוע חברה'], ['engagement-1', 'אירוסין'], ['holiday-2', 'חג'], ['wedding-3', 'חתונה'], ['birthday-1', 'יום הולדת 30'],
    ['barmitzvah-3', 'בת מצווה'], ['brit-1', 'ברית'], ['wedding-2', 'חתונה'], ['company-3', 'כנס'], ['birthday-2', 'מסיבה'], ['engagement-2', 'אירוסין'], ['barmitzvah-2', 'בר מצווה'], ['brit-3', 'ברית'], ['company-2', 'אירוע חברה']];
  function row(list, cls) {
    var one = list.map(function (x, i) { return '<figure class="mw-m" style="--t:' + (((i * 37) % 9) - 4) * 0.7 + 'deg"><img src="media/real/thumb/' + x[0] + '.webp" alt="' + x[1] + '" loading="lazy" decoding="async" width="480" height="720"><figcaption>' + x[1] + '</figcaption></figure>'; }).join('');
    return '<div class="mw-row ' + cls + '"><div class="mw-track">' + one + one + '</div></div>';
  }
  wall.insertAdjacentHTML('beforeend', row(P.slice(0, 10), 'r1') + row(P.slice(9).concat(P.slice(0, 1)), 'r2'));
})();

(function () {
  'use strict';
  var box = document.querySelector('.hero-art.dev'); if (!box) return;
  var clock = box.querySelector('.dev-clock b'), END = 180, still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* minutes and seconds: a magnet takes a few minutes, from the photo to the hand */
  function show(s) { clock.textContent = ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function done() { show(END); box.classList.add('dev-done'); box.querySelector('.dev-clock').classList.add('done'); }
  if (still) return done();
  var img = box.querySelector('.dev-main img');
  function go() {
    box.classList.add('dev-on'); var t0 = performance.now() + 500, D = 4200;
    (function tick(now) {
      var f = Math.max(0, Math.min(1, (now - t0) / D)); show(Math.round(END * (1 - Math.pow(1 - f, 2))));
      if (f < 1) requestAnimationFrame(tick); else done();
    })(performance.now());
  }
  show(0);
  if (img && !img.complete) { img.addEventListener('load', go, { once: true }); img.addEventListener('error', done, { once: true }); } else go();
})();
