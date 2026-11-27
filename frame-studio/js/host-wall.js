/* 🎬 The event owners' screen (wall.html?host=1[&e=…&v=…]): the photos of the couple / the bar or bat mitzvah child run large
   as a slideshow, and every photo a guest sends through the QR comes into a strip at the bottom of the screen and travels
   along it (to the right by default) all evening long. A new guest photo goes ahead of the line and enters next, marked "חדש".
   The owners' photos are kept on this computer only (IndexedDB 'fs-host-wall'); they come from a file / folder picked here,
   or from the studio ("🎬 מסך בעלי השמחה" sends the marked photos with postMessage). The guests' photos come from the live
   event's feed (the viewing key in the link). Without the internet it keeps going with what it already has. */
(function () {
  'use strict';
  if (!/[?&]host=1/.test(location.search)) return;
  var L = window.FL, esc = L.esc, EV = L.e || '_', hasFeed = !!(L.e && L.v);
  var KS = 'fs-hostwall', KT = 'fs-hostwall-title-' + EV;
  var cfg = Object.assign({ sec: 7, order: 'seq', strip: 26, speed: 'mid', dir: 'right', names: true, studio: false, qr: true, title: true }, read(KS));
  var title = read(KT).t || '';
  var SPEED = { slow: 0.16, mid: 0.28, fast: 0.42 };   /* strip heights per second */
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function keep() { try { localStorage.setItem(KS, JSON.stringify(cfg)); localStorage.setItem(KT, JSON.stringify({ t: title })); } catch (e) { /* private mode */ } }
  function $(s, r) { return (r || document).querySelector(s); }

  /* ---------- storage of the owners' photos (this computer only) ---------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, no) {
      try { var q = indexedDB.open('fs-host-wall', 1); q.onupgradeneeded = function () { q.result.createObjectStore('p', { keyPath: 'id' }); }; q.onsuccess = function () { ok(q.result); }; q.onerror = function () { no(q.error); }; } catch (e) { no(e); }
    });
    return dbp;
  }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction('p', mode), s = t.objectStore('p'), r = fn(s); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { no(t.error); }; }); }); }
  function listPhotos() { return tx('readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).filter(function (x) { return x.ev === EV; }).sort(function (a, b) { return a.n - b.n; }); }).catch(function () { return []; }); }
  function putPhoto(o) { return tx('readwrite', function (s) { return s.put(o); }); }
  function delPhoto(id) { return tx('readwrite', function (s) { return s.delete(id); }); }

  /* a photo shrunk to the screen's needs (2560 px, JPEG) */
  function shrink(blob) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 2560 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? ok(b) : no(new Error('encode')); }, 'image/jpeg', 0.9);
      };
      im.onerror = function () { URL.revokeObjectURL(u); no(new Error('decode')); };
      im.src = u;
    });
  }
  var adding = Promise.resolve();
  function addBlobs(items) {   /* items: [{blob, name}] */
    adding = adding.then(function () {
      return listPhotos().then(function (have) {
        var names = {}, n = have.reduce(function (m, x) { names[x.name] = 1; return Math.max(m, x.n); }, 0), done = 0, bad = 0;
        var list = items.filter(function (it) { return it.blob && /^image\//.test(it.blob.type || 'image/') && !names[it.name]; });
        if (!list.length) return 0;
        toast('⏳ מוסיפים ' + list.length + ' תמונות…', 60000);
        return list.reduce(function (p, it) {
          return p.then(function () { return shrink(it.blob); }).then(function (b) {
            names[it.name] = 1; done++;
            return putPhoto({ id: EV + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ev: EV, n: ++n, name: it.name, blob: b, at: Date.now() });
          }).catch(function () { bad++; });
        }, Promise.resolve()).then(function () { toast('✔ נוספו ' + done + ' תמונות' + (bad ? ' · ' + bad + ' לא נפתחו' : ''), 3500); return done; });
      });
    }).then(function (d) { return loadMain().then(function () { if (setDlg.open) drawSet(); return d; }); });
    return adding;
  }

  /* ---------- the screen ---------- */
  document.body.classList.add('host');
  var root = document.createElement('div'); root.className = 'hw'; root.id = 'hw';
  root.innerHTML = '<div class="hw-main" id="hw-main"></div>' +
    '<header class="hw-title" id="hw-title"><p class="hw-biz" id="hw-biz"></p><h1 id="hw-t"></h1></header>' +
    '<section class="hw-strip" id="hw-strip" aria-label="התמונות שהאורחים שולחים"><div class="hw-track" id="hw-track"></div>' +
      '<aside class="hw-qr" id="hw-qr" hidden><canvas id="hw-qrc" aria-hidden="true"></canvas><p><b>צלמו ושלחו</b><br>ותופיעו כאן 📸</p></aside>' +
      '<p class="hw-empty" id="hw-sempty"></p><span class="hw-cnt" id="hw-cnt"></span></section>' +
    '<div class="hw-ctl" id="hw-ctl"><button type="button" id="hw-set-b" title="הגדרות (S)">⚙️ הגדרות</button><button type="button" id="hw-pause" title="עצירה / המשך (רווח)">❚❚</button><button type="button" id="hw-full" title="מסך מלא (F)">⛶</button></div>';
  document.body.appendChild(root);
  var main = $('#hw-main'), track = $('#hw-track'), strip = $('#hw-strip');
  var setDlg = document.createElement('dialog'); setDlg.className = 'hw-set'; setDlg.id = 'hw-set'; document.body.appendChild(setDlg);
  var toastEl = document.getElementById('toast');
  function toast(t, ms) { if (L.toast) L.toast(t, ms); else if (toastEl) toastEl.textContent = t; }
  function applyCfg() {
    root.style.setProperty('--strip', cfg.strip === 0 ? '0vh' : Math.max(14, Math.min(40, cfg.strip)) + 'vh');
    root.classList.toggle('no-strip', cfg.strip === 0);
    root.classList.toggle('dir-left', cfg.dir === 'left');
    root.classList.toggle('no-names', !cfg.names);
    $('#hw-title').hidden = !cfg.title || !($('#hw-t').textContent);
    root.classList.toggle('has-title', !$('#hw-title').hidden);
    $('#hw-qr').hidden = !cfg.qr || !qrReady;
  }

  /* ---------- the owners' slideshow ---------- */
  var slides = [], si = -1, sTimer = 0, cur = null, paused = false, urls = [], remote = [];   /* remote: the owners' photos the studio put on the server */
  var FX = ['fx-fade', 'fx-zoom', 'fx-slide', 'fx-rise'];   /* no blur: a filter on a big moving layer goes blank on weak graphics */
  function loadMain() {
    return listPhotos().then(function (a) {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      urls = []; slides = (cfg.local === false ? [] : a).map(function (x) { var u = URL.createObjectURL(x.blob); urls.push(u); return { id: x.id, src: u }; });
      return L.base.then(function (b) { remote.forEach(function (id) { slides.push({ id: 'o:' + id, src: b + '/frame-live-img?e=' + L.e + '&p=' + id + '&v=' + L.v + '&o=1' }); }); });
    }).then(function () {
      if (cfg.order === 'mix') for (var i = slides.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = slides[i]; slides[i] = slides[j]; slides[j] = t; }
      si = -1; restart();
    });
  }
  function restart() {
    clearInterval(sTimer); sTimer = 0;
    if (!slides.length) return emptyMain();
    nextSlide(1); if (!paused) sTimer = setInterval(function () { nextSlide(1); }, Math.max(3, cfg.sec) * 1000);
  }
  function emptyMain() {
    main.innerHTML = '<div class="hw-none"><p class="hw-none-t">🎬 כאן ירוצו התמונות של בעלי השמחה</p><p>החתן והכלה, בר או בת המצווה: מוסיפים את התמונות שלהם, והן ירוצו כאן בגדול כל האירוע.</p>' +
      '<div class="hw-none-b"><button type="button" class="hw-btn gold" data-add="files">➕ הוספת תמונות</button><button type="button" class="hw-btn" data-add="dir">📁 תיקייה שלמה</button></div>' +
      '<p class="hw-none-s">או מאופטימוס: מסמנים את התמונות ← ״🎉 אירוע חי״ ← ״📺 שליטה במסך״ ← ״שליחת המסומנות למסך״.</p></div>';
    cur = null;
  }
  function nextSlide(step) {
    if (!slides.length) return;
    si = (si + step + slides.length) % slides.length;
    var s = slides[si], fx = FX[Math.floor(Math.random() * FX.length)], el = document.createElement('div');
    el.className = 'hw-slide ' + fx;
    el.innerHTML = '<div class="hw-bg" style="background-image:url(\'' + s.src + '\')"></div><img class="hw-img kb' + (Math.random() < 0.5 ? ' kb2' : '') + '" src="' + s.src + '" alt="">';
    el.querySelector('.hw-img').style.animationDuration = (Math.max(3, cfg.sec) + 2) + 's';
    var none = main.querySelector('.hw-none'); if (none) none.remove();
    main.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
    var old = cur; cur = el;
    if (old) { old.classList.add('out'); setTimeout(function () { old.remove(); }, 1600); }
    Array.prototype.slice.call(main.querySelectorAll('.hw-slide'), 0, -2).forEach(function (x) { x.remove(); });
    if (slides.length > 1) { var nx = new Image(); nx.src = slides[(si + 1) % slides.length].src; }
  }

  /* ---------- the guests' strip ---------- */
  var items = {}, vis = [], loopQ = [], newQ = [], last = 0, since = 0, total = 0, qrReady = false;
  function H() { return track.clientHeight || 200; }
  function W() { return track.clientWidth || 1000; }
  function gap() { return Math.round(H() * 0.12); }
  function want(p) { return p.src === 'guest' || (cfg.studio && p.src === 'studio'); }
  function addGuest(p, isNew) {
    if (items[p.id] || !want(p)) return;
    var it = items[p.id] = { p: p, w: 0, x: 0, el: null, ok: false, isNew: isNew };
    L.img(p.id).then(function (src) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        it.src = src; it.ar = Math.max(0.5, Math.min(2.2, im.naturalWidth / im.naturalHeight)); it.ok = true;
        total++; count();
        (isNew ? newQ : loopQ).push(it);
        if (isNew) toast('📸 תמונה חדשה' + (p.name ? ' מ' + p.name : '') + ' בדרך לפס', 3000);
      };
      im.onerror = function () { delete items[p.id]; };   /* hidden by the studio, or gone */
      im.src = src;
    });
  }
  function count() {
    $('#hw-cnt').textContent = total ? '📸 ' + total + ' תמונות מהאורחים' : '';
    var e = $('#hw-sempty');
    e.textContent = total ? '' : hasFeed ? '📸 התמונות שהאורחים שולחים בקוד ה־QR יופיעו כאן' : 'פותחים את המסך מהסטודיו (🎉 אירוע חי ← 🎬 מסך בעלי השמחה) כדי לראות כאן את תמונות האורחים';
  }
  function makeEl(it) {
    var h = H() - Math.round(H() * 0.14), el = document.createElement('figure');
    it.w = Math.round(h * it.ar);
    el.className = 'hw-it' + (it.isNew ? ' new' : '');
    el.style.width = it.w + 'px';
    el.innerHTML = '<img src="' + it.src + '" alt="">' + (it.p.name ? '<figcaption>' + esc(it.p.name) + '</figcaption>' : '') + (it.isNew ? '<span class="hw-newb">✨ חדש</span>' : '');
    if (it.isNew) setTimeout(function () { el.classList.remove('new'); var b = el.querySelector('.hw-newb'); if (b) b.remove(); it.isNew = false; }, 30000);
    track.appendChild(el); it.el = el;
  }
  function place(it) { var x = cfg.dir === 'left' ? W() - it.x - it.w : it.x; it.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'; }
  function frame(t) {
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    var v = paused ? 0 : SPEED[cfg.speed] * H(), w = W(), g = gap();
    for (var i = vis.length - 1; i >= 0; i--) {
      var it = vis[i]; it.x += v * dt;
      if (it.x > w + 4) { it.el.remove(); it.el = null; vis.splice(i, 1); loopQ.push(it); }
    }
    var lead = vis.length ? vis.reduce(function (m, x) { return Math.min(m, x.x); }, Infinity) : w + g;
    var guard = 0;
    while (lead >= g && guard++ < 6) {   /* room at the entry: the next photo comes in (new ones first) */
      var nx = newQ.shift() || loopQ.shift(); if (!nx) break;
      makeEl(nx); nx.x = (vis.length ? lead - g : 0) - nx.w; vis.push(nx); lead = nx.x;
      if (nx.isNew) nx.el.classList.add('pop');
    }
    vis.forEach(place);
    requestAnimationFrame(frame);
  }
  function relayout() { vis.forEach(function (it) { var x = it.x; it.el.remove(); makeEl(it); it.x = x; }); }

  /* the event's feed: the title, the QR for the guests, and the photos */
  var firstFeed = true;
  function poll() {
    if (!hasFeed) return Promise.resolve();
    return L.call({ action: 'feed', e: L.e, v: L.v, since: since }).then(function (r) {
      if (!r || !r.ok) { if (firstFeed && r && r.error !== 'offline') toast(L.msg(r), 6000); return; }
      $('#hw-t').dataset.ev = r.title || '';
      if (!title && !remoteTitle && r.title) { $('#hw-t').textContent = r.title; document.title = r.title + ' · מסך בעלי השמחה'; applyCfg(); }
      $('#hw-biz').textContent = r.biz && r.biz.name ? r.biz.name : '';
      if (firstFeed) qr(r.k);
      (r.photos || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (p) { since = Math.max(since, p.at || 0); addGuest(p, !firstFeed); });
      firstFeed = false; count();
    });
  }
  function qr(k) {
    if (!k) return;
    L.qr(L.site('live.html?e=' + L.e + '&k=' + k), 360).then(function (c) { var t = $('#hw-qrc'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); qrReady = true; applyCfg(); }).catch(function () {});
  }

  /* ---------- settings ---------- */
  function drawSet() {
    listPhotos().then(function (a) {
      setDlg.innerHTML = '<form method="dialog" class="hw-sf"><header><h2>⚙️ מסך בעלי השמחה</h2><button class="hw-x" value="x" aria-label="סגירה">✕</button></header>' +
        '<section><h3>🎬 התמונות של בעלי השמחה <small>(' + a.length + ')</small></h3><div class="hw-row"><button type="button" class="hw-btn gold" data-add="files">➕ הוספת תמונות</button><button type="button" class="hw-btn" data-add="dir">📁 תיקייה שלמה</button>' + (a.length ? '<button type="button" class="hw-btn" id="hw-clear">🗑 למחוק את כולן</button>' : '') + '</div>' +
        '<div class="hw-thumbs">' + a.map(function (x) { return '<figure data-id="' + esc(x.id) + '"><img alt="" data-blob="' + esc(x.id) + '"><button type="button" data-del="' + esc(x.id) + '" aria-label="הסרה">✕</button></figure>'; }).join('') + '</div>' +
        '<p class="hw-note">התמונות נשמרות רק במחשב הזה, לא באינטרנט.</p></section>' +
        '<section><h3>🖼️ התצוגה</h3><label>כותרת על המסך<input type="text" id="hw-ft" maxlength="80" placeholder="שם האירוע, למשל: מזל טוב נועה ודניאל" value="' + esc(title) + '"></label>' +
        '<label class="hw-ck"><input type="checkbox" id="hw-ftt"' + (cfg.title ? ' checked' : '') + '> להציג את הכותרת</label>' +
        '<label>שניות לכל תמונה: <b id="hw-secv">' + cfg.sec + '</b><input type="range" id="hw-sec" min="3" max="20" value="' + cfg.sec + '"></label>' +
        '<label>סדר<select id="hw-ord"><option value="seq"' + (cfg.order === 'seq' ? ' selected' : '') + '>לפי הסדר</option><option value="mix"' + (cfg.order === 'mix' ? ' selected' : '') + '>מעורבב</option></select></label></section>' +
        '<section><h3>📸 הפס של האורחים</h3><label>גובה הפס: <b id="hw-stv">' + cfg.strip + '%</b><input type="range" id="hw-st" min="16" max="38" value="' + cfg.strip + '"></label>' +
        '<label>מהירות<select id="hw-sp"><option value="slow"' + (cfg.speed === 'slow' ? ' selected' : '') + '>איטית</option><option value="mid"' + (cfg.speed === 'mid' ? ' selected' : '') + '>רגילה</option><option value="fast"' + (cfg.speed === 'fast' ? ' selected' : '') + '>מהירה</option></select></label>' +
        '<label>כיוון<select id="hw-dir"><option value="right"' + (cfg.dir === 'right' ? ' selected' : '') + '>זזות ימינה ➡️</option><option value="left"' + (cfg.dir === 'left' ? ' selected' : '') + '>⬅️ זזות שמאלה</option></select></label>' +
        '<label class="hw-ck"><input type="checkbox" id="hw-nm"' + (cfg.names ? ' checked' : '') + '> שם השולח מתחת לתמונה</label>' +
        '<label class="hw-ck"><input type="checkbox" id="hw-qrk"' + (cfg.qr ? ' checked' : '') + '> קוד QR בקצה הפס (התמונות יוצאות ממנו)</label>' +
        '<label class="hw-ck"><input type="checkbox" id="hw-sd"' + (cfg.studio ? ' checked' : '') + '> גם המגנטים שהודפסו בעמדה</label>' +
        (hasFeed ? '' : '<p class="hw-note">⚠️ המסך נפתח בלי אירוע חי, ולכן אין בו תמונות אורחים. פותחים אותו מהסטודיו: 🎉 אירוע חי ← 🎬 מסך בעלי השמחה.</p>') + '</section>' +
        '<p class="hw-keys">מקשים: רווח עצירה · ← → תמונה הבאה/הקודמת · F מסך מלא · S הגדרות</p></form>';
      a.forEach(function (x) { var im = setDlg.querySelector('img[data-blob="' + CSS.escape(x.id) + '"]'); if (im) { var u = URL.createObjectURL(x.blob); im.onload = function () { URL.revokeObjectURL(u); }; im.src = u; } });
      var on = function (id, ev, fn) { var el = setDlg.querySelector(id); if (el) el.addEventListener(ev, fn); };
      on('#hw-ft', 'input', function () { title = this.value.trim(); $('#hw-t').textContent = title || $('#hw-t').dataset.ev || ''; keep(); applyCfg(); });
      on('#hw-ftt', 'change', function () { cfg.title = this.checked; keep(); applyCfg(); });
      on('#hw-sec', 'input', function () { cfg.sec = +this.value; setDlg.querySelector('#hw-secv').textContent = cfg.sec; keep(); });
      on('#hw-sec', 'change', restart);
      on('#hw-ord', 'change', function () { cfg.order = this.value; keep(); loadMain(); });
      on('#hw-st', 'input', function () { cfg.strip = +this.value; setDlg.querySelector('#hw-stv').textContent = cfg.strip + '%'; keep(); applyCfg(); relayout(); });
      on('#hw-sp', 'change', function () { cfg.speed = this.value; keep(); });
      on('#hw-dir', 'change', function () { cfg.dir = this.value; keep(); applyCfg(); });
      on('#hw-nm', 'change', function () { cfg.names = this.checked; keep(); applyCfg(); });
      on('#hw-qrk', 'change', function () { cfg.qr = this.checked; keep(); applyCfg(); });
      on('#hw-sd', 'change', function () { cfg.studio = this.checked; keep(); since = 0; firstFeed = true; poll(); });
      on('#hw-clear', 'click', function () { if (!confirm('למחוק את כל התמונות של בעלי השמחה מהמסך?')) return; Promise.all(a.map(function (x) { return delPhoto(x.id); })).then(loadMain).then(drawSet); });
      Array.prototype.forEach.call(setDlg.querySelectorAll('[data-del]'), function (b) { b.addEventListener('click', function () { delPhoto(b.dataset.del).then(loadMain).then(drawSet); }); });
    });
  }
  function openSet() { drawSet(); if (!setDlg.open) setDlg.showModal(); }

  /* picking files / a folder */
  var pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.multiple = true; pick.hidden = true; document.body.appendChild(pick);
  pick.addEventListener('change', function () {
    var fs = Array.prototype.filter.call(pick.files || [], function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name); })
      .sort(function (a, b) { return (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'he', { numeric: true }); });
    if (fs.length) addBlobs(fs.map(function (f) { return { blob: f, name: (f.webkitRelativePath || f.name) + ':' + f.size }; })); else toast('לא נמצאו תמונות');
    pick.value = '';
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-add]'); if (!b) return;
    if (b.dataset.add === 'dir') pick.setAttribute('webkitdirectory', ''); else pick.removeAttribute('webkitdirectory');
    pick.click();
  });
  /* drop photos anywhere on the screen */
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault(); var fs = Array.prototype.filter.call(e.dataTransfer.files || [], function (f) { return /^image\//.test(f.type); });
    if (fs.length) addBlobs(fs.map(function (f) { return { blob: f, name: f.name + ':' + f.size }; }));
  });
  /* the studio sends the marked photos (it opened this window) */
  var gotBatch = {};
  window.addEventListener('message', function (e) {
    if (!window.opener || e.source !== window.opener) return;
    var d = e.data || {}; if (!d.hostPhotos || gotBatch[d.batch]) return;
    gotBatch[d.batch] = 1;
    if (d.title && !title) { title = String(d.title).slice(0, 80); $('#hw-t').textContent = title; keep(); applyCfg(); }
    addBlobs((d.hostPhotos || []).filter(function (x) { return x && x.blob instanceof Blob; }).map(function (x) { return { blob: x.blob, name: String(x.name || '') }; }));
    try { e.source.postMessage({ hostGot: d.batch }, '*'); } catch (er) { /* closed */ }
  });
  if (window.opener) try { window.opener.postMessage({ hostReady: 1 }, '*'); } catch (e) { /* closed */ }

  /* ---------- controls ---------- */
  function setPaused(v) {
    paused = v; $('#hw-pause').textContent = paused ? '▶' : '❚❚';
    root.classList.toggle('paused', paused);
    clearInterval(sTimer); sTimer = 0; if (!paused && slides.length) sTimer = setInterval(function () { nextSlide(1); }, Math.max(3, cfg.sec) * 1000);
  }
  function full() { var d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(function () {}); }
  $('#hw-set-b').addEventListener('click', openSet);
  $('#hw-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#hw-full').addEventListener('click', full);
  document.addEventListener('keydown', function (e) {
    if (setDlg.open || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    var k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); setPaused(!paused); }   /* Enter = the TV remote's OK */
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { if (slides.length) { nextSlide(k === 'ArrowLeft' ? 1 : -1); setPaused(paused); } }
    else if (/^[fFכ]$/.test(k)) full();
    else if (/^[sSד]$/.test(k)) openSet();
  });
  var idle; function wake() { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(function () { document.body.classList.add('idle'); }, 3500); }
  document.addEventListener('mousemove', wake); document.addEventListener('touchstart', wake, { passive: true }); wake();
  /* the screen does not go to sleep during the event */
  var lock = null; function wakeLock() { if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {}); }
  document.addEventListener('visibilitychange', wakeLock); wakeLock();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relayout, 200); });

  /* ---------- 📺 run from the studio (tv-remote.js) ---------- */
  var say = document.createElement('div'); say.className = 'hw-say'; say.hidden = true; root.appendChild(say);
  var big = document.createElement('div'); big.className = 'hw-big'; big.hidden = true; root.appendChild(big);
  var sayT = 0, bigT = 0, remoteTitle = '';
  function showSay(text, sec) { clearTimeout(sayT); say.innerHTML = '<p>' + esc(text) + '</p>'; say.hidden = false; requestAnimationFrame(function () { say.classList.add('on'); }); sayT = setTimeout(hideSay, sec * 1000); }
  function hideSay() { clearTimeout(sayT); say.classList.remove('on'); setTimeout(function () { if (!say.classList.contains('on')) say.hidden = true; }, 700); }
  function showBig(p, sec) {
    var it = items[p]; if (!it || !it.src) return;
    clearTimeout(bigT); big.innerHTML = '<div class="hw-bg" style="background-image:url(\'' + it.src + '\')"></div><img src="' + it.src + '" alt="">' + (it.p.name || it.p.text ? '<p>' + (it.p.text ? '“' + esc(it.p.text) + '” ' : '') + (it.p.name ? '<b>' + esc(it.p.name) + '</b>' : '') + '</p>' : '');
    big.hidden = false; requestAnimationFrame(function () { big.classList.add('on'); });
    bigT = setTimeout(function () { big.classList.remove('on'); setTimeout(function () { big.hidden = true; }, 800); }, sec * 1000);
  }
  if (window.FLTV) window.FLTV.on(function (r, cmd, only) {
    if (only) return runCmd(cmd);
    var S = r.set || {}, old = JSON.stringify([cfg.sec, cfg.order, cfg.local]), oldStudio = cfg.studio;
    ['sec', 'order', 'strip', 'speed', 'dir', 'names', 'qr', 'studio', 'title', 'local'].forEach(function (k) { if (k in S) cfg[k] = S[k]; });
    remoteTitle = S.text || '';
    if (remoteTitle) { $('#hw-t').textContent = remoteTitle; } else if (!title) $('#hw-t').textContent = $('#hw-t').dataset.ev || '';
    keep(); applyCfg(); relayout();
    if (oldStudio !== cfg.studio && cfg.studio) { since = 0; firstFeed = true; poll(); }
    if ('paused' in S && !!S.paused !== paused) setPaused(!!S.paused);
    var ids = (r.owners || []).join(','), changed = ids !== remote.join(',');
    remote = r.owners || [];
    if (changed || old !== JSON.stringify([cfg.sec, cfg.order, cfg.local])) loadMain();
  });
  function runCmd(cmd) {
    if (cmd.c === 'next' || cmd.c === 'prev') { if (slides.length) { nextSlide(cmd.c === 'next' ? 1 : -1); setPaused(paused); } }
    else if (cmd.c === 'say' && cmd.text) showSay(cmd.text, cmd.sec || 15);
    else if (cmd.c === 'unsay') hideSay();
    else if (cmd.c === 'show' && cmd.p) showBig(cmd.p, cmd.sec || 12);
  }

  $('#hw-t').textContent = title; document.title = (title || 'מסך בעלי השמחה') + ' · פריים מגנטים';
  applyCfg(); count();
  loadMain();
  poll().then(function () { if (hasFeed) setInterval(poll, 5000); });
  requestAnimationFrame(frame);
  window.FSHost = { add: addBlobs, list: listPhotos, cfg: cfg, state: function () { return { slides: slides.length, guests: total, vis: vis.length, queued: loopQ.length + newQ.length }; } };
})();
