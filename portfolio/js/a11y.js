/* Accessibility toolbar: text size, contrast, grayscale, link underline, readable font, stop motion, big cursor, spacing. Remembers the choice. */
(function () {
  'use strict';
  if (document.getElementById('a11y-btn')) return;
  var KEY = 'a11y-v1', root = document.documentElement;
  var OPTS = [['contrast', 'ניגודיות גבוהה'], ['gray', 'גווני אפור'], ['links', 'הדגשת קישורים'], ['font', 'גופן קריא'], ['pause', 'עצירת תנועה ווידאו'], ['cursor', 'סמן עכבר גדול'], ['spacing', 'ריווח שורות']];
  var st = { size: 0 };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function apply() {
    OPTS.forEach(function (o) { root.classList.toggle('a11y-' + o[0], !!st[o[0]]); });
    root.style.fontSize = st.size ? (100 + st.size * 10) + '%' : '';
    OPTS.forEach(function (o) { var b = document.getElementById('a11y-o-' + o[0]); if (b) b.setAttribute('aria-pressed', String(!!st[o[0]])); });
    var s = document.getElementById('a11y-size'); if (s) s.textContent = st.size ? (100 + st.size * 10) + '%' : 'רגיל';
  }
  function el(tag, attrs, kids) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { n.appendChild(c); }); return n; }
  function build() {
    var btn = el('button', { type: 'button', id: 'a11y-btn', 'aria-label': 'תפריט נגישות', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'a11y-panel', title: 'נגישות' }, [el('span', { 'aria-hidden': 'true', text: '♿' })]);
    var panel = el('div', { id: 'a11y-panel', role: 'dialog', 'aria-label': 'תפריט נגישות', hidden: '' });
    var grid = el('div', { class: 'a11y-grid' });
    var minus = el('button', { type: 'button', text: 'הקטנת טקסט', 'aria-label': 'הקטנת גודל הטקסט' }), plus = el('button', { type: 'button', text: 'הגדלת טקסט', 'aria-label': 'הגדלת גודל הטקסט' });
    minus.addEventListener('click', function () { st.size = Math.max(-1, st.size - 1); save(); apply(); });
    plus.addEventListener('click', function () { st.size = Math.min(5, st.size + 1); save(); apply(); });
    grid.appendChild(plus); grid.appendChild(minus);
    OPTS.forEach(function (o) {
      var b = el('button', { type: 'button', id: 'a11y-o-' + o[0], 'aria-pressed': 'false', text: o[1] });
      b.addEventListener('click', function () { st[o[0]] = !st[o[0]]; save(); apply(); });
      grid.appendChild(b);
    });
    var reset = el('button', { type: 'button', text: 'איפוס הגדרות' });
    reset.addEventListener('click', function () { st = { size: 0 }; save(); apply(); });
    var close = el('button', { type: 'button', text: 'סגירה' });
    var foot = el('div', { class: 'a11y-foot' }, [reset, el('a', { class: 'a11y-link', href: 'accessibility.html', text: 'הצהרת נגישות' }), close]);
    panel.appendChild(el('h2', { text: 'נגישות' }));
    panel.appendChild(el('p', { id: 'a11y-size-p', text: 'גודל טקסט: ' })); panel.lastChild.appendChild(el('b', { id: 'a11y-size' }));
    panel.appendChild(grid); panel.appendChild(foot);
    function open(v) { panel.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) { var f = panel.querySelector('button'); if (f) f.focus(); } else btn.focus(); }
    btn.addEventListener('click', function () { open(panel.hidden); });
    close.addEventListener('click', function () { open(false); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    document.body.appendChild(btn); document.body.appendChild(panel);
    apply();
  }
  // the classes are applied at once (no flash), the buttons when the page is ready
  OPTS.forEach(function (o) { if (st[o[0]]) root.classList.add('a11y-' + o[0]); });
  if (st.size) root.style.fontSize = (100 + st.size * 10) + '%';
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
