/* 🧩 The live mosaic (wall.html?…&mosaic=1): on the hall's big screen the couple's photo is built, tile by tile, out of the
   guests' photos. Every new photo flies into its place; the more photos, the clearer the couple; at the end ("R" or the
   button, or when it is full) the reveal. The couple's photo is the one the studio chose ("💞 תמונת הזוג לפסיפס"). */
(function () {
  'use strict';
  if (!/[?&]mosaic=1/.test(location.search)) return;
  var L = window.FL, stage = document.getElementById('stage'), cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  var hero = null, tones = null, cols = 0, rows = 0, cw = 0, ch = 0, order = [], tiles = [], filled = 0, photos = [], seen = {}, since = 0, flying = [], reveal = 0, revealAt = 0, title = '';
  document.body.classList.add('mosaic');
  stage.innerHTML = ''; stage.appendChild(cv); cv.className = 'mz-cv';
  var bar = document.createElement('div'); bar.className = 'mz-bar'; bar.innerHTML = '<span id="mz-n"></span><button type="button" id="mz-go">💞 חשיפה</button>'; document.body.appendChild(bar);
  document.getElementById('mz-go').addEventListener('click', function () { if (!revealAt) revealAt = performance.now(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'r' || e.key === 'R' || e.key === 'ר') document.getElementById('mz-go').click(); });
  function img(u) { return new Promise(function (ok) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = u; }); }

  function size() {
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    if (!hero) return;
    /* the couple's photo fills the screen's height; the grid follows its shape */
    var ar = hero.naturalWidth / hero.naturalHeight, ph = cv.height * 0.92, pw = ph * ar; if (pw > cv.width * 0.96) { pw = cv.width * 0.96; ph = pw / ar; }
    cols = Math.max(12, Math.round(28 * Math.min(1.6, ar))); cw = pw / cols; rows = Math.max(12, Math.round(ph / cw)); ch = ph / rows;
    var t = document.createElement('canvas'); t.width = cols; t.height = rows; var tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(hero, 0, 0, cols, rows); tones = tx.getImageData(0, 0, cols, rows).data;
    if (order.length !== cols * rows) { order = Array.from({ length: cols * rows }, function (_, i) { return i; }); for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = order[i]; order[i] = order[j]; order[j] = x; } tiles = new Array(cols * rows); filled = 0; photos.forEach(function (p, k) { place(p, false); }); }
  }
  window.addEventListener('resize', size);
  /* a photo takes cells: early photos take several (the picture starts to show quickly), later ones one each */
  function place(p, fly) {
    var total = cols * rows; if (!total || !p.thumb) return;
    var take = Math.max(1, Math.round(total / Math.max(40, photos.length * 1.2)));
    for (var k = 0; k < take; k++) {
      var cell = filled < total ? order[filled++] : order[Math.floor(Math.random() * total)];
      tiles[cell] = p.thumb;
      if (fly && k === 0) flying.push({ cell: cell, thumb: p.thumb, t0: performance.now() });
    }
  }
  function thumb(i) { var s = 96, c = document.createElement('canvas'); c.width = s; c.height = s; var x = c.getContext('2d'), m = Math.min(i.naturalWidth, i.naturalHeight); x.drawImage(i, (i.naturalWidth - m) / 2, (i.naturalHeight - m) * 0.35, m, m, 0, 0, s, s); return c; }
  function poll(first) {
    return L.call({ action: 'feed', e: L.e, v: L.v, since: since }).then(function (r) {
      if (!r.ok) return;
      title = r.title; document.getElementById('w-title').textContent = r.title;
      document.getElementById('w-biz').textContent = r.biz && r.biz.name ? r.biz.name + ' · פסיפס חי' : '';
      if (first && r.k) L.qr(L.site('live.html?e=' + L.e + '&k=' + r.k), 360).then(function (c) { var t = document.getElementById('w-qrc'); if (!t) return; t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); document.getElementById('w-qr').hidden = false; }).catch(function () {});
      if (first && !r.hero) { stage.insertAdjacentHTML('beforeend', '<div class="w-empty">בוחרים בסטודיו "💞 תמונת הזוג לפסיפס", ומרעננים את המסך.</div>'); return; }
      return (first ? L.base.then(function (u) { return img(u + '/frame-live-img?e=' + L.e + '&v=' + L.v + '&h=1'); }).then(function (h) { hero = h; size(); }) : Promise.resolve()).then(function () {
        var news = r.photos.filter(function (p) { return !seen[p.id]; });
        return news.reduce(function (ch2, p) {
          seen[p.id] = 1; since = Math.max(since, p.at);
          return ch2.then(function () { return L.img(p.id); }).then(img).then(function (i) { if (!i) return; p.thumb = thumb(i); photos.push(p); place(p, !first); });
        }, Promise.resolve());
      });
    }).then(function () { var n = document.getElementById('mz-n'); if (n && cols) n.textContent = '🧩 ' + photos.length + ' תמונות · ' + Math.round(Math.min(1, filled / (cols * rows)) * 100) + '%'; });
  }
  function draw(now) {
    var W = cv.width, H = cv.height; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H);
    if (hero && tones) {
      var ox = (W - cols * cw) / 2, oy = (H - rows * ch) / 2, total = cols * rows, frac = Math.min(1, filled / total);
      if (!revealAt && filled >= total && photos.length >= 20) revealAt = now + 4000;
      reveal = revealAt && now > revealAt ? Math.min(1, (now - revealAt) / 3500) : 0;
      for (var c = 0; c < total; c++) {
        var x = ox + (c % cols) * cw, y = oy + Math.floor(c / cols) * ch, r = tones[c * 4], g = tones[c * 4 + 1], b = tones[c * 4 + 2];
        if (tiles[c]) { ctx.drawImage(tiles[c], x, y, cw + 0.5, ch + 0.5); ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.5 + 0.2 * frac) + ')'; ctx.fillRect(x, y, cw + 0.5, ch + 0.5); }
        else { ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',.08)'; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
      }
      /* the couple shows through as the mosaic fills; at the reveal, all of it */
      ctx.save(); ctx.globalAlpha = 0.18 * frac + 0.6 * reveal; ctx.drawImage(hero, ox, oy, cols * cw, rows * ch); ctx.restore();
      /* new photos fly in from the middle */
      flying = flying.filter(function (f) {
        var t = (now - f.t0) / 1400; if (t >= 1) return false;
        var e = 1 - Math.pow(1 - t, 3), tx = ox + (f.cell % cols) * cw, ty = oy + Math.floor(f.cell / cols) * ch, s0 = Math.min(W, H) * 0.35, sz = s0 + (cw - s0) * e;
        var x2 = W / 2 - s0 / 2 + (tx - (W / 2 - s0 / 2)) * e, y2 = H / 2 - s0 / 2 + (ty - (H / 2 - s0 / 2)) * e;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30 * (1 - e); ctx.drawImage(f.thumb, x2, y2, sz, sz * ch / cw); ctx.restore(); return true;
      });
      if (reveal > 0) {
        ctx.save(); ctx.globalAlpha = reveal; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H * 0.78, W, H * 0.16);
        ctx.fillStyle = '#F3DDA6'; ctx.font = '800 ' + Math.round(H * 0.06) + 'px Heebo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💞 ' + title, W / 2, H * 0.86); ctx.restore();
        if (window.MagicCore) MagicCore.sheen(ctx, W, H, ((now - revealAt) / 5000) % 1);
      }
    }
    requestAnimationFrame(draw);
  }
  size(); poll(true).then(function () { setInterval(poll, 6000); }); requestAnimationFrame(draw);
})();
