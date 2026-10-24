/* The website's events library: finished magnets go to frame-studio/library/<album>/ in the repository with one commit
   (GitHub git-data API, the owner's own token kept only in this browser), and library/library.json lists the albums.
   The public site shows them under "אירועים". Without a token, albums are kept in this browser only. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var REPO = 'devopsdevopshaim-wq/devops-hub', DIR = 'frame-studio/library/', TOKEN = 'fs-gh-token';
  function token() { try { return localStorage.getItem(TOKEN) || ''; } catch (e) { return ''; } }
  function gh(path, opts) {
    opts = opts || {};
    return fetch('https://api.github.com/repos/' + REPO + path, { method: opts.method || 'GET', headers: { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { if (r.status === 404 && opts.allow404) return null; if (!r.ok) return r.text().then(function (t) { var e = new Error('gh-' + r.status); e.detail = t; throw e; }); return r.json(); });
  }
  function b64utf8(s) { return btoa(unescape(encodeURIComponent(s))); }
  function slug(t) { var s = String(t || '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); return (s || 'event') + '-' + Date.now().toString(36); }
  function readLibrary() {
    return gh('/contents/' + DIR + 'library.json?ref=main', { allow404: true }).then(function (r) {
      if (!r) return [];
      try { return JSON.parse(decodeURIComponent(escape(atob(r.content.replace(/\s/g, ''))))); } catch (e) { return []; }
    });
  }
  /* one commit with any number of file changes: [{path, b64}] adds, [{path, del:true}] removes */
  function commit(changes, message) {
    var base;
    return gh('/git/ref/heads/main').then(function (ref) { base = ref.object.sha; return gh('/git/commits/' + base); }).then(function (c) {
      return Promise.all(changes.map(function (ch) {
        if (ch.del) return Promise.resolve({ path: ch.path, mode: '100644', type: 'blob', sha: null });
        return gh('/git/blobs', { method: 'POST', body: { content: ch.b64, encoding: 'base64' } }).then(function (b) { return { path: ch.path, mode: '100644', type: 'blob', sha: b.sha }; });
      })).then(function (tree) { return gh('/git/trees', { method: 'POST', body: { base_tree: c.tree.sha, tree: tree } }); });
    }).then(function (t) { return gh('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [base] } }); })
      .then(function (nc) { return gh('/git/refs/heads/main', { method: 'PATCH', body: { sha: nc.sha } }); });
  }
  function render(p) {
    var k = Math.min(1, 1400 / Math.max(p.doc.w, p.doc.h)), c = FS.renderFull(p, k, false);
    return { b64: c.toDataURL('image/jpeg', 0.86).split(',')[1], w: c.width, h: c.height };
  }
  function eventInfo() {
    var o = FS.prefs.event || {}, ev = FS.event(o.type || 'wedding');
    return { title: $('#lib-title').value.trim() || o.names || ev.name, type: ev.id, date: o.date || '' };
  }

  /* ---------- publish ---------- */
  $('#lib-publish').addEventListener('click', function () {
    var list = FS.marked().length ? FS.marked() : FS.cur() ? [FS.cur()] : []; if (!list.length) return FS.toast('בוחרים תמונות קודם');
    var info = eventInfo();
    if (!token()) { saveLocal(list, info); return; }
    if (!confirm('לפרסם ' + list.length + ' תמונות בספריית האירועים באתר, תחת "' + info.title + '"?\nהאתר הוא ציבורי, אז מפרסמים רק תמונות שיש אישור לפרסם.')) return;
    FS.busy('מכין ' + list.length + ' תמונות…');
    document.fonts.ready.then(function () {
      var dir = slug(info.title), files = [], images = [];
      list.forEach(function (p, i) { var r = render(p), path = DIR + dir + '/' + (i + 1) + '.jpg'; files.push({ path: path, b64: r.b64 }); images.push({ src: 'library/' + dir + '/' + (i + 1) + '.jpg', w: r.w, h: r.h }); });
      FS.busy('מעלה לאתר…');
      return readLibrary().then(function (lib) {
        lib.unshift({ id: dir, title: info.title, type: info.type, date: info.date, cover: images[0].src, images: images, at: new Date().toISOString() });
        files.push({ path: DIR + 'library.json', b64: b64utf8(JSON.stringify(lib, null, 1) + '\n') });
        return commit(files, 'frame-studio library: ' + info.title + ' (' + images.length + ' photos)');
      });
    }).then(function () { FS.busy(); FS.toast('📚 פורסם! האלבום יופיע בלשונית "אירועים" באתר תוך כשתי דקות.', 6000); })
      .catch(function (e) { FS.busy(); FS.toast(/401|403/.test(e.message) ? 'מפתח GitHub לא תקין או בלי הרשאת כתיבה. בודקים בהגדרות החיבור.' : 'הפרסום לא הצליח (' + e.message + '). התמונות נשמרו בספרייה המקומית.', 7000); saveLocal(list, info, true); });
  });
  function saveLocal(list, info, quiet) {
    var images = list.map(function (p) { var r = render(p); return { src: 'data:image/jpeg;base64,' + r.b64, w: r.w, h: r.h }; });
    FS.store.put('designs', { id: 'lib' + FS.uid(), lib: true, name: info.title, type: info.type, date: info.date, at: Date.now(), thumb: images[0].src, images: images })
      .then(function () { if (!quiet) FS.toast('📚 נשמר בספרייה המקומית בדפדפן הזה. לפרסום באתר לכולם מגדירים חיבור GitHub.', 6000); });
  }

  /* ---------- manage ---------- */
  $('#lib-manage').addEventListener('click', function manage() {
    var body = FS.dialog('📚 ספריית האירועים', '<p class="hint">טוען…</p>', true);
    Promise.all([token() ? readLibrary().catch(function () { return null; }) : Promise.resolve(null), FS.store.all('designs').catch(function () { return []; })]).then(function (r) {
      var pub = r[0], local = (r[1] || []).filter(function (d) { return d.lib; });
      var h = '<h3>באתר</h3>' + (pub === null ? '<p class="hint">' + (token() ? 'לא הצלחתי לקרוא את הספרייה מ־GitHub.' : 'אין חיבור GitHub, אז אין פרסום לאתר. מגדירים אותו בכפתור "חיבור לאתר".') + '</p>' :
        pub.length ? '<ul class="ev-list">' + pub.map(function (a) { return '<li><span>' + FS.event(a.type).icon + ' <b>' + FS.esc(a.title) + '</b> <small>' + a.images.length + ' תמונות · ' + FS.fmtDate(a.date) + '</small></span><button class="btn small" data-qr="' + FS.esc(a.id) + '">📱 QR לאורחים</button><button class="btn small danger" data-pdel="' + FS.esc(a.id) + '">הסרה מהאתר</button></li>'; }).join('') + '</ul>' : '<p class="empty">עדיין אין אלבומים באתר.</p>');
      h += '<h3>בדפדפן הזה בלבד</h3>' + (local.length ? '<div class="designs">' + local.map(function (d) { return '<figure data-id="' + d.id + '"><img src="' + d.thumb + '" alt=""><figcaption><b>' + FS.esc(d.name) + '</b><small>' + d.images.length + ' תמונות</small></figcaption><div>' + (token() ? '<button class="btn small primary" data-lpub>פרסום לאתר</button>' : '') + '<button class="btn small danger" data-ldel>מחיקה</button></div></figure>'; }).join('') + '</div>' : '<p class="empty">אין.</p>');
      body.innerHTML = h;
      $$('[data-qr]', body).forEach(function (b) { b.addEventListener('click', function () { if (FS.guestSign) FS.guestSign(pub.filter(function (x) { return x.id === b.dataset.qr; })[0]); }); });
      $$('[data-pdel]', body).forEach(function (b) { b.addEventListener('click', function () {
        var a = pub.filter(function (x) { return x.id === b.dataset.pdel; })[0]; if (!confirm('להסיר את "' + a.title + '" מהאתר?')) return;
        FS.busy('מסיר…');
        var rest = pub.filter(function (x) { return x !== a; }), ch = a.images.map(function (im) { return { path: 'frame-studio/' + im.src, del: true }; });
        ch.push({ path: DIR + 'library.json', b64: b64utf8(JSON.stringify(rest, null, 1) + '\n') });
        commit(ch, 'frame-studio library: remove ' + a.title).then(function () { FS.busy(); FS.toast('הוסר. האתר יתעדכן תוך כשתי דקות.'); manage(); }).catch(function () { FS.busy(); FS.toast('ההסרה לא הצליחה'); });
      }); });
      $$('figure', body).forEach(function (f) {
        var d = local.filter(function (x) { return x.id === f.dataset.id; })[0];
        $('[data-ldel]', f).addEventListener('click', function () { FS.store.del('designs', d.id).then(manage); });
        var pb = $('[data-lpub]', f); if (pb) pb.addEventListener('click', function () {
          FS.busy('מעלה…'); var dir = slug(d.name), files = [], images = [];
          d.images.forEach(function (im, i) { var path = DIR + dir + '/' + (i + 1) + '.jpg'; files.push({ path: path, b64: im.src.split(',')[1] }); images.push({ src: 'library/' + dir + '/' + (i + 1) + '.jpg', w: im.w, h: im.h }); });
          readLibrary().then(function (lib) { lib.unshift({ id: dir, title: d.name, type: d.type, date: d.date, cover: images[0].src, images: images, at: new Date().toISOString() }); files.push({ path: DIR + 'library.json', b64: b64utf8(JSON.stringify(lib, null, 1) + '\n') }); return commit(files, 'frame-studio library: ' + d.name); })
            .then(function () { return FS.store.del('designs', d.id); }).then(function () { FS.busy(); FS.toast('📚 פורסם לאתר'); manage(); }).catch(function () { FS.busy(); FS.toast('הפרסום לא הצליח'); });
        });
      });
    });
  });
  $('#lib-token').addEventListener('click', function () {
    var body = FS.dialog('🔑 חיבור לאתר (GitHub)', '<p class="hint">כדי שהאלבומים יופיעו באתר לכולם, הסטודיו שומר אותם במאגר של האתר ב־GitHub. צריך מפתח אישי (Fine-grained token) עם הרשאה אחת: <b>Contents: Read and write</b> למאגר <code>devops-hub</code> בלבד. יוצרים אותו ב־<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a>.</p><p class="hint">המפתח נשמר רק בדפדפן הזה, ולא נשלח לשום מקום חוץ מ־GitHub.</p><div class="field"><label>המפתח</label><input id="tok" type="password" autocomplete="off" value="' + FS.esc(token()) + '"></div><div class="row2"><button class="btn primary" id="tok-save">שמירה</button><button class="btn danger" id="tok-del">מחיקה מהדפדפן</button></div>');
    $('#tok-save', body).addEventListener('click', function () { try { localStorage.setItem(TOKEN, $('#tok', body).value.trim()); } catch (e) { /* ignore */ } FS.closeDialog(); FS.toast('נשמר. "פרסום לאתר" יעלה עכשיו ישירות.'); });
    $('#tok-del', body).addEventListener('click', function () { try { localStorage.removeItem(TOKEN); } catch (e) { /* ignore */ } FS.closeDialog(); FS.toast('המפתח נמחק'); });
  });
  FS.on('history', function () { var t = $('#lib-title'); if (t && !t.value && FS.prefs.event && FS.prefs.event.names) t.placeholder = FS.prefs.event.names; });
})();
