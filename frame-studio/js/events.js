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
    var inBand = band > m * 0.16, total = lines.reduce(function (s, l) { return s + l.size * 1.25; }, 0);
    var y = inBand ? H.y + H.h + (band - total) / 2 : d.h - total - m * 0.06;
    lines.forEach(function (l) {
      var size = Math.round(Math.min(l.size, inBand ? band * 0.55 : l.size));
      d.layers.push({ id: FS.uid(), type: 'text', magnet: true, text: l.text, x: d.w / 2, y: y + size * 0.62, size: size, font: l.font, weight: l.weight,
        color: inBand ? ink : '#ffffff', shadow: !inBand, strokeW: 0, stroke: '#000000', r: 0, opacity: 1, align: 'center' });
      y += size * 1.25;
    });
    if (o.logo && FS.img(o.logo)) {
      var li = FS.img(o.logo), s = m * 0.16 / Math.max(li.naturalWidth, li.naturalHeight);
      d.layers.push({ id: FS.uid(), type: 'image', magnet: true, src: o.logo, s: s, x: H.x + H.w - li.naturalWidth * s / 2 - m * 0.03, y: H.y + H.h - li.naturalHeight * s / 2 - m * 0.03, r: 0, opacity: 0.95 });
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
  /* a photo object around a drawn scene (or a real picture) */
  FS.photoFrom = function (src, fmt) {
    return FS.loadImg(src).then(function (im) { return { id: FS.uid(), name: 'דוגמה', src: im.src, doc: FS.newDoc(im, fmt || 'magnet'), undo: [], redo: [], cache: {} }; });
  };
})();
