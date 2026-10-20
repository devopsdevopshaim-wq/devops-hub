/* The photos screen: every photo spread out on the main screen in a big grid. A click picks a photo (Shift for a range),
   and the picked ones go to the editing screen together (batch editing), or get a filter, a style, a size or copies
   right here. The grid can show only the picked, the edited, the untouched, the failed ones, or one size. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc;
  var show = 'all', sizeF = '', last = -1, mode = 'grid', view = FS.prefs.gridView || 'whole';
  try { var z0 = Number(FS.prefs.gridZoom); if (z0 >= 120 && z0 <= 420) $('#gv-zoom').value = z0; } catch (e) { /* ignore */ }

  function sizeKey(p) { var mm = FS.mmOf(p.doc); return (mm[0] / 10).toFixed(1) + '×' + (mm[1] / 10).toFixed(1); }
  function edited(p) {
    var ph = p.doc.photo, a = ph.adj || {}, z = FS.ADJ0 || {};
    var adj = Object.keys(a).some(function (k) { return a[k] !== z[k] && a[k] && a[k] !== 'none'; });
    return !!(adj || ph.preset || ph.style || p.origSrc || p.doc.frame || (p.doc.layers || []).some(function (L) { return !L.credit; }) || (ph.bg && ph.bg.mode && ph.bg.mode !== 'none'));
  }
  FS.isEdited = edited;
  function visible(p) {
    if (sizeF && sizeKey(p) !== sizeF) return false;
    if (show === 'marked') return !!S.marked[p.id];
    if (show === 'edited') return edited(p);
    if (show === 'plain') return !edited(p);
    if (show === 'bad') return !!(p.quality && !p.quality.ok);
    return true;
  }

  /* ---------- switching between the photos screen and the editing screen ---------- */
  function setMode(m) {
    mode = S.photos.length ? m : 'edit';
    var g = mode === 'grid';
    $('#gv').hidden = !g; $('#wrap').hidden = g; $('#strip').hidden = g; $('#to-grid').hidden = g || !S.photos.length;
    $$('.stagebar > .seg, .stagebar .info').forEach(function (e) { e.hidden = g; });
    if (g) { $('#stripbar').hidden = true; $('#batch-banner').hidden = true; S.onlyMarked = false; build(); }
    else { FS.buildStrip(); FS.render(); }
    document.body.classList.toggle('grid-mode', g);
  }
  FS.showGrid = function () { setMode('grid'); };
  FS.gridMode = function () { return mode === 'grid' && !$('#gv').hidden; };
  $('#to-grid').addEventListener('click', function () { setMode('grid'); });
  /* the picked photos go to the editing screen together: the first is on screen, every edit reaches all of them */
  function edit(i) {
    var m = FS.marked();
    if (i == null && !m.length) return FS.toast('בוחרים תמונה אחת או יותר');
    if (i != null && !S.marked[S.photos[i].id]) { S.marked = {}; }
    var first = i != null ? i : S.photos.indexOf(m[0]);
    S.onlyMarked = FS.marked().length > 1; S.batch = undefined;
    setMode('edit'); FS.select(first); FS.buildStrip();
    if (FS.marked().length > 1) FS.toast('✏️ ' + FS.marked().length + ' תמונות בעריכה: כל שינוי חל על כולן. "▦ כל התמונות" חוזר למסך התמונות.', 5000);
  }
  $('#gv-edit').addEventListener('click', function () { edit(); });

  /* ---------- the grid ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); } }); }, { root: $('#gv-tiles'), rootMargin: '400px' }) : null;
  /* the whole photo, never cropped: the source scaled down with its colour edits and style, kept per photo until it changes
     (so scrolling a big event stays smooth). "כמו בהדפסה" shows the page as it will print instead. */
  function wholeThumb(p, size) {
    var ph = p.doc.photo, key = [p.src, size, JSON.stringify(ph.adj), JSON.stringify(ph.style || 0)].join('|');
    if (p._gt && p._gt.key === key) return p._gt.c;
    var im = FS.img(p.src), k = size / Math.max(im.naturalWidth, im.naturalHeight), c = FS.canvas(Math.max(1, im.naturalWidth * k), Math.max(1, im.naturalHeight * k)), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    try { var d = x.getImageData(0, 0, c.width, c.height); FS.adjustPixels(d.data, c.width, c.height, ph.adj, true); if (ph.style && FS.applyStyle) FS.applyStyle(d.data, c.width, c.height, ph.style, true); x.putImageData(d, 0, 0); } catch (e) { /* plain */ }
    p._gt = { key: key, c: c }; return c;
  }
  function draw(t) {
    var p = S.photos[Number(t.dataset.i)]; if (!p || !FS.img(p.src)) return;
    var size = Math.round(Number($('#gv-zoom').value) * 1.6), box = t.querySelector('.gt-img'), c = view === 'whole' ? wholeThumb(p, size) : FS.thumbOf(p, size);
    if (view === 'whole') { var cl = FS.canvas(c.width, c.height); cl.getContext('2d').drawImage(c, 0, 0); c = cl; }
    box.innerHTML = ''; box.appendChild(c);
  }
  function meta(p) {
    var bits = [sizeKey(p) + ' ס״מ'];
    if (p.doc.photo.preset) { var q = (FS.PRESETS || []).filter(function (x) { return x[0] === p.doc.photo.preset; })[0]; bits.push('🎨 ' + (q ? q[1] : 'פילטר')); }
    if (p.doc.photo.style) { var st = (FS.LOCAL_STYLES || []).filter(function (x) { return x[0] === p.doc.photo.style.id; })[0]; bits.push('🖌️ ' + (st ? st[1] : '')); }
    if (p.origSrc) bits.push('🤖'); if (p.doc.frame) bits.push('🖼️'); if (p.copies > 1) bits.push('×' + p.copies);
    if (p.quality && !p.quality.ok) bits.push('⚠');
    return bits.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('');
  }
  function build() {
    var box = $('#gv-tiles'); box.innerHTML = ''; box.style.setProperty('--gz', $('#gv-zoom').value + 'px');
    var frag = document.createDocumentFragment(), n = 0;
    S.photos.forEach(function (p, i) {
      if (!visible(p)) return; n++;
      var t = document.createElement('div'); t.className = 'gt' + (S.marked[p.id] ? ' on' : ''); t.dataset.i = i; t.tabIndex = 0; t.title = p.name + ' · לחיצה כפולה לעריכה';
      t.innerHTML = '<div class="gt-img"></div><span class="gt-ck" aria-hidden="true">✓</span><span class="gt-n">' + (i + 1) + '</span><button class="gt-ed" title="עריכת התמונה הזו">✏️</button><div class="gt-meta">' + meta(p) + '</div>';
      t.addEventListener('click', function (e) { if (e.target.closest('.gt-ed')) return; pick(i, e.shiftKey); });
      t.addEventListener('dblclick', function () { edit(i); });
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter') edit(i); if (e.key === ' ') { e.preventDefault(); pick(i); } });
      t.querySelector('.gt-ed').addEventListener('click', function (e) { e.stopPropagation(); edit(i); });
      frag.appendChild(t); if (io) io.observe(t); else draw(t);
    });
    box.appendChild(frag);
    if (!n) box.innerHTML = '<p class="gv-empty">' + (S.photos.length ? 'אין תמונות שמתאימות לסינון.' : 'אין עדיין תמונות.') + '</p>';
    sizes(); bar();
  }
  FS.buildGrid = function () { if (FS.gridMode()) build(); };
  function pick(i, range) {
    if (range && last > -1) { var a = Math.min(last, i), z = Math.max(last, i); for (var k = a; k <= z; k++) if (visible(S.photos[k])) S.marked[S.photos[k].id] = true; }
    else { var id = S.photos[i].id; if (S.marked[id]) delete S.marked[id]; else S.marked[id] = true; }
    last = i;
    $$('#gv-tiles .gt').forEach(function (t) { t.classList.toggle('on', !!S.marked[S.photos[Number(t.dataset.i)].id]); });
    if (show === 'marked') build(); else bar();
  }
  function bar() {
    var m = FS.marked().length, tot = S.photos.length, vis = S.photos.filter(visible).length;
    $('#gv-count').textContent = tot + ' תמונות' + (vis !== tot ? ' · מוצגות ' + vis : '');
    $('#gv-sel').textContent = m ? m + ' נבחרו' : 'בוחרים תמונות: לחיצה מסמנת, Shift לטווח, לחיצה כפולה לעריכה';
    ['#gv-edit', '#gv-filter', '#gv-style', '#gv-fmt', '#gv-copies-go', '#gv-del'].forEach(function (s) { $(s).disabled = !m; });
    $('#gv-edit').textContent = m > 1 ? '✏️ עריכת ' + m + ' התמונות' : '✏️ למסך העריכה';
    $('#gv-act').classList.toggle('has', !!m);
  }
  function sizes() {
    var have = {}; S.photos.forEach(function (p) { have[sizeKey(p)] = (have[sizeKey(p)] || 0) + 1; });
    var sel = $('#gv-size'); if (sizeF && !have[sizeF]) sizeF = '';
    sel.innerHTML = '<option value="">כל הגדלים</option>' + Object.keys(have).sort().map(function (k) { return '<option value="' + k + '"' + (k === sizeF ? ' selected' : '') + '>' + k + ' ס״מ (' + have[k] + ')</option>'; }).join('');
  }
  $$('#gv-show button').forEach(function (b) { b.addEventListener('click', function () { show = b.dataset.show; $$('#gv-show button').forEach(function (x) { x.classList.toggle('on', x === b); }); build(); }); });
  $('#gv-size').addEventListener('change', function () { sizeF = this.value; build(); });
  $('#gv-all').addEventListener('click', function () { S.photos.forEach(function (p) { if (visible(p)) S.marked[p.id] = true; }); build(); });
  $('#gv-none').addEventListener('click', function () { S.marked = {}; build(); });
  $('#gv-inv').addEventListener('click', function () { S.photos.forEach(function (p) { if (!visible(p)) return; if (S.marked[p.id]) delete S.marked[p.id]; else S.marked[p.id] = true; }); build(); });
  $$('#gv-view button').forEach(function (b) {
    b.classList.toggle('on', b.dataset.v === view);
    b.addEventListener('click', function () { view = b.dataset.v; FS.prefs.gridView = view; FS.savePrefs(); $$('#gv-view button').forEach(function (x) { x.classList.toggle('on', x === b); }); build(); });
  });
  $('#gv-zoom').addEventListener('input', function () { $('#gv-tiles').style.setProperty('--gz', this.value + 'px'); });
  $('#gv-zoom').addEventListener('change', function () { FS.prefs.gridZoom = Number(this.value); FS.savePrefs(); build(); });
  $('#gv-add').addEventListener('change', function () { FS.addFiles(this.files); this.value = ''; });

  /* ---------- acting on the picked photos, right on this screen ---------- */
  function picked() { return FS.marked(); }
  function redraw(list) { list.forEach(function (p) { p.cache = {}; FS.snap(p); var t = $('#gv-tiles .gt[data-i="' + S.photos.indexOf(p) + '"]'); if (t) { draw(t); t.querySelector('.gt-meta').innerHTML = meta(p); } }); sizes(); bar(); FS.refreshStrip(); }
  function menu(btn, box, fill) {
    $(btn).addEventListener('click', function (e) {
      e.stopPropagation(); var m = $(box), open = m.hidden; $$('.gv-menu').forEach(function (x) { x.hidden = true; });
      if (open) { fill(m); m.hidden = false; }
    });
  }
  document.addEventListener('click', function (e) { if (!e.target.closest('.gv-menu')) $$('.gv-menu').forEach(function (x) { x.hidden = true; }); });
  function myPresets() { try { return JSON.parse(localStorage.getItem('frame-studio-presets') || '[]'); } catch (e) { return []; } }
  menu('#gv-filter', '#gv-filter-m', function (m) {
    var p = picked()[0], list = FS.PRESETS.map(function (q) { return { id: q[0], name: q[1], adj: q[2] }; }).concat(myPresets());
    m.innerHTML = '<p class="gv-mh">פילטר ל־' + picked().length + ' תמונות</p><div class="gv-mgrid"></div>';
    list.forEach(function (q) {
      var b = document.createElement('button'); b.className = 'tile'; b.appendChild(FS.presetThumb(p, FS.presetAdj(q.adj, 1)));
      var s = document.createElement('span'); s.textContent = q.name; b.appendChild(s);
      b.addEventListener('click', function () { var l = picked(); l.forEach(function (x) { x.doc.photo.adj = FS.presetAdj(q.adj, 1); x.doc.photo.preset = q.id === 'original' ? null : q.id; }); m.hidden = true; redraw(l); FS.toast('🎨 ' + q.name + ' על ' + l.length + ' תמונות'); });
      m.lastChild.appendChild(b);
    });
  });
  menu('#gv-style', '#gv-style-m', function (m) {
    m.innerHTML = '<p class="gv-mh">סגנון מיידי ל־' + picked().length + ' תמונות (סגנונות AI: במסך העריכה, לשונית סגנונות)</p><div class="gv-mgrid"></div>';
    [['', 'בלי סגנון', '🚫']].concat(FS.LOCAL_STYLES).forEach(function (st) {
      var b = document.createElement('button'); b.className = 'tile'; b.innerHTML = '<i class="emo">' + st[2] + '</i><span>' + esc(st[1]) + '</span>';
      b.addEventListener('click', function () { var l = picked(); l.forEach(function (x) { x.doc.photo.style = st[0] ? { id: st[0], amt: 85 } : null; }); m.hidden = true; FS.busy('מצייר…'); setTimeout(function () { redraw(l); FS.busy(); FS.toast('🖌️ ' + st[1] + ' על ' + l.length + ' תמונות'); }, 30); });
      m.lastChild.appendChild(b);
    });
  });
  function setSize(id, w, h) {
    var l = picked(); if (!l.length) return;
    var keepCur = S.cur, keepBatch = S.batch; S.batch = undefined; S.cur = S.photos.indexOf(l[0]);
    FS.setFormat(id, w, h);
    S.batch = keepBatch; if (S.photos[keepCur] && !S.marked[S.photos[keepCur].id]) S.cur = keepCur;
    redraw(l); FS.toast('📐 גודל חדש ל־' + l.length + ' תמונות');
  }
  menu('#gv-fmt', '#gv-fmt-m', function (m) {
    m.innerHTML = '<p class="gv-mh">גודל ל־' + picked().length + ' תמונות</p>' + FS.FORMATS.map(function (f) { return '<button data-f="' + f.id + '">' + esc(f.name) + '</button>'; }).join('') +
      (FS.mySizes().length ? '<p class="gv-mh">⭐ הגדלים שלי</p>' + FS.mySizes().map(function (z) { return '<button data-my="' + z.id + '">' + esc(FS.sizeLabel(z)) + '</button>'; }).join('') : '') +
      '<div class="gv-new"><input type="number" id="gv-w" step="0.1" min="1" max="100" placeholder="רוחב ס״מ"><span>×</span><input type="number" id="gv-h" step="0.1" min="1" max="100" placeholder="גובה ס״מ"></div>' +
      '<input id="gv-sname" maxlength="30" placeholder="שם לשמירה (לא חובה)"><button class="primary" id="gv-size-go">✔ להחיל גודל מותאם</button>';
    $$('[data-f]', m).forEach(function (b) { b.addEventListener('click', function () { m.hidden = true; setSize(b.dataset.f); }); });
    $$('[data-my]', m).forEach(function (b) { b.addEventListener('click', function () { var z = FS.sizeOf('my:' + b.dataset.my); m.hidden = true; if (z) setSize('cm', z.w, z.h); }); });
    $('#gv-size-go', m).addEventListener('click', function () {
      var w = Number($('#gv-w', m).value), h = Number($('#gv-h', m).value); if (!(w > 0 && h > 0)) return FS.toast('רוחב וגובה בס״מ');
      var nm = $('#gv-sname', m).value.trim(); if (nm) FS.saveSize(nm, Math.round(w * 10), Math.round(h * 10));
      m.hidden = true; setSize('cm', w * 10, h * 10); if (nm) FS.toast('⭐ "' + nm + '" נשמר ברשימת הגדלים שלך', 4000);
    });
  });
  $('#gv-copies-go').addEventListener('click', function () { var n = FS.clamp(Number($('#gv-copies').value) || 1, 1, 999), l = picked(); l.forEach(function (p) { p.copies = n; }); redraw(l); FS.toast('×' + n + ' עותקים ל־' + l.length + ' תמונות'); });
  $('#gv-del').addEventListener('click', function () {
    var l = picked(); if (!l.length || !confirm('להסיר ' + l.length + ' תמונות מהפרויקט?')) return;
    S.photos = S.photos.filter(function (p) { return !S.marked[p.id]; }); S.marked = {}; S.cur = Math.min(S.cur, S.photos.length - 1); S.sel = null;
    FS.buildStrip(); FS.emit('doc'); FS.emit('history'); if (S.photos.length) build(); else setMode('edit');
  });

  /* several new photos open on the photos screen; one goes straight to editing */
  FS.on('photos-added', function (d) { if (S.photos.length > 1 && (d.n > 1 || FS.gridMode())) setMode('grid'); else if (FS.gridMode()) build(); });
  document.addEventListener('keydown', function (e) {
    if (!FS.gridMode() || /input|textarea|select/i.test((e.target.tagName || ''))) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); $('#gv-all').click(); }
    if (e.key === 'Escape') { S.marked = {}; build(); }
  });
})();
