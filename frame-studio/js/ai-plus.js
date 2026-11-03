/* More built-in AI for the quick workspace ("🖥️ מיד, על המחשב"), all on this computer, offline:
   🔍 חדות ×2      a super-resolution network (RDN ×2, UpscalerJS "esrgan-medium", MIT) with TensorFlow.js on the graphics
                   card (WebGL): every photo comes out twice as large and sharper; big camera photos are first brought to
                   1800 px, so the result (3600 px) is crisp at any magnet size.
   💡 תאורת אולם   the hall's yellow / blue light balanced (grey world on the mid-tones), the faces brought to a good
                   exposure (measured on the faces themselves) and a little local contrast; no model.
   📸 עדשה מקצועית the person sharp, the background melted like a fast portrait lens: stronger further from the people,
                   with round bokeh lights from the bright spots behind them and a soft vignette.
   ✂️ הסרת רקע מדויקת  the person's mask from MODNet (Apache-2.0, quantized, onnxruntime): hair-fine edges. It replaces
                   the photo's mask, so every background tool (white, B&W, blur, cut-out) uses it after that.
   🎞️ תמונה חיה 3D  the living photo (wow.js) opened from here.
   Results replace the photo like the other AI designs: the original stays in p.origSrc ("↩ ביטול AI" brings it back). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('script')); }; document.head.appendChild(s); }); }
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function busy(t, stop) { if (FS.busy) FS.busy(t, stop); }
  function imgOf(p) { return FS.img(p.src); }
  function draw(img, W, H) { var c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H); return c; }
  function fit(img, max) { var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }
  function blurred(src, r) { var c = FS.canvas(src.width, src.height), x = c.getContext('2d', { willReadFrequently: true }); x.filter = 'blur(' + Math.max(0, r) + 'px)'; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }
  function px(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  /* the result in place of the photo (kept like a cloud AI design: undo and "back to the original") */
  function put(p, c, keepMask) {
    return new Promise(function (ok, no) { c.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.94); })
      .then(function (b) { return FS.loadImg(URL.createObjectURL(b)); }).then(function (im) {
        if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
        var m = keepMask ? p.mask : null;
        p.src = im.src; p.cache = {}; p.mask = m; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null; p._gt = null; p._pt = null;
        FS.fitPhoto(p.doc, im); FS.snap(p); return p;
      });
  }

  /* ---------- 🔍 ×2 super-resolution (TensorFlow.js, WebGL) ---------- */
  var tfP = null;
  function upModel() {
    if (tfP) return tfP;
    tfP = (window.tf ? Promise.resolve() : loadScript(new URL('vendor/tfjs/tf.min.js', location.href).href)).then(function () {
      var tf = window.tf;
      try { tf.env().set('SOFTWARE_WEBGL_ENABLED', true); } catch (e) { /* older tfjs */ }   /* a computer whose driver Chromium refuses still gets WebGL (much faster than the plain CPU path) */
      return tf.setBackend('webgl').catch(function () { return false; }).then(function (ok) { return ok ? ok : tf.setBackend('cpu'); }).then(function () { return tf.ready(); })
        .then(function () { return tf.loadLayersModel(new URL('models/esrgan-x2/model.json', location.href).href); });
    });
    tfP.catch(function () { tfP = null; });
    return tfP;
  }
  FS.upscale2x = function (img, progress, stopped) {
    return upModel().then(function (m) {
      var tf = window.tf, sz = fit(img, tf.getBackend() === 'webgl' ? 1800 : 900), W = sz[0], H = sz[1], src = draw(img, W, H), sx = src.getContext('2d', { willReadFrequently: true });
      var out = FS.canvas(W * 2, H * 2), ox = out.getContext('2d'), T = tf.getBackend() === 'webgl' ? 192 : 128, P = 10, jobs = [];
      for (var y = 0; y < H; y += T) for (var x = 0; x < W; x += T) jobs.push([x, y]);
      var done = 0;
      return jobs.reduce(function (ch, j) {
        return ch.then(function () {
          if (stopped && stopped()) throw new Error('stopped');
          var x0 = Math.max(0, j[0] - P), y0 = Math.max(0, j[1] - P), x1 = Math.min(W, j[0] + T + P), y1 = Math.min(H, j[1] + T + P), tw = x1 - x0, th = y1 - y0;
          var id = sx.getImageData(x0, y0, tw, th);
          var t = tf.tidy(function () { return m.predict(tf.browser.fromPixels(id).toFloat().expandDims(0)).squeeze().clipByValue(0, 255).round().toInt(); });
          return t.data().then(function (d) {
            t.dispose();
            var ow = tw * 2, oh = th * 2, o = new ImageData(ow, oh);
            for (var i = 0, k = 0; i < ow * oh; i++) { o.data[k++] = d[i * 3]; o.data[k++] = d[i * 3 + 1]; o.data[k++] = d[i * 3 + 2]; o.data[k++] = 255; }
            /* the tile's own part, without the padding (the network sees past the edge, the seams don't show) */
            var cx = (j[0] - x0) * 2, cy = (j[1] - y0) * 2, cw = Math.min(T, W - j[0]) * 2, chh = Math.min(T, H - j[1]) * 2;
            ox.putImageData(o, j[0] * 2 - cx, j[1] * 2 - cy, cx, cy, cw, chh);
            done++; if (progress) progress(done / jobs.length); return tick();
          });
        });
      }, Promise.resolve()).then(function () { return out; });
    });
  };

  /* ---------- 💡 the hall's light ---------- */
  function hall(p) {
    var img = imgOf(p); if (!img) return Promise.resolve(false);
    return Promise.resolve(FS.findFaces ? FS.findFaces(p, true) : []).catch(function () { return []; }).then(function (faces) {
      var sz = fit(img, 3000), W = sz[0], H = sz[1], c = draw(img, W, H), id = px(c), d = id.data, n = W * H, i;
      /* 1. white balance from the mid-tones (no highlights, no deep shadows), 75% of the way */
      var sr = 0, sg = 0, sb = 0, cnt = 0;
      for (i = 0; i < n; i += 3) { var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], l = (r + g + b) / 3; if (l > 35 && l < 225) { sr += r; sg += g; sb += b; cnt++; } }
      var gr = 1, gg = 1, gb = 1;
      if (cnt > 100) { var m = (sr + sg + sb) / 3; gr = clamp(1 + (m / sr - 1) * 0.75, 0.8, 1.3); gg = clamp(1 + (m / sg - 1) * 0.75, 0.8, 1.3); gb = clamp(1 + (m / sb - 1) * 0.75, 0.8, 1.3); }
      /* 2. the faces' brightness (after the balance) to about 58% */
      var iw = img.naturalWidth || img.width, kx = W / iw, fl = 0, fn = 0;
      (faces || []).forEach(function (f) {
        var x0 = Math.max(0, Math.round((f.x + f.w * 0.2) * kx)), y0 = Math.max(0, Math.round((f.y + f.h * 0.25) * kx)), x1 = Math.min(W, Math.round((f.x + f.w * 0.8) * kx)), y1 = Math.min(H, Math.round((f.y + f.h * 0.8) * kx));
        for (var yy = y0; yy < y1; yy += 2) for (var xx = x0; xx < x1; xx += 2) { var q = (yy * W + xx) * 4; fl += 0.299 * d[q] * gr + 0.587 * d[q + 1] * gg + 0.114 * d[q + 2] * gb; fn++; }
      });
      var gam = 1;
      if (fn > 50) { var mean = clamp(fl / fn / 255, 0.05, 0.95); gam = clamp(Math.log(0.58) / Math.log(mean), 0.6, 1.5); }
      else { var al = 0, an = 0; for (i = 0; i < n; i += 7) { al += (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765; an++; } var am = clamp(al / an, 0.05, 0.95); gam = clamp(Math.log(0.47) / Math.log(am), 0.75, 1.3); }
      var lut = new Uint8ClampedArray(256 * 3);
      for (var v = 0; v < 256; v++) {
        [gr, gg, gb].forEach(function (gc, ch) { var x = Math.min(1, v * gc / 255), y = Math.pow(x, gam); y = y + (x - y) * Math.pow(x, 6); lut[ch * 256 + v] = Math.round(y * 255); });   /* the top stays: no burnt highlights */
      }
      for (i = 0; i < n; i++) { var q2 = i * 4; d[q2] = lut[d[q2]]; d[q2 + 1] = lut[256 + d[q2 + 1]]; d[q2 + 2] = lut[512 + d[q2 + 2]]; }
      c.getContext('2d').putImageData(id, 0, 0);
      /* 3. a little local contrast (a wide unsharp mask) */
      var bl = px(blurred(c, Math.max(6, Math.round(Math.max(W, H) / 60)))).data, o = px(c), od = o.data;
      for (i = 0; i < n * 4; i++) { if ((i & 3) === 3) continue; od[i] = od[i] + (od[i] - bl[i]) * 0.22; }
      c.getContext('2d').putImageData(o, 0, 0);
      return put(p, c);
    });
  }

  /* ---------- 📸 the portrait lens ---------- */
  function bokeh(p) {
    var img = imgOf(p); if (!img) return Promise.resolve(false);
    return FS.ensureMask(p).then(function (mask) {
      if ((p.maskCover || 0) < 0.015) return false;
      var sz = fit(img, 2600), W = sz[0], H = sz[1], R = Math.max(6, Math.round(Math.max(W, H) / 70));
      var pic = draw(img, W, H), far = blurred(pic, R), near = blurred(pic, R * 0.4);
      var mk = FS.canvas(W, H), mx = mk.getContext('2d', { willReadFrequently: true }); mx.imageSmoothingQuality = 'high'; mx.drawImage(mask, 0, 0, W, H);
      var M = px(mk).data, spread = px(blurred(mk, R * 2.5)).data;
      /* round lights from the bright spots of the background, drawn on the far blur */
      var fx = far.getContext('2d'), pd = px(pic).data, cell = Math.max(24, Math.round(Math.max(W, H) / 40)), lights = [];
      for (var cy = 0; cy < H; cy += cell) for (var cx = 0; cx < W; cx += cell) {
        var best = 0, bx = 0, by = 0;
        for (var y = cy; y < Math.min(H, cy + cell); y += 3) for (var x = cx; x < Math.min(W, cx + cell); x += 3) { var q = (y * W + x) * 4, l = pd[q] * 0.3 + pd[q + 1] * 0.59 + pd[q + 2] * 0.11; if (l > best && M[q] < 40 && spread[q] < 90) { best = l; bx = x; by = y; } }
        if (best > 228) lights.push([bx, by, best]);
      }
      lights.sort(function (a, b) { return b[2] - a[2]; }).slice(0, 70).forEach(function (L, k) {
        var q = (L[1] * W + L[0]) * 4, r = R * (1.1 + (k % 5) * 0.18), col = pd[q] + ',' + pd[q + 1] + ',' + pd[q + 2];
        var g = fx.createRadialGradient(L[0], L[1], r * 0.2, L[0], L[1], r);
        g.addColorStop(0, 'rgba(' + col + ',.35)'); g.addColorStop(0.82, 'rgba(' + col + ',.42)'); g.addColorStop(0.93, 'rgba(' + col + ',.55)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        fx.save(); fx.globalCompositeOperation = 'screen'; fx.fillStyle = g; fx.beginPath(); fx.arc(L[0], L[1], r, 0, 6.29); fx.fill(); fx.restore();
      });
      var F = px(far).data, N = px(near).data, out = px(pic), O = out.data, I = pd;
      for (var i = 0; i < W * H; i++) {
        var o4 = i * 4, m = M[o4] / 255, s = spread[o4] / 255, nearW = Math.min(1, s * 1.6);
        for (var ch = 0; ch < 3; ch++) { var bg = N[o4 + ch] * nearW + F[o4 + ch] * (1 - nearW); O[o4 + ch] = I[o4 + ch] * m + bg * (1 - m); }
      }
      var c = FS.canvas(W, H), x2 = c.getContext('2d'); x2.putImageData(out, 0, 0);
      var v = x2.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)'); x2.fillStyle = v; x2.fillRect(0, 0, W, H);
      return put(p, c, true);
    });
  }

  /* ---------- ✂️ MODNet, a hair-fine person mask ---------- */
  FS.maskPro = function (p) {
    var img = imgOf(p); if (!img || !FS.ortSession) return Promise.reject(new Error('img'));
    return FS.ortSession('models/modnet/modnet-q.onnx').then(function (s) {
      var iw = img.naturalWidth, ih = img.naturalHeight, k = 512 / Math.min(iw, ih);
      var W = Math.max(32, Math.round(iw * k / 32) * 32), H = Math.max(32, Math.round(ih * k / 32) * 32);
      if (Math.max(W, H) > 1024) { var k2 = 1024 / Math.max(W, H); W = Math.max(32, Math.round(W * k2 / 32) * 32); H = Math.max(32, Math.round(H * k2 / 32) * 32); }
      var d = px(draw(img, W, H)).data, n = W * H, x = new Float32Array(3 * n);
      for (var i = 0; i < n; i++) { x[i] = d[i * 4] / 127.5 - 1; x[n + i] = d[i * 4 + 1] / 127.5 - 1; x[2 * n + i] = d[i * 4 + 2] / 127.5 - 1; }
      var feeds = {}; feeds[s.inputNames[0]] = new window.ort.Tensor('float32', x, [1, 3, H, W]);
      return s.run(feeds).then(function (out) {
        var a = out[s.outputNames[0]].data, lc = FS.canvas(W, H), lx = lc.getContext('2d'), ld = lx.createImageData(W, H), cover = 0;
        for (var i = 0; i < n; i++) { var v = clamp(a[i], 0, 1); cover += v; ld.data[i * 4] = ld.data[i * 4 + 1] = ld.data[i * 4 + 2] = v * 255; ld.data[i * 4 + 3] = 255; }
        lx.putImageData(ld, 0, 0);
        var sz = fit(img, 1024), mc = FS.canvas(sz[0], sz[1]), mx = mc.getContext('2d'); mx.imageSmoothingQuality = 'high'; mx.drawImage(lc, 0, 0, sz[0], sz[1]);
        p.mask = mc; p.maskV = (p.maskV || 0) + 1; p.maskCover = cover / n; p.maskPro = true; return mc;
      });
    });
  };
  function cutPro(p) {
    return FS.maskPro(p).then(function () {
      if ((p.maskCover || 0) < 0.015) return false;
      p.doc.photo.bg = Object.assign({ mode: 'none', color: '#ffffff', src: '' }, p.doc.photo.bg, { mode: 'remove' }); FS.snap(p);
    });
  }

  /* ---------- the quick workspace's buttons ---------- */
  FS.LOCAL_PLUS = [['sharp2x', '🔍 חדות ×2 (AI)'], ['hall', '💡 תאורת אולם'], ['bokeh', '📸 עדשה מקצועית'], ['cutpro', '✂️ הסרת רקע מדויקת'], ['live3d', '🎞️ תמונה חיה 3D']];
  FS.localPlus = {
    sharp2x: function (p, i, n, stopped) {
      var img = FS.img(p.src); if (!img) return Promise.resolve(false);
      return FS.upscale2x(img, function (f) { busy('🔍 חדות ×2 · ' + (n > 1 ? (i + 1) + ' מתוך ' + n + ' · ' : '') + Math.round(f * 100) + '%'); }, stopped).then(function (c) {
        var a = p.doc.photo.adj; if (a) a.sharpen = Math.max(a.sharpen || 0, 8); return put(p, c);
      });
    },
    hall: function (p) { return hall(p); },
    bokeh: function (p) { return bokeh(p); },
    cutpro: function (p) { return cutPro(p); },
    live3d: { single: true, run: function (p) { if (!FS.livingPhoto) return Promise.resolve(false); return (p.maskPro || !FS.ortSession ? Promise.resolve() : FS.maskPro(p).catch(function () {})).then(function () { FS.livingPhoto(p); }); } }
  };
})();
