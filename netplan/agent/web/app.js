/* NetPlan dashboard – vanilla JS, no build step. */
const NP = (() => {
  let S = null;            // latest state from the engine
  let demo = false;
  let view = (location.hash || '#overview').slice(1);
  let events = [];
  let lastEv = 0;
  let first = true;
  let drawerId = null;
  let devFilter = { q: '', type: 'all', status: 'online' };
  let evFilter = 'all';
  let prevProgress = false;
  let lastHtml = '';
  let drawerSig = '';
  let drawerDirty = false;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ icons
  const IC = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    devices: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6M9 14v4"/><rect x="17" y="8" width="5" height="12" rx="1.2"/>',
    plan: '<circle cx="12" cy="4.5" r="2"/><circle cx="4.5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M12 6.5V12M4.5 17v-2.5h15V17M12 12v5"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
    security: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
    diag: '<path d="M3 12h4l2.5-6 4 13 2.5-7H21"/>',
    events: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    router: '<rect x="2.5" y="13" width="19" height="7" rx="2"/><path d="M6.5 16.5h.01M10 16.5h.01M7 13l-2-7M17 13l2-7M9 8.5a4.5 4.5 0 0 1 6 0"/>',
    switch: '<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    nas: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 7h7M8.5 11h7M12 17h.01"/>',
    pc: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 14h12v7H6z"/>',
    camera: '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8"/>',
    speaker: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14.5" r="3"/><path d="M12 7h.01"/>',
    iot: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/>',
    console: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.6 6.2a2.9 2.9 0 0 0 5.3 1.9L9 15h6l1.6 1.7a2.9 2.9 0 0 0 5.3-1.9l-.6-6.2A4 4 0 0 0 17.3 5Z"/>',
    unknown: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.7 2.6-2.7 2.6M12 17h.01"/>',
    cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.2-8.8A6 6 0 1 0 6 16.5"/><path d="M6 16.5A2.5 2.5 0 0 0 6.5 19h11"/>',
    cable: '<path d="M8 3v4M16 3v4M6 7h12v5a6 6 0 0 1-12 0V7ZM12 18v3"/>',
    wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
    nolink: '<path d="M8 3v4M16 3v4M6 7h12v5a6 6 0 0 1-12 0V7ZM12 18v3M3 3l18 18"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    ok: '<circle cx="12" cy="12" r="9.5"/><path d="m8 12 3 3 5-6"/>',
  };
  const svg = (n, s = 18, w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || IC.unknown}</svg>`;

  // ------------------------------------------------------------------ utils
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ltr = (v) => `<span class="ltr">${esc(v)}</span>`;
  const ms = (v) => (v === null || v === undefined ? '—' : `<span class="ltr">${v < 10 ? v.toFixed(1) : Math.round(v)} ms</span>`);
  const BIDI_RE = /((?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}|\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+|\/\d+)?\b|\b\d+(?:\.\d+)?\s?(?:ms|Mbps|Gbps)\b|[A-Za-z0-9_.-]+\.(?:exe|com|net|local)\b)/g;
  const bidi = (v) => esc(v).replace(BIDI_RE, (m) => `<span class="ltr">${m}</span>`);
  const speed = (v) => `<span class="ltr">${v >= 1000 ? v / 1000 + ' Gbps' : v + ' Mbps'}</span>`;
  const hhmm = (t) => (t ? new Date(t * 1000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');
  const dt = (t) => (t ? new Date(t * 1000).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  function ago(t) {
    if (!t) return '—';
    const s = Date.now() / 1000 - t;
    if (s < 60) return 'עכשיו';
    if (s < 3600) return `לפני ${Math.round(s / 60)} דק׳`;
    if (s < 86400) return `לפני ${Math.round(s / 3600)} שע׳`;
    return `לפני ${Math.round(s / 86400)} ימים`;
  }
  const SEV = { bad: 'קריטי', warn: 'אזהרה', info: 'מידע', ok: 'תקין' };
  const KIND = { ethernet: 'כבל רשת (Ethernet)', wifi: 'Wi-Fi', vpn: 'VPN', virtual: 'וירטואלי', other: 'אחר' };

  async function api(path, body) {
    if (demo) { toast('במצב הדגמה הפעולות לא זמינות – הפעל את NetPlan במחשב שלך.', 'warn'); return null; }
    const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-NetPlan': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 409) { toast('פעולה אחרת עדיין רצה – נסה שוב בעוד רגע.', 'warn'); return null; }
    return r.json();
  }

  function toast(text, level = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + level;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  function notify(e) {
    if (!S || !S.settings) return;
    const want = (e.kind === 'new_device' && S.settings.notify_new_device) ||
      (['bad', 'warn'].includes(e.level) && S.settings.notify_issues) ||
      ['cable_in', 'connected', 'link_down'].includes(e.kind);
    if (!want) return;
    toast(e.text, e.level);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('NetPlan', { body: e.text, icon: 'icon.svg', tag: 'np-' + e.id });
      }
    } catch (err) { /* ignore */ }
  }

  // ------------------------------------------------------------------ data
  async function load() {
    try {
      if (demo) { S = window.NETPLAN_DEMO.tick(); }
      else {
        const r = await fetch('/api/state?since=' + lastEv, { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        S = await r.json();
      }
    } catch (e) {
      if (first && window.NETPLAN_DEMO) {
        demo = true;
        S = window.NETPLAN_DEMO.tick();
      } else {
        $('banner').innerHTML = '<div class="banner"><b>אין קשר לשירות NetPlan.</b> ודא שהתוכנה פועלת במחשב (netplan.py).</div>';
        return;
      }
    }
    const fresh = (S.events || []).filter((e) => e.id > lastEv).sort((a, b) => a.id - b.id);
    if (!first) fresh.forEach(notify);
    if (fresh.length) {
      events = fresh.reverse().concat(events).slice(0, 400);
      lastEv = Math.max(lastEv, ...fresh.map((e) => e.id));
    } else if (first) events = S.events || [];
    if (prevProgress && !S.progress.running) toast(S.progress.msg || 'הפעולה הושלמה', 'ok');
    prevProgress = S.progress.running;
    first = false;
    render();
  }

  // ------------------------------------------------------------------ chrome
  const VIEWS = [
    ['overview', 'סקירה'], ['devices', 'התקנים'], ['plan', 'נט פלאן – מפת רשת'], ['route', 'מסלול ונתבים'],
    ['security', 'אבטחה וזליגה'], ['diag', 'תקלות ופתרונות'], ['events', 'יומן אירועים'], ['settings', 'הגדרות'],
  ];

  function issues() {
    const q = S.quick || [];
    const full = ((S.diag || {}).findings || []).filter((f) => !q.some((x) => x.id === f.id));
    return q.concat(full);
  }

  function renderChrome() {
    const devs = S.devices || [];
    const online = devs.filter((d) => d.online);
    const unapproved = online.filter((d) => !d.approved).length;
    const iss = issues();
    const bad = iss.filter((f) => f.severity === 'bad').length;
    const secBad = ((S.security || {}).checks || []).filter((c) => c.status === 'bad' || c.status === 'warn').length;
    const counts = {
      devices: online.length ? `<span class="cnt">${online.length}</span>` : '',
      security: secBad ? `<span class="cnt ${((S.security || {}).counts || {}).bad ? 'bad' : 'warn'}">${secBad}</span>` : '',
      diag: iss.length ? `<span class="cnt ${bad ? 'bad' : 'warn'}">${iss.length}</span>` : '',
    };
    const icons = { overview: 'overview', devices: 'devices', plan: 'plan', route: 'route', security: 'security', diag: 'diag', events: 'events', settings: 'settings' };
    $('nav').innerHTML = VIEWS.map(([k, t]) => `<button class="nav ${view === k ? 'on' : ''}" onclick="NP.go('${k}')">${svg(icons[k])}<span>${t}</span>${counts[k] || ''}</button>`).join('');
    $('title').textContent = (VIEWS.find((v) => v[0] === view) || VIEWS[0])[1];
    const net = S.network;
    $('netname').innerHTML = net ? `${esc(net.name)} · ${unapproved ? `<span style="color:var(--warn)">${unapproved} מכשירים לא מאושרים</span>` : 'כל המכשירים מאושרים'}` : 'לא מחובר לרשת';
    const lan = S.lan;
    let pill;
    if (!lan) pill = `<span class="pill bad"><i class="dot"></i>אין חיבור רשת</span>`;
    else {
      const i = lan.iface;
      const kind = i.kind === 'ethernet' ? 'מחובר בכבל' : i.kind === 'wifi' ? 'Wi-Fi' : i.kind;
      const cls = bad ? 'warn' : 'ok';
      pill = `<span class="pill ${cls}"><i class="dot"></i>${kind}${i.speed ? ' · ' + speed(i.speed) : ''}</span>`;
    }
    $('linkpill').innerHTML = pill;
    const p = S.progress || {};
    $('prog').classList.toggle('hidden', !p.running);
    $('progbar').style.width = (p.pct || 0) + '%';
    $('progmsg').textContent = p.msg || '';
    $('scanbtn').disabled = !!p.running;
    $('foot').innerHTML = `${demo ? 'מצב הדגמה' : 'פועל מקומית · ' + esc(S.app.hostname)}<br>גרסה ${esc(S.app.version)} · ${esc(S.app.os)}`;
    $('banner').innerHTML = demo
      ? `<div class="banner"><b>מצב הדגמה</b> – הנתונים כאן לדוגמה. כדי לראות את הרשת שלך הורד את NetPlan והפעל אותה במחשב (start.bat / start.sh). <a href="https://devopsdevopshaim-wq.github.io/devops-hub/netplan/#livescan" target="_blank" rel="noopener">הוראות והורדה</a></div>`
      : (!S.app.ping ? '<div class="banner">פקודת ping לא נמצאה במחשב – הסריקה משתמשת בבדיקת TCP בלבד (איטית מעט יותר).</div>' : '');
  }

  function render() {
    if (!S) return;
    renderChrome();
    const v = $('view');
    const ae = document.activeElement;
    if (ae && v.contains(ae) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) && ae.dataset.live !== '1') return;
    const fn = { overview: vOverview, devices: vDevices, plan: vPlan, route: vRoute, security: vSecurity, diag: vDiag, events: vEvents, settings: vSettings }[view] || vOverview;
    const y = window.scrollY;
    const openDet = [...v.querySelectorAll('details')].map((d, i) => (d.open ? i : -1)).filter((i) => i >= 0);
    const html = fn();
    if (html !== lastHtml) {
      v.innerHTML = html;
      lastHtml = html;
      const dets = v.querySelectorAll('details');
      openDet.forEach((i) => { if (dets[i]) dets[i].open = true; });
      window.scrollTo(0, y);
    }
    if (drawerId && !$('drawer').contains(document.activeElement)) renderDrawer();
  }

  // ------------------------------------------------------------------ overview
  function connCard() {
    const lan = S.lan;
    if (!lan) {
      const q = (S.quick || [])[0];
      return `<div class="card conn"><div class="big bad">${svg('nolink', 40)}</div><div><h2>אין חיבור רשת</h2>
        <div class="muted">${esc(q ? q.text : 'חבר כבל רשת – NetPlan יזהה את החיבור ויסרוק אוטומטית.')}</div>
        ${q && q.steps ? '<ol>' + q.steps.map((s) => `<li>${esc(s)}</li>`).join('') + '</ol>' : ''}</div></div>`;
    }
    const i = lan.iface;
    const pub = S.public || {};
    const iss = issues().filter((f) => f.severity === 'bad');
    const cls = iss.length ? 'bad' : '';
    const kind = i.kind === 'ethernet' ? 'cable' : i.kind === 'wifi' ? 'wifi' : 'cable';
    const dns = (S.snapshot || {}).dns || [];
    const vpn = (S.snapshot || {}).vpn_active ? `<span class="badge info">VPN פעיל: ${esc((S.snapshot.vpn_ifaces || []).join(', '))}</span>` : '';
    return `<div class="card conn"><div class="big ${cls}">${svg(kind, 40)}</div><div>
      <h2>${i.kind === 'ethernet' ? 'מחובר בכבל רשת' : i.kind === 'wifi' ? 'מחובר ל־Wi-Fi ' + esc(i.ssid || '') : 'מחובר'} ${iss.length ? `<span class="badge bad">${iss.length} תקלות</span>` : '<span class="badge ok">תקין</span>'} ${vpn}</h2>
      <div class="muted">${esc(i.description || i.name)} · ${esc(KIND[i.kind] || i.kind)}</div>
      <div class="kv">
        <div><label>כתובת IP של המחשב</label><span>${ltr(lan.ip + '/' + lan.prefix)}</span></div>
        <div><label>מסכת רשת</label><span>${ltr(lan.netmask)}</span></div>
        <div><label>רשת</label><span>${ltr(lan.network)}</span></div>
        <div><label>ראוטר (Gateway)</label><span>${ltr(lan.gateway || '—')}</span></div>
        <div><label>שרתי DNS</label><span>${ltr(dns.join(', ') || '—')}</span></div>
        <div><label>כתובת MAC</label><span>${ltr(i.mac || '—')}</span></div>
        <div><label>מהירות / דופלקס</label><span>${i.speed ? speed(i.speed) : 'לא ידוע'}${i.duplex ? ' · ' + (i.duplex === 'full' ? 'Full' : 'Half') : ''}</span></div>
        <div><label>הקצאת כתובת</label><span>${i.dhcp === true ? 'DHCP אוטומטי' : i.dhcp === false ? 'כתובת קבועה (סטטית)' : 'לא ידוע'}${i.dhcp_server ? ' · ' + ltr(i.dhcp_server) : ''}</span></div>
        ${i.lease_expires ? `<div><label>חכירת DHCP עד</label><span>${esc(i.lease_expires)}</span></div>` : ''}
        <div><label>IP ציבורי</label><span>${pub.ip ? ltr(pub.ip) : '—'}</span></div>
        <div><label>ספק אינטרנט</label><span>${esc(pub.isp || '—')}${pub.city ? ' · ' + esc(pub.city) : ''}</span></div>
        <div><label>כתובות בטווח</label><span>${lan.hosts}</span></div>
      </div></div></div>`;
  }

  function chart(samples) {
    const W = 800, H = 170, P = 26;
    if (!samples || samples.length < 2) return '<div class="empty">אוסף נתונים…</div>';
    const keys = [['gw', 'var(--violet)', 'ראוטר'], ['inet', 'var(--accent)', 'אינטרנט'], ['dns', 'var(--teal)', 'DNS']];
    const vals = samples.flatMap((s) => keys.map(([k]) => s[k]).filter((v) => v !== null && v !== undefined)).sort((a, b) => a - b);
    const p95 = vals.length ? vals[Math.floor(vals.length * 0.95)] : 10;
    const max = Math.max(5, p95 * 1.25);
    const t0 = samples[0].t, t1 = samples[samples.length - 1].t || t0 + 1;
    const x = (t) => P + (W - 2 * P) * (1 - (t - t0) / Math.max(1, t1 - t0));   // RTL: newest on the left
    const y = (v) => H - 18 - (H - 34) * Math.min(1, v / max);
    let out = '';
    for (let g = 0; g <= 4; g++) {
      const v = (max / 4) * g;
      out += `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${W - 4}" y="${y(v) + 4}" font-size="10" fill="var(--dim)" text-anchor="end">${Math.round(v)}</text>`;
    }
    for (const [k, c] of keys) {
      let d = '', pen = false;
      for (const s of samples) {
        const v = s[k];
        if (v === null || v === undefined) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + x(s.t).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
        pen = true;
      }
      out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`;
    }
    for (const s of samples) if (s.gw === null && s.inet === null) out += `<rect x="${x(s.t) - 1.5}" y="${H - 14}" width="3" height="8" fill="var(--bad)"/>`;
    const mins = Math.round((t1 - t0) / 60);
    return `<svg class="chart" direction="ltr" style="direction:ltr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${out}</svg>
      <div class="legend">${keys.map(([k, c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}<span><i style="background:var(--bad)"></i>ללא מענה</span><span class="dim">${mins} דקות אחרונות · ms</span></div>`;
  }

  function kpi(lbl, val, sub, cls = '') {
    return `<div class="card kpi ${cls}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  }

  function evList(list, n = 8) {
    if (!list.length) return '<div class="empty">אין אירועים</div>';
    return list.slice(0, n).map((e) => `<div class="ev"><i class="lv ${esc(e.level)}"></i><div class="tm">${hhmm(e.t)}</div><div>${bidi(e.text)}</div></div>`).join('');
  }

  function vOverview() {
    const devs = S.devices || [];
    const online = devs.filter((d) => d.online);
    const newc = online.filter((d) => !d.approved).length;
    const sec = S.security;
    const st = S.stats || {};
    const iss = issues();
    const bad = iss.filter((f) => f.severity === 'bad').length;
    const secCls = !sec ? '' : sec.score >= 85 ? 'ok' : sec.score >= 60 ? 'warn' : 'bad';
    const g = st.gw || {}, n = st.inet || {}, d = st.dns || {};
    const types = {};
    online.forEach((x) => { types[x.type_label] = (types[x.type_label] || 0) + 1; });
    const scan = S.scan;
    return `${connCard()}
    <div class="grid g4" style="margin-top:16px">
      ${kpi(svg('devices', 15) + 'מכשירים פעילים', online.length + (devs.length > online.length ? `<small>/ ${devs.length}</small>` : ''), newc ? `<span style="color:var(--warn)">${newc} לא מאושרים</span>` : (scan ? 'סריקה ' + ago(scan.t) : 'טרם נסרק'))}
      ${kpi(svg('security', 15) + 'ציון אבטחה', sec ? sec.score + '<small>/100</small>' : '—', sec ? `${sec.counts.bad} קריטי · ${sec.counts.warn} אזהרות` : 'ממתין לסריקה', secCls)}
      ${kpi(svg('diag', 15) + 'תקלות פעילות', iss.length, bad ? `${bad} קריטיות` : iss.length ? 'אזהרות בלבד' : 'הכול תקין', bad ? 'bad' : iss.length ? 'warn' : 'ok')}
      ${kpi(svg('route', 15) + 'השהיה לאינטרנט', ms(n.avg), `ראוטר ${ms(g.avg)} · DNS ${ms(d.avg)}${n.loss ? ` · איבוד ${n.loss}%` : ''}`, n.loss > 20 ? 'bad' : (n.avg > 100 ? 'warn' : ''))}
    </div>
    <div class="grid g21" style="margin-top:16px">
      <div class="card"><div class="hd"><h3>איכות החיבור בזמן אמת</h3><div class="sp"></div><span class="muted" style="font-size:12px">דגימה כל ${S.settings.sample_seconds} שניות</span></div><div class="bd">${chart(S.samples)}</div></div>
      <div class="card"><div class="hd"><h3>אירועים אחרונים</h3><div class="sp"></div><button class="btn sm ghost" onclick="NP.go('events')">הכול</button></div><div class="bd">${evList(events, 7)}</div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="hd"><h3>תקלות והמלצות</h3><div class="sp"></div><button class="btn sm ghost" onclick="NP.go('diag')">לפירוט</button></div><div class="bd">
        ${iss.length ? iss.slice(0, 3).map((f) => `<div class="find ${f.severity}"><h4>${esc(f.title)}</h4><p>${bidi(f.text)}</p></div>`).join('') : `<div class="empty">${svg('ok', 34)}<div>לא זוהו תקלות תקשורת</div></div>`}
      </div></div>
      <div class="card"><div class="hd"><h3>הרכב הרשת</h3><div class="sp"></div><button class="btn sm ghost" onclick="NP.go('plan')">מפת רשת</button></div><div class="bd">
        ${Object.keys(types).length ? '<div class="bars">' + Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, c]) => `<div class="row"><span>${esc(t)}</span><div class="track"><i style="width:${(100 * c) / online.length}%"></i></div><span>${c}</span></div>`).join('') + '</div>' : '<div class="empty">טרם נסרק</div>'}
        ${scan && scan.note ? `<p class="muted" style="font-size:12px">${esc(scan.note)}</p>` : ''}
        ${scan ? `<p class="dim" style="font-size:12px;margin-bottom:0">נסרקו ${scan.scanned} כתובות (${ltr(scan.range)}) ב־${scan.duration} שניות</p>` : ''}
      </div></div>
    </div>`;
  }

  // ------------------------------------------------------------------ devices
  function devName(d) { return d.alias || d.name || d.vendor || d.type_label || d.ip; }
  function devIcon(d, s = 18) { return `<div class="ic ${esc(d.icon)}">${svg(d.icon, s)}</div>`; }
  function portsHtml(d, max = 8) {
    const risk = {};
    (d.risks || []).forEach((r) => { risk[r.port] = r.severity; });
    const p = d.ports || [];
    return p.slice(0, max).map((x) => `<span class="port ${risk[x] === 'bad' ? 'bad' : risk[x] === 'warn' ? 'risk' : ''}">${x}</span>`).join('') + (p.length > max ? `<span class="dim">+${p.length - max}</span>` : '');
  }

  function vDevices() {
    const devs = S.devices || [];
    const f = devFilter;
    const types = [...new Set(devs.map((d) => d.type_label))];
    const list = devs.filter((d) => (f.status === 'all' || (f.status === 'online' ? d.online : f.status === 'new' ? !d.approved : !d.online)) &&
      (f.type === 'all' || d.type_label === f.type) &&
      (!f.q || [d.ip, d.mac, d.name, d.alias, d.vendor, d.type_label, d.notes].join(' ').toLowerCase().includes(f.q.toLowerCase())));
    const chip = (k, v, t) => `<button class="chip ${f[k] === v ? 'on' : ''}" onclick="NP.filter('${k}','${esc(v)}')">${esc(t)}</button>`;
    const rows = list.map((d) => `<tr class="click ${d.online ? '' : 'off'}" onclick="NP.open(${d.id})">
      <td><i class="sdot ${d.online ? 'on' : ''}" title="${d.online ? 'פעיל' : 'לא פעיל'}"></i></td>
      <td><div class="dev">${devIcon(d)}<div style="min-width:0"><div class="nm">${esc(devName(d))} ${!d.approved ? '<span class="badge new">חדש</span>' : ''}</div><div class="ty">${esc(d.type_label)}${d.self ? '' : ` · ${d.confidence}%`}</div></div></div></td>
      <td>${ltr(d.ip)}</td><td class="mono">${ltr(d.mac || '—')}${d.random_mac ? ' <span class="badge" title="כתובת MAC אקראית (פרטיות)">אקראי</span>' : ''}</td>
      <td>${esc(d.vendor || '—')}</td><td>${portsHtml(d)}</td>
      <td>${(d.risks || []).some((r) => r.severity === 'bad') ? '<span class="badge bad">סיכון</span>' : (d.risks || []).some((r) => r.severity === 'warn') ? '<span class="badge warn">לבדיקה</span>' : '<span class="badge ok">תקין</span>'}</td>
      <td class="muted">${d.online ? (d.rtt !== undefined && d.rtt !== null ? ms(d.rtt) : '') : ago(d.last_seen)}</td></tr>`).join('');
    return `<div class="toolbar">
      <input class="input" style="width:260px" placeholder="חיפוש: IP, שם, יצרן, MAC…" value="${esc(f.q)}" oninput="NP.search(this.value)" data-live="0" id="devq">
      <div class="chips">${chip('status', 'online', 'פעילים')}${chip('status', 'new', 'לא מאושרים')}${chip('status', 'offline', 'לא פעילים')}${chip('status', 'all', 'הכול')}</div>
      <select class="input" onchange="NP.filter('type', this.value)"><option value="all">כל הסוגים</option>${types.map((t) => `<option ${f.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <div style="flex:1"></div>
      <button class="btn sm" onclick="NP.approveAll()">אשר את כל הפעילים</button>
      <button class="btn sm" onclick="NP.scan('devices')">סרוק מכשירים</button>
      <a class="btn sm" href="/api/export.csv">ייצוא Excel (CSV)</a>
    </div>
    <div class="card"><div class="tw"><table class="t"><thead><tr><th></th><th>מכשיר</th><th>IP</th><th>MAC</th><th>יצרן</th><th>פורטים פתוחים</th><th>אבטחה</th><th>השהיה / נראה</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8"><div class="empty">${devs.length ? 'אין תוצאות לסינון' : 'טרם נסרק – לחץ "סריקה מלאה"'}</div></td></tr>`}</tbody></table></div></div>
    <p class="dim" style="font-size:12px">${list.length} מתוך ${devs.length} מכשירים במלאי של רשת זו. לחיצה על שורה פותחת כרטיס מכשיר עם כל המידע, עריכת שם והערות וסריקת פורטים מעמיקה.</p>`;
  }

  function renderDrawer(force) {
    const d = (S.devices || []).find((x) => x.id === drawerId);
    if (!d) return;
    const sig = JSON.stringify(d);
    if (!force && (sig === drawerSig || drawerDirty)) return;
    drawerSig = sig;
    drawerDirty = false;
    const keep = ($('drawer').querySelector('.db') || {}).scrollTop || 0;
    const http = (d.http || []).map((h) => `<div>${h.tls ? 'https' : 'http'}://${esc(d.ip)}:${h.port} – ${esc(h.title || h.realm || '')} ${h.server ? `<span class="dim">(${esc(h.server)})</span>` : ''} ${h.cert ? `<div class="dim mono">${esc(h.cert)}</div>` : ''}</div>`).join('');
    const up = d.upnp || {};
    const deep = d.deep;
    const PORTN = window.NP_PORTS || {};
    const TYPES = ['router', 'router2', 'netdev', 'server', 'nas', 'pc_win', 'pc_linux', 'mac', 'phone', 'printer', 'camera', 'tv', 'speaker', 'iot', 'vm', 'console', 'voip', 'unknown'];
    const TL = { router: 'ראוטר', router2: 'ראוטר נוסף', netdev: 'ציוד רשת', server: 'שרת', nas: 'NAS', pc_win: 'מחשב Windows', pc_linux: 'Linux', mac: 'Mac', phone: 'טלפון / טאבלט', printer: 'מדפסת', camera: 'מצלמה', tv: 'טלוויזיה / מדיה', speaker: 'רמקול', iot: 'IoT', vm: 'מכונה וירטואלית', console: 'קונסולה', voip: 'טלפון IP', unknown: 'לא מזוהה' };
    const web = (d.ports || []).filter((p) => [80, 443, 8080, 8443, 5000, 5001, 8000, 81].includes(p));
    $('drawer').innerHTML = `<div class="dh"><div class="dev">${devIcon(d, 22)}<div><div class="nm" style="font-size:16px">${esc(devName(d))}</div><div class="ty">${esc(d.type_label)} · ${ltr(d.ip)}</div></div></div><div style="flex:1"></div><button class="btn ghost" onclick="NP.closeDrawer()" aria-label="סגור">✕</button></div>
    <div class="db">
      <div class="kv">
        <div><label>מצב</label><span>${d.online ? '<span class="badge ok">פעיל</span>' : '<span class="badge">לא פעיל</span>'} ${d.approved ? '<span class="badge info">מאושר</span>' : '<span class="badge new">לא מאושר</span>'}</span></div>
        <div><label>כתובת IP</label><span>${ltr(d.ip)}</span></div>
        <div><label>MAC</label><span class="mono">${ltr(d.mac || '—')}</span></div>
        <div><label>יצרן</label><span>${esc(d.vendor || (d.random_mac ? 'MAC אקראי – לא ניתן לזהות' : '—'))}</span></div>
        <div><label>שם ברשת</label><span>${esc(d.netbios || d.mdns || d.rdns || d.hostname || '—')}</span></div>
        ${d.workgroup ? `<div><label>קבוצת עבודה</label><span>${esc(d.workgroup)}</span></div>` : ''}
        <div><label>מערכת (לפי TTL)</label><span>${esc(d.os_ttl || '—')}</span></div>
        <div><label>השהיה</label><span>${ms(d.rtt)}</span></div>
        <div><label>נראה לראשונה</label><span>${dt(d.first_seen)}</span></div>
        <div><label>נראה לאחרונה</label><span>${dt(d.last_seen)}</span></div>
        ${(d.ip_history || []).length > 1 ? `<div><label>כתובות קודמות</label><span>${ltr(d.ip_history.join(', '))}</span></div>` : ''}
      </div>
      <h5>למה זוהה כ"${esc(d.type_label)}" (${d.confidence}%)</h5>
      <div class="muted">${(d.reasons || []).map((r) => '• ' + esc(r)).join('<br>') || '—'}</div>
      ${(d.risks || []).length ? `<h5>ממצאי אבטחה</h5>${d.risks.map((r) => `<div class="find ${r.severity}" style="padding:8px 12px"><b>פורט ${r.port}</b> – ${esc(r.text)}</div>`).join('')}` : ''}
      <h5>פורטים פתוחים</h5>
      <div>${(d.ports || []).map((p) => `<span class="port" title="${esc(PORTN[p] || '')}">${p} ${esc(PORTN[p] || '')}</span>`).join(' ') || '<span class="muted">לא נמצאו פורטים פתוחים מתוך רשימת הזיהוי</span>'}</div>
      ${web.length ? `<div style="margin-top:8px">${web.map((p) => `<a class="btn sm" target="_blank" rel="noopener" href="${[443, 8443, 5001].includes(p) ? 'https' : 'http'}://${esc(d.ip)}:${p}/">פתח ממשק ${p}</a>`).join(' ')}</div>` : ''}
      ${http ? `<h5>ממשקי Web</h5><div class="muted" style="font-size:13px">${http}</div>` : ''}
      ${Object.keys(d.banners || {}).length ? `<h5>זיהוי שירותים</h5><div class="mono muted">${Object.entries(d.banners).map(([p, b]) => `${p}: ${esc(b)}`).join('<br>')}</div>` : ''}
      ${(d.services || []).length ? `<h5>שירותי mDNS / Bonjour</h5><div>${d.services.map((s) => `<span class="port">${esc(s)}</span>`).join(' ')}</div>` : ''}
      ${up.friendly || up.manufacturer ? `<h5>UPnP</h5><div class="muted">${esc(up.friendly || '')}<br>${esc(up.manufacturer || '')} ${esc(up.model || '')} ${esc(up.model_number || '')}<br><span class="dim mono">${esc(up.device_type || '')}</span></div>` : ''}
      <h5>סריקת פורטים מעמיקה (${'כ־150 פורטים'})</h5>
      ${deep ? `<div class="muted" style="font-size:12px">בוצעה ${dt(deep.t)}</div><table class="t"><tbody>${deep.ports.map((p) => `<tr><td class="mono">${p.port}</td><td>${esc(p.service)}</td><td class="muted" style="font-size:12px">${esc(p.banner || (p.http ? (p.http.title || p.http.server || '') : ''))}</td></tr>`).join('') || '<tr><td>לא נמצאו פורטים פתוחים</td></tr>'}</tbody></table>` : ''}
      <button class="btn sm" style="margin-top:8px" onclick="NP.deep(${d.id})" ${d.online ? '' : 'disabled'}>${deep ? 'סרוק שוב' : 'הפעל סריקה מעמיקה'}</button>
      <h5>ניהול</h5>
      <div class="field"><label>כינוי</label><input class="input" id="f_alias" value="${esc(d.alias)}" placeholder="לדוגמה: המדפסת בסלון"></div>
      <div class="field"><label>סוג (תיקון ידני)</label><select class="input" id="f_type"><option value="">אוטומטי (${esc(d.type_label)})</option>${TYPES.map((t) => `<option value="${t}" ${d.type_fixed && d.type === t ? 'selected' : ''}>${TL[t]}</option>`).join('')}</select></div>
      <div class="field"><label>הערות</label><textarea class="input" id="f_notes" placeholder="מיקום, אחראי, מספר סידורי…">${esc(d.notes)}</textarea></div>
      <div class="setrow"><div class="tx"><b>מכשיר מוכר ומאושר</b><small>מכשירים לא מאושרים מסומנים כחשודים בבדיקת האבטחה</small></div><label class="switch"><input type="checkbox" id="f_appr" ${d.approved ? 'checked' : ''}><span></span></label></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" onclick="NP.saveDev(${d.id})">שמור</button><button class="btn ghost" onclick="NP.delDev(${d.id})">מחק מהמלאי</button></div>
    </div>`;
    const db = $('drawer').querySelector('.db');
    if (db) db.scrollTop = keep;
    $('drawer').querySelectorAll('input,textarea,select').forEach((el) => el.addEventListener('input', () => { drawerDirty = true; }));
  }

  // ------------------------------------------------------------------ network plan
  const GROUPS = [
    ['ציוד רשת', ['router2', 'netdev']],
    ['מחשבים ושרתים', ['self', 'pc_win', 'pc_linux', 'mac', 'server', 'dc', 'nas', 'vm']],
    ['טלפונים וניידים', ['phone', 'voip']],
    ['מדפסות ומצלמות', ['printer', 'camera']],
    ['מדיה ובית חכם', ['tv', 'speaker', 'iot', 'console']],
    ['לא מזוהים', ['unknown']],
  ];

  function topology() {
    const lan = S.lan;
    const devs = (S.devices || []).filter((d) => d.online);
    const router = devs.find((d) => d.is_gateway);
    const hops = ((S.trace || {}).hops || []);
    const pub = S.public || {};
    const groups = GROUPS.map(([t, types]) => [t, devs.filter((d) => !d.is_gateway && types.includes(d.type))]).filter((g) => g[1].length);
    const colW = 178, nodeH = 44, gap = 10, maxRows = 10;
    const W = Math.max(900, groups.length * colW + 40);
    const cx = W / 2;
    const extra = hops.filter((h) => ['private', 'cgnat'].includes(h.kind));
    let y = 20, out = '';
    const node = (x, yy, w, icon, title, sub, cls = '', onclick = '') =>
      `<g class="node" ${onclick ? `onclick="${onclick}"` : ''}><rect x="${x}" y="${yy}" width="${w}" height="${nodeH}" rx="9" fill="var(--panel2)" stroke="${cls || 'var(--line2)'}" stroke-width="1.5"/>
      <g transform="translate(${x + w - 32},${yy + 11})" color="${cls || 'var(--muted)'}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[icon] || IC.unknown}</svg></g>
      <text x="${x + w - 40}" y="${yy + 19}" font-size="12.5" font-weight="600" text-anchor="end">${esc(String(title).slice(0, 22))}</text>
      <text x="${x + w - 40}" y="${yy + 35}" class="lbl2" text-anchor="end" direction="ltr">${esc(sub)}</text></g>`;
    const line = (x1, y1, x2, y2, c = 'var(--line2)', dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
    // internet
    out += node(cx - 110, y, 220, 'cloud', 'אינטרנט', pub.ip ? pub.ip : '', 'var(--accent)');
    let prevY = y + nodeH;
    y += nodeH + 26;
    const isp = hops.find((h) => h.kind === 'isp');
    if (pub.isp || isp) {
      out += line(cx, prevY, cx, y);
      out += node(cx - 110, y, 220, 'route', pub.isp ? pub.isp : 'ספק אינטרנט', isp ? isp.ip + (isp.rtt ? '  ' + isp.rtt + 'ms' : '') : '', 'var(--accent)');
      prevY = y + nodeH; y += nodeH + 26;
    }
    for (const h of extra) {
      out += line(cx, prevY, cx, y, 'var(--warn)');
      out += node(cx - 110, y, 220, 'router', h.kind === 'cgnat' ? 'CGNAT של הספק' : 'ראוטר/מודם נוסף', h.ip, 'var(--warn)');
      prevY = y + nodeH; y += nodeH + 26;
    }
    out += line(cx, prevY, cx, y);
    const rTitle = router ? devName(router) : 'ראוטר';
    out += node(cx - 120, y, 240, 'router', rTitle, (lan ? lan.gateway : '') + (router && router.vendor ? '  ' + router.vendor : ''), 'var(--violet)', router ? `NP.open(${router.id})` : '');
    prevY = y + nodeH; y += nodeH + 30;
    // LAN bus
    out += line(cx, prevY, cx, y);
    const x0 = 20, x1 = W - 20;
    out += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="8" rx="4" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1"/>`;
    out += `<text x="${x1 - 8}" y="${y - 6}" font-size="11.5" class="lbl2" text-anchor="end">רשת מקומית ${lan ? lan.network : ''} · ${devs.length} מכשירים פעילים</text>`;
    const busY = y + 8;
    y += 40;
    let maxH = 0;
    groups.forEach(([title, list], gi) => {
      const colX = W - 20 - (gi + 1) * colW + 8;   // RTL: first group on the right
      const mid = colX + (colW - 16) / 2;
      out += line(mid, busY, mid, y - 6);
      out += `<text x="${colX + colW - 16}" y="${y + 6}" font-size="12" font-weight="700" fill="var(--muted)" text-anchor="end">${esc(title)} (${list.length})</text>`;
      list.slice(0, maxRows).forEach((d, i) => {
        const yy = y + 16 + i * (nodeH + gap);
        const risk = (d.risks || []).some((r) => r.severity === 'bad') ? 'var(--bad)' : (d.risks || []).some((r) => r.severity === 'warn') ? 'var(--warn)' : (d.self ? 'var(--teal)' : (!d.approved ? 'var(--violet)' : ''));
        out += node(colX, yy, colW - 16, d.icon, devName(d), d.ip, risk, `NP.open(${d.id})`);
      });
      if (list.length > maxRows) out += `<text x="${mid}" y="${y + 16 + maxRows * (nodeH + gap) + 12}" font-size="12" class="lbl2" text-anchor="middle">+${list.length - maxRows} נוספים</text>`;
      maxH = Math.max(maxH, 16 + Math.min(list.length, maxRows) * (nodeH + gap) + (list.length > maxRows ? 24 : 0));
    });
    const H = y + maxH + 10;
    return `<svg class="topo" direction="ltr" style="direction:ltr;max-height:${Math.max(420, H)}px" data-x="" viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function ipToInt(ip) { return ip.split('.').reduce((a, b) => a * 256 + +b, 0); }
  function intToIp(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }

  function ipGrid() {
    const lan = S.lan;
    if (!lan) return '<div class="empty">אין רשת פעילה</div>';
    let prefix = lan.prefix, base;
    if (prefix < 23) prefix = 24;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    base = (ipToInt(lan.ip) & mask) >>> 0;
    const size = Math.min(512, 2 ** (32 - prefix));
    const byIp = {};
    (S.devices || []).forEach((d) => { if (!byIp[d.ip] || d.online) byIp[d.ip] = d; });
    let cells = '', used = 0, risky = 0;
    for (let i = 0; i < size; i++) {
      const ip = intToIp(base + i);
      const d = byIp[ip];
      let cls = '', title = ip + ' – פנוי', click = '';
      if (i === 0 || i === size - 1) { cls = 'net'; title = ip + (i === 0 ? ' – כתובת הרשת' : ' – Broadcast'); }
      else if (d) {
        cls = d.self ? 'self' : d.is_gateway ? 'gw' : d.online ? 'dev' : 'offd';
        if ((d.risks || []).some((r) => r.severity !== 'info')) { cls += ' risk'; risky++; }
        title = `${ip} – ${devName(d)} (${d.type_label})${d.online ? '' : ' – לא פעיל'}`;
        click = `onclick="NP.open(${d.id})"`;
        if (d.online) used++;
      }
      cells += `<div class="ipc ${cls}" title="${esc(title)}" ${click}></div>`;
    }
    const usable = size - 2;
    return `<div class="ipgrid">${cells}</div>
      <div class="lg"><span><b style="background:var(--violet)"></b>ראוטר</span><span><b style="background:var(--teal)"></b>המחשב שלי</span><span><b style="background:var(--accent)"></b>מכשיר פעיל</span><span><b style="background:var(--accent-soft);border:1px solid var(--accent)"></b>מוכר, לא פעיל</span><span><b style="background:var(--panel2);border:1px solid var(--line)"></b>פנוי</span><span><b style="box-shadow:0 0 0 2px var(--warn)"></b>שירות לבדיקה</span></div>
      <div class="kv"><div><label>טווח מוצג</label><span>${ltr(intToIp(base) + '/' + prefix)}</span></div><div><label>בשימוש</label><span>${used} מתוך ${usable} (${Math.round((100 * used) / usable)}%)</span></div><div><label>פנויות</label><span>${usable - used}</span></div><div><label>טווח שמיש</label><span>${ltr(intToIp(base + 1) + ' – ' + intToIp(base + size - 2))}</span></div><div><label>Broadcast</label><span>${ltr(intToIp(base + size - 1))}</span></div><div><label>מכשירים עם ממצאים</label><span>${risky}</span></div></div>`;
  }

  function vPlan() {
    const net = S.network;
    return `<div class="card"><div class="hd"><h3>מפת הרשת (טופולוגיה)</h3><div class="sp"></div>
        ${net ? `<button class="btn sm ghost" onclick="NP.renameNet()">שינוי שם הרשת</button>` : ''}<a class="btn sm" href="/report" target="_blank">דוח להדפסה / PDF</a></div>
      <div class="bd" style="overflow:auto">${S.lan ? topology() : '<div class="empty">אין רשת פעילה</div>'}</div></div>
      <div class="card" style="margin-top:16px"><div class="hd"><h3>תוכנית כתובות (IP Address Plan)</h3><div class="sp"></div><span class="muted" style="font-size:12px">ריחוף על משבצת מציג פרטים · לחיצה פותחת את המכשיר</span></div><div class="bd">${ipGrid()}</div></div>
      ${(S.networks || []).length > 1 ? `<div class="card" style="margin-top:16px"><div class="hd"><h3>רשתות שהמחשב התחבר אליהן</h3></div><div class="bd"><table class="t"><thead><tr><th>שם</th><th>רשת</th><th>ראוטר</th><th>MAC ראוטר</th><th>מכשירים</th><th>נראתה לאחרונה</th></tr></thead><tbody>${S.networks.map((n) => `<tr><td>${esc(n.name)} ${S.network && n.id === S.network.id ? '<span class="badge ok">נוכחית</span>' : ''}</td><td>${ltr(n.subnet)}</td><td>${ltr(n.gateway)}</td><td class="mono">${ltr(n.gateway_mac || '—')}</td><td>${n.devices}</td><td>${ago(n.last_seen)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }

  // ------------------------------------------------------------------ route
  function vRoute() {
    const tr = S.trace;
    const pub = S.public || {};
    if (!tr) return `<div class="card"><div class="empty">${svg('route', 34)}<div>טרם בוצעה בדיקת מסלול</div><button class="btn pri" style="margin-top:10px" onclick="NP.scan('trace')">אתר נתבים בדרך</button></div></div>`;
    const hops = tr.hops || [];
    return `<div class="grid g21"><div class="card"><div class="hd"><h3>המסלול מהמחשב אל ${ltr(tr.target)}</h3><div class="sp"></div><span class="muted" style="font-size:12px">${ago(tr.t)}</span><button class="btn sm" onclick="NP.scan('trace')">בדוק שוב</button></div><div class="bd">
      ${tr.note ? `<p class="muted">${esc(tr.note)}</p>` : ''}
      <div class="hops">
        <div class="hop" data-n="●" style="border-style:dashed"><div><b>המחשב שלך</b><div class="r">${ltr((S.lan || {}).ip || '')}</div></div><div></div></div>
        ${hops.map((h) => `<div class="hop ${esc(h.kind)}" data-n="${h.hop}"><div><b>${h.ip ? ltr(h.ip) : '* * *'}</b> ${h.name ? `<span class="dim mono">${ltr(h.name)}</span>` : ''}<div class="r">${esc(h.role)}</div></div><div class="ms">${ms(h.rtt)}${h.jump > 20 ? `<div class="r" style="color:var(--warn)">+${h.jump}</div>` : ''}</div></div>`).join('')}
      </div></div></div>
      <div><div class="card"><div class="hd"><h3>יציאה לאינטרנט</h3></div><div class="bd"><div class="kv" style="grid-template-columns:1fr">
        <div><label>IP ציבורי</label><span>${ltr(pub.ip || '—')}</span></div>
        <div><label>ספק</label><span>${esc(pub.isp || '—')}</span></div>
        <div><label>ASN</label><span>${esc(pub.asn || '—')}</span></div>
        <div><label>מיקום</label><span>${esc([pub.city, pub.country].filter(Boolean).join(', ') || '—')}</span></div>
        <div><label>נתבים בדרך</label><span>${hops.filter((h) => h.ip).length} עונים · ${hops.filter((h) => !h.ip).length} שקטים</span></div>
        <div><label>שכבות NAT</label><span>${hops.filter((h) => ['gateway', 'private'].includes(h.kind)).length}</span></div>
      </div></div></div>
      ${(tr.findings || []).map((f) => findHtml({ ...f, steps: f.fix })).join('')}</div></div>`;
  }

  // ------------------------------------------------------------------ security
  function gauge(score) {
    const r = 46, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, score)) / 100;
    const col = score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--bad)';
    return `<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--panel2)" stroke-width="11"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="28" font-weight="700" fill="var(--text)">${score}</text></svg>`;
  }

  function findHtml(f, cls) {
    const sev = cls || f.severity || f.status;
    const steps = f.steps || f.fix || [];
    return `<div class="find ${esc(sev)}"><h4><span class="badge ${esc(sev)}">${SEV[sev] || sev}</span>${esc(f.title)}</h4><p>${bidi(f.text)}</p>
      ${(f.details || []).length ? `<details ${sev === 'bad' ? 'open' : ''}><summary>פירוט (${f.details.length})</summary><div class="det">${f.details.map((x) => `<div>${bidi(x)}</div>`).join('')}</div></details>` : ''}
      ${steps.length ? `<ol>${steps.map((s) => `<li>${bidi(s)}</li>`).join('')}</ol>` : ''}
      ${(f.commands || []).map((c) => `<div class="cmd"><code>${esc(c)}</code><button onclick="NP.copy(this)" title="העתק">${svg('copy', 14)}</button></div>`).join('')}
      ${f.action ? `<button class="btn sm" style="margin-top:8px" onclick="NP.action('${esc(f.action)}')">${f.action === 'renew' ? 'חדש כתובת IP עכשיו' : 'נקה מטמון DNS עכשיו'}</button>` : ''}</div>`;
  }

  function vSecurity() {
    const sec = S.security;
    if (!sec) return `<div class="card"><div class="empty">${svg('security', 34)}<div>טרם בוצעה בדיקת אבטחה</div><button class="btn pri" style="margin-top:10px" onclick="NP.scan('security')">הפעל בדיקת אבטחה</button></div></div>`;
    const cats = [['link', 'קו התקשורת'], ['leak', 'הצפנה וזליגת מידע'], ['network', 'הרשת והמכשירים'], ['host', 'המחשב שלי']];
    const order = { bad: 0, warn: 1, info: 2, ok: 3 };
    return `<div class="card pad gauge">${gauge(sec.score)}<div><h2 style="margin:0">${sec.score >= 85 ? 'הרשת מאובטחת היטב' : sec.score >= 60 ? 'יש נקודות לשיפור' : 'נמצאו בעיות אבטחה'}</h2>
      <div class="muted">${sec.counts.bad} קריטי · ${sec.counts.warn} אזהרות · ${sec.counts.info} מידע · ${sec.counts.ok} תקין · נבדק ${ago(sec.t)}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="NP.scan('security')">בדוק שוב</button><a class="btn sm" href="/report" target="_blank">דוח אבטחה להדפסה</a></div></div></div>
      ${cats.map(([k, t]) => {
        const list = sec.checks.filter((c) => c.category === k).sort((a, b) => order[a.status] - order[b.status]);
        return list.length ? `<div class="section-title">${t}</div>${list.map((c) => findHtml(c, c.status)).join('')}` : '';
      }).join('')}`;
  }

  // ------------------------------------------------------------------ diagnostics
  function vDiag() {
    const iss = issues();
    const dg = S.diag || {};
    const t = dg.tests || {};
    const dnsT = t.dns || {};
    const dnsMax = Math.max(1, ...Object.values(dnsT).filter((v) => v !== null));
    const best = Object.entries(dnsT).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0];
    const st = S.stats || {};
    const row = (n, s) => s ? `<tr><td>${n}</td><td>${ms(s.avg)}</td><td>${ms(s.max)}</td><td>${ms(s.jitter)}</td><td>${s.loss}%</td></tr>` : '';
    return `<div class="toolbar"><button class="btn pri" onclick="NP.diagnose(false)">בדיקה מלאה (השהיה, DNS, MTU, Captive)</button><button class="btn" onclick="NP.diagnose(true)">בדיקה + מהירות אינטרנט</button>
      <button class="btn" onclick="NP.action('flushdns')">נקה מטמון DNS</button>${S.app.os === 'windows' ? '<button class="btn" onclick="NP.action(\'renew\')">חדש כתובת IP</button>' : ''}</div>
      <div class="grid g21"><div>
        <div class="section-title">תקלות שזוהו (${iss.length}) – מתעדכן אוטומטית</div>
        ${iss.length ? iss.map((f) => findHtml(f)).join('') : `<div class="card"><div class="empty">${svg('ok', 40)}<h3 style="margin:6px 0 0">לא זוהו תקלות תקשורת</h3><div>הלינק, הראוטר, האינטרנט וה־DNS תקינים. NetPlan ממשיך לנטר ברקע.</div></div></div>`}
      </div><div>
        <div class="card"><div class="hd"><h3>מדדים חיים (5 דקות)</h3></div><div class="bd"><table class="t"><thead><tr><th>יעד</th><th>ממוצע</th><th>מקס׳</th><th>Jitter</th><th>איבוד</th></tr></thead><tbody>${row('ראוטר', st.gw)}${row('אינטרנט', st.inet)}${row('DNS', st.dns)}</tbody></table></div></div>
        ${dg.t ? `<div class="card" style="margin-top:16px"><div class="hd"><h3>תוצאות הבדיקה המלאה</h3><div class="sp"></div><span class="muted" style="font-size:12px">${ago(dg.t)}</span></div><div class="bd">
          ${t.speed ? `<div class="grid g2" style="margin-bottom:12px">${kpi('הורדה', t.speed.download_mbps !== null ? '<span class="ltr">' + t.speed.download_mbps + '<small> Mbps</small></span>' : '—', 'Cloudflare')}${kpi('העלאה', t.speed.upload_mbps !== null ? '<span class="ltr">' + t.speed.upload_mbps + '<small> Mbps</small></span>' : '—', 'Cloudflare')}</div>` : ''}
          <div class="muted" style="font-size:12.5px;margin-bottom:4px">זמן תגובת DNS</div>
          <div class="bars">${Object.entries(dnsT).map(([s, v]) => `<div class="row ${best && best[0] === s ? 'best' : ''}"><span>${ltr(s)}</span><div class="track"><i style="width:${v === null ? 0 : Math.max(3, (100 * v) / dnsMax)}%"></i></div><span>${v === null ? 'לא עונה' : ms(v)}</span></div>`).join('')}</div>
          <div class="kv"><div><label>MTU</label><span>${t.mtu ? t.mtu + (t.mtu === 1500 ? ' (תקין)' : '') : 'לא נבדק'}</span></div>
          <div><label>Captive Portal</label><span>${t.captive ? (t.captive.ok ? 'אין (גישה חופשית)' : 'נדרשת התחברות') : 'לא נבדק'}</span></div>
          <div><label>ראוטר (5 בדיקות)</label><span>${t.gateway ? ms(t.gateway.avg) + ' · ' + t.gateway.loss + '%' : '—'}</span></div>
          <div><label>אינטרנט (5 בדיקות)</label><span>${t.internet ? ms(t.internet.avg) + ' · ' + t.internet.loss + '%' : '—'}</span></div></div>
        </div></div>` : ''}
      </div></div>`;
  }

  // ------------------------------------------------------------------ events
  function vEvents() {
    const list = events.filter((e) => evFilter === 'all' || e.level === evFilter);
    const chip = (v, t) => `<button class="chip ${evFilter === v ? 'on' : ''}" onclick="NP.evf('${v}')">${t}</button>`;
    return `<div class="toolbar"><div class="chips">${chip('all', 'הכול')}${chip('bad', 'קריטי')}${chip('warn', 'אזהרות')}${chip('ok', 'הצלחות')}${chip('info', 'מידע')}</div></div>
      <div class="card"><div class="bd">${list.length ? list.map((e) => `<div class="ev"><i class="lv ${esc(e.level)}"></i><div class="tm">${dt(e.t)}</div><div>${bidi(e.text)}</div></div>`).join('') : '<div class="empty">אין אירועים</div>'}</div></div>`;
  }

  // ------------------------------------------------------------------ settings
  function vSettings() {
    const s = S.settings;
    const tg = (k, t, sub) => `<div class="setrow"><div class="tx"><b>${t}</b><small>${sub}</small></div><label class="switch"><input type="checkbox" ${s[k] ? 'checked' : ''} onchange="NP.set('${k}', this.checked)"><span></span></label></div>`;
    const os = S.app.os;
    const auto = os === 'windows' ? 'הפעל פעם אחת: <code>start.bat --install-autostart</code> (או <code>NetPlan.exe --install-autostart</code>). התוכנה תעלה ברקע עם כניסה ל־Windows.'
      : os === 'mac' ? 'הפעל: <code>python3 netplan.py --install-autostart</code> (LaunchAgent).' : 'הפעל: <code>python3 netplan.py --install-autostart</code> (~/.config/autostart).';
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return `<div class="grid g2"><div class="card"><div class="hd"><h3>ניטור וסריקה</h3></div><div class="bd">
      ${tg('auto_scan_on_connect', 'סריקה אוטומטית בחיבור כבל', 'כשמחברים כבל/רשת חדשה – NetPlan מזהה, ממתין לכתובת ומריץ סריקה מלאה')}
      ${tg('public_ip_lookup', 'בדיקת IP ציבורי וספק', 'פנייה ל־ipinfo.io כדי לזהות את הכתובת החיצונית והספק')}
      ${tg('notify_new_device', 'התראה על מכשיר חדש', 'הודעה כשמכשיר שלא נראה קודם מצטרף לרשת')}
      ${tg('notify_issues', 'התראה על תקלות ואבטחה', 'הודעה על ניתוק, תקלה או ממצא אבטחה')}
      <div class="setrow"><div class="tx"><b>סריקת מכשירים חוזרת</b><small>כל כמה דקות לרענן את רשימת המכשירים (0 = כבוי)</small></div><input class="input" type="number" min="0" max="1440" style="width:90px" value="${s.rescan_minutes}" onchange="NP.set('rescan_minutes', +this.value)"></div>
      <div class="setrow"><div class="tx"><b>תדירות דגימת איכות</b><small>שניות בין בדיקות השהיה לראוטר/אינטרנט/DNS</small></div><input class="input" type="number" min="2" max="120" style="width:90px" value="${s.sample_seconds}" onchange="NP.set('sample_seconds', +this.value)"></div>
      <div class="setrow"><div class="tx"><b>טווח סריקה מותאם</b><small>ריק = אוטומטי. דוגמאות: 10.0.0.0/23 או 192.168.1.10-200</small></div><input class="input ltr" style="width:200px" value="${esc(s.custom_range)}" onchange="NP.set('custom_range', this.value.trim())"></div>
      <div class="setrow"><div class="tx"><b>יעד בדיקת מסלול</b><small>הכתובת שאליה נמדד המסלול לאינטרנט</small></div><input class="input ltr" style="width:200px" value="${esc(s.trace_target)}" onchange="NP.set('trace_target', this.value.trim())"></div>
    </div></div>
    <div><div class="card"><div class="hd"><h3>התראות ופעלה אוטומטית</h3></div><div class="bd">
      <div class="setrow"><div class="tx"><b>התראות שולחן עבודה</b><small>מצב: ${perm === 'granted' ? 'מאושר' : perm === 'denied' ? 'חסום בדפדפן' : perm === 'unsupported' ? 'לא נתמך' : 'לא הופעל'}</small></div><button class="btn sm" onclick="NP.askNotify()">הפעל</button></div>
      <div class="setrow"><div class="tx"><b>הפעלה עם המחשב</b><small>${auto}</small></div></div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="hd"><h3>ייצוא ודוחות</h3></div><div class="bd" style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn" href="/api/export.csv">רשימת מכשירים (Excel/CSV)</a><a class="btn" href="/api/export.json">ייצוא מלא (JSON)</a><a class="btn" href="/report" target="_blank">דוח רשת להדפסה / PDF</a>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="hd"><h3>אודות</h3></div><div class="bd muted" style="font-size:13px">
      NetPlan ${esc(S.app.version)} · ${esc(S.app.os)} · psutil: ${S.app.psutil ? 'כן' : 'לא'} · ping: ${S.app.ping ? 'כן' : 'לא'} · מאגר יצרנים: ${S.app.oui_vendors} יצרנים<br>
      הממשק זמין רק מהמחשב הזה (127.0.0.1). כל הנתונים נשמרים מקומית במחשב ולא נשלחים לשום שרת.
    </div></div></div></div>`;
  }

  // ------------------------------------------------------------------ actions
  async function scan(kind) {
    const r = await api('/api/scan/' + kind, {});
    if (r && r.started) { toast('הסריקה התחילה', 'info'); load(); }
  }
  async function diagnose(speed) {
    const r = await api('/api/diagnose', { speed });
    if (r && r.started) toast(speed ? 'בדיקה מלאה + מהירות התחילה (כ־30 שניות)' : 'בדיקה מלאה התחילה', 'info');
  }
  async function action(a) {
    const r = await api('/api/action', { action: a });
    if (r) toast((r.ok ? 'בוצע: ' : 'לא בוצע: ') + (r.output || ''), r.ok ? 'ok' : 'warn');
  }
  function go(v) {
    view = v; location.hash = v;
    $('side').classList.remove('open');
    window.scrollTo(0, 0);
    render();
  }
  function open(id) {
    drawerId = id;
    drawerDirty = false;
    renderDrawer(true);
    const db = $('drawer').querySelector('.db');
    if (db) db.scrollTop = 0;
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
    $('dbg').style.display = 'block';
  }
  function closeDrawer() {
    drawerId = null;
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    $('dbg').style.display = 'none';
  }
  async function saveDev(id) {
    const body = { alias: $('f_alias').value, notes: $('f_notes').value, approved: $('f_appr').checked ? 1 : 0, fixed_type: $('f_type').value };
    const r = await api('/api/device/' + id, body);
    if (r) { toast('נשמר', 'ok'); drawerDirty = false; document.activeElement.blur(); load(); }
  }
  async function delDev(id) {
    if (!confirm('למחוק את המכשיר מהמלאי? הוא יחזור בסריקה הבאה אם עדיין ברשת.')) return;
    const r = await api('/api/device/' + id + '/delete', {});
    if (r) { closeDrawer(); load(); }
  }
  async function deep(id) {
    const r = await api('/api/device/' + id + '/deep', {});
    if (r && r.started) toast('סריקה מעמיקה התחילה (עד דקה)', 'info');
  }
  async function approveAll() {
    if (!confirm('לסמן את כל המכשירים הפעילים כמוכרים ומאושרים?')) return;
    if (await api('/api/devices/approve_all', {})) load();
  }
  async function renameNet() {
    const n = prompt('שם לרשת (למשל: הבית, המשרד, לקוח X):', S.network.name);
    if (n && (await api('/api/network/rename', { name: n }))) load();
  }
  async function set(k, v) {
    const r = await api('/api/settings', { [k]: v });
    if (r) { S.settings = r; toast('ההגדרה נשמרה', 'ok'); }
  }
  function filter(k, v) { devFilter[k] = v; lastHtml = ''; render(); }
  let qT;
  function search(v) { devFilter.q = v; clearTimeout(qT); qT = setTimeout(() => { const el = $('devq'); const pos = el ? el.selectionStart : 0; el && (el.dataset.live = '1'); render(); const n = $('devq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); n.dataset.live = '0'; } }, 200); }
  function evf(v) { evFilter = v; render(); }
  function copy(btn) {
    const t = btn.parentElement.querySelector('code').textContent;
    navigator.clipboard.writeText(t).then(() => toast('הפקודה הועתקה', 'ok'), () => toast('לא ניתן להעתיק', 'warn'));
  }
  function askNotify() {
    if (!('Notification' in window)) return toast('הדפדפן לא תומך בהתראות', 'warn');
    Notification.requestPermission().then(() => render());
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = cur;
    try { localStorage.setItem('np-theme', cur); } catch (e) { /* ignore */ }
    render();
  }

  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== view) { view = v; render(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  load();
  setInterval(load, 2000);

  return { go, scan, diagnose, action, open, closeDrawer, saveDev, delDev, deep, approveAll, renameNet, set, filter, search, evf, copy, askNotify, toggleTheme };
})();

window.NP_PORTS = { 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 81: 'HTTP', 88: 'Kerberos', 110: 'POP3', 135: 'MS-RPC', 139: 'NetBIOS', 143: 'IMAP', 389: 'LDAP', 443: 'HTTPS', 445: 'SMB', 515: 'LPD', 548: 'AFP', 554: 'RTSP', 631: 'IPP', 1433: 'MS-SQL', 1883: 'MQTT', 2049: 'NFS', 3306: 'MySQL', 3389: 'RDP', 5000: 'HTTP/UPnP', 5001: 'HTTPS', 5357: 'WSD', 5432: 'PostgreSQL', 5900: 'VNC', 7000: 'AirPlay', 8000: 'HTTP', 8001: 'Smart TV', 8008: 'Chromecast', 8009: 'Chromecast', 8080: 'HTTP-Alt', 8123: 'Home Assistant', 8291: 'Winbox', 8443: 'HTTPS-Alt', 8888: 'HTTP', 9100: 'JetDirect', 32400: 'Plex', 34567: 'DVR', 37777: 'DVR', 49152: 'UPnP', 62078: 'iOS Sync' };
