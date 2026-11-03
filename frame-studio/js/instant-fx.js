/* ⚡ Instant effects: a second a photo, on this computer, no internet and no model to load. Light, colour, glow and magic
   (sparkles, bokeh, hearts, snow, flares) drawn over the photo at its own size, so faces and the crop stay exactly as they
   were. Each effect works from the photo before the last effect, so trying one after another never piles up; the strength
   slider mixes it with the photo; "↩ ביטול AI" brings the earlier one back. A live preview of every effect on the photo. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;

  /* ---------- canvas helpers ---------- */
  function C(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function X(c) { return c.getContext('2d', { willReadFrequently: true }); }
  function copy(src, w, h) { var c = C(w || src.width || src.naturalWidth, h || src.height || src.naturalHeight), x = X(c); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); return c; }
  function U(c) { return Math.max(c.width, c.height) / 1000; }   /* one unit = a thousandth of the long side: the preview and the photo match */
  var HAS_FILTER = (function () { try { var x = C(2, 2).getContext('2d'); x.filter = 'blur(2px)'; return x.filter === 'blur(2px)'; } catch (e) { return false; } })();
  function blur(src, r) {
    var W = src.width, H = src.height, c = C(W, H), x = X(c);
    x.drawImage(src, 0, 0);
    if (HAS_FILTER) { x.filter = 'blur(' + Math.max(0.5, r) + 'px)'; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }
    var f = Math.max(2, r), a = copy(src, W / f, H / f), b = copy(a, W / Math.max(1, f / 2), H / Math.max(1, f / 2));
    x.imageSmoothingQuality = 'high'; x.drawImage(b, 0, 0, W, H); return c;
  }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cl(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function pixels(c, fn) { var x = X(c), id = x.getImageData(0, 0, c.width, c.height), d = id.data; fn(d, c.width, c.height); x.putImageData(id, 0, 0); return c; }

  /* colour: contrast, brightness, warmth, tint, saturation, faded blacks, gamma (one pass, lookup tables) */
  function grade(c, o) {
    var con = o.c || 1, bri = (o.b || 0) * 255, t = o.t || 0, g = o.g || 0, sat = o.s == null ? 1 : o.s, fade = (o.fade || 0) * 255, gam = o.gamma || 1;
    function lut(shift) { var L = new Uint8ClampedArray(256); for (var i = 0; i < 256; i++) { var v = 255 * Math.pow(i / 255, 1 / gam); v = (v - 128) * con + 128 + bri + shift; v = fade + v * (255 - fade) / 255; L[i] = cl(v); } return L; }
    var R = lut(t + g * 0.3), G = lut(-g), B = lut(-t + g * 0.3);
    return pixels(c, function (d) {
      for (var i = 0; i < d.length; i += 4) {
        var r = R[d[i]], gg = G[d[i + 1]], b = B[d[i + 2]];
        if (sat !== 1) { var l = 0.299 * r + 0.587 * gg + 0.114 * b; r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat; }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b;
      }
    });
  }
  /* shadows toward one colour, highlights toward another */
  function splitTone(c, sh, hi, amt) {
    return pixels(c, function (d) {
      for (var i = 0; i < d.length; i += 4) {
        var l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, a = 1 - l;
        for (var k = 0; k < 3; k++) d[i + k] = cl(d[i + k] + ((sh[k] - 128) * a + (hi[k] - 128) * l) * amt);
      }
    });
  }
  function duotone(c, dark, light, amt) {
    return pixels(c, function (d) {
      for (var i = 0; i < d.length; i += 4) {
        var l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; l = l * l * (3 - 2 * l);
        for (var k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - amt) + (dark[k] + (light[k] - dark[k]) * l) * amt;
      }
    });
  }
  function mono(c, tone) { return pixels(c, function (d) { for (var i = 0; i < d.length; i += 4) { var l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; d[i] = cl(l + tone[0]); d[i + 1] = cl(l + tone[1]); d[i + 2] = cl(l + tone[2]); } }); }
  function draw(c, src, mode, alpha) { var x = X(c); x.save(); x.globalCompositeOperation = mode || 'source-over'; x.globalAlpha = alpha == null ? 1 : alpha; x.drawImage(src, 0, 0, c.width, c.height); x.restore(); return c; }
  function glow(c, r, alpha, mode) { return draw(c, blur(c, r * U(c)), mode || 'screen', alpha); }
  /* the soft "Orton" dream: a bright blurred copy laid over */
  function dream(c, r, alpha) { var b = blur(c, r * U(c)); grade(b, { b: 0.08, c: 1.1, s: 1.15 }); return draw(c, b, 'soft-light', alpha); }
  function vignette(c, amt, color) {
    var x = X(c), W = c.width, H = c.height, g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(' + (color || '0,0,0') + ',0)'); g.addColorStop(1, 'rgba(' + (color || '0,0,0') + ',' + amt + ')');
    x.save(); x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore(); return c;
  }
  function grain(c, amt, seed) {
    var t = C(256, 256), r = rng(seed || 7);
    pixels(t, function (d) { for (var i = 0; i < d.length; i += 4) { var v = 128 + (r() - 0.5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } });
    var x = X(c); x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = amt; var k = Math.max(1, U(c) * 0.9); x.scale(k, k); x.fillStyle = x.createPattern(t, 'repeat'); x.fillRect(0, 0, c.width / k, c.height / k); x.restore(); return c;
  }
  /* soft coloured light from points: [xFrac, yFrac, 'r,g,b', alpha, radiusFrac] */
  function leak(c, list, mode) {
    var x = X(c), W = c.width, H = c.height, D = Math.hypot(W, H);
    x.save(); x.globalCompositeOperation = mode || 'screen';
    list.forEach(function (l) { var g = x.createRadialGradient(l[0] * W, l[1] * H, 0, l[0] * W, l[1] * H, l[4] * D); g.addColorStop(0, 'rgba(' + l[2] + ',' + l[3] + ')'); g.addColorStop(1, 'rgba(' + l[2] + ',0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
    x.restore(); return c;
  }
  function band(c, top, bottom, mode, alpha) {
    var x = X(c), g = x.createLinearGradient(0, 0, 0, c.height); top.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.save(); x.globalCompositeOperation = mode || 'soft-light'; x.globalAlpha = alpha == null ? 1 : alpha; x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); x.restore(); return c;
  }
  /* where on the photo particles may go: 'all', 'top' (fades out downward), 'edges' (away from the middle, where faces are) */
  function spot(r, W, H, area) {
    for (var n = 0; n < 12; n++) {
      var x = r() * W, y = area === 'top' ? Math.pow(r(), 1.6) * H * 0.7 : r() * H;
      if (area !== 'edges') return [x, y];
      var dx = (x / W - 0.5) * 2, dy = (y / H - 0.45) * 2; if (dx * dx + dy * dy > 0.55) return [x, y];
    }
    return [r() * W, r() * H * 0.25];
  }
  function bokeh(c, o) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(o.seed || 3);
    x.save(); x.globalCompositeOperation = 'screen';
    for (var i = 0; i < o.n; i++) {
      var p = spot(r, W, H, o.area), rad = (o.min + r() * (o.max - o.min)) * u, col = o.cols[Math.floor(r() * o.cols.length)], a = (o.alpha || 0.5) * (0.4 + r() * 0.6);
      var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.72, 'rgba(' + col + ',' + a * 0.75 + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], rad, 0, 6.2832); x.fill();
    }
    x.restore(); return c;
  }
  function star(x, cx, cy, R, rot) {
    x.save(); x.translate(cx, cy); x.rotate(rot || 0); x.beginPath();
    for (var i = 0; i < 4; i++) { x.rotate(Math.PI / 2); x.moveTo(0, 0); x.quadraticCurveTo(R * 0.12, R * 0.12, 0, R); x.quadraticCurveTo(-R * 0.12, R * 0.12, 0, 0); }
    x.fill(); x.restore();
  }
  function sparkles(c, o) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(o.seed || 11);
    x.save(); x.globalCompositeOperation = 'screen';
    for (var i = 0; i < o.n; i++) {
      var p = spot(r, W, H, o.area), R = (o.min + Math.pow(r(), 2.2) * (o.max - o.min)) * u, col = o.cols[Math.floor(r() * o.cols.length)];
      var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], R * 0.9); g.addColorStop(0, 'rgba(' + col + ',.85)'); g.addColorStop(1, 'rgba(' + col + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], R * 0.9, 0, 6.2832); x.fill();
      x.fillStyle = 'rgba(255,255,255,.95)'; if (R > 6 * u * 0.5) star(x, p[0], p[1], R * 1.4, r() * 0.6); else { x.beginPath(); x.arc(p[0], p[1], Math.max(0.6, R * 0.25), 0, 6.2832); x.fill(); }
    }
    x.restore(); return c;
  }
  function heart(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.35, cx - s * 0.45, cy - s, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s, cx + s, cy - s * 0.35, cx, cy + s * 0.35); x.fill(); }
  function hearts(c, o) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(o.seed || 5);
    x.save(); x.globalCompositeOperation = 'screen'; if (HAS_FILTER) x.filter = 'blur(' + (1.2 * u) + 'px)';
    for (var i = 0; i < o.n; i++) { var p = spot(r, W, H, o.area), s = (o.min + r() * (o.max - o.min)) * u; x.fillStyle = 'rgba(' + o.cols[Math.floor(r() * o.cols.length)] + ',' + (0.35 + r() * 0.5) + ')'; heart(x, p[0], p[1], s); }
    x.restore(); return c;
  }
  function snow(c, n, seed) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(seed || 9);
    x.save(); x.globalCompositeOperation = 'screen';
    for (var i = 0; i < n; i++) { var px = r() * W, py = r() * H, s = (0.8 + Math.pow(r(), 3) * 6) * u, g = x.createRadialGradient(px, py, 0, px, py, s); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(240,248,255,.6)'); g.addColorStop(1, 'rgba(240,248,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, s, 0, 6.2832); x.fill(); }
    x.restore(); return c;
  }
  function confetti(c, n, seed) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(seed || 13), cols = ['#F3C64B', '#EF5B8F', '#47C5E8', '#8B6CF0', '#5CD08A', '#FF8A3D', '#ffffff'];
    for (var i = 0; i < n; i++) { var p = spot(r, W, H, 'edges'), w = (4 + r() * 6) * u, h = (8 + r() * 10) * u; x.save(); x.translate(p[0], p[1]); x.rotate(r() * 6.28); x.globalAlpha = 0.75 + r() * 0.25; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(-w / 2, -h / 2, w, h); x.restore(); }
    return c;
  }
  function flare(c, fx, fy, col) {
    var x = X(c), W = c.width, H = c.height, u = U(c), px = fx * W, py = fy * H, D = Math.hypot(W, H);
    leak(c, [[fx, fy, col || '255,200,120', 0.9, 0.35], [fx, fy, '255,255,255', 0.85, 0.06]]);
    x.save(); x.globalCompositeOperation = 'screen';
    var cx = W / 2, cy = H / 2;
    [[0.35, 26, '120,200,255', 0.18], [0.6, 14, '255,140,200', 0.22], [0.85, 40, '160,255,200', 0.12], [1.3, 60, '255,210,140', 0.1]].forEach(function (g) {
      var gx = px + (cx - px) * g[0] * 2, gy = py + (cy - py) * g[0] * 2, rr = g[1] * u, gr = x.createRadialGradient(gx, gy, rr * 0.6, gx, gy, rr);
      gr.addColorStop(0, 'rgba(' + g[2] + ',' + g[3] + ')'); gr.addColorStop(1, 'rgba(' + g[2] + ',0)'); x.fillStyle = gr; x.beginPath(); x.arc(gx, gy, rr, 0, 6.2832); x.fill();
    });
    var st = x.createLinearGradient(px - D * 0.4, py, px + D * 0.4, py); st.addColorStop(0, 'rgba(255,220,170,0)'); st.addColorStop(0.5, 'rgba(255,240,210,.55)'); st.addColorStop(1, 'rgba(255,220,170,0)');
    x.fillStyle = st; x.fillRect(px - D * 0.4, py - 1.2 * u, D * 0.8, 2.4 * u);
    x.restore(); return c;
  }
  function fireworks(c, seed) {
    var x = X(c), W = c.width, H = c.height, u = U(c), r = rng(seed || 21), cols = ['255,215,120', '255,120,170', '140,220,255', '200,160,255'];
    x.save(); x.globalCompositeOperation = 'screen'; x.lineCap = 'round';
    for (var k = 0; k < 4; k++) {
      var cx = (0.12 + r() * 0.76) * W, cy = (0.06 + r() * 0.22) * H, R = (70 + r() * 70) * u, col = cols[k % cols.length], rays = 26 + Math.floor(r() * 12);
      leak(c, [[cx / W, cy / H, col, 0.35, R / Math.hypot(W, H) * 1.3]]);
      for (var i = 0; i < rays; i++) {
        var a = i / rays * 6.2832 + r() * 0.1, l = R * (0.7 + r() * 0.3), g = x.createLinearGradient(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
        g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(0.6, 'rgba(' + col + ',.7)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
        x.strokeStyle = g; x.lineWidth = 1.6 * u; x.beginPath(); x.moveTo(cx + Math.cos(a) * l * 0.15, cy + Math.sin(a) * l * 0.15); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke();
      }
    }
    x.restore(); return c;
  }
  function scanlines(c, alpha) { var x = X(c), u = Math.max(1, U(c) * 1.6); x.save(); x.fillStyle = 'rgba(0,0,0,' + alpha + ')'; for (var y = 0; y < c.height; y += u * 2) x.fillRect(0, y, c.width, u); x.restore(); return c; }
  function rgbShift(c, px) {
    var s = Math.max(1, Math.round(px * U(c))), W = c.width, src = X(c).getImageData(0, 0, W, c.height).data;
    return pixels(c, function (d) { for (var i = 0; i < d.length; i += 4) { var col = (i / 4) % W; d[i] = src[i + (col >= s ? -s * 4 : 0)]; d[i + 2] = src[i + 2 + (col < W - s ? s * 4 : 0)]; } });
  }
  function frameGlow(c, col, amt) {
    var x = X(c), W = c.width, H = c.height, m = Math.min(W, H) * 0.12;
    x.save(); x.globalCompositeOperation = 'screen';
    [[0, 0, W, m, 0, 0, 0, m], [0, H - m, W, m, 0, H, 0, H - m], [0, 0, m, H, 0, 0, m, 0], [W - m, 0, m, H, W, 0, W - m, 0]].forEach(function (b) {
      var g = x.createLinearGradient(b[4], b[5], b[6], b[7]); g.addColorStop(0, 'rgba(' + col + ',' + amt + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); x.fillStyle = g; x.fillRect(b[0], b[1], b[2], b[3]);
    });
    x.restore(); return c;
  }
  function lumOf(d, W, H) { var L = new Float32Array(W * H); for (var i = 0, j = 0; j < L.length; i += 4, j++) L[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; return L; }
  /* pencil: the grey photo dodged by its own blurred negative */
  function sketch(c, color) {
    var W = c.width, H = c.height, inv = copy(c); pixels(inv, function (d) { for (var i = 0; i < d.length; i += 4) { var l = 255 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); d[i] = d[i + 1] = d[i + 2] = l; } });
    var bl = X(blur(inv, 6 * U(c))).getImageData(0, 0, W, H).data, orig = color ? X(c).getImageData(0, 0, W, H).data : null;
    pixels(c, function (d) {
      for (var i = 0; i < d.length; i += 4) {
        var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], v = Math.min(255, g * 255 / Math.max(1, 255 - bl[i])); v = 255 * Math.pow(v / 255, 1.6);
        if (orig) { d[i] = cl(v * 0.55 + orig[i] * 0.45 * v / 255 + 20); d[i + 1] = cl(v * 0.55 + orig[i + 1] * 0.45 * v / 255 + 18); d[i + 2] = cl(v * 0.55 + orig[i + 2] * 0.45 * v / 255 + 12); }
        else { d[i] = cl(v + 4); d[i + 1] = cl(v + 2); d[i + 2] = cl(v - 4); }
      }
    });
    return grain(c, 0.12, 4);
  }
  /* comic: flat colours and ink lines */
  function comic(c) {
    var W = c.width, H = c.height, sm = blur(c, 1.5 * U(c)), L = lumOf(X(sm).getImageData(0, 0, W, H).data, W, H);
    return pixels(c, function (d) {
      var q = 255 / 5;
      for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
        var j = y * W + x, i = j * 4;
        var gx = L[j - W + 1] + 2 * L[j + 1] + L[j + W + 1] - L[j - W - 1] - 2 * L[j - 1] - L[j + W - 1], gy = L[j + W - 1] + 2 * L[j + W] + L[j + W + 1] - L[j - W - 1] - 2 * L[j - W] - L[j - W + 1], e = Math.sqrt(gx * gx + gy * gy);
        var ink = e > 130 ? 0.12 : e > 80 ? 0.55 : 1;
        for (var k = 0; k < 3; k++) { var v = Math.round(d[i + k] / q) * q; d[i + k] = cl((v * 1.08 + 6) * ink); }
      }
    });
  }
  function halftone(c, cols) {
    var W = c.width, H = c.height, s = Math.max(4, Math.round(Math.max(W, H) / 110)), d = X(c).getImageData(0, 0, W, H).data, x = X(c);
    x.fillStyle = cols[0]; x.fillRect(0, 0, W, H);
    for (var y = 0; y < H; y += s) for (var xx = 0; xx < W; xx += s) {
      var i = (Math.min(H - 1, y + s / 2 | 0) * W + Math.min(W - 1, xx + s / 2 | 0)) * 4, r = d[i], g = d[i + 1], b = d[i + 2], l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      x.fillStyle = 'rgb(' + cl(r * 1.15) + ',' + cl(g * 1.15) + ',' + cl(b * 1.15) + ')'; x.beginPath(); x.arc(xx + s / 2, y + s / 2, s * 0.62 * (1 - l * 0.55), 0, 6.2832); x.fill();
    }
    return c;
  }
  function hdr(c) { var b = blur(c, 22 * U(c)); pixels(c, function (d) { var bd = X(b).getImageData(0, 0, c.width, c.height).data; for (var i = 0; i < d.length; i += 4) for (var k = 0; k < 3; k++) d[i + k] = cl(d[i + k] + (d[i + k] - bd[i + k]) * 0.75); }); return grade(c, { s: 1.15, c: 1.04 }); }

  /* ---------- the effects: [id, name, icon, group, fn] ---------- */
  var GOLD = ['255,214,130', '255,236,180', '255,190,90'], WARM = ['255,190,120', '255,150,110', '255,225,160'], PINK = ['255,140,180', '255,190,210', '255,110,150'];
  FS.INSTANT_FX = [
    ['golden', 'שעת זהב', '🌅', 'light', function (c) { grade(c, { t: 26, c: 1.06, s: 1.12, b: 0.02 }); leak(c, [[0.92, 0.05, '255,170,70', 0.6, 0.55]]); glow(c, 12, 0.22); return vignette(c, 0.3); }],
    ['cinema', 'קולנועי', '🎬', 'light', function (c) { splitTone(c, [40, 150, 170], [255, 175, 110], 0.28); grade(c, { c: 1.14, s: 1.05, fade: 0.03 }); vignette(c, 0.45); var x = X(c), h = c.height * 0.06; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, h); x.fillRect(0, c.height - h, c.width, h); return c; }],
    ['dream', 'חלומי', '☁️', 'light', function (c) { dream(c, 18, 0.7); grade(c, { b: 0.04, s: 1.05, fade: 0.04 }); return glow(c, 30, 0.18); }],
    ['bw', 'שחור לבן דרמטי', '🖤', 'light', function (c) { mono(c, [0, 0, 0]); grade(c, { c: 1.35, gamma: 0.95 }); vignette(c, 0.55); return grain(c, 0.12); }],
    ['silver', 'כסף קלאסי', '🪙', 'light', function (c) { mono(c, [-4, 0, 8]); grade(c, { c: 1.12, b: 0.03 }); glow(c, 16, 0.15); return vignette(c, 0.3); }],
    ['film', 'פילם וינטג׳', '🎞️', 'light', function (c) { grade(c, { t: 14, g: 6, fade: 0.1, c: 0.95, s: 0.85 }); leak(c, [[0, 0.15, '255,120,60', 0.45, 0.35]]); grain(c, 0.22); return vignette(c, 0.35); }],
    ['polaroid', 'פולארויד 70', '📸', 'light', function (c) { splitTone(c, [60, 120, 140], [255, 220, 160], 0.25); grade(c, { fade: 0.12, s: 0.9, c: 0.92, t: 8 }); return grain(c, 0.12); }],
    ['sepia', 'ספיה עתיקה', '📜', 'light', function (c) { mono(c, [38, 18, -16]); grade(c, { c: 1.08, fade: 0.05 }); vignette(c, 0.5, '60,30,10'); return grain(c, 0.16); }],
    ['pastel', 'פסטל רך', '🌸', 'light', function (c) { grade(c, { fade: 0.14, s: 0.8, b: 0.06, c: 0.9, g: -4 }); splitTone(c, [150, 130, 200], [255, 205, 215], 0.2); return dream(c, 14, 0.35); }],
    ['hdr', 'HDR חד וחי', '💎', 'light', function (c) { return hdr(c); }],
    ['romance', 'רומנטי אדום', '🌹', 'light', function (c) { splitTone(c, [120, 20, 50], [255, 200, 190], 0.28); grade(c, { s: 1.1, c: 1.05 }); glow(c, 20, 0.2); return vignette(c, 0.45, '60,0,20'); }],
    ['frost', 'כחול חורפי', '❄️', 'light', function (c) { grade(c, { t: -24, s: 0.9, b: 0.03, c: 1.05 }); return glow(c, 16, 0.2); }],
    ['sunset', 'שקיעה', '🌇', 'light', function (c) { band(c, [[0, 'rgba(255,110,60,.9)'], [0.45, 'rgba(255,170,90,.35)'], [1, 'rgba(90,40,120,.4)']], null, 'soft-light'); grade(c, { s: 1.12, c: 1.05 }); return leak(c, [[0.5, -0.05, '255,170,90', 0.55, 0.5]]); }],

    ['sparkle', 'נצנצי זהב', '✨', 'magic', function (c) { grade(c, { t: 10, s: 1.06 }); glow(c, 14, 0.18); return sparkles(c, { n: 140, min: 2, max: 22, cols: GOLD, area: 'edges' }); }],
    ['bokeh', 'אורות בוקה', '🔆', 'magic', function (c) { grade(c, { t: 8 }); return bokeh(c, { n: 60, min: 14, max: 60, cols: WARM, area: 'edges', alpha: 0.45 }); }],
    ['hearts', 'לבבות', '💗', 'magic', function (c) { grade(c, { t: 6, g: -4, s: 1.06 }); glow(c, 12, 0.15); return hearts(c, { n: 46, min: 8, max: 36, cols: PINK, area: 'edges' }); }],
    ['snow', 'שלג קסום', '🌨️', 'magic', function (c) { grade(c, { t: -14, b: 0.03 }); glow(c, 14, 0.15); return snow(c, 420); }],
    ['confetti', 'קונפטי', '🎉', 'magic', function (c) { grade(c, { s: 1.12, c: 1.04 }); return confetti(c, 160); }],
    ['flare', 'קרן שמש', '☀️', 'magic', function (c) { grade(c, { t: 14, s: 1.06 }); return flare(c, 0.86, 0.1); }],
    ['leak', 'דליפת אור', '🌈', 'magic', function (c) { leak(c, [[0, 0, '255,90,60', 0.65, 0.4], [1, 0.2, '255,200,80', 0.45, 0.35], [0.1, 1, '200,80,255', 0.35, 0.35]]); return grade(c, { c: 1.04 }); }],
    ['stars', 'לילה זרוע כוכבים', '🌌', 'magic', function (c) { splitTone(c, [30, 50, 140], [220, 200, 255], 0.22); grade(c, { c: 1.08, b: -0.03 }); return sparkles(c, { n: 260, min: 1, max: 9, cols: ['220,230,255', '255,255,255', '200,180,255'], area: 'top', seed: 31 }); }],
    ['fireworks', 'זיקוקים', '🎆', 'magic', function (c) { grade(c, { c: 1.08, s: 1.08, b: -0.02 }); return fireworks(c); }],
    ['halo', 'מסגרת אור', '🌟', 'magic', function (c) { grade(c, { t: 10, b: 0.02 }); frameGlow(c, '255,225,160', 0.75); return sparkles(c, { n: 80, min: 2, max: 14, cols: GOLD, area: 'edges', seed: 17 }); }],
    ['fairy', 'אבקת פיות', '🧚', 'magic', function (c) { dream(c, 16, 0.45); grade(c, { g: -6, t: 4, s: 1.08 }); bokeh(c, { n: 40, min: 6, max: 26, cols: ['200,170,255', '255,190,240', '170,230,255'], area: 'edges', alpha: 0.4, seed: 8 }); return sparkles(c, { n: 160, min: 1, max: 10, cols: ['255,240,255', '220,200,255'], area: 'edges', seed: 23 }); }],

    ['neon', 'לילה ניאון', '💜', 'retro', function (c) { splitTone(c, [40, 220, 255], [255, 60, 200], 0.38); grade(c, { c: 1.18, s: 1.25, b: -0.03 }); glow(c, 18, 0.35); return vignette(c, 0.5, '20,0,40'); }],
    ['cyber', 'סייברפאנק', '🌃', 'retro', function (c) { splitTone(c, [20, 200, 230], [255, 80, 160], 0.32); grade(c, { c: 1.2, s: 1.15 }); glow(c, 10, 0.3); return scanlines(c, 0.12); }],
    ['vhs', 'קלטת VHS', '📼', 'retro', function (c) { grade(c, { s: 1.2, c: 1.1, fade: 0.06 }); rgbShift(c, 3); scanlines(c, 0.16); grain(c, 0.2); var x = X(c), f = Math.round(26 * U(c)); x.font = '700 ' + f + 'px monospace'; x.fillStyle = 'rgba(255,240,180,.9)'; x.textBaseline = 'bottom'; x.fillText('▶ PLAY', f, c.height - f); return c; }],
    ['vapor', 'ויפורווייב', '🌴', 'retro', function (c) { duotone(c, [60, 20, 120], [255, 170, 220], 0.45); grade(c, { s: 1.2, c: 1.05 }); return glow(c, 14, 0.25); }],
    ['goldpurple', 'דואוטון זהב', '👑', 'retro', function (c) { duotone(c, [40, 10, 70], [255, 215, 130], 0.85); return grade(c, { c: 1.08 }); }],
    ['pinkblue', 'דואוטון פופ', '🍭', 'retro', function (c) { duotone(c, [20, 40, 150], [255, 120, 180], 0.85); return grade(c, { c: 1.1, s: 1.1 }); }],
    ['pencil', 'ציור עיפרון', '✏️', 'retro', function (c) { return sketch(c, false); }],
    ['colorpencil', 'עפרונות צבעוניים', '🖍️', 'retro', function (c) { return sketch(c, true); }],
    ['comic', 'קומיקס', '🗯️', 'retro', function (c) { return comic(c); }],
    ['popart', 'פופ־ארט נקודות', '🔴', 'retro', function (c) { grade(c, { s: 1.4, c: 1.15 }); return halftone(c, ['#fff8e6']); }],
    ['chrome', 'כרום', '🪩', 'retro', function (c) { mono(c, [0, 4, 12]); grade(c, { c: 1.5, gamma: 0.9 }); return glow(c, 10, 0.3); }]
  ];
  var GROUPS = [['all', 'הכול'], ['light', '🎨 אור וצבע'], ['magic', '✨ קסם'], ['retro', '🕹️ רטרו ואמנות']];
  function find(id) { return FS.INSTANT_FX.filter(function (f) { return f[0] === id; })[0]; }

  /* an image -> the effect, at `max` px on the long side (0 = its own size), mixed with the photo by `strength` */
  FS.fxCanvas = function (id, img, max, strength) {
    var f = find(id); if (!f) return null;
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = max ? Math.min(1, max / Math.max(W, H)) : 1;
    var base = copy(img, W * k, H * k), out = f[4](copy(base)) || base;
    if (strength != null && strength < 1) { draw(base, out, 'source-over', strength); out = base; }
    return out;
  };

  var applying = false;
  FS.applyFx = function (list, id, strength, done) {
    var f = find(id); if (!f || !list || !list.length || applying) return Promise.resolve(0);
    applying = true; var n = 0;
    FS.busy && FS.busy('⚡ ' + f[1] + '…');
    return list.reduce(function (ch, p, k) {
      return ch.then(function () {
        var baseSrc = p.fxSrc && p.src === p.fxSrc && p.fxBase ? p.fxBase : p.src;
        return FS.loadImg(baseSrc).then(function (im) {
          var c = FS.fxCanvas(id, im, 0, strength);
          return new Promise(function (ok, no) { c.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.94); });
        }).then(function (b) { return FS.loadImg(URL.createObjectURL(b)); }).then(function (im2) {
          if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
          p.fxBase = baseSrc; p.src = im2.src; p.fxSrc = im2.src; p.fx = id;
          p.cache = {}; p._gt = null; p._pt = null; p._mc = null; p.quality = null; if (FS.snap) FS.snap(p); n++;
          if (list.length > 1) FS.busy && FS.busy('⚡ ' + f[1] + ' · ' + (k + 1) + ' מתוך ' + list.length);
        });
      });
    }, Promise.resolve()).catch(function (e) { FS.toast('האפקט לא הצליח: ' + ((e && e.message) || ''), 5000); }).then(function () {
      applying = false; FS.busy && FS.busy(); FS.emit('doc'); if (FS.render) FS.render(); if (FS.refreshStrip) FS.refreshStrip();
      if (n) FS.toast('⚡ ' + f[1] + (n > 1 ? ' · ' + n + ' תמונות' : '') + '. "↩ ביטול AI" מחזיר.', 3500);
      if (done) done(list); return n;
    });
  };

  /* ---------- the panel: live previews on the photo, groups, strength ---------- */
  var STR_KEY = 'fs-fx-strength';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private */ } }
  FS.fxPanel = function (box, opt) {
    if (!box) return;
    var grp = lsGet('fs-fx-group') || 'all', strength = Number(lsGet(STR_KEY)) || 100, pvKey = '', pvJob = 0;
    box.innerHTML = '<h3 class="fx-h">⚡ אפקטים מיידיים <small>שנייה לתמונה · בלי אינטרנט · הפנים נשארים בדיוק כמו בצילום</small></h3>' +
      '<div class="fx-bar"><div class="fx-tabs">' + GROUPS.map(function (g) { return '<button type="button" data-fxg="' + g[0] + '"' + (g[0] === grp ? ' class="on"' : '') + '>' + g[1] + '</button>'; }).join('') + '</div>' +
      '<label class="fx-str">עוצמה <input type="range" min="20" max="100" step="5" value="' + strength + '"><b>' + strength + '%</b></label></div>' +
      '<div class="fx-grid">' + FS.INSTANT_FX.map(function (f) { return '<button type="button" class="fx-t" data-fx="' + f[0] + '" data-g="' + f[3] + '" title="' + f[1] + '"><span class="fx-pv"><canvas width="1" height="1"></canvas><i>' + f[2] + '</i></span><span class="fx-n">' + f[1] + '</span></button>'; }).join('') + '</div>';
    function filter() { box.querySelectorAll('.fx-t').forEach(function (t) { t.hidden = grp !== 'all' && t.dataset.g !== grp; }); }
    filter();
    box.querySelector('.fx-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-fxg]'); if (!b) return; grp = b.dataset.fxg; lsSet('fs-fx-group', grp); box.querySelectorAll('[data-fxg]').forEach(function (x) { x.classList.toggle('on', x === b); }); filter(); });
    var rg = box.querySelector('.fx-str input');
    rg.addEventListener('input', function () { strength = Number(rg.value); box.querySelector('.fx-str b').textContent = strength + '%'; lsSet(STR_KEY, strength); });
    rg.addEventListener('change', function () { pvKey = ''; previews(); });
    box.querySelector('.fx-grid').addEventListener('click', function (e) {
      var t = e.target.closest('[data-fx]'); if (!t) return;
      var list = opt.list(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
      t.classList.add('fx-go'); setTimeout(function () { t.classList.remove('fx-go'); }, 700);
      FS.applyFx(list, t.dataset.fx, strength / 100, opt.done);
    });
    /* every effect drawn small on the photo (from the photo before effects), one by one so nothing freezes */
    function previews() {
      var p = opt.preview && opt.preview(); if (!p || !box.isConnected || box.offsetParent === null) return;
      var src = p.fxSrc && p.src === p.fxSrc && p.fxBase ? p.fxBase : p.src, key = src + '|' + strength; if (key === pvKey) return; pvKey = key;
      var job = ++pvJob;
      FS.loadImg(src).then(function (im) {
        var tiles = Array.prototype.slice.call(box.querySelectorAll('.fx-t')), small, W = im.naturalWidth, H = im.naturalHeight, k = 240 / Math.max(W, H);
        small = copy(im, W * k, H * k);
        (function next(i) {
          if (job !== pvJob || i >= tiles.length) return;
          var t = tiles[i], out = FS.fxCanvas(t.dataset.fx, small, 0, strength / 100), cv = t.querySelector('canvas');
          cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0); t.classList.add('pv');
          setTimeout(function () { next(i + 1); }, 0);
        })(0);
      }).catch(function () { pvKey = ''; });
    }
    var tmr = 0; function soon() { clearTimeout(tmr); tmr = setTimeout(previews, 350); }
    FS.on('doc', soon); FS.on('history', soon);
    document.addEventListener('click', function (e) { if (e.target.closest('.thumb, .strip-item, [data-id], .mt-tile, [data-pane], .mt-sub, .tab')) soon(); }, true);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) soon(); }).observe(box);
    soon();
    return { refresh: function () { pvKey = ''; soon(); } };
  };
})();
