/* The owner's studio licences: who has אופטימוס, their personal code, which computer it is bound to, when it was last used.
   A code is issued per email and sent by email or WhatsApp; it works on one computer. The owner can free the computer (the
   person moved to a new one), issue a new code (the old one stops at once), cancel or restore, and delete. Every change goes to
   the sign-in server with the admin's session; nothing is decided in this page. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, LIC = FS.license, ACC = FS.account;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DL = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/download.html';
  var when = function (x) { return x ? new Date(x).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; };
  function wa(phone, text) { var d = String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); }
  function codeText(L) { return 'שלום ' + (L.name || '') + ',\nקוד ההפעלה האישי שלך לאופטימוס:\n' + L.code + '\n\nהורדה והתקנה: ' + DL + '\nבהפעלה מזינים את המייל ' + L.email + ' ואת הקוד.\nהקוד אישי ועובד במחשב אחד בלבד.'; }
  function copy(t) { return navigator.clipboard ? navigator.clipboard.writeText(t).then(function () { FS.toast('📋 הועתק'); }, function () { window.prompt('מעתיקים:', t); }) : window.prompt('מעתיקים:', t); }

  function vcmp(a, b) { var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; return 0; }
  var METHODS = ['ביט', 'פייבוקס', 'העברה בנקאית', 'מזומן', 'אשראי', 'צ׳ק', 'אחר'];
  function methodSel(id) { return '<select id="' + id + '">' + METHODS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>'; }
  var PLAN_NAMES = { full: '💎 רישיון מלא', month: '📅 חודש', year: '📆 שנה', pass: '🎟️ כרטיס אירוע' };
  /* the plan as the owner sees it: trial (events and days left), free, pass, month/year, full */
  function planCell(L) {
    var p = L.plan || {}, d = function (x) { return x ? new Date(x).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : ''; };
    var t = p.tier === 'trial' ? '<span class="lic-st wait">🎁 ניסיון</span><small>' + (p.events || 0) + '/' + (p.eventsMax || 2) + ' אירועים · עד ' + d(p.ends) + '</small>'
      : p.tier === 'pass' ? '<span class="lic-st on">🎟️ כרטיס אירוע</span><small>עד ' + when(p.until) + '</small>'
      : p.tier === 'pro' ? '<span class="lic-st on">' + (p.until ? '📅 מנוי' : '💎 מלא') + '</span>' + (p.until ? '<small>עד ' + d(p.until) + '</small>' : '')
      : p.tier === 'free' ? '<span class="lic-st off">חינמי</span><small>' + (p.was === 'trial' ? 'הניסיון הסתיים' : p.was === 'sub' ? 'המנוי הסתיים' : '') + '</small>' : '';
    return t + (L.planReq ? '<small class="lic-req">📩 ביקש ' + esc(PLAN_NAMES[L.planReq.want] || L.planReq.want) + ' · ' + when(L.planReq.at) + '</small>' : '');
  }
  /* hours of use: total, the last 7 days, and the day it was last used */
  function hrs(m) { m = Math.round(m || 0); return m < 60 ? m + ' דק׳' : (Math.round(m / 6) / 10).toLocaleString('he-IL') + ' שעות'; }
  function useCell(L) {
    var u = L.usage; if (!u || !u.min) return '<small>עוד לא נמדד</small>';
    var wk = 0, d = new Date(); for (var i = 0; i < 7; i++) { var k = new Date(d - i * 864e5).toISOString().slice(0, 10); wk += (u.days || {})[k] || 0; }
    return '<b>' + hrs(u.min) + '</b><small>השבוע ' + hrs(wk) + '</small><small>' + (u.prints || 0) + ' הדפסות · ' + (u.ai || 0) + ' AI</small>';
  }
  var nis = function (v) { return '₪' + Number(v || 0).toLocaleString('he-IL'); };
  /* how many times the installer was downloaded: GitHub counts every release asset (public, no key) */
  function downloads() {
    return fetch('https://api.github.com/repos/devopsdevopshaim-wq/devops-hub/releases?per_page=100', { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rels) {
      var n = 0, week = 0, latest = '', builds = [];
      (rels || []).filter(function (r) { return /^desktop-/.test(r.tag_name); }).forEach(function (r) {
        var m = /^desktop-v(\d+\.\d+\.\d+)$/.exec(r.tag_name); if (m) builds.push({ ver: m[1], at: r.published_at || r.created_at });
        if (r.tag_name === 'desktop-latest') latest = (r.name || '').replace(/^.*latest:\s*/, '').replace(/\)$/, '');
        (r.assets || []).forEach(function (a) { if (/\.exe$/i.test(a.name)) n += a.download_count || 0; });
      });
      builds.sort(function (a, z) { return vcmp(z.ver, a.ver); });
      return { n: n, latest: latest, builds: builds };
    }).catch(function () { return null; });
  }

  FS.adminLicenses = function (m, c) {
    c.head(m, '🔑 רישיונות סטודיו', 'מי משתמש באופטימוס: קוד הפעלה אישי לכל מייל, נעול למחשב אחד. רק אתה רואה את הקודים.');
    m.insertAdjacentHTML('beforeend',
      '<section class="adm-card lic-now" id="lic-now"><div class="adm-row"><h3 style="margin:0">📊 מצב עכשיו</h3><small id="lic-now-at" class="hint" style="margin-inline-start:auto"></small></div><div id="lic-now-body"><p class="hint">טוען…</p></div></section>' +
      '<section class="adm-card" id="lic-stats"></section>' +
      '<section class="adm-card"><h3>➕ רישיון חדש</h3><div class="adm-grid lic-new">' +
      '<label class="adm-f"><span>שם</span><div class="adm-in"><input id="ln-name" maxlength="60"></div></label>' +
      '<label class="adm-f"><span>מייל</span><div class="adm-in"><input id="ln-email" type="email" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>טלפון (לשליחה בוואטסאפ)</span><div class="adm-in"><input id="ln-phone" type="tel" dir="ltr"></div></label>' +
      '<label class="adm-f"><span>הערה (לא חובה)</span><div class="adm-in"><input id="ln-note" maxlength="200" placeholder="למשל: צלם, עובד במגנטים, לקוח"></div></label>' +
      '<label class="adm-f"><span>מחיר הרישיון (₪)</span><div class="adm-in"><input id="ln-price" inputmode="decimal" dir="ltr"></div></label></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ln-paid"> כבר שולם</label><span class="ln-pay" hidden><input id="ln-amount" inputmode="decimal" dir="ltr" placeholder="סכום" style="width:90px"> ' + methodSel('ln-method') + ' <input id="ln-ref" placeholder="אסמכתא / קבלה" style="width:140px"></span></div>' +
      '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="ln-send" checked> לשלוח את הקוד גם למייל</label><button class="btn gold" id="ln-go">🔑 הנפקת קוד</button></div>' +
      '<p class="hint">💡 התוכנה נפתחת רק אחרי שרשמת תשלום. אפשר להנפיק קוד עכשיו ולרשום את התשלום כשמתקבל.</p>' +
      '<p class="hint">הקוד נוצר אקראית בשרת ונשמר רק אצלך. בהפעלה הראשונה הוא ננעל למחשב של אותו אדם, ומחשב נוסף עם אותו קוד נחסם (ואתה מקבל התראה).</p></section>' +
      '<section class="adm-card"><h3>💰 מחיר ותנאים</h3><div class="adm-row"><label class="adm-f" style="max-width:240px"><span>מחיר ברירת מחדל לרישיון (₪)</span><div class="adm-in"><input id="ls-price" inputmode="decimal" dir="ltr"></div></label><label class="adm-f" style="max-width:150px"><span>🎟️ כרטיס אירוע</span><div class="adm-in"><input id="ls-pass" inputmode="decimal" dir="ltr"></div></label><label class="adm-f" style="max-width:150px"><span>📅 חודש</span><div class="adm-in"><input id="ls-month" inputmode="decimal" dir="ltr"></div></label><label class="adm-f" style="max-width:150px"><span>📆 שנה</span><div class="adm-in"><input id="ls-year" inputmode="decimal" dir="ltr"></div></label><button class="btn line small" id="ls-save">שמירה</button></div><div class="adm-grid"><label class="adm-f"><span>🏷️ מבצע (מופיע בדף ההורדה ובחלון השדרוג)</span><div class="adm-in"><input id="ls-promo" maxlength="400" placeholder="למשל: מחיר מייסדים: 20% הנחה ל־100 הרוכשים הראשונים"></div></label><label class="adm-f"><span>💳 תנאי תשלום</span><div class="adm-in"><input id="ls-terms" maxlength="600" placeholder="למשל: ביט, פייבוקס, העברה או אשראי עד 3 תשלומים. קבלה על כל תשלום."></div></label></div><div class="adm-row">' +
      '<a class="btn line small" href="agreement.html" target="_blank" rel="noopener">📄 הסכם הרכישה (v1)</a></div><p class="hint">🎁 כל מי שמוריד את התוכנה מקבל ניסיון חינם: הכל פתוח ל־2 אירועים או 30 יום (מה שמגיע אחרון). אחר כך היא עובדת בגרסה חינמית: פס "נערך באופטימוס" על כל הדפסה, 3 עיצובי AI ביום, בלי קולאז׳, עורך מסגרות מקצועי ו־AI מקומי. כל ניסיון חדש מגיע אליך כהתראה (ליד), ובקשות שדרוג מופיעות ברשימה עם 📩. המחירים כאן מופיעים ללקוח בחלון השדרוג. המחיר מופיע בדף ההורדה. כל רוכש מאשר את הסכם הרכישה בהפעלה, והאישור נרשם אצלך עם התאריך.</p></section>' +
      '<section class="adm-card" id="upd-card"><h3>⬆️ עדכוני גרסה לתוכנה</h3><p class="hint">כל גרסה חדשה של התוכנה נבנית לבד, אבל לקוחות לא מקבלים אותה עד שאתה מפרסם אותה כאן. עדכון שפורסם בתשלום נפתח ללקוח רק אחרי שאישרת אותו (עם התשלום). גרסה שהותקנה בלי אישור ננעלת, ומציעה ללקוח לחזור לגרסה המאושרת שלו. עדכון בחינם נפתח לכולם.</p><div id="upd-body"><p class="hint">טוען…</p></div></section>' +
      '<section class="adm-card"><h3>📝 נרשמים להורדה ולניסיון</h3><p class="hint">כל מי שנרשם בדף ההורדה או בתוכנה: שם מלא, טלפון ומייל. "✔ אומת" = הזין את הקוד שהגיע למייל. מי שלא קיבל מייל: הקוד שלו מופיע כאן (30 דקות), ושולחים לו בוואטסאפ בלחיצה.</p><div id="lead-list"><p class="hint">טוען…</p></div></section>' +
      '<section class="adm-card"><div class="adm-row"><h3 style="margin:0">רשימת הרישיונות</h3><input id="lic-q" placeholder="חיפוש שם / מייל / טלפון" style="margin-inline-start:auto"></div><div id="lic-list"><p class="hint">טוען…</p></div></section>');
    var ALL = [], q = '';
    var SET = { price: 990 }, DLS = null, PRICE = { full: 990, month: 89, year: 790, pass: 79 };
    function prices() { PRICE = { full: SET.price || 990, month: SET.monthPrice || 89, year: SET.yearPrice || 790, pass: SET.passPrice || 79 }; $('#ls-price').value = PRICE.full; $('#ls-pass').value = PRICE.pass; $('#ls-month').value = PRICE.month; $('#ls-year').value = PRICE.year; $('#ls-promo').value = SET.promo || ''; $('#ls-terms').value = SET.terms || ''; }
    function stats() {
      var wk = Date.now() - 7 * 864e5;
      var n = ALL.length, paid = ALL.filter(function (l) { return l.paid; }).length, bound = ALL.filter(function (l) { return l.bound; }).length, on = ALL.filter(function (l) { return Date.parse(l.lastSeen || 0) > wk; }).length;
      var rev = 0, mon = 0, ym = new Date().toISOString().slice(0, 7);
      ALL.forEach(function (l) { (l.payments || []).forEach(function (p) { rev += p.amount || 0; if (String(p.date || '').slice(0, 7) === ym) mon += p.amount || 0; }); });
      var open = ALL.filter(function (l) { return !l.paid && l.active && !l.trial; }).reduce(function (t, l) { return t + (l.price || 0); }, 0);
      $('#lic-stats').innerHTML = '<div class="vis-stats">' +
        '<div><b>' + (DLS ? DLS.n : '…') + '</b><span>הורדות של התוכנה' + (DLS && DLS.latest ? ' (גרסה ' + esc(DLS.latest) + ')' : '') + '</span></div>' +
        '<div><b>' + ALL.filter(function (l) { return l.plan && l.plan.tier === 'trial'; }).length + '</b><span>🎁 בניסיון חינם</span></div><div><b>' + ALL.filter(function (l) { return l.planReq; }).length + '</b><span>📩 בקשות שדרוג</span></div>' +
        '<div><b>' + n + '</b><span>רישיונות שהונפקו</span></div><div><b>' + paid + '</b><span>שולמו</span></div><div><b>' + bound + '</b><span>מותקנים במחשב</span></div><div><b>' + on + '</b><span>השתמשו השבוע</span></div>' +
        '<div><b>' + nis(rev) + '</b><span>הכנסות מהתוכנה</span></div><div><b>' + nis(mon) + '</b><span>החודש</span></div><div><b>' + nis(open) + '</b><span>ממתין לתשלום</span></div></div>' +
        '<div class="adm-row"><a class="btn line small" href="download.html" target="_blank" rel="noopener">⬇ דף ההורדה</a><button class="btn line small" id="lic-dl-copy">📋 העתקת קישור ההורדה</button></div>';
      $('#lic-dl-copy').addEventListener('click', function () { copy(DL); });
    }
    function row(L) {
      var st = !L.active ? '<span class="lic-st off">⛔ מבוטל</span>' : L.bound ? '<span class="lic-st on">✔ מותקן</span>' : '<span class="lic-st wait">⏳ ממתין להפעלה</span>';
      return '<tr data-e="' + esc(L.email) + '"><td><b>' + esc(L.name) + '</b><small dir="ltr">' + esc(L.email) + '</small><small>' + esc(L.phone) + '</small>' + (L.note ? '<small class="lic-note">' + esc(L.note) + '</small>' : '') + '</td>' +
        '<td><code class="lic-code">' + esc(L.code) + '</code></td>' +
        '<td>' + planCell(L) + (L.paid ? '<span class="lic-st on">✔ שולם</span><small>' + nis((L.payments || []).reduce(function (t, p) { return t + (p.amount || 0); }, 0)) + ((L.payments || [])[0] ? ' · ' + esc(L.payments[L.payments.length - 1].method || '') : '') + '</small>' : L.trial ? '' : '<span class="lic-st wait">⏳ לא שולם</span><small>מחיר ' + nis(L.price) + '</small>') +
          (L.agreement ? '<small>📄 הסכם ' + esc(L.agreement.ver) + ' אושר ' + when(L.agreement.at) + '</small>' : '') + '</td>' +
        '<td>' + useCell(L) + '</td>' +
        '<td>' + st + (L.session ? '<small><span class="dot on"></span>מחובר</small>' : '') + '</td>' +
        '<td>' + (L.bound ? '<small>' + (L.desktop ? '💻 תוכנה' : '🌐 דפדפן') + (L.platform ? ' · ' + esc(L.platform) : '') + '</small><small>מאז ' + when(L.boundAt) + '</small>' : '—') + (L.appVer ? '<small>⬆️ מאושר עד <span dir="ltr">' + esc(L.appVer) + '</span>' + (L.version && L.version !== L.appVer ? ' · מותקן <span dir="ltr">' + esc(L.version) + '</span>' : '') + '</small>' : '') + (L.updReq ? '<small class="lic-st wait">📨 ביקש עדכון ' + esc(L.updReq.ver) + '</small>' : '') + '</td>' +
        '<td>' + when(L.lastSeen) + (L.lastIp ? '<small dir="ltr">' + esc(L.lastIp) + '</small>' : '') + '</td>' +
        '<td class="act lic-act">' +
          '<button data-a="pay" title="רישום תשלום">💰</button><button data-a="upd" title="אישור עדכון גרסה">⬆️</button><button data-a="copy" title="העתקת הקוד וההוראות">📋</button>' +
          (L.phone ? '<a target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '" title="שליחה בוואטסאפ">💬</a>' : '') +
          '<button data-a="mail" title="שליחה למייל">✉️</button>' +
          (L.bound ? '<button data-a="release" title="שחרור המחשב (מעבר למחשב חדש)">🔓</button>' : '') +
          '<button data-a="rotate" title="קוד חדש (הישן מפסיק לעבוד)">♻️</button>' +
          '<button data-a="toggle" title="' + (L.active ? 'ביטול הרישיון' : 'הפעלה מחדש') + '">' + (L.active ? '⛔' : '✅') + '</button>' +
          '<button data-a="history" title="היסטוריה">🕘</button><button data-a="delete" title="מחיקה">🗑</button></td></tr>' +
        '<tr class="lic-pay" data-p="' + esc(L.email) + '" hidden><td colspan="8"><div class="adm-row"><b>💰 רישום תשלום:</b><select class="lp-plan">' + ['full', 'month', 'year', 'pass'].map(function (k) { return '<option value="' + k + '"' + (L.planReq && L.planReq.want === k ? ' selected' : '') + '>' + PLAN_NAMES[k] + '</option>'; }).join('') + '</select><input class="lp-amount" inputmode="decimal" dir="ltr" placeholder="סכום" value="' + (L.planReq ? (PRICE[L.planReq.want] || '') : L.paid ? '' : (L.price || '')) + '" style="width:90px"><input class="lp-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '">' + '<select class="lp-method">' + METHODS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><input class="lp-ref" placeholder="אסמכתא / קבלה" style="width:140px"><button class="btn gold small lp-go">שמירה</button></div>' + ((L.payments || []).length ? '<ul class="lic-pays">' + L.payments.map(function (p) { return '<li>' + esc(p.date) + ' · ' + nis(p.amount) + ' · ' + esc(p.method || '') + (p.ref ? ' · ' + esc(p.ref) : '') + ' <button class="link lp-undo" data-at="' + esc(p.at) + '">מחיקה</button></li>'; }).join('') + '</ul>' : '') + '</td></tr>' +
        '<tr class="lic-hist" data-h="' + esc(L.email) + '" hidden><td colspan="8"><ul>' + (L.history || []).map(function (h) { return '<li>' + when(h.at) + ' · ' + esc(h.what) + (h.ip ? ' · <span dir="ltr">' + esc(h.ip) + '</span>' : '') + (h.ua ? ' · <small>' + esc(h.ua) + '</small>' : '') + '</li>'; }).join('') + '</ul></td></tr>';
    }
    function draw() {
      stats();
      var l = ALL.filter(function (L) { return !q || (L.name + ' ' + L.email + ' ' + L.phone + ' ' + L.note).toLowerCase().indexOf(q.toLowerCase()) > -1; });
      $('#lic-list').innerHTML = l.length ? '<div class="vis-scroll"><table class="adm-tbl lic-tbl"><thead><tr><th>מי</th><th>קוד</th><th>תשלום</th><th>⏱️ שימוש</th><th>מצב</th><th>מחשב</th><th>שימוש אחרון</th><th></th></tr></thead><tbody>' + l.map(row).join('') + '</tbody></table></div>'
        : '<p class="hint">' + (q ? 'לא נמצא.' : 'עוד אין רישיונות. מנפיקים את הראשון למעלה.') + '</p>';
      $$('#lic-list tr[data-e]').forEach(function (tr) {
        var L = ALL.filter(function (x) { return x.email === tr.dataset.e; })[0];
        $$('[data-a]', tr).forEach(function (b) { b.addEventListener('click', function () { act(b.dataset.a, L); }); });
      });
      $$('#lic-list tr[data-p]').forEach(function (tr) {
        var email = tr.dataset.p;
        $('.lp-go', tr).addEventListener('click', function () {
          var amt = $('.lp-amount', tr).value.trim(); if (!(Number(amt) > 0)) return FS.toast('סכום התשלום.');
          var plan = $('.lp-plan', tr).value;
          LIC.admin('lic-pay', { email: email, plan: plan, amount: amt, date: $('.lp-date', tr).value, method: $('.lp-method', tr).value, ref: $('.lp-ref', tr).value.trim() }).then(function (r) { done(r, '💰 התשלום נרשם (' + PLAN_NAMES[plan] + '). אצל הלקוח הכל נפתח בחיבור הבא לאינטרנט.'); });
        });
        $('.lp-plan', tr).addEventListener('change', function () { $('.lp-amount', tr).value = PRICE[this.value] || ''; });
        $$('.lp-undo', tr).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('למחוק את התשלום הזה? אם לא נשאר תשלום, התוכנה תיחסם אצל הלקוח.')) return; LIC.admin('lic-pay', { email: email, undo: '1', at: b.dataset.at }).then(function (r) { done(r, 'התשלום נמחק.'); }); }); });
      });
    }
    var LEADS = [];
    function leadsDraw() {
      var box = $('#lead-list'); if (!box) return;
      if (!LEADS.length) { box.innerHTML = '<p class="hint">עוד אין נרשמים.</p>'; return; }
      var ver = LEADS.filter(function (x) { return x.verified; }).length;
      box.innerHTML = '<p class="hint">' + LEADS.length + ' נרשמו · ' + ver + ' אומתו · ' + LEADS.filter(function (x) { return x.app; }).length + ' התקינו ונכנסו לתוכנה</p><div class="vis-scroll"><table class="adm-tbl"><thead><tr><th>מי</th><th>טלפון</th><th>איפה</th><th>אימות</th><th>מתי</th><th></th></tr></thead><tbody>' +
        LEADS.map(function (x) {
          var waCode = x.code ? wa(x.phone, 'שלום ' + x.name + ', קוד האימות שלך לאופטימוס: ' + x.code) : '';
          return '<tr><td><b>' + esc(x.name) + '</b><small dir="ltr">' + esc(x.email) + '</small></td><td dir="ltr">' + esc(x.phone) + '</td><td>' + (x.app ? '💻 בתוכנה' : x.where === 'app' ? '💻 בתוכנה' : '⬇ דף ההורדה') + (x.downloads ? '<small>' + x.downloads + ' הורדות</small>' : '') + '</td>' +
            '<td>' + (x.verified ? '<span class="lic-st on">✔ אומת</span><small>' + when(x.verifiedAt) + '</small>' : '<span class="lic-st wait">⏳ לא אומת</span>' + (x.code ? '<small>קוד: <b dir="ltr">' + esc(x.code) + '</b></small>' : '')) + '</td>' +
            '<td>' + when(x.lastAt) + '</td><td class="act">' + (waCode ? '<a target="_blank" rel="noopener" href="' + esc(waCode) + '" title="שליחת הקוד בוואטסאפ">💬 קוד</a>' : '') +
            '<a target="_blank" rel="noopener" href="' + esc(wa(x.phone, 'שלום ' + x.name + ', כאן חיים מאופטימוס. ראיתי שנרשמת לניסיון, אשמח לעזור בהתחלה 🙂')) + '" title="וואטסאפ">💬</a><a href="tel:' + esc(x.phone) + '" title="שיחה">📞</a>' +
            '<button data-ld="' + esc(x.email) + '" title="מחיקה מהרשימה">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      Array.prototype.forEach.call(box.querySelectorAll('[data-ld]'), function (b) { b.addEventListener('click', function () { if (!confirm('למחוק את ' + b.dataset.ld + ' מרשימת הנרשמים?')) return; LIC.admin('lead-delete', { email: b.dataset.ld }).then(function (r) { if (r.ok) { LEADS = r.leads || []; leadsDraw(); } }); }); });
    }
    /* the live view: what happens now, refreshed every minute while this screen is open */
    var ACT = [];
    function nowDraw() {
      var box = $('#lic-now-body'); if (!box) return;
      var t = Date.now(), DAY = 864e5, today = new Date().toLocaleDateString('en-CA'), wk = t - 7 * DAY;
      var since = function (iso, ms) { return iso && t - Date.parse(iso) < ms; };
      var tierOf = function (L) { return (L.plan && L.plan.tier) || (L.paid ? 'pro' : 'wait'); };
      var cnt = { trial: 0, free: 0, pass: 0, pro: 0, wait: 0 }; ALL.forEach(function (L) { cnt[tierOf(L)] = (cnt[tierOf(L)] || 0) + 1; });
      var online = ALL.filter(function (L) { return L.session && since(L.lastSeen, 15 * 60000); });
      var todayMin = 0, weekMin = 0; ALL.forEach(function (L) { var d = (L.usage && L.usage.days) || {}; todayMin += d[today] || 0; Object.keys(d).forEach(function (k) { if (Date.parse(k) > wk) weekMin += d[k]; }); });
      var reg24 = LEADS.filter(function (x) { return since(x.firstAt || x.lastAt, DAY); }).length, reg7 = LEADS.filter(function (x) { return since(x.firstAt || x.lastAt, 7 * DAY); }).length;
      var ver7 = LEADS.filter(function (x) { return since(x.verifiedAt, 7 * DAY); }).length, reqs = ALL.filter(function (L) { return L.planReq; });
      var tile = function (n, label, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><b>' + n + '</b><span>' + label + '</span></div>'; };
      box.innerHTML = '<div class="vis-stats">' +
        tile(online.length, '🟢 מחוברים עכשיו', online.length ? 'on' : '') + tile(reg24 + ' / ' + reg7, '📝 נרשמו היום / השבוע') + tile(ver7, '✔ אימתו השבוע') + tile(DLS ? DLS.n : '…', '⬇ הורדות (סה״כ)') +
        tile(hrs(todayMin) + ' / ' + hrs(weekMin), '⏱️ שימוש היום / השבוע') + tile(cnt.trial, '🎁 בניסיון') + tile(cnt.free, 'חינמי') + tile((cnt.pro || 0) + (cnt.pass || 0), '💎 משלמים') +
        tile(reqs.length, '📩 בקשות שדרוג', reqs.length ? 'warn' : '') + '</div>' +
        (online.length ? '<p class="hint">🟢 ' + online.map(function (L) { return esc(L.name || L.email); }).join(' · ') + '</p>' : '') +
        (reqs.length ? '<p class="lic-req">📩 מחכים לך: ' + reqs.map(function (L) { return esc(L.name || L.email) + ' (' + esc(PLAN_NAMES[L.planReq.want] || L.planReq.want) + (L.phone ? ', <a href="tel:' + esc(L.phone) + '">' + esc(L.phone) + '</a>' : '') + ')'; }).join(' · ') + '</p>' : '') +
        '<h4>🕘 מה קרה לאחרונה</h4>' + (ACT.length ? '<ul class="lic-act-feed">' + ACT.slice(0, 25).map(function (a) { return '<li><small>' + when(a.at) + '</small> ' + esc(a.what) + (a.who ? ' · <span dir="ltr">' + esc(a.who) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="hint">עוד אין פעילות.</p>') +
        '<p class="hint">📧 כל ערב בשמונה מגיע אליך במייל סיכום היום: מי נרשם, מי עבד, בקשות ותשלומים.</p>';
      var at = $('#lic-now-at'); if (at) at.textContent = 'עודכן ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מתעדכן כל דקה';
    }
    function done(r, okMsg) { if (!r.ok) { FS.toast(ACC.msg(r), 6000); return; } ALL = r.licenses || ALL; if (r.upd) UPD = r.upd; draw(); updDraw(); if (okMsg) FS.toast(okMsg, 5000); }
    /* ---------- updates: publish a build, its price, the requests, approve after the payment ---------- */
    var UPD = { versions: [], price: 49 };
    function latestPub() { return (UPD.versions || [])[0] || null; }
    function updDraw() {
      var box = $('#upd-body'); if (!box) return;
      var pubs = UPD.versions || [], published = {}; pubs.forEach(function (v) { published[v.ver] = 1; });
      var builds = (DLS && DLS.builds || []).filter(function (b) { return !published[b.ver]; }).slice(0, 15);
      var reqs = ALL.filter(function (L) { return L.updReq; });
      box.innerHTML =
        '<div class="adm-row"><label class="adm-f" style="max-width:220px"><span>מחיר עדכון ברירת מחדל (₪)</span><div class="adm-in"><input id="up-price" inputmode="decimal" dir="ltr" value="' + esc(UPD.price || 49) + '"></div></label><button class="btn line small" id="up-price-save">שמירה</button></div>' +
        '<h4>📢 פרסום עדכון</h4><div class="adm-grid"><label class="adm-f"><span>גרסה (מהבניות האחרונות)</span><div class="adm-in"><select id="up-ver">' + (builds.length ? builds.map(function (b) { return '<option value="' + esc(b.ver) + '">' + esc(b.ver) + ' · ' + when(b.at) + '</option>'; }).join('') : '<option value="">אין בניות חדשות</option>') + '</select></div></label>' +
        '<label class="adm-f"><span>מחיר (₪)</span><div class="adm-in"><input id="up-p" inputmode="decimal" dir="ltr" value="' + esc(UPD.price || 49) + '"></div></label></div>' +
        '<label class="adm-f"><span>מה חדש (הלקוח רואה את זה)</span><div class="adm-in"><textarea id="up-notes" rows="3" maxlength="1500" placeholder="למשל: סביבת עבודה מהירה, חלון הדפסה חדש, 18 עיצובי AI חדשים"></textarea></div></label>' +
        '<div class="adm-row"><label class="adm-chk"><input type="checkbox" id="up-free"> עדכון בחינם לכולם</label><button class="btn gold" id="up-go"' + (builds.length ? '' : ' disabled') + '>📢 פרסום העדכון</button></div>' +
        (pubs.length ? '<h4>עדכונים שפורסמו</h4><table class="adm-tbl"><tbody>' + pubs.map(function (v) { return '<tr><td dir="ltr"><b>' + esc(v.ver) + '</b></td><td>' + (v.free ? 'חינם' : nis(v.price)) + '</td><td>' + when(v.at) + '</td><td>' + esc(v.notes || '') + '</td><td class="act"><button data-unpub="' + esc(v.ver) + '" title="ביטול הפרסום">🗑</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">עוד לא פורסם עדכון. עד אז הלקוחות נשארים בגרסה שהתקינו.</p>') +
        '<h4>📨 בקשות עדכון (' + reqs.length + ')</h4>' + (reqs.length ? '<table class="adm-tbl"><tbody>' + reqs.map(function (L) { return '<tr><td><b>' + esc(L.name) + '</b><small dir="ltr">' + esc(L.email) + '</small></td><td dir="ltr">' + esc(L.appVer || '—') + ' → ' + esc(L.updReq.ver) + '</td><td>' + when(L.updReq.at) + '</td><td class="act">' + (L.phone ? '<a target="_blank" rel="noopener" href="' + esc(wa(L.phone, 'שלום ' + (L.name || '') + ', לגבי עדכון אופטימוס לגרסה ' + L.updReq.ver + ': המחיר ' + nis(UPD.price) + '. אחרי התשלום אאשר והעדכון ייפתח אצלך בתוכנה ("⬆️ עדכון גרסה").')) + '" title="וואטסאפ">💬</a>' : '') + '<button data-grant="' + esc(L.email) + '" title="אישור (אחרי תשלום)">✔ אישור</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">אין בקשות פתוחות.</p>');
      $('#up-price-save').addEventListener('click', function () { LIC.admin('upd-settings', { price: $('#up-price').value.trim() }).then(function (r) { done(r, '✔ מחיר העדכון נשמר'); }); });
      $('#up-go').addEventListener('click', function () {
        var v = $('#up-ver').value; if (!v) return;
        var free = $('#up-free').checked;
        if (!confirm('לפרסם את גרסה ' + v + ' כעדכון' + (free ? ' בחינם לכולם' : ' במחיר ' + nis($('#up-p').value) + '') + '?')) return;
        LIC.admin('upd-publish', { ver: v, price: $('#up-p').value.trim(), notes: $('#up-notes').value.trim(), free: free ? '1' : '' }).then(function (r) { done(r, '📢 העדכון פורסם. הלקוחות יראו אותו ב"⬆️ עדכון גרסה".'); });
      });
      $$('[data-unpub]', box).forEach(function (b) { b.addEventListener('click', function () { if (!confirm('לבטל את פרסום העדכון ' + b.dataset.unpub + '?')) return; LIC.admin('upd-unpublish', { ver: b.dataset.unpub }).then(function (r) { done(r, 'הפרסום בוטל'); }); }); });
      $$('[data-grant]', box).forEach(function (b) { b.addEventListener('click', function () { grant(ALL.filter(function (x) { return x.email === b.dataset.grant; })[0]); }); });
    }
    function grant(L) {
      var top = latestPub(), v = (L.updReq && L.updReq.ver) || (top && top.ver);
      if (!v) return FS.toast('קודם מפרסמים עדכון');
      v = window.prompt('לאשר ל־' + L.name + ' עדכון לגרסה:', v); if (!v) return;
      var pub = (UPD.versions || []).filter(function (x) { return x.ver === v; })[0];
      var amt = window.prompt('כמה שולם על העדכון? (₪, 0 = בלי תשלום)', pub && !pub.free ? pub.price : 0); if (amt == null) return;
      var method = Number(amt) > 0 ? window.prompt('איך שולם? (ביט, פייבוקס, העברה, מזומן…)', 'ביט') || '' : '';
      LIC.admin('upd-grant', { email: L.email, ver: v.trim(), amount: amt, method: method }).then(function (r) { done(r, '⬆️ העדכון לגרסה ' + v + ' אושר ל־' + L.name + '. אצלו בתוכנה: "⬆️ עדכון גרסה" ← הורדה והתקנה.'); });
    }
    function act(a, L) {
      if (a === 'pay') { var pr = $('#lic-list tr[data-p="' + L.email.replace(/"/g, '') + '"]'); if (pr) pr.hidden = !pr.hidden; return; }
      if (a === 'upd') return grant(L);
      if (a === 'copy') return copy(codeText(L));
      if (a === 'history') { var h = $('#lic-list tr[data-h="' + L.email.replace(/"/g, '') + '"]'); if (h) h.hidden = !h.hidden; return; }
      if (a === 'mail') return LIC.admin('lic-mail', { email: L.email }).then(function (r) { done(r, '✉️ נשלח למייל ' + L.email + ' (אם שירות המיילים מחובר).'); });
      if (a === 'release') { if (!confirm('לשחרר את המחשב של ' + L.name + '? הקוד יופעל מחדש במחשב הבא שבו יוזן, והמחשב הנוכחי ינותק.')) return; return LIC.admin('lic-release', { email: L.email }).then(function (r) { done(r, '🔓 המחשב שוחרר.'); }); }
      if (a === 'rotate') { if (!confirm('להנפיק ל־' + L.name + ' קוד חדש? הקוד הישן יפסיק לעבוד מיד, והתוכנה תנותק עד שיוזן הקוד החדש.')) return; return LIC.admin('lic-rotate', { email: L.email, send: confirm('לשלוח את הקוד החדש גם למייל?') ? '1' : '' }).then(function (r) { done(r, '♻️ קוד חדש: ' + (r.license ? r.license.code : '')); }); }
      if (a === 'toggle') { if (L.active && !confirm('לבטל את הרישיון של ' + L.name + '? הסטודיו ייסגר אצלו מיד (או בחיבור הבא לאינטרנט).')) return; return LIC.admin('lic-set', { email: L.email, active: L.active ? '' : '1' }).then(function (r) { done(r, L.active ? '⛔ הרישיון בוטל.' : '✅ הרישיון פעיל.'); }); }
      if (a === 'delete') { if (!confirm('למחוק לגמרי את הרישיון של ' + L.name + '? אי אפשר לבטל.')) return; return LIC.admin('lic-delete', { email: L.email }).then(function (r) { done(r, '🗑 נמחק.'); }); }
    }
    $('#ln-go').addEventListener('click', function () {
      var b = this, d = { name: $('#ln-name').value.trim(), email: $('#ln-email').value.trim(), phone: $('#ln-phone').value.trim(), note: $('#ln-note').value.trim(), send: $('#ln-send').checked ? '1' : '', price: $('#ln-price').value.trim() };
      if ($('#ln-paid').checked) { d.paidNow = '1'; d.amount = $('#ln-amount').value.trim() || d.price; d.method = $('#ln-method').value; d.ref = $('#ln-ref').value.trim(); }
      if (d.name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return FS.toast('שם ומייל תקינים.');
      b.disabled = true;
      LIC.admin('lic-create', d).then(function (r) {
        b.disabled = false; if (!r.ok) return FS.toast(ACC.msg(r), 6000);
        ALL = r.licenses; draw(); ['#ln-name', '#ln-email', '#ln-phone', '#ln-note', '#ln-amount', '#ln-ref'].forEach(function (s) { $(s).value = ''; }); $('#ln-paid').checked = false; $('.ln-pay').hidden = true; $('#ln-price').value = SET.price;
        var L = r.license;
        var box = $('#lic-made'); if (!box) { $('.lic-new').closest('.adm-card').insertAdjacentHTML('beforeend', '<div id="lic-made" class="lic-made"></div>'); box = $('#lic-made'); }
        box.innerHTML = '<p>✔ הקוד האישי של <b>' + esc(L.name) + '</b>:</p><p class="lic-big"><code>' + esc(L.code) + '</code></p><p class="hint">' + (d.send ? 'נשלח למייל ' + esc(L.email) + ' (אם שירות המיילים מחובר). ' : '') + 'אפשר גם להעתיק או לשלוח בוואטסאפ:</p>' +
          '<div class="adm-row"><button class="btn gold" id="lc-copy">📋 העתקת הקוד וההוראות</button>' + (L.phone ? '<a class="btn line" target="_blank" rel="noopener" href="' + esc(wa(L.phone, codeText(L))) + '">💬 וואטסאפ</a>' : '') + '</div>';
        var cb = document.getElementById('lc-copy'); if (cb) cb.addEventListener('click', function () { copy(codeText(L)); });
      });
    });
    $('#lic-q').addEventListener('input', function () { q = this.value.trim(); draw(); });
    function load() { LIC.admin('lic-list').then(function (r) { if (!r.ok) { $('#lic-list').innerHTML = '<p class="hint">' + esc(ACC.msg(r)) + '</p>'; return; } ALL = r.licenses; LEADS = r.leads || []; ACT = r.activity || []; leadsDraw(); nowDraw(); if (r.upd) UPD = r.upd; if (r.settings) { SET = r.settings; prices(); if (!$('#ln-price').value) $('#ln-price').value = SET.price; } draw(); updDraw(); }); }
    $('#ln-paid').addEventListener('change', function () { $('.ln-pay').hidden = !this.checked; if (this.checked && !$('#ln-amount').value) $('#ln-amount').value = $('#ln-price').value; });
    $('#ls-save').addEventListener('click', function () { LIC.admin('lic-settings', { price: $('#ls-price').value.trim(), passPrice: $('#ls-pass').value.trim(), monthPrice: $('#ls-month').value.trim(), yearPrice: $('#ls-year').value.trim(), promo: $('#ls-promo').value.trim(), terms: $('#ls-terms').value.trim() }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); SET = r.settings; prices(); $('#ln-price').value = SET.price; FS.toast('✔ המחירים נשמרו.'); }); });
    downloads().then(function (d) { DLS = d || { n: '—' }; if (ALL) { stats(); updDraw(); nowDraw(); } });
    c.onRefresh(load);
    load();
    /* every minute while the licences screen is open (quietly: no "loading" in between) */
    var tick = setInterval(function () { if (!document.getElementById('lic-now')) { clearInterval(tick); return; } var busy = document.querySelector('#lic-list tr.lic-pay:not([hidden]), #lic-list tr.lic-hist:not([hidden])') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));   /* never while the owner types or has a row open */
      if (!document.hidden && !busy) load(); }, 60000);
  };
})();
