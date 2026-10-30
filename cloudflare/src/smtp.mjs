// Mail through Gmail's SMTP server (smtp.gmail.com:465, TLS) with an app password: no mail service to sign up for.
// The socket comes from the caller: `cloudflare:sockets` in the Worker, Node's tls in the deploy check and the tests,
// both as { readable, writable } web streams. verifyOnly signs in and stops (the deploy's check that the password works).
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (s) => { const u = enc.encode(String(s)); let bin = ''; for (const c of u) bin += String.fromCharCode(c); return btoa(bin); };
const header = (s) => /^[\x20-\x7e]*$/.test(String(s)) ? String(s) : '=?UTF-8?B?' + b64(s) + '?=';
const addr = (s) => String(s || '').replace(/[\r\n<>]/g, '').trim();

export async function smtpSend(open, { host = 'smtp.gmail.com', port = 465, user, pass, from, fromName = '', to, replyTo, subject = '', text = '', html = '', attachments = [], verifyOnly = false }) {
  if (!user || !pass) return { error: 'smtp-no-login' };
  let sock;
  try { sock = await open(host, port); } catch (e) { return { error: 'smtp-connect ' + String((e && e.message) || e).slice(0, 80) }; }
  const reader = sock.readable.getReader(), writer = sock.writable.getWriter();
  let buf = '';
  // one reply: lines until "NNN " (a dash after the code means more lines follow)
  const reply = async () => {
    for (;;) {
      const lines = buf.split('\r\n'), done = lines.slice(0, -1).findIndex((l) => /^\d{3} /.test(l));
      if (done >= 0) { const r = lines.slice(0, done + 1); buf = lines.slice(done + 1).join('\r\n'); const last = r[r.length - 1]; return { code: Number(last.slice(0, 3)), text: r.join('\n') }; }
      const { value, done: end } = await reader.read(); if (end) throw new Error('closed');
      buf += dec.decode(value, { stream: true });
    }
  };
  const send = (line) => writer.write(enc.encode(line + '\r\n'));
  const step = async (line, ok) => { if (line != null) await send(line); const r = await reply(); if (!ok.includes(r.code)) throw new Error(r.code + ' ' + r.text.slice(0, 120)); return r; };
  try {
    await step(null, [220]);
    await step('EHLO spider-auth', [250]);
    await step('AUTH LOGIN', [334]); await step(b64(user), [334]); await step(b64(pass), [235]);
    if (!verifyOnly) {
      await step('MAIL FROM:<' + addr(from || user) + '>', [250]);
      await step('RCPT TO:<' + addr(to) + '>', [250, 251]);
      await step('DATA', [354]);
      // a text part, and with html also an html part (multipart/alternative: what ordinary mail looks like to spam filters)
      const part = (v) => b64(v).replace(/.{1,76}/g, '$&\r\n');
      const bound = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2), mixed = 'm' + bound;
      // the message: text, or text + html (multipart/alternative); with attachments (a CSV for the accountant) all of it inside multipart/mixed
      const files = (attachments || []).filter((f) => f && f.name && f.content != null);
      const alt = !html ? null : ['--' + bound, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', part(text) + '--' + bound,
        'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', part(html) + '--' + bound + '--', ''].join('\r\n');
      const inner = html ? { type: 'multipart/alternative; boundary="' + bound + '"', body: alt } : { type: 'text/plain; charset=UTF-8', enc: 'base64', body: part(text) };
      const contentHead = files.length ? ['Content-Type: multipart/mixed; boundary="' + mixed + '"'] : ['Content-Type: ' + inner.type].concat(inner.enc ? ['Content-Transfer-Encoding: ' + inner.enc] : []);
      const head = ['From: ' + (fromName ? header(fromName) + ' ' : '') + '<' + addr(from || user) + '>', 'To: <' + addr(to) + '>', replyTo ? 'Reply-To: <' + addr(replyTo) + '>' : '',
        'Subject: ' + header(subject), 'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0'].concat(contentHead).filter(Boolean).join('\r\n');
      const body = !files.length ? inner.body : ['--' + mixed, 'Content-Type: ' + inner.type].concat(inner.enc ? ['Content-Transfer-Encoding: ' + inner.enc] : []).concat(['', inner.body])
        .concat(files.map((f) => ['--' + mixed, 'Content-Type: ' + (f.type || 'text/csv') + '; charset=UTF-8; name="' + header(f.name) + '"', 'Content-Disposition: attachment; filename="' + header(f.name) + '"',
          'Content-Transfer-Encoding: base64', '', part(f.content)].join('\r\n'))).concat(['--' + mixed + '--', '']).join('\r\n');
      await step(head + '\r\n\r\n' + body + '.', [250]);
    }
    await send('QUIT').catch(() => {});
    return {};
  } catch (e) {
    return { error: 'smtp ' + String((e && e.message) || e).slice(0, 140) };
  } finally {
    try { reader.releaseLock(); writer.releaseLock(); await sock.close?.(); } catch (e) { /* closing */ }
  }
}
