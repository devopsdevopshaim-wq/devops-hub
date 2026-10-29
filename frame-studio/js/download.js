/* The download page: the studio's current price, as the owner set it in the admin (the server's public lic-info). */
(function () {
  'use strict';
  var box = document.getElementById('dl-price'); if (!box) return;
  fetch('../portfolio/api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) {
    var base = String((j && j.base) || 'https://spider-auth.devopsdevopshaim.workers.dev').replace(/\/+$/, '');
    return fetch(base + '/hasadna-auth', { method: 'POST', body: new URLSearchParams({ action: 'lic-info' }) });
  }).then(function (r) { return r.json(); }).then(function (r) {
    if (!r || !r.ok || !r.price) return;
    var c = ' ' + (r.currency || '₪'), n = function (v) { return Number(v).toLocaleString('he-IL') + c; };
    box.innerHTML = 'רישיון מלא: <b>' + n(r.price) + '</b> · תשלום חד־פעמי' + (r.monthPrice ? '<br><small>או מנוי: ' + n(r.monthPrice) + ' לחודש · ' + n(r.yearPrice) + ' לשנה · כרטיס אירוע ' + n(r.passPrice) + ' (' + (r.passHours || 48) + ' שעות)</small>' : '');
    box.hidden = false;
  }).catch(function () { /* no price shown offline */ });
})();
