// אחסון מקומי (פיתוח ובדיקות): קובץ JSON אחד לרשומות, ותיקייה לתמונות.
import fs from 'node:fs';
import path from 'node:path';

export function fileStore(dir) {
  const file = path.join(dir, 'db.json');
  const blobs = path.join(dir, 'uploads');
  fs.mkdirSync(blobs, { recursive: true });
  let data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  data.collections = data.collections || {};
  data.settings = data.settings || {};
  let timer = null;
  const flush = () => {
    clearTimeout(timer); timer = null;
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 1));
    fs.renameSync(file + '.tmp', file);
  };
  const later = () => { if (!timer) timer = setTimeout(flush, 50); };
  process.on('exit', () => { if (timer) flush(); });
  const safe = (key) => String(key).replace(/[^a-z0-9_.-]/gi, '');

  return {
    async loadAll() { return data; },
    put(col, rec) {
      const list = (data.collections[col] = data.collections[col] || []);
      const i = list.findIndex((x) => x.id === rec.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      later();
    },
    del(col, id) {
      data.collections[col] = (data.collections[col] || []).filter((x) => x.id !== id);
      later();
    },
    putSettings(s) { data.settings = s; later(); },
    async putBlob(key, bytes, type) {
      fs.writeFileSync(path.join(blobs, safe(key)), Buffer.from(bytes));
      fs.writeFileSync(path.join(blobs, safe(key) + '.type'), type);
    },
    async getBlob(key) {
      const p = path.join(blobs, safe(key));
      if (!fs.existsSync(p)) return null;
      return { bytes: fs.readFileSync(p), type: fs.readFileSync(p + '.type', 'utf8') };
    },
    flush,
  };
}
