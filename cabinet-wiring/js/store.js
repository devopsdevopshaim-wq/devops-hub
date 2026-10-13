/* ארון־פלאן — שמירה בדפדפן בלבד: הפרויקטים ב-localStorage, ה-PDF ותמונות העמודים ב-IndexedDB. */
const KEY = 'cabinet-wiring-v1';
const DB = 'cabinet-wiring';
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('files', mode);
    const st = t.objectStore('files');
    const req = fn(st);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const files = {
  put: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => null),
  get: (k) => tx('readonly', (s) => s.get(k)).catch(() => null),
  delPrefix: async (prefix) => {
    try {
      const d = await db();
      await new Promise((resolve) => {
        const t = d.transaction('files', 'readwrite');
        const st = t.objectStore('files');
        const range = IDBKeyRange.bound(prefix, prefix + '￿');
        st.delete(range);
        t.oncomplete = resolve; t.onerror = resolve;
      });
    } catch { /* אין IndexedDB */ }
  }
};

export function loadAll() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return Array.isArray(j.projects) ? j : { projects: [] }; }
  catch { return { projects: [] }; }
}

export function saveAll(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
