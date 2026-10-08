#!/usr/bin/env python3
"""Builds n8n/hasadna-hubs.json: the server side of the five standalone sites
(finance, marketing, AIA studio, wellness, torah).

The sites run in the browser by themselves. Two things a browser cannot do are done here:
  POST /webhook/hasadna-hubs   (text/plain JSON)
    {action: 'status'}                    -> {ok, ai}
    {action: 'ai', prompt, tag}           -> {ok, text, source}     a text answer from Gemini (free tier)
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


SERVE = r"""// The server side of the standalone sites: text answers from Gemini, and reads of a few market hosts.
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
sweep();
const GEMINI_KEY = '__GEMINI_API_KEY__';
const set = (k) => k && !/^__/.test(k);
const TEXT_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const DAY_CAP = 1200, IP_HOUR = 30, FETCH_HOUR = 240;
// the market data the finance site shows; nothing else may be read through here
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'feeds.finance.yahoo.com', 'www.globes.co.il'];

const out = (body, code = 200) => [{ json: { code, body } }];
if (!ORIGIN || !ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
let b = $json.body || {};
if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return out({ ok: false, error: 'bad-json' }, 400); } }
const day = new Date(now).toISOString().slice(0, 10);
if (sd.day !== day) { sd.day = day; sd.asked = 0; }

if (b.action === 'status') return out({ ok: true, ai: set(GEMINI_KEY), left: Math.max(0, DAY_CAP - (sd.asked || 0)) });

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
  sd.asked = (sd.asked || 0) + 1;
  let last;
  for (const m of TEXT_MODELS) {
    try {
      const r = await this.helpers.httpRequest({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } },
        json: true,
        timeout: 90000
      });
      const t = r && r.candidates && r.candidates[0] && r.candidates[0].content && (r.candidates[0].content.parts || []).map((p) => p.text || '').join('');
      if (t && t.trim()) return out({ ok: true, text: t.trim(), source: 'Gemini' });
      last = new Error('empty');
    } catch (e) { last = e; }
  }
  const s = String((last && (last.description || last.message)) || last).slice(0, 200);
  return out({ ok: false, error: /quota|exhausted|429/i.test(s) ? 'quota' : 'ai-failed' }, 502);
}
return out({ ok: false, error: 'unknown-action' }, 400);
"""

X, Y = 0, 0
nodes = [
    node('Note · Hubs', 'n8n-nodes-base.stickyNote', 1, {
        'content': '## השרת של חמשת האתרים העצמאיים\n`POST /webhook/hasadna-hubs` — עונה בטקסט מ־Gemini (חינם) וקורא נתוני שוק מכמה אתרים מותרים.\n\n'
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
