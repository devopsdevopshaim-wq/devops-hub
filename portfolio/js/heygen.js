/* A live video call with Maya through LiveAvatar (avatar-only mode). The button appears only when the server says the avatar is set up and the
   visitor is signed in (a video minute costs money). The server starts the session and turns Maya's Hebrew answers into speech (Gemini TTS,
   PCM 24 kHz); this page joins the LiveKit room to show the video and streams the speech to the avatar over its WebSocket, so the lips follow
   the real audio. The API key never reaches this page. The call ends when the chat closes or after five minutes without a question. */
(function () {
  'use strict';
  var Auth = window.HasadnaAuth;
  if (!Auth) return;
  var LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js';
  var BASE = '', room = null, ws = null, ready = false, session = null, idle = null, keep = null, btn = null, queue = [], playing = false;
  var GA = window.GuideAvatar = { active: false, say: function () {}, stop: stop };

  function post(data) {
    var b = new URLSearchParams(data); b.set('token', Auth.token());
    return fetch(BASE + '/hasadna-heygen', { method: 'POST', body: b }).then(function (r) { return r.json(); });
  }
  function hosts() { return Array.prototype.slice.call(document.querySelectorAll('.guide .g-stage, .guide .g-portrait')); }
  function setBusy(on) { if (btn) { btn.disabled = on; btn.classList.toggle('busy', on); } }
  function loadLK() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = LK_SRC; s.onload = function () { window.LivekitClient ? ok(window.LivekitClient) : no(new Error('livekit')); }; s.onerror = function () { no(new Error('livekit')); };
      document.head.appendChild(s);
    });
  }
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }

  function stop() {
    clearTimeout(idle); clearInterval(keep); GA.active = false; ready = false; queue = []; playing = false;
    document.documentElement.classList.remove('hg-live');
    Array.prototype.forEach.call(document.querySelectorAll('.hg-video'), function (v) { try { v.srcObject = null; } catch (e) {} v.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('.hg-audio'), function (v) { v.remove(); });
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    if (room) { try { room.disconnect(); } catch (e) {} room = null; }
    if (session) { var s = session; session = null; post({ action: 'stop', session: s }).catch(function () {}); }
    if (btn) { btn.textContent = '🎥 שיחת וידאו'; btn.classList.remove('on'); setBusy(false); }
  }
  function bump() { clearTimeout(idle); idle = setTimeout(stop, 5 * 60000); }

  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  // one answer at a time: fetch the speech, then feed it to the avatar in one-second pieces
  function pump() {
    if (playing || !queue.length || !ready) return;
    playing = true;
    var text = queue.shift();
    post({ action: 'speak', text: text }).then(function (r) {
      if (!r || !r.ok || !r.audio) throw new Error('speak');
      var bin = atob(r.audio), a = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      var id = uuid(), step = 48000; // ~1 second of 24 kHz 16-bit mono
      for (var o = 0; o < a.length; o += step) send({ type: 'agent.speak', event_id: o ? uuid() : id, audio: b64(a.subarray(o, Math.min(a.length, o + step))) });
      send({ type: 'agent.speak_end', event_id: uuid() });
    }).catch(function () {}).then(function () { playing = false; pump(); });
  }
  GA.say = function (text) { if (!GA.active && !ready) return; bump(); queue.push(String(text)); pump(); };

  function start() {
    if (GA.active) { stop(); return; }
    setBusy(true); btn.textContent = 'מתחברת…';
    var LK;
    post({ action: 'status' }).then(function (st) {
      if (!st || !st.available) throw new Error(st && st.reason === 'old-session' ? 'ההתחברות הנוכחית היא מהשרת הישן: צאו מהמערכת והתחברו שוב, ואז נסו שוב' : st && st.reason === 'signin' ? 'ההתחברות פגה: צאו והתחברו שוב' : 'השרת עוד לא מוגדר לשיחת וידאו');
      return Promise.all([loadLK(), post({ action: 'start' })]);
    }).then(function (res) {
      LK = res[0]; var r = res[1];
      if (!r || !r.ok) throw new Error(r && r.error || 'start');
      session = r.session;
      var vids = hosts().map(function (h) { var v = document.createElement('video'); v.className = 'hg-video'; v.autoplay = true; v.playsInline = true; h.appendChild(v); return v; });
      room = new LK.Room({ adaptiveStream: true });
      room.on(LK.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind === 'video') {
          vids.forEach(function (v) { track.attach(v); v.play().catch(function () {}); });
          document.documentElement.classList.add('hg-live');
        } else if (track.kind === 'audio') {
          var au = track.attach(); au.className = 'hg-audio'; document.body.appendChild(au);
        }
      });
      room.on(LK.RoomEvent.Disconnected, stop);
      return room.connect(r.url, r.clientToken).then(function () {
        return new Promise(function (ok, no) {
          var t = setTimeout(function () { no(new Error('ws')); }, 15000);
          ws = new WebSocket(r.ws);
          ws.onmessage = function (e) {
            var m; try { m = JSON.parse(e.data); } catch (x) { return; }
            if (m.type === 'session.state_updated' && m.state === 'connected') { clearTimeout(t); ok(); }
          };
          ws.onerror = function () { clearTimeout(t); no(new Error('ws')); };
          ws.onclose = function () { if (GA.active) stop(); };
        });
      }).then(function () {
        ready = true; GA.active = true; setBusy(false); btn.textContent = '⏹ סיום שיחה'; btn.classList.add('on'); bump();
        keep = setInterval(function () { send({ type: 'session.keep_alive' }); }, 60000);
        GA.say('שלום, אני מאיה. במה אפשר לעזור?');
      });
    }).catch(function (e) {
      stop();
      alert('שיחת הווידאו לא זמינה כרגע (' + String((e && e.message) || e).slice(0, 120) + '). אפשר להמשיך בצ׳אט.');
    });
  }

  function mount() {
    var head = document.querySelector('.guide .g-panel header');
    if (!head || btn) return !!btn;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hg-btn'; btn.textContent = '🎥 שיחת וידאו';
    btn.addEventListener('click', start);
    head.insertBefore(btn, head.querySelector('.g-x') || null);
    // closing the chat ends the call (it costs money)
    new MutationObserver(function () { var p = document.querySelector('.guide .g-panel'); if (p && !p.classList.contains('open') && GA.active) stop(); }).observe(document.querySelector('.guide .g-panel'), { attributes: true, attributeFilter: ['class'] });
    return true;
  }

  // the button is always there for a signed-in visitor; a click says plainly when the call cannot start
  Promise.all([Auth.ready, fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (res) {
    var who = res[0] || {}, c = res[1];
    if (!who.role || who.offline || !c || !c.base) return;
    BASE = c.base;
    var tries = 0, iv = setInterval(function () { if (mount() || ++tries > 60) clearInterval(iv); }, 500);
  });
})();
