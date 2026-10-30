/* The download page: registering for the free version (full name, phone, email; a 6-digit code to the email proves it, and the
   download opens), and beside it the full purchase: the prices, the promotion and the payment terms as the owner set them. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var WA = '972544979771', who = { n: '', p: '', e: '' };
  var base = fetch('../portfolio/api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (j) { return String((j && j.base) || 'https://spider-auth.devopsdevopshaim.workers.dev').replace(/\/+$/, ''); });
  function call(action, data) {
    var body = new URLSearchParams(data || {}); body.set('action', action);
    return base.then(function (u) { return fetch(u + '/hasadna-auth', { method: 'POST', body: body }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; });
  }
  var MSG = { 'bad-details': 'שם מלא (פרטי ומשפחה), טלפון ומייל תקינים.', 'rate-limited': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.', offline: 'אין חיבור לאינטרנט.',
    'bad-code': 'הקוד לא נכון.', 'code-expired': 'הקוד פג. שולחים קוד חדש.', 'admin-use-password': 'זו כתובת בעל העסק.' };
  function err(t) { $('dl-err').textContent = t || ''; }
  function wa() { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent('שלום, נרשמתי להורדת אופטימוס ולא קיבלתי קוד. ' + who.n + ' · ' + who.p + ' · ' + who.e); }

  /* the purchase: prices, promotion, terms */
  call('lic-info').then(function (r) {
    if (!r || !r.ok) return;
    var cur = ' ' + (r.currency || '₪');
    Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function (b) { var v = r[b.dataset.p]; if (v) b.textContent = Number(v).toLocaleString('he-IL') + cur; });
    if (r.promo) { $('dl-promo').textContent = '🏷️ ' + r.promo; $('dl-promo').hidden = false; }
    if (r.terms) $('dl-terms').textContent = r.terms;
    Array.prototype.forEach.call(document.querySelectorAll('[data-pay]'), function (a) { var u = (r.payLinks || {})[a.dataset.pay]; if (/^https:\/\/[^\s"'<>]+$/i.test(u || '')) { a.href = u; a.hidden = false; } });
  });

  /* registration: details, code, download */
  var form = $('dl-form'), codef = $('dl-codef');
  function send() {
    var b = $('dl-send'); b.disabled = true; err('');
    return call('trial-code', { name: who.n, phone: who.p, email: who.e, where: 'download' }).then(function (r) {
      b.disabled = false;
      if (r.ok || r.error === 'mail-failed') {
        form.hidden = true; codef.hidden = false; $('dl-wa').href = wa();
        $('dl-sent').innerHTML = r.ok ? 'שלחנו קוד בן 6 ספרות ל־<b dir="ltr"></b>. מזינים אותו כאן (בודקים גם בספאם ובקידומי מכירות).' : '📵 המייל לא יצא כרגע. לוחצים "קבלת הקוד בוואטסאפ", וחיים שולח את הקוד.';
        var bb = $('dl-sent').querySelector('b'); if (bb) bb.textContent = who.e;
        setTimeout(function () { $('dl-code').focus(); }, 30); return;
      }
      err(MSG[r.error] || 'משהו השתבש (' + (r.error || '') + '). נסו שוב, או בוואטסאפ 054-4979771.');
    });
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    who.n = $('dl-name').value.trim().replace(/\s+/g, ' '); who.p = $('dl-phone').value.trim(); who.e = $('dl-email').value.trim();
    if (who.n.split(' ').filter(function (w) { return w.length > 1; }).length < 2) return err('שם מלא: שם פרטי ושם משפחה.');
    if (!/^0\d{8,11}$/.test(who.p.replace(/\D/g, '').replace(/^972/, '0'))) return err('מספר טלפון מלא.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.e)) return err('כתובת מייל תקינה.');
    send();
  });
  codef.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var c = $('dl-code').value.replace(/\D/g, ''); if (c.length !== 6) return err('קוד בן 6 ספרות.');
    var b = $('dl-check'); b.disabled = true; err('');
    call('trial-verify', { email: who.e, code: c }).then(function (r) {
      b.disabled = false;
      if (r.ok && r.url) { codef.hidden = true; $('dl-ready').hidden = false; $('dl-win').href = r.url; location.href = r.url; return; }
      if (r.error === 'code-expired') { codef.hidden = true; form.hidden = false; }
      err(r.error === 'bad-code' ? 'הקוד לא נכון' + (r.left != null ? ' (נשארו ' + r.left + ' ניסיונות).' : '.') : MSG[r.error] || 'משהו השתבש. נסו שוב.');
    });
  });
  $('dl-again').addEventListener('click', function (ev) { ev.preventDefault(); codef.hidden = true; form.hidden = false; send(); });
  $('dl-fix').addEventListener('click', function (ev) { ev.preventDefault(); codef.hidden = true; form.hidden = false; err(''); });
})();
