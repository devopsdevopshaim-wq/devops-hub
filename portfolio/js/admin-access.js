/* Admin screen · clients and subscriptions. Talks to "הסדנה · כניסה והרשאות"
   in n8n through HasadnaAuth.api, with the admin's own session. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var DAY = 86400000;
  var PLAN = { day: ['יומי', 1], week: ['שבועי', 7], month: ['חודשי', 30], year: ['שנתי', 365], custom: ['תאריך קבוע', 0], free: ['ללא הגבלה', 0] };
  var SITE = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/';
  var C = { clients: [], projects: [], cats: {}, editing: null };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function api(action, data) { return window.HasadnaAuth.api(action, data); }
  function fail(t) { $('cl-err').textContent = t || ''; $('cl-err').hidden = !t; }
  function date(iso) { return iso ? new Date(iso).toLocaleDateString('he-IL') : '—'; }
  function title(id) { var p = C.projects.filter(function (x) { return x.id === id; })[0]; return p ? p.title : id; }
  function waNum(p) { return String(p || '').replace(/\D/g, '').replace(/^0/, '972'); }

  function load() {
    return api('clients').then(function (j) {
      if (!j.ok) { fail('לא הצלחתי לטעון לקוחות: ' + j.error); return; }
      fail('');
      C.clients = j.clients.sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email, 'he'); });
      render();
    }).catch(function () { fail('n8n לא ענה. בדקו שה־workflow "הסדנה · כניסה והרשאות" פעיל.'); });
  }

  function render() {
    var act = C.clients.filter(function (c) { return c.activeNow; });
    var soon = act.filter(function (c) { return c.daysLeft != null && c.daysLeft <= 3; });
    var dl = $('cl-kpis');
    dl.replaceChildren();
    [['לקוחות', C.clients.length], ['פעילים עכשיו', act.length], ['נגמר בעוד 3 ימים', soon.length], ['לא פעילים', C.clients.length - act.length]].forEach(function (k) {
      dl.appendChild(el('div', {}, [el('dt', { text: k[0] }), el('dd', { text: String(k[1]) })]));
    });

    var tb = $('cl-rows');
    tb.replaceChildren();
    C.clients.forEach(function (c) {
      var days = c.daysLeft;
      var state = !c.activeNow ? (c.active === false ? ['down', '✕ מושהה'] : ['down', '✕ הסתיים']) : days != null && days <= 3 ? ['waking', '⏳ עוד ' + days + ' ימים'] : ['ok', '✓ פעיל'];
      var sites = c.sites || [];
      var b = function (txt, fn, cls) { var x = el('button', { type: 'button', class: cls || null, text: txt }); x.addEventListener('click', fn); return x; };
      var invite = 'שלום ' + (c.name || '') + ', נפתחה לך גישה להסדנה' + (c.expiresAt ? ' עד ' + date(c.expiresAt) : '') + '.\n' +
        'כניסה: ' + SITE + '\nנכנסים עם המייל ' + c.email + ' ועם מספר הטלפון הזה, ומקבלים קוד חד־פעמי במייל.';
      tb.appendChild(el('tr', { class: c.activeNow ? null : 'off' }, [
        el('td', { class: 'who' }, [el('b', { text: c.name || '—' }), el('small', { dir: 'ltr', text: c.email }), el('small', { dir: 'ltr', text: c.phone }), c.note ? el('small', { text: c.note }) : null]),
        el('td', {}, [el('div', { class: 'cl-chips' }, sites.slice(0, 4).map(function (id) { return el('span', { text: title(id) }); }).concat(sites.length > 4 ? [el('span', { text: '+' + (sites.length - 4) })] : sites.length ? [] : [el('span', { text: 'אין אתרים' })]))]),
        el('td', { text: (PLAN[c.plan] || ['—'])[0] }),
        el('td', {}, [el('span', { class: 'pill ' + state[0], text: state[1] }), el('div', { class: 'muted', text: c.expiresAt ? date(c.expiresAt) : 'ללא הגבלה' })]),
        el('td', { class: 'num', text: c.lastLogin ? date(c.lastLogin) : 'עוד לא' }),
        el('td', {}, [el('div', { class: 'acts' }, [
          b('עריכה', function () { edit(c); }),
          b('+יום', function () { extend(c, 1); }),
          b('+חודש', function () { extend(c, 30); }),
          b(c.active === false ? 'הפעלה' : 'השהיה', function () { save(Object.assign({}, c, { active: c.active === false })); }),
          el('a', { href: 'https://wa.me/' + waNum(c.phone) + '?text=' + encodeURIComponent(invite), target: '_blank', rel: 'noopener', text: 'הזמנה בוואטסאפ ↗' }),
          b('מחיקה', function () { if (confirm('למחוק את ' + (c.name || c.email) + '? הגישה שלו תיחסם מיד.')) api('client-delete', { email: c.email }).then(load); }, 'del')
        ])])
      ]));
    });
    if (!C.clients.length) tb.appendChild(el('tr', {}, [el('td', { colspan: '6', class: 'muted', text: 'עדיין אין לקוחות. לחצו "+ לקוח חדש".' })]));
    api('log').then(function (j) {
      if (!j.ok) return;
      $('cl-log').replaceChildren.apply($('cl-log'), j.log.map(function (x) {
        return el('li', {}, [el('time', { text: new Date(x.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) }), el('span', { text: x.what + ' · ' + x.who })]);
      }));
    });
  }

  function extend(c, days) {
    api('client-extend', { email: c.email, days: String(days) }).then(function (j) { if (!j.ok) alert('לא עודכן: ' + j.error); load(); });
  }
  function save(c) {
    return api('client-save', { payload: JSON.stringify(c) }).then(function (j) {
      if (!j.ok) { alert('לא נשמר: ' + j.error); return false; }
      load(); return true;
    });
  }

  // ---------- editor
  function sitesList(selected) {
    var box = $('cl-list');
    box.replaceChildren();
    var by = {};
    C.projects.forEach(function (p) { (by[p.category] = by[p.category] || []).push(p); });
    Object.keys(C.cats).forEach(function (cat) {
      if (!by[cat]) return;
      box.appendChild(el('h4', { text: C.cats[cat] }));
      by[cat].forEach(function (p) {
        box.appendChild(el('label', { 'data-q': (p.title + ' ' + p.id).toLowerCase() }, [
          el('input', { type: 'checkbox', value: p.id, checked: selected.indexOf(p.id) >= 0 ? '' : null }), el('span', { text: p.title })
        ]));
      });
    });
    count();
  }
  function count() {
    var n = $('cl-list').querySelectorAll('input:checked').length;
    $('cl-count').textContent = n + ' נבחרו';
  }
  $('cl-list').addEventListener('change', count);
  $('cl-q').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    Array.prototype.forEach.call($('cl-list').querySelectorAll('label'), function (l) { l.hidden = q && l.getAttribute('data-q').indexOf(q) < 0; });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-all]'), function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('data-all') === '1';
      Array.prototype.forEach.call($('cl-list').querySelectorAll('label:not([hidden]) input'), function (i) { i.checked = on; });
      count();
    });
  });

  function setExpiry() {
    var f = $('cl-form').elements, d = PLAN[f.plan.value][1];
    f.expires.disabled = f.plan.value === 'free';
    if (d) f.expires.value = new Date(Date.now() + d * DAY).toISOString().slice(0, 10);
    if (f.plan.value === 'free') f.expires.value = '';
  }
  $('cl-form').elements.plan.addEventListener('change', setExpiry);

  function edit(c) {
    C.editing = c || null;
    var f = $('cl-form').elements;
    $('cl-title').textContent = c ? 'עריכת ' + (c.name || c.email) : 'לקוח חדש';
    f.name.value = c ? c.name || '' : '';
    f.email.value = c ? c.email : '';
    f.phone.value = c ? c.phone : '';
    f.note.value = c ? c.note || '' : '';
    f.plan.value = c ? c.plan || 'custom' : 'month';
    f.active.checked = c ? c.active !== false : true;
    if (c) { f.expires.value = c.expiresAt ? c.expiresAt.slice(0, 10) : ''; f.expires.disabled = c.plan === 'free'; } else setExpiry();
    $('cl-q').value = '';
    $('cl-form-err').hidden = true;
    sitesList(c ? c.sites || [] : []);
    $('cl-dialog').showModal();
  }
  $('cl-new').addEventListener('click', function () { edit(null); });

  $('cl-form').addEventListener('submit', function (e) {
    var f = e.target.elements;
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    var err = $('cl-form-err');
    var email = f.email.value.trim(), phone = f.phone.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || phone.replace(/\D/g, '').length < 9) { err.textContent = 'צריך מייל וטלפון תקינים.'; err.hidden = false; return; }
    var sites = Array.prototype.map.call($('cl-list').querySelectorAll('input:checked'), function (i) { return i.value; });
    var exp = f.plan.value === 'free' || !f.expires.value ? null : new Date(f.expires.value + 'T23:59:59').toISOString();
    // a day pass is 24 hours from now, when its date was left as suggested
    if (f.plan.value === 'day' && f.expires.value === new Date(Date.now() + DAY).toISOString().slice(0, 10)) exp = new Date(Date.now() + DAY).toISOString();
    var c = { oldEmail: C.editing ? C.editing.email : null, name: f.name.value.trim(), email: email, phone: phone, note: f.note.value.trim(),
      plan: f.plan.value, expiresAt: exp, active: f.active.checked, sites: sites };
    save(c).then(function (ok) { if (ok) $('cl-dialog').close(); });
  });

  // start once the admin is signed in
  window.HasadnaAuth.ready.then(function (s) {
    if (s.role !== 'admin') return;
    fetch('projects.json').then(function (r) { return r.json(); }).then(function (d) {
      C.projects = d.projects.filter(function (p) { return !p.pending; });
      C.cats = d.categories;
      load();
    });
  });
})();
