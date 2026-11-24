/* ארון־פלאן — שאלות על התכנית: מוצא את הרכיבים והאותות שהשאלה מדברת עליהם, ומשחזר את המסלול החשמלי של כל אות
   לפי השרטוטים — מההזנה, דרך החיישן / המגע והמהדקים, ועד הכניסה בבקר (או מהיציאה, דרך העומס, עד ה-0V).
   קובץ משותף: window.WAsk בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.WAsk = factory(root.WEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  /* מילים בשאלה → מה לחפש בתכנית */
  var SYN = [
    [/שער|gate/i, ['GATE', 'שער', 'G1', 'G2', 'MG1', 'MG2']],
    [/פתוח|פתיחה|נפתח|open/i, ['OPEN', 'פתוח', 'פתיחה']],
    [/סגור|סגירה|נסגר|close/i, ['CLOSE', 'סגור', 'סגירה']],
    [/סייפטי|safety|בטיחות|ממסר בטיחות|psr/i, ['SAFETY', 'SFT', 'KSFT', 'KES', 'PSR', 'EMERGENCY', 'חירום', 'ENABLE', 'בטיחות']],
    [/חירום|emergency|e-?stop|מפסק חירום/i, ['EMERGENCY', 'חירום', 'ES', 'ESTOP']],
    [/דלת|door/i, ['DOOR', 'דלת', 'D1', 'D2']],
    [/סורק|scanner|scan/i, ['SCANNER', 'SCAN', 'סורק']],
    [/מגדל|light tower|רמזור|traffic/i, ['LIGHT TOWER', 'TRAFFIC', 'מגדל', 'רמזור']],
    [/נורית|נורה|led|תאורה|lamp/i, ['LED', 'LAMP', 'LIGHT', 'נורית', 'תאורה']],
    [/ups|אל.?פסק/i, ['UPS']],
    [/טלטוניקה|teltonika|ראוטר|נתב|router/i, ['TELTONIKA', 'ROUTER', 'נתב', 'RUT']],
    [/בקר|plc|cx\d|קונטרולר/i, ['PLC', 'בקר', 'CX']],
    [/ספק|power supply|psu|הזנה/i, ['ספק', 'PSU', 'הזנה', 'SUPPLY']],
    [/מנוע|motor/i, ['MOTOR', 'מנוע']],
    [/מאוורר|fan/i, ['FAN', 'מאוורר']],
    [/קורא|כרטיס|reader|tibbo/i, ['READER', 'קורא', 'TIBBO']],
    [/משטח|פלטה|plt|pup|parking|חניה/i, ['PLT', 'PUP', 'PARKING', 'משטח', 'חניה']],
    [/מעלית|lift/i, ['LIFT', 'מעלית']],
    [/איפוס|reset/i, ['RESET', 'איפוס']],
    [/מתג|switch/i, ['SWITCH', 'מתג']],
    [/פאנל|panel|לוח לקוח/i, ['PANEL', 'פאנל']],
    [/כיוון|direction/i, ['DIRECTION', 'כיוון']],
    [/מפסק ראשי|main switch|הזנה ראשית/i, ['MAIN', 'S0', 'ראשי']]
  ];
  var STOP = /^(של|את|על|מה|איך|לאן|מאיפה|אני|רוצה|לדעת|תשלח|לי|כל|גם|לפי|השרטוט|השרטוטים|התכנית|רושמת|מחובר|מחוברים|המסלול|מסלול|אחד|מהאלמנטים|בארון|הארון|מצב|חיישן|החיישן|ושל|או|הוא|היא|זה|כמו|כן|אם|יש|the|of|to|is|and|where|what|how)$/i;

  var up = function (s) { return String(s == null ? '' : s).toUpperCase(); };
  var K = function (tag, term) { return tag + ':' + up(E.normTerm(term)); };

  /* מילות חיפוש מהשאלה */
  function terms(q) {
    var out = { groups: [], tags: [], nums: [], words: [] };
    SYN.forEach(function (s) { if (s[0].test(q)) out.groups.push(s[1]); });
    (q.match(/-?[A-Z]{1,4}\d{0,3}(?::[\w.+-]+)?/gi) || []).forEach(function (t) {
      if (/^-/.test(t) || /^[A-Z]{1,4}\d{1,3}$/i.test(t)) out.tags.push(up(t).replace(/^-?/, '-').replace(/:.*/, ''));
    });
    (q.match(/\b\d{1,4}\b/g) || []).forEach(function (n) { out.nums.push(n); });
    q.split(/[\s,.?!:;()"'״׳\-–—/]+/).forEach(function (w) { if (w.length >= 3 && !STOP.test(w) && !SYN.some(function (s) { return s[0].test(w); })) out.words.push(up(w)); });
    return out;
  }

  /* כמה התיאור של חוט / רכיב מתאים לשאלה */
  function scoreText(text, t) {
    var T = up(text), s = 0, hits = 0;
    t.groups.forEach(function (g) { if (g.some(function (k) { return T.indexOf(up(k)) >= 0; })) { s += 3; hits++; } });
    t.words.forEach(function (w) { if (T.indexOf(w) >= 0) { s += 2; hits++; } });
    return { s: s, hits: hits };
  }

  /* גרף של הדקים: חוטים, ומעברים בתוך רכיבים (מגע, סליל, עומס) */
  function graph(P) {
    var by = {}, adj = {}, termsOf = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var add = function (a, b, e) { (adj[a] = adj[a] || []).push({ to: b, e: e }); (adj[b] = adj[b] || []).push({ to: a, e: e }); };
    P.wires.forEach(function (w) {
      var a = K(w.from.tag, w.from.term), b = K(w.to.tag, w.to.term);
      add(a, b, { kind: 'wire', wire: w });
      [[w.from.tag, w.from.term], [w.to.tag, w.to.term]].forEach(function (x) { (termsOf[x[0]] = termsOf[x[0]] || {})[up(E.normTerm(x[1]))] = 1; });
    });
    var num = function (t) { return /^\d+$/.test(t) ? Number(t) : NaN; };
    P.components.forEach(function (c) {
      var ts = Object.keys(termsOf[c.tag] || {});
      var has = function (t) { return ts.indexOf(t) >= 0; };
      var link = function (a, b, label) { if (has(a) && has(b)) add(c.tag + ':' + a, c.tag + ':' + b, { kind: 'inside', tag: c.tag, label: label }); };
      if (/plc|io|terminal|pe_bar/.test(c.type)) return;
      if (/relay|contactor|timer|button|estop|selector|thermostat|overload|mcb|mpcb|fuse|main_switch|rcd|other/.test(c.type)) {
        ts.forEach(function (t) {
          var n = num(t);
          if (isNaN(n)) return;
          if (n >= 11 && n <= 99) {
            var d = n % 10, base = n - d;
            if (d === 1) { link(t, String(base + 2), 'מגע ' + t + '-' + (base + 2) + ' (NC)'); link(t, String(base + 4), 'מגע ' + t + '-' + (base + 4) + ' (NO)'); }
            if (d === 3) link(t, String(base + 4), 'מגע ' + t + '-' + (base + 4) + ' (NO)');
            if (d === 5) { link(t, String(base + 6), 'מגע ' + t + '-' + (base + 6)); link(t, String(base + 8), 'מגע ' + t + '-' + (base + 8)); }
          } else if (n <= 8 && n % 2) link(t, String(n + 1), 'קוטב ' + t + '-' + (n + 1));
        });
        link('A1', 'A2', 'דרך הסליל');
        if (c.type === 'other') { link('1', '2', 'דרך הרכיב'); link('+', '-', 'דרך הרכיב'); }
      }
      if (/lamp|valve|fan|heater/.test(c.type)) { link('X1', 'X2', 'דרך העומס'); link('1', '2', 'דרך העומס'); }
      if (c.type === 'sensor') { link('BN', 'BK', 'דרך החיישן'); link('1', '4', 'דרך החיישן'); link('1', '2', 'דרך החיישן'); }
      /* ציוד בשטח עם הזנת ‎+24V (בקר שער, חיישן, לחצן): כל יציאה שלו מקבלת את ההזנה דרך המגע / החיישן שבו */
      if ((c.zone === 'field' || c.type === 'sensor') && !/motor|psu/.test(c.type)) {
        var feed = ts.filter(function (x) { return /^(\+24V?|24V|\+|L\+|COM|C|BN|V\+)$/.test(x); })[0];
        if (feed) ts.forEach(function (x) { if (x !== feed && !/^(0V|M|-|GND|PE|N|L[123]|BU|V-)$/.test(x) && !/^[A-Z]+-0V$/.test(x)) link(feed, x, 'דרך המגע / החיישן בשטח'); });
      }
    });
    return { by: by, adj: adj };
  }

  var potOf = function (w) { return up(w.potential || ''); };
  var isFeed = function (G, key) {
    return (G.adj[key] || []).some(function (x) {
      if (x.e.kind !== 'wire') return false;
      var p = potOf(x.e.wire), d = up(x.e.wire.desc);
      return /^\+?24V?$|^\+24|^24PLC|^12[TR]?$|^\+12|^L[123]$/.test(p) || /^\+24|^24V/.test(up(x.e.wire.no));
    }) || (function () { var tag = key.split(':')[0], c = G.by[tag]; return c && c.type === 'psu' && /^(\+|L\+|V\+|24V)/.test(key.split(':')[1]); })();
  };
  var isReturn = function (G, key) {
    return (G.adj[key] || []).some(function (x) { return x.e.kind === 'wire' && (/^0V|^N$|^M$/.test(potOf(x.e.wire)) || /^0V/.test(up(x.e.wire.no))); });
  };

  var isPsu = function (G, key) { var c = G.by[key.split(':')[0]]; return Boolean(c && (c.type === 'psu' || c.type === 'transformer')); };

  /* מסלול מהדק עד מקור (‎+24V / פאזה) או עד חזרה (0V / N), דרך חוטים ומגעים */
  function trace(G, start, goal, maxLen) {
    var prev = {}, seen = {}, q = [start];
    seen[start] = 1;
    var startTag = start.split(':')[0];
    while (q.length) {
      var cur = q.shift();
      if (cur !== start && goal(G, cur)) {
        var path = [cur];
        while (prev[path[0]]) path.unshift(prev[path[0]].from);
        var edges = [];
        for (var i = 1; i < path.length; i++) edges.push(prev[path[i]].e);
        return { pins: path, edges: edges, complete: true };
      }
      if (Object.keys(seen).length > 4000) break;
      (G.adj[cur] || []).forEach(function (x) {
        if (seen[x.to]) return;
        var tag = x.to.split(':')[0], c = G.by[tag];
        if (c && /plc|io/.test(c.type) && tag !== startTag && x.e.kind === 'wire' && !goal(G, x.to)) return;
        if (goal === isPsu && x.e.kind === 'inside' && /lamp|other|valve|fan|heater/.test((G.by[cur.split(':')[0]] || {}).type || '') && /עומס|הרכיב/.test(x.e.label)) return;
        if (cur !== start && cur.split(':')[0] === startTag && x.e.kind === 'inside') return;
        seen[x.to] = 1; prev[x.to] = { from: cur, e: x.e }; q.push(x.to);
      });
    }
    /* לא נמצא מקור: המסלול הארוך ביותר שנמצא (יוצא לשטח או לארון אחר) */
    var far = start, best = 0;
    Object.keys(prev).forEach(function (k) { var n = 0, p = k; while (prev[p]) { n++; p = prev[p].from; } if (n > best) { best = n; far = k; } });
    var pins = [far];
    while (prev[pins[0]]) pins.unshift(prev[pins[0]].from);
    var edges2 = [];
    for (var j = 1; j < pins.length; j++) edges2.push(prev[pins[j]].e);
    return { pins: pins, edges: edges2, complete: false };
  }

  /* מסלול → שלבים לתצוגה (מההזנה אל הבקר) */
  function steps(G, tr, reverse) {
    var pins = tr.pins.slice(), edges = tr.edges.slice();
    if (reverse) { pins.reverse(); edges.reverse(); }
    return pins.map(function (k, i) {
      var tag = k.split(':')[0], c = G.by[tag] || {};
      var e = i ? edges[i - 1] : null;
      return { pin: k, tag: tag, term: k.slice(tag.length + 1), name: c.name || '', type: c.type || '', zone: c.zone || '',
        via: e ? (e.kind === 'wire' ? { wire: e.wire.id, no: e.wire.no || '', color: e.wire.color || '', desc: e.wire.desc || '', page: e.wire.page || null } : { inside: e.label }) : null };
    });
  }

  /* השאלה עצמה */
  function ask(P, question) {
    var q = String(question || '').trim();
    var t = terms(q);
    var G = graph(P);
    var by = G.by;
    var wantOpen = /פתוח|פתיחה|open/i.test(q), wantClose = /סגור|סגירה|close/i.test(q);
    /* ציון לכל חוט */
    var scored = P.wires.map(function (w) {
      var a = by[w.from.tag] || {}, b = by[w.to.tag] || {};
      var text = [w.desc, w.explain, w.potential, w.no, w.from.tag, w.to.tag, a.name, b.name].join(' ');
      var r = scoreText(text, t);
      if (t.tags.some(function (x) { return x === w.from.tag || x === w.to.tag; })) r.s += 6;
      if (t.nums.some(function (n) { return String(w.no) === n; })) r.s += 4;
      /* "שער 1" — להעדיף את השער הנכון */
      t.nums.forEach(function (n) { if (new RegExp('(GATE|שער|G|D|DOOR|דלת)\\s?' + n + '(?!\\d)', 'i').test(text)) r.s += 3; });
      return { w: w, s: r.s, hits: r.hits };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    var compsHit = P.components.map(function (c) {
      var r = scoreText([c.tag, c.name, c.desc, c.partNo].join(' '), t);
      if (t.tags.indexOf(c.tag) >= 0) r.s += 8;
      return { c: c, s: r.s };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    if (!scored.length && !compsHit.length) return { ok: false, question: q, summary: 'לא מצאתי בתכנית רכיב או אות שמתאימים לשאלה. נסו לכתוב תג (למשל ‎-K1), מספר חוט, או מילה שמופיעה בתיאור (שער, חירום, סורק, UPS…).', circuits: [], wires: [], comps: [], pages: [] };
    var top = scored.length ? scored[0].s : 0;
    var focus = scored.filter(function (x) { return x.s >= Math.min(top, Math.max(3, top - 2)); });
    /* מצב פתוח / סגור: אות לכל מצב */
    if (wantOpen || wantClose) {
      var st = focus.filter(function (x) { var d = up(x.w.desc + ' ' + x.w.explain); return (wantOpen && /OPEN|פתוח|פתיחה/.test(d)) || (wantClose && /CLOSE|סגור|סגירה/.test(d)); });
      if (st.length) focus = st;
    }
    /* אותות: חוטים שמגיעים לבקר (כניסה / יציאה) */
    var signals = [];
    var seenPin = {};
    focus.slice(0, 40).forEach(function (x) {
      var w = x.w;
      [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
        var c = by[pr[0].tag];
        if (!c || !/plc|io/.test(c.type)) return;
        var k = K(pr[0].tag, pr[0].term);
        if (seenPin[k]) return;
        seenPin[k] = 1;
        var role = E.termRole(c.type, pr[0].term);
        var isOut = role.kind === 'output' || /EL2\d{3}|יציאות|OUTPUT|DO\b|DQ/i.test((c.name || '') + ' ' + (c.partNo || ''));
        signals.push({ pin: k, wire: w, out: isOut, s: x.s });
      });
    });
    signals.sort(function (a, b) { return b.s - a.s; });
    var circuits = signals.slice(0, 8).map(function (sg) {
      /* הדק הזנה (‎24V / 0V) של הבקר: עד הספק עצמו */
      var supplyPin = /^(\+?24V?P?|24VP|0V|0VP|M|L\+|\+|-|GND|US|UP)$/i.test(sg.pin.split(':')[1]);
      var tr = trace(G, sg.pin, supplyPin ? isPsu : sg.out ? isReturn : isFeed);
      var stp = steps(G, tr, !sg.out);
      /* יציאה שמפעילה ממסר / מגען: מה המגעים שלו מפעילים */
      var contacts = [];
      if (sg.out) stp.forEach(function (st) {
        var c = by[st.tag];
        if (!c || !/relay|contactor|timer/.test(c.type) || st.term !== 'A1' || contacts.length) return;
        P.wires.forEach(function (w) {
          [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
            if (pr[0].tag !== c.tag || /^A[12]$/i.test(String(pr[0].term))) return;
            var o = by[pr[1].tag] || {};
            contacts.push({ tag: c.tag, term: String(pr[0].term), wire: w.id, no: w.no || '', to: pr[1].tag + ':' + pr[1].term, toName: o.name || '', desc: w.desc || '', page: w.page || null });
          });
        });
      });
      return {
        contacts: contacts,
        title: (sg.out ? 'יציאה ' : 'כניסה ') + sg.pin + (sg.wire.desc ? ' — ' + sg.wire.desc : ''),
        signal: sg.wire.desc || '', pin: sg.pin, out: sg.out, complete: tr.complete,
        steps: stp,
        wires: stp.filter(function (s) { return s.via && s.via.wire; }).map(function (s) { return s.via.wire; })
      };
    });
    /* בלי אות לבקר: מסלול מהחוט הראשון אל המקור */
    if (!circuits.length && focus.length) {
      var w0 = focus[0].w, k0 = K(w0.to.tag, w0.to.term);
      var tr0 = trace(G, k0, isFeed);
      var s0 = steps(G, tr0, true);
      circuits.push({ title: 'חוט ' + (w0.no || '') + (w0.desc ? ' — ' + w0.desc : ''), signal: w0.desc || '', pin: k0, out: false, complete: tr0.complete, steps: s0, wires: s0.filter(function (s) { return s.via && s.via.wire; }).map(function (s) { return s.via.wire; }) });
    }
    /* כל החיווט של הנושא: רכיבים שהשאלה מדברת עליהם וכל החוטים שלהם */
    var topC = compsHit.length ? compsHit[0].s : 0;
    var comps = compsHit.filter(function (x) { return x.s >= Math.min(topC, Math.max(3, topC - 3)) && x.c.type !== 'terminal'; }).slice(0, 40).map(function (x) { return x.c.tag; });
    var wireSet = {};
    focus.forEach(function (x) { wireSet[x.w.id] = 1; });
    circuits.forEach(function (c) { c.wires.forEach(function (id) { wireSet[id] = 1; }); (c.contacts || []).forEach(function (x) { wireSet[x.wire] = 1; }); });
    var broad = comps.length >= 3 || focus.length > 12;
    if (broad) P.wires.forEach(function (w) { if (comps.indexOf(w.from.tag) >= 0 || comps.indexOf(w.to.tag) >= 0) wireSet[w.id] = 1; });
    var wires = P.wires.filter(function (w) { return wireSet[w.id]; });
    var pages = {};
    wires.forEach(function (w) { if (w.page) pages[w.page] = (pages[w.page] || 0) + 1; });
    P.components.forEach(function (c) { if (comps.indexOf(c.tag) >= 0 && c.page) pages[c.page] = pages[c.page] || 1; });
    var pageList = Object.keys(pages).map(Number).sort(function (a, b) { return a - b; });
    var summary;
    if (circuits.length && !broad) {
      summary = circuits.map(function (c) {
        var a = c.steps[0], z = c.steps[c.steps.length - 1];
        return (c.out ? 'היציאה ' : 'האות ') + '"' + (c.signal || c.pin) + '": ' + a.tag + ':' + a.term + ' ← … ← ' + z.tag + ':' + z.term + ' (' + (c.steps.length - 1) + ' קטעים' + (c.complete ? '' : ', ממשיך מחוץ לארון') + ')';
      }).join('\n');
    } else {
      summary = 'בתכנית ' + comps.length + ' רכיבים ו-' + wires.length + ' חוטים שקשורים לשאלה' + (pageList.length ? ', בעמודים ' + pageList.join(', ') : '') + '. ' + (circuits.length ? 'למטה גם המסלול של ' + circuits.length + ' אותות לבקר.' : '');
    }
    return { ok: true, question: q, broad: broad, summary: summary, circuits: circuits, wires: wires.map(function (w) { return w.id; }), comps: comps, pages: pageList };
  }

  return { ask: ask, terms: terms, graph: graph, trace: trace };
});
