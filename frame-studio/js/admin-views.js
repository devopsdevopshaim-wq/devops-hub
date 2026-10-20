/* Two screens for the owner: "⚙️ מסך מנהל" (the admin itself) and "👁 מסך לקוח" (the site exactly as customers see it:
   the main site, the showcase page or the designer, in a frame). The switch shows once the owner is signed in. */
(function () {
  'use strict';
  var nav = document.querySelector('.dz-nav'), app = document.getElementById('app'); if (!nav || !app) return;
  var seg = document.createElement('div'); seg.className = 'adm-views'; seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'מסך');
  seg.innerHTML = '<button role="tab" aria-selected="true" data-v="admin">⚙️ מסך מנהל</button><button role="tab" aria-selected="false" data-v="client">👁 מסך לקוח</button>';
  nav.insertBefore(seg, nav.firstChild);
  var box = document.createElement('section'); box.className = 'adm-client'; box.id = 'client-view'; box.hidden = true;
  var PAGES = [['index.html', 'האתר הראשי'], ['show.html', 'דף התצוגה'], ['design.html', 'המעצב ללקוחות']];
  box.innerHTML = '<div class="adm-client-bar"><div class="adm-client-pages">' + PAGES.map(function (p, i) { return '<button data-p="' + p[0] + '"' + (i ? '' : ' class="on"') + '>' + p[1] + '</button>'; }).join('') + '</div>' +
    '<div class="adm-client-size"><button data-w="100%" class="on" title="מחשב">🖥</button><button data-w="420px" title="טלפון">📱</button></div><a class="adm-client-open" id="client-open" href="index.html" target="_blank" rel="noopener">פתיחה בלשונית חדשה ↗</a></div>' +
    '<div class="adm-client-stage"><iframe id="client-frame" title="מסך הלקוח" src="about:blank"></iframe></div>';
  app.parentNode.insertBefore(box, app.nextSibling);
  var frame = box.querySelector('#client-frame'), cur = 'index.html', loaded = false;
  function show(v) {
    seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.v === v)); });
    var client = v === 'client'; box.hidden = !client; app.hidden = client;
    nav.querySelectorAll('#preview-btn, #save, #publish, #state').forEach(function (el) { el.style.display = client ? 'none' : ''; });
    if (client && !loaded) { frame.src = cur; loaded = true; }
    try { sessionStorage.setItem('adm-view', v); } catch (e) { /* ignore */ }
  }
  FS.showClientView = function () { show('client'); };
  seg.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) show(b.dataset.v); });
  box.querySelector('.adm-client-pages').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return; cur = b.dataset.p; frame.src = cur; loaded = true;
    box.querySelectorAll('[data-p]').forEach(function (x) { x.classList.toggle('on', x === b); }); box.querySelector('#client-open').href = cur;
  });
  box.querySelector('.adm-client-size').addEventListener('click', function (e) {
    var b = e.target.closest('[data-w]'); if (!b) return; box.querySelector('.adm-client-stage').style.setProperty('--fw', b.dataset.w);
    box.querySelectorAll('[data-w]').forEach(function (x) { x.classList.toggle('on', x === b); });
  });
  /* back to the admin when the session ends (the sign-in screen hides the nav) */
  new MutationObserver(function () { if (nav.hidden) { box.hidden = true; } }).observe(nav, { attributes: true, attributeFilter: ['hidden'] });
  var last = null; try { last = sessionStorage.getItem('adm-view'); } catch (e) { /* ignore */ }
  if (last === 'client') new MutationObserver(function (m, o) { if (!nav.hidden && !app.hidden) { o.disconnect(); show('client'); } }).observe(app, { attributes: true, attributeFilter: ['hidden'] });
})();
