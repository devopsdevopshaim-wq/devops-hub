/* My business details: one form for the site (name, phone, WhatsApp, e-mail, Instagram…) and for the line printed on
   every magnet (what to show, where, size, colour, font). Saved in this browser; "publish to the site" writes
   business.json to the repository with the owner's GitHub token (the same one the events library uses). */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var REPO = 'devopsdevopshaim-wq/devops-hub', PATH = 'frame-studio/business.json';
  var hasLocal = !!localStorage.getItem('frame-studio-biz');

  /* the site's published details fill in anything this browser has not set */
  fetch('business.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (b) {
    FS.BIZ_SITE = b;
    if (!hasLocal) { ['name', 'owner', 'phone', 'whatsapp', 'email', 'instagram', 'facebook', 'website', 'tagline', 'areas', 'hours'].forEach(function (k) { if (b[k]) FS.BIZ[k] = b[k]; }); if (b.credit) FS.BIZ.credit = Object.assign({}, FS.BIZ.credit, b.credit); }
    syncQuick();
  });
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.unshift(function (p) { FS.applyCredit(p); });

  function reapplyAll() {
    S.photos.forEach(function (p) { FS.applyCredit(p); p.cache = {}; FS.snap(p); });
    FS.render(); if (FS.refreshStrip) FS.refreshStrip(); syncQuick();
  }
  FS.reapplyCredit = reapplyAll;

  /* quick switch in the event tab */
  function syncQuick() { var q = $('#ev-credit'); if (q) { q.checked = !!FS.BIZ.credit.on; $('#ev-credit-text').textContent = FS.creditText() || 'עוד לא הוזנו פרטים'; } }
  var q = $('#ev-credit'); if (q) q.addEventListener('change', function () { FS.BIZ.credit.on = this.checked; FS.saveBiz(); reapplyAll(); FS.toast(this.checked ? 'הפרטים שלך יודפסו על כל מגנט' : 'הפרטים הוסרו מהמגנטים'); });

  var FIELDS = [['name', 'שם העסק', 'פריים מגנטים'], ['owner', 'השם שלך', ''], ['phone', 'טלפון', '05X-XXXXXXX', 'tel'], ['whatsapp', 'וואטסאפ (אם שונה)', '', 'tel'], ['email', 'אימייל', '', 'email'],
    ['instagram', 'אינסטגרם', '@my_magnets'], ['facebook', 'פייסבוק (קישור)', ''], ['website', 'אתר', ''], ['tagline', 'משפט קצר', 'מגנטים לאירועים'], ['areas', 'אזורי שירות', ''], ['hours', 'שעות פעילות', '']];
  var ITEMS = [['name', 'שם העסק'], ['owner', 'השם שלך'], ['phone', 'טלפון'], ['instagram', 'אינסטגרם'], ['website', 'אתר'], ['tagline', 'משפט קצר']];
  var POS = [['bottom', 'למטה במרכז'], ['corner-r', 'פינה ימנית'], ['corner-l', 'פינה שמאלית'], ['top', 'למעלה'], ['side', 'לאורך הצד']];
  var COLORS = [['auto', 'אוטומטי'], ['#ffffff', 'לבן'], ['#1d1633', 'כהה'], ['#c9a45c', 'זהב'], ['#5b5046', 'חום']];

  function open() {
    var b = JSON.parse(JSON.stringify(FS.BIZ)), c = b.credit;
    var h = '<div class="biz"><div class="biz-form"><h3>הפרטים שלי</h3><div class="biz-grid">' + FIELDS.map(function (f) {
      return '<label><span>' + f[1] + '</span><input data-f="' + f[0] + '" type="' + (f[3] || 'text') + '" value="' + FS.esc(b[f[0]] || '') + '" placeholder="' + FS.esc(f[2]) + '"' + (f[3] === 'tel' ? ' dir="ltr"' : '') + '></label>';
    }).join('') + '</div>' +
      '<h3>על המגנט</h3><label class="check"><input type="checkbox" id="cr-on"' + (c.on ? ' checked' : '') + '> להדפיס את הפרטים שלי על כל מגנט</label>' +
      '<div class="chips" id="cr-items">' + ITEMS.map(function (i) { return '<button type="button" data-i="' + i[0] + '" class="' + (c.items.indexOf(i[0]) > -1 ? 'on' : '') + '">' + i[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row2"><div class="field"><label>מיקום</label><select id="cr-pos">' + POS.map(function (x) { return '<option value="' + x[0] + '"' + (c.pos === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>גופן</label><select id="cr-font">' + FS.FONTS.map(function (f) { return '<option value="' + f[0] + '"' + (c.font === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label>גודל <output id="o-cr-size">' + c.size + '</output></label><input type="range" id="cr-size" min="1.8" max="6" step="0.1" value="' + c.size + '"></div>' +
      '<div class="field"><label>שקיפות <output id="o-cr-op">' + Math.round(c.opacity * 100) + '%</output></label><input type="range" id="cr-op" min="0.3" max="1" step="0.05" value="' + c.opacity + '"></div>' +
      '<div class="field"><label>צבע</label><div class="chips" id="cr-color">' + COLORS.map(function (x) { return '<button type="button" data-c="' + x[0] + '" class="' + (c.color === x[0] ? 'on' : '') + '">' + (x[0] !== 'auto' ? '<i style="background:' + x[0] + '"></i>' : '') + x[1] + '</button>'; }).join('') + '<input type="color" id="cr-custom" value="' + (/^#/.test(c.color) ? c.color : '#ffffff') + '" title="צבע אחר"></div></div>' +
      '</div><div class="biz-preview"><p class="hint">כך זה ייראה על המגנט</p><div class="biz-pv" id="biz-pv"></div><p class="biz-line" id="biz-line"></p></div></div>' +
      '<div class="pv-foot"><button class="btn" id="biz-cancel">ביטול</button><div class="inline"><button class="btn" id="biz-publish">💾 שמירה ופרסום באתר</button><button class="btn primary" id="biz-save">💾 שמירה</button></div></div>';
    var body = FS.dialog('🏷️ פרטי העסק', h, true);
    function read() {
      $$('[data-f]', body).forEach(function (i) { b[i.dataset.f] = i.value.trim(); });
      c.on = $('#cr-on', body).checked; c.items = $$('#cr-items .on', body).map(function (x) { return x.dataset.i; });
      c.pos = $('#cr-pos', body).value; c.font = $('#cr-font', body).value; c.size = Number($('#cr-size', body).value); c.opacity = Number($('#cr-op', body).value);
      return b;
    }
    var pvT = null;
    function preview() {
      read(); $('#o-cr-size', body).textContent = c.size; $('#o-cr-op', body).textContent = Math.round(c.opacity * 100) + '%';
      $('#biz-line', body).textContent = FS.creditText(b) || '—';
      clearTimeout(pvT); pvT = setTimeout(function () {
        var keep = FS.BIZ; FS.BIZ = b;
        var p = FS.cur(), done;
        if (p) { var t = { src: p.src, doc: JSON.parse(JSON.stringify(p.doc)), cache: {}, mask: p.mask, maskV: p.maskV }; FS.applyCredit(t, b); var k = 420 / Math.max(t.doc.w, t.doc.h), cv = FS.canvas(t.doc.w * k, t.doc.h * k); FS.draw(cv.getContext('2d'), t, { scale: k, max: 700, export: true }); done = Promise.resolve(cv); }
        else done = FS.magnetCanvas(FS.SHOWCASE[0], 420);
        done.then(function (cv) { FS.BIZ = keep; var box = $('#biz-pv', body); if (box) { box.innerHTML = ''; box.appendChild(cv); } }, function () { FS.BIZ = keep; });
      }, 120);
    }
    $$('input, select', body).forEach(function (el) { el.addEventListener('input', preview); el.addEventListener('change', preview); });
    $$('#cr-items button', body).forEach(function (x) { x.addEventListener('click', function () { x.classList.toggle('on'); preview(); }); });
    $$('#cr-color button', body).forEach(function (x) { x.addEventListener('click', function () { $$('#cr-color button', body).forEach(function (y) { y.classList.toggle('on', y === x); }); c.color = x.dataset.c; preview(); }); });
    $('#cr-custom', body).addEventListener('input', function () { $$('#cr-color button', body).forEach(function (y) { y.classList.remove('on'); }); c.color = this.value; preview(); });
    $('#biz-cancel', body).addEventListener('click', FS.closeDialog);
    function save() { FS.BIZ = read(); FS.saveBiz(); FS.closeDialog(); reapplyAll(); }
    $('#biz-save', body).addEventListener('click', function () { save(); FS.toast('✔ הפרטים נשמרו ועודכנו על כל המגנטים'); });
    $('#biz-publish', body).addEventListener('click', function () { save(); publish(); });
    preview();
  }
  FS.openBiz = open;

  /* write into business.json on the site: patch(base) changes only its own fields, everything else stays */
  function publishSite(patch, message, done) {
    var tok = ''; try { tok = localStorage.getItem('fs-gh-token') || ''; } catch (e) { /* ignore */ }
    if (!tok) { FS.toast('נשמר אצלך. כדי לעדכן את האתר מגדירים פעם אחת "🔑 חיבור לאתר" בלשונית שמירה והדפסה.', 6500); return; }
    var H = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, url = 'https://api.github.com/repos/' + REPO + '/contents/' + PATH;
    FS.busy('מעדכן את האתר…');
    fetch(url + '?ref=main', { headers: H }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cur) {
      var base = {}; try { base = cur ? JSON.parse(decodeURIComponent(escape(atob(cur.content.replace(/\s/g, ''))))) : JSON.parse(JSON.stringify(FS.BIZ_SITE || {})); } catch (e) { base = JSON.parse(JSON.stringify(FS.BIZ_SITE || {})); }
      patch(base); FS.BIZ_SITE = base;
      var body = { message: message, branch: 'main', content: btoa(unescape(encodeURIComponent(JSON.stringify(base, null, 2) + '\n'))) };
      if (cur) body.sha = cur.sha;
      return fetch(url, { method: 'PUT', headers: H, body: JSON.stringify(body) });
    }).then(function (r) { FS.busy(); if (!r.ok) throw new Error(r.status); FS.toast(done || '🌐 האתר יתעדכן תוך כשתי דקות', 6000); })
      .catch(function (e) { FS.busy(); FS.toast(/401|403/.test(String(e.message)) ? 'מפתח GitHub לא תקין. בודקים ב"🔑 חיבור לאתר".' : 'העדכון לאתר לא הצליח. השינויים נשמרו אצלך.', 6000); });
  }
  FS.publishSite = publishSite;
  function publish() {
    publishSite(function (base) { ['name', 'owner', 'phone', 'whatsapp', 'email', 'instagram', 'facebook', 'website', 'tagline', 'areas', 'hours', 'credit'].forEach(function (k) { base[k] = FS.BIZ[k]; }); },
      'frame-studio: business details', '🌐 האתר יתעדכן עם הפרטים החדשים תוך כשתי דקות');
  }

  /* ---------- packages and prices (owner only: publishing needs the owner's GitHub key) ---------- */
  var PKEY = 'frame-studio-packages';
  function packages() {
    try { var l = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (l && l.length) return l; } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify((FS.BIZ_SITE && FS.BIZ_SITE.packages) || []));
  }
  function openPackages() {
    var list = packages(), body = FS.dialog('💰 חבילות ומחירים', '', true);
    var evs = FS.EVENTS.map(function (e) { return [e.id, e.icon + ' ' + e.name]; });
    function card(p, i) {
      return '<article class="pkg-ed' + (p.featured ? ' star' : '') + (p.hidden ? ' off' : '') + '" data-i="' + i + '">' +
        '<div class="pkg-top"><input class="pkg-name" data-k="name" value="' + FS.esc(p.name || '') + '" placeholder="שם החבילה">' +
        '<div class="pkg-tools"><button type="button" data-a="up" title="למעלה">▲</button><button type="button" data-a="down" title="למטה">▼</button><button type="button" data-a="dup" title="שכפול">⧉</button><button type="button" data-a="del" class="danger" title="מחיקה">🗑</button></div></div>' +
        '<div class="pkg-row"><label>מחיר<input data-k="price" value="' + FS.esc(p.price || '') + '" placeholder="₪1,490"></label><label>משך<input data-k="hours" value="' + FS.esc(p.hours || '') + '" placeholder="3 שעות"></label></div>' +
        '<label>מגנטים / כמות<input data-k="magnets" value="' + FS.esc(p.magnets || '') + '" placeholder="עד 150 מגנטים"></label>' +
        '<label>מה כלול (שורה לכל פריט)<textarea data-k="features" rows="4">' + FS.esc((p.features || []).join('\n')) + '</textarea></label>' +
        '<label>הערה קטנה (לא חובה)<input data-k="note" value="' + FS.esc(p.note || '') + '" placeholder="למשל: מחיר לאירוע עד 200 אורחים"></label>' +
        '<div class="pkg-for"><span>מתאימה ל:</span>' + evs.map(function (e) { return '<button type="button" data-ev="' + e[0] + '" class="' + ((p.for || []).indexOf(e[0]) > -1 ? 'on' : '') + '">' + e[1] + '</button>'; }).join('') + '</div>' +
        '<div class="pkg-flags"><label class="check"><input type="checkbox" data-k="featured"' + (p.featured ? ' checked' : '') + '> ⭐ החבילה המומלצת</label><label class="check"><input type="checkbox" data-k="hidden"' + (p.hidden ? ' checked' : '') + '> להסתיר מהאתר</label></div></article>';
    }
    function draw() {
      body.innerHTML = '<p class="hint">כאן קובעים מה מופיע באתר תחת "חבילות". רק מי שמחזיק את מפתח החיבור לאתר יכול לפרסם שינויים, כלומר רק אתה.</p>' +
        '<div class="pkg-list">' + list.map(card).join('') + '<button type="button" class="pkg-add" id="pkg-add"><b>＋</b><span>חבילה חדשה</span></button></div>' +
        '<div class="row2 pkg-addons"><div class="field"><label>תוספות (שורה לכל תוספת, יופיעו מתחת לחבילות)</label><textarea id="pkg-extras" rows="3" placeholder="שעה נוספת · ₪350&#10;מגנט בגודל 10×15 · ₪15 ליחידה">' + FS.esc(((FS.BIZ_SITE && FS.BIZ_SITE.extras) || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>הערה מתחת לחבילות</label><textarea id="pkg-note" rows="3">' + FS.esc((FS.BIZ_SITE && FS.BIZ_SITE.packagesNote) || 'כל החבילות כוללות הובלה, הקמה, עמדת הדפסה ושקיות מתנה. אפשר להוסיף שעות ומגנטים.') + '</textarea></div></div>' +
        '<div class="pv-foot"><button class="btn" id="pkg-reset">↺ חזרה למה שבאתר</button><div class="inline"><a class="btn" href="./#packages" target="_blank" rel="noopener">👁 לראות באתר</a><button class="btn" id="pkg-save">💾 שמירה</button><button class="btn primary" id="pkg-publish">🌐 שמירה ופרסום באתר</button></div></div>';
      $$('.pkg-ed', body).forEach(function (el) {
        var p = list[Number(el.dataset.i)];
        $$('[data-k]', el).forEach(function (f) { f.addEventListener('input', function () {
          var k = f.dataset.k; p[k] = f.type === 'checkbox' ? f.checked : k === 'features' ? f.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : f.value;
          if (k === 'featured' && p.featured) { list.forEach(function (q) { if (q !== p) q.featured = false; }); draw(); }
          if (k === 'hidden') el.classList.toggle('off', p.hidden);
        }); });
        $$('[data-ev]', el).forEach(function (b) { b.addEventListener('click', function () { p.for = p.for || []; var k = p.for.indexOf(b.dataset.ev); if (k > -1) p.for.splice(k, 1); else p.for.push(b.dataset.ev); b.classList.toggle('on'); }); });
        $$('[data-a]', el).forEach(function (b) { b.addEventListener('click', function () {
          var i = Number(el.dataset.i), a = b.dataset.a;
          if (a === 'up' && i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]);
          else if (a === 'down' && i < list.length - 1) list.splice(i + 1, 0, list.splice(i, 1)[0]);
          else if (a === 'dup') { var c = JSON.parse(JSON.stringify(p)); c.id = 'p' + FS.uid(); c.name = (p.name || '') + ' (עותק)'; c.featured = false; list.splice(i + 1, 0, c); }
          else if (a === 'del') { if (!confirm('למחוק את החבילה "' + (p.name || '') + '"?')) return; list.splice(i, 1); }
          draw();
        }); });
      });
      $('#pkg-add', body).addEventListener('click', function () { list.push({ id: 'p' + FS.uid(), name: 'חבילה חדשה', price: '', hours: '', magnets: '', features: [] }); draw(); var n = $$('.pkg-name', body); n[n.length - 1].focus(); n[n.length - 1].select(); });
      $('#pkg-reset', body).addEventListener('click', function () { if (!confirm('לבטל את השינויים שלא פורסמו ולחזור לחבילות שבאתר?')) return; try { localStorage.removeItem(PKEY); } catch (e) { /* ignore */ } list = packages(); draw(); });
      $('#pkg-save', body).addEventListener('click', function () { save(); FS.toast('💾 נשמר אצלך. "שמירה ופרסום באתר" מעדכן את האתר.'); });
      $('#pkg-publish', body).addEventListener('click', function () {
        save(); var extras = $('#pkg-extras', body).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), note = $('#pkg-note', body).value.trim();
        publishSite(function (base) { base.packages = list; base.extras = extras; base.packagesNote = note; }, 'frame-studio: packages and prices', '🌐 החבילות יתעדכנו באתר תוך כשתי דקות');
      });
    }
    function save() { list.forEach(function (p) { if (!p.id) p.id = 'p' + FS.uid(); }); try { localStorage.setItem(PKEY, JSON.stringify(list)); } catch (e) { /* ignore */ } }
    draw();
  }
  FS.openPackages = openPackages;
  FS.getPackages = packages;
  $('#pkg-btn').addEventListener('click', openPackages);

  $('#biz-btn').addEventListener('click', open);
  var ev = $('#ev-credit-edit'); if (ev) ev.addEventListener('click', open);
  syncQuick();
})();
