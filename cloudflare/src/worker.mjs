// SPIDER sign-in server on Cloudflare Workers. It runs the same code as the n8n workflow "SPIDER · כניסה והרשאות" (see build.mjs),
// with the state (clients, sessions, usage, plan, vault) in one Durable Object, so every request is handled one at a time, like n8n.
// There is no monthly execution cap on the free plan (100,000 requests a day). Emails go through Brevo or Resend (an HTTP API).
import { DurableObject } from 'cloudflare:workers';
import * as nodeCrypto from 'node:crypto';
import handle from './gen/handle.mjs';
import invoiceSave from './gen/invoice-save.mjs';
import afterMail from './gen/after-mail.mjs';
import leadSave from './gen/lead.mjs';
import pricesRead from './gen/prices.mjs';
import adminHandle from './gen/admin.mjs';
import hubsServe from './gen/hubs.mjs';
import comicDraw from './gen/comic.mjs';
import voiceSpeak from './gen/voice.mjs';
import guideNormalize from './gen/guide-normalize.mjs';
import guideBlocked from './gen/guide-blocked.mjs';
import guideContext from './gen/guide-context.mjs';
import guideShape from './gen/guide-shape.mjs';
import monitorTargets from './gen/monitor-targets.mjs';
import monitorSummarize from './gen/monitor-summarize.mjs';
import statusFresh from './gen/status-fresh.mjs';
import statusRender from './gen/status-render.mjs';
import { mailHandle, mailCallback, who as sessionOf } from './mail.mjs';
import { localGuide } from './guide-local.mjs';
import { frameSite, frameFile, frameBiz, frameBook, frameCal, FrameStore } from './frame.mjs';
import { frameLive, liveFile, liveCron } from './live.mjs';
import { jarvisAsk, askChain, jarvisInput, allowed as jarvisAllowed, NO_ANSWER } from './jarvis.mjs';

const SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const FROM_NAME = 'SPIDER · חיים קריספין';
const ADMIN_EMAIL = 'devopsdevopshaim@gmail.com';
// every endpoint the n8n flows had, served here: one durable state per service (the three business endpoints share one, like their n8n flow)
const ROUTES = {
  'hasadna-auth': { svc: 'main', max: 64000 },
  'hasadna-lead': { svc: 'business', fn: leadSave, max: 70000, lead: true },
  'hasadna-prices': { svc: 'business', fn: pricesRead, max: 70000 },
  'hasadna-admin': { svc: 'business', fn: adminHandle, max: 1600000 },
  'hasadna-hubs': { svc: 'hubs', fn: hubsServe, max: 6000000, free: true },
  'comic-draw': { svc: 'comic', fn: comicDraw, max: 12000000, free: true },
  'hasadna-voice': { svc: 'voice', fn: voiceSpeak, max: 200000, free: true },
  'hasadna-guide': { svc: 'agents', kind: 'guide', max: 20000, free: true },
  'hasadna-status': { svc: 'agents', kind: 'status', max: 1000, free: true, method: 'GET' },
  // JARVIS, the personal assistant with the talking face (jarvis-web): the first AI key that answers
  // live video avatar (LiveAvatar): the page asks here for a session and for Hebrew speech (the API key never leaves the server)
  'hasadna-heygen': { svc: 'main', kind: 'heygen', max: 2000, free: true },
  'hasadna-jarvis': { svc: 'agents', kind: 'jarvis', max: 12000, free: true },
  // the clients' own mailboxes (Gmail); the callback is where Google sends the person back after they agree
  'hasadna-mail': { svc: 'main', kind: 'mail', max: 20000, free: true },
  'hasadna-mail-callback': { svc: 'main', kind: 'mailcb', max: 1000, free: true, method: 'GET' },
  // פריים מגנטים: the site's content and frames (public), and the business's data (signed in; the session is checked here)
  'frame-site': { svc: 'frame', kind: 'frame-site', max: 1000, free: true, method: 'GET' },
  'frame-file': { svc: 'frame', kind: 'frame-file', max: 1000, free: true, method: 'GET' },
  'frame-biz': { svc: 'frame', kind: 'frame', max: 6000000 },
  // a booking request from the site (anyone; checked against the calendar, the owner approves), and the owner's calendar feed
  'frame-book': { svc: 'frame', kind: 'frame-book', max: 8000 },
  'frame-cal': { svc: 'frame', kind: 'frame-cal', max: 1000, free: true, method: 'GET' },
  // the live event: guests' photos from the QR code, the stations' shared print queue, the big screen and the couple's gallery
  'frame-live': { svc: 'frame', kind: 'frame-live', max: 2600000 },
  'frame-live-img': { svc: 'frame', kind: 'frame-live-img', max: 1000, free: true, method: 'GET' },
  // a photo handed to the free image service for one edit: lives three minutes in memory, under an unguessable id
  'hubs-tmp': { svc: 'hubs', kind: 'hubs-tmp', max: 1000, free: true, method: 'GET' }
};
const FRAME_NAME = 'פריים מגנטים';
const FRAME_ADMIN = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/admin.html';
const SERVICES = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/services.json';
const KNOWLEDGE = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/knowledge.json';
const routeOf = (pathname) => ROUTES[pathname.replace(/^\/(webhook\/)?/, '')];
const CORS = { 'Access-Control-Allow-Origin': SITE_ORIGIN, Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

// LiveAvatar public avatars are looked up by name once per Worker instance
const avatarIds = {};
async function findAvatar(key, name) {
  if (avatarIds[name]) return avatarIds[name];
  try {
    for (let page = 1; page <= 20; page++) {
      const r = await fetch('https://api.liveavatar.com/v1/avatars/public?page=' + page + '&page_size=20', { headers: { 'X-API-KEY': key }, signal: AbortSignal.timeout(8000) });
      const d = (await r.json().catch(() => ({}))).data || {};
      const hit = (d.results || []).find((a) => String(a.name).toLowerCase() === name.toLowerCase());
      if (hit) return (avatarIds[name] = hit.id);
      if (!d.next) break;
    }
  } catch (e) { /* the default avatar is used */ }
  return '';
}

const reply = (body, code = 200, extra = {}) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export default {
  // every 2 hours: check the sites (the n8n flow did this every 15 minutes, at a cost in executions)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.STATE.get(env.STATE.idFromName('agents')).runMonitor(true));
    ctx.waitUntil(env.STATE.get(env.STATE.idFromName('frame')).liveTick());
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (url.pathname === '/') return reply({ ok: true, service: 'spider', where: 'cloudflare', routes: Object.keys(ROUTES) });
    const rt = routeOf(url.pathname);
    if (!rt) return reply({ ok: false, error: 'not-found' }, 404);
    // the price list is read with GET; everything else is POST
    const want = rt.method || (rt.fn === pricesRead ? 'GET' : 'POST');
    if (request.method !== want) return request.method === 'GET' ? reply({ ok: true, service: 'spider', where: 'cloudflare' }) : reply({ ok: false, error: 'bad-method' }, 405);
    if (rt.kind === 'hubs-tmp') {
      const t = await env.STATE.get(env.STATE.idFromName('hubs')).tmpImage(url.searchParams.get('id') || '');
      return t ? new Response(t.u, { headers: { 'Content-Type': t.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } }) : reply({ ok: false, error: 'not-found' }, 404);
    }
    if (rt.kind === 'frame-site' || rt.kind === 'frame-file') {
      const fr = env.STATE.get(env.STATE.idFromName('frame'));
      if (rt.kind === 'frame-site') return reply(await fr.siteData(), 200, { 'Cache-Control': 'public, max-age=30' });
      const png = await fr.fileData(url.searchParams.get('id') || '');
      return png ? new Response(png, { headers: { ...CORS, 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' } }) : reply({ ok: false, error: 'not-found' }, 404);
    }
    if (rt.kind === 'frame-cal') {
      const ics = await env.STATE.get(env.STATE.idFromName('frame')).calData(url.searchParams.get('k') || '');
      return ics ? new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } }) : reply({ ok: false, error: 'not-found' }, 404);
    }
    if (rt.kind === 'frame-live-img') {
      const q = url.searchParams, f = await env.STATE.get(env.STATE.idFromName('frame')).liveFileData(q.get('e') || '', q.get('p') || '', q.get('v') || '', q.get('a') === '1');
      return f ? new Response(f.u, { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': SITE_ORIGIN, 'Cross-Origin-Resource-Policy': 'cross-origin' } }) : reply({ ok: false, error: 'not-found' }, 404);
    }
    if (rt.kind === 'frame-live') {
      const origin = request.headers.get('origin') || '';
      if (origin !== SITE_ORIGIN) return reply({ ok: false, error: 'forbidden' }, 403);
      const raw = await request.text();
      if (raw.length > rt.max) return reply({ ok: false, error: 'too-big' }, 413);
      let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { return reply({ ok: false, error: 'bad-json' }, 400); }
      if (!b || typeof b !== 'object') return reply({ ok: false, error: 'bad-json' }, 400);
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const who = b.token ? await env.STATE.get(env.STATE.idFromName('main')).whoIs(String(b.token)) : null;
      const r = await env.STATE.get(env.STATE.idFromName('frame')).liveCall(who, b, ip);
      return reply(r.body, r.code);
    }
    if (rt.kind === 'frame-book' || rt.kind === 'frame') {
      // only the site may call; who is asking comes from the sign-in session, never from the request itself
      const origin = request.headers.get('origin') || '';
      if (origin !== SITE_ORIGIN) return reply({ ok: false, error: 'forbidden' }, 403);
      const raw = await request.text();
      if (raw.length > rt.max) return reply({ ok: false, error: 'too-big' }, 413);
      let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { return reply({ ok: false, error: 'bad-json' }, 400); }
      if (!b || typeof b !== 'object') return reply({ ok: false, error: 'bad-json' }, 400);
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const main = env.STATE.get(env.STATE.idFromName('main')), fr = env.STATE.get(env.STATE.idFromName('frame'));
      const who = b.token ? await main.whoIs(String(b.token)) : null;
      if (rt.kind === 'frame-book') { const r = await fr.bookCall(who, b, ip); return reply(r.body, r.code); }
      // the customers' accounts live with the sign-in (main object): the owner sees them and may block or unblock one
      if (who && who.role === 'admin' && b.action === 'account-set') return reply(await main.frameAccountSet(String(b.email || ''), !!b.active));
      const r = await fr.bizCall(who, b, ip);
      if (who && who.role === 'admin' && b.action === 'all' && r.body && r.body.ok) { r.body.accounts = await main.frameAccounts(); r.body.visitors = await main.frameVisitors(); }
      return reply(r.body, r.code);
    }
    const id = env.STATE.idFromName(rt.svc);
    return env.STATE.get(id).fetch(request);
  }
};

// ---- mail: Brevo (a verified sender, e.g. the Gmail address) or Resend
async function sendMail(env, mail) {
  const from = env.MAIL_FROM || ADMIN_EMAIL;
  try {
    if (env.BREVO_API_KEY) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: mail.fromName || FROM_NAME, email: from }, replyTo: mail.replyTo ? { email: mail.replyTo } : undefined, to: [{ email: mail.to }], subject: mail.subject, textContent: mail.text }) });
      return r.ok ? {} : { error: 'brevo ' + r.status };
    }
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM_RESEND || `${mail.fromName || FROM_NAME} <onboarding@resend.dev>`, to: [mail.to], reply_to: mail.replyTo || undefined, subject: mail.subject, text: mail.text }) });
      return r.ok ? {} : { error: 'resend ' + r.status };
    }
  } catch (e) { return { error: String((e && e.message) || e).slice(0, 100) }; }
  return { error: 'no-mail-provider' };
}

// ---- פריים מגנטים: the owner hears about a booking request by email (and WhatsApp through CallMeBot when set); the customer
// gets an email that it arrived, and another when the owner approves or declines. Nothing here can approve anything.
const heDay = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const waOf = (phone) => 'https://wa.me/' + String(phone || '').replace(/\D/g, '').replace(/^0/, '972');
function bookLines(q) {
  return ['מספר בקשה: ' + q.ref, 'שם: ' + q.name, 'טלפון: ' + q.phone, q.email ? 'מייל: ' + q.email : '', 'אירוע: ' + (q.typeName || q.type || '—'), 'תאריך: ' + heDay(q.date) + (q.time ? ' · ' + q.time : ''),
    q.guests ? 'אורחים: ' + q.guests : '', q.venue ? 'מקום: ' + q.venue : '', q.pkg ? 'חבילה: ' + q.pkg : '', q.notes ? 'הערות: ' + q.notes : ''].filter(Boolean);
}
async function frameNotify(env, n) {
  const q = n.request, sent = {};
  if (!n.decision) {
    const s = n.state || {}, cal = s.free ? '✔ היומן פנוי בתאריך הזה' : '⚠️ התאריך תפוס' + (s.deals && s.deals.length ? ': ' + s.deals.map((d) => d.title).join(', ') : s.busy ? ' (סימנת אותו כתפוס)' : '');
    const more = s.pending && s.pending.length ? '\nיש עוד ' + s.pending.length + ' בקשות ממתינות לאותו תאריך.' : '';
    const text = 'בקשת הזמנה חדשה מהאתר 🧲\n\n' + bookLines(q).join('\n') + '\n\n' + cal + more + '\n\nאת ההזמנה סוגרים רק אחרי האישור שלך. לאישור או לדחייה:\n' + FRAME_ADMIN + '#requests' + '\n\nוואטסאפ ללקוח: ' + waOf(q.phone);
    sent.owner = await sendMail(env, { to: ADMIN_EMAIL, fromName: FRAME_NAME, replyTo: q.email || undefined, subject: '🧲 בקשת הזמנה ' + q.ref + ' · ' + (q.typeName || q.type || 'אירוע') + ' · ' + q.date + (s.free ? ' · פנוי' : ' · תפוס'), text });
    if (env.CALLMEBOT_APIKEY && env.CALLMEBOT_PHONE) {
      try {
        const msg = '🧲 בקשת הזמנה ' + q.ref + '\n' + q.name + ' · ' + q.phone + '\n' + (q.typeName || q.type || '') + ' · ' + q.date + '\n' + (s.free ? '✔ פנוי' : '⚠️ תפוס') + '\n' + FRAME_ADMIN + '#requests';
        const r = await fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(env.CALLMEBOT_PHONE) + '&text=' + encodeURIComponent(msg) + '&apikey=' + encodeURIComponent(env.CALLMEBOT_APIKEY), { signal: AbortSignal.timeout(10000) });
        sent.wa = r.ok ? {} : { error: 'callmebot ' + r.status };
      } catch (e) { sent.wa = { error: 'callmebot' }; }
    }
    if (q.email) sent.client = await sendMail(env, { to: q.email, fromName: FRAME_NAME, replyTo: ADMIN_EMAIL, subject: 'קיבלנו את בקשת ההזמנה שלך (' + q.ref + ')',
      text: 'שלום ' + q.name + ',\n\nתודה! קיבלנו את הבקשה שלך:\n' + bookLines(q).join('\n') + '\n\nהבקשה ממתינה לאישור. נבדוק את היומן ונחזור אליך בהקדם עם אישור סופי. התאריך נשמר רק אחרי האישור.\n\n' + FRAME_NAME });
    return sent;
  }
  if (!q.email) return sent;
  const ok = n.decision === 'approve';
  sent.client = await sendMail(env, { to: q.email, fromName: FRAME_NAME, replyTo: ADMIN_EMAIL,
    subject: ok ? '✔ ההזמנה שלך אושרה (' + q.ref + ')' : 'לגבי בקשת ההזמנה שלך (' + q.ref + ')',
    text: 'שלום ' + q.name + ',\n\n' + (ok ? 'שמחים לאשר: התאריך ' + heDay(q.date) + ' שמור לך! 🧲\nנחזור אליך עם פרטי העסקה והמקדמה.' : 'מצטערים, לא נוכל לקבל את האירוע בתאריך ' + heDay(q.date) + '.') +
      (q.answer ? '\n\n' + q.answer : '') + '\n\n' + bookLines(q).join('\n') + '\n\n' + FRAME_NAME });
  return sent;
}

// n8n's helpers.httpRequest, as the Code nodes use it (json, encoding, returnFullResponse, ignoreHttpStatusErrors, timeout)
async function n8nHttp(o) {
  const method = (o.method || 'GET').toUpperCase();
  const headers = new Headers(o.headers || {});
  let body = o.body;
  if (o.json === true && body !== undefined && typeof body !== 'string' && !(body instanceof Uint8Array)) { body = JSON.stringify(body); if (!headers.has('content-type')) headers.set('content-type', 'application/json'); }
  if (body && typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) body = new Uint8Array(body);
  const r = await fetch(o.url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : body, signal: o.timeout ? AbortSignal.timeout(o.timeout) : undefined });
  let data;
  if (o.encoding === 'arraybuffer') data = Buffer.from(await r.arrayBuffer());
  else { data = await r.text(); if (o.json !== false) { try { data = JSON.parse(data); } catch (e) { /* stays text */ } } }
  if (!r.ok && !o.ignoreHttpStatusErrors) {
    const e = new Error('Request failed with status code ' + r.status + ': ' + (typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 200));
    e.httpCode = String(r.status); e.statusCode = r.status;
    throw e;
  }
  return o.returnFullResponse ? { statusCode: r.status, body: data, headers: Object.fromEntries(r.headers) } : data;
}

const requireShim = (m) => { if (m === 'crypto') return nodeCrypto; throw new Error('module not allowed: ' + m); };
const first = (n, j) => { const v = j[n]; return Array.isArray(v) ? { first: () => v[0] || { json: {} }, all: () => v } : { first: () => ({ json: v || {} }), all: () => [{ json: v || {} }] }; };

export class State extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.q = Promise.resolve(); }

  fetch(request) {
    const rt = routeOf(new URL(request.url).pathname);
    // the sign-in and the leads: one request at a time (the code reads and changes the whole state). The AI, drawing and voice calls are
    // long and only keep counters, so they run side by side.
    if (rt && rt.free) return this.handle(request, rt);
    const run = this.q.then(() => this.handle(request, rt));
    this.q = run.catch(() => {});
    return run;
  }

  // ---- פריים מגנטים. whoIs runs in the main object (where the sessions are); the rest in the "frame" object, on its own storage.
  // the short-lived photos for the free image service (kept in this object's memory only, never stored)
  tmpImage(id) {
    const m = this.tmp && /^[a-f0-9]{40}$/.test(id) ? this.tmp.get(id) : null;
    return m && m.exp > Date.now() ? { u: m.u, mime: m.mime } : null;
  }
  tmpPut(origin, b64, mime) {
    this.tmp = this.tmp || new Map();
    const t = Date.now(); for (const [k, v] of this.tmp) if (v.exp < t) this.tmp.delete(k);
    if (this.tmp.size > 200) this.tmp.delete(this.tmp.keys().next().value);
    const id = nodeCrypto.randomBytes(20).toString('hex'), u = Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0));
    this.tmp.set(id, { u, mime: /^image\/(jpeg|png|webp)$/.test(mime) ? mime : 'image/jpeg', exp: t + 180000 });
    return origin + '/hubs-tmp?id=' + id;
  }
  async whoIs(token) { const st = await this.load(); return sessionOf(st.sd, token); }
  siteData() { return frameSite(this.ctx.storage); }
  fileData(id) { return frameFile(this.ctx.storage, id); }
  async bizCall(who, b, ip) {
    // a few hundred calls per 10 minutes per person or address; one at a time, so a save never overlaps another
    this.rl = this.rl || new Map();
    const k = (who && who.email) || ip, t = Date.now(), arr = (this.rl.get(k) || []).filter((x) => t - x < 600000);
    if (arr.length >= 400) return { code: 429, body: { ok: false, error: 'rate-limited' } };
    arr.push(t); this.rl.set(k, arr); if (this.rl.size > 2000) this.rl.delete(this.rl.keys().next().value);
    const run = this.q.then(() => frameBiz(this.ctx.storage, who, b));
    this.q = run.catch(() => {});
    let r; try { r = await run; } catch (e) { return { code: 500, body: { ok: false, error: 'server-error' } }; }
    if (r.notify) { const s = await frameNotify(this.env, r.notify); r.body.mailed = !!(s.client && !s.client.error); }
    return r;
  }

  // a booking request: a few per address, so the form cannot flood the owner
  async bookCall(who, b, ip) {
    this.bk = this.bk || new Map();
    const t = Date.now(), arr = (this.bk.get(ip) || []).filter((x) => t - x < 3600000), dn = Math.floor(t / 864e5), day = this.bkDay && this.bkDay.d === dn ? this.bkDay : (this.bkDay = { d: dn, n: 0 });
    if (arr.length >= 6 || day.n >= 300) return { code: 429, body: { ok: false, error: 'rate-limited' } };
    arr.push(t); this.bk.set(ip, arr); day.n++; if (this.bk.size > 5000) this.bk.delete(this.bk.keys().next().value);
    const run = this.q.then(() => frameBook(this.ctx.storage, who, b));
    this.q = run.catch(() => {});
    let r; try { r = await run; } catch (e) { return { code: 500, body: { ok: false, error: 'server-error' } }; }
    if (r.notify) { const s = await frameNotify(this.env, r.notify); r.body.mailed = !!(s.owner && !s.owner.error); }
    return r;
  }
  calData(k) { return frameCal(this.ctx.storage, k); }
  // the live event. Guests may send a photo every few seconds from one address (a table shares the venue's Wi-Fi, so not too few)
  async liveCall(who, b, ip) {
    const a = String(b.action || ''), t = Date.now();
    if (a === 'guest-up') {
      this.lg = this.lg || new Map();
      const arr = (this.lg.get(ip) || []).filter((x) => t - x < 3600000), dn = Math.floor(t / 864e5), day = this.lgDay && this.lgDay.d === dn ? this.lgDay : (this.lgDay = { d: dn, n: 0 });
      if (arr.length >= 120 || day.n >= 20000) return { code: 429, body: { ok: false, error: 'rate-limited' } };
      arr.push(t); this.lg.set(ip, arr); day.n++; if (this.lg.size > 5000) this.lg.delete(this.lg.keys().next().value);
    } else {
      this.rl = this.rl || new Map();
      const k = (who && who.email) || ip, arr = (this.rl.get(k) || []).filter((x) => t - x < 600000);
      if (arr.length >= 1500) return { code: 429, body: { ok: false, error: 'rate-limited' } };
      arr.push(t); this.rl.set(k, arr); if (this.rl.size > 2000) this.rl.delete(this.rl.keys().next().value);
    }
    const run = this.q.then(async () => {
      const site = JSON.parse((await new FrameStore(this.ctx.storage).getBig('site')) || 'null') || {};
      return frameLive(this.ctx.storage, who, b, site);
    });
    this.q = run.catch(() => {});
    try { return await run; } catch (e) { return { code: 500, body: { ok: false, error: 'server-error' } }; }
  }
  liveFileData(e, p, v, audio) { return liveFile(this.ctx.storage, e, p, v, audio); }
  // the cron: old photos go, and the couple gets their gallery and a review request the day after the event
  async liveTick() {
    const run = this.q.then(() => liveCron(this.ctx.storage));
    this.q = run.catch(() => {});
    let mails = []; try { mails = await run; } catch (e) { return; }
    for (const m of mails) {
      const album = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/album.html?e=' + m.e + '&v=' + m.v;
      await sendMail(this.env, { to: m.to, fromName: m.biz || FRAME_NAME, replyTo: m.owner || ADMIN_EMAIL, subject: '📸 התמונות והברכות מ' + m.title,
        text: 'שלום' + (m.name ? ' ' + m.name : '') + ',\n\nתודה שבחרתם בנו! כל המגנטים, התמונות שהאורחים צילמו והברכות שהשאירו מחכים לכם כאן:\n' + album +
          (m.google ? '\n\nנהניתם? נשמח מאוד להמלצה קצרה בגוגל, זה עוזר לנו המון:\n' + m.google : '') + '\n\nמזל טוב!\n' + (m.biz || FRAME_NAME) });
    }
  }
  // in the main object: the frame shop's customer accounts (no passwords, no sessions)
  async frameAccounts() {
    const st = await this.load(), sess = st.sd.sessions || {}, online = {};
    for (const s of Object.values(sess)) if (s && s.exp > Date.now()) online[s.email] = 1;
    return Object.values(st.sd.clients || {}).filter((c) => c && Array.isArray(c.sites) && c.sites.includes('frame')).map((c) => ({ email: c.email, name: c.name || '', phone: c.phone || '',
      createdAt: c.createdAt || null, lastLogin: c.lastLogin || null, lastSeen: c.lastSeen || null, active: c.active !== false, online: !!online[c.email], only: c.sites.length === 1 }));
  }
  // who came in to the customer screen (name, email or phone, first and last visit, how many, verified by a code or not)
  async frameVisitors() {
    const st = await this.load();
    return Object.values(st.sd.frameVisitors || {}).sort((a, z) => Date.parse(z.lastAt || 0) - Date.parse(a.lastAt || 0)).slice(0, 2000)
      .map((v) => ({ name: v.name || '', email: v.email || '', phone: v.phone || '', firstAt: v.firstAt || null, lastAt: v.lastAt || null, visits: v.visits || 0, verified: !!v.verified }));
  }
  // block or unblock a frame-only customer; blocking also ends their sessions
  frameAccountSet(email, active) {
    const run = this.q.then(async () => {
      const st = await this.load(), e = email.toLowerCase(), c = (st.sd.clients || {})[e];
      if (!c || !Array.isArray(c.sites) || !c.sites.includes('frame')) return { ok: false, error: 'not-found' };
      if (c.sites.length !== 1) return { ok: false, error: 'not-frame-only' };
      c.active = active;
      if (!active) for (const [h, s] of Object.entries(st.sd.sessions || {})) if (s && s.email === e) delete st.sd.sessions[h];
      await this.save(st);
      return { ok: true, email: e, active };
    });
    this.q = run.catch(() => {});
    return run.catch(() => ({ ok: false, error: 'server-error' }));
  }

  async load() {
    const m = await this.ctx.storage.list();
    const sd = {}, orig = {};
    for (const [k, v] of m) { sd[k] = v; orig[k] = JSON.stringify(v); }
    return { sd, orig };
  }
  async save({ sd, orig }) {
    for (const k of Object.keys(sd)) {
      if (sd[k] === undefined) { if (k in orig) await this.ctx.storage.delete(k); continue; }
      if (JSON.stringify(sd[k]) !== orig[k]) await this.ctx.storage.put(k, sd[k]);
    }
    for (const k of Object.keys(orig)) if (!(k in sd)) await this.ctx.storage.delete(k);
  }

  // ---- the availability monitor: every public address in knowledge.json is fetched; the result is kept for the status page and Maya
  async runMonitor(notify) {
    const env = this.env, st = await this.load();
    const mk = (json, nodes = {}, input) => ({ $json: json, $getWorkflowStaticData: () => st.sd, require: requireShim, $: (n) => first(n, nodes), ENV: env, helpers: { httpRequest: n8nHttp }, ...(input ? { $input: input } : {}) });
    const K = await n8nHttp({ method: 'GET', url: KNOWLEDGE, json: true, timeout: 15000 });
    const targets = await monitorTargets(mk({}, {}, { first: () => ({ json: K }), all: () => [{ json: K }] }));
    const checks = new Array(targets.length);
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < targets.length) {
        const i = next++;
        try { const r = await n8nHttp({ method: 'GET', url: targets[i].json.url, returnFullResponse: true, ignoreHttpStatusErrors: true, json: false, timeout: 20000 }); checks[i] = { json: { statusCode: r.statusCode, body: typeof r.body === 'string' ? r.body : '' } }; }
        catch (e) { checks[i] = { json: { error: { message: String(e.message || e) } } }; }
      }
    }));
    const sum = (await monitorSummarize(mk({}, { 'Monitor · Targets': targets }, { first: () => checks[0], all: () => checks })))[0].json;
    await this.save(st);
    if (notify && sum.newlyDown && sum.newlyDown.length) {
      await sendMail(env, { to: ADMIN_EMAIL, subject: 'SPIDER: ' + sum.newlyDown.length + ' אתרים הפסיקו לעבוד', text: sum.newlyDown.map((r) => r.title + ' — ' + r.url + ' (' + (r.code ? 'HTTP ' + r.code : (r.error || 'אין תשובה')) + ')').join('\n'), alert: true });
    }
    return sum;
  }

  async handle(request, rt) {
    const env = this.env;
    const raw = request.method === 'GET' ? '' : await request.text();
    if (raw.length > rt.max) return reply({ ok: false, error: 'too-big' }, 413);
    let body = {};
    const ct = request.headers.get('content-type') || '';
    try {
      if (/json/.test(ct)) body = JSON.parse(raw || '{}');
      else if (/x-www-form-urlencoded/.test(ct)) body = Object.fromEntries(new URLSearchParams(raw));
      else body = raw || {};   // text/plain: the handler parses it itself, as it did under n8n
    } catch (e) { body = {}; }
    const headers = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    // the address the platform saw (a client cannot forge this one)
    headers['x-forwarded-for'] = request.headers.get('cf-connecting-ip') || 'unknown';
    const st = await this.load();
    const $getWorkflowStaticData = () => st.sd;
    const helpers = { httpRequest: n8nHttp };
    // the hubs flow may hand a photo to the free image service through a short-lived link on this server
    const origin = new URL(request.url).origin, self = this;
    const ENVX = rt.svc === 'hubs' ? new Proxy(env, { get: (t, k) => (k === 'TMP_PUT' ? (b64, mime) => self.tmpPut(origin, b64, mime) : t[k]) }) : env;
    const ctx = (json, nodes = {}) => ({ $json: json, $getWorkflowStaticData, require: requireShim, $: (n) => first(n, nodes), ENV: ENVX, helpers });
    let h;
    try {
      if (rt.kind === 'status') {
        const q = Object.fromEntries(new URL(request.url).searchParams);
        const fresh = (await statusFresh(ctx({ query: q })))[0].json.fresh;
        if (!fresh) { await this.save(st); try { await this.runMonitor(false); } catch (e) { /* the page shows the last known state */ } const again = await this.load(); st.sd = again.sd; st.orig = again.orig; }
        const r = (await statusRender(ctx({}, { 'Status · Webhook': { query: q } })))[0].json;
        return new Response(r.body, { status: 200, headers: { ...CORS, 'Content-Type': r.contentType || 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https://devopsdevopshaim-wq.github.io data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
      }
      if (rt.kind === 'heygen') {
        let hb = {}; try { hb = typeof body === 'string' ? JSON.parse(body) : (body || {}); } catch (e) { hb = {}; }
        const w = sessionOf(st.sd, hb.token);
        // a video minute costs money: only signed-in people, a few sessions an hour each
        if (!w) return reply({ ok: true, available: false, reason: /^[a-f0-9]{48}$/.test(String(hb.token || '')) ? 'signin' : 'old-session' });
        // live avatars run on LiveAvatar (its own key and credits, LITE mode): the server mints the session and speaks Hebrew through Gemini
        // TTS; the page only gets the room credentials and streams the audio to the avatar. The key never reaches a page.
        if (!env.LIVEAVATAR_API_KEY || !env.GEMINI_API_KEY) return reply({ ok: true, available: false, reason: 'off' });
        const LA = 'https://api.liveavatar.com', KEY = { 'X-API-KEY': env.LIVEAVATAR_API_KEY, 'Content-Type': 'application/json' };
        if (hb.action === 'speak') {
          const text = String(hb.text || '').replace(/\s+/g, ' ').trim().slice(0, 700);
          if (!text) return reply({ ok: false, error: 'empty' }, 400);
          st.sd.heygenSay = st.sd.heygenSay || {};
          const sk = w.email, tn = Date.now(), sa = (st.sd.heygenSay[sk] || []).filter((x) => tn - x < 60000);
          if (sa.length >= 12) return reply({ ok: false, error: 'limit' }, 429);
          sa.push(tn); st.sd.heygenSay[sk] = sa; await this.save(st);
          let tr, tj = {};
          try {
            tr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts') + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
              body: JSON.stringify({ contents: [{ parts: [{ text: 'אמרי בעברית טבעית, בחום ובקצב רגיל של שיחה: ' + text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env.GEMINI_TTS_VOICE || 'Kore' } } } } }) });
            tj = await tr.json().catch(() => ({}));
          } catch (e) { tr = null; }
          const part = tj && tj.candidates && tj.candidates[0] && tj.candidates[0].content && tj.candidates[0].content.parts && tj.candidates[0].content.parts.find((x) => x.inlineData);
          if (!part) return reply({ ok: false, error: 'tts-' + (tr ? tr.status : 'net') });
          return reply({ ok: true, audio: part.inlineData.data, rate: 24000 });
        }
        if (hb.action === 'stop') {
          if (hb.session && /^[\w-]{20,}$/.test(String(hb.session))) { try { await fetch(LA + '/v1/sessions/stop', { method: 'POST', headers: { 'X-API-KEY': env.LIVEAVATAR_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: String(hb.session) }), signal: AbortSignal.timeout(8000) }); } catch (e) { /* the session times out by itself */ } }
          return reply({ ok: true });
        }
        if (hb.action !== 'start') return reply({ ok: true, available: true, minutes: 5 });
        st.sd.heygenUse = st.sd.heygenUse || {};
        const k = w.email, nowT = Date.now(), arr = (st.sd.heygenUse[k] || []).filter((x) => nowT - x < 3600000);
        if (arr.length >= 6) return reply({ ok: false, error: 'limit' }, 429);
        arr.push(nowT); st.sd.heygenUse[k] = arr; await this.save(st);
        const sandbox = /^(1|true|yes)$/i.test(String(env.LIVEAVATAR_SANDBOX || ''));
        // the avatar is picked by its name from the public list (default "Emma (Fullbody)"), or by LIVEAVATAR_AVATAR_ID; Sarah (Fullbody) if the name is not found
        let avatar = sandbox ? 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a' : (env.LIVEAVATAR_AVATAR_ID || await findAvatar(env.LIVEAVATAR_API_KEY, env.LIVEAVATAR_AVATAR_NAME || 'Emma (Fullbody)') || '3b87f156-f007-496d-aaea-1d5b75795444');
        let r, j = {};
        try {
          r = await fetch(LA + '/v1/sessions/token', { method: 'POST', headers: KEY, signal: AbortSignal.timeout(15000), body: JSON.stringify({ mode: 'LITE', avatar_id: avatar, is_sandbox: sandbox, video_settings: { quality: 'high', encoding: 'H264' } }) });
          j = await r.json().catch(() => ({}));
        } catch (e) { r = null; }
        const d = (j && j.data) || {}, tok = d.session_token || d.token;
        if (!tok) return reply({ ok: false, error: 'token-' + (r ? r.status : 'net') + (j && j.code ? '-' + j.code : '') + (j && typeof j.message === 'string' ? ' ' + j.message.replace(/[^\w .,:'-]/g, '').slice(0, 90) : '') });
        let r2, j2 = {};
        try { r2 = await fetch(LA + '/v1/sessions/start', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000) }); j2 = await r2.json().catch(() => ({})); } catch (e) { r2 = null; }
        const s2 = (j2 && j2.data) || {};
        if (!s2.livekit_url || !s2.livekit_client_token || !s2.ws_url) return reply({ ok: false, error: 'start-' + (r2 ? r2.status : 'net') + (j2 && j2.code ? '-' + j2.code : '') });
        return reply({ ok: true, session: s2.session_id, url: s2.livekit_url, clientToken: s2.livekit_client_token, ws: s2.ws_url, seconds: s2.max_session_duration || 300 });
      }
      if (rt.kind === 'jarvis') {
        const { sid, text } = jarvisInput(body);
        if (!text) return reply({ output: 'אני כאן. מה תרצה לשאול?' });
        if (!jarvisAllowed(headers['x-forwarded-for'])) return reply({ output: 'שאלת הרבה בזמן קצר. אפשר לנסות שוב בעוד כמה דקות.' });
        this.chats = this.chats || new Map();
        const hist = this.chats.get(sid) || [];
        hist.push({ role: 'user', text });
        // keys from the deploy's secrets, else the ones the admin saved in the vault on the AI page
        let vault = {}; try { vault = JSON.parse((st.sd.aiVault && st.sd.aiVault.blob) || '{}') || {}; } catch (e) { vault = {}; }
        const vk = (n) => String((vault[n] && vault[n].key) || '').trim();
        const a = await jarvisAsk({ ...env, GEMINI_API_KEY: env.GEMINI_API_KEY || vk('gemini'), ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || vk('claude'), OPENAI_API_KEY: env.OPENAI_API_KEY || vk('openai'), AI: env.AI }, hist);
        if (!a.text) { hist.pop(); return reply({ output: NO_ANSWER, tried: a.tried }); }
        hist.push({ role: 'assistant', text: a.text });
        this.chats.set(sid, hist.slice(-16));
        if (this.chats.size > 300) this.chats.delete(this.chats.keys().next().value);
        return reply({ output: a.text, by: a.by });
      }
      if (rt.kind === 'mail' || rt.kind === 'mailcb') {
        const origin = new URL(request.url).origin;
        if (rt.kind === 'mailcb') {
          const r = await mailCallback(env, st, new URL(request.url), origin);
          await this.save(st);
          return new Response(null, { status: 302, headers: { Location: r.redirect, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
        }
        const r = await mailHandle(env, st, body, origin);
        await this.save(st);
        return reply(r.body, r.code);
      }
      if (rt.kind === 'guide') {
        let gb = {}; try { gb = typeof body === 'string' ? JSON.parse(body) : (body || {}); } catch (e) { gb = {}; }
        const norm = (await guideNormalize(ctx({ body, headers })))[0].json;
        if (norm.blocked) { const r = (await guideBlocked(ctx(norm)))[0].json; await this.save(st); return reply({ answer: r.answer, project: r.project, next: r.next }); }
        let output = '';
        try {
          const K = await n8nHttp({ method: 'GET', url: env.KNOWLEDGE_URL || KNOWLEDGE, json: true, timeout: 15000 });
          let S = {}; try { S = await n8nHttp({ method: 'GET', url: env.SERVICES_URL || SERVICES, json: true, timeout: 10000 }); } catch (e) { S = {}; }
          const hide = new Set((Array.isArray(gb.exclude) ? gb.exclude : []).map(String));
          if (hide.size) K.projects = K.projects.filter((p) => !hide.has(p.id));
          const c = (await guideContext(ctx(norm, { 'Agents · Load knowledge': K, 'Agents · Normalize': norm })))[0].json;
          const g = c.groups || {}, cut = (x) => String(x || '').slice(0, 14000);
          const sv = ((S && S.services) || []).map((x) => '- ' + x.title + (x.from ? ' · מ־' + x.from + ' ₪ ' + (x.unit || '') : '') + ' · ' + (x.pitch || '')).join('\n');
          const system = c.system + '\n\nהמידע שלך על הפרויקטים, לפי תחום (השתמשי בו, אל תמציאי):\n' +
            ['devops', 'ai', 'data', 'tools', 'web'].map((k) => '### ' + k + '\n' + cut(g[k])).join('\n') + '\n### תהליך\n' + cut(g.pipeline) + '\n### זמינות האתרים\n' + cut(g.status) +
            '\n### שירותים ומחירים\n' + sv + '\n\nענו תמיד בעברית, אנושית וקצרה. אם השאלה כללית (לא על הפרויקטים), ענו עליה בקצרה ובנחמדות ואז חברו חזרה למה שחיים יכול לעשות בשביל המבקר.';
          const hist = (Array.isArray(gb.history) ? gb.history : []).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: String(m.text || '').slice(0, 800) })).filter((m) => m.text).slice(-8);
          while (hist.length && hist[0].role !== 'user') hist.shift();
          let vault = {}; try { vault = JSON.parse((st.sd.aiVault && st.sd.aiVault.blob) || '{}') || {}; } catch (e) { vault = {}; }
          const vk = (n) => String((vault[n] && vault[n].key) || '').trim();
          const a = await askChain({ ...env, GEMINI_API_KEY: env.GEMINI_API_KEY || vk('gemini'), ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || vk('claude'), OPENAI_API_KEY: env.OPENAI_API_KEY || vk('openai'), AI: env.AI },
            system, hist.concat([{ role: 'user', text: c.question }]), 1500);
          output = a.text;
          if (!output) {
            // no AI answered: still a real answer, from the site's own knowledge
            const l = localGuide(K, S, c.question, norm.page);
            output = l.answer + (l.project ? '\nPROJECT: ' + l.project : '') + (l.next || []).map((x) => '\nNEXT: ' + x).join('');
          }
        } catch (e) { output = ''; }
        const r = (await guideShape(ctx({ output }, { 'Agents · Normalize': norm })))[0].json;
        await this.save(st);
        return reply({ answer: r.answer, project: r.project, next: r.next });
      }
      if (rt.fn) {
        // a one-node flow: run it, keep the state, answer (a new lead also sends an email to the admin)
        const r = (await rt.fn(ctx({ body, headers })))[0].json;
        if (rt.lead && r.notify && r.lead) {
          const l = r.lead;
          await sendMail(env, { to: ADMIN_EMAIL, subject: 'ליד חדש: ' + l.name + (l.service ? ' · ' + l.service : ''),
            text: 'שם: ' + l.name + '\nטלפון: ' + l.phone + '\nעסק: ' + l.biz + '\nשירות: ' + l.service + (l.code ? '\nמבצע: ' + l.code : '') + '\n\n' + l.msg + '\n\nוואטסאפ: https://wa.me/' + String(l.phone).replace(/\D/g, '').replace(/^0/, '972') });
        }
        await this.save(st);
        return reply(r.body, r.code || 200);
      }
      h = (await handle(ctx({ body, headers })))[0].json;
      let cur = h;
      if (h.invoice) {
        // Morning (חשבונית ירוקה): a token, then the document, then keep its number on the payment
        let tok = {}, doc = {};
        try { const r = await fetch(h.invoice.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h.invoice.auth) }); tok = await r.json(); } catch (e) { tok = { error: { message: 'token-failed' } }; }
        try {
          const r = await fetch(h.invoice.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok.accessToken || '') }, body: JSON.stringify(h.invoice.doc) });
          doc = await r.json();
        } catch (e) { doc = { error: { message: 'create-failed' } }; }
        cur = (await invoiceSave(ctx(doc, { 'Auth · Handle': h })))[0].json;
      }
      if (cur.mail) {
        const res = await sendMail(env, cur.mail);
        cur = (await afterMail(ctx(res, { 'Send an email?': cur })))[0].json;
      }
      await this.save(st);
      return reply(cur.body, cur.code || 200);
    } catch (e) {
      // nothing is kept from a failed request
      return reply({ ok: false, error: 'server-error' }, 500);
    }
  }
}
