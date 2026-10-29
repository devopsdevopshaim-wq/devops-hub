// smtpSend against a fake SMTP server (plain TCP here; TLS in the Worker and the deploy): sign-in, envelope, a Hebrew subject and body
import net from 'node:net';
import { Duplex } from 'node:stream';
import { smtpSend } from '../src/smtp.mjs';
let fails = 0; const check = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' ' + JSON.stringify(extra || ''))); if (!ok) fails++; };
function fake({ pass = 'abcdabcdabcdabcd' } = {}) {
  const got = { lines: [], data: '' };
  const srv = net.createServer((c) => {
    let buf = '', inData = false, auth = 0;
    c.write('220 fake ESMTP\r\n');
    c.on('data', (d) => {
      buf += d.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; c.write('250 queued\r\n'); } else got.data += line + '\r\n'; continue; }
        got.lines.push(line);
        if (auth === 1) { auth = 2; c.write('334 UGFzc3dvcmQ6\r\n'); continue; }
        if (auth === 2) { auth = 0; c.write(Buffer.from(line, 'base64').toString() === pass ? '235 ok\r\n' : '535 bad\r\n'); continue; }
        if (/^EHLO/.test(line)) c.write('250-fake\r\n250-AUTH LOGIN PLAIN\r\n250 SIZE 1000\r\n');
        else if (line === 'AUTH LOGIN') { auth = 1; c.write('334 VXNlcm5hbWU6\r\n'); }
        else if (/^MAIL FROM/.test(line)) c.write('250 ok\r\n');
        else if (/^RCPT TO/.test(line)) c.write('250 ok\r\n');
        else if (line === 'DATA') { inData = true; c.write('354 go\r\n'); }
        else if (line === 'QUIT') { c.write('221 bye\r\n'); c.end(); }
      }
    });
  });
  return new Promise((ok) => srv.listen(0, () => ok({ srv, got, port: srv.address().port })));
}
const open = (host, port) => new Promise((ok, no) => { const s = net.connect(port, '127.0.0.1', () => ok(Duplex.toWeb(s))); s.on('error', no); });
{
  const f = await fake();
  const r = await smtpSend(open, { port: f.port, user: 'me@gmail.com', pass: 'abcdabcdabcdabcd', from: 'me@gmail.com', fromName: 'אופטימוס', to: 'dana@example.com', subject: 'אופטימוס · קוד האימות שלך: 123456', text: 'שלום דנה,\nהקוד: 123456' });
  check('a mail goes out', !r.error, r);
  check('signed in with the user', f.got.lines.includes(Buffer.from('me@gmail.com').toString('base64')));
  check('envelope to the customer', f.got.lines.includes('RCPT TO:<dana@example.com>'));
  const [head, body] = f.got.data.split('\r\n\r\n');
  const subj = (head.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/) || [])[1];
  check('Hebrew subject, encoded', subj && Buffer.from(subj, 'base64').toString() === 'אופטימוס · קוד האימות שלך: 123456', head);
  check('Hebrew body, base64', Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString() === 'שלום דנה,\nהקוד: 123456');
  f.srv.close();
}
{
  const f = await fake();
  const r = await smtpSend(open, { port: f.port, user: 'me@gmail.com', pass: 'wrongwrongwrongw', to: 'x@example.com', subject: 's', text: 't' });
  check('a wrong password is an error, not a hang', /smtp 535/.test(r.error || ''), r);
  f.srv.close();
}
{
  const f = await fake();
  const r = await smtpSend(open, { port: f.port, user: 'me@gmail.com', pass: 'abcdabcdabcdabcd', verifyOnly: true });
  check('verify signs in and sends nothing', !r.error && !f.got.lines.some((l) => /^MAIL FROM/.test(l)), r);
  f.srv.close();
}
check('no login is an error', (await smtpSend(open, { user: '', pass: '' })).error === 'smtp-no-login');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
