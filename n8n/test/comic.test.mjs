import { run, check, workflow, nodeCode } from './harness.mjs';
const SITE = 'https://devopsdevopshaim-wq.github.io';
let T = 1_800_000_000_000; Date.now = () => T;

const base = nodeCode(workflow('hasadna-comic.json'), 'Comic · Draw');
const PHOTO = { mime: 'image/jpeg', data: Buffer.from('fake-jpeg').toString('base64') };
const GEMINI_OK = { candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: 'R0VNSU5J' } }] } }] };

function setup({ gemini = true, openai = true, geminiFails = false } = {}) {
  let code = base;
  if (gemini) code = code.replace("'__GEMINI_API_KEY__'", "'AIza" + 'g'.repeat(35) + "'");
  if (openai) code = code.replace("'__OPENAI_API_KEY__'", "'sk-proj-" + 'o'.repeat(40) + "'");
  const sent = [];
  const helpers = {
    httpRequest: async (req) => {
      sent.push(req);
      if (req.url.includes('generativelanguage')) {
        if (geminiFails) { const e = new Error('blocked'); e.httpCode = 400; throw e; }
        return GEMINI_OK;
      }
      return JSON.stringify({ data: [{ b64_json: 'T1BFTkFJ' }] });
    }
  };
  return { code, sent, helpers, sd: {} };
}

const call = async (ctx, body, { origin = SITE, ip = '1.2.3.4', asString = true } = {}) =>
  (await run(ctx.code, { json: { body: asString ? JSON.stringify(body) : body, headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}) } }, sd: ctx.sd, helpers: ctx.helpers }))[0].json;

{
  const c = setup();
  let r = await call(c, { mode: 'page', images: [PHOTO] }, { origin: null });
  check('comic: a call with no Origin is refused', r.code === 403 && !c.sent.length);
  r = await call(c, { mode: 'page', images: [PHOTO] }, { origin: 'https://evil.example' });
  check('comic: a foreign Origin is refused', r.code === 403 && !c.sent.length);
  r = await call(c, { mode: 'status' });
  check('comic: status says which models are connected', r.code === 200 && r.body.gemini === true && r.body.openai === true && r.body.left > 0);
  r = await call(c, { mode: 'page', images: [] });
  check('comic: a request without a photo is refused', r.code === 400 && r.body.error === 'no-image');
  r = await call(c, { mode: 'page', images: [{ mime: 'text/html', data: 'PHNjcmlwdD4=' }] });
  check('comic: only image types are accepted', r.code === 400);
  r = await call(c, { mode: 'page', images: [{ mime: 'image/jpeg', data: 'A'.repeat(3600000) }] });
  check('comic: a huge photo is refused', r.code === 413);
}

{
  const c = setup({ gemini: false, openai: false });
  const r = await call(c, { mode: 'character', images: [PHOTO] });
  check('comic: no key -> 503 no-key', r.code === 503 && r.body.error === 'no-key' && !c.sent.length);
  const s = await call(c, { mode: 'status' });
  check('comic: status shows no models', s.body.gemini === false && s.body.openai === false);
}

{
  const c = setup();
  const r = await call(c, { mode: 'page', style: 'manga', images: [PHOTO, PHOTO], story: 'הרפתקה', title: 'ההרפתקאות של ארי', panels: 5 });
  const g = c.sent[0];
  check('comic: Gemini draws by default', r.code === 200 && r.body.ok && r.body.provider === 'gemini' && r.body.image === 'R0VNSU5J');
  check('comic: the key goes in a header, not the URL', g.headers['x-goog-api-key'].startsWith('AIza') && !g.url.includes('AIza'));
  const text = g.body.contents[0].parts[0].text;
  check('comic: the page prompt carries style, story, title and panels', /manga/i.test(text) && text.includes('הרפתקה') && text.includes('ההרפתקאות של ארי') && text.includes('5 panels'));
  check('comic: both photos go to the model', g.body.contents[0].parts.filter((p) => p.inline_data).length === 2);
  check('comic: a page is portrait', g.body.generationConfig.imageConfig.aspectRatio === '3:4');
  check('comic: a full page uses the strongest model', /gemini-3-pro-image:generateContent/.test(g.url));
}

{
  const c = setup({ geminiFails: true });
  const r = await call(c, { mode: 'character', provider: 'auto', images: [PHOTO] });
  check('comic: auto falls back to OpenAI when Gemini fails', r.code === 200 && r.body.provider === 'openai' && r.body.image === 'T1BFTkFJ');
  const o = c.sent.find((x) => x.url.includes('openai'));
  check('comic: OpenAI gets a multipart edit with the photo', o && /multipart\/form-data; boundary=/.test(o.headers['Content-Type']) && o.body.includes(Buffer.from('fake-jpeg')));
}

{
  /* the newest model is not open to this key: the next one draws */
  const c = setup();
  const orig = c.helpers.httpRequest;
  c.helpers.httpRequest = async (req) => {
    if (/gemini-3\.1-flash-image(-preview)?:/.test(req.url)) { c.sent.push(req); const e = new Error('models/x is not found'); e.httpCode = 404; throw e; }
    return orig(req);
  };
  const r = await call(c, { mode: 'character', provider: 'gemini', images: [PHOTO] });
  check('comic: an unavailable model falls back to the next one', r.code === 200 && /gemini-2\.5-flash-image/.test(c.sent[c.sent.length - 1].url) && r.body.model === 'gemini-2.5-flash-image');
}

{
  const c = setup({ geminiFails: true });
  const r = await call(c, { mode: 'character', provider: 'gemini', images: [PHOTO] });
  check('comic: an explicit Gemini choice does not switch models', r.code === 502 && !c.sent.some((x) => x.url.includes('openai')));
}

{
  const c = setup({ gemini: false });
  const r = await call(c, { mode: 'scene', provider: 'gemini', images: [PHOTO, PHOTO] });
  check('comic: asking for a model without a key -> 503', r.code === 503);
  const r2 = await call(c, { mode: 'scene', provider: 'openai', images: [PHOTO, PHOTO] }, { ip: '2.2.2.2' });
  check('comic: OpenAI works on its own', r2.code === 200 && r2.body.provider === 'openai');
}

{
  const c = setup();
  let lim = 0;
  for (let i = 0; i < 40; i++) { const r = await call(c, { mode: 'character', images: [PHOTO] }, { ip: '9.9.9.9' }); if (r.code === 429) lim++; }
  check('comic: one address is rate limited', lim >= 10, lim);
  let cap = 0;
  for (let i = 0; i < 260; i++) { const r = await call(c, { mode: 'character', images: [PHOTO] }, { ip: '10.1.' + (i % 250) + '.' + Math.floor(i / 250) }); if (r.code === 429 && r.body.error === 'quota') cap++; }
  check('comic: a daily cap protects the image bill', cap > 0, cap);
  T += 86400000 + 1;
  const r = await call(c, { mode: 'character', images: [PHOTO] }, { ip: '7.7.7.7' });
  check('comic: the cap resets the next day', r.code === 200);
}

{
  const wf = workflow('hasadna-comic.json');
  check('comic: executions are not saved (photos stay private)', wf.settings.saveDataSuccessExecution === 'none' && wf.settings.saveDataErrorExecution === 'none');
  const resp = wf.nodes.find((n) => n.name === 'Comic · Respond');
  const acao = resp.parameters.options.responseHeaders.entries.find((e) => e.name === 'Access-Control-Allow-Origin');
  check('comic: CORS is only for the site', acao.value === SITE);
  check('comic: no key in the workflow file', !/AIza[\w-]{30}|sk-(proj-)?[\w-]{30}/.test(JSON.stringify(wf)));
}
