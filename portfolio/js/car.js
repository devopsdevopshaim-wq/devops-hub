/* Car mode: a big clock, big music buttons (internet radio by style, from radio.json) and a moving news line along the bottom.
   The station name goes to the Media Session, so a phone connected to the car by Bluetooth shows it on the car screen.
   The screen is kept awake while it plays. Meant for parking or for the passenger. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function J(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  // ----- clock
  function tick() {
    var d = new Date();
    $('c-time').textContent = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
    $('c-date').textContent = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tick(); setInterval(tick, 15000);

  // ----- news
  function news() {
    function draw(items) {
      if (!items.length) return;
      var track = $('c-track'), html = [];
      items.forEach(function (x, i) { var s = document.createElement('span'); s.textContent = x.title; html.push(s); if (i < items.length - 1) { var d = document.createElement('i'); d.textContent = '◆'; d.setAttribute('aria-hidden', 'true'); html.push(d); } });
      track.textContent = '';
      for (var r = 0; r < 2; r++) { var half = document.createElement('div'); half.style.display = 'flex'; if (r) half.setAttribute('aria-hidden', 'true'); html.forEach(function (n) { half.appendChild(n.cloneNode(true)); }); track.appendChild(half); }
      track.style.setProperty('--tk-s', Math.max(80, items.length * 12) + 's');
    }
    function load() {
      J('news.json').then(function (j) {
        var f = (j && j.feeds) || {};
        draw((f.main || []).slice(0, 16).concat((f.tech || []).slice(0, 4)).filter(function (x) { return x && x.title; }));
      }).catch(function () {});
    }
    load(); setInterval(load, 20 * 60 * 1000);
  }
  news();

  // ----- music
  var SOMA = function (id, name) { return { name: 'SomaFM · ' + name, url: 'https://ice2.somafm.com/' + id + '-128-mp3' }; };
  var FALLBACK = [
    { id: 'chillout', style: 'צ׳ילאאוט', stations: [SOMA('groovesalad', 'Groove Salad'), SOMA('fluid', 'Fluid')] },
    { id: 'lounge', style: 'לאונג׳', stations: [SOMA('illstreet', 'Illinois Street Lounge'), SOMA('secretagent', 'Secret Agent')] },
    { id: 'jazz', style: 'ג׳אז', stations: [SOMA('sonicuniverse', 'Sonic Universe')] },
    { id: '80s', style: 'שנות ה־80', stations: [SOMA('u80s', 'Underground 80s')] }
  ];
  var audio = new Audio(); audio.preload = 'none';
  var genres = FALLBACK, gi = 0, si = 0, playing = false, vol = Math.min(100, Math.max(0, Number(get('car-vol') || 70)));
  var lock = null;
  audio.volume = vol / 100;

  function cur() { var g = genres[gi], s = g && g.stations[si]; return { g: g, s: s }; }
  function label() { var c = cur(); return c.s ? (c.g.style + ' · ' + c.s.name) : ''; }
  function ui() {
    $('c-play').textContent = playing ? '⏸' : '▶';
    $('c-now').textContent = playing ? label() : (get('car-ever') ? 'מושהה' : 'לחצו ▶ להתחלה');
    $('c-vl').textContent = vol + '%';
    Array.prototype.forEach.call($('c-genres').children, function (b, i) { b.setAttribute('aria-pressed', String(i === gi)); });
    if ('mediaSession' in navigator && window.MediaMetadata && playing) {
      var c = cur(); navigator.mediaSession.metadata = new MediaMetadata({ title: c.s ? c.s.name : '', artist: c.g ? c.g.style : '', album: 'SPIDER · מצב רכב' });
    }
  }
  function wake() { try { if (navigator.wakeLock && playing) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {}); } catch (e) {} }
  function load() { var c = cur(); if (!c.s) return; audio.src = c.s.url; }
  function play() {
    if (!audio.src) load();
    var p = audio.play();
    set('car-ever', '1');
    if (p && p.then) p.then(function () { playing = true; ui(); wake(); }).catch(function () { next(true); });
    else { playing = true; ui(); wake(); }
  }
  function pause() { audio.pause(); playing = false; ui(); try { if (lock) lock.release(); } catch (e) {} }
  // a station that does not answer is replaced by the next one in the same style
  var fails = 0;
  audio.addEventListener('error', function () { if (!playing && !audio.src) return; fails++; if (fails > 6) { fails = 0; pause(); $('c-now').textContent = 'אין חיבור לתחנה'; return; } si = (si + 1) % genres[gi].stations.length; load(); play(); });
  audio.addEventListener('playing', function () { fails = 0; });
  function next(skip) { var n = genres[gi].stations.length; if (si + 1 < n) si++; else { gi = (gi + 1) % genres.length; si = 0; } load(); if (skip || playing) play(); else ui(); }
  function prev() { if (si > 0) si--; else { gi = (gi + genres.length - 1) % genres.length; si = genres[gi].stations.length - 1; } load(); if (playing) play(); else ui(); }
  function setVol(v) { vol = Math.min(100, Math.max(0, v)); audio.volume = vol / 100; set('car-vol', String(vol)); ui(); }
  function drawGenres() {
    var box = $('c-genres'); box.textContent = '';
    genres.forEach(function (g, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = g.style; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { gi = i; si = 0; load(); play(); });
      box.appendChild(b);
    });
    ui();
  }
  $('c-play').addEventListener('click', function () { playing ? pause() : play(); });
  $('c-next').addEventListener('click', function () { next(false); });
  $('c-prev').addEventListener('click', prev);
  $('c-vu').addEventListener('click', function () { setVol(vol + 10); });
  $('c-vd').addEventListener('click', function () { setVol(vol - 10); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') wake(); });
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', play); navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('nexttrack', function () { next(false); }); navigator.mediaSession.setActionHandler('previoustrack', prev);
    } catch (e) {}
  }
  drawGenres();
  J('radio.json').then(function (r) {
    var g = (r && r.genres || []).filter(function (x) { return x && x.stations && x.stations.length && x.style; });
    if (g.length) { genres = g; gi = 0; si = 0; drawGenres(); }
  }).catch(function () {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
