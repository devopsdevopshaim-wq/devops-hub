/* ארון־פלאן — אתר התקנה: כמה ארונות באתר אחד, כבלים בין ארונות, אורכים ומערך ההתקנה.
   קובץ משותף: window.WSite בדפדפן, require בבדיקות. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GENERIC = /^(\+?24V?|0V(\/\d+)?|24G|12[TR]|PE|N\d*|R|S|T|L[123]?|E[+-]\d*|\d)$/i;
  var CORES = [2, 3, 4, 5, 7, 12, 18, 25, 34, 50];

  /* הקצוות החיצוניים של ארון: לכל מכשיר בשטח, הגידים שיוצאים אליו מפסי המהדקים */
  function externals(P) {
    var by = {};
    (P.components || []).forEach(function (c) { by[c.tag] = c; });
    var groups = {};
    (P.wires || []).forEach(function (w) {
      [[w.from, w.to], [w.to, w.from]].forEach(function (pr) {
        var a = by[pr[0].tag], b = by[pr[1].tag];
        if (!a || !b || a.type !== 'terminal' || (b.zone !== 'field' && b.zone !== 'door')) return;
        var g = groups[b.tag] || (groups[b.tag] = { device: b.tag, name: b.name || '', strips: {}, cores: [] });
        g.strips[a.tag] = 1;
        if (!g.cores.some(function (k) { return k.strip === a.tag && k.term === pr[0].term; })) {
          g.cores.push({ strip: a.tag, term: pr[0].term, devTerm: pr[1].term, no: w.no, func: w.func, section: w.section, cable: w.wireType });
        }
      });
    });
    return Object.keys(groups).map(function (k) { var g = groups[k]; g.strips = Object.keys(g.strips); return g; });
  }

  var norm = function (s) { return String(s || '').toUpperCase().replace(/^[-=+]/, '').replace(/[\s_]+/g, ''); };

  /* הצעות לכבלים בין ארונות: אותם שמות אותות במהדקים החיצוניים של שני ארונות, או מכשיר בשטח ששמו הוא שם של ארון אחר */
  function suggest(cabs) {
    var out = [];
    var ext = cabs.map(function (c) { return { c: c, groups: externals(c.P) }; });
    for (var i = 0; i < ext.length; i++) {
      for (var j = i + 1; j < ext.length; j++) {
        ext[i].groups.forEach(function (ga) {
          ext[j].groups.forEach(function (gb) {
            var la = {}, pairs = [];
            ga.cores.forEach(function (k) { if (!GENERIC.test(k.term)) la[norm(k.term)] = k; });
            gb.cores.forEach(function (k) { var m = la[norm(k.term)]; if (m) pairs.push([m, k]); });
            var byName = nameHit(ga, ext[j].c) || nameHit(gb, ext[i].c);
            if (pairs.length >= 2 || (byName && pairs.length >= 1)) {
              out.push(makeLink(ext[i].c, ga, ext[j].c, gb, pairs, pairs.length >= 2 ? 'אותם אותות בשני הארונות: ' + pairs.slice(0, 6).map(function (p) { return p[0].term; }).join(', ') : 'שם המכשיר בשטח תואם לארון השני'));
            }
          });
        });
      }
    }
    /* הזנה: ארון שכתוב בו "מלוח X" ויש באתר ארון X */
    cabs.forEach(function (c) {
      var sup = String((c.P.meta && c.P.meta.supply) || '');
      var m = /לוח\s*([A-Z0-9א-ת]{1,4})\b|from\s+(?:panel|cabinet)\s*([A-Z0-9]{1,4})/i.exec(sup);
      if (!m) return;
      var key = norm(m[1] || m[2]);
      var src = cabs.find(function (o) { return o !== c && new RegExp('(^|\\s|-)' + key + '(\\s|$|-)', 'i').test(String((o.P.meta && o.P.meta.title) || o.name)); });
      if (!src) return;
      var amp = Number((/(\d+)\s*A\b/.exec(sup) || [])[1]) || 16;
      out.push({ id: 'sup-' + src.id + '-' + c.id, auto: true, kind: 'power', reason: 'בתכנית של ' + c.name + ' כתוב: ' + sup,
        a: { pid: src.id, device: '', strips: [] }, b: { pid: c.id, device: '', strips: ['הזנה'] },
        cores: ['L1', 'L2', 'L3', 'N', 'PE'].map(function (t) { return { a: t, b: t, label: t, func: t === 'PE' ? 'pe' : t === 'N' ? 'neutral' : 'power', section: powerSection(amp) }; }) });
    });
    return out;
  }

  function nameHit(g, cab) {
    var n = norm(g.name), t = norm((cab.P.meta && cab.P.meta.title) || cab.name);
    return n.length >= 4 && t.length >= 4 && (t.indexOf(n) >= 0 || n.indexOf(t) >= 0);
  }

  function makeLink(ca, ga, cb, gb, pairs, reason) {
    var used = {};
    var cores = pairs.map(function (p) { used[p[1].strip + ':' + p[1].term] = 1; return { a: p[0].strip + ':' + p[0].term, b: p[1].strip + ':' + p[1].term, label: p[0].term, func: p[0].func, section: p[0].section }; });
    return { id: 'auto-' + ca.id + '-' + ga.device + '-' + cb.id + '-' + gb.device, auto: true, kind: 'control', reason: reason,
      a: { pid: ca.id, device: ga.device, strips: ga.strips }, b: { pid: cb.id, device: gb.device, strips: gb.strips }, cores: cores };
  }

  /* כבל ידני: קבוצת גידים של מכשיר בשטח בארון א', מול קבוצה בארון ב'. גידים בשם זהה מתחברים זה לזה, השאר לפי הסדר */
  function manualLink(ca, devA, cb, devB) {
    var ga = externals(ca.P).find(function (g) { return g.device === devA; });
    var gb = externals(cb.P).find(function (g) { return g.device === devB; });
    if (!ga || !gb) return null;
    var left = gb.cores.slice(), cores = [];
    ga.cores.forEach(function (k) {
      var i = left.findIndex(function (x) { return norm(x.term) === norm(k.term); });
      if (i < 0) i = 0;
      var m = left.splice(i, 1)[0];
      cores.push({ a: k.strip + ':' + k.term, b: m ? m.strip + ':' + m.term : '—', label: k.term, func: k.func, section: k.section });
    });
    return { id: 'm-' + Date.now().toString(36), auto: false, kind: cores.some(function (k) { return k.func === 'power'; }) ? 'power' : 'control', reason: 'הוגדר ידנית',
      a: { pid: ca.id, device: devA, strips: ga.strips }, b: { pid: cb.id, device: devB, strips: gb.strips }, cores: cores };
  }

  function powerSection(amp) { return amp <= 16 ? 2.5 : amp <= 20 ? 4 : amp <= 32 ? 6 : amp <= 40 ? 10 : 16; }

  /* סוג הכבל לפי הגידים: כוח NYY, נתונים מסוכך, פיקוד LiYY עם 20% רזרבה */
  function cableFor(link) {
    var n = link.cores.length;
    if (link.cores.some(function (k) { return k.func === 'power' || k.func === 'neutral'; })) {
      var s = Math.max.apply(null, link.cores.map(function (k) { return Number(k.section) || 2.5; }));
      return { type: 'NYY-J ' + n + '×' + s, cores: n, section: s, why: 'כבל כוח: גיד לכל פאזה, אפס והארקה, בחתך לפי ההגנה בארון המזין.' };
    }
    if (link.cores.some(function (k) { return k.func === 'comm'; })) return { type: 'Cat6 S/FTP', cores: 8, section: 0.25, why: 'קו תקשורת: כבל רשת מסוכך, רחוק מכבלי כוח.' };
    var need = Math.ceil(n * 1.2) + 1;
    var c = CORES.find(function (x) { return x >= need; }) || need;
    var shield = link.cores.some(function (k) { return k.func === 'signal'; });
    return { type: (shield ? 'LiYCY ' : 'LiYY ') + c + '×0.75', cores: c, section: 0.75, why: n + ' גידים בשימוש ועוד כ-20% רזרבה' + (shield ? '; מסוכך בגלל אותות נתונים/אנלוגיים.' : '.') };
  }

  /* אורך: עלייה מראש הארון למגש, לאורך המגש (מנהטן), ירידה לארון השני, 0.5 מ' בכל ארון עד המהדק, ועוד 10% */
  function linkLength(site, link, dims) {
    var A = site.layout[link.a.pid], B = site.layout[link.b.pid];
    if (!A || !B) return null;
    var tray = site.trayH || 2.6;
    var ha = (dims[link.a.pid] || {}).h || 1.2, hb = (dims[link.b.pid] || {}).h || 1.2;
    var run = Math.abs(A.x - B.x) + Math.abs(A.z - B.z);
    var len = (tray - ha) + (tray - hb) + run + 1.0;
    return Math.ceil(len * 1.1 * 10) / 10;
  }

  /* סידור התחלתי: בשורה לאורך הקיר האחורי, עם 0.4 מ' בין ארונות */
  function autoLayout(site, cabs, dims) {
    site.layout = site.layout || {};
    var x = 0.5;
    cabs.forEach(function (c) {
      var d = dims[c.id] || { w: 0.8, d: 0.3 };
      if (!site.layout[c.id]) site.layout[c.id] = { x: x + d.w / 2, z: 0.4 + d.d / 2, rot: 0 };
      x = Math.max(x, site.layout[c.id].x + d.w / 2) + 0.4;
    });
    var maxX = 0;
    cabs.forEach(function (c) { var d = dims[c.id] || { w: 0.8 }; maxX = Math.max(maxX, site.layout[c.id].x + d.w / 2); });
    site.room = site.room || { w: Math.max(6, Math.ceil(maxX + 1.5)), d: 5 };
    return site.layout;
  }

  /* מערך ההתקנה: שלבים עם הסבר, מההכנה ועד המסירה */
  function installSteps(site, cabs, links, dims) {
    var steps = [];
    var tot = links.reduce(function (s, l) { return s + (l.length || 0); }, 0);
    var name = function (pid) { var c = cabs.find(function (x) { return x.id === pid; }); return c ? c.name : '?'; };
    steps.push({ id: 'prep', title: 'הכנת האתר', body: [
      'חדר ' + site.room.w + '×' + site.room.d + ' מ\'. ' + cabs.length + ' ארונות, ' + links.length + ' כבלים בין ארונות, כ-' + Math.round(tot) + ' מ\' כבל.',
      'לפני כל ארון משאירים מרחב עבודה פנוי של כמטר לפחות, ומקום לפתיחת הדלת עד הסוף.',
      'מסמנים על הרצפה את מיקום כל ארון לפי תכנית ההתקנה, ובודקים שאין מכשול לתוואי המגש.'
    ] });
    cabs.forEach(function (c) {
      var d = dims[c.id] || {}, p = site.layout[c.id] || {};
      steps.push({ id: 'place-' + c.id, pid: c.id, title: 'הצבת ' + c.name, body: [
        'מידות ' + Math.round((d.w || 0) * 1000) + '×' + Math.round((d.h || 0) * 1000) + '×' + Math.round((d.d || 0) * 1000) + ' מ"מ, מרכז הארון ' + (p.x || 0).toFixed(2) + ' מ\' מהקיר השמאלי ו-' + (p.z || 0).toFixed(2) + ' מ\' מהקיר האחורי.',
        'מפלסים, מקבעים לרצפה או לקיר (ארון גבוה תמיד מקובע נגד התהפכות), ומחברים את פס ההארקה של הארון להארקת המבנה.',
        'בודקים שהפלטה, הרכיבים והחיווט הפנימי שלמים אחרי ההובלה. החיווט הפנימי מפורט בפרויקט של הארון.'
      ] });
    });
    steps.push({ id: 'tray', title: 'מגש כבלים', body: [
      'מגש סולם / מגש מחורר בגובה ' + (site.trayH || 2.6) + ' מ\' מעל הרצפה, מעל כל הארונות, עם ירידה לכל ארון דרך פלטת הכניסה (PG) בגג או בתחתית.',
      'מחיצה במגש בין כבלי כוח לכבלי פיקוד ותקשורת, או מגשים נפרדים. כבלי תקשורת לפחות 20 ס"מ מכבלי כוח.',
      'המגש עצמו מחובר להארקה בכל קטע (גשר הארקה בין קטעים).'
    ] });
    steps.push({ id: 'bond', title: 'השוואת פוטנציאלים', body: [
      'מחברים את גופי כל הארונות ואת המגש לפס השוואת פוטנציאלים בחדר, בכבל ירוק-צהוב.',
      'בודקים רציפות הארקה בין כל ארון לפס.'
    ] });
    links.forEach(function (l, i) {
      steps.push({ id: 'cable-' + l.id, link: l.id, title: 'כבל W' + (i + 1) + ': ' + name(l.a.pid) + ' ← ' + name(l.b.pid), body: [
        (l.cable ? l.cable.type : 'כבל') + ', אורך כ-' + (l.length || '?') + ' מ\', ' + l.cores.length + ' גידים בשימוש. ' + (l.cable ? l.cable.why : ''),
        'מושכים את הכבל במגש בלי לסובב או לכופף מתחת לרדיוס המותר (בערך פי 10 מקוטר הכבל), ומשאירים לולאת שירות בכל ארון.',
        'מסמנים את הכבל בשני הקצוות (W' + (i + 1) + ' ומאיפה/לאן), מכניסים דרך מפרק כבל (PG) ומהדקים את המפרק.',
        'מחברים כל גיד למהדק שלו לפי טבלת הכבלים, עם שרוול קצה ושרוול סימון.'
      ] });
    });
    steps.push({ id: 'term', title: 'חיבורי שטח בכל ארון', body: cabs.map(function (c) {
      var n = externals(c.P).reduce(function (s, g) { return s + g.cores.length; }, 0);
      return c.name + ': ' + n + ' גידים לשטח. החיווט חוט אחרי חוט — בעמדת החיווט של הארון.';
    }) });
    var feeders = cabs.filter(function (c) { return !links.some(function (l) { return l.kind === 'power' && l.b.pid === c.id; }); });
    steps.push({ id: 'tests', title: 'בדיקות לפני הפעלה', body: [
      'בכל כבל בין ארונות: רציפות לכל גיד (צפצוף מקצה לקצה), ובידוד 500V DC בין הגידים ולהארקה (לפחות 1 MΩ). מנתקים קודם ספקים וכרטיסים.',
      'רציפות הארקה בין הארונות ולפס השוואת הפוטנציאלים.',
      'בדיקה ויזואלית: סימון כבלים, מפרקים מהודקים, מגש סגור.'
    ] });
    steps.push({ id: 'power', title: 'הפעלה ראשונה, לפי הסדר', body: [
      'קודם הארונות שמקבלים הזנה מבחוץ: ' + (feeders.map(function (c) { return c.name; }).join(', ') || '—') + '. אחר כך הארונות שניזונים מהם.',
      'בכל ארון: מודדים מתחי כניסה, סוגרים מפסק ראשי, בודקים פחת בלחצן הבדיקה, מודדים ‎24V בספקים, ורק אז מפעילים בקרים.',
      'בדיקת לולאות (Loop check): לכל אות בין ארונות ולשטח — מפעילים בשטח ובודקים שהכניסה הנכונה נדלקת בבקר, ולהפך ליציאות.'
    ] });
    steps.push({ id: 'handover', title: 'מסירה', body: [
      'מדפיסים לכל ארון את תיק החיווט, ואת טבלת הכבלים של האתר. מכניסים לכיס התכניות בדלת.',
      'תעודת בדיקה של חשמלאי בודק, ומילוי ערכי הבדיקות בטבלאות.'
    ] });
    return steps;
  }

  /* לכל הדק בארון: לאילו ארונות אחרים הוא ממשיך, באיזה כבל וגיד. מפתח: "-X2:5" */
  function refKey(ref) {
    var m = /^(.+?):(.+)$/.exec(String(ref || ''));
    if (!m) return '';
    var tag = m[1].trim().toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z0-9]/.test(tag)) tag = '-' + tag;
    return tag + ':' + m[2].trim().toUpperCase().replace(/\s+/g, '');
  }
  function crossRefs(site, pid) {
    var out = {};
    (site && site.links || []).forEach(function (l, i) {
      var mineA = l.a.pid === pid, mineB = l.b.pid === pid;
      if (!mineA && !mineB) return;
      (l.cores || []).forEach(function (k, ci) {
        var mine = mineA ? k.a : k.b, other = mineA ? k.b : k.a;
        var key = refKey(mine);
        if (!key) return;
        (out[key] = out[key] || []).push({ lid: l.id, no: i + 1, core: ci + 1, peer: mineA ? l.b.pid : l.a.pid, peerRef: other, label: k.label, func: k.func, kind: l.kind });
      });
    });
    return out;
  }

  return { refKey: refKey, crossRefs: crossRefs, externals: externals, suggest: suggest, manualLink: manualLink, cableFor: cableFor, linkLength: linkLength, autoLayout: autoLayout, installSteps: installSteps, powerSection: powerSection };
});
