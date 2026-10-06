/* Admin screen · clients and subscriptions. Talks to "SPIDER · כניסה והרשאות"
   in n8n through HasadnaAuth.api, with the admin's own session. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var DAY = 86400000;
  var PLAN = { day: ['יומי', 1], week: ['שבועי', 7], month: ['חודשי', 30], year: ['שנתי', 365], custom: ['תאריך קבוע', 0], free: ['ללא הגבלה', 0] };
  var SITE = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/';
  var C = { clients: [], admin: null, projects: [], cats: {}, editing: null, plans: {}, paying: null };
  var PW = { none: 'אין סיסמה', initial: 'סיסמה ראשונית נשלחה', reset: 'ביקש סיסמה ראשונית', chosen: 'בחר סיסמה בעצמו', 'admin-set': 'הסיסמה הוגדרה על ידך' };

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
      C.admin = j.admin || null;
      C.clients = j.clients.sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email, 'he'); });
      render();
    }).catch(function () { fail('n8n לא ענה. בדקו שה־workflow "SPIDER · כניסה והרשאות" פעיל.'); });
  }

  function render() {
    var act = C.clients.filter(function (c) { return c.activeNow; });
    var soon = act.filter(function (c) { return c.daysLeft != null && c.daysLeft <= 3; });
    var dl = $('cl-kpis');
    dl.replaceChildren();
    var month = new Date().toISOString().slice(0, 7), income = 0;
    C.clients.forEach(function (c) { (c.payments || []).forEach(function (p) { if (p.at.slice(0, 7) === month) income += p.amount; }); });
    [['לקוחות', C.clients.length], ['פעילים עכשיו', act.length], ['נגמר בעוד 3 ימים', soon.length], ['לא פעילים', C.clients.length - act.length], ['הכנסות החודש', income.toLocaleString('he-IL') + ' ₪']].forEach(function (k) {
      dl.appendChild(el('div', {}, [el('dt', { text: k[0] }), el('dd', { text: String(k[1]) })]));
    });

    var tb = $('cl-rows');
    tb.replaceChildren();
    if (C.admin) {
      var a = C.admin, ab = function (txt, fn, cls) { var x = el('button', { type: 'button', class: cls || null, text: txt }); x.addEventListener('click', fn); return x; };
      tb.appendChild(el('tr', { class: 'admin-row' }, [
        el('td', { class: 'who' }, [el('b', { text: 'מנהל · אני' }), el('small', { dir: 'ltr', text: a.email }), el('small', { class: 'muted', text: (PW[a.pwState] || '') + (a.pwAt ? ' · ' + date(a.pwAt) : '') })]),
        el('td', {}, [el('div', { class: 'cl-chips' }, [el('span', { text: 'כל האתרים' })])]),
        el('td', { text: '—' }),
        el('td', {}, [el('span', { class: 'pill ok', text: '✓ מנהל' }), el('div', { class: 'muted', text: a.devices + ' מכשירים מוכרים' })]),
        el('td', { class: 'num', text: a.lastLogin ? date(a.lastLogin) : '—' }),
        el('td', {}, [el('div', { class: 'acts' }, [ab('🔑 שינוי הסיסמה שלי', changeMine)])])
      ]));
    }
    C.clients.forEach(function (c) {
      var days = c.daysLeft;
      var state = !c.activeNow ? (c.active === false ? ['down', '✕ מושהה'] : ['down', '✕ הסתיים']) : days != null && days <= 3 ? ['waking', '⏳ עוד ' + days + ' ימים'] : ['ok', '✓ פעיל'];
      var sites = c.sites || [];
      var b = function (txt, fn, cls) { var x = el('button', { type: 'button', class: cls || null, text: txt }); x.addEventListener('click', fn); return x; };
      var pend = (c.devices || []).filter(function (d) { return !d.approved || (d.ips || []).some(function (i) { return !i.approved; }); }).length;
      tb.appendChild(el('tr', { class: c.activeNow ? null : 'off' }, [
        el('td', { class: 'who' }, [el('b', { text: c.name || '—' }), el('small', { dir: 'ltr', text: c.email }), el('small', { dir: 'ltr', text: c.phone || '' }), el('small', { class: 'muted', text: (PW[c.pwState] || '') + (c.pwAt ? ' · ' + date(c.pwAt) : '') + (c.tmpExp ? ' · ראשונית תקפה עד ' + date(c.tmpExp) : '') }), c.failed ? el('small', { class: 'pill down', text: c.failed + ' ניסיונות כושלים בשעה' }) : null, pend ? el('small', { class: 'pill waking', text: '⏳ ' + pend + ' מחכים לאישור' }) : null, c.note ? el('small', { text: c.note }) : null]),
        el('td', {}, [el('div', { class: 'cl-chips' }, sites.slice(0, 4).map(function (id) { return el('span', { text: title(id) }); }).concat(sites.length > 4 ? [el('span', { text: '+' + (sites.length - 4) })] : sites.length ? [] : [el('span', { text: 'אין אתרים' })]))]),
        el('td', { text: (PLAN[c.plan] || ['—'])[0] }),
        el('td', {}, [el('span', { class: 'pill ' + state[0], text: state[1] }), el('div', { class: 'muted', text: c.expiresAt ? date(c.expiresAt) : 'ללא הגבלה' }), lastPay(c)]),
        el('td', { class: 'num', text: c.lastLogin ? date(c.lastLogin) : 'עוד לא' }),
        el('td', {}, [el('div', { class: 'acts' }, [
          b('💳 תשלום', function () { pay(c); }),
          b('עריכה', function () { edit(c); }),
          b('+יום', function () { extend(c, 1); }),
          b('+חודש', function () { extend(c, 30); }),
          b(c.active === false ? 'הפעלה' : 'השהיה', function () { save(Object.assign({}, c, { active: c.active === false })); }),
          b('🔑 סיסמה ראשונית', function () { sendPassword(c); }),
          b('🔍 בדיקת סיסמה', function () { checkPassword(c); }),
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

  function lastPay(c) {
    var p = (c.payments || [])[0];
    if (!p) return null;
    var inv = p.invoice;
    return el('div', { class: 'cl-pay' }, [
      document.createTextNode('שולם ' + p.amount.toLocaleString('he-IL') + ' ₪ · ' + date(p.at) + ' '),
      inv && inv.url ? el('a', { href: inv.url, target: '_blank', rel: 'noopener', text: 'מסמך ' + inv.number + ' ↗' })
        : inv && inv.error ? el('span', { class: 'muted', title: inv.error, text: inv.error === 'not-configured' ? '(בלי חשבונית)' : '(החשבונית נכשלה)' }) : null
    ]);
  }

  // ---------- payment
  var DAYS = { day: 1, week: 7, month: 30, year: 365, other: 0 };
  var NAMES = { day: 'מנוי יומי', week: 'מנוי שבועי', month: 'מנוי חודשי', year: 'מנוי שנתי', other: 'שירות' };
  function fillPay() {
    var f = $('pay-form').elements, k = f.plan.value;
    f.days.value = DAYS[k];
    if (C.plans[k]) f.amount.value = C.plans[k];
    f.description.value = (k === 'other' ? '' : NAMES[k] + ' ל־SPIDER');
  }
  $('pay-form').elements.plan.addEventListener('change', fillPay);
  function pay(c) {
    C.paying = c;
    var f = $('pay-form').elements;
    $('pay-title').textContent = 'תשלום · ' + (c.name || c.email);
    f.plan.value = DAYS[c.plan] ? c.plan : 'month';
    f.amount.value = '';
    fillPay();
    $('pay-err').hidden = true;
    $('pay-dialog').showModal();
  }
  $('pay-form').addEventListener('submit', function (e) {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    var f = e.target.elements, err = $('pay-err');
    if (!(Number(f.amount.value) > 0)) { err.textContent = 'כמה שולם?'; err.hidden = false; return; }
    var btn = e.submitter; btn.disabled = true;
    api('payment', { payload: JSON.stringify({ email: C.paying.email, amount: Number(f.amount.value), method: f.method.value,
      plan: f.plan.value === 'other' ? '' : f.plan.value, days: Number(f.days.value) || 0, description: f.description.value, invoice: f.invoice.checked }) })
      .then(function (j) {
        btn.disabled = false;
        if (!j.ok) { err.textContent = 'לא נרשם: ' + j.error; err.hidden = false; return; }
        $('pay-dialog').close();
        var inv = j.invoice;
        if (inv && inv.url) alert('✓ התשלום נרשם, המנוי הוארך, ומסמך ' + inv.number + ' נשלח ללקוח במייל.');
        else if (inv && inv.error === 'not-configured') alert('✓ התשלום נרשם והמנוי הוארך.\nחשבונית לא הופקה: עוד לא חיברת את Morning ב־n8n (INVOICE בצומת Auth · Handle).');
        else if (inv && inv.error) alert('✓ התשלום נרשם והמנוי הוארך.\nהחשבונית נכשלה: ' + inv.error + '\nאפשר להפיק אותה ידנית ב־Morning.');
        load();
      }).catch(function () { btn.disabled = false; err.textContent = 'n8n לא ענה.'; err.hidden = false; });
  });

  // ---------- passwords
  function makePassword() {
    var A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', r = new Uint32Array(14);
    crypto.getRandomValues(r);
    for (var i = 0; i < r.length; i++) out += A[r[i] % A.length];
    return out.slice(0, 4) + '-' + out.slice(4, 9) + '-' + out.slice(9);
  }
  // A new initial password: made by n8n and sent straight to the client's email. It never passes through you.
  // The client chooses their own at the first sign-in; a password they chose is never shown, only tested or replaced.
  function sendPassword(c) {
    if (!confirm('לשלוח ל־' + (c.name || c.email) + ' סיסמה ראשונית חדשה במייל?\nהסיסמה הקודמת שלו תפסיק לעבוד, וכל החיבורים הפתוחים שלו ייסגרו. הוא יבחר סיסמה משלו בכניסה.')) return;
    api('client-reset', { email: c.email }).then(function (j) {
      if (!j.ok) { alert('לא נשלחה: ' + j.error); return; }
      load();
      alert('✓ נשלחה סיסמה ראשונית למייל של ' + (c.name || c.email) + '.\nהוא יחליף אותה בעצמו, ואתה תראה כאן שהוא בחר סיסמה.\nאם המייל לא הגיע, הוא יכול ללחוץ "קבלת סיסמה ראשונית למייל" בעמוד הכניסה.');
    });
  }
  // does a password open this account? (for when a client says "it does not work")
  function checkPassword(c) {
    var pw = prompt('הקלד סיסמה לבדיקה עבור ' + (c.name || c.email) + '.\nהיא לא נשמרת, והבדיקה נרשמת ביומן.');
    if (!pw) return;
    api('client-check-password', { email: c.email, password: pw }).then(function (j) {
      if (!j.ok) { alert('לא נבדקה: ' + j.error); return; }
      alert(j.match ? '✓ הסיסמה נכונה (' + (j.kind === 'initial' ? 'סיסמה ראשונית' : 'הסיסמה שהלקוח בחר') + ').' : '✗ הסיסמה לא נכונה.');
    });
  }
  // the admin's own password
  function changeMine() {
    var cur = prompt('הסיסמה הנוכחית שלך:');
    if (!cur) return;
    var np = prompt('סיסמה חדשה (8 תווים לפחות):');
    if (!np) return;
    if (np.length < 8) { alert('הסיסמה צריכה להיות באורך 8 תווים לפחות.'); return; }
    api('change-password', { current: cur, password: np }).then(function (j) {
      if (!j.ok) { alert(j.error === 'bad-login' ? 'הסיסמה הנוכחית לא נכונה.' : 'לא הוחלפה: ' + j.error); return; }
      alert('✓ הסיסמה שלך הוחלפה. חיבורים אחרים שלך נסגרו.');
      load();
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

  function devicesList(c) {
    var box = $('cl-devices');
    box.replaceChildren();
    if (!c) { box.appendChild(el('p', { class: 'muted', text: 'המכשיר הראשון שייכנס יאושר אוטומטית. מכשיר חדש מקבל סיסמה זמנית למייל של הלקוח ומאשר את עצמו, ואתה רק רואה אותו כאן.' })); return; }
    var ds = c.devices || [];
    if (!ds.length) { box.appendChild(el('p', { class: 'muted', text: 'עוד לא נכנס משום מכשיר.' })); return; }
    ds.forEach(function (d) {
      var row = el('div', { class: 'cl-dev' + (d.approved ? '' : ' wait') }, [
        el('div', {}, [
          el('b', { text: (d.approved ? '✓ ' : '⏳ ') + (d.ua || 'מכשיר') + (d.approved ? (d.how === 'first' ? ' · המכשיר הראשון' : d.how === 'email' ? ' · אושר במייל על ידי הלקוח' : d.how === 'admin' ? ' · אושר על ידך' : '') : ' · ממתין לאימות במייל מהלקוח') }),
          el('small', { text: 'נראה לראשונה ' + date(d.first) + ' · לאחרונה ' + date(d.last) }),
          el('small', { dir: 'ltr', text: (d.ips || []).map(function (i) { return i.ip + (i.approved ? '' : ' (ממתינה)'); }).join('  ·  ') })
        ])
      ]);
      var act = el('div', { class: 'acts' });
      var needsOk = !d.approved || (d.ips || []).some(function (i) { return !i.approved; });
      if (needsOk) {
        var ok = el('button', { type: 'button', text: 'אישור' });
        ok.addEventListener('click', function () { api('device-approve', { email: c.email, id: d.id }).then(function (j) { if (!j.ok) { alert(j.error === 'too-many-devices' ? 'יש כבר המקסימום של מכשירים מאושרים. הגדל את המקסימום או הסר מכשיר.' : 'לא עודכן: ' + j.error); return; } refreshEditing(j.client); }); });
        act.appendChild(ok);
      }
      var rm = el('button', { type: 'button', class: 'del', text: 'הסרה' });
      rm.addEventListener('click', function () { if (confirm('להסיר את המכשיר? החיבור שלו ייסגר והוא יחכה שוב לאישור.')) api('device-remove', { email: c.email, id: d.id }).then(function (j) { if (j.ok) refreshEditing(j.client); }); });
      act.appendChild(rm);
      row.appendChild(act);
      box.appendChild(row);
    });
  }
  function refreshEditing(c) { C.editing = c; devicesList(c); load(); }

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
    f.phone.value = c ? c.phone || '' : '';
    f.password.value = '';
    f.ipLock.checked = !!(c && c.ipLock);
    f.maxDevices.value = String((c && c.maxDevices) || 3);
    $('cl-pw-label').textContent = 'סיסמה ראשונית';
    $('cl-pw-note').textContent = (c ? 'מצב: ' + (PW[c.pwState] || '') + '. השאר ריק כדי לא לשנות. ' : 'השאר ריק: הלקוח יקבל סיסמה ראשונית אוטומטית למייל שלו, בלי שתראה אותה. ') + 'אם כותבים כאן סיסמה, היא נשלחת ללקוח במייל, הסיסמה הקודמת שלו מפסיקה לעבוד, והוא בוחר סיסמה משלו בכניסה הראשונה. את הסיסמה שהוא בחר אי אפשר לראות, רק לבדוק או להחליף.';
    devicesList(c);
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
  $('cl-pw-gen').addEventListener('click', function () { var pw = makePassword(); $('cl-form').elements.password.value = pw; $('cl-pw-note').textContent = 'הסיסמה הראשונית: ' + pw + ' · תישלח ללקוח במייל בשמירה.'; });

  $('cl-form').addEventListener('submit', function (e) {
    var f = e.target.elements;
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    var err = $('cl-form-err');
    var email = f.email.value.trim(), phone = f.phone.value.trim(), password = f.password.value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'צריך כתובת מייל תקינה.'; err.hidden = false; return; }
    if (password && password.length < 8) { err.textContent = 'סיסמה: 8 תווים לפחות.'; err.hidden = false; return; }
    var sites = Array.prototype.map.call($('cl-list').querySelectorAll('input:checked'), function (i) { return i.value; });
    var exp = f.plan.value === 'free' || !f.expires.value ? null : new Date(f.expires.value + 'T23:59:59').toISOString();
    // a day pass is 24 hours from now, when its date was left as suggested
    if (f.plan.value === 'day' && f.expires.value === new Date(Date.now() + DAY).toISOString().slice(0, 10)) exp = new Date(Date.now() + DAY).toISOString();
    var c = { oldEmail: C.editing ? C.editing.email : null, name: f.name.value.trim(), email: email, phone: phone, note: f.note.value.trim(),
      plan: f.plan.value, expiresAt: exp, active: f.active.checked, sites: sites,
      password: password, ipLock: f.ipLock.checked, maxDevices: Number(f.maxDevices.value) };
    save(c).then(function (ok) { if (ok) $('cl-dialog').close(); });
  });

  // start once the admin is signed in
  window.HasadnaAuth.ready.then(function (s) {
    if (s.role !== 'admin') return;
    fetch('services.json').then(function (r) { return r.json(); }).then(function (cfg) {
      return cfg.pricesApi ? fetch(cfg.pricesApi, { cache: 'no-store' }).then(function (r) { return r.json(); }) : null;
    }).then(function (j) { C.plans = (j && j.prices && j.prices.plans) || {}; }).catch(function () {});
    fetch('projects.json').then(function (r) { return r.json(); }).then(function (d) {
      C.projects = d.projects.filter(function (p) { return !p.pending; });
      C.cats = d.categories;
      load();
    });
  });
})();
