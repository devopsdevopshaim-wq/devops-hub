/* עמוד הקומיקס: תבניות חלוקה לפאנלים, ציור העמוד, בועות דיבור ועריכה בגרירה. */
(function () {
  'use strict';

  /* ---------- תבניות ----------
     H(at, tilt, a, b): חיתוך אופקי. a למעלה.  V(at, tilt, a, b): חיתוך אנכי. a מימין (קוראים מימין לשמאל).
     at הוא המיקום היחסי של הקו, tilt הטיה לחיתוך אלכסוני. 0 = פאנל. */
  function H(at, tilt, a, b) { return { d: 'h', at: at, tilt: tilt, a: a, b: b }; }
  function V(at, tilt, a, b) { return { d: 'v', at: at, tilt: tilt, a: a, b: b }; }
  var o = 0;

  var LAYOUTS = [
    { id: 'one', name: 'פאנל אחד', tree: o },
    { id: 'two-rows', name: 'שתי שורות', tree: H(0.5, 0, o, o) },
    { id: 'two-cols', name: 'שני טורים', tree: V(0.5, 0, o, o) },
    { id: 'slash', name: 'חיתוך אלכסוני', tree: V(0.5, 0.28, o, o) },
    { id: 'three-rows', name: 'שלוש שורות', tree: H(1 / 3, 0, o, H(0.5, 0, o, o)) },
    { id: 'hero-top', name: 'גדול למעלה', tree: H(0.58, 0, o, V(0.5, 0, o, o)) },
    { id: 'hero-bottom', name: 'גדול למטה', tree: H(0.42, 0, V(0.5, 0, o, o), o) },
    { id: 'diag-3', name: 'שלושה באלכסון', tree: H(0.46, 0.14, o, V(0.52, 0.16, o, o)) },
    { id: 'grid-4', name: 'ארבעה', tree: H(0.5, 0, V(0.5, 0, o, o), V(0.5, 0, o, o)) },
    { id: 'side-stack', name: 'צד ועמודה', tree: V(0.6, 0, o, H(1 / 3, 0, o, H(0.5, 0, o, o))) },
    { id: 'story-6', name: 'עלילה בשישה', tree: H(0.5, 0, V(0.5, 0, o, o), V(1 / 3, 0, o, V(0.5, 0, o, H(0.5, 0.18, o, o)))) },
    { id: 'manga-5', name: 'מנגה', tree: H(0.32, 0, V(0.62, 0.1, o, o), H(0.55, -0.08, V(0.42, 0, o, o), o)) },
    { id: 'stairs', name: 'מדרגות', tree: H(0.34, 0.1, V(0.5, 0.12, o, o), H(0.5, 0.1, o, V(0.5, -0.12, o, o))) },
    { id: 'grid-6', name: 'שישה', tree: H(1 / 3, 0, V(0.5, 0, o, o), H(0.5, 0, V(0.5, 0, o, o), V(0.5, 0, o, o))) },
    { id: 'cinema', name: 'קולנוע', tree: H(0.25, 0, o, H(1 / 3, 0, o, H(0.5, 0, o, o))) },
    { id: 'strip-3', name: 'סטריפ שלושה', tree: V(1 / 3, 0, o, V(0.5, 0, o, o)) },
    { id: 'strip-4', name: 'סטריפ ארבעה', tree: V(0.25, 0, o, V(1 / 3, 0, o, V(0.5, 0, o, o))) },
    { id: 'grid-9', name: 'תשעה', tree: H(1 / 3, 0, V(1 / 3, 0, o, V(0.5, 0, o, o)), H(0.5, 0, V(1 / 3, 0, o, V(0.5, 0, o, o)), V(1 / 3, 0, o, V(0.5, 0, o, o)))) }
  ];
  var LAYOUT_BY_ID = {};
  LAYOUTS.forEach(function (l) { l.count = countLeaves(l.tree); LAYOUT_BY_ID[l.id] = l; });

  function countLeaves(t) { return t ? countLeaves(t.a) + countLeaves(t.b) : 1; }

  var FORMATS = {
    a4: { name: 'עמוד A4', w: 1240, h: 1754 },
    square: { name: 'ריבוע לאינסטגרם', w: 1500, h: 1500 },
    story: { name: 'סטורי 9:16', w: 1080, h: 1920 },
    landscape: { name: 'לרוחב', w: 1754, h: 1240 },
    strip: { name: 'סטריפ עיתון', w: 2100, h: 760 }
  };

  /* ---------- גאומטריה ---------- */

  function clipHalf(poly, nx, ny, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c;
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        var t = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  }

  function bbox(poly) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    poly.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function split(poly, t, g, out) {
    if (!t) { if (poly.length >= 3) out.push(poly); return; }
    var b = bbox(poly), p0, p1;
    if (t.d === 'h') {
      p0 = [b.x, b.y + (t.at - t.tilt / 2) * b.h];
      p1 = [b.x + b.w, b.y + (t.at + t.tilt / 2) * b.h];
    } else {
      p0 = [b.x + b.w - (t.at + t.tilt / 2) * b.w, b.y];
      p1 = [b.x + b.w - (t.at - t.tilt / 2) * b.w, b.y + b.h];
    }
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
    var nx = -dy / len, ny = dx / len, c = nx * p0[0] + ny * p0[1];
    /* בחיתוך אופקי הנורמל פונה למטה; באנכי הוא פונה שמאלה. החלק הראשון הוא הצד השני */
    split(clipHalf(poly, -nx, -ny, -c + g / 2), t.a, g, out);
    split(clipHalf(poly, nx, ny, c + g / 2), t.b, g, out);
  }

  function titleHeight(page) {
    return page.title && page.title.show ? Math.round(Math.min(page.w, page.h * 1.2) * 0.075 * (page.title.size || 1)) : 0;
  }

  function computePanels(page) {
    var m = page.margin, th = titleHeight(page);
    var top = m + (th ? th + m * 0.4 : 0);
    var rect = [[m, top], [page.w - m, top], [page.w - m, page.h - m], [m, page.h - m]];
    var out = [];
    split(rect, (LAYOUT_BY_ID[page.layout] || LAYOUTS[0]).tree, page.gutter, out);
    return out;
  }

  function pathPoly(ctx, poly) {
    ctx.beginPath();
    poly.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
  }

  function inPoly(poly, x, y) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  /* ---------- טקסט ---------- */

  var FONTS = [
    { id: 'Playpen Sans Hebrew', name: 'כתב יד קומיקס' },
    { id: 'Karantina', name: 'כרזה צרה' },
    { id: 'Secular One', name: 'מודגש עגול' },
    { id: 'Suez One', name: 'סריף עבה' },
    { id: 'Rubik', name: 'נקי' },
    { id: 'Amatic SC', name: 'גיר דק' },
    { id: 'Varela Round', name: 'רך' },
    { id: 'Frank Ruhl Libre', name: 'ספרותי' }
  ];

  function fontStr(it, size) {
    var weight = it.font === 'Rubik' || it.font === 'Playpen Sans Hebrew' || it.font === 'Frank Ruhl Libre' ? 700 : 400;
    if (it.font === 'Amatic SC') weight = 700;
    return weight + ' ' + Math.round(size) + 'px "' + it.font + '", "Rubik", sans-serif';
  }

  function wrap(ctx, text, maxW) {
    var lines = [];
    String(text || '').split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { lines.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
      });
      lines.push(line);
    });
    return lines;
  }

  function drawText(ctx, it, box) {
    if (!it.text) return;
    var size = it.size, lines, lh;
    for (var k = 0; k < 30; k++) {
      ctx.font = fontStr(it, size);
      lines = wrap(ctx, it.text, box.w);
      lh = size * 1.18;
      var wide = lines.some(function (l) { return ctx.measureText(l).width > box.w * 1.02; });
      if (lines.length * lh <= box.h && !wide) break;
      size *= 0.92;
    }
    ctx.fillStyle = it.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    var y = box.y + box.h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, box.x + box.w / 2, y + i * lh); });
  }

  /* ---------- בועות ---------- */

  var ITEM_TYPES = {
    speech: { name: 'דיבור', fill: '#ffffff', color: '#111114', font: 'Secular One', text: 'מה קורה כאן?!' },
    thought: { name: 'מחשבה', fill: '#ffffff', color: '#111114', font: 'Secular One', text: 'רגע... יש לי רעיון' },
    shout: { name: 'צעקה', fill: '#fff14d', color: '#111114', font: 'Secular One', text: 'עכשיו!' },
    whisper: { name: 'לחישה', fill: '#ffffff', color: '#3a3a46', font: 'Rubik', text: 'ששש... אל תספר' },
    caption: { name: 'כיתוב', fill: '#ffe9a8', color: '#111114', font: 'Rubik', text: 'בינתיים, בצד השני של העיר...' },
    sfx: { name: 'אפקט קול', fill: '#ffd60a', color: '#ffd60a', font: 'Karantina', text: 'בּוּם!' },
    photo: { name: 'תמונה צפה', fill: '#ffffff', color: '#111114', font: 'Rubik', text: '' }
  };

  function ellipse(path, cx, cy, rx, ry) { path.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); }

  function tailPath(it, cx, cy, rx, ry, spread) {
    var dx = it.tx - cx, dy = it.ty - cy;
    var inside = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1.05;
    if (inside) return null;
    var a = Math.atan2(dy / ry, dx / rx), s = spread || 0.26;
    var p = new Path2D();
    var b1 = [cx + Math.cos(a - s) * rx * 0.9, cy + Math.sin(a - s) * ry * 0.9];
    var b2 = [cx + Math.cos(a + s) * rx * 0.9, cy + Math.sin(a + s) * ry * 0.9];
    var mx = (b1[0] + b2[0]) / 2, my = (b1[1] + b2[1]) / 2;
    p.moveTo(b1[0], b1[1]);
    p.quadraticCurveTo(mx + (it.tx - mx) * 0.45 + (b1[0] - mx) * 0.2, my + (it.ty - my) * 0.45 + (b1[1] - my) * 0.2, it.tx, it.ty);
    p.quadraticCurveTo(mx + (it.tx - mx) * 0.4, my + (it.ty - my) * 0.4, b2[0], b2[1]);
    p.closePath();
    return p;
  }

  function outlineFill(ctx, paths, it, lw, dash) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = it.stroke || '#111114';
    ctx.lineWidth = lw * 2;
    if (dash) ctx.setLineDash([lw * 3, lw * 2.2]);
    paths.forEach(function (p) { ctx.stroke(p); });
    ctx.setLineDash([]);
    ctx.fillStyle = it.fill;
    paths.forEach(function (p) { ctx.fill(p); });
    ctx.restore();
  }

  function drawBubble(ctx, it) {
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2, rx = it.w / 2, ry = it.h / 2;
    var lw = Math.max(2, Math.min(it.w, it.h) * 0.022) * (it.line || 1);
    var paths = [], body = new Path2D(), tail;
    if (it.type === 'speech' || it.type === 'whisper') {
      ellipse(body, cx, cy, rx, ry);
      paths.push(body);
      tail = tailPath(it, cx, cy, rx, ry);
      if (tail) paths.push(tail);
      outlineFill(ctx, paths, it, lw, it.type === 'whisper');
      drawText(ctx, it, { x: cx - rx * 0.72, y: cy - ry * 0.66, w: rx * 1.44, h: ry * 1.32 });
    } else if (it.type === 'thought') {
      var n = 13, br = Math.min(rx, ry) * 0.36;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2;
        var c = new Path2D();
        ellipse(c, cx + Math.cos(a) * (rx - br * 0.75), cy + Math.sin(a) * (ry - br * 0.75), br * (1 + 0.18 * Math.sin(i * 2.3)), br * 0.9);
        paths.push(c);
      }
      var core = new Path2D();
      ellipse(core, cx, cy, rx - br * 0.7, ry - br * 0.7);
      paths.push(core);
      var dx = it.tx - cx, dy = it.ty - cy;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1.1) {
        var ang = Math.atan2(dy / ry, dx / rx), ex = cx + Math.cos(ang) * rx, ey = cy + Math.sin(ang) * ry;
        [0.25, 0.58, 0.9].forEach(function (t, k) {
          var d = new Path2D();
          var r = br * (0.62 - k * 0.17);
          ellipse(d, ex + (it.tx - ex) * t, ey + (it.ty - ey) * t, r, r * 0.85);
          paths.push(d);
        });
      }
      outlineFill(ctx, paths, it, lw);
      drawText(ctx, it, { x: cx - rx * 0.66, y: cy - ry * 0.58, w: rx * 1.32, h: ry * 1.16 });
    } else if (it.type === 'shout') {
      var N = 14, sp = new Path2D(), seed = 3;
      for (var k = 0; k < N * 2; k++) {
        var aa = k / (N * 2) * Math.PI * 2 - Math.PI / 2;
        seed = (seed * 9301 + 49297) % 233280;
        var rr = k % 2 ? 0.78 + (seed / 233280) * 0.06 : 1.02 + (seed / 233280) * 0.16;
        var px = cx + Math.cos(aa) * rx * rr, py = cy + Math.sin(aa) * ry * rr;
        if (k) sp.lineTo(px, py); else sp.moveTo(px, py);
      }
      sp.closePath();
      paths.push(sp);
      tail = tailPath(it, cx, cy, rx * 0.85, ry * 0.85, 0.16);
      if (tail) paths.push(tail);
      ctx.save();
      ctx.lineJoin = 'miter';
      outlineFill(ctx, paths, it, lw * 1.2);
      ctx.restore();
      drawText(ctx, it, { x: cx - rx * 0.6, y: cy - ry * 0.52, w: rx * 1.2, h: ry * 1.04 });
    } else if (it.type === 'caption') {
      ctx.save();
      ctx.fillStyle = it.fill;
      ctx.strokeStyle = it.stroke || '#111114';
      ctx.lineWidth = lw;
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.strokeRect(it.x, it.y, it.w, it.h);
      ctx.restore();
      var pad = Math.min(it.w, it.h) * 0.14;
      drawText(ctx, it, { x: it.x + pad, y: it.y + pad * 0.7, w: it.w - pad * 2, h: it.h - pad * 1.4 });
    }
  }

  function drawSfx(ctx, it) {
    var text = it.text || '';
    if (!text) return;
    ctx.save();
    ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
    ctx.rotate((it.rot || 0) * Math.PI / 180);
    var size = it.h * 0.9;
    ctx.font = fontStr(it, size);
    var tw = ctx.measureText(text).width;
    if (tw > it.w) { size *= it.w / tw; ctx.font = fontStr(it, size); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.lineJoin = 'round';
    var depth = Math.max(3, size * 0.07);
    ctx.fillStyle = it.stroke || '#111114';
    for (var d = depth; d > 0; d -= 1.5) ctx.fillText(text, -d * 0.6, d);
    ctx.lineWidth = Math.max(4, size * 0.09);
    ctx.strokeStyle = it.stroke || '#111114';
    ctx.strokeText(text, 0, 0);
    var g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, it.fill);
    g.addColorStop(1, it.fill2 || '#ff3d2e');
    ctx.fillStyle = g;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function coverDraw(ctx, img, b, zoom, ox, oy) {
    var iw = img.width, ih = img.height;
    var s = Math.max(b.w / iw, b.h / ih) * (zoom || 1);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, b.x + (b.w - dw) / 2 + (ox || 0) * b.w, b.y + (b.h - dh) / 2 + (oy || 0) * b.h, dw, dh);
  }

  function drawPhotoItem(ctx, it, src) {
    var b = { x: it.x, y: it.y, w: it.w, h: it.h };
    var lw = Math.max(3, Math.min(it.w, it.h) * 0.03);
    var path = new Path2D();
    if (it.shape === 'circle') ellipse(path, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2);
    else path.rect(b.x, b.y, b.w, b.h);
    ctx.save();
    ctx.fillStyle = it.fill || '#fff';
    ctx.fill(path);
    ctx.clip(path);
    if (src) coverDraw(ctx, src, b, it.zoom, it.ox, it.oy);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = it.stroke || '#111114';
    ctx.stroke(path);
    ctx.restore();
  }

  /* ---------- ציור עמוד ---------- */

  /* opts: { editing, getImage(ref, max) -> canvas|null, sel, maxImg } */
  function drawPage(ctx, page, opts) {
    opts = opts || {};
    var W = page.w, Hh = page.h;
    ctx.save();
    ctx.fillStyle = page.bg || '#fff';
    ctx.fillRect(0, 0, W, Hh);

    var th = titleHeight(page);
    if (th) {
      var t = page.title;
      ctx.save();
      var size = th * 0.9;
      ctx.font = fontStr({ font: t.font || 'Karantina' }, size);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var maxW = W - page.margin * 2, tw = ctx.measureText(t.text || '').width;
      if (tw > maxW) { size *= maxW / tw; ctx.font = fontStr({ font: t.font || 'Karantina' }, size); }
      ctx.fillStyle = t.color || '#111';
      ctx.fillText(t.text || '', W / 2, page.margin + th / 2);
      ctx.restore();
    }

    var polys = computePanels(page);
    polys.forEach(function (poly, i) {
      var pn = page.panels[i] || {};
      var b = bbox(poly);
      ctx.save();
      pathPoly(ctx, poly);
      ctx.fillStyle = pn.bg || '#ffffff';
      ctx.fill();
      ctx.clip();
      if (pn.img) {
        var src = opts.getImage && opts.getImage(pn, opts.maxImg || 1200);
        if (src) coverDraw(ctx, src, b, pn.zoom, pn.ox, pn.oy);
        else if (opts.editing) busy(ctx, b);
      } else if (opts.editing) {
        empty(ctx, b, i + 1);
      }
      ctx.restore();
    });
    if (page.border > 0) {
      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.lineWidth = page.border;
      ctx.strokeStyle = page.borderColor || '#111';
      polys.forEach(function (poly) { pathPoly(ctx, poly); ctx.stroke(); });
      ctx.restore();
    }

    (page.items || []).forEach(function (it) {
      if (it.type === 'sfx') drawSfx(ctx, it);
      else if (it.type === 'photo') drawPhotoItem(ctx, it, it.img && opts.getImage ? opts.getImage(it, 900) : null);
      else drawBubble(ctx, it);
    });

    if (opts.editing && opts.sel) drawSelection(ctx, page, polys, opts.sel);
    ctx.restore();
    return polys;
  }

  function empty(ctx, b, n) {
    ctx.save();
    ctx.fillStyle = '#eef1f4';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    var s = Math.min(b.w, b.h);
    ctx.fillStyle = '#9aa3ad';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.font = '400 ' + Math.round(s * 0.28) + 'px "Karantina", sans-serif';
    ctx.fillText(String(n), b.x + b.w / 2, b.y + b.h / 2 - s * 0.06);
    ctx.font = '500 ' + Math.max(14, Math.round(s * 0.05)) + 'px "IBM Plex Sans Hebrew", sans-serif';
    ctx.fillText('גררו לכאן תמונה', b.x + b.w / 2, b.y + b.h / 2 + s * 0.14);
    ctx.restore();
  }

  function busy(ctx, b) {
    ctx.save();
    ctx.fillStyle = '#e4e8ec';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#6b7480';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.font = '500 ' + Math.max(16, Math.round(Math.min(b.w, b.h) * 0.06)) + 'px "IBM Plex Sans Hebrew", sans-serif';
    ctx.fillText('מצייר…', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  var SEL = '#00a3e0', TAIL = '#e5007e';

  function handlePos(it) { return [it.x + it.w, it.y + it.h]; }

  function drawSelection(ctx, page, polys, sel) {
    var hs = page.w * 0.011;
    ctx.save();
    if (sel.kind === 'panel' && polys[sel.idx]) {
      ctx.lineWidth = Math.max(4, page.w * 0.004);
      ctx.strokeStyle = SEL;
      ctx.setLineDash([page.w * 0.012, page.w * 0.008]);
      pathPoly(ctx, polys[sel.idx]);
      ctx.stroke();
    } else if (sel.kind === 'item') {
      var it = page.items[sel.idx];
      if (!it) { ctx.restore(); return; }
      ctx.lineWidth = Math.max(2, page.w * 0.0022);
      ctx.strokeStyle = SEL;
      ctx.setLineDash([page.w * 0.008, page.w * 0.006]);
      ctx.strokeRect(it.x, it.y, it.w, it.h);
      ctx.setLineDash([]);
      var h = handlePos(it);
      ctx.fillStyle = '#fff';
      ctx.fillRect(h[0] - hs, h[1] - hs, hs * 2, hs * 2);
      ctx.strokeRect(h[0] - hs, h[1] - hs, hs * 2, hs * 2);
      if (hasTail(it)) {
        ctx.beginPath();
        ctx.arc(it.tx, it.ty, hs * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = TAIL;
        ctx.fill();
        ctx.lineWidth = Math.max(2, hs * 0.3);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function hasTail(it) { return it.type === 'speech' || it.type === 'thought' || it.type === 'shout' || it.type === 'whisper'; }

  /* ---------- עורך ---------- */

  function Editor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.page = null;
    this.sel = null;
    this.polys = [];
    this.drag = null;
    this._raf = 0;
    this._bind();
  }

  Editor.prototype.setPage = function (page) {
    this.page = page;
    this.sel = null;
    this.canvas.width = page.w;
    this.canvas.height = page.h;
    this.hooks.onSelect && this.hooks.onSelect(null);
    this.draw();
  };

  Editor.prototype.draw = function () {
    var self = this;
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      if (!self.page) return;
      if (self.canvas.width !== self.page.w || self.canvas.height !== self.page.h) {
        self.canvas.width = self.page.w; self.canvas.height = self.page.h;
      }
      self.polys = drawPage(self.ctx, self.page, { editing: true, sel: self.sel, getImage: self.hooks.getImage });
    });
  };

  Editor.prototype.select = function (sel) {
    this.sel = sel;
    this.hooks.onSelect && this.hooks.onSelect(sel);
    this.draw();
  };

  Editor.prototype.toPage = function (e) {
    var r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * this.page.w / r.width, (e.clientY - r.top) * this.page.h / r.height];
  };

  Editor.prototype.hitItem = function (x, y) {
    var items = this.page.items || [];
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return i;
    }
    return -1;
  };

  Editor.prototype.hitPanel = function (x, y) {
    for (var i = 0; i < this.polys.length; i++) if (inPoly(this.polys[i], x, y)) return i;
    return -1;
  };

  Editor.prototype._bind = function () {
    var self = this, c = this.canvas;
    c.addEventListener('pointerdown', function (e) {
      if (!self.page) return;
      var p = self.toPage(e), hs = self.page.w * 0.02;
      c.setPointerCapture(e.pointerId);
      var cur = self.sel && self.sel.kind === 'item' ? self.page.items[self.sel.idx] : null;
      if (cur) {
        var h = handlePos(cur);
        if (Math.abs(p[0] - h[0]) < hs && Math.abs(p[1] - h[1]) < hs) { self.drag = { mode: 'resize', it: cur, p: p, w: cur.w, h: cur.h, tx: cur.tx - cur.x, ty: cur.ty - cur.y }; return; }
        if (hasTail(cur) && Math.hypot(p[0] - cur.tx, p[1] - cur.ty) < hs) { self.drag = { mode: 'tail', it: cur }; return; }
      }
      var ii = self.hitItem(p[0], p[1]);
      if (ii >= 0) {
        var it = self.page.items[ii];
        self.select({ kind: 'item', idx: ii });
        self.drag = { mode: 'move', it: it, p: p, x: it.x, y: it.y, tx: it.tx, ty: it.ty };
        return;
      }
      var pi = self.hitPanel(p[0], p[1]);
      if (pi >= 0) {
        self.select({ kind: 'panel', idx: pi });
        var pn = self.page.panels[pi];
        if (pn && pn.img) {
          var b = bbox(self.polys[pi]);
          self.drag = { mode: 'pan', pn: pn, p: p, ox: pn.ox || 0, oy: pn.oy || 0, b: b };
        }
        return;
      }
      self.select(null);
    });
    c.addEventListener('pointermove', function (e) {
      var d = self.drag;
      if (!d) return;
      var p = self.toPage(e);
      if (d.mode === 'move') {
        d.it.x = d.x + p[0] - d.p[0]; d.it.y = d.y + p[1] - d.p[1];
        if (d.tx !== undefined) { d.it.tx = d.tx + p[0] - d.p[0]; d.it.ty = d.ty + p[1] - d.p[1]; }
      } else if (d.mode === 'resize') {
        d.it.w = Math.max(60, d.w + p[0] - d.p[0]);
        d.it.h = Math.max(40, d.h + p[1] - d.p[1]);
        if (d.it.keep) d.it.h = d.it.w * d.h / d.w;
      } else if (d.mode === 'tail') {
        d.it.tx = p[0]; d.it.ty = p[1];
      } else if (d.mode === 'pan') {
        d.pn.ox = d.ox + (p[0] - d.p[0]) / d.b.w;
        d.pn.oy = d.oy + (p[1] - d.p[1]) / d.b.h;
      }
      self.draw();
    });
    function end() {
      if (self.drag) { self.drag = null; self.hooks.onChange && self.hooks.onChange(); }
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', function (e) {
      var p = self.toPage(e), ii = self.hitItem(p[0], p[1]);
      if (ii >= 0) self.hooks.onEditText && self.hooks.onEditText(ii);
    });
    c.addEventListener('wheel', function (e) {
      if (!self.page) return;
      var p = self.toPage(e), pi = self.hitPanel(p[0], p[1]);
      var pn = pi >= 0 ? self.page.panels[pi] : null;
      if (!pn || !pn.img || self.hitItem(p[0], p[1]) >= 0) return;
      e.preventDefault();
      pn.zoom = Math.min(5, Math.max(1, (pn.zoom || 1) * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      if (!self.sel || self.sel.kind !== 'panel' || self.sel.idx !== pi) self.select({ kind: 'panel', idx: pi });
      else { self.hooks.onSelect && self.hooks.onSelect(self.sel); self.draw(); }
      clearTimeout(self._wt);
      self._wt = setTimeout(function () { self.hooks.onChange && self.hooks.onChange(); }, 300);
    }, { passive: false });
    c.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    c.addEventListener('drop', function (e) {
      e.preventDefault();
      var id = e.dataTransfer.getData('text/comic-image');
      var p = self.toPage(e);
      if (id && self.hooks.onDropImage) self.hooks.onDropImage(id, self.hitPanel(p[0], p[1]), p);
      else if (e.dataTransfer.files && e.dataTransfer.files.length && self.hooks.onDropFiles) self.hooks.onDropFiles(e.dataTransfer.files, self.hitPanel(p[0], p[1]));
    });
  };

  function newItem(type, page) {
    var d = ITEM_TYPES[type];
    var w = page.w * (type === 'caption' ? 0.42 : type === 'sfx' ? 0.5 : type === 'photo' ? 0.26 : 0.32);
    var h = type === 'caption' ? w * 0.26 : type === 'sfx' ? w * 0.5 : type === 'photo' ? w : w * 0.58;
    var x = (page.w - w) / 2 + (Math.random() - 0.5) * page.w * 0.1, y = page.h * 0.3 + (Math.random() - 0.5) * page.h * 0.1;
    return {
      id: 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: type, x: x, y: y, w: w, h: h,
      tx: x + w * 0.25, ty: y + h * 1.45,
      text: d.text, font: d.font, size: Math.round(page.w * (type === 'caption' ? 0.024 : 0.034)),
      color: d.color, fill: d.fill, fill2: '#ff3d2e', stroke: '#111114', rot: type === 'sfx' ? -8 : 0,
      shape: 'circle', style: 'nn-portrait', params: {}, zoom: 1, ox: 0, oy: 0, keep: type === 'photo'
    };
  }

  function newPage(format, layout) {
    var f = FORMATS[format] || FORMATS.a4;
    var L = LAYOUT_BY_ID[layout] || LAYOUTS[0];
    var panels = [];
    for (var i = 0; i < L.count; i++) panels.push(newPanel());
    return {
      id: 'pg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      format: format, w: f.w, h: f.h, layout: L.id,
      gutter: Math.round(f.w * 0.016), margin: Math.round(f.w * 0.035), border: Math.max(4, Math.round(f.w * 0.0045)),
      borderColor: '#111114', bg: '#ffffff',
      title: { show: true, text: 'ההרפתקאות שלי', font: 'Karantina', color: '#111114', size: 1 },
      panels: panels, items: []
    };
  }

  function newPanel() { return { img: null, style: 'nn-comic', params: {}, zoom: 1, ox: 0, oy: 0, bg: '#ffffff' }; }

  function setLayout(page, layoutId) {
    var L = LAYOUT_BY_ID[layoutId];
    if (!L) return;
    page.layout = L.id;
    while (page.panels.length < L.count) page.panels.push(newPanel());
  }

  function setFormat(page, format) {
    var f = FORMATS[format];
    if (!f) return;
    var kx = f.w / page.w, ky = f.h / page.h;
    (page.items || []).forEach(function (it) {
      it.x *= kx; it.y *= ky; it.w *= kx; it.h *= kx; it.tx *= kx; it.ty *= ky; it.size *= kx;
    });
    page.gutter = Math.round(page.gutter * kx);
    page.margin = Math.round(page.margin * kx);
    page.border = Math.max(2, Math.round(page.border * kx));
    page.format = format; page.w = f.w; page.h = f.h;
  }

  /* ציור תבנית קטנה לבחירה */
  function layoutThumb(layoutId, w, h) {
    var c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    var x = c.getContext('2d');
    var pg = { w: c.width, h: c.height, margin: 4, gutter: 6, layout: layoutId, title: { show: false } };
    var polys = computePanels(pg);
    x.fillStyle = '#111114';
    polys.forEach(function (p) { pathPoly(x, p); x.fill(); });
    return c;
  }

  window.ComicPage = {
    LAYOUTS: LAYOUTS, layoutById: LAYOUT_BY_ID, FORMATS: FORMATS, FONTS: FONTS, ITEM_TYPES: ITEM_TYPES,
    drawPage: drawPage, computePanels: computePanels, bbox: bbox, Editor: Editor,
    newPage: newPage, newItem: newItem, newPanel: newPanel, setLayout: setLayout, setFormat: setFormat, layoutThumb: layoutThumb
  };
})();
