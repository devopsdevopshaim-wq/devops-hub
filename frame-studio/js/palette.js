/* 🌈 Colours from the invitation: the couple's invitation (or the hall's light, from a photo) gives the magnet its colours.
   The picture's main colours are found (k-means on a small copy), shown as swatches; one tap paints the frame (the ready
   frames take any colour) and, if wanted, the texts. So every magnet looks made for that event. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var host = document.getElementById('frame-color'); if (!host) return;
  var field = host.closest('.field');
  var box = document.createElement('div'); box.className = 'field pal';
  box.innerHTML = '<label>🌈 צבעים מההזמנה</label><div class="pal-row"><label class="btn small">📨 מההזמנה<input type="file" id="pal-file" accept="image/*" hidden></label><button class="btn small" type="button" id="pal-photo">📷 מהתמונה</button></div>' +
    '<div class="pal-sw" id="pal-sw"></div><label class="check"><input type="checkbox" id="pal-text" checked> גם לטקסטים</label>';
  field.parentNode.insertBefore(box, field.nextSibling);

  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function sat(c) { var mx = Math.max.apply(null, c), mn = Math.min.apply(null, c); return mx ? (mx - mn) / mx : 0; }
  /* the main colours of a picture, most present first (near-white and near-black only if they really dominate) */
  function palette(img, k) {
    var s = 72, c = FS.canvas(s, s), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, s, s);
    var d = x.getImageData(0, 0, s, s).data, px = []; for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    k = k || 7; var C = []; for (i = 0; i < k; i++) C.push(px[Math.floor((i + 0.5) * px.length / k)].slice());
    var as = new Array(px.length);
    for (var it = 0; it < 12; it++) {
      var sum = C.map(function () { return [0, 0, 0, 0]; });
      px.forEach(function (p, n) { var b = 0, bd = 1e9; C.forEach(function (q, j) { var dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); as[n] = b; sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++; });
      C = C.map(function (q, j) { return sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : q; });
      C.n = sum.map(function (v) { return v[3]; });
    }
    var out = C.map(function (c2, j) { return { c: c2, n: C.n[j] / px.length }; }).filter(function (o) { return o.n > 0.02 && ((lum(o.c) > 0.08 && lum(o.c) < 0.94) || o.n > 0.3); });
    out.sort(function (a, b) { return (b.n * (0.6 + sat(b.c))) - (a.n * (0.6 + sat(a.c))); });
    var uniq = []; out.forEach(function (o) { if (!uniq.some(function (u) { return Math.abs(u.c[0] - o.c[0]) + Math.abs(u.c[1] - o.c[1]) + Math.abs(u.c[2] - o.c[2]) < 40; })) uniq.push(o); });
    return uniq.slice(0, 6).map(function (o) { return hex(o.c); });
  }
  function show(img) {
    var cs = palette(img), sw = document.getElementById('pal-sw');
    sw.innerHTML = cs.map(function (h) { return '<button type="button" class="pal-c" data-c="' + h + '" style="background:' + h + '" title="' + h + '"></button>'; }).join('');
    FS.toast('🌈 ' + cs.length + ' צבעים מההזמנה. לוחצים על צבע.', 4000);
  }
  document.getElementById('pal-file').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = ''; if (!f) return;
    FS.fileToDataURL(f).then(FS.loadImg).then(show).catch(function () { FS.toast('הקובץ לא נפתח'); });
  });
  document.getElementById('pal-photo').addEventListener('click', function () { var p = FS.cur(); if (!p) return FS.toast('בוחרים תמונה'); var im = FS.img(p.src); if (im) show(im); });
  document.getElementById('pal-sw').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    var p = FS.cur(); if (!p) return;
    if (!p.doc.frame || p.doc.frame.kind !== 'gen') FS.toast('הצבע נכנס למסגרות המוכנות. במסגרת שלכם (PNG) – הטקסטים בלבד.', 4500);
    else { host.value = b.dataset.c; host.dispatchEvent(new Event('input', { bubbles: true })); host.dispatchEvent(new Event('change', { bubbles: true })); }
    if (document.getElementById('pal-text').checked) {
      var dark = lum([parseInt(b.dataset.c.slice(1, 3), 16), parseInt(b.dataset.c.slice(3, 5), 16), parseInt(b.dataset.c.slice(5, 7), 16)]);
      (p.doc.layers || []).forEach(function (L) { if (L.type === 'text' && !L.wishLayer) L.color = dark > 0.75 ? '#5b4a2e' : b.dataset.c; });
    }
    if (FS.snap) FS.snap(p); FS.render(); if (FS.changed) FS.changed();
  });
})();
