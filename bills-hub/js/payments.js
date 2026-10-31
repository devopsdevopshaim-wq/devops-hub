/* נכסים, מונים ותשלומים: לכל נכס כתובת ושירותים (ספק, מספר מונה, מספר לקוח, מחזור חיוב, יום תשלום),
   ומהם רשימת "מה לשלם עכשיו", קישורי תשלום, תזכורות ליומן (.ics), גיליון מעקב ב-Excel,
   וקריאת חשבון מצילום או PDF דרך שרת ה-n8n של האתרים (Gemini). Uses window.Bills from bills.js. */
(function () {
  'use strict';
  var B = window.Bills;
  if (!B) return;
  var $ = function (s) { return document.querySelector(s); };
  var esc = B.esc, num = B.num, money = B.money;
  var HUB = window.HUB_SERVER || 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-hubs';

  var TYPES = {
    elec:      { name: 'חשמל', icon: '⚡', cycle: 2, meter: true, uom: 'קוט"ש', providers: ['חברת החשמל', 'ספק חשמל פרטי'] },
    water:     { name: 'מים', icon: '💧', cycle: 2, meter: true, uom: 'מ"ק', providers: ['תאגיד המים'] },
    gas:       { name: 'גז', icon: '🔥', cycle: 2, meter: true, uom: 'מ"ק', providers: ['אמישראגז', 'סופרגז', 'פזגז', 'דור גז'] },
    arnona:    { name: 'ארנונה', icon: '🏛️', cycle: 2, providers: ['העירייה / המועצה'] },
    vaad:      { name: 'ועד בית', icon: '🏢', cycle: 1 },
    internet:  { name: 'אינטרנט', icon: '🌐', cycle: 1, providers: ['בזק', 'HOT', 'פרטנר', 'סלקום', 'yes'] },
    tv:        { name: 'טלוויזיה', icon: '📺', cycle: 1, providers: ['HOT', 'yes', 'פרטנר', 'סלקום'] },
    phone:     { name: 'טלפון', icon: '📱', cycle: 1, providers: ['פרטנר', 'סלקום', 'פלאפון', 'בזק'] },
    insurance: { name: 'ביטוח', icon: '🛡️', cycle: 1 },
    rent:      { name: 'שכירות / משכנתא', icon: '🏠', cycle: 1 },
    other:     { name: 'אחר', icon: '🧾', cycle: 1 }
  };
  var QUICK = ['elec', 'water', 'gas', 'arnona', 'vaad', 'internet'];
  var PROVIDER_URLS = {
    'חברת החשמל': 'https://www.iec.co.il/',
    'אמישראגז': 'https://www.amisragas.co.il/',
    'סופרגז': 'https://www.supergas.co.il/',
    'פזגז': 'https://www.pazgas.co.il/',
    'בזק': 'https://www.bezeq.co.il/',
    'HOT': 'https://www.hot.net.il/',
    'yes': 'https://www.yes.co.il/',
    'פרטנר': 'https://www.partner.co.il/',
    'סלקום': 'https://www.cellcom.co.il/'
  };
  var CYCLES = [[1, 'כל חודש'], [2, 'כל חודשיים'], [3, 'כל 3 חודשים'], [6, 'כל חצי שנה'], [12, 'פעם בשנה']];
  var METHODS = [['manual', 'משלם בעצמי'], ['standing', 'הוראת קבע'], ['card', 'חיוב קבוע באשראי']];

  function db() { return B.db(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function mIdx(m) { var p = String(m).split('-'); return +p[0] * 12 + (+p[1] - 1); }
  function mStr(i) { return Math.floor(i / 12) + '-' + pad(i % 12 + 1); }
  function lastDay(m) { var p = m.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  function parseDate(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function fmtDate(s) { return parseDate(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }); }
  function days(s) { return Math.round((parseDate(s) - today()) / 86400000); }
  function type(s) { return TYPES[s.type] || TYPES.other; }
  function label(s) { return (s.name || '').trim() || type(s).name; }
  function propName(p) { return (p.name || '').trim() || (p.address || '').trim() || 'נכס ללא שם'; }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(parseDate(s)); }

  function newService(t, extra) {
    var T = TYPES[t] || TYPES.other;
    return Object.assign({
      id: uid(), type: t, name: '', provider: (T.providers || [''])[0] === 'תאגיד המים' || (T.providers || [''])[0] === 'העירייה / המועצה' ? '' : (T.providers || [''])[0],
      meterNo: '', customerNo: '', cycle: T.cycle, dueDay: 15, startMonth: B.thisMonth(), amount: '', method: 'manual', payUrl: ''
    }, extra || {});
  }

  // ---------- where to pay ----------
  function payLink(p, s) {
    if (/^https:\/\//.test(s.payUrl || '')) return s.payUrl;
    if (PROVIDER_URLS[(s.provider || '').trim()]) return PROVIDER_URLS[s.provider.trim()];
    var city = (p.city || '').trim();
    var q;
    if (s.type === 'water') q = 'תשלום חשבון מים תאגיד המים ' + city;
    else if (s.type === 'arnona') q = 'תשלום ארנונה ' + (city || 'עירייה');
    else q = 'תשלום חשבון ' + ((s.provider || '').trim() || label(s));
    return 'https://www.google.com/search?q=' + encodeURIComponent(q.trim());
  }

  // ---------- amounts ----------
  // What the bill due in `month` is expected to be: from the month records of the property
  // (the cycle's months before it), else the amount typed on the service.
  function estimate(p, s, month) {
    var name = (p.name || '').trim(), c = +s.cycle || 1, names = [label(s), type(s).name];
    function from(months) {
      var sum = 0, found = false;
      months.forEach(function (m) {
        var r = B.find(m, name);
        if (!r) return;
        if (type(s).meter) {
          var mt = r.meters.find(function (x) { return names.indexOf((x.name || '').trim()) >= 0; });
          if (mt && B.meterUsed(mt)) { sum += B.calcMeter(mt, r.vatPct).amount; found = true; }
        } else {
          r.fixed.forEach(function (f) { if (names.indexOf((f.name || '').trim()) >= 0 && num(f.amount)) { sum += num(f.amount); found = true; } });
        }
      });
      return found ? B.r2(sum) : null;
    }
    var i = mIdx(month), before = [], incl = [];
    for (var k = c; k >= 1; k--) before.push(mStr(i - k));
    for (k = c - 1; k >= 0; k--) incl.push(mStr(i - k));
    var v = from(before);
    if (v === null) v = from(incl);
    if (v !== null) return { amount: v, basis: 'readings' };
    if (B.has(s.amount)) return { amount: num(s.amount), basis: 'typed' };
    return { amount: null, basis: 'none' };
  }

  // ---------- the payments ----------
  // Every expected payment from each service's start month to `ahead` months from now,
  // plus bills read from a picture that fall off the schedule.
  function instances(ahead) {
    var out = [], seen = {}, now = mIdx(B.thisMonth()), dues = db().dues;
    function push(p, s, month, o) {
      var key = s.id + '|' + month;
      if (seen[key] || o.skip) return;
      seen[key] = 1;
      var date = validDate(o.date) ? o.date : month + '-' + pad(Math.min(Math.max(1, +s.dueDay || 15), lastDay(month)));
      var exact = B.has(o.amount), est = exact ? null : estimate(p, s, month);
      out.push({
        key: key, p: p, s: s, month: month, date: date,
        amount: exact ? num(o.amount) : est.amount, basis: exact ? 'bill' : est.basis,
        paidAt: o.paidAt || '', paidAmount: o.paidAmount, auto: s.method === 'standing' || s.method === 'card' || !!o.auto,
        period: o.period || ''
      });
    }
    db().properties.forEach(function (p) {
      (p.services || []).forEach(function (s) {
        var c = Math.max(1, +s.cycle || 1), start = mIdx(/^\d{4}-\d{2}$/.test(s.startMonth || '') ? s.startMonth : B.thisMonth());
        for (var i = start; i <= now + ahead; i += c) push(p, s, mStr(i), dues[s.id + '|' + mStr(i)] || {});
      });
    });
    Object.keys(dues).forEach(function (k) {
      var parts = k.split('|'), ps = findService(parts[0]);
      if (ps && /^\d{4}-\d{2}$/.test(parts[1]) && mIdx(parts[1]) <= now + ahead) push(ps.p, ps.s, parts[1], dues[k]);
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function findService(id) {
    var r = null;
    db().properties.some(function (p) {
      var s = (p.services || []).find(function (x) { return x.id === id; });
      if (s) r = { p: p, s: s };
      return !!s;
    });
    return r;
  }
  function status(x) {
    if (x.paidAt) return 'paid';
    var d = days(x.date);
    if (x.auto) return d < 0 ? 'auto-done' : 'auto';
    if (d < 0) return 'late';
    if (d <= 14) return 'soon';
    return 'later';
  }
  function setDue(key, patch) {
    var d = db().dues;
    d[key] = Object.assign({}, d[key] || {}, patch);
    Object.keys(d[key]).forEach(function (k) { if (d[key][k] === undefined) delete d[key][k]; });
    B.persist();
  }

  // ---------- "לתשלום" ----------
  function renderDue() {
    var f = $('#due-unit').value || '*';
    var props = db().properties;
    $('#due-unit').innerHTML = '<option value="*">כל הנכסים</option>' + props.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(propName(p)) + '</option>';
    }).join('');
    $('#due-unit').value = props.some(function (p) { return p.id === f; }) ? f : '*';
    f = $('#due-unit').value;
    $('#due-unit').closest('.fld').hidden = props.length < 2;

    if (!props.length || !props.some(function (p) { return (p.services || []).length; })) {
      heroStatus(null);
      $('#due-tiles').innerHTML = '';
      $('#due-list').innerHTML = '<div class="card empty-state">' +
        '<div class="empty-big">🧾</div><h2>עוד אין תשלומים למעקב</h2>' +
        '<p>הוסיפו נכס (כתובת) ואת השירותים שלו: חשמל, מים, גז, ארנונה ועוד, עם מספר מונה, מספר לקוח ויום תשלום.<br>' +
        'או פשוט צלמו חשבון שקיבלתם, והאתר ימלא את הפרטים לבד.</p>' +
        '<div class="actions center"><button type="button" class="btn primary" data-go="scan">📷 צלם חשבון</button>' +
        '<button type="button" class="btn" data-go="props">+ הוסף נכס ושירותים</button></div></div>';
      return;
    }

    var all = instances(2).filter(function (x) { return f === '*' || x.p.id === f; });
    var groups = { late: [], soon: [], later: [], auto: [], paid: [] };
    all.forEach(function (x) {
      var st = status(x);
      if (st === 'late') groups.late.push(x);
      else if (st === 'soon') groups.soon.push(x);
      else if (st === 'later') { if (days(x.date) <= 62) groups.later.push(x); }
      else if (st === 'auto') { if (days(x.date) <= 45) groups.auto.push(x); }
      else if (st === 'paid' || st === 'auto-done') {
        var ref = x.paidAt ? x.paidAt.slice(0, 10) : x.date;
        if (days(ref) >= -60) groups.paid.push(x);
      }
    });
    groups.paid.sort(function (a, b) { return (b.paidAt || b.date) < (a.paidAt || a.date) ? -1 : 1; });
    heroStatus(groups);
    function sum(list) { return list.reduce(function (t, x) { return t + (x.amount || 0); }, 0); }
    function unknown(list) { return list.some(function (x) { return x.amount === null; }); }
    function tile(cls, title, list, note) {
      return '<div class="tile ' + cls + '"><div class="tile-t">' + title + '</div>' +
        '<div class="tile-v">' + money(sum(list)) + (unknown(list) ? '<small> +?</small>' : '') + '</div>' +
        '<div class="tile-n">' + list.length + ' ' + (list.length === 1 ? 'חשבון' : 'חשבונות') + (note ? ' · ' + note : '') + '</div></div>';
    }
    $('#due-tiles').innerHTML =
      tile('late', 'באיחור', groups.late) +
      tile('soon', 'לתשלום ב-14 הימים הקרובים', groups.soon) +
      tile('auto', 'יורד אוטומטית', groups.auto, 'הוראת קבע / אשראי') +
      tile('paid', 'שולם לאחרונה', groups.paid);

    function section(title, list, cls, emptyText) {
      if (!list.length && !emptyText) return '';
      return '<h2 class="sec ' + cls + '">' + title + '</h2>' +
        (list.length ? '<div class="due-list">' + list.map(row).join('') + '</div>' : '<p class="hint">' + emptyText + '</p>');
    }
    $('#due-list').innerHTML =
      section('⚠️ באיחור — לשלם עכשיו', groups.late, 'late') +
      section('לתשלום בקרוב', groups.soon, 'soon', groups.late.length ? '' : 'אין חשבונות לתשלום בשבועיים הקרובים. 👌') +
      section('בהמשך', groups.later, '') +
      section('יורד אוטומטית', groups.auto, '') +
      section('שולם', groups.paid, 'paid');
  }

  // the summary in the top panel, and which utilities the 3D scene marks as late
  function heroStatus(groups) {
    var box = $('#hero-stats');
    var late = [], status = { late: late };
    if (groups) groups.late.forEach(function (x) { if (late.indexOf(x.s.type) < 0) late.push(x.s.type); });
    window.__billsStatus = status;
    window.dispatchEvent(new CustomEvent('bills:status', { detail: status }));
    if (!box) return;
    if (!groups) {
      box.innerHTML = '<span class="stat"><b>מתחילים</b><small>צלמו חשבון או הוסיפו נכס</small></span>';
      return;
    }
    function sum(l) { return l.reduce(function (t, x) { return t + (x.amount || 0); }, 0); }
    var open = groups.late.concat(groups.soon);
    box.innerHTML =
      '<span class="stat"><b>' + money(sum(open)) + '</b><small>לתשלום עכשיו ובקרוב</small></span>' +
      '<span class="stat' + (groups.late.length ? ' bad' : '') + '"><b>' + groups.late.length + '</b><small>' + (groups.late.length === 1 ? 'חשבון באיחור' : 'חשבונות באיחור') + '</small></span>' +
      '<span class="stat"><b>' + money(sum(groups.auto)) + '</b><small>יורד אוטומטית</small></span>';
  }

  function row(x) {
    var st = status(x), T = type(x.s), d = days(x.date);
    var when = st === 'paid' ? 'שולם ' + (x.paidAt ? fmtDate(x.paidAt.slice(0, 10)) : '')
      : st === 'auto-done' ? 'ירד ב-' + fmtDate(x.date)
      : d < 0 ? 'באיחור של ' + (-d) + ' ' + (d === -1 ? 'יום' : 'ימים')
      : d === 0 ? 'היום' : d === 1 ? 'מחר' : 'בעוד ' + d + ' ימים';
    var amt = x.amount === null ? '<span class="amt unknown">סכום לא ידוע</span>'
      : '<span class="amt">' + money(st === 'paid' && B.has(x.paidAmount) ? num(x.paidAmount) : x.amount) + '</span>' +
        (x.basis === 'bill' ? '<span class="tag-src bill">מהחשבון</span>' : x.basis === 'readings' ? '<span class="tag-src">משוער מהקריאות</span>' : '<span class="tag-src">משוער</span>');
    var meta = [esc(propName(x.p))];
    if ((x.s.provider || '').trim()) meta.push(esc(x.s.provider));
    if ((x.s.meterNo || '').trim()) meta.push('מונה ' + esc(x.s.meterNo));
    if ((x.s.customerNo || '').trim()) meta.push('לקוח ' + esc(x.s.customerNo));
    var btns = st === 'paid' || st === 'auto-done'
      ? '<button type="button" class="btn small" data-unpay="' + esc(x.key) + '">בטל סימון</button>'
      : '<a class="btn small pay" href="' + esc(payLink(x.p, x.s)) + '" target="_blank" rel="noopener">לתשלום ↗</a>' +
        '<button type="button" class="btn small" data-paid="' + esc(x.key) + '">✓ שולם</button>' +
        '<button type="button" class="btn small" data-remind="' + esc(x.key) + '" title="תזכורת בוואטסאפ" aria-label="תזכורת בוואטסאפ">💬</button>';
    return '<div class="due ' + st + '">' +
      '<span class="due-icon">' + T.icon + '</span>' +
      '<div class="due-main"><div class="due-title">' + esc(label(x.s)) + (x.period ? ' <small>' + esc(x.period) + '</small>' : '') + '</div>' +
      '<div class="due-meta">' + meta.join(' · ') + '</div></div>' +
      '<div class="due-side"><div>' + amt + '</div><div class="due-when">' + fmtDate(x.date) + ' · ' + when + '</div></div>' +
      '<div class="due-btns">' + btns + '</div></div>';
  }

  function byKey(key) { return instances(14).find(function (x) { return x.key === key; }); }

  $('#due-list').addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) {
      if (go.dataset.go === 'scan') openScan();
      else { if (!db().properties.length) addProperty({ name: 'הבית' }); B.showTab('props'); }
      return;
    }
    var b = e.target.closest('[data-paid],[data-unpay],[data-remind]');
    if (!b) return;
    if (b.dataset.paid) {
      var x = byKey(b.dataset.paid);
      if (!x) return;
      var v = prompt('כמה שולם? (₪)', x.amount === null ? '' : B.r2(x.amount));
      if (v === null) return;
      setDue(x.key, { paidAt: new Date().toISOString(), paidAmount: B.has(v) ? num(v) : undefined });
      B.toast('סומן כשולם: ' + label(x.s));
    } else if (b.dataset.unpay) {
      setDue(b.dataset.unpay, { paidAt: undefined, paidAmount: undefined });
    } else if (b.dataset.remind) {
      var y = byKey(b.dataset.remind);
      if (y) waOpen(reminderText([y]));
      return;
    }
    renderDue();
  });
  $('#due-unit').addEventListener('change', renderDue);

  function reminderText(list) {
    var lines = ['*תשלומים לביצוע*'];
    list.forEach(function (x) {
      lines.push(type(x.s).icon + ' ' + label(x.s) + ' — ' + propName(x.p) + ': ' +
        (x.amount === null ? 'סכום לא ידוע' : (x.basis === 'bill' ? '' : '≈') + money(x.amount)) + ' עד ' + fmtDate(x.date) +
        ((x.s.customerNo || '').trim() ? ' (לקוח ' + x.s.customerNo + ')' : ''));
    });
    var t = list.reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    if (list.length > 1) lines.push('', '*סה"כ: ' + money(t) + '*');
    return lines.join('\n');
  }
  function waOpen(text) { window.open('https://wa.me/' + B.waPhone() + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  $('#due-wa').addEventListener('click', function () {
    var f = $('#due-unit').value || '*';
    var list = instances(1).filter(function (x) {
      var st = status(x);
      return (f === '*' || x.p.id === f) && (st === 'late' || st === 'soon');
    });
    if (!list.length) { B.toast('אין כרגע חשבונות פתוחים לשליחה'); return; }
    waOpen(reminderText(list));
  });

  // ---------- calendar reminders ----------
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    var out = [], enc = new TextEncoder(), cur = '';
    Array.from(line).forEach(function (ch) {
      if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
    });
    out.push(cur);
    return out.join('\r\n ');
  }
  $('#ics').addEventListener('click', function () {
    var list = instances(6).filter(function (x) { var st = status(x); return (st === 'soon' || st === 'later' || st === 'late') && days(x.date) >= -1; });
    if (!list.length) { B.toast('אין תשלומים קרובים להוסיף ליומן. הוסיפו שירותים בלשונית נכסים ומונים.'); return; }
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bills-hub//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:תשלומים חודשיים'];
    list.forEach(function (x) {
      var d = parseDate(x.date), n = new Date(d.getTime() + 86400000);
      var title = 'לתשלום: ' + label(x.s) + ' — ' + propName(x.p) + (x.amount === null ? '' : ' (' + (x.basis === 'bill' ? '' : '≈') + B.plain(x.amount) + ' ₪)');
      var desc = [x.s.provider, x.s.customerNo ? 'מספר לקוח ' + x.s.customerNo : '', x.s.meterNo ? 'מונה ' + x.s.meterNo : '', payLink(x.p, x.s)].filter(Boolean).join('\n');
      L.push('BEGIN:VEVENT', 'UID:' + x.key.replace(/[^A-Za-z0-9-]/g, '-') + '@bills-hub', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + isoDate(d).replace(/-/g, ''), 'DTEND;VALUE=DATE:' + isoDate(n).replace(/-/g, ''),
        'SUMMARY:' + icsText(title), 'DESCRIPTION:' + icsText(desc),
        'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    B.download(new File([L.map(fold).join('\r\n') + '\r\n'], 'תזכורות-תשלומים.ics', { type: 'text/calendar' }));
    B.toast(list.length + ' תזכורות ירדו. פתחו את הקובץ כדי להוסיף אותן ליומן.');
  });

  // ---------- properties ----------
  function addProperty(extra) {
    var p = Object.assign({ id: uid(), name: '', address: '', city: '', services: [] }, extra || {});
    db().properties.push(p);
    B.persist();
    return p;
  }
  function renderProps() {
    var list = db().properties;
    $('#props').innerHTML = !list.length ? '<div class="card empty-state"><div class="empty-big">🏠</div>' +
      '<p>עוד אין נכסים. הוסיפו נכס, או צלמו חשבון בלשונית "לתשלום" והנכס ייווצר לבד.</p></div>' : list.map(function (p) {
      return '<div class="card prop" data-p="' + esc(p.id) + '">' +
        '<div class="prop-head"><span class="prop-icon">🏠</span>' +
          '<input class="name" data-pk="name" value="' + esc(p.name) + '" placeholder="שם הנכס (למשל: הבית, דירה 3, משפחת כהן)" aria-label="שם הנכס" />' +
          '<button type="button" class="icon-btn" data-del-prop title="מחק נכס" aria-label="מחק נכס">🗑️</button></div>' +
        '<div class="grid2">' +
          '<label class="fld"><span>כתובת</span><input data-pk="address" value="' + esc(p.address) + '" placeholder="רחוב ומספר" autocomplete="street-address" /></label>' +
          '<label class="fld"><span>עיר / יישוב <small>(לקישורי תאגיד המים והארנונה)</small></span><input data-pk="city" value="' + esc(p.city) + '" placeholder="למשל: חיפה" autocomplete="address-level2" /></label>' +
        '</div>' +
        '<div class="svcs">' + (p.services || []).map(function (s) { return svcHtml(p, s); }).join('') + '</div>' +
        '<div class="quick"><span>הוסף:</span>' + QUICK.concat(['tv', 'phone', 'insurance', 'rent', 'other']).map(function (t) {
          return '<button type="button" class="chip" data-add="' + t + '">' + TYPES[t].icon + ' ' + TYPES[t].name + '</button>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');
  }
  function opt(list, v) {
    return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  function svcHtml(p, s) {
    var T = type(s), dl = 'prov-' + s.id;
    return '<div class="svc" data-s="' + esc(s.id) + '">' +
      '<div class="svc-head"><span class="svc-icon">' + T.icon + '</span>' +
        '<select data-sk="type" aria-label="סוג">' + Object.keys(TYPES).map(function (k) {
          return '<option value="' + k + '"' + (k === s.type ? ' selected' : '') + '>' + TYPES[k].name + '</option>';
        }).join('') + '</select>' +
        '<input data-sk="name" value="' + esc(s.name) + '" placeholder="' + esc(T.name) + ' (שם אחר, לא חובה)" aria-label="שם" />' +
        '<button type="button" class="icon-btn" data-del-svc title="הסר" aria-label="הסר">✕</button></div>' +
      '<div class="svc-grid">' +
        '<label class="fld"><span>ספק</span><input data-sk="provider" list="' + dl + '" value="' + esc(s.provider) + '" placeholder="' + esc((T.providers || ['שם הספק'])[0]) + '" />' +
          '<datalist id="' + dl + '">' + (T.providers || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></label>' +
        (T.meter ? '<label class="fld"><span>מספר מונה</span><input data-sk="meterNo" value="' + esc(s.meterNo) + '" inputmode="numeric" /></label>' : '') +
        '<label class="fld"><span>מספר לקוח / חוזה' + (s.type === 'arnona' ? ' / נכס' : '') + '</span><input data-sk="customerNo" value="' + esc(s.customerNo) + '" inputmode="numeric" /></label>' +
        '<label class="fld"><span>חשבון מגיע</span><select data-sk="cycle">' + opt(CYCLES, s.cycle) + '</select></label>' +
        '<label class="fld"><span>יום התשלום בחודש</span><input type="number" min="1" max="31" data-sk="dueDay" value="' + esc(s.dueDay) + '" /></label>' +
        '<label class="fld"><span>החשבון הבא בחודש</span><input type="month" data-sk="startMonth" value="' + esc(s.startMonth) + '" /></label>' +
        '<label class="fld"><span>סכום משוער (₪)' + (T.meter ? ' <small>אם אין קריאות</small>' : '') + '</span><input type="number" step="any" inputmode="decimal" data-sk="amount" value="' + esc(s.amount) + '" /></label>' +
        '<label class="fld"><span>אופן תשלום</span><select data-sk="method">' + opt(METHODS, s.method) + '</select></label>' +
        '<label class="fld wide"><span>קישור לתשלום <small>(לא חובה)</small></span><input type="url" data-sk="payUrl" value="' + esc(s.payUrl) + '" placeholder="https://" dir="ltr" /></label>' +
      '</div></div>';
  }
  function propOf(el) { var c = el.closest('[data-p]'); return c && db().properties.find(function (p) { return p.id === c.dataset.p; }); }
  function svcOf(p, el) { var c = el.closest('[data-s]'); return c && p.services.find(function (s) { return s.id === c.dataset.s; }); }
  var saveT;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(function () { B.persist(); B.refreshUnits(); }, 300); }

  $('#props').addEventListener('input', function (e) {
    var p = propOf(e.target);
    if (!p) return;
    var t = e.target;
    if (t.dataset.pk) {
      if (t.dataset.pk === 'name') renameUnit(p, t.value);
      p[t.dataset.pk] = t.value;
    } else if (t.dataset.sk && t.dataset.sk !== 'type') {
      var s = svcOf(p, t);
      if (!s) return;
      s[t.dataset.sk] = t.dataset.sk === 'cycle' ? +t.value : t.value;
    }
    saveSoon();
  });
  // a property renamed keeps its months: the month records carry the name
  function renameUnit(p, to) {
    var from = (p.name || '').trim();
    to = (to || '').trim();
    if (!from || from === to) return;
    var clash = db().records.some(function (r) { return (r.unit || '') === to; });
    if (clash) return;
    db().records.forEach(function (r) { if ((r.unit || '') === from) { r.unit = to; r.id = r.month + '|' + to; } });
  }
  $('#props').addEventListener('change', function (e) {
    var t = e.target, p = propOf(t);
    if (!p || t.dataset.sk !== 'type') return;
    var s = svcOf(p, t), T = TYPES[t.value] || TYPES.other;
    s.type = t.value;
    s.cycle = T.cycle;
    if (!(s.provider || '').trim() || Object.keys(TYPES).some(function (k) { return (TYPES[k].providers || []).indexOf(s.provider) >= 0; })) s.provider = newService(t.value).provider;
    B.persist();
    renderProps();
  });
  $('#props').addEventListener('click', function (e) {
    var t = e.target, p = propOf(t);
    if (!p) return;
    if (t.closest('[data-add]')) {
      p.services.push(newService(t.closest('[data-add]').dataset.add));
      B.persist(); renderProps();
    } else if (t.closest('[data-del-svc]')) {
      var s = svcOf(p, t);
      if (!confirm('להסיר את "' + label(s) + '" מהנכס?')) return;
      p.services = p.services.filter(function (x) { return x !== s; });
      Object.keys(db().dues).forEach(function (k) { if (k.indexOf(s.id + '|') === 0) delete db().dues[k]; });
      B.persist(); renderProps();
    } else if (t.closest('[data-del-prop]')) {
      if (!confirm('למחוק את הנכס "' + propName(p) + '" ואת השירותים שלו? (החודשים שנשמרו בהיסטוריה נשארים)')) return;
      p.services.forEach(function (s) { Object.keys(db().dues).forEach(function (k) { if (k.indexOf(s.id + '|') === 0) delete db().dues[k]; }); });
      db().properties = db().properties.filter(function (x) { return x !== p; });
      B.persist(); renderProps(); B.refreshUnits();
    }
  });
  $('#add-prop').addEventListener('click', function () {
    addProperty();
    renderProps();
    var all = document.querySelectorAll('.prop .name');
    all[all.length - 1].focus();
  });

  // ---------- reading a bill from a picture or PDF ----------
  var PROMPT = [
    'זהו חשבון ישראלי (חשמל, מים, גז, ארנונה, ועד בית, אינטרנט, טלוויזיה, טלפון או אחר). קרא אותו והחזר JSON בלבד, בלי שום טקסט נוסף ובלי ```, במבנה הזה:',
    '{"type":"elec|water|gas|arnona|vaad|internet|tv|phone|insurance|other","provider":"","customer_number":"","contract_number":"","meter_number":"",',
    '"address":"","city":"","period_from":"YYYY-MM-DD","period_to":"YYYY-MM-DD","prev_reading":null,"curr_reading":null,"consumption":null,"unit":"",',
    '"amount_due":null,"due_date":"YYYY-MM-DD","standing_order":false,"billing_months":null}',
    'כללים: מספרים כמספרים בלי פסיקים ובלי ₪. amount_due הוא הסכום הכולל לתשלום בחשבון הזה. standing_order=true אם כתוב שהחשבון ייגבה בהוראת קבע או באשראי.',
    'billing_months הוא אורך תקופת החיוב בחודשים (1 או 2 בדרך כלל). מספרי לקוח, חוזה ומונה כטקסט בדיוק כפי שמופיעים. שדה שאינו מופיע: null. אם אין חשבון בתמונה החזר {"error":"not-a-bill"}.'
  ].join('\n');
  var AI_ERR = {
    quota: 'המכסה היומית של קריאת החשבונות נגמרה. נסו שוב מחר, או מלאו ידנית.',
    'rate-limited': 'יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות.',
    'no-key': 'קריאת חשבונות אוטומטית עדיין לא הופעלה בשרת. בינתיים מלאו את הפרטים ידנית.',
    offline: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
    forbidden: 'הקריאה האוטומטית עובדת רק מהכתובת של האתר ב-GitHub Pages.',
    'too-big': 'הקובץ גדול מדי. נסו תמונה, או PDF קטן מ-4MB.',
    'bad-image': 'סוג הקובץ לא נתמך. בחרו תמונה (JPG/PNG) או PDF.'
  };
  var scanned = null;

  function openScan() {
    var props = db().properties;
    $('#scan-prop').innerHTML = props.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(propName(p)) + '</option>'; }).join('') +
      '<option value="new">+ נכס חדש (לפי הכתובת שבחשבון)</option>';
    $('#scan-prop').value = props.length ? ($('#due-unit').value !== '*' ? $('#due-unit').value : props[0].id) : 'new';
    $('#scan-file').value = '';
    $('#scan-status').textContent = '';
    $('#scan-status').className = 'scan-status';
    $('#scan-result').hidden = true;
    $('#scan-apply').hidden = true;
    $('#scan-drop').hidden = false;
    scanned = null;
    var dlg = $('#scan');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  $('#scan-open').addEventListener('click', openScan);
  $('#hero-scan').addEventListener('click', openScan);
  $('#hero-bill').addEventListener('click', function () {
    B.showTab('bill');
    document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function prepFile(f) {
    return new Promise(function (res, rej) {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        if (f.size > 4 * 1024 * 1024) return rej(new Error('too-big'));
        var r = new FileReader();
        r.onload = function () { res({ data: String(r.result).split(',')[1], mime: 'application/pdf' }); };
        r.onerror = function () { rej(new Error('bad-image')); };
        r.readAsDataURL(f);
        return;
      }
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res({ data: c.toDataURL('image/jpeg', 0.86).split(',')[1], mime: 'image/jpeg', preview: c.toDataURL('image/jpeg', 0.5) });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad-image')); };
      img.src = url;
    });
  }
  function askServer(payload) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 100000);
    return fetch(HUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: r.status === 413 ? 'too-big' : 'bad-response' }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; })
      .then(function (j) { clearTimeout(t); return j; });
  }
  function parseJson(text) {
    var t = String(text || '').replace(/```(?:json)?/gi, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }
  function cleanNum(v) {
    if (v === null || v === undefined || v === '') return '';
    var n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : '';
  }
  function cleanDate(v) { return validDate(v) ? v : ''; }

  $('#scan-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var st = $('#scan-status');
    st.className = 'scan-status busy';
    st.textContent = 'קורא את החשבון… (עד חצי דקה)';
    $('#scan-result').hidden = true;
    $('#scan-apply').hidden = true;
    prepFile(f).then(function (file) {
      return askServer({ action: 'ai', tag: 'bills', prompt: PROMPT, image: file.data, mime: file.mime });
    }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || 'ai-failed');
      var d = parseJson(j.text);
      if (!d) throw new Error('unreadable');
      if (d.error) throw new Error('not-a-bill');
      scanned = {
        type: TYPES[d.type] ? d.type : 'other', provider: String(d.provider || '').trim(),
        customerNo: String(d.customer_number || d.contract_number || '').trim(), meterNo: String(d.meter_number || '').trim(),
        address: String(d.address || '').trim(), city: String(d.city || '').trim(),
        from: cleanDate(d.period_from), to: cleanDate(d.period_to), prev: cleanNum(d.prev_reading), curr: cleanNum(d.curr_reading),
        amount: cleanNum(d.amount_due), due: cleanDate(d.due_date), standing: d.standing_order === true,
        months: [1, 2, 3, 6, 12].indexOf(+d.billing_months) >= 0 ? +d.billing_months : ''
      };
      st.className = 'scan-status ok';
      st.textContent = 'נקרא. בדקו שהפרטים נכונים, תקנו אם צריך ושמרו.';
      showScanned();
    }).catch(function (err) {
      var code = err && err.message;
      st.className = 'scan-status err';
      st.textContent = AI_ERR[code] || (code === 'not-a-bill' ? 'לא זיהיתי חשבון בקובץ. נסו צילום ישר וברור יותר של עמוד הסיכום.'
        : code === 'unreadable' ? 'לא הצלחתי לקרוא את החשבון. נסו צילום חד יותר, או את קובץ ה-PDF המקורי.'
        : 'הקריאה לא הצליחה כרגע. נסו שוב בעוד רגע.');
    });
  });

  function showScanned() {
    var s = scanned, T = TYPES[s.type];
    function f(k, lbl, v, typ) {
      return '<label class="fld"><span>' + lbl + '</span><input data-r="' + k + '" value="' + esc(v) + '"' + (typ ? ' type="' + typ + '"' : '') + (typ === 'number' ? ' step="any"' : '') + ' /></label>';
    }
    $('#scan-result').innerHTML = '<div class="card scan-card">' +
      '<div class="svc-head"><span class="svc-icon">' + T.icon + '</span><select data-r="type">' + Object.keys(TYPES).map(function (k) {
        return '<option value="' + k + '"' + (k === s.type ? ' selected' : '') + '>' + TYPES[k].name + '</option>';
      }).join('') + '</select></div>' +
      '<div class="svc-grid">' +
        f('provider', 'ספק', s.provider) + f('customerNo', 'מספר לקוח / חוזה', s.customerNo) + f('meterNo', 'מספר מונה', s.meterNo) +
        f('amount', 'סכום לתשלום (₪)', s.amount, 'number') + f('due', 'לתשלום עד', s.due, 'date') +
        f('prev', 'קריאה קודמת', s.prev, 'number') + f('curr', 'קריאה נוכחית', s.curr, 'number') +
        f('from', 'תקופה מ-', s.from, 'date') + f('to', 'עד', s.to, 'date') +
        f('address', 'כתובת בחשבון', s.address) + f('city', 'עיר', s.city) +
        '<label class="check"><input type="checkbox" data-r="standing"' + (s.standing ? ' checked' : '') + ' /> נגבה בהוראת קבע / אשראי</label>' +
      '</div></div>';
    $('#scan-result').hidden = false;
    $('#scan-apply').hidden = false;
  }
  $('#scan-result').addEventListener('input', function (e) {
    var k = e.target.dataset.r;
    if (!k || !scanned) return;
    scanned[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  });
  $('#scan-result').addEventListener('change', function (e) {
    if (e.target.dataset.r === 'type' && scanned) { scanned.type = e.target.value; showScanned(); }
    if (e.target.type === 'checkbox' && scanned) scanned.standing = e.target.checked;
  });

  $('#scan-apply').addEventListener('click', function () {
    var s = scanned;
    if (!s) return;
    if (!validDate(s.due) && !B.has(s.amount) && !(B.has(s.prev) && B.has(s.curr))) { B.toast('חסרים סכום, תאריך או קריאות. השלימו לפחות אחד מהם.'); return; }
    var pid = $('#scan-prop').value, p = db().properties.find(function (x) { return x.id === pid; });
    if (!p) p = addProperty({ name: s.address || (s.city ? 'נכס ב' + s.city : 'הבית'), address: s.address, city: s.city });
    if (!(p.name || '').trim()) p.name = s.address || (p.address || '').trim() || (s.city ? 'נכס ב' + s.city : 'הבית');
    if (!(p.address || '').trim() && s.address) p.address = s.address;
    if (!(p.city || '').trim() && s.city) p.city = s.city;

    // the service: same type, and the same meter or customer number when both sides have one
    var svc = p.services.find(function (x) {
      if (x.type !== s.type) return false;
      if (s.meterNo && x.meterNo) return x.meterNo === s.meterNo;
      if (s.customerNo && x.customerNo) return x.customerNo === s.customerNo;
      return true;
    });
    var dueMonth = validDate(s.due) ? s.due.slice(0, 7) : (validDate(s.to) ? s.to.slice(0, 7) : B.thisMonth());
    if (!svc) {
      svc = newService(s.type, { startMonth: dueMonth });
      p.services.push(svc);
    }
    if (s.provider) svc.provider = s.provider;
    if (s.meterNo) svc.meterNo = s.meterNo;
    if (s.customerNo) svc.customerNo = s.customerNo;
    if (s.months) svc.cycle = s.months;
    if (validDate(s.due)) svc.dueDay = +s.due.slice(8, 10);
    if (s.standing && svc.method === 'manual') svc.method = 'standing';
    if (B.has(s.amount)) svc.amount = num(s.amount);

    var key = svc.id + '|' + dueMonth;
    var period = s.from && s.to ? fmtDate(s.from) + '–' + fmtDate(s.to) : '';
    setDue(key, { amount: B.has(s.amount) ? num(s.amount) : undefined, date: validDate(s.due) ? s.due : undefined, period: period || undefined, source: 'bill', auto: s.standing || undefined });

    // the readings go to the month the period ends in, so the monthly bill and the history show them
    if (type(svc).meter && B.has(s.prev) && B.has(s.curr)) {
      var month = (validDate(s.to) ? s.to : validDate(s.due) ? s.due : B.thisMonth() + '-01').slice(0, 7);
      var unit = (p.name || '').trim();
      var rec = B.find(month, unit);
      rec = rec ? JSON.parse(JSON.stringify(rec)) : B.freshRecord(month, unit);
      var T = type(svc), names = [label(svc), T.name];
      var m = rec.meters.find(function (x) { return names.indexOf((x.name || '').trim()) >= 0; });
      if (!m) { m = { icon: T.icon, name: T.name, uom: T.uom || '', prev: '', curr: '', rate: '', fixed: '', vat: false }; rec.meters.push(m); }
      m.prev = num(s.prev); m.curr = num(s.curr);
      var cons = num(s.curr) - num(s.prev);
      // with the billed amount and the consumption, the rate that makes them agree (fixed charges included)
      if (B.has(s.amount) && cons > 0) { m.rate = Math.round(num(s.amount) / cons * 1e6) / 1e6; m.fixed = ''; m.vat = false; }
      B.storeRecord(rec);
    }
    B.persist();
    B.refreshUnits();
    var dlg = $('#scan');
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    B.toast('נשמר: ' + label(svc) + ' — ' + propName(p));
    B.showTab('due');
  });

  // ---------- for the bill page and the Excel file ----------
  function meterInfo(unit, meterName) {
    unit = (unit || '').trim();
    var p = db().properties.find(function (x) { return (x.name || '').trim() === unit; });
    if (!p) return '';
    var s = p.services.find(function (x) { return type(x).meter && (label(x) === (meterName || '').trim() || type(x).name === (meterName || '').trim()); });
    if (!s) return '';
    return [s.meterNo ? 'מונה ' + s.meterNo : '', s.provider, s.customerNo ? 'לקוח ' + s.customerNo : ''].filter(Boolean).join(' · ');
  }
  function sheet() {
    if (!db().properties.length) return null;
    var head = ['נכס', 'כתובת', 'שירות', 'ספק', 'מספר מונה', 'מספר לקוח', 'לתשלום עד', 'סכום ₪', 'מקור הסכום', 'סטטוס', 'שולם ב', 'סכום ששולם ₪'];
    var rows = [head.map(function (h) { return { v: h, s: 'head' }; })];
    var ST = { paid: 'שולם', 'auto-done': 'ירד אוטומטית', auto: 'יירד אוטומטית', late: 'באיחור', soon: 'לתשלום בקרוב', later: 'עתידי' };
    var SRC = { bill: 'מהחשבון', readings: 'משוער מהקריאות', typed: 'משוער', none: '' };
    instances(2).forEach(function (x) {
      rows.push([propName(x.p), [x.p.address, x.p.city].filter(Boolean).join(', '), label(x.s), x.s.provider || '', x.s.meterNo || '', x.s.customerNo || '',
        fmtDate(x.date), x.amount === null ? null : { v: B.r2(x.amount), s: 'money' }, SRC[x.basis] || '', ST[status(x)] || '',
        x.paidAt ? fmtDate(x.paidAt.slice(0, 10)) : '', B.has(x.paidAmount) ? { v: num(x.paidAmount), s: 'money' } : null]);
    });
    return { name: 'מעקב תשלומים', cols: [18, 24, 12, 16, 14, 14, 12, 12, 16, 14, 11, 14], rows: rows };
  }
  function render() { renderDue(); renderProps(); }

  window.BillsPayments = { render: render, meterInfo: meterInfo, sheet: sheet, instances: instances };
  renderDue();
  renderProps();
  try { var tab = sessionStorage.getItem('bills-tab'); if (tab) B.showTab(tab); } catch (e) {}
})();
