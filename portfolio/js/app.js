(function () {
  'use strict';

  var art = window.PORTFOLIO_ART;
  var grid = document.getElementById('grid');
  var q = document.getElementById('q');
  var note = document.getElementById('note');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state = { cat: 'all', query: '', data: null, repos: null };

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
  function status(p) {
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
  function media(p, s, big) {
    var box = el('div', { class: 'media cat-' + p.category, html: art(p.category) });
    if (s.open && /^https:/.test(s.open)) {
      var w = big ? 1200 : 800;
      var img = el('img', { alt: '', loading: 'lazy', decoding: 'async', src: 'https://s0.wp.com/mshots/v1/' + encodeURIComponent(s.open) + '?w=' + w + '&h=' + Math.round(w * 0.62) });
      img.addEventListener('load', function () { if (img.naturalWidth >= w * 0.9) img.classList.add('ok'); });
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
      counter('hit', 'open-' + p.id).then(function (n) { showVisits(p.id, n); }, function () {});
    });
    var talk = null;
    if (p && window.Guide) {
      talk = el('button', { class: 'link say', type: 'button', html: ICON_TALK + ' ספר לי', title: 'גיא יספר על הפרויקט' });
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
      media(p, s, false),
      el('div', { class: 'body' }, [
        el('span', { class: 'cat', text: state.data.categories[p.category] || '' }),
        el('h3', { text: p.title })
      ].concat(tabs(c, p, info))),
      foot(p, s)
    ].forEach(function (n) { c.appendChild(n); });
    fillAddr(c, s);
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
    if (!state.query) return true;
    var hay = (p.title + ' ' + (p.desc || '') + ' ' + (p.repo || '') + ' ' + p.id).toLowerCase();
    return hay.indexOf(state.query) !== -1;
  }

  function render() {
    var list = state.data.projects.filter(matches);
    grid.replaceChildren.apply(grid, list.map(card));
    if (!list.length) grid.appendChild(el('p', { class: 'empty', text: 'אין פרויקט בשם הזה. נסו מילה אחרת או בחרו "הכול".' }));
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
    var list = state.data.projects.filter(function (p) { return p.featured; }).slice(0, 3);
    box.replaceChildren.apply(box, list.map(function (p, i) {
      var s = status(p);
      return el('article', { class: 'fcard reveal cat-' + p.category, style: '--rd:' + i * 120 + 'ms' }, [
        el('span', { class: 'badge ' + s.kind, text: s.label }),
        media(p, s, i === 0),
        el('div', { class: 'body' }, [
          el('h3', { text: p.title }),
          p.desc ? el('p', { text: p.desc }) : null,
          el('div', { class: 'row' }, actions(s, p))
        ]),
        foot(p, s)
      ]);
    }));
    Array.prototype.forEach.call(box.querySelectorAll('.fcard'), function (f, i) { fillAddr(f, status(list[i])); });
    observe(box.querySelectorAll('.reveal'));
  }

  function selectCat(k) {
    state.cat = k;
    Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (t) {
      t.setAttribute('aria-selected', String(t.dataset.cat === k));
    });
    render();
  }

  function renderTiles() {
    var cats = state.data.categories;
    var counts = {};
    state.data.projects.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var box = document.getElementById('tiles');
    var keys = ['all'].concat(Object.keys(cats).filter(function (k) { return counts[k]; }));
    keys.forEach(function (k, i) {
      var t = el('button', {
        class: 'tile reveal ' + (k === 'all' ? 'all' : 'cat-' + k), type: 'button', role: 'tab',
        'aria-selected': String(k === state.cat), 'data-cat': k, style: '--rd:' + i * 60 + 'ms'
      }, [
        el('span', { html: art(k === 'all' ? 'web' : k) }),
        el('span', {}, [
          el('b', { text: k === 'all' ? 'הכול' : cats[k] }),
          el('small', { text: (k === 'all' ? state.data.projects.length : counts[k]) + ' פרויקטים' })
        ])
      ]);
      t.addEventListener('click', function () {
        selectCat(k);
        document.getElementById('all').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      box.appendChild(t);
    });
    observe(box.querySelectorAll('.reveal'));
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
    var c = jumpTo(p);
    if (c) c.classList.add('spot');
    return c;
  }

  // ---------- extra repos ----------
  function renderExtra(list) {
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

  q.addEventListener('input', function () { state.query = q.value.trim().toLowerCase(); render(); });

  fetch('projects.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.data = data;
      document.getElementById('gh-link').href = 'https://github.com/' + data.owner;
      document.getElementById('gh-top').href = 'https://github.com/' + data.owner;
      renderOrbit();
      renderFeatured();
      renderTiles();
      render();
      loadRepos(data.owner);
      loadRecoCounts();
      countHome();
      if (window.Guide) window.Guide.init({
        projects: data.projects,
        categories: data.categories,
        status: status,
        focusProject: spotlight,
        filter: selectCat
      });
    })
    .catch(function () {
      note.textContent = 'לא הצלחתי לטעון את רשימת הפרויקטים. אם פתחתם את הקובץ ישירות מהמחשב, פתחו אותו דרך שרת (למשל npx serve).';
      note.hidden = false;
    });
})();
