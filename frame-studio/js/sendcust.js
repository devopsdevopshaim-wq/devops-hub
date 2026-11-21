/* 📤 Send edited photos: one or several (the marked ones), to a customer or anyone, from anywhere in the program.
   - ✉️ by email: the server sends the photos as attachments from the studio (frame.mjs photo-mail; a few per mail, about 4 MB
     each mail), with the business name and a note; the reply comes back to the sender.
   - 💬 WhatsApp: each photo goes to the clipboard in turn and the chat opens (the customer's, or WhatsApp's own contact list
     when there is no number); paste (Ctrl+V), send, "the next photo". A WhatsApp link cannot carry a file.
   - 💾 save: the same JPEGs on this computer.
   The name, email and phone come from the photo's customer (the "תמונות לקוחות" tab) or are typed once and remembered.
   Ways in: "📤 שליחה" in the workspace's top bar (the marked photos, or the one in focus), "📨 ללקוח" in its photo panel,
   "📨 שליחה ללקוח" in "שמירה והדפסה"; and a green 💬 button, always on screen, that opens WhatsApp. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var $ = FS.$, esc = FS.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var EMAIL = /^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{1,20}$/;

  /* a photo as a JPEG, at most 2400 px on the long side (about 1 MB): sharp on a phone and in print at 10×15 */
  function jpeg(p) {
    var d = p.doc, k = Math.min(1, 2400 / Math.max(d.w, d.h)), c = FS.renderFull(p, k, false);
    return { canvas: c, url: c.toDataURL('image/jpeg', 0.9), name: String(p.srcName || p.name || 'תמונה').replace(/\.[^.]+$/, '') };
  }
  function phoneIntl(v) { var d = String(v || '').replace(/\D/g, ''); if (!d) return ''; if (/^0/.test(d)) d = '972' + d.slice(1); return d.length >= 9 ? d : ''; }
  function bizName() { return (FS.BIZ && FS.BIZ.name) || lsj('fs-sendcust-biz', '') || ''; }
  function openWa(phone, text) { window.open('https://wa.me/' + (phone || '') + (text ? '?text=' + encodeURIComponent(text) : ''), '_blank', 'noopener'); }
  function toClipboard(img) {
    if (!(navigator.clipboard && window.ClipboardItem)) return Promise.reject(new Error('no-clipboard'));
    return new Promise(function (res) { img.canvas.toBlob(res, 'image/png'); }).then(function (blob) { return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); });
  }

  /* p: one photo, or a list */
  FS.sendToCustomer = function (p) {
    var list = Array.isArray(p) ? p.filter(Boolean) : [p || (FS.cur && FS.cur())].filter(Boolean);
    if (!list.length) return FS.toast('אין תמונה לשליחה');
    var first = list[0], many = list.length > 1;
    var who = Object.assign({ name: '', email: '', phone: '' }, lsj('fs-sendcust-last:' + first.id, {}), first.regaim ? { name: first.regaim.name || '', email: first.regaim.email || '', phone: first.regaim.phone || '' } : {}, first.customer || {});
    var recent = lsj('fs-sendcust-recent', []);
    FS.busy && FS.busy('מכין ' + list.length + ' תמונות…');
    var imgs = list.map(jpeg); FS.busy && FS.busy();
    var b = FS.dialog('📤 שליחה' + (many ? ' · ' + list.length + ' תמונות' : ''), '<div class="sc-send">' +
      '<div class="sc-prev' + (many ? ' many' : '') + '">' + imgs.slice(0, 6).map(function (im) { return '<img alt="" src="' + im.url + '">'; }).join('') + (list.length > 6 ? '<i>+' + (list.length - 6) + '</i>' : '') + '</div>' +
      '<div class="sc-form">' +
        '<label>שם<input id="scs-name" maxlength="60" list="scs-recent" value="' + esc(who.name) + '"></label>' +
        '<datalist id="scs-recent">' + recent.map(function (r) { return '<option value="' + esc(r.name) + '">' + esc([r.email, r.phone].filter(Boolean).join(' · ')) + '</option>'; }).join('') + '</datalist>' +
        '<label>מייל (למשלוח במייל)<input id="scs-email" type="email" dir="ltr" maxlength="120" value="' + esc(who.email) + '"></label>' +
        '<label>טלפון (לא חובה בוואטסאפ: בלי מספר בוחרים איש קשר)<input id="scs-phone" type="tel" dir="ltr" maxlength="20" value="' + esc(who.phone) + '"></label>' +
        '<label>שם העסק שיופיע<input id="scs-biz" maxlength="60" value="' + esc(bizName()) + '"></label>' +
        '<label>הודעה (לא חובה)<textarea id="scs-note" rows="2" maxlength="500" placeholder="תודה שבאתם! 💛"></textarea></label>' +
        '<div class="sc-acts"><button class="mt-btn primary" id="scs-wa">💬 וואטסאפ</button><button class="mt-btn primary" id="scs-mail">✉️ מייל</button><button class="mt-btn" id="scs-save">💾 שמירה במחשב</button></div>' +
        '<div class="sc-step" id="scs-step" hidden></div>' +
        '<p class="mt-hint" id="scs-st">התמונות נשלחות כמו שהן עכשיו: עם המסגרת, הטקסטים והצבעים.</p>' +
      '</div></div>', true);
    var st = $('#scs-st', b);
    function read() { return { name: $('#scs-name', b).value.trim(), email: $('#scs-email', b).value.trim(), phone: $('#scs-phone', b).value.trim(), note: $('#scs-note', b).value.trim(), biz: $('#scs-biz', b).value.trim() }; }
    function remember(v) {
      list.forEach(function (q) { lss('fs-sendcust-last:' + q.id, { name: v.name, email: v.email, phone: v.phone }); });
      if (v.biz && !(FS.BIZ && FS.BIZ.name)) lss('fs-sendcust-biz', v.biz);
      if (!v.name && !v.email && !v.phone) return;
      var l = lsj('fs-sendcust-recent', []).filter(function (r) { return r.name !== v.name || r.email !== v.email || r.phone !== v.phone; });
      l.unshift({ name: v.name, email: v.email, phone: v.phone }); lss('fs-sendcust-recent', l.slice(0, 40));
    }
    $('#scs-name', b).addEventListener('change', function () { var r = recent.filter(function (x) { return x.name === this.value; }, this)[0]; if (r) { if (r.email) $('#scs-email', b).value = r.email; if (r.phone) $('#scs-phone', b).value = r.phone; } });

    /* ✉️ a few photos per mail, about 4 MB each */
    $('#scs-mail', b).addEventListener('click', function () {
      var v = read(); if (!EMAIL.test(v.email)) { $('#scs-email', b).focus(); st.textContent = 'חסר מייל תקין.'; return; }
      if (!FS.account || !FS.account.call) { st.textContent = 'כדי לשלוח במייל צריך להיות מחובר.'; return; }
      var groups = [], cur = [], size = 0;
      imgs.forEach(function (im) { var s = im.url.length; if (cur.length && (size + s > 4200000 || cur.length >= 8)) { groups.push(cur); cur = []; size = 0; } cur.push(im.url); size += s; });
      if (cur.length) groups.push(cur);
      var btn = this; btn.disabled = true; var sent = 0, fail = '';
      groups.reduce(function (ch, g, i) {
        return ch.then(function () {
          if (fail) return;
          st.textContent = 'שולח… ' + (i + 1) + '/' + groups.length;
          return FS.account.call('photo-mail', { to: v.email, name: v.name, note: v.note, biz: v.biz, images: g }).then(function (r) {
            if (r && r.ok && r.mailed !== false) sent += g.length;
            else fail = r && r.error === 'signed-out' ? 'צריך להתחבר מחדש (רישיון או כניסת מנהל).' : r && r.error === 'rate-limited' ? 'הגעת למגבלת המיילים להיום (80).' : r && r.mailed === false ? 'שירות המיילים לא זמין כרגע. אפשר בוואטסאפ.' : 'השליחה לא הצליחה. בודקים חיבור לאינטרנט.';
          });
        });
      }, Promise.resolve()).then(function () {
        btn.disabled = false;
        if (sent) { remember(v); FS.toast('✉️ נשלחו ' + sent + ' תמונות ל' + (v.name || v.email)); }
        st.textContent = (sent ? '✔ נשלחו ' + sent + ' תמונות למייל ' + v.email : '') + (fail ? (sent ? ' · ' : '') + fail : '');
      });
    });

    /* 💬 WhatsApp: the chat opens, then each photo is pasted in turn */
    $('#scs-wa', b).addEventListener('click', function () {
      var v = read(), ph = phoneIntl(v.phone); remember(v);
      var text = 'שלום' + (v.name ? ' ' + v.name : '') + ', ' + (many ? 'הנה ' + list.length + ' התמונות שלך' : 'הנה התמונה שלך') + (v.biz ? ' מ' + v.biz : '') + ' 📸' + (v.note ? '\n' + v.note : '');
      var i = 0, box = $('#scs-step', b);
      function step() {
        var im = imgs[i];
        toClipboard(im).then(function () {
          box.hidden = false;
          box.innerHTML = '<b>📋 תמונה ' + (i + 1) + ' מתוך ' + imgs.length + ' הועתקה</b><span>בצ׳אט: Ctrl+V (הדבקה) ושליחה.</span>' + (i + 1 < imgs.length ? '<button class="mt-btn primary" id="scs-next">📋 התמונה הבאה (' + (i + 2) + '/' + imgs.length + ')</button>' : '<span>✔ זו האחרונה.</span>');
          var nx = $('#scs-next', b); if (nx) nx.addEventListener('click', function () { i++; step(); });
        }, function () { st.textContent = 'לא הצלחתי להעתיק את התמונה. שומרים (💾) ומצרפים בצ׳אט.'; });
      }
      openWa(ph, text); step();
      st.textContent = ph ? 'הצ׳אט של ' + (v.name || v.phone) + ' נפתח.' : 'וואטסאפ נפתח: בוחרים איש קשר, ואז מדביקים.';
    });

    $('#scs-save', b).addEventListener('click', function () {
      imgs.forEach(function (im, k) { setTimeout(function () { var a = document.createElement('a'); a.href = im.url; a.download = im.name.replace(/[\\/:*?"<>|]+/g, '_') + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); }, k * 250); });
      st.textContent = '✔ נשמר' + (many ? 'ו ' + list.length + ' קבצים' : '') + '.';
    });
  };

  /* the photos to send from the workspace: the marked ones, or the one in focus / open */
  function current() {
    var m = FS.marked ? FS.marked() : []; if (m.length) return m;
    var f = document.querySelector('#mt .mt-tile.focus'), id = f && f.dataset.id;
    var p = id && FS.state.photos.filter(function (x) { return x.id === id; })[0];
    return [p || (FS.cur && FS.cur())].filter(Boolean);
  }
  function buttons() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return setTimeout(buttons, 1500);
    if (!document.getElementById('send-btn')) {
      var bt = document.createElement('button'); bt.id = 'send-btn'; bt.type = 'button'; bt.className = 'mt-btn primary'; bt.textContent = '📤 שליחה';
      bt.title = 'שליחת התמונות המסומנות (או הנוכחית) בוואטסאפ או במייל';
      bt.addEventListener('click', function () { var l = current(); if (!l.length) return FS.toast('מסמנים תמונות לשליחה, או בוחרים תמונה'); FS.sendToCustomer(l); });
      host.insertBefore(bt, host.firstChild);
    }
  }
  /* 💬 WhatsApp, always on screen */
  function fab() {
    if (document.getElementById('wa-fab')) return;
    var a = document.createElement('button'); a.id = 'wa-fab'; a.type = 'button'; a.title = 'וואטסאפ'; a.setAttribute('aria-label', 'פתיחת וואטסאפ');
    a.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg>';
    a.addEventListener('click', function () {
      var l = current();
      if (l.length && FS.prefs.waFabSends !== false) FS.sendToCustomer(l);   /* with photos at hand: send them */
      else openWa('', '');
    });
    document.body.appendChild(a);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('send-cust'); if (b) b.addEventListener('click', function () { FS.sendToCustomer(); });
    setTimeout(buttons, 2500); fab();
  });
})();
