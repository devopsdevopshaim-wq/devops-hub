#!/usr/bin/env node
/*
 * Validate a travel site's data files.
 * Usage: node validate.mjs <site-dir>
 * Checks JS syntax of every file, the destination schema, and that
 * media.js / money.js cover every destination. Exit code 1 on errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = path.resolve(process.argv[2] || '.');
const errors = [], warnings = [];
const ctx = { window: {}, console };
vm.createContext(ctx);

for (const f of ['data', 'media', 'money', 'sites', 'config', 'posters', 'app']) {
  const file = path.join(dir, 'js', f + '.js');
  if (!fs.existsSync(file)) { errors.push(`missing js/${f}.js`); continue; }
  const src = fs.readFileSync(file, 'utf8');
  try {
    if (f === 'app' || f === 'posters') new vm.Script(src, { filename: f });   // syntax only (needs a DOM)
    else vm.runInContext(src, ctx, { filename: f });
  } catch (e) { errors.push(`js/${f}.js: ${e.message}`); }
}

const W = ctx.window;
const D = (W.APP_DATA && W.APP_DATA.destinations) || [];
if (!D.length) errors.push('APP_DATA.destinations is empty');

const REQ = ['id', 'name', 'nameEn', 'country', 'region', 'iata', 'coords', 'zoom', 'tagline', 'about',
  'currency', 'language', 'tzDiff', 'flightTime', 'visa', 'plug', 'emergency', 'drivingSide', 'tipping',
  'climate', 'bestMonths', 'costs', 'airport', 'hotels', 'car', 'kosherNote', 'kosher', 'food',
  'michelinNote', 'michelin', 'transit', 'routes', 'pois', 'poster'];
const ICONS = ['mesa', 'eiffel', 'bigben', 'colosseum', 'sagrada', 'parthenon', 'castle', 'skyline', 'burj', 'temple', 'pagoda', 'palms', 'walls', 'city-sea', 'hills-lake'];
const ids = new Set();
const KINDS = ['hotel', 'boutique', 'resort', 'spa', 'zimmer', 'cabins', 'farm', 'kibbutz', 'lodge', 'hostel'];
const VIBE_KEYS = ['family', 'couple', 'nature', 'relax', 'culture', 'night', 'food', 'adventure', 'religious'];

for (const d of D) {
  const tag = d.id || d.name || '?';
  for (const k of REQ) if (d[k] === undefined) errors.push(`${tag}: missing field "${k}"`);
  if (ids.has(d.id)) errors.push(`${tag}: duplicate id`);
  ids.add(d.id);
  if (d.id && !/^[a-z0-9-]+$/.test(d.id)) errors.push(`${tag}: id must be lowercase latin letters, digits or "-"`);
  if (!['il', 'abroad'].includes(d.region)) errors.push(`${tag}: region must be "il" or "abroad"`);
  if (!Array.isArray(d.climate) || d.climate.length !== 12) errors.push(`${tag}: climate needs 12 monthly values`);
  if (d.costs && !(d.costs.hotel && d.costs.hotel.budget && d.costs.hotel.mid && d.costs.hotel.lux)) errors.push(`${tag}: costs.hotel needs budget/mid/lux`);
  if (d.poster && !ICONS.includes(d.poster.icon)) warnings.push(`${tag}: poster.icon "${d.poster.icon}" unknown — falls back to skyline. Known: ${ICONS.join(', ')}`);
  (d.hotels || []).forEach(h => {
    if (!h.phone) warnings.push(`${tag}: hotel "${h.name}" has no phone`);
    if (h.phone && !/^\+\d[\d ]{6,}$/.test(h.phone)) warnings.push(`${tag}: hotel "${h.name}" phone "${h.phone}" should be +<country> <number>`);
    if (!['lux', 'mid', 'budget'].includes(h.tier)) errors.push(`${tag}: hotel "${h.name}" tier must be lux/mid/budget`);
    if (h.kind && !KINDS.includes(h.kind)) errors.push(`${tag}: hotel "${h.name}" kind "${h.kind}" — use one of ${KINDS.join(', ')}`);
  });
  (d.fun || []).forEach(f => { if (!f.name) errors.push(`${tag}: fun entry without name`); });
  if (!d.vibes) warnings.push(`${tag}: no vibes — trip-type matching treats every type as 1/3`);
  else for (const k of VIBE_KEYS) if (typeof d.vibes[k] !== 'number' || d.vibes[k] < 0 || d.vibes[k] > 3) errors.push(`${tag}: vibes.${k} must be 0–3`);
  const m = W.APP_MEDIA && W.APP_MEDIA[d.id];
  if (!m) warnings.push(`${tag}: no entry in media.js (no photos/videos)`);
  else {
    if (!m.photos || !m.photos.length) warnings.push(`${tag}: media.js has no photos`);
    if (!m.videos || !m.videos.length) warnings.push(`${tag}: media.js has no videos`);
    (m.videos || []).forEach(v => { if (!/^[A-Za-z0-9_-]{11}$/.test(v[0])) errors.push(`${tag}: video id "${v[0]}" is not an 11-char YouTube id`); });
  }
  const money = W.APP_MONEY;
  if (!money || !money.byDest[d.id]) warnings.push(`${tag}: no entry in money.js byDest`);
  if (!money || !money.currencies[d.currency && d.currency.code]) warnings.push(`${tag}: currency ${d.currency && d.currency.code} missing in money.js currencies`);
}
for (const k of Object.keys(W.APP_MEDIA || {})) if (!ids.has(k)) warnings.push(`media.js: "${k}" has no destination`);
for (const k of Object.keys((W.APP_MONEY || {}).byDest || {})) if (!ids.has(k)) warnings.push(`money.js: "${k}" has no destination`);
const cfg = W.APP_CONFIG || {};
if (!cfg.agency || (!cfg.agency.whatsapp && !cfg.agency.email)) warnings.push('config.js: no agency whatsapp/email — "close deal via agent" button stays hidden');

console.log(`Destinations: ${D.length}`);
warnings.forEach(w => console.log('WARN  ' + w));
errors.forEach(e => console.log('ERROR ' + e));
console.log(errors.length ? `\n${errors.length} error(s)` : '\nOK — no errors');
process.exit(errors.length ? 1 : 0);
