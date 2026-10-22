/* Events: a style per kind of event (frame, colours, fonts, greetings), building a magnet page from the event details,
   and drawn sample "photos" for showing designs before there is a real picture. Used by the site and the studio. */
(function () {
  'use strict';
  var FS = window.FS;

  FS.EVENTS = [
    { id: 'wedding', name: 'חתונה', icon: '💍', frame: 'classic', color: '#c9a45c', font: 'Amatic SC', ink: '#5b4a2e', names: 'נועה & דניאל', scene: 'couple',
      palette: ['#c9a45c', '#e9a8a6', '#a3b18a', '#1d2d6e', '#ffffff'], frames: ['classic', 'floral', 'wedding', 'boho', 'gold', 'arch'],
      greet: ['מזל טוב לזוג המאושר', 'אהבה אחת, אינסוף רגעים', 'באנו לשמוח איתכם', 'תודה שחגגתם איתנו', 'ביחד זה הכי טוב'] },
    { id: 'barmitzvah', name: 'בר/בת מצווה', icon: '✡️', frame: 'stars', color: '#1d2d6e', font: 'Suez One', ink: '#e6c25a', names: 'יונתן', scene: 'party',
      palette: ['#1d2d6e', '#c9a45c', '#7b5cff', '#0f766e', '#be185d'], frames: ['stars', 'classic', 'neon', 'gold', 'magazine'],
      greet: ['מזל טוב לבר המצווה', 'גדלת ואנחנו כל כך גאים', 'יום של שמחה גדולה', 'עלה והצלח', 'מצווה גוררת מצווה'] },
    { id: 'brit', name: 'ברית / בריתה', icon: '👶', frame: 'floral', color: '#9cc3e6', font: 'Varela Round', ink: '#35577a', names: 'ברוך הבא אריאל', scene: 'family',
      palette: ['#9cc3e6', '#e9a8a6', '#f2d27a', '#a3b18a'], frames: ['floral', 'classic', 'circle', 'deckle', 'boho'],
      greet: ['ברוך הבא לעולם', 'שמחה גדולה במשפחה', 'בשעה טובה', 'קטן שעשה שמחה גדולה'] },
    { id: 'birthday', name: 'יום הולדת', icon: '🎂', frame: 'birthday', color: '#ff4f8b', font: 'Secular One', ink: '#ff4f8b', names: 'מאיה חוגגת 30', scene: 'party',
      palette: ['#ff4f8b', '#3cc3ff', '#ffc93c', '#7b5cff', '#2fd38a'], frames: ['birthday', 'polaroid', 'neon', 'insta', 'film'],
      greet: ['מזל טוב ועד 120', 'שנה של אור ושמחה', 'החגיגה של השנה', 'הגיל הוא רק מספר'] },
    { id: 'henna', name: 'חינה', icon: '🪔', frame: 'gold', color: '#b91c1c', font: 'Frank Ruhl Libre', ink: '#7a1414', names: 'החינה של שירה', scene: 'couple',
      palette: ['#b91c1c', '#c9a45c', '#7c2d12', '#065f46'], frames: ['gold', 'arch', 'deckle', 'classic'],
      greet: ['בשעה טובה ומוצלחת', 'מסורת, שמחה ואהבה', 'שתחגגו תמיד ככה'] },
    { id: 'company', name: 'אירוע חברה', icon: '🏢', frame: 'simple', color: '#0f172a', font: 'Rubik', ink: '#ffffff', names: 'כנס השנתי 2026', scene: 'party',
      palette: ['#0f172a', '#2563eb', '#16a34a', '#f59e0b', '#ffffff'], frames: ['simple', 'magazine', 'insta', 'film', 'mat'],
      greet: ['ביחד מצליחים', 'תודה שהייתם חלק', 'הצוות הכי טוב'] },
    { id: 'engagement', name: 'אירוסין', icon: '💞', frame: 'hearts', color: '#e8355a', font: 'Amatic SC', ink: '#a1123a', names: 'שירה ❤ עומר', scene: 'couple',
      palette: ['#e8355a', '#e9a8a6', '#c9a45c', '#ffffff'], frames: ['hearts', 'floral', 'polaroid', 'classic'],
      greet: ['היא אמרה כן!', 'ההתחלה של לנצח', 'מזל טוב לזוג'] },
    { id: 'holiday', name: 'חג', icon: '🕎', frame: 'deckle', color: '#c9a45c', font: 'David Libre', ink: '#4a3b1d', names: 'חג שמח', scene: 'family',
      palette: ['#c9a45c', '#1d4ed8', '#b91c1c', '#15803d'], frames: ['deckle', 'stars', 'classic', 'circle'],
      greet: ['חג שמח למשפחה', 'שנה טובה ומתוקה', 'חג אורים שמח', 'חג פסח כשר ושמח'] }
  ];
  FS.event = function (id) { for (var i = 0; i < FS.EVENTS.length; i++) if (FS.EVENTS[i].id === id) return FS.EVENTS[i]; return FS.EVENTS[0]; };
  FS.fmtDate = function (iso) { if (!iso) return ''; var p = String(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; };

  /* build the magnet on a page: frame, names, date and an optional hashtag / logo, laid out in the frame's free band */
  FS.buildMagnet = function (p, o) {
    var ev = FS.event(o.type), d = p.doc;
    FS.setFrame(p, o.frameRef || { kind: 'gen', id: o.frame || ev.frame, color: o.color || ev.color, thick: o.thick || 1, opacity: 1 }, { quiet: true, noTexts: true });
    d.layers = d.layers.filter(function (L) { return !L.magnet; });
    var H = FS.hole(d), band = d.h - (H.y + H.h), m = Math.min(d.w, d.h), font = o.font || ev.font;
    var fid = o.frameRef ? 'png' : o.frame || ev.frame;
    var ink = o.ink || (fid === 'stars' ? '#e6c25a' : /neon|film/.test(fid) ? '#ffffff' : (o.color && o.color !== ev.color) || fid !== ev.frame ? FS.inkFor(o.color || ev.color) : ev.ink);
    var lines = [];
    if (o.names) lines.push({ text: o.names, size: m * (font === 'Amatic SC' ? 0.1 : 0.072), font: font, weight: 700 });
    var sub = [FS.fmtDate(o.date), o.hashtag ? '#' + String(o.hashtag).replace(/^#/, '') : ''].filter(Boolean).join('   ·   ');
    if (sub) lines.push({ text: sub, size: m * 0.038, font: 'Bellefair', weight: 400 });
    /* leave room at the bottom for the business line */
    var cr = FS.BIZ && FS.BIZ.credit, reserve = cr && cr.on && FS.creditText() && /bottom|corner/.test(cr.pos || 'bottom') ? m * (cr.size || 3.2) / 100 * 1.7 : 0;
    var inBand = band > m * 0.16, total = lines.reduce(function (s, l) { return s + l.size * 1.25; }, 0);
    if (inBand && total > band - reserve) { var shrink = Math.max(0.6, (band - reserve) / total); lines.forEach(function (l) { l.size *= shrink; }); total *= shrink; }
    var y = inBand ? H.y + H.h + (band - reserve - total) / 2 : d.h - total - m * 0.06 - reserve;
    lines.forEach(function (l, li) {
      var size = Math.round(Math.min(l.size, inBand ? band * 0.55 : l.size));
      d.layers.push({ id: FS.uid(), link: 'mg' + li, type: 'text', magnet: true, text: l.text, x: d.w / 2, y: y + size * 0.62, size: size, font: l.font, weight: l.weight,
        color: inBand ? ink : '#ffffff', shadow: !inBand, strokeW: 0, stroke: '#000000', r: 0, opacity: 1, align: 'center' });
      y += size * 1.25;
    });
    if (o.logo && FS.img(o.logo)) {
      var li = FS.img(o.logo), s = m * 0.16 / Math.max(li.naturalWidth, li.naturalHeight);
      d.layers.push({ id: FS.uid(), link: 'mglogo', type: 'image', magnet: true, src: o.logo, s: s, x: H.x + H.w - li.naturalWidth * s / 2 - m * 0.03, y: H.y + H.h - li.naturalHeight * s / 2 - m * 0.03, r: 0, opacity: 0.95 });
    }
    var im = FS.img(p.src); if (im) FS.fitPhoto(d, im);
  };
  FS.inkFor = function (hex) { var c = FS.hexRgb(hex), L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return L > 200 ? '#5b4a2e' : hex; };

  /* drawn sample photos (no real people): a couple at sunset, a party, a family */
  FS.sampleScene = function (kind, w, h, seed) {
    var c = FS.canvas(w, h), x = c.getContext('2d'), r = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(seed || 7);
    function person(px, py, s, col, hair, dress) {
      x.fillStyle = col; x.beginPath(); x.arc(px, py - s * 1.55, s * 0.32, 0, 7); x.fill();
      x.fillStyle = hair; x.beginPath(); x.arc(px, py - s * 1.62, s * 0.34, Math.PI, 0); x.fill();
      x.fillStyle = dress; x.beginPath(); x.moveTo(px - s * 0.42, py - s * 1.15); x.quadraticCurveTo(px, py - s * 1.32, px + s * 0.42, py - s * 1.15);
      x.lineTo(px + s * (dress === '#fdfbf7' ? 0.75 : 0.5), py + s * 0.6); x.lineTo(px - s * (dress === '#fdfbf7' ? 0.75 : 0.5), py + s * 0.6); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(px - s * 0.11, py - s * 1.55, s * 0.035, 0, 7); x.arc(px + s * 0.11, py - s * 1.55, s * 0.035, 0, 7); x.fill();
      x.strokeStyle = 'rgba(80,30,30,.7)'; x.lineWidth = s * 0.04; x.beginPath(); x.arc(px, py - s * 1.47, s * 0.12, 0.2, Math.PI - 0.2); x.stroke();
    }
    var g;
    if (kind === 'couple') {
      g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f7c59f'); g.addColorStop(0.5, '#f29e8e'); g.addColorStop(1, '#6d4c7d'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,240,200,.8)'; x.beginPath(); x.arc(w * 0.5, h * 0.42, w * 0.2, 0, 7); x.fill();
      for (var i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.15 + r() * 0.35) + ')'; x.beginPath(); x.arc(r() * w, r() * h * 0.6, 2 + r() * w * 0.025, 0, 7); x.fill(); }
      x.fillStyle = '#3d2c4a'; x.fillRect(0, h * 0.82, w, h * 0.18);
      x.strokeStyle = '#fff7e6'; x.lineWidth = w * 0.012; x.beginPath(); x.moveTo(w * 0.12, h); x.lineTo(w * 0.12, h * 0.2); x.quadraticCurveTo(w * 0.5, h * 0.08, w * 0.88, h * 0.2); x.lineTo(w * 0.88, h); x.stroke();
      person(w * 0.4, h * 0.86, h * 0.28, '#f1c7a5', '#4a2c1d', '#fdfbf7');
      person(w * 0.62, h * 0.86, h * 0.3, '#d9a37f', '#1f1a17', '#22223b');
    } else if (kind === 'party') {
      g = x.createRadialGradient(w * 0.5, h * 0.3, 10, w * 0.5, h * 0.4, Math.max(w, h)); g.addColorStop(0, '#5b3fa8'); g.addColorStop(1, '#120a2e'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (i = 0; i < 70; i++) { x.fillStyle = ['rgba(255,201,60,', 'rgba(255,79,139,', 'rgba(60,195,255,'][i % 3] + (0.2 + r() * 0.5) + ')'; x.beginPath(); x.arc(r() * w, r() * h * 0.7, 3 + r() * w * 0.04, 0, 7); x.fill(); }
      ['#ff4f8b', '#ffc93c', '#3cc3ff'].forEach(function (col, k) { x.fillStyle = col; x.beginPath(); x.ellipse(w * (0.15 + k * 0.35), h * 0.18, w * 0.07, w * 0.09, 0, 0, 7); x.fill(); });
      person(w * 0.28, h * 0.92, h * 0.26, '#f1c7a5', '#7a4a21', '#ff4f8b');
      person(w * 0.52, h * 0.9, h * 0.29, '#c98f68', '#1f1a17', '#2563eb');
      person(w * 0.75, h * 0.93, h * 0.25, '#f5d0b5', '#e3b04b', '#2fd38a');
    } else {
      g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#dff3ff'); g.addColorStop(1, '#fde7ef'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (i = 0; i < 18; i++) { x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(r() * w, r() * h * 0.5, w * 0.06 + r() * w * 0.05, 0, 7); x.fill(); }
      x.fillStyle = '#c7e3b5'; x.fillRect(0, h * 0.8, w, h * 0.2);
      person(w * 0.32, h * 0.9, h * 0.3, '#f1c7a5', '#4a2c1d', '#9cc3e6');
      person(w * 0.68, h * 0.9, h * 0.31, '#d9a37f', '#2b2b2b', '#a3b18a');
      person(w * 0.5, h * 0.94, h * 0.17, '#f5d0b5', '#c48a4a', '#f2d27a');
    }
    return c;
  };
  /* ---------- the business line printed on every magnet (name, phone, Instagram…) ---------- */
  FS.BIZ = { name: 'פריים מגנטים', owner: '', phone: '', whatsapp: '', email: '', instagram: '', facebook: '', website: '', tagline: '', areas: '', hours: '',
    credit: { on: true, items: ['name', 'phone'], pos: 'bottom', size: 3.2, color: 'auto', font: 'Heebo', opacity: 0.85 } };
  try { var savedBiz = JSON.parse(localStorage.getItem('frame-studio-biz') || 'null'); if (savedBiz) FS.BIZ = Object.assign({}, FS.BIZ, savedBiz, { credit: Object.assign({}, FS.BIZ.credit, savedBiz.credit || {}) }); } catch (e) { /* private mode */ }
  FS.saveBiz = function () { try { localStorage.setItem('frame-studio-biz', JSON.stringify(FS.BIZ)); } catch (e) { /* private mode */ } };
  function handle(u) { u = String(u || '').trim(); if (!u) return ''; var m = u.match(/instagram\.com\/([^/?#]+)/i); return '@' + (m ? m[1] : u.replace(/^@/, '')); }
  FS.creditText = function (b) {
    b = b || FS.BIZ; var c = b.credit || {}, parts = [];
    (c.items || []).forEach(function (k) {
      if (k === 'name' && b.name) parts.push(b.name);
      else if (k === 'owner' && b.owner) parts.push(b.owner);
      else if (k === 'phone' && b.phone) parts.push(b.phone);
      else if (k === 'instagram' && b.instagram) parts.push(handle(b.instagram));
      else if (k === 'website' && b.website) parts.push(String(b.website).replace(/^https?:\/\//, '').replace(/\/$/, ''));
      else if (k === 'tagline' && b.tagline) parts.push(b.tagline);
    });
    return parts.join('  ·  ');
  };
  /* (re)place the credit on a page: a normal, editable text layer linked as "biz" */
  FS.applyCredit = function (p, b) {
    b = b || FS.BIZ; var c = b.credit || {}, d = p.doc;
    d.layers = d.layers.filter(function (L) { return L.link !== 'biz'; });
    var text = FS.creditText(b); if (!c.on || !text || p.noCredit) return;   /* noCredit: a customer's frame that already carries it */
    var m = Math.min(d.w, d.h), size = Math.max(10, Math.round(m * (c.size || 3.2) / 100)), H = FS.hole(d), pos = c.pos || 'bottom';
    while (FS.layerBox({ type: 'text', text: text, size: size, font: c.font || 'Heebo', weight: 500, spacing: 1 }).w > (c.pos === 'side' ? d.h : d.w) * 0.94 && size > 8) size--;
    var L = { id: FS.uid(), link: 'biz', credit: true, type: 'text', text: text, size: size, font: c.font || 'Heebo', weight: 500, r: 0, opacity: c.opacity == null ? 0.85 : c.opacity, strokeW: 0, stroke: '#000000', align: 'center', spacing: 1 };
    var pad = size * 0.8;
    if (pos === 'top') { L.x = d.w / 2; L.y = pad; }
    else if (pos === 'corner-l') { L.x = pad * 0.6 + FS.layerBox(L).w / 2; L.y = d.h - pad; }
    else if (pos === 'corner-r') { L.x = d.w - pad * 0.6 - FS.layerBox(L).w / 2; L.y = d.h - pad; }
    else if (pos === 'side') { L.x = d.w - pad; L.y = d.h / 2; L.r = -90; }
    else { L.x = d.w / 2; L.y = d.h - pad; }
    var onBand = pos === 'side' ? H.x + H.w < L.x - size * 0.6 : pos === 'top' ? H.y > L.y + size * 0.6 : H.y + H.h < L.y - size * 0.6;
    var fid = d.frame && d.frame.id, darkFrame = /neon|film|stars/.test(fid || '') || (d.frame && d.frame.kind === 'gen' && d.frame.color && FS.hexRgb(d.frame.color).reduce(function (a, v) { return a + v; }, 0) < 240 && /simple|mat|gold/.test(fid));
    if (c.color && c.color !== 'auto') { L.color = c.color; L.shadow = !onBand; }
    else if (onBand && d.frame) { L.color = darkFrame ? '#f2ead8' : '#5b5046'; L.shadow = false; }
    else { L.color = '#ffffff'; L.shadow = true; }
    d.layers.push(L);
  };

  /* a realistic sample photo for the event type (js/real-photos.js), or null (then the drawn scene) */
  FS.realPhoto = function (type, seed) { var R = FS.REAL_PHOTOS || {}, l = R[type] && R[type].length ? R[type] : R.wedding; return l && l.length ? new URL(l[Math.abs(seed || 0) % l.length], location.href).href : null; };
  /* a finished magnet (frame, words, photo or drawn scene) as a canvas about `size` px long */
  var sceneCache = {};
  FS.magnetCanvas = function (o, size) {
    var ev = FS.event(o.type), fmt = o.fmt || 'magnet', f = FS.fmt(fmt), key = (o.scene || ev.scene) + fmt + (o.seed || 3);
    var real = !o.photo && !o.scene && FS.realPhoto(o.type, o.seed || 3); if (real) return FS.photoFrom(real, fmt).then(function (p) { FS.buildMagnet(p, o); var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k); FS.draw(c.getContext('2d'), p, { scale: k, max: Math.round(size * 1.4), export: true }); return c; }).catch(function () { return FS.magnetCanvas(Object.assign({}, o, { scene: o.scene || ev.scene }), size); });
    if (!o.photo && !sceneCache[key]) { var long = 900, w = f.w >= f.h ? long : Math.round(long * f.w / f.h), h = f.w >= f.h ? Math.round(long * f.h / f.w) : long; sceneCache[key] = FS.sampleScene(o.scene || ev.scene, w, h, o.seed || 3).toDataURL('image/jpeg', 0.9); }
    return FS.photoFrom(o.photo || sceneCache[key], fmt).then(function (p) {
      FS.buildMagnet(p, o);
      var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k);
      FS.draw(c.getContext('2d'), p, { scale: k, max: Math.round(size * 1.4), export: true });
      return c;
    });
  };
  FS.SHOWCASE = [
    { type: 'wedding', names: 'נועה & דניאל', date: '2026-06-12', frame: 'classic', seed: 3 },
    { type: 'barmitzvah', names: 'יונתן', date: '2026-03-20', frame: 'stars', seed: 5 },
    { type: 'wedding', names: 'שירה & עומר', date: '2026-08-04', frame: 'floral', color: '#e9a8a6', seed: 9 },
    { type: 'birthday', names: 'מאיה 30', date: '2026-05-02', frame: 'polaroid', fmt: 'm66', seed: 4 },
    { type: 'brit', names: 'ברוך הבא אריאל', date: '2026-01-15', frame: 'boho', color: '#a3b18a', seed: 6 },
    { type: 'engagement', names: 'היא אמרה כן!', date: '2026-02-14', frame: 'hearts', seed: 8 },
    { type: 'company', names: 'כנס השנתי 2026', date: '2026-09-10', frame: 'neon', color: '#35c8ff', seed: 11 }
  ];

  /* a photo object around a drawn scene (or a real picture) */
  FS.photoFrom = function (src, fmt) {
    return FS.loadImg(src).then(function (im) { return { id: FS.uid(), name: 'דוגמה', src: im.src, doc: FS.newDoc(im, fmt || 'magnet'), undo: [], redo: [], cache: {} }; });
  };
})();
