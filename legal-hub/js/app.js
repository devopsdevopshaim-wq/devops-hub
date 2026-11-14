/* מצפן משפטי — ממשק: ניווט, הצגת חוות הדעת, מענה מורחב, מחשבונים, מכתבים ושמירה */
(function () {
  var LAW = window.LAW, ENGINE = window.ENGINE, TOOLS = window.TOOLS;
  var AI_SERVER = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';
  var SAVE_KEY = 'legal-hub:saved', PREF_KEY = 'legal-hub:prefs';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); }
  function search(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
  function lawLink(name) { return 'https://he.wikisource.org/w/index.php?search=' + encodeURIComponent(name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/,.*$/, '').trim()); }

  /* ------------------------------------------------------------ סמלים לתחומים (קו, 24×24) */
  var ICON = {
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    family: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M13.5 20c.2-2.6 1.6-4.6 3.5-4.6s3.5 2 3.5 4.6"/>',
    violence: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v5M12 16v.5"/>',
    rent: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><circle cx="12" cy="14" r="2"/><path d="M12 16v3"/>',
    consumer: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    claims: '<path d="M14 4l6 6-3 3-6-6zM11 7L4 14l3 3 7-7"/><path d="M3 21h10"/>',
    traffic: '<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="3" rx="1"/><circle cx="7" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    injury: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01"/>',
    health: '<path d="M3 12h4l2-4 4 8 2-4h6"/>',
    inherit: '<path d="M7 3h10v18l-5-3-5 3z"/><path d="M10 8h4M10 11h4"/>',
    realestate: '<rect x="4" y="3" width="10" height="18"/><path d="M14 9h6v12h-6M7 7h4M7 11h4M7 15h4"/>',
    debts: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    btl: '<path d="M12 3v18M5 8h14M7 8l-3 6h6zM17 8l-3 6h6z"/>',
    insurance: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>',
    banking: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
    tax: '<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    criminal: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    contracts: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h4"/>',
    speech: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    equality: '<circle cx="12" cy="12" r="9"/><path d="M8 10h8M8 14h8"/>',
    gov: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
    status: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    army: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
    business: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    elderly: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    kids: '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>'
  };
  function icon(id) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[id] || ICON.claims) + '</svg>'; }

  /* ------------------------------------------------------------ העדפות נגישות */
  var prefs = store(PREF_KEY) || { fs: 0, hc: false };
  function applyPrefs() {
    document.documentElement.dataset.fs = prefs.fs;
    document.documentElement.toggleAttribute('data-contrast', !!prefs.hc);
    $$('[data-fs]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.fs === +prefs.fs)); });
    $('#contrastBtn').setAttribute('aria-pressed', String(!!prefs.hc));
  }
  $$('[data-fs]').forEach(function (b) { b.addEventListener('click', function () { prefs.fs = +b.dataset.fs; store(PREF_KEY, prefs); applyPrefs(); }); });
  $('#contrastBtn').addEventListener('click', function () { prefs.hc = !prefs.hc; store(PREF_KEY, prefs); applyPrefs(); });
  applyPrefs();

  var menuBtn = $('.menu-btn');
  menuBtn.addEventListener('click', function () { var o = menuBtn.getAttribute('aria-expanded') !== 'true'; menuBtn.setAttribute('aria-expanded', String(o)); $('#nav').classList.toggle('open', o); });

  /* ------------------------------------------------------------ דף הבית */
  var LEDGER = [
    ['15 יום', 'כתב הגנה בתביעה קטנה', 'מי שלא עונה — מפסיד בהיעדר הגנה.', 'claims'],
    ['30 יום', 'ערר על סגירת תיק פלילי', 'לנפגע עבירה שהתיק שלו נסגר.', 'criminal'],
    ['60 יום', 'ערר על ועדה רפואית בביטוח לאומי', 'אחרי כן ההחלטה סופית.', 'btl'],
    ['90 יום', 'דוח תנועה: לשלם או לבקש להישפט', 'תשלום הוא הודאה, כולל הנקודות.', 'traffic'],
    ['90 יום', 'השגה על ארנונה', 'אחרי המועד אי אפשר לערער על השטח והסיווג.', 'tax'],
    ['3 שנים', 'תביעה נגד חברת ביטוח', 'קצר בהרבה מ־7 השנים הרגילות.', 'insurance']
  ];
  $('#ledger').innerHTML = LEDGER.map(function (l) {
    return '<li><a href="#/area/' + l[3] + '"><b class="span">' + l[0] + '</b><span class="what">' + l[1] + '</span><span class="why">' + l[2] + '</span></a></li>';
  }).join('');

  function areaCard(a) {
    var dl = [];
    a.issues.forEach(function (i) { (i.dl || []).forEach(function (x) { dl.push(x); }); });
    return '<a class="area" href="#/area/' + a.id + '">' + icon(a.id) +
      '<span class="a-name">' + esc(a.name) + '</span><span class="a-blurb">' + esc(a.blurb) + '</span>' +
      '<span class="a-meta">' + a.issues.length + (a.issues.length === 1 ? ' מצב' : ' מצבים') + '</span></a>';
  }
  $('#areasHome').innerHTML = LAW.AREAS.slice(0, 12).map(areaCard).join('');
  $('#areasAll').innerHTML = LAW.AREAS.map(areaCard).join('');

  $$('.examples .chip').forEach(function (c) { c.addEventListener('click', function () { $('#q').value = c.textContent; ask(c.textContent); }); });
  $('#askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('#q').value.trim();
    if (t.length < 4) { $('#q').focus(); toast('כתבו את השאלה — אפשר גם משפט אחד.'); return; }
    ask(t);
  });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#askForm').requestSubmit(); });

  /* ------------------------------------------------------------ סינון תחומים */
  $('#areaFilter').addEventListener('input', function () {
    var q = this.value.trim(), out = $('#areaFilterOut');
    if (!q) { out.innerHTML = ''; $('#areasAll').hidden = false; return; }
    var r = ENGINE.search(q);
    $('#areasAll').hidden = true;
    out.innerHTML = r.length ? '<div class="issue-list">' + r.map(issueRow).join('') + '</div>' : '<p class="empty">לא נמצא מצב מתאים. <a href="#/" data-prefill="' + esc(q) + '">שאלו את השאלה במלואה ←</a></p>';
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-prefill]'); if (!a) return;
    e.preventDefault(); $('#q').value = a.dataset.prefill; ask(a.dataset.prefill);
  });

  function issueRow(it) {
    return '<a class="issue-row" href="#/issue/' + it.id + '"><span class="i-area">' + esc(it.area.name) + '</span><b>' + esc(it.q) + '</b><span class="i-s">' + esc(it.s.split('. ')[0]) + '.</span></a>';
  }

  /* ------------------------------------------------------------ ניווט */
  var current = null;
  function show(view) {
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== view; });
    var navKey = view === 'area' ? 'areas' : view === 'answer' ? 'home' : view;
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#nav').classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false');
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    var v = h[0] || 'home';
    window.scrollTo(0, 0);
    if (v === 'area') {
      var a = LAW.AREAS.filter(function (x) { return x.id === h[1]; })[0];
      if (!a) return go('areas');
      $('#areaHead').innerHTML = '<nav class="crumbs" aria-label="מיקום"><a href="#/">ראשי</a><a href="#/areas">תחומי משפט</a><span>' + esc(a.name) + '</span></nav>' +
        '<div class="area-title">' + icon(a.id) + '<div><h1>' + esc(a.name) + '</h1><p>' + esc(a.blurb) + '</p></div></div>';
      $('#areaIssues').innerHTML = a.issues.map(issueRow).join('') +
        '<div class="area-ask"><p>המצב שלך לא מופיע כאן?</p><a class="btn ghost" href="#/" data-focus="q">כתבו את השאלה שלכם ←</a></div>';
      document.title = a.name + ' — מצפן משפטי';
      return show('area');
    }
    if (v === 'issue') {
      var it = ENGINE.byId(h[1]); if (!it) return go('areas');
      renderAnswer({ text: '', issue: it, related: it.area.issues.filter(function (x) { return x !== it; }), areas: [it.area], flags: [] }, true);
      document.title = it.q + ' — מצפן משפטי';
      return show('answer');
    }
    if (v === 'answer') { if (!current) return go(''); return show('answer'); }
    if (v === 'tools') { pickTool(h[1] || 'severance'); document.title = 'מחשבונים — מצפן משפטי'; return show('tools'); }
    if (v === 'saved') renderSaved();
    var titles = { letters: 'מכתבים', courts: 'בתי המשפט', help: 'לאן פונים', glossary: 'מילון מונחים', saved: 'השאלות שלי', areas: 'תחומי משפט' };
    document.title = (titles[v] ? titles[v] + ' — ' : '') + 'מצפן משפטי — מענה משפטי ראשוני';
    show($('[data-view="' + v + '"]') ? v : 'home');
  }
  function go(p) { location.hash = '#/' + p; }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', function (e) { var f = e.target.closest('[data-focus]'); if (f) setTimeout(function () { $('#' + f.dataset.focus).focus(); }, 60); });

  /* ------------------------------------------------------------ מענה */
  function ask(text) {
    var r = ENGINE.analyze(text);
    if (!r.issue) r.flags = r.flags.filter(function (f) { return f.id !== 'deadline'; });
    renderAnswer(r, false);
    saveQ(r);
    if (location.hash !== '#/answer') go('answer'); else { show('answer'); window.scrollTo(0, 0); }
  }

  function caseNo(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return String(h % 900000 + 100000); }
  function list(arr, cls) { return arr && arr.length ? '<ul class="' + (cls || 'dots') + '">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }

  function seal(level) {
    var lbl = level === 2 ? 'דחוף' : level === 1 ? 'יש מועד' : 'רגיל';
    return '<div class="seal s' + level + '" role="img" aria-label="דחיפות: ' + lbl + '"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><path id="sc" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>' +
      '<circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="35" class="in"/>' +
      '<text text-anchor="middle"><textPath href="#sc" startOffset="50%">מצפן משפטי · חוות דעת ראשונית · מצפן משפטי ·</textPath></text></svg><b>' + lbl + '</b></div>';
  }

  function renderAnswer(r, fromIndex) {
    current = r;
    var it = r.issue, now = new Date();
    $('#ansCrumbs').innerHTML = '<a href="#/">ראשי</a>' + (it ? '<a href="#/area/' + it.area.id + '">' + esc(it.area.name) + '</a>' : '') + '<span>' + (it ? esc(it.q) : 'מענה לשאלה') + '</span>';
    $('#flags').innerHTML = r.flags.map(function (f) {
      return '<div class="flag ' + f.id + '" role="alert"><b>' + esc(f.title) + '</b><p>' + esc(f.text) + '</p>' +
        (f.tel ? '<div class="flag-tel">' + f.tel.map(function (t) { return '<a href="tel:' + t[0] + '">' + t[0] + ' · ' + esc(t[1]) + '</a>'; }).join('') + '</div>' : '') + '</div>';
    }).join('');

    var head = '<header class="op-head"><div class="op-meta">' +
      '<span>חוות דעת ראשונית</span><span>מס׳ ' + caseNo((r.text || '') + (it ? it.id : '')) + '</span><span>' + now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>' +
      (it ? '<span>' + esc(it.area.name) + '</span>' : '') + '</div>' + seal(it ? (it.u || 0) : (r.flags.length ? 1 : 0)) +
      '<h1>' + (it ? esc(it.q) : 'לא זיהינו מצב מוכר בשאלה') + '</h1></header>';

    var body;
    if (it) {
      var sideDl = it.dl && it.dl.length ? '<section class="note dl"><h3>מועדים</h3><dl>' + it.dl.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl><a href="#/tools/limit">מחשבון מועדים ←</a></section>' : '';
      var sideDc = it.dc && it.dc.length ? '<section class="note"><h3>מסמכים להכין</h3>' + list(it.dc, 'checks') + '</section>' : '';
      var sideLw = it.lw && it.lw.length ? '<section class="note"><h3>חקיקה</h3><ul class="laws">' + it.lw.map(function (l) { return '<li><a href="' + lawLink(l) + '" target="_blank" rel="noopener">' + esc(l) + '</a></li>'; }).join('') + '</ul></section>' : '';
      body = '<div class="op-body"><div class="op-main">' +
        (r.text ? '<section class="sec quote"><h2>השאלה</h2><blockquote>' + esc(r.text) + '</blockquote></section>' : '') +
        '<section class="sec"><h2>בקצרה</h2><p class="lead">' + esc(it.s) + '</p></section>' +
        '<section class="sec"><h2>הזכויות והכללים</h2>' + list(it.r) + '</section>' +
        '<section class="sec"><h2>מה עושים עכשיו</h2><ol class="steps">' + it.st.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></section>' +
        '<section class="sec"><h2>לאן פונים</h2><div class="where">' + it.wh.map(whereCard).join('') + '</div></section>' +
        '<section class="sec pro"><h2>מתי כדאי עורך דין</h2><p>' + esc(it.pro) + '</p></section>' +
        '</div><aside class="op-side" aria-label="שוליים">' + sideDl + sideDc + sideLw + '</aside></div>';
    } else {
      body = '<div class="op-body single"><div class="op-main">' +
        (r.text ? '<section class="sec quote"><h2>השאלה</h2><blockquote>' + esc(r.text) + '</blockquote></section>' : '') +
        '<section class="sec"><p class="lead">לא מצאנו במאגר מצב שמתאים לשאלה באופן ברור. המענה המורחב למטה כותב תשובה לשאלה שלכם בדיוק.' +
        (r.areas.length ? ' ייתכן שהשאלה שייכת לתחומים האלה:' : '') + '</p>' +
        (r.areas.length ? '<div class="areas mini">' + r.areas.map(areaCard).join('') + '</div>' : '') + '</section>' +
        '<section class="sec"><h2>בינתיים — ארבעה צעדים שנכונים כמעט בכל עניין משפטי</h2><ol class="steps">' +
        '<li>רשמו מה קרה, לפי תאריכים, כל עוד זה טרי.</li><li>שמרו כל מסמך, הודעה, קבלה ותמונה — ואל תמחקו התכתבויות.</li><li>בדקו אם קיבלתם מסמך עם מועד (כתב תביעה, אזהרה, החלטה) — המועד נספר מיום הקבלה.</li><li>פנו בכתב לצד השני לפני כל הליך. <a href="#/letters">תבניות מכתבים ←</a></li></ol></section>' +
        '</div></div>';
    }

    var rel = r.related && r.related.length ? '<section class="related"><h2>' + (fromIndex ? 'מצבים נוספים בתחום' : 'ייתכן שרלוונטי גם') + '</h2><div class="issue-list">' + r.related.map(issueRow).join('') + '</div></section>' : '';

    var ai = '<section class="ai" id="aiBox"><div class="ai-head"><div><h2>מענה מורחב לשאלה שלך</h2><p>' +
      (r.text ? 'תשובה כתובה שמתייחסת לפרטים שסיפרתם, בנוסף למידע שלמעלה.' : 'כתבו את הפרטים של המקרה שלכם, ותתקבל תשובה שמתייחסת אליהם.') + '</p></div>' +
      (r.text ? '<button class="btn primary" type="button" id="aiBtn">כתיבת מענה מורחב</button>' : '<a class="btn primary" href="#/" data-focus="q">כתבו את השאלה ←</a>') + '</div><div id="aiOut" class="ai-out" hidden></div></section>';

    var acts = '<div class="op-acts"><button class="btn ghost" type="button" id="printBtn">הדפסה / PDF</button><button class="btn ghost" type="button" id="copyBtn">העתקה</button><a class="btn ghost" id="waBtn" target="_blank" rel="noopener" href="#">שיתוף בוואטסאפ</a></div>';
    var disc = '<p class="op-disc">המידע הוא כללי וראשוני, לפי החקיקה בישראל, ואינו ייעוץ משפטי או תחליף לעורך דין שבחן את המקרה. סכומים ומועדים מתעדכנים מעת לעת.</p>';

    $('#opinion').innerHTML = head + body + acts + disc;
    var old = $('#relatedBox'); if (old) old.remove();
    var oldAi = $('#aiWrap'); if (oldAi) oldAi.remove();
    $('#opinion').insertAdjacentHTML('afterend', '<div id="aiWrap">' + ai + '</div>');
    $('#followup').insertAdjacentHTML('afterend', '<div id="relatedBox">' + rel + '</div>');
    $('#followup').hidden = true; $('#fuThread').innerHTML = ''; thread = [];

    var aiBtn = $('#aiBtn'); if (aiBtn) aiBtn.addEventListener('click', function () { deepAI(r, aiBtn); });
    $('#printBtn').addEventListener('click', function () { window.print(); });
    $('#copyBtn').addEventListener('click', function () { copy(plain(r)); });
    $('#waBtn').href = 'https://wa.me/?text=' + encodeURIComponent((it ? it.q + '\n\n' + it.s : r.text) + '\n\n' + location.href.split('#')[0] + (it ? '#/issue/' + it.id : ''));
  }

  function whereCard(id) {
    var w = LAW.WHERE[id]; if (!w) return '';
    return '<a class="w" href="' + (w.u || search(w.q)) + '" target="_blank" rel="noopener"><b>' + esc(w.n) + '</b><span>' + esc(w.d) + '</span></a>';
  }

  function plain(r) {
    var it = r.issue, L = [];
    L.push('מצפן משפטי — חוות דעת ראשונית');
    if (r.text) L.push('השאלה: ' + r.text);
    if (it) {
      L.push('', it.q, '', 'בקצרה: ' + it.s, '', 'הזכויות:'); it.r.forEach(function (x) { L.push('• ' + x); });
      L.push('', 'מה עושים:'); it.st.forEach(function (x, i) { L.push((i + 1) + '. ' + x); });
      if (it.dl.length) { L.push('', 'מועדים:'); it.dl.forEach(function (x) { L.push('• ' + x[0] + ': ' + x[1]); }); }
      L.push('', 'לאן פונים: ' + it.wh.map(function (w) { return LAW.WHERE[w].n; }).join(' · '));
    }
    var ai = $('#aiOut'); if (ai && !ai.hidden && ai.textContent) L.push('', 'מענה מורחב:', ai.innerText);
    L.push('', 'מידע כללי, אינו ייעוץ משפטי.');
    return L.join('\n');
  }
  function copy(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('הועתק'); }, function () {
      var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('הועתק'); } catch (e) { toast('ההעתקה נכשלה — סמנו והעתיקו ידנית'); }
      ta.remove();
    });
  }

  /* ------------------------------------------------------------ מענה מורחב (AI) */
  var AI_ERR = {
    quota: 'המכסה היומית של המענה המורחב נגמרה. נסו שוב מחר.',
    'rate-limited': 'יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות.',
    'no-key': 'המענה המורחב עדיין לא הופעל בשרת.',
    offline: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
    forbidden: 'המענה המורחב פועל רק מכתובת האתר הרשמית.'
  };
  var SYSTEM = [
    'אתה עורך דין ישראלי ותיק ובקיא בכל תחומי המשפט בישראל, שנותן מענה משפטי ראשוני לציבור הרחב.',
    'כתוב בעברית פשוטה וברורה, בגוף שני רבים, בלי ז׳רגון (ואם יש מונח — הסבר אותו בסוגריים).',
    'מבנה התשובה, עם הכותרות האלה בדיוק (כל כותרת בשורה שמתחילה ב־## ):',
    '## בקצרה — 2–3 משפטים: מה הדין ומה המשמעות למקרה הזה.',
    '## מה החוק אומר — הכללים הרלוונטיים, עם שם החוק. ציין מספר סעיף רק אם אתה בטוח בו לחלוטין.',
    '## איך זה חל על המקרה שלך — ניתוח הפרטים שנמסרו, כולל טענות שהצד השני עשוי להעלות.',
    '## מה לעשות עכשיו — צעדים ממוספרים, לפי סדר, מעשיים.',
    '## מועדים — כל מועד רלוונטי, ומה קורה אם מפספסים.',
    '## לאן פונים — גופים ספציפיים בישראל (כולל סיוע משפטי חינם אם רלוונטי).',
    '## מה עוד חשוב לדעת — שאלות שהתשובה עליהן עשויה לשנות את המסקנה.',
    'כללים: אל תמציא חוקים, סעיפים, פסקי דין או סכומים. סכומים ותקרות שמתעדכנים — ציין שהם משתנים ויש לבדוק. אם השאלה לא מספיק ברורה, תן מענה לפי ההנחה הסבירה וציין אותה. אם יש סכנה לחיים — פתח בהפניה ל־100 / 118. אל תעודד הפרת חוק. אל תשתמש ב־** להדגשה. סיים במשפט אחד שמבהיר שמדובר במידע ראשוני ושכדאי להתייעץ עם עורך דין לפני צעד משמעותי.'
  ].join('\n');

  function ctxOf(r) {
    if (!r.issue) return '';
    var it = r.issue;
    return '\n\nמידע רקע מהמאגר (לשימושך, אפשר להרחיב ולדייק): תחום — ' + it.area.name + '; מצב — ' + it.q + '. ' + it.s +
      ' כללים: ' + it.r.join(' ') + ' מועדים: ' + it.dl.map(function (x) { return x[0] + ' — ' + x[1]; }).join('; ') + '. חקיקה: ' + it.lw.join('; ') + '.';
  }

  function callAI(prompt, cb) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 90000);
    fetch(AI_SERVER, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'ai', tag: 'legal', prompt: prompt }), signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return res.json().catch(function () { return { ok: false, error: 'bad-response' }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; })
      .then(function (j) { clearTimeout(timer); cb(j || {}); });
  }

  function md(t) {
    var lines = String(t).replace(/\*\*/g, '').replace(/\r/g, '').split('\n'), html = '', inUl = false, inOl = false;
    function close() { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } }
    lines.forEach(function (ln) {
      var s = ln.trim(), m;
      if (!s) { close(); return; }
      if ((m = s.match(/^#{1,4}\s*(.+)$/))) { close(); html += '<h3>' + esc(m[1]) + '</h3>'; return; }
      if ((m = s.match(/^[-*•]\s+(.+)$/))) { if (inOl) close(); if (!inUl) { html += '<ul class="dots">'; inUl = true; } html += '<li>' + esc(m[1]) + '</li>'; return; }
      if ((m = s.match(/^\d+[.)]\s+(.+)$/))) { if (inUl) close(); if (!inOl) { html += '<ol class="steps">'; inOl = true; } html += '<li>' + esc(m[1]) + '</li>'; return; }
      close(); html += '<p>' + esc(s) + '</p>';
    });
    close();
    return html;
  }

  var thread = [];
  function deepAI(r, btn) {
    var out = $('#aiOut');
    btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span> כותב מענה…';
    out.hidden = false; out.className = 'ai-out loading'; out.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel short"></div>';
    callAI(SYSTEM + '\n\nהשאלה של הפונה:\n' + r.text + ctxOf(r), function (j) {
      if (j.ok && j.text) {
        out.className = 'ai-out'; out.innerHTML = md(j.text);
        thread = [{ q: r.text, a: String(j.text).slice(0, 4000) }];
        $('#followup').hidden = false;
        updateSaved(r.text, j.text);
      } else {
        out.className = 'ai-out err';
        out.textContent = (AI_ERR[j.error] || 'המענה המורחב לא זמין כרגע.') + (r.issue ? ' המידע שלמעלה עומד בפני עצמו.' : ' נסו לנסח את השאלה במילים אחרות, או חפשו לפי תחום.');
      }
      btn.disabled = false; btn.textContent = j.ok ? 'כתיבה מחדש' : 'ניסיון נוסף';
    });
  }
  $('#fuForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#fuQ').value.trim(); if (!q || !current) return;
    var box = document.createElement('div'); box.className = 'fu-item';
    box.innerHTML = '<p class="fu-q">' + esc(q) + '</p><div class="ai-out loading"><div class="skel"></div><div class="skel short"></div></div>';
    $('#fuThread').appendChild(box); $('#fuQ').value = '';
    var hist = thread.slice(-3).map(function (x) { return 'שאלה: ' + x.q + '\nתשובה: ' + x.a; }).join('\n\n');
    var prompt = SYSTEM.replace(/מבנה התשובה[\s\S]*?## מה עוד חשוב לדעת[^\n]*\n/, 'זו שאלת המשך. ענה ישירות וממוקד, בפסקאות קצרות או ברשימה, בלי לחזור על מה שכבר נאמר.\n') +
      '\n\nהשיחה עד כה:\n' + hist + '\n\nשאלת ההמשך:\n' + q + ctxOf(current);
    callAI(prompt, function (j) {
      var o = box.querySelector('.ai-out');
      if (j.ok && j.text) { o.className = 'ai-out'; o.innerHTML = md(j.text); thread.push({ q: q, a: String(j.text).slice(0, 3000) }); }
      else { o.className = 'ai-out err'; o.textContent = AI_ERR[j.error] || 'המענה לא זמין כרגע.'; }
    });
  });

  /* ------------------------------------------------------------ שמירה */
  function saveQ(r) {
    var l = store(SAVE_KEY) || [];
    l = l.filter(function (x) { return x.text !== r.text; });
    l.unshift({ text: r.text, issue: r.issue ? r.issue.id : null, date: Date.now() });
    store(SAVE_KEY, l.slice(0, 40));
  }
  function updateSaved(text, ai) {
    var l = store(SAVE_KEY) || [];
    l.forEach(function (x) { if (x.text === text) x.ai = String(ai).slice(0, 6000); });
    store(SAVE_KEY, l);
  }
  function renderSaved() {
    var l = store(SAVE_KEY) || [], el = $('#savedList');
    if (!l.length) { el.innerHTML = '<div class="empty"><p>עדיין לא שאלתם כאן שאלות.</p><a class="btn primary" href="#/" data-focus="q">שאלו שאלה ←</a></div>'; return; }
    el.innerHTML = '<div class="saved">' + l.map(function (x, i) {
      var it = x.issue ? ENGINE.byId(x.issue) : null;
      return '<div class="saved-row"><div><span class="i-area">' + new Date(x.date).toLocaleDateString('he-IL') + (it ? ' · ' + esc(it.area.name) : '') + (x.ai ? ' · עם מענה מורחב' : '') + '</span><p>' + esc(x.text) + '</p></div>' +
        '<div class="saved-acts"><button class="btn ghost small" data-open="' + i + '">פתיחה</button><button class="btn ghost small" data-del="' + i + '" aria-label="מחיקת השאלה">מחיקה</button></div></div>';
    }).join('') + '</div><button class="btn ghost small" id="clearSaved">מחיקת כל השאלות</button>';
  }
  $('#savedList').addEventListener('click', function (e) {
    var l = store(SAVE_KEY) || [], b = e.target.closest('button'); if (!b) return;
    if (b.id === 'clearSaved') { store(SAVE_KEY, []); renderSaved(); return; }
    if (b.dataset.del) { l.splice(+b.dataset.del, 1); store(SAVE_KEY, l); renderSaved(); return; }
    if (b.dataset.open) {
      var x = l[+b.dataset.open]; $('#q').value = x.text; ask(x.text);
      if (x.ai) { var out = $('#aiOut'); out.hidden = false; out.className = 'ai-out'; out.innerHTML = md(x.ai); thread = [{ q: x.text, a: x.ai.slice(0, 4000) }]; $('#followup').hidden = false; }
    }
  });

  /* ------------------------------------------------------------ מחשבונים */
  $('#limitKind').innerHTML = TOOLS.LIMITS.map(function (l) { return '<option value="' + l[0] + '">' + esc(l[1]) + (l[2] === 'y' ? ' — ' + l[3] + ' שנים' : l[2] === 'm' ? ' — ' + l[3] + ' חודשים' : ' — ' + Math.abs(l[3]) + ' ימים') + '</option>'; }).join('');
  function pickTool(id) {
    if (!$('.tool[data-tool="' + id + '"]')) id = 'severance';
    $$('#toolTabs [data-tool]').forEach(function (b) { var on = b.dataset.tool === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.tool').forEach(function (t) { t.hidden = t.dataset.tool !== id; });
  }
  $('#toolTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) history.replaceState(null, '', '#/tools/' + b.dataset.tool), pickTool(b.dataset.tool); });
  $('#toolTabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var tabs = $$('#toolTabs [data-tool]'), i = tabs.indexOf(document.activeElement); if (i < 0) return;
    var n = tabs[(i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); n.click();
  });
  $$('form.calc').forEach(function (f) {
    var to = f.querySelector('[name=to]'); if (to) to.value = new Date().toISOString().slice(0, 10);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = TOOLS.calc(f.dataset.calc, f), out = f.parentNode.querySelector('.calc-out');
      if (r.err) { out.innerHTML = '<p class="calc-err">' + esc(r.err) + '</p>'; return; }
      out.innerHTML = '<div class="result ' + r.tone + '">' + r.rows.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>' + (r.note ? '<p class="calc-sub">' + esc(r.note) + '</p>' : '');
    });
  });

  /* ------------------------------------------------------------ מכתבים */
  var curLetter = TOOLS.LETTERS[0];
  $('#letterPick').innerHTML = TOOLS.LETTERS.map(function (l) { return '<button type="button" role="listitem" data-letter="' + l.id + '"><b>' + esc(l.n) + '</b><span>' + esc(l.d) + '</span></button>'; }).join('');
  function pickLetter(id) {
    curLetter = TOOLS.LETTERS.filter(function (l) { return l.id === id; })[0] || TOOLS.LETTERS[0];
    $$('#letterPick button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.letter === curLetter.id)); });
    $('#letterForm').innerHTML = '<h2>' + esc(curLetter.n) + '</h2>' + curLetter.f.map(function (f) {
      var inp = f.type === 'area' ? '<textarea name="' + f.id + '" rows="3" placeholder="' + esc(f.ph) + '"></textarea>' : '<input name="' + f.id + '" type="' + f.type + '" placeholder="' + esc(f.ph) + '" />';
      return '<label>' + esc(f.label) + inp + '</label>';
    }).join('');
    drawLetter();
  }
  function letterVals() { var v = {}; $$('#letterForm [name]').forEach(function (e) { v[e.name] = e.value.trim(); }); return v; }
  function letterText() {
    var v = letterVals(), date = new Date().toLocaleDateString('he-IL');
    return [date, '', 'לכבוד', v.to || '[הנמען]', ''].concat(curLetter.t(v)).concat(['', 'בכבוד רב,', v.name || '[השם שלך]']).join('\n');
  }
  function drawLetter() { $('#letterOut').textContent = letterText(); $('#letterMail').href = 'mailto:?subject=' + encodeURIComponent(curLetter.n) + '&body=' + encodeURIComponent(letterText()); }
  $('#letterPick').addEventListener('click', function (e) { var b = e.target.closest('[data-letter]'); if (b) pickLetter(b.dataset.letter); });
  $('#letterForm').addEventListener('input', drawLetter);
  $('#letterCopy').addEventListener('click', function () { copy(letterText()); });
  $('#letterPrint').addEventListener('click', function () { document.body.classList.add('print-letter'); window.print(); setTimeout(function () { document.body.classList.remove('print-letter'); }, 500); });
  pickLetter('demand');

  /* ------------------------------------------------------------ בתי משפט, לאן פונים, מילון */
  $('#courtsMap').innerHTML =
    '<div class="tier t3">' + court(LAW.COURTS[0]) + '</div>' +
    '<div class="tier t2">' + court(LAW.COURTS[1]) + court(LAW.COURTS[3]) + '</div>' +
    '<div class="tier t1">' + court(LAW.COURTS[2]) + court(LAW.COURTS[4]) + court(LAW.COURTS[5]) + '</div>' +
    '<p class="courts-note">ערעור עולה שלב אחד למעלה. בתי הדין הדתיים — ערעור לבית הדין הגדול של אותה עדה, ועתירה לבג״ץ בשאלות סמכות.</p>';
  function court(c) { return '<div class="court ' + (c.side || '') + '"><b>' + esc(c.n) + '</b><span>' + esc(c.d) + '</span></div>'; }
  $('#civilSteps').innerHTML = LAW.STEPS_CIVIL.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>'; }).join('');

  $('#whereAll').innerHTML = Object.keys(LAW.WHERE).map(whereCard).join('');

  function drawGloss(q) {
    var n = ENGINE.norm(q || '');
    var rows = LAW.GLOSSARY.filter(function (g) { return !n || ENGINE.norm(g[0] + ' ' + g[1]).indexOf(n) >= 0; });
    $('#glossList').innerHTML = rows.length ? rows.map(function (g) { return '<div><dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd></div>'; }).join('') : '<p class="empty">לא נמצא מונח. נסו מילה אחרת.</p>';
  }
  $('#glossFilter').addEventListener('input', function () { drawGloss(this.value); });
  drawGloss('');

  route();
})();
