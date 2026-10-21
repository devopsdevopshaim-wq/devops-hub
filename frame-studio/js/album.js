/* album.html: the couple's album after the event. Every magnet printed at the event, the photos the guests took and the
   greetings they left (written and voice), with saving one photo or all of them (ZIP). Saved photos carry the business's
   name small in the corner. The link (with its viewing key) comes by email the day after the event, or from the studio. */
(function () {
  'use strict';
  var L = window.FL, esc = L.esc, app = document.getElementById('app'), data = null, list = [], tab = 'all', view = [], vi = 0, srcs = {};

  function fail(t) { app.innerHTML = '<div class="card hero"><p class="brand">📸</p><p class="hello">' + esc(t) + '</p></div>'; }
  if (!L.e || !L.v) { fail('הקישור לאלבום לא שלם.'); return; }

  L.call({ action: 'feed', e: L.e, v: L.v }).then(function (r) {
    if (!r.ok) return fail(L.msg(r));
    data = r; list = r.photos.slice().reverse(); document.title = r.title + ' · האלבום';
    if (r.purged) return fail('התמונות של האירוע הזה כבר נמחקו מהשרת (60 יום אחרי האירוע). מקווים ששמרתם אותן 💛');
    return L.base.then(function (u) { list.forEach(function (p) { srcs[p.id] = u + '/frame-live-img?e=' + L.e + '&p=' + p.id + '&v=' + L.v; }); render(); });
  });

  function wishes() { return list.filter(function (p) { return p.text || p.audio; }); }
  function render() {
    var mags = list.filter(function (p) { return p.src === 'studio'; }).length, guests = list.length - mags, w = wishes().length, B = data.biz || {};
    app.innerHTML =
      '<section class="card hero"><p class="brand">' + esc(B.name || 'פריים מגנטים') + '<small>האלבום מהאירוע</small></p><h1 class="lv-title">' + esc(data.title) + '</h1>' +
        '<p class="hello">' + esc(L.heDate(data.date)) + '</p></section>' +
      '<div class="al-stats"><span><b>' + mags + '</b> מגנטים</span><span><b>' + guests + '</b> תמונות של אורחים</span><span><b>' + w + '</b> ברכות</span></div>' +
      '<div class="al-tabs" role="tablist">' + [['all', '📸 הכל'], ['mag', '🧲 המגנטים'], ['guest', '🤳 של האורחים'], ['wish', '💌 ספר הברכות']].map(function (t) {
        return '<button role="tab" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="gtools"><button class="gbtn main" id="zip">⬇️ שמירת כל התמונות (ZIP)</button>' + (tab === 'wish' ? '<button class="gbtn" id="print">🖨️ הדפסת ספר הברכות</button>' : '') +
        '<button class="gbtn" id="share">💬 שיתוף בוואטסאפ</button></div>' +
      '<div id="body"></div>' +
      (B.google ? '<section class="card al-review"><h2>נהניתם מהמגנטים? 💛</h2><p>המלצה קצרה בגוגל עוזרת לנו מאוד, ולוקחת דקה.</p><a class="gbtn" href="' + esc(B.google) + '" target="_blank" rel="noopener">⭐ כתיבת המלצה</a></section>' : '') +
      '<section class="card cta"><h2>רוצים מגנטים גם באירוע שלכם? 🧲</h2><a class="gbtn main" href="./">' + esc(B.name || 'פריים מגנטים') + '</a></section>';
    Array.prototype.forEach.call(app.querySelectorAll('[data-t]'), function (b) { b.addEventListener('click', function () { tab = b.dataset.t; render(); }); });
    document.getElementById('zip').addEventListener('click', zipAll);
    document.getElementById('share').addEventListener('click', function () { window.open('https://wa.me/?text=' + encodeURIComponent('📸 התמונות והברכות מ' + data.title + ':\n' + location.href), '_blank', 'noopener'); });
    var pr = document.getElementById('print'); if (pr) pr.addEventListener('click', function () { window.print(); });
    var body = document.getElementById('body');
    if (tab === 'wish') {
      var ws = wishes();
      body.innerHTML = ws.length ? '<div class="wishes">' + ws.map(function (p) {
        return '<article class="wish"><img src="' + srcs[p.id] + '" alt="" loading="lazy" data-id="' + p.id + '">' + (p.text ? '<p>' + esc(p.text) + '</p>' : '') + (p.name ? '<b>— ' + esc(p.name) + '</b>' : '') +
          (p.audio ? '<audio controls preload="none" src="' + srcs[p.id] + '&a=1"></audio>' : '') + '</article>'; }).join('') + '</div>' : '<div class="card load">עוד אין ברכות.</div>';
      view = ws;
    } else {
      view = list.filter(function (p) { return tab === 'all' || (tab === 'mag' ? p.src === 'studio' : p.src === 'guest'); });
      body.innerHTML = view.length ? '<div class="ggrid">' + view.map(function (p) {
        return '<button data-id="' + p.id + '" aria-label="פתיחה"><img src="' + srcs[p.id] + '" alt="" loading="lazy">' + (p.text || p.audio ? '<span class="tag">' + (p.audio ? '🎙️' : '💌') + (p.name ? ' ' + esc(p.name) : '') + '</span>' : '') + '</button>'; }).join('') + '</div>'
        : '<div class="card load">עוד אין כאן תמונות.</div>';
    }
    Array.prototype.forEach.call(body.querySelectorAll('[data-id]'), function (b) { b.addEventListener('click', function () { open(view.map(function (p) { return p.id; }).indexOf(b.dataset.id)); }); });
  }

  /* ---------- the viewer ---------- */
  var dlg = document.getElementById('view');
  function open(n) { if (n < 0) return; vi = n; show(); if (!dlg.open) dlg.showModal(); }
  function show() {
    var p = view[vi]; if (!p) return;
    document.getElementById('view-img').src = srcs[p.id];
    document.getElementById('v-wish').textContent = (p.text ? '“' + p.text + '”' : '') + (p.name ? ' — ' + p.name : '');
  }
  document.getElementById('v-prev').addEventListener('click', function () { vi = (vi - 1 + view.length) % view.length; show(); });
  document.getElementById('v-next').addEventListener('click', function () { vi = (vi + 1) % view.length; show(); });
  document.getElementById('v-x').addEventListener('click', function () { dlg.close(); });
  document.getElementById('v-dl').addEventListener('click', function () { var p = view[vi]; marked(p).then(function (b) { save(b, name(p, vi)); }); });
  document.addEventListener('keydown', function (e) { if (!dlg.open) return; if (e.key === 'ArrowLeft') document.getElementById('v-next').click(); if (e.key === 'ArrowRight') document.getElementById('v-prev').click(); });

  /* ---------- saving: the business's name small in the corner ---------- */
  function name(p, n) { return (p.src === 'studio' ? 'מגנט' : 'אורח') + ' ' + String(n + 1).padStart(3, '0') + (p.name ? ' - ' + p.name.replace(/[\\/:*?"<>|]/g, '') : '') + '.jpg'; }
  function marked(p) {
    return fetch(srcs[p.id]).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); }).then(function (b) {
      if (!window.createImageBitmap) return b;
      return createImageBitmap(b).then(function (bm) {
        var c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; var x = c.getContext('2d'); x.drawImage(bm, 0, 0);
        var t = (data.biz && data.biz.name) || '', fz = Math.max(12, Math.round(Math.min(c.width, c.height) * 0.024));
        if (t) { x.font = '600 ' + fz + 'px Heebo, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'bottom'; x.direction = 'rtl'; x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = fz * 0.4; x.fillStyle = 'rgba(255,255,255,.88)'; x.fillText('🧲 ' + t, fz * 0.8, c.height - fz * 0.6); }
        return new Promise(function (ok) { c.toBlob(function (o) { ok(o || b); }, 'image/jpeg', 0.93); });
      }).catch(function () { return b; });
    });
  }
  function save(blob, fn) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data);
      var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + f.data.length;
    });
    var size = central.reduce(function (s, a) { return s + a.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }
  function zipAll() {
    var b = document.getElementById('zip'), files = [], items = list.slice();
    if (!items.length) return L.toast('אין עדיין תמונות');
    b.disabled = true;
    items.reduce(function (ch, p, n) {
      return ch.then(function () { b.textContent = 'מכין… ' + (n + 1) + ' / ' + items.length; return marked(p); })
        .then(function (bl) { return bl.arrayBuffer(); }).then(function (ab) { files.push({ name: name(p, n), data: new Uint8Array(ab) }); }).catch(function () { /* skip one that failed */ });
    }, Promise.resolve()).then(function () {
      var txt = wishes().filter(function (p) { return p.text; }).map(function (p) { return (p.name || 'אורח') + ':\n' + p.text; }).join('\n\n');
      if (txt) files.push({ name: 'ספר הברכות.txt', data: new TextEncoder().encode('﻿' + data.title + '\n\n' + txt) });
      save(zip(files), data.title.replace(/[\\/:*?"<>|]/g, '') + '.zip');
      b.disabled = false; b.textContent = '⬇️ שמירת כל התמונות (ZIP)';
    });
  }
})();
