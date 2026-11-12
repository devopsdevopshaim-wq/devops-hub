/* ☀️ The ivory look (css/ivory.css): white with gold touches, the program's default; the ☀️/🌙 button beside "🪶 קליל"
   switches to the night look and back (remembered). html.fs-ivory; FS.ivory(on) */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {}, K = 'fs-ivory';
  function get() { try { return localStorage.getItem(K); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(K, v ? '1' : '0'); } catch (e) { /* private mode */ } }
  var on = get() !== '0';
  function apply() {
    document.documentElement.classList.toggle('fs-ivory', on);
    var b = document.getElementById('ivory-btn'); if (b) { b.textContent = on ? '🌙 כהה' : '☀️ בהיר'; b.title = on ? 'מעבר למראה כהה' : 'מעבר למראה בהיר (לבן וזהב)'; }
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', on ? '#FBF8F2' : '#0F0F11');
  }
  FS.ivory = function (v) { on = !!v; set(on); apply(); };
  apply();
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return setTimeout(button, 1500);
    if (document.getElementById('ivory-btn')) return;
    var b = document.createElement('button'); b.id = 'ivory-btn'; b.type = 'button'; b.className = 'mt-btn';
    b.addEventListener('click', function () { FS.ivory(!on); });
    host.appendChild(b); apply();
  }
  setTimeout(button, 2300);
})();
