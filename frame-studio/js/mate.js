/* The fast workspace (סביבת עבודה מהירה), the way a photo lab works at an event:
   - ראשי: every photo as a tile with its print size, copies (− / +), a check mark and its name; bars for adding photos,
     the print size (fit or crop), copies, and the business details;
   - ערוך תמונה: colour correction (brightness, contrast, exposure, saturation, warmth, red / green / blue, sharpness) on
     big live tiles, plus title, frames, effects and clipart, for the marked photos or all of them;
   - עורך מלא: one photo on a big canvas with a folder browser beside it and the tools underneath (general, objects,
     crop, AI), like a classic desktop photo editor;
   - AI: what runs on this computer at once, smart edits, viral looks and styles (cloud or the local engine);
   - הדפסה: printer, paper, DPI, true size (margins, cut marks) or page size (fit / crop), a page-by-page preview,
     print the current page or all, and saved settings.
   It is a view over the same photos (FS.state) as the studio: "🎨 הסטודיו המלא" opens the photo in the full editor.
   Everything here works offline except the cloud AI. Thumbnails are drawn lazily, a few per frame, from small copies. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc;
  if (!$('#view')) return;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function byId(id) { for (var i = 0; i < S.photos.length; i++) if (S.photos[i].id === id) return S.photos[i]; return null; }
  function idx(p) { return S.photos.indexOf(p); }
  function marked() { return FS.marked(); }
  function copies(p) { return p.copies == null ? 1 : p.copies; }
  function trim(v) { return String(Math.round(v * 10) / 10).replace(/\.0$/, ''); }
  function sizeTxt(p) { var mm = FS.mmOf(p.doc); return trim(mm[0] / 10) + 'X' + trim(mm[1] / 10); }

  /* ---------- the shell ---------- */
  var root = document.createElement('div'); root.id = 'mt'; root.hidden = true; root.setAttribute('dir', 'rtl');
  root.innerHTML =
    '<header class="mt-top"><nav class="mt-tabs" role="tablist">' +
      '<button data-v="main" class="on">🗂️ ראשי</button><button data-v="edit">🎚️ ערוך תמונה</button><button data-v="design">🖌️ עורך מלא</button><button data-v="ai">🤖 AI</button><button data-v="print">🖨️ הדפסה</button></nav>' +
      '<div class="mt-stat" id="mt-stat"></div>' +
      '<div class="mt-acts"><label class="mt-btn">📂 תמונות<input type="file" id="mt-files" multiple hidden accept="image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.rw2,.raw,.pef,.srw,.x3f,.3fr,.erf,.kdc,.mrw,.rwl,.iiq,.heic,.heif"></label>' +
      '<button class="mt-btn" id="mt-folder">📁 תיקייה</button><button class="mt-btn" id="mt-studio" title="העורך המלא של הסטודיו (שכבות, טקסטים, קולאז׳, אירוע חי)">🎨 הסטודיו המלא</button></div></header>' +
    /* main */
    '<section class="mt-view" data-view="main">' +
      '<div class="mt-sub"><button data-bar="size" class="on">📐 גודל</button><button data-bar="files">📁 תמונות</button><button data-bar="copies">🧾 הדפסים</button><button data-bar="biz">🏷️ פרטי העסק</button>' +
        '<span class="mt-sp"></span><button data-go="edit">🎚️ ערוך תמונה</button><button data-go="design">🖌️ עיצוב</button><button data-go="print" class="mt-pr-btn">🖨️ הדפסה</button></div>' +
      '<div class="mt-bar" data-b="size"><label>גודל:</label><select id="mt-size"></select><button class="mt-ic" id="mt-size-edit" title="ניהול הגדלים">✏️</button>' +
        '<div class="mt-seg" id="mt-fit"><button data-f="contain">להתאים</button><button data-f="cover">לחתוך</button></div>' +
        '<label class="mt-chk-l"><input type="checkbox" id="mt-orient" checked> לפי כיוון התמונה</label>' +
        '<button class="mt-btn" id="mt-size-sel">החל על המסומנות</button><button class="mt-btn" id="mt-size-all">החל על כולן</button></div>' +
      '<div class="mt-bar" data-b="files" hidden><button class="mt-btn" id="mt-all">✔ סימון הכל</button><button class="mt-btn" id="mt-none">ניקוי סימון</button><button class="mt-btn" id="mt-inv">היפוך</button>' +
        '<select id="mt-show"><option value="all">הכל</option><option value="sel">רק המסומנות</option><option value="todo">שלא הודפסו</option><option value="done">שהודפסו</option><option value="edited">שנערכו</option></select>' +
        '<select id="mt-sort"><option value="">הסדר שנכנסו</option><option value="name">לפי שם</option></select><button class="mt-btn danger" id="mt-del">🗑 הסרה מהעבודה</button></div>' +
      '<div class="mt-bar" data-b="copies" hidden><label>הדפסים למסומנות:</label><button class="mt-ic" data-cpa="-1">−</button><b id="mt-cpn">1</b><button class="mt-ic" data-cpa="1">+</button>' +
        '<button class="mt-btn" id="mt-cp-set">קביעה</button><button class="mt-btn" id="mt-cp-1">1 לכולן</button><button class="mt-btn" id="mt-cp-0">0 לכולן</button><span class="mt-hint">0 = לא מודפסת</span></div>' +
      '<div class="mt-bar" data-b="biz" hidden><span class="mt-hint" id="mt-biz-txt"></span><button class="mt-btn" id="mt-biz-on">➕ הוספה לתמונות</button><button class="mt-btn" id="mt-biz-off">➖ הסרה מהתמונות</button><button class="mt-btn" id="mt-biz-edit">✏️ עריכת הפרטים</button></div>' +
      '<div class="mt-grid" id="mt-grid"></div>' +
      '<div class="mt-empty" id="mt-empty"><h2>מתחילים</h2><p>בוחרים תמונות או תיקייה שלמה. כל תמונה מקבלת גודל הדפסה ומספר עותקים, ואפשר לערוך, לעצב ולהדפיס.</p>' +
        '<div><label class="mt-btn big">📂 בחירת תמונות<input type="file" id="mt-files2" multiple hidden accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.heic,.heif"></label><button class="mt-btn big" id="mt-folder2">📁 תיקייה</button></div></div>' +
      '<footer class="mt-foot"><span id="mt-foot"></span><label>גודל תצוגה <input type="range" id="mt-zoom" min="120" max="420" step="10"></label></footer>' +
    '</section>' +
    /* edit (colour correction and the rest, on big tiles) */
    '<section class="mt-view" data-view="edit" hidden>' +
      '<aside class="mt-panel"><nav class="mt-ptabs"><button data-pt="color" class="on">תיקון צבע</button><button data-pt="title">כותרת</button><button data-pt="frames">מסגרות</button><button data-pt="fx">אפקטים</button><button data-pt="clip">קליפארט</button></nav>' +
        '<div class="mt-pp" data-pp="color"><div id="mt-sliders"></div><div class="mt-row"><button class="mt-btn" id="mt-auto">✨ אוטומטי</button><button class="mt-btn" id="mt-reset">↺ איפוס תיקון</button></div></div>' +
        '<div class="mt-pp" data-pp="title" hidden><textarea id="mt-tt" rows="2" placeholder="למשל: נועה ומשה · 4.12.25"></textarea>' +
          '<div class="mt-row"><select id="mt-tfont"></select><input type="color" id="mt-tcol" value="#ffffff"></div>' +
          '<label class="mt-l">גודל <input type="range" id="mt-tsize" min="2" max="14" step="0.5" value="6"></label>' +
          '<div class="mt-seg" id="mt-tpos"><button data-p="top">למעלה</button><button data-p="mid">באמצע</button><button data-p="bottom" class="on">למטה</button></div>' +
          '<label class="mt-chk-l"><input type="checkbox" id="mt-tsh" checked> צל לקריאות</label>' +
          '<div class="mt-row"><button class="mt-btn primary" id="mt-tadd">➕ הוספת כותרת</button><button class="mt-btn" id="mt-tdel">🗑 הסרה</button></div></div>' +
        '<div class="mt-pp" data-pp="frames" hidden><div class="mt-row"><label>צבע</label><input type="color" id="mt-fcol" value="#ffffff"><label class="mt-btn">➕ PNG משלי<input type="file" id="mt-fpng" accept="image/*" hidden></label></div><div class="mt-chips" id="mt-frames"></div></div>' +
        '<div class="mt-pp" data-pp="fx" hidden><div class="mt-chips small" id="mt-fxcat"></div><div class="mt-fx" id="mt-fx"></div><h4>סגנון</h4><div class="mt-chips" id="mt-styles"></div></div>' +
        '<div class="mt-pp" data-pp="clip" hidden><div class="mt-emo" id="mt-emo"></div><label class="mt-btn">🖼️ לוגו / תמונה<input type="file" id="mt-logo" accept="image/*" hidden></label><button class="mt-btn" id="mt-clipdel">🗑 הסרת הקליפארט</button></div>' +
        '<div class="mt-pfoot"><p class="mt-hint" id="mt-target"></p><button class="mt-btn" id="mt-apply-all">החל את התיקון על כל התמונות</button></div>' +
      '</aside><div class="mt-egrid" id="mt-egrid"></div>' +
    '</section>' +
    /* the full editor */
    '<section class="mt-view" data-view="design" hidden>' +
      '<aside class="mt-browser"><div class="mt-row"><button class="mt-btn" id="mt-dir">📁 פתיחת תיקייה</button></div><div class="mt-tree" id="mt-tree"></div><div class="mt-files" id="mt-flist"></div><h4>בעבודה</h4><div class="mt-proj" id="mt-proj"></div></aside>' +
      '<div class="mt-dz"><div class="mt-cvw" id="mt-cvw"><canvas id="mt-cv"></canvas></div>' +
        '<div class="mt-dinfo"><span id="mt-dname"></span><span id="mt-dsize"></span><span class="mt-sp"></span><button class="mt-ic" id="mt-prev" title="הקודמת">▶</button><button class="mt-ic" id="mt-next" title="הבאה">◀</button></div>' +
        '<div class="mt-dtools"><nav class="mt-ptabs"><button data-dt="gen" class="on">כללי</button><button data-dt="obj">עצמים</button><button data-dt="crop">חיתוך</button><button data-dt="ai">כלים AI</button></nav>' +
          '<div class="mt-dp" data-dp="gen"><div class="mt-dgrid">' +
            '<select id="mt-dframe" title="מסגרת"></select><button class="mt-btn" data-d="auto">רמה אוטומטית</button><button class="mt-btn" data-d="sharp">חידוד</button><button class="mt-btn" data-d="clear">הברקה</button>' +
            '<button class="mt-btn" data-d="back">תאורה אחורית</button><select id="mt-dfilm" title="אפקט פילם"></select><select id="mt-dpre" title="מסננים"></select><select id="mt-dsz" title="שינוי גודל"></select>' +
            '<button class="mt-ic" data-d="rl" title="סיבוב שמאלה">⟲</button><button class="mt-ic" data-d="rr" title="סיבוב ימינה">⟳</button><button class="mt-ic" data-d="fh" title="היפוך">⇋</button><button class="mt-ic" data-d="fv" title="היפוך אנכי">⇵</button></div>' +
            '<div class="mt-dsl" id="mt-dsl"></div></div>' +
          '<div class="mt-dp" data-dp="obj" hidden><div class="mt-row"><input id="mt-otext" placeholder="טקסט להוספה"><select id="mt-ofont"></select><input type="color" id="mt-ocol" value="#ffffff"><button class="mt-btn" id="mt-oadd">➕ טקסט</button></div>' +
            '<div class="mt-emo" id="mt-oemo"></div><div class="mt-row"><label class="mt-btn">🖼️ לוגו / תמונה<input type="file" id="mt-ologo" accept="image/*" hidden></label><button class="mt-btn" id="mt-odel">🗑 מחיקת העצם המסומן</button><span class="mt-hint">גוררים עצם על התמונה כדי להזיז, גלגלת משנה גודל</span></div></div>' +
          '<div class="mt-dp" data-dp="crop" hidden><div class="mt-chips" id="mt-crops"></div><div class="mt-row"><div class="mt-seg" id="mt-cfit"><button data-f="contain">להתאים</button><button data-f="cover" class="on">לחתוך</button></div><button class="mt-btn" id="mt-cface">🎯 מרכוז לפי הפנים</button><span class="mt-hint">גוררים את התמונה כדי לבחור מה נכנס, גלגלת לזום</span></div></div>' +
          '<div class="mt-dp" data-dp="ai" hidden><div class="mt-chips" id="mt-dai"></div></div>' +
          '<div class="mt-dacts"><button class="mt-btn" id="mt-dsave">💾 שמירה</button><button class="mt-btn" id="mt-dprint">🖨️ הדפסה</button><button class="mt-btn" id="mt-dundo">↶ ביטול</button><button class="mt-btn" id="mt-dredo">↷ חזרה</button><button class="mt-btn" id="mt-dall">↺ ביטול הכל</button></div>' +
        '</div></div>' +
    '</section>' +
    /* AI */
    '<section class="mt-view" data-view="ai" hidden><div class="mt-ai">' +
      '<p class="mt-hint" id="mt-ai-target"></p>' +
      '<div class="mt-card"><h3>🖥️ מיד, על המחשב · עובד גם בלי אינטרנט</h3><div class="mt-chips" id="mt-ai-local"></div></div>' +
      '<div class="mt-card"><h3>⚙️ מנוע ה־AI</h3><div class="mt-chips" id="mt-ai-eng"></div></div>' +
      '<div class="mt-card"><h3>🪄 עריכות חכמות <small>התמונה נשארת, משתנה דבר אחד</small></h3><div class="mt-ai-g" id="mt-ai-edits"></div></div>' +
      '<div class="mt-card"><h3>🔥 טרנדים ויראליים</h3><div class="mt-ai-g" id="mt-ai-viral"></div></div>' +
      '<div class="mt-card"><h3>🎨 סגנונות</h3><div class="mt-ai-g" id="mt-ai-styles"></div></div>' +
      '<div class="mt-card"><h3>✍️ לתאר במילים</h3><div class="mt-row"><input id="mt-ai-text" placeholder="למשל: להלביש את כולם בתחפושות פיראטים על ספינה"><button class="mt-btn primary" id="mt-ai-go">✨ לעשות</button></div>' +
        '<div class="mt-row"><button class="mt-btn" id="mt-ai-back">↶ ביטול ה־AI האחרון</button><button class="mt-btn" id="mt-ai-orig">↩ החזרת המקור</button></div></div>' +
    '</div></section>';
  document.body.appendChild(root);

  var view = 'main', bar = ls('fs-mate-bar') || 'size', focusId = null;
  function on() { return !root.hidden; }
  function show(v) {
    if (v === 'print') { openPrint(); return; }
    view = v || view;
    $$('.mt-tabs [data-v]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.v === view); });
    $$('.mt-view', root).forEach(function (s) { s.hidden = s.dataset.view !== view; });
    if (view === 'main') buildGrid(); else if (view === 'edit') buildEdit(); else if (view === 'design') buildDesign(); else if (view === 'ai') buildAI();
    stat();
  }
  function open(v) {
    root.hidden = false; document.body.classList.add('mt-on'); ls('fs-mate', 'on');
    if (FS.gridMode && FS.gridMode() && FS.showGrid) { /* the studio's own photos screen stays behind */ }
    show(v || view);
  }
  function close() {
    root.hidden = true; document.body.classList.remove('mt-on'); ls('fs-mate', 'off');
    var p = focus(); if (p) FS.select(idx(p));
    FS.emit('doc'); if (FS.refreshStrip) FS.refreshStrip(); if (FS.render) FS.render();
  }
  FS.mate = { open: open, close: close, isOn: on, print: function () { openPrint(); } };
  $$('.mt-tabs [data-v]', root).forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.v); }); });
  $$('[data-go]', root).forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.go); }); });
  $('#mt-studio', root).addEventListener('click', close);

  /* the studio's way back here */
  var back = document.createElement('button'); back.className = 'btn small'; back.id = 'mt-open'; back.textContent = '⚡ סביבת עבודה'; back.title = 'מסך התמונות, הגדלים, העותקים וההדפסה';
  back.addEventListener('click', function () { open(); });
  var act = $('.sb-act'); if (act) act.insertBefore(back, act.firstChild); else document.body.appendChild(back);

  /* photos in */
  function addFiles(fl) { if (fl && fl.length) FS.addFiles(fl); }
  ['#mt-files', '#mt-files2'].forEach(function (s) { $(s, root).addEventListener('change', function () { addFiles(this.files); this.value = ''; }); });
  function pickFolder() {
    if (!window.showDirectoryPicker) {
      var i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.webkitdirectory = true;
      i.addEventListener('change', function () { addFiles(i.files); }); i.click(); return;
    }
    window.showDirectoryPicker({ id: 'frame-studio-photos' }).then(function (dir) { return filesOf(dir, true); }).then(addFiles).catch(function () {});
  }
  var IMG_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;
  function isImg(n) { return IMG_RE.test(n) || FS.RAW_EXT.test(n); }
  function filesOf(dir, deep) {
    var out = [];
    function walk(d, depth) {
      var it = d.values(), all = [];
      function step() { return it.next().then(function (r) { if (r.done) return; all.push(r.value); return step(); }); }
      return step().then(function () {
        return all.reduce(function (ch, h) {
          return ch.then(function () {
            if (h.kind === 'file' && isImg(h.name)) return h.getFile().then(function (f) { out.push(f); });
            if (h.kind === 'directory' && deep && depth < 2) return walk(h, depth + 1);
          });
        }, Promise.resolve());
      });
    }
    return walk(dir, 0).then(function () { out.sort(function (a, b) { return a.name.localeCompare(b.name, 'he', { numeric: true }); }); return out; });
  }
  $('#mt-folder', root).addEventListener('click', pickFolder);
  $('#mt-folder2', root).addEventListener('click', pickFolder);

  /* ---------- thumbnails: a page drawn small, with its own small cache, a few per frame ---------- */
  function pageCanvas(p, size, fast) {
    var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k);
    var proxy = { src: p.src, doc: d, cache: p._mc || {}, mask: p.mask, maskV: p.maskV };
    FS.draw(c.getContext('2d'), proxy, { scale: k, max: Math.round(size * 1.5), fast: fast !== false, export: true });
    p._mc = proxy.cache; return c;
  }
  function sig(p, size) { return size + '|' + p.src + '|' + JSON.stringify(p.doc); }
  var queue = [], qOn = false;
  function enqueue(el) { if (queue.indexOf(el) < 0) queue.push(el); if (!qOn) { qOn = true; requestAnimationFrame(pump); } }
  function pump() {
    var t0 = performance.now();
    while (queue.length && performance.now() - t0 < 14) drawTile(queue.shift());
    if (queue.length) requestAnimationFrame(pump); else qOn = false;
  }
  function drawTile(el) {
    var p = byId(el.dataset.id), box = el.querySelector('.mt-th'); if (!p || !box || !el.isConnected) return;
    if (!FS.img(p.src)) { FS.loadImg(p.src).then(function () { enqueue(el); }, function () {}); return; }
    var size = Number(el.dataset.px) || 220, s = sig(p, size); if (el._sig === s) return;
    var c = pageCanvas(p, size), old = box.querySelector('canvas'); if (old) box.replaceChild(c, old); else box.insertBefore(c, box.firstChild);
    el._sig = s;
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) enqueue(e.target); }); }, { rootMargin: '300px' }) : null;
  function watch(el) { if (io) io.observe(el); else enqueue(el); }

  /* ---------- ראשי ---------- */
  var zoom = Number(ls('fs-mate-zoom')) || 190, lastClick = -1;
  $('#mt-zoom', root).value = zoom;
  $('#mt-zoom', root).addEventListener('input', function () { zoom = Number(this.value); ls('fs-mate-zoom', zoom); root.style.setProperty('--mt-tile', zoom + 'px'); buildGrid(); });
  root.style.setProperty('--mt-tile', zoom + 'px');
  function shown() {
    var f = $('#mt-show', root).value, l = S.photos.slice();
    if (f === 'sel') l = l.filter(function (p) { return S.marked[p.id]; });
    else if (f === 'todo') l = l.filter(function (p) { return !p.printed; });
    else if (f === 'done') l = l.filter(function (p) { return p.printed; });
    else if (f === 'edited') l = l.filter(function (p) { return FS.isEdited ? FS.isEdited(p) : true; });
    if ($('#mt-sort', root).value === 'name') l.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he', { numeric: true }); });
    return l;
  }
  function tileHTML(p, px) {
    return '<div class="mt-tile' + (S.marked[p.id] ? ' sel' : '') + (p.id === focusId ? ' focus' : '') + '" data-id="' + p.id + '" data-px="' + px + '"><div class="mt-th">' +
      '<button class="mt-chk" title="סימון">✓</button><button class="mt-zoomb" title="הגדלה">🔍</button>' +
      '<div class="mt-band"><b>' + sizeTxt(p) + '</b><span class="mt-cp"><button data-cp="-1" title="פחות">−</button><i>' + copies(p) + ' הדפסים</i><button data-cp="1" title="עוד">+</button></span>' +
      (p.printed ? '<small>הודפסו ' + p.printed + '</small>' : '') + '</div></div><div class="mt-name" title="' + esc(p.name || '') + '">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '</div></div>';
  }
  function buildGrid() {
    var g = $('#mt-grid', root), l = shown();
    $('#mt-empty', root).hidden = !!S.photos.length; g.hidden = !S.photos.length;
    g.innerHTML = l.map(function (p) { return tileHTML(p, zoom); }).join('');
    $$('.mt-tile', g).forEach(watch);
    foot(); stat();
  }
  function refreshTile(p) {
    $$('.mt-tile[data-id="' + p.id + '"]', root).forEach(function (el) {
      if (el.classList.contains('mt-pj')) { el._sig = null; enqueue(el); return; }
      var big = el.closest('#mt-egrid'), n = document.createElement('div');
      n.innerHTML = big ? eTileHTML(p) : tileHTML(p, Number(el.dataset.px) || zoom);
      var ne = n.firstChild, c = el.querySelector('canvas'), box = ne.querySelector('.mt-th');
      if (c && el._sig) { box.insertBefore(c, box.firstChild); ne._sig = el._sig; }
      el.parentNode.replaceChild(ne, el); watch(ne);
    });
  }
  function refreshAll() { if (!on()) return; if (view === 'main') buildGrid(); else if (view === 'edit') buildEdit(); else if (view === 'design') drawDesign(); stat(); }
  function mark(p, v) { if (v) S.marked[p.id] = true; else delete S.marked[p.id]; }
  $('#mt-grid', root).addEventListener('click', function (e) {
    var t = e.target.closest('.mt-tile'); if (!t) return; var p = byId(t.dataset.id); if (!p) return;
    var cp = e.target.closest('[data-cp]');
    if (cp) { p.copies = FS.clamp(copies(p) + Number(cp.dataset.cp), 0, 999); refreshTile(p); foot(); return; }
    if (e.target.closest('.mt-zoomb')) { big(p); return; }
    var l = shown(), i = l.indexOf(p);
    if (e.shiftKey && lastClick >= 0) { var a = Math.min(i, lastClick), b = Math.max(i, lastClick); for (var k = a; k <= b; k++) mark(l[k], true); buildGrid(); }
    else { mark(p, !S.marked[p.id]); t.classList.toggle('sel', !!S.marked[p.id]); }
    focusId = p.id; lastClick = i; $$('.mt-tile.focus', root).forEach(function (x) { x.classList.toggle('focus', x === t); }); t.classList.add('focus'); foot(); stat();
  });
  $('#mt-grid', root).addEventListener('dblclick', function (e) { var t = e.target.closest('.mt-tile'); if (!t || e.target.closest('button')) return; focusId = t.dataset.id; show('design'); });
  function big(p) {
    var c = pageCanvas(p, Math.min(1400, Math.round(Math.max(innerWidth, innerHeight) * 0.8)), false);
    var b = FS.dialog(esc(p.name || ''), '<div class="mt-big"></div><div class="mt-row"><button class="mt-btn" id="mt-big-edit">🖌️ לעורך המלא</button></div>', true);
    $('.mt-big', b).appendChild(c); $('#mt-big-edit', b).addEventListener('click', function () { FS.closeDialog(); focusId = p.id; show('design'); });
  }
  function foot() {
    var n = S.photos.length, m = marked().length, prints = S.photos.reduce(function (a, p) { return a + copies(p); }, 0), done = S.photos.filter(function (p) { return p.printed; }).length;
    $('#mt-foot', root).textContent = n + ' תמונות · ' + m + ' מסומנות · ' + prints + ' הדפסים · ' + done + ' הודפסו';
  }
  function stat() { var m = marked().length; $('#mt-stat', root).textContent = S.photos.length ? (m ? m + ' מסומנות מתוך ' + S.photos.length : S.photos.length + ' תמונות') : ''; foot(); }

  /* sub bars */
  function setBar(b) { bar = b; ls('fs-mate-bar', b); $$('.mt-sub [data-bar]', root).forEach(function (x) { x.classList.toggle('on', x.dataset.bar === b); }); $$('.mt-bar', root).forEach(function (x) { x.hidden = x.dataset.b !== b; }); if (b === 'biz') bizTxt(); }
  $$('.mt-sub [data-bar]', root).forEach(function (x) { x.addEventListener('click', function () { setBar(x.dataset.bar); }); });
  setBar(bar);
  ['#mt-show', '#mt-sort'].forEach(function (s) { $(s, root).addEventListener('change', buildGrid); });
  $('#mt-all', root).addEventListener('click', function () { shown().forEach(function (p) { mark(p, true); }); buildGrid(); });
  $('#mt-none', root).addEventListener('click', function () { S.marked = {}; buildGrid(); });
  $('#mt-inv', root).addEventListener('click', function () { shown().forEach(function (p) { mark(p, !S.marked[p.id]); }); buildGrid(); });
  $('#mt-del', root).addEventListener('click', function () {
    var l = marked(); if (!l.length) return FS.toast('מסמנים קודם את התמונות להסרה');
    if (!confirm('להסיר ' + l.length + ' תמונות מהעבודה? (הקבצים במחשב לא נמחקים)')) return;
    S.photos = S.photos.filter(function (p) { return !S.marked[p.id]; }); S.marked = {}; S.cur = Math.min(Math.max(S.cur, 0), S.photos.length - 1); S.sel = null;
    FS.buildStrip(); FS.emit('doc'); FS.emit('history'); buildGrid();
  });

  /* size: fit or crop, for the marked photos or all */
  var fit = ls('fs-mate-fit') || 'cover';
  function sizes() {
    var cur = ls('fs-mate-size') || '';
    $('#mt-size', root).innerHTML = FS.mySizes().map(function (z) { return '<option value="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</option>'; }).join('');
    if (cur && $('#mt-size option[value="' + cur + '"]', root)) $('#mt-size', root).value = cur; else { var t = $('#mt-size option[value="my:b100x150"]', root); if (t) $('#mt-size', root).value = 'my:b100x150'; }
  }
  sizes(); FS.on('sizes', sizes);
  $('#mt-size', root).addEventListener('change', function () { ls('fs-mate-size', this.value); });
  $('#mt-size-edit', root).addEventListener('click', function () { FS.manageSizes(); });
  function seg(sel, val, attr) { $$(sel + ' button', root).forEach(function (b) { b.classList.toggle('on', b.dataset[attr] === val); }); }
  seg('#mt-fit', fit, 'f');
  $('#mt-fit', root).addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; fit = b.dataset.f; ls('fs-mate-fit', fit); seg('#mt-fit', fit, 'f'); });
  /* one photo to a print size: the layers keep their place, a frame is rebuilt for the new shape, the photo fills or fits */
  function toSize(p, z, mode, orient) {
    var im = FS.img(p.src); if (!im) return;
    var w = z.w, h = z.h, d = p.doc;
    if (orient) { var land = (im.naturalWidth > im.naturalHeight) !== (Math.abs(Math.round(d.photo.r / 90)) % 2 === 1); if (land !== (w > h) && w !== h) { var t = w; w = h; h = t; } }
    var oldW = d.w, oldH = d.h;
    FS.applyFormat(d, 'cm', im, w, h);
    d.layers.forEach(function (L) { L.x = L.x / oldW * d.w; L.y = L.y / oldH * d.h; });
    if (d.frame) FS.setFrame(p, d.frame, { quiet: true, noTexts: true });
    FS.fitPhoto(d, im, mode); p.fit = mode;
    p.cache = {}; p._pt = null; p._gt = null; FS.snap(p);
  }
  function applySize(list) {
    var z = FS.sizeOf($('#mt-size', root).value); if (!z) return FS.toast('בוחרים גודל');
    if (!list.length) return FS.toast('אין תמונות');
    var o = $('#mt-orient', root).checked;
    Promise.all(list.map(function (p) { return FS.loadImg(p.src).catch(function () {}); })).then(function () {
      list.forEach(function (p) { toSize(p, z, fit, o); });
      FS.emit('doc'); buildGrid(); FS.toast('📐 ' + FS.sizeLabel(z) + ' · ' + (fit === 'cover' ? 'לחתוך' : 'להתאים') + ' · ' + list.length + ' תמונות');
    });
  }
  $('#mt-size-sel', root).addEventListener('click', function () { var l = marked(); if (!l.length) return FS.toast('מסמנים תמונות, או "החל על כולן"'); applySize(l); });
  $('#mt-size-all', root).addEventListener('click', function () { applySize(S.photos.slice()); });

  /* copies */
  var cpn = 1;
  $$('[data-cpa]', root).forEach(function (b) { b.addEventListener('click', function () { cpn = FS.clamp(cpn + Number(b.dataset.cpa), 0, 999); $('#mt-cpn', root).textContent = cpn; }); });
  $('#mt-cp-set', root).addEventListener('click', function () { var l = marked(); if (!l.length) return FS.toast('מסמנים תמונות קודם'); l.forEach(function (p) { p.copies = cpn; }); buildGrid(); });
  $('#mt-cp-1', root).addEventListener('click', function () { S.photos.forEach(function (p) { p.copies = 1; }); buildGrid(); });
  $('#mt-cp-0', root).addEventListener('click', function () { S.photos.forEach(function (p) { p.copies = 0; }); buildGrid(); FS.toast('כל התמונות על 0. מוסיפים + לתמונות שרוצים להדפיס.'); });

  /* the business details: never added by themselves; added here when wanted, and removed the same way */
  function bizTxt() { var t = FS.creditText ? FS.creditText() : ''; $('#mt-biz-txt', root).textContent = t ? 'הפרטים: ' + t : 'עוד לא הוזנו פרטי עסק'; }
  function bizSet(onOff) {
    var list = marked().length ? marked() : S.photos.slice(); if (!list.length) return;
    var keep = FS.BIZ.credit.on; FS.BIZ.credit.on = onOff;
    list.forEach(function (p) { if (onOff) { delete p.noCredit; FS.applyCredit(p); } else { p.doc.layers = p.doc.layers.filter(function (L) { return L.link !== 'biz'; }); } p.cache = {}; FS.snap(p); });
    FS.BIZ.credit.on = keep; buildGrid(); FS.toast(onOff ? '🏷️ הפרטים נוספו ל־' + list.length + ' תמונות' : 'הפרטים הוסרו מ־' + list.length + ' תמונות');
  }
  $('#mt-biz-on', root).addEventListener('click', function () { if (!FS.creditText()) { var b = $('#biz-btn'); if (b) b.click(); return; } bizSet(true); });
  $('#mt-biz-off', root).addEventListener('click', function () { bizSet(false); });
  $('#mt-biz-edit', root).addEventListener('click', function () { var b = $('#biz-btn'); if (b) b.click(); });

  /* ---------- ערוך תמונה ---------- */
  var SL = [['brightness', 'בהירות', '☀️'], ['contrast', 'ניגודיות', '◐'], ['exposure', 'חשיפה', '🔆'], ['saturation', 'רוויה', '🎨'], ['temp', 'חום', '🌡️'],
    ['cr', 'אדום', 'R'], ['cg', 'ירוק', 'G'], ['cb', 'כחול', 'B'], ['sharpen', 'חדות', '🔍']];
  $('#mt-sliders', root).innerHTML = SL.map(function (s) {
    var lo = s[0] === 'sharpen' ? 0 : -100;
    return '<div class="mt-sl" data-k="' + s[0] + '"><span class="mt-sli ' + (/^c[rgb]$/.test(s[0]) ? s[0] : '') + '">' + s[2] + '</span><label>' + s[1] + '</label><input type="range" min="' + lo + '" max="100" value="0"><input type="number" min="' + lo + '" max="100" value="0"><button class="mt-ic" title="איפוס">↺</button></div>';
  }).join('');
  function focus() { var p = focusId && byId(focusId); return p || FS.cur() || S.photos[0] || null; }
  function editList() { var m = marked(); return m.length ? m : S.photos.slice(); }
  /* what a change reaches: the marked photos (with the focused one), or the focused one */
  function targets() { var f = focus(), m = marked(); if (f && m.length && S.marked[f.id]) return m; if (!f && m.length) return m; return f ? [f] : []; }
  function eTileHTML(p) {
    return '<div class="mt-tile big' + (S.marked[p.id] ? ' sel' : '') + (p.id === (focus() || {}).id ? ' focus' : '') + '" data-id="' + p.id + '" data-px="' + etile + '"><div class="mt-th"><button class="mt-chk" title="סימון">✓</button></div><div class="mt-name">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '<button class="mt-dl" title="שמירת התמונה">⬇</button></div></div>';
  }
  var etile = 420;
  function buildEdit() {
    var g = $('#mt-egrid', root), l = editList();
    etile = Math.max(260, Math.min(720, Math.round((g.clientWidth || innerWidth * 0.7) / 3 - 24)));
    if (!focus() && l[0]) focusId = l[0].id;
    g.innerHTML = l.length ? l.map(eTileHTML).join('') : '<p class="mt-hint">אין תמונות עדיין.</p>';
    $$('.mt-tile', g).forEach(watch); syncSliders(); targetTxt(); buildFrames(); buildFx(); stat();
  }
  function targetTxt() { var n = targets().length; $('#mt-target', root).textContent = n > 1 ? 'השינויים חלים על ' + n + ' התמונות המסומנות' : n ? 'השינויים חלים על התמונה המודגשת · לסימון כמה תמונות לוחצים על ✓' : ''; }
  $('#mt-egrid', root).addEventListener('click', function (e) {
    var t = e.target.closest('.mt-tile'); if (!t) return; var p = byId(t.dataset.id);
    if (e.target.closest('.mt-dl')) { saveOne(p); return; }
    if (e.target.closest('.mt-chk')) { mark(p, !S.marked[p.id]); t.classList.toggle('sel', !!S.marked[p.id]); targetTxt(); stat(); return; }
    focusId = p.id; $$('#mt-egrid .mt-tile', root).forEach(function (x) { x.classList.toggle('focus', x === t); }); syncSliders(); targetTxt(); buildFx();
  });
  $('#mt-egrid', root).addEventListener('dblclick', function (e) { var t = e.target.closest('.mt-tile'); if (!t || e.target.closest('button')) return; focusId = t.dataset.id; show('design'); });
  function syncSliders() {
    var p = focus(), a = p ? p.doc.photo.adj : FS.ADJ0;
    $$('.mt-sl', root).forEach(function (r) { var v = a[r.dataset.k] || 0; $('input[type=range]', r).value = v; $('input[type=number]', r).value = v; });
  }
  var liveT = 0, endT = 0;
  function setAdj(k, v, final) {
    var list = targets(); if (!list.length) return;
    list.forEach(function (p) { p.doc.photo.adj[k] = v; p.doc.photo.preset = null; });
    cancelAnimationFrame(liveT);
    liveT = requestAnimationFrame(function () { var f = focus(); $$('.mt-tile[data-id="' + (f && f.id) + '"]', root).forEach(function (el) { el._sig = null; drawTile(el); }); });
    clearTimeout(endT);
    endT = setTimeout(function () { list.forEach(function (p) { p.cache = {}; $$('.mt-tile[data-id="' + p.id + '"]', root).forEach(function (el) { el._sig = null; enqueue(el); }); }); }, final ? 0 : 260);
    if (final) list.forEach(function (p) { FS.snap(p); });
  }
  $$('.mt-sl', root).forEach(function (r) {
    var k = r.dataset.k, rg = $('input[type=range]', r), nb = $('input[type=number]', r);
    rg.addEventListener('input', function () { nb.value = rg.value; setAdj(k, Number(rg.value)); });
    rg.addEventListener('change', function () { setAdj(k, Number(rg.value), true); });
    nb.addEventListener('change', function () { var v = FS.clamp(Number(nb.value) || 0, Number(nb.min), 100); nb.value = rg.value = v; setAdj(k, v, true); });
    $('button', r).addEventListener('click', function () { nb.value = rg.value = 0; setAdj(k, 0, true); });
    rg.addEventListener('dblclick', function () { nb.value = rg.value = 0; setAdj(k, 0, true); });
  });
  function redraw(list) { list.forEach(function (p) { p.cache = {}; FS.snap(p); refreshTile(p); }); FS.emit('doc'); }
  $('#mt-auto', root).addEventListener('click', function () { var l = targets(); Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { l.forEach(function (p) { p.doc.photo.adj = Object.assign({}, p.doc.photo.adj, FS.autoAdjust(p)); }); redraw(l); syncSliders(); FS.toast('✨ תיקון אוטומטי · ' + l.length + ' תמונות'); }); });
  $('#mt-reset', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.photo.adj = Object.assign({}, FS.ADJ0); p.doc.photo.preset = null; }); redraw(l); syncSliders(); });
  $('#mt-apply-all', root).addEventListener('click', function () {
    var f = focus(); if (!f) return; var a = JSON.stringify(f.doc.photo.adj);
    S.photos.forEach(function (p) { if (p !== f) { p.doc.photo.adj = JSON.parse(a); p.doc.photo.preset = f.doc.photo.preset || null; } }); redraw(S.photos.slice()); FS.toast('התיקון הוחל על ' + S.photos.length + ' התמונות');
  });
  $$('.mt-ptabs [data-pt]', root).forEach(function (b) { b.addEventListener('click', function () { $$('.mt-ptabs [data-pt]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); $$('[data-pp]', root).forEach(function (x) { x.hidden = x.dataset.pp !== b.dataset.pt; }); }); });

  /* title: one linked text layer on each target, replaced when added again */
  var fonts = FS.FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('');
  $('#mt-tfont', root).innerHTML = fonts; $('#mt-tfont', root).value = 'Frank Ruhl Libre';
  var tpos = 'bottom';
  $('#mt-tpos', root).addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; tpos = b.dataset.p; seg('#mt-tpos', tpos, 'p'); });
  $('#mt-tadd', root).addEventListener('click', function () {
    var text = $('#mt-tt', root).value.trim(); if (!text) return FS.toast('כותבים כותרת');
    var l = targets(); l.forEach(function (p) {
      var d = p.doc, H = FS.hole(d), size = Math.round(Math.min(d.w, d.h) * Number($('#mt-tsize', root).value) / 100);
      d.layers = d.layers.filter(function (L) { return L.link !== 'mt-title'; });
      var y = tpos === 'top' ? H.y + size * 1.1 : tpos === 'mid' ? H.y + H.h / 2 : H.y + H.h - size * 1.1;
      d.layers.push({ id: FS.uid(), link: 'mt-title', type: 'text', text: text, size: size, font: $('#mt-tfont', root).value, weight: 700, color: $('#mt-tcol', root).value, shadow: $('#mt-tsh', root).checked, x: d.w / 2, y: y, r: 0, opacity: 1, align: 'center', strokeW: 0, stroke: '#000000', spacing: 0 });
    });
    redraw(l); FS.toast('🔤 הכותרת נוספה ל־' + l.length + ' תמונות');
  });
  $('#mt-tdel', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.layers = p.doc.layers.filter(function (L) { return L.link !== 'mt-title'; }); }); redraw(l); });

  /* frames */
  function frameRef(v, col) { if (!v) return null; return v[0] === 'u' ? { kind: 'png', id: v.slice(2), opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false } : { kind: 'gen', id: v.slice(2), opacity: 1, thick: 1, color: col }; }
  function frameOptions() {
    var base = FS.GEN_FRAMES.filter(function (f) { return (FS.BASE_FRAMES || []).indexOf(f.id) >= 0; });
    return [['', 'בלי מסגרת']].concat(base.map(function (f) { return ['g:' + f.id, f.name]; }), Object.keys(FS.USER_FRAMES || {}).map(function (id) { return ['u:' + id, FS.USER_FRAMES[id].name, FS.USER_FRAMES[id].src]; }));
  }
  function buildFrames() {
    $('#mt-frames', root).innerHTML = frameOptions().map(function (f) { return '<button data-fr="' + esc(f[0]) + '">' + (f[2] ? '<img src="' + esc(f[2]) + '" alt="">' : '') + esc(f[1]) + '</button>'; }).join('');
  }
  function setFrames(list, v) {
    var ref = frameRef(v, $('#mt-fcol', root).value);
    list.forEach(function (p) { FS.setFrame(p, ref ? JSON.parse(JSON.stringify(ref)) : null, { quiet: true }); if (p.fit) FS.fitPhoto(p.doc, FS.img(p.src), p.fit); p.cache = {}; FS.snap(p); refreshTile(p); });
    FS.emit('doc');
  }
  $('#mt-frames', root).addEventListener('click', function (e) { var b = e.target.closest('[data-fr]'); if (!b) return; var l = targets(); Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { setFrames(l, b.dataset.fr); }); });
  $('#mt-fpng', root).addEventListener('change', function () { var f = this.files; this.value = ''; if (f && f.length && FS.addFrameFiles) Promise.resolve(FS.addFrameFiles(f)).then(function () { setTimeout(buildFrames, 400); }); });

  /* effects: the presets with small previews of the focused photo, and the instant styles */
  var fxCat = '';
  $('#mt-fxcat', root).innerHTML = FS.PRESET_CATS.map(function (c) { return '<button data-c="' + c[0] + '"' + (c[0] === fxCat ? ' class="on"' : '') + '>' + esc(c[1]) + '</button>'; }).join('');
  $('#mt-fxcat', root).addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (!b) return; fxCat = b.dataset.c; seg('#mt-fxcat', fxCat, 'c'); buildFx(); });
  var fxBase = null;
  function fxThumb(adj) {
    var p = focus(); if (!p || !FS.img(p.src)) return null;
    if (!fxBase || fxBase.src !== p.src) { var sm = FS.smallOf(p, 120), c = FS.canvas(sm.width || sm.naturalWidth, sm.height || sm.naturalHeight), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(sm, 0, 0, c.width, c.height); fxBase = { src: p.src, w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height) }; }
    var o = FS.canvas(fxBase.w, fxBase.h), ox = o.getContext('2d'), id = new ImageData(new Uint8ClampedArray(fxBase.d.data), fxBase.w, fxBase.h);
    FS.adjustPixels(id.data, fxBase.w, fxBase.h, adj, true); ox.putImageData(id, 0, 0); return o;
  }
  function buildFx() {
    var box = $('#mt-fx', root); if (!box) return;
    var list = FS.PRESETS.filter(function (q) { return !fxCat || q[3] === fxCat; });
    box.innerHTML = list.map(function (q) { return '<button data-pre="' + q[0] + '"><span></span>' + esc(q[1]) + '</button>'; }).join('');
    var i = 0, btns = $$('[data-pre]', box);
    (function step() { var t0 = performance.now(); while (i < btns.length && performance.now() - t0 < 12) { var q = FS.PRESETS.filter(function (x) { return x[0] === btns[i].dataset.pre; })[0], c = q && fxThumb(FS.presetAdj(q[2], 1)); if (c) btns[i].firstChild.appendChild(c); i++; } if (i < btns.length && box.isConnected) requestAnimationFrame(step); })();
    $('#mt-styles', root).innerHTML = '<button data-st="">בלי סגנון</button>' + FS.LOCAL_STYLES.filter(function (s) { return (FS.PRO_STYLES || []).indexOf(s[0]) >= 0; }).map(function (s) { return '<button data-st="' + s[0] + '">' + s[2] + ' ' + esc(s[1]) + '</button>'; }).join('');
  }
  $('#mt-fx', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-pre]'); if (!b) return; var q = FS.PRESETS.filter(function (x) { return x[0] === b.dataset.pre; })[0]; if (!q) return;
    var l = targets(); l.forEach(function (p) { p.doc.photo.adj = FS.presetAdj(q[2], 1); p.doc.photo.preset = q[0] === 'original' ? null : q[0]; }); redraw(l); syncSliders(); FS.toast('🎨 ' + q[1] + ' · ' + l.length + ' תמונות');
  });
  $('#mt-styles', root).addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (!b) return; var l = targets(); l.forEach(function (p) { p.doc.photo.style = b.dataset.st ? { id: b.dataset.st, amt: 100 } : null; }); redraw(l); });

  /* clipart: emoji stickers and a logo, as linked layers in a corner */
  var EMO = '❤️ 💖 💍 👰 🤵 🎂 🎈 🎉 🎁 🥂 🍾 🌹 🌸 🌼 🌿 ⭐ ✨ 🌟 💫 ☀️ 🌙 🌈 🦋 🕊️ 👑 🕶️ 🎩 💋 😍 🥳 😎 👶 🍼 🧸 ✡️ 🕎 🍷 🍯 🍎 ⚽ 🏆 📸 🎵 💯 💐'.split(' ');
  function emoRow(sel) { $(sel, root).innerHTML = EMO.map(function (e) { return '<button data-em="' + e + '">' + e + '</button>'; }).join(''); }
  emoRow('#mt-emo'); emoRow('#mt-oemo');
  function addClip(list, L0) {
    var link = 'mt-clip-' + FS.uid();
    list.forEach(function (p) { var d = p.doc, H = FS.hole(d), m = Math.min(d.w, d.h); var L = Object.assign({ id: FS.uid(), link: link, mtClip: true, x: H.x + H.w - m * 0.12, y: H.y + H.h - m * 0.12, r: 0, opacity: 1 }, L0); if (L.type === 'emoji') L.size = Math.round(m * 0.14); if (L.type === 'image') L.s = m * 0.22 / (L.w0 || 400); d.layers.push(L); });
    redraw(list);
  }
  $('#mt-emo', root).addEventListener('click', function (e) { var b = e.target.closest('[data-em]'); if (b) addClip(targets(), { type: 'emoji', ch: b.dataset.em }); });
  function logoFile(f, list) { FS.fileToDataURL(f).then(function (u) { return FS.loadImg(u); }).then(function (im) { addClip(list, { type: 'image', src: im.src, w0: Math.max(im.naturalWidth, im.naturalHeight) }); }); }
  $('#mt-logo', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) logoFile(f, targets()); });
  $('#mt-clipdel', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.layers = p.doc.layers.filter(function (L) { return !L.mtClip; }); }); redraw(l); });

  function saveOne(p) {
    var keep = S.cur; S.cur = idx(p); try { FS.saveCurrent(); } finally { S.cur = keep; }
  }

  /* ---------- עורך מלא: one photo, a folder browser, tools underneath ---------- */
  var cv = $('#mt-cv', root), cvx = cv.getContext('2d'), dk = 1, drag = null, selL = null, dfit = 'cover';
  function dcur() { return focus(); }
  function buildDesign() {
    var p = dcur(); if (p) { focusId = p.id; S.cur = idx(p); }
    $('#mt-dframe', root).innerHTML = frameOptions().map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[0] ? f[1] : 'מסגרת: בלי') + '</option>'; }).join('');
    var fr = p && p.doc.frame; $('#mt-dframe', root).value = !fr ? '' : (fr.kind === 'png' ? 'u:' : 'g:') + fr.id;
    $('#mt-dfilm', root).innerHTML = [['', 'אפקט פילם'], ['portra', 'פורטרה'], ['fuji', 'פוג׳י'], ['kodak', 'קודאק'], ['airy', 'אוורירי'], ['moody', 'מלנכולי'], ['sepia', 'ספיה'], ['bwwarm', 'שחור־לבן חם'], ['none', 'בלי']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    $('#mt-dpre', root).innerHTML = '<option value="">מסננים</option>' + FS.PRESETS.map(function (q) { return '<option value="' + q[0] + '">' + esc(q[1]) + '</option>'; }).join('');
    $('#mt-dsz', root).innerHTML = '<option value="">שינוי גודל</option>' + FS.mySizes().map(function (z) { return '<option value="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</option>'; }).join('');
    $('#mt-crops', root).innerHTML = FS.mySizes().map(function (z) { return '<button data-cz="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</button>'; }).join('') + '<button data-cz="orig">כמו המקור</button>';
    $('#mt-ofont', root).innerHTML = fonts;
    dsliders(); proj(); drawDesign();
  }
  var DSL = [['brightness', 'בהירות'], ['contrast', 'ניגודיות'], ['saturation', 'רוויה'], ['temp', 'חום'], ['highlights', 'אורות'], ['shadows', 'צללים']];
  function dsliders() {
    var p = dcur(), a = p ? p.doc.photo.adj : FS.ADJ0;
    $('#mt-dsl', root).innerHTML = DSL.map(function (s) { return '<label><span>' + s[1] + '</span><input type="range" min="-100" max="100" data-dk="' + s[0] + '" value="' + (a[s[0]] || 0) + '"></label>'; }).join('');
  }
  $('#mt-dsl', root).addEventListener('input', function (e) { var r = e.target.closest('[data-dk]'); var p = dcur(); if (!r || !p) return; p.doc.photo.adj[r.dataset.dk] = Number(r.value); drawDesign(true); });
  $('#mt-dsl', root).addEventListener('change', function () { var p = dcur(); if (p) { FS.snap(p); drawDesign(); } });
  function drawDesign(fast) {
    if (view !== 'design' || !on()) return;
    var p = dcur(), wrap = $('#mt-cvw', root), W = wrap.clientWidth || 800, H = wrap.clientHeight || 500;
    $('#mt-dname', root).textContent = p ? (p.name || '') + ' · ' + (idx(p) + 1) + '/' + S.photos.length : 'אין תמונה. פותחים תיקייה או מוסיפים תמונות.';
    $('#mt-dsize', root).textContent = p ? sizeTxt(p) + ' ס״מ' : '';
    if (!p) { cv.width = 10; cv.height = 10; return; }
    if (!FS.img(p.src)) { FS.loadImg(p.src).then(function () { drawDesign(); }); return; }
    var d = p.doc; dk = Math.min((W - 24) / d.w, (H - 24) / d.h);
    var dpr = window.devicePixelRatio || 1; cv.width = Math.round(d.w * dk * dpr); cv.height = Math.round(d.h * dk * dpr); cv.style.width = Math.round(d.w * dk) + 'px'; cv.style.height = Math.round(d.h * dk) + 'px';
    FS.draw(cvx, p, { scale: dk * dpr, max: fast ? 900 : 2200, fast: !!fast, sel: selL });
  }
  function proj() {
    var box = $('#mt-proj', root), f = dcur();
    box.innerHTML = S.photos.map(function (p) { return '<button class="mt-pj' + (f === p ? ' on' : '') + '" data-id="' + p.id + '" data-px="96"><span class="mt-th"></span><i>' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '</i></button>'; }).join('');
    $$('.mt-pj', box).forEach(function (b) { b.classList.add('mt-tile'); watch(b); });
  }
  $('#mt-proj', root).addEventListener('click', function (e) { var b = e.target.closest('.mt-pj'); if (!b) return; focusId = b.dataset.id; selL = null; buildDesign(); });
  function step(n) { var p = dcur(), i = idx(p) + n; if (i < 0 || i >= S.photos.length) return; focusId = S.photos[i].id; selL = null; buildDesign(); }
  $('#mt-prev', root).addEventListener('click', function () { step(-1); });
  $('#mt-next', root).addEventListener('click', function () { step(1); });
  window.addEventListener('resize', function () { if (on() && view === 'design') drawDesign(); });
  function docXY(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / dk, y: (e.clientY - r.top) / dk }; }
  cv.addEventListener('pointerdown', function (e) {
    var p = dcur(); if (!p) return; var q = docXY(e), L = FS.hitLayer(p.doc, q.x, q.y);
    selL = L || null; drag = { x: q.x, y: q.y, L: L, px: p.doc.photo.x, py: p.doc.photo.y, lx: L ? L.x : 0, ly: L ? L.y : 0 };
    cv.setPointerCapture(e.pointerId); drawDesign(true);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return; var p = dcur(), q = docXY(e), dx = q.x - drag.x, dy = q.y - drag.y;
    if (drag.L) { drag.L.x = drag.lx + dx; drag.L.y = drag.ly + dy; } else { p.doc.photo.x = drag.px + dx; p.doc.photo.y = drag.py + dy; }
    drawDesign(true);
  });
  cv.addEventListener('pointerup', function () { if (!drag) return; drag = null; var p = dcur(); if (p) { FS.snap(p); drawDesign(); } });
  cv.addEventListener('wheel', function (e) {
    var p = dcur(); if (!p) return; e.preventDefault(); var f = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    if (selL) { if (selL.type === 'text' || selL.type === 'emoji') selL.size = Math.max(6, selL.size * f); else if (selL.s) selL.s *= f; }
    else p.doc.photo.s *= f;
    drawDesign(true); clearTimeout(endT); endT = setTimeout(function () { FS.snap(p); drawDesign(); }, 300);
  }, { passive: false });
  function dchange(fn) { var p = dcur(); if (!p) return; return Promise.resolve(FS.loadImg(p.src)).then(function () { fn(p, p.doc.photo.adj); p.cache = {}; FS.snap(p); dsliders(); drawDesign(); }); }
  $$('[data-d]', root).forEach(function (b) { b.addEventListener('click', function () {
    var k = b.dataset.d;
    dchange(function (p, a) {
      var d = p.doc, im = FS.img(p.src);
      if (k === 'auto') p.doc.photo.adj = Object.assign({}, a, FS.autoAdjust(p));
      else if (k === 'sharp') a.sharpen = Math.min(100, (a.sharpen || 0) + 20);
      else if (k === 'clear') { a.clarity = Math.min(100, (a.clarity || 0) + 15); a.dehaze = Math.min(100, (a.dehaze || 0) + 10); }
      else if (k === 'back') { a.shadows = Math.min(100, (a.shadows || 0) + 35); a.highlights = Math.max(-100, (a.highlights || 0) - 20); a.exposure = Math.min(100, (a.exposure || 0) + 6); }
      else if (k === 'rl' || k === 'rr') { d.photo.r = ((d.photo.r || 0) + (k === 'rr' ? 90 : -90)) % 360; FS.fitPhoto(d, im, p.fit || dfit); }
      else if (k === 'fh') d.photo.fh = !d.photo.fh;
      else if (k === 'fv') d.photo.fv = !d.photo.fv;
    });
  }); });
  $('#mt-dframe', root).addEventListener('change', function () { var v = this.value; dchange(function (p) { FS.setFrame(p, frameRef(v, $('#mt-fcol', root).value), { quiet: true }); if (p.fit) FS.fitPhoto(p.doc, FS.img(p.src), p.fit); }); });
  $('#mt-dfilm', root).addEventListener('change', function () { var v = this.value; if (!v) return; dchange(function (p, a) { a.tone = v; }); this.value = ''; });
  $('#mt-dpre', root).addEventListener('change', function () { var v = this.value; if (!v) return; var q = FS.PRESETS.filter(function (x) { return x[0] === v; })[0]; dchange(function (p) { p.doc.photo.adj = FS.presetAdj(q[2], 1); p.doc.photo.preset = v === 'original' ? null : v; }); this.value = ''; });
  $('#mt-dsz', root).addEventListener('change', function () { var z = FS.sizeOf(this.value); this.value = ''; if (z) dchange(function (p) { toSize(p, z, p.fit || dfit, true); }); });
  $('#mt-crops', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-cz]'); if (!b) return;
    dchange(function (p) { if (b.dataset.cz === 'orig') { var im = FS.img(p.src); FS.applyFormat(p.doc, 'orig', im); if (p.doc.frame) FS.setFrame(p, p.doc.frame, { quiet: true, noTexts: true }); } else toSize(p, FS.sizeOf(b.dataset.cz), dfit, false); });
  });
  $('#mt-cfit', root).addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; dfit = b.dataset.f; seg('#mt-cfit', dfit, 'f'); dchange(function (p) { FS.fitPhoto(p.doc, FS.img(p.src), dfit); p.fit = dfit; }); });
  $('#mt-cface', root).addEventListener('click', function () { var p = dcur(); if (!p) return; FS.smartFit(p).then(function (n) { p.cache = {}; FS.snap(p); drawDesign(); FS.toast(n ? '🎯 ' + n + ' פנים במרכז' : 'לא נמצאו פנים'); }); });
  $('#mt-oadd', root).addEventListener('click', function () {
    var t = $('#mt-otext', root).value.trim(); if (!t) return FS.toast('כותבים טקסט');
    dchange(function (p) { var d = p.doc; var L = { id: FS.uid(), type: 'text', text: t, size: Math.round(Math.min(d.w, d.h) * 0.07), font: $('#mt-ofont', root).value, weight: 700, color: $('#mt-ocol', root).value, shadow: true, x: d.w / 2, y: d.h * 0.85, r: 0, opacity: 1, align: 'center', strokeW: 0, stroke: '#000000', spacing: 0 }; d.layers.push(L); selL = L; });
  });
  $('#mt-oemo', root).addEventListener('click', function (e) { var b = e.target.closest('[data-em]'); if (!b) return; dchange(function (p) { var d = p.doc, L = { id: FS.uid(), type: 'emoji', ch: b.dataset.em, size: Math.round(Math.min(d.w, d.h) * 0.14), x: d.w / 2, y: d.h / 2, r: 0, opacity: 1 }; d.layers.push(L); selL = L; }); });
  $('#mt-ologo', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; var p = dcur(); if (f && p) logoFile(f, [p]); setTimeout(drawDesign, 300); });
  $('#mt-odel', root).addEventListener('click', function () { if (!selL) return FS.toast('לוחצים על עצם בתמונה כדי לבחור אותו'); var L = selL; dchange(function (p) { p.doc.layers = p.doc.layers.filter(function (x) { return x !== L; }); selL = null; }); });
  $$('.mt-dtools [data-dt]', root).forEach(function (b) { b.addEventListener('click', function () { $$('.mt-dtools [data-dt]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); $$('[data-dp]', root).forEach(function (x) { x.hidden = x.dataset.dp !== b.dataset.dt; }); }); });
  $('#mt-dsave', root).addEventListener('click', function () { var p = dcur(); if (p) saveOne(p); });
  $('#mt-dprint', root).addEventListener('click', function () { var p = dcur(); if (p) openPrint([p]); });
  function hist(fn) { var p = dcur(); if (!p) return; var keep = S.marked; S.marked = {}; S.cur = idx(p); try { fn(); } finally { S.marked = keep; } selL = null; dsliders(); drawDesign(); }
  $('#mt-dundo', root).addEventListener('click', function () { hist(FS.undo); });
  $('#mt-dredo', root).addEventListener('click', function () { hist(FS.redo); });
  $('#mt-dall', root).addEventListener('click', function () { if (confirm('לבטל את כל העריכות של התמונה?')) hist(FS.resetEdits); });

  /* the folder browser: subfolders open in place, the photos in a folder show as thumbnails; a click brings one in */
  var dirRoot = null;
  $('#mt-dir', root).addEventListener('click', function () {
    if (!window.showDirectoryPicker) { pickFolder(); return; }
    window.showDirectoryPicker({ id: 'frame-studio-photos' }).then(function (d) { dirRoot = d; $('#mt-tree', root).innerHTML = ''; tree($('#mt-tree', root), d, 0); listDir(d); }).catch(function () {});
  });
  function tree(box, dir, depth) {
    var row = document.createElement('div'); row.className = 'mt-node'; row.style.paddingInlineStart = depth * 14 + 'px';
    row.innerHTML = '<button class="mt-tw">▸</button><button class="mt-dn">📁 ' + esc(dir.name) + '</button><div class="mt-kids" hidden></div>'; box.appendChild(row);
    var kids = row.lastChild, loaded = false;
    row.children[0].addEventListener('click', function () {
      kids.hidden = !kids.hidden; row.children[0].textContent = kids.hidden ? '▸' : '▾'; if (loaded) return; loaded = true;
      var it = dir.values(), subs = [];
      (function next() { it.next().then(function (r) { if (r.done) { subs.sort(function (a, b) { return a.name.localeCompare(b.name, 'he', { numeric: true }); }).forEach(function (s) { tree(kids, s, depth + 1); }); return; } if (r.value.kind === 'directory') subs.push(r.value); next(); }); })();
    });
    row.children[1].addEventListener('click', function () { $$('.mt-dn.on', root).forEach(function (x) { x.classList.remove('on'); }); this.classList.add('on'); listDir(dir); });
  }
  var urls = [];
  function listDir(dir) {
    var box = $('#mt-flist', root); box.innerHTML = '<p class="mt-hint">טוען…</p>'; urls.forEach(URL.revokeObjectURL); urls = [];
    filesOf(dir, false).then(function (files) {
      box.innerHTML = files.length ? '' : '<p class="mt-hint">אין כאן תמונות</p>';
      files.slice(0, 400).forEach(function (f) {
        var b = document.createElement('button'); b.className = 'mt-fi'; b.title = f.name;
        if (IMG_RE.test(f.name) && !/\.(heic|heif)$/i.test(f.name)) { var u = URL.createObjectURL(f); urls.push(u); b.innerHTML = '<img loading="lazy" decoding="async" src="' + u + '" alt=""><i>' + esc(f.name) + '</i>'; }
        else b.innerHTML = '<span>RAW</span><i>' + esc(f.name) + '</i>';
        b.addEventListener('click', function () { var n = S.photos.length; FS.addFiles([f]); var t = setInterval(function () { if (S.photos.length > n) { clearInterval(t); focusId = S.photos[S.photos.length - 1].id; buildDesign(); } }, 120); setTimeout(function () { clearInterval(t); }, 30000); });
        box.appendChild(b);
      });
      if (files.length > 1) { var all = document.createElement('button'); all.className = 'mt-btn'; all.textContent = '➕ כל ' + files.length + ' התמונות לעבודה'; all.addEventListener('click', function () { FS.addFiles(files); }); box.insertBefore(all, box.firstChild); }
    });
  }

  /* ---------- AI ---------- */
  var LOCAL = [
    ['auto', '✨ שיפור אוטומטי'], ['light', '💡 תאורת פנים'], ['skin', '🙂 ריטוש עור'], ['center', '🎯 מרכוז לפי הפנים'], ['full', '🌟 שיפור מלא (תאורה + ריטוש + מרכוז)'],
    ['blur', '🌫️ טשטוש רקע'], ['white', '⬜ רקע לבן'], ['bw', '⚫ רקע שחור־לבן'], ['cut', '✂️ הסרת רקע (שקוף)'], ['nobg', '↩ רקע מקורי'],
    ['faceblur', '🫥 טשטוש פנים'], ['check', '👁️ בדיקת עיניים וחדות'], ['best', '🏆 סימון הטובות']
  ];
  function aiList() { var m = marked(); if (m.length) return m; var f = focus(); return f ? [f] : []; }
  function aiTarget() { var n = aiList().length; $('#mt-ai-target', root).textContent = n ? 'חל על ' + n + (n > 1 ? ' התמונות המסומנות' : ' תמונה (המודגשת)') + '. לסימון כמה, לוחצים ✓ במסך הראשי.' : 'אין תמונות עדיין.'; }
  function buildAI() {
    aiTarget();
    $('#mt-ai-local', root).innerHTML = LOCAL.map(function (x) { return '<button data-la="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    function cards(list, sel, kind) { $(sel, root).innerHTML = list.map(function (v, i) { return '<button data-ai="' + kind + ':' + i + '"><i>' + (kind === 'st' ? v[2] : v[1]) + '</i><span>' + esc(kind === 'st' ? v[1] : v[0]) + '</span></button>'; }).join(''); }
    cards(FS.AI_EDITS || [], '#mt-ai-edits', 'ed'); cards(FS.AI_VIRAL || [], '#mt-ai-viral', 'vi'); cards(FS.AI_STYLES || [], '#mt-ai-styles', 'st');
    $('#mt-dai', root).innerHTML = $('#mt-ai-local', root).innerHTML;
    engines();
  }
  function engines() {
    var box = $('#mt-ai-eng', root);
    (FS.aiEngines ? FS.aiEngines() : Promise.resolve({})).then(function (av) {
      var cur = FS.aiEngine(), keys = [''].concat(['gemini', 'flux', 'free', 'openai'].filter(function (k) { return av[k]; })); if (FS.localAI) keys.push('local');
      box.innerHTML = keys.map(function (k) { return '<button data-eng="' + k + '"' + (k === cur ? ' class="on"' : '') + '>' + esc((FS.ENGINE_NAMES || {})[k] || k || 'אוטומטי') + '</button>'; }).join('');
    });
  }
  $('#mt-ai-eng', root).addEventListener('click', function (e) { var b = e.target.closest('[data-eng]'); if (!b) return; if (b.dataset.eng === 'local' && !(FS.localAI && FS.localAI.isReady())) { FS.toast('מנוע ה־AI המקומי עוד לא מותקן'); if (FS.localAI) FS.localAI.open(); return; } FS.aiEngine(b.dataset.eng); engines(); });
  function after(list) { list.forEach(function (p) { p.cache = {}; p._mc = null; }); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); refreshAll(); }
  function runAI(prompt, label) { var l = aiList(); if (!l.length) return FS.toast('אין תמונות'); Promise.resolve(FS.runAI(prompt, label, l)).then(function () { after(l); }); }
  $('.mt-ai', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-ai]'); if (!b) return; var k = b.dataset.ai.split(':'), i = Number(k[1]);
    if (k[0] === 'ed') runAI(FS.AI_EDITS[i][2], FS.AI_EDITS[i][0]);
    else if (k[0] === 'vi') runAI(FS.AI_VIRAL[i][2] + '.' + (FS.AI_KEEP_FREE || ''), FS.AI_VIRAL[i][0]);
    else if (k[0] === 'st') runAI(FS.AI_STYLES[i][3] + (FS.AI_KEEP || ''), FS.AI_STYLES[i][1]);
  });
  $('#mt-ai-go', root).addEventListener('click', function () { var t = $('#mt-ai-text', root).value.trim(); if (!t) return FS.toast('כותבים מה לעשות'); runAI('Edit this photo: ' + t + '.' + (FS.AI_KEEP || ''), 'עריכת AI'); });
  $('#mt-ai-back', root).addEventListener('click', function () { var l = aiList(), n = 0; l.forEach(function (p) { if (FS.unstyleStep(p)) n++; }); after(l); FS.toast(n ? '↶ בוטל ב־' + n + ' תמונות' : 'אין עיצוב AI לבטל'); });
  $('#mt-ai-orig', root).addEventListener('click', function () { var l = aiList(), n = 0; l.forEach(function (p) { if (FS.unstyle(p)) n++; }); after(l); FS.toast(n ? '↩ המקור הוחזר ל־' + n + ' תמונות' : 'אין מה להחזיר'); });
  /* the tools that run here, one photo after another, with a stop button */
  function local(k, list) {
    if (!list.length) return FS.toast('אין תמונות');
    if (k === 'best') { if (!FS.scoreAll) return; FS.busy('בוחר את הטובות…'); return Promise.resolve(FS.scoreAll(list)).then(function () { FS.busy(); S.marked = {}; list.forEach(function (p) { if (p.rate && !(p.rate.why || []).length && p.rate.score >= 55) S.marked[p.id] = true; }); after(list); FS.toast('🏆 ' + marked().length + ' תמונות טובות סומנו'); }, function () { FS.busy(); }); }
    var stop = false, done = 0, bad = 0;
    return list.reduce(function (ch, p, i) {
      return ch.then(function () {
        if (stop) return;
        FS.busy('🖥️ ' + (i + 1) + ' מתוך ' + list.length + '…', function () { stop = true; });
        return FS.loadImg(p.src).then(function () { return one(k, p); }).then(function (r) { if (r === false) bad++; else done++; }, function () { bad++; });
      });
    }, Promise.resolve()).then(function () {
      FS.busy(); after(list);
      if (k === 'check') { var weak = list.filter(function (p) { return p.quality && !p.quality.ok; }); S.marked = {}; weak.forEach(function (p) { S.marked[p.id] = true; }); refreshAll(); FS.toast(weak.length ? '👁️ ' + weak.length + ' תמונות עם עיניים עצומות או טשטוש סומנו' : '👁️ כל התמונות תקינות', 6000); return; }
      FS.toast((stop ? '⏹ נעצר · ' : '✔ ') + done + ' תמונות' + (bad ? ' · ' + bad + ' בלי פנים או שלא הצליחו' : ''), 5000);
    });
  }
  function bgSet(p, mode, extra) { return FS.ensureMask(p).then(function () { p.doc.photo.bg = Object.assign({ mode: 'none', color: '#ffffff', src: '' }, p.doc.photo.bg, extra || {}, { mode: mode }); FS.snap(p); }); }
  function one(k, p) {
    var a = p.doc.photo.adj;
    if (k === 'auto') { p.doc.photo.adj = Object.assign({}, a, FS.autoAdjust(p)); FS.snap(p); return Promise.resolve(); }
    if (k === 'light') return FS.faceLight(p).then(function (ok) { FS.snap(p); return ok; });
    if (k === 'skin') return FS.findFaces(p, true).then(function (f) { if (!f.length) return false; p.doc.photo.skin = { amt: 40, faces: f.map(function (x) { return { x: x.x, y: x.y, w: x.w, h: x.h }; }) }; FS.snap(p); });
    if (k === 'center') return FS.smartFit(p, true).then(function (n) { FS.snap(p); return n ? true : false; });
    if (k === 'full') return FS.faceLight(p).then(function (ok) { if (!ok) return false; p.doc.photo.skin = { amt: 40, faces: p.faces.map(function (x) { return { x: x.x, y: x.y, w: x.w, h: x.h }; }) }; a.sharpen = Math.max(a.sharpen || 0, 15); return FS.smartFit(p, true).then(function () { FS.snap(p); }); });
    if (k === 'blur') return bgSet(p, 'blur', { amount: 45 });
    if (k === 'white') return bgSet(p, 'color', { color: '#ffffff' });
    if (k === 'bw') return bgSet(p, 'bw');
    if (k === 'cut') return bgSet(p, 'remove');
    if (k === 'nobg') { p.doc.photo.bg = Object.assign({}, p.doc.photo.bg, { mode: 'none' }); FS.snap(p); return Promise.resolve(); }
    if (k === 'faceblur') return FS.findFaces(p, true).then(function (f) { if (!f.length) return false; p.doc.photo.blurs = f.map(function (x) { return { x: x.x - x.w * 0.15, y: x.y - x.h * 0.3, w: x.w * 1.3, h: x.h * 1.45 }; }); FS.snap(p); });
    if (k === 'check') return FS.quality(p);
    return Promise.resolve(false);
  }
  $('#mt-ai-local', root).addEventListener('click', function (e) { var b = e.target.closest('[data-la]'); if (b) local(b.dataset.la, aiList()); });
  $('#mt-dai', root).addEventListener('click', function (e) { var b = e.target.closest('[data-la]'); var p = dcur(); if (b && p) Promise.resolve(local(b.dataset.la, [p])).then(function () { drawDesign(); }); });

  /* ---------- print ---------- */
  var PS = Object.assign({ paper: '10x15', dpi: 300, mode: 'real', margin: 0, marginOn: false, marks: false, pfit: 'cover', which: 'auto' }, lsj('fs-mate-print', {}));
  function printList(which, only) {
    if (only) return only;
    var l = which === 'all' ? S.photos.slice() : which === 'todo' ? S.photos.filter(function (p) { return !p.printed; }) : which === 'sel' ? marked() : (marked().length ? marked() : S.photos.slice());
    return l.filter(function (p) { return copies(p) > 0; });
  }
  /* page size: each copy alone on a sheet, filling it (crop) or whole inside it (fit); turned to the sheet's direction */
  function pagePlan(list, paperId, pfit, marks) {
    var paper = FS.PAPERS.filter(function (x) { return x[0] === paperId; })[0] || FS.PAPERS[0], pw = paper[2], ph = paper[3], pages = [], total = 0;
    list.forEach(function (p) {
      var n = copies(p), mm = FS.mmOf(p.doc), rot = (mm[0] > mm[1]) !== (pw > ph) && Math.abs(mm[0] - mm[1]) > 1, iw = rot ? mm[1] : mm[0], ih = rot ? mm[0] : mm[1];
      for (var i = 0; i < n; i++) {
        var w = pw, h = ph, cover = pfit === 'cover';
        if (!cover) { var k = Math.min(pw / iw, ph / ih); w = iw * k; h = ih * k; }
        pages.push([{ p: p, x: (pw - w) / 2, y: (ph - h) / 2, w: w, h: h, rot: rot, cover: cover }]); total++;
      }
    });
    return { paper: paper, pages: pages, total: total, marks: marks };
  }
  function makePlan(o, only) {
    var list = printList(o.which, only);
    var plan = o.mode === 'page' ? pagePlan(list, o.paper, o.pfit, o.marks)
      : FS.planPrint({ list: list, paper: o.paper, layout: 'fill', margin: o.marginOn ? o.margin : 0, gap: o.marginOn ? 2 : 0, copies: 1, marks: o.marks });
    plan.dpi = Number(o.dpi) || 300; return plan;
  }
  function drawPv(plan, page, maxW, maxH) {
    var pw = plan.paper[2], ph = plan.paper[3], k = Math.min(maxW / pw, maxH / ph), c = FS.canvas(pw * k, ph * k), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    (page || []).forEach(function (it) {
      var t = it.p._pv && it.p._pvs === sig(it.p, 360) ? it.p._pv : (it.p._pv = pageCanvas(it.p, 360), it.p._pvs = sig(it.p, 360), it.p._pv);
      x.save(); x.beginPath(); x.rect(it.x * k, it.y * k, it.w * k, it.h * k); x.clip();
      x.translate((it.x + it.w / 2) * k, (it.y + it.h / 2) * k); if (it.rot) x.rotate(Math.PI / 2);
      var w = (it.rot ? it.h : it.w) * k, h = (it.rot ? it.w : it.h) * k;
      if (it.cover) { var s = Math.max(w / t.width, h / t.height); x.drawImage(t, -t.width * s / 2, -t.height * s / 2, t.width * s, t.height * s); } else x.drawImage(t, -w / 2, -h / 2, w, h);
      x.restore();
      if (plan.marks) { x.strokeStyle = '#8a8a8a'; x.setLineDash([4, 3]); x.strokeRect(it.x * k, it.y * k, it.w * k, it.h * k); x.setLineDash([]); }
    });
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    return c;
  }
  function openPrint(only) {
    if (!S.photos.length) return FS.toast('אין תמונות להדפסה');
    var pr = FS.printers ? FS.printers() : { up: false, list: [] };
    var printers = (pr.up ? pr.list : []).map(function (x) { return '<option value="' + esc(x.name) + '"' + (pr.chosen && pr.chosen.name === x.name ? ' selected' : '') + '>' + esc(x.name) + (x.default ? ' ★' : '') + '</option>'; }).join('') + '<option value=""' + (pr.chosen ? '' : ' selected') + '>חלון ההדפסה של המחשב</option>';
    var papers = FS.PAPERS.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + ' · ' + trim(x[2] / 25.4) + '×' + trim(x[3] / 25.4) + '״</option>'; }).join('');
    var b = FS.dialog('🖨️ הדפסה', '<div class="mp"><div class="mp-side">' +
      '<label>מדפסת</label><select id="mp-printer">' + printers + '</select>' + (pr.up ? '' : '<p class="mt-hint">לבחירת מדפסת ישירה מפעילים את "מנהל המדפסות" (שמירה והדפסה ← המדפסות במחשב).</p>') +
      '<label>גודל נייר</label><select id="mp-paper">' + papers + '</select>' +
      '<label>DPI</label><select id="mp-dpi"><option>300</option><option>600</option></select>' +
      '<fieldset><legend>אפשרויות גודל</legend>' +
        '<label class="mt-chk-l"><input type="radio" name="mp-mode" value="real"> גודל אמיתי</label>' +
        '<div class="mp-in"><label class="mt-chk-l"><input type="checkbox" id="mp-mon"> שוליים</label><select id="mp-margin"><option value="2">2 מ״מ</option><option value="3">3 מ״מ</option><option value="5">5 מ״מ</option><option value="8">8 מ״מ</option></select>' +
        '<label>סימוני חיתוך</label><select id="mp-marks"><option value="0">בלי</option><option value="1">קווי חיתוך</option></select></div>' +
        '<label class="mt-chk-l"><input type="radio" name="mp-mode" value="page"> גודל עמוד</label>' +
        '<div class="mp-in"><label class="mt-chk-l"><input type="radio" name="mp-fit" value="contain"> להתאים</label><label class="mt-chk-l"><input type="radio" name="mp-fit" value="cover"> לחתוך</label></div></fieldset>' +
      (only ? '' : '<label>אילו תמונות</label><select id="mp-which"><option value="auto">המסומנות (או כולן)</option><option value="all">כולן</option><option value="todo">שעוד לא הודפסו</option><option value="sel">רק המסומנות</option></select>') +
      '<div class="mp-sum" id="mp-sum"></div></div>' +
      '<div class="mp-pv"><div class="mp-cv" id="mp-cv"></div><div class="mp-nav"><button data-nav="first">|&lt;</button><button data-nav="prev">&lt;</button><b id="mp-pg">1 / 1</b><button data-nav="next">&gt;</button><button data-nav="last">&gt;|</button></div></div></div>' +
      '<div class="mp-foot"><button class="mt-btn" id="mp-cur">הדפסת העמוד הנוכחי</button><button class="mt-btn primary" id="mp-go">🖨️ הדפסה</button><button class="mt-btn" id="mp-save">💾 שמירת הגדרות</button><button class="mt-btn" id="mp-cancel">ביטול</button></div>', true);
    b.classList.add('mp-dlg');
    $('#mp-paper', b).value = PS.paper; $('#mp-dpi', b).value = String(PS.dpi); $('#mp-margin', b).value = String(PS.margin || 3); $('#mp-mon', b).checked = !!PS.marginOn; $('#mp-marks', b).value = PS.marks ? '1' : '0';
    $$('[name=mp-mode]', b).forEach(function (r) { r.checked = r.value === PS.mode; }); $$('[name=mp-fit]', b).forEach(function (r) { r.checked = r.value === PS.pfit; });
    if ($('#mp-which', b)) $('#mp-which', b).value = PS.which || 'auto';
    var plan = null, pg = 0;
    function read() {
      var mode = ($('[name=mp-mode]:checked', b) || {}).value || 'real';
      return { paper: $('#mp-paper', b).value, dpi: Number($('#mp-dpi', b).value), mode: mode, margin: Number($('#mp-margin', b).value), marginOn: $('#mp-mon', b).checked, marks: $('#mp-marks', b).value === '1', pfit: ($('[name=mp-fit]:checked', b) || {}).value || 'cover', which: $('#mp-which', b) ? $('#mp-which', b).value : 'auto' };
    }
    function paint() {
      var o = read(); $$('.mp-in', b)[0].classList.toggle('off', o.mode !== 'real'); $$('.mp-in', b)[1].classList.toggle('off', o.mode !== 'page');
      plan = makePlan(o, only); pg = Math.min(pg, Math.max(0, plan.pages.length - 1));
      var box = $('#mp-cv', b); box.innerHTML = ''; box.appendChild(drawPv(plan, plan.pages[pg], Math.max(260, box.clientWidth - 20 || 420), Math.max(320, (innerHeight * 0.62) | 0)));
      $('#mp-pg', b).textContent = (plan.pages.length ? pg + 1 : 0) + ' / ' + plan.pages.length;
      $('#mp-sum', b).innerHTML = '<b>' + plan.total + '</b> הדפסים · <b>' + plan.pages.length + '</b> דפים' + (plan.pages[0] ? ' · ' + plan.pages[0].length + ' בדף' : '');
      $('#mp-go', b).disabled = $('#mp-cur', b).disabled = !plan.total;
    }
    $$('select, input', $('.mp-side', b)).forEach(function (el) { el.addEventListener('change', function () { if (el.id === 'mp-printer' && FS.choosePrinter) FS.choosePrinter(el.value); paint(); }); });
    $('.mp-nav', b).addEventListener('click', function (e) { var n = e.target.closest('[data-nav]'); if (!n || !plan) return; var k = n.dataset.nav, L = plan.pages.length - 1; pg = k === 'first' ? 0 : k === 'last' ? L : FS.clamp(pg + (k === 'next' ? 1 : -1), 0, Math.max(0, L)); paint(); });
    function go(one) {
      var o = read(); PS = o; var pl = plan; if (one) pl = { paper: plan.paper, pages: [plan.pages[pg]], total: plan.pages[pg].length, marks: plan.marks, dpi: plan.dpi };
      FS.closeDialog(); Promise.resolve(FS.doPrint(pl)).then(function () { setTimeout(refreshAll, 400); });
    }
    $('#mp-go', b).addEventListener('click', function () { go(false); });
    $('#mp-cur', b).addEventListener('click', function () { go(true); });
    $('#mp-save', b).addEventListener('click', function () { PS = read(); ls('fs-mate-print', JSON.stringify(PS)); FS.toast('💾 ההגדרות נשמרו'); });
    $('#mp-cancel', b).addEventListener('click', function () { FS.closeDialog(); });
    requestAnimationFrame(paint);
  }

  /* ---------- keys, events, start ---------- */
  window.addEventListener('keydown', function (e) {
    if (!on() || ($('#dlg') && $('#dlg').open) || document.body.classList.contains('gated')) return;
    var typing = /input|textarea|select/i.test(e.target.tagName || ''), k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (typing) { e.stopImmediatePropagation(); return; }
    if (mod && k === 'a') { e.preventDefault(); shown().forEach(function (p) { mark(p, true); }); refreshAll(); }
    else if (mod && k === 'p') { e.preventDefault(); openPrint(); }
    else if (mod && k === 'z') { e.preventDefault(); if (view === 'design') hist(FS.undo); else { FS.undo(); refreshAll(); } }
    else if (mod && k === 'y') { e.preventDefault(); if (view === 'design') hist(FS.redo); else { FS.redo(); refreshAll(); } }
    else if (k === 'escape') { S.marked = {}; refreshAll(); }
    else if (view === 'design' && (k === 'arrowleft' || k === 'arrowright')) step(k === 'arrowleft' ? 1 : -1);
    else if (view === 'design' && (k === 'delete' || k === 'backspace') && selL) $('#mt-odel', root).click();
    e.stopImmediatePropagation();
  }, true);
  FS.on('photos-added', function () { if (on()) refreshAll(); else if (ls('fs-mate') !== 'off') open('main'); });
  FS.on('print-job', function () { if (on()) setTimeout(refreshAll, 300); });
  FS.on('sizes', function () { if (on() && view === 'design') buildDesign(); });
  /* the workspace is where the studio opens, unless the owner closed it last time */
  if (ls('fs-mate') !== 'off') open('main');
})();
