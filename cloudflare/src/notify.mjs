// פריים מגנטים: what the owner hears without opening the admin.
//   - every morning (Israel time): events today, tomorrow and in a week, booking requests still waiting for him (with how long
//     they waited and how soon the date is), open quotes whose date is close and not held, balances to collect before an event,
//     the weekly backup when it is late;
//   - Saturday night, after Shabbat: last week (events held, income, expenses, requests, אופטימוס) and the week ahead;
//   - the events that hold a date go to his Google Calendar, with reminders a day and three hours before (on the phone).
// Delivery goes through Maton (api.maton.ai, the owner's MATON_API_KEY, apps he connected there: Gmail, Telegram, Google
// Calendar), and falls back to the server's own mail when Maton is not set or does not answer. The key never leaves the server.
const DAY = 864e5;
const TZ = 'Asia/Jerusalem';
export const ilDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
export const ilHour = (t) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)));
export const ilWeekday = (t) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(t));   // Sun … Sat
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysTo = (from, to) => Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / DAY);
const he = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }); };
const nis = (v) => '₪' + Math.round(Number(v) || 0).toLocaleString('he-IL');
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };
const ADMIN = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/admin.html';

// the same rule as the admin page (admin-biz.js totals): price + extras − discount, VAT added only when the deal says "plus"
export function dealTotals(d, settings) {
  const pay = Object.assign({ vat: 18, bizType: 'פטור' }, (settings && settings.pay) || {});
  const extras = (d.extras || []).reduce((s, x) => s + num(x.amount), 0), sub = num(d.price) + extras - num(d.discount);
  const total = d.vatMode === 'plus' ? sub * (1 + num(pay.vat) / 100) : sub;
  const paid = (d.payments || []).reduce((s, x) => s + num(x.amount), 0);
  return { total, paid, balance: Math.max(0, total - paid) };
}
const holds = (d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && !d.cancelled && (d.closed || (d.payments || []).length > 0);
const isQuote = (d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && !d.cancelled && !holds(d);
const title = (d) => [d.typeName || d.type || 'אירוע', (d.client && d.client.name) || ''].filter(Boolean).join(' · ');
const evLine = (d, s) => { const t = dealTotals(d, s); return '  • ' + he(d.date) + (d.time ? ' ' + d.time : '') + ' · ' + title(d) + (d.venue ? ' · ' + d.venue : '') + ((d.client || {}).phone ? ' · ' + d.client.phone : '') + (t.balance > 0.5 ? ' · יתרה ' + nis(t.balance) : ' · שולם ✔'); };

/* the morning message: null when there is nothing worth a message */
export function frameDaily(S, now) {
  const today = ilDate(now), s = S.settings || {}, deals = (S.deals || []).filter(holds);
  const on = (iso) => deals.filter((d) => d.date === iso);
  const tdy = on(today), tmr = on(addDays(today, 1)), wk = on(addDays(today, 7));
  const pend = (S.requests || []).filter((r) => r.status === 'pending' && r.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const quotes = (S.deals || []).filter((d) => isQuote(d) && d.date >= today && daysTo(today, d.date) <= 21);
  const dues = deals.filter((d) => d.date >= today && daysTo(today, d.date) <= 7 && dealTotals(d, s).balance > 0.5);
  const expiring = (S.docs || []).filter((x) => x.expiry && x.expiry >= today && daysTo(today, x.expiry) <= 30 && [30, 14, 7, 3, 1, 0].includes(daysTo(today, x.expiry)));
  const lateBackup = !S.backupAt || now - S.backupAt > 7 * DAY;
  const L = [];
  if (tdy.length) L.push('📅 היום:', ...tdy.map((d) => evLine(d, s)), '');
  if (tmr.length) L.push('📅 מחר:', ...tmr.map((d) => evLine(d, s)), '');
  if (wk.length) L.push('🗓️ בעוד שבוע:', ...wk.map((d) => evLine(d, s)), '');
  if (pend.length) L.push('⏳ בקשות הזמנה שמחכות לתשובה שלך (התאריך לא שמור עד שתאשר):', ...pend.slice(0, 15).map((r) => {
    const left = daysTo(today, r.date), waited = r.at ? Math.floor((now - r.at) / DAY) : 0;
    return '  • ' + he(r.date) + ' (בעוד ' + left + ' ימים) · ' + (r.typeName || r.type || 'אירוע') + ' · ' + r.name + (r.phone ? ' · ' + r.phone : '') + (waited ? ' · מחכה ' + waited + ' ימים' : '') + (left <= 7 ? ' ⚠️' : '');
  }), '');
  if (quotes.length) L.push('📝 הצעות מחיר פתוחות שהתאריך שלהן מתקרב (בלי מקדמה, התאריך לא נשמר):', ...quotes.map((d) => '  • ' + he(d.date) + ' (בעוד ' + daysTo(today, d.date) + ' ימים) · ' + title(d) + ((d.client || {}).phone ? ' · ' + d.client.phone : '')), '');
  if (dues.length) L.push('💰 לגבות לפני האירוע (השבוע):', ...dues.map((d) => '  • ' + he(d.date) + ' · ' + title(d) + ' · יתרה ' + nis(dealTotals(d, s).balance)), '');
  if (expiring.length) L.push('📁 מסמכים שתוקפם מסתיים:', ...expiring.map((x) => '  • ' + x.title + (x.cat ? ' (' + x.cat + ')' : '') + ' · ' + he(x.expiry) + ' (בעוד ' + daysTo(today, x.expiry) + ' ימים)'), '');
  const urgent = tdy.length + tmr.length + pend.filter((r) => daysTo(today, r.date) <= 7).length + dues.length;
  if (!L.length && !(lateBackup && ilWeekday(now) === 'Sun')) return null;
  if (lateBackup) L.push('💾 הגיבוי השבועי למחשב: ' + (S.backupAt ? 'האחרון לפני ' + Math.floor((now - S.backupAt) / DAY) + ' ימים' : 'עוד לא בוצע') + '. מסך הניהול ← גיבוי וייצוא לאקסל.', '');
  L.push('לפרטים ולטיפול: ' + ADMIN);
  const head = [tdy.length ? tdy.length + ' אירועים היום' : '', tmr.length ? tmr.length + ' מחר' : '', pend.length ? pend.length + ' בקשות מחכות' : '', dues.length ? 'יתרות לגבייה' : ''].filter(Boolean).join(' · ') || 'עדכון';
  return { kind: 'daily', urgent, subject: (urgent ? '🔔 ' : '☀️ ') + 'פריים מגנטים · ' + head, text: '☀️ בוקר טוב! מה מחכה לך (' + he(today) + '):\n\n' + L.join('\n') };
}

/* Saturday night: the week that ended (Sunday … today) and the week ahead (tomorrow … next Saturday) */
export function frameWeekly(S, now, lic) {
  const today = ilDate(now), from = addDays(today, -6), nextFrom = addDays(today, 1), nextTo = addDays(today, 7), s = S.settings || {};
  const inLast = (iso) => iso && iso >= from && iso <= today, inNext = (iso) => iso && iso >= nextFrom && iso <= nextTo;
  const deals = S.deals || [], held = deals.filter((d) => holds(d) && inLast(d.date)), ahead = deals.filter((d) => holds(d) && inNext(d.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const pays = []; deals.forEach((d) => (d.payments || []).forEach((p) => { if (inLast(p.date)) pays.push({ d, p }); }));
  const income = pays.reduce((t, x) => t + num(x.p.amount), 0), exps = (S.expenses || []).filter((e) => inLast(e.date)), spent = exps.reduce((t, e) => t + num(e.amount), 0);
  const lp = (lic && lic.payments) || [], licIncome = lp.reduce((t, p) => t + num(p.amount), 0);
  const reqs = (S.requests || []).filter((r) => r.at && ilDate(r.at) >= from), pend = (S.requests || []).filter((r) => r.status === 'pending' && r.date >= today);
  const balance = ahead.reduce((t, d) => t + dealTotals(d, s).balance, 0), quotes = deals.filter((d) => isQuote(d) && inNext(d.date));
  const L = ['📊 השבוע שעבר (' + he(from) + ' – ' + he(today) + ')',
    '  🎉 אירועים: ' + held.length + (held.length ? ' (' + held.map(title).join(', ') + ')' : ''),
    '  💵 הכנסות מגנטים: ' + nis(income) + ' (' + pays.length + ' תשלומים)' + (lic ? ' · אופטימוס: ' + nis(licIncome) + ' (' + lp.length + ')' : ''),
    '  💸 הוצאות: ' + nis(spent) + ' (' + exps.length + ')' + ' · רווח: ' + nis(income + licIncome - spent),
    '  📥 בקשות הזמנה חדשות: ' + reqs.length + (reqs.length ? ' (אושרו ' + reqs.filter((r) => r.status === 'approved').length + ', נדחו ' + reqs.filter((r) => r.status === 'declined').length + ', ממתינות ' + reqs.filter((r) => r.status === 'pending').length + ')' : '')];
  if (lic) L.push('  🧠 אופטימוס: ' + (lic.leads || 0) + ' נרשמו · ' + (lic.trials || 0) + ' התחילו ניסיון · ' + (lic.requests || 0) + ' בקשות רכישה פתוחות');
  L.push('', '🗓️ השבוע הבא (' + he(nextFrom) + ' – ' + he(nextTo) + ')');
  L.push(ahead.length ? '  🎉 ' + ahead.length + ' אירועים:' : '  אין אירועים סגורים.', ...ahead.map((d) => evLine(d, s)));
  if (balance > 0.5) L.push('  💰 לגבות השבוע: ' + nis(balance));
  if (pend.length) L.push('  ⏳ בקשות שמחכות לתשובה שלך: ' + pend.length + ' (הקרובה: ' + he(pend.sort((a, b) => (a.date < b.date ? -1 : 1))[0].date) + ')');
  if (quotes.length) L.push('  📝 הצעות פתוחות לשבוע הבא (התאריך לא שמור): ' + quotes.map(title).join(', '));
  const tax = s.tax || {}, bt = (s.pay || {}).bizType, day15 = [nextFrom.slice(0, 8) + '15', addDays(nextFrom.slice(0, 8) + '01', 32).slice(0, 8) + '15'].find(inNext);
  if (day15 && (bt === 'מורשה' || bt === 'חברה' || num(tax.advPct) || num(tax.niMonthly))) L.push('  🏛️ ' + he(day15) + ': מועד תשלומי מע״מ / מקדמות / ביטוח לאומי (לפי ההגדרות)');
  if (!S.backupAt || now - S.backupAt > 7 * DAY) L.push('  💾 גיבוי שבועי למחשב: הגיע הזמן');
  L.push('', 'שבוע טוב! ' + ADMIN);
  return { kind: 'weekly', subject: '📊 שבוע טוב · סיכום שבועי: ' + held.length + ' אירועים, ' + nis(income + licIncome) + ' הכנסות · השבוע: ' + ahead.length + ' אירועים', text: L.join('\n') };
}

/* ---------- Maton ---------- */
const BASES = ['https://api.maton.ai', 'https://gateway.maton.ai'];
export async function maton(env, path, init = {}, fetcher = fetch) {
  const key = env.MATON_API_KEY; if (!key) return { ok: false, status: 0, error: 'no-maton-key' };
  let last = { ok: false, status: 0, error: 'maton-unreachable' };
  for (const base of BASES) {
    try {
      const r = await fetcher(base + path, { method: init.method || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + key }, init.body ? { 'Content-Type': 'application/json' } : {}, init.headers || {}), body: init.body ? JSON.stringify(init.body) : undefined });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
      last = { ok: r.ok, status: r.status, json, error: r.ok ? '' : 'maton ' + r.status + ' ' + String((json && (json.error && (json.error.message || json.error) || json.message)) || text).slice(0, 120) };
      if (r.status !== 404 && r.status < 500) return last;   // a real answer from Maton or the app: no point trying the other host
    } catch (e) { last = { ok: false, status: 0, error: 'maton ' + String((e && e.message) || e).slice(0, 80) }; }
  }
  return last;
}
const b64 = (s) => { const u = new TextEncoder().encode(String(s)); let bin = ''; for (const c of u) bin += String.fromCharCode(c); return btoa(bin); };
const b64url = (s) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hdr = (s) => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
export function gmailRaw({ to, subject, text, fromName }) {
  return b64url(['To: ' + to, fromName ? 'From: ' + hdr(fromName) + ' <me>' : '', 'Subject: ' + hdr(subject), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text).replace(/.{1,76}/g, '$&\r\n')].filter((x, i) => x || i > 3).join('\r\n'));
}
export const gmailSend = (env, m, f) => maton(env, '/google-mail/gmail/v1/users/me/messages/send', { method: 'POST', body: { raw: gmailRaw(m) } }, f);
export const telegramSend = (env, chatId, text, f) => maton(env, '/telegram/:token/sendMessage', { method: 'POST', body: { chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true } }, f);
// the chat that wrote to the bot last (the owner sends /start to his bot once, then "find" stores the chat)
export async function telegramFind(env, f) {
  const r = await maton(env, '/telegram/:token/getUpdates', { method: 'POST', body: { limit: 50 } }, f);
  if (!r.ok) return r;
  const ups = (r.json && r.json.result) || [], last = ups.map((u) => (u.message || u.edited_message || u.channel_post || {}).chat).filter(Boolean).pop();
  return last ? { ok: true, chatId: last.id, name: [last.first_name, last.last_name].filter(Boolean).join(' ') || last.title || last.username || '' } : { ok: false, error: 'no-chat' };
}

/* the owner hears it: Telegram and Gmail through Maton (as he chose), the server's own mail when neither went out */
export async function notifyOwner(env, n, msg, sendMail, f) {
  n = n || {}; const res = {};
  if (env.MATON_API_KEY && n.telegram !== false && n.chatId) res.telegram = await telegramSend(env, n.chatId, msg.subject + '\n\n' + msg.text, f);
  if (env.MATON_API_KEY && n.gmail !== false) res.gmail = await gmailSend(env, { to: n.email || msg.to, subject: msg.subject, text: msg.text, fromName: 'פריים מגנטים' }, f);
  const any = Object.values(res).some((r) => r && r.ok);
  if (!any && sendMail) res.mail = await sendMail(env, { to: n.email || msg.to, fromName: 'פריים מגנטים', subject: msg.subject, text: msg.text });
  return { sent: any || !!(res.mail && !res.mail.error), via: Object.keys(res).filter((k) => res[k] && (res[k].ok || (k === 'mail' && !res[k].error))), errors: Object.fromEntries(Object.entries(res).filter(([k, r]) => r && !(r.ok || (k === 'mail' && !r.error))).map(([k, r]) => [k, r.error || 'failed'])) };
}

/* ---------- Google Calendar: the events that hold a date, with reminders ---------- */
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export function calEvent(d, settings) {
  const t = dealTotals(d, settings), c = d.client || {}, tm = /^\d{1,2}:\d{2}$/.test(d.time || '') ? d.time.padStart(5, '0') : '';
  const desc = [d.no ? 'עסקה ' + d.no : '', c.name ? 'לקוח: ' + c.name : '', c.phone ? 'טלפון: ' + c.phone : '', d.venue ? 'מקום: ' + d.venue : '', d.pkg || d.packageName ? 'חבילה: ' + (d.pkg || d.packageName) : '',
    t.balance > 0.5 ? 'יתרה לתשלום: ' + nis(t.balance) : 'שולם במלואו', '', ADMIN + '#deals'].filter((x) => x !== '').join('\n');
  const start = tm ? { dateTime: d.date + 'T' + tm + ':00', timeZone: TZ } : { date: d.date };
  const end = tm ? { dateTime: new Date(Date.parse(d.date + 'T' + tm + ':00Z') + 4 * 3600e3).toISOString().slice(0, 19), timeZone: TZ } : { date: addDays(d.date, 1) };
  return { summary: '🧲 ' + title(d), location: d.venue || '', description: desc, start, end, colorId: '5', reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 180 }] } };
}
// map: { dealId: { id: googleEventId, h: hash } } → the new map, and what was done
export async function calendarSync(env, S, map, now, f) {
  map = Object.assign({}, map || {}); const today = ilDate(now), want = {}, done = { created: 0, updated: 0, removed: 0, errors: [] };
  (S.deals || []).filter((d) => holds(d) && d.date >= addDays(today, -1) && d.date <= addDays(today, 180)).forEach((d) => { want[d.id] = d; });
  const P = '/google-calendar/calendar/v3/calendars/primary/events';
  for (const [id, d] of Object.entries(want)) {
    const ev = calEvent(d, S.settings), h = hash(JSON.stringify(ev)), cur = map[id];
    if (cur && cur.h === h) continue;
    const r = cur ? await maton(env, P + '/' + encodeURIComponent(cur.id), { method: 'PATCH', body: ev }, f) : await maton(env, P, { method: 'POST', body: ev }, f);
    if (r.ok && r.json && r.json.id) { map[id] = { id: r.json.id, h, d: d.date }; cur ? done.updated++ : done.created++; }
    else if (cur && r.status === 404) { delete map[id]; }   // deleted in Google: made again next time
    else { done.errors.push(r.error); if (done.errors.length >= 3) break; }
  }
  for (const [id, cur] of Object.entries(map)) {
    if (want[id]) continue;
    if (cur.d && cur.d < addDays(today, -1) && (S.deals || []).some((d) => d.id === id && holds(d))) { delete map[id]; continue; }   // past: the event stays in the calendar
    const r = await maton(env, P + '/' + encodeURIComponent(cur.id), { method: 'DELETE' }, f);
    if (r.ok || r.status === 404 || r.status === 410) { delete map[id]; done.removed++; } else done.errors.push(r.error);
  }
  return { map, done };
}
