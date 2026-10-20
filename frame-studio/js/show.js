/* פריים מגנטים · showcase motion. The page reads fully without it (no GSAP, or reduced motion: every finished state is shown):
   a camera flash on arrival, photo magnets that surface in a spotlight at their own depth (drag them, they follow the pointer in parallax),
   a minute on a watch dial scrubbed by scroll (flash → frame → print → in hand), a gold wipe between styles, quiet reveals. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  var anim = !!G && !!ST && !still;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- the business's own packages and questions ---------- */
  var FALLBACK = {
    packages: [
      { name: 'בסיסי', price: '₪1,490', hours: '3 שעות', magnets: 'עד 150 מגנטים', features: ['צלם/ת מקצועי/ת', 'מגנט 5×7.5 בעיצוב אישי', 'הדפסה במקום תוך דקה', 'עיצוב מסגרת עם שמות ותאריך'] },
      { name: 'פרימיום', price: '₪2,290', hours: '4 שעות', magnets: 'מגנטים ללא הגבלה', featured: true, features: ['צלם/ת + עמדת הדפסה מעוצבת', 'בחירה בין 2 גדלים', 'גלריה דיגיטלית לכל האורחים', 'עיצוב מסגרת מותאם לאירוע', 'אלבום מגנטים לזוג'] },
      { name: 'VIP', price: '₪3,190', hours: '5 שעות', magnets: 'ללא הגבלה + אלבום', features: ['2 צלמים/ות', 'מסגרות AI מותאמות לנושא', 'אלבום אורחים מעוצב', 'סרטון רגעים לאינסטגרם', 'מסך תצוגה חי של התמונות'] }
    ],
    faq: [['כמה זמן לוקח להדפיס מגנט?', 'פחות מדקה מהצילום ועד שהמגנט ביד. האורחים מקבלים אותו עוד באותו ערב.']]
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fill(b) {
    $('#tags').innerHTML = (b.packages || FALLBACK.packages).map(function (p) {
      return '<article class="tag' + (p.featured ? ' featured' : '') + '">' + (p.featured ? '<span class="badge">הכי מוזמנת</span>' : '') +
        '<h3>' + esc(p.name) + '</h3><p class="price">' + esc(p.price) + '</p><p class="meta">' + esc(p.hours) + ' · ' + esc(p.magnets) + '</p>' +
        '<ul>' + (p.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<a class="btn magnetic" href="#book">בודקים תאריך</a></article>';
    }).join('');
    $('#faq-list').innerHTML = (b.faq || FALLBACK.faq).map(function (q, i) { return '<details' + (i ? '' : ' open') + '><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('');
    magnetic(); if (anim) lateReveals();
  }
  fetch('business.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(fill, function () { fill(FALLBACK); });

  /* ---------- the bar turns to velvet glass once the hero is behind us ---------- */
  var top = $('#top');
  function bar() { top.classList.toggle('solid', window.scrollY > window.innerHeight * 0.6); }
  addEventListener('scroll', bar, { passive: true }); bar();

  /* ---------- buttons lean, just slightly, toward the pointer ---------- */
  function magnetic() {
    if (still || !fine) return;
    $$('.magnetic').forEach(function (b) {
      if (b._mag) return; b._mag = true;
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; b.style.transform = 'translate(' + x * 0.12 + 'px,' + y * 0.2 + 'px)'; });
      b.addEventListener('pointerleave', function () { b.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1), background-position 1.1s cubic-bezier(.2,.8,.2,1)'; b.style.transform = ''; setTimeout(function () { b.style.transition = ''; }, 620); });
    });
  }
  magnetic();

  /* ---------- the magnets in the spotlight: drag them anywhere on the stage ---------- */
  var board = $('#board'), mags = $$('.mag', board), zTop = 40;
  function rotOf(m) { return parseFloat(getComputedStyle(m).getPropertyValue('--r')) || 0; }
  mags.forEach(function (m) {
    var sx, sy, ox, oy, moved;
    m.addEventListener('pointerdown', function (e) {
      e.preventDefault(); m.setPointerCapture(e.pointerId); m.classList.add('held'); m.style.zIndex = ++zTop; moved = false;
      sx = e.clientX; sy = e.clientY; ox = m.offsetLeft; oy = m.offsetTop;
      if (anim) G.to(m, { scale: 1.05, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    });
    m.addEventListener('pointermove', function (e) {
      if (!m.hasPointerCapture(e.pointerId)) return;
      var dx = e.clientX - sx, dy = e.clientY - sy, W = board.clientWidth, H = board.clientHeight, tilt = Math.max(-12, Math.min(12, dx * 0.04)); moved = true;
      m.style.left = Math.max(-m.offsetWidth * 0.3, Math.min(W - m.offsetWidth * 0.7, ox + dx)) + 'px';
      m.style.top = Math.max(-m.offsetHeight * 0.2, Math.min(H - m.offsetHeight * 0.6, oy + dy)) + 'px';
      if (anim) G.to(m, { rotation: tilt, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
      else m.style.transform = 'rotate(' + tilt + 'deg) scale(1.04)';
    });
    function drop() {
      if (!m.classList.contains('held')) return; m.classList.remove('held');
      var r = +(Math.random() * 10 - 5).toFixed(1);
      if (anim) G.to(m, { rotation: moved ? r : rotOf(m), scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.6)', overwrite: 'auto' });
      else if (moved) m.style.transform = 'rotate(' + r + 'deg)';
      else m.style.transform = '';
    }
    m.addEventListener('pointerup', drop); m.addEventListener('pointercancel', drop);
  });

  /* ---------- one photo, many worlds: a gold seam wipes in the new style ---------- */
  var cur = 'original', base = $('#w-base'), topImg = $('#w-top'), wName = $('#w-name'), wipe = $('.wipe'), busy = false;
  $$('.chips button').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = b.dataset.s; if (s === cur || busy) return; busy = true;
      $$('.chips button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      var src = 'show/p-' + s + '.webp', done = function () { base.src = src; base.alt = b.textContent; topImg.style.clipPath = 'inset(0 0 0 100%)'; cur = s; busy = false; };
      var im = new Image(); im.onload = im.onerror = function () {
        topImg.src = src; wName.textContent = b.textContent;
        if (anim) {
          G.fromTo(topImg, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.9, ease: 'power3.inOut', onComplete: done });
          G.fromTo(wipe, { left: '100%', opacity: 1 }, { left: '0%', duration: 0.9, ease: 'power3.inOut' });
          G.to(wipe, { opacity: 0, duration: 0.3, delay: 0.8 });
          G.fromTo(wName, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.3, ease: 'power2.out' });
        } else done();
      }; im.src = src;
    });
  });
  /* the chips also move with the arrow keys, as a radio group should */
  $('.chips').addEventListener('keydown', function (e) {
    var l = $$('.chips button'), i = l.indexOf(document.activeElement); if (i < 0) return;
    var n = e.key === 'ArrowLeft' ? i + 1 : e.key === 'ArrowRight' ? i - 1 : -1; if (n < 0 && e.key !== 'ArrowRight') return;
    e.preventDefault(); n = (n + l.length) % l.length; l[n].focus(); l[n].click();
  });

  /* ---------- your own magnet, live: names, date, event, frame colour, your photo (kept in the browser) ---------- */
  var ym = $('#ymag'), st = { ev: 'חתונה', color: 'לבן' };
  function heDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function bump() { if (still) return; ym.classList.remove('bump'); void ym.offsetWidth; ym.classList.add('bump'); }
  function send() {
    var t = 'היי! עיצבתי מגנט באתר ואשמח לבדוק תאריך 🙂\nשמות: ' + ($('#y-n').value.trim() || '—') + '\nתאריך: ' + (heDate($('#y-d').value) || '—') + '\nאירוע: ' + st.ev + '\nצבע מסגרת: ' + st.color;
    $('#y-send').href = 'https://wa.me/972544979771?text=' + encodeURIComponent(t);
  }
  $('#y-n').addEventListener('input', function () { $('#y-names').textContent = this.value.trim() || ' '; send(); });
  $('#y-n').addEventListener('change', bump);
  $('#y-d').addEventListener('input', function () { $('#y-date').textContent = heDate(this.value); send(); bump(); });
  $$('#y-ev button').forEach(function (b) { b.addEventListener('click', function () { $$('#y-ev button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); st.ev = b.dataset.v; send(); }); });
  $$('#y-c button').forEach(function (b) { b.addEventListener('click', function () {
    $$('#y-c button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    ym.style.setProperty('--fc', b.dataset.fc); ym.style.setProperty('--tc', b.dataset.tc); st.color = b.getAttribute('aria-label'); send(); bump();
  }); });
  $('#y-f').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var u = URL.createObjectURL(f), im = $('#y-img'); im.onload = function () { bump(); }; im.src = u; });
  send();

  /* ---------- the film: one quiet play button over the poster ---------- */
  var screen = $('.screen'), video = $('.screen video');
  $('.play').addEventListener('click', function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); video.focus(); });
  video.addEventListener('play', function () { screen.classList.add('playing'); });

  /* ---------- the minute: a watch dial, sixty ticks ---------- */
  var ticks = $('.dial .ticks'), NS = 'http://www.w3.org/2000/svg';
  for (var t = 0; t < 60; t++) {
    var a = t / 60 * Math.PI * 2, major = t % 15 === 0, r1 = major ? 80 : 84, r2 = 87, ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', 100 + Math.sin(a) * r1); ln.setAttribute('y1', 100 - Math.cos(a) * r1);
    ln.setAttribute('x2', 100 + Math.sin(a) * r2); ln.setAttribute('y2', 100 - Math.cos(a) * r2);
    if (major) ln.setAttribute('class', 'major');
    ticks.appendChild(ln);
  }
  var clock = $('#clock'), steps = $$('.steps li'), stepsBox = $('.steps'), arc = $('#arc');
  function stepAt(sec) {
    var at = [0, 15, 40, 60], k = 0; at.forEach(function (t, i) { if (sec >= t - 0.5) k = i; });
    steps.forEach(function (li, i) { li.classList.toggle('on', i <= k); li.classList.toggle('cur', i === k); });
    stepsBox.style.setProperty('--fill', (sec / 60).toFixed(3));
  }

  if (!anim) {
    /* no motion: the finished states */
    $('.card .framed').style.opacity = 1; stepAt(60); clock.textContent = '1:00';
    return;
  }

  /* ---------- arrival: the flash, the magnets surface in the light, the gold headline ---------- */
  var byDepth = mags.slice().sort(function (a, b) { return parseFloat(a.style.getPropertyValue('--d')) - parseFloat(b.style.getPropertyValue('--d')); });
  mags.forEach(function (m) { G.set(m, { rotation: rotOf(m) }); });
  var imgs = byDepth.map(function (m) { return m.querySelector('img'); });
  var intro = G.timeline({ defaults: { ease: 'expo.out' } });
  intro.fromTo('.flash', { opacity: 0 }, { opacity: 0.92, duration: 0.07, ease: 'none' }, 0.15)
    .to('.flash', { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0.22)
    .from('.beam, .hero-light, .floor', { opacity: 0, duration: 1.8, ease: 'power2.out' }, 0.2)
    .fromTo(imgs, { opacity: 0, y: 46, scale: 1.1, filter: 'blur(14px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.9, stagger: 0.12, clearProps: 'filter' }, 0.25)
    .from('.hero .eyebrow', { opacity: 0, y: 12, duration: 1 }, 0.55)
    .from('.hero h1 .ln > span', { yPercent: 112, duration: 1.4, stagger: 0.14 }, 0.6)
    .fromTo('.hero h1 .foil', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 2.4, ease: 'power2.inOut' }, 0.7)
    .from('.sub, .hero .ctas, .kinds', { opacity: 0, y: 16, duration: 1.1, stagger: 0.1 }, 1.15)
    .from('.drag-hint, .cue', { opacity: 0, duration: 1 }, 1.8)
    .add(function () {
      /* then they breathe: each at its own pace */
      imgs.forEach(function (im, i) { G.to(im, { y: -8 - i * 1.5, rotation: (i % 2 ? 0.8 : -0.8), duration: 3.2 + i * 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1 }); });
    }, 2.1);

  /* the pointer moves the light and the magnets at their depth */
  if (fine) {
    var movers = mags.map(function (m) { var d = parseFloat(m.style.getPropertyValue('--d')) || 0.5; return { m: m, d: d, x: G.quickTo(m, 'x', { duration: 1.2, ease: 'power3.out' }), y: G.quickTo(m, 'y', { duration: 1.2, ease: 'power3.out' }) }; });
    var beamX = G.quickTo('.beam', 'x', { duration: 1.6, ease: 'power3.out' });
    $('.hero').addEventListener('pointermove', function (e) {
      var nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      movers.forEach(function (o) { if (o.m.classList.contains('held')) return; o.x(nx * 34 * o.d); o.y(ny * 22 * o.d); });
      beamX(nx * 30);
    });
  }
  /* scrolling away: nearer magnets drift faster, the copy recedes */
  mags.forEach(function (m) {
    var d = parseFloat(m.style.getPropertyValue('--d')) || 0.5;
    G.to(m, { yPercent: -18 - d * 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  G.to('.hero-copy', { y: -60, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true } });

  /* ---------- the minute, scrubbed: flash, the frame lands, into the print slot, out as a magnet, in hand ---------- */
  var card = $('.card'), mm = G.matchMedia();
  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, function (c) {
    G.set(arc, { strokeDashoffset: 100 });
    var tl = G.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: '.minute-pin', start: 'top top', end: c.conditions.wide ? '+=2600' : '+=1700', scrub: 0.8, pin: true, anticipatePin: 1,
      onUpdate: function (self) { var s = Math.round(self.progress * 60); clock.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); stepAt(s); } } });
    tl.to(arc, { strokeDashoffset: 0, duration: 6, ease: 'none' }, 0)
      /* 0:00 the flash */
      .fromTo('.finder', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.5 }, 0)
      .fromTo('.card .photo', { filter: 'brightness(.25) blur(6px)' }, { filter: 'brightness(1) blur(0px)', duration: 0.5 }, 0.15)
      .fromTo('.burst', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.25 }, 0.15)
      .to('.burst', { opacity: 0, duration: 0.9, ease: 'power2.in' }, 0.4)
      /* 0:15 the frame */
      .fromTo('.card .framed', { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1 }, 1.5)
      .to('.finder', { opacity: 0, scale: 1.05, duration: 0.6 }, 2.2)
      /* 0:30 into the slot, 0:42 out, printed */
      .to('.slot i', { opacity: 1, duration: 0.5 }, 2.8)
      .to(card, { yPercent: 118, duration: 1.1, ease: 'power2.in' }, 3)
      .to(card, { yPercent: 0, duration: 1.3, ease: 'power3.out' }, 4.2)
      .fromTo('.card .sheen::before', {}, {}, 4.2)
      .fromTo('.card .sheen', { '--s': 0 }, { '--s': 1, duration: 0.01 }, 4.2)
      .to('.slot i', { opacity: 0.55, duration: 0.5 }, 5)
      /* 0:55 in hand */
      .to(card, { yPercent: -4, rotation: -3, scale: 1.06, duration: 0.8, ease: 'back.out(1.4)' }, 5.2);
    var shine = G.fromTo('.card .sheen', { '--sx': '-60%' }, { '--sx': '160%', duration: 1, ease: 'power2.inOut', paused: true });
    tl.add(function () { shine.restart(); }, 5.3);
    return function () { G.set([card, '.card .framed', '.card .photo', '.finder', '.burst', '.slot i', arc], { clearProps: 'all' }); };
  });

  /* ---------- section reveals ---------- */
  $$('.worlds .eyebrow, .worlds .display, .worlds .lead, .pick-h, .chips, .pick-note, .yours .eyebrow, .yours .display, .wall .eyebrow, .wall .display, .packages .eyebrow, .packages .display, .film .eyebrow, .film .display, .faq .eyebrow, .faq .display, .book .eyebrow, .book .display, .book .lead, .book .ctas, .facts').forEach(function (el) {
    G.from(el, { y: 28, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  G.from('.viewer', { clipPath: 'inset(8% 8% 8% 8% round 18px)', scale: 1.04, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.viewer', start: 'top 85%' } });
  G.from('.ystage', { y: 50, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.ystage', start: 'top 88%' } });
  G.from('.ymag', { y: 30, rotation: -8, duration: 1.4, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: '.ystage', start: 'top 80%' } });
  G.from('.yform > *', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: '.yform', start: 'top 88%' } });
  G.from('.wall-grid li', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, clearProps: 'transform', scrollTrigger: { trigger: '.wall-grid', start: 'top 85%' } });
  G.from('.screen', { y: 50, scale: 0.96, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.screen', start: 'top 88%' } });
  G.fromTo('.book-light', { opacity: 0.3 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.book', start: 'top bottom', end: 'top 30%', scrub: true } });

  function lateReveals() {
    if ($$('.tag').length) G.from('.tag', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.tags', start: 'top 85%' } });
    if ($$('.faq details').length) G.from('.faq details', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '#faq-list', start: 'top 88%' } });
    ST.refresh();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  addEventListener('load', function () { ST.refresh(); });
})();
