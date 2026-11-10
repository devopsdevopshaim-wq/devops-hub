/* When a print does not come out: what happened, in plain Hebrew, and the way to fix it, in one window.
   The desktop program (FSDesktop.print, main.js) prints straight to the printer. A photo printer's driver can refuse the job
   (for example the Mitsubishi CP-D90: "Paper size of printer driver and Ink Ribbon type do not match": the paper size in the
   driver is not one the ribbon loaded can print). The program cannot read the driver's own message, so after every print it
   reads the printer's queue from Windows for a few seconds; a job in error, a printer in error, or a print that did not go
   out opens this window:
   - "⚙️ הגדרות המדפסת": the printer's own settings window (paper size, ribbon), straight away;
   - "🧹 ניקוי תור ההדפסה": the stuck jobs are removed;
   - "🖨️ להדפיס שוב לפי הדרייבר": prints again at the paper size the driver holds (and remembers this for the printer);
   - "🖨️ להדפיס שוב".
   FS.printDoctor.watch(dev, result, retry) after a print; FS.printDoctor.settings(dev) opens the settings; FS.printDoctor.
   driverSize(dev) says whether this printer prints at the driver's size. Needs the desktop program built with v127 or later for the settings,
   the queue and the clearing; an older one still gets the explanation. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  var P = function () { return window.FSDesktop && FSDesktop.print; };
  var KEY = 'fs-prn-driver-size';
  function sizes() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function driverSize(dev, v) { var m = sizes(); if (v === undefined) return !!m[dev]; if (v) m[dev] = 1; else delete m[dev]; try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* private mode */ } return v; }
  function settings(dev) {
    var p = P(); if (!p || !p.settings) { FS.toast('⚙️ ההגדרות נפתחות מהתוכנה למחשב (גרסה חדשה). בינתיים: התחל ← הגדרות ← מדפסות ← ' + dev + ' ← העדפות הדפסה.', 9000); return Promise.resolve({ ok: false }); }
    return p.settings(dev).then(function (r) { if (!r.ok) FS.toast('לא הצלחתי לפתוח את ההגדרות של ' + dev + '.'); return r; });
  }
  var MITSU = /mitsubishi|cp-?d\d|cp-?k\d|cp-?m\d/i, DNP = /dnp|ds-?rx|ds\d|qw410|ds620|ds820/i, CITIZEN = /citizen|cx-?0|cy-?0|cz-?0/i;
  function explain(dev, why) {
    var dye = MITSU.test(dev) || DNP.test(dev) || CITIZEN.test(dev);
    var head = why === 'mismatch' ? 'גודל הנייר שנבחר לא מתאים לגליל הדיו שבמדפסת' : why === 'error' ? 'המדפסת דיווחה על תקלה בהדפסה' : why === 'offline' ? 'המדפסת לא מחוברת או כבויה' : 'ההדפסה לא יצאה';
    var html = '<div class="pd"><p class="pd-dev">🖨️ <b>' + FS.esc(dev) + '</b></p>';
    if (dye || why === 'mismatch') {
      html += '<p>במדפסות תמונות (Mitsubishi, DNP, Citizen) גודל הנייר בהגדרות המדפסת חייב להתאים לגליל הדיו והנייר שמותקן בה. אם לא, הדרייבר מציג את השגיאה <span dir="ltr">"Paper size of printer driver and Ink Ribbon type do not match"</span> וההדפסה נעצרת.</p>' +
        '<ol class="pd-steps"><li>לוחצים <b>⚙️ הגדרות המדפסת</b> (כאן למטה).</li><li>בוחרים גודל נייר שמתאים לגליל שבמדפסת. למשל: גליל <b>6x8</b> → <span dir="ltr">6x8</span> (או <span dir="ltr">6x4 ×2</span> להדפסת 10×15), גליל <b>4x6</b> → <span dir="ltr">PC 4x6</span>, גליל <b>5x7</b> → <span dir="ltr">5x7</span>.</li><li>שומרים (OK), ואז <b>🖨️ להדפיס שוב לפי הדרייבר</b>.</li></ol>' +
        '<p class="pd-tip">טיפ: גודל הדף בתוכנה (בחלון ההדפסה) צריך להיות אותו גודל כמו בדרייבר. "לפי הדרייבר" נשמר למדפסת הזאת, וההדפסות הבאות יוצאות בגודל שבהגדרות שלה.</p>';
    } else {
      html += '<ol class="pd-steps"><li>בודקים שהמדפסת דלוקה, מחוברת, ויש בה נייר ודיו.</li><li>פותחים את <b>⚙️ הגדרות המדפסת</b> ובודקים את גודל הנייר.</li><li>מנקים את התור ומדפיסים שוב.</li></ol>';
    }
    return html + '<div class="pd-acts"><button type="button" class="btn gold" data-pd="settings">⚙️ הגדרות המדפסת</button><button type="button" class="btn line" data-pd="clear">🧹 ניקוי תור ההדפסה</button><button type="button" class="btn line" data-pd="driver">🖨️ להדפיס שוב לפי הדרייבר</button><button type="button" class="btn line" data-pd="again">🖨️ להדפיס שוב</button></div><p class="pd-st" role="status"></p></div>';
  }
  var open = false;
  function show(dev, why, retry) {
    if (open) return; open = true;
    var title = '⚠️ ' + (why === 'mismatch' ? 'גודל הנייר לא מתאים לגליל' : 'ההדפסה לא יצאה');
    if (!FS.dialog) { open = false; alert(title); return; }
    var pd = FS.dialog(title, explain(dev, why)).querySelector('.pd'); if (!pd) { open = false; return; }
    if (FS.on && !show.hooked) { show.hooked = true; FS.on('dialog-closed', function () { open = false; }); }
    var st = pd.querySelector('.pd-st');
    pd.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pd]'); if (!b) return; var a = b.dataset.pd, p = P();
      if (a === 'settings') { settings(dev).then(function (r) { if (r.ok) st.textContent = 'חלון ההגדרות נפתח (אם הוא מאחור: בשורת המשימות). בוחרים גודל נייר, OK, ואז מדפיסים שוב.'; }); return; }
      if (a === 'clear') { if (!p || !p.clear) { st.textContent = 'ניקוי התור: בתוכנה למחשב בגרסה החדשה.'; return; } st.textContent = 'מנקה…'; p.clear(dev).then(function (r) { st.textContent = r.ok ? '✔ התור נוקה.' : 'לא הצלחתי לנקות את התור.'; }); return; }
      if (a === 'driver') { driverSize(dev, true); close(); if (retry) retry(true); return; }
      if (a === 'again') { close(); if (retry) retry(driverSize(dev)); }
    });
    function close() { open = false; if (FS.closeDialog) FS.closeDialog(); }
  }
  /* after a print: the result, then the queue for about 20 seconds */
  function watch(dev, r, retry) {
    if (!dev) return;
    if (r && !r.ok) { show(dev, /cancel/i.test(r.reason || '') ? 'mismatch' : 'failed', retry); return; }
    var p = P(); if (!p || !p.queue) return;
    var n = 0;
    (function poll() {
      if (++n > 7 || open) return;
      p.queue(dev).then(function (q) {
        if (!q || !q.ok) return;
        var bad = (q.jobs || []).filter(function (j) { return /error|blocked|usersintervention|userintervention|paperproblem|offline/i.test(j.status); });
        var pst = String(q.status || '');
        if (bad.length) return show(dev, /paper/i.test(bad[0].status) || MITSU.test(dev) ? 'mismatch' : 'error', retry);
        if (/error|paperproblem|offline|notavailable/i.test(pst)) return show(dev, /offline|notavailable/i.test(pst) ? 'offline' : 'error', retry);
        if ((q.jobs || []).length) setTimeout(poll, 3000);   /* still printing: look again */
      }, function () {});
    })();
  }
  FS.printDoctor = { watch: watch, show: show, settings: settings, driverSize: driverSize };
})();
