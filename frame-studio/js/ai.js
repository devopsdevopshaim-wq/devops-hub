/* AI: person mask and face finding run in the browser (MediaPipe, loaded on first use); pictures from a description come
   from Pollinations (free, no key); the editing assistant asks Gemini through the sites' shared server. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var HUB = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var vision = null, segmenter = null, faceDet = null;

  function loadVision() {
    if (vision) return vision;
    vision = import(MP + '/vision_bundle.mjs').then(function (m) { return m.FilesetResolver.forVisionTasks(MP + '/wasm').then(function (fs) { return { m: m, fs: fs }; }); });
    vision.catch(function () { vision = null; });
    return vision;
  }
  FS.loadVision = loadVision;
  function getSegmenter() {
    if (segmenter) return segmenter;
    segmenter = loadVision().then(function (v) {
      return v.m.ImageSegmenter.createFromOptions(v.fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    });
    segmenter.catch(function () { segmenter = null; });
    return segmenter;
  }
  function getFaces() {
    if (faceDet) return faceDet;
    faceDet = loadVision().then(function (v) {
      return v.m.FaceDetector.createFromOptions(v.fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' }, runningMode: 'IMAGE', minDetectionConfidence: 0.45 });
    });
    faceDet.catch(function () { faceDet = null; });
    return faceDet;
  }
  function small(im, max) { var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.k = k; return c; }
  function fail(e) { FS.busy(); console.warn(e); FS.toast('רכיב ה־AI לא נטען. בודקים חיבור לאינטרנט ומנסים שוב.', 5000); }

  /* ---------- person mask ---------- */
  FS.ensureMask = function (p) {
    if (p.mask) return Promise.resolve(p.mask);
    FS.busy('מזהה את האנשים בתמונה…');
    return getSegmenter().then(function (seg) {
      var c = small(FS.img(p.src), 1024), res = seg.segment(c), m = res.confidenceMasks[0], f = m.getAsFloat32Array(), w = m.width, h = m.height;
      var mc = FS.canvas(w, h), x = mc.getContext('2d'), id = x.createImageData(w, h), cover = 0;
      for (var i = 0; i < f.length; i++) { var v = Math.max(0, Math.min(1, (f[i] - 0.25) / 0.5)); cover += v; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255 * v; id.data[i * 4 + 3] = 255; }
      var soft = FS.blur(id.data, w, h, 2); for (i = 0; i < soft.length; i += 4) soft[i + 3] = 255;
      id.data.set(soft); x.putImageData(id, 0, 0);
      if (res.close) res.close();
      p.mask = mc; p.maskV = (p.maskV || 0) + 1; p.maskCover = cover / f.length; FS.busy();
      if (p.maskCover < 0.015) FS.toast('לא נמצא אדם בתמונה. החלפת רקע עובדת על אנשים.', 5000);
      return mc;
    }).catch(function (e) { fail(e); throw e; });
  };
  function setBg(mode, extra) {
    var p = FS.cur(); if (!p) { FS.toast('בוחרים תמונה קודם'); return Promise.resolve(); }
    var bg = p.doc.photo.bg = Object.assign({ mode: 'none', color: '#ffffff', src: '' }, p.doc.photo.bg, extra || {}, { mode: mode });
    if (mode === 'none') { FS.changed(); return Promise.resolve(); }
    return FS.ensureMask(p).then(function () { if (bg.mode === 'image' && !bg.src) { $('#file-bg').click(); return; } FS.changed(); });
  }
  $$('#bg-modes [data-bg]').forEach(function (b) { b.addEventListener('click', function () { setBg(b.dataset.bg); }); });
  $('#bg-color').addEventListener('input', function () { var p = FS.cur(); if (!p) return; if (!p.doc.photo.bg || p.doc.photo.bg.mode !== 'color') setBg('color', { color: this.value }); else { p.doc.photo.bg.color = this.value; FS.render(true); FS.commitSoon(); } });
  $('#bg-blur').addEventListener('change', function () { var p = FS.cur(); if (!p) return; if (!p.doc.photo.bg || p.doc.photo.bg.mode !== 'blur') setBg('blur', { amount: Number(this.value) }); else { p.doc.photo.bg.amount = Number(this.value); FS.changed(); } });
  $('#file-bg').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (!f) return; FS.fileToDataURL(f).then(FS.loadImg).then(function (im) { setBg('image', { src: im.src }); }); });

  /* ---------- faces ---------- */
  FS.findFaces = function (p, quiet) {
    if (p.faces) return Promise.resolve(p.faces);
    if (!quiet) FS.busy('מחפש פנים…');
    return getFaces().then(function (det) {
      var im = FS.img(p.src), c = small(im, 1600), r = det.detect(c), k = c.k;
      p.faces = (r.detections || []).map(function (d) {
        var b = d.boundingBox, kp = (d.keypoints || []).map(function (q) { return { x: q.x * c.width / k, y: q.y * c.height / k }; });
        return { x: b.originX / k, y: b.originY / k, w: b.width / k, h: b.height / k, kp: kp };
      });
      if (!quiet) { FS.busy(); if (!p.faces.length) FS.toast('לא נמצאו פנים. הזיהוי עובד הכי טוב על פנים קרובות וברורות.', 4500); }
      return p.faces;
    }).catch(function (e) { if (quiet) return []; fail(e); throw e; });
  };
  /* place the faces in the frame's window: zoom so they read well, centre them, keep the window covered */
  FS.smartFit = function (p, quiet) {
    return FS.findFaces(p, quiet).then(function (faces) {
      if (!faces.length) return 0;
      var d = p.doc, im = FS.img(p.src), H = FS.hole(d), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      FS.fitPhoto(d, im);
      faces.forEach(function (f) { [[f.x, f.y], [f.x + f.w, f.y + f.h]].forEach(function (q) { var t = FS.imgToDoc(d, im, q[0], q[1]); x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); }); });
      var fw = x1 - x0, k = fw > H.w * 0.75 ? H.w * 0.75 / fw : faces.length === 1 && fw < H.w * 0.22 ? Math.min(2.2, H.w * 0.3 / fw) : 1;
      var hx = H.x + H.w / 2, hy = H.y + H.h / 2;
      d.photo.s *= k; d.photo.x = hx + (d.photo.x - hx) * k; d.photo.y = hy + (d.photo.y - hy) * k;
      var fcx = hx + ((x0 + x1) / 2 - hx) * k, fcy = hy + ((y0 + y1) / 2 - hy) * k;
      d.photo.x -= fcx - hx; d.photo.y -= fcy - (H.y + H.h * 0.4);
      var rot = Math.abs(Math.round(d.photo.r / 90)) % 2, hw = (rot ? im.naturalHeight : im.naturalWidth) * d.photo.s / 2, hh = (rot ? im.naturalWidth : im.naturalHeight) * d.photo.s / 2;
      d.photo.x = FS.clamp(d.photo.x, H.x + H.w - hw, H.x + hw); d.photo.y = FS.clamp(d.photo.y, H.y + H.h - hh, H.y + hh);
      return faces.length;
    });
  };
  $('#smart-fit').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.smartFit(p).then(function (n) { if (n) { FS.changed(); FS.toast('🎯 ' + n + ' פנים במרכז החלון'); } });
  });
  $('#face-blur').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.findFaces(p).then(function (faces) {
      if (!faces.length) return;
      var ph = p.doc.photo; ph.blurs = ph.blurs && ph.blurs.length ? [] : faces.map(function (f) { return { x: f.x - f.w * 0.15, y: f.y - f.h * 0.3, w: f.w * 1.3, h: f.h * 1.45 }; });
      FS.changed(); FS.toast(ph.blurs.length ? 'הפנים טושטשו. לחיצה נוספת מבטלת.' : 'הטשטוש בוטל');
    });
  });
  var FX = {
    glasses: function (f, a, ed) { return [{ ch: '🕶️', x: (f.kp[0].x + f.kp[1].x) / 2, y: (f.kp[0].y + f.kp[1].y) / 2 + ed * 0.05, size: ed * 2.3 }]; },
    hearts: function (f, a, ed) { return [{ ch: '❤️', x: f.kp[0].x, y: f.kp[0].y, size: ed * 0.75 }, { ch: '❤️', x: f.kp[1].x, y: f.kp[1].y, size: ed * 0.75 }]; },
    crown: function (f, a, ed) { return [{ ch: '👑', x: f.x + f.w / 2, y: f.y - f.h * 0.28, size: f.w * 0.95 }]; },
    hat: function (f) { return [{ ch: '🎩', x: f.x + f.w / 2, y: f.y - f.h * 0.42, size: f.w * 1.2 }]; },
    party: function (f) { return [{ ch: '🥳', x: f.x + f.w * 0.95, y: f.y - f.h * 0.1, size: f.w * 0.5 }, { ch: '🎉', x: f.x + f.w * 0.05, y: f.y - f.h * 0.15, size: f.w * 0.5 }]; },
    clown: function (f, a, ed) { return [{ ch: '🔴', x: f.kp[2].x, y: f.kp[2].y, size: ed * 0.55 }]; }
  };
  $$('#face-fx [data-fx]').forEach(function (b) { b.addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    FS.findFaces(p).then(function (faces) {
      if (!faces.length) return;
      var d = p.doc, im = FS.img(p.src), rot = d.photo.r;
      faces.forEach(function (f) {
        if (f.kp.length < 3) return;
        var ed = Math.hypot(f.kp[0].x - f.kp[1].x, f.kp[0].y - f.kp[1].y), a = Math.atan2(f.kp[0].y - f.kp[1].y, f.kp[0].x - f.kp[1].x) * 180 / Math.PI;
        if (Math.abs(a) > 90) a = a > 0 ? a - 180 : a + 180;
        FX[b.dataset.fx](f, a, ed).forEach(function (s) {
          var t = FS.imgToDoc(d, im, s.x, s.y);
          d.layers.push({ id: FS.uid(), type: 'emoji', ch: s.ch, x: t.x, y: t.y, size: Math.max(16, s.size * d.photo.s), r: Math.round(a + rot), opacity: 1 });
        });
      });
      FS.changed(); FS.toast('אפשר להזיז ולהגדיל כל מדבקה');
    });
  }); });

  /* ---------- pictures from a description ---------- */
  function hasHeb(s) { return /[֐-׿]/.test(s); }
  FS.askServer = function (body) {
    return fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  };
  function toEnglish(text) {
    if (!hasHeb(text)) return Promise.resolve(text);
    return FS.askServer({ action: 'ai', tag: 'photo', prompt: 'Translate this image description to a short English image-generation prompt. Answer with the prompt only:\n' + text })
      .then(function (r) { return r && r.ok && r.text ? r.text.replace(/^["'\s]+|["'\s]+$/g, '') : text; }).catch(function () { return text; });
  }
  function generate(prompt, w, h) {
    return toEnglish(prompt).then(function (en) {
      var url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(en) + '?width=' + Math.round(w) + '&height=' + Math.round(h) + '&nologo=true&seed=' + Math.floor(Math.random() * 1e6);
      return FS.loadImg(url).then(function (im) { var c = FS.canvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c; });
    });
  }
  /* turn the near-white area joined to the given seeds transparent */
  function clearWhite(c, seeds, tol) {
    var w = c.width, h = c.height, x = c.getContext('2d', { willReadFrequently: true }), id = x.getImageData(0, 0, w, h), d = id.data, seen = new Uint8Array(w * h), st = [];
    function white(i) { return d[i * 4] > 255 - tol && d[i * 4 + 1] > 255 - tol && d[i * 4 + 2] > 255 - tol; }
    seeds.forEach(function (s) { if (white(s)) { seen[s] = 1; st.push(s); } });
    while (st.length) { var i = st.pop(), px = i % w; d[i * 4 + 3] = 0;
      [i - 1, i + 1, i - w, i + w].forEach(function (q) { if (q >= 0 && q < w * h && !seen[q] && Math.abs((q % w) - px) <= 1 && white(q)) { seen[q] = 1; st.push(q); } }); }
    x.putImageData(id, 0, 0); return c;
  }
  function edgeSeeds(w, h) { var s = []; for (var i = 0; i < w; i += 3) { s.push(i, (h - 1) * w + i); } for (i = 0; i < h; i += 3) { s.push(i * w, i * w + w - 1); } return s; }
  function promptText() { var t = $('#gen-prompt').value.trim(); if (!t) { FS.toast('כותבים תיאור קודם'); $('#gen-prompt').focus(); } return t; }
  function genBusy(promise) { FS.busy('יוצר… (עד חצי דקה)'); return promise.then(function (r) { FS.busy(); return r; }, function (e) { FS.busy(); FS.toast('היצירה לא הצליחה. נסו שוב או תיאור אחר.', 4500); throw e; }); }
  $('#gen-bg').addEventListener('click', function () {
    var t = promptText(), p = FS.cur(); if (!t) return; if (!p) return FS.toast('בוחרים תמונה קודם');
    var im = FS.img(p.src), k = 1024 / Math.max(im.naturalWidth, im.naturalHeight);
    genBusy(generate(t + ', background scenery, photographic, no people', im.naturalWidth * k, im.naturalHeight * k)).then(function (c) {
      return FS.loadImg(c.toDataURL('image/jpeg', 0.9)).then(function (bi) { return setBg('image', { src: bi.src }); });
    });
  });
  $('#gen-sticker').addEventListener('click', function () {
    var t = promptText(); if (!t) return; if (!FS.cur()) return FS.toast('בוחרים תמונה קודם');
    genBusy(generate(t + ', cute die-cut sticker, bold outline, centered, plain white background', 768, 768)).then(function (c) {
      clearWhite(c, edgeSeeds(c.width, c.height), 28);
      return FS.loadImg(c.toDataURL('image/png')).then(function (im) { var d = FS.cur().doc; FS.addLayer({ type: 'image', src: im.src, s: Math.min(d.w, d.h) * 0.38 / im.naturalWidth }); });
    });
  });
  $('#gen-frame').addEventListener('click', function () {
    var t = promptText(); if (!t) return; var p = FS.cur(), d = p ? p.doc : { w: 1200, h: 1800 }, k = 1024 / Math.max(d.w, d.h);
    genBusy(generate(t + ', ornamental decorative photo frame border only, the whole center is empty plain white, flat illustration', d.w * k, d.h * k)).then(function (c) {
      clearWhite(c, [Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)], 40);
      return FS.addUserFrame(c.toDataURL('image/png'), 'AI: ' + t.slice(0, 24));
    }).then(function (f) {
      if (f.solid) FS.toast('במסגרת שנוצרה לא נמצא מרכז ריק. כדאי לנסות שוב.', 5000);
      else if (p) FS.useFrame({ kind: 'png', id: f.id, opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false });
      FS.openTab('frames');
    });
  });
  $('#gen-photo').addEventListener('click', function () {
    var t = promptText(); if (!t) return;
    genBusy(generate(t, 1216, 832)).then(function (c) { c.toBlob(function (b) { FS.addFiles([new File([b], 'AI ' + t.slice(0, 20) + '.jpg', { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92); });
  });

  /* ---------- the editing assistant ---------- */
  $('#ai-ask').addEventListener('click', function () {
    var p = FS.cur(), out = $('#ai-out'); if (!p) return FS.toast('בוחרים תמונה קודם');
    var c = small(FS.img(p.src), 1024), occ = $('#ai-occasion').value;
    var frames = FS.GEN_FRAMES.map(function (f) { return f.id + ' (' + f.name + ')'; }).join(', ');
    var prompt = 'You are a senior photo retoucher. Look at the photo' + (occ ? ' (occasion: ' + occ + ')' : '') + ' and answer ONLY with JSON, Hebrew text values:\n' +
      '{"why":"2-3 short sentences in Hebrew: what to improve and why","adj":{"exposure":0,"contrast":0,"highlights":0,"shadows":0,"whites":0,"blacks":0,"temp":0,"tint":0,"vibrance":0,"saturation":0,"clarity":0,"sharpen":0,"vignette":0},' +
      '"captions":["3 short Hebrew captions to print on the photo"],"frame":"one id from: ' + frames + '","frameColor":"#hex"}\nValues are -100..100 (sharpen 0..100); keep edits natural.';
    out.innerHTML = '<p class="hint">מנתח את התמונה…</p>';
    FS.askServer({ action: 'ai', tag: 'photo', prompt: prompt, image: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' }).then(function (r) {
      if (!r || !r.ok) throw new Error(r && r.error || 'ai');
      var j = JSON.parse(String(r.text).replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
      var h = '<p>' + FS.esc(j.why || '') + '</p><button class="btn primary small" id="ai-apply">✔ החלת העריכה המומלצת</button>';
      if (j.frame) h += ' <button class="btn small" id="ai-frame">🖼️ מסגרת מומלצת</button>';
      (j.captions || []).slice(0, 4).forEach(function (t, i) { h += '<button class="chip-cap" data-cap="' + i + '">＋ ' + FS.esc(t) + '</button>'; });
      out.innerHTML = h;
      $('#ai-apply').addEventListener('click', function () { var a = Object.assign({}, FS.ADJ0); for (var k in j.adj || {}) if (k in a) a[k] = FS.clamp(Math.round(Number(j.adj[k]) || 0), -100, 100); p.doc.photo.adj = a; FS.changed(); });
      if ($('#ai-frame')) $('#ai-frame').addEventListener('click', function () { var def = FS.GEN_FRAMES.filter(function (f) { return f.id === j.frame; })[0]; if (def) FS.useFrame({ kind: 'gen', id: def.id, color: /^#[0-9a-f]{6}$/i.test(j.frameColor || '') ? j.frameColor : def.color, thick: 1, opacity: 1 }); });
      $$('[data-cap]', out).forEach(function (b) { b.addEventListener('click', function () { var d = p.doc; FS.addLayer({ type: 'text', text: j.captions[b.dataset.cap], size: Math.round(Math.min(d.w, d.h) * 0.07), font: 'Amatic SC', weight: 700, color: '#ffffff', shadow: true, y: d.h * 0.85, align: 'center' }); }); });
    }).catch(function (e) {
      var m = String(e && e.message);
      out.innerHTML = '<p class="hint">' + (m === 'no-key' ? 'שרת ה־AI עוד לא הוגדר.' : m === 'quota' || m === 'rate-limited' ? 'הגענו למכסה. נסו שוב מאוחר יותר.' : 'העוזר לא זמין כרגע.') + ' בינתיים אפשר להשתמש ב"שיפור אוטומטי" בלשונית עריכה, שעובד בלי אינטרנט.</p>';
    });
  });
})();
