// SPIDER sign-in server on Cloudflare Workers. It runs the same code as the n8n workflow "SPIDER · כניסה והרשאות" (see build.mjs),
// with the state (clients, sessions, usage, plan, vault) in one Durable Object, so every request is handled one at a time, like n8n.
// There is no monthly execution cap on the free plan (100,000 requests a day). Emails go through Brevo or Resend (an HTTP API).
import { DurableObject } from 'cloudflare:workers';
import * as nodeCrypto from 'node:crypto';
import handle from './gen/handle.mjs';
import invoiceSave from './gen/invoice-save.mjs';
import afterMail from './gen/after-mail.mjs';

const SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const FROM_NAME = 'SPIDER · חיים קריספין';
const ADMIN_EMAIL = 'devopsdevopshaim@gmail.com';
const PATHS = new Set(['/', '/hasadna-auth', '/webhook/hasadna-auth']);
const CORS = { 'Access-Control-Allow-Origin': SITE_ORIGIN, Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

const reply = (body, code = 200, extra = {}) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (!PATHS.has(url.pathname)) return reply({ ok: false, error: 'not-found' }, 404);
    if (request.method === 'GET') return reply({ ok: true, service: 'spider-auth', where: 'cloudflare' });
    if (request.method !== 'POST') return reply({ ok: false, error: 'bad-method' }, 405);
    const id = env.STATE.idFromName('main');
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

const requireShim = (m) => { if (m === 'crypto') return nodeCrypto; throw new Error('module not allowed: ' + m); };
const first = (n, j) => ({ first: () => ({ json: j[n] || {} }) });

export class State extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.q = Promise.resolve(); }

  fetch(request) {
    // one request at a time: the code reads and changes the whole state
    const run = this.q.then(() => this.handle(request));
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

  async handle(request) {
    const env = this.env;
    const raw = await request.text();
    if (raw.length > 64000) return reply({ ok: false, error: 'too-big' }, 413);
    let body = {};
    const ct = request.headers.get('content-type') || '';
    try { body = /json/.test(ct) ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw)); } catch (e) { body = {}; }
    const headers = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    // the address the platform saw (a client cannot forge this one)
    headers['x-forwarded-for'] = request.headers.get('cf-connecting-ip') || 'unknown';
    const st = await this.load();
    const $getWorkflowStaticData = () => st.sd;
    const helpers = {
      httpRequest: async (o) => {
        const r = await fetch(o.url, { method: o.method || 'GET', headers: o.headers, body: o.body });
        const text = await r.text();
        return o.returnFullResponse ? { statusCode: r.status, body: text } : text;
      }
    };
    const ctx = (json, nodes = {}) => ({ $json: json, $getWorkflowStaticData, require: requireShim, $: (n) => first(n, nodes), ENV: env, helpers });
    let h;
    try {
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
