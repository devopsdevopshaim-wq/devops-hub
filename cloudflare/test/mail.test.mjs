// The mailbox module against a pretend Google (fetch is replaced): connect, count, filter, delete, keep, folder, rules, disconnect.
import * as nodeCrypto from 'node:crypto';
import { mailHandle, mailCallback } from '../src/mail.mjs';
let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } else console.log('ok  ', n); };

const env = { GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'GOCSPX-test-secret-value-1234' };
const token = 'a'.repeat(48);
const sd = { sessions: { [nodeCrypto.createHash('sha256').update(token).digest('hex')]: { email: 'c@example.com', role: 'client', exp: Date.now() + 1e6 } },
  clients: { 'c@example.com': { email: 'c@example.com', active: true } } };
const st = { sd };

const MSGS = {
  '18f3a1b2c3d4e5f1': { id: '18f3a1b2c3d4e5f1', threadId: 't1', internalDate: String(Date.now()), labelIds: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'], snippet: 'מבצע', payload: { headers: [{ name: 'From', value: '"Shop" <deals@shop.com>' }, { name: 'Subject', value: 'מבצע ענק' }] } },
  '18f3a1b2c3d4e5f2': { id: '18f3a1b2c3d4e5f2', threadId: 't2', internalDate: String(Date.now()), labelIds: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'], snippet: 'שלום', payload: { headers: [{ name: 'From', value: 'Dana <dana@example.com>' }, { name: 'Subject', value: 'פגישה מחר' }] } }
};
const calls = [];
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); calls.push((opt.method || 'GET') + ' ' + url.replace(/\?.*/, ''));
  const J = (o, c = 200) => new Response(JSON.stringify(o), { status: c });
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const p = new URLSearchParams(String(opt.body));
    return p.get('grant_type') === 'authorization_code' ? J({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify' }) : J({ access_token: 'AT2', expires_in: 3600 });
  }
  if (url.endsWith('/profile')) return J({ emailAddress: 'c@gmail.com' });
  if (/\/labels\/[A-Z_]+$/.test(url)) return J({ messagesUnread: url.includes('PROMOTIONS') ? 7 : url.includes('INBOX') ? 12 : 2, messagesTotal: 100 });
  if (url.endsWith('/labels') && !opt.method) return J({ labels: [] });
  if (url.endsWith('/labels') && opt.method === 'POST') return J({ id: 'Label_9' });
  if (/\/messages\?/.test(url)) { const q = decodeURIComponent(url); return J({ messages: q.includes('category:promotions') ? [{ id: '18f3a1b2c3d4e5f1' }] : [{ id: '18f3a1b2c3d4e5f1' }, { id: '18f3a1b2c3d4e5f2' }], resultSizeEstimate: 2 }); }
  if (/\/messages\/18f3a1b2c3d4e5f\d\?format/.test(url)) return J(MSGS[url.match(/messages\/(18f3a1b2c3d4e5f\d)/)[1]]);
  if (/\/trash$/.test(url)) return J({});
  if (url.endsWith('/batchModify')) return new Response(null, { status: 204 });
  return J({ error: 'unexpected ' + url }, 500);
};
const origin = 'https://spider.test';
let r = await mailHandle(env, st, { action: 'status', token: 'b'.repeat(48) }, origin);
check('a stranger is refused', r.code === 401);
r = await mailHandle({}, st, { action: 'status', token }, origin);
check('without Google keys the feature says it is not available', r.body.available === false);
r = await mailHandle(env, st, { action: 'status', token }, origin);
check('not connected yet', r.body.connected === false && r.body.available === true, r.body);
r = await mailHandle(env, st, { action: 'connect', token }, origin);
check('connect gives Google consent address with the mail scope and offline access', /accounts\.google\.com/.test(r.body.url) && /gmail\.modify/.test(decodeURIComponent(r.body.url)) && /access_type=offline/.test(r.body.url), r.body);
const state = new URL(r.body.url).searchParams.get('state');
let cb = await mailCallback(env, st, new URL(origin + '/hasadna-mail-callback?code=abc&state=bad'), origin);
check('a callback with an unknown state is refused', /mail=expired/.test(cb.redirect));
cb = await mailCallback(env, st, new URL(origin + '/hasadna-mail-callback?code=abc&state=' + state), origin);
check('the callback connects and returns to the portfolio', /mail=connected/.test(cb.redirect) && !!sd.mail['c@example.com'], cb);
check('the token is kept encrypted, not in the clear', !JSON.stringify(sd.mail).includes('RT1') && sd.mail['c@example.com'].rt.startsWith('v1.'));
cb = await mailCallback(env, st, new URL(origin + '/hasadna-mail-callback?code=abc&state=' + state), origin);
check('a state works once', /mail=expired/.test(cb.redirect));

r = await mailHandle(env, st, { action: 'status', token }, origin);
check('status: unread count and filters', r.body.connected && r.body.unread === 12 && r.body.counts.promotions === 7 && r.body.filters.promotions === 'פרסומות', r.body);
check('status never carries a token', !/RT1|AT1|AT2/.test(JSON.stringify(r.body)));
r = await mailHandle(env, st, { action: 'list', token, filter: 'promotions' }, origin);
check('list a filter', r.body.ok && r.body.rows.length === 1 && r.body.rows[0].from === 'Shop' && r.body.rows[0].unread && r.body.rows[0].cat === 'promotions', r.body);
r = await mailHandle(env, st, { action: 'act', token, op: 'trash', ids: JSON.stringify(['18f3a1b2c3d4e5f1']) }, origin);
check('delete = Gmail trash', r.body.ok && r.body.done === 1 && calls.includes('POST https://gmail.googleapis.com/gmail/v1/users/me/messages/18f3a1b2c3d4e5f1/trash'), r.body);
r = await mailHandle(env, st, { action: 'act', token, op: 'trash', ids: JSON.stringify(['../evil']) }, origin);
check('odd ids are dropped', r.body.ok === false);
r = await mailHandle(env, st, { action: 'act', token, op: 'keep', ids: JSON.stringify(['18f3a1b2c3d4e5f2']) }, origin);
check('keep marks read and leaves it', r.body.ok && r.body.done === 1);
r = await mailHandle(env, st, { action: 'act', token, op: 'folder', folder: 'חשבונות', ids: JSON.stringify(['18f3a1b2c3d4e5f2']) }, origin);
check('move to a folder of their own (a Gmail label)', r.body.ok && r.body.folders.includes('חשבונות') && calls.includes('POST https://gmail.googleapis.com/gmail/v1/users/me/labels'), r.body);
r = await mailHandle(env, st, { action: 'rules-set', token, auto: '1', folders: JSON.stringify(['חשבונות']), rules: JSON.stringify([{ name: 'פרסומות לפח', cat: 'promotions', action: 'trash' }, { name: 'דנה', from: 'dana@', action: 'folder', folder: 'לא קיימת' }, { name: 'ריקה', action: 'trash' }]) }, origin);
check('rules saved; a folder that does not exist falls back to keep', r.body.ok && r.body.rules.length === 3 && r.body.rules[1].action === 'keep' && r.body.auto === true, r.body);
r = await mailHandle(env, st, { action: 'apply', token }, origin);
check('applying rules: the promotions rule trashes, the empty rule does nothing', r.body.ok && r.body.trashed === 1, r.body);
r = await mailHandle(env, st, { action: 'disconnect', token }, origin);
check('disconnect forgets the mailbox', r.body.connected === false && !sd.mail['c@example.com']);
sd.sessions[nodeCrypto.createHash('sha256').update(token).digest('hex')].exp = Date.now() - 1;
r = await mailHandle(env, st, { action: 'status', token }, origin);
check('an expired session is refused', r.code === 401);
process.exit(bad ? 1 : 0);
