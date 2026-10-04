// "מאיה", the site's personal assistant: an illustrated avatar who talks about the projects.
// Speech: a woman's neural Hebrew voice, from the browser (Edge) or from the
// server (n8n hasadna-voice); never a male voice. Without one, the words appear on screen.
// Listening uses the browser's speech recognition where it exists (Chrome, Edge).
// Answers come from matching words against projects.json, not from an AI model.
window.Guide = (function () {
  'use strict';

  // The assistant's name and role, in one place.
  var NAME = 'מאיה';
  var ROLE = 'העוזרת האישית של חיים קריספין';
  var WA = 'https://wa.me/972544979771?text=' + encodeURIComponent('היי חיים, הגעתי דרך מאיה באתר ואשמח לדבר');

  var FACE =
    '<svg class="guy" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<path class="g-hairback" d="M48 176c-12-50-8-112 20-136 18-15 46-15 64 0 28 24 32 86 20 136z" fill="#2a1a2e"/>' +
      '<g class="g-body">' +
        '<path d="M16 204c4-34 30-50 84-52 54 2 80 18 84 52z" fill="#2e2a6b"/>' +
        '<path d="M83 152l17 34 17-34z" fill="#f1eefc"/>' +
        '<path d="M83 152l-12 46M117 152l12 46" stroke="#4b3fa8" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M86 122v28c7 8 21 8 28 0v-28z" fill="#e7a98a"/>' +
        '<circle cx="134" cy="180" r="4" fill="#e0b25a"/>' +
      '</g>' +
      '<g class="g-head">' +
        '<path d="M60 88c0-32 18-50 40-50s40 18 40 50c0 30-16 52-40 54-24-2-40-24-40-54z" fill="#f2c4a4"/>' +
        '<circle cx="61" cy="112" r="3.4" fill="#e0b25a"/><circle cx="139" cy="112" r="3.4" fill="#e0b25a"/>' +
        '<path d="M57 96c-5-38 15-62 45-62 28 0 46 22 42 54-5-17-17-29-36-33-12 10-31 17-51 41z" fill="#2a1a2e"/>' +
        '<path d="M98 40c18 2 32 12 38 30" stroke="#4a3350" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<g class="g-brows" fill="none" stroke="#2a1a2e" stroke-width="3" stroke-linecap="round">' +
          '<path d="M72 78q9-5 19-1"/><path d="M109 77q10-4 19 1"/>' +
        '</g>' +
        '<g class="g-eyes">' +
          '<g class="eye"><ellipse cx="82" cy="92" rx="8.5" ry="6.2" fill="#fff"/><g class="pupil"><circle cx="82" cy="92" r="4.2" fill="#4a2f22"/><circle cx="82" cy="92" r="2" fill="#120c08"/><circle cx="83.6" cy="90.4" r="1.3" fill="#fff"/></g><path d="M72.5 89q9.5-8 19 0M72.5 89l-3-2.5" fill="none" stroke="#1b1020" stroke-width="2.4" stroke-linecap="round"/></g>' +
          '<g class="eye"><ellipse cx="118" cy="92" rx="8.5" ry="6.2" fill="#fff"/><g class="pupil"><circle cx="118" cy="92" r="4.2" fill="#4a2f22"/><circle cx="118" cy="92" r="2" fill="#120c08"/><circle cx="119.6" cy="90.4" r="1.3" fill="#fff"/></g><path d="M108.5 89q9.5-8 19 0M127.5 89l3-2.5" fill="none" stroke="#1b1020" stroke-width="2.4" stroke-linecap="round"/></g>' +
        '</g>' +
        '<path d="M100 99q-3 9 0 12 3 1 5-1" fill="none" stroke="#d39a7d" stroke-width="2.2" stroke-linecap="round"/>' +
        '<circle cx="72" cy="111" r="7" fill="#ff8fa3" opacity=".25"/><circle cx="128" cy="111" r="7" fill="#ff8fa3" opacity=".25"/>' +
        '<path class="m-closed" d="M89 123q11 8 22 0" fill="none" stroke="#c9566a" stroke-width="3.4" stroke-linecap="round"/>' +
        '<g class="m-open" style="display:none"><ellipse class="m-shape" cx="100" cy="125" rx="9" ry="4.5" fill="#7a2338"/><ellipse class="m-tongue" cx="100" cy="128" rx="5.5" ry="2.2" fill="#e0707f"/></g>' +
        '<path d="M58 84C60 40 140 40 142 84" fill="none" stroke="#3a3560" stroke-width="4.5" stroke-linecap="round"/>' +
        '<rect x="134" y="82" width="13" height="20" rx="6" fill="#3a3560" stroke="#e0b25a" stroke-width="1.6"/>' +
        '<path d="M140 101c0 14-10 22-24 23" fill="none" stroke="#3a3560" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="109" y="120" width="9" height="6" rx="3" fill="#e0b25a"/>' +
      '</g>' +
      '<g class="g-arm"><path d="M150 190q20-26 12-56" fill="none" stroke="#2e2a6b" stroke-width="15" stroke-linecap="round"/>' +
        '<ellipse cx="161" cy="124" rx="9.5" ry="10.5" fill="#f2c4a4"/>' +
        '<path d="M155 115v-8M160 113v-10M165 114v-8M169 118l4-5" stroke="#f2c4a4" stroke-width="4.2" stroke-linecap="round"/></g>' +
    '</svg>';

  var history = [];
  var api, root, bubble, panel, log, input, faceBtn, micBtn, voiceBtn;
  var voice = null, voiceOn = true, talkTimer = null, blinkTimer = null, touring = false, tourStops = [], tourAt = 0;
  var hasTTS = 'speechSynthesis' in window;
  var natural = false, sayId = 0;
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  // ---------- face animation ----------
  function blink() {
    var eyes = root.querySelectorAll('.eye');
    Array.prototype.forEach.call(eyes, function (e) { e.classList.add('shut'); });
    setTimeout(function () { Array.prototype.forEach.call(eyes, function (e) { e.classList.remove('shut'); }); }, 140);
    blinkTimer = setTimeout(blink, 2200 + Math.random() * 3200);
  }

  function mouth(open) {
    var faces = root.querySelectorAll('.guy');
    Array.prototype.forEach.call(faces, function (f) {
      f.querySelector('.m-closed').style.display = open ? 'none' : '';
      var o = f.querySelector('.m-open');
      o.style.display = open ? '' : 'none';
      if (open) {
        var ry = 2 + Math.random() * 6.5;
        f.querySelector('.m-shape').setAttribute('ry', ry.toFixed(1));
        f.querySelector('.m-shape').setAttribute('rx', (8 + Math.random() * 4).toFixed(1));
        f.querySelector('.m-tongue').setAttribute('cy', (126 + ry * 0.55).toFixed(1));
      }
    });
  }

  function startTalking() {
    root.classList.add('talking');
    clearInterval(talkTimer);
    var i = 0;
    talkTimer = setInterval(function () {
      i++;
      mouth(i % 5 !== 0); // a short pause every few syllables
      if (Math.random() < 0.08) { root.classList.add('brows-up'); setTimeout(function () { root.classList.remove('brows-up'); }, 380); }
    }, 105);
  }

  function stopTalking() {
    clearInterval(talkTimer);
    root.classList.remove('talking');
    mouth(false);
  }

  // Little human things: a wave, a smile under the cursor, eyes that follow it,
  // and a nap when nobody is around.
  function wave() {
    if (reduce || !root) return;
    root.classList.add('waving');
    setTimeout(function () { root.classList.remove('waving'); }, 2600);
  }
  var idleTimer = null;
  function awake() {
    if (!root) return;
    if (root.classList.contains('sleepy')) {
      root.classList.remove('sleepy');
      root.classList.add('brows-up');
      setTimeout(function () { root.classList.remove('brows-up'); }, 500);
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!root.classList.contains('talking') && !panel.classList.contains('open')) root.classList.add('sleepy');
    }, 45000);
  }
  var followQueued = false, fx = 0, fy = 0;
  function follow(e) {
    fx = e.clientX; fy = e.clientY;
    if (followQueued || touring || root.classList.contains('talking')) return;
    followQueued = true;
    requestAnimationFrame(function () {
      followQueued = false;
      var a = faceBtn.getBoundingClientRect();
      var x = fx - (a.left + a.width / 2), y = fy - (a.top + a.height / 2);
      var len = Math.sqrt(x * x + y * y) || 1, k = Math.min(1, len / 300);
      var dx = x / len * 2.6 * k, dy = y / len * 2 * k;
      Array.prototype.forEach.call(root.querySelectorAll('.pupil'), function (p) { p.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')'); });
    });
  }

  // Turn the pupils toward whatever is being shown.
  function lookAt(elm) {
    var pupils = root.querySelectorAll('.pupil');
    var dx = 0, dy = 0;
    if (elm) {
      var a = faceBtn.getBoundingClientRect(), b = elm.getBoundingClientRect();
      var x = (b.left + b.width / 2) - (a.left + a.width / 2), y = (b.top + b.height / 2) - (a.top + a.height / 2);
      var len = Math.sqrt(x * x + y * y) || 1;
      dx = x / len * 2.6; dy = y / len * 2;
    }
    Array.prototype.forEach.call(pupils, function (p) { p.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')'); });
  }

  // ---------- speech ----------
  // Maya speaks only in a woman's voice. Best: Edge's neural "Hila" right in the
  // browser. Next: the same neural voice from the server (n8n hasadna-voice), for
  // browsers that only have the male system voice (Chrome on Windows has "Asaf").
  // Then another female browser voice (Safari's Carmit, Android). Never a male
  // voice: silence with the words on screen is better than the wrong voice.
  var MALE = /asaf|avri|\bmale\b|\bman\b|גבר/i;
  var cloud = null, clip = null, meter = null;

  function pickVoice() {
    if (!hasTTS) return;
    var he = speechSynthesis.getVoices().filter(function (v) { return /^he|^iw/i.test(v.lang) && !MALE.test(v.name); });
    var rank = [
      function (v) { return /hila/i.test(v.name) && /natural|online|neural/i.test(v.name); },
      function (v) { return /natural|online|neural/i.test(v.name); },
      function (v) { return /hila|carmit|female|woman|אישה|נשי/i.test(v.name); },
      function () { return true; }
    ];
    voice = null;
    for (var r = 0; r < rank.length && !voice; r++) voice = he.filter(rank[r])[0] || null;
    natural = !!voice && /natural|online|neural/i.test(voice.name);
    updateVoiceBtn();
  }

  // the server voice: an mp3 for this text, or null (no server voice, quota, offline)
  function fetchClip(text) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    var body = new URLSearchParams({ text: text });
    return fetch(cloud, { method: 'POST', body: body, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(t);
        if (!j.ok) { if (j.error === 'no-voice') { cloud = null; updateVoiceBtn(); } return null; }
        var bin = atob(j.audio), a = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([a], { type: j.mime || 'audio/mpeg' }));
      })
      .catch(function () { clearTimeout(t); return null; });
  }

  // her voice moves the sound bars and the glow around her photo
  function level(el) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      meter = meter || { ctx: new AC() };
      var src = meter.ctx.createMediaElementSource(el), an = meter.ctx.createAnalyser();
      an.fftSize = 64; src.connect(an); an.connect(meter.ctx.destination);
      if (meter.ctx.state === 'suspended') meter.ctx.resume();
      var bins = new Uint8Array(an.frequencyBinCount), bars = root.querySelectorAll('.g-wave i');
      function frame() {
        if (el.paused || el.ended) { root.classList.remove('live'); root.style.removeProperty('--lvl'); return; }
        an.getByteFrequencyData(bins);
        var sum = 0;
        for (var i = 0; i < bars.length; i++) { var v = bins[2 + (i % 5) * 3] / 255; sum += v; bars[i].style.height = Math.round(20 + v * 80) + '%'; }
        root.style.setProperty('--lvl', (sum / bars.length).toFixed(2));
        requestAnimationFrame(frame);
      }
      el.addEventListener('playing', function () { root.classList.add('live'); frame(); });
    } catch (e) {}
  }

  function updateVoiceBtn() {
    if (!voiceBtn) return;
    var can = (hasTTS && voice) || cloud;
    voiceBtn.hidden = !can;
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.innerHTML = voiceOn ? '🔊' : '🔇';
    voiceBtn.title = voiceOn ? 'השתקה' : 'הפעלת קול';
  }

  // Speaks like a person: in the chat she "types" for a moment, then the words
  // appear as she says them.
  function say(text, done) {
    hush();
    var id = ++sayId;
    var chat = panel && panel.classList.contains('open');
    var wait = chat && !reduce ? Math.min(1500, 450 + text.length * 9) : 0;
    // the server voice is fetched while she "types", so the words and the sound start together
    var pending = voiceOn && cloud && !natural ? fetchClip(text) : null;
    var t0 = Date.now();
    function go(url) { if (id === sayId) speak(text, done, id, !!wait, url); else if (url) URL.revokeObjectURL(url); }
    if (wait) typing(true);
    if (pending) pending.then(function (url) { setTimeout(function () { go(url); }, Math.max(0, wait - (Date.now() - t0))); });
    else if (wait) setTimeout(go, wait);
    else go();
  }

  function speak(text, done, id, reveal, url) {
    showBubble(text);
    var msg = addMsg('bot', text, reveal);
    startTalking();
    var finished = false;
    function end() {
      if (finished) return; finished = true;
      if (msg && msg.finish) msg.finish();
      stopTalking();
      if (url) URL.revokeObjectURL(url);
      if (done) done();
    }
    if (url) {
      var a = clip = new Audio(url);
      a.onended = end; a.onerror = end;
      // the words appear in step with her voice
      a.ontimeupdate = function () { if (msg && msg.upTo && a.duration && id === sayId) msg.upTo(Math.floor(text.length * a.currentTime / a.duration)); };
      level(a);
      var p = a.play();
      if (p && p.catch) p.catch(function () { setTimeout(end, 900 + text.length * 55); }); // autoplay blocked: words only
      setTimeout(end, 4000 + text.length * 150);
    } else if (hasTTS && voice && voiceOn && (natural || !cloud)) {
      var u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang;
      u.rate = natural ? 1 : 0.98; u.pitch = natural ? 1 : 1.08;
      u.onend = end; u.onerror = end;
      u.onboundary = function (e) { if (msg && msg.upTo && id === sayId) msg.upTo(e.charIndex); };
      speechSynthesis.speak(u);
      setTimeout(end, 2500 + text.length * 120); // some browsers never fire onend
    } else {
      // no voice: the photo does not pretend to talk, the words just appear
      if (root.classList.contains('photo')) stopTalking();
      setTimeout(end, 900 + text.length * 55);
    }
  }

  function hush() { if (hasTTS) speechSynthesis.cancel(); if (clip) { clip.pause(); clip = null; } stopTalking(); }

  // ---------- UI ----------
  function showBubble(text, buttons) {
    if (panel.classList.contains('open')) return;
    bubble.replaceChildren(h('p', { text: text }));
    if (buttons) bubble.appendChild(h('div', { class: 'g-actions' }, buttons));
    bubble.appendChild(closeX(function () { bubble.classList.remove('show'); stopTour(); hush(); }));
    bubble.classList.add('show');
  }

  function closeX(fn) {
    var b = h('button', { class: 'g-x', type: 'button', 'aria-label': 'סגור', text: '×' });
    b.addEventListener('click', fn);
    return b;
  }

  function btn(label, fn, cls) {
    var b = h('button', { class: 'g-btn ' + (cls || ''), type: 'button', text: label });
    b.addEventListener('click', fn);
    return b;
  }

  function clock() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function addMsg(who, text, reveal) {
    history.push({ role: who === 'me' ? 'user' : 'assistant', text: text });
    if (history.length > 12) history.shift();
    if (!log) return;
    typing(false);
    if (who === 'me') panel.classList.add('chatting');
    var span = h('span', { text: reveal ? '' : text });
    var row = h('div', { class: 'g-row ' + who }, [
      who === 'bot' ? h('span', { class: 'g-av', html: FACE }) : null,
      h('div', { class: 'g-msg ' + who }, [span, h('time', { text: clock() })])
    ]);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    if (!reveal) return null;
    // word by word: follows the voice when it reports its position, otherwise a steady pace
    var shown = 0, timer = null;
    function show(n) { if (n <= shown) return; shown = Math.min(n, text.length); span.textContent = text.slice(0, shown); log.scrollTop = log.scrollHeight; }
    function nextWord() { var i = text.indexOf(' ', shown + 1); return i < 0 ? text.length : i; }
    timer = setInterval(function () { show(nextWord()); if (shown >= text.length) clearInterval(timer); }, voiceOn && (voice || cloud) ? 260 : 55);
    return {
      upTo: function (i) { var j = text.indexOf(' ', i + 1); show(j < 0 ? text.length : j); },
      finish: function () { clearInterval(timer); show(text.length); }
    };
  }
  var typingEl = null;
  function typing(on) {
    if (!log) return;
    if (on && !typingEl) {
      typingEl = h('div', { class: 'g-row bot g-typing', 'aria-label': NAME + ' מקלידה' }, [h('span', { class: 'g-av', html: FACE }), h('div', { class: 'g-msg bot' }, [h('i'), h('i'), h('i')])]);
      log.appendChild(typingEl);
      log.scrollTop = log.scrollHeight;
    } else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }
  function actionsRow(list) {
    if (!log) return;
    var row = h('div', { class: 'g-next' });
    list.forEach(function (x) { row.appendChild(btn(x[0], x[1], 'chip')); });
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function visitor() { return store('maya-name') || ''; }
  function greet() {
    var hr = new Date().getHours();
    var g = hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 17 ? 'צהריים טובים' : hr < 21 ? 'ערב טוב' : 'לילה טוב';
    return g + (visitor() ? ', ' + visitor() : '');
  }

  function openPanel() {
    bubble.classList.remove('show');
    panel.classList.add('open');
    root.classList.add('chat-open');
    faceBtn.setAttribute('aria-expanded', 'true');
    if (!log.querySelector('.g-msg')) say(greet() + '! אני ' + NAME + ', ' + ROLE + '. ' + (visitor() ? 'טוב שחזרת. ' : '') + 'במה אוכל לעזור היום? אפשר לשאול אותי על כל פרויקט, על שירותים ומחירים, או לקבוע שיחה עם חיים.');
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    root.classList.remove('chat-open');
    faceBtn.setAttribute('aria-expanded', 'false');
  }

  // ---------- presenting projects ----------
  var OPEN = ['הנה', 'תסתכלו על זה:', 'והנה עוד אחד:', 'זה אחד שאני אוהבת במיוחד:'];
  var BLURB = {
    web: 'אתר שנבנה ופורסם ברשת',
    ai: 'פרויקט שמשתמש בבינה מלאכותית',
    tools: 'כלי שימושי ליום־יום',
    data: 'מערכת לניהול ומעקב אחרי מידע',
    lotto: 'כלי לניתוח ובחירת מספרים ללוטו',
    study: 'פרויקט של לימוד ותוכן',
    other: 'אפליקציה או מצגת',
    devops: 'כלי DevOps לאירוח והפעלת שרתים'
  };
  function line(p, i) {
    if (p.say) return p.say;
    var s = api.status(p);
    var t = (i === undefined ? '' : OPEN[i % OPEN.length] + ' ') + p.title + ': ' + (p.desc || BLURB[p.category] + '.');
    if (s.kind === 'live') t += ' אפשר לפתוח אותו עכשיו בכפתור פתיחה.';
    else if (s.kind === 'local') t += ' הוא רץ על המחשב האישי.';
    else if (s.kind === 'private') t += ' הוא שמור במאגר פרטי.';
    return t;
  }

  function present(p, i, done) {
    var card = api.focusProject(p);
    lookAt(card);
    say(line(p, i), done);
  }

  // ---------- tour ----------
  function buildTour() {
    var seen = {}, stops = [];
    api.projects.forEach(function (p) { if (p.featured) { stops.push(p); seen[p.category + ':f'] = 1; } });
    api.projects.forEach(function (p) {
      if (p.localhost || p.private || seen[p.category] || p.featured) return;
      seen[p.category] = 1; stops.push(p);
    });
    return stops;
  }

  function startTour() {
    hush();
    touring = true; tourStops = buildTour(); tourAt = 0;
    say('יאללה, סיור קצר. אראה לך ' + tourStops.length + ' פרויקטים, אחד מכל תחום.', nextStop);
  }

  function nextStop() {
    if (!touring) return;
    if (tourAt >= tourStops.length) {
      touring = false;
      api.focusProject(null); lookAt(null);
      say('זהו, סיימנו. יש עוד ' + (api.projects.length - tourStops.length) + ' פרויקטים ברשימה. אפשר לשאול אותי על כל אחד מהם.');
      return;
    }
    var p = tourStops[tourAt];
    present(p, tourAt, function () { if (touring) setTimeout(nextStop, 700); });
    tourAt++;
    if (!panel.classList.contains('open')) {
      showBubble(line(p, tourAt - 1), [btn('הבא', function () { hush(); nextStop(); }), btn('עצור', function () { stopTour(); hush(); bubble.classList.remove('show'); }, 'ghost')]);
    }
  }

  function stopTour() { touring = false; api.focusProject(null); lookAt(null); }

  // ---------- understanding ----------
  function norm(s) { return String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"'׳`]/g, '').replace(/[.,!?:;()\-—]/g, ' ').replace(/\s+/g, ' ').trim(); }

  var CAT_WORDS = {
    ai: ['ai', 'בינה', 'סוכן', 'סוכנים', 'מלאכותית', 'רובוט', 'עוזר'],
    lotto: ['לוטו', 'הגרלה', 'הגרלות', 'מזל'],
    data: ['מחסן', 'נתונים', 'קבצים', 'מלאי'],
    tools: ['כלים', 'כלי', 'מחשבון', 'לוח שנה', 'חגים', 'תרגום', 'ביטוח'],
    study: ['זוהר', 'לימוד', 'קורס', 'ללמוד'],
    devops: ['devops', 'דבאופס', 'שרת', 'שרתים', 'אירוח', 'דוקר', 'docker', 'ענן'],
    web: ['אתרים', 'אתר', 'חופשה', 'חופשות', 'ספרים', 'עיצוב'],
    other: ['אפליקציה', 'אפליקציות', 'מצגת', 'מצגות', 'טלפון']
  };

  function has(t, words) { return words.some(function (w) { return (' ' + t + ' ').indexOf(' ' + w) !== -1; }); }

  function answer(raw) {
    var t = norm(raw);
    if (!answer.offline) addMsg('me', raw);
    if (!t) return;
    if (t.split(' ').some(function (w) { return ['עצור', 'די', 'שקט', 'תפסיק', 'stop'].indexOf(w) !== -1; })) { stopTour(); hush(); return say('בסדר, עצרתי.'); }
    if (has(t, ['סיור', 'טיול', 'תראה לי הכול', 'תראה לי הכל'])) return startTour();
    if (has(t, ['אקראי', 'תפתיע', 'הפתע'])) {
      var pool = api.projects.filter(function (p) { return !p.localhost; });
      return present(pool[Math.floor(Math.random() * pool.length)]);
    }
    // With the n8n agent connected, every real question goes to it.
    if (api.guideApi && !answer.offline) return askServer(raw);
    if (has(t, ['מי אתה', 'מה אתה', 'מי זה', 'עליך'])) return say('אני ' + NAME + ', ' + ROLE + '. אני מכירה את כל ' + api.projects.length + ' הפרויקטים כאן, יכולה להראות כל אחד מהם, ולתאם לך שיחה עם חיים.');
    var nm = /^(?:קוראים לי|שמי|השם שלי)\s+([\u0590-\u05FFa-z]{2,14})$/i.exec(t);
    if (nm) { store('maya-name', nm[1]); return say('נעים מאוד, ' + nm[1] + '! שמחה להכיר. איך אוכל לעזור לך?'); }
    if (has(t, ['מחיר', 'מחירים', 'עולה', 'עלות', 'הצעת מחיר', 'מבצע', 'מבצעים', 'שירות', 'שירותים', 'לעסק'])) {
      say('חיים בונה לעסקים אוטומציות, סוכני AI, אתרים ומערכות ניהול, במחיר קבוע מראש. את המחירים והמבצעים העדכניים תמצאו בדף השירותים, ושיחת אפיון של 30 דקות היא בחינם.');
      return actionsRow([['💰 לשירותים ולמחירים', function () { location.href = 'services.html'; }], ['📅 לקבוע שיחה', function () { window.open(WA, '_blank', 'noopener'); }]]);
    }
    if (has(t, ['שיחה', 'לדבר', 'טלפון', 'וואטסאפ', 'ווטסאפ', 'חיים', 'פגישה', 'ליצור קשר'])) {
      say('בשמחה. חיים זמין בוואטסאפ ובטלפון 054-4979771, ובדרך כלל עונה באותו יום.');
      return actionsRow([['💬 שליחת הודעה לחיים', function () { window.open(WA, '_blank', 'noopener'); }]]);
    }
    if (has(t, ['המלצה', 'המלצות', 'הערה', 'הערות', 'תגובה'])) return say('בכל כרטיס יש לשונית המלצות. לוחצים עליה, נכנסים עם GitHub, וכותבים. ההמלצות נשמרות ומופיעות לכולם.');
    if (has(t, ['כניסות', 'צפיות', 'ביקורים', 'כמה נכנסו'])) return say('מתחת לכל פרויקט רשום כמה פעמים פתחו אותו מהאתר הזה. בראש העמוד יש גם את מספר הביקורים בסדנה.');
    if (has(t, ['אוטומציה', 'אוטומטי', 'אוטומציות', 'מתעדכן', 'n8n', 'ci', 'pipeline', 'github actions'])) {
      var auto = api.projects.filter(function (p) { return (p.tech || []).some(function (x) { return /n8n|docker|nginx|python|node/i.test(x); }); });
      return say('האתר עצמו אוטומטי לגמרי: כל שינוי מתפרסם לבד ב־GitHub Pages, GitHub Actions מצלם את כל הפרויקטים, וטופס הוספת פרויקט מוסיף פרויקט בלי לגעת בקוד. ' +
        (auto.length ? 'בין הפרויקטים, אוטומציה ושרתים יש ב־' + auto.slice(0, 5).map(function (p) { return p.title; }).join(', ') + '.' : '') +
        (api.guideApi ? '' : ' כשאחובר לסוכן ב־n8n אוכל להסביר כל תהליך לעומק.'));
    }
    if (has(t, ['כמה'])) {
      var live = api.projects.filter(function (p) { return api.status(p).kind === 'live'; }).length;
      return say('יש כאן ' + api.projects.length + ' פרויקטים, ' + live + ' מהם באוויר עכשיו.');
    }

    // a project by name
    var words = t.split(' ').filter(function (w) { return w.length >= 2; });
    var hits = api.projects.map(function (p) {
      var title = norm(p.title + ' ' + (p.repo || '') + ' ' + p.id + ' ' + (p.aka || ''));
      var score = words.filter(function (w) { return title.indexOf(w) !== -1; }).length;
      if (t.indexOf(norm(p.title)) !== -1) score += 5;
      return { p: p, score: score };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });

    var cat = Object.keys(CAT_WORDS).filter(function (k) { return has(t, CAT_WORDS[k]); })[0];
    if (hits.length && (hits.length === 1 || (hits[0].score > hits[1].score && !cat))) return present(hits[0].p);
    if (cat) {
      var list = api.projects.filter(function (p) { return p.category === cat; });
      api.filter(cat);
      var names = list.slice(0, 4).map(function (p) { return p.title; }).join(', ');
      lookAt(document.getElementById('all'));
      return say('בתחום ' + api.categories[cat] + ' יש ' + list.length + ' פרויקטים: ' + names + (list.length > 4 ? ' ועוד.' : '.') + ' סיננתי לך אותם ברשימה.');
    }
    if (hits.length) return say('מצאתי כמה: ' + hits.slice(0, 4).map(function (x) { return x.p.title; }).join(', ') + '. על איזה מהם לספר?');
    if (has(t, ['שלום', 'היי', 'הי', 'בוקר', 'ערב', 'מה נשמע', 'מה קורה'])) return say('היי! טוב לראות אותך. רוצה סיור, או לשאול על פרויקט מסוים?');
    say('לא הבנתי את זה. אפשר לשאול למשל על לוטו, על סוכני AI, על ניהול מחסן, או לבקש סיור.');
  }

  // Ask the AI server (portfolio/guide-server). On any failure fall back to
  // word matching for this question.
  // One id per browser tab, so the n8n agent remembers this conversation.
  var sessionId = (function () {
    var k = 'guide-session', v = null;
    try { v = sessionStorage.getItem(k); } catch (e) {}
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); try { sessionStorage.setItem(k, v); } catch (e) {} }
    return v;
  })();

  // Ask the AI agent: the n8n webhook (full URL) or portfolio/guide-server
  // (base URL, /ask is added). text/plain keeps it a simple request, so the
  // browser doesn't need a CORS preflight. Any failure falls back to word matching.
  function askServer(raw) {
    root.classList.add('thinking');
    typing(true);
    var url = /\/webhook(-test)?\/|\/ask$/.test(api.guideApi) ? api.guideApi : api.guideApi.replace(/\/$/, '') + '/ask';
    var page = (/^#p\/(.+)$/.exec(location.hash) || [])[1] || '';
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ question: raw, sessionId: sessionId, page: decodeURIComponent(page), history: history.slice(0, -1) }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        root.classList.remove('thinking');
        if (!j || !j.answer) throw new Error('empty');
        var p = j.project && api.projects.filter(function (x) { return x.id === j.project; })[0];
        if (p) lookAt(api.focusProject(p));
        say(j.answer);
        followUps(j.next);
      })
      .catch(function () {
        root.classList.remove('thinking');
        typing(false);
        answer.offline = true;
        try { answer(raw); } finally { answer.offline = false; }
      })
      .then(function () { clearTimeout(timer); });
  }

  // Deeper questions the agent suggests, as buttons under its answer.
  function followUps(list) {
    if (!list || !list.length || !log) return;
    var row = h('div', { class: 'g-next' });
    list.slice(0, 2).forEach(function (q) {
      row.appendChild(btn(q, function () { row.remove(); answer(q); }, 'chip'));
    });
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function listen() {
    if (!Rec) return;
    hush();
    var r = new Rec();
    r.lang = 'he-IL'; r.interimResults = false; r.maxAlternatives = 1;
    micBtn.classList.add('on');
    r.onresult = function (e) { answer(e.results[0][0].transcript); };
    r.onerror = function (e) { if (e.error === 'not-allowed') say('צריך לאשר גישה למיקרופון בדפדפן כדי שאשמע אותך.'); };
    r.onend = function () { micBtn.classList.remove('on'); };
    r.start();
  }

  // ---------- build ----------
  function build() {
    root = h('div', { class: 'guide', id: 'guide' });
    bubble = h('div', { class: 'g-bubble', role: 'status', 'aria-live': 'polite' });

    log = h('div', { class: 'g-log', 'aria-live': 'polite' });
    input = h('input', { type: 'text', placeholder: 'כתבו הודעה…', 'aria-label': 'הודעה ל' + NAME });
    micBtn = h('button', { class: 'g-icon', type: 'button', title: 'הקלטה קולית', 'aria-label': 'הקלטה קולית', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' });
    micBtn.hidden = !Rec;
    micBtn.addEventListener('click', listen);
    voiceBtn = h('button', { class: 'g-icon', type: 'button' });
    voiceBtn.addEventListener('click', function () { voiceOn = !voiceOn; store('guide-voice', voiceOn ? '1' : '0'); if (!voiceOn) hush(); updateVoiceBtn(); });
    var form = h('form', { class: 'g-form' }, [input, micBtn, h('button', { class: 'g-send', type: 'submit', 'aria-label': 'שליחה', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>' })]);
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; answer(v); });

    var ask = function (q) { return function () { answer(q); }; };
    var chips = h('div', { class: 'g-welcome' }, [
      h('p', { class: 'g-welcome-t', text: 'במה אפשר לעזור?' }),
      h('div', { class: 'g-grid' }, [
        btn('💼 מה אפשר לבנות לעסק שלי?', ask('מה אפשר לבנות לעסק שלי? שירותים ומחירים'), 'tile'),
        btn('🧭 סיור בפרויקטים', startTour, 'tile'),
        btn('🤖 סוכני AI', ask('סוכני AI'), 'tile'),
        btn('⚙️ אוטומציות', ask('אילו פרויקטים משתמשים באוטומציה, ואיך?'), 'tile'),
        btn('💰 שירותים ומחירים', function () { location.href = 'services.html'; }, 'tile'),
        btn('📅 לקבוע שיחה עם חיים', function () { window.open(WA, '_blank', 'noopener'); }, 'tile')
      ])
    ]);

    panel = h('section', { class: 'g-panel', 'aria-label': 'שיחה עם ' + NAME }, [
      h('header', {}, [
        h('div', { class: 'g-mini', html: FACE }),
        h('div', { class: 'g-who' }, [h('b', {}, [document.createTextNode(NAME + ' '), h('span', { class: 'g-verified', title: 'עוזרת רשמית', text: '✓' })]), h('small', { text: ROLE }), h('span', { class: 'g-online', text: 'מחוברת עכשיו' })]),
        voiceBtn,
        closeX(closePanel)
      ]),
      log, chips, form, h('p', { class: 'g-foot', text: 'SPIDER · חיים קריספין · 054-4979771' })
    ]);

    faceBtn = h('button', { class: 'g-face', type: 'button', 'aria-label': 'שיחה עם ' + NAME + ', ' + ROLE, 'aria-expanded': 'false', html: FACE + '<span class="g-ring" aria-hidden="true"></span>' });
    faceBtn.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); });
    faceBtn.appendChild(h('span', { class: 'g-zz', 'aria-hidden': 'true', text: 'z z' }));
    faceBtn.addEventListener('pointerenter', function () { root.classList.add('happy'); awake(); if (!root.classList.contains('talking')) wave(); });
    faceBtn.addEventListener('pointerleave', function () { root.classList.remove('happy'); });

    root.appendChild(panel);
    root.appendChild(bubble);
    root.appendChild(faceBtn);
    document.body.appendChild(root);
  }

  // A real photo of the assistant replaces the drawing as soon as img/maya.jpg exists.
  var PHOTO = 'img/maya.jpg';
  function usePhoto() {
    var img = new Image();
    img.onload = function () {
      var tag = '<img class="g-photo" src="' + PHOTO + '" alt="">';
      FACE = tag;
      root.classList.add('photo');
      faceBtn.querySelector('.guy').outerHTML = tag;
      faceBtn.appendChild(h('span', { class: 'g-wave', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i'), h('i'), h('i')]));
      Array.prototype.forEach.call(document.querySelectorAll('.g-mini, .g-av'), function (n) { n.innerHTML = tag; });
    };
    img.src = PHOTO;
  }

  // Maya standing, like a video call next to the chat (wide screens only)
  var FULL = 'img/maya-full.jpg';
  function useStage() {
    var img = new Image();
    img.onload = function () {
      img.className = 'g-stage-photo'; img.alt = '';
      root.appendChild(h('div', { class: 'g-stage', 'aria-hidden': 'true' }, [
        img,
        h('span', { class: 'g-wave' }, [h('i'), h('i'), h('i'), h('i'), h('i')]),
        h('span', { class: 'g-tag', text: NAME + ' · ' + ROLE })
      ]));
      root.classList.add('staged');
    };
    img.src = FULL;
  }

  function init(a) {
    api = a;
    // the server voice lives next to the n8n agents
    if (api.guideApi && /\/webhook\/hasadna-guide/.test(api.guideApi)) cloud = api.guideApi.replace(/hasadna-guide.*$/, 'hasadna-voice');
    voiceOn = store('guide-voice') !== '0';
    build();
    usePhoto();
    useStage();
    if (hasTTS) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
    updateVoiceBtn();
    if (!reduce) {
      blink();
      document.addEventListener('pointermove', follow, { passive: true });
      ['pointermove', 'scroll', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, awake, { passive: true }); });
      awake();
    }
    // Browsers only allow speech after a click, so the greeting starts as text.
    setTimeout(function () {
      if (store('guide-seen')) return;
      wave();
      showBubble(greet() + '! אני ' + NAME + ' 👋 ' + ROLE + '. אפשר לעזור לכם למצוא פרויקט, להבין מחירים או לקבוע שיחה.', [
        btn('💬 שיחה איתי', function () { store('guide-seen', '1'); openPanel(); }),
        btn('▶ סיור מודרך', function () { store('guide-seen', '1'); startTour(); }, 'ghost')
      ]);
    }, 1600);
  }

  return { init: init, present: function (p) { stopTour(); present(p); }, startTour: startTour };
})();
