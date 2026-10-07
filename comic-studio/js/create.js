/* יצירת קומיקס: ציור אמיתי בשרת. התמונות נשלחות לשרת הציור של האתר ב-n8n,
   שמעביר אותן ל-Gemini או ל-OpenAI ומחזיר ציור. כל תוצאה נשמרת בספרייה. */
(function () {
  'use strict';

  var A = window.ComicApp;
  /* שרת הציור (n8n/hasadna-comic.json). רק האתר עצמו מורשה לקרוא אליו */
  var API = 'https://haimkripisn.app.n8n.cloud/webhook/comic-draw';
  var SEND_MAX = 1024;          /* הצד הארוך של תמונה שנשלחת לציור */
  var TIMEOUT = 180000;
  var KEY = 'comic-create-v3';

  var STYLES = [
    { id: 'superhero', name: 'גיבורי-על', desc: 'קומיקס אמריקאי מודרני, דיו נועז וצבעים חזקים', c: ['#1d4ed8', '#ef4444', '#facc15'] },
    { id: 'graphic-novel', name: 'גרפיק נובל', desc: 'אפל וקולנועי, שחורים עמוקים', c: ['#0f2a3a', '#d4a056', '#111'] },
    { id: 'manga', name: 'מנגה', desc: 'שחור-לבן יפני עם רשתות גוון', c: ['#fff', '#111', '#9ca3af'] },
    { id: 'anime', name: 'אנימה', desc: 'פריים של סרט אנימה, רך וזוהר', c: ['#93c5fd', '#fbcfe8', '#fde68a'] },
    { id: 'ligne-claire', name: 'קו נקי אירופאי', desc: 'כמו אלבומי קומיקס צרפתיים קלאסיים', c: ['#60a5fa', '#f87171', '#fef3c7'] },
    { id: 'retro-pop', name: 'קומיקס רטרו', desc: 'שנות ה-60, נקודות דפוס ונייר מצהיב', c: ['#facc15', '#dc2626', '#f5e6c8'] },
    { id: 'caricature', name: 'קריקטורה', desc: 'ראש גדול ותווים מוגזמים, באהבה', c: ['#fb923c', '#fde68a', '#fff'] },
    { id: 'webtoon', name: 'וובטון', desc: 'קוריאני, צבעוני ומלוטש', c: ['#a78bfa', '#f472b6', '#e0f2fe'] },
    { id: 'cartoon-3d', name: 'אנימציה תלת-ממדית', desc: 'כמו סרט אנימציה משפחתי', c: ['#38bdf8', '#fbbf24', '#f9a8d4'] },
    { id: 'storybook', name: 'ספר ילדים', desc: 'צבעי מים וגואש רכים', c: ['#fde68a', '#86efac', '#fca5a5'] },
    { id: 'street-art', name: 'גרפיטי', desc: 'ציור קיר בספריי על לבנים', c: ['#22d3ee', '#e11d48', '#a3e635'] },
    { id: 'noir', name: 'נואר', desc: 'שחור-לבן דרמטי עם נגיעה אדומה', c: ['#111', '#e5e5e5', '#dc2626'] }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var el = A.el;
  var st = load();
  var picked = [];        /* התמונות שנכללות ביצירה */
  var server = null;      /* { gemini, openai, left } */
  var busy = false, inflight = null, cleared = false, runDrawn = 0;

  function load() {
    var d = { mode: 'page', style: 'superhero', provider: 'best', aspect: 'portrait', panels: '5', text: 'he' };
    try {
      /* גרסה קודמת שמרה "חינמי" כברירת מחדל: שומרים את שאר הבחירות, והמודל עובר ל"הכי טוב שזמין" */
      var old = localStorage.getItem(KEY) ? null : JSON.parse(localStorage.getItem('comic-create-v2') || 'null');
      if (old) delete old.provider;
      var s = old || JSON.parse(localStorage.getItem(KEY) || '{}');
      for (var k in s) d[k] = s[k];
    } catch (e) { /* פרטי */ }
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* פרטי */ } }

  /* ---------- שרת ---------- */

  function post(body, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctl && body.mode !== 'status') inflight = ctl;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || TIMEOUT) : 0;
    /* text/plain: בקשה פשוטה, בלי בקשת בדיקה מקדימה של הדפדפן */
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return { ok: false, error: 'timeout', status: 0 };
        return { ok: false, error: 'network', status: 0 };
      })
      .then(function (j) { clearTimeout(timer); return j; });
  }

  function message(j) {
    switch (j.error) {
      case 'no-key': return 'שרת הציור עוד לא מחובר למפתח של ' + (j.provider === 'openai' ? 'OpenAI' : j.provider === 'gemini' ? 'Gemini' : 'Gemini או OpenAI') + '. צריך להוסיף אותו בסודות של GitHub (ראו את ההוראות בקובץ README).';
      case 'rate-limited': return 'הגעתם למספר הציורים המרבי לשעה מהכתובת הזו. נסו שוב בעוד כמה דקות.';
      case 'quota': return 'הגענו לתקרת הציורים היומית של האתר. היא מתאפסת מחר.';
      case 'forbidden': return 'השרת מקבל בקשות רק מהאתר עצמו (devopsdevopshaim-wq.github.io).';
      case 'too-big': return 'אחת התמונות גדולה מדי. נסו תמונה אחרת.';
      case 'timeout': return 'הציור לקח יותר מדי זמן. נסו שוב, או בחרו פחות פאנלים.';
      case 'network': return 'אין חיבור לשרת הציור. בדקו את האינטרנט ונסו שוב.';
      case 'draw-failed':
        if (/billing|quota|exceeded|insufficient_quota|billing_hard_limit/i.test(j.detail || '')) {
          var who = /openai/i.test(j.detail || '') && !/gemini/i.test(j.detail || '') ? 'OpenAI' : /gemini/i.test(j.detail || '') && !/openai/i.test(j.detail || '') ? 'Gemini' : 'Gemini / OpenAI';
          return 'המפתח של ' + who + ' תקין, אבל אין בו חיוב פעיל או שנגמרה המכסה. ציור תמונות לא כלול בשכבה החינמית: צריך להפעיל חיוב (Billing) בחשבון של המפתח.';
        }
        return 'המודל לא הצליח לצייר את זה' + (/SAFETY|PROHIBITED|safety|moderation/i.test(j.detail || '') ? ' (חסימת תוכן של המודל)' : '') + '. נסו ניסוח אחר, תמונה אחרת או מודל אחר.';
      default: return 'הציור נכשל (' + (j.status || '') + '). נסו שוב.';
    }
  }

  function checkServer() {
    var box = $('server-state');
    post({ mode: 'status' }, 15000).then(function (j) {
      if (j.ok) {
        server = j;
        var on = [j.gemini && 'Gemini', j.openai && 'OpenAI'].filter(Boolean);
        box.className = 'server ok';
        box.textContent = on.length ? on.join(' + ') + ' מחובר: ציור מקצועי מהתמונות' : 'מצב חינמי פעיל · Gemini עוד לא מחובר (צריך מפתח עם חיוב)';
      } else {
        server = null;
        box.className = 'server ok';
        box.textContent = 'מצב חינמי פעיל';
      }
      updateGo();
    });
  }

  /* ---------- תמונות ---------- */

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function prepare(id) {
    return A.loadBitmap(id, SEND_MAX).then(function (b) {
      var c = A.scaled(b, SEND_MAX);
      A.closeImg(b);
      return A.canvasToBlob(c, 'image/jpeg', 0.88);
    }).then(toBase64).then(function (data) { return { mime: 'image/jpeg', data: data }; });
  }

  /* כמה תמונות אפשר לבחור: דמויות וספר קומיקס בלי הגבלה מעשית; בסצנה אחת המודלים מאבדים פנים מעבר ל-6–8 אנשים */
  /* "הכי טוב שזמין": Gemini או OpenAI כשהשרת מחובר אליהם, אחרת המצב החינמי */
  function paidReady() { return Boolean(server && (server.gemini || server.openai)); }
  function provider() {
    var v = $('c-provider').value;
    if (v === 'best') return paidReady() ? 'auto' : 'free';
    return v;
  }
  function free() { return provider() === 'free'; }
  function limit() { return st.mode === 'scene' ? (free() ? 8 : 6) : 300; }

  function renderPhotos() {
    var box = $('create-photos'), S = A.state;
    box.textContent = '';
    var ids = S.sel.slice();
    S.images.forEach(function (m) { if (ids.indexOf(m.id) < 0) ids.push(m.id); });
    picked = picked.filter(function (id) { return A.imageById(id); });
    if (!picked.length && !cleared) picked = S.sel.slice(0, limit());
    cleared = false;
    hint();
    if (!ids.length) {
      var p = el('p', 'muted small', 'אין עדיין תמונות. ');
      var a = el('button', 'btn tiny', 'להעלאת תמונות');
      a.type = 'button';
      a.addEventListener('click', function () { A.show('library'); });
      p.appendChild(a);
      box.appendChild(p);
    }
    ids.forEach(function (id) {
      var m = A.imageById(id);
      var b = el('button', 'cphoto');
      b.type = 'button';
      b.dataset.id = id;
      var i = picked.indexOf(id);
      b.setAttribute('aria-pressed', String(i >= 0));
      b.setAttribute('aria-label', m.name);
      var im = el('img'); im.src = m.thumb; im.alt = ''; im.loading = 'lazy';
      b.appendChild(im);
      if (i >= 0) b.appendChild(el('span', 'num', String(i + 1)));
      b.addEventListener('click', function () {
        var k = picked.indexOf(id);
        if (k >= 0) picked.splice(k, 1);
        else if (picked.length >= limit()) { A.toast('בסצנה אחת אפשר עד ' + limit() + ' אנשים. לעוד אנשים בחרו "עמוד קומיקס" (ספר קומיקס).'); return; }
        else picked.push(id);
        markPhotos();
      });
      box.appendChild(b);
    });
    updateGo();
  }

  /* עדכון סימונים בלבד, בלי לבנות מחדש מאות תמונות */
  function markPhotos() {
    document.querySelectorAll('#create-photos .cphoto').forEach(function (b) {
      var i = picked.indexOf(b.dataset.id), num = b.querySelector('.num');
      b.setAttribute('aria-pressed', String(i >= 0));
      if (i >= 0 && !num) { num = el('span', 'num'); b.appendChild(num); }
      if (num) { if (i >= 0) num.textContent = String(i + 1); else num.remove(); }
    });
    hint();
    updateGo();
  }

  function hint() {
    $('create-photos-hint').textContent = picked.length + ' נבחרו · ' + (st.mode === 'page' ? (picked.length > 4 ? 'ספר קומיקס: כל תמונה פאנל, 6 בעמוד' : 'עד 4 תמונות: עמוד אחד לפי הסיפור; יותר: ספר קומיקס')
      : st.mode === 'scene' ? 'עד ' + limit() + ' אנשים בסצנה' : 'כל תמונה תצויר כדמות');
  }

  /* ---------- טופס ---------- */

  function renderStyles() {
    var box = $('create-styles');
    if (box.childElementCount) return;
    STYLES.forEach(function (s) {
      var b = el('button', 'cstyle');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.style = s.id;
      var sw = el('span', 'swatch');
      sw.style.background = 'linear-gradient(135deg,' + s.c[0] + ' 0 38%,' + s.c[1] + ' 38% 70%,' + s.c[2] + ' 70%)';
      b.appendChild(sw);
      b.appendChild(el('b', '', s.name));
      b.appendChild(el('span', 'muted small', s.desc));
      b.addEventListener('click', function () { st.style = s.id; save(); markStyles(); });
      box.appendChild(b);
    });
    markStyles();
  }
  function markStyles() {
    document.querySelectorAll('.cstyle').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.style === st.style)); });
  }

  function applyMode() {
    document.querySelectorAll('.mode').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === st.mode)); });
    document.querySelectorAll('[data-for]').forEach(function (f) { f.hidden = f.dataset.for.split(' ').indexOf(st.mode) < 0; });
    $('story-head').textContent = st.mode === 'page' ? 'הסיפור' : st.mode === 'scene' ? 'הסצנה' : 'כיוון (לא חובה)';
    $('c-story-label').textContent = st.mode === 'page' ? 'מה קורה בסיפור? אפשר לכתוב פאנל-פאנל, כולל מה כתוב בבועות'
      : st.mode === 'scene' ? 'איפה הם ומה הם עושים יחד?' : 'משהו שתרצו בציור (רקע, תלבושת, הבעה)';
    $('c-story').placeholder = st.mode === 'page' ? $('c-story').dataset.pagePh : st.mode === 'scene' ? 'למשל: שלושתנו טסים מעל ירושלים כגיבורי-על' : 'למשל: בתנוחת גיבור, עם גלימה, על רקע עיר בלילה';
    if (st.mode === 'page' && !st.aspectTouched) $('c-aspect').value = 'portrait';
    if (st.mode === 'character' && !st.aspectTouched) $('c-aspect').value = 'portrait';
    if (st.mode === 'scene' && !st.aspectTouched) $('c-aspect').value = 'landscape';
    picked = picked.slice(0, limit());
    renderPhotos();
  }

  function updateGo() {
    var b = $('c-go'), note = $('c-go-note');
    var need = st.mode === 'scene' ? 2 : 1;
    var n = picked.length;
    b.disabled = busy || n < need;
    b.textContent = busy ? 'מצייר…' : st.mode === 'page' ? (n > 4 ? 'ציור ספר הקומיקס (' + n + ' פאנלים)' : 'ציור עמוד הקומיקס') : st.mode === 'scene' ? 'ציור הסצנה' : (n > 1 ? 'ציור ' + n + ' דמויות' : 'ציור הדמות');
    note.textContent = n < need ? (st.mode === 'scene' ? 'בחרו לפחות 2 תמונות של אנשים.' : 'בחרו לפחות תמונה אחת.') : '';
  }

  /* ---------- ציור ---------- */

  var tick = 0;
  function progress(on, text) {
    var p = $('c-progress');
    p.hidden = !on;
    clearInterval(tick);
    if (!on) return;
    $('c-progress-text').textContent = text;
    var t0 = Date.now();
    var upd = function () {
      var s = Math.round((Date.now() - t0) / 1000);
      $('c-progress-time').textContent = s + ' שניות' + (s > 25 ? ' · ציורים מפורטים לוקחים עד דקה' : '');
    };
    upd();
    tick = setInterval(upd, 1000);
  }

  function request(ids) {
    return Promise.all(ids.map(prepare)).then(function (images) {
      return {
        mode: st.mode, provider: provider(), style: st.style, images: images,
        story: $('c-story').value.trim(), title: $('c-title').value.trim(), prompt: $('c-extra').value.trim(),
        panels: $('c-panels').value, text: $('c-text').value, aspect: $('c-aspect').value
      };
    });
  }

  function draw(ids, label) {
    progress(true, label);
    return request(ids).then(function (body) {
      return post(body).then(function (j) { return { j: j, body: body }; });
    }).then(function (r) {
      var j = r.j;
      if (!j.ok || !j.image) throw new Error(message(j));
      if (server && typeof j.left === 'number') { server.left = j.left; }
      var bin = atob(j.image), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var blob = new Blob([arr], { type: j.mime || 'image/png' });
      var style = STYLES.filter(function (s) { return s.id === st.style; })[0];
      var name = (st.mode === 'page' ? (r.body.title || 'עמוד קומיקס') : st.mode === 'scene' ? 'סצנה משולבת' : (A.imageById(ids[0]) || {}).name || 'דמות') + ' · ' + style.name;
      return A.addAiResult(blob, name, ids[0]).then(function (m) {
        A.saveMeta();
        runDrawn++;
        addResult(m, blob, j.provider, ids);
        return m;
      });
    });
  }

  function go() {
    if (busy) return;
    var ids = picked.slice();
    busy = true;
    runDrawn = 0;
    updateGo();
    $('c-empty').hidden = true;
    /* בטלפון התוצאות נמצאות מתחת לטופס: גוללים אליהן כדי לראות את ההתקדמות */
    if (window.matchMedia('(max-width: 960px)').matches) setTimeout(function () { $('c-progress').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
    var jobs;
    var best = $('c-provider').value === 'best';
    /* בציור בתשלום סצנה אחת מקבלת עד 6 אנשים */
    if (!free() && st.mode === 'scene') ids = ids.slice(0, 6);
    if (free()) {
      jobs = freeRun(ids);
    } else if (st.mode === 'character') {
      /* כל תמונה לבד, אחת אחרי השנייה */
      var done = 0, failed = 0, lastErr = null;
      jobs = ids.reduce(function (p, id, i) {
        return p.then(function () {
          return draw([id], 'מצייר דמות ' + (i + 1) + ' מתוך ' + ids.length + '…').then(function () { done++; }, function (e) { failed++; lastErr = e; });
        });
      }, Promise.resolve()).then(function () {
        if (failed && !done) throw lastErr;
        if (failed) A.toast(done + ' ציורים מוכנים, ' + failed + ' נכשלו: ' + lastErr.message, 7000);
        else A.toast(done === 1 ? 'הדמות מוכנה ונשמרה בספרייה.' : done + ' דמויות מוכנות ונשמרו בספרייה.');
      });
    } else if (st.mode === 'page' && ids.length > 6) {
      var groups = [];
      for (var g = 0; g < ids.length; g += 6) groups.push(ids.slice(g, g + 6));
      jobs = groups.reduce(function (p, grp, k) {
        return p.then(function () { return draw(grp, 'מצייר עמוד ' + (k + 1) + ' מתוך ' + groups.length + '…'); });
      }, Promise.resolve()).then(function () { A.toast(groups.length + ' עמודים מוכנים ונשמרו בספרייה.'); });
    } else {
      jobs = draw(ids, st.mode === 'page' ? 'מצייר עמוד קומיקס…' : 'מצייר את הסצנה…').then(function () {
        A.toast(st.mode === 'page' ? 'העמוד מוכן ונשמר בספרייה.' : 'הסצנה מוכנה ונשמרה בספרייה.');
      });
    }
    if (best && !free()) {
      /* Gemini לא צייר (חיוב, מכסה, תקלה): ממשיכים במצב החינמי במקום לעצור */
      jobs = jobs.catch(function (e) {
        if (e && e.stopped) throw e;
        if (!runDrawn) {
          A.toast('Gemini לא צייר הפעם (' + e.message + '). ממשיך במצב החינמי…', 7000);
          return freeRun(ids);
        }
        throw e;
      });
    }
    jobs.catch(function (e) {
      if (e && e.stopped) { A.toast('הציור נעצר.'); return; }
      A.toast(e.message, 9000); showError(e.message);
    })
      .then(function () {
        busy = false;
        progress(false);
        updateGo();
        checkServer();
      });
  }

  /* מצב חינמי: תסריט במודל טקסט חינמי וציור בשירות חינמי, ובניית עמוד עם בועות בעברית */
  function freeRun(ids) {
    progress(true, 'מתחיל…');
    return window.ComicFree.run({
      mode: st.mode, ids: ids, style: st.style, story: $('c-story').value.trim(), title: $('c-title').value.trim(),
      panels: $('c-panels').value, aspect: $('c-aspect').value,
      /* כל ציור מופיע מיד כשהוא מוכן, לא רק בסוף */
      onItem: function (meta, blob) { runDrawn++; addResult(meta, blob, 'free', ids); }
    }, function (text) { $('c-progress-text').textContent = text; }).then(function (r) {
      if (r.kind === 'pages') {
        A.addPages(r.pages);
        A.toast((r.pages.length > 1 ? 'ספר קומיקס של ' + r.pages.length + ' עמודים מוכן' : 'העמוד מוכן') + ', עם בועות בעברית. אפשר לערוך כל בועה ולייצא PDF.' + (r.failed ? ' ' + r.failed + ' פאנלים לא צוירו; אפשר לגרור אליהם תמונה.' : ''), 8000);
      } else A.toast((r.items.length === 1 ? 'הציור מוכן ונשמר בספרייה.' : r.items.length + ' ציורים מוכנים ונשמרו בספרייה.') + (r.failed ? ' ' + r.failed + ' לא צוירו.' : ''), 6000);
    });
  }

  function showError(text) {
    var box = $('c-results');
    var d = el('div', 'cerror', text);
    box.insertBefore(d, box.firstChild);
    setTimeout(function () { d.remove(); }, 20000);
  }

  function addResult(meta, blob, provider, ids) {
    var box = $('c-results');
    var f = el('figure', 'cresult');
    var url = URL.createObjectURL(blob);
    var im = el('img'); im.src = url; im.alt = meta.name;
    im.addEventListener('click', function () { window.open(url, '_blank', 'noopener'); });
    f.appendChild(im);
    var cap = el('figcaption');
    cap.appendChild(el('b', '', meta.name));
    cap.appendChild(el('span', 'muted small', provider === 'free' ? 'צויר במצב החינמי' : provider === 'openai' ? 'צויר ב-OpenAI' : 'צויר ב-Gemini'));
    var row = el('div', 'row wrap');
    var mode = st.mode;
    var bt = function (text, cls, fn) { var b = el('button', 'btn ' + cls, text); b.type = 'button'; b.addEventListener('click', fn); row.appendChild(b); };
    bt('הורדה', 'tiny', function () { A.download(blob, A.safeName(meta.name) + (blob.type.indexOf('png') >= 0 ? '.png' : '.jpg')); });
    bt(mode === 'page' ? 'לעורך: בועות וייצוא' : 'לעמוד הקומיקס', 'tiny primary', function () { A.openInPage(meta.id, mode === 'page'); });
    bt('גרסה נוספת', 'tiny ghost', function () { picked = ids.slice(); renderPhotos(); go(); });
    cap.appendChild(row);
    f.appendChild(cap);
    box.insertBefore(f, box.firstChild);
  }

  /* ---------- בדיקת מערכת ---------- */
  function selfTest() {
    var d = $('selftest'), list = $('selftest-list');
    if (!d.open) d.showModal();
    list.textContent = '';
    var row = function (title) {
      var li = el('li');
      var mark = el('b', '', '⏳');
      li.appendChild(mark);
      li.appendChild(el('span', '', title));
      var note = el('small', '', 'בודק…');
      li.appendChild(note);
      list.appendChild(li);
      return function (ok, text) { mark.textContent = ok === null ? 'ℹ️' : ok ? '✅' : '❌'; note.textContent = text; };
    };
    var EN = window.ComicEngine;
    var dev = row('המכשיר והדפדפן');
    var ua = navigator.userAgent;
    var br = (ua.match(/SamsungBrowser\/[\d.]+|Chrome\/[\d]+|Firefox\/[\d]+|Version\/[\d.]+ Mobile.*Safari/) || ['דפדפן לא מזוהה'])[0];
    dev(null, br + ' · ' + (/Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'מחשב') + (navigator.deviceMemory ? ' · זיכרון ' + navigator.deviceMemory + 'GB' : '') + (EN.LOW ? ' · מצב חסכוני' : ''));
    var w = row('עיבוד ברקע (אפקטים מהירים)');
    EN.selfTest().then(function (r) {
      w(r.ok, r.ok ? 'עובד (' + r.ms + ' אלפיות שנייה)' + (r.broken ? ' · במצב גיבוי בדף' : '') : 'לא עובד: ' + (r.why || '') + ' · האתר עובר אוטומטית לעיבוד בדף');
    });
    var sv = row('שרת הציור של האתר');
    post({ mode: 'status' }, 15000).then(function (j) {
      sv(j.ok, j.ok ? 'עונה' + (j.gemini ? ' · Gemini מחובר' : ' · בלי מפתח Gemini (המצב החינמי משתמש בשירות חלופי)') : 'לא עונה (' + (j.status || j.error) + ') · המצב החינמי ממשיך בלי השרת');
    });
    var pol = row('שירות הציור החינמי');
    window.ComicFree.ping().then(function (r) {
      pol(r.ok, r.ok ? 'עונה (' + Math.round(r.ms / 1000) + ' שניות)' : 'לא עונה: ' + r.why + ' · בלעדיו המצב החינמי לא יכול לצייר');
    });
    var st = row('שמירה בדפדפן');
    (navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null)).then(function (e) {
      st(true, e ? 'בשימוש ' + Math.round(e.usage / 1048576) + 'MB מתוך ' + Math.round(e.quota / 1048576) + 'MB' : 'פעילה');
    }).catch(function () { st(false, 'הדפדפן חוסם שמירה'); });
  }

  /* ---------- התחלה ---------- */

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    $('c-story').dataset.pagePh = $('c-story').placeholder;
    document.querySelectorAll('.mode').forEach(function (b) {
      b.addEventListener('click', function () { st.mode = b.dataset.mode; save(); applyMode(); });
    });
    ['c-provider', 'c-panels', 'c-text'].forEach(function (id) {
      var key = { 'c-provider': 'provider', 'c-panels': 'panels', 'c-text': 'text' }[id];
      $(id).value = st[key];
      $(id).addEventListener('change', function () { st[key] = $(id).value; save(); });
    });
    $('c-aspect').value = st.aspect;
    $('c-aspect').addEventListener('change', function () { st.aspect = $('c-aspect').value; st.aspectTouched = true; save(); });
    $('c-go').addEventListener('click', go);
    $('c-stop').addEventListener('click', function () {
      if (window.ComicFree) window.ComicFree.cancel();
      if (inflight) { try { inflight.abort(); } catch (e) { /* כבר נעצר */ } }
      $('c-progress-text').textContent = 'עוצר…';
    });
    $('selftest-btn').addEventListener('click', selfTest);
    $('c-all').addEventListener('click', function () {
      var S = A.state, ids = S.sel.slice();
      S.images.forEach(function (m) { if (ids.indexOf(m.id) < 0) ids.push(m.id); });
      picked = ids.slice(0, limit());
      markPhotos();
    });
    $('c-none').addEventListener('click', function () { picked = []; cleared = true; markPhotos(); });
    $('c-provider').addEventListener('change', function () { picked = picked.slice(0, limit()); renderPhotos(); });
    $('selftest-again').addEventListener('click', selfTest);
  }

  function enter() {
    bind();
    renderStyles();
    applyMode();
    checkServer();
  }

  window.ComicCreate = { enter: enter, STYLES: STYLES };
})();
