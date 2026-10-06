/* פאנל: ספרייה, מעבדת סגנונות ועמוד קומיקס. */
(function () {
  'use strict';

  var FX = window.ComicFX, PG = window.ComicPage, AI = window.ComicAI, DB = window.ComicStore;
  var MAX_IMAGES = 100;
  var STORE_MAX = 2000;     /* הצד הארוך של צילום שנשמר */
  var EXPORT_MAX = 2000;    /* רזולוציית העיבוד בייצוא */

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uid(p) { return (p || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var state = {
    images: [],          /* {id, name, w, h, thumb, blob, kind, added} */
    sel: [],             /* מזהים נבחרים לפי סדר הבחירה */
    filter: 'all',
    view: 'library',
    labId: null,
    labStyle: 'classic',
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
  var imgCache = new Map();
  function imageById(id) { return state.images.find(function (i) { return i.id === id; }); }

  function loadImg(id) {
    if (imgCache.has(id)) return imgCache.get(id);
    var meta = imageById(id);
    if (!meta) return Promise.reject(new Error('התמונה לא נמצאה'));
    var p = new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('לא הצלחתי לפתוח את התמונה')); };
      im.src = URL.createObjectURL(meta.blob);
    });
    imgCache.set(id, p);
    return p;
  }

  function canvasToBlob(c, type, q) {
    return new Promise(function (resolve) { c.toBlob(resolve, type || 'image/png', q); });
  }

  function decodeFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ': הדפדפן לא מצליח לפתוח את הקובץ')); };
      im.src = url;
    });
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

  /* מוסיף תמונה לספרייה ממקור canvas או תמונה */
  function addImage(src, name, kind, origin) {
    if (state.images.length >= MAX_IMAGES) return Promise.reject(new Error('הספרייה מלאה: 100 תמונות. מחקו כמה כדי להוסיף.'));
    var c = scaled(src, STORE_MAX);
    return canvasToBlob(c, 'image/jpeg', 0.92).then(function (blob) {
      var meta = { id: uid('im'), name: name, w: c.width, h: c.height, thumb: thumbOf(c), blob: blob, kind: kind || 'photo', origin: origin || null, added: Date.now() };
      state.images.push(meta);
      return DB.put('images', meta).then(function () { return meta; });
    });
  }

  function importFiles(list) {
    var files = Array.prototype.filter.call(list, function (f) { return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name); });
    if (!files.length) { toast('לא נמצאו קבצי תמונה.'); return Promise.resolve([]); }
    var room = MAX_IMAGES - state.images.length;
    if (room <= 0) { toast('הספרייה מלאה: 100 תמונות. מחקו כמה כדי להוסיף.'); return Promise.resolve([]); }
    var skipped = Math.max(0, files.length - room);
    files = files.slice(0, room);
    var added = [], i = 0, errors = 0;
    function next() {
      if (i >= files.length) return Promise.resolve();
      var f = files[i++];
      toast('מוסיף ' + i + ' מתוך ' + files.length + '…', 60000);
      return decodeFile(f).then(function (im) {
        return addImage(im, f.name.replace(/\.[^.]+$/, ''), 'photo').then(function (m) { URL.revokeObjectURL(im.src); added.push(m); });
      }).catch(function () { errors++; }).then(next);
    }
    return next().then(function () {
      if (!state.sel.length) added.slice(0, 9).forEach(function (m) { state.sel.push(m.id); });
      saveMeta();
      renderLibrary();
      var msg = 'נוספו ' + added.length + ' תמונות.';
      if (skipped) msg += ' ' + skipped + ' לא נכנסו כי הגעתם ל-100.';
      if (errors) msg += ' ' + errors + ' קבצים לא נפתחו (נסו להמיר ל-JPG).';
      toast(msg, 5000);
      return added;
    });
  }

  function deleteImages(ids) {
    ids.forEach(function (id) {
      state.images = state.images.filter(function (m) { return m.id !== id; });
      state.sel = state.sel.filter(function (s) { return s !== id; });
      var p = imgCache.get(id);
      if (p) p.then(function (im) { URL.revokeObjectURL(im.src); }).catch(function () {});
      imgCache.delete(id);
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

  /* ---------- עיבוד עם מטמון ---------- */
  var fxCache = new Map(), fxPending = new Map(), queue = Promise.resolve();

  function refKey(ref, max) { return ref.img + '|' + ref.style + '|' + JSON.stringify(ref.params || {}) + '|' + max; }

  function processNow(ref, max) {
    var key = refKey(ref, max);
    if (fxCache.has(key)) return Promise.resolve(fxCache.get(key));
    if (fxPending.has(key)) return fxPending.get(key);
    var p = queue = queue.catch(function () {}).then(function () {
      return loadImg(ref.img).then(function (im) { return FX.renderAsync(im, ref.style || 'original', ref.params, max); });
    }).then(function (c) {
      fxCache.set(key, c);
      fxPending.delete(key);
      if (fxCache.size > 48) fxCache.delete(fxCache.keys().next().value);
      return c;
    }, function (e) { fxPending.delete(key); throw e; });
    fxPending.set(key, p);
    return p;
  }

  /* לציור חי: מחזיר מיד מה שיש, ומבקש ציור מחדש כשמוכן */
  function getProcessed(ref, max) {
    var key = refKey(ref, max);
    if (fxCache.has(key)) return fxCache.get(key);
    if (!imageById(ref.img)) return null;
    if (!fxPending.has(key)) processNow(ref, max).then(function () { editor && editor.draw(); }).catch(function () {});
    return null;
  }

  /* ---------- ניווט ---------- */
  function show(view) {
    state.view = view;
    ['library', 'lab', 'page'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
      $('tab-' + v).setAttribute('aria-selected', String(v === view));
    });
    if (view === 'lab') enterLab();
    if (view === 'page') enterPage();
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
    renderLibrary();
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
        f.appendChild(el('span', 'spin'));
        b.appendChild(f);
        b.appendChild(el('span', 'sname', s.name));
        b.addEventListener('click', function () {
          state.labStyle = s.id;
          box.querySelectorAll('.scard').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          saveMeta();
          renderLab();
        });
        row.appendChild(b);
        cells.push({ s: s, f: f });
      });
      sec.appendChild(row);
      box.appendChild(sec);
    });
    var id = state.labId;
    (function next(i) {
      if (i >= cells.length || job !== thumbJob) return;
      processNow({ img: id, style: cells[i].s.id, params: labParams(cells[i].s.id) }, 340).then(function (c) {
        if (job !== thumbJob) return;
        var im = el('img'); im.src = c.toDataURL('image/jpeg', 0.85); im.alt = '';
        cells[i].f.textContent = '';
        cells[i].f.appendChild(im);
        next(i + 1);
      }).catch(function () { next(i + 1); });
    })(0);
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
    if (!compact && st.knobs.indexOf('warp') >= 0) box.appendChild(el('p', 'muted small knob-note', 'לוחצים על הפנים בתמונה כדי למרכז את ההגזמה.'));
  }
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
    $('stage-orig').src = meta.thumb;
    loadImg(id).then(function (im) { if (state.labId === id) $('stage-orig').src = im.src; });
    drawStage();
  }

  var stageJob = 0;
  function drawStage() {
    var job = ++stageJob, id = state.labId, style = state.labStyle, params = labParams(style);
    $('stage-busy').hidden = false;
    var p = FX.paramsFor(style, params), cross = $('cross');
    cross.hidden = FX.byId[style].knobs.indexOf('warp') < 0;
    cross.style.left = (p.cx * 100) + '%';
    cross.style.top = (p.cy * 100) + '%';
    processNow({ img: id, style: style, params: params }, 1100).then(function (c) {
      if (job !== stageJob) return;
      var out = $('stage-out');
      out.width = c.width; out.height = c.height;
      out.getContext('2d').drawImage(c, 0, 0);
      $('stage-inner').style.aspectRatio = c.width + ' / ' + c.height;
      $('stage-busy').hidden = true;
    }).catch(function (e) { $('stage-busy').hidden = true; toast(e.message); });
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

  function renderFull(id, style, params) {
    return loadImg(id).then(function (im) { return FX.renderAsync(im, style, params, EXPORT_MAX); });
  }

  function bindLab() {
    $('compare').addEventListener('input', function () { setCompare($('compare').value); });
    setCompare(100);
    $('stage-inner').addEventListener('click', function (e) {
      if (e.target.id === 'compare' || FX.byId[state.labStyle].knobs.indexOf('warp') < 0) return;
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
        addImage(items[i].c, items[i].name, 'lab', items[i].origin).then(function () { saved++; next(i + 1); })
          .catch(function (e) { toast(e.message, 5000); saveMeta(); });
      })(0);
    });
    $('batch-zip').addEventListener('click', function () {
      toast('מכין ZIP…', 60000);
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(function () {
        var zip = new window.JSZip();
        return Promise.all(state.batch.map(function (b, i) {
          return canvasToBlob(b.c, 'image/png').then(function (bl) { zip.file(String(i + 1).padStart(2, '0') + ' ' + safeName(b.name) + '.png', bl); });
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
      loadImg(ids[i]).then(function (im) { return FX.renderAsync(im, st.id, params, 1600); }).then(function (c) {
        var item = { c: c, name: m.name + ' · ' + st.name, origin: m.id };
        state.batch.push(item);
        var f = cells[i];
        f.textContent = '';
        var im = el('img'); im.src = c.toDataURL('image/jpeg', 0.85); im.alt = m.name;
        f.appendChild(im);
        var cap = el('figcaption');
        var dl = el('button', 'btn ghost tiny', 'הורדה');
        dl.type = 'button';
        dl.addEventListener('click', function () { canvasToBlob(c, 'image/png').then(function (b) { download(b, safeName(item.name) + '.png'); }); });
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
    var url = URL.createObjectURL(blob);
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('התמונה שהתקבלה פגומה.')); };
      im.src = url;
    }).then(function (im) {
      return addImage(im, name, 'ai', origin).then(function (m) { URL.revokeObjectURL(url); return m; });
    });
  }

  function runAi() {
    if (!AI.ready()) { openAiDialog(); return; }
    if (!state.labId) { toast('בחרו תמונה קודם.'); return; }
    var m = imageById(state.labId), st = AI.byId[state.aiStyle], btn = $('ai-go');
    aiBusy(btn, true);
    toast('Gemini מצייר את התמונה… זה לוקח בדרך כלל 10–30 שניות.', 60000);
    loadImg(state.labId).then(function (im) { return canvasToBlob(scaled(im, 1400), 'image/jpeg', 0.9); })
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
    Promise.all(ids.map(function (id) { return loadImg(id).then(function (im) { return canvasToBlob(scaled(im, 1100), 'image/jpeg', 0.88); }); }))
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
        getImage: getProcessed,
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
    $('auto-style').value = $('auto-style').dataset.v || 'classic';
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

  /* ---------- ייצוא ---------- */
  function renderPageCanvas(pg, scale) {
    var refs = pg.panels.filter(function (p) { return p.img && imageById(p.img); })
      .concat(pg.items.filter(function (i) { return i.type === 'photo' && i.img && imageById(i.img); }));
    var local = new Map();
    return Promise.all(refs.map(function (r) {
      return processNow(r, EXPORT_MAX).then(function (c) { local.set(refKey(r, EXPORT_MAX), c); });
    })).then(function () {
      var c = document.createElement('canvas');
      c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
      var x = c.getContext('2d');
      x.scale(scale, scale);
      PG.drawPage(x, pg, { getImage: function (r) { return local.get(refKey(r, EXPORT_MAX)) || null; } });
      return c;
    });
  }

  function exportPage(kind) {
    var pg = curPage();
    toast('מכין קובץ בגודל מלא…', 60000);
    document.fonts.ready.then(function () { return renderPageCanvas(pg, 2); }).then(function (c) {
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
        return p.then(function () { return renderPageCanvas(pg, 1.6); }).then(function (c) {
          var orient = pg.w > pg.h ? 'l' : 'p', size = [pg.w * 0.75, pg.h * 0.75];
          if (!doc) doc = new JsPDF({ orientation: orient, unit: 'pt', format: size });
          else doc.addPage(size, orient);
          doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, size[0], size[1]);
          toast('עמוד ' + (i + 1) + ' מתוך ' + pr.pages.length + '…', 120000);
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

  /* ---------- התחלה ---------- */
  function boot() {
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
    updateAiState();

    Promise.all([DB.all('images'), DB.get('meta', 'state'), DB.get('projects', 'current')]).then(function (r) {
      state.images = (r[0] || []).sort(function (a, b) { return a.added - b.added; });
      var meta = r[1] || {};
      state.sel = (meta.sel || []).filter(function (id) { return imageById(id); });
      if (meta.labStyle && FX.byId[meta.labStyle]) state.labStyle = meta.labStyle;
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
