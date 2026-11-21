/* פאנל: ספרייה, מעבדת סגנונות ועמוד קומיקס. */
(function () {
  'use strict';

  var FX = window.ComicFX, PG = window.ComicPage, AI = window.ComicAI, DB = window.ComicStore, NN = window.ComicNeural, MO = window.ComicMotion;
  var EN = window.ComicEngine, SZ = EN.SIZES;
  var MAX_IMAGES = 300;
  var STORE_MAX = 2000;       /* הצד הארוך של צילום שנשמר */
  var EXPORT_MAX = SZ.export; /* רזולוציית העיבוד בייצוא, קטנה יותר בטלפון */

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uid(p) { return (p || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var state = {
    images: [],          /* {id, name, w, h, thumb, blob, kind, added} */
    sel: [],             /* מזהים נבחרים לפי סדר הבחירה */
    filter: 'all',
    view: 'library',
    labId: null,
    labStyle: 'gouache',
    labParams: {},
    aiStyle: 'ai-comic',
    project: null,
    pageIdx: 0,
    batch: []
  };

  /* ---------- הודעות ---------- */
  var toastTimer;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 3200);
  }

  /* ---------- תמונות ---------- */
  function imageById(id) { return state.images.find(function (i) { return i.id === id; }); }
  function srcOf(id) { var m = imageById(id); return m ? { id: m.id, blob: m.blob, w: m.w, h: m.h } : null; }
  function closeImg(b) { try { if (b && b.close) b.close(); } catch (e) { /* כבר נסגר */ } }

  /* תמונה מפוענחת בגודל מוגבל לשימוש חד-פעמי (AI, הנפשה). מי שמקבל אותה סוגר אותה בסוף */
  function loadBitmap(id, max) {
    var m = imageById(id);
    if (!m) return Promise.reject(new Error('התמונה לא נמצאה'));
    return EN.decode(m.blob, max, m.w, m.h);
  }

  function canvasToBlob(c, type, q) {
    return new Promise(function (resolve) { c.toBlob(resolve, type || 'image/png', q); });
  }

  /* פענוח קובץ שהועלה. נסגר מיד אחרי שמקטינים אותו, כדי שתמונות של 12 מגה-פיקסל לא יישארו בזיכרון */
  function decodeFile(file) {
    var legacy = function () {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ': הדפדפן לא מצליח לפתוח את הקובץ')); };
        im.src = url;
      });
    };
    if (typeof createImageBitmap === 'undefined') return legacy();
    return createImageBitmap(file).catch(legacy);
  }

  function scaled(src, max) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function thumbOf(src) {
    var c = scaled(src, 360);
    return c.toDataURL('image/jpeg', 0.82);
  }

  function bitmapToCanvas(b) {
    var c = document.createElement('canvas');
    c.width = b.width; c.height = b.height;
    c.getContext('2d').drawImage(b, 0, 0);
    return c;
  }

  /* מוסיף תמונה לספרייה ממקור canvas או תמונה */
  function addImage(src, name, kind, origin) {
    if (state.images.length >= MAX_IMAGES) return Promise.reject(new Error('הספרייה מלאה: ' + MAX_IMAGES + ' תמונות. מחקו כמה כדי להוסיף.'));
    var c = scaled(src, STORE_MAX);
    return canvasToBlob(c, 'image/jpeg', 0.92).then(function (blob) {
      var meta = { id: uid('im'), name: name, w: c.width, h: c.height, thumb: thumbOf(c), blob: blob, kind: kind || 'photo', origin: origin || null, added: Date.now() };
      c.width = c.height = 1;
      state.images.push(meta);
      return DB.put('images', meta).then(function () { return meta; });
    });
  }

  function importFiles(list) {
    var files = Array.prototype.filter.call(list, function (f) { return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name); });
    if (!files.length) { toast('לא נמצאו קבצי תמונה.'); return Promise.resolve([]); }
    var room = MAX_IMAGES - state.images.length;
    if (room <= 0) { toast('הספרייה מלאה: ' + MAX_IMAGES + ' תמונות. מחקו כמה כדי להוסיף.'); return Promise.resolve([]); }
    var skipped = Math.max(0, files.length - room);
    files = files.slice(0, room);
    var added = [], i = 0, errors = 0;
    function next() {
      if (i >= files.length) return Promise.resolve();
      var f = files[i++];
      toast('מוסיף ' + i + ' מתוך ' + files.length + '…', 60000);
      return decodeFile(f).then(function (im) {
        return addImage(im, f.name.replace(/\.[^.]+$/, ''), 'photo').then(function (m) {
          closeImg(im);
          if (im.src) URL.revokeObjectURL(im.src);
          added.push(m);
          /* מרעננים את הספרייה כל כמה תמונות, כדי שיהיה רואים התקדמות */
          if (added.length % 6 === 0) renderLibrary();
        });
      }).catch(function () { errors++; }).then(next);
    }
    return next().then(function () {
      /* אין בחירה קודמת: כל מה שהועלה עכשיו נבחר */
      if (!state.sel.length) added.forEach(function (m) { state.sel.push(m.id); });
      saveMeta();
      renderLibrary();
      var msg = 'נוספו ' + added.length + ' תמונות.';
      if (skipped) msg += ' ' + skipped + ' לא נכנסו כי הגעתם ל-' + MAX_IMAGES + '.';
      if (errors) msg += ' ' + errors + ' קבצים לא נפתחו (נסו להמיר ל-JPG).';
      toast(msg, 5000);
      return added;
    });
  }

  function deleteImages(ids) {
    ids.forEach(function (id) {
      state.images = state.images.filter(function (m) { return m.id !== id; });
      state.sel = state.sel.filter(function (s) { return s !== id; });
      dropCacheFor(id);
      EN.forget(id);
      DB.del('images', id);
    });
    if (state.project) state.project.pages.forEach(function (pg) {
      pg.panels.forEach(function (pn) { if (ids.indexOf(pn.img) >= 0) pn.img = null; });
      pg.items.forEach(function (it) { if (ids.indexOf(it.img) >= 0) it.img = null; });
    });
    saveMeta();
    saveProject();
  }

  function saveMeta() {
    DB.put('meta', { id: 'state', sel: state.sel, labStyle: state.labStyle, labParams: state.labParams, aiStyle: state.aiStyle });
    updateCounts();
  }

  /* ---------- עיבוד ----------
     כל הציור רץ בעובדי רקע (engine.js). התוצאות נשמרות במטמון עם תקציב פיקסלים קבוע:
     כשעוברים אותו, התוצאות הישנות נסגרות ומשחררות זיכרון. */
  var cache = new Map(), inflight = new Map(), cachePx = 0;

  function refKey(ref, max) { return ref.img + '|' + ref.style + '|' + JSON.stringify(ref.params || {}) + '|' + max; }

  function cacheGet(key) {
    if (!cache.has(key)) return null;
    var b = cache.get(key);
    cache.delete(key); cache.set(key, b);
    return b;
  }
  function cachePut(key, b) {
    cache.set(key, b);
    cachePx += b.width * b.height;
    while (cachePx > SZ.budget && cache.size > 1) {
      var k = cache.keys().next().value;
      if (k === key) break;
      var old = cache.get(k);
      cache.delete(k);
      cachePx -= old.width * old.height;
      closeImg(old);
    }
  }
  function dropCacheFor(imgId) {
    Array.from(cache.keys()).forEach(function (k) {
      if (k.indexOf(imgId + '|') !== 0) return;
      var b = cache.get(k);
      cache.delete(k);
      cachePx -= b.width * b.height;
      closeImg(b);
    });
  }

  function hebrew(s) { return /[֐-׿]/.test(s || ''); }
  function friendly(e, style) {
    if (e && e.canceled) return e;
    console.error(e);
    if (e && hebrew(e.message)) return e;
    if (NN.isNeural(style)) return new Error('לא הצלחתי להפעיל את מודל ה-AI. בדקו את החיבור לאינטרנט ונסו שוב.');
    return new Error('העיבוד נכשל. נסו שוב או בחרו סגנון אחר.');
  }

  /* התקדמות הורדה של מודל AI, בפעם הראשונה */
  function progressFor(style) {
    if (!NN.isNeural(style)) return null;
    var first = !NN.loaded(style);
    setBusy(first ? 'מוריד את מודל ה-AI (' + NN.sizeOf(style) + 'MB)…' : 'הרשת מציירת…');
    return function (f) { setBusy(f < 1 ? 'מוריד את מודל ה-AI · ' + Math.round(f * 100) + '%' : 'הרשת מציירת…'); };
  }

  /* עם מטמון. התוצאה שייכת למטמון: מציירים אותה מיד ולא סוגרים אותה */
  function processNow(ref, max) {
    var key = refKey(ref, max), hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    if (inflight.has(key)) return inflight.get(key).promise;
    var src = srcOf(ref.img);
    if (!src) return Promise.reject(new Error('התמונה לא נמצאה'));
    var style = ref.style || 'original', first = NN.isNeural(style) && !NN.loaded(style);
    var job = EN.render(src, style, ref.params, max, { onProgress: progressFor(style) });
    var p = job.promise.then(function (b) {
      inflight.delete(key);
      cachePut(key, b);
      if (first) toast('המודל של ״' + FX.byId[style].name + '״ נטען ונשמר בדפדפן. בפעם הבאה זה מהיר יותר.');
      return b;
    }, function (e) { inflight.delete(key); throw friendly(e, style); });
    inflight.set(key, { promise: p, id: job.id });
    return p;
  }

  /* בלי מטמון (ייצוא, תצוגות מקדימות). מחזיר { id, promise }; מי שמקבל את התוצאה סוגר אותה */
  function processOnce(ref, max, preview) {
    var src = srcOf(ref.img), style = ref.style || 'original';
    if (!src) return { id: null, promise: Promise.reject(new Error('התמונה לא נמצאה')) };
    var job = EN.render(src, style, ref.params, max, { onProgress: preview ? null : progressFor(style), preview: preview });
    return { id: job.id, promise: job.promise.catch(function (e) { throw friendly(e, style); }) };
  }

  function cancelKey(key) {
    var f = inflight.get(key);
    if (!f) return;
    inflight.delete(key);
    EN.cancel([f.id]);
  }

  function setBusy(text) {
    var b = $('stage-busy');
    if (b) b.textContent = text;
    if (state.view !== 'lab') toast(text, 4000);
  }

  /* לציור חי בעמוד: מחזיר מיד מה שיש, ומבקש ציור מחדש כשמוכן */
  var failedAt = {}, failCanvas = null;
  function failTile() {
    if (failCanvas) return failCanvas;
    var c = document.createElement('canvas');
    c.width = 480; c.height = 360;
    var x = c.getContext('2d');
    x.fillStyle = '#2a2f3d'; x.fillRect(0, 0, 480, 360);
    x.fillStyle = '#ffd23f'; x.textAlign = 'center'; x.direction = 'rtl';
    x.font = '600 28px "IBM Plex Sans Hebrew", sans-serif';
    x.fillText('הציור לא הצליח', 240, 165);
    x.fillStyle = '#a9b0c0'; x.font = '22px "IBM Plex Sans Hebrew", sans-serif';
    x.fillText('בחרו סגנון אחר או נסו שוב בעוד רגע', 240, 205);
    failCanvas = c;
    return c;
  }

  function getProcessed(ref, max) {
    var key = refKey(ref, max), hit = cacheGet(key);
    if (hit) return hit;
    if (!imageById(ref.img)) return null;
    /* פאנל שנכשל לא מנסה שוב בלולאה: מראה הודעה, ומנסה שוב רק אחרי 30 שניות */
    if (failedAt[key] && Date.now() - failedAt[key] < 30000) return failTile();
    if (!inflight.has(key)) processNow(ref, max).then(function () { delete failedAt[key]; if (editor) editor.draw(); })
      .catch(function (e) { if (e && e.canceled) return; failedAt[key] = Date.now(); if (editor) editor.draw(); });
    return null;
  }

  /* ---------- ניווט ---------- */
  function show(view) {
    if (view !== state.view) stopMotion();
    state.view = view;
    ['library', 'create', 'lab', 'page'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
      $('tab-' + v).setAttribute('aria-selected', String(v === view));
    });
    if (view === 'lab') enterLab();
    if (view === 'page') enterPage();
    if (view === 'create' && window.ComicCreate) window.ComicCreate.enter();
    window.scrollTo({ top: 0 });
  }

  function updateCounts() {
    $('tab-count').textContent = state.images.length + ' / ' + MAX_IMAGES;
    $('tab-selcount').textContent = state.sel.length ? 'נבחרו ' + state.sel.length : 'לא נבחרו תמונות';
    var room = MAX_IMAGES - state.images.length;
    $('drop-count').textContent = room ? 'אפשר להוסיף עוד ' + room + ' תמונות' : 'הספרייה מלאה';
    if (state.project) $('tab-pages').textContent = state.project.pages.length === 1 ? 'עמוד 1' : state.project.pages.length + ' עמודים';
  }

  /* ---------- ספרייה ---------- */
  var lastClicked = null;

  function renderLibrary() {
    updateCounts();
    var has = state.images.length > 0;
    $('lib-hero').classList.toggle('compact', has);
    $('lib-tools').hidden = !has;
    $('lib-hint').hidden = !has;
    var grid = $('grid');
    grid.textContent = '';
    var list = state.images.slice();
    if (state.filter === 'selected') list = state.sel.map(imageById).filter(Boolean);
    if (state.filter === 'made') list = list.filter(function (m) { return m.kind !== 'photo'; });
    if (has && !list.length) {
      grid.appendChild(el('p', 'muted empty', state.filter === 'selected' ? 'עוד לא בחרתם תמונות. לוחצים על תמונה כדי לבחור.' : 'עוד אין יצירות. שומרים תוצאה מהמעבדה והיא תופיע כאן.'));
    }
    list.forEach(function (m) {
      var b = el('button', 'tile');
      b.type = 'button';
      b.dataset.id = m.id;
      var idx = state.sel.indexOf(m.id);
      b.setAttribute('aria-pressed', String(idx >= 0));
      b.setAttribute('aria-label', m.name + (idx >= 0 ? ', נבחרה, מקום ' + (idx + 1) : ''));
      var img = el('img');
      img.src = m.thumb; img.alt = ''; img.loading = 'lazy';
      b.appendChild(img);
      if (idx >= 0) b.appendChild(el('span', 'num', String(idx + 1)));
      if (m.kind !== 'photo') b.appendChild(el('span', 'kind', m.kind === 'ai' ? 'AI' : 'מעבדה'));
      b.appendChild(el('span', 'name', m.name));
      grid.appendChild(b);
    });
  }

  function markLibrary() {
    updateCounts();
    var pos = {};
    state.sel.forEach(function (x, i) { pos[x] = i + 1; });
    document.querySelectorAll('#grid .tile').forEach(function (b) {
      var n = pos[b.dataset.id] || 0, m = imageById(b.dataset.id);
      b.setAttribute('aria-pressed', String(n > 0));
      if (m) b.setAttribute('aria-label', m.name + (n ? ', נבחרה, מקום ' + n : ''));
      var num = b.querySelector('.num');
      if (n && !num) { num = el('span', 'num'); b.insertBefore(num, b.children[1] || null); }
      if (num) { if (n) num.textContent = String(n); else num.remove(); }
    });
  }

  function toggleSel(id, range) {
    if (range && lastClicked) {
      var ids = state.images.map(function (m) { return m.id; });
      var a = ids.indexOf(lastClicked), b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (x) { if (state.sel.indexOf(x) < 0) state.sel.push(x); });
      }
    } else {
      var i = state.sel.indexOf(id);
      if (i >= 0) state.sel.splice(i, 1); else state.sel.push(id);
    }
    lastClicked = id;
    saveMeta();
    /* עם מאות תמונות לא בונים את כל הרשת מחדש בכל לחיצה: רק מעדכנים סימונים */
    if (state.filter === 'selected') renderLibrary(); else markLibrary();
    var t = document.querySelector('.tile[data-id="' + id + '"]');
    if (t) t.focus();
  }

  function bindLibrary() {
    var input = $('file-input'), drop = $('drop');
    input.addEventListener('change', function () { importFiles(input.files).then(function () { input.value = ''; }); });
    $('btn-upload').addEventListener('click', function () { input.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        if (state.view !== 'library' || !e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
        e.preventDefault(); drop.classList.add('over');
      });
    });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) drop.classList.remove('over'); });
    document.addEventListener('drop', function (e) {
      drop.classList.remove('over');
      if (state.view !== 'library' || !e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      importFiles(e.dataTransfer.files);
    });
    document.addEventListener('paste', function (e) {
      if (state.view !== 'library' || !e.clipboardData) return;
      var files = Array.prototype.map.call(e.clipboardData.items, function (i) { return i.kind === 'file' ? i.getAsFile() : null; }).filter(Boolean);
      if (files.length) importFiles(files);
    });
    $('grid').addEventListener('click', function (e) {
      var t = e.target.closest('.tile');
      if (t) toggleSel(t.dataset.id, e.shiftKey);
    });
    document.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filter = b.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderLibrary();
      });
    });
    $('btn-select-all').addEventListener('click', function () {
      state.images.forEach(function (m) { if (state.sel.indexOf(m.id) < 0) state.sel.push(m.id); });
      saveMeta(); renderLibrary();
    });
    $('btn-select-none').addEventListener('click', function () { state.sel = []; saveMeta(); renderLibrary(); });
    $('btn-delete').addEventListener('click', function () {
      if (!state.sel.length) { toast('בחרו קודם את התמונות שרוצים למחוק.'); return; }
      if (!confirm('למחוק ' + state.sel.length + ' תמונות מהספרייה? הן יוצאו גם מהעמודים.')) return;
      var n = state.sel.length;
      deleteImages(state.sel.slice());
      renderLibrary();
      toast('נמחקו ' + n + ' תמונות.');
    });
    $('btn-to-lab').addEventListener('click', function () { show('lab'); });
    $('btn-to-create').addEventListener('click', function () { show('create'); });
    $('btn-auto').addEventListener('click', function () { show('page'); autoBuild(); });
  }

  /* ---------- מעבדה ---------- */
  var thumbJob = 0, labTimer;

  function labOrder() {
    var ids = state.sel.slice();
    state.images.forEach(function (m) { if (ids.indexOf(m.id) < 0) ids.push(m.id); });
    return ids;
  }

  function enterLab() {
    var ids = labOrder();
    if (!state.labId || !imageById(state.labId)) state.labId = ids[0] || null;
    renderPickList();
    renderAiChips();
    renderMotionChips();
    $('stage-empty').hidden = !!state.labId;
    $('stage-inner').hidden = !state.labId;
    if (state.labId) { renderStyleThumbs(); renderLab(); }
    updateAiState();
  }

  function renderPickList() {
    var box = $('pick-list');
    box.textContent = '';
    labOrder().forEach(function (id) {
      var m = imageById(id);
      var b = el('button', 'pick');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(id === state.labId));
      b.setAttribute('aria-label', m.name);
      var im = el('img'); im.src = m.thumb; im.alt = ''; im.loading = 'lazy';
      b.appendChild(im);
      var si = state.sel.indexOf(id);
      if (si >= 0) b.appendChild(el('span', 'num', String(si + 1)));
      b.addEventListener('click', function () {
        state.labId = id;
        box.querySelectorAll('.pick').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderStyleThumbs();
        renderLab();
      });
      box.appendChild(b);
    });
  }

  function labParams(style) { return state.labParams[style] || (state.labParams[style] = {}); }

  var thumbObserver = null, thumbJobs = [];

  function renderStyleThumbs() {
    var job = ++thumbJob, box = $('style-groups');
    box.textContent = '';
    var groups = {};
    FX.STYLES.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    var cells = [];
    Object.keys(groups).forEach(function (g) {
      var sec = el('div', 'sgroup');
      sec.appendChild(el('h3', 'eyebrow', g));
      var row = el('div', 'srow');
      groups[g].forEach(function (s) {
        var b = el('button', 'scard');
        b.type = 'button';
        b.dataset.style = s.id;
        b.setAttribute('aria-pressed', String(s.id === state.labStyle));
        var f = el('span', 'sframe');
        if (NN.isNeural(s.id) && !NN.loaded(s.id)) {
          var badge = el('span', 'ai-badge');
          badge.appendChild(el('b', '', 'AI'));
          badge.appendChild(el('span', '', 'לחיצה להפעלה · ' + NN.sizeOf(s.id) + 'MB'));
          f.appendChild(badge);
          f.classList.add('lazy');
        } else f.appendChild(el('span', 'spin'));
        b.appendChild(f);
        b.appendChild(el('span', 'sname', s.name));
        b.addEventListener('click', function () {
          state.labStyle = s.id;
          box.querySelectorAll('.scard').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          saveMeta();
          renderLab();
        });
        row.appendChild(b);
        if (!(NN.isNeural(s.id) && !NN.loaded(s.id))) cells.push({ s: s, f: f });
      });
      sec.appendChild(row);
      box.appendChild(sec);
    });
    /* תצוגות מקדימות רק לכרטיסים שנראים על המסך, אחת-אחת ברקע, בגודל קטן */
    var id = state.labId;
    if (thumbObserver) thumbObserver.disconnect();
    EN.cancel(thumbJobs);
    thumbJobs = [];
    var make = function (cell) {
      if (cell.started || job !== thumbJob) return;
      cell.started = true;
      if (!EN.background()) { cell.f.textContent = ''; cell.f.appendChild(el('span', 'nopreview', cell.s.name)); return; }
      var r = processOnce({ img: id, style: cell.s.id, params: labParams(cell.s.id) }, SZ.thumb, true);
      if (r.id) thumbJobs.push(r.id);
      r.promise.then(function (b) {
        if (job !== thumbJob) { closeImg(b); return; }
        var c = bitmapToCanvas(b);
        closeImg(b);
        cell.f.textContent = '';
        cell.f.appendChild(c);
      }).catch(function () {
        if (job !== thumbJob) return;
        cell.f.textContent = '';
        cell.f.appendChild(el('span', 'nopreview', cell.s.name));
      });
    };
    if ('IntersectionObserver' in window) {
      thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          thumbObserver.unobserve(en.target);
          make(en.target._cell);
        });
      }, { rootMargin: '200px 0px' });
      cells.forEach(function (c) { c.f._cell = c; thumbObserver.observe(c.f); });
    } else cells.forEach(make);
  }

  function renderKnobs(box, styleId, params, onChange, compact) {
    box.textContent = '';
    var st = FX.byId[styleId];
    var p = FX.paramsFor(styleId, params);
    (st.knobs || []).forEach(function (k) {
      var spec = FX.KNOBS[k];
      var lab = el('label', 'field knob');
      var top = el('span', '', spec.label);
      var val = el('output', '', fmt(k, p[k]));
      top.appendChild(val);
      lab.appendChild(top);
      var r = el('input');
      r.type = 'range'; r.min = spec.min; r.max = spec.max; r.step = spec.step; r.value = p[k];
      r.addEventListener('input', function () {
        params[k] = Number(r.value);
        val.textContent = fmt(k, params[k]);
        onChange(k);
      });
      lab.appendChild(r);
      box.appendChild(lab);
    });
    if (!compact && centerable(styleId)) box.appendChild(el('p', 'muted small knob-note', st.center ? 'לוחצים על התמונה כדי לקבוע את מרכז הפעולה.' : 'לוחצים על הפנים בתמונה כדי למרכז את ההגזמה.'));
  }
  function centerable(id) { var st = FX.byId[id]; return Boolean(st && (st.center || (st.knobs || []).indexOf('warp') >= 0)); }
  function fmt(k, v) { return k === 'rad' ? Math.round(v * 100) + '%' : String(v); }

  function renderLab() {
    var id = state.labId;
    if (!id) return;
    var st = FX.byId[state.labStyle];
    $('lab-style-name').textContent = st.name;
    $('lab-style-desc').textContent = st.desc;
    var params = labParams(state.labStyle);
    renderKnobs($('lab-knobs'), state.labStyle, params, function () {
      clearTimeout(labTimer);
      labTimer = setTimeout(function () { drawStage(); saveMeta(); }, 220);
    });
    var meta = imageById(id);
    if (stageOrigUrl) URL.revokeObjectURL(stageOrigUrl);
    stageOrigUrl = URL.createObjectURL(meta.blob);
    $('stage-orig').src = stageOrigUrl;
    drawStage();
  }

  var stageJob = 0, stageKey = null, stageOrigUrl = null;
  function drawStage() {
    var job = ++stageJob, id = state.labId, style = state.labStyle, params = labParams(style);
    $('stage-busy').hidden = false;
    $('stage-busy').textContent = NN.isNeural(style) ? 'הרשת מציירת…' : 'מצייר…';
    var p = FX.paramsFor(style, params), cross = $('cross');
    cross.hidden = !centerable(style);
    cross.style.left = (p.cx * 100) + '%';
    cross.style.top = (p.cy * 100) + '%';
    /* בקשה קודמת שעוד לא הסתיימה כבר לא רלוונטית */
    var ref = { img: id, style: style, params: params }, key = refKey(ref, SZ.stage);
    if (stageKey && stageKey !== key) cancelKey(stageKey);
    stageKey = key;
    processNow(ref, SZ.stage).then(function (c) {
      if (job !== stageJob) return;
      var out = $('stage-out');
      out.width = c.width; out.height = c.height;
      out.getContext('2d').drawImage(c, 0, 0);
      $('stage-inner').style.aspectRatio = c.width + ' / ' + c.height;
      $('stage-busy').hidden = true;
      if (motionFx) { clearTimeout(motionTimer); motionTimer = setTimeout(function () { if (motionFx) startMotion(motionFx); }, 600); }
      /* כרטיס הסגנון מקבל את התוצאה כתצוגה מקדימה */
      var card = document.querySelector('.scard[data-style="' + style + '"] .sframe');
      if (card && card.classList.contains('lazy')) {
        card.classList.remove('lazy');
        card.textContent = '';
        card.appendChild(scaled(out, SZ.thumb));
      }
    }).catch(function (e) {
      if (e && e.canceled) return;
      if (job === stageJob) $('stage-busy').hidden = true;
      toast(e.message, 6000);
    });
  }

  function setCompare(v) {
    $('stage-orig').style.clipPath = 'inset(0 0 0 ' + v + '%)';
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function safeName(s) { return String(s || 'comic').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60); }

  /* תוצאה בגודל מלא כ-canvas */
  function renderFull(id, style, params) {
    return processOnce({ img: id, style: style, params: params }, EXPORT_MAX).promise.then(function (b) {
      var c = bitmapToCanvas(b);
      closeImg(b);
      return c;
    });
  }

  function bindLab() {
    $('compare').addEventListener('input', function () { setCompare($('compare').value); });
    setCompare(100);
    $('stage-inner').addEventListener('click', function (e) {
      if (e.target.id === 'compare' || !centerable(state.labStyle)) return;
      var r = $('stage-out').getBoundingClientRect();
      var p = labParams(state.labStyle);
      p.cx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      p.cy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      saveMeta();
      drawStage();
    });
    $('lab-reset').addEventListener('click', function () {
      state.labParams[state.labStyle] = {};
      saveMeta(); renderLab();
    });
    $('lab-save').addEventListener('click', function () {
      var m = imageById(state.labId), st = FX.byId[state.labStyle];
      toast('שומר בגודל מלא…', 30000);
      renderFull(state.labId, state.labStyle, labParams(state.labStyle)).then(function (c) {
        return addImage(c, m.name + ' · ' + st.name, 'lab', state.labId);
      }).then(function (n) {
        saveMeta();
        renderPickList();
        toast('נשמר בספרייה: ' + n.name);
      }).catch(function (e) { toast(e.message, 5000); });
    });
    $('lab-download').addEventListener('click', function () {
      var m = imageById(state.labId), st = FX.byId[state.labStyle];
      toast('מכין קובץ…', 30000);
      renderFull(state.labId, state.labStyle, labParams(state.labStyle)).then(function (c) { return canvasToBlob(c, 'image/png'); })
        .then(function (b) { download(b, safeName(m.name + ' - ' + st.name) + '.png'); toast('ההורדה התחילה.'); });
    });
    $('lab-batch').addEventListener('click', runBatch);
    $('lab-to-page').addEventListener('click', function () {
      ensureProject();
      var ref = { img: state.labId, style: state.labStyle, params: JSON.parse(JSON.stringify(labParams(state.labStyle))) };
      placeInPage(ref);
      show('page');
    });
    $('batch-save').addEventListener('click', function () {
      var items = state.batch.slice(), saved = 0;
      (function next(i) {
        if (i >= items.length) { saveMeta(); toast('נשמרו ' + saved + ' תמונות בספרייה.'); return; }
        decodeFile(items[i].blob).then(function (im) {
          return addImage(im, items[i].name, 'lab', items[i].origin).then(function () { closeImg(im); if (im.src) URL.revokeObjectURL(im.src); });
        }).then(function () { saved++; next(i + 1); })
          .catch(function (e) { toast(e.message, 5000); saveMeta(); });
      })(0);
    });
    $('batch-zip').addEventListener('click', function () {
      toast('מכין ZIP…', 60000);
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(function () {
        var zip = new window.JSZip();
        return Promise.all(state.batch.map(function (b, i) {
          zip.file(String(i + 1).padStart(2, '0') + ' ' + safeName(b.name) + '.jpg', b.blob);
        })).then(function () { return zip.generateAsync({ type: 'blob' }); });
      }).then(function (z) { download(z, 'comic-batch.zip'); toast('ההורדה התחילה.'); })
        .catch(function () { toast('לא הצלחתי לטעון את ספריית ה-ZIP. בדקו את החיבור לאינטרנט.', 5000); });
    });
    $('ai-go').addEventListener('click', runAi);
    $('ai-scene-go').addEventListener('click', runScene);
  }

  function runBatch() {
    var ids = state.sel.slice();
    if (!ids.length) { toast('בחרו תמונות בספרייה כדי להחיל עליהן את הסגנון.'); return; }
    var st = FX.byId[state.labStyle], params = JSON.parse(JSON.stringify(labParams(state.labStyle)));
    state.batch = [];
    $('batch').hidden = false;
    $('batch-title').textContent = st.name + ' על ' + ids.length + ' תמונות';
    var grid = $('batch-grid');
    grid.textContent = '';
    var cells = ids.map(function (id) {
      var f = el('figure', 'bcell');
      f.appendChild(el('span', 'spin'));
      grid.appendChild(f);
      return f;
    });
    $('batch').scrollIntoView({ behavior: 'smooth', block: 'start' });
    (function next(i) {
      if (i >= ids.length) { toast('הסתיים: ' + ids.length + ' תמונות.'); return; }
      var m = imageById(ids[i]);
      /* כל תוצאה נשמרת כקובץ דחוס ולא כתמונה פתוחה בזיכרון */
      var preview;
      processOnce({ img: ids[i], style: st.id, params: params }, EN.LOW ? 1200 : 1600).promise.then(function (b) {
        var c = bitmapToCanvas(b);
        closeImg(b);
        preview = scaled(c, 360);
        return canvasToBlob(c, 'image/jpeg', 0.93).then(function (blob) { c.width = c.height = 1; return blob; });
      }).then(function (blob) {
        var item = { blob: blob, name: m.name + ' · ' + st.name, origin: m.id };
        state.batch.push(item);
        var f = cells[i];
        f.textContent = '';
        f.appendChild(preview);
        var cap = el('figcaption');
        var dl = el('button', 'btn ghost tiny', 'הורדה');
        dl.type = 'button';
        dl.addEventListener('click', function () { download(item.blob, safeName(item.name) + '.jpg'); });
        cap.appendChild(el('span', '', m.name));
        cap.appendChild(dl);
        f.appendChild(cap);
        next(i + 1);
      }).catch(function () { next(i + 1); });
    })(0);
  }

  /* ---------- AI ---------- */
  function renderAiChips() {
    var box = $('ai-chips');
    if (box.childElementCount) return;
    AI.STYLES.forEach(function (s) {
      var b = el('button', 'chip', s.name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.id === state.aiStyle));
      b.addEventListener('click', function () {
        state.aiStyle = s.id;
        box.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        saveMeta();
      });
      box.appendChild(b);
    });
  }

  function updateAiState() {
    var on = AI.ready();
    $('ai-dot').classList.toggle('on', on);
    $('ai-state').textContent = on
      ? 'מחובר. התמונה נשלחת ל-Google רק כשלוחצים, והתוצאה נשמרת בספרייה.'
      : 'דורש מפתח Gemini אישי (חינמי ב-Google AI Studio). לוחצים על ״מצב AI״ למעלה כדי לחבר.';
  }

  function aiBusy(btn, on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  }

  function addAiResult(blob, name, origin) {
    return decodeFile(blob).catch(function () { throw new Error('התמונה שהתקבלה פגומה.'); }).then(function (im) {
      return addImage(im, name, 'ai', origin).then(function (m) { closeImg(im); if (im.src) URL.revokeObjectURL(im.src); return m; });
    });
  }

  function runAi() {
    if (!AI.ready()) { openAiDialog(); return; }
    if (!state.labId) { toast('בחרו תמונה קודם.'); return; }
    var m = imageById(state.labId), st = AI.byId[state.aiStyle], btn = $('ai-go');
    aiBusy(btn, true);
    toast('Gemini מצייר את התמונה… זה לוקח בדרך כלל 10–30 שניות.', 60000);
    loadBitmap(state.labId, 1400).then(function (im) { var c = scaled(im, 1400); closeImg(im); return canvasToBlob(c, 'image/jpeg', 0.9); })
      .then(function (b) { return AI.generate([b], AI.stylePrompt(state.aiStyle, $('ai-extra').value.trim())); })
      .then(function (blob) { return addAiResult(blob, m.name + ' · ' + st.name, m.id); })
      .then(function (n) {
        if (state.sel.indexOf(n.id) < 0) state.sel.push(n.id);
        state.labId = n.id;
        state.labStyle = 'original';
        saveMeta();
        enterLab();
        toast('מוכן. הציור נשמר בספרייה ונבחר. אפשר להוסיף עליו סגנון או לשלוח לעמוד.', 5000);
      })
      .catch(function (e) { toast(e.message, 7000); })
      .then(function () { aiBusy(btn, false); });
  }

  function runScene() {
    if (!AI.ready()) { openAiDialog(); return; }
    var ids = state.sel.slice(0, 3);
    if (ids.length < 2) { toast('סמנו בספרייה 2 או 3 תמונות של האנשים שרוצים לשלב.'); return; }
    var btn = $('ai-scene-go');
    aiBusy(btn, true);
    toast('Gemini משלב ' + ids.length + ' תמונות לסצנה אחת…', 90000);
    Promise.all(ids.map(function (id) { return loadBitmap(id, 1100).then(function (im) { var c = scaled(im, 1100); closeImg(im); return canvasToBlob(c, 'image/jpeg', 0.88); }); }))
      .then(function (blobs) { return AI.generate(blobs, AI.scenePrompt(ids.length, $('ai-scene').value.trim(), state.aiStyle)); })
      .then(function (blob) { return addAiResult(blob, 'סצנה משולבת · ' + AI.byId[state.aiStyle].name, ids[0]); })
      .then(function (n) {
        state.sel.push(n.id);
        state.labId = n.id;
        state.labStyle = 'original';
        saveMeta();
        enterLab();
        toast('הסצנה המשולבת נשמרה בספרייה.', 5000);
      })
      .catch(function (e) { toast(e.message, 7000); })
      .then(function () { aiBusy(btn, false); });
  }

  function openAiDialog() {
    var s = AI.settings(), d = $('ai-dialog');
    $('ai-key').value = s.key || '';
    $('ai-model').value = s.model || AI.DEFAULT_MODEL;
    d.showModal();
  }

  function bindAiDialog() {
    $('ai-settings').addEventListener('click', openAiDialog);
    $('ai-dialog').addEventListener('close', function () {
      var v = $('ai-dialog').returnValue;
      if (v === 'save') {
        AI.save({ key: $('ai-key').value.trim(), model: $('ai-model').value.trim() || AI.DEFAULT_MODEL });
        toast(AI.ready() ? 'מצב AI מחובר.' : 'המפתח ריק, מצב AI כבוי.');
      } else if (v === 'clear') {
        AI.save({});
        toast('המפתח נמחק מהדפדפן.');
      }
      updateAiState();
    });
  }

  /* ---------- עמוד ---------- */
  var editor = null, saveTimer;

  function ensureProject() {
    if (!state.project) state.project = { id: 'current', name: 'הקומיקס שלי', pages: [PG.newPage('a4', 'story-6')] };
    if (state.pageIdx >= state.project.pages.length) state.pageIdx = 0;
    return state.project;
  }
  function curPage() { return ensureProject().pages[state.pageIdx]; }

  function saveProject() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (state.project) DB.put('projects', state.project); updateCounts(); }, 400);
  }

  function enterPage() {
    ensureProject();
    if (!editor) {
      editor = new PG.Editor($('page-canvas'), {
        getImage: function (ref, max) { return getProcessed(ref, Math.min(max, SZ.panel)); },
        onSelect: renderInspector,
        onChange: function () { saveProject(); renderPagesRow(); },
        onEditText: function () { setTimeout(function () { $('it-text').focus(); $('it-text').select(); }, 0); },
        onDropImage: function (id, panelIdx, pt) {
          var pg = curPage();
          if (panelIdx >= 0) {
            var pn = pg.panels[panelIdx];
            pn.img = id; pn.zoom = 1; pn.ox = 0; pn.oy = 0;
            if (!pn.style) pn.style = 'classic';
            editor.select({ kind: 'panel', idx: panelIdx });
          } else {
            var it = PG.newItem('photo', pg);
            it.img = id; it.x = pt[0] - it.w / 2; it.y = pt[1] - it.h / 2;
            pg.items.push(it);
            editor.select({ kind: 'item', idx: pg.items.length - 1 });
          }
          saveProject();
          editor.draw();
        },
        onDropFiles: function (files) {
          importFiles(files).then(function () { renderTray(); });
        }
      });
    }
    fillPageControls();
    renderLayouts();
    renderPagesRow();
    renderTray();
    editor.setPage(curPage());
  }

  function renderPagesRow() {
    var box = $('pages-row'), pr = ensureProject();
    box.textContent = '';
    pr.pages.forEach(function (pg, i) {
      var b = el('button', 'ptab', 'עמוד ' + (i + 1));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(i === state.pageIdx));
      b.addEventListener('click', function () { state.pageIdx = i; enterPage(); });
      box.appendChild(b);
    });
    var add = el('button', 'ptab add-page', '+ עמוד');
    add.type = 'button';
    add.title = 'עמוד חדש באותו גודל';
    add.addEventListener('click', function () {
      var cur = curPage();
      var pg = PG.newPage(cur.format, cur.layout);
      pg.title.show = false;
      pr.pages.push(pg);
      state.pageIdx = pr.pages.length - 1;
      saveProject(); enterPage();
    });
    box.appendChild(add);
    if (pr.pages.length > 1) {
      var del = el('button', 'ptab del-page', 'מחיקת עמוד');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!confirm('למחוק את עמוד ' + (state.pageIdx + 1) + '?')) return;
        pr.pages.splice(state.pageIdx, 1);
        state.pageIdx = Math.max(0, state.pageIdx - 1);
        saveProject(); enterPage();
      });
      box.appendChild(del);
    }
    updateCounts();
  }

  function renderLayouts() {
    var box = $('layouts');
    if (!box.childElementCount) {
      PG.LAYOUTS.forEach(function (L) {
        var b = el('button', 'lay');
        b.type = 'button';
        b.dataset.layout = L.id;
        b.title = L.name + ' · ' + L.count + ' פאנלים';
        b.setAttribute('aria-label', L.name + ', ' + L.count + ' פאנלים');
        b.appendChild(PG.layoutThumb(L.id, 44, 60));
        b.addEventListener('click', function () {
          PG.setLayout(curPage(), L.id);
          editor.select(null);
          editor.draw();
          saveProject();
          markLayout();
        });
        box.appendChild(b);
      });
    }
    markLayout();
  }
  function markLayout() {
    var cur = curPage().layout;
    $('layouts').querySelectorAll('.lay').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.layout === cur)); });
  }

  function fillSelect(sel, opts) {
    if (sel.childElementCount) return;
    opts.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; sel.appendChild(op); });
  }

  function fillPageControls() {
    var pg = curPage();
    fillSelect($('pg-format'), Object.keys(PG.FORMATS).map(function (k) { return [k, PG.FORMATS[k].name]; }));
    var fonts = PG.FONTS.map(function (f) { return [f.id, f.name]; });
    fillSelect($('pg-title-font'), fonts);
    fillSelect($('it-font'), fonts);
    fillSelect($('auto-style'), FX.STYLES.map(function (s) { return [s.id, s.name]; }));
    $('auto-style').value = $('auto-style').dataset.v || 'gouache';
    $('pg-format').value = pg.format;
    $('pg-title-show').checked = !!pg.title.show;
    $('pg-title').value = pg.title.text;
    $('pg-title-font').value = pg.title.font;
    $('pg-title-color').value = pg.title.color;
    $('pg-gutter').value = pg.gutter;
    $('pg-border').value = pg.border;
    $('pg-margin').value = pg.margin;
    $('pg-bg').value = pg.bg;
    $('pg-borderColor').value = pg.borderColor;
  }

  function bindPageControls() {
    function on(id, ev, fn) {
      $(id).addEventListener(ev, function () { fn($(id)); editor.draw(); saveProject(); });
    }
    on('pg-format', 'change', function (e) { PG.setFormat(curPage(), e.value); editor.setPage(curPage()); fillPageControls(); });
    on('pg-title-show', 'change', function (e) { curPage().title.show = e.checked; });
    on('pg-title', 'input', function (e) { curPage().title.text = e.value; });
    on('pg-title-font', 'change', function (e) { curPage().title.font = e.value; });
    on('pg-title-color', 'input', function (e) { curPage().title.color = e.value; });
    on('pg-gutter', 'input', function (e) { curPage().gutter = Number(e.value); });
    on('pg-border', 'input', function (e) { curPage().border = Number(e.value); });
    on('pg-margin', 'input', function (e) { curPage().margin = Number(e.value); });
    on('pg-bg', 'input', function (e) { curPage().bg = e.value; });
    on('pg-borderColor', 'input', function (e) { curPage().borderColor = e.value; });
    $('auto-style').addEventListener('change', function () { $('auto-style').dataset.v = $('auto-style').value; });
    $('auto-go').addEventListener('click', autoBuild);

    document.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pg = curPage(), it = PG.newItem(b.dataset.add, pg);
        if (it.type === 'photo') {
          var pick = state.sel[0] || (state.images[0] && state.images[0].id);
          if (pick) it.img = pick;
        }
        pg.items.push(it);
        editor.select({ kind: 'item', idx: pg.items.length - 1 });
        saveProject();
        if (it.type !== 'photo') setTimeout(function () { $('it-text').focus(); $('it-text').select(); }, 0);
      });
    });

    $('exp-png').addEventListener('click', function () { exportPage('png'); });
    $('exp-jpg').addEventListener('click', function () { exportPage('jpg'); });
    $('exp-pdf').addEventListener('click', exportPdf);

    $('page-canvas').addEventListener('keydown', function (e) {
      if (!editor.sel || editor.sel.kind !== 'item') return;
      var pg = curPage(), it = pg.items[editor.sel.idx];
      if (!it) return;
      var step = e.shiftKey ? 20 : 4;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); dupItem(); return; }
      var dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      it.x += dx; it.y += dy; it.tx += dx; it.ty += dy;
      editor.draw(); saveProject();
    });
  }

  function renderTray() {
    var box = $('tray');
    box.textContent = '';
    var ids = labOrder();
    if (!ids.length) { box.appendChild(el('p', 'muted small', 'אין עדיין תמונות. מעלים בספרייה, או גוררים קבצים ישר לעמוד.')); return; }
    ids.forEach(function (id) {
      var m = imageById(id);
      var b = el('button', 'tthumb');
      b.type = 'button';
      b.draggable = true;
      b.setAttribute('aria-label', 'הכנסת ' + m.name + ' לפאנל הנבחר');
      var im = el('img'); im.src = m.thumb; im.alt = ''; im.draggable = false; im.loading = 'lazy';
      b.appendChild(im);
      var si = state.sel.indexOf(id);
      if (si >= 0) b.appendChild(el('span', 'num', String(si + 1)));
      b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/comic-image', id); e.dataTransfer.effectAllowed = 'copy'; });
      b.addEventListener('click', function () { placeInPage({ img: id }); });
      box.appendChild(b);
    });
  }

  /* מכניס תמונה לפאנל הנבחר, לתמונה הצפה הנבחרת, או לפאנל הריק הראשון */
  function placeInPage(ref) {
    var pg = curPage(), sel = editor ? editor.sel : null, idx = -1;
    if (sel && sel.kind === 'item' && pg.items[sel.idx] && pg.items[sel.idx].type === 'photo') {
      var it = pg.items[sel.idx];
      it.img = ref.img;
      if (ref.style) { it.style = ref.style; it.params = ref.params || {}; }
      saveProject(); editor.draw(); renderInspector(sel);
      return;
    }
    if (sel && sel.kind === 'panel') idx = sel.idx;
    else {
      var n = (PG.layoutById[pg.layout] || PG.LAYOUTS[0]).count;
      for (var i = 0; i < n; i++) if (!pg.panels[i].img) { idx = i; break; }
      if (idx < 0) idx = 0;
    }
    var pn = pg.panels[idx];
    pn.img = ref.img; pn.zoom = 1; pn.ox = 0; pn.oy = 0;
    if (ref.style) { pn.style = ref.style; pn.params = ref.params || {}; }
    saveProject();
    if (editor) { editor.select({ kind: 'panel', idx: idx }); }
  }

  function stylePicker(box, current, onPick) {
    box.textContent = '';
    FX.STYLES.forEach(function (s) {
      var b = el('button', 'mini', s.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(s.id === current));
      b.addEventListener('click', function () {
        box.querySelectorAll('.mini').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onPick(s.id);
      });
      box.appendChild(b);
    });
  }

  var inspTimer;
  function renderInspector(sel) {
    var pg = curPage();
    var kind = sel ? sel.kind : null;
    $('insp-none').hidden = !!kind;
    $('insp-panel').hidden = kind !== 'panel';
    $('insp-item').hidden = kind !== 'item';
    if (kind === 'panel') {
      var pn = pg.panels[sel.idx];
      $('insp-panel-title').textContent = 'פאנל ' + (sel.idx + 1) + (pn.img ? '' : ' · ריק');
      stylePicker($('insp-styles'), pn.style, function (id) {
        pn.style = id; pn.params = {};
        renderInspector(sel); editor.draw(); saveProject();
      });
      pn.params = pn.params || {};
      renderKnobs($('insp-knobs'), pn.style, pn.params, function () {
        clearTimeout(inspTimer);
        inspTimer = setTimeout(function () { editor.draw(); saveProject(); }, 200);
      }, true);
      $('insp-zoom').value = pn.zoom || 1;
      $('insp-bg').value = pn.bg || '#ffffff';
    } else if (kind === 'item') {
      var it = pg.items[sel.idx];
      if (!it) return;
      var T = PG.ITEM_TYPES[it.type];
      $('insp-item-title').textContent = T.name;
      var isPhoto = it.type === 'photo', isSfx = it.type === 'sfx';
      $('f-text').hidden = isPhoto; $('f-font').hidden = isPhoto; $('f-size').hidden = isPhoto || isSfx;
      $('f-colors').hidden = isPhoto; $('f-rot').hidden = !isSfx; $('f-fill2').hidden = !isSfx;
      $('f-photo').hidden = !isPhoto;
      $('l-fill').textContent = isSfx ? 'צבע עליון' : 'רקע';
      $('it-text').value = it.text;
      $('it-font').value = it.font;
      $('it-size').value = it.size;
      $('it-fill').value = it.fill;
      $('it-color').value = it.color;
      $('it-stroke').value = it.stroke;
      $('it-fill2').value = it.fill2 || '#ff3d2e';
      $('it-rot').value = it.rot || 0;
      $('it-zoom').value = it.zoom || 1;
      document.querySelectorAll('[data-shape]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.shape === it.shape)); });
      if (isPhoto) stylePicker($('it-styles'), it.style, function (id) { it.style = id; it.params = {}; editor.draw(); saveProject(); });
    }
  }

  function curItem() { var s = editor.sel; return s && s.kind === 'item' ? curPage().items[s.idx] : null; }
  function curPanel() { var s = editor.sel; return s && s.kind === 'panel' ? curPage().panels[s.idx] : null; }

  function removeItem() {
    var s = editor.sel;
    if (!s || s.kind !== 'item') return;
    curPage().items.splice(s.idx, 1);
    editor.select(null); saveProject();
  }
  function dupItem() {
    var it = curItem();
    if (!it) return;
    var c = JSON.parse(JSON.stringify(it));
    c.id = uid('it'); c.x += 30; c.y += 30; c.tx += 30; c.ty += 30;
    curPage().items.push(c);
    editor.select({ kind: 'item', idx: curPage().items.length - 1 });
    saveProject();
  }

  function bindInspector() {
    function onI(id, ev, fn) {
      $(id).addEventListener(ev, function () { var it = curItem(); if (!it) return; fn(it, $(id)); editor.draw(); saveProject(); });
    }
    onI('it-text', 'input', function (it, e) { it.text = e.value; });
    onI('it-font', 'change', function (it, e) { it.font = e.value; });
    onI('it-size', 'input', function (it, e) { it.size = Number(e.value); });
    onI('it-fill', 'input', function (it, e) { it.fill = e.value; });
    onI('it-color', 'input', function (it, e) { it.color = e.value; });
    onI('it-stroke', 'input', function (it, e) { it.stroke = e.value; });
    onI('it-fill2', 'input', function (it, e) { it.fill2 = e.value; });
    onI('it-rot', 'input', function (it, e) { it.rot = Number(e.value); });
    onI('it-zoom', 'input', function (it, e) { it.zoom = Number(e.value); });
    document.querySelectorAll('[data-shape]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = curItem(); if (!it) return;
        it.shape = b.dataset.shape;
        document.querySelectorAll('[data-shape]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        editor.draw(); saveProject();
      });
    });
    $('it-del').addEventListener('click', removeItem);
    $('it-dup').addEventListener('click', dupItem);
    $('it-up').addEventListener('click', function () {
      var s = editor.sel, items = curPage().items;
      if (!s || s.idx >= items.length - 1) return;
      items.splice(s.idx + 1, 0, items.splice(s.idx, 1)[0]);
      editor.select({ kind: 'item', idx: s.idx + 1 }); saveProject();
    });
    $('it-down').addEventListener('click', function () {
      var s = editor.sel, items = curPage().items;
      if (!s || s.idx <= 0) return;
      items.splice(s.idx - 1, 0, items.splice(s.idx, 1)[0]);
      editor.select({ kind: 'item', idx: s.idx - 1 }); saveProject();
    });
    $('insp-zoom').addEventListener('input', function () { var pn = curPanel(); if (!pn) return; pn.zoom = Number($('insp-zoom').value); editor.draw(); saveProject(); });
    $('insp-bg').addEventListener('input', function () { var pn = curPanel(); if (!pn) return; pn.bg = $('insp-bg').value; editor.draw(); saveProject(); });
    $('insp-center').addEventListener('click', function () { var pn = curPanel(); if (!pn) return; pn.ox = 0; pn.oy = 0; pn.zoom = 1; renderInspector(editor.sel); editor.draw(); saveProject(); });
    $('insp-clear').addEventListener('click', function () { var pn = curPanel(); if (!pn) return; pn.img = null; renderInspector(editor.sel); editor.draw(); saveProject(); });
    $('insp-style-all').addEventListener('click', function () {
      var pn = curPanel(); if (!pn) return;
      curPage().panels.forEach(function (p) { p.style = pn.style; p.params = JSON.parse(JSON.stringify(pn.params || {})); });
      editor.draw(); saveProject();
      toast('הסגנון הוחל על כל הפאנלים בעמוד.');
    });
  }

  /* הרכבה אוטומטית: עמוד לכל קבוצה של עד 6 תמונות */
  var AUTO_LAYOUT = { 1: 'one', 2: 'two-rows', 3: 'hero-top', 4: 'grid-4', 5: 'manga-5', 6: 'grid-6' };
  function autoBuild() {
    var ids = state.sel.length ? state.sel.slice() : state.images.slice(0, 6).map(function (m) { return m.id; });
    if (!ids.length) { toast('מעלים ובוחרים תמונות בספרייה, ואז מרכיבים.'); return; }
    var style = $('auto-style').value || 'classic';
    var pr = ensureProject(), format = curPage().format, pages = [];
    /* קבוצות של עד 6, בלי עמוד אחרון עם תמונה בודדת */
    var sizes = [], left = ids.length;
    while (left > 0) {
      var n = left <= 6 ? left : left === 7 ? 4 : 6;
      sizes.push(n); left -= n;
    }
    var at = 0;
    sizes.forEach(function (n, k) {
      var chunk = ids.slice(at, at + n);
      at += n;
      var pg = PG.newPage(format, AUTO_LAYOUT[n]);
      pg.title.show = k === 0;
      chunk.forEach(function (id, j) { pg.panels[j].img = id; pg.panels[j].style = style; });
      pages.push(pg);
    });
    var first = pages[0], cap = PG.newItem('caption', first), polys = PG.computePanels(first), b = PG.bbox(polys[0]);
    cap.x = b.x + b.w - cap.w - first.w * 0.015; cap.y = b.y + first.w * 0.015;
    cap.text = 'יום אחד, הכול התחיל ככה...';
    first.items.push(cap);
    if (polys[1]) {
      var sp = PG.newItem('speech', first), b2 = PG.bbox(polys[1]);
      sp.x = b2.x + first.w * 0.02; sp.y = b2.y + first.w * 0.02; sp.w = Math.min(sp.w, b2.w * 0.6); sp.h = sp.w * 0.58;
      sp.tx = sp.x + sp.w * 0.7; sp.ty = sp.y + sp.h * 1.5;
      sp.text = 'זה הולך להיות מעולה!';
      first.items.push(sp);
    }
    if (pr.pages.length === 1 && !pr.pages[0].panels.some(function (p) { return p.img; }) && !pr.pages[0].items.length) pr.pages = pages;
    else pr.pages = pr.pages.concat(pages);
    state.pageIdx = pr.pages.indexOf(first);
    saveProject();
    if (state.view === 'page') enterPage(); else show('page');
    toast('נוצרו ' + pages.length + (pages.length === 1 ? ' עמוד' : ' עמודים') + ' בסגנון ' + FX.byId[style].name + '. הציור לוקח כמה שניות.', 5000);
  }

  /* ---------- הנפשה ---------- */
  var motionPlayer = null, motionFx = null, videoPlayer = null, motionTimer = 0;

  function renderMotionChips() {
    var box = $('motion-chips');
    if (box.childElementCount) return;
    MO.EFFECTS.forEach(function (e) {
      var b = el('button', 'chip', e.name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.motion = e.id;
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () { startMotion(e.id); });
      box.appendChild(b);
    });
  }

  function startMotion(id) {
    var out = $('stage-out');
    if (!state.labId || !out.width || out.width < 4) { toast('בוחרים תמונה וסגנון, ואז אפקט הנפשה.'); return; }
    motionFx = id;
    document.querySelectorAll('[data-motion]').forEach(function (x) { x.setAttribute('aria-checked', String(x.dataset.motion === id)); });
    $('motion-desc').textContent = MO.byId[id].desc;
    $('motion-state').textContent = 'מכין את ההנפשה…';
    var art = document.createElement('canvas');
    art.width = out.width; art.height = out.height;
    art.getContext('2d').drawImage(out, 0, 0);
    if (motionPlayer) motionPlayer.stop();
    loadBitmap(state.labId, SZ.motion).then(function (photo) {
      setTimeout(function () {
        if (motionFx !== id) { closeImg(photo); return; }
        var scene;
        try {
          scene = MO.setup(id, { art: art, photo: photo }, MO.videoSize(art.width, art.height, SZ.motion));
        } catch (e) {
          closeImg(photo);
          $('motion-state').textContent = 'לא הצלחתי להכין את ההנפשה. נסו אפקט אחר.';
          return;
        }
        closeImg(photo);
        if (!motionPlayer) { motionPlayer = new MO.Player($('motion-canvas')); motionPlayer.autoPause(); }
        motionPlayer.load(scene);
        $('motion-empty').hidden = true;
        $('motion-rec').disabled = false;
        $('motion-stop').disabled = false;
        $('motion-state').textContent = 'לולאה של ' + scene.dur + ' שניות.';
      }, 30);
    }).catch(function (e) { $('motion-state').textContent = e.message; });
  }

  function stopMotion() {
    if (motionPlayer) motionPlayer.stop();
    if (videoPlayer) videoPlayer.stop();
  }

  function recordWith(player, stateEl, name, btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    stateEl.textContent = 'מקליט… 0%';
    return player.record(1, function (f) { stateEl.textContent = 'מקליט… ' + Math.round(f * 100) + '%'; })
      .then(function (r) {
        download(r.blob, safeName(name) + '.' + r.ext);
        stateEl.textContent = 'נשמר כקובץ ' + r.ext.toUpperCase() + '.';
        toast('הווידאו ירד למחשב.');
      })
      .catch(function (e) { stateEl.textContent = e.message; toast(e.message, 6000); })
      .then(function () { btn.disabled = false; btn.classList.remove('loading'); });
  }

  var VIDEO_SIZES = { story: [1080, 1920], post: [1080, 1350], wide: [1920, 1080] };

  /* ---------- סרט קומיקס ---------- */
  var movie = { key: '', data: null, look: 'blockbuster', busy: false };
  try { movie.look = localStorage.getItem('comic-movie-look') || movie.look; } catch (e) { /* פרטי */ }

  function movieLooks() {
    var box = $('movie-looks');
    if (box.childElementCount) return;
    window.ComicCinema.LOOKS.forEach(function (l) {
      var b = el('button', 'look');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.look = l.id;
      b.appendChild(el('b', '', l.name));
      b.appendChild(el('span', 'muted small', l.desc));
      b.addEventListener('click', function () {
        movie.look = l.id;
        try { localStorage.setItem('comic-movie-look', l.id); } catch (e) { /* פרטי */ }
        buildMovie();
      });
      box.appendChild(b);
    });
    var mu = $('movie-music');
    window.ComicCinema.MUSIC.forEach(function (m) { var o = el('option', '', m.name); o.value = m.id; mu.appendChild(o); });
  }

  function openPageVideo() {
    movieLooks();
    if (!$('video-dialog').open) $('video-dialog').showModal();
    prepareMovie();
  }

  /* הכנת החומרים פעם אחת לכל תוכן; החלפת סגנון, פורמט או מוזיקה רק בונה מחדש את הסרט */
  function prepareMovie() {
    var pr = ensureProject();
    var pages = $('movie-scope').value === 'page' ? [curPage()] : pr.pages;
    var key = JSON.stringify(pages.map(function (pg) { return [pg.id, pg.layout, pg.w, pg.title, pg.panels.map(function (p) { return [p.img, p.style, p.zoom, p.ox, p.oy]; }), pg.items]; }));
    if (movie.key === key && movie.data) { buildMovie(); return; }
    if (movie.busy) return;
    movie.busy = true;
    if (videoPlayer) videoPlayer.stop();
    $('video-rec').disabled = $('movie-play').disabled = true;
    $('video-state').textContent = 'מכין את הסרט…';
    document.fonts.ready.then(function () {
      return window.ComicCinema.prepare(pages, renderPageCanvas, {
        scale: EN.LOW ? 1.25 : 1.6, fullMax: EN.LOW ? 1100 : 1500,
        onProgress: function (f) { $('video-state').textContent = 'מכין את הסרט… ' + Math.round(f * 100) + '%'; }
      });
    }).then(function (data) {
      movie.data = data; movie.key = key;
      if (!data.pages.some(function (p) { return p.shots.length; })) throw new Error('אין עדיין ציורים בעמודים. הוסיפו תמונות לפאנלים, או ציירו ספר ב"יצירת קומיקס".');
      buildMovie();
    }).catch(function (e) {
      $('video-state').textContent = 'לא הצלחתי להכין סרט: ' + e.message;
    }).then(function () { movie.busy = false; });
  }

  function buildMovie() {
    if (!movie.data) return;
    document.querySelectorAll('#movie-looks .look').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.look === movie.look)); });
    var size = MO.videoSize(VIDEO_SIZES[$('video-fmt').value][0], VIDEO_SIZES[$('video-fmt').value][1], EN.LOW ? 720 : 1080);
    var scene = window.ComicCinema.build(movie.data, { look: movie.look, size: size, music: $('movie-music').value });
    if (!videoPlayer) { videoPlayer = new MO.Player($('video-canvas')); videoPlayer.autoPause(); }
    videoPlayer.stop();
    videoPlayer.load(scene);
    $('video-rec').disabled = $('movie-play').disabled = false;
    $('video-state').textContent = scene.shots + ' שוטים · ' + Math.round(scene.dur) + ' שניות · ' + scene.look.name;
  }

  function bindMotion() {
    $('motion-stop').addEventListener('click', function () {
      if (motionPlayer) motionPlayer.stop();
      motionFx = null;
      document.querySelectorAll('[data-motion]').forEach(function (x) { x.setAttribute('aria-checked', 'false'); });
      $('motion-state').textContent = 'ההנפשה נעצרה.';
      $('motion-rec').disabled = true;
      $('motion-stop').disabled = true;
    });
    $('motion-rec').addEventListener('click', function () {
      if (!motionPlayer || !motionFx) return;
      var m = imageById(state.labId);
      recordWith(motionPlayer, $('motion-state'), m.name + ' - ' + MO.byId[motionFx].name, $('motion-rec'));
    });
    $('exp-video').addEventListener('click', openPageVideo);
    $('video-fmt').addEventListener('change', buildMovie);
    $('movie-music').addEventListener('change', buildMovie);
    $('movie-scope').addEventListener('change', prepareMovie);
    $('movie-play').addEventListener('click', function () { if (videoPlayer && videoPlayer.scene) videoPlayer.playWithSound(); });
    $('video-rec').addEventListener('click', function () {
      if (!videoPlayer || !videoPlayer.scene) return;
      recordWith(videoPlayer, $('video-state'), ((movie.data && movie.data.title) || curPage().title.text || 'comic') + ' - סרט קומיקס', $('video-rec'));
    });
    $('video-dialog').addEventListener('close', function () { if (videoPlayer) videoPlayer.stop(); });
  }

  /* ---------- ייצוא ---------- */
  /* כל פאנל מצויר בגודל שבו הוא באמת מופיע בעמוד, ולא יותר. התוצאות נסגרות מיד אחרי הציור */
  function renderPageCanvas(pg, scale, itemFilter) {
    var polys = PG.computePanels(pg), refs = [];
    polys.forEach(function (poly, i) {
      var pn = pg.panels[i];
      if (!pn || !pn.img || !imageById(pn.img)) return;
      var b = PG.bbox(poly);
      refs.push({ ref: pn, need: Math.max(b.w, b.h) * scale * (pn.zoom || 1) * 1.15 });
    });
    pg.items.forEach(function (it) {
      if (it.type === 'photo' && it.img && imageById(it.img)) refs.push({ ref: it, need: Math.max(it.w, it.h) * scale * (it.zoom || 1) * 1.15 });
    });
    var local = new Map(), list = [];
    /* אחד אחרי השני, כדי שלא יהיו כמה תמונות גדולות בזיכרון בבת אחת בזמן העיבוד */
    return refs.reduce(function (p, r) {
      return p.then(function () {
        var max = Math.max(256, Math.min(EXPORT_MAX, Math.ceil(r.need)));
        return processOnce(r.ref, max).promise.then(function (b) { local.set(r.ref, b); list.push(b); });
      });
    }, Promise.resolve()).then(function () {
      var c = document.createElement('canvas');
      c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
      var x = c.getContext('2d');
      x.scale(scale, scale);
      PG.drawPage(x, pg, { getImage: function (r) { return local.get(r) || null; }, itemFilter: itemFilter });
      list.forEach(closeImg);
      return c;
    }, function (e) { list.forEach(closeImg); throw e; });
  }

  function exportPage(kind) {
    var pg = curPage();
    toast('מכין קובץ בגודל מלא…', 60000);
    document.fonts.ready.then(function () { return renderPageCanvas(pg, SZ.pageScale); }).then(function (c) {
      return canvasToBlob(c, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.93);
    }).then(function (b) {
      download(b, safeName((pg.title.text || 'comic') + ' - עמוד ' + (state.pageIdx + 1)) + '.' + kind);
      toast('ההורדה התחילה.');
    }).catch(function (e) { toast('הייצוא נכשל: ' + e.message, 6000); });
  }

  function exportPdf() {
    var pr = ensureProject();
    toast('מכין PDF של ' + pr.pages.length + ' עמודים…', 120000);
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(function () {
      return document.fonts.ready;
    }).then(function () {
      var JsPDF = window.jspdf.jsPDF, doc = null;
      return pr.pages.reduce(function (p, pg, i) {
        return p.then(function () { return renderPageCanvas(pg, EN.LOW ? 1.3 : 1.6); }).then(function (c) {
          /* דחיסה ברקע (toBlob) ולא toDataURL שחוסם את המסך */
          return canvasToBlob(c, 'image/jpeg', 0.9).then(function (blob) {
            c.width = c.height = 1;
            return blob.arrayBuffer();
          }).then(function (buf) {
            var orient = pg.w > pg.h ? 'l' : 'p', size = [pg.w * 0.75, pg.h * 0.75];
            if (!doc) doc = new JsPDF({ orientation: orient, unit: 'pt', format: size });
            else doc.addPage(size, orient);
            doc.addImage(new Uint8Array(buf), 'JPEG', 0, 0, size[0], size[1]);
            toast('עמוד ' + (i + 1) + ' מתוך ' + pr.pages.length + '…', 120000);
          });
        });
      }, Promise.resolve()).then(function () { return doc.output('blob'); });
    }).then(function (b) {
      download(b, safeName(curPage().title.text || 'comic') + '.pdf');
      toast('ה-PDF מוכן.');
    }).catch(function (e) { toast('לא הצלחתי ליצור PDF: ' + (e && e.message ? e.message : 'בדקו את החיבור לאינטרנט'), 6000); });
  }

  var scripts = {};
  function loadScript(src) {
    if (scripts[src]) return scripts[src];
    scripts[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { delete scripts[src]; reject(new Error('טעינה נכשלה')); };
      document.head.appendChild(s);
    });
    return scripts[src];
  }

  /* תמונה מהספרייה לעמוד הקומיקס. עמוד קומיקס שלם (מה-AI) נכנס כעמוד חדש בפאנל אחד, בלי מסגרת,
     כדי שאפשר יהיה להוסיף עליו בועות ולייצא */
  function openInPage(imgId, fullPage) {
    ensureProject();
    var m = imageById(imgId);
    if (fullPage && m) {
      var fmt = m.w > m.h * 1.15 ? 'landscape' : Math.abs(m.w - m.h) < m.w * 0.1 ? 'square' : 'a4';
      var pg = PG.newPage(fmt, 'one');
      pg.title.show = false; pg.margin = 0; pg.gutter = 0; pg.border = 0;
      pg.panels[0].img = imgId; pg.panels[0].style = 'original'; pg.panels[0].params = { sat: 100, contrast: 0 };
      var pr = state.project;
      if (pr.pages.length === 1 && !pr.pages[0].panels.some(function (p) { return p.img; }) && !pr.pages[0].items.length) pr.pages = [pg];
      else pr.pages.push(pg);
      state.pageIdx = pr.pages.indexOf(pg);
      saveProject();
      show('page');
      return;
    }
    show('page');
    placeInPage({ img: imgId, style: 'original', params: { sat: 100, contrast: 0 } });
  }

  window.ComicApp = {
    state: state, imageById: imageById, loadBitmap: loadBitmap, scaled: scaled, closeImg: closeImg,
    canvasToBlob: canvasToBlob, addAiResult: addAiResult, toast: toast, show: show, download: download,
    safeName: safeName, saveMeta: saveMeta, renderLibrary: renderLibrary, el: el, openInPage: openInPage,
    openMovie: openPageVideo,
    addPages: function (pages) {
      var pr = ensureProject();
      if (pr.pages.length === 1 && !pr.pages[0].panels.some(function (p) { return p.img; }) && !pr.pages[0].items.length) pr.pages = [];
      pages.forEach(function (pg) { pr.pages.push(pg); });
      state.pageIdx = pr.pages.indexOf(pages[0]);
      saveProject();
      show('page');
    },
    addPage: function (pg) {
      var pr = ensureProject();
      if (pr.pages.length === 1 && !pr.pages[0].panels.some(function (p) { return p.img; }) && !pr.pages[0].items.length) pr.pages = [pg];
      else pr.pages.push(pg);
      state.pageIdx = pr.pages.indexOf(pg);
      saveProject();
      show('page');
    }
  };

  /* ---------- התחלה ---------- */
  /* שגיאה לא צפויה לא מפילה את הדף: מציגים הודעה וממשיכים */
  var lastErr = 0;
  function guard(msg) {
    if (Date.now() - lastErr < 4000) return;
    lastErr = Date.now();
    toast(msg || 'משהו השתבש, אבל העבודה שלכם שמורה. אפשר להמשיך.', 5000);
  }
  window.addEventListener('error', function (e) {
    if (e && e.message && /ResizeObserver/.test(e.message)) return;
    console.error(e.error || e.message);
    guard();
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    if (r && r.canceled) { e.preventDefault(); return; }
    console.error(r);
    e.preventDefault();
    guard(r && hebrew(r.message) ? r.message : null);
  });

  /* מחוון עבודה ברקע בסרגל העליון */
  EN.onActivity(function (n) {
    var j = $('jobs');
    if (!j) return;
    j.hidden = n === 0;
    $('jobs-text').textContent = n === 1 ? 'מצייר ברקע' : 'מצייר ברקע · ' + n;
  });

  function boot() {
    if (EN.LOW) document.documentElement.classList.add('low');
    /* בטלפון: סגנונות ה-AI שרצים בתוך המכשיר (מודלים של 10MB) כבדים מדי ותוקעים אותו.
       במקומם יש את מסך "יצירת קומיקס", שמצייר בשרת */
    if (EN.LOW) for (var si = FX.STYLES.length - 1; si >= 0; si--) if (NN.isNeural(FX.STYLES[si].id)) FX.STYLES.splice(si, 1);
    document.querySelectorAll('[role="tab"]').forEach(function (t) {
      t.addEventListener('click', function () { show(t.dataset.view); });
      t.addEventListener('keydown', function (e) {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
        var i = tabs.indexOf(t);
        if (e.key === 'ArrowLeft') { tabs[(i + 1) % tabs.length].focus(); tabs[(i + 1) % tabs.length].click(); }
        if (e.key === 'ArrowRight') { tabs[(i + tabs.length - 1) % tabs.length].focus(); tabs[(i + tabs.length - 1) % tabs.length].click(); }
      });
    });
    bindLibrary();
    bindLab();
    bindAiDialog();
    bindPageControls();
    bindInspector();
    bindMotion();
    updateAiState();

    /* מבקשים מהדפדפן לא למחוק את הספרייה כשנגמר מקום */
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    NN.checkDownloaded();

    Promise.all([DB.all('images'), DB.get('meta', 'state'), DB.get('projects', 'current')]).then(function (r) {
      state.images = (r[0] || []).sort(function (a, b) { return a.added - b.added; });
      var meta = r[1] || {};
      state.sel = (meta.sel || []).filter(function (id) { return imageById(id); });
      if (meta.labStyle && FX.byId[meta.labStyle]) state.labStyle = meta.labStyle;
      /* בטלפון לא מפעילים מודל AI אוטומטית בכניסה למעבדה */
      if (EN.LOW && NN.isNeural(state.labStyle)) state.labStyle = 'gouache';
      state.labParams = meta.labParams || {};
      if (meta.aiStyle && AI.byId[meta.aiStyle]) state.aiStyle = meta.aiStyle;
      if (r[2] && r[2].pages && r[2].pages.length) state.project = r[2];
      ensureProject();
      renderLibrary();
      /* הגופנים נטענים מרחוק; מציירים שוב כשהם מוכנים */
      document.fonts.ready.then(function () { if (editor) editor.draw(); });
      ['Karantina', 'Playpen Sans Hebrew', 'Secular One', 'Rubik'].forEach(function (f) { document.fonts.load('700 40px "' + f + '"').catch(function () {}); });
    });
  }

  boot();
})();
