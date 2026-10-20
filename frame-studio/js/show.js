/* פריים מגנטים · showcase motion. The page reads fully without it (GSAP from the CDN, reduced motion respected):
   a camera flash on arrival, letter magnets and photo magnets that snap onto the fridge and can be dragged,
   a minute scrubbed by scroll (flash → frame → print → in hand), a wipe between styles, magnetic buttons. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  var anim = !!G && !still;

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
    magnetic(); if (anim) reveals();
  }
  fetch('business.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(fill, function () { fill(FALLBACK); });

  /* ---------- the bar turns solid over the dark parts ---------- */
  var top = $('#top');
  function bar() { top.classList.toggle('solid', window.scrollY > window.innerHeight * 0.7); }
  addEventListener('scroll', bar, { passive: true }); bar();

  /* ---------- buttons lean toward the pointer, as if pulled by a magnet ---------- */
  function magnetic() {
    if (still || !matchMedia('(hover: hover)').matches) return;
    $$('.magnetic').forEach(function (b) {
      if (b._mag) return; b._mag = true;
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; b.style.transform = 'translate(' + x * 0.22 + 'px,' + y * 0.32 + 'px)'; });
      b.addEventListener('pointerleave', function () { b.style.transition = 'transform .45s cubic-bezier(.2,1.6,.4,1)'; b.style.transform = ''; setTimeout(function () { b.style.transition = ''; }, 460); });
    });
  }
  magnetic();

  /* ---------- drag the magnets on the door ---------- */
  var board = $('#board'), zTop = 10;
  $$('.mag', board).forEach(function (m) {
    var sx, sy, ox, oy, moved;
    m.addEventListener('pointerdown', function (e) {
      e.preventDefault(); m.setPointerCapture(e.pointerId); m.classList.add('held'); m.style.zIndex = ++zTop; moved = false;
      sx = e.clientX; sy = e.clientY; ox = m.offsetLeft; oy = m.offsetTop;
    });
    m.addEventListener('pointermove', function (e) {
      if (!m.hasPointerCapture(e.pointerId)) return;
      var dx = e.clientX - sx, dy = e.clientY - sy, W = board.clientWidth, H = board.clientHeight; moved = true;
      m.style.left = Math.max(-m.offsetWidth * 0.3, Math.min(W - m.offsetWidth * 0.7, ox + dx)) + 'px';
      m.style.top = Math.max(-m.offsetHeight * 0.2, Math.min(H - m.offsetHeight * 0.6, oy + dy)) + 'px';
      m.style.transform = 'rotate(' + Math.max(-12, Math.min(12, dx * 0.04)) + 'deg) scale(1.04)';
    });
    function drop(e) {
      if (!m.classList.contains('held')) return; m.classList.remove('held');
      var r = (Math.random() * 10 - 5).toFixed(1) + 'deg';
      if (moved && m.animate && !still) m.animate([{ transform: m.style.transform }, { transform: 'rotate(' + r + ') scale(.97)' }, { transform: 'rotate(' + r + ') scale(1.01)' }, { transform: 'rotate(' + r + ') scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      m.style.transform = 'rotate(' + r + ')';
    }
    m.addEventListener('pointerup', drop); m.addEventListener('pointercancel', drop);
  });

  /* ---------- one photo, many worlds: a wipe from the previous style ---------- */
  var cur = 'original', base = $('#w-base'), topImg = $('#w-top'), busy = false;
  $$('.chips button').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = b.dataset.s; if (s === cur || busy) return; busy = true;
      $$('.chips button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      var src = 'show/p-' + s + '.webp', done = function () { base.src = src; base.alt = b.textContent; topImg.style.clipPath = 'inset(0 0 0 100%)'; cur = s; busy = false; };
      var im = new Image(); im.onload = im.onerror = function () {
        topImg.src = src;
        if (anim) G.fromTo(topImg, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.75, ease: 'power3.inOut', onComplete: done });
        else done();
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

  /* ---------- the minute ---------- */
  var clock = $('#clock'), steps = $$('.steps li');
  function stepAt(sec) { var at = [0, 15, 40, 60], k = 0; at.forEach(function (t, i) { if (sec >= t - 0.5) k = i; }); steps.forEach(function (li, i) { li.classList.toggle('on', i <= k); }); }

  if (!anim) {
    /* no motion: the finished states */
    $('.card .framed').style.opacity = 1; steps.forEach(function (li) { li.classList.add('on'); }); clock.textContent = '1:00';
    return;
  }

  /* ---------- arrival: the flash, the letters, the magnets ---------- */
  var intro = G.timeline({ defaults: { ease: 'power3.out' } });
  intro.fromTo('.flash', { opacity: 1 }, { opacity: 0, duration: 0.9, ease: 'power2.in' })
    .from('.hero-copy .eyebrow', { y: 14, opacity: 0, duration: 0.5 }, 0.25)
    .from('.lm', { y: -160, rotation: function () { return G.utils.random(-40, 40); }, opacity: 0, duration: 0.7, ease: 'back.out(2.2)', stagger: 0.07 }, 0.3)
    .from('.sub, .hero-copy .ctas', { y: 18, opacity: 0, duration: 0.6, stagger: 0.1 }, 0.85)
    .from('.mag', { y: -220, scale: 1.15, opacity: 0, rotation: function () { return G.utils.random(-25, 25); }, duration: 0.65, ease: 'back.out(1.8)', stagger: 0.12, clearProps: 'transform' }, 0.55)
    .from('.handle', { x: 30, opacity: 0, duration: 0.6 }, 0.4)
    .from('.drag-hint', { opacity: 0, duration: 0.5 }, 1.6);

  /* the minute, scrubbed: flash, the frame lands, into the printer, out as a magnet */
  var card = $('.card'), mm = G.matchMedia();
  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, function (c) {
    var tl = G.timeline({ scrollTrigger: { trigger: '.minute-pin', start: 'top top', end: c.conditions.wide ? '+=2200' : '+=1500', scrub: 0.6, pin: true,
      onUpdate: function (self) { var s = Math.round(self.progress * 60); clock.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); stepAt(s); } } });
    tl.fromTo('.burst', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' })
      .to('.burst', { opacity: 0, duration: 0.8 })
      .fromTo('.card .framed', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 1.1)
      .to(card, { yPercent: 72, scale: 0.84, duration: 1.4, ease: 'power2.in' }, 2.6)
      .to(card, { yPercent: -6, rotation: 4, scale: 0.92, duration: 1.4, ease: 'back.out(1.5)' }, 4.2)
      .to(card, { rotation: -2, scale: 0.94, duration: 0.6, ease: 'sine.inOut' }, 5.6);
    return function () { G.set(card, { clearProps: 'all' }); };
  });

  /* ---------- section reveals ---------- */
  function reveals() {
    $$('.display:not(#minute-title), .lead, .eyebrow:not(.hero-copy .eyebrow)').forEach(function (el) {
      if (el._rv) return; el._rv = true;
      G.from(el, { y: 26, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    G.from('.wall-grid li', { y: -90, opacity: 0, rotation: function () { return G.utils.random(-20, 20); }, duration: 0.6, ease: 'back.out(1.7)', stagger: 0.08, clearProps: 'transform', scrollTrigger: { trigger: '.wall-grid', start: 'top 80%' } });
    if ($$('.tag').length) G.from('.tag', { y: 80, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12, clearProps: 'transform', scrollTrigger: { trigger: '.tags', start: 'top 82%' } });
    G.from('.screen', { scale: 0.92, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.screen', start: 'top 85%' } });
    G.fromTo('.horseshoe', { y: -120, rotation: 170 }, { y: 0, rotation: 180, ease: 'none', scrollTrigger: { trigger: '.book', start: 'top bottom', end: 'top 30%', scrub: true } });
    ST.refresh();
  }
})();
