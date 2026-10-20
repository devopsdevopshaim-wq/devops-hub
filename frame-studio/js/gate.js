/* The studio is the owner's: it opens only for the admin's account (the same sign-in as the admin screen).
   The page starts hidden (body.gated); a device already signed in as admin opens at once, even with no internet
   at an event, and the session is checked with the server in the background. Anyone else gets the sign-in. */
(function () {
  'use strict';
  var ACC = window.FS && window.FS.account, body = document.body;
  function unlock() { body.classList.remove('gated'); var g = document.getElementById('gate'); if (g) g.remove(); }
  function lock(note) {
    body.classList.add('gated');
    var g = document.getElementById('gate');
    if (!g) {
      g = document.createElement('div'); g.id = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-labelledby', 'gate-title');
      g.innerHTML = '<div class="gate-card"><p class="gate-eyebrow">פריים מגנטים · הסטודיו</p><h1 id="gate-title">כניסת בעל העסק</h1>' +
        '<p class="gate-lead">הסטודיו פתוח רק לבעל העסק. נכנסים עם המייל והסיסמה של מסך הניהול.</p><div id="gate-box"></div>' +
        '<a class="gate-back" href="./">← לאתר העסק</a></div>';
      body.appendChild(g);
    }
    if (!ACC) { document.getElementById('gate-box').innerHTML = '<p class="gate-lead">אין חיבור לשרת הכניסה. בודקים אינטרנט ומרעננים.</p>'; return; }
    ACC.form(document.getElementById('gate-box'), { adminOnly: true, note: note || '', done: function (s) { if (s && s.role === 'admin') unlock(); else lock('הכניסה לסטודיו לבעל העסק בלבד.'); } });
  }
  if (ACC && ACC.isAdmin()) {
    unlock();
    /* the server's word wins when it can be reached: a signed-out or revoked session closes the studio */
    ACC.me().then(function (r) { if (!r.ok && /signed-out|inactive|device-revoked/.test(r.error || '')) lock('החיבור פג. נכנסים שוב.'); else if (r.ok && r.role !== 'admin') { ACC.logout(); lock('הכניסה לסטודיו לבעל העסק בלבד.'); } }, function () {});
  } else lock();
})();
