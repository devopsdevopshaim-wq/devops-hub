/* ארון־פלאן — הגדרות הבקרים והציוד לפי השרטוטים: תצורת הבקר ומפת ה-I/O, רשת התקשורת, הראוטר (Teltonika),
   ממירי תדר (דרייברים) עם טבלת פרמטרים, וציוד חכם אחר. כל ערך מסומן במקור שלו: מהשרטוט, מהחיווט, או המלצה.
   קובץ משותף: window.WConfig בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.WConfig = factory(root.WEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var txt = function (c) { return [(c && c.name) || '', (c && c.desc) || '', (c && c.partNo) || '', (c && c.maker) || ''].join(' '); };
  var natCmp = function (a, b) { return String(a).localeCompare(String(b), 'en', { numeric: true }); };

  /* איזה ציוד צריך הגדרות */
  function kindOf(c, P) {
    var t = ((c.name || '') + ' ' + (c.partNo || '')).toUpperCase();
    if (c.type === 'plc') return 'plc';
    if (c.type === 'io') return 'io';
    if (c.type === 'vfd' || c.type === 'softstarter') return 'drive';
    if (c.type !== 'other') return null;
    if (/SINAMICS|ALTIVAR|\bATV\d|\bACS\d{3}|\bVLT\b|ממיר תדר|דרייבר/.test(t)) return 'drive';
    if (/TELTONIKA|\bRUT\d{3}|ROUTER|נתב|ראוטר|מודם|MODEM/.test(t)) return 'router';
    if (/SWITCH|SFNB|SCALANCE|מתג ETHERNET|מתג רשת/.test(t)) return 'switch';
    if (/TIBBO|HMI|PANEL PC|GATEWAY|מסך מגע/.test(t)) return 'smart';
    if (P && P.wires.some(function (w) { return w.func === 'comm' && (w.from.tag === c.tag || w.to.tag === c.tag); })) return 'smart';
    return null;
  }

  /* כל החיבורים של רכיב: הדק → לאן */
  function conns(P, tag) {
    var by = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var out = [];
    P.wires.forEach(function (w) {
      [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
        if (pr[0].tag !== tag) return;
        var o = by[pr[1].tag] || {};
        out.push({ term: String(pr[0].term), to: pr[1].tag + ':' + pr[1].term, toTag: pr[1].tag, toTerm: String(pr[1].term), toName: o.name || '', toType: o.type || '', no: w.no || '', desc: w.desc || '', func: w.func || '', page: w.page || null, wire: w });
      });
    });
    return out.sort(function (a, b) { return natCmp(a.term, b.term); });
  }

  /* כיוון ערוץ בכרטיס I/O */
  function moduleKind(c) {
    var t = txt(c).toUpperCase();
    if (/EL1\d{3}|KL1\d{3}|\bDI\b|כניסות|INPUT|SM 1221|DI\s?16|DI\s?8/.test(t)) return { dir: 'in', he: 'כניסות דיגיטליות' };
    if (/EL2\d{3}|KL2\d{3}|\bDO\b|\bDQ\b|יציאות|OUTPUT|SM 1222/.test(t)) return { dir: 'out', he: 'יציאות דיגיטליות' };
    if (/EL3\d{3}|\bAI\b|ANALOG IN|כניסות אנלוגיות/.test(t)) return { dir: 'ain', he: 'כניסות אנלוגיות' };
    if (/EL4\d{3}|\bAO\b|ANALOG OUT|יציאות אנלוגיות/.test(t)) return { dir: 'aout', he: 'יציאות אנלוגיות' };
    if (/EK1122|EK1100|JUNCTION|COUPLER|צומת/.test(t)) return { dir: 'net', he: 'צומת / מצמד EtherCAT' };
    if (/CX\d{4}|CPU|בקר/.test(t)) return { dir: 'cpu', he: 'בקר' };
    return { dir: '', he: '' };
  }
  var isSupply = function (t) { return /^(\+|-|L\+|M|0V|0VP|24V|24VP|\+24V?|1M|2M|1L\+|2L\+|PE|US|UP|GND)$/i.test(String(t)); };
  var asciiName = function (s, fb) {
    var m = String(s || '').match(/[A-Za-z][A-Za-z0-9]*/g);
    if (!m || !m.length) return fb;
    var n = m.slice(0, 5).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join('_');
    return n.length > 2 ? n : fb;
  };

  /* בקר: החומרה בסדר שבשרטוט ומפת ה-I/O לפי החיווט */
  function plcSystem(P, L, plc) {
    var by = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var mods = P.components.filter(function (c) { return c.type === 'io'; });
    var rail = L && L.rails ? L.rails.find(function (r) { return r.items.some(function (c) { return c.tag === plc.tag; }); }) : null;
    var order = rail ? rail.items.map(function (c) { return c.tag; }) : [];
    mods.sort(function (a, b) {
      var ia = order.indexOf(a.tag), ib = order.indexOf(b.tag);
      ia = ia < 0 ? 1e6 : ia; ib = ib < 0 ? 1e6 : ib;
      return ia - ib || natCmp(a.tag, b.tag);
    });
    var fromDrawing = Boolean(rail && rail.fromDrawing);
    var hw = [{ slot: 0, tag: plc.tag, model: plc.partNo || '', name: plc.name || '', maker: plc.maker || '', kind: 'בקר' }];
    var io = [];
    mods.forEach(function (m, i) {
      var k = moduleKind(m);
      hw.push({ slot: i + 1, tag: m.tag, model: m.partNo || '', name: m.name || '', maker: m.maker || '', kind: k.he });
      if (k.dir === 'net' || k.dir === 'cpu') return;
      var seen = {};
      conns(P, m.tag).forEach(function (r) {
        if (isSupply(r.term) || r.func === 'comm' || seen[r.term]) return;
        seen[r.term] = 1;
        var role = E.termRole('io', r.term);
        var dir = k.dir || (role.kind === 'input' ? 'in' : role.kind === 'output' ? 'out' : '');
        io.push({ module: m.tag, model: m.partNo || '', ch: r.term, dir: dir, no: r.no, to: r.to, toName: r.toName, signal: r.desc,
          name: (dir === 'out' ? 'Q_' : dir === 'in' ? 'I_' : 'X_') + asciiName(r.desc, m.tag.replace(/^-/, '') + '_' + r.term), page: r.page });
      });
    });
    /* גם יציאות / כניסות שעל הבקר עצמו (S7-1200, LOGO וכו') */
    var seenP = {};
    conns(P, plc.tag).forEach(function (r) {
      var role = E.termRole('plc', r.term);
      if ((role.kind !== 'input' && role.kind !== 'output' && role.kind !== 'analog') || seenP[r.term]) return;
      seenP[r.term] = 1;
      var dir = role.kind === 'input' ? 'in' : role.kind === 'output' ? 'out' : 'ain';
      io.push({ module: plc.tag, model: plc.partNo || '', ch: r.term, dir: dir, no: r.no, to: r.to, toName: r.toName, signal: r.desc, name: (dir === 'out' ? 'Q_' : 'I_') + asciiName(r.desc, r.term.replace(/[^A-Za-z0-9]/g, '_')), page: r.page });
    });
    var ports = conns(P, plc.tag).filter(function (r) { return r.func === 'comm'; }).concat.apply([], mods.map(function (m) { return conns(P, m.tag).filter(function (r) { return r.func === 'comm'; }).map(function (r) { return Object.assign({ via: m.tag }, r); }); }));
    var power = conns(P, plc.tag).filter(function (r) { return isSupply(r.term) && r.func !== 'comm'; });
    return { tag: plc.tag, name: plc.name || '', maker: plc.maker || '', model: plc.partNo || '', note: plc.desc || '', fromDrawing: fromDrawing, railLabel: rail && rail.label || '', hw: hw, io: io, ports: ports, power: power };
  }

  /* ראוטר / מודם: פורטים וחיבורי I/O, ומה החיווט אומר שצריך להגדיר בו */
  function routerConfig(P, c) {
    var all = conns(P, c.tag);
    var ports = all.filter(function (r) { return r.func === 'comm'; });
    var pins = all.filter(function (r) { return r.func !== 'comm'; });
    var by = {};
    P.components.forEach(function (x) { by[x.tag] = x; });
    var setup = [];
    pins.forEach(function (r) {
      var o = by[r.toTag] || {};
      var role = '';
      if (/^\+$|^V\+$|^PWR\+?$/i.test(r.term)) {
        role = o.type === 'relay' || o.type === 'timer' ? 'הזנה דרך מגע של ' + r.toTag + (o.name ? ' (' + o.name + ')' : '') + ' — אפשר לכבות ולהדליק את הראוטר מרחוק (איפוס)' : 'הזנת ‎+24V';
        if (o.type === 'relay') {
          var coil = conns(P, r.toTag).filter(function (x) { return x.term === 'A1'; }).map(function (x) { return x.to + (x.desc ? ' — ' + x.desc : ''); });
          setup.push({ name: 'איפוס הראוטר', value: 'הראוטר מקבל מתח דרך המגע של ' + r.toTag + '. הסליל מופעל מ: ' + (coil.join(' · ') || '—') + '. בתכנית הבקר: לנתק את הממסר ל-10 שניות כשאין תקשורת.', src: 'wiring' });
        }
      } else if (/^-$|^V-$|^0V$|^GND$/i.test(r.term) || r.func === 'dc0') role = '‎0V';
      else if (o.type === 'io' || o.type === 'plc') {
        role = 'יציאה של הראוטר ← כניסה ' + r.to + ' בבקר' + (r.desc ? ' (' + r.desc + ')' : '');
        setup.push({ name: 'פין ' + r.term + ' — יציאה דיגיטלית', value: 'לחבר לאירוע שהבקר צריך לדעת (למשל "חיבור סלולרי תקין"). בבקר: ' + r.to + '.', src: 'recommended' });
      } else if ((o.type === 'relay' || o.type === 'contactor') && /^A1$/i.test(r.toTerm)) {
        role = 'יציאה של הראוטר ← סליל ' + r.toTag + (o.name ? ' (' + o.name + ')' : '');
        setup.push({ name: 'פין ' + r.term + ' — יציאה דיגיטלית', value: 'מפעילה את ' + r.toTag + (o.name ? ' — ' + o.name : '') + '. להגדיר כלל שמפעיל אותה (למשל Ping לבקר נכשל → איפוס הבקר).', src: 'recommended' });
      } else if (o.type === 'relay' || o.type === 'contactor' || o.type === 'button' || o.type === 'sensor') {
        role = 'כניסה של הראוטר ← מגע ' + r.to + (o.name ? ' (' + o.name + ')' : '');
        setup.push({ name: 'פין ' + r.term + ' — כניסה דיגיטלית', value: 'מצב המגע של ' + r.toTag + (o.name ? ' — ' + o.name : '') + '. להגדיר הודעה (SMS / דוא"ל) כשהמצב משתנה.', src: 'recommended' });
      } else if (r.func === 'ctrl_dc' && /\+24|24V/.test(r.desc + ' ' + r.no)) role = '‎+24V';
      else role = 'חיבור ל-' + r.to + (r.desc ? ' — ' + r.desc : '');
      r.role = role;
    });
    ports.forEach(function (r) { setup.push({ name: 'פורט ' + r.term, value: 'מחובר ל-' + r.to + (r.toName ? ' (' + r.toName + ')' : ''), src: 'wiring' }); });
    setup.push({ name: 'כתובות IP, APN, סיסמאות', value: 'לא מופיעים בשרטוטים — למלא לפי הרשת של הלקוח וספק הסלולר.', src: 'missing' });
    return { tag: c.tag, name: c.name || '', maker: c.maker || '', model: c.partNo || '', ports: ports, pins: pins, setup: setup };
  }

  /* מתג רשת / ציוד חכם: מפת פורטים וחיבורים */
  function deviceConfig(P, c) {
    var all = conns(P, c.tag);
    return { tag: c.tag, name: c.name || '', maker: c.maker || '', model: c.partNo || '', ports: all.filter(function (r) { return r.func === 'comm'; }), pins: all.filter(function (r) { return r.func !== 'comm'; }) };
  }

  /* ---------- ממיר תדר: נתוני מנוע וטבלת פרמטרים לפי היצרן ---------- */
  function motorOf(P, drive) {
    var by = {};
    P.components.forEach(function (c) { by[c.tag] = c; });
    var seen = {}, q = [drive.tag], depth = 0;
    while (q.length && depth < 4) {
      var next = [];
      q.forEach(function (tag) {
        if (seen[tag]) return; seen[tag] = 1;
        P.wires.forEach(function (w) {
          var a = w.from.tag === tag ? w.to.tag : w.to.tag === tag ? w.from.tag : null;
          if (!a || seen[a] || w.func === 'comm' || w.func === 'signal') return;
          if (tag === drive.tag && !/^(U|V|W|U2|V2|W2|T1|T2|T3)$/i.test(String(w.from.tag === tag ? w.from.term : w.to.term))) return;
          var o = by[a];
          if (o && o.type === 'motor') { next.length = 0; next.push('#' + a); return; }
          if (o && (o.type === 'terminal' || o.type === 'contactor' || o.type === 'overload' || o.type === 'other')) next.push(a);
        });
      });
      var hit = next.find(function (x) { return x.charAt(0) === '#'; });
      if (hit) return by[hit.slice(1)];
      q = next; depth++;
    }
    return null;
  }
  function motorData(m) {
    var t = txt(m);
    var num = function (re) { var x = re.exec(t); return x ? Number(x[1]) : null; };
    return {
      kw: num(/(\d+(?:[.,]\d+)?)\s*kW/i),
      v: num(/(\d{3})\s*V\b/i),
      a: num(/(\d+(?:\.\d+)?)\s*A\b/),
      rpm: num(/(\d{3,4})\s*(?:rpm|סל"?ד|1\/min)/i),
      hz: num(/\b(50|60)\s*Hz/i) || 50,
      cos: num(/cos\S*\s*=?\s*(0\.\d+)/i)
    };
  }
  function family(c) {
    var t = txt(c).toUpperCase();
    if (/SINAMICS|G120|V20|6SL3|SIEMENS/.test(t)) return 'siemens';
    if (/ALTIVAR|\bATV\d|SCHNEIDER/.test(t)) return 'schneider';
    if (/\bACS\d|\bABB\b/.test(t)) return 'abb';
    if (/DANFOSS|VLT|\bFC\s?\d/.test(t)) return 'danfoss';
    return 'generic';
  }
  function driveConfig(P, c, given) {
    var m = motorOf(P, c);
    var md = m ? motorData(m) : {};
    var fam = family(c);
    var v = function (val, unit) { return val != null ? { value: val + (unit ? ' ' + unit : ''), src: 'drawing' } : { value: 'לפי לוחית המנוע', src: 'plate' }; };
    var rec = function (val) { return { value: val, src: 'recommended' }; };
    var rows = {
      siemens: [['p0010', 'מצב הגדרה', rec('1 (הגדרה ראשונית), בסוף 0')], ['p0100', 'תקן מנוע', rec(md.hz === 60 ? '1 (NEMA, 60Hz)' : '0 (IEC, 50Hz)')], ['p0304', 'מתח נומינלי', v(md.v, 'V')], ['p0305', 'זרם נומינלי', v(md.a, 'A')], ['p0307', 'הספק נומינלי', v(md.kw, 'kW')], ['p0308', 'cos φ', v(md.cos, '')], ['p0310', 'תדר נומינלי', v(md.hz, 'Hz')], ['p0311', 'מהירות נומינלית', v(md.rpm, 'rpm')], ['p0015', 'מאקרו חיבורים', rec('לפי החיווט: הדקים (DI0 הפעלה) או שליטה ברשת')], ['p1080', 'מהירות מינימלית', rec('0')], ['p1082', 'מהירות מקסימלית', md.rpm ? rec(String(md.rpm)) : v(null)], ['p1120', 'זמן האצה', rec('10 שניות')], ['p1121', 'זמן האטה', rec('10 שניות')], ['p1900', 'זיהוי נתוני מנוע', rec('2 (מדידה במצב עמידה)')]],
      schneider: [['bFr', 'תדר בסיס', v(md.hz, 'Hz')], ['UnS', 'מתח נומינלי', v(md.v, 'V')], ['nCr', 'זרם נומינלי', v(md.a, 'A')], ['nPr', 'הספק נומינלי', v(md.kw, 'kW')], ['FrS', 'תדר נומינלי', v(md.hz, 'Hz')], ['nSP', 'מהירות נומינלית', v(md.rpm, 'rpm')], ['ItH', 'הגנה תרמית', md.a ? rec(md.a + ' A') : v(null)], ['ACC', 'זמן האצה', rec('10 שניות')], ['dEC', 'זמן האטה', rec('10 שניות')], ['LSP', 'מהירות נמוכה', rec('0 Hz')], ['HSP', 'מהירות גבוהה', rec(md.hz + ' Hz')], ['tCC', 'שליטה בהדקים', rec('2C (שני חוטים) — לפי החיווט')], ['tUn', 'כיוונון אוטומטי', rec('YES')]],
      abb: [['99.03', 'סוג מנוע', rec('Asynchronous motor')], ['99.06', 'זרם נומינלי', v(md.a, 'A')], ['99.07', 'מתח נומינלי', v(md.v, 'V')], ['99.08', 'תדר נומינלי', v(md.hz, 'Hz')], ['99.09', 'מהירות נומינלית', v(md.rpm, 'rpm')], ['99.10', 'הספק נומינלי', v(md.kw, 'kW')], ['99.13', 'ID run', rec('Standstill')], ['23.12', 'זמן האצה', rec('10 שניות')], ['23.13', 'זמן האטה', rec('10 שניות')]],
      danfoss: [['1-20', 'הספק נומינלי', v(md.kw, 'kW')], ['1-22', 'מתח נומינלי', v(md.v, 'V')], ['1-23', 'תדר נומינלי', v(md.hz, 'Hz')], ['1-24', 'זרם נומינלי', v(md.a, 'A')], ['1-25', 'מהירות נומינלית', v(md.rpm, 'rpm')], ['1-29', 'AMA', rec('Enable reduced AMA')], ['3-41', 'זמן האצה', rec('10 שניות')], ['3-42', 'זמן האטה', rec('10 שניות')]],
      generic: [['—', 'מתח נומינלי', v(md.v, 'V')], ['—', 'זרם נומינלי', v(md.a, 'A')], ['—', 'הספק נומינלי', v(md.kw, 'kW')], ['—', 'תדר נומינלי', v(md.hz, 'Hz')], ['—', 'מהירות נומינלית', v(md.rpm, 'rpm')], ['—', 'זמן האצה / האטה', rec('10 / 10 שניות')], ['—', 'מקור פקודה ומהירות', rec('לפי החיווט: הדקים או רשת')], ['—', 'כיוונון אוטומטי', rec('להפעיל אחרי הזנת נתוני המנוע')]]
    }[fam];
    var params = rows.map(function (r) { return { id: r[0], name: r[1], value: r[2].value, src: r[2].src }; });
    /* פרמטרים שכתובים בשרטוט גוברים על כל השאר */
    (given || []).forEach(function (g) {
      var hit = params.find(function (p) { return p.id !== '—' && String(g.name).toUpperCase().indexOf(p.id.toUpperCase()) === 0; });
      if (hit) { hit.value = g.value; hit.src = 'drawing'; hit.page = g.page; }
      else params.unshift({ id: g.name, name: g.group || '', value: g.value, src: 'drawing', page: g.page });
    });
    var ctrl = conns(P, c.tag).filter(function (r) { return !/^(U|V|W|U2|V2|W2|T1|T2|T3|L1|L2|L3|R|S|T|PE)$/i.test(r.term); });
    return { tag: c.tag, name: c.name || '', maker: c.maker || '', model: c.partNo || '', family: fam, motor: m ? { tag: m.tag, name: m.name || '', data: md } : null, params: params, control: ctrl };
  }

  /* הכל ביחד */
  function build(P, L) {
    var settings = (P.deviceSettings || []).slice();
    var forTag = function (tag) { return settings.filter(function (s) { return s.tag === tag; }); };
    var out = { plcs: [], routers: [], switches: [], smart: [], drives: [], links: [], settings: settings };
    P.components.forEach(function (c) {
      var k = kindOf(c, P);
      if (k === 'plc') out.plcs.push(Object.assign(plcSystem(P, L, c), { given: forTag(c.tag) }));
      else if (k === 'router') out.routers.push(Object.assign(routerConfig(P, c), { given: forTag(c.tag) }));
      else if (k === 'switch') out.switches.push(Object.assign(deviceConfig(P, c), { given: forTag(c.tag) }));
      else if (k === 'smart') out.smart.push(Object.assign(deviceConfig(P, c), { given: forTag(c.tag) }));
      else if (k === 'drive') out.drives.push(Object.assign(driveConfig(P, c, forTag(c.tag)), { given: forTag(c.tag) }));
    });
    P.wires.forEach(function (w) { if (w.func === 'comm') out.links.push({ a: w.from.tag + ':' + w.from.term, b: w.to.tag + ':' + w.to.term, no: w.no || '', desc: w.desc || '', page: w.page || null }); });
    return out;
  }

  /* מפת ה-I/O כ-CSV (לייבוא לתוכנת הבקר או לגיליון) */
  function ioCsv(sys) {
    var q = function (v) { var t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var rows = [['Module', 'Model', 'Channel', 'Direction', 'Variable', 'Wire', 'Connected to', 'Signal', 'Page']];
    sys.io.forEach(function (r) { rows.push([r.module, r.model, r.ch, r.dir, r.name, r.no, r.to + (r.toName ? ' (' + r.toName + ')' : ''), r.signal, r.page || '']); });
    return '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }

  return { kindOf: kindOf, conns: conns, plcSystem: plcSystem, routerConfig: routerConfig, driveConfig: driveConfig, motorData: motorData, build: build, ioCsv: ioCsv };
});
