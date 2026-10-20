/* פריים־סטודיו — the core: state, formats, image loading, the photo pipeline (adjustments, sharpen, vignette, grain,
   background replace), drawing a page, history and the browser store. Everything else hangs off window.FS. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};

  /* ---------- small helpers ---------- */
  var $ = FS.$ = function (s, r) { return (r || document).querySelector(s); };
  FS.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = FS.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  FS.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  FS.canvas = function (w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  FS.toast = function (msg, ms) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.add('on');
    clearTimeout(FS._toastT); FS._toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2600);
  };
  FS.emit = function (name, detail) { document.dispatchEvent(new CustomEvent('fs:' + name, { detail: detail })); };
  FS.on = function (name, fn) { document.addEventListener('fs:' + name, function (e) { fn(e.detail); }); };

  /* ---------- page formats (pixels at 300dpi, paper in mm) ---------- */
  FS.FORMATS = [
    { id: '10x15', name: '10×15 לאורך', w: 1200, h: 1800, mm: [102, 152] },
    { id: '15x10', name: '15×10 לרוחב', w: 1800, h: 1200, mm: [152, 102] },
    { id: '13x18', name: '13×18', w: 1500, h: 2100, mm: [127, 178] },
    { id: '18x13', name: '18×13 לרוחב', w: 2100, h: 1500, mm: [178, 127] },
    { id: '15x20', name: '15×20', w: 1800, h: 2400, mm: [152, 203] },
    { id: '20x30', name: '20×30', w: 2400, h: 3600, mm: [203, 305] },
    { id: 'A4', name: 'A4', w: 2480, h: 3508, mm: [210, 297] },
    { id: 'A4L', name: 'A4 לרוחב', w: 3508, h: 2480, mm: [297, 210] },
    { id: 'sq', name: 'ריבוע 15×15 / פוסט', w: 1800, h: 1800, mm: [152, 152] },
    { id: 'story', name: 'סטורי 9:16', w: 1080, h: 1920, mm: [90, 160] },
    { id: 'post45', name: 'אינסטגרם 4:5', w: 1080, h: 1350, mm: [120, 150] },
    { id: 'magnet', name: '🧲 מגנט 5×7.5', w: 591, h: 886, mm: [50, 75] },
    { id: 'magnetL', name: '🧲 מגנט 7.5×5 לרוחב', w: 886, h: 591, mm: [75, 50] },
    { id: 'm69', name: '🧲 מגנט 6×9', w: 709, h: 1063, mm: [60, 90] },
    { id: 'm710', name: '🧲 מגנט 7×10', w: 827, h: 1181, mm: [70, 100] },
    { id: 'm66', name: '🧲 מגנט ריבוע 6×6', w: 709, h: 709, mm: [60, 60] },
    { id: 'orig', name: 'יחס מקורי של התמונה', w: 0, h: 0, mm: null }
  ];
  FS.fmt = function (id) { for (var i = 0; i < FS.FORMATS.length; i++) if (FS.FORMATS[i].id === id) return FS.FORMATS[i]; return null; };

  /* ---------- state ---------- */
  FS.state = { photos: [], cur: -1, sel: null, zoom: 0, showOriginal: false };
  FS.ADJ0 = { exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0,
    vibrance: 0, saturation: 0, hue: 0, clarity: 0, sharpen: 0, vignette: 0, grain: 0, fade: 0, mono: 0, tone: 'none' };
  FS.newDoc = function (img, fmtId) {
    var f = FS.fmt(fmtId || 'orig') || FS.fmt('orig');
    var d = { fmt: f.id, w: f.w, h: f.h, bg: '#ffffff', frame: null, layers: [],
      photo: { x: 0, y: 0, s: 1, r: 0, fh: false, fv: false, adj: Object.assign({}, FS.ADJ0), bg: { mode: 'none', color: '#ffffff', src: '' } } };
    FS.applyFormat(d, f.id, img);
    return d;
  };
  FS.applyFormat = function (d, id, img, w, h) {
    var f = FS.fmt(id);
    d.fmt = id; delete d.mm;
    if (id === 'custom') { d.w = Math.round(w); d.h = Math.round(h); }
    else if (id === 'cm') { d.mm = [w, h]; d.w = Math.round(w / 25.4 * 300); d.h = Math.round(h / 25.4 * 300); }
    else if (id === 'orig' || !f) {
      var iw = img ? img.naturalWidth || img.width : 1500, ih = img ? img.naturalHeight || img.height : 1000;
      var k = Math.min(1, 3600 / Math.max(iw, ih)); d.w = Math.round(iw * k); d.h = Math.round(ih * k);
    } else { d.w = f.w; d.h = f.h; }
    if (img) FS.fitPhoto(d, img);
  };
  FS.cur = function () { return FS.state.photos[FS.state.cur] || null; };
  /* multi-select: the marked photos; edits in batch mode reach all of them */
  FS.state.marked = {};
  FS.marked = function () { return FS.state.photos.filter(function (p) { return FS.state.marked[p.id]; }); };
  FS.targets = function () { var m = FS.marked(), c = FS.cur(); if (FS.state.batch !== false && m.length > 1 && c && FS.state.marked[c.id]) return m; return c ? [c] : []; };
  /* the same layer on another page: frame words, magnet words and copied layers share a link */
  FS.linked = function (q, L) { if (!L || !L.link) return null; for (var i = 0; i < q.doc.layers.length; i++) if (q.doc.layers[i].link === L.link) return q.doc.layers[i]; return null; };
  FS.mmOf = function (d) { if (d.mm) return d.mm; var f = FS.fmt(d.fmt); return f && f.mm ? f.mm : [d.w / 300 * 25.4, d.h / 300 * 25.4]; };

  /* the place a photo shows through: the frame's hole, or the whole page */
  FS.hole = function (d) {
    if (d.frame) { var fr = FS.frameOf(d.frame, d); if (fr && fr.hole) return { x: fr.hole.x * d.w, y: fr.hole.y * d.h, w: fr.hole.w * d.w, h: fr.hole.h * d.h }; }
    return { x: 0, y: 0, w: d.w, h: d.h };
  };
  FS.fitPhoto = function (d, img, mode) {
    var h = FS.hole(d), iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var rot = Math.abs(Math.round(d.photo.r / 90)) % 2 === 1;
    if (rot) { var t = iw; iw = ih; ih = t; }
    var s = mode === 'contain' ? Math.min(h.w / iw, h.h / ih) : Math.max(h.w / iw, h.h / ih);
    d.photo.s = s; d.photo.x = h.x + h.w / 2; d.photo.y = h.y + h.h / 2;
  };

  /* ---------- images ---------- */
  var IMGS = FS.IMGS = {};
  FS.loadImg = function (src) {
    if (IMGS[src] && IMGS[src].complete && IMGS[src].naturalWidth) return Promise.resolve(IMGS[src]);
    return new Promise(function (res, rej) {
      var im = new Image();
      if (!/^(data|blob):/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = function () { IMGS[src] = im; res(im); };
      im.onerror = function () { rej(new Error('img')); };
      im.src = src;
    });
  };
  FS.img = function (src) { return IMGS[src] || null; };
  /* a blob: URL becomes a data URL when it has to leave the page (project files, my designs) */
  FS.toDataURL = function (src) {
    if (!/^blob:/.test(src)) return Promise.resolve(src);
    return fetch(src).then(function (r) { return r.blob(); }).then(FS.fileToDataURL);
  };
  FS.fileToDataURL = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  };
  /* photos are kept as blob URLs (not data URLs), so hundreds of them fit in memory. A big photo is brought down once, on
     arrival, to 3000px on its long side (enough for a 20x30cm print) and re-encoded as JPEG: the editor, the AI and the
     print stay fast and light, and the result still prints sharp. */
  FS.PHOTO_MAX = 3000;
  /* a big photo is decoded off the main thread (createImageBitmap) and shrunk there, so opening hundreds doesn't freeze the page */
  function shrunkFile(file) {
    var max = FS.PHOTO_MAX;
    if (!window.createImageBitmap || /gif|svg/.test(file.type)) return Promise.resolve(null);
    return createImageBitmap(file).then(function (bmp) {
      var big = Math.max(bmp.width, bmp.height) > max || (file.size > 4000000 && !/png|webp/.test(file.type));
      if (!big) { bmp.close && bmp.close(); return null; }
      var k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = FS.canvas(bmp.width * k, bmp.height * k), cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high'; cx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); });
    }).catch(function () { return null; });
  }
  FS.addPhotoFile = function (file) {
    var url;
    return shrunkFile(file).then(function (b) { url = URL.createObjectURL(b || file); return FS.loadImg(url); }).then(function (im) {
      var max = FS.PHOTO_MAX;
      if (Math.max(im.naturalWidth, im.naturalHeight) > max || (file.size > 4000000 && !/png|webp/.test(file.type))) {
        var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), cx = c.getContext('2d');
        cx.imageSmoothingQuality = 'high'; cx.drawImage(im, 0, 0, c.width, c.height);
        return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); }).then(function (b) { URL.revokeObjectURL(url); delete IMGS[url]; return FS.loadImg(URL.createObjectURL(b)); });
      }
      return im;
    }).then(function (im) {
      var fmt = FS.prefs.fmt || 'magnet';
      var p = { id: FS.uid(), name: (file.name || 'תמונה').replace(/\.[^.]+$/, ''), src: im.src, doc: null, undo: [], redo: [], cache: {}, copies: 1 };
      var my = /^my:/.test(fmt) && FS.sizeOf ? FS.sizeOf(fmt) : null;   /* one of the owner's saved sizes */
      p.doc = FS.newDoc(im, my ? 'magnet' : fmt);
      if (my) FS.applyFormat(p.doc, 'cm', im, my.w, my.h);
      if (FS.prefs.frameForAll && FS.prefs.lastFrame) { p.doc.frame = JSON.parse(JSON.stringify(FS.prefs.lastFrame)); FS.fitPhoto(p.doc, im); }
      FS.state.photos.push(p);
      (FS.afterAdd || []).forEach(function (f) { try { f(p); } catch (e) { console.warn(e); } });
      return p;
    });
  };
  FS.prefs = (function () { try { return JSON.parse(localStorage.getItem('frame-studio-prefs') || '{}'); } catch (e) { return {}; } })();
  FS.savePrefs = function () { try { localStorage.setItem('frame-studio-prefs', JSON.stringify(FS.prefs)); } catch (e) { /* private mode */ } };

  /* ---------- the photo pipeline ---------- */
  function hueMatrix(deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
  }
  function toneLUT(a) {
    var lut = new Float32Array(1024), gam = Math.pow(2, -a.brightness / 100);
    var con = a.contrast >= 0 ? 1 + a.contrast / 60 : 1 + a.contrast / 110;
    for (var i = 0; i < 1024; i++) {
      var v = i / 1023;
      v = Math.pow(v, gam);
      v += (a.shadows / 100) * 2.5 * v * (1 - v) * (1 - v);
      v += (a.highlights / 100) * 2.5 * v * v * (1 - v);
      v = v * (1 + a.whites / 100 * 0.25);
      v = v + (a.blacks / 100) * 0.12 * (1 - v);
      v = (v - 0.5) * con + 0.5;
      v = (a.fade / 100) * 0.18 + v * (1 - (a.fade / 100) * 0.24);
      lut[i] = clamp(v, 0, 1) * 255;
    }
    return lut;
  }
  /* box blur of RGBA in place, separable, radius r; three passes look like a gaussian */
  function boxBlur(src, w, h, r) {
    if (r < 1) return src;
    var tmp = new Float32Array(src.length), out = new Uint8ClampedArray(src.length), x, y, c, i, acc, n = r * 2 + 1;
    for (y = 0; y < h; y++) {
      for (c = 0; c < 4; c++) {
        var row = y * w * 4; acc = 0;
        for (x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1) * 4 + c];
        for (x = 0; x < w; x++) {
          tmp[row + x * 4 + c] = acc / n;
          acc += src[row + Math.min(x + r + 1, w - 1) * 4 + c] - src[row + Math.max(x - r, 0) * 4 + c];
        }
      }
    }
    for (x = 0; x < w; x++) {
      for (c = 0; c < 4; c++) {
        acc = 0;
        for (y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w * 4 + x * 4 + c];
        for (y = 0; y < h; y++) {
          i = y * w * 4 + x * 4 + c; out[i] = acc / n;
          acc += tmp[Math.min(y + r + 1, h - 1) * w * 4 + x * 4 + c] - tmp[Math.max(y - r, 0) * w * 4 + x * 4 + c];
        }
      }
    }
    return out;
  }
  FS.blur = function (data, w, h, r) { var o = data; for (var k = 0; k < 3; k++) o = boxBlur(o, w, h, Math.max(1, Math.round(r / 1.7))); return o; };

  /* the edited photo (in its own pixels, before moving/turning it on the page) at most `max` px long */
  FS.processed = function (p, max, fast) {
    var d = p.doc, a = d.photo.adj, bg = d.photo.bg, im = FS.img(p.src);
    if (!im) return null;
    var key = max + '|' + JSON.stringify(a) + '|' + JSON.stringify(bg) + '|' + JSON.stringify(d.photo.blurs || 0) + '|' + JSON.stringify(d.photo.skin || 0) + '|' + JSON.stringify(d.photo.style || 0) + '|' + (p.maskV || 0) + '|' + (fast ? 1 : 0);
    if (p.cache.key === key) return p.cache.canvas;
    var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    var c = FS.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h);
    FS.adjustPixels(id.data, w, h, a, fast);
    (d.photo.blurs || []).forEach(function (b) { FS.pixelate(id.data, w, h, b.x * k, b.y * k, b.w * k, b.h * k); });
    if (d.photo.skin && d.photo.skin.amt && d.photo.skin.faces) FS.smoothSkin(id.data, w, h, d.photo.skin, k, fast);
    if (d.photo.style && d.photo.style.id && FS.applyStyle) FS.applyStyle(id.data, w, h, d.photo.style, fast);
    if (bg && bg.mode !== 'none' && p.mask) FS.replaceBackground(id.data, w, h, p, bg, a);
    x.putImageData(id, 0, 0);
    p.cache = { key: key, canvas: c };
    return c;
  };

  /* film split toning: [shadows r, g, b, highlights r, g, b] added by luminance */
  var SPLIT = {
    portra: [-4, 2, 8, 10, 4, -6], fuji: [-6, 4, 6, 4, 2, -4], kodak: [2, 0, -6, 14, 7, -8],
    airy: [-2, 2, 8, 4, 2, -2], moody: [-8, 2, 10, 10, 3, -8], bwwarm: [0, -2, -6, 10, 5, -4]
  };
  FS.adjustPixels = function (px, w, h, a, fast) {
    var plain = true;
    for (var k in FS.ADJ0) if (k !== 'tone' && a[k]) { plain = false; break; }
    if (plain && (!a.tone || a.tone === 'none')) return;
    var lut = toneLUT(a), ex = Math.pow(2, a.exposure / 50);
    var tr = a.temp * 0.32 + a.tint * 0.1, tg = -a.tint * 0.3, tb = -a.temp * 0.32 + a.tint * 0.1;
    var hm = a.hue ? hueMatrix(a.hue) : null, sat = 1 + a.saturation / 100, vib = a.vibrance / 100, mono = a.mono / 100;
    var n = px.length, i, r, g, b, L, mx, mn, f;
    for (i = 0; i < n; i += 4) {
      r = (px[i] + tr) * ex; g = (px[i + 1] + tg) * ex; b = (px[i + 2] + tb) * ex;
      r = lut[clamp(r * 4.0118 | 0, 0, 1023)]; g = lut[clamp(g * 4.0118 | 0, 0, 1023)]; b = lut[clamp(b * 4.0118 | 0, 0, 1023)];
      if (hm) { var r2 = r * hm[0] + g * hm[1] + b * hm[2], g2 = r * hm[3] + g * hm[4] + b * hm[5]; b = r * hm[6] + g * hm[7] + b * hm[8]; r = r2; g = g2; }
      L = 0.299 * r + 0.587 * g + 0.114 * b;
      f = sat;
      if (vib) { mx = r > g ? (r > b ? r : b) : (g > b ? g : b); mn = r < g ? (r < b ? r : b) : (g < b ? g : b); f *= 1 + vib * (1 - (mx - mn) / 255) * 1.2; }
      if (f !== 1) { r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f; }
      if (mono) { r += (L - r) * mono; g += (L - g) * mono; b += (L - b) * mono; }
      if (a.tone === 'sepia') { var sr = L * 1.07 + 12, sg = L * 0.95 + 4, sb = L * 0.78; r = (r + sr) / 2; g = (g + sg) / 2; b = (b + sb) / 2; }
      else if (a.tone === 'cool') { b += 14; r -= 6; }
      else if (a.tone === 'gold') { r += 16; g += 8; b -= 10; }
      else if (a.tone === 'teal') { var t = L / 255; r += (t - 0.5) * 30 - 6; b += (0.5 - t) * 34 + 4; }
      else if (SPLIT[a.tone]) { var sp = SPLIT[a.tone], u = L / 255, v1 = 1 - u; r += sp[0] * v1 + sp[3] * u; g += sp[1] * v1 + sp[4] * u; b += sp[2] * v1 + sp[5] * u; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    var big = Math.max(w, h);
    if (!fast && (a.clarity || a.sharpen)) {
      if (a.clarity) {
        var bl = FS.blur(px, w, h, Math.max(2, big / 90)), ca = a.clarity / 100 * 0.7;
        for (i = 0; i < n; i += 4) { px[i] += (px[i] - bl[i]) * ca; px[i + 1] += (px[i + 1] - bl[i + 1]) * ca; px[i + 2] += (px[i + 2] - bl[i + 2]) * ca; }
      }
      if (a.sharpen) {
        var bs = boxBlur(px, w, h, Math.max(1, Math.round(big / 1500))), sa = a.sharpen / 100 * 1.6;
        for (i = 0; i < n; i += 4) { px[i] += (px[i] - bs[i]) * sa; px[i + 1] += (px[i + 1] - bs[i + 1]) * sa; px[i + 2] += (px[i + 2] - bs[i + 2]) * sa; }
      }
    }
    if (a.vignette || a.grain) {
      var cx = w / 2, cy = h / 2, rr = Math.sqrt(cx * cx + cy * cy), va = a.vignette / 100, ga = a.grain / 100 * 46, seed = 9;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        if (va) {
          var dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / rr, s = clamp((dd - 0.35) / 0.65, 0, 1); s = s * s * (3 - 2 * s);
          var m = va > 0 ? 1 - va * 0.85 * s : 1; var add = va < 0 ? -va * 200 * s : 0;
          px[i] = px[i] * m + add; px[i + 1] = px[i + 1] * m + add; px[i + 2] = px[i + 2] * m + add;
        }
        if (ga) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; var nz = ((seed >> 8) / 8388608 - 0.5) * ga; px[i] += nz; px[i + 1] += nz; px[i + 2] += nz; }
      }
    }
  };

  /* skin retouch: an edge-keeping blur inside each face oval (eyes, brows and lips keep their detail) */
  FS.smoothSkin = function (px, w, h, sk, k, fast) {
    var a = sk.amt / 100;
    sk.faces.forEach(function (f) {
      var fx = f.x * k, fy = f.y * k, fw = f.w * k, fh = f.h * k, x0 = Math.max(0, (fx - fw * 0.15) | 0), y0 = Math.max(0, (fy - fh * 0.25) | 0), x1 = Math.min(w, (fx + fw * 1.15) | 0), y1 = Math.min(h, (fy + fh * 1.2) | 0);
      var bw = x1 - x0, bh = y1 - y0; if (bw < 8 || bh < 8) return;
      var sub = new Uint8ClampedArray(bw * bh * 4), x, y, i, j;
      for (y = 0; y < bh; y++) sub.set(px.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1) * 4), y * bw * 4);
      var bl = FS.blur(sub, bw, bh, Math.max(2, fw / (fast ? 30 : 22))), cx = fx + fw / 2, cy = fy + fh * 0.45, rx = fw * 0.62, ry = fh * 0.78;
      for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) {
        var ex = (x0 + x - cx) / rx, ey = (y0 + y - cy) / ry, e = ex * ex + ey * ey; if (e > 1) continue;
        var m = a * (e > 0.7 ? (1 - e) / 0.3 : 1); i = ((y0 + y) * w + x0 + x) * 4; j = (y * bw + x) * 4;
        for (var c = 0; c < 3; c++) { var dlt = bl[j + c] - px[i + c], keep = Math.max(0, 1 - Math.abs(dlt) / 26); px[i + c] += dlt * m * keep; }
      }
    });
  };

  /* privacy: big soft blocks over a rectangle (oval edge) */
  FS.pixelate = function (px, w, h, bx, by, bw, bh) {
    var cell = Math.max(4, Math.round(bw / 9)), x0 = Math.max(0, bx | 0), y0 = Math.max(0, by | 0), x1 = Math.min(w, (bx + bw) | 0), y1 = Math.min(h, (by + bh) | 0);
    for (var cy = y0; cy < y1; cy += cell) for (var cx = x0; cx < x1; cx += cell) {
      var r = 0, g = 0, b = 0, n = 0, x, y, i;
      for (y = cy; y < Math.min(cy + cell, y1); y++) for (x = cx; x < Math.min(cx + cell, x1); x++) { i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      for (y = cy; y < Math.min(cy + cell, y1); y++) for (x = cx; x < Math.min(cx + cell, x1); x++) {
        var ex = (x - (bx + bw / 2)) / (bw / 2), ey = (y - (by + bh / 2)) / (bh / 2); if (ex * ex + ey * ey > 1) continue;
        i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  };

  /* background replace with the person mask from the AI panel (p.mask is a canvas, white = person) */
  FS.replaceBackground = function (px, w, h, p, bg, a) {
    var mc = FS.canvas(w, h), mx = mc.getContext('2d');
    mx.drawImage(p.mask, 0, 0, w, h);
    var m = mx.getImageData(0, 0, w, h).data, back = null, i, n = px.length, al;
    if (bg.mode === 'blur') back = FS.blur(px, w, h, Math.max(4, Math.max(w, h) / (60 - (bg.amount || 30) * 0.4)));
    else if (bg.mode === 'image' && FS.img(bg.src)) {
      var bc = FS.canvas(w, h), bx = bc.getContext('2d'), bi = FS.img(bg.src);
      var s = Math.max(w / bi.naturalWidth, h / bi.naturalHeight);
      bx.drawImage(bi, (w - bi.naturalWidth * s) / 2, (h - bi.naturalHeight * s) / 2, bi.naturalWidth * s, bi.naturalHeight * s);
      var bd = bx.getImageData(0, 0, w, h); FS.adjustPixels(bd.data, w, h, a, true); back = bd.data;
    }
    var col = hexRgb(bg.color || '#ffffff');
    for (i = 0; i < n; i += 4) {
      al = m[i] / 255;
      if (al >= 0.999) continue;
      if (bg.mode === 'remove') { px[i + 3] = px[i + 3] * al; continue; }
      var br, bgc, bb;
      if (back) { br = back[i]; bgc = back[i + 1]; bb = back[i + 2]; }
      else if (bg.mode === 'bw') { br = bgc = bb = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; }
      else { br = col[0]; bgc = col[1]; bb = col[2]; }
      px[i] = px[i] * al + br * (1 - al); px[i + 1] = px[i + 1] * al + bgc * (1 - al); px[i + 2] = px[i + 2] * al + bb * (1 - al);
    }
  };
  function hexRgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var v = parseInt(h, 16) || 0; return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  FS.hexRgb = hexRgb;

  /* ---------- auto enhance: levels, white balance and a little colour, from the photo's own histogram ---------- */
  FS.autoAdjust = function (p) {
    var im = FS.img(p.src), k = Math.min(1, 320 / Math.max(im.naturalWidth, im.naturalHeight));
    var c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, c.width, c.height);
    var d = x.getImageData(0, 0, c.width, c.height).data, hist = new Uint32Array(256), sr = 0, sg = 0, sb = 0, n = 0, ss = 0;
    for (var i = 0; i < d.length; i += 4) {
      var L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0; hist[L]++; sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
      var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); ss += (mx - mn) / 255;
    }
    function pct(q) { var t = n * q, acc = 0; for (var v = 0; v < 256; v++) { acc += hist[v]; if (acc >= t) return v; } return 255; }
    var lo = pct(0.01), hi = pct(0.99), mid = pct(0.5);
    var a = Object.assign({}, FS.ADJ0);
    a.exposure = clamp(Math.round((118 - mid) / 2.2), -40, 45);
    a.whites = clamp(Math.round((245 - hi) / 1.4), -30, 45);
    a.blacks = clamp(Math.round((12 - lo) * 1.2), -35, 25);
    a.contrast = clamp(Math.round(18 - (hi - lo) / 20), -10, 22);
    a.shadows = mid < 100 ? 22 : 8; a.highlights = hi > 248 ? -28 : -10;
    var ar = sr / n, ag = sg / n, ab = sb / n;
    a.temp = clamp(Math.round((ab - ar) / 1.6), -30, 30);
    a.tint = clamp(Math.round((ag - (ar + ab) / 2) / 1.4), -25, 25);
    var avgSat = ss / n;
    a.vibrance = avgSat < 0.25 ? 28 : 14; a.clarity = 12; a.sharpen = 18;
    return a;
  };

  /* ---------- drawing a page ---------- */
  FS.photoMatrix = function (d, im) { /* the photo's transform on the page */
    return { x: d.photo.x, y: d.photo.y, s: d.photo.s, r: d.photo.r * Math.PI / 180, fh: d.photo.fh ? -1 : 1, fv: d.photo.fv ? -1 : 1, iw: im.naturalWidth, ih: im.naturalHeight };
  };
  FS.imgToDoc = function (d, im, ix, iy) {
    var m = FS.photoMatrix(d, im), lx = (ix - m.iw / 2) * m.s * m.fh, ly = (iy - m.ih / 2) * m.s * m.fv;
    return { x: m.x + lx * Math.cos(m.r) - ly * Math.sin(m.r), y: m.y + lx * Math.sin(m.r) + ly * Math.cos(m.r) };
  };

  /* opts: { scale, max (photo pixels), transparent, noPhoto, noLayers, sel, fast } */
  FS.draw = function (ctx, p, opts) {
    var d = p.doc, sc = opts.scale || 1, im = FS.img(p.src);
    ctx.save();
    ctx.clearRect(0, 0, d.w * sc, d.h * sc);
    ctx.scale(sc, sc);
    if (!opts.transparent) { ctx.fillStyle = d.bg; ctx.fillRect(0, 0, d.w, d.h); }
    if (im && !opts.noPhoto) {
      var src = FS.state.showOriginal && !opts.export ? im : FS.processed(p, opts.max || 1600, opts.fast);
      if (src) {
        var m = FS.photoMatrix(d, im);
        ctx.save();
        var fo = d.frame && FS.frameOf(d.frame, d); if (fo && fo.clip) { fo.clip(ctx, FS.hole(d)); ctx.clip(); }
        ctx.translate(m.x, m.y); ctx.rotate(m.r); ctx.scale(m.s * m.fh, m.s * m.fv);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, -m.iw / 2, -m.ih / 2, m.iw, m.ih);
        ctx.restore();
      }
    }
    if (d.frame) FS.drawFrame(ctx, d);
    if (!opts.noLayers) d.layers.forEach(function (L) { if (!L.hidden) FS.drawLayer(ctx, L); });
    if (opts.sel) FS.drawSelection(ctx, d, opts.sel, sc);
    ctx.restore();
  };

  FS.FONTS = [
    ['Heebo', 'היבו'], ['Rubik', 'רוביק'], ['Assistant', 'אסיסטנט'], ['Secular One', 'סקולר'], ['Suez One', 'סואץ'],
    ['Frank Ruhl Libre', 'פרנק רוהל'], ['Amatic SC', 'אמטיק (כתב יד)'], ['Karantina', 'קרנטינה'], ['Bellefair', 'בלפייר'],
    ['Varela Round', 'וראלה עגול'], ['David Libre', 'דוד'], ['Playpen Sans Hebrew', 'פליפן (ילדותי)']
  ];
  function fontStr(L) { return (L.italic ? 'italic ' : '') + (L.weight || 700) + ' ' + L.size + 'px "' + (L.font || 'Heebo') + '", Heebo, sans-serif'; }
  FS.layerBox = function (L, ctx) { /* local, unrotated, centred box */
    if (L.type === 'text') {
      var c = ctx || FS._mctx || (FS._mctx = FS.canvas(4, 4).getContext('2d'));
      c.save(); c.font = fontStr(L);
      var lines = String(L.text || ' ').split('\n'), w = 0;
      lines.forEach(function (t) { w = Math.max(w, c.measureText(t).width + (L.spacing || 0) * t.length); });
      c.restore();
      var lh = L.size * (L.lh || 1.18), pad = L.bgOn ? L.size * 0.35 : L.size * 0.08;
      return { w: w + pad * 2, h: lh * lines.length + pad * 2, lines: lines, lh: lh, pad: pad };
    }
    if (L.type === 'emoji') return { w: L.size * 1.15, h: L.size * 1.15 };
    var im = FS.img(L.src); var iw = im ? im.naturalWidth : 100, ih = im ? im.naturalHeight : 100;
    return { w: iw * L.s, h: ih * L.s };
  };
  FS.drawLayer = function (ctx, L) {
    ctx.save();
    ctx.globalAlpha = L.opacity == null ? 1 : L.opacity;
    ctx.translate(L.x, L.y); ctx.rotate((L.r || 0) * Math.PI / 180);
    if (L.flip) ctx.scale(-1, 1);
    if (L.shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = (L.size || 80) * 0.18; ctx.shadowOffsetY = (L.size || 80) * 0.06; }
    var b = FS.layerBox(L, ctx);
    if (L.type === 'text') {
      ctx.font = fontStr(L); ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      if ('letterSpacing' in ctx) ctx.letterSpacing = (L.spacing || 0) + 'px';
      if (L.bgOn) { ctx.fillStyle = L.bg || '#000'; roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, L.size * 0.25); ctx.fill(); ctx.shadowColor = 'transparent'; }
      var al = L.align || 'center'; ctx.textAlign = al === 'right' ? 'right' : al === 'left' ? 'left' : 'center';
      var tx = al === 'right' ? b.w / 2 - b.pad : al === 'left' ? -b.w / 2 + b.pad : 0;
      var fill = L.color || '#fff';
      if (L.grad) { var g = ctx.createLinearGradient(0, -b.h / 2, 0, b.h / 2); g.addColorStop(0, L.color); g.addColorStop(1, L.grad); fill = g; }
      b.lines.forEach(function (t, i) {
        var y = -b.h / 2 + b.pad + b.lh * (i + 0.5);
        if (L.strokeW) { ctx.lineJoin = 'round'; ctx.lineWidth = L.strokeW; ctx.strokeStyle = L.stroke || '#000'; ctx.strokeText(t, tx, y); ctx.shadowColor = 'transparent'; }
        ctx.fillStyle = fill; ctx.fillText(t, tx, y);
      });
    } else if (L.type === 'emoji') {
      ctx.font = L.size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L.ch, 0, L.size * 0.05);
    } else {
      var im = FS.img(L.src); if (im) ctx.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h);
    }
    ctx.restore();
  };
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  FS.roundRect = roundRect;

  FS.handlePos = function (L) { var b = FS.layerBox(L), a = (L.r || 0) * Math.PI / 180, hx = -b.w / 2 - 14, hy = b.h / 2 + 14;
    return { x: L.x + hx * Math.cos(a) - hy * Math.sin(a), y: L.y + hx * Math.sin(a) + hy * Math.cos(a) }; };
  FS.drawSelection = function (ctx, d, L, sc) {
    if (!L || L === 'photo') return;
    var b = FS.layerBox(L), lw = 2 / sc;
    ctx.save(); ctx.translate(L.x, L.y); ctx.rotate((L.r || 0) * Math.PI / 180);
    ctx.strokeStyle = '#e3c98e'; ctx.lineWidth = lw; ctx.setLineDash([8 / sc, 5 / sc]);
    ctx.strokeRect(-b.w / 2 - 6 / sc, -b.h / 2 - 6 / sc, b.w + 12 / sc, b.h + 12 / sc);
    ctx.restore();
    var hp = FS.handlePos(L), r = 13 / sc;
    ctx.save(); ctx.fillStyle = '#e3c98e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(hp.x, hp.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (15 / sc) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⤡', hp.x, hp.y + 1 / sc);
    ctx.restore();
  };
  FS.hitLayer = function (d, x, y) {
    for (var i = d.layers.length - 1; i >= 0; i--) {
      var L = d.layers[i]; if (L.hidden || L.locked) continue;
      var b = FS.layerBox(L), a = -(L.r || 0) * Math.PI / 180, dx = x - L.x, dy = y - L.y;
      var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= b.w / 2 + 8 && Math.abs(ly) <= b.h / 2 + 8) return L;
    }
    return null;
  };

  /* ---------- history (per photo; a step is the page as JSON) ---------- */
  FS.snap = function (p) { p = p || FS.cur(); if (!p) return; var s = JSON.stringify(p.doc); if (p.undo[p.undo.length - 1] === s) return; p.undo.push(s); if (p.undo.length > 60) p.undo.shift(); p.redo = []; FS.emit('history'); };
  /* undo / redo step every photo being edited together (the marked photos in batch editing), or just this one */
  function stepAll(fn) { var c = FS.cur(); if (!c) return; var done = 0; (FS.targets().indexOf(c) >= 0 ? FS.targets() : [c]).forEach(function (p) { if (fn(p)) { p.cache = {}; p._gt = null; done++; } }); if (!done) return; FS.state.sel = null; FS.emit('doc'); FS.emit('history'); FS.refreshStrip && FS.refreshStrip(); }
  FS.undo = function () { stepAll(function (p) { if (p.undo.length < 2) return false; p.redo.push(p.undo.pop()); p.doc = JSON.parse(p.undo[p.undo.length - 1]); return true; }); };
  FS.redo = function () { stepAll(function (p) { if (!p.redo.length) return false; var s = p.redo.pop(); p.undo.push(s); p.doc = JSON.parse(s); return true; }); };
  /* back to the photo as it came in: every edit, frame, text and AI change removed (itself undoable) */
  FS.resetEdits = function () { stepAll(function (p) { if (p.undo.length < 2 && !p.origSrc) return false; if (p.origSrc && FS.unstyle) FS.unstyle(p); if (!p.undo.length) return true; var first = JSON.parse(p.undo[0]); first.photo.bg = { mode: 'none', color: '#ffffff', src: '' }; p.doc = first; FS.snap(p); return true; }); };

  /* ---------- the browser store (IndexedDB): my frames and my designs ---------- */
  var dbp = null;
  FS.db = function () {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no-idb'));
      var r = indexedDB.open('frame-studio', 3);
      r.onupgradeneeded = function () { var db = r.result; ['frames', 'designs', 'deals', 'mydesigns'].forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  };
  function tx(store, mode, fn) { return FS.db().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { rej(t.error); }; }); }); }
  FS.store = {
    all: function (s) { return tx(s, 'readonly', function (st) { return st.getAll(); }); },
    get: function (s, id) { return tx(s, 'readonly', function (st) { return st.get(id); }); },
    put: function (s, v) { return tx(s, 'readwrite', function (st) { st.put(v); }); },
    del: function (s, id) { return tx(s, 'readwrite', function (st) { st.delete(id); }); }
  };
})();
