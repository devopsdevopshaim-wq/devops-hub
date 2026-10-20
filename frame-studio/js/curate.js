/* Choosing the good photos, and a slideshow of the best of the event.
   Each photo gets a score from 0 to 100 (FS.scorePhoto): sharpness (variance of the Laplacian), exposure (the
   histogram's middle and its clipped ends), the faces (eyes open, smiles, from the face landmarker's blendshapes)
   and near-duplicates (a 64-bit difference hash: in a burst only the best one counts). Weak photos can be marked,
   hidden on the photos screen or removed. The slideshow takes the best ones spread over the evening and plays them
   full screen with slow moves and soft dissolves; it can be saved as a video. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;

  function small(im, long) { var k = Math.min(1, long / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(Math.max(1, Math.round(im.naturalWidth * k)), Math.max(1, Math.round(im.naturalHeight * k))), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height); return { c: c, d: x.getImageData(0, 0, c.width, c.height).data }; }
  function sharp(im) {
    var s = small(im, 640), w = s.c.width, h = s.c.height, d = s.d, g = new Float32Array(w * h), i, sum = 0, sq = 0, n = 0;
    for (i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var j = y * w + x, l = 4 * g[j] - g[j - 1] - g[j + 1] - g[j - w] - g[j + w]; sum += l; sq += l * l; n++; }
    var m = sum / n; return sq / n - m * m;
  }
  function exposure(im) {
    var s = small(im, 200), d = s.d, n = d.length / 4, hist = new Uint32Array(256);
    for (var i = 0; i < n; i++) hist[(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0]++;
    var acc = 0, mid = 128; for (var v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n / 2) { mid = v; break; } }
    var dark = 0, bright = 0; for (v = 0; v < 12; v++) dark += hist[v]; for (v = 246; v < 256; v++) bright += hist[v];
    return { mid: mid, dark: dark / n, bright: bright / n };
  }
  function dhash(im) {
    var c = FS.canvas(9, 8), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 9, 8); var d = x.getImageData(0, 0, 9, 8).data, bits = [];
    for (var y = 0; y < 8; y++) for (var xx = 0; xx < 8; xx++) { var a = (y * 9 + xx) * 4, b = a + 4; bits.push(d[a] + d[a + 1] + d[a + 2] > d[b] + d[b + 1] + d[b + 2] ? 1 : 0); }
    return bits;
  }
  function ham(a, b) { var n = 0; for (var i = 0; i < 64; i++) if (a[i] !== b[i]) n++; return n; }

  /* one photo: the score and the reasons it is weak */
  FS.scorePhoto = function (p) {
    var im = FS.img(p.src); if (!im) return Promise.resolve(null);
    var r = { sharp: sharp(im), exp: exposure(im), hash: dhash(im), faces: 0, closed: 0, smile: 0 };
    var lm = FS.getLandmarker ? FS.getLandmarker() : Promise.reject();
    return Promise.resolve(lm).then(function (L) {
      var s = small(im, 1024), out = L.detect(s.c); r.faces = (out.faceLandmarks || []).length;
      (out.faceBlendshapes || []).forEach(function (b) { var sc = {}; (b.categories || []).forEach(function (c) { sc[c.categoryName] = c.score; }); if ((sc.eyeBlinkLeft || 0) > 0.5 && (sc.eyeBlinkRight || 0) > 0.5) r.closed++; r.smile += ((sc.mouthSmileLeft || 0) + (sc.mouthSmileRight || 0)) / 2; });
      if (r.faces) r.smile /= r.faces;
    }, function () { r.noFaces = true; }).then(function () {
      var why = [], sc = 0;
      var sh = Math.min(1, Math.max(0, (Math.log10(r.sharp + 1) - 1.3) / 1.4)); sc += sh * 40; if (r.sharp < 40) why.push('מטושטשת');
      var e = 1 - Math.min(1, Math.abs(r.exp.mid - 118) / 100) - Math.max(0, r.exp.dark - 0.18) * 2 - Math.max(0, r.exp.bright - 0.12) * 2; sc += Math.max(0, e) * 25;
      if (r.exp.mid < 40 || (r.exp.dark > 0.5 && r.exp.mid < 80)) why.push('חשוכה'); if (r.exp.mid > 220 || (r.exp.bright > 0.45 && r.exp.mid > 175)) why.push('שרופה');
      if (r.faces) { sc += 20 * (1 - r.closed / r.faces) + 15 * Math.min(1, r.smile * 1.6); if (r.closed) why.push(r.closed === 1 ? 'עיניים עצומות' : r.closed + ' עם עיניים עצומות'); }
      else sc += r.noFaces ? 18 : 10;
      r.score = Math.round(Math.max(0, Math.min(100, sc))); r.why = why;
      p.rate = r; p.quality = Object.assign({}, p.quality || {}, { ok: !why.length, blurry: why.indexOf('מטושטשת') >= 0, closed: r.closed, sharp: Math.round(r.sharp), faces: r.faces, score: r.score });
      return r;
    });
  };
  /* all photos; then the near-duplicates: in each group only the best is kept as good */
  FS.scoreAll = function (list, progress) {
    list = list || S.photos; var i = 0;
    return list.reduce(function (ch, p) { return ch.then(function () { i++; if (progress) progress(i, list.length); return p.rate && p.rate.src === p.src ? p.rate : FS.scorePhoto(p).then(function (r) { if (r) r.src = p.src; return r; }); }); }, Promise.resolve()).then(function () {
      var done = list.filter(function (p) { return p.rate; }); done.forEach(function (p) { p.rate.dupOf = null; });
      for (var a = 0; a < done.length; a++) for (var b = a + 1; b < done.length; b++) {
        var A = done[a], B = done[b]; if (A.rate.dupOf || B.rate.dupOf) continue;
        if (ham(A.rate.hash, B.rate.hash) <= 6) { var lo = A.rate.score >= B.rate.score ? B : A, hi = lo === A ? B : A; lo.rate.dupOf = hi.id; if (lo.rate.why.indexOf('כפילות') < 0) lo.rate.why.push('כפילות'); lo.quality.ok = false; }
      }
      FS.markStrip && FS.markStrip(); FS.buildGrid && FS.gridMode && FS.gridMode() && FS.buildGrid();
      return done;
    });
  };

  /* ---------- the panel ---------- */
  var pane = document.createElement('section'); pane.dataset.pane = 'curate'; pane.hidden = true;
  pane.innerHTML = '<h2>בחירה ומצגת</h2>' +
    '<div class="card"><h3>🧹 סינון תמונות חלשות</h3><p class="hint">בודק כל תמונה: חדות, חשיפה, עיניים עצומות, חיוכים, וכפילויות מאותו רגע (נשארת הטובה מכולן). הכול במחשב.</p>' +
    '<button class="btn primary wide" id="cu-run">🔎 לבדוק את כל התמונות</button><div id="cu-out" class="cu-out"></div></div>' +
    '<div class="card"><h3>🎞️ מצגת מהאירוע</h3><p class="hint">התמונות הכי טובות, מפוזרות לאורך הערב, במסך מלא עם תנועה איטית ומעברים רכים. אפשר לשמור כסרטון.</p>' +
    '<div class="row2"><div class="field"><label>כמה תמונות</label><select id="cu-n"><option>12</option><option selected>20</option><option>30</option><option>50</option></select></div><div class="field"><label>שניות לתמונה</label><select id="cu-sec"><option>2.5</option><option selected>3.5</option><option>5</option></select></div></div>' +
    '<div class="field"><label>כותרת פתיחה (לא חובה)</label><input id="cu-title" maxlength="50" placeholder="למשל: נועה & דניאל · 12.06.2027"></div>' +
    '<div class="row2"><button class="btn primary" id="cu-show">▶ הצגת המצגת</button><button class="btn" id="cu-pick">✔ לסמן את התמונות שבמצגת</button></div></div>';
  var panel = $('#panel'); panel.insertBefore(pane, $('[data-pane=output]', panel));
  var tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.tab = 'curate';
  tab.innerHTML = '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="m15 17 2 2 4-5"/></svg>בחירה ומצגת';
  var rail = $('.tools'); rail.insertBefore(tab, $('[data-tab=output]', rail));
  tab.addEventListener('click', function () { FS.openTab('curate'); });

  function summary(done) {
    var weak = done.filter(function (p) { return p.rate.why.length; }), counts = {};
    weak.forEach(function (p) { p.rate.why.forEach(function (w) { var k = /עיניים/.test(w) ? 'עיניים עצומות' : w; counts[k] = (counts[k] || 0) + 1; }); });
    $('#cu-out').innerHTML = '<div class="stats"><div><b>' + done.length + '</b><small>נבדקו</small></div><div><b>' + (done.length - weak.length) + '</b><small>טובות</small></div><div><b>' + weak.length + '</b><small>חלשות</small></div><div><b>' + (done.length ? Math.round(done.reduce(function (a, p) { return a + p.rate.score; }, 0) / done.length) : 0) + '</b><small>ציון ממוצע</small></div></div>' +
      (weak.length ? '<p class="hint">' + Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; }).join(' · ') + '</p>' +
        '<div class="cu-weak">' + weak.slice(0, 24).map(function (p) { return '<figure data-id="' + p.id + '"><img alt="" src="' + thumb(p) + '"><figcaption>' + FS.esc(p.rate.why.join(', ')) + '</figcaption></figure>'; }).join('') + '</div>' +
        '<div class="row2"><button class="btn" id="cu-mark">סימון החלשות</button><button class="btn" id="cu-hide">הצגת הטובות בלבד</button></div><button class="btn danger wide" id="cu-del">🗑 הסרת ' + weak.length + ' החלשות מהפרויקט</button>' : '<p class="hint">כל התמונות נראות טוב ✓</p>');
    if (!weak.length) return;
    $('#cu-mark').addEventListener('click', function () { S.marked = {}; weak.forEach(function (p) { S.marked[p.id] = true; }); FS.buildStrip(); FS.toast('סומנו ' + weak.length + ' תמונות חלשות'); });
    $('#cu-hide').addEventListener('click', function () { if (FS.showGrid) { FS.showGrid(); var b = $('#gv-show [data-show=all]'); setTimeout(function () { var g = $('#gv-show [data-show=plain]'); void g; }, 0); } FS.gridShowGood = true; FS.buildGrid && FS.buildGrid(); FS.toast('במסך כל התמונות: "⚠ פסולות" מציג את החלשות, וכל השאר טובות'); void b; });
    $('#cu-del').addEventListener('click', function () {
      if (!confirm('להסיר ' + weak.length + ' תמונות חלשות מהפרויקט? (הקבצים המקוריים במחשב לא נמחקים)')) return;
      var ids = {}; weak.forEach(function (p) { ids[p.id] = 1; }); S.photos = S.photos.filter(function (p) { return !ids[p.id]; }); S.marked = {}; S.cur = Math.min(Math.max(0, S.cur), S.photos.length - 1);
      FS.buildStrip(); FS.emit('doc'); FS.emit('history'); FS.buildGrid && FS.buildGrid(); $('#cu-out').innerHTML = '<p class="hint">🗑 ' + weak.length + ' תמונות הוסרו.</p>';
    });
    $$('.cu-weak figure').forEach(function (f) { f.addEventListener('click', function () { var i = S.photos.findIndex(function (p) { return p.id === f.dataset.id; }); if (i >= 0) FS.select(i); }); });
  }
  function thumb(p) { var im = FS.img(p.src), c = FS.canvas(120, 90), x = c.getContext('2d'), s = Math.max(120 / im.naturalWidth, 90 / im.naturalHeight); x.drawImage(im, (120 - im.naturalWidth * s) / 2, (90 - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); return c.toDataURL('image/jpeg', 0.7); }
  $('#cu-run').addEventListener('click', function () {
    if (!S.photos.length) return FS.toast('מוסיפים קודם תמונות');
    var stop = false; FS.busy('🔎 בודק תמונות…', function () { stop = true; });
    FS.scoreAll(S.photos, function (i, n) { if (stop) throw new Error('stop'); FS.busy('🔎 בודק תמונה ' + i + ' מתוך ' + n + '…', function () { stop = true; }); })
      .then(function (done) { FS.busy(); summary(done); }, function () { FS.busy(); summary(S.photos.filter(function (p) { return p.rate; })); });
  });

  /* ---------- the slideshow ---------- */
  /* the best N, spread over the evening (the photos keep their order), no near-duplicates */
  function bestOf(n) {
    var l = S.photos.filter(function (p) { return p.rate && !p.rate.dupOf && !p.rate.why.length; }); if (l.length < n) l = S.photos.filter(function (p) { return p.rate && !p.rate.dupOf; });
    if (l.length <= n) return l;
    var parts = n, size = l.length / parts, out = [];
    for (var i = 0; i < parts; i++) { var seg = l.slice(Math.floor(i * size), Math.floor((i + 1) * size)); out.push(seg.sort(function (a, b) { return b.rate.score - a.rate.score; })[0]); }
    return out;
  }
  function ready() { var missing = S.photos.filter(function (p) { return !p.rate; }); if (!missing.length) return Promise.resolve(); FS.busy('🔎 בוחר את התמונות הכי טובות…'); return FS.scoreAll(S.photos, function (i, n) { FS.busy('🔎 בוחר את התמונות הכי טובות · ' + i + '/' + n); }).then(function () { FS.busy(); }); }
  $('#cu-pick').addEventListener('click', function () { if (!S.photos.length) return; ready().then(function () { var l = bestOf(Number($('#cu-n').value)); S.marked = {}; l.forEach(function (p) { S.marked[p.id] = true; }); FS.buildStrip(); FS.toast('✔ סומנו ' + l.length + ' התמונות של המצגת'); }); });
  $('#cu-show').addEventListener('click', function () {
    if (S.photos.length < 2) return FS.toast('צריך כמה תמונות למצגת');
    ready().then(function () { play(bestOf(Number($('#cu-n').value)), Number($('#cu-sec').value), $('#cu-title').value.trim()); });
  });

  /* the player: a canvas with slow moves (towards the faces) and dissolves; ⏺ records it as a video */
  function play(list, sec, title) {
    if (!list.length) return FS.toast('לא נמצאו תמונות טובות למצגת');
    var ov = document.createElement('div'); ov.className = 'ss'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'מצגת');
    ov.innerHTML = '<canvas></canvas><div class="ss-bar"><button class="ss-b" data-a="prev" aria-label="הקודמת">⏮</button><button class="ss-b" data-a="pause" aria-label="השהיה">⏸</button><button class="ss-b" data-a="next" aria-label="הבאה">⏭</button><span class="ss-n"></span><button class="ss-b" data-a="rec">⏺ שמירה כסרטון</button><button class="ss-b" data-a="close" aria-label="סגירה">✕</button></div>';
    document.body.appendChild(ov);
    var cv = $('canvas', ov), x = cv.getContext('2d'), W, H, t0 = performance.now(), paused = false, pausedAt = 0, raf = 0, rec = null, chunks = [];
    var slides = (title ? [{ title: title }] : []).concat(list.map(function (p) { return { p: p }; })), D = sec * 1000, F = 900, total = slides.length * D;
    function size() { var dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr); }
    size(); addEventListener('resize', size);
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function drawSlide(s, k, alpha, idx) {
      x.globalAlpha = alpha;
      if (s.title) { x.fillStyle = '#0d0b10'; x.fillRect(0, 0, W, H); x.fillStyle = '#e9d4a6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.font = '700 ' + Math.round(Math.min(W, H) * 0.08) + 'px "Frank Ruhl Libre", serif'; x.fillText(s.title, W / 2, H / 2); x.globalAlpha = 1; return; }
      var im = FS.img(s.p.src); if (!im) return; var iw = im.naturalWidth, ih = im.naturalHeight;
      /* blurred fill behind, then the photo whole (contain), moving slowly */
      var cover = Math.max(W / iw, H / ih); x.save(); x.filter = 'blur(28px) brightness(.45)'; x.drawImage(im, (W - iw * cover) / 2, (H - ih * cover) / 2, iw * cover, ih * cover); x.restore();
      var fit = Math.min(W / iw, H / ih), z = still ? 1 : 1 + 0.06 * k, dir = idx % 2 ? 1 : -1, fx = 0, fy = 0;
      if (s.p.faces && s.p.faces.length) { var f = s.p.faces[0]; fx = ((f.x + f.w / 2) / iw - 0.5); fy = ((f.y + f.h / 2) / ih - 0.5); }
      var w = iw * fit * z, h = ih * fit * z, ox = (W - w) / 2 - (still ? 0 : (fx * w * 0.06 * k + dir * W * 0.01 * k)), oy = (H - h) / 2 - (still ? 0 : fy * h * 0.06 * k);
      x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 40; x.drawImage(im, ox, oy, w, h); x.shadowBlur = 0; x.globalAlpha = 1;
    }
    function frame(now) {
      var t = paused ? pausedAt : now - t0;
      if (t >= total) { if (rec) { rec.stop(); return; } t0 = now; t = 0; }
      var i = Math.floor(t / D), local = t - i * D;
      x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      drawSlide(slides[i], local / D, 1, i);
      if (local > D - F && slides[i + 1]) drawSlide(slides[i + 1], 0, (local - (D - F)) / F, i + 1);
      $('.ss-n', ov).textContent = (i + 1) + ' / ' + slides.length;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function jump(d) { var t = paused ? pausedAt : performance.now() - t0, i = Math.max(0, Math.min(slides.length - 1, Math.floor(t / D) + d)); if (paused) pausedAt = i * D; else t0 = performance.now() - i * D; }
    function close() { cancelAnimationFrame(raf); if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } removeEventListener('resize', size); removeEventListener('keydown', key); ov.remove(); }
    function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') jump(1); else if (e.key === 'ArrowRight') jump(-1); else if (e.key === ' ') { e.preventDefault(); toggle(); } }
    function toggle() { if (paused) { t0 = performance.now() - pausedAt; paused = false; } else { pausedAt = performance.now() - t0; paused = true; } $('[data-a=pause]', ov).textContent = paused ? '▶' : '⏸'; }
    addEventListener('keydown', key);
    ov.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return; a = a.dataset.a;
      if (a === 'close') close(); else if (a === 'next') jump(1); else if (a === 'prev') jump(-1); else if (a === 'pause') toggle();
      else if (a === 'rec') {
        if (!cv.captureStream || !window.MediaRecorder) return FS.toast('הדפדפן הזה לא יודע לשמור סרטון. ב־Chrome זה עובד.');
        var type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
        rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 8000000 }); chunks = [];
        rec.ondataavailable = function (ev) { if (ev.data.size) chunks.push(ev.data); };
        rec.onstop = function () { var b = new Blob(chunks, { type: type.split(';')[0] }); FS.download(b, 'מצגת' + (title ? ' - ' + title.replace(/[\\/:*?"<>|]+/g, '_') : '') + (/mp4/.test(type) ? '.mp4' : '.webm')); rec = null; FS.toast('🎞️ הסרטון נשמר', 4000); };
        paused = false; t0 = performance.now(); rec.start(500); FS.toast('⏺ מקליט את המצגת מההתחלה (' + Math.round(total / 1000) + ' שניות). בסוף הקובץ יורד.', 5000);
      }
    });
  }
  FS.slideshow = play;
})();
