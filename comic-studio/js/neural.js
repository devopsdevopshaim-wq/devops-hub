/* סגנונות AI שרצים בדפדפן: רשתות נוירוניות אמיתיות שאומנו על ציורי אנימה וקריקטורה.
   - AnimeGANv2 (שלושה מודלים, ONNX): פורטרט מצויר, אנימה רכה, אנימה קולנועית
   - CartoonGAN (ארבעה מודלים, TensorFlow.js): קריקטורה מצוירת, אנימה עזה, נוף מצויר, שמיים קולנועיים
   המודלים נטענים מ-unpkg (חבילות npm) בפעם הראשונה ונשמרים בדפדפן. התמונה לא יוצאת מהמחשב. */
(function () {
  'use strict';

  var FX = window.ComicFX;

  var CDNS = ['https://unpkg.com/', 'https://cdn.jsdelivr.net/npm/'];
  var LIB = {
    tf: '@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    tfWasm: '@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js',
    tfWasmDir: '@tensorflow/tfjs-backend-wasm@4.22.0/dist/',
    ort: 'onnxruntime-web@1.20.1/dist/ort.min.js',
    ortDir: 'onnxruntime-web@1.20.1/dist/'
  };

  var MODELS = {
    facepaint: { kind: 'onnx', path: 'sts-animegan@1.0.0/models/face_paint_512_v2_0.onnx', mb: 8.6, square: 512, nchw: true },
    'ag-hayao': { kind: 'onnx', path: 'sts-animegan@1.0.0/models/AnimeGANv2_Hayao.onnx', mb: 8.6, mult: 8 },
    'ag-shinkai': { kind: 'onnx', path: 'sts-animegan@1.0.0/models/AnimeGANv2_Shinkai.onnx', mb: 8.6, mult: 8 },
    'cg-hosoda': { kind: 'tf', path: 'local-tfjs-models@0.0.3/cartoon-GAN/hosoda/model.json', mb: 11, mult: 4 },
    'cg-paprika': { kind: 'tf', path: 'local-tfjs-models@0.0.3/cartoon-GAN/paprika/model.json', mb: 11, mult: 4 },
    'cg-hayao': { kind: 'tf', path: 'local-tfjs-models@0.0.3/cartoon-GAN/hayao/model.json', mb: 11, mult: 4 },
    'cg-shinkai': { kind: 'tf', path: 'local-tfjs-models@0.0.3/cartoon-GAN/shinkai/model.json', mb: 11, mult: 4 }
  };

  var G = 'AI בדפדפן';
  var BASE_KNOBS = ['bright', 'contrast', 'sat'];
  var STYLES = [
    { id: 'nn-comic', name: 'קומיקס AI', model: 'cg-hosoda', post: 'classic', group: G, desc: 'רשת קריקטורה, ועליה קווי דיו ונקודות הדפסה של קומיקס.', knobs: ['lines', 'dots', 'levels', 'sat'], def: { lines: 45, dots: 5, levels: 7, sat: 115, smooth: 1, contrast: 5 } },
    { id: 'nn-portrait', name: 'פורטרט מצויר', model: 'facepaint', group: G, desc: 'אומן על ציורי פורטרט. הכי טוב לפנים קרובות.', knobs: BASE_KNOBS, def: { sat: 105, contrast: 0 } },
    { id: 'nn-caricature', name: 'קריקטורה AI', model: 'facepaint', warp: true, post: 'cel', group: G, desc: 'ראש מוגדל ואז ציור ברשת. לוחצים על הפנים כדי למרכז.', knobs: ['warp', 'rad', 'lines', 'sat'], def: { warp: 60, lines: 40, levels: 8, sat: 120, smooth: 1 } },
    { id: 'nn-cartoon', name: 'קריקטורה מצוירת', model: 'cg-hosoda', group: G, desc: 'צבעים נקיים וקווי מתאר, כמו סרט מצויר.', knobs: BASE_KNOBS, def: { sat: 110, contrast: 0 } },
    { id: 'nn-anime', name: 'אנימה רכה', model: 'ag-hayao', group: G, desc: 'גוונים רכים ומשיכות צבע של אנימה בעבודת יד.', knobs: BASE_KNOBS, def: { sat: 105, contrast: 0 } },
    { id: 'nn-film', name: 'אנימה קולנועית', model: 'ag-shinkai', group: G, desc: 'קווים חדים ותאורה בהירה של סרט אנימה.', knobs: BASE_KNOBS, def: { sat: 110, contrast: 0 } },
    { id: 'nn-vivid', name: 'אנימה עזה', model: 'cg-paprika', group: G, desc: 'צבעים רוויים וניגודיות גבוהה.', knobs: BASE_KNOBS, def: { sat: 100, contrast: 0 } },
    { id: 'nn-manga', name: 'מנגה AI', model: 'ag-shinkai', post: 'manga', group: G, desc: 'ציור ברשת ואז שחור-לבן עם רשתות גוון.', knobs: ['lines', 'dots', 'contrast'], def: { lines: 50, dots: 5, contrast: 10, smooth: 1 } },
    { id: 'nn-storybook', name: 'נוף מצויר', model: 'cg-hayao', group: G, desc: 'צבעי מים רכים, טוב לנופים ולרקעים.', knobs: BASE_KNOBS, def: { sat: 105, contrast: 0 } },
    { id: 'nn-sky', name: 'שמיים קולנועיים', model: 'cg-shinkai', group: G, desc: 'כחולים עמוקים ואור של שקיעה.', knobs: BASE_KNOBS, def: { sat: 105, contrast: 0 } }
  ];

  /* ---------- טעינה ---------- */

  var scripts = {};
  var IN_WORKER = typeof document === 'undefined';
  function loadScript(path) {
    if (scripts[path]) return scripts[path];
    if (IN_WORKER) {
      /* בעובד רקע טוענים ספריות עם importScripts */
      scripts[path] = new Promise(function (resolve, reject) {
        for (var i = 0; i < CDNS.length; i++) {
          try { self.importScripts(CDNS[i] + path); resolve(CDNS[i]); return; } catch (e) { /* ננסה את השרת הבא */ }
        }
        reject(new Error('load ' + path));
      });
      scripts[path].catch(function () { delete scripts[path]; });
      return scripts[path];
    }
    scripts[path] = CDNS.reduce(function (p, base) {
      return p.catch(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = base + path; s.crossOrigin = 'anonymous';
          s.onload = function () { resolve(base); };
          s.onerror = function () { s.remove(); reject(new Error('load ' + base + path)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.reject(new Error('start')));
    scripts[path].catch(function () { delete scripts[path]; });
    return scripts[path];
  }

  var CACHE = 'comic-models-v1';

  /* מוריד קובץ גדול עם דיווח התקדמות, ושומר אותו במטמון של הדפדפן */
  function fetchModel(path, onProgress) {
    var tryOne = function (i) {
      var url = CDNS[i] + path;
      return cacheGet(url).then(function (hit) {
        if (hit) { onProgress && onProgress(1); return hit; }
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error(res.status + ' ' + url);
          var total = Number(res.headers.get('content-length')) || 0;
          if (!res.body || !total) return res.arrayBuffer();
          var reader = res.body.getReader(), got = 0, parts = [];
          return (function pump() {
            return reader.read().then(function (r) {
              if (r.done) {
                var out = new Uint8Array(got), o = 0;
                parts.forEach(function (c) { out.set(c, o); o += c.length; });
                return out.buffer;
              }
              parts.push(r.value); got += r.value.length;
              onProgress && onProgress(got / total);
              return pump();
            });
          })();
        }).then(function (buf) { cachePut(url, buf); return buf; });
      });
    };
    return tryOne(0).catch(function (e) {
      if (CDNS.length > 1) return tryOne(1);
      throw e;
    });
  }

  function cacheGet(url) {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(CACHE).then(function (c) { return c.match(url); })
      .then(function (r) { return r ? r.arrayBuffer() : null; }).catch(function () { return null; });
  }
  function cachePut(url, buf) {
    if (!window.caches) return;
    caches.open(CACHE).then(function (c) { return c.put(url, new Response(buf)); }).catch(function () {});
  }

  /* ---------- סביבות הרצה ---------- */

  var ortReady = null, tfReady = null;

  function useOrt() {
    if (ortReady) return ortReady;
    ortReady = loadScript(LIB.ort).then(function (base) {
      var ort = window.ort;
      ort.env.wasm.wasmPaths = base + LIB.ortDir;
      ort.env.wasm.numThreads = window.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      return ort;
    });
    ortReady.catch(function () { ortReady = null; });
    return ortReady;
  }

  function useTf() {
    if (tfReady) return tfReady;
    tfReady = loadScript(LIB.tf).then(function (base) {
      var tf = window.tf;
      return tf.setBackend('webgl').then(function (ok) {
        if (ok && tf.getBackend() === 'webgl') return tf;
        throw new Error('no webgl');
      }).catch(function () {
        return loadScript(LIB.tfWasm).then(function () {
          tf.wasm.setWasmPaths(base + LIB.tfWasmDir);
          return tf.setBackend('wasm');
        }).then(function () { return tf; });
      }).then(function (tf2) { return tf2.ready().then(function () { return tf2; }); });
    });
    tfReady.catch(function () { tfReady = null; });
    return tfReady;
  }

  var sessions = {};

  /* רק מודל אחד בזיכרון: מודל של 10MB תופס בהרצה מאות MB, ובטלפון זה מה שמפיל את הדף */
  function releaseOthers(keep) {
    Object.keys(sessions).forEach(function (k) {
      if (k === keep) return;
      var p = sessions[k];
      delete sessions[k];
      p.then(function (m) {
        try { if (m.release) m.release(); else if (m.dispose) m.dispose(); } catch (e) { /* כבר שוחרר */ }
      }).catch(function () {});
    });
  }

  function getModel(key, onProgress) {
    if (sessions[key]) return sessions[key];
    releaseOthers(key);
    var m = MODELS[key];
    var p;
    if (m.kind === 'onnx') {
      p = Promise.all([useOrt(), fetchModel(m.path, onProgress)]).then(function (r) {
        return r[0].InferenceSession.create(r[1], { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      });
    } else {
      p = useTf().then(function (tf) {
        var dir = m.path.replace(/model\.json$/, '');
        var shards = 3, got = new Array(shards + 1).fill(0);
        /* model.json ושלושת קבצי המשקולות עוברים דרך המטמון שלנו */
        return fetchModel(m.path).then(function (jsonBuf) {
          var json = JSON.parse(new TextDecoder().decode(jsonBuf));
          var files = [];
          json.weightsManifest.forEach(function (g) { g.paths.forEach(function (f) { files.push(f); }); });
          return Promise.all(files.map(function (f, i) {
            return fetchModel(dir + f, function (x) {
              got[i] = x;
              onProgress && onProgress(got.reduce(function (a, b) { return a + b; }, 0) / files.length);
            });
          })).then(function (bufs) {
            var total = bufs.reduce(function (a, b) { return a + b.byteLength; }, 0), all = new Uint8Array(total), o = 0;
            bufs.forEach(function (b) { all.set(new Uint8Array(b), o); o += b.byteLength; });
            var specs = [];
            json.weightsManifest.forEach(function (g) { specs = specs.concat(g.weights); });
            return tf.loadGraphModel(tf.io.fromMemory({ modelTopology: json.modelTopology, weightSpecs: specs, weightData: all.buffer, format: json.format, generatedBy: json.generatedBy, convertedBy: json.convertedBy }));
          });
        });
      });
    }
    sessions[key] = p;
    p.catch(function () { delete sessions[key]; });
    return p;
  }

  /* ---------- הרצה ---------- */

  function canvasOf(w, h) {
    if (IN_WORKER) return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  function fitTo(src, max, mult) {
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var k = Math.min(1, max / Math.max(sw, sh));
    var w = Math.max(mult, Math.round(sw * k / mult) * mult), h = Math.max(mult, Math.round(sh * k / mult) * mult);
    var c = canvasOf(w, h);
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c;
  }

  function runOnnx(sess, c, nchw) {
    var W = c.width, H = c.height, n = W * H;
    var d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, f = new Float32Array(3 * n);
    for (var i = 0; i < n; i++) for (var k = 0; k < 3; k++) {
      var v = d[i * 4 + k] / 127.5 - 1;
      if (nchw) f[k * n + i] = v; else f[i * 3 + k] = v;
    }
    var ort = window.ort, feeds = {};
    feeds[sess.inputNames[0]] = new ort.Tensor('float32', f, nchw ? [1, 3, H, W] : [1, H, W, 3]);
    return sess.run(feeds).then(function (r) {
      var y = r[sess.outputNames[0]].data, oc = canvasOf(W, H), x = oc.getContext('2d'), im = x.createImageData(W, H), o = im.data;
      for (var i = 0; i < n; i++) {
        for (var k = 0; k < 3; k++) o[i * 4 + k] = ((nchw ? y[k * n + i] : y[i * 3 + k]) + 1) * 127.5;
        o[i * 4 + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      return oc;
    });
  }

  /* עובדים עם ImageData ולא עם canvas, כדי שזה ירוץ גם בעובד רקע */
  function runTf(model, c) {
    var tf = window.tf, W = c.width, H = c.height;
    var img = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
    var y = tf.tidy(function () {
      var x = tf.browser.fromPixels(img).toFloat().div(127.5).sub(1).expandDims(0);
      return model.predict(x).squeeze().add(1).div(2).clipByValue(0, 1);
    });
    return tf.browser.toPixels(y).then(function (px) {
      y.dispose();
      var oc = canvasOf(W, H), x2 = oc.getContext('2d'), im = x2.createImageData(W, H);
      im.data.set(px);
      x2.putImageData(im, 0, 0);
      return oc;
    });
  }

  /* פורטרט: המודל מקבל ריבוע 512. ממלאים את השוליים בהעתק מטושטש, ואחר כך גוזרים בחזרה */
  function runSquare(sess, src, size) {
    var sw = src.width, sh = src.height, k = size / Math.max(sw, sh);
    var w = Math.round(sw * k), h = Math.round(sh * k), ox = Math.round((size - w) / 2), oy = Math.round((size - h) / 2);
    var c = canvasOf(size, size), x = c.getContext('2d');
    x.filter = 'blur(12px)';
    x.drawImage(src, 0, 0, size, size);
    x.filter = 'none';
    x.drawImage(src, ox, oy, w, h);
    return runOnnx(sess, c, true).then(function (out) {
      var r = canvasOf(w, h);
      r.getContext('2d').drawImage(out, ox, oy, w, h, 0, 0, w, h);
      return r;
    });
  }

  var queue = Promise.resolve();

  /* src: תמונה או canvas. מחזיר canvas מצויר */
  function render(src, styleId, params, max, onProgress) {
    var st = FX.byId[styleId], m = MODELS[st.model];
    var p = FX.paramsFor(styleId, params);
    var job = queue.catch(function () {}).then(function () {
      return getModel(st.model, onProgress);
    }).then(function (model) {
      /* על כרטיס מסך (WebGL) עד 900, על המעבד בלבד קטן יותר כדי לא להיתקע */
      var cap = m.kind === 'tf' ? Math.min(max, window.tf.getBackend() === 'webgl' ? 900 : 600) : Math.min(max, 720);
      var base = st.warp ? FX.warp(src, p, cap) : src;
      if (m.square) {
        var b = fitTo(base, 1024, 1);
        return runSquare(model, b, m.square);
      }
      var c = fitTo(base, cap, m.mult);
      return m.kind === 'onnx' ? runOnnx(model, c, false) : runTf(model, c);
    }).then(function (out) {
      /* כיוון צבע, ולפעמים שכבת קומיקס מעל הציור */
      if (st.post) {
        var pp = {};
        for (var k in p) pp[k] = p[k];
        return FX.render(out, st.post, pp, Math.max(out.width, out.height));
      }
      return FX.render(out, 'original', { bright: p.bright, contrast: p.contrast, sat: p.sat }, Math.max(out.width, out.height));
    });
    queue = job;
    return job;
  }

  /* האם המודל כבר הורד (נמצא במטמון הדפדפן) */
  var downloaded = {};
  function checkDownloaded() {
    if (!window.caches) return Promise.resolve();
    return caches.open(CACHE).then(function (c) {
      return Promise.all(Object.keys(MODELS).map(function (k) {
        var path = MODELS[k].kind === 'tf' ? MODELS[k].path.replace(/model\.json$/, 'group1-shard3of3') : MODELS[k].path;
        return Promise.all(CDNS.map(function (b) { return c.match(b + path); })).then(function (r) {
          if (r.some(Boolean)) downloaded[k] = true;
        });
      }));
    }).catch(function () {});
  }
  function markDownloaded(styleId) { var s = FX.byId[styleId]; if (s && s.model) downloaded[s.model] = true; }

  function isNeural(styleId) { var s = FX.byId[styleId]; return Boolean(s && s.model); }
  function loaded(styleId) { var s = FX.byId[styleId]; return Boolean(s && s.model && (downloaded[s.model] || sessions[s.model])); }
  function sizeOf(styleId) { var s = FX.byId[styleId]; return s && s.model ? MODELS[s.model].mb : 0; }

  STYLES.slice().reverse().forEach(function (s) { FX.register(s, true); });

  window.ComicNeural = { STYLES: STYLES, MODELS: MODELS, render: render, isNeural: isNeural, loaded: loaded, sizeOf: sizeOf, checkDownloaded: checkDownloaded, markDownloaded: markDownloaded, releaseAll: function () { releaseOthers(null); } };
})();
