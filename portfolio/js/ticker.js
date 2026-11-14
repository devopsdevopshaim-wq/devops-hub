/* A news ticker along the bottom of the screen: the headlines from news.json (refreshed every two hours by a GitHub Action) scroll
   slowly, stop under the pointer, and each one opens its article. It hides itself when there is nothing to show, and the visitor can
   close it (remembered). */
(function () {
  'use strict';
  var box = document.getElementById('news-ticker'), root = document.documentElement;
  if (!box) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  if (get('ticker-off') === '1') return;

  function ago(t) { var m = Math.max(1, Math.round((Date.now() - Date.parse(t)) / 60000)); return m < 60 ? m + ' דק׳' : m < 1440 ? Math.round(m / 60) + ' שע׳' : ''; }
  function draw(items, updated) {
    var line = items.map(function (x) {
      var a = ago(x.at || '');
      return '<a href="' + esc(x.link) + '" target="_blank" rel="noopener"><b>' + esc(x.title) + '</b><small>' + esc(x.source || '') + (a ? ' · ' + a : '') + '</small></a>';
    }).join('<i aria-hidden="true">◆</i>');
    box.innerHTML = '<div class="tk-label"><span class="tk-dot" aria-hidden="true"></span>חדשות</div>' +
      '<div class="tk-view"><div class="tk-track" style="--tk-s:' + Math.max(60, Math.round(items.length * 9)) + 's"><span>' + line + '</span><span aria-hidden="true">' + line + '</span></div></div>' +
      '<button type="button" class="tk-x" aria-label="סגירת פס החדשות" title="סגירה">✕</button>';
    box.hidden = false; root.classList.add('has-ticker');
    box.querySelector('.tk-x').addEventListener('click', function () { box.hidden = true; root.classList.remove('has-ticker'); set('ticker-off', '1'); });
  }
  function load() {
    fetch('news.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var f = (j && j.feeds) || {}, items = (f.main || []).slice(0, 14).concat((f.tech || []).slice(0, 4));
      items = items.filter(function (x) { return x && x.title && /^https?:/.test(x.link || ''); });
      if (items.length) draw(items, j.updatedAt);
    }).catch(function () {});
  }
  load();
  setInterval(load, 20 * 60000);
})();
