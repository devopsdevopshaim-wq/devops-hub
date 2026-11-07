/* ✨ Shine (css/shine.css): the light under the pointer, the 3D tilt, the scroll line, and in the opening the moving light,
   the stardust and a gentle depth on the pictures. Light on the computer: one listener, work only on what is under the
   pointer, the stardust pauses when it is off screen or the tab is hidden. Nothing with "reduce motion" or on touch. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  var SPOT = '.w, .g-item, .album, .vid, .pk, .steps li, .ic-card, .rv, .faq details, .ai-style, .fx-t, .mt-card, .mt-ai-g button, .la-card, .card';
  var TILT = '.w, .pk, .g-item, .album, .fx-t';

  /* mark the cards: only those whose ::after is free (so nothing that already uses it changes) */
  function mark(root) {
    (root || document).querySelectorAll(SPOT).forEach(function (el) {
      if (el._sh) return; el._sh = 1;
      try { if (getComputedStyle(el, '::after').content !== 'none') return; } catch (e) { return; }
      var pos = getComputedStyle(el).position; if (pos === 'static') el.style.position = 'relative';
      el.classList.add('sh');
      if (!reduce && !touch && el.matches(TILT)) el.classList.add('sh-tilt');
    });
  }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    mark();
    var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { mark(); }, 250); }).observe(document.body, { childList: true, subtree: true });
  });

  if (!touch) {
    var last = null, raf = 0, ev = null;
    document.addEventListener('pointermove', function (e) { ev = e; if (!raf) raf = requestAnimationFrame(move); }, { passive: true });
    function move() {
      raf = 0; var e = ev; if (!e || !e.target || !e.target.closest) return;
      var el = e.target.closest('.sh');
      if (last && last !== el) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); last.classList.remove('sh-on'); }
      last = el; if (!el) return;
      var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
      if (el.classList.contains('sh-tilt')) { el.classList.add('sh-on'); el.style.setProperty('--ry', ((x / r.width - 0.5) * 8).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((0.5 - y / r.height) * 6).toFixed(2) + 'deg'); }
    }
  }

  /* the rest is for the site's pages (not the program) */
  ready(function () {
    if (document.body.classList.contains('studio') || document.getElementById('mt') || /studio\.html/.test(location.pathname)) return;
    /* the scroll line */
    var bar = document.createElement('div'); bar.id = 'sh-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
    var pr = 0; function prog() { pr = 0; var h = document.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0); }
    addEventListener('scroll', function () { if (!pr) pr = requestAnimationFrame(prog); }, { passive: true }); prog();
    /* the section titles draw their gold line when they come in */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sh-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
      document.querySelectorAll('.sec > h2').forEach(function (h) { io.observe(h); });
    }
    var hero = document.querySelector('.hero'); if (!hero || reduce) return;
    /* the moving light */
    var light = hero.querySelector('.hero-light'), after = light ? light.nextSibling : hero.firstChild;
    var au = document.createElement('div'); au.className = 'sh-aurora'; au.setAttribute('aria-hidden', 'true'); au.innerHTML = '<i></i><i></i><i></i>'; hero.insertBefore(au, after);
    /* stardust: gold specks that drift up and twinkle */
    var cv = document.createElement('canvas'); cv.className = 'sh-dust'; cv.setAttribute('aria-hidden', 'true'); hero.insertBefore(cv, au.nextSibling);
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), P = [], on = true, rafD = 0;
    function size() { var r = hero.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener('resize', size);
    var N = Math.round(Math.min(90, Math.max(36, W * H / 16000)));
    for (var i = 0; i < N; i++) P.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, s: 0.2 + Math.random() * 0.8, p: Math.random() * 6.28 });
    var mx = 0, my = 0;
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; }, { passive: true });
    function frame(t) {
      rafD = 0; if (!on) return;
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < P.length; k++) {
        var p = P[k]; p.y -= 0.00022 * p.s; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        var x = (p.x + mx * 0.03 * p.z) * W, y = (p.y + my * 0.03 * p.z) * H, tw = 0.45 + 0.55 * Math.sin(t / 700 * p.s + p.p), r = 0.6 + p.z * 1.9;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, 'rgba(255,236,190,' + (0.75 * tw * p.z) + ')'); g.addColorStop(1, 'rgba(243,221,166,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.2832); ctx.fill();
      }
      /* the pictures follow the pointer a little, each at its own depth */
      arts.forEach(function (a, j) { var d = (j % 2 ? 10 : 16); a.style.translate = (-mx * d).toFixed(1) + 'px ' + (-my * d).toFixed(1) + 'px'; });
      rafD = requestAnimationFrame(frame);
    }
    var arts = Array.prototype.slice.call(hero.querySelectorAll('.hero-art .ha'));
    function go() { if (on && !rafD) rafD = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting && !document.hidden; go(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { on = !document.hidden; go(); });
    go();
  });
})();
