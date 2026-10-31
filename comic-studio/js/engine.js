/* מנוע העיבוד בצד הדף: שולח עבודות לשני עובדי רקע (פילטרים ו-AI), כדי שהמסך לא ייתקע
   וכדי שעבודת AI ארוכה לא תעכב תצוגות מקדימות. אם עובד קורס (למשל מחוסר זיכרון), הוא נוצר מחדש
   והדף ממשיך לעבוד. בדפדפנים ישנים בלי OffscreenCanvas הכול רץ בדף כמו קודם. */
(function () {
  'use strict';

  var FX = window.ComicFX, NN = window.ComicNeural;

  var SUPPORTED = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' && (function () {
      try { return Boolean(new OffscreenCanvas(1, 1).getContext('2d')); } catch (e) { return false; }
    })();

  /* מכשיר חלש: טלפון או מעט זיכרון. מקטינים רזולוציות ותקציב זיכרון */
  var LOW = Boolean((navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

  var SIZES = LOW
    ? { thumb: 220, stage: 900, panel: 900, export: 1600, motion: 480, budget: 14e6, pageScale: 1.5 }
    : { thumb: 260, stage: 1100, panel: 1200, export: 2000, motion: 900, budget: 36e6, pageScale: 2 };

  var lanes = {}, seq = 0, pending = {}, active = 0, listeners = [];
  /* שומר זמן: עבודה שלא חזרה בזמן לא נשארת "מצייר…" לנצח. אם עובד הרקע לא עונה במכשיר הזה,
     עוברים לעבוד בדף עצמו עד סוף הביקור */
  var LIMIT = { fx: LOW ? 45000 : 30000, ai: 240000 };
  var workerBroken = false;

  function notify() { listeners.forEach(function (fn) { try { fn(active); } catch (e) { /* מאזין שבור */ } }); }

  function lane(name) {
    if (lanes[name]) return lanes[name];
    /* אותה גרסה כמו הדף (?v=...), כדי שטלפון לא יריץ עובד ישן מהמטמון */
    var ver = ((document.querySelector('script[src*="engine.js"]') || {}).src || '').split('?')[1] || '';
    var w = new Worker('js/worker.js' + (ver ? '?' + ver : ''));
    var L = { name: name, w: w, jobs: {}, ok: 0, timeouts: 0 };
    w.onmessage = function (e) {
      var m = e.data, job = L.jobs[m.id];
      if (!job) { if (m.bmp) m.bmp.close(); return; }
      if (m.type === 'progress') { if (job.onProgress) job.onProgress(m.f); return; }
      delete L.jobs[m.id];
      delete pending[m.id];
      clearTimeout(job.timer);
      active = Math.max(0, active - 1);
      notify();
      if (m.type === 'done') { L.ok++; L.timeouts = 0; job.resolve(m.bmp); }
      else job.reject(new Error(m.message));
    };
    /* קריסה של העובד: דוחים את כל העבודות שלו בהודעה ברורה ופותחים עובד חדש בבקשה הבאה */
    w.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var ids = Object.keys(L.jobs);
      ids.forEach(function (id) {
        var job = L.jobs[id];
        clearTimeout(job.timer);
        delete pending[id];
        job.reject(new Error(name === 'ai'
          ? 'מודל ה-AI עצר באמצע, כנראה מחוסר זיכרון במכשיר. נסו שוב, או בחרו סגנון אחר.'
          : 'העיבוד נעצר באמצע. נסו שוב.'));
      });
      active = Math.max(0, active - ids.length);
      notify();
      try { w.terminate(); } catch (err) { /* כבר נסגר */ }
      delete lanes[name];
    };
    lanes[name] = L;
    return L;
  }

  /* src: { blob, w, h, id }. מחזיר { id, promise } כשהתוצאה היא ImageBitmap */
  function render(src, style, params, max, opts) {
    opts = opts || {};
    var id = 'j' + (++seq);
    var promise;
    if (opts.preview && (!SUPPORTED || workerBroken)) {
      return { id: id, promise: Promise.reject(Object.assign(new Error('skipped'), { canceled: true })) };
    }
    if (SUPPORTED && !workerBroken) {
      var name = NN.isNeural(style) ? 'ai' : 'fx';
      var L = lane(name);
      promise = new Promise(function (resolve, reject) {
        var job = { resolve: resolve, reject: reject, onProgress: opts.onProgress };
        job.timer = setTimeout(function () {
          if (!L.jobs[id]) return;
          delete L.jobs[id];
          delete pending[id];
          active = Math.max(0, active - 1);
          notify();
          L.timeouts++;
          if (name === 'ai') {
            reject(new Error('מודל ה-AI לא סיים בזמן. נסו שוב או בחרו סגנון אחר.'));
            return;
          }
          /* עובד הפילטרים לא עונה: אם הוא אף פעם לא החזיר תוצאה, או נתקע פעמיים, מוותרים עליו */
          if (!L.ok || L.timeouts >= 2) {
            workerBroken = true;
            try { L.w.terminate(); } catch (e) { /* כבר נסגר */ }
            delete lanes[name];
          }
          /* תצוגה מקדימה לא מגיעה לציור בדף: רק הציור שבחרו. כך עשרות תצוגות לא תוקעות את המסך יחד */
          if (opts.preview) { reject(Object.assign(new Error('skipped'), { canceled: true })); return; }
          mainThread(src, style, params, max, opts).then(resolve, reject);
        }, LIMIT[name]);
        L.jobs[id] = job;
        pending[id] = L;
        active++;
        notify();
        L.w.postMessage({ type: 'render', id: id, img: src.id, blob: src.blob, w: src.w, h: src.h, style: style, params: params || {}, max: max });
      });
    } else {
      promise = mainThread(src, style, params, max, opts);
    }
    if (NN.isNeural(style)) promise.then(function () { NN.markDownloaded(style); }, function () {});
    return { id: id, promise: promise };
  }

  /* מסלול גיבוי לדפדפנים ישנים */
  var mainQueue = Promise.resolve();
  function mainThread(src, style, params, max, opts) {
    active++; notify();
    var p = mainQueue.catch(function () {}).then(function () {
      return decode(src.blob, max, src.w, src.h);
    }).then(function (im) {
      if (NN.isNeural(style)) return NN.render(im, style, params, max, opts.onProgress);
      return FX.renderAsync(im, style, params, max);
    }).then(function (c) { return typeof createImageBitmap !== 'undefined' ? createImageBitmap(c).catch(function () { return c; }) : c; });
    mainQueue = p;
    p.then(done, done);
    function done() { active = Math.max(0, active - 1); notify(); }
    return p;
  }

  function cancel(ids) {
    var byLane = {};
    (ids || []).forEach(function (id) {
      var L = pending[id];
      if (!L) return;
      (byLane[L.name] = byLane[L.name] || []).push(id);
      var job = L.jobs[id];
      delete L.jobs[id];
      delete pending[id];
      active = Math.max(0, active - 1);
      if (job) clearTimeout(job.timer);
      if (job) job.reject(Object.assign(new Error('canceled'), { canceled: true }));
    });
    Object.keys(byLane).forEach(function (n) { if (lanes[n]) lanes[n].w.postMessage({ type: 'cancel', ids: byLane[n] }); });
    notify();
  }

  function forget(imgId) {
    Object.keys(lanes).forEach(function (n) { lanes[n].w.postMessage({ type: 'forget', img: imgId }); });
  }

  /* פענוח תמונה בגודל מוגבל, בלי להחזיק את המקור המלא בזיכרון */
  function decode(blob, max, w, h) {
    if (typeof createImageBitmap === 'undefined') return legacyDecode(blob, max);
    var opts = null;
    if (w && h) {
      var k = Math.min(1, max / Math.max(w, h));
      opts = { resizeWidth: Math.max(1, Math.round(w * k)), resizeHeight: Math.max(1, Math.round(h * k)), resizeQuality: 'high' };
    }
    return (opts ? createImageBitmap(blob, opts) : createImageBitmap(blob)).catch(function () { return legacyDecode(blob, max); });
  }

  function legacyDecode(blob, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('לא הצלחתי לפתוח את התמונה')); };
      im.src = url;
    });
  }

  /* בדיקת מערכת: עבודה קטנה דרך עובד הרקע, עם מגבלת זמן */
  function selfTest() {
    var info = { supported: SUPPORTED, broken: workerBroken, low: LOW };
    if (!SUPPORTED) return Promise.resolve(Object.assign(info, { ok: false, why: 'הדפדפן לא תומך בעבודה ברקע; הכול רץ בדף' }));
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    x.fillStyle = '#c33'; x.fillRect(0, 0, 64, 64);
    return new Promise(function (res) { c.toBlob(res, 'image/png'); }).then(function (blob) {
      var t0 = performance.now();
      var j = render({ id: 'selftest', blob: blob, w: 64, h: 64 }, 'classic', {}, 64);
      var timer;
      return Promise.race([j.promise, new Promise(function (r, rej) { timer = setTimeout(function () { rej(new Error('timeout')); }, 15000); })])
        .then(function (b) { clearTimeout(timer); if (b && b.close) b.close(); return Object.assign(info, { ok: true, ms: Math.round(performance.now() - t0), broken: workerBroken }); },
          function (e) { clearTimeout(timer); return Object.assign(info, { ok: false, why: e.message, broken: workerBroken }); });
    });
  }

  window.ComicEngine = {
    selfTest: selfTest,
    /* האם יש עיבוד ברקע (ואז אפשר להראות תצוגות מקדימות) */
    background: function () { return SUPPORTED && !workerBroken; },
    SUPPORTED: SUPPORTED, LOW: LOW, SIZES: SIZES,
    render: render, cancel: cancel, forget: forget, decode: decode,
    onActivity: function (fn) { listeners.push(fn); },
    releaseAI: function () { if (lanes.ai) lanes.ai.w.postMessage({ type: 'release' }); }
  };
})();
