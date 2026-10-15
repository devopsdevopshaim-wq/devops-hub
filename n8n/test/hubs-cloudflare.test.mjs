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
