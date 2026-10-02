/* מעגל סגור — ממשק תכנון החשמל לבית: חדרים, נקודות, לוח חשמל, מרשם מעגלים ובית חכם. */
(function () {
  'use strict';

  var H = window.HomePlan, Store = window.HomeStore, A = window.FixApp, FP = window.FixPrompts;
  var esc = A.esc;
  var st = { plan: null, tab: 'points', mounted: false, open: {}, timer: null, ai: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function uid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var ICON = {
    socket: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9.5 10v3M14.5 10v3"/>',
    light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    ac: '<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M7 17c0 1.5 1 2 1 3M12 17c0 1.5 1 2 1 3M17 17c0 1.5 1 2 1 3"/>',
    net: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M8 7V5h8v2M8 12h8M10 15h4"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    area: '<path d="M4 4h16v16H4z M4 9h16M9 4v16"/>',
    smart: '<path d="M3 11l9-7 9 7M5 10v10h14V10M9 15q3-3 6 0M11 17.5q1-1 2 0"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>'; }

  /* ---------- שמירה ---------- */

  function save() {
    clearTimeout(st.timer);
    st.timer = setTimeout(function () { Store.save(st.plan).then(fillOpen); }, 350);
  }
  function fillOpen() {
    Store.all().then(function (list) {
      $('#hOpen').innerHTML = '<option value="">התכניות שלי (' + list.length + ')</option>' + list.map(function (p) {
        return '<option value="' + p.id + '"' + (st.plan && p.id === st.plan.id ? ' selected' : '') + '>' + esc(p.name || 'ללא שם') + '</option>';
      }).join('');
    });
  }
  function openPlan(p) {
    st.plan = p;
    st.ai = null;
    $('#hAi').innerHTML = '';
    fillBar();
    render();
    fillOpen();
  }
  function fromPreset(key) {
    var p = H.preset(key);
    p.id = uid(); p.created = Date.now();
    Store.save(p).then(function () { openPlan(p); A.toast('נפתחה תכנית חדשה: ' + p.name); });
  }
  function change(fn) { fn(st.plan); render(); save(); }

  /* ---------- סרגל ---------- */

  function fillBar() {
    var p = st.plan;
    $('#hName').value = p.name || '';
    $('#hSupply').value = p.supply;
    $('#hTech').value = p.tech || 'none';
    $('#hSpd').checked = p.spd !== false;
    $('#hShabbat').checked = !!p.shabbat;
  }

  /* ---------- חדרים ---------- */

  function counter(room, key, label, icon) {
    return '<div class="counter" data-c="' + key + '"><span class="c-ico">' + ico(icon) + '</span><span class="c-lbl">' + label + '</span>' +
      '<button type="button" data-d="-1" aria-label="פחות ' + label + '">−</button><b>' + (room[key] || 0) + '</b><button type="button" data-d="1" aria-label="יותר ' + label + '">+</button></div>';
  }

  function roomCard(r) {
    var t = H.ROOMS[r.type], tech = st.plan.tech !== 'none';
    var app = Object.keys(H.APPLIANCES).map(function (k) {
      return '<label class="check small"><input type="checkbox" data-app="' + k + '"' + (r.app && r.app[k] ? ' checked' : '') + '> <span>' + H.APPLIANCES[k].name + '</span></label>';
    }).join('');
    var s = r.smart || {};
    var smart = tech ? '<div class="room-smart"><span class="sub">בית חכם</span>' +
      ['lights:תאורה חכמה', 'ac:שליטה במזגן', 'motion:חיישן תנועה', 'leak:חיישן הצפה', 'smoke:גלאי עשן'].map(function (x) {
        var k = x.split(':');
        return '<label class="check small"><input type="checkbox" data-sm="' + k[0] + '"' + (s[k[0]] ? ' checked' : '') + '> <span>' + k[1] + '</span></label>';
      }).join('') +
      '<label class="mini">תריסים <input type="number" min="0" max="12" data-smn="shutters" value="' + (s.shutters || 0) + '"></label>' +
      '<label class="mini">חיישני חלון <input type="number" min="0" max="12" data-smn="contacts" value="' + (s.contacts || 0) + '"></label></div>' : '';
    var summary = r.sockets + ' שקעים · ' + r.lights + ' מאור' + (r.ac ? ' · מזגן' : '') + (Object.keys(r.app || {}).some(function (k) { return r.app[k]; }) ? ' · ' + Object.keys(r.app).filter(function (k) { return r.app[k]; }).length + ' ייעודיים' : '');
    return '<details class="room card" data-id="' + r.id + '"' + (st.open[r.id] ? ' open' : '') + '><summary><span class="room-type">' + esc(t.name) + '</span><b>' + esc(r.name) + '</b><span class="room-sum">' + summary + '</span></summary>' +
      '<div class="room-body">' +
      '<div class="room-top"><label>שם<input data-f="name" value="' + esc(r.name) + '"></label><label>שטח מ״ר<input type="number" min="1" max="500" data-f="area" value="' + r.area + '"></label>' +
      '<label>מזגן<select data-f="ac">' + Object.keys(H.AC_SIZES).map(function (k) { return '<option value="' + k + '"' + (k === (r.ac || '') ? ' selected' : '') + '>' + (k ? H.AC_SIZES[k].name : 'ללא') + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="counters">' + counter(r, 'sockets', 'שקעים', 'socket') + counter(r, 'lights', 'נקודות מאור', 'light') + counter(r, 'net', 'נקודות רשת', 'net') + counter(r, 'tv', 'טלוויזיה', 'tv') + '</div>' +
      '<div class="room-apps"><span class="sub">מכשירים במעגל ייעודי</span>' + app + '</div>' + smart +
      '<div class="room-actions"><button type="button" class="btn ghost small" data-act="dup">שכפול</button><button type="button" class="btn ghost small danger-text" data-act="del">מחיקה</button></div>' +
      '</div></details>';
  }

  function renderRooms() {
    var host = $('#hRooms'), rooms = st.plan.rooms;
    $('#hRoomCount').textContent = '(' + rooms.length + ')';
    host.innerHTML = rooms.map(roomCard).join('');
    $$('.room', host).forEach(function (el) {
      var id = el.dataset.id;
      function room() { return st.plan.rooms.filter(function (r) { return r.id === id; })[0]; }
      el.addEventListener('toggle', function () { st.open[id] = el.open; });
      $$('[data-f]', el).forEach(function (inp) {
        inp.addEventListener('change', function () {
          var f = inp.dataset.f, v = inp.value;
          change(function () { room()[f] = f === 'area' ? Math.max(1, +v || 1) : v; });
        });
      });
      $$('.counter', el).forEach(function (c) {
        $$('button', c).forEach(function (b) {
          b.addEventListener('click', function () {
            var k = c.dataset.c;
            change(function () { var r = room(); r[k] = Math.max(0, Math.min(40, (r[k] || 0) + +b.dataset.d)); });
          });
        });
      });
      $$('[data-app]', el).forEach(function (cb) { cb.addEventListener('change', function () { change(function () { var r = room(); r.app = r.app || {}; r.app[cb.dataset.app] = cb.checked; }); }); });
      $$('[data-sm]', el).forEach(function (cb) { cb.addEventListener('change', function () { change(function () { room().smart[cb.dataset.sm] = cb.checked; }); }); });
      $$('[data-smn]', el).forEach(function (inp) { inp.addEventListener('change', function () { change(function () { room().smart[inp.dataset.smn] = Math.max(0, +inp.value || 0); }); }); });
      $('[data-act="del"]', el).addEventListener('click', function () {
        if (!confirm('למחוק את ' + room().name + '?')) return;
        change(function (p) { p.rooms = p.rooms.filter(function (r) { return r.id !== id; }); });
      });
      $('[data-act="dup"]', el).addEventListener('click', function () {
        change(function (p) {
          var c = JSON.parse(JSON.stringify(room()));
          c.id = uid(); c.name += ' (עותק)';
          p.rooms.splice(p.rooms.indexOf(room()) + 1, 0, c);
          st.open[c.id] = true;
        });
      });
    });
  }

  /* ---------- חישוב ותצוגות ---------- */

  function render() {
    var P = H.panel(st.plan), adv = H.advice(st.plan);
    st.P = P; st.adv = adv;
    renderRooms();
    kpis(P);
    $$('[data-htab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.htab === st.tab)); });
    var host = $('#hTab');
    if (st.tab === 'points') host.innerHTML = points();
    else if (st.tab === 'panel') { host.innerHTML = panelView(P, adv); fitPanel(); }
    else if (st.tab === 'schedule') { host.innerHTML = schedule(P); $('#hPrintLabels') && $('#hPrintLabels').addEventListener('click', printLabels); }
    else host.innerHTML = smartView(P.smart);
  }

  function kpis(P) {
    var rooms = st.plan.rooms, C = P.circuits;
    var sockets = rooms.reduce(function (s, r) { return s + r.sockets; }, 0), lights = rooms.reduce(function (s, r) { return s + r.lights; }, 0);
    var sup = C.supply;
    var gauges = C.perPhaseA.map(function (a, i) {
      var pct = Math.min(100, a / sup.amps * 100);
      return '<div class="phase"><span>' + (C.tri ? 'L' + (i + 1) : 'L') + '</span><span class="pbar"><i class="' + (pct > 90 ? 'bad' : pct > 70 ? 'warn' : '') + '" style="width:' + pct + '%"></i></span><b dir="ltr">' + a.toFixed(1) + 'A</b></div>';
    }).join('');
    $('#hKpis').innerHTML =
      '<div class="kpi">' + ico('area') + '<b>' + H.area(rooms) + '</b><span>מ״ר · ' + rooms.length + ' חדרים</span></div>' +
      '<div class="kpi">' + ico('socket') + '<b>' + sockets + '</b><span>שקעים</span></div>' +
      '<div class="kpi">' + ico('light') + '<b>' + lights + '</b><span>נקודות מאור</span></div>' +
      '<div class="kpi">' + ico('plug') + '<b>' + C.circuits.length + '</b><span>מעגלים · ' + C.rcds.length + ' פחת</span></div>' +
      '<div class="kpi wide"><span class="kpi-t">עומס משוער לפאזה · חיבור ' + esc(sup.name) + '</span>' + gauges + '</div>';
  }

  var HEIGHTS = [['שקע רגיל', '30 ס״מ מהרצפה'], ['שקע מעל משטח עבודה', '110 ס״מ'], ['מתג', '110 ס״מ, ליד פתח הדלת'], ['נקודת מזגן', '220 ס״מ, עם ניקוז'], ['נקודת טלוויזיה', '120–140 ס״מ'], ['שקע במקלחת', 'מחוץ לאזורים 0–1, IP44'], ['מפסק דוד', 'מחוץ לחדר הרחצה, עם נורית']];

  function points() {
    var rows = st.plan.rooms.map(function (r) {
      var t = H.ROOMS[r.type];
      var sw = r.lights ? Math.max(1, Math.ceil(r.lights / 2)) + (t.twoWay ? ' (מחליף)' : '') : 0;
      var ded = Object.keys(r.app || {}).filter(function (k) { return r.app[k]; }).map(function (k) { return H.APPLIANCES[k].name; });
      if (r.ac) ded.unshift(H.AC_SIZES[r.ac].name);
      var notes = [];
      if (t.wet) notes.push('IP44');
      if (t.kitchen) notes.push('שקעים מעל המשטח');
      if (t.mamad) notes.push('השחלות בשרוולים מאושרים');
      if (t.fan) notes.push('מאוורר');
      return '<article class="tile"><header><b>' + esc(r.name) + '</b><span>' + r.area + ' מ״ר</span></header>' +
        '<div class="tile-grid">' +
        '<span title="שקעים">' + ico('socket') + r.sockets + '</span><span title="נקודות מאור">' + ico('light') + r.lights + '</span>' +
        '<span title="מתגים">⎍ ' + sw + '</span><span title="נקודות רשת">' + ico('net') + r.net + '</span>' + (r.tv ? '<span title="טלוויזיה">' + ico('tv') + r.tv + '</span>' : '') +
        '</div>' + (ded.length ? '<p class="tile-ded">' + ico('plug') + esc(ded.join(' · ')) + '</p>' : '') +
        (notes.length ? '<p class="tile-notes">' + esc(notes.join(' · ')) + '</p>' : '') + '</article>';
    }).join('');
    return '<div class="tiles">' + rows + '</div>' +
      '<div class="card heights"><h3>גבהים ומיקומים מקובלים</h3><dl>' + HEIGHTS.map(function (h) { return '<div><dt>' + h[0] + '</dt><dd>' + h[1] + '</dd></div>'; }).join('') + '</dl></div>';
  }

  function panelView(P, adv) {
    var C = P.circuits, rowsTxt = P.rows.length + ' שורות × ' + P.rowMod + ' מודולים (' + P.total + ')';
    return '<div class="panel-wrap card"><div class="panel-head"><div><h3>לוח החשמל הדירתי</h3><p class="muted small">מבט חזיתי. המספרים על המאמתים תואמים למרשם המעגלים. נקודה צבעונית = פאזה.</p></div>' +
      '<div class="panel-facts"><span><b>' + esc(C.supply.main) + '</b></span><span>' + C.rcds.length + ' ממסרי פחת</span><span>' + rowsTxt + '</span><span>' + P.used + ' מודולים בשימוש · ' + Math.round(P.spare / P.total * 100) + '% שמור</span></div></div>' +
      '<div class="panel-canvas">' + H.renderPanel(P, 'לוח חשמל — ' + (st.plan.name || '')) + '</div>' +
      '<div class="phase-legend"><span><i style="background:#8a4b1f"></i>L1</span><span><i style="background:#1d1d1f"></i>L2</span><span><i style="background:#8a8f98"></i>L3</span></div></div>' +
      '<div class="card advice"><h3>בדיקות והמלצות</h3><ul>' + adv.map(function (a) { return '<li class="' + a.level + '">' + esc(a.text) + '</li>'; }).join('') + '</ul></div>';
  }

  function fitPanel() {
    var svg = $('#hTab .panel-canvas svg');
    if (!svg) return;
    var w = +svg.getAttribute('width'), avail = $('#hTab .panel-canvas').clientWidth;
    svg.style.width = Math.min(w, avail) + 'px';
    svg.style.height = 'auto';
  }

  function schedule(P) {
    var mcbs = P.devices.filter(function (d) { return d.kind === 'mcb'; });
    return '<div class="card"><div class="panel-head"><div><h3>מרשם מעגלים</h3><p class="muted small">לפי הסדר בלוח. להדפסה ולהדבקה על דלת הלוח.</p></div><button class="btn primary small" type="button" id="hPrintLabels">הדפסת מרשם לדלת הלוח</button></div>' +
      '<div class="table-wrap"><table class="table sched"><thead><tr><th>מס׳</th><th>מעגל</th><th>חדרים</th><th>מאמת</th><th>כבל (ממ״ר)</th><th>פאזה</th><th>פחת</th><th>נקודות</th><th>הספק מחובר</th></tr></thead><tbody>' +
      mcbs.map(function (d) {
        var c = d.circuit;
        return '<tr><td class="n">' + d.no + '</td><td><b>' + esc(c.title) + '</b>' + (c.ip ? ' <span class="tag">' + c.ip + '</span>' : '') + (c.rcdB ? ' <span class="tag">פחת סוג B</span>' : '') + '</td><td>' + esc(c.rooms.join(', ')) + '</td>' +
          '<td class="mono">' + esc(c.breaker) + '</td><td class="mono">' + esc(c.cable) + '</td><td><span class="ph" style="--c:' + ({ L1: '#8a4b1f', L2: '#1d1d1f', L3: '#8a8f98' }[c.phase] || '#c9a45c') + '"></span>' + esc(c.phase) + '</td>' +
          '<td>' + esc(c.rcd) + '</td><td class="mono">' + c.points + '</td><td class="mono" dir="ltr">' + c.kw.toFixed(1) + ' kW</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted small">ממסרי פחת: ' + P.circuits.rcds.map(function (r) { return esc(r.id + ' — ' + r.name + ' ' + (r.poles === 4 ? '4P' : '2P') + ' ' + r.amps + 'A ' + r.ma + 'mA סוג ' + r.type); }).join(' · ') + '</p></div>';
  }

  function smartView(S) {
    var T = H.SMART_TECH[st.plan.tech || 'none'];
    if (S.tech === 'none') return '<div class="card empty-smart"><h3>בית חכם</h3><p>בחרו טכנולוגיה בסרגל העליון (Wi-Fi, Zigbee או KNX) כדי לקבל רשימת רכיבים, דרישות חיווט, תוספות ללוח ותרחישים.</p>' +
      '<div class="tech-cards">' + ['wifi', 'zigbee', 'knx'].map(function (k) { return '<button type="button" class="tech" data-tech="' + k + '"><b>' + H.SMART_TECH[k].name + '</b><span>' + H.SMART_TECH[k].desc + '</span></button>'; }).join('') + '</div></div>';
    var total = S.devices.reduce(function (s, d) { return s + d.qty; }, 0);
    return '<div class="smart-grid">' +
      '<div class="card"><h3>' + esc(T.name) + ' · ' + total + ' רכיבים</h3><p class="muted small">' + esc(T.desc) + '</p><div class="table-wrap"><table class="table"><thead><tr><th>רכיב</th><th>כמות</th><th>איפה</th></tr></thead><tbody>' +
      S.devices.map(function (d) { return '<tr><td>' + esc(d.name) + (d.note ? '<small>' + esc(d.note) + '</small>' : '') + '</td><td class="mono">' + d.qty + '</td><td class="small">' + esc(d.where.join(', ')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h3>דרישות חיווט</h3><ul class="bullets">' + S.wiring.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' +
      (S.panel.length ? '<h3 class="mt">תוספות ללוח</h3><ul class="bullets">' + S.panel.map(function (p) { return '<li>' + esc(p.name) + ' · ' + p.mod + ' מודולים</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="card scenes"><h3>תרחישים מוצעים</h3><div class="scene-list">' + S.scenes.map(function (s) { return '<div class="scene"><b>' + esc(s.name) + '</b><p>' + esc(s.desc) + '</p></div>'; }).join('') + '</div></div></div>';
  }

  /* ---------- הדפסה ---------- */

  function printWin(title, body) {
    var w = window.open('', '_blank');
    if (!w) return A.toast('הדפדפן חסם חלון חדש', true);
    w.document.write('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      'body{font:13px/1.5 Heebo,Arial,sans-serif;color:#111;margin:22px}h1{font-size:22px;margin:0 0 4px;font-family:"Frank Ruhl Libre",serif}h2{font-size:16px;margin:20px 0 8px;border-bottom:2px solid #c9a45c;padding-bottom:4px}' +
      'table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfc8b8;padding:5px 7px;text-align:start;vertical-align:top}th{background:#f4efe4}.big td{font-size:15px;padding:8px}.panel svg{width:100%;height:auto}.meta{color:#666}ul{margin:0;padding-inline-start:18px}' +
      '@page{size:A4;margin:12mm}</style></head><body>' + body + '<script>setTimeout(function(){print()},300)<\/script></body></html>');
    w.document.close();
  }

  function scheduleRows(P, big) {
    return '<table class="' + (big ? 'big' : '') + '"><tr><th>מס׳</th><th>מעגל</th><th>חדרים</th><th>מאמת</th>' + (big ? '' : '<th>כבל</th><th>פאזה</th>') + '<th>פחת</th></tr>' +
      P.devices.filter(function (d) { return d.kind === 'mcb'; }).map(function (d) {
        var c = d.circuit;
        return '<tr><td><b>' + d.no + '</b></td><td>' + esc(c.title) + '</td><td>' + esc(c.rooms.join(', ')) + '</td><td>' + esc(c.breaker) + '</td>' + (big ? '' : '<td>' + esc(c.cable) + '</td><td>' + esc(c.phase) + '</td>') + '<td>' + esc(c.rcd) + '</td></tr>';
      }).join('') + '</table>';
  }

  function printLabels() {
    printWin('מרשם מעגלים — ' + st.plan.name, '<h1>מרשם מעגלים · ' + esc(st.plan.name) + '</h1><p class="meta">' + esc(st.P.circuits.supply.main) + ' · ' + esc(new Date().toLocaleDateString('he-IL')) + '</p>' + scheduleRows(st.P, true));
  }

  function printPlan() {
    var P = st.P, S = P.smart;
    printWin('תכנית חשמל — ' + st.plan.name,
      '<h1>תכנית חשמל · ' + esc(st.plan.name) + '</h1><p class="meta">' + esc(P.circuits.supply.name) + ' · ' + H.area(st.plan.rooms) + ' מ״ר · ' + esc(new Date().toLocaleDateString('he-IL')) + ' · מעגל סגור</p>' +
      '<h2>נקודות לפי חדר</h2><table><tr><th>חדר</th><th>שטח</th><th>שקעים</th><th>מאור</th><th>רשת</th><th>מזגן</th><th>מעגלים ייעודיים</th></tr>' + st.plan.rooms.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td>' + r.area + '</td><td>' + r.sockets + '</td><td>' + r.lights + '</td><td>' + r.net + '</td><td>' + esc(r.ac ? H.AC_SIZES[r.ac].name : '—') + '</td><td>' + esc(Object.keys(r.app || {}).filter(function (k) { return r.app[k]; }).map(function (k) { return H.APPLIANCES[k].name; }).join(', ')) + '</td></tr>';
      }).join('') + '</table>' +
      '<h2>לוח החשמל</h2><div class="panel">' + H.renderPanel(P, 'לוח חשמל — ' + (st.plan.name || '')) + '</div>' +
      '<h2>מרשם מעגלים</h2>' + scheduleRows(P, false) +
      '<h2>בדיקות והמלצות</h2><ul>' + st.adv.map(function (a) { return '<li>' + esc(a.text) + '</li>'; }).join('') + '</ul>' +
      (S.tech !== 'none' ? '<h2>בית חכם — ' + esc(H.SMART_TECH[S.tech].name) + '</h2><table><tr><th>רכיב</th><th>כמות</th><th>איפה</th></tr>' + S.devices.map(function (d) { return '<tr><td>' + esc(d.name) + '</td><td>' + d.qty + '</td><td>' + esc(d.where.join(', ')) + '</td></tr>'; }).join('') + '</table><ul>' + S.wiring.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="meta">התכנית היא הצעה ראשונית. תכנון מחייב וביצוע — על ידי חשמלאי מוסמך.</p>');
  }

  /* ---------- Claude ---------- */

  function planSummary() {
    var P = st.P;
    return {
      name: st.plan.name, supply: P.circuits.supply.name, smart_tech: H.SMART_TECH[st.plan.tech || 'none'].name, spd: st.plan.spd !== false, shabbat: !!st.plan.shabbat,
      rooms: st.plan.rooms.map(function (r) { return { name: r.name, type: H.ROOMS[r.type].name, area: r.area, sockets: r.sockets, lights: r.lights, net: r.net, tv: r.tv, ac: r.ac ? H.AC_SIZES[r.ac].name : '', dedicated: Object.keys(r.app || {}).filter(function (k) { return r.app[k]; }).map(function (k) { return H.APPLIANCES[k].name; }), smart: r.smart }; }),
      circuits: P.circuits.circuits.map(function (c) { return { no: c.id, title: c.title, rooms: c.rooms, breaker: c.breaker, cable: c.cable, phase: c.phase, rcd: c.rcd, points: c.points, kw: c.kw }; }),
      rcds: P.circuits.rcds.map(function (r) { return r.id + ' ' + r.poles + 'P ' + r.amps + 'A ' + r.ma + 'mA type ' + r.type; }),
      panel: { modules_used: P.used, modules_total: P.total, rows: P.rows.length },
      est_phase_current_A: P.circuits.perPhaseA.map(function (a) { return +a.toFixed(1); }),
      site_checks: st.adv.map(function (a) { return a.level + ': ' + a.text; })
    };
  }

  function openAi() {
    var manual = !A.state.ai;
    $('#hAiManual').hidden = !manual;
    $('#hAiError').textContent = '';
    $('#hAiPaste').value = '';
    $('#hAiSend').textContent = manual ? 'טעינת התשובה' : 'בדיקת התכנית';
    $('#hAiDlg').showModal();
  }

  function sendAi() {
    var req = $('#hAiReq').value.trim();
    if (!A.state.ai) {
      var r;
      try { r = FP.parseHome($('#hAiPaste').value); } catch (e) { $('#hAiError').textContent = 'לא הצלחנו לקרוא את התשובה: ' + e.message; return; }
      $('#hAiDlg').close();
      return showAi(r, 'claude.ai (העתק-הדבק)');
    }
    $('#hAiDlg').close();
    var host = $('#hAi'), ctl = new AbortController(), started = Date.now(), final = null, failed = null;
    host.innerHTML = '<div class="card progress"><div class="pulse" aria-hidden="true"><span></span></div><div class="progress-body"><b id="hpT">Claude בודק את התכנית…</b><p id="hpX">מתחיל</p></div><button class="btn ghost small" type="button" id="hpStop">עצירה</button></div>';
    $('#hpStop').addEventListener('click', function () { ctl.abort(); });
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var tick = setInterval(function () { var t = $('#hpT'); if (t) t.textContent = 'Claude בודק את התכנית… ' + Math.round((Date.now() - started) / 1000) + ' שנ׳'; }, 1000);
    var headers = { 'content-type': 'application/json' };
    if (A.state.code) headers['x-access-code'] = A.state.code;
    fetch('api/home', { method: 'POST', headers: headers, signal: ctl.signal, body: JSON.stringify({ request: req, plan: planSummary() }) })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { if (j.needCode) A.askCode(); throw new Error(j.error || 'שגיאת שרת ' + r.status); });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (ln) {
              if (!ln.trim()) return;
              var m = JSON.parse(ln);
              if (m.error) failed = m.error;
              if (m.chars) $('#hpX').textContent = 'כותב… ' + m.chars.toLocaleString('he-IL') + ' תווים';
              if (m.phase === 'done') final = m;
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function () { if (!final && !failed) throw new Error('החיבור נסגר לפני שהתקבלה תשובה'); })
      .catch(function (e) { failed = failed || (ctl.signal.aborted ? 'הבקשה נעצרה' : e.message); })
      .then(function () {
        clearInterval(tick);
        if (failed) { host.innerHTML = '<div class="card retry"><p><b>הבדיקה לא הושלמה.</b> ' + esc(failed) + '</p></div>'; A.toast(failed, true); return; }
        showAi(final.result, final.model);
      });
  }

  function showAi(r, model) {
    var host = $('#hAi');
    host.innerHTML = '<div class="card ai-result"><header class="rhead"><div><span class="who">בדיקה של Claude</span><h3 class="rtitle">' + esc(r.title || 'בדיקת התכנית') + '</h3></div><button class="btn ghost small" type="button" id="hAiClose">סגירה</button></header>' +
      '<p class="summary">' + esc(r.summary) + '</p>' +
      (r.warnings.length ? '<section class="rsec"><h3>אזהרות</h3><ul class="issues">' + r.warnings.map(function (w) { return '<li class="warning">' + esc(w) + '</li>'; }).join('') + '</ul></section>' : '') +
      (r.recommendations.length ? '<section class="rsec"><h3>המלצות</h3><ol class="solution">' + r.recommendations.map(function (x) { return '<li><b>' + esc(x.title) + '</b><p>' + esc(x.detail) + '</p></li>'; }).join('') + '</ol></section>' : '') +
      (r.smart_tips.length ? '<section class="rsec"><h3>בית חכם</h3><ul class="bullets">' + r.smart_tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      (r.questions.length ? '<section class="rsec"><h3>שאלות פתוחות</h3><ul class="bullets">' + r.questions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<p class="rmeta">' + esc(model || '') + '</p></div>';
    $('#hAiClose').addEventListener('click', function () { host.innerHTML = ''; });
  }

  /* ---------- הרכבה ---------- */

  function mount() {
    if (st.mounted) return;
    st.mounted = true;
    $('#hPresets').innerHTML = Object.keys(H.PRESETS).map(function (k) {
      var p = H.PRESETS[k];
      return '<button type="button" class="preset" data-preset="' + k + '"><b>' + p.name + '</b><span>' + p.rooms.length + ' חדרים · ' + H.SUPPLIES[p.supply].name + '</span></button>';
    }).join('');
    $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { fromPreset(b.dataset.preset); }); });
    $('#hSupply').innerHTML = Object.keys(H.SUPPLIES).map(function (k) { return '<option value="' + k + '">' + H.SUPPLIES[k].name + '</option>'; }).join('');
    $('#hTech').innerHTML = Object.keys(H.SMART_TECH).map(function (k) { return '<option value="' + k + '">' + H.SMART_TECH[k].name + '</option>'; }).join('');
    $('#hAddType').innerHTML = Object.keys(H.ROOMS).map(function (k) { return '<option value="' + k + '">' + H.ROOMS[k].name + '</option>'; }).join('');
    $('#hName').addEventListener('input', function () { st.plan.name = this.value; save(); });
    $('#hSupply').addEventListener('change', function () { var v = this.value; change(function (p) { p.supply = v; }); });
    $('#hTech').addEventListener('change', function () { var v = this.value; change(function (p) { p.tech = v; }); });
    $('#hSpd').addEventListener('change', function () { var v = this.checked; change(function (p) { p.spd = v; }); });
    $('#hShabbat').addEventListener('change', function () { var v = this.checked; change(function (p) { p.shabbat = v; }); });
    $('#hAddRoom').addEventListener('click', function () {
      var r = H.newRoom($('#hAddType').value);
      st.open[r.id] = true;
      change(function (p) { p.rooms.push(r); });
      A.toast('נוסף: ' + r.name);
    });
    $('#hOpen').addEventListener('change', function () { var id = this.value; if (id) Store.get(id).then(function (p) { if (p) openPlan(p); }); });
    $$('[data-htab]').forEach(function (b) { b.addEventListener('click', function () { st.tab = b.dataset.htab; render(); }); });
    $('#hTab').addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-tech]');
      if (t) { $('#hTech').value = t.dataset.tech; change(function (p) { p.tech = t.dataset.tech; }); }
    });
    $('#hPrint').addEventListener('click', printPlan);
    $('#hAiBtn').addEventListener('click', openAi);
    $('#hAiSend').addEventListener('click', sendAi);
    $('#hAiCopy').addEventListener('click', function () { A.copy(FP.manualHomePrompt($('#hAiReq').value.trim(), planSummary()), 'ההנחיה הועתקה. הדביקו אותה ב-claude.ai.'); });
    window.addEventListener('resize', function () { if (st.tab === 'panel' && !$('#view-home').hidden) fitPanel(); });
  }

  window.FixHome = {
    open: function (p) { mount(); openPlan(p); Store.save(p).then(fillOpen); },
    show: function () {
      mount();
      if (st.plan) { render(); return; }
      Store.all().then(function (list) {
        if (st.plan) return;
        if (list.length) openPlan(list[0]); else fromPreset('apt4');
      });
    }
  };

  if (location.hash === '#home') window.FixHome.show();
})();
