/* The owner's pulse, on every admin screen: a status bar of what is open now (online customers, today's registrations, trials,
   paying, upgrade and update requests, blocked trials), and a pop-up for each new thing that needs the owner. Asked every 45
   seconds (lic-pulse, admin only); what was already shown is remembered in this browser. */
(function () {
  'use strict';
  var FS = window.FS || {}, LIC = FS.license, ACC = FS.account;
  if (!LIC || !ACC || !ACC.isAdmin) return;
  var KEY = 'adm-pulse-shown', START = 'adm-pulse-start';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function wa(phone, text) { var d = String(phone || '').replace(/\D/g, '').replace(/^0/, '972'); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); }
  var shown = {}; try { shown = JSON.parse(ls(KEY) || '{}') || {}; } catch (e) { shown = {}; }
  if (!ls(START)) ls(START, new Date().toISOString());
  var ICON = { upd: '⬆️', plan: '📩', blocked: '🚫', lead: '📝', trial: '🎁', sec: '🛡️' }, TITLE = { upd: 'בקשת עדכון גרסה', plan: 'בקשת רכישה', blocked: 'ניסיון נוסף נחסם', lead: 'נרשם חדש', trial: 'התחיל ניסיון', sec: 'התראת אבטחה' };
  var bar = null, stack = null, base = document.title;
  function ensure() {
    if (!bar) {
      bar = document.createElement('a'); bar.id = 'adm-pulse'; bar.href = 'admin.html#licenses'; bar.title = 'מצב הלקוחות עכשיו · לחיצה לרישיונות ומשימות';
      document.body.appendChild(bar);
      stack = document.createElement('div'); stack.id = 'adm-pops'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack);
      stack.addEventListener('click', function (e) { var x = e.target.closest('[data-pop-x]'); if (x) x.closest('.adm-pop').remove(); });
    }
  }
  function pop(it) {
    var el = document.createElement('div'); el.className = 'adm-pop k-' + it.kind;
    var msg = it.kind === 'upd' ? 'שלום ' + (it.name || '') + ', קיבלתי את בקשת העדכון לאופטימוס. ' : 'שלום ' + (it.name || '') + ', כאן חיים מאופטימוס 🙂 ';
    el.innerHTML = '<div class="adm-pop-h"><b>' + ICON[it.kind] + ' ' + TITLE[it.kind] + '</b><button data-pop-x title="סגירה">✕</button></div>' +
      '<p><b>' + esc(it.name || it.email) + '</b> ' + esc(it.text) + '</p><p class="adm-pop-m" dir="ltr">' + esc(it.email) + (it.phone ? ' · ' + esc(it.phone) : '') + '</p>' +
      '<div class="adm-pop-a"><a href="admin.html#licenses">לטיפול ←</a>' + (it.phone ? '<a target="_blank" rel="noopener" href="' + esc(wa(it.phone, msg)) + '">💬 וואטסאפ</a><a href="tel:' + esc(it.phone) + '">📞</a>' : '') + '</div>';
    stack.insertBefore(el, stack.firstChild);
    while (stack.children.length > 4) stack.lastChild.remove();
    if (it.kind === 'lead' || it.kind === 'trial') setTimeout(function () { el.remove(); }, 20000);
  }
  function tick() {
    if (!ACC.isAdmin() || document.hidden) return;
    LIC.admin('lic-pulse').then(function (r) {
      if (!r || !r.ok) return;
      ensure();
      var c = r.counts || {}, open = (c.upd || 0) + (c.plan || 0) + (c.blocked || 0);
      bar.innerHTML = '<span>🟢 ' + (c.online || 0) + ' מחוברים</span><span>📝 ' + (c.leadsToday || 0) + ' נרשמו היום</span><span>🎁 ' + (c.trials || 0) + ' בניסיון</span><span>💎 ' + (c.paying || 0) + ' משלמים</span>' +
        '<span class="' + (c.plan ? 'hot' : '') + '">📩 ' + (c.plan || 0) + ' בקשות רכישה</span><span class="' + (c.upd ? 'hot' : '') + '">⬆️ ' + (c.upd || 0) + ' בקשות עדכון</span>' + (c.blocked ? '<span class="hot">🚫 ' + c.blocked + ' נחסמו</span>' : '') + (c.sec ? '<span class="hot">🛡️ ' + c.sec + ' אירועי אבטחה היום</span>' : '<span>🛡️ מאובטח</span>');
      document.title = (open ? '(' + open + ') ' : '') + base;
      var start = Date.parse(ls(START) || 0), fresh = (r.items || []).filter(function (it) {
        var k = it.kind + ':' + it.email + ':' + it.at + (it.kind === 'sec' ? ':' + it.text.slice(0, 40) : ''); if (shown[k]) return false;
        if ((it.kind === 'lead' || it.kind === 'trial' || it.kind === 'sec') && Date.parse(it.at) < start) { shown[k] = 1; return false; }   /* old news: no pop-up */
        shown[k] = 1; return true;
      });
      fresh.slice(0, 4).reverse().forEach(pop);
      var ks = Object.keys(shown); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(function (k) { delete shown[k]; });
      ls(KEY, JSON.stringify(shown));
    }, function () {});
  }
  setTimeout(tick, 2500); setInterval(tick, 45000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
})();
