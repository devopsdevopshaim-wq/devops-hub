// Live network scan: talks to the NetPlan agent running on this computer
// (http://127.0.0.1:8765) and compares what is really on the wire with the plan.
// The agent does the scanning; the browser cannot reach the LAN by itself.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ip = (v) => `<span class="ip">${esc(v)}</span>`;
const ms = (v) => (v === null || v === undefined ? '—' : `<span class="ip">${v < 10 ? Number(v).toFixed(1) : Math.round(v)} ms</span>`);
const SEV = { bad: ['bad', 'קריטי'], warn: ['warn', 'אזהרה'], info: ['info', 'מידע'], ok: ['ok', 'תקין'] };
const PORT_KEY = 'netplan.agentPort';
const ZIP = 'agent/netplan-agent.zip';

function ipInt(s) {
  const p = String(s).split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function ago(t) {
  if (!t) return '—';
  const s = Date.now() / 1000 - t;
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.round(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} שע׳`;
  return `לפני ${Math.round(s / 86400)} ימים`;
}

// Index of everything the plan assigns an address to.
export function planIndex(plan) {
  const byIp = new Map();
  const byMac = new Map();
  const outlets = [];
  if (!plan) return { byIp, byMac, outlets, subnets: [] };
  for (const idf of plan.idfs || []) {
    if (idf.mgmtIp) byIp.set(idf.mgmtIp, { kind: 'switch', label: idf.host || idf.id, where: `ארון ${idf.id}`, vlan: 'ניהול' });
    if (idf.upsIp) byIp.set(idf.upsIp, { kind: 'ups', label: `${idf.id}-UPS`, where: `ארון ${idf.id}`, vlan: 'ניהול' });
    for (const o of idf.outlets || []) {
      const rec = { kind: 'outlet', key: o.label, label: o.label, type: o.type, where: o.roomNo ? `חדר ${o.roomNo}` : (o.room || `ארון ${idf.id}`), vlan: o.vlan, hostname: o.hostname || '', mac: (o.mac || '').toUpperCase(), ip: o.ip, idf: idf.id };
      if (o.ip) byIp.set(o.ip, rec);
      if (rec.mac) byMac.set(rec.mac, rec);
      outlets.push(rec);
      if (o.phoneIp) byIp.set(o.phoneIp, { ...rec, kind: 'phone', key: `${o.label}-PH`, label: `${o.label}-PH`, ip: o.phoneIp, mac: '' });
    }
  }
  for (const s of plan.subnets || []) {
    for (const g of [s.gateway, s.gwA, s.gwB]) if (g) byIp.set(g, { kind: 'gateway', label: `Gateway ${s.name}`, where: s.cidr, vlan: s.vlan });
  }
  const subnets = (plan.subnets || []).filter((s) => s.base !== undefined && s.size).map((s) => ({ base: s.base, size: s.size, cidr: s.cidr, name: s.name, vlan: s.vlan }));
  return { byIp, byMac, outlets, subnets };
}

// Compare live devices with the plan. Exported for tests.
export function compare(devices, plan, lan) {
  const idx = planIndex(plan);
  const rows = [];
  const seenIps = new Set();
  for (const d of devices) {
    if (!d.online) continue;
    seenIps.add(d.ip);
    const p = idx.byIp.get(d.ip);
    const mac = (d.mac || '').toUpperCase();
    const elsewhere = mac && idx.byMac.get(mac);
    let status;
    if (p) {
      if (p.mac && mac && p.mac !== mac) status = 'mac';
      else status = 'match';
    } else if (elsewhere && elsewhere.ip !== d.ip) status = 'moved';
    else status = 'unplanned';
    rows.push({ d, p: p || elsewhere || null, status });
  }
  let net = null;
  if (lan && lan.network) {
    const [b, pre] = lan.network.split('/');
    const base = ipInt(b);
    if (base !== null) net = { base, size: 2 ** (32 - Number(pre)) };
  }
  const inLan = (s) => { const n = ipInt(s); return net && n !== null && n >= net.base && n < net.base + net.size; };
  const overlaps = net ? idx.subnets.filter((s) => s.base < net.base + net.size && net.base < s.base + s.size) : [];
  const missing = net ? idx.outlets.filter((o) => o.ip && inLan(o.ip) && !seenIps.has(o.ip)) : [];
  const count = (k) => rows.filter((r) => r.status === k).length;
  return { rows, overlaps, missing, counts: { match: count('match'), mac: count('mac'), moved: count('moved'), unplanned: count('unplanned') } };
}

export function createLive({ root, getPlan, applyToPlan, goMonitor, toast }) {
  let port = Number(localStorage.getItem(PORT_KEY)) || 8765;
  let S = null;
  let connected = false;
  let lastErr = '';
  let timer = null;
  let busy = false;
  let filter = 'all';
  let lastHtml = '';
  const base = () => `http://127.0.0.1:${port}`;

  async function call(path, body) {
    const r = await fetch(base() + path, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-NetPlan': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 409) throw Object.assign(new Error('busy'), { busy: true });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function poll() {
    if (busy) return;
    busy = true;
    try {
      S = await call('/api/state?since=0');
      connected = true;
      lastErr = '';
    } catch (e) {
      connected = false;
      lastErr = e.message;
    } finally {
      busy = false;
    }
    render();
  }

  async function act(path, body = {}, msg = 'הפעולה התחילה') {
    try {
      const r = await call(path, body);
      toast?.(r.started === false ? 'פעולה אחרת עדיין רצה' : msg);
      poll();
      return r;
    } catch (e) {
      toast?.(e.busy ? 'פעולה אחרת עדיין רצה – נסה שוב בעוד רגע' : 'אין חיבור לסוכן');
      return null;
    }
  }

  // ------------------------------------------------------------ views
  function offline() {
    const isMac = /Mac/.test(navigator.platform);
    const isWin = /Win/.test(navigator.platform);
    return `<div class="card">
      <h3>הסוכן המקומי לא מחובר</h3>
      <p class="muted">אתר הדפדפן לא יכול לסרוק את הרשת בעצמו. סוכן קטן במחשב (NetPlan Agent) סורק אותה, וזה המסך שמציג את התוצאות ומשווה אותן לתכנית. ${lastErr ? `<span class="small">(${esc(lastErr)})</span>` : ''}</p>
      <ol class="live-steps">
        <li><b>הורדה:</b> <a class="btn sm" href="${ZIP}" download>הורדת הסוכן (ZIP)</a> ופריסה לתיקייה.</li>
        <li><b>Python:</b> ${isWin ? 'התקנת Python 3.10+ מ-<a href="https://www.python.org/downloads/" target="_blank" rel="noopener">python.org</a> (לסמן "Add python.exe to PATH").' : isMac ? 'macOS: <code>brew install python</code> או מ-python.org.' : 'Python 3.10 ומעלה (בדרך כלל כבר מותקן).'}</li>
        <li><b>הפעלה:</b> ${isWin ? 'לחיצה כפולה על <code>start.bat</code>' : '<code>./start.sh</code>'}. כדי שהסוכן יעלה עם המחשב ויזהה כל חיבור כבל: ${isWin ? '<code>start.bat --install-autostart</code>' : '<code>./start.sh --install-autostart</code>'}.</li>
        <li><b>אישור בדפדפן:</b> Chrome ו-Edge שואלים פעם אחת אם לאפשר לאתר גישה ל"מכשירים ברשת המקומית" – יש לאשר. ב-Safari המסך הזה לא נתמך; אפשר להשתמש בלוח המלא של הסוכן.</li>
      </ol>
      <div class="toolbar" style="margin-top:12px">
        <div class="field"><label for="liveAgentPort">פורט הסוכן</label><input id="liveAgentPort" type="number" min="1024" max="65535" value="${port}" dir="ltr" style="width:110px"></div>
        <button class="btn primary" data-live="retry">התחברות</button>
        <a class="btn" href="${base()}/" target="_blank" rel="noopener">פתיחת הלוח המלא של הסוכן</a>
      </div>
      <p class="small muted">הסוכן מאזין רק במחשב עצמו (127.0.0.1), מקבל בקשות רק מהאתר הזה, ושומר את כל הנתונים מקומית.</p>
    </div>`;
  }

  function kpi(l, v, sub = '', cls = '') {
    return `<div class="kpi ${cls}"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${sub}</div></div>`;
  }

  function findings(list, max) {
    if (!list.length) return '<div class="alert ok"><div>לא זוהו תקלות תקשורת. הסוכן ממשיך לנטר ברקע.</div></div>';
    return list.slice(0, max).map((f) => {
      const [cls, lbl] = SEV[f.severity || f.status] || SEV.info;
      const steps = f.steps || f.fix || [];
      return `<div class="alert ${cls === 'ok' ? 'ok' : cls}"><div><b>${lbl}: ${esc(f.title)}</b><div class="small">${esc(f.text)}</div>
        ${steps.length ? `<details><summary class="small">איך מתקנים</summary><ol class="small">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${(f.commands || []).map((c) => `<pre class="codebox" dir="ltr">${esc(c)}</pre>`).join('')}</details>` : ''}</div></div>`;
    }).join('');
  }

  const STATUS = {
    match: ['ok', 'תואם לתכנית'], mac: ['bad', 'MAC שונה מהמתוכנן'], moved: ['warn', 'מכשיר מוכר בכתובת אחרת'], unplanned: ['warn', 'לא בתכנית'],
  };

  function online() {
    const lan = S.lan;
    const plan = getPlan();
    const devs = S.devices || [];
    const on = devs.filter((d) => d.online);
    const sec = S.security;
    const iss = (S.quick || []).concat(((S.diag || {}).findings || []).filter((f) => !(S.quick || []).some((q) => q.id === f.id)));
    const st = S.stats || {};
    const pub = S.public || {};
    const p = S.progress || {};
    const cmp = compare(devs, plan, lan);
    const i = lan ? lan.iface : null;
    const kind = !i ? 'אין חיבור' : i.kind === 'ethernet' ? 'כבל רשת' : i.kind === 'wifi' ? `Wi-Fi ${esc(i.ssid || '')}` : esc(i.kind);
    const rows = cmp.rows.filter((r) => filter === 'all' || r.status === filter);
    const chip = (k, t, n) => `<button class="chip ${filter === k ? 'on' : ''}" data-live-filter="${k}" aria-pressed="${filter === k}">${t}${n !== undefined ? ` (${n})` : ''}</button>`;
    const planName = plan?.cfg?.site?.name || 'הפרויקט הפעיל';

    return `
    <div class="toolbar">
      <button class="btn primary" data-live="full" ${p.running ? 'disabled' : ''}>סריקה מלאה</button>
      <button class="btn" data-live="devices" ${p.running ? 'disabled' : ''}>סריקת מכשירים</button>
      <button class="btn" data-live="security" ${p.running ? 'disabled' : ''}>בדיקת אבטחה</button>
      <button class="btn" data-live="diag" ${p.running ? 'disabled' : ''}>בדיקת תקלות</button>
      <a class="btn" href="${base()}/" target="_blank" rel="noopener">הלוח המלא של הסוכן</a>
      <button class="btn" data-live="monitor">חיבור לניטור התעבורה</button>
      ${p.running ? `<span class="live-prog" role="status"><i style="width:${p.pct || 0}%"></i><span>${esc(p.msg || '')}</span></span>` : ''}
    </div>
    ${!lan ? `<div class="alert bad"><div><b>המחשב לא מחובר לרשת.</b> חבר כבל – הסוכן יזהה את החיבור ויסרוק אוטומטית.</div></div>` : ''}
    <div class="kpis">
      ${kpi('חיבור', kind, i && i.speed ? `<span class="ip">${i.speed >= 1000 ? i.speed / 1000 + ' Gbps' : i.speed + ' Mbps'}</span>` : '')}
      ${kpi('כתובת המחשב', lan ? ip(`${lan.ip}/${lan.prefix}`) : '—', lan ? `ראוטר ${ip(lan.gateway || '—')}` : '')}
      ${kpi('מכשירים פעילים', on.length, S.scan ? `סריקה ${ago(S.scan.t)}` : 'טרם נסרק')}
      ${kpi('ציון אבטחה', sec ? `${sec.score}/100` : '—', sec ? `${sec.counts.bad} קריטי · ${sec.counts.warn} אזהרות` : '', sec ? (sec.score >= 85 ? 'ok' : sec.score >= 60 ? 'warn' : 'bad') : '')}
      ${kpi('תקלות', iss.length, iss.length ? iss.filter((f) => f.severity === 'bad').length + ' קריטיות' : 'הכול תקין', iss.some((f) => f.severity === 'bad') ? 'bad' : iss.length ? 'warn' : 'ok')}
      ${kpi('השהיה לאינטרנט', ms((st.inet || {}).avg), `ראוטר ${ms((st.gw || {}).avg)} · DNS ${ms((st.dns || {}).avg)}`)}
    </div>
    <div class="grid g2">
      <div class="card"><h3>פרטי החיבור</h3>
        ${lan ? `<div class="table-wrap"><table><tbody>
          <tr><th>ממשק</th><td>${esc(i.description || i.name)}</td></tr>
          <tr><th>רשת</th><td>${ip(lan.network)} · מסכה ${ip(lan.netmask)}</td></tr>
          <tr><th>ראוטר</th><td>${ip(lan.gateway || '—')}</td></tr>
          <tr><th>DNS</th><td>${ip(((S.snapshot || {}).dns || []).join(', ') || '—')}</td></tr>
          <tr><th>MAC</th><td>${ip(i.mac || '—')}</td></tr>
          <tr><th>הקצאה</th><td>${i.dhcp === true ? 'DHCP' : i.dhcp === false ? 'כתובת קבועה' : 'לא ידוע'}${i.dhcp_server ? ' · שרת ' + ip(i.dhcp_server) : ''}</td></tr>
          <tr><th>IP ציבורי</th><td>${ip(pub.ip || '—')} ${esc(pub.isp || '')}</td></tr>
          <tr><th>VPN</th><td>${(S.snapshot || {}).vpn_active ? 'פעיל' : 'לא פעיל'}</td></tr>
        </tbody></table></div>` : '<p class="muted">אין חיבור פעיל</p>'}
      </div>
      <div class="card"><h3>תקלות ופתרונות</h3>${findings(iss, 4)}</div>
    </div>

    <div class="card">
      <h3>השוואה לתכנית: ${esc(planName)}</h3>
      ${lan && !cmp.overlaps.length ? `<div class="alert info"><div>הרשת שהמחשב מחובר אליה (${ip(lan.network)}) לא מופיעה בתכנית של הפרויקט הפעיל. כל המכשירים יסומנו "לא בתכנית". אם זו רשת של פרויקט אחר – בחר אותו בבורר הפרויקטים.</div></div>` : ''}
      ${cmp.overlaps.length ? `<p class="small muted">רשתות בתכנית שחופפות לרשת הנוכחית: ${cmp.overlaps.slice(0, 6).map((s) => `${esc(s.name)} ${ip(s.cidr)}`).join(' · ')}</p>` : ''}
      <div class="chips live-chips" role="group" aria-label="סינון">
        ${chip('all', 'הכול', cmp.rows.length)}${chip('match', 'תואמים', cmp.counts.match)}${chip('unplanned', 'לא בתכנית', cmp.counts.unplanned)}${chip('moved', 'בכתובת אחרת', cmp.counts.moved)}${chip('mac', 'MAC שונה', cmp.counts.mac)}
      </div>
      <div class="table-wrap tall"><table>
        <thead><tr><th>IP</th><th>מכשיר</th><th>יצרן</th><th>MAC</th><th>פורטים</th><th>בתכנית</th><th>מצב</th><th></th></tr></thead>
        <tbody>${rows.map(({ d, p: pp, status }) => {
          const [cls, txt] = STATUS[status];
          const canSave = pp && pp.kind === 'outlet' && status === 'match' && d.mac && !pp.mac && !d.random_mac;
          const risk = (d.risks || []).filter((r) => r.severity !== 'info');
          return `<tr>
            <td class="ip">${esc(d.ip)}</td>
            <td><b>${esc(d.alias || d.name || d.type_label)}</b><div class="small muted">${esc(d.type_label)}${d.self ? ' · המחשב הזה' : ''}${d.is_gateway ? ' · ראוטר' : ''}</div></td>
            <td>${esc(d.vendor || (d.random_mac ? 'MAC אקראי' : '—'))}</td>
            <td class="ip">${esc(d.mac || '—')}</td>
            <td class="small">${(d.ports || []).slice(0, 8).join(', ') || '—'}${risk.length ? `<div><span class="chip st-warn" title="${esc(risk.map((r) => r.text).join(' | '))}">${risk.length} ממצאים</span></div>` : ''}</td>
            <td>${pp ? `<b>${esc(pp.label)}</b><div class="small muted">${esc(pp.where || '')}${pp.vlan !== undefined && pp.vlan !== null ? ' · VLAN ' + esc(pp.vlan) : ''}${status === 'moved' ? ' · מתוכנן ב-' + ip(pp.ip) : ''}</div>` : '<span class="muted">—</span>'}</td>
            <td><span class="chip st-${cls}">${txt}</span></td>
            <td>${canSave ? `<button class="btn sm" data-live-save="${esc(pp.key)}" data-mac="${esc(d.mac)}" data-host="${esc(d.name || '')}">שמירת MAC בתכנית</button>` : ''}</td>
          </tr>`;
        }).join('') || `<tr><td colspan="8" class="muted">${S.scan ? 'אין מכשירים בסינון הזה' : 'טרם בוצעה סריקה'}</td></tr>`}</tbody>
      </table></div>
      ${cmp.missing.length ? `<details style="margin-top:10px"><summary><b>${cmp.missing.length} נקודות מתוכננות ברשת הזו שלא נמצא בהן מכשיר פעיל</b></summary>
        <p class="small muted">זה תקין לשקע ריק או למכשיר כבוי. לנקודות שאמורות לפעול (מצלמות, נקודות גישה, טלפונים): כדאי לבדוק כבל, PoE ו-VLAN.</p>
        <div class="table-wrap"><table><thead><tr><th>נקודה</th><th>מיקום</th><th>IP</th><th>VLAN</th></tr></thead><tbody>
        ${cmp.missing.slice(0, 200).map((o) => `<tr><td>${esc(o.label)}</td><td>${esc(o.where)}</td><td class="ip">${esc(o.ip)}</td><td>${esc(o.vlan ?? '')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    </div>

    <div class="grid g2">
      <div class="card"><h3>אבטחה וזליגה</h3>
        ${sec ? findings(sec.checks.filter((c) => c.status === 'bad' || c.status === 'warn').map((c) => ({ ...c, severity: c.status })), 6) + `<p class="small muted">${sec.counts.ok} בדיקות תקינות · נבדק ${ago(sec.t)}</p>` : '<p class="muted">טרם בוצעה בדיקת אבטחה</p>'}
      </div>
      <div class="card"><h3>מסלול לאינטרנט</h3>
        ${S.trace && (S.trace.hops || []).length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>כתובת</th><th>תפקיד</th><th>השהיה</th></tr></thead><tbody>
          ${S.trace.hops.map((h) => `<tr><td>${h.hop}</td><td class="ip">${esc(h.ip || '* * *')}</td><td class="small">${esc(h.role || '')}</td><td>${ms(h.rtt)}</td></tr>`).join('')}</tbody></table></div>
          ${(S.trace.findings || []).map((f) => `<div class="alert ${f.severity === 'info' ? 'info' : 'warn'}" style="margin-top:8px"><div><b>${esc(f.title)}</b><div class="small">${esc(f.text)}</div></div></div>`).join('')}` : '<p class="muted">טרם בוצעה בדיקת מסלול</p>'}
      </div>
    </div>
    <div class="card"><h3>אירועים אחרונים</h3>
      ${(S.events || []).slice(0, 10).map((e) => `<div class="live-ev"><span class="live-dot ${esc(e.level)}"></span><span class="small muted">${new Date(e.t * 1000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span> ${esc(e.text)}</div>`).join('') || '<p class="muted">אין אירועים</p>'}
    </div>`;
  }

  function render() {
    if (!root || root.hidden) return;
    const badge = document.getElementById('liveBadge');
    if (badge) {
      badge.className = connected ? 'badge-sim badge-live' : 'badge-sim';
      badge.innerHTML = `<span class="pulse" aria-hidden="true"></span> ${connected ? `סוכן מחובר · ${esc(S.app.hostname)}` : 'הסוכן לא מחובר'}`;
    }
    const body = document.getElementById('liveBody');
    if (!body) return;
    const ae = document.activeElement;
    if (ae && body.contains(ae) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(ae.tagName)) return;
    const html = connected ? online() : offline();
    if (html === lastHtml) return;
    const open = [...body.querySelectorAll('details')].map((d) => d.open);
    body.innerHTML = html;
    lastHtml = html;
    body.querySelectorAll('details').forEach((d, k) => { if (open[k]) d.open = true; });
  }

  root?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-live],[data-live-filter],[data-live-save]');
    if (!b) return;
    if (b.dataset.liveFilter) { filter = b.dataset.liveFilter; lastHtml = ''; render(); return; }
    if (b.dataset.liveSave) {
      applyToPlan(b.dataset.liveSave, { mac: b.dataset.mac, hostname: b.dataset.host });
      lastHtml = '';
      render();
      return;
    }
    const a = b.dataset.live;
    if (a === 'retry') {
      const v = Number(document.getElementById('liveAgentPort')?.value);
      if (v >= 1024 && v <= 65535) { port = v; try { localStorage.setItem(PORT_KEY, String(v)); } catch { /* ignore */ } }
      lastHtml = '';
      poll();
    } else if (a === 'full') act('/api/scan/full', {}, 'סריקה מלאה התחילה');
    else if (a === 'devices') act('/api/scan/devices', {}, 'סריקת מכשירים התחילה');
    else if (a === 'security') act('/api/scan/security', {}, 'בדיקת אבטחה התחילה');
    else if (a === 'diag') act('/api/diagnose', { speed: false }, 'בדיקת תקלות התחילה');
    else if (a === 'monitor') goMonitor?.(`${base()}/api/traffic.json`);
  });

  return {
    show() { lastHtml = ''; poll(); clearInterval(timer); timer = setInterval(poll, 3000); },
    hide() { clearInterval(timer); timer = null; },
    refresh() { lastHtml = ''; render(); },
  };
}
