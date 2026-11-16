// Telegram to the owner (notify.mjs tgApi / tgFindChat / tgSendText), with a fake fetch: no network.
import { tgApi, tgFindChat, tgSendText } from '../src/notify.mjs';
let fails = 0; const check = (n, ok, x) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok ? '' : ' ' + JSON.stringify(x))); if (!ok) fails++; };
const calls = [];
const fake = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); const m = url.split('/').pop();
  if (m === 'getUpdates') return { status: 200, json: async () => ({ ok: true, result: [{ message: { chat: { id: -100, type: 'group', title: 'g' } } }, { message: { chat: { id: 4242, type: 'private', first_name: 'חיים' } } }] }) };
  if (m === 'sendMessage') return { status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  return { status: 404, json: async () => ({ ok: false, description: 'Not Found' }) }; };
const env = { TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' };
check('no token: not set', (await tgApi({}, 'getMe', {}, fake)).error === 'tg-not-set');
const f = await tgFindChat(env, fake); check('the newest private chat is found (a group is skipped)', f.ok && f.chatId === '4242' && f.name === 'חיים', f);
const s = await tgSendText(env, '4242', 'x'.repeat(5000), fake); const last = calls[calls.length - 1];
check('a message is sent to the chat, cut to 4000', s.ok && last.body.chat_id === '4242' && last.body.text.length === 4000 && /bot123456789:/.test(last.url), last.url);
const bad = await tgApi(env, 'nope', {}, fake); check('an error says why', !bad.ok && /telegram 404/.test(bad.error), bad);
const none = await tgFindChat(env, async () => ({ status: 200, json: async () => ({ ok: true, result: [] }) })); check('no message to the bot yet: no chat', none.error === 'tg-no-chat');
if (fails) process.exit(1);
