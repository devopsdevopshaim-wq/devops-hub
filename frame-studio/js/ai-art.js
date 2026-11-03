/* 🎨 AI paintings, on this computer: a real neural network (Google Magenta's arbitrary style transfer, Apache 2.0) repaints
   the photo in the style of a great painting. It runs in its own thread (ai-art-worker.js): on the graphics card when it
   works, else WebAssembly on the processor, so the program never freezes, and ⏹ stops it at once. No internet, no quota.
   - every painting's style is learnt in advance (media/styles/vectors.json); each tile shows a ready example
     (media/styles/pv/<id>.jpg, made by the same network) and, on hover, the network's preview on your own photo;
   - "עוצמה" mixes the painting's style with the photo's own, so faces stay recognisable at lower settings;
   - the result is drawn back at the photo's own size (the crop and the layers stay), "↩ ביטול AI" brings back the photo. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  FS.AI_ART = [
    ['starry', 'ליל כוכבים', 'ואן גוך'], ['kandinsky', 'קומפוזיציה', 'קנדינסקי'], ['wave', 'הגל הגדול', 'הוקוסאי'], ['sunflowers', 'חמניות', 'ואן גוך'],
    ['bluehorse', 'הסוס הכחול', 'פרנץ מארק'], ['yellow-red-blue', 'צהוב אדום כחול', 'קנדינסקי'], ['vangogh-night', 'כוכבים על הנהר', 'ואן גוך'], ['cafe', 'מרפסת בלילה', 'ואן גוך'],
    ['kiss', 'הנשיקה', 'קלימט'], ['klimt-adele', 'דיוקן זהב', 'קלימט'], ['scream', 'הצעקה', 'מונק'], ['circles', 'מעגלים', 'קנדינסקי'],
    ['tiger', 'הנמר', 'פרנץ מארק'], ['delaunay', 'חלון צבעוני', 'סוזה קרדוזו'], ['waterfall', 'המפל', 'הוקוסאי'], ['redfuji', 'פוג׳י האדום', 'הוקוסאי'],
    ['irises', 'אירוסים', 'ואן גוך'], ['cypresses', 'שדה וברושים', 'ואן גוך'], ['almondblossom', 'פריחת השקד', 'ואן גוך'], ['mucha', 'ארט נובו', 'מוחה'],
    ['persian', 'מיניאטורה פרסית', 'שאהנאמה'], ['strawberry', 'גן התותים', 'ויליאם מוריס'], ['klee', 'פנים בצבע', 'פאול קלה'], ['marc-fox', 'השועלים', 'פרנץ מארק'],
    ['bedroom', 'החדר בארל', 'ואן גוך'], ['vangogh-self', 'משיכות מכחול', 'ואן גוך'], ['treeoflife', 'עץ החיים', 'קלימט'], ['klimt-serpents', 'נחשי מים', 'קלימט'],
    ['plum', 'פריחת שזיף', 'הירושיגה'], ['japanese-bridge', 'הגשר היפני', 'מונה'], ['poppies', 'פרגים', 'מונה'], ['impression', 'אימפרסיה', 'מונה'],
    ['lilies', 'נימפאות', 'מונה'], ['waterloo', 'ערפל ורוד', 'מונה'], ['renoir', 'ריקוד בפריז', 'רנואר'], ['degas', 'רקדניות', 'דגה'],
    ['cezanne', 'ההר', 'סזאן'], ['seurat', 'נקודות אור', 'סרה'], ['turner', 'שקיעה בים', 'טרנר'], ['pearl', 'אור הולנדי', 'ורמיר'], ['schiele', 'קו אקספרסיבי', 'שילה']
  ];
  function find(id) { return FS.AI_ART.filter(function (a) { return a[0] === id; })[0]; }
  var worker = null, readyP = null, backend = '', jobs = {}, seq = 0, vecP = null;
  function vectors() { if (!vecP) { vecP = fetch('media/styles/vectors.json').then(function (r) { if (!r.ok) throw new Error('vectors'); return r.json(); }); vecP.catch(function () { vecP = null; }); } return vecP; }
  function failAll(err) { Object.keys(jobs).forEach(function (k) { var j = jobs[k]; delete jobs[k]; clearTimeout(j.to); j.no(err); }); }
  function reset(why) { if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } } worker = null; readyP = null; backend = ''; failAll(new Error(why || 'stopped')); }
  /* the worker, started on the first need and kept; a stuck start gives up after a minute */
  function start() {
    if (readyP) return readyP;
    readyP = new Promise(function (ok, no) {
      var w; try { w = new Worker('js/ai-art-worker.js'); } catch (e) { return no(e); }
      worker = w;
      var to = setTimeout(function () { no(new Error('init-timeout')); reset('init-timeout'); }, 60000);
      w.onmessage = function (e) {
        var m = e.data;
        if (m.t === 'ready') { clearTimeout(to); backend = m.backend; ok(backend); return; }
        if (m.t === 'fail') { clearTimeout(to); no(new Error(m.msg)); reset(m.msg); return; }
        var j = jobs[m.n]; if (!j) return; delete jobs[m.n]; clearTimeout(j.to);
        if (m.t === 'done') j.ok(m); else j.no(new Error(m.msg));
      };
      w.onerror = function (ev) { clearTimeout(to); var err = new Error((ev && ev.message) || 'worker'); no(err); reset(err.message); };
      w.postMessage({ t: 'init', base: new URL('./', location.href).href });
    });
    readyP.catch(function () { readyP = null; });
    return readyP;
  }
  FS.artBackend = function () { return backend; };
  FS.artStop = function () { reset('stopped'); };
  function fit8(v) { return Math.max(64, Math.round(v / 8) * 8); }
  function grab(img, max) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(W, H));
    var c = FS.canvas(fit8(W * k), fit8(H * k)), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return { rgba: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  }
  /* an image -> the painting's style (a canvas), `size` px on the long side, strength 0..1 */
  FS.artRun = function (img, id, size, strength) {
    var s = strength == null ? 0.8 : strength;
    return Promise.all([start(), vectors()]).then(function (r) {
      var vec = r[1][id]; if (!vec) throw new Error('style');
      var px = grab(img, size), own = s < 1 ? grab(img, 256) : null, n = ++seq;
      return new Promise(function (ok, no) {
        var limit = backend === 'webgl' ? 90000 : backend === 'wasm' ? 180000 : 400000;
        jobs[n] = { ok: ok, no: no, to: setTimeout(function () { reset('timeout'); }, limit) };
        var msg = { t: 'run', n: n, rgba: px.rgba.buffer, w: px.w, h: px.h, vec: vec, s: s, ownKey: (img.src || '') + '|' + (own ? own.w : 0) };
        var tr = [px.rgba.buffer]; if (own) { msg.own = own.rgba.buffer; msg.ow = own.w; msg.oh = own.h; tr.push(own.rgba.buffer); }
        worker.postMessage(msg, tr);
      }).then(function (m) {
        var c = FS.canvas(m.w, m.h); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.rgba), m.w, m.h), 0, 0); c.ms = m.ms; return c;
      });
    });
  };
  function sizeFor() { return backend === 'webgl' ? 1024 : backend === 'wasm' ? 768 : 448; }
  function engineName() { return backend === 'webgl' ? 'כרטיס המסך' : backend === 'wasm' ? 'המעבד' : 'המחשב'; }

  var running = false;
  FS.applyArt = function (list, id, strength, done) {
    var a = find(id); if (!a || !list || !list.length) return Promise.resolve(0);
    if (running) { FS.toast('ציור אחד בכל פעם: מחכים שהקודם יסתיים, או ⏹'); return Promise.resolve(0); }
    running = true; var n = 0, stop = false, t0 = Date.now(), err = null;
    function msg(k, extra) { FS.busy && FS.busy('🎨 ' + a[1] + ' · ' + a[2] + (list.length > 1 ? ' · ' + (k + 1) + ' מתוך ' + list.length : '') + (extra || (backend ? ' · על ' + engineName() + ', בלי אינטרנט' : ' · מכין את מנוע הציור…')), function () { stop = true; FS.artStop(); }); }
    msg(0);
    return list.reduce(function (ch, p, k) {
      return ch.then(function () {
        if (stop || err) return;
        var baseSrc = p.artSrc && p.src === p.artSrc && p.artBase ? p.artBase : p.src;
        return FS.loadImg(baseSrc).then(function (im) {
          return start().then(function () { msg(k); return FS.artRun(im, id, sizeFor(), strength); }).then(function (c) {
            var W = im.naturalWidth, H = im.naturalHeight, o = FS.canvas(W, H), x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H);
            return new Promise(function (ok, no) { o.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.94); });
          });
        }).then(function (b) { return FS.loadImg(URL.createObjectURL(b)); }).then(function (im2) {
          if (stop) return;
          if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
          p.artBase = baseSrc; p.src = im2.src; p.artSrc = im2.src; p.art = id;
          p.cache = {}; p._gt = null; p._pt = null; p._mc = null; p.quality = null; if (FS.snap) FS.snap(p); n++;
        }).catch(function (e) { if (!stop) err = e; });
      });
    }, Promise.resolve()).then(function () {
      running = false; FS.busy && FS.busy(); FS.emit('doc'); if (FS.render) FS.render(); if (FS.refreshStrip) FS.refreshStrip();
      var secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      if (stop) FS.toast('⏹ נעצר' + (n ? '. ' + n + ' תמונות כבר צוירו ("↩ ביטול AI" מחזיר).' : '.'), 4000);
      else if (err) FS.toast(/timeout/.test(String(err.message)) ? 'הציור לקח יותר מדי זמן במחשב הזה ונעצר. מורידים את "עוצמה" לא עוזר; עדיף מחשב עם כרטיס מסך, או עיצובי ה־AI בשרת.' : 'הציור לא הצליח (' + String(err.message || '') + '). מנסים שוב.', 8000);
      else if (n) FS.toast('🎨 ' + a[1] + ' · ' + a[2] + ': ' + n + (n > 1 ? ' תמונות' : ' תמונה') + ' ב־' + secs + ' שניות. "↩ ביטול AI" מחזיר.', 4500);
      if (done) done(list); return n;
    });
  };

  /* ---------- the panel ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private */ } }
  FS.artPanel = function (box, opt) {
    if (!box) return;
    var strength = Number(lsGet('fs-art-strength')) || 80, cache = {}, hoverT = 0, want = null, busy = false;
    box.innerHTML = '<h3 class="fx-h">🎨 ציורי AI על המחשב <small>' + FS.AI_ART.length + ' ציורי מופת · רשת נוירונים אמיתית · בלי אינטרנט ובלי מכסה · מעבירים עכבר לראות על התמונה שלכם</small></h3>' +
      '<div class="fx-bar"><p class="fx-note">הדוגמאות צוירו על ידי אותה רשת. לחיצה מציירת את התמונות.</p>' +
      '<label class="fx-str" title="פחות = הפנים והצבעים של הצילום נשמרים יותר">עוצמה <input type="range" min="30" max="100" step="5" value="' + strength + '"><b>' + strength + '%</b></label></div>' +
      '<div class="fx-grid">' + FS.AI_ART.map(function (a) { return '<button type="button" class="fx-t art-t" data-art="' + a[0] + '" title="' + a[1] + ' · ' + a[2] + '"><span class="fx-pv"><img class="art-ex" src="media/styles/pv/' + a[0] + '.jpg" alt="" loading="lazy"><canvas width="1" height="1"></canvas><img class="art-chip" src="media/styles/' + a[0] + '.jpg" alt="" loading="lazy"></span><span class="fx-n"><b>' + a[1] + '</b><small>' + a[2] + '</small></span></button>'; }).join('') + '</div>';
    var note = box.querySelector('.fx-note'), rg = box.querySelector('.fx-str input');
    rg.addEventListener('input', function () { strength = Number(rg.value); box.querySelector('.fx-str b').textContent = strength + '%'; lsSet('fs-art-strength', strength); });
    rg.addEventListener('change', function () { cache = {}; box.querySelectorAll('.art-t.pv').forEach(function (t) { t.classList.remove('pv'); }); });
    var grid = box.querySelector('.fx-grid');
    grid.addEventListener('click', function (e) {
      var t = e.target.closest('[data-art]'); if (!t) return;
      var list = opt.list(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
      t.classList.add('fx-go'); setTimeout(function () { t.classList.remove('fx-go'); }, 700);
      FS.applyArt(list, t.dataset.art, strength / 100, function (l) { cache = {}; if (opt.done) opt.done(l); });
    });
    /* hover: the network's preview of that painting on your photo (one at a time, the last hovered wins) */
    function live(t) {
      var p = opt.preview && opt.preview(); if (!p || running) return;
      var src = p.artSrc && p.src === p.artSrc && p.artBase ? p.artBase : p.src, key = t.dataset.art + '|' + src + '|' + strength;
      if (cache[key]) return paint(t, cache[key]);
      want = { t: t, key: key, src: src }; if (busy) return; next();
    }
    function paint(t, c) { var cv = t.querySelector('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); t.classList.add('pv'); }
    function next() {
      if (!want || running) return; var w = want; want = null; busy = true;
      if (!backend) note.textContent = 'מכין את מנוע הציור (פעם אחת)…';
      FS.loadImg(w.src).then(function (im) { return FS.artRun(im, w.t.dataset.art, 224, strength / 100); }).then(function (c) {
        cache[w.key] = c; paint(w.t, c);
        note.textContent = (backend === 'webgl' ? '⚡ על כרטיס המסך' : '⚙️ על המעבד') + ' · התצוגה על התמונה שלכם: ' + (c.ms < 1000 ? 'פחות משנייה' : Math.round(c.ms / 100) / 10 + ' שניות') + '. לחיצה מציירת.';
      }).catch(function (e) { if (!/stopped/.test(String(e && e.message))) note.textContent = 'מנוע הציור לא עלה במחשב הזה (' + String((e && e.message) || '') + '). הדוגמאות עדיין מראות איך זה ייראה.'; })
        .then(function () { busy = false; if (want) next(); });
    }
    grid.addEventListener('pointerover', function (e) { var t = e.target.closest('[data-art]'); if (!t) return; clearTimeout(hoverT); hoverT = setTimeout(function () { live(t); }, 300); });
    grid.addEventListener('pointerleave', function () { clearTimeout(hoverT); want = null; });
    grid.addEventListener('focusin', function (e) { var t = e.target.closest('[data-art]'); if (t) live(t); });
    /* a new photo chosen: the old previews go */
    FS.on('history', function () { cache = {}; box.querySelectorAll('.art-t.pv').forEach(function (t) { t.classList.remove('pv'); }); });
  };
})();
