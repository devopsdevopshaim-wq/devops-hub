/* מכלול — שמירה מקומית ב-IndexedDB: פרויקטים, קבצים (מודלים, סרטונים, שרטוטים) ומשימות. */
(function () {
  'use strict';
  var DB_NAME = 'assembly-studio';
  var STORES = ['projects', 'files', 'tasks'];
  var dbPromise = null;
  var memory = { projects: new Map(), files: new Map(), tasks: new Map() };

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        STORES.forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
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
      os.put(value); return value;
    });
  }
  function get(store, id) {
    return tx(store, 'readonly', function (os) { return os ? os.get(id) : memory[store].get(id); });
  }
  function del(store, id) {
    return tx(store, 'readwrite', function (os) { if (!os) memory[store].delete(id); else os.delete(id); });
  }
  function all(store) {
    return tx(store, 'readonly', function (os) { return os ? os.getAll() : Array.from(memory[store].values()); });
  }
  function newest(list) { return (list || []).sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); }); }

  window.AsmStore = {
    uid: function (prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    saveProject: function (p) { p.updatedAt = Date.now(); return put('projects', JSON.parse(JSON.stringify(p))); },
    getProject: function (id) { return get('projects', id); },
    deleteProject: function (id) { return del('projects', id); },
    listProjects: function () { return all('projects').then(newest); },
    saveFile: function (f) { return put('files', f); },          // { id, projectId, kind, name, blob }
    getFile: function (id) { return get('files', id); },
    deleteFile: function (id) { return del('files', id); },
    projectFiles: function (projectId) {
      return all('files').then(function (list) { return (list || []).filter(function (f) { return f.projectId === projectId; }); });
    },
    saveTask: function (t) { t.updatedAt = Date.now(); return put('tasks', JSON.parse(JSON.stringify(t))); },
    deleteTask: function (id) { return del('tasks', id); },
    listTasks: function () { return all('tasks').then(newest); },
    persist: function () { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); }
  };
})();
