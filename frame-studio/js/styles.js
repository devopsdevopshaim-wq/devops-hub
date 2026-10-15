/* Styles. Instant styles run in the browser on the photo's pixels (comic, manga, cartoon, pop art, sketch, oil, watercolour,
   graffiti, neon, pixel, glitch, duotone…) as a step of the photo pipeline (doc.photo.style = {id, amt}).
   AI styles (3D animation, anime, superheroes, animals…) send the photo to the hubs server's image model and replace the
   photo with the answer (the original is kept in p.origSrc and can be brought back). */
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
      var L = lum(px, w * h), inv = new Uint8ClampedArray(px.length), i;
      for (i = 0; i < w * h; i++) { var v = 255 - L[i] * 255; inv[i * 4] = inv[i * 4 + 1] = inv[i * 4 + 2] = v; inv[i * 4 + 3] = 255; }
      var b = FS.blur(inv, w, h, Math.max(3, w / 120)), out = new Uint8ClampedArray(px.length), r = rnd(5);
      for (i = 0; i < w * h; i++) { var base = L[i] * 255, d = Math.min(255, base * 255 / Math.max(1, 255 - b[i * 4])); d = 255 - (255 - d) * 1.25 - (r() * 10); out[i * 4] = out[i * 4 + 1] = d; out[i * 4 + 2] = d * 0.97; out[i * 4 + 3] = 255; }
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
    noir: function (px, w, h) { var L = lum(px, w * h), out = new Uint8ClampedArray(px.length); for (var i = 0; i < w * h; i++) { var v = clamp((L[i] - 0.5) * 1.9 + 0.5, 0, 1); v = v * v * (3 - 2 * v) * 255; out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255; } ink(out, sobel(L, w, h), w, h, 0.6); return out; }
  };
  function edgeImg(E, w, h) { var o = new Uint8ClampedArray(w * h * 4); for (var i = 0; i < w * h; i++) { var v = clamp(E[i] * 255, 0, 255); o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = 255; } return o; }

  FS.LOCAL_STYLES = [
    ['cartoon', 'אנימציה מצוירת', '🎬'], ['comic', 'קומיקס', '💥'], ['manga', 'מנגה יפנית', '🗾'], ['pop', 'פופ־ארט', '🟨'], ['graffiti', 'גרפיטי', '🎨'],
    ['sketch', 'סקיצת עיפרון', '✏️'], ['oil', 'ציור שמן', '🖼️'], ['watercolor', 'צבעי מים', '💧'], ['stained', 'ויטראז׳', '⛪'], ['neon', 'ניאון', '💡'],
    ['pixel', 'פיקסל ארט', '👾'], ['glitch', 'גליץ׳', '📺'], ['duotone', 'דואוטון זהב', '✨'], ['noir', 'פילם נואר', '🕵️']
  ];

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
    ['purim', 'תחפושות', '🎭', 'Dress every person in this photo in fun, colourful costumes (pirate, princess, astronaut, magician…), festive party background.']
  ];
  function photoB64(p) {
    var im = FS.img(p.src), k = Math.min(1, 1536 / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }
  /* the answer is brought back to the original's shape and size (centre crop), so the frame, the faces and the layout stay where they were */
  function matchShape(res, orig) {
    var W = orig.naturalWidth, H = orig.naturalHeight, k = Math.min(1, 3000 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    var s = Math.max(W / res.naturalWidth, H / res.naturalHeight), c = FS.canvas(W, H), x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(res, (W - res.naturalWidth * s) / 2, (H - res.naturalHeight * s) / 2, res.naturalWidth * s, res.naturalHeight * s);
    return new Promise(function (ok) { c.toBlob(function (b) { ok(FS.loadImg(URL.createObjectURL(b))); }, 'image/jpeg', 0.94); });
  }
  FS.restyle = function (p, prompt) {
    var orig = FS.img(p.origSrc || p.src), ar = orig.naturalWidth / orig.naturalHeight;
    prompt += ' The output image must have the same ' + (ar > 1.05 ? 'landscape' : ar < 0.95 ? 'portrait' : 'square') + ' aspect ratio (' + orig.naturalWidth + 'x' + orig.naturalHeight + ').';
    var faces = p.faces ? p.faces.length : 0; if (faces) prompt += ' There are exactly ' + faces + ' faces in the photo; keep all ' + faces + '.';
    return FS.askServer({ action: 'restyle', prompt: prompt, image: photoB64(p), mime: 'image/jpeg' }).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error(r && r.error || 'ai-failed');
      var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' })));
    }).then(function (res) { return matchShape(res, orig); }).then(function (im) {
      if (!p.origSrc) p.origSrc = p.src;
      p.src = im.src; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null;
      FS.fitPhoto(p.doc, im); FS.snap(p); return p;
    });
  };
  FS.unstyle = function (p) {
    if (!p.origSrc) return false; p.src = p.origSrc; delete p.origSrc; p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1;
    FS.fitPhoto(p.doc, FS.img(p.src)); p.doc.photo.style = null; FS.snap(p); return true;
  };

  /* ---------- the panel ---------- */
  function thumb(p, id) {
    var im = FS.img(p.src), k = 150 / Math.max(im.naturalWidth, im.naturalHeight), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, c.width, c.height); var d = x.getImageData(0, 0, c.width, c.height); FS.applyStyle(d.data, c.width, c.height, { id: id, amt: 100 }, true); x.putImageData(d, 0, 0); return c;
  }
  FS.buildStyles = function () {
    var p = FS.cur(), g = $('#local-styles'), a = $('#ai-styles'); if (!g) return;
    g.innerHTML = ''; var cur = p && p.doc.photo.style && p.doc.photo.style.id;
    FS.LOCAL_STYLES.forEach(function (s) {
      var b = document.createElement('button'); b.className = 'tile' + (cur === s[0] ? ' on' : ''); b.dataset.id = s[0];
      if (p) b.appendChild(thumb(p, s[0])); else { var e = document.createElement('i'); e.className = 'emo'; e.textContent = s[2]; b.appendChild(e); }
      var t = document.createElement('span'); t.textContent = s[1]; b.appendChild(t);
      b.addEventListener('click', function () {
        var amt = Number($('#style-amt').value), on = !(FS.cur() && FS.cur().doc.photo.style && FS.cur().doc.photo.style.id === s[0]);
        FS.targets().forEach(function (q) { q.doc.photo.style = on ? { id: s[0], amt: amt } : null; if (q !== FS.cur()) FS.snap(q); });
        FS.changed(); FS.refreshStrip && FS.refreshStrip(); $$('#local-styles .tile').forEach(function (x) { x.classList.toggle('on', on && x.dataset.id === s[0]); });
      });
      g.appendChild(b);
    });
    if (!a.children.length) FS.AI_STYLES.forEach(function (s) {
      var b = document.createElement('button'); b.className = 'ai-style'; b.innerHTML = '<i>' + s[2] + '</i><span>' + s[1] + '</span>';
      b.addEventListener('click', function () { runAI(s[3] + KEEP, s[1]); }); a.appendChild(b);
    });
  };
  function runAI(prompt, label) {
    var list = FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    var done = 0, chain = Promise.resolve(), failed = null;
    list.forEach(function (p) { chain = chain.then(function () { FS.busy('🤖 ' + label + ' · ' + (done + 1) + '/' + list.length + ' (עד דקה לתמונה)'); return FS.findFaces(p, true).catch(function () {}).then(function () { return FS.restyle(p, prompt); }).then(function () { done++; }).catch(function (e) { failed = e; }); }); });
    chain.then(function () {
      FS.busy(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip();
      if (done) FS.toast('✨ ' + label + ': ' + done + ' תמונות. "החזרת המקור" מבטל.', 4000);
      if (failed) {
        var m = String(failed.message);
        FS.toast(m === 'no-key' ? 'שרת ה־AI עוד לא הוגדר.' : m === 'quota' || m === 'rate-limited' ? 'הגענו למכסת ה־AI להיום. בינתיים יש סגנונות מיידיים למעלה.' : 'סגנון ה־AI לא זמין כרגע. אפשר להשתמש בסגנונות המיידיים למעלה, שעובדים בלי אינטרנט.', 6000);
      }
    });
  }
  $('#style-amt').addEventListener('input', function () {
    $('#o-style-amt').textContent = this.value + '%'; var v = Number(this.value);
    FS.targets().forEach(function (q) { if (q.doc.photo.style) q.doc.photo.style.amt = v; }); FS.render(true); FS.commitSoon();
  });
  $('#style-none').addEventListener('click', function () { FS.targets().forEach(function (q) { q.doc.photo.style = null; FS.snap(q); }); FS.changed(); FS.buildStyles(); });
  $('#style-orig').addEventListener('click', function () { var n = 0; FS.targets().forEach(function (q) { if (FS.unstyle(q)) n++; }); FS.emit('doc'); FS.toast(n ? 'המקור הוחזר ל־' + n + ' תמונות' : 'אין סגנון AI להחזיר'); });
  $('#ai-custom-go').addEventListener('click', function () { var t = $('#ai-custom').value.trim(); if (!t) return FS.toast('כותבים מה לעשות לתמונה'); runAI('Edit this photo: ' + t + '.' + KEEP, 'עריכת AI'); });
})();
