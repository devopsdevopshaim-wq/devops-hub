/* סרט קומיקס קולנועי: הופך עמודי קומיקס לסרט. כתובית פתיחה, מצלמה שנעה בתוך כל פאנל,
   בועות שקופצות אחת אחרי השנייה, מעברים קולנועיים, צבע של סרט, גרעין ושוליים, ופסקול
   שנוצר בדפדפן (מוזיקה ואפקטים, בלי קבצים ובלי עלות). הכול מצויר על canvas ומוקלט ב-MediaRecorder. */
(function () {
  'use strict';

  var PG = window.ComicPage;

  /* ---------- סגנונות סרט ---------- */
  var LOOKS = [
    { id: 'blockbuster', name: 'שובר קופות', desc: 'צבעי קולנוע כתום-כחול, שוליים שחורים, מוזיקה אפית.',
      grade: 'teal', bars: true, base: 2.7, z: [1.03, 1.15], trans: ['whip', 'flash', 'zoom', 'whip'], music: 'epic', title: 'gold', grain: 0.07, leak: true },
    { id: 'action', name: 'אקשן מנגה', desc: 'זום חד, הבזקים, קווי מהירות ורעידות.',
      grade: 'punch', bars: false, base: 2.0, z: [1.28, 1.04], punch: true, trans: ['flash', 'glitch', 'whip', 'flash'], music: 'action', title: 'red', grain: 0.05, speed: true },
    { id: 'noir', name: 'נואר', desc: 'שחור-לבן, איטי ומסתורי, עם מעברי עדשה.',
      grade: 'bw', bars: true, base: 3.3, z: [1.0, 1.1], trans: ['iris', 'fade'], music: 'mystery', title: 'white', grain: 0.13 },
    { id: 'classic', name: 'קומיקס קלאסי', desc: 'חם ושמח, נקודות דפוס ותנועה רכה.',
      grade: 'warm', bars: false, base: 2.5, z: [1.02, 1.12], trans: ['slide', 'zoom', 'slide'], music: 'happy', title: 'comic', grain: 0.04, dots: true },
    { id: 'social', name: 'קליפ לרשתות', desc: 'מהיר וקצבי, חיתוכים על הביט.',
      grade: 'vivid', bars: false, base: 1.5, z: [1.2, 1.02], punch: true, trans: ['cut', 'flash', 'zoom', 'cut'], music: 'beat', title: 'comic', grain: 0.03 }
  ];
  var LOOK_BY_ID = {};
  LOOKS.forEach(function (l) { LOOK_BY_ID[l.id] = l; });

  var MUSIC = [
    { id: 'auto', name: 'לפי סגנון הסרט' },
    { id: 'epic', name: 'אפי' },
    { id: 'action', name: 'אקשן' },
    { id: 'mystery', name: 'מסתורי' },
    { id: 'happy', name: 'שמח' },
    { id: 'beat', name: 'ביט' },
    { id: 'none', name: 'בלי סאונד' }
  ];

  function canvasOf(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

  /* טשטוש זול: הקטנה חזקה והגדלה חלקה */
  function softCopy(src, w, h) {
    /* כיסוי מלא של המסגרת, מוקטן ומטושטש פעם אחת */
    var k = 96 / Math.max(w, h), sw = Math.max(2, Math.round(w * k)), sh = Math.max(2, Math.round(h * k));
    var s = canvasOf(sw, sh), sx = s.getContext('2d'), cs = Math.max(sw / src.width, sh / src.height);
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(src, (sw - src.width * cs) / 2, (sh - src.height * cs) / 2, src.width * cs, src.height * cs);
    var c = canvasOf(w, h), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    if ('filter' in x) x.filter = 'blur(' + Math.round(Math.max(w, h) / 70) + 'px)';
    x.drawImage(s, -w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
    x.filter = 'none';
    return c;
  }

  /* ---------- הכנה: מעמודים לחומרי גלם ---------- */

  /* renderArt(page, scale, itemFilter) -> Promise<canvas>: העמוד מצויר עם התמונות, בלי בועות.
     opts: { scale, fullMax }. מחזיר { pages: [{ panels: [...], full }], title } */
  function prepare(pages, renderArt, opts) {
    opts = opts || {};
    var S = opts.scale || 1.5, out = { pages: [], title: '' };
    return pages.reduce(function (p, pg, pi) {
      return p.then(function () {
        if (opts.onProgress) opts.onProgress(pi / pages.length);
        return renderArt(pg, S, function (it) { return it.type === 'photo'; }).then(function (art) {
          if (!out.title && pg.title && pg.title.show && pg.title.text) out.title = pg.title.text;
          var polys = PG.computePanels(pg), items = (pg.items || []).filter(function (it) { return it.type !== 'photo' && (it.text || '').trim(); });
          var panels = polys.map(function (poly, i) {
            var b = PG.bbox(poly), pn = pg.panels[i] || {};
            return { i: i, poly: poly, b: b, img: Boolean(pn.img), items: [] };
          });
          /* כל בועה שייכת לפאנל שבו נמצא המרכז שלה, ואם אין כזה, לקרוב ביותר */
          items.forEach(function (it) {
            var cx = it.x + it.w / 2, cy = it.y + it.h / 2, best = null, bd = 1e18;
            panels.forEach(function (pn) {
              if (PG.inPoly(pn.poly, cx, cy)) { best = pn; bd = -1; return; }
              if (bd < 0) return;
              var d = Math.hypot(pn.b.x + pn.b.w / 2 - cx, pn.b.y + pn.b.h / 2 - cy);
              if (d < bd) { bd = d; best = pn; }
            });
            if (best) best.items.push(it);
          });
          var shots = [];
          panels.forEach(function (pn) {
            if (!pn.img && !pn.items.length) return;
            var b = pn.b, c = canvasOf(b.w * S, b.h * S), x = c.getContext('2d');
            x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, c.width, c.height);
            x.save();
            x.scale(S, S); x.translate(-b.x, -b.y);
            x.beginPath();
            pn.poly.forEach(function (pt, k) { if (k) x.lineTo(pt[0], pt[1]); else x.moveTo(pt[0], pt[1]); });
            x.closePath();
            x.clip();
            x.setTransform(1, 0, 0, 1, 0, 0);
            x.drawImage(art, b.x * S, b.y * S, b.w * S, b.h * S, 0, 0, c.width, c.height);
            x.restore();
            /* סדר קריאה בעברית: מלמעלה למטה, מימין לשמאל */
            pn.items.sort(function (a, bb) { return Math.abs(a.y - bb.y) > a.h * 0.5 ? a.y - bb.y : bb.x - a.x; });
            var its = pn.items.map(function (it) { return itemCanvas(it, S, b); });
            shots.push({ art: c, soft: null, items: its, text: pn.items.map(function (it) { return it.text || ''; }).join(' '), loud: pn.items.some(function (it) { return it.type === 'shout' || it.type === 'sfx' || /!/.test(it.text || ''); }) });
          });
          /* העמוד המלא, עם הבועות, לתמונת סיכום */
          var fk = Math.min(1, (opts.fullMax || 1400) / Math.max(pg.w, pg.h));
          var full = canvasOf(pg.w * fk, pg.h * fk), fx = full.getContext('2d');
          fx.drawImage(art, 0, 0, full.width, full.height);
          fx.scale(fk, fk);
          items.forEach(function (it) { PG.drawItem(fx, it, null); });
          art.width = art.height = 1;
          out.pages.push({ shots: shots, full: full });
        });
      });
    }, Promise.resolve()).then(function () {
      if (opts.onProgress) opts.onProgress(1);
      return out;
    });
  }

  function itemCanvas(it, S, pb) {
    var pad = it.type === 'sfx' ? Math.max(it.w, it.h) * 0.35 : Math.max(it.w, it.h) * 0.08 + 8;
    var x0 = it.x - pad, y0 = it.y - pad, x1 = it.x + it.w + pad, y1 = it.y + it.h + pad;
    if (it.tx != null && (it.type === 'speech' || it.type === 'thought' || it.type === 'shout' || it.type === 'whisper')) {
      x0 = Math.min(x0, it.tx - pad); y0 = Math.min(y0, it.ty - pad); x1 = Math.max(x1, it.tx + pad); y1 = Math.max(y1, it.ty + pad);
    }
    var c = canvasOf((x1 - x0) * S, (y1 - y0) * S), x = c.getContext('2d');
    x.scale(S, S); x.translate(-x0, -y0);
    PG.drawItem(x, it, null);
    return {
      c: c, type: it.type,
      x: (x0 - pb.x) * S, y: (y0 - pb.y) * S, w: c.width, h: c.height,
      /* נקודת הקפיצה: מרכז הבועה */
      ox: (it.x + it.w / 2 - x0) * S, oy: (it.y + it.h / 2 - y0) * S,
      len: (it.text || '').length
    };
  }

  /* ---------- שכבות קבועות ---------- */
  function overlays(w, h, look) {
    var o = {};
    var v = canvasOf(w, h), vx = v.getContext('2d');
    var g = vx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, look.grade === 'bw' ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.55)');
    vx.fillStyle = g; vx.fillRect(0, 0, w, h);
    o.vignette = v;
    o.grain = [];
    for (var k = 0; k < 3; k++) {
      var n = canvasOf(256, 256), nx = n.getContext('2d'), im = nx.createImageData(256, 256), r = rng(k * 977 + 13);
      for (var i = 0; i < im.data.length; i += 4) { var val = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = val; im.data[i + 3] = 255; }
      nx.putImageData(im, 0, 0);
      o.grain.push(n);
    }
    if (look.leak) {
      var l = canvasOf(w, h), lx = l.getContext('2d');
      var lg = lx.createRadialGradient(w * 0.15, h * 0.3, 0, w * 0.15, h * 0.3, Math.max(w, h) * 0.7);
      lg.addColorStop(0, 'rgba(255,170,80,0.85)'); lg.addColorStop(0.4, 'rgba(255,90,40,0.35)'); lg.addColorStop(1, 'rgba(255,60,20,0)');
      lx.fillStyle = lg; lx.fillRect(0, 0, w, h);
      o.leak = l;
    }
    if (look.speed) {
      var s = canvasOf(w, h), sx = s.getContext('2d'), rr = rng(7), cx = w / 2, cy = h / 2, R = Math.hypot(w, h);
      sx.fillStyle = '#fff';
      for (var j = 0; j < 140; j++) {
        var a = rr() * Math.PI * 2, wd = 0.004 + rr() * 0.012, r0 = R * (0.28 + rr() * 0.12);
        sx.beginPath();
        sx.moveTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
        sx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        sx.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
        sx.fill();
      }
      o.speed = s;
    }
    if (look.dots) {
      var d = canvasOf(24, 24), dx = d.getContext('2d');
      dx.fillStyle = 'rgba(0,0,0,0.5)'; dx.beginPath(); dx.arc(12, 12, 3.2, 0, Math.PI * 2); dx.fill();
      o.dots = d;
    }
    return o;
  }

  /* ---------- טקסט פתיחה וסיום ---------- */
  function titleCanvas(text, w, look, small) {
    var size = w * (small ? 0.075 : 0.17), font = '700 ' + size + 'px Karantina, "Secular One", sans-serif';
    var m = canvasOf(10, 10).getContext('2d');
    m.font = font;
    var tw = m.measureText(text).width;
    if (tw > w * 0.86) { size *= w * 0.86 / tw; font = '700 ' + size + 'px Karantina, "Secular One", sans-serif'; m.font = font; tw = m.measureText(text).width; }
    var c = canvasOf(tw + size * 0.6, size * 1.5), x = c.getContext('2d');
    x.font = font; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
    var cx = c.width / 2, cy = c.height / 2;
    if (look.title === 'gold') {
      var g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
      g.addColorStop(0, '#fff6d8'); g.addColorStop(0.45, '#f5c86a'); g.addColorStop(0.55, '#c88a2e'); g.addColorStop(1, '#ffe9b0');
      x.shadowColor = 'rgba(255,170,60,0.55)'; x.shadowBlur = size * 0.25;
      x.fillStyle = g; x.fillText(text, cx, cy);
    } else if (look.title === 'red') {
      x.lineJoin = 'round'; x.lineWidth = size * 0.12; x.strokeStyle = '#000'; x.strokeText(text, cx, cy);
      x.fillStyle = '#ff2b2b'; x.fillText(text, cx, cy);
    } else if (look.title === 'comic') {
      x.lineJoin = 'round'; x.lineWidth = size * 0.16; x.strokeStyle = '#111'; x.strokeText(text, cx + size * 0.04, cy + size * 0.05);
      x.lineWidth = size * 0.1; x.strokeText(text, cx, cy);
      x.fillStyle = '#ffd400'; x.fillText(text, cx, cy);
    } else {
      x.shadowColor = 'rgba(255,255,255,0.35)'; x.shadowBlur = size * 0.2;
      x.fillStyle = '#f2f2f2'; x.fillText(text, cx, cy);
    }
    return c;
  }

  /* ---------- בניית הסרט ---------- */
  /* movie: מ-prepare. opts: { look, size:[w,h], pages: 'all'|number } */
  function build(movie, opts) {
    var look = LOOK_BY_ID[opts.look] || LOOKS[0];
    var W = opts.size[0], H = opts.size[1];
    var ov = overlays(W, H, look);
    var bufA = canvasOf(W, H), bufB = canvasOf(W, H), A = bufA.getContext('2d'), B = bufB.getContext('2d');
    var barH = look.bars ? Math.round(H * (W > H ? 0.1 : H / W > 1.5 ? 0.055 : 0.08)) : 0;
    var title = movie.title || 'הקומיקס שלי';
    var shots = [], t = 0, ti = 0, beats = [];
    function add(s, trans) {
      s.T = trans === 'cut' ? 0 : s.kind === 'title' ? 0 : trans === 'whip' || trans === 'slide' ? 0.5 : trans === 'iris' ? 0.9 : 0.6;
      s.trans = trans;
      s.start = Math.max(0, t - s.T);
      t = s.start + s.dur;
      shots.push(s);
      if (s.kind !== 'title') beats.push({ at: s.start, kind: trans });
    }
    var first = null;
    movie.pages.forEach(function (pg) { pg.shots.forEach(function (s) { if (!first) first = s; }); });
    add({ kind: 'title', dur: 3.0, bg: first ? first.art : null, text: titleCanvas(title, W, look, false), sub: titleCanvas('סרט קומיקס', W, look, true) }, 'cut');
    movie.pages.forEach(function (pg, pi) {
      pg.shots.forEach(function (s, si) {
        var pops = [], at = look.punch ? 0.25 : 0.45;
        s.items.forEach(function (it) { pops.push(at); at += Math.max(0.45, Math.min(1.6, it.len * 0.035)) + 0.25; });
        var dur = Math.max(look.base, at + 0.9);
        var dir = (ti % 4);
        add({ kind: 'panel', src: s, pops: pops, dur: dur, dir: dir, loud: s.loud }, look.trans[ti % look.trans.length]);
        pops.forEach(function (p) { beats.push({ at: shots[shots.length - 1].start + p, kind: 'pop' }); });
        ti++;
      });
      if (pg.shots.length > 1) add({ kind: 'page', src: pg.full, dur: 2.4, n: pi + 1 }, look.trans[(ti++) % look.trans.length] === 'cut' ? 'cut' : 'zoom');
    });
    add({ kind: 'end', dur: 3.0, text: titleCanvas('סוף', W, look, false), sub: titleCanvas(title, W, look, true) }, 'fade');
    var dur = t;

    function softOf(s) { if (!s.soft) s.soft = softCopy(s.art, W, H); return s.soft; }

    function drawPanel(x, sh, lt) {
      var s = sh.src, art = s.art, cw = art.width, ch = art.height;
      var p = clamp(lt / sh.dur), ar = cw / ch, fr = W / (H - barH * 2);
      var cover = Math.abs(Math.log(ar / fr)) < 0.32;
      var z0 = look.z[0], z1 = look.z[1];
      var zp = look.punch ? outCubic(clamp(lt / 0.7)) * 0.65 + p * 0.35 : inOut(p);
      var z = z0 + (z1 - z0) * zp;
      var base = cover ? Math.max(W / cw, (H - barH * 2) / ch) : Math.min(W / cw, (H - barH * 2) / ch) * 0.92;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      if (!cover) {
        /* רקע: אותו ציור מטושטש וכהה, בתנועה הפוכה */
        var bz = 1.15 + 0.08 * p, bs = softOf(s);
        x.save();
        x.globalAlpha = 0.85;
        x.translate(W / 2, H / 2); x.scale(bz, bz); x.translate(-W / 2, -H / 2);
        x.drawImage(bs, 0, 0);
        x.restore();
        x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, 0, W, H);
      }
      var sc = base * z, dw = cw * sc, dh = ch * sc;
      var mx = cover ? Math.max(0, (dw - W) / 2) : W * 0.02, my = cover ? Math.max(0, (dh - H) / 2) : H * 0.015;
      var dirs = [[1, 0.3], [-1, -0.2], [0.3, 1], [-0.4, -1]], d = dirs[sh.dir];
      var dx = d[0] * mx * (p - 0.5) * 1.6, dy = d[1] * my * (p - 0.5) * 1.6;
      /* רעידה כשבועה צועקת קופצת */
      if (look.punch || sh.loud) {
        sh.pops.forEach(function (pt) {
          var k = lt - pt;
          if (k > 0 && k < 0.22) { var a = (1 - k / 0.22) * W * 0.008; dx += Math.sin(lt * 90) * a; dy += Math.cos(lt * 70) * a; }
        });
      }
      x.save();
      x.translate(W / 2 + dx, H / 2 + dy);
      x.scale(sc, sc);
      x.translate(-cw / 2, -ch / 2);
      if (!cover) { x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 40 / sc; }
      x.drawImage(art, 0, 0);
      x.shadowBlur = 0;
      if (!cover) { x.lineWidth = 6 / sc; x.strokeStyle = '#0b0b0e'; x.strokeRect(0, 0, cw, ch); }
      s.items.forEach(function (it, k) {
        var u = clamp((lt - sh.pops[k]) / (it.type === 'caption' ? 0.4 : 0.32));
        if (u <= 0) return;
        x.save();
        x.globalAlpha = clamp(u * 2.2);
        if (it.type === 'caption') {
          x.translate(it.x, it.y - (1 - outCubic(u)) * it.h * 0.6);
          x.drawImage(it.c, 0, 0);
        } else {
          var q = outBack(u);
          x.translate(it.x + it.ox, it.y + it.oy); x.scale(q, q); x.translate(-it.ox, -it.oy);
          x.drawImage(it.c, 0, 0);
        }
        x.restore();
      });
      x.restore();
      if (ov.speed && sh.loud) {
        var su = lt < 0.6 ? 1 - lt / 0.6 : 0;
        if (su > 0) { x.save(); x.globalAlpha = su * 0.8; x.drawImage(ov.speed, 0, 0); x.restore(); }
      }
    }

    function drawCard(x, sh, lt, isTitle) {
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      var p = clamp(lt / sh.dur);
      if (isTitle && sh.bg) {
        var bs = sh.bgSoft || (sh.bgSoft = softCopy(sh.bg, W, H));
        x.save();
        x.globalAlpha = 0.55 * clamp(lt / 0.8);
        var bz = 1.25 - 0.12 * p;
        x.translate(W / 2, H / 2); x.scale(bz, bz); x.translate(-W / 2, -H / 2);
        x.drawImage(bs, 0, 0);
        x.restore();
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, W, H);
      }
      var tc = sh.text, sc2 = sh.sub;
      var a = clamp((lt - 0.35) / 0.7), zz = 1.18 - 0.18 * outCubic(a) + 0.04 * p;
      x.save();
      x.globalAlpha = a * (isTitle ? 1 : 1 - clamp((lt - sh.dur + 0.9) / 0.9));
      x.translate(W / 2, H * 0.47); x.scale(zz, zz);
      x.drawImage(tc, -tc.width / 2, -tc.height / 2);
      x.restore();
      /* פס אור שעובר על הכותרת */
      if (isTitle && look.title !== 'white') {
        var sw = clamp((lt - 1.0) / 0.9);
        if (sw > 0 && sw < 1) {
          x.save();
          x.globalCompositeOperation = 'lighter';
          var gx = W * (1.2 - sw * 1.4), g = x.createLinearGradient(gx - W * 0.12, 0, gx + W * 0.12, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.fillRect(0, H * 0.47 - tc.height * 0.6, W, tc.height * 1.2);
          x.restore();
        }
      }
      var b = clamp((lt - (isTitle ? 1.2 : 0.8)) / 0.6);
      x.save();
      x.globalAlpha = b * (isTitle ? 1 : 1 - clamp((lt - sh.dur + 0.9) / 0.9));
      x.drawImage(sc2, (W - sc2.width) / 2, H * 0.47 + tc.height * 0.55);
      x.restore();
    }

    function drawPage(x, sh, lt) {
      var c = sh.src, p = clamp(lt / sh.dur);
      x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, W, H);
      var s = Math.min(W / c.width, (H - barH * 2) / c.height) * (0.9 + 0.05 * inOut(p));
      x.save();
      x.translate(W / 2, H / 2); x.scale(s, s);
      x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 50 / s;
      x.drawImage(c, -c.width / 2, -c.height / 2);
      x.restore();
    }

    function drawShot(x, sh, lt) {
      if (sh.kind === 'panel') drawPanel(x, sh, lt);
      else if (sh.kind === 'page') drawPage(x, sh, lt);
      else drawCard(x, sh, lt, sh.kind === 'title');
    }

    function transition(ctx, prev, cur, u, lt) {
      var kind = cur.trans, e = inOut(u);
      drawShot(A, prev, prev.dur - cur.T + lt);
      drawShot(B, cur, lt);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (kind === 'whip' || kind === 'slide') {
        var off = e * W, blur = kind === 'whip' ? Math.sin(u * Math.PI) : 0;
        var draw = function (img, x0) {
          if (blur > 0.05) {
            for (var k = -2; k <= 2; k++) { ctx.globalAlpha = k ? 0.22 * blur : 1; ctx.drawImage(img, x0 + k * W * 0.035 * blur, 0); }
            ctx.globalAlpha = 1;
          } else ctx.drawImage(img, x0, 0);
        };
        draw(bufA, off); draw(bufB, off - W);
      } else if (kind === 'flash') {
        ctx.drawImage(u < 0.5 ? bufA : bufB, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,' + (1 - Math.abs(u - 0.5) * 2).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
        if (ov.leak) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.sin(u * Math.PI); ctx.drawImage(ov.leak, 0, 0); ctx.restore(); }
      } else if (kind === 'zoom') {
        ctx.save();
        ctx.globalAlpha = 1 - e;
        var z = 1 + e * 0.5;
        ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(bufA, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = e;
        var z2 = 0.85 + 0.15 * e;
        ctx.translate(W / 2, H / 2); ctx.scale(z2, z2); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(bufB, 0, 0);
        ctx.restore();
      } else if (kind === 'iris') {
        var R = Math.hypot(W, H) / 2, img = u < 0.5 ? bufA : bufB, r = u < 0.5 ? R * (1 - inOut(u * 2)) : R * inOut((u - 0.5) * 2);
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
      } else if (kind === 'glitch') {
        var src = u < 0.5 ? bufA : bufB, r2 = rng(Math.floor(u * 12) + 3), n = 14, hh = H / n, amp = Math.sin(u * Math.PI);
        for (var i = 0; i < n; i++) {
          var sx = (r2() - 0.5) * W * 0.18 * amp;
          ctx.drawImage(src, 0, i * hh, W, hh, sx, i * hh, W, hh);
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * amp;
        ctx.drawImage(src, W * 0.012 * amp, 0); ctx.restore();
      } else {
        /* fade דרך שחור */
        ctx.globalAlpha = clamp(1 - u * 2); ctx.drawImage(bufA, 0, 0);
        ctx.globalAlpha = clamp(u * 2 - 1); ctx.drawImage(bufB, 0, 0);
        ctx.globalAlpha = 1;
      }
    }

    function grade(x, time) {
      x.save();
      if (look.grade === 'bw') {
        x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'overlay'; x.fillStyle = 'rgba(40,40,40,0.25)'; x.fillRect(0, 0, W, H);
      } else if (look.grade === 'teal') {
        var g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(0,110,140,0.35)'); g.addColorStop(0.55, 'rgba(30,60,80,0.15)'); g.addColorStop(1, 'rgba(255,140,40,0.35)');
        x.globalCompositeOperation = 'soft-light'; x.fillStyle = g; x.fillRect(0, 0, W, H);
      } else if (look.grade === 'warm') {
        x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,180,90,0.35)'; x.fillRect(0, 0, W, H);
      } else if (look.grade === 'punch' || look.grade === 'vivid') {
        x.globalCompositeOperation = 'overlay'; x.fillStyle = look.grade === 'punch' ? 'rgba(20,10,30,0.3)' : 'rgba(255,60,140,0.12)'; x.fillRect(0, 0, W, H);
      }
      x.restore();
      if (ov.dots) {
        x.save(); x.globalAlpha = 0.12; x.fillStyle = x.createPattern(ov.dots, 'repeat'); x.fillRect(0, 0, W, H); x.restore();
      }
      x.drawImage(ov.vignette, 0, 0);
      if (look.grain) {
        var gi = Math.floor(time * 24) % 3, r = rng(Math.floor(time * 24) + 1);
        x.save();
        x.globalCompositeOperation = 'overlay'; x.globalAlpha = look.grain;
        x.translate(-r() * 256, -r() * 256);
        x.fillStyle = x.createPattern(ov.grain[gi], 'repeat');
        x.fillRect(0, 0, W + 256, H + 256);
        x.restore();
      }
      if (barH) {
        var bh = barH * (time < 1.2 ? outCubic(clamp(time / 1.2)) : 1);
        x.fillStyle = '#000'; x.fillRect(0, 0, W, bh); x.fillRect(0, H - bh, W, bh);
      }
    }

    return {
      w: W, h: H, dur: dur, shots: shots.length, look: look,
      draw: function (ctx, time) {
        var tt = time % dur, i = shots.length - 1;
        while (i > 0 && shots[i].start > tt) i--;
        var cur = shots[i], lt = tt - cur.start;
        if (i > 0 && cur.T > 0 && lt < cur.T) transition(ctx, shots[i - 1], cur, lt / cur.T, lt);
        else drawShot(ctx, cur, lt);
        grade(ctx, tt);
        /* כניסה מהשחור ויציאה לשחור */
        var fade = tt < 0.5 ? 1 - tt / 0.5 : tt > dur - 0.8 ? (tt - dur + 0.8) / 0.8 : 0;
        if (fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(fade).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      },
      sound: function (ac, outs, at) {
        var m = opts.music && opts.music !== 'auto' ? opts.music : look.music;
        if (m === 'none') return null;
        return score(ac, outs, at, dur, m, beats);
      }
    };
  }

  /* ---------- פסקול סינתטי ---------- */
  var SCORES = {
    epic: { bpm: 84, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pad: 'sawtooth', cut: 1100, drums: 'taiko', bass: true },
    action: { bpm: 128, chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 54, 57]], pad: 'square', cut: 1600, drums: 'rock', bass: true, arp: true },
    mystery: { bpm: 70, chords: [[50, 53, 57], [46, 50, 53], [48, 51, 55], [49, 52, 56]], pad: 'triangle', cut: 700, drums: 'pulse', bass: false, bell: true },
    happy: { bpm: 112, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], pad: 'triangle', cut: 2400, drums: 'light', bass: true, arp: true },
    beat: { bpm: 120, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], pad: 'sawtooth', cut: 1400, drums: 'four', bass: true }
  };

  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function score(ac, outs, t0, dur, name, beats) {
    var S = SCORES[name] || SCORES.epic;
    var master = ac.createGain(), comp = ac.createDynamicsCompressor();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.8, t0 + 1.2);
    master.gain.setValueAtTime(0.8, t0 + dur - 2);
    master.gain.linearRampToValueAtTime(0, t0 + dur);
    master.connect(comp);
    outs.forEach(function (o) { comp.connect(o); });
    var noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0), r = rng(99);
    for (var i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    var nodes = [];

    function env(g, at, a, peak, rel) {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + a);
      g.gain.exponentialRampToValueAtTime(0.0001, at + a + rel);
    }
    function osc(type, f, at, len, peak, dest, f2) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + len);
      env(g, at, Math.min(0.02, len / 4), peak, len);
      o.connect(g); g.connect(dest || master);
      o.start(at); o.stop(at + len + 0.1);
      nodes.push(o);
    }
    function hit(at, len, peak, type, freq, q) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = type || 'highpass'; f.frequency.value = freq || 6000; f.Q.value = q || 0.7;
      env(g, at, 0.003, peak, len);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(at); s.stop(at + len + 0.1);
      nodes.push(s);
    }
    function kick(at, deep) { osc('sine', deep ? 110 : 150, at, deep ? 0.7 : 0.35, deep ? 0.95 : 0.8, null, deep ? 32 : 45); }
    function snare(at) { hit(at, 0.18, 0.4, 'bandpass', 1800, 0.8); osc('triangle', 190, at, 0.08, 0.25); }
    function hat(at, v) { hit(at, 0.04, v || 0.12, 'highpass', 8000); }
    function whoosh(at) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(5000, at + 0.35);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      s.connect(f); f.connect(g); g.connect(master); s.start(at); s.stop(at + 0.6);
      nodes.push(s);
    }
    function pop(at) { osc('sine', 520, at, 0.09, 0.28, null, 1100); }
    function boom(at) { kick(at, true); hit(at, 1.2, 0.35, 'lowpass', 400); }

    /* מיטת מוזיקה: אקורדים, בס ותופים לפי תיבות */
    var beat = 60 / S.bpm, bar = beat * 4, padBus = ac.createBiquadFilter(), padGain = ac.createGain();
    padBus.type = 'lowpass'; padBus.frequency.value = S.cut; padGain.gain.value = 0.16;
    padBus.connect(padGain); padGain.connect(master);
    var start = t0 + 0.2, bars = Math.ceil((dur - 0.2) / bar);
    for (var b = 0; b < bars; b++) {
      var at = start + b * bar, ch = S.chords[b % S.chords.length];
      ch.forEach(function (n) {
        [-6, 6].forEach(function (det) {
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = S.pad; o.frequency.value = hz(n); o.detune.value = det;
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + bar * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + bar * 1.05);
          o.connect(g); g.connect(padBus); o.start(at); o.stop(at + bar * 1.1);
          nodes.push(o);
        });
      });
      if (S.bass) for (var q = 0; q < 4; q += (S.drums === 'four' || S.drums === 'rock' ? 1 : 2)) osc('triangle', hz(ch[0] - 24), at + q * beat, beat * 0.9, 0.35);
      if (S.arp) for (var a = 0; a < 8; a++) osc('square', hz(ch[a % 3] + 12), at + a * beat / 2, beat * 0.35, 0.05);
      if (S.bell && b % 2 === 0) osc('sine', hz(ch[2] + 24), at + beat * 2, 1.6, 0.08);
      for (var k = 0; k < 4; k++) {
        var bt = at + k * beat;
        if (bt > t0 + dur - 1) break;
        if (S.drums === 'taiko') { if (k === 0) kick(bt, true); if (k === 2) { kick(bt + beat / 2, true); hat(bt, 0.06); } }
        else if (S.drums === 'rock') { if (k % 2 === 0) kick(bt); else snare(bt); hat(bt); hat(bt + beat / 2, 0.07); }
        else if (S.drums === 'four') { kick(bt); if (k % 2) snare(bt); hat(bt + beat / 2, 0.1); }
        else if (S.drums === 'light') { if (k === 0) kick(bt); if (k === 2) snare(bt); hat(bt, 0.06); }
        else if (S.drums === 'pulse') { if (k === 0) osc('sine', 55, bt, 0.9, 0.4); }
      }
    }
    /* אפקטים לפי האירועים בסרט */
    boom(t0 + 0.4);
    beats.forEach(function (e) {
      var at2 = t0 + e.at;
      if (e.kind === 'pop') pop(at2);
      else if (e.kind === 'whip' || e.kind === 'slide' || e.kind === 'zoom') whoosh(at2);
      else if (e.kind === 'flash' || e.kind === 'glitch') { hit(at2, 0.3, 0.3, 'highpass', 3000); kick(at2); }
      else if (e.kind === 'iris' || e.kind === 'fade') whoosh(at2);
    });
    return {
      stop: function () {
        try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(0, ac.currentTime); } catch (e) { /* כבר נעצר */ }
        nodes.forEach(function (n) { try { n.stop(); } catch (e) { /* כבר נעצר */ } });
        try { comp.disconnect(); } catch (e) { /* כבר נותק */ }
      }
    };
  }

  window.ComicCinema = { LOOKS: LOOKS, MUSIC: MUSIC, prepare: prepare, build: build };
})();
