/* The studio opens for the owner (the admin's sign-in) or for someone with a studio licence: their email and personal activation
   code, which the server binds to one computer. The page starts hidden (body.gated). A device already signed in opens at once,
   even with no internet at an event (a licence checked in the last 7 days), and the server's word is checked in the background:
   a revoked licence, or one moved to another computer, closes the studio. */
(function () {
  'use strict';
  var FS = window.FS || {}, ACC = FS.account, LIC = FS.license, body = document.body, tab = 'license', typed = { e: '', c: '' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function unlock(kind) {
    body.classList.remove('gated'); var g = document.getElementById('gate'); if (g) g.remove();
    /* a licence holder gets the studio itself; the owner's business screens stay the owner's */
    body.classList.toggle('studio-licensed', kind === 'license');
  }
  function lock(note) {
    body.classList.add('gated');
    var g = document.getElementById('gate');
    if (!g) {
      g = document.createElement('div'); g.id = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-labelledby', 'gate-title');
      body.appendChild(g);
    }
    g.innerHTML = '<div class="gate-card"><p class="gate-eyebrow">פריים־סטודיו</p><h1 id="gate-title">' + (tab === 'license' ? 'הפעלת הסטודיו' : 'כניסת בעל העסק') + '</h1>' +
      '<div class="gate-tabs" role="tablist"><button role="tab" data-t="license" aria-selected="' + (tab === 'license') + '">🔑 קוד הפעלה</button><button role="tab" data-t="admin" aria-selected="' + (tab === 'admin') + '">🔐 מנהל</button></div>' +
      (tab === 'license'
        ? '<p class="gate-lead">מזינים את המייל ואת קוד ההפעלה האישי שקיבלתם. הקוד עובד במחשב אחד בלבד.</p><div class="acc">' +
          '<label>מייל<input id="lic-email" type="email" dir="ltr" autocomplete="email"></label><label>קוד הפעלה<input id="lic-code" dir="ltr" autocomplete="off" spellcheck="false" placeholder="FS-XXXX-XXXX-XXXX-XXXX"></label>' +
          '<label class="gate-agree"><input type="checkbox" id="lic-agree"> קראתי ואני מסכים/ה ל<a href="agreement.html" target="_blank" rel="noopener">הסכם הרכישה והשימוש</a></label>' +
          '<button class="btn" id="lic-go">הפעלה</button><p class="acc-note" id="lic-note" role="status">' + esc(note || '') + '</p></div>' +
          '<p class="gate-lead small">אין לכם קוד? פונים לחיים: <a href="https://wa.me/972544979771" target="_blank" rel="noopener">וואטסאפ 054-4979771</a></p>'
        : '<p class="gate-lead">נכנסים עם המייל והסיסמה של מסך הניהול.</p><div id="gate-box"></div>') +
      '<a class="gate-back" href="./">← לאתר העסק</a></div>';
    Array.prototype.forEach.call(g.querySelectorAll('[data-t]'), function (b) { b.addEventListener('click', function () { tab = b.dataset.t; lock(); }); });
    if (tab === 'admin') {
      if (!ACC) { document.getElementById('gate-box').innerHTML = '<p class="gate-lead">אין חיבור לשרת הכניסה. בודקים אינטרנט ומרעננים.</p>'; return; }
      ACC.form(document.getElementById('gate-box'), { adminOnly: true, note: note || '', done: function (s) { if (s && s.role === 'admin') unlock('admin'); else lock('הכניסה הזאת לבעל העסק בלבד.'); } });
      return;
    }
    var go = document.getElementById('lic-go'), em = document.getElementById('lic-email'), cd = document.getElementById('lic-code');
    var last = LIC && LIC.get(); em.value = typed.e || (last && last.email) || ''; cd.value = typed.c;
    function submit() {
      var e = String(em.value || '').trim(), c = String(cd.value || '').trim(); typed = { e: e, c: c };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || c.replace(/[^A-Za-z0-9]/g, '').length < 10) { document.getElementById('lic-note').textContent = 'מייל וקוד הפעלה מלאים.'; return; }
      if (!document.getElementById('lic-agree').checked) { document.getElementById('lic-note').textContent = 'מסמנים את האישור להסכם הרכישה.'; return; }
      go.disabled = true; go.textContent = '…';
      LIC.activate(e, c).then(function (r) { if (r.ok) return unlock('license'); lock(ACC ? ACC.msg(r) : 'שגיאה'); });
    }
    go.addEventListener('click', submit);
    [em, cd].forEach(function (i) { i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } }); });
    setTimeout(function () { (em.value ? cd : em).focus(); }, 30);
  }
  if (!ACC || !LIC) { lock('אין חיבור לשרת הכניסה.'); return; }
  /* The first sign-in on this computer stays: the studio opens at once, with or without the internet, and is checked with the
     server in the background when there is a connection. An ended session signs in again by itself (FS.account.relogin with
     the details the desktop program keeps encrypted, the licence with its saved code); only a revoked licence, one moved to
     another computer, a changed password or "🚪 יציאה" close it. */
  function adminCheck() {
    ACC.me().then(function (r) {
      if (r.ok) { if (r.role !== 'admin') { ACC.logout(); lock(); } return; }
      if (!/signed-out|inactive|device-revoked/.test(r.error || '')) return;   /* offline or busy: stay open */
      return ACC.relogin().then(function (x) {
        if (x.ok || x.error === 'offline' || /^http-5|rate-limited/.test(x.error || '')) return;
        tab = 'admin'; lock(x.error === 'no-saved' ? 'החיבור פג. נכנסים שוב.' : 'הכניסה השמורה לא עברה (' + ACC.msg(x) + '). נכנסים שוב.');
      });
    }, function () {});
  }
  if (ACC.isAdmin()) { unlock('admin'); adminCheck(); }
  else if (LIC.get()) {
    unlock('license');
    LIC.check().then(function (r) { if (r.ok) unlock('license'); else lock(ACC.msg(r)); });
  } else {
    /* nothing signed in here, but the desktop program remembers the owner (or a licence): open, and sign in quietly */
    ACC.hasSaved().then(function (has) {
      if (has) { unlock('admin'); return ACC.relogin().then(function (x) { if (!x.ok && x.error !== 'offline' && !/^http-5|rate-limited/.test(x.error || '')) { tab = 'admin'; lock('נכנסים שוב עם המייל והסיסמה.'); } }); }
      return LIC.saved().then(function (v) {
        if (!v || !v.code) return lock();
        LIC.activate(v.email, v.code).then(function (r) {
          if (r.ok) unlock('license');
          else if (r.error === 'offline' || /^http-5|rate-limited/.test(r.error || '')) unlock('license');
          else lock(ACC.msg(r));
        });
      });
    }, function () { lock(); });
  }
  FS.gateLogout = function () { if (LIC) LIC.forget(); if (ACC) ACC.logout(); if (FS.vault) FS.vault.del('admin'); setTimeout(function () { location.reload(); }, 150); };
})();
