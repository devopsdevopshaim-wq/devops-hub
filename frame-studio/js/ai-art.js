/* 🎨 AI art styles, on this computer: a real neural network (Google Magenta's arbitrary style transfer, Apache 2.0, in
   TensorFlow.js on the graphics card) repaints the photo in the style of a great painting. A second or two a photo, no
   internet, no quota. Each painting's style is learnt in advance (media/styles/vectors.json), so a photo needs one pass.
   "עוצמה" mixes the painting's style with the photo's own, so faces stay recognisable at lower settings. Every style is
   previewed live on the photo by the same network. The paintings are public domain (media/styles/credits.json). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  FS.AI_ART = [
    ['starry', 'ליל כוכבים', 'ואן גוך'], ['wave', 'הגל הגדול', 'הוקוסאי'], ['kiss', 'הנשיקה', 'קלימט'], ['klimt-adele', 'דיוקן זהב', 'קלימט'],
    ['impression', 'אימפרסיה', 'מונה'], ['lilies', 'נימפאות', 'מונה'], ['sunflowers', 'חמניות', 'ואן גוך'], ['almondblossom', 'פריחת השקד', 'ואן גוך'],
    ['cafe', 'מרפסת בלילה', 'ואן גוך'], ['vangogh-self', 'משיכות מכחול', 'ואן גוך'], ['scream', 'הצעקה', 'מונק'], ['kandinsky', 'קומפוזיציה', 'קנדינסקי'],
    ['yellow-red-blue', 'צהוב אדום כחול', 'קנדינסקי'], ['mondrian', 'קווים וצבע', 'מונדריאן'], ['seurat', 'נקודות אור', 'סרה'], ['turner', 'שקיעה בים', 'טרנר'],
    ['waterloo', 'ערפל ורוד', 'מונה'], ['mucha', 'ארט נובו', 'מוחה'], ['treeoflife', 'עץ החיים', 'קלימט'], ['stainedglass', 'ויטראז׳', 'קתדרלת שארטר'],
    ['redfuji', 'פוג׳י האדום', 'הוקוסאי'], ['hiroshige', 'גשם ביפן', 'הירושיגה'], ['bluehorse', 'הסוס הכחול', 'פרנץ מארק'], ['marc-fox', 'השועלים', 'פרנץ מארק'],
    ['delaunay', 'חלון צבעוני', 'סוזה קרדוזו'], ['nightwatch', 'משמר הלילה', 'רמברנדט'], ['pearl', 'אור הולנדי', 'ורמיר'], ['schiele', 'קו אקספרסיבי', 'שילה']
  ];
  var BASE = 'models/art/', tfP = null, netP = null, vecP = null, contentB = {};
  function find(id) { return FS.AI_ART.filter(function (a) { return a[0] === id; })[0]; }
  function script(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('tfjs')); }; document.head.appendChild(s); }); }
  function tfReady() {
    if (tfP) return tfP;
    tfP = (window.tf ? Promise.resolve() : script('vendor/tfjs/tf.min.js')).then(function () {
      var tf = window.tf; tf.env().set('WEBGL_PACK', true);
      return tf.setBackend('webgl').catch(function () { return false; }).then(function (ok) { if (!ok) return tf.setBackend('cpu'); }).then(function () { return tf.ready(); }).then(function () { return tf; });
    });
    tfP.catch(function () { tfP = null; });
    return tfP;
  }
  FS.artGpu = function () { return window.tf && window.tf.getBackend && window.tf.getBackend() === 'webgl'; };
  function nets() {
    if (netP) return netP;
    netP = tfReady().then(function (tf) { return Promise.all([tf.loadGraphModel(BASE + 'predictor/model.json'), tf.loadGraphModel(BASE + 'transformer/model.json')]); })
      .then(function (m) { return { pred: m[0], trans: m[1] }; });
    netP.catch(function () { netP = null; });
    return netP;
  }
  function vectors() { if (!vecP) { vecP = fetch('media/styles/vectors.json').then(function (r) { return r.json(); }); vecP.catch(function () { vecP = null; }); } return vecP; }
  FS.artReady = function () { return Promise.all([nets(), vectors()]); };
  function fit8(v) { return Math.max(64, Math.round(v / 8) * 8); }
  function pixels(tf, img, max) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(W, H));
    var c = FS.canvas(fit8(W * k), fit8(H * k)), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return tf.tidy(function () { return tf.browser.fromPixels(c).toFloat().div(255).expandDims(); });
  }
  /* the photo's own style, so "strength" can mix it in (kept per photo) */
  function ownStyle(tf, n, img) {
    var key = img.src || ''; if (contentB[key]) return contentB[key];
    var t = pixels(tf, img, 256), v = n.pred.predict(t); t.dispose();
    var keys = Object.keys(contentB); if (keys.length > 12) { contentB[keys[0]].dispose(); delete contentB[keys[0]]; }
    return (contentB[key] = v);
  }
  /* an image -> the painting's style, `size` px on the long side, strength 0..1 */
  FS.artCanvas = function (img, id, size, strength) {
    return Promise.all([tfReady(), nets(), vectors()]).then(function (r) {
      var tf = r[0], n = r[1], vec = r[2][id]; if (!vec) throw new Error('style');
      var s = strength == null ? 0.8 : strength, own = s < 1 ? ownStyle(tf, n, img) : null;
      var out = tf.tidy(function () {
        var b = tf.tensor(vec, [1, 1, 1, 100]); if (own) b = b.mul(s).add(own.mul(1 - s));
        var c = pixels(tf, img, size);
        return n.trans.predict([c, b]).squeeze().clipByValue(0, 1);
      });
      var cv = FS.canvas(out.shape[1], out.shape[0]);
      return tf.browser.toPixels(out, cv).then(function () { out.dispose(); return cv; });
    });
  };

  /* on photos: the result at the photo's own size (so the crop and the layers stay), the photo before the last style is
     what the next style works from, "↩ ביטול AI" brings it back */
  var running = false;
  FS.applyArt = function (list, id, strength, done) {
    var a = find(id); if (!a || !list || !list.length || running) return Promise.resolve(0);
    running = true; var n = 0, stop = false, t0 = Date.now();
    function msg(k) { FS.busy && FS.busy('🎨 ' + a[1] + ' · ' + a[2] + (list.length > 1 ? ' · ' + (k + 1) + ' מתוך ' + list.length : '') + ' (על המחשב, בלי אינטרנט)', function () { stop = true; }); }
    msg(0);
    return list.reduce(function (ch, p, k) {
      return ch.then(function () {
        if (stop) return; msg(k);
        var baseSrc = p.artSrc && p.src === p.artSrc && p.artBase ? p.artBase : p.src;
        return FS.loadImg(baseSrc).then(function (im) {
          var size = FS.artGpu() ? 1024 : 640;
          return FS.artCanvas(im, id, size, strength).catch(function () { return FS.artCanvas(im, id, 640, strength); }).then(function (c) {
            var W = im.naturalWidth, H = im.naturalHeight, o = FS.canvas(W, H), x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H);
            return new Promise(function (ok, no) { o.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.94); });
          });
        }).then(function (b) { return FS.loadImg(URL.createObjectURL(b)); }).then(function (im2) {
          if (!p.origSrc) p.origSrc = p.src; else p.aiPrev = (p.aiPrev || []).concat(p.src).slice(-5);
          p.artBase = baseSrc; p.src = im2.src; p.artSrc = im2.src; p.art = id;
          p.cache = {}; p._gt = null; p._pt = null; p._mc = null; p.quality = null; if (FS.snap) FS.snap(p); n++;
        });
      });
    }, Promise.resolve()).catch(function (e) {
      FS.toast('עיצוב ה־AI לא הצליח: ' + ((e && e.message) || '') + '. "🔄 רענון מלא" ומנסים שוב.', 6000);
    }).then(function () {
      running = false; FS.busy && FS.busy(); FS.emit('doc'); if (FS.render) FS.render(); if (FS.refreshStrip) FS.refreshStrip();
      if (n) FS.toast('🎨 ' + a[1] + ' · ' + a[2] + ': ' + n + (n > 1 ? ' תמונות' : ' תמונה') + ' ב־' + Math.max(1, Math.round((Date.now() - t0) / 1000)) + ' שניות. "↩ ביטול AI" מחזיר.', 4500);
      if (done) done(list); return n;
    });
  };

  /* ---------- the panel: each painting, and the same network's result on the photo ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private */ } }
  FS.artPanel = function (box, opt) {
    if (!box) return;
    var strength = Number(lsGet('fs-art-strength')) || 80, pvKey = '', job = 0, loaded = false;
    box.innerHTML = '<h3 class="fx-h">🎨 ציורי AI מהירים <small>רשת נוירונים אמיתית על המחשב · שנייה־שתיים לתמונה · בלי אינטרנט ובלי מכסה</small></h3>' +
      '<div class="fx-bar"><p class="fx-note" id="' + box.id + '-st">התצוגה על התמונה שלכם נטענת…</p>' +
      '<label class="fx-str" title="פחות = הפנים והצבעים של הצילום נשמרים יותר">עוצמה <input type="range" min="30" max="100" step="5" value="' + strength + '"><b>' + strength + '%</b></label></div>' +
      '<div class="fx-grid">' + FS.AI_ART.map(function (a) { return '<button type="button" class="fx-t art-t" data-art="' + a[0] + '" title="' + a[1] + ' · ' + a[2] + '"><span class="fx-pv"><img class="art-src" src="media/styles/' + a[0] + '.jpg" alt="" loading="lazy"><canvas width="1" height="1"></canvas><img class="art-chip" src="media/styles/' + a[0] + '.jpg" alt=""></span><span class="fx-n"><b>' + a[1] + '</b><small>' + a[2] + '</small></span></button>'; }).join('') + '</div>';
    var st = box.querySelector('.fx-note'), rg = box.querySelector('.fx-str input');
    rg.addEventListener('input', function () { strength = Number(rg.value); box.querySelector('.fx-str b').textContent = strength + '%'; lsSet('fs-art-strength', strength); });
    rg.addEventListener('change', function () { pvKey = ''; soon(); });
    box.querySelector('.fx-grid').addEventListener('click', function (e) {
      var t = e.target.closest('[data-art]'); if (!t) return;
      var list = opt.list(); if (!list.length) return FS.toast('בוחרים תמונה קודם');
      t.classList.add('fx-go'); setTimeout(function () { t.classList.remove('fx-go'); }, 700);
      FS.applyArt(list, t.dataset.art, strength / 100, opt.done);
    });
    function previews() {
      var p = opt.preview && opt.preview(); if (!p || !box.isConnected || box.offsetParent === null || running) return;
      var src = p.artSrc && p.src === p.artSrc && p.artBase ? p.artBase : p.src, key = src + '|' + strength; if (key === pvKey) return; pvKey = key;
      var my = ++job, t0 = Date.now();
      if (!loaded) st.textContent = 'טוען את רשת ה־AI (פעם אחת, כ־17MB)…';
      Promise.all([FS.loadImg(src), FS.artReady()]).then(function (r) {
        loaded = true; st.textContent = FS.artGpu() ? '⚡ על כרטיס המסך · כל ציור מוצג על התמונה שלכם. לחיצה מעצבת.' : '🐢 בלי האצת כרטיס מסך: זה יעבוד, אבל לאט יותר.';
        var im = r[0], tiles = Array.prototype.slice.call(box.querySelectorAll('[data-art]'));
        (function next(i) {
          if (my !== job || i >= tiles.length) { if (my === job && i >= tiles.length && window.console) console.info('ai-art previews', Date.now() - t0, 'ms'); return; }
          var t = tiles[i];
          FS.artCanvas(im, t.dataset.art, FS.artGpu() ? 200 : 120, strength / 100).then(function (c) {
            if (my !== job) return; var cv = t.querySelector('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); t.classList.add('pv');
          }).catch(function () {}).then(function () { setTimeout(function () { next(i + 1); }, 0); });
        })(0);
      }).catch(function (e) { pvKey = ''; st.textContent = 'רשת ה־AI לא נטענה (' + ((e && e.message) || '') + ').'; });
    }
    var tmr = 0; function soon() { clearTimeout(tmr); tmr = setTimeout(previews, 400); }
    FS.on('doc', soon); FS.on('history', soon);
    document.addEventListener('click', function (e) { if (e.target.closest('.thumb, .strip-item, [data-id], .mt-tile, [data-pane], .mt-sub, .tab, nav button')) soon(); }, true);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) soon(); }).observe(box);
    soon();
  };
})();
