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
    'admin-only': 'האזור הזה לבעל העסק בלבד.', 'server-error': 'תקלה בשרת. נסו שוב.', 'too-big': 'גדול מדי לשמירה.', 'too-many-clients': 'אין מקום לחשבונות חדשים כרגע.', 'card-number': 'אסור לשמור כאן מספר כרטיס אשראי. התשלום באשראי עובר רק דרך קישור הסליקה.'
  };
  function msg(r) { return MSG[r && r.error] || (r && r.error ? 'שגיאה: ' + r.error : 'שגיאה'); }

  var A = FS.account = {
    msg: msg,
    session: load,
    signedIn: function () { var s = load(); return !!(s && s.token && !s.mustChange); },
    isAdmin: function () { var s = load(); return !!(s && s.token && s.role === 'admin' && !s.mustChange); },
    login: function (email, password, totp) {
      return auth('login', { email: email, password: password, device: device(), totp: totp || '' }).then(function (r) {
        if (r.ok) keep({ token: r.token, role: r.role, name: r.name || '', email: String(email).trim().toLowerCase(), mustChange: !!r.mustChange, at: Date.now() });
        return r;
      });
    },
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
  /* the site's content: business.json in the repository, with what the owner published from the admin on top */
  FS.siteData = function (prefix) {
    prefix = prefix || '';
    var file = fetch(prefix + 'business.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    var live = base.then(function (u) { var c = window.AbortController ? new AbortController() : null; setTimeout(function () { if (c) c.abort(); }, 4000); return fetch(u + '/frame-site', { cache: 'no-cache', signal: c ? c.signal : undefined }); })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.all([file, live]).then(function (x) {
      var b = Object.assign({}, x[0] || {}, (x[1] && x[1].site) || {});
      b.__frames = (x[1] && x[1].frames) || []; b.__live = !!(x[1] && x[1].site);
      return b;
    });
  };
  FS.frameFileUrl = function (id) { return base.then(function (u) { return u + '/frame-file?id=' + encodeURIComponent(id); }); };
})();
