// מאגר נתונים מבוסס קובץ JSON. ממשק פשוט שאפשר להחליף בעתיד ב-PostgreSQL/MongoDB.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const DB_FILE = path.join(config.dataDir, 'db.json');
const COLLECTIONS = ['events', 'guests', 'photos', 'products', 'collections', 'categories',
  'suppliers', 'couriers', 'cities', 'orders', 'payments'];

let state = null;
let saveTimer = null;

function load() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    state = {};
  }
  for (const c of COLLECTIONS) state[c] = state[c] || [];
  state.settings = state.settings || {};
  return state;
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function save() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 100);
}

function id(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

const db = {
  load,
  saveNow,
  id,
  get state() { return state; },
  all(col) { return state[col]; },
  find(col, pred) { return state[col].filter(pred); },
  get(col, idv) { return state[col].find((x) => x.id === idv); },
  insert(col, obj) {
    const rec = { id: obj.id || id(), createdAt: new Date().toISOString(), ...obj };
    state[col].push(rec);
    save();
    return rec;
  },
  update(col, idv, patch) {
    const rec = db.get(col, idv);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    save();
    return rec;
  },
  remove(col, idv) {
    const i = state[col].findIndex((x) => x.id === idv);
    if (i >= 0) { state[col].splice(i, 1); save(); return true; }
    return false;
  },
  settings() { return state.settings; },
  setSettings(patch) { Object.assign(state.settings, patch); save(); return state.settings; },
  touch: save,
};

process.on('exit', () => { if (saveTimer) saveNow(); });
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => { if (saveTimer) saveNow(); process.exit(0); }));

module.exports = db;
