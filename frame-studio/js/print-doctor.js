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
  function photoPrinter(dev) { return MITSU.test(dev) || DNP.test(dev) || CITIZEN.test(dev); }
  /* what Windows says (the printer's status and the job's status) → one kind, with its own words and steps */
  var KINDS = {
    mismatch: { t: 'גודל הנייר לא מתאים לגליל', why: 'במדפסות תמונות (Mitsubishi, DNP, Citizen) גודל הנייר בהגדרות המדפסת חייב להתאים לגליל הדיו והנייר שמותקן בה. אם לא, הדרייבר מציג את השגיאה <span dir="ltr">"Paper size of printer driver and Ink Ribbon type do not match"</span> וההדפסה נעצרת.',
      steps: ['לוחצים <b>⚙️ הגדרות המדפסת</b> (כאן למטה).', 'בוחרים גודל נייר שמתאים לגליל שבמדפסת. למשל: גליל <b>6x8</b> → <span dir="ltr">6x8</span> (או <span dir="ltr">6x4 ×2</span> להדפסת 10×15), גליל <b>4x6</b> → <span dir="ltr">PC 4x6</span>, גליל <b>5x7</b> → <span dir="ltr">5x7</span>.', 'שומרים (OK), ואז <b>🖨️ להדפיס שוב לפי הדרייבר</b>.'],
      tip: 'גודל הדף בתוכנה צריך להיות אותו גודל כמו בדרייבר. "לפי הדרייבר" נשמר למדפסת הזאת, וההדפסות הבאות יוצאות בגודל שבהגדרות שלה.' },
    paperout: { t: 'נגמר הנייר', why: 'המדפסת מדווחת שאין בה נייר.', photo: 'במדפסות תמונות הנייר והסרט (הדיו) נגמרים יחד ומוחלפים יחד, כערכה אחת.',
      steps: ['פותחים את המדפסת ומחליפים את גליל הנייר.', 'במדפסת תמונות: מחליפים גם את סרט הדיו מאותה ערכה.', 'סוגרים עד הקליק, ממתינים שהנורה תתייצב.', 'לוחצים <b>🖨️ להדפיס שוב</b>. התמונות שלא יצאו נשלחות מחדש.'],
      tip: 'אחרי החלפה: בתפריט ההדפסה בתוכנה מאפסים את מונה הדיו והנייר, כדי שההערכה של "כמה נשאר" תהיה נכונה.' },
    ribbon: { t: 'נגמר הדיו (הסרט)', why: 'המדפסת מדווחת שהסרט (הדיו) נגמר או חסר.',
      steps: ['פותחים את המדפסת ומחליפים את סרט הדיו (ובמדפסות תמונות גם את הנייר מאותה ערכה).', 'בודקים שהסרט מתוח ונכנס עד הסוף.', 'סוגרים ולוחצים <b>🖨️ להדפיס שוב</b>.'],
      tip: 'הסרט והנייר צריכים להיות מאותו סוג וגודל (למשל ערכת 6x8 שלמה). ערבוב בין ערכות גורם גם לשגיאת "לא מתאים".' },
    jam: { t: 'נייר תקוע', why: 'המדפסת מדווחת על נייר תקוע.',
      steps: ['מכבים את המדפסת.', 'פותחים את הדלת ומוציאים בעדינות את הנייר התקוע (בלי לחתוך את הסרט).', 'גוזרים את קצה הגליל ישר אם הוא קרוע, ומחזירים.', 'מדליקים, ממתינים לנורה יציבה, ולוחצים <b>🧹 ניקוי תור</b> ואז <b>🖨️ להדפיס שוב</b>.'] },
    door: { t: 'דלת המדפסת פתוחה', why: 'המדפסת מדווחת שהמכסה או הדלת פתוחים.',
      steps: ['סוגרים את הדלת עד הקליק.', 'אם היא סגורה ועדיין יש הודעה: פותחים, בודקים שהסרט והנייר במקומם, וסוגרים שוב בחוזקה.', 'לוחצים <b>🖨️ להדפיס שוב</b>.'] },
    offline: { t: 'המדפסת לא מחוברת', why: 'Windows לא מצליח להגיע למדפסת: היא כבויה, הכבל לא מחובר, או שהיא במצב "לא מקוון".',
      steps: ['בודקים שהמדפסת דלוקה והנורה יציבה.', 'בודקים את כבל ה־USB בשני הצדדים (עדיף ישר למחשב, בלי מפצל).', 'אם זה לא עוזר: מכבים ומדליקים את המדפסת, ממתינים חצי דקה.', 'לוחצים <b>🧹 ניקוי תור</b> ואז <b>🖨️ להדפיס שוב</b>.'],
      tip: 'אם Windows מסמן את המדפסת "לא מקוון": הגדרות ← מדפסות ← המדפסת ← לבטל "השתמש במדפסת במצב לא מקוון".' },
    busy: { t: 'המדפסת עדיין עסוקה', why: 'יש עבודות קודמות בתור שעוד לא יצאו, ולכן ההדפסה החדשה ממתינה.',
      steps: ['ממתינים עוד רגע: מדפסת תמונות מדפיסה דף בכ־10 עד 20 שניות.', 'אם שום דבר לא זז: <b>🧹 ניקוי תור</b>, ואז <b>🖨️ להדפיס שוב</b>.'] },
    error: { t: 'המדפסת דיווחה על תקלה', why: 'המדפסת דיווחה על תקלה בהדפסה, בלי פירוט.',
      steps: ['מסתכלים על המדפסת: נורה אדומה או הודעה על המסך שלה אומרות מה חסר.', 'בודקים נייר, סרט, ודלת סגורה.', 'פותחים <b>⚙️ הגדרות המדפסת</b> ובודקים את גודל הנייר.', '<b>🧹 ניקוי תור</b> ואז <b>🖨️ להדפיס שוב</b>.'] },
    failed: { t: 'ההדפסה לא יצאה', why: 'ההדפסה לא נשלחה למדפסת.',
      steps: ['בודקים שהמדפסת דלוקה ומחוברת.', 'פותחים <b>⚙️ הגדרות המדפסת</b> ובודקים את גודל הנייר.', '<b>🧹 ניקוי תור</b> ואז <b>🖨️ להדפיס שוב</b>.'] }
  };
  /* the words Windows uses (Get-Printer PrinterStatus, Get-PrintJob JobStatus) → a kind; '' = nothing wrong */
  function classify(text, dev) {
    var s = String(text || '').toLowerCase().replace(/\s+/g, '');
    if (!s || /^(normal|printing|processing|idle|ready|spooling|warmingup|initializing|powersave|retained|printed|complete|deleting)(,|$)/.test(s) && !/error|out|jam|door|offline|toner|problem|intervention|blocked/.test(s)) return '';
    if (/paperout|outofpaper/.test(s)) return 'paperout';
    if (/notoner|tonerlow|ribbon/.test(s)) return 'ribbon';
    if (/paperjam|jam/.test(s)) return 'jam';
    if (/dooropen/.test(s)) return 'door';
    if (/offline|notavailable|serverunknown/.test(s)) return 'offline';
    if (/paperproblem/.test(s)) return 'mismatch';
    if (/error|blocked|userintervention|usersintervention/.test(s)) return MITSU.test(dev) ? 'mismatch' : 'error';
    return '';
  }
  function explain(dev, kind) {
    var k = KINDS[kind] || KINDS.failed, photo = photoPrinter(dev);
    var html = '<div class="pd"><p class="pd-dev">🖨️ <b>' + FS.esc(dev) + '</b></p><p>' + k.why + (photo && k.photo ? ' ' + k.photo : '') + '</p>' +
      '<ol class="pd-steps">' + k.steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>' + (k.tip ? '<p class="pd-tip">טיפ: ' + k.tip + '</p>' : '');
    return html + '<div class="pd-acts"><button type="button" class="btn gold" data-pd="settings">⚙️ הגדרות המדפסת</button><button type="button" class="btn line" data-pd="clear">🧹 ניקוי תור ההדפסה</button>' +
      (kind === 'mismatch' ? '<button type="button" class="btn line" data-pd="driver">🖨️ להדפיס שוב לפי הדרייבר</button>' : '') + '<button type="button" class="btn line" data-pd="again">🖨️ להדפיס שוב</button></div><p class="pd-st" role="status"></p></div>';
  }
  var open = false;
  function show(dev, kind, retry) {
    if (open) return; open = true;
    var title = '⚠️ ' + (KINDS[kind] || KINDS.failed).t;
    if (!FS.dialog) { open = false; alert(title); return; }
    var pd = FS.dialog(title, explain(dev, kind)).querySelector('.pd'); if (!pd) { open = false; return; }
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
  function read(dev) {
    var p = P(); if (!p || !p.queue) return Promise.resolve(null);
    return Promise.race([p.queue(dev), new Promise(function (r) { setTimeout(function () { r(null); }, 4000); })]).then(function (q) {
      if (!q || !q.ok) return null;
      var jobs = q.jobs || [], bad = '';
      jobs.some(function (j) { bad = classify(j.status, dev); return !!bad; });
      return { kind: bad || classify(q.status, dev), jobs: jobs.length };
    }, function () { return null; });
  }
  /* before a print: a printer that is off, out of paper or ribbon, jammed or open is found before anything is sent.
     Answers true to go ahead; on a problem the window opens and its "להדפיס שוב" sends the print. */
  function precheck(dev, go) {
    return read(dev).then(function (r) {
      if (r && r.kind && r.kind !== 'mismatch' && r.kind !== 'error') { show(dev, r.kind, go); return false; }
      return true;
    });
  }
  /* after a print: the result, then the queue for about 20 seconds */
  function watch(dev, r, retry) {
    if (!dev) return;
    if (r && !r.ok) { show(dev, /cancel/i.test(r.reason || '') && MITSU.test(dev) ? 'mismatch' : 'failed', retry); return; }
    var n = 0;
    (function poll() {
      if (++n > 7 || open) return;
      read(dev).then(function (q) {
        if (!q) return;
        if (q.kind) return show(dev, q.kind, retry);
        if (q.jobs) setTimeout(poll, 3000);   /* still printing: look again */
      });
    })();
  }
  FS.printDoctor = { watch: watch, precheck: precheck, show: show, settings: settings, driverSize: driverSize, classify: classify, KINDS: KINDS };
})();
