/* פשר — מנוע פתרון החלומות, המילון, היומן והשמיים. */
(function () {
  'use strict';
  var P = window.PESHER, SYMBOLS = P.SYMBOLS, PRINCIPLES = P.PRINCIPLES, SF = P.SF;
  var AI_SERVER = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var JOURNAL_KEY = 'pesher.journal.v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var B = function (daf) { return SF + 'Berakhot.' + daf + '?lang=he'; };
  var TONE = { good: 'לטובה', mixed: 'לפתור לטובה', care: 'דורש תיקון' };

  // ------------------------------------------------------------------ matching
  function normalize(t) {
    return String(t || '')
      .replace(/[֑-ׇ]/g, '')            // ניקוד וטעמים
      .replace(/[׳']/g, '׳').replace(/[״"]/g, '״')
      .replace(/[^א-ת׳״\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  var KEYMAP = {};   // מילה → [סמלים]
  SYMBOLS.forEach(function (s) {
    s.k.forEach(function (k) { k = normalize(k); (KEYMAP[k] = KEYMAP[k] || []).push(s); });
  });
  var PREFIXES = ['ושכש', 'וכש', 'שכש', 'וכשה', 'ומה', 'ושה', 'וה', 'וב', 'ול', 'ומ', 'וש', 'וכ', 'שה', 'שב', 'של', 'שמ', 'כש', 'מה', 'בה', 'לה', 'כה',
    'ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'];
  function lookup(tok) {
    if (KEYMAP[tok]) return { syms: KEYMAP[tok], word: tok };
    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (tok.length - p.length >= 2 && tok.indexOf(p) === 0) {
        var rest = tok.slice(p.length);
        if (KEYMAP[rest]) return { syms: KEYMAP[rest], word: tok };
      }
    }
    return null;
  }
  function findSymbols(text) {
    var norm = normalize(text), found = {}, order = [];
    function add(s, w) {
      if (!found[s.id]) { found[s.id] = { s: s, words: [] }; order.push(s.id); }
      if (found[s.id].words.indexOf(w) < 0) found[s.id].words.push(w);
    }
    // ביטויים של כמה מילים
    Object.keys(KEYMAP).forEach(function (k) {
      if (k.indexOf(' ') > 0 && (' ' + norm + ' ').indexOf(' ' + k + ' ') >= 0) KEYMAP[k].forEach(function (s) { add(s, k); });
    });
    norm.split(' ').forEach(function (tok) {
      var hit = tok && lookup(tok);
      if (hit) hit.syms.forEach(function (s) { add(s, hit.word); });
    });
    return order.map(function (id) { return found[id]; });
  }

  // ------------------------------------------------------------------ interpretation
  function interpret(text, ctx) {
    var hits = findSymbols(text);
    var score = 0, care = 0;
    hits.forEach(function (h) { score += h.s.tone === 'good' ? 1 : h.s.tone === 'care' ? -1 : 0; if (h.s.tone === 'care') care++; });
    var troubled = ctx.feel === 'worry' || ctx.feel === 'fear';
    var verdict;
    if (!hits.length) verdict = troubled ? 'care' : 'mixed';
    else if (troubled || care > 0 || score < 0) verdict = 'care';
    else if (score > 0 && hits.every(function (h) { return h.s.tone !== 'care'; }) && score >= hits.length / 2) verdict = 'good';
    else verdict = 'mixed';

    var weight = [];
    if (ctx.time === 'dawn') weight.push({ t: 'חלום של שחרית', d: 'חלום שנראה לפנות בוקר הוא מן השלושה שמתקיימים. ראוי לתת עליו את הדעת ולפתור אותו לטובה כבר היום.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.repeat === 'yes') weight.push({ t: 'חלום שנשנה', d: '״ויש אומרים: אף חלום שנשנה״ — חלום חוזר נחשב בעל משקל. מומלץ לעשות הטבת חלום ולבדוק במעשים.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.repeat === 'friend') weight.push({ t: 'חלום שחלם לו חברו', d: 'חלום שחבר חלם עליכם הוא מן השלושה שמתקיימים. הודו לו, ופתרו יחד לטובה.', src: 'ברכות נה:', ref: B('55b') });
    if (ctx.time === 'day') weight.push({ t: 'שנת יום', d: '״אין מראין לו לאדם אלא מהרהורי לבו״ — חלום של שנת צהריים קרוב לרוב למחשבות היום, ומשקלו מועט.', src: 'ברכות נה:', ref: B('55b') });

    return { text: text, ctx: ctx, hits: hits, verdict: verdict, weight: weight, recs: recommend(hits, verdict, ctx) };
  }

  function recommend(hits, verdict, ctx) {
    var r = [];
    var ids = hits.map(function (h) { return h.s.id; });
    var pesukim = hits.filter(function (h) { return h.s.pasuk; });
    r.push({ key: true, t: 'לפתור לטובה — ולספר רק לאוהב', d: 'כל החלומות הולכים אחר הפה. אל תספרו את החלום למי שעלול לפרש אותו לרעה; אמרו בפה מלא: ״חלום טוב ראיתי״.', src: 'ברכות נה:', ref: B('55b') });
    if (pesukim.length) r.push({ key: true, t: 'להקדים פסוק', d: 'אמרו בבוקר את הפסוקים שמופיעים בכרטיסי הסמלים (' + pesukim.map(function (h) { return h.s.name; }).join(', ') + '), ״קודם שיקדימנו פסוק אחר״.', src: 'ברכות נו:', ref: B('56b') });
    if (verdict === 'good') {
      r.push({ t: 'לשמוח ולהודות', d: '״חלום טוב — שמחה שבו מספקתו״. קבלו את השמחה, הודו בתפילה ואמרו ״מזמור לתודה״ (תהילים ק).', src: 'ברכות נה.', ref: B('55a') });
    } else {
      r.push({ key: verdict === 'care', t: 'הטבת חלום בפני שלושה', d: 'בבוקר, אחרי התפילה, לפני שלושה אוהבים — לפי הסדר המלא שבאתר.', src: 'ברכות נה:; שו״ע או״ח רכ:א', ref: SF + 'Shulchan_Arukh,_Orach_Chayim.220?lang=he', link: '#hatava' });
      r.push({ t: 'תפילה בשעת ברכת כהנים', d: '״ריבונו של עולם, אני שלך וחלומותיי שלך…״ — במיוחד כשאינכם זוכרים את החלום בבירור.', src: 'ברכות נה:', ref: B('55b'), link: '#hatava' });
      r.push({ t: 'תשובה, תפילה וצדקה', d: '״שלושה דברים מבטלים גזירה קשה: תפילה, צדקה ותשובה״. תנו צדקה עוד היום, ואפשר לכוון ״כנגד החלום, לטובה״.', src: 'ירושלמי תענית ב:א', ref: SF + 'Jerusalem_Talmud_Taanit.2.1?lang=he' });
    }
    if (verdict === 'care' && (ctx.repeat === 'yes' || ctx.feel === 'fear')) {
      r.push({ t: 'תענית חלום — רק בהוראת רב', d: '״יפה תענית לחלום כאש לנעורת״. בדורנו פוסקים רבים מורים להמיר את התענית בצדקה ובלימוד. אל תתענו בלי לשאול רב.', src: 'שבת יא.; שו״ע או״ח רכ', ref: SF + 'Shabbat.11a?lang=he' });
    }
    if (ids.indexOf('dead') >= 0) r.push({ t: 'לעילוי נשמת הנפטר', d: 'אם חלמתם על קרוב שנפטר — למדו משניות, אמרו קדיש או תנו צדקה לעילוי נשמתו, כפי שמובא בספרי הקבלה.', src: 'ברכות נז:; ספרות הקבלה', ref: B('57b') });
    r.push({ t: 'קריאת שמע שעל המיטה', d: 'לפני השינה: חשבון נפש קצר, מחילה לכל מי שציער אתכם, ו״בידך אפקיד רוחי״. לפי הזוהר והאר״י, הנשמה עולה בשינה כפי ההכנה שלפניה.', src: 'ברכות ד:–ה.; תהילים לא:ו', ref: SF + 'Berakhot.5a?lang=he' });
    if (ctx.repeat === 'yes' && (ctx.feel === 'fear' || ctx.feel === 'worry')) {
      r.push({ t: 'לא להישאר עם זה לבד', d: 'חלום מפחיד שחוזר שוב ושוב יכול להעיד על עומס או מתח. שתפו אדם קרוב, ואם הוא פוגע בשינה — פנו לאיש מקצוע.', src: 'המלצה כללית', ref: '' });
    }
    return r;
  }

  // ------------------------------------------------------------------ rendering
  function srcLine(o) {
    var a = o.ref ? '<a href="' + esc(o.ref) + '" target="_blank" rel="noopener">' + esc(o.src) + '</a>' : esc(o.src || '');
    return '<div class="src">📜 ' + a + (o.note ? ' <span class="note">· רוח הדברים</span>' : '') + (o.link ? ' · <a href="' + o.link + '">לסדר המלא</a>' : '') + '</div>';
  }
  function symCard(h) {
    var s = h.s;
    return '<article class="sym ' + s.tone + '">' +
      '<header><h4>' + esc(s.name) + '</h4><span class="tag ' + s.tone + '">' + TONE[s.tone] + '</span></header>' +
      (h.words ? '<span class="hit">זוהה במילים: ' + h.words.map(esc).join(', ') + '</span>' : '') +
      '<p>' + esc(s.m) + '</p>' +
      (s.pasuk ? '<div class="pasuk"><small>יקדים ויאמר:</small>' + esc(s.pasuk) + '</div>' : '') +
      srcLine(s) + '</article>';
  }
  var VERDICT = {
    good: { seal: 'חלום<br>טוב', h: 'חלום לטובה', p: 'הסמלים בחלומכם מתפרשים במקורות לטובה. ״חלום טוב — שמחה שבו מספקתו״.' },
    mixed: { seal: 'פשר<br>לטובה', h: 'חלום מעורב — פותרים לטובה', p: 'יש בחלום סימנים לכאן ולכאן. כך דרכם של חז״ל: בוחרים בפירוש הטוב ואומרים אותו בפה.' },
    care: { seal: 'להטיב<br>חלום', h: 'חלום שכדאי להטיב', p: 'החלום או ההרגשה שאחריו מבקשים תיקון. אין זה סימן לרעה — ״עצבונו מספיקו״ — אבל המקורות נותנים דרך ברורה להפוך אותו לטובה.' }
  };
  function render(res) {
    var v = VERDICT[res.verdict], el = $('#result');
    var tags = res.hits.map(function (h) { return '<span class="tag ' + h.s.tone + '">' + esc(h.s.name) + '</span>'; }).join('');
    var html = '<div class="verdict"><div class="seal">' + v.seal + '</div><div><h3>' + v.h + '</h3><p>' + v.p + '</p>' +
      (tags ? '<div class="meta-tags">' + tags + '</div>' : '') + '</div></div>';

    if (res.weight.length) {
      html += '<h3 class="res-h">משקל החלום</h3><div class="principle-hits">' + res.weight.map(function (w) {
        return '<blockquote><b>' + esc(w.t) + '.</b> ' + esc(w.d) + srcLine(w) + '</blockquote>';
      }).join('') + '</div>';
    }

    html += '<h3 class="res-h">פירוש הסמלים</h3>';
    if (res.hits.length) html += '<div class="sym-cards">' + res.hits.map(symCard).join('') + '</div>';
    else html += '<div class="empty-note">לא זיהינו בחלום סמל מתוך המילון. נסו לתאר יותר פרטים (בעלי חיים, מקומות, חפצים, אנשים), עיינו ב<a href="#symbols">מילון הסמלים</a>, או בקשו פירוש מעמיק למטה. בכל מקרה העיקרון הוא אחד: פותרים לטובה.</div>';

    html += '<h3 class="res-h">המלצות וטיפול בחלום</h3><div class="recs">' + res.recs.map(function (r) {
      return '<div class="rec' + (r.key ? ' key' : '') + '"><b>' + esc(r.t) + '</b><p>' + esc(r.d) + '</p>' + srcLine(r) + '</div>';
    }).join('') + '</div>';

    html += '<div class="ai-box"><div class="row"><div><h4>פירוש מעמיק</h4><p class="small">פירוש אישי שמחבר את כל פרטי החלום, ברוח חז״ל, הזוהר והקבלה — תמיד לטובה.</p></div>' +
      '<button class="btn gold small" type="button" id="aiBtn">בקשו פירוש מעמיק</button></div><div id="aiOut" class="ai-out" hidden></div></div>';

    html += '<div class="res-actions"><button class="btn ghost small" type="button" id="copyBtn">העתקת הפתרון</button>' +
      '<button class="btn ghost small" type="button" id="printBtn">הדפסה</button>' +
      '<a class="btn ghost small" href="#hatava">לסדר הטבת חלום</a></div>';

    el.innerHTML = html; el.hidden = false;
    $('#aiBtn').addEventListener('click', function () { deepAI(res, this); });
    $('#copyBtn').addEventListener('click', function () { copyText(res, this); });
    $('#printBtn').addEventListener('click', function () { printPart('print-result'); });
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function plain(res) {
    var v = VERDICT[res.verdict];
    var out = ['פשר — פתרון החלום', '', 'החלום: ' + res.text, '', v.h + ' — ' + v.p, ''];
    res.hits.forEach(function (h) {
      out.push('• ' + h.s.name + ': ' + h.s.m + (h.s.pasuk ? ' | יקדים ויאמר: ' + h.s.pasuk : '') + ' (' + h.s.src + ')');
    });
    out.push('', 'המלצות:');
    res.recs.forEach(function (r, i) { out.push((i + 1) + '. ' + r.t + ' — ' + r.d + (r.src ? ' (' + r.src + ')' : '')); });
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

  // ------------------------------------------------------------------ AI (optional; the site works fully without it)
  var AI_ERR = {
    quota: 'המכסה היומית של הפירוש המעמיק נגמרה. נסו שוב מחר.',
    'rate-limited': 'יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות.',
    'no-key': 'הפירוש המעמיק עדיין לא הופעל בשרת.',
    offline: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
    forbidden: 'הבקשה נחסמה: הפירוש המעמיק פועל רק מכתובת האתר הרשמית.'
  };
  function deepAI(res, btn) {
    var out = $('#aiOut');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> מפרש…';
    out.hidden = false; out.className = 'ai-out'; out.textContent = '';
    var feel = { joy: 'בשמחה', calm: 'רגוע', worry: 'מוטרד', fear: 'מפוחד' }[res.ctx.feel];
    var time = { night: 'בלילה', dawn: 'לפנות בוקר', day: 'בשנת יום' }[res.ctx.time];
    var rep = { no: 'פעם ראשונה', yes: 'חלום חוזר', friend: 'חבר חלם עליו' }[res.ctx.repeat];
    var prompt = [
      'אתה פותר חלומות ירא שמים, הבקיא בסוגיית החלומות בבבלי ברכות נה–נז, בחלומות התורה, בזוהר ובספרות הקבלה.',
      'כתוב בעברית פירוש אישי וחם לחלום הבא, ב־4 עד 6 פסקאות קצרות.',
      'כללים: פתור תמיד לטובה (״כל החלומות הולכים אחר הפה״). אל תנבא אסון, מוות או מחלה. אל תמציא מקורות — צטט רק מקור שאתה בטוח בו (ספר ופרק/דף), ואם אינך בטוח כתוב ״ברוח המקורות״.',
      'סיים בשלוש המלצות מעשיות (למשל פסוק להקדים, צדקה, הטבת חלום, קריאת שמע שעל המיטה). אל תיתן ייעוץ רפואי.',
      '',
      'החלום: ' + res.text,
      'מתי: ' + time + '. הרגשה בהתעוררות: ' + feel + '. ' + rep + '.',
      res.hits.length ? 'סמלים שזוהו לפי המקורות: ' + res.hits.map(function (h) { return h.s.name + ' — ' + h.s.m + ' (' + h.s.src + ')'; }).join(' | ') : ''
    ].join('\n');
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 90000);
    fetch(AI_SERVER, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'ai', prompt: prompt }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad-response' }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; })
      .then(function (j) {
        clearTimeout(timer);
        if (j && j.ok && j.text) { out.textContent = String(j.text).replace(/\*\*/g, '').replace(/^#+\s*/gm, ''); }
        else { out.className = 'ai-out err'; out.textContent = (AI_ERR[j && j.error] || 'הפירוש המעמיק לא זמין כרגע.') + ' הפתרון שלמעלה מבוסס על המקורות ועומד בפני עצמו.'; }
        btn.disabled = false; btn.textContent = 'פירוש מעמיק נוסף';
      });
  }

  // ------------------------------------------------------------------ journal (this browser only)
  function jLoad() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []; } catch (e) { return []; } }
  function jSave(list) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) {} }
  function jAdd(res) {
    var list = jLoad().filter(function (x) { return x.text !== res.text; });
    list.unshift({ id: Date.now(), date: new Date().toISOString(), text: res.text, ctx: res.ctx, verdict: res.verdict, syms: res.hits.map(function (h) { return h.s.name; }) });
    jSave(list); jRender();
  }
  function jRender() {
    var list = jLoad(), el = $('#journalList');
    if (!list.length) { el.innerHTML = '<div class="empty-note">עדיין אין חלומות ביומן. כל חלום שתפתרו יישמר כאן.</div>'; return; }
    var counts = {};
    list.forEach(function (x) { (x.syms || []).forEach(function (n) { counts[n] = (counts[n] || 0) + 1; }); });
    var rec = Object.keys(counts).filter(function (n) { return counts[n] > 1; });
    el.innerHTML = (rec.length ? '<div class="empty-note">סמלים שחוזרים ביומן שלכם: <b>' + rec.map(esc).join(', ') + '</b>. ״יש אומרים: אף חלום שנשנה״ — כדאי לתת עליהם את הדעת.</div>' : '') +
      list.map(function (x) {
        var d = new Date(x.date);
        return '<div class="j-item" data-id="' + x.id + '"><div><div class="d">' + d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) +
          ' · <span class="tag ' + x.verdict + '">' + TONE[x.verdict] + '</span>' + (x.syms && x.syms.length ? ' · ' + x.syms.map(esc).join(', ') : '') + '</div>' +
          '<div class="t">' + esc(x.text) + '</div></div><div class="acts"><button class="btn ghost small" data-act="open">לפתרון</button><button class="btn ghost small" data-act="del" aria-label="מחיקה">✕</button></div></div>';
      }).join('');
  }
  $('#journalList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = +b.closest('.j-item').dataset.id, list = jLoad(), item = list.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    if (b.dataset.act === 'del') { jSave(list.filter(function (x) { return x.id !== id; })); jRender(); return; }
    $('#dreamText').value = item.text;
    ['time', 'feel', 'repeat'].forEach(function (n) { var r = document.querySelector('input[name=' + n + '][value=' + (item.ctx || {})[n] + ']'); if (r) r.checked = true; });
    render(interpret(item.text, item.ctx || readCtx()));
  });

  // ------------------------------------------------------------------ form
  function readCtx() {
    var v = function (n) { var r = document.querySelector('input[name=' + n + ']:checked'); return r ? r.value : ''; };
    return { time: v('time'), feel: v('feel'), repeat: v('repeat') };
  }
  $('#dreamForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('#dreamText').value.trim();
    if (t.length < 4) { $('#dreamText').focus(); return; }
    var res = interpret(t, readCtx());
    render(res); jAdd(res);
  });
  $('#sampleBtn').addEventListener('click', function () {
    $('#dreamText').value = 'חלמתי שאני עולה על הר גבוה, ולמטה זורם נהר. פתאום עפה מעליי יונה לבנה, ומצאתי באר עם מים צלולים. ליד הבאר עמד סבא שלי ז״ל ונתן לי אתרוג.';
    document.querySelector('input[name=time][value=dawn]').checked = true;
    $('#dreamText').focus();
  });

  // ------------------------------------------------------------------ dictionary
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
      return s.name.indexOf(q) >= 0 || s.k.some(function (k) { return k.indexOf(q) >= 0 || q.indexOf(k) >= 0; }) || s.m.indexOf(q) >= 0;
    });
    $('#dictGrid').innerHTML = list.length ? list.map(function (s) {
      return '<button type="button" class="dict-item" aria-expanded="false"><span class="top"><b>' + esc(s.name) + '</b><span class="dot ' + s.tone + '" title="' + TONE[s.tone] + '"></span></span>' +
        '<span class="cat">' + esc(s.cat) + ' · ' + esc(s.src) + (s.note ? ' · רוח הדברים' : '') + '</span><span class="sum">' + esc(s.m) + '</span>' +
        '<span class="more">' + (s.pasuk ? '<span class="pasuk"><small>יקדים ויאמר:</small>' + esc(s.pasuk) + '</span>' : '') +
        (s.ref ? '<span class="src">📜 <a href="' + esc(s.ref) + '" target="_blank" rel="noopener">לטקסט המלא בספריא</a></span>' : '') + '</span></button>';
    }).join('') : '<div class="empty-note">לא נמצא סמל כזה במילון. אפשר לתאר את החלום בטופס ולבקש פירוש מעמיק.</div>';
  }
  $('#dictGrid').addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var b = e.target.closest('.dict-item'); if (!b) return;
    b.classList.toggle('open'); b.setAttribute('aria-expanded', b.classList.contains('open'));
  });

  // ------------------------------------------------------------------ principles, counts, nav
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
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === en.target.id); });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  dictRender(); jRender();

  // ------------------------------------------------------------------ the night sky
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
