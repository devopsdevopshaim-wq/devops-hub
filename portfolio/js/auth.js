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
  var WA = 'https://wa.me/972544979771?text=' + encodeURIComponent('היי, אשמח לקבל גישה להסדנה');
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
  var Auth = window.HasadnaAuth = { ready: ready, session: null, api: api, logout: logout };

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
        '<a class="brand" href="services.html" aria-label="הסדנה"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="20" r="4.5" fill="currentColor"/><circle cx="35" cy="13" r="2.2" fill="currentColor"/></svg><span>הסדנה</span></a>' +
        '<h1 id="gate-title">' + (needAdmin ? 'כניסת מנהל' : 'כניסה') + '</h1>' +
        '<p class="gate-lead">' + (needAdmin ? 'המסך הזה פתוח רק למנהל המערכת.' : 'האתרים פתוחים ללקוחות עם גישה פעילה. נכנסים עם המייל והטלפון שנרשמו, ומקבלים קוד חד־פעמי.') + '</p>' +
        '<form class="gate-form" id="gate-1" novalidate>' +
          '<label class="field"><span>מייל</span><input name="email" type="email" dir="ltr" autocomplete="email" required></label>' +
          '<label class="field"><span>טלפון</span><input name="phone" type="tel" dir="ltr" autocomplete="tel" inputmode="tel" placeholder="050-000-0000" required></label>' +
          '<button class="btn btn-gold" type="submit">שלחו לי קוד</button>' +
        '</form>' +
        '<form class="gate-form" id="gate-2" novalidate hidden>' +
          '<p class="gate-sent" id="gate-sent"></p>' +
          '<label class="field"><span>הקוד</span><input name="code" class="gate-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" required></label>' +
          '<button class="btn btn-gold" type="submit">כניסה</button>' +
          '<div class="gate-row"><button class="g-btn ghost" type="button" id="gate-back">→ חזרה</button><button class="g-btn ghost" type="button" id="gate-again" disabled>שליחה מחדש</button></div>' +
        '</form>' +
        '<p class="add-error" id="gate-err" role="alert"' + (msg ? '' : ' hidden') + '>' + (msg || '') + '</p>' +
        '<p class="gate-foot">אין לך גישה עדיין? <a href="' + WA + '" target="_blank" rel="noopener">דברו איתי בוואטסאפ</a> · <a href="services.html">שירותים ומחירים</a></p>' +
      '</div>';
    document.body.appendChild(g);

    var f1 = g.querySelector('#gate-1'), f2 = g.querySelector('#gate-2'), err = g.querySelector('#gate-err');
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
      'not-ready': 'מערכת הכניסה עוד לא הופעלה ב־n8n. (למנהל: לייבא את n8n/hasadna-access.json, לחבר Gmail ולהפעיל.)'
    };

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
      if (code.length !== 6) { fail('הקוד בן 6 ספרות.'); return; }
      fail(''); busy(f2, true);
      api('verify', { email: who.email, phone: who.phone, code: code }).then(function (j) {
        busy(f2, false);
        if (!j.ok) { fail((ERR[j.error] || 'משהו השתבש.') + (j.left != null ? ' נשארו ' + j.left + ' ניסיונות.' : '')); return; }
        store(j.token);
        if (needAdmin && j.role !== 'admin') { fail('המסך הזה פתוח רק למנהל.'); return; }
        api('me').then(function (s) { if (s.ok) enter(s); else fail('לא הצלחתי להיכנס. נסו שוב.'); });
      }).catch(function () { busy(f2, false); fail('מערכת הכניסה לא עונה כרגע.'); });
    });
    f2.elements.code.addEventListener('input', function () {
      if (f2.elements.code.value.replace(/\D/g, '').length === 6) f2.requestSubmit ? f2.requestSubmit() : f2.dispatchEvent(new Event('submit'));
    });
    g.querySelector('#gate-back').addEventListener('click', function () { f2.hidden = true; f1.hidden = false; fail(''); });
    again.addEventListener('click', send);
    setTimeout(function () { (f1.elements.email.value ? f1.elements.phone : f1.elements.email).focus(); }, 50);
  }

  function start() {
    if (!token()) { gate(); return; }
    api('me').then(function (s) {
      if (s.ok && (!needAdmin || s.role === 'admin')) enter(s);
      else {
        if (!s.ok) store('');
        gate(s.error === 'not-ready' ? 'מערכת הכניסה עוד לא הופעלה ב־n8n.' : s.error === 'inactive' ? 'הגישה שלך הסתיימה. כדי לחדש, דברו איתי בוואטסאפ.' : needAdmin && s.ok ? 'המסך הזה פתוח רק למנהל.' : 'הכניסה הקודמת הסתיימה. היכנסו שוב.');
      }
    }).catch(function () { gate('מערכת הכניסה לא עונה כרגע. נסו לרענן בעוד רגע.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
