/* How to install, for the phone and browser in hand (the admin app and the Optimus app both use it).
   A page that a browser lets install sends 'beforeinstallprompt' (Chrome / Edge on Android and computers): then the
   install is one tap, and the callers do that. Everywhere else this explains the exact steps, by what the phone is:
   - inside WhatsApp / Instagram / Facebook / Telegram / TikTok (an in-app browser): nothing can be installed there, so
     first open the page in the real browser (on Android a button opens Chrome straight away; the link can be copied);
   - iPhone / iPad, Safari: Share ⬆, "Add to Home Screen"; iPhone Chrome or another browser: the same Share in its bar
     (iOS 16.4+), or Safari;
   - Android: Chrome ⋮ "Install app", Samsung Internet ≡ "Add page to → Home screen", Firefox ⋮ "Install";
   - a computer: the install icon at the end of the address bar (Chrome, Edge).
   FS.installHelp(name) opens the sheet. No dependencies. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Telegram|TikTok|musical_ly|Snapchat|LinkedInApp|; wv\)/i.test(ua);
  var samsung = /SamsungBrowser/i.test(ua), firefox = /Firefox|FxiOS/i.test(ua), iosOther = ios && /CriOS|EdgiOS|FxiOS|OPiOS/i.test(ua);
  FS.installEnv = { ios: ios, android: android, inApp: inApp, samsung: samsung, firefox: firefox, phone: ios || android || /Mobi/i.test(ua) };

  function css() {
    if (document.getElementById('ih-css')) return;
    var s = document.createElement('style'); s.id = 'ih-css';
    s.textContent = '.ih{position:fixed;inset:0;z-index:2147483600;background:rgba(5,5,10,.6);display:flex;align-items:flex-end;justify-content:center;font:16px/1.6 Heebo,Assistant,Arial,sans-serif;direction:rtl}' +
      '.ih-in{width:min(520px,100%);max-height:92vh;overflow:auto;background:#17151f;color:#f3f1ec;border-radius:22px 22px 0 0;padding:22px 20px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -20px 50px rgba(0,0,0,.5)}' +
      '.ih h3{margin:0 0 6px;font-size:21px}.ih p{margin:6px 0;color:#cfcbd9}.ih ol{margin:10px 0;padding-inline-start:24px}.ih li{margin:8px 0}' +
      '.ih b.k{display:inline-block;min-width:26px;padding:0 6px;border-radius:7px;background:#2b2838;color:#fff;text-align:center}' +
      '.ih .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ih button,.ih a.btn{flex:1;min-height:46px;border:0;border-radius:12px;font:700 16px Heebo,Arial,sans-serif;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center}' +
      '.ih .go{background:linear-gradient(90deg,#f4c9cf,#edb6be);color:#17130e}.ih .x{background:#2b2838;color:#fff}.ih .ok{color:#8ee0b0;font-weight:700}';
    document.head.appendChild(s);
  }
  function steps() {
    var url = location.href.split('#')[0];
    if (inApp && android) return { h: 'קודם פותחים בדפדפן', b: '<p>הדף נפתח בתוך אפליקציה (וואטסאפ, אינסטגרם או פייסבוק), ומשם אי אפשר להתקין.</p><p>לוחצים על הכפתור, הדף נפתח ב־Chrome, ושם מתקינים.</p>',
      go: { t: '🌐 פתיחה ב־Chrome', href: 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end' }, copy: url };
    if (inApp && ios) return { h: 'קודם פותחים ב־Safari', b: '<p>הדף נפתח בתוך אפליקציה (וואטסאפ, אינסטגרם או פייסבוק), ומשם אי אפשר להתקין.</p><ol><li>לוחצים על <b class="k">⋯</b> או על סמל המצפן <b class="k">🧭</b> בפינה.</li><li>בוחרים <b>"פתיחה ב־Safari"</b>.</li><li>ב־Safari: שיתוף <b class="k">⬆︎</b> ← <b>"הוספה למסך הבית"</b>.</li></ol><p>אפשר גם להעתיק את הקישור ולהדביק ב־Safari.</p>', copy: url };
    if (ios && !iosOther) return { h: 'התקנה באייפון, ב־Safari', b: '<ol><li>לוחצים על כפתור השיתוף <b class="k">⬆︎</b>: באייפון בתחתית המסך, באייפד למעלה.</li><li>גוללים מעט למטה ובוחרים <b>"הוספה למסך הבית"</b> <b class="k">⊕</b>.</li><li>לוחצים <b>"הוסף"</b> בפינה למעלה.</li></ol><p>האייקון יופיע במסך הבית, והאפליקציה תיפתח על כל המסך.</p>' };
    if (ios) return { h: 'התקנה באייפון', b: '<ol><li>לוחצים על כפתור השיתוף <b class="k">⬆︎</b> בשורת הכתובת.</li><li>בוחרים <b>"הוספה למסך הבית"</b>.</li></ol><p>אם אין את האפשרות הזו בדפדפן הזה, פותחים את הקישור ב־<b>Safari</b> ומתקינים משם.</p>', copy: url };
    if (samsung) return { h: 'התקנה בדפדפן של סמסונג', b: '<ol><li>לוחצים על התפריט <b class="k">≡</b> למטה.</li><li>בוחרים <b>"הוספת דף אל"</b> ← <b>"מסך הבית"</b>.</li><li>מאשרים <b>"הוסף"</b>.</li></ol><p>אפשר גם לפתוח את הקישור ב־Chrome ולהתקין שם.</p>', copy: url };
    if (android && firefox) return { h: 'התקנה ב־Firefox', b: '<ol><li>לוחצים על התפריט <b class="k">⋮</b>.</li><li>בוחרים <b>"התקנה"</b> או <b>"הוספה למסך הבית"</b>.</li></ol>' };
    if (android) return { h: 'התקנה באנדרואיד', b: '<ol><li>לוחצים על התפריט <b class="k">⋮</b> בפינה העליונה של Chrome.</li><li>בוחרים <b>"התקנת אפליקציה"</b> (או <b>"הוספה למסך הבית"</b> ← <b>"התקנה"</b>).</li><li>מאשרים <b>"התקנה"</b>.</li></ol><p>האייקון יופיע במסך הבית ובמגירת האפליקציות.</p>' };
    return { h: 'התקנה במחשב', b: '<p>ב־Chrome או ב־Edge: לוחצים על סמל ההתקנה <b class="k">⊕</b> בסוף שורת הכתובת, ואז <b>"התקנה"</b>.</p><p>לטלפון: פותחים את אותו קישור בטלפון ומתקינים שם.</p>', copy: url };
  }
  FS.installHelp = function (name) {
    css(); var s = steps(), d = document.createElement('div'); d.className = 'ih'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="ih-in"><h3>📲 ' + s.h + (name ? ' · ' + name : '') + '</h3>' + s.b + '<div class="row">' +
      (s.go ? '<a class="btn go" href="' + s.go.href + '">' + s.go.t + '</a>' : '') +
      (s.copy ? '<button type="button" class="' + (s.go ? 'x' : 'go') + '" data-copy>📋 העתקת הקישור</button>' : '') +
      '<button type="button" class="x" data-close>סגירה</button></div><p class="ok" data-msg hidden></p></div>';
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) return d.remove();
      if (e.target.closest('[data-copy]')) {
        var m = d.querySelector('[data-msg]'), done = function () { m.hidden = false; m.textContent = '✔ הקישור הועתק. מדביקים אותו בשורת הכתובת של הדפדפן.'; };
        if (navigator.clipboard) navigator.clipboard.writeText(s.copy).then(done, function () { prompt('הקישור:', s.copy); });
        else prompt('הקישור:', s.copy);
      }
    });
    document.body.appendChild(d);
    var f = d.querySelector('a, button'); if (f) f.focus();
  };
})();
