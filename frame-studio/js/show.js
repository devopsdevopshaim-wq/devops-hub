/* פריים סטודיו · showcase motion. The page reads fully without it (no GSAP, or reduced motion: every finished state is shown):
   the studio's work rises into the hero at its own depth, a slideshow that plays while it is seen,
   the design process scrubbed by scroll (raw → selection → design → finished piece), a gold seam between styles, quiet reveals. */
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
    var t = 'היי! עיצבתי באתר הדמיה לאירוע ואשמח לבדוק תאריך 🙂\nשמות: ' + ($('#y-n').value.trim() || '—') + '\nתאריך: ' + (heDate($('#y-d').value) || '—') + '\nאירוע: ' + st.ev + '\nצבע מסגרת: ' + st.color;
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

  /* ---------- the slideshow plays only while it is on screen ---------- */
  var slides = $$('#slides img'), sBar = $('#slides .bar'), sI = 0, sTimer = null, SLIDE = 2800;
  function nextSlide() {
    slides[sI].classList.remove('on'); sI = (sI + 1) % slides.length; slides[sI].classList.add('on');
    if (G) G.fromTo(sBar, { '--p': 0 }, { '--p': 1, duration: SLIDE / 1000, ease: 'none' });
  }
  if (!still && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !sTimer) { if (G) G.fromTo(sBar, { '--p': 0 }, { '--p': 1, duration: SLIDE / 1000, ease: 'none' }); sTimer = setInterval(nextSlide, SLIDE); }
        else if (!e.isIntersecting && sTimer) { clearInterval(sTimer); sTimer = null; }
      });
    }, { threshold: 0.35 }).observe($('#slides'));
  }

  /* ---------- the process ---------- */
  var steps = $$('.steps li'), stepsBox = $('.steps'), pnum = $('#pnum');
  function stepAt(p) {
    var k = Math.min(3, Math.floor(p * 4 + 0.001));
    steps.forEach(function (li, i) { li.classList.toggle('on', i <= k); li.classList.toggle('cur', i === k); });
    stepsBox.style.setProperty('--fill', Math.min(1, p).toFixed(3));
    pnum.textContent = '0' + (k + 1);
  }

  if (!anim) {
    /* no motion: the finished piece, every step shown */
    stepAt(1); $('.pstage').classList.add('final');
    return;
  }

  /* ---------- arrival: the work rises into the light, the headline follows ---------- */
  var tiles = $$('.tile'), depth = function (el) { return parseFloat(el.style.getPropertyValue('--d')) || 0.5; };
  var byDepth = tiles.slice().sort(function (a, b) { return depth(a) - depth(b); });
  var intro = G.timeline({ defaults: { ease: 'expo.out' } });
  intro.from('.hero-light', { opacity: 0, duration: 2, ease: 'power2.out' }, 0)
    .fromTo(byDepth.map(function (t) { return t.querySelector('.ph'); }), { clipPath: 'inset(100% 0% 0% 0%)', y: 40 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.6, stagger: 0.12 }, 0.15)
    .from(byDepth.map(function (t) { return t.querySelector('img'); }), { scale: 1.3, duration: 2.2, stagger: 0.12 }, 0.15)
    .from(byDepth.map(function (t) { return t.querySelector('figcaption'); }), { opacity: 0, y: 8, duration: 1, stagger: 0.1 }, 1)
    .from('.hero .eyebrow', { opacity: 0, y: 12, duration: 1 }, 0.35)
    .from('.hero h1 .ln > span', { yPercent: 112, duration: 1.4, stagger: 0.14 }, 0.4)
    .fromTo('.hero h1 .foil', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 2.4, ease: 'power2.inOut' }, 0.6)
    .from('.sub, .hero .ctas', { opacity: 0, y: 16, duration: 1.1, stagger: 0.1 }, 0.95);

  /* the pointer moves the work at its depth; scrolling away, nearer pieces drift faster */
  if (fine) {
    var movers = tiles.map(function (t) { return { d: depth(t), x: G.quickTo(t, 'x', { duration: 1.4, ease: 'power3.out' }), y: G.quickTo(t, 'y', { duration: 1.4, ease: 'power3.out' }) }; });
    $('.hero').addEventListener('pointermove', function (e) {
      var nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      movers.forEach(function (o) { o.x(nx * 30 * o.d); o.y(ny * 20 * o.d); });
    });
  }
  tiles.forEach(function (t) {
    G.to(t, { yPercent: -10 - depth(t) * 26, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  G.to('.hero-copy', { y: -50, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true } });

  /* ---------- the process, scrubbed: raw frames, one chosen, designed, finished ---------- */
  var mm = G.matchMedia();
  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, function (c) {
    var shots = $$('.shot'), pick = $('.shot.pick'), others = shots.filter(function (s) { return s !== pick; });
    var tl = G.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: '.proc-pin', start: 'top top', end: c.conditions.wide ? '+=2600' : '+=1800', scrub: 0.8, pin: true, anticipatePin: 1,
      onUpdate: function (self) { stepAt(self.progress); } } });
    G.set('.piece', { left: '35%', top: '3%', width: '30%', opacity: 0 });
    G.set('.piece .raw', { filter: 'saturate(.7) contrast(.92) brightness(.9)' });
    G.set('.piece .framed', { opacity: 0 });
    G.set('.done', { opacity: 0, y: 10 });
    /* 01 raw */
    G.from(shots, { opacity: 0, y: 30, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.pstage', start: 'top 80%' } });
    tl.to(shots, { y: 0, duration: 0.6 }, 0)
    /* 02 selection */
      .to(others, { opacity: 0.22, duration: 0.4 }, 1.0)
      .to(pick, { outlineColor: 'rgba(214,183,126,1)', duration: 0.3 }, 1.0)
      .set('.piece', { opacity: 1 }, 1.55)
      .to(others, { opacity: 0, duration: 0.4 }, 1.55)
      .to(pick, { opacity: 0, duration: 0.1 }, 1.6)
      .to('.piece', { left: '22%', top: '2%', width: '56%', duration: 0.6, ease: 'power3.inOut' }, 1.55)
    /* 03 design */
      .fromTo('.guide', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, stagger: 0.05 }, 2.1)
      .to('.piece .raw', { filter: 'saturate(1) contrast(1) brightness(1)', duration: 0.4 }, 2.15)
      .fromTo('.piece .framed', { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.45 }, 2.35)
      .fromTo('.note', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.1 }, 2.4)
    /* 04 finished */
      .to('.guide, .note', { opacity: 0, duration: 0.3 }, 3.05)
      .to('.piece', { rotation: -2.5, scale: 1.02, duration: 0.5, ease: 'back.out(1.4)' }, 3.15)
      .fromTo('.piece .sheen', { '--sx': '-60%' }, { '--sx': '160%', duration: 0.5, ease: 'power2.inOut' }, 3.2)
      .to('.done', { opacity: 1, y: 0, duration: 0.3 }, 3.4)
      .to({}, { duration: 0.35 }, 3.65);
    return function () { G.set(['.piece', '.piece .raw', '.piece .framed', '.done', '.guide', '.note', '.shot'], { clearProps: 'all' }); };
  });

  /* ---------- section reveals ---------- */
  $$('.sec-head .eyebrow, .sec-head .display, .sec-head .lead, .worlds .eyebrow, .worlds .display, .worlds .lead, .pick-h, .chips, .pick-note, .yours .eyebrow, .yours .display, .yours .lead, .faq .eyebrow, .faq .display, .book .eyebrow, .book .display, .book .lead, .book .ctas, .facts').forEach(function (el) {
    G.from(el, { y: 28, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  $$('.w').forEach(function (w) {
    var v = w.querySelector('.vis');
    G.fromTo(v, { clipPath: 'inset(12% 0% 0% 0% round 18px)', y: 40, opacity: 0 }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', y: 0, opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: w, start: 'top 88%' } });
    G.from(w.querySelector('.cap'), { y: 20, opacity: 0, duration: 1, delay: 0.15, ease: 'power3.out', scrollTrigger: { trigger: w, start: 'top 88%' } });
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
