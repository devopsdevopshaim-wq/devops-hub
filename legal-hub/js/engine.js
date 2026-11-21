/* מצפן משפטי — מנוע ההבנה: מזהה מתוך טקסט חופשי את התחום, את המצב ואת סימני הדחיפות. */
(function () {
  var LAW = window.LAW;
  var FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  var PREFIX = 'והבכלמש';

  function norm(s) {
    return String(s || '')
      .replace(/[֑-ׇ]/g, '')
      .replace(/[״׳"'`]/g, '')
      .replace(/[ךםןףץ]/g, function (c) { return FINALS[c]; })
      .replace(/[^א-תa-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // צורות אפשריות של מילה: בלי אותיות שימוש בתחילתה, ובלי סיומות ריבוי/שייכות נפוצות
  function variants(w, noPrefix) {
    var out = [w], i, base;
    for (i = 1; !noPrefix && i <= 3 && i < w.length - 1; i++) {
      if (PREFIX.indexOf(w[i - 1]) < 0) break;
      out.push(w.slice(i));
    }
    out.slice().forEach(function (v) {
      ['ימ', 'ות', 'תי', 'נו', 'כמ', 'ה', 'י', 'ו', 'ת'].forEach(function (suf) {
        if (v.length - suf.length >= 3 && v.slice(-suf.length) === suf) { base = v.slice(0, -suf.length); if (out.indexOf(base) < 0) out.push(base); }
      });
    });
    return out;
  }

  // הכנה חד־פעמית של מילות המפתח
  var INDEX = [];
  function keys(str) { return String(str || '').split('|').map(norm).filter(Boolean); }
  LAW.AREAS.forEach(function (a) {
    a._k = keys(a.k);
    a.issues.forEach(function (it) { it.area = a; it._k = keys(it.k).concat(keys(it.q)); INDEX.push(it); });
  });

  function prep(text) {
    var toks = norm(text).split(' ').filter(Boolean);
    var vars = toks.map(function (t) { return variants(t); });
    return { vars: vars, flat: [].concat.apply([], vars) };
  }

  function tokMatch(vs, kw, kv) {
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (v === kw || kv.indexOf(v) >= 0) return true;
      if (kw.length >= 4 && v.length > kw.length && v.indexOf(kw) === 0 && v.length - kw.length <= 3) return true;
    }
    return false;
  }
  function single(p, kw) {
    var kv = variants(kw, true);
    for (var i = 0; i < p.vars.length; i++) if (tokMatch(p.vars[i], kw, kv)) return true;
    return false;
  }
  function hit(p, kw) {
    if (kw.indexOf(' ') < 0) return single(p, kw) ? 1 : 0;
    var words = kw.split(' '), kvs = words.map(function (w) { return variants(w, true); });
    for (var s = 0; s + words.length <= p.vars.length; s++) {
      var ok = true;
      for (var j = 0; j < words.length && ok; j++) ok = tokMatch(p.vars[s + j], words[j], kvs[j]);
      if (ok) return 1;
    }
    // ביטוי שמילותיו המשמעותיות מופיעות בטקסט, לא בהכרח ברצף
    var parts = words.filter(function (w) { return w.length >= 3; });
    if (parts.length >= 2 && parts.every(function (w) { return single(p, w); })) return 0.6;
    return 0;
  }

  var FLAGS = [
    { id: 'danger', re: /(מרביצ|הרביצ|מכה אות|היכה|איימ|מאיימ|סכינ|אקדח|נשק|חנק|אלימ|תקפ|נאנס|אונס|פוחד(ת)? לחיי)/, title: 'נשמע שיש כאן סכנה', text: 'אם יש סכנה מיידית — חייגו 100. למוקד הרווחה (אלימות במשפחה) — 118. אפשר לקבל צו הגנה עוד היום, בלי עורך דין ובלי אגרה.', tel: [['100', 'משטרה'], ['118', 'מוקד הרווחה']] },
    { id: 'self', re: /(להתאבד|לשים קצ|לא רוצה לחיות|לפגוע בעצמי)/, title: 'אתם לא לבד', text: 'ער״ן — עזרה ראשונה נפשית, 24 שעות: 1201. אפשר גם בצ׳אט באתר ער״ן.', tel: [['1201', 'ער״ן']] },
    { id: 'arrest', re: /(נעצר|עצרו|עצור|במעצר|עצורה|מעצר)/, title: 'מעצר — זכויות מיידיות', text: 'לעצור יש זכות להיוועץ בעורך דין, להודיע לקרוב, ולהיות מובא לשופט בתוך 24 שעות. מי שאין לו עו״ד — הסנגוריה הציבורית.' },
    { id: 'deadline', re: /(מחר|היום|השבוע|דיונ|מועד|כתב תביעה|אזהרה|פסק דינ|ימימ|עוד יומיימ|הוצאה לפועל)/, title: 'בדקו את המועד עכשיו', text: 'בשאלה מופיע מועד או מסמך משפטי. בפרק ״מועדים״ למטה רשומים המועדים הרלוונטיים — אם המועד קרוב, פנו לייעוץ עוד היום.' }
  ];

  function analyze(text) {
    var p = prep(text), scores = [];
    var areaScore = {};
    LAW.AREAS.forEach(function (a) {
      var s = 0; a._k.forEach(function (kw) { s += hit(p, kw); }); areaScore[a.id] = s;
    });
    INDEX.forEach(function (it) {
      var s = 0, matched = [];
      it._k.forEach(function (kw) { var h = hit(p, kw); if (h) { s += h * (2 + kw.split(' ').length); matched.push(kw); } });
      s += Math.min(areaScore[it.area.id], 3) * 0.8;
      if (s > 0) scores.push({ it: it, s: s, m: matched });
    });
    scores.sort(function (a, b) { return b.s - a.s; });
    var top = scores[0];
    var confident = !!(top && top.m.length && top.s >= 3);
    var related = scores.slice(1).filter(function (x) { return x.m.length && x.s >= Math.max(3, top.s * 0.45); }).slice(0, 3);
    var areas = LAW.AREAS.filter(function (a) { return areaScore[a.id] > 0; }).sort(function (a, b) { return areaScore[b.id] - areaScore[a.id]; }).slice(0, 3);
    var raw = norm(text);
    var flags = FLAGS.filter(function (f) { return f.re.test(raw); });
    // דחיפות מהמצב עצמו
    if (confident && top.it.u === 2 && !flags.some(function (f) { return f.id === 'danger'; }) && top.it.area.id === 'violence') flags.unshift(FLAGS[0]);
    return { text: text, issue: confident ? top.it : null, score: top ? top.s : 0, related: related.map(function (x) { return x.it; }), areas: areas, flags: flags };
  }

  function byId(id) { for (var i = 0; i < INDEX.length; i++) if (INDEX[i].id === id) return INDEX[i]; return null; }
  function search(q) {
    var p = prep(q), res = [];
    if (!p.flat.length) return res;
    INDEX.forEach(function (it) {
      var hay = norm(it.q + ' ' + it.s + ' ' + it.k.replace(/\|/g, ' '));
      var s = 0;
      p.flat.forEach(function (w) { if (w.length >= 2 && hay.indexOf(w) >= 0) s++; });
      if (s) res.push({ it: it, s: s });
    });
    return res.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.it; }).slice(0, 12);
  }

  window.ENGINE = { _dbg: function (t) { var p = prep(t); return INDEX.map(function (it) { return [it.id, it._k.filter(function (k) { return hit(p, k); })]; }).filter(function (x) { return x[1].length; }); }, analyze: analyze, byId: byId, search: search, norm: norm, all: INDEX };
})();
