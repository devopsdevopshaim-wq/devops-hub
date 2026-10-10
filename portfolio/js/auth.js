/* Sign-in gate for the portfolio.
   Everyone signs in with email + phone and a one-time code. The admin sees
   everything; a client sees only the sites the admin gave them, while their
   subscription is active. The rules live in n8n (n8n/hasadna-access.json).

   window.HasadnaAuth.ready resolves with the session ({role, name, sites}) once
   someone is signed in. Pages wait for it before showing anything. */
(function () {
  'use strict';

  var API = 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-auth';
  var KEY = 'hasadna-session';
  var WA = 'https://wa.me/972544979771?text=' + encodeURIComponent('היי, אשמח לקבל גישה ל־SPIDER');
  var needAdmin = document.documentElement.hasAttribute('data-admin-only');
  var root = document.documentElement;
  root.classList.add('locked');

  function store(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
  function token() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  // Two sign-in servers: the one named in api.json (Cloudflare, no monthly cap) and the n8n one above. A sign-in tries them in order, so one
  // being down never keeps the admin out. A session belongs to the server that issued it, so it is kept with its address ("hasadna-ep").
  var N8N = API, EPS = [N8N], EP = 'hasadna-ep';
  var apiReady = fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && /^https:\/\//.test(j.auth || '')) EPS = [j.auth, N8N]; }).catch(function () {});
  function pinned() { try { var e = localStorage.getItem(EP); if (e) return e; } catch (x) {} return token() ? N8N : ''; }   // sessions made before api.json existed are n8n's
  function pin(u) { try { localStorage.setItem(EP, u); } catch (x) {} }

  // Actions that need no session always try the servers in order (a stale session from before the Cloudflare server existed must not pin a new sign-in to the old one).
  var FREE = /^(login|forgot|signup|info|request|verify)$/;
  function api(action, data) {
    var free = FREE.test(action);
    var body = new URLSearchParams(data || {});
    body.set('action', action);
    if (!free && !body.has('token') && token()) body.set('token', token());
    // form-encoded: a "simple" request, no CORS preflight
    return apiReady.then(function () {
      var sess = !free && token() && pinned();
      var list = sess ? [pinned()] : EPS, i = 0, last = { ok: false, error: 'server-down' }, netErr = null;
      function finish() {
        // the server this session belongs to is down while another one answers: the session cannot be used there, so sign in again
        if (sess && EPS.length > 1) {
          var others = EPS.filter(function (u) { return u !== pinned(); });
          return Promise.all(others.map(function (u) { return fetch(u, { method: 'POST', body: new URLSearchParams({ action: 'info' }) }).then(function (r) { return r.ok; }, function () { return false; }); })).then(function (oks) {
            if (oks.some(Boolean)) return { ok: false, error: 'signed-out', moved: true };
            if (netErr && !last.status) throw netErr;
            if (netErr) last.net = true;
            return last;
          });
        }
        if (netErr && !last.status) throw netErr;
        if (netErr) last.net = true;   // net: at least one server could not even be reached from this browser
        return last;
      }
      function next() {
        if (i >= list.length) return finish();
        var u = list[i++];
        return fetch(u, { method: 'POST', body: body }).then(function (r) {
          // 404 = workflow not active, 5xx = the server is failing: try the next server
          if (r.status === 404) { last = { ok: false, error: 'not-ready', status: 404 }; return next(); }
          if (r.status >= 500) { last = { ok: false, error: 'server-down', status: r.status }; return next(); }
          return r.json().catch(function () { return { ok: false, error: 'bad-response' }; }).then(function (j) {
            if (j && (j.token || (action === 'me' && j.ok))) pin(u);
            // the server no longer knows this session (it expired, or the password was replaced): tell the person and sign in again, instead of a bare "admin-only"
            if (j && !j.ok && action !== 'me' && action !== 'logout' && (j.error === 'signed-out' || j.error === 'admin-only') && Auth.session && !Auth.session.offline && token()) expired();
            return j;
          });
        }, function (e) { netErr = e; return next(); });
      }
      return next();
    });
  }

  var expiredOnce = false;
  function expired() {
    if (expiredOnce) return; expiredOnce = true;
    store(''); try { localStorage.removeItem(EP); localStorage.removeItem('hasadna-last'); } catch (x) {}
    alert('ההתחברות פגה (נכנסים מחדש). לא נשמר כלום.');
    location.reload();
  }

  var resolveReady;
  var ready = new Promise(function (res) { resolveReady = res; });
  var Auth = window.HasadnaAuth = { ready: ready, session: null, api: api, logout: logout, token: token };

  // the last good session is kept for a week: if the n8n server is down, the site still opens (a limited mode) instead of locking everyone out
  var LAST = 'hasadna-last', GRACE = 7 * 86400000, GRACE_ADMIN = 30 * 86400000;
  function remember(s) { try { localStorage.setItem(LAST, JSON.stringify({ s: s, at: Date.now() })); } catch (e) {} }
  function grace() {
    try {
      var l = JSON.parse(localStorage.getItem(LAST) || 'null');
      if (!l || !l.s || Date.now() - l.at > (l.s.role === 'admin' ? GRACE_ADMIN : GRACE) || !token()) return null;
      if (needAdmin && l.s.role !== 'admin') return null;
      return Object.assign({}, l.s, { offline: true });
    } catch (e) { return null; }
  }

  function enter(s) {
    Auth.session = s;
    if (!s.offline) remember(s);
    root.classList.remove('locked');
    root.classList.add(s.role === 'admin' ? 'is-admin' : 'is-client');
    var g = document.getElementById('gate');
    if (g) g.remove();
    addUserChip(s);
    if (s.offline) offlineBar();
    heartbeat();
    resolveReady(s);
  }

  // presence: the admin's screen counts who has a page open (a ping every 4 minutes, only while the tab is visible)
  var beat = 0;
  function heartbeat() {
    if (beat) return;
    var ping = function () { if (!document.hidden) api('ping').catch(function () {}); };
    beat = setInterval(ping, 240000);   // every 4 minutes: each call is one n8n execution, so it stays rare
  }

  function offlineBar() {
    var b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:sticky;top:0;z-index:99;padding:8px 14px;text-align:center;background:#3b2f10;color:#ffd98a;font:14px Assistant,sans-serif';
    b.textContent = (Auth.session && Auth.session.emergency ? 'מצב חירום: כלים מקומיים בלבד (מודלי AI, תכנית עסקית). ' : 'שרת הכניסה לא זמין כרגע, האתר פתוח במצב מוגבל. ') + 'פעולות ניהול ושמירה יחזרו כשהשרת יחזור. ';
    var re = document.createElement('a'); re.href = '#'; re.textContent = 'כניסה מחדש'; re.style.cssText = 'color:#ffe9b0;text-decoration:underline';
    re.addEventListener('click', function (e) { e.preventDefault(); store(''); try { localStorage.removeItem(EP); localStorage.removeItem(LAST); } catch (x) {} location.reload(); });
    b.appendChild(re);
    document.body.insertBefore(b, document.body.firstChild);
  }

  function logout() {
    api('logout').catch(function () {}).then(function () { store(''); location.reload(); });
  }

  function addUserChip(s) {
    var nav = document.querySelector('.nav-inner');
    if (!nav) return;
    var chip = document.createElement('div');
    chip.className = 'user-chip';
    var left = '';
    if (s.role === 'client' && s.expiresAt) {
      var d = Math.ceil((Date.parse(s.expiresAt) - Date.now()) / 86400000);
      left = d <= 3 ? ' · נשארו ' + d + ' ימים' : '';
    }
    chip.innerHTML = '<span></span><button type="button" class="chip-pw">סיסמה</button><button type="button" class="chip-out">יציאה</button>';
    chip.querySelector('span').textContent = (s.role === 'admin' ? '★ מנהל' : '👤 ' + (s.name || 'לקוח')) + left;
    chip.querySelector('.chip-out').addEventListener('click', logout);
    chip.querySelector('.chip-pw').addEventListener('click', changePassword);
    nav.appendChild(chip);
    if (s.role === 'admin') adminMenu(nav);
    if (s.role === 'client') welcome(s);
  }

  // the admin's way in to the management screens, one tap from the main screen
  function adminMenu(nav) {
    if (document.getElementById('admin-fab')) return;
    var base = (document.currentScript && document.currentScript.src || '').replace(/js\/auth\.js.*$/, '');
    if (!base) { var sc = document.querySelector('script[src*="auth.js"]'); base = sc ? sc.src.replace(/js\/auth\.js.*$/, '') : './'; }
    var box = document.createElement('div');
    box.id = 'admin-fab';
    box.className = 'admin-fab';
    box.innerHTML = '<button type="button" class="af-btn" aria-haspopup="true" aria-expanded="false">⚙ ניהול</button>' +
      '<div class="af-menu" hidden>' +
      '<a href="' + base + 'ai.html">🤖 מודלי AI</a>' +
      '<a href="' + base + 'migrate.html">🚚 העברת לקוחות לשרת חדש</a>' +
      '<a href="' + base + 'plan.html">📋 תכנית עסקית</a>' +
      '<a href="' + base + 'admin.html#usage">📈 שימוש באתר</a>' +
      '<a href="' + base + 'admin.html">מרכז הבקרה</a>' +
      '<a href="' + base + 'admin.html#clients">לקוחות והרשאות</a>' +
      '<a href="' + base + 'admin.html#biz">לידים ועסקים</a>' +
      '<a href="' + base + 'admin.html#skills">סקילים</a>' +
      '<a href="' + base + 'admin.html#media">מוזיקה וסרטונים</a></div>';
    var btn = box.querySelector('.af-btn'), menu = box.querySelector('.af-menu');
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', function () { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
    document.body.appendChild(box);
  }

  // a line under the menu, so the client sees whose site this is and until when
  function welcome(s) {
    var nav = document.querySelector('.nav');
    if (!nav || document.getElementById('welcome')) return;
    var w = document.createElement('div');
    w.id = 'welcome';
    w.className = 'welcome';
    var n = Array.isArray(s.sites) ? s.sites.length : 0;
    var until = s.expiresAt ? ' · הגישה שלך בתוקף עד ' + new Date(s.expiresAt).toLocaleDateString('he-IL') : '';
    w.textContent = 'שלום ' + (s.name || '') + ' · ' + (n === 1 ? 'נפתח לך אתר אחד' : n === 2 ? 'נפתחו לך שני אתרים' : 'נפתחו לך ' + n + ' אתרים') + until;
    nav.parentNode.insertBefore(w, nav.nextSibling);
  }

  // choosing a new password, from any page, with the current one
  function changePassword() {
    var old = document.getElementById('pw-dialog');
    if (old) { old.remove(); return; }
    var d = document.createElement('div');
    d.id = 'pw-dialog';
    d.className = 'gate pw-dialog';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="gate-card">' +
        '<h1>החלפת סיסמה</h1>' +
        '<form class="gate-form" novalidate>' +
          '<label class="field"><span>הסיסמה הנוכחית</span><input name="current" type="password" dir="ltr" autocomplete="current-password" required></label>' +
          '<label class="field"><span>סיסמה חדשה <small>(8 תווים לפחות)</small></span><input name="password" type="password" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
          '<label class="field"><span>עוד פעם, לוודא</span><input name="again" type="password" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
          '<button class="btn btn-gold" type="submit">שמירה</button>' +
          '<button class="g-btn ghost" type="button" data-close>ביטול</button>' +
        '</form>' +
        '<p class="gate-sent" id="pw-ok" hidden>✓ הסיסמה הוחלפה. חיבורים אחרים שלכם נסגרו.</p>' +
        '<p class="add-error" id="pw-err" role="alert" hidden></p>' +
      '</div>';
    document.body.appendChild(d);
    var f = d.querySelector('form'), err = d.querySelector('#pw-err'), ok = d.querySelector('#pw-ok');
    function say(t) { err.textContent = t; err.hidden = !t; }
    d.querySelector('[data-close]').addEventListener('click', function () { d.remove(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.remove(); });
    f.elements.current.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault(); ok.hidden = true;
      if (f.elements.password.value.length < 8) { say('הסיסמה החדשה: 8 תווים לפחות.'); return; }
      if (f.elements.password.value !== f.elements.again.value) { say('שתי הסיסמאות לא זהות.'); return; }
      say('');
      api('change-password', { current: f.elements.current.value, password: f.elements.password.value }).then(function (j) {
        if (!j.ok) { say(j.error === 'bad-login' ? 'הסיסמה הנוכחית לא נכונה.' : j.error === 'rate-limited' || j.error === 'too-many' ? 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' : 'לא הוחלפה: ' + j.error); return; }
        f.reset(); ok.hidden = false; setTimeout(function () { d.remove(); }, 2200);
      }).catch(function () { say('מערכת הכניסה לא עונה. נסו שוב בעוד רגע.'); });
    });
  }

  // ---------------------------------------------------------------- the gate
  // email + password. The first time (or after "forgot"), the password is an initial one that arrived by email, and the next
  // step is choosing one's own. opts.change opens straight at that step (the page was reloaded in the middle of it).
  function gate(msg, opts) {
    opts = opts || {};
    var old = document.getElementById('gate');
    if (old) old.remove();
    var g = document.createElement('div');
    g.id = 'gate';
    g.className = 'gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-labelledby', 'gate-title');
    g.innerHTML =
      '<div class="gate-card">' +
        '<a class="brand spider-brand" href="services.html" aria-label="SPIDER"><img src="img/spider.svg" alt="" width="40" height="40"><span class="wordmark">SPIDER</span></a>' +
        '<h1 id="gate-title">' + (needAdmin ? 'כניסת מנהל' : 'כניסה') + '</h1>' +
        '<p class="gate-lead" id="gate-lead">' + (needAdmin ? 'המסך הזה פתוח רק למנהל המערכת.' : 'נכנסים עם המייל והסיסמה שלכם. עוד אין סיסמה, או שכחתם? אפשר לקבל סיסמה ראשונית למייל. ממכשיר חדש נשלחת אליכם סיסמה זמנית למייל.') + '</p>' +
        '<form class="gate-form" id="gate-pw" novalidate>' +
          '<label class="field"><span>מייל</span><input name="email" type="email" dir="ltr" autocomplete="username" required></label>' +
          '<label class="field"><span>סיסמה</span><input name="password" type="password" dir="ltr" autocomplete="current-password" required></label>' +
          '<label class="field" id="gate-pw-totp" hidden><span>קוד מאפליקציית האימות</span><input name="totp" class="gate-code" inputmode="numeric" autocomplete="off" maxlength="6" dir="ltr"></label>' +
          '<button class="btn btn-gold" type="submit">כניסה</button>' +
          '<button class="g-btn ghost" type="button" id="gate-forgot">קבלת סיסמה ראשונית למייל</button>' +
          '<label class="field" id="gate-name" hidden><span>איך קוראים לכם?</span><input name="name" autocomplete="name" maxlength="60"></label>' +
          '<button class="g-btn ghost" type="button" id="gate-signup" hidden>אין לי חשבון: הרשמה (בלי אישור, הסיסמה מגיעה למייל)</button>' +
        '</form>' +
        '<form class="gate-form" id="gate-chg" novalidate hidden>' +
          '<label class="field"><span>סיסמה חדשה <small>(8 תווים לפחות)</small></span><input name="password" type="password" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
          '<label class="field"><span>עוד פעם, לוודא</span><input name="again" type="password" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
          '<button class="btn btn-gold" type="submit">שמירה וכניסה</button>' +
        '</form>' +
        '<p class="gate-sent" id="gate-info" role="status" hidden></p>' +
        '<p class="add-error" id="gate-err" role="alert"' + (msg ? '' : ' hidden') + '>' + (msg || '') + '</p>' +
        '<p class="gate-owner">חיים קריספין · <a href="tel:+972544979771" dir="ltr">054-4979771</a></p>' +
        '<p class="gate-foot">אין לך גישה עדיין? <a href="' + WA + '" target="_blank" rel="noopener">דברו איתי בוואטסאפ</a> · <a href="services.html">שירותים ומחירים</a></p>' +
      '</div>';
    document.body.appendChild(g);

    var err = g.querySelector('#gate-err'), info = g.querySelector('#gate-info'), fpw = g.querySelector('#gate-pw'), fchg = g.querySelector('#gate-chg');
    function fail(t) { err.textContent = t; err.hidden = !t; if (t) info.hidden = true; }
    function note(t) { info.textContent = t; info.hidden = !t; if (t) err.hidden = true; }
    function busy(f, on) { var b = f.querySelector('button[type=submit]'); b.disabled = on; b.classList.toggle('busy', on); }
    var ERR = {
      'bad-input': 'בדקו את המייל ואת הסיסמה.',
      'too-many': 'יותר מדי ניסיונות. נסו שוב בעוד שעה.',
      'inactive': 'הגישה שלך לא פעילה כרגע. כדי לחדש, דברו איתי בוואטסאפ.',
      'rate-limited': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      'bad-login': 'המייל או הסיסמה לא נכונים.',
      'bad-device': 'הדפדפן הזה לא מאפשר לשמור מזהה מכשיר. פתחו חלון רגיל (לא פרטי) ונסו שוב.',
      'pending': 'המכשיר הזה חדש, והכניסה ממנו מחכה לאישור המנהל. אפשר גם לפנות אליו בוואטסאפ.',
      'verify-device': 'זה מכשיר חדש. שלחנו למייל שלכם סיסמה זמנית. הקלידו אותה כאן בשדה הסיסמה, ובחרו אחר כך סיסמה חדשה. כך המכשיר הזה מאושר, בלי שאף אחד צריך לאשר.',
      'ip-blocked': 'הכתובת (IP) שממנה אתם מתחברים לא מאושרת. פנו למנהל.',
      'device-revoked': 'המכשיר הזה הוסר. היכנסו שוב.',
      'forbidden': 'הכניסה אפשרית רק מתוך האתר.',
      'weak-password': 'הסיסמה צריכה להיות באורך 8 תווים לפחות.',
      'signed-out': 'הכניסה פגה. היכנסו שוב עם הסיסמה הראשונית.',
      'wrong-totp': 'קוד האפליקציה לא נכון, או שכבר נעשה בו שימוש. חכו לקוד הבא.',
      'server-down': 'שרת הכניסה לא עונה כרגע. זו לא הסיסמה. (אם הכתובת spider-auth…workers.dev לא נפתחת בדפדפן הזה, ייתכן שהרשת או הסינון חוסמים אותה: נסו רשת אחרת, כמו נתוני הנייד.)',
      'not-ready': 'מערכת הכניסה עוד לא הופעלה ב־n8n.'
    };

    // The device id is a random number kept in this browser, so the admin can tell devices apart.
    function deviceId() {
      try {
        var d = localStorage.getItem('spider-device');
        if (d && /^[a-f0-9]{32}$/.test(d)) return d;
        var a = new Uint8Array(16); crypto.getRandomValues(a);
        d = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        localStorage.setItem('spider-device', d);
        return d;
      } catch (e) { return ''; }
    }
    try { var lastMail = localStorage.getItem('spider-mail'); if (lastMail) fpw.elements.email.value = lastMail; } catch (e) {}

    function showChange() {
      fpw.hidden = true; fchg.hidden = false; fail(''); note('');
      g.querySelector('#gate-lead').textContent = 'נכנסתם עם סיסמה ראשונית. בחרו עכשיו סיסמה משלכם, ומעכשיו תיכנסו איתה.';
      setTimeout(function () { fchg.elements.password.focus(); }, 30);
    }
    function finish() {
      api('me').then(function (s) {
        if (s.ok && !s.mustChange) enter(s);
        else if (s.ok && s.mustChange) showChange();
        else fail(ERR[s.error] || 'לא הצלחתי להיכנס. נסו שוב.');
      }).catch(function () { fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    }

    fpw.addEventListener('submit', function (e) {
      e.preventDefault();
      var mail = fpw.elements.email.value.trim(), pass = fpw.elements.password.value, totp = fpw.elements.totp.value.replace(/\D/g, '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { fail('בדקו את כתובת המייל.'); fpw.elements.email.focus(); return; }
      if (!pass) { fail('הקלידו את הסיסמה, או בקשו סיסמה ראשונית למייל.'); fpw.elements.password.focus(); return; }
      try { localStorage.setItem('spider-mail', mail); } catch (x) {}
      fail(''); busy(fpw, true);
      api('login', { email: mail, password: pass, device: deviceId(), totp: totp }).then(function (j) {
        busy(fpw, false);
        if (j.ok) {
          store(j.token);
          if (needAdmin && j.role !== 'admin') { fail('המסך הזה פתוח רק למנהל.'); return; }
          fpw.elements.password.value = '';
          if (j.mustChange) showChange(); else finish();
          return;
        }
        if (j.error === 'totp-needed') {
          g.querySelector('#gate-pw-totp').hidden = false; fpw.elements.totp.focus();
          fail('עוד צעד אחד: הקלידו את הקוד מאפליקציית האימות.');
          return;
        }
        if (j.error === 'verify-device') {
          fpw.elements.password.value = ''; fpw.elements.password.focus();
          note(ERR['verify-device'] + (j.sent === false ? ' (אם לא הגיע מייל, נסו שוב בעוד שעה.)' : ' כדאי לבדוק גם בספאם.'));
          return;
        }
        if (j.error === 'bad-login' || j.error === 'wrong-totp') fpw.elements.password.value = '';
        if (j.error === 'server-down' || j.error === 'not-ready') emergency();
        fail((ERR[j.error] || 'משהו השתבש: ' + j.error) + (j.error === 'bad-login' && j.left != null && j.left <= 3 ? ' נשארו ' + j.left + ' ניסיונות.' : ''));
      }).catch(function () { busy(fpw, false); fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    });
    fpw.elements.totp.addEventListener('input', function () { if (fpw.elements.totp.value.replace(/\D/g, '').length === 6) fpw.requestSubmit ? fpw.requestSubmit() : fpw.dispatchEvent(new Event('submit')); });

    // an initial password by email, to the address typed above
    var forgot = g.querySelector('#gate-forgot');
    forgot.addEventListener('click', function () {
      var mail = fpw.elements.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { fail('הקלידו קודם את כתובת המייל שלכם.'); fpw.elements.email.focus(); return; }
      forgot.disabled = true;
      api('forgot', { email: mail }).then(function (j) {
        if (!j.ok) { forgot.disabled = false; fail(ERR[j.error] || 'משהו השתבש: ' + j.error); return; }
        try { localStorage.setItem('spider-mail', mail); } catch (x) {}
        note('אם הכתובת רשומה, שלחתי אליה סיסמה ראשונית. כדאי לבדוק גם בספאם. מקלידים אותה כאן בשדה הסיסמה, ובוחרים סיסמה משלכם.');
        fpw.elements.password.value = ''; fpw.elements.password.focus();
        setTimeout(function () { forgot.disabled = false; }, 30000);
      }).catch(function () { forgot.disabled = false; fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    });

    // opening an account by oneself: name + email, the initial password arrives by email at once
    var sup = g.querySelector('#gate-signup'), nameF = g.querySelector('#gate-name');
    if (!needAdmin) api('info').then(function (j) { if (j && j.signup) { sup.hidden = false; } }).catch(function () {});
    sup.addEventListener('click', function () {
      if (nameF.hidden) { nameF.hidden = false; fpw.elements.name.focus(); sup.textContent = 'שליחת הרשמה'; return; }
      var mail = fpw.elements.email.value.trim(), nm = fpw.elements.name.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { fail('הקלידו את כתובת המייל שלכם.'); fpw.elements.email.focus(); return; }
      if (nm.length < 2) { fail('הקלידו את השם שלכם.'); fpw.elements.name.focus(); return; }
      sup.disabled = true;
      api('signup', { email: mail, name: nm }).then(function (j) {
        if (!j.ok) { sup.disabled = false; fail(j.error === 'signup-closed' ? 'ההרשמה סגורה כרגע. דברו איתי בוואטסאפ.' : (ERR[j.error] || 'משהו השתבש: ' + j.error)); return; }
        try { localStorage.setItem('spider-mail', mail); } catch (x) {}
        note('נרשמתם! שלחתי למייל סיסמה ראשונית. מקלידים אותה בשדה הסיסמה, ובוחרים סיסמה משלכם. כדאי לבדוק גם בספאם.');
        nameF.hidden = true; sup.hidden = true; fpw.elements.password.value = ''; fpw.elements.password.focus();
      }).catch(function () { sup.disabled = false; fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    });

    // choosing one's own password
    fchg.addEventListener('submit', function (e) {
      e.preventDefault();
      var p1 = fchg.elements.password.value, p2 = fchg.elements.again.value;
      if (p1.length < 8) { fail(ERR['weak-password']); return; }
      if (p1 !== p2) { fail('שתי הסיסמאות לא זהות.'); fchg.elements.again.focus(); return; }
      fail(''); busy(fchg, true);
      api('change-password', { password: p1 }).then(function (j) {
        busy(fchg, false);
        if (!j.ok) { fail(ERR[j.error] || 'משהו השתבש: ' + j.error); if (j.error === 'signed-out') { store(''); location.reload(); } return; }
        fchg.elements.password.value = ''; fchg.elements.again.value = '';
        finish();
      }).catch(function () { busy(fchg, false); fail('מערכת הכניסה לא עונה כרגע.'); });
    });

    if (opts.change) showChange();
    else setTimeout(function () { (fpw.elements.email.value ? fpw.elements.password : fpw.elements.email).focus(); }, 50);
  }

  // access.json switches sign-in on. Until then the site stays open, as before.
  function start() {
    fetch('access.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { enabled: true }; })
      .catch(function () { return { enabled: true }; })
      .then(function (cfg) {
        // ?login=1 tries the sign-in before it is switched on for everyone
        // a page marked data-require-login (the clients' page) always asks for sign-in, whatever the switch says
        if (cfg.enabled === false && !root.hasAttribute('data-require-login') && !/[?&]login=1\b/.test(location.search)) { Auth.open = true; root.classList.remove('locked'); resolveReady({ role: 'admin', name: '', sites: 'all', open: true }); return; }
        check();
      });
  }
  // an admin page while no sign-in server answers: a way in to the tools that work without one (the pages themselves are public files)
  function emergency() {
    var g = document.getElementById('gate'); if (!g || !needAdmin || g.querySelector('.gate-emerg')) return;
    var card = g.querySelector('.gate-card'); if (!card) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gate-emerg g-btn ghost'; b.style.marginTop = '14px';
    b.textContent = 'כניסת חירום: כלים מקומיים בלי שרת';
    b.addEventListener('click', function () { enter({ ok: true, role: 'admin', name: 'מנהל', sites: 'all', offline: true, emergency: true }); });
    card.appendChild(b);
  }
  function check() {
    if (!token()) { gate(); return; }
    api('me').then(function (s) {
      if (s.ok && s.mustChange) { gate('', { change: true }); return; }   // signed in with an initial password: the next step is choosing one
      if (s.ok && (!needAdmin || s.role === 'admin')) enter(s);
      else {
        // only a definite "no" signs the browser out; a busy or unreachable server must not
        if (!s.ok && (s.error === 'signed-out' || s.error === 'inactive' || s.error === 'device-revoked')) store('');
        var g = (s.error === 'server-down' || s.error === 'not-ready') ? grace() : null;
        if (g) { enter(g); return; }
        var downMsg = (s.error === 'server-down' || s.error === 'not-ready');
        var gm = (s.error === 'not-ready' ? 'מערכת הכניסה עוד לא הופעלה ב־n8n.' : s.error === 'server-down' ? 'שרת הכניסה ב־n8n לא עונה כרגע. נסו שוב מאוחר יותר.' : s.error === 'rate-limited' ? 'יותר מדי בקשות. נסו שוב בעוד כמה דקות.' : s.error === 'ip-blocked' ? 'הכתובת (IP) שממנה אתם מתחברים לא מאושרת. פנו למנהל.' : s.error === 'device-revoked' ? 'המכשיר הזה הוסר. היכנסו שוב.' : s.error === 'inactive' ? 'הגישה שלך הסתיימה. כדי לחדש, דברו איתי בוואטסאפ.' : needAdmin && s.ok ? 'המסך הזה פתוח רק למנהל.' : 'הכניסה הקודמת הסתיימה. היכנסו שוב.');
        gate(gm); if (s.error === 'server-down' || s.error === 'not-ready') emergency();
      }
    }).catch(function () { var g = grace(); if (g) { enter(g); return; } gate('מערכת הכניסה לא עונה כרגע. נסו לרענן בעוד רגע.'); emergency(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
