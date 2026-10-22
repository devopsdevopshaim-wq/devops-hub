// The hubs server's pictures when it runs in the Cloudflare Worker (ENV.AI): FLUX models from Workers AI, no Gemini.
import { run, check, workflow, nodeCode } from './harness.mjs';
const SITE = 'https://devopsdevopshaim-wq.github.io';
let T = 1_800_000_000_000; Date.now = () => T;

const code0 = nodeCode(workflow('hasadna-hubs.json'), 'Hubs · Serve');
function world(runAI) {
  const sd = {}, calls = [], gemini = [];
  const helpers = { httpRequest: async (o) => { gemini.push(o); throw new Error('gemini must not be called'); } };
  globalThis.__WAI = { run: async (model, input) => { calls.push({ model, input }); return runAI(model, input, calls.length); } };
  const code = 'const ENV = { AI: globalThis.__WAI };\n' + code0;   // the key stays a placeholder: no Gemini at all
  const call = async (b, ip = '5.6.7.8') => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd, helpers }))[0].json;
  return { call, calls, gemini };
}
const PIC = btoa('JPEGDATA');

{
  const { call, calls, gemini } = world(() => ({ image: PIC }));
  const r = await call({ action: 'image', prompt: 'red heart sticker' });
  check('cloudflare: a picture from a description comes from FLUX.1 schnell', r.code === 200 && r.body.ok && r.body.image === PIC && r.body.model === 'flux-1-schnell' && calls[0].input.prompt === 'red heart sticker' && !gemini.length, JSON.stringify(r));
}
{
  const { call, calls } = world(() => ({ image: PIC }));
  const r = await call({ action: 'restyle', prompt: 'anime style', image: btoa('photo-bytes'), mime: 'image/jpeg', w: 1000, h: 750 });
  const mp = calls[0] && calls[0].input.multipart;
  const form = mp ? await new Response(mp.body, { headers: { 'content-type': mp.contentType } }).formData() : null;
  const img = form && form.get('input_image_0');
  check('cloudflare: a restyle sends the photo to FLUX.2 klein as input_image_0', r.code === 200 && r.body.model === 'flux-2-klein-4b' && form.get('prompt') === 'anime style' && img && (await img.text()) === 'photo-bytes', JSON.stringify(r));
  check('cloudflare: the size is rounded to 16 and kept in range', form.get('width') === '1008' && form.get('height') === '752');
}
{
  // the first model fails: the next one answers; a binary answer is turned into base64
  const { call, calls } = world((m, input, n) => { if (n === 1) throw new Error('model busy'); return new TextEncoder().encode('PNGBYTES').buffer; });
  const r = await call({ action: 'restyle', prompt: 'comic', image: btoa('x'), mime: 'image/png' });
  check('cloudflare: when one model fails the next answers', r.code === 200 && r.body.model === 'flux-2-klein-9b' && atob(r.body.image) === 'PNGBYTES' && calls.length === 2, JSON.stringify(r));
}
{
  const { call } = world(() => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); });
  // the free fallback (Pollinations) is also down: the answer says quota
  const realFetch = globalThis.fetch, asked = [];
  globalThis.fetch = async (url) => { asked.push(String(url)); return new Response('busy', { status: 503 }); };
  let r = await call({ action: 'image', prompt: 'x' }, '7.7.7.7');
  check('cloudflare: the daily allowance running out is reported as quota', r.code === 502 && r.body.error === 'quota' && /neurons/.test(r.body.detail), JSON.stringify(r.body));
  check('cloudflare: after the allowance, the free Pollinations service is tried', asked.some((u) => /^https:\/\/image\.pollinations\.ai\/prompt\/x\?/.test(u) && /model=flux/.test(u)), asked);
  // ... and when it answers, its picture comes back
  globalThis.fetch = async () => new Response(new Uint8Array(6000).fill(7), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  r = await call({ action: 'image', prompt: 'x' }, '7.7.7.8');
  check('cloudflare: Pollinations answers when FLUX is out', r.code === 200 && r.body.source === 'Pollinations' && r.body.model === 'flux' && r.body.mime === 'image/jpeg', JSON.stringify(r.body).slice(0, 200));
  globalThis.fetch = realFetch;
}
{
  const { call, calls } = world(() => ({ image: PIC }));
  let r = await call({ action: 'restyle', prompt: 'x', image: '<svg>', mime: 'image/png' });
  check('cloudflare: a bad picture is refused before the model', r.code === 400 && !calls.length);
  r = await call({ action: 'image', prompt: '' });
  check('cloudflare: an empty description is refused', r.code === 400 && !calls.length);
}
{
  // text: Gemini has no key here, so Workers AI answers (Llama 3.3 for text, the vision model for a picture)
  const { call, calls } = world((m) => ({ response: 'שלום מ' + m.split('/').pop() }));
  let r = await call({ action: 'ai', prompt: 'hi' }, '8.8.4.1');
  check('cloudflare: a text question is answered by Llama 3.3 when Gemini cannot', r.code === 200 && r.body.source === 'Cloudflare' && /llama-3.3/.test(r.body.model) && calls[0].input.messages[0].content === 'hi', JSON.stringify(r));
  r = await call({ action: 'ai', prompt: 'read this', image: btoa('img'), mime: 'image/png' }, '8.8.4.2');
  const part = calls.at(-1).input.messages[0].content[1];
  check('cloudflare: a picture question goes to the vision model as a data URL', r.code === 200 && /llama-4-scout/.test(r.body.model) && part.image_url.url === 'data:image/png;base64,' + btoa('img'), JSON.stringify(r));
}
{
  // with a Gemini key on Cloudflare: Gemini answers first (keeps faces best); when it cannot, FLUX does
  const withKey = (gem) => {
    const sd = {}, calls = [], asked = [];
    const helpers = { httpRequest: async (o) => { asked.push(o); return gem(o); } };
    globalThis.__WAI = { run: async (model, input) => { calls.push({ model, input }); return { image: PIC }; } };
    const code = 'const ENV = { AI: globalThis.__WAI };\n' + code0.replace("'__GEMINI_API_KEY__'", "'test-key'");
    const call = async (b, ip = '9.9.9.9') => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd, helpers }))[0].json;
    return { call, calls, asked, sd };
  };
  const ok = withKey((o) => o.method === 'GET' ? { models: [] } : { candidates: [{ content: { parts: [{ inlineData: { data: 'GEMPIC', mimeType: 'image/png' } }] } }] });
  let r = await ok.call({ action: 'restyle', prompt: 'pixar', image: btoa('p'), mime: 'image/jpeg' });
  check('cloudflare + key: a restyle comes from Gemini first', r.code === 200 && r.body.source === 'Gemini' && r.body.image === 'GEMPIC' && !ok.calls.length, JSON.stringify(r));
  const no = withKey((o) => { if (o.method === 'GET') return { models: [] }; const e = new Error('429 limit: 0 free tier'); throw e; });
  r = await no.call({ action: 'restyle', prompt: 'pixar', image: btoa('p'), mime: 'image/jpeg' });
  check('cloudflare + key: when Gemini has no allowance FLUX answers', r.code === 200 && r.body.source === 'Cloudflare' && r.body.model === 'flux-2-klein-4b' && no.sd.gemImgOff, JSON.stringify(r));
  const n = no.asked.length; r = await no.call({ action: 'restyle', prompt: 'x', image: btoa('p'), mime: 'image/jpeg' }, '9.9.9.8');
  check('cloudflare + key: a key with no image allowance is not asked again for a while', r.body.ok && no.asked.length === n);
}
{
  // FLUX out of its daily allowance: one failure is enough, the other models are not tried
  const { call, calls } = world(() => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); });
  const r = await call({ action: 'restyle', prompt: 'x', image: btoa('p'), mime: 'image/jpeg' }, '6.6.6.6');
  check('cloudflare: FLUX out of neurons stops at once and says quota', r.code === 502 && r.body.error === 'quota' && calls.length === 1, JSON.stringify(r));
}
{
  // a big photo for Gemini, the small copy for FLUX
  const { call, calls } = world(() => ({ image: PIC }));
  const r = await call({ action: 'restyle', prompt: 'x', image: btoa('big-photo'), small: btoa('small-photo'), mime: 'image/jpeg' }, '6.6.6.7');
  const img = r.body.ok && calls[0].input.multipart && (await new Response(calls[0].input.multipart.body, { headers: { 'content-type': calls[0].input.multipart.contentType } }).formData()).get('input_image_0');
  check('cloudflare: FLUX gets the small copy of the photo', img && (await img.text()) === 'small-photo', JSON.stringify(r));
}
{
  // OpenAI's image model when its key is set: Gemini (no allowance) → gpt-image-1 answers; FLUX is not used
  const sd = {}, calls = [], fetched = [];
  const helpers = { httpRequest: async (o) => { if (o.method === 'GET') return { models: [] }; throw new Error('429 limit: 0 free tier'); } };
  globalThis.__WAI = { run: async (model, input) => { calls.push(model); return { image: PIC }; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetched.push({ url, init }); return new Response(JSON.stringify({ data: [{ b64_json: 'OAIPIC' }] })); };
  const code = 'const ENV = { AI: globalThis.__WAI };\n' + code0.replace("'__GEMINI_API_KEY__'", "'g-key'").replace("'__OPENAI_API_KEY__'", "'sk-test'");
  const call = async (b, ip) => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd, helpers }))[0].json;
  let r = await call({ action: 'restyle', prompt: 'frame like the invitation', image: btoa('inv'), mime: 'image/jpeg', w: 1024, h: 688 }, '4.4.4.1');
  const f = fetched[0] && fetched[0].init.body;
  check('openai: a restyle goes to gpt-image-1 edits with the photo, landscape size', r.code === 200 && r.body.source === 'OpenAI' && r.body.image === 'OAIPIC' && /images\/edits/.test(fetched[0].url) && f.get('size') === '1536x1024' && f.get('model') === 'gpt-image-1' && !calls.length, JSON.stringify(r));
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'billing hard limit' } }), { status: 400 });
  r = await call({ action: 'restyle', prompt: 'x', image: btoa('inv'), mime: 'image/jpeg' }, '4.4.4.2');
  check('openai failing: FLUX answers and says why the better models were skipped', r.code === 200 && r.body.source === 'Cloudflare' && /gpt-image-1: 400 billing/.test(r.body.skipped || ''), JSON.stringify(r));
  globalThis.fetch = realFetch;
}
{
  // the engine choice: the studio can ask for one engine; the others are not tried
  const sd = {}, calls = [], fetched = [], gem = [];
  const helpers = { httpRequest: async (o) => { gem.push(o); if (o.method === 'GET') return { models: [] }; return { candidates: [{ content: { parts: [{ inlineData: { data: 'GEMPIC', mimeType: 'image/png' } }] } }] }; } };
  globalThis.__WAI = { run: async (model) => { calls.push(model); return { image: PIC }; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetched.push(url); return new Response(JSON.stringify({ data: [{ b64_json: 'OAIPIC' }] })); };
  const code = 'const ENV = { AI: globalThis.__WAI };\n' + code0.replace("'__GEMINI_API_KEY__'", "'g-key'").replace("'__OPENAI_API_KEY__'", "'sk-test'");
  const call = async (b, ip) => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd, helpers }))[0].json;
  let r = await call({ action: 'engines' }, '4.4.5.1');
  check('engines: the server lists its picture engines', r.code === 200 && r.body.engines.gemini && r.body.engines.openai && r.body.engines.flux && r.body.engines.free, JSON.stringify(r));
  r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'flux' }, '4.4.5.2');
  check('engine flux: only FLUX is asked (no Gemini, no OpenAI)', r.code === 200 && r.body.source === 'Cloudflare' && !gem.some((o) => o.method === 'POST') && !fetched.length, JSON.stringify(r));
  r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'gemini' }, '4.4.5.3');
  check('engine gemini: Gemini answers', r.code === 200 && r.body.source === 'Gemini' && r.body.image === 'GEMPIC', JSON.stringify(r));
  r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'openai' }, '4.4.5.4');
  check('engine openai: gpt-image-1 answers', r.code === 200 && r.body.source === 'OpenAI', JSON.stringify(r));
  r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'midjourney' }, '4.4.5.5');
  check('engine: an unknown engine is refused', r.code === 400 && r.body.error === 'bad-engine', JSON.stringify(r));
  globalThis.fetch = realFetch;
}
{
  // an engine this server does not have answers engine-off at once
  const code = code0;   // n8n: no ENV.AI, no keys
  const call = async (b, ip) => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd: {}, helpers: { httpRequest: async () => { throw new Error('no'); } } }))[0].json;
  const r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'flux' }, '4.4.6.1');
  check('engine off: FLUX without Workers AI says engine-off', r.code === 503 && r.body.error === 'engine-off', JSON.stringify(r));
}
{
  // the free engine without a key: gptimage (open anonymously) first; key-only models are remembered and skipped; one wait on 429
  const sd = {}, asked = [];
  let n = 0;
  globalThis.__WAI = { run: async () => { throw new Error('4006: daily free allocation of 10,000 neurons'); } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const m = /model=([a-z]+)/.exec(String(url)); const model = m && m[1]; asked.push(model);
    if (model === 'gptimage' && n++ === 0) return new Response('{"error":"rate limited"}', { status: 429 });
    if (model === 'gptimage') return new Response(new Uint8Array(5000).fill(7), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    return new Response('{"error":{"message":"' + model + ' isn\'t part of the Classic API. Use it with a pollen key"}}', { status: 403 });
  };
  const code = 'const ENV = { AI: globalThis.__WAI, TMP_PUT: async () => "https://tmp.example/p.jpg" };\n' + code0;
  const call = async (b, ip) => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, origin: SITE } }, sd, helpers: { httpRequest: async () => { throw new Error('no'); } } }))[0].json;
  let r = await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg' }, '4.4.7.1');
  check('free engine: gptimage is asked first, waits once on 429 and answers', r.code === 200 && r.body.source === 'Pollinations' && r.body.model === 'gptimage' && asked[0] === 'gptimage' && asked[1] === 'gptimage', JSON.stringify({ r, asked }));
  r = await call({ action: 'engines' }, '4.4.7.2');
  check('engines: FLUX is off for the rest of the day once its allowance is used up', r.body.engines.flux === false && r.body.engines.free === true, JSON.stringify(r));
  asked.length = 0; n = 5;
  globalThis.fetch = async (url) => { const model = (/model=([a-z]+)/.exec(String(url)) || [])[1]; asked.push(model); return new Response('{"error":{"message":"' + model + ' isn\'t part of the Classic API"}}', { status: 403 }); };
  await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'free' }, '4.4.7.3');
  const first = asked.slice();
  asked.length = 0;
  await call({ action: 'restyle', prompt: 'oil', image: btoa('p'), mime: 'image/jpeg', engine: 'free' }, '4.4.7.4');
  check('free engine: models that need a key are skipped next time', first.length === 4 && asked.length === 0, JSON.stringify({ first, asked }));
  globalThis.fetch = realFetch;
}
