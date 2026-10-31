/* The quick-action rail: news, music, accessibility, scene, WhatsApp and admin in one tidy column of matching round buttons.
   The widgets themselves are built by other scripts (extras.js, welcome.js, future.js), some of them late, so the rail
   adopts each one as it appears and only changes where and how it sits. */
(function () {
  'use strict';
  var doc = document;
  var ORDER = ['news', 'music', 'a11y', 'scene', 'wa', 'admin'];
  var TIPS = { news: 'חדשות וחידות', music: 'מוזיקה', a11y: 'נגישות', scene: 'החלפת נוף', wa: 'וואטסאפ', admin: 'ניהול' };
  var ICONS = {
    news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Zm13 4h3v8a2 2 0 0 1-2 2h-1M7.5 9h6M7.5 12.5h6M7.5 16h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6.5l10-2.3V16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.6" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.6" cy="16" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    a11y: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.6" r="1.9" fill="currentColor"/><path d="M5 8.4c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.4v5m0 0-3 6m3-6 3 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    scene: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5 9 10l4 5.5 2.5-3L21 18.5H3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="16.5" cy="6.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.6c0 4.3-3 7.6-7 9.2-4-1.6-7-4.9-7-9.2V6l7-2.8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2.2 2.2L15.4 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var rail = doc.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', 'פעולות מהירות');
  var slots = {};
  ORDER.forEach(function (k) {
    var s = doc.createElement('div');
    s.className = 'rail-slot';
    s.dataset.k = k;
    s.dataset.tip = TIPS[k];
    s.hidden = true;
    slots[k] = s;
    rail.appendChild(s);
  });

  function icon(btn, k) {
    if (!ICONS[k] || btn.querySelector('.rail-ico')) return;
    var i = doc.createElement('span');
    i.className = 'rail-ico';
    i.innerHTML = ICONS[k];
    btn.insertBefore(i, btn.firstChild);
  }
  function put(k, node, btn) {
    var s = slots[k];
    if (!node || node.parentNode === s) return;
    s.appendChild(node);
    s.hidden = false;
    btn = btn || node;
    btn.classList.add('rail-btn');
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', TIPS[k]);
    btn.removeAttribute('title');
    icon(btn, k);
  }

  function adopt() {
    var dock = doc.querySelector('body > .dock'), music = doc.querySelector('body > .music');
    if (dock) put('news', dock, dock.querySelector('.dk-pill'));
    if (music) put('music', music, music.querySelector('.mu-pill'));
    put('a11y', doc.querySelector('body > .a11y-fab'));
    put('scene', doc.getElementById('future-switch'));
    put('wa', doc.querySelector('body > .wa-fab'));
    return dock && music && slots.a11y.firstChild && slots.scene.firstChild;
  }

  function start() {
    var admin = doc.createElement('a');
    admin.className = 'foot-admin';           // same class as the footer link, so clients never see it
    admin.href = 'admin.html';
    put('admin', admin);
    doc.body.appendChild(rail);
    doc.documentElement.classList.add('has-rail');
    if (adopt()) return;
    var mo = new MutationObserver(function () { if (adopt()) mo.disconnect(); });
    mo.observe(doc.body, { childList: true });
    setTimeout(function () { mo.disconnect(); }, 20000);
  }

  if (doc.body.classList.contains('no-dock')) return;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
