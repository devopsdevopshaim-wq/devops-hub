/* 🧩 Puzzles and cubes from the event's photos, ready to print on magnet sheet or photo paper and cut:
   - a jigsaw puzzle from one photo: 6 to 108 pieces, classic or straight pieces, cut lines (white, dark, gold or none),
     a gentle 3D look, a "lifted piece" for display, and an optional cutting template page;
   - a photo cube: 6 photos on a cube net (cut lines solid, fold lines dashed, glue tabs);
   - a picture-block puzzle: 3×3 or 4×3 small cubes; every photo is split over the cubes, one face each, oriented so that
     rolling every cube the same way shows the next photo.
   Every page is made at 300 dpi at the paper's true size and joins the project as a page, so it prints like any photo. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var DPI = 300, MM = DPI / 25.4;
  var PAPERS = [['A4', 'A4', 210, 297], ['20x30', '20×30', 200, 300], ['15x20', '15×20', 150, 200], ['10x15', '10×15', 100, 150], ['A3', 'A3', 297, 420]];
  var PIECES = [[6, 2, 3], [12, 3, 4], [24, 4, 6], [35, 5, 7], [48, 6, 8], [70, 7, 10], [108, 9, 12]];
  function esc(s) { return FS.esc ? FS.esc(s) : String(s); }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function C(w, h) { return FS.canvas(Math.round(w), Math.round(h)); }
  /* draw `img` covering the box (x,y,w,h), its centre a little above the middle (where faces usually are), rotated by q quarter turns */
  function cover(x, img, bx, by, bw, bh, q, region) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, sx = 0, sy = 0, sw = iw, sh = ih;
    if (region) { sx = region[0] * iw; sy = region[1] * ih; sw = region[2] * iw; sh = region[3] * ih; }
    q = ((q || 0) % 4 + 4) % 4;
    var tw = q % 2 ? bh : bw, th = q % 2 ? bw : bh;   /* the box as the photo sees it */
    if (!region) { var k = Math.max(tw / sw, th / sh), cw = tw / k, ch = th / k; sx = (sw - cw) / 2; sy = Math.max(0, Math.min(sh - ch, (sh - ch) * 0.4)); sw = cw; sh = ch; }
    x.save(); x.translate(bx + bw / 2, by + bh / 2); x.rotate(q * Math.PI / 2); x.imageSmoothingQuality = 'high';
    x.drawImage(img, sx, sy, sw, sh, -tw / 2, -th / 2, tw, th); x.restore();
  }
  /* a crop of the photo to a given shape (for the block puzzle, so the cubes split it evenly) */
  function cropTo(img, ar) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, w = iw, h = iw / ar; if (h > ih) { h = ih; w = ih * ar; }
    var x = (iw - w) / 2, y = Math.max(0, Math.min(ih - h, (ih - h) * 0.4)); return [x / iw, y / ih, w / iw, h / ih];
  }

  /* ---------- the puzzle ---------- */
  /* one edge between two points, as a polyline: straight, or the classic tab (three cubic curves, random size and place) */
  function bez(p0, p1, p2, p3, out) { for (var i = 1; i <= 14; i++) { var t = i / 14, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } }
  function edge(ax, ay, bx, by, kind, r) {
    if (kind === 'straight') return [[ax, ay], [bx, by]];
    var L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux, f = r() < 0.5 ? 1 : -1;
    var t = 0.1 + r() * 0.02, j = function () { return (r() * 2 - 1) * 0.035; }, a = j(), b = j(), c = j(), d = j(), e = j();
    function P(l, w) { return [ax + ux * l * L + nx * w * L * f, ay + uy * l * L + ny * w * L * f]; }
    var p = [P(0, 0), P(0.2, a), P(0.5 + b + d, -t + c), P(0.5 - t + b, t + c), P(0.5 - 2 * t + b - d, 3 * t + c), P(0.5 + 2 * t + b - d, 3 * t + c), P(0.5 + t + b, t + c), P(0.5 + b + d, -t + c), P(0.8, e), P(1, 0)];
    var out = [p[0]]; bez(p[0], p[1], p[2], p[3], out); bez(p[3], p[4], p[5], p[6], out); bez(p[6], p[7], p[8], p[9], out); return out;
  }
  function puzzleGeom(W, H, cols, rows, kind, seed) {
    var r = rng(seed), cw = W / cols, ch = H / rows, hz = [], vt = [], i, k;
    for (k = 1; k < rows; k++) { hz[k] = []; for (i = 0; i < cols; i++) hz[k][i] = edge(i * cw, k * ch, (i + 1) * cw, k * ch, kind, r); }
    for (i = 1; i < cols; i++) { vt[i] = []; for (k = 0; k < rows; k++) vt[i][k] = edge(i * cw, k * ch, i * cw, (k + 1) * ch, kind, r); }
    return { W: W, H: H, cols: cols, rows: rows, cw: cw, ch: ch, hz: hz, vt: vt };
  }
  function piecePath(g, i, k) {
    var top = k === 0 ? [[i * g.cw, 0], [(i + 1) * g.cw, 0]] : g.hz[k][i];
    var right = i === g.cols - 1 ? [[g.W, k * g.ch], [g.W, (k + 1) * g.ch]] : g.vt[i + 1][k];
    var bottom = k === g.rows - 1 ? [[i * g.cw, g.H], [(i + 1) * g.cw, g.H]] : g.hz[k + 1][i];
    var left = i === 0 ? [[0, k * g.ch], [0, (k + 1) * g.ch]] : g.vt[i][k];
    var pts = top.concat(right, bottom.slice().reverse(), left.slice().reverse()), p = new Path2D();
    pts.forEach(function (q, n) { if (n) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); p.closePath(); return p;
  }
  function edgesPath(g) {
    var p = new Path2D();
    function add(pl) { pl.forEach(function (q, n) { if (n) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); }
    g.hz.forEach(function (row) { if (row) row.forEach(add); }); g.vt.forEach(function (col) { if (col) col.forEach(add); });
    return p;
  }
  var LINE = { white: ['rgba(255,255,255,.92)', 'rgba(0,0,0,.35)'], dark: ['rgba(20,20,28,.85)', null], gold: ['#E3C48A', 'rgba(0,0,0,.35)'], none: null };
  /* the whole puzzle page, at scale s (1 = 300 dpi of the paper) */
  function drawPuzzle(img, o, s) {
    var pap = PAPERS.filter(function (x) { return x[0] === o.paper; })[0] || PAPERS[0], iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var land = iw > ih, wmm = land ? Math.max(pap[2], pap[3]) : Math.min(pap[2], pap[3]), hmm = land ? Math.min(pap[2], pap[3]) : Math.max(pap[2], pap[3]);
    var W = wmm * MM * s, H = hmm * MM * s, pc = PIECES.filter(function (x) { return x[0] === o.pieces; })[0] || PIECES[1];
    var cols = land ? pc[2] : pc[1], rows = land ? pc[1] : pc[2], g = puzzleGeom(W, H, cols, rows, o.kind, o.seed);
    var c = C(W, H), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); cover(x, img, 0, 0, W, H, 0);
    var u = Math.min(g.cw, g.ch), lw = Math.max(1, u * 0.018);
    /* the gentle 3D: each piece lit from the top left, a shade at the bottom right */
    if (o.bevel) {
      for (var k = 0; k < rows; k++) for (var i = 0; i < cols; i++) {
        var p = piecePath(g, i, k); x.save(); x.clip(p);
        x.lineWidth = u * 0.06; x.translate(-u * 0.012, -u * 0.012); x.strokeStyle = 'rgba(255,255,255,.28)'; x.stroke(p);
        x.translate(u * 0.024, u * 0.024); x.strokeStyle = 'rgba(0,0,0,.30)'; x.stroke(p); x.restore();
      }
    }
    var ln = LINE[o.lines];
    if (ln) { var ep = edgesPath(g); x.lineJoin = 'round'; x.lineCap = 'round'; if (ln[1]) { x.save(); x.translate(lw * 0.6, lw * 0.6); x.strokeStyle = ln[1]; x.lineWidth = lw; x.stroke(ep); x.restore(); } x.strokeStyle = ln[0]; x.lineWidth = lw; x.stroke(ep); }
    /* one piece lifted out of its place, for a display print */
    if (o.lift && cols > 1 && rows > 1) {
      var li = Math.min(cols - 1, Math.round(cols * 0.7)), lk = Math.min(rows - 1, Math.round(rows * 0.3)), lp = piecePath(g, li, lk);
      var snap = C(W, H), sx = snap.getContext('2d'); sx.drawImage(c, 0, 0);
      x.save(); x.fillStyle = 'rgba(18,16,24,.82)'; x.fill(lp); x.clip(lp); x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = u * 0.12; x.lineWidth = u * 0.1; x.strokeStyle = 'rgba(0,0,0,.6)'; x.stroke(lp); x.restore();
      var cx = (li + 0.5) * g.cw, cy = (lk + 0.5) * g.ch;
      x.save(); x.translate(cx + u * 0.22, cy - u * 0.3); x.rotate(-0.12); x.translate(-cx, -cy);
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = u * 0.22; x.shadowOffsetX = u * 0.06; x.shadowOffsetY = u * 0.12; x.fillStyle = '#fff'; x.fill(lp);
      x.shadowColor = 'transparent'; x.clip(lp); x.drawImage(snap, 0, 0); x.restore();
    }
    return { canvas: c, wmm: wmm, hmm: hmm, g: g, lw: lw };
  }
  /* the cutting template: the same lines in black on white, with crop marks at the corners */
  function cutSheet(r) {
    var g = r.g, c = C(g.W, g.H), x = c.getContext('2d'), m = 6 * MM;
    x.fillStyle = '#fff'; x.fillRect(0, 0, g.W, g.H); x.strokeStyle = '#111'; x.lineWidth = Math.max(2, r.lw * 0.6); x.lineJoin = 'round';
    x.stroke(edgesPath(g)); x.strokeRect(1, 1, g.W - 2, g.H - 2);
    x.lineWidth = 2; [[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]].forEach(function (p) { var sx = p[0] ? -1 : 1, sy = p[1] ? -1 : 1; x.beginPath(); x.moveTo(p[0] + sx * m, p[1]); x.lineTo(p[0] + sx * m * 2, p[1]); x.moveTo(p[0], p[1] + sy * m); x.lineTo(p[0], p[1] + sy * m * 2); x.stroke(); });
    x.fillStyle = '#666'; x.font = Math.round(4 * MM) + 'px Assistant, Arial'; x.textAlign = 'center'; x.fillText('תבנית חיתוך · ' + g.cols * g.rows + ' חלקים', g.W / 2, g.H - 3 * MM);
    return c;
  }

  /* ---------- the cubes ---------- */
  /* a cube net (a cross: top / left front right back / bottom) with glue tabs. faces[f] = {img, region, q}. at (ox, oy), edge e px; rot = net turned 90° */
  function cubeNet(x, ox, oy, e, faces, rot) {
    var t = e * 0.2, pos = { top: [1, 0], left: [0, 1], front: [1, 1], right: [2, 1], back: [3, 1], bottom: [1, 2] };
    x.save(); x.translate(ox, oy); if (rot) { x.translate(3 * e, 0); x.rotate(Math.PI / 2); }
    /* glue tabs (grey, a word on them) on the middle row's free edges */
    function tab(px, py, w, h, dir) {
      x.beginPath(); var k = Math.min(w, h) * 0.6;
      if (dir === 'up') { x.moveTo(px, py); x.lineTo(px + k, py - h); x.lineTo(px + w - k, py - h); x.lineTo(px + w, py); }
      else if (dir === 'down') { x.moveTo(px, py); x.lineTo(px + k, py + h); x.lineTo(px + w - k, py + h); x.lineTo(px + w, py); }
      else { x.moveTo(px, py); x.lineTo(px + w, py + k); x.lineTo(px + w, py + h - k); x.lineTo(px, py + h); }
      x.closePath(); x.fillStyle = '#ECECEC'; x.fill(); x.strokeStyle = '#333'; x.lineWidth = Math.max(1.5, e * 0.006); x.stroke();
    }
    [['left', 'up'], ['right', 'up'], ['back', 'up'], ['left', 'down'], ['right', 'down'], ['back', 'down']].forEach(function (a) { var p = pos[a[0]]; if (a[1] === 'up') tab(p[0] * e, e, e, t, 'up'); else tab(p[0] * e, 2 * e, e, t, 'down'); });
    tab(4 * e, e, t, e, 'side');
    Object.keys(pos).forEach(function (f) { var p = pos[f], fc = faces[f]; x.save(); x.beginPath(); x.rect(p[0] * e, p[1] * e, e, e); x.clip(); x.fillStyle = '#fff'; x.fillRect(p[0] * e, p[1] * e, e, e); if (fc && fc.img) cover(x, fc.img, p[0] * e, p[1] * e, e, e, fc.q || 0, fc.region); x.restore(); });
    /* cut lines (the outline) solid, fold lines dashed */
    x.strokeStyle = '#222'; x.lineWidth = Math.max(2, e * 0.007);
    x.beginPath(); x.moveTo(e, 0); x.lineTo(2 * e, 0); x.lineTo(2 * e, e); x.lineTo(4 * e, e); x.lineTo(4 * e, 2 * e); x.lineTo(2 * e, 2 * e); x.lineTo(2 * e, 3 * e); x.lineTo(e, 3 * e); x.lineTo(e, 2 * e); x.lineTo(0, 2 * e); x.lineTo(0, e); x.lineTo(e, e); x.closePath(); x.stroke();
    x.setLineDash([e * 0.035, e * 0.025]); x.strokeStyle = 'rgba(40,40,40,.75)'; x.lineWidth = Math.max(1.5, e * 0.005); x.beginPath();
    [[e, e, 2 * e, e], [e, 2 * e, 2 * e, 2 * e], [e, e, e, 2 * e], [2 * e, e, 2 * e, 2 * e], [3 * e, e, 3 * e, 2 * e], [4 * e, e, 4 * e, 2 * e], [0, e, e, e], [2 * e, e, 4 * e, e], [0, 2 * e, e, 2 * e], [2 * e, 2 * e, 4 * e, 2 * e]].forEach(function (l) { x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); });
    x.stroke(); x.setLineDash([]); x.restore();
  }
  function netBox(e, rot) { var w = 4.25 * e, h = 3.06 * e; return rot ? [h, w] : [w, h]; }   /* with the tabs and a little air */
  /* pages of nets: as many as fit on the paper, turning the net when that fits more */
  function netPages(list, e, paper) {
    var pap = PAPERS.filter(function (x) { return x[0] === paper; })[0], W = Math.max(pap[2], pap[3]) * MM, H = Math.min(pap[2], pap[3]) * MM, m = 6 * MM;
    var best = null;
    [[W, H, false], [W, H, true], [H, W, false], [H, W, true]].forEach(function (o) { var b = netBox(e, o[2]), n = Math.floor((o[0] - 2 * m) / b[0]) * Math.floor((o[1] - 2 * m) / b[1]); if (n > 0 && (!best || n > best.n)) best = { W: o[0], H: o[1], rot: o[2], n: n, b: b }; });
    if (!best) return null;
    var cols = Math.floor((best.W - 2 * m) / best.b[0]), pages = [];
    for (var s = 0; s < list.length; s += best.n) {
      var c = C(best.W, best.H), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, best.W, best.H);
      list.slice(s, s + best.n).forEach(function (faces, k) {
        var ox = m + (k % cols) * best.b[0] + e * 0.02, oy = m + Math.floor(k / cols) * best.b[1] + e * 0.03;
        cubeNet(x, ox, oy, e, faces.faces, best.rot);
        /* the cube's number in an empty corner of its net: top left as drawn, bottom left when the net is turned */
        if (faces.label) { var lx = ox + 0.06 * e, ly = oy + (best.rot ? 3.25 * e : 0.3 * e); x.save(); x.textAlign = 'left'; x.fillStyle = '#555'; x.font = '700 ' + Math.round(e * 0.22) + 'px Assistant, Arial'; x.fillText(faces.label[0], lx, ly); x.fillStyle = '#888'; x.font = Math.round(e * 0.09) + 'px Assistant, Arial'; x.fillText(faces.label[1], lx, ly + e * 0.15); x.restore(); }
      });
      x.fillStyle = '#777'; x.font = Math.round(3.4 * MM) + 'px Assistant, Arial'; x.textAlign = 'center';
      x.fillText('גוזרים בקו הרציף · מקפלים בקו המקווקו · מדביקים את הלשוניות האפורות מבפנים', best.W / 2, best.H - 3 * MM);
      pages.push({ canvas: c, wmm: best.W / MM, hmm: best.H / MM });
    }
    return { pages: pages, perPage: best.n };
  }
  var FACES = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  /* the turn of each face's picture so it stands upright when that face is rolled to the top (see the note at the top) */
  var BLOCK_Q = { top: 0, front: 0, bottom: 0, back: 2, left: 3, right: 1 };
  function cubeSets(o, imgs) {
    if (o.type === 'photo') { var f = {}; FACES.forEach(function (n, i) { f[n] = { img: imgs[i % imgs.length], q: 0 }; }); return [{ faces: f }]; }
    var cols = o.type === 'block43' ? 4 : 3, rows = 3, ar = cols / rows, regs = imgs.map(function (im) { return cropTo(im, ar); }), out = [];
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var f2 = {};
      ['top', 'front', 'right', 'back', 'left', 'bottom'].forEach(function (n, fi) {
        var im = imgs[fi % imgs.length], R = regs[fi % imgs.length];
        f2[n] = { img: im, q: BLOCK_Q[n], region: [R[0] + R[2] * i / cols, R[1] + R[3] * j / rows, R[2] / cols, R[3] / rows] };
      });
      out.push({ faces: f2, label: ['#' + (j * cols + i + 1), 'שורה ' + (j + 1) + ' · טור ' + (i + 1)] });
    }
    return out;
  }

  /* ---------- into the project ---------- */
  function addPage(canvas, name, wmm, hmm) {
    return new Promise(function (ok) { canvas.toBlob(ok, 'image/jpeg', 0.95); }).then(function (b) {
      return FS.addPhotoFile(new File([b], name + '.jpg', { type: 'image/jpeg' }));
    }).then(function (p) {
      return FS.loadImg(p.src).then(function (im) {
        p.doc = FS.newDoc(im, 'magnet'); FS.applyFormat(p.doc, 'cm', im, wmm, hmm); p.doc.frame = null; p.doc.layers = []; delete p.eventReady;
        p.craft = 1; p.copies = 1; p.cache = {}; if (FS.snap) FS.snap(p); return p;
      });
    });
  }
  function download(canvas, name) { canvas.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }, 'image/jpeg', 0.95); }
  function addAll(pages, base) {
    var S = FS.state, first = S.photos.length; FS.busy && FS.busy('מוסיף להדפסה…');
    return pages.reduce(function (ch, pg, k) { return ch.then(function () { return addPage(pg.canvas, base + (pages.length > 1 ? '-' + (k + 1) : ''), pg.wmm, pg.hmm); }); }, Promise.resolve()).then(function () {
      FS.busy && FS.busy(); if (FS.refreshStrip) FS.refreshStrip(); FS.emit('doc'); FS.emit('photos-added', { from: first, n: S.photos.length - first });
      FS.toast('✅ ' + (pages.length > 1 ? pages.length + ' דפים נוספו' : 'נוסף') + ' לתמונות, בגודל המדויק. מדפיסים כרגיל (הדפסה ← "גודל עמוד").', 6000);
    }).catch(function (e) { FS.busy && FS.busy(); FS.toast('לא נוסף: ' + ((e && e.message) || ''), 5000); });
  }
  function lsj(k, d) { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private */ } }
  function chips(name, list, cur) { return '<div class="cr-chips" data-o="' + name + '">' + list.map(function (v) { return '<button type="button" data-v="' + v[0] + '"' + (String(v[0]) === String(cur) ? ' class="on"' : '') + '>' + v[1] + '</button>'; }).join('') + '</div>'; }

  /* ---------- the puzzle window ---------- */
  FS.openPuzzle = function (p) {
    if (!p) return FS.toast('בוחרים תמונה קודם');
    var o = lsj('fs-puzzle', { paper: 'A4', pieces: 24, kind: 'classic', lines: 'white', bevel: true, lift: false, sheet: false, seed: 7 });
    var b = FS.dialog('🧩 פאזל מהתמונה', '<div class="cr"><div class="cr-stage"><div class="cr-cv" id="cr-cv"></div><p class="cr-info" id="cr-info"></p></div><div class="cr-side">' +
      '<label>מספר חלקים</label>' + chips('pieces', PIECES.map(function (x) { return [x[0], x[0] + ' <small>' + x[1] + '×' + x[2] + '</small>']; }), o.pieces) +
      '<label>גודל</label>' + chips('paper', PAPERS.map(function (x) { return [x[0], x[1]]; }), o.paper) +
      '<label>צורת החלקים</label>' + chips('kind', [['classic', '🧩 פאזל קלאסי'], ['straight', '▦ ריבועים (קל לחיתוך)']], o.kind) +
      '<label>קווי החיתוך על ההדפסה</label>' + chips('lines', [['white', 'לבן'], ['gold', 'זהב'], ['dark', 'כהה'], ['none', 'בלי (רק בתבנית)']], o.lines) +
      '<label class="mt-chk-l"><input type="checkbox" data-c="bevel"' + (o.bevel ? ' checked' : '') + '> מראה תלת־ממד לחלקים</label>' +
      '<label class="mt-chk-l"><input type="checkbox" data-c="lift"' + (o.lift ? ' checked' : '') + '> חלק אחד מורם מהמקום (להצגה)</label>' +
      '<label class="mt-chk-l"><input type="checkbox" data-c="sheet"' + (o.sheet ? ' checked' : '') + '> גם דף תבנית חיתוך</label>' +
      '<div class="cr-row"><button type="button" class="mt-btn" id="cr-seed">🔀 צורה אחרת</button><button type="button" class="mt-btn" id="cr-dl">⬇️ הורדה</button></div>' +
      '<button type="button" class="mt-btn primary cr-go" id="cr-add">➕ הוספה להדפסה</button></div></div>', true);
    b.classList.add('cr-dlg');
    FS.loadImg(p.src).then(function (img) {
      function paint() {
        lss('fs-puzzle', o);
        var box = b.querySelector('#cr-cv'); if (!box) return;
        var pap = PAPERS.filter(function (x) { return x[0] === o.paper; })[0], s = Math.min(1, 680 / (Math.max(pap[2], pap[3]) * MM));
        var r = drawPuzzle(img, o, s); r.canvas.className = 'cr-page'; box.innerHTML = ''; box.appendChild(r.canvas);
        var piece = Math.round(Math.min(r.wmm / r.g.cols, r.hmm / r.g.rows) * 10) / 100;
        b.querySelector('#cr-info').textContent = r.g.cols * r.g.rows + ' חלקים · ' + (r.wmm / 10) + '×' + (r.hmm / 10) + ' ס״מ · חלק בערך ' + piece + ' ס״מ' + (piece < 2 ? ' (קטן: לגזירה ידנית עדיף פחות חלקים)' : '');
      }
      b.addEventListener('click', function (e) {
        var c = e.target.closest('[data-v]'); if (c) { var k = c.parentNode.dataset.o; o[k] = k === 'pieces' ? Number(c.dataset.v) : c.dataset.v; c.parentNode.querySelectorAll('[data-v]').forEach(function (y) { y.classList.toggle('on', y === c); }); paint(); }
      });
      b.querySelectorAll('[data-c]').forEach(function (cb) { cb.addEventListener('change', function () { o[cb.dataset.c] = cb.checked; paint(); }); });
      b.querySelector('#cr-seed').addEventListener('click', function () { o.seed = (o.seed * 7 + 13) % 99991; paint(); });
      function full() { var r = drawPuzzle(img, o, 1), pages = [{ canvas: r.canvas, wmm: r.wmm, hmm: r.hmm }]; if (o.sheet) pages.push({ canvas: cutSheet(r), wmm: r.wmm, hmm: r.hmm }); return pages; }
      b.querySelector('#cr-dl').addEventListener('click', function () { FS.busy && FS.busy('מכין את הקובץ…'); setTimeout(function () { full().forEach(function (pg, k) { download(pg.canvas, 'puzzle-' + o.pieces + (k ? '-cut' : '')); }); FS.busy && FS.busy(); }, 30); });
      b.querySelector('#cr-add').addEventListener('click', function () { FS.busy && FS.busy('מכין את הפאזל בגודל אמיתי…'); setTimeout(function () { var pages = full(); FS.closeDialog(); addAll(pages, 'פאזל ' + o.pieces + ' חלקים'); }, 30); });
      paint();
    });
  };

  /* ---------- the cube window ---------- */
  FS.openCube = function (list) {
    list = (list || []).filter(Boolean); if (!list.length) return FS.toast('מסמנים תמונות (עד 6), או בוחרים תמונה');
    list = list.slice(0, 6);
    var o = lsj('fs-cube', { type: 'photo', edge: 60, paper: 'A4' });
    var b = FS.dialog('🎲 קוביות מתמונות', '<div class="cr"><div class="cr-stage"><div class="cr-cv" id="cr-cv"></div><p class="cr-info" id="cr-info"></p></div><div class="cr-side">' +
      '<label>מה בונים</label>' + chips('type', [['photo', '🎲 קוביית תמונות · 6 צדדים'], ['block33', '🧱 פאזל קוביות 3×3'], ['block43', '🧱 פאזל קוביות 4×3']], o.type) +
      '<p class="cr-help" id="cr-help"></p>' +
      '<label>גודל צלע הקוביה</label><div id="cr-edge"></div>' +
      '<label>נייר</label>' + chips('paper', [['A4', 'A4'], ['A3', 'A3']], o.paper) +
      '<div class="cr-thumbs">' + list.map(function (p, i) { return '<span><img src="' + esc(p.src) + '" alt=""><b>' + (i + 1) + '</b></span>'; }).join('') + '</div>' +
      '<p class="cr-help">' + (list.length < 6 ? 'סומנו ' + list.length + ' תמונות; הן חוזרות עד שיש 6. לסמן 6 תמונות נותן קוביה מלאה.' : '6 תמונות, צד לכל תמונה.') + '</p>' +
      '<div class="cr-row"><button type="button" class="mt-btn" id="cr-dl">⬇️ הורדה</button></div>' +
      '<button type="button" class="mt-btn primary cr-go" id="cr-add">➕ הוספה להדפסה</button></div></div>', true);
    b.classList.add('cr-dlg');
    var EDGES = { photo: [[50, '5 ס״מ'], [60, '6 ס״מ'], [70, '7 ס״מ (A3)'], [80, '8 ס״מ (A3)'], [90, '9 ס״מ (A3)']], block33: [[30, '3 ס״מ'], [35, '3.5 ס״מ'], [40, '4 ס״מ'], [50, '5 ס״מ']], block43: [[30, '3 ס״מ'], [35, '3.5 ס״מ'], [40, '4 ס״מ'], [50, '5 ס״מ']] };
    Promise.all(list.map(function (p) { return FS.loadImg(p.src); })).then(function (imgs) {
      function fixEdge() { var l = EDGES[o.type]; if (!l.some(function (x) { return x[0] === o.edge; })) o.edge = l[1][0]; b.querySelector('#cr-edge').innerHTML = chips('edge', l, o.edge); }
      function build(s) {
        var sets = cubeSets(o, imgs), e = o.edge * MM, r = netPages(sets, e, o.paper);
        if (!r && o.paper === 'A4') { o.paper = 'A3'; b.querySelectorAll('[data-o="paper"] [data-v]').forEach(function (y) { y.classList.toggle('on', y.dataset.v === 'A3'); }); r = netPages(sets, e, 'A3'); }
        return r;
      }
      function paint() {
        lss('fs-cube', o); fixEdge();
        b.querySelector('#cr-help').textContent = o.type === 'photo' ? 'קוביה אחת עם 6 תמונות: גוזרים, מקפלים ומדביקים. מתנה מעולה לאורחים.' : 'כל תמונה מתחלקת על כל הקוביות. מגלגלים את כל הקוביות לאותו כיוון, ומתגלה התמונה הבאה. ' + (o.type === 'block33' ? '9' : '12') + ' קוביות, 6 תמונות.';
        var r = build(); if (!r) { b.querySelector('#cr-info').textContent = 'הקוביה גדולה מדי לנייר הזה.'; return; }
        var pg = r.pages[0], s = Math.min(1, 680 / Math.max(pg.canvas.width, pg.canvas.height)), v = C(pg.canvas.width * s, pg.canvas.height * s);
        v.getContext('2d').drawImage(pg.canvas, 0, 0, v.width, v.height); v.className = 'cr-page';
        var box = b.querySelector('#cr-cv'); box.innerHTML = ''; box.appendChild(v);
        b.querySelector('#cr-info').textContent = r.pages.length + (r.pages.length > 1 ? ' דפים' : ' דף') + ' ' + o.paper + ' · ' + r.perPage + ' ' + (r.perPage > 1 ? 'קוביות' : 'קוביה') + ' בדף · צלע ' + o.edge / 10 + ' ס״מ' + (r.pages.length > 1 ? ' (בתצוגה: הדף הראשון)' : '');
        cur = r;
      }
      var cur = null;
      b.addEventListener('click', function (e) {
        var c = e.target.closest('[data-v]'); if (!c) return; var k = c.parentNode.dataset.o; o[k] = k === 'edge' ? Number(c.dataset.v) : c.dataset.v;
        if (k === 'type') { var l = EDGES[o.type]; o.edge = l[1][0]; o.paper = 'A4'; b.querySelectorAll('[data-o="paper"] [data-v]').forEach(function (y) { y.classList.toggle('on', y.dataset.v === 'A4'); }); }
        c.parentNode.querySelectorAll('[data-v]').forEach(function (y) { y.classList.toggle('on', y === c); }); paint();
      });
      b.querySelector('#cr-dl').addEventListener('click', function () { if (cur) cur.pages.forEach(function (pg, k) { download(pg.canvas, 'cube-' + o.type + '-' + (k + 1)); }); });
      b.querySelector('#cr-add').addEventListener('click', function () { if (!cur) return; var pages = cur.pages; FS.closeDialog(); addAll(pages, o.type === 'photo' ? 'קוביית תמונות' : 'פאזל קוביות'); });
      paint();
    });
  };

  /* ---------- the card in the AI tabs ---------- */
  FS.craftsCard = function (box, opt) {
    if (!box) return;
    box.innerHTML = '<h3 class="cr-h">🧩 פאזלים וקוביות <small>מוכן להדפסה ולחיתוך, בגודל אמיתי · מושלם למגנטים ולמתנות לאורחים</small></h3>' +
      '<div class="cr-cards">' +
      '<button type="button" class="cr-card" data-cr="puzzle"><span class="cr-ic">🧩</span><b>פאזל מהתמונה</b><small>6 עד 108 חלקים, קווי חיתוך, מראה תלת־ממד</small></button>' +
      '<button type="button" class="cr-card" data-cr="cube"><span class="cr-ic">🎲</span><b>קוביית תמונות</b><small>6 תמונות על קוביה, עם קווי קיפול ולשוניות הדבקה</small></button>' +
      '<button type="button" class="cr-card" data-cr="block"><span class="cr-ic">🧱</span><b>פאזל קוביות</b><small>9 או 12 קוביות, 6 תמונות: מגלגלים ומגלים תמונה חדשה</small></button></div>';
    box.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cr]'); if (!c) return; var l = opt.list();
      if (c.dataset.cr === 'puzzle') FS.openPuzzle(opt.one() || l[0]);
      else { if (c.dataset.cr === 'block') lss('fs-cube', Object.assign(lsj('fs-cube', {}), { type: 'block33', edge: 40, paper: 'A4' })); else lss('fs-cube', Object.assign(lsj('fs-cube', {}), { type: 'photo', edge: 60, paper: 'A4' })); FS.openCube(l.length ? l : [opt.one()]); }
    });
  };
  FS.crafts = { drawPuzzle: drawPuzzle, cubeSets: cubeSets, netPages: netPages };
})();
