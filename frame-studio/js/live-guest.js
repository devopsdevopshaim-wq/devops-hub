/* live.html: a guest scans the QR code on the table, takes a photo (or picks one), adds a name, a greeting and a short voice
   message if they like, and sends it. It reaches the studio's print queue and becomes a magnet; the greeting goes into the
   couple's album. The photo is made smaller on the phone first (long side 1600px), so it goes up fast on the venue's network. */
(function () {
  'use strict';
  var L = window.FL, app = document.getElementById('app'), esc = L.esc, info = null, photo = null, voice = null, rec = null, sent = 0;
  var NAME = 'fs-live-name';

  function fail(t) { app.innerHTML = '<div class="card hero"><p class="brand">📸</p><p class="hello">' + esc(t) + '</p></div>'; }
  if (!L.e || !L.k) { fail('הקישור לא שלם. סורקים שוב את הקוד שעל השולחן.'); return; }

  L.call({ action: 'guest-info', e: L.e, k: L.k }).then(function (r) {
    if (!r.ok) return fail(L.msg(r));
    info = r; document.title = 'צלמו מגנט · ' + r.title;
    if (!r.open) return fail('העלאת התמונות לאירוע הזה נסגרה. תודה שהייתם איתנו! 💛');
    form();
  });

  function form() {
    var name = ''; try { name = localStorage.getItem(NAME) || ''; } catch (e) { /* private mode */ }
    app.innerHTML =
      '<section class="card hero lv-hero"><p class="brand">' + esc(info.biz.name || 'פריים מגנטים') + '<small>מגנטים לאירועים</small></p>' +
        '<h1 class="lv-title">' + esc(info.title) + '</h1><p class="hello">מצלמים, שולחים, ו<b>התמונה מודפסת כמגנט</b> 🧲</p>' + (sent ? '<p class="lv-sent">✓ שלחתם כבר ' + sent + (sent === 1 ? ' תמונה' : ' תמונות') + '</p>' : '') + '</section>' +
      '<section class="card"><div class="lv-pick" id="pick">' +
        '<label class="lv-big"><input type="file" accept="image/*" capture="environment" id="cam" hidden><span>📸</span><b>צילום עכשיו</b></label>' +
        '<label class="lv-big alt"><input type="file" accept="image/*" id="gal" hidden><span>🖼️</span><b>מהגלריה</b></label></div>' +
        '<div class="lv-prev" id="prev" hidden><img id="prev-img" alt="התמונה שבחרתם"><button type="button" class="lv-x" id="prev-x" aria-label="בחירת תמונה אחרת">✕</button></div></section>' +
      '<section class="card"><h2>💌 ברכה לבעלי השמחה <small>(לא חובה)</small></h2>' +
        '<label class="lv-f">השם שלכם<input id="nm" maxlength="40" autocomplete="name" value="' + esc(name) + '" placeholder="למשל: דודה מירי"></label>' +
        '<label class="lv-f">ברכה<textarea id="tx" maxlength="300" rows="3" placeholder="מזל טוב! שתזכו לאושר גדול…"></textarea></label>' +
        '<div class="lv-voice" id="voice"><button type="button" class="lv-mic" id="mic">🎤 ברכה קולית (עד 30 שניות)</button><span id="mic-t"></span><audio id="mic-a" controls hidden></audio><button type="button" class="lv-x small" id="mic-x" hidden aria-label="מחיקת ההקלטה">✕</button></div></section>' +
      '<button class="lv-send" id="send" disabled>שליחה להדפסה 🧲</button>' +
      '<p class="lv-note">התמונה נשלחת רק לצלם המגנטים של האירוע ולאלבום של בעלי השמחה.</p>';
    ['cam', 'gal'].forEach(function (id) { document.getElementById(id).addEventListener('change', function () { if (this.files && this.files[0]) take(this.files[0]); this.value = ''; }); });
    document.getElementById('prev-x').addEventListener('click', function () { photo = null; show(); });
    document.getElementById('send').addEventListener('click', send);
    if (!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) document.getElementById('voice').hidden = true;
    else { document.getElementById('mic').addEventListener('click', toggleRec); document.getElementById('mic-x').addEventListener('click', function () { voice = null; showVoice(); }); }
    show(); showVoice();
  }
  function show() {
    var has = !!photo; document.getElementById('pick').hidden = has; document.getElementById('prev').hidden = !has;
    if (has) document.getElementById('prev-img').src = photo.url;
    document.getElementById('send').disabled = !has;
  }
  /* the photo, made smaller: long side 1600px, JPEG */
  function take(file) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      var data = c.toDataURL('image/jpeg', 0.86); photo = { b64: data.split(',')[1], url: data }; show();
    };
    im.onerror = function () { URL.revokeObjectURL(url); L.toast('התמונה לא נפתחה. מנסים תמונה אחרת (JPG או PNG).', 4500); };
    im.src = url;
  }
  /* a short voice greeting */
  function toggleRec() {
    if (rec) { rec.stop(); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || '';
      var chunks = [], t0 = Date.now(), r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined), tick;
      rec = r;
      r.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = function () {
        clearInterval(tick); stream.getTracks().forEach(function (t) { t.stop(); }); rec = null;
        var blob = new Blob(chunks, { type: (r.mimeType || type || 'audio/webm') }), fr = new FileReader();
        fr.onload = function () { var s = String(fr.result); if (s.length > 900000) { L.toast('ההקלטה ארוכה מדי. עד 30 שניות.'); voice = null; } else voice = { b64: s.split(',')[1], mime: blob.type, url: URL.createObjectURL(blob) }; showVoice(); };
        fr.readAsDataURL(blob);
      };
      r.start(); document.getElementById('mic').textContent = '⏹ עצירה';
      tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); document.getElementById('mic-t').textContent = '🔴 ' + s + ' / 30'; if (s >= 30) r.stop(); }, 250);
    }, function () { L.toast('אין גישה למיקרופון. אפשר לכתוב ברכה במקום.', 4500); });
  }
  function showVoice() {
    var a = document.getElementById('mic-a'), x = document.getElementById('mic-x'), m = document.getElementById('mic'); if (!a) return;
    document.getElementById('mic-t').textContent = '';
    a.hidden = !voice; x.hidden = !voice; m.hidden = !!voice; m.textContent = '🎤 ברכה קולית (עד 30 שניות)'; if (voice) a.src = voice.url;
  }
  function send() {
    if (!photo) return;
    var b = document.getElementById('send'), name = document.getElementById('nm').value.trim(), text = document.getElementById('tx').value.trim();
    try { localStorage.setItem(NAME, name); } catch (e) { /* private mode */ }
    b.disabled = true; b.textContent = 'שולח…';
    L.call({ action: 'guest-up', e: L.e, k: L.k, img: photo.b64, name: name, text: text, audio: voice ? voice.b64 : '', amime: voice ? voice.mime : '' }).then(function (r) {
      if (!r.ok) { b.disabled = false; b.textContent = 'שליחה להדפסה 🧲'; L.toast(L.msg(r), 5000); return; }
      sent++; photo = null; voice = null;
      app.innerHTML = '<section class="card hero lv-done"><p class="lv-ok">✓</p><h1 class="lv-title">התמונה נשלחה!</h1><p class="hello">היא בתור להדפסה. גשו לעמדת המגנטים לאסוף אותה 🧲' +
        (text ? '<br>והברכה שלכם תחכה לבעלי השמחה באלבום 💌' : '') + '</p><button class="lv-send" id="again">📸 עוד תמונה</button></section>';
      document.getElementById('again').addEventListener('click', form);
    });
  }
})();
