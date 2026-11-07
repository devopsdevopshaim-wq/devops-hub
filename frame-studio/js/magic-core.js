/* The living photo's craft, shared by the studio (wow.js) and the guest's phone (m.html, the magnet that wakes up):
   the person lifted off by its mask, the space behind them filled from around it, gold light and a sheen. No libraries,
   nothing online. window.MagicCore. */
(function () {
  'use strict';
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  /* a grey mask (white = person) as an alpha mask, at w×h; widen > 0 makes it a little larger (nothing of the person stays behind) */
  function alpha(mask, w, h, widen) {
    var c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    if (widen) x.filter = 'blur(' + widen + 'px)';
    x.drawImage(mask, 0, 0, w, h); x.filter = 'none';
    var d = x.getImageData(0, 0, w, h), a = d.data, k = widen ? 3 : 1;
    for (var i = 0; i < a.length; i += 4) { var v = Math.min(255, a[i] * k); a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = v; }
    x.putImageData(d, 0, 0); return c;
  }
  /* the space behind the person, filled from around it: push-pull over a pyramid (transparent pixels take their neighbours' colour) */
  function fillBehind(src, hole) {
    var w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, levels = [], c = canvas(w, h), x = c.getContext('2d');
    x.drawImage(src, 0, 0, w, h); x.globalCompositeOperation = 'destination-out'; x.drawImage(hole, 0, 0, w, h); x.globalCompositeOperation = 'source-over';
    levels.push(c);
    var lw = w, lh = h;
    while (lw > 4 && lh > 4 && levels.length < 12) { lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); var n = canvas(lw, lh), nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(levels[levels.length - 1], 0, 0, lw, lh); levels.push(n); }
    for (var i = levels.length - 2; i >= 0; i--) { var L = levels[i], lx = L.getContext('2d'); lx.globalCompositeOperation = 'destination-over'; lx.imageSmoothingQuality = 'high'; lx.drawImage(levels[i + 1], 0, 0, L.width, L.height); lx.globalCompositeOperation = 'source-over'; }
    return levels[0];
  }
  /* the picture cut by an alpha mask */
  function cut(src, am) { var w = am.width, h = am.height, c = canvas(w, h), x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h); x.globalCompositeOperation = 'destination-in'; x.drawImage(am, 0, 0); x.globalCompositeOperation = 'source-over'; return c; }
  /* where the person is (0..1), how much of the picture they cover */
  function centroid(mask) {
    var s = 64, c = canvas(s, s), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(mask, 0, 0, s, s);
    var a = x.getImageData(0, 0, s, s).data, sx = 0, sy = 0, t = 0, top = s;
    for (var y = 0; y < s; y++) for (var k = 0; k < s; k++) { var v = a[(y * s + k) * 4] / 255; if (a[(y * s + k) * 4 + 3] < 255) v = a[(y * s + k) * 4 + 3] / 255; if (v > 0.4) { sx += k * v; sy += y * v; t += v; if (y < top) top = y; } }
    return t ? { x: sx / t / s, y: sy / t / s, top: top / s, cover: t / (s * s) } : { x: 0.5, y: 0.5, top: 0.3, cover: 0 };
  }
  function makeDots(n) { return Array.from({ length: n || 46 }, function (_, i) { return { x: Math.random(), y: Math.random(), r: 0.004 + Math.random() * 0.012, s: 0.25 + Math.random() * 0.9, ph: Math.random() * 6.28, front: i % 4 === 0 }; }); }
  /* gold bokeh drifting up (behind the person, or the few in front) */
  function dots(ctx, list, w, h, t, front) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    list.forEach(function (o) {
      if (!!o.front !== front) return;
      var y = ((o.y - t * o.s) % 1 + 1) % 1, x = o.x + Math.sin(t * 6.28 + o.ph) * 0.02, r = o.r * Math.min(w, h) * (front ? 1.6 : 1), s2 = Math.sin(t * 12.56 + o.ph), a = 0.25 + 0.35 * s2 * s2;
      var g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
      g.addColorStop(0, 'rgba(255,236,190,' + a + ')'); g.addColorStop(0.4, 'rgba(227,196,138,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(227,196,138,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * w, y * h, r, 0, 6.29); ctx.fill();
    });
    ctx.restore();
  }
  /* a soft diagonal light passing once per loop */
  function sheen(ctx, w, h, t) {
    var st = (t * 1.6) % 1.6 - 0.3; if (st <= -0.3 || st >= 1.3) return;
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; var gx = st * w * 1.4, g = ctx.createLinearGradient(gx - w * 0.3, 0, gx + w * 0.1, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,248,225,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  /* there and back over the loop, eased: a seamless loop */
  function swing(t) { return ease(t < 0.5 ? t * 2 : 2 - t * 2); }
  /* a whole picture (a printed magnet) and its person mask → what the living magnet needs */
  function layers(img, mask, max) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, (max || 1200) / Math.max(iw, ih)), w = Math.round(iw * k), h = Math.round(ih * k);
    var pic = canvas(w, h); pic.getContext('2d').drawImage(img, 0, 0, w, h);
    var hard = alpha(mask, w, h, 0), wide = alpha(mask, w, h, Math.max(4, Math.round(Math.max(w, h) / 140)));
    return { w: w, h: h, pic: pic, bg: fillBehind(pic, wide), person: cut(pic, hard), c: centroid(mask), dots: makeDots(46) };
  }
  /* one frame of the living magnet: the person comes forward out of the magnet, the rest stays */
  function magnetFrame(ctx, L, t, tilt) {
    var w = L.w, h = L.h, e = swing(t), ax = L.c.x * w, ay = L.c.y * h, tx = tilt ? tilt.x : 0, ty = tilt ? tilt.y : 0;
    var bz = 1 + 0.025 * e, pz = 1.02 + 0.13 * e, pdx = tx * 0.03 * w, pdy = -0.03 * h * e + ty * 0.02 * h;
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.translate(ax, ay); ctx.scale(bz, bz); ctx.translate(-ax - tx * 0.012 * w, -ay); ctx.drawImage(L.bg, 0, 0); ctx.restore();
    dots(ctx, L.dots, w, h, t, false);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = Math.round(w * 0.03 * e); ctx.shadowOffsetY = Math.round(h * 0.01 * e);
    ctx.translate(ax + pdx, ay + pdy); ctx.scale(pz, pz); ctx.translate(-ax, -ay); ctx.drawImage(L.person, 0, 0); ctx.restore();
    sheen(ctx, w, h, t); dots(ctx, L.dots, w, h, t, true);
    ctx.restore();
  }
  window.MagicCore = { canvas: canvas, alpha: alpha, fillBehind: fillBehind, cut: cut, centroid: centroid, makeDots: makeDots, dots: dots, sheen: sheen, swing: swing, layers: layers, magnetFrame: magnetFrame };
})();
