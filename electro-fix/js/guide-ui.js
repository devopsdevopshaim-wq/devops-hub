/* מעגל סגור — מדריכים ללקוחות: ספריית הדרכות, נגן שלבים עם איורים והקראה, והדרכה מותאמת מ-Claude. */
(function () {
  'use strict';

  var G = window.Guides, I = window.Illus, FP = window.FixPrompts, A = window.FixApp;
  var esc = A.esc;
  var st = { guide: null, node: null, path: [], mounted: false, speaking: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var CALLS = {
    '102': { label: 'כבאות 102', href: 'tel:102', cls: 'bad' },
    '101': { label: 'מד״א 101', href: 'tel:101', cls: 'bad' },
    '103': { label: 'חברת החשמל 103', href: 'tel:103', cls: '' },
    electrician: { label: 'חיפוש חשמלאי מוסמך בקרבתי', href: 'https://www.google.com/maps/search/%D7%97%D7%A9%D7%9E%D7%9C%D7%90%D7%99+%D7%9E%D7%95%D7%A1%D7%9E%D7%9A', cls: 'gold', ext: true },
    installer: { label: 'חיפוש מתקין בית חכם', href: 'https://www.google.com/maps/search/%D7%9E%D7%AA%D7%A7%D7%99%D7%9F+%D7%91%D7%99%D7%AA+%D7%97%D7%9B%D7%9D', cls: 'gold', ext: true }
  };

  /* ---------- ספרייה ---------- */

  function card(g) {
    return '<button type="button" class="g-card' + (g.urgent ? ' urgent' : '') + (g.preventive ? ' prev' : '') + '" data-guide="' + g.id + '">' +
      '<span class="g-art">' + I.render(g.icon) + '</span>' +
      '<span class="g-body"><span class="g-meta">' + (g.urgent ? '<b class="g-tag bad">חירום</b>' : g.preventive ? '<b class="g-tag">מניעה</b>' : '<b class="g-tag">' + esc(g.level) + '</b>') + '<span>כ-' + g.time + ' דקות</span></span>' +
      '<b class="g-title">' + esc(g.title) + '</b><span class="g-short">' + esc(g.short) + '</span></span></button>';
  }

  function library(list, note) {
    var host = $('#gMain');
    st.guide = null;
    stopSpeak();
    var urgent = list.filter(function (g) { return g.urgent; }), rest = list.filter(function (g) { return !g.urgent; });
    host.innerHTML = (note ? '<p class="g-note">' + note + '</p>' : '') +
      (urgent.length ? '<h2 class="g-h">מצבי חירום</h2><div class="g-grid">' + urgent.map(card).join('') + '</div>' : '') +
      (rest.length ? '<h2 class="g-h">תקלות נפוצות</h2><div class="g-grid">' + rest.map(card).join('') + '</div>' : '') +
      (!list.length ? '<div class="card empty"><p>לא מצאנו מדריך מוכן שמתאים בדיוק. נסו לנסח אחרת, או בקשו הדרכה מותאמת מ-Claude.</p></div>' : '');
    $$('[data-guide]', host).forEach(function (b) { b.addEventListener('click', function () { openGuide(b.dataset.guide); }); });
  }

  /* ---------- נגן ---------- */

  function openGuide(id, fromLink) {
    var g = G.byId(id);
    if (!g) return;
    st.guide = g;
    st.path = [];
    if (!fromLink && location.hash !== '#help/' + id) history.replaceState(null, '', '#help/' + id);
    go(g.start);
    $('#gMain').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function go(key, back) {
    if (!back && st.node) st.path.push(st.node);
    st.node = key;
    stopSpeak();
    renderStep();
  }

  // אורך המסלול הקצר ביותר מהשלב לסיום — להערכת התקדמות
  function remaining(g, key) {
    var dist = {}, q = [[key, 0]];
    while (q.length) {
      var x = q.shift(), s = g.steps[x[0]];
      if (!s || dist[x[0]] != null) continue;
      dist[x[0]] = x[1];
      if (s.kind) return x[1];
      (s.options || []).map(function (o) { return o.next; }).concat(s.next ? [s.next] : []).forEach(function (n) { q.push([n, x[1] + 1]); });
    }
    return 0;
  }

  function renderStep() {
    var g = st.guide, s = g.steps[st.node], host = $('#gMain');
    var done = st.path.length, left = remaining(g, st.node), pct = s.kind ? 100 : Math.round(done / (done + left + 1) * 100);
    var cls = s.kind === 'stop' ? 'stop' : s.kind === 'done' ? 'done' : s.kind === 'link' ? 'link' : '';
    var body = '';
    if (s.tips && s.tips.length) body += '<ul class="g-tips">' + s.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (s.warn) body += '<p class="g-warn">' + esc(s.warn) + '</p>';
    var actions = '';
    if (s.options) actions = '<div class="g-opts">' + s.options.map(function (o, i) { return '<button type="button" class="g-opt ' + (o.tone || '') + '" data-opt="' + i + '">' + esc(o.label) + '</button>'; }).join('') + '</div>';
    else if (s.next) actions = '<div class="g-opts"><button type="button" class="btn primary g-next" data-next>עשיתי — לשלב הבא</button></div>';
    else if (s.kind === 'link') actions = '<div class="g-opts"><button type="button" class="btn primary g-next" data-link="' + s.guide + '">המשך להדרכה: ' + esc(G.byId(s.guide).title) + '</button></div>';
    else if (s.kind === 'stop') actions = '<div class="g-calls">' + (s.call || ['electrician']).map(function (k) { var c = CALLS[k]; return '<a class="g-call ' + c.cls + '" href="' + c.href + '"' + (c.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.label) + '</a>'; }).join('') + '</div>';
    else if (s.kind === 'done') actions = '<div class="g-opts"><button type="button" class="btn primary" data-home>חזרה לכל המדריכים</button></div>';

    host.innerHTML = '<div class="g-player">' +
      '<div class="g-top"><button type="button" class="btn ghost small" data-home>→ כל המדריכים</button><div class="g-ttl"><b>' + esc(g.title) + '</b><span>' + (s.kind ? '' : 'שלב ' + (done + 1)) + '</span></div>' +
      '<div class="g-tools"><button type="button" class="btn ghost small" data-speak aria-pressed="false">🔊 הקראה</button><button type="button" class="btn ghost small" data-print>הדפסה</button><button type="button" class="btn ghost small" data-share>שיתוף</button></div></div>' +
      '<div class="g-progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<article class="g-step ' + cls + '" aria-live="polite"><div class="g-pic">' + I.render(s.img) + '</div>' +
      '<div class="g-txt">' + (s.kind === 'stop' ? '<span class="g-badge bad">עוצרים כאן</span>' : s.kind === 'done' ? '<span class="g-badge good">סיום</span>' : '') +
      '<h2 id="gStepTitle">' + esc(s.title) + '</h2><p class="g-text">' + esc(s.text) + '</p>' + body + actions +
      (st.path.length ? '<button type="button" class="g-back" data-back>חזרה לשלב הקודם</button>' : '') + '</div></article>' +
      '<p class="g-foot">המדריך כולל רק פעולות בטוחות בלי כלים. בכל ספק — עצרו והתקשרו לחשמלאי מוסמך. בשריפה: 102.</p></div>';

    $$('[data-opt]', host).forEach(function (b) { b.addEventListener('click', function () { go(s.options[+b.dataset.opt].next); }); });
    $$('[data-next]', host).forEach(function (b) { b.addEventListener('click', function () { go(s.next); }); });
    $$('[data-link]', host).forEach(function (b) { b.addEventListener('click', function () { openGuide(b.dataset.link); }); });
    $$('[data-home]', host).forEach(function (b) { b.addEventListener('click', function () { history.replaceState(null, '', '#help'); library(G.GUIDES); }); });
    var back = $('[data-back]', host);
    if (back) back.addEventListener('click', function () { var prev = st.path.pop(); go(prev, true); });
    $('[data-speak]', host).addEventListener('click', function () { st.speaking ? stopSpeak() : speak(s); });
    $('[data-print]', host).addEventListener('click', function () { printGuide(g); });
    $('[data-share]', host).addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#help/' + g.id;
      if (navigator.share && g.id.indexOf('ai-') !== 0) navigator.share({ title: g.title, url: url }).catch(function () {});
      else A.copy(g.id.indexOf('ai-') === 0 ? guideAsText(g) : url, g.id.indexOf('ai-') === 0 ? 'ההדרכה הועתקה' : 'הקישור הועתק');
    });
    var h = $('#gStepTitle');
    if (h) h.focus && h.setAttribute('tabindex', '-1');
  }

  /* ---------- הקראה ---------- */

  function speak(s) {
    if (!('speechSynthesis' in window)) return A.toast('הדפדפן לא תומך בהקראה', true);
    var u = new SpeechSynthesisUtterance(s.title + '. ' + s.text + (s.tips ? '. ' + s.tips.join('. ') : '') + (s.options ? '. האפשרויות: ' + s.options.map(function (o) { return o.label; }).join('. או: ') : ''));
    u.lang = 'he-IL';
    u.rate = 0.92;
    var he = speechSynthesis.getVoices().filter(function (v) { return /^he|iw/i.test(v.lang); })[0];
    if (he) u.voice = he;
    u.onend = stopSpeak;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    st.speaking = true;
    var b = $('[data-speak]');
    if (b) { b.setAttribute('aria-pressed', 'true'); b.textContent = '⏹ עצירת הקראה'; }
  }
  function stopSpeak() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    st.speaking = false;
    var b = $('[data-speak]');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = '🔊 הקראה'; }
  }

  /* ---------- הדפסה ושיתוף ---------- */

  function ordered(g) {
    var out = [], seen = {}, q = [g.start];
    while (q.length) {
      var k = q.shift();
      if (seen[k] || !g.steps[k]) continue;
      seen[k] = 1;
      out.push(k);
      var s = g.steps[k];
      (s.next ? [s.next] : []).concat((s.options || []).map(function (o) { return o.next; })).forEach(function (n) { q.push(n); });
    }
    return out;
  }

  function guideAsText(g) {
    return g.title + '\n\n' + ordered(g).map(function (k, i) { var s = g.steps[k]; return (i + 1) + '. ' + s.title + '\n' + s.text; }).join('\n\n');
  }

  function printGuide(g) {
    var w = window.open('', '_blank');
    if (!w) return A.toast('הדפדפן חסם חלון חדש', true);
    var keys = ordered(g), num = {};
    keys.forEach(function (k, i) { num[k] = i + 1; });
    var body = '<h1>' + esc(g.title) + '</h1><p class="meta">' + esc(g.short) + ' · מעגל סגור</p>' + keys.map(function (k) {
      var s = g.steps[k];
      return '<section class="' + (s.kind || '') + '"><div class="pic">' + I.render(s.img) + '</div><div><h2>' + num[k] + '. ' + esc(s.title) + '</h2><p>' + esc(s.text) + '</p>' +
        (s.tips ? '<ul>' + s.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
        (s.options ? '<ul class="opts">' + s.options.map(function (o) { return '<li>' + esc(o.label) + ' ← שלב ' + num[o.next] + '</li>'; }).join('') + '</ul>' : s.next ? '<p class="nx">← שלב ' + num[s.next] + '</p>' : '') +
        (s.kind === 'link' ? '<p class="nx">← המשך במדריך "' + esc(G.byId(s.guide).title) + '"</p>' : '') + '</div></section>';
    }).join('') + '<p class="meta">חירום: כבאות 102 · מד״א 101 · חברת החשמל 103. המדריך כולל רק פעולות בטוחות בלי כלים.</p>';
    w.document.write('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(g.title) + '</title><style>body{font:14px/1.55 Heebo,Arial,sans-serif;margin:22px;color:#111}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 4px}.meta{color:#666}section{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start;border-bottom:1px solid #e5dccb;padding:12px 0;break-inside:avoid}section.stop h2{color:#b3261e}section.done h2{color:#2b7a3d}.pic svg{width:200px;height:auto}.opts li,.nx{color:#9a6f1f;font-weight:600}@page{size:A4;margin:12mm}</style></head><body>' + body + '<script>setTimeout(function(){print()},300)<\/script></body></html>');
    w.document.close();
  }

  /* ---------- הדרכה מותאמת מ-Claude ---------- */

  function aiToGuide(r) {
    var steps = {}, n = r.steps.length;
    var first = 's0';
    if (r.stop_now) {
      steps.stop0 = { kind: 'stop', title: 'עצרו כאן', text: r.stop_reason || r.summary, img: 'danger-smoke', call: ['102', '101', 'electrician'] };
      first = 'stop0';
    } else {
      r.steps.forEach(function (s, i) {
        steps['s' + i] = { title: s.title, text: s.text, img: s.image, warn: s.warning || '', next: i < n - 1 ? 's' + (i + 1) : 'end' };
      });
      steps.end = { kind: 'stop', title: 'מתי להזמין חשמלאי', text: r.call_pro_when.length ? r.call_pro_when.join(' ') : 'אם הבעיה לא נפתרה בשלבים האלה, הזמינו חשמלאי מוסמך.', img: 'call-electrician', call: ['electrician'] };
    }
    return { id: 'ai-' + Date.now().toString(36), title: r.title, short: r.summary, icon: r.steps[0] ? r.steps[0].image : 'panel-open', time: 5, level: 'מותאם', tags: [], start: first, steps: steps };
  }

  function showAi(r) {
    var g = aiToGuide(r);
    st.guide = g; st.path = []; st.node = null;
    go(g.start);
    if (r.related_guide && r.related_guide !== 'none') {
      var rel = G.byId(r.related_guide);
      var p = document.createElement('p');
      p.className = 'g-note';
      p.innerHTML = 'יש גם מדריך מלא ומפורט לנושא: <button type="button" class="linkish" data-rel="' + rel.id + '">' + esc(rel.title) + '</button>';
      $('#gMain .g-player').prepend(p);
      $('[data-rel]').addEventListener('click', function () { openGuide(rel.id); });
    }
  }

  function askClaude() {
    var problem = $('#gQuery').value.trim();
    if (problem.length < 4) { $('#gQuery').focus(); return A.toast('תארו במשפט מה קרה', true); }
    if (!A.state.ai) {
      $('#gAiPrompt').value = FP.manualGuidePrompt(problem);
      $('#gAiPaste').value = '';
      $('#gAiError').textContent = '';
      $('#gAiDlg').showModal();
      return;
    }
    var host = $('#gMain'), ctl = new AbortController(), final = null, failed = null, started = Date.now();
    host.innerHTML = '<div class="card progress"><div class="pulse" aria-hidden="true"><span></span></div><div class="progress-body"><b id="gpT">מכינים לכם הדרכה…</b><p>Claude כותב שלבים פשוטים ובטוחים</p></div><button class="btn ghost small" type="button" id="gpStop">עצירה</button></div>';
    $('#gpStop').addEventListener('click', function () { ctl.abort(); });
    var tick = setInterval(function () { var t = $('#gpT'); if (t) t.textContent = 'מכינים לכם הדרכה… ' + Math.round((Date.now() - started) / 1000) + ' שנ׳'; }, 1000);
    var headers = { 'content-type': 'application/json' };
    if (A.state.code) headers['x-access-code'] = A.state.code;
    fetch('api/guide', { method: 'POST', headers: headers, signal: ctl.signal, body: JSON.stringify({ problem: problem }) })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { if (j.needCode) A.askCode(); throw new Error(j.error || 'שגיאת שרת ' + r.status); });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (ln) { if (!ln.trim()) return; var m = JSON.parse(ln); if (m.error) failed = m.error; if (m.phase === 'done') final = m; });
            return pump();
          });
        }
        return pump();
      })
      .then(function () { if (!final && !failed) throw new Error('החיבור נסגר לפני שהתקבלה תשובה'); })
      .catch(function (e) { failed = failed || (ctl.signal.aborted ? 'הבקשה נעצרה' : e.message); })
      .then(function () {
        clearInterval(tick);
        if (failed) { library(G.search(problem), 'לא הצלחנו לקבל הדרכה מותאמת (' + esc(failed) + '). אלה המדריכים שהכי מתאימים:'); A.toast(failed, true); return; }
        showAi(final.result);
      });
  }

  function find() {
    var q = $('#gQuery').value.trim();
    if (!q) return library(G.GUIDES);
    var found = G.search(q);
    library(found, found.length ? 'המדריכים שהכי מתאימים למה שתיארתם. לא מתאים? לחצו "הדרכה מותאמת מ-Claude".' : '');
  }

  /* ---------- הרכבה ---------- */

  function mount() {
    if (st.mounted) return;
    st.mounted = true;
    $('#gPhones').innerHTML = G.PHONES.map(function (p) { return '<a class="g-phone" href="tel:' + p.n + '"><b>' + p.n + '</b><span>' + esc(p.name) + '</span><small>' + esc(p.when) + '</small></a>'; }).join('');
    $('#gFind').addEventListener('click', find);
    $('#gAsk').addEventListener('click', askClaude);
    $('#gQuery').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); find(); } });
    $$('[data-gq]').forEach(function (b) { b.addEventListener('click', function () { $('#gQuery').value = b.textContent; find(); }); });
    $('#gAiCopy').addEventListener('click', function () { A.copy($('#gAiPrompt').value, 'ההנחיה הועתקה. הדביקו אותה ב-claude.ai.'); });
    $('#gAiApply').addEventListener('click', function () {
      var r;
      try { r = FP.parseGuide($('#gAiPaste').value); } catch (e) { $('#gAiError').textContent = 'לא הצלחנו לקרוא את התשובה: ' + e.message; return; }
      $('#gAiDlg').close();
      showAi(r);
    });
  }

  window.FixGuides = {
    show: function () {
      mount();
      var m = location.hash.match(/^#help\/([\w-]+)/);
      if (m && G.byId(m[1])) { if (!st.guide || st.guide.id !== m[1]) openGuide(m[1], true); }
      else if (!st.guide) library(G.GUIDES);
    }
  };

  if (/^#help/.test(location.hash)) window.FixGuides.show();
})();
