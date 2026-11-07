/* פשר — מנוע פתרון החלומות: זיהוי, שאלות הבהרה, נושא החלום, פתרון כתוב, תוכנית טיפול, גימטריה,
   ועוד: המילון, היומן והשמיים. הכול רץ בדפדפן; ה־AI הוא תוספת בלבד. */
(function () {
  'use strict';
  var P = window.PESHER, SYMBOLS = P.SYMBOLS, PRINCIPLES = P.PRINCIPLES, SF = P.SF, ASK = P.ASK, THEMES = P.THEMES;
  var AI_SERVER = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var JOURNAL_KEY = 'pesher.journal.v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var B = function (daf) { return SF + 'Berakhot.' + daf + '?lang=he'; };
  var TONE = { good: 'לטובה', mixed: 'לפתור לטובה', care: 'דורש הטבה' };

  // ------------------------------------------------------------------ זיהוי
  function normalize(t) {
    return String(t || '')
      .replace(/[֑-ׇ]/g, '')
      .replace(/[׳']/g, '׳').replace(/[״"]/g, '״')
      .replace(/[^א-ת׳״\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function buildMap(list, keyOf) {
    var m = {};
    list.forEach(function (item) { keyOf(item).forEach(function (k) { k = normalize(k); (m[k] = m[k] || []).push(item); }); });
    return m;
  }
  var SYM = buildMap(SYMBOLS, function (s) { return s.k; });
  var THW = {};
  Object.keys(P.THEME_WORDS).forEach(function (th) { P.THEME_WORDS[th].forEach(function (w) { w = normalize(w); (THW[w] = THW[w] || []).push(th); }); });
  var PREFIXES = ['וכשה', 'ושכש', 'וכש', 'שכש', 'ומה', 'ושה', 'ובה', 'ולה', 'וה', 'וב', 'ול', 'ומ', 'וש', 'וכ', 'שה', 'שב', 'של', 'שמ', 'כש', 'מה', 'בה', 'לה', 'כה',
    'ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'];
  // מילה מלאה קודמת לכל הורדת תחילית, בכל המילונים יחד
  // ואם לא נמצא — הורדת סיומת קלה (השכנה → שכן, צועקת → צועק), רק כשנשארות לפחות שלוש אותיות
  var SUFFIXES = ['ים', 'ות', 'תי', 'נו', 'ה', 'ת'];
  var FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
  function hitOf(w) { return (SYM[w] || THW[w]) ? { s: SYM[w] || [], t: THW[w] || [] } : null; }
  function lookup(tok) {
    var cands = [tok];
    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (tok.length - p.length >= 2 && tok.indexOf(p) === 0) cands.push(tok.slice(p.length));
    }
    for (var j = 0; j < cands.length; j++) { var h = hitOf(cands[j]); if (h) return h; }
    for (j = 0; j < cands.length; j++) {
      for (var k = 0; k < SUFFIXES.length; k++) {
        var c = cands[j], sx = SUFFIXES[k];
        if (c.length - sx.length >= 3 && c.slice(-sx.length) === sx) {
          var stem = c.slice(0, -sx.length), last = stem.slice(-1);
          var h2 = hitOf(stem) || (FINAL[last] && hitOf(stem.slice(0, -1) + FINAL[last]));
          if (h2) return h2;
        }
      }
    }
    return null;
  }
  function analyze(text) {
    var norm = normalize(text), found = {}, order = [], themeWords = {};
    function addSym(s, w) {
      if (!found[s.id]) { found[s.id] = { s: s, words: [] }; order.push(s.id); }
      if (found[s.id].words.indexOf(w) < 0) found[s.id].words.push(w);
    }
    // ביטויים של כמה מילים (״בית כנסת״) — נמחקים אחרי הזיהוי, כדי ש״בית״ לא ייספר שוב לבדו
    var padded = ' ' + norm + ' ', rest = padded;
    function phrase(k) {
      var variants = [k].concat(PREFIXES.map(function (p) { return p + k; }));
      var hit = false;
      variants.forEach(function (v) { if (rest.indexOf(' ' + v + ' ') >= 0) { hit = true; rest = rest.split(' ' + v + ' ').join(' '); } });
      return hit;
    }
    Object.keys(SYM).filter(function (k) { return k.indexOf(' ') > 0; }).sort(function (a, b) { return b.length - a.length; })
      .forEach(function (k) { if (phrase(k)) SYM[k].forEach(function (s) { addSym(s, k); }); });
    Object.keys(THW).forEach(function (k) { if (k.indexOf(' ') > 0 && padded.indexOf(' ' + k + ' ') >= 0) THW[k].forEach(function (t) { themeWords[t] = (themeWords[t] || 0) + 1; }); });
    var tokens = norm.split(' ').filter(Boolean);
    var restTokens = rest.trim().split(' ').filter(Boolean);
    restTokens.forEach(function (tok) {
      var hit = lookup(tok);
      if (!hit) return;
      hit.s.forEach(function (s) { addSym(s, tok); });
      hit.t.forEach(function (t) { themeWords[t] = (themeWords[t] || 0) + 1; });
    });
    return { hits: order.map(function (id) { return found[id]; }), themeWords: themeWords, tokens: tokens };
  }

  // ------------------------------------------------------------------ הפתרון
  function effective(h, answers) {
    var a = ASK[h.s.id], i = answers[h.s.id];
    if (a && i != null && a.o[i]) return { m: a.o[i].m, tone: a.o[i].tone, chosen: a.o[i].l };
    return { m: h.s.m, tone: h.s.tone, chosen: null };
  }

  // תשובה ששאלת ההבהרה מקבלת מתוך מילות החלום עצמו
  function autoAnswers(text, hits, answers) {
    var norm = normalize(text), out = {}, set = {};
    norm.split(' ').forEach(function (tok) {
      set[tok] = 1;
      PREFIXES.forEach(function (p) { if (tok.length - p.length >= 2 && tok.indexOf(p) === 0) set[tok.slice(p.length)] = 1; });
    });
    var padded = ' ' + norm + ' ';
    function has(w) {
      if (w.indexOf(' ') < 0) return !!set[w];
      return padded.indexOf(' ' + w + ' ') >= 0 || PREFIXES.some(function (p) { return padded.indexOf(' ' + p + w + ' ') >= 0; });
    }
    hits.forEach(function (h) {
      var opts = P.ASK_AUTO[h.s.id];
      if (!opts || answers[h.s.id] != null) return;
      var best = -1, bestLen = 0;
      opts.forEach(function (words, i) {
        words.forEach(function (w) { if (has(w) && w.length >= bestLen) { best = i; bestLen = w.length; } });
      });
      if (best >= 0) out[h.s.id] = best;
    });
    return out;
  }

  function interpret(text, ctx, answers) {
    answers = Object.assign({}, answers || {});
    var an = analyze(text);
    var auto = autoAnswers(text, an.hits, answers);
    Object.keys(auto).forEach(function (k) { answers[k] = auto[k]; });
    var hits = an.hits.map(function (h) { var e = effective(h, answers); return { s: h.s, words: h.words, m: e.m, tone: e.tone, chosen: e.chosen }; });

    // נושא החלום
    var score = {};
    hits.forEach(function (h) { score[h.s.theme] = (score[h.s.theme] || 0) + (h.s.note ? 2 : 3); });
    Object.keys(an.themeWords).forEach(function (t) { score[t] = (score[t] || 0) + an.themeWords[t]; });
    if (ctx.feel === 'fear') score.fear = (score.fear || 0) + 2;
    var ranked = Object.keys(score).filter(function (t) { return t !== 'general'; }).sort(function (a, b) { return score[b] - score[a]; });
    var theme = ranked[0] || 'general', theme2 = ranked[1] && score[ranked[1]] >= 2 ? ranked[1] : null;

    // הכרעה
    var pts = 0, care = 0;
    hits.forEach(function (h) { pts += h.tone === 'good' ? 1 : h.tone === 'care' ? -1 : 0; if (h.tone === 'care') care++; });
    var troubled = ctx.feel === 'worry' || ctx.feel === 'fear';
    var verdict;
    if (troubled || care > 0 || pts < 0) verdict = 'care';
    else if (ctx.feel === 'joy' || (hits.length && pts > 0 && pts >= hits.length / 2)) verdict = 'good';
    else if (!hits.length && theme === 'fear') verdict = 'care';
    else verdict = hits.length ? 'mixed' : 'good';

    // סמל מרכזי: מן הגמרא, בנושא המרכזי
    var central = hits.filter(function (h) { return !h.s.note && h.s.theme === theme; })[0] ||
      hits.filter(function (h) { return !h.s.note; })[0] || hits[0] || null;

    var weight = [];
    if (ctx.time === 'dawn') weight.push({ t: 'חלום של שחרית', d: 'חלום שנראה לפנות בוקר הוא מן השלושה שמתקיימים. ראוי לתת עליו את הדעת ולפתור אותו לטובה כבר היום.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.repeat === 'yes') weight.push({ t: 'חלום שנשנה', d: '״ויש אומרים: אף חלום שנשנה״ — חלום חוזר נחשב בעל משקל. מומלץ לעשות הטבת חלום ולבדוק במעשים.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.repeat === 'friend') weight.push({ t: 'חלום שחלם לו חברו', d: 'חלום שחבר חלם עליך הוא מן השלושה שמתקיימים. הודו לו, ופתרו יחד לטובה.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.time === 'day') weight.push({ t: 'שנת יום', d: '״אין מראין לו לאדם אלא מהרהורי לבו״ — חלום של שנת צהריים קרוב לרוב למחשבות היום, ומשקלו מועט.', src: 'ברכות נה:', ref: B('55b') });

    var gem = gematriaHints(an.tokens);
    var res = { text: text, ctx: ctx, answers: answers, auto: auto, hits: hits, verdict: verdict, theme: theme, theme2: theme2, central: central, weight: weight, gem: gem };
    res.story = narrative(res);
    res.plan = plan(res);
    return res;
  }

  function gematriaHints(tokens) {
    var out = [], seen = {};
    tokens.forEach(function (tok) {
      var cands = [tok];
      PREFIXES.forEach(function (p) { if (tok.length - p.length >= 2 && tok.indexOf(p) === 0) cands.push(tok.slice(p.length)); });
      cands.some(function (w) {
        return P.GEMATRIA.some(function (g) {
          if (g.w.indexOf(w) >= 0 && !seen[g.v]) { seen[g.v] = 1; out.push({ word: w, v: P.gematria(w === 'סולם' ? 'סלם' : w), d: g.d }); return true; }
          return false;
        });
      });
    });
    return out;
  }

  // הפתרון הכתוב — פסקאות שנבנות מן הסמלים, מן הנושא ומן ההקשר
  function narrative(r) {
    var th = THEMES[r.theme] || THEMES.general, p = [];
    var open = { good: 'זהו חלום טוב.', mixed: 'יש בחלום הזה סימנים לכאן ולכאן, וכדרכם של חז״ל — פותרים אותו לטובה.', care: 'החלום הזה מבקש הטבה, אבל אין בו גזירה.' }[r.verdict];
    var w = r.weight.length ? ' ' + r.weight.map(function (x) { return x.t; }).join(' ו') + ' — ולכן יש לתת עליו את הדעת.' : '';
    p.push({ h: 'ראשית', t: open + w + ' ״כל החלומות הולכים אחר הפה״: הפתרון שתאמר עליו הוא שיקבע את כיוונו, ולכן אמור בפה מלא — ״חלום טוב ראיתי״.' });

    if (r.central) {
      var c = r.central, others = r.hits.filter(function (h) { return h !== c; });
      var t = 'הסמל המרכזי בחלומך — ' + c.s.name + '. ' + c.m + (c.s.note ? '' : ' (' + c.s.src + ')');
      if (others.length) {
        t += ' לצידו מופיעים ' + others.slice(0, 4).map(function (h) { return h.s.name; }).join(', ') + ': ' +
          others.slice(0, 3).map(function (h) { return firstSentence(h.m); }).join(' ');
      }
      p.push({ h: 'לב החלום', t: t });
    } else {
      p.push({ h: 'לב החלום', t: 'בחלומך לא מופיע סמל שחז״ל פירשו במפורש, ולכן הפתרון נשען על הנושא שעולה ממנו ועל עקרונות הסוגיה. ״אין מראין לו לאדם אלא מהרהורי לבו״ — החלום משקף את מה שהנפש עסוקה בו עכשיו.' });
    }

    var msg = (r.verdict === 'care' ? th.care : th.good);
    if (r.theme2 && THEMES[r.theme2]) msg += ' יש בו גם צד של ' + THEMES[r.theme2].name + '.';
    p.push({ h: 'המסר — ' + th.name, t: msg });

    var inner = th.inner;
    if (r.gem.length) inner += ' ויש בחלום רמז במניין: ' + r.gem.map(function (g) { return g.d; }).join(' ');
    p.push({ h: 'המימד הפנימי', t: inner });

    p.push({ h: 'הלכה למעשה', t: (r.verdict === 'care' ? 'מחר בבוקר — הטבת חלום בפני שלושה אוהבים, וצדקה לפני התפילה. ' : 'בבוקר — להודות ולשמוח בחלום. ') + th.act + ' ובלילה — קריאת שמע שעל המיטה בכוונה. התוכנית המלאה מופיעה למטה.' });
    return p;
  }
  function firstSentence(s) { var i = s.indexOf('.'); return i > 0 ? s.slice(0, i + 1) : s; }

  function plan(r) {
    var th = THEMES[r.theme] || THEMES.general;
    var pesukim = r.hits.filter(function (h) { return h.s.pasuk; });
    var morning = [], day = [], night = [], week = [];
    morning.push({ t: 'לומר ״חלום טוב ראיתי״', d: 'לפני שמספרים לאחרים — ולספר רק לאוהב.', src: 'ברכות נה:', ref: B('55b') });
    pesukim.forEach(function (h) { morning.push({ t: 'להקדים פסוק — ' + h.s.name, d: h.s.pasuk, src: h.s.src, ref: h.s.ref, verse: true }); });
    if (r.verdict === 'care') {
      morning.push({ t: 'הטבת חלום בפני שלושה', d: 'אחרי שחרית, לפי הסדר המלא שבאתר.', src: 'שו״ע או״ח רכ', ref: SF + 'Shulchan_Arukh,_Orach_Chayim.220?lang=he', link: '#hatava' });
      morning.push({ t: 'תפילה בשעת ברכת כהנים', d: '״ריבונו של עולם, אני שלך וחלומותיי שלך…״', src: 'ברכות נה:', ref: B('55b'), link: '#hatava' });
      day.push({ t: 'צדקה כנגד החלום', d: '״שלושה דברים מבטלים גזירה קשה: תפילה, צדקה ותשובה״.', src: 'ירושלמי תענית ב:א', ref: SF + 'Jerusalem_Talmud_Taanit.2.1?lang=he' });
    } else {
      day.push({ t: 'לשמוח בחלום', d: '״חלום טוב — שמחה שבו מספקתו״. שתפו בשמחה אדם קרוב.', src: 'ברכות נה.', ref: B('55a') });
    }
    day.push({ t: 'מעשה לפי נושא החלום', d: th.act });
    night.push({ t: 'תהילים לפני השינה', d: th.ps.map(function (x) { return 'פרק ' + heb(x.n); }).join(' ו'), ref: th.ps[0].ref, src: 'ספר תהילים', psalms: th.ps });
    night.push({ t: 'קריאת שמע שעל המיטה', d: 'חשבון נפש קצר, מחילה לכל מי שציער, ו״בידך אפקיד רוחי״. כך הנשמה עולה בשינה מוכנה.', src: 'ברכות ד:–ה.', ref: SF + 'Berakhot.5a?lang=he' });
    if (r.theme === 'soul' || r.hits.some(function (h) { return h.s.id === 'dead'; })) week.push({ t: 'לעילוי נשמה', d: 'משניות, קדיש או צדקה לעילוי נשמת הנפטר שבחלום.' });
    if (r.ctx.repeat === 'yes') week.push({ t: 'לעקוב אחרי החלום', d: 'רשמו ביומן אם הוא חוזר. חלום שחוזר ומפחיד — שתפו אדם קרוב, ואם הוא פוגע בשינה פנו לאיש מקצוע.' });
    if (r.verdict === 'care' && (r.ctx.repeat === 'yes' || r.ctx.feel === 'fear')) week.push({ t: 'תענית חלום — רק בהוראת רב', d: '״יפה תענית לחלום כאש לנעורת״; בדורנו רבים מורים להמיר אותה בצדקה. אל תתענו בלי לשאול רב.', src: 'שבת יא.; שו״ע או״ח רכ', ref: SF + 'Shabbat.11a?lang=he' });
    week.push({ t: 'לבדוק את הפתרון בעוד שבוע', d: 'חזרו ליומן החלומות וראו מה התקיים. ״אין חלום בלא דברים בטלים״ — שימו לב לעיקר.' });
    return [{ k: 'בבוקר', i: '🌅', items: morning }, { k: 'במהלך היום', i: '☀️', items: day }, { k: 'לפני השינה', i: '🌙', items: night }, { k: 'בימים הקרובים', i: '📅', items: week }];
  }
  function heb(n) {
    var ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'], tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'], h = ['', 'ק', 'ר', 'ש', 'ת'];
    var s = h[Math.floor(n / 100)] || ''; n %= 100;
    if (n === 15) return s + 'טו'; if (n === 16) return s + 'טז';
    return s + tens[Math.floor(n / 10)] + ones[n % 10];
  }

  // ------------------------------------------------------------------ תצוגה
  function srcLine(o) {
    if (!o.src && !o.link) return '';
    var a = o.ref ? '<a href="' + esc(o.ref) + '" target="_blank" rel="noopener">' + esc(o.src) + '</a>' : esc(o.src || '');
    return '<div class="src">📜 ' + a + (o.note ? ' <span class="note">· רוח הדברים</span>' : '') + (o.link ? ' · <a href="' + o.link + '">לסדר המלא</a>' : '') + '</div>';
  }
  function askBlock(h, answers) {
    var a = ASK[h.s.id]; if (!a) return '';
    return '<div class="ask"><span>' + esc(a.q) + '</span><div class="chips solo">' + a.o.map(function (o, i) {
      return '<button type="button" data-ask="' + h.s.id + '" data-i="' + i + '" class="' + (answers[h.s.id] === i ? 'on' : '') + '">' + esc(o.l) + '</button>';
    }).join('') + '</div></div>';
  }
  function symCard(h, answers) {
    return '<article class="sym ' + h.tone + '">' +
      '<header><h4>' + esc(h.s.name) + '</h4><span class="tag ' + h.tone + '">' + TONE[h.tone] + '</span></header>' +
      '<span class="hit">זוהה במילים: ' + h.words.map(esc).join(', ') + '</span>' +
      '<p>' + esc(h.m) + '</p>' +
      (current && current.auto && current.auto[h.s.id] != null ? '<span class="hit">✓ הוכרע לפי מילות החלום — אפשר לשנות:</span>' : '') +
      askBlock(h, answers) +
      (h.s.pasuk ? '<div class="pasuk"><small>יקדים ויאמר:</small>' + esc(h.s.pasuk) + '</div>' : '') +
      srcLine(h.s) + '</article>';
  }
  var VERDICT = {
    good: { seal: 'חלום<br>טוב', h: 'חלום לטובה' },
    mixed: { seal: 'פשר<br>לטובה', h: 'חלום מעורב — פותרים לטובה' },
    care: { seal: 'להטיב<br>חלום', h: 'חלום שכדאי להטיב' }
  };
  var current = null;
  function render(res, opts) {
    current = res;
    var v = VERDICT[res.verdict], th = THEMES[res.theme] || THEMES.general, el = $('#result');
    var open = res.hits.filter(function (h) { return ASK[h.s.id] && res.answers[h.s.id] == null; });
    var html = '<div class="verdict"><div class="seal">' + v.seal + '</div><div><span class="theme-badge">' + th.icon + ' ' + esc(th.name) +
      (res.theme2 ? ' · ' + esc(THEMES[res.theme2].name) : '') + '</span><h3>' + v.h + '</h3>' +
      '<div class="meta-tags">' + res.hits.map(function (h) { return '<span class="tag ' + h.tone + '">' + esc(h.s.name) + '</span>'; }).join('') + '</div></div></div>';

    if (open.length) {
      html += '<div class="clarify"><b>כדי לדייק את הפתרון</b> — הגמרא מבחינה בין מצבים שונים. ענו על ' + (open.length === 1 ? 'השאלה' : open.length + ' השאלות') + ' בכרטיסים שלמטה, והפתרון יתעדכן מיד.</div>';
    }

    html += '<div class="story">' + res.story.map(function (s) { return '<section><h4>' + esc(s.h) + '</h4><p>' + esc(s.t) + '</p></section>'; }).join('') + '</div>';

    if (res.weight.length) {
      html += '<h3 class="res-h">משקל החלום</h3><div class="principle-hits">' + res.weight.map(function (w) {
        return '<blockquote><b>' + esc(w.t) + '.</b> ' + esc(w.d) + srcLine(w) + '</blockquote>';
      }).join('') + '</div>';
    }

    html += '<h3 class="res-h">פירוש הפרטים</h3>';
    if (res.hits.length) html += '<div class="sym-cards">' + res.hits.map(function (h) { return symCard(h, res.answers); }).join('') + '</div>';
    else html += '<div class="empty-note">לא זוהה סמל מן המילון, והפתרון נבנה מנושא החלום. כדי להעמיק — הוסיפו פרטים (בעלי חיים, מקומות, חפצים, אנשים, צבעים), או בקשו חוות דעת מורחבת למטה.</div>';

    html += '<h3 class="res-h">תוכנית הטיפול בחלום</h3><div class="plan">' + res.plan.map(function (col) {
      return '<div class="plan-col"><h4><span>' + col.i + '</span>' + esc(col.k) + '</h4><ul>' + col.items.map(function (it) {
        var d = it.psalms ? it.psalms.map(function (x) { return '<a href="' + esc(x.ref) + '" target="_blank" rel="noopener">תהילים ' + heb(x.n) + '</a>'; }).join(' · ') :
          (it.verse ? '<span class="verse">' + esc(it.d) + '</span>' : esc(it.d));
        return '<li><label><input type="checkbox" /><span><b>' + esc(it.t) + '</b><em>' + d + '</em>' + (it.psalms ? '' : srcLine(it)) + '</span></label></li>';
      }).join('') + '</ul></div>';
    }).join('') + '</div>';

    html += '<div class="ai-box"><div class="row"><div><h4>חוות דעת מורחבת</h4><p class="small">פירוש אישי נוסף בכתיבה חופשית, ברוח חז״ל, הזוהר והקבלה. הפתרון שלמעלה שלם גם בלעדיה.</p></div>' +
      '<button class="btn gold small" type="button" id="aiBtn">בקשו חוות דעת</button></div><div id="aiOut" class="ai-out" hidden></div></div>';

    html += '<div class="res-actions"><button class="btn ghost small" type="button" id="copyBtn">העתקת הפתרון</button>' +
      '<a class="btn ghost small" id="waBtn" target="_blank" rel="noopener">שליחה בוואטסאפ</a>' +
      '<button class="btn ghost small" type="button" id="printBtn">הדפסה</button>' +
      '<a class="btn ghost small" href="#hatava">לסדר הטבת חלום</a></div>';

    el.innerHTML = html; el.hidden = false;
    $('#aiBtn').addEventListener('click', function () { deepAI(current, this); });
    $('#copyBtn').addEventListener('click', function () { copyText(current, this); });
    $('#printBtn').addEventListener('click', function () { printPart('print-result'); });
    $('#waBtn').href = 'https://wa.me/?text=' + encodeURIComponent(plain(res).slice(0, 3500));
    if (!opts || !opts.keepScroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#result').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ask]'); if (!b || !current) return;
    var ans = Object.assign({}, current.answers); ans[b.dataset.ask] = +b.dataset.i;
    var y = window.scrollY;
    var res = interpret(current.text, current.ctx, ans);
    render(res, { keepScroll: true }); window.scrollTo(0, y);
    jUpdate(res);
  });

  function plain(res) {
    var v = VERDICT[res.verdict], th = THEMES[res.theme] || THEMES.general;
    var out = ['פשר — פתרון החלום', '', 'החלום: ' + res.text, '', v.h + ' · ' + th.name, ''];
    res.story.forEach(function (s) { out.push(s.h + ': ' + s.t, ''); });
    if (res.hits.length) { out.push('פירוש הפרטים:'); res.hits.forEach(function (h) { out.push('• ' + h.s.name + ': ' + h.m + (h.s.pasuk ? ' | יקדים ויאמר: ' + h.s.pasuk : '') + ' (' + h.s.src + ')'); }); out.push(''); }
    out.push('תוכנית הטיפול:');
    res.plan.forEach(function (c) { out.push(c.k + ':'); c.items.forEach(function (it) { out.push('  – ' + it.t + (it.psalms ? ' (' + it.d + ')' : it.d ? ': ' + it.d : '')); }); });
    return out.join('\n');
  }
  function copyText(res, btn) {
    var t = plain(res);
    var done = function () { btn.textContent = 'הועתק ✓'; setTimeout(function () { btn.textContent = 'העתקת הפתרון'; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { fallbackCopy(t); done(); });
    else { fallbackCopy(t); done(); }
  }
  function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
  function printPart(cls) {
    document.body.classList.add(cls);
    var off = function () { document.body.classList.remove(cls); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    window.print();
    setTimeout(off, 1500);
  }

  // ------------------------------------------------------------------ AI (תוספת)
  var AI_ERR = {
    quota: 'המכסה היומית של חוות הדעת המורחבת נגמרה. נסו שוב מחר.',
    'rate-limited': 'יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות.',
    'no-key': 'חוות הדעת המורחבת עדיין לא הופעלה בשרת.',
    offline: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
    forbidden: 'חוות הדעת המורחבת פועלת רק מכתובת האתר הרשמית.'
  };
  function deepAI(res, btn) {
    var out = $('#aiOut');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> כותב…';
    out.hidden = false; out.className = 'ai-out'; out.textContent = '';
    var feel = { joy: 'בשמחה', calm: 'רגוע', worry: 'מוטרד', fear: 'מפוחד' }[res.ctx.feel];
    var time = { night: 'בלילה', dawn: 'לפנות בוקר', day: 'בשנת יום' }[res.ctx.time];
    var rep = { no: 'פעם ראשונה', yes: 'חלום חוזר', friend: 'חבר חלם עליו' }[res.ctx.repeat];
    var prompt = [
      'אתה פותר חלומות ירא שמים, הבקיא בסוגיית החלומות בבבלי ברכות נה–נז, בחלומות התורה, בזוהר ובספרות הקבלה.',
      'כתוב בעברית פירוש אישי וחם לחלום הבא, ב־4 עד 6 פסקאות קצרות, שמחבר את כל הפרטים לסיפור אחד בעל משמעות.',
      'כללים: פתור תמיד לטובה (״כל החלומות הולכים אחר הפה״). אל תנבא אסון, מוות או מחלה. אל תמציא מקורות — צטט רק מקור שאתה בטוח בו, ואם אינך בטוח כתוב ״ברוח המקורות״. אל תיתן ייעוץ רפואי.',
      'סיים בשלוש המלצות מעשיות.',
      '',
      'החלום: ' + res.text,
      'מתי: ' + time + '. הרגשה בהתעוררות: ' + feel + '. ' + rep + '.',
      'נושא מרכזי שזוהה: ' + (THEMES[res.theme] || THEMES.general).name + '.',
      res.hits.length ? 'סמלים לפי המקורות: ' + res.hits.map(function (h) { return h.s.name + ' — ' + h.m + ' (' + h.s.src + ')'; }).join(' | ') : ''
    ].join('\n');
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 90000);
    fetch(AI_SERVER, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'ai', prompt: prompt }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad-response' }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; })
      .then(function (j) {
        clearTimeout(timer);
        if (j && j.ok && j.text) out.textContent = String(j.text).replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
        else { out.className = 'ai-out err'; out.textContent = (AI_ERR[j && j.error] || 'חוות הדעת המורחבת לא זמינה כרגע.') + ' הפתרון ותוכנית הטיפול שלמעלה מבוססים על המקורות ועומדים בפני עצמם.'; }
        btn.disabled = false; btn.textContent = 'חוות דעת נוספת';
      });
  }

  // ------------------------------------------------------------------ יומן (בדפדפן בלבד)
  function jLoad() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []; } catch (e) { return []; } }
  function jSave(list) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) {} }
  function entry(res, id) { return { id: id || Date.now(), date: new Date().toISOString(), text: res.text, ctx: res.ctx, answers: res.answers, verdict: res.verdict, theme: res.theme, syms: res.hits.map(function (h) { return h.s.name; }) }; }
  function jAdd(res) { var list = jLoad().filter(function (x) { return x.text !== res.text; }); list.unshift(entry(res)); jSave(list); jRender(); }
  function jUpdate(res) { var list = jLoad(); list.forEach(function (x, i) { if (x.text === res.text) list[i] = entry(res, x.id); }); jSave(list); jRender(); }
  function jRender() {
    var list = jLoad(), el = $('#journalList');
    if (!list.length) { el.innerHTML = '<div class="empty-note">עדיין אין חלומות ביומן. כל חלום שתפתרו יישמר כאן.</div>'; return; }
    var counts = {}, themes = {};
    list.forEach(function (x) { (x.syms || []).forEach(function (n) { counts[n] = (counts[n] || 0) + 1; }); if (x.theme) themes[x.theme] = (themes[x.theme] || 0) + 1; });
    var rec = Object.keys(counts).filter(function (n) { return counts[n] > 1; });
    var topTheme = Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; })[0];
    var insight = '';
    if (list.length > 1 && topTheme && THEMES[topTheme]) insight += 'הנושא שחוזר בחלומות שלך: <b>' + esc(THEMES[topTheme].name) + '</b>. ';
    if (rec.length) insight += 'סמלים שחוזרים: <b>' + rec.map(esc).join(', ') + '</b>. ״יש אומרים: אף חלום שנשנה״ — כדאי לתת עליהם את הדעת.';
    el.innerHTML = (insight ? '<div class="empty-note">' + insight + '</div>' : '') +
      list.map(function (x) {
        var d = new Date(x.date);
        return '<div class="j-item" data-id="' + x.id + '"><div><div class="d">' + d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) +
          ' · <span class="tag ' + x.verdict + '">' + TONE[x.verdict] + '</span>' + (x.theme && THEMES[x.theme] ? ' · ' + THEMES[x.theme].icon + ' ' + esc(THEMES[x.theme].name) : '') + '</div>' +
          '<div class="t">' + esc(x.text) + '</div></div><div class="acts"><button class="btn ghost small" data-act="open">לפתרון</button><button class="btn ghost small" data-act="del" aria-label="מחיקה">✕</button></div></div>';
      }).join('');
  }
  $('#journalList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = +b.closest('.j-item').dataset.id, list = jLoad(), item = list.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    if (b.dataset.act === 'del') { jSave(list.filter(function (x) { return x.id !== id; })); jRender(); return; }
    $('#dreamText').value = item.text;
    var ctx = item.ctx || readCtx();
    ['time', 'feel', 'repeat'].forEach(function (n) { var r = document.querySelector('input[name=' + n + '][value=' + ctx[n] + ']'); if (r) r.checked = true; });
    render(interpret(item.text, ctx, item.answers || {}));
  });

  // ------------------------------------------------------------------ טופס
  function readCtx() {
    var v = function (n) { var r = document.querySelector('input[name=' + n + ']:checked'); return r ? r.value : ''; };
    return { time: v('time'), feel: v('feel'), repeat: v('repeat') };
  }
  $('#dreamForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('#dreamText').value.trim();
    if (t.length < 4) { $('#dreamText').focus(); return; }
    var res = interpret(t, readCtx(), {});
    render(res); jAdd(res);
  });
  var SAMPLES = [
    'חלמתי שאני עולה על הר גבוה, ולמטה זורם נהר. פתאום עפה מעליי יונה לבנה, ומצאתי באר עם מים צלולים. ליד הבאר עמד סבא שלי ז״ל ונתן לי אתרוג.',
    'חלמתי שנחש גדול נכנס הביתה ונשך אותי ביד. אחר כך הלכתי לעבודה והבוס נתן לי מפתח לדלת חדשה.',
    'חלמתי שאני נוסע ברכב בכביש חשוך, פתאום אין בלמים, ואני מפחד מאוד. בסוף הגעתי לבית כנסת והתפללתי.'
  ];
  var sampleIdx = 0;
  $('#sampleBtn').addEventListener('click', function () {
    $('#dreamText').value = SAMPLES[sampleIdx++ % SAMPLES.length];
    $('#dreamText').focus();
  });

  // ------------------------------------------------------------------ מחשבון גימטריה
  var gIn = $('#gemInput');
  if (gIn) gIn.addEventListener('input', function () {
    var w = normalize(gIn.value).replace(/\s/g, '');
    var v = P.gematria(w), out = $('#gemOut');
    if (!w) { out.innerHTML = ''; return; }
    var same = P.GEMATRIA.filter(function (g) { return g.v === v; })[0];
    out.innerHTML = '<b>' + v + '</b>' + (same ? '<span>' + esc(same.d) + '</span>' : '<span>אין במאגר שוויון מוכר במקורות למניין הזה.</span>');
  });

  // ------------------------------------------------------------------ המילון
  var cats = ['הכול'].concat(SYMBOLS.map(function (s) { return s.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
  var curCat = 'הכול';
  $('#dictCats').innerHTML = cats.map(function (c) { return '<button type="button" class="' + (c === curCat ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  $('#dictCats').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    curCat = b.dataset.cat;
    [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
    dictRender();
  });
  $('#dictSearch').addEventListener('input', dictRender);
  function dictRender() {
    var q = normalize($('#dictSearch').value);
    var list = SYMBOLS.filter(function (s) {
      if (curCat !== 'הכול' && s.cat !== curCat) return false;
      if (!q) return true;
      return s.name.indexOf(q) >= 0 || s.k.some(function (k) { return k.indexOf(q) >= 0; }) || s.m.indexOf(q) >= 0;
    });
    var total = list.length, more = !q && !dictAll && total > 24;
    if (more) list = list.slice(0, 24);
    $('#dictGrid').innerHTML = list.length ? list.map(function (s) {
      var a = ASK[s.id];
      return '<button type="button" class="dict-item" aria-expanded="false"><span class="top"><b>' + esc(s.name) + '</b><span class="dot ' + s.tone + '" title="' + TONE[s.tone] + '"></span></span>' +
        '<span class="cat">' + esc(s.cat) + ' · ' + esc(s.src) + (s.note ? ' · רוח הדברים' : '') + '</span><span class="sum">' + esc(s.m) + '</span>' +
        '<span class="more">' + (a ? '<span class="variants">' + a.o.map(function (o) { return '<span><b>' + esc(o.l) + ':</b> ' + esc(o.m) + '</span>'; }).join('') + '</span>' : '') +
        (s.pasuk ? '<span class="pasuk"><small>יקדים ויאמר:</small>' + esc(s.pasuk) + '</span>' : '') +
        (s.ref ? '<span class="src">📜 <a href="' + esc(s.ref) + '" target="_blank" rel="noopener">לטקסט המלא בספריא</a></span>' : '') + '</span></button>';
    }).join('') + (more ? '<button type="button" class="btn ghost dict-more" id="dictMore">הצגת כל ' + total + ' הסמלים</button>' : '') :
      '<div class="empty-note">לא נמצא סמל כזה במילון. תארו את החלום בטופס — הפתרון נבנה גם מנושא החלום.</div>';
  }
  var dictAll = false;
  $('#dictGrid').addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    if (e.target.closest('#dictMore')) { dictAll = true; dictRender(); return; }
    var b = e.target.closest('.dict-item'); if (!b) return;
    b.classList.toggle('open'); b.setAttribute('aria-expanded', b.classList.contains('open'));
  });

  // ------------------------------------------------------------------ עקרונות, מספרים, ניווט
  $('#principles').innerHTML = PRINCIPLES.map(function (p) {
    return '<div class="pr"><h4>' + esc(p.t) + '</h4><p>' + esc(p.d) + '</p>' + srcLine(p) + '</div>';
  }).join('');
  $('#countSymbols').textContent = SYMBOLS.length;
  var hb = document.querySelector('.hatava-actions button');
  if (hb) { hb.removeAttribute('onclick'); hb.addEventListener('click', function () { printPart('print-hatava'); }); }

  if ('IntersectionObserver' in window) {
    var links = {};
    [].forEach.call(document.querySelectorAll('.nav nav a'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  dictRender(); jRender();
  window.PESHER.interpret = interpret;   // לבדיקות

  // ------------------------------------------------------------------ שמי הלילה
  (function sky() {
    var c = $('#sky'), x = c.getContext && c.getContext('2d');
    if (!x) return;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stars = [], shoot = null, W, H, dpr;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(W * H / 5200);
      stars = [];
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + .2, p: Math.random() * 6.28, s: .4 + Math.random() * 1.4, g: Math.random() < .12 });
      if (still) draw(0);
    }
    function draw(t) {
      x.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], a = .35 + .65 * (.5 + .5 * Math.sin(s.p + t * .001 * s.s));
        x.globalAlpha = a; x.fillStyle = s.g ? '#f3d99b' : '#e9e6f5';
        x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.283); x.fill();
      }
      if (!still) {
        if (!shoot && Math.random() < .003) shoot = { x: Math.random() * W, y: Math.random() * H * .4, l: 0 };
        if (shoot) {
          shoot.l += 1;
          var len = 90, px = shoot.x - shoot.l * 7, py = shoot.y + shoot.l * 3.2;
          var gr = x.createLinearGradient(px, py, px + len, py - len * .45);
          gr.addColorStop(0, 'rgba(243,217,155,.9)'); gr.addColorStop(1, 'rgba(243,217,155,0)');
          x.globalAlpha = Math.max(0, 1 - shoot.l / 60); x.strokeStyle = gr; x.lineWidth = 1.3;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + len, py - len * .45); x.stroke();
          if (shoot.l > 60) shoot = null;
        }
        requestAnimationFrame(draw);
      }
      x.globalAlpha = 1;
    }
    addEventListener('resize', size);
    size();
    if (!still) requestAnimationFrame(draw);
  })();
})();
