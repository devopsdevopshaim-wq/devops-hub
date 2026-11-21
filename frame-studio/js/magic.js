/* The magnet that wakes up (m.html): the QR on a printed magnet opens this page on the guest's phone. A tap wakes it: the
   person comes forward out of the magnet in 3D with gold light, the guest's own voice greeting plays, the written greeting
   shows; the phone's tilt moves the 3D. Below, the time capsule: a message (written or spoken) for the couple, sealed until
   a year after the event. The magnet's own code is the only key here: it opens this magnet and nothing else of the event. */
(function () {
  'use strict';
  var L = window.FL, MC = window.MagicCore, $ = function (id) { return document.getElementById(id); };
  var info = null, layers = null, still = null, audio = null, raf = 0, t0 = 0, tilt = { x: 0, y: 0 }, want = { x: 0, y: 0 }, live = false, rec = null;
  function src(k) { return L.base.then(function (u) { return u + '/frame-live-img?e=' + L.e + '&c=' + L.c + '&k=' + k; }); }
  function load(url) { return new Promise(function (ok, no) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = no; i.src = url; }); }
  function fail(t) { $('load').textContent = t; }
  if (!L.e || !L.c) return fail('הקוד לא שלם. סורקים שוב את ה־QR שעל המגנט.');

  L.call({ action: 'magic', e: L.e, c: L.c }).then(function (r) {
    if (!r.ok) return fail(L.msg(r));
    info = r; document.title = '✨ ' + r.title;
    capsule();
    cta();
    if (r.pending) { fail('✨ המגנט שלכם עוד בדרך לשרת (הוא מודפס עכשיו). נסו שוב בעוד דקה.'); setTimeout(function () { location.reload(); }, 45000); return; }
    var m = r.magnet;
    return src('img').then(load).then(function (img) {
      still = img;
      var cv = $('cv'), k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      $('load').hidden = true; $('wake').hidden = false;
      if (m.name || m.text) { var w = $('wish'); w.hidden = false; w.innerHTML = (m.text ? '<p class="mg-text">“' + L.esc(m.text) + '”</p>' : '') + (m.name ? '<p class="mg-name">— ' + L.esc(m.name) + '</p>' : '') + (m.audio ? '<button type="button" class="mg-play" id="play">🔊 לשמוע את הברכה</button>' : ''); }
      if (m.audio) src('audio').then(function (u) { audio = new Audio(u); audio.preload = 'auto'; var b = $('play'); if (b) b.onclick = function () { audio.currentTime = 0; audio.play().catch(function () {}); }; });
      return m.mask ? src('mask').then(load).then(function (mask) { layers = MC.layers(img, mask, 1200); }).catch(function () { layers = null; }) : null;
    });
  }).catch(function () { fail('המגנט לא נטען. בודקים חיבור ומנסים שוב.'); });

  /* waking: from the still magnet to the living one, the greeting plays */
  $('wake').addEventListener('click', function () {
    $('wake').hidden = true; $('acts').hidden = false; live = true; t0 = performance.now();
    if (audio) audio.play().catch(function () {});
    if (navigator.vibrate) navigator.vibrate(30);
    raf = requestAnimationFrame(loop);
  });
  function loop(now) {
    var cv = $('cv'), ctx = cv.getContext('2d'), t = ((now - t0) / 6000) % 1;
    tilt.x += (want.x - tilt.x) * 0.08; tilt.y += (want.y - tilt.y) * 0.08;
    if (layers) MC.magnetFrame(ctx, layers, t, rec ? { x: Math.sin(t * 6.28) * 0.6, y: 0 } : tilt);
    else { ctx.drawImage(still, 0, 0, cv.width, cv.height); MC.sheen(ctx, cv.width, cv.height, t); }   /* no person found: the magnet shines */
    raf = requestAnimationFrame(loop);
  }
  /* the phone's tilt moves the 3D (iPhone asks once) */
  $('tilt').addEventListener('click', function () {
    var go = function () { window.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; want.x = Math.max(-1, Math.min(1, e.gamma / 25)); want.y = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); }); L.toast('מטים את הטלפון ✨'); };
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {}); else go();
  });
  $('stage').addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; var r = $('cv').getBoundingClientRect(); want.x = ((e.clientX - r.left) / r.width - 0.5) * 2; want.y = ((e.clientY - r.top) / r.height - 0.5) * 2; });
  /* a video of the living magnet, for WhatsApp and stories */
  $('rec').addEventListener('click', function () {
    var cv = $('cv'), b = this;
    if (!cv.captureStream || !window.MediaRecorder) return L.toast('הדפדפן הזה לא שומר סרטון. מצלמים מסך 🙂', 5000);
    var type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(function (x) { return MediaRecorder.isTypeSupported(x); })[0], chunks = [];
    rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 6000000 });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var blob = new Blob(chunks, { type: type.split(';')[0] }), name = 'magnet' + (/mp4/.test(type) ? '.mp4' : '.webm'), file = window.File ? new File([blob], name, { type: blob.type }) : null;
      rec = null; b.disabled = false; b.textContent = '🎬 שמירת סרטון';
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: info.title }).catch(function () {}); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    };
    t0 = performance.now(); rec.start(); b.disabled = true; b.textContent = '⏺ מקליט…';
    setTimeout(function () { if (rec && rec.state === 'recording') rec.stop(); }, 12100);
  });

  /* ---------- the time capsule ---------- */
  function capsule() {
    var box = $('cap'), opens = info.capsuleOpens, today = new Date().toISOString().slice(0, 10);
    if (!opens || today >= opens) return;
    box.hidden = false;
    box.innerHTML = '<h2>💌 קפסולת זמן ל' + L.esc(info.couple || 'זוג') + '</h2><p>השאירו הודעה שתיפתח רק ב־<b>' + L.esc(L.heDate(opens)) + '</b>, ביום השנה הראשון. עד אז היא חתומה, וגם הזוג לא יכול לקרוא אותה.</p>' +
      '<label>השם שלכם<input id="cn" maxlength="40" autocomplete="name"></label><label>ההודעה<textarea id="ct" maxlength="600" rows="4" placeholder="מה הייתם רוצים להגיד להם בעוד שנה?"></textarea></label>' +
      '<div class="mg-row"><button type="button" id="cv-rec">🎙️ הקלטה קולית (עד 30 שניות)</button><span id="cv-st"></span></div>' +
      '<button type="button" class="mg-send" id="cs">🔒 חתימה ושליחה לקפסולה</button>';
    var voice = null, mr = null;
    $('cv-rec').addEventListener('click', function () {
      var b = this;
      if (mr && mr.state === 'recording') return mr.stop();
      if (!navigator.mediaDevices || !window.MediaRecorder) return L.toast('ההקלטה לא נתמכת בדפדפן הזה. כותבים במקום 🙂');
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (x) { return MediaRecorder.isTypeSupported(x); })[0], ch = [];
        mr = new MediaRecorder(st, type ? { mimeType: type, audioBitsPerSecond: 32000 } : {});
        mr.ondataavailable = function (e) { if (e.data.size) ch.push(e.data); };
        mr.onstop = function () {
          st.getTracks().forEach(function (t) { t.stop(); }); b.textContent = '🎙️ הקלטה מחדש';
          var blob = new Blob(ch, { type: (type || 'audio/webm').split(';')[0] }), fr = new FileReader();
          fr.onload = function () { voice = { b64: String(fr.result).split(',')[1], mime: blob.type }; $('cv-st').textContent = '✔ הוקלט (' + Math.round(blob.size / 1024) + ' KB)'; };
          fr.readAsDataURL(blob);
        };
        mr.start(); b.textContent = '⏹ סיום הקלטה'; $('cv-st').textContent = '⏺ מקליט…';
        setTimeout(function () { if (mr && mr.state === 'recording') mr.stop(); }, 30000);
      }, function () { L.toast('אין גישה למיקרופון. כותבים במקום 🙂'); });
    });
    $('cs').addEventListener('click', function () {
      var b = this, text = $('ct').value.trim(), name = $('cn').value.trim();
      if (!text && !voice) return L.toast('כותבים הודעה או מקליטים');
      b.disabled = true; b.textContent = 'שולח…';
      L.call({ action: 'capsule-put', e: L.e, c: L.c, name: name, text: text, audio: voice ? voice.b64 : '', amime: voice ? voice.mime : '' }).then(function (r) {
        if (!r.ok) { b.disabled = false; b.textContent = '🔒 חתימה ושליחה לקפסולה'; return L.toast(r.error === 'capsule-closed' ? 'הקפסולה כבר נפתחה.' : L.msg(r), 5000); }
        box.innerHTML = '<h2>🔒 ההודעה נחתמה</h2><p>היא תגיע ל' + L.esc(info.couple || 'זוג') + ' ב־<b>' + L.esc(L.heDate(r.opens)) + '</b>. תודה! 💛</p>';
      });
    });
  }
  function cta() {
    var b = info.biz || {}, a = $('cta'); if (!b.name) return;
    a.hidden = false; a.href = 'index.html'; a.innerHTML = '🧲 מגנטים חיים כאלה באירוע שלכם? <b>' + L.esc(b.name) + '</b> ←';
  }
})();
