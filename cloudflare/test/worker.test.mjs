// End-to-end check of the Worker against a running `wrangler dev --local` (URL in WORKER_URL, default http://localhost:8787).
// The admin password for the test is "Test-Passw0rd-xyz" (the hash is in .dev.vars, made by test/hash.mjs).
const URL_ = process.env.WORKER_URL || 'http://localhost:8787';
const SITE = 'https://devopsdevopshaim-wq.github.io';
const RUN = Date.now();
const PW = 'Test-Passw0rd-xyz', ADMIN = 'devopsdevopshaim@gmail.com';
let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } else console.log('ok  ', n); };
async function call(b, { origin = SITE, ip = '10.1.1.1' } = {}) {
  const r = await fetch(URL_ + '/hasadna-auth', { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b) });
  return { code: r.status, body: await r.json().catch(() => null), headers: r.headers };
}
let r = await fetch(URL_ + '/hasadna-auth', { method: 'OPTIONS', headers: { Origin: SITE } });
check('preflight answers for the site', r.status === 204 && r.headers.get('access-control-allow-origin') === SITE);
r = await call({ action: 'info' });
check('info answers', r.body.ok === true && r.headers.get('access-control-allow-origin') === SITE);
r = await call({ action: 'info' }, { origin: 'https://evil.example' });
check('a foreign site is refused', r.code === 403);
r = await call({ action: 'login', email: ADMIN, password: 'wrong-password-123', device: 'a'.repeat(32) });
check('a wrong password is refused', r.body.ok === false && r.code === 401, r);
r = await call({ action: 'login', email: ADMIN, password: PW, device: 'a'.repeat(32) });
check('the admin signs in with the secret password', r.body.ok === true && /^[a-f0-9]{48}$/.test(r.body.token), r);
const token = r.body.token;
r = await call({ action: 'me', token });
check('me', r.body.ok && r.body.role === 'admin');
r = await call({ action: 'clients', token });
check('the clients list is admin only and works', r.body.ok === true);
r = await call({ action: 'clients', token: 'b'.repeat(48) });
check('... and closed without the token', r.code === 403);
// a visitor's tracking, presence, stats, plan, vault
await call({ action: 'track', vid: 'visitor12345', events: JSON.stringify([{ ev: 'view', page: '/portfolio/?x=1', ref: 'https://www.google.com/' }, { ev: 'open', app: 'finance-hub' }]) }, { ip: '10.2.2.2' });
r = await call({ action: 'stats-get', token, days: '7' });
check('stats count the visit', r.body.ok && r.body.days.reduce((a, d) => a + d.v, 0) >= 1 && r.body.apps.some((x) => x[0] === 'finance-hub'));
r = await call({ action: 'presence', token });
check('presence answers', r.body.ok === true && typeof r.body.members === 'number');
r = await call({ action: 'plan-set', token, blob: '{"a":1}' });
r = await call({ action: 'plan-get', token });
check('the plan is kept', r.body.blob === '{"a":1}');
r = await call({ action: 'ai-vault-set', token, blob: '{"gemini":{"key":"k"}}' });
r = await call({ action: 'ai-vault-get', token });
check('the vault is kept', r.body.blob.includes('gemini'));
// a client signs up (no mail provider here: the answer must still come)
r = await call({ action: 'signup', email: `new.${RUN}@example.com`, name: 'לקוח חדש' }, { ip: '10.3.3.3' });
check('sign-up works without a mail provider', r.body.ok === true, r);
r = await call({ action: 'clients', token });
check('the new client is listed', r.body.clients.some((c) => c.email === `new.${RUN}@example.com`));
r = await call({ action: 'clients-import', token, payload: JSON.stringify([{ email: `moved.${RUN}@example.com`, name: 'עבר', sites: ['x'] }]) });
check('clients can be imported from the old server', r.body.ok && r.body.added === 1, r.body);
r = await call({ action: 'logout', token });
r = await call({ action: 'me', token });
check('after logout the token is dead', r.code === 401);
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
