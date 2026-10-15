#!/usr/bin/env python3
"""Builds n8n/hasadna-hubs.json: the server side of the standalone sites
(finance, marketing, AIA studio, wellness, torah, bills).

The sites run in the browser by themselves. Two things a browser cannot do are done here:
  POST /webhook/hasadna-hubs   (text/plain JSON)
    {action: 'status'}                    -> {ok, ai}
    {action: 'ai', prompt, tag}           -> {ok, text, source}     a text answer from Gemini (free tier)
    {action: 'ai', prompt, image, mime}   -> {ok, text, source}     the same about one picture or PDF (base64, up to ~4MB;
                                                                     the bills site reads a photographed or emailed bill)
    {action: 'ai', tag: 'wiring', prompt, images: [{data, mime}]}
                                          -> {ok, text, source}     a long JSON answer about up to 6 drawing pages
                                                                     (the cabinet-wiring site reads a wiring diagram page by page)
    {action: 'restyle', prompt, image, mime}
                                          -> {ok, image, mime}      one photo redrawn by Gemini's image model in a style
                                                                     (the frame studio: comic, anime, superheroes, animals...)
    {action: 'image', prompt}             -> {ok, image, mime}      a new picture from a description (the frame studio's
                                                                     backgrounds, stickers and frames); same caps as restyle
    {action: 'fetch', url}                -> {ok, status, body}     a GET of an allowed host (market quotes and headlines,
                                                                     which browsers may not read directly)
The Gemini key never lives in the repository: .github/scripts/n8n-deploy.mjs fills it in from the GEMINI_API_KEY secret.
Only the portfolio's own pages may call it, each address is rate limited, and daily caps keep it inside the free tier.

    python3 n8n/build-hubs-workflow.py
"""
import json
import uuid
from pathlib import Path

QUIET = {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'executionTimeout': 120}
NS = 'hasadna-hubs/'
SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io'
SNIP = Path(__file__).with_name('snippets')
SEC = (SNIP / 'security.js').read_text(encoding='utf-8')


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


SERVE = r"""// The server side of the standalone sites: answers from Gemini (text, or about one picture/PDF), and reads of a few market hosts.
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
sweep();
const GEMINI_KEY = '__GEMINI_API_KEY__';
const set = (k) => k && !/^__/.test(k);
const TEXT_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const DAY_CAP = 1200, IP_HOUR = 30, FETCH_HOUR = 240, IMG_DAY = 200, IMG_IP_HOUR = 12;
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image-preview'];
// the market data the finance site shows; nothing else may be read through here
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'feeds.finance.yahoo.com', 'www.globes.co.il'];

const out = (body, code = 200) => [{ json: { code, body } }];
const H = this.helpers;
// why a Gemini call failed, short and without the key: "429 limit: 0 ..." / "404 models/x is not found"
const why = (e) => {
  let b = e && (e.response && e.response.body || e.cause && e.cause.response && e.cause.response.body);
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (x) { /* keep the text */ } }
  const msg = (b && b.error && b.error.message) || (e && (e.description || e.message)) || String(e);
  const code = (e && (e.httpCode || e.statusCode || (e.response && e.response.status))) || '';
  return (String(code) + ' ' + String(msg)).replace(/AIza[\w-]{20,}/g, '…').replace(/\s+/g, ' ').trim().slice(0, 180);
};
const failed = (errs) => {
  const all = errs.join(' | ');
  const error = /limit: 0|free[_ ]tier|billing|FreeTier/i.test(all) ? 'no-free-tier' : /quota|exhausted|429/i.test(all) ? 'quota' : 'ai-failed';
  return out({ ok: false, error, detail: all.slice(0, 500) }, 502);
};
// the image models this key can use, read from Gemini once every 6 hours (names change); the fixed list is the fallback
async function imageModels() {
  if (sd.imgModels && sd.imgModelsAt > now - 6 * 3600000) return sd.imgModels;
  let found = [];
  try {
    const r = await H.httpRequest({ method: 'GET', url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', headers: { 'x-goog-api-key': GEMINI_KEY }, json: true, timeout: 10000 });
    found = ((r && r.models) || []).filter((m) => /image/i.test(m.name || '') && !/imagen|veo|tts|embed/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name).replace(/^models\//, ''));
  } catch (e) { /* the fixed list */ }
  const rank = (m) => (IMAGE_MODELS.includes(m) ? 0 : 10) + (/flash/.test(m) ? 0 : 3) + (/preview|exp/.test(m) ? 1 : 0);
  const list = found.length ? found.sort((a, b) => rank(a) - rank(b)).slice(0, 4) : IMAGE_MODELS;
  if (found.length) { sd.imgModels = list; sd.imgModelsAt = now; }
  return list;
}
if (!ORIGIN || !ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
let b = $json.body || {};
if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return out({ ok: false, error: 'bad-json' }, 400); } }
const day = new Date(now).toISOString().slice(0, 10);
if (sd.day !== day) { sd.day = day; sd.asked = 0; }

if (b.action === 'status') return out({ ok: true, ai: set(GEMINI_KEY), left: Math.max(0, DAY_CAP - (sd.asked || 0)), imageModels: sd.imgModels || null });

if (b.action === 'fetch') {
  if (!hit('hubs-fetch', ipKey(), FETCH_HOUR, 3600000)) return out({ ok: false, error: 'rate-limited' }, 429);
  let u;
  try { u = new URL(String(b.url || '')); } catch (e) { return out({ ok: false, error: 'bad-url' }, 400); }
  if (u.protocol !== 'https:' || !HOSTS.includes(u.hostname) || u.username || u.password || String(b.url).length > 400) return out({ ok: false, error: 'host-not-allowed' }, 403);
  try {
    const r = await this.helpers.httpRequest({ method: 'GET', url: u.toString(), headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }, json: false, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 12000 });
    const body = typeof r.body === 'string' ? r.body : Buffer.from(r.body || '').toString('utf8');
    return out({ ok: true, status: r.statusCode || 200, body: body.slice(0, 400000) });
  } catch (e) { return out({ ok: false, error: 'fetch-failed' }, 502); }
}

if (b.action === 'ai') {
  if (!hit('hubs-ai-ip', ipKey(), IP_HOUR, 3600000)) return out({ ok: false, error: 'rate-limited' }, 429);
  if (!set(GEMINI_KEY)) return out({ ok: false, error: 'no-key' }, 503);
  if ((sd.asked || 0) >= DAY_CAP) return out({ ok: false, error: 'quota' }, 429);
  const prompt = String(b.prompt || '').replace(/\u0000/g, ' ').trim();
  if (!prompt) return out({ ok: false, error: 'empty' }, 400);
  if (prompt.length > 24000) return out({ ok: false, error: 'too-big' }, 413);
  // one picture/PDF (image + mime), or a few drawing pages (images: [{data, mime}]) for the wiring site
  const list = Array.isArray(b.images) ? b.images : b.image ? [{ data: b.image, mime: b.mime }] : [];
  if (list.length > 6) return out({ ok: false, error: 'too-many' }, 413);
  const media = [];
  let total = 0;
  for (const im of list) {
    const mime = String((im && im.mime) || 'image/jpeg').toLowerCase();
    const data = String((im && im.data) || '').replace(/^data:[^,]{0,80},/, '').replace(/\s+/g, '');
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(mime)) return out({ ok: false, error: 'bad-image' }, 400);
    total += data.length;
    if (data.length > 5600000 || total > 5600000) return out({ ok: false, error: 'too-big' }, 413);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return out({ ok: false, error: 'bad-image' }, 400);
    media.push({ inline_data: { mime_type: mime, data } });
  }
  // a wiring diagram answers with a long JSON wire list
  const wiring = b.tag === 'wiring';
  const gen = wiring ? { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: 'application/json' } : { temperature: media.length ? 0.1 : 0.7, maxOutputTokens: 4096 };
  sd.asked = (sd.asked || 0) + 1;
  const errs = [];
  for (const m of TEXT_MODELS) {
    // the whole run must end inside n8n's 120 s limit
    const left = 112000 - (Date.now() - now);
    if (left < 15000) break;
    try {
      const r = await this.helpers.httpRequest({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: { contents: [{ role: 'user', parts: [...media, { text: prompt }] }], generationConfig: gen },
        json: true,
        timeout: Math.min(wiring ? 105000 : 90000, left)
      });
      const t = r && r.candidates && r.candidates[0] && r.candidates[0].content && (r.candidates[0].content.parts || []).map((p) => p.text || '').join('');
      if (t && t.trim()) return out({ ok: true, text: t.trim(), source: 'Gemini' });
      errs.push(m + ': empty answer');
    } catch (e) { errs.push(m + ': ' + why(e)); }
  }
  return failed(errs);
}
if (b.action === 'restyle' || b.action === 'image') {
  const fresh = b.action === 'image';
  if (!hit('hubs-img-ip', ipKey(), IMG_IP_HOUR, 3600000)) return out({ ok: false, error: 'rate-limited' }, 429);
  if (!set(GEMINI_KEY)) return out({ ok: false, error: 'no-key' }, 503);
  if ((sd.imgs || 0) >= IMG_DAY || sd.imgDay !== day) { if (sd.imgDay !== day) { sd.imgDay = day; sd.imgs = 0; } else return out({ ok: false, error: 'quota' }, 429); }
  const prompt = String(b.prompt || '').replace(/\u0000/g, ' ').trim();
  if (!prompt) return out({ ok: false, error: 'empty' }, 400);
  if (prompt.length > 2000) return out({ ok: false, error: 'too-big' }, 413);
  const mime = String(b.mime || 'image/jpeg').toLowerCase();
  const data = String(b.image || '').replace(/^data:[^,]{0,80},/, '').replace(/\s+/g, '');
  if (!fresh) {
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return out({ ok: false, error: 'bad-image' }, 400);
    if (!data || data.length > 5600000) return out({ ok: false, error: data ? 'too-big' : 'bad-image' }, data ? 413 : 400);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return out({ ok: false, error: 'bad-image' }, 400);
  }
  sd.imgs = (sd.imgs || 0) + 1;
  const errs = [];
  for (const m of await imageModels()) {
    const left = 112000 - (Date.now() - now);
    if (left < 20000) break;
    try {
      const r = await this.helpers.httpRequest({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: { contents: [{ role: 'user', parts: fresh ? [{ text: prompt }] : [{ inline_data: { mime_type: mime, data } }, { text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
        json: true,
        timeout: Math.min(100000, left)
      });
      const parts = (r && r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
      const img = parts.map((p) => p.inlineData || p.inline_data).filter((x) => x && x.data)[0];
      if (img) return out({ ok: true, image: img.data, mime: img.mimeType || img.mime_type || 'image/png', source: 'Gemini', model: m });
      errs.push(m + ': no picture in the answer ' + parts.map((p) => p.text || '').join(' ').slice(0, 120));
    } catch (e) { errs.push(m + ': ' + why(e)); }
  }
  return failed(errs);
}
return out({ ok: false, error: 'unknown-action' }, 400);
"""

X, Y = 0, 0
nodes = [
    node('Note · Hubs', 'n8n-nodes-base.stickyNote', 1, {
        'content': '## השרת של חמשת האתרים העצמאיים\n`POST /webhook/hasadna-hubs` — עונה בטקסט מ־Gemini (חינם), קורא תכניות חיווט לארון־פלאן, וקורא נתוני שוק מכמה אתרים מותרים.\n\n'
                   'המפתח נכנס אוטומטית מהסוד GEMINI_API_KEY ב־GitHub. יש תקרה יומית ומגבלה לכל כתובת.',
        'height': 220, 'width': 460, 'color': 6}, [X - 500, Y - 180]),
    node('Hubs · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'hasadna-hubs', 'responseMode': 'responseNode', 'options': {}},
         [X, Y], webhookId=uid('hasadna-hubs')),
    node('Hubs · Serve', 'n8n-nodes-base.code', 2, {'jsCode': SERVE.replace('__SEC__', SEC)}, [X + 240, Y]),
    node('Hubs · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
         {'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.body) }}',
          'options': {'responseCode': '={{ $json.code || 200 }}',
                      'responseHeaders': {'entries': [
                          {'name': 'Access-Control-Allow-Origin', 'value': SITE_ORIGIN},
                          {'name': 'Vary', 'value': 'Origin'},
                          {'name': 'X-Content-Type-Options', 'value': 'nosniff'},
                          {'name': 'Cache-Control', 'value': 'no-store'}]}}},
         [X + 480, Y]),
]
connections = {
    'Hubs · Webhook': {'main': [[{'node': 'Hubs · Serve', 'type': 'main', 'index': 0}]]},
    'Hubs · Serve': {'main': [[{'node': 'Hubs · Respond', 'type': 'main', 'index': 0}]]},
}
wf = {'name': 'SPIDER · השרת של האתרים העצמאיים', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': QUIET, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}
out = Path(__file__).with_name('hasadna-hubs.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
