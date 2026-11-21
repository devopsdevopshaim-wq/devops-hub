/* חבילת אפקטים נוספת: ציור (שמן במשיכות מכחול, סכין, גואש, פסטל, פואנטיליזם, ויטראז׳, פסיפס, דיו יפני),
   גרפיטי (סטנסיל על בטון, ספריי על לבנים, ניאון), מנגה (קווי פעולה, שוג׳ו) וקומיקס (הדפס CMYK, עט כדורי).
   הכול רץ בדפדפן על canvas. */
(function () {
  'use strict';

  var FX = window.ComicFX, U = FX.util;
  var canvasOf = U.canvasOf, ctx2d = U.ctx2d, rng = U.rng, clamp01 = U.clamp01, clamp255 = U.clamp255, ss = U.smoothstep;
  var blur = U.blur, lumOf = U.lumOf, toCanvas = U.toCanvas, grayCanvas = U.grayCanvas, hex = U.hex;
  var rgb2hsv = U.rgb2hsv, hsv2rgb = U.hsv2rgb, kuwahara = U.kuwahara, inkLines = U.inkLines, multiplyInk = U.multiplyInk;
  var halftone = U.halftone, grain = U.grain, paperTex = U.paperTex, satAdjust = U.satAdjust, posterHSV = U.posterHSV;

  function noise(w, h, seed, r) {
    var g = rng(seed), a = new Float32Array(w * h);
    for (var i = 0; i < a.length; i++) a[i] = g();
    return r ? blur(a, w, h, r) : a;
  }

  /* רעש בכמה קני מידה, מנורמל ל-0..1 */
  function fbm(w, h, seed, base) {
    var out = new Float32Array(w * h), amp = 1, tot = 0;
    for (var o = 0; o < 4; o++) {
      var n = noise(w, h, seed + o * 17, Math.max(1, Math.round(base / Math.pow(2, o))));
      var mn = 1, mx = 0, i;
      for (i = 0; i < n.length; i++) { if (n[i] < mn) mn = n[i]; if (n[i] > mx) mx = n[i]; }
      var k = mx > mn ? 1 / (mx - mn) : 1;
      for (i = 0; i < n.length; i++) out[i] += (n[i] - mn) * k * amp;
      tot += amp; amp *= 0.5;
    }
    for (var j = 0; j < out.length; j++) out[j] /= tot;
    return out;
  }

  function gradients(L, w, h) {
    var gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var j = y * w + x;
      gx[j] = L[j + 1 - w] + 2 * L[j + 1] + L[j + 1 + w] - L[j - 1 - w] - 2 * L[j - 1] - L[j - 1 + w];
      gy[j] = L[j + w - 1] + 2 * L[j + w] + L[j + w + 1] - L[j - w - 1] - 2 * L[j - w] - L[j - w + 1];
    }
    return { gx: gx, gy: gy };
  }

  function shuffle(a, r) {
    for (var i = a.length - 1; i > 0; i--) { var k = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[k]; a[k] = t; }
    return a;
  }

  function rgbStr(r, g, b, a) { return 'rgba(' + (r * 255 | 0) + ',' + (g * 255 | 0) + ',' + (b * 255 | 0) + ',' + (a == null ? 1 : a) + ')'; }

  /* תאורת תבליט: מרקם צבע עבה שמקבל אור מלמעלה-שמאל */
  function emboss(c, heightSrc, strength) {
    var w = c.width, h = c.height, x = ctx2d(c), im = x.getImageData(0, 0, w, h), d = im.data;
    var H = heightSrc;
    for (var y = 1; y < h - 1; y++) for (var xx = 1; xx < w - 1; xx++) {
      var j = y * w + xx, i = j * 4;
      var s = 1 + (H[j - w - 1] - H[j + w + 1]) * strength;
      d[i] = clamp255(d[i] * s); d[i + 1] = clamp255(d[i + 1] * s); d[i + 2] = clamp255(d[i + 2] * s);
    }
    x.putImageData(im, 0, 0);
  }

  function canvasWeave(w, h, sc) {
    var t = new Float32Array(w * h), per = Math.max(3, 4 * sc);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      t[y * w + x] = (Math.sin(x / per * Math.PI) * Math.sin(y / per * Math.PI)) * 0.5;
    }
    return t;
  }

  /* ---------- ציור ---------- */

  /* שמן: שכבות של משיכות מכחול לאורך כיוון הקווים, מגסות לעדינות, ואז תבליט של צבע עבה */
  function oil(P, p, sc, opt) {
    opt = opt || {};
    var w = P.w, h = P.h, r = rng(97);
    var K = kuwahara(P, Math.round(2 * sc));
    satAdjust(K, p.sat / 100);
    var L = lumOf(K), Lb = blur(L, w, h, 3 * sc), G = gradients(Lb, w, h);
    var c = toCanvas({ w: w, h: h, R: blur(K.R, w, h, 6 * sc), G: blur(K.G, w, h, 6 * sc), B: blur(K.B, w, h, 6 * sc) });
    var x = ctx2d(c);
    x.lineCap = opt.knife ? 'butt' : 'round';
    x.lineJoin = 'round';
    var bs = p.brush / 8;
    var layers = opt.knife ? [16, 9, 5, 2.6] : [14, 8, 4.2, 2.4];
    layers.forEach(function (base, li) {
      var size = base * bs * sc, step = Math.max(1.5, size * (opt.knife ? 0.9 : 0.75)), pts = [];
      for (var yy = 0; yy < h; yy += step) for (var xx2 = 0; xx2 < w; xx2 += step) {
        var px = xx2 + (r() - 0.5) * step, py = yy + (r() - 0.5) * step;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        pts.push([px, py]);
      }
      shuffle(pts, r);
      pts.forEach(function (pt) {
        var ix = pt[0] | 0, iy = pt[1] | 0, j = iy * w + ix;
        var gx = G.gx[j], gy = G.gy[j], mag = Math.sqrt(gx * gx + gy * gy);
        /* המשיכות העדינות רק איפה שיש פרטים */
        if (li >= 2 && mag < 0.05 + (li - 2) * 0.05) return;
        var ang = Math.atan2(gy, gx) + Math.PI / 2 + (r() - 0.5) * 0.35;
        var len = size * (opt.knife ? 1.4 + r() : 1.6 + r() * 1.8) * (mag > 0.25 ? 0.7 : 1);
        var v = (r() - 0.5) * 0.06;
        x.strokeStyle = rgbStr(clamp01(K.R[j] + v), clamp01(K.G[j] + v), clamp01(K.B[j] + v), opt.knife ? 0.95 : 0.88);
        x.lineWidth = size * (opt.knife ? 1.25 : 0.95);
        var dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2, bend = (r() - 0.5) * size * 0.8;
        x.beginPath();
        x.moveTo(pt[0] - dx, pt[1] - dy);
        x.quadraticCurveTo(pt[0] - dy / len * bend * 2, pt[1] + dx / len * bend * 2, pt[0] + dx, pt[1] + dy);
        x.stroke();
      });
    });
    /* תבליט: פרטים בתדר גבוה של הצבע שצויר + אריג קנבס */
    var Lp = lumOf(U.planes(c)), hb = blur(Lp, w, h, 2), hgt = new Float32Array(w * h), weave = canvasWeave(w, h, sc);
    var tex = p.texture / 100;
    for (var i = 0; i < hgt.length; i++) hgt[i] = (Lp[i] - hb[i]) * 6 * tex + weave[i] * 0.08 * tex;
    emboss(c, hgt, opt.knife ? 1.5 : 2.4);
    return c;
  }

  function gouache(P, p, sc) {
    var w = P.w, h = P.h;
    var K = kuwahara(kuwahara(P, Math.round(4 * sc)), Math.round(3 * sc));
    satAdjust(K, p.sat / 100);
    posterHSV(K, Math.max(5, p.levels + 3), 1, { gamma: 0.95 });
    var L = lumOf(K), bl = blur(L, w, h, 2 * sc), tex = paperTex(w, h, 23), tx = p.texture / 100;
    for (var j = 0; j < L.length; j++) {
      var edge = Math.max(0, bl[j] - L[j]) * 1.6, t = tex[j] * 0.05 * tx;
      K.R[j] = clamp01(K.R[j] * (1 - edge) + t); K.G[j] = clamp01(K.G[j] * (1 - edge) + t); K.B[j] = clamp01(K.B[j] * (1 - edge) + t);
    }
    var c = toCanvas(K);
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.5, sc), '#2a2430', 0.5);
    return c;
  }

  /* פסטל: משיכות קצרות באלכסון על נייר צבעוני עם גרעין, הנייר מציץ בין הגיר */
  function pastel(P, p, sc) {
    var w = P.w, h = P.h, r = rng(41);
    var K = kuwahara(P, Math.round(3 * sc));
    satAdjust(K, p.sat / 100);
    var paperCol = hex('#3a3646');
    var c = canvasOf(w, h), x = ctx2d(c);
    x.fillStyle = '#3a3646';
    x.fillRect(0, 0, w, h);
    x.lineCap = 'round';
    var size = Math.max(1.5, p.brush * 0.45 * sc);
    [1, 0.6].forEach(function (pass) {
      var step = size * 1.1 * pass;
      for (var yy = 0; yy < h; yy += step) for (var xx = 0; xx < w; xx += step) {
        var px = xx + (r() - 0.5) * step * 2, py = yy + (r() - 0.5) * step * 2;
        var ix = Math.min(w - 1, Math.max(0, px | 0)), iy = Math.min(h - 1, Math.max(0, py | 0)), j = iy * w + ix;
        var ang = -0.9 + (r() - 0.5) * 0.5, len = size * (2.5 + r() * 3);
        x.strokeStyle = rgbStr(K.R[j], K.G[j], K.B[j], 0.75);
        x.lineWidth = size * (0.5 + r() * 0.5);
        x.beginPath();
        x.moveTo(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 2);
        x.lineTo(px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 2);
        x.stroke();
      }
    });
    /* שן הנייר: גרעין שמחזיר את צבע הנייר בנקודות */
    var im = x.getImageData(0, 0, w, h), d = im.data, tooth = noise(w, h, 5, 0), tx = p.texture / 100;
    for (var i = 0, j2 = 0; j2 < w * h; i += 4, j2++) {
      if (tooth[j2] < 0.06 * tx) { d[i] = paperCol[0] * 255; d[i + 1] = paperCol[1] * 255; d[i + 2] = paperCol[2] * 255; }
    }
    x.putImageData(im, 0, 0);
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.4, sc), '#1c1a24', 0.35);
    return c;
  }

  function pointillism(P, p, sc) {
    var w = P.w, h = P.h, r = rng(7);
    var K = kuwahara(P, Math.round(2 * sc));
    var c = canvasOf(w, h), x = ctx2d(c);
    x.fillStyle = '#fbf8f0';
    x.fillRect(0, 0, w, h);
    var size = Math.max(1.5, p.dots * 0.42 * sc), step = size * 1.05, sat = p.sat / 100;
    var pts = [];
    for (var yy = 0; yy < h; yy += step) for (var xx = 0; xx < w; xx += step) pts.push([xx + (r() - 0.5) * step, yy + (r() - 0.5) * step]);
    shuffle(pts, r);
    pts.forEach(function (pt) {
      var ix = Math.min(w - 1, Math.max(0, pt[0] | 0)), iy = Math.min(h - 1, Math.max(0, pt[1] | 0)), j = iy * w + ix;
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      /* צבעים טהורים שמתערבבים בעין: הזזת גוון קטנה ורוויה גבוהה */
      var hue = (hsv[0] + (r() - 0.5) * 50 + 360) % 360, s2 = Math.min(1, hsv[1] * sat * 1.35 + 0.08), v = Math.min(1, hsv[2] * (0.92 + r() * 0.2));
      var rgb = hsv2rgb(hue, s2, v);
      x.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], 0.95);
      x.beginPath();
      x.arc(pt[0], pt[1], size * (0.7 + r() * 0.5), 0, Math.PI * 2);
      x.fill();
    });
    return c;
  }

  /* ויטראז׳: תאים לפי נקודות אקראיות, צבע ממוצע לכל תא, זכוכית ופסי עופרת */
  function voronoi(w, h, cell, seed) {
    var r = rng(seed), cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, sx = [], sy = [];
    for (var gy = 0; gy < rows; gy++) for (var gx = 0; gx < cols; gx++) { sx.push((gx + r()) * cell); sy.push((gy + r()) * cell); }
    var id = new Int32Array(w * h), dist = new Float32Array(w * h), d2nd = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var cx = Math.floor(x / cell), cy = Math.floor(y / cell), best = 1e12, sec = 1e12, bi = 0;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var gx2 = cx + ox, gy2 = cy + oy;
        if (gx2 < 0 || gy2 < 0 || gx2 >= cols || gy2 >= rows) continue;
        var k = gy2 * cols + gx2, dx = sx[k] - x, dy = sy[k] - y, dd = dx * dx + dy * dy;
        if (dd < best) { sec = best; best = dd; bi = k; } else if (dd < sec) sec = dd;
      }
      var j = y * w + x;
      id[j] = bi; dist[j] = Math.sqrt(best); d2nd[j] = Math.sqrt(sec);
    }
    return { id: id, dist: dist, d2: d2nd, n: cols * rows };
  }

  function stainedGlass(P, p, sc) {
    var w = P.w, h = P.h, cell = Math.max(6, p.dots * 2.4 * sc), V = voronoi(w, h, cell, 3);
    var sR = new Float32Array(V.n), sG = new Float32Array(V.n), sB = new Float32Array(V.n), cnt = new Float32Array(V.n), j;
    for (j = 0; j < w * h; j++) { var k = V.id[j]; sR[k] += P.R[j]; sG[k] += P.G[j]; sB[k] += P.B[j]; cnt[k]++; }
    var lead = Math.max(1.5, 2.2 * sc), sat = p.sat / 100;
    var cols = [];
    for (var i = 0; i < V.n; i++) {
      if (!cnt[i]) { cols.push([0, 0, 0]); continue; }
      var hsv = rgb2hsv(sR[i] / cnt[i], sG[i] / cnt[i], sB[i] / cnt[i]);
      cols.push(hsv2rgb(hsv[0], Math.min(1, hsv[1] * sat * 1.5 + 0.12), Math.min(1, hsv[2] * 1.1 + 0.08)));
    }
    var gl = noise(w, h, 9, Math.round(3 * sc));
    return grayCanvas(w, h, function (j2) {
      var edge = V.d2[j2] - V.dist[j2];
      if (edge < lead) return [22, 20, 24];
      var c = cols[V.id[j2]], light = 0.82 + (1 - V.dist[j2] / cell) * 0.25 + (gl[j2] - 0.5) * 0.25;
      var rim = ss(lead, lead + 2, edge);
      return [c[0] * 255 * light * rim, c[1] * 255 * light * rim, c[2] * 255 * light * rim];
    });
  }

  function mosaic(P, p, sc) {
    var w = P.w, h = P.h, t = Math.max(5, p.dots * 1.6 * sc), r = rng(13);
    var c = canvasOf(w, h), x = ctx2d(c);
    x.fillStyle = '#2e2b28';
    x.fillRect(0, 0, w, h);
    var gap = Math.max(1, t * 0.12);
    for (var yy = 0; yy < h; yy += t) for (var xx = 0; xx < w; xx += t) {
      var cx = Math.min(w - 1, (xx + t / 2) | 0), cy = Math.min(h - 1, (yy + t / 2) | 0), j = cy * w + cx;
      var hsv = rgb2hsv(P.R[j], P.G[j], P.B[j]), rgb = hsv2rgb(hsv[0], Math.min(1, hsv[1] * p.sat / 100), Math.round(hsv[2] * 10) / 10);
      x.save();
      x.translate(xx + t / 2, yy + t / 2);
      x.rotate((r() - 0.5) * 0.12);
      var s = t - gap;
      var g = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      g.addColorStop(0, rgbStr(Math.min(1, rgb[0] * 1.15), Math.min(1, rgb[1] * 1.15), Math.min(1, rgb[2] * 1.15)));
      g.addColorStop(1, rgbStr(rgb[0] * 0.8, rgb[1] * 0.8, rgb[2] * 0.8));
      x.fillStyle = g;
      x.fillRect(-s / 2, -s / 2, s, s);
      x.restore();
    }
    return c;
  }

  /* דיו יפני: שטיפות אפורות על נייר אורז, משיכות דיו עבות וחותמת אדומה */
  function sumie(P, p, sc) {
    var w = P.w, h = P.h, L = lumOf(kuwahara(P, Math.round(3 * sc))), n = fbm(w, h, 61, 10 * sc);
    var wash = blur(L, w, h, 4 * sc);
    var paper = hex('#f3ecdc'), tex = paperTex(w, h, 77);
    var c = grayCanvas(w, h, function (j2) {
      var v = wash[j2] + (n[j2] - 0.5) * 0.12;
      var ink = v < 0.25 ? 0.85 : v < 0.45 ? 0.5 : v < 0.65 ? 0.22 : 0;
      ink = Math.max(0, ink - Math.max(0, n[j2] - 0.6) * 0.8);
      var t = tex[j2] * 4;
      return [paper[0] * 255 * (1 - ink) + 20 * ink + t, paper[1] * 255 * (1 - ink) + 18 * ink + t, paper[2] * 255 * (1 - ink) + 22 * ink + t];
    });
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines, sc * 1.4), '#151318', 0.92);
    /* חותמת */
    var x = ctx2d(c), s = Math.round(Math.min(w, h) * 0.07), m = Math.round(s * 0.6);
    x.save();
    x.fillStyle = '#c0282d';
    x.globalAlpha = 0.9;
    x.fillRect(m, h - m - s, s, s);
    x.fillStyle = '#f3ecdc';
    x.font = '700 ' + Math.round(s * 0.62) + 'px "Karantina", serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('פאנל', m + s / 2, h - m - s / 2);
    x.restore();
    return c;
  }

  /* ---------- גרפיטי ---------- */

  function concreteWall(w, h, sc) {
    var n = fbm(w, h, 101, 30 * sc), f = noise(w, h, 102, 0), out = new Float32Array(w * h);
    for (var i = 0; i < out.length; i++) out[i] = 0.62 + (n[i] - 0.5) * 0.35 + (f[i] - 0.5) * 0.1;
    return out;
  }

  function brickWall(w, h, sc) {
    var bw = 64 * sc, bh = 26 * sc, mort = Math.max(1.5, 3 * sc), n = fbm(w, h, 201, 12 * sc), f = noise(w, h, 202, 0);
    var R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h), H = new Float32Array(w * h), r = rng(9);
    var tint = [];
    for (var k = 0; k < 4000; k++) tint.push(0.85 + r() * 0.3);
    for (var y = 0; y < h; y++) {
      var row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0, yIn = y - row * bh;
      for (var x = 0; x < w; x++) {
        var col = Math.floor((x + off) / bw), xIn = x + off - col * bw, j = y * w + x;
        var isM = yIn < mort || xIn < mort, t = tint[(row * 37 + col) % 4000];
        var v = (n[j] - 0.5) * 0.25 + (f[j] - 0.5) * 0.12;
        if (isM) { R[j] = 0.7 + v; G[j] = 0.68 + v; B[j] = 0.64 + v; H[j] = 0; }
        else { R[j] = (0.62 + v) * t; G[j] = (0.3 + v * 0.6) * t; B[j] = (0.24 + v * 0.5) * t; H[j] = 1; }
      }
    }
    return { R: R, G: G, B: B, H: H };
  }

  /* טפטופי צבע: קווים אנכיים שיורדים מתחתית אזורי צבע */
  function drips(c, mask, color, amount, sc, seed) {
    if (amount <= 0) return;
    var w = c.width, h = c.height, x = ctx2d(c), r = rng(seed), n = Math.round(w * amount / 100 * 0.12);
    x.save();
    x.lineCap = 'round';
    for (var i = 0; i < n * 6 && n > 0; i++) {
      var px = (r() * w) | 0, py = (r() * h * 0.92) | 0, j = py * w + px;
      if (!mask(j) || (py + 3 < h && mask((py + 3) * w + px))) continue;
      var len = (20 + r() * 110) * sc * (0.4 + amount / 100), wd = (1.2 + r() * 2.8) * sc;
      var col = typeof color === 'function' ? color(j) : color;
      var g = x.createLinearGradient(0, py, 0, py + len);
      g.addColorStop(0, col); g.addColorStop(1, col);
      x.strokeStyle = g;
      x.lineWidth = wd;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + len); x.stroke();
      x.fillStyle = col;
      x.beginPath(); x.arc(px, py + len, wd * 0.9, 0, Math.PI * 2); x.fill();
      n--;
    }
    x.restore();
  }

  function stencil(P, p, sc) {
    var w = P.w, h = P.h, K = kuwahara(P, Math.round(3 * sc)), L = blur(lumOf(K), w, h, sc), wall = concreteWall(w, h, sc);
    var edge = noise(w, h, 31, 0), j;
    /* ספים לפי התפלגות הבהירות של התמונה, כדי שתמיד יהיו שלושה גוונים ברורים */
    var sorted = Array.prototype.slice.call(L).sort(function (a, b) { return a - b; });
    var q = function (f) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))]; };
    var t1 = q(0.36) + p.bright / 200, t2 = q(0.66) + p.bright / 200;
    var lvl = new Uint8Array(w * h), redF = new Float32Array(w * h), red = new Uint8Array(w * h);
    for (j = 0; j < L.length; j++) {
      var v = L[j] + (edge[j] - 0.5) * 0.05;
      lvl[j] = v < t1 ? 2 : v < t2 ? 1 : 0;
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      if ((hsv[0] < 15 || hsv[0] > 340) && hsv[1] > 0.5 && hsv[2] > 0.3) redF[j] = 1;
    }
    /* אדום רק באזורים גדולים, לא בנקודות */
    redF = blur(redF, w, h, 3 * sc);
    for (j = 0; j < L.length; j++) red[j] = redF[j] > 0.6 ? 1 : 0;
    /* אובר-ספריי: הילה רכה סביב הצבע */
    var dark = new Float32Array(w * h);
    for (j = 0; j < dark.length; j++) dark[j] = lvl[j] === 2 ? 1 : lvl[j] === 1 ? 0.45 : 0;
    var haze = blur(dark, w, h, 5 * sc);
    var c = grayCanvas(w, h, function (j2) {
      var base = wall[j2] * 255, v;
      if (red[j2] && lvl[j2] > 0) return [200 * wall[j2] + 30, 30, 36];
      if (lvl[j2] === 2) v = 24;
      else if (lvl[j2] === 1) v = 118;
      else v = base * (1 - haze[j2] * 0.28);
      var spray = (edge[j2] - 0.5) * 18;
      return [v + spray, v + spray, v + spray + 2];
    });
    drips(c, function (j3) { return lvl[j3] === 2; }, 'rgba(20,20,22,0.92)', p.drips, sc, 5);
    return c;
  }

  function sprayWall(P, p, sc, neon) {
    var w = P.w, h = P.h, K = kuwahara(kuwahara(P, Math.round(3 * sc)), Math.round(2 * sc)), j;
    posterHSV(K, Math.min(6, p.levels), (p.sat / 100) * 1.6, { gamma: 0.9 });
    var L = lumOf(K), wall = brickWall(w, h, sc), tx = p.texture / 100, sp = noise(w, h, 51, 0);
    var NEON = [hex('#ff2fb3'), hex('#21e6ff'), hex('#b6ff2a'), hex('#ffe32a'), hex('#9a5cff')];
    var O = { w: w, h: h, R: new Float32Array(w * h), G: new Float32Array(w * h), B: new Float32Array(w * h) };
    for (j = 0; j < L.length; j++) {
      var cr = K.R[j], cg = K.G[j], cb = K.B[j];
      if (neon) {
        var hsv = rgb2hsv(cr, cg, cb), band = Math.min(4, Math.floor(((hsv[0] + L[j] * 120) % 360) / 72));
        var nc = NEON[band], k = ss(0.12, 0.35, L[j]);
        cr = nc[0] * k; cg = nc[1] * k; cb = nc[2] * k;
        var wv = (wall.R[j] + wall.G[j] + wall.B[j]) / 3 * 0.25;
        O.R[j] = cr * 0.9 + wv * (1 - k); O.G[j] = cg * 0.9 + wv * (1 - k); O.B[j] = cb * 0.9 + wv * (1 - k) + 0.04;
      } else {
        /* הצבע יושב על הלבנים: המרקם נשאר, הטיח בולט */
        var m = 1 - tx * 0.35 + tx * 0.35 * (wall.R[j] + wall.G[j] + wall.B[j]) / 2;
        var spray = (sp[j] - 0.5) * 0.08;
        O.R[j] = cr * m + spray; O.G[j] = cg * m + spray; O.B[j] = cb * m + spray;
      }
    }
    var c = toCanvas(O);
    var ink = inkLines(lumOf(P), w, h, Math.max(45, p.lines), sc * 1.5);
    if (neon) {
      var gR = blur(O.R, w, h, 6 * sc), gG = blur(O.G, w, h, 6 * sc), gB = blur(O.B, w, h, 6 * sc);
      var x = ctx2d(c), im = x.getImageData(0, 0, w, h), d = im.data;
      for (var i = 0, j2 = 0; j2 < w * h; i += 4, j2++) {
        d[i] = clamp255(d[i] + gR[j2] * 120); d[i + 1] = clamp255(d[i + 1] + gG[j2] * 120); d[i + 2] = clamp255(d[i + 2] + gB[j2] * 120);
      }
      x.putImageData(im, 0, 0);
      multiplyInk(c, ink, '#05040a', 0.9);
    } else {
      /* קו מתאר כפול של גרפיטי: לבן מבחוץ, שחור מבפנים */
      var outer = blur(U.dilate(ink, w, h, Math.round(2 * sc)), w, h, 1);
      multiplyInk(c, outer, '#fbfbf6', 0.85);
      multiplyInk(c, ink, '#0d0c10', 1);
    }
    drips(c, function (j3) { return L[j3] > 0.18 && L[j3] < 0.85; }, function (j3) {
      return neon ? 'rgba(' + (O.R[j3] * 255 | 0) + ',' + (O.G[j3] * 255 | 0) + ',' + (O.B[j3] * 255 | 0) + ',0.9)'
        : 'rgba(' + (K.R[j3] * 230 | 0) + ',' + (K.G[j3] * 230 | 0) + ',' + (K.B[j3] * 230 | 0) + ',0.88)';
    }, p.drips, sc, 8);
    grain(c, 0.05, 4);
    return c;
  }

  /* ---------- מנגה ---------- */

  /* קווי פעולה: קרניים מהשוליים אל מרכז הפעולה, האזור שבמרכז נשאר נקי */
  function focusLines(c, cx, cy, amount, sc, color) {
    var w = c.width, h = c.height, x = ctx2d(c), r = rng(71), R = Math.hypot(w, h);
    var n = Math.round(90 + amount * 2.2), inner = Math.min(w, h) * (0.42 - amount / 400);
    x.save();
    x.fillStyle = color || '#111';
    for (var i = 0; i < n; i++) {
      var a = r() * Math.PI * 2, wd = (0.004 + r() * 0.012) * (0.6 + amount / 100);
      var start = inner * (0.9 + r() * 0.7);
      x.beginPath();
      x.moveTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
      x.lineTo(cx + Math.cos(a) * start, cy + Math.sin(a) * start);
      x.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
      x.closePath();
      x.fill();
    }
    x.restore();
  }

  function mangaAction(P, p, sc) {
    var c = U.R.manga(P, p, sc);
    focusLines(c, p.cx * c.width, p.cy * c.height, p.amount, sc);
    return c;
  }

  function sparkle(x, cx, cy, s, col) {
    x.save();
    x.translate(cx, cy);
    x.fillStyle = col;
    x.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, rr = i % 2 ? s * 0.18 : s;
      x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath();
    x.fill();
    x.restore();
  }

  function shoujo(P, p, sc) {
    var w = P.w, h = P.h, K = kuwahara(kuwahara(P, Math.round(3 * sc)), Math.round(2 * sc)), j;
    var pink = hex('#ffd6e8');
    for (j = 0; j < w * h; j++) {
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      var rgb = hsv2rgb(hsv[0], hsv[1] * 0.62 * p.sat / 100, 0.32 + hsv[2] * 0.72);
      K.R[j] = rgb[0] * 0.82 + pink[0] * 0.18; K.G[j] = rgb[1] * 0.82 + pink[1] * 0.18; K.B[j] = rgb[2] * 0.82 + pink[2] * 0.18;
    }
    var L = lumOf(K), hi = new Float32Array(w * h);
    for (j = 0; j < hi.length; j++) hi[j] = Math.max(0, L[j] - 0.72) * 3;
    var bR = blur(hi, w, h, 10 * sc);
    for (j = 0; j < hi.length; j++) { K.R[j] = clamp01(K.R[j] + bR[j] * 0.35); K.G[j] = clamp01(K.G[j] + bR[j] * 0.3); K.B[j] = clamp01(K.B[j] + bR[j] * 0.36); }
    var c = toCanvas(K), x = ctx2d(c), r = rng(19);
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.55, sc), '#5a3a52', 0.75);
    var n = Math.round(20 + p.amount * 0.9);
    for (var i = 0; i < n * 8 && n > 0; i++) {
      var px = r() * w, py = r() * h, jj = (py | 0) * w + (px | 0);
      if (L[jj] < 0.7) continue;
      sparkle(x, px, py, (4 + r() * 12) * sc, 'rgba(255,255,255,' + (0.7 + r() * 0.3) + ')');
      n--;
    }
    return c;
  }

  /* ---------- קומיקס ---------- */

  /* הדפס ארבעה צבעים: רשתות ציאן, מג׳נטה, צהוב ושחור בזוויות שונות על נייר */
  function cmyk(P, p, sc) {
    var w = P.w, h = P.h, K = kuwahara(P, Math.round(2 * sc));
    satAdjust(K, p.sat / 100);
    var n = w * h, C = new Float32Array(n), M = new Float32Array(n), Y = new Float32Array(n), Kk = new Float32Array(n);
    for (var j = 0; j < n; j++) {
      var k = 1 - Math.max(K.R[j], K.G[j], K.B[j]);
      var d = 1 - k || 1;
      C[j] = (1 - K.R[j] - k) / d; M[j] = (1 - K.G[j] - k) / d; Y[j] = (1 - K.B[j] - k) / d; Kk[j] = Math.max(0, k - 0.15) * 1.15;
    }
    var c = canvasOf(w, h), x = ctx2d(c);
    x.fillStyle = '#fbf7ee';
    x.fillRect(0, 0, w, h);
    var cell = Math.max(3, p.dots * sc);
    halftone(c, Y, cell, 0, '#ffe600', 0.95, 'multiply');
    halftone(c, C, cell, 15 * Math.PI / 180, '#00aeef', 0.9, 'multiply');
    halftone(c, M, cell, 75 * Math.PI / 180, '#ec008c', 0.88, 'multiply');
    halftone(c, Kk, cell, 45 * Math.PI / 180, '#1a1a1a', 0.95, 'multiply');
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.7, sc), '#141216', 0.9);
    return c;
  }

  function ballpoint(P, p, sc) {
    var w = P.w, h = P.h, L = blur(lumOf(kuwahara(P, Math.round(2 * sc))), w, h, sc), r = rng(23);
    var c = canvasOf(w, h), x = ctx2d(c);
    x.fillStyle = '#fbfaf5';
    x.fillRect(0, 0, w, h);
    /* שורות של מחברת */
    x.strokeStyle = 'rgba(80,140,210,0.18)';
    x.lineWidth = Math.max(1, sc);
    for (var ly = 30 * sc; ly < h; ly += 30 * sc) { x.beginPath(); x.moveTo(0, ly); x.lineTo(w, ly); x.stroke(); }
    x.strokeStyle = 'rgba(25,45,140,0.55)';
    x.lineCap = 'round';
    var step = Math.max(2, p.dots * 0.5 * sc);
    [[0.78, -0.8], [0.55, 0.75], [0.36, -0.1], [0.2, 1.4]].forEach(function (pass) {
      for (var yy = 0; yy < h; yy += step) for (var xx = 0; xx < w; xx += step) {
        var px = xx + (r() - 0.5) * step, py = yy + (r() - 0.5) * step, j = Math.min(h - 1, py | 0) * w + Math.min(w - 1, Math.max(0, px | 0));
        if (L[j] > pass[0] || r() > 0.85) continue;
        var len = step * (2 + r() * 2), a = pass[1] + (r() - 0.5) * 0.25;
        x.lineWidth = Math.max(0.6, sc * (0.6 + r() * 0.5));
        x.beginPath();
        x.moveTo(px - Math.cos(a) * len / 2, py - Math.sin(a) * len / 2);
        x.lineTo(px + Math.cos(a) * len / 2, py + Math.sin(a) * len / 2);
        x.stroke();
      }
    });
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines, sc), '#1b2a8a', 0.85);
    return c;
  }

  function charcoal(P, p, sc) {
    var w = P.w, h = P.h, L = lumOf(P), sm = blur(L, w, h, 3 * sc), n = fbm(w, h, 88, 6 * sc), tex = paperTex(w, h, 3), tx = p.texture / 100;
    var ink = inkLines(L, w, h, p.lines, sc * 1.3);
    var c = grayCanvas(w, h, function (j) {
      var v = Math.pow(sm[j], 1.25) + (n[j] - 0.5) * 0.18;
      v = Math.min(1, v) * (1 - ink[j] * 0.7);
      if (tex[j] > 0.5 * (1 - tx) + 0.25 && v < 0.75) v += 0.12 * tx;
      v = clamp01(v);
      return [v * 236 + 12, v * 232 + 12, v * 222 + 14];
    });
    return c;
  }

  /* ---------- רישום ---------- */

  var S = [
    { id: 'oil', name: 'ציור שמן', group: 'ציור', desc: 'משיכות מכחול אמיתיות לאורך הצורות, וצבע עבה עם תבליט.', knobs: ['brush', 'texture', 'sat', 'contrast'], def: { brush: 8, texture: 60, sat: 115, contrast: 8 }, fn: function (P, p, sc) { return oil(P, p, sc); } },
    { id: 'knife', name: 'סכין ציור', group: 'ציור', desc: 'גושי צבע רחבים ושטוחים, כמו ציור בסכין פלטה.', knobs: ['brush', 'texture', 'sat'], def: { brush: 10, texture: 80, sat: 125 }, fn: function (P, p, sc) { return oil(P, p, sc, { knife: true }); } },
    { id: 'gouache', name: 'גואש', group: 'ציור', desc: 'צבע אטום ומט במשטחים רכים, כמו איור ספר ילדים.', knobs: ['levels', 'sat', 'texture', 'lines'], def: { levels: 5, sat: 115, lines: 40 }, fn: gouache },
    { id: 'pastel', name: 'גיר פסטל', group: 'ציור', desc: 'משיכות גיר באלכסון על נייר כהה, עם גרעין.', knobs: ['brush', 'texture', 'sat'], def: { brush: 7, texture: 60, sat: 120 }, fn: pastel },
    { id: 'pointillism', name: 'פואנטיליזם', group: 'ציור', desc: 'אלפי נקודות צבע טהור שמתערבבות בעין.', knobs: ['dots', 'sat'], def: { dots: 7, sat: 120 }, fn: pointillism },
    { id: 'charcoal', name: 'פחם', group: 'ציור', desc: 'פחם מרוח על נייר מחוספס.', knobs: ['lines', 'texture', 'contrast'], def: { lines: 55, texture: 60, contrast: 15 }, fn: charcoal },
    { id: 'sumie', name: 'דיו יפני', group: 'ציור', desc: 'שטיפות דיו על נייר אורז, עם חותמת אדומה.', knobs: ['lines', 'contrast'], def: { lines: 65, contrast: 15 }, fn: sumie },
    { id: 'stainedglass', name: 'ויטראז׳', group: 'ציור', desc: 'זכוכית צבעונית בתאים, עם פסי עופרת.', knobs: ['dots', 'sat'], def: { dots: 8, sat: 120 }, fn: stainedGlass },
    { id: 'mosaic', name: 'פסיפס', group: 'ציור', desc: 'אבני פסיפס קטנות עם רובה ביניהן.', knobs: ['dots', 'sat'], def: { dots: 9, sat: 115 }, fn: mosaic },
    { id: 'graffiti', name: 'גרפיטי על קיר', group: 'גרפיטי', desc: 'ספריי צבעוני על קיר לבנים, קו מתאר כפול וטפטופים.', knobs: ['levels', 'sat', 'drips', 'texture', 'lines'], def: { levels: 5, sat: 125, drips: 45, texture: 60, lines: 60 }, fn: function (P, p, sc) { return sprayWall(P, p, sc, false); } },
    { id: 'stencil', name: 'סטנסיל רחוב', group: 'גרפיטי', desc: 'שבלונה בשלושה גוונים על בטון, עם ריסוס וטפטופים.', knobs: ['bright', 'drips', 'contrast'], def: { drips: 50, contrast: 15 }, fn: stencil },
    { id: 'neongraffiti', name: 'גרפיטי ניאון', group: 'גרפיטי', desc: 'צבעים זוהרים על קיר בלילה.', knobs: ['levels', 'drips', 'lines'], def: { levels: 5, drips: 40, lines: 55 }, fn: function (P, p, sc) { return sprayWall(P, p, sc, true); } },
    { id: 'mangaaction', name: 'מנגה אקשן', group: 'מנגה ואנימה', desc: 'מנגה עם קווי פעולה סביב הדמות. לוחצים כדי לקבוע את המרכז.', center: true, knobs: ['amount', 'lines', 'dots'], def: { amount: 55, dots: 5, contrast: 15, cx: 0.5, cy: 0.42 }, fn: mangaAction },
    { id: 'shoujo', name: 'שוג׳ו', group: 'מנגה ואנימה', desc: 'פסטל רך, זוהר ונצנוצים.', knobs: ['amount', 'sat', 'lines'], def: { amount: 50, sat: 100, lines: 45 }, fn: shoujo },
    { id: 'cmyk', name: 'הדפס CMYK', group: 'קומיקס', desc: 'ארבע רשתות צבע בזוויות, כמו דפוס קומיקס אמיתי.', knobs: ['dots', 'sat', 'lines'], def: { dots: 7, sat: 125, lines: 45 }, fn: cmyk },
    { id: 'ballpoint', name: 'עט כדורי', group: 'קומיקס', desc: 'שרבוט בעט כחול על דף מחברת.', knobs: ['dots', 'lines'], def: { dots: 6, lines: 50 }, fn: ballpoint }
  ];

  /* לפני הפילטרים הישנים, באותו סדר */
  S.slice().reverse().forEach(function (s) {
    var fn = s.fn;
    delete s.fn;
    FX.register(s, true, fn);
  });
})();
