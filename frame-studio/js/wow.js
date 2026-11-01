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

  /* the space behind the person, filled from around it: push-pull over a pyramid (transparent pixels take their neighbours' colour) */
  function fillBehind(src, hole) {
    var w = src.width, h = src.height, levels = [], c = FS.canvas(w, h), x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(hole, 0, 0, w, h); x.globalCompositeOperation = 'source-over';
    levels.push(c);
    var lw = w, lh = h;
    while (lw > 4 && lh > 4 && levels.length < 12) { lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); var n = FS.canvas(lw, lh), nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(levels[levels.length - 1], 0, 0, lw, lh); levels.push(n); }
    for (var i = levels.length - 2; i >= 0; i--) { var L = levels[i], lx = L.getContext('2d'); lx.globalCompositeOperation = 'destination-over'; lx.imageSmoothingQuality = 'high'; lx.drawImage(levels[i + 1], 0, 0, L.width, L.height); lx.globalCompositeOperation = 'source-over'; }
    return levels[0];
  }
  /* the mask a little wider (so no edge of the person stays behind) and a soft version for the cut */
  function grow(mask, w, h, px) {
    var c = FS.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.filter = 'blur(' + px + 'px)'; x.drawImage(mask, 0, 0, w, h); x.filter = 'none';
    var d = x.getImageData(0, 0, w, h), a = d.data; for (var i = 0; i < a.length; i += 4) { var v = Math.min(255, a[i] * 3); a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = v; }   /* blurred ×3: wider than the person */
    x.putImageData(d, 0, 0); return c;
  }
  function alphaOf(gray) { /* white = person → alpha */
    var x = gray.getContext('2d', { willReadFrequently: true }), d = x.getImageData(0, 0, gray.width, gray.height), a = d.data;
    for (var i = 0; i < a.length; i += 4) { a[i + 3] = a[i]; a[i] = a[i + 1] = a[i + 2] = 255; }
    x.putImageData(d, 0, 0); return gray;
  }
  function centroid(mask) {
    var s = 64, c = FS.canvas(s, s), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(mask, 0, 0, s, s);
    var a = x.getImageData(0, 0, s, s).data, sx = 0, sy = 0, t = 0, top = s;
    for (var y = 0; y < s; y++) for (var k = 0; k < s; k++) { var v = a[(y * s + k) * 4] / 255; if (v > 0.4) { sx += k * v; sy += y * v; t += v; if (y < top) top = y; } }
    return t ? { x: sx / t / s, y: sy / t / s, top: top / s, cover: t / (s * s) } : { x: 0.5, y: 0.5, top: 0.3, cover: 0 };
  }

  /* everything the animation needs, made once */
  function prepare(p) {
    var d = p.doc, im = FS.img(p.src); if (!im) return Promise.reject(new Error('no-photo'));
    return FS.ensureMask(p).then(function (mask) {
      if (!mask || (p.maskCover || 0) < 0.02) throw new Error('no-person');
      var src = FS.processed(p, 1600) || im, sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
      var photo = FS.canvas(sw, sh); photo.getContext('2d').drawImage(src, 0, 0, sw, sh);
      var hard = alphaOf((function () { var c = FS.canvas(sw, sh); c.getContext('2d').drawImage(mask, 0, 0, sw, sh); return c; })());
      var wide = grow(mask, sw, sh, Math.max(4, Math.round(Math.max(sw, sh) / 140)));
      var person = FS.canvas(sw, sh), px = person.getContext('2d'); px.drawImage(photo, 0, 0); px.globalCompositeOperation = 'destination-in'; px.drawImage(hard, 0, 0); px.globalCompositeOperation = 'source-over';
      var bg = fillBehind(photo, wide);
      /* the page without the photo: the frame, texts and stickers stay on top, still */
      var long = Math.max(d.w, d.h), scale = Math.min(1, 1080 / long), W = Math.round(d.w * scale), H = Math.round(d.h * scale);
      var over = FS.canvas(W, H); FS.draw(over.getContext('2d'), p, { scale: scale, transparent: true, noPhoto: true, export: true });
      var hole = d.frame && FS.frameOf && FS.frameOf(d.frame, d);
      return { p: p, d: d, im: im, W: W, H: H, scale: scale, bg: bg, person: person, over: over, clip: hole && hole.clip ? hole : null, c: centroid(mask), sw: sw, sh: sh,
        dots: Array.from({ length: 46 }, function (_, i) { return { x: Math.random(), y: Math.random(), r: 0.004 + Math.random() * 0.012, s: 0.25 + Math.random() * 0.9, ph: Math.random() * 6.28, front: i % 4 === 0 }; }) };
    });
  }
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  /* one frame. t: 0..1 over the loop; tilt: {x,y} -1..1 in the live mode */
  function frame(S, ctx, t, mode, tilt) {
    var d = S.d, W = S.W, H = S.H, k = S.scale, m = FS.photoMatrix(d, S.im), e = ease(t < 0.5 ? t * 2 : 2 - t * 2);   /* there and back: a seamless loop */
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
    function dots(front) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      S.dots.forEach(function (o) {
        if (!!o.front !== front) return;
        var y = ((o.y - t * o.s) % 1 + 1) % 1, x = o.x + Math.sin(t * 6.28 + o.ph) * 0.02, r = o.r * Math.min(d.w, d.h) * (front ? 1.6 : 1), a = 0.25 + 0.35 * Math.sin(t * 12.56 + o.ph) ** 2;
        var g = ctx.createRadialGradient(x * d.w, y * d.h, 0, x * d.w, y * d.h, r);
        g.addColorStop(0, 'rgba(255,236,190,' + a + ')'); g.addColorStop(0.4, 'rgba(227,196,138,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(227,196,138,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * d.w, y * d.h, r, 0, 6.29); ctx.fill();
      });
      ctx.restore();
    }
    ctx.save(); ctx.clearRect(0, 0, W, H); ctx.scale(k, k);
    ctx.fillStyle = d.bg || '#fff'; ctx.fillRect(0, 0, d.w, d.h);
    ctx.save(); if (S.clip) { S.clip.clip(ctx, FS.hole(d)); ctx.clip(); }
    layer(S.bg, bz, bdx, bdy);
    dots(false);
    if (mode !== 'pop') layer(S.person, pz, pdx, pdy);
    /* the sheen: a soft diagonal light passing once per loop */
    var st = (t * 1.6) % 1.6 - 0.3; if (st > -0.3 && st < 1.3) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; var gx = st * d.w * 1.4; var g = ctx.createLinearGradient(gx - d.w * 0.3, 0, gx + d.w * 0.1, d.h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,248,225,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, d.w, d.h); ctx.restore(); }
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
