/* The magnet business in the studio: the event template (applied to every new photo), saved events, logo colours,
   the live event station (a watched camera folder → template → quality check → print queue → sheets with cut marks),
   and the extra AI: magnet design from a description, quality check (closed eyes, blur), skin retouch, face light,
   greetings. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;

  /* ---------- the event form ---------- */
  var MAG_FMTS = ['magnet', 'magnetL', 'm69', 'm710', 'm66', '10x15', '15x10', '13x18', 'sq'];
  $('#ev-type').innerHTML = FS.EVENTS.map(function (e) { return '<option value="' + e.id + '">' + e.icon + ' ' + e.name + '</option>'; }).join('');
  $('#ev-fmt').innerHTML = MAG_FMTS.map(function (id) { var f = FS.fmt(id); return '<option value="' + id + '">' + f.name + '</option>'; }).join('') + '<option value="cm">📐 גודל מותאם (ס״מ)</option>';
  $('#ev-fmt').addEventListener('change', function () { $('#ev-cm').hidden = this.value !== 'cm'; });
  $('#ev-font').innerHTML = FS.FONTS.map(function (f) { return '<option value="' + f[0] + '" style="font-family:\'' + f[0] + '\'">' + f[1] + '</option>'; }).join('');
  function fillFrames() {
    var cur = $('#ev-frame').value;
    $('#ev-frame').innerHTML = '<optgroup label="מוכנות">' + FS.GEN_FRAMES.map(function (f) { return '<option value="' + f.id + '">' + f.name + '</option>'; }).join('') + '</optgroup>' +
      (Object.keys(FS.USER_FRAMES).length ? '<optgroup label="המסגרות שלי">' + Object.keys(FS.USER_FRAMES).map(function (id) { return '<option value="u:' + id + '">' + FS.esc(FS.USER_FRAMES[id].name) + '</option>'; }).join('') + '</optgroup>' : '');
    if (cur) $('#ev-frame').value = cur;
  }
  function swatches() {
    var ev = FS.event($('#ev-type').value);
    $('#ev-swatches').innerHTML = ev.palette.map(function (c) { return '<button type="button" style="--c:' + c + '" data-c="' + c + '" title="' + c + '"></button>'; }).join('');
    $$('#ev-swatches button').forEach(function (b) { b.addEventListener('click', function () { $('#ev-color').value = b.dataset.c; save(); }); });
  }
  function read() {
    var fr = $('#ev-frame').value, o = { type: $('#ev-type').value, names: $('#ev-names').value.trim(), date: $('#ev-date').value, hashtag: $('#ev-tag').value.trim(), fmt: $('#ev-fmt').value, frame: fr, color: $('#ev-color').value, font: $('#ev-font').value, logo: FS.prefs.event && FS.prefs.event.logo || '', cmw: Number($('#ev-cmw').value) || 5, cmh: Number($('#ev-cmh').value) || 7.5 };
    if (/^u:/.test(fr)) { o.frameRef = { kind: 'png', id: fr.slice(2), opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false }; }
    return o;
  }
  function write(o) {
    $('#ev-type').value = o.type || 'wedding'; swatches(); fillFrames();
    $('#ev-names').value = o.names || ''; $('#ev-date').value = o.date || ''; $('#ev-tag').value = o.hashtag || '';
    $('#ev-fmt').value = o.fmt || 'magnet'; $('#ev-cmw').value = o.cmw || 5; $('#ev-cmh').value = o.cmh || 7.5; $('#ev-cm').hidden = o.fmt !== 'cm'; $('#ev-frame').value = o.frame || FS.event(o.type).frame; $('#ev-color').value = o.color || FS.event(o.type).color; $('#ev-font').value = o.font || FS.event(o.type).font;
    $('#ev-logo-colors').disabled = !o.logo; greets();
  }
  function save() { var o = read(); delete o.frameRef; FS.prefs.event = o; FS.savePrefs(); }
  $('#ev-type').addEventListener('change', function () {
    var ev = FS.event(this.value); swatches(); $('#ev-frame').value = ev.frame; $('#ev-color').value = ev.color; $('#ev-font').value = ev.font;
    if (!$('#ev-names').value) $('#ev-names').placeholder = ev.names; save(); greets();
  });
  ['#ev-names', '#ev-date', '#ev-tag', '#ev-fmt', '#ev-frame', '#ev-color', '#ev-font', '#ev-cmw', '#ev-cmh'].forEach(function (s) { $(s).addEventListener('change', save); });
  $('#ev-on').checked = !!FS.prefs.eventOn; $('#ev-smart').checked = FS.prefs.eventSmart !== false;
  $('#ev-on').addEventListener('change', function () { FS.prefs.eventOn = this.checked; FS.savePrefs(); if (this.checked) FS.toast('מעכשיו כל תמונה חדשה נכנסת לתבנית האירוע'); });
  $('#ev-smart').addEventListener('change', function () { FS.prefs.eventSmart = this.checked; FS.savePrefs(); });

  FS.applyEvent = function (p, o, quiet) {
    o = o || read();
    if (o.fmt === 'cm') { var mm = FS.mmOf(p.doc); if (p.doc.fmt !== 'cm' || Math.abs(mm[0] - o.cmw * 10) > 0.1 || Math.abs(mm[1] - o.cmh * 10) > 0.1) FS.applyFormat(p.doc, 'cm', FS.img(p.src), o.cmw * 10, o.cmh * 10); }
    else if (p.doc.fmt !== o.fmt) FS.applyFormat(p.doc, o.fmt, FS.img(p.src));
    if (o.logo && !FS.img(o.logo)) FS.loadImg(o.logo).then(function () { FS.applyEvent(p, o, true); FS.render(); });
    FS.buildMagnet(p, o);
    var done = $('#ev-smart').checked ? FS.smartFit(p, true).catch(function () {}) : Promise.resolve();
    return done.then(function () { FS.snap(p); if (p === FS.cur()) { FS.emit('doc'); } if (!quiet) FS.toast('🧲 התבנית הוחלה'); });
  };
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (FS.prefs.eventOn && FS.prefs.event) p.eventReady = FS.applyEvent(p, read(), true); });
  $('#ev-apply').addEventListener('click', function () {
    var list = FS.marked().length > 1 ? FS.marked() : FS.cur() ? [FS.cur()] : []; if (!list.length) return FS.toast('בוחרים תמונה קודם'); save();
    if (list.length === 1) return FS.applyEvent(list[0]);
    var o = read(), chain = Promise.resolve(); FS.busy('מחיל על ' + list.length + ' תמונות מסומנות…');
    list.forEach(function (p) { chain = chain.then(function () { return FS.applyEvent(p, o, true); }); });
    chain.then(function () { FS.busy(); FS.refreshStrip(); FS.emit('doc'); FS.toast('🧲 התבנית הוחלה על ' + list.length + ' תמונות מסומנות'); });
  });
  $('#ev-apply-all').addEventListener('click', function () {
    if (!S.photos.length) return; save(); var o = read(), chain = Promise.resolve();
    FS.busy('מחיל על ' + S.photos.length + ' תמונות…');
    S.photos.forEach(function (p) { chain = chain.then(function () { return FS.applyEvent(p, o, true); }); });
    chain.then(function () { FS.busy(); FS.buildStrip(); FS.emit('doc'); FS.toast('🧲 התבנית הוחלה על כל ' + S.photos.length + ' התמונות'); });
  });
  $('#ev-logo').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    FS.fileToDataURL(f).then(FS.loadImg).then(function (im) {
      var k = Math.min(1, 600 / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return FS.loadImg(c.toDataURL('image/png'));
    }).then(function (im) { save(); FS.prefs.event.logo = im.src; FS.savePrefs(); $('#ev-logo-colors').disabled = false; FS.toast('הלוגו נוסף. לוחצים "להחיל" כדי לראות אותו על המגנט.'); logoColors(); });
  });
  /* the main colours of the logo (k-means on its visible pixels) */
  function logoColors() {
    var src = FS.prefs.event && FS.prefs.event.logo, im = src && FS.img(src); if (!im) return;
    var c = FS.canvas(80, 80 * im.naturalHeight / im.naturalWidth), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height);
    var d = x.getImageData(0, 0, c.width, c.height).data, pts = [];
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mn > 235) continue; pts.push([d[i], d[i + 1], d[i + 2], mx - mn]); }
    if (!pts.length) return;
    var K = Math.min(5, pts.length), cen = []; for (i = 0; i < K; i++) cen.push(pts[Math.floor(i * pts.length / K)].slice(0, 3));
    for (var it = 0; it < 8; it++) {
      var acc = cen.map(function () { return [0, 0, 0, 0]; });
      pts.forEach(function (p) { var b = 0, bd = 1e9; cen.forEach(function (q, j) { var dd = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]); if (dd < bd) { bd = dd; b = j; } }); acc[b][0] += p[0]; acc[b][1] += p[1]; acc[b][2] += p[2]; acc[b][3]++; });
      cen = acc.map(function (a, j) { return a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]] : cen[j]; });
    }
    var hex = cen.sort(function (a, b) { return (b[3] || 0) - (a[3] || 0); }).map(function (q) { return '#' + q.slice(0, 3).map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); });
    $('#logo-palette').innerHTML = hex.map(function (h) { return '<button style="background:' + h + ';color:' + (FS.hexRgb(h).reduce(function (a, b) { return a + b; }) > 400 ? '#000' : '#fff') + '" data-c="' + h + '">' + h + '</button>'; }).join('');
    $$('#logo-palette button').forEach(function (b) { b.addEventListener('click', function () { $('#ev-color').value = b.dataset.c; save(); FS.toast('הצבע נבחר מהלוגו'); }); });
  }
  $('#ev-logo-colors').addEventListener('click', logoColors);

  function savedEvents() { try { return JSON.parse(localStorage.getItem('frame-studio-events') || '[]'); } catch (e) { return []; } }
  $('#ev-save').addEventListener('click', function () {
    save(); var o = FS.prefs.event, list = savedEvents().filter(function (e) { return !(e.names === o.names && e.date === o.date); });
    list.unshift(Object.assign({ id: 'e' + FS.uid(), at: Date.now() }, o));
    try { localStorage.setItem('frame-studio-events', JSON.stringify(list.slice(0, 40))); FS.toast('💾 האירוע נשמר'); } catch (e) { FS.toast('אין מקום לשמור את הלוגו. נסו לוגו קטן יותר.'); }
  });
  $('#ev-load').addEventListener('click', function showSaved() {
    var list = savedEvents();
    var body = FS.dialog('אירועים שמורים', list.length ? '<ul class="ev-list">' + list.map(function (e) {
      return '<li><span>' + FS.event(e.type).icon + ' <b>' + FS.esc(e.names || FS.event(e.type).name) + '</b> <small>' + FS.fmtDate(e.date) + '</small></span><button class="btn small primary" data-open="' + e.id + '">פתיחה</button><button class="btn small danger" data-del="' + e.id + '">✕</button></li>';
    }).join('') + '</ul>' : '<p class="empty">עדיין אין אירועים שמורים.</p>');
    $$('[data-open]', body).forEach(function (b) { b.addEventListener('click', function () { var e = list.filter(function (x) { return x.id === b.dataset.open; })[0]; FS.prefs.event = e; FS.savePrefs(); if (e.logo) FS.loadImg(e.logo); write(e); FS.closeDialog(); FS.toast('האירוע נטען'); }); });
    $$('[data-del]', body).forEach(function (b) { b.addEventListener('click', function () { localStorage.setItem('frame-studio-events', JSON.stringify(list.filter(function (x) { return x.id !== b.dataset.del; }))); showSaved(); }); });
  });

  /* ---------- quality: blur (variance of the Laplacian) and closed eyes (face landmarks) ---------- */
  var landmarker = null;
  FS.getLandmarker = function () { return getLandmarker(); };
  function getLandmarker() {
    if (landmarker) return landmarker;
    landmarker = FS.loadVision().then(function (v) {
      return v.m.FaceLandmarker.createFromOptions(v.fs, { baseOptions: { modelAssetPath: new URL('models/face_landmarker.task', location.href).href }, runningMode: 'IMAGE', numFaces: 12, outputFaceBlendshapes: true });
    });
    landmarker.catch(function () { landmarker = null; });
    return landmarker;
  }
  function sharpness(im) {
    var k = Math.min(1, 640 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    var c = FS.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), i, sum = 0, sq = 0, n = 0;
    for (i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (var y = 1; y < h - 1; y++) for (var xx = 1; xx < w - 1; xx++) { i = y * w + xx; var l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]; sum += l; sq += l * l; n++; }
    var m = sum / n; return sq / n - m * m;
  }
  FS.quality = function (p) {
    var im = FS.img(p.src), q = { sharp: Math.round(sharpness(im)), faces: 0, closed: 0 };
    q.blurry = q.sharp < 40;
    return getLandmarker().then(function (lm) {
      var k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      var r = lm.detect(c); q.faces = (r.faceLandmarks || []).length;
      (r.faceBlendshapes || []).forEach(function (b) { var sc = {}; (b.categories || []).forEach(function (cat) { sc[cat.categoryName] = cat.score; }); if ((sc.eyeBlinkLeft || 0) > 0.5 && (sc.eyeBlinkRight || 0) > 0.5) q.closed++; });
    }).catch(function () { q.noFaceCheck = true; }).then(function () {
      q.ok = !q.blurry && !q.closed; p.quality = q; FS.markStrip(); return q;
    });
  };
  FS.markStrip = function () {
    $$('#strip .th').forEach(function (b, i) {
      var p = S.photos[i]; if (!p) return; var old = b.querySelector('.qb'); if (old) old.remove();
      if (!p.quality) return; var s = document.createElement('span'); s.className = 'qb ' + (p.quality.ok ? 'ok' : 'bad');
      s.textContent = p.quality.ok ? '✓' : p.quality.closed ? '😑' : '〰';
      s.title = p.quality.ok ? 'עברה בדיקה' : p.quality.closed ? 'עיניים עצומות' : 'מטושטשת'; b.appendChild(s);
    });
  };
  function qText(q) {
    return (q.ok ? '✅ התמונה תקינה' : '⚠️ ' + [q.closed ? (q.closed + ' עם עיניים עצומות') : '', q.blurry ? 'התמונה מטושטשת' : ''].filter(Boolean).join(' · ')) +
      ' <small>(חדות ' + q.sharp + (q.noFaceCheck ? ', בדיקת העיניים לא נטענה' : ', ' + q.faces + ' פנים') + ')</small>';
  }
  $('#qc-one').addEventListener('click', function () { var p = FS.cur(); if (!p) return; FS.busy('בודק…'); FS.quality(p).then(function (q) { FS.busy(); $('#qc-out').innerHTML = qText(q); }); });
  $('#qc-all').addEventListener('click', function () {
    if (!S.photos.length) return; var chain = Promise.resolve(), bad = 0;
    S.photos.forEach(function (p, i) { chain = chain.then(function () { FS.busy('בודק ' + (i + 1) + '/' + S.photos.length + '…'); return FS.quality(p).then(function (q) { if (!q.ok) bad++; }); }); });
    chain.then(function () { FS.busy(); $('#qc-out').innerHTML = (bad ? '⚠️ ' + bad + ' מתוך ' + S.photos.length + ' תמונות לא עברו (מסומנות בפס התמונות).' : '✅ כל ' + S.photos.length + ' התמונות תקינות.') + ' בהדפסה אפשר לסמן "לדלג על תמונות שנפסלו".'; });
  });

  /* ---------- skin retouch and face light ---------- */
  var skinT = null;
  $('#skin').addEventListener('input', function () {
    var v = Number(this.value), p = FS.cur(); $('#o-skin').textContent = v; if (!p) return;
    clearTimeout(skinT);
    skinT = setTimeout(function () { FS.findFaces(p).then(function (faces) { if (!faces.length) return; p.doc.photo.skin = { amt: v, faces: faces.map(function (f) { return { x: f.x, y: f.y, w: f.w, h: f.h }; }) }; FS.render(true); FS.commitSoon(); }); }, 120);
  });
  function faceLight(p) {
    return FS.findFaces(p).then(function (faces) {
      if (!faces.length) return false;
      var im = FS.img(p.src), k = Math.min(1, 800 / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, c.width, c.height); var sum = 0, n = 0;
      faces.forEach(function (f) { var d = x.getImageData(Math.max(0, f.x * k + f.w * k * 0.2), Math.max(0, f.y * k + f.h * k * 0.25), Math.max(1, f.w * k * 0.6), Math.max(1, f.h * k * 0.5)).data; for (var i = 0; i < d.length; i += 4) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; } });
      var L = sum / n, a = p.doc.photo.adj, diff = 150 - L;
      a.exposure = FS.clamp(Math.round(diff / 2), -40, 60); a.shadows = FS.clamp(Math.round(diff / 1.5), 0, 55); a.highlights = diff > 20 ? -25 : -8; a.vibrance = Math.max(a.vibrance, 12);
      return true;
    });
  }
  $('#face-light').addEventListener('click', function () { var p = FS.cur(); if (!p) return; faceLight(p).then(function (ok) { if (ok) { FS.changed(); FS.toast('💡 הפנים הוארו'); } }); });
  $('#face-all').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return;
    faceLight(p).then(function (ok) {
      if (!ok) return; p.doc.photo.skin = { amt: 40, faces: p.faces.map(function (f) { return { x: f.x, y: f.y, w: f.w, h: f.h }; }) }; $('#skin').value = 40; $('#o-skin').textContent = 40;
      p.doc.photo.adj.sharpen = Math.max(p.doc.photo.adj.sharpen, 15);
      return FS.smartFit(p, true).then(function () { FS.changed(); FS.toast('✨ תאורה, ריטוש ומרכוז'); });
    });
  });

  /* ---------- greetings ---------- */
  function greets(extra) {
    var ev = FS.event($('#ev-type').value), list = ev.greet.concat(extra || []);
    $('#greets').innerHTML = list.map(function (g) { return '<button data-g="' + FS.esc(g) + '">' + FS.esc(g) + '</button>'; }).join('');
    $$('#greets [data-g]').forEach(function (b) { b.addEventListener('click', function () {
      var p = FS.cur(); if (!p) return FS.toast('בוחרים תמונה קודם'); var d = p.doc, H = FS.hole(d);
      FS.addLayer({ type: 'text', text: b.dataset.g, size: Math.round(Math.min(d.w, d.h) * 0.075), font: $('#ev-font').value || 'Amatic SC', weight: 700, color: '#ffffff', shadow: true, x: d.w / 2, y: H.y + H.h * 0.88, align: 'center' });
    }); });
  }
  $('#greet-ai').addEventListener('click', function () {
    var ev = FS.event($('#ev-type').value), names = $('#ev-names').value;
    FS.busy('כותב ברכות…');
    FS.askServer({ action: 'ai', tag: 'photo', prompt: 'כתוב 8 ברכות קצרות וחמות בעברית (עד 6 מילים כל אחת) למגנט מזכרת מ' + ev.name + (names ? ' של ' + names : '') + '. ענה רק במערך JSON של מחרוזות.' })
      .then(function (r) { FS.busy(); if (!r || !r.ok) throw new Error(r && r.error); var arr = JSON.parse(String(r.text).replace(/^[^\[]*/, '').replace(/[^\]]*$/, '')); greets(arr.slice(0, 8)); })
      .catch(function (e) { FS.busy(); FS.toast(FS.aiError(e && e.message) + ' אפשר לבחור מהברכות המוכנות.', 6000); });
  });

  /* ---------- magnet design from a description ---------- */
  var COLORS = { 'זהב': '#c9a45c', 'זהוב': '#c9a45c', 'ורוד': '#e9a8a6', 'פודרה': '#e9b8b0', 'אדום': '#b91c1c', 'בורדו': '#7f1d1d', 'כחול': '#1d4ed8', 'נייבי': '#1d2d6e', 'תכלת': '#9cc3e6', 'ירוק': '#15803d', 'זית': '#a3b18a', 'מרווה': '#a3b18a', 'סגול': '#7b5cff', 'לילך': '#c4b5fd', 'שחור': '#111111', 'לבן': '#ffffff', 'שמנת': '#f4efe6', 'כסף': '#c0c4cc', 'כתום': '#f97316', 'צהוב': '#facc15', 'טורקיז': '#14b8a6' };
  var FRAMEWORDS = { 'בוהו': 'boho', 'עלים': 'boho', 'פרחים': 'floral', 'פרחוני': 'floral', 'קלאסי': 'classic', 'אלגנט': 'classic', 'ניאון': 'neon', 'כוכבים': 'stars', 'פולארויד': 'polaroid', 'קשת': 'arch', 'לבבות': 'hearts', 'סרט': 'film', 'מגזין': 'magazine', 'עיגול': 'circle', 'מוזהב': 'gold', 'וינטג': 'deckle', 'מינימל': 'simple' };
  var TYPEWORDS = [['חתונ', 'wedding'], ['מצו', 'barmitzvah'], ['ברית', 'brit'], ['בריתה', 'brit'], ['הולדת', 'birthday'], ['חינה', 'henna'], ['חברה', 'company'], ['כנס', 'company'], ['אירוס', 'engagement'], ['חג', 'holiday'], ['חנוכ', 'holiday'], ['פסח', 'holiday'], ['ראש השנה', 'holiday']];
  function localDesign(t) {
    var o = { type: 'wedding' };
    TYPEWORDS.some(function (w) { if (t.indexOf(w[0]) > -1) { o.type = w[1]; return true; } });
    var ev = FS.event(o.type); o.frame = ev.frame; o.color = ev.color; o.font = ev.font;
    Object.keys(FRAMEWORDS).some(function (w) { if (t.indexOf(w) > -1) { o.frame = FRAMEWORDS[w]; return true; } });
    Object.keys(COLORS).some(function (w) { if (t.indexOf(w) > -1) { o.color = COLORS[w]; return true; } });
    var m = t.match(/([\u05d0-\u05ea]{2,})\s*(?:&|\+|ו־|ו-)\s*([\u05d0-\u05ea]{2,})/) || t.match(/של\s+([\u05d0-\u05ea]{2,})\s+ו([\u05d0-\u05ea]{2,})/);
    if (m) o.names = m[1] + ' & ' + m[2];
    return o;
  }
  $('#mg-make').addEventListener('click', function () {
    var t = $('#mg-prompt').value.trim(); if (!t) { FS.toast('מתארים את האירוע במשפט'); return; }
    var frames = FS.GEN_FRAMES.map(function (f) { return f.id; }).join(', '), fonts = FS.FONTS.map(function (f) { return f[0]; }).join(', '), types = FS.EVENTS.map(function (e) { return e.id + '=' + e.name; }).join(', ');
    var prompt = 'Design an event photo magnet from this Hebrew description: "' + t + '". Answer ONLY JSON: {"type":"one of: ' + types + '","frame":"one of: ' + frames + '","color":"#hex main frame colour","font":"one of: ' + fonts + '","names":"Hebrew names/title for the magnet or empty","hashtag":"short latin hashtag or empty","greeting":"short Hebrew greeting"}';
    FS.busy('מעצב…');
    FS.askServer({ action: 'ai', tag: 'photo', prompt: prompt }).then(function (r) {
      if (!r || !r.ok) throw new Error(); return JSON.parse(String(r.text).replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
    }).catch(function () { return localDesign(t); }).then(function (j) {
      FS.busy();
      var ev = FS.event(j.type), o = { type: ev.id, frame: FS.GEN_FRAMES.some(function (f) { return f.id === j.frame; }) ? j.frame : ev.frame, color: /^#[0-9a-f]{6}$/i.test(j.color || '') ? j.color : ev.color,
        font: FS.FONTS.some(function (f) { return f[0] === j.font; }) ? j.font : ev.font, names: j.names || $('#ev-names').value, hashtag: j.hashtag || '', date: $('#ev-date').value, fmt: $('#ev-fmt').value || 'magnet' };
      write(o); save(); if (j.greeting) greets([j.greeting]);
      var go = FS.cur() ? Promise.resolve(FS.cur()) : demoPhoto(ev);
      return go.then(function (p) { return FS.applyEvent(p, read(), true); }).then(function () { FS.openTab('event'); FS.toast('🪄 המגנט עוצב. אפשר לשנות כל פרט בלשונית "אירוע".', 4000); });
    });
  });
  function demoPhoto(ev) {
    var real = FS.realPhoto(ev.id, 2);
    if (real) return fetch(real).then(function (r) { return r.blob(); }).then(function (b) { return FS.addPhotoFile(new File([b], 'דוגמה.webp', { type: b.type || 'image/webp' })); }).then(function (p) { FS.buildStrip(); FS.select(S.photos.indexOf(p)); return p; });
    var c = FS.sampleScene(ev.scene, 900, 1350, 5);
    return new Promise(function (res) { c.toBlob(function (b) { FS.addFiles([new File([b], 'דוגמה.jpg', { type: 'image/jpeg' })]); var t = setInterval(function () { if (FS.cur()) { clearInterval(t); res(FS.cur()); } }, 100); }, 'image/jpeg', 0.92); });
  }

  /* ---------- the live event station ---------- */
  var st = { dir: null, timer: 0, seen: {}, pending: {}, queue: [], n: { in: 0, skip: 0, printed: Number(localStorage.getItem('frame-studio-printed') || 0) } };
  function stats() { $('#st-in').textContent = st.n.in; $('#st-queue').textContent = st.queue.length; $('#st-skip').textContent = st.n.skip; $('#st-printed').textContent = st.n.printed; }
  FS.on('printed', function (n) { st.n.printed += n; try { localStorage.setItem('frame-studio-printed', st.n.printed); } catch (e) { /* ignore */ } stats(); });
  function status(t) { $('#st-status').textContent = t; }
  function isImg(name) { return /\.(jpe?g|png|webp|heic)$/i.test(name) || FS.RAW_EXT.test(name); }
  function take(file) {
    st.n.in++; stats();
    if (!FS.prefs.eventOn) { FS.prefs.eventOn = true; $('#ev-on').checked = true; FS.savePrefs(); }
    return FS.addPhotoFile(file).then(function (p) {
      FS.buildStrip(); FS.select(S.photos.length - 1);
      return (p.eventReady || FS.applyEvent(p, read(), true)).then(function () {
        if (!$('#st-check').checked) return { ok: true };
        return FS.quality(p);
      }).then(function (q) {
        if (q && !q.ok) { st.n.skip++; status('⚠️ ' + file.name + ' נפסלה (' + (q.closed ? 'עיניים עצומות' : 'מטושטשת') + '). אפשר להדפיס אותה ידנית.'); }
        else { st.queue.push(p); status('✓ ' + file.name + ' נכנסה לתור'); }
        stats();
        if ($('#st-print').checked && st.queue.length >= Number($('#st-per').value)) printQueue();
      });
    }).catch(function () { status('הקובץ ' + file.name + ' לא נפתח'); });
  }
  function printQueue() {
    if (!st.queue.length) { FS.toast('התור ריק'); return; }
    var per = Number($('#st-per').value), list = st.queue.splice(0, per); stats();
    FS.printNow({ list: list, paper: $('#st-paper').value, layout: String(per), margin: 3, marks: true, copies: 1 });
  }
  function poll() {
    if (!st.dir) return;
    (async function () {
      try {
        for await (var entry of st.dir.values()) {
          if (entry.kind !== 'file' || !isImg(entry.name)) continue;
          var f = await entry.getFile(), key = entry.name + '|' + f.lastModified;
          if (st.seen[key]) continue;
          if (st.pending[key] !== f.size) { st.pending[key] = f.size; continue; } /* still being written: wait for a steady size */
          st.seen[key] = 1; delete st.pending[key]; await take(f);
        }
      } catch (e) { status('אין גישה לתיקייה. בוחרים אותה שוב.'); stop(); }
    })();
  }
  function stop() { clearInterval(st.timer); st.dir = null; $('#st-stop').disabled = true; $('#st-folder').disabled = false; document.body.classList.remove('live'); status('התחנה עצרה.'); }
  $('#st-folder').addEventListener('click', function () {
    if (!window.showDirectoryPicker) {
      FS.toast('האזנה לתיקייה עובדת ב־Chrome או ב־Edge במחשב. בינתיים אפשר לבחור תמונות, והן ייכנסו לתבנית ולתור.', 6000);
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = function () { var chain = Promise.resolve(); Array.prototype.forEach.call(inp.files, function (f) { chain = chain.then(function () { return take(f); }); }); }; inp.click(); return;
    }
    window.showDirectoryPicker({ mode: 'read' }).then(async function (dir) {
      st.dir = dir; st.seen = {}; st.pending = {};
      for await (var entry of dir.values()) { if (entry.kind === 'file' && isImg(entry.name)) { var f = await entry.getFile(); st.seen[entry.name + '|' + f.lastModified] = 1; } }
      st.timer = setInterval(poll, 1500); $('#st-stop').disabled = false; $('#st-folder').disabled = true; document.body.classList.add('live');
      status('🔴 מאזין לתיקייה "' + dir.name + '". כל תמונה חדשה תיכנס לתבנית.');
      if (!FS.prefs.event) save();
    }).catch(function () {});
  });
  $('#st-stop').addEventListener('click', stop);
  $('#st-print-now').addEventListener('click', printQueue);
  $('#st-clear').addEventListener('click', function () { st.queue = []; stats(); });

  $('#start-event').addEventListener('click', function () { FS.openTab('event'); $('#ev-names').focus(); });

  /* ---------- start ---------- */
  var o = FS.prefs.event || { type: 'wedding', fmt: 'magnet' };
  if (!o.date) o.date = new Date().toISOString().slice(0, 10);
  if (o.logo) FS.loadImg(o.logo).then(function () { if (FS.prefs.event && FS.prefs.event.logo) logoColors(); }).catch(function () {});
  write(o); stats();
  FS.loadUserFrames().then(fillFrames);
})();
