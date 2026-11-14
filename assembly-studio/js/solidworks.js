/* מכלול — קריאת קבצי SolidWorks מקוריים (SLDPRT, SLDASM, SLDDRW) בדפדפן, בלי SolidWorks.
 *
 * קבצים מ-SolidWorks 2015 ואילך הם רצף בלוקים דחוסים (raw DEFLATE). כל בלוק מתחיל
 * בחתימה 14 00 06 00 08 00, ושמות הבלוקים מוצפנים בהחלפת חצאי בתים (nibble swap).
 * מהבלוקים האלה קוראים:
 *   PreviewPNG                         — תמונת התצוגה של הקובץ
 *   Contents/DisplayLists              — רשת התצוגה של חלק (רצועות משולשים, במטרים)
 *   swXmlContents/COMPINSTANCETREE     — עץ המכלול: רכיבים, מיקום (מטריצה 4×4) והסתרה
 *   FaceTessellations/Directory + chunks — רשתות הרכיבים השמורות בתוך המכלול
 *
 * עובדות הפורמט: הפרויקט sldprt-export (רישיון MIT, https://github.com/XRTC5/sldprt-export)
 * ומפרט cadmpeg (CC BY 4.0). זהו מימוש עצמאי ב-JavaScript.
 * קבצים ישנים (לפני 2015, מבנה OLE) — נקראים רק תמונת התצוגה ושמות הרכיבים.
 */

const SIG = [0x14, 0x00, 0x06, 0x00, 0x08, 0x00];
const HEADER = 26;
const TABLE_SIG = [4, 0, 0, 0, 8, 0, 0, 0, 2, 0, 0, 0];
const DESCRIPTORS = [[4, 8], [12, 100], [12, 100], [4, 8], [4, 8], [1, 8]];
const STRING_MARKER = [0xff, 0xfe, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function find(data, pat, from = 0, to = data.length) {
  const first = pat[0], n = pat.length, end = Math.min(to, data.length) - n;
  for (let i = from; i <= end; i++) {
    if (data[i] !== first) continue;
    let k = 1;
    while (k < n && data[i + k] === pat[k]) k++;
    if (k === n) return i;
  }
  return -1;
}
const startsWith = (data, pat, at = 0) => pat.every((b, i) => data[at + i] === b);

/* ---------- בלוקים ---------- */
export function readBlocks(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = [];
  let pos = 8;
  for (;;) {
    const at = find(data, SIG, pos);
    if (at < 0 || at + HEADER > data.length) break;
    pos = at + 1;
    const crc = dv.getUint32(at + 10, true), comp = dv.getUint32(at + 14, true);
    const exp = dv.getUint32(at + 18, true), nameLen = dv.getUint32(at + 22, true);
    if (crc === exp * 2 && comp === Math.floor(exp / 2)) continue; // רשת אינדקס, לא בלוק נתונים
    if (!comp || nameLen < 1 || nameLen > 1024 || at + HEADER + nameLen + comp > data.length) continue;
    let name = '';
    let ok = true;
    for (let i = 0; i < nameLen; i++) {
      const b = data[at + HEADER + i], c = ((b << 4) | (b >> 4)) & 0xff;
      if (c < 0x20 || c > 0x7e) { ok = false; break; }
      name += String.fromCharCode(c);
    }
    if (!ok) continue;
    out.push({ name, start: at + HEADER + nameLen, comp, exp, data });
  }
  return out;
}

async function inflateWith(bytes, format) {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const chunks = [];
  let total = 0;
  const reader = ds.readable.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value); total += value.length;
    }
  } catch (e) {
    if (!total) throw e; // זרם שמסתיים בזבל אחרי הנתונים — שומרים מה שנפרס
  }
  const out = new Uint8Array(total);
  let o = 0;
  chunks.forEach((c) => { out.set(c, o); o += c.length; });
  return out;
}

export async function inflate(block) {
  const raw = block.data.subarray(block.start, block.start + block.comp);
  for (const f of ['deflate-raw', 'deflate']) {
    try { const out = await inflateWith(raw, f); if (out.length) return out; } catch { /* הפורמט הבא */ }
  }
  return raw;
}

const findBlock = (blocks, name) => blocks.find((b) => b.name === name);

/* ---------- רשת שמורה (רצועות משולשים) ---------- */
function readTable(data, dv, at) {
  let pos = at;
  const desc = [];
  for (const [size, kind] of DESCRIPTORS) {
    if (pos + 16 > data.length) return null;
    const dSize = dv.getUint32(pos, true), dKind = dv.getUint32(pos + 4, true), two = dv.getUint32(pos + 8, true), count = dv.getUint32(pos + 12, true);
    if (dSize !== size || dKind !== kind || two !== 2) return null;
    if (count > 2e6 || pos + 16 + count * size > data.length) return null;
    desc.push([pos + 16, count]);
    pos += 16 + size * count;
  }
  const strips = desc[0][1];
  if (!strips || strips > 250000) return null;
  const lengths = [];
  let total = 0;
  for (let j = 0; j < strips; j++) {
    const n = dv.getUint32(desc[0][0] + 4 * j, true);
    if (n < 3 || n > 1e6) return null;
    lengths.push(n); total += n;
  }
  if (desc[1][1] !== total || (desc[2][1] !== 0 && desc[2][1] !== total) || desc[4][1] !== strips) return null;
  for (let j = 0; j < strips; j++) if (dv.getUint32(desc[4][0] + 4 * j, true) !== 2 * lengths[j] - 2) return null;
  return { start: at, end: pos, desc, lengths };
}

function nextTable(data, dv, from, to = data.length) {
  let pos = from;
  for (;;) {
    const at = find(data, TABLE_SIG, pos, to);
    if (at < 0) return null;
    const t = readTable(data, dv, at);
    if (t && t.end <= to) return t;
    pos = at + 1;
  }
}

/* משולשים במ״מ: Float32Array של x,y,z לכל קודקוד */
function trianglesFromTables(data, dv, tables) {
  let tris = 0;
  tables.forEach((t) => t.lengths.forEach((n) => { tris += n - 2; }));
  const out = new Float32Array(tris * 9);
  let o = 0;
  for (const t of tables) {
    const base = t.desc[1][0];
    const v = (i, k) => dv.getFloat32(base + (i * 3 + k) * 4, true) * 1000;
    let at = 0;
    for (const n of t.lengths) {
      for (let k = 0; k < n - 2; k++) {
        const i = at + k;
        const order = k % 2 ? [i, i + 2, i + 1] : [i, i + 1, i + 2];
        for (const idx of order) { out[o++] = v(idx, 0); out[o++] = v(idx, 1); out[o++] = v(idx, 2); }
      }
      at += n;
    }
  }
  return out;
}

async function savedMesh(blocks) {
  for (const name of ['Contents/DisplayLists', 'FaceTessellations']) {
    const b = findBlock(blocks, name);
    if (!b) continue;
    const data = await inflate(b);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tables = [];
    let pos = 0, t;
    while ((t = nextTable(data, dv, pos))) { tables.push(t); pos = t.end; }
    if (tables.length) return trianglesFromTables(data, dv, tables);
  }
  return null;
}

/* ---------- מכלול ---------- */
function readDirectory(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let at = 0;
  const take = (n) => { if (at + n > data.length) throw new Error('ספריית הרשתות קטועה'); const s = at; at += n; return s; };
  const u32 = () => dv.getUint32(take(4), true);
  const hex = () => { const s = take(8); return Array.from(data.subarray(s, s + 8), (b) => b.toString(16).padStart(2, '0')).join(''); };
  const atString = () => startsWith(data, STRING_MARKER, at);
  const str = () => {
    const q = take(3);
    if (!startsWith(data, STRING_MARKER, q)) throw new Error('מבנה מחרוזת לא נתמך');
    let n = data[take(1)];
    if (n === 0xff) { n = dv.getUint16(take(2), true); if (n === 0xffff) n = u32(); }
    if (n > 4096) throw new Error('שם ארוך מדי');
    const s = take(2 * n);
    return new TextDecoder('utf-16le').decode(data.subarray(s, s + 2 * n));
  };
  if (u32() !== 2) throw new Error('גרסת ספרייה לא נתמכת');
  const capacity = u32(), count = u32();
  if (!capacity || capacity > 100000 || !count || count > 2000) throw new Error('המכלול חורג מהמגבלות');
  const first = find(data, STRING_MARKER, 12);
  if (first < 4) return [];
  const base = dv.getUint32(first - 4, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const sig = [...new Uint8Array(new Uint32Array([base + i]).buffer), ...STRING_MARKER];
    const start = find(data, sig, i ? at - 4 : first - 4);
    if (start < 0) break;
    at = start + 4;
    const name = str();
    u32(); u32(); u32();
    const alias = hex(), id = hex();
    for (let k = 0; k < 4 && !atString() && at + 8 <= data.length; k++) at += 8;
    const chunk = str();
    const index = u32();
    entries.push({ name, alias, id, chunk, index });
  }
  return entries;
}

async function componentMeshes(blocks, entries) {
  const byChunk = new Map();
  entries.forEach((e) => { if (e.chunk) { if (!byChunk.has(e.chunk)) byChunk.set(e.chunk, []); byChunk.get(e.chunk).push(e); } });
  const meshes = new Map();
  for (const [chunk, group] of byChunk) {
    const b = findBlock(blocks, 'FaceTessellations/' + chunk);
    if (!b) continue;
    const data = await inflate(b);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const recs = [];
    for (const e of group) {
      const marker = [...new Uint8Array(new Uint32Array([e.index]).buffer), ...e.id.match(/../g).map((h) => parseInt(h, 16))];
      const start = find(data, marker);
      if (start < 0 || start + 16 > data.length || find(data, marker, start + 1) >= 0) continue;
      const count = dv.getUint32(start + 12, true);
      if (!count || count > 250000) continue;
      recs.push({ start, count, e });
    }
    recs.sort((a, b) => a.start - b.start);
    recs.forEach((r, i) => {
      const end = i + 1 < recs.length ? recs[i + 1].start : data.length;
      const tables = [];
      let pos = r.start + 16, t;
      while (tables.length < r.count && (t = nextTable(data, dv, pos, end))) { tables.push(t); pos = t.end; }
      if (tables.length === r.count) meshes.set(r.e.id, trianglesFromTables(data, dv, tables));
    });
  }
  return meshes;
}

function rigid(text) {
  const v = String(text || '').trim().split(/\s+/).map(Number);
  if (v.length !== 16 || v.some((x) => !Number.isFinite(x))) return null;
  return v;
}
function compose(c, p) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[i * 4 + j] += c[i * 4 + k] * p[k * 4 + j];
  return o;
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/* וקטור שורה: v × M, הזזה במטרים → מ״מ */
function applyMatrix(src, m) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    for (let k = 0; k < 3; k++) out[i + k] = x * m[k] + y * m[4 + k] + z * m[8 + k] + 1000 * m[12 + k];
  }
  return out;
}

const fileName = (p) => String(p || '').replace(/\\/g, '/').split('/').pop();

async function readAssembly(blocks, resolve, notes) {
  const treeB = findBlock(blocks, 'swXmlContents/COMPINSTANCETREE');
  if (!treeB) { notes.push('לא נמצא עץ רכיבים במכלול.'); return []; }
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(await inflate(treeB)), 'application/xml');
  const kids = (el, tag) => (el ? Array.from(el.children).filter((c) => c.localName === tag) : []);
  const root = xml.documentElement;
  const header = kids(root, 'swHeader')[0], list = kids(root, 'swModelList')[0], confs = kids(kids(root, 'swConfigurationList')[0], 'swConfiguration');
  const files = new Map(kids(header, 'swFile').map((f) => [f.getAttribute('id'), f]));
  const models = new Map(kids(list, 'swModel').map((m) => [m.getAttribute('id'), m]));
  const conf = confs.find((c) => c.getAttribute('swMostRecentConfiguration') === 'YES') || confs[0];
  const top = conf && models.get(conf.getAttribute('swModelRef'));
  if (!top) { notes.push('תצורת המכלול לא זוהתה.'); return []; }

  let entries = [], stored = new Map();
  const dirB = findBlock(blocks, 'FaceTessellations/Directory');
  if (dirB) {
    try { entries = readDirectory(await inflate(dirB)); stored = await componentMeshes(blocks, entries); } catch (e) { notes.push('רשתות הרכיבים השמורות לא נקראו: ' + e.message); }
  }
  const byName = new Map(entries.map((e) => [e.name, e]));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const partCache = new Map();
  const fromPartFile = async (model) => {
    const rec = files.get(model.getAttribute('swFileRef'));
    const name = rec && fileName(rec.getAttribute('swPath'));
    if (!name || !resolve) return null;
    if (!partCache.has(name)) {
      const bytes = await resolve(name);
      let mesh = null;
      if (bytes) { try { mesh = await savedMesh(readBlocks(bytes)); } catch { mesh = null; } }
      partCache.set(name, mesh);
    }
    return partCache.get(name);
  };

  const out = [];
  const walk = async (model, path, matrix, depth) => {
    if (depth > 8) return;
    const modelName = model.getAttribute('swName');
    for (const ref of kids(model, 'swReference')) {
      if (ref.getAttribute('swSuppressed') === 'YES') continue;
      const child = models.get(ref.getAttribute('swModelRef'));
      const compName = ref.getAttribute('swName') || 'רכיב';
      const step = compName + '-' + ref.getAttribute('swReferenceNumber') + '@' + modelName;
      const full = path ? path + '/' + step : step;
      const place = rigid(ref.getAttribute('swTransform'));
      const world = place ? compose(place, matrix) : matrix;
      const childFile = child && files.get(child.getAttribute('swFileRef'));
      if (childFile && childFile.getAttribute('swDocType') === 'ASSEMBLY') { await walk(child, full, world, depth + 1); continue; }
      let mesh = null;
      let target = byName.get(full);
      const seen = new Set();
      while (target && !target.chunk && !seen.has(target.id)) { seen.add(target.id); target = byId.get(target.alias); }
      if (target) mesh = stored.get(target.id) || null;
      if (!mesh && child) mesh = await fromPartFile(child);
      out.push({
        name: compName, instance: compName + '-' + ref.getAttribute('swReferenceNumber'),
        file: childFile ? fileName(childFile.getAttribute('swPath')) : '',
        hidden: ref.getAttribute('swHidden') === 'YES',
        positions: mesh && place ? applyMatrix(mesh, world) : null
      });
    }
  };
  await walk(top, '', IDENTITY, 0);
  const missing = out.filter((c) => !c.positions).length;
  if (missing) notes.push(missing + ' רכיבים בלי רשת שמורה. העלו גם את קבצי ה-SLDPRT שלהם כדי לראות אותם בתלת-ממד.');
  return out;
}

/* ---------- קבצים ישנים (OLE, לפני 2015) ---------- */
function legacy(data, notes) {
  notes.push('קובץ SolidWorks בפורמט ישן (לפני 2015): נקראו רק תמונת התצוגה ושמות הרכיבים. לתלת-ממד מלא שמרו אותו מחדש בגרסה חדשה או כ-STEP.');
  let preview = null;
  const p = find(data, PNG);
  if (p >= 0) {
    const iend = find(data, [0x49, 0x45, 0x4e, 0x44], p);
    if (iend > p) preview = new Blob([data.slice(p, iend + 8)], { type: 'image/png' });
  }
  const text = new TextDecoder('utf-16le').decode(data.subarray(0, data.length - (data.length % 2)));
  const names = new Map();
  for (const m of text.matchAll(/([^\\/:*?"<>|\u0000-\u001f]{1,80})\.sldprt/gi)) {
    const n = m[1].trim();
    if (n) names.set(n, (names.get(n) || 0) + 1);
  }
  return { preview, components: [...names.keys()].map((n) => ({ name: n, instance: n, file: n + '.SLDPRT', hidden: false, positions: null })) };
}

/* ---------- נקודת הכניסה ---------- */
/* resolve(fileName) → Uint8Array|null : לקבצי SLDPRT שהועלו יחד עם המכלול */
export async function readSolidWorks(name, bytes, resolve) {
  const ext = name.split('.').pop().toLowerCase();
  const notes = [];
  if (startsWith(bytes, OLE)) {
    const r = legacy(bytes, notes);
    return { kind: ext === 'sldasm' ? 'assembly' : ext === 'slddrw' ? 'drawing' : 'part', ...r, notes };
  }
  const blocks = readBlocks(bytes);
  if (!blocks.length) throw new Error('הקובץ ' + name + ' לא נראה כמו קובץ SolidWorks תקין.');
  let preview = null;
  const pb = findBlock(blocks, 'PreviewPNG');
  if (pb) {
    const png = await inflate(pb);
    if (startsWith(png, PNG)) preview = new Blob([png], { type: 'image/png' });
  }
  const base = name.replace(/\.[^.]+$/, '');
  if (ext === 'slddrw') return { kind: 'drawing', preview, components: [], notes };
  if (ext === 'sldasm' || findBlock(blocks, 'swXmlContents/COMPINSTANCETREE')) {
    return { kind: 'assembly', preview, components: await readAssembly(blocks, resolve, notes), notes };
  }
  const positions = await savedMesh(blocks);
  if (!positions) notes.push('בחלק ' + base + ' אין רשת תצוגה שמורה.');
  return { kind: 'part', preview, components: [{ name: base, instance: base, file: name, hidden: false, positions }], notes };
}
