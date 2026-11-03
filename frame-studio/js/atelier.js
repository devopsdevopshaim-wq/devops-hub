/* The opening's magnet: it develops from the white of the flash while the clock runs, the way it happens at the event
   (css/atelier.css). Once per visit; with "reduce motion" the finished print and the final time show at once. */
(function () {
  'use strict';
  var box = document.querySelector('.hero-art.dev'); if (!box) return;
  var clock = box.querySelector('.dev-clock b'), END = 47, still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(s) { clock.textContent = '00:' + ('0' + s).slice(-2); }
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
