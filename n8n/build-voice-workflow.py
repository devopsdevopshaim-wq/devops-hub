#!/usr/bin/env python3
"""Builds n8n/hasadna-voice.json: Maya's voice for browsers that do not have one.

Edge has a natural female Hebrew voice built in, but Chrome on Windows only has
the male system voice, so for those browsers the site asks this webhook:
  POST /webhook/hasadna-voice   text=...  ->  {ok, mime, audio: base64 mp3}

The voice is Microsoft's neural "Hila" (Azure Speech, free tier: 500K characters
a month), or ElevenLabs when only its key is given. The keys never live in the
repository: .github/scripts/n8n-deploy.mjs fills them in from the SPIDER secret
when it installs the workflow. A monthly cap keeps it inside the free tier, and
only the portfolio's own pages may use it.

    python3 n8n/build-voice-workflow.py
"""
import json
import uuid
from pathlib import Path

# n8n keeps every execution's input and output. Codes, tokens, leads and audio must not stay there.
QUIET = {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'executionTimeout': 60}
NS = 'hasadna-voice/'
SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io'
SNIP = Path(__file__).with_name('snippets')
SEC = (SNIP / 'security.js').read_text(encoding='utf-8')


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


SPEAK = r"""// Turns Maya's text into speech: an mp3, as base64.
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
sweep();
const AZURE_KEY = '__AZURE_SPEECH_KEY__';
const AZURE_REGION = '__AZURE_SPEECH_REGION__';
const ELEVEN_KEY = '__ELEVENLABS_API_KEY__';
const ELEVEN_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah", a warm female voice
const set = (k) => k && !/^__/.test(k);
// stay inside the free tiers (characters a month)
const CAP = set(AZURE_KEY) ? 480000 : 9500;

const out = (body, code = 200) => [{ json: { code, body } }];
// browsers only: the call must come from the site's own pages
if (!ORIGIN || !ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);
if (!hit('voice-ip', ipKey(), 40, 3600000) || !hit('voice-all', 'all', 600, 86400000)) return out({ ok: false, error: 'rate-limited' }, 429);
if (!set(AZURE_KEY) && !set(ELEVEN_KEY)) return out({ ok: false, error: 'no-voice' }, 503);

const b = $json.body || {};
const text = String(b.text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900);
if (!text) return out({ ok: false, error: 'empty' }, 400);

const month = new Date().toISOString().slice(0, 7);
if (sd.month !== month) { sd.month = month; sd.used = 0; sd.calls = 0; }
if (sd.used + text.length > CAP) return out({ ok: false, error: 'quota' }, 429);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let audio;
try {
  if (set(AZURE_KEY)) {
    audio = await this.helpers.httpRequest({
      method: 'POST',
      url: `https://${set(AZURE_REGION) ? AZURE_REGION : 'westeurope'}.tts.speech.microsoft.com/cognitiveservices/v1`,
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'spider-maya'
      },
      body: `<speak version="1.0" xml:lang="he-IL"><voice name="he-IL-HilaNeural"><prosody rate="-4%">${esc(text)}</prosody></voice></speak>`,
      encoding: 'arraybuffer',
      json: false
    });
  } else {
    audio = await this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_64`,
      headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'he' }),
      encoding: 'arraybuffer',
      json: false
    });
  }
} catch (e) {
  return out({ ok: false, error: 'tts-failed', detail: String(e.message || e).slice(0, 160) }, 502);
}
sd.used += text.length;
sd.calls = (sd.calls || 0) + 1;
return out({ ok: true, mime: 'audio/mpeg', audio: Buffer.from(audio).toString('base64') });
"""

X, Y = 0, 0
nodes = [
    node('Note · Voice', 'n8n-nodes-base.stickyNote', 1, {
        'content': '## הקול של מאיה\n`POST /webhook/hasadna-voice` — מקבל טקסט ומחזיר הקלטה בקול נשי טבעי (Hila של Microsoft, או ElevenLabs). '
                   'האתר משתמש בזה רק בדפדפנים שאין בהם קול נשי בעברית (כמו Chrome ב־Windows).\n\n'
                   'המפתחות נכנסים אוטומטית מהסוד SPIDER ב־GitHub (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, או ELEVENLABS_API_KEY). '
                   'יש תקרה חודשית כדי להישאר בחינם.',
        'height': 260, 'width': 460, 'color': 6}, [X - 500, Y - 200]),
    node('Voice · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'hasadna-voice', 'responseMode': 'responseNode', 'options': {}},
         [X, Y], webhookId=uid('hasadna-voice')),
    node('Voice · Speak', 'n8n-nodes-base.code', 2, {'jsCode': SPEAK.replace('__SEC__', SEC)}, [X + 240, Y]),
    node('Voice · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
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
    'Voice · Webhook': {'main': [[{'node': 'Voice · Speak', 'type': 'main', 'index': 0}]]},
    'Voice · Speak': {'main': [[{'node': 'Voice · Respond', 'type': 'main', 'index': 0}]]},
}

wf = {'name': 'SPIDER · הקול של מאיה', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': QUIET, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}

out = Path(__file__).with_name('hasadna-voice.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
