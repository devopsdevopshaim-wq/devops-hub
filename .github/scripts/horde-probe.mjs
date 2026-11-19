// What AI Horde says now: the account (kudos, priority), the image models with workers and queue, and one img2img's place in the queue.
const KEY = process.env.AI_HORDE_KEY || '0000000000', H = { apikey: KEY, 'Client-Agent': 'optimus-frame-studio:1:frame-magnets', 'Content-Type': 'application/json' };
const j = async (u, o) => { const r = await fetch('https://aihorde.net/api/v2' + u, Object.assign({ headers: H }, o)); return r.json().catch(() => ({ status: r.status })); };
const me = await j('/find_user');
console.log('account:', JSON.stringify({ name: me.username ? me.username.replace(/#.*/, '#…') : me.message, kudos: me.kudos, trusted: me.trusted, worker_count: me.worker_count, usage: me.records && me.records.request }));
const ms = await j('/status/models?type=image');
const top = (Array.isArray(ms) ? ms : []).sort((a, z) => z.count - a.count).slice(0, 15).map((m) => m.name + ' w=' + m.count + ' q=' + m.queued + ' eta=' + m.eta + 's');
console.log('models:\n ' + top.join('\n '));
const xl = (Array.isArray(ms) ? ms : []).filter((m) => /XL/i.test(m.name)).sort((a, z) => z.count - a.count).slice(0, 5).map((m) => m.name + ' w=' + m.count + ' eta=' + m.eta + 's');
console.log('SDXL:\n ' + xl.join('\n '));
const perf = await j('/status/performance'); console.log('horde:', JSON.stringify(perf));
