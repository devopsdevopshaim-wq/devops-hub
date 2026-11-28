/* Admin screen · leads & price list. Talks to the n8n workflow
   "SPIDER · לידים ומחירון" (n8n/hasadna-business.json) through adminApi.
   Access: only the admin who signed in on the main sign-in (auth.js); every call carries a short-lived signed
   proof from that sign-in, which n8n checks. There is no separate password. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STATUS = [['new', 'חדש'], ['working', 'בטיפול'], ['quoted', 'נשלחה הצעה'], ['won', 'נסגר ✓'], ['lost', 'לא רלוונטי']];
  var B = { cfg: null, leads: [], clicks: {}, prices: null };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function waNum(phone) { return String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); }

  // A short-lived signed proof from the main sign-in (30 minutes), renewed before it runs out.
  var proof = { v: '', at: 0 };
  function getProof() {
    if (proof.v && Date.now() - proof.at < 20 * 60000) return Promise.resolve(proof.v);
    if (!window.HasadnaAuth || !window.HasadnaAuth.token()) return Promise.resolve('');
    return window.HasadnaAuth.api('me').then(function (j) {
      if (j && j.ok && j.biz) { proof = { v: j.biz, at: Date.now() }; return proof.v; }
      return '';
    }).catch(function () { return ''; });
  }
  function api(action, payload) {
    return getProof().then(function (token) {
      if (!token) return { ok: false, error: 'admin-only' };
      var body = new URLSearchParams({ action: action, token: token, payload: JSON.stringify(payload || {}) });
      return fetch(B.cfg.adminApi, { method: 'POST', body: body })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad-response' }; }); });
    });
  }

  // ---------- sign-in is the main one ----------
  function showError(t) { var e = $('biz-error'); e.textContent = t; e.hidden = !t; }

  function connect(quiet) {
    showError('');
    return api('list', {}).then(function (j) {
      if (j.ok) { onData(j); return; }
      if (!quiet) {
        showError(j.error === 'admin-only' ? 'צריך להיכנס כמנהל: לחצו "כניסה כמנהל" והקלידו את הקוד.'
          : j.error === 'rate-limited' ? 'יותר מדי בקשות. נסו שוב בעוד כמה דקות.'
          : 'n8n החזיר שגיאה: ' + j.error);
      }
    }).catch(function () {
      if (!quiet) showError('n8n לא ענה. בדקו שה־workflow "SPIDER · לידים ומחירון" במצב Active.');
    });
  }

  $('biz-logout').addEventListener('click', function () { if (window.HasadnaAuth) window.HasadnaAuth.logout(); });
  $('biz-refresh').addEventListener('click', function () { connect(); });

  function onData(j) {
    B.leads = j.leads || [];
    B.clicks = j.clicks || {};
    B.prices = j.prices || null;
    $('biz-login').hidden = true;
    $('biz-body').hidden = false;
    $('biz-tools').hidden = false;
    renderKpis();
    renderLeads();
    renderPrices();
  }

  // ---------- leads ----------
  function renderKpis() {
    var month = new Date().toISOString().slice(0, 7);
    var won = B.leads.filter(function (l) { return l.status === 'won'; }).length;
    var clicks = Object.keys(B.clicks).reduce(function (s, k) { return s + B.clicks[k]; }, 0);
    var k = [
      ['לידים', B.leads.length],
      ['חדשים שמחכים', B.leads.filter(function (l) { return l.status === 'new'; }).length],
      ['החודש', B.leads.filter(function (l) { return (l.at || '').slice(0, 7) === month; }).length],
      ['נסגרו', won],
      ['אחוז סגירה', B.leads.length ? Math.round(won / B.leads.length * 100) + '%' : '—'],
      ['לחיצות וואטסאפ', clicks]
    ];
    var dl = $('biz-kpis');
    dl.replaceChildren();
    k.forEach(function (x) {
      dl.appendChild(el('div', {}, [el('dt', { text: x[0] }), el('dd', { text: typeof x[1] === 'number' ? x[1].toLocaleString('he-IL') : x[1] })]));
    });
  }

  function save(lead, patch) {
    patch.id = lead.id;
    return api('lead', patch).then(function (j) {
      if (j.ok) { Object.keys(patch).forEach(function (k) { lead[k] = patch[k]; }); renderKpis(); }
      else alert('לא נשמר: ' + j.error);
    });
  }

  function renderLeads() {
    var f = $('lead-filter').value;
    var tb = $('lead-rows');
    tb.replaceChildren();
    var list = B.leads.filter(function (l) { return f === 'all' || l.status === f; });
    list.forEach(function (l) {
      var d = new Date(l.at);
      var sel = el('select', { 'aria-label': 'סטטוס' }, STATUS.map(function (s) { return el('option', { value: s[0], text: s[1], selected: s[0] === l.status ? '' : null }); }));
      sel.addEventListener('change', function () { save(l, { status: sel.value }).then(function () { tr.className = 'st-' + l.status; }); });
      var note = el('input', { class: 'note', value: l.note || '', placeholder: 'למשל: לחזור ביום ראשון', maxlength: '500' });
      note.addEventListener('change', function () { save(l, { note: note.value }); });
      var del = el('button', { type: 'button', class: 'g-btn ghost danger', text: 'מחיקה' });
      del.addEventListener('click', function () {
        if (!confirm('למחוק את הליד של ' + l.name + '?')) return;
        api('lead-delete', { id: l.id }).then(function (j) {
          if (j.ok) { B.leads = B.leads.filter(function (x) { return x !== l; }); renderKpis(); renderLeads(); }
        });
      });
      var wa = waNum(l.phone);
      var tr = el('tr', { class: 'st-' + l.status }, [
        el('td', { class: 'num', text: d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }),
        el('td', { class: 'who' }, [
          el('b', { text: l.name || '—' }),
          l.biz ? el('small', { class: 'muted', text: l.biz }) : null,
          l.phone ? el('div', {}, [el('a', { href: 'https://wa.me/' + wa, target: '_blank', rel: 'noopener', dir: 'ltr', text: l.phone + ' ↗' })]) : null
        ]),
        el('td', {}, [l.service || '', l.code ? el('div', {}, [el('span', { class: 'pill featured', text: l.code })]) : null]),
        el('td', { class: 'msg', text: l.msg || '' }),
        el('td', {}, [sel]),
        el('td', {}, [note]),
        el('td', {}, [del])
      ]);
      tb.appendChild(tr);
    });
    if (!list.length) {
      tb.appendChild(el('tr', {}, [el('td', { colspan: '7', class: 'muted', text: B.leads.length ? 'אין לידים בסטטוס הזה.' : 'עדיין אין לידים. כשמישהו ימלא את הטופס בדף השירותים, הוא יופיע כאן.' })]));
    }
  }
  $('lead-filter').addEventListener('change', renderLeads);

  $('biz-csv').addEventListener('click', function () {
    var label = {}; STATUS.forEach(function (s) { label[s[0]] = s[1]; });
    var rows = [['תאריך', 'שם', 'טלפון', 'עסק', 'שירות', 'מבצע', 'הודעה', 'סטטוס', 'הערה']].concat(B.leads.map(function (l) {
      return [l.at, l.name, l.phone, l.biz, l.service, l.code, l.msg, label[l.status] || l.status, l.note];
    }));
    var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: 'leads-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------- prices ----------
  function effective() {
    var pr = B.prices || {};
    var o = pr.services || {};
    return {
      services: B.cfg.services.map(function (s) {
        var x = o[s.id] || {};
        return { id: s.id, title: x.title || s.title, from: x.from != null ? x.from : s.from, unit: x.unit || s.unit, hidden: !!x.hidden };
      }),
      offers: Array.isArray(pr.offers) ? pr.offers : B.cfg.offers.map(function (x) {
        return { tag: x.tag, title: x.title, text: x.text, until: x.until, code: x.code, active: true };
      }),
      note: pr.note || B.cfg.note || '',
      extra: Array.isArray(pr.extra) ? pr.extra : [],
      plans: pr.plans || {}
    };
  }

  function extraRow(x) {
    var row = el('div', { class: 'extra-row', 'data-id': x.id || '' }, [
      el('input', { class: 'x-icon', value: x.icon || '✦', maxlength: '4', 'aria-label': 'סמל' }),
      el('input', { class: 'x-title', value: x.title || '', placeholder: 'שם השירות', maxlength: '80', 'aria-label': 'שם השירות' }),
      el('input', { class: 'x-from', type: 'number', min: '0', step: '50', value: x.from != null ? String(x.from) : '', placeholder: 'מחיר ₪', 'aria-label': 'מחיר' }),
      el('input', { class: 'x-unit', value: x.unit || '', placeholder: 'לפרויקט', maxlength: '30', 'aria-label': 'יחידה' }),
      el('input', { class: 'x-pitch', value: x.pitch || '', placeholder: 'משפט אחד: מה הלקוח מקבל', maxlength: '300', 'aria-label': 'תיאור' }),
      el('label', {}, [el('input', { type: 'checkbox', class: 'x-shown', checked: x.hidden ? null : '' }), 'מוצג']),
      el('button', { type: 'button', class: 'del', 'aria-label': 'מחיקת השירות', text: '×' })
    ]);
    row.querySelector('.del').addEventListener('click', function () { row.remove(); });
    return row;
  }

  function offerRow(o) {
    var row = el('div', { class: 'offer-row' }, [
      el('label', {}, [el('input', { type: 'checkbox', class: 'o-active', checked: o.active !== false ? '' : null }), 'פעיל']),
      el('input', { class: 'o-tag', value: o.tag || '', placeholder: 'תגית', maxlength: '20', 'aria-label': 'תגית' }),
      el('input', { class: 'o-title', value: o.title || '', placeholder: 'כותרת המבצע', maxlength: '100', 'aria-label': 'כותרת' }),
      el('input', { class: 'o-text', value: o.text || '', placeholder: 'פירוט', maxlength: '300', 'aria-label': 'פירוט' }),
      el('input', { class: 'o-until', type: 'date', value: o.until || '', 'aria-label': 'בתוקף עד' }),
      el('input', { class: 'o-code', value: o.code || '', placeholder: 'קוד', dir: 'ltr', maxlength: '20', 'aria-label': 'קוד מבצע' }),
      el('button', { type: 'button', class: 'del', 'aria-label': 'מחיקת המבצע', text: '×' })
    ]);
    row.querySelector('.del').addEventListener('click', function () { row.remove(); });
    return row;
  }

  function renderPrices() {
    var e = effective();
    var tb = $('price-rows');
    tb.replaceChildren();
    e.services.forEach(function (s) {
      tb.appendChild(el('tr', { 'data-id': s.id }, [
        el('td', {}, [el('input', { class: 'title', value: s.title, maxlength: '80', 'aria-label': 'שם השירות' })]),
        el('td', {}, [el('input', { class: 'from', type: 'number', min: '0', step: '50', value: String(s.from), 'aria-label': 'מחיר' })]),
        el('td', {}, [el('input', { class: 'unit', value: s.unit, maxlength: '30', 'aria-label': 'יחידה' })]),
        el('td', {}, [el('input', { class: 'shown', type: 'checkbox', checked: s.hidden ? null : '', 'aria-label': 'מוצג בדף' })])
      ]));
    });
    var box = $('offer-rows');
    box.replaceChildren.apply(box, e.offers.map(offerRow));
    $('price-note-in').value = e.note;
    var xb = $('extra-rows');
    xb.replaceChildren.apply(xb, e.extra.map(extraRow));
    Array.prototype.forEach.call(document.querySelectorAll('[data-plan]'), function (i) { var v = e.plans[i.getAttribute('data-plan')]; i.value = v ? String(v) : ''; });
    $('price-when').textContent = B.prices && B.prices.updatedAt
      ? 'נשמר לאחרונה ' + new Date(B.prices.updatedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'עדיין מהקובץ services.json';
  }

  $('extra-add').addEventListener('click', function () {
    var r = extraRow({ icon: '✦' });
    $('extra-rows').appendChild(r);
    r.querySelector('.x-title').focus();
  });

  $('offer-add').addEventListener('click', function () {
    var r = offerRow({ tag: 'מבצע', active: true });
    $('offer-rows').appendChild(r);
    r.querySelector('.o-title').focus();
  });

  $('price-save').addEventListener('click', function () {
    var services = {};
    Array.prototype.forEach.call($('price-rows').querySelectorAll('tr'), function (tr) {
      services[tr.getAttribute('data-id')] = {
        title: tr.querySelector('.title').value, from: Number(tr.querySelector('.from').value) || 0,
        unit: tr.querySelector('.unit').value, hidden: !tr.querySelector('.shown').checked
      };
    });
    var offers = Array.prototype.map.call($('offer-rows').querySelectorAll('.offer-row'), function (r) {
      return {
        active: r.querySelector('.o-active').checked, tag: r.querySelector('.o-tag').value, title: r.querySelector('.o-title').value,
        text: r.querySelector('.o-text').value, until: r.querySelector('.o-until').value, code: r.querySelector('.o-code').value
      };
    }).filter(function (o) { return o.title.trim(); });
    var extra = Array.prototype.map.call($('extra-rows').querySelectorAll('.extra-row'), function (r) {
      return { id: r.getAttribute('data-id'), icon: r.querySelector('.x-icon').value, title: r.querySelector('.x-title').value,
        from: Number(r.querySelector('.x-from').value) || 0, unit: r.querySelector('.x-unit').value, pitch: r.querySelector('.x-pitch').value,
        hidden: !r.querySelector('.x-shown').checked };
    }).filter(function (x) { return x.title.trim(); });
    var plans = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-plan]'), function (i) { if (Number(i.value) > 0) plans[i.getAttribute('data-plan')] = Number(i.value); });
    var st = $('price-status');
    st.textContent = 'שומר…';
    api('prices', { services: services, extra: extra, plans: plans, offers: offers, note: $('price-note-in').value }).then(function (j) {
      if (j.ok) { B.prices = j.prices; renderPrices(); st.textContent = '✓ נשמר. דף השירותים כבר מציג את המחירים החדשים.'; }
      else st.textContent = 'לא נשמר: ' + j.error;
    }).catch(function () { st.textContent = 'n8n לא ענה. נסו שוב.'; });
  });

  $('price-reset').addEventListener('click', function () {
    if (!confirm('לחזור למחירים ולמבצעים שבקובץ services.json?')) return;
    api('prices', { reset: true }).then(function (j) {
      if (j.ok) { B.prices = null; renderPrices(); $('price-status').textContent = '✓ חזר למחירון המקורי.'; }
    });
  });

  // ---------- start ----------
  fetch('services.json').then(function (r) { return r.json(); }).then(function (cfg) {
    B.cfg = cfg;
    if (!cfg.adminApi) { $('biz-login-text').textContent = 'אין כתובת adminApi בקובץ services.json.'; return; }
    // once the admin is signed in (the gate resolves this), load the leads
    (window.HasadnaAuth ? window.HasadnaAuth.ready : Promise.resolve()).then(function () { connect(true); });
  });
})();
