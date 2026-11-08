// The owner's WhatsApp lines (notify.mjs waNote): who signed up or signed in, once per person and kind in 20 minutes.
import { waNote } from '../src/notify.mjs';
let bad = 0;
const check = (n, ok, x) => { if (!ok) { bad++; console.error('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } else console.log('ok  ', n); };
const ADMIN = 'owner@x.com', now = Date.parse('2026-11-08T10:00:00Z'), iso = new Date(now).toISOString();
const sd = {
  trialLeads: { 'dana@x.com': { email: 'dana@x.com', name: 'דנה לוי', phone: '0521111111', firstAt: iso, lastAt: iso, where: 'download' } },
  licenses: { 'yossi@x.com': { email: 'yossi@x.com', name: 'יוסי', phone: '0502222222', trial: { start: iso } } },
  frameVisitors: { 'avi@x.com': { email: 'avi@x.com', name: 'אבי', visits: 1 }, 'tel:0543333333': { phone: '0543333333', name: 'גל', visits: 3 } },
  clients: { 'rina@x.com': { email: 'rina@x.com', name: 'רינה', sites: ['frame'] }, 'other@x.com': { email: 'other@x.com', sites: ['portfolio'] } }
};
let m = waNote(sd, { action: 'trial-code', email: 'dana@x.com' }, now, ADMIN);
check('a new registration', /נרשם חדש לאופטימוס/.test(m) && /דנה לוי/.test(m) && /#requests/.test(m), m);
check('not twice in 20 minutes', waNote(sd, { action: 'trial-code', email: 'dana@x.com' }, now + 60000, ADMIN) === null);
check('again after 20 minutes', !!waNote(sd, { action: 'trial-code', email: 'dana@x.com' }, now + 21 * 60000, ADMIN));
m = waNote(sd, { action: 'trial-verify', email: 'dana@x.com' }, now, ADMIN); check('verified', /אימת מייל/.test(m), m);
m = waNote(sd, { action: 'lic-activate', email: 'YOSSI@x.com' }, now, ADMIN); check('Optimus sign-in (trial)', /התחברות לאופטימוס \(ניסיון\)/.test(m), m);
m = waNote(sd, { action: 'frame-visit', contact: 'avi@x.com', name: 'אבי' }, now, ADMIN); check('a new customer-screen visitor', /לקוח חדש נכנס/.test(m) && /#customers/.test(m), m);
m = waNote(sd, { action: 'frame-visit', contact: '054-3333333', name: 'גל' }, now, ADMIN); check('a returning visitor by phone', /כניסה למסך הלקוח \(3\)/.test(m), m);
m = waNote(sd, { action: 'login', email: 'rina@x.com' }, now, ADMIN); check('a customer login', /לקוח התחבר/.test(m) && /רינה/.test(m), m);
check('another site\'s login is not ours', waNote(sd, { action: 'login', email: 'other@x.com' }, now, ADMIN) === null);
m = waNote(sd, { action: 'login', email: ADMIN }, now, ADMIN); check('the owner\'s own login', /כניסה לניהול/.test(m), m);
check('other actions say nothing', waNote(sd, { action: 'me' }, now, ADMIN) === null);
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
