/* מעגל סגור — ערכות מדידה לכרטיס מודפס.
   solve()  — פותר DC פשוט (MNA): נגדים, נוריות ודיודות (מפל מתח קבוע), רגולטורים ומקורות הזנה.
              טרנזיסטורים, רכיבים משולבים ומתגים נחשבים פתוחים (מצב מנוחה).
   rth()    — התנגדות בין שני צמתים כשהכרטיס לא מוזן (מה שהאוהממטר אמור להראות).
   kits()   — ערכות בדיקה שנבנות מהמעגל עצמו, עם ערכים צפויים וטווחי תקין.
   check()  — משווה ערך שנמדד לטווח הצפוי.
   קובץ משותף: נטען בדפדפן (window.TestKit) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./netlist.js'));
  else root.TestKit = factory(root.Netlist);
})(typeof self !== 'undefined' ? self : this, function (Netlist) {
  'use strict';

  var PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

  /* ---------- פענוח ערכים ---------- */

  function resistance(v) {
    var s = String(v || '').replace(',', '.');
    var m = s.match(/(\d+)([RkKM])(\d+)/); // 4k7, 2R2
    if (m) return parseFloat(m[1] + '.' + m[3]) * (m[2] === 'R' ? 1 : PREFIX[m[2]]);
    m = s.match(/(\d+(?:\.\d+)?)\s*([kKM])?\s*(Ω|ohm|R\b)?/i);
    if (!m) return null;
    var n = parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1);
    return n > 0 ? n : null;
  }
  function capacitance(v) {
    var m = String(v || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*([pnuµm])?F/);
    return m ? parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1) : null;
  }
  function frequency(v) {
    var m = String(v || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*([kKM])?Hz/i);
    return m ? parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1) : null;
  }
  function ledVf(c) {
    var s = (c.value || '') + ' ' + (c.label || '');
    var m = s.match(/(\d+(?:\.\d+)?)\s*V\b/);
    if (m) return parseFloat(m[1]);
    if (/כחול|blue|לבן|white|UV/i.test(s)) return 3.0;
    if (/ירוק|green/i.test(s)) return 2.2;
    if (/צהוב|yellow|כתום|orange/i.test(s)) return 2.1;
    return 2.0;
  }
  function diodeVf(c) { return /SS\d|1N58|BAT|schottky|שוטקי/i.test(c.value || '') ? 0.3 : 0.7; }
  function regulatorOut(c) {
    var s = String(c.value || c.label || '');
    var m = s.match(/3V3/i) ? ['', '3.3'] : s.match(/-(\d+(?:\.\d+)?)\b/) || s.match(/78(\d{2})/);
    return m ? parseFloat(m[1]) : null;
  }
  function coilOhms(c) {
    var m = String(c.value || '').match(/(\d+(?:\.\d+)?)\s*V/i);
    if (!m) return null;
    var v = parseFloat(m[1]);
    return v * v / 0.36; // סליל ממסר טיפוסי צורך כ-0.36W
  }
  var TYPICAL_mA = [[/ESP32/i, 80, 'ESP32 במנוחה (עד 500mA בשידור)'], [/ESP8266/i, 70, 'ESP8266'], [/328P|Nano|Uno|ATmega/i, 20, 'בקר AVR'],
    [/555/, 5, 'NE555'], [/1117|LDO|78\d\d|LM317/i, 5, 'זרם עצמי של רגולטור'], [/DHT|DS18B20|BME|BMP/i, 1, 'חיישן']];

  /* ---------- צמתים ---------- */

  function graph(sch) {
    var comps = sch.components || [], terms = {}, parent = {};
    comps.forEach(function (c) { (c.terminals || []).forEach(function (t) { var k = c.id + '.' + t.id; terms[k] = { c: c, t: t }; parent[k] = k; }); });
    function res(ref) {
      if (terms[ref]) return ref;
      var l = String(ref).toLowerCase();
      for (var k in terms) if (k.toLowerCase() === l) return k;
      return null;
    }
    function find(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
    var deg = {};
    (sch.wires || []).forEach(function (w) {
      var a = res(w.from), b = res(w.to);
      if (!a || !b || a === b) return;
      deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1;
      var ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    });
    var nets = {};
    Object.keys(terms).forEach(function (k) {
      var r = find(k);
      var n = nets[r] = nets[r] || { id: r, terms: [], pot: null };
      n.terms.push(k);
      var p = Netlist.normPotential(terms[k].t.potential);
      if (p === '0V') n.pot = 0;
      else if (/^\+\d/.test(p) && n.pot == null) n.pot = parseFloat(p.slice(1));
    });
    return {
      comps: comps, terms: terms, nets: nets, deg: deg,
      net: function (k) { return k && terms[k] ? nets[find(k)] : null; },
      key: function (c, re) { var t = (c.terminals || []).filter(function (x) { return re.test(String(x.id)); })[0]; return t ? c.id + '.' + t.id : null; }
    };
  }

  // שם קריא לצומת: מעדיפים הדק של מחבר, מקור או רגולטור
  function label(G, net) {
    if (!net) return '?';
    var pref = net.terms.slice().sort(function (a, b) { return rank(G, a) - rank(G, b); });
    return pref[0];
  }
  function rank(G, k) {
    var c = G.terms[k].c;
    return { source: 0, connector: 1, regulator: 2, mcu: 3, ic: 4 }[c.type] != null ? { source: 0, connector: 1, regulator: 2, mcu: 3, ic: 4 }[c.type] : 5;
  }

  /* ---------- פותר ---------- */

  function gauss(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var p = i, mx = Math.abs(A[i][i]);
      for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > mx) { mx = Math.abs(A[k][i]); p = k; }
      if (mx < 1e-18) return null;
      if (p !== i) { var t = A[i]; A[i] = A[p]; A[p] = t; var tb = b[i]; b[i] = b[p]; b[p] = tb; }
      for (k = i + 1; k < n; k++) {
        var f = A[k][i] / A[i][i];
        if (!f) continue;
        for (j = i; j < n; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  function elements(G, fixed) {
    var R = [], D = [];
    G.comps.forEach(function (c) {
      var ks = (c.terminals || []).map(function (t) { return c.id + '.' + t.id; });
      if (c.type === 'resistor') {
        var r = resistance(c.value);
        if (!r) return;
        if (ks.length === 2) R.push({ c: c, a: G.net(ks[0]), b: G.net(ks[1]), r: r });
        else if (ks.length === 3) { // פוטנציומטר: המגב באמצע
          var w = G.key(c, /^W$/i), ends = ks.filter(function (k) { return k !== w; });
          if (w) ends.forEach(function (k) { R.push({ c: c, a: G.net(k), b: G.net(w), r: r / 2, part: true }); });
        }
      } else if ((c.type === 'fuse' || c.type === 'inductor') && ks.length === 2) {
        R.push({ c: c, a: G.net(ks[0]), b: G.net(ks[1]), r: 0.05 });
      } else if (c.type === 'led' || c.type === 'diode') {
        var a = G.key(c, /^(A|\+|ANODE)$/i), k = G.key(c, /^(K|C|-|CATHODE)$/i);
        if (a && k) D.push({ c: c, a: G.net(a), k: G.net(k), vf: c.type === 'led' ? ledVf(c) : diodeVf(c), on: true });
      } else if (c.type === 'relay' || c.type === 'contactor') {
        var a1 = G.key(c, /^(A1|COIL1|COIL\+)$/i), a2 = G.key(c, /^(A2|COIL2|COIL-)$/i), cr = coilOhms(c);
        if (a1 && a2 && cr) R.push({ c: c, a: G.net(a1), b: G.net(a2), r: cr, coil: true });
      }
    });
    return { R: R.filter(function (e) { return e.a && e.b && e.a !== e.b; }), D: D.filter(function (e) { return e.a && e.k && e.a !== e.k; }) };
  }

  function solve(sch) {
    var G = graph(sch), fixed = {};
    Object.keys(G.nets).forEach(function (id) { if (G.nets[id].pot != null) fixed[id] = G.nets[id].pot; });
    // רגולטורים: היציאה קבועה אם יש מספיק מתח בכניסה
    G.comps.forEach(function (c) {
      if (c.type !== 'regulator') return;
      var vo = regulatorOut(c), ni = G.net(G.key(c, /^(IN|VIN|VI)$/i)), no = G.net(G.key(c, /^(OUT|VOUT|VO)$/i));
      if (vo && ni && no && fixed[ni.id] != null && fixed[no.id] == null && fixed[ni.id] > vo + 0.3) fixed[no.id] = vo;
    });
    var E = elements(G, fixed);
    var V = {}, iters = 0, x = null, idx, unknown, nd;

    while (iters++ < 10) {
      unknown = [];
      idx = {};
      function touch(n) { if (fixed[n.id] == null && idx[n.id] == null) { idx[n.id] = unknown.length; unknown.push(n.id); } }
      E.R.forEach(function (e) { touch(e.a); touch(e.b); });
      var act = E.D.filter(function (d) { return d.on && !(fixed[d.a.id] != null && fixed[d.k.id] != null); });
      act.forEach(function (d) { touch(d.a); touch(d.k); });
      nd = unknown.length;
      var n = nd + act.length;
      if (!n) break;
      var A = [], b = [];
      for (var i = 0; i < n; i++) { A.push(new Array(n).fill(0)); b.push(0); }
      for (i = 0; i < nd; i++) A[i][i] += 1e-12; // gmin לצמתים צפים
      E.R.forEach(function (e) {
        var g = 1 / e.r, ia = idx[e.a.id], ib = idx[e.b.id];
        if (ia != null) { A[ia][ia] += g; if (ib != null) A[ia][ib] -= g; else b[ia] += g * fixed[e.b.id]; }
        if (ib != null) { A[ib][ib] += g; if (ia != null) A[ib][ia] -= g; else b[ib] += g * fixed[e.a.id]; }
      });
      act.forEach(function (d, j) {
        var r = nd + j, ia = idx[d.a.id], ik = idx[d.k.id];
        if (ia != null) { A[ia][r] += 1; A[r][ia] += 1; }
        if (ik != null) { A[ik][r] -= 1; A[r][ik] -= 1; }
        b[r] = d.vf - (ia == null ? fixed[d.a.id] : 0) + (ik == null ? fixed[d.k.id] : 0);
      });
      x = gauss(A, b);
      if (!x) break;
      var flipped = false;
      act.forEach(function (d, j) { d.i = x[nd + j]; if (d.i < -1e-9) { d.on = false; flipped = true; } });
      if (!flipped) break;
    }

    // צמתים שאין להם מסלול לצומת קבוע — המתח לא מוגדר
    var adj = {};
    function link(p, q) { (adj[p] = adj[p] || []).push(q); (adj[q] = adj[q] || []).push(p); }
    E.R.forEach(function (e) { link(e.a.id, e.b.id); });
    // דיודה מגדירה את המתח בצד השני רק כשעובר בה זרם (אחרת היא "מחזיקה" צומת צף במפל שלה)
    E.D.forEach(function (d) { if (d.on && d.i > 1e-7) link(d.a.id, d.k.id); });
    var reach = {}, queue = Object.keys(fixed);
    queue.forEach(function (id) { reach[id] = true; });
    while (queue.length) { var q = queue.shift(); (adj[q] || []).forEach(function (m) { if (!reach[m]) { reach[m] = true; queue.push(m); } }); }

    Object.keys(G.nets).forEach(function (id) {
      if (fixed[id] != null) V[id] = fixed[id];
      else if (x && idx && idx[id] != null && reach[id]) V[id] = x[idx[id]];
      else V[id] = null;
    });
    function volt(n) { return n ? V[n.id] : null; }

    var res = E.R.map(function (e) {
      var va = volt(e.a), vb = volt(e.b);
      var i = va != null && vb != null ? (va - vb) / e.r : null;
      return { id: e.c.id, c: e.c, a: e.a, b: e.b, r: e.r, i: i, p: i != null ? i * i * e.r : null, coil: !!e.coil, part: !!e.part };
    });
    var dio = E.D.map(function (d) {
      var i = d.on && d.i != null ? d.i : 0;
      if (fixed[d.a.id] != null && fixed[d.k.id] != null) i = null; // מחובר ישירות בין שני מתחים
      return { id: d.c.id, c: d.c, a: d.a, k: d.k, vf: d.vf, on: d.on && i > 1e-7, i: i, led: d.c.type === 'led' };
    });

    // זרם מכל מקור חיובי אל הנגדים והדיודות, ועוד הערכה לרכיבים פעילים
    var supply = {};
    res.forEach(function (r) {
      if (r.i == null) return;
      if (fixed[r.a.id] > 0) supply[r.a.id] = (supply[r.a.id] || 0) + r.i;
      if (fixed[r.b.id] > 0) supply[r.b.id] = (supply[r.b.id] || 0) - r.i;
    });
    dio.forEach(function (d) { if (d.i && fixed[d.a.id] > 0) supply[d.a.id] = (supply[d.a.id] || 0) + d.i; });
    var active = [];
    G.comps.forEach(function (c) {
      if (['mcu', 'ic', 'regulator'].indexOf(c.type) < 0) return;
      var hit = TYPICAL_mA.filter(function (t) { return t[0].test((c.value || '') + ' ' + (c.label || '')); })[0];
      if (hit) active.push({ id: c.id, mA: hit[1], why: hit[2] });
    });
    var passive = 0;
    Object.keys(supply).forEach(function (id) { if (supply[id] > 0) passive += supply[id]; });
    var total = passive + active.reduce(function (s, a) { return s + a.mA / 1000; }, 0);

    return { G: G, V: V, fixed: fixed, resistors: res, diodes: dio, active: active, currentA: total, volt: volt, voltAt: function (key) { return volt(G.net(key)); } };
  }

  // התנגדות בין שני צמתים כשהכרטיס לא מוזן (רק נגדים, נתיכים וסלילים; מוליכים למחצה לא מוליכים במצב אוהם)
  function rth(G, na, nb) {
    if (!na || !nb) return null;
    if (na === nb) return 0;
    var E = elements(G, {});
    var ids = {}, list = [];
    E.R.forEach(function (e) { [e.a.id, e.b.id].forEach(function (id) { if (id !== nb.id && ids[id] == null) { ids[id] = list.length; list.push(id); } }); });
    if (ids[na.id] == null) return Infinity;
    var n = list.length, A = [], b = [];
    for (var i = 0; i < n; i++) { A.push(new Array(n).fill(0)); b.push(0); A[i][i] = 1e-12; }
    E.R.forEach(function (e) {
      var g = 1 / e.r, ia = ids[e.a.id], ib = ids[e.b.id];
      if (ia != null) { A[ia][ia] += g; if (ib != null) A[ia][ib] -= g; }
      if (ib != null) { A[ib][ib] += g; if (ia != null) A[ib][ia] -= g; }
    });
    b[ids[na.id]] = 1;
    var x = gauss(A, b);
    if (!x) return Infinity;
    var r = x[ids[na.id]];
    return r > 1e9 ? Infinity : r;
  }

  /* ---------- עיצוב מספרים ---------- */

  function fmt(v, unit, digits) {
    if (v == null || !isFinite(v)) return v === Infinity ? '∞' : '—';
    var a = Math.abs(v), p = '';
    if (a >= 1e6) { v /= 1e6; p = 'M'; } else if (a >= 1e3) { v /= 1e3; p = 'k'; }
    else if (a > 0 && a < 1e-3) { v *= 1e6; p = 'µ'; } else if (a > 0 && a < 1) { v *= 1e3; p = 'm'; }
    var d = digits == null ? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) : digits;
    return (+v.toFixed(d)) + ' ' + p + unit;
  }

  function range(v, tol, unit) { return { min: v * (1 - tol), max: v * (1 + tol), unit: unit, text: fmt(v, unit) + ' ±' + Math.round(tol * 100) + '%' }; }

  /* ---------- ערכות ---------- */

  function kits(sch) {
    var S = solve(sch), G = S.G;
    var gnd = Object.keys(G.nets).map(function (id) { return G.nets[id]; }).filter(function (n) { return S.fixed[n.id] === 0 && n.terms.length > 0; })[0];
    var gRef = gnd ? label(G, gnd) : null;
    var rails = Object.keys(S.fixed).filter(function (id) { return S.fixed[id] > 0; }).map(function (id) { return G.nets[id]; })
      .sort(function (a, b) { return S.fixed[b.id] - S.fixed[a.id]; });
    var byType = function (types) { return G.comps.filter(function (c) { return types.indexOf(c.type) >= 0; }); };
    function probe(red, black) { return 'חוד אדום ' + red + (black ? ' · חוד שחור ' + black : ''); }
    var out = [];

    // 1. בדיקה חזותית
    var vis = [];
    byType(['capacitor']).forEach(function (c) {
      var m = G.key(c, /^-$/);
      if (m) vis.push({ title: 'כיוון הקבל ' + c.id + ' (' + (c.value || '') + ')', where: 'פס ה-(−) על הגוף לכיוון ' + label(G, G.net(m)), instrument: 'עין / זכוכית מגדלת', expect: { check: true, text: 'הקוטביות תואמת לסימון בכרטיס' } });
    });
    byType(['led', 'diode']).forEach(function (c) {
      var k = G.key(c, /^(K|C|-|CATHODE)$/i);
      if (k) vis.push({ title: 'כיוון ' + (c.type === 'led' ? 'הנורית ' : 'הדיודה ') + c.id, where: (c.type === 'led' ? 'הרגל הקצרה / הצד השטוח' : 'הפס על הגוף') + ' (קתודה) לכיוון ' + label(G, G.net(k)), instrument: 'עין / בודק דיודות', expect: { check: true, text: 'הקתודה בצד הנכון' } });
    });
    byType(['ic', 'mcu', 'regulator']).forEach(function (c) {
      vis.push({ title: 'כיוון ' + c.id + ' (' + (c.value || c.label) + ')', where: 'סימון פין 1 (נקודה / חריץ) תואם להדפסה בכרטיס', instrument: 'עין / זכוכית מגדלת', expect: { check: true, text: 'פין 1 במקום' } });
    });
    vis.push({ title: 'גשרי הלחמה ופינים צפופים', where: 'בין פינים סמוכים של כל רכיב משולב ומחבר', instrument: 'זכוכית מגדלת / מיקרוסקופ', expect: { check: true, text: 'אין גשרים ואין שאריות' } });
    vis.push({ title: 'איכות ההלחמות', where: 'כל נקודות ההלחמה', instrument: 'עין', expect: { check: true, text: 'מבריקות וקעורות, בלי הלחמות קרות' } });
    out.push({ id: 'visual', name: 'בדיקה חזותית', icon: 'eye', desc: 'לפני כל מדידה: כיוון רכיבים עם קוטביות, פין 1 של רכיבים משולבים, וגשרי הלחמה.', steps: vis });

    // 2. ללא מתח: התנגדויות ורציפות
    var off = [];
    if (gnd) {
      rails.forEach(function (n) {
        var r = rth(G, n, gnd), lbl = label(G, n);
        off.push({ title: 'אין קצר בין ' + lbl + ' (' + fmt(S.fixed[n.id], 'V') + ') ל-GND', where: probe(lbl, gRef), instrument: 'מולטימטר · Ω',
          expect: { min: 100, unit: 'Ω', text: 'מעל 100Ω' + (isFinite(r) ? ' (לפי הנגדים כ-' + fmt(r, 'Ω') + ')' : ' — גבוה, עולה לאט בגלל הקבלים') }, note: 'פחות מ-10Ω פירושו קצר. אל תזינו את הכרטיס לפני שמוצאים אותו.' });
      });
      gnd.terms.filter(function (k) { return k !== gRef && ['ic', 'mcu', 'regulator', 'connector', 'source'].indexOf(G.terms[k].c.type) >= 0; }).slice(0, 6).forEach(function (k) {
        off.push({ title: 'רציפות GND אל ' + k, where: probe(gRef, k), instrument: 'מולטימטר · רציפות', expect: { max: 1, unit: 'Ω', text: 'פחות מ-1Ω (צפצוף)' } });
      });
    }
    rails.forEach(function (n) {
      var src = label(G, n);
      n.terms.filter(function (k) { return k !== src && ['ic', 'mcu'].indexOf(G.terms[k].c.type) >= 0; }).slice(0, 4).forEach(function (k) {
        off.push({ title: 'רציפות הזנה אל ' + k, where: probe(src, k), instrument: 'מולטימטר · רציפות', expect: { max: 1, unit: 'Ω', text: 'פחות מ-1Ω' } });
      });
    });
    S.resistors.filter(function (r) { return !r.coil && !r.part; }).slice(0, 10).forEach(function (r) {
      var ks = (r.c.terminals || []).map(function (t) { return r.c.id + '.' + t.id; });
      var inCirc = rth(G, r.a, r.b);
      off.push({ title: 'נגד ' + r.id + ' (' + r.c.value + ')', where: probe(ks[0], ks[1]), instrument: 'מולטימטר · Ω',
        expect: { min: Math.min(r.r, inCirc) * 0.9, max: r.r * 1.06, unit: 'Ω', text: fmt(Math.min(r.r, inCirc), 'Ω') + (inCirc < r.r * 0.95 ? ' במעגל (הנגד לבד ' + fmt(r.r, 'Ω') + ')' : ' ±5%') } });
    });
    S.resistors.filter(function (r) { return r.coil; }).forEach(function (r) {
      var ks = [G.key(r.c, /^(A1|COIL1|COIL\+)$/i), G.key(r.c, /^(A2|COIL2|COIL-)$/i)];
      off.push({ title: 'סליל ' + r.id + ' (' + r.c.value + ')', where: probe(ks[0], ks[1]), instrument: 'מולטימטר · Ω', expect: { min: r.r * 0.75, max: r.r * 1.3, unit: 'Ω', text: 'כ-' + fmt(r.r, 'Ω') }, note: 'אינסוף = סליל קרוע. אפס = קצר בסליל או בדיודה.' });
    });
    byType(['diode', 'led']).forEach(function (c) {
      var a = G.key(c, /^(A|\+|ANODE)$/i), k = G.key(c, /^(K|C|-|CATHODE)$/i);
      if (!a || !k) return;
      var led = c.type === 'led', vf = led ? ledVf(c) : diodeVf(c);
      off.push({ title: 'מפל קדמי ' + c.id + (led ? ' (הנורית עשויה להאיר חלש)' : ''), where: probe(a, k), instrument: 'מולטימטר · בדיקת דיודה',
        expect: led ? { min: 1.5, max: 3.4, unit: 'V', text: '1.5–3.4V (צפוי כ-' + vf + 'V)' } : { min: vf * 0.5, max: vf * 1.4, unit: 'V', text: 'כ-' + vf + 'V; בכיוון ההפוך OL' } });
    });
    byType(['fuse']).forEach(function (c) {
      var ks = (c.terminals || []).map(function (t) { return c.id + '.' + t.id; });
      off.push({ title: 'נתיך ' + c.id + ' (' + c.value + ')', where: probe(ks[0], ks[1]), instrument: 'מולטימטר · רציפות', expect: { max: 1, unit: 'Ω', text: 'פחות מ-1Ω' } });
    });
    out.push({ id: 'unpowered', name: 'ללא מתח: קצרים ורציפות', icon: 'ohm', desc: 'הכרטיס מנותק מכל הזנה. קודם שוללים קצר בין קווי ההזנה ל-GND, ואז בודקים רציפות, נגדים, סלילים ודיודות.', steps: off });

    // 3. הדלקה ראשונה
    var on = [];
    var main = rails.filter(function (n) { return n.terms.some(function (k) { return G.terms[k].c.type === 'source' || G.terms[k].c.type === 'connector'; }); })[0] || rails[0];
    var mA = S.currentA * 1000;
    if (main) {
      var lim = Math.max(50, Math.ceil(mA * 2 / 10) * 10);
      on.push({ title: 'הכנת ספק מעבדה', where: 'מתח ' + fmt(S.fixed[main.id], 'V') + ' אל ' + label(G, main) + ', הגבלת זרם ' + lim + 'mA', instrument: 'ספק מעבדה עם הגבלת זרם', expect: { check: true, text: 'הספק מכוון לפני החיבור' }, note: 'מחברים, ומנתקים מיד אם הספק נכנס להגבלת זרם.' });
      on.push({ title: 'זרם צריכה במנוחה', where: 'תצוגת הספק או מד זרם בטור לקו ' + label(G, main), instrument: 'ספק / מולטימטר · mA',
        expect: { min: 0, max: (mA * 1.6 + 10) / 1000, unit: 'A', text: 'עד כ-' + Math.round(mA * 1.6 + 10) + 'mA (הערכה: ' + Math.round(mA) + 'mA)' },
        note: S.active.length ? 'ההערכה כוללת: ' + S.active.map(function (a) { return a.id + ' ' + a.why + ' ~' + a.mA + 'mA'; }).join(', ') : '' });
    }
    rails.forEach(function (n) {
      var v = S.fixed[n.id], lbl = label(G, n), reg = n.terms.some(function (k) { return G.terms[k].c.type === 'regulator'; });
      on.push({ title: 'מתח ' + fmt(v, 'V') + ' בנקודה ' + lbl, where: probe(lbl, gRef), instrument: 'מולטימטר · VDC', expect: range(v, reg ? 0.05 : 0.1, 'V') });
    });
    byType(['ic', 'mcu']).forEach(function (c) {
      var vcc = G.key(c, /^(VCC|VDD|3V3|3\.3V|5V|VIN|V\+|VS)$/i), g = G.key(c, /^(GND|VSS|0V)$/i);
      var v = S.voltAt(vcc);
      if (vcc && g && v) on.push({ title: 'הזנה על הרכיב ' + c.id, where: probe(vcc, g), instrument: 'מולטימטר · VDC', expect: range(v, 0.05, 'V'), note: 'מודדים על הפינים עצמם, לא על המחבר.' });
    });
    S.diodes.filter(function (d) { return d.led && d.on && d.i > 1e-4; }).forEach(function (d) {
      var r = S.resistors.filter(function (x) { return !x.coil && x.i != null && Math.abs(Math.abs(x.i) - d.i) < d.i * 0.02 && (x.a === d.a || x.b === d.a || x.a === d.k || x.b === d.k); })[0];
      if (!r) return;
      var ks = (r.c.terminals || []).map(function (t) { return r.c.id + '.' + t.id; });
      on.push({ title: 'זרם הנורית ' + d.id + ' (' + fmt(d.i, 'A') + ')', where: 'מתח על הנגד ' + r.id + ': ' + probe(ks[0], ks[1]), instrument: 'מולטימטר · VDC', expect: range(Math.abs(r.i) * r.r, 0.1, 'V'), note: 'I = V / ' + fmt(r.r, 'Ω') + '. על הנגד ' + fmt(r.p, 'W') + '.' });
    });
    var shown = {};
    rails.forEach(function (n) { shown[n.id] = 1; });
    if (gnd) shown[gnd.id] = 1;
    Object.keys(G.nets).forEach(function (id) {
      var v = S.V[id];
      if (shown[id] || v == null || v < 0.05 || on.length > 30) return;
      var n = G.nets[id];
      if (n.terms.length < 2) return;
      var lbl = label(G, n);
      on.push({ title: 'מתח בצומת ' + lbl, where: probe(lbl, gRef), instrument: 'מולטימטר · VDC', expect: range(v, 0.07, 'V'), note: n.terms.slice(0, 5).join(', ') });
    });
    byType(['regulator']).forEach(function (c) {
      var vi = S.voltAt(G.key(c, /^(IN|VIN|VI)$/i)), vo = S.voltAt(G.key(c, /^(OUT|VOUT|VO)$/i));
      if (vi == null || vo == null) return;
      var pd = (vi - vo) * S.currentA;
      on.push({ title: 'חום ברגולטור ' + c.id + ' אחרי 5 דקות', where: 'מגע על הגוף או מדחום IR', instrument: 'מדחום IR', expect: { max: pd > 0.6 ? 80 : 60, unit: '°C', text: 'עד ' + (pd > 0.6 ? 80 : 60) + '°C (פיזור צפוי ' + fmt(pd, 'W') + ')' }, note: pd > 0.8 ? 'פיזור גבוה: צריך משטח נחושת גדול או גוף קירור.' : '' });
    });
    out.push({ id: 'power', name: 'הדלקה ראשונה', icon: 'bolt', desc: 'מזינים מספק מעבדה עם הגבלת זרם. בודקים זרם צריכה, כל מתחי ההזנה, והמתחים בצמתים שהפותר חישב.', steps: on });

    // 4. בדיקה פונקציונלית
    var fn = [];
    byType(['mcu']).forEach(function (c) {
      var en = G.key(c, /^(EN|RST|RESET|CHIP_PU)$/i), io0 = G.key(c, /^(IO0|GPIO0|BOOT)$/i);
      [en, io0].forEach(function (k) {
        if (!k) return;
        var v = S.voltAt(k);
        if (v) fn.push({ title: 'מצב מנוחה של ' + k, where: probe(k, gRef), instrument: 'מולטימטר · VDC', expect: range(v, 0.07, 'V'), note: 'בלחיצה על הלחצן המחובר ל-' + k + ' המתח יורד לכ-0V.' });
      });
    });
    byType(['ic']).filter(function (c) { return /555/.test(c.value || ''); }).forEach(function (c) {
      var vcc = G.net(G.key(c, /^VCC$/i)), dis = G.net(G.key(c, /^DIS$/i)), thr = G.net(G.key(c, /^THR$/i)), out5 = G.key(c, /^OUT$/i);
      var R1 = S.resistors.filter(function (r) { return (r.a === vcc && r.b === dis) || (r.b === vcc && r.a === dis); })[0];
      var R2 = S.resistors.filter(function (r) { return (r.a === dis && r.b === thr) || (r.b === dis && r.a === thr); })[0];
      var C = G.comps.filter(function (x) { return x.type === 'capacitor' && (x.terminals || []).some(function (t) { return G.net(x.id + '.' + t.id) === thr; }) && (x.terminals || []).some(function (t) { return S.fixed[(G.net(x.id + '.' + t.id) || {}).id] === 0; }); })[0];
      var cap = C && capacitance(C.value);
      if (R1 && R2 && cap) {
        var f = 1.44 / ((R1.r + 2 * R2.r) * cap), duty = (R1.r + R2.r) / (R1.r + 2 * R2.r);
        fn.push({ title: 'תדר היציאה של ' + c.id, where: probe(out5, gRef), instrument: 'אוסצילוסקופ / מונה תדר', expect: range(f, 0.2, 'Hz'), note: 'מחזור עבודה צפוי ' + Math.round(duty * 100) + '%. סבולת קבל אלקטרוליטי גדולה, לכן ±20%.' });
      }
    });
    byType(['crystal']).forEach(function (c) {
      var f = frequency(c.value), k = (c.terminals || [])[0];
      if (f) fn.push({ title: 'תנודת הגביש ' + c.id, where: 'פין ' + c.id + '.' + (k ? k.id : '1') + ' עם פרוב ×10', instrument: 'אוסצילוסקופ', expect: range(f, 0.001, 'Hz'), note: 'פרוב ×1 יעמיס את המתנד ויכול לעצור אותו.' });
    });
    byType(['relay']).forEach(function (c) {
      var a2 = G.net(G.key(c, /^(A2|COIL2|COIL-)$/i));
      var q = a2 && a2.terms.map(function (k) { return G.terms[k].c; }).filter(function (x) { return x.type === 'transistor'; })[0];
      var vr = S.voltAt(G.key(c, /^(A1|COIL1|COIL\+)$/i));
      if (!q) return;
      var base = G.net(G.key(q, /^(B|G)$/i)), drive = null;
      S.resistors.forEach(function (r) {
        var other = r.a === base ? r.b : r.b === base ? r.a : null;
        if (other && S.fixed[other.id] == null) drive = label(G, other);
      });
      fn.push({ title: 'הפעלת ' + c.id + ' דרך ' + q.id, where: 'הזינו 3.3V בין ' + (drive || q.id + '.B') + ' ל-GND', instrument: 'ספק / יציאת הבקר', expect: { check: true, text: 'נקישה של הממסר' } });
      fn.push({ title: 'מתח רוויה של ' + q.id + ' כשהממסר מופעל', where: probe(G.key(q, /^(C|D)$/i), G.key(q, /^(E|S)$/i)), instrument: 'מולטימטר · VDC', expect: { max: 0.35, unit: 'V', text: 'פחות מ-0.35V' }, note: 'ערך גבוה יותר: זרם בסיס נמוך מדי. הקטינו את נגד הבסיס.' });
      if (vr) fn.push({ title: 'מתח על סליל ' + c.id + ' כשהוא מופעל', where: probe(G.key(c, /^(A1|COIL1|COIL\+)$/i), G.key(c, /^(A2|COIL2|COIL-)$/i)), instrument: 'מולטימטר · VDC', expect: { min: vr * 0.9, max: vr * 1.02, unit: 'V', text: 'כ-' + fmt(vr - 0.2, 'V') } });
      fn.push({ title: 'קוץ מתח בניתוק ' + c.id, where: probe(G.key(q, /^(C|D)$/i), gRef), instrument: 'אוסצילוסקופ', expect: { max: (vr || 5) + 1.2, unit: 'V', text: 'עד ' + fmt((vr || 5) + 1, 'V') + ' (הדיודה קוטמת)' }, note: 'קוץ גבוה = דיודת הגלגול החופשי חסרה או לא מחוברת.' });
    });
    byType(['ic']).filter(function (c) { return /817|PC8|opto|אופטו|4N3/i.test((c.value || '') + (c.label || '')); }).forEach(function (c) {
      var col = G.key(c, /^C$/i), vIdle = S.voltAt(col);
      fn.push({ title: 'יציאת ' + c.id + ' בלי אות בכניסה', where: probe(col, G.key(c, /^E$/i)), instrument: 'מולטימטר · VDC', expect: vIdle ? range(vIdle, 0.07, 'V') : { check: true, text: 'גבוה (מתח המשיכה)' } });
      fn.push({ title: 'יציאת ' + c.id + ' עם אות בכניסה', where: 'הזינו את מתח הכניסה המלא, ' + probe(col, G.key(c, /^E$/i)), instrument: 'מולטימטר · VDC', expect: { max: 0.4, unit: 'V', text: 'פחות מ-0.4V' } });
    });
    byType(['button']).forEach(function (c) {
      var ks = (c.terminals || []).map(function (t) { return c.id + '.' + t.id; });
      var sig = ks.filter(function (k) { var v = S.voltAt(k); return v != null && S.fixed[G.net(k).id] == null; })[0];
      if (sig) fn.push({ title: 'לחיצה על ' + c.id + (c.label ? ' (' + c.label + ')' : ''), where: probe(sig, gRef) + ' — לחוץ', instrument: 'מולטימטר · VDC', expect: { max: 0.2, unit: 'V', text: 'כ-0V בלחיצה; ' + fmt(S.voltAt(sig), 'V') + ' במנוחה' } });
    });
    if (!fn.length) fn.push({ title: 'בדיקת תפקוד כללית', where: 'לפי מה שהכרטיס אמור לעשות', instrument: 'לפי הצורך', expect: { check: true, text: 'הכרטיס מתפקד' } });
    out.push({ id: 'function', name: 'בדיקה פונקציונלית', icon: 'wave', desc: 'אותות ותפקוד: מצבי איפוס, תדרי מתנדים, הפעלת ממסרים ואופטוקפלרים, לחצנים.', steps: fn });

    // 5. בטיחות ובידוד
    var saf = [];
    var iso = Object.keys(G.nets).some(function (id) { return G.nets[id].terms.some(function (k) { return /0VF|0V2|ISO/i.test(G.terms[k].t.potential || ''); }); }) ||
      byType(['ic']).some(function (c) { return /817|PC8|4N3|opto/i.test(c.value || ''); });
    var mains = Object.keys(G.nets).some(function (id) { return G.nets[id].terms.some(function (k) { return /^(L|L1|L2|L3|N)$/.test(Netlist.normPotential(G.terms[k].t.potential)); }); });
    if (iso) saf.push({ title: 'בידוד בין צד הכניסה לצד הבקר', where: 'כל הדקי הכניסה מקוצרים יחד מול כל הדקי הצד השני מקוצרים יחד', instrument: 'מגר 500VDC', expect: { min: 1e8, unit: 'Ω', text: 'מעל 100MΩ' }, note: 'מנתקים את הכרטיס מכל ציוד אחר לפני בדיקת מגר.' });
    byType(['relay']).forEach(function (c) {
      saf.push({ title: 'בידוד סליל ' + c.id + ' מול המגעים', where: probe(G.key(c, /^A1$/i), G.key(c, /^COM$/i)), instrument: 'מגר 500VDC', expect: { min: 1e8, unit: 'Ω', text: 'מעל 100MΩ' } });
      saf.push({ title: 'מרווח בכרטיס סביב מגעי ' + c.id, where: 'בין מסלולי המגעים לבין מסלולי המתח הנמוך', instrument: 'קליבר', expect: { min: 6, unit: 'mm', text: '6mm לפחות למתח רשת (או חריץ בידוד)' } });
    });
    if (mains) saf.push({ title: 'רציפות הארקה', where: 'מהדק ה-PE לכל חלק מתכתי נגיש', instrument: 'בודק רציפות 200mA', expect: { max: 0.1, unit: 'Ω', text: 'פחות מ-0.1Ω' } });
    if (!saf.length) saf.push({ title: 'אין צד מבודד ואין מתח רשת בכרטיס', where: '—', instrument: '—', expect: { check: true, text: 'לא נדרשת בדיקת בידוד' } });
    out.push({ id: 'safety', name: 'בטיחות ובידוד', icon: 'shield', desc: 'לכרטיסים עם צד מבודד, ממסרים שמחליפים מתח רשת, או חיבור לרשת.', steps: saf });

    out.forEach(function (k) { k.steps.forEach(function (s, i) { s.key = k.id + ':' + i + ':' + s.title; }); });
    return { kits: out, solution: S };
  }

  /* ---------- השוואת מדידה ---------- */

  function parseMeasure(text) {
    var s = String(text || '').trim().replace(',', '.');
    if (!s) return null;
    if (/^(OL|∞|inf|אינסוף|פתוח)/i.test(s)) return Infinity;
    var m = s.match(/^(-?\d+(?:\.\d+)?)\s*([pnuµmkKMG])?/);
    if (!m) return null;
    var p = m[2];
    // "m" אחרי מספר ביחידות Ω בדרך כלל מתכוון למגה רק כשכתוב M; כאן m = מילי
    return parseFloat(m[1]) * (p ? PREFIX[p] : 1);
  }

  function evaluate(step, text) {
    var e = step.expect || {};
    if (e.check) return text === 'ok' ? 'pass' : text === 'fail' ? 'fail' : null;
    var v = parseMeasure(text);
    if (v == null) return null;
    if (e.min != null && v < e.min) return 'fail';
    if (e.max != null && v > e.max) return 'fail';
    return 'pass';
  }

  return { solve: solve, kits: kits, rth: rth, evaluate: evaluate, parseMeasure: parseMeasure, fmt: fmt, resistance: resistance, capacitance: capacitance };
});
