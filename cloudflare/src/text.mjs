// ---- text messages (Twilio): SMS from TWILIO_SMS_FROM (a number or an approved sender name), WhatsApp from TWILIO_WHATSAPP_FROM
// (an approved WhatsApp sender; outside a chat Meta requires a template: TWILIO_WA_CONTENT_SID, whose variable {{1}} is the code)
export function textChannels(env) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return [];
  return [env.TWILIO_SMS_FROM ? 'sms' : '', env.TWILIO_WHATSAPP_FROM ? 'whatsapp' : ''].filter(Boolean);
}
export function intlPhone(p) { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '972' + d.slice(1); return d.length >= 9 ? '+' + d : ''; }
export async function sendText(env, phone, text, via = 'sms') {
  if (!textChannels(env).includes(via)) return { error: 'no-' + via };
  const to = intlPhone(phone); if (!to) return { error: 'bad-phone' };
  const wa = via === 'whatsapp', from = wa ? 'whatsapp:' + String(env.TWILIO_WHATSAPP_FROM).replace(/^whatsapp:/, '') : env.TWILIO_SMS_FROM;
  const form = new URLSearchParams({ To: wa ? 'whatsapp:' + to : to, From: from });
  const code = (String(text).match(/\b(\d{6})\b/) || [])[1] || '';
  if (wa && env.TWILIO_WA_CONTENT_SID && code) { form.set('ContentSid', env.TWILIO_WA_CONTENT_SID); form.set('ContentVariables', JSON.stringify({ 1: code })); }
  else form.set('Body', text);
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN), 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    if (r.ok) return {};
    const j = await r.json().catch(() => ({}));
    return { error: 'twilio ' + r.status + (j && j.code ? ' ' + j.code : '') };
  } catch (e) { return { error: 'twilio ' + String((e && e.message) || e).slice(0, 80) }; }
}

