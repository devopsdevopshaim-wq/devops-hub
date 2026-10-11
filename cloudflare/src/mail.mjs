// A client's own mailbox, inside SPIDER: the client connects their Gmail once (Google's consent screen, their own choice), and gets a count
// of what waits for them, smart filters, and control over every message: delete (to Gmail's trash, recoverable 30 days), keep, move to a
// folder of their own, mark read — plus rules that sort what arrives. Nothing is sent from here and nothing is deleted for good.
// The refresh token is kept encrypted (AES-GCM, key from MAIL_KEY or the Google client secret); it is never sent to a page.
import * as nodeCrypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email';
const GM = 'https://gmail.googleapis.com/gmail/v1/users/me';
const PREFIX = 'SPIDER/';
const MAX_RULES = 30, MAX_FOLDERS = 20;
const sha256 = (s) => nodeCrypto.createHash('sha256').update(s).digest('hex');
const now = () => Date.now();

const key = (env) => nodeCrypto.createHash('sha256').update('spider-mail|' + (env.MAIL_KEY || env.GOOGLE_CLIENT_SECRET || '')).digest();
const enc = (env, text) => { const iv = nodeCrypto.randomBytes(12), c = nodeCrypto.createCipheriv('aes-256-gcm', key(env), iv); const d = Buffer.concat([c.update(text, 'utf8'), c.final()]); return 'v1.' + Buffer.concat([iv, c.getAuthTag(), d]).toString('base64'); };
const dec = (env, s) => { const b = Buffer.from(String(s).replace(/^v1\./, ''), 'base64'); const d = nodeCrypto.createDecipheriv('aes-256-gcm', key(env), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };

const configured = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const redirectUri = (env, origin) => origin + '/hasadna-mail-callback';

async function gfetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* not json */ }
  return { ok: r.ok, status: r.status, j: j || {}, t };
}

// the signed-in person: a client with a live subscription, or the admin; never a session that still has to choose a password
function who(sd, token) {
  const t = String(token || '');
  if (!/^[a-f0-9]{48}$/.test(t)) return null;
  const s = (sd.sessions || {})[sha256(t)];
  if (!s || s.exp <= now() || s.mc) return null;
  if (s.role === 'client') { const c = (sd.clients || {})[s.email]; if (!c || c.active === false || (c.expiresAt && Date.parse(c.expiresAt) <= now())) return null; }
  return { email: s.email, role: s.role };
}

async function accessToken(env, sd, email) {
  const m = sd.mail[email];
  if (m.at && m.at.exp > now() + 60000) return m.at.t;
  let rt; try { rt = dec(env, m.rt); } catch (e) { return null; }
  const r = await gfetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }) });
  if (!r.ok || !r.j.access_token) {
    if (r.j.error === 'invalid_grant') { m.broken = true; m.at = null; }   // revoked, or expired (an unverified Google app lets tokens live 7 days)
    return null;
  }
  m.broken = false; m.at = { t: r.j.access_token, exp: now() + (r.j.expires_in || 3000) * 1000 };
  return m.at.t;
}

const hdr = (msg, n) => { const h = ((msg.payload || {}).headers || []).find((x) => x.name.toLowerCase() === n); return h ? h.value : ''; };
const sender = (v) => { const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(v || ''); return m ? { name: m[1].trim() || m[2], addr: m[2].toLowerCase() } : { name: (v || '').trim(), addr: (v || '').trim().toLowerCase() }; };
const shape = (m) => { const f = sender(hdr(m, 'from')); const L = m.labelIds || []; return { id: m.id, thread: m.threadId, from: f.name, addr: f.addr, subject: hdr(m, 'subject') || '(בלי נושא)', snippet: (m.snippet || '').slice(0, 160),
  date: m.internalDate ? new Date(+m.internalDate).toISOString() : '', unread: L.includes('UNREAD'), starred: L.includes('STARRED'), cat: (L.find((x) => /^CATEGORY_/.test(x)) || '').replace('CATEGORY_', '').toLowerCase(), att: false }; };

// the smart filters: what Gmail already knows (its tabs) plus plain ones in Hebrew
const FILTERS = {
  inbox: { he: 'הכול', q: 'in:inbox' },
  unread: { he: 'לא נקראו', q: 'in:inbox is:unread' },
  primary: { he: 'אישיים', q: 'in:inbox category:primary' },
  bills: { he: 'חשבונות וקבלות', q: 'in:inbox (subject:(חשבונית OR קבלה OR חשבון OR תשלום OR invoice OR receipt OR bill OR payment) OR from:(billing OR invoice OR noreply@paypal.com))' },
  promotions: { he: 'פרסומות', q: 'in:inbox category:promotions' },
  social: { he: 'רשתות חברתיות', q: 'in:inbox category:social' },
  updates: { he: 'עדכונים', q: 'in:inbox category:updates' },
  forums: { he: 'קבוצות', q: 'in:inbox category:forums' },
  attach: { he: 'עם קבצים', q: 'in:inbox has:attachment' },
  starred: { he: 'מסומנים', q: 'is:starred' }
};
const cleanQ = (s) => String(s || '').replace(/[\r\n]/g, ' ').slice(0, 200);

async function labelId(env, sd, email, tok, name, create) {
  const m = sd.mail[email];
  m.lab = m.lab || {};
  if (m.lab[name]) return m.lab[name];
  const full = PREFIX + name;
  const r = await gfetch(GM + '/labels', { headers: { Authorization: 'Bearer ' + tok } });
  const hit = (r.j.labels || []).find((l) => l.name === full);
  if (hit) return (m.lab[name] = hit.id);
  if (!create) return null;
  const c = await gfetch(GM + '/labels', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: full, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) });
  return c.j.id ? (m.lab[name] = c.j.id) : null;
}

async function listMessages(tok, q, max, page) {
  const u = GM + '/messages?maxResults=' + max + '&q=' + encodeURIComponent(q) + (page ? '&pageToken=' + encodeURIComponent(page) : '');
  const r = await gfetch(u, { headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok) return { err: r.status, ids: [], est: 0 };
  const ids = (r.j.messages || []).map((x) => x.id);
  const rows = await Promise.all(ids.map((id) => gfetch(GM + '/messages/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject', { headers: { Authorization: 'Bearer ' + tok } }).then((x) => (x.ok ? shape(x.j) : null))));
  return { rows: rows.filter(Boolean), next: r.j.nextPageToken || '', est: r.j.resultSizeEstimate || 0 };
}
async function countQ(tok, q) {
  const r = await gfetch(GM + '/messages?maxResults=1&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + tok } });
  return r.ok ? (r.j.resultSizeEstimate || (r.j.messages ? 1 : 0)) : 0;
}

async function modify(tok, ids, add, remove) {
  const r = await gfetch(GM + '/messages/batchModify', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, addLabelIds: add, removeLabelIds: remove }) });
  return r.ok;
}
async function trash(tok, ids) {
  const res = await Promise.all(ids.map((id) => gfetch(GM + '/messages/' + id + '/trash', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }).then((x) => x.ok)));
  return res.filter(Boolean).length;
}

// does a rule match a message?  (every filled field must match; text is a plain, case-free "contains")
const has = (hay, needle) => !needle || String(hay || '').toLowerCase().includes(String(needle).toLowerCase());
const ruleHit = (r, m) => (r.from || r.subject || r.text || r.cat) && has(m.addr + ' ' + m.from, r.from) && has(m.subject, r.subject) && has(m.from + ' ' + m.subject + ' ' + m.snippet, r.text) && (!r.cat || m.cat === r.cat);

async function applyRules(env, sd, email, tok) {
  const m = sd.mail[email], rules = (m.rules || []).filter((r) => r.on !== false);
  if (!rules.length) return { moved: 0, trashed: 0, read: 0 };
  const lst = await listMessages(tok, 'in:inbox newer_than:30d', 50, '');
  const out = { moved: 0, trashed: 0, read: 0 }, byFolder = {}, del = [], rd = [];
  for (const msg of lst.rows || []) {
    const r = rules.find((x) => ruleHit(x, msg));
    if (!r || r.action === 'keep') continue;
    if (r.action === 'trash') del.push(msg.id);
    else if (r.action === 'read') rd.push(msg.id);
    else if (r.action === 'folder' && r.folder) (byFolder[r.folder] = byFolder[r.folder] || []).push(msg.id);
  }
  if (del.length) out.trashed = await trash(tok, del);
  if (rd.length && (await modify(tok, rd, [], ['UNREAD']))) out.read = rd.length;
  for (const [f, ids] of Object.entries(byFolder)) {
    const id = await labelId(env, sd, email, tok, f, true);
    if (id && (await modify(tok, ids, [id], ['INBOX']))) out.moved += ids.length;
  }
  m.lastApply = new Date().toISOString(); m.lastApplyAt = now();
  return out;
}

const sanitizeRule = (r, folders) => {
  const s = (v, n) => String(v == null ? '' : v).replace(/[\r\n]/g, ' ').trim().slice(0, n);
  const o = { id: s(r.id, 12) || nodeCrypto.randomBytes(5).toString('hex'), name: s(r.name, 40), from: s(r.from, 80), subject: s(r.subject, 80), text: s(r.text, 80), cat: /^(primary|promotions|social|updates|forums)$/.test(r.cat) ? r.cat : '',
    action: /^(trash|folder|read|keep)$/.test(r.action) ? r.action : 'keep', folder: s(r.folder, 30), on: r.on !== false };
  if (o.action === 'folder' && !folders.includes(o.folder)) o.action = 'keep';
  return o;
};

export async function mailHandle(env, st, body, origin) {
  const sd = st.sd; sd.mail = sd.mail || {};
  const act = String(body.action || '');
  const w = who(sd, body.token);
  if (!w) return { code: 401, body: { ok: false, error: 'signed-out' } };
  if (!configured(env)) return { code: 200, body: { ok: true, available: false, connected: false } };
  const email = w.email, m = sd.mail[email];

  if (act === 'connect') {
    sd.mailState = sd.mailState || {};
    for (const [k, v] of Object.entries(sd.mailState)) if (v.exp < now()) delete sd.mailState[k];
    const state = nodeCrypto.randomBytes(18).toString('hex');
    sd.mailState[state] = { email, exp: now() + 15 * 60000 };
    const u = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(env, origin), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state, login_hint: email });
    return { code: 200, body: { ok: true, url: u } };
  }
  if (!m) return { code: 200, body: { ok: true, available: true, connected: false } };

  if (act === 'disconnect') {
    try { const rt = dec(env, m.rt); await gfetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: rt }) }); } catch (e) { /* revoking is best effort */ }
    delete sd.mail[email];
    return { code: 200, body: { ok: true, connected: false } };
  }

  if (act === 'rules-set') {
    const folders = Array.isArray(body.folders) ? body.folders : null;
    let rules = []; try { rules = JSON.parse(body.rules || '[]'); } catch (e) { rules = []; }
    if (typeof body.folders === 'string') { try { m.folders = JSON.parse(body.folders).map((x) => String(x).replace(/[\/\r\n]/g, ' ').trim().slice(0, 30)).filter(Boolean).slice(0, MAX_FOLDERS); } catch (e) { /* keep */ } }
    m.rules = rules.slice(0, MAX_RULES).map((r) => sanitizeRule(r, m.folders || []));
    if (body.auto != null) m.auto = body.auto === '1' || body.auto === true || body.auto === 'true';
    return { code: 200, body: { ok: true, rules: m.rules, folders: m.folders || [], auto: !!m.auto } };
  }

  const tok = await accessToken(env, sd, email);
  if (!tok) return { code: 200, body: { ok: true, available: true, connected: true, broken: true, gmail: m.gmail } };

  if (act === 'status') {
    let applied = null;
    if (m.auto && (!m.lastApplyAt || now() - m.lastApplyAt > 5 * 60000)) applied = await applyRules(env, sd, email, tok);
    const lab = async (id) => { const r = await gfetch(GM + '/labels/' + id, { headers: { Authorization: 'Bearer ' + tok } }); return r.ok ? { unread: r.j.messagesUnread || 0, total: r.j.messagesTotal || 0 } : { unread: 0, total: 0 }; };
    const [inbox, prim, promo, soc, upd, frm, bills, att] = await Promise.all([lab('INBOX'), lab('CATEGORY_PERSONAL'), lab('CATEGORY_PROMOTIONS'), lab('CATEGORY_SOCIAL'), lab('CATEGORY_UPDATES'), lab('CATEGORY_FORUMS'),
      countQ(tok, FILTERS.bills.q + ' is:unread'), countQ(tok, FILTERS.attach.q + ' is:unread')]);
    const counts = { inbox: inbox.total, unread: inbox.unread, primary: prim.unread, promotions: promo.unread, social: soc.unread, updates: upd.unread, forums: frm.unread, bills, attach: att };
    return { code: 200, body: { ok: true, available: true, connected: true, gmail: m.gmail, counts, unread: inbox.unread, filters: Object.fromEntries(Object.entries(FILTERS).map(([k, v]) => [k, v.he])), folders: m.folders || [], rules: m.rules || [], auto: !!m.auto, applied } };
  }

  if (act === 'list') {
    const f = String(body.filter || 'inbox');
    let q;
    if (f.startsWith('folder:')) q = 'label:"' + PREFIX + String(f.slice(7)).replace(/["\\]/g, '') + '"';
    else q = (FILTERS[f] || FILTERS.inbox).q;
    const extra = cleanQ(body.q); if (extra) q += ' ' + extra;
    const r = await listMessages(tok, q, 25, String(body.page || ''));
    if (r.err) return { code: 200, body: { ok: false, error: 'gmail-' + r.err } };
    return { code: 200, body: { ok: true, rows: r.rows, next: r.next } };
  }

  if (act === 'act') {
    let ids = []; try { ids = JSON.parse(body.ids || '[]'); } catch (e) { /* none */ }
    ids = ids.filter((x) => /^[0-9a-f]{8,24}$/.test(x)).slice(0, 50);
    if (!ids.length) return { code: 200, body: { ok: false, error: 'nothing-chosen' } };
    const op = String(body.op || '');
    let n = 0;
    if (op === 'trash') n = await trash(tok, ids);
    else if (op === 'keep') n = (await modify(tok, ids, [], ['UNREAD'])) ? ids.length : 0;   // keep = it stays in the inbox, read
    else if (op === 'read') n = (await modify(tok, ids, [], ['UNREAD'])) ? ids.length : 0;
    else if (op === 'unread') n = (await modify(tok, ids, ['UNREAD'], [])) ? ids.length : 0;
    else if (op === 'star') n = (await modify(tok, ids, ['STARRED'], [])) ? ids.length : 0;
    else if (op === 'unstar') n = (await modify(tok, ids, [], ['STARRED'])) ? ids.length : 0;
    else if (op === 'folder') {
      const name = String(body.folder || '').replace(/[\/\r\n]/g, ' ').trim().slice(0, 30);
      if (!name) return { code: 200, body: { ok: false, error: 'no-folder' } };
      m.folders = m.folders || [];
      if (!m.folders.includes(name)) { if (m.folders.length >= MAX_FOLDERS) return { code: 200, body: { ok: false, error: 'too-many-folders' } }; m.folders.push(name); }
      const id = await labelId(env, sd, email, tok, name, true);
      n = id && (await modify(tok, ids, [id], ['INBOX'])) ? ids.length : 0;
    } else return { code: 400, body: { ok: false, error: 'bad-input' } };
    return { code: n ? 200 : 200, body: { ok: !!n, done: n, folders: m.folders || [] } };
  }

  if (act === 'apply') {
    const r = await applyRules(env, sd, email, tok);
    return { code: 200, body: { ok: true, ...r } };
  }
  return { code: 400, body: { ok: false, error: 'bad-input' } };
}

// Google sends the person back here with ?code=…&state=…  → keep the token (encrypted) and return to the portfolio
export async function mailCallback(env, st, url, origin) {
  const sd = st.sd, site = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/';
  const back = (s) => ({ redirect: site + '?mail=' + s });
  if (!configured(env)) return back('off');
  const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
  const s = sd.mailState && sd.mailState[state];
  if (!s || s.exp < now()) return back('expired');
  delete sd.mailState[state];
  if (url.searchParams.get('error') || !code) return back('denied');
  const t = await gfetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(env, origin), grant_type: 'authorization_code' }) });
  if (!t.ok || !t.j.access_token) return back('failed');
  if (!t.j.refresh_token) return back('norefresh');
  if (!/gmail\.modify/.test(t.j.scope || '')) return back('scope');   // the person unticked the permission
  const p = await gfetch(GM + '/profile', { headers: { Authorization: 'Bearer ' + t.j.access_token } });
  sd.mail = sd.mail || {};
  const old = sd.mail[s.email] || {};
  sd.mail[s.email] = { ...old, rt: enc(env, t.j.refresh_token), at: { t: t.j.access_token, exp: now() + (t.j.expires_in || 3000) * 1000 }, gmail: p.j.emailAddress || '', broken: false, since: old.since || new Date().toISOString(), folders: old.folders || [], rules: old.rules || [] };
  return back('connected');
}
