/* Styles. AI styles (3D animation, anime, superheroes, animals…) send the photo to the hubs server's image model (Gemini,
   then FLUX on Cloudflare) and replace the photo with the answer (the original is kept in p.origSrc and can be brought back).
   The panel is js/ai-studio.js. The pixel styles below are no longer offered; they stay so older projects still render. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var clamp = FS.clamp;

  /* ---------- pixel helpers (work on a copy at most 1400px long) ---------- */
  function lum(px, n) { var L = new Float32Array(n); for (var i = 0; i < n; i++) L[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255; return L; }
  function sobel(L, w, h) {
    var E = new Float32Array(w * h);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var i = y * w + x, gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1], gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
      E[i] = Math.sqrt(gx * gx + gy * gy);
    }
    return E;
  }
  function dilate(M, w, h) { var O = new Float32Array(M); for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var i = y * w + x; O[i] = Math.max(M[i], M[i - 1], M[i + 1], M[i - w], M[i + w]); } return O; }
  /* Kuwahara: each pixel takes the mean colour of its calmest quadrant (painterly, keeps edges); integral images keep it O(n) */
  function kuwahara(px, w, h, r) {
    var W = w + 1, n = W * (h + 1), S = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)], x, y, i, c;
    for (y = 0; y < h; y++) { var rs = [0, 0, 0, 0, 0]; for (x = 0; x < w; x++) { i = (y * w + x) * 4; var l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2], v = [px[i], px[i + 1], px[i + 2], l, l * l];
      for (c = 0; c < 5; c++) { rs[c] += v[c]; S[c][(y + 1) * W + x + 1] = S[c][y * W + x + 1] + rs[c]; } } }
    function box(c, x0, y0, x1, y1) { return S[c][y1 * W + x1] - S[c][y0 * W + x1] - S[c][y1 * W + x0] + S[c][y0 * W + x0]; }
    var out = new Uint8ClampedArray(px.length);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var best = 1e18, br = 0, bg = 0, bb = 0;
      for (var q = 0; q < 4; q++) {
        var x0 = q & 1 ? x : Math.max(0, x - r), x1 = q & 1 ? Math.min(w, x + r + 1) : x + 1, y0 = q & 2 ? y : Math.max(0, y - r), y1 = q & 2 ? Math.min(h, y + r + 1) : y + 1, a = (x1 - x0) * (y1 - y0);
        var m = box(3, x0, y0, x1, y1) / a, vr = box(4, x0, y0, x1, y1) / a - m * m;
        if (vr < best) { best = vr; br = box(0, x0, y0, x1, y1) / a; bg = box(1, x0, y0, x1, y1) / a; bb = box(2, x0, y0, x1, y1) / a; }
      }
      i = (y * w + x) * 4; out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = px[i + 3];
    }
    return out;
  }
  function posterize(px, levels) { var st = 255 / (levels - 1); for (var i = 0; i < px.length; i += 4) for (var c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] / st) * st; }
  function saturate(px, f) { for (var i = 0; i < px.length; i += 4) { var L = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; for (var c = 0; c < 3; c++) px[i + c] = L + (px[i + c] - L) * f; } }
  function ink(px, E, w, h, t, col, thick) { if (thick) E = dilate(E, w, h); col = col || [20, 16, 24]; for (var i = 0; i < w * h; i++) if (E[i] > t) { var k = clamp((E[i] - t) / t, 0, 1); for (var c = 0; c < 3; c++) px[i * 4 + c] = px[i * 4 + c] * (1 - k) + col[c] * k; } }
  function hex(h) { return FS.hexRgb(h); }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* ---------- the instant styles ---------- */
  var S = {
    cartoon: function (px, w, h) { var k = kuwahara(px, w, h, Math.max(2, Math.round(w / 420))); posterize(k, 8); saturate(k, 1.3); ink(k, sobel(lum(kuwahara(px, w, h, 2), w * h), w, h), w, h, 0.42, null, w > 700); return k; },
    comic: function (px, w, h) {
      var k = kuwahara(px, w, h, Math.max(2, Math.round(w / 500))); posterize(k, 5); saturate(k, 1.45);
      var L = lum(k, w * h), cell = Math.max(5, Math.round(w / 140));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x, d = 1 - L[i]; if (d < 0.35) continue; var cx = (Math.floor(x / cell) + 0.5) * cell, cy = (Math.floor(y / cell) + 0.5) * cell, rr = cell * 0.55 * Math.sqrt(d);
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < rr * rr) { k[i * 4] *= 0.55; k[i * 4 + 1] *= 0.55; k[i * 4 + 2] *= 0.6; } }
      ink(k, sobel(lum(kuwahara(px, w, h, 2), w * h), w, h), w, h, 0.38, null, true); return k;
    },
    manga: function (px, w, h) {
      var k = kuwahara(px, w, h, 2), L = lum(k, w * h), E = dilate(sobel(L, w, h), w, h), out = new Uint8ClampedArray(px.length), cell = Math.max(4, Math.round(w / 180));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = y * w + x, l = L[i], v;
        if (l > 0.78) v = 253; else if (l < 0.18) v = 18;
        else { var cx = (Math.floor(x / cell) + 0.5) * cell, cy = (Math.floor((y + (Math.floor(x / cell) % 2) * cell / 2) / cell) + 0.5) * cell, rr = cell * 0.62 * Math.sqrt(1 - (l - 0.18) / 0.6);
          v = (x - cx) * (x - cx) + (y + (Math.floor(x / cell) % 2) * cell / 2 - cy) * (y + (Math.floor(x / cell) % 2) * cell / 2 - cy) < rr * rr ? 30 : 250; }
        if (E[i] > 0.36) v = 12;
        out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v * 0.98; out[i * 4 + 3] = 255;
      }
      return out;
    },
    pop: function (px, w, h) {
      var pal = ['#1b1464', '#e6007e', '#00aeef', '#fff200'].map(hex), L = lum(kuwahara(px, w, h, 2), w * h), out = new Uint8ClampedArray(px.length), cell = Math.max(5, Math.round(w / 120));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x, b = Math.min(3, Math.floor(L[i] * 4)), c = pal[b];
        if (b === 2) { var cx = (Math.floor(x / cell) + 0.5) * cell, cy = (Math.floor(y / cell) + 0.5) * cell; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < cell * cell * 0.12) c = pal[1]; }
        out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; }
      ink(out, sobel(L, w, h), w, h, 0.45, [10, 10, 30], true); return out;
    },
    sketch: function (px, w, h) {
      /* the dark tones are lifted first: the dodge divides by (255 - blurred), and in deep shadows that turned compression noise into black blocks */
      var L = lum(px, w * h), inv = new Uint8ClampedArray(px.length), i;
      for (i = 0; i < w * h; i++) L[i] = 0.2 + 0.8 * L[i];
      for (i = 0; i < w * h; i++) { var v = 255 - L[i] * 255; inv[i * 4] = inv[i * 4 + 1] = inv[i * 4 + 2] = v; inv[i * 4 + 3] = 255; }
      var b = FS.blur(inv, w, h, Math.max(3, w / 120)), out = new Uint8ClampedArray(px.length), r = rnd(5);
      for (i = 0; i < w * h; i++) { var base = L[i] * 255, d = Math.min(255, base * 255 / Math.max(1, 255 - b[i * 4])); d = 255 - (255 - d) * 2.3 - (r() * 10); out[i * 4] = out[i * 4 + 1] = d; out[i * 4 + 2] = d * 0.97; out[i * 4 + 3] = 255; }
      return out;
    },
    oil: function (px, w, h) { var k = kuwahara(px, w, h, Math.max(3, Math.round(w / 260))); saturate(k, 1.18); var E = sobel(lum(k, w * h), w, h); for (var i = 0; i < w * h; i++) { var a = E[i] * 40; k[i * 4] += a; k[i * 4 + 1] += a; k[i * 4 + 2] += a; } return k; },
    watercolor: function (px, w, h) {
      var k = kuwahara(px, w, h, Math.max(3, Math.round(w / 300))), E = FS.blur(edgeImg(sobel(lum(k, w * h), w, h), w, h), w, h, 2), r = rnd(9);
      for (var i = 0; i < w * h; i++) { var e = E[i * 4] / 255, p = 0.93 + r() * 0.07; for (var c = 0; c < 3; c++) k[i * 4 + c] = (255 - (255 - k[i * 4 + c]) * 0.82) * (1 - e * 0.45) * p; }
      saturate(k, 1.15); return k;
    },
    graffiti: function (px, w, h) {
      var pal = ['#141414', '#ff2e88', '#ffd400', '#00e5ff', '#7cff3a', '#9b5cff', '#ff7a00', '#ffffff'].map(hex), k = kuwahara(px, w, h, Math.max(2, Math.round(w / 380))), r = rnd(13);
      for (var i = 0; i < w * h; i++) { var best = 0, bd = 1e9; for (var j = 0; j < pal.length; j++) { var d = (k[i * 4] - pal[j][0]) * (k[i * 4] - pal[j][0]) * 0.8 + (k[i * 4 + 1] - pal[j][1]) * (k[i * 4 + 1] - pal[j][1]) + (k[i * 4 + 2] - pal[j][2]) * (k[i * 4 + 2] - pal[j][2]) * 0.7; if (d < bd) { bd = d; best = j; } }
        for (var c = 0; c < 3; c++) k[i * 4 + c] = k[i * 4 + c] * 0.5 + pal[best][c] * 0.5; }
      saturate(k, 1.4);
      var E = dilate(dilate(sobel(lum(k, w * h), w, h), w, h), w, h);
      for (i = 0; i < w * h; i++) { if (E[i] > 0.5) { k[i * 4] = k[i * 4 + 1] = k[i * 4 + 2] = 12; } else if (E[i] > 0.3 && r() < 0.12) { var s = pal[1 + Math.floor(r() * 6)]; k[i * 4] = s[0]; k[i * 4 + 1] = s[1]; k[i * 4 + 2] = s[2]; } }
      for (i = 0; i < w * h / 320; i++) { var x = Math.floor(r() * w), y = Math.floor(r() * h), s2 = pal[1 + Math.floor(r() * 6)]; for (var t = 0; t < 4; t++) { var q = ((y + (r() * 3 | 0)) * w + x + (r() * 3 | 0)) * 4; if (q < k.length) { k[q] = s2[0]; k[q + 1] = s2[1]; k[q + 2] = s2[2]; } } }
      return k;
    },
    neon: function (px, w, h) {
      var L = lum(FS.blur(px, w, h, 1.5), w * h), E = sobel(L, w, h), out = new Uint8ClampedArray(px.length);
      for (var i = 0; i < w * h; i++) { var e = clamp((E[i] - 0.12) * 3, 0, 1), mx = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], 1); for (var c = 0; c < 3; c++) out[i * 4 + c] = 8 + (px[i * 4 + c] / mx * 255) * e; out[i * 4 + 3] = 255; }
      var g = FS.blur(out, w, h, Math.max(3, w / 120)); for (i = 0; i < out.length; i += 4) for (var c2 = 0; c2 < 3; c2++) out[i + c2] = Math.min(255, out[i + c2] + g[i + c2] * 1.6);
      return out;
    },
    pixel: function (px, w, h) {
      var b = Math.max(4, Math.round(w / 72)), out = new Uint8ClampedArray(px.length);
      for (var by = 0; by < h; by += b) for (var bx = 0; bx < w; bx += b) { var r = 0, g = 0, bl = 0, n = 0, x, y;
        for (y = by; y < Math.min(by + b, h); y++) for (x = bx; x < Math.min(bx + b, w); x++) { var i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; }
        r = Math.round(r / n / 51) * 51; g = Math.round(g / n / 51) * 51; bl = Math.round(bl / n / 51) * 51;
        for (y = by; y < Math.min(by + b, h); y++) for (x = bx; x < Math.min(bx + b, w); x++) { var j = (y * w + x) * 4; out[j] = r; out[j + 1] = g; out[j + 2] = bl; out[j + 3] = 255; } }
      return out;
    },
    glitch: function (px, w, h) {
      var out = new Uint8ClampedArray(px), sh = Math.max(3, Math.round(w / 110)), r = rnd(21), y, x, i;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = (y * w + x) * 4; out[i] = px[(y * w + Math.min(w - 1, x + sh)) * 4]; out[i + 2] = px[(y * w + Math.max(0, x - sh)) * 4 + 2]; if (y % 3 === 0) { out[i] *= 0.82; out[i + 1] *= 0.82; out[i + 2] *= 0.82; } }
      for (var s = 0; s < 14; s++) { var y0 = Math.floor(r() * h), hh = Math.floor(r() * h / 40) + 2, off = Math.floor((r() - 0.5) * w / 8); for (y = y0; y < Math.min(h, y0 + hh); y++) for (x = 0; x < w; x++) { var src = ((y * w + clamp(x + off, 0, w - 1)) * 4); i = (y * w + x) * 4; out[i] = px[src]; out[i + 1] = px[src + 1]; out[i + 2] = px[src + 2]; } }
      return out;
    },
    duotone: function (px, w, h) { var a = hex('#1d1633'), b = hex('#e3c98e'), L = lum(px, w * h), out = new Uint8ClampedArray(px.length); for (var i = 0; i < w * h; i++) { var t = L[i]; for (var c = 0; c < 3; c++) out[i * 4 + c] = a[c] + (b[c] - a[c]) * t; out[i * 4 + 3] = 255; } return out; },
    stained: function (px, w, h) { var k = kuwahara(px, w, h, Math.max(4, Math.round(w / 160))); posterize(k, 6); saturate(k, 1.35); ink(k, sobel(lum(k, w * h), w, h), w, h, 0.3, [30, 24, 18], true); return k; },
    noir: function (px, w, h) { var L = lum(px, w * h), out = new Uint8ClampedArray(px.length); for (var i = 0; i < w * h; i++) { var v = clamp((L[i] - 0.5) * 1.9 + 0.5, 0, 1); v = v * v * (3 - 2 * v) * 255; out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255; } ink(out, sobel(L, w, h), w, h, 0.6); return out; },
    /* an old photo: sepia, faded, a dark edge, grain and a few scratches */
    oldphoto: function (px, w, h) {
      var out = new Uint8ClampedArray(px.length), r = rnd(7), L = lum(px, w * h), cx = w / 2, cy = h / 2, R = Math.sqrt(cx * cx + cy * cy);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x, l = 0.12 + L[i] * 0.78, d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R, v = l * (1 - 0.55 * Math.pow(d, 2.2)) + (r() - 0.5) * 0.07;
        out[i * 4] = clamp(v * 255 * 1.08 + 18, 0, 255); out[i * 4 + 1] = clamp(v * 255 * 0.94 + 10, 0, 255); out[i * 4 + 2] = clamp(v * 255 * 0.74, 0, 255); out[i * 4 + 3] = 255; }
      for (var s = 0; s < 9; s++) { var sx = Math.floor(r() * w), len = Math.floor(h * (0.2 + r() * 0.6)), y0 = Math.floor(r() * (h - len)); for (var yy = y0; yy < y0 + len; yy++) { var j = (yy * w + sx) * 4; out[j] = out[j + 1] = out[j + 2] = 225; } }
      return out;
    },
    /* soft pastel painting: calm colour areas, light and gentle */
    pastel: function (px, w, h) { var k = kuwahara(px, w, h, Math.max(2, Math.round(w / 300))); for (var i = 0; i < k.length; i += 4) for (var c = 0; c < 3; c++) k[i + c] = 255 - (255 - k[i + c]) * 0.62; saturate(k, 0.85); return k; },
    /* a colouring page: black lines on white */
    lineart: function (px, w, h) { var E = sobel(lum(kuwahara(px, w, h, 2), w * h), w, h), out = new Uint8ClampedArray(px.length); for (var i = 0; i < w * h; i++) { var v = 255 - clamp((E[i] - 0.12) * 900, 0, 255); out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255; } return out; },
    blueprint: function (px, w, h) { var E = dilate(sobel(lum(kuwahara(px, w, h, 2), w * h), w, h), w, h), out = new Uint8ClampedArray(px.length), g = Math.max(10, Math.round(w / 40));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x, grid = (x % g === 0 || y % g === 0) ? 0.18 : 0, e = clamp((E[i] - 0.15) * 3, 0, 1) + grid; out[i * 4] = 18 + e * 210; out[i * 4 + 1] = 62 + e * 180; out[i * 4 + 2] = 128 + e * 125; out[i * 4 + 3] = 255; } return out; },
    /* a tile mosaic with grout lines */
    mosaic: function (px, w, h) {
      var b = Math.max(6, Math.round(w / 60)), out = new Uint8ClampedArray(px.length);
      for (var by = 0; by < h; by += b) for (var bx = 0; bx < w; bx += b) { var r = 0, g = 0, bl = 0, n = 0, x, y;
        for (y = by; y < Math.min(by + b, h); y++) for (x = bx; x < Math.min(bx + b, w); x++) { var i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; }
        r /= n; g /= n; bl /= n; var sh = 0.88 + ((bx * 7 + by * 13) % 17) / 70;
        for (y = by; y < Math.min(by + b, h); y++) for (x = bx; x < Math.min(bx + b, w); x++) { var j = (y * w + x) * 4, edge = x - bx < 1 || y - by < 1; out[j] = edge ? 235 : r * sh; out[j + 1] = edge ? 228 : g * sh; out[j + 2] = edge ? 215 : bl * sh; out[j + 3] = 255; } }
      return out;
    },
    /* lomo: strong colour, deep vignette, cross-processed tones */
    lomo: function (px, w, h) { var out = new Uint8ClampedArray(px), cx = w / 2, cy = h / 2, R = Math.sqrt(cx * cx + cy * cy); saturate(out, 1.45);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R, v = 1 - 0.75 * Math.pow(d, 2.4);
        var rr = out[i] / 255, gg = out[i + 1] / 255, bb = out[i + 2] / 255; rr = rr * rr * (3 - 2 * rr); gg = gg * gg * (3 - 2 * gg); bb = 0.12 + bb * 0.8;
        out[i] = rr * 255 * v; out[i + 1] = gg * 255 * v; out[i + 2] = bb * 255 * v; } return out; },
    /* gold engraving: fine lines that follow the light, on cream */
    engrave: function (px, w, h) { var L = lum(kuwahara(px, w, h, 2), w * h), out = new Uint8ClampedArray(px.length), p = Math.max(3, Math.round(w / 220));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * w + x, t = ((x + y * 0.6) % (p * 2)) / (p * 2), on = Math.abs(t - 0.5) * 2 > L[i] * 0.95 + 0.04;
        out[i * 4] = on ? 70 : 246; out[i * 4 + 1] = on ? 52 : 236; out[i * 4 + 2] = on ? 28 : 212; out[i * 4 + 3] = 255; } return out; },
    /* thermal camera colours */
    thermal: function (px, w, h) { var L = lum(px, w * h), out = new Uint8ClampedArray(px.length), st = [[8, 6, 60], [90, 20, 150], [220, 40, 90], [255, 150, 20], [255, 245, 160]];
      for (var i = 0; i < w * h; i++) { var t = clamp(L[i], 0, 0.999) * 4, k = Math.floor(t), f = t - k, a = st[k], b = st[k + 1]; for (var c = 0; c < 3; c++) out[i * 4 + c] = a[c] + (b[c] - a[c]) * f; out[i * 4 + 3] = 255; } return out; }
  };
  function edgeImg(E, w, h) { var o = new Uint8ClampedArray(w * h * 4); for (var i = 0; i < w * h; i++) { var v = clamp(E[i] * 255, 0, 255); o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = 255; } return o; }

  FS.LOCAL_STYLES = [
    ['cartoon', 'אנימציה מצוירת', '🎬'], ['comic', 'קומיקס', '💥'], ['manga', 'מנגה יפנית', '🗾'], ['pop', 'פופ־ארט', '🟨'], ['graffiti', 'גרפיטי', '🎨'],
    ['sketch', 'סקיצת עיפרון', '✏️'], ['oil', 'ציור שמן', '🖼️'], ['watercolor', 'צבעי מים', '💧'], ['stained', 'ויטראז׳', '⛪'], ['neon', 'ניאון', '💡'],
    ['pixel', 'פיקסל ארט', '👾'], ['glitch', 'גליץ׳', '📺'], ['duotone', 'דואוטון זהב', '✨'], ['noir', 'פילם נואר', '🕵️'],
    ['oldphoto', 'תמונה ישנה', '📜'], ['pastel', 'פסטל רך', '🌷'], ['lineart', 'דף צביעה', '🖍️'], ['blueprint', 'שרטוט כחול', '📐'],
    ['mosaic', 'פסיפס', '🧩'], ['lomo', 'לומו', '📷'], ['engrave', 'תחריט זהב', '🪙'], ['thermal', 'מצלמה תרמית', '🌡️']
  ];

  /* the ones offered in the menu: checked on portraits, the faces stay clean (the others still render for older projects) */
  FS.PRO_STYLES = ['cartoon', 'oil', 'watercolor', 'sketch', 'lineart', 'noir', 'duotone', 'oldphoto', 'lomo', 'pastel', 'manga'];
  /* run a style on the pipeline's pixels: at most 1400px wide, mixed back by amt */
  FS.applyStyle = function (px, w, h, st, fast) {
    var fn = S[st.id]; if (!fn) return;
    var lim = fast ? 700 : 1400, k = Math.min(1, lim / Math.max(w, h)), sw = Math.max(2, Math.round(w * k)), sh = Math.max(2, Math.round(h * k));
    var src = FS.canvas(w, h), sx = src.getContext('2d'); sx.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
    var sm = FS.canvas(sw, sh), mx = sm.getContext('2d', { willReadFrequently: true }); mx.imageSmoothingQuality = 'high'; mx.drawImage(src, 0, 0, sw, sh);
    var res = fn(mx.getImageData(0, 0, sw, sh).data, sw, sh);
    mx.putImageData(new ImageData(res, sw, sh), 0, 0);
    var big = FS.canvas(w, h), bx = big.getContext('2d', { willReadFrequently: true }); bx.imageSmoothingEnabled = st.id !== 'pixel'; bx.drawImage(sm, 0, 0, w, h);
    var out = bx.getImageData(0, 0, w, h).data, a = (st.amt == null ? 100 : st.amt) / 100;
    for (var i = 0; i < px.length; i += 4) { px[i] += (out[i] - px[i]) * a; px[i + 1] += (out[i + 1] - px[i + 1]) * a; px[i + 2] += (out[i + 2] - px[i + 2]) * a; }
  };

  /* ---------- AI styles (image model through the hubs server) ---------- */
  var KEEP = ' IMPORTANT: this is a photo of real people at an event. Keep each person\'s identity: same face shape, features, skin tone, hair, expression and age, so family members recognize them instantly. Keep the same number of people, the same poses, positions and camera framing, and the same aspect ratio. Do not crop, do not add or remove people, no text, no watermark. Highly detailed, professional quality.';
  /* ✨ the stunning pack: [id, name, icon, prompt]. Like every style it runs on the local engine with no internet (FS.askServer routes) */
  FS.AI_WOW = [
    ['fantasy-portrait', 'פורטרט פנטזיה', '🧝', 'Turn this photo into an epic fantasy portrait painting: ethereal glowing light, flowing fabrics, sparkling magic in the air, rich jewel colours, detailed digital painting.'],
    ['galaxy', 'גלקסיה', '🌌', 'Place the people inside a breathtaking galaxy: purple and blue nebulae, glowing stars and cosmic dust swirling around them, their outlines softly lit by starlight.'],
    ['double-exp', 'חשיפה כפולה', '🌲', 'Make an artistic double exposure: the people\'s silhouettes filled with a misty pine forest at sunrise, blended softly into a clean white background, fine-art poster.'],
    ['crystal', 'פסל קריסטל', '💎', 'Turn the people into exquisite translucent crystal sculptures that refract rainbow light, on a dark velvet background with sparkling caustics.'],
    ['ice', 'פסל קרח', '🧊', 'Turn the people into a magical ice sculpture glowing blue from within, with frost, snowflakes and soft winter light around them.'],
    ['fire', 'אש ולהבות', '🔥', 'Surround the people with a spectacular swirl of golden fire and glowing embers, dramatic dark background, cinematic heat glow on their faces, epic movie poster.'],
    ['steampunk', 'סטימפאנק', '⚙️', 'Restyle this photo in steampunk style: brass goggles, gears, Victorian costumes, copper machines and warm steam-filled light.'],
    ['art-deco', 'ארט דקו', '🏛️', 'Redraw this photo as an elegant 1920s Art Deco poster: geometric gold lines, black and cream palette, glamorous stylised figures.'],
    ['renaissance', 'ציור רנסנס', '🖼️', 'Repaint this photo as a Renaissance masterpiece oil painting: soft sfumato, rich velvet clothes, dramatic chiaroscuro and an ornate classical background.'],
    ['aurora', 'זוהר צפוני', '🌠', 'Place the people under a spectacular northern lights sky, green and violet aurora ribbons over snowy mountains, their faces lit by the glow.'],
    ['holo', 'הולוגרמה', '🔮', 'Turn the people into glowing futuristic holograms made of blue light lines and particles, floating in a dark sci-fi room.'],
    ['vaporwave', 'וייפורוויב', '🌴', 'Restyle this photo as vaporwave art: pink and cyan gradients, palm trees, a retro sun, glitch lines and a dreamy 90s aesthetic.'],
    ['paper-cut', 'חיתוכי נייר', '✂️', 'Recreate this photo as layered paper-cut art with depth, soft shadows between colourful paper layers, handcrafted look.'],
    ['embroidery', 'רקמה', '🧵', 'Turn this photo into detailed embroidery stitched on linen fabric, visible threads and stitches, warm handmade craft.'],
    ['ink-wash', 'ציור דיו', '🖌️', 'Repaint this photo as an East Asian ink wash painting: flowing black ink brush strokes, soft washes, a red seal stamp and lots of white space.'],
    ['low-poly', 'לואו־פולי', '🔷', 'Turn this photo into colourful low-poly 3D art made of faceted triangles with soft gradient lighting.'],
    ['storybook', 'ספר ילדים', '📖', 'Redraw this photo as a whimsical children\'s storybook illustration with soft watercolour and gouache, warm colours and a cosy magical setting.'],
    ['euro-comic', 'קומיקס אירופאי', '💬', 'Redraw this photo as a classic European comic panel in clean ligne claire style: uniform black outlines, flat bright colours, a speech bubble.'],
    ['enamel', 'שלט פח וינטג׳', '🪧', 'Turn this photo into a 1950s enamel tin sign advertisement with bold retro typography space, limited colours, worn edges and a cheerful vintage look.'],
    ['neon-sign', 'שלט ניאון', '💡', 'Turn the people into glowing neon tube outlines on a dark brick wall, pink and cyan neon light with a soft reflection.'],
    ['chalk', 'ציור גיר', '🖍️', 'Redraw this photo as colourful chalk art on a blackboard, dusty chalk texture and hand-drawn details.'],
    ['candy', 'עולם ממתקים', '🍭', 'Place the people in a sweet candy world: lollipops, pastel cotton-candy clouds, gingerbread and sprinkles, dreamy and colourful.'],
    ['balloons', 'בלונים ושמחה', '🎈', 'Surround the people with a burst of colourful balloons and golden confetti falling around them, joyful celebration light.'],
    ['gold-dust', 'אבק זהב', '✨', 'Add magical golden dust and sparkling light particles swirling around the people, warm dreamy glow and soft bokeh, luxurious portrait.'],
    ['oil-real', 'ציור שמן ריאליסטי', '🎨', 'Repaint this photo as a realistic oil portrait painting with visible brush strokes, warm museum lighting and a gilded frame mood.'],
    ['cinematic', 'סרט אפי', '🎬', 'Make this a cinematic still from an epic movie: dramatic teal and orange colour grading, anamorphic lens flare, shallow depth of field, widescreen mood.'],
    ['petals', 'גשם עלי ורדים', '🌹', 'Add a soft rain of pink and red rose petals falling around the people, romantic warm light and gentle bokeh, elegant wedding portrait.'],
    ['fireworks-sky', 'זיקוקים בשמיים', '🎆', 'Place the people in front of a night sky full of spectacular colourful fireworks, their faces lit warmly by the bursts, festive celebration.'],
    ['paris', 'לילה בפריז', '🗼', 'Place the people on a Paris street at night with the glowing Eiffel Tower behind them, warm street lamps, romantic cinematic mood.'],
    ['beach-sunset', 'שקיעה בחוף', '🌅', 'Place the people on a beautiful beach at golden sunset, warm orange sky reflected on the sea, soft breeze and glowing rim light.'],
    ['santorini', 'סנטוריני', '🏝️', 'Place the people on a terrace in Santorini with white houses, blue domes and the deep blue Aegean sea in soft afternoon light.'],
    ['jerusalem', 'ירושלים של זהב', '🕍', 'Place the people in front of the golden stone walls of the Old City of Jerusalem at sunset, warm golden light, elegant and festive.'],
    ['ballroom', 'אולם נשפים מלכותי', '👑', 'Place the people in a grand royal ballroom with crystal chandeliers, golden decorations and polished marble floors, dressed in elegant formal clothes.'],
    ['red-carpet', 'שטיח אדום', '🎞️', 'Place the people on a Hollywood red carpet premiere with camera flashes, velvet ropes and glamorous lights, dressed in elegant evening wear.'],
    ['vogue', 'שער מגזין', '📰', 'Make this a high-fashion magazine cover photo: professional studio lighting, glossy editorial look, elegant styling and clean empty space at the top for a title.'],
    ['studio-pro', 'סטודיו צילום מקצועי', '📸', 'Make this a professional studio portrait: seamless soft grey backdrop, beautiful soft-box lighting, crisp detail and natural skin, magazine quality.'],
    ['bw-fashion', 'שחור לבן אופנתי', '🖤', 'Make this an elegant black and white fashion portrait with dramatic contrast, deep blacks and soft glowing highlights, timeless and classy.'],
    ['black-gold', 'גלאם שחור וזהב', '🥂', 'Restyle the scene as a luxury black and gold party: dark background, golden sparkles, champagne glow and glamorous lighting on the people.'],
    ['clouds', 'מעל העננים', '☁️', 'Place the people standing above a sea of soft golden clouds at sunrise, heavenly light rays and a dreamy peaceful sky.'],
    ['butterfly-garden', 'גן פרפרים קסום', '🦋', 'Place the people in an enchanted garden full of flowers and colourful glowing butterflies fluttering around them, magical soft light.'],
    ['snow-globe', 'כדור שלג', '❄️', 'Place the people inside a magical glass snow globe with gently falling snow and twinkling lights, cosy winter fairytale.'],
    ['underwater', 'מתחת לים', '🐠', 'Place the people in a magical underwater world with sun rays through the water, colourful coral, tropical fish and floating bubbles, keeping their faces clear.'],
    ['hot-air', 'בלונים פורחים', '🎈', 'Place the people in front of a sky full of colourful hot air balloons at sunrise over green hills, joyful and bright.'],
    ['disco', 'מסיבת דיסקו', '🪩', 'Put the people on a dance floor under a sparkling mirror disco ball with colourful light beams and glitter, fun party energy.'],
    ['concert', 'כוכבים על הבמה', '🎤', 'Put the people on a big concert stage with spotlights, haze, light beams and a cheering crowd behind, rock-star moment.'],
    ['carnival', 'קרנבל ומסכות', '🎭', 'Place the people at a colourful carnival with feather masks, confetti, streamers and festive lights, Purim celebration mood.'],
    ['luna-park', 'לונה פארק', '🎡', 'Place the people at an amusement park at night with a glowing Ferris wheel, carousel lights and cotton candy, joyful and colourful.'],
    ['hanukkah', 'אורות חנוכה', '🕎', 'Add a warm Hanukkah atmosphere around the people: glowing menorah candles, soft golden bokeh lights and blue and silver decorations.'],
    ['flower-frame', 'זר פרחים', '💐', 'Frame the people with a lush wreath of fresh flowers and greenery around the edges of the photo, soft natural light, elegant invitation style.'],
    ['castle', 'טירה מהאגדות', '🏰', 'Place the people in front of a fairytale castle with turrets at golden hour, magical sparkles in the air, storybook atmosphere.'],
    ['royal', 'נסיך ונסיכה', '🤴', 'Dress the people as a prince and princess in royal costumes with crowns, velvet and gold, in a palace hall, keeping their faces exactly the same.'],
    ['city-night', 'עיר בלילה', '🌃', 'Place the people on a rooftop overlooking a glittering city skyline at night, warm string lights and bokeh, stylish evening mood.'],
    ['rain-neon', 'גשם וניאון', '☔', 'Place the people on a rainy street at night with neon reflections on the wet ground and a transparent umbrella, cinematic romantic mood.'],
    ['vintage-wedding', 'חתונה וינטג׳', '🎻', 'Make this look like a romantic vintage wedding photo from the 1950s: soft film grain, warm faded colours, lace and classic styling.'],
    ['golden-hour', 'שעת זהב', '🌇', 'Relight this photo with gorgeous golden hour sunlight: warm glowing rim light, soft lens flare and rich golden tones on the people.'],
    ['sparkle-frame', 'מסגרת נצנצים', '✨', 'Add a glamorous sparkling frame of glitter and light around the edges, shimmering gold and silver particles, festive celebration portrait.'],
    ['polaroid', 'פולארויד וינטג׳', '📷', 'Turn this photo into a genuine vintage instant photo from the 1970s: warm faded colours, soft film grain, gentle light leaks and the slightly creamy tones of old instant film.'],
    ['watercolor', 'צבעי מים', '🖌️', 'Repaint this photo as a delicate watercolour painting: soft washes of colour bleeding into each other, white paper showing through, fine pencil lines, airy and romantic.'],
    ['big-head', 'ציור משפחתי – ראש גדול', '👨‍👩‍👧', 'Turn this exact photo into a hand-drawn caricature illustration of these same people, every face redrawn in the drawing style (never a photo face pasted in). Draw each person exactly as they are in the photo: the same age (a child stays a child, a teenager stays a teenager), the same gender, the same face, hair and skin tone, and only the accessories they really wear. Every person in the photo appears once, in the same place and order, with nobody added and nobody left out. Style: oversized heads, about a third of the body height, on small cute bodies, big glossy eyes, warm smiles, rosy cheeks, soft coloured-pencil and marker texture with clean dark outlines, the same clothes and colours. Background: bright festive backdrop of white flowers with green leaves, soft white drapes and warm golden light. No text.'],
    ['caricature', 'קריקטורה חגיגית', '😄', 'Redraw the people as a friendly, flattering caricature illustration: slightly bigger heads and big happy smiles, clean bold lines, bright cheerful colours, festive event mood.'],
    ['charcoal', 'ציור פחם', '✏️', 'Redraw this photo as an expressive charcoal drawing on textured paper: rich blacks, soft smudged shadows, confident strokes, fine-art sketchbook look.'],
    ['pop-art', 'פופ־ארט', '🟨', 'Turn this photo into a bold pop-art print: flat vivid colours, thick black outlines, halftone dots, bright yellow, pink and blue panels, gallery poster style.'],
    ['stained-glass', 'ויטראז׳', '🪟', 'Turn this photo into a glowing stained-glass window: jewel-coloured glass pieces joined by dark lead lines, sunlight shining through, the people clearly recognisable.'],
    ['clay', 'דמויות פלסטלינה', '🧸', 'Recreate this photo as a charming claymation scene: the people as handmade plasticine figures with visible fingerprints and soft studio lighting, the same pose and clothes.'],
    ['gold-statue', 'פסל זהב', '🏆', 'Turn the people into a polished solid-gold statue on a marble pedestal, dramatic museum lighting, gleaming reflections, the faces and pose exactly the same.']
  ];
  FS.AI_STYLES = [
    ['3d', 'אנימציה תלת־ממד', '🧸', 'Redraw this photo as a still from a modern 3D animated family movie: soft cinematic light, expressive eyes, smooth stylized characters, rich colours.'],
    ['anime', 'אנימה', '🌸', 'Redraw this photo as a beautiful Japanese anime illustration with clean line art, cel shading and a dreamy background.'],
    ['manga', 'מנגה', '🗾', 'Redraw this photo as a black and white Japanese manga panel with ink lines, screentone shading and dramatic speed lines.'],
    ['comic', 'קומיקס', '💥', 'Redraw this photo as a vintage American comic book panel: bold ink outlines, halftone dots, vivid flat colours.'],
    ['hero', 'גיבורי על', '🦸', 'Turn every person in this photo into a superhero wearing a colourful suit with a cape and emblem, dynamic comic-book lighting, a city skyline behind them.'],
    ['animals', 'חיות', '🦁', 'Turn every person in this photo into a cute anthropomorphic animal character (choose a fitting animal for each) wearing the same clothes, in a warm storybook illustration style.'],
    ['graffiti', 'גרפיטי', '🎨', 'Redraw this photo as a vibrant spray-paint graffiti mural on a brick wall, with drips, bold outlines and neon colours.'],
    ['clay', 'פלסטלינה', '🧱', 'Redraw this photo as a claymation stop-motion scene: characters made of modelling clay with fingerprints texture, miniature set.'],
    ['oil', 'ציור שמן קלאסי', '🖼️', 'Redraw this photo as a classical oil painting with visible brush strokes, rich warm light, museum quality.'],
    ['water', 'צבעי מים', '💧', 'Redraw this photo as a delicate watercolor painting on textured paper with soft washes and loose edges.'],
    ['pixel', 'משחק וידאו', '👾', 'Redraw this photo as colourful 16-bit pixel art from a retro video game.'],
    ['cyber', 'סייברפאנק', '🌃', 'Redraw this photo in a cyberpunk style: neon city at night, glowing signs, futuristic outfits, rain reflections.'],
    ['fairy', 'אגדה', '🧚', 'Redraw this photo as a magical fairy-tale storybook illustration with soft glowing light, sparkles and an enchanted forest.'],
    ['space', 'אסטרונאוטים', '🚀', 'Put every person in this photo into astronaut suits floating in space with Earth and stars behind them, photorealistic.'],
    ['royal', 'מלכים ומלכות', '👑', 'Turn every person into royalty in a Renaissance palace portrait: crowns, rich robes, gold frames, oil-painting style.'],
    ['pop', 'פופ־ארט', '🟨', 'Redraw this photo as bold pop art with flat bright colours, thick outlines and Ben-Day dots.'],
    ['chibi', 'סטיקר צ׳יבי', '🍡', 'Redraw the people in this photo as cute chibi characters with big heads, as a die-cut sticker with a white border on a plain background.'],
    ['caric', 'קריקטורה', '😜', 'Redraw this photo as a friendly, funny caricature drawing with exaggerated but kind features, colored pencils.'],
    ['vintage', 'צילום מ־1920', '🎞️', 'Make this look like an authentic 1920s sepia photograph with period clothing, film grain and an aged paper border.'],
    ['purim', 'תחפושות', '🎭', 'Dress every person in this photo in fun, colourful costumes (pirate, princess, astronaut, magician…), festive party background.'],
    ['studio', 'פורטרט סטודיו', '📸', 'Turn this into a professional studio portrait photograph: flattering soft-box lighting, clean seamless backdrop, natural skin retouching, sharp focus, magazine quality.'],
    ['restore', 'שחזור ושיפור', '🪄', 'Restore and enhance this photo: remove noise, blur and scratches, recover sharp natural detail and true colours, as if taken with a high-end camera. Change nothing else.'],
    ['pencil', 'רישום עיפרון', '✏️', 'Redraw this photo as a realistic graphite pencil portrait drawing on white paper, fine shading and cross-hatching.'],
    ['ukiyoe', 'הדפס יפני', '🌊', 'Redraw this photo as a traditional Japanese ukiyo-e woodblock print with flat colours, bold outlines and stylized waves and clouds.'],
    ['mosaic', 'פסיפס עתיק', '🏛️', 'Redraw this photo as an ancient Roman stone mosaic made of small coloured tiles.'],
    ['stainedai', 'ויטראז׳', '⛪', 'Redraw this photo as a glowing cathedral stained-glass window with lead lines and jewel colours.'],
    ['knight', 'אבירים וטירות', '🏰', 'Turn every person into medieval knights and nobles in shining armour and velvet, a castle courtyard behind them, epic fantasy painting.'],
    ['western', 'מערבון', '🤠', 'Turn every person into a wild-west cowboy or cowgirl with hats and leather, a desert town at sunset behind them, cinematic.'],
    ['beach', 'חוף טרופי', '🏝️', 'Move the people to a sunny tropical beach with turquoise water and palm trees, summer outfits, golden hour light, photorealistic.'],
    ['snow', 'חורף מושלג', '❄️', 'Move the people to a snowy winter wonderland with falling snow, cosy winter coats and warm lights, photorealistic.'],
    ['poster', 'פוסטר של סרט', '🎬', 'Turn this photo into an epic blockbuster movie poster scene with dramatic lighting, lens flares and a cinematic colour grade (no text).'],
    ['plush', 'בובות פרווה', '🧸', 'Turn every person into a cute plush toy version of themselves, soft fabric and stitching, on a cosy shelf.'],
    ['bricks', 'לבני צעצוע', '🧱', 'Rebuild this whole scene out of colourful plastic toy building bricks, minifigure-style people, studio lighting.'],
    ['80s', 'שנות ה־80', '📼', 'Make this look like an authentic 1980s photo: big hair, retro neon outfits, film colours, a laser-grid studio backdrop.'],
    ['angels', 'מלאכים וכנפיים', '🕊️', 'Give every person soft white angel wings and a glowing halo among dreamy clouds and golden light, ethereal painting.'],
    ['gold', 'פסל זהב', '🏆', 'Turn every person into a polished gold statue of themselves on a marble plinth in a museum, photorealistic.'],
    ['classic2d', 'אנימציה קלאסית', '🏰', 'Redraw this photo as a still from a classic hand-drawn 2D animated fairy-tale film: clean ink outlines, soft painted backgrounds, warm storybook colours.'],
    ['dreamy', 'אנימה חלומית', '☁️', 'Redraw this photo as a frame from a dreamy hand-painted Japanese animated film: soft watercolour skies, lush detailed backgrounds, gentle warm light.'],
    ['dolls', 'בובות אופנה', '🎀', 'Turn every person into a glossy fashion doll version of themselves in a pink dreamhouse set: smooth doll skin, perfect styling, bright toy-box lighting.'],
    ['wed50', 'חתונה בשנות ה־50', '🎞️', 'Make this an elegant black and white wedding photograph from the 1950s: soft film grain, classic studio lighting, period hairstyles and clothes.'],
    ['hollywood', 'הוליווד הקלאסית', '🎬', 'Make this a glamorous classic Hollywood black and white portrait: dramatic studio lighting, soft glow, 1940s film-star styling.'],
    ['fashion', 'צילום אופנה', '📸', 'Turn this into a high-end fashion magazine photoshoot: editorial lighting, elegant styling, a luxurious backdrop, sharp professional photography.'],
    ['chuppah', 'חופה בשקיעה', '💍', 'Place the people under a beautiful wedding chuppah decorated with white flowers at golden-hour sunset in an olive grove, photorealistic, warm romantic light.'],
    ['kotel', 'בכותל המערבי', '🕍', 'Place the people in front of the Western Wall in Jerusalem at golden hour, festive and respectful, photorealistic, warm light.'],
    ['jerusalem', 'ירושלים של זהב', '🌇', 'Place the people on a terrace overlooking the golden Old City of Jerusalem at sunset, photorealistic, warm golden light.'],
    ['telaviv', 'חוף תל אביב', '🏖️', 'Place the people on the Tel Aviv beach promenade at sunset with the sea and the city skyline behind them, photorealistic, summer evening light.'],
    ['hanukkah', 'אורות חנוכה', '🕎', 'Place the people beside a glowing menorah with lit candles and sufganiyot in a cosy festive home, warm candle light, photorealistic.'],
    ['seder', 'ליל הסדר', '🍷', 'Place the people around a festive Passover seder table with matza, wine glasses and candles, warm family light, photorealistic.'],
    ['newyear', 'שנה טובה', '🍎', 'Place the people in a festive Rosh Hashana scene with apples, honey and pomegranates on the table, warm golden light, photorealistic.'],
    ['paris', 'פריז רומנטית', '🗼', 'Place the people on a Paris street at night with the Eiffel Tower sparkling behind them, romantic city lights, photorealistic.'],
    ['santorini', 'סנטוריני', '🏛️', 'Place the people on a white terrace in Santorini with blue domes and the Aegean sea at sunset, photorealistic.'],
    ['safari', 'ספארי', '🦒', 'Place the people on an African safari at golden hour with giraffes and acacia trees, wearing safari outfits, photorealistic.'],
    ['underwater', 'מתחת למים', '🐠', 'Place the people underwater in a coral reef with colourful fish and sun rays, hair floating gently, photorealistic and magical.'],
    ['vikings', 'ויקינגים', '🛡️', 'Turn every person into a Viking with furs, braids and round shields on a misty fjord shore, epic cinematic painting.'],
    ['samurai', 'סמוראים', '⛩️', 'Turn every person into a samurai or a noble in traditional Japanese armour and kimono in a cherry-blossom garden, cinematic.'],
    ['egypt', 'מצרים העתיקה', '🏺', 'Turn every person into ancient Egyptian royalty with gold jewellery and headdresses, the pyramids behind them, epic painting.'],
    ['marble', 'פסל שיש', '🗿', 'Turn every person into a classical white marble statue of themselves in a museum gallery, photorealistic sculpture.'],
    ['origami', 'אוריגמי', '🦢', 'Rebuild the whole scene from folded origami paper: the people, their clothes and the background made of crisp coloured paper folds, studio light.'],
    ['crayon', 'ציור ילדים', '🖍️', 'Redraw this photo as a cheerful crayon drawing by a child on white paper, with wobbly lines and bright colours, still recognisable.'],
    ['wood', 'פסל עץ', '🪵', 'Turn every person into a hand-carved wooden figurine of themselves, warm polished wood grain, studio light.'],
    ['flowers', 'זר פרחים', '🌸', 'Give every person a beautiful crown of fresh flowers and surround them with blooming flowers and soft spring light, a dreamy portrait.'],
    ['circus', 'קרקס וינטג׳', '🎪', 'Turn every person into vintage circus performers under a striped big top with warm lights, colourful painterly style.'],
    /* Oct 23: more looks for event photographers */
    ['cinema-bw', 'שחור־לבן קולנועי', '🎞️', 'Make this a timeless black and white fine-art portrait: deep blacks, silver highlights, soft film grain, the light of a classic movie still.'],
    ['golden', 'שקיעה זהובה', '🌅', 'Relight this photo with warm golden-hour sunset light: a glowing rim light on hair and shoulders, soft lens flare, a warm sky behind them.'],
    ['bokeh', 'בוקה רומנטי', '✨', 'Make the background a dreamy romantic bokeh of warm fairy lights while the people stay sharp, soft glow, wedding photography.'],
    ['vogue', 'שער מגזין אופנה', '💃', 'Turn this into a high-fashion magazine cover shoot: editorial lighting, elegant styling, rich colour grade, no text.'],
    ['charcoal', 'רישום פחם', '🖤', 'Redraw this photo as an expressive charcoal drawing on textured paper with smudged shadows and confident strokes.'],
    ['pastel-art', 'ציור פסטל', '🖍️', 'Redraw this photo as a soft chalk pastel painting with gentle colours and visible paper texture.'],
    ['stained', 'ויטראז׳', '⛪', 'Redraw this photo as a glowing stained-glass window with lead lines and jewel-toned glass, light shining through.'],
    ['mosaic-art', 'פסיפס עתיק', '🏛️', 'Redraw this photo as an ancient Roman floor mosaic made of small stone tiles, warm earthy colours.'],
    ['ukiyo', 'הדפס יפני', '🌊', 'Redraw this photo as a Japanese ukiyo-e woodblock print with flat colours, fine outlines and a stylised wave or Mount Fuji behind.'],
    ['impression', 'אימפרסיוניזם', '🎨', 'Redraw this photo as an impressionist painting in the spirit of Monet: dappled light, short brush strokes, a garden in bloom.'],
    ['gold-leaf', 'עלי זהב', '🪙', 'Redraw this photo as an Art Nouveau portrait with ornate gold leaf patterns, flowing lines and a decorative halo, in the spirit of Klimt.'],
    ['neon-night', 'לילה ניאון', '🌆', 'Relight the people with pink and blue neon light at night, wet reflections and a glowing city behind, cinematic.'],
    ['medbeach', 'חוף הים התיכון', '🏖️', 'Place the people on a beautiful Mediterranean beach at sunset with turquoise water and soft sand, natural photo, the same clothes.'],
    ['garden', 'גן פורח', '🌷', 'Place the people in a lush blooming garden with roses and soft afternoon light, natural photo, the same clothes.'],
    ['castle', 'ארמון אגדות', '🏰', 'Place the people in front of a fairy-tale castle at dusk with fireworks in the sky, magical light, photorealistic.'],
    ['retro80', 'שנות ה־80', '📼', 'Restyle this photo as a 1980s retro photo: big hair, bold colours, a laser-grid background and VHS colour bleed.'],
    ['polaroid', 'פולארויד וינטג׳', '📷', 'Make this look like a faded vintage instant photo from the 1970s: warm cast, soft focus, slight light leak.'],
    ['caricature', 'קריקטורה עדינה', '😄', 'Redraw this photo as a friendly, flattering caricature with slightly bigger heads and warm smiles, colourful hand-drawn style.']
  ];
  FS.AI_KEEP = KEEP;
  /* the photo for the image model: a big copy for Gemini, and one under 512px for FLUX.2 on Cloudflare */
  function photoB64(p, long) {
    var im = FS.img(p.origSrc || p.src), k = Math.min(1, long / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.86).split(',')[1];
  }
  /* the answer is brought back to the original's shape and size (centre crop), so the frame, the faces and the layout stay where they were */
  function matchShape(res, orig, trimBottom) {
    var W = orig.naturalWidth, H = orig.naturalHeight, k = Math.min(1, 3000 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    /* trimBottom: the free engine may stamp its name in the bottom corner; that strip is left out */
    var rw = res.naturalWidth, rh = res.naturalHeight * (1 - (trimBottom || 0));
    var s = Math.max(W / rw, H / rh), c = FS.canvas(W, H), x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(res, 0, 0, rw, rh, (W - rw * s) / 2, (H - rh * s) / 2, rw * s, rh * s);
    return new Promise(function (ok) { c.toBlob(function (b) { ok(FS.loadImg(URL.createObjectURL(b))); }, 'image/jpeg', 0.94); });
  }
  /* the engine the AI tab chose ('' = each in turn); FS.restyle uses it unless an engine is passed */
  FS.aiEngine = function (v) { try { if (v !== undefined) localStorage.setItem('fs-ai-engine', v); return localStorage.getItem('fs-ai-engine') || ''; } catch (e) { return v || ''; } };
  FS.restyle = function (p, prompt, engine) { return FS.restyleTry(p, prompt, engine).then(function (im) { return FS.applyAI(p, im); }); };
  /* one AI design of the photo, not applied yet: an image the shape of the original, with .aiSource (who made it) */
  /* A result that lost the people (the photo had faces, the answer has none, or under half of a group) or that added people is
     never put on the photo: it is asked again, from the free engine with a new seed, then from the engine on this computer when
     it is installed; when every try fails the owner sees the last answer and decides ("להחיל בכל זאת"), or, in a batch, the error
     is 'lost-people' / 'extra-people'. Before an answer counts as lost, the face count is loosened for drawn faces and the
     people are looked for as bodies too (FS.personCover, at least 35% of the original's). The people are counted with
     FS.mainFaces (clear faces, not small or false ones in the background), the same count the prompt is given.
     "👤 רק על אדם אחד" (FS.aiOnePerson, 'fs-ai-one'): on a photo with two or more people, one is chosen (a picker for a single
     photo, the largest face in a batch); only the area around that person goes to the AI, as a photo of one person, and only
     that person (the answer's person mask, soft at the edges) is laid back into the photo; everyone else stays as shot. */
  FS.aiOnePerson = function (v) { try { if (v !== undefined) localStorage.setItem('fs-ai-one', v ? '1' : '0'); return localStorage.getItem('fs-ai-one') === '1'; } catch (e) { return false; } };
  var batch = false; FS.aiBatch = function (v) { batch = !!v; };
  FS.restyleTry = function (p, prompt, engine) {
    if (engine === undefined) engine = FS.aiEngine();
    var orig = FS.img(p.origSrc || p.src);
    var det = FS.detectFaces ? FS.detectFaces(orig).catch(function () { return []; }) : Promise.resolve([]);
    return det.then(function (all) {
      var main = FS.mainFaces ? FS.mainFaces(all) : all;
      p._nAll = main.length; p._all = main.slice();
      /* v210: everyone in the photo is kept, not only the people posing in front (the owner: nobody added, nobody left out;
         a man at the edge of a bar mitzvah photo had disappeared). Only faces under a third of the largest (a far crowd) may go. */
      if (main.length || !FS.countFacesLm) return main;
      /* the face finder saw nobody: the landmarker counts again, so the people are still counted and checked (v174) */
      return FS.countFacesLm(orig).then(function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ x: 0, y: 0, w: 1, h: 1, score: 1, fake: 1 }); return a; });
    }).then(function (main) {
      /* v215: a photo split from a group (✂️ כל אחד בנפרד): only the person in the middle counts; the neighbours' edges go */
      if (p.solo && main.length > 1 && !main[0].fake) {
        var W0 = orig.naturalWidth, H0 = orig.naturalHeight;
        main = [main.slice().sort(function (a, b) { return Math.hypot(a.x + a.w / 2 - W0 / 2, a.y + a.h / 2 - H0 / 3) - Math.hypot(b.x + b.w / 2 - W0 / 2, b.y + b.h / 2 - H0 / 3); })[0]];
        p._nAll = 1; p._all = main.slice();
      }
      if (p.solo) prompt += ' This is a portrait of ONE person, the person in the middle. Any other people or parts of people at the edges are removed and replaced by the background.';
      var n0 = main.length; p._main = main[0] && main[0].fake ? null : main;
      /* v215: 🦸 the hero team: each person a different hero, one at a time on the same photo (onePerson: the crop around the
         person, the design, the person laid back); someone the AI could not do stays as shot, the rest are done */
      if (/^\[TEAM\]/.test(prompt) && FS.HERO_TEAM) {
        if (n0 < 2 || main[0].fake) return guarded(p, FS.HERO_TEAM[0], engine, n0);
        var order = main.slice().sort(function (a, b) { return a.x - b.x; }), cur = orig, made = 0, lastErr = null;
        return order.reduce(function (ch, f, i) {
          return ch.then(function () {
            return onePerson(p, cur, f, main, FS.HERO_TEAM[i % FS.HERO_TEAM.length], engine).then(function (im) { cur = im; made++; }, function (e) { lastErr = e; });
          });
        }, Promise.resolve()).then(function () { if (!made) throw lastErr || new Error('ai-failed'); cur.aiTeam = made + '/' + order.length; return cur; });
      }
      if (FS.aiOnePerson() && n0 >= 2 && !main[0].fake) return pickPerson(p, main, orig).then(function (f) { return onePerson(p, orig, f, main, prompt, engine); });
      return whoIsWho(p, orig, n0, prompt).then(function (who) { return guarded(p, prompt + who, engine, n0); }).catch(function (e) {
        if (n0 > 0 && FS.aiKeepPeople() && /lost-people|extra-people|not-same/.test(String(e && e.message)) && !/caricature|oversized heads|illustration|drawing|painting|cartoon|anime|watercolou?r|sketch/i.test(prompt)) {
          if (window.console) console.warn('AI: ' + e.message + ', the real people go into a clean scene');
          return plate(p, prompt, orig);
        }
        throw e;
      });
    });
  };
  /* v210: who is who, for a look that redraws the people (a drawing, a costume): a short line per person, left to right
     (gender, age, hair, what is really on the head or face), asked once per photo from the AI that reads pictures and added
     to the design's words. A drawn style turned a young man at the edge into a woman, and moved a braid to the next person.
     Looks that keep the real faces need none. At most 20 seconds; without an answer the design goes on as before. */
  function whoIsWho(p, orig, n0, prompt) {
    if (!(n0 >= 1) || /very same people|Keep everything else exactly as it is/.test(prompt) || !FS.askServer) return Promise.resolve('');
    var key = p.origSrc || p.src; if (p._whoKey === key) return Promise.resolve(p._who || '');
    var k = Math.min(1, 640 / Math.max(orig.naturalWidth, orig.naturalHeight)), c = FS.canvas(Math.round(orig.naturalWidth * k), Math.round(orig.naturalHeight * k));
    c.getContext('2d').drawImage(orig, 0, 0, c.width, c.height);
    var ask = FS.askServer({ action: 'ai', tag: 'photo', image: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg',
      prompt: 'List every person whose face is visible in this photo, from left to right, also anyone partly cut off at the edges. One short line each: gender, rough age (child, teen, young adult, adult, older), hair (colour and length), and only what they really have on the head or face (glasses, beard, kippah, hat). Nothing else. Answer only the list, like: 1. man, about 30, short black hair, beard | 2. girl, about 8, long brown hair' })
      .then(function (r) { return r && r.ok && r.text ? String(r.text) : ''; }, function () { return ''; });
    return Promise.race([ask, new Promise(function (ok) { setTimeout(function () { ok(''); }, 20000); })]).then(function (t) {
      t = t.replace(/[\r\n]+/g, ' | ').replace(/\s+/g, ' ').replace(/[^\w\s.,|()\-:'\u0590-\u05FF]/g, '').trim().slice(0, 500);
      var who = t && /\b(man|woman|boy|girl|child|teen|baby|person)\b/i.test(t) ? ' The people of the photo, from left to right: ' + t + '. Draw each of them as exactly this person, in this order: nobody turned into someone else, no features moved between people.' : '';
      p._whoKey = key; p._who = who;
      return who;
    });
  }
  function guarded(p, prompt, engine, n0) {
    var local = FS.localAI && FS.localAI.isReady && FS.localAI.isReady(), plan = [engine];
    /* v199: online, the cloud (paid, no daily stop) answers a turned-down picture again: each call draws anew (a new random seed),
       so 3 tries on the good engine instead of 1 and then the free engine (which ignores the photo) or the slow computer.
       2 of 5 photos had stayed as shot. */
    if (FS.cloudFirst && FS.cloudFirst() && engine !== 'local') plan = [engine, engine, engine];
    else if (engine !== 'local') { plan.push(engine || 'free'); if (local) plan.push('local'); }
    p._n0 = n0;
    var orig = FS.img(p.origSrc || p.src), cover0 = null;
    function origCover() { if (cover0 == null) cover0 = FS.personCover ? FS.personCover(orig).catch(function () { return 0; }) : Promise.resolve(0); return cover0; }
    /* the faces were not found in the answer: are the people still there as people (bodies)? drawn styles and small faces fool the face finder */
    function bodiesKept(im) {
      if (!FS.personCover) return Promise.resolve(false);
      return Promise.all([origCover(), FS.personCover(im).catch(function () { return 0; })]).then(function (c) { return c[0] > 0.01 && c[1] >= Math.max(0.01, c[0] * 0.35); });
    }
    /* v161: the same people and the same picture (js/ai-guard.js, on this computer): an answer with other faces, or that is
       not the shot, is asked again from the next engine; when every engine fails, the photo keeps its original */
    /* the same faces checked closely only where the real faces are laid back (keepFaces); the whole picture only where the
       edit keeps the place ("Keep everything else"): a look that dresses the people anew or moves them elsewhere changes it */
    var photoLook = /very same people|Keep everything else exactly as it is/.test(prompt), sameScene = /Keep everything else exactly as it is/.test(prompt);
    function same(im, i) {
      if (!FS.aiCheck || !FS.aiGuardOn()) return Promise.resolve(im);
      /* the heads are the photo's own pixels, laid back where they were (keepHeads): the faces are the same by construction; the
         people count above has already been checked (v179) */
      if (im.headsKept) { im.aiPhoto = photoLook; im.aiScene = sameScene; return Promise.resolve(im); }
      return FS.aiCheck(orig, im, { photo: photoLook, scene: sameScene, loose: !photoLook && /caricature|oversized heads|chibi|cartoon/i.test(prompt), solo: !!p.solo }).then(function (r) {
        im.aiCheck = r; im.aiPhoto = photoLook; im.aiScene = sameScene; im.aiLoose = !photoLook && /caricature|oversized heads|chibi|cartoon/i.test(prompt);
        if (r.ok) return im;
        if (window.console) console.warn('AI guard: ' + r.why + ' (score ' + r.score + '), from ' + (im.aiSource || '?'));
        if (i + 1 < plan.length) return go(i + 1);
        return ask(im, false, r);
      });
    }
    function placedMiss(im) {
      var F0 = p._main, F1 = im.aiRaw;
      if (!F0 || F0.length < 2 || !F1) return 0;
      var kx = im.naturalWidth / orig.naturalWidth, used = {}, miss = 0;
      F0.forEach(function (f) {
        var cx = (f.x + f.w / 2) * kx, cy = (f.y + f.h / 2) * kx, w = f.w * kx, best = -1, bd = 1e9;
        F1.forEach(function (g, j) { if (used[j]) return; var d = Math.hypot(g.x + g.w / 2 - cx, g.y + g.h / 2 - cy), r = g.w / w; if (d < w * 0.6 && r > 0.5 && r < 2 && d < bd) { bd = d; best = j; } });
        if (best < 0) miss++; else used[best] = 1;
      });
      return miss;
    }
    function placedExtra(im) {
      var F0 = p._all, F1 = im.aiRaw && FS.posingFaces ? FS.posingFaces(im.aiRaw) : null;
      if (!F0 || !F0.length || !F1 || F0[0].fake) return 0;
      var kx = im.naturalWidth / orig.naturalWidth, used = {}, add = 0;
      F1.forEach(function (g) {
        var gx = g.x + g.w / 2, gy = g.y + g.h / 2, hit = -1;
        F0.forEach(function (f, j) { if (used[j] || hit >= 0) return; var d = Math.hypot((f.x + f.w / 2) * kx - gx, (f.y + f.h / 2) * kx - gy); if (d < Math.max(f.w * kx, g.w) * 0.8) hit = j; });
        if (hit < 0) add++; else used[hit] = 1;
      });
      return add;
    }
    function go(i) {
      return restyleOnce(p, prompt, plan[i], i).then(function (im) {
        if (!n0 || !FS.countFaces) return same(im, i);
        /* v214: a caricature (big drawn heads) is counted twice (the face finder misses drawn faces; the landmarker sees more) and
           its heads may sit a little off where the people stood: the count decides, not the exact place */
        var loose = /caricature|oversized heads|chibi|cartoon/i.test(prompt) && !/very same people|Keep everything else exactly as it is/.test(prompt);
        return FS.countFaces(im, true).catch(function () { return n0; }).then(function (n) {
          if (!loose || n >= n0 || !FS.countFacesLm) return n;
          return FS.countFacesLm(im).then(function (m) { return Math.max(n, m); }, function () { return n; });
        }).then(function (n) {
          /* v174: every person of the original must be there. Up to 5 people, exactly as many; a bigger group may lose one
             face to the finder (a turned head). Was "at least one" for one or two people, so 2 → 1 got through (owner report). */
          var nA = Math.max(n0, p._nAll || 0), lost = n0 <= 5 ? n < n0 : n < n0 - 1, extra = n > (nA <= 4 ? nA : nA + 1);   /* v183: people further back may stay; v184: never one more */
          /* v184: a big face in the answer where nobody stood in the photo is an added person (an extra woman beside a couple) */
          var add = placedExtra(im);
          if (add > (nA <= 5 ? 0 : 1)) { if (window.console) console.warn('AI: ' + add + ' added people, from ' + (im.aiSource || '?')); extra = true; }
          /* v181: in a group, every person posing must be the AI's own figure where the person stood (a face at about the same
             place and size in the raw answer), so one invented figure with real faces laid on it never passes */
          var miss = loose ? 0 : placedMiss(im);
          if (miss > (n0 <= 5 ? 0 : 1)) { if (window.console) console.warn('AI: ' + miss + ' of ' + n0 + ' people not where they stood, from ' + (im.aiSource || '?')); lost = true; n = Math.min(n, n0 - miss); }
          var bodyOk = !miss;
          if (!lost && !extra) return same(im, i);
          /* bodies instead of faces only when no face at all was found (a drawn style can hide every face); fewer faces than
             people is a person missing */
          return (lost && n === 0 && bodyOk ? bodiesKept(im) : Promise.resolve(false)).then(function (kept) {
            if (kept) return same(im, i);
            if (window.console) console.warn('AI: the answer ' + (lost ? 'lost the people' : 'added people') + ' (' + n0 + ' faces → ' + n + '), from ' + (im.aiSource || '?'));
            if (i + 1 < plan.length) return go(i + 1);
            return ask(im, lost);
          });
        });
      });
    }
    /* not sure: the owner sees the answer and decides (in a batch, it is skipped as before) */
    function ask(im, lost, chk) {
      var code = chk ? 'not-same' : lost ? 'lost-people' : 'extra-people';
      if (batch || !FS.dialog || (n0 > 0 && FS.aiKeepPeople && FS.aiKeepPeople())) return Promise.reject(new Error(code));
      return new Promise(function (ok, no) {
        var body = FS.dialog(chk ? '🛡️ העריכה לא נראית כמו המקור' : '🤔 לא בטוח שהאנשים נשמרו', '<p>' + (chk ? 'בדיקת ה־AI מצאה: <b>' + FS.esc(chk.why) + '</b> (התאמה ' + chk.score + '%). ניסיתי את כל המנועים. מומלץ לא להחיל ולהשאיר את המקור.' : lost ? 'לא זיהיתי בבירור את האנשים בתוצאה (קורה בסגנונות מצוירים ובתמונות שבהן האנשים קטנים).' : 'נראה שה־AI הוסיף אנשים לתמונה.') + ' הנה התוצאה. מחליטים בעצמכם:</p>' +
          '<img src="' + im.src + '" alt="" style="display:block;max-width:100%;max-height:58vh;margin:8px auto;border-radius:10px">' +
          '<div class="row2" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-ai-ok>✔ להחיל בכל זאת</button><button class="btn" data-ai-no>✕ לא להחיל</button></div>', true);
        var done = false, dlg = document.getElementById('dlg');
        body.querySelector('[data-ai-ok]').addEventListener('click', function () { done = true; FS.closeDialog(); ok(im); });
        body.querySelector('[data-ai-no]').addEventListener('click', function () { done = true; FS.closeDialog(); no(new Error(code)); });
        if (dlg) dlg.addEventListener('close', function () { if (!done) no(new Error(code)); }, { once: true });
      });
    }
    return go(0);
  }
  /* which person: the one picked a moment ago on this photo (the "3 versions" ask three times), the largest in a batch, or a picker */
  function pickPerson(p, faces, orig) {
    var big = faces.slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; })[0];
    if (p._aiPick && p._aiPick.at > Date.now() - 120000) return p._aiPick.p;
    var pr = batch || !FS.dialog ? Promise.resolve(big) : new Promise(function (ok, no) {
      var body = FS.dialog('👤 על מי לעשות את העיצוב?', '<p class="hint">לוחצים על האדם. רק הוא ישתנה, וכל השאר נשאר כמו בצילום.</p><div class="ai-pick" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></div>');
      var box = body.querySelector('.ai-pick'), done = false, dlg = document.getElementById('dlg');
      faces.forEach(function (f) {
        var m = f.w * 0.5, x = Math.max(0, f.x - m), y = Math.max(0, f.y - m), w = Math.min(orig.naturalWidth - x, f.w + 2 * m), h = Math.min(orig.naturalHeight - y, f.h + 2 * m);
        var c = FS.canvas(140, Math.round(140 * h / w)); c.getContext('2d').drawImage(orig, x, y, w, h, 0, 0, c.width, c.height);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.style.cssText = 'padding:6px;border-radius:14px'; c.style.cssText = 'display:block;border-radius:10px'; b.appendChild(c);
        b.addEventListener('click', function () { done = true; FS.closeDialog(); ok(f); }); box.appendChild(b);
      });
      if (dlg) dlg.addEventListener('close', function () { if (!done) no(new Error('cancelled')); }, { once: true });
    });
    p._aiPick = { p: pr, at: Date.now() }; pr.catch(function () { p._aiPick = null; });
    return pr;
  }
  function onePerson(p, orig, f, main, prompt, engine) {
    var W = orig.naturalWidth, H = orig.naturalHeight;
    var x0 = Math.max(0, Math.round(f.x + f.w / 2 - f.w * 1.8)), y0 = Math.max(0, Math.round(f.y - f.h * 0.9));
    var w = Math.min(W - x0, Math.round(f.w * 3.6)), h = Math.min(H - y0, Math.round(f.h * 7.5));
    var crop = FS.canvas(w, h); crop.getContext('2d').drawImage(orig, x0, y0, w, h, 0, 0, w, h);
    return new Promise(function (ok) { crop.toBlob(function (bl) { ok(FS.loadImg(URL.createObjectURL(bl))); }, 'image/jpeg', 0.95); }).then(function (cim) {
      /* neighbours partly inside the crop are counted, and told to stay as they are; only the middle person is taken back */
      var inCrop = main.filter(function (g) { var cx = g.x + g.w / 2, cy = g.y + g.h / 2; return cx > x0 && cx < x0 + w && cy > y0 && cy < y0 + h; }).length || 1;
      var one = { src: cim.src, doc: p.doc, faces: [{ x: f.x - x0, y: f.y - y0, w: f.w, h: f.h }] };
      var pr = prompt + (inCrop > 1 ? ' Change only the person in the middle of the picture; the other people partly in the picture stay exactly as they are.' : '');
      return guarded(one, pr, engine, inCrop).then(function (res) {
        var tmp = { src: res.src };
        return FS.ensureMask(tmp).then(function (m) {
          var out = FS.canvas(W, H), x = out.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(orig, 0, 0, W, H);
          var pc = FS.canvas(w, h), px = pc.getContext('2d', { willReadFrequently: true }); px.drawImage(res, 0, 0, w, h);
          var mc = FS.canvas(w, h), mx = mc.getContext('2d', { willReadFrequently: true }); mx.drawImage(m, 0, 0, w, h);
          var md = mx.getImageData(0, 0, w, h).data, id = px.getImageData(0, 0, w, h), e = Math.max(6, Math.round(Math.min(w, h) * 0.04)), fc = f.x + f.w / 2 - x0;
          /* the border with each neighbour: halfway between the two faces (a neighbour beside the person, not above or below) */
          var lo = -1e9, hi = 1e9, fe = f.w * 0.12;
          main.forEach(function (g) { if (g === f || Math.abs((g.y + g.h / 2) - (f.y + f.h / 2)) > f.h * 2.5) return; var gc = g.x + g.w / 2 - x0, mid = (gc + fc) / 2; if (gc < fc) lo = Math.max(lo, mid); else hi = Math.min(hi, mid); });
          for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
            /* the person's mask, faded near the crop's edges (unless the edge is the photo's own edge) */
            var k = Math.min(1, (x0 + xx > 0 && xx < e ? xx / e : 1), (x0 + w < W && w - 1 - xx < e ? (w - 1 - xx) / e : 1), (y0 + yy > 0 && yy < e ? yy / e : 1), (y0 + h < H && h - 1 - yy < e ? (h - 1 - yy) / e : 1));
            /* and only around the chosen person: full within 1.6 face widths of the face's centre, gone by 2.2 */
            var dx = Math.abs(xx - fc) / f.w, kx = dx <= 1.6 ? 1 : dx >= 2.2 ? 0 : (2.2 - dx) / 0.6;
            kx = Math.min(kx, Math.max(0, Math.min(1, (xx - lo) / fe + 0.5)), Math.max(0, Math.min(1, (hi - xx) / fe + 0.5)));
            var i = (yy * w + xx) * 4; id.data[i + 3] = md[i] * Math.min(k, kx);
          }
          px.putImageData(id, 0, 0); x.drawImage(pc, x0, y0);
          return new Promise(function (ok) { out.toBlob(function (bl) { ok(FS.loadImg(URL.createObjectURL(bl))); }, 'image/jpeg', 0.94); });
        }).then(function (im) { im.aiSource = res.aiSource; return im; });
      });
    });
  }
  function restyleOnce(p, prompt, engine, tryN) {
    var orig = FS.img(p.origSrc || p.src), ar = orig.naturalWidth / orig.naturalHeight, src = '', raw = null;
    if (engine === undefined) engine = FS.aiEngine();
    prompt += ' The output image must have the same ' + (ar > 1.05 ? 'landscape' : ar < 0.95 ? 'portrait' : 'square') + ' aspect ratio (' + orig.naturalWidth + 'x' + orig.naturalHeight + ').';
    var faces = p._n0 != null ? p._n0 : (p.faces ? p.faces.length : 0);
    /* the people in the photo, by count: one person stays one person (the models like to add a partner or a figure) */
    if (faces === 1) prompt = prompt.replace(/\b(each|every) person\b/gi, 'the person').replace(/\bthe people\b/gi, 'the person').replace(/\beveryone\b/gi, 'the person') +
      ' There is exactly ONE person in this photo. The result must show only this one person: do not add any other person, partner, figure, silhouette, reflection or face.';
    if (faces >= 2) prompt += ' Keep every person of the photo, also anyone at the edges or partly cut off by the frame: they stay where they are, cut off the same way. Only a far-away blurry crowd in the deep background may become scenery.';
    if (faces >= 2 && /\bportrait\b/i.test(prompt)) prompt = prompt.replace(/\bportrait\b/i, 'group portrait') + ' The group portrait shows all ' + faces + ' people of the photo, each one as themselves, side by side where they stand; never one figure.';
    if (faces === 1) { /* above */ }
    else if (faces) prompt += ' There are exactly ' + faces + ' people in the photo. The result must show exactly these ' + faces + ' people: do not add or remove anyone, no extra figures or faces. Each person keeps their own age, gender, face, hair and clothes: never mix features between people.';
    prompt += ' No Christmas trees or Christmas decorations.';   /* v214: Israeli events (a brit came back with Christmas trees behind) */
    prompt += ' High-end professional result: the face sharp, well lit and fully visible (never covered by a mask, hood or shadow), rich true-to-life detail, clean cinematic colour grading, like a magazine cover or a big-budget film still.';
    /* 🧍 the real people kept (v173, on by default): the AI makes only the world around them, and the people of the photo are
       laid back over it, cut out on this computer. Models redraw faces, and in a group they swap people; this way every face
       and every person stays the one in the photo. */
    var keepPpl = false;   /* v177: the real people go into a clean scene only as the fallback (plate below), never over the AI's own figures */
    var L = 1024, w = ar >= 1 ? L : Math.round(L * ar / 16) * 16, h = ar >= 1 ? Math.round(L / ar / 16) * 16 : L;
    /* FLUX gets the same 1024px photo (compared Oct 26, frame-ai-compare.yml: from a 496px copy it drew new faces; from 1024 it keeps the people) */
    if (prompt.length > 3900) prompt = prompt.replace(/ High-end professional result:[^.]*\./, '').slice(0, 3900);   /* the server takes 4000 */
    var b64 = photoB64(p, 1024), body = { action: 'restyle', prompt: prompt, image: b64, small: b64, mime: 'image/jpeg', w: w, h: h };
    if (engine) body.engine = engine;
    /* v210: a design turned down (a person missing, added or changed) is drawn again by a bigger FLUX on the server: the 9B,
       then dev, which hold every person better (a man at the edge of a bar mitzvah photo was dropped three times by the 4B) */
    if (tryN >= 1 && engine !== 'local') body.fluxModel = tryN === 1 ? 'klein-9b' : 'dev';
    return FS.askServer(body).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error(r && r.error || 'ai-failed');
      src = r.source || (engine === 'local' ? 'מקומי' : '');
      var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' })));
    }).then(function (res) { return matchShape(res, orig, /pollinations/i.test(src) ? 0.06 : 0); }).then(function (im) {
      /* v181: the AI's own figures, before any real face or head is laid in: the people check reads these (a real face pasted
         on one invented figure made 2 → 2 look right) */
      return (FS.detectFaces ? FS.detectFaces(im).catch(function () { return null; }) : Promise.resolve(null)).then(function (f) { raw = f; return im; });
    }).then(function (im) {
      /* looks that must stay a photograph of the same people: the real faces are laid back in (js/face-keep.js, on this computer) */
      if (!/very same people|Keep everything else exactly as it is/.test(prompt)) return im;
      var faceKeep = function () { return FS.keepFaces ? FS.keepFaces(orig, im).then(function (k) { return k || im; }, function () { return im; }) : im; };
      if (!(faces > 0) || /Keep everything else exactly as it is/.test(prompt)) return faceKeep();
      return keepHeads(orig, im).then(function (h) { return h || faceKeep(); });
    }).then(function (im) { return keepPpl ? keepPeople(orig, im) : FS.aiOnlyPerson() ? onlyPerson(orig, im) : im; })
      .then(function (im) { return crisp(im, orig, /very same people|Keep everything else exactly as it is/.test(prompt)).catch(function () { return im; }); })
      .then(function (im) { im.aiSource = src; im.aiRaw = raw; return im; });
  };
  /* sharp enough to print (v163): the engines answer at about 1024px and the picture is enlarged to the photo's size (up to
     3000px), which looked soft on a 15×20 print. Two steps on the enlarged picture:
     - where the look keeps the photograph (the same people, the same place), the fine detail of the original (the original
       minus its own blur: skin, eyes, hair, lace) is added back wherever the AI picture still matches it in light (a mask made
       on an eighth-size copy, soft), so new clothes or a new place get none of the old detail;
     - then an unsharp mask of the size of the enlargement, so edges are clean and not haloed.
     'fs-ai-crisp' = '0' turns it off. */
  /* never a reason for a design to fail: any error (a phone out of memory on a big picture) leaves the enlarged picture as is.
     On a phone or a small computer (≤ 4 GB) the work is kept to about 4 megapixels, where it is safe. */
  function crisp(im, orig, keep) {
    try { return crisp0(im, orig, keep).catch(function (e) { if (window.console) console.warn('crisp', e); return im; }); }
    catch (e) { if (window.console) console.warn('crisp', e); return Promise.resolve(im); }
  }
  function crisp0(im, orig, keep) {
    try { if (localStorage.getItem('fs-ai-crisp') === '0') return Promise.resolve(im); } catch (e) { /* on */ }
    var W = im.naturalWidth, H = im.naturalHeight, up = Math.max(W, H) / 1024;
    if (up < 1.25) return Promise.resolve(im);
    var small = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (W * H > (small ? 4.2e6 : 9.5e6)) return Promise.resolve(im);
    var c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    var R = x.getImageData(0, 0, W, H), r = R.data;
    function blurred(src, rad) { var b = FS.canvas(W, H), bx = b.getContext('2d', { willReadFrequently: true }); bx.filter = 'blur(' + rad.toFixed(2) + 'px)'; bx.drawImage(src, 0, 0, W, H); return bx.getImageData(0, 0, W, H).data; }
    var br = blurred(im, Math.max(0.8, up * 0.55)), i, k;
    if (keep) {
      var oc = FS.canvas(W, H), ox = oc.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingQuality = 'high'; ox.drawImage(orig, 0, 0, W, H);
      var O = ox.getImageData(0, 0, W, H).data, bo = blurred(oc, Math.max(0.8, up * 0.7));
      /* where the AI picture still looks like the photo: eighth-size light compared, then laid back soft over the whole size */
      var sw = Math.max(8, Math.round(W / 8)), sh = Math.max(8, Math.round(H / 8)), a = FS.canvas(sw, sh), ax = a.getContext('2d', { willReadFrequently: true }), b2 = FS.canvas(sw, sh), bx2 = b2.getContext('2d', { willReadFrequently: true });
      ax.drawImage(orig, 0, 0, sw, sh); bx2.drawImage(im, 0, 0, sw, sh);
      var la = ax.getImageData(0, 0, sw, sh).data, lb = bx2.getImageData(0, 0, sw, sh).data, mc = FS.canvas(sw, sh), mx = mc.getContext('2d'), md = mx.createImageData(sw, sh);
      for (i = 0; i < la.length; i += 4) {
        var d = Math.abs((la[i] * .3 + la[i + 1] * .59 + la[i + 2] * .11) - (lb[i] * .3 + lb[i + 1] * .59 + lb[i + 2] * .11)) + (Math.abs(la[i] - lb[i]) + Math.abs(la[i + 2] - lb[i + 2])) * 0.25;
        var m = Math.max(0, Math.min(1, 1 - (d - 10) / 30)); md.data[i] = md.data[i + 1] = md.data[i + 2] = Math.round(m * 255); md.data[i + 3] = 255;
      }
      mx.putImageData(md, 0, 0);
      var big = FS.canvas(W, H), gx = big.getContext('2d', { willReadFrequently: true }); gx.imageSmoothingQuality = 'high'; gx.filter = 'blur(' + Math.max(2, up * 3).toFixed(1) + 'px)'; gx.drawImage(mc, 0, 0, W, H);
      var M = gx.getImageData(0, 0, W, H).data;
      for (i = 0; i < r.length; i += 4) { var mm = M[i] / 255 * 0.85; if (mm < 0.02) continue; for (k = 0; k < 3; k++) r[i + k] = r[i + k] + (O[i + k] - bo[i + k]) * mm * 0.8; }
    }
    var amt = keep ? Math.min(0.25, 0.08 + (up - 1) * 0.06) : Math.min(0.9, 0.35 + (up - 1) * 0.25);   /* with the original's detail back, only a touch */
    for (i = 0; i < r.length; i += 4) for (k = 0; k < 3; k++) { var v = r[i + k] + (r[i + k] - br[i + k]) * amt; r[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
    x.putImageData(R, 0, 0);
    return new Promise(function (ok) { c.toBlob(function (bl) { ok(bl ? FS.loadImg(URL.createObjectURL(bl)) : im); }, 'image/jpeg', 0.95); }).then(function (o) { if (im.facesKept) o.facesKept = im.facesKept; if (im.headsKept) o.headsKept = true; return o; });
  }
  /* 🧍 v177: when the AI did not keep every person posing (lost, added, or other faces), the design still comes out: the AI
     draws only the place of the look, empty of people (a new picture from the words, cheap and quick), and the people of the
     photo are laid into it (keepPeople). The faces and the people are the photo's own; nothing of the AI's figures is left. */
  function plate(p, prompt, orig) {
    var W0 = orig.naturalWidth, H0 = orig.naturalHeight, ar = W0 / H0, L = 1024, w = ar >= 1 ? L : Math.round(L * ar / 16) * 16, h = ar >= 1 ? Math.round(L / ar / 16) * 16 : L;
    /* the place of the look, without its people: the look's first sentence, the words about people and what they wear taken out */
    var look = String(prompt).split(/ IMPORTANT:| Original designs only| This must stay| Original costume design| Keep everything else| The output image| There (is|are) exactly| Remove every bystander/)[0];
    var place = look.replace(/\b(dress|make|show|place|give|turn|surround)\b[^,.;]*?\b(person|people|child|children|couple|everyone|them)\b[^,.;]*[,.;]?/gi, ' ')
      .replace(/\b(each|every)\s+(person|child)\b|\bthe\s+(people|person|couple|children|child)\b|\b(they|them|their|his|her)\b/gi, ' ')
      .replace(/\b(suit|suits|dress|dresses|gown|costume|outfit|armou?r|cape|hands?|face|faces|wearing|holding|riding)\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
    var ask = function (extra) {
      return FS.askServer({ action: 'image', prompt: 'An empty place, a background plate for a photo, with absolutely no people, no person, no face, no body, no hands and no character anywhere in it' + (place ? ': ' + place : '') + '. ' + (extra || '') + 'Photorealistic, cinematic light, rich detail, open and clear in the middle.', w: w, h: h }).then(function (r) {
        if (!r || !r.ok || !r.image) throw new Error(r && r.error || 'ai-failed');
        var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' }))).then(function (res) { res.aiSource = r.source || ''; return res; });
      });
    };
    var src = '';
    /* a place with a drawn person in it is asked once more; a second one is not used (the photo stays as shot) */
    var clean = function (res) { return FS.countFaces ? FS.countFaces(res, true).catch(function () { return 0; }) : Promise.resolve(0); };
    return ask().then(function (res) {
      return clean(res).then(function (n) { if (!n) return res; if (window.console) console.warn('AI plate: ' + n + ' drawn people, asked again'); return ask('Nobody at all: only the place. ').then(function (r2) { return clean(r2).then(function (n2) { if (n2) throw new Error('not-same'); return r2; }); }); });
    }).then(function (res) { src = res.aiSource; return matchShape(res, orig, /pollinations/i.test(src) ? 0.06 : 0); })
      .then(function (im) { return keepGround(orig, im); })
      .then(function (im) {
        if (!im._peopleLaid) throw new Error('not-same');   /* never the place alone */
        return crisp(im, orig, true).catch(function () { return im; });
      })
      .then(function (im) { im.aiSource = src; im.aiPlate = true; im.headsKept = true; return im; });
  }
  /* v183: the plate goes only behind the people. Everything of the photo from the top of the people down (the people, the
     table they sit at, the chairs, the floor in front) stays where it was; the AI's place replaces what is above and behind
     them (walls, curtains, windows, ceiling). The line is the top of the people in each column (the person mask), smoothed,
     and between people the lower of the neighbours, so a head is never cut; the seam is soft. The kept part takes a little of
     the new place's colour so it sits in it. Was: the people cut out alone into the place, so a table group floated. */
  function keepGround(orig, im) {
    var tmp = { src: orig.src, doc: null }, faces = null;
    var det = FS.detectFaces ? FS.detectFaces(orig).then(function (l) { faces = FS.mainFaces ? FS.mainFaces(l) : l; }, function () {}) : Promise.resolve();
    return det.then(function () { return FS.ensureMask(tmp); }).then(function (m) {
      if (!m || (tmp.maskCover || 0) < 0.02) return im;
      var W = im.naturalWidth, H = im.naturalHeight, q = Math.max(1, Math.round(Math.max(W, H) / 400)), w = Math.ceil(W / q), h = Math.ceil(H / q);
      var sc = FS.canvas(w, h), sx = sc.getContext('2d', { willReadFrequently: true }); sx.drawImage(m, 0, 0, w, h);
      var md = sx.getImageData(0, 0, w, h).data, top = new Float32Array(w), x, y, any = 0;
      for (x = 0; x < w; x++) { top[x] = -1; for (y = 0; y < h; y++) if (md[(y * w + x) * 4] > 110) { top[x] = y; any++; break; } }
      if (any < w * 0.05) return im;
      /* columns without a person: the lower of the nearest people's tops on each side (the table between them stays) */
      var tops = Array.prototype.filter.call(top, function (v) { return v >= 0; }).sort(function (a, b) { return a - b; }), med = tops[tops.length >> 1];
      var L = new Float32Array(w), R = new Float32Array(w), last = -1;
      for (x = 0; x < w; x++) { if (top[x] >= 0) last = top[x]; L[x] = last; }
      last = -1; for (x = w - 1; x >= 0; x--) { if (top[x] >= 0) last = top[x]; R[x] = last; }
      var cut = new Float32Array(w);
      for (x = 0; x < w; x++) cut[x] = top[x] >= 0 ? top[x] : Math.max(L[x] < 0 ? med : L[x], R[x] < 0 ? med : R[x]);
      /* v184: the line never goes deeper than the heads: the top of the hair of the faces (from left to right, joined straight
         between them, flat past the ends). A column with only a hand or legs low in it (between people at a table) made a
         deep notch, and the place showed through the table. */
      if (faces && faces.length) {
        var kq = W / orig.naturalWidth / q, hd = faces.map(function (f) { return { x: (f.x + f.w / 2) * kq, y: (f.y - f.h * 0.55) * kq }; }).sort(function (a, b) { return a.x - b.x; });
        for (x = 0; x < w; x++) {
          var ly;
          if (x <= hd[0].x) ly = hd[0].y; else if (x >= hd[hd.length - 1].x) ly = hd[hd.length - 1].y;
          else for (var t = 0; t < hd.length - 1; t++) if (x >= hd[t].x && x <= hd[t + 1].x) { ly = hd[t].y + (hd[t + 1].y - hd[t].y) * (x - hd[t].x) / Math.max(1, hd[t + 1].x - hd[t].x); break; }
          cut[x] = Math.min(cut[x], Math.max(0, ly));
        }
      } else { for (x = 0; x < w; x++) cut[x] = Math.min(cut[x], med + h * 0.08); }
      /* never above a head: the smallest within a few columns, then a soft smoothing */
      var r = Math.max(2, Math.round(w * 0.02)), c2 = new Float32Array(w);
      for (x = 0; x < w; x++) { var mn = 1e9; for (var k = -r; k <= r; k++) { var xx = Math.min(w - 1, Math.max(0, x + k)); mn = Math.min(mn, cut[xx]); } c2[x] = mn; }
      for (x = 0; x < w; x++) { var s0 = 0, n0 = 0; for (k = -r; k <= r; k++) { xx = Math.min(w - 1, Math.max(0, x + k)); s0 += c2[xx]; n0++; } cut[x] = Math.min(c2[x], s0 / n0); }
      var feather = Math.max(2, h * 0.035), kc = FS.canvas(w, h), kx = kc.getContext('2d'), kd = kx.createImageData(w, h);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var a = Math.max(0, Math.min(1, (y - (cut[x] - feather * 1.5)) / feather)), pv = md[(y * w + x) * 4] / 255;
        var v = Math.max(a, pv); kd.data[(y * w + x) * 4] = kd.data[(y * w + x) * 4 + 1] = kd.data[(y * w + x) * 4 + 2] = 255; kd.data[(y * w + x) * 4 + 3] = Math.round(v * 255);
      }
      kx.putImageData(kd, 0, 0);
      var c = FS.canvas(W, H), cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
      var oc = FS.canvas(W, H), ox = oc.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingQuality = 'high'; ox.drawImage(orig, 0, 0, W, H);
      var big = FS.canvas(W, H), bx = big.getContext('2d', { willReadFrequently: true }); bx.imageSmoothingQuality = 'high'; bx.drawImage(kc, 0, 0, W, H);
      var A = bx.getImageData(0, 0, W, H).data, O = ox.getImageData(0, 0, W, H), od = O.data, P = cx.getImageData(0, 0, W, H).data, i, j;
      /* a little of the place's colour on the kept part (its average against the kept part's average) */
      var sa = [0, 0, 0], sb = [0, 0, 0], na = 0, nb = 0;
      for (i = 0; i < od.length; i += 32) { if (A[i + 3] > 200) { for (j = 0; j < 3; j++) sa[j] += od[i + j]; na++; } else if (A[i + 3] < 40) { for (j = 0; j < 3; j++) sb[j] += P[i + j]; nb++; } }
      var sh = [0, 0, 0];
      if (na && nb) { var la = 0, lb = 0; for (j = 0; j < 3; j++) { sa[j] /= na; sb[j] /= nb; la += sa[j] / 3; lb += sb[j] / 3; } for (j = 0; j < 3; j++) sh[j] = ((sb[j] - lb) - (sa[j] - la)) * 0.25 + (lb - la) * 0.1; }
      for (i = 0; i < od.length; i += 4) { for (j = 0; j < 3; j++) od[i + j] = od[i + j] + sh[j]; od[i + 3] = A[i + 3]; }
      ox.putImageData(O, 0, 0); cx.drawImage(oc, 0, 0);
      return new Promise(function (ok) { c.toBlob(function (b) { ok(b ? FS.loadImg(URL.createObjectURL(b)) : im); }, 'image/jpeg', 0.94); }).then(function (o) { if (o !== im) o._peopleLaid = true; return o; });
    }).catch(function (e) { if (window.console) console.warn('keepGround', e); return im; });
  }
  /* 👔 v179: new clothes, real heads. The AI dressed the people (and changed the place); the heads of the photo (hair and face,
     cut by the multiclass model, not moved, not stretched) are laid back exactly where they were. Only when the AI kept the
     people where they stood: the people's outlines must overlap (IoU ≥ 0.55), else null and the design goes on as before. */
  function keepHeads(orig, im) {
    if (!FS.peopleParts) return Promise.resolve(null);
    return Promise.all([FS.peopleParts(orig, 512), FS.peopleParts(im, 512)]).then(function (pp) {
      var A = pp[0], B = pp[1]; if (!A || !B) return null;
      /* the same grid for both: B is read at A's size */
      var inter = 0, uni = 0, i, x0, y0;
      for (y0 = 0; y0 < A.h; y0++) for (x0 = 0; x0 < A.w; x0++) {
        i = y0 * A.w + x0; var j = Math.min(B.h - 1, Math.round(y0 * B.h / A.h)) * B.w + Math.min(B.w - 1, Math.round(x0 * B.w / A.w));
        var a = A.person[i] > 0.5, b = B.person[j] > 0.5; if (a && b) inter++; if (a || b) uni++;
      }
      var iou = uni ? inter / uni : 0;
      if (iou < 0.55) { if (window.console) console.warn('keepHeads: the people moved (IoU ' + iou.toFixed(2) + ')'); return null; }
      /* and each face posing stands where it stood: a face in the answer at the same place and about the same size, for every
         face of the photo (else a head would be laid on someone else's body) */
      if (!FS.detectFaces) return null;
      return Promise.all([FS.detectFaces(orig), FS.detectFaces(im)]).then(function (ff) {
        var F0 = FS.mainFaces(ff[0]), F1 = ff[1], kx = (im.naturalWidth) / (orig.naturalWidth), used = {};
        if (!F0.length) return null;
        var all = F0.every(function (f) {
          var cx = (f.x + f.w / 2) * kx, cy = (f.y + f.h / 2) * kx, w = f.w * kx;
          for (var j = 0; j < F1.length; j++) { if (used[j]) continue; var g = F1[j], d = Math.hypot(g.x + g.w / 2 - cx, g.y + g.h / 2 - cy), r = g.w / w; if (d < w * 0.35 && r > 0.7 && r < 1.4) { used[j] = 1; return true; } }
          return false;
        });
        if (!all) { if (window.console) console.warn('keepHeads: a face is not where it was'); return null; }
        return pasteHeads();
      });
      function pasteHeads() {
      /* v188: the head is part of the design, not a cut-out: the face fully, the hair a little less (its edge is the AI's, so
         no halo of the old background around it), the mask pulled in a touch and soft; and the head takes the design's light
         and colour (its colours brought most of the way to the AI's own head at the same place, as face-keep.js does) */
      var W = im.naturalWidth, H = im.naturalHeight, mc = FS.canvas(A.w, A.h), mx = mc.getContext('2d'), md = mx.createImageData(A.w, A.h), any = 0;
      var F = A.face || A.head, Hr = A.hair || null;
      for (i = 0; i < A.head.length; i++) {
        var f = F[i] > 0.4 ? 1 : F[i] / 0.4, hr = Hr ? (Hr[i] > 0.5 ? 1 : Hr[i] / 0.5) * 0.85 : 0, v = Math.round(Math.max(f, hr) * 255);
        md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; if (v > 200) any++;
      }
      if (any < A.head.length * 0.002) return null;
      mx.putImageData(md, 0, 0);
      /* pulled in by about a pixel of the mask grid (the hair's outer edge carries the old background), then soft */
      var er = FS.canvas(A.w, A.h), ex = er.getContext('2d'); ex.filter = 'blur(1px)'; ex.drawImage(mc, 0, 0);
      var ed = ex.getImageData(0, 0, A.w, A.h); for (i = 0; i < ed.data.length; i += 4) { var e2 = Math.max(0, (ed.data[i] - 70) / 185 * 255); ed.data[i] = ed.data[i + 1] = ed.data[i + 2] = e2; } ex.putImageData(ed, 0, 0);
      var big = FS.canvas(W, H), bx = big.getContext('2d', { willReadFrequently: true }); bx.imageSmoothingQuality = 'high';
      bx.filter = 'blur(' + Math.max(2, Math.round(Math.max(W, H) / 320)) + 'px)'; bx.drawImage(er, 0, 0, W, H);
      var M = bx.getImageData(0, 0, W, H).data;
      var c = FS.canvas(W, H), cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
      var oc = FS.canvas(W, H), ox = oc.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingQuality = 'high'; ox.drawImage(orig, 0, 0, W, H);
      var O = ox.getImageData(0, 0, W, H), od = O.data, R = cx.getImageData(0, 0, W, H).data, k;
      /* the design's light on the head: mean and spread of each colour, the photo's head against the AI's head */
      var S0 = [0, 0, 0], Q0 = [0, 0, 0], S1 = [0, 0, 0], Q1 = [0, 0, 0], nn = 0;
      for (i = 0; i < od.length; i += 16) { if (M[i] < 200) continue; for (k = 0; k < 3; k++) { S0[k] += od[i + k]; Q0[k] += od[i + k] * od[i + k]; S1[k] += R[i + k]; Q1[k] += R[i + k] * R[i + k]; } nn++; }
      if (nn > 50) {
        var mu0 = [], sd0 = [], mu1 = [], sd1 = [];
        for (k = 0; k < 3; k++) { mu0[k] = S0[k] / nn; mu1[k] = S1[k] / nn; sd0[k] = Math.sqrt(Math.max(1, Q0[k] / nn - mu0[k] * mu0[k])); sd1[k] = Math.sqrt(Math.max(1, Q1[k] / nn - mu1[k] * mu1[k])); }
        /* the spread only partly (the AI's head may be flat), the light and colour mostly */
        for (i = 0; i < od.length; i += 4) { if (!M[i]) continue; for (k = 0; k < 3; k++) { var v0 = od[i + k], sp = sd0[k] * (1 + (sd1[k] / sd0[k] - 1) * 0.35), t = (v0 - mu0[k]) / sd0[k] * sp + mu1[k]; od[i + k] = v0 + (t - v0) * 0.72; } }
      }
      for (i = 0; i < od.length; i += 4) od[i + 3] = M[i];
      ox.putImageData(O, 0, 0); cx.drawImage(oc, 0, 0);
      return new Promise(function (ok) { c.toBlob(function (b) { ok(b ? FS.loadImg(URL.createObjectURL(b)) : null); }, 'image/jpeg', 0.95); })
        .then(function (r) { if (r) r.headsKept = true; return r; });
      }
    }).catch(function (e) { if (window.console) console.warn('keepHeads', e); return null; });
  }
  FS._keepHeads = keepHeads;
  FS.aiKeepPeople = function (v) { try { if (v !== undefined) localStorage.setItem('fs-ai-keep-people', v ? '1' : '0'); return localStorage.getItem('fs-ai-keep-people') !== '0'; } catch (e) { return true; } };
  /* the people of the original over the AI's world: the person mask of the original (on this computer), soft at the edge, and
     their colours brought a third of the way to the new scene's light, so they sit in it rather than look pasted */
  function keepPeople(orig, im) {
    var tmp = { src: orig.src, doc: null }, subj = [];
    /* only the people posing are laid back (v175): the area of each of their faces, down to the bottom of the picture; people
       behind them stay out and go with the old background */
    var det = FS.detectFaces ? FS.detectFaces(orig).then(function (all) { subj = FS.posingFaces ? FS.posingFaces(all) : FS.mainFaces ? FS.mainFaces(all) : all; }, function () {}) : Promise.resolve();
    return det.then(function () { return FS.ensureMask(tmp); }).then(function (m) {
      if (!m || (tmp.maskCover || 0) < 0.02) return im;
      im._peopleLaid = false;
      var W = im.naturalWidth, H = im.naturalHeight, c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H);
      var pc = FS.canvas(W, H), px = pc.getContext('2d', { willReadFrequently: true }); px.imageSmoothingQuality = 'high'; px.drawImage(orig, 0, 0, W, H);
      var mc = FS.canvas(W, H), mx = mc.getContext('2d', { willReadFrequently: true }); mx.imageSmoothingQuality = 'high'; mx.filter = 'blur(' + Math.max(1, Math.round(Math.max(W, H) / 900)) + 'px)'; mx.drawImage(m, 0, 0, W, H);
      var P = px.getImageData(0, 0, W, H), pd = P.data, md = mx.getImageData(0, 0, W, H).data, rd = x.getImageData(0, 0, W, H).data, i, k;
      var A = [0, 0, 0], B = [0, 0, 0], na = 0, nb = 0;
      for (i = 0; i < pd.length; i += 16) { if (md[i] > 160) { A[0] += pd[i]; A[1] += pd[i + 1]; A[2] += pd[i + 2]; na++; } else if (md[i] < 40) { B[0] += rd[i]; B[1] += rd[i + 1]; B[2] += rd[i + 2]; nb++; } }
      if (na && nb) { var O = [0, 0, 0]; for (k = 0; k < 3; k++) { A[k] /= na; B[k] /= nb; } var la = (A[0] + A[1] + A[2]) / 3, lb = (B[0] + B[1] + B[2]) / 3;
        for (k = 0; k < 3; k++) O[k] = ((B[k] - lb) - (A[k] - la)) * 0.3 + (lb - la) * 0.15;   /* a third of the scene's colour cast, a little of its light */
        for (i = 0; i < pd.length; i += 4) { if (!md[i]) continue; for (k = 0; k < 3; k++) pd[i + k] = pd[i + k] + O[k]; } }
      /* the people posing: the pieces of the person mask that hold one of their faces (connected pieces, on a quarter-size
         copy); a person standing apart behind them is another piece and stays out. Without a face found, everyone stays. */
      var keepA = null;
      if (subj.length) {
        var q4 = 4, w4 = Math.ceil(W / q4), h4 = Math.ceil(H / q4), lab = new Int32Array(w4 * h4), on = new Uint8Array(w4 * h4), xx, yy, j;
        for (yy = 0; yy < h4; yy++) for (xx = 0; xx < w4; xx++) { var mi = (Math.min(H - 1, yy * q4) * W + Math.min(W - 1, xx * q4)) * 4; on[yy * w4 + xx] = md[mi] > 90 ? 1 : 0; }
        var comp = 0, stack = [];
        for (j = 0; j < on.length; j++) {
          if (!on[j] || lab[j]) continue; comp++; lab[j] = comp; stack.push(j);
          while (stack.length) { var c0 = stack.pop(), cx0 = c0 % w4, cy0 = (c0 / w4) | 0;
            if (cx0 > 0 && on[c0 - 1] && !lab[c0 - 1]) { lab[c0 - 1] = comp; stack.push(c0 - 1); }
            if (cx0 < w4 - 1 && on[c0 + 1] && !lab[c0 + 1]) { lab[c0 + 1] = comp; stack.push(c0 + 1); }
            if (cy0 > 0 && on[c0 - w4] && !lab[c0 - w4]) { lab[c0 - w4] = comp; stack.push(c0 - w4); }
            if (cy0 < h4 - 1 && on[c0 + w4] && !lab[c0 + w4]) { lab[c0 + w4] = comp; stack.push(c0 + w4); } }
        }
        var sx = W / (orig.naturalWidth || W), sy = H / (orig.naturalHeight || H), want = {};
        subj.forEach(function (f) {   /* a few points inside each face: the piece under them is kept */
          for (var a1 = 0.25; a1 <= 0.75; a1 += 0.25) for (var b1 = 0.3; b1 <= 0.9; b1 += 0.3) {
            var fx = Math.floor((f.x + f.w * a1) * sx / q4), fy = Math.floor((f.y + f.h * b1) * sy / q4);
            if (fx >= 0 && fy >= 0 && fx < w4 && fy < h4 && lab[fy * w4 + fx]) want[lab[fy * w4 + fx]] = 1;
          }
        });
        if (Object.keys(want).length) {
          var kc = FS.canvas(w4, h4), kx = kc.getContext('2d'), kd = kx.createImageData(w4, h4);
          for (j = 0; j < lab.length; j++) { var v = want[lab[j]] ? 255 : 0; kd.data[j * 4] = kd.data[j * 4 + 1] = kd.data[j * 4 + 2] = v; kd.data[j * 4 + 3] = 255; }
          kx.putImageData(kd, 0, 0);
          var KC = FS.canvas(W, H), KX = KC.getContext('2d', { willReadFrequently: true }); KX.imageSmoothingQuality = 'high'; KX.filter = 'blur(' + q4 + 'px)'; KX.drawImage(kc, 0, 0, W, H);
          keepA = KX.getImageData(0, 0, W, H).data;
        }
      }
      for (var ii = 0; ii < pd.length; ii += 4) { var mv = md[ii]; pd[ii + 3] = !mv ? 0 : keepA ? Math.min(mv, Math.min(255, keepA[ii] * 1.4)) : mv; }
      px.putImageData(P, 0, 0); x.drawImage(pc, 0, 0);
      return new Promise(function (ok) { c.toBlob(function (b) { ok(b ? FS.loadImg(URL.createObjectURL(b)) : im); }, 'image/jpeg', 0.94); }).then(function (o) { if (o !== im) o._peopleLaid = true; return o; });
    }).catch(function (e) { if (window.console) console.warn('keepPeople', e); return im; });
  }
  /* "only on the person" ('fs-ai-only'): the AI's person is laid over the original photo, so the background, the place and
     everyone else stay exactly as they were (the person mask of the answer, on this computer) */
  FS.aiOnlyPerson = function (v) { try { if (v !== undefined) localStorage.setItem('fs-ai-only', v ? '1' : '0'); return localStorage.getItem('fs-ai-only') === '1'; } catch (e) { return false; } };
  function onlyPerson(orig, im) {
    var tmp = { src: im.src, doc: null };
    return FS.ensureMask(tmp).then(function (m) {
      if (!m || (tmp.maskCover || 0) < 0.02) return im;
      var W = im.naturalWidth, H = im.naturalHeight, c = FS.canvas(W, H), x = c.getContext('2d'), pc = FS.canvas(W, H), px = pc.getContext('2d');
      /* the mask is grey (white = person): its light becomes the alpha of the AI picture */
      px.drawImage(im, 0, 0, W, H); var mc = FS.canvas(W, H), mx = mc.getContext('2d', { willReadFrequently: true }); mx.drawImage(m, 0, 0, W, H);
      var md = mx.getImageData(0, 0, W, H).data, id = px.getImageData(0, 0, W, H); for (var i = 3; i < id.data.length; i += 4) id.data[i] = md[i - 3]; px.putImageData(id, 0, 0);
      x.imageSmoothingQuality = 'high'; x.drawImage(orig, 0, 0, W, H); x.drawImage(pc, 0, 0);
      return new Promise(function (ok) { c.toBlob(function (b) { ok(b ? FS.loadImg(URL.createObjectURL(b)) : im); }, 'image/jpeg', 0.94); });
    }).catch(function () { return im; });
  }
  /* put an AI result on the photo: the original stays in origSrc; earlier AI results are kept too (a few), so "ביטול AI" can go back one step at a time */
  /* the AI picture has the shape of the photo it replaces (matchShape): it takes the photo's place in the frame as it was (the
     same crop, zoom, turn and position) instead of being fitted anew, which moved it, cut it or left it small in the frame */
  function sameShape(a, b) { var aw = a && (a.naturalWidth || a.width), ah = a && (a.naturalHeight || a.height), bw = b.naturalWidth || b.width, bh = b.naturalHeight || b.height; return aw && ah && bw && bh && Math.abs(aw / ah - bw / bh) < 0.02; }
  function keepPlace(p, prevIm, im) { if (!sameShape(prevIm, im)) FS.fitPhoto(p.doc, im); }
  FS.applyAI = function (p, im) {
    var prevIm = FS.img(p.src);
    if (!p.origSrc) p.origSrc = p.src; else { p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5); }
    p.src = im.src; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null; p._gt = null; p._pt = null;
    delete p.aiBad; p.aiHeads = !!im.headsKept; if (im.aiPhoto !== undefined) { p.aiPhoto = im.aiPhoto; p.aiScene = im.aiScene; p.aiLoose = !!im.aiLoose; } if (im.aiCheck) p.aiScore = im.aiCheck.score;
    keepPlace(p, prevIm, im); FS.snap(p); return p;
  };
  FS.unstyle = function (p) {
    if (!p.origSrc) return false; var prevIm = FS.img(p.src); p.src = p.origSrc; delete p.origSrc; delete p.aiPrev; delete p.aiBad; delete p.aiScore; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1;
    keepPlace(p, prevIm, FS.img(p.src)); p.doc.photo.style = null; FS.snap(p); return true;
  };
  /* one AI design back: the previous AI result, or the original photo when there was only one */
  FS.unstyleStep = function (p) {
    if (!p || !p.origSrc) return false;
    if (!p.aiPrev || !p.aiPrev.length) return FS.unstyle(p);
    var prevIm = FS.img(p.src); p.src = p.aiPrev.pop(); p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1;
    keepPlace(p, prevIm, FS.img(p.src)); FS.snap(p); return true;
  };

})();
