import { run, check, workflow, nodeCode } from './harness.mjs';
const SITE = 'https://devopsdevopshaim-wq.github.io';
let T = 1_800_000_000_000; Date.now = () => T;

// ---- voice
{
  const code = nodeCode(workflow('hasadna-voice.json'), 'Voice · Speak');
  const sd = {};
  let sent = 0;
  const helpers = { httpRequest: async () => { sent++; return Buffer.from('mp3'); } };
  const call = async (text, origin, ip = '1.2.3.4', key = true) => (await run(key ? code.replace('__AZURE_SPEECH_KEY__', 'k'.repeat(32)) : code, { json: { body: { text }, headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}) } }, sd, helpers }))[0].json;
  let r = await call('שלום', null);
  check('voice: a call with no Origin is refused', r.code === 403 && !sent);
  r = await call('שלום', 'https://evil.example');
  check('voice: a foreign Origin is refused', r.code === 403 && !sent);
  r = await call('שלום', SITE, '1.2.3.4', false);
  check('voice: no key set -> 503 no-voice', r.code === 503 && r.body.error === 'no-voice');
  r = await call('שלום <b>&"', SITE);
  check('voice: the site gets the audio', r.code === 200 && r.body.ok && r.body.audio === Buffer.from('mp3').toString('base64'));
  let lim = 0; for (let i = 0; i < 50; i++) { const x = await call('שלום', SITE, '9.9.9.9'); if (x.code === 429) lim++; }
  check('voice: one address is rate limited', lim >= 8, lim);
}

// ---- agents: who may ask Maya
{
  const wf = workflow('hasadna-multi-agent.json');
  const norm = nodeCode(wf, 'Agents · Normalize');
  const sd = {};
  const ask = async (q, { origin = SITE, ip = '3.3.3.3', session = 's1' } = {}) => (await run(norm, { json: { body: JSON.stringify({ question: q, sessionId: session }), headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}) } }, sd }))[0].json;
  let r = await ask('שלום');
  check('agents: the site may ask', r.blocked === '' && r.source === 'site');
  r = await ask('שלום', { origin: 'https://evil.example' });
  check('agents: a foreign Origin is blocked', r.blocked === 'forbidden');
  let n = 0; for (let i = 0; i < 20; i++) { const x = await ask('q' + i, { ip: '4.4.4.4', session: 's' + i }); if (x.blocked === 'limit') n++; }
  check('agents: one address is limited to 15 questions an hour', n === 5, n);
  let m = 0; for (let i = 0; i < 60; i++) { const x = await ask('q', { ip: '5.5.5.5', session: 'same' }); if (x.blocked === 'limit') m++; }
  check('agents: one session is limited too', m > 0);
  let g = 0; for (let i = 0; i < 260; i++) { const x = await ask('q', { ip: '10.0.' + (i % 250) + '.' + Math.floor(i / 250), session: 'u' + i }); if (x.blocked === 'limit') g++; }
  check('agents: a daily cap protects the Claude bill', g > 0, g);
  T += 86400000 + 1;
  r = await ask('שלום', { ip: '7.7.7.7', session: 'new' });
  check('agents: the cap resets the next day', r.blocked === '');
  r = await ask('x'.repeat(5000), { ip: '8.8.8.8' });
  check('agents: long questions are cut', r.question.length === 1500);
  const wfNodes = wf.nodes.map((x) => x.name);
  check('agents: the public chat page is off', wf.nodes.find((x) => x.name === 'Team chat').parameters.public === false);
  check('agents: a blocked question gets a polite answer', wfNodes.includes('Allowed?') && wfNodes.includes('Guy · Blocked'));
  const fresh = nodeCode(wf, 'Status · Fresh?');
  const mk = (age, run) => run_(fresh, age, run);
  async function run_(code, ageMin, runFlag) { return (await run(code, { json: { query: runFlag ? { run: '1' } : {} }, sd: { status: { checkedAt: new Date(T - ageMin * 60000).toISOString() } } }))[0].json.fresh; }
  check('status: ?run=1 is ignored within 2 minutes', (await mk(1, true)) === true);
  check('status: ?run=1 works after 2 minutes', (await mk(3, true)) === false);
  check('status: old data is refreshed', (await mk(30, false)) === false);
}
