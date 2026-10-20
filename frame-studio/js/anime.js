/* AI styles that run in the browser: AnimeGANv2 "face paint" (MIT) through onnxruntime-web, WebGPU when the computer has
   it, WebAssembly otherwise. No server, no quota, and the faces stay recognizable. The photo is processed in 512px tiles
   with feathered overlaps, so group photos keep their detail. */
(function () {
  'use strict';
  var FS = window.FS;
  var ORT = new URL('vendor/ort/', location.href).href;   /* shipped with the site: works offline */
  var MODEL = 'models/face-paint-512-v2.onnx', T = 512, OV = 64;
  var session = null;

  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('offline')); }; document.head.appendChild(s); }); }
  function getSession() {
    if (session) return session;
    session = (window.ort ? Promise.resolve() : loadScript(ORT + 'ort.wasm.min.js')).then(function () {
      var ort = window.ort; ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1;
      var eps = ['wasm']; ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1) > 1 && self.crossOriginIsolated ? 4 : 1;
      return ort.InferenceSession.create(MODEL, { executionProviders: eps }).catch(function () { return ort.InferenceSession.create(MODEL, { executionProviders: ['wasm'] }); });
    });
    session.catch(function () { session = null; });
    return session;
  }
  FS.animeReady = getSession;

  /* one 512 tile: canvas pixels -> -1..1 CHW -> model -> RGB floats 0..255 */
  function runTile(s, data) {
    var n = T * T, x = new Float32Array(3 * n);
    for (var i = 0; i < n; i++) { x[i] = data[i * 4] / 127.5 - 1; x[n + i] = data[i * 4 + 1] / 127.5 - 1; x[2 * n + i] = data[i * 4 + 2] / 127.5 - 1; }
    var feeds = {}; feeds[s.inputNames[0]] = new window.ort.Tensor('float32', x, [1, 3, T, T]);
    return s.run(feeds).then(function (out) { return out[s.outputNames[0]].getData ? out[s.outputNames[0]].getData() : out[s.outputNames[0]].data; });
  }
  function ramp(i, len, lo, hi) { var w = 1; if (lo && i < OV) w = Math.min(w, (i + 0.5) / OV); if (hi && i >= len - OV) w = Math.min(w, (len - i - 0.5) / OV); return Math.max(w, 0.001); }

  /* img -> canvas in anime style. long side up to `size` (min 512), tiles of 512 that overlap by 64 */
  FS.animeCanvas = function (img, size, progress) {
    return getSession().then(function (s) {
      var W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
      var k = Math.max(T / Math.min(W0, H0), Math.min(1, (size || 1024) / Math.max(W0, H0)));
      var W = Math.max(T, Math.round(W0 * k)), H = Math.max(T, Math.round(H0 * k));
      var src = FS.canvas(W, H), sx = src.getContext('2d', { willReadFrequently: true }); sx.imageSmoothingQuality = 'high'; sx.drawImage(img, 0, 0, W, H);
      var step = T - OV, xs = [], ys = [];
      for (var a = 0; ; a += step) { xs.push(Math.min(a, W - T)); if (a + T >= W) break; }
      for (var b = 0; ; b += step) { ys.push(Math.min(b, H - T)); if (b + T >= H) break; }
      var acc = new Float32Array(W * H * 3), wsum = new Float32Array(W * H), jobs = [];
      ys.forEach(function (y0, yi) { xs.forEach(function (x0, xi) { jobs.push([x0, y0, xi > 0, xi < xs.length - 1, yi > 0, yi < ys.length - 1]); }); });
      var chain = Promise.resolve(), done = 0;
      jobs.forEach(function (j) {
        chain = chain.then(function () {
          var data = sx.getImageData(j[0], j[1], T, T).data;
          return runTile(s, data).then(function (o) {
            var n = T * T;
            for (var yy = 0; yy < T; yy++) {
              var wy = ramp(yy, T, j[4], j[5]);
              for (var xx = 0; xx < T; xx++) {
                var w = wy * ramp(xx, T, j[2], j[3]), p = yy * T + xx, q = (j[1] + yy) * W + j[0] + xx;
                acc[q * 3] += (o[p] + 1) * 127.5 * w; acc[q * 3 + 1] += (o[n + p] + 1) * 127.5 * w; acc[q * 3 + 2] += (o[2 * n + p] + 1) * 127.5 * w; wsum[q] += w;
              }
            }
            done++; if (progress) progress(done, jobs.length);
            return new Promise(function (r) { setTimeout(r, 0); });
          });
        });
      });
      return chain.then(function () {
        var out = sx.createImageData(W, H), d = out.data;
        for (var i = 0; i < W * H; i++) { var ws = wsum[i] || 1; d[i * 4] = acc[i * 3] / ws; d[i * 4 + 1] = acc[i * 3 + 1] / ws; d[i * 4 + 2] = acc[i * 3 + 2] / ws; d[i * 4 + 3] = 255; }
        sx.putImageData(out, 0, 0);
        if (W === Math.round(W0 * k) && H === Math.round(H0 * k)) return src;
        var c = FS.canvas(Math.round(W0 * k), Math.round(H0 * k)); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
      });
    });
  };
})();
