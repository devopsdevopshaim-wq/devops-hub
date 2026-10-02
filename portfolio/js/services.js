/* Services & pricing page. Content lives in services.json; the prices and
   offers the admin sets in n8n (pricesApi) override it. Every lead is saved in
   n8n (leadApi) and also opens a ready WhatsApp message. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var C = null;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function shekel(n) { return Number(n).toLocaleString('he-IL') + ' ₪'; }
  function waUrl(text) { return 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(text); }
  function fmtDate(iso) {
    return new Date(iso + 'T23:59:59').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  // Form-encoded POST: a "simple" request, so the browser sends it without a CORS preflight.
  function post(url, data) {
    if (!url) return Promise.resolve(null);
    return fetch(url, { method: 'POST', body: new URLSearchParams(data), keepalive: true })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  // The admin's prices from n8n replace the ones in services.json.
  function applyPrices(pr) {
    if (!pr) return;
    var o = pr.services || {};
    C.services = C.services.map(function (s) {
      var x = o[s.id];
      if (!x) return s;
      var c = {};
      Object.keys(s).forEach(function (k) { c[k] = s[k]; });
      if (x.title) c.title = x.title;
      if (x.from || x.from === 0) c.from = x.from;
      if (x.unit) c.unit = x.unit;
      c.hidden = !!x.hidden;
      return c;
    }).filter(function (s) { return !s.hidden; });
    if (Array.isArray(pr.offers)) C.offers = pr.offers.filter(function (x) { return x.active !== false; });
    (pr.extra || []).forEach(function (x) {
      if (!x.hidden) C.services.push({ id: x.id, icon: x.icon || '✦', title: x.title, pitch: x.pitch || '', bullets: [], from: x.from, unit: x.unit || '', examples: [] });
    });
    C.plans = pr.plans || null;
    if (pr.note) C.note = pr.note;
  }

  function wireWa(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.wa-link'), function (a) {
      a.href = waUrl(a.getAttribute('data-wa'));
      a.target = '_blank';
      a.rel = 'noopener';
      a.addEventListener('click', function () { post(C.leadApi, { kind: 'click', source: a.getAttribute('data-src') || 'button' }); });
    });
  }

  function pickOffer(o) {
    $('lead-code').value = o.code || '';
    var box = $('offer-picked');
    box.textContent = '✓ המבצע "' + o.title + '"' + (o.code ? ' (קוד ' + o.code + ')' : '') + ' יצורף לפנייה';
    box.hidden = false;
    $('contact').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { $('lead-form').elements.name.focus({ preventScroll: true }); }, 500);
  }

  function renderOffers() {
    var now = Date.now();
    var list = C.offers.filter(function (o) { return !o.until || new Date(o.until + 'T23:59:59').getTime() >= now; });
    $('offers').hidden = !list.length;
    var box = $('offers-list');
    box.replaceChildren();
    list.forEach(function (o) {
      var btn = el('button', { class: 'btn btn-gold btn-sm', type: 'button', text: 'אני רוצה את זה ←' });
      btn.addEventListener('click', function () { pickOffer(o); });
      box.appendChild(el('article', { class: 'offer' }, [
        o.tag ? el('span', { class: 'tag', text: o.tag }) : null,
        el('h3', { text: o.title }),
        o.text ? el('p', { text: o.text }) : null,
        o.until ? el('span', { class: 'until', text: 'בתוקף עד ' + fmtDate(o.until) }) : null,
        btn
      ]));
    });
  }

  function renderServices(projects) {
    var byId = {};
    (projects || []).forEach(function (p) { byId[p.id] = p; });
    var box = $('services-list');
    box.replaceChildren();
    C.services.forEach(function (s) {
      var ex = (s.examples || []).filter(function (id) { return byId[id]; });
      var exNode = null;
      if (ex.length) {
        exNode = el('p', { class: 'ex' }, ['למשל: ']);
        ex.forEach(function (id, i) {
          if (i) exNode.appendChild(document.createTextNode(', '));
          exNode.appendChild(el('a', { href: './#p/' + id, text: byId[id].title }));
        });
      }
      box.appendChild(el('article', { class: 'service', id: 's-' + s.id }, [
        el('span', { class: 'ico', 'aria-hidden': 'true', text: s.icon }),
        el('h3', { text: s.title }),
        el('p', { text: s.pitch }),
        el('ul', {}, (s.bullets || []).map(function (b) { return el('li', { text: b }); })),
        exNode,
        el('div', { class: 'price' }, [el('small', { text: 'החל מ־' }), el('b', { text: shekel(s.from) }), el('small', { text: s.unit })]),
        el('div', { class: 'row' }, [
          el('a', { class: 'btn btn-ghost btn-sm wa-link', 'data-src': 'service-' + s.id, 'data-wa': 'היי, אשמח לשמוע על "' + s.title + '"', href: '#contact', text: 'לפרטים בוואטסאפ' }),
          el('a', { class: 'btn btn-ghost btn-sm', href: '#contact', 'data-pick': s.id, text: 'השארת פרטים' })
        ])
      ]));
    });
    $('price-note').textContent = C.note;

    var sel = $('lead-service');
    sel.replaceChildren();
    C.services.forEach(function (s) { sel.appendChild(el('option', { value: s.title, text: s.title })); });
    sel.appendChild(el('option', { value: 'עוד לא בטוח/ה', text: 'עוד לא בטוח/ה, בואו נדבר' }));
  }

  // subscription to the sites themselves, when the admin set prices for it
  function renderPlans() {
    var old = $('plans');
    if (old) old.remove();
    var P = C.plans || {}, names = [['day', 'יום'], ['week', 'שבוע'], ['month', 'חודש'], ['year', 'שנה']];
    var have = names.filter(function (n) { return P[n[0]] > 0; });
    if (!have.length) return;
    var sec = el('section', { class: 'section', id: 'plans' }, [el('div', { class: 'wrap' }, [
      el('header', { class: 'sec-head' }, [el('p', { class: 'eyebrow', text: 'מנוי' }), el('h2', { text: 'גישה למערכות המוכנות' })]),
      el('p', { class: 'price-note', text: 'מנוי נותן גישה לאתרים ולמערכות שנבחרים בשבילכם מתוך תיק העבודות, עם כניסה אישית במייל ובטלפון.' }),
      el('div', { class: 'plans' }, have.map(function (n) {
        return el('article', { class: 'plan' + (n[0] === 'month' ? ' best' : '') }, [
          el('span', { class: 'tag', text: n[0] === 'month' ? 'הכי משתלם' : 'מנוי ל' + n[1] }),
          el('b', { text: shekel(P[n[0]]) }), el('small', { text: 'ל' + n[1] }),
          el('a', { class: 'btn btn-gold btn-sm wa-link', 'data-src': 'plan-' + n[0], 'data-wa': 'היי, אשמח למנוי ל' + n[1] + ' בהסדנה (' + shekel(P[n[0]]) + ')', href: '#contact', text: 'להצטרפות ↗' })
        ]);
      }))
    ])]);
    $('services').after(sec);
  }

  function renderSteps() {
    var ol = $('steps');
    C.steps.forEach(function (s) { ol.appendChild(el('li', {}, [el('b', { text: s[0] }), el('span', { text: s[1] })])); });
  }

  function renderFaq() {
    var box = $('faq-list');
    C.faq.forEach(function (f) { box.appendChild(el('details', {}, [el('summary', { text: f[0] }), el('p', { text: f[1] })])); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick]');
    if (!a) return;
    var s = C.services.filter(function (x) { return x.id === a.getAttribute('data-pick'); })[0];
    if (s) $('lead-service').value = s.title;
    setTimeout(function () { $('lead-form').elements.name.focus({ preventScroll: true }); }, 400);
  });

  $('lead-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements;
    var err = $('lead-error');
    var phone = f.phone.value.replace(/[^\d+]/g, '');
    if (!f.name.value.trim()) { err.textContent = 'מה השם שלכם?'; err.hidden = false; f.name.focus(); return; }
    if (phone.replace(/\D/g, '').length < 9) { err.textContent = 'צריך מספר טלפון כדי שאוכל לחזור אליכם.'; err.hidden = false; f.phone.focus(); return; }
    err.hidden = true;
    var lead = { name: f.name.value.trim(), phone: f.phone.value.trim(), biz: f.biz.value.trim(), service: f.service.value,
      msg: f.msg.value.trim(), code: f.code.value, website: f.website.value, page: location.href };
    var text = 'היי, אני ' + lead.name + (lead.biz ? ' מ־' + lead.biz : '') + '.\n' +
      'מתעניין/ת ב: ' + lead.service + (lead.code ? '\nמבצע: ' + lead.code : '') + '\nטלפון: ' + lead.phone +
      (lead.msg ? '\n\n' + lead.msg : '') + '\n\n(נשלח מאתר השירותים)';
    post(C.leadApi, lead);
    window.open(waUrl(text), '_blank', 'noopener');
    var done = $('lead-done');
    done.textContent = '✓ הפרטים נשמרו. אם וואטסאפ נפתח, לחצו שם "שליחה". אחזור אליכם בהקדם.';
    done.hidden = false;
  });

  Promise.all([
    fetch('services.json').then(function (r) { return r.json(); }),
    fetch('projects.json').then(function (r) { return r.json(); }).catch(function () { return { projects: [] }; })
  ]).then(function (res) {
    C = res[0];
    var projects = (res[1].projects || []).filter(function (p) { return !p.hidden && !p.pending; });
    if (projects.length) $('t-projects').textContent = projects.length;
    renderSteps();
    renderFaq();
    wireWa();
    function draw() { renderOffers(); renderServices(projects); renderPlans(); wireWa($('services-list')); if ($('plans')) wireWa($('plans')); }
    // Show the page right away, then swap in the admin's prices when n8n answers.
    draw();
    if (C.pricesApi) {
      fetch(C.pricesApi, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.prices) { applyPrices(j.prices); draw(); } })
        .catch(function () {});
    }
  });
})();
