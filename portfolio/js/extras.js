/* The site's "living" layer:
   - smooth scrolling (Lenis), a scroll progress line and a parallax night scene
   - background music from YouTube, bottom-left (stations are set in the admin screen)
   - today's headlines and a daily riddle, bottom-right
   - the videos section
   Everything here is optional: if a part fails, the rest of the site works as before. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function ago(iso) {
    if (!iso) return '';
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return 'לפני ' + m + ' דק׳';
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
    var d = Math.round(h / 24);
    return d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים';
  }

  // ================================================================ scroll
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      autoRaf: true, lerp: 0.09, wheelMultiplier: 0.95, anchors: { offset: -70 },
      prevent: function (node) { return !!(node.closest && node.closest('.detail, .guide, .mu-panel, .dk-panel, dialog, [data-lenis-prevent]')); }
    });
    // the project page is its own scroller: pause the page underneath
    new MutationObserver(function () {
      document.documentElement.classList.contains('detail-open') ? lenis.stop() : lenis.start();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  var bar = el('div', { class: 'scroll-bar', 'aria-hidden': 'true' });
  document.body.appendChild(bar);
  var nav = $('.nav');

  // night sky with two mountain ridges, moving at different speeds
  var scene = null, layers = [];
  if (document.body.classList.contains('has-scene')) {
    scene = el('div', { class: 'scene', 'aria-hidden': 'true' }, [
      el('div', { class: 'sc sky' }), el('div', { class: 'sc stars' }), el('div', { class: 'sc ridge far' }), el('div', { class: 'sc ridge near' }), el('div', { class: 'sc mist' })
    ]);
    document.body.insertBefore(scene, document.body.firstChild);
    layers = [[$('.sky', scene), 0.05], [$('.stars', scene), 0.09], [$('.ridge.far', scene), 0.2], [$('.ridge.near', scene), 0.34]];
  }
  var heroCopy = $('.hero-copy'), heroArt = $('.orbit');
  var mx = 0, my = 0;
  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    if (nav) nav.classList.toggle('scrolled', y > 30);
    if (scene && !reduce) {
      var vh = window.innerHeight, ye = Math.min(y, vh * 1.6);
      // as the page goes up, the mountains sink: nearer layers faster
      layers.forEach(function (l, i) {
        l[0].style.transform = 'translate3d(' + (mx * (i + 1) * -6).toFixed(1) + 'px,' + (ye * l[1] + my * (i + 1) * -4).toFixed(1) + 'px,0)';
      });
      scene.style.opacity = String(Math.max(0.28, 1 - y / (vh * 1.6)));
      if (heroCopy && y < vh * 1.2) heroCopy.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
      if (heroArt && y < vh * 1.2) heroArt.style.transform = 'translate3d(0,' + (y * -0.06).toFixed(1) + 'px,0)';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onScroll, { passive: true });
  frame();

  // a quiet "scroll" cue under the hero buttons
  var cta = $('.hero .cta');
  if (cta && !reduce) {
    var cue = el('a', { class: 'scroll-cue', href: '#featured', 'aria-label': 'גללו למטה' }, [el('span', { class: 'mouse' }, [el('i')]), el('span', { text: 'גללו' })]);
    cta.parentNode.insertBefore(cue, cta.nextSibling);
    window.addEventListener('scroll', function () { cue.classList.toggle('gone', window.scrollY > 80); }, { passive: true });
  }

  var base = (document.currentScript && document.currentScript.src || '').replace(/js\/extras\.js.*$/, '');

  // ================================================================ YouTube
  var ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (resolve) {
      if (window.YT && window.YT.Player) return resolve();
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      document.head.appendChild(el('script', { src: 'https://www.youtube.com/iframe_api' }));
    });
    return ytReady;
  }
  function ytParse(url) {
    url = String(url || '').trim();
    var list = (url.match(/[?&]list=([\w-]+)/) || [])[1];
    var id = (url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(url) ? url : null);
    return id || list ? { id: id, list: list } : null;
  }

  // ================================================================ built-in music (no network, always works)
  // A small generative engine on WebAudio: ambient, trance (140 BPM, rolling bass, arpeggio) and chill. It is the
  // fallback when no radio station answers, and the one source whose sound the page can always draw and record.
  var GEN_STYLES = [
    { id: 'trance', style: 'טראנס מובנה', bpm: 140 },
    { id: 'ambient', style: 'אמביינט מובנה', bpm: 56 },
    { id: 'chill', style: 'צ׳יל מובנה', bpm: 82 }
  ];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function Gen(ctx, out) {
    var master = ctx.createGain(), dry = ctx.createGain(), send = ctx.createGain(), verb = ctx.createConvolver(), verbG = ctx.createGain();
    master.gain.value = 0.9; master.connect(out);
    dry.connect(master);
    // a small room: decaying noise as the impulse response
    var len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; verbG.gain.value = 0.42; send.connect(verb); verb.connect(verbG); verbG.connect(master);
    var nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (var n = 0; n < nd.length; n++) nd[n] = Math.random() * 2 - 1;

    function tone(type, f, t, o) {
      var osc = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
      var atk = o.atk || 0.01, hold = o.hold || 0.1, rel = o.rel || 0.2;
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.detune) osc.detune.value = o.detune;
      flt.type = 'lowpass'; flt.frequency.setValueAtTime(o.lp || 2000, t);
      if (o.lpEnd) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.lpEnd), t + atk + hold + rel);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol || 0.1, t + atk);
      g.gain.setTargetAtTime(0.0001, t + atk + hold, rel / 3);
      osc.connect(flt); flt.connect(g); g.connect(dry);
      if (o.send) { var s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(send); }
      osc.start(t); osc.stop(t + atk + hold + rel + 0.1);
    }
    function kick(t, v) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.4);
    }
    function hiss(t, len, hp, bp, v) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nb; f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp; if (bp) f.Q.value = 0.8;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g); g.connect(dry); s.start(t); s.stop(t + len + 0.02);
    }
    var PROG = [45, 41, 48, 43];            // A F C G, the bass notes
    var ARP = [0, 7, 12, 15, 12, 7, 3, 7];  // A minor
    var PENTA = [0, 3, 5, 7, 10];
    function pad(root, t, atk, hold, rel, v) {
      [0, 7, 12, 15].forEach(function (iv, k) {
        tone('sawtooth', mtof(root + 12 + iv), t, { atk: atk, hold: hold, rel: rel, vol: v, lp: 700, lpEnd: 380, detune: k % 2 ? 7 : -7, send: 0.9 });
      });
    }
    var P = null, step = 0, nextT = 0, timer = null, style = null;
    var voices = {
      trance: function (s, t, spb) {
        var bar = Math.floor(s / 16), q = s % 16, root = PROG[bar % 4], sweep = (Math.sin(s / 96 * Math.PI) + 1) / 2;
        if (q % 4 === 0) kick(t, 1);
        if (q % 4 === 2) hiss(t, 0.09, 7500, false, 0.16);
        if (q % 2 === 1) hiss(t, 0.03, 9000, false, 0.05);
        if (q % 4 !== 0) tone('sawtooth', mtof(root + (q % 8 >= 4 ? 12 : 0)), t, { atk: 0.004, hold: spb * 0.4, rel: spb * 0.5, vol: 0.2, lp: 350 + sweep * 1100, lpEnd: 120 });
        if (q % 2 === 0 || bar % 2) tone('square', mtof(root + 24 + ARP[s % 8]), t, { atk: 0.004, hold: 0.04, rel: 0.22, vol: 0.045, lp: 1400 + sweep * 3200, send: 0.5 });
        if (q === 0) pad(root, t, 0.9, 2.2, 1.6, 0.04);
      },
      ambient: function (s, t, spb) {
        var q = s % 32, bar = Math.floor(s / 32), root = PROG[bar % 4];
        if (q === 0) { pad(root, t, 4, 7, 6, 0.05); tone('sine', mtof(root - 12), t, { atk: 3, hold: 8, rel: 5, vol: 0.16, lp: 300 }); }
        if (Math.random() < 0.1) tone('sine', mtof(root + 36 + PENTA[Math.floor(Math.random() * 5)]), t, { atk: 0.01, hold: 0.1, rel: 3.2, vol: 0.05, send: 1.2, lp: 4000 });
      },
      chill: function (s, t, spb) {
        var bar = Math.floor(s / 16), q = s % 16, root = PROG[bar % 4];
        if (q === 0 || q === 8) kick(t, 0.7);
        if (q === 4 || q === 12) hiss(t, 0.16, 2400, true, 0.2);
        if (q % 2 === 0) hiss(t, 0.04, 8500, false, 0.06);
        if (q === 0 || q === 6 || q === 10) tone('sine', mtof(root), t, { atk: 0.01, hold: spb * 2, rel: spb * 3, vol: 0.3, lp: 400 });
        if (q === 0 || q === 10) [0, 3, 7, 10].forEach(function (iv) { tone('triangle', mtof(root + 24 + iv), t, { atk: 0.01, hold: 0.1, rel: 1.4, vol: 0.05, lp: 2400, send: 0.8 }); });
      }
    };
    function schedule() {
      while (nextT < ctx.currentTime + 0.18) { var spb = 60 / P.bpm / 4; voices[P.id](step, nextT, spb); nextT += spb; step++; }
    }
    return {
      start: function (id) {
        this.stop();
        P = GEN_STYLES.filter(function (x) { return x.id === id; })[0] || GEN_STYLES[0];
        style = P.id; step = 0; nextT = ctx.currentTime + 0.08;
        timer = setInterval(schedule, 25);
      },
      stop: function () { clearInterval(timer); timer = null; style = null; },
      style: function () { return style; },
      volume: function (v) { master.gain.value = v; }
    };
  }

  // ================================================================ music (bottom-left)
  // Internet radio by style (radio.json, checked daily by a GitHub Action), plus the admin's own YouTube picks (media.json),
  // plus the built-in music. Radio plays in a plain <audio>. A station that does not answer is replaced by the next one in
  // the same style, and when none does, the built-in music takes over. The picture (a "music video" drawn live) can go full
  // screen and be recorded to a file.
  var SOMA = function (id, name) { return { name: 'SomaFM · ' + name, url: 'https://ice2.somafm.com/' + id + '-128-mp3', home: 'https://somafm.com/' + id + '/' }; };
  var FALLBACK = [
    { id: 'progressive', style: 'פרוגרסיב', stations: [SOMA('thetrip', 'The Trip')], gen: 'trance' },
    { id: 'ambient', style: 'אמביינט', stations: [SOMA('dronezone', 'Drone Zone'), SOMA('deepspaceone', 'Deep Space One'), SOMA('spacestation', 'Space Station')], gen: 'ambient' },
    { id: 'chillout', style: 'צ׳ילאאוט', stations: [SOMA('groovesalad', 'Groove Salad'), SOMA('fluid', 'Fluid')], gen: 'chill' },
    { id: 'deephouse', style: 'דיפ האוס', stations: [SOMA('beatblender', 'Beat Blender')], gen: 'trance' },
    { id: 'lounge', style: 'לאונג׳', stations: [SOMA('illstreet', 'Illinois Street Lounge'), SOMA('secretagent', 'Secret Agent')], gen: 'chill' },
    { id: 'jazz', style: 'ג׳אז', stations: [SOMA('sonicuniverse', 'Sonic Universe')], gen: 'chill' },
    { id: '80s', style: 'שנות ה־80', stations: [SOMA('u80s', 'Underground 80s')], gen: 'trance' }
  ];
  // which built-in music stands in for a radio style when its stations do not answer
  function genFor(g) {
    if (g.gen) return g.gen;
    var t = (g.id + ' ' + g.style).toLowerCase();
    return /trance|psy|goa|techno|house|dance|edm|progressive|טראנס|פסי|האוס|טכנו/.test(t) ? 'trance' : /ambient|dream|drone|space|new age|meditat|אמביינט|דרים/.test(t) ? 'ambient' : 'chill';
  }

  var mediaCfg = null;
  function music(radio, yt) {
    var genres = (radio && radio.genres && radio.genres.length ? radio.genres : FALLBACK).filter(function (g) { return g.stations && g.stations.length; });
    var picks = (yt || []).filter(function (s) { return ytParse(s.url); });
    var vol = Number(store('music-vol') || 50);
    // two players: one asks the station for permission to be analysed (so the picture follows the sound and can be recorded),
    // the other is plain, for stations that do not give it
    var audioC = new Audio(), audioP = new Audio();
    audioC.crossOrigin = 'anonymous';
    [audioC, audioP].forEach(function (a) { a.preload = 'none'; a.volume = vol / 100; });
    var noCors = {};
    try { noCors = JSON.parse(store('music-nocors') || '{}') || {}; } catch (e) { noCors = {}; }
    var mode = null, gi = -1, si = 0, tried = 0, watchdog = null, ytPlayer = null, yi = -1, playing = false, active = null, genId = null, label = '';

    // ----- sound graph (made on the first click, as browsers require)
    var AC = window.AudioContext || window.webkitAudioContext;
    var actx = null, bus = null, analyser = null, recDest = null, corsSrc = null, gen = null, bins = null;
    function graph() {
      if (actx || !AC) return !!actx;
      try {
        actx = new AC();
        bus = actx.createGain(); analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
        bins = new Uint8Array(analyser.frequencyBinCount);
        bus.connect(analyser); analyser.connect(actx.destination);
        try { recDest = actx.createMediaStreamDestination(); bus.connect(recDest); } catch (e) { recDest = null; }
        gen = Gen(actx, bus);
        gen.volume(vol / 100);
      } catch (e) { actx = null; return false; }
      return true;
    }

    var pill = el('button', { class: 'mu-pill', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'mu-panel' }, [
      el('span', { class: 'eq', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('i')]),
      el('span', { class: 'mu-label', text: 'מוזיקה' })
    ]);
    var canvas = el('canvas', { class: 'mu-canvas', width: '640', height: '360', 'aria-label': 'סרטון המוזיקה' });
    var recBtn = el('button', { class: 'mu-vbtn', type: 'button', title: 'הקלטת סרטון עם הקול והורדה לקובץ', text: '⏺ הקלטה' });
    var fullBtn = el('button', { class: 'mu-vbtn', type: 'button', title: 'מסך מלא', 'aria-label': 'מסך מלא', text: '⛶ מסך מלא' });
    var vtitle = el('div', { class: 'mu-vtitle' });
    var vis = el('div', { class: 'mu-vis' }, [canvas, vtitle, el('div', { class: 'mu-vbar' }, [recBtn, fullBtn])]);
    var chips = el('div', { class: 'mu-styles', role: 'group', 'aria-label': 'סגנון' });
    var genChips = el('div', { class: 'mu-styles mu-gen', role: 'group', 'aria-label': 'מוזיקה מובנית' });
    var ytChips = el('div', { class: 'mu-styles mu-yt', role: 'group', 'aria-label': 'מיוטיוב' });
    var now = el('div', { class: 'mu-now', role: 'status' }, [el('b', { text: 'בחרו סגנון, והמוזיקה תתחיל.' }), el('small')]);
    var playBtn = el('button', { class: 'mu-btn', type: 'button', 'aria-label': 'נגינה', text: '▶' });
    var nextBtn = el('button', { class: 'mu-btn', type: 'button', 'aria-label': 'תחנה אחרת באותו סגנון', title: 'תחנה אחרת באותו סגנון', text: '⏭' });
    var volIn = el('input', { type: 'range', min: '0', max: '100', value: String(vol), 'aria-label': 'עוצמה' });
    var ytFull = el('button', { class: 'mu-vbtn', type: 'button', text: '⛶ מסך מלא' });
    var frame = el('div', { class: 'mu-frame', hidden: '' }, [el('div', { id: 'mu-yt' })]);
    var acct = el('div', { class: 'mu-acct' });
    var panel = el('div', { class: 'mu-panel', id: 'mu-panel', role: 'dialog', 'aria-label': 'מוזיקה ברקע' }, [
      el('header', {}, [el('b', { text: '♫ רדיו ומוזיקה' }), el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', text: '×' })]),
      vis,
      el('p', { class: 'mu-sub', text: 'רדיו לפי סגנון' }), chips,
      el('p', { class: 'mu-sub', text: 'מוזיקה מובנית (תמיד עובדת)' }), genChips,
      el('p', { class: 'mu-sub', text: 'יוטיוב' }), ytChips, acct,
      frame, el('div', { class: 'mu-ytbar' }, [ytFull]), now,
      el('div', { class: 'mu-ctrl' }, [playBtn, nextBtn, el('span', { class: 'vol', 'aria-hidden': 'true', text: '🔈' }), volIn]),
      el('p', { class: 'mu-note', text: 'תחנות רדיו חיות מכל העולם, נבדקות כל יום. אם תחנה לא עונה, עוברים לבאה אחריה או למוזיקה מובנית. אפשר לסגור את החלון והמוזיקה ממשיכה.' })
    ]);
    panel.setAttribute('data-lenis-prevent', '');
    var box = el('div', { class: 'music' }, [panel, pill]);
    document.body.appendChild(box);

    genres.forEach(function (g, i) {
      var c = el('button', { class: 'chip', type: 'button', text: g.style, 'aria-pressed': 'false' });
      c.addEventListener('click', function () { playGenre(i); });
      chips.appendChild(c);
    });
    GEN_STYLES.forEach(function (g) {
      var c = el('button', { class: 'chip', type: 'button', text: g.style, 'aria-pressed': 'false' });
      c.addEventListener('click', function () { playGen(g.id, false); });
      genChips.appendChild(c);
    });
    picks.forEach(function (s, i) {
      var c = el('button', { class: 'chip', type: 'button', text: s.style, title: s.title || s.style, 'aria-pressed': 'false' });
      c.addEventListener('click', function () { playYT(i); });
      ytChips.appendChild(c);
    });

    function open(on) { box.classList.toggle('open', on); pill.setAttribute('aria-expanded', String(on)); if (on) startDraw(); }
    pill.addEventListener('click', function () { open(!box.classList.contains('open')); });
    $('.x', panel).addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.fullscreenElement) open(false); });

    function say(main, sub) { $('b', now).textContent = main; $('small', now).textContent = sub || ''; vtitle.textContent = main.replace(/^♪ /, ''); }
    function mark() {
      Array.prototype.forEach.call(chips.children, function (c, i) { c.setAttribute('aria-pressed', String(mode === 'radio' && i === gi)); });
      Array.prototype.forEach.call(genChips.children, function (c, i) { c.setAttribute('aria-pressed', String(mode === 'gen' && GEN_STYLES[i].id === genId)); });
      Array.prototype.forEach.call(ytChips.children, function (c, i) { c.setAttribute('aria-pressed', String(mode === 'yt' && i === yi)); });
    }
    function setPlaying(on) {
      playing = on;
      box.classList.toggle('playing', on);
      playBtn.textContent = on ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', on ? 'השהיה' : 'נגינה');
      $('.mu-label', pill).textContent = mode === 'radio' && gi >= 0 ? genres[gi].style : mode === 'gen' ? GEN_STYLES.filter(function (g) { return g.id === genId; })[0].style : mode === 'yt' && yi >= 0 ? picks[yi].style : 'מוזיקה';
    }
    function quiet() { clearTimeout(watchdog); [audioC, audioP].forEach(function (a) { a.pause(); a.removeAttribute('src'); a.load(); }); active = null; if (gen) gen.stop(); }

    // ----- built-in music
    function playGen(id, fallback) {
      if (!graph()) { say('הדפדפן הזה לא מאפשר מוזיקה מובנית', ''); return; }
      stopYT(); quiet();
      mode = 'gen'; genId = id; mark();
      if (actx.state === 'suspended') actx.resume();
      gen.volume(vol / 100); gen.start(id);
      setPlaying(true);
      var g = GEN_STYLES.filter(function (x) { return x.id === id; })[0];
      store('music-last', 'g:' + id);
      say('♪ ' + g.style, fallback ? 'תחנות הרדיו לא ענו, אז מנגנים מוזיקה מובנית' : 'נוצרת בדפדפן, בלי חיבור');
      startDraw();
    }

    // ----- radio
    function station() { return genres[gi].stations[si % genres[gi].stations.length]; }
    function tune() {
      clearTimeout(watchdog);
      var g = genres[gi], st = station();
      say('מתחבר: ' + st.name + '…', g.style);
      quiet();
      var cors = graph() && !noCors[st.url];
      if (cors && !corsSrc) { try { corsSrc = actx.createMediaElementSource(audioC); corsSrc.connect(bus); } catch (e) { cors = false; } }
      if (actx && actx.state === 'suspended') actx.resume();
      active = cors ? audioC : audioP;
      active.src = st.url;
      var p = active.play();
      if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError') { setPlaying(false); say('לחצו ▶ כדי להתחיל', g.style); } });
      // a station that has not started within 10 seconds is replaced
      watchdog = setTimeout(function () { if (active && (active.paused || active.readyState < 3)) trouble(); }, cors ? 8000 : 10000);
    }
    // the station did not start: first without asking for analysis (some stations refuse), then the next one
    function trouble() {
      clearTimeout(watchdog);
      if (mode !== 'radio' || !active) return;
      if (active === audioC) { noCors[station().url] = 1; store('music-nocors', JSON.stringify(noCors)); tune(); return; }
      skip();
    }
    function skip() {
      clearTimeout(watchdog);
      if (mode !== 'radio') return;
      tried++;
      if (tried >= genres[gi].stations.length) {
        // nobody answers: the built-in music takes over, so there is always something to listen to
        var id = genFor(genres[gi]);
        playGen(id, true);
        return;
      }
      si++;
      tune();
    }
    function playGenre(i) {
      stopYT();
      mode = 'radio'; gi = i; tried = 0;
      si = Math.floor(Math.random() * genres[i].stations.length); // spread listeners over the stations
      store('music-last', 'r:' + genres[i].id);
      mark();
      tune();
    }
    [audioC, audioP].forEach(function (a) {
      a.addEventListener('playing', function () {
        if (a !== active) return;
        clearTimeout(watchdog);
        if (mode !== 'radio') return;
        tried = 0;
        setPlaying(true);
        var st = station();
        say('♪ ' + st.name, genres[gi].style + (st.country ? ' · ' + st.country : '') + (st.bitrate ? ' · ' + st.bitrate + 'kbps' : '') + (a === audioC ? '' : ' · התמונה בלי קשר לצליל'));
        startDraw();
      });
      a.addEventListener('pause', function () { if (a === active && mode === 'radio') setPlaying(false); });
      a.addEventListener('error', function () { if (a === active && mode === 'radio' && a.getAttribute('src')) trouble(); });
    });

    // ----- YouTube picks
    function stopYT() { if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo(); frame.hidden = true; }
    function playYT(i) {
      quiet();
      mode = 'yt'; yi = i;
      store('music-last', 'y:' + i);
      mark();
      frame.hidden = false;
      var s = picks[i], v = ytParse(s.url);
      say('טוען מיוטיוב: ' + (s.title || s.style) + '…', s.style);
      loadYT().then(function () {
        if (!ytPlayer) {
          ytPlayer = new window.YT.Player('mu-yt', {
            width: '100%', height: '100%',
            playerVars: v.id ? { autoplay: 1, playsinline: 1, rel: 0, fs: 1 } : { autoplay: 1, playsinline: 1, rel: 0, fs: 1, listType: 'playlist', list: v.list },
            videoId: v.id || undefined,
            events: {
              onReady: function (e) { e.target.setVolume(vol); e.target.playVideo(); },
              onStateChange: function (e) {
                if (mode !== 'yt') return;
                if (e.data === 1) { setPlaying(true); say('♪ ' + (picks[yi].title || picks[yi].style), 'יוטיוב'); }
                else if (e.data === 2 || e.data === 0) setPlaying(false);
              },
              onError: function () {
                setPlaying(false);
                say('הסרטון הזה חסום לניגון מחוץ ליוטיוב', 'בעל הסרטון לא מתיר הטמעה. נסו רדיו או מוזיקה מובנית.');
              }
            }
          });
        } else if (v.id) ytPlayer.loadVideoById(v.id);
        else ytPlayer.loadPlaylist({ list: v.list, listType: 'playlist' });
      });
    }
    ytFull.addEventListener('click', function () { fullscreen(frame); });

    // ----- my own YouTube: paste a link, or sign in with Google to get my playlists, my subscriptions and every style
    function addPick(title, url, style) {
      for (var k = 0; k < picks.length; k++) if (picks[k].url === url) return k;
      picks.push({ title: title, url: url, style: style || title });
      return picks.length - 1;
    }
    var STYLES = ['טראנס', 'פסיכדלי טראנס', 'אמביינט', 'צ׳יל', 'לאונג׳', 'דיפ האוס', 'טכנו', 'אלקטרוני', 'היפ הופ', 'ג׳אז', 'קלאסית', 'רוק', 'פופ', 'מזרחית', 'ים תיכוני', 'חסידית', 'נשמה ופולק', 'לופי', 'שנות ה־80', 'שנות ה־90'];
    var token = null, GSI = null;
    function gsi() {
      if (GSI) return GSI;
      GSI = new Promise(function (ok, no) {
        if (window.google && window.google.accounts) return ok();
        var sc = el('script', { src: 'https://accounts.google.com/gsi/client', async: '' });
        sc.onload = function () { ok(); }; sc.onerror = function () { GSI = null; no(new Error('gsi')); };
        document.head.appendChild(sc);
      });
      return GSI;
    }
    function yapi(path, qs) {
      var u = 'https://www.googleapis.com/youtube/v3/' + path + '?' + Object.keys(qs).map(function (k) { return k + '=' + encodeURIComponent(qs[k]); }).join('&');
      return fetch(u, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
        if (r.status === 401) { token = null; throw new Error('expired'); }
        if (!r.ok) return r.json().then(function (j) { throw new Error((j.error && j.error.message) || r.status); });
        return r.json();
      });
    }
    function pages(path, qs, max) {
      var out = [];
      function next(tok, n) {
        var q = Object.assign({}, qs); if (tok) q.pageToken = tok;
        return yapi(path, q).then(function (j) { out = out.concat(j.items || []); return j.nextPageToken && n < max ? next(j.nextPageToken, n + 1) : out; });
      }
      return next(null, 1);
    }
    function chip(txt, title, fn) { var c = el('button', { class: 'chip', type: 'button', text: txt, title: title || txt, 'aria-pressed': 'false' }); c.addEventListener('click', fn); return c; }
    function playItem(title, url, style) { var i = addPick(title, url, style); playYT(i); }
    function group(title, kids) {
      var box = el('div', { class: 'mu-styles' }, kids);
      return [el('p', { class: 'mu-sub', text: title }), box];
    }
    function msg(t) { acct.innerHTML = ''; acct.appendChild(el('p', { class: 'mu-note', text: t })); }
    function drawAccount() {
      acct.innerHTML = '';
      Promise.all([
        pages('playlists', { part: 'snippet', mine: 'true', maxResults: 50 }, 3),
        pages('subscriptions', { part: 'snippet', mine: 'true', maxResults: 50, order: 'alphabetical' }, 4)
      ]).then(function (r) {
        var pl = [chip('♥ אהבתי (מוזיקה)', 'הפלייליסט "אהבתי" של יוטיוב מיוזיק', function () { playItem('אהבתי', 'https://www.youtube.com/playlist?list=LM', 'אהבתי'); })]
          .concat(r[0].map(function (p) { return chip(p.snippet.title, p.snippet.title, function () { playItem(p.snippet.title, 'https://www.youtube.com/playlist?list=' + p.id, p.snippet.title); }); }));
        var subs = r[1].map(function (sb) {
          var id = sb.snippet.resourceId.channelId, t = sb.snippet.title;
          return chip(t, 'כל הסרטונים של הערוץ ' + t, function () { playItem(t, 'https://www.youtube.com/playlist?list=UU' + id.slice(2), t); });
        });
        var styles = STYLES.map(function (st) {
          return chip(st, 'חיפוש ביוטיוב: ' + st, function () {
            say('מחפש ' + st + '…', 'יוטיוב');
            yapi('search', { part: 'snippet', q: st + ' music mix', type: 'playlist', maxResults: 8 }).then(function (j) {
              var it = (j.items || [])[Math.floor(Math.random() * Math.min(4, (j.items || []).length))];
              if (!it) return say('לא נמצא ' + st, 'נסו סגנון אחר');
              playItem(it.snippet.title, 'https://www.youtube.com/playlist?list=' + it.id.playlistId, st);
            }).catch(function (e) { say('החיפוש נכשל', String(e.message || e)); });
          });
        });
        [group('כל הסגנונות (חיפוש ביוטיוב)', styles), group('הפלייליסטים שלי', pl), group('המנויים שלי (' + subs.length + ')', subs)].forEach(function (g) { g.forEach(function (n) { acct.appendChild(n); }); });
        var out = el('button', { class: 'mu-vbtn', type: 'button', text: 'התנתקות מיוטיוב' });
        out.addEventListener('click', function () { try { google.accounts.oauth2.revoke(token, function () {}); } catch (e) {} token = null; drawGuest(); });
        acct.appendChild(out);
      }).catch(function (e) {
        if (String(e.message) === 'expired') return drawGuest();
        msg('לא הצלחתי לקרוא את החשבון: ' + (e.message || e) + '. בדקו ש־YouTube Data API v3 מופעל בפרויקט, ושהמייל שלכם מוגדר כמשתמש בדיקה.');
        acct.appendChild(connectBtn());
      });
    }
    function connect() {
      var cid = (mediaCfg && mediaCfg.youtubeClientId) || store('yt-client-id');
      if (!cid) return drawSetup();
      msg('מתחבר לגוגל…');
      gsi().then(function () {
        var tc = google.accounts.oauth2.initTokenClient({
          client_id: cid, scope: 'https://www.googleapis.com/auth/youtube.readonly',
          callback: function (r) { if (r.access_token) { token = r.access_token; drawAccount(); } else { msg('ההתחברות בוטלה'); acct.appendChild(connectBtn()); } },
          error_callback: function () { msg('ההתחברות נכשלה או נחסמה (חלון קופץ?)'); acct.appendChild(connectBtn()); }
        });
        tc.requestAccessToken();
      }).catch(function () { msg('אי אפשר לטעון את התחברות גוגל כרגע'); acct.appendChild(connectBtn()); });
    }
    // a visible place to paste the Google Client ID (kept in this browser only)
    function drawSetup() {
      acct.innerHTML = '';
      var inp = el('input', { class: 'mu-link', type: 'text', placeholder: 'הדביקו כאן את ה־Client ID (נגמר ב־.apps.googleusercontent.com)', dir: 'ltr' });
      var ok = el('button', { class: 'mu-vbtn', type: 'button', text: 'שמירה והתחברות' });
      function save() {
        var v = inp.value.trim();
        if (!/\.apps\.googleusercontent\.com$/.test(v)) return say('ה־Client ID לא נראה תקין', 'הוא נגמר ב־.apps.googleusercontent.com');
        store('yt-client-id', v); connect();
      }
      ok.addEventListener('click', save); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
      acct.appendChild(el('p', { class: 'mu-note', text: 'שלב אחרון: הדביקו את ה־Client ID שיצרתם בגוגל.' }));
      acct.appendChild(el('div', { class: 'mu-linkrow' }, [inp, ok]));
      setTimeout(function () { inp.focus(); }, 50);
    }
    function connectBtn() { var b = el('button', { class: 'mu-vbtn', type: 'button', text: '🔗 חיבור לחשבון היוטיוב שלי' }); b.addEventListener('click', connect); return b; }
    function drawGuest() {
      acct.innerHTML = '';
      var inp = el('input', { class: 'mu-link', type: 'url', placeholder: 'הדביקו קישור ליוטיוב: שיר או פלייליסט', dir: 'ltr' });
      var go = el('button', { class: 'mu-vbtn', type: 'button', text: '▶ ניגון' });
      function run() { var v = ytParse(inp.value); if (!v) return say('הקישור לא נראה כמו יוטיוב', 'שיר או פלייליסט'); playItem('הקישור שלי', inp.value.trim(), 'הקישור שלי'); store('yt-last-link', inp.value.trim()); }
      go.addEventListener('click', run); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
      acct.appendChild(el('div', { class: 'mu-linkrow' }, [inp, go]));
      acct.appendChild(connectBtn());
      acct.appendChild(el('p', { class: 'mu-note', text: 'אחרי החיבור תקבלו את כל הסגנונות, הפלייליסטים והמנויים שלכם. הגישה היא לקריאה בלבד, ולא נשמרת באתר.' }));
    }
    drawGuest();

    // ----- controls
    playBtn.addEventListener('click', function () {
      if (mode === 'yt' && ytPlayer && ytPlayer.getPlayerState) { playing ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); return; }
      if (mode === 'gen') { if (playing) { gen.stop(); setPlaying(false); } else playGen(genId, false); return; }
      if (mode === 'radio') { if (playing) active && active.pause(); else tune(); return; }
      var last = store('music-last') || '';
      var r = last.indexOf('r:') === 0 ? genres.map(function (g) { return g.id; }).indexOf(last.slice(2)) : -1;
      if (last.indexOf('y:') === 0 && picks[Number(last.slice(2))]) playYT(Number(last.slice(2)));
      else if (last.indexOf('g:') === 0) playGen(last.slice(2), false);
      else playGenre(r >= 0 ? r : 0);
    });
    nextBtn.addEventListener('click', function () {
      if (mode === 'yt') { playYT((yi + 1) % picks.length); return; }
      if (mode === 'gen') { var k = GEN_STYLES.map(function (g) { return g.id; }).indexOf(genId); playGen(GEN_STYLES[(k + 1) % GEN_STYLES.length].id, false); return; }
      if (mode !== 'radio') { playGenre(0); return; }
      tried = 0; si++; tune();
    });
    volIn.addEventListener('input', function () {
      vol = Number(volIn.value); store('music-vol', String(vol));
      [audioC, audioP].forEach(function (a) { a.volume = vol / 100; });
      if (gen) gen.volume(vol / 100);
      if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(vol);
    });

    // ----- the picture: a "music video" drawn live from the sound (or from a gentle motion when the sound cannot be read)
    var logo = new Image(); logo.src = base + 'img/spider.svg';
    var raf = 0, t0 = Date.now(), parts = [];
    for (var pi = 0; pi < 60; pi++) parts.push({ a: Math.random() * 6.283, r: 0.2 + Math.random() * 0.8, s: 0.05 + Math.random() * 0.25, z: 0.6 + Math.random() * 1.8 });
    function level() {
      // the real spectrum when this sound is analysable, a soft synthetic one otherwise
      var live = actx && analyser && playing && (mode === 'gen' || (mode === 'radio' && active === audioC));
      var out = new Array(64);
      if (live) {
        analyser.getByteFrequencyData(bins);
        for (var i = 0; i < 64; i++) out[i] = bins[Math.min(bins.length - 1, Math.floor(i * 0.9))] / 255;
      } else {
        var t = (Date.now() - t0) / 1000, on = playing ? 1 : 0.25;
        for (var j = 0; j < 64; j++) out[j] = on * (0.25 + 0.2 * Math.sin(t * 2 + j * 0.35) + 0.15 * Math.sin(t * 3.3 - j * 0.2)) * (1 - j / 110);
      }
      return out;
    }
    function draw() {
      raf = 0;
      var wanted = box.classList.contains('open') || document.fullscreenElement || vis.classList.contains('mu-pseudo') || recorder;
      if (!wanted) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(320, Math.round(canvas.clientWidth * dpr)), h = Math.max(180, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var c = canvas.getContext('2d'), L = level(), t = (Date.now() - t0) / 1000;
      var bass = (L[1] + L[2] + L[3] + L[4]) / 4, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.2 * (1 + bass * 0.35);
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'hsl(' + (255 + bass * 40) + ',60%,' + (18 + bass * 14) + '%)'); g.addColorStop(1, '#0a0919');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // drifting lights
      parts.forEach(function (p) {
        p.a += p.s * 0.01 * (1 + bass * 3);
        var rr = p.r * Math.max(w, h) * 0.55, x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr * 0.6;
        c.fillStyle = 'rgba(' + (p.z > 1.4 ? '224,178,90' : '139,123,255') + ',' + (0.12 + bass * 0.35) + ')';
        c.beginPath(); c.arc(x, y, p.z * (1 + bass * 2.2) * dpr, 0, 6.283); c.fill();
      });
      // the ring of the spectrum
      var n = 64;
      c.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        var a = (i / n) * 6.283 - 1.5708 + t * 0.12, v = L[i], len = R * (0.15 + v * 1.25);
        c.strokeStyle = 'hsl(' + (250 + (i / n) * 110 + bass * 30) + ',80%,' + (58 + v * 25) + '%)';
        c.lineWidth = Math.max(2, (w / 220)) * (0.7 + v);
        c.beginPath(); c.moveTo(cx + Math.cos(a) * R * 1.08, cy + Math.sin(a) * R * 1.08); c.lineTo(cx + Math.cos(a) * (R * 1.08 + len), cy + Math.sin(a) * (R * 1.08 + len)); c.stroke();
      }
      // the centre: the logo breathing with the bass
      c.save(); c.shadowColor = 'rgba(224,178,90,.8)'; c.shadowBlur = 24 * dpr * (0.4 + bass);
      c.fillStyle = 'rgba(23,20,58,.92)'; c.beginPath(); c.arc(cx, cy, R, 0, 6.283); c.fill();
      c.lineWidth = 3 * dpr; c.strokeStyle = 'rgba(224,178,90,.9)'; c.stroke(); c.restore();
      if (logo.complete && logo.naturalWidth) { var s = R * 1.15; c.drawImage(logo, cx - s / 2, cy - s / 2, s, s); }
      // a line of the waveform under it
      c.beginPath(); c.lineWidth = 2 * dpr; c.strokeStyle = 'rgba(241,238,252,.55)';
      for (var k = 0; k < n; k++) { var x2 = (k / (n - 1)) * w, y2 = h * 0.9 - L[k] * h * 0.12; k ? c.lineTo(x2, y2) : c.moveTo(x2, y2); }
      c.stroke();
      raf = requestAnimationFrame(draw);
    }
    function startDraw() { if (!raf) raf = requestAnimationFrame(draw); }

    // ----- full screen (a CSS version where the browser has none, e.g. on iPhone)
    function fullscreen(node) {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (node.requestFullscreen) node.requestFullscreen().catch(function () { node.classList.toggle('mu-pseudo'); startDraw(); });
      else if (node.webkitRequestFullscreen) node.webkitRequestFullscreen();
      else { node.classList.toggle('mu-pseudo'); startDraw(); }
    }
    fullBtn.addEventListener('click', function () { fullscreen(vis); });
    canvas.addEventListener('dblclick', function () { fullscreen(vis); });
    document.addEventListener('fullscreenchange', function () { fullBtn.textContent = document.fullscreenElement ? '✕ יציאה' : '⛶ מסך מלא'; startDraw(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && vis.classList.contains('mu-pseudo')) vis.classList.remove('mu-pseudo'); });

    // ----- recording the picture and the sound to a file
    var recorder = null, recChunks = [], recTimer = null, recStart = 0;
    function stopRec() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
    recBtn.addEventListener('click', function () {
      if (recorder) { stopRec(); return; }
      if (!window.MediaRecorder || !canvas.captureStream) { say('הדפדפן הזה לא יודע להקליט סרטון', 'נסו Chrome, Edge או Firefox'); return; }
      graph();
      var stream = canvas.captureStream(30), sound = false;
      if (recDest && playing && (mode === 'gen' || (mode === 'radio' && active === audioC))) { recDest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); }); sound = true; }
      var mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
      try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3000000 } : undefined); } catch (e) { say('ההקלטה לא התחילה', String(e.message || e)); recorder = null; return; }
      recChunks = [];
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      recorder.onstop = function () {
        clearInterval(recTimer);
        var type = recorder.mimeType || 'video/webm', blob = new Blob(recChunks, { type: type });
        recorder = null; recBtn.textContent = '⏺ הקלטה'; recBtn.classList.remove('rec');
        if (blob.size < 2000) { say('ההקלטה ריקה', 'נסו שוב כשהמוזיקה מנגנת'); return; }
        var d = new Date(), name = 'spider-music-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + (/mp4/.test(type) ? '.mp4' : '.webm');
        var a = el('a', { href: URL.createObjectURL(blob), download: name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 20000);
        say('✓ הסרטון ירד: ' + name, Math.round(blob.size / 1024) + 'KB' + (sound ? '' : ' · בלי קול: התחנה הזו לא מאפשרת הקלטת צליל'));
      };
      recorder.start(1000);
      recStart = Date.now(); recBtn.classList.add('rec');
      recTimer = setInterval(function () {
        var s = Math.floor((Date.now() - recStart) / 1000);
        recBtn.textContent = '⏹ עצירה והורדה · ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
        if (s >= 600) stopRec();
      }, 500);
      startDraw();
      if (!sound) say('מקליט תמונה בלי קול', 'מוזיקה מובנית או תחנה שמאפשרת יתנו גם קול');
    });

    var last = store('music-last') || '';
    var lg = last.indexOf('r:') === 0 ? genres.filter(function (g) { return g.id === last.slice(2); })[0] : null;
    if (lg) say('בפעם הקודמת: ' + lg.style, 'לחצו ▶ כדי להמשיך');
    window.SpiderMusic = { playGen: playGen, state: function () { return { mode: mode, playing: playing, recording: !!recorder }; } };
  }

  // ================================================================ news + riddles (bottom-right)
  function dock(news, riddles) {
    var main = (news && news.feeds && news.feeds.main) || [];
    var tech = (news && news.feeds && news.feeds.tech) || [];
    var list = (riddles && riddles.riddles) || [];
    if (!main.length && !tech.length && !list.length) return;
    document.body.classList.add('has-dock');

    var tick = el('span', { class: 'dk-tick' });
    var pill = el('button', { class: 'dk-pill', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dk-panel' }, [
      el('span', { class: 'dk-ico', 'aria-hidden': 'true', text: main.length ? '📰' : '🧩' }), tick
    ]);
    var tabNews = el('button', { class: 'dk-tab', type: 'button', role: 'tab', text: 'חדשות היום' });
    var tabRid = el('button', { class: 'dk-tab', type: 'button', role: 'tab', text: 'חידת היום' });
    var paneNews = el('div', { class: 'dk-pane', role: 'tabpanel' });
    var paneRid = el('div', { class: 'dk-pane', role: 'tabpanel' });
    var panel = el('div', { class: 'dk-panel', id: 'dk-panel', role: 'dialog', 'aria-label': 'חדשות וחידות' }, [
      el('header', {}, [el('div', { class: 'dk-tabs', role: 'tablist' }, [main.length || tech.length ? tabNews : null, list.length ? tabRid : null]),
        el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', text: '×' })]),
      paneNews, paneRid
    ]);
    var box = el('div', { class: 'dock' }, [panel, pill]);
    document.body.appendChild(box);

    function open(on) { box.classList.toggle('open', on); document.body.classList.toggle('dock-open', on); pill.setAttribute('aria-expanded', String(on)); }
    pill.addEventListener('click', function () { open(!box.classList.contains('open')); });
    $('.x', panel).addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });

    function show(which) {
      var n = which === 'news';
      tabNews.setAttribute('aria-selected', String(n)); tabRid.setAttribute('aria-selected', String(!n));
      paneNews.hidden = !n; paneRid.hidden = n;
      store('dock-tab', which);
    }
    tabNews.addEventListener('click', function () { show('news'); });
    tabRid.addEventListener('click', function () { show('riddle'); });

    // --- news
    var feed = 'main';
    var feedBtns = el('div', { class: 'dk-feeds' });
    var ul = el('ol', { class: 'dk-news' });
    function drawNews() {
      var items = (feed === 'main' ? main : tech).slice(0, 12);
      ul.replaceChildren.apply(ul, items.map(function (x) {
        return el('li', {}, [el('a', { href: x.link, target: '_blank', rel: 'noopener' }, [
          el('b', { text: x.title }), el('small', { text: x.source + (x.at ? ' · ' + ago(x.at) : '') })
        ])]);
      }));
      if (!items.length) ul.appendChild(el('li', { class: 'muted', text: 'אין כרגע כותרות בתחום הזה.' }));
      Array.prototype.forEach.call(feedBtns.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === feed)); });
    }
    [['main', 'ראשי'], ['tech', 'טכנולוגיה']].forEach(function (f) {
      if ((f[0] === 'main' ? main : tech).length) {
        var b = el('button', { class: 'chip', type: 'button', 'data-f': f[0], text: f[1] });
        b.addEventListener('click', function () { feed = f[0]; drawNews(); });
        feedBtns.appendChild(b);
      }
    });
    if (!main.length) feed = 'tech';
    paneNews.append(feedBtns, ul, el('p', { class: 'dk-foot', text: news && news.updatedAt ? 'עודכן ' + ago(news.updatedAt) + ' · מתעדכן לבד כל שעתיים' : '' }));
    drawNews();

    // --- riddle of the day
    var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var at = list.length ? day % list.length : 0;
    var kind = el('span', { class: 'rd-kind' }), title = el('h4'), q = el('p', { class: 'rd-q' });
    var ans = el('p', { class: 'rd-a', hidden: '' });
    var reveal = el('button', { class: 'g-btn', type: 'button', text: 'גלו את התשובה' });
    var count = el('span', { class: 'rd-count' });
    var prev = el('button', { class: 'g-btn ghost', type: 'button', 'aria-label': 'החידה הקודמת', text: '→ הקודמת' });
    var next = el('button', { class: 'g-btn ghost', type: 'button', 'aria-label': 'החידה הבאה', text: 'הבאה ←' });
    var share = el('a', { class: 'rd-share', target: '_blank', rel: 'noopener', text: 'לשלוח לחבר בוואטסאפ ↗' });
    function drawRiddle() {
      var r = list[at];
      kind.textContent = (at === day % list.length ? 'חידת היום · ' : '') + r.kind;
      title.textContent = r.title;
      q.textContent = r.q;
      ans.textContent = '💡 ' + r.a;
      ans.hidden = true; reveal.hidden = false;
      count.textContent = (at + 1) + ' / ' + list.length;
      share.href = 'https://wa.me/?text=' + encodeURIComponent('חידה: ' + r.q + '\n\n(התשובה באתר: ' + location.origin + location.pathname + ')');
    }
    reveal.addEventListener('click', function () { ans.hidden = false; reveal.hidden = true; });
    prev.addEventListener('click', function () { at = (at - 1 + list.length) % list.length; drawRiddle(); });
    next.addEventListener('click', function () { at = (at + 1) % list.length; drawRiddle(); });
    if (list.length) {
      paneRid.append(kind, title, q, reveal, ans, el('div', { class: 'rd-nav' }, [prev, count, next]), share);
      drawRiddle();
    }

    // --- the pill rotates between the newest headlines and the riddle's title
    var lines = main.slice(0, 5).map(function (x) { return ['📰', x.title]; });
    if (list.length) lines.push(['🧩', 'חידת היום: ' + list[day % list.length].title]);
    var li = 0, ico = $('.dk-ico', pill);
    function rotate() {
      tick.classList.remove('in');
      setTimeout(function () { var l = lines[li % lines.length]; ico.textContent = l[0]; tick.textContent = l[1]; tick.classList.add('in'); li++; }, 250);
    }
    rotate();
    if (lines.length > 1 && !reduce) setInterval(function () { if (!box.classList.contains('open')) rotate(); }, 6000);

    show(store('dock-tab') === 'riddle' || !(main.length || tech.length) ? 'riddle' : 'news');
  }

  // ================================================================ videos section
  function videos(items) {
    var sec = document.getElementById('videos');
    if (!sec) return;
    items = (items || []).filter(function (v) { return v && v.url; });
    if (!items.length) return;
    var grid = $('.v-grid', sec);
    items.forEach(function (v) {
      var yt = ytParse(v.url);
      var media;
      if (yt && /youtu/.test(v.url)) {
        // a light thumbnail; the real player loads only on click
        media = el('button', { class: 'v-thumb', type: 'button', 'aria-label': 'ניגון: ' + v.title,
          style: yt.id ? 'background-image:url(https://i.ytimg.com/vi/' + yt.id + '/hqdefault.jpg)' : null }, [el('span', { class: 'v-play', 'aria-hidden': 'true', text: '▶' })]);
        media.addEventListener('click', function () {
          var src = 'https://www.youtube-nocookie.com/embed/' + (yt.id || 'videoseries') + '?autoplay=1&rel=0' + (yt.list ? '&list=' + yt.list : '');
          media.replaceWith(el('iframe', { class: 'v-frame', src: src, title: v.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '' }));
        });
      } else {
        media = el('video', { class: 'v-frame', src: v.url, controls: '', preload: 'metadata', playsinline: '' });
      }
      var isYT = !!(yt && /youtu/.test(v.url));
      var actions = [];
      if (isYT) {
        actions.push(el('a', { class: 'g-btn ghost v-dl', href: v.url, target: '_blank', rel: 'noopener', text: '↗ פתיחה ביוטיוב' }));
        actions.push(el('span', { class: 'v-hint', text: 'סרטוני יוטיוב לא ניתנים להורדה מכאן' }));
      } else {
        var fs = el('button', { class: 'g-btn ghost v-dl', type: 'button', text: '⛶ מסך מלא' });
        fs.addEventListener('click', function () {
          var f = media; var rq = f.requestFullscreen || f.webkitRequestFullscreen || f.webkitEnterFullscreen;
          if (rq) { try { rq.call(f); } catch (e) {} }
        });
        actions.push(fs);
        actions.push(el('a', { class: 'g-btn ghost v-dl', href: v.url, download: '', text: '⬇ הורדה' }));
      }
      grid.appendChild(el('article', { class: 'v-card reveal' }, [
        el('div', { class: 'v-media' }, [media]),
        el('div', { class: 'v-body' }, [
          el('h3', { text: v.title }),
          v.desc ? el('p', { text: v.desc }) : null,
          el('div', { class: 'v-actions' }, actions)
        ])
      ]));
    });
    sec.hidden = false;
    Array.prototype.forEach.call(sec.querySelectorAll('.reveal'), function (n) { setTimeout(function () { n.classList.add('in'); }, 60); });
  }

  // ================================================================ start
  // installable as an app (and so able to open with the computer)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register(base + 'sw.js').catch(function () {}); });
  }
  Promise.all([
    getJSON(base + 'media.json').catch(function () { return {}; }),
    getJSON(base + 'news.json').catch(function () { return null; }),
    getJSON(base + 'riddles.json').catch(function () { return null; }),
    getJSON(base + 'radio.json').catch(function () { return null; })
  ]).then(function (r) {
    mediaCfg = r[0];
    try { music(r[3], r[0].music); } catch (e) { console.warn('music', e); }
    try { if (!document.body.classList.contains('no-dock')) dock(r[1], r[2]); } catch (e) { console.warn('dock', e); }
    try { videos(r[0].videos); } catch (e) { console.warn('videos', e); }
  });
})();
