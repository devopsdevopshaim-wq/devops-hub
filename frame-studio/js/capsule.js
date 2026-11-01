/* The time capsule (capsule.html, from the couple's anniversary email): the messages the guests left through the living
   magnets, sealed until a year after the event. Before that, only how many are waiting. The viewing key opens it. */
(function () {
  'use strict';
  var L = window.FL, app = document.getElementById('app');
  L.call({ action: 'capsules', e: L.e, v: L.v }).then(function (r) {
    if (!r.ok) { app.innerHTML = '<p class="mg-card">' + L.esc(L.msg(r)) + '</p>'; return; }
    document.title = '💌 ' + r.title;
    if (r.locked) { app.innerHTML = '<section class="mg-card mg-cap"><h2>🔒 קפסולת הזמן של ' + L.esc(r.title) + '</h2><p>' + r.count + ' הודעות מחכות לכם. הקפסולה נפתחת ב־<b>' + L.esc(L.heDate(r.opens)) + '</b>, ביום השנה הראשון.</p></section>'; return; }
    app.innerHTML = '<section class="mg-card mg-cap"><h2>💌 קפסולת הזמן נפתחה</h2><p>' + L.esc(r.title) + ' · ' + r.count + ' הודעות מהאורחים, שנכתבו לפני שנה בדיוק.</p></section>' +
      (r.capsules || []).map(function (c) { return '<section class="mg-card"><p class="mg-text">' + (c.text ? '“' + L.esc(c.text) + '”' : '🎙️') + '</p>' + (c.name ? '<p class="mg-name">— ' + L.esc(c.name) + '</p>' : '') + (c.audio ? '<p style="text-align:center"><audio controls preload="none" data-cap="' + L.esc(c.id) + '"></audio></p>' : '') + '</section>'; }).join('');
    L.base.then(function (u) { Array.prototype.forEach.call(app.querySelectorAll('[data-cap]'), function (a) { a.src = u + '/frame-live-img?e=' + L.e + '&v=' + L.v + '&p=' + a.dataset.cap + '&cap=1'; }); });
  });
})();
