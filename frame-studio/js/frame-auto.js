/* "🎨 עיצוב מסגרת" in the admin (and the phone app): a finished magnet frame from the booking, in one tap.
   - The event comes from a deal or a booking request (names, date, type), or is typed in.
   - The invitation is optional: photographed or uploaded on the phone, its colours lead the designs, and one design is
     the invitation's own border rebuilt around the photo (FS.frameFromInvite).
   - Eight designs are drawn at once, in code, on this device (no AI, no cost): classic gold, modern, evening black-gold,
     floral arch, party, polaroid, magazine, and from the invitation. Each is shown over a sample photo; one tap opens it
     large, with the colours, the window's shape and the lines to show.
   - The chosen frame goes to the studio (it waits under "🎨 עיצובים מאושרים של לקוחות" in the live event, through the
     same design-save + design-approve the customers use), downloads as a PNG with a see-through window (300 dpi), or is
     shared to the customer on WhatsApp.
   FS.frameAuto(m, ctx) draws the screen; FS.frameAutoPick = deal or request id preselects an event. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SIZES = { '10x15': [1181, 1772, 'עומד 10×15'], '15x10': [1772, 1181, 'שוכב 15×10'], '13x18': [1535, 2126, 'עומד 13×18'] };
  var EV_ORN = { wedding: 'rings', barmitzvah: 'magen', brit: 'star', birthday: 'balloons', henna: 'flourish', company: 'divider', engagement: 'hearts', holiday: 'star' };
  var FONTS = ['Frank Ruhl Libre', 'Heebo', 'Amatic SC', 'Secular One', 'Suez One'];

  /* ---------- colours ---------- */
  function rgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var p = rgb(a), q = rgb(b); return hex(p.map(function (v, i) { return v + (q[i] - v) * t; })); }
  function lum(h) { var c = rgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function alpha(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function palettes(st) {
    var e = FS.event ? FS.event(st.type) : { color: '#B8904F', ink: '#3A2E1F', palette: ['#B8904F', '#E9D9B4'], name: '' }, out = [];
    if (st.invPal && st.invPal.length > 1) {
      var acc = FS.accentOf ? FS.accentOf(st.invPal) : st.invPal[1], paper = lum(st.invPal[0]) > 170 ? st.invPal[0] : '#FBF7EF';
      out.push({ id: 'inv', name: 'מההזמנה', paper: paper, accent: acc, ink: lum(acc) < 90 ? acc : mix(acc, '#000000', 0.55), soft: st.invPal[2] || mix(acc, '#ffffff', 0.6) });
    }
    var ink = lum(e.ink || '#333') < 150 ? e.ink : mix(e.color, '#000000', 0.6);
    out.push({ id: 'ev', name: e.name || 'האירוע', paper: '#FBF7EF', accent: e.color, ink: ink, soft: (e.palette || [])[1] || mix(e.color, '#ffffff', 0.6) });
    out.push({ id: 'gold', name: 'זהב', paper: '#FBF7EF', accent: '#B8904F', ink: '#3A2E1F', soft: '#E9D9B4' });
    out.push({ id: 'blush', name: 'ורוד עתיק', paper: '#FDF6F4', accent: '#C9797A', ink: '#5A2E33', soft: '#F2C9C4' });
    out.push({ id: 'navy', name: 'כחול לילה', paper: '#F7F8FB', accent: '#1D2D6E', ink: '#141C40', soft: '#C9A45C' });
    out.push({ id: 'sage', name: 'ירוק מרווה', paper: '#F6F8F3', accent: '#7C9A6B', ink: '#2F3D28', soft: '#D7E3CC' });
    return out;
  }

  /* ---------- drawing helpers ---------- */
  var ORN = {};
  function orn(x, id, color, cx, cy, size, rot, flip) {
    if (!FS.elementCanvas) return; var k = id + color, c = ORN[k] || (ORN[k] = FS.elementCanvas(id, color)); if (!c) return;
    var s = size / Math.max(c.width, c.height);
    x.save(); x.translate(cx, cy); if (rot) x.rotate(rot); if (flip) x.scale(-1, 1); x.drawImage(c, -c.width * s / 2, -c.height * s / 2, c.width * s, c.height * s); x.restore();
  }
  function shapePath(x, w, shape, r) {
    x.beginPath();
    if (shape === 'oval') { x.ellipse(w.x + w.w / 2, w.y + w.h / 2, w.w / 2, w.h / 2, 0, 0, Math.PI * 2); return; }
    if (shape === 'arch') { var rr = w.w / 2; x.moveTo(w.x, w.y + w.h); x.lineTo(w.x, w.y + rr); x.arc(w.x + rr, w.y + rr, rr, Math.PI, 0); x.lineTo(w.x + w.w, w.y + w.h); x.closePath(); return; }
    r = Math.min(r || 0, w.w / 2, w.h / 2);
    x.moveTo(w.x + r, w.y); x.arcTo(w.x + w.w, w.y, w.x + w.w, w.y + w.h, r); x.arcTo(w.x + w.w, w.y + w.h, w.x, w.y + w.h, r); x.arcTo(w.x, w.y + w.h, w.x, w.y, r); x.arcTo(w.x, w.y, w.x + w.w, w.y, r); x.closePath();
  }
  function cut(x, w, shape, r) { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.globalAlpha = 1; shapePath(x, w, shape, r); x.fill(); x.restore(); }
  function stroke(x, w, shape, r, color, lw) { x.save(); shapePath(x, w, shape, r); x.lineWidth = lw; x.strokeStyle = color; x.stroke(); x.restore(); }
  /* one line of text, centred, shrunk to fit */
  function text(x, s, o) {
    if (!s) return 0; var size = o.size, f = function () { return (o.weight || 700) + ' ' + size + 'px "' + o.font + '", Heebo, sans-serif'; };
    x.save(); x.font = f(); while (size > 8 && x.measureText(s).width + (o.spacing || 0) * s.length > o.maxW) { size *= 0.94; x.font = f(); }
    x.direction = 'rtl'; x.textAlign = o.align || 'center'; x.textBaseline = 'middle'; x.fillStyle = o.color;
    if ('letterSpacing' in x && o.spacing) x.letterSpacing = o.spacing + 'px';
    if (o.shadow) { x.shadowColor = o.shadow; x.shadowBlur = size * 0.18; x.shadowOffsetY = size * 0.04; }
    x.fillText(s, o.x, o.y); x.restore(); return size;
  }
  function rand(seed) { var s = seed || 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function band(W, H, M, k) { return Math.round(Math.max(W, H) === H ? H * k : H * (k + 0.06)); }

  /* ---------- the designs: (x, W, H, p palette, t texts, o options) → draws the frame with a see-through window ---------- */
  var DESIGNS = [
    { id: 'classic', name: 'זהב קלאסי', shapes: ['round', 'arch', 'oval'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.075, bh = band(W, H, M, 0.2);
      x.fillStyle = p.paper; x.fillRect(0, 0, W, H);
      var g = x.createRadialGradient(W / 2, H / 2, M * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, alpha('#ffffff', 0)); g.addColorStop(1, alpha(p.accent, 0.12)); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = p.accent; x.lineWidth = M * 0.006; x.strokeRect(M * 0.03, M * 0.03, W - M * 0.06, H - M * 0.06);
      x.lineWidth = M * 0.002; x.strokeRect(M * 0.045, M * 0.045, W - M * 0.09, H - M * 0.09);
      [[0, 0, 0], [W, 0, Math.PI / 2], [W, H, Math.PI], [0, H, -Math.PI / 2]].forEach(function (c) { orn(x, 'corner', p.accent, c[0] + (c[0] ? -1 : 1) * M * 0.1, c[1] + (c[1] ? -1 : 1) * M * 0.1, M * 0.13, c[2]); });
      var w = { x: m, y: m, w: W - 2 * m, h: H - m - bh };
      stroke(x, { x: w.x - M * 0.012, y: w.y - M * 0.012, w: w.w + M * 0.024, h: w.h + M * 0.024 }, o.shape, M * 0.03, p.accent, M * 0.004);
      cut(x, w, o.shape, M * 0.02);
      var cy = H - bh / 2 - M * 0.01;
      text(x, t.names, { font: 'Frank Ruhl Libre', weight: 800, size: M * 0.1, color: p.ink, x: W / 2, y: cy - bh * 0.16, maxW: W * 0.8 });
      orn(x, 'flourish', p.accent, W / 2, cy + bh * 0.13, M * 0.26);
      text(x, [t.date, t.greet].filter(Boolean).join('  ·  '), { font: 'Heebo', weight: 500, size: M * 0.032, color: alpha(p.ink, 0.75), x: W / 2, y: cy + bh * 0.31, maxW: W * 0.8, spacing: M * 0.002 });
    } },
    { id: 'modern', name: 'מודרני נקי', shapes: ['round', 'oval'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.045, bh = band(W, H, M, 0.17);
      x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
      var w = { x: m, y: m, w: W - 2 * m, h: H - m - bh }; cut(x, w, o.shape, M * 0.012);
      var y0 = H - bh, R = W - m;
      text(x, t.names, { font: 'Heebo', weight: 300, size: M * 0.095, color: p.ink, x: R, y: y0 + bh * 0.38, maxW: W * 0.62, align: 'right' });
      x.fillStyle = p.accent; x.fillRect(R - M * 0.09, y0 + bh * 0.66, M * 0.09, M * 0.008);
      text(x, t.date, { font: 'Heebo', weight: 700, size: M * 0.034, color: p.accent, x: m, y: y0 + bh * 0.36, maxW: W * 0.32, align: 'left', spacing: M * 0.004 });
      text(x, t.greet, { font: 'Heebo', weight: 400, size: M * 0.03, color: alpha(p.ink, 0.6), x: m, y: y0 + bh * 0.62, maxW: W * 0.32, align: 'left' });
    } },
    { id: 'noir', name: 'ערב שחור־זהב', shapes: ['round', 'arch', 'oval'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.08, bh = band(W, H, M, 0.2), gold = lum(p.accent) > 90 ? p.accent : '#D9B677';
      var bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#17141C'); bg.addColorStop(1, mix('#0C0B10', p.accent, 0.12)); x.fillStyle = bg; x.fillRect(0, 0, W, H);
      var gg = x.createLinearGradient(0, 0, W, 0); gg.addColorStop(0, mix(gold, '#ffffff', 0.45)); gg.addColorStop(0.5, gold); gg.addColorStop(1, mix(gold, '#000000', 0.25));
      x.strokeStyle = gg; x.lineWidth = M * 0.005; x.strokeRect(M * 0.035, M * 0.035, W - M * 0.07, H - M * 0.07);
      var r = rand(11); for (var i = 0; i < 14; i++) { var px = r() * W, py = r() * H; if (py > m * 0.6 && py < H - bh * 0.9 && px > m * 0.6 && px < W - m * 0.6) continue; orn(x, 'sparkle', mix(gold, '#ffffff', r() * 0.5), px, py, M * (0.02 + r() * 0.035)); }
      var w = { x: m, y: m, w: W - 2 * m, h: H - m - bh };
      stroke(x, { x: w.x - M * 0.016, y: w.y - M * 0.016, w: w.w + M * 0.032, h: w.h + M * 0.032 }, o.shape, M * 0.03, gg, M * 0.004);
      cut(x, w, o.shape, M * 0.02);
      var cy = H - bh / 2;
      x.save(); x.fillStyle = gg; text(x, t.names, { font: 'Frank Ruhl Libre', weight: 800, size: M * 0.1, color: gg, x: W / 2, y: cy - bh * 0.12, maxW: W * 0.82 }); x.restore();
      text(x, [t.date, t.greet].filter(Boolean).join('  ✦  '), { font: 'Heebo', weight: 400, size: M * 0.032, color: alpha('#F3EBDD', 0.8), x: W / 2, y: cy + bh * 0.22, maxW: W * 0.82, spacing: M * 0.003 });
    } },
    { id: 'floral', name: 'פרחוני בקשת', shapes: ['arch', 'round', 'oval'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.11, bh = band(W, H, M, 0.19), soft = lum(p.soft) > 150 ? p.soft : mix(p.soft, '#ffffff', 0.55);
      x.fillStyle = p.paper; x.fillRect(0, 0, W, H);
      var w = { x: m, y: m * 0.9, w: W - 2 * m, h: H - m * 0.9 - bh };
      stroke(x, { x: w.x - M * 0.02, y: w.y - M * 0.02, w: w.w + M * 0.04, h: w.h + M * 0.04 }, o.shape, M * 0.04, alpha(p.accent, 0.7), M * 0.004);
      [[W * 0.1, H * 0.07, 1, 0.3], [W * 0.9, H * 0.07, -1, -0.3], [W * 0.08, H - bh * 1.05, 1, -0.6], [W * 0.92, H - bh * 1.05, -1, 0.6]].forEach(function (c, i) {
        orn(x, 'leaves', p.accent, c[0] + c[2] * M * 0.06, c[1] + M * 0.03, M * 0.26, c[3], c[2] < 0);
        orn(x, 'flower', soft, c[0], c[1], M * (i < 2 ? 0.16 : 0.13), i * 0.4);
        orn(x, 'flower', p.accent, c[0] + c[2] * M * 0.1, c[1] + M * 0.06, M * 0.08, i);
      });
      cut(x, w, o.shape, M * 0.03);
      var cy = H - bh / 2;
      text(x, t.names, { font: 'Amatic SC', weight: 700, size: M * 0.13, color: p.ink, x: W / 2, y: cy - bh * 0.1, maxW: W * 0.78 });
      text(x, [t.greet, t.date].filter(Boolean).join(' · '), { font: 'Heebo', weight: 400, size: M * 0.032, color: alpha(p.ink, 0.7), x: W / 2, y: cy + bh * 0.26, maxW: W * 0.8 });
    } },
    { id: 'party', name: 'חגיגה צבעונית', shapes: ['round', 'oval'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.07, bh = band(W, H, M, 0.2);
      var bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, p.accent); bg.addColorStop(1, mix(p.soft, p.accent, 0.25)); x.fillStyle = bg; x.fillRect(0, 0, W, H);
      var r = rand(5), kinds = ['dots', 'star', 'sparkle', 'heart'];
      for (var i = 0; i < 46; i++) orn(x, kinds[i % 4], alpha('#ffffff', 0.35 + r() * 0.5), r() * W, r() * H, M * (0.025 + r() * 0.05), r() * 6);
      orn(x, t.orn === 'magen' ? 'magen' : 'balloons', '#ffffff', W - m * 1.1, H - bh * 0.62, M * 0.16);
      var w = { x: m, y: m, w: W - 2 * m, h: H - m - bh };
      x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = M * 0.03; x.fillStyle = '#ffffff'; shapePath(x, { x: w.x - M * 0.018, y: w.y - M * 0.018, w: w.w + M * 0.036, h: w.h + M * 0.036 }, o.shape, M * 0.045); x.fill(); x.restore();
      cut(x, w, o.shape, M * 0.03);
      var cy = H - bh / 2;
      text(x, t.names, { font: 'Secular One', weight: 400, size: M * 0.11, color: '#ffffff', x: W / 2, y: cy - bh * 0.1, maxW: W * 0.7, shadow: 'rgba(0,0,0,.3)' });
      text(x, [t.greet, t.date].filter(Boolean).join(' · '), { font: 'Heebo', weight: 700, size: M * 0.034, color: alpha('#ffffff', 0.92), x: W / 2, y: cy + bh * 0.26, maxW: W * 0.75 });
    } },
    { id: 'polaroid', name: 'פולרויד', shapes: ['round'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), m = M * 0.06, bh = band(W, H, M, 0.23);
      x.fillStyle = '#FFFEFB'; x.fillRect(0, 0, W, H);
      var r = rand(3); for (var i = 0; i < 2600; i++) { x.fillStyle = 'rgba(0,0,0,' + (r() * 0.025) + ')'; x.fillRect(r() * W, r() * H, 2, 2); }
      var w = { x: m, y: m, w: W - 2 * m, h: H - m - bh }; cut(x, w, 'round', M * 0.004);
      x.save(); x.fillStyle = alpha(p.soft, 0.75); [[W * 0.18, -0.2], [W * 0.82, 0.2]].forEach(function (s) { x.save(); x.translate(s[0], m * 0.55); x.rotate(s[1]); x.fillRect(-M * 0.09, -M * 0.025, M * 0.18, M * 0.05); x.restore(); }); x.restore();
      var cy = H - bh / 2;
      text(x, t.names, { font: 'Amatic SC', weight: 700, size: M * 0.14, color: p.ink, x: W / 2, y: cy - bh * 0.08, maxW: W * 0.78 });
      orn(x, t.orn || 'heart', p.accent, W - m * 1.6, cy + bh * 0.24, M * 0.07);
      text(x, t.date, { font: 'Amatic SC', weight: 700, size: M * 0.06, color: alpha(p.ink, 0.7), x: W / 2, y: cy + bh * 0.27, maxW: W * 0.5 });
    } },
    { id: 'magazine', name: 'שער מגזין', shapes: ['round'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H);
      x.clearRect(0, 0, W, H);
      var top = x.createLinearGradient(0, 0, 0, H * 0.3); top.addColorStop(0, 'rgba(0,0,0,.6)'); top.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = top; x.fillRect(0, 0, W, H * 0.3);
      var bot = x.createLinearGradient(0, H * 0.72, 0, H); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = bot; x.fillRect(0, H * 0.72, W, H * 0.28);
      text(x, t.names, { font: 'Heebo', weight: 900, size: M * 0.15, color: '#ffffff', x: W / 2, y: M * 0.12, maxW: W * 0.9, shadow: 'rgba(0,0,0,.35)' });
      x.fillStyle = p.accent; x.fillRect(W * 0.38, M * 0.21, W * 0.24, M * 0.01);
      text(x, t.greet || (FS.event ? FS.event(t.type).name : ''), { font: 'Heebo', weight: 700, size: M * 0.045, color: '#ffffff', x: W - M * 0.06, y: H - M * 0.1, maxW: W * 0.55, align: 'right' });
      text(x, t.date, { font: 'Heebo', weight: 500, size: M * 0.036, color: alpha('#ffffff', 0.85), x: M * 0.06, y: H - M * 0.1, maxW: W * 0.35, align: 'left', spacing: M * 0.004 });
      x.strokeStyle = alpha('#ffffff', 0.85); x.lineWidth = M * 0.004; x.strokeRect(M * 0.03, M * 0.03, W - M * 0.06, H - M * 0.06);
    } },
    { id: 'invite', name: 'מתוך ההזמנה', needs: 'inv', shapes: ['round'], draw: function (x, W, H, p, t, o) {
      var M = Math.min(W, H), r = FS.frameFromInvite(o.inv, W, H, { accent: p.accent, text: 0.14 });
      x.drawImage(r.canvas, 0, 0);
      var y0 = r.window.y + r.window.h, y1 = H - r.window.y + M * 0.01, cy = (y0 + y1) / 2;
      text(x, t.names, { font: 'Frank Ruhl Libre', weight: 800, size: M * 0.085, color: p.ink, x: W / 2, y: cy - (y1 - y0) * 0.14, maxW: W * 0.78 });
      text(x, [t.date, t.greet].filter(Boolean).join(' · '), { font: 'Heebo', weight: 500, size: M * 0.03, color: alpha(p.ink, 0.75), x: W / 2, y: cy + (y1 - y0) * 0.24, maxW: W * 0.78 });
    } }
  ];

  /* ---------- the screen ---------- */
  var ST = null, SAMPLE = null;
  function fmtDate(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : ''; }
  function events(c) {
    var today = new Date().toISOString().slice(0, 10), out = [];
    (c.deals() || []).filter(function (d) { return d && !d.cancelled && d.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 12).forEach(function (d) {
      out.push({ key: 'd-' + d.id, names: d.names || (d.client || {}).name || '', date: d.date, type: d.type || 'wedding', who: (d.client || {}).name || '', phone: (d.client || {}).phone || '', src: 'עסקה' + (d.no ? ' ' + d.no : '') });
    });
    (c.requests() || []).filter(function (r) { return r.status !== 'declined' && r.date >= today && !r.dealId; }).slice(0, 8).forEach(function (r) {
      out.push({ key: 'r-' + r.id, names: r.names || r.name || '', date: r.date, type: r.type || 'wedding', who: r.name || '', phone: r.phone || '', src: 'בקשה ' + (r.ref || '') });
    });
    return out;
  }
  function texts() { var e = FS.event ? FS.event(ST.type) : {}; return { names: ST.names || e.names || '', date: ST.showDate ? fmtDate(ST.date) : '', greet: ST.showGreet ? ST.greet : '', orn: EV_ORN[ST.type], type: ST.type }; }
  function render(design, scale, shape, pal) {
    var sz = SIZES[ST.size], W = Math.round(sz[0] * scale), H = Math.round(sz[1] * scale), c = FS.canvas ? FS.canvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    design.draw(x, W, H, pal, texts(), { shape: shape || design.shapes[0], inv: ST.inv });
    return c;
  }
  function withPhoto(frame) {
    var c = FS.canvas(frame.width, frame.height), x = c.getContext('2d');
    if (SAMPLE && SAMPLE.complete && SAMPLE.naturalWidth) { var k = Math.max(c.width / SAMPLE.naturalWidth, c.height / SAMPLE.naturalHeight), w = SAMPLE.naturalWidth * k, h = SAMPLE.naturalHeight * k; x.drawImage(SAMPLE, (c.width - w) / 2, (c.height - h) / 2, w, h); }
    else { x.fillStyle = '#c9c3b8'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(frame, 0, 0); return c;
  }
  function list() { return DESIGNS.filter(function (d) { return d.needs !== 'inv' || ST.inv; }).sort(function (a, b) { var party = /birthday|barmitzvah/.test(ST.type); return party ? (b.id === 'party') - (a.id === 'party') : (b.id === 'invite') - (a.id === 'invite'); }); }

  FS.frameAuto = function (m, ctx) {
    var ACC = FS.account, evs = events(ctx), pick = FS.frameAutoPick; FS.frameAutoPick = null;
    var first = evs.filter(function (e) { return pick && (e.key === 'd-' + pick || e.key === 'r-' + pick); })[0] || evs[0] || null;
    ST = { ev: first, names: first ? first.names : '', date: first ? first.date : '', type: first ? first.type : 'wedding', greet: '', showDate: true, showGreet: true, inv: null, invPal: null, size: '10x15', pal: 0, open: null, shape: null };
    var E = FS.EVENTS || [];
    ST.greet = ((FS.event ? FS.event(ST.type) : {}).greet || [''])[0];
    if (!SAMPLE) { SAMPLE = new Image(); SAMPLE.src = 'media/demo/couple.jpg'; }
    ctx.head(m, '🎨 עיצוב מסגרת', 'מסגרת מגנט מוכנה מההזמנה: בוחרים אירוע, ואם יש, מצלמים את ההזמנה. שמונה עיצובים נוצרים מיד, ומה שבוחרים נשלח לסטודיו או ללקוח.');
    m.insertAdjacentHTML('beforeend',
      '<section class="adm-card fa-ev"><h3>1 · האירוע</h3>' +
      (evs.length ? '<div class="fa-evs" role="list">' + evs.map(function (e) { return '<button type="button" role="listitem" data-ev="' + esc(e.key) + '"' + (first && e.key === first.key ? ' class="on"' : '') + '><b>' + esc(e.names || e.who || 'אירוע') + '</b><small>' + esc(fmtDate(e.date)) + ' · ' + esc((FS.event ? FS.event(e.type).name : e.type)) + '</small><small>' + esc(e.src) + '</small></button>'; }).join('') + '<button type="button" data-ev="">✍️<b>אירוע אחר</b><small>מקלידים ידנית</small></button></div>' : '<p class="hint">אין אירועים קרובים בעסקאות ובבקשות. ממלאים כאן את הפרטים.</p>') +
      '<div class="fa-fields"><label>שמות על המסגרת<input id="fa-names" maxlength="40" placeholder="נועה & דניאל"></label><label>תאריך<input id="fa-date" type="date"></label>' +
      '<label>סוג האירוע<select id="fa-type">' + E.map(function (e) { return '<option value="' + e.id + '">' + e.icon + ' ' + e.name + '</option>'; }).join('') + '</select></label>' +
      '<label>שורת ברכה<select id="fa-greet"></select></label></div></section>' +
      '<section class="adm-card fa-inv"><h3>2 · ההזמנה <small>(לא חובה)</small></h3><div class="fa-inv-row"><label class="btn gold small fa-up">📷 צילום או העלאה של ההזמנה<input type="file" id="fa-file" accept="image/*" hidden></label><div id="fa-inv-th"></div></div>' +
      '<p class="hint">הצבעים של ההזמנה עוברים לכל העיצובים, ונוסף עיצוב שבנוי מהמסגרת של ההזמנה עצמה.</p></section>' +
      '<section class="adm-card"><div class="fa-bar"><h3>3 · העיצובים</h3><div class="seg" id="fa-size">' + Object.keys(SIZES).map(function (k) { return '<button type="button" data-z="' + k + '"' + (k === ST.size ? ' class="on"' : '') + '>' + SIZES[k][2] + '</button>'; }).join('') + '</div></div>' +
      '<div class="fa-pals" id="fa-pals"></div><div class="fa-grid" id="fa-grid"></div></section><div id="fa-one"></div>');
    function fill() {
      $('#fa-names').value = ST.names; $('#fa-date').value = ST.date || ''; $('#fa-type').value = ST.type;
      var g = (FS.event ? FS.event(ST.type).greet : []) || []; if (g.indexOf(ST.greet) < 0) ST.greet = g[0] || '';
      $('#fa-greet').innerHTML = g.map(function (s) { return '<option' + (s === ST.greet ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '<option value="">בלי ברכה</option>';
    }
    var tm = null; function soon() { clearTimeout(tm); tm = setTimeout(draw, 180); }
    function pals() { var l = palettes(ST); if (ST.pal >= l.length) ST.pal = 0; $('#fa-pals').innerHTML = l.map(function (p, i) { return '<button type="button" data-p="' + i + '" class="' + (i === ST.pal ? 'on' : '') + '" title="' + esc(p.name) + '"><i style="background:linear-gradient(135deg,' + p.paper + ' 0 34%,' + p.accent + ' 34% 70%,' + p.soft + ' 70%)"></i>' + esc(p.name) + '</button>'; }).join(''); return l; }
    function draw() {
      var l = pals(), p = l[ST.pal], grid = $('#fa-grid'); if (!grid) return;
      grid.innerHTML = list().map(function (d) { return '<button type="button" class="fa-t" data-d="' + d.id + '"><span class="fa-cv"></span><b>' + d.name + '</b></button>'; }).join('');
      var ds = list(), i = 0;
      (function next() {   /* one at a time, so the screen stays smooth on a phone */
        if (i >= ds.length || !$('#fa-grid')) return; var d = ds[i++], el = $('.fa-t[data-d="' + d.id + '"] .fa-cv');
        try { var c = withPhoto(render(d, 0.32, null, p)); if (el) el.appendChild(c); } catch (e) { if (el) el.textContent = '—'; }
        setTimeout(next, 16);
      })();
      if (ST.open) one(ST.open);
    }
    function one(id) {
      ST.open = id; var d = DESIGNS.filter(function (x) { return x.id === id; })[0], box = $('#fa-one'); if (!d || !box) return;
      if (!ST.shape || d.shapes.indexOf(ST.shape) < 0) ST.shape = d.shapes[0];
      var p = palettes(ST)[ST.pal];
      box.innerHTML = '<section class="adm-card fa-big"><div class="fa-bar"><h3>' + esc(d.name) + '</h3><button type="button" class="btn line small" id="fa-x">✕</button></div>' +
        '<div class="fa-stage"><div id="fa-cv"></div><div class="fa-side">' +
        (d.shapes.length > 1 ? '<b>צורת החלון</b><div class="seg" id="fa-shape">' + d.shapes.map(function (s) { return '<button type="button" data-s="' + s + '"' + (s === ST.shape ? ' class="on"' : '') + '>' + { round: 'מלבן', arch: 'קשת', oval: 'אליפסה' }[s] + '</button>'; }).join('') + '</div>' : '') +
        '<label class="fa-chk"><input type="checkbox" id="fa-sd"' + (ST.showDate ? ' checked' : '') + '> התאריך על המסגרת</label><label class="fa-chk"><input type="checkbox" id="fa-sg"' + (ST.showGreet ? ' checked' : '') + '> שורת הברכה</label>' +
        '<div class="fa-acts"><button type="button" class="btn gold" id="fa-send">🖼️ שליחה לסטודיו</button><button type="button" class="btn line" id="fa-share">💬 שליחה ללקוח</button><button type="button" class="btn line" id="fa-dl">⬇ הורדה PNG</button></div>' +
        '<p class="hint">בסטודיו: "🎉 אירוע חי" ← "🎨 עיצובים מאושרים של לקוחות". הקובץ ב־300 dpi, עם חלון שקוף.</p></div></div></section>';
      $('#fa-cv').appendChild(withPhoto(render(d, 0.5, ST.shape, p)));
      $('#fa-x').addEventListener('click', function () { ST.open = null; box.innerHTML = ''; });
      $$('#fa-shape [data-s]').forEach(function (b) { b.addEventListener('click', function () { ST.shape = b.dataset.s; one(id); }); });
      $('#fa-sd').addEventListener('change', function () { ST.showDate = this.checked; draw(); });
      $('#fa-sg').addEventListener('change', function () { ST.showGreet = this.checked; draw(); });
      function full() { return render(d, 1, ST.shape, palettes(ST)[ST.pal]); }
      function fname() { return 'מסגרת-' + String(ST.names || 'אירוע').replace(/[^\w֐-׿]+/g, '-').slice(0, 30) + '-' + d.id + '.png'; }
      function blob(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }
      $('#fa-dl').addEventListener('click', function () { FS.busy && FS.busy('מכין קובץ…'); var c = full(); blob(c).then(function (b) { FS.busy && FS.busy(); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname(); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }); });
      $('#fa-share').addEventListener('click', function () {
        var prev = withPhoto(render(d, 0.6, ST.shape, palettes(ST)[ST.pal])), msg = 'שלום' + (ST.ev && ST.ev.who ? ' ' + ST.ev.who : '') + ', זה העיצוב של המגנטים לאירוע שלכם' + (ST.date ? ' (' + fmtDate(ST.date) + ')' : '') + ' 🧲 מה דעתכם?';
        prev.toBlob(function (b) {
          var f = new File([b], 'עיצוב-מגנט.jpg', { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: msg }).catch(function () {});
          else { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'עיצוב-מגנט.jpg'; a.click(); var ph = ST.ev && ST.ev.phone; if (ph) window.open('https://wa.me/' + ph.replace(/\D/g, '').replace(/^0/, '972') + '?text=' + encodeURIComponent(msg + '\n(התמונה ירדה למכשיר: מצרפים אותה בהודעה)'), '_blank', 'noopener'); }
        }, 'image/jpeg', 0.88);
      });
      $('#fa-send').addEventListener('click', function () {
        if (!ACC || !ACC.call) return; FS.busy && FS.busy('שולח לסטודיו…');
        var c = full(), url = c.toDataURL('image/png');
        if (url.length > 4100000) { var k = Math.sqrt(4000000 / url.length), s = FS.canvas(Math.round(c.width * k), Math.round(c.height * k)); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); url = s.toDataURL('image/png'); }
        var pv = withPhoto(render(d, 0.4, ST.shape, palettes(ST)[ST.pal])), th = FS.canvas(160, Math.round(160 * pv.height / pv.width)); th.getContext('2d').drawImage(pv, 0, 0, th.width, th.height);
        var id = ('fa-' + (ST.ev ? ST.ev.key : 'x' + Date.now().toString(36))).replace(/[^\w-]/g, '').slice(0, 46);
        ACC.call('design-save', { design: { id: id, name: 'מסגרת · ' + (ST.names || 'אירוע'), names: ST.names, type: ST.type, date: ST.date, fmt: ST.size, auto: d.id, thumb: th.toDataURL('image/jpeg', 0.7) } }).then(function (r) {
          if (!r.ok) throw r;
          return ACC.call('design-approve', { id: id, frame: url, preview: pv.toDataURL('image/jpeg', 0.82), eventDate: ST.date || '', phone: (ST.ev && ST.ev.phone) || '', note: 'עוצב בניהול · ' + d.name });
        }).then(function (r) { FS.busy && FS.busy(); if (!r.ok) throw r; FS.toast('✔ נשלח לסטודיו: "🎉 אירוע חי" ← "🎨 עיצובים מאושרים של לקוחות"', 6000); },
          function (r) { FS.busy && FS.busy(); FS.toast('לא נשלח: ' + (ACC.msg ? ACC.msg(r || {}) : 'שגיאה'), 6000); });
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ev]');
      if (b) { $$('.fa-evs [data-ev]').forEach(function (x) { x.classList.toggle('on', x === b); }); var ev = evs.filter(function (x) { return x.key === b.dataset.ev; })[0] || null; ST.ev = ev; if (ev) { ST.names = ev.names; ST.date = ev.date; ST.type = ev.type; } else { ST.names = ''; ST.date = ''; $('#fa-names').focus(); } fill(); soon(); return; }
      var z = e.target.closest('#fa-size [data-z]'); if (z) { ST.size = z.dataset.z; $$('#fa-size [data-z]').forEach(function (x) { x.classList.toggle('on', x === z); }); soon(); return; }
      var pp = e.target.closest('#fa-pals [data-p]'); if (pp) { ST.pal = Number(pp.dataset.p); soon(); return; }
      var t = e.target.closest('.fa-t'); if (t) { one(t.dataset.d); }
    });
    $('#fa-names').addEventListener('input', function () { ST.names = this.value.trim(); soon(); });
    $('#fa-date').addEventListener('change', function () { ST.date = this.value; soon(); });
    $('#fa-type').addEventListener('change', function () { ST.type = this.value; ST.greet = ''; fill(); soon(); });
    $('#fa-greet').addEventListener('change', function () { ST.greet = this.value; soon(); });
    $('#fa-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return; var img = new Image();
      img.onload = function () { ST.inv = img; try { ST.invPal = FS.invitePalette ? FS.invitePalette(img, 6) : null; } catch (e) { ST.invPal = null; } ST.pal = 0; $('#fa-inv-th').innerHTML = '<img alt="ההזמנה" src="' + img.src + '"><button type="button" class="btn line small" id="fa-inv-x">הסרה</button>'; $('#fa-inv-x').addEventListener('click', function () { ST.inv = null; ST.invPal = null; ST.pal = 0; $('#fa-inv-th').innerHTML = ''; if (ST.open === 'invite') { ST.open = null; $('#fa-one').innerHTML = ''; } draw(); }); draw(); };
      img.src = URL.createObjectURL(f);
    });
    fill();
    /* the fonts first, so the names are drawn in them */
    var ready = document.fonts && document.fonts.load ? Promise.all(FONTS.map(function (f) { return document.fonts.load('700 40px "' + f + '"').catch(function () {}); })) : Promise.resolve();
    Promise.all([ready, new Promise(function (r) { if (SAMPLE.complete) r(); else { SAMPLE.onload = SAMPLE.onerror = r; } })]).then(draw);
  };
})();
