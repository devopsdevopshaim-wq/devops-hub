/* Two print-quality AI tools on this computer (onnxruntime-web, the graphics card through WebGPU, else the processor):
   🔍 הגדלה מקצועית  Real-ESRGAN "realesr-general-x4v3" (Xintao Wang et al., BSD-3-Clause, models/realesrgan/, 4.9 MB, shipped
                     with the site): a small photo becomes about 4000 px, and noise and JPEG blocks are cleaned on the way. A photo
                     that is already big (3000 px and up) is left as it is.
   🙂 שחזור פנים     GFPGAN 1.4 (TencentARC, Apache-2.0; the ONNX build of facefusion/models-3.0.0 on Hugging Face, 340 MB, downloaded
                     once and kept in the browser's storage): every face is found (MediaPipe face landmarks), turned upright onto the
                     FFHQ 512 template by its eyes, nose and mouth corners, restored, and put back with a soft edge, 85% strong, so
                     the person stays who they are. Faces too small to read (eyes under 10 px apart) and big sharp ones are skipped.
   🖨️ איכות הדפסה   both, one after the other.
   Results replace the photo like the other AI designs (the original stays in p.origSrc; "↩ ביטול AI" brings it back). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS || !FS.ortSession) return;
  var ESR = 'models/realesrgan/realesr-general-x4v3.onnx';
  var GFP = { url: 'https://huggingface.co/facefusion/models-3.0.0/resolve/main/gfpgan_1.4.onnx', size: 340299087, cache: 'fs-models-v1' };
  /* the FFHQ 512 template: left eye, right eye, nose tip, mouth left, mouth right (as in the image) */
  var FFHQ = [[0.37691676, 0.46864664], [0.62285697, 0.46912813], [0.50123859, 0.61331904], [0.39308822, 0.72541100], [0.61150205, 0.72490465]];
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  function busy(t, stop) { if (FS.busy) FS.busy(t, stop); }
  function canvasOf(img, W, H) { var c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H); return c; }
  /* one model run at a time on the graphics card (two at once hung WebGPU, v195) */
  var gate = Promise.resolve();
  function serial(f) { var r = gate.then(f); gate = r.catch(function () {}); return r; }

  /* ---------- 🔍 Real-ESRGAN ×4 in tiles ---------- */
  FS.realEsrgan = function (img, progress, stopped) {
    var W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, long = Math.max(W0, H0);
    if (long >= 3000) return Promise.resolve(null);   /* already big enough for any magnet */
    /* the result about 4000 px on the long side (at least twice the photo): the model works at a quarter of that */
    var out = Math.min(4000, Math.max(2400, long * 2)), k = out / 4 / long;
    var W = Math.max(16, Math.round(W0 * k)), H = Math.max(16, Math.round(H0 * k));
    return serial(function () {
      return FS.ortSession(ESR).then(function (s) {
        var ort = window.ort, gpu = FS.ortInfo && FS.ortInfo().gpu, T = gpu ? 192 : 128, P = 12;
        var src = canvasOf(img, W, H), sx = src.getContext('2d', { willReadFrequently: true });
        var res = FS.canvas(W * 4, H * 4), rx = res.getContext('2d'), jobs = [];
        for (var y = 0; y < H; y += T) for (var x = 0; x < W; x += T) jobs.push([x, y]);
        var done = 0;
        return jobs.reduce(function (ch, j) {
          return ch.then(function () {
            if (stopped && stopped()) throw new Error('stopped');
            var x0 = Math.max(0, j[0] - P), y0 = Math.max(0, j[1] - P), x1 = Math.min(W, j[0] + T + P), y1 = Math.min(H, j[1] + T + P), tw = x1 - x0, th = y1 - y0, n = tw * th;
            var d = sx.getImageData(x0, y0, tw, th).data, inp = new Float32Array(3 * n);
            for (var i = 0; i < n; i++) { inp[i] = d[i * 4] / 255; inp[n + i] = d[i * 4 + 1] / 255; inp[2 * n + i] = d[i * 4 + 2] / 255; }
            var feeds = {}; feeds[s.inputNames[0]] = new ort.Tensor('float32', inp, [1, 3, th, tw]);
            return s.run(feeds).then(function (r) {
              var o = r[s.outputNames[0]].data, ow = tw * 4, oh = th * 4, m = ow * oh, im = new ImageData(ow, oh), q = im.data;
              for (var i = 0; i < m; i++) { q[i * 4] = o[i] * 255; q[i * 4 + 1] = o[m + i] * 255; q[i * 4 + 2] = o[2 * m + i] * 255; q[i * 4 + 3] = 255; }
              /* the tile's own part, without the padding: the network saw past the edge, so the seams don't show */
              var cx = (j[0] - x0) * 4, cy = (j[1] - y0) * 4;
              rx.putImageData(im, j[0] * 4 - cx, j[1] * 4 - cy, cx, cy, Math.min(T, W - j[0]) * 4, Math.min(T, H - j[1]) * 4);
              done++; if (progress) progress(done / jobs.length); return tick();
            });
          });
        }, Promise.resolve()).then(function () { return res; });
      });
    });
  };

  /* ---------- 🙂 GFPGAN: the model, once from Hugging Face, kept in the browser's storage ---------- */
  var gfpS = null;
  function gfpCached() { return ('caches' in window) ? caches.open(GFP.cache).then(function (c) { return c.match(GFP.url); }).then(function (r) { return !!r; }, function () { return false; }) : Promise.resolve(false); }
  FS.gfpganReady = gfpCached;
  function gfpBytes(progress) {
    var fromCache = ('caches' in window) ? caches.open(GFP.cache).then(function (c) { return c.match(GFP.url); }).catch(function () { return null; }) : Promise.resolve(null);
    return fromCache.then(function (hit) {
      if (hit) return hit.arrayBuffer();
      return fetch(GFP.url).then(function (r) {
        if (!r.ok || !r.body) throw new Error('download ' + r.status);
        var total = Number(r.headers.get('content-length')) || GFP.size, got = 0, parts = [], rd = r.body.getReader();
        return (function pump() {
          return rd.read().then(function (x) {
            if (x.done) return;
            parts.push(x.value); got += x.value.length; if (progress) progress(got / total);
            return pump();
          });
        })().then(function () {
          var buf = new Uint8Array(got), o = 0; parts.forEach(function (p) { buf.set(p, o); o += p.length; });
          if (got < 1e8) throw new Error('download short');
          if ('caches' in window) caches.open(GFP.cache).then(function (c) { return c.put(GFP.url, new Response(buf.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } })); }).catch(function () { /* not kept: downloaded again next time */ });
          return buf.buffer;
        });
      });
    });
  }
  function gfpSession(progress) {
    if (gfpS) return gfpS;
    /* the runtime and the graphics card choice come from the shared session code: a tiny model loads them first */
    gfpS = FS.ortSession(ESR).then(function () { return gfpBytes(progress); }).then(function (buf) {
      var ort = window.ort, gpu = FS.ortInfo && FS.ortInfo().gpu, base = { graphOptimizationLevel: 'all' };
      var wasm = function () { return ort.InferenceSession.create(new Uint8Array(buf), Object.assign({ executionProviders: ['wasm'] }, base)); };
      return gpu ? ort.InferenceSession.create(new Uint8Array(buf), Object.assign({ executionProviders: ['webgpu', 'wasm'] }, base)).catch(wasm) : wasm();
    });
    gfpS.catch(function () { gfpS = null; });
    return gfpS;
  }

  /* a similarity transform (scale, turn, shift) that takes the points src onto dst, least squares */
  function similarity(src, dst) {
    var n = src.length, sx = 0, sy = 0, dx = 0, dy = 0, i;
    for (i = 0; i < n; i++) { sx += src[i][0]; sy += src[i][1]; dx += dst[i][0]; dy += dst[i][1]; }
    sx /= n; sy /= n; dx /= n; dy /= n;
    var a = 0, b = 0, nn = 0;
    for (i = 0; i < n; i++) { var x = src[i][0] - sx, y = src[i][1] - sy, u = dst[i][0] - dx, v = dst[i][1] - dy; a += x * u + y * v; b += x * v - y * u; nn += x * x + y * y; }
    var c = a / nn, s = b / nn;
    return { a: c, b: s, c: -s, d: c, e: dx - (c * sx - s * sy), f: dy - (s * sx + c * sy) };   /* x' = a x + c y + e, y' = b x + d y + f */
  }
  function invert(m) { var det = m.a * m.d - m.b * m.c; return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det }; }
  /* the five points of a MediaPipe face (478 landmarks), in the order of the template */
  function five(f, k) {
    var P = function (i) { return [f.pts[i].x * k, f.pts[i].y * k]; }, avg = function (i, j) { var a = P(i), b = P(j); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    var e1 = avg(33, 133), e2 = avg(362, 263), m1 = P(61), m2 = P(291);
    var eyes = e1[0] < e2[0] ? [e1, e2] : [e2, e1], mouth = m1[0] < m2[0] ? [m1, m2] : [m2, m1];
    return [eyes[0], eyes[1], P(4), mouth[0], mouth[1]];
  }
  /* the soft edge the restored face is put back with */
  var maskC = null;
  function mask() {
    if (maskC) return maskC;
    var c = FS.canvas(512, 512), x = c.getContext('2d');
    x.filter = 'blur(18px)'; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(256, 270, 196, 232, 0, 0, Math.PI * 2); x.fill(); x.filter = 'none';
    return (maskC = c);
  }
  FS.restoreFaces = function (img, progress, stopped, strength) {
    if (!window.FaceSig) return Promise.resolve(null);
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    return window.FaceSig.detect(img).then(function (faces) {
      if (!faces || !faces.length) return { canvas: null, faces: 0 };
      var out = canvasOf(img, W, H), ox = out.getContext('2d'), used = 0;
      var todo = faces.map(function (f) {
        var k = W / f.canvas.width, pts = five(f, k), eye = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
        return { pts: pts, eye: eye };
      }).filter(function (t) { return t.eye >= 10 && t.eye <= 190; });   /* too small to read, or big and sharp already */
      if (!todo.length) return { canvas: null, faces: 0 };
      return serial(function () {
        return gfpSession(function (f) { if (progress) progress(f, 'download'); }).then(function (s) {
          var ort = window.ort, i = 0;
          return todo.reduce(function (ch, t) {
            return ch.then(function () {
              if (stopped && stopped()) throw new Error('stopped');
              var m = similarity(t.pts, FFHQ.map(function (q) { return [q[0] * 512, q[1] * 512]; }));
              var crop = FS.canvas(512, 512), cx = crop.getContext('2d', { willReadFrequently: true });
              cx.imageSmoothingQuality = 'high'; cx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); cx.drawImage(out, 0, 0); cx.setTransform(1, 0, 0, 1, 0, 0);
              var d = cx.getImageData(0, 0, 512, 512).data, n = 512 * 512, inp = new Float32Array(3 * n);
              for (var j = 0; j < n; j++) { inp[j] = d[j * 4] / 127.5 - 1; inp[n + j] = d[j * 4 + 1] / 127.5 - 1; inp[2 * n + j] = d[j * 4 + 2] / 127.5 - 1; }
              var feeds = {}; feeds[s.inputNames[0]] = new ort.Tensor('float32', inp, [1, 3, 512, 512]);
              return s.run(feeds).then(function (r) {
                var o = r[s.outputNames[0]].data, im = new ImageData(512, 512), q = im.data;
                for (var j = 0; j < n; j++) {
                  q[j * 4] = (Math.max(-1, Math.min(1, o[j])) + 1) * 127.5; q[j * 4 + 1] = (Math.max(-1, Math.min(1, o[n + j])) + 1) * 127.5;
                  q[j * 4 + 2] = (Math.max(-1, Math.min(1, o[2 * n + j])) + 1) * 127.5; q[j * 4 + 3] = 255;
                }
                var face = FS.canvas(512, 512), fx = face.getContext('2d'); fx.putImageData(im, 0, 0);
                fx.globalCompositeOperation = 'destination-in'; fx.drawImage(mask(), 0, 0);
                var inv = invert(m);
                ox.save(); ox.globalAlpha = strength == null ? 0.85 : strength; ox.imageSmoothingQuality = 'high';
                ox.setTransform(inv.a, inv.b, inv.c, inv.d, inv.e, inv.f); ox.drawImage(face, 0, 0); ox.restore();
                used++; i++; if (progress) progress(i / todo.length, 'faces'); return tick();
              });
            });
          }, Promise.resolve()).then(function () { return { canvas: out, faces: used }; });
        });
      });
    });
  };

  /* ---------- the quick workspace's buttons ---------- */
  function sizeNote() { return '(בערך ' + Math.round(GFP.size / 1e6) + ' MB, פעם אחת)'; }
  function askDownload() {
    return gfpCached().then(function (has) {
      if (has || FS.__gfpOk) return true;
      if (FS.__gfpNo) return false;
      var ok = confirm('🙂 שחזור פנים צריך להוריד פעם אחת את מודל GFPGAN ' + sizeNote() + '.\nאחרי זה הוא עובד גם בלי אינטרנט. להוריד עכשיו?');
      if (ok) FS.__gfpOk = true; else { FS.__gfpNo = true; setTimeout(function () { FS.__gfpNo = false; }, 60000); }
      return ok;
    });
  }
  function esr(p, i, n, stopped) {
    var img = FS.img(p.src); if (!img) return Promise.resolve(false);
    return FS.realEsrgan(img, function (f) { busy('🔍 הגדלה מקצועית · ' + (n > 1 ? (i + 1) + ' מתוך ' + n + ' · ' : '') + Math.round(f * 100) + '%'); }, stopped).then(function (c) {
      if (!c) { if (n === 1 && FS.toast) FS.toast('🔍 התמונה כבר גדולה וחדה מספיק להדפסה (3000 פיקסלים ומעלה), אז היא נשארה כמו שהיא.', 5000); return false; }
      return FS.putCanvas(p, c);
    });
  }
  function faces(p, i, n, stopped) {
    var img = FS.img(p.src); if (!img) return Promise.resolve(false);
    return askDownload().then(function (go) {
      if (!go) return false;
      return FS.restoreFaces(img, function (f, phase) {
        busy(phase === 'download' ? '⬇️ מוריד את מודל שחזור הפנים (פעם אחת) · ' + Math.round(f * 100) + '%' : '🙂 שחזור פנים · ' + (n > 1 ? (i + 1) + ' מתוך ' + n + ' · ' : '') + Math.round(f * 100) + '%');
      }, stopped).then(function (r) {
        if (!r || !r.canvas) { if (n === 1 && FS.toast) FS.toast('🙂 לא נמצאו פנים לשחזר בתמונה (או שהן כבר חדות).', 4500); return false; }
        return FS.putCanvas(p, r.canvas);
      });
    });
  }
  if (FS.localPlus && FS.LOCAL_PLUS) {
    FS.localPlus.realesr = esr;
    FS.localPlus.gfpgan = faces;
    /* print quality: faces first (on the photo as shot, where they are found best), then the whole photo larger */
    FS.localPlus.printpro = function (p, i, n, stopped) { return faces(p, i, n, stopped).then(function () { return esr(p, i, n, stopped); }); };
    /* the new upscaler takes the old ×2 button's place (the old one stays for a computer where the new one fails) */
    FS.LOCAL_PLUS = [['printpro', '🖨️ איכות הדפסה (AI)'], ['realesr', '🔍 הגדלה מקצועית ×4'], ['gfpgan', '🙂 שחזור פנים']].concat(FS.LOCAL_PLUS.filter(function (x) { return x[0] !== 'sharp2x'; }));
  }
})();
