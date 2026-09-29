(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var chips = document.getElementById('chips');
  var q = document.getElementById('q');
  var note = document.getElementById('note');
  var state = { cat: 'all', query: '', data: null, repos: null };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
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
        ? { kind: 'live', label: 'באוויר', open: 'https://' + owner + '.github.io/' + p.repo + '/', code: code }
        : { kind: 'wait', label: 'במאגר, בלי Pages', code: code };
    }
    // Without the GitHub list we cannot tell, so assume the upload script ran.
    if (!state.repos) return { kind: 'wait', label: 'לא ידוע', open: 'https://' + owner + '.github.io/' + p.repo + '/', code: code };
    return { kind: 'wait', label: 'ממתין להעלאה' };
  }

  function card(p) {
    var s = status(p);
    var cats = state.data.categories;
    return el('article', { class: 'card' }, [
      el('div', { class: 'card-top' }, [
        el('span', { class: 'icon', 'aria-hidden': 'true', text: p.icon || '•' }),
        el('div', {}, [
          el('h3', { text: p.title }),
          el('span', { class: 'cat', text: cats[p.category] || '' })
        ])
      ]),
      p.desc ? el('p', { text: p.desc }) : null,
      el('div', { class: 'card-foot' }, [
        el('span', { class: 'badge ' + s.kind, text: s.label }),
        s.open ? el('a', { class: 'btn', href: s.open, target: '_blank', rel: 'noopener', text: 'פתיחה' }) : null,
        s.code ? el('a', { class: 'btn ghost', href: s.code, target: '_blank', rel: 'noopener', text: 'קוד' }) : null
      ])
    ]);
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
    if (!list.length) grid.appendChild(el('p', { class: 'empty', text: 'לא נמצאו פרויקטים.' }));
    renderStats();
  }

  function renderStats() {
    var all = state.data.projects;
    var live = all.filter(function (p) { return status(p).kind === 'live'; }).length;
    var wait = all.filter(function (p) { return status(p).kind === 'wait'; }).length;
    var box = document.getElementById('stats');
    box.replaceChildren();
    [['פרויקטים', all.length], ['באוויר', live], ['ממתינים', wait]].forEach(function (row) {
      box.appendChild(el('div', {}, [el('dt', { text: row[0] }), el('dd', { text: String(row[1]) })]));
    });
  }

  function renderChips() {
    var cats = state.data.categories;
    var used = {};
    state.data.projects.forEach(function (p) { used[p.category] = true; });
    var keys = ['all'].concat(Object.keys(cats).filter(function (k) { return used[k]; }));
    keys.forEach(function (k) {
      var b = el('button', { class: 'chip', role: 'tab', type: 'button', 'aria-selected': String(k === state.cat), text: k === 'all' ? 'הכול' : cats[k] });
      b.addEventListener('click', function () {
        state.cat = k;
        Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-selected', String(c === b)); });
        render();
      });
      chips.appendChild(b);
    });
  }

  // Public repos that are not in projects.json still get a card.
  function renderExtra(list) {
    var known = {};
    state.data.projects.forEach(function (p) { if (p.repo) known[p.repo.toLowerCase()] = true; });
    var extra = list.filter(function (r) { return !known[r.name.toLowerCase()] && !r.fork && !r.private; });
    if (!extra.length) return;
    var box = document.getElementById('extra');
    extra.forEach(function (r) {
      var pages = r.has_pages ? 'https://' + state.data.owner + '.github.io/' + r.name + '/' : null;
      box.appendChild(el('article', { class: 'card' }, [
        el('div', { class: 'card-top' }, [
          el('span', { class: 'icon', 'aria-hidden': 'true', text: '📦' }),
          el('div', {}, [el('h3', { text: r.name }), el('span', { class: 'cat', text: r.language || 'GitHub' })])
        ]),
        r.description ? el('p', { text: r.description }) : null,
        el('div', { class: 'card-foot' }, [
          pages ? el('a', { class: 'btn', href: pages, target: '_blank', rel: 'noopener', text: 'פתיחה' }) : null,
          el('a', { class: 'btn ghost', href: r.html_url, target: '_blank', rel: 'noopener', text: 'קוד' })
        ])
      ]));
    });
    document.getElementById('extra-wrap').hidden = false;
  }

  function loadRepos(owner) {
    return fetch('https://api.github.com/users/' + owner + '/repos?per_page=100&sort=updated')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        state.repos = {};
        list.forEach(function (r) { state.repos[r.name.toLowerCase()] = r; });
        render();
        renderExtra(list);
      })
      .catch(function () {
        note.textContent = 'לא הצלחתי לבדוק את GitHub כרגע, אז הסטטוס של חלק מהפרויקטים לא ידוע.';
        note.hidden = false;
      });
  }

  q.addEventListener('input', function () { state.query = q.value.trim().toLowerCase(); render(); });

  fetch('projects.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.data = data;
      document.getElementById('gh-link').href = 'https://github.com/' + data.owner;
      renderChips();
      render();
      loadRepos(data.owner);
    })
    .catch(function () {
      grid.replaceChildren(el('p', { class: 'empty', text: 'לא הצלחתי לטעון את projects.json. אם פתחת את הקובץ ישירות מהמחשב, פתח אותו דרך שרת (למשל npx serve).' }));
    });
})();
