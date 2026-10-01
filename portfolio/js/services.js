/* Services & pricing page. Content lives in services.json, so prices and
   offers change without touching the page. Every contact goes to WhatsApp;
   if services.json has a leadApi (an n8n webhook), the lead is also sent there. */
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
    var d = new Date(iso + 'T23:59:59');
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  function wireWa(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.wa-link'), function (a) {
      a.href = waUrl(a.getAttribute('data-wa'));
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  function renderOffers() {
    var now = Date.now();
    var list = C.offers.filter(function (o) { return !o.until || new Date(o.until + 'T23:59:59').getTime() >= now; });
    $('offers').hidden = !list.length;
    var box = $('offers-list');
    list.forEach(function (o) {
      var msg = 'היי, ראיתי באתר את המבצע "' + o.title + '"' + (o.code ? ' (קוד ' + o.code + ')' : '') + ' ואשמח לפרטים';
      box.appendChild(el('article', { class: 'offer' }, [
        el('span', { class: 'tag', text: o.tag }),
        el('h3', { text: o.title }),
        el('p', { text: o.text }),
        o.until ? el('span', { class: 'until', text: 'בתוקף עד ' + fmtDate(o.until) }) : null,
        el('a', { class: 'btn btn-gold btn-sm wa-link', 'data-wa': msg, href: '#contact', text: 'לממש בוואטסאפ ↗' })
      ]));
    });
  }

  function renderServices(projects) {
    var byId = {};
    (projects || []).forEach(function (p) { byId[p.id] = p; });
    var box = $('services-list');
    C.services.forEach(function (s) {
      var ex = s.examples.filter(function (id) { return byId[id]; });
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
        el('ul', {}, s.bullets.map(function (b) { return el('li', { text: b }); })),
        exNode,
        el('div', { class: 'price' }, [el('small', { text: 'החל מ־' }), el('b', { text: shekel(s.from) }), el('small', { text: s.unit })]),
        el('div', { class: 'row' }, [
          el('a', { class: 'btn btn-ghost btn-sm wa-link', 'data-wa': 'היי, אשמח לשמוע על "' + s.title + '"', href: '#contact', text: 'לפרטים בוואטסאפ' }),
          el('a', { class: 'btn btn-ghost btn-sm', href: '#contact', 'data-pick': s.id, text: 'השארת פרטים' })
        ])
      ]));
    });
    $('price-note').textContent = C.note;

    var sel = $('lead-service');
    C.services.forEach(function (s) { sel.appendChild(el('option', { value: s.title, text: s.title })); });
    sel.appendChild(el('option', { value: 'עוד לא בטוח/ה', text: 'עוד לא בטוח/ה, בואו נדבר' }));
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
    if (!f.name.value.trim()) { err.textContent = 'מה השם שלכם?'; err.hidden = false; f.name.focus(); return; }
    err.hidden = true;
    var lead = { name: f.name.value.trim(), biz: f.biz.value.trim(), service: f.service.value, msg: f.msg.value.trim(), page: location.href, at: new Date().toISOString() };
    var text = 'היי, אני ' + lead.name + (lead.biz ? ' מ־' + lead.biz : '') + '.\n' +
      'מתעניין/ת ב: ' + lead.service + '\n' + (lead.msg ? '\n' + lead.msg + '\n' : '') + '\n(נשלח מאתר השירותים)';
    if (C.leadApi) {
      try { fetch(C.leadApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead), keepalive: true }).catch(function () {}); } catch (x) {}
    }
    window.open(waUrl(text), '_blank', 'noopener');
  });

  Promise.all([
    fetch('services.json').then(function (r) { return r.json(); }),
    fetch('projects.json').then(function (r) { return r.json(); }).catch(function () { return { projects: [] }; })
  ]).then(function (res) {
    C = res[0];
    var projects = (res[1].projects || []).filter(function (p) { return !p.hidden && !p.pending; });
    if (projects.length) $('t-projects').textContent = projects.length;
    renderOffers();
    renderServices(projects);
    renderSteps();
    renderFaq();
    wireWa();
  });
})();
