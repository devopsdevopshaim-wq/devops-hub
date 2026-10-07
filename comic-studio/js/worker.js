/* עובד רקע: כל הציור והרשתות הנוירוניות רצים כאן, כדי שהמסך לא ייתקע לעולם.
   מקבל קובץ תמונה (Blob), מפענח אותו בגודל הדרוש בלבד, ומחזיר ImageBitmap. */
'use strict';
self.window = self;
importScripts('fx.js', 'fx-art.js', 'neural.js');

var FX = self.ComicFX, NN = self.ComicNeural;
var queue = [], busy = false, canceled = {};

/* מקורות מפוענחים: מעט, וקטנים ככל האפשר. כל אחד נסגר כשהוא יוצא מהמטמון */
var sources = [], SRC_MAX = 4;

function bucket(max) { return max <= 420 ? 420 : max <= 1200 ? 1200 : 2000; }

function getSource(job) {
  var size = bucket(job.max), key = job.img + '@' + size;
  for (var i = 0; i < sources.length; i++) {
    if (sources[i].key === key) {
      var hit = sources.splice(i, 1)[0];
      sources.push(hit);
      return Promise.resolve(hit.bmp);
    }
  }
  var k = Math.min(1, size / Math.max(job.w || size, job.h || size));
  var opts = { resizeWidth: Math.max(1, Math.round((job.w || size) * k)), resizeHeight: Math.max(1, Math.round((job.h || size) * k)), resizeQuality: 'high' };
  return createImageBitmap(job.blob, opts).catch(function () { return createImageBitmap(job.blob); }).then(function (bmp) {
    sources.push({ key: key, bmp: bmp });
    while (sources.length > SRC_MAX) { var old = sources.shift(); try { old.bmp.close(); } catch (e) { /* כבר נסגר */ } }
    return bmp;
  });
}

function toBitmap(c) {
  if (c.transferToImageBitmap) return Promise.resolve(c.transferToImageBitmap());
  return createImageBitmap(c);
}

function pump() {
  if (busy) return;
  var job = queue.shift();
  if (!job) return;
  if (canceled[job.id]) { delete canceled[job.id]; pump(); return; }
  busy = true;
  getSource(job).then(function (src) {
    if (NN.isNeural(job.style)) {
      return NN.render(src, job.style, job.params, job.max, function (f) { self.postMessage({ id: job.id, type: 'progress', f: f }); });
    }
    return FX.render(src, job.style || 'original', job.params, job.max);
  }).then(toBitmap).then(function (bmp) {
    self.postMessage({ id: job.id, type: 'done', bmp: bmp }, [bmp]);
  }).catch(function (err) {
    self.postMessage({ id: job.id, type: 'error', message: String((err && err.message) || err) });
  }).then(function () {
    busy = false;
    pump();
  });
}

self.onmessage = function (e) {
  var m = e.data;
  if (m.type === 'render') { queue.push(m); pump(); }
  else if (m.type === 'cancel') {
    m.ids.forEach(function (id) { canceled[id] = true; });
    queue = queue.filter(function (j) { return !canceled[j.id]; });
  } else if (m.type === 'forget') {
    sources = sources.filter(function (s) {
      if (s.key.indexOf(m.img + '@') !== 0) return true;
      try { s.bmp.close(); } catch (err) { /* כבר נסגר */ }
      return false;
    });
  } else if (m.type === 'release') {
    NN.releaseAll();
  }
};
