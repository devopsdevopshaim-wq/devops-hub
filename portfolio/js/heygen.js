/* A live video call with Maya through HeyGen's streaming avatar. The button appears only when the server says HeyGen is set up and the
   visitor is signed in (a video minute costs money). The server mints a short-lived session token; the API key never reaches this page.
   While the call is on, her answers are spoken by the avatar (window.GuideAvatar), and the call ends when the chat closes or after
   five minutes without a question. */
(function () {
  'use strict';
  var Auth = window.HasadnaAuth;
  if (!Auth) return;
  var BASE = '', cfg = null, avatar = null, sdk = null, idle = null, btn = null;
  var GA = window.GuideAvatar = { active: false, say: function () {}, stop: stop };

  function post(data) {
    var b = new URLSearchParams(data); b.set('token', Auth.token());
    return fetch(BASE + '/hasadna-heygen', { method: 'POST', body: b }).then(function (r) { return r.json(); });
  }
  function note(t) { var n = document.querySelector('.mu-now b'); if (btn) { btn.title = t; btn.setAttribute('aria-label', t); } if (window.console) console.info('heygen:', t); }

  function hosts() { return Array.prototype.slice.call(document.querySelectorAll('.guide .g-stage, .guide .g-portrait')); }
  function setBusy(on) { if (btn) { btn.disabled = on; btn.classList.toggle('busy', on); } }

  function stop() {
    clearTimeout(idle); GA.active = false;
    document.documentElement.classList.remove('hg-live');
    Array.prototype.forEach.call(document.querySelectorAll('.hg-video'), function (v) { try { v.srcObject = null; } catch (e) {} v.remove(); });
    if (avatar) { try { avatar.stopAvatar(); } catch (e) {} avatar = null; }
    if (btn) { btn.textContent = '🎥 שיחת וידאו'; btn.classList.remove('on'); }
  }
  function bump() { clearTimeout(idle); idle = setTimeout(stop, 5 * 60000); }

  function start() {
    if (GA.active) { stop(); return; }
    setBusy(true); btn.textContent = 'מתחברת…';
    post({ action: 'token' }).then(function (r) {
      if (!r || !r.ok || !r.token) throw new Error(r && r.error || 'token');
      return import('https://esm.sh/@heygen/streaming-avatar').then(function (m) { sdk = m; return r; });
    }).then(function (r) {
      var SA = sdk.StreamingAvatar, EV = sdk.StreamingEvents;
      avatar = new SA({ token: r.token });
      var vids = hosts().map(function (h) { var v = document.createElement('video'); v.className = 'hg-video'; v.autoplay = true; v.playsInline = true; h.appendChild(v); return v; });
      avatar.on(EV.STREAM_READY, function (e) {
        vids.forEach(function (v) { v.srcObject = e.detail; v.play().catch(function () {}); });
        document.documentElement.classList.add('hg-live'); GA.active = true; setBusy(false); btn.textContent = '⏹ סיום שיחה'; btn.classList.add('on'); bump();
        GA.say('שלום, אני מאיה. במה אפשר לעזור?');
      });
      avatar.on(EV.STREAM_DISCONNECTED, stop);
      var opts = { quality: sdk.AvatarQuality ? sdk.AvatarQuality.Medium : 'medium', language: r.language || 'he' };
      if (r.avatar) opts.avatarName = r.avatar;
      if (r.voice) opts.voice = { voiceId: r.voice };
      return avatar.createStartAvatar(opts);
    }).catch(function (e) {
      note('שיחת הווידאו לא זמינה כרגע'); stop(); setBusy(false);
      if (btn) { btn.textContent = '🎥 שיחת וידאו'; var m = btn.nextElementSibling; }
      alert('שיחת הווידאו לא זמינה כרגע (' + String((e && e.message) || e).slice(0, 80) + '). אפשר להמשיך בצ׳אט.');
    });
  }
  GA.say = function (text) {
    if (!avatar) return; bump();
    try { avatar.speak({ text: text, taskType: sdk && sdk.TaskType ? sdk.TaskType.REPEAT : 'repeat' }).catch(function () {}); } catch (e) {}
  };

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

  Promise.all([Auth.ready, fetch('api.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (res) {
    var who = res[0] || {}, c = res[1];
    if (!who.role || who.role === 'visitor' || who.offline || !c || !c.base) return;
    BASE = c.base;
    post({ action: 'status' }).then(function (r) {
      if (!r || !r.available) return;
      cfg = r;
      var tries = 0, iv = setInterval(function () { if (mount() || ++tries > 40) clearInterval(iv); }, 500);
    }).catch(function () {});
  });
})();
