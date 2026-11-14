/* The AI video & image tools directory on the AI page: cards from ai-tools.json, with sign-up links. */
(function () {
  'use strict';
  var host = document.getElementById('ai-tools');
  if (!host) return;
  fetch('ai-tools.json').then(function (r) { return r.json(); }).then(function (d) {
    var note = document.createElement('p'); note.className = 'muted'; note.textContent = d.note; host.appendChild(note);
    var filt = document.createElement('div'); filt.className = 'ait-filt';
    var grid = document.createElement('div'); grid.className = 'ait-grid';
    var cur = 'all';
    function draw() {
      grid.textContent = '';
      d.tools.filter(function (t) { return cur === 'all' || t.plan === cur; }).forEach(function (t) {
        var a = document.createElement('a'); a.className = 'ait-card ' + t.plan; a.href = t.url; a.target = '_blank'; a.rel = 'noopener';
        var b = document.createElement('b'); b.textContent = t.name;
        var tag = document.createElement('span'); tag.className = 'ait-tag'; tag.textContent = t.plan === 'free' ? 'חינמי' : 'בתשלום';
        var k = document.createElement('small'); k.textContent = t.kind;
        var p = document.createElement('p'); p.textContent = t.note;
        a.appendChild(tag); a.appendChild(b); a.appendChild(k); a.appendChild(p); grid.appendChild(a);
      });
    }
    [['all', 'הכול'], ['free', 'חינמיים'], ['paid', 'בתשלום']].forEach(function (f) {
      var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn btn-ghost btn-sm'; bt.textContent = f[1];
      bt.addEventListener('click', function () { cur = f[0]; draw(); }); filt.appendChild(bt);
    });
    host.appendChild(filt); host.appendChild(grid); draw();
  }).catch(function () { host.textContent = 'לא הצלחתי לטעון את הרשימה'; });
})();
