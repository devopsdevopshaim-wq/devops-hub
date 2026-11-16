// פריים מגנטים: the phone's AI designs made by the studio's own computer (v170).
// A phone has no AI engine of its own. When the cloud's free allowance is used up (or the owner asks), the phone leaves the job
// here; the desktop program on the same account, with its local engine, takes it, makes the picture on its graphics card and
// leaves the answer; the phone collects it. Nothing goes from device to device directly, so the phone and the computer do not
// have to be on the same network. Everything is per account (the session's email): another account never sees a job.
//   relay-beat  {name, ready}     the computer: "I am here" (also every relay-take)
//   relay-state                   the phone: is a computer on this account answering now?
//   relay-put   {body}            the phone: a job ({action: 'restyle'|'image', prompt, image, w, h, ...}) → {id}
//   relay-take                    the computer: the next job → {job: {id, body}} or {job: null}
//   relay-done  {id, result}      the computer: the answer ({ok, image, mime, source} or {ok: false, error})
//   relay-get   {id}              the phone: the job's state, and the answer once it is there (then the job is removed)
// Jobs live 15 minutes; at most 24 waiting per account; a job taken and not answered in 6 minutes is offered again.
import { FrameStore } from './frame.mjs';

const ID = /^[a-z0-9]{8,24}$/;
const LIVE = 20000, KEEP = 15 * 60000, RETAKE = 6 * 60000, MAX_JOBS = 24, MAX_IN = 6500000, MAX_OUT = 9000000;
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').slice(0, n || 60);

export async function relayCall(storage, who, b, now) {
  now = now || Date.now();
  const out = (body, code) => ({ code: code || 200, body });
  if (!who || !who.email) return out({ ok: false, error: 'signed-out' }, 401);
  if (who.role !== 'admin' && who.role !== 'studio') return out({ ok: false, error: 'not-allowed' }, 403);
  const me = String(who.email).toLowerCase(), st = new FrameStore(storage), a = String(b.action || '');
  const QK = 'rly:q:' + me, BK = 'rly:beat:' + me;
  let q = (await storage.get(QK)) || [];
  // the old ones go, with what they hold
  const old = q.filter((j) => now - j.at > KEEP);
  if (old.length) { for (const j of old) { await st.delBig('rly:in:' + me + ':' + j.id); await st.delBig('rly:out:' + me + ':' + j.id); } q = q.filter((j) => now - j.at <= KEEP); await storage.put(QK, q); }
  const beat = async (name, ready) => { const v = { at: now, name: clean(name || 'המחשב', 40), ready: ready !== false }; await storage.put(BK, v); return v; };

  if (a === 'relay-beat') { await beat(b.name, b.ready); return out({ ok: true, waiting: q.filter((j) => j.state === 'wait').length }); }
  if (a === 'relay-state') {
    const v = (await storage.get(BK)) || null, on = !!(v && now - v.at < LIVE && v.ready);
    return out({ ok: true, online: on, name: v ? v.name : '', seen: v ? v.at : 0, waiting: q.filter((j) => j.state === 'wait').length });
  }
  if (a === 'relay-put') {
    const body = b.body;
    if (!body || typeof body !== 'object' || !/^(restyle|image)$/.test(String(body.action || ''))) return out({ ok: false, error: 'bad-input' }, 400);
    const s = JSON.stringify(body); if (s.length > MAX_IN) return out({ ok: false, error: 'too-big' }, 413);
    if (q.filter((j) => j.state === 'wait' || j.state === 'run').length >= MAX_JOBS) return out({ ok: false, error: 'busy' }, 429);
    const id = (now.toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20);
    await st.putBig('rly:in:' + me + ':' + id, s);
    q.push({ id, at: now, state: 'wait' }); await storage.put(QK, q);
    return out({ ok: true, id, ahead: q.filter((j) => j.state === 'wait' || j.state === 'run').length - 1 });
  }
  if (a === 'relay-take') {
    await beat(b.name, b.ready);
    const j = q.find((x) => x.state === 'wait') || q.find((x) => x.state === 'run' && now - (x.took || 0) > RETAKE);
    if (!j) return out({ ok: true, job: null });
    const s = await st.getBig('rly:in:' + me + ':' + j.id);
    if (!s) { q = q.filter((x) => x.id !== j.id); await storage.put(QK, q); return out({ ok: true, job: null }); }
    j.state = 'run'; j.took = now; await storage.put(QK, q);
    return out({ ok: true, job: { id: j.id, body: JSON.parse(s) } });
  }
  if (a === 'relay-done') {
    const id = String(b.id || ''); if (!ID.test(id)) return out({ ok: false, error: 'bad-input' }, 400);
    const j = q.find((x) => x.id === id); if (!j) return out({ ok: false, error: 'not-found' }, 404);
    const r = b.result && typeof b.result === 'object' ? b.result : { ok: false, error: 'local-failed' };
    const keep = r.ok ? { ok: true, image: String(r.image || ''), mime: clean(r.mime || 'image/png', 30), source: 'המחשב בעמדה', model: clean(r.model, 40) } : { ok: false, error: clean(r.error || 'local-failed', 40), detail: clean(r.detail, 200) };
    const s = JSON.stringify(keep); if (s.length > MAX_OUT) return out({ ok: false, error: 'too-big' }, 413);
    await st.putBig('rly:out:' + me + ':' + id, s); await st.delBig('rly:in:' + me + ':' + id);
    j.state = keep.ok ? 'done' : 'fail'; j.doneAt = now; await storage.put(QK, q);
    return out({ ok: true });
  }
  if (a === 'relay-get') {
    const id = String(b.id || ''); if (!ID.test(id)) return out({ ok: false, error: 'bad-input' }, 400);
    const j = q.find((x) => x.id === id); if (!j) return out({ ok: false, error: 'not-found' }, 404);
    if (j.state === 'done' || j.state === 'fail') {
      const s = await st.getBig('rly:out:' + me + ':' + id);
      await st.delBig('rly:out:' + me + ':' + id); q = q.filter((x) => x.id !== id); await storage.put(QK, q);
      return out({ ok: true, state: j.state, result: s ? JSON.parse(s) : { ok: false, error: 'local-failed' } });
    }
    const ahead = q.filter((x) => (x.state === 'wait' || x.state === 'run') && x.at < j.at).length;
    const v = (await storage.get(BK)) || null;
    return out({ ok: true, state: j.state, ahead, online: !!(v && now - v.at < LIVE && v.ready) });
  }
  return out({ ok: false, error: 'bad-action' }, 400);
}
