/* 🎞️ Photo-booth strips (v185, home screen button 5): 2 or 3 photos one above the other on a 7.5×20 cm strip, with a line of
   text at the bottom. The photos are the marked ones (else all), taken in order, n per strip; each is cropped to its cell
   around its faces. "➕ כדפים בעבודה" adds the strips as pages of their own (they print, save and take frames like any
   photo); "🖨️ הדפסה" adds them and prints them on 15×20 paper, two strips side by side (each strip twice by default: one
   for the guest and one for the album, or two guests), so the sheet is cut once down the middle. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.addPhotoFile) return;
  var W = 75, H = 200, PX = 300 / 25.4;
  function ls(k, v) { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k); } catch (e) { return null; } }
  var o = { n: Number(ls('fs-strip-n')) === 2 ? 2 : 3, bg: ls('fs-strip-bg') || '#ffffff', twice: ls('fs-strip-twice') !== '0', text: '' };
  var BGS = [['#ffffff', 'לבן'], ['#111111', 'שחור'], ['#f4ecdf', 'שמנת'], ['#d6b77e', 'שמפניה'], ['#f7d9e3', 'ורוד'], ['#1f2a44', 'כחול לילה']];
  function ink(bg) { var c = FS.hexRgb ? FS.hexRgb(bg) : [255, 255, 255]; return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 > 140 ? '#2a2238' : '#f3e7cf'; }
  function list() { var m = FS.marked(); return (m.length ? m : FS.state.photos).filter(function (p) { return !p.strip; }); }
  function groups() {
    var l = list(), g = [];
    for (var i = 0; i < l.length; i += o.n) g.push(l.slice(i, i + o.n));
    /* a last strip that is short: its photos again, so no cell is empty */
    var last = g[g.length - 1];
    if (last && last.length < o.n) { var k = 0; while (last.length < o.n) last.push(last[k++ % last.length]); }
    return g;
  }
  var faceAt = {};
  function centre(p) {
    var im = FS.img(p.src); if (!im || !FS.detectFaces) return Promise.resolve(null);
    if (faceAt[p.src] !== undefined) return Promise.resolve(faceAt[p.src]);
    return FS.detectFaces(im).then(function (l) {
      var m = FS.mainFaces ? FS.mainFaces(l) : l; if (!m.length) return (faceAt[p.src] = null);
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; m.forEach(function (f) { x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h); });
      return (faceAt[p.src] = { x: (x0 + x1) / 2 / im.naturalWidth, y: (y0 + (y1 - y0) * 0.6) / im.naturalHeight });
    }, function () { return (faceAt[p.src] = null); });
  }
  /* one strip at `k` px per mm */
  function draw(photos, k) {
    var c = FS.canvas(Math.round(W * k), Math.round(H * k)), x = c.getContext('2d'), m = 4, gap = 3, foot = 24;
    x.fillStyle = o.bg; x.fillRect(0, 0, c.width, c.height);
    var cw = W - m * 2, ch = (H - m * 2 - foot - gap * (o.n - 1)) / o.n;
    return Promise.all(photos.map(centre)).then(function (fc) {
      photos.forEach(function (p, i) {
        var im = FS.img(p.src); if (!im) return;
        var X = m * k, Y = (m + i * (ch + gap)) * k, w = cw * k, h = ch * k, iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
        var f = fc[i] || { x: 0.5, y: 0.45 }, sx = Math.max(0, Math.min(iw - sw, f.x * iw - sw / 2)), sy = Math.max(0, Math.min(ih - sh, f.y * ih - sh / 2));
        x.save(); x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, sw, sh, X, Y, w, h); x.restore();
      });
      var t = o.text, d = new Date().toLocaleDateString('he-IL'), col = ink(o.bg);
      x.fillStyle = col; x.textAlign = 'center'; x.direction = 'rtl';
      x.font = '600 ' + Math.round(7 * k) + 'px "Assistant","Heebo",sans-serif'; x.fillText(t || ' ', c.width / 2, (H - foot + 11) * k, (W - 8) * k);
      x.globalAlpha = 0.75; x.font = Math.round(4 * k) + 'px "Assistant","Heebo",sans-serif'; x.fillText(d, c.width / 2, (H - foot + 18.5) * k); x.globalAlpha = 1;
      return c;
    });
  }
  function open() {
    var ev = FS.liveCurrent && FS.liveCurrent(); if (!o.text) o.text = (ev && ev.title) || (FS.prefs && FS.prefs.event && FS.prefs.event.title) || '';
    var body = FS.dialog('🎞️ סטריפים 7.5×20', '<div class="sp-wrap"><div class="sp-side">' +
      '<p class="hint" id="sp-src"></p>' +
      '<div class="field"><label>תמונות בכל סטריפ</label><div class="chips" id="sp-n"><button type="button" class="chip" data-n="2">2 תמונות</button><button type="button" class="chip" data-n="3">3 תמונות</button></div></div>' +
      '<div class="field"><label>רקע</label><div class="chips" id="sp-bg">' + BGS.map(function (b) { return '<button type="button" class="chip sp-sw" data-bg="' + b[0] + '" title="' + b[1] + '" style="background:' + b[0] + '"></button>'; }).join('') + '</div></div>' +
      '<div class="field"><label>טקסט למטה</label><input id="sp-text" maxlength="40" placeholder="שם האירוע"></div>' +
      '<label class="chk"><input type="checkbox" id="sp-twice"> כל סטריפ פעמיים בדף (לאורח ולאלבום)</label>' +
      '<div class="sp-btns"><button class="btn primary" id="sp-print">🖨️ הדפסה על 15×20</button><button class="btn" id="sp-add">➕ כדפים בעבודה</button></div>' +
      '<p class="hint">בדרייבר של המדפסת: נייר 6x8 (15×20). חותכים פעם אחת באמצע.</p></div>' +
      '<div class="sp-pv" id="sp-pv"></div></div>', true);
    var $ = function (s) { return body.querySelector(s); };
    $('#sp-text').value = o.text; $('#sp-twice').checked = o.twice;
    function marks() {
      body.querySelectorAll('#sp-n [data-n]').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.n) === o.n); });
      body.querySelectorAll('#sp-bg [data-bg]').forEach(function (b) { b.classList.toggle('on', b.dataset.bg === o.bg); });
    }
    var tick = 0;
    function render() {
      marks(); var g = groups(), l = list(), my = ++tick, box = $('#sp-pv');
      $('#sp-src').textContent = l.length ? (FS.marked().length ? '✓ ' + l.length + ' התמונות המסומנות' : l.length + ' תמונות (לא סומנו, אז כולן)') + ' → ' + g.length + ' סטריפים' : 'אין תמונות. מוסיפים תמונות קודם.';
      box.innerHTML = ''; $('#sp-print').disabled = $('#sp-add').disabled = !g.length;
      g.slice(0, 12).reduce(function (q, ph) { return q.then(function () { if (my !== tick) return; return draw(ph, 1.6).then(function (c) { if (my === tick) { c.className = 'sp-c'; box.appendChild(c); } }); }); }, Promise.resolve());
    }
    $('#sp-n').addEventListener('click', function (e) { var b = e.target.closest('[data-n]'); if (!b) return; o.n = Number(b.dataset.n); ls('fs-strip-n', o.n); render(); });
    $('#sp-bg').addEventListener('click', function (e) { var b = e.target.closest('[data-bg]'); if (!b) return; o.bg = b.dataset.bg; ls('fs-strip-bg', o.bg); render(); });
    var tt = null; $('#sp-text').addEventListener('input', function () { o.text = this.value; clearTimeout(tt); tt = setTimeout(render, 250); });
    $('#sp-twice').addEventListener('change', function () { o.twice = this.checked; ls('fs-strip-twice', o.twice ? '1' : '0'); });
    $('#sp-add').addEventListener('click', function () { make().then(function (pages) { if (pages.length) { FS.closeDialog(); FS.toast('🎞️ ' + pages.length + ' סטריפים נוספו כדפים', 4000); } }); });
    $('#sp-print').addEventListener('click', function () {
      make().then(function (pages) {
        if (!pages.length) return; FS.closeDialog();
        pages.forEach(function (p) { p.copies = o.twice ? 2 : 1; });
        FS.printNow({ list: pages, paper: '15x20', layout: 'fill', margin: 0, gap: 0, size: [W, H] });
      });
    });
    render();
  }
  /* the strips as pages of the project, at print resolution */
  function make() {
    var g = groups(); if (!g.length) return Promise.resolve([]);
    FS.busy && FS.busy('מכין ' + g.length + ' סטריפים…');
    var out = [];
    return g.reduce(function (q, ph, i) {
      return q.then(function () { return draw(ph, PX); }).then(function (c) {
        return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.94); });
      }).then(function (b) {
        return FS.addPhotoFile(new File([b], 'סטריפ ' + (i + 1) + '.jpg', { type: 'image/jpeg' }));
      }).then(function (p) {
        FS.applyFormat(p.doc, 'cm', FS.img(p.src), W, H); p.doc.frame = null; p.doc.layers = []; FS.fitPhoto(p.doc, FS.img(p.src)); p.strip = true; p.collage = true; if (FS.snap) FS.snap(p); out.push(p);
      });
    }, Promise.resolve()).then(function () { FS.busy && FS.busy(); if (FS.buildStrip) FS.buildStrip(); FS.emit && FS.emit('doc'); return out; },
      function () { FS.busy && FS.busy(); FS.toast('לא הצלחתי להכין את הסטריפים'); return out; });
  }
  FS.strips = { open: open, draw: draw, groups: groups };
})();
