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
  'hasadna-voice': { svc: 'voice', fn: voiceSpeak, max: 200000, free: true },
  'hasadna-guide': { svc: 'agents', kind: 'guide', max: 20000, free: true },
  'hasadna-status': { svc: 'agents', kind: 'status', max: 1000, free: true, method: 'GET' }
};
const KNOWLEDGE = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/knowledge.json';
const routeOf = (pathname) => ROUTES[pathname.replace(/^\/(webhook\/)?/, '')];
const CORS = { 'Access-Control-Allow-Origin': SITE_ORIGIN, Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

const reply = (body, code = 200, extra = {}) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export default {
  // every 2 hours: check the sites (the n8n flow did this every 15 minutes, at a cost in executions)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.STATE.get(env.STATE.idFromName('agents')).runMonitor(true));
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
    const ctx = (json, nodes = {}) => ({ $json: json, $getWorkflowStaticData, require: requireShim, $: (n) => first(n, nodes), ENV: env, helpers });
    let h;
    try {
      if (rt.kind === 'status') {
        const q = Object.fromEntries(new URL(request.url).searchParams);
        const fresh = (await statusFresh(ctx({ query: q })))[0].json.fresh;
        if (!fresh) { await this.save(st); try { await this.runMonitor(false); } catch (e) { /* the page shows the last known state */ } const again = await this.load(); st.sd = again.sd; st.orig = again.orig; }
        const r = (await statusRender(ctx({}, { 'Status · Webhook': { query: q } })))[0].json;
        return new Response(r.body, { status: 200, headers: { ...CORS, 'Content-Type': r.contentType || 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https://devopsdevopshaim-wq.github.io data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
      }
      if (rt.kind === 'guide') {
        const norm = (await guideNormalize(ctx({ body, headers })))[0].json;
        if (norm.blocked) { const r = (await guideBlocked(ctx(norm)))[0].json; await this.save(st); return reply({ answer: r.answer, project: r.project, next: r.next }); }
        let output = '';
        try {
          const K = await n8nHttp({ method: 'GET', url: KNOWLEDGE, json: true, timeout: 15000 });
          const c = (await guideContext(ctx(norm, { 'Agents · Load knowledge': K, 'Agents · Normalize': norm })))[0].json;
          if (env.ANTHROPIC_API_KEY) {
            const g = c.groups || {}, cut = (x) => String(x || '').slice(0, 14000);
            const system = c.system + '\n\nהמידע שלך על הפרויקטים, לפי תחום (השתמשי בו, אל תמציאי):\n' +
              ['devops', 'ai', 'data', 'tools', 'web'].map((k) => '### ' + k + '\n' + cut(g[k])).join('\n') + '\n### תהליך\n' + cut(g.pipeline) + '\n### זמינות האתרים\n' + cut(g.status);
            const r = await n8nHttp({ method: 'POST', url: 'https://api.anthropic.com/v1/messages', json: true, timeout: 90000,
              headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
              body: { model: env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: 1500, system, messages: [{ role: 'user', content: c.question }] } });
            output = ((r && r.content) || []).map((x) => x.text || '').join('');
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
