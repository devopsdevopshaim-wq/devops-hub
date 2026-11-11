/* Program updates for licence holders (the desktop program, versions "1.0.N"). The sign-in server decides (n8n/snippets/access-handle.js,
   updFor): every licence may run the versions up to the one the owner approved; a newer update shows here with its notes and price,
   and is downloaded only after the owner approved it (a symbolic payment per update, recorded in the admin) or published it free.
   - "⬆️ עדכון גרסה" in ☰ (and in the workspace when there is one): what's new, the price, ask for it (the owner is told), or
     download and install it once approved (FSDesktop.update: the installer comes from this project's releases, settings and the
     local AI stay).
   - A version installed without approval opens a lock screen with the way back to the approved version, and the request button.
     The lock is remembered for that version, also without internet.
   Who pays (the server's upd.who): only a licence bought for good ('full'). A monthly / yearly subscriber ('sub') and every licence
   never bought for good ('free': trial, pass, free tier) get each update included, and install it at once.
   A new update is offered by itself once per version (and again when the owner approved it after the payment). For a full licence:
   "✔ מאשר/ת עדכון ותשלום" → the payment details (shown here and mailed) → "💰 שילמתי" with the method and reference → the owner
   approves in the admin, a receipt is mailed to the customer (a copy to the owner), and the install button opens here.
   The owner (an admin session) is never locked. In a browser the studio is always the current one, so none of this shows. */
(function () {
  'use strict';
  var FS = window.FS || {}, LIC = FS.license, D = window.FSDesktop;
  if (!LIC) return;
  var RUN = D && D.isDesktop && /^\d+\.\d+\.\d+$/.test(String(D.version || '')) ? String(D.version) : '';
  var K = 'fs-upd', KL = 'fs-upd-lock';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function vcmp(a, b) { var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; return 0; }
  function state() { try { return JSON.parse(ls(K) || 'null'); } catch (e) { return null; } }
  function admin() { return !!(FS.account && FS.account.isAdmin && FS.account.isAdmin()); }
  function newer(u) { return !!(u && u.latest && RUN && vcmp(u.latest.ver, RUN) > 0); }
  function wa(u, text) {
    var d = String((u && u.phone) || '054-4979771').replace(/\D/g, '').replace(/^0/, '972'), L = LIC.get() || {};
    /* who asks and for what: the owner sees it at once, without asking back */
    text += '\nשם: ' + (L.name || '—') + '\nמייל: ' + (L.email || '—') + '\nמותקן: ' + (RUN || '—') + ' · מאושר עד: ' + ((u && u.cur) || '—');
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
  }

  /* the server's answer comes with every licence check and activation */
  function keep(r) {
    if (!r || !r.ok || !r.upd || !RUN) return r;
    var was = (state() || {}).upd;
    ls(K, JSON.stringify({ upd: r.upd, at: Date.now(), run: RUN }));
    offer(r.upd, was);
    if (r.upd.locked) { ls(KL, RUN); lock(r.upd); } else { if (ls(KL) === RUN) ls(KL, null); unlock(); }
    badge();
    return r;
  }
  /* a new update shows by itself: once per version, and once more when it opens after the payment */
  var KA = 'fs-upd-asked', offered = false;
  function offer(u, was) {
    if (offered || admin() || u.locked || !newer(u)) return;
    var ver = u.latest.ver, opened = u.allowed && was && was.latest && was.latest.ver === ver && !was.allowed;
    if (!opened && ls(KA) === ver) return;
    offered = true; ls(KA, ver);
    setTimeout(function () { if (!document.querySelector('dialog[open]')) open(); else offered = false; }, 2500);
  }
  var check = LIC.check, activate = LIC.activate;
  LIC.check = function () { return check.apply(LIC, arguments).then(keep); };
  LIC.activate = function () { return activate.apply(LIC, arguments).then(keep); };

  /* ---------- the lock screen ---------- */
  var box = null;
  function lock(u) {
    if (!RUN || admin()) return;
    u = u || (state() || {}).upd || {};
    if (!box) { box = document.createElement('div'); box.id = 'upd-lock'; box.setAttribute('dir', 'rtl'); document.body.appendChild(box); }
    var back = u.back, req = u.req && u.req.ver;
    box.innerHTML = '<div class="upd-card"><h2>⬆️ הגרסה הזאת עוד לא אושרה</h2>' +
      '<p>במחשב הזה מותקנת גרסה <b dir="ltr">' + esc(RUN) + '</b>, והרישיון שלך מאושר עד גרסה <b dir="ltr">' + esc(u.cur || '—') + '</b>.</p>' +
      '<p>כל עדכון גרסה נפתח אחרי אישור ותשלום סמלי. אפשר לבקש את העדכון, או לחזור לגרסה המאושרת ולהמשיך לעבוד.</p>' +
      '<div class="upd-acts">' +
        (back && D && D.update ? '<button class="btn primary" data-u="back">⬇️ חזרה לגרסה ' + esc(back.ver) + '</button>' : '') +
        '<button class="btn" data-u="req">' + (req ? '✔ הבקשה נשלחה · לשלוח שוב' : '📨 בקשת אישור לעדכון') + '</button>' +
        '<a class="btn" target="_blank" rel="noopener" href="' + esc(wa(u, 'שלום, אני רוצה לאשר את עדכון אופטימוס לגרסה ' + RUN + '.')) + '">💬 וואטסאפ לחיים</a>' +
        '<button class="btn" data-u="again">🔄 בדיקה שוב</button></div><p class="upd-st" id="upd-st"></p></div>';
    box.hidden = false; document.body.classList.add('upd-locked');
  }
  function unlock() { if (box) box.hidden = true; document.body.classList.remove('upd-locked'); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-u]'); if (!b) return;
    var u = (state() || {}).upd || {}, wrap = b.closest('.upd-card, .upd-dlg'), st = wrap && wrap.querySelector('.upd-st');
    if (b.dataset.u === 'again') { if (st) st.textContent = 'בודק…'; LIC.check().then(function (r) { if (st) st.textContent = r && r.ok && r.upd && !r.upd.locked ? '✔ אושר' : (r && r.offline ? 'אין חיבור לאינטרנט' : 'עוד לא אושר'); }); }
    else if (b.dataset.u === 'req') request(u.locked ? RUN : u.latest && u.latest.ver, st);
    else if (b.dataset.u === 'back' && u.back) install(u.back.ver, st);
    else if (b.dataset.u === 'install' && u.latest) install(u.latest.ver, st);
    else if (b.dataset.u === 'agree' && u.latest) agree(u.latest.ver, wrap, st);
    else if (b.dataset.u === 'paid' && u.latest) paid(u.latest.ver, wrap, st);
  });
  function request(ver, st) {
    var L = LIC.get(); if (!ver || !L || !L.token) return;
    if (st) st.textContent = 'שולח…';
    LIC.call('upd-request', { token: L.token, ver: ver, version: RUN }).then(function (r) {
      if (r && r.ok) { keep({ ok: true, upd: r.upd }); if (st) st.textContent = '✔ הבקשה נשלחה לחיים. אחרי התשלום הוא מאשר, ואז העדכון נפתח כאן.'; }
      else if (st) st.textContent = r && r.error === 'rate-limited' ? 'כבר נשלחו כמה בקשות היום. אפשר גם בוואטסאפ.' : 'השליחה לא הצליחה. אפשר בוואטסאפ.';
    });
  }
  function payBox(p) {
    return '<div class="upd-pay"><h4>🏦 פרטי התשלום</h4><p>סכום: <b>₪' + esc(p.amount) + '</b> · אסמכתא לציון בהעברה: <b dir="ltr">' + esc(p.ref) + '</b></p>' +
      '<p>שם החשבון: ' + esc(p.holder) + ' · בנק ' + esc(p.bank) + ' · סניף ' + esc(p.branch) + ' · חשבון <b dir="ltr">' + esc(p.account) + '</b></p>' +
      '<p class="hint">הפרטים נשלחו גם למייל שלך. אחרי ההעברה ממלאים כאן ולוחצים "💰 שילמתי".</p></div>';
  }
  function paidForm() {
    return '<div class="upd-paid"><label>איך שילמת <select class="upd-m"><option>העברה בנקאית</option><option>ביט</option><option>פייבוקס</option><option>מזומן</option><option>אחר</option></select></label>' +
      '<label>אסמכתא (מספר ההעברה) <input class="upd-r" dir="ltr" maxlength="60"></label>' +
      '<button class="btn primary" data-u="paid">💰 שילמתי</button></div>';
  }
  function agree(ver, wrap, st) {
    var c = wrap && wrap.querySelector('.upd-ok');
    if (c && !c.checked) { if (st) st.textContent = 'מסמנים קודם "אני מאשר/ת".'; c.focus(); return; }
    var L = LIC.get(); if (!L || !L.token) return;
    if (st) st.textContent = 'שולח…';
    LIC.call('upd-request', { token: L.token, ver: ver, version: RUN, agree: '1' }).then(function (r) {
      if (!r || !r.ok) { if (st) st.textContent = r && r.error === 'rate-limited' ? 'כבר נשלחו כמה בקשות היום. אפשר בוואטסאפ.' : 'השליחה לא הצליחה. בודקים חיבור לאינטרנט, או בוואטסאפ.'; return; }
      keep({ ok: true, upd: r.upd });
      var box = wrap.querySelector('.upd-step'); if (r.pay) ls('fs-upd-pay', JSON.stringify(r.pay));
      if (box) box.innerHTML = (r.pay ? payBox(r.pay) : '<p>✔ האישור נשלח לחיים. פרטי התשלום יגיעו אליך ממנו (במייל או בוואטסאפ).</p>') + paidForm();
      if (st) st.textContent = '✔ האישור נשלח.';
    });
  }
  function paid(ver, wrap, st) {
    var L = LIC.get(); if (!L || !L.token) return;
    var m = wrap.querySelector('.upd-m'), rf = wrap.querySelector('.upd-r');
    if (st) st.textContent = 'שולח…';
    LIC.call('upd-request', { token: L.token, ver: ver, version: RUN, paid: '1', method: m ? m.value : '', ref: rf ? rf.value.trim() : '' }).then(function (r) {
      if (!r || !r.ok) { if (st) st.textContent = 'השליחה לא הצליחה. אפשר לשלוח צילום אסמכתא בוואטסאפ.'; return; }
      keep({ ok: true, upd: r.upd });
      var box = wrap.querySelector('.upd-step'); if (box) box.innerHTML = '<p>✔ תודה! חיים קיבל הודעה על התשלום. כשהוא מאשר, נשלחת אליך קבלה במייל והעדכון נפתח כאן מעצמו (גם הודעה תקפוץ).</p>';
      if (st) st.textContent = '';
    });
  }
  function install(ver, st) {
    if (!D || !D.update) { if (st) st.textContent = 'ההתקנה מכאן עובדת בתוכנה למחשב.'; return; }
    if (!confirm('להוריד ולהתקין את גרסה ' + ver + '? התוכנה תיסגר, ההתקנה תיפתח, וההגדרות ומנוע ה־AI נשארים.')) return;
    if (st) st.textContent = 'מוריד… 0%';
    D.update(ver, function (p) { if (st) st.textContent = 'מוריד… ' + (p.total ? Math.floor(p.done / p.total * 100) + '%' : Math.round(p.done / 1e6) + 'MB'); if (D.progress && p.total) D.progress(p.done / p.total); })
      .then(function (r) { if (!r || !r.ok) { if (D.progress) D.progress(-1); if (st) st.textContent = '⚠️ ההורדה לא הצליחה (' + esc((r && r.error) || '') + '). בודקים חיבור לאינטרנט ומנסים שוב.'; } });
  }

  /* ---------- the update tab ---------- */
  function open() {
    if (!FS.dialog) return;
    var s = state(), u = s && s.upd;
    var h;
    if (!RUN) h = '<p>הסטודיו באתר תמיד בגרסה העדכנית. עדכוני גרסה הם לתוכנה שמותקנת במחשב.</p>';
    else if (!u) h = '<p>גרסה מותקנת: <b dir="ltr">' + esc(RUN) + '</b>.</p><p>עוד לא נבדק מול השרת. מתחברים לאינטרנט ולוחצים "בדיקה שוב".</p><div class="upd-acts"><button class="btn" data-u="again">🔄 בדיקה שוב</button></div>';
    else if (!newer(u)) h = '<p>✔ מותקנת הגרסה העדכנית: <b dir="ltr">' + esc(RUN) + '</b>.</p><p class="hint">נבדק ' + new Date(s.at).toLocaleString('he-IL') + '</p><div class="upd-acts"><button class="btn" data-u="again">🔄 בדיקה שוב</button></div>';
    else {
      var L = u.latest, req = u.req && u.req.ver === L.ver ? u.req : null, pay = null;
      try { pay = JSON.parse(ls('fs-upd-pay') || 'null'); } catch (e) { pay = null; }
      if (pay && !(req && pay.ref === req.ref)) pay = null;
      var step;
      if (u.allowed) step = '<p>' + (u.incl ? (u.who === 'sub' ? '✔ כלול במנוי שלך, בלי תשלום.' : '✔ העדכון בלי תשלום.') : '✔ העדכון מאושר לרישיון שלך.') + '</p><div class="upd-acts"><button class="btn primary" data-u="install">⬇️ עדכון עכשיו</button></div><p class="hint">התוכנה תיסגר, ההתקנה תיפתח, ובסיום התוכנה נפתחת מחדש. ההגדרות, הרישיון ומנוע ה־AI נשארים.</p>';
      else if (req && req.paid) step = '<p>✔ דיווחת על התשלום (' + esc(req.paid.method || '') + (req.paid.ref ? ', אסמכתא ' + esc(req.paid.ref) : '') + '). מחכים לאישור של חיים: אז תגיע קבלה במייל והעדכון ייפתח כאן.</p><div class="upd-acts"><button class="btn" data-u="again">🔄 בדיקה שוב</button></div>';
      else if (req && req.agreed) step = (pay ? payBox(pay) : '<p>✔ אישרת את העדכון. פרטי התשלום נשלחו אליך במייל.</p>') + paidForm();
      else step = '<p>' + (L.free ? 'העדכון בחינם.' : 'הרישיון שלך נקנה לתמיד, ולכן עדכון גרסה בתשלום: <b>₪' + esc(L.price) + '</b>, פעם אחת לעדכון הזה. (במנוי חודשי או שנתי העדכונים כלולים.)') + '</p>' +
        '<label class="upd-agree"><input type="checkbox" class="upd-ok"> אני מאשר/ת את העדכון לגרסה <b dir="ltr">' + esc(L.ver) + '</b>' + (L.free ? '' : ' ואת התשלום של ₪' + esc(L.price)) + '</label>' +
        '<div class="upd-acts"><button class="btn primary" data-u="agree">✔ מאשר/ת עדכון ותשלום</button><a class="btn" target="_blank" rel="noopener" href="' + esc(wa(u, 'שלום, אני רוצה את עדכון אופטימוס לגרסה ' + L.ver + '.')) + '">💬 וואטסאפ לחיים</a></div>';
      h = '<p>🎉 יש עדכון: גרסה <b dir="ltr">' + esc(L.ver) + '</b> · מותקנת אצלך: <b dir="ltr">' + esc(RUN) + '</b></p>' +
        (L.notes ? '<div class="upd-notes"><h4>מה חדש</h4><p>' + esc(L.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
        '<div class="upd-step">' + step + '</div>';
    }
    FS.dialog('⬆️ עדכון גרסה', '<div class="upd-dlg">' + h + '<p class="upd-st" id="upd-st2"></p></div>');
  }
  FS.updates = { open: open, state: state, running: RUN };
  var btn = null, mtb = null;
  function badge() {
    var u = (state() || {}).upd, on = newer(u);
    if (btn) { btn.textContent = '⬆️ עדכון גרסה' + (on ? ' · ' + u.latest.ver + ' חדשה' : ''); btn.classList.toggle('upd-new', on); }
    if (mtb) mtb.hidden = !on;
    var m = document.getElementById('sb-menu'); if (m) m.classList.toggle('upd-dot', on);
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!RUN) return;
    var menu = document.getElementById('sb-menu-m');
    if (menu) { btn = document.createElement('button'); btn.className = 'btn'; btn.addEventListener('click', open); menu.insertBefore(btn, menu.firstChild); }
    var acts = document.querySelector('#mt .mt-acts');
    if (acts) { mtb = document.createElement('button'); mtb.className = 'mt-btn upd-new'; mtb.textContent = '⬆️ עדכון'; mtb.hidden = true; mtb.addEventListener('click', open); acts.insertBefore(mtb, acts.firstChild); }
    badge();
    if (ls(KL) === RUN && !admin()) lock();
  });
})();
