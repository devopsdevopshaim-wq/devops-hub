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

function fromLocal() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return Array.isArray(j.projects) ? j : null; }
  catch { return null; }
}

export function loadAll() {
  const j = fromLocal() || { projects: [] };
  j.sites = j.sites || [];
  return j;
}

/* אתרים עם כמה ארונות גדולים מהמקום ב-localStorage, ולכן המקור הראשי הוא IndexedDB */
export async function loadAllAsync() {
  const local = fromLocal();
  const idb = await files.get('__state__');
  let j = local;
  if (idb && Array.isArray(idb.projects) && (!local || (idb.saved || 0) >= (local.saved || 0))) j = idb;
  j = j || { projects: [] };
  j.sites = j.sites || [];
  return j;
}

export function saveAll(state) {
  state.saved = Date.now();
  files.put('__state__', JSON.parse(JSON.stringify(state)));
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { try { localStorage.removeItem(KEY); } catch { /* אין גישה */ } }
  return true;
}
