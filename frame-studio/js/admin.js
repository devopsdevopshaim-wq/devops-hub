/* The owner's admin: everything the site shows, edited in one place and published to frame-studio/business.json
   (GitHub contents API, the owner's own token, kept only in this browser): business details, the site's headings and
   lines, packages, FAQ, reviews, busy dates, event types and which frames customers may pick, plus the owner's own PNG
   frames for the customers' designer (frames/, one commit). A draft is kept in this browser until it is published;
   the preview shows the real site with the draft. AI writes alternatives for any text. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var REPO = 'devopsdevopshaim-wq/devops-hub', PATH = 'frame-studio/business.json', TOKEN = 'fs-gh-token', DRAFT = 'fs-admin-draft';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FS.busy = FS.busy || function (msg) { var b = $('#busy'); if (msg) { $('#busy-msg').textContent = msg; b.hidden = false; } else b.hidden = true; };
  var base = null, draft = null, dirty = {}, sec = 'home', TEXTS = [], FRAMES = [], framesSha = null;

  /* ---------- GitHub ---------- */
  function token() { try { return localStorage.getItem(TOKEN) || ''; } catch (e) { return ''; } }
  function gh(path, opts) {
    opts = opts || {};
    return fetch('https://api.github.com/repos/' + REPO + path, { method: opts.method || 'GET', cache: 'no-store', headers: { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { if (r.status === 404 && opts.allow404) return null; if (!r.ok) { var e = new Error('gh-' + r.status); e.status = r.status; throw e; } return r.status === 204 ? {} : r.json(); });
  }
  function b64utf8(s) { return btoa(unescape(encodeURIComponent(s))); }
  function unb64(s) { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, '')))); }
  function readJson(path) { return gh('/contents/' + path + '?ref=main', { allow404: true }).then(function (r) { if (!r || typeof r.content !== 'string') return { sha: r && r.sha || null, data: null }; try { return { sha: r.sha, data: JSON.parse(unb64(r.content)) }; } catch (e) { return { sha: r.sha, data: null }; } }); }
  function commit(changes, message) {
    var head;
    return gh('/git/ref/heads/main').then(function (ref) { head = ref.object.sha; return gh('/git/commits/' + head); }).then(function (c) {
      return Promise.all(changes.map(function (ch) {
        if (ch.del) return Promise.resolve({ path: ch.path, mode: '100644', type: 'blob', sha: null });
        return gh('/git/blobs', { method: 'POST', body: { content: ch.b64, encoding: 'base64' } }).then(function (b) { return { path: ch.path, mode: '100644', type: 'blob', sha: b.sha }; });
      })).then(function (tree) { return gh('/git/trees', { method: 'POST', body: { base_tree: c.tree.sha, tree: tree } }); });
    }).then(function (t) { return gh('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [head] } }); })
      .then(function (nc) { return gh('/git/refs/heads/main', { method: 'PATCH', body: { sha: nc.sha } }); });
  }

  /* ---------- sign-in ---------- */
  function signIn() {
    if (!token()) { $('#login').hidden = false; $('#app').hidden = true; return; }
    FS.busy('מתחבר…');
    Promise.all([readJson(PATH), readJson('frame-studio/frames/frames.json'), fetch('index.html', { cache: 'no-cache' }).then(function (r) { return r.text(); }).catch(function () { return ''; })]).then(function (r) {
      FS.busy();
      base = r[0].data || {}; base.__sha = r[0].sha; FRAMES = Array.isArray(r[1].data) ? r[1].data : []; framesSha = r[1].sha;
      readTexts(r[2]);
      var saved = null; try { saved = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { /* ignore */ }
      draft = clone(base); delete draft.__sha; dirty = {};
      /* what was saved here and not yet published comes back by itself */
      if (saved && saved.dirty) Object.keys(saved.dirty).forEach(function (k) { if (saved.draft && k in saved.draft) { draft[k] = saved.draft[k]; dirty[k] = 1; } });
      savedAt = saved && saved.at || 0;
      /* the packages are one draft shared with the studio (💰 חבילות): both save it in frame-studio-packages, so the latest save wins */
      var pk = studioPackages();
      if (pk && JSON.stringify(pk) !== JSON.stringify(draft.packages || [])) {   // the latest save, from here or from the studio
        if (JSON.stringify(pk) === JSON.stringify(base.packages || [])) { draft.packages = pk; delete dirty.packages; } else { draft.packages = pk; dirty.packages = 1; }
      }
      if (Object.keys(dirty).length) setTimeout(function () { FS.toast('💾 השינויים השמורים שלא פורסמו נטענו (' + Object.keys(dirty).map(label).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ')', 6000); }, 400);
      $('#login').hidden = true; $('#app').hidden = false; $$('[data-biz]').forEach(function (e) { if (draft[e.dataset.biz]) e.textContent = draft[e.dataset.biz]; });
      nav(); show(sec); state();
    }).catch(function (e) {
      FS.busy(); $('#login').hidden = false; $('#app').hidden = true;
      $('#login-err').textContent = e.status === 401 || e.status === 403 ? 'המפתח לא תקין או בלי הרשאת Contents למאגר. בודקים ומנסים שוב.' : 'אין חיבור ל־GitHub כרגע. נסו שוב.';
    });
  }
  $('#tok-go').addEventListener('click', function () { var t = $('#tok').value.trim(); if (!/^(github_pat_|ghp_)\w{20,}$/.test(t)) { $('#login-err').textContent = 'זה לא נראה כמו מפתח של GitHub (מתחיל ב־github_pat_).'; return; } try { localStorage.setItem(TOKEN, t); } catch (e) { /* ignore */ } signIn(); });

  /* ---------- draft ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var LABELS = { name: 'פרטי העסק', texts: 'טקסטים', packages: 'חבילות', extras: 'תוספות', packagesNote: 'הערת חבילות', faq: 'שאלות', reviews: 'המלצות', googleReviews: 'קישור לגוגל', busy: 'תאריכים תפוסים', events: 'סוגי אירועים', hideFrames: 'מסגרות ללקוחות' };
  function label(k) { return LABELS[k] || 'פרטי העסק'; }
  /* every change is saved in this browser at once, and the studio's packages editor sees the same packages */
  var PKEY = 'frame-studio-packages', savedAt = 0;
  function studioPackages() { try { var l = JSON.parse(localStorage.getItem(PKEY) || 'null'); return Array.isArray(l) && l.length ? l : null; } catch (e) { return null; } }
  function persist() {
    savedAt = Date.now();
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ draft: draft, dirty: dirty, at: savedAt }));
      if (dirty.packages) localStorage.setItem(PKEY, JSON.stringify(draft.packages || []));
    } catch (e) { FS.toast('השמירה בדפדפן לא הצליחה (אולי מצב גלישה פרטית)'); }
  }
  function touch(k) { dirty[k] = 1; persist(); state(); pushPreview(); }
  function state() {
    var n = Object.keys(dirty).length; $('#publish').disabled = !n;
    $('#state').textContent = n ? '💾 נשמר ' + (savedAt ? new Date(savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '') + ' · ' + n + ' שינויים עוד לא באתר' : '✔ הכול שמור ומפורסם';
    $('#state').className = 'adm-state' + (n ? ' warn' : '');
  }
  $('#save').addEventListener('click', function () { persist(); state(); FS.toast(Object.keys(dirty).length ? '💾 נשמר. כדי שיופיע באתר לוחצים "פרסום באתר".' : '💾 הכול כבר שמור ומפורסם'); });
  $('#publish').addEventListener('click', function () {
    var keys = Object.keys(dirty); if (!keys.length) return;
    FS.busy('מפרסם…');
    /* only what was changed here goes in; whatever the studio published meanwhile stays */
    readJson(PATH).then(function (cur) {
      var out = cur.data || {}; keys.forEach(function (k) { out[k] = draft[k]; });
      return gh('/contents/' + PATH, { method: 'PUT', body: { message: 'frame-studio admin: ' + keys.map(label).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '), branch: 'main', content: b64utf8(JSON.stringify(out, null, 2) + '\n'), sha: cur.sha || undefined } }).then(function () { return out; });
    }).then(function (out) {
      FS.busy(); base = out; dirty = {}; savedAt = Date.now();
      try { localStorage.removeItem(DRAFT); if (out.packages) localStorage.setItem(PKEY, JSON.stringify(out.packages)); } catch (e) { /* ignore */ } state();
      FS.toast('🌐 פורסם. האתר יתעדכן תוך כשתי דקות.', 6000);
    }).catch(function (e) { FS.busy(); FS.toast(e.status === 409 ? 'מישהו עדכן בדיוק עכשיו. לוחצים שוב על פרסום.' : 'הפרסום לא הצליח (' + (e.status || 'רשת') + '). השינויים נשמרו כטיוטה.', 6000); });
  });

  /* ---------- preview: the real site, with the draft ---------- */
  var pvReady = false;
  $('#preview-btn').addEventListener('click', function () {
    var pv = $('#pv'); pv.hidden = !pv.hidden; document.body.classList.toggle('pv-on', !pv.hidden);
    if (!pv.hidden && !pvReady) { var f = $('#pv-frame'); f.addEventListener('load', function () { pvReady = true; setTimeout(pushPreview, 400); setTimeout(pushPreview, 1800); }); f.src = 'index.html?preview'; }
  });
  $('#pv-x').addEventListener('click', function () { $('#pv').hidden = true; document.body.classList.remove('pv-on'); });
  function pushPreview() { var f = $('#pv-frame'); if (pvReady && f.contentWindow && !$('#pv').hidden) f.contentWindow.postMessage({ type: 'fs-preview', biz: draft }, location.origin); }

  /* ---------- AI writing ---------- */
  function aiAlt(what, current, max, cb) {
    var prompt = 'You write Hebrew website copy for "' + (draft.name || '') + '", an event photo-magnet business (photos printed as magnets at weddings, bar mitzvahs and events, with custom frames). ' +
      'Write 3 alternative versions in natural, warm, professional Hebrew for: ' + what + '. Current text: "' + String(current || '').replace(/"/g, "'") + '". Max ' + (max || 80) + ' characters each. No emojis unless the current has them. Answer ONLY with a JSON array of 3 strings.';
    return FS.askServer({ action: 'ai', tag: 'admin', prompt: prompt }).then(function (r) {
      if (!r || !r.ok || !r.text) throw new Error((r && r.error) || 'ai-failed');
      var t = r.text, a = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
      cb(a.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim().slice(0, (max || 80) + 20); }).slice(0, 3));
    }).catch(function (e) { FS.toast(FS.aiError(e && e.message), 5000); });
  }
  function aiButton(input, what, max) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'adm-ai'; b.title = 'הצעות ניסוח מה־AI'; b.textContent = '✨';
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = '…';
      aiAlt(what, input.value, max, function (list) {
        var box = input.parentNode.querySelector('.adm-alts') || input.parentNode.appendChild(Object.assign(document.createElement('div'), { className: 'adm-alts' }));
        box.innerHTML = list.map(function (t) { return '<button type="button">' + esc(t) + '</button>'; }).join('');
        $$('button', box).forEach(function (x) { x.addEventListener('click', function () { input.value = x.textContent; input.dispatchEvent(new Event('input')); box.remove(); }); });
      }).then(function () { b.disabled = false; b.textContent = '✨'; });
    });
    return b;
  }

  /* ---------- the sections ---------- */
  var SECTIONS = [
    ['home', '🏠', 'סקירה'], ['biz', '🏷️', 'פרטי העסק'], ['texts', '✍️', 'טקסטים באתר'], ['packages', '💰', 'חבילות ומחירים'], ['faq', '❓', 'שאלות נפוצות'],
    ['reviews', '⭐', 'המלצות'], ['busy', '📅', 'תאריכים תפוסים'], ['frames', '🖼️', 'מסגרות ללקוחות'], ['events', '🎉', 'סוגי אירועים'], ['account', '🔑', 'חיבור']
  ];
  function nav() {
    $('#side').innerHTML = SECTIONS.map(function (s) { return '<button data-s="' + s[0] + '"' + (s[0] === sec ? ' class="on"' : '') + '><i>' + s[1] + '</i><span>' + s[2] + '</span></button>'; }).join('');
    $$('#side button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.s); }); });
  }
  function show(s) { sec = s; $$('#side button').forEach(function (b) { b.classList.toggle('on', b.dataset.s === s); }); var m = $('#main'); m.innerHTML = ''; VIEWS[s](m); m.scrollTop = 0; window.scrollTo(0, 0); }
  function head(m, title, sub) { m.insertAdjacentHTML('beforeend', '<header class="adm-h"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</header>'); }
  function input(label, val, onIn, opt) {
    opt = opt || {};
    var w = document.createElement('label'); w.className = 'adm-f' + (opt.wide ? ' wide' : '');
    w.innerHTML = '<span>' + esc(label) + '</span>';
    var row = document.createElement('div'); row.className = 'adm-in';
    var el = document.createElement(opt.area ? 'textarea' : 'input'); if (!opt.area) el.type = opt.type || 'text'; if (opt.area) el.rows = opt.rows || 3;
    el.value = val == null ? '' : val; if (opt.ph) el.placeholder = opt.ph; if (opt.ltr) el.dir = 'ltr';
    el.addEventListener('input', function () { onIn(el.value); });
    row.appendChild(el); if (opt.ai) row.appendChild(aiButton(el, opt.ai, opt.max)); w.appendChild(row); return w;
  }

  var VIEWS = {};
  VIEWS.home = function (m) {
    head(m, 'שלום ' + esc(String(draft.owner || '').split(' ')[0] || '') + ' 👋', 'כל מה שמופיע באתר, במקום אחד. משנים, מסתכלים בתצוגה המקדימה ולוחצים "פרסום באתר".');
    var stats = [['💰', (draft.packages || []).filter(function (p) { return !p.hidden; }).length, 'חבילות באתר'], ['❓', (draft.faq || []).length, 'שאלות נפוצות'], ['⭐', (draft.reviews || []).length, 'המלצות'], ['📅', (draft.busy || []).length, 'תאריכים תפוסים'], ['🖼️', FRAMES.filter(function (f) { return !f.hidden; }).length, 'מסגרות שלך ללקוחות']];
    m.insertAdjacentHTML('beforeend', '<div class="adm-stats">' + stats.map(function (s) { return '<div><i>' + s[0] + '</i><b>' + s[1] + '</b><small>' + s[2] + '</small></div>'; }).join('') + '</div>' +
      '<h2>הפלטפורמות</h2><div class="adm-links">' +
      '<a href="./" target="_blank" rel="noopener"><i>🌐</i><b>האתר</b><small>מה שהלקוחות רואים</small></a>' +
      '<a href="design.html" target="_blank" rel="noopener"><i>🎨</i><b>עורך המסגרות ללקוחות</b><small>הלקוחות מעצבים לבד, עם AI ומההזמנה</small></a>' +
      '<a href="design.html?owner" target="_blank" rel="noopener"><i>🧩</i><b>העורך, במצב בעל העסק</b><small>מסגרת מהזמנה ישר ל"המסגרות שלי" בסטודיו</small></a>' +
      '<a href="studio.html" target="_blank" rel="noopener"><i>🖼️</i><b>הסטודיו</b><small>עריכה, הדפסה, עסקאות</small></a></div>' +
      '<h2>שינויים אחרונים באתר</h2><div id="hist" class="hint">טוען…</div>');
    gh('/commits?path=frame-studio&per_page=6').then(function (l) {
      $('#hist').innerHTML = '<ul class="adm-hist">' + (l || []).map(function (c) { return '<li><b>' + esc(c.commit.message.split('\n')[0]) + '</b><small>' + new Date(c.commit.author.date).toLocaleString('he-IL') + '</small></li>'; }).join('') + '</ul>';
    }).catch(function () { $('#hist').textContent = ''; });
  };
  VIEWS.biz = function (m) {
    head(m, '🏷️ פרטי העסק', 'מופיעים באתר, בצ׳אט, במסמכים ובשורת העסק שעל המגנטים.');
    var g = document.createElement('div'); g.className = 'adm-grid'; m.appendChild(g);
    [['name', 'שם העסק'], ['owner', 'שם בעל העסק'], ['phone', 'טלפון', 'tel'], ['whatsapp', 'וואטסאפ', 'tel'], ['email', 'אימייל', 'email'], ['instagram', 'אינסטגרם (קישור)', 'url'], ['facebook', 'פייסבוק (קישור)', 'url'], ['website', 'אתר', 'url'], ['areas', 'אזורי שירות'], ['hours', 'שעות פעילות']].forEach(function (f) {
      g.appendChild(input(f[1], draft[f[0]], function (v) { draft[f[0]] = v; touch(f[0]); }, { type: f[2], ltr: f[2] && f[2] !== 'text' }));
    });
    m.appendChild(input('סלוגן (מופיע בתחתית האתר)', draft.tagline, function (v) { draft.tagline = v; touch('tagline'); }, { wide: true, ai: 'a short slogan for the business', max: 50 }));
  };
  function readTexts(html) {
    TEXTS = [];
    try { var doc = new DOMParser().parseFromString(html, 'text/html'); $$('[data-t]', doc).forEach(function (e) { TEXTS.push({ key: e.dataset.t, def: e.textContent.trim(), long: e.tagName === 'P' && e.textContent.length > 60 }); }); } catch (e) { /* ignore */ }
  }
  var TEXT_NAMES = { hero: 'פתיח (ראש העמוד)', how: 'איך זה עובד', events: 'אירועים', gallery: 'עיצובים', designer: 'עיצוב מגנט', packages: 'חבילות', tech: 'טכנולוגיה', reviews: 'המלצות', faq: 'שאלות', contact: 'יצירת קשר' };
  var PART = { eyebrow: 'כותרת קטנה', title: 'כותרת', title1: 'כותרת, שורה 1', title2: 'כותרת, שורה 2', lead: 'פסקה' };
  VIEWS.texts = function (m) {
    head(m, '✍️ טקסטים באתר', 'כל הכותרות והפסקאות הראשיות באתר. שדה ריק = הטקסט המקורי. ✨ מציע ניסוחים חלופיים.');
    draft.texts = draft.texts || {};
    var groups = {}; TEXTS.forEach(function (t) { var g = t.key.split('.')[0]; (groups[g] = groups[g] || []).push(t); });
    Object.keys(groups).forEach(function (g) {
      var box = document.createElement('section'); box.className = 'adm-card'; box.innerHTML = '<h3>' + esc(TEXT_NAMES[g] || g) + '</h3>'; m.appendChild(box);
      groups[g].forEach(function (t) {
        var f = input(PART[t.key.split('.')[1]] || t.key, draft.texts[t.key] || '', function (v) { if (v.trim()) draft.texts[t.key] = v; else delete draft.texts[t.key]; touch('texts'); }, { ph: t.def, area: t.long, rows: 3, wide: true, ai: (TEXT_NAMES[g] || g) + ' ' + (PART[t.key.split('.')[1]] || ''), max: t.long ? 220 : 60 });
        var ai = f.querySelector('.adm-ai'); if (ai) ai.addEventListener('click', function () { var el = f.querySelector('input,textarea'); if (!el.value) el.value = t.def; }, true);
        box.appendChild(f);
      });
    });
    if (!TEXTS.length) m.insertAdjacentHTML('beforeend', '<p class="hint">לא הצלחתי לקרוא את טקסטי האתר.</p>');
  };
  VIEWS.packages = function (m) {
    head(m, '💰 חבילות ומחירים', 'מה שמופיע באתר תחת "חבילות", בצ׳אט ובמסמכי העסקה.');
    draft.packages = draft.packages || [];
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.packages.forEach(function (p, i) {
        var c = document.createElement('section'); c.className = 'adm-card' + (p.featured ? ' star' : '') + (p.hidden ? ' off' : '');
        c.innerHTML = '<div class="adm-card-h"><h3>' + esc(p.name || 'חבילה') + '</h3><div class="adm-tools"><button data-a="up" title="למעלה">▲</button><button data-a="down" title="למטה">▼</button><button data-a="dup" title="שכפול">⧉</button><button data-a="del" title="מחיקה">🗑</button></div></div>';
        var g = document.createElement('div'); g.className = 'adm-grid'; c.appendChild(g);
        g.appendChild(input('שם', p.name, function (v) { p.name = v; $('h3', c).textContent = v; touch('packages'); }));
        g.appendChild(input('מחיר', p.price, function (v) { p.price = v; touch('packages'); }, { ph: '₪1,490' }));
        g.appendChild(input('משך', p.hours, function (v) { p.hours = v; touch('packages'); }, { ph: '3 שעות' }));
        g.appendChild(input('כמות מגנטים', p.magnets, function (v) { p.magnets = v; touch('packages'); }, { ph: 'עד 150 מגנטים' }));
        c.appendChild(input('מה כלול (שורה לכל פריט)', (p.features || []).join('\n'), function (v) { p.features = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('packages'); }, { area: true, rows: 4, wide: true, ai: 'the list of what the package "' + (p.name || '') + '" includes, one item per line (answer each version as one string with \\n between items)', max: 300 }));
        c.appendChild(input('הערה קטנה', p.note, function (v) { p.note = v; touch('packages'); }, { wide: true }));
        var ev = document.createElement('div'); ev.className = 'adm-chips'; ev.innerHTML = '<span>מתאימה ל:</span>' + FS.EVENTS.map(function (e) { return '<button type="button" data-e="' + e.id + '" class="' + ((p.for || []).indexOf(e.id) > -1 ? 'on' : '') + '">' + e.icon + ' ' + e.name + '</button>'; }).join(''); c.appendChild(ev);
        $$('[data-e]', ev).forEach(function (b) { b.addEventListener('click', function () { p.for = p.for || []; var k = p.for.indexOf(b.dataset.e); if (k > -1) p.for.splice(k, 1); else p.for.push(b.dataset.e); b.classList.toggle('on'); touch('packages'); }); });
        c.insertAdjacentHTML('beforeend', '<div class="adm-flags"><label><input type="checkbox" data-k="featured"' + (p.featured ? ' checked' : '') + '> ⭐ החבילה המומלצת</label><label><input type="checkbox" data-k="hidden"' + (p.hidden ? ' checked' : '') + '> להסתיר מהאתר</label></div>');
        $$('[data-k]', c).forEach(function (x) { x.addEventListener('change', function () { p[x.dataset.k] = x.checked; if (x.dataset.k === 'featured' && x.checked) draft.packages.forEach(function (q) { if (q !== p) q.featured = false; }); touch('packages'); draw(); }); });
        $$('[data-a]', c).forEach(function (b) { b.addEventListener('click', function () {
          var a = b.dataset.a, L = draft.packages;
          if (a === 'up' && i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]); else if (a === 'down' && i < L.length - 1) L.splice(i + 1, 0, L.splice(i, 1)[0]);
          else if (a === 'dup') { var cp = clone(p); cp.id = 'p' + FS.uid(); cp.name += ' (עותק)'; cp.featured = false; L.splice(i + 1, 0, cp); }
          else if (a === 'del') { if (!confirm('למחוק את "' + (p.name || '') + '"?')) return; L.splice(i, 1); }
          touch('packages'); draw();
        }); });
        list.appendChild(c);
      });
      var add = document.createElement('button'); add.className = 'adm-add'; add.innerHTML = '<b>＋</b> חבילה חדשה'; add.addEventListener('click', function () { draft.packages.push({ id: 'p' + FS.uid(), name: 'חבילה חדשה', price: '', hours: '', magnets: '', features: [] }); touch('packages'); draw(); }); list.appendChild(add);
    }
    draw();
    var c = document.createElement('section'); c.className = 'adm-card'; c.innerHTML = '<h3>מתחת לחבילות</h3>'; m.appendChild(c);
    c.appendChild(input('תוספות (שורה לכל תוספת, "שם · מחיר")', (draft.extras || []).join('\n'), function (v) { draft.extras = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('extras'); }, { area: true, rows: 4, wide: true, ph: 'שעה נוספת · ₪350' }));
    c.appendChild(input('הערה', draft.packagesNote, function (v) { draft.packagesNote = v; touch('packagesNote'); }, { area: true, rows: 2, wide: true, ai: 'a short note under the price list', max: 160 }));
  };
  VIEWS.faq = function (m) {
    head(m, '❓ שאלות נפוצות', 'מופיעות באתר, ועליהן גם הצ׳אט עונה.');
    draft.faq = draft.faq || [];
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.faq.forEach(function (q, i) {
        var c = document.createElement('section'); c.className = 'adm-card';
        c.innerHTML = '<div class="adm-card-h"><h3>שאלה ' + (i + 1) + '</h3><div class="adm-tools"><button data-a="up">▲</button><button data-a="down">▼</button><button data-a="del">🗑</button></div></div>';
        c.appendChild(input('שאלה', q[0], function (v) { q[0] = v; touch('faq'); }, { wide: true }));
        c.appendChild(input('תשובה', q[1], function (v) { q[1] = v; touch('faq'); }, { wide: true, area: true, rows: 3, ai: 'the answer to the FAQ question "' + q[0] + '"', max: 260 }));
        $$('[data-a]', c).forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.a, L = draft.faq; if (a === 'up' && i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]); else if (a === 'down' && i < L.length - 1) L.splice(i + 1, 0, L.splice(i, 1)[0]); else if (a === 'del') { if (!confirm('למחוק את השאלה?')) return; L.splice(i, 1); } touch('faq'); draw(); }); });
        list.appendChild(c);
      });
      var row = document.createElement('div'); row.className = 'adm-row';
      row.innerHTML = '<button class="adm-add"><b>＋</b> שאלה</button><button class="btn line" id="faq-ai">✨ ה־AI יציע שאלות שחסרות</button>'; list.appendChild(row);
      $('.adm-add', row).addEventListener('click', function () { draft.faq.push(['', '']); touch('faq'); draw(); });
      $('#faq-ai', row).addEventListener('click', function () {
        var btn = this; btn.disabled = true; btn.textContent = '✨ חושב…';
        var facts = { name: draft.name, areas: draft.areas, packages: (draft.packages || []).map(function (p) { return [p.name, p.price, p.hours, p.magnets]; }), faq: draft.faq.map(function (q) { return q[0]; }) };
        FS.askServer({ action: 'ai', tag: 'admin', prompt: 'An event photo-magnet business (prints guests\' photos as framed magnets at the event). Facts: ' + JSON.stringify(facts) + '. Suggest 4 more FAQ entries customers typically ask that are NOT already listed, in natural Hebrew, with short honest answers based only on the facts or general practice (no invented prices). Answer ONLY with JSON [["question","answer"],...].' })
          .then(function (r) { if (!r || !r.ok) throw new Error(r && r.error); var t = r.text, a = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
            var box = document.createElement('div'); box.className = 'adm-sugg'; box.innerHTML = '<h3>הצעות (לחיצה מוסיפה)</h3>' + a.filter(function (x) { return Array.isArray(x) && x[0]; }).map(function (x, k) { return '<button data-k="' + k + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1] || '') + '</span></button>'; }).join('');
            list.appendChild(box); $$('[data-k]', box).forEach(function (b) { b.addEventListener('click', function () { var x = a[Number(b.dataset.k)]; draft.faq.push([String(x[0]).slice(0, 120), String(x[1] || '').slice(0, 400)]); touch('faq'); b.remove(); draw(); }); });
          }).catch(function (e) { FS.toast(FS.aiError(e && e.message)); }).then(function () { btn.disabled = false; btn.textContent = '✨ ה־AI יציע שאלות שחסרות'; });
      });
    }
    draw();
  };
  VIEWS.reviews = function (m) {
    head(m, '⭐ המלצות', 'המלצות אמיתיות בלבד, ברשות הלקוחות. החלק "לקוחות מספרים" באתר מופיע כשיש לפחות אחת.');
    draft.reviews = draft.reviews || [];
    m.appendChild(input('קישור לכתיבת ביקורת בגוגל', draft.googleReviews, function (v) { draft.googleReviews = /^https:\/\//.test(v.trim()) || !v.trim() ? v.trim() : draft.googleReviews; touch('googleReviews'); }, { wide: true, ltr: true, ph: 'https://g.page/r/…/review' }));
    var list = document.createElement('div'); list.className = 'adm-list'; m.appendChild(list);
    function draw() {
      list.innerHTML = '';
      draft.reviews.forEach(function (r, i) {
        var c = document.createElement('section'); c.className = 'adm-card';
        c.innerHTML = '<div class="adm-card-h"><h3>' + '★★★★★'.slice(0, r.stars || 5) + '</h3><div class="adm-tools"><button data-a="del">🗑</button></div></div>';
        var g = document.createElement('div'); g.className = 'adm-grid'; c.appendChild(g);
        g.appendChild(input('שם', r.name, function (v) { r.name = v; touch('reviews'); }));
        var s = document.createElement('label'); s.className = 'adm-f'; s.innerHTML = '<span>אירוע</span><div class="adm-in"><select>' + FS.EVENTS.map(function (e) { return '<option value="' + e.id + '"' + (r.type === e.id ? ' selected' : '') + '>' + e.icon + ' ' + e.name + '</option>'; }).join('') + '</select></div>'; g.appendChild(s);
        $('select', s).addEventListener('change', function () { r.type = this.value; touch('reviews'); });
        var st = document.createElement('label'); st.className = 'adm-f'; st.innerHTML = '<span>כוכבים</span><div class="adm-in"><select>' + [5, 4, 3].map(function (n) { return '<option' + ((r.stars || 5) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'; g.appendChild(st);
        $('select', st).addEventListener('change', function () { r.stars = Number(this.value); touch('reviews'); $('h3', c).textContent = '★★★★★'.slice(0, r.stars); });
        c.appendChild(input('מה הלקוח כתב', r.text, function (v) { r.text = v; touch('reviews'); }, { wide: true, area: true, rows: 3 }));
        $('[data-a=del]', c).addEventListener('click', function () { if (!confirm('למחוק?')) return; draft.reviews.splice(i, 1); touch('reviews'); draw(); });
        list.appendChild(c);
      });
      var add = document.createElement('button'); add.className = 'adm-add'; add.innerHTML = '<b>＋</b> המלצה'; add.addEventListener('click', function () { draft.reviews.push({ name: '', type: 'wedding', stars: 5, text: '' }); touch('reviews'); draw(); }); list.appendChild(add);
    }
    draw();
  };
  VIEWS.busy = function (m) {
    head(m, '📅 תאריכים תפוסים', 'מופיעים באתר ובצ׳אט כ"תפוס", בלי שמות. אפשר גם לעדכן מהסטודיו (עסקאות ← "עדכון תאריכים תפוסים").');
    draft.busy = (draft.busy || []).slice().sort();
    var c = document.createElement('section'); c.className = 'adm-card'; m.appendChild(c);
    function draw() {
      var today = new Date().toISOString().slice(0, 10);
      c.innerHTML = '<div class="adm-row"><input type="date" id="b-new" min="' + today + '"><button class="btn gold" id="b-add">＋ הוספה</button><button class="btn line" id="b-clean">ניקוי תאריכים שעברו</button></div><div class="adm-dates">' +
        (draft.busy.length ? draft.busy.map(function (d) { return '<span class="' + (d < today ? 'past' : '') + '">' + new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + '<button data-d="' + d + '" aria-label="הסרה">✕</button></span>'; }).join('') : '<p class="hint">אין תאריכים תפוסים.</p>') + '</div>';
      $('#b-add', c).addEventListener('click', function () { var v = $('#b-new', c).value; if (!v || draft.busy.indexOf(v) > -1) return; draft.busy.push(v); draft.busy.sort(); touch('busy'); draw(); });
      $('#b-clean', c).addEventListener('click', function () { draft.busy = draft.busy.filter(function (d) { return d >= today; }); touch('busy'); draw(); });
      $$('[data-d]', c).forEach(function (b) { b.addEventListener('click', function () { draft.busy = draft.busy.filter(function (d) { return d !== b.dataset.d; }); touch('busy'); draw(); }); });
    }
    draw();
  };
  VIEWS.events = function (m) {
    head(m, '🎉 סוגי אירועים', 'מופיעים ברשימה בטופס יצירת הקשר. שורה לכל סוג.');
    m.appendChild(input('סוגי אירועים', (draft.events || []).join('\n'), function (v) { draft.events = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); touch('events'); }, { area: true, rows: 9, wide: true }));
  };
  VIEWS.frames = function (m) {
    head(m, '🖼️ מסגרות ללקוחות', 'מה הלקוחות יכולים לבחור בעורך המסגרות (design.html): המסגרות המובנות, והמסגרות שלך בקובץ PNG עם חלון שקוף.');
    draft.hideFrames = draft.hideFrames || [];
    var c = document.createElement('section'); c.className = 'adm-card'; c.innerHTML = '<h3>מסגרות מובנות</h3><p class="hint">לוחצים כדי להסתיר או להחזיר מסגרת. הסתרה מתפרסמת עם "פרסום באתר".</p><div class="adm-frames" id="gen"></div>'; m.appendChild(c);
    FS.GEN_FRAMES.forEach(function (f) {
      var b = document.createElement('button'); b.className = 'adm-fr' + (draft.hideFrames.indexOf(f.id) > -1 ? ' off' : ''); b.innerHTML = '<span class="th"></span><small>' + esc(f.name) + '</small>';
      b.addEventListener('click', function () { var k = draft.hideFrames.indexOf(f.id); if (k > -1) draft.hideFrames.splice(k, 1); else draft.hideFrames.push(f.id); b.classList.toggle('off'); touch('hideFrames'); });
      $('#gen', c).appendChild(b);
      FS.magnetCanvas({ type: 'wedding', names: '', frame: f.id }, 120).then(function (cv) { $('.th', b).appendChild(cv); }).catch(function () {});
    });
    var u = document.createElement('section'); u.className = 'adm-card'; m.appendChild(u);
    function drawMine() {
      u.innerHTML = '<h3>המסגרות שלך (PNG)</h3><p class="hint">PNG עם אזור שקוף לתמונה. הן נשמרות באתר מיד עם ההעלאה, בלי לחכות ל"פרסום".</p><div class="adm-frames" id="mine"></div>' +
        '<div class="adm-up"><label class="btn gold">⬆️ העלאת מסגרת PNG<input type="file" id="f-up" accept="image/png" hidden></label><input id="f-name" placeholder="שם המסגרת"></div>';
      FRAMES.forEach(function (f, i) {
        var b = document.createElement('div'); b.className = 'adm-fr' + (f.hidden ? ' off' : '');
        b.innerHTML = '<span class="th"><img src="' + esc(f.src) + '?v=' + (f.v || 1) + '" alt=""></span><small>' + esc(f.name) + '</small><div class="adm-tools"><button data-a="hide">' + (f.hidden ? '👁 להציג' : '🙈 להסתיר') + '</button><button data-a="del">🗑</button></div>';
        $$('[data-a]', b).forEach(function (x) { x.addEventListener('click', function () {
          if (x.dataset.a === 'hide') { f.hidden = !f.hidden; saveFrames([], 'frame-studio admin: ' + (f.hidden ? 'hide' : 'show') + ' frame ' + f.name); }
          else if (confirm('למחוק את "' + f.name + '" מהאתר?')) { FRAMES.splice(i, 1); saveFrames([{ path: 'frame-studio/' + f.src, del: true }], 'frame-studio admin: remove frame ' + f.name); }
        }); });
        $('#mine', u).appendChild(b);
      });
      if (!FRAMES.length) $('#mine', u).innerHTML = '<p class="hint">עוד לא העלית מסגרות משלך.</p>';
      $('#f-up', u).addEventListener('change', function () {
        var file = this.files[0]; if (!file) return; var name = $('#f-name', u).value.trim() || file.name.replace(/\.png$/i, '');
        FS.fileToDataURL(file).then(function (url) { return FS.loadImg(url).then(function (im) {
          var hole = FS.detectHole(im); if (!hole && !confirm('לא מצאתי חלון שקוף במסגרת, אז התמונה לא תיראה דרכה. להעלות בכל זאת?')) return;
          var k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          var id = 'f' + Date.now().toString(36), src = 'frames/' + id + '.png';
          FRAMES.push({ id: id, name: name.slice(0, 40), src: src, for: [], at: new Date().toISOString() });
          return saveFrames([{ path: 'frame-studio/' + src, b64: cv.toDataURL('image/png').split(',')[1] }], 'frame-studio admin: frame ' + name);
        }); });
      });
    }
    function saveFrames(files, msg) {
      FS.busy('שומר באתר…');
      return commit(files.concat([{ path: 'frame-studio/frames/frames.json', b64: b64utf8(JSON.stringify(FRAMES, null, 1) + '\n') }]), msg)
        .then(function () { FS.busy(); FS.toast('✔ נשמר. יופיע ללקוחות תוך כשתי דקות.', 5000); drawMine(); })
        .catch(function (e) { FS.busy(); FS.toast('השמירה לא הצליחה (' + (e.status || 'רשת') + ')', 5000); drawMine(); });
    }
    drawMine();
  };
  VIEWS.account = function (m) {
    head(m, '🔑 חיבור', 'הכניסה לניהול היא עם מפתח GitHub שנשמר רק בדפדפן הזה.');
    m.insertAdjacentHTML('beforeend', '<section class="adm-card"><p>מחובר למאגר <code>' + REPO + '</code>.</p><div class="adm-row"><button class="btn line" id="discard">↺ ביטול כל השינויים שלא פורסמו</button><button class="btn danger" id="logout">יציאה (מחיקת המפתח מהדפדפן)</button></div></section>');
    $('#discard').addEventListener('click', function () { if (!confirm('לבטל את כל השינויים שלא פורסמו?')) return; draft = clone(base); delete draft.__sha; dirty = {}; try { localStorage.removeItem(DRAFT); localStorage.setItem(PKEY, JSON.stringify(base.packages || [])); } catch (e) { /* ignore */ } state(); pushPreview(); FS.toast('בוטל'); });
    $('#logout').addEventListener('click', function () { if (!confirm('לצאת? גם "חיבור לאתר" בסטודיו בדפדפן הזה יתנתק.')) return; try { localStorage.removeItem(TOKEN); } catch (e) { /* ignore */ } location.reload(); });
  };

  signIn();
})();
