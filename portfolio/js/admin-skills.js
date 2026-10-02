/* Admin screen · Claude skills (built on every deploy into skills/). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var dlg = el('dialog', { class: 'edit sk-view' }, [el('h2', { text: '' }), el('pre'), el('form', { method: 'dialog', class: 'edit-actions' }, [el('button', { class: 'btn btn-gold btn-sm', text: 'סגירה' })])]);
  document.body.appendChild(dlg);

  function show(s) {
    dlg.querySelector('h2').textContent = s.title;
    dlg.querySelector('pre').textContent = 'טוען…';
    dlg.showModal();
    fetch('skills/' + s.id + '/SKILL.md').then(function (r) { return r.text(); }).then(function (t) { dlg.querySelector('pre').textContent = t; });
  }

  window.HasadnaAuth.ready.then(function (who) {
    if (who.role !== 'admin') return;
    Promise.all([
      fetch('skills/index.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('projects.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      var idx = res[0], desc = {};
      res[1].projects.forEach(function (p) { desc[p.id] = p.desc; });
      $('sk-when').textContent = idx.skills.length + ' סקילים · נבנו ' + new Date(idx.builtAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
      var grid = $('sk-grid');
      grid.replaceChildren();
      idx.skills.forEach(function (s) {
        var view = el('button', { type: 'button', text: 'לקרוא' });
        view.addEventListener('click', function () { show(s); });
        grid.appendChild(el('article', { class: 'sk', 'data-q': (s.title + ' ' + s.id).toLowerCase() }, [
          el('b', { text: s.title }), el('small', { dir: 'ltr', text: s.id }), el('p', { text: desc[s.id] || '' }),
          el('div', { class: 'acts' }, [view, el('a', { href: 'skills/' + s.zip, download: s.zip, text: '⬇ zip' })])
        ]));
      });
      $('sk-q').addEventListener('input', function () {
        var q = this.value.trim().toLowerCase();
        Array.prototype.forEach.call(grid.children, function (c) { c.hidden = q && c.getAttribute('data-q').indexOf(q) < 0; });
      });
    }).catch(function () {
      $('sk-grid').replaceChildren(el('p', { class: 'muted', text: 'הסקילים עוד לא נבנו. הם נוצרים בפרסום הבא של האתר.' }));
    });
  });
})();
