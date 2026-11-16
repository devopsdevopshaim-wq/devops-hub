/* 📡 The phone's AI designs made by the studio's computer (v170; the server side is cloudflare/src/relay.mjs).
   A phone has no AI engine of its own, and the cloud's free allowance runs out at an event. The desktop program with its local
   engine (local-ai.js) answers the phone through the server: the phone leaves a job, the computer takes it, makes the picture on
   its graphics card and leaves the answer; the phone collects it. Same account on both (the owner's sign-in); they do not have
   to be on the same network. Nothing else changes for the owner: a design on the phone goes on as usual.
   - On the computer (FSDesktop + FS.localAI): FS.relayHostOn() ('fs-relay-host', on unless '0') asks the server for a job every
     3 s while the local engine is ready, one at a time; "📱 עיצוב מהטלפון" shows while it works.
   - On the phone (or any device without a ready local engine): FS.relayMode() ('fs-ai-relay'): 'auto' (the cloud first; when it
     cannot — the allowance, a refusal, no answer — the computer, and for 30 minutes the computer first), 'computer' (always the
     computer when it is on), 'off'. The engine "🖥️ מקומי" chosen on a phone means the computer too.
   FS.relayCard() / FS.relayBind(box): the lines of "📶 מה עובד בלי אינטרנט" (mate.js). */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.account || !FS.askServer) return;
  function ls(k, v) { try { if (v !== undefined) localStorage.setItem(k, v); return localStorage.getItem(k); } catch (e) { return null; } }
  var D = window.FSDesktop, HOST = !!(D && FS.localAI);
  var call = function (a, d) { return FS.account.call(a, d || {}).catch(function () { return { ok: false, error: 'offline' }; }); };
  FS.relayMode = function (v) { if (v !== undefined) ls('fs-ai-relay', v); var m = ls('fs-ai-relay'); return m === 'computer' || m === 'off' ? m : 'auto'; };
  FS.relayHostOn = function (v) { if (v !== undefined) ls('fs-relay-host', v ? '1' : '0'); return ls('fs-relay-host') !== '0'; };
  var hostName = function () { return ls('fs-relay-name') || 'המחשב בעמדה'; };

  /* ---------- the computer: answers the phone ---------- */
  var served = 0, hostBusy = false, hostSeen = '';
  function hostLoop() {
    var later = function (ms) { setTimeout(hostLoop, ms); };
    if (!HOST || !FS.relayHostOn() || !(FS.account.signedIn && FS.account.signedIn())) return later(15000);
    var ready = !!(FS.localAI.isReady && FS.localAI.isReady());
    if (!ready) { call('relay-beat', { name: hostName(), ready: false }); return later(15000); }
    if (hostBusy) return later(3000);
    call('relay-take', { name: hostName(), ready: true }).then(function (r) {
      hostSeen = r && r.ok ? 'ok' : (r && r.error) || '';
      if (!r || !r.ok || !r.job) return later(r && r.error === 'signed-out' ? 30000 : 3000);
      hostBusy = true; var job = r.job;
      FS.toast && FS.toast('📱 עיצוב AI מהטלפון: המחשב עובד עליו…', 3500);
      Promise.resolve().then(function () { return FS.localAI.run(job.body); })
        .then(function (res) { return res; }, function (e) { return { ok: false, error: 'local-failed', detail: String(e && e.message || e) }; })
        .then(function (res) { return call('relay-done', { id: job.id, result: res }).then(function () { if (res && res.ok) served++; }); })
        .then(function () { hostBusy = false; later(400); }, function () { hostBusy = false; later(3000); });
    });
  }
  if (HOST) setTimeout(hostLoop, 4000);

  /* ---------- the phone: sends to the computer ---------- */
  var stP = null, stAt = 0, relayFirst = 0, relayLast = null;
  FS.relayState = function (fresh) {
    if (HOST) return Promise.resolve({ online: false, host: true });
    if (!stP || fresh || Date.now() - stAt > 10000) { stAt = Date.now(); stP = call('relay-state').then(function (r) { return r && r.ok ? r : { online: false }; }); }
    return stP;
  };
  FS.relayRun = function (body) {
    var b = Object.assign({}, body); delete b.engine;
    return call('relay-put', { body: b }).then(function (r) {
      if (!r || !r.ok) return { ok: false, error: r && r.error === 'busy' ? 'relay-busy' : 'relay-failed', detail: r && r.error };
      var id = r.id, t0 = Date.now(), quiet = 0;
      return new Promise(function (done) {
        (function poll() {
          call('relay-get', { id: id }).then(function (g) {
            if (g && g.ok && g.result) return done(g.result);
            if (!g || !g.ok) { if (++quiet > 8) return done({ ok: false, error: 'relay-failed' }); return setTimeout(poll, 3000); }
            quiet = g.online === false ? quiet + 1 : 0;
            if (FS.busy && document.getElementById('busy-msg')) { var m = document.getElementById('busy-msg'); if (/המחשב|🖥️/.test(m.textContent) || !m.textContent) m.textContent = '🖥️ המחשב בעמדה מעצב' + (g.ahead ? ' · ' + g.ahead + ' לפניה בתור' : '…'); }
            if (quiet > 20) return done({ ok: false, error: 'relay-offline' });
            if (Date.now() - t0 > 14 * 60000) return done({ ok: false, error: 'relay-timeout' });
            setTimeout(poll, 2500);
          });
        })();
      });
    });
  };
  var ask0 = FS.askServer;
  FS.askServer = function (body) {
    var pic = body && (body.action === 'restyle' || body.action === 'image');
    var localHere = FS.localAI && FS.localAI.isReady && FS.localAI.isReady();
    if (!pic || HOST || localHere || FS.relayMode() === 'off' || navigator.onLine === false) return ask0(body);
    var mode = FS.relayMode(), wantLocal = body.engine === 'local';
    if (mode === 'computer' || wantLocal || relayFirst > Date.now()) {
      return FS.relayState(true).then(function (s) { return s.online ? FS.relayRun(body) : wantLocal ? { ok: false, error: 'relay-offline' } : ask0(body); });
    }
    return ask0(body).then(function (r) {
      if ((r && r.ok && r.image) || (r && r.error === 'cancelled')) return r;
      var er = String((r && r.error) || '');
      if (!/quota|no-free-tier|rate-limited|ai-failed|engine-off|timeout|http-5/.test(er)) return r;
      return FS.relayState(true).then(function (s) {
        relayLast = s;
        if (!s.online) return r;
        if (/quota|no-free-tier|rate-limited/.test(er)) relayFirst = Date.now() + 30 * 60000;   /* the cloud is done for a while */
        return FS.relayRun(body);
      });
    });
  };
  var aiError = FS.aiError;
  FS.aiError = function (m) {
    if (m === 'relay-offline') return '🖥️ המחשב בעמדה לא עונה: בודקים שהתוכנה פתוחה בו, מחוברת לאינטרנט, ומנוע ה־AI המקומי מותקן.';
    if (m === 'relay-busy') return '🖥️ המחשב בעמדה עמוס (24 עיצובים בתור). מחכים כמה דקות.';
    if (m === 'relay-timeout') return '🖥️ המחשב בעמדה לא סיים בזמן. מנסים שוב.';
    if (m === 'relay-failed') return '🖥️ השליחה למחשב בעמדה לא הצליחה. מנסים שוב.';
    var t = aiError ? aiError(m) : m;
    /* on a phone, when the cloud could not: say why the studio's computer did not take over */
    if (!HOST && relayLast && !relayLast.online && FS.relayMode() !== 'off' && /quota|no-free-tier|rate-limited/.test(String(m))) {
      var seen = relayLast.seen ? Math.round((Date.now() - relayLast.seen) / 60000) : -1;
      t = 'המכסה החינמית של ה־AI בענן נגמרה, ו📡 המחשב בעמדה לא מחובר' + (seen >= 0 ? ' (נראה לאחרונה לפני ' + seen + ' דקות)' : ' (עוד לא התחבר אף פעם)') +
        '. במחשב: פותחים את התוכנה (גרסה 170 ומעלה) באותו חשבון, ומתקינים את מנוע ה־AI המקומי (🤖 AI ← "⬇️ התקנת מנוע ה־AI המקומי"). אחרי זה העיצובים מהטלפון נעשים שם.';
    }
    return t;
  };

  /* ---------- the lines in "📶 מה עובד בלי אינטרנט" ---------- */
  FS.relayCard = function () {
    if (HOST) {
      var ready = FS.localAI.isReady && FS.localAI.isReady();
      return '<div class="mt-relay"><b>📡 עיצובים מהטלפון:</b> ' + (ready ? (FS.relayHostOn() ? '✅ המחשב הזה מקבל עיצובי AI מהטלפון (אותו חשבון) ומכין אותם במנוע שלו' + (served ? ' · ' + served + ' עד עכשיו' : '') + '.' : 'כבוי.') : 'אחרי התקנת מנוע ה־AI המקומי, המחשב הזה יוכל להכין גם את עיצובי ה־AI של הטלפון.') +
        (ready ? ' <label class="mt-chk-l"><input type="checkbox" id="mt-relay-host"' + (FS.relayHostOn() ? ' checked' : '') + '> פעיל</label>' : '') + '</div>';
    }
    var m = FS.relayMode();
    return '<div class="mt-relay"><b>📡 המחשב בעמדה:</b> <span id="mt-relay-st">בודק…</span>' +
      '<label class="mt-chk-l">עיצובי AI <select id="mt-relay-mode"><option value="auto"' + (m === 'auto' ? ' selected' : '') + '>מהענן, וכשהוא לא יכול: מהמחשב</option><option value="computer"' + (m === 'computer' ? ' selected' : '') + '>תמיד מהמחשב בעמדה</option><option value="off"' + (m === 'off' ? ' selected' : '') + '>רק מהענן</option></select></label></div>';
  };
  FS.relayBind = function (box) {
    var hb = box.querySelector('#mt-relay-host'); if (hb) hb.addEventListener('change', function () { FS.relayHostOn(hb.checked); });
    var ms = box.querySelector('#mt-relay-mode'); if (ms) ms.addEventListener('change', function () { FS.relayMode(ms.value); });
    var st = box.querySelector('#mt-relay-st');
    if (st) FS.relayState(true).then(function (s) {
      st.textContent = s.online ? '✅ מחובר (' + (s.name || 'המחשב') + '): כשהענן לא יכול, העיצובים נעשים שם, בלי הגבלה' : '⬜ לא מחובר. פותחים את התוכנה במחשב עם מנוע ה־AI המקומי, באותו חשבון.';
    });
  };
})();
