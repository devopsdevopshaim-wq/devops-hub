// ---- SPIDER security prelude: pasted at the top of every public Code node (see build-*.py).
// Needs, declared by the node after this block: `sd` (static data) and `now` (Date.now()).
// Origin: only the portfolio's own pages may call the webhooks from a browser.
//   (Non-browser clients send no Origin; they get nothing extra: rate limits and tokens still apply.)
const SITE_ORIGIN = 'https://devopsdevopshaim-wq.github.io';
const HDR = ($json.headers || {});
const ORIGIN = String(HDR.origin || '');
const ORIGIN_OK = !ORIGIN || ORIGIN === SITE_ORIGIN;
// the address added last by the proxy in front of n8n; a client cannot forge that one
const IP = (() => {
  const x = String(HDR['x-forwarded-for'] || HDR['x-real-ip'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (x[x.length - 1] || 'unknown').slice(0, 64);
})();

let _c = null; try { _c = require('crypto'); } catch (e) { _c = null; }
const _w = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) ? globalThis.crypto : null;
const utf8 = (s) => { const o = []; const u = unescape(encodeURIComponent(String(s))); for (let i = 0; i < u.length; i++) o.push(u.charCodeAt(i)); return o; };
const toHex = (a) => a.map((x) => (x & 255).toString(16).padStart(2, '0')).join('');

// secure random bytes as hex; never falls back to Math.random
function rnd(n) {
  if (_c && _c.randomBytes) return _c.randomBytes(n).toString('hex');
  if (_w) { const a = new Uint8Array(n); _w.getRandomValues(a); return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(''); }
  throw new Error('no secure random source');
}
function sha256js(m) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const b = m.slice(), bits = m.length * 8;
  b.push(0x80); while (b.length % 64 !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < b.length; o += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = ((b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = []; H.forEach((x) => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return out;
}
function sha1js(m) {
  const b = m.slice(), bits = m.length * 8;
  b.push(0x80); while (b.length % 64 !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const rl = (x, n) => (x << n) | (x >>> (32 - n));
  for (let o = 0; o < b.length; o += 64) {
    const w = new Array(80);
    for (let i = 0; i < 16; i++) w[i] = ((b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 80; i++) w[i] = rl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1) >>> 0;
    let a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (bb & c) | (~bb & d); k = 0x5a827999; } else if (i < 40) { f = bb ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8f1bbcdc; } else { f = bb ^ c ^ d; k = 0xca62c1d6; }
      const t = (rl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rl(bb, 30) >>> 0; bb = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = []; [h0, h1, h2, h3, h4].forEach((x) => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return out;
}
function sha256hex(s) {
  if (_c && _c.createHash) return _c.createHash('sha256').update(String(s)).digest('hex');
  return toHex(sha256js(utf8(s)));
}
function hmacSha1(key, msg) {
  if (_c && _c.createHmac) return Array.from(_c.createHmac('sha1', Buffer.from(key)).update(Buffer.from(msg)).digest());
  let k = key.slice(); if (k.length > 64) k = sha1js(k); while (k.length < 64) k.push(0);
  return sha1js(k.map((x) => x ^ 0x5c).concat(sha1js(k.map((x) => x ^ 0x36).concat(msg))));
}
function hmacSha256Hex(key, msg) {
  if (_c && _c.createHmac) return _c.createHmac('sha256', String(key)).update(String(msg)).digest('hex');
  let k = utf8(key); if (k.length > 64) k = sha256js(k); while (k.length < 64) k.push(0);
  return toHex(sha256js(k.map((x) => x ^ 0x5c).concat(sha256js(k.map((x) => x ^ 0x36).concat(utf8(msg))))));
}
// constant-time comparison of two strings
function same(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// one-time codes from an authenticator app (RFC 6238, 6 digits, 30 seconds)
function b32bytes(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; const o = [];
  for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.substr(i, 8), 2));
  return o;
}
function totpAt(secret, step) {
  const msg = [0, 0, 0, 0, (step >>> 24) & 255, (step >>> 16) & 255, (step >>> 8) & 255, step & 255];
  const h = hmacSha1(b32bytes(secret), msg), o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}
// the step the code belongs to (a minute of clock drift is fine), or 0
function totpStep(secret, code, t) {
  const cur = Math.floor(t / 30000);
  for (const d of [0, -1, 1]) if (same(totpAt(secret, cur + d), String(code).replace(/\D/g, ''))) return cur + d;
  return 0;
}

// at most `limit` hits per `ms` for this key; a refused hit is not counted
function hit(bucket, key, limit, ms) {
  sd.rl = sd.rl || {};
  const k = bucket + ':' + key;
  const arr = (sd.rl[k] || []).filter((t) => now - t < ms);
  const ok = arr.length < limit;
  if (ok) arr.push(now);
  if (arr.length) sd.rl[k] = arr; else delete sd.rl[k];
  return ok;
}
function sweep() {
  const keys = Object.keys(sd.rl || {});
  if (keys.length > 2000) for (const k of keys) { const a = sd.rl[k]; if (!a.length || now - a[a.length - 1] > 86400000) delete sd.rl[k]; }
}
const ipKey = () => sha256hex('ip:' + IP).slice(0, 16);
// ---- end of the security prelude
