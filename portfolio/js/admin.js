/* Admin screen for the portfolio.
   The page is static, so it never changes anything itself: every action goes
   into a basket, and "send" opens a GitHub issue titled "ניהול: …" with the
   actions as JSON. The portfolio-manage workflow carries them out only when the
   issue comes from the repository owner. */
(function () {
  'use strict';

  var REPO = 'devops-hub';
  var COUNTER = 'https://abacus.jasoncameron.dev';
  var COUNTER_NS = 'hasadna-devopsdevopshaim';
  var STATES = {
    ok: { label: 'עובד', icon: '✓', color: 'var(--st-ok)' },
    waking: { label: 'מתעורר', icon: '⏳', color: 'var(--st-waking)' },
    locked: { label: 'נעול', icon: '🔒', color: 'var(--st-locked)' },
    down: { label: 'לא זמין', icon: '✕', color: 'var(--st-down)' }
  };
  var OP_TEXT = {
    delete: 'מחיקה', hide: 'הסתרה', show: 'הצגה', feature: 'לנבחרים', unfeature: 'הסרה מהנבחרים',
    approve: 'אישור', edit: 'עריכה', 'add-contributor': 'תורם חדש', 'remove-contributor': 'הסרת תורם',
    'music-add': 'תחנה חדשה', 'music-remove': 'הסרת תחנה', 'video-add': 'סרטון חדש', 'video-remove': 'הסרת סרטון'
  };

  var S = { media: { music: [], videos: [] }, data: null, shots: {}, opens: {}, live: null, checkedAt: null, reco: null, home: null, basket: [], selected: {} };
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('he-IL'); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function openUrl(p) {
    if (p.url) return p.url;
    if (p.localhost || p.private || !p.repo) return null;
    return 'https://' + S.data.owner + '.github.io/' + p.repo + '/' + (p.start ? encodeURIComponent(p.start) : '');
  }
  function siteBase() { return location.href.replace(/admin\.html.*$/, '').replace(/[?#].*$/, ''); }

  // ---------- loading ----------
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function count(key) {
    return fetch(COUNTER + '/get/' + COUNTER_NS + '/' + key)
      .then(function (r) { if (r.status === 404) return { value: 0 }; if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return Number(j.value) || 0; })
      .catch(function () { return null; });
  }

  function load() {
    return Promise.all([
      getJSON('projects.json'),
      getJSON('shots/index.json').catch(function () { return {}; }),
      getJSON('media.json').catch(function () { return { music: [], videos: [] }; })
    ]).then(function (res) {
      S.media = { music: res[2].music || [], videos: res[2].videos || [] };
      S.data = res[0];
      S.data.contributors = S.data.contributors || [];
      S.shots = res[1];
      renderAll();
      loadCounts();
      loadStatus();
      loadReco();
      loadHistory();
    }).catch(function () {
      $('rows').innerHTML = '<tr><td colspan="7" class="muted">לא הצלחתי לטעון את projects.json</td></tr>';
    });
  }

  function loadCounts() {
    count('home').then(function (n) { S.home = n; renderStats(); });
    var jobs = S.data.projects.map(function (p) {
      return count('open-' + p.id).then(function (n) { S.opens[p.id] = n; });
    });
    Promise.all(jobs).then(function () { renderStats(); renderRows(); });
  }

  function loadStatus() {
    var url = S.data.statusUrl;
    if (!url) { renderStats(); return; }
    getJSON(url + (url.indexOf('?') < 0 ? '?' : '&') + 'format=json')
      .then(function (j) {
        S.live = {};
        (j.results || []).forEach(function (r) { S.live[r.id] = r; });
        S.checkedAt = j.checkedAt || null;
      })
      .catch(function () { S.live = null; })
      .then(function () { renderStats(); renderRows(); });
  }

  function loadReco() {
    var q = 'repo:' + S.data.owner + '/' + REPO + ' label:portfolio-comment is:issue';
    getJSON('https://api.github.com/search/issues?per_page=100&q=' + encodeURIComponent(q))
      .then(function (j) {
        S.reco = (j.items || []).reduce(function (sum, it) { return sum + (it.comments || 0); }, 0);
      })
      .catch(function () { S.reco = null; })
      .then(renderStats);
  }

  function loadHistory() {
    var box = $('history-list');
    getJSON('https://api.github.com/repos/' + S.data.owner + '/' + REPO + '/commits?path=portfolio/projects.json&per_page=12')
      .then(function (list) {
        box.innerHTML = '';
        list.forEach(function (c) {
          var d = new Date(c.commit.author.date);
          box.appendChild(el('li', {}, [
            el('time', { datetime: c.commit.author.date, text: d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }),
            el('a', { href: c.html_url, target: '_blank', rel: 'noopener', text: c.commit.message.split('\n')[0] })
          ]));
        });
        if (!list.length) box.innerHTML = '<li class="muted">אין שינויים עדיין</li>';
      })
      .catch(function () {
        box.innerHTML = '';
        box.appendChild(el('li', { class: 'muted' }, [
          'GitHub לא ענה כרגע. ',
          el('a', { href: 'https://github.com/' + S.data.owner + '/' + REPO + '/commits/main/portfolio/projects.json', target: '_blank', rel: 'noopener', text: 'להיסטוריה המלאה ב־GitHub ↗' })
        ]));
      });
  }

  // ---------- stats ----------
  function liveState(p) { return S.live && S.live[p.id] ? S.live[p.id].state : null; }

  function renderStats() {
    var all = S.data.projects;
    var pub = all.filter(function (p) { return !p.hidden && !p.pending; });
    var known = S.data.projects.every(function (p) { return p.id in S.opens; });
    var totalOpens = all.reduce(function (s, p) { return s + (S.opens[p.id] || 0); }, 0);
    var okCount = S.live ? pub.filter(function (p) { return liveState(p) === 'ok'; }).length : null;
    var kpis = [
      ['פרויקטים באתר', pub.length],
      ['מוסתרים', all.filter(function (p) { return p.hidden; }).length],
      ['ממתינים לאישור', all.filter(function (p) { return p.pending; }).length],
      ['כניסות לאתר', S.home],
      ['פתיחות פרויקטים', known ? totalOpens : null],
      ['עובדים עכשיו', okCount == null ? null : okCount + '/' + pub.length],
      ['המלצות', S.reco]
    ];
    var dl = $('kpis');
    dl.innerHTML = '';
    kpis.forEach(function (k) {
      dl.appendChild(el('div', {}, [
        el('dt', { text: k[0] }),
        el('dd', { text: k[1] == null ? '—' : (typeof k[1] === 'number' ? fmt(k[1]) : k[1]) })
      ]));
    });

    // top opened
    var top = all.slice().sort(function (a, b) { return (S.opens[b.id] || 0) - (S.opens[a.id] || 0); }).slice(0, 10);
    bars($('chart-top'), top.map(function (p) { return [p.title, S.opens[p.id]]; }), known ? null : 'סופר פתיחות…');

    // by category (public only)
    var cats = {};
    pub.forEach(function (p) { cats[p.category] = (cats[p.category] || 0) + 1; });
    var catRows = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) {
      var info = S.data.categories[c];
      return [info ? info.label || info : c, cats[c]];
    });
    bars($('chart-cats'), catRows);

    renderStatusChart(pub);
  }

  function bars(ol, rows, waiting) {
    ol.innerHTML = '';
    if (waiting) { ol.appendChild(el('li', { class: 'muted', text: waiting })); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r[1] || 0; }).concat([1]));
    rows.forEach(function (r) {
      var v = r[1] == null ? null : r[1];
      ol.appendChild(el('li', { title: r[0] + ': ' + (v == null ? 'לא ידוע' : fmt(v)), tabindex: '0' }, [
        el('span', { class: 'lbl', text: r[0] }),
        el('span', { class: 'track' }, [el('span', { class: 'fill', style: 'width:' + ((v || 0) / max * 100) + '%' })]),
        el('span', { class: 'val', text: v == null ? '—' : fmt(v) })
      ]));
    });
  }

  function renderStatusChart(pub) {
    var stack = $('chart-status'), legend = $('status-legend');
    stack.innerHTML = ''; legend.innerHTML = '';
    if (!S.live) {
      $('status-when').textContent = S.data.statusUrl ? 'מרכז הבקרה של n8n לא ענה כרגע' : 'אין כתובת למרכז הבקרה';
      legend.appendChild(el('li', { class: 'muted', text: 'הבדיקה רצה ב־n8n כל 15 דקות.' }));
      return;
    }
    var counts = { ok: 0, waking: 0, locked: 0, down: 0 }, total = 0;
    pub.forEach(function (p) { var s = liveState(p); if (s in counts) { counts[s]++; total++; } });
    var aria = [];
    Object.keys(STATES).forEach(function (k) {
      var st = STATES[k];
      if (counts[k]) stack.appendChild(el('span', { style: 'flex:' + counts[k] + ';background:' + st.color, title: st.icon + ' ' + st.label + ': ' + counts[k] }));
      legend.appendChild(el('li', {}, [
        el('i', { style: 'background:' + st.color }),
        el('span', { text: st.icon + ' ' + st.label }),
        el('b', { text: String(counts[k]) })
      ]));
      aria.push(st.label + ' ' + counts[k]);
    });
    stack.setAttribute('aria-label', 'זמינות: ' + aria.join(', '));
    $('status-when').textContent = S.checkedAt
      ? 'נבדק ב־' + new Date(S.checkedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' · ' + total + ' אתרים'
      : 'מהבדיקה האחרונה של n8n';
  }

  // ---------- table ----------
  function catLabel(c) { var i = S.data.categories[c]; return i ? (i.label || i) : c; }

  function matches(p) {
    var q = $('q').value.trim().toLowerCase();
    if (q && (p.title + ' ' + (p.desc || '') + ' ' + p.id + ' ' + (p.repo || '')).toLowerCase().indexOf(q) < 0) return false;
    switch ($('f-state').value) {
      case 'public': return !p.hidden && !p.pending;
      case 'hidden': return !!p.hidden;
      case 'pending': return !!p.pending;
      case 'featured': return !!p.featured;
      case 'down': return S.live ? (liveState(p) === 'down' || liveState(p) === 'locked') : false;
    }
    return true;
  }

  function queuedOps(id) { return S.basket.filter(function (o) { return o.id === id; }); }

  function renderRows() {
    var tb = $('rows');
    tb.innerHTML = '';
    var list = S.data.projects.filter(matches);
    $('proj-count').textContent = list.length + ' מתוך ' + S.data.projects.length + ' פרויקטים';
    list.forEach(function (p) {
      var url = openUrl(p);
      var shot = S.shots[p.id] ? 'shots/' + p.id + '.jpg' : null;
      var pills = [];
      if (p.pending) pills.push(el('span', { class: 'pill pending', text: '⏳ ממתין' + (p.addedBy ? ' · ' + p.addedBy : '') }));
      else if (p.hidden) pills.push(el('span', { class: 'pill hidden', text: '◌ מוסתר' }));
      else pills.push(el('span', { class: 'pill public', text: '● מוצג' }));
      if (p.featured) pills.push(el('span', { class: 'pill featured', text: '★ נבחר' }));
      var ls = liveState(p), st = STATES[ls];
      var q = queuedOps(p.id);
      var checked = !!S.selected[p.id];
      tb.appendChild(el('tr', { class: q.length ? 'queued' : null }, [
        el('td', {}, [el('input', { type: 'checkbox', 'data-sel': p.id, 'aria-label': 'סימון ' + p.title, checked: checked ? '' : null })]),
        el('td', {}, [el('div', { class: 'p-name' }, [
          el('span', { class: 'thumb', style: shot ? 'background-image:url(' + shot + ')' : null, 'aria-hidden': 'true' }),
          el('div', {}, [
            el('b', { text: p.title }),
            el('small', { dir: 'ltr', text: q.length ? '→ ' + q.map(function (o) { return OP_TEXT[o.op]; }).join(', ') : (p.repo || p.id) })
          ])
        ])]),
        el('td', { text: catLabel(p.category) }),
        el('td', {}, [el('div', { class: 'acts' }, pills)]),
        el('td', {}, [st ? el('span', { class: 'pill ' + ls, text: st.icon + ' ' + st.label }) : el('span', { class: 'muted', text: S.live ? 'לא נבדק' : '—' })]),
        el('td', { class: 'num', text: p.id in S.opens ? (S.opens[p.id] == null ? '—' : fmt(S.opens[p.id])) : '…' }),
        el('td', {}, [el('div', { class: 'acts' }, [
          url ? el('a', { href: url, target: '_blank', rel: 'noopener', text: 'פתיחה ↗' }) : null,
          el('button', { type: 'button', 'data-edit': p.id, text: 'עריכה' }),
          p.pending ? el('button', { type: 'button', 'data-op': 'approve', 'data-id': p.id, text: 'אישור' }) : null,
          el('button', { type: 'button', 'data-op': p.hidden ? 'show' : 'hide', 'data-id': p.id, text: p.hidden ? 'הצגה' : 'הסתרה' }),
          el('button', { type: 'button', 'data-op': p.featured ? 'unfeature' : 'feature', 'data-id': p.id, text: p.featured ? '☆' : '★', title: p.featured ? 'הסרה מהנבחרים' : 'לנבחרים', 'aria-label': p.featured ? 'הסרה מהנבחרים' : 'לנבחרים' }),
          el('button', { type: 'button', class: 'del', 'data-op': 'delete', 'data-id': p.id, text: 'מחיקה' })
        ])])
      ]));
    });
    if (!list.length) tb.appendChild(el('tr', {}, [el('td', { colspan: '7', class: 'muted', text: 'אין פרויקטים שמתאימים לסינון.' })]));
    syncBulk();
  }

  function renderPending() {
    var list = S.data.projects.filter(function (p) { return p.pending; });
    $('pending').hidden = !list.length;
    var box = $('pending-list');
    box.innerHTML = '';
    list.forEach(function (p) {
      var url = openUrl(p);
      box.appendChild(el('article', { class: 'pend' }, [
        el('b', { text: p.title }),
        el('p', { text: p.desc || '' }),
        el('small', { class: 'muted', text: 'נוסף על ידי ' + (p.addedBy || 'תורם') }),
        el('div', { class: 'acts' }, [
          url ? el('a', { href: url, target: '_blank', rel: 'noopener', text: 'בדיקה ↗' }) : null,
          el('button', { type: 'button', 'data-op': 'approve', 'data-id': p.id, text: '✓ אישור' }),
          el('button', { type: 'button', class: 'del', 'data-op': 'delete', 'data-id': p.id, text: 'דחייה ומחיקה' })
        ])
      ]));
    });
  }

  function renderPeople() {
    var ul = $('people-list');
    ul.innerHTML = '';
    var removing = S.basket.filter(function (o) { return o.op === 'remove-contributor'; }).map(function (o) { return o.user.toLowerCase(); });
    var adding = S.basket.filter(function (o) { return o.op === 'add-contributor'; }).map(function (o) { return o.user; });
    var people = S.data.contributors.concat(adding);
    people.forEach(function (u) {
      var gone = removing.indexOf(u.toLowerCase()) >= 0;
      var isNew = adding.indexOf(u) >= 0;
      ul.appendChild(el('li', { style: gone ? 'opacity:.5;text-decoration:line-through' : null }, [
        el('span', { dir: 'ltr', text: '@' + u + (isNew ? ' (בסל)' : '') }),
        isNew || gone ? null : el('button', { type: 'button', 'data-unperson': u, 'aria-label': 'הסרת ' + u, title: 'הסרה', text: '×' })
      ]));
    });
    if (!people.length) ul.appendChild(el('li', { class: 'muted', text: 'אין תורמים עדיין. רק את/ה יכול/ה להוסיף אתרים.' }));
  }

  function renderAll() {
    renderStats();
    renderPending();
    renderRows();
    renderPeople();
    renderMedia();
    renderBasket();
  }

  // ---------- music & videos (media.json) ----------
  function ytId(u) { return (String(u).match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/) || [])[1] || null; }
  function isYouTube(u) { return /youtu\.?be/.test(u); }
  function renderMedia() {
    var q = function (op, url) { return S.basket.some(function (b) { return b.op === op && b.url === url; }); };
    var mu = $('music-list'), vi = $('video-list');
    mu.innerHTML = ''; vi.innerHTML = '';
    var music = S.media.music.concat(S.basket.filter(function (b) { return b.op === 'music-add'; }));
    music.forEach(function (m) {
      var adding = S.media.music.indexOf(m) < 0, gone = q('music-remove', m.url);
      mu.appendChild(el('li', { class: gone ? 'gone' : null }, [
        el('b', { text: m.style }),
        el('a', { href: m.url, target: '_blank', rel: 'noopener', dir: 'ltr', text: (m.title || m.url) + ' ↗' }),
        adding ? el('span', { class: 'pill pending', text: 'בסל' }) : gone ? null : el('button', { type: 'button', 'data-unmedia': 'music', 'data-url': m.url, 'aria-label': 'הסרת ' + m.style, text: '×' })
      ]));
    });
    if (!music.length) mu.appendChild(el('li', { class: 'muted', text: 'אין תחנות. בלי תחנות, נגן המוזיקה לא מופיע באתר.' }));
    var videos = S.media.videos.concat(S.basket.filter(function (b) { return b.op === 'video-add'; }));
    videos.forEach(function (v) {
      var adding = S.media.videos.indexOf(v) < 0, gone = q('video-remove', v.url), id = ytId(v.url);
      vi.appendChild(el('li', { class: gone ? 'gone' : null }, [
        el('span', { class: 'thumb', style: id ? 'background-image:url(https://i.ytimg.com/vi/' + id + '/mqdefault.jpg)' : null, 'aria-hidden': 'true' }),
        el('div', {}, [el('b', { text: v.title }), el('small', { class: 'muted', text: (isYouTube(v.url) ? 'יוטיוב · צפייה בלבד' : v.download ? 'קובץ · צפייה והורדה' : 'קובץ · צפייה בלבד') })]),
        adding ? el('span', { class: 'pill pending', text: 'בסל' }) : gone ? null : el('button', { type: 'button', 'data-unmedia': 'video', 'data-url': v.url, 'aria-label': 'הסרת ' + v.title, text: '×' })
      ]));
    });
    if (!videos.length) vi.appendChild(el('li', { class: 'muted', text: 'אין סרטונים. כשתוסיפו, יופיע באתר החלק "סרטונים".' }));
  }

  $('music-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements, url = f.url.value.trim();
    if (!f.style.value.trim() || !ytId(url) && !/[?&]list=/.test(url)) { $('music-err').hidden = false; return; }
    $('music-err').hidden = true;
    queue({ op: 'music-add', style: f.style.value.trim(), title: f.title.value.trim(), url: url });
    e.target.reset();
  });
  $('video-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements, url = f.url.value.trim();
    if (!f.title.value.trim() || !/^https:\/\//.test(url)) { $('video-err').hidden = false; return; }
    $('video-err').hidden = true;
    queue({ op: 'video-add', title: f.title.value.trim(), desc: f.desc.value.trim(), url: url, download: f.download.checked && !isYouTube(url) });
    e.target.reset();
  });
  $('video-add').elements.url.addEventListener('input', function (e) {
    var yt = isYouTube(e.target.value), d = $('video-add').elements.download;
    d.disabled = yt; if (yt) d.checked = false;
    $('dl-note').textContent = yt ? 'סרטוני יוטיוב: צפייה בלבד. יוטיוב לא מתירה הורדה מאתרים אחרים.' : 'הורדה מתאימה לסרטונים שלכם (קובץ mp4).';
  });

  // ---------- basket ----------
  function describe(o) {
    if (o.user) return OP_TEXT[o.op] + ': @' + o.user;
    if (o.url) return OP_TEXT[o.op] + ': ' + (o.style || o.title || o.url);
    var p = S.data.projects.filter(function (x) { return x.id === o.id; })[0];
    return OP_TEXT[o.op] + ': ' + (p ? p.title : o.id);
  }

  // A newer action on the same project replaces anything that conflicts with it.
  var CONFLICT = { hide: ['show'], show: ['hide'], feature: ['unfeature'], unfeature: ['feature'] };
  function queue(o) {
    S.basket = S.basket.filter(function (b) {
      if (o.url) return !(b.url === o.url && b.op.split('-')[0] === o.op.split('-')[0]);
      if (b.url) return true;
      if (o.user) return !(b.user && b.user.toLowerCase() === o.user.toLowerCase());
      if (b.id !== o.id) return true;
      if (o.op === 'delete') return false;
      if (b.op === o.op) return false;
      return (CONFLICT[o.op] || []).indexOf(b.op) < 0;
    });
    S.basket.push(o);
    renderAll();
  }

  function renderBasket() {
    var n = S.basket.length;
    $('basket').hidden = !n;
    if (!n) return;
    $('basket-title').textContent = 'סל פעולות · ' + n;
    var ul = $('basket-list');
    ul.innerHTML = '';
    S.basket.forEach(function (o, i) {
      ul.appendChild(el('li', {}, [describe(o) + ' ', el('button', { type: 'button', 'data-unqueue': String(i), 'aria-label': 'ביטול', style: 'border:0;background:none;color:inherit;cursor:pointer', text: '×' })]));
    });
  }

  function send() {
    if (!S.basket.length) return;
    var ops = S.basket.map(function (o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; });
    var words = S.basket.map(describe);
    var title = 'ניהול: ' + (words.length > 2 ? words.slice(0, 2).join(', ') + ' ועוד ' + (words.length - 2) : words.join(', '));
    var body = 'פעולות מסך הניהול. GitHub יבצע אותן רק אם הבקשה נפתחה מחשבון המנהל.\n\n' +
      words.map(function (w) { return '- ' + w; }).join('\n') +
      '\n\n```json\n' + JSON.stringify({ ops: ops }, null, 1) + '\n```\n';
    var url = 'https://github.com/' + S.data.owner + '/' + REPO + '/issues/new?title=' + encodeURIComponent(title.slice(0, 200)) + '&body=' + encodeURIComponent(body);
    window.open(url, '_blank', 'noopener');
    $('basket-title').textContent = 'נפתח ב־GitHub. לחצו שם "Create" והאתר יתעדכן תוך כ־2 דקות.';
  }

  // ---------- selection / bulk ----------
  function syncBulk() {
    var ids = Object.keys(S.selected).filter(function (k) { return S.selected[k]; });
    $('bulk').hidden = !ids.length;
    $('bulk-count').textContent = ids.length + ' נבחרו';
    var boxes = document.querySelectorAll('[data-sel]');
    $('check-all').checked = boxes.length > 0 && Array.prototype.every.call(boxes, function (b) { return b.checked; });
  }

  // ---------- edit dialog ----------
  var editing = null;
  function openEdit(id) {
    var p = S.data.projects.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    editing = p;
    var f = $('edit-form').elements;
    var sel = $('edit-cat');
    sel.innerHTML = '';
    Object.keys(S.data.categories).forEach(function (c) {
      sel.appendChild(el('option', { value: c, text: catLabel(c), selected: c === p.category ? '' : null }));
    });
    f.title.value = p.title;
    f.desc.value = p.desc || '';
    f.url.value = p.url || '';
    $('edit-url-wrap').hidden = !p.url;
    var d = $('edit');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  $('edit').addEventListener('close', function () {
    if ($('edit').returnValue !== 'save' || !editing) return;
    var f = $('edit-form').elements, p = editing, fields = {};
    if (f.title.value.trim() && f.title.value.trim() !== p.title) fields.title = f.title.value.trim();
    if (f.desc.value.trim() !== (p.desc || '')) fields.desc = f.desc.value.trim();
    if (f.category.value !== p.category) fields.category = f.category.value;
    if (p.url && f.url.value.trim() && f.url.value.trim() !== p.url) fields.url = f.url.value.trim();
    editing = null;
    if (Object.keys(fields).length) queue({ op: 'edit', id: p.id, fields: fields });
  });

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a');
    if (!t) return;
    if (t.hasAttribute('data-op')) {
      var op = t.getAttribute('data-op'), id = t.getAttribute('data-id');
      if (op === 'delete') {
        var p = S.data.projects.filter(function (x) { return x.id === id; })[0];
        if (!confirm('למחוק את "' + (p ? p.title : id) + '" מהאתר?\nהמאגר ב־GitHub עצמו לא נמחק. אפשר גם רק להסתיר.')) return;
      }
      queue({ op: op, id: id });
    } else if (t.hasAttribute('data-edit')) {
      openEdit(t.getAttribute('data-edit'));
    } else if (t.hasAttribute('data-bulk')) {
      var bop = t.getAttribute('data-bulk');
      var ids = Object.keys(S.selected).filter(function (k) { return S.selected[k]; });
      if (bop === 'delete' && !confirm('למחוק ' + ids.length + ' פרויקטים מהאתר?')) return;
      ids.forEach(function (i) { queue({ op: bop, id: i }); });
      S.selected = {};
      renderRows();
    } else if (t.hasAttribute('data-unperson')) {
      queue({ op: 'remove-contributor', user: t.getAttribute('data-unperson') });
    } else if (t.hasAttribute('data-unmedia')) {
      queue({ op: t.getAttribute('data-unmedia') + '-remove', url: t.getAttribute('data-url') });
    } else if (t.hasAttribute('data-unqueue')) {
      S.basket.splice(Number(t.getAttribute('data-unqueue')), 1);
      renderAll();
    } else if (t.hasAttribute('data-copy')) {
      var txt = $(t.getAttribute('data-copy')).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(function () { t.textContent = 'הועתק ✓'; })
        .catch(function () { prompt('העתיקו את הקישור:', txt); });
      setTimeout(function () { t.textContent = 'העתקה'; }, 1800);
    } else if (t.id === 'basket-clear') {
      S.basket = []; renderAll();
    } else if (t.id === 'basket-send') {
      send();
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-sel')) { S.selected[t.getAttribute('data-sel')] = t.checked; syncBulk(); }
    else if (t.id === 'check-all') {
      Array.prototype.forEach.call(document.querySelectorAll('[data-sel]'), function (b) { b.checked = t.checked; S.selected[b.getAttribute('data-sel')] = t.checked; });
      syncBulk();
    } else if (t.id === 'f-state') { S.selected = {}; renderRows(); }
  });
  $('q').addEventListener('input', renderRows);

  $('people-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('new-user').value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9-]{1,39}$/.test(u)) { $('new-user').focus(); return; }
    $('new-user').value = '';
    queue({ op: 'add-contributor', user: u });
  });

  window.addEventListener('beforeunload', function (e) {
    if (S.basket.length && $('basket-title').textContent.indexOf('נפתח') < 0) { e.preventDefault(); e.returnValue = ''; }
  });

  $('client-link').textContent = siteBase() + '?view=client';

  // Admin controls on the public site's cards, for this browser only.
  var siteAdmin = $('site-admin');
  try {
    if (localStorage.getItem('hasadna-admin') === null) localStorage.setItem('hasadna-admin', '1');
    siteAdmin.checked = localStorage.getItem('hasadna-admin') === '1';
    siteAdmin.addEventListener('change', function () { localStorage.setItem('hasadna-admin', siteAdmin.checked ? '1' : '0'); });
  } catch (e) { siteAdmin.parentNode.hidden = true; }
  load();
})();
