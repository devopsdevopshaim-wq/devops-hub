/* יצירת קומיקס: ציור אמיתי בשרת. התמונות נשלחות לשרת הציור של האתר ב-n8n,
   שמעביר אותן ל-Gemini או ל-OpenAI ומחזיר ציור. כל תוצאה נשמרת בספרייה. */
(function () {
  'use strict';

  var A = window.ComicApp;
  /* שרת הציור (n8n/hasadna-comic.json). רק האתר עצמו מורשה לקרוא אליו */
  var API = 'https://haimkripisn.app.n8n.cloud/webhook/comic-draw';
  var SEND_MAX = 1024;          /* הצד הארוך של תמונה שנשלחת לציור */
  var TIMEOUT = 180000;
  var KEY = 'comic-create-v1';

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
  var busy = false;

  function load() {
    var d = { mode: 'page', style: 'superhero', provider: 'auto', aspect: 'portrait', panels: '5', text: 'he' };
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); for (var k in s) d[k] = s[k]; } catch (e) { /* פרטי */ }
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* פרטי */ } }

  /* ---------- שרת ---------- */

  function post(body, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
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
      case 'draw-failed': return 'המודל לא הצליח לצייר את זה' + (/SAFETY|PROHIBITED|safety|moderation/i.test(j.detail || '') ? ' (חסימת תוכן של המודל)' : '') + '. נסו ניסוח אחר, תמונה אחרת או מודל אחר.';
      default: return 'הציור נכשל (' + (j.status || '') + '). נסו שוב.';
    }
  }

  function checkServer() {
    var box = $('server-state');
    post({ mode: 'status' }, 15000).then(function (j) {
      if (j.ok) {
        server = j;
        var on = [j.gemini && 'Gemini', j.openai && 'OpenAI'].filter(Boolean);
        box.className = 'server ' + (on.length ? 'ok' : 'warn');
        box.textContent = on.length ? 'שרת הציור מחובר · ' + on.join(' + ') + ' · נותרו היום ' + j.left : 'השרת פעיל, אבל עוד לא חובר מפתח של Gemini או OpenAI';
      } else {
        server = null;
        box.className = 'server warn';
        box.textContent = j.status === 404 ? 'שרת הציור עוד לא הותקן ב-n8n' : 'שרת הציור לא זמין כרגע';
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

  function limit() { return st.mode === 'character' ? 10 : 4; }

  function renderPhotos() {
    var box = $('create-photos'), S = A.state;
    box.textContent = '';
    var ids = S.sel.slice();
    S.images.forEach(function (m) { if (ids.indexOf(m.id) < 0) ids.push(m.id); });
    picked = picked.filter(function (id) { return A.imageById(id); });
    if (!picked.length) picked = S.sel.slice(0, limit());
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
      var i = picked.indexOf(id);
      b.setAttribute('aria-pressed', String(i >= 0));
      b.setAttribute('aria-label', m.name);
      var im = el('img'); im.src = m.thumb; im.alt = ''; im.loading = 'lazy';
      b.appendChild(im);
      if (i >= 0) b.appendChild(el('span', 'num', String(i + 1)));
      b.addEventListener('click', function () {
        var k = picked.indexOf(id);
        if (k >= 0) picked.splice(k, 1);
        else if (picked.length >= limit()) { A.toast(st.mode === 'character' ? 'אפשר עד 10 תמונות בבת אחת.' : 'אפשר עד 4 אנשים בציור אחד.'); return; }
        else picked.push(id);
        renderPhotos();
      });
      box.appendChild(b);
    });
    updateGo();
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
    b.textContent = busy ? 'מצייר…' : st.mode === 'page' ? 'ציור עמוד הקומיקס' : st.mode === 'scene' ? 'ציור הסצנה' : (n > 1 ? 'ציור ' + n + ' דמויות' : 'ציור הדמות');
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
        mode: st.mode, provider: $('c-provider').value, style: st.style, images: images,
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
        addResult(m, blob, j.provider, ids);
        return m;
      });
    });
  }

  function go() {
    if (busy) return;
    var ids = picked.slice();
    busy = true;
    updateGo();
    $('c-empty').hidden = true;
    /* בטלפון התוצאות נמצאות מתחת לטופס: גוללים אליהן כדי לראות את ההתקדמות */
    if (window.matchMedia('(max-width: 960px)').matches) setTimeout(function () { $('c-progress').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
    var jobs;
    if (st.mode === 'character') {
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
    } else {
      jobs = draw(ids, st.mode === 'page' ? 'מצייר עמוד קומיקס…' : 'מצייר את הסצנה…').then(function () {
        A.toast(st.mode === 'page' ? 'העמוד מוכן ונשמר בספרייה.' : 'הסצנה מוכנה ונשמרה בספרייה.');
      });
    }
    jobs.catch(function (e) { A.toast(e.message, 9000); showError(e.message); })
      .then(function () {
        busy = false;
        progress(false);
        updateGo();
        checkServer();
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
    cap.appendChild(el('span', 'muted small', provider === 'openai' ? 'צויר ב-OpenAI' : 'צויר ב-Gemini'));
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
  }

  function enter() {
    bind();
    renderStyles();
    applyMode();
    checkServer();
  }

  window.ComicCreate = { enter: enter, STYLES: STYLES };
})();
