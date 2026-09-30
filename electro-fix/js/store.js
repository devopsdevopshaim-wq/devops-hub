/* שמירה ב-IndexedDB: תיקי תקלה (cases) ועיצובי כרטיסים (designs), כולל התמונות.
   אם אין IndexedDB — בזיכרון בלבד. */
(function () {
  'use strict';
  var memory = { cases: new Map(), designs: new Map() };
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open('electro-fix', 2); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        ['cases', 'designs'].forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' }); });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }

  function store(name) {
    function run(mode, fn) {
      return open().then(function (db) {
        if (!db) return fn(null);
        return new Promise(function (resolve, reject) {
          var t = db.transaction(name, mode);
          var r = fn(t.objectStore(name));
          t.oncomplete = function () { resolve(r && 'result' in r ? r.result : r); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }
    var mem = memory[name];
    return {
      save: function (c) {
        c.updated = Date.now();
        return run('readwrite', function (os) { if (!os) { mem.set(c.id, c); return c; } os.put(c); return c; });
      },
      get: function (id) { return run('readonly', function (os) { return os ? os.get(id) : mem.get(id); }); },
      remove: function (id) { return run('readwrite', function (os) { if (!os) mem.delete(id); else os.delete(id); }); },
      all: function () {
        return run('readonly', function (os) { return os ? os.getAll() : Array.from(mem.values()); })
          .then(function (list) { return (list || []).sort(function (a, b) { return b.updated - a.updated; }); });
      }
    };
  }

  window.CaseStore = store('cases');
  window.DesignStore = store('designs');
})();
