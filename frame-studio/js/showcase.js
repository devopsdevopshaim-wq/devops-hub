/* Showcase (css/showcase.css): animated tabs for styles / frames / events / design-it-yourself, a sliding marker under the
   active filter and menu item, the top bar tightening on scroll and marking where you are, the opening's hall lights, the
   pointer light and the tilting prints, and on a phone the bottom bar with "בדיקת תאריך" and
   WhatsApp once the opening is passed. Quiet with "reduce motion" and in light mode. */
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = function () { return document.documentElement.classList.contains('fs-lite'); };
  var nav = document.querySelector('.nav'), hero = document.querySelector('.hero');


  /* ---------- a sliding marker under the active button of a row (filters, tabs, the top bar) ---------- */
  function slider(box, activeSel) {
    if (!box || box.classList.contains('sc-sl')) return;
    var ind = document.createElement('span'); ind.className = 'sc-ind'; ind.setAttribute('aria-hidden', 'true');
    box.classList.add('sc-sl'); box.insertBefore(ind, box.firstChild);
    function place() {
      if (ind.parentNode !== box) box.insertBefore(ind, box.firstChild);   // a row rebuilt with innerHTML (site.js) takes the marker out
      var a = box.querySelector(activeSel);
      if (!a || !a.offsetWidth) { ind.style.opacity = '0'; return; }
      ind.style.opacity = '1';
      ind.style.width = a.offsetWidth + 'px'; ind.style.height = a.offsetHeight + 'px';
      ind.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
    }
    new MutationObserver(function () { requestAnimationFrame(place); }).observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'hidden'] });
    window.addEventListener('resize', place); if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    place(); return place;
  }
  ['#gal-filter', '#ev-filter', '#pk-filter'].forEach(function (q) { slider(document.querySelector(q), 'button.on'); });

  /* ---------- tabs: styles, frames, events and "design it yourself" in one place instead of four long sections ---------- */
  var TABS = [['work', '🎨', 'סגנונות'], ['gallery', '🖼️', 'מסגרות'], ['events', '📸', 'אירועים'], ['designer', '✍️', 'עצבו בעצמכם']];
  var first = document.getElementById('work'), wrap = null, place = null;
  if (first && first.parentNode) {
    wrap = document.createElement('section'); wrap.className = 'sc-tabwrap'; wrap.id = 'explore'; wrap.setAttribute('aria-label', 'גלו את הסטודיו');
    var bar0 = document.createElement('div'); bar0.className = 'sc-tabs'; bar0.setAttribute('role', 'tablist'); bar0.setAttribute('aria-label', 'גלו את הסטודיו');
    first.parentNode.insertBefore(wrap, first); wrap.appendChild(bar0);
    var panes = document.createElement('div'); panes.className = 'sc-panes'; wrap.appendChild(panes);
    TABS.forEach(function (t) {
      var sec = document.getElementById(t[0]); if (!sec) return;
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + t[0]; b.dataset.tab = t[0];
      b.setAttribute('aria-controls', t[0]); b.innerHTML = '<span aria-hidden="true">' + t[1] + '</span> ' + t[2];
      bar0.appendChild(b);
      sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-labelledby', b.id); sec.classList.add('sc-pane');
      panes.appendChild(sec);
      // the events tab shows only when there are albums (site.js hides the section otherwise)
      var sync = function () { b.hidden = !!sec.hidden; if (sec.hidden && sec.classList.contains('sc-cur')) show('work'); };
      new MutationObserver(sync).observe(sec, { attributes: true, attributeFilter: ['hidden'] }); sync();
    });
    place = slider(bar0, '[aria-selected="true"]');
  }
  function show(id, focus) {
    if (!wrap) return false;
    var sec = document.getElementById(id); if (!sec || !sec.classList.contains('sc-pane')) return false;
    wrap.querySelectorAll('.sc-pane').forEach(function (p) { var on = p === sec; p.classList.toggle('sc-cur', on); });
    wrap.querySelectorAll('[role="tab"]').forEach(function (b) { var on = b.dataset.tab === id; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    // the markers of the rows inside the tab now shown are measured again
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
    return true;
  }
  if (wrap) {
    show('work');
    wrap.querySelector('.sc-tabs').addEventListener('click', function (e) { var b = e.target.closest('[role="tab"]'); if (b) show(b.dataset.tab); });
    wrap.querySelector('.sc-tabs').addEventListener('keydown', function (e) {
      var all = Array.prototype.filter.call(wrap.querySelectorAll('[role="tab"]'), function (b) { return !b.hidden; }), i = all.indexOf(document.activeElement);
      if (i < 0) return;
      var k = e.key, n = k === 'ArrowLeft' ? i + 1 : k === 'ArrowRight' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? all.length - 1 : null;   // right to left: the left arrow goes on
      if (n === null) return; e.preventDefault(); n = (n + all.length) % all.length; show(all[n].dataset.tab, true);
    });
    // a link to one of the tabs (the opening's buttons, the footer, a shared address) opens it
    var go = function (id) { if (show(id)) { var y = wrap.getBoundingClientRect().top + scrollY - 70; scrollTo({ top: y, behavior: still ? 'auto' : 'smooth' }); return true; } return false; };
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      if (go(a.getAttribute('href').slice(1))) e.preventDefault();
    });
    if (location.hash) setTimeout(function () { go(location.hash.slice(1)); }, 300);
  }

  /* the top bar */
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('.links > a[href^="#"]')) : [];
  var secs = links.map(function (a) { var t = document.querySelector(a.getAttribute('href')); return t && t.closest('.sc-tabwrap') || t; });
  if (nav) slider(nav.querySelector('.links'), 'a.sc-on');
  var bar = null, ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || 0;
    if (nav) nav.classList.toggle('sc-tight', y > 40);
    var mid = y + innerHeight * 0.35, on = -1;
    secs.forEach(function (s, i) { if (s && !s.hidden && s.offsetTop <= mid) on = i; });
    links.forEach(function (a, i) { a.classList.toggle('sc-on', i === on); });
    if (bar) {
      var past = hero ? y > hero.offsetTop + hero.offsetHeight * 0.7 : y > 500;
      var contact = document.getElementById('contact'), atForm = contact && y + innerHeight > contact.offsetTop + 120;
      var show = past && !atForm;
      bar.classList.toggle('sc-show', show); document.body.classList.toggle('sc-bar-on', show);
      document.body.classList.toggle('sc-past', past);
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* the phone's bottom bar: the date check goes to the form, WhatsApp the way the top button goes */
  var cta = document.querySelector('.nav-cta [data-wa]');
  bar = document.createElement('div'); bar.className = 'sc-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'פעולות מהירות');
  bar.innerHTML = '<a class="sc-date" href="#contact">📅 בדיקת תאריך פנוי</a><a class="sc-wa" href="#contact" aria-label="וואטסאפ"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg></a>';
  document.body.appendChild(bar);
  bar.querySelector('.sc-wa').addEventListener('click', function (e) { if (cta) { e.preventDefault(); cta.click(); } });
  onScroll();

  if (still) return;

  /* the opening: hall lights, a light under the pointer, prints that tilt with it */
  if (hero) {
    var L = document.createElement('div'); L.className = 'sc-lights'; L.setAttribute('aria-hidden', 'true');
    var h = '';
    for (var i = 0; i < 14; i++) {
      var s = 6 + ((i * 53) % 34), x = (i * 71) % 100, y = (i * 37) % 100;
      h += '<i style="width:' + s + 'px;height:' + s + 'px;left:' + x + '%;top:' + y + '%;--d:' + (14 + (i % 5) * 4) + 's;--dl:' + (i % 7) * 0.35 + 's;--o:' + (0.28 + (i % 4) * 0.1) + ';--x:' + (((i * 29) % 80) - 40) + 'px;--y:' + (((i * 43) % 90) - 45) + 'px"></i>';
    }
    L.innerHTML = h; hero.insertBefore(L, hero.firstChild);
    var spot = document.createElement('div'); spot.className = 'sc-spot'; spot.setAttribute('aria-hidden', 'true'); hero.insertBefore(spot, hero.firstChild);
    var cue = document.createElement('a'); cue.className = 'sc-cue'; cue.href = '#mwall'; cue.innerHTML = '<i></i>גללו'; cue.setAttribute('aria-label', 'גלילה לקיר המגנטים'); hero.appendChild(cue);

    var art = hero.querySelector('.hero-art.dev'), tilt = null;
    if (art) {
      tilt = document.createElement('div'); tilt.className = 'sc-tilt';
      Array.prototype.slice.call(art.children).forEach(function (c) { tilt.appendChild(c); });
      art.appendChild(tilt);
    }
    var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
    if (fine) hero.addEventListener('pointermove', function (e) {
      if (lite()) return;
      var r = hero.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      spot.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); spot.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (tilt) { tilt.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg'); tilt.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg'); }
    });
    hero.addEventListener('pointerleave', function () { if (tilt) { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); } });
  }

})();
