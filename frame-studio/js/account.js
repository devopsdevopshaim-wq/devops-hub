/* Accounts for פריים מגנטים, on the sites' sign-in server (Cloudflare Worker, the same one as SPIDER's): email and password,
   an initial password sent by email, choosing one's own password, the owner's authenticator code, and new devices approved
   from the mailbox. Passwords are checked and kept (as PBKDF2 hashes) only on the server; this page keeps just the session.
   FS.account.call(action, data) reaches the business data (/frame-biz) with the session; the server decides who may do what. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  var DEFAULT = 'https://spider-auth.devopsdevopshaim.workers.dev', KEY = 'frame-session', DEV = 'fs-device';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var base = window.FS_API ? Promise.resolve(window.FS_API) : fetch('../portfolio/api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (j) { return j && /^https:\/\/[\w.-]+$/.test(String(j.base || '').replace(/\/+$/, '')) ? j.base.replace(/\/+$/, '') : DEFAULT; }).catch(function () { return DEFAULT; });

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function keep(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  function device() {
    var d = ''; try { d = localStorage.getItem(DEV) || ''; } catch (e) { /* ignore */ }
    if (!/^[a-f0-9]{32}$/.test(d)) { var a = new Uint8Array(16); crypto.getRandomValues(a); d = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); try { localStorage.setItem(DEV, d); } catch (e) { /* ignore */ } }
    return d;
  }
  function auth(action, data) {
    var body = new URLSearchParams(data || {}); body.set('action', action);
    return base.then(function (u) { return fetch(u + '/hasadna-auth', { method: 'POST', body: body }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; });
  }
  var MSG = {
    'bad-login': 'המייל או הסיסמה לא נכונים.', 'too-many': 'יותר מדי ניסיונות. נסו שוב בעוד שעה, או בקשו סיסמה ראשונית למייל.', 'rate-limited': 'יותר מדי בקשות. נסו שוב בעוד כמה דקות.',
    'bad-input': 'בודקים את המייל (והשם, בהרשמה).', 'weak-password': 'סיסמה של לפחות 8 תווים.', inactive: 'החשבון לא פעיל. פנו לבעל העסק.', 'signup-closed': 'ההרשמה סגורה כרגע.',
    'verify-device': 'זה מכשיר חדש. שלחנו סיסמה זמנית למייל: נכנסים איתה כדי לאשר את המכשיר.', 'signed-out': 'פג תוקף הכניסה. נכנסים שוב.', offline: 'אין חיבור לשרת. בודקים אינטרנט.',
    'admin-only': 'האזור הזה לבעל העסק בלבד.', 'server-error': 'תקלה בשרת. נסו שוב.', 'too-big': 'גדול מדי לשמירה.', 'too-many-clients': 'אין מקום לחשבונות חדשים כרגע.', 'card-number': 'אסור לשמור כאן מספר כרטיס אשראי. התשלום באשראי עובר רק דרך קישור הסליקה.',
    'bad-contact': 'צריך שם, וטלפון או מייל תקינים.', 'bad-date': 'בוחרים תאריך עתידי לאירוע.', 'bad-email': 'כתובת המייל לא תקינה.', full: 'אי אפשר לקבל בקשות כרגע. כתבו לנו בוואטסאפ.',
    'date-taken': 'התאריך כבר תפוס ביומן.', already: 'הבקשה כבר אושרה.', 'not-frame-only': 'זה חשבון שמשמש גם אתרים אחרים, ולכן נחסם רק מהמנהל הראשי.', 'not-found': 'לא נמצא.'
  };
  function msg(r) { return MSG[r && r.error] || (r && r.error ? 'שגיאה: ' + r.error : 'שגיאה'); }

  /* kept on this computer so the first sign-in stays: in the desktop program the owner's email and password, encrypted by the
     operating system (Electron safeStorage, DPAPI on Windows), for a quiet sign-in when the server's session runs out; and the
     licence's email and code (in a browser too: it is the person's own code). "🚪 יציאה" forgets them. */
  var VD = function () { return window.FSDesktop && window.FSDesktop.vault; };
  var VAULT = FS.vault = {
    get: function (k) { var d = VD(); if (d) return Promise.resolve(d.get(k)).then(function (v) { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }, function () { return null; }); try { return Promise.resolve(JSON.parse(localStorage.getItem('fs-vault-' + k) || 'null')); } catch (e) { return Promise.resolve(null); } },
    set: function (k, v) { var d = VD(); if (d) return Promise.resolve(d.set(k, JSON.stringify(v))).catch(function () {}); if (k === 'admin') return Promise.resolve(); try { localStorage.setItem('fs-vault-' + k, JSON.stringify(v)); } catch (e) { /* blocked */ } return Promise.resolve(); },
    del: function (k) { var d = VD(); if (d) return Promise.resolve(d.del(k)).catch(function () {}); try { localStorage.removeItem('fs-vault-' + k); } catch (e) { /* blocked */ } return Promise.resolve(); }
  };
  var A = FS.account = {
    msg: msg,
    apiBase: function () { return base; },
    session: load,
    signedIn: function () { var s = load(); return !!(s && s.token && !s.mustChange); },
    isAdmin: function () { var s = load(); return !!(s && s.token && s.role === 'admin' && !s.mustChange); },
    login: function (email, password, totp) {
      return auth('login', { email: email, password: password, device: device(), totp: totp || '' }).then(function (r) {
        if (r.ok) keep({ token: r.token, role: r.role, name: r.name || '', email: String(email).trim().toLowerCase(), mustChange: !!r.mustChange, at: Date.now() });
        if (r.ok && r.role === 'admin' && !r.mustChange && VD()) VAULT.set('admin', { email: String(email).trim().toLowerCase(), password: password });
        return r;
      });
    },
    /* the desktop program signs the owner in again by itself (the server's session ran out); offline it answers 'offline' */
    relogin: function () {
      return VAULT.get('admin').then(function (v) { return v && v.email && v.password ? A.login(v.email, v.password) : { ok: false, error: 'no-saved' }; });
    },
    hasSaved: function () { return VD() ? VAULT.get('admin').then(function (v) { return !!(v && v.email); }) : Promise.resolve(false); },
    signup: function (name, email, phone) { return auth('signup', { name: name, email: email, phone: phone || '', site: 'frame' }); },
    forgot: function (email) { return auth('forgot', { email: email, site: 'frame' }); },
    change: function (password, current) {
      var s = load(); if (!s) return Promise.resolve({ ok: false, error: 'signed-out' });
      return auth('change-password', { token: s.token, password: password, current: current || '' }).then(function (r) { if (r.ok) { s.mustChange = false; keep(s); } return r; });
    },
    me: function () {
      var s = load(); if (!s) return Promise.resolve({ ok: false, error: 'signed-out' });
      return auth('me', { token: s.token }).then(function (r) { if (!r.ok && (r.error === 'signed-out' || r.error === 'inactive' || r.error === 'device-revoked')) keep(null); else if (r.ok) { s.role = r.role; s.mustChange = !!r.mustChange; s.name = r.name || s.name; keep(s); } return r; });
    },
    logout: function () { var s = load(); keep(null); if (s) auth('logout', { token: s.token }); },
    call: function (action, data) {
      var s = load(); if (!s) return Promise.resolve({ ok: false, error: 'signed-out' });
      var b = Object.assign({}, data || {}, { action: action, token: s.token });
      return base.then(function (u) { return fetch(u + '/frame-biz', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(b) }); })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; })
        .then(function (r) { if (r && r.error === 'signed-out') keep(null); return r; });
    },
    base: function () { return base; },
    /* customers come in without a password: a code to their email, or (phone only, or when no email can be sent yet) straight in
       as a visitor. Either way the visit is recorded on the server for the owner. */
    visitor: function () { try { return JSON.parse(localStorage.getItem('frame-visitor') || 'null'); } catch (e) { return null; } },
    setVisitor: function (v) { try { if (v) localStorage.setItem('frame-visitor', JSON.stringify(v)); else localStorage.removeItem('frame-visitor'); } catch (e) { /* private mode */ } },
    visit: function (name, contact) { return auth('frame-visit', { name: name, contact: contact }); },
    codeStart: function (name, contact) { return auth('frame-code', { name: name, contact: contact }); },
    codeVerify: function (email, code) {
      return auth('frame-code-verify', { email: email, code: code, device: device() }).then(function (r) {
        if (r.ok) keep({ token: r.token, role: r.role, name: r.name || '', email: String(email).trim().toLowerCase(), mustChange: false, at: Date.now() });
        return r;
      });
    },
    /* the customer's way in: name + phone or email; done({name, contact, verified}) */
    enterForm: function (box, opts) {
      opts = opts || {};
      var stage = 'start', who = { name: '', contact: '' }, isMail = function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); };
      function fin(verified) { var v = { name: who.name, contact: who.contact, verified: !!verified, at: Date.now() }; A.setVisitor(v); if (opts.done) opts.done(v); }
      function draw(note) {
        box.innerHTML = '<div class="acc">' + (stage === 'code'
          ? '<p class="hint">שלחנו קוד בן 6 ספרות ל־<b dir="ltr">' + esc(who.contact) + '</b>. הוא מגיע תוך דקה (בודקים גם בספאם).</p><label>הקוד מהמייל<input id="en-code" inputmode="numeric" maxlength="6" dir="ltr" autocomplete="one-time-code"></label>' +
            '<button class="btn gold wide" id="en-go">כניסה</button><button class="link" id="en-back">← לשנות מייל או טלפון</button>'
          : '<label>השם שלכם<input id="en-name" autocomplete="name" maxlength="60" value="' + esc(who.name) + '"></label><label>טלפון או מייל<input id="en-contact" autocomplete="email" dir="ltr" value="' + esc(who.contact) + '" placeholder="050-0000000 או name@mail.com"></label>' +
            '<button class="btn gold wide" id="en-go">כניסה</button><p class="hint">בלי סיסמה. עם מייל נשלח אליכם קוד כניסה חד־פעמי.</p>') +
          '<p class="acc-note" id="en-note" role="status">' + esc(note || '') + '</p></div>';
        var go = box.querySelector('#en-go'), bk = box.querySelector('#en-back');
        if (bk) bk.addEventListener('click', function () { stage = 'start'; draw(); });
        go.addEventListener('click', submit);
        Array.prototype.forEach.call(box.querySelectorAll('input'), function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } }); });
        var f = box.querySelector('input'); if (f && !opts.noFocus) setTimeout(function () { f.focus(); }, 30);
        function submit() {
          if (stage === 'code') {
            var code = String(box.querySelector('#en-code').value || '').replace(/\D/g, ''); if (code.length !== 6) return draw('6 ספרות מהמייל.');
            go.disabled = true; go.textContent = '…';
            return A.codeVerify(who.contact, code).then(function (r) { if (r.ok) return fin(true); draw(r.error === 'bad-code' ? 'הקוד לא נכון' + (r.left != null ? ' (נשארו ' + r.left + ' ניסיונות)' : '') + '.' : r.error === 'code-expired' ? 'הקוד פג. חוזרים אחורה ומבקשים קוד חדש.' : msg(r)); });
          }
          who.name = String(box.querySelector('#en-name').value || '').trim(); who.contact = String(box.querySelector('#en-contact').value || '').trim();
          if (who.name.length < 2) return draw('כותבים שם.');
          var mail = isMail(who.contact.toLowerCase()), tel = who.contact.replace(/\D/g, '').replace(/^972/, '0');
          if (!mail && !/^0\d{8,11}$/.test(tel)) return draw('טלפון (כמו 050-1234567) או כתובת מייל.');
          go.disabled = true; go.textContent = '…';
          if (!mail) return A.visit(who.name, who.contact).then(function (r) { if (r.ok || r.error === 'offline') return fin(false); draw(msg(r)); });
          who.contact = who.contact.toLowerCase();
          A.codeStart(who.name, who.contact).then(function (r) {
            if (r.ok && r.step === 'code') { stage = 'code'; return draw(); }
            /* the code could not be emailed (no email service yet): in as a visitor, the visit is already recorded */
            if (r.error === 'mail-failed' || r.error === 'offline') return fin(false);
            if (r.error === 'admin-use-password') return draw('זו כתובת המנהל: נכנסים בלשונית "כניסת מנהל".');
            draw(msg(r));
          });
        }
      }
      draw(opts.note);
    },
    /* the sign-in box: into `box`; opts.signup lets new customers open an account; done(session) when signed in */
    form: function (box, opts) {
      opts = opts || {};
      var view = 'login', pendingTotp = false, last = { email: '', pw: '' };
      function draw(note) {
        var s = load(), must = s && s.mustChange;
        box.innerHTML = '<div class="acc">' + (must ? '<h2>בוחרים סיסמה משלכם</h2><p class="hint">נכנסתם עם סיסמה ראשונית. עכשיו בוחרים סיסמה קבועה (לפחות 8 תווים).</p>' +
            '<label>סיסמה חדשה<input type="password" id="acc-new" autocomplete="new-password" minlength="8"></label><label>שוב<input type="password" id="acc-new2" autocomplete="new-password"></label><button class="btn gold wide" id="acc-set">שמירת הסיסמה</button>' :
          (opts.signup ? '<div class="seg acc-tabs"><button data-v="login" class="' + (view === 'login' ? 'on' : '') + '">כניסה</button><button data-v="signup" class="' + (view === 'signup' ? 'on' : '') + '">חשבון חדש</button></div>' : '') +
          (view === 'signup' ? '<label>שם<input id="acc-name" autocomplete="name" maxlength="60"></label><label>מייל<input id="acc-email" type="email" dir="ltr" autocomplete="email"></label><label>טלפון (לא חובה)<input id="acc-phone" type="tel" dir="ltr" autocomplete="tel"></label><button class="btn gold wide" id="acc-go">פתיחת חשבון</button><p class="hint">סיסמה ראשונית תישלח למייל. בכניסה הראשונה בוחרים סיסמה משלכם.</p>' :
            view === 'forgot' ? '<label>המייל שלכם<input id="acc-email" type="email" dir="ltr" autocomplete="email" value="' + esc(last.email) + '"></label><button class="btn gold wide" id="acc-go">שליחת סיסמה ראשונית למייל</button><button class="link" id="acc-back">← חזרה לכניסה</button>' :
            '<label>מייל<input id="acc-email" type="email" dir="ltr" autocomplete="username" value="' + esc(last.email || opts.email || '') + '"></label><label>סיסמה<input id="acc-pw" type="password" autocomplete="current-password"></label>' +
            (pendingTotp ? '<label>קוד מאפליקציית האימות (6 ספרות)<input id="acc-totp" inputmode="numeric" maxlength="6" dir="ltr" autocomplete="one-time-code"></label>' : '') +
            '<button class="btn gold wide" id="acc-go">כניסה</button><button class="link" id="acc-forgot">שכחתי סיסמה / סיסמה ראשונית למייל</button>')) +
          '<p class="acc-note" id="acc-note" role="status">' + esc(note || '') + '</p></div>';
        $$('.acc-tabs button', box).forEach(function (b) { b.addEventListener('click', function () { view = b.dataset.v; draw(); }); });
        var go = box.querySelector('#acc-go'), f = box.querySelector('#acc-forgot'), bk = box.querySelector('#acc-back'), st = box.querySelector('#acc-set');
        if (f) f.addEventListener('click', function () { last.email = val('#acc-email'); view = 'forgot'; draw(); });
        if (bk) bk.addEventListener('click', function () { view = 'login'; draw(); });
        if (st) st.addEventListener('click', function () {
          var a = val('#acc-new'), b2 = val('#acc-new2'); if (a.length < 8) return draw('סיסמה של לפחות 8 תווים.'); if (a !== b2) return draw('שתי הסיסמאות לא זהות.');
          busy(st); A.change(a).then(function (r) { if (r.ok) { if (opts.done) opts.done(load()); } else draw(msg(r)); });
        });
        if (go) go.addEventListener('click', submit);
        $$('input', box).forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (go) submit(); else if (st) st.click(); } }); });
        var first = box.querySelector('input'); if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 30);
        function submit() {
          var e = val('#acc-email');
          if (view === 'signup') { busy(go); return A.signup(val('#acc-name'), e, val('#acc-phone')).then(function (r) { last.email = e; view = 'login'; draw(r.ok ? 'שלחנו סיסמה ראשונית ל־' + e + '. היא מגיעה תוך דקה (בודקים גם בספאם).' : msg(r)); }); }
          if (view === 'forgot') { busy(go); return A.forgot(e).then(function (r) { last.email = e; view = 'login'; draw(r.ok ? 'אם המייל רשום, נשלחה אליו סיסמה ראשונית. היא מגיעה תוך דקה (בודקים גם בספאם).' : msg(r)); }); }
          last.email = e; last.pw = val('#acc-pw') || last.pw; busy(go);
          A.login(e, last.pw, val('#acc-totp')).then(function (r) {
            if (r.ok) { if (opts.adminOnly && r.role !== 'admin') { keep(null); return draw('האזור הזה לבעל העסק בלבד. לקוחות נכנסים בעורך המסגרות.'); } if (r.mustChange) return draw(); if (opts.done) opts.done(load()); return; }
            if (r.error === 'totp-needed') { pendingTotp = true; return draw('הסיסמה נכונה. עכשיו הקוד מאפליקציית האימות.'); }
            draw(msg(r) + (r.left != null && r.left < 5 && r.error === 'bad-login' ? ' (נשארו ' + r.left + ' ניסיונות)' : ''));
          });
        }
      }
      function val(sel) { var i = box.querySelector(sel); return i ? String(i.value || '').trim() : ''; }
      function busy(b) { b.disabled = true; b.textContent = '…'; }
      function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
      draw(opts.note);
    }
  };
  /* ---------- פריים־סטודיו licences: one code per person, fixed to one computer (see the server's lic-* actions) ----------
     The machine id comes from the desktop program (a hash of the computer's own id); in a browser it is this browser's device id,
     so clearing the browser's data counts as a new computer and the owner frees the old one. */
  var LIC = 'frame-license';
  function licLoad() { try { return JSON.parse(localStorage.getItem(LIC) || 'null'); } catch (e) { return null; } }
  function licKeep(v) { try { if (v) localStorage.setItem(LIC, JSON.stringify(v)); else localStorage.removeItem(LIC); } catch (e) { /* private mode */ } }
  function machine() {
    var D = window.FSDesktop;
    if (D && D.machineId) return Promise.resolve(D.machineId()).then(function (m) { return /^[a-f0-9]{32,64}$/.test(m || '') ? m : device(); }, function () { return device(); });
    return Promise.resolve(device());
  }
  FS.license = {
    AGREEMENT: 'v1',   /* agreement.html's version; a new version asks everyone to accept again */
    get: licLoad,
    info: function () { return auth('lic-info', {}); },
    isDesktop: function () { return !!(window.FSDesktop && window.FSDesktop.isDesktop); },
    activate: function (email, code) {
      return machine().then(function (m) {
        return auth('lic-activate', { email: email, code: code, machine: m, agree: FS.license.AGREEMENT, desktop: FS.license.isDesktop() ? '1' : '', platform: (window.FSDesktop && window.FSDesktop.platform) || 'web', version: (window.FSDesktop && window.FSDesktop.version) || (window.FS_V || '') });
      }).then(function (r) { if (r.ok) { licKeep({ token: r.token, email: r.email, name: r.name || '', checkedAt: Date.now() }); VAULT.set('lic', { email: String(email).trim().toLowerCase(), code: String(code).trim() }); } return r; });
    },
    saved: function () { return VAULT.get('lic'); },
    /* ok: {ok:true} online or within the grace; a revoked or moved licence is forgotten here too */
    check: function () {
      var L = licLoad(); if (!L || !L.token) return Promise.resolve({ ok: false, error: 'no-license' });
      return machine().then(function (m) { return auth('lic-check', { token: L.token, machine: m, version: (window.FSDesktop && window.FSDesktop.version) || (window.FS_V || '') }); }).then(function (r) {
        if (r.ok) { L.checkedAt = Date.now(); L.name = r.name || L.name; licKeep(L); return r; }
        /* no internet (or the server is busy): the licence keeps working, with no time limit; the server's word comes next time */
        if (r.error === 'offline' || r.error === 'rate-limited' || /^http-5/.test(r.error || '')) return { ok: true, offline: true, email: L.email, name: L.name };
        /* the session ran out (30 days): activated again quietly with the code kept on this computer */
        if (r.error === 'signed-out') return VAULT.get('lic').then(function (v) {
          if (!v || !v.code) { licKeep(null); return r; }
          return FS.license.activate(v.email, v.code).then(function (x) {
            if (x.ok) return x;
            if (x.error === 'offline' || x.error === 'rate-limited' || /^http-5/.test(x.error || '')) return { ok: true, offline: true, email: L.email, name: L.name };
            licKeep(null); VAULT.del('lic'); return x;
          });
        });
        licKeep(null); VAULT.del('lic'); return r;
      });
    },
    forget: function () { licKeep(null); VAULT.del('lic'); },
    /* the owner's licence management (an admin session) */
    admin: function (action, data) { var s = load(); return auth(action, Object.assign({}, data || {}, { token: s && s.token })); }
  };
  Object.assign(MSG, { 'bad-license': 'המייל או קוד ההפעלה לא נכונים.', 'license-in-use': 'הקוד הזה כבר מופעל במחשב אחר. כל קוד עובד במחשב אחד בלבד. להחלפת מחשב פונים לבעל העסק.',
    'license-revoked': 'הרישיון בוטל. פונים לבעל העסק.', 'license-moved': 'הרישיון שייך למחשב אחר. מפעילים מחדש עם הקוד.', 'license-exists': 'כבר יש רישיון למייל הזה.',
    'license-offline-too-long': 'צריך חיבור לאינטרנט פעם בשבוע כדי לאמת את הרישיון.', 'license-unpaid': 'הרישיון יופעל אחרי קבלת התשלום. פונים לבעל העסק.', 'agreement-needed': 'צריך לאשר את הסכם הרכישה.', 'bad-amount': 'סכום לא תקין.', 'not-found': 'לא נמצא.' });

  /* the site's content: business.json in the repository, with what the owner published from the admin on top */
  FS.siteData = function (prefix) {
    prefix = prefix || '';
    var file = fetch(prefix + 'business.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    var live = base.then(function (u) { var c = window.AbortController ? new AbortController() : null; setTimeout(function () { if (c) c.abort(); }, 4000); return fetch(u + '/frame-site', { cache: 'no-cache', signal: c ? c.signal : undefined }); })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.all([file, live]).then(function (x) {
      var b = Object.assign({}, x[0] || {}, (x[1] && x[1].site) || {});
      b.__frames = (x[1] && x[1].frames) || []; b.__live = !!(x[1] && x[1].site); b.__taken = (x[1] && x[1].taken) || [];
      return b;
    });
  };
  /* a booking request from the site: the server checks the calendar and keeps it for the owner, who approves it */
  FS.book = {
    send: function (data) {
      var s = load(), b = Object.assign({}, data); if (s && s.token && !s.mustChange) b.token = s.token;
      return base.then(function (u) { return fetch(u + '/frame-book', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(b) }); })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; });
    },
    msg: msg
  };
  FS.frameFileUrl = function (id) { return base.then(function (u) { return u + '/frame-file?id=' + encodeURIComponent(id); }); };
})();
