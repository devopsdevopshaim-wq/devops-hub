#!/usr/bin/env python3
"""Builds n8n/hasadna-comic.json: the comic studio's drawing server.

The comic studio (comic-studio/ on GitHub Pages) sends photos and a request,
and a real image model draws the comic:
  POST /webhook/comic-draw   (text/plain JSON)
    {mode: 'status'}                                   -> {ok, gemini, openai, left}
    {mode: 'character'|'scene'|'page', provider: 'gemini'|'openai'|'auto',
     style, images: [{mime, data(base64)}], story, panels, title, text, aspect}
                                                       -> {ok, provider, mime, image(base64)}

Gemini (Gemini 3 Pro Image for full pages, 3.1 Flash Image otherwise, 2.5 Flash Image as fallback) draws by default and keeps faces recognizable;
OpenAI (gpt-image-1, images/edits) is the alternative, and 'auto' falls back to it
when Gemini fails. The keys never live in the repository:
.github/scripts/n8n-deploy.mjs fills them in from the GEMINI_API_KEY and
OPENAI_API_KEY secrets (or the SPIDER secret) when it installs the workflow.
Only the portfolio's own pages may call it, each address is rate limited, and a
daily cap keeps the image bill bounded.

    python3 n8n/build-comic-workflow.py
"""
import json
import uuid
from pathlib import Path

# n8n keeps every execution's input and output. Photos must not stay there.
QUIET = {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'executionTimeout': 170}
NS = 'hasadna-comic/'
SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io'
SNIP = Path(__file__).with_name('snippets')
SEC = (SNIP / 'security.js').read_text(encoding='utf-8')


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NS + name))


def node(name, type_, version, params, pos, **extra):
    n = {'parameters': params, 'id': uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': pos}
    n.update(extra)
    return n


DRAW = r"""// Draws a comic with a real image model (Gemini or OpenAI) from the visitor's photos.
__SEC__

const sd = $getWorkflowStaticData('global');
const now = Date.now();
sweep();
const GEMINI_KEY = '__GEMINI_API_KEY__';
const OPENAI_KEY = '__OPENAI_API_KEY__';
/* full pages need the strongest model (layout and Hebrew lettering); single drawings use the fast one.
   If a model is not available to the key, the next one in the list is tried. */
const GEMINI_MODELS = { page: ['gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'], other: ['gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'] };
const OPENAI_MODEL = 'gpt-image-1';
const set = (k) => k && !/^__/.test(k);
// the image bill: drawings a day for everyone together, and per address an hour
const DAY_CAP = 200, IP_HOUR = 24;

const out = (body, code = 200) => [{ json: { code, body } }];
if (!ORIGIN || !ORIGIN_OK) return out({ ok: false, error: 'forbidden' }, 403);

let b = $json.body || {};
if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return out({ ok: false, error: 'bad-json' }, 400); } }
const day = new Date(now).toISOString().slice(0, 10);
if (sd.day !== day) { sd.day = day; sd.drawn = 0; }
const left = Math.max(0, DAY_CAP - (sd.drawn || 0));

if (b.mode === 'status') return out({ ok: true, gemini: set(GEMINI_KEY), openai: set(OPENAI_KEY), left, free: set(GEMINI_KEY) });

// ---- free mode: Gemini's text models (free tier) describe the people and write the script;
// a free drawing service in the browser draws the panels. Nothing here touches the paid image models.
const TEXT_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const cleanText = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
async function geminiText(parts, schema) {
  let last;
  for (const m of TEXT_MODELS) {
    try {
      const r = await this.helpers.httpRequest({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.8 } },
        json: true,
        timeout: 60000
      });
      const t = r && r.candidates && r.candidates[0] && r.candidates[0].content && (r.candidates[0].content.parts || []).map((p) => p.text || '').join('');
      return JSON.parse(t);
    } catch (e) { last = e; }
  }
  throw last;
}
if (b.mode === 'describe' || b.mode === 'script') {
  if (!hit('comic-free-ip', ipKey(), 60, 3600000) || !hit('comic-free-all', 'all', 1500, 86400000)) return out({ ok: false, error: 'rate-limited' }, 429);
  if (!set(GEMINI_KEY)) return out({ ok: false, error: 'no-key' }, 503);
  const pics = (Array.isArray(b.images) ? b.images : []).slice(0, 4).filter((x) => x && /^image\/(jpeg|png|webp)$/.test(x.mime) && typeof x.data === 'string' && x.data.length < 3500000);
  try {
    if (b.mode === 'describe') {
      if (!pics.length) return out({ ok: false, error: 'no-image' }, 400);
      const j = await geminiText.call(this, [{ text: 'For each photo, describe the main person for a comic artist so they can be drawn recognizably: apparent age, gender, face shape, hair, beard, head covering (such as a kippah), skin tone, glasses, typical expression, clothing with colors. One short English paragraph per photo, no names, no opinions about appearance.' }]
        .concat(pics.map((x) => ({ inline_data: { mime_type: x.mime, data: x.data } }))),
        { type: 'OBJECT', properties: { people: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['people'] });
      return out({ ok: true, people: (j.people || []).slice(0, 4).map((x) => cleanText(x, 600)) });
    }
    const panelsN = Math.min(8, Math.max(1, parseInt(b.panels, 10) || 5));
    const people = (Array.isArray(b.people) ? b.people : []).slice(0, 4).map((x) => cleanText(x, 600));
    const ask = `Write a comic page script in ${panelsN} panels.\n` +
      `Characters (from photos): ${people.map((x, i) => `[${i + 1}] ${x}`).join(' ') || 'one friendly main character'}\n` +
      `Story idea from the user (Hebrew or English): ${cleanText(b.story, 1200) || 'a short uplifting adventure with a clear beginning, a dramatic moment and a happy ending'}\n` +
      `Title: ${cleanText(b.title, 80) || 'make up a short Hebrew title'}\n` +
      'For each panel give: "scene" = a vivid English description of what to draw (camera angle, setting, action, which characters, their expression), WITHOUT any text, letters or speech bubbles in the image; ' +
      '"speech" = what a character says, in natural Hebrew (empty string if nobody speaks); "caption" = a short Hebrew narration box (empty string if none). Keep Hebrew lines short (up to 8 words). ' +
      'Follow the user\'s panel-by-panel story exactly when they give one, including their wording for speech and captions.';
    const j = await geminiText.call(this, [{ text: ask }], {
      type: 'OBJECT',
      properties: { title: { type: 'STRING' }, panels: { type: 'ARRAY', items: { type: 'OBJECT', properties: { scene: { type: 'STRING' }, speech: { type: 'STRING' }, caption: { type: 'STRING' } }, required: ['scene'] } } },
      required: ['panels']
    });
    const panels = (j.panels || []).slice(0, panelsN).map((p) => ({ scene: cleanText(p.scene, 700), speech: cleanText(p.speech, 140), caption: cleanText(p.caption, 140) }));
    if (!panels.length) throw new Error('empty script');
    return out({ ok: true, title: cleanText(b.title || j.title, 80), panels });
  } catch (e) {
    const s = String((e && (e.description || e.message)) || e).slice(0, 200);
    return out({ ok: false, error: /quota|exhausted|429/i.test(s) ? 'quota' : 'text-failed', detail: s }, 502);
  }
}
if (!hit('comic-ip', ipKey(), IP_HOUR, 3600000)) return out({ ok: false, error: 'rate-limited' }, 429);
if (!set(GEMINI_KEY) && !set(OPENAI_KEY)) return out({ ok: false, error: 'no-key' }, 503);
if (!left) return out({ ok: false, error: 'quota' }, 429);

// ---- the request
const MODES = ['character', 'scene', 'page'];
const mode = MODES.includes(b.mode) ? b.mode : 'character';
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const images = (Array.isArray(b.images) ? b.images : []).slice(0, 4).filter((x) => x && /^image\/(jpeg|png|webp)$/.test(x.mime) && typeof x.data === 'string' && /^[A-Za-z0-9+/=]+$/.test(x.data.slice(0, 200)));
if (!images.length) return out({ ok: false, error: 'no-image' }, 400);
if (images.some((x) => x.data.length > 3500000)) return out({ ok: false, error: 'too-big' }, 413);

const STYLES = {
  'superhero': 'modern American superhero comic book art: confident inked line work, dynamic cel shading, dramatic rim lighting, saturated colors, subtle halftone texture',
  'graphic-novel': 'gritty graphic novel art: heavy spotted blacks, moody cinematic lighting, muted teal and amber palette, textured ink brushwork',
  'manga': 'black and white Japanese manga: precise G-pen line art, screentone shading, speed lines, expressive eyes, high contrast',
  'anime': 'Japanese anime key frame: clean line art, soft cel shading, luminous painted background, vivid gentle palette',
  'ligne-claire': 'Franco-Belgian ligne claire comic like classic European albums: uniform clean black outlines, flat bright colors, no hatching, detailed backgrounds',
  'retro-pop': '1960s vintage comic book: Ben-Day dots, bold black outlines, slightly off-register CMYK printing, yellowed newsprint paper',
  'caricature': 'professional caricature: big expressive head on a smaller body, exaggerated but flattering features, clean ink outlines, warm marker coloring',
  'webtoon': 'Korean webtoon: clean digital line art, soft gradients and glow, polished full-color rendering, stylish modern look',
  'cartoon-3d': 'high-end 3D animated family movie still: stylized proportions, large expressive eyes, soft subsurface skin, cinematic lighting',
  'storybook': 'children\'s storybook illustration: soft watercolor and gouache textures, warm light, gentle rounded shapes',
  'street-art': 'street art graffiti mural on a brick wall: bold spray paint colors, thick double outlines, drips, stencil accents',
  'noir': 'black and white film noir comic: stark chiaroscuro, rain, deep shadows, a single red accent color'
};
const style = STYLES[b.style] ? b.style : 'superhero';
const look = STYLES[style];
const story = clean(b.story, 1200), title = clean(b.title, 80), extra = clean(b.prompt, 400);
const panels = Math.min(8, Math.max(2, parseInt(b.panels, 10) || 5));
const keep = 'Keep every person clearly recognizable from the reference photos: same face shape, eyes, nose, hairstyle, beard, skin tone, head covering (such as a kippah) and clothing. Draw them respectfully.';
const lang = b.text === 'none'
  ? 'Leave every speech bubble and caption box empty (white, no letters) so text can be added later.'
  : 'All text in the image (title, captions, speech bubbles) must be in Hebrew, written right to left, spelled exactly as given, in clear bold comic lettering. Do not invent other text.';
let prompt;
if (mode === 'page') {
  prompt = `Create ONE complete comic book page in this art style: ${look}.\n` +
    `Layout: ${panels} panels of varied sizes with clean white gutters and black panel borders, read right to left (Hebrew comic). ` +
    (title ? `A large hand-lettered title at the top: "${title}". ` : '') +
    `The main character${images.length > 1 ? 's are the people' : ' is the person'} in the reference photo${images.length > 1 ? 's' : ''}. ${keep}\n` +
    `Story, panel by panel: ${story || 'a short uplifting adventure with a clear beginning, a dramatic moment and a happy ending'}.\n` +
    `Vary the camera: close-ups, a wide establishing shot, an action moment. Add speech bubbles and caption boxes where they help the story. ${lang}` +
    (extra ? `\nAdditional direction: ${extra}.` : '');
} else if (mode === 'scene') {
  prompt = `Combine the ${images.length} people from these reference photos into ONE new comic illustration together, in this art style: ${look}.\n` +
    `Scene: ${story || 'standing together, smiling, in a dynamic heroic pose'}. ${keep} No text, no speech bubbles, no watermark.` +
    (extra ? `\nAdditional direction: ${extra}.` : '');
} else {
  prompt = `Redraw this photo as a finished comic illustration in this art style: ${look}.\n` +
    `${keep} Keep the pose and composition, but make it look hand-drawn by a professional comic artist, not like a filtered photo. No text, no speech bubbles, no watermark.` +
    (story ? `\nScene direction: ${story}.` : '') + (extra ? `\nAdditional direction: ${extra}.` : '');
}

const ASPECTS = { portrait: ['3:4', '1024x1536'], tall: ['9:16', '1024x1536'], square: ['1:1', '1024x1024'], landscape: ['4:3', '1536x1024'] };
const aspect = ASPECTS[b.aspect] || (mode === 'page' ? ASPECTS.portrait : ASPECTS.square);

async function gemini() {
  const parts = [{ text: prompt }].concat(images.map((x) => ({ inline_data: { mime_type: x.mime, data: x.data } })));
  const models = GEMINI_MODELS[mode === 'page' ? 'page' : 'other'];
  let last;
  for (const m of models) {
    try { return await geminiOne.call(this, m, parts); } catch (e) {
      last = e;
      const code = e && (e.httpCode || (e.response && e.response.status) || e.statusCode);
      /* only "this model is not available" moves to the next model; a real refusal stops here */
      if (!(String(code) === '404' || /not found|not supported|is not available|permission/i.test(String(e.message || e.description || '')))) throw e;
    }
  }
  throw last;
}

async function geminiOne(model, parts) {
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: aspect[0] } } },
    json: true,
    timeout: 140000
  });
  const cand = r && r.candidates && r.candidates[0];
  const part = cand && cand.content && (cand.content.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!part) throw new Error('gemini returned no image' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
  const d = part.inlineData || part.inline_data;
  return { mime: d.mimeType || d.mime_type || 'image/png', image: d.data, model };
}

async function openai() {
  const boundary = '----comic' + rnd(12);
  const chunks = [];
  const field = (name, value) => chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  field('model', OPENAI_MODEL);
  field('prompt', prompt);
  field('size', aspect[1]);
  field('quality', mode === 'page' ? 'high' : 'medium');
  images.forEach((x, i) => {
    const ext = x.mime === 'image/png' ? 'png' : x.mime === 'image/webp' ? 'webp' : 'jpg';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="photo${i}.${ext}"\r\nContent-Type: ${x.mime}\r\n\r\n`));
    chunks.push(Buffer.from(x.data, 'base64'));
    chunks.push(Buffer.from('\r\n'));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/images/edits',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
    json: false,
    timeout: 160000
  });
  const j = typeof r === 'string' ? JSON.parse(r) : (Buffer.isBuffer(r) ? JSON.parse(r.toString('utf8')) : r);
  const img = j && j.data && j.data[0] && j.data[0].b64_json;
  if (!img) throw new Error('openai returned no image');
  return { mime: 'image/png', image: img };
}

const want = ['gemini', 'openai', 'auto'].includes(b.provider) ? b.provider : 'auto';
let order = want === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai'];
if (want !== 'auto') order = order.slice(0, 1);
order = order.filter((p) => set(p === 'gemini' ? GEMINI_KEY : OPENAI_KEY));
if (!order.length) return out({ ok: false, error: 'no-key', provider: want }, 503);

const why = (e) => {
  const s = String((e && (e.description || e.message)) || e);
  const code = (e && (e.httpCode || (e.response && e.response.status) || e.statusCode)) || '';
  return (code ? code + ' ' : '') + s.slice(0, 200);
};
const errors = [];
for (const p of order) {
  try {
    const r = await (p === 'gemini' ? gemini : openai).call(this);
    sd.drawn = (sd.drawn || 0) + 1;
    return out({ ok: true, provider: p, model: r.model || (p === 'openai' ? OPENAI_MODEL : ''), mime: r.mime, image: r.image, left: Math.max(0, DAY_CAP - sd.drawn) });
  } catch (e) {
    errors.push(p + ': ' + why(e));
  }
}
return out({ ok: false, error: 'draw-failed', detail: errors.join(' | ') }, 502);
"""

X, Y = 0, 0
nodes = [
    node('Note · Comic', 'n8n-nodes-base.stickyNote', 1, {
        'content': '## סטודיו הקומיקס · שרת הציור\n`POST /webhook/comic-draw` — מקבל צילומים, סגנון וסיפור, ומחזיר ציור קומיקס אמיתי '
                   'מ־Gemini (ברירת מחדל) או מ־OpenAI. במצב auto, אם Gemini נכשל עוברים ל־OpenAI.\n\n'
                   'המפתחות נכנסים אוטומטית מהסודות GEMINI_API_KEY ו־OPENAI_API_KEY ב־GitHub. '
                   'רק האתר עצמו יכול לקרוא, יש הגבלה לכל כתובת ותקרה יומית. הצילומים לא נשמרים ב־n8n.',
        'height': 280, 'width': 480, 'color': 5}, [X - 520, Y - 200]),
    node('Comic · Webhook', 'n8n-nodes-base.webhook', 2,
         {'httpMethod': 'POST', 'path': 'comic-draw', 'responseMode': 'responseNode', 'options': {}},
         [X, Y], webhookId=uid('comic-draw')),
    node('Comic · Draw', 'n8n-nodes-base.code', 2, {'jsCode': DRAW.replace('__SEC__', SEC)}, [X + 240, Y]),
    node('Comic · Respond', 'n8n-nodes-base.respondToWebhook', 1.1,
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
    'Comic · Webhook': {'main': [[{'node': 'Comic · Draw', 'type': 'main', 'index': 0}]]},
    'Comic · Draw': {'main': [[{'node': 'Comic · Respond', 'type': 'main', 'index': 0}]]},
}

wf = {'name': 'SPIDER · סטודיו קומיקס', 'nodes': nodes, 'connections': connections,
      'active': False, 'settings': QUIET, 'pinData': {},
      'meta': {'templateCredsSetupCompleted': False}, 'tags': []}

out = Path(__file__).with_name('hasadna-comic.json')
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('wrote', out, len(nodes), 'nodes')
