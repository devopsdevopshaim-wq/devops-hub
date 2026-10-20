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
