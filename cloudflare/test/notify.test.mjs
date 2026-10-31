// The owner's alerts (src/notify.mjs): the morning message, the Saturday-night summary, delivery through Maton with the
// server's mail as the fallback, and the Google Calendar sync. Maton is a fake here: nothing leaves the machine.
import { frameDaily, frameWeekly, gmailRaw, notifyOwner, calendarSync, telegramFind, ilDate, ilWeekday } from '../src/notify.mjs';

let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } else console.log('ok  ', n); };
const NOW = Date.parse('2026-10-31T19:30:00Z');   // Saturday 21:30 in Israel
const T = ilDate(NOW), add = (n) => new Date(Date.parse(T + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const deal = (id, date, o) => Object.assign({ id, no: 'A' + id, date, closed: true, typeName: 'חתונה', client: { name: 'לקוח ' + id, phone: '050-000000' + id }, venue: 'אולם', price: 2000, payments: [] }, o || {});
const S = {
  settings: { pay: { bizType: 'פטור' } }, backupAt: NOW - 9 * 864e5,
  deals: [deal('1', add(1), { time: '19:00', payments: [{ date: add(-3), amount: 500 }] }), deal('2', add(7), { payments: [{ date: add(-1), amount: 2000 }] }), deal('3', add(5), { closed: false }), deal('4', add(-2), { payments: [{ date: add(-2), amount: 2000 }] }), deal('5', add(3), { cancelled: true })],
  requests: [{ id: 'r1', status: 'pending', date: add(4), name: 'דנה', phone: '052', typeName: 'בר מצווה', at: NOW - 3 * 864e5 }, { id: 'r2', status: 'approved', date: add(20), name: 'רון', at: NOW - 864e5 }],
  expenses: [{ id: 'e1', date: add(-2), amount: 300 }, { id: 'e2', date: add(-20), amount: 999 }]
};
check('the clock: Saturday in Israel', ilWeekday(NOW) === 'Sat');

const d = frameDaily(S, NOW);
check('morning: tomorrow\'s event with time and balance', /מחר:/.test(d.text) && /19:00 · חתונה · לקוח 1/.test(d.text) && /יתרה ₪1,500/.test(d.text), d.text);
check('morning: the event in a week, already paid', /בעוד שבוע:/.test(d.text) && /לקוח 2.*שולם ✔/.test(d.text));
check('morning: the request waiting for the owner, how soon and how long it waited', /דנה/.test(d.text) && /בעוד 4 ימים/.test(d.text) && /מחכה 3 ימים/.test(d.text) && /⚠️/.test(d.text));
check('morning: the open quote whose date is close (not held)', /הצעות מחיר פתוחות/.test(d.text) && /לקוח 3/.test(d.text));
check('morning: balances to collect this week', /לגבות לפני האירוע/.test(d.text));
check('morning: a cancelled deal and a past one are not mentioned', !/לקוח 5/.test(d.text) && !/לקוח 4/.test(d.text));
check('morning: the late backup', /הגיבוי השבועי/.test(d.text));
check('morning: the subject says what is urgent', /^🔔/.test(d.subject) && /1 בקשות מחכות/.test(d.subject), d.subject);
check('morning: a document about to expire', frameDaily(Object.assign({}, S, { docs: [{ title: 'ביטוח צד ג׳', cat: 'ביטוח', expiry: add(7) }, { title: 'רחוק', expiry: add(60) }] }), NOW).text.includes('ביטוח צד ג׳ (ביטוח)') && !frameDaily(Object.assign({}, S, { docs: [{ title: 'רחוק', expiry: add(60) }] }), NOW).text.includes('רחוק'));
check('a quiet day sends nothing', frameDaily({ deals: [], requests: [], expenses: [], settings: {}, backupAt: NOW }, NOW) === null);

const w = frameWeekly(S, NOW, { payments: [{ name: 'צלמת', amount: 790 }], leads: 4, trials: 2, requests: 1 });
check('weekly: last week\'s event, income (magnets + אופטימוס), expenses and profit', /אירועים: 1 \(חתונה · לקוח 4\)/.test(w.text) && /הכנסות מגנטים: ₪4,500 \(3 תשלומים\)/.test(w.text) && /אופטימוס: ₪790/.test(w.text) && /הוצאות: ₪300/.test(w.text) && /רווח: ₪4,990/.test(w.text), w.text);
check('weekly: the week ahead, with what to collect and what waits', /השבוע הבא/.test(w.text) && /3 אירועים|2 אירועים/.test(w.text) && /לגבות השבוע: ₪1,500/.test(w.text) && /בקשות שמחכות/.test(w.text), w.text);
check('weekly: אופטימוס numbers', /4 נרשמו · 2 התחילו ניסיון/.test(w.text));

const raw = gmailRaw({ to: 'me@gmail.com', subject: 'שבוע טוב', text: 'שלום\nעולם', fromName: 'פריים מגנטים' });
const dec = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
check('Gmail message: base64url, Hebrew subject encoded, body base64', !/[+/=]/.test(raw) && /^To: me@gmail.com/.test(dec) && /Subject: =\?UTF-8\?B\?/.test(dec) && Buffer.from(dec.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString() === 'שלום\nעולם', dec.slice(0, 300));

// a fake Maton: records calls, answers like the apps do
function fake(rules) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null }); const r = rules(url, init, calls.length) || { status: 200, json: {} }; return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.json || {}) }; };
  f.calls = calls; return f;
}
const env = { MATON_API_KEY: 'v2.test-key-123456789012345678901234' };
let mailed = null; const sendMail = async (e, m) => { mailed = m; return {}; };
let f = fake(() => ({ status: 200, json: { id: 'm1', ok: true } }));
let r = await notifyOwner(env, { chatId: 12345, email: 'owner@gmail.com' }, { subject: 'כותרת', text: 'גוף' }, sendMail, f);
check('through Maton: Telegram and Gmail, the key only in the Authorization header to Maton', r.sent && r.via.join() === 'telegram,gmail' && f.calls.every((c) => /^https:\/\/api\.maton\.ai\//.test(c.url) && c.auth === 'Bearer ' + env.MATON_API_KEY) && f.calls[0].body.chat_id === 12345 && !mailed, r);
f = fake(() => ({ status: 401, json: { error: 'no connection' } })); mailed = null;
r = await notifyOwner(env, { email: 'owner@gmail.com' }, { subject: 'כותרת', text: 'גוף' }, sendMail, f);
check('Maton failing: the server\'s own mail goes out instead', r.sent && r.via.join() === 'mail' && mailed && mailed.to === 'owner@gmail.com' && r.errors.gmail, r);
mailed = null; r = await notifyOwner({}, { gmail: true }, { to: 'x@y.com', subject: 's', text: 't' }, sendMail, fake(() => null));
check('no Maton key: straight to the server\'s mail', r.via.join() === 'mail' && mailed.to === 'x@y.com');
f = fake((url, init, n) => n === 1 ? { status: 503 } : { status: 200, json: {} });
r = await notifyOwner(env, { telegram: false }, { to: 'x@y.com', subject: 's', text: 't' }, sendMail, f);
check('one Maton host down: the other is tried', f.calls.length === 2 && /api\.maton\.ai/.test(f.calls[0].url) && /gateway\.maton\.ai/.test(f.calls[1].url) && r.via.join() === 'gmail', f.calls.map((c) => c.url));

f = fake(() => ({ status: 200, json: { result: [{ message: { chat: { id: 999, first_name: 'חיים' } } }] } }));
r = await telegramFind(env, f);
check('Telegram: the chat that wrote /start is found', r.ok && r.chatId === 999 && r.name === 'חיים');

// the calendar: create, then nothing when unchanged, update on change, remove a cancelled one
let n = 0; f = fake((url, init) => init.method === 'POST' ? { status: 200, json: { id: 'g' + (++n) } } : init.method === 'PATCH' ? { status: 200, json: { id: url.split('/').pop() } } : { status: 204 });
let c = await calendarSync(env, S, {}, NOW, f);
const posted = f.calls.filter((x) => x.method === 'POST');
check('calendar: every coming event that holds a date is created (not past ones), with reminders a day and 3 hours before', c.done.created === 2 && posted.length === 2 && posted.every((p) => p.body.reminders.overrides.map((o) => o.minutes).join() === '1440,180') && Object.keys(c.map).sort().join() === '1,2', c);
check('calendar: a timed event in Israel time, an all-day one by date', posted.some((p) => p.body.start.dateTime === add(1) + 'T19:00:00' && p.body.start.timeZone === 'Asia/Jerusalem') && posted.some((p) => p.body.start.date === add(7)));
check('calendar: quotes and cancelled deals are not in the calendar', !posted.some((p) => /לקוח 3|לקוח 5/.test(p.body.summary)));
f.calls.length = 0; c = await calendarSync(env, S, c.map, NOW, f);
check('calendar: nothing changed, nothing sent', f.calls.length === 0);
const S2 = Object.assign({}, S, { deals: S.deals.map((x) => x.id === '2' ? Object.assign({}, x, { venue: 'גן אירועים' }) : x.id === '1' ? Object.assign({}, x, { cancelled: true }) : x) });
c = await calendarSync(env, S2, c.map, NOW, f);
check('calendar: a changed event is updated, a cancelled one removed', c.done.updated === 1 && c.done.removed === 1 && !c.map['1'] && f.calls.some((x) => x.method === 'DELETE'), c.done);

console.log(bad ? `\n${bad} failed` : '\nnotify: all passed');
process.exit(bad ? 1 : 0);
