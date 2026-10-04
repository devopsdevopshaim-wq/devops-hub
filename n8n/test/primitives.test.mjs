import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, check, crypto } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEC = fs.readFileSync(path.join(here, '..', 'snippets', 'security.js'), 'utf8');
const probe = SEC + `
const sd = {}, now = 1700000000000;
return [{ json: { sha: sha256hex(String($json.s)), hm: toHex(hmacSha1(utf8($json.k), utf8($json.m))), h2: hmacSha256Hex($json.k, $json.m),
  t: totpAt($json.secret, $json.step), step: totpStep($json.secret, $json.code, $json.at), same1: same('abc', 'abc'), same2: same('abc', 'abd'), same3: same('abc', 'ab'),
  r: rnd(16).length } }];`;

for (const noCrypto of [false, true]) {
  const tag = noCrypto ? '[pure JS] ' : '[node crypto] ';
  for (const s of ['', 'abc', 'שלום עולם', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000)]) {
    const r = (await run(probe, { json: { s, k: 'k', m: 'm', secret: 'JBSWY3DPEHPK3PXP', step: 1, code: '000000', at: 0 }, noCrypto }))[0].json;
    check(tag + 'sha256 ' + s.length, r.sha === crypto.createHash('sha256').update(s).digest('hex'));
  }
  for (const [k, m] of [['key', 'The quick brown fox'], ['k'.repeat(100), 'm'], ['', '']]) {
    const r = (await run(probe, { json: { s: '', k, m, secret: 'JBSWY3DPEHPK3PXP', step: 1, code: '000000', at: 0 }, noCrypto }))[0].json;
    check(tag + 'hmac-sha1 ' + k.length, r.hm === crypto.createHmac('sha1', k).update(m).digest('hex'));
    check(tag + 'hmac-sha256 ' + k.length, r.h2 === crypto.createHmac('sha256', k).update(m).digest('hex'));
  }
  // RFC 6238 test vector: secret "12345678901234567890", T=59s -> 94287082 (8 digits) so 6 digits = 287082
  const b32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const v = (await run(probe, { json: { s: '', k: '', m: '', secret: b32, step: Math.floor(59 / 30), code: '287082', at: 59000 }, noCrypto }))[0].json;
  check(tag + 'totp rfc6238', v.t === '287082', v.t);
  check(tag + 'totp accepted', v.step === 1, v.step);
  const bad = (await run(probe, { json: { s: '', k: '', m: '', secret: b32, step: 1, code: '123456', at: 59000 }, noCrypto }))[0].json;
  check(tag + 'totp rejects a wrong code', bad.step === 0);
  const old = (await run(probe, { json: { s: '', k: '', m: '', secret: b32, step: 1, code: '287082', at: 59000 + 120000 }, noCrypto }))[0].json;
  check(tag + 'totp rejects an old code', old.step === 0);
  check(tag + 'same()', v.same1 && !v.same2 && !v.same3);
}
// no randomness source at all -> must refuse, never Math.random
const nr = SEC + `\nconst sd = {}, now = 1; try { rnd(8); return [{ json: { threw: false } }]; } catch (e) { return [{ json: { threw: true } }]; }`;
const savedCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
const t = (await run(nr, { json: {}, noCrypto: true }))[0].json;
if (savedCrypto) Object.defineProperty(globalThis, 'crypto', savedCrypto);
check('rnd refuses without a secure source', t.threw === true);
