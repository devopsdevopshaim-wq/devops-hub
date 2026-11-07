/* מעגל סגור — שרטוט אדריכלי לתכנון חשמל.
   מבנה: project → floors (שרטוט לכל קומה) → apartments → rooms.
   קואורדינטות של חדרים, דלתות וחלונות: 0..1000 ביחס לרוחב ולגובה תמונת השרטוט.
   - scale(): מטרים לפיקסל, לפי מידות החדרים מהשרטוט (או כיול ידני)
   - apartmentPlan(): ממיר דירה לתכנית של HomePlan (נקודות, מעגלים, לוח)
   - placePoints(): ממקם שקעים, מאור, מתגים, מזגן וכו׳ על הקירות והתקרה של כל חדר
   - building(): עומס בניין, חיבור מומלץ, חדר מונים ועמוד חשמל
   - renderOverlay() / renderRiser(): שרטוטי SVG
   קובץ משותף: נטען בדפדפן (window.FloorPlan) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./homeplan.js'));
  else root.FloorPlan = factory(root.HomePlan);
})(typeof self !== 'undefined' ? self : this, function (H) {
  'use strict';

  var CEIL = 2.7;
  var TYPE_COLOR = {
    living: '#e9c46a', kitchen: '#f4a261', master: '#a8dadc', bedroom: '#bde0fe', mamad: '#adb5bd', office: '#cdb4db',
    bath: '#90e0ef', toilet: '#90e0ef', laundry: '#caf0f8', balcony: '#b7e4c7', hall: '#e5e5e5', entrance: '#ffe8d6',
    storage: '#d6ccc2', yard: '#95d5b2', parking: '#ced4da'
  };

  /* ---------- גיאומטריה ---------- */

  function box(r) {
    var b = r.box || {};
    var x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  // מטרים לפיקסל: מהמידות שכתובות בשרטוט (רוחב/אורך של כל חדר), חציון על כל החדרים
  function scale(floor) {
    if (floor.calib) return floor.calib;
    var W = floor.w || 1000, Hh = floor.h || 1000, c = [];
    (floor.apartments || []).forEach(function (a) {
      (a.rooms || []).forEach(function (r) {
        var b = box(r), pw = (b.x1 - b.x0) / 1000 * W, ph = (b.y1 - b.y0) / 1000 * Hh;
        if (!(pw > 4 && ph > 4)) return;
        var px = [pw, ph].sort(function (p, q) { return p - q; });
        if (r.width_m > 0 && r.length_m > 0) {
          var m = [r.width_m, r.length_m].sort(function (p, q) { return p - q; });
          c.push((m[0] / px[0] + m[1] / px[1]) / 2);
        } else if (r.area_m2 > 0) c.push(Math.sqrt(r.area_m2 / (pw * ph)));
      });
    });
    if (c.length) { c.sort(function (p, q) { return p - q; }); return c[Math.floor(c.length / 2)]; }
    // בלי מידות: מניחים שהצד הארוך של כל הדירות יחד הוא כ-14 מ׳
    var all = [];
    (floor.apartments || []).forEach(function (a) { (a.rooms || []).forEach(function (r) { all.push(box(r)); }); });
    if (!all.length) return 0.01;
    var bw = (Math.max.apply(null, all.map(function (b) { return b.x1; })) - Math.min.apply(null, all.map(function (b) { return b.x0; }))) / 1000 * W;
    var bh = (Math.max.apply(null, all.map(function (b) { return b.y1; })) - Math.min.apply(null, all.map(function (b) { return b.y0; }))) / 1000 * Hh;
    return 14 / Math.max(bw, bh, 1);
  }

  function roomMeters(floor, r, s) {
    s = s || scale(floor);
    var b = box(r), W = floor.w || 1000, Hh = floor.h || 1000;
    var x = b.x0 / 1000 * W * s, y = b.y0 / 1000 * Hh * s, w = (b.x1 - b.x0) / 1000 * W * s, h = (b.y1 - b.y0) / 1000 * Hh * s;
    return { x: x, y: y, w: w, h: h, area: w * h };
  }

  // נקודה (דלת/חלון) בקואורדינטות התמונה → הקיר הקרוב בחדר ומיקום לאורכו במטרים
  function onWall(floor, r, p, s) {
    var m = roomMeters(floor, r, s), W = floor.w || 1000, Hh = floor.h || 1000;
    s = s || scale(floor);
    var px = p.x / 1000 * W * s - m.x, py = p.y / 1000 * Hh * s - m.y;
    var d = [['top', Math.abs(py)], ['bottom', Math.abs(py - m.h)], ['left', Math.abs(px)], ['right', Math.abs(px - m.w)]].sort(function (a, b) { return a[1] - b[1]; })[0];
    var tol = Math.max(0.8, Math.min(m.w, m.h) * 0.25);
    var inside = px > -tol && px < m.w + tol && py > -tol && py < m.h + tol;
    if (!inside || d[1] > tol) return null;
    var along = d[0] === 'top' || d[0] === 'bottom' ? Math.max(0, Math.min(m.w, px)) : Math.max(0, Math.min(m.h, py));
    return { wall: d[0], at: along };
  }

  function wallLen(m, wall) { return wall === 'top' || wall === 'bottom' ? m.w : m.h; }
  function wallPoint(m, wall, at, inset) {
    inset = inset || 0.08;
    if (wall === 'top') return { x: at, y: inset };
    if (wall === 'bottom') return { x: at, y: m.h - inset };
    if (wall === 'left') return { x: inset, y: at };
    return { x: m.w - inset, y: at };
  }

  /* ---------- דירה → תכנית חשמל ---------- */

  function apartmentPlan(project, floor, apt) {
    var s = scale(floor);
    var rooms = (apt.rooms || []).map(function (r) {
      var type = H.ROOMS[r.type] ? r.type : 'storage';
      var m = roomMeters(floor, r, s), area = Math.max(1, Math.round(m.area * 10) / 10);
      var hr = H.newRoom(type, r.name || H.ROOMS[type].name);
      hr.id = r.id;
      hr.area = area;
      hr.sockets = H.ROOMS[type].sockets(area);
      hr.lights = H.ROOMS[type].lights(area);
      var o = r.override || {};
      ['sockets', 'lights', 'net', 'tv', 'ac'].forEach(function (k) { if (o[k] != null) hr[k] = o[k]; });
      if (o.app) hr.app = JSON.parse(JSON.stringify(o.app));
      return hr;
    });
    // דוד אחד לדירה
    var baths = rooms.filter(function (r) { return r.type === 'bath'; });
    baths.forEach(function (r, i) { if (i > 0 && !((apt.rooms.filter(function (x) { return x.id === r.id; })[0] || {}).override || {}).app) r.app.heater = false; });
    return { name: apt.name, supply: apt.supply || project.supply || '3x25', tech: project.tech || 'none', spd: true, shabbat: project.shabbat !== false, rooms: rooms };
  }

  /* ---------- מיקום נקודות בחדר ---------- */

  function placePoints(project, floor, apt, plan) {
    plan = plan || apartmentPlan(project, floor, apt);
    var s = scale(floor), C = H.circuits(plan);
    var out = {};
    function circuitFor(kind, roomName, appKey) {
      return C.circuits.filter(function (c) {
        if (c.rooms.indexOf(roomName) < 0) return false;
        if (kind === 'light') return c.kind === 'light';
        if (kind === 'socket') return c.kind === 'socket';
        if (kind === 'ac') return c.kind === 'ac';
        return c.kind === appKey;
      })[0] || null;
    }
    (apt.rooms || []).forEach(function (r) {
      var hr = plan.rooms.filter(function (x) { return x.id === r.id; })[0];
      if (!hr) return;
      var m = roomMeters(floor, r, s), pts = [];
      var doors = (r.doors || []).map(function (p) { return onWall(floor, r, p, s); }).filter(Boolean);
      var wins = (r.windows || []).map(function (p) { return onWall(floor, r, p, s); }).filter(Boolean);
      var t = H.ROOMS[hr.type] || {};
      function blocked(wall, at, gap) { return doors.some(function (d) { return d.wall === wall && Math.abs(d.at - at) < (gap || 0.55); }); }
      function add(kind, label, wall, at, h, extra) {
        var p = wall ? wallPoint(m, wall, at) : { x: at.x, y: at.y };
        var o = { kind: kind, label: label, x: p.x, y: p.y, wall: wall || null, h: h };
        for (var k in extra || {}) o[k] = extra[k];
        pts.push(o);
        return o;
      }
      var walls = ['top', 'right', 'bottom', 'left'];
      var longest = walls.slice().sort(function (a, b) { return wallLen(m, b) - wallLen(m, a); })[0];
      var winWall = wins.length ? wins[0].wall : null;

      // מתג: ליד הדלת הראשונה, בצד הפנימי
      var door = doors[0];
      if (hr.lights > 0) {
        var sw = door ? { wall: door.wall, at: Math.min(wallLen(m, door.wall) - 0.15, door.at + 0.65) } : { wall: longest, at: 0.35 };
        if (door && sw.at > wallLen(m, door.wall) - 0.2) sw.at = Math.max(0.15, door.at - 0.65);
        add('switch', t.twoWay ? 'מתג מחליף' : 'מתג תאורה', sw.wall, sw.at, 1.1, { circuit: circuitFor('light', hr.name) });
        if (t.twoWay && doors[1]) add('switch', 'מתג מחליף', doors[1].wall, Math.min(wallLen(m, doors[1].wall) - 0.15, doors[1].at + 0.65), 1.1, { circuit: circuitFor('light', hr.name) });
      }

      // מאור: רשת על התקרה
      if (hr.lights > 0) {
        var cols = Math.max(1, Math.round(Math.sqrt(hr.lights * m.w / Math.max(m.h, 0.5)))), rows = Math.ceil(hr.lights / cols), n = 0;
        for (var i = 0; i < rows && n < hr.lights; i++) {
          var inRow = Math.min(cols, hr.lights - n);
          for (var j = 0; j < inRow; j++, n++) add('light', 'נקודת מאור', null, { x: m.w * (j + 0.5) / inRow, y: m.h * (i + 0.5) / rows }, CEIL, { circuit: circuitFor('light', hr.name), kw: 0.08 });
        }
      }

      // מזגן: על קיר עם חלון (חיצוני), אחרת הקיר הארוך
      var acWall = winWall || longest;
      if (hr.ac && H.AC_SIZES[hr.ac]) {
        var ac = H.AC_SIZES[hr.ac];
        add('ac', ac.name, acWall, wallLen(m, acWall) / 2, 2.2, { circuit: circuitFor('ac', hr.name), kw: ac.kw });
      }

      // טלוויזיה ורשת: הקיר הארוך שאינו קיר המזגן
      var tvWall = walls.filter(function (w) { return w !== acWall; }).sort(function (a, b) { return wallLen(m, b) - wallLen(m, a); })[0];
      var tvAt = wallLen(m, tvWall) / 2;
      if (blocked(tvWall, tvAt, 0.8)) tvAt = wallLen(m, tvWall) * 0.3;
      for (var k = 0; k < (hr.tv || 0); k++) add('tv', 'נקודת טלוויזיה', tvWall, tvAt + k * 0.4, 1.3);
      for (k = 0; k < (hr.net || 0); k++) add('net', 'נקודת רשת CAT6', k === 0 && hr.tv ? tvWall : walls[(walls.indexOf(tvWall) + 2) % 4], k === 0 && hr.tv ? Math.min(wallLen(m, tvWall) - 0.2, tvAt + 0.45) : wallLen(m, walls[(walls.indexOf(tvWall) + 2) % 4]) * 0.7, 0.3);

      // מכשירים במעגל ייעודי: לאורך הקיר הארוך (משטח עבודה במטבח)
      var apps = Object.keys(hr.app || {}).filter(function (k2) { return hr.app[k2]; });
      var APH = { oven: 0.5, cooktop: 0.6, dishwasher: 0.3, fridge: 0.6, washer: 0.6, dryer: 1.6, heater: 1.6, ev: 1.2, comm: 0.4 };
      var appWall = t.kitchen ? longest : walls.filter(function (w) { return w !== tvWall; })[0];
      apps.forEach(function (key, idx) {
        var a = H.APPLIANCES[key], L = wallLen(m, appWall);
        var at = L * (idx + 1) / (apps.length + 1);
        if (blocked(appWall, at)) at = Math.min(L - 0.3, at + 0.7);
        var label = key === 'heater' ? 'מפסק דוד (עם נורית)' : a.name;
        add('appliance', label, appWall, at, APH[key] || 0.6, { app: key, circuit: circuitFor('app', hr.name, key), kw: a.kw });
      });

      // שקעים: מפוזרים לאורך ההיקף, הרחק מדלתות. במטבח — מעל משטח העבודה
      var nS = hr.sockets || 0;
      if (nS) {
        var per = 2 * (m.w + m.h), placed = 0;
        var kitchenWall = t.kitchen ? longest : null;
        for (var q = 0; q < nS * 4 && placed < nS; q++) {
          var pos = (per * (placed + 0.5) / nS + q * 0.37) % per, wall2, at2;
          if (kitchenWall && placed < Math.ceil(nS * 0.7)) { wall2 = kitchenWall; at2 = wallLen(m, kitchenWall) * (placed + 0.5) / Math.ceil(nS * 0.7); }
          else if (pos < m.w) { wall2 = 'top'; at2 = pos; }
          else if (pos < m.w + m.h) { wall2 = 'right'; at2 = pos - m.w; }
          else if (pos < 2 * m.w + m.h) { wall2 = 'bottom'; at2 = 2 * m.w + m.h - pos; }
          else { wall2 = 'left'; at2 = per - pos; }
          at2 = Math.max(0.25, Math.min(wallLen(m, wall2) - 0.25, at2));
          if (blocked(wall2, at2) || pts.some(function (p) { return p.kind === 'socket' && p.wall === wall2 && Math.abs(p.at - at2) < 0.3; })) continue;
          var sp = add('socket', t.wet ? 'שקע מוגן מים IP44' : kitchenWall && wall2 === kitchenWall ? 'שקע מעל משטח' : 'שקע כפול 16A', wall2, at2, t.wet ? 1.2 : kitchenWall && wall2 === kitchenWall ? 1.1 : 0.3, { circuit: circuitFor('socket', hr.name) });
          sp.at = at2;
          placed++;
        }
      }
      // מאוורר באזורים רטובים
      if (t.fan) add('fan', 'מאוורר / וונטה', winWall || longest, wallLen(m, winWall || longest) * 0.8, 2.3, { circuit: circuitFor('socket', hr.name), kw: 0.04 });

      // הספק וזרם צפוי לחדר
      var kw = pts.reduce(function (sum, p) { return sum + (p.kw || 0); }, 0) + (hr.sockets || 0) * 0.12;
      out[r.id] = { points: pts, m: m, plan: hr, kw: kw, amps: kw * 1000 / 230, doors: doors, windows: wins };
    });

    // לוח החשמל הדירתי: ליד הכניסה
    var ent = apt.panel && apt.panel.x != null ? apt.panel : apt.entrance;
    if (ent && ent.x != null) {
      var host = (apt.rooms || []).map(function (r) { var w = onWall(floor, r, ent, s); return w && { r: r, w: w }; }).filter(Boolean)[0];
      if (host && out[host.r.id]) {
        var mm = out[host.r.id].m, p = wallPoint(mm, host.w.wall, Math.min(wallLen(mm, host.w.wall) - 0.3, host.w.at + 0.9));
        out[host.r.id].points.push({ kind: 'panel', label: 'לוח חשמל דירתי', x: p.x, y: p.y, wall: host.w.wall, h: 1.6 });
        out._panelRoom = host.r.id;
      }
    }
    if (!out._panelRoom) {
      var first = (apt.rooms || []).filter(function (r) { return r.type === 'entrance' || r.type === 'hall'; })[0] || (apt.rooms || [])[0];
      if (first && out[first.id]) { var m2 = out[first.id].m; out[first.id].points.push({ kind: 'panel', label: 'לוח חשמל דירתי', x: 0.1, y: Math.min(m2.h - 0.3, 0.5), wall: 'left', h: 1.6 }); out._panelRoom = first.id; }
    }
    out._circuits = C;
    return out;
  }

  /* ---------- בניין ---------- */

  // מקדם בו-זמניות לפי מספר דירות (הערכה מקובלת לתכנון ראשוני)
  function ks(n) {
    if (n <= 1) return 1;
    if (n <= 4) return 0.8;
    if (n <= 9) return 0.6;
    if (n <= 14) return 0.5;
    if (n <= 19) return 0.45;
    if (n <= 24) return 0.42;
    if (n <= 29) return 0.4;
    return 0.38;
  }
  var BREAKERS = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800];

  function building(project) {
    var floors = (project.floors || []).slice().sort(function (a, b) { return (b.level || 0) - (a.level || 0); });
    var units = [], aptKw = 0, n = 0, resFloors = 0;
    floors.forEach(function (f) {
      var rep = Math.max(1, f.repeat || 1);
      if ((f.apartments || []).some(function (a) { return (a.rooms || []).length; })) resFloors += rep;
      (f.apartments || []).forEach(function (a) {
        if (!(a.rooms || []).length) return;
        var plan = apartmentPlan(project, f, a), C = H.circuits(plan);
        var kw = C.loadKw.reduce(function (s, x) { return s + x; }, 0);
        var maxA = Math.max.apply(null, C.perPhaseA);
        var supply = a.supply || (maxA > 21 ? '3x40' : '3x25');
        units.push({ floor: f, apt: a, plan: plan, kw: kw, maxA: maxA, supply: supply, rep: rep, area: plan.rooms.reduce(function (s, r) { return s + r.area; }, 0) });
        aptKw += kw * rep;
        n += rep;
      });
    });
    var levels = floors.length ? Math.max.apply(null, floors.map(function (f) { return (f.level || 0) + Math.max(1, f.repeat || 1) - 1; })) : 0;
    var common = [];
    var totalFloors = Math.max(resFloors, levels + 1);
    // דירה בודדת או בית פרטי: אין שירותים משותפים של בניין
    var isBuilding = project.kind === 'building' || n > 1;
    if (isBuilding) common.push({ name: 'תאורת חדר מדרגות ולובי', kw: 0.12 * totalFloors + 0.3 });
    if (isBuilding && (totalFloors >= 3 || project.elevator)) common.push({ name: 'מעלית', kw: 11 * Math.max(1, project.elevators || 1) });
    if (isBuilding && totalFloors >= 5) common.push({ name: 'משאבות מים (מערכת הגברת לחץ)', kw: 5.5 });
    if (floors.some(function (f) { return f.kind === 'parking'; })) common.push({ name: 'חניון: תאורה, שער ואוורור', kw: 4 });
    if (isBuilding && totalFloors >= 9) common.push({ name: 'מערכות בטיחות (שחרור עשן, גנרטור)', kw: 6 });
    var commonKw = common.reduce(function (s, c) { return s + c.kw; }, 0);
    var demand = ks(n) * aptKw + 0.8 * commonKw;
    var amps = demand * 1000 / (Math.sqrt(3) * 400 * 0.95);
    var main = BREAKERS.filter(function (b) { return b >= amps * 1.2; })[0] || BREAKERS[BREAKERS.length - 1];
    return {
      units: units, apartments: n, aptKw: aptKw, ks: ks(n), common: common, commonKw: commonKw,
      demandKw: demand, amps: amps, main: main, floors: floors, isBuilding: isBuilding,
      meters: n + (isBuilding ? 1 : 0) + (common.some(function (c) { return /מעלית/.test(c.name); }) ? 1 : 0)
    };
  }

  /* ---------- שרטוטים ---------- */

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var GLYPH = {
    socket: function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" stroke="#1c6fe0" stroke-width="' + r * 0.28 + '"/><circle cx="' + (x - r * 0.38) + '" cy="' + y + '" r="' + r * 0.16 + '" fill="#1c6fe0"/><circle cx="' + (x + r * 0.38) + '" cy="' + y + '" r="' + r * 0.16 + '" fill="#1c6fe0"/>'; },
    light: function (x, y, r) { var d = r * 0.7; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff6d6" stroke="#b08a42" stroke-width="' + r * 0.25 + '"/><path d="M' + (x - d) + ' ' + (y - d) + 'L' + (x + d) + ' ' + (y + d) + 'M' + (x + d) + ' ' + (y - d) + 'L' + (x - d) + ' ' + (y + d) + '" stroke="#b08a42" stroke-width="' + r * 0.22 + '"/>'; },
    switch: function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.7 + '" fill="#14213d"/><path d="M' + x + ' ' + y + 'l' + r * 1.1 + ' ' + (-r * 1.1) + '" stroke="#14213d" stroke-width="' + r * 0.25 + '"/>'; },
    ac: function (x, y, r) { return '<rect x="' + (x - r * 1.6) + '" y="' + (y - r * 0.7) + '" width="' + r * 3.2 + '" height="' + r * 1.4 + '" rx="' + r * 0.3 + '" fill="#e8f4ff" stroke="#2a6f97" stroke-width="' + r * 0.22 + '"/><text x="' + x + '" y="' + (y + r * 0.42) + '" text-anchor="middle" font-size="' + r * 1.05 + '" font-weight="700" fill="#2a6f97">AC</text>'; },
    tv: function (x, y, r) { return '<rect x="' + (x - r * 1.3) + '" y="' + (y - r * 0.8) + '" width="' + r * 2.6 + '" height="' + r * 1.6 + '" rx="' + r * 0.2 + '" fill="#222"/><text x="' + x + '" y="' + (y + r * 0.4) + '" text-anchor="middle" font-size="' + r * 0.95 + '" font-weight="700" fill="#fff">TV</text>'; },
    net: function (x, y, r) { return '<path d="M' + x + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r * 0.8) + 'L' + (x - r) + ' ' + (y + r * 0.8) + 'Z" fill="#2b9348" stroke="#fff" stroke-width="' + r * 0.15 + '"/>'; },
    appliance: function (x, y, r, p) { var L = { oven: 'O', cooktop: 'K', dishwasher: 'D', fridge: 'F', washer: 'W', dryer: 'Y', heater: 'H', ev: 'EV', comm: 'C' }[p.app] || 'A'; return '<rect x="' + (x - r) + '" y="' + (y - r) + '" width="' + r * 2 + '" height="' + r * 2 + '" rx="' + r * 0.3 + '" fill="#c62828"/><text x="' + x + '" y="' + (y + r * 0.42) + '" text-anchor="middle" font-size="' + r * (L.length > 1 ? 0.9 : 1.2) + '" font-weight="700" fill="#fff">' + L + '</text>'; },
    fan: function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.9 + '" fill="#fff" stroke="#6c757d" stroke-width="' + r * 0.2 + '"/><path d="M' + x + ' ' + y + 'm0 ' + (-r * 0.6) + 'q' + r * 0.5 + ' ' + r * 0.6 + ' 0 ' + r * 1.2 + 'q' + (-r * 0.5) + ' ' + (-r * 0.6) + ' 0 ' + (-r * 1.2) + '" fill="#6c757d"/>'; },
    panel: function (x, y, r) { return '<rect x="' + (x - r * 1.4) + '" y="' + (y - r * 1.1) + '" width="' + r * 2.8 + '" height="' + r * 2.2 + '" rx="' + r * 0.25 + '" fill="#0c1424" stroke="#c9a45c" stroke-width="' + r * 0.3 + '"/><path d="M' + (x + r * 0.2) + ' ' + (y - r * 0.8) + 'l' + (-r * 0.6) + ' ' + r * 0.9 + 'h' + r * 0.5 + 'l' + (-r * 0.4) + ' ' + r * 0.8 + 'l' + r * 0.9 + ' ' + (-r * 1.1) + 'h' + (-r * 0.5) + 'z" fill="#c9a45c"/>'; }
  };

  // שכבת חשמל מעל השרטוט. sel = {apt, room}. editable = ידיות לגרירה
  function renderOverlay(project, floor, opts) {
    opts = opts || {};
    var W = floor.w || 1000, Hh = floor.h || 1000, s = scale(floor), o = [];
    var r0 = Math.max(W, Hh) * 0.0085;
    o.push('<svg xmlns="http://www.w3.org/2000/svg" class="fp-svg" viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" font-family="Heebo, Arial, sans-serif">');
    if (floor.image) o.push('<image href="' + floor.image + '" x="0" y="0" width="' + W + '" height="' + Hh + '" preserveAspectRatio="none"' + (opts.dim ? ' opacity=".55"' : '') + '/>');
    else o.push('<rect width="' + W + '" height="' + Hh + '" fill="#fbfaf6"/>');
    (floor.common || []).forEach(function (c) {
      var b = box(c);
      o.push('<rect x="' + b.x0 / 1000 * W + '" y="' + b.y0 / 1000 * Hh + '" width="' + (b.x1 - b.x0) / 1000 * W + '" height="' + (b.y1 - b.y0) / 1000 * Hh + '" fill="#6c757d" fill-opacity=".14" stroke="#6c757d" stroke-dasharray="6 4"/>');
    });
    (floor.apartments || []).forEach(function (a) {
      var focus = !opts.apt || opts.apt === a.id;
      var P = focus && opts.points !== false ? placePoints(project, floor, a) : null;
      (a.rooms || []).forEach(function (r) {
        var b = box(r), x = b.x0 / 1000 * W, y = b.y0 / 1000 * Hh, w = (b.x1 - b.x0) / 1000 * W, h = (b.y1 - b.y0) / 1000 * Hh;
        var sel = opts.room === r.id, m = roomMeters(floor, r, s);
        o.push('<g class="fp-room' + (sel ? ' sel' : '') + '" data-room="' + esc(r.id) + '" data-apt="' + esc(a.id) + '" opacity="' + (focus ? 1 : 0.35) + '">');
        o.push('<rect class="fp-rect" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (TYPE_COLOR[r.type] || '#ddd') + '" fill-opacity="' + (sel ? 0.38 : 0.24) + '" stroke="' + (sel ? '#1c6fe0' : '#b08a42') + '" stroke-width="' + (sel ? r0 * 0.5 : r0 * 0.28) + '"/>');
        var fs = Math.max(r0 * 1.1, Math.min(r0 * 2, w / 9));
        o.push('<text x="' + (x + w / 2) + '" y="' + (y + h / 2 - fs * 0.2) + '" text-anchor="middle" direction="rtl" font-size="' + fs + '" font-weight="700" fill="#14213d" paint-order="stroke" stroke="#fff" stroke-width="' + fs * 0.25 + '">' + esc(r.name) + '</text>');
        o.push('<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + fs * 0.95) + '" text-anchor="middle" direction="rtl" font-size="' + fs * 0.72 + '" fill="#5c5440" paint-order="stroke" stroke="#fff" stroke-width="' + fs * 0.2 + '">' + m.w.toFixed(1) + '×' + m.h.toFixed(1) + ' מ׳ · ' + m.area.toFixed(1) + ' מ״ר</text>');
        if (P && P[r.id]) {
          var pxm = 1 / s;
          P[r.id].points.forEach(function (p) {
            var gx = x + p.x * pxm, gy = y + p.y * pxm;
            o.push('<g class="fp-pt" data-kind="' + p.kind + '"><title>' + esc(p.label + ' · גובה ' + p.h + ' מ׳' + (p.circuit ? ' · מעגל ' + p.circuit.id + ' (' + p.circuit.breaker + ')' : '')) + '</title>' + GLYPH[p.kind](gx, gy, r0, p) + '</g>');
          });
        }
        if (opts.editable && sel) {
          [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function (c, i) {
            o.push('<rect class="fp-handle" data-h="' + i + '" x="' + (c[0] - r0) + '" y="' + (c[1] - r0) + '" width="' + r0 * 2 + '" height="' + r0 * 2 + '" fill="#1c6fe0" stroke="#fff" stroke-width="' + r0 * 0.3 + '"/>');
          });
        }
        o.push('</g>');
      });
    });
    o.push('</svg>');
    return o.join('');
  }

  // עמוד חשמל: חתך הבניין, דירות בכל קומה, חדר מונים וחיבור חברת החשמל
  function renderRiser(B, title) {
    var floors = B.floors.filter(function (f) { return (f.apartments || []).some(function (a) { return (a.rooms || []).length; }) || f.kind !== 'residential'; });
    var maxApts = Math.max(1, Math.max.apply(null, floors.map(function (f) { return (f.apartments || []).length; }).concat([1])));
    var boxW = 150, gap = 14, left = 270, rowH = 74;
    var W = left + maxApts * (boxW + gap) + 60, Hh = 110 + floors.length * rowH + 150;
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" class="riser-svg" font-family="Heebo, Arial, sans-serif">');
    o.push('<rect x="4" y="4" width="' + (W - 8) + '" height="' + (Hh - 8) + '" rx="18" fill="#0f1828" stroke="#c9a45c" stroke-width="2"/>');
    o.push('<text x="' + (W - 28) + '" y="44" text-anchor="start" direction="rtl" fill="#f4ead6" font-size="20" font-weight="700">' + esc(title) + '</text>');
    var riserX = 58, topY = 80, groundY = 100 + floors.length * rowH;
    o.push('<line x1="' + riserX + '" y1="' + topY + '" x2="' + riserX + '" y2="' + groundY + '" stroke="#c9a45c" stroke-width="6" stroke-linecap="round"/>');
    o.push('<text x="' + (riserX - 16) + '" y="' + ((topY + groundY) / 2) + '" fill="#c9a45c" font-size="12" text-anchor="middle" transform="rotate(-90 ' + (riserX - 16) + ' ' + ((topY + groundY) / 2) + ')">עמוד חשמל ראשי</text>');
    floors.forEach(function (f, i) {
      var y = 90 + i * rowH;
      o.push('<line x1="' + (left - 30) + '" y1="' + (y + rowH - 6) + '" x2="' + (W - 30) + '" y2="' + (y + rowH - 6) + '" stroke="#2c3a55"/>');
      o.push('<text x="' + (left - 18) + '" y="' + (y + 22) + '" text-anchor="start" direction="rtl" fill="#e3c78a" font-size="13" font-weight="700">' + esc(f.label || ('קומה ' + f.level)) + '</text>');
      if ((f.repeat || 1) > 1) o.push('<text x="' + (left - 18) + '" y="' + (y + 37) + '" text-anchor="start" direction="rtl" fill="#cfc5ae" font-size="11">×' + f.repeat + ' קומות</text>');
      (f.apartments || []).forEach(function (a, j) {
        var u = B.units.filter(function (x) { return x.apt === a; })[0];
        var x = left + j * (boxW + gap);
        o.push('<line x1="' + riserX + '" y1="' + (y + 48) + '" x2="' + x + '" y2="' + (y + 48) + '" stroke="#c9a45c" stroke-width="1.5" stroke-dasharray="' + (j ? '4 3' : '0') + '"/>');
        o.push('<rect x="' + x + '" y="' + (y + 6) + '" width="' + boxW + '" height="' + (rowH - 22) + '" rx="10" fill="#fffdf7" stroke="#c9a45c"/>');
        o.push('<text x="' + (x + boxW - 10) + '" y="' + (y + 26) + '" text-anchor="start" direction="rtl" font-size="13" font-weight="700" fill="#14213d">' + esc(a.name || 'דירה') + '</text>');
        if (u) o.push('<text x="' + (x + boxW - 10) + '" y="' + (y + 44) + '" text-anchor="start" direction="rtl" font-size="11" fill="#5c5440">' + u.area.toFixed(0) + ' מ״ר · ' + u.kw.toFixed(1) + 'kW · ' + u.supply.replace('x', '×') + 'A</text>');
      });
      if (f.kind && f.kind !== 'residential' && !(f.apartments || []).length) o.push('<text x="' + left + '" y="' + (y + 34) + '" fill="#cfc5ae" font-size="12">' + esc({ ground: 'קומת קרקע / לובי', parking: 'חניון', roof: 'גג', other: 'שטח משותף' }[f.kind] || '') + '</text>');
    });
    // חדר מונים
    var my = groundY + 16;
    o.push('<rect x="' + (riserX - 50) + '" y="' + my + '" width="' + (Math.min(W - 80, 60 + B.meters * 22)) + '" height="64" rx="10" fill="#17233a" stroke="#c9a45c"/>');
    o.push('<text x="' + (riserX - 40) + '" y="' + (my + 20) + '" fill="#e3c78a" font-size="12" font-weight="700">חדר מונים · ' + B.meters + ' מונים</text>');
    for (var k = 0; k < Math.min(B.meters, Math.floor((W - 140) / 22)); k++) o.push('<rect x="' + (riserX - 40 + k * 22) + '" y="' + (my + 30) + '" width="16" height="24" rx="3" fill="#fffdf7"/><circle cx="' + (riserX - 32 + k * 22) + '" cy="' + (my + 40) + '" r="4" fill="#0f1828"/>');
    o.push('<text x="' + (W - 28) + '" y="' + (Hh - 28) + '" text-anchor="start" direction="rtl" fill="#f4ead6" font-size="14" font-weight="700">חיבור חברת החשמל: ' + B.main + 'A × 3 · עומס משוער ' + B.demandKw.toFixed(0) + 'kW (' + B.amps.toFixed(0) + 'A)</text>');
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- בדיקת תוצאת ניתוח ---------- */

  function validate(project) {
    var issues = [];
    (project.floors || []).forEach(function (f, fi) {
      var all = [];
      (f.apartments || []).forEach(function (a) { (a.rooms || []).forEach(function (r) { all.push({ a: a, r: r, b: box(r) }); }); });
      all.forEach(function (x) {
        var b = x.b;
        if (!(b.x1 - b.x0 >= 8 && b.y1 - b.y0 >= 8)) issues.push('קומה ' + (fi + 1) + ': החדר "' + x.r.name + '" קטן מדי או בלי מידות תקינות.');
        if (b.x0 < 0 || b.y0 < 0 || b.x1 > 1000 || b.y1 > 1000) issues.push('קומה ' + (fi + 1) + ': החדר "' + x.r.name + '" חורג מגבולות השרטוט (0–1000).');
      });
      for (var i = 0; i < all.length; i++) for (var j = i + 1; j < all.length; j++) {
        var p = all[i].b, q = all[j].b;
        var ix = Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)), iy = Math.max(0, Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0));
        var small = Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (q.x1 - q.x0) * (q.y1 - q.y0));
        if (small > 0 && ix * iy / small > 0.35) issues.push('קומה ' + (fi + 1) + ': החדרים "' + all[i].r.name + '" ו-"' + all[j].r.name + '" חופפים ברובם. כל חדר צריך מלבן משלו.');
      }
    });
    return issues;
  }

  return {
    CEIL: CEIL, TYPE_COLOR: TYPE_COLOR, box: box, scale: scale, roomMeters: roomMeters, onWall: onWall,
    apartmentPlan: apartmentPlan, placePoints: placePoints, building: building, ks: ks,
    renderOverlay: renderOverlay, renderRiser: renderRiser, validate: validate
  };
});
