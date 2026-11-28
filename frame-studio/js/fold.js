/* ▾ Categories that open on a click: in the AI tabs every heading (h3) closes its category, and a click on the heading
   opens it. Each category's state is remembered ('fs-fold'), so the ones in use stay open. FS.foldify(root) works on
   cards (.mt-card / .card: the heading and everything after it) and on headings that sit in a list (the heading and the
   siblings up to the next heading). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var KEY = 'fs-fold', st = (function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private */ } }
  function name(h) { var c = h.cloneNode(true); c.querySelectorAll('small').forEach(function (s) { s.remove(); }); return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); }
  function count(f) { var n = f.querySelectorAll('.fold-body button[data-ai], .fold-body .ai-style, .fold-body .cr-card, .fold-body .mt-ai-g button').length, b = f.querySelector('.fold-n'); if (b) b.textContent = n ? n : ''; }
  function make(f, h, body, scope) {
    var id = scope + ':' + name(h); f.classList.add('fold'); h.classList.add('fold-h'); body.classList.add('fold-body');
    h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0');
    if (!h.querySelector('.fold-n')) h.insertAdjacentHTML('beforeend', '<span class="fold-n" aria-hidden="true"></span><span class="fold-ch" aria-hidden="true"></span>');
    var open = !!st[id]; f.classList.toggle('closed', !open); h.setAttribute('aria-expanded', String(open));
    function toggle() { open = f.classList.contains('closed'); f.classList.toggle('closed', !open); h.setAttribute('aria-expanded', String(open)); st[id] = open; save(); count(f); }
    h.addEventListener('click', function (e) { if (e.target.closest('input, select, a, button')) return; toggle(); });
    h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    setTimeout(function () { count(f); }, 400);
  }
  FS.foldify = function (root, scope, skip) {
    if (!root) return;
    scope = scope || 'x';
    /* cards: the first heading, and the rest of the card as the body */
    root.querySelectorAll('.mt-card, .card').forEach(function (card) {
      if (card.classList.contains('fold') || (skip && card.matches(skip))) return;
      var h = card.querySelector(':scope > h3'); if (!h) return;
      var body = document.createElement('div'); while (h.nextSibling) body.appendChild(h.nextSibling); card.appendChild(body); make(card, h, body, scope);
    });
    /* headings in a list: the heading and what follows it, up to the next heading */
    Array.prototype.slice.call(root.querySelectorAll(':scope > h3')).forEach(function (h) {
      if (h.closest('.fold')) return;
      var f = document.createElement('div'), body = document.createElement('div');
      h.parentNode.insertBefore(f, h); f.appendChild(h);
      while (f.nextSibling && !(f.nextSibling.nodeType === 1 && (f.nextSibling.tagName === 'H3' || f.nextSibling.classList.contains('card') || f.nextSibling.tagName === 'H2' || f.nextSibling.classList.contains('ax-cloud-note')))) body.appendChild(f.nextSibling);
      f.appendChild(body); make(f, h, body, scope);
    });
  };
  FS.foldCount = function (root) { (root || document).querySelectorAll('.fold').forEach(count); };
})();
