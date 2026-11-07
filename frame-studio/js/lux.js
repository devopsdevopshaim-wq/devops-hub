/* Quiet scroll reveals for the portfolio pieces (work grid, frames, albums). site.js reveals the section headings and cards. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px' });
  function watch(root) {
    (root || document).querySelectorAll('.w, .g-item, .album, .vid, .sec-lead, .work-cta').forEach(function (el) {
      if (el.classList.contains('lux-rv')) return;
      var sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.classList.add('lux-rv'); el.style.setProperty('--rv-d', (sib % 4) * 80 + 'ms'); io.observe(el);
    });
  }
  watch();
  new MutationObserver(function () { watch(); }).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
})();

/* the menu on tablets and phones: opens over the page, closes on a link, on Esc and on the button */
(function () {
  var btn = document.getElementById('menu-btn'), nav = document.querySelector('header.nav'), menu = document.getElementById('site-menu');
  if (!btn || !nav || !menu) return;
  function set(open) {
    nav.classList.toggle('menu-open', open); document.body.classList.toggle('menu-lock', open);
    btn.setAttribute('aria-expanded', String(open)); btn.querySelector('.menu-label').textContent = open ? 'סגירה' : 'תפריט';
    if (open) { var f = menu.querySelector('a'); if (f) setTimeout(function () { f.focus(); }, 60); }
  }
  btn.addEventListener('click', function () { set(!nav.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('menu-open')) { set(false); btn.focus(); } });
  window.addEventListener('resize', function () { if (window.innerWidth > 1120 && nav.classList.contains('menu-open')) set(false); });
})();
