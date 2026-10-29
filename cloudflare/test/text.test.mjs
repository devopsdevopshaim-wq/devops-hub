// the verification code by SMS / WhatsApp through Twilio: channels, Israeli numbers, the request (fetch is mocked)
import { sendText, textChannels, intlPhone } from '../src/text.mjs';
let fails = 0; const check = (n, ok, x) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok ? '' : ' ' + JSON.stringify(x || ''))); if (!ok) fails++; };
const env = { TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32), TWILIO_AUTH_TOKEN: 'b'.repeat(32), TWILIO_SMS_FROM: 'Optimus', TWILIO_WHATSAPP_FROM: '+14155238886' };
check('no account, no channels', textChannels({}).length === 0);
check('both channels when both senders are set', textChannels(env).join() === 'sms,whatsapp');
check('Israeli mobile to +972', intlPhone('050-111-2222') === '+972501112222' && intlPhone('972501112222') === '+972501112222');
let seen = null; globalThis.fetch = async (url, o) => { seen = { url, o, form: Object.fromEntries(new URLSearchParams(o.body)) }; return { ok: true, json: async () => ({}) }; };
let r = await sendText(env, '0501112222', 'קוד האימות שלך לאופטימוס: 123456', 'sms');
check('an SMS goes to Twilio', !r.error && /Accounts\/ACa+\/Messages\.json$/.test(seen.url) && seen.form.To === '+972501112222' && seen.form.From === 'Optimus' && seen.form.Body.includes('123456'), seen && seen.form);
r = await sendText({ ...env, TWILIO_WA_CONTENT_SID: 'HX' + 'c'.repeat(32) }, '0501112222', 'קוד האימות שלך לאופטימוס: 123456', 'whatsapp');
check('WhatsApp uses the approved template with the code', !r.error && seen.form.To === 'whatsapp:+972501112222' && seen.form.From === 'whatsapp:+14155238886' && JSON.parse(seen.form.ContentVariables)[1] === '123456' && !seen.form.Body, seen.form);
check('a channel that is off says so', (await sendText({ ...env, TWILIO_WHATSAPP_FROM: '' }, '0501112222', 'x', 'whatsapp')).error === 'no-whatsapp');
globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ code: 21211 }) });
check('a refusal is an error with Twilio\'s code', (await sendText(env, '0501112222', 'x', 'sms')).error === 'twilio 400 21211');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
