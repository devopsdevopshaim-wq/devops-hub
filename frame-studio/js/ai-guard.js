/* AI guard (v161): an AI edit that is not the same people is never put on a photo.
   Image models redraw; at an event too many answers came back with other faces or a picture that is not the shot. Before an
   answer is applied it is compared with the original, on this computer and without internet (the face landmarker shipped
   with the site, models/face_landmarker.task):
   - the same people: every clear face of the original must be found in the answer, at about the same place and size, with
     the same face shape (ratios of distances between the face's rigid points: eye corners, nose, cheekbones, jaw, brows;
     they do not change with a smile or a light turn), and, for looks that stay a photograph, the same face (the two faces
     turned upright, made the same size and compared in grey, normalised cross-correlation);
   - the same picture: for photographic looks, the shapes of the scene (edges of a small grey copy) must still match.
   FS.aiCheck(original, answer, { photo }) → { ok, score 0–100, faces, bad, why } (why in Hebrew, '' when ok).
   FS.aiGuardOn() ('fs-ai-guard', on unless '0'); FS.aiGuardLevel() 'strict' | 'normal' ('fs-ai-guard-level').
   FS.aiHealth(list) checks edits already on photos (p.origSrc → p.src) and marks p.aiBad; FS.aiRevertBad(list) puts the
   original back on the ones marked. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS) return;
  var RIGID = [33, 133, 362, 263, 1, 6, 98, 327, 2, 152, 234, 454, 172, 397, 70, 300, 105, 334, 10];
  var OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  function ls(k, v) { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k); } catch (e) { return null; } }
  FS.aiGuardOn = function (v) { if (v !== undefined) ls('fs-ai-guard', v ? '1' : '0'); return ls('fs-ai-guard') !== '0'; };
  FS.aiGuardLevel = function (v) { if (v !== undefined) ls('fs-ai-guard-level', v); return ls('fs-ai-guard-level') === 'normal' ? 'normal' : 'strict'; };

  var MAX = 768;   /* the check works on a copy of at most 768px: fast, and enough for faces of a group */
  function canvasOf(im, W, H) { var c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H); return c; }
  function dims(im) { return [im.naturalWidth || im.width, im.naturalHeight || im.height]; }
  function faces(lm, c) {
    var r = lm.detect(c);
    return (r.faceLandmarks || []).map(function (pts) { return pts.map(function (q) { return { x: q.x * c.width, y: q.y * c.height }; }); });
  }
  function d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function box(P) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; OVAL.forEach(function (i) { var q = P[i]; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
  /* the face's shape: every distance between rigid points, over the distance between the outer eye corners */
  function shape(P) { var io = d(P[33], P[263]) || 1, s = []; for (var i = 0; i < RIGID.length; i++) for (var j = i + 1; j < RIGID.length; j++) s.push(d(P[RIGID[i]], P[RIGID[j]]) / io); return s; }
  function shapeDiff(a, b) { var t = 0; for (var i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]) / ((a[i] + b[i]) / 2 || 1); return t / a.length; }
  /* the face upright, 40×40 grey, normalised: eyes level, the eye line at the same place and size */
  function patch(c, P) {
    var L = P[33], R = P[263], ang = Math.atan2(R.y - L.y, R.x - L.x), io = d(L, R) || 1, S = 40, k = S * 0.5 / io;
    var mx = (L.x + R.x) / 2, my = (L.y + R.y) / 2, o = FS.canvas(S, S), x = o.getContext('2d', { willReadFrequently: true });
    x.translate(S / 2, S * 0.36); x.scale(k, k); x.rotate(-ang); x.translate(-mx, -my); x.drawImage(c, 0, 0);
    var px = x.getImageData(0, 0, S, S).data, g = new Float32Array(S * S), m = 0, v = 0, i;
    for (i = 0; i < S * S; i++) { g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; m += g[i]; }
    m /= S * S; for (i = 0; i < S * S; i++) { g[i] -= m; v += g[i] * g[i]; } v = Math.sqrt(v) || 1; for (i = 0; i < S * S; i++) g[i] /= v;
    return g;
  }
  function ncc(a, b) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i] * b[i]; return t; }
  /* the scene's shapes: the edges of a 64px grey copy, compared (normalised) */
  function edges(im, W, H) {
    var k = 64 / Math.max(W, H), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k)), c = canvasOf(im, w, h);
    var px = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, g = new Float32Array(w * h), e = new Float32Array(w * h), m = 0, v = 0, i;
    for (i = 0; i < w * h; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { i = y * w + x; e[i] = Math.hypot(g[i + 1] - g[i - 1], g[i + w] - g[i - w]); }
    for (i = 0; i < e.length; i++) m += e[i]; m /= e.length; for (i = 0; i < e.length; i++) { e[i] -= m; v += e[i] * e[i]; } v = Math.sqrt(v) || 1; for (i = 0; i < e.length; i++) e[i] /= v;
    return e;
  }
  /* the limits: found on the samples in show/ (the same couple in 12 looks) and real event photos of other people */
  function limits(photo) {
    var strict = FS.aiGuardLevel() === 'strict';
    return photo ? { shape: strict ? 0.085 : 0.11, face: strict ? 0.5 : 0.38, scene: strict ? 0.45 : 0.32 }
      : { shape: strict ? 0.12 : 0.14, face: -1, scene: -1 };
  }

  FS.aiCheck = function (orig, res, o) {
    o = o || {};
    if (!FS.getLandmarker) return Promise.resolve({ ok: true, score: 100, faces: 0, bad: 0, why: '', skipped: true });
    var photo = o.photo !== false, sceneOn = !!o.scene, lim = limits(photo);   /* scene: only for edits that keep the place (a look may change it) */
    return FS.getLandmarker().then(function (lm) {
      var od = dims(orig), k = Math.min(1, MAX / Math.max(od[0], od[1])), W = Math.round(od[0] * k), H = Math.round(od[1] * k);
      var oc = canvasOf(orig, W, H), rc = canvasOf(res, W, H);
      var OF = faces(lm, oc), RF = faces(lm, rc), used = {}, bad = 0, n = 0, worst = 1, why = [], detail = [];
      /* the clear faces of the original: not the small ones far behind */
      var big = OF.map(function (P) { return { P: P, b: box(P) }; }), top = big.reduce(function (m, f) { return Math.max(m, f.b.w); }, 0);
      big = big.filter(function (f) { return f.b.w >= Math.max(W * 0.035, top * 0.33); });   /* the people posing; people behind are background */
      /* v215: a photo split from a group (o.solo): only the person in the middle; the neighbours' edges were removed on purpose */
      if (o.solo && big.length > 1) big = [big.slice().sort(function (a, b) { return Math.hypot(a.b.cx - W / 2, a.b.cy - H / 3) - Math.hypot(b.b.cx - W / 2, b.b.cy - H / 3); })[0]];
      big.forEach(function (f) {
        n++;
        var best = -1, bd = 1e9;
        RF.forEach(function (Q, j) { if (used[j]) return; var b = box(Q), dist = Math.hypot(b.cx - f.b.cx, b.cy - f.b.cy), r = b.w / f.b.w; if (dist < f.b.w * 0.8 && r > 0.6 && r < 1.65 && dist < bd) { bd = dist; best = j; } });
        /* a drawn look: the face finder often does not see drawn faces; the people count (styles.js) covers those */
        if (best < 0) { if (photo) { bad++; worst = 0; why.push('פנים שנעלמו או זזו'); } detail.push({ missing: 1 }); return; }
        used[best] = 1;
        var Q = RF[best], sd = shapeDiff(shape(f.P), shape(Q)), sim = photo ? ncc(patch(oc, f.P), patch(rc, Q)) : 1;
        var s = Math.max(0, Math.min(1, 1 - sd / (lim.shape * 2))) * (photo ? Math.max(0, Math.min(1, (sim + 0.1) / 1.1)) : 1);
        worst = Math.min(worst, s); detail.push({ sd: Math.round(sd * 1000) / 1000, sim: Math.round(sim * 100) / 100 });
        /* a caricature changes the face's proportions on purpose (big eyes, a round face): its shape is not compared (o.loose) */
        if (sd > lim.shape && !o.loose) { bad++; why.push('צורת פנים אחרת'); }
        else if (photo && sim < lim.face) { bad++; why.push('פנים שונות מהמקור'); }
      });
      var scene = 1;
      if (sceneOn) { var a = edges(orig, od[0], od[1]), b = edges(res, od[0], od[1]); scene = ncc(a, b); if (scene < lim.scene) why.push('התמונה לא תואמת למקור'); }
      var ok = !bad && !(sceneOn && scene < lim.scene);
      var score = Math.round(100 * Math.min(n ? worst : 1, sceneOn ? Math.max(0, Math.min(1, (scene + 0.2) / 1.0)) : 1));
      return { ok: ok, score: score, faces: n, bad: bad, scene: Math.round(scene * 100) / 100, detail: detail, why: why.filter(function (w, i) { return why.indexOf(w) === i; }).join(' · ') };
    }).catch(function (e) { if (window.console) console.warn('aiCheck', e); return { ok: true, score: 100, faces: 0, bad: 0, why: '', skipped: true }; });
  };

  /* how many clear faces a picture has, by the face landmarker (a second count when the face finder sees none) */
  FS.countFacesLm = function (im) {
    if (!FS.getLandmarker) return Promise.resolve(0);
    return FS.getLandmarker().then(function (lm) {
      var d = dims(im), k = Math.min(1, MAX / Math.max(d[0], d[1])), W = Math.round(d[0] * k), H = Math.round(d[1] * k), c = canvasOf(im, W, H);
      var F = faces(lm, c).map(function (P) { return box(P); }), top = F.reduce(function (m, b) { return Math.max(m, b.w); }, 0);
      return F.filter(function (b) { return b.w >= Math.max(W * 0.035, top * 0.33); }).length;
    }).catch(function () { return 0; });
  };
  /* the edits already on the photos: the original (origSrc) against what is on the photo now */
  FS.aiHealth = function (list, onStep) {
    list = (list || FS.state.photos).filter(function (p) { return p.origSrc && p.origSrc !== p.src && !p.aiHeads; });   /* real heads laid back: the same faces by construction */
    var bad = [], i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve({ checked: list.length, bad: bad });
      var p = list[i++]; if (onStep) onStep(i, list.length);
      return Promise.all([FS.loadImg(p.origSrc), FS.loadImg(p.src)]).then(function (ims) {
        return FS.aiCheck(ims[0], ims[1], { photo: p.aiPhoto !== false, scene: !!p.aiScene, loose: !!p.aiLoose, solo: !!p.solo });
      }).then(function (r) { if (r.ok) delete p.aiBad; else { p.aiBad = r.why || 'עריכת AI לא תקינה'; bad.push(p); } }, function () {}).then(next);
    }
    return next();
  };
  FS.aiRevertBad = function (list) {
    var n = 0; (list || FS.state.photos).forEach(function (p) { if (p.aiBad && FS.unstyle && FS.unstyle(p)) { delete p.aiBad; n++; } });
    if (n) FS.emit && FS.emit('doc'); return n;
  };

  /* the models ready before the first edit: a minute after start, when the computer is idle, the face finder and the face
     landmarker load once (shipped with the site: no internet), so the first check and the first AI edit do not wait for them */
  function warm() {
    var go = function () { try { if (FS.getLandmarker) FS.getLandmarker().catch(function () {}); if (FS.detectFaces && FS.state && FS.state.photos && FS.state.photos[0]) { /* the detector loads on the first photo anyway */ } } catch (e) { /* later */ } };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 8000 }); else setTimeout(go, 3000);
  }
  if (document.readyState === 'complete') setTimeout(warm, 1500); else window.addEventListener('load', function () { setTimeout(warm, 1500); });
})();
