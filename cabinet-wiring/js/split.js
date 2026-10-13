/* ארון־פלאן — פיצול לוח לכמה ארונות: כמה ארונות צריך, איזה רכיב לאיזה ארון, וחיווט מחדש
   דרך מהדקי ממשק (‎-XC…) וכבלים בין הארונות. קובץ משותף: window.WSplit בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.WSplit = factory(root.WEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  /* הארון הגדול ביותר שמשתמשים בו בפועל: 1200×2000 (פלטה שימושית בערך 1100×1850) */
  var MAX = { encW: 1200, encH: 2000, plateW: 1100, plateH: 1850 };

  /* האם צריך לפצל, ולכמה ארונות */
  function advise(P, L) {
    var enc = E.enclosure(P, L);
    var rails = Math.max(1, L.rails.length);
    var pitch = L.plate.h / rails;
    var perCab = Math.max(1, Math.floor(MAX.plateH / pitch));
    var railsEq = rails * Math.max(1, L.plate.w / MAX.plateW);
    var n = Math.max(1, Math.ceil(railsEq / perCab));
    var over = enc.w > MAX.encW || enc.h > MAX.encH;
    if (over && n < 2) n = 2;
    return {
      need: over || n > 1, count: n, enc: enc,
      reason: over || n > 1
        ? 'הלוח צריך פלטה ' + Math.round(L.plate.w) + '×' + Math.round(L.plate.h) + ' מ"מ (' + rails + ' מסילות). ארון אחד גדול ביותר הוא בערך ' + MAX.encW + '×' + MAX.encH + ', ולכן צריך ' + n + ' ארונות.'
        : 'הלוח נכנס לארון אחד (' + enc.text + '). אפשר לפצל בכל זאת, למשל ארון כוח וארון פיקוד נפרדים.'
    };
  }

  var ROW = function (c) { var t = E.typeInfo(c.type); return t.row == null ? 9 : t.row; };

  /* חלוקת הרכיבים לארונות. mode: 'auto' | 'power-control' | 'sequential' */
  function partition(P, L, n, mode) {
    var by = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var main = P.components.filter(function (c) { return c.zone === 'cabinet' && c.type !== 'terminal' && c.type !== 'pe_bar'; });
    var width = function (c) { var b = L.comps[c.tag]; return b ? b.w : (E.typeInfo(c.type).w || 40); };
    var bin = {};
    var roles = [];
    if (n === 2 && mode !== 'sequential') {
      var pw = main.filter(function (c) { return ROW(c) === 0 || ROW(c) === 2; });
      var ct = main.filter(function (c) { return !(ROW(c) === 0 || ROW(c) === 2); });
      var wp = pw.reduce(function (s, c) { return s + width(c); }, 0), wc = ct.reduce(function (s, c) { return s + width(c); }, 0);
      if (pw.length && ct.length && (mode === 'power-control' || Math.max(wp, wc) / Math.max(1, Math.min(wp, wc)) < 4)) {
        pw.forEach(function (c) { bin[c.tag] = 0; });
        ct.forEach(function (c) { bin[c.tag] = 1; });
        roles = ['כוח והגנות', 'פיקוד ובקרה'];
      }
    }
    if (!roles.length) {
      var ordered = main.slice().sort(function (a, b) { return ROW(a) - ROW(b); });
      var total = ordered.reduce(function (s, c) { return s + width(c); }, 0), target = total / n, acc = 0, k = 0;
      ordered.forEach(function (c) {
        if (acc >= target * (k + 1) && k < n - 1) k++;
        bin[c.tag] = k; acc += width(c);
      });
      for (var i = 0; i < n; i++) roles.push('חלק ' + (i + 1));
    }
    /* פסי מהדקים ורכיבי דלת: לארון שבו רוב הרכיבים שמחוברים אליהם */
    var vote = function (tag) {
      var cnt = {};
      P.wires.forEach(function (w) {
        var o = w.from.tag === tag ? w.to.tag : w.to.tag === tag ? w.from.tag : null;
        if (o != null && bin[o] != null) cnt[bin[o]] = (cnt[bin[o]] || 0) + 1;
      });
      var best = 0, bn = -1;
      Object.keys(cnt).forEach(function (b) { if (cnt[b] > bn) { bn = cnt[b]; best = Number(b); } });
      return best;
    };
    P.components.forEach(function (c) { if ((c.type === 'terminal' && c.zone === 'cabinet') || c.zone === 'door') bin[c.tag] = vote(c.tag); });
    return { bin: bin, roles: roles };
  }

  /* הפיצול עצמו: פרויקט לכל ארון, וכבלים בין הארונות */
  function split(P, L, n, opts) {
    opts = opts || {};
    n = Math.max(2, Math.min(8, n | 0));
    var part = partition(P, L, n, opts.mode || 'auto');
    var bin = part.bin;
    var by = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var cabs = [];
    for (var i = 0; i < n; i++) cabs.push({ index: i, role: part.roles[i], comps: {}, wires: [] });
    var peTag = P.components.filter(function (c) { return c.type === 'pe_bar'; }).map(function (c) { return c.tag; });
    var side = function (tag) {
      var c = by[tag];
      if (!c) return 'free';
      if (c.type === 'pe_bar') return 'pe';
      if (c.zone === 'field') return 'field';
      return bin[tag] != null ? bin[tag] : 0;
    };
    var keepComp = function (k, tag) { if (by[tag]) cabs[k].comps[tag] = by[tag]; };
    var iface = {}, ifaceCount = {}, links = {};
    var termOf = function (i, j, key) {
      var pk = Math.min(i, j) + '-' + Math.max(i, j);
      var id = pk + '|' + key;
      if (!iface[id]) { ifaceCount[pk] = (ifaceCount[pk] || 0) + 1; iface[id] = String(ifaceCount[pk]); }
      return iface[id];
    };
    var stripTo = function (j) { return '-XC' + (j + 1); };
    P.wires.forEach(function (w) {
      var a = side(w.from.tag), b = side(w.to.tag);
      var clone = function (from, to) { return { no: w.no, from: { tag: from.tag, term: from.term }, to: { tag: to.tag, term: to.term }, color: w.color, colorSource: w.colorSource, section: w.section, wireType: w.wireType, func: w.func, potential: w.potential, desc: w.desc, explain: w.explain, page: w.page }; };
      var num = function (s) { return typeof s === 'number'; };
      var home = num(a) ? a : num(b) ? b : 0;
      if (!num(a) || !num(b) || a === b) {
        var k = num(a) && num(b) ? a : home;
        keepComp(k, w.from.tag); keepComp(k, w.to.tag);
        cabs[k].wires.push(clone(w.from, w.to));
        return;
      }
      /* חוט שעובר בין שני ארונות: חוט עד מהדק ממשק בכל צד, וגיד בכבל ביניהם (גיד אחד לכל רשת) */
      var key = w.net || (w.potential ? 'pot:' + w.potential : 'w:' + w.no + ':' + w.from.tag + ':' + w.from.term);
      var t = termOf(a, b, key);
      keepComp(a, w.from.tag); keepComp(b, w.to.tag);
      cabs[a].wires.push(clone(w.from, { tag: stripTo(b), term: t }));
      cabs[b].wires.push(clone({ tag: stripTo(a), term: t }, w.to));
      var lk = Math.min(a, b) + '-' + Math.max(a, b);
      var L2 = links[lk] || (links[lk] = { a: Math.min(a, b), b: Math.max(a, b), cores: {}, power: false });
      if (!L2.cores[t]) L2.cores[t] = { a: stripTo(L2.b) + ':' + t, b: stripTo(L2.a) + ':' + t, label: w.potential || w.no, func: w.func, section: w.section };
      if (w.func === 'power' || w.func === 'neutral') L2.power = true;
    });
    /* רכיבים בלי חוטים נשארים בארון שלהם */
    P.components.forEach(function (c) { if (bin[c.tag] != null && !cabs.some(function (cb) { return cb.comps[c.tag]; })) cabs[bin[c.tag]].comps[c.tag] = c; });
    /* כל ארון: פס הארקה משלו, ופסי ממשק לארונות האחרים */
    var out = cabs.map(function (cb, i) {
      var comps = Object.keys(cb.comps).map(function (t) { return Object.assign({}, cb.comps[t]); });
      peTag.forEach(function (t) { if (!comps.some(function (c) { return c.tag === t; })) comps.push(Object.assign({}, by[t])); });
      Object.keys(links).forEach(function (lk) {
        var l = links[lk];
        if (l.a !== i && l.b !== i) return;
        var other = l.a === i ? l.b : l.a;
        comps.push({ tag: stripTo(other), type: 'terminal', name: 'מהדקי ממשק לארון ' + (other + 1) + ' (' + cabs[other].role + ')', zone: 'cabinet' });
      });
      return { index: i, role: cb.role, components: comps, wires: cb.wires };
    });
    var linkList = Object.keys(links).map(function (lk) {
      var l = links[lk];
      return { a: l.a, b: l.b, kind: l.power ? 'power' : 'control', cores: Object.keys(l.cores).sort(function (x, y) { return Number(x) - Number(y); }).map(function (t) { return l.cores[t]; }) };
    });
    return { cabinets: out, links: linkList, roles: part.roles };
  }

  return { MAX: MAX, advise: advise, partition: partition, split: split };
});
