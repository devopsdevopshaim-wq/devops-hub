/* AI: person mask and face finding run in the browser (MediaPipe, loaded on first use); pictures from a description come
   from Pollinations (free, no key); the editing assistant asks Gemini through the sites' shared server. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var MP = new URL('vendor/mediapipe', location.href).href;   /* shipped with the site: works offline */
  var HUB = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var vision = null, segmenter = null, faceDet = null;

  function loadVision() {
    if (vision) return vision;
    vision = import(MP + '/vision_bundle.mjs').then(function (m) { return m.FilesetResolver.forVisionTasks(MP + '/wasm').then(function (fs) { return { m: m, fs: fs }; }); });
    vision.catch(function () { vision = null; });
    return vision;
  }
  FS.loadVision = loadVision;
  /* the multiclass person model (hair, face, body, clothes, accessories) gives cleaner people; the selfie model is the fallback */
  function getSegmenter() {
    if (segmenter) return segmenter;
    segmenter = loadVision().then(function (v) {
      var opt = function (url) { return { baseOptions: { modelAssetPath: url }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false }; };
      return v.m.ImageSegmenter.createFromOptions(v.fs, opt(new URL('models/selfie_multiclass_256x256.tflite', location.href).href))
        .then(function (sg) { sg.multi = true; return sg; })
        .catch(function () { return v.m.ImageSegmenter.createFromOptions(v.fs, opt(new URL('models/selfie_segmenter.tflite', location.href).href)); });
    });
    segmenter.catch(function () { segmenter = null; });
    return segmenter;
  }
  /* box mean with an integral image */
  function boxMean(a, w, h, r) {
    var W = w + 1, S = new Float64Array(W * (h + 1)), o = new Float32Array(w * h), x, y;
    for (y = 0; y < h; y++) { var rs = 0; for (x = 0; x < w; x++) { rs += a[y * w + x]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + rs; } }
    for (y = 0; y < h; y++) { var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1); for (x = 0; x < w; x++) { var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      o[y * w + x] = (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) / ((x1 - x0) * (y1 - y0)); } }
    return o;
  }
  /* guided filter (He et al.): the soft mask follows the photo's own edges, so hair and shoulders cut cleanly */
  function guided(I, P, w, h, r, eps) {
    var n = w * h, IP = new Float32Array(n), II = new Float32Array(n), i;
    for (i = 0; i < n; i++) { IP[i] = I[i] * P[i]; II[i] = I[i] * I[i]; }
    var mI = boxMean(I, w, h, r), mP = boxMean(P, w, h, r), mIP = boxMean(IP, w, h, r), mII = boxMean(II, w, h, r), A = new Float32Array(n), B = new Float32Array(n);
    for (i = 0; i < n; i++) { var cov = mIP[i] - mI[i] * mP[i], vr = mII[i] - mI[i] * mI[i]; A[i] = cov / (vr + eps); B[i] = mP[i] - A[i] * mI[i]; }
    var mA = boxMean(A, w, h, r), mB = boxMean(B, w, h, r), Q = new Float32Array(n);
    for (i = 0; i < n; i++) Q[i] = Math.max(0, Math.min(1, mA[i] * I[i] + mB[i]));
    return Q;
  }
  function getFaces() {
    if (faceDet) return faceDet;
    faceDet = loadVision().then(function (v) {
      return v.m.FaceDetector.createFromOptions(v.fs, { baseOptions: { modelAssetPath: new URL('models/blaze_face_short_range.tflite', location.href).href }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 });
    });
    faceDet.catch(function () { faceDet = null; });
    return faceDet;
  }
  function small(im, max) { var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.k = k; return c; }
  function fail(e) { FS.busy(); console.warn(e); FS.toast('רכיב ה־AI לא נטען. בודקים חיבור לאינטרנט ומנסים שוב.', 5000); }

  /* ---------- person mask ---------- */
  FS.ensureMask = function (p) {
    if (p.mask) return Promise.resolve(p.mask);
    FS.busy('מזהה את האנשים בתמונה…');
    return getSegmenter().then(function (seg) {
      var c = small(FS.img(p.src), 1024), w = c.width, h = c.height, res = seg.segment(c), cm = res.confidenceMasks, i;
      var mw = cm[0].width, mh = cm[0].height, f = cm[0].getAsFloat32Array(), low = new Float32Array(mw * mh);
      for (i = 0; i < low.length; i++) low[i] = seg.multi ? 1 - f[i] : f[i];      /* multiclass: channel 0 is the background */
      if (res.close) res.close();
      /* bring the model's mask up to the working size, then refine it on the photo's edges */
      var lc = FS.canvas(mw, mh), lx = lc.getContext('2d'), ld = lx.createImageData(mw, mh);
      for (i = 0; i < low.length; i++) { ld.data[i * 4] = ld.data[i * 4 + 1] = ld.data[i * 4 + 2] = low[i] * 255; ld.data[i * 4 + 3] = 255; }
      lx.putImageData(ld, 0, 0);
      var up = FS.canvas(w, h), ux = up.getContext('2d', { willReadFrequently: true }); ux.imageSmoothingQuality = 'high'; ux.drawImage(lc, 0, 0, w, h);
      var ud = ux.getImageData(0, 0, w, h).data, P = new Float32Array(w * h), I = new Float32Array(w * h);
      var px = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      for (i = 0; i < w * h; i++) { P[i] = ud[i * 4] / 255; I[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255; }
      var Q = guided(I, P, w, h, Math.max(4, Math.round(Math.max(w, h) / 90)), 0.0008), cover = 0;
      var mc = FS.canvas(w, h), x = mc.getContext('2d'), id = x.createImageData(w, h);
      for (i = 0; i < w * h; i++) { var v = Math.max(0, Math.min(1, (Q[i] - 0.18) / 0.64)); v = v * v * (3 - 2 * v); cover += v; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255 * v; id.data[i * 4 + 3] = 255; }
      x.putImageData(id, 0, 0);
      p.mask = mc; p.maskV = (p.maskV || 0) + 1; p.maskCover = cover / (w * h); FS.busy();
      if (p.maskCover < 0.015) FS.toast('לא נמצא אדם בתמונה. החלפת רקע עובדת על אנשים.', 5000);
      return mc;
    }).catch(function (e) { fail(e); throw e; });
  };
  function setBg(mode, extra) {
    var p = FS.cur(); if (!p) { FS.toast('בוחרים תמונה קודם'); return Promise.resolve(); }
    var bg = p.doc.photo.bg = Object.assign({ mode: 'none', color: '#ffffff', src: '' }, p.doc.photo.bg, extra || {}, { mode: mode });
    if (mode === 'none') { FS.changed(); return Promise.resolve(); }
    return FS.ensureMask(p).then(function () { if (bg.mode === 'image' && !bg.src) { $('#file-bg').click(); return; } FS.changed(); });
  }
  $$('#bg-modes [data-bg]').forEach(function (b) { b.addEventListener('click', function () { setBg(b.dataset.bg); }); });
  $('#bg-color').addEventListener('input', function () { var p = FS.cur(); if (!p) return; if (!p.doc.photo.bg || p.doc.photo.bg.mode !== 'color') setBg('color', { color: this.value }); else { p.doc.photo.bg.color = this.value; FS.render(true); FS.commitSoon(); } });
  $('#bg-blur').addEventListener('change', function () { var p = FS.cur(); if (!p) return; if (!p.doc.photo.bg || p.doc.photo.bg.mode !== 'blur') setBg('blur', { amount: Number(this.value) }); else { p.doc.photo.bg.amount = Number(this.value); FS.changed(); } });
  $('#file-bg').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (!f) return; FS.fileToDataURL(f).then(FS.loadImg).then(function (im) { setBg('image', { src: im.src }); }); });

  /* ---------- faces ---------- */
  /* faces at every size: the whole photo, then overlapping tiles (small faces in group photos), merged */
  FS.findFaces = function (p, quiet) {
    if (p.faces) return Promise.resolve(p.faces);
    if (!quiet) FS.busy('מחפש פנים…');
    return getFaces().then(function (det) {
      var im = FS.img(p.src), W = im.naturalWidth, H = im.naturalHeight, found = [];
      function run(sx, sy, sw, sh) {
        var k = Math.min(1, 1280 / Math.max(sw, sh)), c = FS.canvas(sw * k, sh * k); c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
        (det.detect(c).detections || []).forEach(function (d) {
          var b = d.boundingBox, sc = (d.categories && d.categories[0] && d.categories[0].score) || 0.5;
          found.push({ x: sx + b.originX / k, y: sy + b.originY / k, w: b.width / k, h: b.height / k, score: sc,
            kp: (d.keypoints || []).map(function (q) { return { x: sx + q.x * sw, y: sy + q.y * sh }; }) });
        });
      }
      run(0, 0, W, H);
      if (Math.max(W, H) > 900) { /* 2×2 tiles with a quarter overlap, and the middle */
        var tw = W * 0.6, th = H * 0.6;
        [[0, 0], [W - tw, 0], [0, H - th], [W - tw, H - th], [(W - tw) / 2, (H - th) / 2]].forEach(function (o) { run(o[0], o[1], tw, th); });
      }
      /* keep the best of overlapping boxes */
      found.sort(function (a, b) { return b.score - a.score; });
      var keep = [];
      found.forEach(function (f) {
        var dup = keep.some(function (g) { var ix = Math.max(0, Math.min(f.x + f.w, g.x + g.w) - Math.max(f.x, g.x)), iy = Math.max(0, Math.min(f.y + f.h, g.y + g.h) - Math.max(f.y, g.y)), inter = ix * iy; return inter / Math.min(f.w * f.h, g.w * g.h) > 0.35; });
        if (!dup && f.w > 12) keep.push(f);
      });
      p.faces = keep.sort(function (a, b) { return a.x - b.x; });
      if (!quiet) { FS.busy(); if (!p.faces.length) FS.toast('לא נמצאו פנים. הזיהוי עובד הכי טוב על פנים ברורות.', 4500); else FS.toast('👤 נמצאו ' + p.faces.length + ' פנים'); }
      return p.faces;
    }).catch(function (e) { if (quiet) return []; fail(e); throw e; });
  };
  /* how many faces a picture has (an AI result, before it is put on the photo): the whole picture, then 2x2 tiles when none */
  /* the faces of a picture (an AI answer, or the original before it is sent), as boxes in its pixels: the whole picture, then
     2x2 tiles when none; overlapping boxes merged */
  FS.detectFaces = function (im) {
    return getFaces().then(function (det) {
      var W = im.naturalWidth || im.width, H = im.naturalHeight || im.height, out = [];
      function run(sx, sy, sw, sh) {
        var k = Math.min(1, 1024 / Math.max(sw, sh)), c = FS.canvas(sw * k, sh * k); c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
        (det.detect(c).detections || []).forEach(function (d) { var b = d.boundingBox, sc = (d.categories && d.categories[0] && d.categories[0].score) || 0.5; out.push({ x: sx + b.originX / k, y: sy + b.originY / k, w: b.width / k, h: b.height / k, score: sc }); });
      }
      run(0, 0, W, H);
      if (!out.length) { var tw = W * 0.6, th = H * 0.6; [[0, 0], [W - tw, 0], [0, H - th], [W - tw, H - th]].forEach(function (o) { run(o[0], o[1], tw, th); }); }
      out.sort(function (a, b) { return b.score - a.score; });
      var keep = [];
      out.forEach(function (f) { if (!keep.some(function (g) { var ix = Math.max(0, Math.min(f.x + f.w, g.x + g.w) - Math.max(f.x, g.x)), iy = Math.max(0, Math.min(f.y + f.h, g.y + g.h) - Math.max(f.y, g.y)); return ix * iy / Math.min(f.w * f.h, g.w * g.h) > 0.35; })) keep.push(f); });
      return keep;
    });
  };
  /* the people the picture is about: clear faces (score 0.6+) at least 40% as wide as the largest one; small faces in the
     background and false faces (lights, reflections) are left out. This count goes to the AI and checks its answer. */
  FS.mainFaces = function (faces) {
    var l = (faces || []).filter(function (f) { return (f.score == null ? 1 : f.score) >= 0.6; }), w0 = l.reduce(function (m, f) { return Math.max(m, f.w); }, 0);
    return l.filter(function (f) { return f.w >= w0 * 0.4; });
  };
  FS.countFaces = function (im) { return FS.detectFaces(im).then(function (l) { return FS.mainFaces(l).length; }); };
  /* place the faces in the frame's window: zoom so they read well, centre them, keep the window covered */
  FS.smartFit = function (p, quiet) {
    return FS.findFaces(p, quiet).then(function (faces) {
      if (!faces.length) return 0;
      var d = p.doc, im = FS.img(p.src), H = FS.hole(d), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      FS.fitPhoto(d, im);
      faces.forEach(function (f) { [[f.x, f.y], [f.x + f.w, f.y + f.h]].forEach(function (q) { var t = FS.imgToDoc(d, im, q[0], q[1]); x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); }); });
      var fw = x1 - x0, k = fw > H.w * 0.75 ? H.w * 0.75 / fw : faces.length === 1 && fw < H.w * 0.22 ? Math.min(2.2, H.w * 0.3 / fw) : 1;
      var hx = H.x + H.w / 2, hy = H.y + H.h / 2;
      d.photo.s *= k; d.photo.x = hx + (d.photo.x - hx) * k; d.photo.y = hy + (d.photo.y - hy) * k;
      var fcx = hx + ((x0 + x1) / 2 - hx) * k, fcy = hy + ((y0 + y1) / 2 - hy) * k;
      d.photo.x -= fcx - hx; d.photo.y -= fcy - (H.y + H.h * 0.4);
      var rot = Math.abs(Math.round(d.photo.r / 90)) % 2, hw = (rot ? im.naturalHeight : im.naturalWidth) * d.photo.s / 2, hh = (rot ? im.naturalWidth : im.naturalHeight) * d.photo.s / 2;
      d.photo.x = FS.clamp(d.photo.x, H.x + H.w - hw, H.x + hw); d.photo.y = FS.clamp(d.photo.y, H.y + H.h - hh, H.y + hh);
      return faces.length;
    });
  };
  $('#smart-fit').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.smartFit(p).then(function (n) { if (n) { FS.changed(); FS.toast('🎯 ' + n + ' פנים במרכז החלון'); } });
  });
  $('#face-blur').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.findFaces(p).then(function (faces) {
      if (!faces.length) return;
      var ph = p.doc.photo; ph.blurs = ph.blurs && ph.blurs.length ? [] : faces.map(function (f) { return { x: f.x - f.w * 0.15, y: f.y - f.h * 0.3, w: f.w * 1.3, h: f.h * 1.45 }; });
      FS.changed(); FS.toast(ph.blurs.length ? 'הפנים טושטשו. לחיצה נוספת מבטלת.' : 'הטשטוש בוטל');
    });
  });
  var FX = {
    glasses: function (f, a, ed) { return [{ ch: '🕶️', x: (f.kp[0].x + f.kp[1].x) / 2, y: (f.kp[0].y + f.kp[1].y) / 2 + ed * 0.05, size: ed * 2.3 }]; },
    hearts: function (f, a, ed) { return [{ ch: '❤️', x: f.kp[0].x, y: f.kp[0].y, size: ed * 0.75 }, { ch: '❤️', x: f.kp[1].x, y: f.kp[1].y, size: ed * 0.75 }]; },
    crown: function (f, a, ed) { return [{ ch: '👑', x: f.x + f.w / 2, y: f.y - f.h * 0.28, size: f.w * 0.95 }]; },
    hat: function (f) { return [{ ch: '🎩', x: f.x + f.w / 2, y: f.y - f.h * 0.42, size: f.w * 1.2 }]; },
    party: function (f) { return [{ ch: '🥳', x: f.x + f.w * 0.95, y: f.y - f.h * 0.1, size: f.w * 0.5 }, { ch: '🎉', x: f.x + f.w * 0.05, y: f.y - f.h * 0.15, size: f.w * 0.5 }]; },
    clown: function (f, a, ed) { return [{ ch: '🔴', x: f.kp[2].x, y: f.kp[2].y, size: ed * 0.55 }]; }
  };
  $$('#face-fx [data-fx]').forEach(function (b) { b.addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.findFaces(p).then(function (faces) {
      if (!faces.length) return;
      var d = p.doc, im = FS.img(p.src), rot = d.photo.r;
      faces.forEach(function (f) {
        if (f.kp.length < 3) return;
        var ed = Math.hypot(f.kp[0].x - f.kp[1].x, f.kp[0].y - f.kp[1].y), a = Math.atan2(f.kp[0].y - f.kp[1].y, f.kp[0].x - f.kp[1].x) * 180 / Math.PI;
        if (Math.abs(a) > 90) a = a > 0 ? a - 180 : a + 180;
        FX[b.dataset.fx](f, a, ed).forEach(function (s) {
          var t = FS.imgToDoc(d, im, s.x, s.y);
          d.layers.push({ id: FS.uid(), type: 'emoji', ch: s.ch, x: t.x, y: t.y, size: Math.max(16, s.size * d.photo.s), r: Math.round(a + rot), opacity: 1 });
        });
      });
      FS.changed(); FS.toast('אפשר להזיז ולהגדיל כל מדבקה');
    });
  }); });

  /* ---------- pictures from a description ---------- */
  function hasHeb(s) { return /[֐-׿]/.test(s); }
  /* text/plain keeps it a simple request: the server answers no CORS preflight, so application/json never reached it */
  /* every request in flight can be stopped (FS.aiStop): the answer is dropped and reads as 'cancelled' */
  var live = [], cloudOff = 0;
  FS.cloudOff = function () { return cloudOff > Date.now(); };
  FS.aiStop = function () { live.slice().forEach(function (c) { c.stopped = true; if (c.ctl) c.ctl.abort(); }); };
  /* Picture edits ('restyle') and new pictures ('image') can also run on this computer in the desktop program
     (js/local-ai.js, FS.localAI). Mode 'fs-ai-mode': local = always here; auto = the cloud when online, here when offline
     or when the cloud fails; cloud = never here. Text actions always go to the server. */
  function askLocal(body) {
    var me = { stopped: false, ctl: { abort: function () { FS.localAI.cancel(); } } };
    live.push(me);
    return FS.localAI.run(body).then(function (r) {
      live.splice(live.indexOf(me), 1); if (me.stopped) r = { ok: false, error: 'cancelled' };
      FS.lastAiDetail = r && !r.ok ? String(r.detail || '') : ''; return r;
    });
  }
  FS.askServer = function (body) {
    var L = FS.localAI;
    /* a chosen engine (the AI tab's engine bar, or one of the "3 versions"): 'local' is this computer, the others one cloud engine */
    if (body && body.engine === 'local') { var bl = Object.assign({}, body); delete bl.engine; return L && L.isReady && L.isReady() ? askLocal(bl) : Promise.resolve({ ok: false, error: 'local-missing' }); }
    /* a chosen cloud engine that fails (no connection, quota, timeout) hands the picture to this computer when its engine is installed */
    var pic = body && (body.action === 'restyle' || body.action === 'image'), here = function () { return !!(pic && L && L.isReady && L.isReady()); };
    var toLocal = function () { var bl = Object.assign({}, body); delete bl.engine; return askLocal(bl); };
    if (body && body.engine) {
      if (here() && (navigator.onLine === false || cloudOff > Date.now())) return toLocal();
      return askCloud(body).then(function (r) {
        if ((r && r.ok && r.image) || (r && r.error === 'cancelled') || !here()) return r;
        cloudOff = Date.now() + 10 * 60000;
        if (window.console) console.warn('AI: the chosen engine failed (' + (r && r.error) + '), using the local engine');
        return toLocal();
      });
    }
    /* "cloud only": still, without a connection the picture is made on this computer rather than not at all */
    if (pic && L && L.mode && L.mode() === 'cloud') return (here() && navigator.onLine === false ? toLocal() : askCloud(body).then(function (r) {
      return r && !r.ok && /offline|timeout/.test(String(r.error || '')) && here() ? toLocal() : r;
    }));
    if (!L || !pic) return askCloud(body);
    return L.whenReady().then(function (ready) {
      if (!ready) return askCloud(body);
      if (L.mode() === 'local' || navigator.onLine === false || cloudOff > Date.now()) return askLocal(body);
      return askCloud(body).then(function (r) {
        if ((r && r.ok && r.image) || (r && r.error === 'cancelled')) return r;
        /* any failure of the cloud (no connection, a timeout, the free allowance ran out, a refusal): this picture goes to this
           computer, and for a while the next ones go straight there without waiting on the cloud (30 minutes after a quota,
           10 after a lost connection) */
        var er = String((r && r.error) || '');
        cloudOff = Date.now() + (/quota|no-free-tier|rate-limited|engine-off/.test(er) ? 30 : 10) * 60000;
        if (window.console) console.warn('AI: cloud failed (' + (r && r.error) + '), using the local engine');
        return askLocal(body);
      });
    });
  };
  function askCloud(body) {
    var ctl = window.AbortController ? new AbortController() : null, me = { ctl: ctl, stopped: false }, to = setTimeout(function () { if (ctl) ctl.abort(); }, body.action === 'ai' && !body.image ? 45000 : 115000);
    live.push(me);
    return fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); })
      .catch(function (e) { return { ok: false, error: me.stopped ? 'cancelled' : e && e.name === 'AbortError' ? 'timeout' : 'offline' }; })
      .then(function (r) { clearTimeout(to); live.splice(live.indexOf(me), 1); if (me.stopped) r = { ok: false, error: 'cancelled' }; FS.lastAiDetail = r && !r.ok ? String(r.detail || '') : ''; if (r && !r.ok && r.detail && window.console) console.warn('AI:', r.error, r.detail); return r; });
  }
  /* the picture engines this server has ({gemini, openai, flux, free}); an older server without the list: the usual three */
  var engP = null;
  FS.aiEngines = function () {
    if (!engP) engP = askCloud({ action: 'engines' }).then(function (r) { return r && r.ok && r.engines ? r.engines : { gemini: true, flux: true, free: true, openai: false }; });
    engP.then(function (e) { if (navigator.onLine === false) engP = null; });
    return engP;
  };
  FS.ENGINE_NAMES = { '': '✨ אוטומטי', gemini: 'Gemini', flux: 'FLUX', free: 'Pollinations', openai: 'GPT‑Image', local: '🖥️ מקומי' };
  FS.aiError = function (m) {
    m = String(m || '');
    if (m === 'engine-off') return 'המנוע שנבחר לא מופעל בשרת. בוחרים "אוטומטי" או מנוע אחר בראש לשונית ה־AI.';
    if (m === 'no-key') return 'שרת ה־AI עוד לא הוגדר (חסר מפתח Gemini בשרת).';
    if (m === 'no-free-tier') return 'יצירת תמונות ב־Gemini לא כלולה בתוכנית החינמית של המפתח. צריך להפעיל חיוב (Billing) בפרויקט ב־Google AI Studio, והתמונות יתחילו לעבוד.';
    if (m === 'cancelled') return 'העריכה נעצרה.';
    if (m === 'extra-people') return 'ה־AI הוסיף לתמונה אנשים שלא היו בה, אז היא לא הוחלה. כדאי לנסות שוב, או להדליק "🎯 רק על הדמות".';
    if (m === 'lost-people') return 'ה־AI החזיר תמונה בלי האנשים שבצילום, אז היא לא הוחלה. כדאי לנסות שוב, לבחור מנוע אחר בראש הלשונית, או להשתמש במנוע שבמחשב.';
    if (m === 'quota') return 'כל שרתי ה־AI עמוסים כרגע (גם השרת החינמי). מחכים דקה ומנסים שוב.';
    if (m === 'rate-limited') return 'יותר מדי בקשות ברצף. מחכים דקה ומנסים שוב.';
    if (m === 'timeout') return 'ה־AI לא ענה בזמן. נסו שוב.';
    if (m === 'offline') return FS.localAI && FS.localAI.isReady && FS.localAI.isReady() ? 'אין חיבור לשרת ה־AI, ומנוע ה־AI שבמחשב לא הצליח הפעם. מנסים שוב.' : 'אין חיבור לשרת ה־AI. כדי שהעיצובים יעבדו גם בלי אינטרנט, מתקינים את מנוע ה־AI שבמחשב: ☰ ← 🖥️ AI מקומי.';
    return 'ה־AI לא הצליח הפעם.' + (FS.lastAiDetail ? ' (' + FS.lastAiDetail.slice(0, 140) + ')' : ' נסו שוב או ניסוח אחר.');
  };
  function toEnglish(text) {
    if (!hasHeb(text)) return Promise.resolve(text);
    return FS.askServer({ action: 'ai', tag: 'photo', prompt: 'Translate this image description to a short English image-generation prompt. Answer with the prompt only:\n' + text })
      .then(function (r) { return r && r.ok && r.text ? r.text.replace(/^["'\s]+|["'\s]+$/g, '') : text; }).catch(function () { return text; });
  }
  /* draw a picture into a w x h canvas, cropping to fill */
  function cover(im, w, h) {
    w = Math.round(w); h = Math.round(h); var c = FS.canvas(w, h), k = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    c.getContext('2d').drawImage(im, (w - im.naturalWidth * k) / 2, (h - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); return c;
  }
  /* Gemini's image model through the server first; Pollinations (free, no key) when the server cannot */
  function generate(prompt, w, h) {
    var shape = w > h * 1.05 ? 'landscape' : h > w * 1.05 ? 'portrait' : 'square';
    return FS.askServer({ action: 'image', prompt: 'Create one image: ' + prompt + '. Aspect ratio ' + shape + ' (' + Math.round(w) + 'x' + Math.round(h) + '). No text, no watermark.' }).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error((r && r.error) || 'ai-failed');
      var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' })));
    }).catch(function (e) {
      var first = e && e.message;
      return toEnglish(prompt).then(function (en) {
        var url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(en) + '?width=' + Math.round(w) + '&height=' + Math.round(h) + '&nologo=true&seed=' + Math.floor(Math.random() * 1e6);
        return FS.loadImg(url);
      }).catch(function () { throw new Error(first || 'ai-failed'); });
    }).then(function (im) { return cover(im, w, h); });
  }
  /* turn the near-white area joined to the given seeds transparent */
  function clearWhite(c, seeds, tol) {
    var w = c.width, h = c.height, x = c.getContext('2d', { willReadFrequently: true }), id = x.getImageData(0, 0, w, h), d = id.data, seen = new Uint8Array(w * h), st = [];
    function white(i) { return d[i * 4] > 255 - tol && d[i * 4 + 1] > 255 - tol && d[i * 4 + 2] > 255 - tol; }
    seeds.forEach(function (s) { if (white(s)) { seen[s] = 1; st.push(s); } });
    while (st.length) { var i = st.pop(), px = i % w; d[i * 4 + 3] = 0;
      [i - 1, i + 1, i - w, i + w].forEach(function (q) { if (q >= 0 && q < w * h && !seen[q] && Math.abs((q % w) - px) <= 1 && white(q)) { seen[q] = 1; st.push(q); } }); }
    x.putImageData(id, 0, 0); return c;
  }
  function edgeSeeds(w, h) { var s = []; for (var i = 0; i < w; i += 3) { s.push(i, (h - 1) * w + i); } for (i = 0; i < h; i += 3) { s.push(i * w, i * w + w - 1); } return s; }
  function promptText() { var t = $('#gen-prompt').value.trim(); if (!t) { FS.toast('כותבים תיאור קודם'); $('#gen-prompt').focus(); } return t; }
  function genBusy(promise) { FS.busy('יוצר… (עד חצי דקה)'); return promise.then(function (r) { FS.busy(); return r; }, function (e) { FS.busy(); FS.toast('היצירה לא הצליחה. ' + FS.aiError(e && e.message), 6000); return new Promise(function () {}); }); }
  $('#gen-bg').addEventListener('click', function () {
    var t = promptText(), p = FS.cur(); if (!t) return; if (!p) return FS.toast('בוחרים תמונה קודם');
    var im = FS.img(p.src), k = 1024 / Math.max(im.naturalWidth, im.naturalHeight);
    genBusy(generate(t + ', background scenery, photographic, no people', im.naturalWidth * k, im.naturalHeight * k)).then(function (c) {
      return FS.loadImg(c.toDataURL('image/jpeg', 0.9)).then(function (bi) { return setBg('image', { src: bi.src }); });
    });
  });
  $('#gen-sticker').addEventListener('click', function () {
    var t = promptText(); if (!t) return; if (!FS.cur()) return FS.toast('בוחרים תמונה קודם');
    genBusy(generate(t + ', cute die-cut sticker, bold outline, centered, plain white background', 768, 768)).then(function (c) {
      clearWhite(c, edgeSeeds(c.width, c.height), 28);
      return FS.loadImg(c.toDataURL('image/png')).then(function (im) { var d = FS.cur().doc; FS.addLayer({ type: 'image', src: im.src, s: Math.min(d.w, d.h) * 0.38 / im.naturalWidth }); });
    });
  });
  $('#gen-frame').addEventListener('click', function () {
    var t = promptText(); if (!t) return; var p = FS.cur(), d = p ? p.doc : { w: 1200, h: 1800 }, k = 1024 / Math.max(d.w, d.h);
    genBusy(generate(t + ', ornamental decorative photo frame border only, the whole center is empty plain white, flat illustration', d.w * k, d.h * k)).then(function (c) {
      clearWhite(c, [Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)], 40);
      return FS.addUserFrame(c.toDataURL('image/png'), 'AI: ' + t.slice(0, 24));
    }).then(function (f) {
      if (f.solid) FS.toast('במסגרת שנוצרה לא נמצא מרכז ריק. כדאי לנסות שוב.', 5000);
      else if (p) FS.useFrame({ kind: 'png', id: f.id, opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false });
      FS.openTab('frames');
    });
  });
  $('#gen-photo').addEventListener('click', function () {
    var t = promptText(); if (!t) return;
    genBusy(generate(t, 1216, 832)).then(function (c) { c.toBlob(function (b) { FS.addFiles([new File([b], 'AI ' + t.slice(0, 20) + '.jpg', { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92); });
  });

  /* ---------- the editing assistant ---------- */
  $('#ai-ask').addEventListener('click', function () {
    var p = FS.cur(), out = $('#ai-out'); if (!p) return FS.toast('בוחרים תמונה קודם');
    var c = small(FS.img(p.src), 1024), occ = $('#ai-occasion').value;
    var frames = FS.GEN_FRAMES.map(function (f) { return f.id + ' (' + f.name + ')'; }).join(', ');
    var prompt = 'You are a senior photo retoucher. Look at the photo' + (occ ? ' (occasion: ' + occ + ')' : '') + ' and answer ONLY with JSON, Hebrew text values:\n' +
      '{"why":"2-3 short sentences in Hebrew: what to improve and why","adj":{"exposure":0,"contrast":0,"highlights":0,"shadows":0,"whites":0,"blacks":0,"temp":0,"tint":0,"vibrance":0,"saturation":0,"clarity":0,"sharpen":0,"vignette":0},' +
      '"captions":["3 short Hebrew captions to print on the photo"],"frame":"one id from: ' + frames + '","frameColor":"#hex"}\nValues are -100..100 (sharpen 0..100); keep edits natural.';
    out.innerHTML = '<p class="hint">מנתח את התמונה…</p>';
    FS.askServer({ action: 'ai', tag: 'photo', prompt: prompt, image: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' }).then(function (r) {
      if (!r || !r.ok) throw new Error(r && r.error || 'ai');
      var j = JSON.parse(String(r.text).replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
      var h = '<p>' + FS.esc(j.why || '') + '</p><button class="btn primary small" id="ai-apply">✔ החלת העריכה המומלצת</button>';
      if (j.frame) h += ' <button class="btn small" id="ai-frame">🖼️ מסגרת מומלצת</button>';
      (j.captions || []).slice(0, 4).forEach(function (t, i) { h += '<button class="chip-cap" data-cap="' + i + '">＋ ' + FS.esc(t) + '</button>'; });
      out.innerHTML = h;
      $('#ai-apply').addEventListener('click', function () { var a = Object.assign({}, FS.ADJ0); for (var k in j.adj || {}) if (k in a) a[k] = FS.clamp(Math.round(Number(j.adj[k]) || 0), -100, 100); p.doc.photo.adj = a; FS.changed(); });
      if ($('#ai-frame')) $('#ai-frame').addEventListener('click', function () { var def = FS.GEN_FRAMES.filter(function (f) { return f.id === j.frame; })[0]; if (def) FS.useFrame({ kind: 'gen', id: def.id, color: /^#[0-9a-f]{6}$/i.test(j.frameColor || '') ? j.frameColor : def.color, thick: 1, opacity: 1 }); });
      $$('[data-cap]', out).forEach(function (b) { b.addEventListener('click', function () { var d = p.doc; FS.addLayer({ type: 'text', text: j.captions[b.dataset.cap], size: Math.round(Math.min(d.w, d.h) * 0.07), font: 'Amatic SC', weight: 700, color: '#ffffff', shadow: true, y: d.h * 0.85, align: 'center' }); }); });
    }).catch(function (e) {
      var m = String(e && e.message);
      out.innerHTML = '<p class="hint">' + FS.aiError(m) + ' בינתיים אפשר להשתמש ב"שיפור אוטומטי" בלשונית עריכה, שעובד בלי אינטרנט.</p>';
    });
  });
})();
