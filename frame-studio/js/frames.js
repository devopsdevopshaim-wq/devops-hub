/* Frames: the ready frames (drawn in code at the page's size, any colour and thickness) and the user's own PNG frames
   (kept in the browser, the transparent window found automatically). A page holds a frame reference:
   { kind:'gen', id, color, thick, opacity } or { kind:'png', id, tint, tintAmt, opacity, clip }. */
(function () {
  'use strict';
  var FS = window.FS;

  function rnd(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shade(hex, k) { var c = FS.hexRgb(hex); return 'rgb(' + c.map(function (v) { return Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)); }).join(',') + ')'; }
  function cut(ctx, fn) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; ctx.beginPath(); fn(); ctx.fill(); ctx.restore(); }
  function rr(ctx, x, y, w, h, r) { FS.roundRect(ctx, x, y, w, h, r); }
  function heart(ctx, x, y, s) { ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s); ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3); }
  function star(ctx, x, y, r, n) { n = n || 5; for (var i = 0; i < n * 2; i++) { var a = Math.PI * i / n - Math.PI / 2, q = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](x + q * Math.cos(a), y + q * Math.sin(a)); } ctx.closePath(); }
  function paper(ctx, w, h, col, seed) { ctx.fillStyle = col; ctx.fillRect(0, 0, w, h); var r = rnd(seed || 3); ctx.save(); ctx.globalAlpha = 0.05; for (var i = 0; i < 900; i++) { ctx.fillStyle = r() > 0.5 ? '#000' : '#fff'; ctx.fillRect(r() * w, r() * h, 2, 2); } ctx.restore(); }
  function rectHole(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }

  /* each draw(ctx, w, h, color, thick) paints the frame and returns its window in pixels */
  FS.GEN_FRAMES = [
    { id: 'polaroid', name: 'פולארויד', color: '#fbfaf6', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.06 * t; paper(c, w, h, col, 7);
      var H = rectHole(u, u, w - u * 2, h - u * 4.2); cut(c, function () { c.rect(H.x, H.y, H.w, H.h); });
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.strokeRect(H.x, H.y, H.w, H.h); return H; },
      texts: [{ text: 'רגע לזכור ♡', y: 0.93, size: 0.055, font: 'Amatic SC', color: '#333333', weight: 700 }] },
    { id: 'gold', name: 'מוזהבת קלאסית', color: '#c9a14a', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.075 * t, g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.25, shade(col, -0.3)); g.addColorStop(0.5, shade(col, 0.55)); g.addColorStop(0.75, shade(col, -0.35)); g.addColorStop(1, shade(col, 0.4));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (var i = 1; i < 4; i++) { c.strokeStyle = i % 2 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.45)'; c.lineWidth = u * 0.06; var k = u * i / 4; c.strokeRect(k, k, w - k * 2, h - k * 2); }
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = u * 0.12; c.strokeRect(u - u * 0.06, u - u * 0.06, w - u * 2 + u * 0.12, h - u * 2 + u * 0.12);
      var H = rectHole(u, u, w - u * 2, h - u * 2); cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'mat', name: 'פספרטו כפול', color: '#1d1d1f', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.035 * t; c.fillStyle = col; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f7f5f0'; c.fillRect(u, u, w - u * 2, h - u * 2);
      var m = u * 3.2; c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = u * 0.2; c.strokeRect(m - u * 0.35, m - u * 0.35, w - m * 2 + u * 0.7, h - m * 2 + u * 0.7);
      var H = rectHole(m, m, w - m * 2, h - m * 2); cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'wedding', name: 'חתונה', color: '#b8925a', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.06 * t; paper(c, w, h, '#fffaf2', 11);
      c.strokeStyle = col; c.lineWidth = u * 0.08; c.strokeRect(u * 0.4, u * 0.4, w - u * 0.8, h - u * 0.8); c.lineWidth = u * 0.03; c.strokeRect(u * 0.6, u * 0.6, w - u * 1.2, h - u * 1.2);
      [[u * 0.6, u * 0.6, 1, 1], [w - u * 0.6, u * 0.6, -1, 1], [u * 0.6, h - u * 0.6, 1, -1], [w - u * 0.6, h - u * 0.6, -1, -1]].forEach(function (p) {
        c.save(); c.translate(p[0], p[1]); c.scale(p[2], p[3]); c.strokeStyle = col; c.lineWidth = u * 0.05;
        for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(u * (1 + i * 0.6), u * (1 + i * 0.6), u * (0.9 - i * 0.25), Math.PI, Math.PI * 1.5); c.stroke(); }
        c.fillStyle = col; c.beginPath(); heart(c, u * 1.4, u * 1.2, u * 0.5); c.fill(); c.restore(); });
      var H = rectHole(u * 1.4, u * 1.4, w - u * 2.8, h - u * 5); cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.6); });
      c.strokeStyle = col; c.lineWidth = u * 0.05; rr(c, H.x - u * 0.15, H.y - u * 0.15, H.w + u * 0.3, H.h + u * 0.3, u * 0.7); c.stroke(); return H; },
      texts: [{ text: 'נועה & דניאל', y: 0.9, size: 0.06, font: 'Amatic SC', color: '#8a6a3a', weight: 700 }, { text: '12.06.2026', y: 0.955, size: 0.026, font: 'Bellefair', color: '#8a6a3a', weight: 400 }] },
    { id: 'birthday', name: 'יום הולדת', color: '#ff4f8b', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07 * t, r = rnd(5), cols = [col, '#ffc93c', '#3cc3ff', '#7b5cff', '#2fd38a'];
      c.fillStyle = '#fff6fb'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) { c.fillStyle = cols[i % 5]; c.save(); c.translate(r() * w, r() * h); c.rotate(r() * 6); c.fillRect(-u * 0.12, -u * 0.05, u * 0.24, u * 0.1); c.restore(); }
      [[u * 1.1, u * 1.3], [w - u * 1.1, u * 1.6]].forEach(function (b, k) { c.fillStyle = cols[k + 2]; c.beginPath(); c.ellipse(b[0], b[1], u * 0.7, u * 0.85, 0, 0, 7); c.fill(); c.strokeStyle = '#999'; c.lineWidth = 2; c.beginPath(); c.moveTo(b[0], b[1] + u * 0.85); c.quadraticCurveTo(b[0] + u * 0.3, b[1] + u * 1.6, b[0], b[1] + u * 2.4); c.stroke(); });
      var H = rectHole(u, u * 1.2, w - u * 2, h - u * 4); cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.5); });
      c.strokeStyle = '#fff'; c.lineWidth = u * 0.18; rr(c, H.x, H.y, H.w, H.h, u * 0.5); c.stroke(); return H; },
      texts: [{ text: 'מזל טוב! 🎂', y: 0.92, size: 0.07, font: 'Secular One', color: '#ff4f8b', weight: 400, strokeW: 10, stroke: '#ffffff' }] },
    { id: 'film', name: 'סרט צילום', color: '#111111', draw: function (c, w, h, col, t) {
      var land = w >= h, u = Math.min(w, h) * 0.085 * t; c.fillStyle = col; c.fillRect(0, 0, w, h);
      var n = Math.round((land ? w : h) / (u * 0.9)), step = (land ? w : h) / n;
      cut(c, function () { for (var i = 0; i < n; i++) { var a = i * step + step * 0.25; if (land) { rr(c, a, u * 0.25, step * 0.5, u * 0.45, 4); rr(c, a, h - u * 0.7, step * 0.5, u * 0.45, 4); } else { rr(c, u * 0.25, a, u * 0.45, step * 0.5, 4); rr(c, w - u * 0.7, a, u * 0.45, step * 0.5, 4); } } });
      c.fillStyle = '#e8b04a'; c.font = 'bold ' + u * 0.28 + 'px monospace'; c.fillText('FS 400  ▸ 24', land ? u : u * 0.1, land ? u * 0.95 : u * 0.2);
      var H = land ? rectHole(u * 0.3, u * 1.1, w - u * 0.6, h - u * 2.2) : rectHole(u * 1.1, u * 0.3, w - u * 2.2, h - u * 0.6);
      cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'neon', name: 'ניאון', color: '#35c8ff', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07 * t; c.fillStyle = '#090b22'; c.fillRect(0, 0, w, h);
      var H = rectHole(u, u, w - u * 2, h - u * 2);
      [[col, 0], ['#ff3fa4', u * 0.35]].forEach(function (s) { c.save(); c.shadowColor = s[0]; c.shadowBlur = u * 0.6; c.strokeStyle = s[0]; c.lineWidth = u * 0.12; rr(c, H.x - u * 0.2 - s[1], H.y - u * 0.2 - s[1], H.w + u * 0.4 + s[1] * 2, H.h + u * 0.4 + s[1] * 2, u * 0.6); c.stroke(); c.stroke(); c.restore(); });
      cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.45); }); return H; } },
    { id: 'circle', name: 'עיגול', color: '#f4efe6', draw: function (c, w, h, col, t) {
      paper(c, w, h, col, 13); var d = Math.min(w, h) * (0.86 - (t - 1) * 0.15), H = rectHole((w - d) / 2, (h - d) / 2 - (h > w ? h * 0.06 : 0), d, d);
      c.strokeStyle = shade(col, -0.45); c.lineWidth = d * 0.012; c.beginPath(); c.arc(H.x + d / 2, H.y + d / 2, d / 2 + d * 0.03, 0, 7); c.stroke();
      cut(c, function () { c.arc(H.x + d / 2, H.y + d / 2, d / 2, 0, 7); }); return H; } },
    { id: 'arch', name: 'קשת', color: '#ece2d3', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.08 * t; paper(c, w, h, col, 17); var H = rectHole(u, u, w - u * 2, h - u * 2.6), r = H.w / 2;
      function arch(x, y, ww, hh) { var rad = ww / 2; c.moveTo(x, y + hh); c.lineTo(x, y + rad); c.arc(x + rad, y + rad, rad, Math.PI, 0); c.lineTo(x + ww, y + hh); c.closePath(); }
      c.strokeStyle = shade(col, -0.4); c.lineWidth = u * 0.08; c.beginPath(); arch(H.x - u * 0.25, H.y - u * 0.25, H.w + u * 0.5, H.h + u * 0.5); c.stroke();
      cut(c, function () { arch(H.x, H.y, H.w, H.h); }); void r; return H; } },
    { id: 'hearts', name: 'לבבות', color: '#e8355a', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07 * t; c.fillStyle = '#fff3f5'; c.fillRect(0, 0, w, h); c.fillStyle = col;
      var s = u * 0.7, i;
      for (i = 0; i < w / s; i++) { c.beginPath(); heart(c, i * s + s / 2, u * 0.12, s * 0.7); heart(c, i * s + s / 2, h - u * 0.85, s * 0.7); c.fill(); }
      for (i = 1; i < h / s - 1; i++) { c.beginPath(); heart(c, u * 0.45, i * s, s * 0.7); heart(c, w - u * 0.45, i * s, s * 0.7); c.fill(); }
      var H = rectHole(u, u, w - u * 2, h - u * 2); cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.4); }); return H; } },
    { id: 'stars', name: 'כוכבים — בר/בת מצווה', color: '#1d2d6e', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07 * t, r = rnd(23); c.fillStyle = col; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 70; i++) { c.fillStyle = r() > 0.4 ? '#e6c25a' : '#ffffff'; c.beginPath(); star(c, r() * w, r() * h, u * (0.08 + r() * 0.16), 6); c.fill(); }
      var H = rectHole(u, u, w - u * 2, h - u * 4); c.strokeStyle = '#e6c25a'; c.lineWidth = u * 0.12; rr(c, H.x - u * 0.2, H.y - u * 0.2, H.w + u * 0.4, H.h + u * 0.4, u * 0.5); c.stroke();
      cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.35); }); return H; },
      texts: [{ text: 'מזל טוב', y: 0.9, size: 0.07, font: 'Suez One', color: '#e6c25a', weight: 400 }] },
    { id: 'deckle', name: 'שוליים מסולסלים', color: '#fffdf8', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.05 * t, s = u * 0.6, i;
      c.fillStyle = col; c.fillRect(s / 2, s / 2, w - s, h - s); c.beginPath();
      for (i = 0; i <= w / s; i++) { c.moveTo(i * s + s / 2, s / 2); c.arc(i * s, s / 2, s / 2, 0, 7); c.moveTo(i * s + s / 2, h - s / 2); c.arc(i * s, h - s / 2, s / 2, 0, 7); }
      for (i = 0; i <= h / s; i++) { c.moveTo(s, i * s); c.arc(s / 2, i * s, s / 2, 0, 7); c.moveTo(w, i * s); c.arc(w - s / 2, i * s, s / 2, 0, 7); }
      c.fill(); var H = rectHole(u * 1.5, u * 1.5, w - u * 3, h - u * 3); cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'classic', name: 'מגנט קלאסי', color: '#c9a45c', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.05 * t; paper(c, w, h, '#fffdf9', 29);
      var H = rectHole(u, u, w - u * 2, h - u * 5.2);
      c.strokeStyle = col; c.lineWidth = u * 0.06; c.strokeRect(H.x - u * 0.35, H.y - u * 0.35, H.w + u * 0.7, H.h + u * 0.7);
      var y = H.y + H.h + u * 1.15; c.lineWidth = u * 0.04; c.beginPath(); c.moveTo(w * 0.28, y); c.lineTo(w * 0.72, y); c.stroke();
      c.fillStyle = col; c.beginPath(); c.moveTo(w / 2, y - u * 0.18); c.lineTo(w / 2 + u * 0.18, y); c.lineTo(w / 2, y + u * 0.18); c.lineTo(w / 2 - u * 0.18, y); c.fill();
      cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; },
      texts: [{ text: 'נועה & דניאל', y: 0.885, size: 0.062, font: 'Amatic SC', color: '#5b4a2e', weight: 700 }, { text: '12.06.2026', y: 0.95, size: 0.026, font: 'Bellefair', color: '#8a7550', weight: 400 }] },
    { id: 'floral', name: 'פרחים בצבעי מים', color: '#e9a8a6', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.06 * t, r = rnd(31); paper(c, w, h, '#fffaf7', 37);
      function flower(x, y, s, cc) { for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; c.save(); c.globalAlpha = 0.55; c.fillStyle = cc; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.42, s * 0.26, a, 0, 7); c.fill(); c.restore(); } c.fillStyle = '#e9c46a'; c.beginPath(); c.arc(x, y, s * 0.16, 0, 7); c.fill(); }
      function leaf(x, y, s, a) { c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = 0.6; c.fillStyle = '#8fae8b'; c.beginPath(); c.ellipse(0, 0, s, s * 0.32, 0, 0, 7); c.fill(); c.restore(); }
      [[0, 0], [w, 0], [0, h], [w, h]].forEach(function (p, k) { for (var i = 0; i < 7; i++) leaf(p[0] + (r() - 0.5) * u * 4, p[1] + (r() - 0.5) * u * 4, u * (0.7 + r() * 0.5), r() * 6);
        for (i = 0; i < 4; i++) flower(p[0] + (r() - 0.5) * u * 3.4, p[1] + (r() - 0.5) * u * 3.4, u * (0.9 + r() * 0.7), k % 2 ? col : shade(col, 0.35)); });
      var H = rectHole(u * 1.2, u * 1.2, w - u * 2.4, h - u * 5); cut(c, function () { rr(c, H.x, H.y, H.w, H.h, u * 0.3); });
      c.strokeStyle = shade(col, -0.25); c.lineWidth = u * 0.05; rr(c, H.x - u * 0.2, H.y - u * 0.2, H.w + u * 0.4, H.h + u * 0.4, u * 0.4); c.stroke(); return H; },
      texts: [{ text: 'נועה & דניאל', y: 0.885, size: 0.062, font: 'Amatic SC', color: '#9c5a58', weight: 700 }, { text: '12.06.2026', y: 0.95, size: 0.026, font: 'Bellefair', color: '#9c5a58', weight: 400 }] },
    { id: 'boho', name: 'בוהו עלים', color: '#a3b18a', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07 * t, r = rnd(41); paper(c, w, h, '#f6f1e8', 43);
      var H = rectHole(u, u * 1.2, w - u * 2, h - u * 4.4), rad = H.w / 2;
      function arch(x, y, ww, hh) { var q = ww / 2; c.moveTo(x, y + hh); c.lineTo(x, y + q); c.arc(x + q, y + q, q, Math.PI, 0); c.lineTo(x + ww, y + hh); c.closePath(); }
      for (var i = 0; i < 26; i++) { var a = Math.PI + i / 25 * Math.PI, cx = H.x + rad + Math.cos(a) * (rad + u * 0.45), cy = H.y + rad + Math.sin(a) * (rad + u * 0.45);
        c.save(); c.translate(cx, cy); c.rotate(a + (i % 2 ? 0.6 : -0.6)); c.fillStyle = i % 3 ? col : shade(col, -0.3); c.beginPath(); c.ellipse(0, 0, u * 0.42, u * 0.16, 0, 0, 7); c.fill(); c.restore(); }
      c.strokeStyle = shade(col, -0.35); c.lineWidth = u * 0.05; c.beginPath(); arch(H.x - u * 0.15, H.y - u * 0.15, H.w + u * 0.3, H.h + u * 0.3); c.stroke();
      cut(c, function () { arch(H.x, H.y, H.w, H.h); }); void r; return H; },
      texts: [{ text: 'נועה & דניאל', y: 0.9, size: 0.06, font: 'Amatic SC', color: '#5e6b4e', weight: 700 }, { text: '12.06.2026', y: 0.955, size: 0.025, font: 'Bellefair', color: '#5e6b4e', weight: 400 }] },
    { id: 'simple', name: 'קו פשוט', color: '#ffffff', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.035 * t; c.fillStyle = col; c.fillRect(0, 0, w, h); var H = rectHole(u, u, w - u * 2, h - u * 2);
      cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'insta', name: 'פוסט אינסטגרם', color: '#ffffff', draw: function (c, w, h, col, t) {
      var u = Math.min(w, h) * 0.07; c.fillStyle = col; c.fillRect(0, 0, w, h); void t;
      var g = c.createLinearGradient(0, 0, u, u); g.addColorStop(0, '#feda75'); g.addColorStop(0.5, '#d62976'); g.addColorStop(1, '#4f5bd5');
      c.strokeStyle = g; c.lineWidth = u * 0.08; c.beginPath(); c.arc(w - u * 0.9, u * 0.85, u * 0.45, 0, 7); c.stroke();
      c.fillStyle = '#222'; c.font = '700 ' + u * 0.32 + 'px Heebo, sans-serif'; c.textAlign = 'right'; c.fillText('הסטודיו_שלי', w - u * 1.55, u * 0.97);
      c.font = u * 0.42 + 'px sans-serif'; c.textAlign = 'right'; c.fillText('♡   💬   ➤', w - u * 0.4, h - u * 1.15);
      c.font = '700 ' + u * 0.27 + 'px Heebo, sans-serif'; c.fillText('1,284 לייקים', w - u * 0.4, h - u * 0.55);
      var H = rectHole(0, u * 1.7, w, h - u * 3.5); cut(c, function () { c.rect(H.x, H.y, H.w, H.h); }); return H; } },
    { id: 'magazine', name: 'שער מגזין', color: '#ffffff', draw: function (c, w, h, col) {
      var u = Math.min(w, h) * 0.07; c.fillStyle = col; c.textAlign = 'center'; c.font = '900 ' + u * 2.1 + 'px "Frank Ruhl Libre", serif';
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = u * 0.3; c.fillText('סטודיו', w / 2, u * 2.2); c.restore();
      c.font = '700 ' + u * 0.38 + 'px Heebo, sans-serif'; c.textAlign = 'right'; c.fillText('גיליון מיוחד', w - u * 0.6, h - u * 2.2); c.fillText('כל העיניים על החשיפה', w - u * 0.6, h - u * 1.6);
      c.fillStyle = '#e8213b'; c.fillRect(w - u * 3.4, h - u * 1.15, u * 2.8, u * 0.5); c.fillStyle = '#fff'; c.font = '800 ' + u * 0.3 + 'px Heebo'; c.textAlign = 'center'; c.fillText('בלעדי', w - u * 2, h - u * 0.8);
      return rectHole(0, 0, w, h); } }
  ];

  /* ---------- the user's PNG frames ---------- */
  var USER = FS.USER_FRAMES = {};
  /* the window of a PNG frame: the transparent area around the middle (or, when the middle is solid, the biggest transparent area) */
  FS.detectHole = function (img) {
    var W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, 260 / Math.max(W, H));
    var w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k)), c = FS.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    var a = x.getImageData(0, 0, w, h).data, open = new Uint8Array(w * h), i, any = 0;
    for (i = 0; i < w * h; i++) if (a[i * 4 + 3] < 60) { open[i] = 1; any++; }
    if (!any) return null;
    var seen = new Int32Array(w * h), best = null, label = 0;
    function fill(s) {
      label++; var st = [s], n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, edge = false; seen[s] = label;
      while (st.length) { var p = st.pop(), px = p % w, py = (p - px) / w; n++;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        if (px === 0 || py === 0 || px === w - 1 || py === h - 1) edge = true;
        [p - 1, p + 1, p - w, p + w].forEach(function (q) { if (q >= 0 && q < w * h && open[q] && !seen[q] && Math.abs((q % w) - px) <= 1) { seen[q] = label; st.push(q); } }); }
      return { n: n, x0: x0, y0: y0, x1: x1, y1: y1, edge: edge };
    }
    var centre = Math.floor(h / 2) * w + Math.floor(w / 2);
    if (open[centre]) best = fill(centre);
    else for (i = 0; i < w * h; i++) if (open[i] && !seen[i]) { var r = fill(i); if (!best || (r.n * (r.edge ? 0.4 : 1)) > (best.n * (best.edge ? 0.4 : 1))) best = r; }
    if (!best || best.n < w * h * 0.02) return null;
    return { x: best.x0 / w, y: best.y0 / h, w: (best.x1 - best.x0 + 1) / w, h: (best.y1 - best.y0 + 1) / h };
  };
  FS.addUserFrame = function (src, name, save) {
    return FS.loadImg(src).then(function (img) {
      var id = 'u' + FS.uid(), hole = FS.detectHole(img);
      USER[id] = { id: id, name: name || 'מסגרת שלי', src: src, hole: hole || { x: 0, y: 0, w: 1, h: 1 }, solid: !hole, aspect: img.naturalWidth / img.naturalHeight };
      if (save !== false) FS.store.put('frames', { id: id, name: USER[id].name, src: src, hole: USER[id].hole, solid: USER[id].solid, at: Date.now() }).catch(function () {});
      return USER[id];
    });
  };
  FS.loadUserFrames = function () {
    return FS.store.all('frames').then(function (list) {
      return Promise.all((list || []).sort(function (a, b) { return a.at - b.at; }).map(function (f) {
        return FS.loadImg(f.src).then(function (img) { USER[f.id] = { id: f.id, name: f.name, src: f.src, hole: f.hole, solid: f.solid, aspect: img.naturalWidth / img.naturalHeight }; }).catch(function () {});
      }));
    }).catch(function () {});
  };
  FS.deleteUserFrame = function (id) { delete USER[id]; return FS.store.del('frames', id).catch(function () {}); };

  /* ---------- a frame on a page ---------- */
  var cache = {};
  FS.frameOf = function (ref, d) {
    if (!ref) return null;
    if (ref.kind === 'png') {
      var u = USER[ref.id]; if (!u) return null;
      return { hole: u.hole, src: u.src, clip: ref.clip ? function (ctx, H) { ctx.beginPath(); ctx.rect(H.x, H.y, H.w, H.h); } : null };
    }
    d = d || (FS.cur() && FS.cur().doc); if (!d) return null;
    var def = FS.GEN_FRAMES.filter(function (f) { return f.id === ref.id; })[0]; if (!def) return null;
    var key = [ref.id, d.w, d.h, ref.color || def.color, ref.thick || 1].join('|');
    if (!cache[key]) {
      var c = FS.canvas(d.w, d.h), H = def.draw(c.getContext('2d'), d.w, d.h, ref.color || def.color, ref.thick || 1);
      cache[key] = { canvas: c, hole: { x: H.x / d.w, y: H.y / d.h, w: H.w / d.w, h: H.h / d.h } };
      var keys = Object.keys(cache); if (keys.length > 24) delete cache[keys[0]];
    }
    return cache[key];
  };
  var tintCache = {};
  FS.drawFrame = function (ctx, d) {
    var ref = d.frame, fr = FS.frameOf(ref, d); if (!fr) return;
    var src = fr.canvas || FS.img(fr.src); if (!src) return;
    if (ref.kind === 'png' && ref.tint && ref.tintAmt) {
      var k = ref.id + ref.tint + ref.tintAmt;
      if (!tintCache[k]) {
        var c = FS.canvas(src.naturalWidth, src.naturalHeight), x = c.getContext('2d');
        x.drawImage(src, 0, 0); x.globalCompositeOperation = 'color'; x.globalAlpha = ref.tintAmt; x.fillStyle = ref.tint; x.fillRect(0, 0, c.width, c.height);
        x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); tintCache[k] = c;
      }
      src = tintCache[k];
    }
    ctx.save(); ctx.globalAlpha = ref.opacity == null ? 1 : ref.opacity;
    ctx.drawImage(src, 0, 0, d.w, d.h); ctx.restore();
  };

  /* put a frame on a page: page shape follows a PNG frame, the photo is fitted into the window, frame words are added */
  FS.setFrame = function (p, ref, opts) {
    var d = p.doc, im = FS.img(p.src); opts = opts || {};
    d.layers = d.layers.filter(function (L) { return !L.frameText; });
    d.frame = ref;
    if (ref && ref.kind === 'png') {
      var u = USER[ref.id];
      if (u && Math.abs(u.aspect - d.w / d.h) > 0.03) {
        var long = Math.max(d.w, d.h, 1800); FS.applyFormat(d, 'custom', null, u.aspect >= 1 ? long : long * u.aspect, u.aspect >= 1 ? long / u.aspect : long);
        if (!opts.quiet) FS.toast('גודל הדף הותאם לצורת המסגרת');
      }
    }
    if (ref && ref.kind === 'gen' && !opts.noTexts) {
      var def = FS.GEN_FRAMES.filter(function (f) { return f.id === ref.id; })[0];
      (def && def.texts || []).forEach(function (t, ti) {
        d.layers.push({ id: FS.uid(), link: 'ft' + ti, type: 'text', frameText: true, text: t.text, x: d.w / 2, y: d.h * t.y, size: Math.round(Math.min(d.w, d.h) * t.size * (d.h > d.w ? 1.2 : 1)),
          font: t.font, color: t.color, weight: t.weight || 700, strokeW: t.strokeW || 0, stroke: t.stroke || '#000', r: 0, opacity: 1, align: 'center' });
      });
    }
    if (im) FS.fitPhoto(d, im);
    if (FS.applyCredit && !opts.noCredit) FS.applyCredit(p);
    if (ref) { FS.prefs.lastFrame = ref; FS.savePrefs(); }
  };
})();
