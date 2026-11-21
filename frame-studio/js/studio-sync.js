/* The studio tells the owner's phone what is happening in it. When the owner is signed in (the admin session, never a
   customer's), a short summary goes to the server: which computer, the event open now, how many photos, what was printed
   (sheets, prints, in this event and today), the printer's ink and paper estimates, and the events saved in this studio.
   The admin (and the admin app on the phone) shows it under "🖥️ מה קורה בתוכנה". No photos, no logos, no customer details
   leave the computer: only names, dates and counts. Sent when something changed, at most once a minute, and every 15
   minutes while open. Deals, requests and customers are already shared through the server. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  var KD = 'fs-sync-dev', last = '', lastAt = 0, timer = null;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function json(k, d) { try { return JSON.parse(ls(k)) || d; } catch (e) { return d; } }
  function dev() {
    var id = ls(KD); if (!id) { id = 'd' + Math.random().toString(36).slice(2, 12); try { localStorage.setItem(KD, id); } catch (e) { /* private mode */ } }
    return id;
  }
  function kind() { var ua = navigator.userAgent || ''; return window.FSDesktop ? 'desktop' : /iPhone|iPad|Android|Mobi/i.test(ua) ? 'phone' : 'browser'; }
  function day(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function summary() {
    var pr = json('frame-studio-printer', null) || {}, log = json('frame-studio-printlog', null) || {}, jobs = Array.isArray(log.jobs) ? log.jobs : [];
    var today = day(Date.now()), sum = function (l, k) { return l.reduce(function (s, j) { return s + (Number(j[k]) || 0); }, 0); };
    var tj = jobs.filter(function (j) { return j.t && day(j.t) === today; });
    var ev = (FS.prefs && FS.prefs.event) || {};
    return {
      device: dev(), kind: kind(), ver: String((document.getElementById('fs-ver') || {}).textContent || '').replace(/[^\w.\-]/g, '').slice(0, 20),
      event: { names: String(ev.names || '').slice(0, 80), date: String(ev.date || '').slice(0, 10), type: String(ev.type || '').slice(0, 30) },
      photos: (FS.state && FS.state.photos && FS.state.photos.length) || 0,
      print: { name: String(log.name || '').slice(0, 80), start: log.start || 0, jobs: jobs.length, sheets: sum(jobs, 'sheets'), items: sum(jobs, 'items'), todaySheets: sum(tj, 'sheets'), todayItems: sum(tj, 'items'), lastAt: jobs.reduce(function (m, j) { return Math.max(m, j.t || 0); }, 0) },
      printer: { name: String(pr.name || '').slice(0, 60), ink: pr.inkCap > 0 ? Math.max(0, Math.floor(100 - (pr.inkUsed || 0) / pr.inkCap * 100)) : null, paper: pr.paperCap > 0 ? Math.max(0, pr.paperCap - (pr.paperUsed || 0)) : null },
      printedTotal: Number(ls('frame-studio-printed') || 0),
      events: json('frame-studio-events', []).slice(0, 40).map(function (e) { return { names: String(e.names || '').slice(0, 80), date: String(e.date || '').slice(0, 10), type: String(e.type || '').slice(0, 30) }; })
    };
  }
  function send(force) {
    var A = FS.account; if (!A || !A.isAdmin || !A.isAdmin() || !navigator.onLine) return;
    var s = summary(), key = JSON.stringify(s);
    if (!force && key === last && Date.now() - lastAt < 15 * 60000) return;
    if (!force && Date.now() - lastAt < 60000) { clearTimeout(timer); timer = setTimeout(function () { send(); }, 60000); return; }
    last = key; lastAt = Date.now();
    A.call('studio-sync', { studio: s }).then(function () {}, function () { last = ''; });
  }
  FS.studioSync = function () { send(true); };
  function start() {
    setTimeout(function () { send(true); }, 5000);
    setInterval(function () { send(); }, 3 * 60000);
    ['photos-added', 'printed', 'print-job'].forEach(function (ev) { if (FS.on) FS.on(ev, function () { setTimeout(send, 1500); }); });
    window.addEventListener('afterprint', function () { setTimeout(send, 1500); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
