/* The AI tab with no internet: everything here runs in the browser on the bundled models (MediaPipe for faces and
   people) and on designs drawn in code. One-click smart enhance, built-in backgrounds for background replacement and
   ready designs (a base frame in a colour plus a look). The cards that needed a server are hidden. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var pane = $('[data-pane=ai]'); if (!pane) return;

  /* the cards that called a server */
  ['#mg-prompt', '#gen-prompt', '#ai-ask'].forEach(function (s) { var el = $(s); var c = el && el.closest('.card'); if (c) c.hidden = true; });
  var ga = $('#greet-ai'); if (ga) ga.hidden = true;

  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function lin(x, w, h, stops, vertical) { var g = vertical === false ? x.createLinearGradient(0, 0, w, 0) : x.createLinearGradient(0, 0, 0, h); stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); }); return g; }
  function bokeh(x, w, h, r, cols, n, max) { for (var i = 0; i < n; i++) { var cx = r() * w, cy = r() * h, rad = (0.2 + r() * 0.8) * max, g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); var c = cols[i % cols.length]; g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.25 + r() * 0.5; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1; }

  /* each background paints a 1200×1600 canvas; the photo pipeline fits it to the page */
  var BGS = [
    ['gold', 'זהב בוקה', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#1a1208', '#3a2a10', '#120c05']); x.fillRect(0, 0, w, h); bokeh(x, w, h, r, ['rgba(255,214,120,.9)', 'rgba(255,190,80,.8)', 'rgba(255,240,190,.9)'], 70, 120); } ],
    ['pink', 'ורוד פסטל', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#ffe3ec', '#f9c6d6', '#fde8f0']); x.fillRect(0, 0, w, h); bokeh(x, w, h, r, ['rgba(255,255,255,.9)', 'rgba(255,200,220,.8)'], 40, 140); } ],
    ['sky', 'שמיים ועננים', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#3f8ee0', '#8cc4f2', '#e3f2fd']); x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.85)'; for (var i = 0; i < 9; i++) { var cx = r() * w, cy = r() * h * 0.7, s = 60 + r() * 90; for (var k = 0; k < 6; k++) { x.beginPath(); x.arc(cx + (k - 2.5) * s * 0.55, cy + Math.sin(k) * s * 0.25, s * (0.5 + r() * 0.4), 0, Math.PI * 2); x.fill(); } } } ],
    ['sunset', 'שקיעה', function (x, w, h) { x.fillStyle = lin(x, w, h, ['#2b1055', '#d53369', '#ff8c42', '#ffd166']); x.fillRect(0, 0, w, h); var g = x.createRadialGradient(w / 2, h * 0.72, 0, w / 2, h * 0.72, w * 0.5); g.addColorStop(0, 'rgba(255,245,200,.95)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(40,10,40,.75)'; x.fillRect(0, h * 0.86, w, h * 0.14); } ],
    ['beach', 'ים וחוף', function (x, w, h, r) { x.fillStyle = lin(x, w, h * 0.5, ['#5fb3f0', '#bfe3fb']); x.fillRect(0, 0, w, h * 0.5); x.fillStyle = lin(x, w, h, ['#1d7fb8', '#36a6d6']); x.fillRect(0, h * 0.5, w, h * 0.22); x.fillStyle = 'rgba(255,255,255,.6)'; for (var i = 0; i < 40; i++) x.fillRect(r() * w, h * 0.5 + r() * h * 0.22, 30 + r() * 80, 3); x.fillStyle = lin(x, w, h, ['#f3dcae', '#e7c98f']); x.fillRect(0, h * 0.72, w, h * 0.28); } ],
    ['night', 'לילה וכוכבים', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#050816', '#14204a', '#2a1b4d']); x.fillRect(0, 0, w, h); for (var i = 0; i < 420; i++) { x.globalAlpha = 0.3 + r() * 0.7; x.fillStyle = '#fff'; var s = r() * 2.6; x.fillRect(r() * w, r() * h, s, s); } x.globalAlpha = 1; } ],
    ['marble', 'שיש לבן', function (x, w, h, r) { x.fillStyle = '#f4f2ee'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,120,130,.25)'; for (var i = 0; i < 26; i++) { x.lineWidth = 1 + r() * 3; x.beginPath(); var px = r() * w, py = 0; x.moveTo(px, py); while (py < h) { px += (r() - 0.5) * 90; py += 40 + r() * 60; x.lineTo(px, py); } x.stroke(); } } ],
    ['wood', 'עץ חם', function (x, w, h, r) { var n = 9, pw = w / n; for (var i = 0; i < n; i++) { var c = 110 + r() * 40; x.fillStyle = 'rgb(' + Math.round(c + 40) + ',' + Math.round(c * 0.62) + ',' + Math.round(c * 0.35) + ')'; x.fillRect(i * pw, 0, pw, h); x.strokeStyle = 'rgba(60,30,10,.25)'; for (var k = 0; k < 14; k++) { x.lineWidth = 1 + r() * 2; x.beginPath(); var xx = i * pw + r() * pw; x.moveTo(xx, 0); x.bezierCurveTo(xx + 20, h / 3, xx - 20, h * 2 / 3, xx + (r() - 0.5) * 30, h); x.stroke(); } x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i * pw, 0, 3, h); } } ],
    ['silver', 'נצנצים כסופים', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#9aa0a8', '#e6e8eb', '#8d939b']); x.fillRect(0, 0, w, h); for (var i = 0; i < 2600; i++) { x.globalAlpha = r(); x.fillStyle = r() > 0.5 ? '#ffffff' : '#5c6168'; x.fillRect(r() * w, r() * h, 3, 3); } x.globalAlpha = 1; bokeh(x, w, h, r, ['rgba(255,255,255,.9)'], 30, 70); } ],
    ['flowers', 'פרחים', function (x, w, h, r) { x.fillStyle = '#fbf3ea'; x.fillRect(0, 0, w, h); var cols = ['#f4a3b8', '#f7c873', '#c9a3e8', '#9fd4b5', '#f28c8c']; for (var i = 0; i < 46; i++) { var cx = r() * w, cy = r() * h, s = 30 + r() * 60, c = cols[i % cols.length]; x.fillStyle = c; for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; x.beginPath(); x.ellipse(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6, s * 0.5, s * 0.3, a, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#f5d76e'; x.beginPath(); x.arc(cx, cy, s * 0.28, 0, Math.PI * 2); x.fill(); } } ],
    ['confetti', 'קונפטי', function (x, w, h, r) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); var cols = ['#ff3d7f', '#ffc93c', '#3dc1ff', '#7ad151', '#9b5de5']; for (var i = 0; i < 380; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate(r() * Math.PI); x.fillStyle = cols[i % cols.length]; if (i % 3) x.fillRect(-10, -4, 20, 8); else { x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill(); } x.restore(); } } ],
    ['studio', 'סטודיו אפור', function (x, w, h) { var g = x.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, h * 0.8); g.addColorStop(0, '#9a9ca2'); g.addColorStop(1, '#2b2c30'); x.fillStyle = g; x.fillRect(0, 0, w, h); } ],
    ['blue', 'כחול מלכותי', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#0d1b4c', '#1f4e8c', '#0a1638']); x.fillRect(0, 0, w, h); bokeh(x, w, h, r, ['rgba(120,180,255,.8)', 'rgba(255,255,255,.7)'], 50, 110); } ],
    ['green', 'גן ירוק', function (x, w, h, r) { x.fillStyle = lin(x, w, h, ['#cfe8b8', '#7fb36a', '#3f6b3a']); x.fillRect(0, 0, w, h); bokeh(x, w, h, r, ['rgba(255,255,220,.8)', 'rgba(170,220,140,.8)'], 60, 130); } ]
  ];
  var made = {};
  function bgSrc(b) { if (made[b[0]]) return made[b[0]]; var c = FS.canvas(1200, 1600), x = c.getContext('2d'); b[2](x, 1200, 1600, rnd(7 + b[0].length * 131)); return (made[b[0]] = c.toDataURL('image/jpeg', 0.86)); }
  function thumb(b) { var c = FS.canvas(120, 160), x = c.getContext('2d'); b[2](x, 120, 160, rnd(7 + b[0].length * 131)); return c.toDataURL('image/jpeg', 0.8); }

  function useBg(b) {
    var list = FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    FS.busy('✂️ מחליף רקע…');
    FS.loadImg(bgSrc(b)).then(function (im) {
      var chain = Promise.resolve();
      list.forEach(function (p) { chain = chain.then(function () { return FS.ensureMask(p).then(function () { p.doc.photo.bg = Object.assign({ color: '#ffffff' }, p.doc.photo.bg, { mode: 'image', src: im.src }); p.cache = {}; if (p !== FS.cur()) FS.snap(p); }); }); });
      return chain;
    }).then(function () { FS.busy(); $$('#bg-modes [data-bg]').forEach(function (x) { x.classList.toggle('on', x.dataset.bg === 'image'); }); FS.changed(); FS.toast('🖼️ רקע "' + b[1] + '"' + (list.length > 1 ? ' על ' + list.length + ' תמונות' : ''), 3000); }, function () { FS.busy(); });
  }

  /* ready designs: a base frame in a colour and a look from the instant looks */
  var DESIGNS = [
    ['wed', 'חתונה קלאסית', '💍', 'w-classic', '#ffffff', 'clean'],
    ['lux', 'זהב יוקרתי', '👑', 'w-wide', '#c9a45c', 'warmglow'],
    ['noir', 'שחור־לבן אלגנטי', '🖤', 'w-thin', '#111111', 'bwclassic'],
    ['retro', 'וינטג׳ חם', '🎞️', 'w-round', '#f3e9d2', 'portra'],
    ['bar', 'בר מצווה כחול', '✡️', 'w-band', '#1f4e8c', 'vivid'],
    ['pola', 'פולארויד', '📷', 'w-band', '#ffffff', 'kodak'],
    ['pop', 'פופ צבעוני', '🎉', 'w-thin', '#ff3d7f', 'vivid'],
    ['love', 'רומנטי אובלי', '💗', 'w-oval', '#f6d6de', 'airy']
  ];
  function lookOf(id) { return (FS.LOCAL_LOOKS || []).filter(function (l) { return l[0] === id; })[0]; }
  function useDesign(d) {
    var list = FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    FS.useFrame({ kind: 'gen', id: d[3], color: d[4], thick: 1, opacity: 1 });
    var look = lookOf(d[5]); if (!look) return;
    FS.busy('🎨 ' + d[1] + '…');
    var chain = Promise.resolve();
    list.forEach(function (p) { chain = chain.then(function () { return FS.applyLook(p, look).then(function () { p.cache = {}; if (p !== FS.cur()) FS.snap(p); }); }); });
    chain.then(function () { FS.busy(); FS.changed(); FS.toast('🎨 ' + d[1] + (list.length > 1 ? ' על ' + list.length + ' תמונות' : ''), 3000); }, function () { FS.busy(); });
  }

  /* one click: light, colour, skin on the faces found, sharpening and centring on the faces */
  function smartFix() {
    var list = FS.targets(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
    FS.busy('⚡ שיפור חכם…');
    var chain = Promise.resolve();
    list.forEach(function (p) {
      chain = chain.then(function () {
        var a = FS.softAuto ? FS.softAuto(p) : FS.autoAdjust(p); a.sharpen = 12; a.clarity = 6; a.vibrance = 8; p.doc.photo.adj = a;
        return FS.findFaces(p, true).then(function (faces) {
          if (faces && faces.length) p.doc.photo.skin = { amt: 30, faces: faces.map(function (f) { return { x: f.x, y: f.y, w: f.w, h: f.h }; }) };
          return FS.smartFit ? FS.smartFit(p, true) : null;
        }, function () { return null; }).then(function () { p.cache = {}; if (p !== FS.cur()) FS.snap(p); });
      });
    });
    chain.then(function () { FS.busy(); FS.changed(); FS.toast('⚡ שופר: אור, צבע, עור וחדות' + (list.length > 1 ? ' · ' + list.length + ' תמונות' : ''), 3000); }, function () { FS.busy(); });
  }

  var head = document.createElement('div');
  head.innerHTML =
    '<p class="ai-offline">🔒 הכול עובד בלי אינטרנט, על המחשב שלך</p>' +
    '<div class="card"><h3>⚡ שיפור חכם בלחיצה</h3><p class="hint">אור, צבע, ריטוש עור, חדות ומרכוז לפי הפנים. על התמונה או על כל המסומנות.</p><button class="btn primary wide" id="ai-smart">⚡ לשפר עכשיו</button></div>' +
    '<div class="card"><h3>🎨 עיצובים מובנים</h3><p class="hint">מסגרת בצבע ומראה מוכן, בלחיצה אחת.</p><div class="ai-designs" id="ai-designs"></div></div>' +
    '<div class="card"><h3>🌄 רקעים מובנים</h3><p class="hint">מזהה את האנשים ומחליף את הרקע לאחד מאלה.</p><div class="ai-bgs" id="ai-bgs"></div></div>';
  var h2 = $('h2', pane); h2.after.apply(h2, Array.prototype.slice.call(head.childNodes));
  DESIGNS.forEach(function (d) {
    var b = document.createElement('button'); b.className = 'tile ai-design'; b.innerHTML = '<i class="emo">' + d[2] + '</i><span>' + FS.esc(d[1]) + '</span>';
    b.style.setProperty('--c', d[4]); b.addEventListener('click', function () { useDesign(d); }); $('#ai-designs').appendChild(b);
  });
  BGS.forEach(function (bg) {
    var b = document.createElement('button'); b.className = 'ai-bg'; b.title = bg[1];
    b.innerHTML = '<img alt="" src="' + thumb(bg) + '"><span>' + FS.esc(bg[1]) + '</span>';
    b.addEventListener('click', function () { useBg(bg); }); $('#ai-bgs').appendChild(b);
  });
  $('#ai-smart').addEventListener('click', smartFix);
  FS.AI_BGS = BGS; FS.AI_DESIGNS = DESIGNS; FS.smartFix = smartFix;
})();
