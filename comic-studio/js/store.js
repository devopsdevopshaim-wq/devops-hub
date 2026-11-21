/* שמירה מקומית ב-IndexedDB: תמונות (עד 300) ופרויקטים של עמודי קומיקס. */
(function () {
  'use strict';
  var DB_NAME = 'comic-studio';
  var dbPromise = null;
  var memory = { images: new Map(), projects: new Map(), meta: new Map() };

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        ['images', 'projects', 'meta'].forEach(function (n) {
          if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' });
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var result = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(result && 'result' in result ? result.result : result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  function put(store, value) {
    return tx(store, 'readwrite', function (os) {
      if (!os) { memory[store].set(value.id, value); return value; }
      os.put(value);
      return value;
    });
  }
  function get(store, id) {
    return tx(store, 'readonly', function (os) { return os ? os.get(id) : memory[store].get(id); });
  }
  function del(store, id) {
    return tx(store, 'readwrite', function (os) { if (!os) { memory[store].delete(id); return; } os.delete(id); });
  }
  function all(store) {
    return tx(store, 'readonly', function (os) { return os ? os.getAll() : Array.from(memory[store].values()); });
  }

  window.ComicStore = { put: put, get: get, del: del, all: all };
})();
