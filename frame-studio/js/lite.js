/* 🪶 Light mode: the same program with less drawing work, for a computer that is not strong (or for anyone who prefers it
   calm). No blur behind panels, no soft shadows, no animations or transitions, and the decorative moving parts stop; every
   tool stays. It turns itself on once on a weak computer (4 processor threads or fewer, or 4 GB of memory or less) and the
   🪶 button beside "❓ עזרה" switches it either way (remembered). html.fs-lite, css/lite.css; FS.lite(on) */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {}, K = 'fs-lite';
  function get() { try { return localStorage.getItem(K); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(K, v ? '1' : '0'); } catch (e) { /* private mode */ } }
  var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  var saved = get(), on = saved === null ? !!weak : saved === '1';
  function apply() {
    document.documentElement.classList.toggle('fs-lite', on);
    var b = document.getElementById('lite-btn'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  }
  apply();
  FS.lite = function (v) { if (v === undefined) return on; on = !!v; set(on); apply(); return on; };
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return setTimeout(button, 1500);
    if (document.getElementById('lite-btn')) return;
    var b = document.createElement('button'); b.id = 'lite-btn'; b.type = 'button'; b.className = 'mt-btn'; b.textContent = '🪶 קליל';
    b.title = 'מצב קליל: בלי אנימציות וטשטושים, התוכנה מהירה יותר במחשב חלש. כל הכלים נשארים.';
    b.addEventListener('click', function () { FS.lite(!on); if (FS.toast) FS.toast(on ? '🪶 מצב קליל פועל: פחות אפקטים, יותר מהירות' : 'מצב קליל כבוי', 3000); });
    host.appendChild(b); apply();
  }
  setTimeout(button, 2200);
  if (saved === null && weak) setTimeout(function () { if (FS.toast) FS.toast('🪶 המחשב הזה חלש יחסית, אז הופעל מצב קליל (פחות אפקטים, יותר מהירות). מכבים בכפתור 🪶 למעלה.', 7000); }, 5000);
})();
