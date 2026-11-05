/* Car mode. The music is the site's own player (extras.js): every radio style, the built-in music, YouTube picks and the live music
   video. Here it is laid out big, always open, over the background that changes by itself, with a clock and a moving news line.
   The station name goes to the Media Session (a phone connected by Bluetooth shows it on the car screen) and the screen stays awake. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function J(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function tick() {
    var d = new Date();
    $('c-time').textContent = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
    $('c-date').textContent = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tick(); setInterval(tick, 15000);

  // ----- news line
  function draw(items) {
    if (!items.length) return;
    var track = $('c-track'); track.textContent = '';
    for (var r = 0; r < 2; r++) {
      var half = document.createElement('div'); if (r) half.setAttribute('aria-hidden', 'true');
      items.forEach(function (x, i) {
        var s = document.createElement('span'); s.textContent = x.title; half.appendChild(s);
        var d = document.createElement('i'); d.textContent = '◆'; d.setAttribute('aria-hidden', 'true'); half.appendChild(d);
      });
      track.appendChild(half);
    }
    track.style.setProperty('--tk-s', Math.max(80, items.length * 12) + 's');
  }
  function news() {
    J('news.json').then(function (j) {
      var f = (j && j.feeds) || {};
      draw((f.main || []).slice(0, 16).concat((f.tech || []).slice(0, 4)).filter(function (x) { return x && x.title; }));
    }).catch(function () {});
  }
  news(); setInterval(news, 20 * 60 * 1000);

  // ----- the music panel: wait for the site's player, then lay it out and open it
  var tries = 0;
  function mount() {
    var box = document.querySelector('.music'), panel = box && box.querySelector('.mu-panel');
    if (!panel) { if (++tries < 80) return setTimeout(mount, 150); return; }
    var vis = panel.querySelector('.mu-vis'), now = panel.querySelector('.mu-now'), ctrl = panel.querySelector('.mu-ctrl'), frame = panel.querySelector('.mu-frame');
    var left = document.createElement('div'); left.className = 'car-left';
    var right = document.createElement('div'); right.className = 'car-right';
    var chips = document.createElement('div'); chips.className = 'car-chips';
    Array.prototype.slice.call(panel.children).forEach(function (n) {
      if (n === vis || n === frame) right.appendChild(n);
      else if (n === now || n === ctrl) return;
      else if (n.classList.contains('mu-sub') || n.classList.contains('mu-styles')) chips.appendChild(n);
    });
    left.appendChild(now); left.appendChild(ctrl); left.appendChild(chips);
    panel.appendChild(left); panel.appendChild(right);
    var pill = box.querySelector('.mu-pill');
    if (pill && !box.classList.contains('open')) pill.click();   // opens the panel and starts the live picture

    // the Media Session follows what the player says it is playing
    var b = now.querySelector('b');
    function meta() {
      if (!('mediaSession' in navigator) || !window.MediaMetadata || !b) return;
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: b.textContent.replace(/^♪ /, ''), artist: 'SPIDER', album: 'מצב רכב' }); } catch (e) {}
    }
    if (b) new MutationObserver(meta).observe(b, { childList: true, characterData: true, subtree: true });
    var play = ctrl.querySelector('.mu-btn'), next = ctrl.querySelectorAll('.mu-btn')[1];
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', function () { play.click(); }); navigator.mediaSession.setActionHandler('pause', function () { play.click(); });
        navigator.mediaSession.setActionHandler('nexttrack', function () { next.click(); });
      } catch (e) {}
    }
    // start on its own where the browser allows it; otherwise the first tap anywhere starts the last style
    var started = false;
    function go() { if (started) return; started = true; try { play.click(); } catch (e) {} }
    document.addEventListener('pointerdown', function first(ev) { document.removeEventListener('pointerdown', first); if (!ev.target.closest('.mu-panel')) go(); }, { once: true });
  }
  mount();

  // ----- a new background every minute (the site's own scene button)
  setInterval(function () { var s = document.getElementById('future-switch'); if (s) s.click(); }, 60000);

  // ----- the screen stays awake
  var lock = null;
  function wake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {}); } catch (e) {} }
  wake(); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') wake(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
