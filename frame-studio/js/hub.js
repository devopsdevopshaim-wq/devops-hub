/* מרכז האירוע (the event hub): a tab of its own in the quick workspace, for running an event and selling after it.
   - ⚡ קו אוטומטי: a "hot folder" the camera saves into (Wi-Fi or cable). Every new photo comes in by itself, gets the
     event's frame and QR (the usual hooks), the faces decide its copies, closed eyes or nobody facing the camera hold it,
     and the rest go to the printer in batches (or wait for one click, as the owner chooses).
   - 📡 לוח בקרה: magnets out, the pace per hour, when the guests will all have one, paper and ink left and when they run
     out, the event's profit, a chart of the last hours and alerts.
   - 🎁 אחרי האירוע: a highlights film made on this computer from the best photos (with the owner's own music), and an
     offer of premium products to the couple over WhatsApp (a plain link, free).
   Plus a command bar (Ctrl+K) that reaches every action of the program by typing a word.
   Everything here runs on this computer, offline. Nothing about the guests leaves it. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.mate || !FS.mate.root) return;
  var $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc, root = FS.mate.root;
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function cp(p) { return p.copies == null ? 1 : p.copies; }
  function hhmm(t) { return new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }
  function nf(n) { return Math.round(n).toLocaleString('he-IL'); }
  var IMG = /\.(jpe?g|png|webp|heic|heif|avif)$/i;
  function isImg(n) { return IMG.test(n) || (FS.RAW_EXT && FS.RAW_EXT.test(n)); }
  var IC = {
    hub: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', pulse: '<path d="M2 12h4l3-8 4 16 3-8h6"/>', gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4 9 8 12 8zM12 8s2-5 4.5-4S15 8 12 8z"/>'
  };
  function ic(n) { return '<svg class="mt-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }

  /* ---------- the tab and its screen ---------- */
  var tabs = $('.mt-tabs', root);
  tabs.insertAdjacentHTML('beforeend', '<button data-v="hub" class="mt-hubtab" title="קו אוטומטי מהמצלמה, לוח בקרה ומוצרים אחרי האירוע">' + ic('hub') + 'מרכז האירוע<i class="hub-dot" id="hub-dot" hidden></i></button>');
  $('.mt-hubtab', root).addEventListener('click', function () { FS.mate.show('hub'); });
  var sec = document.createElement('section'); sec.className = 'mt-view hub'; sec.dataset.view = 'hub'; sec.hidden = true;
  sec.innerHTML =
    '<header class="hub-hero"><div class="hub-orb"><i></i><i></i><i></i></div><div><h2>מרכז האירוע</h2><p>המצלמה מצלמת, התוכנה עושה את השאר. אתם רואים הכול בזמן אמת.</p></div>' +
      '<nav class="hub-tabs"><button data-hp="auto" class="on">' + ic('bolt') + 'קו אוטומטי</button><button data-hp="live">' + ic('pulse') + 'לוח בקרה</button><button data-hp="after">' + ic('gift') + 'אחרי האירוע</button></nav></header>' +
    /* the automatic line */
    '<div class="hub-p" data-p="auto"><div class="hub-cols">' +
      '<aside class="hub-card hub-ctl"><h3>📡 תיקייה חמה מהמצלמה</h3><p class="mt-hint">מגדירים במצלמה (או בתוכנה שלה) לשמור לתיקייה במחשב. כל תמונה חדשה שנכנסת לשם נקלטת לבד.</p>' +
        '<div class="hub-folder" id="hub-folder"><b>לא נבחרה תיקייה</b></div>' +
        '<div class="mt-row"><button class="mt-btn primary" id="hub-pick">📁 בחירת תיקייה והפעלה</button><button class="mt-btn" id="hub-stop" hidden>⏸ עצירה</button></div>' +
        '<label class="mt-chk-l"><input type="checkbox" id="hub-old"> לקלוט גם את התמונות שכבר בתיקייה</label>' +
        '<h4>מה קורה לכל תמונה</h4>' +
        '<label class="mt-chk-l"><input type="checkbox" id="hub-cp"> 🧮 עותקים לפי האנשים שמסתכלים למצלמה</label>' +
        '<label class="mt-chk-l"><input type="checkbox" id="hub-eyes"> 😑 עיניים עצומות נעצרות לבדיקה</label>' +
        '<p class="mt-hint">המסגרת של האירוע וה־QR עולים כמו בכל הוספת תמונות.</p>' +
        '<h4>הדפסה</h4><div class="mt-seg hub-mode" id="hub-mode"><button data-m="approve">✋ באישור שלי</button><button data-m="auto">⚡ אוטומטית</button></div>' +
        '<label class="mt-l">מחכה <b id="hub-waitv"></b> שניות לעוד תמונות, ומדפיס יחד (חוסך נייר) <input type="range" id="hub-wait" min="3" max="40" step="1"></label>' +
        '<p class="mt-hint" id="hub-qp"></p></aside>' +
      '<div class="hub-card hub-flow"><div class="hub-kpis" id="hub-akpi"></div>' +
        '<div class="mt-row hub-qacts"><b>התור</b><span class="mt-sp"></span><button class="mt-btn primary" id="hub-printall">🖨️ להדפיס את כל המוכנות</button><button class="mt-btn" id="hub-clear">🧹 ניקוי מה שטופל</button></div>' +
        '<div class="hub-q" id="hub-q"><p class="hub-empty">כשתמונות ייכנסו לתיקייה הן יופיעו כאן: מוכנות, נעצרות לבדיקה או מודפסות.</p></div></div>' +
    '</div></div>' +
    /* the live board */
    '<div class="hub-p" data-p="live" hidden>' +
      '<div class="hub-gauges" id="hub-gauges"></div>' +
      '<div class="hub-cols hub-cols2"><div class="hub-card"><h3>📈 מגנטים בכל רבע שעה <small>4 השעות האחרונות</small></h3><div class="hub-chart" id="hub-chart"></div><div class="hub-alerts" id="hub-alerts"></div></div>' +
        '<aside class="hub-card"><h3>💰 האירוע במספרים</h3>' +
          '<div class="hub-in"><label>אורחים באירוע<input type="number" min="0" max="5000" id="hub-guests"></label><label>מחיר החבילה ₪<input type="number" min="0" max="100000" id="hub-price"></label>' +
          '<label>עלות למגנט ₪ <small>נייר, דיו, מגנט</small><input type="number" min="0" max="100" step="0.1" id="hub-cost"></label><label>הוצאות נוספות ₪ <small>עובדים, נסיעה</small><input type="number" min="0" max="100000" id="hub-extra"></label></div>' +
          '<div class="hub-money" id="hub-money"></div>' +
          '<div class="mt-row"><button class="mt-btn" id="hub-sum">📊 סיכום האירוע</button><button class="mt-btn" id="hub-printer">🖨️ המדפסת שלי</button></div></aside></div></div>' +
    /* after the event */
    '<div class="hub-p" data-p="after" hidden><div class="hub-cols hub-cols2">' +
      '<div class="hub-card"><h3>🎬 סרטון סיכום של האירוע <small>נוצר על המחשב, בלי אינטרנט</small></h3>' +
        '<p class="mt-hint">התוכנה בוחרת את התמונות הכי טובות (חדות, עיניים פתוחות, בלי כפילויות), לפי סדר האירוע, עם תנועה עדינה, מעברים, כותרת וסיום. אם יש תמונות מסומנות, הסרטון נבנה מהן.</p>' +
        '<div class="hub-in"><label>כותרת<input id="hub-vtitle" maxlength="60" placeholder="החתונה של נועה ודניאל"></label><label>שורה שנייה<input id="hub-vsub" maxlength="60" placeholder="20.11.2026"></label>' +
          '<label>סיום<input id="hub-vend" maxlength="60" placeholder="פריים מגנטים · 054-4979771"></label>' +
          '<label>צורה<select id="hub-vfmt"><option value="v">לאורך (סטורי, רילס, וואטסאפ)</option><option value="h">לרוחב (מסך, יוטיוב)</option></select></label>' +
          '<label>אורך<select id="hub-vlen"><option value="30">30 שניות</option><option value="60" selected>דקה</option><option value="90">דקה וחצי</option></select></label>' +
          '<label>מוזיקה (לא חובה)<input type="file" id="hub-vmus" accept="audio/*"></label></div>' +
        '<div class="mt-row"><button class="mt-btn primary" id="hub-vgo">🎬 יצירת הסרטון</button><span class="mt-hint" id="hub-vst"></span></div>' +
        '<div class="hub-vbar" id="hub-vbar" hidden><i></i></div><div class="hub-vout" id="hub-vout"></div></div>' +
      '<aside class="hub-card"><h3>🎁 מוצרי פרימיום לזוג</h3><p class="mt-hint">מסמנים מה להציע, מתקנים מחירים, ושולחים לזוג הודעה מוכנה בוואטסאפ.</p>' +
        '<div class="hub-prods" id="hub-prods"></div><div class="mt-row"><button class="mt-btn" id="hub-padd">➕ מוצר</button></div>' +
        '<div class="hub-in"><label>שם הזוג<input id="hub-oname" maxlength="40" placeholder="נועה ודניאל"></label><label>טלפון<input id="hub-ophone" inputmode="tel" maxlength="20" placeholder="050-0000000"></label></div>' +
        '<div class="mt-row"><button class="mt-btn primary" id="hub-osend">💬 שליחת ההצעה בוואטסאפ</button><button class="mt-btn" id="hub-ocopy">📋 העתקת ההודעה</button></div></aside>' +
    '</div></div>';
  root.appendChild(sec);
  var panel = 'auto';
  function showPanel(p) {
    panel = p; $$('.hub-tabs [data-hp]', sec).forEach(function (b) { b.classList.toggle('on', b.dataset.hp === p); });
    $$('.hub-p', sec).forEach(function (x) { x.hidden = x.dataset.p !== p; });
    if (p === 'live') board(); if (p === 'auto') paintQ(); if (p === 'after') prods();
  }
  $$('.hub-tabs [data-hp]', sec).forEach(function (b) { b.addEventListener('click', function () { showPanel(b.dataset.hp); }); });
  function onHub() { return FS.mate.isOn() && FS.mate.view() === 'hub'; }
  FS.on('mate-view', function (v) { if (v === 'hub') showPanel(panel); });

  /* ---------- ⚡ the automatic line ---------- */
  var cfg = Object.assign({ mode: 'approve', copies: true, eyes: true, wait: 10, old: false }, lsj('fs-hub-auto', {}));
  function saveCfg() { lss('fs-hub-auto', cfg); }
  var hot = null, seen = {}, timer = 0, busy = false, batchT = 0, Q = [], N = { in: 0, out: 0 };
  $('#hub-cp', sec).checked = cfg.copies; $('#hub-eyes', sec).checked = cfg.eyes; $('#hub-old', sec).checked = cfg.old;
  $('#hub-wait', sec).value = cfg.wait; $('#hub-waitv', sec).textContent = cfg.wait;
  function modeUi() { $$('#hub-mode [data-m]', sec).forEach(function (b) { b.classList.toggle('on', b.dataset.m === cfg.mode); }); qpNote(); }
  function qpNote() {
    var ok = FS.mate.quickReady && FS.mate.quickReady(), q = lsj('fs-qprint', null);
    $('#hub-qp', sec).innerHTML = ok ? '🖨️ מדפיס לפי ההדפסה המיידית: <b>' + esc((q && q.printer) || 'חלון ההדפסה') + '</b> · נייר ' + esc((q && q.paper) || '') : '⚠️ קודם מגדירים <a href="#" id="hub-qpset">הדפסה מיידית</a> (מדפסת ופריסה), פעם אחת.';
    var a = $('#hub-qpset', sec); if (a) a.addEventListener('click', function (e) { e.preventDefault(); var b = $('#mt-qset', root); if (b) b.click(); });
  }
  modeUi();
  $('#hub-mode', sec).addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; cfg.mode = b.dataset.m; saveCfg(); modeUi(); if (cfg.mode === 'auto') { if (!FS.mate.quickReady()) FS.toast('⚠️ להדפסה אוטומטית צריך להגדיר קודם הדפסה מיידית', 5000); batch(); } });
  $('#hub-cp', sec).addEventListener('change', function () { cfg.copies = this.checked; saveCfg(); });
  $('#hub-eyes', sec).addEventListener('change', function () { cfg.eyes = this.checked; saveCfg(); });
  $('#hub-old', sec).addEventListener('change', function () { cfg.old = this.checked; saveCfg(); });
  $('#hub-wait', sec).addEventListener('input', function () { cfg.wait = Number(this.value) || 10; $('#hub-waitv', sec).textContent = cfg.wait; saveCfg(); });

  $('#hub-pick', sec).addEventListener('click', function () {
    if (!window.showDirectoryPicker) return FS.dialog('📡 תיקייה חמה', '<p>הקליטה האוטומטית מתיקייה עובדת בתוכנה למחשב (Windows) ובדפדפן Chrome או Edge.</p>');
    window.showDirectoryPicker({ id: 'fs-hot', mode: 'read' }).then(start).catch(function () {});
  });
  $('#hub-stop', sec).addEventListener('click', stop);
  function start(dir) {
    stop(); hot = dir; seen = {};
    $('#hub-folder', sec).innerHTML = '<span class="hub-live"></span><b>' + esc(dir.name) + '</b><small>מחכה לתמונות חדשות…</small>';
    $('#hub-stop', sec).hidden = false; $('#hub-dot').hidden = false;
    scan(!cfg.old).then(function () { timer = setInterval(function () { scan(false); }, 1500); });
    FS.toast('📡 הקו האוטומטי פועל: ' + dir.name);
  }
  function stop() {
    clearInterval(timer); timer = 0; if (!hot) return; hot = null;
    $('#hub-folder', sec).innerHTML = '<b>הקו עצר</b><small>בוחרים תיקייה כדי להפעיל שוב</small>'; $('#hub-stop', sec).hidden = true; $('#hub-dot').hidden = true;
  }
  /* a new file is taken only when its size stays the same between two looks (the camera finished writing it) */
  function scan(prime) {
    if (!hot || busy) return Promise.resolve();
    busy = true; var dir = hot, it = dir.values(), ready = [];
    function step() {
      return it.next().then(function (r) {
        if (r.done) return; var h = r.value;
        if (h.kind !== 'file' || !isImg(h.name)) return step();
        var s = seen[h.name]; if (s && s.done) return step();
        return h.getFile().then(function (f) {
          if (prime) { seen[h.name] = { done: true }; return; }
          if (!s) { seen[h.name] = { size: f.size, lm: f.lastModified }; return; }
          if (f.size > 0 && f.size === s.size && f.lastModified === s.lm) { s.done = true; ready.push(f); } else { s.size = f.size; s.lm = f.lastModified; }
        }, function () { /* still being written, or gone */ }).then(step);
      });
    }
    return step().catch(function () {
      FS.toast('⚠️ אין גישה לתיקייה. בוחרים אותה שוב.', 6000); stop();
    }).then(function () {
      ready.sort(function (a, b) { return a.lastModified - b.lastModified; });
      return ready.reduce(function (ch, f) { return ch.then(function () { return take(f); }); }, Promise.resolve());
    }).then(function () { busy = false; }, function () { busy = false; });
  }
  function take(f) {
    var from = S.photos.length;
    return Promise.resolve(FS.addPhotoFile(f)).then(function () {
      var fresh = S.photos.slice(from); if (!fresh.length) return;
      FS.emit('photos-added', { from: from, n: fresh.length });
      return fresh.reduce(function (ch, p) { return ch.then(function () { return judge(p); }); }, Promise.resolve());
    }).catch(function () { FS.toast('⚠️ ' + f.name + ' לא נפתחה', 4000); });
  }
  function judge(p) {
    N.in++; var it = { p: p, st: 'wait', why: 'בודק פנים…', t: Date.now() }; Q.unshift(it); if (Q.length > 400) Q.length = 400; paintQ();
    var need = (cfg.copies || cfg.eyes) && FS.copiesAdvice && window.FaceSig;
    return (need ? FS.copiesAdvice([p]) : Promise.resolve([null])).then(function (r) {
      var a = r && r[0];
      if (a && a.verdict === 'closed' && cfg.eyes) { it.st = 'hold'; it.why = '😑 עיניים עצומות'; it.alt = a.alt || null; if (it.alt) it.why += ' · יש חלופה מאותו רגע'; }
      else {
        if (a && cfg.copies && a.copies != null && a.verdict !== 'none') p.copies = a.copies;
        if (a && a.verdict === 'none') { it.st = 'ready'; it.why = 'לא זוהו פנים · ' + cp(p) + ' עותקים כמו שהיה'; if (!cp(p)) { it.st = 'hold'; it.why = 'לא זוהו פנים'; } }
        else if (cp(p) <= 0) { it.st = 'hold'; it.why = '🙈 אף אחד לא מסתכל למצלמה'; }
        else { it.st = 'ready'; it.why = a ? (a.people + ' אנשים · ' + cp(p) + ' עותקים') : cp(p) + ' עותקים'; }
      }
    }, function () { it.st = 'ready'; it.why = cp(p) + ' עותקים'; }).then(function () { FS.emit('doc'); paintQ(); if (it.st === 'ready') batch(); });
  }
  function batch() { clearTimeout(batchT); if (cfg.mode !== 'auto') return; batchT = setTimeout(flush, cfg.wait * 1000); }
  function flush(only) {
    var items = (only || Q.filter(function (x) { return x.st === 'ready'; })).filter(function (x) { return S.photos.indexOf(x.p) >= 0 && cp(x.p) > 0; });
    if (!items.length) return;
    if (!FS.mate.printList(items.map(function (x) { return x.p; }))) return;
    items.forEach(function (x) { x.st = 'done'; x.why = '🖨️ נשלחה ' + hhmm(Date.now()); N.out += cp(x.p); });
    paintQ();
    if (window.FSDesktop && FSDesktop.notify && document.hidden) FSDesktop.notify('אופטימוס', items.length + ' תמונות נשלחו להדפסה');
  }
  $('#hub-printall', sec).addEventListener('click', function () { clearTimeout(batchT); flush(); });
  $('#hub-clear', sec).addEventListener('click', function () { Q = Q.filter(function (x) { return x.st === 'ready' || x.st === 'hold' || x.st === 'wait'; }); paintQ(); });
  var thumbs = new WeakMap();
  function thumb(p) {
    var key = p.src.length + ':' + (p.doc.layers ? p.doc.layers.length : 0), u = thumbs.get(p); if (u && u.key === key) return u.url;
    var url = p.src;
    try { var d = p.doc, k = 260 / Math.max(d.w, d.h), c = FS.renderFull(p, k, false); if (c && c.width) url = c.toDataURL('image/jpeg', 0.8); } catch (e) { /* the photo itself */ }
    thumbs.set(p, { key: key, url: url }); return url;
  }
  var LBL = { wait: 'בבדיקה', ready: 'מוכנה', hold: 'נעצרה', done: 'הודפסה', skip: 'דולגה' };
  function paintQ() {
    var c = { ready: 0, hold: 0, done: 0 }; Q.forEach(function (x) { if (c[x.st] != null) c[x.st]++; });
    $('#hub-akpi', sec).innerHTML = kpi(N.in, 'נכנסו מהמצלמה') + kpi(c.ready, 'מוכנות להדפסה', 'q') + kpi(c.hold, 'נעצרו לבדיקה', c.hold ? 'w' : '') + kpi(N.out, 'מגנטים נשלחו', 'g');
    if (!onHub() || panel !== 'auto') return;
    var box = $('#hub-q', sec);
    if (!Q.length) { box.innerHTML = '<p class="hub-empty">כשתמונות ייכנסו לתיקייה הן יופיעו כאן: מוכנות, נעצרות לבדיקה או מודפסות.</p>'; return; }
    box.innerHTML = Q.slice(0, 80).map(function (x, i) {
      var p = x.p, alive = S.photos.indexOf(p) >= 0;
      return '<div class="hub-t s-' + x.st + '" data-i="' + i + '"><div class="hub-ti"><img alt="" src="' + esc(alive ? thumb(p) : '') + '"><span class="hub-st">' + LBL[x.st] + '</span></div>' +
        '<div class="hub-tw">' + esc(x.why) + '</div><div class="hub-tn">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '</div>' +
        (x.st === 'ready' || x.st === 'hold' ? '<div class="hub-tc"><button class="mt-ic" data-a="m">−</button><b>' + cp(p) + '</b><button class="mt-ic" data-a="p">+</button>' +
          '<button class="mt-ic ok" data-a="go" title="להדפיס עכשיו">✓</button>' + (x.alt ? '<button class="mt-ic" data-a="alt" title="להדפיס את החלופה מאותו רגע">⇄</button>' : '') + '<button class="mt-ic" data-a="x" title="לדלג">✕</button></div>' : '') + '</div>';
    }).join('');
  }
  function kpi(n, t, cls) { return '<div class="hub-k ' + (cls || '') + '"><b>' + nf(n) + '</b><small>' + t + '</small></div>'; }
  $('#hub-q', sec).addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'), t = e.target.closest('[data-i]'); if (!b || !t) return;
    var x = Q[Number(t.dataset.i)]; if (!x) return; var p = x.p, a = b.dataset.a;
    if (a === 'm') p.copies = Math.max(0, cp(p) - 1);
    if (a === 'p') { p.copies = Math.min(50, cp(p) + 1); if (x.st === 'hold' && x.why.indexOf('😑') < 0) { x.st = 'ready'; x.why = cp(p) + ' עותקים'; } }
    if (a === 'go') { if (!cp(p)) p.copies = 1; x.st = 'ready'; flush([x]); }
    if (a === 'alt' && x.alt) { var q = x.alt; if (!cp(q)) q.copies = Math.max(1, cp(p)); var y = { p: q, st: 'ready', why: 'החלופה של ' + (p.name || ''), t: Date.now() }; Q.unshift(y); x.st = 'skip'; x.why = 'הוחלפה'; flush([y]); }
    if (a === 'x') { x.st = 'skip'; x.why = 'דולגה'; }
    FS.emit('doc'); paintQ();
  });

  /* ---------- 📡 the live board ---------- */
  var money = Object.assign({ guests: 250, price: 2290, cost: 2.5, extra: 0 }, lsj('fs-hub-money', {}));
  ['guests', 'price', 'cost', 'extra'].forEach(function (k) {
    var el = $('#hub-' + k, sec); el.value = money[k];
    el.addEventListener('input', function () { money[k] = Math.max(0, Number(el.value) || 0); lss('fs-hub-money', money); board(); });
  });
  $('#hub-sum', sec).addEventListener('click', function () { if (FS.printSummary) FS.printSummary(); });
  $('#hub-printer', sec).addEventListener('click', function () { if (FS.printerSetup) FS.printerSetup(board); });
  function ring(v, max, big, small, cls) {
    var f = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0, R = 46, L = 2 * Math.PI * R;
    return '<div class="hub-g ' + (cls || '') + '"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="' + R + '" class="tr"/><circle cx="55" cy="55" r="' + R + '" class="fg" stroke-dasharray="' + (L * f).toFixed(1) + ' ' + L.toFixed(1) + '"/></svg><div><b>' + big + '</b><small>' + small + '</small></div></div>';
  }
  function board() {
    if (!onHub() || panel !== 'live') return;
    var log = lsj('frame-studio-printlog', { start: Date.now(), jobs: [] }), pr = lsj('frame-studio-printer', null), now = Date.now();
    var jobs = (log.jobs || []).filter(function (j) { return j.t >= (log.start || 0); });
    var mags = jobs.reduce(function (a, j) { return a + (j.items || 0); }, 0), sheets = jobs.reduce(function (a, j) { return a + (j.sheets || 0); }, 0);
    var first = jobs.length ? jobs[0].t : now, span = Math.max(5 * 60e3, Math.min(30 * 60e3, now - first));
    var recent = jobs.filter(function (j) { return j.t >= now - span; }), rate = recent.reduce(function (a, j) { return a + j.items; }, 0) / (span / 3600e3);
    var sRate = recent.reduce(function (a, j) { return a + j.sheets; }, 0) / (span / 3600e3);
    var wait = S.photos.filter(function (p) { return !p.printed; }).reduce(function (a, p) { return a + cp(p); }, 0);
    var left = Math.max(0, money.guests - mags), eta = rate > 0 && left ? now + left / rate * 3600e3 : 0;
    var paper = pr && pr.paperCap > 0 ? Math.max(0, pr.paperCap - (pr.paperUsed || 0)) : null, ink = pr && pr.inkCap > 0 ? Math.max(0, Math.round(100 - (pr.inkUsed || 0) / pr.inkCap * 100)) : null;
    var paperEnd = paper != null && sRate > 0 ? now + paper / sRate * 3600e3 : 0;
    $('#hub-gauges', sec).innerHTML =
      ring(mags, money.guests, nf(mags), 'מגנטים מתוך ' + nf(money.guests) + ' אורחים', 'a') +
      ring(rate, 120, nf(rate), 'מגנטים לשעה', 'b') +
      ring(wait, Math.max(wait, 40), nf(wait), 'מחכים להדפסה', wait > 40 ? 'w' : 'c') +
      (paper != null ? ring(paper, pr.paperCap, nf(paper), 'דפים נשארו' + (paperEnd ? ' · עד ' + hhmm(paperEnd) : ''), paper < 20 ? 'w' : 'd') : '<button class="hub-g hub-gset" id="hub-gset"><div><b>🖨️</b><small>להגדיר מדפסת: דפים ודיו</small></div></button>') +
      (ink != null ? ring(ink, 100, ink + '%', 'דיו משוער', ink < 15 ? 'w' : 'e') : '') +
      '<div class="hub-g hub-eta"><div><b>' + (left ? (eta ? hhmm(eta) : '—') : '✔') + '</b><small>' + (left ? 'כל האורחים עם מגנט, בקצב הזה' : 'כל האורחים קיבלו מגנט') + '</small></div></div>';
    var gs = $('#hub-gset', sec); if (gs) gs.addEventListener('click', function () { FS.printerSetup && FS.printerSetup(board); });
    /* the chart: magnets per quarter hour, the last 4 hours */
    var B = 16, Q15 = 15 * 60e3, end = Math.ceil(now / Q15) * Q15, bins = []; for (var i = 0; i < B; i++) bins.push(0);
    jobs.forEach(function (j) { var k = B - 1 - Math.floor((end - j.t - 1) / Q15); if (k >= 0 && k < B) bins[k] += j.items; });
    var mx = Math.max(4, Math.max.apply(null, bins));
    $('#hub-chart', sec).innerHTML = '<div class="hub-bars">' + bins.map(function (v, i) { var t = end - (B - i) * Q15; return '<div title="' + hhmm(t) + ' · ' + v + ' מגנטים"><i style="height:' + (v / mx * 100).toFixed(1) + '%"></i>' + (i % 4 === 0 ? '<small>' + hhmm(t) + '</small>' : '') + '</div>'; }).join('') + '</div>';
    /* alerts */
    var al = [];
    if (paper != null && paper < 20) al.push(['w', '📄 נשארו ' + paper + ' דפים. כדאי להכין גליל חדש.']);
    if (ink != null && ink < 15) al.push(['w', '🖋️ הדיו כמעט נגמר (' + ink + '%).']);
    if (paperEnd && eta && paperEnd < eta) al.push(['w', '⏳ הנייר ייגמר ב־' + hhmm(paperEnd) + ', לפני שכל האורחים יקבלו מגנט.']);
    var held = Q.filter(function (x) { return x.st === 'hold'; }).length; if (held) al.push(['i', '✋ ' + held + ' תמונות מחכות לבדיקה בקו האוטומטי.']);
    if (wait > 40) al.push(['i', '🖨️ ' + wait + ' מגנטים בתור. אפשר להדפיס עכשיו.']);
    if (hot) al.push(['g', '📡 הקו האוטומטי פועל: ' + hot.name]);
    if (!jobs.length) al.push(['i', 'עוד לא הודפס כלום באירוע הזה. המספרים יתמלאו עם ההדפסה הראשונה.']);
    $('#hub-alerts', sec).innerHTML = al.map(function (a) { return '<p class="hub-al ' + a[0] + '">' + esc(a[1]) + '</p>'; }).join('');
    /* money */
    var cost = mags * money.cost + money.extra, profit = money.price - cost;
    $('#hub-money', sec).innerHTML = '<div><span>הכנסה</span><b>₪' + nf(money.price) + '</b></div><div><span>חומרים (' + nf(mags) + ' מגנטים)</span><b>₪' + nf(mags * money.cost) + '</b></div>' +
      (money.extra ? '<div><span>הוצאות נוספות</span><b>₪' + nf(money.extra) + '</b></div>' : '') + '<div class="t ' + (profit < 0 ? 'neg' : '') + '"><span>רווח נקי</span><b>₪' + nf(profit) + '</b></div>' +
      (mags ? '<p class="mt-hint">₪' + (money.price / mags).toFixed(1) + ' הכנסה לכל מגנט · ' + sheets + ' דפים</p>' : '');
  }
  setInterval(function () { if (onHub() && panel === 'live') board(); }, 4000);
  FS.on('doc', function () { if (onHub() && panel === 'live') board(); });

  /* ---------- 🎁 after the event: products ---------- */
  var PRODS = lsj('fs-hub-prods', null) || [
    { n: 'סרטון סיכום של האירוע (דקה)', p: 350, on: true }, { n: 'אלבום דיגיטלי עם "מצא אותי" לאורחים', p: 450, on: true },
    { n: 'מגנט עץ טבעי, חריטה עם שמות הזוג', p: 39, on: false }, { n: 'בלוק אקריליק 10×15 עם התמונה הכי יפה', p: 149, on: true },
    { n: 'קולאז׳ משפחתי מודפס A3 במסגרת', p: 290, on: false }, { n: 'קוביית מגנטים לאירוע הבא (הנחה)', p: 0, on: false }
  ];
  function saveProds() { lss('fs-hub-prods', PRODS); }
  function prods() {
    $('#hub-prods', sec).innerHTML = PRODS.map(function (x, i) {
      return '<div class="hub-pr" data-i="' + i + '"><input type="checkbox"' + (x.on ? ' checked' : '') + ' data-k="on"><input data-k="n" maxlength="80" value="' + esc(x.n) + '"><label>₪<input type="number" min="0" max="100000" data-k="p" value="' + (x.p || 0) + '"></label><button class="mt-ic" data-k="del" title="הסרה">✕</button></div>';
    }).join('');
    var nm = $('#hub-oname', sec), t = $('#hub-vtitle', sec), log = lsj('frame-studio-printlog', {});
    if (!t.value && log.name) t.value = log.name;
    if (!nm.value && log.name) { var m = /של (.+)$/.exec(log.name); if (m) nm.value = m[1]; }
  }
  $('#hub-prods', sec).addEventListener('input', function (e) {
    var r = e.target.closest('[data-i]'), k = e.target.dataset.k; if (!r || !k || k === 'del') return; var x = PRODS[Number(r.dataset.i)];
    if (k === 'on') x.on = e.target.checked; else if (k === 'p') x.p = Math.max(0, Number(e.target.value) || 0); else x.n = e.target.value.slice(0, 80); saveProds();
  });
  $('#hub-prods', sec).addEventListener('click', function (e) { var b = e.target.closest('[data-k="del"]'); if (!b) return; PRODS.splice(Number(b.closest('[data-i]').dataset.i), 1); saveProds(); prods(); });
  $('#hub-padd', sec).addEventListener('click', function () { PRODS.push({ n: 'מוצר חדש', p: 0, on: true }); saveProds(); prods(); var l = $$('#hub-prods [data-k="n"]', sec); if (l.length) l[l.length - 1].select(); });
  function offer() {
    var l = PRODS.filter(function (x) { return x.on && x.n.trim(); }); if (!l.length) { FS.toast('מסמנים לפחות מוצר אחד'); return ''; }
    var nm = $('#hub-oname', sec).value.trim();
    return 'היי' + (nm ? ' ' + nm : '') + ', מזל טוב! 🎉\nשמחנו להיות איתכם באירוע. הכנו לכם כמה דברים מיוחדים לזכור אותו:\n\n' +
      l.map(function (x) { return '• ' + x.n.trim() + (x.p ? ' · ₪' + x.p : ''); }).join('\n') + '\n\nרוצים משהו מהרשימה? מספיק להשיב להודעה הזו 😊';
  }
  $('#hub-osend', sec).addEventListener('click', function () {
    var t = offer(); if (!t) return; var ph = $('#hub-ophone', sec).value.replace(/\D/g, '');
    if (ph && ph.length < 9) return FS.toast('מספר הטלפון לא שלם');
    if (ph.charAt(0) === '0') ph = '972' + ph.slice(1);
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
  });
  $('#hub-ocopy', sec).addEventListener('click', function () { var t = offer(); if (!t) return; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { FS.toast('📋 ההודעה הועתקה'); }, function () { FS.dialog('ההודעה', '<textarea rows="10" style="width:100%">' + esc(t) + '</textarea>'); }); });

  /* ---------- 🎬 the highlights film ---------- */
  var filming = false;
  $('#hub-vgo', sec).addEventListener('click', function () { if (!filming) film(); });
  function pickPhotos(n) {
    var m = FS.marked(); if (m.length >= 3) return Promise.resolve(m.slice(0, n));
    var all = S.photos.slice(); if (!all.length) return Promise.resolve([]);
    var need = all.filter(function (p) { return !(p.rate && p.rate.src === p.src); });
    var score = need.length && FS.scoreAll ? (FS.busy('בוחר את התמונות הכי טובות…'), FS.scoreAll(all, function (i, k) { FS.busy('בוחר את התמונות הכי טובות… ' + i + ' / ' + k); })) : Promise.resolve();
    return Promise.resolve(score).catch(function () {}).then(function () {
      FS.busy();
      var good = all.filter(function (p) { return !p.rate || (!p.rate.dupOf && !(p.rate.closed > 0)); });
      if (good.length < 3) good = all;
      var best = good.slice().sort(function (a, b) { return ((b.rate && b.rate.score) || 50) - ((a.rate && a.rate.score) || 50); }).slice(0, n);
      return all.filter(function (p) { return best.indexOf(p) >= 0; });   /* in the order of the event */
    });
  }
  function film() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return FS.toast('המחשב הזה לא תומך ביצירת סרטון');
    var L = Number($('#hub-vlen', sec).value) || 60, vert = $('#hub-vfmt', sec).value === 'v', W = vert ? 1080 : 1920, H = vert ? 1920 : 1080;
    var TI = 3, EN = 3.5, PER = 2.6, XF = 0.7, n = Math.max(3, Math.floor((L - TI - EN) / PER) + 1);
    var title = $('#hub-vtitle', sec).value.trim() || 'האירוע שלנו', sub = $('#hub-vsub', sec).value.trim(), endT = $('#hub-vend', sec).value.trim() || 'פריים מגנטים';
    var mus = $('#hub-vmus', sec).files[0];
    filming = true; $('#hub-vgo', sec).disabled = true;
    pickPhotos(n).then(function (list) {
      if (list.length < 3) throw new Error('צריך לפחות 3 תמונות');
      st('טוען ' + list.length + ' תמונות…');
      return Promise.all(list.map(function (p) { return FS.loadImg(p.src).then(prep, function () { return null; }); })).then(function (ims) {
        ims = ims.filter(Boolean); if (ims.length < 3) throw new Error('התמונות לא נטענו');
        return mus ? mus.arrayBuffer().then(function (b) { return { ims: ims, buf: b }; }) : { ims: ims };
      });
    }).then(function (o) { return record(o.ims, o.buf); }).then(function (out) {
      var url = URL.createObjectURL(out.blob), name = 'event-highlights-' + new Date().toISOString().slice(0, 10) + '.' + out.ext;
      $('#hub-vout', sec).innerHTML = '<video controls playsinline src="' + url + '"></video><div class="mt-row"><a class="mt-btn primary" download="' + name + '" href="' + url + '">⬇️ הורדת הסרטון</a><span class="mt-hint">' + (out.ext === 'mp4' ? 'MP4, מתאים לוואטסאפ ולרשתות' : 'WEBM. לוואטסאפ אפשר להמיר ל־MP4') + '</span></div>';
      st('✔ הסרטון מוכן'); if (window.FSDesktop && FSDesktop.notify) FSDesktop.notify('אופטימוס', 'סרטון הסיכום מוכן');
    }).catch(function (e) { FS.busy(); st(''); FS.toast('⚠️ ' + ((e && e.message) || 'הסרטון לא נוצר'), 6000); }).then(function () {
      filming = false; $('#hub-vgo', sec).disabled = false; $('#hub-vbar', sec).hidden = true;
    });
    function st(t) { $('#hub-vst', sec).textContent = t; }
    /* each photo once: a soft, dark copy of itself to fill the frame behind it */
    function prep(im) {
      var k = Math.max(W / im.naturalWidth, H / im.naturalHeight) / 8, c = FS.canvas(Math.ceil(im.naturalWidth * k), Math.ceil(im.naturalHeight * k)), x = c.getContext('2d');
      x.filter = 'blur(6px) brightness(.45) saturate(1.2)'; x.drawImage(im, 0, 0, c.width, c.height); return { im: im, bg: c };
    }
    function record(ims, buf) {
      var c = FS.canvas(W, H), x = c.getContext('2d'), T = TI + ims.length * PER + EN - XF, fps = 30;
      var stream = c.captureStream(fps), ac = null, src = null;
      var p0 = buf ? new AudioContext().decodeAudioData(buf.slice(0)).catch(function () { return null; }) : Promise.resolve(null);
      return p0.then(function (ab) {
        if (ab) {
          ac = new AudioContext(); var dst = ac.createMediaStreamDestination(), g = ac.createGain(); src = ac.createBufferSource(); src.buffer = ab; src.loop = true;
          g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(0.9, ac.currentTime + 1); g.gain.setValueAtTime(0.9, ac.currentTime + T - 2.5); g.gain.linearRampToValueAtTime(0, ac.currentTime + T);
          src.connect(g).connect(dst); dst.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
        }
        var mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'].filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0] || '';
        var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9e6 } : {}), parts = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
        var bar = $('#hub-vbar', sec); bar.hidden = false; st('מצלם את הסרטון… להשאיר את החלון פתוח');
        return new Promise(function (ok) {
          rec.onstop = function () { if (ac) ac.close(); ok({ blob: new Blob(parts, { type: mime || 'video/webm' }), ext: /mp4/.test(mime) ? 'mp4' : 'webm' }); };
          rec.start(1000); if (src) src.start();
          var t0 = performance.now();
          (function frame() {
            var t = (performance.now() - t0) / 1000;
            draw(x, ims, Math.min(t, T), T);
            bar.firstChild.style.width = Math.min(100, t / T * 100).toFixed(1) + '%';
            if (t >= T + 0.15) { rec.stop(); return; }
            requestAnimationFrame(frame);
          })();
        });
      });
    }
    function ease(v) { return v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v); }
    function draw(x, ims, t, T) {
      x.globalAlpha = 1; x.fillStyle = '#0F1528'; x.fillRect(0, 0, W, H);
      /* the photos: each from TI - XF + i*PER, PER + XF long, fading in over XF */
      for (var i = 0; i < ims.length; i++) {
        var s = TI - XF + i * PER, e = s + PER + XF; if (t < s || t > e + XF) continue;
        var a = ease((t - s) / XF); if (a <= 0) continue;
        var o = ims[i], im = o.im, u = (t - s) / (e - s), z = 1.04 + 0.08 * (i % 2 ? 1 - u : u), dx = (i % 3 - 1) * 0.02 * W * (u - 0.5);
        x.globalAlpha = a;
        var kb = Math.max(W / o.bg.width, H / o.bg.height); x.drawImage(o.bg, (W - o.bg.width * kb) / 2, (H - o.bg.height * kb) / 2, o.bg.width * kb, o.bg.height * kb);
        var k = Math.min(W * 0.9 / im.naturalWidth, H * 0.86 / im.naturalHeight) * z, w = im.naturalWidth * k, h = im.naturalHeight * k, px = (W - w) / 2 + dx, py = (H - h) / 2;
        x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 50; x.shadowOffsetY = 18;
        var bd = Math.round(Math.min(w, h) * 0.025); x.fillStyle = '#F8F7F4'; x.fillRect(px - bd, py - bd, w + bd * 2, h + bd * 2); x.restore();
        x.drawImage(im, px, py, w, h);
      }
      x.globalAlpha = 1;
      /* the title, then the end */
      var tin = ease(t / 0.9) * (1 - ease((t - TI + XF) / XF)), ein = ease((t - (T - EN)) / 0.8);
      if (tin > 0) card(x, tin, title, sub, 1 - tin);
      if (ein > 0) { x.globalAlpha = ein; x.fillStyle = '#0F1528'; x.fillRect(0, 0, W, H); card(x, ein, endT, title, 1 - ein); }
      x.globalAlpha = 1;
    }
    function card(x, a, big, small, off) {
      x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(15,21,40,' + (0.55 * a) + ')'; x.fillRect(0, 0, W, H);
      x.textAlign = 'center'; x.direction = 'rtl'; x.textBaseline = 'middle';
      var fs = Math.round(Math.min(W, H) * 0.095), y = H / 2 + off * 40;
      x.font = '700 ' + fs + 'px "Karantina","Frank Ruhl Libre",serif';
      var g = x.createLinearGradient(0, y - fs, 0, y + fs * 0.5); g.addColorStop(0, '#FCE6E9'); g.addColorStop(1, '#EDB6BE'); x.fillStyle = g;
      fit(x, big, W * 0.86, fs); x.fillText(big, W / 2, y - fs * 0.2);
      if (small) { x.font = '400 ' + Math.round(fs * 0.36) + 'px "Assistant","Heebo",sans-serif'; x.fillStyle = 'rgba(243,241,236,.85)'; x.fillText(small, W / 2, y + fs * 0.62); }
      x.fillStyle = '#EDB6BE'; x.fillRect(W / 2 - fs * 0.6 * a, y + fs * 1.05, fs * 1.2 * a, 3);
      x.restore();
    }
    function fit(x, s, max, fs) { var f = fs; while (x.measureText(s).width > max && f > 20) { f -= 4; x.font = x.font.replace(/\d+px/, f + 'px'); } }
  }

  /* ---------- ⌘ the command bar (Ctrl+K): every action by a word ---------- */
  function click(sel) { return function () { var b = $(sel); if (b) b.click(); }; }
  function go(v) { return function () { FS.mate.show(v); }; }
  function hubGo(p) { return function () { FS.mate.show('hub'); showPanel(p); }; }
  var CMDS = [
    ['🗂️ ראשי · כל התמונות', 'גריד בית', go('main')], ['🎚️ ערוך תמונה · תיקון צבע', 'עריכה צבע בהירות', go('edit')], ['🖌️ עורך מלא', 'עיצוב טקסט מסגרת', go('design')],
    ['🤖 AI · אפקטים וכלים', 'אפקטים סגנון בינה', go('ai')], ['🖨️ חלון ההדפסה', 'הדפסה מדפסת', go('print')], ['⚡ הדפסה מיידית', 'הדפס עכשיו מהר', click('#mt-qprint')],
    ['🧮 כמה להדפיס?', 'עותקים פנים המלצה', click('#mt [data-go="advise"]')], ['📂 הוספת תמונות', 'קבצים פתיחה', click('#mt-files')], ['📁 הוספת תיקייה', 'תיקיה', click('#mt-folder')],
    ['✔ סימון כל התמונות', 'בחירה הכל', click('#mt-all')],
    ['🚀 מרכז האירוע', 'האב', go('hub')], ['📡 קו אוטומטי מהמצלמה · תיקייה חמה', 'מצלמה אוטומטי', function () { hubGo('auto')(); $('#hub-pick', sec).click(); }],
    ['📈 לוח בקרה בזמן אמת', 'נייר דיו קצב רווח', hubGo('live')], ['🎬 סרטון סיכום של האירוע', 'וידאו קליפ', hubGo('after')], ['🎁 הצעת מוצרים לזוג בוואטסאפ', 'מכירה פרימיום', hubGo('after')],
    ['🖨️ המדפסת שלי · נייר ודיו', 'הגדרת מדפסת', function () { FS.printerSetup && FS.printerSetup(); }], ['📊 סיכום האירוע', 'דוח', function () { FS.printSummary && FS.printSummary(); }],
    ['🎨 סטודיו העיצוב המלא', 'סטודיו F2', function () { FS.mate.close(); }]
  ];
  var bar = document.createElement('div'); bar.id = 'cmdk'; bar.hidden = true; bar.setAttribute('dir', 'rtl');
  bar.innerHTML = '<div class="ck-box" role="dialog" aria-label="פקודות"><div class="ck-in"><span>⌘</span><input id="ck-q" placeholder="מה לעשות? למשל: הדפסה, סרטון, מדפסת…" autocomplete="off"><kbd>Esc</kbd></div><div class="ck-list" id="ck-list"></div><p class="ck-foot">↑↓ לבחירה · Enter לביצוע · Ctrl+K לפתיחה מכל מקום</p></div>';
  document.body.appendChild(bar);
  var hits = [], sel = 0;
  function norm(s) { return String(s).toLowerCase().replace(/[^֐-׿a-z0-9 ]/g, ' '); }
  function list() {
    var q = norm($('#ck-q').value).split(/\s+/).filter(Boolean);
    hits = CMDS.filter(function (c) { var h = norm(c[0] + ' ' + c[1]); return q.every(function (w) { return h.indexOf(w) >= 0; }); });
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    $('#ck-list').innerHTML = hits.length ? hits.map(function (c, i) { return '<button data-c="' + i + '" class="' + (i === sel ? 'on' : '') + '">' + esc(c[0]) + '</button>'; }).join('') : '<p class="ck-none">לא נמצא. נסו מילה אחרת.</p>';
  }
  function openBar() { if (document.body.classList.contains('gated')) return; if (!FS.mate.isOn()) FS.mate.open(); bar.hidden = false; $('#ck-q').value = ''; sel = 0; list(); setTimeout(function () { $('#ck-q').focus(); }, 0); }
  function closeBar() { bar.hidden = true; }
  function run(i) { var c = hits[i]; closeBar(); if (c) setTimeout(c[2], 0); }
  $('#ck-q').addEventListener('input', function () { sel = 0; list(); });
  $('#ck-q').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); list(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); list(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); } else if (e.key === 'Escape') { e.preventDefault(); closeBar(); }
  });
  $('#ck-list').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) run(Number(b.dataset.c)); });
  bar.addEventListener('mousedown', function (e) { if (e.target === bar) closeBar(); });
  /* on the window, before the page's own shortcuts (some of them stop the key) */
  window.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K' || e.key === 'ל')) { e.preventDefault(); e.stopPropagation(); if (bar.hidden) openBar(); else closeBar(); } }, true);
  var acts = $('.mt-acts', root); if (acts) acts.insertAdjacentHTML('afterbegin', '<button class="mt-btn mt-ckb" id="mt-ck" title="כל הפעולות בחיפוש אחד (Ctrl+K)"><span>⌘</span> פקודות <kbd>Ctrl K</kbd></button>');
  var ckb = $('#mt-ck', root); if (ckb) ckb.addEventListener('click', openBar);
  FS.hub = { show: hubGo, commands: openBar };
})();
