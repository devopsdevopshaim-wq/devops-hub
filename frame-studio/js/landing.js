/* The per-event pages (l/*.html): refresh the packages from business.json, so prices changed in the studio show at once. */
(function () {
  'use strict';
  var box = document.getElementById('pk'); if (!box || !window.fetch) return;
  var ev = box.getAttribute('data-event');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* the owner's latest prices: from the secure server (published in the admin), else business.json */
  var live = fetch('../../portfolio/api.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { return fetch(String(j.base || '').replace(/\/+$/, '') + '/frame-site'); })
    .then(function (r) { return r.json(); }).then(function (j) { return j && j.site; }).catch(function () { return null; });
  Promise.all([fetch('../business.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; }), live]).then(function (x) { return Object.assign({}, x[0] || {}, x[1] || {}); }).then(function (b) {
    var l = (b.packages || []).filter(function (p) { return !p.hidden && (!(p.for && p.for.length) || p.for.indexOf(ev) > -1); });
    if (!l.length) return;
    box.innerHTML = l.map(function (p) {
      var meta = [p.hours, p.magnets].filter(Boolean).map(esc).join(' · ');
      return '<article class="pk' + (p.featured ? ' star' : '') + '"><h3>' + esc(p.name) + '</h3>' + (p.price ? '<p class="price">' + esc(p.price) + '</p>' : '') + (meta ? '<p class="meta">' + meta + '</p>' : '') + '<ul>' + (p.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></article>';
    }).join('');
  }).catch(function () { /* keep the built-in list */ });
})();
