(function () {
  'use strict';

  var art = window.PORTFOLIO_ART;
  var grid = document.getElementById('grid');
  var q = document.getElementById('q');
  var note = document.getElementById('note');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state = { cat: 'all', query: '', live: null, data: null, repos: null, show: 'all', sort: 'default', opens: {} };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  var ICON_OUT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_CODE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4L2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // GitHub Pages address of an uploaded project, straight to its start page.
  function pagesUrl(p) {
    return 'https://' + state.data.owner + '.github.io/' + p.repo + '/' + (p.start ? encodeURIComponent(p.start) : '');
  }

  // Works out where a project lives right now.
  // Live result from the n8n control center overrides the static guess.
  var LIVE = { ok: ['live', 'עובד עכשיו'], waking: ['wait', 'מתעורר'], locked: ['private', 'נעול'], down: ['down', 'לא זמין כרגע'] };
  function status(p) {
    var s = baseStatus(p), live = state.live && state.live[p.id];
    if (live && LIVE[live.state]) { s = Object.assign({}, s, { kind: LIVE[live.state][0], label: LIVE[live.state][1] }); }
    return s;
  }

  function baseStatus(p) {
    var owner = state.data.owner;
    if (p.url) return { kind: 'live', label: 'באוויר', open: p.url, code: p.repo ? 'https://github.com/' + owner + '/' + p.repo : null };
    if (p.localhost) return { kind: 'local', label: 'רץ במחשב שלי', open: p.localhost };
    var repo = state.repos && state.repos[p.repo.toLowerCase()];
    var code = 'https://github.com/' + owner + '/' + p.repo;
    if (p.private) return { kind: 'private', label: 'מאגר פרטי', code: repo ? code : null };
    if (repo) {
      return repo.has_pages
        ? { kind: 'live', label: 'באוויר', open: pagesUrl(p), code: code }
        : { kind: 'wait', label: 'במאגר, בלי Pages', code: code };
    }
    // Without the GitHub list we cannot tell; every local project has been uploaded.
    if (!state.repos) return { kind: 'live', label: 'באוויר', open: pagesUrl(p), code: code };
    return { kind: 'wait', label: 'ממתין להעלאה' };
  }

  // Live screenshot from WordPress mShots. While a shot is being generated it
  // returns a small placeholder, so anything narrower than we asked for is
  // ignored and the illustration stays.
  // Screenshot from portfolio/shots/ (taken by the portfolio-shots workflow).
  // Live sites without one fall back to WordPress mShots; while a shot is being
  // generated mShots returns a small placeholder, which is ignored.
  function shotSrc(p, mobile) {
    if (p.noshot) return null;
    var sh = state.shots && state.shots[p.id];
    return sh ? 'shots/' + p.id + (mobile ? '-m' : '') + '.jpg?v=' + encodeURIComponent(sh.at || '') : null;
  }

  function media(p, s, big) {
    var box = el('div', { class: 'media cat-' + p.category, html: art(p.category) });
    var local = shotSrc(p, false);
    var w = big ? 1200 : 800;
    var src = local || (!p.noshot && s.open && /^https:/.test(s.open) ? 'https://s0.wp.com/mshots/v1/' + encodeURIComponent(s.open) + '?w=' + w + '&h=' + Math.round(w * 0.62) : null);
    if (src) {
      var img = el('img', { alt: 'צילום מסך של ' + p.title, loading: 'lazy', decoding: 'async', src: src });
      img.addEventListener('load', function () { if (local || img.naturalWidth >= w * 0.9) img.classList.add('ok'); });
      box.appendChild(img);
      box.appendChild(el('div', { class: 'shade' }));
    }
    return box;
  }

  var ICON_GLOBE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.8 8h12.4M8 1.8c-2.2 3-2.2 9.4 0 12.4M8 1.8c2.2 3 2.2 9.4 0 12.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var ICON_EYE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
  var ICON_TALK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 3v-3H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 6.5h6M5 8.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

  // Visit counts live in Abacus, a free counter service (CountAPI's successor).
  // "open-<id>" goes up each time someone opens a project from this page.
  var COUNTER = 'https://abacus.jasoncameron.dev';
  var COUNTER_NS = 'hasadna-devopsdevopshaim';
  var visitCache = {};
  function counter(action, key) {
    return fetch(COUNTER + '/' + action + '/' + COUNTER_NS + '/' + key, action === 'hit' ? { keepalive: true } : undefined)
      .then(function (r) { if (r.status === 404) return { value: 0 }; if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return Number(j.value) || 0; });
  }
  function showVisits(id, n) {
    visitCache[id] = Promise.resolve(n);
    state.opens[id] = n;
    Array.prototype.forEach.call(document.querySelectorAll('[data-visits="' + id + '"]'), function (v) {
      v.querySelector('b').textContent = n.toLocaleString('he-IL');
      v.hidden = false;
    });
  }
  var visitIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      visitIO.unobserve(e.target);
      var id = e.target.getAttribute('data-visits');
      if (!visitCache[id]) visitCache[id] = counter('get', 'open-' + id);
      visitCache[id].then(function (n) { showVisits(id, n); }, function () {});
    });
  }, { rootMargin: '200px' }) : null;

  // Recommendations are GitHub issues made by utterances, one per project.
  var COMMENTS_REPO = 'devops-hub';
  var COMMENTS_LABEL = 'portfolio-comment';
  var recoCounts = {};

  function prettyUrl(u) {
    try {
      var x = new URL(u);
      return (x.host + decodeURIComponent(x.pathname)).replace(/\/$/, '');
    } catch (e) { return u; }
  }

  function actions(s, p) {
    var open = s.open ? el('a', { class: 'link open', href: s.open, target: '_blank', rel: 'noopener', html: 'פתיחה ' + ICON_OUT }) : null;
    if (open && p) open.addEventListener('click', function () {
      if (window.SpiderTrack) window.SpiderTrack.open(p.id);
      counter('hit', 'open-' + p.id).then(function (n) { showVisits(p.id, n); }, function () {});
    });
    var talk = null;
    if (p && window.Guide) {
      talk = el('button', { class: 'link say', type: 'button', html: ICON_TALK + ' ספרי לי', title: 'מאיה, העוזרת האישית, תספר על הפרויקט' });
      talk.addEventListener('click', function () { window.Guide.present(p); });
    }
    return [
      open,
      s.code ? el('a', { class: 'link code', href: s.code, target: '_blank', rel: 'noopener', html: ICON_CODE + ' קוד' }) : null,
      talk
    ];
  }

  // Address and visit count, shown at the bottom of every card.
  function foot(p, s) {
    var url = s.open || s.code;
    var visits = el('span', { class: 'visits', 'data-visits': p.id, title: 'כמה פעמים פתחו את הפרויקט מהאתר הזה', hidden: '', html: ICON_EYE + ' <b>0</b> כניסות' });
    if (visitIO) visitIO.observe(visits);
    return el('div', { class: 'card-foot' }, [
      url ? el('a', { class: 'addr', href: url, target: '_blank', rel: 'noopener', title: url, html: ICON_GLOBE + '<span><bdi dir="ltr"></bdi></span>' }) : el('span', { class: 'addr muted', text: 'אין כתובת ציבורית' }),
      visits
    ]);
  }

  function loadComments(box, p) {
    if (box.dataset.loaded) return;
    box.dataset.loaded = '1';
    var sc = document.createElement('script');
    sc.src = 'https://utteranc.es/client.js';
    sc.async = true;
    sc.setAttribute('repo', state.data.owner + '/' + COMMENTS_REPO);
    sc.setAttribute('issue-term', 'portfolio:' + p.id);
    sc.setAttribute('label', COMMENTS_LABEL);
    sc.setAttribute('theme', 'photon-dark');
    sc.setAttribute('crossorigin', 'anonymous');
    box.appendChild(sc);
  }

  function recoLabel(id) {
    var n = recoCounts[id];
    return 'המלצות' + (n ? ' · ' + n : '');
  }

  function loadRecoCounts() {
    var q = 'repo:' + state.data.owner + '/' + COMMENTS_REPO + ' label:' + COMMENTS_LABEL + ' is:issue';
    fetch('https://api.github.com/search/issues?per_page=100&q=' + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        (j.items || []).forEach(function (it) {
          var m = /^portfolio:(.+)$/.exec(it.title);
          if (m) recoCounts[m[1]] = it.comments;
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-reco-tab]'), function (b) {
          b.textContent = recoLabel(b.getAttribute('data-reco-tab'));
        });
      })
      .catch(function () {});
  }

  // "Overview" and "Recommendations" tabs inside a card.
  function tabs(c, p, info) {
    var reco = el('div', { class: 'pane reco', role: 'tabpanel', hidden: '' }, [
      el('p', { class: 'reco-hint', text: 'ההמלצות נשמרות ב־GitHub ומוצגות לכולם. כדי לכתוב צריך להתחבר עם חשבון GitHub.' }),
      el('div', { class: 'reco-box' })
    ]);
    var tInfo = el('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': 'true', text: 'סקירה' });
    var tReco = el('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': 'false', 'data-reco-tab': p.id, text: recoLabel(p.id) });
    function pick(showReco) {
      tInfo.setAttribute('aria-selected', String(!showReco));
      tReco.setAttribute('aria-selected', String(showReco));
      info.hidden = showReco;
      reco.hidden = !showReco;
      c.classList.toggle('wide', showReco);
      if (showReco) loadComments(reco.querySelector('.reco-box'), p);
    }
    tInfo.addEventListener('click', function () { pick(false); });
    tReco.addEventListener('click', function () { pick(true); });
    return [el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'מידע על ' + p.title }, [tInfo, tReco]), info, reco];
  }

  function card(p) {
    var s = status(p);
    var c = el('article', { class: 'card reveal cat-' + p.category, id: 'p-' + p.id });
    var info = el('div', { class: 'pane info', role: 'tabpanel' }, [
      p.desc ? el('p', { text: p.desc }) : null,
      el('div', { class: 'row' }, actions(s, p))
    ]);
    [
      el('span', { class: 'badge ' + s.kind, text: s.label }),
      el('a', { class: 'media-link', href: '#p/' + p.id, 'aria-label': 'עמוד הפרויקט ' + p.title }, [media(p, s, false)]),
      el('div', { class: 'body' }, [
        el('span', { class: 'cat', text: state.data.categories[p.category] || '' }),
        el('h3', {}, [el('a', { class: 'more', href: '#p/' + p.id, text: p.title })])
      ].concat(tabs(c, p, info))),
      foot(p, s),
      state.admin ? adminStrip(p) : null,
      state.edit ? editStrip(p) : null
    ].forEach(function (n) { if (n) c.appendChild(n); });
    fillAddr(c, s);
    if (state.edit) {
      c.draggable = true;
      c.addEventListener('dragstart', function (e) { state.drag = p.id; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
      c.addEventListener('dragend', function () { state.drag = null; c.classList.remove('dragging'); });
      c.addEventListener('dragover', function (e) { if (state.drag && state.drag !== p.id) { e.preventDefault(); c.classList.add('drop'); } });
      c.addEventListener('dragleave', function () { c.classList.remove('drop'); });
      c.addEventListener('drop', function (e) { e.preventDefault(); c.classList.remove('drop'); dropOn(p.id); });
    }
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    return c;
  }

  function fillAddr(root, s) {
    var span = root.querySelector('.addr bdi');
    if (span) span.textContent = prettyUrl(s.open || s.code);
  }

  function matches(p) {
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    if (state.show === 'live' && status(p).kind !== 'live') return false;
    if (state.show === 'featured' && !p.featured) return false;
    if (!state.query) return true;
    var hay = (p.title + ' ' + (p.desc || '') + ' ' + (p.repo || '') + ' ' + p.id).toLowerCase();
    return hay.indexOf(state.query) !== -1;
  }

  function render() {
    var list = state.data.projects.filter(matches);
    if (state.sort === 'az') list.sort(function (a, b) { return a.title.localeCompare(b.title, 'he'); });
    else if (state.sort === 'popular') list.sort(function (a, b) { return (state.opens[b.id] || 0) - (state.opens[a.id] || 0); });
    else if (state.data.layout && state.data.layout.cats && state.data.layout.cats.length) {
      var keys = catKeys(), pos = {}; keys.forEach(function (k) { ordered(k).forEach(function (p, i) { pos[p.id] = i; }); });
      list = list.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return (state.cat === 'all' ? keys.indexOf(a[0].category) - keys.indexOf(b[0].category) : 0) || (pos[a[0].id] - pos[b[0].id]) || (a[1] - b[1]); }).map(function (x) { return x[0]; });
    }
    grid.replaceChildren.apply(grid, list.map(card));
    if (!list.length) grid.appendChild(el('p', { class: 'empty', text: 'אין פרויקט שמתאים לסינון. נסו לנקות אותו.' }));
    syncFilters();
    document.getElementById('all-title').textContent = state.cat === 'all' ? 'הכול' : state.data.categories[state.cat];
    document.getElementById('all-eyebrow').textContent = list.length + ' פרויקטים';
    observe(grid.querySelectorAll('.reveal'));
    renderStats();
  }

  var homeVisits = null;
  function showHomeVisits() {
    var box = document.getElementById('home-visits');
    if (!box) return;
    box.querySelector('dd').textContent = homeVisits.toLocaleString('he-IL');
    box.hidden = false;
  }
  function countHome() {
    var seen = false;
    try { seen = sessionStorage.getItem('home-counted') === '1'; sessionStorage.setItem('home-counted', '1'); } catch (e) {}
    counter(seen ? 'get' : 'hit', 'home').then(function (n) { homeVisits = n; showHomeVisits(); }, function () {});
  }

  function renderStats() {
    var all = state.data.projects;
    var live = all.filter(function (p) { return status(p).kind === 'live'; }).length;
    var used = {};
    all.forEach(function (p) { used[p.category] = true; });
    var box = document.getElementById('stats');
    box.replaceChildren(
      el('div', {}, [el('dd', { text: String(all.length) }), el('dt', { text: 'פרויקטים' })]),
      el('div', {}, [el('dd', { html: live + '<span class="live-dot" aria-hidden="true"></span>' }), el('dt', { text: 'באוויר עכשיו' })]),
      el('div', {}, [el('dd', { text: String(Object.keys(used).length) }), el('dt', { text: 'תחומים' })]),
      el('div', { id: 'home-visits', hidden: '' }, [el('dd', { text: '0' }), el('dt', { text: 'ביקורים בסדנה' })])
    );
    if (homeVisits !== null) showHomeVisits();
  }

  function renderFeatured() {
    var box = document.getElementById('featured-list');
    if (!box) return;
    var list = state.data.projects.filter(function (p) { return p.featured; }).slice(0, 3);
    box.replaceChildren.apply(box, list.map(function (p, i) {
      var s = status(p);
      return el('article', { class: 'fcard reveal cat-' + p.category, style: '--rd:' + i * 120 + 'ms' }, [
        el('span', { class: 'badge ' + s.kind, text: s.label }),
        el('a', { class: 'media-link', href: '#p/' + p.id, 'aria-label': 'עמוד הפרויקט ' + p.title }, [media(p, s, i === 0)]),
        el('div', { class: 'body' }, [
          el('h3', {}, [el('a', { class: 'more', href: '#p/' + p.id, text: p.title })]),
          p.desc ? el('p', { text: p.desc }) : null,
          el('div', { class: 'row' }, actions(s, p))
        ]),
        foot(p, s)
      ]);
    }));
    Array.prototype.forEach.call(box.querySelectorAll('.fcard'), function (f, i) { fillAddr(f, status(list[i])); });
    observe(box.querySelectorAll('.reveal'));
  }

  // ---------- filter bar ----------
  var fCat = document.getElementById('f-cat');
  var fLive = document.getElementById('f-live');
  var fSort = document.getElementById('f-sort');
  var fReset = document.getElementById('f-reset');

  function fillCatSelect() {
    var used = {};
    state.data.projects.forEach(function (p) { used[p.category] = (used[p.category] || 0) + 1; });
    fCat.replaceChildren(el('option', { value: 'all', text: 'כל התחומים' }));
    Object.keys(state.data.categories).forEach(function (k) {
      if (used[k]) fCat.appendChild(el('option', { value: k, text: state.data.categories[k] + ' (' + used[k] + ')' }));
    });
  }
  function syncFilters() {
    fCat.value = state.cat;
    fLive.value = state.show;
    fSort.value = state.sort;
    fReset.hidden = state.cat === 'all' && state.show === 'all' && state.sort === 'default' && !state.query;
  }
  // "Most opened" needs every count, not only the ones for cards already seen.
  function loadAllOpens() {
    return Promise.all(state.data.projects.map(function (p) {
      if (!visitCache[p.id]) visitCache[p.id] = counter('get', 'open-' + p.id);
      return visitCache[p.id].then(function (n) { state.opens[p.id] = n; }, function () {});
    }));
  }
  fCat.addEventListener('change', function () { selectCat(fCat.value); });
  fLive.addEventListener('change', function () { state.show = fLive.value; render(); });
  fSort.addEventListener('change', function () {
    state.sort = fSort.value;
    render();
    if (state.sort === 'popular') loadAllOpens().then(function () { if (state.sort === 'popular') render(); });
  });
  fReset.addEventListener('click', function () {
    state.show = 'all'; state.sort = 'default'; state.query = ''; q.value = '';
    selectCat('all');
  });

  // ---------- admin-only controls ----------
  // Shown in the browser where the admin screen was opened. They only open a
  // GitHub issue; the portfolio-manage workflow carries it out only when the
  // issue comes from the repository owner, so nobody else can delete.
  try { state.admin = localStorage.getItem('hasadna-admin') === '1' && !/[?&]view=client\b/.test(location.search); } catch (e) { state.admin = false; }

  function adminIssue(op, p) {
    var word = { delete: 'מחיקה', hide: 'הסתרה' }[op];
    var body = 'בקשה מהאתר, במצב מנהל. GitHub יבצע אותה רק אם נפתחה מחשבון המנהל.\n\n- ' + word + ': ' + p.title +
      '\n\n```json\n' + JSON.stringify({ ops: [{ op: op, id: p.id }] }) + '\n```\n';
    window.open('https://github.com/' + state.data.owner + '/' + COMMENTS_REPO + '/issues/new?title=' +
      encodeURIComponent('ניהול: ' + word + ': ' + p.title) + '&body=' + encodeURIComponent(body), '_blank', 'noopener');
    takeOff(p, word);
  }

  // The card leaves the admin's view right away; the site itself follows once
  // GitHub has run the issue (about two minutes). Remembered for 20 minutes.
  var REMOVED_KEY = 'hasadna-removed';
  function removedIds() {
    try {
      var m = JSON.parse(localStorage.getItem(REMOVED_KEY) || '{}'), now = Date.now(), out = {};
      Object.keys(m).forEach(function (id) { if (now - m[id] < 20 * 60 * 1000) out[id] = m[id]; });
      return out;
    } catch (e) { return {}; }
  }
  function saveRemoved(m) { try { localStorage.setItem(REMOVED_KEY, JSON.stringify(m)); } catch (e) {} }
  function takeOff(p, word) {
    var m = removedIds(); m[p.id] = Date.now(); saveRemoved(m);
    state.data.projects = state.data.projects.filter(function (x) { return x !== p; });
    render(); renderFeatured();
    var undo = el('button', { class: 'g-btn ghost', type: 'button', text: 'ביטול' });
    undo.addEventListener('click', function () {
      var r = removedIds(); delete r[p.id]; saveRemoved(r);
      state.data.projects = state.data.allProjects.filter(function (x) { return !x.hidden && !x.pending && !removedIds()[x.id]; });
      note.hidden = true; render(); renderFeatured();
    });
    note.replaceChildren(document.createTextNode('✓ ' + word + ': "' + p.title + '" ירד מהתצוגה שלך. כדי שירד לכולם, לחצו Create בעמוד GitHub שנפתח. '), undo);
    note.hidden = false;
    note.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function adminStrip(p) {
    var hide = el('button', { type: 'button', text: '◌ הסתרה', title: 'מוריד מהאתר, אפשר להחזיר' });
    var del = el('button', { type: 'button', class: 'del', text: '🗑 מחיקה מהאתר' });
    hide.addEventListener('click', function () { adminIssue('hide', p); });
    del.addEventListener('click', function () {
      if (confirm('למחוק את "' + p.title + '" מהאתר?\nהמאגר ב־GitHub עצמו לא נמחק.\nבעמוד שייפתח ב־GitHub לחצו Create.')) adminIssue('delete', p);
    });
    return el('div', { class: 'admin-strip', 'aria-label': 'פעולות מנהל' }, [hide, del]);
  }
  if (state.admin) document.getElementById('admin-on').hidden = false;

  function selectCat(k) {
    state.cat = k;
    Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (t) {
      t.setAttribute('aria-selected', String(t.dataset.cat === k));
    });
    render();
  }

  // ---------- tabs (the domains) in the left column, and the admin's tools for arranging them ----------
  var layoutApi = '', saveTimer = null, saveMsg = null;
  function catKeys() { return state.data.catOrder || Object.keys(state.data.categories); }
  function catsOpen() { try { return localStorage.getItem('cats-open') === '1'; } catch (e) { return false; } }
  function catCounts() { var c = {}; state.data.projects.forEach(function (p) { c[p.category] = (c[p.category] || 0) + 1; }); return c; }

  function renderTiles() {
    var cats = state.data.categories, counts = catCounts();
    var box = document.getElementById('tiles');
    box.replaceChildren();
    // the domains stay shut (a slim column of icons) until the visitor opens them; editing opens them
    var open = state.edit || catsOpen();
    document.getElementById('top').classList.toggle('cats-closed', !open);
    var keys = ['all'].concat(catKeys().filter(function (k) { return cats[k] && (counts[k] || state.edit); }));
    keys.forEach(function (k, i) {
      var t = el('div', {
        class: 'tile ' + (k === 'all' ? 'all' : 'cat-' + k), role: 'tab', tabindex: '0',
        'aria-selected': String(k === state.cat), 'data-cat': k, title: k === 'all' ? 'הכול' : cats[k]
      }, [
        el('span', { class: 'tile-art', html: art(k === 'all' ? 'web' : k) }),
        el('span', { class: 'tile-txt' }, [
          el('b', { text: k === 'all' ? 'הכול' : cats[k] }),
          el('small', { text: (k === 'all' ? state.data.projects.length : (counts[k] || 0)) + ' פרויקטים' })
        ])
      ]);
      function go() { selectCat(k); var all = document.getElementById('all'); if (all && all.getBoundingClientRect().top > window.innerHeight * 0.55) all.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
      t.addEventListener('click', function (e) { if (!e.target.closest('.tile-tools')) go(); });
      t.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.tile-tools')) { e.preventDefault(); go(); } });
      if (state.edit && k !== 'all') {
        var tools = el('span', { class: 'tile-tools' });
        [['▲', 'הזזה למעלה', function () { moveCat(k, -1); }], ['▼', 'הזזה למטה', function () { moveCat(k, 1); }], ['✎', 'שינוי שם', function () { renameCat(k); }], ['✕', 'מחיקת הלשונית', function () { deleteCat(k); }]]
          .forEach(function (d) { var bt = el('button', { type: 'button', title: d[1], 'aria-label': d[1], text: d[0] }); bt.addEventListener('click', d[2]); tools.appendChild(bt); });
        t.appendChild(tools);
      }
      // a card dropped on a tab moves to that tab (admin editing only)
      if (state.edit && k !== 'all') {
        t.addEventListener('dragover', function (e) { if (state.drag) { e.preventDefault(); t.classList.add('drop'); } });
        t.addEventListener('dragleave', function () { t.classList.remove('drop'); });
        t.addEventListener('drop', function (e) { e.preventDefault(); t.classList.remove('drop'); if (state.drag) moveCard(state.drag, k); });
      }
      box.appendChild(t);
    });
    var head = document.getElementById('cats-tools');
    if (head) {
      head.replaceChildren();
      var tg = el('button', { type: 'button', class: 'cats-toggle', 'aria-expanded': String(open), title: open ? 'סגירת התחומים' : 'פתיחת התחומים' }, [el('span', { class: 'ct-ico', 'aria-hidden': 'true', text: '☰' }), el('span', { class: 'ct-txt', text: open ? 'סגירה' : 'תחומים' })]);
      tg.addEventListener('click', function () { try { localStorage.setItem('cats-open', open ? '0' : '1'); } catch (e) {} if (state.edit) { state.edit = false; document.documentElement.classList.remove('layout-edit'); } renderTiles(); render(); });
      head.appendChild(tg);
      if (state.isAdmin) {
        var eb = el('button', { type: 'button', class: 'cats-edit' + (state.edit ? ' on' : ''), text: state.edit ? '✓ סיום עריכה' : '✎ עריכת תחומים וסדר' });
        eb.addEventListener('click', function () { state.edit = !state.edit; document.documentElement.classList.toggle('layout-edit', state.edit); renderTiles(); render(); });
        head.appendChild(eb);
        if (state.edit) {
          var add = el('button', { type: 'button', class: 'cats-add', text: '+ לשונית חדשה' });
          add.addEventListener('click', addCat);
          var rs = el('button', { type: 'button', class: 'cats-reset', text: 'איפוס לסדר המקורי' });
          rs.addEventListener('click', resetLayout);
          saveMsg = el('small', { class: 'cats-msg', 'aria-live': 'polite' });
          head.append(add, rs, saveMsg);
        }
      }
    }
  }

  // The working copy of the arrangement: tabs in order, the order of the sites inside each tab, and sites moved to another tab.
  function currentLayout() {
    var L = { cats: [], order: {}, moved: {} };
    catKeys().forEach(function (k) { if (state.data.categories[k]) L.cats.push({ id: k, name: state.data.categories[k] }); });
    state.data.allProjects.forEach(function (p) { if (p.category !== p.origCategory) L.moved[p.id] = p.category; });
    L.cats.forEach(function (c) { L.order[c.id] = ordered(c.id).map(function (p) { return p.id; }); });
    return L;
  }
  function ordered(cat) {
    var list = state.data.allProjects.filter(function (p) { return p.category === cat; });
    var o = (state.data.layout && state.data.layout.order && state.data.layout.order[cat]) || [];
    return list.map(function (p, i) { return [p, i]; }).sort(function (a, b) {
      var x = o.indexOf(a[0].id), y = o.indexOf(b[0].id);
      x = x < 0 ? 1e6 + a[1] : x; y = y < 0 ? 1e6 + b[1] : y; return x - y;
    }).map(function (a) { return a[0]; });
  }
  function commit(msg) {
    var L = currentLayout();
    state.data.layout = L;
    var vis = {}; state.data.projects.forEach(function (p) { vis[p.id] = 1; });
    state.data.projects = state.data.allProjects.filter(function (p) { return vis[p.id]; });
    if (!state.data.categories[state.cat] && state.cat !== 'all') state.cat = 'all';
    fillCatSelect(); renderTiles(); render();
    if (saveMsg) saveMsg.textContent = 'שומר…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var b = new URLSearchParams({ action: 'save', token: window.HasadnaAuth ? window.HasadnaAuth.token() : '', layout: JSON.stringify(L) });
      fetch(layoutApi, { method: 'POST', body: b }).then(function (r) { return r.json(); }).then(function (j) {
        if (saveMsg) saveMsg.textContent = j && j.ok ? '✓ נשמר ומופיע לכולם' : 'לא נשמר (' + (j && j.error || 'שגיאה') + ')';
      }).catch(function () { if (saveMsg) saveMsg.textContent = 'לא נשמר: אין חיבור לשרת'; });
    }, 500);
  }
  function moveCat(k, d) {
    var keys = catKeys().slice(), i = keys.indexOf(k), j = i + d;
    if (j < 0 || j >= keys.length) return;
    keys.splice(i, 1); keys.splice(j, 0, k);
    state.data.catOrder = keys; commit();
  }
  function renameCat(k) {
    var n = prompt('שם חדש ללשונית:', state.data.categories[k]);
    if (!n || !n.trim()) return;
    state.data.categories[k] = n.trim().slice(0, 40); commit();
  }
  function addCat() {
    var n = prompt('שם הלשונית החדשה:');
    if (!n || !n.trim()) return;
    var id = 'c-' + Date.now().toString(36);
    state.data.categories[id] = n.trim().slice(0, 40);
    state.data.catOrder = catKeys().concat(id); commit();
  }
  function deleteCat(k) {
    var keys = catKeys().filter(function (x) { return x !== k; });
    if (!keys.length) { alert('חייבת להישאר לפחות לשונית אחת.'); return; }
    var target = keys.indexOf('other') >= 0 ? 'other' : keys[0];
    var n = state.data.allProjects.filter(function (p) { return p.category === k; }).length;
    if (!confirm('למחוק את הלשונית "' + state.data.categories[k] + '"?' + (n ? '\n' + n + ' אתרים יעברו ללשונית "' + state.data.categories[target] + '".' : ''))) return;
    state.data.allProjects.forEach(function (p) { if (p.category === k) p.category = target; });
    delete state.data.categories[k]; state.data.catOrder = keys; commit();
  }
  function moveCard(id, cat) {
    var p = state.data.allProjects.filter(function (x) { return x.id === id; })[0];
    if (!p || p.category === cat) return;
    p.category = cat;
    var L = state.data.layout || { order: {} }; L.order = L.order || {};
    Object.keys(L.order).forEach(function (c) { L.order[c] = (L.order[c] || []).filter(function (x) { return x !== id; }); });
    L.order[cat] = (L.order[cat] || ordered(cat).map(function (x) { return x.id; })).filter(function (x) { return x !== id; }).concat(id);
    state.data.layout = L; commit();
  }
  function shiftCard(id, d) {
    var p = state.data.allProjects.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var ids = ordered(p.category).map(function (x) { return x.id; }), i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    ids.splice(i, 1); ids.splice(j, 0, id);
    var L = state.data.layout || { order: {} }; L.order = L.order || {}; L.order[p.category] = ids;
    state.data.layout = L; commit();
  }
  function dropOn(targetId) {
    var d = state.drag; if (!d || d === targetId) return;
    var a = state.data.allProjects.filter(function (x) { return x.id === d; })[0], b = state.data.allProjects.filter(function (x) { return x.id === targetId; })[0];
    if (!a || !b) return;
    if (a.category !== b.category) { moveCard(d, b.category); }
    var ids = ordered(b.category).map(function (x) { return x.id; }).filter(function (x) { return x !== d; });
    ids.splice(ids.indexOf(targetId), 0, d);
    var L = state.data.layout || { order: {} }; L.order = L.order || {}; L.order[b.category] = ids;
    state.data.layout = L; commit();
  }
  function resetLayout() {
    if (!confirm('לאפס את הלשוניות והסדר לברירת המחדל מהקובץ?')) return;
    state.data.categories = Object.assign({}, state.data.baseCategories); state.data.catOrder = Object.keys(state.data.baseCategories);
    state.data.allProjects.forEach(function (p) { p.category = p.origCategory; });
    state.data.layout = { cats: [], order: {}, moved: {} };
    commit();
  }
  function editStrip(p) {
    var cats = state.data.categories;
    var sel = el('select', { 'aria-label': 'העברה ללשונית' }, catKeys().filter(function (k) { return cats[k]; }).map(function (k) { return el('option', { value: k, text: cats[k] }); }));
    sel.value = p.category;
    sel.addEventListener('change', function () { moveCard(p.id, sel.value); });
    var l = el('button', { type: 'button', title: 'קודם', 'aria-label': 'הזזה אחורה', text: '▶' }), r = el('button', { type: 'button', title: 'אחרי', 'aria-label': 'הזזה קדימה', text: '◀' });
    l.addEventListener('click', function () { shiftCard(p.id, -1); }); r.addEventListener('click', function () { shiftCard(p.id, 1); });
    return el('div', { class: 'edit-strip', 'aria-label': 'סידור האתר' }, [el('span', { class: 'grip', title: 'אפשר גם לגרור', text: '⠿' }), l, r, sel]);
  }

  // ---------- orbit ----------
  function renderOrbit() {
    var svg = document.getElementById('orbit-svg');
    var tip = document.getElementById('orbit-tip');
    var fig = document.getElementById('orbit');
    var NS = 'http://www.w3.org/2000/svg';
    var TILT = 0.5;
    var radii = [118, 180, 245];
    var core = document.getElementById('orbit-core');
    var hues = getComputedStyle(document.documentElement);

    radii.forEach(function (r, i) {
      var e = document.createElementNS(NS, 'ellipse');
      e.setAttribute('rx', r); e.setAttribute('ry', r * TILT);
      e.setAttribute('class', 'ring' + (i === 1 ? ' dash' : ''));
      svg.insertBefore(e, core);
    });

    var list = state.data.projects.slice().sort(function (a, b) { return a.category < b.category ? -1 : 1; });
    var perRing = [[], [], []];
    list.forEach(function (p, i) { perRing[i % 3].push(p); });

    var nodes = [];
    perRing.forEach(function (ring, ri) {
      ring.forEach(function (p, i) {
        var color = hues.getPropertyValue('--cat-' + p.category).trim() || '#8b7bff';
        var g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'node');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', p.title);
        var halo = document.createElementNS(NS, 'circle');
        halo.setAttribute('class', 'halo'); halo.setAttribute('r', 11); halo.setAttribute('fill', color);
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', 4.5); dot.setAttribute('fill', color);
        g.appendChild(halo); g.appendChild(dot);
        svg.appendChild(g);
        var n = { front: true, p: p, g: g, r: radii[ri], a: (i / ring.length) * Math.PI * 2 + ri * 0.7, speed: [0.0021, -0.0014, 0.0009][ri], x: 0, y: 0 };
        nodes.push(n);

        function show() {
          tip.innerHTML = '';
          tip.appendChild(document.createTextNode(p.title));
          tip.appendChild(el('small', { text: state.data.categories[p.category] || '' }));
          place(n);
          tip.hidden = false;
          paused = true;
        }
        function hide() { tip.hidden = true; paused = false; }
        g.addEventListener('pointerenter', show);
        g.addEventListener('pointerleave', hide);
        g.addEventListener('focus', show);
        g.addEventListener('blur', hide);
        function go() { jumpTo(p); }
        g.addEventListener('click', go);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    });

    function place(n) {
      var box = svg.viewBox.baseVal;
      var rect = svg.getBoundingClientRect();
      var fr = fig.getBoundingClientRect();
      var sx = rect.width / box.width, sy = rect.height / box.height;
      tip.style.left = (rect.left - fr.left + (n.x - box.x) * sx) + 'px';
      tip.style.top = (rect.top - fr.top + (n.y - box.y) * sy) + 'px';
    }

    var paused = false;
    function frame() {
      nodes.forEach(function (n) {
        if (!paused) n.a += n.speed;
        n.x = Math.cos(n.a) * n.r;
        n.y = Math.sin(n.a) * n.r * TILT;
        var depth = (Math.sin(n.a) + 1) / 2; // 0 = back, 1 = front
        n.g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ') scale(' + (0.7 + depth * 0.6).toFixed(2) + ')');
        n.g.style.opacity = (0.4 + depth * 0.6).toFixed(2);
        // pass behind the core on the far side of the ring, in front of it on the near side
        var front = depth > 0.5;
        if (front !== n.front) { n.front = front; if (front) svg.appendChild(n.g); else svg.insertBefore(n.g, core); }
      });
      if (!reduceMotion) requestAnimationFrame(frame);
    }
    frame();

    // count up the number in the core
    var target = state.data.projects.length, num = document.getElementById('core-num');
    if (reduceMotion) { num.textContent = target; return; }
    var t0 = performance.now();
    (function count(t) {
      var k = Math.min(1, (t - t0) / 1400);
      num.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(count);
    })(t0);
  }

  function jumpTo(p) {
    if (state.cat !== 'all' && state.cat !== p.category) selectCat('all');
    var c = document.getElementById('p-' + p.id);
    if (!c) { state.query = ''; q.value = ''; selectCat('all'); c = document.getElementById('p-' + p.id); }
    if (!c) return null;
    c.classList.add('in');
    c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
    return c;
  }

  // The guide's spotlight: one card at a time glows while he talks about it.
  function spotlight(p) {
    Array.prototype.forEach.call(document.querySelectorAll('.card.spot'), function (n) { n.classList.remove('spot'); });
    if (!p) return null;
    if (!detail.hidden) {
      if (location.hash !== '#p/' + p.id) location.hash = '#p/' + p.id;
      return detailBody.querySelector('.d-hero');
    }
    var c = jumpTo(p);
    if (c) c.classList.add('spot');
    return c;
  }

  // ---------- project page (#p/<id>) ----------
  var detail = document.getElementById('detail');
  var detailBody = document.getElementById('detail-body');
  var lastScroll = 0;
  var ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function devices(p, s) {
    var desk = shotSrc(p, false), phone = shotSrc(p, true);
    var screen = function (src, alt) {
      var box = el('div', { class: 'screen media cat-' + p.category, html: art(p.category) });
      if (src) {
        var img = el('img', { alt: alt, src: src });
        img.addEventListener('load', function () { img.classList.add('ok'); });
        box.appendChild(img);
      } else if (s.open && /^https:/.test(s.open)) {
        box.replaceWith(media(p, s, true));
        return media(p, s, true);
      }
      return box;
    };
    var kids = [el('div', { class: 'laptop' }, [el('div', { class: 'bar', html: '<i></i><i></i><i></i>' }), screen(desk, 'צילום מסך במחשב של ' + p.title)])];
    if (phone) kids.push(el('div', { class: 'phone' }, [screen(phone, 'צילום מסך בטלפון של ' + p.title)]));
    return el('div', { class: 'devices' + (phone ? '' : ' solo') }, kids);
  }

  function renderDetail(p) {
    var s = status(p);
    var list = state.data.projects;
    var i = list.indexOf(p);
    var prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    var cat = state.data.categories[p.category] || '';
    var related = list.filter(function (x) { return x.category === p.category && x !== p; }).slice(0, 3);

    var nav = el('div', { class: 'd-nav' }, [
      el('a', { class: 'd-back', href: '#all', html: '<span aria-hidden="true">→</span> לכל הפרויקטים' }),
      el('div', { class: 'd-step' }, [
        el('a', { href: '#p/' + prev.id, title: prev.title, html: '<span aria-hidden="true">→</span> הקודם' }),
        el('span', { text: (i + 1) + ' / ' + list.length }),
        el('a', { href: '#p/' + next.id, title: next.title, html: 'הבא <span aria-hidden="true">←</span>' })
      ])
    ]);

    var reco = el('div', { class: 'reco-box' });
    var sections = [
      el('header', { class: 'd-hero cat-' + p.category }, [
        el('div', { class: 'd-copy' }, [
          el('p', { class: 'eyebrow', text: cat }),
          el('h1', { id: 'detail-title', text: p.title }),
          el('p', { class: 'lead', text: p.desc || '' }),
          el('div', { class: 'd-meta' }, [el('span', { class: 'badge static ' + s.kind, text: s.label })].concat(
            (p.tech || []).slice(0, 4).map(function (t) { return el('span', { class: 'chip-tech', text: t }); }))),
          el('div', { class: 'row' }, actions(s, p)),
          foot(p, s)
        ]),
        devices(p, s)
      ])
    ];
    if (p.story) sections.push(el('section', { class: 'd-sec d-story' }, [
      el('p', { class: 'hand', text: 'למה בניתי את זה' }),
      el('blockquote', { text: p.story })
    ]));
    if (p.features && p.features.length) sections.push(el('section', { class: 'd-sec' }, [
      el('h2', { text: 'מה אפשר לעשות' }),
      el('ul', { class: 'd-features' }, p.features.map(function (f) { return el('li', { html: ICON_CHECK }, [el('span', { text: f })]); }))
    ]));
    if (p.tech && p.tech.length) sections.push(el('section', { class: 'd-sec' }, [
      el('h2', { text: 'בנוי עם' }),
      el('div', { class: 'd-tech' }, p.tech.map(function (t) { return el('span', { class: 'chip-tech big', text: t }); }))
    ]));
    sections.push(el('section', { class: 'd-sec d-skill' }, [
      el('h2', { text: 'סקיל ל־Claude' }),
      el('p', { text: 'קובץ שמלמד את Claude הכול על הפרויקט הזה: מה הוא עושה, איך משתמשים בו, איך הוא בנוי ואיך משנים אותו. אחרי שמוסיפים אותו, אפשר פשוט לשאול את Claude על "' + p.title + '".' }),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-gold btn-sm', href: 'skills/' + p.id + '.zip', download: p.id + '.zip', text: '⬇ הורדת הסקיל' }),
        el('a', { class: 'btn btn-ghost btn-sm', href: 'skills/' + p.id + '/SKILL.md', target: '_blank', rel: 'noopener', text: 'לראות מה כתוב בו' })
      ]),
      el('ol', { class: 'd-skill-how' }, [
        el('li', {}, [document.createTextNode('ב־claude.ai: הגדרות ← Capabilities ← Skills ← Upload skill, ובוחרים את קובץ ה־zip.')]),
        el('li', {}, [document.createTextNode('ב־Claude Code: פותחים את ה־zip לתוך התיקייה '), el('code', { dir: 'ltr', text: '~/.claude/skills' })])
      ])
    ]));
    sections.push(el('section', { class: 'd-sec' }, [
      el('h2', { text: 'המלצות והערות' }),
      el('p', { class: 'reco-hint', text: 'ההמלצות נשמרות ב־GitHub ומוצגות לכולם. כדי לכתוב צריך להתחבר עם חשבון GitHub.' }),
      reco
    ]));
    if (related.length) sections.push(el('section', { class: 'd-sec' }, [
      el('h2', { text: 'עוד בתחום ' + cat }),
      el('div', { class: 'grid d-related' }, related.map(function (r) {
        var rs = status(r);
        return el('a', { class: 'mini cat-' + r.category, href: '#p/' + r.id }, [media(r, rs, false), el('b', { text: r.title }), el('small', { text: r.desc || '' })]);
      }))
    ]));

    fillAddr(sections[0], s);
    detailBody.replaceChildren.apply(detailBody, [nav].concat(sections));
    loadComments(reco, p);
    document.title = p.title + ' · SPIDER';
  }

  function openDetail(id) {
    var p = state.data && state.data.projects.filter(function (x) { return x.id === id; })[0];
    if (!p) return closeDetail();
    if (detail.hidden) lastScroll = window.scrollY;
    renderDetail(p);
    detail.hidden = false;
    document.documentElement.classList.add('detail-open');
    detail.scrollTop = 0;
    document.getElementById('detail-title').focus({ preventScroll: true });
  }

  function closeDetail() {
    if (detail.hidden) return;
    detail.hidden = true;
    document.documentElement.classList.remove('detail-open');
    document.title = 'הפרויקטים שלי';
    detailBody.replaceChildren();
    if (!/^#(all|featured|fields|how|top)$/.test(location.hash)) window.scrollTo(0, lastScroll);
  }

  function route() {
    var m = /^#p\/(.+)$/.exec(location.hash);
    if (m) openDetail(decodeURIComponent(m[1])); else closeDetail();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !detail.hidden) { history.pushState('', '', location.pathname); closeDetail(); }
  });

  // ---------- live status from n8n ----------
  function loadLiveStatus(url) {
    if (!url) return;
    var link = document.getElementById('nav-status');
    if (link) { link.href = url; link.hidden = false; }
    fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'format=json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.results || !j.results.length) return;
        state.live = {};
        j.results.forEach(function (r) { state.live[r.id] = r; });
        render();
        renderFeatured();
      })
      .catch(function () {});
  }

  // ---------- extra repos ----------
  function renderExtra(list) {
    if (document.documentElement.classList.contains('client-mode')) return; // clients see only their own sites
    var known = {};
    state.data.projects.forEach(function (p) { if (p.repo) known[p.repo.toLowerCase()] = true; });
    var extra = list.filter(function (r) { return !known[r.name.toLowerCase()] && !r.fork && !r.private; });
    if (!extra.length) return;
    var box = document.getElementById('extra');
    extra.forEach(function (r) {
      var p = { id: 'x-' + r.name, title: r.name, desc: r.description, category: 'web' };
      var s = { kind: 'live', open: r.has_pages ? 'https://' + state.data.owner + '.github.io/' + r.name + '/' : null, code: r.html_url };
      box.appendChild(el('article', { class: 'card reveal cat-web' }, [
        media(p, s, false),
        el('div', { class: 'body' }, [
          el('span', { class: 'cat', text: r.language || 'GitHub' }),
          el('h3', { text: r.name }),
          r.description ? el('p', { text: r.description }) : null,
          el('div', { class: 'row' }, actions(s))
        ])
      ]));
    });
    document.getElementById('extra-wrap').hidden = false;
    observe(box.querySelectorAll('.reveal'));
  }

  // ---------- scroll reveal ----------
  var io = ('IntersectionObserver' in window && !reduceMotion)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' })
    : null;
  function observe(nodes) {
    Array.prototype.forEach.call(nodes, function (n) { if (io) io.observe(n); else n.classList.add('in'); });
  }
  observe(document.querySelectorAll('.reveal'));

  function loadRepos(owner) {
    return fetch('https://api.github.com/users/' + owner + '/repos?per_page=100&sort=updated')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        state.repos = {};
        list.forEach(function (r) { state.repos[r.name.toLowerCase()] = r; });
        render();
        renderFeatured();
        renderExtra(list);
      })
      .catch(function () { /* statuses stay on their defaults */ });
  }

  // Client view (?view=client): look and open only. Remembered for the visit.
  try {
    if (/[?&]view=client\b/.test(location.search)) sessionStorage.setItem('view', 'client');
    if (sessionStorage.getItem('view') === 'client') document.documentElement.classList.add('client-mode');
  } catch (e) {
    if (/[?&]view=client\b/.test(location.search)) document.documentElement.classList.add('client-mode');
  }

  q.addEventListener('input', function () { state.query = q.value.trim().toLowerCase(); render(); });

  Promise.all([
    fetch('projects.json').then(function (r) { return r.json(); }),
    fetch('shots/index.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    window.HasadnaAuth ? window.HasadnaAuth.ready : Promise.resolve({ role: 'admin', sites: 'all' }),
    // how the admin arranged the tabs and cards (kept on the Cloudflare server); the page works without it
    fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
      if (!cfg || !/^https:\/\//.test(cfg.base || '')) return null;
      layoutApi = cfg.base.replace(/\/$/, '') + '/hasadna-layout';
      return Promise.race([fetch(layoutApi, { method: 'POST', body: new URLSearchParams({ action: 'get' }) }).then(function (r) { return r.json(); }), new Promise(function (ok) { setTimeout(function () { ok(null); }, 6000); })]).then(function (j) { return j && j.layout || null; });
    }).catch(function () { return null; })
  ])
    .then(function (res) {
      var data = res[0];
      state.shots = res[1];
      // a client sees only the sites the admin gave them
      var who = res[2];
      // the clients' link never shows the lotto sites or the insurance analysis (projects.json: clientHide)
      var hideC = {};
      (data.clientHide || []).forEach(function (id) { hideC[id] = true; });
      // only a signed-in admin sees them (on the main page too); clients, visitors and the open site (sign-in switched off) never do
      if (!who || who.role !== 'admin' || who.open || /[?&]view=client\b/.test(location.search)) {
        data.projects = data.projects.filter(function (p) { return !hideC[p.id]; });
      }
      if (who && who.role === 'client') {
        var mine = {};
        (who.sites || []).forEach(function (id) { mine[id] = true; });
        data.projects = data.projects.filter(function (p) { return mine['*'] || mine[p.id]; });
        document.documentElement.classList.add('client-mode');
      }
      // Hidden projects and ones still waiting for approval stay off the public site.
      data.allProjects = data.projects;
      var gone = state.admin ? removedIds() : {};
      data.projects = data.projects.filter(function (p) { return !p.hidden && !p.pending && !gone[p.id]; });
      // the admin's arrangement: tabs in their order, sites moved between tabs, and the order inside a tab
      data.baseCategories = Object.assign({}, data.categories);
      data.catOrder = Object.keys(data.categories);
      data.allProjects.forEach(function (p) { p.origCategory = p.category; });
      var L = res[3];
      if (L && L.cats && L.cats.length) {
        var cats = {}; L.cats.forEach(function (c) { cats[c.id] = c.name; });
        data.categories = cats; data.catOrder = L.cats.map(function (c) { return c.id; });
        var fallback = cats.other ? 'other' : data.catOrder[0];
        data.allProjects.forEach(function (p) { var c = (L.moved && L.moved[p.id]) || p.category; p.category = cats[c] ? c : fallback; });
        data.layout = L;
      }
      state.isAdmin = !!(who && who.role === 'admin' && !who.open && !/[?&]view=client\b/.test(location.search) && layoutApi);
      state.data = data;
      fillCatSelect();
      document.getElementById('gh-link').href = 'https://github.com/' + data.owner;
      document.getElementById('gh-top').href = 'https://github.com/' + data.owner;
      renderOrbit();
      renderTiles();
      render();
      loadRepos(data.owner);
      loadRecoCounts();
      loadLiveStatus(data.statusUrl);
      countHome();
      // Maya's brain lives on the Cloudflare server (no execution cap); the n8n address is the fallback. A client's questions
      // carry the ids hidden from clients, so she never speaks about them.
      fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; }).then(function (cfg) {
        var cf = cfg && /^https:\/\//.test(cfg.base || '') ? cfg.base.replace(/\/$/, '') + '/hasadna-guide' : '';
        if (window.Guide) window.Guide.init({
          projects: data.projects,
          categories: data.categories,
          status: status,
          focusProject: spotlight,
          guideApi: cf || data.guideApi || '',
          exclude: who && who.role === 'client' ? (data.clientHide || []) : [],
          filter: selectCat
        });
      });
      route();
    })
    .catch(function () {
      note.textContent = 'לא הצלחתי לטעון את רשימת הפרויקטים. אם פתחתם את הקובץ ישירות מהמחשב, פתחו אותו דרך שרת (למשל npx serve).';
      note.hidden = false;
    });
})();
