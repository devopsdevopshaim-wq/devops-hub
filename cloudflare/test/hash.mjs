import crypto from 'node:crypto';
// p1$<iterations>$<salt>$<hash>: the format the sign-in code reads
export function adminHash(pw, iter = 10000) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `p1$${iter}$${salt}$` + crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), iter, 32, 'sha256').toString('hex');
}
if (process.argv[2]) process.stdout.write(adminHash(process.argv[2], Number(process.argv[3]) || 10000));
