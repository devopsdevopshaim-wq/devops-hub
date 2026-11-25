/* live.html: a guest scans the QR code on the table, takes a photo (or picks one), adds a name, a greeting and a short voice
   message if they like, and sends it. It reaches the studio's print queue and becomes a magnet; the greeting goes into the
   couple's album. The photo is made smaller on the phone first (long side 1600px), so it goes up fast on the venue's network. */
(function () {
  'use strict';
  var L = window.FL, app = document.getElementById('app'), esc = L.esc, info = null, photo = null, voice = null, rec = null, sent = 0, product = '';
  var NAME = 'fs-live-name', MINE = 'fs-live-mine', SHOP_API = 'https://regaim-events.devopsdevopshaim.workers.dev', frameSrc = '';
  /* the photos this phone sent, per event: { e: [{ id, gk, at }] } (gk = the photo's own key, from the server) */
  function mine() { try { return (JSON.parse(localStorage.getItem(MINE) || '{}') || {})[L.e] || []; } catch (e) { return []; } }
  function keepMine(id, gk) {
    try { var all = JSON.parse(localStorage.getItem(MINE) || '{}') || {}; all[L.e] = [{ id: id, gk: gk, at: Date.now() }].concat(all[L.e] || []).slice(0, 80); localStorage.setItem(MINE, JSON.stringify(all)); } catch (e) { /* private mode */ }
  }
  function mineUrl(m) { return L.base.then(function (u) { return u + '/frame-live-img?e=' + L.e + '&p=' + m.id + '&v=' + m.gk; }); }

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
    if (r.frame) L.base.then(function (u) { frameSrc = u + '/frame-live-img?e=' + L.e + '&fr=1&v=' + L.k; var im = new Image(); im.src = frameSrc; });
    form();
  });

  /* v219: the guests' benefit, set by the studio for the event: shown from the day after the event (or the day the studio set)
     for its week, every time the app opens, with the code and the store */
  /* v220: after the event (uploads closed, or closed for the night at the event's hour): the photos this phone sent, and the
     upgrades: an enlargement 15×20 (a magnet or a block), an album of the guest's own photos, more albums */
  function after(night) {
    var hour = info.closeAt || '23:00';
    app.innerHTML = '<section class="card hero"><p class="brand">' + (night ? '🌙' : '💛') + '</p><p class="hello">' + (night
      ? 'ההעלאה להדפסה באירוע נסגרה ב־' + esc(hour) + '.<br><b>מחר</b> תוכלו לשלוח את התמונות שלכם ולהזמין מהן מגנטים, הגדלות ואלבום, דרך האפליקציה 🛍️'
      : 'העלאת התמונות לאירוע הזה נסגרה. תודה שהייתם איתנו! 💛') + '</p></section>' + offerHtml() + '<div id="mine"></div>' + (window.FLApp ? FLApp.storeHtml() : '');
    drawMine();
  }
  function drawMine() {
    var box = document.getElementById('mine'), list = mine(), o = info.offer && info.offer.live ? info.offer : null; if (!box) return;
    if (!list.length) { box.innerHTML = ''; return; }
    var up = [];
    if (o && o.enlarge) up.push('⬆️ הגדלה 15×20 (מגנט או בלוק): <b>' + o.enlarge.pct + '% הנחה</b>');
    if (o) up.push('📖 אלבום מהאירוע עם ' + list.length + ' התמונות שלכם: <b>' + o.pct + '% הנחה</b>' + (o.what && !/אלבום/.test(o.what) ? ' על ' + esc(o.what) : ''));
    if (o && o.extra) up.push('📚 עוד אלבום (לסבתא, לחברים): <b>' + o.extra.pct + '% הנחה</b> על כל אלבום נוסף');
    box.innerHTML = '<section class="card"><h2>📸 התמונות ששלחתם (' + list.length + ')</h2>' + (up.length ? '<ul class="lv-ups">' + up.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="lv-mine">' + list.map(function (m, i) { return '<figure data-i="' + i + '"><img alt="תמונה ששלחתם" loading="lazy"><figcaption>' +
        (o ? '<button type="button" class="lv-up" data-up="enl" data-i="' + i + '">⬆️ להגדלה</button><button type="button" class="lv-up alt" data-up="alb" data-i="' + i + '">📖 לאלבום</button>' : '<a class="lv-up alt" data-save="' + i + '">⬇️ שמירה</a>') + '</figcaption></figure>'; }).join('') + '</div></section>';
    list.forEach(function (m, i) { mineUrl(m).then(function (u) { var f = box.querySelector('figure[data-i="' + i + '"]'), im = f && f.querySelector('img'); if (!im) return; im.src = u; im.onerror = function () { f.remove(); }; var a = f.querySelector('[data-save]'); if (a) { a.href = u; a.setAttribute('download', 'אירוע-' + (i + 1) + '.jpg'); } }); });
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
  function offerHtml() {
    var o = info && info.offer; if (!o || !o.live) return '';
    var to = new Date(o.to + 'T12:00:00Z').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }), url = o.url || (window.FLApp && FLApp.store && FLApp.store()) || '';
    return '<section class="card lv-offer"><p class="lv-offer-t">🎁 הטבה לאורחי ' + esc(info.title) + '</p>' +
      '<p class="lv-offer-b"><b>' + o.pct + '% הנחה</b> על ' + esc(o.what) + '</p><p class="hello">בתוקף עד ' + esc(to) + (o.code ? ' · קוד ההטבה: <b dir="ltr">' + esc(o.code) + '</b>' : '') + '</p>' +
      (url ? '<a class="lv-send" href="' + esc(url) + (o.code ? (url.indexOf('?') < 0 ? '?' : '&') + 'promo=' + encodeURIComponent(o.code) : '') + '" target="_blank" rel="noopener">להזמנה עם ההנחה 🛍️</a>' : '') + '</section>';
  }
  /* v219: what to print, when the studio offers more than one product (a magnet, a wooden block, a cardboard frame…) */
  function productsHtml() {
    var ps = (info && info.products) || [];
    if (ps.length < 2) return ps.length ? '<p class="lv-note">' + esc((ps[0].icon || '🧲') + ' ' + ps[0].name + size(ps[0])) + '</p>' : '';
    if (!ps.some(function (x) { return x.id === product; })) product = '';
    return '<section class="card"><h2>מה להדפיס? 👇</h2><div class="lv-prods" id="prods">' + ps.map(function (x) {
      return '<button type="button" class="lv-prod' + (x.id === product ? ' on' : '') + '" data-p="' + esc(x.id) + '"><span>' + esc(x.icon || '🧲') + '</span><b>' + esc(x.name) + '</b><small>' + esc(size(x).replace(/^ · /, '')) + '</small></button>';
    }).join('') + '</div></section>';
  }
  function size(x) { return x.w && x.h ? ' · ' + x.w + '×' + x.h + ' ס״מ' : ''; }
  function canSend() { var ps = (info && info.products) || []; return !!photo && (ps.length < 2 || !!product); }
  function form() {
    var name = ''; try { name = localStorage.getItem(NAME) || ''; } catch (e) { /* private mode */ }
    app.innerHTML =
      '<section class="card hero lv-hero"><p class="brand">' + esc(info.biz.name || 'פריים מגנטים') + '<small>מגנטים לאירועים</small></p>' +
        '<h1 class="lv-title">' + esc(info.title) + '</h1><p class="hello">מצלמים, שולחים, ו<b>התמונה מודפסת כמגנט</b> 🧲</p>' + (sent ? '<p class="lv-sent">✓ שלחתם כבר ' + sent + (sent === 1 ? ' תמונה' : ' תמונות') + '</p>' : '') + '</section>' +
      '<section class="card"><div class="lv-pick" id="pick">' +
        '<label class="lv-big"><input type="file" accept="image/*" capture="environment" id="cam" hidden><span>📸</span><b>צילום עכשיו</b></label>' +
        '<label class="lv-big alt"><input type="file" accept="image/*" id="gal" hidden><span>🖼️</span><b>מהגלריה</b></label></div>' +
        '<div class="lv-prev" id="prev" hidden><img id="prev-img" alt="התמונה שבחרתם"><button type="button" class="lv-x" id="prev-x" aria-label="בחירת תמונה אחרת">✕</button></div></section>' +
      productsHtml() +
      '<section class="card"><h2>💌 ברכה לבעלי השמחה <small>(לא חובה)</small></h2>' +
        '<label class="lv-f">השם שלכם<input id="nm" maxlength="40" autocomplete="name" value="' + esc(name) + '" placeholder="למשל: דודה מירי"></label>' +
        '<label class="lv-f">ברכה<textarea id="tx" maxlength="300" rows="3" placeholder="מזל טוב! שתזכו לאושר גדול…"></textarea></label>' +
        '<div class="lv-voice" id="voice"><button type="button" class="lv-mic" id="mic">🎤 ברכה קולית (עד 30 שניות)</button><span id="mic-t"></span><audio id="mic-a" controls hidden></audio><button type="button" class="lv-x small" id="mic-x" hidden aria-label="מחיקת ההקלטה">✕</button></div></section>' +
      L.lead.html('lead', '📲 רוצים את כל התמונות מהאירוע לוואטסאפ?', 'משאירים טלפון ומקבלים את האלבום כשהוא מוכן.', info.biz && info.biz.name) +
      '<button class="lv-send" id="send" disabled>שליחה להדפסה 🧲</button>' +
      '<p class="lv-note">התמונה נשלחת רק לצלם המגנטים של האירוע ולאלבום של בעלי השמחה.</p>';
    app.insertAdjacentHTML('afterbegin', offerHtml());
    var pr = document.getElementById('prods'); if (pr) pr.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-p]'); if (!b) return; product = b.dataset.p;
      Array.prototype.forEach.call(pr.querySelectorAll('[data-p]'), function (x) { x.classList.toggle('on', x === b); }); show();
    });
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
    var pv = document.getElementById('prev'), fo = document.getElementById('prev-fr');
    if (has && frameSrc) {
      if (!fo) { fo = document.createElement('img'); fo.id = 'prev-fr'; fo.className = 'lv-frov'; fo.alt = ''; pv.appendChild(fo); fo.onload = function () { pv.classList.add('framed'); pv.style.aspectRatio = fo.naturalWidth + ' / ' + fo.naturalHeight; }; }
      fo.src = frameSrc;
    }
    var sb = document.getElementById('send'); sb.disabled = !canSend(); sb.textContent = has && !canSend() ? 'בוחרים מה להדפיס ☝️' : 'שליחה להדפסה 🧲';
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
      /* the spoken words written down too (where the phone can: Chrome / Android, Safari), so the greeting can be printed on the magnet */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition, heard = '';
      if (SR) try {
        var sr = new SR(); sr.lang = 'he-IL'; sr.continuous = true; sr.interimResults = false;
        sr.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += (heard ? ' ' : '') + e.results[i][0].transcript; };
        sr.onend = function () { var tx = document.getElementById('tx'); if (heard && tx && !tx.value.trim()) { tx.value = heard.slice(0, 300); L.toast('✍️ הברכה נכתבה גם במילים. אפשר לתקן.', 4000); } };
        sr.start(); var stop0 = r.onstop; r.onstop = function () { try { sr.stop(); } catch (e2) { /* ended */ } stop0(); };
      } catch (e) { /* no speech-to-text here: the voice alone goes */ }
      tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); document.getElementById('mic-t').textContent = '🔴 ' + s + ' / 30'; if (s >= 30) r.stop(); }, 250);
    }, function () { L.toast('אין גישה למיקרופון. אפשר לכתוב ברכה במקום.', 4500); });
  }
  function showVoice() {
    var a = document.getElementById('mic-a'), x = document.getElementById('mic-x'), m = document.getElementById('mic'); if (!a) return;
    document.getElementById('mic-t').textContent = '';
    a.hidden = !voice; x.hidden = !voice; m.hidden = !!voice; m.textContent = '🎤 ברכה קולית (עד 30 שניות)'; if (voice) a.src = voice.url;
  }
  function send() {
    if (!canSend()) return;
    var b = document.getElementById('send'), name = document.getElementById('nm').value.trim(), text = document.getElementById('tx').value.trim();
    try { localStorage.setItem(NAME, name); } catch (e) { /* private mode */ }
    b.disabled = true; b.textContent = 'שולח…';
    L.call({ action: 'guest-up', e: L.e, k: L.k, img: photo.b64, name: name, text: text, product: product, audio: voice ? voice.b64 : '', amime: voice ? voice.mime : '' }).then(function (r) {
      if (!r.ok && r.error === 'night') { info.closeAt = info.closeAt || '23:00'; return after(true); }
      if (!r.ok) { b.disabled = false; b.textContent = 'שליחה להדפסה 🧲'; L.toast(L.msg(r), 5000); return; }
      if (r.id && r.gk) keepMine(r.id, r.gk);
      sent++; photo = null; voice = null;
      var ld = L.lead.read(document.getElementById('lead') || document.body);
      if (ld.phone && !ld.consent) L.toast('הטלפון לא נשמר: צריך לסמן את האישור.', 5000);
      else if (ld.phone) L.lead.send(ld, name).then(function (x) { if (x && x.ok) L.toast('📲 תודה! נשלח לכם את התמונות לוואטסאפ', 4000); else if (x && x.error === 'bad-phone') L.toast('מספר הטלפון לא נראה תקין', 4000); });
      app.innerHTML = '<section class="card hero lv-done"><p class="lv-ok">✓</p><h1 class="lv-title">התמונה נשלחה!</h1><p class="hello">היא בתור להדפסה. גשו לעמדת המגנטים לאסוף אותה 🧲' +
        (text ? '<br>והברכה שלכם תחכה לבעלי השמחה באלבום 💌' : '') + '</p><button class="lv-send" id="again">📸 עוד תמונה</button>' +
        (window.FLApp ? FLApp.storeHtml() : '') + '</section>';
      document.getElementById('again').addEventListener('click', form);
      if (window.FLApp) FLApp.afterSend();
    });
  }
})();
