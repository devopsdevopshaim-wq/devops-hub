/* מעגל סגור — בודק חיווט אוטומטי ומשרטט סכימות.
   הסכימה היא רשימת רכיבים (עם הדקים) ורשימת חוטים בין הדקים.
   check()  — מאחד הדקים לצמתים חשמליים ומחפש קצרים, הארקה חסרה, צבעים שגויים והפניות שבורות.
   render() — מחזיר SVG של הסכימה (חוטים אורתוגונליים בצבע המוליך).
   קובץ משותף: נטען בדפדפן (window.Netlist) ובשרת (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Netlist = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- פוטנציאלים ---------- */

  function normPotential(p) {
    var s = String(p || '').trim().toUpperCase().replace(/\s+/g, '').replace(/VDC$|VAC$/, 'V');
    if (!s) return '';
    if (/^(L|P|PH|LINE|פאזה)$/.test(s)) return 'L';
    if (/^L[123]$/.test(s)) return s;
    if (/^(N|NEUTRAL|אפס)$/.test(s)) return 'N';
    if (/^(PE|E|EARTH|GROUND|הארקה)$/.test(s)) return 'PE';
    if (s === 'PEN') return 'PEN';
    if (/^(0V|0|GND|COM-|M|-|V-|VSS|DGND|AGND|0VDC)$/.test(s)) return '0V';
    var m = s.match(/^\+?(\d+(?:\.\d+)?)V?$/);
    if (m) return '+' + m[1] + 'V';
    if (/^(\+V|V\+|VCC|VDD|\+)$/.test(s)) return '+V';
    return s;
  }

  function kind(p) {
    if (p === 'L' || /^L[123]$/.test(p)) return 'line';
    if (p === 'N') return 'neutral';
    if (p === 'PE') return 'earth';
    if (p === 'PEN') return 'pen';
    if (p === '0V') return 'dc0';
    if (/^\+/.test(p)) return 'dcplus';
    return 'other';
  }

  /* ---------- צבעי מוליכים ---------- */

  var COLORS = [
    [/ירוק.?צהוב|צהוב.?ירוק|green.?yellow|gn.?ye|ye.?gn|pe/i, '#2f9e44', '#f2c500'],
    [/כחול.?כהה|dark.?blue|navy/i, '#1b2f8a'],
    [/כחול.?בהיר|light.?blue/i, '#4dabf7'],
    [/חום|brown|\bbn\b/i, '#8a4b1f'],
    [/שחור|black|\bbk\b/i, '#1d1d1f'],
    [/אפור|grey|gray|\bgy\b/i, '#8a8f98'],
    [/כחול|blue|\bbu\b/i, '#1c6fe0'],
    [/אדום|red|\brd\b/i, '#d9362b'],
    [/לבן|white|\bwh\b/i, '#c9ccd1'],
    [/כתום|orange|\bog\b/i, '#f08c00'],
    [/סגול|violet|purple/i, '#8a3ffc'],
    [/ורוד|pink/i, '#e64980'],
    [/ירוק|green/i, '#2f9e44'],
    [/צהוב|yellow/i, '#e0b400']
  ];

  function wireColor(name) {
    var s = String(name || '');
    for (var i = 0; i < COLORS.length; i++) {
      if (COLORS[i][0].test(s)) return { main: COLORS[i][1], stripe: COLORS[i][2] || null };
    }
    return { main: '#5c6370', stripe: null };
  }
  function isGreenYellow(name) { return /ירוק.?צהוב|צהוב.?ירוק|green.?yellow|gn.?ye|ye.?gn/i.test(String(name || '')); }
  function isBlue(name) { return /כחול|blue|\bbu\b/i.test(String(name || '')) && !/כהה|dark|navy/i.test(String(name || '')); }

  /* ---------- מבנה ---------- */

  function splitRef(ref) {
    var s = String(ref || '').trim();
    var i = s.indexOf('.');
    if (i < 0) i = s.indexOf(':');
    if (i < 0) return { comp: s, term: '' };
    return { comp: s.slice(0, i).trim(), term: s.slice(i + 1).trim() };
  }

  function index(sch) {
    var comps = {}, terms = {};
    (sch.components || []).forEach(function (c) {
      comps[c.id] = c;
      (c.terminals || []).forEach(function (t) { terms[c.id + '.' + t.id] = { comp: c, term: t }; });
    });
    return { comps: comps, terms: terms };
  }

  function resolve(idx, ref) {
    var r = splitRef(ref);
    var key = r.comp + '.' + r.term;
    if (idx.terms[key]) return key;
    // התאמה בלי רגישות לאותיות גדולות/קטנות
    var lower = key.toLowerCase();
    for (var k in idx.terms) if (k.toLowerCase() === lower) return k;
    return null;
  }

  /* ---------- בדיקה ---------- */

  function check(sch) {
    var issues = [];
    function add(level, message, refs) { issues.push({ level: level, message: message, refs: refs || [] }); }
    if (!sch || !sch.needed) return { issues: issues, nets: [], stats: { components: 0, wires: 0, nets: 0 } };

    var comps = sch.components || [], wires = sch.wires || [];
    var seenComp = {};
    comps.forEach(function (c) {
      if (seenComp[c.id]) add('error', 'הרכיב ' + c.id + ' מופיע פעמיים בסכימה.', [c.id]);
      seenComp[c.id] = true;
      var seenT = {};
      (c.terminals || []).forEach(function (t) {
        if (seenT[t.id]) add('warning', 'להדק ' + c.id + '.' + t.id + ' יש שתי הגדרות.', [c.id + '.' + t.id]);
        seenT[t.id] = true;
      });
    });

    var idx = index(sch);
    var parent = {};
    Object.keys(idx.terms).forEach(function (k) { parent[k] = k; });
    function find(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }

    var degree = {}, pairSeen = {}, good = [];
    wires.forEach(function (w, i) {
      var a = resolve(idx, w.from), b = resolve(idx, w.to);
      var name = 'חוט ' + (w.label || (i + 1)) + ' (' + w.from + ' ← → ' + w.to + ')';
      if (!a) add('error', name + ': ההדק ' + w.from + ' לא קיים באף רכיב.', [w.from]);
      if (!b) add('error', name + ': ההדק ' + w.to + ' לא קיים באף רכיב.', [w.to]);
      if (!a || !b) return;
      if (a === b) { add('warning', name + ': החוט מחובר מהדק לעצמו.', [a]); return; }
      var pk = a < b ? a + '|' + b : b + '|' + a;
      if (pairSeen[pk]) add('warning', name + ': חוט כפול בין אותם שני הדקים.', [a, b]);
      pairSeen[pk] = true;
      degree[a] = (degree[a] || 0) + 1;
      degree[b] = (degree[b] || 0) + 1;
      union(a, b);
      good.push({ wire: w, a: a, b: b });
    });

    // צמתים חשמליים
    var nets = {};
    Object.keys(idx.terms).forEach(function (k) {
      var r = find(k);
      (nets[r] = nets[r] || { terminals: [], potentials: {}, wires: [] }).terminals.push(k);
      var p = normPotential(idx.terms[k].term.potential);
      if (p) (nets[r].potentials[p] = nets[r].potentials[p] || []).push(k);
    });
    good.forEach(function (g) { nets[find(g.a)].wires.push(g.wire); });

    var netList = [];
    Object.keys(nets).forEach(function (r) {
      var n = nets[r];
      if (n.terminals.length < 2) return;
      var pots = Object.keys(n.potentials);
      var kinds = {};
      pots.forEach(function (p) { kinds[kind(p)] = true; });
      var name = pots.join('/') || '';
      netList.push({ name: name, terminals: n.terminals, wires: n.wires.length });
      if (pots.length > 1) {
        var desc = pots.map(function (p) { return p + ' (' + n.potentials[p].join(', ') + ')'; }).join(' עם ');
        if (kinds.pen && (kinds.neutral || kinds.earth) && pots.length === 2 && !kinds.line) {
          add('warning', 'חיבור PEN: ' + desc + '. מותר רק במקום הפיצול המוגדר (TN-C-S). אחרי הפיצול אסור לחבר שוב N ו-PE.', n.terminals);
        } else if (kinds.earth && kinds.neutral && !kinds.line) {
          add('error', 'N ו-PE מחוברים יחד: ' + desc + '. זה יגרום להפלת ממסר הפחת ומסכן. יש להפריד.', n.terminals);
        } else if (kinds.earth && kinds.dc0 && pots.length === 2) {
          add('warning', 'ה-0V מוארק: ' + desc + '. תקין אם זו הארקת מערכת פיקוד מכוונת (PELV) בנקודה אחת בלבד.', n.terminals);
        } else if (pots.length === 2 && kinds.dcplus && !kinds.dc0 && !kinds.line && !kinds.neutral && !kinds.earth) {
          add('error', 'שני מתחי הזנה שונים מחוברים יחד: ' + desc + '. רכיב יקבל מתח שגוי, או שיהיה קצר בין הספקים.', n.terminals);
        } else {
          add('error', 'קצר: פוטנציאלים שונים על אותו צומת — ' + desc + '.', n.terminals);
        }
      }

      // צבעי מוליכים
      n.wires.forEach(function (w) {
        var c = String(w.color || '');
        if (!c) return;
        if (kinds.earth && !kinds.line && !isGreenYellow(c)) {
          add('warning', 'מוליך הארקה ' + (w.label ? 'מס׳ ' + w.label + ' ' : '') + '(' + w.from + ' → ' + w.to + ') בצבע "' + c + '". מוליך הגנה חייב להיות ירוק-צהוב.', [w.from, w.to]);
        } else if (!kinds.earth && isGreenYellow(c)) {
          add('error', 'ירוק-צהוב משמש רק להארקה, אבל החוט ' + w.from + ' → ' + w.to + ' אינו בצומת הארקה.', [w.from, w.to]);
        } else if (kinds.neutral && !kinds.line && !kinds.earth && !isBlue(c)) {
          add('warning', 'מוליך אפס (' + w.from + ' → ' + w.to + ') בצבע "' + c + '". לפי IEC 60445 האפס כחול.', [w.from, w.to]);
        } else if (kinds.line && !kinds.neutral && isBlue(c)) {
          add('warning', 'מוליך פאזה (' + w.from + ' → ' + w.to + ') בצבע כחול — עלול להתבלבל עם אפס.', [w.from, w.to]);
        }
      });
    });

    // הדקים עם פוטנציאל שלא מחוברים לשום דבר
    Object.keys(idx.terms).forEach(function (k) {
      var t = idx.terms[k].term;
      if (!degree[k] && normPotential(t.potential)) {
        add('warning', 'ההדק ' + k + ' (' + (t.name || t.potential) + ') מסומן ' + t.potential + ' אבל לא מחובר.', [k]);
      }
    });

    // רכיבים בלי שום חיבור
    comps.forEach(function (c) {
      var any = (c.terminals || []).some(function (t) { return degree[c.id + '.' + t.id]; });
      if (!any) add('warning', 'הרכיב ' + c.id + ' (' + (c.label || c.type) + ') לא מחובר לשום דבר.', [c.id]);
    });

    // רכיבים שדורשים הארקה
    var needPE = { motor: 1, vfd: 1, psu: 1, socket: 1 };
    comps.forEach(function (c) {
      if (!needPE[c.type]) return;
      var hasPE = (c.terminals || []).some(function (t) { return /^(PE|PEN)$/.test(normPotential(t.potential)) || /^(PE|⏚|E|GND_PE)$/i.test(t.id); });
      var isAC = (c.terminals || []).some(function (t) { return kind(normPotential(t.potential)) === 'line' || /^(L|L1|L2|L3|U|V|W|U1|V1|W1)$/i.test(t.id); });
      if (isAC && !hasPE) add('warning', 'לרכיב ' + c.id + ' (' + (c.label || c.type) + ') אין הדק הארקה בסכימה. גוף מתכתי של ציוד מתח רשת חייב להיות מוארק.', [c.id]);
    });

    electronics(comps, degree, function (k) { return nets[find(k)]; }, add);

    var errors = issues.filter(function (i) { return i.level === 'error'; }).length;
    return {
      issues: issues,
      nets: netList,
      ok: errors === 0,
      stats: { components: comps.length, wires: wires.length, nets: netList.length, errors: errors, warnings: issues.length - errors }
    };
  }

  /* ---------- כללי אלקטרוניקה (כרטיסים) ---------- */

  function railsOf(net) { return net ? Object.keys(net.potentials) : []; }
  function plusV(net) {
    var v = null;
    railsOf(net).forEach(function (p) { if (kind(p) === 'dcplus') { var x = parseFloat(p.slice(1)); if (isFinite(x)) v = Math.max(v || 0, x); else v = v || 0; } });
    return v;
  }
  function isPlus(net) { return plusV(net) !== null; }
  function isGnd(net) { return railsOf(net).some(function (p) { return kind(p) === 'dc0'; }); }

  function electronics(comps, degree, netOf, add) {
    var byId = {};
    comps.forEach(function (c) { byId[c.id] = c; });
    function key(c, re) {
      var t = (c.terminals || []).filter(function (x) { return re.test(String(x.id)); })[0];
      return t ? c.id + '.' + t.id : null;
    }
    function net(k) { return k && degree[k] ? netOf(k) : null; }
    function typeIn(k) { return byId[k.split('.')[0]] ? byId[k.split('.')[0]].type : ''; }
    function name(c) { return c.id + (c.value ? ' (' + c.value + ')' : c.label ? ' (' + c.label + ')' : ''); }
    // האם יש רכיב מסוג מסוים שהדק אחד שלו בצומת a והדק אחר בצומת b
    function bridged(na, nb, types, cond) {
      return comps.some(function (c) {
        if (types.indexOf(c.type) < 0) return false;
        var keys = (c.terminals || []).map(function (t) { return c.id + '.' + t.id; });
        return keys.some(function (k1) {
          return keys.some(function (k2) {
            return k1 !== k2 && net(k1) === na && net(k2) === nb && (!cond || cond(c, k1, k2));
          });
        });
      });
    }
    var RE_A = /^(A|\+|ANODE)$/i, RE_K = /^(K|C|-|CATHODE)$/i;
    var RE_VCC = /^(VCC|VDD|3V3|3\.3V|5V|VIN|V\+|VBAT|VS)$/i, RE_GND = /^(GND|VSS|0V|V-|GND1)$/i;

    comps.forEach(function (c) {
      var isLed = c.type === 'led' || (c.type === 'diode' && /LED|נורית/i.test((c.label || '') + ' ' + (c.value || '')));
      if (isLed || c.type === 'diode') {
        var a = key(c, RE_A), k = key(c, RE_K), na = net(a), nk = net(k);
        if (na && nk && isPlus(na) && isGnd(nk)) {
          if (isLed) add('error', 'הנורית ' + name(c) + ' מחוברת ישירות בין ההזנה ל-GND בלי נגד טורי, ותישרף. הוסיפו נגד: R = (Vהזנה − Vנורית) / I, למשל 330Ω ל-5V ו-10mA.', [c.id]);
          else add('error', 'הדיודה ' + name(c) + ' מחוברת בכיוון ההולכה ישירות בין ההזנה ל-GND — זה קצר דרך הדיודה.', [c.id]);
        } else if (isLed && na && nk && isGnd(na) && isPlus(nk)) {
          add('warning', 'הנורית ' + name(c) + ' מחוברת הפוך (האנודה ל-GND) ולא תדלק.', [c.id]);
        }
      }
      if (c.type === 'capacitor') {
        var cp = key(c, /^\+$/), cm = key(c, /^-$/), np = net(cp), nm = net(cm);
        if (np && nm && isGnd(np) && isPlus(nm)) add('error', 'הקבל האלקטרוליטי ' + name(c) + ' מחובר הפוך (+ ל-GND). קבל הפוך מתחמם ועלול להתפוצץ.', [c.id]);
        var rating = String(c.value || '').match(/(\d+(?:\.\d+)?)\s*V\b/i);
        var rail = Math.max.apply(null, [0].concat((c.terminals || []).map(function (t) { return plusV(net(c.id + '.' + t.id)) || 0; })));
        if (rating && rail) {
          var r = parseFloat(rating[1]);
          if (r < rail) add('error', 'מתח העבודה של ' + name(c) + ' (' + r + 'V) נמוך ממתח ההזנה (' + rail + 'V).', [c.id]);
          else if (r < rail * 1.25) add('warning', 'מתח העבודה של ' + name(c) + ' קרוב מדי למתח ההזנה (' + rail + 'V). מקובל מרווח של 25% לפחות.', [c.id]);
        }
      }
      if (c.type === 'relay' || c.type === 'contactor') {
        var a1 = key(c, /^(A1|COIL1|COIL\+)$/i), a2 = key(c, /^(A2|COIL2|COIL-)$/i), n1 = net(a1), n2 = net(a2);
        if (n1 && n2 && (isPlus(n1) || isPlus(n2)) && !(isPlus(n1) && isGnd(n2)) && !(isPlus(n2) && isGnd(n1))) {
          // סליל DC שמופעל דרך מתג אלקטרוני — צריך דיודת גלגול חופשי במקביל
          var hasDiode = bridged(n1, n2, ['diode'], null);
          var reversed = bridged(n1, n2, ['diode'], function (d, k1) { return RE_A.test(k1.split('.')[1]) && isPlus(net(k1)); });
          if (reversed) add('error', 'דיודת הגלגול החופשי על הסליל של ' + name(c) + ' הפוכה: הקתודה צריכה להיות בצד ה-+ של הסליל. כך היא יוצרת קצר כשהמתג סוגר.', [c.id]);
          else if (!hasDiode) add('warning', 'אין דיודת גלגול חופשי (למשל 1N4007) במקביל לסליל של ' + name(c) + '. מתח ההשראה בניתוק יהרוס את הטרנזיסטור או את יציאת הבקר.', [c.id]);
        }
      }
      if (c.type === 'transistor') {
        var b = key(c, /^(B|BASE)$/i), nb = net(b);
        if (nb) {
          if (isPlus(nb) || isGnd(nb)) add('warning', 'הבסיס של ' + name(c) + ' מחובר ישירות לקו הזנה.', [c.id]);
          else if (!nb.terminals.some(function (k) {
            // נגד טורי: פין אחד בצומת הבסיס, והפין השני מחובר לאות (לא לקו הזנה ולא באוויר)
            if (typeIn(k) !== 'resistor') return false;
            var r = byId[k.split('.')[0]];
            return (r.terminals || []).some(function (t) {
              var o = r.id + '.' + t.id, no = net(o);
              return o !== k && no && no !== nb && !isPlus(no) && !isGnd(no);
            });
          })) add('warning', 'אין נגד בסיס ל-' + name(c) + '. בלי נגד (למשל 1kΩ) היציאה שמזינה את הבסיס תספק זרם גבוה מדי ועלולה להישרף.', [c.id]);
        }
      }
      if (c.type === 'ic' || c.type === 'mcu') {
        var vcc = key(c, RE_VCC), gnd = key(c, RE_GND);
        [vcc, gnd].forEach(function (k) { if (k && !degree[k]) add('error', 'פין ההזנה ' + k + ' לא מחובר — הרכיב לא יעבוד.', [k]); });
        var nv = net(vcc), ng = net(gnd);
        if (nv && ng && !bridged(nv, ng, ['capacitor'])) add('warning', 'אין קבל ניתוק (100nF) בין ' + vcc + ' ל-' + gnd + '. הניחו אותו צמוד לפין ההזנה.', [c.id]);
      }
      if (c.type === 'regulator') {
        var vi = key(c, /^(IN|VIN|VI)$/i), vo = key(c, /^(OUT|VOUT|VO)$/i), g = key(c, /^(GND|ADJ|COM|0V)$/i);
        var ni = net(vi), no = net(vo), nG = net(g);
        [vi, vo, g].forEach(function (k) { if (k && !degree[k]) add('error', 'ההדק ' + k + ' של הרגולטור לא מחובר.', [k]); });
        if (ni && nG && !bridged(ni, nG, ['capacitor'])) add('warning', 'חסר קבל כניסה בין IN ל-GND של ' + name(c) + '.', [c.id]);
        if (no && nG && !bridged(no, nG, ['capacitor'])) add('warning', 'חסר קבל יציאה בין OUT ל-GND של ' + name(c) + '. ברגולטור LDO הוא נדרש ליציבות (ראו דף הנתונים).', [c.id]);
        var vin = plusV(ni), vout = plusV(no);
        if (vin !== null && vout !== null && vin && vout && vin <= vout) add('error', 'הרגולטור ' + name(c) + ' מקבל ' + vin + 'V ואמור לתת ' + vout + 'V. רגולטור לינארי לא יכול להעלות מתח.', [c.id]);
        else if (vin && vout && vin - vout < 1.2 && !/LDO|1117|LM1117|MCP17|AP2112|XC6206|HT7333/i.test(c.value || c.label || '')) add('warning', 'הפרש המתח ברגולטור ' + name(c) + ' קטן (' + (vin - vout).toFixed(1) + 'V). ודאו שהוא LDO עם מתח נפילה נמוך מזה.', [c.id]);
      }
    });
  }

  /* ---------- שרטוט ---------- */

  var BOX_W = 196, HEAD = 40, ROW = 22, PAD = 10, GAP_X = 150, GAP_Y = 92, STACK = 30, EDGE = 110, TOP = 56, ROW_GAP_BOTTOM = 70, LANE = 7;

  var ICONS = {
    source: 'M-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M-5 0q2.5 -5 5 0t5 0',
    breaker: 'M-8 6L6 -6M-8 6h-4M6 -6l4 0M4 -10l6 6',
    rcd: 'M-8 6L6 -6M-8 6h-4M6 -6l4 0M-10 -8a5 5 0 1 0 0.1 0',
    fuse: 'M-10 -4h20v8h-20zM-14 0h28',
    contactor: 'M-9 -7h18v14h-18zM-9 7L9 -7',
    relay: 'M-9 -7h18v14h-18zM-9 7L9 -7',
    overload: 'M-9 -7h18v14h-18zM-6 3v-6h4v6h4v-6h4',
    switch: 'M-12 4h6L6 -5M6 4h6',
    button: 'M-12 4h6M6 4h6M-6 -2h12M0 -2v-7M-4 -9h8',
    selector: 'M-12 4h6L6 -5M6 4h6M-2 -9l4 4',
    plc: 'M-10 -8h20v16h-20zM-6 -3h4M-6 2h4M2 -3h4M2 2h4',
    psu: 'M-10 -8h20v16h-20zM-10 8L10 -8M-6 -3q2 -3 4 0M2 3h5',
    vfd: 'M-10 -8h20v16h-20zM-7 3q2 -6 4 0t4 0t4 0',
    motor: 'M-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M-4 4v-8l4 5l4 -5v8',
    lamp: 'M-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M-5.6 -5.6l11.2 11.2M5.6 -5.6l-11.2 11.2',
    sensor: 'M-10 -6h14l6 6l-6 6h-14zM-6 0h6',
    terminal: 'M-6 -6h12v12h-12zM0 -3a3 3 0 1 0 0.1 0',
    socket: 'M-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M-4 -2v4M4 -2v4',
    smart: 'M-10 -8h20v16h-20zM-5 2q5 -6 10 0M-2 5q2 -2 4 0',
    ic: 'M-8 -9h16v18h-16zM-11 -5h3M-11 0h3M-11 5h3M8 -5h3M8 0h3M8 5h3',
    connector: 'M-8 -8h16v16h-16zM-4 -4h8v8h-8z',
    resistor: 'M-12 0h4l2 -5l4 10l4 -10l4 10l2 -5h4',
    capacitor: 'M-12 0h10M-2 -7v14M2 -7v14M2 0h10',
    diode: 'M-12 0h24M-4 -6v12l8 -6zM4 -6v12',
    transistor: 'M-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M-3 -6v12M-3 -2l7 -5M-3 2l7 5',
    load: 'M-10 -6h20v12h-20zM-10 6L10 -6',
    led: 'M-12 0h24M-4 -6v12l8 -6zM4 -6v12M2 -9l4 -4M5 -7l4 -4',
    regulator: 'M-10 -8h20v16h-20zM-14 -3h4M10 -3h4M0 8v4M-5 1h10',
    mcu: 'M-9 -9h18v18h-18zM-5 -5h10v10h-10zM-12 -5h3M-12 0h3M-12 5h3M9 -5h3M9 0h3M9 5h3',
    crystal: 'M-12 0h6M6 0h6M-6 -7v14M6 -7v14M-3 -5h6v10h-6z',
    inductor: 'M-12 0h3a3 3 0 0 1 6 0a3 3 0 0 1 6 0a3 3 0 0 1 6 0h3',
    other: 'M-9 -7h18v14h-18z'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function layout(sch) {
    var comps = (sch.components || []).map(function (c, i) {
      var left = (c.terminals || []).filter(function (t) { return t.side !== 'right'; });
      var right = (c.terminals || []).filter(function (t) { return t.side === 'right'; });
      var rows = Math.max(left.length, right.length, 1);
      return {
        c: c, left: left, right: right,
        col: Math.max(0, parseInt(c.col, 10) || 0),
        row: Math.max(0, isFinite(parseInt(c.row, 10)) ? parseInt(c.row, 10) : i),
        head: c.value ? HEAD + 14 : HEAD,
        h: (c.value ? HEAD + 14 : HEAD) + rows * ROW + PAD
      };
    });
    // דחיסת עמודות ושורות ריקות
    var cols = uniq(comps.map(function (b) { return b.col; })), rows = uniq(comps.map(function (b) { return b.row; }));
    comps.forEach(function (b) { b.ci = cols.indexOf(b.col); b.ri = rows.indexOf(b.row); });
    // גובה כל שורה: רכיבים באותו תא נערמים זה מתחת לזה
    var cellH = {};
    comps.forEach(function (b) { var k = b.ci + ':' + b.ri; b.stackY = cellH[k] || 0; cellH[k] = b.stackY + b.h + STACK; });
    var rowH = rows.map(function (_, ri) {
      var h = 60;
      Object.keys(cellH).forEach(function (k) { if (+k.split(':')[1] === ri) h = Math.max(h, cellH[k] - STACK); });
      return h;
    });
    var rowY = [], rowBottom = [], y = TOP;
    rowH.forEach(function (h) { rowY.push(y); rowBottom.push(y + h); y += h + GAP_Y; });
    var colX = cols.map(function (_, ci) { return EDGE + ci * (BOX_W + GAP_X); });
    comps.forEach(function (b) { b.x = colX[b.ci]; b.y = rowY[b.ri] + b.stackY; });
    var pins = {};
    comps.forEach(function (b) {
      b.left.forEach(function (t, i) { pins[b.c.id + '.' + t.id] = { x: b.x, y: b.y + b.head + i * ROW + ROW / 2, dir: -1, box: b, gap: b.ci - 1 }; });
      b.right.forEach(function (t, i) { pins[b.c.id + '.' + t.id] = { x: b.x + BOX_W, y: b.y + b.head + i * ROW + ROW / 2, dir: 1, box: b, gap: b.ci }; });
    });
    var width = EDGE * 2 + cols.length * BOX_W + Math.max(0, cols.length - 1) * GAP_X;
    return { comps: comps, pins: pins, colX: colX, rowY: rowY, rowBottom: rowBottom, colVals: cols, rowVals: rows, cols: cols.length, width: Math.max(width, 520), height: y - GAP_Y + ROW_GAP_BOTTOM };
  }

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }).sort(function (x, y) { return x - y; }); }

  /* ניתוב בערוצים: קטעים אנכיים רק ברווחים שבין העמודות, קטעים אופקיים ארוכים רק ברווחים
     שבין השורות. כך חוט לעולם לא חוצה רכיב, ולכל חוט נתיב משלו כדי שלא יחפפו. */
  function router(L) {
    var used = {};
    function gapStart(g) { return g < 0 ? L.colX[0] - EDGE + 12 : L.colX[g] + BOX_W; }
    function gapWidth(g) { return g < 0 || g >= L.cols - 1 ? EDGE - 24 : GAP_X; }
    function vlane(g) {
      var k = 'v' + g, n = used[k] = (used[k] || 0) + 1;
      var cap = Math.max(1, Math.floor((gapWidth(g) - 24) / LANE));
      var i = (n - 1) % cap;
      // מתחילים מאמצע הרווח ומתפזרים לשני הצדדים
      var mid = gapStart(g) + gapWidth(g) / 2;
      return mid + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * LANE;
    }
    function hlane(ri) {
      var k = 'h' + ri, n = used[k] = (used[k] || 0) + 1;
      return L.rowBottom[ri] + 16 + ((n - 1) % Math.floor((GAP_Y - 24) / LANE)) * LANE;
    }
    return function (pa, pb) {
      // שני ההדקים פונים לאותו ערוץ (עמודות סמוכות, או אותו צד של אותה עמודה): קטע אנכי אחד
      if (pa.gap === pb.gap) {
        var X = vlane(pa.gap);
        return [[pa.x, pa.y], [X, pa.y], [X, pb.y], [pb.x, pb.y]];
      }
      // אחרת: יורדים בערוץ של הדק המוצא, עוברים ברווח שמתחת לשורה, ועולים בערוץ של הדק היעד
      var Xa = vlane(pa.gap), Xb = vlane(pb.gap);
      var Y = hlane(Math.min(pa.box.ri, pb.box.ri));
      return [[pa.x, pa.y], [Xa, pa.y], [Xa, Y], [Xb, Y], [Xb, pb.y], [pb.x, pb.y]];
    };
  }

  var HEB = /[\u0590-\u05FF]/;
  function flip(anchor) { return anchor === 'start' ? 'end' : anchor === 'end' ? 'start' : anchor; }

  function textAttr(x, y, anchor, size, fill, extra) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" font-size="' + size + '" fill="' + fill + '"' + (extra || '') + '>';
  }

  function render(sch, opts) {
    opts = opts || {};
    if (!sch || !sch.components || !sch.components.length) return '';
    var L = layout(sch), idx = index(sch), route = router(L);
    var flagged = {};
    (opts.issues || []).forEach(function (i) { if (i.level === 'error') i.refs.forEach(function (r) { flagged[r] = true; }); });
    var sel = opts.selected || {}, ia = !!opts.interactive;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" class="schematic-svg" viewBox="0 0 ' + L.width + ' ' + L.height + '" width="' + L.width + '" height="' + L.height + '" role="img" aria-label="' + esc(sch.title || 'סכימת חיווט') + '" font-family="Heebo, Assistant, Arial, sans-serif">');
    out.push('<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e3e7ee" stroke-width="0.6"/></pattern></defs>');
    out.push('<rect width="100%" height="100%" fill="#fbfcfe"/><rect width="100%" height="100%" fill="url(#grid)"/>');
    // בכיוון rtl ב-SVG, text-anchor=start מיישר לימין
    out.push(textAttr(L.width - 24, 32, 'start', 17, '#14213d', ' direction="rtl" font-weight="700"') + esc(sch.title || 'סכימת חיווט') + '</text>');

    var wireSvg = [], labels = [], dots = {}, placed = [], pinSvg = [];
    (sch.wires || []).forEach(function (w, wi) {
      var a = resolve(idx, w.from), b = resolve(idx, w.to);
      if (!a || !b || a === b) return;
      var pa = L.pins[a], pb = L.pins[b];
      if (!pa || !pb) return;
      var pts = route(pa, pb);
      var d = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
      var col = wireColor(w.color);
      var bad = flagged[a] || flagged[b];
      var title = '<title>' + esc((w.label ? 'חוט ' + w.label + ': ' : '') + w.from + ' → ' + w.to + ' · ' + (w.color || '') + ' ' + (w.section || '')) + '</title>';
      if (ia) wireSvg.push('<g class="wire' + (sel.wire === wi ? ' sel' : '') + '" data-w="' + wi + '"><path d="' + d + '" fill="none" stroke="transparent" stroke-width="12" stroke-linejoin="round"/>');
      if (sel.wire === wi) wireSvg.push('<path d="' + d + '" fill="none" stroke="#1c6fe0" stroke-opacity="0.35" stroke-width="10" stroke-linejoin="round"/>');
      if (bad) wireSvg.push('<path d="' + d + '" fill="none" stroke="#ff4d4f" stroke-opacity="0.35" stroke-width="9" stroke-linejoin="round"/>');
      wireSvg.push('<path d="' + d + '" fill="none" stroke="' + col.main + '" stroke-width="2.4" stroke-linejoin="round">' + title + '</path>');
      if (col.stripe) wireSvg.push('<path d="' + d + '" fill="none" stroke="' + col.stripe + '" stroke-width="2.4" stroke-dasharray="7 7" stroke-linejoin="round"/>');
      if (ia) wireSvg.push('</g>');
      dots[a] = pa; dots[b] = pb;
      var tag = [w.label, w.section ? w.section + (/^\d/.test(w.section) && !/mm|ממ|awg/i.test(w.section) ? 'mm²' : '') : ''].filter(Boolean).join(' · ');
      if (tag) {
        // תווית על קטע אופקי, במקום שלא מתנגש בתוויות אחרות. אם אין מקום — מדלגים (הכל מופיע בטבלת החיווט).
        var segs = [];
        for (var i = 0; i < pts.length - 1; i++) {
          if (pts[i][1] === pts[i + 1][1] && Math.abs(pts[i + 1][0] - pts[i][0]) > 40) segs.push(pts.slice(i, i + 2));
        }
        segs.sort(function (s1, s2) { return Math.abs(s2[1][0] - s2[0][0]) - Math.abs(s1[1][0] - s1[0][0]); });
        var w2 = clip(tag, 16).length * 3.1 + 3, spot = null;
        segs.some(function (sg) {
          var x1 = Math.min(sg[0][0], sg[1][0]) + w2 + 2, x2 = Math.max(sg[0][0], sg[1][0]) - w2 - 2;
          return [0.5, 0.3, 0.7, 0.15, 0.85].some(function (f) {
            var x = x1 + (x2 - x1) * f, y = sg[0][1] - 4;
            if (x2 < x1) return false;
            var hit = placed.some(function (r) { return Math.abs(r.x - x) < r.w + w2 + 4 && Math.abs(r.y - y) < 11; });
            if (!hit) spot = { x: x, y: y };
            return !hit;
          });
        });
        if (spot) {
          placed.push({ x: spot.x, y: spot.y, w: w2 });
          labels.push(textAttr(spot.x, spot.y, 'middle', 9.5, '#3b4252', ' paint-order="stroke" stroke="#fbfcfe" stroke-width="3" font-family="IBM Plex Mono, monospace"') + esc(clip(tag, 16)) + '</text>');
        }
      }
    });

    var boxes = [];
    L.comps.forEach(function (b) {
      var c = b.c, err = flagged[c.id];
      boxes.push('<g class="comp" data-id="' + esc(c.id) + '"><title>' + esc(c.id + ' · ' + c.label) + '</title>');
      if (sel.comp === c.id) boxes.push('<rect x="' + (b.x - 5) + '" y="' + (b.y - 5) + '" width="' + (BOX_W + 10) + '" height="' + (b.h + 10) + '" rx="11" fill="none" stroke="#1c6fe0" stroke-width="2.5" stroke-dasharray="6 4"/>');
      boxes.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + BOX_W + '" height="' + b.h + '" rx="8" fill="#ffffff" stroke="' + (err ? '#e03131' : '#29344d') + '" stroke-width="' + (err ? 2.4 : 1.4) + '"/>');
      boxes.push('<path d="M' + b.x + ' ' + (b.y + 30) + 'V' + (b.y + 8) + 'q0 -8 8 -8H' + (b.x + BOX_W - 8) + 'q8 0 8 8V' + (b.y + 30) + 'z" fill="#14213d"/>');
      boxes.push('<g transform="translate(' + (b.x + 18) + ',' + (b.y + 15) + ') scale(0.75)"><path d="' + (ICONS[c.type] || ICONS.other) + '" fill="none" stroke="#ffb703" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></g>');
      boxes.push(textAttr(b.x + 34, b.y + 20, 'start', 13, '#ffffff', ' font-weight="700" font-family="IBM Plex Mono, monospace"') + esc(c.id) + '</text>');
      boxes.push(textAttr(b.x + BOX_W - 10, b.y + 19.5, 'start', 10.5, '#c9d3e6', ' direction="rtl"') + esc(clip(c.label, 20)) + '</text>');
      if (c.value) boxes.push(textAttr(b.x + BOX_W / 2, b.y + 45, 'middle', 11, '#b35c00', ' font-weight="600" font-family="IBM Plex Mono, monospace"' + (HEB.test(c.value) ? ' direction="rtl"' : '')) + esc(clip(c.value, 24)) + '</text>');
      var both = b.left.length && b.right.length;
      function term(t, i, side) {
        var y = b.y + b.head + i * ROW + ROW / 2, key = c.id + '.' + t.id, bad = flagged[key];
        var x = side < 0 ? b.x : b.x + BOX_W;
        var p = normPotential(t.potential);
        boxes.push('<line x1="' + x + '" y1="' + y + '" x2="' + (x - side * 7) + '" y2="' + y + '" stroke="#29344d" stroke-width="1.2"/>');
        boxes.push(textAttr(x - side * 11, y + 4, side < 0 ? 'start' : 'end', 11.5, bad ? '#e03131' : '#14213d', ' font-weight="700" font-family="IBM Plex Mono, monospace"') + esc(t.id) + '</text>');
        // שם ההדק ליד המספר, בצד שלו של הקופסה
        var nx = side < 0 ? b.x + 44 : b.x + BOX_W - 44;
        var nm = clip(t.name, both ? 8 : 16);
        if (p) boxes.push(textAttr(nx, y + 4, side < 0 ? 'start' : 'end', 9, potColor(p), ' font-weight="700" font-family="IBM Plex Mono, monospace"') + esc(p) + '</text>');
        if (nm && nm !== p) {
          var off = p ? (p.length * 5.6 + 5) * -side : 0;
          var heb = HEB.test(nm), anc = side < 0 ? 'start' : 'end';
          boxes.push(textAttr(nx + off, y + 4, heb ? flip(anc) : anc, 9.5, '#6b7385', heb ? ' direction="rtl"' : '') + esc(nm) + '<title>' + esc(t.name + (p ? ' · ' + p : '')) + '</title></text>');
        }
      }
      b.left.forEach(function (t, i) { term(t, i, -1); });
      b.right.forEach(function (t, i) { term(t, i, 1); });
      boxes.push('</g>');
    });

    if (ia) {
      Object.keys(L.pins).forEach(function (k) {
        var p = L.pins[k], on = sel.pin === k;
        dots[k] = null;
        pinSvg.push('<g class="pin' + (on ? ' sel' : '') + '" data-pin="' + esc(k) + '"><circle cx="' + p.x + '" cy="' + p.y + '" r="9" fill="transparent"/>' +
          '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (on ? 5.5 : 4) + '" fill="' + (on ? '#1c6fe0' : '#fbfcfe') + '" stroke="' + (on ? '#1c6fe0' : '#14213d') + '" stroke-width="1.6"/></g>');
      });
    }
    var dotSvg = Object.keys(dots).filter(function (k) { return dots[k]; }).map(function (k) {
      var p = dots[k];
      return '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.2" fill="#fbfcfe" stroke="#14213d" stroke-width="1.6"/>';
    });

    out.push('<g class="wires">' + wireSvg.join('') + '</g>');
    out.push(boxes.join(''));
    out.push('<g class="dots">' + dotSvg.join('') + pinSvg.join('') + '</g>');
    out.push('<g class="labels">' + labels.join('') + '</g>');
    out.push('</svg>');
    return out.join('');
  }

  function potColor(p) {
    var k = kind(p);
    return { line: '#8a4b1f', neutral: '#1c6fe0', earth: '#2f9e44', pen: '#2f9e44', dc0: '#1b2f8a', dcplus: '#d9362b' }[k] || '#6b7385';
  }

  /* טבלת חיווט: שורה לכל חוט, ממוינת לפי מספר חוט */
  function wireTable(sch) {
    var idx = index(sch);
    return (sch.wires || []).map(function (w, i) {
      var a = idx.terms[resolve(idx, w.from)], b = idx.terms[resolve(idx, w.to)];
      return {
        n: i + 1, label: w.label || '', from: w.from, to: w.to, color: w.color || '', section: w.section || '',
        fromName: a ? (a.comp.label + ' · ' + (a.term.name || a.term.id)) : '?',
        toName: b ? (b.comp.label + ' · ' + (b.term.name || b.term.id)) : '?',
        hex: wireColor(w.color)
      };
    });
  }

  return {
    check: check, render: render, layout: layout, wireTable: wireTable, wireColor: wireColor, normPotential: normPotential,
    GEOM: { BOX_W: BOX_W, GAP_X: GAP_X, GAP_Y: GAP_Y, EDGE: EDGE, TOP: TOP }
  };
});
