/* מעגל סגור — ממשק המשתמש */
(function () {
  'use strict';

  var P = window.FixPrompts, N = window.Netlist, Store = window.CaseStore;
  var MAX_FILE = 20 * 1024 * 1024, MAX_IMG = 1600;

  var state = {
    ai: false, needCode: false, model: '',
    code: safeGet('fix-access-code') || '',
    domain: 'industrial',
    intakeFiles: [], followFiles: [],
    current: null, busy: null, lastError: null
  };

  /* ---------- כלים ---------- */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* פרטי */ } }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function when(t) {
    return new Date(t).toLocaleString('he-IL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  var toastTimer;
  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3800);
  }

  var DANGER = {
    low: { label: 'סיכון נמוך', cls: 'low' },
    medium: { label: 'סיכון בינוני', cls: 'medium' },
    high: { label: 'סיכון גבוה', cls: 'high' },
    critical: { label: 'סכנת חיים — חשמלאי מוסמך בלבד', cls: 'critical' }
  };

  var DOMAIN_ICONS = {
    industrial: '<path d="M4 3h16v18H4zM8 7h8M8 11h3M13 11h3M8 15h3M13 15h3" />',
    residential: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5" />',
    smarthome: '<path d="M3 11l9-7 9 7M5 10v10h14V10M9 15q3-3 6 0M11 17.5q1-1 2 0" />',
    electronics: '<path d="M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />',
    other: '<path d="M13 3L5 14h6l-1 7 8-11h-6z" />'
  };

  var EXAMPLES = [
    { t: 'מגען לא נסגר', d: 'industrial', f: { system: 'לוח פיקוד למשאבה', supply: '230VAC חד-פאזי', parts: 'מגען K1, לחצן הפעלה S2, ממסר תרמי F2', symptoms: 'בלחיצה על לחצן ההפעלה המגען לא נסגר ולא נשמע קליק. נורית "מוכן" דולקת. המפסק הראשי למעלה.', expected: 'בלחיצה על S2 המגען נסגר ונשאר סגור (החזקה עצמית) עד לחיצה על עצירה', history: 'עבד שנים. הפסיק אחרי שהמשאבה נתקעה אתמול.' } },
    { t: 'ממסר פחת קופץ', d: 'residential', f: { system: 'לוח דירתי', supply: '230VAC חד-פאזי', parts: 'ממסר פחת 40A 30mA', symptoms: 'ממסר הפחת קופץ כמה פעמים ביום, בעיקר בבוקר ובזמן גשם. לפעמים מיד כשמרימים אותו.', expected: 'שהפחת לא יקפוץ', history: 'התחיל אחרי החורף. יש דוד שמש וחימום חשמלי במרפסת.' } },
    { t: 'ספק 24V לא עולה', d: 'industrial', f: { system: 'ארון בקרה עם PLC', supply: '230VAC חד-פאזי', model: 'Mean Well NDR-120-24', parts: 'ספק כוח PSU1, PLC', symptoms: 'נורית ה-DC OK בספק מהבהבת, ה-PLC מתאתחל כל כמה שניות. ביציאה נמדד מתח שקופץ בין 0 ל-18V.', expected: '24VDC יציב' } },
    { t: 'תריס חכם לא מגיב', d: 'smarthome', f: { system: 'תריס חשמלי עם מודול חכם', model: 'Shelly Plus 2PM', supply: '230VAC חד-פאזי', parts: 'מודול Shelly, מנוע תריס, מתג קיר כפול', symptoms: 'התריס עולה מהאפליקציה אבל לא יורד. מהמתג בקיר — אף כיוון לא עובד. המודול מחובר לרשת.', expected: 'שליטה משני הכיוונים מהמתג ומהאפליקציה', history: 'הותקן לפני שבוע' } },
    { t: 'כרטיס מתחמם', d: 'electronics', f: { system: 'כרטיס בקר של מזגן', supply: '230VAC חד-פאזי', parts: 'רגולטור 7805, קבל אלקטרוליטי ליד הספק', symptoms: 'הרגולטור 7805 חם מאוד למגע, התצוגה מהבהבת והיחידה מתאתחלת. קבל 1000µF ליד הרגולטור נראה מעט נפוח.', expected: 'יחידה עובדת רציף' } },
    { t: 'ממיר תדר נופל בתקלה', d: 'industrial', f: { system: 'מסוע', supply: '400VAC תלת-פאזי', model: 'ABB ACS580 · מנוע 5.5kW', parts: 'ממיר תדר, מנוע M1', symptoms: 'הממיר נופל בתקלת Overcurrent (2310) שניות אחרי ההתנעה, רק כשהמסוע עמוס.', expected: 'התנעה רכה והגעה ל-50Hz', history: 'הוחלף מנוע לפני חודש' } }
  ];

  /* ---------- ניווט ---------- */

  function route() {
    var h = location.hash.replace('#', '') || 'diagnose';
    var m = h.match(/^case\/(.+)$/);
    var view = m ? 'diagnose' : h;
    if (!$('#view-' + view)) view = 'diagnose';
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== view; });
    $$('.mainnav a').forEach(function (a) { a.classList.toggle('active', a.dataset.view === view); a.setAttribute('aria-current', a.dataset.view === view ? 'page' : 'false'); });
    if (view === 'tools') window.FixCalc.mount($('#tools'));
    if (view === 'cases') renderCases();
    if (view === 'design' && window.FixDesign) window.FixDesign.show();
    if (view === 'home' && window.FixHome) window.FixHome.show();
    if (view === 'plan' && window.FixPlan) window.FixPlan.show();
    if (m) openCase(m[1]);
    else if (view === 'diagnose' && !state.busy) showIntake();
  }

  function showIntake() {
    $('#intake').hidden = false;
    $('#caseView').hidden = true;
    state.current = null;
  }

  /* ---------- חיבור לשרת ---------- */

  function checkStatus() {
    var badge = $('#aiBadge');
    var ctl = new AbortController();
    setTimeout(function () { ctl.abort(); }, 5000);
    fetch('api/status', { signal: ctl.signal, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (s) {
        state.ai = !!s.ai; state.needCode = !!s.needCode; state.model = s.model || '';
        badge.textContent = s.ai ? 'מחובר ל-Claude' : 'מצב העתק-הדבק';
        badge.className = 'ai-badge ' + (s.ai ? 'on' : 'off');
        badge.title = s.ai ? 'המודל: ' + s.model : 'השרת פועל בלי מפתח API';
      })
      .catch(function () {
        state.ai = false;
        badge.textContent = 'מצב העתק-הדבק';
        badge.className = 'ai-badge off';
        badge.title = 'אין שרת — אפשר לעבוד עם claude.ai בהעתק-הדבק';
      });
  }

  /* ---------- קבצים ---------- */

  function readAs(file, how) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      if (how === 'text') r.readAsText(file); else r.readAsDataURL(file);
    });
  }

  function shrinkImage(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, MAX_IMG / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  function addFiles(list, target, host) {
    var jobs = Array.prototype.map.call(list, function (f) {
      if (f.size > MAX_FILE) { toast('הקובץ ' + f.name + ' גדול מ-20MB', true); return null; }
      if (/^image\//.test(f.type)) {
        return readAs(f).then(shrinkImage).then(function (url) {
          if (!url) { toast('לא הצלחנו לקרוא את התמונה ' + f.name, true); return null; }
          return { id: uid(), name: f.name, type: 'image/jpeg', data: url.split(',')[1] };
        });
      }
      if (f.type === 'application/pdf') {
        return readAs(f).then(function (url) { return { id: uid(), name: f.name, type: 'application/pdf', data: url.split(',')[1] }; });
      }
      return readAs(f, 'text').then(function (t) { return { id: uid(), name: f.name, type: 'text/plain', data: t }; });
    });
    return Promise.all(jobs).then(function (files) {
      files.forEach(function (f) { if (f) target.push(f); });
      renderFiles(target, host);
    });
  }

  function fileThumb(f) {
    if (/^image\//.test(f.type)) return '<img src="data:' + f.type + ';base64,' + f.data + '" alt="">';
    return '<span class="doc">' + (f.type === 'application/pdf' ? 'PDF' : 'TXT') + '</span>';
  }

  function renderFiles(list, host) {
    host.innerHTML = list.map(function (f) {
      return '<figure class="file" data-id="' + f.id + '">' + fileThumb(f) + '<figcaption>' + esc(f.name) + '</figcaption>' +
        '<button type="button" class="x" aria-label="הסרת ' + esc(f.name) + '">×</button></figure>';
    }).join('');
    $$('.x', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.parentNode.dataset.id;
        var i = list.findIndex(function (f) { return f.id === id; });
        if (i >= 0) list.splice(i, 1);
        renderFiles(list, host);
      });
    });
  }

  function wireDrop(zone, input, list, host) {
    input.addEventListener('change', function () { addFiles(input.files, list, host); input.value = ''; });
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { zone.addEventListener(e, function () { zone.classList.remove('over'); }); });
    zone.addEventListener('drop', function (ev) { ev.preventDefault(); addFiles(ev.dataTransfer.files, list, host); });
  }

  /* ---------- טופס פתיחה ---------- */

  function buildIntake() {
    $('#domains').innerHTML = Object.keys(P.DOMAINS).map(function (k) {
      var d = P.DOMAINS[k];
      return '<label class="domain"><input type="radio" name="domain" value="' + k + '"' + (k === state.domain ? ' checked' : '') + '>' +
        '<span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + DOMAIN_ICONS[k] + '</svg>' +
        '<b>' + d.label + '</b><small>' + d.hint + '</small></span></label>';
    }).join('');
    $$('input[name=domain]').forEach(function (r) { r.addEventListener('change', function () { state.domain = r.value; }); });

    $('#supplies').innerHTML = P.SUPPLIES.map(function (s) { return '<option value="' + s + '">'; }).join('');

    $('#examples').innerHTML = EXAMPLES.map(function (e, i) { return '<button type="button" class="chip" data-i="' + i + '">' + e.t + '</button>'; }).join('');
    $$('#examples .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var e = EXAMPLES[+b.dataset.i], form = $('#intakeForm');
        form.reset();
        state.domain = e.d;
        $('input[name=domain][value=' + e.d + ']').checked = true;
        Object.keys(e.f).forEach(function (k) { if (form.elements[k]) form.elements[k].value = e.f[k]; });
        $('#f-symptoms').focus();
      });
    });

    wireDrop($('#drop'), $('#f-files'), state.intakeFiles, $('#intakeFiles'));

    $('#intakeForm').addEventListener('reset', function () {
      state.intakeFiles.length = 0;
      renderFiles(state.intakeFiles, $('#intakeFiles'));
    });

    $('#intakeForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var form = ev.target;
      var sym = $('#f-symptoms');
      if (!sym.value.trim()) { sym.focus(); sym.setAttribute('aria-invalid', 'true'); toast('תארו מה קורה — זה השדה החשוב ביותר', true); return; }
      sym.removeAttribute('aria-invalid');
      var f = { domain: state.domain };
      ['system', 'model', 'supply', 'parts', 'symptoms', 'expected', 'history', 'measurements', 'wiring', 'tools'].forEach(function (k) { f[k] = form.elements[k].value; });
      f.wantSchematic = form.elements.wantSchematic.checked;
      var c = {
        id: uid(), created: Date.now(), domain: state.domain, form: f,
        title: (f.parts || f.system || f.symptoms).slice(0, 70),
        turns: [{ role: 'user', text: P.formatIntake(f), files: state.intakeFiles.slice(), at: Date.now() }]
      };
      form.reset();
      Store.save(c).then(function () {
        state.current = c;
        history.replaceState(null, '', '#case/' + c.id);
        showCase(c);
        runDiagnosis();
        updateCount();
      });
    });
  }

  /* ---------- תיק ---------- */

  function openCase(id) {
    if (state.current && state.current.id === id) { showCase(state.current); return; }
    Store.get(id).then(function (c) {
      if (!c) { toast('התיק לא נמצא', true); location.hash = '#diagnose'; return; }
      state.current = c;
      showCase(c);
    });
  }

  function lastResult(c) {
    for (var i = c.turns.length - 1; i >= 0; i--) if (c.turns[i].role === 'assistant') return c.turns[i];
    return null;
  }

  function showCase(c) {
    $('#intake').hidden = true;
    $('#caseView').hidden = false;
    var last = lastResult(c);
    $('#caseTitle').textContent = last ? last.result.title : c.title;
    var dom = P.DOMAINS[c.domain] || P.DOMAINS.other;
    var rounds = c.turns.filter(function (t) { return t.role === 'assistant'; }).length;
    $('#caseMeta').innerHTML = esc(dom.label) + ' · נפתח ' + esc(when(c.created)) + ' · ' + rounds + ' סבבי אבחון';
    renderTimeline(c);
    if (!state.busy && c.turns[c.turns.length - 1].role === 'user') showPending(state.lastError);
    state.lastError = null;
    $('#composer').hidden = !!state.busy || !last;
    window.scrollTo({ top: 0 });
  }

  function renderTimeline(c) {
    var host = $('#timeline');
    var lastIdx = -1;
    c.turns.forEach(function (t, i) { if (t.role === 'assistant') lastIdx = i; });
    host.innerHTML = '';
    c.turns.forEach(function (t, i) {
      var el = document.createElement('article');
      if (t.role === 'user') {
        el.className = 'turn user';
        el.innerHTML = '<header><span class="who">' + (i === 0 ? 'פתיחת התיק' : 'עדכון ממך') + '</span><time>' + esc(when(t.at || c.created)) + '</time></header>' +
          '<div class="turn-text">' + esc(t.text).replace(/^## (.*)$/m, '') + '</div>' +
          (t.files && t.files.length ? '<div class="files readonly">' + t.files.map(function (f) { return '<figure class="file">' + fileThumb(f) + '<figcaption>' + esc(f.name) + '</figcaption></figure>'; }).join('') + '</div>' : '');
      } else {
        el.className = 'turn ai' + (i === lastIdx ? ' latest' : ' old');
        el.appendChild(renderResult(t, i === lastIdx, i));
      }
      host.appendChild(el);
    });
  }

  function section(title, body, cls) {
    return '<section class="rsec ' + (cls || '') + '"><h3>' + title + '</h3>' + body + '</section>';
  }

  function renderResult(turn, latest, index) {
    var r = turn.result, wrap = document.createElement('div');
    var dg = DANGER[r.danger] || DANGER.medium;
    var conf = Math.max(0, Math.min(100, r.confidence | 0));
    var html = '';

    html += '<header class="rhead"><div><span class="who">אבחון ' + (turn.revisions ? '· תוקן אחרי בדיקה אוטומטית' : '') + '</span><h3 class="rtitle">' + esc(r.title) + '</h3></div>' +
      '<div class="rbadges"><span class="danger ' + dg.cls + '">' + dg.label + '</span>' +
      '<span class="conf" title="רמת הביטחון באבחנה"><span class="meter"><i style="width:' + conf + '%"></i></span>ביטחון ' + conf + '%</span></div></header>';
    html += '<p class="summary">' + esc(r.summary) + '</p>';

    if (!latest) {
      html += '<details class="older"><summary>הצגת כל הפרטים של סבב זה</summary><div class="older-body"></div></details>';
      wrap.innerHTML = html;
      var body = $('.older-body', wrap);
      $('.older', wrap).addEventListener('toggle', function () { if (!body.childElementCount) body.appendChild(details(turn, false, index)); }, { once: true });
      return wrap;
    }
    wrap.innerHTML = html;
    wrap.appendChild(details(turn, true, index));
    return wrap;
  }

  function details(turn, latest, index) {
    var r = turn.result, box = document.createElement('div');
    var html = '';

    if (r.safety.length) {
      html += '<aside class="safety" role="note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 17.5v.5" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/></svg><div><b>בטיחות</b><ul>' +
        r.safety.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div></aside>';
    }
    if (r.observations.length) {
      html += section('מה זיהיתי בקבצים ובתיאור', '<ul class="bullets">' + r.observations.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>');
    }
    if (r.causes.length) {
      var causes = r.causes.slice().sort(function (a, b) { return b.likelihood - a.likelihood; });
      html += section('סיבות אפשריות', '<ol class="causes">' + causes.map(function (c) {
        var l = Math.max(0, Math.min(100, c.likelihood | 0));
        return '<li><div class="cause-top"><b>' + esc(c.title) + '</b><span class="lk">' + l + '%</span></div>' +
          '<span class="bar"><i style="width:' + l + '%"></i></span>' +
          '<p>' + esc(c.explanation) + '</p>' + (c.how_to_confirm ? '<p class="confirm"><b>איך לאמת:</b> ' + esc(c.how_to_confirm) + '</p>' : '') + '</li>';
      }).join('') + '</ol>');
    }
    if (r.tests.length) {
      html += section('בדיקות מדידה', '<div class="table-wrap"><table class="table tests"><thead><tr><th>#</th><th>בדיקה</th><th>איפה</th><th>מכשיר</th><th>ערך תקין</th><th>אם חריג</th>' + (latest ? '<th>מה מדדת</th>' : '') + '</tr></thead><tbody>' +
        r.tests.map(function (t, i) {
          return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(t.step) + '</td><td class="mono" dir="auto">' + esc(t.location) + '</td><td>' + esc(t.instrument) + '</td><td class="mono" dir="auto">' + esc(t.expected) + '</td><td>' + esc(t.if_abnormal) + '</td>' +
            (latest ? '<td><input class="measure" data-i="' + i + '" dir="auto" aria-label="תוצאת בדיקה ' + (i + 1) + '" placeholder="ערך / הערה"></td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>', 'tests-sec');
    }
    if (r.clarifying_questions.length) {
      html += section('שאלות להשלמת האבחנה', '<ol class="questions">' + r.clarifying_questions.map(function (q, i) {
        return '<li><p>' + esc(q) + '</p>' + (latest ? '<input class="answer" data-i="' + i + '" dir="auto" aria-label="תשובה לשאלה ' + (i + 1) + '" placeholder="התשובה שלך">' : '') + '</li>';
      }).join('') + '</ol>');
    }
    if (r.solution.length) {
      html += section('הפתרון', '<ol class="solution">' + r.solution.map(function (s) {
        return '<li><b>' + esc(s.action) + '</b>' + (s.detail ? '<p>' + esc(s.detail) + '</p>' : '') + '</li>';
      }).join('') + '</ol>');
    }
    if (r.parts.length) {
      html += section('חלקים וחומרים', '<div class="table-wrap"><table class="table"><thead><tr><th>פריט</th><th>מפרט</th><th>כמות</th></tr></thead><tbody>' +
        r.parts.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="mono" dir="auto">' + esc(p.spec) + '</td><td>' + esc(p.qty) + '</td></tr>'; }).join('') + '</tbody></table></div>');
    }
    if (r.verification.length) {
      var icon = { ok: '✓', warning: '!', fail: '✕' };
      html += section('בדיקת הפתרון', '<ul class="verify">' + r.verification.map(function (v) {
        return '<li class="' + esc(v.result) + '"><span class="vi" aria-label="' + esc(v.result) + '">' + (icon[v.result] || '?') + '</span><div><b>' + esc(v.check) + '</b>' + (v.note ? '<p>' + esc(v.note) + '</p>' : '') + '</div></li>';
      }).join('') + '</ul>');
    }
    box.innerHTML = html;

    if (r.schematic && r.schematic.needed && r.schematic.components.length) box.appendChild(renderSchematic(r.schematic, turn.checks || N.check(r.schematic), index));

    if (r.standards.length) {
      var st = document.createElement('div');
      st.innerHTML = section('תקנים וכללים', '<ul class="tags">' + r.standards.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>');
      box.appendChild(st.firstChild);
    }
    if (turn.model) {
      var meta = document.createElement('p');
      meta.className = 'rmeta';
      meta.textContent = 'נוצר ' + when(turn.at) + ' · ' + turn.model;
      box.appendChild(meta);
    }
    if (latest) $$('.measure, .answer', box).forEach(function (i) { i.addEventListener('input', updateAutoNote); });
    return box;
  }

  /* ---------- סכימה ---------- */

  function renderSchematic(sch, checks, index) {
    var sec = document.createElement('section');
    sec.className = 'rsec schematic';
    var issues = checks.issues || [];
    var errs = issues.filter(function (i) { return i.level === 'error'; }).length;
    var warns = issues.length - errs;
    var status = errs ? '<span class="chk bad">' + errs + ' שגיאות</span>' : '<span class="chk good">לא נמצאו קצרים או שגיאות חיווט</span>';
    if (warns) status += '<span class="chk warn">' + warns + ' הערות</span>';

    sec.innerHTML = '<div class="sch-head"><h3>סכימת חיווט</h3><div class="sch-tools">' +
      '<button class="btn ghost small" type="button" data-z="-1" aria-label="הקטנה">−</button><button class="btn ghost small" type="button" data-z="0">התאמה</button><button class="btn ghost small" type="button" data-z="1" aria-label="הגדלה">+</button>' +
      '<button class="btn ghost small" type="button" data-dl="svg">SVG</button><button class="btn ghost small" type="button" data-dl="png">PNG</button>' +
      '<button class="btn ghost small" type="button" data-edit>עריכה בעורך</button></div></div>' +
      '<div class="auto-check"><b>בדיקה אוטומטית:</b> ' + status + ' <span class="muted">' + checks.stats.components + ' רכיבים · ' + checks.stats.wires + ' חוטים · ' + checks.stats.nets + ' צמתים</span></div>' +
      (issues.length ? '<ul class="issues">' + issues.map(function (i) { return '<li class="' + i.level + '">' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="sch-canvas" tabindex="0" aria-label="סכימת החיווט. אפשר לגלול."><div class="sch-inner">' + N.render(sch, { issues: issues }) + '</div></div>' +
      (sch.notes.length ? '<ul class="bullets sch-notes">' + sch.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<details class="wire-table" open><summary>טבלת חיווט (' + sch.wires.length + ' חוטים)</summary><div class="table-wrap"><table class="table"><thead><tr><th>מס׳ חוט</th><th>מ-</th><th>אל</th><th>צבע</th><th>חתך</th></tr></thead><tbody>' +
      N.wireTable(sch).map(function (w) {
        var sw = w.hex.stripe ? 'background:repeating-linear-gradient(90deg,' + w.hex.main + ' 0 6px,' + w.hex.stripe + ' 6px 12px)' : 'background:' + w.hex.main;
        return '<tr><td class="mono">' + esc(w.label || w.n) + '</td><td><span class="mono" dir="ltr">' + esc(w.from) + '</span><small>' + esc(w.fromName) + '</small></td><td><span class="mono" dir="ltr">' + esc(w.to) + '</span><small>' + esc(w.toName) + '</small></td>' +
          '<td><span class="swatch" style="' + sw + '"></span>' + esc(w.color) + '</td><td class="mono">' + esc(w.section) + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';

    var inner = $('.sch-inner', sec), svg = $('svg', inner), zoom = 1;
    var baseW = svg ? +svg.getAttribute('width') : 0;
    function applyZoom() { if (svg) { svg.style.width = (baseW * zoom) + 'px'; svg.style.height = 'auto'; } }
    function fit() {
      var avail = $('.sch-canvas', sec).clientWidth - 8;
      zoom = avail > 0 && baseW ? Math.min(1, avail / baseW) : 1;
      applyZoom();
    }
    requestAnimationFrame(fit);
    $$('[data-z]', sec).forEach(function (b) {
      b.addEventListener('click', function () {
        var z = +b.dataset.z;
        if (!z) fit(); else { zoom = Math.max(0.3, Math.min(3, zoom * (z > 0 ? 1.25 : 0.8))); applyZoom(); }
      });
    });
    $$('[data-dl]', sec).forEach(function (b) {
      b.addEventListener('click', function () { download(svg, b.dataset.dl, 'wiring-' + (index + 1)); });
    });
    $('[data-edit]', sec).addEventListener('click', function () {
      if (!window.FixDesign) return;
      window.FixDesign.load(JSON.parse(JSON.stringify(sch)), sch.title || 'סכימה מאבחון');
      location.hash = '#design';
    });
    return sec;
  }

  function download(svg, kind, name) {
    if (!svg) return;
    var src = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([src], { type: 'image/svg+xml' });
    if (kind === 'svg') return save(blob, name + '.svg');
    var img = new Image(), url = URL.createObjectURL(blob);
    img.onload = function () {
      var w = +svg.getAttribute('width'), h = +svg.getAttribute('height'), s = 2;
      var c = document.createElement('canvas');
      c.width = w * s; c.height = h * s;
      var g = c.getContext('2d');
      g.scale(s, s); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { save(b, name + '.png'); }, 'image/png');
    };
    img.src = url;
  }
  function save(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- המשך אבחון ---------- */

  function collected() {
    var last = state.current && lastResult(state.current);
    if (!last) return '';
    var r = last.result, lines = [];
    $$('#timeline .latest .measure').forEach(function (i) {
      var v = i.value.trim();
      if (v) lines.push('בדיקה ' + (+i.dataset.i + 1) + ' (' + r.tests[+i.dataset.i].step + '): ' + v);
    });
    $$('#timeline .latest .answer').forEach(function (i) {
      var v = i.value.trim();
      if (v) lines.push('שאלה: ' + r.clarifying_questions[+i.dataset.i] + '\nתשובה: ' + v);
    });
    return lines.join('\n');
  }

  function updateAutoNote() {
    var n = $$('#timeline .latest .measure, #timeline .latest .answer').filter(function (i) { return i.value.trim(); }).length;
    $('#composer .hint').textContent = n
      ? n + ' תוצאות ותשובות מהטבלה יצורפו אוטומטית להודעה.'
      : 'מדדתם? ענו על השאלות או מלאו ערכים בטבלת הבדיקות למעלה. הם יתווספו לכאן אוטומטית.';
  }

  function buildComposer() {
    wireDrop($('#composer'), $('#followInput'), state.followFiles, $('#followFiles'));
    $('#composer').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (state.busy || !state.current) return;
      var auto = collected();
      var text = [$('#followText').value.trim(), auto ? '## תוצאות מדידה ותשובות\n' + auto : ''].filter(Boolean).join('\n\n');
      if ($('#followSchem').checked) text += '\n\nבקשה: שרטט סכימת חיווט תקינה ומעודכנת.';
      if (!text.trim() && !state.followFiles.length) { toast('כתבו מה מדדתם או מה השתנה', true); $('#followText').focus(); return; }
      state.current.turns.push({ role: 'user', text: text, files: state.followFiles.slice(), at: Date.now() });
      $('#followText').value = '';
      $('#followSchem').checked = false;
      state.followFiles.length = 0;
      renderFiles(state.followFiles, $('#followFiles'));
      Store.save(state.current).then(function () { showCase(state.current); runDiagnosis(); });
    });
  }

  /* ---------- הרצת אבחון ---------- */

  function setPhase(phase, text) {
    $$('#phases li').forEach(function (li) {
      var order = ['analyze', 'revise', 'done'];
      li.className = order.indexOf(li.dataset.phase) < order.indexOf(phase) ? 'past' : li.dataset.phase === phase ? 'now' : '';
    });
    if (text) $('#progressText').textContent = text;
  }

  function busy(on) {
    state.busy = on;
    $('#progress').hidden = !on;
    $('#composer').hidden = !!on || !state.current || !lastResult(state.current);
    if (on) {
      $$('#timeline .retry').forEach(function (el) { el.remove(); });
      $('#thinkingBox').hidden = true;
      $('#thinkingText').textContent = '';
      $('#progressTitle').textContent = 'Claude מאבחן את התקלה…';
      setPhase('analyze', 'קורא את התיאור והקבצים');
      $('#progress').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function runDiagnosis() {
    if (!state.ai) return openManual();
    var c = state.current;
    var ctl = new AbortController();
    busy(ctl);
    var headers = { 'content-type': 'application/json' };
    if (state.code) headers['x-access-code'] = state.code;
    var turns = c.turns.map(function (t) { return t.role === 'assistant' ? { role: 'assistant', result: t.result } : { role: 'user', text: t.text, files: t.files }; });
    var final = null, failed = null, started = Date.now();
    var tick = setInterval(function () {
      var s = Math.round((Date.now() - started) / 1000);
      $('#progressTitle').textContent = 'Claude מאבחן את התקלה… ' + s + ' שנ׳';
    }, 1000);

    fetch('api/diagnose', { method: 'POST', headers: headers, body: JSON.stringify({ turns: turns }), signal: ctl.signal })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (j.needCode) { state.needCode = true; askCode(); }
            throw new Error(j.error || 'שגיאת שרת ' + r.status);
          });
        }
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (ln) { if (ln.trim()) handle(JSON.parse(ln)); });
            return pump();
          });
        }
        return pump();
      })
      .then(function () { if (!final && !failed) throw new Error('החיבור נסגר לפני שהתקבלה תשובה'); })
      .catch(function (e) { failed = failed || (ctl.signal.aborted ? 'האבחון נעצר' : e.message); })
      .then(function () {
        clearInterval(tick);
        busy(null);
        if (failed) {
          // הסבב לא הושלם: מחזירים את ההודעה האחרונה לעריכה ולא משאירים תור בלי תשובה
          var lastTurn = c.turns[c.turns.length - 1];
          if (lastTurn.role === 'user' && c.turns.length > 1) {
            c.turns.pop();
            $('#followText').value = lastTurn.text;
            lastTurn.files.forEach(function (f) { state.followFiles.push(f); });
            renderFiles(state.followFiles, $('#followFiles'));
          }
          Store.save(c);
          state.lastError = failed;
          showCase(c);
          toast(failed, true);
          return;
        }
        c.turns.push({ role: 'assistant', result: final.result, checks: final.checks, revisions: final.revisions, model: final.model, at: Date.now() });
        c.title = final.result.title || c.title;
        c.danger = final.result.danger;
        Store.save(c).then(function () { showCase(c); updateCount(); });
      });

    function handle(m) {
      if (m.error) { failed = m.error; return; }
      if (m.thinking) {
        var box = $('#thinkingBox'), t = $('#thinkingText');
        box.hidden = false;
        t.textContent = (t.textContent + m.thinking).slice(-4000);
      }
      if (m.chars) $('#progressText').textContent = 'כותב את האבחנה… ' + m.chars.toLocaleString('he-IL') + ' תווים';
      if (m.phase === 'revise') setPhase('revise', 'הבודק האוטומטי מצא ' + m.issues.filter(function (i) { return i.level === 'error'; }).length + ' שגיאות בסכימה — Claude מתקן');
      if (m.phase === 'done') { setPhase('done', 'מסיים'); final = m; }
    }
  }

  function showPending(msg) {
    var el = document.createElement('div');
    el.className = 'card retry';
    el.innerHTML = '<p><b>' + (msg ? 'האבחון לא הושלם.' : 'עדיין אין אבחנה לתיאור הזה.') + '</b> ' + esc(msg || '') + '</p><button class="btn primary small" type="button">' + (msg ? 'ניסיון נוסף' : 'הרצת אבחון') + '</button>';
    $('button', el).addEventListener('click', function () { el.remove(); runDiagnosis(); });
    $('#timeline').appendChild(el);
  }

  $('#stopBtn').addEventListener('click', function () { if (state.busy && state.busy.abort) state.busy.abort(); });

  /* ---------- מצב העתק-הדבק ---------- */

  function openManual() {
    var dlg = $('#manualDlg');
    $('#manualPaste').value = '';
    $('#manualError').textContent = '';
    dlg.showModal();
  }

  function buildManual() {
    $('#copyPrompt').addEventListener('click', function () {
      var c = state.current;
      var turns = c.turns.map(function (t) { return t.role === 'assistant' ? { role: 'assistant', result: t.result } : t; });
      copy(P.manualPrompt(turns), 'ההנחיה הועתקה. הדביקו אותה ב-claude.ai וצרפו את התמונות.');
    });
    $('#manualApply').addEventListener('click', function () {
      var result;
      try { result = P.parseResult($('#manualPaste').value); } catch (e) { $('#manualError').textContent = 'לא הצלחנו לקרוא את התשובה: ' + e.message; return; }
      var c = state.current;
      c.turns.push({ role: 'assistant', result: result, checks: N.check(result.schematic), revisions: 0, model: 'claude.ai (העתק-הדבק)', at: Date.now() });
      c.title = result.title || c.title;
      c.danger = result.danger;
      $('#manualDlg').close();
      Store.save(c).then(function () { showCase(c); updateCount(); });
    });
    $('#manualDlg').addEventListener('close', function () {
      var c = state.current;
      if (c && c.turns[c.turns.length - 1].role === 'user') showCase(c);
    });
  }

  function copy(text, ok) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { toast(ok); })
      .catch(function () {
        var t = document.createElement('textarea');
        t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); toast(ok); } catch (e) { toast('ההעתקה נכשלה', true); }
        t.remove();
      });
  }

  function askCode() {
    var dlg = $('#codeDlg');
    $('#codeInput').value = state.code;
    dlg.showModal();
    dlg.addEventListener('close', function once() {
      dlg.removeEventListener('close', once);
      if (dlg.returnValue === 'ok') { state.code = $('#codeInput').value.trim(); safeSet('fix-access-code', state.code); toast('הקוד נשמר. נסו שוב.'); }
    });
  }

  /* ---------- דו"ח ---------- */

  function reportText(c) {
    var out = ['מעגל סגור — דו״ח תקלה', (P.DOMAINS[c.domain] || {}).label + ' · ' + when(c.created), ''];
    c.turns.forEach(function (t) {
      if (t.role === 'user') { out.push('— תיאור / עדכון —', t.text, ''); return; }
      var r = t.result;
      out.push('— אבחנה: ' + r.title + ' —', (DANGER[r.danger] || {}).label + ' · ביטחון ' + r.confidence + '%', r.summary, '');
      if (r.safety.length) out.push('בטיחות:', r.safety.map(function (s) { return '• ' + s; }).join('\n'), '');
      if (r.causes.length) out.push('סיבות אפשריות:', r.causes.map(function (x) { return '• ' + x.title + ' (' + x.likelihood + '%) — ' + x.explanation; }).join('\n'), '');
      if (r.tests.length) out.push('בדיקות:', r.tests.map(function (x, i) { return (i + 1) + '. ' + x.step + ' | ' + x.location + ' | ' + x.instrument + ' | תקין: ' + x.expected; }).join('\n'), '');
      if (r.solution.length) out.push('פתרון:', r.solution.map(function (x, i) { return (i + 1) + '. ' + x.action + (x.detail ? ' — ' + x.detail : ''); }).join('\n'), '');
      if (r.parts.length) out.push('חלקים:', r.parts.map(function (x) { return '• ' + x.name + ' — ' + x.spec + ' × ' + x.qty; }).join('\n'), '');
      if (r.schematic && r.schematic.needed) out.push('טבלת חיווט:', N.wireTable(r.schematic).map(function (w) { return (w.label || w.n) + ': ' + w.from + ' → ' + w.to + ' · ' + w.color + ' ' + w.section; }).join('\n'), '');
    });
    return out.join('\n');
  }

  /* ---------- רשימת תיקים ---------- */

  function renderCases() {
    var q = $('#caseSearch').value.trim().toLowerCase(), dom = $('#caseFilter').value;
    Store.all().then(function (list) {
      var shown = list.filter(function (c) {
        if (dom && c.domain !== dom) return false;
        if (!q) return true;
        return JSON.stringify([c.title, c.form, c.turns.map(function (t) { return t.text || (t.result && t.result.summary); })]).toLowerCase().indexOf(q) >= 0;
      });
      var host = $('#caseList');
      if (!list.length) { host.innerHTML = '<div class="empty card"><p>עדיין אין תיקים.</p><a class="btn primary" href="#diagnose">פתיחת תקלה ראשונה</a></div>'; return; }
      if (!shown.length) { host.innerHTML = '<p class="muted">לא נמצאו תיקים מתאימים.</p>'; return; }
      host.innerHTML = shown.map(function (c) {
        var last = lastResult(c), dg = DANGER[c.danger] || null;
        var rounds = c.turns.filter(function (t) { return t.role === 'assistant'; }).length;
        return '<article class="card case-card"><a href="#case/' + c.id + '" class="case-link"><span class="case-dom">' + esc((P.DOMAINS[c.domain] || P.DOMAINS.other).label) + '</span>' +
          '<h2>' + esc(last ? last.result.title : c.title) + '</h2><p>' + esc(last ? last.result.summary : 'ממתין לאבחון').slice(0, 180) + '</p></a>' +
          '<footer>' + (dg ? '<span class="danger ' + dg.cls + '">' + dg.label + '</span>' : '<span class="danger none">ללא אבחנה</span>') +
          '<span class="muted">' + rounds + ' סבבים · ' + esc(when(c.updated)) + '</span>' +
          '<button class="btn ghost small del" type="button" data-id="' + c.id + '" aria-label="מחיקת התיק">מחיקה</button></footer></article>';
      }).join('');
      $$('.del', host).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('למחוק את התיק לצמיתות?')) return;
          Store.remove(b.dataset.id).then(function () { renderCases(); updateCount(); });
        });
      });
    });
  }

  function updateCount() {
    Store.all().then(function (l) { $('#caseCount').textContent = l.length ? l.length : ''; });
  }

  /* ---------- מקרא ---------- */

  function buildLegend() {
    var rows = [
      ['L1 / L2 / L3 — פאזות', 'חום, שחור, אפור'], ['N — אפס', 'כחול'], ['PE — הארקה', 'ירוק-צהוב'],
      ['פיקוד AC', 'אדום'], ['פיקוד DC (+24V / 0V)', 'כחול כהה'], ['מתח זר (מהזנה חיצונית)', 'כתום']
    ];
    $('#colorLegend').innerHTML = rows.map(function (r) {
      var colors = r[1].split(',').map(function (c) {
        var h = N.wireColor(c.trim());
        var bg = h.stripe ? 'repeating-linear-gradient(90deg,' + h.main + ' 0 7px,' + h.stripe + ' 7px 14px)' : h.main;
        return '<span class="wire-sample" style="background:' + bg + '" title="' + c.trim() + '"></span>';
      }).join('');
      return '<li><span class="samples">' + colors + '</span><b>' + r[0] + '</b><span class="muted">' + r[1] + '</span></li>';
    }).join('');
    $('#caseFilter').innerHTML = '<option value="">כל התחומים</option>' + Object.keys(P.DOMAINS).map(function (k) { return '<option value="' + k + '">' + P.DOMAINS[k].label + '</option>'; }).join('');
  }

  /* ---------- התחלה ---------- */

  // כלים משותפים לעורך הכרטיסים (design.js)
  window.FixApp = {
    state: state, toast: toast, copy: copy, askCode: askCode, download: download, save: save, esc: esc, when: when
  };

  buildIntake();
  buildComposer();
  buildManual();
  buildLegend();
  checkStatus();
  updateCount();

  $('#newCaseBtn').addEventListener('click', function () { location.hash = '#diagnose'; showIntake(); });
  $('#printBtn').addEventListener('click', function () {
    $$('#timeline details').forEach(function (d) { d.open = true; });
    setTimeout(function () { window.print(); }, 150);
  });
  $('#copyBtn').addEventListener('click', function () { if (state.current) copy(reportText(state.current), 'הדו״ח הועתק'); });
  $('#caseSearch').addEventListener('input', renderCases);
  $('#caseFilter').addEventListener('change', renderCases);
  window.addEventListener('hashchange', route);
  route();
})();
