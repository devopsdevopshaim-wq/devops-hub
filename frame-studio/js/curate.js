/* Choosing the good photos, and a slideshow of the best of the event.
   Each photo gets a score from 0 to 100 (FS.scorePhoto): sharpness (variance of the Laplacian), exposure (the
   histogram's middle and its clipped ends), the faces (eyes open, smiles, from the face landmarker's blendshapes)
   and near-duplicates (a 64-bit difference hash: in a burst only the best one counts). Weak photos can be marked,
   hidden on the photos screen or removed. The slideshow takes the best ones spread over the evening and plays them
   full screen with slow moves and the owner's choice of 15 transitions; it can be saved as a video.
   Nothing here holds the page for long: the photos are scored on small copies, a few at a time, giving the browser
   its turn in between, and each slide is drawn once (blurred fill + photo) before it shows. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;

  /* a small copy of an image or canvas; with read, its pixels too */
  function small(src, long, read) {
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.min(1, long / Math.max(sw, sh));
    var c = FS.canvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k))), x = c.getContext('2d', read ? { willReadFrequently: true } : undefined);
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    return { c: c, d: read ? x.getImageData(0, 0, c.width, c.height).data : null };
  }
  function sharp(s) {
    var w = s.c.width, h = s.c.height, d = s.d, g = new Float32Array(w * h), i, sum = 0, sq = 0, n = 0;
    for (i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var j = y * w + x, l = 4 * g[j] - g[j - 1] - g[j + 1] - g[j - w] - g[j + w]; sum += l; sq += l * l; n++; }
    var m = sum / n; return sq / n - m * m;
  }
  function exposure(s) {
    var d = s.d, n = d.length / 4, hist = new Uint32Array(256);
    for (var i = 0; i < n; i++) hist[(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0]++;
    var acc = 0, mid = 128; for (var v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n / 2) { mid = v; break; } }
    var dark = 0, bright = 0; for (v = 0; v < 12; v++) dark += hist[v]; for (v = 246; v < 256; v++) bright += hist[v];
    return { mid: mid, dark: dark / n, bright: bright / n };
  }
  function dhash(src) {
    var c = FS.canvas(9, 8), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, 9, 8); var d = x.getImageData(0, 0, 9, 8).data, bits = [];
    for (var y = 0; y < 8; y++) for (var xx = 0; xx < 8; xx++) { var a = (y * 9 + xx) * 4, b = a + 4; bits.push(d[a] + d[a + 1] + d[a + 2] > d[b] + d[b + 1] + d[b + 2] ? 1 : 0); }
    return bits;
  }
  /* the 64 bits as two numbers, so comparing every pair stays quick with thousands of photos */
  function pack(bits) { var a = 0, b = 0; for (var i = 0; i < 32; i++) { a = (a << 1) | bits[i]; b = (b << 1) | bits[i + 32]; } return [a >>> 0, b >>> 0]; }
  function pop(v) { v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  function ham(a, b) { return pop(a[0] ^ b[0]) + pop(a[1] ^ b[1]); }
  /* give the browser its turn (paint, clicks) between batches */
  var later = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 60 }); } : function (f) { setTimeout(f, 0); };
  function breathe() { return new Promise(function (r) { later(r); }); }

  /* one photo: the score and the reasons it is weak. The full photo is drawn once, to 768px (for the faces);
     sharpness, exposure and the hash work on smaller copies of that */
  FS.scorePhoto = function (p) {
    var im = FS.img(p.src); if (!im || !im.naturalWidth) return Promise.resolve(null);
    var base = small(im, 768), r = { sharp: sharp(small(base.c, 512, true)), exp: exposure(small(base.c, 200, true)), hash: dhash(base.c), faces: 0, closed: 0, smile: 0 };
    var lm = FS.getLandmarker ? FS.getLandmarker() : Promise.reject();
    return Promise.resolve(lm).then(function (L) {
      var out; try { out = L.detect(base.c); } catch (e) { r.noFaces = true; return; }
      r.faces = (out.faceLandmarks || []).length;
      (out.faceBlendshapes || []).forEach(function (b) { var sc = {}; (b.categories || []).forEach(function (c) { sc[c.categoryName] = c.score; }); if ((sc.eyeBlinkLeft || 0) > 0.5 && (sc.eyeBlinkRight || 0) > 0.5) r.closed++; r.smile += ((sc.mouthSmileLeft || 0) + (sc.mouthSmileRight || 0)) / 2; });
      if (r.faces) r.smile /= r.faces;
    }, function () { r.noFaces = true; }).then(function () {
      base.c.width = 0;
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
  /* all photos, one after the other with a pause for the page every ~14ms of work (progress may throw to stop);
     then the near-duplicates: in each group only the best is kept as good */
  FS.scoreAll = function (list, progress) {
    list = list || S.photos; var i = 0, n = list.length, last = performance.now();
    function next() {
      if (i >= n) return null;
      var p = list[i++]; if (progress) progress(i, n);
      var work = p.rate && p.rate.src === p.src ? Promise.resolve() : FS.scorePhoto(p).then(function (r) { if (r) r.src = p.src; });
      return work.then(function () {
        if (performance.now() - last < 14) return next();
        return breathe().then(function () { last = performance.now(); return next(); });
      });
    }
    return breathe().then(next).then(function () {
      var done = list.filter(function (p) { return p.rate; }), keys = done.map(function (p) { p.rate.dupOf = null; return pack(p.rate.hash); });
      for (var a = 0; a < done.length; a++) for (var b = a + 1; b < done.length; b++) {
        var A = done[a], B = done[b]; if (A.rate.dupOf || B.rate.dupOf) continue;
        if (ham(keys[a], keys[b]) <= 6) { var lo = A.rate.score >= B.rate.score ? B : A, hi = lo === A ? B : A; lo.rate.dupOf = hi.id; if (lo.rate.why.indexOf('כפילות') < 0) lo.rate.why.push('כפילות'); lo.quality.ok = false; }
      }
      FS.markStrip && FS.markStrip(); FS.buildGrid && FS.gridMode && FS.gridMode() && FS.buildGrid();
      return done;
    });
  };

  /* ---------- the transitions between slides ----------
     Each one draws on the slideshow canvas from the outgoing frame A to the incoming frame B (both whole, ready
     canvases of W x H) at t from 0 to 1. o carries scratch canvases and the show's random seed. */
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* a frame drawn scaled about the centre */
  function scaled(x, c, z, W, H) { x.drawImage(c, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z); }
  /* a frame out of focus: drawn small (softened once more where ctx.filter exists) and stretched back */
  var FILTER = (function () { try { return 'filter' in FS.canvas(1, 1).getContext('2d'); } catch (e) { return false; } })();
  function blurred(o, key, c, amt, W, H) {
    var f = 1 + amt * 23, w = Math.max(2, Math.round(W / f)), h = Math.max(2, Math.round(H / f)), s = o.tmp(key, w, h), sx = s.getContext('2d');
    sx.clearRect(0, 0, w, h); if (FILTER) sx.filter = amt > 0.02 ? 'blur(1.2px)' : 'none'; sx.imageSmoothingQuality = 'high'; sx.drawImage(c, 0, 0, w, h); if (FILTER) sx.filter = 'none';
    return s;
  }
  var TR = [
    ['fade', 'דהייה רכה', function (x, A, B, t) { x.drawImage(A, 0, 0); x.globalAlpha = ease(t); x.drawImage(B, 0, 0); }],
    ['cine', 'זום קולנועי', function (x, A, B, t, W, H) { var e = ease(t); scaled(x, A, 1 + 0.12 * e, W, H); x.globalAlpha = e; scaled(x, B, 1.1 - 0.1 * e, W, H); }],
    /* RTL: the next photo comes in from the left, the way the pages of a Hebrew album turn */
    ['slide', 'החלקה', function (x, A, B, t, W, H) {
      var e = ease(t), bx = -W + W * e; x.drawImage(A, 0, 0); x.globalAlpha = 0.45 * e; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
      var g = x.createLinearGradient(bx + W, 0, bx + W + W * 0.04, 0); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(bx + W, 0, W * 0.04, H);
      x.drawImage(B, bx, 0);
    }],
    ['push', 'דחיפה', function (x, A, B, t, W) { var e = ease(t); x.drawImage(A, W * e, 0); x.drawImage(B, -W + W * e, 0); }],
    ['wipe', 'וילון', function (x, A, B, t, W, H, o) {
      var soft = W * 0.18, edge = -soft + (W + soft * 2) * ease(t), m = o.tmp('wipe', W, H), mx = m.getContext('2d');
      mx.globalCompositeOperation = 'copy'; mx.drawImage(B, 0, 0); mx.globalCompositeOperation = 'destination-in';
      var g = mx.createLinearGradient(edge - soft, 0, edge, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      mx.fillStyle = g; mx.fillRect(0, 0, W, H); mx.globalCompositeOperation = 'source-over';
      x.drawImage(A, 0, 0); x.drawImage(m, 0, 0);
    }],
    ['circle', 'עיגול נפתח', function (x, A, B, t, W, H) {
      var e = ease(t), r = e * Math.hypot(W, H) / 2; x.drawImage(A, 0, 0);
      x.save(); x.beginPath(); x.arc(W / 2, H / 2, Math.max(0.5, r), 0, Math.PI * 2); x.clip(); x.drawImage(B, 0, 0); x.restore();
      x.strokeStyle = 'rgba(214,183,126,' + (0.85 * (1 - e)).toFixed(3) + ')'; x.lineWidth = Math.max(1.5, Math.min(W, H) * 0.004); x.beginPath(); x.arc(W / 2, H / 2, Math.max(0.5, r), 0, Math.PI * 2); x.stroke();
    }],
    /* out of focus, and back into focus on the new photo; the two meet when both are softest */
    ['blur', 'טשטוש', function (x, A, B, t, W, H, o) {
      var amt = ease(t < 0.5 ? t * 2 : (1 - t) * 2), mix = clamp((t - 0.38) / 0.24);
      x.imageSmoothingQuality = 'high';
      if (mix < 1) x.drawImage(blurred(o, 'bA', A, amt, W, H), 0, 0, W, H);
      if (mix > 0) { x.globalAlpha = mix; x.drawImage(blurred(o, 'bB', B, amt, W, H), 0, 0, W, H); }
    }],
    /* a card turning over: the width follows the cosine, with a little depth and shade */
    ['flip', 'היפוך', function (x, A, B, t, W, H) {
      var a = ease(t) * Math.PI, sx = Math.abs(Math.cos(a)), sy = 1 - 0.08 * Math.sin(a), c = a < Math.PI / 2 ? A : B;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.save(); x.translate(W / 2, H / 2); x.scale(Math.max(0.002, sx), sy); x.drawImage(c, -W / 2, -H / 2);
      x.globalAlpha = 0.55 * Math.sin(a); x.fillStyle = '#000'; x.fillRect(-W / 2, -H / 2, W, H); x.restore();
    }],
    ['blinds', 'תריסים', function (x, A, B, t, W, H) {
      var n = 12, sw = W / n; x.drawImage(A, 0, 0);
      for (var i = 0; i < n; i++) {
        var k = ease(clamp((t - (n - 1 - i) / (n - 1) * 0.4) / 0.6)), w = sw * k; if (w < 0.5) continue;
        var sx = Math.floor(i * sw + (sw - w) / 2), ww = Math.ceil(w) + 1; x.drawImage(B, sx, 0, Math.min(ww, W - sx), H, sx, 0, Math.min(ww, W - sx), H);
      }
    }],
    ['mosaic', 'פסיפס', function (x, A, B, t, W, H, o) {
      var cols = 10, rows = Math.max(3, Math.round(cols * H / W)), N = cols * rows, tw = W / cols, th = H / rows;
      if (!o.order || o.order.length !== N || o.orderSeed !== o.seed) { var r = rng(o.seed), l = []; for (var q = 0; q < N; q++) l.push(q); for (q = N - 1; q > 0; q--) { var j = Math.floor(r() * (q + 1)), s = l[q]; l[q] = l[j]; l[j] = s; } o.order = l; o.orderSeed = o.seed; }
      x.drawImage(A, 0, 0);
      for (var k = 0; k < N; k++) {
        var a = clamp((t - k / N * 0.72) / 0.28); if (!a) continue;
        var id = o.order[k], cx = Math.floor((id % cols) * tw), cy = Math.floor(Math.floor(id / cols) * th), cw = Math.min(W - cx, Math.ceil(tw) + 1), ch = Math.min(H - cy, Math.ceil(th) + 1);
        x.globalAlpha = ease(a); x.drawImage(B, cx, cy, cw, ch, cx, cy, cw, ch);
      }
    }],
    ['zoomout', 'זום החוצה', function (x, A, B, t, W, H) { var e = ease(t); scaled(x, A, 1 - 0.05 * e, W, H); x.globalAlpha = clamp(t * 2.5); scaled(x, B, 1.6 - 0.6 * e, W, H); }],
    ['flash', 'הבזק לבן', function (x, A, B, t, W, H) {
      var w; if (t < 0.45) { x.drawImage(A, 0, 0); w = ease(t / 0.45); } else { x.drawImage(B, 0, 0); w = 1 - ease((t - 0.45) / 0.55); }
      x.globalAlpha = w; x.fillStyle = '#FFFBF2'; x.fillRect(0, 0, W, H);
    }],
    ['rotate', 'סיבוב קל', function (x, A, B, t, W, H) {
      var e = ease(t); scaled(x, A, 1 + 0.04 * e, W, H);
      x.save(); x.globalAlpha = clamp(t * 1.8); x.translate(W / 2, H / 2); x.rotate((1 - e) * -0.16); x.scale(0.78 + 0.22 * e, 0.78 + 0.22 * e); x.drawImage(B, -W / 2, -H / 2); x.restore();
    }],
    /* the old photo opens like two doors from the middle */
    ['split', 'מסך מתפצל', function (x, A, B, t, W, H) {
      var e = ease(t), h = W / 2, d = h * e; scaled(x, B, 1.08 - 0.08 * e, W, H);
      x.drawImage(A, 0, 0, h, H, -d, 0, h, H); x.drawImage(A, h, 0, W - h, H, h + d, 0, W - h, H);
      x.fillStyle = 'rgba(214,183,126,' + (0.6 * (1 - e)).toFixed(3) + ')'; x.fillRect(h - d - 1, 0, 1.5, H); x.fillRect(h + d - 0.5, 0, 1.5, H);
    }]
  ];
  var TRS = {}; TR.forEach(function (r) { TRS[r[0]] = r[2]; });
  /* draws transition `name` and leaves the context clean */
  function transit(x, name, A, B, t, W, H, o) { x.save(); x.globalAlpha = 1; (TRS[name] || TRS.fade)(x, A, B, clamp(t), W, H, o); x.restore(); }
  /* for "random": a fresh order of all of them, again and again, never the same one twice in a row */
  function sequence(n, seed) {
    var r = rng(seed), out = [], keys = TR.map(function (a) { return a[0]; });
    while (out.length < n) { var l = keys.slice(); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), s = l[i]; l[i] = l[j]; l[j] = s; } if (out.length && l[0] === out[out.length - 1]) l.push(l.shift()); out = out.concat(l); }
    return out.slice(0, n);
  }
  /* scratch canvases, kept per show and let go when it closes */
  function scratch() {
    var pool = {};
    return { tmp: function (k, w, h) { var c = pool[k]; if (!c) c = pool[k] = FS.canvas(w, h); else if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; },
      free: function () { Object.keys(pool).forEach(function (k) { pool[k].width = 0; }); pool = {}; } };
  }

  /* the owner's choices, remembered on this computer */
  var PREF = 'fs-slide-prefs';
  function prefs() { var p = {}; try { p = JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) { /* private mode */ } return { n: p.n || '20', sec: p.sec || '3.5', tr: TRS[p.tr] || p.tr === 'random' ? p.tr : 'random', dur: Math.min(2.5, Math.max(0.4, Number(p.dur) || 1)) }; }
  function savePrefs(ch) { var p = Object.assign(prefs(), ch); try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* private mode */ } return p; }
  function trOptions(sel) { return '<option value="random"' + (sel === 'random' ? ' selected' : '') + '>אקראי (מתחלף)</option>' + TR.map(function (r) { return '<option value="' + r[0] + '"' + (sel === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join(''); }
  function opts(list, sel) { return list.map(function (v) { return '<option' + (String(v) === String(sel) ? ' selected' : '') + '>' + v + '</option>'; }).join(''); }

  /* ---------- the panel ---------- */
  var P = prefs();
  var pane = document.createElement('section'); pane.dataset.pane = 'curate'; pane.hidden = true;
  pane.innerHTML = '<h2>בחירה ומצגת</h2>' +
    '<div class="card"><h3>🧹 סינון תמונות חלשות</h3><p class="hint">בודק כל תמונה: חדות, חשיפה, עיניים עצומות, חיוכים, וכפילויות מאותו רגע (נשארת הטובה מכולן). הכול במחשב.</p>' +
    '<button class="btn primary wide" id="cu-run">🔎 לבדוק את כל התמונות</button><div id="cu-out" class="cu-out"></div></div>' +
    '<div class="card"><h3>🎞️ מצגת מהאירוע</h3><p class="hint">התמונות הכי טובות, מפוזרות לאורך הערב, במסך מלא עם תנועה איטית ומעבר לבחירתכם. אפשר לשמור כסרטון.</p>' +
    '<div class="row2"><div class="field"><label for="cu-n">כמה תמונות</label><select id="cu-n">' + opts([12, 20, 30, 50, 80], P.n) + '</select></div><div class="field"><label for="cu-sec">שניות לתמונה</label><select id="cu-sec">' + opts([2, 2.5, 3.5, 5, 7], P.sec) + '</select></div></div>' +
    '<div class="field cu-tr"><label for="cu-tr">מעבר בין התמונות</label><select id="cu-tr">' + trOptions(P.tr) + '</select>' +
    '<canvas id="cu-prev" class="cu-prev" width="480" height="270" aria-label="תצוגה מקדימה של המעבר" title="לחיצה מנגנת שוב"></canvas></div>' +
    '<div class="field"><label for="cu-dur">משך המעבר <output id="o-cu-dur">' + P.dur.toFixed(1) + ' שנ׳</output></label><input type="range" id="cu-dur" min="0.4" max="2.5" step="0.1" value="' + P.dur + '"></div>' +
    '<div class="field"><label for="cu-title">כותרת פתיחה (לא חובה)</label><input id="cu-title" maxlength="50" placeholder="למשל: נועה & דניאל · 12.06.2027"></div>' +
    '<div class="row2"><button class="btn primary" id="cu-show">▶ הצגת המצגת</button><button class="btn" id="cu-pick">✔ לסמן את התמונות שבמצגת</button></div></div>';
  var panel = $('#panel'); panel.insertBefore(pane, $('[data-pane=output]', panel));
  var tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.tab = 'curate';
  tab.innerHTML = '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="m15 17 2 2 4-5"/></svg>בחירה ומצגת';
  var rail = $('.tools'); rail.insertBefore(tab, $('[data-tab=output]', rail));
  tab.addEventListener('click', function () { FS.openTab('curate'); setTimeout(preview, 60); });

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
  function ready() {
    var missing = S.photos.filter(function (p) { return !p.rate; }); if (!missing.length) return Promise.resolve();
    var stop = false; FS.busy('🔎 בוחר את התמונות הכי טובות…', function () { stop = true; });
    return FS.scoreAll(S.photos, function (i, n) { if (stop) throw new Error('stop'); FS.busy('🔎 בוחר את התמונות הכי טובות · ' + i + '/' + n, function () { stop = true; }); })
      .then(function () { FS.busy(); }, function () { FS.busy(); });
  }
  $('#cu-pick').addEventListener('click', function () { if (!S.photos.length) return; ready().then(function () { var l = bestOf(Number($('#cu-n').value)); S.marked = {}; l.forEach(function (p) { S.marked[p.id] = true; }); FS.buildStrip(); FS.toast('✔ סומנו ' + l.length + ' התמונות של המצגת'); }); });
  $('#cu-show').addEventListener('click', function () {
    if (S.photos.length < 2) return FS.toast('צריך כמה תמונות למצגת');
    ready().then(function () { play(bestOf(Number($('#cu-n').value)), Number($('#cu-sec').value), $('#cu-title').value.trim()); });
  });
  $('#cu-n').addEventListener('change', function () { savePrefs({ n: this.value }); });
  $('#cu-sec').addEventListener('change', function () { savePrefs({ sec: this.value }); });
  $('#cu-tr').addEventListener('change', function () { savePrefs({ tr: this.value }); preview(); });
  $('#cu-dur').addEventListener('input', function () { $('#o-cu-dur').textContent = Number(this.value).toFixed(1) + ' שנ׳'; savePrefs({ dur: Number(this.value) }); });
  $('#cu-dur').addEventListener('change', preview);
  $('#cu-prev').addEventListener('click', preview);

  /* one slide, drawn once for a W x H screen: the background (the photo blurred by drawing it tiny and stretching it,
     darkened, with a soft vignette) and the photo itself (contained, with room to zoom and its shadow baked in) */
  var KB = 1.08;
  function makeFrame(s, W, H) {
    var bg = FS.canvas(W, H), b = bg.getContext('2d');
    if (s.title || s.card) {
      var g = b.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.hypot(W, H) / 1.6); g.addColorStop(0, s.card || '#211B29'); g.addColorStop(1, '#0D0B10');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      var fs = Math.round(Math.min(W, H) * (s.card ? 0.16 : 0.08)); b.fillStyle = '#E9D4A6'; b.textAlign = 'center'; b.textBaseline = 'middle'; b.direction = 'rtl';
      b.font = '700 ' + fs + 'px "Frank Ruhl Libre", serif'; b.fillText(s.title || s.label || '', W / 2, H / 2);
      b.fillStyle = 'rgba(214,183,126,.5)'; b.fillRect(W / 2 - fs, H / 2 + fs * 0.85, fs * 2, Math.max(1, fs * 0.03));
      return { bg: bg };
    }
    var im = FS.img(s.p.src); if (!im || !im.naturalWidth) { b.fillStyle = '#000'; b.fillRect(0, 0, W, H); return { bg: bg }; }
    var iw = im.naturalWidth, ih = im.naturalHeight, fit = Math.min(W / iw, H / ih), pw = Math.max(1, Math.round(iw * fit * KB)), phh = Math.max(1, Math.round(ih * fit * KB)), pad = Math.round(Math.min(W, H) * 0.04);
    var ph = FS.canvas(pw + pad * 2, phh + pad * 2), px = ph.getContext('2d'); px.imageSmoothingQuality = 'high';
    px.shadowColor = 'rgba(0,0,0,.55)'; px.shadowBlur = pad * 0.8; px.shadowOffsetY = pad * 0.2; px.drawImage(im, pad, pad, pw, phh);
    var sw = Math.max(2, Math.round(W / 14)), sh = Math.max(2, Math.round(H / 14)), sm = FS.canvas(sw, sh), sx = sm.getContext('2d'), cov = Math.max(sw / pw, sh / phh);
    if (FILTER) sx.filter = 'blur(1.5px)'; sx.drawImage(ph, pad, pad, pw, phh, (sw - pw * cov) / 2, (sh - phh * cov) / 2, pw * cov, phh * cov);
    b.imageSmoothingQuality = 'high'; b.drawImage(sm, 1, 1, sw - 2, sh - 2, 0, 0, W, H); sm.width = 0;
    b.fillStyle = 'rgba(8,6,10,.55)'; b.fillRect(0, 0, W, H);
    var v = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); b.fillStyle = v; b.fillRect(0, 0, W, H);
    var fx = 0, fy = 0; if (s.p.faces && s.p.faces.length) { var f = s.p.faces[0]; fx = (f.x + f.w / 2) / iw - 0.5; fy = (f.y + f.h / 2) / ih - 0.5; }
    return { bg: bg, ph: ph, pw: pw, phh: phh, pad: pad, fx: fx, fy: fy };
  }
  function freeFrame(fr) { if (!fr) return; fr.bg.width = 0; if (fr.ph) fr.ph.width = 0; }
  /* a slide at k (0..1 of its time on screen): the slow move goes towards the faces, left and right in turns */
  function drawFrame(x, fr, k, idx, still, W, H) {
    x.drawImage(fr.bg, 0, 0); if (!fr.ph) return;
    var z = still ? 1 : 1 + 0.06 * k, s = z / KB, w = fr.pw * s, h = fr.phh * s, dir = idx % 2 ? 1 : -1;
    var ox = (W - w) / 2 - (still ? 0 : fr.fx * w * 0.06 * k + dir * W * 0.01 * k), oy = (H - h) / 2 - (still ? 0 : fr.fy * h * 0.06 * k);
    x.drawImage(fr.ph, ox - fr.pad * s, oy - fr.pad * s, (fr.pw + fr.pad * 2) * s, (fr.phh + fr.pad * 2) * s);
  }

  /* the small preview in the panel: two photos (or two cards) and the chosen transition, played twice and then still */
  var pv = { raf: 0, frames: null, key: '' };
  function preview() {
    var c = $('#cu-prev'); if (!c || pane.hidden) return;
    cancelAnimationFrame(pv.raf);
    var W = c.width, H = c.height, x = c.getContext('2d'), ph = S.photos.filter(function (p) { var im = FS.img(p.src); return im && im.naturalWidth; }).slice(0, 2);
    var key = ph.map(function (p) { return p.src; }).join('|');
    if (!pv.frames || pv.key !== key) {
      if (pv.frames) pv.frames.forEach(freeFrame);
      var sl = ph.length === 2 ? ph.map(function (p) { return { p: p }; }) : [{ card: '#3A2E44', label: 'א' }, { card: '#5A4630', label: 'ב' }];
      pv.frames = sl.map(function (s) { return makeFrame(s, W, H); }); pv.key = key;
    }
    var A = FS.canvas(W, H), B = FS.canvas(W, H); drawFrame(A.getContext('2d'), pv.frames[0], 0.5, 0, true, W, H); drawFrame(B.getContext('2d'), pv.frames[1], 0.5, 1, true, W, H);
    var mode = $('#cu-tr').value, dur = Number($('#cu-dur').value) * 1000, hold = 450, cyc = dur + hold * 2, seq = sequence(4, 7), o = scratch(); o.seed = 7;
    var start = performance.now();
    function step(now) {
      if (pane.hidden || !c.isConnected) { o.free(); return; }
      var t = now - start, n = Math.floor(t / cyc), local = t - n * cyc, from = n % 2 ? B : A, to = n % 2 ? A : B, name = mode === 'random' ? seq[n % seq.length] : mode;
      if (n >= 2) { x.drawImage(A, 0, 0); label(x, mode === 'random' ? 'אקראי (מתחלף)' : nameOf(mode), W, H); o.free(); return; }
      o.seed = 7 + n;
      if (local < hold) x.drawImage(from, 0, 0); else if (local > hold + dur) x.drawImage(to, 0, 0);
      else { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); transit(x, name, from, to, (local - hold) / dur, W, H, o); }
      label(x, nameOf(name), W, H);
      pv.raf = requestAnimationFrame(step);
    }
    pv.raf = requestAnimationFrame(step);
  }
  function nameOf(k) { for (var i = 0; i < TR.length; i++) if (TR[i][0] === k) return TR[i][1]; return ''; }
  function label(x, s, W, H) {
    x.save(); x.font = '600 15px "Assistant", sans-serif'; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
    var w = x.measureText(s).width + 26; x.fillStyle = 'rgba(13,11,16,.72)'; x.strokeStyle = 'rgba(214,183,126,.5)'; x.lineWidth = 1;
    x.beginPath(); if (x.roundRect) x.roundRect(W / 2 - w / 2, H - 40, w, 28, 14); else x.rect(W / 2 - w / 2, H - 40, w, 28); x.fill(); x.stroke();
    x.fillStyle = '#E9D4A6'; x.fillText(s, W / 2, H - 26); x.restore();
  }

  /* the player: each slide is drawn once ahead of time (the next one while the current one shows), the frames are
     cheap copies with the slow move, and between slides the chosen transition; ⏺ records exactly this as a video */
  function play(list, sec, title) {
    if (!list.length) return FS.toast('לא נמצאו תמונות טובות למצגת');
    var P = prefs(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ov = document.createElement('div'); ov.className = 'ss'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'מצגת');
    ov.innerHTML = '<canvas></canvas><div class="ss-bar"><button class="ss-b" data-a="prev" aria-label="הקודמת">⏮</button><button class="ss-b" data-a="pause" aria-label="השהיה">⏸</button><button class="ss-b" data-a="next" aria-label="הבאה">⏭</button><span class="ss-n"></span>' +
      '<select class="ss-sel" aria-label="מעבר בין התמונות">' + trOptions(P.tr) + '</select><button class="ss-b" data-a="rec">⏺ שמירה כסרטון</button><button class="ss-b" data-a="close" aria-label="סגירה">✕</button></div>';
    document.body.appendChild(ov);
    var cv = $('canvas', ov), x = cv.getContext('2d'), W, H, t0 = performance.now(), paused = false, pausedAt = 0, raf = 0, rec = null, chunks = [], closed = false;
    var slides = (title ? [{ title: title }] : []).concat(list.map(function (p) { return { p: p }; })), n = slides.length, D = sec * 1000, F, total = n * D;
    var mode = still ? 'fade' : P.tr, seq = sequence(n, (Date.now() & 0xffff) + 1), o = scratch(), cache = {}, bufA, bufB, shown = -1, lastT = -1, count = '';
    function setDur(s) { F = Math.min(s * 1000, D * 0.7); }
    setDur(P.dur);
    /* at most 1920px on the long side: smooth on any screen, and a sharp Full HD video */
    function size() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), k = Math.min(dpr, 1920 / Math.max(innerWidth, innerHeight));
      W = cv.width = Math.round(innerWidth * k); H = cv.height = Math.round(innerHeight * k);
      Object.keys(cache).forEach(function (i) { freeFrame(cache[i]); }); cache = {};
      if (bufA) { bufA.width = bufB.width = 0; } bufA = FS.canvas(W, H); bufB = FS.canvas(W, H); lastT = -1;
    }
    size(); addEventListener('resize', size);
    function frameOf(i) { return cache[i] || (cache[i] = makeFrame(slides[i], W, H)); }
    /* keep only the slides around the current one; draw the next ones while the browser is idle */
    function around(i) {
      var keep = {}; [i - 1, i, i + 1, (i + 1) % n].forEach(function (j) { if (j >= 0) keep[j] = 1; });
      Object.keys(cache).forEach(function (j) { if (!keep[j]) { freeFrame(cache[j]); delete cache[j]; } });
      later(function () { if (!closed) frameOf((i + 1) % n); });
    }
    /* each slide's slow move runs from the start of its incoming transition to the end of its outgoing one */
    function kOf(i, t) { return Math.max(0, Math.min(1, (t - (i * D - F)) / (D + F))); }
    function trOf(i) { return mode === 'random' ? seq[i % n] : mode; }
    function frame(now) {
      if (closed) return;
      raf = requestAnimationFrame(frame);
      /* the frame time can be a little before t0 was taken */
      var t = Math.max(0, paused ? pausedAt : now - t0);
      if (t >= total) { if (rec && rec.state !== 'inactive') rec.stop(); t0 = now; t = 0; }
      if (paused && t === lastT) return;
      lastT = t;
      var i = Math.min(n - 1, Math.floor(t / D)), local = t - i * D, j = i + 1 < n ? i + 1 : (rec ? -1 : 0);
      if (i !== shown) { shown = i; around(i); }
      if (local > D - F && j >= 0 && n > 1) {
        var tt = (local - (D - F)) / F;
        drawFrame(bufA.getContext('2d'), frameOf(i), kOf(i, t), i, still, W, H);
        drawFrame(bufB.getContext('2d'), frameOf(j), j ? kOf(j, t) : (local - (D - F)) / (D + F), j, still, W, H);
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H); o.seed = i * 7919 + 13; transit(x, trOf(i), bufA, bufB, tt, W, H, o);
      } else drawFrame(x, frameOf(i), kOf(i, t), i, still, W, H);
      var lb = (i + 1) + ' / ' + n; if (lb !== count) { count = lb; $('.ss-n', ov).textContent = lb; }
    }
    raf = requestAnimationFrame(frame);
    function jump(d) { var t = paused ? pausedAt : performance.now() - t0, i = Math.max(0, Math.min(n - 1, Math.floor(t / D) + d)); if (paused) pausedAt = i * D; else t0 = performance.now() - i * D; lastT = -1; }
    function close() {
      if (closed) return; closed = true; cancelAnimationFrame(raf);
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } rec = null;
      removeEventListener('resize', size); removeEventListener('keydown', key);
      Object.keys(cache).forEach(function (i) { freeFrame(cache[i]); }); cache = {}; bufA.width = bufB.width = 0; o.free(); ov.remove();
    }
    function key(e) {
      if (e.target && e.target.tagName === 'SELECT') { if (e.key === 'Escape') close(); return; }
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') jump(1); else if (e.key === 'ArrowRight') jump(-1); else if (e.key === ' ') { e.preventDefault(); toggle(); }
    }
    function toggle() { if (paused) { t0 = performance.now() - pausedAt; paused = false; } else { pausedAt = performance.now() - t0; paused = true; } $('[data-a=pause]', ov).textContent = paused ? '▶' : '⏸'; }
    addEventListener('keydown', key);
    $('.ss-sel', ov).addEventListener('change', function () { mode = still ? 'fade' : this.value; savePrefs({ tr: this.value }); var s = $('#cu-tr'); if (s) s.value = this.value; lastT = -1; });
    ov.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return; var btn = a; a = a.dataset.a;
      if (a === 'close') close(); else if (a === 'next') jump(1); else if (a === 'prev') jump(-1); else if (a === 'pause') toggle();
      else if (a === 'rec') {
        if (rec && rec.state !== 'inactive') return rec.stop();
        if (!cv.captureStream || !window.MediaRecorder) return FS.toast('הדפדפן הזה לא יודע לשמור סרטון. ב־Chrome זה עובד.');
        var type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
        rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 8000000 }); chunks = [];
        rec.ondataavailable = function (ev) { if (ev.data.size) chunks.push(ev.data); };
        rec.onstop = function () { var b = new Blob(chunks, { type: type.split(';')[0] }); FS.download(b, 'מצגת' + (title ? ' - ' + title.replace(/[\\/:*?"<>|]+/g, '_') : '') + (/mp4/.test(type) ? '.mp4' : '.webm')); rec = null; btn.textContent = '⏺ שמירה כסרטון'; FS.toast('🎞️ הסרטון נשמר', 4000); };
        paused = false; $('[data-a=pause]', ov).textContent = '⏸'; t0 = performance.now(); lastT = -1; rec.start(500); btn.textContent = '⏹ עצירה ושמירה';
        FS.toast('⏺ מקליט את המצגת מההתחלה, עם המעברים שבחרתם (' + Math.round(total / 1000) + ' שניות). בסוף הקובץ יורד.', 5000);
      }
    });
    return { close: close };
  }
  FS.slideshow = play;
  FS.slideTransitions = TR.map(function (r) { return { id: r[0], name: r[1], draw: r[2] }; });
})();
