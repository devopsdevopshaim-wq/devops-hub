/* The business site: details from business.json, magnets drawn live with the studio's own engine (hero fridge,
   gallery, the visitor's designer), packages, FAQ and WhatsApp contact. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var BIZ = { name: 'פריים מגנטים', tagline: '', whatsapp: '', phone: '', email: '', instagram: '', facebook: '', areas: '', hours: '', packages: [], faq: [], events: [] };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function waNumber() { var n = String(BIZ.whatsapp || BIZ.phone || '').replace(/\D/g, ''); if (n.charAt(0) === '0') n = '972' + n.slice(1); return n; }
  function waLink(text) { return 'https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(text); }
  function openWa(text) { window.open(waLink(text), '_blank', 'noopener'); }

  /* ---------- a magnet as a canvas ---------- */
  var sceneCache = {};
  function sceneSrc(kind, fmt, seed) {
    var key = kind + fmt + seed; if (sceneCache[key]) return sceneCache[key];
    var f = FS.fmt(fmt), long = 900, w = f.w >= f.h ? long : Math.round(long * f.w / f.h), h = f.w >= f.h ? Math.round(long * f.h / f.w) : long;
    return (sceneCache[key] = FS.sampleScene(kind, w, h, seed).toDataURL('image/jpeg', 0.9));
  }
  function magnet(o, size) {
    var ev = FS.event(o.type);
    return FS.photoFrom(o.photo || sceneSrc(o.scene || ev.scene, o.fmt || 'magnet', o.seed || 3), o.fmt || 'magnet').then(function (p) {
      FS.buildMagnet(p, o);
      var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k * 2, d.h * k * 2);
      FS.draw(c.getContext('2d'), p, { scale: k * 2, max: 1200, export: true });
      c.style.width = Math.round(d.w * k) + 'px'; c.style.height = Math.round(d.h * k) + 'px';
      return c;
    });
  }
  function fontsFor(list) { return Promise.all(list.map(function (f) { return document.fonts ? document.fonts.load('700 40px "' + f + '"').catch(function () {}) : null; })).then(function () { return document.fonts && document.fonts.ready; }); }

  /* ---------- hero fridge ---------- */
  function hero() {
    var box = $('#hero-mags'); if (!box) return;
    var picks = [
      { type: 'wedding', names: 'נועה & דניאל', date: '2026-06-12', frame: 'classic', seed: 3 },
      { type: 'barmitzvah', names: 'יונתן', date: '2026-03-20', frame: 'stars', seed: 5 },
      { type: 'wedding', names: 'שירה & עומר', date: '2026-08-04', frame: 'floral', color: '#e9a8a6', seed: 9 },
      { type: 'birthday', names: 'מאיה 30', date: '2026-05-02', frame: 'polaroid', fmt: 'm66', seed: 4 },
      { type: 'brit', names: 'ברוך הבא אריאל', date: '2026-01-15', frame: 'boho', color: '#a3b18a', seed: 6 }
    ];
    var pos = [[5, 4, -6], [60, 3, 5], [33, 27, -2], [7, 54, 4], [61, 53, -5]];
    picks.forEach(function (o, i) {
      magnet(o, 230).then(function (c) {
        var m = document.createElement('div'); m.className = 'mag'; m.style.cssText = 'right:' + pos[i][0] + '%;top:' + pos[i][1] + '%;--r:' + pos[i][2] + 'deg;--d:' + (i * 0.12) + 's';
        m.appendChild(c); box.appendChild(m);
      });
    });
  }

  /* ---------- gallery ---------- */
  var GAL = [];
  FS.EVENTS.forEach(function (ev, i) {
    ev.frames.slice(0, 3).forEach(function (fr, k) { GAL.push({ type: ev.id, names: ev.names, date: '2026-0' + ((i + k) % 9 + 1) + '-1' + k, frame: fr, color: k ? ev.palette[k % ev.palette.length] : ev.color, seed: i * 3 + k + 2, fmt: k === 2 ? 'm66' : 'magnet' }); });
  });
  function gallery(type) {
    var g = $('#gallery-grid'); g.innerHTML = '';
    GAL.filter(function (o) { return !type || o.type === type; }).slice(0, type ? 9 : 12).forEach(function (o) {
      var fig = document.createElement('figure'); fig.className = 'g-item';
      var cap = document.createElement('figcaption'); cap.innerHTML = '<b>' + esc(FS.event(o.type).name) + '</b><span>' + esc((FS.GEN_FRAMES.filter(function (f) { return f.id === o.frame; })[0] || {}).name || '') + '</span>';
      var use = document.createElement('button'); use.className = 'btn small line'; use.textContent = 'לעצב כזה ←';
      use.addEventListener('click', function () { $('#d-type').value = o.type; syncTypeOptions(); $('#d-frame').value = o.frame; $('#d-color').value = o.color; drawDesigner(); $('#designer').scrollIntoView({ behavior: 'smooth' }); });
      fig.appendChild(cap); fig.appendChild(use); g.appendChild(fig);
      magnet(o, 250).then(function (c) { var w = document.createElement('div'); w.className = 'mag-w'; w.appendChild(c); fig.insertBefore(w, cap); });
    });
  }
  function galleryFilter() {
    var f = $('#gal-filter');
    f.innerHTML = '<button class="on" data-t="">הכול</button>' + FS.EVENTS.map(function (e) { return '<button data-t="' + e.id + '">' + e.icon + ' ' + e.name + '</button>'; }).join('');
    $$('button', f).forEach(function (b) { b.addEventListener('click', function () { $$('button', f).forEach(function (x) { x.classList.toggle('on', x === b); }); gallery(b.dataset.t); }); });
  }

  /* ---------- the visitor's designer ---------- */
  var userPhoto = '', drawT = null;
  function syncTypeOptions() {
    var ev = FS.event($('#d-type').value);
    $('#d-frame').innerHTML = ev.frames.concat(FS.GEN_FRAMES.map(function (f) { return f.id; }).filter(function (id) { return ev.frames.indexOf(id) < 0 && !/insta|magazine|film/.test(id); }))
      .map(function (id) { var f = FS.GEN_FRAMES.filter(function (x) { return x.id === id; })[0]; return f ? '<option value="' + id + '">' + f.name + '</option>' : ''; }).join('');
    $('#d-swatches').innerHTML = ev.palette.map(function (c) { return '<button type="button" style="--c:' + c + '" data-c="' + c + '" aria-label="צבע ' + c + '"></button>'; }).join('');
    $$('#d-swatches button').forEach(function (b) { b.addEventListener('click', function () { $('#d-color').value = b.dataset.c; drawDesigner(); }); });
    $('#d-color').value = ev.color; $('#d-font').value = ev.font;
    if (!$('#d-names').dataset.touched) $('#d-names').value = ev.names;
  }
  function designerOpts() { return { type: $('#d-type').value, names: $('#d-names').value.trim(), date: $('#d-date').value, frame: $('#d-frame').value, color: $('#d-color').value, font: $('#d-font').value, photo: userPhoto, seed: 3, fmt: 'magnet' }; }
  function drawDesigner() {
    clearTimeout(drawT);
    drawT = setTimeout(function () {
      var o = designerOpts();
      fontsFor([o.font]).then(function () { return magnet(o, 360); }).then(function (c) {
        var old = $('#d-canvas'); c.id = 'd-canvas'; c.setAttribute('aria-label', 'הדמיית המגנט'); old.replaceWith(c);
      });
    }, 120);
  }
  function designer() {
    $('#d-type').innerHTML = FS.EVENTS.map(function (e) { return '<option value="' + e.id + '">' + e.icon + ' ' + e.name + '</option>'; }).join('');
    $('#d-font').innerHTML = FS.FONTS.map(function (f) { return '<option value="' + f[0] + '" style="font-family:\'' + f[0] + '\'">' + f[1] + '</option>'; }).join('');
    var dt = new Date(Date.now() + 1000 * 3600 * 24 * 60); $('#d-date').value = dt.toISOString().slice(0, 10);
    syncTypeOptions();
    $('#d-type').addEventListener('change', function () { syncTypeOptions(); drawDesigner(); });
    $('#d-names').addEventListener('input', function () { this.dataset.touched = 1; drawDesigner(); });
    ['#d-date', '#d-frame', '#d-color', '#d-font'].forEach(function (s) { $(s).addEventListener('input', drawDesigner); $(s).addEventListener('change', drawDesigner); });
    $('#d-photo').addEventListener('change', function () { var f = this.files[0]; if (!f) return; FS.fileToDataURL(f).then(function (u) { userPhoto = u; drawDesigner(); }); });
    $('#d-dl').addEventListener('click', function () { var c = $('#d-canvas'); c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'magnet-design.png'; a.click(); }, 'image/png'); });
    $('#d-send').addEventListener('click', function () {
      var o = designerOpts(), ev = FS.event(o.type), fr = (FS.GEN_FRAMES.filter(function (f) { return f.id === o.frame; })[0] || {}).name;
      var text = 'שלום! עיצבתי מגנט באתר ואשמח להצעת מחיר 🧲\nאירוע: ' + ev.name + '\nשמות: ' + o.names + '\nתאריך: ' + FS.fmtDate(o.date) + '\nמסגרת: ' + fr + ' · צבע ' + o.color;
      var c = $('#d-canvas');
      c.toBlob(function (b) {
        var file = new File([b], 'magnet-design.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) navigator.share({ files: [file], text: text }).catch(function () { openWa(text); });
        else openWa(text + '\n(ההדמיה נשמרה אצלי ואשלח אותה כאן)');
      }, 'image/png');
    });
    drawDesigner();
  }

  /* ---------- packages, faq, contact ---------- */
  function fill() {
    $$('[data-biz]').forEach(function (e) { if (BIZ[e.dataset.biz]) e.textContent = BIZ[e.dataset.biz]; });
    document.title = BIZ.name + ' · מגנטים לאירועים';
    $('#pk').innerHTML = (BIZ.packages || []).map(function (p) {
      return '<article class="pk' + (p.featured ? ' star' : '') + '">' + (p.featured ? '<span class="ribbon">הכי מוזמנת</span>' : '') +
        '<h3>' + esc(p.name) + '</h3><p class="price">' + esc(p.price) + '</p><p class="meta">' + esc(p.hours) + ' · ' + esc(p.magnets) + '</p><ul>' +
        (p.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul><button class="btn ' + (p.featured ? 'gold' : 'line') + '" data-pk="' + esc(p.name) + '">לבדוק תאריך לחבילה</button></article>';
    }).join('');
    $$('[data-pk]').forEach(function (b) { b.addEventListener('click', function () { openWa('שלום! מתעניין/ת בחבילת "' + b.dataset.pk + '" למגנטים לאירוע. אפשר לבדוק תאריך?'); }); });
    $('#faq-list').innerHTML = (BIZ.faq || []).map(function (q, i) { return '<details' + (i ? '' : ' open') + '><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('');
    var ct = [];
    if (BIZ.phone) ct.push('<li>📞 <a href="tel:' + esc(BIZ.phone) + '">' + esc(BIZ.phone) + '</a></li>');
    if (waNumber()) ct.push('<li>💬 <a href="' + waLink('שלום!') + '" target="_blank" rel="noopener">וואטסאפ</a></li>');
    if (BIZ.email) ct.push('<li>✉️ <a href="mailto:' + esc(BIZ.email) + '">' + esc(BIZ.email) + '</a></li>');
    if (BIZ.instagram) ct.push('<li>📸 <a href="' + esc(BIZ.instagram) + '" target="_blank" rel="noopener">אינסטגרם</a></li>');
    if (BIZ.facebook) ct.push('<li>👍 <a href="' + esc(BIZ.facebook) + '" target="_blank" rel="noopener">פייסבוק</a></li>');
    if (BIZ.areas) ct.push('<li>📍 ' + esc(BIZ.areas) + '</li>');
    if (BIZ.hours) ct.push('<li>🕘 ' + esc(BIZ.hours) + '</li>');
    $('#c-list').innerHTML = ct.join('');
    var types = (BIZ.events && BIZ.events.length ? BIZ.events : FS.EVENTS.map(function (e) { return e.name; }));
    $('#c-type').innerHTML = types.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
    $('#ticker').innerHTML = new Array(3).join(FS.EVENTS.map(function (e) { return '<span>' + e.icon + ' ' + e.name + '</span><i>✦</i>'; }).join('') + '<span>🧲 מגנט ביד תוך דקה</span><i>✦</i>');
    $$('[data-wa]').forEach(function (a) { a.addEventListener('click', function (e) { if (waNumber()) { e.preventDefault(); openWa(a.dataset.wa); } }); });
    $('#wa-fab').addEventListener('click', function (e) { if (waNumber()) { e.preventDefault(); openWa('שלום! אשמח לשמוע על מגנטים לאירוע 🧲'); } });
  }
  /* ---------- the events library (albums published from the studio) ---------- */
  var ALBUMS = [];
  function albums(type) {
    var box = $('#albums'), list = ALBUMS.filter(function (a) { return !type || a.type === type; });
    if (!ALBUMS.length) { box.innerHTML = '<div class="albums-empty"><span>📸</span><p>כאן יופיעו אלבומים מאירועים אמיתיים, ישר מהסטודיו.</p><a class="btn line" href="#gallery">בינתיים, לעיצובים לדוגמה</a></div>'; return; }
    box.innerHTML = list.map(function (a, i) {
      var ev = FS.event(a.type), imgs = a.images.slice(0, 3);
      return '<button class="album" data-i="' + ALBUMS.indexOf(a) + '"><div class="stack">' + imgs.map(function (im, k) { return '<img loading="lazy" src="' + esc(im.src) + '" alt="" style="--k:' + k + '">'; }).join('') + '</div><b>' + esc(a.title) + '</b><span>' + ev.icon + ' ' + esc(ev.name) + (a.date ? ' · ' + FS.fmtDate(a.date) : '') + ' · ' + a.images.length + ' תמונות</span></button>';
    }).join('') || '<p class="note center">אין עדיין אלבומים מהסוג הזה.</p>';
    $$('.album', box).forEach(function (b) { b.addEventListener('click', function () { openAlbum(ALBUMS[Number(b.dataset.i)], 0); }); });
  }
  var lb = { a: null, i: 0 };
  function openAlbum(a, i) {
    lb.a = a; lb.i = i; var d = $('#lightbox'); $('#lb-title').textContent = a.title;
    $('#lb-thumbs').innerHTML = a.images.map(function (im, k) { return '<button data-k="' + k + '"><img loading="lazy" src="' + esc(im.src) + '" alt=""></button>'; }).join('');
    $$('#lb-thumbs button').forEach(function (b) { b.addEventListener('click', function () { show(Number(b.dataset.k)); }); });
    show(i); if (!d.open) d.showModal();
  }
  function show(i) { var n = lb.a.images.length; lb.i = (i + n) % n; $('#lb-img').src = lb.a.images[lb.i].src; $$('#lb-thumbs button').forEach(function (b, k) { b.classList.toggle('on', k === lb.i); }); }
  $('#lb-prev').addEventListener('click', function () { show(lb.i - 1); });
  $('#lb-next').addEventListener('click', function () { show(lb.i + 1); });
  document.addEventListener('keydown', function (e) { if (!$('#lightbox').open) return; if (e.key === 'ArrowRight') show(lb.i - 1); if (e.key === 'ArrowLeft') show(lb.i + 1); });
  fetch('library/library.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (list) {
    ALBUMS = (list || []).map(function (a) { a.images = (a.images || []).map(function (im) { return Object.assign({}, im, { src: im.src }); }); return a; });
    var types = {}; ALBUMS.forEach(function (a) { types[a.type] = 1; });
    var f = $('#ev-filter'); f.innerHTML = Object.keys(types).length > 1 ? '<button class="on" data-t="">הכול</button>' + FS.EVENTS.filter(function (e) { return types[e.id]; }).map(function (e) { return '<button data-t="' + e.id + '">' + e.icon + ' ' + e.name + '</button>'; }).join('') : '';
    $$('button', f).forEach(function (b) { b.addEventListener('click', function () { $$('button', f).forEach(function (x) { x.classList.toggle('on', x === b); }); albums(b.dataset.t); }); });
    albums('');
  });

  $('#c-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = new FormData(this);
    var text = 'שלום! אשמח להצעה למגנטים לאירוע 🧲\nשם: ' + f.get('name') + '\nטלפון: ' + f.get('phone') + '\nאירוע: ' + f.get('type') + (f.get('date') ? '\nתאריך: ' + FS.fmtDate(f.get('date')) : '') + (f.get('guests') ? '\nאורחים: ' + f.get('guests') : '') + (f.get('notes') ? '\nהערות: ' + f.get('notes') : '');
    openWa(text);
  });
  $('#year').textContent = new Date().getFullYear();

  fetch('business.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (b) {
    Object.assign(BIZ, b || {}); fill();
  });
  fontsFor(['Amatic SC', 'Bellefair', 'Suez One', 'Secular One', 'Varela Round', 'Frank Ruhl Libre', 'Rubik', 'David Libre']).then(function () {
    hero(); galleryFilter(); gallery(''); designer();
  });
})();
