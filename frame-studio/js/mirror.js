/* 🪞 The magic mirror (mirror.html): a tablet or a laptop with a camera at the event. Guests see themselves live inside the
   event's magnet, the background swapped as they like (the person cut live, on this device), then a 3-2-1 and the photo goes
   to the print queue like any guest's photo. Opened from the studio (the event's guests' key in the link; the magnet's frame
   from the studio, kept in this browser). The camera never leaves this device until the guest presses "להדפסה". */
(function () {
  'use strict';
  var L = window.FL, $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), ctx = cv.getContext('2d'), video = document.createElement('video'), seg = null, maskC = document.createElement('canvas'), bgImg = null, bg = 'gold', shot = null, t0 = performance.now();
  var over = null, W = 1200, H = 1800, hole = { x: 0, y: 0, w: W, h: H };
  /* the event's magnet frame: from the studio in this browser, or sent by the desktop program's window */
  function setFrame(F) {
    if (!F || !F.w || !F.h) return;
    W = Math.round(F.w); H = Math.round(F.h); hole = F.hole || { x: 0, y: 0, w: W, h: H }; cv.width = W; cv.height = H;
    if (F.src && /^data:image\/png;base64,/.test(F.src)) { over = new Image(); over.src = F.src; }
  }
  try { setFrame(JSON.parse(localStorage.getItem('fs-mirror-frame') || 'null')); } catch (e) { /* no frame */ }
  window.addEventListener('message', function (e) { if (e.data && e.data.mirrorFrame) { setFrame(e.data.mirrorFrame); try { localStorage.setItem('fs-mirror-frame', JSON.stringify(e.data.mirrorFrame)); } catch (er) { /* full */ } } });
  cv.width = W; cv.height = H;
  var dots = Array.from({ length: 60 }, function () { return { x: Math.random(), y: Math.random(), r: 0.01 + Math.random() * 0.03, s: 0.03 + Math.random() * 0.08, ph: Math.random() * 6.28 }; });
  var BGS = [['real', '📷 בלי'], ['blur', '🌫️ מטושטש'], ['gold', '✨ אורות זהב'], ['night', '🌌 לילה'], ['pastel', '🌸 פסטל'], ['own', '🖼️ תמונה משלי']];
  function msg(t) { $('msg').hidden = !t; $('msg').textContent = t || ''; }
  if (!L.e || !L.k) { msg('פותחים את המראה מתוך הסטודיו (לשונית אירוע חי ← 🪞 מראה קסם).'); return; }

  /* the camera and the live person cut (MediaPipe, shipped with the site) */
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }).then(function (st) {
    video.srcObject = st; video.muted = true; video.playsInline = true; return video.play();
  }).then(function () {
    msg('טוען את הקסם…');
    var MP = new URL('vendor/mediapipe', location.href).href;
    return import(MP + '/vision_bundle.mjs').then(function (m) { return m.FilesetResolver.forVisionTasks(MP + '/wasm').then(function (fs) {
      var opt = function (d) { return { baseOptions: { modelAssetPath: new URL('models/selfie_segmenter.tflite', location.href).href, delegate: d }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false }; };
      return m.ImageSegmenter.createFromOptions(fs, opt('GPU')).catch(function () { return m.ImageSegmenter.createFromOptions(fs, opt('CPU')); });
    }); });
  }).then(function (s) { seg = s; msg(''); $('bar').hidden = false; chips(); requestAnimationFrame(loop); })
    .catch(function (e) { msg(String(e && e.name) === 'NotAllowedError' ? 'צריך לאשר גישה למצלמה.' : 'המצלמה או רכיב הקסם לא נטענו (' + ((e && e.message) || '') + ').'); if (video.srcObject) { $('bar').hidden = false; chips(); requestAnimationFrame(loop); } });

  function chips() {
    $('bgs').innerHTML = BGS.map(function (b) { return '<button data-bg="' + b[0] + '"' + (b[0] === bg ? ' class="on"' : '') + '>' + b[1] + '</button>'; }).join('');
  }
  $('bgs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bg]'); if (!b) return;
    if (b.dataset.bg === 'own') return $('bgfile').click();
    bg = b.dataset.bg; chips();
  });
  $('bgfile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var i = new Image(); i.onload = function () { bgImg = i; bg = 'own'; chips(); }; i.src = URL.createObjectURL(f); });

  /* the video, cover-fitted into the frame's window; mirrored on the screen like a mirror, straight in the photo */
  function cover(x, w, h, mirror) {
    var vw = video.videoWidth || 4, vh = video.videoHeight || 3, s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s;
    x.save(); if (mirror) { x.translate(hole.x * 2 + w, 0); x.scale(-1, 1); }
    x.drawImage(video, hole.x + (w - dw) / 2, hole.y + (h - dh) / 2, dw, dh); x.restore();
  }
  function backdrop(x, t, mirror) {
    var w = hole.w, h = hole.h;
    if (bg === 'real' || bg === 'blur') { x.save(); if (bg === 'blur') x.filter = 'blur(' + Math.round(w / 45) + 'px)'; cover(x, w, h, mirror); x.restore(); return; }
    if (bg === 'own' && bgImg) { var s = Math.max(w / bgImg.width, h / bgImg.height); x.drawImage(bgImg, hole.x + (w - bgImg.width * s) / 2, hole.y + (h - bgImg.height * s) / 2, bgImg.width * s, bgImg.height * s); return; }
    var g = x.createLinearGradient(hole.x, hole.y, hole.x, hole.y + h);
    if (bg === 'night') { g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#2a1f45'); } else if (bg === 'pastel') { g.addColorStop(0, '#fde2e4'); g.addColorStop(1, '#cddafd'); } else { g.addColorStop(0, '#2a1d0e'); g.addColorStop(1, '#6b4a1e'); }
    x.fillStyle = g; x.fillRect(hole.x, hole.y, w, h);
    x.save(); x.globalCompositeOperation = bg === 'pastel' ? 'source-over' : 'screen';
    dots.forEach(function (o) {
      var px = hole.x + o.x * w, py = hole.y + (((o.y - t * o.s) % 1 + 1) % 1) * h, r = o.r * Math.min(w, h), a = 0.35 + 0.35 * Math.sin(t * 3 + o.ph);
      var gr = x.createRadialGradient(px, py, 0, px, py, r), c = bg === 'night' ? '200,215,255' : bg === 'pastel' ? '255,255,255' : '255,220,150';
      gr.addColorStop(0, 'rgba(' + c + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)'); x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 6.29); x.fill();
    });
    x.restore();
  }
  /* the person, cut by the live mask */
  function person(x, mirror) {
    var w = hole.w, h = hole.h, pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    var p = pc.getContext('2d'); cover(p, w, h, mirror);
    var vw = video.videoWidth || 4, vh = video.videoHeight || 3, s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s;
    p.globalCompositeOperation = 'destination-in'; p.save(); if (mirror) { p.translate(hole.x * 2 + w, 0); p.scale(-1, 1); }
    p.filter = 'blur(2px)'; p.drawImage(maskC, hole.x + (w - dw) / 2, hole.y + (h - dh) / 2, dw, dh); p.restore();
    x.drawImage(pc, 0, 0);
  }
  function compose(x, t, mirror, withFrame) {
    x.clearRect(0, 0, W, H); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.save(); x.beginPath(); x.rect(hole.x, hole.y, hole.w, hole.h); x.clip();
    backdrop(x, t, mirror);
    if (bg !== 'real' && seg) person(x, mirror); else if (bg !== 'real') cover(x, hole.w, hole.h, mirror);
    x.restore();
    if (withFrame && over && over.complete) x.drawImage(over, 0, 0, W, H);
  }
  function loop(now) {
    if (shot) return;
    if (seg && video.readyState >= 2 && bg !== 'real') {
      try {
        var r = seg.segmentForVideo(video, now), m = r.confidenceMasks[0], mw = m.width, mh = m.height, f = m.getAsFloat32Array();
        if (maskC.width !== mw) { maskC.width = mw; maskC.height = mh; }
        var mx = maskC.getContext('2d'), id = mx.createImageData(mw, mh);
        for (var i = 0; i < f.length; i++) { var v = Math.max(0, Math.min(1, (f[i] - 0.25) / 0.5)); id.data[i * 4 + 3] = v * 255; }
        mx.putImageData(id, 0, 0); if (r.close) r.close();
      } catch (e) { /* a dropped frame */ }
    }
    compose(ctx, (now - t0) / 1000, true, true);
    requestAnimationFrame(loop);
  }

  /* 3-2-1, the flash, and the photo (without the frame: the station puts the event's design on it, like every guest photo) */
  $('shoot').addEventListener('click', function () {
    $('bar').hidden = true; var n = 3, c = $('count');
    (function tick() {
      if (n === 0) {
        c.hidden = true; var f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
        var out = document.createElement('canvas'); out.width = hole.w; out.height = hole.h; var ox = out.getContext('2d'); ox.translate(-hole.x, -hole.y);
        compose(ox, (performance.now() - t0) / 1000, false, false); shot = out; shot0 = out; look = 'none'; looks();
        ctx.save(); ctx.drawImage(out, hole.x, hole.y); if (over && over.complete) ctx.drawImage(over, 0, 0, W, H); ctx.restore();
        $('after').hidden = false; return;
      }
      c.hidden = false; c.textContent = n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; n--; setTimeout(tick, 900);
    })();
  });
  /* after the photo: real edits on it before it goes to print (the funny effects on the faces, and the built-in AI styles) */
  var shot0 = null, look = 'none', working = false;
  var LOOKS = [['none', '✨ כמו שזה']].concat((window.FS && FS.FUN_FX) || []).concat([['anime', '🌸 אנימה'], ['candy', '🍬 פופ צבעוני'], ['rain', '🌧️ ציור גשם'], ['mosaic', '🔷 פסיפס']]);
  function looks() { $('looks').innerHTML = LOOKS.map(function (l) { return '<button type="button" data-look="' + l[0] + '"' + (l[0] === look ? ' class="on"' : '') + '>' + l[1] + '</button>'; }).join(''); }
  function showShot() { ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(shot, hole.x, hole.y, hole.w, hole.h); if (over && over.complete) ctx.drawImage(over, 0, 0, W, H); ctx.restore(); }
  $('looks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-look]'); if (!b || working || !shot0) return;
    var id = b.dataset.look; look = id; looks();
    if (id === 'none') { shot = shot0; showShot(); return; }
    working = true; $('send').disabled = true; msg('✨ מעצב…');
    var job = FS.funFx && FS.FUN_FX.some(function (x) { return x[0] === id; }) ? FS.funFx(id, shot0)
      : FS.offlineStyleCanvas(id, shot0, 1100).then(function (c) { var o = document.createElement('canvas'); o.width = shot0.width; o.height = shot0.height; var x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height); return o; });
    job.then(function (c) { shot = c; showShot(); msg(''); }, function (er) { look = 'none'; looks(); shot = shot0; showShot(); msg(FS.funFxMsg ? FS.funFxMsg(er) : 'העיצוב לא הצליח'); setTimeout(function () { msg(''); }, 2500); })
      .then(function () { working = false; $('send').disabled = false; });
  });
  $('again').addEventListener('click', function () { shot = null; shot0 = null; look = 'none'; $('after').hidden = true; $('bar').hidden = false; requestAnimationFrame(loop); });
  $('send').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'שולח…';
    var k = Math.min(1, 1600 / Math.max(shot.width, shot.height)), c = document.createElement('canvas'); c.width = Math.round(shot.width * k); c.height = Math.round(shot.height * k); c.getContext('2d').drawImage(shot, 0, 0, c.width, c.height);
    L.call({ action: 'guest-up', e: L.e, k: L.k, img: c.toDataURL('image/jpeg', 0.9).split(',')[1], name: '🪞 מראה קסם' }).then(function (r) {
      b.disabled = false; b.textContent = '✔ להדפסה';
      if (!r.ok) { msg(L.msg(r)); return; }
      msg('✨ המגנט בדרך להדפסה!'); setTimeout(function () { msg(''); $('again').click(); }, 2500);
    });
  });
})();
