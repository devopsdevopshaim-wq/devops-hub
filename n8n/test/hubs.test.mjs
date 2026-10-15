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
  r = await call({ action: 'restyle', prompt: 'x', image: 'QUJD', mime: 'application/pdf' });
  check('hubs: a restyle refuses a non-image', r.code === 400 && sent.length === n);
  r = await call({ action: 'restyle', prompt: 'x', image: '<svg>', mime: 'image/png' });
  check('hubs: a restyle refuses a non-base64 picture', r.code === 400 && sent.length === n);
  r = await call({ action: 'restyle', prompt: '', image: 'QUJD', mime: 'image/png' });
  check('hubs: a restyle needs a prompt', r.code === 400 && sent.length === n);
  let lim = 0; for (let i = 0; i < 20; i++) { const x = await call({ action: 'restyle', prompt: 'q', image: 'QUJD', mime: 'image/png' }, { ip: '8.8.8.8' }); if (x.code === 429) lim++; }
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
