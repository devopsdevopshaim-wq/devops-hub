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
  /* A result that lost the people (the photo had faces, the answer has none, or under half of a group) is never put on the photo:
     it is asked again, once more from the free engine with a new seed, then from the engine on this computer when it is installed.
     When every try loses the people, the error is 'lost-people'. */
  FS.restyleTry = function (p, prompt, engine) {
    if (engine === undefined) engine = FS.aiEngine();
    var local = FS.localAI && FS.localAI.isReady && FS.localAI.isReady(), plan = [engine];
    if (engine !== 'local') { plan.push(engine || 'free'); if (local) plan.push('local'); }
    var orig = FS.img(p.origSrc || p.src);
    var want = p.faces ? Promise.resolve(p.faces.length) : FS.countFaces ? FS.countFaces(orig).catch(function () { return 0; }) : Promise.resolve(0);
    return want.then(function (n0) {
      function go(i) {
        return restyleOnce(p, prompt, plan[i]).then(function (im) {
          if (!n0 || !FS.countFaces) return im;
          return FS.countFaces(im).catch(function () { return n0; }).then(function (n) {
            var lost = !(n >= 1 && (n0 < 3 || n >= n0 * 0.5)), extra = n > (n0 <= 4 ? n0 : n0 + 1);
            if (!lost && !extra) return im;
            if (window.console) console.warn('AI: the answer ' + (lost ? 'lost the people' : 'added people') + ' (' + n0 + ' faces → ' + n + '), from ' + (im.aiSource || '?'));
            if (i + 1 < plan.length) return go(i + 1);
            throw new Error(lost ? 'lost-people' : 'extra-people');
          });
        });
      }
      return go(0);
    });
  };
  function restyleOnce(p, prompt, engine) {
    var orig = FS.img(p.origSrc || p.src), ar = orig.naturalWidth / orig.naturalHeight, src = '';
    if (engine === undefined) engine = FS.aiEngine();
    prompt += ' The output image must have the same ' + (ar > 1.05 ? 'landscape' : ar < 0.95 ? 'portrait' : 'square') + ' aspect ratio (' + orig.naturalWidth + 'x' + orig.naturalHeight + ').';
    var faces = p.faces ? p.faces.length : 0;
    /* the people in the photo, by count: one person stays one person (the models like to add a partner or a figure) */
    if (faces === 1) prompt = prompt.replace(/\b(each|every) person\b/gi, 'the person').replace(/\bthe people\b/gi, 'the person').replace(/\beveryone\b/gi, 'the person') +
      ' There is exactly ONE person in this photo. The result must show only this one person: do not add any other person, partner, figure, silhouette, reflection or face.';
    else if (faces) prompt += ' There are exactly ' + faces + ' people in the photo. The result must show exactly these ' + faces + ' people: do not add or remove anyone, no extra figures or faces.';
    prompt += ' High-end professional result: the face sharp, well lit and fully visible (never covered by a mask, hood or shadow), rich true-to-life detail, clean cinematic colour grading, like a magazine cover or a big-budget film still.';
    var L = 1024, w = ar >= 1 ? L : Math.round(L * ar / 16) * 16, h = ar >= 1 ? Math.round(L / ar / 16) * 16 : L;
    /* FLUX gets the same 1024px photo (compared Oct 26, frame-ai-compare.yml: from a 496px copy it drew new faces; from 1024 it keeps the people) */
    var b64 = photoB64(p, 1024), body = { action: 'restyle', prompt: prompt, image: b64, small: b64, mime: 'image/jpeg', w: w, h: h };
    if (engine) body.engine = engine;
    return FS.askServer(body).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error(r && r.error || 'ai-failed');
      src = r.source || (engine === 'local' ? 'מקומי' : '');
      var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' })));
    }).then(function (res) { return matchShape(res, orig, /pollinations/i.test(src) ? 0.06 : 0); }).then(function (im) {
      /* looks that must stay a photograph of the same people: the real faces are laid back in (js/face-keep.js, on this computer) */
      if (!FS.keepFaces || !/very same people|Keep everything else exactly as it is/.test(prompt)) return im;
      return FS.keepFaces(orig, im).then(function (k) { return k || im; }, function () { return im; });
    }).then(function (im) { return FS.aiOnlyPerson() ? onlyPerson(orig, im) : im; }).then(function (im) { im.aiSource = src; return im; });
  };
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
  FS.applyAI = function (p, im) {
    if (!p.origSrc) p.origSrc = p.src; else { p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5); }
    p.src = im.src; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null; p._gt = null; p._pt = null;
    FS.fitPhoto(p.doc, im); FS.snap(p); return p;
  };
  FS.unstyle = function (p) {
    if (!p.origSrc) return false; p.src = p.origSrc; delete p.origSrc; delete p.aiPrev; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1;
    FS.fitPhoto(p.doc, FS.img(p.src)); p.doc.photo.style = null; FS.snap(p); return true;
  };
  /* one AI design back: the previous AI result, or the original photo when there was only one */
  FS.unstyleStep = function (p) {
    if (!p || !p.origSrc) return false;
    if (!p.aiPrev || !p.aiPrev.length) return FS.unstyle(p);
    p.src = p.aiPrev.pop(); p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1;
    FS.fitPhoto(p.doc, FS.img(p.src)); FS.snap(p); return true;
  };

})();
