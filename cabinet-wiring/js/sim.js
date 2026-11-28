/* ארון־פלאן — מעבדה: הדמיה חיה של הלוח ובדיקות תקינות.
   ההדמיה: רשתות חשמליות מהחוטים + מגעים פנימיים לפי המצב (מפסקים, סלילים, לחצנים), מקורות מתח
   (הזנת רשת, ספקים, יציאות בקר), איטרציה עד יציבות, זיהוי קצרים וניתוק ההגנה.
   קובץ משותף: window.WSim בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.WSim = factory(root.WEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var K = function (tag, term) { return tag + ':' + String(E.normTerm(term)).toUpperCase(); };
  var PH = { L1: 1, L2: 1, L3: 1 };
  var text = function (c) { return ((c.name || '') + ' ' + (c.desc || '') + ' ' + (c.partDesc || '') + ' ' + (c.partNo || '')).toUpperCase(); };

  /* ---------- הדקים ברירת מחדל לרכיב חדש ---------- */
  function defaultTerms(type, opts) {
    opts = opts || {};
    var p = Math.max(1, Math.min(4, opts.poles || 0));
    var seq = function (n) { var a = []; for (var i = 1; i <= n; i++) a.push(String(i)); return a; };
    switch (type) {
      case 'mcb': case 'fuse': return seq(2 * (p || 1));
      case 'rcd': return p >= 3 ? ['1', '2', '3', '4', '5', '6', 'N', 'N2'] : ['1', '2', 'N', 'N2'];
      case 'main_switch': return seq(6);
      case 'mpcb': return seq(6).concat(['13', '14']);
      case 'contactor': return seq(6).concat(['A1', 'A2', '13', '14']);
      case 'overload': return seq(6).concat(['95', '96', '97', '98']);
      case 'relay': return ['A1', 'A2', '11', '12', '14', '21', '22', '24'];
      case 'timer': return ['A1', 'A2', '15', '16', '18'];
      case 'psu': return ['L', 'N', 'PE', '+', '-'];
      case 'transformer': return ['L', 'N', '1', '2'];
      case 'lamp': return ['X1', 'X2'];
      case 'button': return opts.nc ? ['11', '12'] : ['13', '14'];
      case 'estop': return ['11', '12'];
      case 'selector': return ['13', '14'];
      case 'motor': return ['U1', 'V1', 'W1', 'PE'];
      case 'sensor': return ['BN', 'BK', 'BU'];
      case 'valve': case 'heater': case 'fan': return ['1', '2', 'PE'];
      case 'socket': return ['L', 'N', 'PE'];
      case 'terminal': return seq(Math.max(1, opts.count || 6));
      case 'pe_bar': return seq(Math.max(2, opts.count || 6));
      case 'thermostat': return ['1', '2'];
      default: return ['1', '2'];
    }
  }

  /* ---------- מצב התחלתי: הגנות מורמות, מפסק ראשי מנותק, הזנה מחוברת ---------- */
  function initialState(P) {
    var st = { feed: true, on: {}, pressed: {}, out: {}, tripped: {}, sense: {}, burnt: {} };
    P.components.forEach(function (c) {
      if (/mcb|rcd|mpcb|fuse/.test(c.type)) st.on[c.tag] = true;
      if (c.type === 'main_switch') st.on[c.tag] = false;
    });
    return st;
  }

  var num = function (t) { return /^\d+$/.test(t) ? Number(t) : NaN; };
  /* זוגות מגעים לפי מספור IEC: x1-x2 סגור (NC), x3-x4 פתוח (NO); ממסר: x1 משותף, x2 NC, x4 NO */
  function contactPairs(terms) {
    var set = {}; terms.forEach(function (t) { set[t] = 1; });
    var no = [], nc = [], com = [];
    terms.forEach(function (t) {
      var n = num(t);
      if (isNaN(n) || n < 11 || n > 99) return;
      var d = n % 10, base = n - d;
      if (d === 3 && set[String(base + 4)]) no.push([t, String(base + 4)]);
      if (d === 1 && set[String(base + 2)] && !set[String(base + 4)]) nc.push([t, String(base + 2)]);
      if (d === 1 && set[String(base + 4)]) com.push([t, String(base + 2), String(base + 4)]);
      if (d === 5 && (set[String(base + 6)] || set[String(base + 8)])) com.push([t, String(base + 6), String(base + 8)]);
    });
    if (set['1'] && set['2'] && !set['3']) nc.push(['1', '2']);
    if (set['3'] && set['4'] && !set['1']) no.push(['3', '4']);
    return { no: no, nc: nc, com: com };
  }
  function polePairs(terms) {
    var set = {}, out = [];
    terms.forEach(function (t) { set[t] = 1; });
    terms.forEach(function (t) {
      var n = num(t);
      if (!isNaN(n) && n <= 8 && n % 2 === 1 && set[String(n + 1)]) out.push([t, String(n + 1)]);
    });
    [['N', 'N2'], ['N1', 'N2'], ['N', "N'"], ['L', "L'"], ['L1', 'T1'], ['L2', 'T2'], ['L3', 'T3']].forEach(function (pr) { if (set[pr[0]] && set[pr[1]]) out.push(pr); });
    return out;
  }
  function coilRating(c) {
    var t = text(c);
    if (/24\s*V\s*DC|24VDC|24\s*VDC|\bBD\b|BB4|024DC|-41\b|סליל\s*24/.test(t)) return 'dc24';
    if (/230\s*V|230VAC|\bP7\b|AP0|230AC|-13\b|סליל\s*230/.test(t)) return 'ac230';
    return '';
  }
  var isOutModule = function (c) { return c.type === 'io' && /יציאות|OUTPUT|EL2|DQ|DO\b/i.test(text(c)); };
  var isInModule = function (c) { return c.type === 'io' && /כניסות|INPUT|EL1|DI\b/i.test(text(c)); };

  /* מה מקור המתח של כל הדק: */
  var OUT_PLUS = /^(\+|L\+|\+24V?|24V|V\+|1L\+|P24|DC\+|\+12V?)$/i, OUT_MINUS = /^(-|M|0V|V-|1M|GND|DC-|M24)$/i;

  /* הדמיה: P מועשר, state, prev (תוצאה קודמת — לאירועים) */
  function run(P, state, prev) {
    state = state || initialState(P);
    var by = {}; P.components.forEach(function (c) { by[c.tag] = c; });
    var termsOf = {};
    P.wires.forEach(function (w) { [w.from, w.to].forEach(function (e) { var t = String(E.normTerm(e.term)).toUpperCase(); (termsOf[e.tag] = termsOf[e.tag] || {})[t] = 1; }); });
    P.components.forEach(function (c) { (c.terms || []).forEach(function (t) { (termsOf[c.tag] = termsOf[c.tag] || {})[String(t).toUpperCase()] = 1; }); });
    var tl = function (tag) { return Object.keys(termsOf[tag] || {}); };
    var energized = {}, events = [], tripped = Object.assign({}, state.tripped), burnt = Object.assign({}, state.burnt);
    var res;
    for (var iter = 0; iter < 20; iter++) {
      /* union-find */
      var parent = {}, joins = [];
      var f = function (x) { if (parent[x] == null) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      var u = function (a, b) { var ra = f(a), rb = f(b); if (ra !== rb) parent[ra] = rb; };
      P.wires.forEach(function (w) { u(K(w.from.tag, w.from.term), K(w.to.tag, w.to.term)); });
      P.components.forEach(function (c) {
        var ts = tl(c.tag), tag = c.tag;
        var join = function (a, b) { if (termsOf[tag] && termsOf[tag][a] && termsOf[tag][b]) { u(tag + ':' + a, tag + ':' + b); if (state.debug) joins.push([tag + ':' + a, tag + ':' + b]); } };
        var on = state.on[tag] && !tripped[tag];
        var cp = contactPairs(ts);
        switch (c.type) {
          case 'main_switch': case 'mcb': case 'rcd': case 'mpcb':
            if (on) { polePairs(ts).forEach(function (pr) { join(pr[0], pr[1]); }); cp.no.forEach(function (pr) { join(pr[0], pr[1]); }); }
            else cp.nc.forEach(function (pr) { join(pr[0], pr[1]); });
            break;
          case 'fuse':
            if (!tripped[tag] && state.on[tag] !== false) polePairs(ts).forEach(function (pr) { join(pr[0], pr[1]); });
            break;
          case 'overload':
            polePairs(ts).forEach(function (pr) { join(pr[0], pr[1]); });
            if (!tripped[tag]) join('95', '96'); else join('97', '98');
            break;
          case 'contactor': case 'relay': case 'timer': {
            var en = energized[tag];
            if (c.type === 'contactor' && en) polePairs(ts).forEach(function (pr) { join(pr[0], pr[1]); });
            cp.no.forEach(function (pr) { if (en) join(pr[0], pr[1]); });
            cp.nc.forEach(function (pr) { if (!en) join(pr[0], pr[1]); });
            cp.com.forEach(function (tr) { join(tr[0], en ? tr[2] : tr[1]); });
            break;
          }
          case 'button': case 'estop': case 'selector': {
            var act = c.type === 'selector' ? Boolean(state.on[tag]) : Boolean(state.pressed[tag]);
            cp.no.forEach(function (pr) { if (act) join(pr[0], pr[1]); });
            cp.nc.forEach(function (pr) { if (!act) join(pr[0], pr[1]); });
            break;
          }
          case 'sensor':
            if (state.sense[tag]) { join('BN', 'BK'); join('1', '4'); }
            break;
          case 'thermostat': case 'other':
            /* מפסק דלת / גבול — מגע. "מתג Ethernet" הוא ציוד רשת, לא מגע */
            if (c.type === 'thermostat' || (/מפסק|limit|door\s*switch|מיקרו/i.test(c.name || '') && !/ethernet|רשת|lan|poe|ספק/i.test(c.name || ''))) { if (state.on[tag] !== false) polePairs(ts).forEach(function (pr) { join(pr[0], pr[1]); }); }
            break;
          default: break;
        }
      });
      /* מקורות */
      var src = {};
      var add = function (key, s) { var r = f(key); (src[r] = src[r] || {})[s] = 1; };
      var ms = P.components.find(function (c) { return c.type === 'main_switch'; }) || P.components.find(function (c) { return c.type === 'rcd'; });
      if (state.feed) {
        var fed = false;
        if (ms) {
          var phases = ['L1', 'L2', 'L3'];
          ['1', '3', '5'].forEach(function (t, i) { if (termsOf[ms.tag] && termsOf[ms.tag][t]) { add(ms.tag + ':' + t, phases[i]); fed = true; } });
          if (termsOf[ms.tag] && termsOf[ms.tag].N) add(ms.tag + ':N', 'N');
          if (termsOf[ms.tag] && termsOf[ms.tag]['7']) add(ms.tag + ':7', 'N');
          /* פס ההזנה: הפס שמחובר לכניסות המפסק הראשי — N ו-PE שלו */
          var strips = {};
          P.wires.forEach(function (w) {
            [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
              if (pr[0].tag === ms.tag && /^[135]$/.test(String(pr[0].term)) && by[pr[1].tag] && by[pr[1].tag].type === 'terminal') strips[pr[1].tag] = 1;
            });
          });
          Object.keys(strips).forEach(function (s) { tl(s).forEach(function (t) { if (/^N\d?$/.test(t)) add(s + ':' + t, 'N'); if (/^PE/.test(t)) add(s + ':' + t, 'PE'); }); });
        }
        if (!fed) {
          P.components.filter(function (c) { return c.type === 'terminal'; }).forEach(function (s) {
            tl(s.tag).forEach(function (t) { if (PH[t]) { add(s.tag + ':' + t, t); fed = true; } });
          });
          if (fed) P.components.filter(function (c) { return c.type === 'terminal'; }).forEach(function (s) { tl(s.tag).forEach(function (t) { if (t === 'N') add(s.tag + ':N', 'N'); }); });
        }
      }
      P.components.forEach(function (c) { if (c.type === 'pe_bar') tl(c.tag).forEach(function (t) { add(c.tag + ':' + t, 'PE'); }); });
      P.wires.forEach(function (w) { if (w.func === 'pe') add(K(w.from.tag, w.from.term), 'PE'); });
      /* ספקים */
      var sOf = function (key) { return src[f(key)] || {}; };
      var hasPh = function (o) { return Object.keys(o).some(function (k) { return PH[k]; }); };
      P.components.forEach(function (c) {
        if (c.type !== 'psu' && c.type !== 'transformer') return;
        var ts = tl(c.tag);
        var Lk = ts.find(function (t) { return /^(L|L1|AC\/L|~)$/.test(t); }), Nk = ts.find(function (t) { return /^(N|AC\/N)$/.test(t); });
        var live = Lk && Nk && hasPh(sOf(c.tag + ':' + Lk)) && (sOf(c.tag + ':' + Nk).N || hasPh(sOf(c.tag + ':' + Nk)));
        if (!live) return;
        var v = /12\s*V/i.test(text(c)) ? '+12' : '+24';
        ts.forEach(function (t) { if (OUT_PLUS.test(t)) add(c.tag + ':' + t, v); if (OUT_MINUS.test(t)) add(c.tag + ':' + t, '0V'); });
      });
      /* יציאות בקר שהופעלו ידנית */
      Object.keys(state.out).forEach(function (k) { if (state.out[k]) add(k, '+24'); });
      /* רשתות וקצרים */
      var netOf = function (key) { return src[f(key)] || {}; };
      var shorts = [];
      Object.keys(src).forEach(function (r) {
        var s = Object.keys(src[r]);
        var ph = s.filter(function (x) { return PH[x]; });
        var bad = ph.length > 1 || (ph.length && (src[r].N || src[r].PE || src[r]['0V'] || src[r]['+24'])) || (src[r]['+24'] && src[r]['0V']) || (src[r]['+12'] && src[r]['0V']) || (src[r].N && src[r].PE);
        if (bad) shorts.push({ root: r, what: s });
      });
      /* קצר: ההגנה שהיציאה שלה ברשת המקוצרת נופלת */
      if (shorts.length) {
        var did = false;
        shorts.forEach(function (sh) {
          P.components.forEach(function (c) {
            if (!/mcb|mpcb|fuse|rcd/.test(c.type) || tripped[c.tag] || state.on[c.tag] === false) return;
            var outs = tl(c.tag).filter(function (t) { var n = num(t); return (!isNaN(n) && n % 2 === 0 && n <= 8) || t === 'N2'; });
            if (outs.some(function (t) { return f(c.tag + ':' + t) === sh.root; })) { tripped[c.tag] = 'קצר (' + sh.what.join(' / ') + ')'; did = true; events.push(c.tag + ' נפל: קצר בין ' + sh.what.join(' ל-')); }
          });
        });
        if (did) continue;
      }
      /* סלילים */
      var volt = function (a, b) {
        var A = netOf(a), B = netOf(b);
        var pa = Object.keys(A).filter(function (x) { return PH[x]; }), pb = Object.keys(B).filter(function (x) { return PH[x]; });
        if (pa.length && (B.N || (pb.length && pb[0] !== pa[0]))) return B.N ? 'ac230' : 'ac400';
        if (pb.length && (A.N || (pa.length && pa[0] !== pb[0]))) return A.N ? 'ac230' : 'ac400';
        if ((A['+24'] && B['0V']) || (B['+24'] && A['0V'])) return 'dc24';
        if ((A['+12'] && B['0V']) || (B['+12'] && A['0V'])) return 'dc12';
        return '';
      };
      var changed = false, nextEn = {};
      P.components.forEach(function (c) {
        if (!/contactor|relay|timer/.test(c.type) || burnt[c.tag]) return;
        if (!(termsOf[c.tag] && termsOf[c.tag].A1 && termsOf[c.tag].A2)) return;
        var v = volt(c.tag + ':A1', c.tag + ':A2');
        if (!v) return;
        var r = coilRating(c);
        if (r === 'dc24' && /^ac/.test(v)) { burnt[c.tag] = 'סליל 24V DC קיבל ' + (v === 'ac400' ? '400V' : '230V') + ' AC'; events.push(c.tag + ': הסליל נשרף — ' + burnt[c.tag]); return; }
        if (r === 'ac230' && /^dc/.test(v)) return;
        nextEn[c.tag] = true;
      });
      Object.keys(Object.assign({}, nextEn, energized)).forEach(function (t) { if (Boolean(nextEn[t]) !== Boolean(energized[t])) changed = true; });
      energized = nextEn;
      res = { f: f, src: src, netOf: netOf, volt: volt, shorts: shorts, joins: joins };
      if (!changed) break;
    }
    /* עומסים ותוצאות */
    var comps = {};
    var R = res;
    P.components.forEach(function (c) {
      var tag = c.tag, ts = tl(tag), o = {};
      if (/mcb|rcd|mpcb|main_switch|fuse/.test(c.type)) o.on = Boolean(state.on[tag]) && !tripped[tag];
      if (tripped[tag]) o.tripped = tripped[tag];
      if (burnt[tag]) o.fault = burnt[tag];
      if (energized[tag]) o.energized = true;
      if (c.type === 'lamp' || /תאורת|LAMP|LED/i.test(c.name || '') && c.type === 'other') {
        var a = ts.find(function (t) { return /^(X1|1|\+|A1)$/.test(t); }), b = ts.find(function (t) { return /^(X2|2|-|A2)$/.test(t); });
        if (a && b && R.volt(tag + ':' + a, tag + ':' + b)) o.lit = true;
      }
      if (c.type === 'motor') {
        var ph = ['U1', 'V1', 'W1'].map(function (t) { return Object.keys(R.netOf(tag + ':' + t)).filter(function (x) { return PH[x]; })[0]; });
        if (ph[0] && ph[1] && ph[2] && new Set(ph).size === 3) { o.running = true; o.dir = ['L1L2L3', 'L2L3L1', 'L3L1L2'].indexOf(ph.join('')) >= 0 ? 'ימינה' : 'שמאלה'; }
        else if (ph.filter(Boolean).length) o.fault = 'חסרה פאזה (' + ph.map(function (x) { return x || '—'; }).join(' ') + ')';
      }
      if ((c.type === 'fan' || c.type === 'valve' || c.type === 'heater' || c.type === 'socket') && ts.length >= 2) {
        if (R.volt(tag + ':' + ts[0], tag + ':' + ts[1]) || R.volt(tag + ':L', tag + ':N')) o.running = true;
      }
      if (c.type === 'psu' && ts.some(function (t) { return OUT_PLUS.test(t) && R.netOf(tag + ':' + t)['+24']; })) o.on = true;
      if (c.type === 'plc' || c.type === 'io') {
        var ins = [];
        ts.forEach(function (t) {
          var role = E.termRole(c.type, t);
          var isIn = role.kind === 'input' || (c.type === 'io' && isInModule(c));
          if (isIn && R.netOf(tag + ':' + t)['+24']) ins.push(t);
        });
        if (ins.length) o.inputs = ins;
        var powered = ts.some(function (t) { return OUT_PLUS.test(t) && R.netOf(tag + ':' + t)['+24']; });
        if (powered) o.on = true;
      }
      if (Object.keys(o).length) comps[tag] = o;
    });
    /* חוטים חיים */
    var wires = {};
    P.wires.forEach(function (w) {
      var s = Object.keys(R.netOf(K(w.from.tag, w.from.term)));
      if (s.length) wires[w.id] = s;
    });
    var shortWires = {};
    R.shorts.forEach(function (sh) { P.wires.forEach(function (w) { if (R.f(K(w.from.tag, w.from.term)) === sh.root) shortWires[w.id] = sh.what; }); });
    /* אירועים לעומת המצב הקודם */
    if (prev && prev.comps) {
      Object.keys(Object.assign({}, comps, prev.comps)).forEach(function (t) {
        var a = prev.comps[t] || {}, b = comps[t] || {};
        if (!a.energized && b.energized) events.push(t + ' נמשך (הסליל קיבל מתח)');
        if (a.energized && !b.energized) events.push(t + ' שוחרר');
        if (!a.running && b.running) events.push(t + ' פועל' + (b.dir ? ' — סיבוב ' + b.dir : ''));
        if (a.running && !b.running) events.push(t + ' נעצר');
        if (!a.lit && b.lit) events.push(t + ' נדלקה');
        if (a.lit && !b.lit) events.push(t + ' כבתה');
        if (!a.fault && b.fault) events.push(t + ': ' + b.fault);
      });
    }
    return { comps: comps, wires: wires, shortWires: shortWires, shorts: R.shorts, tripped: tripped, burnt: burnt, events: events, joins: R.joins };
  }

  /* ---------- בדיקות תקינות ---------- */
  var SEC_FOR_A = function (a) { return a <= 10 ? 1.5 : a <= 16 ? 2.5 : a <= 25 ? 4 : a <= 32 ? 6 : 10; };
  var potClass = function (p) {
    p = String(p || '').toUpperCase().replace(/\s+/g, '');
    if (/^L[123]$/.test(p)) return p;
    if (p === 'N') return 'N';
    if (p === 'PE') return 'PE';
    if (/^\+?24V?$|^24G$|^\+24/.test(p)) return '+24';
    if (/^0V/.test(p)) return '0V';
    return '';
  };
  function checks(P) {
    var by = {}; P.components.forEach(function (c) { by[c.tag] = c; });
    var cats = { short: [], color: [], section: [], terminal: [], coil: [], pe: [], dup: [], complete: [] };
    var parent = {};
    var f = function (x) { if (parent[x] == null) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    P.wires.forEach(function (w) { var a = f(K(w.from.tag, w.from.term)), b = f(K(w.to.tag, w.to.term)); if (a !== b) parent[a] = b; });
    var nets = {};
    P.wires.forEach(function (w) { var r = f(K(w.from.tag, w.from.term)); (nets[r] = nets[r] || []).push(w); });
    Object.keys(nets).forEach(function (r) {
      var ws = nets[r];
      var pots = {}; ws.forEach(function (w) { var c = potClass(w.potential); if (c) pots[c] = (pots[c] || []).concat(w.no || w.id); });
      var pk = Object.keys(pots);
      var ph = pk.filter(function (x) { return PH[x]; });
      if (ph.length > 1 || (ph.length && (pots.N || pots.PE || pots['0V'] || pots['+24'])) || (pots['+24'] && pots['0V'])) {
        cats.short.push({ sev: 'err', msg: 'קצר בתכנון: באותה רשת חוטים עם פוטנציאלים שונים — ' + pk.map(function (k) { return k + ' (חוט ' + pots[k].slice(0, 3).join(', ') + ')'; }).join(' · '), wires: ws.map(function (w) { return w.id; }) });
      }
      /* צבעים: רק חוטים פנימיים בלוח (גידי כבל לשטח צבועים לפי הכבל) */
      var inner = ws.filter(function (w) { var a = by[w.from.tag], b = by[w.to.tag]; return a && b && a.zone !== 'field' && b.zone !== 'field' && !/[×xX]\s*\d|\dG\d|כבל|LiY|ÖLFLEX|NYY|CY/.test(w.wireType || ''); });
      var cols = {}; inner.forEach(function (w) { if (w.color) cols[w.color] = (cols[w.color] || 0) + 1; });
      var ck = Object.keys(cols);
      if (pots.PE || ws.some(function (w) { return w.func === 'pe'; })) {
        ws.forEach(function (w) { if (w.color && w.color !== 'GNYE') cats.color.push({ sev: 'err', msg: 'חוט ' + (w.no || '') + ' ברשת הארקה בצבע ' + w.color + ' — הארקה רק ירוק-צהוב.', wires: [w.id] }); });
      } else if (ck.length > 1 && ck.indexOf('GNYE') < 0) {
        cats.color.push({ sev: 'warn', msg: 'רשת אחת (' + (ws[0].potential || ws[0].no || '') + ') בכמה צבעים בתוך הלוח: ' + ck.join(', ') + '. בדרך כלל רשת אחת = צבע אחד.', wires: inner.map(function (w) { return w.id; }) });
      }
      ws.forEach(function (w) { if (w.color === 'GNYE' && w.func !== 'pe' && !pots.PE) cats.color.push({ sev: 'err', msg: 'חוט ' + (w.no || '') + ' ירוק-צהוב אבל הוא לא הארקה.', wires: [w.id] }); });
    });
    /* חתך מול ההגנה */
    P.components.forEach(function (c) {
      if (!/mcb|mpcb/.test(c.type)) return;
      var m = /(\d+(?:\.\d+)?)\s*A\b/.exec(((c.name || '') + ' ' + (c.desc || '')).replace(/[–—]/g, '-').replace(/\d+(?:\.\d+)?\s*-\s*(?=\d)/, ''));
      var bm = /\b[BCD](\d{1,3})\b/.exec((c.name || '') + ' ' + (c.desc || '') + ' ' + (c.partNo || ''));
      var a = bm ? Number(bm[1]) : m ? Number(m[1]) : 0;
      if (!a) return;
      var need = SEC_FOR_A(a);
      P.wires.forEach(function (w) {
        var e = w.from.tag === c.tag ? w.from : w.to.tag === c.tag ? w.to : null;
        if (!e || isNaN(num(String(e.term))) || num(String(e.term)) % 2 || w.func === 'pe') return;
        if (Number(w.section) && Number(w.section) < need) cats.section.push({ sev: 'warn', msg: 'חוט ' + (w.no || '') + ' ביציאה של ' + c.tag + ' (' + a + 'A): חתך ' + w.section + ' ממ"ר — מתחת ל-' + need + ' ממ"ר שמומלץ להגנה הזו.', wires: [w.id] });
      });
    });
    /* יותר משני חוטים בהדק */
    var perPin = {};
    P.wires.forEach(function (w) { [w.from, w.to].forEach(function (e) { var k = K(e.tag, e.term); (perPin[k] = perPin[k] || []).push(w); }); });
    Object.keys(perPin).forEach(function (k) {
      var tag = k.split(':')[0], c = by[tag];
      /* הדק במהדק מעבר: שתי נקודות הידוק, עד שני חוטים (TWIN) בכל אחת. הדק של רכיב: עד שניים */
      var lim = c && c.type === 'terminal' ? 4 : 2;
      if (!c || c.type === 'pe_bar' || perPin[k].length <= lim) return;
      cats.terminal.push({ sev: 'warn', msg: k + ': ' + perPin[k].length + ' חוטים על הדק אחד (מותר עד ' + lim + (lim === 4 ? ', שניים בכל צד בשרוול TWIN' : ' בשרוול TWIN') + '). להוסיף הדק או גשר.', wires: perPin[k].map(function (w) { return w.id; }) });
    });
    /* סלילים מול המתח */
    P.components.forEach(function (c) {
      if (!/contactor|relay|timer/.test(c.type)) return;
      var r = coilRating(c);
      var a1 = P.wires.filter(function (w) { return (w.from.tag === c.tag && w.from.term === 'A1') || (w.to.tag === c.tag && w.to.term === 'A1'); });
      var cls = a1.map(function (w) { return potClass(w.potential) || (w.func === 'ctrl_dc' ? '+24' : w.func === 'ctrl_ac' || w.func === 'power' ? 'AC' : ''); }).filter(Boolean);
      if (r === 'dc24' && cls.some(function (x) { return PH[x] || x === 'AC'; })) cats.coil.push({ sev: 'err', msg: c.tag + ': סליל 24V DC מחובר למתח AC — הסליל יישרף.' });
      if (r === 'ac230' && cls.indexOf('+24') >= 0) cats.coil.push({ sev: 'err', msg: c.tag + ': סליל 230V AC מחובר ל-24V DC — המגען לא יימשך.' });
    });
    /* כפילויות */
    var seen = {};
    P.wires.forEach(function (w) {
      var a = K(w.from.tag, w.from.term), b = K(w.to.tag, w.to.term), k = a < b ? a + '|' + b : b + '|' + a;
      if (a === b) cats.dup.push({ sev: 'warn', msg: 'חוט ' + (w.no || '') + ' מחובר משני הצדדים לאותו הדק (' + a + ').', wires: [w.id] });
      else if (seen[k]) cats.dup.push({ sev: 'warn', msg: 'חוטים ' + (seen[k].no || '') + ' ו-' + (w.no || '') + ' מחברים את אותם שני הדקים (' + a + ' ↔ ' + b + ').', wires: [w.id, seen[k].id] });
      else seen[k] = w;
    });
    /* שלמות והארקה */
    E.checkWiring(P).forEach(function (i) { (i.kind === 'pe' ? cats.pe : cats.complete).push({ sev: 'warn', msg: i.msg, tag: i.tag }); });
    P.components.forEach(function (c) {
      if (!/psu|socket/.test(c.type)) return;
      var has = P.wires.some(function (w) { return (w.from.tag === c.tag && /^PE/i.test(w.from.term)) || (w.to.tag === c.tag && /^PE/i.test(w.to.term)); });
      var any = P.wires.some(function (w) { return w.from.tag === c.tag || w.to.tag === c.tag; });
      if (any && !has) cats.pe.push({ sev: 'warn', msg: c.tag + ': אין חוט הארקה (PE) לרכיב עם כניסת 230V.', tag: c.tag });
    });
    return cats;
  }

  /* ---------- מה אפשר להפעיל בהדמיה: הגנות, לחצנים, בוררים, חיישנים ויציאות בקר ---------- */
  function controls(P) {
    var termsOf = {};
    P.wires.forEach(function (w) { [w.from, w.to].forEach(function (e) { var t = String(E.normTerm(e.term)).toUpperCase(); (termsOf[e.tag] = termsOf[e.tag] || {})[t] = 1; }); });
    P.components.forEach(function (c) { (c.terms || []).forEach(function (t) { (termsOf[c.tag] = termsOf[c.tag] || {})[String(t).toUpperCase()] = 1; }); });
    var wired = function (tag) { return P.wires.some(function (w) { return w.from.tag === tag || w.to.tag === tag; }); };
    var out = { main: [], protect: [], overload: [], buttons: [], estops: [], selectors: [], sensors: [], switches: [], outputs: [] };
    P.components.forEach(function (c) {
      if (!wired(c.tag) && !(c.terms && c.terms.length)) return;
      var it = { tag: c.tag, name: c.name || E.typeInfo(c.type).he, type: c.type };
      if (c.type === 'main_switch') out.main.push(it);
      else if (/mcb|rcd|mpcb|fuse/.test(c.type)) out.protect.push(it);
      else if (c.type === 'overload') out.overload.push(it);
      else if (c.type === 'button') out.buttons.push(it);
      else if (c.type === 'estop') out.estops.push(it);
      else if (c.type === 'selector') out.selectors.push(it);
      else if (c.type === 'sensor') out.sensors.push(it);
      else if (c.type === 'thermostat' || (c.type === 'other' && /מפסק|limit|door\s*switch|מיקרו/i.test(c.name || '') && !/ethernet|רשת|lan|poe|ספק/i.test(c.name || ''))) out.switches.push(it);
      if (c.type === 'plc' || c.type === 'io') {
        Object.keys(termsOf[c.tag] || {}).forEach(function (t) {
          var r = E.termRole(c.type, t);
          if (r.kind === 'output' || (c.type === 'io' && isOutModule(c) && !/^(\+|-|L\+|M|0V|24V|PE|1M|2M|3M|1L\+|2L\+|3L\+)$/i.test(t) && r.kind !== 'input')) out.outputs.push({ key: c.tag + ':' + t, tag: c.tag, term: t, name: it.name });
        });
      }
    });
    out.outputs.sort(function (a, b) { return a.key.localeCompare(b.key, 'en', { numeric: true }); });
    return out;
  }

  /* ציון כולל לבדיקות */
  function score(cats) {
    var err = 0, warn = 0;
    Object.keys(cats).forEach(function (k) { cats[k].forEach(function (i) { if (i.sev === 'err') err++; else warn++; }); });
    return { err: err, warn: warn, ok: !err };
  }

  return { defaultTerms: defaultTerms, initialState: initialState, run: run, checks: checks, controls: controls, score: score, coilRating: coilRating, contactPairs: contactPairs, polePairs: polePairs };
});
