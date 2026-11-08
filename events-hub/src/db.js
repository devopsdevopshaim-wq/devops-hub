// שכבת הנתונים: כל הרשומות בזיכרון, וכל שינוי נכתב מיד לאחסון.
// האחסון מתחלף: קובץ JSON בהרצה מקומית (store-file.js), או Durable Object של Cloudflare בענן (store-do.js).
// ממשק אחסון: loadAll() -> {collections, settings}, put(col, rec), del(col, id), putSettings(obj),
//             putBlob(key, bytes, type), getBlob(key) -> {bytes, type} | null
import crypto from 'node:crypto';

export const COLLECTIONS = ['events', 'guests', 'photos', 'products', 'collections', 'categories',
  'suppliers', 'couriers', 'cities', 'orders', 'payments', 'promotions', 'banners', 'loyalty', 'rewards'];

let state = null;
let store = null;

function id(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

const db = {
  async init(adapter) {
    store = adapter;
    const loaded = await store.loadAll();
    state = { settings: loaded.settings || {} };
    for (const c of COLLECTIONS) state[c] = (loaded.collections && loaded.collections[c]) || [];
    return db;
  },
  id,
  get state() { return state; },
  all(col) { return state[col]; },
  find(col, pred) { return state[col].filter(pred); },
  get(col, idv) { return state[col].find((x) => x.id === idv); },
  insert(col, obj) {
    const rec = { id: obj.id || id(), createdAt: new Date().toISOString(), ...obj };
    state[col].push(rec);
    store.put(col, rec);
    return rec;
  },
  update(col, idv, patch) {
    const rec = db.get(col, idv);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    store.put(col, rec);
    return rec;
  },
  // שמירת רשומה ששונתה במקום (למשל הוספת אירוע לציר הזמן של הזמנה)
  save(col, rec) { store.put(col, rec); return rec; },
  remove(col, idv) {
    const i = state[col].findIndex((x) => x.id === idv);
    if (i < 0) return false;
    state[col].splice(i, 1);
    store.del(col, idv);
    return true;
  },
  settings() { return state.settings; },
  setSettings(patch) { Object.assign(state.settings, patch); store.putSettings(state.settings); return state.settings; },
  // קבצים (תמונות וסרטונים)
  putBlob: (key, bytes, type) => store.putBlob(key, bytes, type),
  getBlob: (key) => store.getBlob(key),
};

export default db;
