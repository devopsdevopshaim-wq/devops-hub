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

  function api(action, data) {
    var body = new URLSearchParams(data || {});
    body.set('action', action);
    if (!body.has('token') && token()) body.set('token', token());
    // form-encoded: a "simple" request, no CORS preflight
    return fetch(API, { method: 'POST', body: body })
      .then(function (r) {
        // n8n answers 404 while the workflow is not imported or not active
        if (r.status === 404) return { ok: false, error: 'not-ready' };
        return r.json().catch(function () { return { ok: false, error: 'bad-response' }; });
      });
  }

  var resolveReady;
  var ready = new Promise(function (res) { resolveReady = res; });
  var Auth = window.HasadnaAuth = { ready: ready, session: null, api: api, logout: logout, token: token };

  function enter(s) {
    Auth.session = s;
    root.classList.remove('locked');
    root.classList.add(s.role === 'admin' ? 'is-admin' : 'is-client');
    var g = document.getElementById('gate');
    if (g) g.remove();
    addUserChip(s);
    resolveReady(s);
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
    w.textContent = 'שלום ' + (s.name || '') + ' · נפתחו לך ' + n + ' אתרים' + until;
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
  function check() {
    if (!token()) { gate(); return; }
    api('me').then(function (s) {
      if (s.ok && s.mustChange) { gate('', { change: true }); return; }   // signed in with an initial password: the next step is choosing one
      if (s.ok && (!needAdmin || s.role === 'admin')) enter(s);
      else {
        // only a definite "no" signs the browser out; a busy or unreachable server must not
        if (!s.ok && (s.error === 'signed-out' || s.error === 'inactive' || s.error === 'device-revoked')) store('');
        gate(s.error === 'not-ready' ? 'מערכת הכניסה עוד לא הופעלה ב־n8n.' : s.error === 'rate-limited' ? 'יותר מדי בקשות. נסו שוב בעוד כמה דקות.' : s.error === 'ip-blocked' ? 'הכתובת (IP) שממנה אתם מתחברים לא מאושרת. פנו למנהל.' : s.error === 'device-revoked' ? 'המכשיר הזה הוסר. היכנסו שוב.' : s.error === 'inactive' ? 'הגישה שלך הסתיימה. כדי לחדש, דברו איתי בוואטסאפ.' : needAdmin && s.ok ? 'המסך הזה פתוח רק למנהל.' : 'הכניסה הקודמת הסתיימה. היכנסו שוב.');
      }
    }).catch(function () { gate('מערכת הכניסה לא עונה כרגע. נסו לרענן בעוד רגע.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
