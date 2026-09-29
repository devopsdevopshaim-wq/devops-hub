/* ספר — סטודיו לכתיבת ספרים: לוגיקת האפליקציה */
(function () {
  'use strict';
  var P = window.BookPrompts;
  var S = window.BookStore;
  var L = window.BookLayout;
  var esc = L.esc;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var project = null;
  var imageCache = {};
  var ai = { mode: 'manual', code: '' };
  var busy = null;          // AbortController של פעולת AI פעילה
  var stopAll = false;
  var bookDirty = true;
  var saveTimer = null;

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function num(n) { return Number(n || 0).toLocaleString('he-IL'); }

  function ls(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, isErr ? 7000 : 3500);
  }

  function blankProject() {
    return {
      id: uid(), title: '', subtitle: '', author: '', genre: 'memoir', voice: 'first', register: 'high',
      kidsAge: '4–7', targetPages: 200, trim: 'a5', fontScale: 1, bookTheme: 'royal', dedication: '', notes: '', blurb: '',
      sections: [{ id: uid(), title: '', text: '' }], chapters: [], images: [], createdAt: Date.now()
    };
  }

  function save(opts) {
    bookDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      S.saveProject(project).catch(function () { toast('השמירה בדפדפן נכשלה. כדאי לגבות לקובץ.', true); });
      ls('bs-current', project.id);
    }, opts && opts.now ? 0 : 500);
  }

  /* ================= נגישות ================= */
  var a11y = Object.assign({ scale: 1 }, ls('bs-a11y') || {});
  function applyA11y() {
    var r = document.documentElement;
    r.style.setProperty('--ui-scale', a11y.scale);
    r.dataset.contrast = a11y.contrast ? 'high' : '';
    r.dataset.theme = a11y.light ? 'light' : '';
    r.dataset.readable = a11y.readable ? '1' : '';
    r.dataset.links = a11y.links ? '1' : '';
    r.dataset.motion = a11y.motion ? 'off' : '';
    r.dataset.spacing = a11y.spacing ? '1' : '';
    $$('#a11yDialog input[type="checkbox"]').forEach(function (c) { c.checked = !!a11y[c.dataset.a11y]; });
    ls('bs-a11y', a11y);
  }
  function bindA11y() {
    $('#a11yBtn').addEventListener('click', function () { $('#a11yDialog').showModal(); });
    $('#a11yDialog').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a11y]');
      if (!b) return;
      var k = b.dataset.a11y;
      if (k === 'font+') a11y.scale = Math.min(1.6, +(a11y.scale + 0.1).toFixed(2));
      if (k === 'font-') a11y.scale = Math.max(0.9, +(a11y.scale - 0.1).toFixed(2));
      if (k === 'font0') a11y.scale = 1;
      if (k === 'reset') a11y = { scale: 1 };
      applyA11y();
    });
    $('#a11yDialog').addEventListener('change', function (e) {
      if (e.target.dataset.a11y) { a11y[e.target.dataset.a11y] = e.target.checked; applyA11y(); }
    });
    $('#a11yStatementBtn').addEventListener('click', function () { $('#statementDialog').showModal(); });
  }

  /* ================= ניווט ================= */
  var STEPS = ['details', 'story', 'images', 'write', 'book'];
  function route() {
    var step = (location.hash || '#details').slice(1);
    if (STEPS.indexOf(step) < 0) step = 'details';
    STEPS.forEach(function (s) {
      $('#panel-' + s).hidden = s !== step;
      var tab = $('#tab-' + s);
      tab.setAttribute('aria-selected', s === step ? 'true' : 'false');
      tab.tabIndex = s === step ? 0 : -1;
    });
    if (step === 'images') renderImages();
    if (step === 'write') renderChapters();
    if (step === 'book') renderBook();
    if (step === 'details') renderPlan();
    if (route.started) {
      var h = $('#panel-' + step + ' h1, #panel-' + step + ' h2');
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    }
    route.started = true;
  }
  function bindTabs() {
    window.addEventListener('hashchange', route);
    $('.steps [role="tablist"]').addEventListener('keydown', function (e) {
      var i = STEPS.indexOf((location.hash || '#details').slice(1));
      if (e.key === 'ArrowLeft') i = Math.min(STEPS.length - 1, i + 1);
      else if (e.key === 'ArrowRight') i = Math.max(0, i - 1);
      else return;
      e.preventDefault();
      location.hash = STEPS[i];
      $('#tab-' + STEPS[i]).focus();
    });
  }

  /* ================= שלב 1: פרטי הספר ================= */
  function renderDetails() {
    var f = $('#detailsForm');
    ['title', 'subtitle', 'author', 'register', 'kidsAge', 'dedication', 'notes'].forEach(function (k) {
      if (f.elements[k]) f.elements[k].value = project[k] || '';
    });
    $$('input[name="voice"]', f).forEach(function (r) { r.checked = r.value === (project.voice || 'first'); });

    $('#genreGrid').innerHTML = Object.keys(P.GENRES).map(function (k) {
      var g = P.GENRES[k];
      var short = g.voice.split(/[.:]/)[0];
      return '<label class="genre"><input type="radio" name="genre" value="' + k + '"' + (project.genre === k ? ' checked' : '') + '>' +
        '<strong>' + esc(g.label) + '</strong><span>' + esc(short) + '</span></label>';
    }).join('');

    $('#f-trim').innerHTML = Object.keys(P.TRIMS).map(function (k) {
      return '<option value="' + k + '"' + (project.trim === k ? ' selected' : '') + '>' + esc(P.TRIMS[k].label) + '</option>';
    }).join('');
    renderLengths();
    $('#kidsAgeField').hidden = !P.isKids(project);
    renderPlan();
  }

  function renderLengths() {
    var kids = P.isKids(project);
    var list = kids ? [16, 24, 32, 40, 50] : [100, 150, 200, 250, 300, 350, 450];
    var tags = { 32: 'קלאסי', 200: 'רומן', 350: 'רומן גדול', 100: 'נובלה', 24: 'פעוטות' };
    $('#lengthChips').innerHTML = list.map(function (n) {
      return '<button type="button" class="chip" data-pages="' + n + '" aria-pressed="' + (+project.targetPages === n) + '">' + n + ' עמודים' + (tags[n] ? '<small>' + tags[n] + '</small>' : '') + '</button>';
    }).join('');
    $('#f-targetPages').value = project.targetPages;
  }

  function sourceWords() {
    return (project.sections || []).reduce(function (s, x) { return s + P.wordsCount(x.text); }, 0);
  }

  function renderPlan() {
    if (!project) return;
    var pl = P.plan(project);
    var have = sourceWords();
    var g = P.GENRES[project.genre] || {};
    var html = pl.kids
      ? 'ספר ילדים של <strong>' + project.targetPages + ' עמודים</strong>: כ-<strong>' + pl.chapters + ' עמודים מאוירים</strong>, כל אחד עם איור ו-' + pl.wordsPerChapter + ' מילים לערך.'
      : 'ספר של <strong>' + project.targetPages + ' עמודים</strong> מכיל כ-<strong>' + num(pl.totalWords) + ' מילים</strong>, בערך <strong>' + pl.chapters + ' פרקים</strong> של ' + num(pl.wordsPerChapter) + ' מילים.';
    html += '<br>כתבתם עד עכשיו <strong>' + num(have) + ' מילים</strong> של חומר גלם.';
    if (!pl.kids && g.factual && have > 0 && pl.totalWords / have > 6) {
      html += '<br>כדי שהספר יהיה עשיר ונאמן לחיים שלכם, בלי מילוי, כדאי להוסיף עוד זיכרונות: אנשים, מקומות, ריחות, שיחות, רגעי מפנה. Claude לא ממציא עובדות בספר אמיתי.';
    }
    $('#planBox').innerHTML = html;
  }

  function bindDetails() {
    var f = $('#detailsForm');
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    f.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.name) return;
      if (t.name === 'targetPages') {
        var n = parseInt(t.value, 10);
        if (n >= 8 && n <= 900) { project.targetPages = n; renderLengthsPressed(); }
      } else if (t.name === 'genre') {
        setGenre(t.value);
      } else if (t.type !== 'radio' || t.checked) {
        project[t.name] = t.value;
      }
      if (t.name === 'title') updateTitle();
      renderPlan();
      save();
    });
    $('#lengthChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pages]');
      if (!b) return;
      project.targetPages = +b.dataset.pages;
      $('#f-targetPages').value = project.targetPages;
      renderLengthsPressed();
      renderPlan();
      save();
    });
  }
  function renderLengthsPressed() {
    $$('#lengthChips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(+c.dataset.pages === +project.targetPages)); });
  }
  function setGenre(g) {
    var wasKids = P.isKids(project);
    project.genre = g;
    var kids = P.isKids(project);
    if (kids && !wasKids) {
      project.trim = 'kidsq';
      if (project.targetPages > 60) project.targetPages = 32;
    } else if (!kids && wasKids) {
      project.trim = 'a5';
      if (project.targetPages < 80) project.targetPages = 200;
    }
    $('#f-trim').value = project.trim;
    $('#kidsAgeField').hidden = !kids;
    renderLengths();
  }
  function updateTitle() {
    document.title = (project.title ? project.title + ' · ' : '') + 'ספר — סטודיו לכתיבת ספרים';
  }

  /* ================= שלב 2: הסיפור ================= */
  var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognizer = null;

  function renderSections() {
    var box = $('#sections');
    if (!project.sections.length) project.sections.push({ id: uid(), title: '', text: '' });
    box.innerHTML = project.sections.map(function (s, i) {
      var n = i + 1;
      return '<article class="card section-card" data-id="' + s.id + '">' +
        '<div class="section-head">' +
        '<label class="visually-hidden" for="st-' + s.id + '">כותרת קטע ' + n + '</label>' +
        '<input type="text" id="st-' + s.id + '" data-f="title" value="' + esc(s.title) + '" placeholder="קטע ' + n + ' — למשל: הילדות בקריית שמונה">' +
        (Speech ? '<button type="button" class="btn small ghost mic" data-act="mic" aria-pressed="false">🎙 הקלטה</button>' : '') +
        '<button type="button" class="btn small ghost" data-act="up" aria-label="הזזת קטע ' + n + ' למעלה"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="btn small ghost" data-act="down" aria-label="הזזת קטע ' + n + ' למטה"' + (i === project.sections.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn small danger" data-act="del" aria-label="מחיקת קטע ' + n + '">מחיקה</button>' +
        '</div>' +
        '<label class="visually-hidden" for="sx-' + s.id + '">הטקסט של קטע ' + n + '</label>' +
        '<textarea id="sx-' + s.id + '" data-f="text" placeholder="מה קרה? מתי ואיפה? מי היה שם? מה הרגשתם, ומה זה עשה לכם אחר כך?">' + esc(s.text) + '</textarea>' +
        '<div class="section-foot"><span data-count>' + num(P.wordsCount(s.text)) + ' מילים</span><span>אין הגבלה על אורך הטקסט</span></div>' +
        '</article>';
    }).join('');
    renderStoryMeter();
  }
  function renderStoryMeter() {
    var total = sourceWords();
    $('#storyMeter').innerHTML = 'סה״כ <strong>' + num(total) + '</strong> מילים ב-' + project.sections.length + ' קטעים';
  }
  function bindStory() {
    var box = $('#sections');
    box.addEventListener('input', function (e) {
      var card = e.target.closest('.section-card');
      if (!card) return;
      var s = project.sections.find(function (x) { return x.id === card.dataset.id; });
      s[e.target.dataset.f] = e.target.value;
      if (e.target.dataset.f === 'text') {
        $('[data-count]', card).textContent = num(P.wordsCount(s.text)) + ' מילים';
        renderStoryMeter();
      }
      save();
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var card = b.closest('.section-card');
      var i = project.sections.findIndex(function (x) { return x.id === card.dataset.id; });
      var act = b.dataset.act;
      if (act === 'mic') return toggleMic(b, $('textarea', card), project.sections[i]);
      if (act === 'del') {
        if (project.sections[i].text.trim() && !confirm('למחוק את הקטע? לא ניתן לשחזר.')) return;
        project.sections.splice(i, 1);
      }
      if (act === 'up' && i > 0) project.sections.splice(i - 1, 0, project.sections.splice(i, 1)[0]);
      if (act === 'down' && i < project.sections.length - 1) project.sections.splice(i + 1, 0, project.sections.splice(i, 1)[0]);
      renderSections();
      save();
    });
    $('#addSection').addEventListener('click', function () {
      var s = { id: uid(), title: '', text: '' };
      project.sections.push(s);
      renderSections();
      save();
      $('#st-' + s.id).focus();
    });
    $('#importText').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      Promise.all(files.map(function (f) { return f.text().then(function (t) { return { name: f.name.replace(/\.[^.]+$/, ''), text: t }; }); }))
        .then(function (list) {
          project.sections = project.sections.filter(function (s) { return s.text.trim() || s.title.trim(); });
          list.forEach(function (x) { project.sections.push({ id: uid(), title: x.name, text: x.text }); });
          renderSections();
          save();
          toast('יובאו ' + list.length + ' קבצים');
        });
      e.target.value = '';
    });
  }
  function toggleMic(btn, textarea, section) {
    if (recognizer) {
      recognizer.stop();
      return;
    }
    recognizer = new Speech();
    recognizer.lang = 'he-IL';
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.onresult = function (ev) {
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          var t = ev.results[i][0].transcript.trim();
          textarea.value = (textarea.value ? textarea.value.replace(/\s*$/, ' ') : '') + t;
          section.text = textarea.value;
        }
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    };
    recognizer.onend = function () { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '🎙 הקלטה'; recognizer = null; };
    recognizer.onerror = function () { toast('ההקלטה נעצרה. בדקו שהדפדפן קיבל הרשאה למיקרופון.', true); };
    recognizer.start();
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = '■ עצירת הקלטה';
    toast('מקליט… דברו בחופשיות');
  }

  /* ================= שלב 3: תמונות ================= */
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  /* מקטין תמונות גדולות לאיכות הדפסה (עד 2400 פיקסל) כדי לחסוך מקום. */
  function prepareImage(file) {
    return readFile(file).then(function (src) {
      if (/svg/.test(file.type)) return loadImg(src).then(function (im) { return { src: src, w: im.naturalWidth || 1200, h: im.naturalHeight || 900 }; });
      return loadImg(src).then(function (im) {
        var max = 2400;
        var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        if (k === 1 && file.size < 3e6) return { src: src, w: im.naturalWidth, h: im.naturalHeight };
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k);
        c.height = Math.round(im.naturalHeight * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        return { src: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height };
      });
    });
  }
  function addImageData(data, meta) {
    var id = uid();
    var rec = { id: id, src: data.src, w: data.w, h: data.h };
    imageCache[id] = rec;
    project.images.push(Object.assign({ id: id, name: '', caption: '', place: { type: 'none' } }, meta || {}));
    save();
    return S.saveImage(rec).then(function () { return id; });
  }
  function addFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    toast('מעלה ' + files.length + ' תמונות…');
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return prepareImage(f).then(function (d) { return addImageData(d, { name: f.name }); });
      });
    }, Promise.resolve()).then(function () {
      renderImages();
      toast('התמונות נוספו. בחרו לכל אחת איפה היא תופיע בספר.');
    }).catch(function () { toast('לא הצלחנו לקרוא אחת התמונות.', true); });
  }

  function getImage(id) {
    if (imageCache[id]) return Promise.resolve(imageCache[id]);
    return S.getImage(id).then(function (r) { if (r) imageCache[id] = r; return r; });
  }

  function placeOptions(img) {
    var pl = img.place || { type: 'none' };
    var val = pl.type === 'chapter' ? 'ch:' + pl.chapterId : pl.type;
    var opts = [['none', 'לא משולבת בספר'], ['cover', 'כריכה קדמית']];
    project.chapters.forEach(function (c, i) { opts.push(['ch:' + c.id, (P.isKids(project) ? 'עמוד ' : 'פרק ') + (i + 1) + ': ' + (c.title || '')]); });
    return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function renderImages() {
    var grid = $('#imageGrid');
    if (!project.images.length) {
      grid.innerHTML = '<p class="empty-state">עוד לא נוספו תמונות. הספר ייראה מצוין גם בלעדיהן, אבל תמונה אחת טובה בכל פרק מוסיפה המון.</p>';
      return;
    }
    grid.innerHTML = project.images.map(function (img, i) {
      var pos = (img.place && img.place.position) || 'start';
      var isCh = img.place && img.place.type === 'chapter';
      return '<article class="card img-card" data-id="' + img.id + '">' +
        '<div class="thumb"><img alt="' + esc(img.caption || img.name || 'תמונה ' + (i + 1)) + '" data-src="' + img.id + '"></div>' +
        '<label for="cap-' + img.id + '">כיתוב (מוקרא גם לקוראי מסך)</label>' +
        '<input type="text" id="cap-' + img.id + '" data-f="caption" value="' + esc(img.caption) + '" placeholder="למשל: אבא ואני בנמל חיפה, 1974">' +
        '<label for="pl-' + img.id + '">איפה בספר?</label>' +
        '<select id="pl-' + img.id + '" data-f="place">' + placeOptions(img) + '</select>' +
        '<label for="ps-' + img.id + '">מיקום בפרק</label>' +
        '<select id="ps-' + img.id + '" data-f="position"' + (isCh ? '' : ' disabled') + '>' +
        '<option value="start"' + (pos === 'start' ? ' selected' : '') + '>בפתיחת הפרק</option>' +
        '<option value="end"' + (pos === 'end' ? ' selected' : '') + '>בסוף הפרק</option>' +
        '<option value="full"' + (pos === 'full' ? ' selected' : '') + '>עמוד מלא אחרי הפרק</option></select>' +
        '<div class="row"><button type="button" class="btn small danger" data-act="del">מחיקה</button></div>' +
        '</article>';
    }).join('') + (project.chapters.length ? '' : '<p class="hint">כדי לשבץ תמונות בפרקים, בונים קודם את מבנה הספר בשלב 4.</p>');
    $$('img[data-src]', grid).forEach(function (im) {
      getImage(im.dataset.src).then(function (r) { if (r) im.src = r.src; });
    });
  }

  function bindImages() {
    var drop = $('#dropZone');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
    $('#imageInput').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });

    var grid = $('#imageGrid');
    grid.addEventListener('input', function (e) {
      var card = e.target.closest('.img-card');
      if (!card || e.target.dataset.f !== 'caption') return;
      var img = project.images.find(function (x) { return x.id === card.dataset.id; });
      img.caption = e.target.value;
      $('.thumb img', card).alt = img.caption;
      save();
    });
    grid.addEventListener('change', function (e) {
      var card = e.target.closest('.img-card');
      if (!card) return;
      var img = project.images.find(function (x) { return x.id === card.dataset.id; });
      var f = e.target.dataset.f;
      if (f === 'place') {
        var v = e.target.value;
        if (v.indexOf('ch:') === 0) img.place = { type: 'chapter', chapterId: v.slice(3), position: (img.place && img.place.position) || 'start' };
        else img.place = { type: v };
        if (v === 'cover') project.images.forEach(function (o) { if (o !== img && o.place && o.place.type === 'cover') o.place = { type: 'none' }; });
        renderImages();
        $('#pl-' + img.id).focus();
      }
      if (f === 'position') img.place.position = e.target.value;
      save();
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="del"]');
      if (!b) return;
      var id = b.closest('.img-card').dataset.id;
      if (!confirm('למחוק את התמונה מהספר?')) return;
      project.images = project.images.filter(function (x) { return x.id !== id; });
      delete imageCache[id];
      S.deleteImage(id);
      save();
      renderImages();
    });

    $('#illusForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var desc = $('#illusDesc').value.trim();
      if (!desc) return;
      var btn = $('#illusForm button');
      btn.disabled = true;
      btn.textContent = 'מצייר…';
      illustrate(desc, { name: 'איור: ' + desc.slice(0, 40), caption: '' })
        .then(function (ok) { if (ok) { $('#illusDesc').value = ''; renderImages(); } })
        .finally(function () { btn.disabled = false; btn.textContent = 'צייר איור'; });
    });
  }

  function extractSvg(text) {
    var m = String(text || '').match(/<svg[\s\S]*<\/svg>/i);
    if (!m) return null;
    // האיור מוצג בתוך <img>, כך שסקריפטים לא רצים; בכל זאת מנקים.
    var svg = m[0].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return svg;
  }

  function illustrate(description, meta) {
    return runAI('illustration', { description: description }, null, { label: 'איור' }).then(function (res) {
      if (!res) return false;
      var svg = extractSvg(res.text);
      if (!svg) { toast('לא התקבל איור תקין. נסו שוב או נסחו אחרת.', true); return false; }
      var vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
      var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return addImageData({ src: src, w: vb ? +vb[1] : 1200, h: vb ? +vb[2] : 900 }, meta).then(function () {
        toast('האיור נוסף לספר');
        return true;
      });
    });
  }

  /* ================= חיבור ל-Claude ================= */
  function checkServer() {
    var badge = $('#aiBadge');
    if (location.protocol === 'file:') return setManual();
    var ctl = new AbortController();
    setTimeout(function () { ctl.abort(); }, 4000);
    fetch('api/status', { signal: ctl.signal, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (s && s.ai) {
          ai.mode = 'server';
          ai.needCode = s.needCode;
          ai.code = sessionStorageGet('bs-code') || '';
          badge.textContent = 'מחובר ל-Claude';
          badge.className = 'ai-badge on';
          badge.title = 'הכתיבה מתבצעת אוטומטית דרך השרת';
        } else setManual();
      })
      .catch(setManual);
    function setManual() {
      ai.mode = 'manual';
      badge.textContent = 'מצב העתק-הדבק';
      badge.className = 'ai-badge manual';
      badge.title = 'אין שרת AI מחובר. כל פעולת כתיבה תפתח הנחיה מוכנה להדבקה ב-Claude.ai';
    }
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* לא חובה */ } }

  function askCode() {
    return new Promise(function (resolve) {
      var d = $('#codeDialog');
      $('#codeInput').value = '';
      d.returnValue = '';
      d.showModal();
      d.addEventListener('close', function once() {
        d.removeEventListener('close', once);
        if (d.returnValue === 'ok' && $('#codeInput').value) {
          ai.code = $('#codeInput').value;
          sessionStorageSet('bs-code', ai.code);
          resolve(true);
        } else resolve(false);
      });
    });
  }

  function manualRun(task, extra, opts) {
    var spec = P.build(task, project, extra);
    var d = $('#manualDialog');
    $('#manualTitle').textContent = 'כתיבה בעזרת Claude — ' + (opts.label || '');
    $('#manualPrompt').value = P.manualText(spec);
    $('#manualResult').value = '';
    $('#manualHint').textContent = task === 'outline' ? 'Claude יחזיר מבנה בפורמט JSON. מדביקים אותו כמו שהוא.'
      : task === 'illustration' ? 'Claude יחזיר קוד SVG. מדביקים את כל הקוד.'
        : 'מדביקים רק את טקסט הפרק.';
    d.returnValue = '';
    d.showModal();
    return new Promise(function (resolve) {
      d.addEventListener('close', function once() {
        d.removeEventListener('close', once);
        var v = $('#manualResult').value.trim();
        resolve(d.returnValue === 'apply' && v ? { text: v, stop: 'manual' } : null);
      });
    });
  }

  /* מריץ משימת AI. onText מקבל את הטקסט המצטבר בזמן אמת. */
  function runAI(task, extra, onText, opts) {
    opts = opts || {};
    if (ai.mode !== 'server') return manualRun(task, extra, opts);
    var ctl = new AbortController();
    busy = ctl;
    setBusy(true);
    var headers = { 'content-type': 'application/json' };
    if (ai.code) headers['x-access-code'] = ai.code;
    var text = '';
    return fetch('api/run', { method: 'POST', headers: headers, body: JSON.stringify({ task: task, project: project, extra: extra }), signal: ctl.signal })
      .then(function (r) {
        if (r.status === 401) {
          return r.json().then(function () {
            return askCode().then(function (ok) {
              busy = null; setBusy(false);
              return ok ? runAI(task, extra, onText, opts) : null;
            });
          });
        }
        if (!r.ok || !r.body) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'השרת לא זמין (' + r.status + ')'); });
        var reader = r.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        var result = { text: '', stop: null };
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) { result.text = text; return result; }
            buf += dec.decode(chunk.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (line) {
              if (!line.trim()) return;
              var m = JSON.parse(line);
              if (m.t) { text += m.t; if (onText) onText(text); }
              if (m.error) throw new Error(m.error);
              if (m.done) result.stop = m.stop;
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function (res) {
        if (res && res.stop === 'refusal') throw new Error('Claude סירב לכתוב את הקטע הזה. נסו לנסח את החומר או את ההערה אחרת.');
        return res;
      })
      .catch(function (err) {
        if (err.name === 'AbortError') { toast('הכתיבה נעצרה'); return text ? { text: text, stop: 'aborted' } : null; }
        toast(err.message || 'שגיאה בחיבור ל-Claude', true);
        return null;
      })
      .finally(function () { if (busy === ctl) { busy = null; setBusy(false); } });
  }

  function setBusy(on) {
    $('#stopBtn').hidden = !on;
    $('#outlineBtn').disabled = on;
    $('#writeAllBtn').disabled = on;
  }

  /* ================= שלב 4: כתיבה ================= */
  function chapterStatus(c) {
    if (c._busy) return '<span class="status busy">כותב…</span>';
    var w = P.wordsCount(c.text);
    if (!w) return '<span class="status">ממתין</span>';
    return '<span class="status done">' + num(w) + ' מילים</span>';
  }

  function renderChapters() {
    var box = $('#chapters');
    $('#blurb').value = project.blurb || '';
    var kids = P.isKids(project);
    $('#outlineBtn').textContent = '1. בניית מבנה הספר';
    $('#writeAllBtn').textContent = kids ? '2. כתיבת כל העמודים' : '2. כתיבת כל הפרקים';
    if (!project.chapters.length) {
      box.innerHTML = '<p class="empty-state">עוד אין פרקים. לחצו ״בניית מבנה הספר״ ו-Claude יציע חלוקה לפרקים לפי הסיפור שלכם והאורך שבחרתם. אפשר גם להוסיף פרקים ידנית.</p>';
      renderWriteMeter();
      return;
    }
    var open = $$('.chapter[open]', box).map(function (d) { return d.dataset.ch; });
    box.innerHTML = project.chapters.map(function (c, i) {
      var unit = kids ? 'עמוד' : 'פרק';
      return '<details class="card chapter" data-ch="' + c.id + '"' + (open.indexOf(c.id) >= 0 ? ' open' : '') + '>' +
        '<summary><span class="ch-idx">' + (i + 1) + '</span><span class="ch-name">' + esc(c.title || unit + ' ללא שם') + '</span>' + chapterStatus(c) + '</summary>' +
        '<div class="chapter-body">' +
        '<div class="two"><div class="field"><label for="ct-' + c.id + '">שם ה' + unit + '</label><input type="text" id="ct-' + c.id + '" data-f="title" value="' + esc(c.title) + '"></div>' +
        '<div class="field"><label for="cw-' + c.id + '">אורך יעד (מילים)</label><input type="number" min="20" step="50" id="cw-' + c.id + '" data-f="targetWords" value="' + (c.targetWords || '') + '"></div></div>' +
        '<div class="field"><label for="cs-' + c.id + '">על מה ה' + unit + '</label><textarea rows="3" id="cs-' + c.id + '" data-f="summary">' + esc(c.summary) + '</textarea></div>' +
        '<div class="field"><label for="ci-' + c.id + '">רעיון לאיור</label><textarea rows="2" id="ci-' + c.id + '" data-f="illustrationIdea">' + esc(c.illustrationIdea) + '</textarea></div>' +
        '<div class="field"><label for="cx-' + c.id + '">טקסט ה' + unit + ' (אפשר לערוך חופשי)</label><textarea class="chapter-text" id="cx-' + c.id + '" data-f="text">' + esc(c.text) + '</textarea></div>' +
        '<div class="actions">' +
        '<button type="button" class="btn primary small" data-act="write">' + (c.text ? 'כתיבה מחדש' : 'כתיבת ה' + unit) + '</button>' +
        (c.text ? '<button type="button" class="btn small" data-act="continue">המשך כתיבה</button><button type="button" class="btn small" data-act="rewrite">שכתוב לפי הערה</button>' : '') +
        '<button type="button" class="btn small ghost" data-act="illus">ציור איור ל' + unit + '</button>' +
        '<button type="button" class="btn small ghost" data-act="up" aria-label="הזזה למעלה"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="btn small ghost" data-act="down" aria-label="הזזה למטה"' + (i === project.chapters.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn small danger" data-act="del">מחיקה</button>' +
        '</div></div></details>';
    }).join('');
    renderWriteMeter();
  }

  function renderWriteMeter() {
    var total = project.chapters.reduce(function (s, c) { return s + P.wordsCount(c.text); }, 0);
    var done = project.chapters.filter(function (c) { return P.wordsCount(c.text) > 0; }).length;
    var target = P.plan(project).totalWords;
    $('#writeMeter').innerHTML = project.chapters.length
      ? 'נכתבו <strong>' + done + '/' + project.chapters.length + '</strong> · <strong>' + num(total) + '</strong> מתוך כ-' + num(target) + ' מילים'
      : '';
  }

  function refreshChapterHead(c) {
    var d = $('.chapter[data-ch="' + c.id + '"]');
    if (!d) return;
    var st = $('summary .status', d);
    if (st) st.outerHTML = chapterStatus(c);
    $('.ch-name', d).textContent = c.title || 'ללא שם';
  }

  function parseOutline(text) {
    var t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < 0) throw new Error('no json');
    return JSON.parse(t.slice(a, b + 1));
  }

  function buildOutline() {
    if (!sourceWords() && !confirm('עוד לא כתבתם חומר גלם בשלב 2. לבנות מבנה רק לפי פרטי הספר?')) return;
    if (project.chapters.some(function (c) { return c.text; }) && !confirm('בניית מבנה חדש תחליף את הפרקים הקיימים וגם את מה שכבר נכתב בהם. להמשיך?')) return;
    showProgress('בונה את מבנה הספר…', 0.1);
    runAI('outline', {}, function (t) { showProgress('בונה את מבנה הספר… (' + num(t.length) + ' תווים)', 0.5); }, { label: 'מבנה הספר' })
      .then(function (res) {
        hideProgress();
        if (!res) return;
        var o;
        try { o = parseOutline(res.text); } catch (e) { toast('התשובה לא הייתה במבנה הנכון. נסו שוב.', true); return; }
        project.chapters = (o.chapters || []).map(function (c) {
          return { id: uid(), title: c.title || '', summary: c.summary || '', targetWords: +c.target_words || 0, sourceNotes: c.source_notes || '', illustrationIdea: c.illustration_idea || '', text: '' };
        });
        if (o.blurb) project.blurb = o.blurb;
        if (!project.title && o.title_suggestion) {
          project.title = o.title_suggestion;
          $('#f-title').value = project.title;
          updateTitle();
          toast('Claude הציע לספר את השם: ״' + project.title + '״. אפשר לשנות בשלב 1.');
        } else if (o.title_suggestion) {
          toast('המבנה מוכן: ' + project.chapters.length + ' ' + (P.isKids(project) ? 'עמודים' : 'פרקים') + '. הצעה לשם: ״' + o.title_suggestion + '״');
        }
        project.images.forEach(function (img) { if (img.place && img.place.type === 'chapter') img.place = { type: 'none' }; });
        save();
        renderChapters();
      });
  }

  function writeChapter(index, mode, note) {
    var c = project.chapters[index];
    var before = c.text;
    var ta = function () { return $('#cx-' + c.id); };
    c._busy = true;
    refreshChapterHead(c);
    var base = mode === 'continue' ? before.replace(/\s*$/, '\n\n') : '';
    var pending = false;
    return runAI('chapter', { index: index, mode: mode, note: note }, function (t) {
      c.text = base + t;
      if (!pending) {
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          var el = ta();
          if (el) { el.value = c.text; el.scrollTop = el.scrollHeight; }
        });
      }
    }, { label: (P.isKids(project) ? 'עמוד ' : 'פרק ') + (index + 1) }).then(function (res) {
      c._busy = false;
      if (!res) { c.text = before; }
      else {
        c.text = (base + res.text).replace(/\*\*/g, '').trim();
        if (res.stop === 'max_tokens') toast('הפרק ארוך במיוחד ונקטע. לחצו ״המשך כתיבה״ כדי להשלים אותו.');
      }
      delete c._busy;
      var el = ta();
      if (el) el.value = c.text;
      refreshChapterHead(c);
      renderWriteMeter();
      save();
      return !!res;
    });
  }

  function writeAll() {
    if (!project.chapters.length) { toast('קודם בונים את מבנה הספר.'); return; }
    var todo = project.chapters.map(function (c, i) { return i; }).filter(function (i) { return !P.wordsCount(project.chapters[i].text); });
    if (!todo.length) { toast('כל הפרקים כבר כתובים. אפשר לכתוב פרק מחדש מתוך הכרטיס שלו.'); return; }
    stopAll = false;
    var done = 0;
    var kids = P.isKids(project);
    var next = function () {
      if (stopAll || !todo.length) {
        hideProgress();
        renderChapters();
        if (!stopAll) toast('הכתיבה הסתיימה! עברו ל״הספר המוכן״ לראות את התוצאה.');
        return;
      }
      var i = todo.shift();
      showProgress('כותב ' + (kids ? 'עמוד ' : 'פרק ') + (i + 1) + ' מתוך ' + project.chapters.length + ': ' + (project.chapters[i].title || ''), done / (done + todo.length + 1));
      var d = $('.chapter[data-ch="' + project.chapters[i].id + '"]');
      if (d && !d.open) d.open = true;
      writeChapter(i, 'new').then(function (ok) {
        if (d) d.open = false;
        if (!ok) stopAll = true;
        done++;
        next();
      });
    };
    renderChapters();
    next();
  }

  function showProgress(text, frac) {
    $('#progress').hidden = false;
    $('#progressText').textContent = text;
    $('#progressBar').style.width = Math.round(Math.max(0.03, frac) * 100) + '%';
  }
  function hideProgress() { $('#progress').hidden = true; }

  function askNote() {
    return new Promise(function (resolve) {
      var d = $('#noteDialog');
      $('#noteText').value = '';
      d.returnValue = '';
      d.showModal();
      d.addEventListener('close', function once() {
        d.removeEventListener('close', once);
        resolve(d.returnValue === 'ok' ? ($('#noteText').value.trim() || 'שפר את הניסוח ואת הזרימה') : null);
      });
    });
  }

  function bindWrite() {
    $('#outlineBtn').addEventListener('click', buildOutline);
    $('#writeAllBtn').addEventListener('click', writeAll);
    $('#stopBtn').addEventListener('click', function () { stopAll = true; if (busy) busy.abort(); });
    $('#blurb').addEventListener('input', function (e) { project.blurb = e.target.value; save(); });
    $('#addChapter').addEventListener('click', function () {
      var c = { id: uid(), title: '', summary: '', targetWords: P.plan(project).wordsPerChapter, sourceNotes: '', illustrationIdea: '', text: '' };
      project.chapters.push(c);
      save();
      renderChapters();
      var d = $('.chapter[data-ch="' + c.id + '"]');
      d.open = true;
      $('#ct-' + c.id).focus();
    });
    var box = $('#chapters');
    box.addEventListener('input', function (e) {
      var d = e.target.closest('.chapter');
      if (!d || !e.target.dataset.f) return;
      var c = project.chapters.find(function (x) { return x.id === d.dataset.ch; });
      var f = e.target.dataset.f;
      c[f] = f === 'targetWords' ? (parseInt(e.target.value, 10) || 0) : e.target.value;
      if (f === 'title' || f === 'text') { refreshChapterHead(c); renderWriteMeter(); }
      save();
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var d = b.closest('.chapter');
      var i = project.chapters.findIndex(function (x) { return x.id === d.dataset.ch; });
      var c = project.chapters[i];
      var act = b.dataset.act;
      if (busy && ['write', 'continue', 'rewrite', 'illus'].indexOf(act) >= 0) { toast('Claude עדיין עובד על משימה קודמת.'); return; }
      if (act === 'write') {
        if (c.text && !confirm('לכתוב את הפרק מחדש? הטקסט הקיים יוחלף.')) return;
        writeChapter(i, 'new').then(renderChapters);
      } else if (act === 'continue') {
        writeChapter(i, 'continue');
      } else if (act === 'rewrite') {
        askNote().then(function (note) { if (note) writeChapter(i, 'rewrite', note); });
      } else if (act === 'illus') {
        var desc = (c.illustrationIdea || c.summary || c.title || '').trim();
        if (!desc) { toast('כתבו קודם ״רעיון לאיור״ לפרק.'); $('#ci-' + c.id).focus(); return; }
        b.disabled = true; b.textContent = 'מצייר…';
        illustrate(desc, { name: 'איור: ' + (c.title || ''), caption: '', place: { type: 'chapter', chapterId: c.id, position: 'start' } })
          .finally(function () { b.disabled = false; b.textContent = 'ציור איור'; });
      } else if (act === 'del') {
        if (!confirm('למחוק את ה' + (P.isKids(project) ? 'עמוד' : 'פרק') + ' ״' + (c.title || '') + '״?')) return;
        project.chapters.splice(i, 1);
        project.images.forEach(function (img) { if (img.place && img.place.chapterId === c.id) img.place = { type: 'none' }; });
        save(); renderChapters();
      } else if (act === 'up' && i > 0) {
        project.chapters.splice(i - 1, 0, project.chapters.splice(i, 1)[0]); save(); renderChapters();
      } else if (act === 'down' && i < project.chapters.length - 1) {
        project.chapters.splice(i + 1, 0, project.chapters.splice(i, 1)[0]); save(); renderChapters();
      }
    });
  }

  /* ================= שלב 5: הספר ================= */
  var view = ls('bs-view') || 'spread';

  function loadAllImages() {
    return Promise.all((project.images || []).map(function (m) { return getImage(m.id); })).then(function () {
      var map = {};
      project.images.forEach(function (m) { if (imageCache[m.id]) map[m.id] = imageCache[m.id]; });
      return map;
    });
  }

  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    var t = 'אבג';
    return Promise.all([
      '16px "Frank Ruhl Libre"', '700 16px "Frank Ruhl Libre"', '900 16px "Frank Ruhl Libre"',
      '16px "Bellefair"', '16px "David Libre"', '700 16px "David Libre"',
      '300 16px "Noto Serif Hebrew"', '400 16px "Noto Serif Hebrew"', '600 16px "Noto Serif Hebrew"',
      '16px "Noto Rashi Hebrew"', '16px "Varela Round"', '16px "Suez One"'
    ].map(function (f) { return document.fonts.load(f, t); })).catch(function () {}).then(function () { return document.fonts.ready; });
  }

  function layoutOnce(map) {
    var book = $('#book');
    var zoomEl = $('#bookZoom');
    var z = zoomEl.style.zoom;
    zoomEl.style.zoom = 1;
    var info = L.render(book, project, map);
    zoomEl.style.zoom = z;
    return info;
  }

  function finishLayout(info) {
    var book = $('#book');
    var firstNumbered = $('.page:not(.cover)', book);
    if (firstNumbered) {
      var sp = document.createElement('div');
      sp.className = 'page-spacer';
      sp.setAttribute('aria-hidden', 'true');
      book.insertBefore(sp, firstNumbered);
    }
    book.classList.toggle('single', view === 'single');
    var target = +project.targetPages;
    var diff = info.interior - target;
    var kids = P.isKids(project);
    $('#fitBtn').hidden = kids;
    var note = Math.abs(diff) <= Math.max(kids ? 1 : 4, target * 0.05) ? 'בדיוק ביעד'
      : diff < 0 ? 'חסרים כ-' + (-diff) + ' עמודים ליעד. ' + (kids ? 'אפשר להוסיף עמודים בשלב 4' : 'אפשר להגדיל את האות, להוסיף תמונות או להמשיך לכתוב')
        : 'כ-' + diff + ' עמודים מעל היעד. ' + (kids ? 'אפשר לאחד או למחוק עמודים בשלב 4' : 'אפשר להקטין מעט את האות');
    fitSmallScreen();
    $('#bookStats').innerHTML = '<strong>' + info.interior + '</strong> עמודים פנימיים + כריכה · יעד: ' + target + ' · ' + note;
    bookDirty = false;
  }

  /* בטלפון: עמוד בודד, מוקטן לרוחב המסך (אלא אם המשתמש כבר בחר הגדלה). */
  function fitSmallScreen() {
    if (window.innerWidth > 720 || ls('bs-zoom')) return;
    var book = $('#book');
    var pageW = $('.page', book);
    if (!pageW) return;
    view = 'single';
    book.classList.add('single');
    $$('.book-tools [data-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.view === 'single')); });
    var avail = $('#bookStage').clientWidth - 8;
    var z = Math.max(0.3, Math.min(1, avail / (pageW.offsetWidth + 40)));
    $('#bookZoom').style.zoom = z;
    $('#zoom').value = z;
  }

  /* בחירת סגנון העיצוב: כרטיסים קטנים שמראים את הכריכה והאות של כל סגנון */
  function renderThemePicker() {
    var kids = P.isKids(project);
    $('.theme-picker').hidden = kids;
    if (kids) return;
    var cur = L.THEMES[project.bookTheme] ? project.bookTheme : 'royal';
    $('#themePicker').innerHTML = Object.keys(L.THEMES).map(function (k) {
      var t = L.THEMES[k];
      return '<label class="theme-opt t-' + k + '"><input type="radio" name="bookTheme" value="' + k + '"' + (k === cur ? ' checked' : '') + '>' +
        '<span class="swatch" aria-hidden="true"><span class="sw-letter">א</span></span>' +
        '<span class="theme-text"><strong>' + esc(t.label) + '</strong><span>' + esc(t.hint) + '</span></span></label>';
    }).join('');
  }

  function renderBook(force) {
    renderThemePicker();
    if (!bookDirty && !force) return Promise.resolve();
    $('#bookStats').textContent = 'מעמד את הספר…';
    $('#fontScale').value = project.fontScale || 1;
    $('#fontScaleOut').textContent = Math.round((project.fontScale || 1) * 100) + '%';
    return Promise.all([fontsReady(), loadAllImages()]).then(function (r) {
      var map = r[1];
      var imgs = Object.keys(map).map(function (k) { return map[k]; });
      // תמונות חייבות להיטען לפני העימוד
      return Promise.all(imgs.map(function (m) { return loadImg(m.src).catch(function () {}); })).then(function () {
        finishLayout(layoutOnce(map));
      });
    });
  }

  function fitToTarget() {
    var btn = $('#fitBtn');
    btn.disabled = true;
    $('#bookStats').textContent = 'מתאים את גודל האות ליעד העמודים…';
    Promise.all([fontsReady(), loadAllImages()]).then(function (r) {
      var map = r[1];
      var target = +project.targetPages;
      var lo = 0.8, hi = 1.3, best = project.fontScale || 1, bestDiff = Infinity;
      var steps = 0;
      function step() {
        if (steps++ >= 7) {
          project.fontScale = +best.toFixed(3);
          finishLayout(layoutOnce(map));
          $('#fontScale').value = project.fontScale;
          $('#fontScaleOut').textContent = Math.round(project.fontScale * 100) + '%';
          save();
          btn.disabled = false;
          if (bestDiff > Math.max(4, target * 0.05)) toast('גם בגודל אות קיצוני הספר לא מגיע ליעד. כדאי להוסיף או לקצר טקסט.');
          else toast('הספר הותאם ל-' + target + ' עמודים');
          return;
        }
        var mid = (lo + hi) / 2;
        project.fontScale = mid;
        var n = layoutOnce(map).interior;
        if (Math.abs(n - target) < bestDiff) { bestDiff = Math.abs(n - target); best = mid; }
        if (n < target) lo = mid; else hi = mid;
        setTimeout(step, 0);
      }
      step();
    });
  }

  function download(name, mime, content) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function fileBase() { return (project.title || 'הספר שלי').replace(/[\\/:*?"<>|]+/g, '').trim() || 'book'; }

  function exportText() {
    var out = [project.title, project.subtitle, project.author, ''];
    if (project.dedication) out.push(project.dedication, '');
    project.chapters.forEach(function (c, i) {
      out.push('', P.isKids(project) ? '' : L.chapterLabel(i), c.title || '', '', c.text || '');
    });
    download(fileBase() + '.txt', 'text/plain;charset=utf-8', '﻿' + out.join('\n'));
  }

  function exportDoc() {
    loadAllImages().then(function (map) {
      var byCh = {};
      project.images.forEach(function (m) {
        if (m.place && m.place.type === 'chapter' && map[m.id]) (byCh[m.place.chapterId] = byCh[m.place.chapterId] || []).push({ src: map[m.id].src, caption: m.caption });
      });
      var fig = function (im) { return '<p align="center"><img src="' + im.src + '" width="420" alt="' + esc(im.caption) + '"></p>' + (im.caption ? '<p class=cap>' + esc(im.caption) + '</p>' : ''); };
      var body = '<h1 class=title>' + esc(project.title) + '</h1>' + (project.subtitle ? '<p class=sub>' + esc(project.subtitle) + '</p>' : '') +
        '<p class=sub>' + esc(project.author) + '</p>' +
        (project.dedication ? '<br clear=all style="page-break-before:always"><p class=ded>' + esc(project.dedication) + '</p>' : '') +
        project.chapters.map(function (c, i) {
          return '<br clear=all style="page-break-before:always"><p class=num>' + (P.isKids(project) ? '' : L.chapterLabel(i)) + '</p><h2>' + esc(c.title) + '</h2>' +
            (byCh[c.id] || []).map(fig).join('') +
            L.paragraphs(c.text).map(function (t) { return L.isBreak(t) ? '<p class=brk>✦</p>' : '<p>' + esc(t) + '</p>'; }).join('');
        }).join('');
      var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(project.title) + '</title>' +
        '<style>body{font-family:"Frank Ruhl Libre","David",serif;font-size:12pt;direction:rtl}p{text-align:justify;line-height:1.6;margin:0 0 6pt}h1,h2{text-align:center;font-family:"Frank Ruhl Libre","David",serif}' +
        '.title{font-size:32pt;margin-top:120pt}.sub,.num,.ded,.cap,.brk{text-align:center}.num{color:#8b6d2f;letter-spacing:3pt}.cap{font-style:italic;font-size:10pt}</style></head><body dir="rtl">' + body + '</body></html>';
      download(fileBase() + '.doc', 'application/msword', '﻿' + html);
    });
  }

  function bindBook() {
    $$('.book-tools [data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
      b.addEventListener('click', function () {
        view = b.dataset.view;
        ls('bs-view', view);
        $$('.book-tools [data-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.view === view)); });
        $('#book').classList.toggle('single', view === 'single');
      });
    });
    var zoom = ls('bs-zoom') || 0.8;
    $('#zoom').value = zoom;
    $('#bookZoom').style.zoom = zoom;
    $('#zoom').addEventListener('input', function (e) { $('#bookZoom').style.zoom = e.target.value; ls('bs-zoom', +e.target.value); });
    var fsTimer;
    $('#fontScale').addEventListener('input', function (e) {
      project.fontScale = +e.target.value;
      $('#fontScaleOut').textContent = Math.round(project.fontScale * 100) + '%';
      clearTimeout(fsTimer);
      fsTimer = setTimeout(function () { save(); renderBook(true); }, 350);
    });
    $('#fitBtn').addEventListener('click', fitToTarget);
    $('#themePicker').addEventListener('change', function (e) {
      if (e.target.name !== 'bookTheme') return;
      project.bookTheme = e.target.value;
      save();
      renderBook(true);
      toast('סגנון העיצוב: ' + L.THEMES[project.bookTheme].label);
    });
    $('#printBtn').addEventListener('click', function () {
      renderBook().then(function () { window.print(); });
    });
    $('#txtBtn').addEventListener('click', exportText);
    $('#docBtn').addEventListener('click', exportDoc);
  }

  /* ================= ספרים, גיבוי ושחזור ================= */
  function renderProjects() {
    S.listProjects().then(function (list) {
      $('#projectList').innerHTML = list.map(function (p) {
        var words = (p.chapters || []).reduce(function (s, c) { return s + P.wordsCount(c.text); }, 0);
        return '<li class="' + (p.id === project.id ? 'current' : '') + '" data-id="' + p.id + '"><span class="pl-name">' + esc(p.title || 'ספר ללא שם') +
          '<span class="pl-meta">' + esc((P.GENRES[p.genre] || {}).label || '') + ' · ' + num(words) + ' מילים · ' + new Date(p.updatedAt || Date.now()).toLocaleDateString('he-IL') + '</span></span>' +
          (p.id === project.id ? '<span class="status done">פתוח</span>' : '<button type="button" class="btn small" data-act="open">פתיחה</button>') +
          '<button type="button" class="btn small danger" data-act="del" aria-label="מחיקת ' + esc(p.title || 'הספר') + '">מחיקה</button></li>';
      }).join('') || '<li>אין ספרים שמורים</li>';
    });
  }
  function openProject(p) {
    project = p;
    project.images = project.images || [];
    project.chapters = project.chapters || [];
    project.sections = project.sections || [];
    project.chapters.forEach(function (c) { delete c._busy; });
    imageCache = {};
    bookDirty = true;
    ls('bs-current', project.id);
    renderDetails();
    renderSections();
    updateTitle();
    route();
  }
  function bindProjects() {
    $('#projectsBtn').addEventListener('click', function () { renderProjects(); $('#projectsDialog').showModal(); });
    $('#newProject').addEventListener('click', function () {
      S.saveProject(project).then(function () {
        openProject(blankProject());
        save({ now: true });
        $('#projectsDialog').close();
        location.hash = 'details';
        toast('נפתח ספר חדש');
      });
    });
    $('#projectList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var id = b.closest('li').dataset.id;
      if (b.dataset.act === 'open') {
        S.saveProject(project).then(function () { return S.getProject(id); }).then(function (p) {
          if (p) { openProject(p); $('#projectsDialog').close(); toast('נפתח: ' + (p.title || 'ספר ללא שם')); }
        });
      } else if (b.dataset.act === 'del') {
        if (!confirm('למחוק את הספר לצמיתות? מומלץ לגבות לקובץ קודם.')) return;
        S.getProject(id).then(function (p) {
          (p && p.images || []).forEach(function (m) { S.deleteImage(m.id); });
          return S.deleteProject(id);
        }).then(function () {
          if (id === project.id) {
            return S.listProjects().then(function (list) { openProject(list[0] || blankProject()); save({ now: true }); });
          }
        }).then(renderProjects);
      }
    });

    $('#backupBtn').addEventListener('click', function () {
      loadAllImages().then(function (map) {
        var data = { format: 'book-studio', version: 1, project: project, images: map };
        download(fileBase() + ' - גיבוי.json', 'application/json', JSON.stringify(data));
        toast('הגיבוי ירד למחשב. שמרו אותו במקום בטוח.');
      });
    });
    $('#restoreInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      f.text().then(function (t) {
        var data = JSON.parse(t);
        if (data.format !== 'book-studio' || !data.project) throw new Error('bad');
        var imgs = data.images || {};
        return Promise.all(Object.keys(imgs).map(function (k) { return S.saveImage(imgs[k]); })).then(function () {
          return S.saveProject(project);
        }).then(function () {
          return S.saveProject(data.project);
        }).then(function () {
          openProject(data.project);
          toast('הספר שוחזר: ' + (data.project.title || ''));
        });
      }).catch(function () { toast('הקובץ אינו גיבוי תקין של ספר.', true); });
    });
  }

  function bindManual() {
    $('#manualCopy').addEventListener('click', function () {
      var ta = $('#manualPrompt');
      var done = function () { toast('ההנחיה הועתקה. הדביקו אותה ב-Claude.ai'); };
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); document.execCommand('copy'); done(); });
      else { ta.select(); document.execCommand('copy'); done(); }
    });
  }

  /* ================= הפעלה ================= */
  function init() {
    applyA11y();
    bindA11y();
    bindTabs();
    bindDetails();
    bindStory();
    bindImages();
    bindWrite();
    bindBook();
    bindProjects();
    bindManual();
    checkServer();
    S.persist();
    window.addEventListener('beforeunload', function () { if (project) S.saveProject(project); });
    window.addEventListener('beforeprint', function () { if (bookDirty && !$('#panel-book').hidden) renderBook(); });

    var currentId = ls('bs-current');
    (currentId ? S.getProject(currentId) : Promise.resolve(null))
      .then(function (p) { return p || S.listProjects().then(function (l) { return l[0]; }); })
      .then(function (p) {
        openProject(p || blankProject());
        if (!p) save({ now: true });
      })
      .catch(function () { openProject(blankProject()); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
