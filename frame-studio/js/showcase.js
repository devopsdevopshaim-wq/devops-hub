/* Showcase (css/showcase.css): the top bar tightening on scroll and marking where you are, the opening's hall lights, the
   pointer light and the tilting prints, and on a phone the bottom bar with "בדיקת תאריך" and
   WhatsApp once the opening is passed. Quiet with "reduce motion" and in light mode. */
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = function () { return document.documentElement.classList.contains('fs-lite'); };
  var nav = document.querySelector('.nav'), hero = document.querySelector('.hero');

  /* the top bar */
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('.links > a[href^="#"]')) : [];
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var bar = null, ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || 0;
    if (nav) nav.classList.toggle('sc-tight', y > 40);
    var mid = y + innerHeight * 0.35, on = -1;
    secs.forEach(function (s, i) { if (s && !s.hidden && s.offsetTop <= mid) on = i; });
    links.forEach(function (a, i) { a.classList.toggle('sc-on', i === on); });
    if (bar) {
      var past = hero ? y > hero.offsetTop + hero.offsetHeight * 0.7 : y > 500;
      var contact = document.getElementById('contact'), atForm = contact && y + innerHeight > contact.offsetTop + 120;
      var show = past && !atForm;
      bar.classList.toggle('sc-show', show); document.body.classList.toggle('sc-bar-on', show);
      document.body.classList.toggle('sc-past', past);
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* the phone's bottom bar: the date check goes to the form, WhatsApp the way the top button goes */
  var cta = document.querySelector('.nav-cta [data-wa]');
  bar = document.createElement('div'); bar.className = 'sc-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'פעולות מהירות');
  bar.innerHTML = '<a class="sc-date" href="#contact">📅 בדיקת תאריך פנוי</a><a class="sc-wa" href="#contact" aria-label="וואטסאפ"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg></a>';
  document.body.appendChild(bar);
  bar.querySelector('.sc-wa').addEventListener('click', function (e) { if (cta) { e.preventDefault(); cta.click(); } });
  onScroll();

  if (still) return;

  /* the opening: hall lights, a light under the pointer, prints that tilt with it */
  if (hero) {
    var L = document.createElement('div'); L.className = 'sc-lights'; L.setAttribute('aria-hidden', 'true');
    var h = '';
    for (var i = 0; i < 14; i++) {
      var s = 6 + ((i * 53) % 34), x = (i * 71) % 100, y = (i * 37) % 100;
      h += '<i style="width:' + s + 'px;height:' + s + 'px;left:' + x + '%;top:' + y + '%;--d:' + (14 + (i % 5) * 4) + 's;--dl:' + (i % 7) * 0.35 + 's;--o:' + (0.28 + (i % 4) * 0.1) + ';--x:' + (((i * 29) % 80) - 40) + 'px;--y:' + (((i * 43) % 90) - 45) + 'px"></i>';
    }
    L.innerHTML = h; hero.insertBefore(L, hero.firstChild);
    var spot = document.createElement('div'); spot.className = 'sc-spot'; spot.setAttribute('aria-hidden', 'true'); hero.insertBefore(spot, hero.firstChild);
    var cue = document.createElement('a'); cue.className = 'sc-cue'; cue.href = '#mwall'; cue.innerHTML = '<i></i>גללו'; cue.setAttribute('aria-label', 'גלילה לקיר המגנטים'); hero.appendChild(cue);

    var art = hero.querySelector('.hero-art.dev'), tilt = null;
    if (art) {
      tilt = document.createElement('div'); tilt.className = 'sc-tilt';
      Array.prototype.slice.call(art.children).forEach(function (c) { tilt.appendChild(c); });
      art.appendChild(tilt);
    }
    var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
    if (fine) hero.addEventListener('pointermove', function (e) {
      if (lite()) return;
      var r = hero.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      spot.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); spot.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (tilt) { tilt.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg'); tilt.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg'); }
    });
    hero.addEventListener('pointerleave', function () { if (tilt) { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); } });
  }

})();
