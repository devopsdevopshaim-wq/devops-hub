/* SPIDER mail: a client's own mailbox inside the portfolio. A pill shows how many messages wait; the panel filters them (Gmail's tabs plus bills,
   attachments, unread), lets the client delete (Gmail's trash), keep, move to folders of their own, and sort what arrives with rules.
   The admin also sees how many people are ONLINE. Everything is drawn with textContent; the server never sends a token to this page. */
(function () {
  'use strict';
  var Auth = window.HasadnaAuth;
  if (!Auth) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var BASE = '', S = null, filter = 'inbox', rows = [], next = '', picked = {}, busy = false, panel = null, pill = null, mailChip = null, onlineChip = null, view = 'mail';

  function post(path, data) {
    var body = new URLSearchParams(data || {}); body.set('token', Auth.token());
    return fetch(BASE + '/' + path, { method: 'POST', body: body }).then(function (r) { return r.json(); });
  }
  var mail = function (action, data) { data = data || {}; data.action = action; return post('hasadna-mail', data); };
  function toast(t, bad) {
    var n = $('#mail-toast') || el('div', { id: 'mail-toast', role: 'status', 'aria-live': 'polite' });
    n.textContent = t; n.className = bad ? 'bad' : ''; if (!n.parentNode) document.body.appendChild(n);
    clearTimeout(toast.t); toast.t = setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 4200);
  }

  // ---------------------------------------------------------------- the pill
  function ensurePill() {
    if (pill) return;
    pill = el('div', { id: 'mail-pill' });
    document.body.appendChild(pill);
  }
  function drawPill() {
    ensurePill();
    pill.textContent = '';
    if (Auth.session && Auth.session.role === 'admin' && onlineChip !== null) {
      var o = el('a', { class: 'mp-online', href: 'admin.html#presence', title: 'מחוברים עכשיו · לחיצה לפירוט' }, [el('i', { 'aria-hidden': 'true' }), el('b', { text: String(onlineChip.online) }), el('span', { text: ' ONLINE' }), el('small', { text: ' · ' + onlineChip.offline + ' OFFLINE · ' + onlineChip.members + ' חברים' })]);
      pill.appendChild(o);
    }
    if (S && S.available !== false) {
      var n = S && S.connected && !S.broken ? S.unread : 0;
      var b = el('button', { type: 'button', class: 'mp-mail' + (n ? ' has' : ''), 'aria-label': S.connected ? 'המיילים שלי, ' + n + ' לא נקראו' : 'חיבור תיבת המייל' }, [el('span', { 'aria-hidden': 'true', text: '✉' }), el('span', { text: S.connected ? (S.broken ? 'לחבר מחדש' : 'מיילים') : 'חבר מייל' }), n ? el('em', { text: n > 99 ? '99+' : String(n) }) : null]);
      b.addEventListener('click', openPanel);
      pill.appendChild(b);
    }
  }

  // ---------------------------------------------------------------- the panel
  function openPanel() {
    if (!panel) {
      panel = el('div', { id: 'mail-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'המיילים שלי' });
      document.body.appendChild(panel);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('on')) closePanel(); });
    }
    panel.classList.add('on'); document.documentElement.classList.add('mail-open');
    render();
    if (S && S.connected && !S.broken && !rows.length) load(true);
  }
  function closePanel() { if (panel) panel.classList.remove('on'); document.documentElement.classList.remove('mail-open'); }

  function head(sub) {
    var close = el('button', { type: 'button', class: 'mp-x', 'aria-label': 'סגירה', text: '✕' }); close.addEventListener('click', closePanel);
    var h = el('header', { class: 'mp-head' }, [el('div', {}, [el('h2', { text: 'המיילים שלי' }), el('p', { text: sub || '' })]), close]);
    return h;
  }

  function render() {
    panel.textContent = '';
    var box = el('div', { class: 'mp-box' });
    panel.appendChild(box);
    if (!S || S.available === false) {
      box.appendChild(head('')); box.appendChild(el('p', { class: 'mp-note', text: 'חיבור תיבות המייל עוד לא הופעל במערכת. מנהל המערכת צריך להוסיף חיבור ל־Google; אחרי זה תוכלו לחבר את ה־Gmail שלכם בלחיצה.' })); return;
    }
    if (!S.connected) { renderConnect(box); return; }
    if (S.broken) { renderConnect(box, true); return; }
    box.appendChild(head(S.gmail));
    var tabs = el('div', { class: 'mp-tabs', role: 'tablist' });
    [['mail', 'תיבת הדואר'], ['rules', 'כללי סינון']].forEach(function (t) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === t[0]), text: t[1] });
      b.addEventListener('click', function () { view = t[0]; render(); }); tabs.appendChild(b);
    });
    box.appendChild(tabs);
    if (view === 'rules') renderRules(box); else renderMail(box);
  }

  function renderConnect(box, broken) {
    box.appendChild(head(''));
    box.appendChild(el('div', { class: 'mp-connect' }, [
      el('div', { class: 'mp-big', 'aria-hidden': 'true', text: '✉' }),
      el('h3', { text: broken ? 'צריך לחבר את המייל מחדש' : 'כל המיילים שלכם, מסודרים כאן' }),
      el('p', { text: broken ? 'החיבור ל־Gmail פג או בוטל. אפשר לחבר שוב בלחיצה.' : 'מחברים את ה־Gmail שלכם פעם אחת, ובדף הראשי תראו כמה מיילים מחכים לכם. אפשר לסנן (אישיים, חשבונות, פרסומות…), למחוק, להשאיר או להעביר לתיקיות משלכם, ולהגדיר כללים שימיינו לבד.' }),
      el('ul', { class: 'mp-trust' }, [el('li', { text: 'אתם מאשרים בעצמכם במסך של Google, ואפשר לבטל בכל רגע.' }), el('li', { text: 'שום דבר לא נשלח מהמייל שלכם, ושום דבר לא נמחק לצמיתות: מחיקה מעבירה לפח של Gmail ל־30 יום.' }), el('li', { text: 'המערכת לא שומרת את תוכן המיילים, רק מציגה אותם.' })])
    ]));
    var go = el('button', { type: 'button', class: 'mp-primary', text: 'חיבור Gmail' });
    go.addEventListener('click', function () {
      go.disabled = true; go.textContent = 'מעביר ל־Google…';
      mail('connect').then(function (r) { if (r && r.url) location.href = r.url; else { go.disabled = false; go.textContent = 'חיבור Gmail'; toast('לא הצלחנו להתחיל את החיבור', true); } }, function () { go.disabled = false; go.textContent = 'חיבור Gmail'; toast('אין חיבור לשרת', true); });
    });
    box.appendChild(go);
    if (broken) { var d = el('button', { type: 'button', class: 'mp-link', text: 'ניתוק המייל' }); d.addEventListener('click', disconnect); box.appendChild(d); }
  }

  function disconnect() {
    if (!confirm('לנתק את תיבת המייל? המיילים נשארים אצלכם ב־Gmail, רק החיבור יוסר.')) return;
    mail('disconnect').then(function () { S = { ok: true, available: true, connected: false }; rows = []; drawPill(); render(); toast('המייל נותק'); });
  }

  function renderMail(box) {
    var chips = el('div', { class: 'mp-chips', role: 'group', 'aria-label': 'סינון' });
    var order = ['inbox', 'unread', 'primary', 'bills', 'promotions', 'social', 'updates', 'forums', 'attach', 'starred'];
    order.forEach(function (k) {
      var n = S.counts && S.counts[k];
      var b = el('button', { type: 'button', class: 'mp-chip', 'aria-pressed': String(filter === k) }, [S.filters[k] || k, (k !== 'inbox' && k !== 'starred' && n) ? el('em', { text: String(n) }) : null]);
      b.addEventListener('click', function () { filter = k; load(true); render(); }); chips.appendChild(b);
    });
    (S.folders || []).forEach(function (f) {
      var k = 'folder:' + f;
      var b = el('button', { type: 'button', class: 'mp-chip fold', 'aria-pressed': String(filter === k) }, ['📁 ' + f]);
      b.addEventListener('click', function () { filter = k; load(true); render(); }); chips.appendChild(b);
    });
    box.appendChild(chips);

    var bar = el('div', { class: 'mp-bar', id: 'mp-bar' });
    var all = el('label', { class: 'mp-all' }, [el('input', { type: 'checkbox', id: 'mp-all', 'aria-label': 'בחירת הכול' }), el('span', { text: 'בחירת הכול' })]);
    all.firstChild.addEventListener('change', function (e) { rows.forEach(function (r) { if (e.target.checked) picked[r.id] = 1; else delete picked[r.id]; }); drawList(); drawBar(); });
    bar.appendChild(all);
    var acts = el('div', { class: 'mp-acts', id: 'mp-acts' }); bar.appendChild(acts);
    box.appendChild(bar);
    box.appendChild(el('div', { class: 'mp-list', id: 'mp-list', role: 'list' }));
    box.appendChild(el('div', { class: 'mp-foot' }, [el('button', { type: 'button', class: 'mp-link', id: 'mp-more', text: 'עוד מיילים' })]));
    $('#mp-more').addEventListener('click', function () { load(false); });
    var out = el('button', { type: 'button', class: 'mp-link', text: 'ניתוק המייל' }); out.addEventListener('click', disconnect);
    box.appendChild(el('div', { class: 'mp-foot' }, [out]));
    drawList(); drawBar();
  }

  function pickedIds() { return Object.keys(picked); }
  function drawBar() {
    var acts = $('#mp-acts'); if (!acts) return; acts.textContent = '';
    var n = pickedIds().length;
    if (!n) { acts.appendChild(el('span', { class: 'mp-hint', text: 'סמנו הודעות כדי לטפל בהן' })); return; }
    acts.appendChild(el('span', { class: 'mp-count', text: n + ' נבחרו' }));
    function A(label, cls, fn) { var b = el('button', { type: 'button', class: 'mp-act ' + cls, text: label }); b.addEventListener('click', fn); acts.appendChild(b); }
    A('🗑 מחק', 'del', function () { doAct('trash'); });
    A('✓ השאר', '', function () { doAct('keep'); });
    A('נקרא', '', function () { doAct('read'); });
    var sel = el('select', { class: 'mp-folder', 'aria-label': 'העברה לתיקייה' }, [el('option', { value: '', text: '📁 העבר לתיקייה…' })]);
    (S.folders || []).forEach(function (f) { sel.appendChild(el('option', { value: f, text: f })); });
    sel.appendChild(el('option', { value: '__new', text: '＋ תיקייה חדשה…' }));
    sel.addEventListener('change', function () {
      var v = sel.value; if (!v) return;
      if (v === '__new') { v = (prompt('שם התיקייה החדשה') || '').trim(); if (!v) { sel.value = ''; return; } }
      doAct('folder', { folder: v });
    });
    acts.appendChild(sel);
  }

  function ago(iso) {
    if (!iso) return ''; var d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' דק׳'; if (s < 86400) return Math.round(s / 3600) + ' שע׳';
    if (s < 604800) return Math.round(s / 86400) + ' ימים'; return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  }
  function drawList() {
    var l = $('#mp-list'); if (!l) return; l.textContent = '';
    if (busy && !rows.length) { l.appendChild(el('p', { class: 'mp-note', text: 'טוען…' })); return; }
    if (!rows.length) l.appendChild(el('p', { class: 'mp-note', text: 'אין כאן מיילים. 🎉' }));
    rows.forEach(function (r) {
      var cb = el('input', { type: 'checkbox', 'aria-label': 'בחירה: ' + r.subject }); cb.checked = !!picked[r.id];
      cb.addEventListener('change', function () { if (cb.checked) picked[r.id] = 1; else delete picked[r.id]; drawBar(); });
      var row = el('div', { class: 'mp-row' + (r.unread ? ' unread' : ''), role: 'listitem' }, [cb,
        el('div', { class: 'mp-main' }, [el('div', { class: 'mp-top' }, [el('b', { text: r.from }), el('time', { text: ago(r.date) })]), el('div', { class: 'mp-sub', text: r.subject }), el('div', { class: 'mp-snip', text: r.snippet })]),
        r.cat && r.cat !== 'personal' ? el('span', { class: 'mp-cat', text: ({ promotions: 'פרסום', social: 'חברתי', updates: 'עדכון', forums: 'קבוצה' })[r.cat] || '' }) : null]);
      l.appendChild(row);
    });
    var more = $('#mp-more'); if (more) more.hidden = !next;
  }

  function load(reset) {
    if (busy) return; busy = true;
    if (reset) { rows = []; next = ''; picked = {}; }
    drawList();
    mail('list', { filter: filter, page: reset ? '' : next }).then(function (r) {
      busy = false;
      if (!r || !r.ok) { toast('לא הצלחנו לטעון מיילים', true); return; }
      rows = rows.concat(r.rows); next = r.next || '';
      drawList(); drawBar();
    }, function () { busy = false; toast('אין חיבור לשרת', true); });
  }

  function doAct(op, extra) {
    var ids = pickedIds(); if (!ids.length) return;
    if (op === 'trash' && !confirm('להעביר ' + ids.length + ' הודעות לפח של Gmail? אפשר לשחזר אותן 30 יום.')) return;
    var data = Object.assign({ op: op, ids: JSON.stringify(ids) }, extra || {});
    mail('act', data).then(function (r) {
      if (!r || !r.ok) { toast('הפעולה לא הצליחה', true); return; }
      if (r.folders) S.folders = r.folders;
      var gone = op === 'trash' || op === 'folder';
      if (gone) rows = rows.filter(function (x) { return !picked[x.id]; });
      else rows.forEach(function (x) { if (picked[x.id] && (op === 'keep' || op === 'read')) x.unread = false; });
      toast(({ trash: 'הועברו לפח', keep: 'נשארו בתיבה', read: 'סומנו כנקראו', folder: 'הועברו לתיקייה' })[op] || 'בוצע');
      picked = {}; refreshStatus(); render();
    }, function () { toast('אין חיבור לשרת', true); });
  }

  // ---------------------------------------------------------------- rules
  function renderRules(box) {
    var rules = (S.rules || []).slice(), folders = (S.folders || []).slice();
    box.appendChild(el('p', { class: 'mp-note', text: 'כללים ממיינים מיילים חדשים לבד: כשהודעה מתאימה לכלל, נעשה בה מה שבחרתם. הכלל הראשון שמתאים הוא שפועל. שום דבר לא נמחק לצמיתות.' }));
    var list = el('div', { class: 'mp-rules' });
    var ACT = { trash: 'לפח', folder: 'לתיקייה', read: 'סמן כנקרא', keep: 'השאר בתיבה' };
    function desc(r) { var p = []; if (r.from) p.push('מאת "' + r.from + '"'); if (r.subject) p.push('נושא כולל "' + r.subject + '"'); if (r.text) p.push('מכיל "' + r.text + '"'); if (r.cat) p.push('לשונית ' + ({ primary: 'אישיים', promotions: 'פרסומות', social: 'חברתי', updates: 'עדכונים', forums: 'קבוצות' })[r.cat]); return (p.join(' · ') || 'כל הודעה') + '  ←  ' + ACT[r.action] + (r.action === 'folder' ? ' ' + r.folder : ''); }
    if (!rules.length) list.appendChild(el('p', { class: 'mp-note dim', text: 'עוד אין כללים.' }));
    rules.forEach(function (r, i) {
      var on = el('input', { type: 'checkbox', 'aria-label': 'כלל פעיל' }); on.checked = r.on !== false; on.addEventListener('change', function () { r.on = on.checked; save(rules, folders); });
      var del = el('button', { type: 'button', class: 'mp-act del', 'aria-label': 'מחיקת הכלל', text: '✕' }); del.addEventListener('click', function () { rules.splice(i, 1); save(rules, folders, true); });
      list.appendChild(el('div', { class: 'mp-rule' }, [on, el('div', {}, [el('b', { text: r.name || 'כלל ' + (i + 1) }), el('div', { class: 'mp-snip', text: desc(r) })]), del]));
    });
    box.appendChild(list);

    var f = el('form', { class: 'mp-form' });
    function field(label, name, ph) { return el('label', {}, [label, el('input', { name: name, placeholder: ph || '', maxlength: '80', autocomplete: 'off' })]); }
    var cat = el('select', { name: 'cat' }, [['', 'כל הלשוניות'], ['primary', 'אישיים'], ['promotions', 'פרסומות'], ['social', 'חברתי'], ['updates', 'עדכונים'], ['forums', 'קבוצות']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var act = el('select', { name: 'action' }, [['trash', 'להעביר לפח'], ['folder', 'להעביר לתיקייה'], ['read', 'לסמן כנקרא'], ['keep', 'להשאיר בתיבה']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var fol = el('input', { name: 'folder', placeholder: 'שם תיקייה', maxlength: '30', list: 'mp-folders', hidden: '' });
    var dl = el('datalist', { id: 'mp-folders' }, folders.map(function (x) { return el('option', { value: x }); }));
    act.addEventListener('change', function () { fol.hidden = act.value !== 'folder'; });
    f.appendChild(el('h4', { text: 'כלל חדש' }));
    f.appendChild(field('שם הכלל', 'name', 'למשל: פרסומות'));
    f.appendChild(field('מאת (כתובת או שם)', 'from', 'למשל: @shop.com'));
    f.appendChild(field('הנושא כולל', 'subject'));
    f.appendChild(field('ההודעה מכילה', 'text'));
    f.appendChild(el('label', {}, ['לשונית ב־Gmail', cat]));
    f.appendChild(el('label', {}, ['מה לעשות', act, fol, dl]));
    var add = el('button', { type: 'submit', class: 'mp-primary', text: 'הוספת כלל' }); f.appendChild(add);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = {}; ['name', 'from', 'subject', 'text', 'cat', 'action', 'folder'].forEach(function (n) { v[n] = (f.elements[n].value || '').trim(); });
      if (!v.from && !v.subject && !v.text && !v.cat) { toast('בחרו לפחות תנאי אחד', true); return; }
      if (v.action === 'folder') { if (!v.folder) { toast('כתבו שם תיקייה', true); return; } if (folders.indexOf(v.folder) < 0) folders.push(v.folder); }
      rules.push(v); save(rules, folders, true);
    });
    box.appendChild(f);

    var auto = el('input', { type: 'checkbox', id: 'mp-auto' }); auto.checked = !!S.auto;
    auto.addEventListener('change', function () { S.auto = auto.checked; save(rules, folders); });
    box.appendChild(el('label', { class: 'mp-auto' }, [auto, el('span', { text: 'הפעילו את הכללים אוטומטית בכל כניסה' })]));
    var run = el('button', { type: 'button', class: 'mp-act', text: '▶ הפעל את הכללים עכשיו' });
    run.addEventListener('click', function () { run.disabled = true; mail('apply').then(function (r) { run.disabled = false; toast(r && r.ok ? 'נוקו: ' + r.trashed + ' לפח, ' + r.moved + ' לתיקיות, ' + r.read + ' סומנו' : 'לא הצלחנו', !(r && r.ok)); refreshStatus(); }, function () { run.disabled = false; toast('אין חיבור לשרת', true); }); });
    box.appendChild(run);
  }
  function save(rules, folders, redraw) {
    mail('rules-set', { rules: JSON.stringify(rules), folders: JSON.stringify(folders), auto: S.auto ? '1' : '0' }).then(function (r) {
      if (r && r.ok) { S.rules = r.rules; S.folders = r.folders; S.auto = r.auto; if (redraw) render(); toast('נשמר'); } else toast('לא נשמר', true);
    }, function () { toast('אין חיבור לשרת', true); });
  }

  // ---------------------------------------------------------------- status, presence
  function refreshStatus() {
    return mail('status').then(function (r) { if (r && r.ok) { S = r; drawPill(); } }, function () {});
  }
  function refreshOnline() {
    if (!Auth.session || Auth.session.role !== 'admin') return;
    Auth.api('presence').then(function (r) { if (r && r.ok) { onlineChip = { online: r.online, offline: r.offline, members: r.members }; drawPill(); } });
  }

  Promise.all([Auth.ready, fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (res) {
    var who = res[0] || {}, cfg = res[1];
    if (!who.role || who.role === 'visitor' || who.offline || who.mustChange) return;
    if (/[?&]nomail\b/.test(location.search)) return;
    if (cfg && cfg.base) BASE = cfg.base;
    refreshOnline();
    setInterval(function () { if (!document.hidden) refreshOnline(); }, 60000);
    // the mailbox lives on the Cloudflare server; a session that belongs to the other one cannot use it
    var ep = ''; try { ep = localStorage.getItem('hasadna-ep') || ''; } catch (e) {}
    if (!BASE || (ep && ep.indexOf(BASE) !== 0)) return;
    refreshStatus().then(function () {
      var m = (/[?&]mail=(\w+)/.exec(location.search) || [])[1];
      if (m) {
        history.replaceState(null, '', location.pathname + location.hash);
        var msg = { connected: 'המייל חובר! אפשר לראות ולסנן את ההודעות', denied: 'לא אושר החיבור ב־Google', expired: 'החיבור פג תוקף, נסו שוב', failed: 'החיבור נכשל', norefresh: 'Google לא נתנה הרשאה מתמשכת. נסו שוב ואשרו הכול', scope: 'צריך לאשר גם את ההרשאה לניהול ההודעות', off: 'החיבור ל־Google עוד לא הופעל' }[m] || '';
        if (msg) toast(msg, m !== 'connected');
        if (m === 'connected') openPanel();
      }
    });
    setInterval(function () { if (!document.hidden && S && S.connected && !(panel && panel.classList.contains('on'))) refreshStatus(); }, 180000);
  });
})();
