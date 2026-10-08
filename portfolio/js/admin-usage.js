/* Usage statistics for the admin: reads the daily counters kept by the sign-in flow (action stats-get). */
(function () {
  'use strict';
  var A = window.HasadnaAuth;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('he-IL'); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function bars(ol, rows, empty) {
    ol.innerHTML = '';
    if (!rows.length) { ol.appendChild(el('li', { class: 'muted', text: empty || 'עדיין אין נתונים' })); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    rows.slice(0, 10).forEach(function (r) {
      ol.appendChild(el('li', { title: r[0] + ': ' + fmt(r[1]), tabindex: '0' }, [
        el('span', { class: 'lbl', text: r[0] }),
        el('span', { class: 'track' }, [el('span', { class: 'fill', style: 'width:' + (r[1] / max * 100) + '%' })]),
        el('span', { class: 'val', text: fmt(r[1]) })
      ]));
    });
  }
  function render(d) {
    var days = d.days || [], sum = function (k) { return days.reduce(function (a, x) { return a + (x[k] || 0); }, 0); };
    var kp = $('u-kpis'); kp.innerHTML = '';
    [['צפיות בדפים', sum('v')], ['מבקרים (סכום ימים)', sum('uv')], ['פתיחות אתרים', sum('o')],
     ['היום', (days[days.length - 1] || {}).v || 0], ['לקוחות פעילים', (d.clients || []).length]].forEach(function (k) {
      kp.appendChild(el('div', {}, [el('dt', { text: k[0] }), el('dd', { text: fmt(k[1]) })]));
    });
    var max = Math.max.apply(null, days.map(function (x) { return x.v; }).concat([1])), ch = $('u-chart');
    ch.innerHTML = '';
    days.forEach(function (x) {
      var col = el('div', { class: 'col', tabindex: '0', title: x.d + ' · צפיות ' + x.v + ' · מבקרים ' + x.uv + ' · פתיחות ' + x.o });
      col.appendChild(el('i', { style: 'height:' + Math.round(x.v / max * 100) + '%' }));
      ch.appendChild(col);
    });
    bars($('u-apps'), d.apps || [], 'עדיין לא נפתחו אתרים');
    bars($('u-pages'), d.pages || []);
    bars($('u-dev'), [].concat(d.devices || [], d.os || [], d.browsers || []));
    bars($('u-ref'), d.refs || [], 'כניסות ישירות או מאתר זה');
    var hm = Math.max.apply(null, (d.hours || []).concat([1])), hr = $('u-hours'); hr.innerHTML = '';
    (d.hours || []).forEach(function (n, i) { hr.appendChild(el('i', { style: 'height:' + Math.round(n / hm * 100) + '%', title: i + ':00 · ' + n })); });
    var tb = $('u-clients'); tb.innerHTML = '';
    (d.clients || []).forEach(function (c) {
      tb.appendChild(el('tr', {}, [el('td', { text: (c.name ? c.name + ' · ' : '') + c.email }), el('td', { text: fmt(c.views) }),
        el('td', { text: c.apps.map(function (a) { return a[0] + ' (' + a[1] + ')'; }).join(' · ') || '—' })]));
    });
    if (!(d.clients || []).length) tb.appendChild(el('tr', {}, [el('td', { colspan: '3', class: 'muted', text: 'עדיין אין שימוש של לקוחות מחוברים' })]));
    $('u-note').textContent = (d.note || '') + (sum('v') || sum('o') ? '' : ' · עדיין לא נאספו נתונים: הם יתחילו להצטבר מהכניסה הבאה לאתר.');
  }
  function load() {
    $('u-note').textContent = 'טוען…';
    A.api('stats-get', { days: $('u-days').value }).then(function (d) {
      if (!d || !d.ok) { $('u-note').textContent = d && d.error === 'not-ready' ? 'השרת עוד לא מעודכן: הפעל את פריסת n8n.' : 'לא ניתן לטעון נתונים (' + ((d && d.error) || 'שגיאה') + ')'; return; }
      render(d);
    }, function () { $('u-note').textContent = 'אין חיבור לשרת'; });
  }
  A.ready.then(function (s) {
    if (s.role !== 'admin') return;
    $('u-days').addEventListener('change', load);
    $('u-refresh').addEventListener('click', load);
    load();
  });
})();
