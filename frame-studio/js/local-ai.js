/* מנוע AI מקומי: in the desktop program (window.FSDesktop.localAI, desktop/local-ai.js) the photo edits ('restyle')
   and new pictures ('image') can run on this computer with FLUX.2 klein 4B, without internet. This file is the panel
   (open from the AI tab and the ☰ menu), the mode setting, and FS.localAI, which FS.askServer (js/ai.js) uses to route.
   In a normal browser there is no FSDesktop.localAI and the file does nothing. */
(function () {
  'use strict';
  var FS = window.FS, D = window.FSDesktop, API = D && D.localAI;
  if (!FS || !API) return;
  var $ = FS.$ || function (s, r) { return (r || document).querySelector(s); };
  var esc = FS.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var KEY = 'fs-ai-mode', SIZE_KEY = 'fs-ai-local-size';
  var TITLE = '🖥️ AI מקומי (בלי אינטרנט)';

  var st = null, gpu = null, prog = null, installing = null, lastResult = null, testImg = '';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function mode() { var m = ls(KEY); return m === 'local' || m === 'cloud' || m === 'auto' ? m : 'auto'; }
  /* the CPU build is slow (measured on a 4-core runner: ~24 min for 512x768), so it works at 768 unless 1024 was chosen */
  function localSize() { var v = ls(SIZE_KEY); if (v === '512') return 512; if (v === '768') return 768; if (v === '1024') return 1024; return st && st.engine && st.engine.variant === 'cpu' ? 768 : 1024; }
  function gb(b) { return b ? (b / 1e9).toFixed(b >= 1e10 ? 0 : 1) + ' GB' : '—'; }
  function toast(m, ms) { if (FS.toast) FS.toast(m, ms); }

  function refresh() {
    return API.status().then(function (s) { st = s; paint(); pill(); return s; }).catch(function () { st = null; return null; });
  }
  var first = refresh();
  function loadGpu() { if (!gpu) API.gpuInfo().then(function (g) { gpu = g; paint(); }).catch(function () { gpu = { gpus: [], best: null }; paint(); }); }

  /* ---------- what ai.js calls ---------- */
  function fit16(v) { return Math.max(256, Math.min(1536, Math.round(v / 16) * 16)); }
  function sizeFor(body) {
    var w = Number(body.w), h = Number(body.h);
    if (!(w > 0 && h > 0)) {   /* generate() puts the shape only in the prompt: "... (1200x800)" */
      var m = /\((\d{2,5})\s*[x×]\s*(\d{2,5})\)/.exec(String(body.prompt || ''));
      w = m ? Number(m[1]) : 1024; h = m ? Number(m[2]) : 1024;
    }
    var k = localSize() / Math.max(w, h);
    return { w: fit16(w * k), h: fit16(h * k) };
  }
  /* the busy sign is the caller's: only its text changes, and only while it is showing */
  function busyText(t) {
    var b = $('#busy'), m = $('#busy-msg');
    if (b && m && !b.hidden && m.textContent !== 'עוצר…') m.textContent = t;
  }
  function fitRef(b64, long) {
    return new Promise(function (ok) {
      var im = new Image(); im.onload = function () {
        var k = Math.min(1, long / Math.max(im.naturalWidth, im.naturalHeight)); if (k >= 0.99) return ok(b64);
        var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
      }; im.onerror = function () { ok(b64); }; im.src = 'data:image/jpeg;base64,' + b64;
    });
  }
  function runBody(body) {
    if (body.action === 'restyle' && body.image && !body._fit) return fitRef(body.image, Math.max(sizeFor(body).w, sizeFor(body).h)).then(function (b) { return runBody(Object.assign({}, body, { image: b, _fit: 1 })); });
    var sz = sizeFor(body), prev = $('#busy-msg') ? $('#busy-msg').textContent : '';
    busyText('AI מקומי… מתחיל');
    return API.run({ mode: body.action === 'restyle' ? 'restyle' : 'image', prompt: String(body.prompt || '').slice(0, 2000), imageB64: body.action === 'restyle' ? body.image : undefined, w: sz.w, h: sz.h },
      function (p) { if (p && p.pct != null) busyText('AI מקומי… ' + p.pct + '%'); })
      .then(function (r) {
        lastResult = r;
        if (r && r.ok && r.image) return { ok: true, image: r.image, mime: r.mime || 'image/png', source: 'מקומי', model: 'flux-2-klein-4b', ms: r.ms };
        if (r && r.suggestCpu) { st && (st.suggestCpu = true); }
        return { ok: false, error: r && (r.error === 'cancelled' || r.error === 'timeout' || r.error === 'not-installed') ? r.error === 'not-installed' ? 'local-missing' : r.error : 'local-failed', detail: r && r.detail ? String(r.detail).slice(-300) : '' };
      }, function (e) { return { ok: false, error: 'local-failed', detail: String(e && e.message || e) }; })
      .then(function (r) { if (prev && r.ok) busyText(prev); return r; });
  }
  FS.localAI = {
    mode: mode,
    isReady: function () { return !!(st && st.ready); },
    whenReady: function () { return (st ? Promise.resolve(st) : first).then(function (s) { return !!(s && s.ready); }); },
    run: runBody,
    cancel: function () { return API.cancel(); },
    open: open
  };
  /* error texts for the local engine (the cloud's stay as they are) */
  var aiError = FS.aiError;
  FS.aiError = function (m) {
    if (m === 'local-failed') return 'ה־AI המקומי לא הצליח הפעם.' + (st && st.engine && st.engine.variant === 'vulkan' ? ' אם זה חוזר, אפשר להתקין את גרסת המעבד בחלון ה־AI המקומי.' : '') + (FS.lastAiDetail ? ' (' + FS.lastAiDetail.slice(0, 140) + ')' : '');
    if (m === 'local-missing') return 'ה־AI המקומי לא מותקן במלואו. פותחים ☰ ← AI מקומי ומתקינים שוב.';
    return aiError ? aiError(m) : 'ה־AI לא הצליח הפעם.';
  };

  /* ---------- the panel ---------- */
  var STATE = { none: ['לא מותקן', 'off'], partial: ['הותקן חלקית', 'warn'], installing: ['מתקין…', 'act'], ready: ['מוכן לעבודה', 'on'], error: ['שגיאה', 'bad'] };
  var ERR = {
    'not-found': 'לא נמצא אחד מקובצי המודל ב־Hugging Face (ייתכן ששמו השתנה).',
    offline: 'אין חיבור לאינטרנט. ההתקנה צריכה אינטרנט פעם אחת, ואחר כך הכול עובד בלעדיו.',
    'disk-full': 'אין מספיק מקום פנוי בדיסק.',
    'install-failed': 'ההתקנה נכשלה.',
    busy: 'רגע, משהו אחר רץ עכשיו.'
  };
  var FILE_ICON = { engine: '⚙️', diffusion: '🎨', llm: '🔤', vae: '🖼️' };

  function speedText() {
    if (!gpu) return '<span class="la-dim">בודק את כרטיס המסך…</span>';
    var b = gpu.best, cpu = st && st.engine && st.engine.variant === 'cpu';
    var name = b ? esc(b.name) + (b.vramMB ? ' · ' + (b.vramMB / 1024).toFixed(b.vramMB % 1024 ? 1 : 0) + ' GB זיכרון מסך' : ' · זיכרון מסך לא ידוע') : 'לא זוהה כרטיס מסך';
    var fast = !cpu && b && b.vramMB >= 6144;
    return '<div class="la-gpu"><b>' + name + '</b>' + (gpu.ramMB ? '<span class="la-dim"> · ' + Math.round(gpu.ramMB / 1024) + ' GB זיכרון</span>' : '') + '</div>' +
      '<div class="la-speed ' + (fast ? 'fast' : 'slow') + '">' + (fast ? '⚡ מהיר: בערך 10–40 שניות לתמונה' : cpu || !b ? '🐢 בלי כרטיס מסך: בערך 10–25 דקות לתמונה (תלוי במעבד). כדאי להריץ כמה תמונות ולהמשיך לעבוד.' : '🐢 כרטיס מסך חלש: כמה דקות לתמונה') + '</div>' +
      (gpu.ramMB && gpu.ramMB < 12 * 1024 ? '<div class="la-warn">⚠️ במחשב פחות מ־12GB זיכרון. זה יעבוד, אבל לאט.</div>' : '');
  }
  function bars() {
    if (!prog || !prog.files || !prog.files.length) return '<div class="la-dim">מחפש את הקבצים…</div>';
    var tot = prog.total || 0, done = prog.done || 0, pct = tot ? Math.floor(done / tot * 100) : 0;
    var ph = { plan: 'מחפש את הקבצים…', download: 'מוריד', extract: 'פותח את המנוע…', probe: 'בודק את כרטיס המסך…', done: 'הסתיים' }[prog.phase] || '';
    return '<div class="la-total"><div class="la-bar big"><i style="width:' + pct + '%"></i></div><div class="la-row"><b>' + pct + '%</b><span>' + gb(done) + ' מתוך ' + gb(tot) + ' · ' + esc(ph) + '</span></div></div>' +
      prog.files.map(function (f) {
        var p = f.total ? Math.floor(f.done / f.total * 100) : 0;
        return '<div class="la-file' + (prog.current === f.key ? ' cur' : '') + '"><div class="la-row"><span>' + (FILE_ICON[f.key] || '📦') + ' ' + esc(f.label) + '</span><span class="la-dim">' + gb(f.total) + '</span></div><div class="la-bar"><i style="width:' + p + '%"></i></div></div>';
      }).join('');
  }
  function html() {
    var s = st || { state: 'none' }, S = STATE[s.state] || STATE.none, ready = !!s.ready, m = mode();
    var h = '<div class="la" dir="rtl">' +
      '<p class="la-lead">התמונות נערכות במחשב שלך עם <b>FLUX.2 klein</b>, גם בלי אינטרנט. מתקינים פעם אחת (בערך <b>5.5 GB</b>), ומאז כל עריכות ה־AI של התמונות עובדות גם כשאין רשת.</p>' +
      '<div class="la-card"><div class="la-row"><h3>מצב</h3><span class="la-badge ' + S[1] + '">' + S[0] + '</span></div>';
    if (s.state === 'installing') h += bars();
    else if (ready) h += '<div class="la-dim">' + (s.engine ? 'מנוע ' + (s.engine.variant === 'cpu' ? 'מעבד' : 'כרטיס מסך') + ' · ' : '') + 'מודל ' + gb(s.bytes) + '</div>';
    if (s.state === 'error' || installing === 'failed') {
      h += '<div class="la-err">' + esc(ERR[s.lastCode] || ERR['install-failed']) + (s.error ? '<small>' + esc(String(s.error).slice(0, 260)) + '</small>' : '') + '</div>';
    }
    h += '<div class="la-actions">';
    if (s.state === 'installing') h += '<button class="btn danger" data-la="cancel">⏹ לעצור את ההורדה</button>';
    else if (!ready) h += '<button class="btn primary la-gold" data-la="install">⬇️ ' + (s.state === 'partial' || s.state === 'error' ? 'להמשיך את ההתקנה' : 'להתקין (~5.5 GB)') + '</button>';
    else h += '<button class="btn" data-la="test">🧪 תמונת ניסיון</button>';
    if (s.state !== 'none' && s.state !== 'installing') h += '<button class="btn ghost" data-la="remove">🗑️ להסיר</button>';
    h += '</div>';
    if (testImg) h += '<img class="la-test" alt="תמונת ניסיון" src="' + testImg + '">';
    h += '</div>';
    h += '<div class="la-card"><h3>כרטיס מסך ומהירות</h3>' + speedText() + '</div>';
    h += '<div class="la-card' + (ready ? '' : ' off') + '"><h3>מתי להשתמש בו</h3><div class="la-modes" role="radiogroup">' +
      [['auto', '✨ אוטומטי', 'ענן כשיש אינטרנט, מקומי כשאין או כשהענן נכשל'], ['local', '🖥️ תמיד מקומי', 'פרטי לגמרי, לא יוצא מהמחשב'], ['cloud', '☁️ תמיד ענן', 'כמו קודם']].map(function (o) {
        return '<button role="radio" aria-checked="' + (m === o[0]) + '" class="la-mode' + (m === o[0] ? ' on' : '') + '" data-mode="' + o[0] + '"' + (ready || o[0] === 'cloud' ? '' : ' disabled') + '><b>' + o[1] + '</b><small>' + o[2] + '</small></button>';
      }).join('') + '</div>' +
      '<div class="la-row la-size"><span>גודל התמונה במחשב</span><span class="la-seg"><button data-size="1024" class="' + (localSize() === 1024 ? 'on' : '') + '">1024 · איכות</button><button data-size="768" class="' + (localSize() === 768 ? 'on' : '') + '">768 · מאוזן</button><button data-size="512" class="' + (localSize() === 512 ? 'on' : '') + '">512 · ⚡ הכי מהיר</button></span></div>' +
      '<p class="hint">בלי כרטיס מסך: 512 מהיר בערך פי 2 מ־768 (מתאים למגנט קטן). עם כרטיס מסך: 1024.</p></div>';
    if (s.state !== 'installing' && (s.suggestCpu || (s.engine && s.engine.variant === 'vulkan' && ready))) {
      h += '<details class="la-more"><summary>הכרטיס לא מסתדר?</summary><p class="la-dim">אם העריכה נכשלת, אפשר לעבור לגרסה שרצה על המעבד בלבד (איטית יותר, אבל עובדת בכל מחשב). המודלים נשארים.</p><button class="btn small" data-la="cpu">להתקין גרסת מעבד</button></details>';
    } else if (s.state !== 'installing' && s.engine && s.engine.variant === 'cpu') {
      h += '<details class="la-more"><summary>גרסת כרטיס מסך</summary><button class="btn small" data-la="gpu">לנסות שוב את גרסת כרטיס המסך</button></details>';
    }
    h += '<p class="la-legal">FLUX.2 klein 4B ו־Qwen3 ברישיון Apache-2.0, stable-diffusion.cpp ברישיון MIT. הקבצים יורדים מ־Hugging Face ומ־GitHub ונשמרים בתיקיית התוכנה.</p></div>';
    return h;
  }
  function body() { var b = $('#dlg-body'), d = $('#dlg'); return b && d && d.open && b.querySelector('.la') ? b : null; }
  function paint() { var b = body(); if (b) { b.innerHTML = html(); } }

  function install(variant) {
    if (installing === true) return;
    installing = true; prog = { phase: 'plan', files: [] };
    if (st) st.state = 'installing'; paint();
    var t = 0;
    ls(AUTO, null);
    showFloat('dl', prog);
    API.install(function (p) { prog = p; var n = Date.now(); if (n - t > 200 || p.phase !== 'download') { t = n; if (st) st.state = 'installing'; paint(); pill(); showFloat('dl', p); } }, variant ? { variant: variant } : undefined)
      .then(function (r) {
        installing = r && r.ok ? null : 'failed';
        if (r && r.status) st = r.status;
        if (st && r && !r.ok) st.lastCode = r.error;
        if (r && r.ok) { if (!ls(KEY)) ls(KEY, 'auto'); activate(variant); }
        else if (r && r.error === 'cancelled') { installing = null; ls(AUTO, 'off'); hideFloat(); toast('ההורדה נעצרה. אפשר להמשיך מאותה נקודה (☰ ← AI מקומי).'); }
        else { toast('⚠️ ' + (ERR[r && r.error] || ERR['install-failed']), 6000); showFloat('fail', ERR[r && r.error] || ERR['install-failed']); }
        prog = null; paint(); pill();
      }, function (e) { installing = 'failed'; toast('⚠️ ' + String(e && e.message || e)); showFloat('fail', String(e && e.message || e)); refresh(); });
  }
  /* after an install: one small picture proves the engine runs on this computer. If the graphics card build fails,
     the CPU build is installed (the models stay) and checked once more. */
  function activate(variant) {
    showFloat('check');
    API.run({ mode: 'image', prompt: 'an ornate gold picture frame on dark velvet, studio light, photorealistic', w: 256, h: 256, seed: 1 }).then(function (r) {
      if (r && r.ok) { ls('fs-ai-local-ok', String(Date.now())); showFloat('ok', r.ms); refresh(); return; }
      if (variant !== 'cpu' && st && st.engine && st.engine.variant !== 'cpu') { toast('כרטיס המסך לא הסתדר עם המנוע. עובר לגרסת המעבד (איטית יותר, עובדת בכל מחשב)…', 7000); install('cpu'); return; }
      toast('⚠️ מנוע ה־AI הותקן אבל הבדיקה לא הצליחה' + (r && r.detail ? ': ' + String(r.detail).slice(-160) : '') + '. ☰ ← AI מקומי ← תמונת ניסיון.', 10000); showFloat('fail', 'הבדיקה לא הצליחה'); refresh();
    });
  }
  /* ---------- the download, seen on every screen: a floating card (click opens the panel), the taskbar button, a notification at the end ---------- */
  var flo = null, t0 = 0, b0 = 0, lastPct = -1, floHide = 0;
  function hideFloat() { clearTimeout(floHide); if (flo) { flo.remove(); flo = null; } if (D && D.progress) D.progress(-1); lastPct = -1; }
  function showFloat(kind, p) {
    if (!document.body) return;
    if (!flo) { flo = document.createElement('button'); flo.type = 'button'; flo.id = 'la-float'; flo.addEventListener('click', open); document.body.appendChild(flo); }
    clearTimeout(floHide);
    if (kind === 'dl') {
      var tot = (p && p.total) || 0, done = (p && p.done) || 0, f = tot ? done / tot : 0, pct = Math.floor(f * 100);
      if (!t0 || done < b0) { t0 = Date.now(); b0 = done; }
      var sec = (Date.now() - t0) / 1000, sp = sec > 0 ? (done - b0) / sec : 0, left = sp > 0 && tot ? (tot - done) / sp : 0;
      var eta = left > 0 && sec > 5 ? ' · נשארו ' + (left >= 3600 ? (left / 3600).toFixed(1) + ' שעות' : left >= 90 ? Math.round(left / 60) + ' דקות' : Math.max(1, Math.round(left)) + ' שניות') : '';
      var ph = !tot ? 'מתחיל…' : gb(done) + ' מתוך ' + gb(tot) + eta;
      flo.className = 'la-float dl';
      flo.innerHTML = '<b>⬇️ מתקין את מנוע ה־AI המקומי · ' + pct + '%</b><span>' + ph + ' · אפשר להמשיך לעבוד</span><i style="width:' + pct + '%"></i>';
      if (D && D.progress && pct !== lastPct) { lastPct = pct; D.progress(tot ? f : 0.01); }
    } else if (kind === 'check') {
      flo.className = 'la-float dl';
      flo.innerHTML = '<b>🔧 מפעיל את מנוע ה־AI ובודק אותו…</b><span>ההורדה הסתיימה. עוד רגע זה מוכן, אפשר להמשיך לעבוד</span><i class="run"></i>';
      if (D && D.progress) D.progress(1);
    } else if (kind === 'ok') {
      flo.className = 'la-float ok';
      flo.innerHTML = '<b>✅ ההתקנה הסתיימה: מנוע ה־AI המקומי מוכן</b><span>כל עיצובי ה־AI עובדים עכשיו גם בלי אינטרנט' + (p ? ' · תמונת הבדיקה לקחה ' + Math.max(1, Math.round(p / 1000)) + ' שניות' : '') + '</span>';
      if (D && D.progress) D.progress(-1);
      if (D && D.notify) D.notify('אופטימוס', 'ההתקנה הסתיימה: מנוע ה־AI המקומי מותקן ופועל. כל עיצובי ה־AI עובדים עכשיו גם בלי אינטרנט.');
      floHide = setTimeout(hideFloat, 30000);
    } else if (kind === 'fail') {
      flo.className = 'la-float bad';
      flo.innerHTML = '<b>⚠️ התקנת מנוע ה־AI נעצרה</b><span>' + esc(String(p || '')) + ' · לחיצה כאן ממשיכה</span>';
      if (D && D.progress) D.progress(2);
    }
  }
  /* the download runs in the program itself; after a reload of the page it is followed again from its status */
  var follow = 0;
  function followStatus() {
    clearTimeout(follow);
    API.status().then(function (s) {
      st = s;
      if (s && s.state === 'installing' && installing !== true) { showFloat('dl', s.progress); follow = setTimeout(followStatus, 1500); }
      else if (s && s.ready && flo && installing !== true) { activate(); }
      pill();
    }).catch(function () {});
  }
  first.then(function (s) { if (s && s.state === 'installing') followStatus(); });

  function test() {
    var b = body(), btn = b && b.querySelector('[data-la=test]'); if (btn) { btn.disabled = true; btn.textContent = '🧪 0%'; }
    API.run({ mode: 'image', prompt: 'an ornate gold picture frame on dark velvet, studio light, photorealistic', w: 512, h: 512 }, function (p) {
      var x = body() && body().querySelector('[data-la=test]'); if (x && p) x.textContent = '🧪 ' + p.pct + '%';
    }).then(function (r) {
      if (r && r.ok) { testImg = 'data:image/png;base64,' + r.image; toast('✅ עבד (' + Math.round(r.ms / 1000) + ' שניות)'); }
      else { if (r && r.suggestCpu && st) st.suggestCpu = true; toast('⚠️ הניסיון לא הצליח' + (r && r.detail ? ': ' + String(r.detail).slice(-160) : ''), 8000); }
      paint();
    });
  }
  function onClick(e) {
    var t = e.target.closest('[data-la],[data-mode],[data-size]'); if (!t || !body()) return;
    if (t.dataset.mode) { ls(KEY, t.dataset.mode); paint(); pill(); toast(t.querySelector('b').textContent); return; }
    if (t.dataset.size) { ls(SIZE_KEY, t.dataset.size); paint(); return; }
    var a = t.dataset.la;
    if (a === 'install') install();
    else if (a === 'cpu') install('cpu');
    else if (a === 'gpu') install('vulkan');
    else if (a === 'cancel') API.cancelInstall();
    else if (a === 'test') test();
    else if (a === 'remove') {
      if (!confirm('להסיר את ה־AI המקומי מהמחשב? (משתחררים כ־5.5GB. אפשר להתקין שוב מתי שרוצים)')) return;
      t.disabled = true; API.remove().then(function (s) { st = s; installing = null; testImg = ''; ls(AUTO, 'off'); paint(); pill(); toast('הוסר.'); });
    }
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#dlg-body .la')) onClick(e); });

  function open() {
    if (!FS.dialog) return;
    var b = FS.dialog(TITLE, html());
    b.classList.add('la-host');
    loadGpu(); refresh();
  }

  /* ---------- entry points: a card at the top of the AI tab, and the ☰ menu ---------- */
  function pill() {
    var el = document.getElementById('la-pill'); if (!el) return;
    var s = st || {}, m = mode();
    el.className = 'la-badge ' + (s.ready ? 'on' : s.state === 'installing' || installing === true ? 'act' : 'off');
    var pct = installing === true && prog && prog.total ? ' ' + Math.floor((prog.done || 0) / prog.total * 100) + '%' : '';
    el.textContent = s.ready ? (m === 'local' ? 'תמיד מקומי' : m === 'cloud' ? 'כבוי (ענן)' : 'אוטומטי') : installing === true ? 'מוריד…' + pct : 'לא מותקן';
    var mb = document.getElementById('la-menu'); if (mb) mb.textContent = TITLE + (installing === true ? ' · מוריד' + pct : '');
  }
  var pane = document.querySelector('[data-pane=ai]');
  if (pane) {
    var card = document.createElement('div');
    card.className = 'card la-entry';
    card.innerHTML = '<h3>🖥️ AI מקומי</h3><p class="hint">עריכות AI של תמונות במחשב שלך, גם בלי אינטרנט.</p><div class="la-row"><span id="la-pill" class="la-badge off">…</span><button class="btn small" id="la-open">פתיחה</button></div>';
    var h2 = pane.querySelector('h2');
    pane.insertBefore(card, h2 ? h2.nextSibling : pane.firstChild);
    card.querySelector('#la-open').addEventListener('click', open);
  }
  var menu = document.getElementById('sb-menu-m');
  if (menu) {
    var mb = document.createElement('button'); mb.className = 'btn'; mb.id = 'la-menu'; mb.textContent = TITLE;
    mb.addEventListener('click', open);
    menu.insertBefore(mb, menu.children[1] || null);
  }
  pill();

  /* automatic: the first time the program opens with internet (and every later opening until it is complete), the engine
     downloads in the background (desktop/local-ai.js, resumable), so the AI designs work offline without anyone asking for it.
     Stopping the download or removing the engine turns this off (fs-ai-local-auto = off); installing again turns it back on. */
  var AUTO = 'fs-ai-local-auto';
  first.then(function (s) {
    if (!s || s.ready || s.state === 'installing' || !s.supported || ls(AUTO) === 'off') return;
    function go() {
      if (installing === true || (st && st.ready)) return;
      install();   /* the floating card says it (showFloat) */
    }
    if (navigator.onLine === false) window.addEventListener('online', function on() { window.removeEventListener('online', on); setTimeout(go, 3000); });
    else setTimeout(go, 3000);
  });
})();
