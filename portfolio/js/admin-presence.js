/* Admin front screen: who is on the site now. Three cubes (online / offline / members) from the pings of open pages (action presence). */
(function () {
  'use strict';
  var A = window.HasadnaAuth;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var D = null, filter = '';
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function ago(iso) {
    if (!iso) return 'לא נכנס עדיין';
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return m < 1 ? 'ממש עכשיו' : m < 60 ? 'לפני ' + m + ' דק׳' : m < 1440 ? 'לפני ' + Math.round(m / 60) + ' שעות' : 'לפני ' + Math.round(m / 1440) + ' ימים';
  }
  function list() {
    var box = $('pr-list'), tb = $('pr-body');
    box.hidden = !filter;
    if (!filter || !D) return;
    tb.innerHTML = '';
    var rows = D.rows.filter(function (r) { return filter === 'all' || (filter === 'online' ? r.online : !r.online); });
    if (!rows.length) tb.appendChild(el('tr', {}, [el('td', { colspan: '3', class: 'muted', text: 'אין חברים בקבוצה הזו' })]));
    rows.forEach(function (r) {
      tb.appendChild(el('tr', {}, [el('td', { text: (r.name ? r.name + ' · ' : '') + r.email }), el('td', {}, [el('span', { class: 'pr-dot' + (r.online ? ' on' : '') }), document.createTextNode(r.online ? 'מחובר' : r.active ? 'לא מחובר' : 'לא פעיל')]), el('td', { text: r.online ? 'עכשיו' : ago(r.last) })]));
    });
  }
  function load() {
    A.api('presence').then(function (d) {
      if (!d || !d.ok) { $('pr-note').textContent = d && d.error === 'not-ready' ? 'השרת עוד לא מעודכן: הפעל את פריסת n8n.' : 'לא ניתן לטעון (' + ((d && d.error) || 'שגיאה') + ')'; return; }
      D = d;
      $('pr-online').textContent = d.online; $('pr-offline').textContent = d.offline; $('pr-members').textContent = d.members;
      $('pr-note').textContent = 'מחובר = עמוד פתוח בדקות האחרונות (' + d.minutes + '). מתעדכן כל דקה.' + (d.admin ? ' אתה מחובר כמנהל.' : '');
      list();
    }, function () { $('pr-note').textContent = 'אין חיבור לשרת'; });
  }
  A.ready.then(function (s) {
    if (s.role !== 'admin') return;
    Array.prototype.forEach.call(document.querySelectorAll('.pr-cube'), function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f'); filter = filter === f ? '' : f;
        Array.prototype.forEach.call(document.querySelectorAll('.pr-cube'), function (x) { x.setAttribute('aria-pressed', String(x === b && !!filter)); });
        list();
      });
    });
    load(); setInterval(function () { if (!document.hidden) load(); }, 60000);
  });
})();
