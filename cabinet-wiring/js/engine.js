/* ארון־פלאן — המנוע: שליפת חוטים מטקסט של PDF, השלמה לפי כללים (סוג רכיב, תפקיד, צבע, חתך),
   הסבר לכל חוט, פריסת הארון, ניתוב החוטים בתעלות ותכנית ההרכבה.
   קובץ משותף: נטען בדפדפן (window.WEngine) ובבדיקות (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./catalog.js'));
  else root.WEngine = factory(root.WCat);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ---------- כלים ---------- */
  function natCmp(a, b) {
    var ax = String(a).match(/(\d+(?:\.\d+)?|\D+)/g) || [];
    var bx = String(b).match(/(\d+(?:\.\d+)?|\D+)/g) || [];
    for (var i = 0; i < Math.max(ax.length, bx.length); i++) {
      var x = ax[i], y = bx[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      var nx = /^\d/.test(x), ny = /^\d/.test(y);
      if (nx && ny) { var d = parseFloat(x) - parseFloat(y); if (d) return d; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  function normTag(s) {
    var t = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
    if (!t) return '';
    if (/^[A-Z0-9]/.test(t)) t = '-' + t;
    return t;
  }
  function normTerm(s) {
    return String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/^[:.]/, '');
  }
  /* החלק האחרון של התג (אחרי =, + ו-) — למשל =A1+S1-K1 → K1 */
  function tagBody(tag) {
    var m = /([A-Z][A-Z0-9.]*)$/.exec(String(tag || '').toUpperCase());
    return m ? m[1] : String(tag || '').replace(/^[-=+]/, '');
  }
  function tagLetters(tag) {
    var m = /^([A-Z]+)/.exec(tagBody(tag));
    return m ? m[1] : '';
  }
  function pinKey(tag, term) { return tag + ':' + term; }
  function uid(prefix) { return (prefix || 'id') + Math.random().toString(36).slice(2, 9); }

  /* ---------- סוג רכיב ---------- */
  function inferType(tag, name, terms) {
    var text = String(name || '');
    for (var i = 0; i < C.NAME_RULES.length; i++) {
      if (C.NAME_RULES[i][0].test(text)) return refineType(C.NAME_RULES[i][1], tag, terms);
    }
    var body = tagBody(tag), letters = tagLetters(tag);
    for (var j = 0; j < C.PREFIX_RULES.length; j++) {
      var re = C.PREFIX_RULES[j][0];
      if (re.test(body) || re.test(letters)) return refineType(C.PREFIX_RULES[j][1], tag, terms);
    }
    return refineType('other', tag, terms);
  }

  /* דיוק לפי ההדקים שבשימוש: K עם מגעי כוח 1-6 הוא מגען, Q עם סליל A1 הוא מגען, A עם I/Q הוא בקר */
  function refineType(type, tag, terms) {
    var t = (terms || []).map(function (x) { return String(x).toUpperCase(); });
    var has = function (re) { return t.some(function (x) { return re.test(x); }); };
    var mainPoles = has(/^(1|2|3|4|5|6|L1|L2|L3|T1|T2|T3)$/);
    if (type === 'relay' && mainPoles && has(/^A[12]$/)) return 'contactor';
    if (type === 'mcb' && has(/^A[12]$/) && !has(/^(95|96|97|98)$/)) return 'contactor';
    if (type === 'mcb' && has(/^(95|96|97|98)$/) && !has(/^A[12]$/)) return 'overload';
    if (type === 'other' && has(/^%?[IQ]\d|^D[IOQ][A-Z]?[.\d]/)) return 'plc';
    return type;
  }

  function typeInfo(type) { return C.TYPES[type] || C.TYPES.other; }
  function zoneOf(comp) {
    if (comp && comp.location && C.ZONES[comp.location]) return comp.location;
    return typeInfo(comp && comp.type).zone;
  }

  /* ---------- שליפה אוטומטית מטקסט של PDF (רשימות חוטים / תכניות מהדקים) ---------- */
  var EP_RE = /([=+\-][A-Z0-9.=+\-]*?[A-Z]{1,4}\d{0,4}[A-Z0-9.]*|\b[A-Z]{1,4}\d{1,4}(?:\.\d+)?)\s*:\s*([A-Za-z0-9+\-\/%.]{1,8})/g;
  var SEC_RE = /(\d+(?:[.,]\d+)?)\s*(?:mm²|mm2|mm\^2|qmm|ממ"ר|ממ״ר|sqmm)/i;
  var AWG_RE = /\b(\d{1,2})\s*AWG\b|\bAWG\s*(\d{1,2})\b/i;
  var TYPE_RE = /\b(H0[57]V-?[KUR]|H05VV5-F|LiYCY|LiYY|NYY|N2XY|YSLY|ÖLFLEX|OLFLEX|UL\s?1015|MTW)\b/i;
  var AWG_TO_MM = { 24: 0.25, 22: 0.34, 20: 0.5, 18: 0.75, 17: 1, 16: 1.5, 14: 2.5, 12: 4, 10: 6, 8: 10, 6: 16, 4: 25, 2: 35, 1: 50 };

  function textLines(pages) {
    var lines = [];
    (pages || []).forEach(function (pg) {
      var items = (pg.items || []).filter(function (it) { return it.s && it.s.trim(); });
      items.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
      var cur = null;
      items.forEach(function (it) {
        var tol = Math.max(0.003, (it.h || 0.01) * 0.5);
        if (cur && Math.abs(it.y - cur.y) <= tol) { cur.items.push(it); }
        else { cur = { page: pg.page, y: it.y, items: [it] }; lines.push(cur); }
      });
      if (!items.length && pg.text) {
        String(pg.text).split(/\n+/).forEach(function (s) { lines.push({ page: pg.page, y: 0, items: [{ s: s, x: 0 }] }); });
      }
    });
    lines.forEach(function (l) {
      l.items.sort(function (a, b) { return a.x - b.x; });
      l.text = l.items.map(function (i) { return i.s; }).join('  ').replace(/\s{3,}/g, '  ').trim();
    });
    return lines;
  }

  function colorsInText(s) {
    var out = [];
    var toks = String(s).split(/[\s|;,()]+/);
    toks.forEach(function (tk) {
      if (!tk || tk.length > 14) return;
      if (/^[A-Z]{1,3}\d/.test(tk)) return;
      var c = C.colorCode(tk);
      if (c && !(tk.toUpperCase() === 'PE')) out.push(c);
    });
    return out;
  }

  function extractFromText(pages) {
    var lines = textLines(pages);
    var wires = [], comps = {}, seen = {};
    lines.forEach(function (l) {
      var s = l.text;
      var eps = [], m;
      EP_RE.lastIndex = 0;
      while ((m = EP_RE.exec(s))) eps.push({ tag: normTag(m[1]), term: normTerm(m[2]), at: m.index, end: m.index + m[0].length });
      if (eps.length >= 2) {
        var a = eps[0], b = eps[1];
        var rest = (s.slice(0, a.at) + ' ' + s.slice(a.end, b.at) + ' ' + s.slice(b.end)).trim();
        var sec = SEC_RE.exec(s), awg = AWG_RE.exec(s), ty = TYPE_RE.exec(s);
        var section = sec ? parseFloat(sec[1].replace(',', '.')) : awg ? AWG_TO_MM[Number(awg[1] || awg[2])] || null : null;
        var colors = colorsInText(rest);
        var no = '';
        var noM = /(?:^|\s)(?:W|WN|#)?\s*(\d{1,4}[A-Z]?|[A-Z]?\d{1,4}(?:\.\d{1,2})?)(?=\s|$)/.exec(rest.replace(SEC_RE, ' ').replace(AWG_RE, ' '));
        if (noM) no = noM[1];
        var key = [a.tag, a.term, b.tag, b.term].join('|');
        if (seen[key]) return;
        seen[key] = 1;
        wires.push({
          no: no, from: { tag: a.tag, term: a.term }, to: { tag: b.tag, term: b.term },
          color: colors[0] || '', colorSource: colors[0] ? 'drawing' : '', section: section,
          wireType: ty ? ty[1].toUpperCase().replace(/^H0([57])V([KUR])$/, 'H0$1V-$2') : '',
          page: l.page, src: s.slice(0, 200)
        });
        eps.slice(0, 2).forEach(function (e) { comps[e.tag] = comps[e.tag] || { tag: e.tag, name: '', page: l.page }; });
        return;
      }
      /* שורה שמתחילה בתג ואחריה תיאור — רשימת חלקים */
      var cm = /^([=+\-][A-Z0-9.=+\-]*?[A-Z]{1,4}\d{1,4}[A-Z0-9.]*)\s{1,}(.{3,120})$/.exec(s);
      if (cm && !/:/.test(cm[1])) {
        var tg = normTag(cm[1]);
        var desc = cm[2].trim();
        if (!comps[tg] || !comps[tg].name) comps[tg] = { tag: tg, name: desc.slice(0, 80), desc: desc, page: l.page };
      }
    });
    return { components: Object.keys(comps).map(function (k) { return comps[k]; }), wires: wires, lines: lines.length };
  }

  /* ---------- תפקידי הדקים ---------- */
  function termRole(type, term) {
    var t = String(term || '').toUpperCase();
    var n = /^\d+$/.test(t) ? Number(t) : NaN;
    if (t === 'PE' || t === 'GNYE' || t === '⏚') return { side: 'any', role: 'הדק הארקה (PE)', kind: 'pe' };
    if (t === 'N' || t === 'N1' || t === 'N2') return { side: type === 'psu' ? 'top' : (t === 'N2' ? 'bottom' : 'top'), role: 'אפס (N)', kind: 'neutral' };
    if (type === 'terminal' || type === 'pe_bar') return { side: 'any', role: 'מהדק ' + term, kind: '' };
    if (type === 'io' && /^\d+$/.test(t)) return { side: n <= 8 ? 'top' : 'bottom', role: 'ערוץ ' + t, kind: 'io' };
    if (/^A1$/.test(t)) return { side: 'top', role: 'הדק סליל A1 (כניסת מתח ההפעלה)', kind: 'coil' };
    if (/^A2$/.test(t)) return { side: 'bottom', role: 'הדק סליל A2 (חזרה / 0V)', kind: 'coil0' };
    if (/^L[123]$/.test(t)) return { side: 'top', role: 'כניסת פאזה ' + t, kind: 'power' };
    if (/^L$/.test(t)) return { side: 'top', role: 'כניסת פאזה (L)', kind: 'power' };
    if (/^T[123]$/.test(t) && type !== 'plc') return { side: 'bottom', role: 'יציאה לצרכן ' + t, kind: 'power' };
    if (/^[UVW]1?$/.test(t)) return { side: type === 'motor' ? 'top' : 'bottom', role: 'פאזת מנוע ' + t, kind: 'power' };
    if (/^(%?I\d|%?IX|DI[A-Z]?[.\d]|E\d+\.\d)/.test(t)) return { side: 'top', role: 'כניסה דיגיטלית ' + term, kind: 'input' };
    if (/^(%?Q\d|%?QX|DQ[A-Z]?[.\d]|DO[A-Z]?[.\d]|A\d+\.\d)/.test(t) && type !== 'contactor' && type !== 'relay') return { side: 'bottom', role: 'יציאה דיגיטלית ' + term, kind: 'output' };
    if (/^(AI|IW|AIN|AI\d|V\d\+|I\d\+)/.test(t)) return { side: 'top', role: 'כניסה אנלוגית ' + term, kind: 'analog' };
    if (/^(AO|QW|AQ)/.test(t)) return { side: 'bottom', role: 'יציאה אנלוגית ' + term, kind: 'analog' };
    if (/^(L\+|\+24V?|24V|\+|V\+|1L\+|2L\+|DC\+|P24)$/.test(t)) return { side: type === 'psu' ? 'bottom' : 'top', role: 'הדק ‎+24V', kind: 'dc+' };
    if (/^(M|0V|-|V-|1M|2M|DC-|M24|GND)$/.test(t)) return { side: type === 'psu' ? 'bottom' : 'top', role: 'הדק ‎0V', kind: 'dc0' };
    if (/^(X1)$/.test(t) && (type === 'lamp' || type === 'valve')) return { side: 'top', role: 'הדק X1 (+)', kind: 'load+' };
    if (/^(X2)$/.test(t) && (type === 'lamp' || type === 'valve')) return { side: 'bottom', role: 'הדק X2 (0V / חזרה)', kind: 'load0' };
    if (/^(95)$/.test(t)) return { side: 'top', role: 'מגע עזר NC של הממסר התרמי (95-96)', kind: 'nc' };
    if (/^(96)$/.test(t)) return { side: 'bottom', role: 'מגע עזר NC של הממסר התרמי (95-96)', kind: 'nc' };
    if (/^(97)$/.test(t)) return { side: 'top', role: 'מגע התראה NO של הממסר התרמי (97-98)', kind: 'no' };
    if (/^(98)$/.test(t)) return { side: 'bottom', role: 'מגע התראה NO של הממסר התרמי (97-98)', kind: 'no' };
    if (!isNaN(n) && (type === 'relay' || type === 'timer') && n >= 11 && n <= 99) {
      var ld = n % 10;
      if (ld === 1) return { side: 'top', role: 'מגע משותף COM (' + t + ')', kind: 'com' };
      if (ld === 2) return { side: 'bottom', role: 'מגע סגור NC (' + (n - 1) + '-' + t + ')', kind: 'nc' };
      if (ld === 4) return { side: 'bottom', role: 'מגע פתוח NO, יציאה (' + t + ')', kind: 'no' };
      if (ld === 3) return { side: 'top', role: 'מגע פתוח NO, כניסה (' + t + '-' + (n + 1) + ')', kind: 'no' };
    }
    if (!isNaN(n)) {
      if (n <= 8 && type !== 'button' && type !== 'selector' && type !== 'estop' && type !== 'relay' && type !== 'timer' && type !== 'sensor') {
        return n % 2 ? { side: 'top', role: 'מגע כוח, כניסה ' + t, kind: 'pole' } : { side: 'bottom', role: 'מגע כוח, יציאה ' + t, kind: 'pole' };
      }
      if (n >= 11 && n <= 99) {
        var last = n % 10;
        var pair = (n - last);
        if (last === 3 || last === 4) return { side: last === 3 ? 'top' : 'bottom', role: 'מגע עזר פתוח NO (' + (pair + 3) + '-' + (pair + 4) + ')', kind: 'no' };
        if (last === 1 || last === 2) return { side: last === 1 ? 'top' : 'bottom', role: 'מגע עזר סגור NC (' + (pair + 1) + '-' + (pair + 2) + ')', kind: 'nc' };
        if (last === 5 || last === 6) return { side: last === 5 ? 'top' : 'bottom', role: 'מגע מחליף ' + t + ' (משותף/NC)', kind: 'co' };
        if (last === 7 || last === 8) return { side: last === 7 ? 'top' : 'bottom', role: 'מגע מחליף ' + t + ' (NO)', kind: 'co' };
      }
      if (type === 'relay' || type === 'timer') {
        if (n === 11 || n === 21) return { side: 'top', role: 'משותף (COM) ' + t, kind: 'com' };
        return { side: n % 2 ? 'top' : 'bottom', role: 'מגע ' + t, kind: 'co' };
      }
      return { side: n % 2 ? 'top' : 'bottom', role: 'הדק ' + t, kind: '' };
    }
    if (/^(BN)$/.test(t)) return { side: 'top', role: 'גיד חום (+24V)', kind: 'dc+' };
    if (/^(BU)$/.test(t)) return { side: 'top', role: 'גיד כחול (0V)', kind: 'dc0' };
    if (/^(BK|WH)$/.test(t)) return { side: 'top', role: 'גיד אות (' + t + ') — יציאת המצב של החיישן', kind: 'sig' };
    if (/^(COM|C)$/.test(t)) return { side: 'top', role: 'משותף (COM)', kind: 'com' };
    if (/^(NO)$/.test(t)) return { side: 'bottom', role: 'מגע פתוח (NO)', kind: 'no' };
    if (/^(NC)$/.test(t)) return { side: 'bottom', role: 'מגע סגור (NC)', kind: 'nc' };
    if (/^(A|B|D\+|D-|TX|RX|CAN|SHLD)/.test(t)) return { side: 'bottom', role: 'הדק תקשורת ' + term, kind: 'comm' };
    return { side: '', role: 'הדק ' + term, kind: '' };
  }

  /* ---------- השלמה לפי כללים ---------- */
  var DEFAULT_SETTINGS = {
    phaseColors: 'iec60204',   // iec60204: כל הפאזות שחורות · iec60445: L1 חום, L2 שחור, L3 אפור
    control: 'dc24',           // dc24 / ac230 / ac24
    termTech: 'screw',         // screw / pushin
    plateWidth: 'auto',        // auto או מ"מ
    powerSection: 2.5, controlSection: 0.75, peSection: 2.5
  };

  function settingsOf(project) {
    var s = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { s[k] = DEFAULT_SETTINGS[k]; });
    var ps = (project && project.settings) || {};
    Object.keys(ps).forEach(function (k) { if (ps[k] !== undefined && ps[k] !== '') s[k] = ps[k]; });
    return s;
  }

  /* איחוד צמתים: חוטים, מהדקים (שני הצדדים), והגנות סגורות (1→2, 3→4...) מחברים פוטנציאל */
  function buildNets(project) {
    var parent = {};
    function find(x) { if (parent[x] === undefined) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    var compBy = {};
    (project.components || []).forEach(function (c) { compBy[c.tag] = c; });
    var pinsByComp = {};
    (project.wires || []).forEach(function (w) {
      union(pinKey(w.from.tag, w.from.term), pinKey(w.to.tag, w.to.term));
      [w.from, w.to].forEach(function (e) { (pinsByComp[e.tag] = pinsByComp[e.tag] || {})[e.term] = 1; });
    });
    Object.keys(pinsByComp).forEach(function (tag) {
      var c = compBy[tag]; if (!c) return;
      var pass = { mcb: 1, fuse: 1, mpcb: 1, main_switch: 1, overload: 1, rcd: 1 }[c.type];
      if (!pass) return;
      Object.keys(pinsByComp[tag]).forEach(function (t) {
        var n = Number(t);
        if (/^\d+$/.test(t) && n <= 8 && n % 2 === 1 && pinsByComp[tag][String(n + 1)]) union(pinKey(tag, t), pinKey(tag, String(n + 1)));
        var lm = /^L([123])$/.exec(t);
        if (lm && pinsByComp[tag]['T' + lm[1]]) union(pinKey(tag, t), pinKey(tag, 'T' + lm[1]));
        if (t === 'N' && pinsByComp[tag]['N2']) union(pinKey(tag, 'N'), pinKey(tag, 'N2'));
      });
    });
    return find;
  }

  function seedFunc(w, compBy, settings) {
    var votes = [];
    [w.from, w.to].forEach(function (e) {
      var c = compBy[e.tag] || {};
      var r = termRole(c.type, e.term);
      var pot = String(w.potential || '').toUpperCase();
      if (r.kind === 'pe' || pot === 'PE') votes.push(['pe', 9]);
      else if (r.kind === 'neutral' || pot === 'N') votes.push(['neutral', 8]);
      else if (r.kind === 'power' && c.type !== 'button') votes.push(['power', 7]);
      else if (r.kind === 'pole') votes.push(['power', 4]);
      else if (r.kind === 'dc+' || /^\+?24V?$|^L\+$/.test(pot)) votes.push(['ctrl_dc', 6]);
      else if (r.kind === 'dc0' || /^0V$|^M$/.test(pot)) votes.push(['dc0', 6]);
      else if (r.kind === 'analog') votes.push(['signal', 5]);
      else if (r.kind === 'comm') votes.push(['comm', 5]);
      else if (r.kind === 'input' || r.kind === 'output' || r.kind === 'sig' || r.kind === 'io' || r.kind === 'coil' || r.kind === 'no' || r.kind === 'nc' || r.kind === 'load+' || r.kind === 'com' || r.kind === 'co') {
        votes.push([settings.control === 'dc24' ? 'ctrl_dc' : 'ctrl_ac', 3]);
      } else if (r.kind === 'coil0' || r.kind === 'load0') votes.push([settings.control === 'dc24' ? 'dc0' : 'neutral', 3]);
    });
    if (/^L[123]$/i.test(w.potential || '')) votes.push(['power', 7]);
    votes.sort(function (a, b) { return b[1] - a[1]; });
    return votes.length ? votes[0] : null;
  }

  function funcFromColor(c) {
    return { GNYE: 'pe', LBU: 'neutral', OG: 'foreign', WHBU: 'dc0', BU: 'ctrl_dc', RD: 'ctrl_ac' }[c] || '';
  }
  function funcFromPotential(v) {
    var t = String(v || '').toUpperCase().replace(/\s+/g, '');
    if (!t) return '';
    if (t === 'PE' || t === 'PEN') return 'pe';
    if (t === 'N') return 'neutral';
    if (/^(L[123]?|[UVW]1?|T[123])$/.test(t)) return 'power';
    if (/^(\+?24V?(DC)?|L\+|\+|P24|\+24VDC)$/.test(t)) return 'ctrl_dc';
    if (/^(0V|M|-|0VDC|GND|M24)$/.test(t)) return 'dc0';
    if (/230VAC|110VAC|24VAC/.test(t)) return 'ctrl_ac';
    return '';
  }

  /* ההשלמה המרכזית: מחזיר פרויקט חדש עם type לכל רכיב ו-func/color/section/wireType/explain לכל חוט */
  function enrich(project) {
    var p = JSON.parse(JSON.stringify(project || {}));
    var settings = settingsOf(p);
    p.components = p.components || [];
    p.wires = p.wires || [];
    var compBy = {};
    p.components.forEach(function (c) { c.tag = normTag(c.tag); compBy[c.tag] = c; });
    p.wires.forEach(function (w, i) {
      w.from = { tag: normTag(w.from && w.from.tag), term: normTerm(w.from && w.from.term) };
      w.to = { tag: normTag(w.to && w.to.tag), term: normTerm(w.to && w.to.term) };
      if (!w.id) w.id = 'w' + (i + 1) + uid('');
      [w.from, w.to].forEach(function (e) {
        if (e.tag && !compBy[e.tag]) { compBy[e.tag] = { tag: e.tag, name: '', auto: true }; p.components.push(compBy[e.tag]); }
      });
    });
    /* סוג רכיב */
    var termsBy = {};
    p.wires.forEach(function (w) { [w.from, w.to].forEach(function (e) { (termsBy[e.tag] = termsBy[e.tag] || []).push(e.term); }); });
    p.components.forEach(function (c) {
      if (!c.type || !C.TYPES[c.type]) c.type = inferType(c.tag, (c.name || '') + ' ' + (c.desc || ''), termsBy[c.tag]);
      if (c.type === 'meter' && c.location === 'door') c.type = 'door_meter';
      if (!c.name) c.name = typeInfo(c.type).he;
      c.zone = zoneOf(c);
    });
    /* תפקיד: מפורש → צבע מפורש → צומת → כללי הדקים */
    var find = buildNets(p);
    var netFunc = {};
    p.wires.forEach(function (w) {
      var f = C.FUNCS[w.func] ? w.func : '';
      var colorC = C.colorCode(w.color);
      var isField = (compBy[w.from.tag] || {}).zone === 'field' || (compBy[w.to.tag] || {}).zone === 'field';
      var seed = f ? [f, 10] : null;
      if (!seed && funcFromPotential(w.potential)) seed = [funcFromPotential(w.potential), 9.5];
      if (!seed && colorC && w.colorSource !== 'standard' && !isField && funcFromColor(colorC)) seed = [funcFromColor(colorC), 8];
      if (!seed) seed = seedFunc(w, compBy, settings);
      if (!seed) return;
      var net = find(pinKey(w.from.tag, w.from.term));
      if (!netFunc[net] || netFunc[net][1] < seed[1]) netFunc[net] = seed;
    });
    var fieldCable = function (w) { return compBy[w.from.tag].zone === 'field' || compBy[w.to.tag].zone === 'field'; };
    p.wires.forEach(function (w) {
      var net = find(pinKey(w.from.tag, w.from.term));
      if (!C.FUNCS[w.func]) {
        w.func = (netFunc[net] && netFunc[net][0]) || (settings.control === 'dc24' ? 'ctrl_dc' : 'ctrl_ac');
        w.funcInferred = true;
      }
      w.net = net;
      /* צבע */
      var cc = C.colorCode(w.color);
      if (cc) { w.color = cc; if (!w.colorSource) w.colorSource = 'drawing'; }
      else {
        w.color = C.FUNCS[w.func].color;
        if (w.func === 'power' && settings.phaseColors === 'iec60445') {
          var ph = /L?([123])$/.exec(String(w.potential || '')) || /^(?:L|T)?([123])$/.exec(w.from.term) || /^(?:L|T)?([123])$/.exec(w.to.term);
          var uvw = /^([UVW])1?$/.exec(w.from.term) || /^([UVW])1?$/.exec(w.to.term);
          var idx = ph ? Number(ph[1]) : uvw ? ' UVW'.indexOf(uvw[1]) : 0;
          if (!ph && !uvw) { var n = Number(w.from.term); if (n >= 1 && n <= 6) idx = Math.ceil(n / 2); }
          w.color = ['BK', 'BN', 'BK', 'GY'][idx] || 'BK';
        }
        w.colorSource = 'standard';
      }
      /* חתך */
      var sec = Number(w.section);
      if (!(sec > 0)) {
        sec = w.func === 'power' || w.func === 'neutral' ? Number(settings.powerSection) :
          w.func === 'pe' ? Number(settings.peSection) :
          w.func === 'signal' || w.func === 'comm' ? 0.5 : Number(settings.controlSection);
        w.sectionInferred = true;
      }
      w.section = sec;
      if (!w.wireType) { w.wireType = fieldCable(w) ? 'כבל לשטח' : C.wireTypeFor(sec, w.func); w.wireTypeInferred = true; }
      w.kind = w.kind || (w.from.tag === w.to.tag && compBy[w.from.tag].type === 'terminal' ? 'bridge' : fieldCable(w) ? 'field' : (compBy[w.from.tag].zone === 'door' || compBy[w.to.tag].zone === 'door') ? 'door' : 'internal');
    });
    /* PE חייב להיות באותו חתך של מוליכי הכוח לפחות עד 16 ממ"ר */
    var maxPower = 0;
    p.wires.forEach(function (w) { if (w.func === 'power' && w.section > maxPower) maxPower = w.section; });
    p.wires.forEach(function (w) { if (w.func === 'pe' && w.sectionInferred && maxPower) w.section = Math.max(w.section, Math.min(maxPower, 16)); });
    /* מספור */
    var used = {};
    p.wires.forEach(function (w) { if (w.no) used[w.no] = 1; });
    var nextNo = 1;
    p.wires.forEach(function (w) {
      if (!w.no) { while (used[String(nextNo)]) nextNo++; w.no = String(nextNo); used[w.no] = 1; w.noInferred = true; }
    });
    /* כמה חוטים על אותו הדק → שרוול כפול */
    var perPin = {};
    /* גשר מסרק יושב בתעלת הגשר של המהדק, לא בהדק עצמו — לא נספר כחוט נוסף בהדק */
    var isComb = function (w) { return /גשר מסרק|גשר בסיסי/.test(String(w.wireType || '')); };
    p.wires.forEach(function (w) { if (isComb(w)) return; [w.from, w.to].forEach(function (e) { var k = pinKey(e.tag, e.term); perPin[k] = (perPin[k] || 0) + 1; }); });
    var netPins = {};
    p.wires.forEach(function (w) {
      [w.from, w.to].forEach(function (e) {
        var l = (netPins[w.net] = netPins[w.net] || []);
        if (!l.some(function (x) { return x.tag === e.tag && x.term === e.term; })) l.push({ tag: e.tag, term: e.term });
      });
    });
    p.wires.forEach(function (w) {
      w.twinFrom = perPin[pinKey(w.from.tag, w.from.term)] > 1;
      w.twinTo = perPin[pinKey(w.to.tag, w.to.term)] > 1;
      w.auto = explainWire(w, compBy, settings, netPins[w.net] || []);
    });
    p.settings = settings;
    p.stats = stats(p);
    return p;
  }

  function stats(p) {
    var byFunc = {}, byColorSec = {}, meters = 0;
    (p.wires || []).forEach(function (w) {
      byFunc[w.func] = (byFunc[w.func] || 0) + 1;
      var k = w.color + '|' + w.section + '|' + w.wireType;
      byColorSec[k] = (byColorSec[k] || 0) + 1;
    });
    return { wires: (p.wires || []).length, components: (p.components || []).length, byFunc: byFunc, byColorSec: byColorSec, meters: meters };
  }

  /* ---------- הסבר לכל חוט ---------- */
  function endText(e, comp) {
    var info = typeInfo(comp.type);
    var role = termRole(comp.type, e.term);
    if (comp.type === 'io' && comp.io && role.kind === 'io') {
      role = comp.io === 'out' ? { side: role.side, role: 'יציאה דיגיטלית ' + e.term + ' של ' + comp.tag, kind: 'output' } : { side: role.side, role: 'כניסה דיגיטלית ' + e.term + ' של ' + comp.tag, kind: 'input' };
    }
    return { label: '\u2066' + e.tag + ':' + e.term + '\u2069', comp: comp, info: info, role: role, line: e.tag + ' (' + (comp.name || info.he) + ') — ' + role.role };
  }

  function explainWire(w, compBy, settings, netPins) {
    var A = endText(w.from, compBy[w.from.tag] || { tag: w.from.tag, type: 'other' });
    var B = endText(w.to, compBy[w.to.tag] || { tag: w.to.tag, type: 'other' });
    var f = C.FUNCS[w.func] || C.FUNCS.ctrl_dc;
    var col = C.COLORS[w.color] || C.COLORS.BK;
    /* כשקצה אחד הוא מהדק מעבר, מחפשים באותו צומת את הרכיב האמיתי שמאחוריו */
    var resolve = function (E, other) {
      if (!E.comp || E.comp.type !== 'terminal' || w.kind === 'bridge') return E;
      var cand = (netPins || []).filter(function (pn) {
        var c = compBy[pn.tag];
        return c && c.type !== 'terminal' && c.type !== 'pe_bar' && pn.tag !== other.comp.tag;
      });
      if (!cand.length) return E;
      var r = endText(cand[0], compBy[cand[0].tag]);
      r.via = E.label;
      r.label = r.label + ' (דרך מהדק ' + E.label + ')';
      return r;
    };
    var purpose = purposeOf(w, resolve(A, B), resolve(B, A), settings);
    var fer = C.ferrule(w.section, false);
    var ferTwin = C.ferrule(w.section, true);
    var steps = [];
    steps.push('חותכים ' + (w.wireType || 'חוט') + ' ' + C.fmtSection(w.section) + ' ממ"ר בצבע ' + col.he + (w.length ? ' באורך כ-' + Math.round(w.length / 10) + ' ס"מ' : '') + '.');
    steps.push('מסמנים את שני הקצוות בשרוול סימון: ' + (w.no || '') + (w.no ? ' / ' : '') + B.label + ' בצד של ' + A.label + ', ו' + A.label + ' בצד של ' + B.label + '.');
    steps.push('מקלפים ' + fer.strip + ' מ"מ ולוחצים ' + (w.twinFrom || w.twinTo ? ferTwin.text + ' בקצה המשותף, ו-' : '') + fer.text + '.');
    steps.push('מחברים ל' + A.label + ' (' + A.role.role + '), מעבירים בתעלה ומחברים ל' + B.label + ' (' + B.role.role + ').');
    steps.push('מהדקים: ' + C.torqueFor(w.section, (compBy[w.to.tag] || {}).type, settings.termTech) + '. מושכים קלות לבדיקה.');
    return {
      title: 'חוט ' + (w.no || '') + ' · ' + f.he,
      from: A.line, to: B.line, purpose: purpose,
      color: col.he + (w.colorSource === 'standard' ? ' (לפי IEC 60204-1, לא צוין בתכנית)' : ''),
      ferrule: fer, ferruleTwin: ferTwin,
      torque: C.torqueFor(w.section, (compBy[w.to.tag] || {}).type, settings.termTech),
      wireTypeHe: C.wireTypeHe(w.wireType),
      awg: C.AWG[w.section] ? 'AWG ' + C.AWG[w.section] : '',
      steps: steps,
      check: checkOf(w, A, B)
    };
  }

  function purposeOf(w, A, B, settings) {
    var a = A.comp, b = B.comp, ra = A.role, rb = B.role;
    var pair = function (x, y) { return [[A, B], [B, A]].find(function (p) { return x(p[0]) && y(p[1]); }); };
    var isT = function (t) { return function (e) { return e.comp.type === t; }; };
    var any = function () { return true; };
    if (w.func === 'pe') return 'מוליך הארקה: מחבר את ' + (a.type === 'pe_bar' ? b.tag : a.tag) + ' לפס ההארקה. אם יש קצר לגוף, הזרם עובר דרכו וההגנה מנתקת. חובה לחבר ולבדוק רציפות לפני הפעלה.';
    if (w.kind === 'bridge') return 'גשר בין מהדקים ' + A.label + ' ו' + B.label + ' באותו פס. מחלק את אותו פוטנציאל (' + (C.FUNCS[w.func] || {}).short + ') לכמה נקודות. אפשר להשתמש בגשר מסרק במקום חוט.';
    var p;
    if ((p = pair(function (e) { return e.role.kind === 'coil'; }, any))) return 'מזין את סליל ' + p[0].comp.tag + ' (' + (p[0].comp.name || p[0].info.he) + ') מ' + p[1].label + '. כשיש מתח בחוט הזה הסליל נמשך והמגעים של ' + p[0].comp.tag + ' מחליפים מצב.';
    if ((p = pair(function (e) { return e.role.kind === 'coil0'; }, any))) return 'חזרת הסליל (A2) של ' + p[0].comp.tag + ' אל ' + (settings.control === 'dc24' ? '‎0V' : 'האפס') + '. בלי החוט הזה הסליל לא יופעל.';
    if ((p = pair(function (e) { return e.role.kind === 'input'; }, any))) return 'מעביר לבקר בכניסה ' + p[0].label + ' את המצב של ' + p[1].comp.tag + ' (' + (p[1].comp.name || p[1].info.he) + '). כשהמגע סגור, בכניסה יש ‎24V והנורית שלה בבקר נדלקת.';
    if ((p = pair(function (e) { return e.role.kind === 'output'; }, any))) return 'יציאה של הבקר (' + p[0].label + ') אל ' + p[1].comp.tag + ' (' + (p[1].comp.name || p[1].info.he) + '). כשהתכנית מדליקה את היציאה, ' + p[1].comp.tag + ' מקבל מתח.';
    if ((p = pair(isT('motor'), any))) return 'מוליך כוח למנוע ' + p[0].comp.tag + ' (' + p[0].role.role + '). מגיע מ' + p[1].label + '. סדר הפאזות קובע את כיוון הסיבוב.';
    if (w.func === 'power') return 'מוליך כוח (' + (w.potential || 'פאזה') + ') מ' + A.label + ' אל ' + B.label + '. נושא את זרם העומס, ולכן החתך שלו נקבע לפי ההגנה שלפניו.';
    if (w.func === 'neutral') return 'מוליך אפס (N) מ' + A.label + ' אל ' + B.label + '. מחזיר את הזרם של הצרכן החד-פאזי.';
    if (w.func === 'ctrl_dc') return 'מתח פיקוד ' + (w.potential && !/^\+?24V?$/i.test(w.potential) ? w.potential : '‎+24V') + ' מ' + A.label + ' אל ' + B.label + '. ' + (A.role.kind === 'no' || B.role.kind === 'no' ? 'עובר דרך מגע פתוח (NO): המתח ממשיך רק כשהמגע נסגר.' : A.role.kind === 'nc' || B.role.kind === 'nc' ? 'עובר דרך מגע סגור (NC): המתח נקטע כשהמגע נפתח (למשל בלחיצת עצור או חירום).' : 'מחלק את מתח הפיקוד לרכיב הבא.');
    if (w.func === 'dc0') return 'קו ‎0V של הפיקוד מ' + A.label + ' אל ' + B.label + '. סוגר את המעגל של מתח הפיקוד.';
    if (w.func === 'ctrl_ac') return 'מעגל פיקוד AC מ' + A.label + ' אל ' + B.label + '.';
    if (w.func === 'foreign') return 'מגע יבש בין ' + A.label + ' ל-' + B.label + '. המתח בחוט מגיע מהציוד בשטח (בקר השער או הדלת), ולכן הוא נשאר חי גם כשהמפסק הראשי של הארון מנותק. חוט כתום, וזהירות בעבודה.';
    if (w.func === 'signal') return 'אות אנלוגי / מדידה מ' + A.label + ' אל ' + B.label + '. להרחיק מכבלי כוח ולחבר סיכוך בצד אחד.';
    if (w.func === 'comm') return 'קו תקשורת מ' + A.label + ' אל ' + B.label + '.';
    return 'חיבור מ' + A.label + ' אל ' + B.label + '.';
  }

  function checkOf(w, A, B) {
    if (w.func === 'pe') return 'בדיקת רציפות הארקה: התנגדות נמוכה מאוד (מתחת ל-0.1 Ω בדרך כלל) בין ' + A.label + ' ל' + B.label + ' (IEC 60204-1 סעיף 18.2).';
    if (w.func === 'power' || w.func === 'neutral') return 'רציפות (צפצוף) בין ' + A.label + ' ל' + B.label + ', ובידוד מול PE ומול פאזות אחרות: 500V DC, לפחות 1 MΩ.';
    return 'רציפות (צפצוף) בין ' + A.label + ' ל' + B.label + ' ובדיקה שאין קצר ל-0V או ל-PE.';
  }

  /* ---------- פריסת הארון ---------- */
  var STD_W = [300, 400, 500, 600, 800, 1000, 1200];
  var STD_H = [400, 500, 600, 700, 800, 1000, 1200, 1400, 1600, 1800, 2000];
  function roundUp(v, arr) { for (var i = 0; i < arr.length; i++) if (arr[i] >= v) return arr[i]; return Math.ceil(v / 100) * 100; }

  function compSize(c, termsBy) {
    var info = typeInfo(c.type);
    var terms = (termsBy[c.tag] || []).slice();
    if (c.type === 'terminal') {
      var uniq = {}; terms.forEach(function (t) { uniq[t] = 1; });
      var n = Math.max(1, Object.keys(uniq).length);
      return { w: Math.round(n * 6.2 + 8), h: info.h };
    }
    if (c.type === 'pe_bar') {
      var u = {}; terms.forEach(function (t) { u[t] = 1; });
      return { w: Math.max(60, Object.keys(u).length * 12 + 20), h: info.h };
    }
    if (info.perPole) {
      var poles = 0;
      terms.forEach(function (t) { var n2 = Number(t); if (n2 && n2 <= 8) poles = Math.max(poles, Math.ceil(n2 / 2)); if (/^N/.test(t)) poles = Math.max(poles, 2); });
      return { w: info.perPole * Math.max(1, poles), h: info.h };
    }
    if (c.type === 'plc') {
      var io = terms.filter(function (t) { return /^%?[IQ]\d|^D[IOQ]|^A[IQ]/i.test(t); }).length;
      return { w: Math.max(info.w, 90 + Math.ceil(io / 14) * 20), h: info.h };
    }
    return { w: info.w, h: info.h };
  }

  function layout(project) {
    var p = project;
    var settings = settingsOf(p);
    var compBy = {};
    (p.components || []).forEach(function (c) { compBy[c.tag] = c; });
    var termsBy = {};
    (p.wires || []).forEach(function (w) { [w.from, w.to].forEach(function (e) { (termsBy[e.tag] = termsBy[e.tag] || []).push(e.term); }); });
    /* הדקים שהוגדרו לרכיב (רכיב חדש בלי חוטים עדיין) */
    (p.components || []).forEach(function (c) { (c.terms || []).forEach(function (t) { (termsBy[c.tag] = termsBy[c.tag] || []).push(t); }); });
    var M = 30, SD = 45, DUCT = 60, GAP = 22;
    var cab = (p.components || []).filter(function (c) { return c.zone === 'cabinet'; });
    var door = (p.components || []).filter(function (c) { return c.zone === 'door'; });
    var field = (p.components || []).filter(function (c) { return c.zone === 'field'; });
    /* קבוצות לפי שורה, מסודרות לפי תג; ממסר תרמי צמוד למגען שלו */
    var rows = [[], [], [], []];
    cab.sort(function (a, b) { return natCmp(tagBody(a.tag), tagBody(b.tag)); });
    cab.forEach(function (c) {
      var r = c.rail != null && c.rail !== '' && !isNaN(c.rail) ? Math.max(0, Math.min(3, Number(c.rail) - 1)) : typeInfo(c.type).row;
      rows[r == null ? 1 : r].push(c);
    });
    var ORDER = ['main_switch', 'rcd', 'mcb', 'fuse', 'transformer', 'psu', 'socket', 'meter', 'plc', 'io', 'relay', 'timer', 'thermostat', 'other'];
    [0, 1].forEach(function (ri) {
      rows[ri].sort(function (a, b) { var d = ORDER.indexOf(a.type) - ORDER.indexOf(b.type); return d || natCmp(tagBody(a.tag), tagBody(b.tag)); });
    });
    rows[2] = chainRow(rows[2], p.wires || []);
    rows[3].sort(function (a, b) { return (a.type === 'pe_bar') - (b.type === 'pe_bar') || natCmp(tagBody(a.tag), tagBody(b.tag)); });
    var sizes = {};
    cab.forEach(function (c) { sizes[c.tag] = compSize(c, termsBy); });
    var rowWidth = function (r) { return r.reduce(function (s, c, i) { return s + sizes[c.tag].w + (i ? groupGap(r[i - 1], c) : 0); }, 0); };
    var widest = Math.max.apply(null, rows.map(rowWidth).concat([200]));
    var plateW = settings.plateWidth === 'auto' ? roundUp(Math.min(widest, 1100) + 2 * (M + SD + 15), STD_W) : Number(settings.plateWidth) || 600;
    var usable = plateW - 2 * (M + SD + 15);
    /* גלישה: שורה ארוכה מתחלקת לכמה מסילות */
    var rails = [];
    rows.forEach(function (r, ri) {
      var cur = [], w = 0;
      r.forEach(function (c) {
        var cw = sizes[c.tag].w + (cur.length ? groupGap(cur[cur.length - 1], c) : 0);
        if (cur.length && w + cw > usable) { rails.push({ row: ri, items: cur }); cur = []; w = 0; cw = sizes[c.tag].w; }
        cur.push(c); w += cw;
      });
      if (cur.length) rails.push({ row: ri, items: cur });
    });
    var y = M, ducts = [], comps = {};
    var x0 = M + SD + 15;
    ducts.push({ x: M + SD, y: y, w: plateW - 2 * (M + SD), h: DUCT, kind: 'h', idx: 0 });
    y += DUCT + GAP;
    rails.forEach(function (rail, i) {
      var hMax = Math.max.apply(null, rail.items.map(function (c) { return sizes[c.tag].h; }));
      var cy = y + hMax / 2;
      var x = x0;
      rail.y = cy; rail.top = y; rail.h = hMax;
      rail.items.forEach(function (c, j) {
        if (j) x += groupGap(rail.items[j - 1], c);
        var s = sizes[c.tag];
        comps[c.tag] = { tag: c.tag, x: x, y: cy - s.h / 2, w: s.w, h: s.h, zone: 'cabinet', rail: i, type: c.type };
        x += s.w;
      });
      rail.x1 = x0 - 10; rail.x2 = Math.max(x + 10, x0 + 100);
      y += hMax + GAP;
      ducts.push({ x: M + SD, y: y, w: plateW - 2 * (M + SD), h: DUCT, kind: 'h', idx: i + 1 });
      y += DUCT + GAP;
    });
    var plateH = roundUp(y - GAP + M, STD_H);
    ducts.push({ x: M, y: M, w: SD, h: plateH - 2 * M, kind: 'v', side: 'L' });
    ducts.push({ x: plateW - M - SD, y: M, w: SD, h: plateH - 2 * M, kind: 'v', side: 'R' });
    /* דלת: מימין לפלטה. שטח: מתחת לפלטה */
    var doorBox = null;
    if (door.length) {
      var cols = Math.max(1, Math.min(3, Math.ceil(door.length / 6)));
      var dw = Math.max(140, cols * 80 + 40);
      doorBox = { x: plateW + 70, y: 0, w: dw, h: Math.max(240, Math.ceil(door.length / cols) * 75 + 60) };
      door.sort(function (a, b) { return natCmp(tagBody(a.tag), tagBody(b.tag)); });
      door.forEach(function (c, i) {
        var info = typeInfo(c.type);
        var col = i % cols, row = Math.floor(i / cols);
        comps[c.tag] = { tag: c.tag, x: doorBox.x + 30 + col * 80, y: doorBox.y + 45 + row * 75, w: info.w, h: info.h, zone: 'door', type: c.type };
      });
    }
    var fieldBox = null;
    if (field.length) {
      field.sort(function (a, b) { return natCmp(tagBody(a.tag), tagBody(b.tag)); });
      var fx = M, fy = plateH + 140, rowH = 0, maxX = Math.max(plateW, doorBox ? doorBox.x + doorBox.w : 0);
      field.forEach(function (c) {
        var info = typeInfo(c.type);
        if (fx + info.w > maxX && fx > M) { fx = M; fy += rowH + 70; rowH = 0; }
        comps[c.tag] = { tag: c.tag, x: fx, y: fy, w: info.w, h: info.h, zone: 'field', type: c.type };
        fx += info.w + 50; rowH = Math.max(rowH, info.h);
      });
      fieldBox = { x: 0, y: plateH + 100, w: maxX, h: fy + rowH + 40 - (plateH + 100) };
    }
    /* פינים */
    var pins = {};
    var sideOf = function (c, term, other) {
      var oc = compBy[other.tag] || {};
      if (c.type === 'terminal' || c.type === 'pe_bar') return oc.zone === 'field' || oc.zone === 'door' ? 'bottom' : 'top';
      var r = termRole(c.type, term);
      return r.side === 'top' || r.side === 'bottom' ? r.side : '';
    };
    var pinsOf = {};
    (p.wires || []).forEach(function (w) {
      [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
        var e = pr[0], c = compBy[e.tag];
        if (!c || !comps[c.tag]) return;
        var key = pinKey(e.tag, e.term);
        var s = sideOf(c, e.term, pr[1]);
        var o = (pinsOf[c.tag] = pinsOf[c.tag] || { top: {}, bottom: {}, any: {}, terms: {} });
        o.terms[e.term] = 1;
        if (c.type === 'terminal' || c.type === 'pe_bar') { (o[s] || o.any)[e.term + '|' + s] = { term: e.term, side: s }; }
        else (s ? o[s] : o.any)[e.term] = { term: e.term, side: s };
        if (!pins[key]) pins[key] = {};
      });
    });
    (p.components || []).forEach(function (c) {
      if (!c.terms || !c.terms.length || !comps[c.tag]) return;
      var o = (pinsOf[c.tag] = pinsOf[c.tag] || { top: {}, bottom: {}, any: {}, terms: {} });
      c.terms.forEach(function (t) {
        if (o.terms[t]) return;
        o.terms[t] = 1;
        var r = termRole(c.type, t), sd = r.side === 'top' || r.side === 'bottom' ? r.side : null;
        if (c.type === 'terminal' || c.type === 'pe_bar') o[sd || 'any'][t + '|' + (sd || 'any')] = { term: t, side: sd };
        else (sd ? o[sd] : o.any)[t] = { term: t, side: sd };
        var key = pinKey(c.tag, t);
        if (!pins[key]) pins[key] = {};
      });
    });
    Object.keys(pinsOf).forEach(function (tag) {
      var c = compBy[tag], b = comps[tag], o = pinsOf[tag];
      if (c.type === 'terminal' || c.type === 'pe_bar') {
        var list = Object.keys(o.terms).sort(natCmp);
        var step = c.type === 'terminal' ? 6.2 : 12;
        list.forEach(function (t, i) {
          var x = b.x + 4 + step * (i + 0.5) + (c.type === 'pe_bar' ? 6 : 0);
          pins[pinKey(tag, t)] = { x: x, top: b.y, bottom: b.y + b.h, slice: true };
        });
        return;
      }
      if (b.zone === 'door') {
        var tl = Object.keys(o.terms).sort(natCmp);
        tl.forEach(function (t, i) { pins[pinKey(tag, t)] = { x: b.x, y: b.y + (i + 1) * b.h / (tl.length + 1), side: 'left' }; });
        return;
      }
      if (b.zone === 'field') {
        var fl = Object.keys(o.terms).sort(natCmp);
        fl.forEach(function (t, i) { pins[pinKey(tag, t)] = { x: b.x + (i + 1) * b.w / (fl.length + 1), y: b.y, side: 'top' }; });
        return;
      }
      /* פינים בלי צד מתחלקים לצד הפנוי יותר */
      Object.keys(o.any).forEach(function (t) {
        var s = Object.keys(o.top).length <= Object.keys(o.bottom).length ? 'top' : 'bottom';
        o[s][t] = { term: t, side: s };
      });
      ['top', 'bottom'].forEach(function (s) {
        var l = Object.keys(o[s]).sort(natCmp);
        l.forEach(function (t, i) {
          pins[pinKey(tag, t)] = { x: b.x + (i + 0.5) * b.w / l.length, y: s === 'top' ? b.y : b.y + b.h, side: s };
        });
      });
    });
    var L = { plate: { w: plateW, h: plateH }, rails: rails, ducts: ducts, comps: comps, pins: pins, door: doorBox, field: fieldBox, margin: M, sideDuct: SD };
    L.routes = route(p, L, compBy);
    L.bounds = { w: Math.max(plateW, doorBox ? doorBox.x + doorBox.w + 20 : 0), h: fieldBox ? fieldBox.y + fieldBox.h + 20 : plateH + 20 };
    return L;
  }

  function groupGap(a, b) { return a.type === b.type ? (a.type === 'terminal' ? 4 : 1) : 10; }

  /* שורת הכוח: מגן מנוע → מגען → ממסר תרמי של אותו מנוע, אחד ליד השני */
  function chainRow(list, wires) {
    var rank = { mpcb: 0, softstarter: 1, vfd: 1, contactor: 2, overload: 3 };
    var sorted = list.slice().sort(function (a, b) { return ((rank[a.type] || 1) - (rank[b.type] || 1)) || natCmp(tagBody(a.tag), tagBody(b.tag)); });
    var inRow = {}; list.forEach(function (c) { inRow[c.tag] = c; });
    var adj = {};
    wires.forEach(function (w) {
      if (inRow[w.from.tag] && inRow[w.to.tag] && w.from.tag !== w.to.tag) {
        (adj[w.from.tag] = adj[w.from.tag] || []).push(w.to.tag);
        (adj[w.to.tag] = adj[w.to.tag] || []).push(w.from.tag);
      }
    });
    var out = [], seen = {};
    var visit = function (c) {
      if (seen[c.tag]) return;
      seen[c.tag] = 1; out.push(c);
      (adj[c.tag] || []).map(function (t) { return inRow[t]; })
        .sort(function (a, b) { return ((rank[a.type] || 1) - (rank[b.type] || 1)) || natCmp(a.tag, b.tag); })
        .forEach(function (n) { if ((rank[n.type] || 1) >= (rank[c.type] || 1)) visit(n); });
    };
    sorted.forEach(visit);
    return out;
  }

  function pairOverloads(list, wires) {
    var ol = list.filter(function (c) { return c.type === 'overload'; });
    if (!ol.length) return list;
    var rest = list.filter(function (c) { return c.type !== 'overload'; });
    ol.forEach(function (o) {
      var link = null;
      wires.forEach(function (w) {
        if (w.from.tag === o.tag && rest.some(function (c) { return c.tag === w.to.tag && c.type === 'contactor'; })) link = w.to.tag;
        if (w.to.tag === o.tag && rest.some(function (c) { return c.tag === w.from.tag && c.type === 'contactor'; })) link = w.from.tag;
      });
      var i = link ? rest.findIndex(function (c) { return c.tag === link; }) : -1;
      if (i >= 0) rest.splice(i + 1, 0, o); else rest.push(o);
    });
    return rest;
  }

  /* ---------- ניתוב: מהפין לתעלה הקרובה, לאורך התעלה, דרך תעלה צדדית ואל היעד ---------- */
  function route(p, L, compBy) {
    var routes = {};
    var hDucts = L.ducts.filter(function (d) { return d.kind === 'h'; });
    var vL = L.ducts.find(function (d) { return d.side === 'L'; });
    var vR = L.ducts.find(function (d) { return d.side === 'R'; });
    var lane = {};
    var laneOf = function (key, n) { lane[key] = (lane[key] || 0) + 1; return ((lane[key] - 1) % n) - (n - 1) / 2; };
    var ductFor = function (pin, side, comp) {
      var railIdx = comp.rail || 0;
      return side === 'top' ? hDucts[railIdx] : hDucts[Math.min(railIdx + 1, hDucts.length - 1)];
    };
    var anchor = function (e, other) {
      var c = compBy[e.tag], b = L.comps[e.tag], pin = L.pins[pinKey(e.tag, e.term)];
      if (!c || !b || !pin) return null;
      if (b.zone !== 'cabinet') return { zone: b.zone, x: pin.x, y: pin.y, side: pin.side };
      var oc = compBy[other.tag] || {};
      var side = pin.slice ? ((oc.zone === 'field' || oc.zone === 'door') ? 'bottom' : 'top') : pin.side;
      var y = pin.slice ? (side === 'top' ? pin.top : pin.bottom) : pin.y;
      var d = ductFor(pin, side, b);
      return { zone: 'cabinet', x: pin.x, y: y, side: side, duct: d };
    };
    (p.wires || []).forEach(function (w) {
      var A = anchor(w.from, w.to), B = anchor(w.to, w.from);
      if (!A || !B) return;
      var pts;
      var off = laneOf('all', 9) * 4;
      if (w.kind === 'bridge' || (A.zone === 'cabinet' && B.zone === 'cabinet' && w.from.tag === w.to.tag && L.pins[pinKey(w.from.tag, w.from.term)].slice)) {
        var yb = A.y - 8;
        pts = [[A.x, A.y], [A.x, yb], [B.x, yb], [B.x, B.y]];
      } else if (A.zone === 'cabinet' && B.zone === 'cabinet') {
        pts = cabRoute(A, B, off, vL, vR, laneOf);
      } else if (A.zone !== 'cabinet' && B.zone !== 'cabinet') {
        pts = [[A.x, A.y], [(A.x + B.x) / 2, A.y], [(A.x + B.x) / 2, B.y], [B.x, B.y]];
      } else {
        var cabE = A.zone === 'cabinet' ? A : B, ext = A.zone === 'cabinet' ? B : A;
        var dy = cabE.duct.y + cabE.duct.h / 2 + off;
        var seg;
        if (ext.zone === 'door') {
          var vx = vR.x + vR.w / 2 + laneOf('vR', 7) * 4;
          var exitY = Math.max(L.margin + 40, Math.min(ext.y, L.plate.h - 60));
          seg = [[cabE.x, cabE.y], [cabE.x, dy], [vx, dy], [vx, exitY], [L.plate.w + 20, exitY], [ext.x - 15, ext.y], [ext.x, ext.y]];
        } else {
          var last = L.ducts.filter(function (d) { return d.kind === 'h'; }).slice(-1)[0];
          var ly = last.y + last.h / 2 + off;
          var gx = Math.max(L.margin + 60, Math.min(cabE.x, L.plate.w - 60));
          if (cabE.duct === last) seg = [[cabE.x, cabE.y], [cabE.x, ly], [gx, ly], [gx, L.plate.h + 40], [ext.x, L.plate.h + 40 + Math.abs(off) * 3], [ext.x, ext.y]];
          else {
            var useL = cabE.x < L.plate.w / 2;
            var sx = (useL ? vL.x + vL.w / 2 : vR.x + vR.w / 2) + laneOf(useL ? 'vL' : 'vR', 7) * 4;
            seg = [[cabE.x, cabE.y], [cabE.x, dy], [sx, dy], [sx, ly], [gx, ly], [gx, L.plate.h + 40], [ext.x, L.plate.h + 40 + Math.abs(off) * 3], [ext.x, ext.y]];
          }
        }
        pts = cabE === A ? seg : seg.slice().reverse();
      }
      var len = 0;
      for (var i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      var internal = A.zone === 'cabinet' && B.zone === 'cabinet';
      var toDoor = !internal && A.zone !== 'field' && B.zone !== 'field';
      /* לדלת: המסלול בארון + לולאת ציר של כ-40 ס"מ. לשטח: לפי המרחק בפועל */
      routes[w.id] = { pts: pts, len: internal ? Math.ceil((len * 1.1 + 100) / 10) * 10 : toDoor ? Math.ceil((len * 1.1 + 400) / 10) * 10 : null, ext: !internal && !toDoor, door: toDoor };
    });
    return routes;
  }

  function cabRoute(A, B, off, vL, vR, laneOf) {
    var dA = A.duct, dB = B.duct;
    var yA = dA.y + dA.h / 2 + off, yB = dB.y + dB.h / 2 + off;
    if (dA === dB) return [[A.x, A.y], [A.x, yA], [B.x, yA], [B.x, B.y]];
    var cL = Math.abs(A.x - vL.x) + Math.abs(B.x - vL.x), cR = Math.abs(A.x - vR.x) + Math.abs(B.x - vR.x);
    var useL = cL <= cR;
    var sx = (useL ? vL.x + vL.w / 2 : vR.x + vR.w / 2) + laneOf(useL ? 'vL' : 'vR', 7) * 4;
    return [[A.x, A.y], [A.x, yA], [sx, yA], [sx, yB], [B.x, yB], [B.x, B.y]];
  }

  /* באילו תעלות עובר החוט, לפי הסדר: לתיאור המסלול בעברית ובאנגלית */
  function routeDucts(L, id) {
    var r = L && L.routes[id];
    if (!r) return [];
    var hd = L.ducts.filter(function (d) { return d.kind === 'h'; }), vd = L.ducts.filter(function (d) { return d.kind === 'v'; });
    var out = [];
    var add = function (x) { var l = out[out.length - 1]; if (!l || l.kind !== x.kind || l.n !== x.n || l.side !== x.side) out.push(x); };
    for (var i = 1; i < r.pts.length; i++) {
      var a = r.pts[i - 1], b = r.pts[i];
      if (a[0] > L.plate.w || b[0] > L.plate.w) { add({ kind: 'door' }); continue; }
      if (a[1] > L.plate.h || b[1] > L.plate.h) { add({ kind: 'field' }); continue; }
      if (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(a[0] - b[0]) > 1) {
        var h = hd.find(function (d) { return a[1] >= d.y - 1 && a[1] <= d.y + d.h + 1; });
        if (h) add({ kind: 'h', n: h.idx + 1 });
      } else if (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) > 1) {
        var v = vd.find(function (d) { return a[0] >= d.x - 1 && a[0] <= d.x + d.w + 1; });
        if (v) add({ kind: 'v', side: v.side });
      }
    }
    return out;
  }
  function routeHe(L, id) {
    return routeDucts(L, id).map(function (d) {
      return d.kind === 'h' ? 'תעלה אופקית ' + d.n : d.kind === 'v' ? 'תעלה אנכית ' + (d.side === 'L' ? 'שמאלית' : 'ימנית') : d.kind === 'door' ? 'לולאת הציר לדלת' : 'יציאה מתחתית הארון לשטח';
    });
  }

  /* ---------- סדר החיווט ושלבי ההרכבה ---------- */
  var GROUPS = [
    { id: 'power', he: 'מעגלי כוח', funcs: ['power'], why: 'מתחילים מהחוטים העבים: קשה לכופף אותם אחר כך כשהתעלות מלאות.' },
    { id: 'neutral', he: 'אפס (N)', funcs: ['neutral'], why: 'מוליכי האפס של הצרכנים החד-פאזיים.' },
    { id: 'ctrl', he: 'מתח פיקוד והגנות פיקוד', funcs: ['ctrl_ac', 'ctrl_dc', 'dc0', 'foreign'], why: 'הזנת הפיקוד: ספק, נתיכים, בקר, סלילים ומגעי עזר.' },
    { id: 'signal', he: 'אותות ותקשורת', funcs: ['signal', 'comm'], why: 'כבלים מסוככים בנפרד מכבלי הכוח.' },
    { id: 'pe', he: 'הארקת הגנה (PE)', funcs: ['pe'], why: 'כל גוף מתכתי ורכיב עם הדק PE מחובר לפס ההארקה.' }
  ];

  function wireOrder(p, L) {
    var compBy = {};
    (p.components || []).forEach(function (c) { compBy[c.tag] = c; });
    var pos = function (w) {
      var b = L && L.comps[w.from.tag];
      return b ? (b.rail || 0) * 10000 + b.x : 0;
    };
    var out = [];
    var kindRank = { internal: 0, bridge: 1, door: 2, field: 3 };
    GROUPS.forEach(function (g) {
      var list = (p.wires || []).filter(function (w) { return g.funcs.indexOf(w.func) >= 0; });
      list.sort(function (a, b) { return (kindRank[a.kind] - kindRank[b.kind]) || (pos(a) - pos(b)) || natCmp(a.no, b.no); });
      if (list.length) out.push({ group: g, wires: list });
    });
    return out;
  }

  function assemblySteps(p, L) {
    var steps = [];
    var count = function (z) { return (p.components || []).filter(function (c) { return c.zone === z; }).length; };
    steps.push({ id: 'prep', title: 'הכנה ובדיקת חלקים', body: [
      'מוודאים שהתכנית בגרסה האחרונה ושהמתח מנותק בכל מקום שעובדים בו.',
      'בודקים מול רשימת הרכיבים: ' + count('cabinet') + ' רכיבים בארון, ' + count('door') + ' בדלת, ' + count('field') + ' בשטח.',
      'כלים: מקדחה, מסור לתעלות ולמסילות, מקלף, לוחץ שרוולים (Ferrule crimper), מברגים מבודדים, מברגת מומנט, מדפסת שרוולי סימון, מולטימטר ומגר (Insulation tester).'
    ] });
    steps.push({ id: 'plate', title: 'סימון הפלטה', body: [
      'פלטת הרכבה ' + L.plate.w + '×' + L.plate.h + ' מ"מ (רוחב×גובה).',
      'מסמנים את קווי המסילות והתעלות לפי מסך הפריסה, ומשאירים מרווח של 20 מ"מ לפחות בין תעלה לרכיב.'
    ] });
    var hd = L.ducts.filter(function (d) { return d.kind === 'h'; });
    var vd = L.ducts.filter(function (d) { return d.kind === 'v'; });
    steps.push({ id: 'ducts', title: 'התקנת תעלות חיווט', body: [
      hd.length + ' תעלות אופקיות 60×60 מ"מ, באורך ' + Math.round(hd[0].w) + ' מ"מ כל אחת.',
      vd.length + ' תעלות אנכיות 40×60 מ"מ, באורך ' + Math.round(vd[0].h) + ' מ"מ כל אחת.',
      'חיתוך ב-45° בפינות, קיבוע בניטים או בברגים כל 300 מ"מ בערך. המכסים נשארים בצד עד סוף החיווט.'
    ] });
    steps.push({ id: 'rails', title: 'התקנת מסילות DIN', body: L.rails.map(function (r, i) {
      return 'מסילה ' + (i + 1) + ' (' + C.ROWS[r.row] + '): TS35 באורך ' + Math.round(r.x2 - r.x1) + ' מ"מ, במרכז בגובה ' + Math.round(r.y) + ' מ"מ מראש הפלטה.';
    }) });
    L.rails.forEach(function (r, i) {
      steps.push({ id: 'mount' + i, title: 'הרכבת רכיבים במסילה ' + (i + 1) + ': ' + C.ROWS[r.row], tags: r.items.map(function (c) { return c.tag; }), body: [
        'משמאל לימין: ' + r.items.map(function (c) { return '\u2066' + c.tag + '\u2069 (' + (c.name || typeInfo(c.type).he) + ')'; }).join(' · ') + '.',
        r.row === 3 ? 'בפסי המהדקים: לוחיות קצה (End plate) ותפסני קצה (End stop) בשני הצדדים, ושלט עם שם הפס.' : 'תפסן קצה (End stop) בשני צידי כל קבוצה. מדביקים מדבקת תג מעל כל רכיב.'
      ] });
    });
    if (count('door')) {
      steps.push({ id: 'door', title: 'הרכבת רכיבי הדלת', tags: (p.components || []).filter(function (c) { return c.zone === 'door'; }).map(function (c) { return c.tag; }), body: [
        'קידוח חורים בקוטר 22.5 מ"מ ללחצנים ולנוריות (ניקוב עם Punch עדיף), לפי מסך הפריסה.',
        'מרכיבים את הרכיבים והשלטים, ומחברים את פס ההארקה של הדלת לגוף הארון בפס הארקה גמיש.',
        'החוטים לדלת עוברים בצרור גמיש עם סליל הגנה, בצד הצירים, כדי שהדלת תיפתח בלי למתוח אותם.'
      ] });
    }
    wireOrder(p, L).forEach(function (g) {
      steps.push({ id: 'wire-' + g.group.id, title: 'חיווט: ' + g.group.he + ' (' + g.wires.length + ' חוטים)', wires: g.wires.map(function (w) { return w.id; }), body: [g.group.why, 'עובדים במצב "חיווט שלב אחר שלב": כל חוט עם צבע, חתך, שרוול, ציון מאיפה ולאן, והסבר.'] });
    });
    steps.push({ id: 'finish', title: 'גמר', body: [
      'מסדרים את החוטים בתעלות, סוגרים מכסים ומדביקים שלטי אזהרה (מתח, מתח זר).',
      'מכניסים את התכנית המעודכנת לכיס התכניות בדלת.'
    ] });
    steps.push({ id: 'tests', title: 'בדיקות לפני הפעלה (IEC 60204-1 פרק 18 / IEC 61439)', body: [
      'בדיקה ויזואלית: כל חוט מסומן בשני הקצוות, אין נחושת חשופה מחוץ למהדק, אין שרוול חסר.',
      'משיכה קלה בכל חוט, ובדיקת מומנט במהדקי בורג בכוח.',
      'רציפות הארקה מכל גוף מתכתי ומכל הדק PE לפס ההארקה.',
      'בידוד: 500V DC בין כל פאזה ל-PE, ערך מינימלי 1 MΩ. מנתקים לפני כן ספקים, בקרים וממירים.',
      'הפעלה ראשונה בלי עומס: בודקים מתחים בספק, בבקר ובסלילים, ואחר כך פונקציונליות עם עומס.'
    ] });
    return steps;
  }

  /* ---------- מעטפת הארון: מידות סטנדרטיות לפי הפלטה ועומק הרכיבים ---------- */
  var DEPTH = { main_switch: 75, mcb: 70, rcd: 70, fuse: 70, psu: 115, transformer: 100, socket: 60, meter: 65, plc: 75, io: 75, relay: 65, timer: 65,
    thermostat: 40, other: 60, contactor: 90, overload: 80, mpcb: 85, vfd: 180, softstarter: 140, terminal: 45, pe_bar: 25 };
  var ENC_W = [300, 400, 500, 600, 800, 1000, 1200], ENC_H = [300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1600, 1800, 2000], ENC_D = [150, 200, 250, 300, 400, 500];

  function enclosure(p, L) {
    var deepest = 0;
    (p.components || []).forEach(function (c) { if (L.comps[c.tag] && c.zone === 'cabinet') deepest = Math.max(deepest, DEPTH[c.type] || 60); });
    var w = roundUp(L.plate.w + 50, ENC_W), h = roundUp(L.plate.h + 50, ENC_H), d = roundUp(deepest + 90, ENC_D);
    var hd = L.ducts.filter(function (x) { return x.kind === 'h'; }), vd = L.ducts.filter(function (x) { return x.kind === 'v'; });
    var ductM = (hd.reduce(function (s, x) { return s + x.w; }, 0) + vd.reduce(function (s, x) { return s + x.h; }, 0)) / 1000;
    var railM = L.rails.reduce(function (s, r) { return s + (r.x2 - r.x1); }, 0) / 1000;
    var wireM = 0;
    (p.wires || []).forEach(function (w) { var r = L.routes[w.id]; if (r && r.len) wireM += r.len / 1000; });
    var door = (p.components || []).filter(function (c) { return c.zone === 'door'; }).length;
    return {
      w: w, h: h, d: d, deepest: deepest, plinth: h >= 1400 ? 100 : 0, door: door,
      text: w + '×' + h + '×' + d + ' מ"מ (רוחב×גובה×עומק)',
      material: 'פלדה צבועה RAL 7035, דלת אחת עם ידית ומנעול, פלטת הרכבה מגולוונת',
      ip: 'IP54 לפחות (IP55 במקום עם אבק או התזות מים)',
      ductM: Math.round(ductM * 10) / 10, railM: Math.round(railM * 10) / 10, wireM: Math.round(wireM * 10) / 10,
      ducts: hd.length + vd.length, rails: L.rails.length
    };
  }
  function depthOf(type) { return DEPTH[type] || 60; }


  /* ---------- כרטיס רכיב: מה הוא עושה וכל החיווט שלו, כולל המשך דרך פסי המהדקים ---------- */
  var PURPOSE = {
    main_switch: 'מפסק ראשי: מנתק את כל הזנת הארון. פותחים ונועלים אותו לפני כל עבודה בלוח.',
    mcb: 'מאמ"ת: מגן על המעגל מפני עומס יתר וקצר. כל מאמ"ת מזין קבוצת צרכנים אחת.',
    rcd: 'מפסק פחת: מנתק כשיש זליגה לאדמה, להגנה מפני חשמול.',
    fuse: 'נתיך: מגן על המעגל, נשרף בזרם יתר ומנתק אותו.',
    psu: 'ספק כוח: ממיר 230V AC ל-‎24V DC לפיקוד, לבקר ולחיישנים.',
    transformer: 'שנאי פיקוד: מוריד מתח לפיקוד AC.',
    socket: 'שקע שירות לכלי עבודה ולמחשב בתוך הלוח.',
    meter: 'מונה / מד: מודד מתח, זרם או אנרגיה.',
    plc: 'הבקר: קורא את הכניסות (לחצנים, חיישנים, מגעים) ומפעיל את היציאות לפי התכנה.',
    io: 'כרטיס כניסות/יציאות של הבקר: כל ערוץ מחובר לאות אחד בשטח או בלוח.',
    relay: 'ממסר: אות פיקוד קטן בסליל (A1-A2) מפעיל מגעים שמעבירים אות או עומס.',
    timer: 'ממסר זמן: מפעיל או מפסיק את המגעים אחרי השהיה.',
    thermostat: 'תרמוסטט: מפעיל מאוורר או חימום לפי הטמפרטורה בלוח.',
    contactor: 'מגען: מתג כוח שמופעל מסליל, מפעיל מנוע או עומס גדול.',
    overload: 'ממסר תרמי: מגן על המנוע מעומס יתר ופותח את מעגל הפיקוד.',
    mpcb: 'מפסק מגן מנוע: הגנת קצר ועומס יתר למנוע.',
    vfd: 'ממיר תדר: שולט במהירות המנוע.',
    softstarter: 'מתנע רך: מעלה את מתח המנוע בהדרגה בהתנעה.',
    terminal: 'פס מהדקים: נקודת החיבור בין החיווט הפנימי לכבלים שיוצאים לשטח ולארונות אחרים.',
    pe_bar: 'פס הארקה: מרכז את כל חוטי ההארקה של הלוח ומחובר להארקת המבנה.',
    button: 'לחצן: נותן פקודה לבקר או למעגל הפיקוד.',
    selector: 'בורר: בוחר מצב עבודה (ידני / אוטומטי וכו\').',
    estop: 'לחצן חירום: מגע NC בשרשרת הבטיחות. לחיצה פותחת את המגע ומנתקת את מעגל הבטיחות.',
    lamp: 'נורית סימון: מראה מצב (פעולה, תקלה, מתח).',
    door_meter: 'מד בדלת הלוח.',
    motor: 'מנוע בשטח, מוזן מהלוח בכבל כוח.',
    sensor: 'חיישן בשטח: שולח אות לכניסה של הבקר.',
    valve: 'שסתום / סולנואיד: מופעל מיציאה של הבקר.',
    fan: 'מאוורר / מסנן לאוורור הלוח.',
    heater: 'גוף חימום נגד עיבוי בלוח.',
    field: 'מכשיר בשטח שמחובר ללוח בכבל דרך פסי המהדקים.',
    other: 'רכיב בלוח.'
  };

  function compPurpose(c) {
    var n = (c.name || '') + ' ' + (c.desc || '');
    if (/רמזור|מגדל אור|traffic|signal tower|stack ?light/i.test(n)) return 'מגדל אור (רמזור): כל צבע נדלק מיציאה נפרדת של הבקר או ממגע של ממסר, דרך פס המהדקים. החזרה (0V / אפס) משותפת לכל הצבעים.';
    if (/סורק|scanner|lidar|TIM\d/i.test(n)) return 'סורק לייזר: מזהה עצמים באזור ומדווח לבקר ביציאות מיתוג (ולפעמים בתקשורת).';
    if (/שער|gate/i.test(n)) return 'בקר השער: מקבל פקודות מהלוח (פתיחה / סגירה / עצירה) ומחזיר מצבים (פתוח, סגור, תקלה).';
    if (/דלת|door/i.test(n) && c.zone === 'field') return 'דלת: מגעי מצב שמדווחים לבקר אם הדלת פתוחה או סגורה, ולפעמים פקודת פתיחה.';
    if (/פאנל|panel|HMI/i.test(n) && c.zone === 'field') return 'פאנל בשטח: לחצנים ונוריות שמחוברים לכניסות וליציאות של הלוח.';
    return PURPOSE[c.type] || PURPOSE.other;
  }

  function compWiring(p, tag) {
    var by = {};
    (p.components || []).forEach(function (c) { by[c.tag] = c; });
    var c = by[tag];
    if (!c) return null;
    var same = function (e, tg, tm) { return e.tag === tg && normTerm(e.term) === normTerm(tm); };
    var rows = (p.wires || []).filter(function (w) { return w.from.tag === tag || w.to.tag === tag; }).map(function (w) {
      var mineFrom = w.from.tag === tag;
      var mine = mineFrom ? w.from : w.to, other = mineFrom ? w.to : w.from;
      var via = [], seen = {}, cur = other;
      seen[w.id] = 1;
      /* ממשיכים דרך פסי מהדקים: מה מחובר לאותו מהדק מהצד השני */
      for (var hop = 0; hop < 4; hop++) {
        var oc = by[cur.tag];
        if (!oc || oc.type !== 'terminal' || cur.tag === tag) break;
        var nxt = (p.wires || []).filter(function (x) { return !seen[x.id] && (same(x.from, cur.tag, cur.term) || same(x.to, cur.tag, cur.term)); });
        if (!nxt.length) break;
        var ends = nxt.map(function (x) { seen[x.id] = 1; return { wire: x, at: same(x.from, cur.tag, cur.term) ? x.to : x.from }; });
        via.push(ends);
        /* פס ‎0V / אפס / הארקה מתפצל לכל הלוח: מספיק הצעד הראשון */
        if (/^(dc0|neutral|pe)$/.test(w.func)) break;
        var cont = ends.filter(function (e) { return by[e.at.tag] && by[e.at.tag].type === 'terminal'; })[0];
        if (!cont) break;
        cur = cont.at;
      }
      return { term: mine.term, role: termRole(c.type, mine.term), wire: w, other: other, otherComp: by[other.tag] || null, via: via };
    });
    rows.sort(function (a, b) { return natCmp(String(a.term), String(b.term)) || natCmp(String(a.wire.no), String(b.wire.no)); });
    var strips = {};
    rows.forEach(function (r) { if (r.otherComp && r.otherComp.type === 'terminal') strips[r.other.tag] = 1; });
    var cable = null;
    if (c.zone === 'field') {
      var cores = {};
      rows.forEach(function (r) { cores[normTerm(r.term)] = r.wire; });
      var n = Object.keys(cores).length;
      var ws = Object.keys(cores).map(function (k) { return cores[k]; });
      if (ws.some(function (w) { return w.func === 'power'; })) {
        var s = Math.max.apply(null, ws.map(function (w) { return Number(w.section) || 1.5; }));
        cable = 'NYY-J ' + n + '×' + s + ' (כבל כוח, גיד לכל הדק כולל PE)';
      } else {
        var CORES = [2, 3, 4, 5, 7, 12, 18, 25, 34, 50];
        var need = Math.ceil(n * 1.2) + (n > 3 ? 1 : 0);
        var k = CORES.filter(function (x) { return x >= need; })[0] || need;
        var shield = ws.some(function (w) { return w.func === 'signal' || w.func === 'comm'; });
        cable = (shield ? 'LiYCY ' : 'LiYY ') + k + '×0.75 (' + n + ' גידים בשימוש ועוד רזרבה' + (shield ? ', מסוכך' : '') + ')';
      }
    }
    return { comp: c, rows: rows, purpose: compPurpose(c), strips: Object.keys(strips), cable: cable };
  }


  /* ---------- כל מוליך הוא חוט: פירוק של חוט "תלת־פאזי" אחד לחוט לכל פאזה ---------- */
  var POLE_NEXT = [
    ['1', '3', '5', '7'], ['2', '4', '6', '8'], ['L1', 'L2', 'L3', 'N'], ['T1', 'T2', 'T3'], ['U1', 'V1', 'W1'], ['U', 'V', 'W'], ['U2', 'V2', 'W2'], ['R', 'S', 'T']
  ];
  var PHASES = ['L1', 'L2', 'L3', 'N'];
  /* "1/3/5", "2-4-6", "L1/L2/L3", "U1,V1,W1" — רק כשכל החלקים הם הדקי קטבים מוכרים */
  var POLE_TOKEN = /^([1-8]|L[1-3]|N|PE|T[1-3]|[UVW][12]?|[RST])$/i;
  function termList(t) {
    var s = String(t == null ? '' : t).trim();
    if (!/[\/,;-]/.test(s)) return null;
    var parts = s.split(/\s*[\/,;]\s*|\s*-\s*/).filter(Boolean);
    if (parts.length < 3 || parts.length > 5) return null;
    return parts.every(function (x) { return POLE_TOKEN.test(x); }) ? parts : null;
  }
  function polesOfType(type) { return { main_switch: 3, rcd: 4, contactor: 3, mpcb: 3, overload: 3, motor: 3, vfd: 3, softstarter: 3 }[type] || 0; }
  function seriesFrom(term, n) {
    var T = String(term).toUpperCase();
    for (var i = 0; i < POLE_NEXT.length; i++) {
      var k = POLE_NEXT[i].indexOf(T);
      if (k === 0) return POLE_NEXT[i].slice(0, n);
    }
    return null;
  }
  function multiPole(c) {
    if (!c) return 0;
    var n = polesOfType(c.type);
    var m = /\b([234])\s*[×xP]|\b([234])\s*קטב|3\s*~|תלת/.exec((c.name || '') + ' ' + (c.desc || ''));
    if (m) n = Number(m[1] || m[2]) || 3;
    if (c.type === 'mcb' || c.type === 'fuse') n = m ? n : 0;
    else if (!polesOfType(c.type)) n = 0;
    return n;
  }
  /* comps: רכיבים גולמיים (tag, type, name); wires: חוטים גולמיים. מחזיר רשימה חדשה ומספר החוטים שנוספו */
  function expandMultiCore(comps, wires) {
    var by = {};
    (comps || []).forEach(function (c) { by[normTag(c.tag)] = Object.assign({}, c, { type: c.type || inferType(c.tag, c.name, []) }); });
    var out = [], added = 0;
    var linked = {};
    (wires || []).forEach(function (w) { linked[normTag(w.from.tag) + '|' + normTag(w.to.tag)] = (linked[normTag(w.from.tag) + '|' + normTag(w.to.tag)] || 0) + 1; });
    (wires || []).forEach(function (w) {
      var fa = termList(w.from.term), ta = termList(w.to.term);
      var pot = String(w.potential || '');
      /* 1) הדקים כתובים כרשימה: "1/3/5" ← "2/4/6" */
      if (fa || ta) {
        var n = Math.max(fa ? fa.length : 0, ta ? ta.length : 0);
        var fl = fa || (/^\d+$/.test(String(w.from.term)) ? Array.from({ length: n }, function (_, i) { return String(Number(w.from.term) + i); }) : null);
        var tl = ta || (/^\d+$/.test(String(w.to.term)) ? Array.from({ length: n }, function (_, i) { return String(Number(w.to.term) + i); }) : null);
        if (fl && tl && fl.length === tl.length) {
          fl.forEach(function (ft, i) {
            out.push(Object.assign({}, w, { no: w.no ? w.no + '.' + (i + 1) : '', from: { tag: w.from.tag, term: ft }, to: { tag: w.to.tag, term: tl[i] }, potential: n <= 4 && /L|~|3/.test(pot + (w.func || '')) ? PHASES[i] : (w.potential || '') }));
          });
          added += fl.length - 1;
          return;
        }
      }
      /* 2) חוט אחד בין שני רכיבים תלת־פאזיים, בהדק של הקוטב הראשון, ובלי חוטים לשאר הקטבים */
      var A = by[normTag(w.from.tag)], B = by[normTag(w.to.tag)];
      var nA = multiPole(A), nB = multiPole(B);
      var threeP = /L1\s*[-–\/]\s*L3|L1\s*,\s*L2|3\s*~|3P|תלת/i.test(pot + ' ' + (w.desc || ''));
      if ((w.func === 'power' || threeP) && nA >= 3 && nB >= 3 && (linked[normTag(w.from.tag) + '|' + normTag(w.to.tag)] || 0) + (linked[normTag(w.to.tag) + '|' + normTag(w.from.tag)] || 0) === 1) {
        var n2 = Math.min(nA, nB, 3);
        var fs = seriesFrom(w.from.term, n2), ts = seriesFrom(w.to.term, n2);
        if (fs && ts) {
          fs.forEach(function (ft, i) {
            out.push(Object.assign({}, w, { no: w.no ? (i ? w.no + '.' + (i + 1) : w.no) : '', from: { tag: w.from.tag, term: ft }, to: { tag: w.to.tag, term: ts[i] }, potential: PHASES[i] }));
          });
          added += n2 - 1;
          return;
        }
      }
      out.push(w);
    });
    return { wires: out, added: added };
  }

  /* ---------- בדיקת שלמות החיווט ---------- */
  function checkWiring(p) {
    var issues = [];
    var termsOf = {};
    (p.wires || []).forEach(function (w) {
      [w.from, w.to].forEach(function (e) { (termsOf[e.tag] = termsOf[e.tag] || {})[String(e.term).toUpperCase()] = 1; });
    });
    (p.components || []).forEach(function (c) {
      var t = termsOf[c.tag] || {};
      var has = function (x) { return Boolean(t[x]); };
      var n = multiPole(c);
      if (n >= 3 && c.zone !== 'field' && c.type !== 'motor') {
        var ins = ['1', '3', '5'], outs = ['2', '4', '6'];
        var anyIn = ins.some(has), anyOut = outs.some(has);
        var missIn = ins.filter(function (x) { return !has(x); }), missOut = outs.filter(function (x) { return !has(x); });
        if (anyIn && missIn.length) issues.push({ tag: c.tag, kind: 'pole', msg: c.tag + ': רכיב ' + n + ' קטבים, אבל בכניסה חסרים חוטים להדקים ' + missIn.join(', ') + '.' });
        if (anyOut && missOut.length) issues.push({ tag: c.tag, kind: 'pole', msg: c.tag + ': רכיב ' + n + ' קטבים, אבל ביציאה חסרים חוטים להדקים ' + missOut.join(', ') + '.' });
      }
      if (c.type === 'motor') {
        var ph = ['U', 'V', 'W'].filter(function (x) { return has(x) || has(x + '1'); });
        if (ph.length && ph.length < 3) issues.push({ tag: c.tag, kind: 'pole', msg: c.tag + ': מנוע תלת־פאזי עם ' + ph.length + ' פאזות מחוברות בלבד (' + ph.join(', ') + ').' });
        if (ph.length && !has('PE')) issues.push({ tag: c.tag, kind: 'pe', msg: c.tag + ': למנוע אין חוט הארקה (PE).' });
      }
      if ((c.type === 'contactor' || c.type === 'relay' || c.type === 'timer') && (has('A1') !== has('A2'))) {
        issues.push({ tag: c.tag, kind: 'coil', msg: c.tag + ': לסליל מחובר רק ' + (has('A1') ? 'A1' : 'A2') + ' — חסר חוט ל-' + (has('A1') ? 'A2 (חזרה)' : 'A1 (פיקוד)') + '.' });
      }
      if (c.type === 'psu' && (has('L') || has('N')) && !(has('L') && has('N'))) issues.push({ tag: c.tag, kind: 'psu', msg: c.tag + ': לכניסת הספק מחובר רק ' + (has('L') ? 'L' : 'N') + '.' });
    });
    (p.wires || []).forEach(function (w) {
      if (termList(w.from.term) || termList(w.to.term)) issues.push({ tag: w.from.tag, kind: 'multi', wire: w.id, msg: 'חוט ' + (w.no || '') + ' (' + w.from.tag + ':' + w.from.term + ' ← ' + w.to.tag + ':' + w.to.term + ') מאחד כמה מוליכים בחוט אחד — צריך לפרק לחוט לכל מוליך.' });
    });
    return issues;
  }

  /* ---------- CSV ---------- */
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) { var s = v == null ? '' : String(v).replace(/[\u2066-\u2069]/g, ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\r\n');
  }

  function wireListCsv(p, L) {
    var rows = [['מס\' חוט', 'מ-תג', 'מ-הדק', 'אל-תג', 'אל-הדק', 'תפקיד', 'צבע', 'קוד צבע', 'חתך ממ"ר', 'סוג חוט', 'אורך משוער ס"מ', 'שרוול', 'עמוד', 'תיאור', 'הסבר']];
    (p.wires || []).forEach(function (w) {
      var r = L && L.routes[w.id];
      rows.push([w.no, w.from.tag, w.from.term, w.to.tag, w.to.term, (C.FUNCS[w.func] || {}).he, (C.COLORS[w.color] || {}).he, w.color, w.section, w.wireType,
        r && r.len ? Math.round(r.len / 10) : '', (w.auto && w.auto.ferrule.text) || '', w.page || '', w.desc || '', w.explain || (w.auto && w.auto.purpose) || '']);
    });
    return csv(rows);
  }

  function bomCsv(p) {
    var rows = [['תג', 'סוג', 'שם', 'תיאור', 'יצרן', 'מק"ט', 'מיקום']];
    (p.components || []).forEach(function (c) { rows.push([c.tag, typeInfo(c.type).he, c.name, c.desc || '', c.maker || '', c.partNo || '', C.ZONES[c.zone] || '']); });
    return csv(rows);
  }

  /* חוטים לפי צבע וחתך — לקנייה ולחיתוך */
  function cutList(p, L) {
    var g = {};
    (p.wires || []).forEach(function (w) {
      var k = w.wireType + '|' + w.section + '|' + w.color;
      var r = L && L.routes[w.id];
      g[k] = g[k] || { wireType: w.wireType, section: w.section, color: w.color, count: 0, mm: 0, ext: 0 };
      g[k].count++;
      if (r && r.len) g[k].mm += r.len; else g[k].ext++;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.section - a.section || natCmp(a.color, b.color); });
  }

  return {
    natCmp: natCmp, expandMultiCore: expandMultiCore, checkWiring: checkWiring, compWiring: compWiring, compPurpose: compPurpose, normTag: normTag, normTerm: normTerm, tagBody: tagBody, pinKey: pinKey, uid: uid,
    inferType: inferType, typeInfo: typeInfo, termRole: termRole, extractFromText: extractFromText, textLines: textLines,
    enrich: enrich, settingsOf: settingsOf, DEFAULT_SETTINGS: DEFAULT_SETTINGS, explainWire: explainWire,
    layout: layout, wireOrder: wireOrder, assemblySteps: assemblySteps, GROUPS: GROUPS,
    wireListCsv: wireListCsv, bomCsv: bomCsv, cutList: cutList, enclosure: enclosure, depthOf: depthOf, routeDucts: routeDucts, routeHe: routeHe
  };
});
