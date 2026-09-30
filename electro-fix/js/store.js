/* שמירת תיקי תקלה ב-IndexedDB (כולל התמונות). אם אין IndexedDB — בזיכרון בלבד. */
(function () {
  'use strict';
  var memory = new Map();
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open('electro-fix', 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains('cases')) req.result.createObjectStore('cases', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t = db.transaction('cases', mode);
        var r = fn(t.objectStore('cases'));
        t.oncomplete = function () { resolve(r && 'result' in r ? r.result : r); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  window.CaseStore = {
    save: function (c) {
      c.updated = Date.now();
      return run('readwrite', function (os) { if (!os) { memory.set(c.id, c); return c; } os.put(c); return c; });
    },
    get: function (id) { return run('readonly', function (os) { return os ? os.get(id) : memory.get(id); }); },
    remove: function (id) { return run('readwrite', function (os) { if (!os) memory.delete(id); else os.delete(id); }); },
    all: function () {
      return run('readonly', function (os) { return os ? os.getAll() : Array.from(memory.values()); })
        .then(function (list) { return (list || []).sort(function (a, b) { return b.updated - a.updated; }); });
    }
  };
})();
