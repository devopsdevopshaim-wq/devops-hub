// "גיא", an illustrated guide who talks about the projects.
// Speech uses the browser's own Hebrew voice (speechSynthesis) when there is
// one; otherwise he still moves his mouth and the words appear in the bubble.
// Listening uses the browser's speech recognition where it exists (Chrome, Edge).
// Answers come from matching words against projects.json, not from an AI model.
window.Guide = (function () {
  'use strict';

  var FACE =
    '<svg class="guy" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<g class="g-body">' +
        '<path d="M22 204c4-34 30-48 78-50 48 2 74 16 78 50z" fill="#4b3fa8"/>' +
        '<path d="M22 204c4-34 30-48 78-50 48 2 74 16 78 50" fill="none" stroke="#6b5ce0" stroke-width="2" opacity=".6"/>' +
        '<path d="M86 124v30c6 8 22 8 28 0v-30z" fill="#d9987a"/>' +
        '<path d="M78 156c10 12 34 12 44 0" fill="none" stroke="#e0b25a" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="140" cy="176" r="4" fill="#e0b25a"/>' +
      '</g>' +
      '<g class="g-head">' +
        '<ellipse cx="58" cy="96" rx="8" ry="12" fill="#e8ad88"/><ellipse cx="142" cy="96" rx="8" ry="12" fill="#e8ad88"/>' +
        '<path d="M58 86c0-34 19-50 42-50s42 16 42 50c0 32-17 54-42 56-25-2-42-24-42-56z" fill="#f2bf9b"/>' +
        '<path d="M55 90c-6-36 12-62 46-62 36-2 52 24 45 60-3-14-9-24-18-29-16 7-40 5-55-3-9 8-15 20-18 34z" fill="#2a1f3d"/>' +
        '<path d="M86 32c10-10 34-10 44 2-12-3-24-2-44-2z" fill="#3a2c55"/>' +
        '<g class="g-brows" fill="none" stroke="#2a1f3d" stroke-width="4" stroke-linecap="round">' +
          '<path d="M71 76q10-6 21-1"/><path d="M108 75q11-5 21 1"/>' +
        '</g>' +
        '<g class="g-eyes">' +
          '<g class="eye"><ellipse cx="82" cy="92" rx="9" ry="6.5" fill="#fff"/><g class="pupil"><circle cx="82" cy="92" r="4.3" fill="#3b2a1f"/><circle cx="82" cy="92" r="2" fill="#120c08"/><circle cx="83.6" cy="90.4" r="1.3" fill="#fff"/></g></g>' +
          '<g class="eye"><ellipse cx="118" cy="92" rx="9" ry="6.5" fill="#fff"/><g class="pupil"><circle cx="118" cy="92" r="4.3" fill="#3b2a1f"/><circle cx="118" cy="92" r="2" fill="#120c08"/><circle cx="119.6" cy="90.4" r="1.3" fill="#fff"/></g></g>' +
        '</g>' +
        '<g fill="none" stroke="#e0b25a" stroke-width="1.8"><rect x="68" y="81" width="28" height="22" rx="9"/><rect x="104" y="81" width="28" height="22" rx="9"/><path d="M96 90q4-3 8 0M68 88l-9-3M132 88l9-3"/></g>' +
        '<path d="M100 97q-4 13 0 17 4 1 6-2" fill="none" stroke="#c98b6a" stroke-width="2.5" stroke-linecap="round"/>' +
        '<circle cx="71" cy="113" r="7" fill="#ff8fa3" opacity=".28"/><circle cx="129" cy="113" r="7" fill="#ff8fa3" opacity=".28"/>' +
        '<path class="m-closed" d="M88 124q12 9 24 0" fill="none" stroke="#9c3d4a" stroke-width="3" stroke-linecap="round"/>' +
        '<g class="m-open" style="display:none"><ellipse class="m-shape" cx="100" cy="126" rx="10" ry="5" fill="#5a1f2a"/><ellipse class="m-tongue" cx="100" cy="129" rx="6" ry="2.5" fill="#e0707f"/></g>' +
      '</g>' +
    '</svg>';

  var history = [];
  var api, root, bubble, panel, log, input, faceBtn, micBtn, voiceBtn;
  var voice = null, voiceOn = true, talkTimer = null, blinkTimer = null, touring = false, tourStops = [], tourAt = 0;
  var hasTTS = 'speechSynthesis' in window;
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
  function pickVoice() {
    if (!hasTTS) return;
    var he = speechSynthesis.getVoices().filter(function (v) { return /^he|^iw/i.test(v.lang); });
    voice = he.filter(function (v) { return /avri|asaf|male|גבר/i.test(v.name); })[0] || he[0] || null;
    updateVoiceBtn();
  }

  function updateVoiceBtn() {
    if (!voiceBtn) return;
    var can = hasTTS && voice;
    voiceBtn.hidden = !can;
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.innerHTML = voiceOn ? '🔊' : '🔇';
    voiceBtn.title = voiceOn ? 'השתק את גיא' : 'הפעל קול';
  }

  function say(text, done) {
    if (hasTTS) speechSynthesis.cancel();
    stopTalking();
    showBubble(text);
    addMsg('bot', text);
    startTalking();
    var finished = false;
    function end() { if (finished) return; finished = true; stopTalking(); if (done) done(); }
    if (hasTTS && voice && voiceOn) {
      var u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang; u.rate = 1.02; u.pitch = 1;
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      // some browsers never fire onend; don't get stuck
      setTimeout(end, 2500 + text.length * 120);
    } else {
      setTimeout(end, 900 + text.length * 55);
    }
  }

  function hush() { if (hasTTS) speechSynthesis.cancel(); stopTalking(); }

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

  function addMsg(who, text) {
    history.push({ role: who === 'me' ? 'user' : 'assistant', text: text });
    if (history.length > 12) history.shift();
    if (!log) return;
    log.appendChild(h('div', { class: 'g-msg ' + who, text: text }));
    log.scrollTop = log.scrollHeight;
  }

  function openPanel() {
    bubble.classList.remove('show');
    panel.classList.add('open');
    faceBtn.setAttribute('aria-expanded', 'true');
    if (!log.children.length) say('היי, אני גיא. אפשר לשאול אותי על כל פרויקט, לבקש סיור, או ללחוץ על אחת ההצעות למטה.');
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    faceBtn.setAttribute('aria-expanded', 'false');
  }

  // ---------- presenting projects ----------
  var OPEN = ['הנה', 'תסתכל על זה:', 'והנה עוד אחד:', 'זה אחד שאני אוהב:'];
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
    if (has(t, ['מי אתה', 'מה אתה', 'מי זה', 'עליך'])) return say('אני גיא, המדריך של הסדנה. אני מכיר את כל ' + api.projects.length + ' הפרויקטים כאן, ויכול להראות לך כל אחד מהם.');
    if (has(t, ['המלצה', 'המלצות', 'הערה', 'הערות', 'תגובה'])) return say('בכל כרטיס יש לשונית המלצות. לוחצים עליה, נכנסים עם GitHub, וכותבים. ההמלצות נשמרות ומופיעות לכולם.');
    if (has(t, ['כניסות', 'צפיות', 'ביקורים', 'כמה נכנסו'])) return say('מתחת לכל פרויקט רשום כמה פעמים פתחו אותו מהאתר הזה. בראש העמוד יש גם את מספר הביקורים בסדנה.');
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

    if (api.guideApi && !answer.offline) return askServer(raw, t, words, hits);
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
  function askServer(raw) {
    root.classList.add('thinking');
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(api.guideApi.replace(/\/$/, '') + '/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: raw, history: history.slice(0, -1) }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        root.classList.remove('thinking');
        var p = j.project && api.projects.filter(function (x) { return x.id === j.project; })[0];
        if (p) lookAt(api.focusProject(p));
        say(j.answer || '...');
      })
      .catch(function () {
        root.classList.remove('thinking');
        answer.offline = true;
        try { answer(raw); } finally { answer.offline = false; }
      })
      .then(function () { clearTimeout(timer); });
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
    input = h('input', { type: 'text', placeholder: 'שאלו את גיא…', 'aria-label': 'שאלה לגיא' });
    micBtn = h('button', { class: 'g-icon', type: 'button', title: 'דברו עם גיא', 'aria-label': 'דברו עם גיא', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' });
    micBtn.hidden = !Rec;
    micBtn.addEventListener('click', listen);
    voiceBtn = h('button', { class: 'g-icon', type: 'button' });
    voiceBtn.addEventListener('click', function () { voiceOn = !voiceOn; store('guide-voice', voiceOn ? '1' : '0'); if (!voiceOn) hush(); updateVoiceBtn(); });
    var form = h('form', { class: 'g-form' }, [input, micBtn, h('button', { class: 'g-send', type: 'submit', 'aria-label': 'שליחה', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>' })]);
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; answer(v); });

    var chips = h('div', { class: 'g-chips' }, [
      btn('סיור מודרך', startTour, 'chip'),
      btn('סוכני AI', function () { answer('סוכני AI'); }, 'chip'),
      btn('תפתיע אותי', function () { answer('תפתיע אותי'); }, 'chip'),
      btn('כמה פרויקטים יש?', function () { answer('כמה פרויקטים יש?'); }, 'chip'),
      btn('איך משאירים המלצה?', function () { answer('איך משאירים המלצה?'); }, 'chip')
    ]);

    panel = h('section', { class: 'g-panel', 'aria-label': 'שיחה עם גיא' }, [
      h('header', {}, [
        h('div', { class: 'g-mini', html: FACE }),
        h('div', {}, [h('b', { text: 'גיא' }), h('small', { text: 'המדריך של הסדנה' })]),
        voiceBtn,
        closeX(closePanel)
      ]),
      log, chips, form
    ]);

    faceBtn = h('button', { class: 'g-face', type: 'button', 'aria-label': 'שיחה עם גיא', 'aria-expanded': 'false', html: FACE + '<span class="g-ring" aria-hidden="true"></span>' });
    faceBtn.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); });

    root.appendChild(panel);
    root.appendChild(bubble);
    root.appendChild(faceBtn);
    document.body.appendChild(root);
  }

  function init(a) {
    api = a;
    voiceOn = store('guide-voice') !== '0';
    build();
    if (hasTTS) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
    updateVoiceBtn();
    if (!reduce) blink();
    // Browsers only allow speech after a click, so the greeting starts as text.
    setTimeout(function () {
      if (store('guide-seen')) return;
      showBubble('היי, אני גיא 👋 אני מכיר את כל הפרויקטים כאן. רוצה סיור קצר עם קול?', [
        btn('▶ סיור מודרך', function () { store('guide-seen', '1'); startTour(); }),
        btn('דברו איתי', function () { store('guide-seen', '1'); openPanel(); }, 'ghost')
      ]);
    }, 1600);
  }

  return { init: init, present: function (p) { stopTour(); present(p); }, startTour: startTour };
})();
