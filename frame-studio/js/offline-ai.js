/* 🖥️ AI designs built into the studio: they run on this computer with onnxruntime-web (WebAssembly), with no server, no quota
   and no internet. The models and the runtime are part of the site and of the desktop program (models/README.md):
     anime      AnimeGANv2 "face paint" (MIT), 512px tiles with feathered overlaps, faces stay recognizable
     mosaic / candy / rain / udnie / pointil   fast neural style transfer (PyTorch examples, BSD-3), the whole photo at once
   The result replaces the photo the same way a cloud AI design does (the original stays in p.origSrc; "↩ ביטול AI" undoes it). */
(function () {
  'use strict';
  var FS = window.FS;
  var ORT = new URL('vendor/ort/', location.href).href;
  FS.OFFLINE_AI = [
    ['anime', 'אנימה', '🌸', 'models/face-paint-512-v2.onnx'],
    ['mosaic', 'פסיפס צבעוני', '🔷', 'models/style/mosaic.onnx'],
    ['candy', 'סוכריות פופ', '🍬', 'models/style/candy.onnx'],
    ['rain', 'ציור גשם רומנטי', '🌧️', 'models/style/rain-princess.onnx'],
    ['udnie', 'קוביזם מודרני', '🎭', 'models/style/udnie.onnx'],
    ['pointil', 'פוינטיליזם', '🔴', 'models/style/pointilism.onnx']
  ];
  var sessions = {}, rt = null;
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('ort')); }; document.head.appendChild(s); }); }
  function runtime() {
    if (rt) return rt;
    rt = (window.ort ? Promise.resolve() : loadScript(ORT + 'ort.wasm.min.js')).then(function () {
      var ort = window.ort; ort.env.wasm.wasmPaths = ORT;
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      return ort;
    });
    rt.catch(function () { rt = null; });
    return rt;
  }
  function session(path) {
    if (sessions[path]) return sessions[path];
    sessions[path] = runtime().then(function (ort) { return ort.InferenceSession.create(new URL(path, location.href).href, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); });
    sessions[path].catch(function () { delete sessions[path]; });
    return sessions[path];
  }
  function data(t) { return t.data; }   /* a CPU tensor's values (getData() is async in onnxruntime-web 1.20) */
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  /* AnimeGANv2: 512 tiles, -1..1 in and out */
  var T = 512, OV = 64;
  function ramp(i, len, lo, hi) { var w = 1; if (lo && i < OV) w = Math.min(w, (i + 0.5) / OV); if (hi && i >= len - OV) w = Math.min(w, (len - i - 0.5) / OV); return Math.max(w, 0.001); }
  function anime(s, img, size, progress) {
    var W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
    var k = Math.max(T / Math.min(W0, H0), Math.min(1, size / Math.max(W0, H0)));
    var W = Math.max(T, Math.round(W0 * k)), H = Math.max(T, Math.round(H0 * k));
    var src = FS.canvas(W, H), sx = src.getContext('2d', { willReadFrequently: true }); sx.imageSmoothingQuality = 'high'; sx.drawImage(img, 0, 0, W, H);
    var step = T - OV, xs = [], ys = [], a, b;
    for (a = 0; ; a += step) { xs.push(Math.min(a, W - T)); if (a + T >= W) break; }
    for (b = 0; ; b += step) { ys.push(Math.min(b, H - T)); if (b + T >= H) break; }
    var acc = new Float32Array(W * H * 3), wsum = new Float32Array(W * H), jobs = [], done = 0;
    ys.forEach(function (y0, yi) { xs.forEach(function (x0, xi) { jobs.push([x0, y0, xi > 0, xi < xs.length - 1, yi > 0, yi < ys.length - 1]); }); });
    return jobs.reduce(function (ch, j) {
      return ch.then(function () {
        var px = sx.getImageData(j[0], j[1], T, T).data, n = T * T, x = new Float32Array(3 * n);
        for (var i = 0; i < n; i++) { x[i] = px[i * 4] / 127.5 - 1; x[n + i] = px[i * 4 + 1] / 127.5 - 1; x[2 * n + i] = px[i * 4 + 2] / 127.5 - 1; }
        var feeds = {}; feeds[s.inputNames[0]] = new window.ort.Tensor('float32', x, [1, 3, T, T]);
        return s.run(feeds).then(function (out) {
          var o = data(out[s.outputNames[0]]);
          for (var yy = 0; yy < T; yy++) { var wy = ramp(yy, T, j[4], j[5]);
            for (var xx = 0; xx < T; xx++) { var w = wy * ramp(xx, T, j[2], j[3]), p = yy * T + xx, q = (j[1] + yy) * W + j[0] + xx;
              acc[q * 3] += (o[p] + 1) * 127.5 * w; acc[q * 3 + 1] += (o[n + p] + 1) * 127.5 * w; acc[q * 3 + 2] += (o[2 * n + p] + 1) * 127.5 * w; wsum[q] += w; } }
          done++; if (progress) progress(done / jobs.length); return tick();
        });
      });
    }, Promise.resolve()).then(function () {
      var out = sx.createImageData(W, H), d = out.data;
      for (var i = 0; i < W * H; i++) { var ws = wsum[i] || 1; d[i * 4] = acc[i * 3] / ws; d[i * 4 + 1] = acc[i * 3 + 1] / ws; d[i * 4 + 2] = acc[i * 3 + 2] / ws; d[i * 4 + 3] = 255; }
      sx.putImageData(out, 0, 0); return src;
    });
  }
  /* fast neural style: the whole photo at once (instance norm keeps the look even), 0..255 in and out */
  function neural(s, img, size, progress) {
    var W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, k = Math.min(1, size / Math.max(W0, H0));
    var W = Math.max(64, Math.round(W0 * k / 4) * 4), H = Math.max(64, Math.round(H0 * k / 4) * 4);
    var c = FS.canvas(W, H), x2 = c.getContext('2d', { willReadFrequently: true }); x2.imageSmoothingQuality = 'high'; x2.drawImage(img, 0, 0, W, H);
    var px = x2.getImageData(0, 0, W, H), n = W * H, x = new Float32Array(3 * n), d = px.data;
    for (var i = 0; i < n; i++) { x[i] = d[i * 4]; x[n + i] = d[i * 4 + 1]; x[2 * n + i] = d[i * 4 + 2]; }
    if (progress) progress(0.15);
    var feeds = {}; feeds[s.inputNames[0]] = new window.ort.Tensor('float32', x, [1, 3, H, W]);
    return tick().then(function () { return s.run(feeds); }).then(function (out) {
      var o = data(out[s.outputNames[0]]);
      for (var i = 0; i < n; i++) { d[i * 4] = o[i]; d[i * 4 + 1] = o[n + i]; d[i * 4 + 2] = o[2 * n + i]; d[i * 4 + 3] = 255; }
      x2.putImageData(px, 0, 0); if (progress) progress(1); return c;
    });
  }
  /* a photo element -> a canvas in the style (about `size` px on the long side) */
  FS.offlineStyleCanvas = function (id, img, size, progress) {
    var st = FS.OFFLINE_AI.filter(function (x) { return x[0] === id; })[0]; if (!st) return Promise.reject(new Error('style'));
    return session(st[3]).then(function (s) { return id === 'anime' ? anime(s, img, size || 1280, progress) : neural(s, img, size || 1280, progress); });
  };
  FS.offlineReady = function (id) { var st = FS.OFFLINE_AI.filter(function (x) { return x[0] === (id || 'anime'); })[0]; return session(st[3]); };
  FS.animeCanvas = function (img, size, progress) { return FS.offlineStyleCanvas('anime', img, size, progress && function (f) { progress(Math.round(f * 100), 100); }); };

  /* the studio: a built-in design on a photo, kept like a cloud AI design (undo, "back to the original") */
  FS.restyleOffline = function (p, id, progress) {
    var orig = FS.img(p.origSrc || p.src);
    return FS.offlineStyleCanvas(id, orig, 1024, progress).then(function (c) {
      return new Promise(function (ok, no) { c.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.93); });
    }).then(function (b) { return FS.loadImg(URL.createObjectURL(b)); }).then(function (im) {
      if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
      p.src = im.src; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null; p._gt = null; p._pt = null;
      FS.fitPhoto(p.doc, im); FS.snap(p); return p;
    });
  };
})();
