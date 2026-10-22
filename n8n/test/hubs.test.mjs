import { run, check, workflow, nodeCode } from './harness.mjs';
const SITE = 'https://devopsdevopshaim-wq.github.io';
let T = 1_800_000_000_000; Date.now = () => T;

const code0 = nodeCode(workflow('hasadna-hubs.json'), 'Hubs · Serve');
function world({ key = true, ai = null, http = null } = {}) {
  const sd = {};
  const sent = [];
  const helpers = { httpRequest: async (o) => {
    sent.push(o);
    if (o.url.includes('generativelanguage')) { if (ai) return ai(o); return { candidates: [{ content: { parts: [{ text: 'תשובה' }] } }] }; }
    return http ? http(o) : { statusCode: 200, body: '{"ok":1}' };
  } };
  const code = key ? code0.replace('__GEMINI_API_KEY__', 'AIza' + 'k'.repeat(35)) : code0;
  const call = async (b, { origin = SITE, ip = '1.2.3.4' } = {}) => (await run(code, { json: { body: JSON.stringify(b), headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}) } }, sd, helpers }))[0].json;
  return { call, sent, sd };
}

{
  const { call, sent } = world();
  let r = await call({ action: 'status' }, { origin: null });
  check('hubs: a call with no Origin is refused', r.code === 403 && !sent.length);
  r = await call({ action: 'status' }, { origin: 'https://evil.example' });
  check('hubs: a foreign Origin is refused', r.code === 403);
  r = await call({ action: 'status' });
  check('hubs: status says the AI is on', r.code === 200 && r.body.ai === true);
  r = await call({ action: 'ai', prompt: 'שלום' });
  check('hubs: the site gets a text answer', r.code === 200 && r.body.ok && r.body.text === 'תשובה');
  r = await call({ action: 'ai', prompt: '' });
  check('hubs: an empty prompt is refused', r.code === 400);
  r = await call({ action: 'ai', prompt: 'x'.repeat(24001) });
  check('hubs: a huge prompt is refused', r.code === 413);
  r = await call({ action: 'ai', prompt: 'קרא את החשבון', image: 'data:image/jpeg;base64,' + 'QUJD'.repeat(50), mime: 'image/jpeg' });
  const parts = sent.at(-1).body.contents[0].parts;
  check('hubs: a picture goes to Gemini with the prompt', r.code === 200 && parts.length === 2 && parts[0].inline_data.mime_type === 'image/jpeg' && parts[0].inline_data.data === 'QUJD'.repeat(50) && parts[1].text === 'קרא את החשבון');
  r = await call({ action: 'ai', prompt: 'x', image: 'JVBERi0x', mime: 'application/pdf' });
  check('hubs: a PDF bill is accepted', r.code === 200 && sent.at(-1).body.contents[0].parts[0].inline_data.mime_type === 'application/pdf');
  let n = sent.length;
  r = await call({ action: 'ai', prompt: 'x', image: 'QUJD', mime: 'text/html' });
  check('hubs: a non-image type is refused', r.code === 400 && sent.length === n);
  r = await call({ action: 'ai', prompt: 'x', image: '<script>', mime: 'image/png' });
  check('hubs: a non-base64 picture is refused', r.code === 400 && sent.length === n);
  r = await call({ action: 'ai', prompt: 'x', image: 'A'.repeat(5600004), mime: 'image/png' });
  check('hubs: a huge picture is refused', r.code === 413 && sent.length === n);
  r = await call({ action: 'ai', tag: 'wiring', prompt: 'קרא את התכנית', images: [{ data: 'QUJD', mime: 'image/jpeg' }, { data: 'REVG', mime: 'image/jpeg' }] });
  const wb = sent.at(-1).body;
  check('hubs: wiring pages go to Gemini together, with a long JSON answer', r.code === 200 && wb.contents[0].parts.length === 3 && wb.contents[0].parts[1].inline_data.data === 'REVG' && wb.generationConfig.responseMimeType === 'application/json' && wb.generationConfig.maxOutputTokens >= 32768);
  n = sent.length;
  r = await call({ action: 'ai', tag: 'wiring', prompt: 'x', images: Array.from({ length: 7 }, () => ({ data: 'QUJD', mime: 'image/jpeg' })) });
  check('hubs: more than 6 pages are refused', r.code === 413 && sent.length === n);
  r = await call({ action: 'ai', tag: 'wiring', prompt: 'x', images: [{ data: 'A'.repeat(3000000), mime: 'image/jpeg' }, { data: 'A'.repeat(3000000), mime: 'image/jpeg' }] });
  check('hubs: pages over the total size are refused', r.code === 413 && sent.length === n);
  r = await call({ action: 'ai', tag: 'wiring', prompt: 'x', images: [{ data: 'QUJD', mime: 'text/html' }] });
  check('hubs: a non-image page is refused', r.code === 400 && sent.length === n);
  r = await call({ action: 'nope' });
  check('hubs: an unknown action is refused', r.code === 400);
}
{
  const png = { candidates: [{ content: { parts: [{ text: 'הנה' }, { inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] };
  const { call, sent } = world({ ai: async () => png });
  let r = await call({ action: 'restyle', prompt: 'comic style', image: 'data:image/jpeg;base64,' + 'QUJD'.repeat(20), mime: 'image/jpeg' });
  const rb = sent.at(-1).body;
  check('hubs: a restyle sends the photo to the image model and returns a picture', r.code === 200 && r.body.ok && r.body.image === 'UE5H' && r.body.mime === 'image/png' && /image/.test(sent.at(-1).url) && rb.generationConfig.responseModalities.includes('IMAGE') && rb.contents[0].parts[0].inline_data.data === 'QUJD'.repeat(20));
  let n = sent.length;
  r = await call({ action: 'image', prompt: 'sunset beach, sticker' });
  const ib = sent.at(-1).body;
  check('hubs: an image from a description returns a picture', r.code === 200 && r.body.ok && r.body.image === 'UE5H' && ib.contents[0].parts.length === 1 && ib.contents[0].parts[0].text === 'sunset beach, sticker' && ib.generationConfig.responseModalities.includes('IMAGE'));
  n = sent.length;
  r = await call({ action: 'image', prompt: '' });
  check('hubs: an image needs a description', r.code === 400 && sent.length === n);
  r = await call({ action: 'image', prompt: 'x'.repeat(2001) });
  check('hubs: an image description has a size limit', r.code === 413 && sent.length === n);
  r = await call({ action: 'restyle', prompt: 'x', image: 'QUJD', mime: 'application/pdf' });
  check('hubs: a restyle refuses a non-image', r.code === 400 && sent.length === n);
  r = await call({ action: 'restyle', prompt: 'x', image: '<svg>', mime: 'image/png' });
  check('hubs: a restyle refuses a non-base64 picture', r.code === 400 && sent.length === n);
  r = await call({ action: 'restyle', prompt: '', image: 'QUJD', mime: 'image/png' });
  check('hubs: a restyle needs a prompt', r.code === 400 && sent.length === n);
  let lim = 0; for (let i = 0; i < 70; i++) { const x = await call({ action: 'restyle', prompt: 'q', image: 'QUJD', mime: 'image/png' }, { ip: '8.8.8.8' }); if (x.code === 429) lim++; }
  check('hubs: restyles are rate limited per address', lim >= 7, lim);
}
{
  const { call } = world({ ai: async () => ({ candidates: [{ content: { parts: [{ text: 'no picture' }] } }] }) });
  const r = await call({ action: 'restyle', prompt: 'x', image: 'QUJD', mime: 'image/png' });
  check('hubs: a restyle with no picture back fails cleanly', r.code === 502 && r.body.error === 'ai-failed');
}
{
  const { call } = world({ key: false });
  const r = await call({ action: 'ai', prompt: 'שלום' });
  check('hubs: no key -> 503', r.code === 503 && r.body.error === 'no-key');
}
{
  const { call } = world({ ai: async () => { throw new Error('429 quota exhausted'); } });
  const r = await call({ action: 'ai', prompt: 'שלום' });
  check('hubs: a Gemini quota error is reported as quota', r.code === 502 && r.body.error === 'quota');
}
{
  const { call } = world();
  let lim = 0; for (let i = 0; i < 40; i++) { const x = await call({ action: 'ai', prompt: 'q' }, { ip: '9.9.9.9' }); if (x.code === 429) lim++; }
  check('hubs: one address is rate limited', lim >= 8, lim);
}
{
  const { call, sent } = world();
  let r = await call({ action: 'fetch', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC' });
  check('hubs: an allowed market host is read', r.code === 200 && r.body.ok && /yahoo/.test(sent.at(-1).url));
  for (const bad of ['https://evil.example/x', 'http://query1.finance.yahoo.com/x', 'https://user:pw@query1.finance.yahoo.com/x', 'https://query1.finance.yahoo.com.evil.example/x', 'file:///etc/passwd', 'https://169.254.169.254/latest']) {
    const n = sent.length;
    r = await call({ action: 'fetch', url: bad });
    check('hubs: refuses ' + bad, r.code >= 400 && sent.length === n, r.body);
  }
}
{
  // the image model has no free tier: the answer says so, with Gemini's own words and no key
  const err = Object.assign(new Error('Request failed with status code 429'), { httpCode: '429', response: { body: { error: { message: 'Quota exceeded for metric generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-image AIzaSyFAKEFAKEFAKEFAKEFAKE' } } } });
  const { call } = world({ ai: async (o) => { if (o.method === 'GET') return { models: [] }; throw err; } });
  const r = await call({ action: 'image', prompt: 'heart', engine: 'gemini' }, { ip: '9.9.9.1' });
  check('hubs: an image model with no free tier is reported as such', r.code === 502 && r.body.error === 'no-free-tier' && /limit: 0/.test(r.body.detail) && !/AIza/.test(r.body.detail), JSON.stringify(r.body));
}
{
  // the image models are read from Gemini, so a renamed model is still found
  const png = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] };
  const { call, sent } = world({ ai: async (o) => o.method === 'GET' ? { models: [{ name: 'models/gemini-9-flash-image', supportedGenerationMethods: ['generateContent'] }, { name: 'models/imagen-4', supportedGenerationMethods: ['predict'] }, { name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] } : png });
  const r = await call({ action: 'image', prompt: 'heart' }, { ip: '9.9.9.2' });
  check('hubs: the image model comes from the list Gemini gives', r.code === 200 && r.body.model === 'gemini-9-flash-image' && /gemini-9-flash-image:generateContent/.test(sent.at(-1).url), JSON.stringify(r.body));
  const s = await call({ action: 'status' }, { ip: '9.9.9.2' });
  check('hubs: status shows the image models found', JSON.stringify(s.body.imageModels) === '["gemini-9-flash-image"]');
}
{
  // text: every model's reason comes back, not only the last one
  const { call } = world({ ai: async () => { throw Object.assign(new Error('x'), { httpCode: '404', response: { body: { error: { message: 'model not found' } } } }); } });
  const r = await call({ action: 'ai', prompt: 'hi' }, { ip: '9.9.9.3' });
  check('hubs: a failed answer says why', r.code === 502 && r.body.error === 'ai-failed' && /404 model not found/.test(r.body.detail));
}
