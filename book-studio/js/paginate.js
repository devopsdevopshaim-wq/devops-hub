/* עימוד הספר: מחלק את הטקסט והתמונות לעמודים אמיתיים בגודל הדפוס. */
(function () {
  'use strict';
  var P = window.BookPrompts;

  var ORDINALS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני', 'תשיעי', 'עשירי',
    'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר', 'עשרים'];

  function chapterLabel(i) { return i < ORDINALS.length ? 'פרק ' + ORDINALS[i] : 'פרק ' + (i + 1); }

  /* עיטור מסולסל סימטרי */
  var FLOURISH_HALF = '<path d="M110 12c10 0 16-7 27-6 9 1 11 11 3 12-6 1-7-6-2-7" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<path d="M118 12c14 3 26 3 38 0s22-3 38 0" fill="none" stroke="currentColor" stroke-width=".6"/>' +
    '<circle cx="197" cy="12" r="1.3" fill="currentColor"/><path d="M146 5.5c2-2.5 5-2.5 6 0-2.5 1-4.5 1-6 0z" fill="currentColor"/>';
  var ORNAMENT = '<svg class="orn" viewBox="0 0 200 24" aria-hidden="true">' +
    '<path d="M100 2.5l7 9.5-7 9.5-7-9.5z" fill="none" stroke="currentColor" stroke-width=".9"/><path d="M100 7l3.6 5-3.6 5-3.6-5z" fill="currentColor"/>' +
    '<circle cx="89" cy="12" r="1.4" fill="currentColor"/><circle cx="111" cy="12" r="1.4" fill="currentColor"/>' +
    '<g>' + FLOURISH_HALF + '</g><g transform="matrix(-1 0 0 1 200 0)">' + FLOURISH_HALF + '</g></svg>';

  /* פינה מעוטרת למסגרות */
  var CORNER = '<svg class="corner" viewBox="0 0 60 60" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round">' +
    '<path d="M58 4H22C11 4 4 11 4 22v36" stroke-width="1.2"/>' +
    '<path d="M58 9H25C15.5 9 9 15.5 9 25v33" stroke-width=".5"/>' +
    '<path d="M16 16c7-6 15-2 13 4-1.5 4-7 4-7.5 0-.4-2.6 2.4-3.6 3.8-2" stroke-width="1"/>' +
    '<path d="M34 4c-3 5-9 6-12 3M4 34c5-3 6-9 3-12" stroke-width=".8"/>' +
    '<circle cx="31" cy="31" r="1.6" fill="currentColor" stroke="none"/></svg>';
  var DECO = '<div class="deco" aria-hidden="true">' + ['c-tr', 'c-tl', 'c-br', 'c-bl'].map(function (c) { return CORNER.replace('class="corner"', 'class="corner ' + c + '"'); }).join('') + '</div>';

  /* סמל הוצאה: ספר פתוח בתוך עלי דפנה */
  var EMBLEM = '<svg class="emblem" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="24" cy="24" r="22" stroke-width=".8"/><circle cx="24" cy="24" r="19.5" stroke-width=".4"/>' +
    '<path d="M13 17c4-1.5 8-1 11 1.5V33c-3-2.5-7-3-11-1.5zM35 17c-4-1.5-8-1-11 1.5V33c3-2.5 7-3 11-1.5z" stroke-width="1.1"/>' +
    '<path d="M24 12.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6" stroke-width=".7"/></svg>';

  /* מדליון לכריכה ללא תמונה */
  var MEDAL = '<svg class="cover-medal" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round">' +
    '<circle cx="60" cy="60" r="56" stroke-width="1"/><circle cx="60" cy="60" r="51" stroke-width=".5" stroke-dasharray="1 3"/>' +
    '<circle cx="60" cy="60" r="44" stroke-width=".8"/>' +
    Array.from({ length: 12 }, function (_, i) {
      var a = i * 30;
      return '<path transform="rotate(' + a + ' 60 60)" d="M60 18c5 8 5 15 0 22-5-7-5-14 0-22z" stroke-width=".9"/>';
    }).join('') +
    '<circle cx="60" cy="60" r="12" stroke-width="1"/><path d="M60 51l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L60 65.4l-5.9 3.6 1.7-6.7-5.3-4.4 6.9-.5z" fill="currentColor" stroke="none"/></svg>';

  var SCENE = '<svg viewBox="0 0 60 12" aria-hidden="true"><path d="M30 1.5l4 4.5-4 4.5-4-4.5z" fill="currentColor"/><circle cx="18" cy="6" r="1.6" fill="currentColor"/><circle cx="42" cy="6" r="1.6" fill="currentColor"/><path d="M2 6h10M48 6h10" stroke="currentColor" stroke-width=".6"/></svg>';

  /* מספר עברי באותיות: 1 → א, 15 → טו, 23 → כג */
  function hebNum(n) {
    var out = '';
    [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י']].forEach(function (p) {
      while (n >= p[0]) {
        if (n === 15 || n === 16) break;
        out += p[1]; n -= p[0];
      }
    });
    if (n === 15) return out + 'טו';
    if (n === 16) return out + 'טז';
    return out + (n ? 'אבגדהוזחט'[n - 1] : '');
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function paragraphs(text) {
    return String(text || '').replace(/\r/g, '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function isBreak(s) { return /^[*✦•·#—\s-]+$/.test(s) && s.replace(/\s/g, '').length >= 3; }

  function Layout(container, project, images) {
    this.c = container;
    this.p = project;
    this.images = images; // id -> {src, w, h, caption}
    this.pages = [];
    this.interior = 0;
    this.chapterPage = {};
    this.currentChapter = '';
  }

  Layout.prototype.newPage = function (kind, opts) {
    opts = opts || {};
    var page = el('section', 'page ' + kind);
    var numbered = kind !== 'cover' && kind !== 'back';
    if (numbered) this.interior++;
    page.dataset.n = numbered ? this.interior : '';
    page.classList.add(numbered ? (this.interior % 2 ? 'recto' : 'verso') : 'solo');
    var head = el('header', 'run-head');
    var body = el('div', 'page-body');
    var foot = el('footer', 'folio');
    page.appendChild(head); page.appendChild(body); page.appendChild(foot);
    if (opts.head) head.textContent = page.classList.contains('verso') ? (this.p.title || '') : this.currentChapter;
    if (opts.folio) foot.textContent = this.interior;
    page.setAttribute('aria-label', numbered ? 'עמוד ' + this.interior : (kind === 'cover' ? 'כריכה קדמית' : 'כריכה אחורית'));
    this.c.appendChild(page);
    this.pages.push(page);
    this.page = page;
    this.body = body;
    return page;
  };

  Layout.prototype.fits = function (body) {
    body = body || this.body;
    return body.scrollHeight <= body.clientHeight + 1;
  };

  Layout.prototype.textPage = function () { return this.newPage('text', { head: true, folio: true }); };

  /* מוסיף פסקה, ומפצל אותה בין עמודים לפי הצורך. */
  /* בפסקה הראשונה של פרק, המילים הראשונות מודגשות כמו בספרים מהודרים. */
  function fill(p, text) {
    if (!p.classList.contains('first')) { p.textContent = text; return; }
    var w = text.split(/\s+/);
    var n = Math.min(3, w.length);
    p.innerHTML = '<span class="lead">' + esc(w.slice(0, n).join(' ')) + '</span>' + (w.length > n ? ' ' + esc(w.slice(n).join(' ')) : '');
  }

  Layout.prototype.addParagraph = function (text, cls) {
    var p = el('p', cls || '');
    fill(p, text);
    this.body.appendChild(p);
    if (this.fits()) return;
    var words = text.split(/\s+/);
    var lo = 1, hi = words.length - 1, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      fill(p, words.slice(0, mid).join(' '));
      if (this.fits()) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    // שארית קצרה מדי בתחתית העמוד — מעבירים את כל הפסקה לעמוד הבא.
    if (best < 6 && this.body.childElementCount > 1) {
      this.body.removeChild(p);
      this.textPage();
      return this.addParagraph(text, cls);
    }
    best = Math.max(1, best);
    fill(p, words.slice(0, best).join(' '));
    p.classList.add('split');
    this.textPage();
    this.addParagraph(words.slice(best).join(' '), 'cont');
  };

  Layout.prototype.addBreak = function () {
    if (this.body.childElementCount === 0) return;
    var b = el('div', 'scene-break', SCENE);
    this.body.appendChild(b);
    if (!this.fits()) { this.body.removeChild(b); this.textPage(); }
  };

  Layout.prototype.figure = function (img) {
    var fig = el('figure', 'fig');
    var im = el('img');
    im.src = img.src;
    im.alt = img.caption || '';
    fig.appendChild(im);
    if (img.caption) fig.appendChild(el('figcaption', '', esc(img.caption)));
    return fig;
  };

  Layout.prototype.addInlineImage = function (img) {
    var fig = this.figure(img);
    var imgEl = fig.firstChild;
    var width = this.body.clientWidth;
    var natural = img.w && img.h ? width * img.h / img.w : width * 0.66;
    var maxH = this.body.clientHeight * 0.55;
    imgEl.style.height = Math.min(natural, maxH) + 'px';
    this.body.appendChild(fig);
    if (this.fits()) return;
    var others = this.body.scrollHeight - fig.offsetHeight;
    var capH = fig.offsetHeight - imgEl.offsetHeight;
    var room = this.body.clientHeight - others - capH - 12;
    if (room >= this.body.clientHeight * 0.3) {
      imgEl.style.height = room + 'px';
      if (this.fits()) return;
    }
    this.body.removeChild(fig);
    this.textPage();
    this.body.appendChild(fig);
  };

  Layout.prototype.addFullImage = function (img) {
    this.newPage('full', { folio: true });
    var fig = this.figure(img);
    this.body.appendChild(fig);
    var imgEl = fig.firstChild;
    var capH = img.caption ? 48 : 0;
    imgEl.style.maxHeight = (this.body.clientHeight - capH) + 'px';
  };

  /* ---------- חלקי הספר ---------- */

  /* מסגרת כפולה עם פינות מעוטרות, מחוץ לאזור הטקסט (לא משפיעה על העימוד) */
  Layout.prototype.frame = function () {
    this.page.insertAdjacentHTML('beforeend', DECO);
  };

  Layout.prototype.cover = function (coverImg) {
    var p = this.p;
    var page = this.newPage('cover');
    var g = P.GENRES[p.genre] || P.GENRES.memoir;
    page.classList.add('genre-' + (p.genre || 'memoir'));
    this.frame();
    this.body.innerHTML = '<div class="cover-frame">' +
      '<p class="cover-genre foil">' + esc(g.label) + '</p>' +
      (coverImg
        ? '<div class="cover-art"><img src="' + coverImg.src + '" alt="' + esc(coverImg.caption || 'איור הכריכה') + '"></div>'
        : '<div class="cover-space"></div>') +
      '<h1 class="cover-title foil">' + esc(p.title || 'שם הספר') + '</h1>' +
      (p.subtitle ? '<p class="cover-sub">' + esc(p.subtitle) + '</p>' : '') +
      '<div class="cover-orn">' + ORNAMENT + '</div>' +
      (coverImg ? '' : MEDAL + '<div class="cover-space"></div>') +
      '<p class="cover-author foil">' + esc(p.author || '') + '</p></div>';
  };

  Layout.prototype.backCover = function () {
    var p = this.p;
    var page = this.newPage('back');
    page.classList.add('genre-' + (p.genre || 'memoir'));
    this.frame();
    this.body.innerHTML = '<div class="cover-frame back-frame">' +
      '<h2 class="back-title foil">' + esc(p.title || '') + '</h2>' +
      (p.blurb ? '<div class="blurb-box">' + paragraphs(p.blurb).map(function (t) { return '<p class="blurb">' + esc(t) + '</p>'; }).join('') + '</div>' : '') +
      '<div class="cover-orn">' + ORNAMENT + '</div><div class="cover-space"></div>' +
      '<p class="cover-author foil">' + esc(p.author || '') + '</p></div>';
  };

  Layout.prototype.titlePage = function (label) {
    var p = this.p;
    this.newPage('front title-page');
    this.frame();
    this.body.innerHTML = '<div class="tp">' +
      (label ? '<p class="tp-label">' + esc(label) + '</p>' : '<div class="cover-space"></div>') +
      '<h1 class="foil">' + esc(p.title || '') + '</h1>' +
      (p.subtitle ? '<p class="tp-sub">' + esc(p.subtitle) + '</p>' : '') +
      ORNAMENT + EMBLEM +
      '<p class="tp-author">' + esc(p.author || '') + '</p></div>';
  };

  Layout.prototype.frontMatter = function () {
    var p = this.p;
    var g = P.GENRES[p.genre] || P.GENRES.memoir;
    this.newPage('front half-title');
    this.body.innerHTML = '<div class="half-wrap"><h2 class="half">' + esc(p.title || '') + '</h2>' + ORNAMENT + '</div>';
    this.newPage('front blank');

    this.titlePage(g.label);

    this.newPage('front copyright');
    this.body.innerHTML = '<div class="copy">' + EMBLEM + '<p>' + esc(p.title || '') + (p.subtitle ? ' — ' + esc(p.subtitle) : '') + '</p><p>© ' + new Date().getFullYear() + ' ' + esc(p.author || '') + '</p>' +
      '<p>כל הזכויות שמורות. אין להעתיק, לשכפל, לתרגם או לפרסם ספר זה או קטעים ממנו בכל צורה ובכל אמצעי ללא אישור בכתב מהמחבר.</p></div>';

    if ((p.dedication || '').trim()) {
      this.newPage('front dedication');
      this.body.innerHTML = '<div class="ded">' + ORNAMENT + paragraphs(p.dedication).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + ORNAMENT + '</div>';
      if (this.interior % 2 === 1) this.newPage('front blank');
    }
  };

  Layout.prototype.toc = function (chapters) {
    var self = this;
    var entries = [];
    this.newPage('front toc-page');
    this.body.appendChild(el('div', 'toc-head', '<h2 class="toc-title">תוכן העניינים</h2>' + ORNAMENT));
    var list = el('ol', 'toc');
    this.body.appendChild(list);
    chapters.forEach(function (c, i) {
      var li = el('li', '', '<span class="k">' + hebNum(i + 1) + '</span><span class="t">' + esc(c.title || chapterLabel(i)) + '</span><span class="dots"></span><span class="n">000</span>');
      list.appendChild(li);
      if (!self.fits()) {
        list.removeChild(li);
        self.newPage('front toc-page');
        list = el('ol', 'toc');
        self.body.appendChild(list);
        list.appendChild(li);
      }
      entries.push({ id: c.id, li: li });
    });
    return entries;
  };

  Layout.prototype.chapter = function (c, i, placed) {
    // פרק חדש נפתח בעמוד חדש, תמיד בצד שמאל (עמוד אי-זוגי) כמו בספרים מודפסים.
    if (this.interior % 2 === 1) this.newPage('front blank');
    this.currentChapter = c.title || chapterLabel(i);
    this.newPage('text opener', { folio: true });
    this.chapterPage[c.id] = this.interior;
    var head = el('div', 'ch-head', '<p class="ch-mark foil">' + hebNum(i + 1) + '</p><p class="ch-num">' + chapterLabel(i) + '</p><h2 class="ch-title">' + esc(c.title || '') + '</h2>' + ORNAMENT);
    this.body.appendChild(head);

    var self = this;
    (placed.start || []).forEach(function (img) { self.addInlineImage(img); });

    var paras = paragraphs(c.text);
    if (!paras.length) this.addParagraph('(הפרק עדיין לא נכתב)', 'empty');
    var first = true;
    paras.forEach(function (t) {
      if (isBreak(t)) { self.addBreak(); first = true; return; }
      self.addParagraph(t, first ? 'first' : '');
      first = false;
    });
    (placed.end || []).forEach(function (img) { self.addInlineImage(img); });
    (placed.full || []).forEach(function (img) { self.addFullImage(img); });
  };

  /* ---------- ספר ילדים ---------- */

  Layout.prototype.kidsScene = function (c, i, placed) {
    this.currentChapter = '';
    var page = this.newPage('kids-page', { folio: true });
    this.chapterPage[c.id] = this.interior;
    var img = (placed.start || [])[0] || (placed.full || [])[0] || (placed.end || [])[0];
    if (img) {
      var fig = this.figure({ src: img.src, w: img.w, h: img.h, caption: '' });
      fig.className = 'kids-art';
      fig.firstChild.alt = img.caption || c.illustrationIdea || '';
      this.body.appendChild(fig);
    } else {
      page.classList.add('no-art');
      this.body.appendChild(el('div', 'kids-orn', ORNAMENT));
    }
    var box = el('div', 'kids-text');
    paragraphs(c.text || '(הטקסט לעמוד הזה עדיין לא נכתב)').forEach(function (t) { box.appendChild(el('p', '', esc(t))); });
    this.body.appendChild(box);
    var size = 100;
    while (!this.fits() && size > 55) { size -= 5; box.style.fontSize = size + '%'; }
  };

  function groupImages(project, images) {
    var byChapter = {};
    var cover = null;
    (project.images || []).forEach(function (meta) {
      var data = images[meta.id];
      if (!data || !meta.place) return;
      var img = { src: data.src, w: data.w, h: data.h, caption: meta.caption || '' };
      if (meta.place.type === 'cover') { cover = img; return; }
      if (meta.place.type !== 'chapter' || !meta.place.chapterId) return;
      var slot = byChapter[meta.place.chapterId] || (byChapter[meta.place.chapterId] = { start: [], end: [], full: [] });
      (slot[meta.place.position] || slot.start).push(img);
    });
    return { byChapter: byChapter, cover: cover };
  }

  var THEMES = {
    royal: { label: 'מלכותי', hint: 'זהב על כחול לילה, אותיות עדינות ומעוטרות' },
    classic: { label: 'קלאסי', hint: 'בורדו וזהב, אותיות ספר מסורתיות' },
    modern: { label: 'מודרני', hint: 'שחור, זהב דק וקווים נקיים' },
    vintage: { label: 'וינטג׳', hint: 'עור חום, נייר עתיק ואותיות רש״י' }
  };

  function applyPageSize(container, project) {
    var t = P.TRIMS[project.trim] || P.TRIMS.a5;
    var kids = P.isKids(project);
    var scale = Number(project.fontScale) || 1;
    var s = container.style;
    s.setProperty('--pw', t.w + 'mm');
    s.setProperty('--ph', t.h + 'mm');
    s.setProperty('--mt', t.m[0] + 'mm');
    s.setProperty('--mo', t.m[1] + 'mm');
    s.setProperty('--mb', t.m[2] + 'mm');
    s.setProperty('--mi', t.m[3] + 'mm');
    s.setProperty('--fs', ((kids ? 19 : 11.2) * scale).toFixed(2) + 'pt');
    container.classList.toggle('kids', kids);
    Object.keys(THEMES).forEach(function (k) { container.classList.remove('theme-' + k); });
    container.classList.add('theme-' + (THEMES[project.bookTheme] ? project.bookTheme : 'royal'));
    var style = document.getElementById('pageSize');
    if (style) style.textContent = '@page { size: ' + t.w + 'mm ' + t.h + 'mm; margin: 0; }';
  }

  /* מעמד את הספר כולו. מחזיר נתונים על העמודים. */
  function render(container, project, images) {
    container.innerHTML = '';
    applyPageSize(container, project);
    var L = new Layout(container, project, images);
    var g = groupImages(project, images);
    var chapters = project.chapters || [];
    var kids = P.isKids(project);
    var empty = { start: [], end: [], full: [] };

    L.cover(g.cover);
    if (kids) {
      L.titlePage('');
      if ((project.dedication || '').trim()) {
        L.newPage('front dedication');
        L.body.innerHTML = '<div class="ded"><p>' + esc(project.dedication) + '</p></div>';
      }
      chapters.forEach(function (c, i) { L.kidsScene(c, i, g.byChapter[c.id] || empty); });
      L.newPage('front the-end');
      L.frame();
      L.body.innerHTML = '<div class="tp"><div class="cover-space"></div><h2 class="foil">הסוף</h2>' + ORNAMENT + '<div class="cover-space"></div></div>';
    } else {
      L.frontMatter();
      var toc = L.toc(chapters);
      chapters.forEach(function (c, i) { L.chapter(c, i, g.byChapter[c.id] || empty); });
      toc.forEach(function (e) { e.li.querySelector('.n').textContent = L.chapterPage[e.id] || ''; });
    }
    if (L.interior % 2 === 1) L.newPage('front blank');
    L.backCover();

    return { pages: L.pages.length, interior: L.interior, chapterPage: L.chapterPage };
  }

  window.BookLayout = { THEMES: THEMES, hebNum: hebNum, render: render, chapterLabel: chapterLabel, paragraphs: paragraphs, isBreak: isBreak, esc: esc, ORNAMENT: ORNAMENT };
})();
