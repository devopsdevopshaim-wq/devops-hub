/* 📸 The photo booth (v185, home screen button 3): a screen the guests use themselves. A photo (the camera on this device with
   a 3-2-1, the photographer's latest photo, or a file), then a design the guest chooses: every AI design of the studio in
   tabs (✨ מדהימים, פנטזיה, ילדים, גיבורי על, סגנונות, ויראלי: FS.restyle, on the local engine, the studio's computer or the
   cloud, with the people checks), or "⚡ מהירים", 20 styles that run on this computer at once (15 instant ones of styles.js
   and the 5 of offline-ai.js); then how many copies, and print. The photo joins the studio's
   photos like any other (the event's magnet template comes with it, FS.afterAdd), so it is also in the workspace afterwards.
   Leaving the booth: hold "✕" for a second and a half (a guest's tap does not close it), or Esc. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.addPhotoFile) return;
  var INSTANT = ['cartoon', 'comic', 'manga', 'pop', 'sketch', 'oil', 'watercolor', 'stained', 'noir', 'duotone', 'oldphoto', 'pastel', 'lomo', 'engrave', 'neon'];
  var ONNX = ['anime', 'candy', 'rain', 'udnie', 'mosaic'];
  function local(id) { return (FS.LOCAL_STYLES || []).filter(function (s) { return s[0] === id; })[0]; }
  function onnx(id) { return (FS.OFFLINE_AI || []).filter(function (s) { return s[0] === id; })[0]; }
  /* [key, name, icon, kind] */
  var STYLES = [['', 'רגיל', '📷', 'none']]
    .concat(ONNX.filter(onnx).map(function (id) { var s = onnx(id); return ['x:' + id, s[1], s[2], 'onnx']; }))
    .concat(INSTANT.filter(local).map(function (id) { var s = local(id); return ['i:' + id, s[1], s[2], 'instant']; }));
  FS.BOOTH_STYLES = STYLES;
  /* v185: the AI designs, the same ones as the workspace's AI tab, chosen by the guest: they run on the AI engine of this
     computer, the studio's computer (a phone or a tablet as the booth) or the cloud (FS.restyle, with every people check) */
  function aiTabs() {
    var K = FS.AI_KEEP || '', KF = FS.AI_KEEP_FREE || '';
    var t = [
      ['wow', '✨ מדהימים', (FS.AI_WOW || []).map(function (v) { return [v[1], v[2], v[3] + K]; })],
      ['fa', '🐉 פנטזיה', (FS.AI_FANTASY || []).map(function (v) { return [v[0], v[1], v[2]]; })],
      ['ki', '🧸 ילדים', (FS.AI_KIDS || []).map(function (v) { return [v[0], v[1], v[2]]; })],
      ['he', '🦸 גיבורי על', (FS.AI_HEROES || []).map(function (v) { return [v[0], v[1], v[2]]; })],
      ['st', '🎨 סגנונות', (FS.AI_STYLES || []).map(function (v) { return [v[1], v[2], v[3] + K]; })],
      ['vi', '🔥 ויראלי', (FS.AI_VIRAL || []).map(function (v) { return [v[0], v[1], v[2] + '.' + KF]; })]
    ].filter(function (x) { return x[2].length; });
    t.push(['fast', '⚡ מהירים (בלי המתנה)', null]);
    return t;
  }
  var tab = 'wow';

  var root = document.createElement('div'); root.id = 'booth'; root.hidden = true; root.setAttribute('dir', 'rtl');
  root.innerHTML =
    '<button type="button" class="bo-x" id="bo-x" title="יציאה: להחזיק לחוץ">✕</button>' +
    '<section class="bo-step" data-s="cam"><h1>📸 מצטלמים!</h1><div class="bo-cam"><video id="bo-v" playsinline muted></video><div class="bo-count" id="bo-count" hidden></div><p class="bo-nocam" id="bo-nocam" hidden>אין מצלמה במכשיר הזה. בוחרים תמונה מהצלם או מהמחשב.</p></div>' +
      '<div class="bo-row"><button type="button" class="bo-big primary" id="bo-shot">📸 צילום (3, 2, 1)</button><button type="button" class="bo-big" id="bo-last">🖼️ התמונה האחרונה של הצלם</button><label class="bo-big">📂 תמונה מהמחשב<input type="file" id="bo-file" accept="image/*" hidden></label></div></section>' +
    '<section class="bo-step" data-s="style" hidden><h1>בוחרים סגנון וכמה עותקים</h1><div class="bo-main"><div class="bo-pv"><canvas id="bo-pv"></canvas><div class="bo-wait" id="bo-wait" hidden>מעצב…</div></div>' +
      '<div class="bo-side"><div class="bo-tabs" id="bo-tabs"></div><div class="bo-styles" id="bo-styles"></div><div class="bo-copies"><span>עותקים</span><button type="button" id="bo-minus">−</button><b id="bo-n">1</b><button type="button" id="bo-plus">+</button></div>' +
      '<div class="bo-row"><button type="button" class="bo-big" id="bo-again">↺ צילום חוזר</button><button type="button" class="bo-big primary" id="bo-print">🖨️ להדפסה</button></div></div></div></section>' +
    '<section class="bo-step" data-s="done" hidden><h1>✅ תודה! ההדפסה בדרך</h1><p class="bo-thanks" id="bo-thanks"></p></section>';
  document.body.appendChild(root);
  var $ = function (s) { return root.querySelector(s); };
  var stream = null, p = null, n = 1, cur = '', thumbs = {}, busy = false, back = null;

  function step(s) { Array.prototype.forEach.call(root.querySelectorAll('.bo-step'), function (x) { x.hidden = x.dataset.s !== s; }); }
  function camOn() {
    if (stream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('#bo-nocam').hidden = !!stream; return; }
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }).then(function (st) {
      stream = st; var v = $('#bo-v'); v.srcObject = st; v.play().catch(function () {}); $('#bo-nocam').hidden = true; $('#bo-shot').disabled = false;
    }, function () { $('#bo-nocam').hidden = false; $('#bo-shot').disabled = true; });
  }
  function camOff() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function open() {
    root.hidden = false; document.body.classList.add('bo-on'); if (FS.mate && FS.mate.isOn()) FS.mate.close();
    reset();
  }
  function close() { root.hidden = true; document.body.classList.remove('bo-on'); camOff(); clearTimeout(back); p = null; }
  function reset() { clearTimeout(back); p = null; cur = ''; tab = 'wow'; n = 1; thumbs = {}; step('cam'); camOn(); }

  /* the photo */
  function take(file) {
    if (busy) return; busy = true; FS.busy && FS.busy('מכין את התמונה…');
    FS.addPhotoFile(file).then(function (ph) {
      busy = false; FS.busy && FS.busy(); p = ph; p.booth = true; p.copies = 1;
      if (FS.buildStrip) FS.buildStrip();   /* not 'photos-added': that opens the workspace over the booth */
      styleStep();
    }, function (e) { busy = false; FS.busy && FS.busy(); FS.toast((e && e.why) || 'התמונה לא נפתחה. מנסים שוב.', 4000); });
  }
  $('#bo-shot').addEventListener('click', function () {
    var v = $('#bo-v'); if (!stream || !v.videoWidth) return; var c = $('#bo-count'), k = 3; c.hidden = false; c.textContent = k;
    var t = setInterval(function () {
      k--; if (k > 0) { c.textContent = k; return; }
      clearInterval(t); c.textContent = '😊';
      var cv = FS.canvas(v.videoWidth, v.videoHeight), x = cv.getContext('2d'); x.translate(cv.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
      root.classList.add('bo-flash'); setTimeout(function () { root.classList.remove('bo-flash'); c.hidden = true; }, 350);
      cv.toBlob(function (b) { take(new File([b], 'עמדת צילום ' + new Date().toLocaleTimeString('he-IL').replace(/:/g, '.') + '.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.95);
    }, 900);
  });
  $('#bo-file').addEventListener('change', function () { if (this.files[0]) take(this.files[0]); this.value = ''; });
  $('#bo-last').addEventListener('click', function () {
    var L = FS.state.photos.filter(function (q) { return !q.booth && !q.collage && !q.strip; }), q = L[L.length - 1];
    if (!q) return FS.toast('עוד אין תמונות מהצלם. מוסיפים תמונות בעריכת מגנטים, או מחברים את תיקיית המצלמה.', 4500);
    p = q; p.copies = p.copies || 1; styleStep();
  });

  /* the styles: small previews of this photo, then the big one */
  function srcImg() { return FS.img(p.origSrc || p.src); }
  function thumbOf(key, size) {
    var im = srcImg(), k = Math.min(1, size / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    var c = FS.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
    if (!key) return Promise.resolve(c);
    if (key.indexOf('i:') === 0) { var d = x.getImageData(0, 0, w, h); FS.applyStyle(d.data, w, h, { id: key.slice(2), amt: 100 }, true); x.putImageData(d, 0, 0); return Promise.resolve(c); }
    return FS.offlineStyleCanvas(key.slice(2), im, size);
  }
  function styleStep() {
    step('style'); n = p.copies || 1; $('#bo-n').textContent = n;
    var T = aiTabs(); if (!T.some(function (x) { return x[0] === tab; })) tab = T[0][0];
    $('#bo-tabs').innerHTML = T.map(function (x) { return '<button type="button" data-tab="' + x[0] + '"' + (x[0] === tab ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('');
    grid(); preview();
  }
  function grid() {
    var box = $('#bo-styles'), T = aiTabs(), cur0 = T.filter(function (x) { return x[0] === tab; })[0];
    Array.prototype.forEach.call(root.querySelectorAll('#bo-tabs [data-tab]'), function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (cur0 && cur0[2]) {
      box.className = 'bo-styles bo-ai';
      box.innerHTML = '<button type="button" class="bo-st' + (!cur ? ' on' : '') + '" data-k=""><span class="bo-th">📷</span><b>רגיל</b></button>' +
        cur0[2].map(function (v, i) { var k = 'a:' + tab + ':' + i; return '<button type="button" class="bo-st' + (k === cur ? ' on' : '') + '" data-k="' + k + '"><span class="bo-th">' + v[1] + '</span><b>' + v[0] + '</b></button>'; }).join('');
      return;
    }
    box.className = 'bo-styles';
    box.innerHTML = STYLES.map(function (s) { return '<button type="button" class="bo-st' + (s[0] === cur ? ' on' : '') + '" data-k="' + s[0] + '"><span class="bo-th">' + s[2] + '</span><b>' + s[1] + '</b></button>'; }).join('');
    /* the instant ones at once, the built-in AI ones one after the other (a model is loaded the first time) */
    var q = Promise.resolve(), mine = p;
    STYLES.forEach(function (s) {
      q = q.then(function () { if (p !== mine || root.hidden || tab !== 'fast') return; return thumbOf(s[0], 150).then(function (c) {
        var b = box.querySelector('[data-k="' + s[0] + '"] .bo-th'); if (!b || p !== mine) return; c.className = 'bo-thc'; b.textContent = ''; b.appendChild(c);
      }, function () { var b = box.querySelector('[data-k="' + s[0] + '"]'); if (b) b.classList.add('bo-off'); }); });
    });
  }
  $('#bo-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; grid(); });
  function preview() {
    var c = $('#bo-pv'), r = FS.renderFull(p, Math.min(1, 900 / Math.max(p.doc.w, p.doc.h)));
    c.width = r.width; c.height = r.height; c.getContext('2d').drawImage(r, 0, 0);
  }
  function apply(key) {
    if (busy) return; busy = true; $('#bo-wait').hidden = false;
    Array.prototype.forEach.call(root.querySelectorAll('.bo-st'), function (b) { b.classList.toggle('on', b.dataset.k === key); });
    if (p.origSrc && FS.unstyle) FS.unstyle(p);
    p.doc.photo.style = null;
    var job;
    if (key.indexOf('a:') === 0) {
      var k = key.split(':'), T = aiTabs().filter(function (x) { return x[0] === k[1]; })[0], v = T && T[2][Number(k[2])];
      $('#bo-wait').textContent = '✨ מעצבים את התמונה… (עד דקה)';
      FS.aiBatch && FS.aiBatch(true);
      job = v ? FS.restyle(p, v[2]).then(function (r) { FS.aiBatch && FS.aiBatch(false); return r; }, function (e) { FS.aiBatch && FS.aiBatch(false); throw e; }) : Promise.reject(new Error('style'));
    } else { $('#bo-wait').textContent = 'מעצב…'; job = !key ? Promise.resolve() : key.indexOf('i:') === 0 ? Promise.resolve(p.doc.photo.style = { id: key.slice(2), amt: 100 }) : FS.restyleOffline(p, key.slice(2)); }
    job.then(function () { p.cache = {}; if (FS.snap) FS.snap(p); cur = key; preview(); }, function (e) {
      var m = String(e && e.message || '');
      FS.toast(/lost|extra|not-same/.test(m) ? 'העיצוב הזה לא שמר על כל האנשים, אז הוא לא הוחל. בוחרים עיצוב אחר 🙂' : key.indexOf('a:') === 0 ? (FS.aiError ? FS.aiError(m) : 'העיצוב לא הצליח. בוחרים עיצוב אחר.') : 'הסגנון הזה לא נטען במכשיר הזה. בוחרים סגנון אחר.', 6000);
      Array.prototype.forEach.call(root.querySelectorAll('.bo-st'), function (b) { b.classList.toggle('on', b.dataset.k === ''); }); cur = ''; preview(); })
      .then(function () { busy = false; $('#bo-wait').hidden = true; });
  }
  $('#bo-styles').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b && !b.classList.contains('bo-off')) apply(b.dataset.k); });
  $('#bo-minus').addEventListener('click', function () { n = Math.max(1, n - 1); $('#bo-n').textContent = n; });
  $('#bo-plus').addEventListener('click', function () { n = Math.min(10, n + 1); $('#bo-n').textContent = n; });
  $('#bo-again').addEventListener('click', function () { if (p && p.booth) { var i = FS.state.photos.indexOf(p); if (i >= 0 && FS.removePhoto) FS.removePhoto(i); } reset(); });
  $('#bo-print').addEventListener('click', function () {
    if (!p || busy) return; p.copies = n; if (FS.snap) FS.snap(p);
    var ok = FS.mate && FS.mate.quickReady && FS.mate.quickReady() ? FS.mate.printList([p]) : (FS.printNow({ list: [p], paper: FS.prefs.paper || '15x20', layout: 'fill', margin: 0, gap: 0 }), true);
    if (ok === false) return;
    var nm = 'רגיל'; if (cur.indexOf('a:') === 0) { var k = cur.split(':'), T = aiTabs().filter(function (x) { return x[0] === k[1]; })[0]; nm = T && T[2][Number(k[2])] ? T[2][Number(k[2])][0] : 'AI'; } else if (cur) nm = (STYLES.filter(function (s) { return s[0] === cur; })[0] || ['', ''])[1];
    $('#bo-thanks').textContent = n + (n > 1 ? ' עותקים' : ' עותק') + ' · ' + nm;
    step('done'); back = setTimeout(reset, 6000);
  });
  root.addEventListener('click', function (e) { if (e.target.closest('[data-s="done"]')) reset(); });

  /* leaving: hold ✕ (or Esc on the keyboard) */
  var hold = null, xb = $('#bo-x');
  xb.addEventListener('pointerdown', function () { xb.classList.add('holding'); hold = setTimeout(function () { xb.classList.remove('holding'); close(); if (FS.home) FS.home.show(); }, 1500); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { xb.addEventListener(ev, function () { clearTimeout(hold); xb.classList.remove('holding'); }); });
  document.addEventListener('keydown', function (e) { if (!root.hidden && e.key === 'Escape') { close(); if (FS.home) FS.home.show(); } });
  FS.booth = { open: open, close: close, isOn: function () { return !root.hidden; } };
})();
