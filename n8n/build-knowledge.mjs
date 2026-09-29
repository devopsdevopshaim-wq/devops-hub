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
/* אופציונלי: קווי אוטובוס/רכבת ויישובים בישראל */
for (const f of ['safety']) if (fs.existsSync(path.join(dir, 'js', f + '.js'))) vm.runInContext(fs.readFileSync(path.join(dir, 'js', f + '.js'), 'utf8'), ctx, { filename: f });
if (fs.existsSync(path.join(dir, 'js', 'israel.js'))) vm.runInContext(fs.readFileSync(path.join(dir, 'js', 'israel.js'), 'utf8'), ctx, { filename: 'israel' });
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
  hotels: d.hotels.map(h => pick(h, ['name', 'kind', 'tags', 'tier', 'price', 'area', 'addr', 'phone', 'web', 'note', 'rec'])),
  attractions: (d.fun || []).map(f => pick(f, ['name', 'type', 'tags', 'addr', 'phone', 'web', 'note'])),
  suitability0to3: d.vibes || {},
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
  travelWarnings: W.APP_SAFETY ? {
    source: 'המטה לביטחון לאומי (המל״ל)', checked: W.APP_SAFETY.checked, basedOn: W.APP_SAFETY.basedOn, official: W.APP_SAFETY.official,
    note: 'אזהרות משתנות — תמיד להפנות לאתר המל״ל לאימות. עמוד באתר: #safety',
    levels: Object.fromEntries(Object.entries(W.APP_SAFETY.levels).map(([k, v]) => [k, { name: v.name, recommendation: v.rec }])),
    countries: W.APP_SAFETY.countries.map(c => ({ country: c.name, level: c.level, note: c.note, exceptions: c.areas, destinations: c.dest })),
    tips: W.APP_SAFETY.tips, contacts: W.APP_SAFETY.contacts
  } : undefined,
  israelTravel: W.APP_IL ? (() => {
    const nm = Object.fromEntries(W.APP_IL.places.map(p => [p.id, p.name]));
    return {
      note: 'רשימת כל הלינה בארץ נטענת חי מ-OpenStreetMap בעמוד #stays. ניווט: עמוד #go. קווים משתנים — לאמת ב-Moovit/אגד.',
      places: W.APP_IL.places.map(p => ({ name: p.name, coords: p.c, region: p.r, train: !!p.rail })),
      busLines: W.APP_IL.bus.map(l => ({ lines: l.lines, operator: l.op, between: [nm[l.a], ...l.b.map(b => nm[b])], departsFrom: l.from, time: l.time, note: l.note })),
      rail: W.APP_IL.rail.map(r => ({ between: [nm[r[0]], nm[r[1]]], time: r[2], note: r[3] })),
      pages: { allStays: '#stays', navigation: '#go' }
    };
  })() : undefined,
  bookingSites: W.APP_SITES.map(g => ({ category: g.cat, sites: g.items.map(i => ({ name: i.n, url: i.u, about: i.d })) }))
};
fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
fs.writeFileSync(path.join(dir, 'api', 'knowledge.json'), JSON.stringify(out, null, 1));
console.log(`api/knowledge.json: ${destinations.length} destinations, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
