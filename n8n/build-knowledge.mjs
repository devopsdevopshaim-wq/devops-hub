#!/usr/bin/env node
/*
 * Build api/knowledge.json from the site's data files.
 * The n8n agent (and any future integration) reads this JSON instead of
 * parsing the JS files. Runs in the Pages workflow on every publish.
 * Usage: node n8n/build-knowledge.mjs [site-dir]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = path.resolve(process.argv[2] || 'vacation-hub');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['data', 'media', 'money', 'sites', 'config']) {
  vm.runInContext(fs.readFileSync(path.join(dir, 'js', f + '.js'), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;
const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined && o[k] !== '').map(k => [k, o[k]]));

const destinations = W.APP_DATA.destinations.map(d => ({
  id: d.id, name: d.name, nameEn: d.nameEn, country: d.country, region: d.region,
  tagline: d.tagline, about: d.about,
  flight: { airport: d.airport.name, code: d.airport.code, hoursFromTLV: d.flightTime, tzDiffFromIsrael: d.tzDiff, transfers: d.airport.toCity, note: d.airport.note },
  practical: pick(d, ['language', 'visa', 'plug', 'emergency', 'drivingSide', 'tipping']),
  currency: { ...d.currency, ...(W.APP_MONEY.currencies[d.currency.code] || {}), ...(W.APP_MONEY.byDest[d.id] || {}) },
  climateMaxC: Object.fromEntries(d.climate.map((t, i) => [MONTHS[i], t])),
  bestMonths: d.bestMonths.map(m => MONTHS[m - 1]),
  estimatedCostsILS: d.costs,
  hotels: d.hotels.map(h => pick(h, ['name', 'tier', 'price', 'area', 'addr', 'phone', 'web', 'note'])),
  car: d.car,
  kosher: { note: d.kosherNote, places: d.kosher.map(k => pick(k, ['name', 'area', 'note', 'addr', 'phone', 'web'])) },
  michelin: { note: d.michelinNote, places: d.michelin.map(m => pick(m, ['name', 'stars', 'cuisine', 'area', 'addr', 'phone', 'web'])) },
  localFood: d.food,
  transit: d.transit,
  routes: d.routes,
  pointsOfInterest: d.pois.map(p => p.name),
  videos: ((W.APP_MEDIA[d.id] || {}).videos || []).map(v => ({ title: v[1], url: 'https://www.youtube.com/watch?v=' + v[0] })),
  pageAnchor: '#dest-' + d.id
}));

const out = {
  generatedAt: new Date().toISOString(),
  brand: (W.APP_CONFIG.brand || {}).name || '',
  agency: pick(W.APP_CONFIG.agency || {}, ['name', 'phone', 'email']),
  disclaimer: 'מחירים, זמנים ודירוגי מישלן הם הערכות. פרטי קשר נאספו ממקורות פומביים — מומלץ לאמת.',
  origin: W.APP_DATA.origin,
  holidays: W.APP_DATA.holidays,
  destinations,
  bookingSites: W.APP_SITES.map(g => ({ category: g.cat, sites: g.items.map(i => ({ name: i.n, url: i.u, about: i.d })) }))
};
fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
fs.writeFileSync(path.join(dir, 'api', 'knowledge.json'), JSON.stringify(out, null, 1));
console.log(`api/knowledge.json: ${destinations.length} destinations, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
