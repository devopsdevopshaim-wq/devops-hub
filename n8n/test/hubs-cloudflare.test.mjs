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
  const r = await call({ action: 'image', prompt: 'x' }, '7.7.7.7');
  check('cloudflare: the daily allowance running out is reported as quota', r.code === 502 && r.body.error === 'quota' && /neurons/.test(r.body.detail), JSON.stringify(r.body));
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
