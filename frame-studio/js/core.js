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
    vibrance: 0, saturation: 0, hue: 0, dehaze: 0, texture: 0, clarity: 0, sharpen: 0, vignette: 0, grain: 0, fade: 0, mono: 0, tone: 'none',
    hsl: null, grade: null, curve: null };   /* the last three are objects, set only while they do something */
  /* the colour mixer's eight bands: id, Hebrew name, swatch, centre hue in degrees */
  FS.HSL_BANDS = [['red', 'אדום', '#e5483e', 0], ['orange', 'כתום', '#ef8a2e', 30], ['yellow', 'צהוב', '#e6cf3c', 60], ['green', 'ירוק', '#4fb64c', 120],
    ['aqua', 'טורקיז', '#3cc3c4', 180], ['blue', 'כחול', '#3d6fe0', 235], ['purple', 'סגול', '#8b52d8', 275], ['magenta', 'מג׳נטה', '#d84aa6', 320]];
  /* nothing to do: every number zero, no tone, no mixer / grading / curve */
  FS.adjPlain = function (a) { if (!a) return true; if (a.tone && a.tone !== 'none') return false; for (var k in FS.ADJ0) if (k !== 'tone' && a[k]) return false; return true; };
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
  /* a small copy of a photo, made once, for thumbnails and tiles */
  FS.smallOf = function (p, max) {
    var im = FS.img(p.src); if (!im) return null;
    if (p._small && p._small.src === p.src && p._small.max >= max) return p._small.c;
    var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); if (k === 1) return im;
    var c = FS.canvas(Math.round(im.naturalWidth * k), Math.round(im.naturalHeight * k)), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    p._small = { src: p.src, max: max, c: c }; return c;
  };
  /* a blob: URL becomes a data URL when it has to leave the page (project files, my designs) */
  /* a canvas to a data URL without blocking the page: toBlob encodes off the main thread (toDataURL freezes it for
     seconds on a big frame). type falls back to PNG when the browser can't write it. */
  FS.canvasURL = function (c, type, q) {
    return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, type || 'image/png', q); }).then(function (b) {
      if (!b || (type && b.type !== type)) return type && type !== 'image/png' ? FS.canvasURL(c, 'image/png') : c.toDataURL('image/png');
      return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(b); });
    });
  };
  FS.toDataURL = function (src) {
    if (!/^blob:/.test(src)) return Promise.resolve(src);
    return fetch(src).then(function (r) { return r.blob(); }).then(FS.fileToDataURL);
  };
  FS.fileToDataURL = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  };
  /* photos are kept as blob URLs (not data URLs), so hundreds of them fit in memory. A big photo is brought down once, on
     arrival, to 2400px on its long side (300dpi on a 15x20 magnet, the biggest) and re-encoded as JPEG: the editor, the AI and the
     print stay fast and light, and the result still prints sharp. */
  FS.PHOTO_MAX = 2400;
  /* The file is read into memory first. A file that can't be read (a cloud copy that isn't on the computer, a removed
     card) fails at once with a clear reason instead of hanging the image decoder, and an iPhone HEIC photo is recognised by
     its header. Each failure carries a Hebrew reason (err.why) that addFiles shows. */
  var SAFARI = /^((?!chrome|chromium|android|edg).)*safari/i.test(navigator.userAgent);
  function why(e, m) { e = e instanceof Error ? e : new Error(String(e)); e.why = m; return e; }
  function readFile(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; r.readAsArrayBuffer(file); });
  }
  /* RAW photos (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF, SRW…): a browser can't develop RAW, but nearly every camera
     stores a full-size JPEG of the same shot inside the file. The biggest JPEG in the file is taken, and the camera's
     orientation (TIFF tag 0x0112) is applied, since the preview inside usually doesn't carry it. */
  FS.RAW_EXT = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|raw|pef|srw|x3f|3fr|erf|kdc|mrw|mos|iiq|rwl)$/i;
  function rawOrientation(u8) {
    try {
      var le = u8[0] === 0x49 && u8[1] === 0x49, be = u8[0] === 0x4d && u8[1] === 0x4d; if (!le && !be) return 1;
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), off = dv.getUint32(4, le), n = dv.getUint16(off, le);
      for (var i = 0; i < n; i++) { var e = off + 2 + i * 12; if (dv.getUint16(e, le) === 0x0112) return dv.getUint16(e + 8, le) || 1; }
    } catch (x) { /* not TIFF-based (RAF, CR3) */ }
    return 1;
  }
  function rawPreview(buf) {
    var u8 = new Uint8Array(buf), best = null, i = 0, n = u8.length;
    while (i < n - 3) {
      if (u8[i] === 0xFF && u8[i + 1] === 0xD8 && u8[i + 2] === 0xFF) {
        /* walk the JPEG's segments to its start-of-scan, then look for its end marker */
        var j = i + 2, ok = false;
        while (j < n - 4 && u8[j] === 0xFF) { var mk = u8[j + 1], len = (u8[j + 2] << 8) | u8[j + 3]; if (mk === 0xDA) { ok = true; j += 2 + len; break; } if (len < 2) break; j += 2 + len; }
        if (ok) {
          var k = j; while (k < n - 1 && !(u8[k] === 0xFF && u8[k + 1] === 0xD9)) k++;
          if (k < n - 1) { var size = k + 2 - i; if (!best || size > best.size) best = { start: i, size: size }; i = k + 2; continue; }
        }
      }
      i++;
    }
    if (!best || best.size < 20000) return null;
    return { blob: new Blob([u8.subarray(best.start, best.start + best.size)], { type: 'image/jpeg' }), orient: rawOrientation(u8) };
  }
  /* a canvas turned by an EXIF orientation value (3 = 180°, 6 = 90° clockwise, 8 = 90° counter-clockwise) */
  function orientCanvas(im, o) {
    var w = im.naturalWidth, h = im.naturalHeight, side = o === 6 || o === 8, c = FS.canvas(side ? h : w, side ? w : h), x = c.getContext('2d');
    if (o === 3) { x.translate(w, h); x.rotate(Math.PI); } else if (o === 6) { x.translate(h, 0); x.rotate(Math.PI / 2); } else if (o === 8) { x.translate(0, w); x.rotate(-Math.PI / 2); }
    x.drawImage(im, 0, 0); return c;
  }
  FS.addPhotoFile = function (file) {
    var url;
    return readFile(file).catch(function (e) { throw why(e, 'הקובץ לא נקרא מהמחשב (אולי הוא בענן, OneDrive או Google Drive, ולא הורד)'); }).then(function (buf) {
      if (!buf || !buf.byteLength) throw why('empty', 'הקובץ ריק');
      var h = new Uint8Array(buf, 0, Math.min(32, buf.byteLength)), tag = String.fromCharCode.apply(null, Array.prototype.slice.call(h, 4, 12));
      var isRaw = FS.RAW_EXT.test(file.name || '') || /^ftypcrx/.test(tag);
      if (!isRaw && /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(tag) && !SAFARI) throw why('heic', 'תמונת HEIC של אייפון, שהדפדפן הזה לא פותח. באייפון: הגדרות ← מצלמה ← תבניות ← "התאמה מרבית", או לשמור כ־JPG');
      if (isRaw) {
        var rp = rawPreview(buf);
        if (!rp) throw why('raw', 'קובץ RAW בלי תמונה מוכנה בתוכו. מייצאים אותו כ־JPG מהמצלמה או מ־Lightroom');
        url = URL.createObjectURL(rp.blob);
        return FS.loadImg(url).then(function (im) {
          if (rp.orient !== 3 && rp.orient !== 6 && rp.orient !== 8) return im;
          var c = orientCanvas(im, rp.orient);
          return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.95); }).then(function (b) { URL.revokeObjectURL(url); delete IMGS[url]; url = URL.createObjectURL(b); return FS.loadImg(url); });
        }).catch(function (e) { throw e && e.why ? e : why(e, 'לא הצלחתי לפתוח את קובץ ה־RAW'); });
      }
      url = URL.createObjectURL(new Blob([buf], { type: file.type || 'image/jpeg' }));
      return FS.loadImg(url).catch(function (e) { throw why(e, 'הקובץ פגום או בפורמט שלא נתמך'); });
    }).then(function (im) {
      var max = FS.PHOTO_MAX;
      if (Math.max(im.naturalWidth, im.naturalHeight) > max || (file.size > 4000000 && !/png|webp/.test(file.type))) {
        var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), cx = c.getContext('2d');
        cx.imageSmoothingQuality = 'high'; cx.drawImage(im, 0, 0, c.width, c.height);
        return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); }).then(function (b) { if (!b) throw why('blob', 'התמונה גדולה מדי לזיכרון של המחשב'); URL.revokeObjectURL(url); delete IMGS[url]; return FS.loadImg(URL.createObjectURL(b)); });
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
    var cl = curveLUT(a.curve), lut = new Float32Array(1024), gam = Math.pow(2, -a.brightness / 100);
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
      v = clamp(v, 0, 1) * 255;
      if (cl) { var ci = v | 0, cf = v - ci; v = ci >= 255 ? cl[255] : cl[ci] + (cl[ci + 1] - cl[ci]) * cf; }
      lut[i] = v;
    }
    return lut;
  }
  /* tone curve: points [[x, y], ...] in 0..255 through a monotone cubic (no overshoot), as a 256 table; null when straight */
  function curveLUT(pts) {
    if (!pts || pts.length < 2) return null;
    var P = pts.slice().sort(function (p, q) { return p[0] - q[0]; }), n = P.length, i, straight = true;
    for (i = 0; i < n; i++) if (Math.abs(P[i][0] - P[i][1]) > 0.5) { straight = false; break; }
    if (straight && P[0][0] <= 0 && P[n - 1][0] >= 255) return null;
    var X = P.map(function (p) { return p[0]; }), Y = P.map(function (p) { return p[1]; }), d = [], m = [];
    for (i = 0; i < n - 1; i++) d[i] = (Y[i + 1] - Y[i]) / Math.max(1e-6, X[i + 1] - X[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (!d[i]) { m[i] = m[i + 1] = 0; continue; }
      var al = m[i] / d[i], be = m[i + 1] / d[i], t = al * al + be * be;
      if (t > 9) { t = 3 / Math.sqrt(t); m[i] = t * al * d[i]; m[i + 1] = t * be * d[i]; }
    }
    var out = new Float32Array(257), j = 0;
    for (var x = 0; x <= 256; x++) {
      var xx = Math.min(x, 255);
      if (xx <= X[0]) { out[x] = clamp(Y[0], 0, 255); continue; }
      if (xx >= X[n - 1]) { out[x] = clamp(Y[n - 1], 0, 255); continue; }
      while (j < n - 2 && xx > X[j + 1]) j++;
      var hh = X[j + 1] - X[j], s = (xx - X[j]) / hh, s2 = s * s, s3 = s2 * s;
      out[x] = clamp((2 * s3 - 3 * s2 + 1) * Y[j] + (s3 - 2 * s2 + s) * hh * m[j] + (-2 * s3 + 3 * s2) * Y[j + 1] + (s3 - s2) * hh * m[j + 1], 0, 255);
    }
    return out;
  }
  FS.curveLUT = curveLUT;
  /* colour mixer: per degree of hue the shift (degrees), saturation and luminance factors, eased between band centres */
  function hslTables(hsl) {
    if (!hsl) return null;
    var B = FS.HSL_BANDS, any = false, vals = B.map(function (b) { var v = hsl[b[0]] || {}; if (v.h || v.s || v.l) any = true; return [(v.h || 0) * 0.3, (v.s || 0) / 100, (v.l || 0) / 100]; });
    if (!any) return null;
    var H = new Float32Array(361), S = new Float32Array(361), L = new Float32Array(361), n = B.length;
    for (var dg = 0; dg <= 360; dg++) {
      var d = dg % 360, j = n - 1;
      for (var k = 0; k < n; k++) if (B[k][3] <= d) j = k;
      var c0 = B[j][3], c1 = j === n - 1 ? B[0][3] + 360 : B[j + 1][3], dd = d < c0 ? d + 360 : d, t = (dd - c0) / (c1 - c0), nx = (j + 1) % n;
      t = t * t * (3 - 2 * t);
      H[dg] = vals[j][0] * (1 - t) + vals[nx][0] * t; S[dg] = vals[j][1] * (1 - t) + vals[nx][1] * t; L[dg] = vals[j][2] * (1 - t) + vals[nx][2] * t;
    }
    return { h: H, s: S, l: L };
  }
  /* one pixel through the colour mixer: its hue picks the band; hue turns with the chroma kept, then saturation and luminance */
  function hslPixel(r, g, b, T, o) {
    var mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b), c = mx - mn, hh, di, cw, q, L0, sec, fr;
    if (c > 0.5) {
      hh = mx === r ? (g - b) / c : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; if (hh < 0) hh += 6;
      di = (hh * 60) | 0; if (di > 360) di = 360; cw = c / 76; if (cw > 1) cw = 1;
      if (T.h[di]) {
        hh += T.h[di] * cw / 60; if (hh < 0) hh += 6; else if (hh >= 6) hh -= 6;
        sec = hh | 0; fr = hh - sec;
        if (sec === 0) { r = mx; g = mn + c * fr; b = mn; } else if (sec === 1) { r = mx - c * fr; g = mx; b = mn; } else if (sec === 2) { r = mn; g = mx; b = mn + c * fr; }
        else if (sec === 3) { r = mn; g = mx - c * fr; b = mx; } else if (sec === 4) { r = mn + c * fr; g = mn; b = mx; } else { r = mx; g = mn; b = mx - c * fr; }
      }
      if (T.s[di]) { L0 = 0.299 * r + 0.587 * g + 0.114 * b; q = 1 + T.s[di] * (T.s[di] > 0 ? cw : 1); r = L0 + (r - L0) * q; g = L0 + (g - L0) * q; b = L0 + (b - L0) * q; }
      if (T.l[di]) { q = T.l[di] * 0.6 * cw; if (q > 0) { r += (255 - r) * q * 0.7; g += (255 - g) * q * 0.7; b += (255 - b) * q * 0.7; } else { r *= 1 + q; g *= 1 + q; b *= 1 + q; } }
    }
    o[0] = r; o[1] = g; o[2] = b;
  }
  /* the mixer's change on a 33 x 33 x 33 grid of colours, kept while the mixer stays the same (quick previews add the nearest) */
  var hslGrid = { key: '', d: null };
  function hslDelta(hsl, T) {
    var key = JSON.stringify(hsl); if (hslGrid.key === key) return hslGrid.d;
    var d = new Float32Array(35937 * 3), o = [0, 0, 0], j = 0, ri, gi, bi, r, g, b;
    for (ri = 0; ri < 33; ri++) for (gi = 0; gi < 33; gi++) for (bi = 0; bi < 33; bi++) {
      r = Math.min(255, ri * 7.96875); g = Math.min(255, gi * 7.96875); b = Math.min(255, bi * 7.96875);
      hslPixel(r, g, b, T, o); d[j++] = o[0] - r; d[j++] = o[1] - g; d[j++] = o[2] - b;
    }
    hslGrid = { key: key, d: d }; return d;
  }
  /* the pure colour of a hue (0..360) minus its own luminance: a tint that does not brighten or darken */
  function hueTint(h) {
    var x = ((h % 360) + 360) % 360 / 60, c = 1 - Math.abs(x % 2 - 1), r, g, b;
    if (x < 1) { r = 1; g = c; b = 0; } else if (x < 2) { r = c; g = 1; b = 0; } else if (x < 3) { r = 0; g = 1; b = c; } else if (x < 4) { r = 0; g = c; b = 1; } else if (x < 5) { r = c; g = 0; b = 1; } else { r = 1; g = 0; b = c; }
    var l = 0.299 * r + 0.587 * g + 0.114 * b; return [r - l, g - l, b - l];
  }
  FS.hueTint = hueTint;
  /* colour grading: shadows / midtones / highlights each {h, s}, bal shifts the split; a 256 x rgb table of additions by luminance */
  function gradeLUT(gr) {
    if (!gr) return null;
    var Z = [['sh', 62], ['mid', 52], ['hi', 54]], T = [], any = false;
    Z.forEach(function (z) { var v = gr[z[0]] || {}, t = hueTint(v.h || 0), k = (v.s || 0) / 100 * z[1]; if (k) any = true; T.push([t[0] * k, t[1] * k, t[2] * k]); });
    if (!any) return null;
    var out = new Float32Array(256 * 3), e = Math.pow(2, -(gr.bal || 0) / 60);
    for (var i = 0; i < 256; i++) {
      var u = Math.pow(i / 255, e), ws = (1 - u) * (1 - u), wh = u * u, wm = 1 - ws - wh;
      for (var c = 0; c < 3; c++) out[i * 3 + c] = T[0][c] * ws + T[1][c] * wm * 1.4 + T[2][c] * wh;
    }
    return out;
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
    /* an untouched photo is only drawn: reading and writing back every pixel is the slow part, so it is skipped */
    var plain = FS.adjPlain(a) && !(d.photo.blurs && d.photo.blurs.length) && !(d.photo.skin && d.photo.skin.amt) && !(d.photo.style && d.photo.style.id) && !(bg && bg.mode !== 'none' && p.mask);
    var c = FS.canvas(w, h), x = c.getContext('2d', plain ? undefined : { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
    if (plain) { p.cache = { key: key, canvas: c }; return c; }
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
    if (FS.adjPlain(a)) return;
    var lut = toneLUT(a), ex = Math.pow(2, a.exposure / 50);
    /* the optional stages build their tables once per call and cost nothing per pixel when unused */
    var HT = hslTables(a.hsl), HD = HT && fast ? hslDelta(a.hsl, HT) : null, HO = [0, 0, 0], GL = gradeLUT(a.grade), dz = (a.dehaze || 0) / 100 * 0.55;
    var c, di, q, TN = { sepia: 1, cool: 2, gold: 3, teal: 4 }[a.tone] || (SPLIT[a.tone] ? 5 : 0), SPT = SPLIT[a.tone];
    var tr = a.temp * 0.32 + a.tint * 0.1, tg = -a.tint * 0.3, tb = -a.temp * 0.32 + a.tint * 0.1;
    var hm = a.hue ? hueMatrix(a.hue) : null, sat = 1 + a.saturation / 100, vib = a.vibrance / 100, mono = a.mono / 100;
    var n = px.length, i, r, g, b, L, mx, mn, f;
    for (i = 0; i < n; i += 4) {
      r = (px[i] + tr) * ex; g = (px[i + 1] + tg) * ex; b = (px[i + 2] + tb) * ex;
      r = lut[clamp(r * 4.0118 | 0, 0, 1023)]; g = lut[clamp(g * 4.0118 | 0, 0, 1023)]; b = lut[clamp(b * 4.0118 | 0, 0, 1023)];
      if (dz > 0) { /* dehaze: the darkest channel stands in for the haze, which is taken off towards a white airlight */
        mn = r < g ? (r < b ? r : b) : (g < b ? g : b); q = 1 - dz * (mn > 0 ? mn / 255 : 0); f = 255 * (1 - q);
        q = 1 / q; r = (r - f) * q; g = (g - f) * q; b = (b - f) * q;
      } else if (dz < 0) { q = -dz * 0.6; r += (212 - r) * q; g += (214 - g) * q; b += (218 - b) * q; }
      if (hm) { var r2 = r * hm[0] + g * hm[1] + b * hm[2], g2 = r * hm[3] + g * hm[4] + b * hm[5]; b = r * hm[6] + g * hm[7] + b * hm[8]; r = r2; g = g2; }
      if (HT) { /* colour mixer: exact per pixel for the final picture, a cached 33^3 table of changes for the quick preview */
        if (HD) { di = ((r <= 0 ? 0 : r >= 255 ? 32 : (r * 0.12549 + 0.5) | 0) * 1089 + (g <= 0 ? 0 : g >= 255 ? 32 : (g * 0.12549 + 0.5) | 0) * 33 + (b <= 0 ? 0 : b >= 255 ? 32 : (b * 0.12549 + 0.5) | 0)) * 3; r += HD[di]; g += HD[di + 1]; b += HD[di + 2]; }
        else { hslPixel(r, g, b, HT, HO); r = HO[0]; g = HO[1]; b = HO[2]; }
      }
      L = 0.299 * r + 0.587 * g + 0.114 * b;
      f = sat;
      if (vib) { mx = r > g ? (r > b ? r : b) : (g > b ? g : b); mn = r < g ? (r < b ? r : b) : (g < b ? g : b); f *= 1 + vib * (1 - (mx - mn) / 255) * 1.2; }
      if (f !== 1) { r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f; }
      if (mono) { r += (L - r) * mono; g += (L - g) * mono; b += (L - b) * mono; }
      if (GL) { di = L < 0 ? 0 : L > 255 ? 765 : (L | 0) * 3; r += GL[di]; g += GL[di + 1]; b += GL[di + 2]; }
      if (!TN) { /* no tone */ }
      else if (TN === 1) { var sr = L * 1.07 + 12, sg = L * 0.95 + 4, sb = L * 0.78; r = (r + sr) / 2; g = (g + sg) / 2; b = (b + sb) / 2; }
      else if (TN === 2) { b += 14; r -= 6; }
      else if (TN === 3) { r += 16; g += 8; b -= 10; }
      else if (TN === 4) { var t = L / 255; r += (t - 0.5) * 30 - 6; b += (0.5 - t) * 34 + 4; }
      else { var sp = SPT, u = L / 255, v1 = 1 - u; r += sp[0] * v1 + sp[3] * u; g += sp[1] * v1 + sp[4] * u; b += sp[2] * v1 + sp[5] * u; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    var big = Math.max(w, h);
    if (!fast && (a.clarity || a.sharpen || a.texture)) {
      if (a.texture) { /* texture: fine detail only (a small radius), the large edges clarity works on are left alone */
        var tr0 = Math.max(1, Math.round(big / 700)), bt = boxBlur(boxBlur(px, w, h, tr0), w, h, tr0), ta = a.texture / 100;
        for (i = 0; i < n; i += 4) for (c = 0; c < 3; c++) { q = px[i + c] - bt[i + c]; if (ta > 0) q = q > 28 ? 28 : q < -28 ? -28 : q; px[i + c] += q * ta * (ta > 0 ? 1.3 : 0.95); }
      }
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
