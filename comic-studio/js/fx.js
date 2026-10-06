/* מנוע הסגנונות: הופך צילום לקומיקס, מנגה, פופ-ארט, קריקטורה ועוד.
   הכול רץ בדפדפן על canvas, והתמונה לא נשלחת לשום מקום. */
(function () {
  'use strict';

  var DEFAULTS = {
    lines: 60, levels: 5, dots: 6, sat: 120, smooth: 3,
    bright: 0, contrast: 10, warp: 55, cx: 0.5, cy: 0.36, rad: 0.42
  };

  /* כל סגנון: שם, משפחה, תיאור קצר, אילו מחוונים רלוונטיים ועקיפת ברירות מחדל */
  var STYLES = [
    { id: 'original', name: 'מקורי', group: 'בסיס', desc: 'הצילום כמו שהוא, רק עם בהירות וניגודיות.', knobs: ['bright', 'contrast', 'sat'], def: { sat: 100, contrast: 0 } },
    { id: 'classic', name: 'קומיקס קלאסי', group: 'קומיקס', desc: 'קווי דיו, צבעים שטוחים ונקודות הדפסה בצללים.', knobs: ['lines', 'levels', 'dots', 'sat', 'smooth'] },
    { id: 'graphic', name: 'גרפיק נובל', group: 'קומיקס', desc: 'צבעים עמומים, שחורים עמוקים ותאורה דרמטית.', knobs: ['lines', 'levels', 'sat', 'smooth'], def: { sat: 60, lines: 70, levels: 6, contrast: 25 } },
    { id: 'vintage', name: 'קומיקס וינטג׳', group: 'קומיקס', desc: 'נייר מצהיב, הדפסה מוזזת ונקודות צבע של שנות ה-50.', knobs: ['lines', 'levels', 'dots', 'sat'], def: { sat: 85, dots: 5 } },
    { id: 'manga', name: 'מנגה', group: 'קומיקס', desc: 'שחור-לבן עם רשתות גוון יפניות.', knobs: ['lines', 'dots', 'smooth', 'contrast'], def: { dots: 5, contrast: 15 } },
    { id: 'noir', name: 'נואר', group: 'קומיקס', desc: 'שחור ולבן חדים, רק האדום נשאר.', knobs: ['lines', 'contrast', 'smooth', 'sat'], def: { contrast: 30, sat: 140 } },
    { id: 'caricature', name: 'קריקטורה', group: 'קריקטורה', desc: 'ראש מוגדל וקווים עבים. לוחצים על הפנים כדי למרכז.', knobs: ['warp', 'rad', 'lines', 'levels', 'sat'], def: { lines: 72, sat: 135, levels: 6 } },
    { id: 'bighead', name: 'בובת ראש', group: 'קריקטורה', desc: 'הגזמה קיצונית של הפנים, בסגנון אנימציה.', knobs: ['warp', 'rad', 'lines', 'sat'], def: { warp: 85, rad: 0.36, lines: 55, sat: 140 } },
    { id: 'cel', name: 'אנימציה', group: 'קריקטורה', desc: 'צביעה חלקה בשכבות, כמו פריים מסרט מצויר.', knobs: ['lines', 'levels', 'sat', 'smooth'], def: { levels: 4, sat: 135, lines: 45, smooth: 4 } },
    { id: 'popart', name: 'פופ-ארט', group: 'פופ', desc: 'צהוב, אדום וכחול עם נקודות בן-דיי.', knobs: ['lines', 'dots', 'contrast'], def: { dots: 7, lines: 70 } },
    { id: 'warhol', name: 'ארבעה צבעים', group: 'פופ', desc: 'ארבעה עותקים בפלטות שונות, כמו פוסטר משי.', knobs: ['levels', 'contrast', 'smooth'], def: { levels: 4, contrast: 20 } },
    { id: 'riso', name: 'ריזוגרף', group: 'פופ', desc: 'שני צבעי דיו, גרעין והזזת הדפסה.', knobs: ['contrast', 'dots', 'bright'], def: { dots: 4 } },
    { id: 'neon', name: 'ניאון', group: 'פופ', desc: 'קווי אור זוהרים על רקע לילה.', knobs: ['lines', 'sat', 'smooth'], def: { lines: 65, sat: 160 } },
    { id: 'pencil', name: 'רישום עיפרון', group: 'יד', desc: 'עיפרון רך על נייר שרטוט.', knobs: ['lines', 'contrast', 'bright'], def: { contrast: 0 } },
    { id: 'colorsketch', name: 'סקיצה צבעונית', group: 'יד', desc: 'קווי עיפרון עם שטיפת צבע עדינה.', knobs: ['lines', 'sat', 'smooth'], def: { sat: 95 } },
    { id: 'ink', name: 'עט ודיו', group: 'יד', desc: 'קווקווים צולבים בעט, כמו באיור עיתון.', knobs: ['lines', 'dots', 'contrast'], def: { dots: 5, contrast: 15 } },
    { id: 'watercolor', name: 'צבעי מים', group: 'יד', desc: 'כתמי צבע רכים, שוליים כהים ונייר מחוספס.', knobs: ['sat', 'smooth', 'lines'], def: { smooth: 4, lines: 30, sat: 110 } },
    { id: 'linocut', name: 'חיתוך לינו', group: 'יד', desc: 'הדפס חיתוך בצבע אחד עם סימני מפסלת.', knobs: ['contrast', 'dots', 'bright'], def: { dots: 6, contrast: 20 } },
    { id: 'pixel', name: 'פיקסל-ארט', group: 'דיגיטלי', desc: 'פיקסלים גדולים ופלטה מוגבלת, כמו משחק ישן.', knobs: ['dots', 'levels', 'sat'], def: { dots: 9, levels: 4, sat: 125 } },
    { id: 'blueprint', name: 'שרטוט', group: 'דיגיטלי', desc: 'קווים לבנים על נייר שרטוט כחול.', knobs: ['lines', 'smooth'], def: { lines: 55 } }
  ];

  var BY_ID = {};
  STYLES.forEach(function (s) { BY_ID[s.id] = s; });

  var KNOBS = {
    lines: { label: 'עובי קווים', min: 0, max: 100, step: 1 },
    levels: { label: 'שכבות צבע', min: 2, max: 10, step: 1 },
    dots: { label: 'גודל נקודות', min: 2, max: 16, step: 1 },
    sat: { label: 'רוויה', min: 0, max: 200, step: 1 },
    smooth: { label: 'החלקה', min: 0, max: 6, step: 1 },
    bright: { label: 'בהירות', min: -50, max: 50, step: 1 },
    contrast: { label: 'ניגודיות', min: -40, max: 60, step: 1 },
    warp: { label: 'הגזמה', min: 0, max: 100, step: 1 },
    rad: { label: 'גודל אזור', min: 0.15, max: 0.7, step: 0.01 }
  };

  function paramsFor(styleId, p) {
    var st = BY_ID[styleId] || BY_ID.classic;
    var out = {};
    var k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    if (st.def) for (k in st.def) out[k] = st.def[k];
    if (p) for (k in p) if (p[k] !== undefined && p[k] !== null) out[k] = p[k];
    return out;
  }

  /* ---------- כלי עזר ---------- */

  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function ctx2d(c) { return c.getContext('2d', { willReadFrequently: true }); }

  function fromSource(src, max) {
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var k = Math.min(1, max / Math.max(sw, sh));
    var c = canvasOf(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
    var x = ctx2d(c);
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

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
  function blur(src, w, h, r) {
    r = Math.max(0, Math.round(r));
    if (!r) return src.slice();
    var a = Math.max(1, Math.round(r / 1.7));
    return boxBlur(boxBlur(boxBlur(src, w, h, a), w, h, a), w, h, a);
  }

  function dilate(src, w, h, r) {
    if (r < 1) return src;
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), x, y, k, m;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0;
      for (k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w && src[y * w + xx] > m) m = src[y * w + xx]; }
      tmp[y * w + x] = m;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0;
      for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x] > m) m = tmp[yy * w + x]; }
      out[y * w + x] = m;
    }
    return out;
  }

  /* תמונה כמערכים נפרדים (0..1) */
  function planes(c) {
    var w = c.width, h = c.height, d = ctx2d(c).getImageData(0, 0, w, h).data;
    var n = w * h, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
    for (var i = 0, j = 0; j < n; i += 4, j++) { R[j] = d[i] / 255; G[j] = d[i + 1] / 255; B[j] = d[i + 2] / 255; }
    return { w: w, h: h, R: R, G: G, B: B };
  }
  function lumOf(P) {
    var n = P.w * P.h, L = new Float32Array(n);
    for (var j = 0; j < n; j++) L[j] = 0.299 * P.R[j] + 0.587 * P.G[j] + 0.114 * P.B[j];
    return L;
  }
  function toCanvas(P) {
    var c = canvasOf(P.w, P.h), x = ctx2d(c), im = x.createImageData(P.w, P.h), d = im.data, n = P.w * P.h;
    for (var i = 0, j = 0; j < n; i += 4, j++) {
      d[i] = clamp255(P.R[j] * 255); d[i + 1] = clamp255(P.G[j] * 255); d[i + 2] = clamp255(P.B[j] * 255); d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  function grayCanvas(w, h, fn) {
    var c = canvasOf(w, h), x = ctx2d(c), im = x.createImageData(w, h), d = im.data, n = w * h;
    for (var i = 0, j = 0; j < n; i += 4, j++) {
      var rgb = fn(j);
      d[i] = clamp255(rgb[0]); d[i + 1] = clamp255(rgb[1]); d[i + 2] = clamp255(rgb[2]); d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  function rgb2hsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-6) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [r + m, g + m, b + m];
  }
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }

  /* בהירות וניגודיות לכל הסגנונות */
  function tone(P, p) {
    var b = p.bright / 100, c = 1 + p.contrast / 60, n = P.w * P.h;
    if (!b && c === 1) return;
    [P.R, P.G, P.B].forEach(function (A) { for (var j = 0; j < n; j++) A[j] = clamp01((A[j] - 0.5) * c + 0.5 + b); });
  }

  /* מסנן קווהרה מהיר בעזרת טבלאות סכומים: מחליק משטחים ושומר קצוות */
  function kuwahara(P, r) {
    if (r < 1) return P;
    var w = P.w, h = P.h, W = w + 1, L = lumOf(P);
    var sR = new Float64Array(W * (h + 1)), sG = new Float64Array(W * (h + 1)), sB = new Float64Array(W * (h + 1));
    var sL = new Float64Array(W * (h + 1)), sQ = new Float64Array(W * (h + 1));
    var x, y;
    for (y = 1; y <= h; y++) {
      var aR = 0, aG = 0, aB = 0, aL = 0, aQ = 0;
      for (x = 1; x <= w; x++) {
        var j = (y - 1) * w + (x - 1);
        aR += P.R[j]; aG += P.G[j]; aB += P.B[j]; aL += L[j]; aQ += L[j] * L[j];
        var k = y * W + x, u = (y - 1) * W + x;
        sR[k] = sR[u] + aR; sG[k] = sG[u] + aG; sB[k] = sB[u] + aB; sL[k] = sL[u] + aL; sQ[k] = sQ[u] + aQ;
      }
    }
    function sum(S, x0, y0, x1, y1) { return S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]; }
    var oR = new Float32Array(w * h), oG = new Float32Array(w * h), oB = new Float32Array(w * h);
    var qs = [[-r, -r, 0, 0], [0, -r, r, 0], [-r, 0, 0, r], [0, 0, r, r]];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var best = 1e9, bi = 0, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
      for (var q = 0; q < 4; q++) {
        var x0 = Math.max(0, x + qs[q][0]), y0 = Math.max(0, y + qs[q][1]);
        var x1 = Math.min(w, x + qs[q][2] + 1), y1 = Math.min(h, y + qs[q][3] + 1);
        var n = (x1 - x0) * (y1 - y0);
        var m = sum(sL, x0, y0, x1, y1) / n, v = sum(sQ, x0, y0, x1, y1) / n - m * m;
        if (v < best) { best = v; bi = q; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
      }
      var nn = (bx1 - bx0) * (by1 - by0), o = y * w + x;
      oR[o] = sum(sR, bx0, by0, bx1, by1) / nn; oG[o] = sum(sG, bx0, by0, bx1, by1) / nn; oB[o] = sum(sB, bx0, by0, bx1, by1) / nn;
    }
    return { w: w, h: h, R: oR, G: oG, B: oB };
  }

  /* קווי דיו: הפרש גאוסיאנים (קווים כהים) ועוד קצוות סובל על המשטחים */
  function inkLines(L, w, h, strength, scale) {
    if (strength <= 0) return new Float32Array(w * h);
    var s = Math.max(1, scale);
    var b1 = blur(L, w, h, 1 * s), b2 = blur(L, w, h, 2.6 * s);
    var t = 0.1 - strength * 0.00075;
    var ink = new Float32Array(w * h), j;
    for (j = 0; j < ink.length; j++) ink[j] = smoothstep(t, t + 0.04, b2[j] - b1[j]);
    var sm = blur(L, w, h, 1.2 * s), x, y;
    var et = 0.95 - strength * 0.0065;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      j = y * w + x;
      var gx = sm[j + 1 - w] + 2 * sm[j + 1] + sm[j + 1 + w] - sm[j - 1 - w] - 2 * sm[j - 1] - sm[j - 1 + w];
      var gy = sm[j + w - 1] + 2 * sm[j + w] + sm[j + w + 1] - sm[j - w - 1] - 2 * sm[j - w] - sm[j - w + 1];
      var e = smoothstep(et, et + 0.3, Math.sqrt(gx * gx + gy * gy)) * 0.9;
      if (e > ink[j]) ink[j] = e;
    }
    var thick = Math.round((strength / 100) * 1.4 * s - 0.6);
    if (thick > 0) ink = blur(dilate(ink, w, h, thick), w, h, 1);
    return ink;
  }

  function multiplyInk(c, ink, color, alpha) {
    var x = ctx2d(c), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    var col = hex(color || '#111014');
    for (var i = 0, j = 0; j < ink.length; i += 4, j++) {
      var a = ink[j] * (alpha == null ? 1 : alpha);
      if (a <= 0) continue;
      d[i] = d[i] * (1 - a) + col[0] * 255 * a;
      d[i + 1] = d[i + 1] * (1 - a) + col[1] * 255 * a;
      d[i + 2] = d[i + 2] * (1 - a) + col[2] * 255 * a;
    }
    x.putImageData(im, 0, 0);
  }

  /* רשת נקודות הדפסה: גודל הנקודה לפי כמות הכהות */
  function halftone(c, amount, cell, angle, color, alpha, mode) {
    var x = ctx2d(c), w = c.width, h = c.height;
    x.save();
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.globalCompositeOperation = mode || 'source-over';
    var ca = Math.cos(angle), sa = Math.sin(angle), R = Math.hypot(w, h);
    x.beginPath();
    for (var v = -R; v < R; v += cell) {
      for (var u = -R; u < R; u += cell) {
        var px = w / 2 + u * ca - v * sa, py = h / 2 + u * sa + v * ca;
        if (px < -cell || py < -cell || px > w + cell || py > h + cell) continue;
        var ix = Math.min(w - 1, Math.max(0, px | 0)), iy = Math.min(h - 1, Math.max(0, py | 0));
        var a = amount[iy * w + ix];
        if (a < 0.04) continue;
        var r = Math.sqrt(a) * cell * 0.62;
        x.moveTo(px + r, py);
        x.arc(px, py, r, 0, Math.PI * 2);
      }
    }
    x.fill();
    x.restore();
  }

  function grain(c, amount, seed) {
    var x = ctx2d(c), im = x.getImageData(0, 0, c.width, c.height), d = im.data, r = rng(seed || 7);
    for (var i = 0; i < d.length; i += 4) {
      var g = (r() - 0.5) * amount * 255;
      d[i] = clamp255(d[i] + g); d[i + 1] = clamp255(d[i + 1] + g); d[i + 2] = clamp255(d[i + 2] + g);
    }
    x.putImageData(im, 0, 0);
  }

  function paperTex(w, h, seed) {
    var r = rng(seed), fine = new Float32Array(w * h), coarse = new Float32Array(w * h);
    for (var i = 0; i < fine.length; i++) { fine[i] = r(); coarse[i] = r(); }
    fine = blur(fine, w, h, 1);
    coarse = blur(coarse, w, h, Math.max(3, Math.round(w / 110)));
    var out = new Float32Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = (fine[i] - 0.5) * 1.4 + (coarse[i] - 0.5) * 3.2;
    return out;
  }

  /* עיוות קריקטורה: הגדלת אזור סביב נקודה */
  function bulge(P, cx, cy, rad, amount) {
    var w = P.w, h = P.h, R = rad * Math.min(w, h) * 1.15, k = 1 + Math.min(100, amount) / 100 * 1.25;
    var ox = cx * w, oy = cy * h;
    var oR = new Float32Array(w * h), oG = new Float32Array(w * h), oB = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = x - ox, dy = y - oy, d = Math.sqrt(dx * dx + dy * dy) / R, sx = x, sy = y;
      if (d < 1 && d > 0) {
        var f = Math.pow(d, k - 1);
        var mix = smoothstep(0.55, 1, d);
        f = f * (1 - mix) + mix;
        sx = ox + dx * f; sy = oy + dy * f;
      }
      var x0 = Math.min(w - 2, Math.max(0, sx | 0)), y0 = Math.min(h - 2, Math.max(0, sy | 0));
      var fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0));
      var a = y0 * w + x0, b = a + 1, c2 = a + w, e = c2 + 1, o = y * w + x;
      oR[o] = (P.R[a] * (1 - fx) + P.R[b] * fx) * (1 - fy) + (P.R[c2] * (1 - fx) + P.R[e] * fx) * fy;
      oG[o] = (P.G[a] * (1 - fx) + P.G[b] * fx) * (1 - fy) + (P.G[c2] * (1 - fx) + P.G[e] * fx) * fy;
      oB[o] = (P.B[a] * (1 - fx) + P.B[b] * fx) * (1 - fy) + (P.B[c2] * (1 - fx) + P.B[e] * fx) * fy;
    }
    return { w: w, h: h, R: oR, G: oG, B: oB };
  }

  /* צביעה בשכבות: מכמת את הבהירות ושומר את הגוון */
  function posterHSV(P, levels, satMul, opt) {
    opt = opt || {};
    var n = P.w * P.h, L = levels - 1;
    for (var j = 0; j < n; j++) {
      var hsv = rgb2hsv(P.R[j], P.G[j], P.B[j]);
      var v = hsv[2];
      if (opt.gamma) v = Math.pow(v, opt.gamma);
      v = Math.round(v * L) / L;
      if (opt.floor !== undefined) v = Math.max(opt.floor, v);
      var s = Math.min(1, hsv[1] * satMul);
      if (opt.satSteps) s = Math.round(s * opt.satSteps) / opt.satSteps;
      var rgb = hsv2rgb(hsv[0], s, v);
      P.R[j] = rgb[0]; P.G[j] = rgb[1]; P.B[j] = rgb[2];
    }
  }

  /* ---------- הסגנונות ---------- */

  var R = {};

  R.original = function (P, p) {
    satAdjust(P, p.sat / 100);
    return toCanvas(P);
  };

  function satAdjust(P, m) {
    if (m === 1) return;
    var n = P.w * P.h;
    for (var j = 0; j < n; j++) {
      var l = 0.299 * P.R[j] + 0.587 * P.G[j] + 0.114 * P.B[j];
      P.R[j] = clamp01(l + (P.R[j] - l) * m); P.G[j] = clamp01(l + (P.G[j] - l) * m); P.B[j] = clamp01(l + (P.B[j] - l) * m);
    }
  }

  function comicBase(P, p, sc, opt) {
    opt = opt || {};
    var L0 = lumOf(P);
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.8));
    if (opt.secondPass) K = kuwahara(K, Math.round(p.smooth * sc * 0.6));
    posterHSV(K, p.levels, p.sat / 100, { gamma: opt.gamma || 0.95, satSteps: opt.satSteps });
    var c = toCanvas(K);
    var LK = lumOf(K);
    if (opt.dots !== false && p.dots > 0) {
      var amt = new Float32Array(LK.length);
      for (var j = 0; j < amt.length; j++) amt[j] = smoothstep(0.5, 0.15, LK[j]) * 0.45;
      halftone(c, amt, p.dots * sc, Math.PI / 4, opt.dotColor || '#141218', opt.dotAlpha || 0.4, 'multiply');
    }
    var ink = inkLines(opt.lineFromSmooth ? LK : L0, P.w, P.h, p.lines, sc * (opt.lineScale || 1));
    multiplyInk(c, ink, opt.inkColor || '#121016', 1);
    return { c: c, L: LK };
  }

  R.classic = function (P, p, sc) { return comicBase(P, p, sc).c; };

  R.cel = function (P, p, sc) {
    return comicBase(P, p, sc, { secondPass: true, dots: false, lineFromSmooth: true, gamma: 0.85 }).c;
  };

  R.caricature = function (P, p, sc) {
    P = bulge(P, p.cx, p.cy, p.rad, p.warp);
    return comicBase(P, p, sc, { secondPass: true, lineScale: 1.25, gamma: 0.9 }).c;
  };

  R.bighead = function (P, p, sc) {
    P = bulge(P, p.cx, p.cy, p.rad, Math.min(100, p.warp * 1.4));
    return comicBase(P, p, sc, { secondPass: true, dots: false, lineFromSmooth: true, gamma: 0.82, satSteps: 4 }).c;
  };

  R.graphic = function (P, p, sc) {
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.8));
    var n = P.w * P.h, j, sh = hex('#16324a'), hi = hex('#f2c48a');
    for (j = 0; j < n; j++) {
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      var v = Math.round(Math.pow(hsv[2], 1.15) * (p.levels - 1)) / (p.levels - 1);
      if (v < 0.24) v *= 0.25;
      var rgb = hsv2rgb(hsv[0], Math.min(1, hsv[1] * p.sat / 100), v);
      var t = v, a = 0.35;
      K.R[j] = rgb[0] * (1 - a) + (sh[0] * (1 - t) + hi[0] * t) * v * a * 1.4;
      K.G[j] = rgb[1] * (1 - a) + (sh[1] * (1 - t) + hi[1] * t) * v * a * 1.4;
      K.B[j] = rgb[2] * (1 - a) + (sh[2] * (1 - t) + hi[2] * t) * v * a * 1.4;
    }
    var c = toCanvas(K);
    multiplyInk(c, inkLines(lumOf(P), P.w, P.h, p.lines, sc * 1.1), '#07080c', 1);
    grain(c, 0.05, 11);
    return c;
  };

  R.vintage = function (P, p, sc) {
    var b = comicBase(P, p, sc, { dotColor: '#c2185b', dotAlpha: 0.4, inkColor: '#1d1a26' });
    var c = b.c, x = ctx2d(c), w = c.width, h = c.height;
    var im = x.getImageData(0, 0, w, h), d = im.data, src = new Uint8ClampedArray(d);
    var off = Math.max(1, Math.round(2 * sc)), paperCol = hex('#f1e2bd'), tex = paperTex(w, h, 21);
    for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
      var i = (y * w + xx) * 4, si = (y * w + Math.min(w - 1, xx + off)) * 4;
      var r = src[si], g = src[i + 1], bl = src[(Math.min(h - 1, y + off) * w + xx) * 4 + 2];
      var t = tex[y * w + xx] * 6;
      d[i] = clamp255(r * paperCol[0] + t); d[i + 1] = clamp255(g * paperCol[1] + t); d[i + 2] = clamp255(bl * paperCol[2] * 0.95 + t);
    }
    x.putImageData(im, 0, 0);
    var amt = new Float32Array(w * h);
    for (var j = 0; j < amt.length; j++) amt[j] = smoothstep(0.85, 0.45, b.L[j]) * 0.35;
    halftone(c, amt, p.dots * sc * 0.8, Math.PI / 12, '#00a0c8', 0.35, 'multiply');
    return c;
  };

  R.manga = function (P, p, sc) {
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.8)), L = lumOf(K), w = P.w, h = P.h;
    var c = grayCanvas(w, h, function (j) { return L[j] < 0.17 ? [18, 18, 20] : [252, 252, 250]; });
    var mid = new Float32Array(w * h), dark = new Float32Array(w * h);
    for (var j = 0; j < L.length; j++) {
      var v = L[j];
      if (v >= 0.17 && v < 0.72) mid[j] = v < 0.42 ? 0.55 : 0.22;
      if (v >= 0.17 && v < 0.32) dark[j] = 0.35;
    }
    halftone(c, mid, p.dots * sc * 0.75, Math.PI / 4, '#141416', 1);
    halftone(c, dark, p.dots * sc * 0.75, -Math.PI / 4, '#141416', 1);
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines, sc), '#0e0e10', 1);
    return c;
  };

  R.noir = function (P, p, sc) {
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.7)), w = P.w, h = P.h, L = lumOf(K), j;
    var red = new Float32Array(w * h);
    for (j = 0; j < L.length; j++) {
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      var hueRed = hsv[0] < 18 || hsv[0] > 335;
      red[j] = hueRed ? smoothstep(0.35, 0.6, hsv[1] * p.sat / 100) * smoothstep(0.15, 0.3, hsv[2]) : 0;
    }
    var c = grayCanvas(w, h, function (j) {
      var v = smoothstep(0.36, 0.5, L[j]) * 0.94 + 0.04;
      var g = v * 255, rr = red[j];
      return [g * (1 - rr) + 205 * rr, g * (1 - rr) + 22 * rr, g * (1 - rr) + 30 * rr];
    });
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines, sc), '#000', 0.9);
    grain(c, 0.08, 3);
    return c;
  };

  R.popart = function (P, p, sc) {
    var K = kuwahara(P, Math.round(3 * sc)), w = P.w, h = P.h, n = w * h, j;
    var Y = hex('#ffd800'), RD = hex('#e3222b'), BL = hex('#1c5bc4'), WH = [1, 0.99, 0.96], BK = [0.07, 0.07, 0.09];
    var pink = new Float32Array(n), blueDots = new Float32Array(n);
    var O = { w: w, h: h, R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n) };
    for (j = 0; j < n; j++) {
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]), hh = hsv[0], s = hsv[1], v = hsv[2], col;
      if (v < 0.2) col = BK;
      else if (s < 0.2) { col = WH; if (v < 0.62) blueDots[j] = 0.5; }
      else if ((hh < 45 || hh > 340) && s < 0.62 && v > 0.45) { col = WH; pink[j] = 0.6; }
      else if (hh >= 30 && hh < 75) col = Y;
      else if (hh >= 75 && hh < 165) col = v > 0.55 ? Y : BL;
      else if (hh >= 165 && hh < 290) col = BL;
      else col = RD;
      O.R[j] = col[0]; O.G[j] = col[1]; O.B[j] = col[2];
    }
    var c = toCanvas(O);
    halftone(c, pink, p.dots * sc, Math.PI / 4, '#e3222b', 0.9);
    halftone(c, blueDots, p.dots * sc, Math.PI / 4, '#1c5bc4', 0.75);
    multiplyInk(c, inkLines(lumOf(P), w, h, Math.max(p.lines, 40), sc * 1.3), '#0b0b0e', 1);
    return c;
  };

  R.warhol = function (P, p, sc) {
    var w = P.w, h = P.h, hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    var small = canvasOf(hw, hh);
    ctx2d(small).drawImage(toCanvas(P), 0, 0, hw, hh);
    var S = kuwahara(planes(small), Math.round(p.smooth * sc * 0.5)), L = lumOf(S);
    var sets = [
      ['#1b1464', '#ff2e88', '#ffd400', '#fffbe6'],
      ['#0a3d2e', '#ff6a00', '#3ee6c0', '#fff3f0'],
      ['#2b0040', '#00c2ff', '#ff4d6d', '#f6ff9e'],
      ['#3a1500', '#9b5de5', '#f15bb5', '#fee440']
    ];
    var out = canvasOf(hw * 2, hh * 2), ox = ctx2d(out);
    var lv = Math.min(4, Math.max(2, p.levels));
    sets.forEach(function (set, k) {
      var cols = set.map(hex);
      var tile = grayCanvas(hw, hh, function (j) {
        var i = Math.min(lv - 1, Math.floor(L[j] * lv));
        var col = cols[Math.round(i * 3 / (lv - 1))];
        return [col[0] * 255, col[1] * 255, col[2] * 255];
      });
      ox.drawImage(tile, (k % 2) * hw, Math.floor(k / 2) * hh);
    });
    return out;
  };

  /* פיזור לפי מטריצת באייר, להדפסת ריזו */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  R.riso = function (P, p, sc) {
    var w = P.w, h = P.h, L = blur(lumOf(P), w, h, sc), r = rng(5);
    var c = canvasOf(w, h), x = ctx2d(c), im = x.createImageData(w, h), d = im.data;
    var paper = hex('#f6f1e6'), A = hex('#ff48b0'), B = hex('#0078bf');
    var off = Math.max(2, Math.round(3 * sc)), cell = Math.max(1, Math.round(p.dots / 4 * sc));
    for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
      var j = y * w + xx, i = j * 4;
      var t = (BAYER[((Math.floor(y / cell) & 3) << 2) | (Math.floor(xx / cell) & 3)] + 0.5) / 16;
      var jb = Math.min(h - 1, y + off) * w + Math.min(w - 1, xx + off);
      var inkB = (1 - L[j]) * 1.05 + (r() - 0.5) * 0.18 > t + 0.12 ? 1 : 0;
      var inkA = smoothstep(0.85, 0.35, L[jb]) + (r() - 0.5) * 0.2 > t ? 1 : 0;
      var cr = paper[0], cg = paper[1], cb = paper[2];
      if (inkA) { cr *= A[0]; cg *= A[1]; cb *= A[2]; }
      if (inkB) { cr *= B[0] * 1.05; cg *= B[1] * 1.05; cb *= B[2] * 1.05; }
      d[i] = cr * 255; d[i + 1] = cg * 255; d[i + 2] = cb * 255; d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  };

  R.neon = function (P, p, sc) {
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.8)), w = P.w, h = P.h;
    var ink = inkLines(lumOf(K), w, h, p.lines, sc);
    var n = w * h, eR = new Float32Array(n), eG = new Float32Array(n), eB = new Float32Array(n), j;
    for (j = 0; j < n; j++) {
      if (ink[j] <= 0) continue;
      var hsv = rgb2hsv(K.R[j], K.G[j], K.B[j]);
      var hue = hsv[1] < 0.12 ? 190 : hsv[0];
      var rgb = hsv2rgb(hue, Math.min(1, 0.55 * p.sat / 100 + 0.25), 1);
      eR[j] = rgb[0] * ink[j] * 0.8; eG[j] = rgb[1] * ink[j] * 0.8; eB[j] = rgb[2] * ink[j] * 0.8;
    }
    var gr = 5 * sc, gR = blur(eR, w, h, gr), gG = blur(eG, w, h, gr), gB = blur(eB, w, h, gr);
    var L = lumOf(K), bg = hex('#0b0a1c');
    var O = { w: w, h: h, R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n) };
    for (j = 0; j < n; j++) {
      var base = L[j] * 0.12;
      O.R[j] = bg[0] + base * 0.6 + eR[j] + gR[j] * 1.1;
      O.G[j] = bg[1] + base * 0.5 + eG[j] + gG[j] * 1.1;
      O.B[j] = bg[2] + base + eB[j] + gB[j] * 1.1;
    }
    return toCanvas(O);
  };

  function pencilGray(P, p, sc) {
    var w = P.w, h = P.h, L = lumOf(P), n = w * h, inv = new Float32Array(n), j;
    for (j = 0; j < n; j++) inv[j] = 1 - L[j];
    var b = blur(inv, w, h, 6 * sc), out = new Float32Array(n);
    for (j = 0; j < n; j++) out[j] = Math.min(1, L[j] / Math.max(0.02, 1 - b[j]));
    var ink = inkLines(L, w, h, p.lines * 0.7, sc);
    var tex = paperTex(w, h, 9);
    for (j = 0; j < n; j++) {
      var v = Math.pow(out[j], 1.6) * (1 - ink[j] * 0.55);
      out[j] = clamp01(v + tex[j] * 0.03);
    }
    return out;
  }

  R.pencil = function (P, p, sc) {
    var g = pencilGray(P, p, sc);
    return grayCanvas(P.w, P.h, function (j) { var v = g[j]; return [v * 248 + 4, v * 246 + 4, v * 240 + 6]; });
  };

  R.colorsketch = function (P, p, sc) {
    var g = pencilGray(P, p, sc), K = kuwahara(P, Math.round(p.smooth * sc * 0.8));
    satAdjust(K, p.sat / 100 * 0.85);
    var Kb = { R: blur(K.R, P.w, P.h, 2 * sc), G: blur(K.G, P.w, P.h, 2 * sc), B: blur(K.B, P.w, P.h, 2 * sc) };
    return grayCanvas(P.w, P.h, function (j) {
      var a = 0.55, v = g[j];
      return [(Kb.R[j] * a + (1 - a)) * v * 255, (Kb.G[j] * a + (1 - a)) * v * 255, (Kb.B[j] * a + (1 - a)) * v * 255];
    });
  };

  R.ink = function (P, p, sc) {
    var w = P.w, h = P.h, L = blur(lumOf(kuwahara(P, Math.round(2 * sc))), w, h, sc), r = rng(17);
    var per = Math.max(3, Math.round(p.dots * sc * 0.9)), lw = Math.max(1, per * 0.28);
    var paper = hex('#f8f4ea'), ink = hex('#1a1c2b');
    var wob = blur((function () { var a = new Float32Array(w * h); for (var i = 0; i < a.length; i++) a[i] = r(); return a; })(), w, h, 4 * sc);
    var c = grayCanvas(w, h, function (j) {
      var x = j % w, y = (j / w) | 0, v = L[j], o = (wob[j] - 0.5) * per * 3, a = 0;
      if (v < 0.7 && ((x + y + o) % per + per) % per < lw) a = 1;
      if (v < 0.45 && ((x - y + o) % per + per) % per < lw) a = 1;
      if (v < 0.25 && ((y + o * 0.5) % per + per) % per < lw) a = 1;
      if (v < 0.07) a = 1;
      return [(paper[0] * (1 - a) + ink[0] * a) * 255, (paper[1] * (1 - a) + ink[1] * a) * 255, (paper[2] * (1 - a) + ink[2] * a) * 255];
    });
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.8, sc), '#1a1c2b', 1);
    return c;
  };

  R.watercolor = function (P, p, sc) {
    var w = P.w, h = P.h, n = w * h, j;
    var K = kuwahara(kuwahara(P, Math.round(p.smooth * sc)), Math.round(p.smooth * sc * 0.7));
    satAdjust(K, p.sat / 100);
    var r = rng(31), nx = new Float32Array(n), ny = new Float32Array(n);
    for (j = 0; j < n; j++) { nx[j] = r(); ny[j] = r(); }
    nx = blur(nx, w, h, 6 * sc); ny = blur(ny, w, h, 6 * sc);
    var amp = 40 * sc;
    var O = { w: w, h: h, R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n) };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      j = y * w + x;
      var sx = Math.min(w - 1, Math.max(0, Math.round(x + (nx[j] - 0.5) * amp))), sy = Math.min(h - 1, Math.max(0, Math.round(y + (ny[j] - 0.5) * amp)));
      var s = sy * w + sx;
      O.R[j] = K.R[s]; O.G[j] = K.G[s]; O.B[j] = K.B[s];
    }
    var L = lumOf(O), bl = blur(L, w, h, 3 * sc), tex = paperTex(w, h, 13);
    for (j = 0; j < n; j++) {
      var edge = Math.max(0, bl[j] - L[j]) * 2.2;
      var wash = 0.78;
      var t = tex[j] * 0.035;
      O.R[j] = clamp01((O.R[j] * wash + (1 - wash)) * (1 - edge) + t);
      O.G[j] = clamp01((O.G[j] * wash + (1 - wash)) * (1 - edge) + t);
      O.B[j] = clamp01((O.B[j] * wash + (1 - wash)) * (1 - edge) + t);
    }
    var c = toCanvas(O);
    multiplyInk(c, inkLines(lumOf(P), w, h, p.lines * 0.6, sc), '#3b3040', 0.45);
    return c;
  };

  R.linocut = function (P, p, sc) {
    var w = P.w, h = P.h, L = blur(lumOf(P), w, h, 1.5 * sc), r = rng(41), n = w * h, j;
    var nz = new Float32Array(n);
    for (j = 0; j < n; j++) nz[j] = r();
    nz = blur(nz, w, h, 8 * sc);
    var per = Math.max(4, p.dots * sc), paper = hex('#f3ecdf'), inkc = hex('#1b1a22'), red = hex('#c8352e');
    var c = grayCanvas(w, h, function (j) {
      var x = j % w, y = (j / w) | 0;
      var wave = Math.sin((y + (nz[j] - 0.5) * per * 6 + Math.sin(x / (per * 5)) * per * 0.6) / per * Math.PI * 2);
      var thr = 0.5 + wave * 0.16;
      var a = L[j] < thr ? 1 : 0;
      var col = L[j] < 0.12 || a ? inkc : (L[j] < 0.66 && wave > 0.55 ? red : paper);
      return [col[0] * 255, col[1] * 255, col[2] * 255];
    });
    grain(c, 0.04, 2);
    return c;
  };

  R.pixel = function (P, p, sc) {
    var w = P.w, h = P.h, b = Math.max(2, Math.round(p.dots * sc * 0.9));
    var cw = Math.ceil(w / b), ch = Math.ceil(h / b);
    var small = canvasOf(cw, ch), sx = ctx2d(small);
    sx.imageSmoothingEnabled = true;
    sx.drawImage(toCanvas(P), 0, 0, cw, ch);
    var S = planes(small);
    satAdjust(S, p.sat / 100);
    var lv = p.levels - 1, n = cw * ch;
    for (var j = 0; j < n; j++) {
      S.R[j] = Math.round(S.R[j] * lv) / lv; S.G[j] = Math.round(S.G[j] * lv) / lv; S.B[j] = Math.round(S.B[j] * lv) / lv;
    }
    var out = canvasOf(w, h), ox = ctx2d(out);
    ox.imageSmoothingEnabled = false;
    ox.drawImage(toCanvas(S), 0, 0, cw * b, ch * b);
    return out;
  };

  R.blueprint = function (P, p, sc) {
    var K = kuwahara(P, Math.round(p.smooth * sc * 0.8)), w = P.w, h = P.h;
    var ink = inkLines(lumOf(K), w, h, p.lines, sc * 0.9), L = lumOf(K), bg = hex('#0f4c8a');
    var c = grayCanvas(w, h, function (j) {
      var a = Math.min(1, ink[j] * 0.95 + (1 - L[j]) * 0.08);
      return [(bg[0] * (1 - a) + 0.93 * a) * 255, (bg[1] * (1 - a) + 0.96 * a) * 255, (bg[2] * (1 - a) + a) * 255];
    });
    var x = ctx2d(c), g = Math.round(24 * sc);
    x.strokeStyle = 'rgba(255,255,255,0.13)';
    x.lineWidth = 1;
    x.beginPath();
    for (var gx = 0.5; gx < w; gx += g) { x.moveTo(gx, 0); x.lineTo(gx, h); }
    for (var gy = 0.5; gy < h; gy += g) { x.moveTo(0, gy); x.lineTo(w, gy); }
    x.stroke();
    return c;
  };

  /* ---------- ממשק ---------- */

  var BASE = 1000;

  /* src: תמונה או canvas. max: הצד הארוך של התוצאה */
  function render(src, styleId, params, max) {
    var st = BY_ID[styleId] ? styleId : 'classic';
    var p = paramsFor(st, params);
    var c = fromSource(src, max || BASE);
    var P = planes(c);
    tone(P, p);
    var sc = Math.max(c.width, c.height) / BASE;
    return R[st](P, p, Math.max(0.35, sc));
  }

  /* מריץ אחרי שהדפדפן הספיק לצייר, כדי שהממשק לא ייתקע */
  function renderAsync(src, styleId, params, max) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { resolve(render(src, styleId, params, max)); } catch (e) { reject(e); }
      }, 16);
    });
  }

  window.ComicFX = {
    STYLES: STYLES, KNOBS: KNOBS, DEFAULTS: DEFAULTS, byId: BY_ID,
    paramsFor: paramsFor, render: render, renderAsync: renderAsync
  };
})();
