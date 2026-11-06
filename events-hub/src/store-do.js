// אחסון בענן: Durable Object של Cloudflare עם SQLite (כמו שרת הכניסה הקיים).
// רשומה = שורה בטבלת recs. תמונה = שורה בטבלת blobs (עד 2MB לתמונה).
export function doStore(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS recs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (col, id))');
  sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL)');
  return {
    async loadAll() {
      const collections = {};
      for (const row of sql.exec('SELECT col, data FROM recs').toArray()) {
        (collections[row.col] = collections[row.col] || []).push(JSON.parse(row.data));
      }
      for (const list of Object.values(collections)) list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      const s = sql.exec("SELECT v FROM kv WHERE k = 'settings'").toArray()[0];
      return { collections, settings: s ? JSON.parse(s.v) : {} };
    },
    put(col, rec) { sql.exec('INSERT OR REPLACE INTO recs (col, id, data) VALUES (?, ?, ?)', col, rec.id, JSON.stringify(rec)); },
    del(col, id) { sql.exec('DELETE FROM recs WHERE col = ? AND id = ?', col, id); },
    putSettings(obj) { sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('settings', ?)", JSON.stringify(obj)); },
    async putBlob(key, bytes, type) { sql.exec('INSERT OR REPLACE INTO blobs (k, type, bytes) VALUES (?, ?, ?)', key, type, bytes); },
    async getBlob(key) {
      const row = sql.exec('SELECT type, bytes FROM blobs WHERE k = ?', key).toArray()[0];
      return row ? { type: row.type, bytes: new Uint8Array(row.bytes) } : null;
    },
  };
}
