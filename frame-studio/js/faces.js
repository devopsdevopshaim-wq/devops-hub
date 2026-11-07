/* A face as a short signature, for "find me" at an event (window.FaceSig; used by the studio and the couple's album).
   The face landmarker (MediaPipe, shipped with the site) gives 478 points in 3D. Distances between the face's rigid points
   (eye corners, nose, cheekbones, jaw, brows; not the mouth, which moves with a smile) do not change when the head turns,
   so their ratios describe the face's shape; the colours of the skin, the hair and the lips add to it. 162 bytes, int8,
   base64. It is a likeness for ranking photos inside one event, not an identification, and nothing leaves the device but it. */
(function () {
  'use strict';
  var MP = new URL('vendor/mediapipe', location.href).href, lm = null;
  var RIGID = [33, 133, 362, 263, 1, 6, 98, 327, 2, 152, 234, 454, 172, 397, 70, 300, 105, 334, 10, 116, 345];
  var PAIRS = []; for (var i = 0; i < RIGID.length; i++) for (var j = i + 1; j < RIGID.length; j++) PAIRS.push([RIGID[i], RIGID[j]]);
  PAIRS = PAIRS.slice(0, 150);
  function load() {
    if (lm) return lm;
    lm = import(MP + '/vision_bundle.mjs').then(function (m) {
      return m.FilesetResolver.forVisionTasks(MP + '/wasm').then(function (fs) {
        return m.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: new URL('models/face_landmarker.task', location.href).href }, runningMode: 'IMAGE', numFaces: 12, outputFaceBlendshapes: true });
      });
    });
    lm.catch(function () { lm = null; });
    return lm;
  }
  function small(img, max) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  }
  /* every face in a picture: points in pixels (x, y, z), the blendshapes, and the picture it was found on */
  function detect(img, max) {
    return load().then(function (L) {
      var c = small(img, max || 1280), r = L.detect(c), W = c.width, H = c.height;
      return (r.faceLandmarks || []).map(function (pts, k) {
        var bs = {}; ((r.faceBlendshapes || [])[k] || { categories: [] }).categories.forEach(function (x) { bs[x.categoryName] = x.score; });
        return { pts: pts.map(function (p) { return { x: p.x * W, y: p.y * H, z: p.z * W }; }), bs: bs, canvas: c };
      });
    });
  }
  function d3(a, b) { var x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return Math.sqrt(x * x + y * y + z * z); }
  function patch(cx, P, x, y, r) {
    var s = Math.max(1, Math.round(r)), d = cx.getImageData(Math.max(0, Math.round(x - s)), Math.max(0, Math.round(y - s)), s * 2 || 1, s * 2 || 1).data, t = [0, 0, 0], n = 0;
    for (var i = 0; i < d.length; i += 4) { t[0] += d[i]; t[1] += d[i + 1]; t[2] += d[i + 2]; n++; }
    return n ? t.map(function (v) { return v / n; }) : [128, 128, 128];
  }
  /* the signature of one face (null when the face is too small to say anything) */
  function sig(f) {
    var P = f.pts, eye = d3(P[33], P[263]); if (eye < 18) return null;
    var out = new Int8Array(162), k = 0;
    PAIRS.forEach(function (pr) { var v = Math.log(Math.max(0.05, d3(P[pr[0]], P[pr[1]]) / eye)) * 60; out[k++] = Math.max(-127, Math.min(127, Math.round(v))); });
    var cx = f.canvas.getContext('2d', { willReadFrequently: true }), r = eye * 0.12, up = { x: P[10].x - (P[152].x - P[10].x) * 0.18, y: P[10].y - (P[152].y - P[10].y) * 0.18 };
    [patch(cx, P, P[151].x, P[151].y, r), patch(cx, P, P[50].x, P[50].y, r), patch(cx, P, up.x, up.y, r * 1.5), patch(cx, P, P[13].x, P[13].y + eye * 0.05, r * 0.6)].forEach(function (c) {
      c.forEach(function (v) { out[k++] = Math.max(-127, Math.min(127, Math.round(v / 2 - 64))); });
    });
    var bin = ''; for (var i = 0; i < out.length; i++) bin += String.fromCharCode(out[i] & 255); return btoa(bin);
  }
  /* all the faces of a picture as signatures */
  function describe(img) { return detect(img).then(function (fs) { return fs.map(sig).filter(Boolean); }); }
  /* the biggest face of a selfie */
  function selfie(img) {
    return detect(img, 960).then(function (fs) {
      if (!fs.length) return null;
      fs.sort(function (a, b) { return d3(b.pts[33], b.pts[263]) - d3(a.pts[33], a.pts[263]); });
      return sig(fs[0]);
    });
  }
  window.FaceSig = { load: load, detect: detect, sig: sig, describe: describe, selfie: selfie };
})();
