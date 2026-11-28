/* live.html: the guests' app, the one place a guest uses (v221): they scan the QR on the table and go through three short
   steps: 1. what to print (when the studio offers more than one product), 2. the photo, seen as it will print (the product's
   shape and the event's frame), 3. a greeting if they like (name, words, a short voice message, the phone for the photos),
   and send. Then they follow it live: in the queue, at the station, printed. "📸 התמונות שלי" keeps every photo this phone
   sent, with where it is now, and after the event the benefits and the store (the shop of events-hub is only the store).
   The photo is made smaller on the phone first (long side 1600px), so it goes up fast on the venue's network. */
(function () {
  'use strict';
  var L = window.FL, app = document.getElementById('app'), esc = L.esc, info = null, photo = null, voice = null, rec = null, product = '', step = 'product', frame = null;
  var NAME = 'fs-live-name', MINE = 'fs-live-mine', SHOP_API = 'https://regaim-events.devopsdevopshaim.workers.dev';
  var QUICK = ['מזל טוב! 🎉', 'אוהבים אתכם ❤️', 'שתזכו לאושר גדול ✨', 'איזה כיף לחגוג איתכם 🥂'];
  var ST = { new: ['⏳', 'בתור להדפסה'], claimed: ['🖨️', 'מודפס עכשיו בעמדה'], printed: ['✅', 'הודפס! מחכה לכם בעמדה'], hidden: ['🙈', 'לא הודפס'] };

  /* the photos this phone sent, per event: { e: [{ id, gk, at, p }] } (gk = the photo's own key, from the server) */
  function mine() { try { return (JSON.parse(localStorage.getItem(MINE) || '{}') || {})[L.e] || []; } catch (e) { return []; } }
  function keepMine(id, gk, p) {
    try { var all = JSON.parse(localStorage.getItem(MINE) || '{}') || {}; all[L.e] = [{ id: id, gk: gk, at: Date.now(), p: p || '' }].concat(all[L.e] || []).slice(0, 80); localStorage.setItem(MINE, JSON.stringify(all)); } catch (e) { /* private mode */ }
  }
  function mineUrl(m) { return L.base.then(function (u) { return u + '/frame-live-img?e=' + L.e + '&p=' + m.id + '&v=' + m.gk; }); }
  function statusOf(list) { return list.length ? L.call({ action: 'guest-status', e: L.e, k: L.k, items: list.map(function (m) { return { id: m.id, gk: m.gk }; }) }) : Promise.resolve({ ok: true, items: [] }); }
  function $(id) { return document.getElementById(id); }

  function fail(t) { app.innerHTML = '<div class="card hero"><p class="brand">📸</p><p class="hello">' + esc(t) + '</p></div>'; }
  /* the studio's main QR (live.html?m=…): the server says which event it leads to now */
  if (!L.e && L.m) {
    fail('פותח את האירוע…');
    L.call({ action: 'main-info', m: L.m }).then(function (r) {
      if (r && r.ok) location.replace('live.html?e=' + encodeURIComponent(r.e) + '&k=' + encodeURIComponent(r.k));
      else fail(r && r.error === 'offline' ? 'אין חיבור לאינטרנט. מנסים שוב בעוד רגע.' : 'עוד אין אירוע פעיל בקוד הזה. שואלים את הצלם 📸');
    });
    return;
  }
  /* the guests' app opened from the home screen (live.html?app=1): back to the last event saved on this phone */
  if (!L.e && !L.m && window.FLApp) {
    var last = FLApp.last();
    if (last) { location.replace('live.html?e=' + encodeURIComponent(last.e) + '&k=' + encodeURIComponent(last.k)); return; }
    fail('עוד לא סרקתם קוד באירוע. בפעם הבאה סורקים את הקוד שעל השולחן, והאירוע יישמר כאן 📸'); return;
  }
  if (!L.e || !L.k) { fail('הקישור לא שלם. סורקים שוב את הקוד שעל השולחן.'); return; }

  L.call({ action: 'guest-info', e: L.e, k: L.k }).then(function (r) {
    if (!r.ok) return fail(L.msg(r));
    info = r; document.title = 'צלמו מגנט · ' + r.title;
    if (window.FLApp) FLApp.remember(r.title);
    if (!r.open || r.night) return after(r.night && r.open);
    var ps = r.products || []; product = ps.length === 1 ? ps[0].id : ''; step = ps.length > 1 ? 'product' : 'photo';
    if (r.frame) L.base.then(function (u) { var im = new Image(); im.onload = function () { frame = { src: im.src, ar: im.naturalWidth / im.naturalHeight }; if (step === 'photo' && photo) draw(); }; im.src = u + '/frame-live-img?e=' + L.e + '&fr=1&v=' + L.k; });
    draw();
  });

  /* ---------- the three steps ---------- */
  function prods() { return (info && info.products) || []; }
  function prodOf(id) { return prods().filter(function (x) { return x.id === id; })[0] || null; }
  function size(x) { return x && x.w && x.h ? x.w + '×' + x.h + ' ס״מ' : ''; }
  function head() {
    var n = mine().length, many = prods().length > 1, steps = (many ? [['product', 'מה מדפיסים']] : []).concat([['photo', 'התמונה'], ['words', 'ברכה ושליחה']]);
    var at = steps.map(function (s) { return s[0]; }).indexOf(step);
    return '<header class="lv-top"><div><p class="lv-biz">' + esc(info.biz.name || 'פריים מגנטים') + '</p><h1 class="lv-title">' + esc(info.title) + '</h1></div>' +
      (n ? '<button type="button" class="lv-minechip" id="to-mine">📸 התמונות שלי <b>' + n + '</b></button>' : '') + '</header>' +
      '<ol class="lv-steps" aria-label="שלבים">' + steps.map(function (s, i) { return '<li class="' + (i < at ? 'lv-s-done' : i === at ? 'lv-s-on' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '><i>' + (i < at ? '✓' : i + 1) + '</i>' + s[1] + '</li>'; }).join('') + '</ol>';
  }
  function draw() {
    try { window.scrollTo(0, 0); } catch (e) { /* old browser */ }
    if (step === 'product') return drawProduct();
    if (step === 'photo') return drawPhoto();
    return drawWords();
  }
  function bindHead() { var b = $('to-mine'); if (b) b.addEventListener('click', drawMineView); }

  function drawProduct() {
    app.innerHTML = head() + offerHtml() +
      '<section class="card"><h2>מה תרצו להדפיס? 👇</h2><p class="hello">בוחרים, ואז מצלמים. בעמדה מכינים לכם אותו מיד.</p><div class="lv-prods">' + prods().map(function (x) {
        return '<button type="button" class="lv-prod' + (x.id === product ? ' on' : '') + '" data-p="' + esc(x.id) + '"><span>' + esc(x.icon || '🧲') + '</span><b>' + esc(x.name) + '</b><small>' + esc(size(x)) + '</small></button>';
      }).join('') + '</div></section>';
    bindHead();
    app.querySelector('.lv-prods').addEventListener('click', function (ev) { var b = ev.target.closest('[data-p]'); if (!b) return; product = b.dataset.p; step = 'photo'; draw(); });
  }
  /* the shape the photo prints in: the event's frame when there is one, else the product turned like the photo */
  function printAr() {
    if (frame) return frame.ar;
    var p = prodOf(product); if (!p || !p.w || !p.h || !photo) return photo ? photo.ar : 0.75;
    var a = p.w / p.h; return (photo.ar >= 1) === (a >= 1) ? a : 1 / a;
  }
  function drawPhoto() {
    var p = prodOf(product);
    app.innerHTML = head() +
      '<section class="card">' + (photo
        ? '<h2>ככה זה ייצא ' + esc(p ? (p.icon || '') : '🧲') + '</h2><div class="lv-shot" style="aspect-ratio:' + printAr() + '"><img src="' + photo.url + '" alt="התמונה שבחרתם">' + (frame ? '<img class="lv-frov" src="' + esc(frame.src) + '" alt="">' : '') + '</div>' +
          '<p class="lv-note">' + esc(p ? p.name + (size(p) ? ' · ' + size(p) : '') : 'מגנט') + (prods().length > 1 ? ' · <button type="button" class="lv-link" id="chg-p">החלפה</button>' : '') + '</p>' +
          '<div class="lv-row"><button type="button" class="lv-send" id="ok-photo">✓ מעולה, ממשיכים</button><button type="button" class="lv-ghost" id="re-photo">↻ תמונה אחרת</button></div>'
        : '<h2>מצלמים או בוחרים תמונה</h2><p class="hello">טיפ: מתקרבים, כולם בתוך התמונה, ואור מהפנים 😊</p><div class="lv-pick">' +
          '<label class="lv-big"><input type="file" accept="image/*" capture="environment" id="cam" hidden><span>📸</span><b>צילום עכשיו</b></label>' +
          '<label class="lv-big alt"><input type="file" accept="image/*" id="gal" hidden><span>🖼️</span><b>מהגלריה</b></label></div>' +
          (prods().length > 1 ? '<p class="lv-note">' + esc((p && p.icon || '') + ' ' + (p ? p.name : '')) + ' · <button type="button" class="lv-link" id="chg-p">החלפה</button></p>' : '')) + '</section>';
    bindHead();
    ['cam', 'gal'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { if (this.files && this.files[0]) take(this.files[0]); this.value = ''; }); });
    var ch = $('chg-p'); if (ch) ch.addEventListener('click', function () { step = 'product'; draw(); });
    var ok = $('ok-photo'); if (ok) ok.addEventListener('click', function () { step = 'words'; draw(); });
    var re = $('re-photo'); if (re) re.addEventListener('click', function () { photo = null; draw(); });
  }
  function drawWords() {
    var name = ''; try { name = localStorage.getItem(NAME) || ''; } catch (e) { /* private mode */ }
    app.innerHTML = head() +
      '<section class="card lv-sum"><img src="' + photo.url + '" alt=""><div><b>' + esc((prodOf(product) || {}).name || 'מגנט') + '</b><button type="button" class="lv-link" id="back-photo">החלפת תמונה</button></div></section>' +
      '<section class="card"><h2>💌 ברכה לבעלי השמחה <small>(לא חובה)</small></h2>' +
        '<label class="lv-f">השם שלכם<input id="nm" maxlength="40" autocomplete="name" value="' + esc(name) + '" placeholder="למשל: דודה מירי"></label>' +
        '<div class="lv-quick" id="quick">' + QUICK.map(function (q) { return '<button type="button">' + esc(q) + '</button>'; }).join('') + '</div>' +
        '<label class="lv-f">ברכה<textarea id="tx" maxlength="300" rows="3" placeholder="כותבים כאן, או בוחרים למעלה"></textarea></label>' +
        '<div class="lv-voice" id="voice"><button type="button" class="lv-mic" id="mic">🎤 ברכה קולית (עד 30 שניות)</button><span id="mic-t"></span><audio id="mic-a" controls hidden></audio><button type="button" class="lv-x small" id="mic-x" hidden aria-label="מחיקת ההקלטה">✕</button></div></section>' +
      L.lead.html('lead', '📲 לקבל את התמונות שלכם לוואטסאפ?', 'משאירים טלפון, ואחרי האירוע נשלח לכם את כל התמונות.', info.biz && info.biz.name) +
      '<button class="lv-send" id="send">שליחה להדפסה 🧲</button>' +
      '<p class="lv-note">התמונה נשלחת רק לצלם המגנטים של האירוע ולאלבום של בעלי השמחה.</p>';
    bindHead();
    $('back-photo').addEventListener('click', function () { step = 'photo'; draw(); });
    $('quick').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; var t = $('tx'); t.value = (t.value.trim() ? t.value.trim() + ' ' : '') + b.textContent; t.focus(); });
    $('send').addEventListener('click', send);
    if (!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) $('voice').hidden = true;
    else { $('mic').addEventListener('click', toggleRec); $('mic-x').addEventListener('click', function () { voice = null; showVoice(); }); }
    showVoice();
  }

  /* the photo, made smaller: long side 1600px, JPEG */
  function take(file) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      var data = c.toDataURL('image/jpeg', 0.86); photo = { b64: data.split(',')[1], url: data, ar: c.width / c.height }; draw();
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
      r.start(); $('mic').textContent = '⏹ עצירה';
      /* the spoken words written down too (where the phone can: Chrome / Android, Safari), so the greeting can be printed on the magnet */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition, heard = '';
      if (SR) try {
        var sr = new SR(); sr.lang = 'he-IL'; sr.continuous = true; sr.interimResults = false;
        sr.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += (heard ? ' ' : '') + e.results[i][0].transcript; };
        sr.onend = function () { var tx = $('tx'); if (heard && tx && !tx.value.trim()) { tx.value = heard.slice(0, 300); L.toast('✍️ הברכה נכתבה גם במילים. אפשר לתקן.', 4000); } };
        sr.start(); var stop0 = r.onstop; r.onstop = function () { try { sr.stop(); } catch (e2) { /* ended */ } stop0(); };
      } catch (e) { /* no speech-to-text here: the voice alone goes */ }
      tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); $('mic-t').textContent = '🔴 ' + s + ' / 30'; if (s >= 30) r.stop(); }, 250);
    }, function () { L.toast('אין גישה למיקרופון. אפשר לכתוב ברכה במקום.', 4500); });
  }
  function showVoice() {
    var a = $('mic-a'), x = $('mic-x'), m = $('mic'); if (!a) return;
    $('mic-t').textContent = '';
    a.hidden = !voice; x.hidden = !voice; m.hidden = !!voice; m.textContent = '🎤 ברכה קולית (עד 30 שניות)'; if (voice) a.src = voice.url;
  }

  /* ---------- sending, and following it live ---------- */
  function send() {
    if (!photo) { step = 'photo'; return draw(); }
    if (prods().length > 1 && !product) { step = 'product'; return draw(); }
    var b = $('send'), name = $('nm').value.trim(), text = $('tx').value.trim();
    try { localStorage.setItem(NAME, name); } catch (e) { /* private mode */ }
    b.disabled = true; b.textContent = 'שולח…';
    L.call({ action: 'guest-up', e: L.e, k: L.k, img: photo.b64, name: name, text: text, product: product, audio: voice ? voice.b64 : '', amime: voice ? voice.mime : '' }).then(function (r) {
      if (!r.ok && r.error === 'night') { info.closeAt = info.closeAt || '23:00'; return after(true); }
      if (!r.ok) { b.disabled = false; b.textContent = 'שליחה להדפסה 🧲'; L.toast(L.msg(r), 5000); return; }
      var pr = prodOf(product);
      if (r.id && r.gk) keepMine(r.id, r.gk, pr ? pr.name : '');
      var ld = L.lead.read($('lead') || document.body);
      if (ld.phone && !ld.consent) L.toast('הטלפון לא נשמר: צריך לסמן את האישור.', 5000);
      else if (ld.phone) L.lead.send(ld, name).then(function (x) { if (x && x.ok) L.toast('📲 תודה! נשלח לכם את התמונות לוואטסאפ', 4000); else if (x && x.error === 'bad-phone') L.toast('מספר הטלפון לא נראה תקין', 4000); });
      var thumb = photo.url; photo = null; voice = null;
      done(r.id && r.gk ? { id: r.id, gk: r.gk } : null, thumb, !!text);
    });
  }
  var follow = 0;
  function done(m, thumb, wish) {
    app.innerHTML = '<section class="card lv-done"><img class="lv-donepic" src="' + thumb + '" alt=""><h1 class="lv-title">התמונה נשלחה! 🎉</h1>' +
      '<p class="lv-live" id="live">' + ST.new[0] + ' ' + ST.new[1] + '</p>' +
      '<p class="hello">כשהיא מודפסת תראו את זה כאן. אוספים אותה בעמדת המגנטים 🧲' + (wish ? '<br>והברכה שלכם תחכה לבעלי השמחה באלבום 💌' : '') + '</p>' +
      '<div class="lv-row"><button class="lv-send" id="again">📸 עוד תמונה</button><button class="lv-ghost" id="to-mine2">התמונות שלי</button></div>' +
      (window.FLApp ? FLApp.storeHtml() : '') + '</section>';
    $('again').addEventListener('click', function () { clearTimeout(follow); step = 'photo'; draw(); });
    $('to-mine2').addEventListener('click', function () { clearTimeout(follow); drawMineView(); });
    if (window.FLApp) FLApp.afterSend();
    if (!m) return;
    var t0 = Date.now();
    (function tick() {
      statusOf([m]).then(function (r) {
        var it = r && r.ok && r.items[0], el = $('live'); if (!el || !it) return;
        var s = ST[it.st] || ST.new; el.textContent = s[0] + ' ' + s[1]; el.className = 'lv-live ' + it.st;
        if (it.st !== 'printed' && it.st !== 'hidden' && Date.now() - t0 < 15 * 60000) follow = setTimeout(tick, 5000);
      });
    })();
  }

  /* ---------- 📸 the photos this phone sent: where each one is, and after the event the benefits ---------- */
  function drawMineView() {
    app.innerHTML = '<header class="lv-top"><div><p class="lv-biz">' + esc(info.biz.name || 'פריים מגנטים') + '</p><h1 class="lv-title">' + esc(info.title) + '</h1></div>' +
      '<button type="button" class="lv-minechip" id="back">↩ לצלם עוד</button></header><div id="mine"></div>';
    $('back').addEventListener('click', function () { step = photo ? 'words' : 'photo'; if (prods().length > 1 && !product) step = 'product'; draw(); });
    drawMine();
  }
  /* after the event (uploads closed, or closed for the night at the event's hour) */
  function after(night) {
    var hour = info.closeAt || '23:00';
    app.innerHTML = '<section class="card hero"><p class="brand">' + (night ? '🌙' : '💛') + '</p><p class="hello">' + (night
      ? 'ההעלאה להדפסה באירוע נסגרה ב־' + esc(hour) + '.<br><b>מחר</b> תוכלו לשלוח את התמונות שלכם ולהזמין מהן מגנטים, הגדלות ואלבום, דרך האפליקציה 🛍️'
      : 'העלאת התמונות לאירוע הזה נסגרה. תודה שהייתם איתנו! 💛') + '</p></section>' + offerHtml() + '<div id="mine"></div>' + (window.FLApp ? FLApp.storeHtml() : '');
    drawMine();
  }
  function drawMine() {
    var box = $('mine'), list = mine(), o = info.offer && info.offer.live ? info.offer : null; if (!box) return;
    if (!list.length) { box.innerHTML = '<section class="card"><p class="hello">עוד לא שלחתם תמונות מהטלפון הזה.</p></section>'; return; }
    var up = [];
    if (o && o.enlarge) up.push('⬆️ הגדלה 15×20 (מגנט או בלוק): <b>' + o.enlarge.pct + '% הנחה</b>');
    if (o) up.push('📖 אלבום מהאירוע עם ' + list.length + ' התמונות שלכם: <b>' + o.pct + '% הנחה</b>' + (o.what && !/אלבום/.test(o.what) ? ' על ' + esc(o.what) : ''));
    if (o && o.extra) up.push('📚 עוד אלבום (לסבתא, לחברים): <b>' + o.extra.pct + '% הנחה</b> על כל אלבום נוסף');
    box.innerHTML = '<section class="card"><h2>📸 התמונות ששלחתם (' + list.length + ')</h2>' + (up.length ? '<ul class="lv-ups">' + up.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="lv-mine">' + list.map(function (m, i) { return '<figure data-i="' + i + '"><img alt="תמונה ששלחתם" loading="lazy"><span class="lv-badge" data-st="' + esc(m.id) + '"></span><figcaption>' +
        (o ? '<button type="button" class="lv-up" data-up="enl" data-i="' + i + '">⬆️ להגדלה</button><button type="button" class="lv-up alt" data-up="alb" data-i="' + i + '">📖 לאלבום</button>' : '<a class="lv-up alt" data-save="' + i + '">⬇️ שמירה</a>') + '</figcaption></figure>'; }).join('') + '</div></section>';
    list.forEach(function (m, i) { mineUrl(m).then(function (u) { var f = box.querySelector('figure[data-i="' + i + '"]'), im = f && f.querySelector('img'); if (!im) return; im.src = u; im.onerror = function () { f.remove(); }; var a = f.querySelector('[data-save]'); if (a) { a.href = u; a.setAttribute('download', 'אירוע-' + (i + 1) + '.jpg'); } }); });
    statusOf(list).then(function (r) { (r && r.ok ? r.items : []).forEach(function (it) { var s = ST[it.st] || ST.new, b = box.querySelector('[data-st="' + it.id + '"]'); if (b) { b.textContent = s[0] + ' ' + (it.st === 'printed' ? 'הודפס' : it.st === 'claimed' ? 'בהדפסה' : it.st === 'hidden' ? 'לא הודפס' : 'בתור'); b.className = 'lv-badge ' + it.st; } }); });
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-up]'); if (!b) return;
      var m = list[Number(b.dataset.i)], code = b.dataset.up === 'enl' ? (o.enlarge && o.enlarge.code) || o.code : o.code;
      shop(m, code, b);
    });
  }
  /* to the store with this photo (it goes up to the store first) and the benefit's code; another store: the link with the code */
  function shop(m, code, btn) {
    var o = info.offer || {}, store = (window.FLApp && FLApp.store && FLApp.store()) || '';
    var withCode = function (u) { return code ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'promo=' + encodeURIComponent(code) : u; };
    if (o.url && (!store || o.url.indexOf(store) !== 0)) { window.open(withCode(o.url), '_blank', 'noopener'); return; }
    if (!store) { L.toast('החנות עוד לא מחוברת. פנו לצלם 📸', 4000); return; }
    var t = btn.textContent; btn.disabled = true; btn.textContent = '⏳';
    mineUrl(m).then(function (u) { return fetch(u); }).then(function (r) { if (!r.ok) throw new Error('img'); return r.blob(); }).then(function (b) {
      var fd = new FormData(); fd.append('file', new File([b], 'event.jpg', { type: 'image/jpeg' }));
      return fetch(SHOP_API + '/api/uploads', { method: 'POST', body: fd }).then(function (r) { return r.json(); });
    }).then(function (j) {
      if (!j || !/^\/img\/[a-f0-9]{24}$/.test(j.url || '')) throw new Error('up');
      location.href = withCode(store.replace(/[#?].*$/, '') + '?photo=' + encodeURIComponent(j.url)) + '#store';
    }).catch(function () { btn.disabled = false; btn.textContent = t; L.toast('לא הצלחנו להעביר את התמונה לחנות. נסו שוב בעוד רגע.', 4500); });
  }
  /* the guests' benefit, set by the studio for the event: shown from the day after the event for its days */
  function offerHtml() {
    var o = info && info.offer; if (!o || !o.live) return '';
    var to = new Date(o.to + 'T12:00:00Z').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }), url = o.url || (window.FLApp && FLApp.store && FLApp.store()) || '';
    return '<section class="card lv-offer"><p class="lv-offer-t">🎁 הטבה לאורחי ' + esc(info.title) + '</p>' +
      '<p class="lv-offer-b"><b>' + o.pct + '% הנחה</b> על ' + esc(o.what) + '</p><p class="hello">בתוקף עד ' + esc(to) + (o.code ? ' · קוד ההטבה: <b dir="ltr">' + esc(o.code) + '</b>' : '') + '</p>' +
      (url ? '<a class="lv-send" href="' + esc(url) + (o.code ? (url.indexOf('?') < 0 ? '?' : '&') + 'promo=' + encodeURIComponent(o.code) : '') + '" target="_blank" rel="noopener">להזמנה עם ההנחה 🛍️</a>' : '') + '</section>';
  }
})();
