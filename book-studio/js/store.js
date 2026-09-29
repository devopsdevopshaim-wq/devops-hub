/* שמירה מקומית ב-IndexedDB: ספרים ותמונות. בלי הגבלת אורך טקסט. */
(function () {
  'use strict';
  var DB_NAME = 'book-studio';
  var dbPromise = null;
  var memory = { projects: new Map(), images: new Map() };

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var os = t.objectStore(store);
        var result = fn(os);
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
    return tx(store, 'readonly', function (os) {
      if (!os) return memory[store].get(id);
      return os.get(id);
    });
  }
  function del(store, id) {
    return tx(store, 'readwrite', function (os) {
      if (!os) { memory[store].delete(id); return; }
      os.delete(id);
    });
  }
  function all(store) {
    return tx(store, 'readonly', function (os) {
      if (!os) return Array.from(memory[store].values());
      return os.getAll();
    });
  }

  window.BookStore = {
    saveProject: function (p) { p.updatedAt = Date.now(); return put('projects', JSON.parse(JSON.stringify(p))); },
    getProject: function (id) { return get('projects', id); },
    deleteProject: function (id) { return del('projects', id); },
    listProjects: function () {
      return all('projects').then(function (list) {
        return (list || []).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      });
    },
    saveImage: function (img) { return put('images', img); },
    getImage: function (id) { return get('images', id); },
    deleteImage: function (id) { return del('images', id); },
    persist: function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    }
  };
})();
