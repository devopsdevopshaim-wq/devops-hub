/* הפיכת צילום לציור בעבודת יד: רישום עיפרון, פחם בספיה, צבעי מים וציור שמן.
   הכול רץ בדפדפן, בלי לשלוח את התמונה לשום מקום. */
(function () {
  'use strict';

  var STYLES = {
    pencil: 'רישום עיפרון',
    charcoal: 'פחם בגווני ספיה',
    watercolor: 'צבעי מים',
    oil: 'ציור שמן'
  };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  function canvasFrom(img, max) {
    var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* מחולל אקראי קבוע (כדי שאותה תמונה תקבל אותו מרקם) */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  function boxBlur(src, w, h, r) {
    if (r < 1) return src.slice();
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    var x, y, acc, n = 2 * r + 1;
    for (y = 0; y < h; y++) {
      var row = y * w;
      acc = 0;
      for (x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) {
        tmp[row + x] = acc / n;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (x = 0; x < w; x++) {
      acc = 0;
      for (y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }
  function blur(src, w, h, r) { return boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r); }

  function grayOf(d, w, h) {
    var g = new Float32Array(w * h);
    for (var i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return g;
  }

  /* מרקם נייר: גרעין עדין + סיבים גדולים */
  function paper(w, h, seed) {
    var r = rng(seed);
    var fine = new Float32Array(w * h), coarse = new Float32Array(w * h);
    for (var i = 0; i < fine.length; i++) { fine[i] = r(); coarse[i] = r(); }
    fine = blur(fine, w, h, 1);
    coarse = blur(coarse, w, h, Math.max(3, Math.round(w / 120)));
    var out = new Float32Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = (fine[i] - 0.5) * 1.6 + (coarse[i] - 0.5) * 3.2;
    return out;
  }

  /* משיכות עיפרון באלכסון: רעש שנמרח בכיוון אחד */
  function strokes(w, h, seed, len) {
    var r = rng(seed * 7 + 3);
    var n = new Float32Array(w * h), out = new Float32Array(w * h);
    for (var i = 0; i < n.length; i++) n[i] = r();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var s = 0, c = 0;
        for (var k = -len; k <= len; k++) {
          var xx = x + k, yy = y - k;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += n[yy * w + xx]; c++;
        }
        out[y * w + x] = s / c - 0.5;
      }
    }
    return out;
  }

  /* קווי רישום: טכניקת "color dodge" של אמני רישום דיגיטלי */
  function sketchLines(g, w, h) {
    var inv = new Float32Array(g.length);
    for (var i = 0; i < g.length; i++) inv[i] = 255 - g[i];
    var b = blur(inv, w, h, Math.max(2, Math.round(Math.max(w, h) / 220)));
    var out = new Float32Array(g.length);
    for (i = 0; i < g.length; i++) out[i] = b[i] >= 254 ? 255 : Math.min(255, g[i] * 255 / (255 - b[i]));
    return out;
  }

  function pencil(c, opts) {
    var w = c.width, h = c.height, ctx = c.getContext('2d');
    var im = ctx.getImageData(0, 0, w, h), d = im.data;
    var g = grayOf(d, w, h);
    var lines = sketchLines(g, w, h);
    var tone = blur(g, w, h, Math.max(2, Math.round(w / 90)));
    var st = strokes(w, h, 11, Math.max(3, Math.round(w / 160)));
    var pp = paper(w, h, 5);
    var sepia = opts && opts.sepia;
    var gamma = sepia ? 2.6 : 2.0;
    for (var i = 0, j = 0; j < g.length; i += 4, j++) {
      var v = Math.pow(lines[j] / 255, gamma) * 255;
      // הצללה: משיכות עיפרון באזורים הכהים
      var dark = Math.pow(1 - tone[j] / 255, 1.5);
      v -= dark * (sepia ? 70 : 48) * (0.55 + st[j] * 2.2);
      v += pp[j] * 6;
      v = Math.max(0, Math.min(255, v));
      var t = v / 255;
      if (sepia) {
        d[i] = 58 + (241 - 58) * t; d[i + 1] = 38 + (229 - 38) * t; d[i + 2] = 24 + (204 - 24) * t;
      } else {
        d[i] = 40 + (247 - 40) * t; d[i + 1] = 40 + (243 - 40) * t; d[i + 2] = 44 + (233 - 44) * t;
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  /* מסנן קווהרה: יוצר משטחי צבע כמו משיכות מכחול (מהיר בעזרת טבלאות סכומים) */
  function kuwahara(d, w, h, r) {
    var W = w + 1, N = W * (h + 1);
    var sR = new Float64Array(N), sG = new Float64Array(N), sB = new Float64Array(N), sL = new Float64Array(N), sL2 = new Float64Array(N);
    for (var y = 0; y < h; y++) {
      var aR = 0, aG = 0, aB = 0, aL = 0, aL2 = 0;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        aR += d[i]; aG += d[i + 1]; aB += d[i + 2]; aL += l; aL2 += l * l;
        var k = (y + 1) * W + x + 1, up = y * W + x + 1;
        sR[k] = sR[up] + aR; sG[k] = sG[up] + aG; sB[k] = sB[up] + aB; sL[k] = sL[up] + aL; sL2[k] = sL2[up] + aL2;
      }
    }
    function rect(S, x0, y0, x1, y1) { return S[(y1 + 1) * W + x1 + 1] - S[y0 * W + x1 + 1] - S[(y1 + 1) * W + x0] + S[y0 * W + x0]; }
    var out = new Uint8ClampedArray(d.length);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var best = Infinity, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
        for (var q = 0; q < 4; q++) {
          var x0 = q & 1 ? x : x - r, x1 = q & 1 ? x + r : x;
          var y0 = q & 2 ? y : y - r, y1 = q & 2 ? y + r : y;
          x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
          var n = (x1 - x0 + 1) * (y1 - y0 + 1);
          var m = rect(sL, x0, y0, x1, y1) / n;
          var v = rect(sL2, x0, y0, x1, y1) / n - m * m;
          if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
        }
        var nn = (bx1 - bx0 + 1) * (by1 - by0 + 1), o = (y * w + x) * 4;
        out[o] = rect(sR, bx0, by0, bx1, by1) / nn;
        out[o + 1] = rect(sG, bx0, by0, bx1, by1) / nn;
        out[o + 2] = rect(sB, bx0, by0, bx1, by1) / nn;
        out[o + 3] = 255;
      }
    }
    return out;
  }

  function saturate(r, g, b, k) {
    var l = 0.299 * r + 0.587 * g + 0.114 * b;
    return [l + (r - l) * k, l + (g - l) * k, l + (b - l) * k];
  }

  function watercolor(c) {
    var w = c.width, h = c.height, ctx = c.getContext('2d');
    var im = ctx.getImageData(0, 0, w, h), d = im.data;
    var g0 = grayOf(d, w, h);
    var lines = sketchLines(g0, w, h);
    var washed = kuwahara(d, w, h, Math.max(4, Math.round(Math.max(w, h) / 85)));
    // שטיפות צבע רכות
    var ch = [0, 1, 2].map(function (k) {
      var a = new Float32Array(w * h);
      for (var j = 0; j < a.length; j++) a[j] = washed[j * 4 + k];
      a = blur(a, w, h, 1);
      // שכבות צבע מוגבלות, כמו שטיפות של צייר
      for (var q = 0; q < a.length; q++) { var lv = Math.round(a[q] / 36) * 36; a[q] = a[q] * 0.35 + lv * 0.65; }
      return a;
    });
    var bloom = blur(paper(w, h, 47), w, h, Math.max(6, Math.round(w / 25)));
    var lum = new Float32Array(w * h);
    for (var j = 0; j < lum.length; j++) lum[j] = 0.299 * ch[0][j] + 0.587 * ch[1][j] + 0.114 * ch[2][j];
    var lumB = blur(lum, w, h, 2);
    var pp = paper(w, h, 9);
    var gran = paper(w, h, 21);
    // שוליים לא אחידים, כמו צבע שנעצר על הנייר
    var edgeNoise = blur(paper(w, h, 33), w, h, Math.max(4, Math.round(w / 60)));
    var margin = Math.max(w, h) * 0.035;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        j = y * w + x;
        var i = j * 4;
        var r = ch[0][j], gg = ch[1][j], b = ch[2][j];
        // קצה רטוב: הצבע מתכהה בגבולות בין משטחים
        var edge = Math.min(1, Math.abs(lum[j] - lumB[j]) / 16);
        var s = saturate(r, gg, b, 1.05);
        var k = 1 - edge * 0.38 - gran[j] * 0.07 + bloom[j] * 0.09;
        r = s[0] * k; gg = s[1] * k; b = s[2] * k;
        // שקיפות: הנייר נראה מבעד לצבע
        r = r * 0.74 + 250 * 0.26; gg = gg * 0.74 + 246 * 0.26; b = b * 0.74 + 236 * 0.26;
        // רישום עיפרון עדין מתחת לצבע
        var ln = 0.5 + 0.5 * Math.pow(lines[j] / 255, 2.4);
        r *= ln; gg *= ln; b *= ln;
        // שוליים מרוחים לנייר לבן
        var dEdge = Math.min(x, y, w - 1 - x, h - 1 - y) + edgeNoise[j] * margin * 1.4;
        var fade = Math.max(0, Math.min(1, (dEdge - margin * 0.4) / margin));
        var pr = 250 + pp[j] * 3, pg = 246 + pp[j] * 3, pb = 236 + pp[j] * 3;
        d[i] = pr + (r + pp[j] * 7 - pr) * fade;
        d[i + 1] = pg + (gg + pp[j] * 7 - pg) * fade;
        d[i + 2] = pb + (b + pp[j] * 7 - pb) * fade;
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  function oil(c) {
    var w = c.width, h = c.height, ctx = c.getContext('2d');
    var im = ctx.getImageData(0, 0, w, h), d = im.data;
    var painted = kuwahara(d, w, h, Math.max(4, Math.round(Math.max(w, h) / 110)));
    var st = strokes(w, h, 17, Math.max(3, Math.round(w / 200)));
    var lum = new Float32Array(w * h);
    for (var j = 0; j < lum.length; j++) lum[j] = 0.299 * painted[j * 4] + 0.587 * painted[j * 4 + 1] + 0.114 * painted[j * 4 + 2];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        j = y * w + x;
        var i = j * 4;
        // תאורה של משיכות המכחול (אימפסטו) + מרקם בד קנבס
        var nx = x < w - 1 ? lum[j + 1] - lum[j] : 0, ny = y < h - 1 ? lum[j + w] - lum[j] : 0;
        var relief = (nx + ny) * 0.35 + st[j] * 26;
        var canvasTex = (Math.sin(x * 1.9) * Math.sin(y * 1.9)) * 4;
        var s = saturate(painted[i], painted[i + 1], painted[i + 2], 1.18);
        // גוון חם של לכה ישנה
        d[i] = s[0] * 1.03 + relief + canvasTex + 4;
        d[i + 1] = s[1] * 1.0 + relief + canvasTex + 1;
        d[i + 2] = s[2] * 0.92 + relief + canvasTex - 4;
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  /* מחזיר {src, w, h} של הציור */
  function paint(src, style) {
    var max = style === 'pencil' || style === 'charcoal' ? 1800 : 1300;
    return loadImage(src).then(function (img) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var c = canvasFrom(img, max);
          if (style === 'pencil') pencil(c);
          else if (style === 'charcoal') pencil(c, { sepia: true });
          else if (style === 'watercolor') watercolor(c);
          else oil(c);
          resolve({ src: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height });
        }, 30);
      });
    });
  }

  window.ArtFx = { STYLES: STYLES, paint: paint };
})();
