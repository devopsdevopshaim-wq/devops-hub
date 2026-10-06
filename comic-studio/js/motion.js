/* סטודיו הנפשה: הופך ציור לקטע וידאו קצר בלולאה (הציור נבנה, קווים חיים, זום אקשן, גליץ׳ ועוד),
   ועמוד קומיקס לסרטון שעובר מפאנל לפאנל. ההקלטה נעשית בדפדפן (MediaRecorder) ל-MP4 או WebM. */
(function () {
  'use strict';

  var FX = window.ComicFX, U = FX.util;

  var EFFECTS = [
    { id: 'build', name: 'הציור נבנה', desc: 'מהצילום לקווי עיפרון ואז לצבע.', dur: 6 },
    { id: 'wipe', name: 'לפני ואחרי', desc: 'משיכת מכחול שחושפת את הציור.', dur: 5 },
    { id: 'boil', name: 'קווים חיים', desc: 'רעד של ציור יד, כמו אנימציה מסורתית.', dur: 3 },
    { id: 'action', name: 'זום אקשן', desc: 'הבזק, רעידה וקווי מהירות.', dur: 3 },
    { id: 'kenburns', name: 'תנועת מצלמה', desc: 'זום ותנועה איטיים, קולנועיים.', dur: 6 },
    { id: 'glitch', name: 'גליץ׳', desc: 'הפרדת צבעים ופסים קופצים.', dur: 3 },
    { id: 'sparkle', name: 'נצנוצים', desc: 'כוכבים מנצנצים על האזורים הבהירים.', dur: 4 },
    { id: 'rain', name: 'גשם וברקים', desc: 'גשם נוטה והבזקי ברק.', dur: 4 },
    { id: 'halftone', name: 'גל נקודות', desc: 'נקודות דפוס שזורמות על הציור.', dur: 4 },
    { id: 'neon', name: 'הבהוב ניאון', desc: 'זוהר שפועם ומהבהב.', dur: 4 }
  ];
  var BY_ID = {};
  EFFECTS.forEach(function (e) { BY_ID[e.id] = e; });

  function canvasOf(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function fit(src, w, h) { var c = canvasOf(w, h); c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }

  /* גודל וידאו: הצד הארוך עד 1080, מידות זוגיות */
  function videoSize(w, h, max) {
    var k = Math.min(1, (max || 1080) / Math.max(w, h));
    return [Math.round(w * k / 2) * 2, Math.round(h * k / 2) * 2];
  }

  /* קווי הציור כשכבה שקופה */
  function lineLayer(art) {
    var w = art.width, h = art.height, P = U.planes(art), ink = U.inkLines(U.lumOf(P), w, h, 62, Math.max(0.5, Math.max(w, h) / 1000));
    var c = canvasOf(w, h), x = c.getContext('2d'), im = x.createImageData(w, h);
    for (var i = 0; i < w * h; i++) { im.data[i * 4] = 24; im.data[i * 4 + 1] = 22; im.data[i * 4 + 2] = 30; im.data[i * 4 + 3] = Math.min(255, ink[i] * 290); }
    x.putImageData(im, 0, 0);
    return c;
  }

  /* מסכת חשיפה: רעש רך. פיקסל מופיע כשהזמן עובר את ערך הרעש שלו */
  function revealField(w, h, seed, radial) {
    var r = U.rng(seed), n = new Float32Array(w * h);
    for (var i = 0; i < n.length; i++) n[i] = r();
    n = U.blur(n, w, h, Math.max(4, Math.round(w / 60)));
    var mn = 1, mx = 0;
    for (i = 0; i < n.length; i++) { if (n[i] < mn) mn = n[i]; if (n[i] > mx) mx = n[i]; }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var j = y * w + x, v = (n[j] - mn) / (mx - mn || 1);
      if (radial) { var d = Math.hypot(x / w - 0.5, y / h - 0.45) * 1.5; v = v * 0.45 + d * 0.55; }
      n[j] = v;
    }
    return n;
  }

  function maskedDraw(ctx, src, field, t, soft, buf) {
    var w = src.width, h = src.height;
    var sd = buf.src || (buf.src = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h));
    var out = buf.out || (buf.out = ctx.createImageData(w, h));
    var d = out.data, s = sd.data;
    for (var i = 0, j = 0; j < w * h; i += 4, j++) {
      var a = clamp((t - field[j]) / soft);
      d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3] * a;
    }
    var tmp = buf.tmp || (buf.tmp = canvasOf(w, h));
    tmp.getContext('2d').putImageData(out, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }

  function displaced(art, seed, amp) {
    var w = art.width, h = art.height, r = U.rng(seed), nx = new Float32Array(w * h), ny = new Float32Array(w * h), i;
    for (i = 0; i < nx.length; i++) { nx[i] = r(); ny[i] = r(); }
    var rad = Math.max(3, Math.round(w / 90));
    nx = U.blur(nx, w, h, rad); ny = U.blur(ny, w, h, rad);
    var src = art.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    var c = canvasOf(w, h), x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
    for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
      var j = y * w + xx, sx = Math.min(w - 1, Math.max(0, Math.round(xx + (nx[j] - 0.5) * amp * 8))), sy = Math.min(h - 1, Math.max(0, Math.round(y + (ny[j] - 0.5) * amp * 8)));
      var si = (sy * w + sx) * 4, di = j * 4;
      d[di] = src[si]; d[di + 1] = src[si + 1]; d[di + 2] = src[si + 2]; d[di + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  function brightSpots(art, n, seed) {
    var w = art.width, h = art.height, d = art.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, r = U.rng(seed), pts = [];
    for (var k = 0; k < n * 30 && pts.length < n; k++) {
      var x = (r() * w) | 0, y = (r() * h) | 0, i = (y * w + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] > 560) pts.push({ x: x, y: y, ph: r() * Math.PI * 2, s: 0.5 + r() });
    }
    return pts;
  }

  function star(x, cx, cy, s, a) {
    x.save();
    x.globalAlpha = a;
    x.translate(cx, cy);
    x.fillStyle = '#fff';
    x.shadowColor = 'rgba(255,255,255,0.9)';
    x.shadowBlur = s * 1.5;
    x.beginPath();
    for (var i = 0; i < 8; i++) { var ang = i * Math.PI / 4, rr = i % 2 ? s * 0.16 : s; x.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    x.closePath();
    x.fill();
    x.restore();
  }

  function speedLines(x, w, h, seed, amt, color) {
    var r = U.rng(seed), R = Math.hypot(w, h), cx = w / 2, cy = h * 0.45, inner = Math.min(w, h) * 0.32;
    x.save();
    x.fillStyle = color;
    for (var i = 0; i < 70 * amt; i++) {
      var a = r() * Math.PI * 2, wd = 0.004 + r() * 0.01, st = inner * (0.9 + r() * 0.8);
      x.beginPath();
      x.moveTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
      x.lineTo(cx + Math.cos(a) * st, cy + Math.sin(a) * st);
      x.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
      x.fill();
    }
    x.restore();
  }

  /* בונה פונקציית ציור לפריים לפי האפקט. sources: { art, photo } */
  function setup(effectId, sources, size) {
    var w = size[0], h = size[1];
    var art = fit(sources.art, w, h), photo = fit(sources.photo || sources.art, w, h);
    var e = BY_ID[effectId] || EFFECTS[0], st = {};
    if (effectId === 'build') {
      st.lines = lineLayer(art);
      st.fLines = revealField(w, h, 3, false);
      st.fColor = revealField(w, h, 9, true);
      st.b1 = {}; st.b2 = {};
    } else if (effectId === 'wipe') {
      st.field = new Float32Array(w * h);
      var r = U.rng(4), wav = [];
      for (var k = 0; k < 8; k++) wav.push([r() * 6 + 2, r() * 6.28, r() * 0.04]);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var off = 0;
        wav.forEach(function (q) { off += Math.sin(y / h * q[0] * 6.28 + q[1]) * q[2]; });
        st.field[y * w + x] = clamp((1 - x / w) * 0.85 + (y / h) * 0.15 + off);
      }
      st.b = {};
    } else if (effectId === 'boil') {
      st.frames = [displaced(art, 11, 1), displaced(art, 23, 1), displaced(art, 37, 1)];
    } else if (effectId === 'sparkle') {
      st.pts = brightSpots(art, 40, 5);
    } else if (effectId === 'rain') {
      var rr = U.rng(8);
      st.drops = [];
      for (var i = 0; i < 260; i++) st.drops.push({ x: rr() * w * 1.3, y: rr() * h, l: 10 + rr() * 26, v: 0.8 + rr() * 0.6 });
    } else if (effectId === 'halftone') {
      var P = U.planes(art);
      st.L = U.lumOf(P);
    } else if (effectId === 'neon') {
      st.glow = canvasOf(w, h);
      var gx = st.glow.getContext('2d');
      gx.filter = 'blur(' + Math.round(w / 90) + 'px) brightness(1.6) saturate(1.8)';
      gx.drawImage(art, 0, 0);
    }

    return {
      w: w, h: h, dur: e.dur,
      draw: function (ctx, time) {
        var T = e.dur, t = (time % T) / T;
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        if (effectId === 'build') {
          ctx.drawImage(photo, 0, 0);
          var toWhite = clamp((t - 0.06) / 0.14);
          ctx.globalAlpha = toWhite; ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
          if (t > 0.12) maskedDraw(ctx, st.lines, st.fLines, (t - 0.12) / 0.26 * 1.15, 0.08, st.b1);
          if (t > 0.4) maskedDraw(ctx, art, st.fColor, (t - 0.4) / 0.28 * 1.2, 0.12, st.b2);
          if (t > 0.92) { ctx.globalAlpha = (t - 0.92) / 0.08; ctx.drawImage(photo, 0, 0); }
        } else if (effectId === 'wipe') {
          var ph = t < 0.5 ? ease(clamp((t - 0.08) / 0.34)) : 1 - ease(clamp((t - 0.58) / 0.34));
          ctx.drawImage(photo, 0, 0);
          maskedDraw(ctx, art, st.field, ph * 1.12, 0.06, st.b);
        } else if (effectId === 'boil') {
          ctx.drawImage(st.frames[Math.floor(time * 8) % 3], 0, 0);
        } else if (effectId === 'action') {
          var p = clamp(t / 0.25);
          var sh = t < 0.45 ? (1 - t / 0.45) * w * 0.012 : 0, sx = Math.sin(time * 90) * sh, sy = Math.cos(time * 77) * sh;
          ctx.translate(w / 2 + sx, h / 2 + sy); ctx.scale(1.02 + 0.08 * ease(p), 1.02 + 0.08 * ease(p)); ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(art, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          speedLines(ctx, w, h, Math.floor(time * 12), 1, 'rgba(255,255,255,0.75)');
          speedLines(ctx, w, h, Math.floor(time * 12) + 99, 0.6, 'rgba(10,10,14,0.85)');
          if (t < 0.08) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - t / 0.08) + ')'; ctx.fillRect(0, 0, w, h); }
        } else if (effectId === 'kenburns') {
          var k2 = ease(t < 0.5 ? t * 2 : 2 - t * 2), s = 1.02 + 0.12 * k2;
          ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-w / 2 + (k2 - 0.5) * w * 0.04, -h / 2 + (k2 - 0.5) * h * 0.02);
          ctx.drawImage(art, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
          vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
          ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
        } else if (effectId === 'glitch') {
          ctx.drawImage(art, 0, 0);
          var gr = U.rng(Math.floor(time * 14)), burst = gr() < 0.45;
          if (burst) {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.55;
            var o = (gr() * 0.02 + 0.006) * w;
            ctx.filter = 'sepia(1) hue-rotate(300deg) saturate(6)'; ctx.drawImage(art, o, 0);
            ctx.filter = 'sepia(1) hue-rotate(140deg) saturate(6)'; ctx.drawImage(art, -o, 0);
            ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            for (var b = 0; b < 7; b++) {
              var yy = gr() * h, hh2 = gr() * h * 0.06 + 2, dx = (gr() - 0.5) * w * 0.12;
              ctx.drawImage(art, 0, yy, w, hh2, dx, yy, w, hh2);
            }
          }
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          for (var ly = (time * 60) % 4; ly < h; ly += 4) ctx.fillRect(0, ly, w, 1);
        } else if (effectId === 'sparkle') {
          ctx.drawImage(art, 0, 0);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.12 + 0.08 * Math.sin(time * 2.2);
          ctx.filter = 'blur(' + Math.round(w / 70) + 'px)'; ctx.drawImage(art, 0, 0); ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          st.pts.forEach(function (q) {
            var a = Math.max(0, Math.sin(time * 2.6 + q.ph));
            if (a > 0.05) star(ctx, q.x, q.y, w * 0.018 * q.s * (0.6 + a * 0.6), a);
          });
        } else if (effectId === 'rain') {
          ctx.drawImage(art, 0, 0);
          ctx.fillStyle = 'rgba(8,14,30,0.28)'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = Math.max(1, w / 700);
          ctx.beginPath();
          st.drops.forEach(function (d) {
            var yy = (d.y + time * h * 1.4 * d.v) % (h + 40) - 20, xx = d.x - yy * 0.25;
            ctx.moveTo(xx, yy); ctx.lineTo(xx - d.l * 0.25, yy + d.l);
          });
          ctx.stroke();
          var fl = (t > 0.62 && t < 0.66) || (t > 0.7 && t < 0.72);
          if (fl) { ctx.fillStyle = 'rgba(235,240,255,0.55)'; ctx.fillRect(0, 0, w, h); }
        } else if (effectId === 'halftone') {
          ctx.drawImage(art, 0, 0);
          var cell = Math.max(6, w / 70), L = st.L;
          ctx.fillStyle = 'rgba(20,16,30,0.55)';
          ctx.beginPath();
          for (var yy2 = cell / 2; yy2 < h; yy2 += cell) for (var xx2 = cell / 2; xx2 < w; xx2 += cell) {
            var wave = 0.5 + 0.5 * Math.sin((xx2 + yy2) / w * 6 - time * 3.2);
            var dark = 1 - L[(yy2 | 0) * w + (xx2 | 0)], rad = cell * 0.5 * Math.sqrt(dark) * wave;
            if (rad > 0.6) { ctx.moveTo(xx2 + rad, yy2); ctx.arc(xx2, yy2, rad, 0, 6.283); }
          }
          ctx.fill();
        } else if (effectId === 'neon') {
          var fl2 = Math.sin(time * 9) > 0.92 ? 0.2 : 1;
          ctx.globalAlpha = fl2; ctx.drawImage(art, 0, 0);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = (0.35 + 0.3 * Math.sin(time * 3.1)) * fl2;
          ctx.drawImage(st.glow, 0, 0);
        }
        ctx.restore();
      }
    };
  }

  /* נגן: מצייר בלולאה על canvas, ויודע להקליט לקובץ */
  function Player(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.raf = 0;
    this.t0 = 0;
  }
  Player.prototype.load = function (scene) {
    this.scene = scene;
    this.canvas.width = scene.w; this.canvas.height = scene.h;
    this.play();
  };
  Player.prototype.play = function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    this.t0 = performance.now();
    var loop = function (now) {
      if (!self.scene) return;
      self.scene.draw(self.ctx, (now - self.t0) / 1000);
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  Player.prototype.stop = function () { cancelAnimationFrame(this.raf); this.raf = 0; };

  function pickMime() {
    var list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (!window.MediaRecorder) return null;
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }

  /* מקליט לולאות מלאות של הסצנה. onProgress(0..1) */
  Player.prototype.record = function (loops, onProgress) {
    var self = this, mime = pickMime();
    if (mime === null || !this.canvas.captureStream) return Promise.reject(new Error('הדפדפן הזה לא תומך בהקלטת וידאו. נסו Chrome, Edge או Safari עדכני.'));
    var stream = this.canvas.captureStream(30);
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 });
    var chunks = [], total = this.scene.dur * (loops || 1) * 1000;
    return new Promise(function (resolve, reject) {
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { reject(e.error || new Error('ההקלטה נכשלה')); };
      rec.onstop = function () {
        var type = (rec.mimeType || mime || 'video/webm').split(';')[0];
        resolve({ blob: new Blob(chunks, { type: type }), ext: type.indexOf('mp4') >= 0 ? 'mp4' : 'webm' });
      };
      self.play();
      rec.start(250);
      var start = performance.now();
      (function tick() {
        var f = (performance.now() - start) / total;
        onProgress && onProgress(Math.min(1, f));
        if (f >= 1) { rec.stop(); return; }
        setTimeout(tick, 200);
      })();
    });
  };

  /* סרטון מעמוד קומיקס: המצלמה עוברת מפאנל לפאנל ובסוף מציגה את כל העמוד */
  function pageScene(page, rects, opts) {
    opts = opts || {};
    var size = opts.size || videoSize(1080, 1350), w = size[0], h = size[1];
    var per = opts.perPanel || 2.2, move = 0.7, endHold = 2.6;
    var shots = rects.map(function (r) { return r; });
    shots.push({ x: 0, y: 0, w: page.width, h: page.height, page: true });
    var dur = shots.length * per + endHold - per;
    function cam(r) {
      var pad = r.page ? 1.04 : 1.08;
      var s = Math.min(w / (r.w * pad), h / (r.h * pad));
      return { s: s, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
    }
    var cams = shots.map(cam);
    return {
      w: w, h: h, dur: dur,
      draw: function (ctx, time) {
        var tt = time % dur, i = Math.min(shots.length - 1, Math.floor(tt / per)), local = tt - i * per;
        var a = cams[i], b = cams[Math.max(0, i - 1)];
        var m = i === 0 ? 1 : ease(clamp(local / move));
        var push = 1 + 0.035 * clamp((local - move) / (per - move));
        var s = (b.s + (a.s - b.s) * m) * (i === shots.length - 1 ? 1 : push), cx = b.cx + (a.cx - b.cx) * m, cy = b.cy + (a.cy - b.cy) * m;
        ctx.save();
        ctx.fillStyle = '#121318';
        ctx.fillRect(0, 0, w, h);
        ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-cx, -cy);
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30 / s;
        ctx.drawImage(page, 0, 0);
        ctx.restore();
        /* פתיחה מהשחור */
        if (tt < 0.4) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - tt / 0.4) + ')'; ctx.fillRect(0, 0, w, h); }
      }
    };
  }

  window.ComicMotion = { EFFECTS: EFFECTS, byId: BY_ID, setup: setup, Player: Player, pageScene: pageScene, videoSize: videoSize };
})();
