/* Keeping the real faces (Oct 26). Image models redraw faces, and the free ones often bend them. For the looks that must stay a
   photograph of the same people (on the real person, superheroes, smart edits), every face of the original is put back into the AI
   result: the face landmarks of both pictures are found on this computer (MediaPipe FaceLandmarker, models/face_landmarker.task,
   no internet), the original face is turned, scaled and moved onto the new head (a least-squares similarity fit on stable points),
   its colours are brought towards the new picture's light, and it is laid in through a soft oval mask. A face that moved or turned
   too much (the fit error is large) is left as the model drew it. FS.keepFaces(original, result) → a new image, or null.
   On/off: localStorage 'fs-ai-keepfaces' (on unless '0'). */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS) return;
  var OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  var ALIGN = [33, 133, 362, 263, 1, 4, 61, 291, 199, 152, 10, 234, 454, 168, 6];
  FS.keepFacesOn = function (v) { try { if (v !== undefined) localStorage.setItem('fs-ai-keepfaces', v ? '1' : '0'); return localStorage.getItem('fs-ai-keepfaces') !== '0'; } catch (e) { return true; } };

  function canvasOf(im, W, H) { var c = FS.canvas(W, H), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H); return c; }
  function detect(lm, c) {
    var k = Math.min(1, 1280 / Math.max(c.width, c.height)), s = k < 1 ? canvasOf(c, Math.round(c.width * k), Math.round(c.height * k)) : c;
    var r = lm.detect(s);
    return (r.faceLandmarks || []).map(function (pts) { return pts.map(function (q) { return { x: q.x * c.width, y: q.y * c.height }; }); });
  }
  function box(pts) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; OVAL.forEach(function (i) { var q = pts[i]; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
  /* the similarity (scale, rotation, move) that takes the original face's points onto the new face's points */
  function fit(P, Q) {
    var n = ALIGN.length, px = 0, py = 0, qx = 0, qy = 0;
    ALIGN.forEach(function (i) { px += P[i].x; py += P[i].y; qx += Q[i].x; qy += Q[i].y; }); px /= n; py /= n; qx /= n; qy /= n;
    var a = 0, b = 0, nn = 0;
    ALIGN.forEach(function (i) { var x = P[i].x - px, y = P[i].y - py, u = Q[i].x - qx, v = Q[i].y - qy; a += x * u + y * v; b += x * v - y * u; nn += x * x + y * y; });
    var c = a / nn, s = b / nn, tx = qx - (c * px - s * py), ty = qy - (s * px + c * py), err = 0;
    ALIGN.forEach(function (i) { var X = c * P[i].x - s * P[i].y + tx, Y = s * P[i].x + c * P[i].y + ty; err += Math.hypot(X - Q[i].x, Y - Q[i].y); });
    return { c: c, s: s, tx: tx, ty: ty, err: err / n, scale: Math.hypot(c, s) };
  }
  function stats(d, m) {
    var S = [0, 0, 0], Q = [0, 0, 0], n = 0;
    for (var i = 0; i < m.length; i += 4) { if (m[i + 3] < 200) continue; for (var k = 0; k < 3; k++) { S[k] += d[i + k]; Q[k] += d[i + k] * d[i + k]; } n++; }
    if (!n) return null; return S.map(function (s, k) { var mu = s / n; return [mu, Math.sqrt(Math.max(1, Q[k] / n - mu * mu))]; });
  }
  FS.keepFaces = function (orig, res) {
    if (!FS.getLandmarker || !FS.keepFacesOn()) return Promise.resolve(null);
    return FS.getLandmarker().then(function (lm) {
      var W = res.naturalWidth || res.width, H = res.naturalHeight || res.height;
      var oc = canvasOf(orig, W, H), rc = canvasOf(res, W, H);
      var OF = detect(lm, oc), RF = detect(lm, rc), used = {}, done = 0;
      if (!OF.length || !RF.length) return null;
      var out = rc, ox = out.getContext('2d', { willReadFrequently: true });
      OF.forEach(function (P) {
        var bo = box(P), best = -1, bd = 1e9;
        RF.forEach(function (Q, j) { if (used[j]) return; var br = box(Q), d = Math.hypot(br.cx - bo.cx, br.cy - bo.cy), ratio = br.w / bo.w; if (d < bo.w * 0.9 && ratio > 0.55 && ratio < 1.8 && d < bd) { bd = d; best = j; } });
        if (best < 0) return;
        var Q = RF[best], T = fit(P, Q), br = box(Q);
        if (T.err > br.w * 0.075) return;   /* turned or changed too much: leave the model's face */
        used[best] = 1;
        /* the region: the new face's box with a margin */
        var m = br.w * 0.25, X = Math.max(0, Math.floor(br.x - m)), Y = Math.max(0, Math.floor(br.y - m)), BW = Math.min(W - X, Math.ceil(br.w + m * 2)), BH = Math.min(H - Y, Math.ceil(br.h + m * 2));
        if (BW < 8 || BH < 8) return;
        /* the original face moved onto the new head */
        var fc = FS.canvas(BW, BH), fx = fc.getContext('2d', { willReadFrequently: true });
        fx.setTransform(T.c, T.s, -T.s, T.c, T.tx - X, T.ty - Y); fx.imageSmoothingQuality = 'high'; fx.drawImage(oc, 0, 0); fx.setTransform(1, 0, 0, 1, 0, 0);
        /* a soft oval: the original oval moved the same way, pulled in a little so hair and background stay the model's */
        var mc = FS.canvas(BW, BH), mx = mc.getContext('2d'), pts = OVAL.map(function (i) { var q = P[i]; return { x: T.c * q.x - T.s * q.y + T.tx - X, y: T.s * q.x + T.c * q.y + T.ty - Y }; });
        var cx = 0, cy = 0; pts.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= pts.length; cy /= pts.length;
        var hard = FS.canvas(BW, BH), hx = hard.getContext('2d'); hx.fillStyle = '#fff'; hx.beginPath();
        pts.forEach(function (q, i) { var x = cx + (q.x - cx) * 0.9, y = cy + (q.y - cy) * (q.y < cy ? 0.86 : 0.93); if (i) hx.lineTo(x, y); else hx.moveTo(x, y); }); hx.closePath(); hx.fill();
        mx.filter = 'blur(' + Math.max(2, Math.round(br.w * 0.045)) + 'px)'; mx.drawImage(hard, 0, 0); mx.filter = 'none';
        /* the original face's colours brought most of the way to the new picture's light inside the oval */
        var fd = fx.getImageData(0, 0, BW, BH), md = mx.getImageData(0, 0, BW, BH).data, rd = ox.getImageData(X, Y, BW, BH).data;
        var A = stats(fd.data, md), B = stats(rd, md);
        if (A && B) for (var i = 0; i < fd.data.length; i += 4) for (var k = 0; k < 3; k++) { var v = fd.data[i + k], t = (v - A[k][0]) / A[k][1] * B[k][1] + B[k][0]; fd.data[i + k] = v + (t - v) * 0.55; }
        for (var a = 0; a < fd.data.length; a += 4) fd.data[a + 3] = md[a + 3] * (md[a] / 255);
        fx.putImageData(fd, 0, 0);
        ox.drawImage(fc, X, Y); done++;
      });
      if (!done) return null;
      return new Promise(function (ok) { out.toBlob(function (bl) { ok(bl ? FS.loadImg(URL.createObjectURL(bl)) : null); }, 'image/jpeg', 0.94); }).then(function (im) { if (im) im.facesKept = done; return im; });
    }).catch(function (e) { if (window.console) console.warn('keepFaces', e); return null; });
  };
})();
