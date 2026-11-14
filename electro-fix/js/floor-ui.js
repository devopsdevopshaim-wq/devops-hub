/* מעגל סגור — שרטוט אדריכלי: העלאה, ניתוח עם Claude, עריכת חדרים, חשמל בכל חדר, לוח דירתי, בניין ותלת-ממד. */
(function () {
  'use strict';

  var F = window.FloorPlan, H = window.HomePlan, FP = window.FixPrompts, A = window.FixApp, Store = window.PlanStore;
  var esc = A.esc;
  var BASE = (document.currentScript && document.currentScript.src) || location.href;
  var MAX_SIDE = 2000, AI_SIDE = 1568;

  var st = { proj: null, sel: {}, tab: 'plan', mode: 'select', newType: 'bedroom', points: true, calib: null, viewer: null, timer: null, mounted: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var KIND_HE = { socket: 'שקע', light: 'נקודת מאור', switch: 'מתג', ac: 'מזגן', tv: 'טלוויזיה', net: 'רשת', appliance: 'מעגל ייעודי', fan: 'מאוורר', panel: 'לוח חשמל' };

  /* ---------- מצב ושמירה ---------- */

  function floor() { return st.proj.floors.filter(function (f) { return f.id === st.sel.floor; })[0] || st.proj.floors[0]; }
  function apt() { var f = floor(); return f && (f.apartments.filter(function (a) { return a.id === st.sel.apt; })[0] || f.apartments[0]); }
  function room() { var a = apt(); return a && a.rooms.filter(function (r) { return r.id === st.sel.room; })[0]; }

  function save() {
    clearTimeout(st.timer);
    st.timer = setTimeout(function () { Store.save(st.proj).then(fillOpen); }, 400);
  }
  function change(fn, keepTab) { fn(); render(keepTab); save(); }

  function fillOpen() {
    Store.all().then(function (list) {
      $('#pOpen').innerHTML = '<option value="">הפרויקטים שלי (' + list.length + ')</option>' + list.map(function (p) {
        return '<option value="' + p.id + '"' + (st.proj && p.id === st.proj.id ? ' selected' : '') + '>' + esc(p.name || 'ללא שם') + '</option>';
      }).join('');
    });
  }

  function openProject(p) {
    st.proj = p;
    st.sel = {};
    var f = p.floors[0];
    if (f) { st.sel.floor = f.id; if (f.apartments[0]) st.sel.apt = f.apartments[0].id; }
    $('#pWork').hidden = false;
    $('#pName').value = p.name || '';
    $('#pSupply').value = p.supply || '3x25';
    $('#pTech').value = p.tech || 'wifi';
    $('#pKind').value = p.kind || 'apartment';
    $('#pAiPanel').innerHTML = p.ai ? aiSummary(p.ai) : '';
    render();
    fillOpen();
  }

  function newProject(floors, name) {
    var p = { id: uid('p'), created: Date.now(), name: name || 'פרויקט חדש', autoName: true, kind: $('#pKind').value, supply: '3x25', tech: 'wifi', floors: floors };
    return Store.save(p).then(function () { openProject(p); return p; });
  }

  /* ---------- קבצים ---------- */

  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function toJpeg(source, w, h, max) {
    var s = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(source, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height };
  }
  function readUrl(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); }); }

  var pdfjs = null;
  function pdfLib() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return import(new URL('../vendor/pdf.min.mjs', BASE).href).then(function (m) {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', BASE).href;
      pdfjs = m;
      return m;
    });
  }

  function filesToFloors(files) {
    var list = Array.prototype.slice.call(files), out = [];
    return list.reduce(function (chain, file) {
      return chain.then(function () {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          return file.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: buf }).promise; }); }).then(function (doc) {
            var pages = [];
            for (var i = 1; i <= Math.min(doc.numPages, 20); i++) pages.push(i);
            return pages.reduce(function (c2, n) {
              return c2.then(function () {
                return doc.getPage(n).then(function (page) {
                  var v = page.getViewport({ scale: 1 }), sc = MAX_SIDE / Math.max(v.width, v.height);
                  var vp = page.getViewport({ scale: sc }), cv = document.createElement('canvas');
                  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
                  var g = cv.getContext('2d');
                  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
                  return page.render({ canvasContext: g, viewport: vp }).promise.then(function () {
                    var j = toJpeg(cv, cv.width, cv.height, MAX_SIDE);
                    out.push({ name: file.name + (doc.numPages > 1 ? ' · עמוד ' + n : ''), image: j.url, w: j.w, h: j.h });
                  });
                });
              });
            }, Promise.resolve());
          });
        }
        if (!/^image\//.test(file.type)) { A.toast('הקובץ ' + file.name + ' אינו תמונה או PDF', true); return null; }
        return readUrl(file).then(loadImage).then(function (img) {
          var j = toJpeg(img, img.naturalWidth, img.naturalHeight, MAX_SIDE);
          out.push({ name: file.name, image: j.url, w: j.w, h: j.h });
        });
      });
    }, Promise.resolve()).then(function () {
      return out.map(function (x, i) {
        return { id: uid('f'), label: 'קומה ' + (i + 1), level: i, repeat: 1, kind: 'residential', name: x.name, image: x.image, w: x.w, h: x.h, apartments: [], common: [] };
      });
    });
  }

  function addFiles(files, intoCurrent) {
    if (!files || !files.length) return;
    A.toast('מכין את השרטוטים…');
    filesToFloors(files).then(function (floors) {
      if (!floors.length) return;
      if (intoCurrent && st.proj) {
        var base = st.proj.floors.length;
        floors.forEach(function (f, i) { f.label = 'קומה ' + (base + i + 1); f.level = base + i; st.proj.floors.push(f); });
        st.sel = { floor: floors[0].id };
        render(); save();
      } else {
        newProject(floors, floors[0].name.replace(/\.(pdf|png|jpe?g|webp)$/i, '').slice(0, 60)).then(function () { openAi(); });
      }
      A.toast(floors.length === 1 ? 'השרטוט נטען' : floors.length + ' שרטוטים נטענו');
    }).catch(function (e) { A.toast('לא הצלחנו לקרוא את הקובץ: ' + (e && e.message || e), true); });
  }

  function sample() {
    var P = window.PlanSample, proj = P.sampleProject();
    var svg = new Blob([P.sampleSvg()], { type: 'image/svg+xml' }), url = URL.createObjectURL(svg);
    loadImage(url).then(function (img) {
      var j = toJpeg(img, P.W, P.H, MAX_SIDE);
      URL.revokeObjectURL(url);
      proj.floors[0].image = j.url;
      proj.floors[0].w = j.w; proj.floors[0].h = j.h;
      proj.id = uid('p'); proj.created = Date.now(); proj.name = 'דוגמה — ' + proj.title;
      proj.ai = { summary: 'שרטוט לדוגמה: דירת 4.5 חדרים בשטח של כ-140 מ״ר, עם ממ״ד, שני חדרי רחצה, מרפסת שירות ומרפסת שמש.', notes: [], confidence: 100, model: 'דוגמה' };
      Store.save(proj).then(function () { openProject(proj); A.toast('נפתח שרטוט לדוגמה'); });
    });
  }

  /* ---------- ניתוח עם Claude ---------- */

  function aiImages() {
    return Promise.all(st.proj.floors.map(function (f) {
      return loadImage(f.image).then(function (img) { return { name: f.label + (f.name ? ' (' + f.name + ')' : ''), data: toJpeg(img, f.w, f.h, AI_SIDE).url.split(',')[1] }; });
    }));
  }

  function openAi() {
    if (!st.proj || !st.proj.floors.length) return A.toast('העלו קודם שרטוט', true);
    var manual = !A.state.ai;
    $('#pAiManual').hidden = !manual;
    $('#pAiError').textContent = '';
    $('#pAiPaste').value = '';
    $('#pAiSend').textContent = manual ? 'טעינת התשובה' : 'ניתוח';
    $('#pAiDlg').showModal();
  }

  function merge(res, model) {
    var p = st.proj;
    p.kind = res.project_type || p.kind;
    if (res.title && (p.autoName || !p.name)) { p.name = res.title; p.autoName = false; }
    res.floors.forEach(function (rf, idx) {
      var f = p.floors[rf.image_index != null && p.floors[rf.image_index] ? rf.image_index : idx];
      if (!f) return;
      f.label = rf.label || f.label; f.level = rf.level != null ? rf.level : f.level; f.repeat = Math.max(1, rf.repeat || 1); f.kind = rf.kind || f.kind;
      f.common = rf.common || [];
      f.calib = null;
      f.apartments = (rf.apartments || []).map(function (a) {
        var aid = uid('a');
        return { id: aid, name: a.name || 'דירה', entrance: a.entrance, panel: a.panel, rooms: (a.rooms || []).map(function (r) { r.id = uid('r'); return r; }) };
      });
    });
    p.ai = { summary: res.summary, notes: res.notes || [], confidence: res.confidence, model: model };
    $('#pKind').value = p.kind;
    st.sel = { floor: p.floors[0].id, apt: p.floors[0].apartments[0] && p.floors[0].apartments[0].id };
    $('#pAiPanel').innerHTML = aiSummary(p.ai);
    $('#pName').value = p.name;
    render(); save();
  }

  function aiSummary(ai) {
    return '<div class="card ai-result plan-ai"><header class="rhead"><div><span class="who">ניתוח השרטוט · ' + esc(ai.model || '') + '</span>' +
      '<h3 class="rtitle">' + esc(st.proj ? st.proj.name : '') + '</h3></div>' + (ai.confidence != null ? '<span class="conf"><span class="meter"><i style="width:' + Math.max(0, Math.min(100, ai.confidence)) + '%"></i></span>ביטחון ' + ai.confidence + '%</span>' : '') + '</header>' +
      '<p class="summary">' + esc(ai.summary || '') + '</p>' + (ai.notes && ai.notes.length ? '<ul class="bullets">' + ai.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="muted small">לחצו על חדר בשרטוט כדי לתקן שם, סוג, גבולות או כמות נקודות. אפשר גם לשרטט חדר חדש ולכייל קנה מידה.</p></div>';
  }

  function sendAi() {
    var req = $('#pAiReq').value.trim(), kind = $('#pKind').value;
    if (!A.state.ai) {
      var r;
      try { r = FP.parseFloor($('#pAiPaste').value); } catch (e) { $('#pAiError').textContent = 'לא הצלחנו לקרוא את התשובה: ' + e.message; return; }
      $('#pAiDlg').close();
      var issues = F.validate(r);
      merge(r, 'claude.ai (העתק-הדבק)');
      if (issues.length) A.toast('נמצאו ' + issues.length + ' בעיות בגבולות החדרים — בדקו ותקנו', true);
      return;
    }
    $('#pAiDlg').close();
    var host = $('#pAiPanel'), ctl = new AbortController(), started = Date.now(), final = null, failed = null;
    host.innerHTML = '<div class="card progress"><div class="pulse" aria-hidden="true"><span></span></div><div class="progress-body"><b id="ppT">Claude קורא את השרטוטים…</b><p id="ppX">מכין תמונות</p>' +
      '<details class="thinking" id="ppThinkBox" hidden><summary>מהלך החשיבה</summary><p id="ppThink"></p></details></div><button class="btn ghost small" type="button" id="ppStop">עצירה</button></div>';
    $('#ppStop').addEventListener('click', function () { ctl.abort(); });
    var tick = setInterval(function () { var t = $('#ppT'); if (t) t.textContent = 'Claude קורא את השרטוטים… ' + Math.round((Date.now() - started) / 1000) + ' שנ׳'; }, 1000);
    var headers = { 'content-type': 'application/json' };
    if (A.state.code) headers['x-access-code'] = A.state.code;
    aiImages().then(function (images) {
      $('#ppX').textContent = 'שולח ' + images.length + ' שרטוטים';
      return fetch('api/floorplan', { method: 'POST', headers: headers, signal: ctl.signal, body: JSON.stringify({ images: images, request: req, kind: kind }) });
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { if (j.needCode) A.askCode(); throw new Error(j.error || 'שגיאת שרת ' + r.status); });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) return;
          buf += dec.decode(x.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (ln) {
            if (!ln.trim()) return;
            var m = JSON.parse(ln);
            if (m.error) failed = m.error;
            if (m.thinking) { $('#ppThinkBox').hidden = false; var t = $('#ppThink'); t.textContent = (t.textContent + m.thinking).slice(-4000); }
            if (m.chars) $('#ppX').textContent = 'מסמן חדרים… ' + m.chars.toLocaleString('he-IL') + ' תווים';
            if (m.phase === 'revise') $('#ppX').textContent = 'הבדיקה האוטומטית מצאה ' + m.issues.length + ' בעיות בגבולות החדרים — Claude מתקן';
            if (m.phase === 'done') final = m;
          });
          return pump();
        });
      }
      return pump();
    }).then(function () { if (!final && !failed) throw new Error('החיבור נסגר לפני שהתקבלה תשובה'); })
      .catch(function (e) { failed = failed || (ctl.signal.aborted ? 'הניתוח נעצר' : e.message); })
      .then(function () {
        clearInterval(tick);
        if (failed) { host.innerHTML = '<div class="card retry"><p><b>הניתוח לא הושלם.</b> ' + esc(failed) + '</p></div>'; A.toast(failed, true); return; }
        merge(final.result, final.model + (final.revisions ? ' · תוקן אחרי בדיקה' : ''));
        A.toast('השרטוט נותח: ' + countRooms() + ' חדרים');
      });
  }

  function countRooms() { return st.proj.floors.reduce(function (s, f) { return s + f.apartments.reduce(function (t, a) { return t + a.rooms.length; }, 0); }, 0); }

  /* ---------- ציור ---------- */

  function render(keepTab) {
    if (!st.proj) return;
    tree();
    inspector();
    kpis();
    $$('[data-ptab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.ptab === st.tab)); });
    if (st.tab !== '3d' && st.viewer) { st.viewer.dispose(); st.viewer = null; }
    if (keepTab === 'overlay' && st.tab === 'plan') return drawOverlay();
    var host = $('#pTab');
    if (st.tab === 'plan') planTab(host);
    else if (st.tab === 'rooms') host.innerHTML = roomsTab();
    else if (st.tab === 'panel') panelTab(host);
    else if (st.tab === 'building') host.innerHTML = buildingTab();
    else threeTab(host);
  }

  function tree() {
    var p = st.proj;
    $('#pTree').innerHTML = p.floors.map(function (f) {
      var on = floor() === f;
      return '<div class="fl' + (on ? ' on' : '') + '" data-floor="' + f.id + '">' +
        '<button type="button" class="fl-head" data-fsel="' + f.id + '"><img src="' + f.image + '" alt=""><span><b>' + esc(f.label) + '</b><small>' + f.apartments.length + ' דירות · ' + f.apartments.reduce(function (s, a) { return s + a.rooms.length; }, 0) + ' חדרים' + (f.repeat > 1 ? ' · ×' + f.repeat : '') + '</small></span></button>' +
        (on ? '<div class="fl-edit"><label>שם<input data-ff="label" value="' + esc(f.label) + '"></label><label>קומה<input type="number" data-ff="level" value="' + f.level + '"></label>' +
          '<label>חוזרת ×<input type="number" min="1" max="60" data-ff="repeat" value="' + (f.repeat || 1) + '"></label>' +
          '<label>סוג<select data-ff="kind">' + [['residential', 'מגורים'], ['ground', 'קרקע/לובי'], ['parking', 'חניון'], ['roof', 'גג'], ['other', 'אחר']].map(function (k) { return '<option value="' + k[0] + '"' + (f.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></label>' +
          '<button type="button" class="x-btn" data-fdel="' + f.id + '" aria-label="מחיקת הקומה">×</button></div>' +
          '<div class="apts">' + f.apartments.map(function (a) {
            return '<button type="button" class="apt' + (apt() === a ? ' on' : '') + '" data-asel="' + a.id + '"><b>' + esc(a.name) + '</b><span>' + a.rooms.length + ' חדרים · ' + aptArea(f, a).toFixed(0) + ' מ״ר</span></button>';
          }).join('') + '</div>' : '') + '</div>';
    }).join('');
    $$('[data-fsel]').forEach(function (b) { b.addEventListener('click', function () { var f = st.proj.floors.filter(function (x) { return x.id === b.dataset.fsel; })[0]; st.sel = { floor: f.id, apt: f.apartments[0] && f.apartments[0].id }; render(); }); });
    $$('[data-asel]').forEach(function (b) { b.addEventListener('click', function () { st.sel.apt = b.dataset.asel; st.sel.room = null; render(); }); });
    $$('[data-ff]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = inp.dataset.ff, v = inp.value;
        change(function () { floor()[k] = k === 'level' ? parseInt(v, 10) || 0 : k === 'repeat' ? Math.max(1, parseInt(v, 10) || 1) : v; });
      });
    });
    $$('[data-fdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('למחוק את הקומה הזו מהפרויקט?')) return;
        change(function () { st.proj.floors = st.proj.floors.filter(function (f) { return f.id !== b.dataset.fdel; }); st.sel = {}; });
      });
    });
  }

  function aptArea(f, a) { var s = F.scale(f); return a.rooms.reduce(function (t, r) { return t + F.roomMeters(f, r, s).area; }, 0); }

  function inspector() {
    var host = $('#pInspector'), r = room(), a = apt(), f = floor();
    if (r && a && f) return roomInspector(host, f, a, r);
    if (a) {
      host.innerHTML = '<h3>' + esc(a.name) + '</h3><div class="ins-grid"><label class="span-2">שם הדירה<input data-af="name" value="' + esc(a.name) + '"></label>' +
        '<label>חיבור<select data-af="supply"><option value="">אוטומטי</option>' + ['3x25', '3x40', '1x40'].map(function (s) { return '<option value="' + s + '"' + (a.supply === s ? ' selected' : '') + '>' + s.replace('x', '×') + 'A</option>'; }).join('') + '</select></label>' +
        '<label>&nbsp;<button type="button" class="btn ghost small danger-text" data-adel>מחיקת הדירה</button></label></div>' +
        '<p class="muted small">לחצו על חדר בשרטוט כדי לערוך אותו. במצב "שרטוט חדר" גוררים מלבן על השרטוט.</p>';
      $$('[data-af]', host).forEach(function (inp) { inp.addEventListener('change', function () { var k = inp.dataset.af, v = inp.value; change(function () { a[k] = v || undefined; }); }); });
      $('[data-adel]', host).addEventListener('click', function () {
        if (!confirm('למחוק את ' + a.name + ' וכל החדרים שלה?')) return;
        change(function () { f.apartments = f.apartments.filter(function (x) { return x !== a; }); st.sel.apt = null; });
      });
      return;
    }
    host.innerHTML = '<h3>עריכה</h3><p class="muted small">' + (f && !f.apartments.length ? 'בקומה הזו עדיין אין דירות. הריצו "ניתוח עם Claude", או לחצו "+ דירה בקומה" ושרטטו חדרים.' : 'בחרו דירה או חדר.') + '</p>';
  }

  function roomInspector(host, f, a, r) {
    var plan = F.apartmentPlan(st.proj, f, a), hr = plan.rooms.filter(function (x) { return x.id === r.id; })[0];
    var P = F.placePoints(st.proj, f, a, plan)[r.id] || { points: [], m: F.roomMeters(f, r) };
    var m = P.m, o = r.override || {};
    var counts = {};
    P.points.forEach(function (p) { counts[p.kind] = (counts[p.kind] || 0) + 1; });
    function cnt(k, label) {
      return '<div class="counter" data-rc="' + k + '"><span class="c-lbl">' + label + '</span><button type="button" data-d="-1" aria-label="פחות ' + label + '">−</button><b>' + (hr[k] || 0) + '</b><button type="button" data-d="1" aria-label="יותר ' + label + '">+</button></div>';
    }
    host.innerHTML = '<h3>' + esc(r.name) + ' <span class="muted small">' + esc(a.name) + '</span></h3>' +
      '<div class="ins-grid"><label>שם<input data-rf="name" value="' + esc(r.name) + '"></label><label>סוג<select data-rf="type">' + FP.ROOM_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === r.type ? ' selected' : '') + '>' + H.ROOMS[t].name + '</option>'; }).join('') + '</select></label>' +
      '<label>דירה<select data-rf="apt">' + f.apartments.map(function (x) { return '<option value="' + x.id + '"' + (x === a ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>מזגן<select data-rf="ac">' + Object.keys(H.AC_SIZES).map(function (k) { return '<option value="' + k + '"' + (k === (hr.ac || '') ? ' selected' : '') + '>' + (k ? H.AC_SIZES[k].name : 'ללא') + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="room-dims"><b>' + m.w.toFixed(2) + ' × ' + m.h.toFixed(2) + ' מ׳</b> · ' + m.area.toFixed(1) + ' מ״ר' + (r.width_m ? ' · בשרטוט: ' + r.width_m + '×' + r.length_m : '') + '</p>' +
      '<div class="counters">' + cnt('sockets', 'שקעים') + cnt('lights', 'מאור') + cnt('net', 'רשת') + cnt('tv', 'טלוויזיה') + '</div>' +
      '<div class="room-apps"><span class="sub">מעגלים ייעודיים</span>' + Object.keys(H.APPLIANCES).map(function (k) { return '<label class="check small"><input type="checkbox" data-rapp="' + k + '"' + (hr.app && hr.app[k] ? ' checked' : '') + '> <span>' + H.APPLIANCES[k].name + '</span></label>'; }).join('') + '</div>' +
      '<div class="room-power"><span><b dir="ltr">' + P.kw.toFixed(2) + ' kW</b> הספק מחובר</span><span><b dir="ltr">' + P.amps.toFixed(1) + ' A</b> זרם מחובר</span></div>' +
      '<details class="pts" open><summary>נקודות בחדר (' + P.points.length + ')</summary><ul>' + P.points.map(function (p) {
        return '<li><span class="pk pk-' + p.kind + '"></span>' + esc(p.label) + ' <span class="muted">· ' + p.h + ' מ׳' + (p.circuit ? ' · מעגל ' + p.circuit.id + ' ' + esc(p.circuit.breaker) : '') + (p.kw ? ' · ' + p.kw + 'kW / ' + (p.kw * 1000 / 230).toFixed(1) + 'A' : '') + '</span></li>';
      }).join('') + '</ul></details>' +
      '<div class="ins-actions"><button type="button" class="btn ghost small" data-rreset>איפוס לברירת המחדל</button><button type="button" class="btn ghost small danger-text" data-rdel>מחיקת החדר</button></div>';

    $$('[data-rf]', host).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = inp.dataset.rf, v = inp.value;
        change(function () {
          if (k === 'apt') { a.rooms = a.rooms.filter(function (x) { return x !== r; }); f.apartments.filter(function (x) { return x.id === v; })[0].rooms.push(r); st.sel.apt = v; }
          else if (k === 'ac') { r.override = r.override || {}; r.override.ac = v; }
          else r[k] = v;
        });
      });
    });
    $$('[data-rc]', host).forEach(function (c) {
      $$('button', c).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = c.dataset.rc;
          change(function () { r.override = r.override || {}; r.override[k] = Math.max(0, Math.min(30, (hr[k] || 0) + +b.dataset.d)); }, 'overlay');
        });
      });
    });
    $$('[data-rapp]', host).forEach(function (cb) {
      cb.addEventListener('change', function () { change(function () { r.override = r.override || {}; r.override.app = JSON.parse(JSON.stringify(hr.app || {})); r.override.app[cb.dataset.rapp] = cb.checked; }, 'overlay'); });
    });
    $('[data-rreset]', host).addEventListener('click', function () { change(function () { delete r.override; }); });
    $('[data-rdel]', host).addEventListener('click', function () { change(function () { a.rooms = a.rooms.filter(function (x) { return x !== r; }); st.sel.room = null; }); });
  }

  function kpis() {
    var B = F.building(st.proj), rooms = 0, area = 0, sockets = 0, lights = 0;
    B.units.forEach(function (u) {
      rooms += u.plan.rooms.length * u.rep; area += u.area * u.rep;
      u.plan.rooms.forEach(function (r) { sockets += r.sockets * u.rep; lights += r.lights * u.rep; });
    });
    var floors = st.proj.floors.reduce(function (s, f) { return s + (f.repeat || 1); }, 0);
    $('#pKpis').innerHTML =
      '<div class="kpi"><b>' + floors + '</b><span>קומות · ' + B.apartments + ' דירות</span></div>' +
      '<div class="kpi"><b>' + Math.round(area) + '</b><span>מ״ר · ' + rooms + ' חדרים</span></div>' +
      '<div class="kpi"><b>' + sockets + '</b><span>שקעים · ' + lights + ' מאור</span></div>' +
      '<div class="kpi"><b dir="ltr">' + B.demandKw.toFixed(1) + '</b><span>kW עומס משוער</span></div>' +
      '<div class="kpi wide"><span class="kpi-t">' + (B.isBuilding ? 'חיבור לבניין' : 'חיבור לדירה') + '</span><b dir="ltr" class="kpi-big">' + (B.isBuilding ? '3×' + B.main + 'A' : (B.units[0] ? B.units[0].supply.replace('x', '×') + 'A' : '—')) + '</b><span>' + B.amps.toFixed(0) + 'A לפאזה במצב עומס משוער' + (B.isBuilding ? ' · מקדם בו-זמניות ' + B.ks : '') + '</span></div>';
  }

  /* ---------- לשונית שרטוט ---------- */

  var LEGEND = [['socket', 'שקע'], ['light', 'מאור'], ['switch', 'מתג'], ['ac', 'מזגן'], ['tv', 'טלוויזיה'], ['net', 'רשת'], ['appliance', 'מעגל ייעודי'], ['fan', 'מאוורר'], ['panel', 'לוח חשמל']];

  function planTab(host) {
    var f = floor();
    if (!f) { host.innerHTML = '<div class="card empty"><p>אין שרטוטים בפרויקט.</p></div>'; return; }
    host.innerHTML = '<div class="card canvas-card plan-canvas-card"><div class="canvas-tools">' +
      '<div class="seg small-seg" role="radiogroup" aria-label="כלי עריכה">' + [['select', 'בחירה והזזה'], ['draw', 'שרטוט חדר'], ['calib', 'כיול קנה מידה']].map(function (m) { return '<button type="button" role="radio" data-pmode="' + m[0] + '" aria-checked="' + (st.mode === m[0]) + '" aria-selected="' + (st.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<label class="wire-pick">חדר חדש<select id="pNewType">' + FP.ROOM_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === st.newType ? ' selected' : '') + '>' + H.ROOMS[t].name + '</option>'; }).join('') + '</select></label>' +
      '<label class="check small"><input type="checkbox" id="pPts"' + (st.points ? ' checked' : '') + '> <span>נקודות חשמל</span></label>' +
      '<p class="hint" id="pHint"></p></div>' +
      '<div class="sch-canvas plan-canvas" id="pCanvas"></div>' +
      '<div class="legend-row">' + LEGEND.map(function (l) { return '<span><i class="pk pk-' + l[0] + '"></i>' + l[1] + '</span>'; }).join('') + '<span class="muted">קנה מידה: ' + (F.scale(f) * 100).toFixed(2) + ' ס״מ לפיקסל' + (f.calib ? ' (מכויל)' : '') + '</span></div></div>';
    $$('[data-pmode]', host).forEach(function (b) { b.addEventListener('click', function () { st.mode = b.dataset.pmode; st.calib = null; planTab(host); }); });
    $('#pNewType').addEventListener('change', function () { st.newType = this.value; });
    $('#pPts').addEventListener('change', function () { st.points = this.checked; drawOverlay(); });
    drawOverlay();
    bindCanvas();
  }

  function hint() {
    var h = $('#pHint');
    if (!h) return;
    h.textContent = st.mode === 'draw' ? 'גררו מלבן על השרטוט כדי להוסיף ' + H.ROOMS[st.newType].name + ' לדירה הנבחרת.'
      : st.mode === 'calib' ? (st.calib ? 'לחצו על הנקודה השנייה של מידה ידועה.' : 'לחצו על שתי נקודות שהמרחק ביניהן ידוע (למשל קיר עם מידה כתובה).')
        : 'לחצו על חדר לעריכה. גררו כדי להזיז, וגררו פינה כדי לשנות גודל. Delete מוחק.';
  }

  function drawOverlay() {
    var c = $('#pCanvas'), f = floor();
    if (!c || !f) return;
    c.innerHTML = F.renderOverlay(st.proj, f, { apt: st.sel.apt, room: st.sel.room, editable: st.mode === 'select', points: st.points });
    var svg = $('svg', c);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    hint();
  }

  function svgPt(svg, ev) {
    var p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  function bindCanvas() {
    var c = $('#pCanvas'), drag = null;
    c.addEventListener('pointerdown', function (ev) {
      var svg = $('svg', c), f = floor();
      if (!svg || ev.button !== 0) return;
      var pt = svgPt(svg, ev), nx = pt.x / f.w * 1000, ny = pt.y / f.h * 1000;
      if (st.mode === 'calib') {
        if (!st.calib) { st.calib = { x: pt.x, y: pt.y }; hint(); return; }
        var dist = Math.hypot(pt.x - st.calib.x, pt.y - st.calib.y);
        var v = parseFloat(String(prompt('מה המרחק האמיתי בין שתי הנקודות, במטרים?', '') || '').replace(',', '.'));
        st.calib = null;
        if (v > 0 && dist > 3) { change(function () { f.calib = v / dist; }); A.toast('קנה המידה עודכן'); }
        else hint();
        return;
      }
      if (st.mode === 'draw') {
        drag = { kind: 'draw', x0: nx, y0: ny, svg: svg };
        c.setPointerCapture(ev.pointerId);
        return;
      }
      var handle = ev.target.closest('.fp-handle'), g = ev.target.closest('.fp-room');
      if (!g) { if (st.sel.room) { st.sel.room = null; render('overlay'); inspector(); } return; }
      var a = f.apartments.filter(function (x) { return x.id === g.dataset.apt; })[0];
      var r = a && a.rooms.filter(function (x) { return x.id === g.dataset.room; })[0];
      if (!r) return;
      if (st.sel.room !== r.id) { st.sel.apt = a.id; st.sel.room = r.id; render(); return; }
      drag = { kind: handle ? 'resize' : 'move', h: handle ? +handle.dataset.h : -1, r: r, start: { x: nx, y: ny }, box: JSON.parse(JSON.stringify(F.box(r))), svg: svg, moved: false };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var f = floor(), pt = svgPt(drag.svg, ev), nx = Math.max(0, Math.min(1000, pt.x / f.w * 1000)), ny = Math.max(0, Math.min(1000, pt.y / f.h * 1000));
      if (drag.kind === 'draw') {
        var rect = $('#pDrawRect') || (function () { var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.id = 'pDrawRect'; r.setAttribute('fill', 'rgba(28,111,224,.15)'); r.setAttribute('stroke', '#1c6fe0'); r.setAttribute('stroke-width', String(Math.max(f.w, f.h) * 0.003)); drag.svg.appendChild(r); return r; })();
        rect.setAttribute('x', Math.min(drag.x0, nx) / 1000 * f.w); rect.setAttribute('y', Math.min(drag.y0, ny) / 1000 * f.h);
        rect.setAttribute('width', Math.abs(nx - drag.x0) / 1000 * f.w); rect.setAttribute('height', Math.abs(ny - drag.y0) / 1000 * f.h);
        drag.x1 = nx; drag.y1 = ny;
        return;
      }
      var dx = nx - drag.start.x, dy = ny - drag.start.y, b = drag.box, r = drag.r;
      if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
      if (drag.kind === 'move') r.box = { x0: Math.round(b.x0 + dx), y0: Math.round(b.y0 + dy), x1: Math.round(b.x1 + dx), y1: Math.round(b.y1 + dy) };
      else {
        var nb = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
        if (drag.h === 0 || drag.h === 2) nb.x0 = Math.round(b.x0 + dx); else nb.x1 = Math.round(b.x1 + dx);
        if (drag.h === 0 || drag.h === 1) nb.y0 = Math.round(b.y0 + dy); else nb.y1 = Math.round(b.y1 + dy);
        r.box = nb;
      }
      drawOverlay();
      drag.svg = $('#pCanvas svg');
    });
    c.addEventListener('pointerup', function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (d.kind === 'draw') {
        if (d.x1 == null || Math.abs(d.x1 - d.x0) < 8 || Math.abs(d.y1 - d.y0) < 8) { drawOverlay(); return; }
        var f = floor(), a = apt();
        change(function () {
          if (!a) { a = { id: uid('a'), name: 'דירה ' + (f.apartments.length + 1), rooms: [] }; f.apartments.push(a); }
          var r = { id: uid('r'), name: H.ROOMS[st.newType].name, type: st.newType, box: { x0: Math.round(Math.min(d.x0, d.x1)), y0: Math.round(Math.min(d.y0, d.y1)), x1: Math.round(Math.max(d.x0, d.x1)), y1: Math.round(Math.max(d.y0, d.y1)) }, doors: [], windows: [] };
          a.rooms.push(r);
          st.sel.apt = a.id; st.sel.room = r.id;
        });
        return;
      }
      if (d.moved) { save(); render(); }
    });
    document.addEventListener('keydown', function (ev) {
      if ($('#view-plan').hidden || st.tab !== 'plan' || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') || $('dialog[open]')) return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && room()) { ev.preventDefault(); var a = apt(), r = room(); change(function () { a.rooms = a.rooms.filter(function (x) { return x !== r; }); st.sel.room = null; }); }
      if (ev.key === 'Escape' && st.sel.room) { st.sel.room = null; render(); }
    });
  }

  /* ---------- פירוט חדרים ---------- */

  function roomsTab() {
    var out = '';
    st.proj.floors.forEach(function (f) {
      f.apartments.forEach(function (a) {
        if (!a.rooms.length) return;
        var plan = F.apartmentPlan(st.proj, f, a), P = F.placePoints(st.proj, f, a, plan);
        var rows = a.rooms.map(function (r) {
          var x = P[r.id];
          if (!x) return '';
          var c = {};
          x.points.forEach(function (p) { c[p.kind] = (c[p.kind] || 0) + 1; });
          var circ = {};
          x.points.forEach(function (p) { if (p.circuit) circ[p.circuit.id] = p.circuit; });
          var ded = x.points.filter(function (p) { return p.kind === 'appliance' || p.kind === 'ac'; }).map(function (p) { return p.label; });
          return '<tr><td><b>' + esc(r.name) + '</b><small>' + esc(H.ROOMS[r.type] ? H.ROOMS[r.type].name : r.type) + '</small></td><td class="mono" dir="ltr">' + x.m.w.toFixed(1) + '×' + x.m.h.toFixed(1) + '</td><td class="mono">' + x.m.area.toFixed(1) + '</td>' +
            '<td class="mono">' + (c.socket || 0) + '</td><td class="mono">' + (c.light || 0) + '</td><td class="mono">' + (c.switch || 0) + '</td><td class="mono">' + ((c.net || 0) + (c.tv || 0)) + '</td>' +
            '<td class="small">' + esc(ded.join(' · ') || '—') + '</td><td class="small mono" dir="ltr">' + Object.keys(circ).map(function (k) { return '#' + k + ' ' + circ[k].breaker; }).join(', ') + '</td>' +
            '<td class="mono" dir="ltr">' + x.kw.toFixed(2) + ' kW</td><td class="mono" dir="ltr">' + x.amps.toFixed(1) + ' A</td></tr>';
        }).join('');
        var C = P._circuits;
        out += '<div class="card"><div class="panel-head"><div><h3>' + esc(a.name) + ' · ' + esc(f.label) + (f.repeat > 1 ? ' (×' + f.repeat + ')' : '') + '</h3><p class="muted small">' + C.circuits.length + ' מעגלים · ' + C.rcds.length + ' ממסרי פחת · עומס משוער ' + C.perPhaseA.map(function (x) { return x.toFixed(1) + 'A'; }).join(' / ') + ' לפאזה</p></div></div>' +
          '<div class="table-wrap"><table class="table rooms-t"><thead><tr><th>חדר</th><th>מידות (מ׳)</th><th>מ״ר</th><th>שקעים</th><th>מאור</th><th>מתגים</th><th>רשת/TV</th><th>מעגלים ייעודיים</th><th>מעגלים בלוח</th><th>הספק מחובר</th><th>זרם מחובר</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<p class="muted small">"זרם מחובר" הוא סכום הצרכנים בחדר כשכולם פועלים יחד (שקעים מחושבים לפי 120W לשקע). העומס שבו מתוכנן החיבור נמוך יותר, בגלל בו-זמניות.</p></div>';
      });
    });
    return out || '<div class="card empty"><p>אין עדיין חדרים. הריצו ניתוח או שרטטו חדרים.</p></div>';
  }

  /* ---------- לוח דירתי ---------- */

  function panelTab(host) {
    var f = floor(), a = apt();
    if (!a || !a.rooms.length) { host.innerHTML = '<div class="card empty"><p>בחרו דירה עם חדרים.</p></div>'; return; }
    var plan = F.apartmentPlan(st.proj, f, a), P = H.panel(plan), adv = H.advice(plan);
    host.innerHTML = '<div class="panel-wrap card"><div class="panel-head"><div><h3>לוח חשמל דירתי — ' + esc(a.name) + '</h3><p class="muted small">ממוקם ליד דלת הכניסה (מסומן בשרטוט). המספרים על המאמתים תואמים לטבלה.</p></div>' +
      '<div class="panel-facts"><span><b>' + esc(P.circuits.supply.main) + '</b></span><span>' + P.circuits.rcds.length + ' ממסרי פחת</span><span>' + P.rows.length + ' שורות × ' + P.rowMod + '</span><span>' + Math.round(P.spare / P.total * 100) + '% שמור</span></div></div>' +
      '<div class="panel-canvas">' + H.renderPanel(P, 'לוח חשמל — ' + a.name) + '</div></div>' +
      '<div class="card"><h3>מעגלים</h3><div class="table-wrap"><table class="table sched"><thead><tr><th>מס׳</th><th>מעגל</th><th>חדרים</th><th>מאמת</th><th>כבל</th><th>פאזה</th><th>פחת</th><th>הספק</th><th>זרם</th></tr></thead><tbody>' +
      P.devices.filter(function (d) { return d.kind === 'mcb'; }).map(function (d) {
        var c = d.circuit, amps = c.poles === 3 ? c.kw * 1000 / (Math.sqrt(3) * 400) : c.kw * 1000 / 230;
        return '<tr><td class="n">' + d.no + '</td><td>' + esc(c.title) + '</td><td class="small">' + esc(c.rooms.join(', ')) + '</td><td class="mono">' + esc(c.breaker) + '</td><td class="mono">' + esc(c.cable) + '</td><td>' + esc(c.phase) + '</td><td>' + esc(c.rcd) + '</td><td class="mono" dir="ltr">' + c.kw.toFixed(1) + ' kW</td><td class="mono" dir="ltr">' + amps.toFixed(1) + ' A</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="card advice"><h3>בדיקות והמלצות</h3><ul>' + adv.map(function (x) { return '<li class="' + x.level + '">' + esc(x.text) + '</li>'; }).join('') + '</ul></div>';
  }

  /* ---------- בניין ---------- */

  function buildingTab() {
    var B = F.building(st.proj);
    if (!B.units.length) return '<div class="card empty"><p>אין עדיין דירות עם חדרים.</p></div>';
    var rows = B.units.map(function (u) {
      return '<tr><td>' + esc(u.floor.label) + (u.rep > 1 ? ' <span class="tag">×' + u.rep + '</span>' : '') + '</td><td><b>' + esc(u.apt.name) + '</b></td><td class="mono">' + u.area.toFixed(0) + '</td><td class="mono">' + u.plan.rooms.length + '</td>' +
        '<td class="mono" dir="ltr">' + u.kw.toFixed(1) + ' kW</td><td class="mono" dir="ltr">' + u.maxA.toFixed(1) + ' A</td><td class="mono">' + u.supply.replace('x', '×') + 'A</td></tr>';
    }).join('');
    return '<div class="building-grid"><div class="card"><h3>' + (B.isBuilding ? 'חישוב עומס לבניין' : 'חישוב עומס') + '</h3><dl class="bdl">' +
      '<div><dt>דירות (כולל קומות חוזרות)</dt><dd>' + B.apartments + '</dd></div>' +
      '<div><dt>סכום עומס הדירות</dt><dd dir="ltr">' + B.aptKw.toFixed(1) + ' kW</dd></div>' +
      (B.isBuilding ? '<div><dt>מקדם בו-זמניות לבניין</dt><dd>' + B.ks + '</dd></div>' : '') +
      (B.common.length ? '<div><dt>שירותים משותפים</dt><dd>' + B.common.map(function (c) { return esc(c.name) + ' ' + c.kw.toFixed(1) + 'kW'; }).join('<br>') + '</dd></div>' : '') +
      '<div><dt>עומס משוער</dt><dd dir="ltr"><b>' + B.demandKw.toFixed(1) + ' kW · ' + B.amps.toFixed(0) + ' A</b></dd></div>' +
      (B.isBuilding ? '<div><dt>חיבור מומלץ מחברת החשמל</dt><dd><b>3×' + B.main + 'A</b></dd></div><div><dt>מונים בחדר המונים</dt><dd>' + B.meters + ' (דירה לכל מונה + שירותים משותפים' + (B.common.some(function (c) { return /מעלית/.test(c.name); }) ? ' + מעלית' : '') + ')</dd></div>' : '') +
      '</dl><p class="muted small">מקדמי הביקוש והבו-זמניות הם הערכה לתכנון ראשוני. החיבור הסופי נקבע מול חברת החשמל לפי תכנון מהנדס.</p></div>' +
      (B.isBuilding ? '<div class="card"><h3>לוח ראשי לבניין (בחדר המונים)</h3><ul class="bullets"><li>מפסק ראשי ' + B.main + 'A × 3 עם מגן ברק סוג 1+2</li><li>' + B.apartments + ' יציאות לדירות: ' + ['3x25', '3x40', '1x40'].filter(function (k) { return countSup(B, k); }).map(function (k) { return countSup(B, k) + ' × ' + k.replace('x', '×') + 'A'; }).join(', ') + ', כל אחת אחרי מונה</li><li>לוח שירותים משותפים: ' + B.common.map(function (c) { return esc(c.name); }).join(', ') + '</li><li>עמוד חשמל (רייזר) אנכי עם כבלי הזנה נפרדים לכל דירה, וקופסת הסתעפות בכל קומה</li></ul></div>' : '') +
      '</div>' +
      '<div class="card"><h3>דירות</h3><div class="table-wrap"><table class="table"><thead><tr><th>קומה</th><th>דירה</th><th>מ״ר</th><th>חדרים</th><th>עומס משוער</th><th>פאזה עמוסה</th><th>חיבור מומלץ</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      (B.isBuilding || st.proj.floors.length > 1 ? '<div class="card riser-card"><h3>עמוד חשמל וחדר מונים</h3><div class="panel-canvas">' + F.renderRiser(B, 'עמוד חשמל — ' + (st.proj.name || '')) + '</div></div>' : '');
  }
  function countSup(B, s) { return B.units.reduce(function (t, u) { return t + (u.supply === s ? u.rep : 0); }, 0); }

  /* ---------- תלת-ממד ---------- */

  function threeTab(host) {
    var f = floor(), a = apt();
    if (!a || !a.rooms.length) { host.innerHTML = '<div class="card empty"><p>בחרו דירה עם חדרים.</p></div>'; return; }
    host.innerHTML = '<div class="card three-card"><div class="canvas-tools"><p class="hint">גוררים כדי לסובב, גלגלת לזום, לחצן ימני להזזה. מעבר עם העכבר על נקודה מציג את פרטיה.</p>' +
      '<label class="check small"><input type="checkbox" id="p3cut"> <span>קירות חתוכים</span></label>' +
      '<button class="btn ghost small" type="button" id="p3top">מבט מלמעלה</button><button class="btn ghost small" type="button" id="p3per">מבט פרספקטיבה</button></div>' +
      '<div class="three-wrap" id="p3"><div class="three-loading">טוען תלת-ממד…</div><div class="three-tip" id="p3tip" hidden></div></div>' +
      '<div class="legend-row">' + LEGEND.map(function (l) { return '<span><i class="pk pk-' + l[0] + '"></i>' + l[1] + '</span>'; }).join('') + '</div></div>';
    var s = F.scale(f), P = F.placePoints(st.proj, f, a);
    var rooms = a.rooms.map(function (r) { var x = P[r.id]; return x && { name: r.name, area: x.m.area, m: x.m, points: x.points, doors: x.doors, windows: x.windows }; }).filter(Boolean);
    var bx = Math.min.apply(null, rooms.map(function (r) { return r.m.x; })), by = Math.min.apply(null, rooms.map(function (r) { return r.m.y; }));
    var bw = Math.max.apply(null, rooms.map(function (r) { return r.m.x + r.m.w; })) - bx, bh = Math.max.apply(null, rooms.map(function (r) { return r.m.y + r.m.h; })) - by;
    loadImage(f.image).then(function (img) {
      // חותכים מהשרטוט רק את שטח הדירה, לטקסטורת הרצפה
      var pxm = 1 / s, c = document.createElement('canvas');
      var sx = bx * pxm * (img.naturalWidth / f.w), sy = by * pxm * (img.naturalHeight / f.h), sw = bw * pxm * (img.naturalWidth / f.w), sh = bh * pxm * (img.naturalHeight / f.h);
      c.width = Math.max(2, Math.min(2048, Math.round(sw))); c.height = Math.max(2, Math.round(c.width * sh / Math.max(sw, 1)));
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return import(new URL('plan3d.js', BASE).href).then(function (mod) {
        var el = $('#p3');
        if (!el) return;
        $('.three-loading', el).remove();
        st.viewer = mod.mount(el, {
          rooms: rooms, image: c, bbox: { x: bx, y: by, w: bw, h: bh },
          onHover: function (d, ev) {
            var tip = $('#p3tip');
            if (!tip) return;
            if (!d) { tip.hidden = true; return; }
            var p = d.p;
            tip.hidden = false;
            tip.innerHTML = '<b>' + esc(p.label) + '</b><span>' + esc(d.room) + ' · גובה ' + p.h + ' מ׳</span>' + (p.circuit ? '<span>מעגל ' + p.circuit.id + ' · ' + esc(p.circuit.breaker) + ' · ' + esc(p.circuit.cable) + ' ממ״ר</span>' : '') + (p.kw ? '<span dir="ltr">' + p.kw + ' kW · ' + (p.kw * 1000 / 230).toFixed(1) + ' A</span>' : '');
            var b = el.getBoundingClientRect();
            tip.style.left = (ev.clientX - b.left + 14) + 'px';
            tip.style.top = (ev.clientY - b.top + 14) + 'px';
          }
        });
        $('#p3cut').addEventListener('change', function () { st.viewer && st.viewer.setCut(this.checked); });
        $('#p3top').addEventListener('click', function () { st.viewer && st.viewer.top(); });
        $('#p3per').addEventListener('click', function () { st.viewer && st.viewer.persp(); });
      });
    }).catch(function (e) {
      var el = $('#p3');
      if (el) el.innerHTML = '<div class="three-loading">לא ניתן להציג תלת-ממד בדפדפן הזה (' + esc(e && e.message || e) + ').</div>';
    });
  }

  /* ---------- הדפסה ופעולות ---------- */

  function printProject() {
    var w = window.open('', '_blank');
    if (!w) return A.toast('הדפדפן חסם חלון חדש', true);
    var B = F.building(st.proj), body = '<h1>' + esc(st.proj.name) + '</h1><p class="meta">' + esc(new Date().toLocaleDateString('he-IL')) + ' · מעגל סגור · עומס משוער ' + B.demandKw.toFixed(1) + 'kW</p>';
    st.proj.floors.forEach(function (f) {
      body += '<h2>' + esc(f.label) + (f.repeat > 1 ? ' (×' + f.repeat + ')' : '') + '</h2><div class="sch">' + F.renderOverlay(st.proj, f, { points: true }) + '</div>';
    });
    body += '<div class="rooms">' + roomsTab() + '</div>';
    B.units.forEach(function (u) { body += '<h2>לוח חשמל — ' + esc(u.apt.name) + '</h2><div class="sch">' + H.renderPanel(H.panel(u.plan), 'לוח חשמל — ' + u.apt.name) + '</div>'; });
    if (B.isBuilding) body += '<h2>עמוד חשמל וחדר מונים</h2><div class="sch">' + F.renderRiser(B, 'עמוד חשמל') + '</div>';
    w.document.write('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(st.proj.name) + '</title><style>body{font:12px/1.5 Heebo,Arial,sans-serif;margin:20px;color:#111}h1{font-size:22px;margin:0}h2{font-size:16px;border-bottom:2px solid #c9a45c;padding-bottom:4px;margin:22px 0 8px}.meta{color:#666}.sch{direction:ltr}.sch svg{width:100%;height:auto}table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #d6cfbf;padding:4px 6px;text-align:start}th{background:#f4efe4}small{display:block;color:#777}.card{break-inside:avoid;margin-bottom:10px}.muted{color:#777}.panel-head h3{margin:8px 0 2px}@page{size:A4;margin:10mm}</style></head><body>' + body + '<script>setTimeout(function(){print()},400)<\/script></body></html>');
    w.document.close();
  }

  function toHome() {
    var f = floor(), a = apt();
    if (!a || !a.rooms.length) return A.toast('בחרו דירה עם חדרים', true);
    var plan = F.apartmentPlan(st.proj, f, a);
    plan.id = 'h' + Date.now().toString(36);
    plan.created = Date.now();
    plan.name = (st.proj.name || '') + ' — ' + a.name;
    window.FixHome.open(plan);
    location.hash = '#home';
    A.toast('התכנית נפתחה בתכנון החשמל לבית');
  }

  function downloadImages() {
    st.proj.floors.forEach(function (f, i) {
      var link = document.createElement('a');
      link.href = f.image; link.download = (i + 1) + '-' + (f.label || 'floor').replace(/[\\/:*?"<>|]+/g, '-') + '.jpg';
      document.body.appendChild(link); link.click(); link.remove();
    });
  }

  /* ---------- הרכבה ---------- */

  function mount() {
    if (st.mounted) return;
    st.mounted = true;
    $('#pTech').innerHTML = Object.keys(H.SMART_TECH).map(function (k) { return '<option value="' + k + '">' + H.SMART_TECH[k].name + '</option>'; }).join('');
    var drop = $('#pDrop'), input = $('#pFiles');
    input.addEventListener('change', function () { addFiles(input.files, false); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { ev.preventDefault(); addFiles(ev.dataTransfer.files, false); });
    $('#pMore').addEventListener('change', function () { addFiles(this.files, true); this.value = ''; });
    $('#pSample').addEventListener('click', sample);
    $('#pAnalyze').addEventListener('click', openAi);
    $('#pAiSend').addEventListener('click', sendAi);
    $('#pAiCopy').addEventListener('click', function () { A.copy(FP.manualFloorPrompt($('#pAiReq').value.trim(), st.proj.floors.length, $('#pKind').value), 'ההנחיה הועתקה. הדביקו אותה ב-claude.ai וצרפו את השרטוטים.'); });
    $('#pAiImgs').addEventListener('click', downloadImages);
    $('#pName').addEventListener('input', function () { if (st.proj) { st.proj.name = this.value; st.proj.autoName = false; save(); } });
    $('#pSupply').addEventListener('change', function () { var v = this.value; change(function () { st.proj.supply = v; }); });
    $('#pTech').addEventListener('change', function () { var v = this.value; change(function () { st.proj.tech = v; }); });
    $('#pKind').addEventListener('change', function () { if (st.proj) { var v = this.value; change(function () { st.proj.kind = v; }); } });
    $('#pOpen').addEventListener('change', function () { var id = this.value; if (id) Store.get(id).then(function (p) { if (p) openProject(p); }); });
    $('#pAddApt').addEventListener('click', function () {
      var f = floor();
      if (!f) return A.toast('העלו קודם שרטוט', true);
      var a = { id: uid('a'), name: 'דירה ' + (f.apartments.length + 1), rooms: [] };
      change(function () { f.apartments.push(a); st.sel.apt = a.id; st.sel.room = null; st.mode = 'draw'; st.tab = 'plan'; });
      A.toast('נוספה ' + a.name + '. שרטטו עכשיו את החדרים שלה.');
    });
    $$('[data-ptab]').forEach(function (b) { b.addEventListener('click', function () { st.tab = b.dataset.ptab; render(); }); });
    $('#pPrint').addEventListener('click', printProject);
    $('#pToHome').addEventListener('click', toHome);
  }

  window.FixPlan = {
    show: function () {
      mount();
      if (st.proj) { render(); return; }
      Store.all().then(function (list) { if (!st.proj && list.length) openProject(list[0]); });
    }
  };

  if (location.hash === '#plan') window.FixPlan.show();
})();
