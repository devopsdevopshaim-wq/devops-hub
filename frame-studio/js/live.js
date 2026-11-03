/* 🎉 The live event in the studio (rail tab "אירוע חי"):
   - the event: title, date, the couple's details, price and cost per magnet; from a deal in one click
   - the guests' QR sign for the tables (live.html), the big screen for the hall (wall.html), the couple's album (album.html)
   - the station: takes guests' photos from the shared queue on the server (several stations never get the same photo),
     puts each one in the design of the photo on screen, and prints them on its own, one by one or a few on a sheet;
     a double print gives one magnet to the guest and one for the couple's album; printed magnets go to the digital album
   - the report: photos, greetings, magnets, paper cost, income and profit, for the event and by month
   - after the event: the album and a review request to the couple on WhatsApp (the server also emails it the day after)
   - staff mode: a simple screen for a worker at the event, locked with a code, without prices, deals or settings */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc;
  var KS = 'fs-live', KSTAFF = 'fs-staff';
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  var cfg = Object.assign({ ev: '', station: 'עמדה 1', auto: true, per: 'one', tpl: null }, load(KS, {}));
  var main = null;   /* the studio's main QR: { m, e } (one printed code for every event) */
  var events = [], ev = null, run = { on: false, timer: 0, busy: false, queue: [], got: 0, printed: 0, waiting: 0, stations: {} };

  /* ---------- the server ---------- */
  function token() { var s = FS.account && FS.account.session(); if (s && s.token && !s.mustChange) return s.token; var L = FS.license && FS.license.get(); return L && L.token || ''; }
  function api(action, data) {
    var t = token(); if (!t) return Promise.resolve({ ok: false, error: 'signed-out' });
    var base = FS.account && FS.account.apiBase ? FS.account.apiBase() : Promise.resolve('https://spider-auth.devopsdevopshaim.workers.dev');
    return base.then(function (u) { return fetch(u + '/frame-live', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(Object.assign({}, data || {}, { action: action, token: t })) }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http-' + r.status }; }); }, function () { return { ok: false, error: 'offline' }; });
  }
  function err(r) { return r && r.error === 'offline' ? 'אין חיבור לאינטרנט' : r && r.error === 'signed-out' ? 'צריך להיכנס לסטודיו מחדש' : FS.account ? FS.account.msg(r) : 'שגיאה'; }
  var siteBase = new URL('.', location.href).href.replace(/\/frame-studio\/.*$/, '/frame-studio/');
  if (window.FSDesktop) siteBase = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/';
  function link(page, keyName, key) { return ev ? siteBase + page + '?e=' + ev.id + '&' + keyName + '=' + key : ''; }
  function guestUrl() { return link('live.html', 'k', ev.k); }
  function mainUrl() { return main && main.m ? siteBase + 'live.html?m=' + main.m : ''; }
  function wallUrl() { return link('wall.html', 'v', ev.v); }
  function albumUrl() { return link('album.html', 'v', ev.v); }
  function imgUrl(id) { return (FS.account && FS.account.apiBase ? FS.account.apiBase() : Promise.resolve('')).then(function (u) { return u + '/frame-live-img?e=' + ev.id + '&p=' + id + '&v=' + ev.v; }); }
  function copy(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { FS.toast(msg); }, function () { window.prompt('העתקה:', t); }); }
  function wa(phone, text) { var p = String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  function money(n) { return '₪' + Math.round(Number(n) || 0).toLocaleString('he-IL'); }
  function heDate(iso) { var d = new Date(String(iso) + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  var today = function () { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  /* ---------- the panel ---------- */
  var pane = document.createElement('section'); pane.dataset.pane = 'live'; pane.hidden = true;
  var panel = $('#panel'); panel.insertBefore(pane, $('[data-pane=collage]', panel) || $('[data-pane=output]', panel));
  var tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.tab = 'live';
  tab.innerHTML = '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4"/></svg>אירוע חי<i class="lv-dot" hidden></i>';
  var rail = $('.tools'); rail.insertBefore(tab, $('[data-tab=collage]', rail) || $('[data-tab=output]', rail));
  tab.addEventListener('click', function () { FS.openTab('live'); });
  var openTab = FS.openTab; FS.openTab = function (n) { var r = openTab(n); if (n === 'live') setTimeout(refresh, 20); return r; };

  function draw() {
    var signed = !!token();
    if (!signed) { pane.innerHTML = '<h2>🎉 אירוע חי</h2><p class="hint">צריך להיות מחוברים לסטודיו (בעל העסק או קוד הפעלה) כדי לפתוח אירוע חי.</p>'; return; }
    var n = ev ? ev.n || {} : {}, prints = n.prints || 0, cost = ev ? prints * (ev.cost || 0) : 0, due = reviewDue();
    pane.innerHTML = '<h2>🎉 אירוע חי</h2>' +
      '<p class="hint">האורחים סורקים QR בשולחן, מצלמים, והתמונה מגיעה לכאן ומודפסת כמגנט. עם ברכה, מסך ענק באולם ואלבום דיגיטלי לזוג.</p>' +
      (due.length ? '<div class="lv-due lv-owner">' + due.map(function (e) { return '<p>⭐ האירוע "' + esc(e.title) + '" היה ' + (e.date === yesterday() ? 'אתמול' : 'לאחרונה') + '. <button class="btn small" data-review="' + e.id + '">💬 אלבום + בקשת המלצה לזוג</button></p>'; }).join('') + '</div>' : '') +
      mainCard() +
      '<div class="field lv-owner"><label>האירוע</label><div class="lv-row"><select id="lv-ev">' + (events.length ? '' : '<option value="">אין עדיין אירועים</option>') +
        events.map(function (e) { return '<option value="' + e.id + '"' + (ev && ev.id === e.id ? ' selected' : '') + '>' + esc(e.title) + ' · ' + esc(e.date || '') + '</option>'; }).join('') + '</select>' +
        '<button class="btn small" id="lv-new">➕ חדש</button>' + (ev ? '<button class="btn small" id="lv-edit" title="עריכת פרטי האירוע">✏️</button>' : '') + '</div></div>' +
      (!ev ? '<p class="hint">פותחים אירוע חדש (אפשר מתוך עסקה), ואז מדפיסים את שלט ה־QR לשולחנות.</p>' :
      '<div class="card lv-card"><h3>' + esc(ev.title) + '</h3><p class="lv-meta">' + esc(heDate(ev.date)) + (ev.couple && ev.couple.name ? ' · ' + esc(ev.couple.name) : '') + (ev.open ? ' · <b class="ok">פתוח להעלאות</b>' : ' · <b class="no">סגור להעלאות</b>') + '</p>' +
        '<div class="lv-links"><button class="btn primary" id="lv-sign">🖨️ שלט QR לשולחנות</button><button class="btn" id="lv-wall">📺 מסך ענק לאולם</button>' +
        '<button class="btn" id="lv-guest">🔗 קישור לאורחים</button><button class="btn lv-owner" id="lv-album">💞 האלבום של הזוג</button>' +
        '<button class="btn lv-owner" id="lv-photos">🗂️ ניהול התמונות</button><button class="btn lv-owner" id="lv-send">💬 אלבום + המלצה לזוג</button></div>' +
        '<div class="lv-links lv-wow"><button class="btn" id="lv-mirror" title="מצלמה באירוע: האורחים רואים את עצמם בתוך המגנט, עם רקע לבחירה, ומצלמים להדפסה">🪞 מראה קסם</button>' +
        '<button class="btn" id="lv-mosaic" title="על המסך הגדול נבנית תמונת הזוג מכל התמונות של האורחים">🧩 פסיפס חי</button>' +
        '<button class="btn lv-owner" id="lv-hero" title="התמונה שעל המסך עכשיו תהיה תמונת הפסיפס">💞 תמונת הזוג לפסיפס' + (ev.hero ? ' ✓' : '') + '</button>' +
        '<button class="btn lv-owner" id="lv-faces" title="מכין את &quot;מצא אותי&quot; באלבום: מאתר פנים בכל תמונות האירוע">🔍 מצא אותי' + (ev.n && ev.n.faces ? ' (' + ev.n.faces + ')' : '') + '</button>' +
        '<button class="btn" id="lv-qr1" title="QR חי על התמונה שעל המסך">✨ QR חי לתמונה הזו</button></div>' +
        '<label class="check lv-owner"><input type="checkbox" id="lv-open"' + (ev.open ? ' checked' : '') + '> האורחים יכולים לשלוח תמונות</label>' +
        '<p class="lv-dz">' + (ev.design ? '🎨 המגנט של האירוע: <b>' + esc(ev.design.name || ev.design.email) + '</b> (העיצוב של הלקוח)' : '🎨 עוד לא נבחר עיצוב לקוח למגנט') + '</p></div>' +
      '<div class="card lv-card"><h3>🖨️ העמדה</h3>' +
        '<div class="row2"><div class="field"><label>שם העמדה</label><input id="lv-station" maxlength="30" value="' + esc(cfg.station) + '"></div>' +
        '<div class="field"><label>הדפסה</label><select id="lv-per"><option value="one">כל תמונה מיד</option><option value="2">2 בדף</option><option value="4">4 בדף</option><option value="fill">כמה שנכנס בדף</option></select></div></div>' +
        '<label class="check"><input type="checkbox" id="lv-auto"' + (cfg.auto ? ' checked' : '') + '> הדפסה אוטומטית כשמגיעה תמונה</label>' +
        '<div class="lv-albqr"><label class="check"><input type="checkbox" id="lv-albqr"' + (cfg.albumQr ? ' checked' : '') + '> 🔗 QR לתמונות האירוע על כל תמונה (שמאל למטה). סורקים ורואים את כל התמונות של האירוע</label>' +
          '<div class="inline"><button class="btn small" id="lv-albqr-all">➕ להוסיף לתמונות שבפרויקט</button><button class="btn small" id="lv-albqr-off">✖ להסיר מהתמונות</button></div></div>' +
        '<label class="check"><input type="checkbox" id="lv-magic"' + (cfg.magic !== false ? ' checked' : '') + '> ✨ מגנט חי: QR קטן על כל מגנט. בבית סורקים, והמגנט מתעורר עם הברכה, וקפסולת זמן לזוג</label>' +
        '<label class="check"><input type="checkbox" id="lv-wish"' + (cfg.wish ? ' checked' : '') + '> ✍️ הברכה של האורח בכתב יד על המגנט</label>' +
        '<p class="lv-copies">' + (ev.copies > 1 ? '🧲🧲 הדפסה כפולה: מגנט לאורח ועוד אחד לאלבום של הזוג' : '🧲 מגנט אחד לכל תמונה') + ' <button class="btn small lv-owner" id="lv-dbl">' + (ev.copies > 1 ? 'רק אחד' : 'הדפסה כפולה') + '</button></p>' +
        '<div class="lv-tpl"><button class="btn small" id="lv-tpl">🎯 העיצוב של התמונה שעל המסך לכל תמונה של אורח</button>' + (cfg.tpl || cfg.tplFrame ? '<span>✓ יש עיצוב קבוע' + (cfg.tplFrame && !cfg.tpl ? ' (של הלקוח)' : '') + ' <button class="btn small" id="lv-tpl-x">ביטול</button></span>' : '<span class="hint">בלי עיצוב קבוע: התמונה נכנסת כמו שהיא</span>') + '</div>' +
        '<button class="btn wide ' + (run.on ? '' : 'primary') + '" id="lv-run">' + (run.on ? '⏹ עצירת העמדה' : '▶ הפעלת העמדה') + '</button>' +
        '<div class="lv-stats"><span>בתור בשרת <b id="lv-w">' + run.waiting + '</b></span><span>התקבלו כאן <b id="lv-g">' + run.got + '</b></span><span>מחכות להדפסה <b id="lv-q">' + run.queue.length + '</b></span><span>הודפסו <b id="lv-p">' + run.printed + '</b></span></div>' +
        '<button class="btn small" id="lv-print-now"' + (run.queue.length ? '' : ' disabled') + '>🖨️ הדפסת מה שמחכה עכשיו</button>' +
        '<p class="lv-status" id="lv-status" role="status">' + (run.on ? '🔴 העמדה פעילה ומקבלת תמונות' : 'העמדה כבויה') + '</p>' +
        '<div class="lv-st" id="lv-st">' + stationsHtml() + '</div>' +
        (FS.eventFolder ? '<button class="btn wide" id="lv-finish">🏁 סיום האירוע: שמירה לתיקייה במחשב וכיווץ</button>' : '') + '</div>' +
      '<div class="card lv-card lv-owner"><h3>📊 דוח האירוע</h3><dl class="lv-rep">' +
        '<div><dt>תמונות מאורחים</dt><dd>' + (n.in || 0) + '</dd></div><div><dt>ברכות</dt><dd>' + (n.wishes || 0) + '</dd></div>' +
        '<div><dt>מגנטים שהודפסו</dt><dd>' + prints + '</dd></div><div><dt>באלבום הדיגיטלי</dt><dd>' + ((n.album || 0) + (n.in || 0)) + '</dd></div>' +
        '<div><dt>עלות נייר ומגנט</dt><dd>' + money(cost) + ' <small>(₪' + (ev.cost || 0) + ' ליחידה)</small></dd></div><div><dt>הכנסה</dt><dd>' + money(ev.price || 0) + '</dd></div>' +
        '<div class="sum"><dt>רווח</dt><dd>' + money((ev.price || 0) - cost) + '</dd></div></dl>' +
        '<button class="btn small" id="lv-month">📅 דוח חודשי</button></div>') +
      (isAdmin() ? '<div class="lv-staff lv-owner"><button class="btn small" id="lv-dzl">🎨 עיצובים מאושרים של לקוחות</button></div>' : '') +
      '<div class="lv-staff"><button class="btn small" id="lv-staff">👷 מצב עובד (מסך פשוט לעובד באירוע)</button></div>';
    var sel = $('#lv-ev', pane); if (sel) sel.addEventListener('change', function () { pick(this.value); });
    on('#lv-main-set', function () { if (!ev) return; api('main-set', { e: ev.id }).then(function (r) { if (!r.ok) return FS.toast('לא עודכן: ' + err(r), 4000); main = r; draw(); FS.toast('⭐ הקוד הראשי מוביל עכשיו אל "' + ev.title + '"', 4000); }); });
    on('#lv-main-sign', function () { sign(true); });
    on('#lv-main-copy', function () { if (mainUrl()) copy(mainUrl(), '🔗 הקישור של הקוד הראשי הועתק'); });
    $('#lv-new', pane).addEventListener('click', function () { editEvent(null); });
    on('#lv-edit', function () { editEvent(ev); });
    on('#lv-sign', sign); on('#lv-wall', function () { window.open(wallUrl(), '_blank', 'noopener'); });
    on('#lv-guest', function () { copy(guestUrl(), '🔗 הקישור לאורחים הועתק'); });
    on('#lv-album', function () { copy(albumUrl(), '💞 הקישור לאלבום הועתק'); });
    on('#lv-photos', managePhotos); on('#lv-send', function () { review(ev); });
    on('#lv-open', function () { saveEv({ open: this.checked }); }, 'change');
    on('#lv-dbl', function () { saveEv({ copies: ev.copies > 1 ? 1 : 2 }); });
    on('#lv-station', function () { cfg.station = this.value.trim() || 'עמדה 1'; keep(KS, cfg); }, 'change');
    var per = $('#lv-per', pane); if (per) { per.value = cfg.per; per.addEventListener('change', function () { cfg.per = this.value; keep(KS, cfg); }); }
    on('#lv-auto', function () { cfg.auto = this.checked; keep(KS, cfg); if (cfg.auto) maybePrint(); }, 'change');
    on('#lv-magic', function () { cfg.magic = this.checked; keep(KS, cfg); }, 'change');
    on('#lv-albqr', function () { cfg.albumQr = this.checked; keep(KS, cfg); if (this.checked) FS.toast('🔗 כל תמונה חדשה וכל מגנט מהעמדה יקבלו QR לתמונות האירוע. לתמונות שכבר בפרויקט: "➕ להוסיף לתמונות שבפרויקט".', 6000); }, 'change');
    on('#lv-albqr-all', function () {
      var l = FS.marked().length ? FS.marked() : S.photos.slice(); if (!l.length) return FS.toast('אין תמונות בפרויקט');
      FS.busy('מוסיף QR לתמונות האירוע…');
      l.reduce(function (ch, p) { return ch.then(function () { return FS.albumTag(p, ev); }); }, Promise.resolve()).then(function () { FS.busy(); FS.emit('doc'); FS.toast('🔗 נוסף QR ל־' + l.length + ' תמונות (שמאל למטה)'); }, function () { FS.busy(); FS.toast('מחולל ה־QR לא נטען'); });
    });
    on('#lv-albqr-off', function () { var l = FS.marked().length ? FS.marked() : S.photos.slice(); l.forEach(function (p) { FS.albumUntag(p); }); FS.emit('doc'); FS.render && FS.render(); FS.toast('ה־QR הוסר מ־' + l.length + ' תמונות'); });
    on('#lv-mirror', function () {
      var p = FS.cur(), F = null;
      if (p) { var k = Math.min(1, 1400 / Math.max(p.doc.w, p.doc.h)), c = FS.canvas(p.doc.w * k, p.doc.h * k), H = FS.hole(p.doc);
        FS.draw(c.getContext('2d'), p, { scale: k, transparent: true, noPhoto: true, export: true });
        F = { src: c.toDataURL('image/png'), w: c.width, h: c.height, hole: { x: H.x * k, y: H.y * k, w: H.w * k, h: H.h * k } }; try { localStorage.setItem('fs-mirror-frame', JSON.stringify(F)); } catch (e) { /* full */ } }
      var w = window.open(link('mirror.html', 'k', ev.k), '_blank');
      if (w && F) [800, 2000, 4000].forEach(function (ms) { setTimeout(function () { try { w.postMessage({ mirrorFrame: F }, '*'); } catch (e) { /* closed */ } }, ms); });
      FS.toast('🪞 המראה נפתחה עם המסגרת של התמונה שעל המסך. מומלץ טאבלט או מחשב עם מצלמה, במסך מלא.', 6000);
    });
    on('#lv-mosaic', function () { window.open(wallUrl() + '&mosaic=1', '_blank'); if (!ev.hero) FS.toast('💡 בוחרים קודם "תמונת הזוג לפסיפס" (התמונה שעל המסך).', 6000); });
    on('#lv-hero', function () {
      var p = FS.cur(); if (!p) return FS.toast('פותחים את תמונת הזוג על המסך');
      var k = Math.min(1, 1400 / Math.max(p.doc.w, p.doc.h)), c = FS.renderFull(p, k, false);
      api('ev-hero', { e: ev.id, img: c.toDataURL('image/jpeg', 0.88).split(',')[1] }).then(function (r) { if (!r.ok) return FS.toast(err(r)); ev.hero = true; draw(); FS.toast('💞 תמונת הזוג לפסיפס נשמרה. "🧩 פסיפס חי" פותח אותו למסך הגדול.', 6000); });
    });
    on('#lv-faces', function () { if (FS.faceIndexEvent) FS.faceIndexEvent(ev, imgUrl); });
    on('#lv-qr1', function () { var p = FS.cur(); if (!p) return FS.toast('פותחים תמונה'); FS.magicTag(p, ev).then(function () { FS.toast('✨ נוסף QR חי. כשהיא מודפסת בזמן שהעמדה פעילה, המגנט מתעורר בסריקה.', 6000); }); });
    on('#lv-wish', function () { cfg.wish = this.checked; keep(KS, cfg); }, 'change');
    on('#lv-tpl', function () { var p = FS.cur(); if (!p) return FS.toast('פותחים קודם תמונה עם העיצוב הרצוי (מסגרת, גודל, טקסט)'); cfg.tpl = JSON.parse(JSON.stringify(p.doc)); cfg.tplFrame = null; keep(KS, cfg); FS.toast('🎯 כל תמונה חדשה של אורח תקבל את העיצוב הזה', 4000); draw(); });
    on('#lv-tpl-x', function () { cfg.tpl = null; cfg.tplFrame = null; keep(KS, cfg); draw(); });
    on('#lv-run', function () { if (run.on) stop(); else start(); });
    on('#lv-print-now', function () { printQueue(true); });
    on('#lv-month', monthly);
    on('#lv-staff', function () { staffOn(); });
    on('#lv-dzl', approvedList);
    on('#lv-finish', function () { if (run.on && confirm('לעצור את העמדה לפני סיום האירוע?')) stop(); FS.eventFolder.finish(); });
    $$('[data-review]', pane).forEach(function (b) { b.addEventListener('click', function () { review(events.filter(function (e) { return e.id === b.dataset.review; })[0]); }); });
  }
  function on(sel, fn, evName) { var el = $(sel, pane); if (el) el.addEventListener(evName || 'click', fn); }
  function stationsHtml() {
    var st = (ev && (run.stations && Object.keys(run.stations).length ? run.stations : ev.stations)) || {}, now = Date.now();
    var names = Object.keys(st); if (!names.length) return '';
    return '<p class="hint">עמדות באירוע:</p><ul>' + names.map(function (k) { var s = st[k], live = now - (s.seen || 0) < 30000; return '<li>' + (live ? '🟢' : '⚪') + ' ' + esc(k) + ' · ' + (s.printed || 0) + ' הודפסו</li>'; }).join('') + '</ul>';
  }
  function yesterday() { return new Date(Date.parse(today() + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10); }
  function reviewDue() {
    var t = today(), week = new Date(Date.parse(t + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
    return events.filter(function (e) { return e.date && e.date < t && e.date >= week && !e.reviewAt && e.couple && e.couple.phone; });
  }

  /* ---------- events ---------- */
  function refresh() {
    if (!token()) { draw(); return Promise.resolve(); }
    api('main-get').then(function (r) { if (r && r.ok) { main = r; draw(); } });
    return api('ev-list').then(function (r) {
      if (!r.ok) { draw(); if (r.error !== 'signed-out') FS.toast('האירועים לא נטענו: ' + err(r), 4000); return; }
      events = r.events; ev = events.filter(function (e) { return e.id === cfg.ev; })[0] || (cfg.ev ? null : events.filter(function (e) { return e.date >= today(); }).pop() || events[0]) || null;
      if (ev) { cfg.ev = ev.id; keep(KS, cfg); }
      draw();
    });
  }
  function pick(id) { if (run.on) stop(); ev = events.filter(function (e) { return e.id === id; })[0] || null; cfg.ev = ev ? ev.id : ''; keep(KS, cfg); draw(); }
  function saveEv(patch) {
    var e = Object.assign({}, ev, patch);
    return api('ev-save', { event: e }).then(function (r) {
      if (!r.ok) { FS.toast('לא נשמר: ' + err(r), 4000); return draw(); }
      ev = r.event; events = events.map(function (x) { return x.id === ev.id ? ev : x; }); draw();
    });
  }
  function editEvent(e) {
    var isNew = !e; e = e || { title: '', date: today(), couple: {}, copies: 1, cost: Number(cfg.cost) || 1.5, price: 0, open: true, album: true };
    var body = FS.dialog(isNew ? '🎉 אירוע חי חדש' : '✏️ פרטי האירוע',
      '<div class="lv-form"><div class="field lv-from" hidden><label>מתוך עסקה</label><select id="lf-deal"><option value="">—</option></select></div>' +
      '<div class="field"><label>שם האירוע (מופיע לאורחים ובמסך)</label><input id="lf-title" maxlength="80" value="' + esc(e.title) + '" placeholder="החתונה של נועה ודניאל"></div>' +
      '<div class="row2"><div class="field"><label>תאריך</label><input type="date" id="lf-date" value="' + esc(e.date) + '"></div><div class="field"><label>שם בעלי השמחה</label><input id="lf-name" maxlength="60" value="' + esc(e.couple.name || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label>טלפון (לוואטסאפ)</label><input id="lf-phone" dir="ltr" inputmode="tel" value="' + esc(e.couple.phone || '') + '"></div><div class="field"><label>מייל (האלבום נשלח אוטומטית יום אחרי)</label><input id="lf-email" dir="ltr" type="email" value="' + esc(e.couple.email || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label>מחיר האירוע (₪)</label><input type="number" id="lf-price" min="0" value="' + (e.price || 0) + '"></div><div class="field"><label>עלות נייר + מגנט ליחידה (₪)</label><input type="number" id="lf-cost" min="0" step="0.1" value="' + (e.cost || 0) + '"></div></div>' +
      '<label class="check"><input type="checkbox" id="lf-dbl"' + (e.copies > 1 ? ' checked' : '') + '> הדפסה כפולה: מגנט לאורח ועוד אחד לאלבום של הזוג</label>' +
      '<label class="check"><input type="checkbox" id="lf-album"' + (e.album !== false ? ' checked' : '') + '> המגנטים שמודפסים נכנסים גם לאלבום הדיגיטלי</label>' +
      '<div class="inline"><button class="btn primary" id="lf-save">' + (isNew ? '✔ פתיחת האירוע' : '✔ שמירה') + '</button>' + (isNew ? '' : '<button class="btn danger" id="lf-del">🗑 מחיקת האירוע</button>') + '</div></div>');
    if (isNew && FS.deals && FS.account && FS.account.isAdmin()) {
      FS.deals.all().then(function (ds) {
        var from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), list = (ds || []).filter(function (d) { return d.date && d.date >= from && !d.cancelled; }).slice(0, 60);
        if (!list.length) return;
        var s = $('#lf-deal', body); if (!s) return; $('.lv-from', body).hidden = false;
        s.innerHTML += list.map(function (d, i) { return '<option value="' + i + '">' + esc((d.typeName || d.type || 'אירוע') + ' · ' + ((d.client && d.client.name) || '') + ' · ' + d.date) + '</option>'; }).join('');
        s.addEventListener('change', function () {
          var d = list[Number(this.value)]; if (!d) return; var c = d.client || {};
          $('#lf-title', body).value = (d.typeName || 'האירוע') + (c.name ? ' של ' + c.name : ''); $('#lf-date', body).value = d.date; $('#lf-name', body).value = c.name || '';
          $('#lf-phone', body).value = c.phone || ''; $('#lf-email', body).value = c.email || ''; $('#lf-price', body).value = Math.round(FS.dealTotals ? FS.dealTotals(d).total : Number(d.price) || 0);
          body.dataset.deal = d.id || '';
        });
      }).catch(function () {});
    }
    $('#lf-save', body).addEventListener('click', function () {
      var o = Object.assign({}, isNew ? {} : e, { title: $('#lf-title', body).value.trim(), date: $('#lf-date', body).value, couple: { name: $('#lf-name', body).value.trim(), phone: $('#lf-phone', body).value.trim(), email: $('#lf-email', body).value.trim() },
        price: Number($('#lf-price', body).value) || 0, cost: Number($('#lf-cost', body).value) || 0, copies: $('#lf-dbl', body).checked ? 2 : 1, album: $('#lf-album', body).checked, dealId: body.dataset.deal || e.dealId || '',
        bizName: FS.BIZ && FS.BIZ.name || '', google: (FS.BIZ && FS.BIZ.googleReviews) || (FS.BIZ_SITE && FS.BIZ_SITE.googleReviews) || '' });
      if (!o.title) return FS.toast('כותבים שם לאירוע');
      cfg.cost = o.cost; keep(KS, cfg);
      api('ev-save', { event: o }).then(function (r) {
        if (!r.ok) return FS.toast('לא נשמר: ' + err(r), 4500);
        FS.closeDialog(); cfg.ev = r.event.id; keep(KS, cfg);
        refresh().then(function () { if (isNew) FS.toast('🎉 האירוע נפתח. מדפיסים את שלט ה־QR לשולחנות ומפעילים את העמדה.', 6000); });
      });
    });
    var del = $('#lf-del', body); if (del) del.addEventListener('click', function () {
      if (!confirm('למחוק את האירוע "' + e.title + '" עם כל התמונות והברכות שלו? אי אפשר לשחזר.')) return;
      if (run.on) stop();
      api('ev-del', { e: e.id }).then(function (r) { if (!r.ok) return FS.toast(err(r)); FS.closeDialog(); cfg.ev = ''; keep(KS, cfg); ev = null; refresh(); });
    });
  }

  /* ---------- the customers' approved designs (from the designer, design.html): the event's magnet ---------- */
  function isAdmin() { return !!(FS.account && FS.account.isAdmin()); }
  var dzCache = load('fs-live-dz', {});
  function frameRef(id) { return { kind: 'png', id: id, opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false }; }
  /* the customer's frame already carries the business line at the bottom: the studio's own copy goes, so it isn't printed twice */
  function putDesign(p, id) { FS.setFrame(p, frameRef(id), { quiet: true }); p.noCredit = true; p.doc.layers = p.doc.layers.filter(function (L) { return !L.credit; }); FS.snap(p); }
  /* the customer's print frame, as one of the studio's frames (fetched once, kept with the studio's own frames) */
  function dzFrame(dz) {
    var key = dz.email + ':' + dz.id, have = dzCache[key];
    if (have && FS.USER_FRAMES && FS.USER_FRAMES[have]) return Promise.resolve(FS.USER_FRAMES[have]);
    return FS.account.call('approved-frame', { email: dz.email, id: dz.id }).then(function (r) {
      if (!r.ok) throw new Error(err(r));
      return FS.addUserFrame('data:image/png;base64,' + r.frame, (dz.names || dz.name || 'עיצוב לקוח') + ' 🎨', true);
    }).then(function (u) { dzCache[key] = u.id; keep('fs-live-dz', dzCache); if (FS.buildFrames) FS.buildFrames(); return u; });
  }
  /* the station prints every guest's photo in it */
  function useDesign(dz, toEvent) {
    FS.busy('טוען את העיצוב של הלקוח…');
    return dzFrame(dz).then(function (u) {
      FS.busy(); cfg.tpl = null; cfg.tplFrame = u.id; keep(KS, cfg);
      var p = FS.cur(); if (p) { putDesign(p, u.id); FS.emit('doc'); }
      if (toEvent && ev) return saveEv({ design: { email: dz.email, id: dz.id, name: dz.names || dz.name || '' } });
      draw();
    }).then(function () { FS.toast('🎨 העיצוב של הלקוח נטען: כל תמונה של אורח תודפס בו', 5000); }, function (e) { FS.busy(); FS.toast('העיצוב לא נטען: ' + (e && e.message || ''), 5000); });
  }
  function approvedList() {
    FS.account.call('approved-list').then(function (r) {
      if (!r.ok) return FS.toast(err(r));
      var list = r.designs || [];
      var body = FS.dialog('🎨 עיצובים שלקוחות אישרו (' + list.length + ')', list.length ? '<p class="hint">לקוחות מעצבים באתר (עיצוב המסגרת שלכם) ולוחצים "אישור ושליחה". העיצוב מגיע לכאן בגודל הדפסה.</p><div class="lv-grid">' + list.map(function (d, i) {
        return '<figure data-i="' + i + '"><img alt="" src="' + esc(d.thumb || '') + '"><figcaption><b>' + esc(d.names || d.name || '') + '</b><small>' + esc(d.email) + (d.phone ? ' · ' + esc(d.phone) : '') + '</small>' +
          (d.eventDate ? '<small>📅 ' + esc(heDate(d.eventDate)) + '</small>' : '') + (d.note ? '<small>💬 ' + esc(d.note) + '</small>' : '') + '<small>אושר ' + esc(new Date(d.at).toLocaleDateString('he-IL')) + '</small>' +
          (ev ? '<button class="btn small primary" data-act="event">🎯 המגנט של "' + esc(ev.title.slice(0, 18)) + '"</button>' : '') +
          '<button class="btn small" data-act="photo">🖼️ על התמונה שעל המסך</button><button class="btn small" data-act="png">⬇️ PNG להדפסה</button>' +
          '<a class="btn small" target="_blank" rel="noopener" href="design.html?owner&open=' + encodeURIComponent(d.email + ':' + d.id) + '">✏️ פתיחה בעורך</a><button class="btn small danger" data-act="del">🗑</button></figcaption></figure>';
      }).join('') + '</div>' : '<p class="hint">עוד אין עיצובים מאושרים. שולחים ללקוחות את הקישור לעיצוב: <span dir="ltr">' + esc(siteBase + 'design.html') + '</span></p>', true);
      $$('figure', body).forEach(function (f) {
        var d = list[Number(f.dataset.i)];
        $$('[data-act]', f).forEach(function (b) { b.addEventListener('click', function () {
          var act = b.dataset.act;
          if (act === 'event') { FS.closeDialog(); useDesign(d, true); }
          else if (act === 'photo') { if (!FS.cur()) return FS.toast('פותחים קודם תמונה'); FS.closeDialog(); FS.busy('טוען…'); dzFrame(d).then(function (u) { FS.busy(); putDesign(FS.cur(), u.id); FS.emit('doc'); FS.toast('🖼️ העיצוב של הלקוח על התמונה'); }, function () { FS.busy(); }); }
          else if (act === 'png') FS.account.call('approved-frame', { email: d.email, id: d.id }).then(function (x) { if (!x.ok) return FS.toast(err(x)); var a = document.createElement('a'); a.href = 'data:image/png;base64,' + x.frame; a.download = 'מסגרת-' + (d.names || d.id).replace(/[\\/:*?"<>|]/g, '') + '.png'; a.click(); });
          else if (act === 'del' && confirm('להסיר את העיצוב של ' + d.email + ' מהרשימה? (אצל הלקוח הוא נשאר)')) FS.account.call('approved-del', { email: d.email, id: d.id }).then(approvedList);
        }); });
      });
    });
  }

  /* ---------- the sign for the tables ---------- */
  /* the main QR card: what it leads to now, and pointing it at the event on screen */
  function mainCard() {
    if (!main) return '';
    var to = events.filter(function (e) { return e.id === main.e; })[0];
    return '<div class="card lv-main lv-owner"><h3>🔁 קוד QR ראשי <small>שלט אחד לכל האירועים: מדפיסים פעם אחת, והוא מוביל לאירוע שבוחרים כאן</small></h3>' +
      '<p class="lv-meta">' + (to ? 'מוביל עכשיו אל: <b>' + esc(to.title) + '</b> · ' + esc(heDate(to.date)) : '<b class="no">עוד לא מוביל לאף אירוע</b>') + '</p>' +
      '<div class="lv-links">' + (ev && (!to || to.id !== ev.id) ? '<button class="btn primary" id="lv-main-set">⭐ להפנות את הקוד הראשי ל"' + esc(ev.title) + '"</button>' : '') +
      '<button class="btn" id="lv-main-sign">🖨️ שלט עם הקוד הראשי</button><button class="btn" id="lv-main-copy">🔗 העתקת הקישור</button></div></div>';
  }
  function sign(isMain) {
    var url = isMain === true ? mainUrl() : guestUrl(); if (!url) return;
    var title = isMain === true ? ((FS.BIZ && FS.BIZ.name) || 'פריים מגנטים') : ev.title;
    FS.busy('מכין שלט…');
    FS.qrCanvas(url, 900).then(function (c) {
      FS.busy(); var B = FS.BIZ || {}, img = c.toDataURL();
      var one = '<div class="lv-sign"><p class="ls-ev">' + esc(title) + '</p><h1>צלמו אותנו 📸<br>והתמונה תודפס כמגנט!</h1><img src="' + img + '" alt=""><ol><li>סורקים את הקוד במצלמה של הטלפון</li><li>מצלמים או בוחרים תמונה, ואפשר להוסיף ברכה</li><li>אוספים את המגנט בעמדה 🧲</li></ol><p class="ls-biz"><b>' + esc(B.name || '') + '</b>' + (B.phone ? ' · ' + esc(B.phone) : '') + '</p></div>';
      var body = FS.dialog(isMain === true ? '🖨️ שלט עם הקוד הראשי' : '🖨️ שלט QR לשולחנות', '<div class="qr-box"><img src="' + img + '" alt="QR"><div><p><b>' + esc(title) + '</b><br><small dir="ltr">' + esc(url) + '</small></p>' +
        '<p class="hint">מדפיסים ומניחים על השולחנות. 2 שלטים בעמוד A4.</p><div class="inline"><button class="btn primary" id="ls-print">🖨️ הדפסה</button><button class="btn" id="ls-copy">🔗 העתקת הקישור</button></div></div></div>');
      $('#ls-print', body).addEventListener('click', function () { FS.printDoc('<div class="lv-signs">' + one + one + '</div>'); });
      $('#ls-copy', body).addEventListener('click', function () { copy(url, '🔗 הקישור הועתק'); });
    }, function () { FS.busy(); FS.toast('מחולל ה־QR לא נטען'); });
  }

  /* ---------- the station ---------- */
  function status(t) { var el = $('#lv-status', pane); if (el) el.textContent = t; }
  function stats() {
    [['#lv-w', run.waiting], ['#lv-g', run.got], ['#lv-q', run.queue.length], ['#lv-p', run.printed]].forEach(function (x) { var el = $(x[0], pane); if (el) el.textContent = x[1]; });
    var b = $('#lv-print-now', pane); if (b) b.disabled = !run.queue.length;
    var st = $('#lv-st', pane); if (st) st.innerHTML = stationsHtml();
    var dot = $('.lv-dot', tab); if (dot) dot.hidden = !run.on;
  }
  function start() {
    if (!ev) return; if (!ev.open) FS.toast('שימו לב: האירוע סגור להעלאות של אורחים', 4000);
    if (ev.design && isAdmin() && !cfg.tpl) dzFrame(ev.design).then(function (u) { cfg.tplFrame = u.id; keep(KS, cfg); }).catch(function () { FS.toast('העיצוב של הלקוח לא נטען. התמונות ייכנסו בלעדיו.', 5000); });
    run.on = true; document.body.classList.add('live'); draw(); tick(); run.timer = setInterval(tick, 4000);
  }
  function stop() { run.on = false; clearInterval(run.timer); document.body.classList.remove('live'); draw(); stats(); }
  function tick() {
    if (!run.on || run.busy || !ev) return; run.busy = true;
    api('claim', { e: ev.id, station: cfg.station, max: 3 }).then(function (r) {
      if (!r.ok) { status('⚠️ ' + err(r) + '. מנסה שוב…'); return; }
      run.waiting = r.waiting; run.stations = r.stations || {}; ev.n = r.n || ev.n; ev.stations = r.stations;
      status(r.photos.length ? '📥 התקבלו ' + r.photos.length + ' תמונות' : '🔴 העמדה פעילה · ממתינה לתמונות');
      return r.photos.reduce(function (ch, ph) { return ch.then(function () { return take(ph); }); }, Promise.resolve());
    }).then(function () { run.busy = false; stats(); maybePrint(); }, function () { run.busy = false; });
  }
  function take(ph) {
    var bin = atob(ph.img), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var file = new File([u8], (ph.name ? 'אורח - ' + ph.name : 'אורח') + '.jpg', { type: 'image/jpeg' });
    return FS.addPhotoFile(file).then(function (p) {
      p.liveId = ph.id; p.liveEv = ev.id; p.liveName = ph.name; p.liveText = ph.text; p.copies = ev.copies || 1;
      if (cfg.tpl) {
        try { var d = JSON.parse(JSON.stringify(cfg.tpl)); p.doc = d; FS.fitPhoto(p.doc, FS.img(p.src)); FS.snap(p); } catch (e) { /* keeps its own design */ }
      } else if (cfg.tplFrame && FS.USER_FRAMES && FS.USER_FRAMES[cfg.tplFrame]) putDesign(p, cfg.tplFrame);
      if (cfg.wish && (ph.text || '').trim()) addWish(p, ph.text, ph.name);
      return (cfg.albumQr ? FS.albumTag(p, ev) : Promise.resolve()).then(function () { return cfg.magic !== false ? FS.magicTag(p, ev) : null; }).catch(function () { /* printed without the QR */ }).then(function () { return p; });
    }).then(function (p) {
      run.got++; run.queue.push(p);
      if (FS.faceIndex) FS.faceIndex(p, ev);   /* "find me": this photo's faces, in the background */
      FS.buildStrip(); FS.select(S.photos.indexOf(p));
      FS.toast('📸 תמונה חדשה' + (ph.name ? ' מ' + ph.name : '') + (ph.text ? ' · 💌 עם ברכה' : ''), 3000);
    }).catch(function () { api('mark', { e: ev.id, ids: [ph.id], st: 'new' }); });
  }
  /* ✨ the living magnet: a small QR with the magnet's own code. At home the guest scans it and the magnet wakes up (m.html):
     the person comes out of it in 3D, with their greeting, and a time capsule for the couple. The code goes up with the magnet. */
  function newCode() { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]; }).join(''); }
  /* where a small QR goes on a page: the bottom left corner (or the right one), in the margin under or beside the photo's
     window when the frame leaves one, else just inside the photo's corner. At least 14 mm wide, so a phone reads it. */
  function qrSpot(d, right) {
    var H = FS.hole(d), side = Math.min(d.w, d.h), mm = FS.mmOf ? FS.mmOf(d) : [d.w / 300 * 25.4], pxmm = d.w / (mm[0] || 1);
    var q = Math.max(side * 0.15, 14 * pxmm), gap = side * 0.012, below = d.h - (H.y + H.h), left = right ? d.w - (H.x + H.w) : H.x, x, y, sz;
    if (below >= q * 0.9) { sz = Math.min(q, below - gap * 2); x = gap + sz / 2 + Math.max(0, left - sz) / 2; y = H.y + H.h + below / 2; }
    else if (left >= q * 0.9) { sz = Math.min(q, left - gap * 2); x = left / 2; y = d.h - gap - sz / 2; }
    else { sz = q * 0.9; x = (right ? d.w - (H.x + H.w) : H.x) + gap + sz / 2; y = H.y + H.h - gap - sz / 2; }
    return { x: right ? d.w - x : x, y: y, sz: sz };
  }
  /* 🔗 the event's photos: a QR on the photo, bottom left, that opens the event's album (every photo of the event).
     A photo that carries it goes up to the album when it is printed, so the code always finds it. */
  var albumQrCache = {};
  FS.albumTag = function (p, e) {
    e = e || ev; if (!p || !e || !e.v) return Promise.resolve();
    var d = p.doc, url = siteBase + 'album.html?e=' + e.id + '&v=' + e.v;
    d.layers = (d.layers || []).filter(function (L) { return !L.albumQr; });
    var mk = albumQrCache[url] || (albumQrCache[url] = FS.qrCanvas(url, 700).then(function (qc) { return { src: qc.toDataURL('image/png'), w: qc.width }; }));
    return mk.then(function (q) {
      return FS.loadImg(q.src).then(function () {
        var sp = qrSpot(d, false);
        d.layers.push({ id: FS.uid(), type: 'image', src: q.src, s: sp.sz / q.w, x: sp.x, y: sp.y, r: 0, albumQr: true });
        p.albumEv = e.id;
        /* a living magnet's own QR moves to the bottom right */
        d.layers.forEach(function (L) { if (L.magicQr) { var r = qrSpot(d, true); L.x = r.x; L.y = r.y; } });
        p.cache = {}; if (FS.snap) FS.snap(p); if (FS.render) FS.render();
      });
    });
  };
  FS.albumUntag = function (p) { if (!p) return; p.doc.layers = (p.doc.layers || []).filter(function (L) { return !L.albumQr; }); delete p.albumEv; p.cache = {}; if (FS.snap) FS.snap(p); };
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (cfg.albumQr && ev && !p.craft) FS.albumTag(p, ev).catch(function () { /* without the QR */ }); });
  FS.magicTag = function (p, e) {
    e = e || ev; if (!p || !e) return Promise.resolve();
    var d = p.doc; d.layers = (d.layers || []).filter(function (L) { return !L.magicQr; });
    p.magicCode = newCode(); p.magicEv = e.id;
    return FS.qrCanvas(siteBase + 'm.html?e=' + e.id + '&c=' + p.magicCode, 700).then(function (qc) {
      var src = qc.toDataURL('image/png');
      return FS.loadImg(src).then(function () {
        /* bottom left, or bottom right when the album's QR already sits on the left */
        var sp = qrSpot(d, (d.layers || []).some(function (L) { return L.albumQr; }));
        d.layers.push({ id: FS.uid(), type: 'image', src: src, s: sp.sz / qc.width, x: sp.x, y: sp.y, r: 0, magicQr: true });
        if (FS.render) FS.render();
      });
    });
  };
  /* the guest's written greeting on the magnet, in a hand-written font */
  function addWish(p, text, name) {
    var d = p.doc, H = FS.hole(d), words = String(text).trim().split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > 26 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur); lines = lines.slice(0, 3); if (name) lines.push('— ' + String(name).slice(0, 24));
    var size = Math.min(d.w, d.h) * 0.06;
    d.layers = (d.layers || []).filter(function (L) { return !L.wishLayer; });
    d.layers.push({ id: FS.uid(), type: 'text', text: lines.join('\n'), font: 'Amatic SC', weight: 700, size: size, color: '#ffffff', shadow: true, align: 'center', x: H.x + H.w / 2, y: H.y + H.h - size * (lines.length * 0.62 + 0.5), r: 0, wishLayer: true });
  }
  /* the magnet's person, on the page: white where the person is, black elsewhere and under the frame (for the living magnet) */
  function pageMask(p, k, w, h) {
    return FS.ensureMask(p).then(function (mask) {
      if (!mask || (p.maskCover || 0) < 0.02) return null;
      var d = p.doc, im = FS.img(p.src), m = FS.photoMatrix(d, im), mc = FS.canvas(w, h), x = mc.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      x.save(); x.scale(k, k); var fo = d.frame && FS.frameOf(d.frame, d); if (fo && fo.clip) { fo.clip(x, FS.hole(d)); x.clip(); }
      x.translate(m.x, m.y); x.rotate(m.r); x.scale(m.s * m.fh, m.s * m.fv); x.drawImage(mask, -m.iw / 2, -m.ih / 2, m.iw, m.ih); x.restore();
      var over = FS.canvas(w, h), ox = over.getContext('2d'); FS.draw(ox, p, { scale: k, transparent: true, noPhoto: true, export: true });
      ox.globalCompositeOperation = 'source-in'; ox.fillStyle = '#000'; ox.fillRect(0, 0, w, h); x.drawImage(over, 0, 0);
      return mc.toDataURL('image/jpeg', 0.8).split(',')[1];
    }).catch(function () { return null; });
  }
  /* 🔍 "find me": the faces in each photo of the event, as short signatures (FaceSig), for the album's search by selfie */
  FS.faceIndex = function (p, e, id) {
    var im = FS.img(p.origSrc || p.src); id = id || p.liveId; if (!im || !id || !e || !window.FaceSig) return Promise.resolve();
    return FaceSig.describe(im).then(function (f) { return api('faces', { e: e.id, items: [{ p: id, f: f }] }); }).catch(function () { /* no faces read: the search skips it */ });
  };
  FS.faceIndexEvent = function (e, url) {
    if (!window.FaceSig) return;
    FS.busy('מכין את "מצא אותי"…');
    api('ev-get', { e: e.id }).then(function (r) {
      if (!r.ok) { FS.busy(); return FS.toast(err(r)); }
      var done = {}; (r.faced || []).forEach(function (x) { done[x] = 1; });
      var todo = (r.photos || []).filter(function (m) { return !done[m.id] && m.st !== 'hidden'; }), n = 0, batch = [];
      if (!todo.length) { FS.busy(); return FS.toast('✔ כל התמונות כבר מוכנות לחיפוש (' + (r.faced || []).length + ').', 5000); }
      function send() { if (!batch.length) return Promise.resolve(); var b = batch; batch = []; return api('faces', { e: e.id, items: b }).then(function (x) { if (x && x.ok) { ev.n = ev.n || {}; ev.n.faces = x.n; } }); }
      return todo.reduce(function (ch, m) {
        return ch.then(function () { return url(m.id); }).then(function (u) {
          return new Promise(function (ok) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = u; });
        }).then(function (i) {
          n++; FS.busy('מצא אותי: ' + n + ' / ' + todo.length);
          return i ? FaceSig.describe(i).then(function (f) { batch.push({ p: m.id, f: f }); }, function () {}) : null;
        }).then(function () { return batch.length >= 10 ? send() : null; });
      }, Promise.resolve()).then(send).then(function () { FS.busy(); draw(); FS.toast('🔍 "מצא אותי" מוכן: ' + ((ev.n && ev.n.faces) || 0) + ' תמונות עם פנים. באלבום האורחים מצלמים סלפי ומקבלים את התמונות שלהם.', 7000); });
    }).catch(function () { FS.busy(); });
  };
  function maybePrint() {
    if (!run.on || !cfg.auto || !run.queue.length) return;
    var need = cfg.per === 'one' ? 1 : cfg.per === 'fill' ? 4 : Number(cfg.per);
    if (run.queue.length >= need) printQueue();
  }
  function printQueue(all) {
    if (!run.queue.length) return;
    var need = cfg.per === 'one' ? 1 : cfg.per === 'fill' ? run.queue.length : Number(cfg.per);
    var list = run.queue.splice(0, all ? run.queue.length : need); stats();
    FS.printNow({ list: list, paper: $('#paper') ? $('#paper').value : 'A4', layout: cfg.per, margin: 3, marks: cfg.per !== 'one', copies: 1 });
  }
  /* whatever is printed while the station runs: the guests' photos are marked on the server, the numbers go to the report,
     and the magnets go into the couple's digital album */
  FS.on('print-job', function (plan) {
    if (!ev) return;
    var seen = {}, uniq = [];
    (plan.pages || []).forEach(function (pg) { pg.forEach(function (it) { if (it.p && !seen[it.p.id]) { seen[it.p.id] = 1; uniq.push(it.p); } }); });
    if (!run.on) uniq = uniq.filter(function (p) { return (p.magicCode && p.magicEv === ev.id) || p.albumEv === ev.id; });   /* the station is off: only photos whose QR must find them go up */   /* the station is off: only the living magnets go up (their QR must work) */
    if (!uniq.length) return;
    if (run.on) {
      var ids = uniq.filter(function (p) { return p.liveId && p.liveEv === ev.id; }).map(function (p) { return p.liveId; });
      run.printed += plan.total || 0; stats();
      if (ids.length) api('mark', { e: ev.id, ids: ids, st: 'printed' });
      api('stat', { e: ev.id, station: cfg.station, prints: plan.total || 0 });
    }
    /* the magnets go up to the couple's album; a living magnet goes up anyway (its QR must find it), with its person mask */
    uniq.filter(function (p) { return !p.albumUp && (ev.album !== false || (p.magicCode && p.magicEv === ev.id) || p.albumEv === ev.id); }).reduce(function (ch, p) {
      return ch.then(function () {
        p.albumUp = true;
        var k = Math.min(1, 1600 / Math.max(p.doc.w, p.doc.h)), c = FS.renderFull(p, k, false), magic = p.magicCode && p.magicEv === ev.id;
        return (magic ? pageMask(p, k, c.width, c.height) : Promise.resolve(null)).then(function (mask) {
          var body = { e: ev.id, station: cfg.station, name: p.liveName || '', img: c.toDataURL('image/jpeg', 0.88).split(',')[1] };
          if (magic) { body.code = p.magicCode; if (mask) body.mask = mask; if (p.liveId) body.from = p.liveId; }
          return api('studio-up', body).then(function (r) { if (r && r.ok && r.id && FS.faceIndex) FS.faceIndex(p, ev, r.id); });
        });
      }).catch(function () { p.albumUp = false; });
    }, Promise.resolve());
  });

  /* ---------- the photos of the event (hide one from the screen and the album) ---------- */
  function managePhotos() {
    api('ev-get', { e: ev.id }).then(function (r) {
      if (!r.ok) return FS.toast(err(r));
      var list = r.photos.slice().reverse();
      var body = FS.dialog('🗂️ התמונות של האירוע (' + list.length + ')', list.length ? '<p class="hint">תמונה מוסתרת לא מופיעה במסך הענק ובאלבום. "להדפסה שוב" מחזיר אותה לתור.</p><div class="lv-grid">' + list.map(function (p) {
        return '<figure data-id="' + p.id + '" class="' + (p.st === 'hidden' ? 'off' : '') + '"><img alt="" loading="lazy"><figcaption>' + (p.src === 'studio' ? '🧲 מגנט' : '🤳 ' + esc(p.name || 'אורח')) + (p.text ? '<br><small>' + esc(p.text) + '</small>' : '') + (p.audio ? ' 🎙️' : '') +
          '<span>' + ({ new: 'בתור', claimed: 'בעמדה ' + esc(p.station), printed: 'הודפס', hidden: 'מוסתר' })[p.st] + '</span>' +
          '<button class="btn small" data-st="' + (p.st === 'hidden' ? 'printed' : 'hidden') + '">' + (p.st === 'hidden' ? '👁 החזרה' : '🙈 הסתרה') + '</button>' + (p.src === 'guest' ? '<button class="btn small" data-st="new">🖨️ להדפסה שוב</button>' : '') + '</figcaption></figure>';
      }).join('') + '</div>' : '<p class="hint">עוד אין תמונות.</p>', true);
      $$('figure', body).forEach(function (f) {
        imgUrl(f.dataset.id).then(function (u) { $('img', f).src = u; });
        $$('[data-st]', f).forEach(function (b) { b.addEventListener('click', function () { api('mark', { e: ev.id, ids: [f.dataset.id], st: b.dataset.st }).then(function (x) { if (x.ok) managePhotos(); }); }); });
      });
      $$('figure.off img', body).forEach(function (im) { im.removeAttribute('loading'); });
    });
  }

  /* ---------- the couple: the album and a review request ---------- */
  function review(e) {
    if (!e) return;
    var B = FS.BIZ || {}, g = e.google || B.googleReviews || (FS.BIZ_SITE && FS.BIZ_SITE.googleReviews) || '', was = ev; ev = e; var url = albumUrl(); ev = was;
    var text = 'היי' + (e.couple && e.couple.name ? ' ' + e.couple.name : '') + '! 💛\nתודה שבחרתם ב' + (B.name || 'פריים מגנטים') + '.\nכל המגנטים, התמונות שהאורחים צילמו והברכות שהשאירו מחכים לכם כאן:\n' + url +
      (g ? '\n\nנהניתם? נשמח מאוד להמלצה קצרה בגוגל 🙏\n' + g : '') + '\n\nמזל טוב!';
    if (!(e.couple && e.couple.phone)) { copy(text, '📋 ההודעה הועתקה. אין טלפון באירוע, אז מדביקים אותה בוואטסאפ.'); }
    else wa(e.couple.phone, text);
    api('review-sent', { e: e.id }).then(function () { e.reviewAt = Date.now(); draw(); });
  }

  /* ---------- the monthly report ---------- */
  function monthly() {
    var by = {};
    events.forEach(function (e) {
      var m = (e.date || '').slice(0, 7); if (!m) return; var n = e.n || {}, r = by[m] = by[m] || { ev: 0, guests: 0, wishes: 0, prints: 0, income: 0, cost: 0 };
      r.ev++; r.guests += n.in || 0; r.wishes += n.wishes || 0; r.prints += n.prints || 0; r.income += e.price || 0; r.cost += (n.prints || 0) * (e.cost || 0);
    });
    var months = Object.keys(by).sort().reverse();
    var rows = months.map(function (m) { var r = by[m]; return [m, r.ev, r.guests, r.wishes, r.prints, Math.round(r.income), Math.round(r.cost), Math.round(r.income - r.cost)]; });
    var body = FS.dialog('📅 דוח חודשי של האירועים החיים', rows.length ? '<table class="lv-table"><thead><tr><th>חודש</th><th>אירועים</th><th>תמונות מאורחים</th><th>ברכות</th><th>מגנטים</th><th>הכנסה</th><th>עלות</th><th>רווח</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td>' + money(r[5]) + '</td><td>' + money(r[6]) + '</td><td><b>' + money(r[7]) + '</b></td></tr>'; }).join('') +
      '</tbody></table><div class="inline"><button class="btn" id="lv-csv">⬇️ CSV לאקסל</button></div><p class="hint">ההכנסה היא מחיר האירוע שהוזן, והעלות היא מספר המגנטים כפול העלות ליחידה.</p>' : '<p class="hint">עוד אין אירועים.</p>', true);
    var b = $('#lv-csv', body); if (b) b.addEventListener('click', function () {
      var csv = '﻿' + [['חודש', 'אירועים', 'תמונות מאורחים', 'ברכות', 'מגנטים', 'הכנסה', 'עלות', 'רווח']].concat(rows).map(function (r) { return r.join(','); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'דוח אירועים חיים.csv'; a.click();
    });
  }

  /* ---------- staff mode: a worker at the event sees only the photos, the frames, printing and the station ---------- */
  function hash(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode('fs-staff:' + s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  function staffApply(onOff) {
    document.body.classList.toggle('staff-mode', onOff);
    var bar = $('#staff-bar');
    if (onOff && !bar) {
      bar = document.createElement('div'); bar.id = 'staff-bar'; bar.innerHTML = '👷 מצב עובד <button class="btn small" id="staff-out">🔒 יציאה</button>';
      document.body.appendChild(bar);
      $('#staff-out', bar).addEventListener('click', staffOff);
      var t = (FS.prefs && FS.prefs.tab) || ''; if (!/^(photos|frames|output|live|adjust)$/.test(t)) FS.openTab('live');
    } else if (!onOff && bar) bar.remove();
  }
  function staffOn() {
    var body = FS.dialog('👷 מצב עובד', '<p class="hint">העובד יראה רק תמונות, מסגרות, הדפסה ואת העמדה של האירוע החי. בלי מחירים, עסקאות, דוחות והגדרות. יציאה רק עם הקוד שתבחרו.</p>' +
      '<div class="row2"><div class="field"><label>קוד (4 ספרות או יותר)</label><input id="sp1" type="password" inputmode="numeric" maxlength="12"></div><div class="field"><label>שוב</label><input id="sp2" type="password" inputmode="numeric" maxlength="12"></div></div>' +
      '<button class="btn primary" id="sp-go">👷 מעבר למצב עובד</button>');
    $('#sp-go', body).addEventListener('click', function () {
      var a = $('#sp1', body).value, b2 = $('#sp2', body).value;
      if (!/^\d{4,12}$/.test(a)) return FS.toast('קוד של 4 ספרות לפחות'); if (a !== b2) return FS.toast('שני הקודים לא זהים');
      hash(a).then(function (h) { keep(KSTAFF, { on: true, pin: h }); FS.closeDialog(); staffApply(true); FS.toast('👷 מצב עובד פעיל', 3000); });
    });
  }
  function staffOff() {
    var st = load(KSTAFF, {}), body = FS.dialog('🔒 יציאה ממצב עובד', '<div class="field"><label>הקוד</label><input id="so" type="password" inputmode="numeric" maxlength="12"></div><button class="btn primary" id="so-go">יציאה</button>');
    var go = function () { hash($('#so', body).value).then(function (h) { if (h !== st.pin) return FS.toast('קוד שגוי'); keep(KSTAFF, {}); FS.closeDialog(); staffApply(false); FS.toast('חזרה למסך המלא'); }); };
    $('#so-go', body).addEventListener('click', go); $('#so', body).addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { var i = $('#so', body); if (i) i.focus(); }, 50);
  }
  /* in staff mode the other tabs are closed */
  var open2 = FS.openTab; FS.openTab = function (n) { if (document.body.classList.contains('staff-mode') && !/^(photos|frames|output|live|adjust)$/.test(n)) n = 'live'; return open2(n); };
  if (load(KSTAFF, {}).on) staffApply(true);

  draw();
  FS.liveRefresh = refresh;
  FS.liveCurrent = function () { return ev; };
  setTimeout(function () { if (token()) refresh(); }, 1200);
})();
