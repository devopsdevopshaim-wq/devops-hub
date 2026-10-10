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

const SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const FROM_NAME = 'SPIDER · חיים קריספין';
const ADMIN_EMAIL = 'devopsdevopshaim@gmail.com';
// every endpoint the n8n flows had, served here: one durable state per service (the three business endpoints share one, like their n8n flow)
const ROUTES = {
  'hasadna-auth': { svc: 'main', max: 64000 },
  'hasadna-lead': { svc: 'business', fn: leadSave, max: 70000, lead: true },
  'hasadna-prices': { svc: 'business', fn: pricesRead, max: 70000 },
  'hasadna-admin': { svc: 'business', fn: adminHandle, max: 70000 },
  'hasadna-hubs': { svc: 'hubs', fn: hubsServe, max: 6000000, free: true },
  'comic-draw': { svc: 'comic', fn: comicDraw, max: 12000000, free: true },
  'hasadna-voice': { svc: 'voice', fn: voiceSpeak, max: 200000, free: true }
};
const routeOf = (pathname) => ROUTES[pathname.replace(/^\/(webhook\/)?/, '')];
const CORS = { 'Access-Control-Allow-Origin': SITE_ORIGIN, Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

const reply = (body, code = 200, extra = {}) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (url.pathname === '/') return reply({ ok: true, service: 'spider', where: 'cloudflare', routes: Object.keys(ROUTES) });
    const rt = routeOf(url.pathname);
    if (!rt) return reply({ ok: false, error: 'not-found' }, 404);
    // the price list is read with GET; everything else is POST
    const want = rt.fn === pricesRead ? 'GET' : 'POST';
    if (request.method !== want) return request.method === 'GET' ? reply({ ok: true, service: 'spider', where: 'cloudflare' }) : reply({ ok: false, error: 'bad-method' }, 405);
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
        body: JSON.stringify({ sender: { name: FROM_NAME, email: from }, to: [{ email: mail.to }], subject: mail.subject, textContent: mail.text }) });
      return r.ok ? {} : { error: 'brevo ' + r.status };
    }
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM_RESEND || `${FROM_NAME} <onboarding@resend.dev>`, to: [mail.to], subject: mail.subject, text: mail.text }) });
      return r.ok ? {} : { error: 'resend ' + r.status };
    }
  } catch (e) { return { error: String((e && e.message) || e).slice(0, 100) }; }
  return { error: 'no-mail-provider' };
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
const first = (n, j) => ({ first: () => ({ json: j[n] || {} }) });

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
    const ctx = (json, nodes = {}) => ({ $json: json, $getWorkflowStaticData, require: requireShim, $: (n) => first(n, nodes), ENV: env, helpers });
    let h;
    try {
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
