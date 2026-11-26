/* 📺 Running the hall's TV from Optimus (🎉 אירוע חי ← 📺 שליטה במסך). The TV is any screen with a browser: it opens
   …/frame-studio/tv.html, shows a 6-digit code, and the owner types it here. From then on everything is set from this
   panel through the server (action 'screen'): which screen runs (the owners' screen, the guests' slideshow, the live
   mosaic), pause / next / previous, a message across the screen, one guest's photo shown large, the owners' photos (the
   marked photos go up to the server, so the TV shows them wherever it is), and the strip's settings. The TV looks every
   2 seconds (tv-remote.js), so a change shows within about 2 seconds. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var esc = FS.esc, st = null, open = false, timer = 0, sendT = 0, busy = false, pend = {};
  function ev() { return FS.liveCurrent && FS.liveCurrent(); }
  function api(op, data) { var e = ev(); return FS.liveApi('screen', Object.assign({ e: e && e.id, op: op }, data || {})); }
  function site() { return FS.liveSiteBase ? FS.liveSiteBase() : new URL('.', location.href).href; }
  function err(r) { return r && r.error === 'offline' ? 'אין חיבור לאינטרנט' : r && r.error === 'tv-code' ? 'הקוד לא נמצא. בודקים את הקוד שעל הטלוויזיה (הוא מתחלף כל 20 דקות).' : r && r.error === 'signed-out' ? 'צריך להיכנס לאופטימוס מחדש' : r && r.error === 'full' ? 'הגעתם ל־150 תמונות של בעלי השמחה' : 'משהו השתבש, מנסים שוב'; }
  function ago(t) { var s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'עכשיו' : s < 3600 ? 'לפני ' + Math.round(s / 60) + ' דק׳' : 'לפני ' + Math.round(s / 3600) + ' שע׳'; }

  /* a photo for the TV: at most 2000 px, JPEG */
  function jpeg(p) {
    return new Promise(function (ok, no) {
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () {
        var k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        var q = 0.86, d = c.toDataURL('image/jpeg', q); while (d.length > 1650000 && q > 0.5) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
        ok(d.split(',')[1]);
      };
      im.onerror = no; im.src = p.src;
    });
  }

  function seg(name, cur, opts) { return '<div class="seg tvc-seg" data-set="' + name + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + o[1] + '</button>'; }).join('') + '</div>'; }
  function draw(body) {
    var e = ev(), S = (st && st.set) || {}, on = st && st.tvAt && Date.now() - st.tvAt < 30000, marked = FS.marked().filter(function (p) { return !p.craft && !p.strip; });
    var mode = S.mode || 'host', strip = 'strip' in S ? S.strip : 26;
    body.innerHTML = '<div class="tvc">' +
      '<div class="tvc-st ' + (on ? 'on' : '') + '">' + (on ? '🟢 מסך מחובר: <b>' + esc(st.tv || 'מסך') + '</b> · ' + ago(st.tvAt) : st && st.tvAt ? '🟠 המסך האחרון (' + esc(st.tv || '') + ') נראה ' + ago(st.tvAt) : '⚪ עוד לא מחובר מסך לאירוע הזה') + '</div>' +
      '<section><h4>🔗 חיבור טלוויזיה</h4><p class="hint">בדפדפן של הטלוויזיה (או של מחשב שמחובר אליה) פותחים את הכתובת הזו. על המסך יופיע קוד של 6 ספרות:</p>' +
        '<p class="tvc-url"><b dir="ltr">' + esc(site().replace(/^https?:\/\//, '') + 'tv.html') + '</b> <button type="button" class="btn small" id="tvc-copy">📋 העתקה</button></p>' +
        '<div class="lv-row"><input id="tvc-code" inputmode="numeric" maxlength="7" placeholder="הקוד מהמסך, למשל 482 913" dir="ltr" autocomplete="off"><button type="button" class="btn primary" id="tvc-pair">חיבור</button></div>' +
        '<button type="button" class="btn small" id="tvc-here">🖥️ לפתוח את המסך במחשב הזה (מסך שני / מקרן)</button></section>' +
      '<section><h4>🎬 מה רץ על המסך</h4>' + seg('mode', mode, [['host', '🎬 בעלי השמחה + פס אורחים'], ['wall', '📸 מצגת האורחים'], ['mosaic', '🧩 פסיפס חי']]) +
        '<div class="tvc-play"><button type="button" class="btn" data-cmd="prev" title="הקודמת">⏮</button><button type="button" class="btn primary" data-cmd="' + (S.paused ? 'play' : 'pause') + '">' + (S.paused ? '▶ המשך' : '⏸ עצירה') + '</button><button type="button" class="btn" data-cmd="next" title="הבאה">⏭</button><button type="button" class="btn" data-cmd="reload" title="טעינה מחדש של המסך">🔄</button></div></section>' +
      '<section><h4>📣 הודעה על המסך</h4><div class="lv-row"><input id="tvc-say" maxlength="160" placeholder="למשל: כולם לרחבה! 💃"><select id="tvc-sec"><option value="10">10 שנ׳</option><option value="20" selected>20 שנ׳</option><option value="60">דקה</option><option value="300">5 דק׳</option></select></div>' +
        '<div class="tvc-row"><button type="button" class="btn primary" id="tvc-say-go">📣 להציג</button><button type="button" class="btn" data-cmd="unsay">✕ להסתיר</button>' +
        ['🎉 מזל טוב!', '💃 כולם לרחבה!', '📸 סורקים את ה־QR ומצטלמים', '🍰 עוגה בעוד 5 דקות'].map(function (t) { return '<button type="button" class="btn small" data-quick="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></section>' +
      '<section><h4>💞 התמונות של בעלי השמחה <small>(' + ((st && st.owners) || []).length + ' על המסך)</small></h4>' +
        '<div class="tvc-row"><button type="button" class="btn primary" id="tvc-up"' + (marked.length ? '' : ' disabled') + '>⬆️ שליחת ' + marked.length + ' המסומנות למסך</button>' + ((st && st.owners || []).length ? '<button type="button" class="btn" id="tvc-clear">🗑 להוריד את כולן מהמסך</button>' : '') + '</div>' +
        '<p class="hint" id="tvc-upst">' + (marked.length ? '' : 'מסמנים בתוכנה את התמונות של החתן והכלה / בר־בת המצווה, ואז שולחים.') + '</p></section>' +
      '<section><h4>📸 להציג בגדול תמונה של אורח</h4><div class="tvc-guests" id="tvc-guests"><p class="hint">טוען…</p></div></section>' +
      '<section><h4>⚙️ הגדרות המסך</h4>' +
        '<label class="tvc-f">כותרת<input id="tvc-title" maxlength="80" placeholder="ריק = שם האירוע" value="' + esc(S.text || '') + '"></label>' +
        '<label class="tvc-f">שניות לכל תמונה: <b id="tvc-secv">' + (S.sec || 7) + '</b><input type="range" min="3" max="30" id="tvc-isec" value="' + (S.sec || 7) + '"></label>' +
        '<label class="tvc-f">גובה הפס: <b id="tvc-stv">' + (strip ? strip + '%' : 'בלי פס') + '</b><input type="range" min="0" max="40" step="2" id="tvc-strip" value="' + strip + '"></label>' +
        '<div class="tvc-f">מהירות הפס ' + seg('speed', S.speed || 'mid', [['slow', 'איטית'], ['mid', 'רגילה'], ['fast', 'מהירה']]) + '</div>' +
        '<div class="tvc-f">כיוון ' + seg('dir', S.dir || 'right', [['right', 'ימינה ➡️'], ['left', '⬅️ שמאלה']]) + '</div>' +
        '<div class="tvc-f">סדר ' + seg('order', S.order || 'seq', [['seq', 'לפי הסדר'], ['mix', 'מעורבב']]) + '</div>' +
        [['names', 'שם השולח מתחת לתמונה', true], ['qr', 'קוד QR בקצה הפס', true], ['title', 'להציג כותרת', true], ['studio', 'גם המגנטים שהודפסו בעמדה', false], ['local', 'גם תמונות שנוספו במחשב של המסך עצמו', true]].map(function (x) {
          var v = x[0] in S ? S[x[0]] : x[2]; return '<label class="tvc-ck"><input type="checkbox" data-ck="' + x[0] + '"' + (v ? ' checked' : '') + '> ' + x[1] + '</label>';
        }).join('') + '</section></div>';
    bind(body);
    guests(body);
  }
  function set(patch) {
    /* only the changes go (the server merges them), so an answer that arrives in between never undoes a change */
    st = st || {}; st.set = Object.assign({}, st.set || {}, patch); pend = Object.assign(pend, patch);
    clearTimeout(sendT); sendT = setTimeout(function () { var p = pend; pend = {}; api('set', { set: p }).then(function (r) { if (r.ok) { st = r; st.set = Object.assign({}, r.set, pend); } else { pend = Object.assign(p, pend); FS.toast(err(r)); } }); }, 350);
  }
  function cmd(c, extra) { return api('cmd', Object.assign({ cmd: c }, extra || {})).then(function (r) { if (!r.ok) { FS.toast(err(r)); return r; } st = r; return r; }); }
  function bind(body) {
    var $ = function (s) { return body.querySelector(s); }, all = function (s) { return Array.prototype.slice.call(body.querySelectorAll(s)); };
    $('#tvc-copy').onclick = function () { var u = site() + 'tv.html'; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { FS.toast('📋 הכתובת הועתקה'); }, function () { window.prompt('הכתובת:', u); }); };
    $('#tvc-pair').onclick = function () {
      var c = $('#tvc-code').value.replace(/\D/g, ''); if (c.length !== 6) return FS.toast('מקלידים את 6 הספרות שעל המסך');
      api('pair', { code: c }).then(function (r) { if (!r.ok) return FS.toast(err(r), 6000); st = r; FS.toast('📺 המסך מתחבר… בעוד כמה שניות הוא יעבור לאירוע', 5000); setTimeout(refresh, 4000); });
    };
    $('#tvc-code').onkeydown = function (e) { if (e.key === 'Enter') $('#tvc-pair').click(); };
    $('#tvc-here').onclick = function () { var e = ev(); window.open(site() + 'wall.html?e=' + e.id + '&v=' + e.v + '&host=1', '_blank'); };
    all('.tvc-seg').forEach(function (g) { g.querySelectorAll('button').forEach(function (b) { b.onclick = function () { var o = {}; o[g.dataset.set] = b.dataset.v; set(o); g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }; }); });
    all('[data-cmd]').forEach(function (b) { b.onclick = function () { cmd(b.dataset.cmd).then(function (r) { if (r.ok && /pause|play/.test(b.dataset.cmd)) draw(body); if (r.ok) FS.toast('📺 נשלח למסך', 1500); }); }; });
    var say = function (t) { t = String(t || '').trim(); if (!t) return FS.toast('כותבים את ההודעה'); cmd('say', { text: t, sec: +$('#tvc-sec').value }).then(function (r) { if (r.ok) FS.toast('📣 ההודעה על המסך', 2000); }); };
    $('#tvc-say-go').onclick = function () { say($('#tvc-say').value); };
    $('#tvc-say').onkeydown = function (e) { if (e.key === 'Enter') say(this.value); };
    all('[data-quick]').forEach(function (b) { b.onclick = function () { $('#tvc-say').value = b.dataset.quick; say(b.dataset.quick); }; });
    $('#tvc-title').oninput = function () { set({ text: this.value }); };
    $('#tvc-isec').oninput = function () { $('#tvc-secv').textContent = this.value; set({ sec: +this.value }); };
    $('#tvc-strip').oninput = function () { $('#tvc-stv').textContent = +this.value ? this.value + '%' : 'בלי פס'; set({ strip: +this.value }); };
    all('[data-ck]').forEach(function (c) { c.onchange = function () { var o = {}; o[c.dataset.ck] = c.checked; set(o); }; });
    var clr = $('#tvc-clear'); if (clr) clr.onclick = function () { if (!confirm('להוריד מהמסך את כל התמונות של בעלי השמחה?')) return; api('owner-del', { id: '*' }).then(function (r) { if (!r.ok) return FS.toast(err(r)); st = r; draw(body); }); };
    $('#tvc-up').onclick = function () {
      if (busy) return; var list = FS.marked().filter(function (p) { return !p.craft && !p.strip; }); if (!list.length) return;
      busy = true; var done = 0, bad = 0, out = $('#tvc-upst');
      list.reduce(function (pr, p, i) {
        return pr.then(function () { out.textContent = '⬆️ שולחים ' + (i + 1) + ' מתוך ' + list.length + '…'; return jpeg(p); })
          .then(function (b64) { return api('owner-put', { img: b64 }); })
          .then(function (r) { if (r && r.ok) { done++; st = r; } else { bad++; if (r && r.error === 'full') throw r; } }, function (r) { bad++; if (r && r.error === 'full') throw r; });
      }, Promise.resolve()).catch(function (r) { FS.toast(err(r)); }).then(function () {
        busy = false; FS.toast('💞 ' + done + ' תמונות על המסך' + (bad ? ' · ' + bad + ' לא נשלחו' : ''), 4000); if (open) draw(body);
      });
    };
  }
  function guests(body) {
    var box = body.querySelector('#tvc-guests'); if (!box || !FS.liveGet) return;
    Promise.all([FS.liveGet(), FS.account.apiBase()]).then(function (a) {
      var r = a[0], base = a[1], e = ev(); if (!r || !r.ok || !e) { box.innerHTML = '<p class="hint">לא נטען</p>'; return; }
      var list = (r.photos || []).filter(function (p) { return p.src === 'guest' && p.st !== 'hidden'; }).sort(function (x, y) { return y.at - x.at; }).slice(0, 18);
      if (!list.length) { box.innerHTML = '<p class="hint">עוד אין תמונות מאורחים.</p>'; return; }
      box.innerHTML = list.map(function (p) { return '<button type="button" data-show="' + esc(p.id) + '" title="' + esc(p.name || '') + '"><img loading="lazy" alt="" src="' + base + '/frame-live-img?e=' + e.id + '&p=' + p.id + '&v=' + e.v + '"><span>' + esc(p.name || '') + '</span></button>'; }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('[data-show]'), function (b) { b.onclick = function () { cmd('show', { p: b.dataset.show, sec: 15 }).then(function (x) { if (x.ok) FS.toast('📸 על המסך בגדול ל־15 שניות', 2000); }); }; });
    });
  }
  function refresh() {
    if (!open || !ev()) return;
    api('state').then(function (r) {
      if (!r.ok || !open) return; st = r; st.set = Object.assign({}, r.set, pend);
      var box = document.querySelector('#dlg-body .tvc-st'); if (!box) return;
      var on = r.tvAt && Date.now() - r.tvAt < 30000;
      box.className = 'tvc-st' + (on ? ' on' : ''); box.innerHTML = on ? '🟢 מסך מחובר: <b>' + esc(r.tv || 'מסך') + '</b> · ' + ago(r.tvAt) : r.tvAt ? '🟠 המסך האחרון (' + esc(r.tv || '') + ') נראה ' + ago(r.tvAt) : '⚪ עוד לא מחובר מסך לאירוע הזה';
    });
  }
  FS.tvControl = function () {
    var e = ev(); if (!e) return FS.toast('פותחים קודם אירוע (🎉 אירוע חי)');
    var body = FS.dialog('📺 שליטה במסך · ' + e.title, '<p class="hint">טוען…</p>', true); open = true;
    api('state').then(function (r) { if (!r.ok) { body.innerHTML = '<p class="hint">' + esc(err(r)) + '</p>'; return; } st = r; draw(body); });
    clearInterval(timer); timer = setInterval(refresh, 5000);
  };
  FS.on && FS.on('dialog-closed', function () { open = false; clearInterval(timer); });
})();
