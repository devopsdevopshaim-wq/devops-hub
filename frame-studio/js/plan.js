/* אופטימוס plans. A new computer starts a free trial (every feature for 2 events or 30 days, whichever comes last); after it the
   program keeps working as the free tier: prints and saved files carry a small "made with Optimus" band, the cloud AI does a few
   photos a day, and the collage, the pro frame editor and the local AI open again with an upgrade (an event pass for 48 hours, a
   month, a year or the full licence; the owner records the payment and the server says so). The owner's own sign-in and licences
   from before plans are always full. The server's word is kept for working offline, and the dates and events count here too. */
(function () {
  'use strict';
  var FS = window.FS, LIC = FS.license, ACC = FS.account;
  if (!LIC) return;
  var FREE_AI = 3, DAY = 86400000, WA = '972544979771';
  var LOCKED = { collage: 'הקולאז׳', 'frame-pro': 'עורך המסגרות המקצועי (16 עיצובי AI מההזמנה)', 'local-ai': 'ה־AI המקומי שעובד בלי אינטרנט', ai: 'עוד עיצובי AI היום' };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function jget(k, d) { try { return JSON.parse(ls(k) || 'null') || d; } catch (e) { return d; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function owner() { return !document.body.classList.contains('studio-licensed') && !!(ACC && ACC.isAdmin && ACC.isAdmin()); }

  /* the tier now: owner, pro, pass, trial or free; what the server said, aged by the clock and by events counted here */
  FS.planTier = function () {
    if (owner()) return 'owner';
    if (!LIC.get()) return 'owner';   /* not signed in: the gate is up, nothing to limit */
    var p = LIC.plan(), now = Date.now();
    if (!p) return 'pro';   /* a licence from before plans */
    if (p.tier === 'pro') return p.until && Date.parse(p.until) < now ? 'free' : 'pro';
    if (p.tier === 'pass') return Date.parse(p.until) > now ? 'pass' : 'free';
    if (p.tier === 'trial') {
      var ev = Math.max(p.events || 0, jget('fs-plan-events', []).length);
      if (now > Date.parse(p.hardEnd)) return 'free';
      return ev >= (p.eventsMax || 2) && now > Date.parse(p.ends) ? 'free' : 'trial';
    }
    return 'free';
  };
  FS.can = function (what) {
    var t = FS.planTier(); if (t !== 'free') return true;
    if (what === 'ai') return aiUsed() < FREE_AI;
    return !(what === 'clean' || LOCKED[what]);
  };
  function aiUsed() { var u = jget('fs-plan-ai', {}); return u.day === today() ? u.n : 0; }
  function aiCount() { var n = aiUsed() + 1; ls('fs-plan-ai', JSON.stringify({ day: today(), n: n })); }

  /* ---------- the upgrade window ---------- */
  var info = null;
  function prices() { if (info) return Promise.resolve(info); return LIC.info().then(function (r) { if (r && r.ok) info = r; return info || {}; }, function () { return {}; }); }
  function wa(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }
  var upOpen = 0;
  FS.upgrade = function (why) {
    if (Date.now() - upOpen < 1500) return; upOpen = Date.now();
    var t = FS.planTier(), L = LIC.get() || {};
    prices().then(function (pr) {
      var P = { pass: pr.passPrice || 79, month: pr.monthPrice || 89, year: pr.yearPrice || 790, full: pr.price || 990 }, cur = pr.currency || '₪', h = pr.passHours || 48;
      var cards = [['pass', '🎟️ כרטיס אירוע', P.pass, 'הכל פתוח ל־' + h + ' שעות. מושלם לאירוע אחד.'], ['month', '📅 מנוי חודשי', P.month, 'הכל פתוח לחודש. מתחדש כשמשלמים שוב.'],
        ['year', '📆 מנוי שנתי', P.year, 'הכל פתוח לשנה, במחיר של פחות מ־9 חודשים.'], ['full', '💎 רישיון מלא', P.full, 'קונים פעם אחת, פתוח לתמיד.']];
      var b = FS.dialog('⭐ שדרוג אופטימוס',
        '<div class="pl-up">' + (why ? '<p class="pl-why">' + why + '</p>' : '') +
        '<div class="pl-cmp"><div><h4>גרסה חינמית</h4><ul><li>עריכה, תיקון צבע, מסגרות והדפסה</li><li>פס קטן "נערך באופטימוס" על כל הדפסה וקובץ</li><li>' + FREE_AI + ' עיצובי AI ביום</li><li>בלי קולאז׳, עורך מסגרות מקצועי ו־AI מקומי</li></ul></div>' +
        '<div class="on"><h4>אופטימוס מלא</h4><ul><li>הדפסות וקבצים נקיים, בלי שום סימן</li><li>AI בלי הגבלה, גם מקומי בלי אינטרנט</li><li>קולאז׳, 16 מסגרות AI מההזמנה ועורך מקצועי</li><li>כל העדכונים לתוכנית שלך</li></ul></div></div>' +
        '<div class="pl-cards">' + cards.map(function (c) { return '<div class="pl-card' + (c[0] === 'year' ? ' best' : '') + '"><h4>' + c[1] + '</h4><b>' + c[2] + ' ' + cur + '</b><p>' + c[3] + '</p><button class="btn" data-want="' + c[0] + '">📩 בקשה</button></div>'; }).join('') + '</div>' +
        '<p class="pl-note" id="pl-note">לוחצים "בקשה": חיים מקבל הודעה עם הפרטים שלך, ואחרי התשלום (ביט, העברה או אשראי) הכל נפתח לבד בתוכנה. אפשר גם ישר <a target="_blank" rel="noopener" href="' + wa('שלום חיים, אני רוצה לשדרג את אופטימוס (' + (L.email || '') + ')') + '">בוואטסאפ</a>.</p></div>', true);
      b.addEventListener('click', function (e) {
        var x = e.target.closest('[data-want]'); if (!x) return;
        var want = x.dataset.want, name = x.closest('.pl-card').querySelector('h4').textContent;
        x.disabled = true; x.textContent = '…';
        LIC.call('plan-request', { token: L.token, want: want }).then(function (r) {
          var n = b.querySelector('#pl-note');
          if (r && r.ok) { x.textContent = '✔ נשלח'; n.innerHTML = '✔ הבקשה ל' + name + ' נשלחה לחיים. הוא יחזור אליך לתשלום, ומיד אחריו הכל נפתח. רוצה מהר? <a target="_blank" rel="noopener" href="' + wa('שלום חיים, ביקשתי ' + name + ' באופטימוס (' + (L.email || '') + ')') + '">כותבים לו בוואטסאפ</a>.'; }
          else { x.disabled = false; x.textContent = '📩 בקשה'; n.innerHTML = 'הבקשה לא נשלחה (' + (ACC ? ACC.msg(r || {}) : 'שגיאה') + '). אפשר <a target="_blank" rel="noopener" href="' + wa('שלום חיים, אני רוצה ' + name + ' באופטימוס (' + (L.email || '') + ')') + '">בוואטסאפ</a>.'; }
        });
      });
    });
    return t;
  };
  function gate(what) { if (FS.can(what)) return true; FS.upgrade(LOCKED[what] + ' פתוח בניסיון החינמי ובכל תוכנית בתשלום.'); return false; }
  FS.planGate = gate;

  /* ---------- what the free tier changes ---------- */
  /* prints and files: a thin band at the bottom */
  var rf = FS.renderFull;
  if (rf) FS.renderFull = function () {
    var c = rf.apply(this, arguments); if (FS.can('clean')) return c;
    var x = c.getContext('2d'), h = Math.max(12, Math.round(Math.min(c.width, c.height) * 0.028)), bh = Math.round(h * 1.7);
    x.save(); x.fillStyle = 'rgba(12,12,14,.62)'; x.fillRect(0, c.height - bh, c.width, bh);
    x.fillStyle = '#F3DDA6'; x.font = '600 ' + h + 'px Heebo, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText('נערך באופטימוס · פריים מגנטים · גרסה חינמית', c.width / 2, c.height - bh / 2); x.restore();
    return c;
  };
  /* the cloud AI: a few photos a day */
  var ask = FS.askServer;
  if (ask) FS.askServer = function (body) {
    var pic = body && (body.action === 'restyle' || body.action === 'image');
    if (!pic || FS.planTier() !== 'free') return ask.apply(this, arguments);
    if (!FS.can('ai')) { gate('ai'); return Promise.resolve({ ok: false, error: 'plan-limit' }); }
    return ask.apply(this, arguments).then(function (r) { if (r && r.ok) aiCount(); return r; });
  };
  /* the collage, the pro frame editor, the local AI */
  var openTab = FS.openTab;
  if (openTab) FS.openTab = function (n) { if (n === 'collage' && !gate('collage')) return; return openTab.apply(this, arguments); };
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-fm-open]') && !FS.can('frame-pro')) { e.preventDefault(); e.stopImmediatePropagation(); gate('frame-pro'); }
  }, true);
  if (FS.frameMaker) { var fmo = FS.frameMaker.open; FS.frameMaker.open = function () { if (gate('frame-pro')) return fmo.apply(this, arguments); }; }
  if (FS.localAI && FS.localAI.open) { var lao = FS.localAI.open; FS.localAI.open = function () { if (gate('local-ai')) return lao.apply(this, arguments); }; }

  /* ---------- a trial's events: a day with enough prints counts once; told to the server when there is a connection ---------- */
  function report() {
    var L = LIC.get(), p = LIC.plan(), d = jget('fs-plan-day', null);
    if (!L || !p || !d || d.sent || FS.planTier() !== 'trial' || d.n < (p.eventPrints || 20)) return;
    var evs = jget('fs-plan-events', []); if (evs.indexOf(d.day) < 0) { evs.push(d.day); ls('fs-plan-events', JSON.stringify(evs.slice(-10))); }
    LIC.call('trial-event', { token: L.token, day: d.day, prints: d.n }).then(function (r) {
      if (!r || !r.ok) return;
      d.sent = true; ls('fs-plan-day', JSON.stringify(d)); if (r.plan) LIC.setPlan(r.plan);
      if (r.plan && r.plan.tier === 'trial') FS.toast('🎁 אירוע ' + r.plan.events + ' מתוך ' + r.plan.eventsMax + ' בניסיון החינמי');
    });
  }
  FS.on('printed', function (n) {
    var d = jget('fs-plan-day', null), t = today();
    if (!d || d.day !== t) d = { day: t, n: 0 };
    d.n += Number(n) || 0; ls('fs-plan-day', JSON.stringify(d)); report(); pill();
  });

  /* ---------- the plan pill, and a word when the trial ends ---------- */
  function left(iso) { return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY)); }
  function hm(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + d.getDate() + '.' + (d.getMonth() + 1); }
  function pill() {
    var t = FS.planTier(), p = LIC.plan() || {}, el = document.getElementById('plan-pill');
    var txt = '';
    if (t === 'trial') { var ev = Math.max(0, (p.eventsMax || 2) - Math.max(p.events || 0, jget('fs-plan-events', []).length)), dl = left(p.ends); txt = '🎁 ניסיון חינם · ' + (ev ? (ev === 1 ? 'עוד אירוע אחד' : 'עוד ' + ev + ' אירועים') + (dl ? ' או ' + (dl === 1 ? 'יום אחד' : dl + ' ימים') : '') : dl === 1 ? 'יום אחרון' : 'עוד ' + dl + ' ימים'); }
    else if (t === 'pass') txt = '🎟️ כרטיס אירוע עד ' + hm(p.until);
    else if (t === 'free') txt = 'גרסה חינמית · ⭐ שדרוג';
    else if (t === 'pro' && p.until && left(p.until) <= 7) txt = '📅 המנוי נגמר בעוד ' + left(p.until) + ' ימים · חידוש';
    if (!txt) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('button'); el.id = 'plan-pill'; el.type = 'button'; el.addEventListener('click', function () { FS.upgrade(); }); }
    var host = document.querySelector('#mt .mt-acts');
    if (host && el.parentNode !== host) host.insertBefore(el, host.firstChild); else if (!host && el.parentNode !== document.body) document.body.appendChild(el);
    el.classList.toggle('free', t === 'free'); el.classList.toggle('fixed', !host); el.hidden = false; el.textContent = txt;
    var was = ls('fs-plan-was');
    if (was === 'trial' && t === 'free') setTimeout(function () { FS.upgrade('🎁 הניסיון החינמי הסתיים. התוכנה ממשיכה לעבוד בגרסה החינמית, ואפשר לפתוח הכל שוב בכל רגע.'); }, 800);
    if (was !== t) ls('fs-plan-was', t);
  }
  FS.on('plan', function () { pill(); report(); });
  document.addEventListener('DOMContentLoaded', pill);
  setTimeout(function () { pill(); report(); }, 1500);
  setInterval(pill, 60000);
})();
