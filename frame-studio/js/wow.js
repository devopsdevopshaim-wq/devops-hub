/* ✨ The living photo: a still photo becomes a few seconds of 3D. The person (the AI's person mask) is lifted off the background,
   the space behind them is filled from its surroundings, and a camera moves through the depth: the person comes forward,
   gold light floats between the layers, a sheen passes over, and the magnet's frame stays in place (or, in "pop out", the
   person breaks out of it). It plays full screen, follows the mouse or the phone's tilt, and saves as a video for the couple.
   All in this computer, no internet and no AI service: the person mask is the one the studio already makes. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var MODES = [['dolly', '🎥 תנועת מצלמה'], ['pop', '💥 יוצא מהמסגרת'], ['tilt', '🖐️ תלת־ממד חי']];
  var SEC = 6, FPS = 30;

  var MC = window.MagicCore;   /* the shared craft: fill behind, masks, light (magic-core.js) */
  /* everything the animation needs, made once */
  function prepare(p) {
    var d = p.doc, im = FS.img(p.src); if (!im) return Promise.reject(new Error('no-photo'));
    return FS.ensureMask(p).then(function (mask) {
      if (!mask || (p.maskCover || 0) < 0.02) throw new Error('no-person');
      var src = FS.processed(p, 1600) || im, sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
      var photo = FS.canvas(sw, sh); photo.getContext('2d').drawImage(src, 0, 0, sw, sh);
      var hard = MC.alpha(mask, sw, sh, 0), wide = MC.alpha(mask, sw, sh, Math.max(4, Math.round(Math.max(sw, sh) / 140)));
      var person = MC.cut(photo, hard), bg = MC.fillBehind(photo, wide);
      /* the page without the photo: the frame, texts and stickers stay on top, still */
      var long = Math.max(d.w, d.h), scale = Math.min(1, 1080 / long), W = Math.round(d.w * scale), H = Math.round(d.h * scale);
      var over = FS.canvas(W, H); FS.draw(over.getContext('2d'), p, { scale: scale, transparent: true, noPhoto: true, export: true });
      var hole = d.frame && FS.frameOf && FS.frameOf(d.frame, d);
      return { p: p, d: d, im: im, W: W, H: H, scale: scale, bg: bg, person: person, over: over, clip: hole && hole.clip ? hole : null, c: MC.centroid(mask), sw: sw, sh: sh, dots: MC.makeDots(46) };
    });
  }
  /* one frame. t: 0..1 over the loop; tilt: {x,y} -1..1 in the live mode */
  function frame(S, ctx, t, mode, tilt) {
    var d = S.d, W = S.W, H = S.H, k = S.scale, m = FS.photoMatrix(d, S.im), e = MC.swing(t);   /* there and back: a seamless loop */
    var ax = m.x + (S.c.x - 0.5) * m.iw * m.s, ay = m.y + (S.c.y - 0.5) * m.ih * m.s;   /* the person's centre on the page */
    var bz, pz, bdx, pdx, bdy, pdy;
    if (mode === 'tilt') { bz = 1.06; pz = 1.1; bdx = -tilt.x * 0.018 * d.w; pdx = tilt.x * 0.03 * d.w; bdy = -tilt.y * 0.014 * d.h; pdy = tilt.y * 0.022 * d.h; }
    else if (mode === 'pop') { bz = 1.02 + 0.05 * e; pz = 1.02 + 0.2 * e; bdx = 0; pdx = 0; bdy = 0.01 * d.h * e; pdy = -0.035 * d.h * e; }
    else { bz = 1.04 + 0.05 * e; pz = 1.05 + 0.14 * e; bdx = -0.02 * d.w * e; pdx = 0.025 * d.w * e; bdy = 0; pdy = -0.01 * d.h * e; }
    function layer(img, z, dx, dy) {
      ctx.save(); ctx.translate(ax + dx, ay + dy); ctx.scale(z, z); ctx.translate(-ax, -ay);
      ctx.translate(m.x, m.y); ctx.rotate(m.r); ctx.scale(m.s * m.fh, m.s * m.fv); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -m.iw / 2, -m.ih / 2, m.iw, m.ih); ctx.restore();
    }
    function dots(front) { MC.dots(ctx, S.dots, d.w, d.h, t, front); }
    ctx.save(); ctx.clearRect(0, 0, W, H); ctx.scale(k, k);
    ctx.fillStyle = d.bg || '#fff'; ctx.fillRect(0, 0, d.w, d.h);
    ctx.save(); if (S.clip) { S.clip.clip(ctx, FS.hole(d)); ctx.clip(); }
    layer(S.bg, bz, bdx, bdy);
    dots(false);
    if (mode !== 'pop') layer(S.person, pz, pdx, pdy);
    MC.sheen(ctx, d.w, d.h, t);
    ctx.restore();
    ctx.restore();
    ctx.drawImage(S.over, 0, 0, W, H);                       /* the frame and texts, still */
    if (mode === 'pop') {   /* in front of the frame: out of the magnet, over the top and the sides; the bottom stays inside, where the photo ends */
      var hb = (FS.hole && FS.hole(d)) || { y: 0, h: d.h };
      ctx.save(); ctx.scale(k, k); ctx.beginPath(); ctx.rect(-d.w, -d.h, d.w * 3, hb.y + hb.h + d.h); ctx.clip(); layer(S.person, pz, pdx, pdy); ctx.restore();
    }
    ctx.save(); ctx.scale(k, k); dots(true); ctx.restore();
    if (FS.planTier && FS.planTier() === 'free') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H - Math.round(H * 0.045), W, Math.round(H * 0.045)); ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(H * 0.024) + 'px Heebo, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('נוצר באופטימוס', W / 2, H - Math.round(H * 0.014)); ctx.restore(); }
  }

  /* the full-screen viewer */
  function open(p) {
    p = p || FS.cur(); if (!p) return FS.toast('קודם בוחרים תמונה עם אדם.');
    FS.busy && FS.busy('מכין תמונה חיה…');
    prepare(p).then(function (S) {
      FS.busy && FS.busy();
      var box = document.createElement('div'); box.className = 'wow';
      box.innerHTML = '<div class="wow-in"><canvas class="wow-cv" width="' + S.W + '" height="' + S.H + '"></canvas><div class="wow-bar">' +
        MODES.map(function (x, i) { return '<button data-m="' + x[0] + '"' + (i ? '' : ' class="on"') + '>' + x[1] + '</button>'; }).join('') +
        '<button class="wow-rec" data-rec>🎬 שמירת סרטון</button><button data-x aria-label="סגירה">✕</button></div><p class="wow-hint">התמונה הופכת לתלת־ממד: האדם יוצא מהרקע. "🖐️ תלת־ממד חי" זז עם העכבר או עם הטיית הטלפון.</p></div>';
      document.body.appendChild(box);
      var cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), mode = 'dolly', t0 = performance.now(), raf = 0, tilt = { x: 0, y: 0 }, want = { x: 0, y: 0 }, rec = null;
      function loop(now) { var t = ((now - t0) / 1000 / SEC) % 1; tilt.x += (want.x - tilt.x) * 0.08; tilt.y += (want.y - tilt.y) * 0.08; frame(S, ctx, t, mode, mode === 'tilt' && rec ? { x: Math.sin(t * 6.28), y: Math.cos(t * 6.28) * 0.5 } : tilt); raf = requestAnimationFrame(loop); }
      raf = requestAnimationFrame(loop);
      function move(e) { var r = cv.getBoundingClientRect(); want.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)); want.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)); }
      function orient(e) { if (e.gamma == null) return; want.x = Math.max(-1, Math.min(1, e.gamma / 25)); want.y = Math.max(-1, Math.min(1, (e.beta - 40) / 25)); }
      box.addEventListener('pointermove', move); window.addEventListener('deviceorientation', orient);
      function close() { cancelAnimationFrame(raf); window.removeEventListener('deviceorientation', orient); if (rec && rec.state === 'recording') rec.stop(); box.remove(); }
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.closest('[data-x]')) return close();
        var b = e.target.closest('[data-m]');
        if (b) { mode = b.dataset.m; t0 = performance.now(); $$(box, '[data-m]').forEach(function (x) { x.classList.toggle('on', x === b); });
          if (mode === 'tilt' && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(function () {}); return; }
        if (e.target.closest('[data-rec]')) record();
      });
      function record() {
        if (!cv.captureStream || !window.MediaRecorder) return FS.toast('הדפדפן לא יודע לשמור סרטון. בתוכנה במחשב או ב־Chrome זה עובד.', 6000);
        var type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(function (x) { return MediaRecorder.isTypeSupported(x); })[0];
        var chunks = [], btn = box.querySelector('[data-rec]');
        rec = new MediaRecorder(cv.captureStream(FPS), { mimeType: type, videoBitsPerSecond: 9000000 });
        rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onstop = function () {
          var blob = new Blob(chunks, { type: type.split(';')[0] }), a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = 'living-photo-' + (p.name || 'photo').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) + (/mp4/.test(type) ? '.mp4' : '.webm'); document.body.appendChild(a); a.click(); a.remove();
          btn.disabled = false; btn.textContent = '🎬 שמירת סרטון'; rec = null; FS.toast('✔ הסרטון נשמר. מושלם לוואטסאפ, לסטורי ולמסך הגדול.', 6000);
        };
        t0 = performance.now(); rec.start(); btn.disabled = true; btn.textContent = '⏺ מקליט…';
        setTimeout(function () { if (rec && rec.state === 'recording') rec.stop(); }, SEC * 2 * 1000 + 100);   /* two loops */
      }
    }).catch(function (e) {
      FS.busy && FS.busy();
      FS.toast(e && e.message === 'no-person' ? 'לא נמצא אדם בתמונה: התמונה החיה עובדת על תמונות עם אנשים.' : 'לא הצלחתי להכין את התמונה החיה (' + ((e && e.message) || '') + ').', 6000);
    });
  }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  FS.livingPhoto = open; FS.livingFrame = frame; FS.livingPrepare = prepare;
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-wow]'); if (b) { e.preventDefault(); open(); } });
})();
