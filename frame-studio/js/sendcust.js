/* 📤 Send to the customer: the edited photo (as it is now: frame, texts, colour) goes to the customer who registered.
   - ✉️ by email: the server sends it as an attachment from the studio (frame.mjs photo-mail), with the business name and a note;
     the reply comes back to the sender.
   - 💬 WhatsApp: the photo is copied to the clipboard and the customer's chat opens with a message; one paste (Ctrl+V) and send.
     (A WhatsApp link cannot carry a file.)
   - 💾 save: the same JPEG on this computer.
   The address and phone come from where the photo came from (a customer photo from the "תמונות לקוחות" tab carries the
   customer's name, phone and, for an order, email), or are typed once and remembered for the next time. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var $ = FS.$, esc = FS.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var EMAIL = /^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{1,20}$/;

  /* the photo as a JPEG, at most 2400 px on the long side (about 1 MB): sharp on a phone and in print at 10×15 */
  function jpeg(p) {
    var d = p.doc, k = Math.min(1, 2400 / Math.max(d.w, d.h)), c = FS.renderFull(p, k, false);
    return { canvas: c, url: c.toDataURL('image/jpeg', 0.9) };
  }
  function phoneIntl(v) { var d = String(v || '').replace(/\D/g, ''); if (!d) return ''; if (/^0/.test(d)) d = '972' + d.slice(1); return d.length >= 9 ? d : ''; }
  function bizName() { return (FS.BIZ && FS.BIZ.name) || lsj('fs-sendcust-biz', '') || ''; }

  FS.sendToCustomer = function (p) {
    p = p || (FS.cur && FS.cur()); if (!p) return FS.toast('אין תמונה לשליחה');
    var who = Object.assign({ name: '', email: '', phone: '' }, lsj('fs-sendcust-last:' + p.id, {}), p.regaim ? { name: p.regaim.name || '', email: p.regaim.email || '', phone: p.regaim.phone || '' } : {}, p.customer || {});
    var recent = lsj('fs-sendcust-recent', []);
    var b = FS.dialog('📤 שליחה ללקוח', '<div class="sc-send">' +
      '<div class="sc-prev"><img alt="התמונה שתישלח"></div>' +
      '<div class="sc-form">' +
        '<label>שם הלקוח<input id="scs-name" maxlength="60" list="scs-recent" value="' + esc(who.name) + '"></label>' +
        '<datalist id="scs-recent">' + recent.map(function (r) { return '<option value="' + esc(r.name) + '">' + esc([r.email, r.phone].filter(Boolean).join(' · ')) + '</option>'; }).join('') + '</datalist>' +
        '<label>מייל (שהלקוח נרשם איתו)<input id="scs-email" type="email" dir="ltr" maxlength="120" value="' + esc(who.email) + '"></label>' +
        '<label>טלפון (שהלקוח נרשם איתו)<input id="scs-phone" type="tel" dir="ltr" maxlength="20" value="' + esc(who.phone) + '"></label>' +
        '<label>שם העסק שיופיע במייל<input id="scs-biz" maxlength="60" value="' + esc(bizName()) + '"></label>' +
        '<label>הודעה (לא חובה)<textarea id="scs-note" rows="2" maxlength="500" placeholder="תודה שבאתם! 💛"></textarea></label>' +
        '<div class="sc-acts"><button class="mt-btn primary" id="scs-mail">✉️ שליחה במייל</button><button class="mt-btn" id="scs-wa">💬 וואטסאפ</button><button class="mt-btn" id="scs-save">💾 שמירה</button></div>' +
        '<p class="mt-hint" id="scs-st">התמונה נשלחת כמו שהיא עכשיו: עם המסגרת, הטקסטים והצבעים.</p>' +
      '</div></div>', true);
    var img = jpeg(p); $('.sc-prev img', b).src = img.url;
    var st = $('#scs-st', b);
    function read() { return { name: $('#scs-name', b).value.trim(), email: $('#scs-email', b).value.trim(), phone: $('#scs-phone', b).value.trim(), note: $('#scs-note', b).value.trim(), biz: $('#scs-biz', b).value.trim() }; }
    function remember(v) {
      lss('fs-sendcust-last:' + p.id, { name: v.name, email: v.email, phone: v.phone }); if (v.biz && !(FS.BIZ && FS.BIZ.name)) lss('fs-sendcust-biz', v.biz);
      if (!v.name && !v.email && !v.phone) return;
      var l = lsj('fs-sendcust-recent', []).filter(function (r) { return r.name !== v.name || r.email !== v.email || r.phone !== v.phone; });
      l.unshift({ name: v.name, email: v.email, phone: v.phone }); lss('fs-sendcust-recent', l.slice(0, 40));
    }
    /* choosing a name from the recent list fills its email and phone */
    $('#scs-name', b).addEventListener('change', function () { var r = recent.filter(function (x) { return x.name === this.value; }, this)[0]; if (r) { if (r.email) $('#scs-email', b).value = r.email; if (r.phone) $('#scs-phone', b).value = r.phone; } });
    $('#scs-mail', b).addEventListener('click', function () {
      var v = read(); if (!EMAIL.test(v.email)) { $('#scs-email', b).focus(); st.textContent = 'חסר מייל תקין.'; return; }
      if (!FS.account || !FS.account.call) { st.textContent = 'כדי לשלוח במייל צריך להיות מחובר.'; return; }
      st.textContent = 'שולח…'; this.disabled = true; var btn = this;
      FS.account.call('photo-mail', { to: v.email, name: v.name, note: v.note, biz: v.biz, image: img.url }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok && r.mailed !== false) { remember(v); st.textContent = '✔ נשלח למייל ' + v.email; FS.toast('✉️ התמונה נשלחה ל' + (v.name || v.email)); if (p.regaim) p.sentTo = v.email; }
        else st.textContent = r && r.error === 'signed-out' ? 'צריך להתחבר מחדש (רישיון או כניסת מנהל).' : r && r.error === 'rate-limited' ? 'הגעת למגבלת המיילים להיום (80).' : r && r.error === 'too-big' ? 'התמונה גדולה מדי למייל.' : r && r.mailed === false ? 'שירות המיילים לא זמין כרגע. אפשר בוואטסאפ.' : 'השליחה לא הצליחה. בודקים חיבור לאינטרנט.';
      });
    });
    $('#scs-wa', b).addEventListener('click', function () {
      var v = read(), ph = phoneIntl(v.phone); if (!ph) { $('#scs-phone', b).focus(); st.textContent = 'חסר מספר טלפון.'; return; }
      remember(v);
      var text = 'שלום' + (v.name ? ' ' + v.name : '') + ', הנה התמונה שלך' + (v.biz ? ' מ' + v.biz : '') + ' 📸' + (v.note ? '\n' + v.note : '');
      var open = function () { window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); };
      /* the photo goes to the clipboard as a PNG (what the clipboard takes); in the chat: Ctrl+V and send */
      if (navigator.clipboard && window.ClipboardItem) {
        new Promise(function (res) { img.canvas.toBlob(res, 'image/png'); }).then(function (blob) { return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); })
          .then(function () { st.textContent = '✔ התמונה הועתקה. בצ׳אט שנפתח: Ctrl+V (הדבקה) ושליחה.'; FS.toast('💬 מדביקים בצ׳אט (Ctrl+V) ושולחים', 7000); open(); },
            function () { st.textContent = 'לא הצלחתי להעתיק. שומרים (💾) ומצרפים בצ׳אט.'; open(); });
      } else { st.textContent = 'שומרים (💾) ומצרפים בצ׳אט שנפתח.'; open(); }
    });
    $('#scs-save', b).addEventListener('click', function () {
      var a = document.createElement('a'); a.href = img.url; a.download = (read().name || p.name || 'תמונה').replace(/[\\/:*?"<>|]+/g, '_') + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); st.textContent = '✔ נשמר.';
    });
  };
  /* the button in "שמירה והדפסה" */
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('send-cust'); if (b) b.addEventListener('click', function () { FS.sendToCustomer(); });
  });
})();
