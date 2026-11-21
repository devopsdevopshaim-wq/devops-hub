/* Usage analysis for the admin. Reads the daily counters kept by the sign-in flow (action stats-get) and lets the admin slice them:
   range, metric, day/week, comparison with the period before, per-app trend, new vs returning, devices, hours, weekdays, clients, CSV. */
(function () {
  'use strict';
  var A = window.HasadnaAuth;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('he-IL'); };
  var D = null, sel = '', WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  var METRIC = { v: 'צפיות בדפים', uv: 'מבקרים', nv: 'מבקרים חדשים', o: 'פתיחות אתרים' };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function N() { return parseInt($('u-days').value, 10) || 30; }
  function q() { return ($('u-q').value || '').trim().toLowerCase(); }
  function split() {
    var all = (D && D.days) || [], n = N();
    return { cur: all.slice(-n), prev: all.length > n ? all.slice(-2 * n, -n) : [] };
  }
  function sum(list, k) { return list.reduce(function (a, x) { return a + (x[k] || 0); }, 0); }
  function merge(list, k) {
    var m = {};
    list.forEach(function (d) { (d[k] || []).forEach(function (r) { m[r[0]] = (m[r[0]] || 0) + r[1]; }); });
    return m;
  }
  function rows(m) { return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  function delta(a, b) {
    if (!b) return a ? el('span', { class: 'u-up', text: 'חדש' }) : document.createTextNode('—');
    var p = Math.round((a - b) / b * 100);
    return el('span', { class: p >= 0 ? 'u-up' : 'u-down', text: (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%' });
  }
  function bars(ol, list, empty, onclick) {
    ol.innerHTML = '';
    var f = q();
    list = list.filter(function (r) { return !f || r[0].toLowerCase().indexOf(f) >= 0; });
    if (!list.length) { ol.appendChild(el('li', { class: 'muted', text: empty || 'עדיין אין נתונים' })); return; }
    var max = Math.max.apply(null, list.map(function (r) { return r[1]; }).concat([1]));
    list.slice(0, 15).forEach(function (r) {
      var li = el('li', { title: r[0] + ': ' + fmt(r[1]), tabindex: '0', class: r[0] === sel && onclick ? 'sel' : '' }, [
        el('span', { class: 'lbl', text: r[0] }),
        el('span', { class: 'track' }, [el('span', { class: 'fill', style: 'width:' + (r[1] / max * 100) + '%' })]),
        el('span', { class: 'val', text: fmt(r[1]) })
      ]);
      if (onclick) { li.addEventListener('click', function () { onclick(r[0]); }); li.addEventListener('keydown', function (e) { if (e.key === 'Enter') onclick(r[0]); }); }
      ol.appendChild(li);
    });
  }
  function table(tb, trs, cols, empty) {
    tb.innerHTML = '';
    if (!trs.length) { tb.appendChild(el('tr', {}, [el('td', { colspan: String(cols), class: 'muted', text: empty || 'עדיין אין נתונים' })])); return; }
    trs.forEach(function (cells) { tb.appendChild(el('tr', {}, cells.map(function (c) { return el('td', {}, [typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c]); }))); });
  }
  function group(list, grain) {
    if (grain !== 'w') return list.map(function (d) { return { d: d.d, v: d.v, uv: d.uv, nv: d.nv, o: d.o }; });
    var out = [];
    for (var i = 0; i < list.length; i += 7) {
      var c = list.slice(i, i + 7);
      out.push({ d: c[0].d + ' – ' + c[c.length - 1].d, v: sum(c, 'v'), uv: sum(c, 'uv'), nv: sum(c, 'nv'), o: sum(c, 'o') });
    }
    return out;
  }
  function columns(box, cur, prev, metric) {
    box.innerHTML = '';
    var max = Math.max.apply(null, cur.concat(prev || []).map(function (x) { return x[metric] || 0; }).concat([1]));
    cur.forEach(function (x, i) {
      var pv = prev && prev[i] ? prev[i][metric] || 0 : null;
      var col = el('div', { class: 'col', tabindex: '0', title: x.d + ' · ' + METRIC[metric] + ': ' + fmt(x[metric]) + (pv != null ? ' (קודם ' + fmt(pv) + ')' : '') });
      if (pv != null && pv > 0) col.appendChild(el('b', { class: 'pv', style: 'bottom:' + Math.round(pv / max * 100) + '%' }));
      col.appendChild(el('i', { style: 'height:' + Math.round((x[metric] || 0) / max * 100) + '%' }));
      box.appendChild(col);
    });
  }

  function overview(S) {
    var cur = S.cur, prev = S.prev, kp = $('u-kpis'); kp.innerHTML = '';
    var tv = sum(cur, 'v'), tu = sum(cur, 'uv'), to = sum(cur, 'o'), tn = sum(cur, 'nv');
    [['צפיות בדפים', tv, sum(prev, 'v')], ['מבקרים', tu, sum(prev, 'uv')], ['מבקרים חדשים', tn, sum(prev, 'nv')], ['פתיחות אתרים', to, sum(prev, 'o')],
     ['צפיות למבקר', tu ? Math.round(tv / tu * 10) / 10 : 0, null], ['לקוחות פעילים', (D.clients || []).length, null]].forEach(function (k) {
      var dd = el('dd', { text: fmt(k[1]) });
      if (k[2] != null && prev.length) dd.appendChild(el('small', { class: 'u-d' }, [delta(k[1], k[2])]));
      kp.appendChild(el('div', {}, [el('dt', { text: k[0] }), dd]));
    });
    var metric = $('u-metric').value, grain = $('u-grain').value;
    $('u-chart-t').textContent = METRIC[metric] + (grain === 'w' ? ' לפי שבוע' : ' לפי יום');
    columns($('u-chart'), group(cur, grain), prev.length ? group(prev, grain) : null, metric);
    // short findings, in words
    var ins = [], best = cur.slice().sort(function (a, b) { return b.v - a.v; })[0];
    var hr = D.hours || [], pk = hr.indexOf(Math.max.apply(null, hr.concat([1])));
    var apps = rows(merge(cur, 'a')), pgs = rows(merge(cur, 'p')), dv = rows(merge(cur, 'dv'));
    if (best && best.v) ins.push('📅 היום העמוס ביותר: ' + best.d + ' עם ' + fmt(best.v) + ' צפיות');
    if (hr.some(Boolean)) ins.push('🕒 שעת השיא: ' + pk + ':00–' + (pk + 1) + ':00');
    if (apps[0]) ins.push('🚀 האתר הנפתח ביותר: ' + apps[0][0] + ' (' + fmt(apps[0][1]) + ')');
    if (pgs[0]) ins.push('📄 הדף הנצפה ביותר: ' + pgs[0][0] + ' (' + fmt(pgs[0][1]) + ')');
    var pa = rows(merge(prev, 'a')), pm = {}; pa.forEach(function (r) { pm[r[0]] = r[1]; });
    var gr = apps.map(function (r) { return [r[0], r[1] - (pm[r[0]] || 0)]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
    if (gr && gr[1] > 0 && prev.length) ins.push('📈 הכי צמח: ' + gr[0] + ' (+' + fmt(gr[1]) + ')');
    var dt = dv.reduce(function (a, r) { return a + r[1]; }, 0), mob = dv.filter(function (r) { return r[0] === 'נייד'; })[0];
    if (dt && mob) ins.push('📱 ' + Math.round(mob[1] / dt * 100) + '% מהכניסות מהנייד');
    if (tu) ins.push('🔁 ' + Math.round((tu - tn) / tu * 100) + '% מהמבקרים חזרו (לא חדשים)');
    if (tv && to) ins.push('🎯 ' + Math.round(to / tv * 100) + ' פתיחות על כל 100 צפיות');
    var ul = $('u-insights'); ul.innerHTML = '';
    if (!ins.length) ins.push('עדיין לא נאספו מספיק נתונים: הם מצטברים מכל כניסה לאתר.');
    ins.forEach(function (t) { ul.appendChild(el('li', { text: t })); });
  }

  function apps(S) {
    var cur = merge(S.cur, 'a'), prev = merge(S.prev, 'a'), list = rows(cur), tot = list.reduce(function (a, r) { return a + r[1]; }, 0);
    bars($('u-apps'), list, 'עדיין לא נפתחו אתרים', function (k) { sel = k; apps(S); });
    if (!sel && list[0]) sel = list[0][0];
    var f = q();
    table($('u-appt'), list.filter(function (r) { return !f || r[0].toLowerCase().indexOf(f) >= 0; }).map(function (r) {
      return [r[0], fmt(r[1]), S.prev.length ? fmt(prev[r[0]] || 0) : '—', S.prev.length ? delta(r[1], prev[r[0]] || 0) : '—', tot ? Math.round(r[1] / tot * 100) + '%' : '—'];
    }), 5);
    $('u-trend-t').textContent = 'מגמה: ' + (sel || '—');
    var pts = S.cur.map(function (d) { var m = {}; (d.a || []).forEach(function (r) { m[r[0]] = r[1]; }); return { d: d.d, o: m[sel] || 0 }; });
    columns($('u-trend'), pts, null, 'o');
    $('u-trend-n').textContent = sel ? 'סה״כ בטווח: ' + fmt(sum(pts, 'o')) : 'בחר אתר מהרשימה';
  }
  function pages(S) {
    var cur = merge(S.cur, 'p'), prev = merge(S.prev, 'p'), list = rows(cur), tot = list.reduce(function (a, r) { return a + r[1]; }, 0), f = q();
    table($('u-paget'), list.filter(function (r) { return !f || r[0].toLowerCase().indexOf(f) >= 0; }).slice(0, 60).map(function (r) {
      return [r[0], fmt(r[1]), S.prev.length ? fmt(prev[r[0]] || 0) : '—', S.prev.length ? delta(r[1], prev[r[0]] || 0) : '—', tot ? Math.round(r[1] / tot * 100) + '%' : '—'];
    }), 5);
  }
  function audience(S) {
    var tu = sum(S.cur, 'uv'), tn = sum(S.cur, 'nv'), st = $('u-nr'), lg = $('u-nr-l');
    st.innerHTML = ''; lg.innerHTML = '';
    if (tu) {
      [['חדשים', tn, 'var(--bar)'], ['חוזרים', Math.max(0, tu - tn), 'rgba(241,238,252,.35)']].forEach(function (s) {
        st.appendChild(el('span', { style: 'flex:' + Math.max(s[1], 0.001) + ';background:' + s[2], title: s[0] + ': ' + s[1] }));
        lg.appendChild(el('li', { text: s[0] + ' · ' + fmt(s[1]) + ' (' + Math.round(s[1] / tu * 100) + '%)' }));
      });
    } else lg.appendChild(el('li', { class: 'muted', text: 'עדיין אין נתונים' }));
    bars($('u-dv'), rows(merge(S.cur, 'dv'))); bars($('u-os'), D.os || []); bars($('u-br'), D.browsers || []);
    bars($('u-ref'), D.refs || [], 'כניסות ישירות או מאתר זה');
  }
  function times(S) {
    var hr = D.hours || [], hm = Math.max.apply(null, hr.concat([1])), box = $('u-hours'); box.innerHTML = '';
    hr.forEach(function (n, i) { box.appendChild(el('i', { style: 'height:' + Math.round(n / hm * 100) + '%', title: i + ':00 · ' + fmt(n) + ' צפיות' })); });
    var w = [0, 0, 0, 0, 0, 0, 0];
    S.cur.forEach(function (d) { w[new Date(d.d + 'T12:00:00Z').getUTCDay()] += d.v || 0; });
    bars($('u-wd'), w.map(function (n, i) { return ['יום ' + WD[i], n]; }));
  }
  function clients() {
    var f = q();
    table($('u-clients'), (D.clients || []).filter(function (c) { return !f || (c.email + ' ' + c.name).toLowerCase().indexOf(f) >= 0; }).map(function (c) {
      return [(c.name ? c.name + ' · ' : '') + c.email, fmt(c.views), c.apps.map(function (a) { return a[0] + ' (' + a[1] + ')'; }).join(' · ') || '—'];
    }), 3, 'עדיין אין שימוש של לקוחות מחוברים');
  }
  function log(S) {
    table($('u-log'), S.cur.slice().reverse().map(function (d) {
      return [d.d, fmt(d.v), fmt(d.uv), fmt(d.nv), fmt(d.o), (d.a && d.a[0] && d.a[0][0]) || '—', (d.p && d.p[0] && d.p[0][0]) || '—'];
    }), 7);
  }
  function render() {
    if (!D) return;
    var S = split();
    overview(S); apps(S); pages(S); audience(S); times(S); clients(); log(S);
    var any = sum(S.cur, 'v') || sum(S.cur, 'o');
    $('u-note').textContent = (D.note || '') + (any ? '' : ' · עדיין לא נאספו נתונים בטווח הזה: הם מצטברים מכל כניסה לאתר.');
  }
  function csv() {
    if (!D) return;
    var S = split(), lines = ['יום,צפיות,מבקרים,חדשים,פתיחות'];
    S.cur.forEach(function (d) { lines.push([d.d, d.v, d.uv, d.nv, d.o].join(',')); });
    lines.push('', 'אתר,פתיחות'); rows(merge(S.cur, 'a')).forEach(function (r) { lines.push('"' + r[0].replace(/"/g, '""') + '",' + r[1]); });
    lines.push('', 'דף,צפיות'); rows(merge(S.cur, 'p')).forEach(function (r) { lines.push('"' + r[0].replace(/"/g, '""') + '",' + r[1]); });
    var a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })), download: 'spider-usage.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function load() {
    $('u-note').textContent = 'טוען…';
    var n = N();
    A.api('stats-get', { days: Math.min(120, n * 2), range: n }).then(function (d) {
      if (!d || !d.ok) { $('u-note').textContent = d && d.error === 'not-ready' ? 'השרת עוד לא מעודכן: הפעל את פריסת n8n.' : 'לא ניתן לטעון נתונים (' + ((d && d.error) || 'שגיאה') + ')'; return; }
      D = d; render();
    }, function () { $('u-note').textContent = 'אין חיבור לשרת'; });
  }
  A.ready.then(function (s) {
    if (s.role !== 'admin') return;
    $('u-days').addEventListener('change', load);
    $('u-refresh').addEventListener('click', load);
    $('u-csv').addEventListener('click', csv);
    ['u-metric', 'u-grain'].forEach(function (id) { $(id).addEventListener('change', render); });
    $('u-q').addEventListener('input', render);
    $('u-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-t]'); if (!b) return;
      Array.prototype.forEach.call($('u-tabs').children, function (x) { x.setAttribute('aria-selected', String(x === b)); });
      Array.prototype.forEach.call(document.querySelectorAll('#usage .u-pane'), function (p) { p.hidden = p.getAttribute('data-p') !== b.getAttribute('data-t'); });
    });
    load();
  });
})();
