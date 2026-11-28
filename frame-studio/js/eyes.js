/* 😌 Nobody's eyes closed: in a photo where someone blinked, their open eyes are taken from a photo next to it (the same
   moment, a burst), lined up on the eye corners, the brow and the nose bridge, matched to the skin's colour and blended in
   softly. Only the eyes that were closed change; the original stays (↩ ביטול AI brings it back). Everything on this computer. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS || !window.FaceSig) return;
  var EYES = [
    { corners: [33, 133], lids: [159, 145], ring: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], anchor: [33, 133, 70, 105, 107, 168, 116] },
    { corners: [362, 263], lids: [386, 374], ring: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398], anchor: [362, 263, 300, 334, 336, 168, 345] }
  ];
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function openness(P, e) { return dist(P[e.lids[0]], P[e.lids[1]]) / Math.max(1, dist(P[e.corners[0]], P[e.corners[1]])); }
  /* the 2D similarity (scale, rotation, shift) that best carries points A onto points B (least squares) */
  function similarity(A, B) {
    var n = A.length, ax = 0, ay = 0, bx = 0, by = 0, i;
    for (i = 0; i < n; i++) { ax += A[i].x; ay += A[i].y; bx += B[i].x; by += B[i].y; }
    ax /= n; ay /= n; bx /= n; by /= n;
    var sxx = 0, sxy = 0, va = 0;
    for (i = 0; i < n; i++) { var x1 = A[i].x - ax, y1 = A[i].y - ay, x2 = B[i].x - bx, y2 = B[i].y - by; sxx += x1 * x2 + y1 * y2; sxy += x1 * y2 - y1 * x2; va += x1 * x1 + y1 * y1; }
    var a = sxx / va, b = sxy / va;   /* [a -b; b a] */
    return { a: a, b: b, e: bx - (a * ax - b * ay), f: by - (b * ax + a * ay) };
  }
  function apply(T, p) { return { x: T.a * p.x - T.b * p.y + T.e, y: T.b * p.x + T.a * p.y + T.f }; }
  function residual(T, A, B) { var s = 0; for (var i = 0; i < A.length; i++) s += dist(apply(T, A[i]), B[i]); return s / A.length; }
  /* points from the detection canvas up to the full photo */
  function full(f, im) { var k = (im.naturalWidth || im.width) / f.canvas.width; return f.pts.map(function (p) { return { x: p.x * k, y: p.y * k }; }); }
  function mean(cx, x, y, r) {
    var s = Math.max(2, Math.round(r)), d = cx.getImageData(Math.round(x - s), Math.round(y - s), s * 2, s * 2).data, t = [0, 0, 0], n = 0;
    for (var i = 0; i < d.length; i += 4) { t[0] += d[i]; t[1] += d[i + 1]; t[2] += d[i + 2]; n++; } return t.map(function (v) { return v / Math.max(1, n); });
  }

  /* fix one photo with the photos given as donors; resolves to the number of eyes opened */
  FS.openEyes = function (p, donors) {
    var im = FS.img(p.src); if (!im) return Promise.resolve(0);
    FS.busy && FS.busy('מחפש עיניים עצומות…');
    return FaceSig.detect(im).then(function (faces) {
      var need = [];
      faces.forEach(function (f) { var P = full(f, im); EYES.forEach(function (e, ei) { if (openness(P, e) < 0.13) need.push({ P: P, e: e, ei: ei }); }); });
      if (!need.length) { FS.busy && FS.busy(); FS.toast('😊 אין כאן עיניים עצומות.'); return 0; }
      var W = im.naturalWidth, H = im.naturalHeight, out = FS.canvas(W, H), ox = out.getContext('2d', { willReadFrequently: true }); ox.drawImage(im, 0, 0);
      var fixed = 0, chain = Promise.resolve();
      (donors || []).forEach(function (q) {
        chain = chain.then(function () {
          if (fixed >= need.length) return;
          var dim = FS.img(q.src); if (!dim) return;
          FS.busy && FS.busy('מחפש עיניים פקוחות בתמונה סמוכה…');
          return FaceSig.detect(dim).then(function (dfaces) {
            var D = dfaces.map(function (f) { return full(f, dim); });
            need.forEach(function (n) {
              if (n.done) return;
              /* the same person in the donor: the face whose stable points line up best */
              var face = [33, 133, 362, 263, 1, 6, 152, 234, 454], best = null;
              D.forEach(function (Q) { var A = face.map(function (i) { return Q[i]; }), B = face.map(function (i) { return n.P[i]; }), T = similarity(A, B), r = residual(T, A, B) / dist(n.P[33], n.P[263]); if (r < 0.12 && (!best || r < best.r)) best = { Q: Q, r: r }; });
              if (!best || openness(best.Q, n.e) < 0.2) return;
              var A2 = n.e.anchor.map(function (i) { return best.Q[i]; }), B2 = n.e.anchor.map(function (i) { return n.P[i]; }), T2 = similarity(A2, B2);
              var c0 = n.P[n.e.corners[0]], c1 = n.P[n.e.corners[1]], cx = (c0.x + c1.x) / 2, cy = (c0.y + c1.y) / 2, ew = dist(c0, c1), ang = Math.atan2(c1.y - c0.y, c1.x - c0.x);
              var bw = Math.ceil(ew * 2.2), bx = Math.round(cx - bw / 2), by = Math.round(cy - bw / 2);
              /* the donor, carried onto this photo, around this eye */
              var wc = FS.canvas(bw, bw), wx = wc.getContext('2d', { willReadFrequently: true });
              wx.setTransform(T2.a, T2.b, -T2.b, T2.a, T2.e - bx, T2.f - by); wx.imageSmoothingQuality = 'high'; wx.drawImage(dim, 0, 0); wx.setTransform(1, 0, 0, 1, 0, 0);
              /* the skin under the eye decides the colour */
              var below = { x: cx - (c1.y - c0.y) * 0.5, y: cy + ew * 0.55 }, mT = mean(ox, below.x, below.y, ew * 0.15), mD = mean(wx, below.x - bx, below.y - by, ew * 0.15);
              var g = [0, 1, 2].map(function (k) { return Math.max(0.8, Math.min(1.25, mT[k] / Math.max(1, mD[k]))); });
              var id = wx.getImageData(0, 0, bw, bw), a = id.data; for (var i = 0; i < a.length; i += 4) { a[i] = Math.min(255, a[i] * g[0]); a[i + 1] = Math.min(255, a[i + 1] * g[1]); a[i + 2] = Math.min(255, a[i + 2] * g[2]); }
              wx.putImageData(id, 0, 0);
              /* a soft ellipse around the eye, so no edge shows */
              var mk = FS.canvas(bw, bw), mx = mk.getContext('2d'); mx.translate(bw / 2, bw / 2); mx.rotate(ang); mx.scale(1, 0.55);
              var gr = mx.createRadialGradient(0, 0, ew * 0.35, 0, 0, ew * 0.85); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
              mx.fillStyle = gr; mx.beginPath(); mx.arc(0, 0, ew * 0.85, 0, 6.29); mx.fill();
              wx.globalCompositeOperation = 'destination-in'; wx.drawImage(mk, 0, 0); wx.globalCompositeOperation = 'source-over';
              ox.drawImage(wc, bx, by); n.done = true; fixed++;
            });
          }).catch(function () { /* that donor could not be read */ });
        });
      });
      return chain.then(function () {
        FS.busy && FS.busy();
        if (!fixed) { FS.toast('לא מצאתי תמונה סמוכה עם אותו אדם בעיניים פקוחות. מסמנים כמה תמונות מאותו רגע ומנסים שוב.', 7000); return 0; }
        return FS.loadImg(out.toDataURL('image/jpeg', 0.95)).then(function (img2) {
          if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
          p.src = img2.src; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null;
          if (FS.snap) FS.snap(p); FS.render(); if (FS.refreshStrip) FS.refreshStrip();
          FS.toast('😌 ' + (fixed === 1 ? 'עין אחת נפתחה' : fixed + ' עיניים נפתחו') + (fixed < need.length ? ' (' + (need.length - fixed) + ' לא נמצאו פקוחות)' : '') + '. "↩ ביטול AI" מחזיר.', 6000);
          return fixed;
        });
      });
    }).catch(function (e) { FS.busy && FS.busy(); FS.toast('זיהוי הפנים לא נטען (' + ((e && e.message) || '') + ').', 5000); return 0; });
  };
  /* the button: donors are the marked photos, or the photos next to this one in the strip */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-open-eyes]')) return;
    var p = FS.cur(); if (!p) return FS.toast('בוחרים תמונה');
    var S = FS.state, i = S.photos.indexOf(p), m = FS.marked().filter(function (q) { return q !== p; });
    var donors = m.length ? m : S.photos.filter(function (q, k) { return q !== p && Math.abs(k - i) <= 4; }).sort(function (a, b) { return Math.abs(S.photos.indexOf(a) - i) - Math.abs(S.photos.indexOf(b) - i); });
    if (!donors.length) return FS.toast('צריך עוד תמונה מאותו רגע (צילום ברצף), שבה העיניים פקוחות.', 6000);
    FS.openEyes(p, donors);
  });
})();
