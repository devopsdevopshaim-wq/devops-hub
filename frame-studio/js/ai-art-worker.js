/* The AI paintings' network, in its own thread (ai-art.js talks to it), so the program never waits for it.
   The graphics card through OffscreenCanvas when it works, else WebAssembly on the processor (SIMD), which is still a few
   seconds a photo. Messages: {t:'init', base} -> {t:'ready', backend}; {t:'run', n, rgba, w, h, own, ow, oh, vec, s} ->
   {t:'done', n, rgba, w, h, ms} or {t:'error', n, msg}. */
/* global tf */
'use strict';
var nets = null, backend = '', base = '', ownCache = { key: '', v: null };
function load() {
  importScripts(base + 'vendor/tfjs/tf.min.js', base + 'vendor/tfjs/tf-backend-wasm.min.js');
  var tryGl = (typeof OffscreenCanvas !== 'undefined' && !softGL()) ? tf.setBackend('webgl').then(function (ok) {
    if (!ok) return false;
    /* a tiny run proves the card really works here (some drivers report WebGL, then fail on the first program) */
    return tf.ready().then(function () { var x = tf.tidy(function () { return tf.conv2d(tf.ones([1, 8, 8, 3]), tf.ones([3, 3, 3, 4]), 1, 'same').sum(); }); return x.data().then(function () { x.dispose(); return true; }); });
  }).catch(function () { return false; }) : Promise.resolve(false);
  return tryGl.then(function (gl) {
    if (gl) return 'webgl';
    tf.wasm.setWasmPaths(base + 'vendor/tfjs/');
    return tf.setBackend('wasm').then(function (ok) { if (ok) return 'wasm'; return tf.setBackend('cpu').then(function () { return 'cpu'; }); });
  }).then(function (b) {
    backend = b; return models();
  }).then(function () {
    if (backend !== 'webgl') return backend;
    /* a weak (or software) graphics card can be slower than the processor: one warm-up pass, then a timed one */
    return Promise.race([bench(), new Promise(function (r) { setTimeout(function () { r(99999); }, 8000); })]).then(function (ms) {
      if (ms < 700) return backend;
      tf.wasm.setWasmPaths(base + 'vendor/tfjs/');
      return tf.setBackend('wasm').then(function (ok) { if (!ok) return backend; backend = 'wasm'; return models().then(function () { return backend; }); });
    });
  });
}
/* a graphics card emulated in software (SwiftShader, llvmpipe, the Windows basic driver) is far slower than WebAssembly */
function softGL() {
  try {
    var c = new OffscreenCanvas(1, 1), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return true;
    var ext = gl.getExtension('WEBGL_debug_renderer_info'), r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(r);
  } catch (e) { return true; }
}
function models() {
  return Promise.all([tf.loadGraphModel(base + 'models/art/predictor/model.json'), tf.loadGraphModel(base + 'models/art/transformer/model.json')]).then(function (m) { nets = { pred: m[0], trans: m[1] }; });
}
function bench() {
  function once() { var t0 = Date.now(), o = tf.tidy(function () { return nets.trans.predict([tf.zeros([1, 128, 128, 3]), tf.zeros([1, 1, 1, 100])]).sum(); }); return o.data().then(function () { o.dispose(); return Date.now() - t0; }); }
  return once().then(once);
}
function img(rgba, w, h) { return tf.tidy(function () { return tf.tensor3d(new Uint8Array(rgba.buffer || rgba), [h, w, 4]).slice([0, 0, 0], [-1, -1, 3]).toFloat().div(255).expandDims(); }); }
self.onmessage = function (e) {
  var m = e.data;
  if (m.t === 'init') {
    base = m.base;
    load().then(function (b) { self.postMessage({ t: 'ready', backend: b }); }, function (err) { self.postMessage({ t: 'fail', msg: String((err && err.message) || err) }); });
    return;
  }
  if (m.t !== 'run' || !nets) return;
  var t0 = Date.now();
  try {
    var own = null;
    if (m.s < 1 && m.own) {
      if (ownCache.key !== m.ownKey || !ownCache.v) {
        if (ownCache.v) ownCache.v.dispose();
        var oi = img(m.own, m.ow, m.oh); ownCache = { key: m.ownKey, v: nets.pred.predict(oi) }; oi.dispose();
      }
      own = ownCache.v;
    }
    var out = tf.tidy(function () {
      var b = tf.tensor(m.vec, [1, 1, 1, 100]); if (own) b = b.mul(m.s).add(own.mul(1 - m.s));
      var c = img(m.rgba, m.w, m.h);
      var o = nets.trans.predict([c, b]).squeeze().clipByValue(0, 1).mul(255);
      return tf.concat([o, tf.fill([o.shape[0], o.shape[1], 1], 255)], 2).toInt();
    });
    var h = out.shape[0], w = out.shape[1];
    out.data().then(function (d) {
      out.dispose();
      var px = new Uint8ClampedArray(d.length); px.set(d);
      self.postMessage({ t: 'done', n: m.n, rgba: px.buffer, w: w, h: h, ms: Date.now() - t0 }, [px.buffer]);
    }, function (err) { self.postMessage({ t: 'error', n: m.n, msg: String((err && err.message) || err) }); });
  } catch (err) { self.postMessage({ t: 'error', n: m.n, msg: String((err && err.message) || err) }); }
};
