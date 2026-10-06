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
    chip.innerHTML = '<span></span><button type="button">יציאה</button>';
    chip.querySelector('span').textContent = (s.role === 'admin' ? '★ מנהל' : '👤 ' + (s.name || 'לקוח')) + left;
    chip.querySelector('button').addEventListener('click', logout);
    nav.appendChild(chip);
  }

  // ---------------------------------------------------------------- the gate
  function gate(msg) {
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
        '<p class="gate-lead" id="gate-lead">' + (needAdmin ? 'המסך הזה פתוח רק למנהל המערכת.' : 'האתרים פתוחים ללקוחות עם גישה פעילה. נכנסים עם המייל והסיסמה שקיבלתם. ממכשיר חדש הכניסה מחכה לאישור המנהל.') + '</p>' +
        '<form class="gate-form" id="gate-pw" novalidate>' +
          '<label class="field"><span>מייל</span><input name="email" type="email" dir="ltr" autocomplete="username" required></label>' +
          '<label class="field"><span>סיסמה</span><input name="password" type="password" dir="ltr" autocomplete="current-password" required></label>' +
          '<label class="field" id="gate-pw-totp" hidden><span>קוד מאפליקציית האימות</span><input name="totp" class="gate-code" inputmode="numeric" autocomplete="off" maxlength="6" dir="ltr"></label>' +
          '<button class="btn btn-gold" type="submit">כניסה</button>' +
        '</form>' +
        '<form class="gate-form" id="gate-1" novalidate hidden>' +
          '<label class="field"><span>מייל</span><input name="email" type="email" dir="ltr" autocomplete="email" required></label>' +
          '<label class="field"><span>טלפון</span><input name="phone" type="tel" dir="ltr" autocomplete="tel" inputmode="tel" placeholder="050-000-0000" required></label>' +
          '<button class="btn btn-gold" type="submit">שלחו לי קוד</button>' +
        '</form>' +
        '<form class="gate-form" id="gate-2" novalidate hidden>' +
          '<p class="gate-sent" id="gate-sent"></p>' +
          '<label class="field"><span>הקוד</span><input name="code" class="gate-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" required></label>' +
          '<label class="field" id="gate-totp-wrap" hidden><span>קוד מאפליקציית האימות</span><input name="totp" class="gate-code" inputmode="numeric" autocomplete="off" maxlength="6" dir="ltr"></label>' +
          '<button class="btn btn-gold" type="submit">כניסה</button>' +
          '<div class="gate-row"><button class="g-btn ghost" type="button" id="gate-back">→ חזרה</button><button class="g-btn ghost" type="button" id="gate-again" disabled>שליחה מחדש</button></div>' +
        '</form>' +
        '<p class="add-error" id="gate-err" role="alert"' + (msg ? '' : ' hidden') + '>' + (msg || '') + '</p>' +
        '<p class="gate-owner">חיים קריספין · <a href="tel:+972544979771" dir="ltr">054-4979771</a></p>' +
        '<p class="gate-foot">אין לך גישה עדיין? <a href="' + WA + '" target="_blank" rel="noopener">דברו איתי בוואטסאפ</a> · <a href="services.html">שירותים ומחירים</a></p>' +
      '</div>';
    document.body.appendChild(g);

    var f1 = g.querySelector('#gate-1'), f2 = g.querySelector('#gate-2'), err = g.querySelector('#gate-err'), fpw = g.querySelector('#gate-pw');
    var again = g.querySelector('#gate-again');
    var who = { email: '', phone: '' }, timer = null;
    try { var last = JSON.parse(localStorage.getItem('hasadna-who') || '{}'); f1.elements.email.value = last.email || ''; f1.elements.phone.value = last.phone || ''; } catch (e) {}
    function fail(t) { err.textContent = t; err.hidden = !t; }
    function busy(f, on) { var b = f.querySelector('button[type=submit]'); b.disabled = on; b.classList.toggle('busy', on); }
    var ERR = {
      'bad-input': 'בדקו את המייל ואת מספר הטלפון.',
      'too-many': 'יותר מדי ניסיונות. נסו שוב בעוד שעה.',
      'expired': 'הקוד פג. בקשו קוד חדש.',
      'wrong': 'הקוד לא נכון.',
      'inactive': 'הגישה שלך לא פעילה כרגע. כדי לחדש, דברו איתי בוואטסאפ.',
      'mail-failed': 'לא הצלחתי לשלוח את המייל כרגע. נסו שוב בעוד דקה.',
      'rate-limited': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      'bad-login': 'המייל או הסיסמה לא נכונים.',
      'bad-device': 'הדפדפן הזה לא מאפשר לשמור מזהה מכשיר. פתחו חלון רגיל (לא פרטי) ונסו שוב.',
      'pending': 'המכשיר הזה חדש, והכניסה ממנו מחכה לאישור המנהל. שלחתי לו הודעה. אפשר גם לפנות אליו בוואטסאפ.',
      'ip-blocked': 'הכתובת (IP) שממנה אתם מתחברים לא מאושרת. פנו למנהל.',
      'device-revoked': 'המכשיר הזה הוסר. היכנסו שוב.',
      'wait': 'כבר שלחתי קוד. אפשר לבקש חדש בעוד חצי דקה.',
      'forbidden': 'הכניסה אפשרית רק מתוך האתר.',
      'wrong-totp': 'קוד האפליקציה לא נכון, או שכבר נעשה בו שימוש. חכו לקוד הבא.',
      'not-ready': 'מערכת הכניסה עוד לא הופעלה ב־n8n. (למנהל: לייבא את n8n/hasadna-access.json, לחבר Gmail ולהפעיל.)'
    };

    // ---- the way in: email + password. The device id is a random number kept in this browser, so the admin can tell devices apart.
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
    fpw.addEventListener('submit', function (e) {
      e.preventDefault();
      var mail = fpw.elements.email.value.trim(), pass = fpw.elements.password.value, totp = fpw.elements.totp.value.replace(/\D/g, '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { fail('בדקו את כתובת המייל.'); fpw.elements.email.focus(); return; }
      if (!pass) { fail('הקלידו את הסיסמה.'); fpw.elements.password.focus(); return; }
      try { localStorage.setItem('spider-mail', mail); } catch (x) {}
      fail(''); busy(fpw, true);
      api('login', { email: mail, password: pass, device: deviceId(), totp: totp }).then(function (j) {
        busy(fpw, false);
        if (j.ok) {
          store(j.token);
          if (needAdmin && j.role !== 'admin') { fail('המסך הזה פתוח רק למנהל.'); return; }
          fpw.elements.password.value = '';
          api('me').then(function (s) { if (s.ok) enter(s); else fail(ERR[s.error] || 'לא הצלחתי להיכנס. נסו שוב.'); });
          return;
        }
        if (j.error === 'totp-needed') {
          g.querySelector('#gate-pw-totp').hidden = false; fpw.elements.totp.focus();
          fail('עוד צעד אחד: הקלידו את הקוד מאפליקציית האימות.');
          return;
        }
        if (j.error === 'bad-login' || j.error === 'wrong-totp') fpw.elements.password.value = '';
        fail((ERR[j.error] || 'משהו השתבש: ' + j.error) + (j.error === 'bad-login' && j.left != null && j.left <= 3 ? ' נשארו ' + j.left + ' ניסיונות.' : ''));
      }).catch(function () { busy(fpw, false); fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    });
    fpw.elements.totp.addEventListener('input', function () { if (fpw.elements.totp.value.replace(/\D/g, '').length === 6) fpw.requestSubmit ? fpw.requestSubmit() : fpw.dispatchEvent(new Event('submit')); });
    // before the admin has a password, the older way in (email, phone, emailed code) is the one that works
    api('info').then(function (j) {
      if (j && j.ok && j.password === false) {
        fpw.hidden = true; f1.hidden = false;
        g.querySelector('#gate-lead').textContent = needAdmin ? 'המסך הזה פתוח רק למנהל המערכת.' : 'נכנסים עם המייל והטלפון שנרשמו, ומקבלים קוד חד־פעמי.';
      }
    }).catch(function () {});

    function send() {
      fail('');
      busy(f1, true);
      return api('request', who).then(function (j) {
        busy(f1, false);
        if (!j.ok) { fail(ERR[j.error] || 'משהו השתבש: ' + j.error); return; }
        f1.hidden = true; f2.hidden = false;
        g.querySelector('#gate-sent').textContent = 'אם הפרטים מורשים, שלחתי קוד בן 6 ספרות אל ' + who.email + '. כדאי לבדוק גם בקידומי מכירות או בספאם.';
        f2.elements.code.value = ''; f2.elements.code.focus();
        again.disabled = true;
        clearTimeout(timer); timer = setTimeout(function () { again.disabled = false; }, 30000);
      }).catch(function () { busy(f1, false); fail('מערכת הכניסה לא עונה כרגע. נסו שוב בעוד רגע.'); });
    }

    f1.addEventListener('submit', function (e) {
      e.preventDefault();
      who = { email: f1.elements.email.value.trim(), phone: f1.elements.phone.value.trim() };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.email)) { fail('בדקו את כתובת המייל.'); f1.elements.email.focus(); return; }
      if (who.phone.replace(/\D/g, '').length < 9) { fail('בדקו את מספר הטלפון.'); f1.elements.phone.focus(); return; }
      try { localStorage.setItem('hasadna-who', JSON.stringify(who)); } catch (x) {}
      send();
    });
    f2.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = f2.elements.code.value.replace(/\D/g, '');
      var totp = f2.elements.totp.value.replace(/\D/g, '');
      if (code.length !== 6) { fail('הקוד בן 6 ספרות.'); return; }
      fail(''); busy(f2, true);
      api('verify', { email: who.email, phone: who.phone, code: code, totp: totp }).then(function (j) {
        busy(f2, false);
        if (!j.ok && j.error === 'totp-needed') {
          // the admin: the emailed code was right, now the authenticator app
          g.querySelector('#gate-totp-wrap').hidden = false; f2.elements.totp.focus();
          fail(totp ? '' : 'עוד צעד אחד: הקלידו את הקוד מאפליקציית האימות.');
          return;
        }
        if (!j.ok) { fail((ERR[j.error] || 'משהו השתבש.') + (j.left != null ? ' נשארו ' + j.left + ' ניסיונות.' : '')); return; }
        store(j.token);
        if (needAdmin && j.role !== 'admin') { fail('המסך הזה פתוח רק למנהל.'); return; }
        api('me').then(function (s) { if (s.ok) enter(s); else fail('לא הצלחתי להיכנס. נסו שוב.'); });
      }).catch(function () { busy(f2, false); fail('מערכת הכניסה לא עונה כרגע.'); });
    });
    function autoSend() {
      var needTotp = !g.querySelector('#gate-totp-wrap').hidden;
      if (f2.elements.code.value.replace(/\D/g, '').length !== 6) return;
      if (needTotp && f2.elements.totp.value.replace(/\D/g, '').length !== 6) return;
      f2.requestSubmit ? f2.requestSubmit() : f2.dispatchEvent(new Event('submit'));
    }
    f2.elements.code.addEventListener('input', autoSend);
    f2.elements.totp.addEventListener('input', autoSend);
    g.querySelector('#gate-back').addEventListener('click', function () { f2.hidden = true; f1.hidden = false; g.querySelector('#gate-totp-wrap').hidden = true; f2.elements.totp.value = ''; fail(''); });
    again.addEventListener('click', send);
    setTimeout(function () { (fpw.elements.email.value ? fpw.elements.password : fpw.elements.email).focus(); }, 50);
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
