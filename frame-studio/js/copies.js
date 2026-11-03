/* 🧮 How many to print: the faces in each photo decide its copies, the way the owner prints at an event.
   - one copy for every adult who looks at the camera; children next to their parents add none (a family takes one);
   - faces far in the back (small, a third of the main faces or less) are guests passing by and do not count;
   - if anyone in front has closed eyes, the photo is not printed at all (0 copies), and a photo next to it in the series
     (the same moment, the same number of people) where everyone's eyes are open is suggested instead.
   Everything is on this computer (the face landmarker of faces.js: points and eye blinks), nothing leaves it.
   A child is estimated from the face (smaller than the adults in the photo, and a child's proportions); the owner can
   always change a number with − / + after the advice. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  function d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /* one photo: the faces that count, and why */
  function judge(faces) {
    var F = faces.map(function (f) {
      var P = f.pts, eye = d(P[33], P[263]), h = d(P[10], P[152]), mid = { x: (P[33].x + P[263].x) / 2, y: (P[33].y + P[263].y) / 2 };
      var yaw = Math.abs(P[1].x - mid.x) / Math.max(1, eye);                    /* nose off the middle of the eyes: turned away */
      var openL = d(P[159], P[145]) / Math.max(1, d(P[33], P[133])), openR = d(P[386], P[374]) / Math.max(1, d(P[362], P[263]));
      var bl = f.bs || {}, blink = ((bl.eyeBlinkLeft || 0) + (bl.eyeBlinkRight || 0)) / 2;
      var closed = blink > 0.5 || (openL < 0.12 && openR < 0.12);
      return { h: h, eye: eye, prop: eye / Math.max(1, h), facing: yaw < 0.32, closed: closed, doubt: !closed && blink > 0.4, cx: (P[33].x + P[263].x) / 2, cy: mid.y };
    });
    if (!F.length) return { faces: 0, people: 0, adults: 0, kids: 0, away: 0, closed: 0, copies: 0, verdict: 'none' };
    var big = Math.max.apply(null, F.map(function (x) { return x.h; }));
    var front = F.filter(function (x) { return x.h >= big * 0.45; });              /* guests far behind do not count */
    var ref = front.reduce(function (a, x) { return x.h > a.h ? x : a; }, front[0]);
    front.forEach(function (x) {
      var rel = x.h / ref.h, lower = x.cy - ref.cy > ref.h * 0.18;
      /* a child: much smaller than the biggest face here; or smaller, lower in the frame (standing by a parent) and with a
         child's proportions (eyes wide on a short face). An adult further back is smaller but not lower, so stays an adult. */
      x.kid = front.length > 1 && x !== ref && (rel < 0.6 || (rel < 0.9 && lower && x.prop >= 0.58));
    });
    var closed = front.filter(function (x) { return x.closed; }).length;
    var adults = front.filter(function (x) { return !x.kid && x.facing; }).length, kids = front.filter(function (x) { return x.kid; }).length, away = front.filter(function (x) { return !x.kid && !x.facing; }).length;
    var copies = closed ? 0 : Math.max(adults, kids && !adults ? 1 : 0, front.length ? 1 : 0);
    if (!closed && adults === 0 && away > 0) copies = 1;
    var doubt = !closed && front.some(function (x) { return x.doubt; });
    return { faces: F.length, people: front.length, adults: adults, kids: kids, away: away, closed: closed, doubt: doubt, copies: copies, verdict: closed ? 'closed' : 'ok' };
  }
  FS.judgeFaces = judge;
  function dhash(im) {
    var c = document.createElement('canvas'); c.width = 9; c.height = 8; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 9, 8);
    var d = x.getImageData(0, 0, 9, 8).data, bits = [];
    for (var y = 0; y < 8; y++) for (var i = 0; i < 8; i++) { var a = (y * 9 + i) * 4, b = a + 4; bits.push((d[a] + d[a + 1] + d[a + 2]) > (d[b] + d[b + 1] + d[b + 2]) ? 1 : 0); }
    return bits;
  }
  function same(a, b) { if (!a || !b) return false; var n = 0; for (var i = 0; i < 64; i++) if (a[i] !== b[i]) n++; return n <= 16; }
  /* the advice for a list of photos; progress(i, n) */
  FS.copiesAdvice = function (list, progress, stopped) {
    if (!window.FaceSig) return Promise.reject(new Error('faces'));
    var out = [];
    return list.reduce(function (ch, p, i) {
      return ch.then(function () {
        if (stopped && stopped()) return;
        if (progress) progress(i, list.length);
        return FS.loadImg(p.src).then(function (im) { p._dh = dhash(im); return FaceSig.detect(im, 1280); }).then(function (faces) { var r = judge(faces); r.p = p; p.cadv = r; out.push(r); }, function () { out.push({ p: p, verdict: 'error', copies: null }); });
      });
    }, Promise.resolve()).then(function () {
      /* a photo with closed eyes: the nearest photo of the same moment (up to 6 photos away, the same scene by its picture
         fingerprint, about the same number of people, and everyone's eyes open). Photos not checked yet are checked now. */
      var S = FS.state.photos;
      return out.filter(function (r) { return r.verdict === 'closed'; }).reduce(function (ch, r) {
        return ch.then(function () {
          var i = S.indexOf(r.p), cands = [];
          for (var k = 1; k <= 6; k++) [i - k, i + k].forEach(function (j) { if (S[j] && S[j] !== r.p) cands.push(S[j]); });
          return cands.reduce(function (c2, q) {
            return c2.then(function () {
              if (r.alt) return;
              return (q._dh ? Promise.resolve() : FS.loadImg(q.src).then(function (im) { q._dh = dhash(im); })).then(function () {
                if (!same(q._dh, r.p._dh)) return;
                return (q.cadv ? Promise.resolve() : FS.loadImg(q.src).then(function (im) { return FaceSig.detect(im, 1280); }).then(function (f) { q.cadv = judge(f); q.cadv.p = q; })).then(function () {
                  var a = q.cadv; if (a && a.verdict === 'ok' && !a.doubt && Math.abs(a.people - r.people) <= 1) r.alt = q;
                });
              });
            }).catch(function () {});
          }, Promise.resolve());
        });
      }, Promise.resolve()).then(function () { return out; });
    });
  };
  function esc(s) { return FS.esc(s); }
  function line(r) {
    if (r.verdict === 'error') return 'לא הצלחתי לקרוא את התמונה';
    if (r.verdict === 'none') return 'לא נמצאו פנים · נשאר כמו שהוא';
    if (r.verdict === 'closed') return '😑 ' + r.closed + (r.closed > 1 ? ' אנשים עוצמים' : ' אדם עוצם') + ' עיניים · לא להדפיס' + (r.alt ? ' · ✅ במקומה: ' + esc(String(r.alt.name || '').replace(/\.[^.]+$/, '')) + ' (' + r.alt.cadv.copies + ')' : ' · אין תמונה חלופית קרובה');
    var parts = []; if (r.adults) parts.push(r.adults + (r.adults > 1 ? ' מבוגרים מסתכלים' : ' מבוגר מסתכל')); if (r.kids) parts.push(r.kids + (r.kids > 1 ? ' ילדים (לא מוכפלים)' : ' ילד (לא מוכפל)')); if (r.away) parts.push(r.away + ' לא מסתכלים');
    return '👥 ' + (parts.join(' · ') || r.people + ' אנשים') + (r.doubt ? ' · 👀 כדאי לבדוק: עיניים חצי סגורות?' : '');
  }
  /* the window: the advice per photo, then one click applies it */
  FS.openCopiesAdvisor = function (list, done) {
    list = (list || []).filter(Boolean); if (!list.length) return FS.toast('אין תמונות');
    var stop = false; FS.busy && FS.busy('🧮 בודק פנים ועיניים…', function () { stop = true; });
    FS.copiesAdvice(list, function (i, n) { FS.busy && FS.busy('🧮 בודק פנים ועיניים · ' + (i + 1) + ' מתוך ' + n, function () { stop = true; }); }, function () { return stop; }).then(function (res) {
      FS.busy && FS.busy(); if (stop) return;
      var total = 0, bad = 0; res.forEach(function (r) { if (r.verdict === 'closed') { bad++; if (r.alt) total += r.alt.cadv.copies; } else if (r.copies != null && r.verdict !== 'none') total += r.copies; else total += r.p.copies == null ? 1 : r.p.copies; });
      var b = FS.dialog('🧮 כמה להדפיס', '<div class="ca"><p class="ca-sum"><b>' + total + '</b> מגנטים מומלצים · ' + res.length + ' תמונות' + (bad ? ' · <span class="ca-bad">' + bad + ' עם עיניים עצומות</span>' : '') + '</p>' +
        '<p class="mt-hint">עותק לכל מבוגר שמסתכל למצלמה. ילדים עם ההורים לא מוכפלים. תמונה שמישהו בה עוצם עיניים לא יוצאת, ובמקומה מוצעת תמונה סמוכה שבה כולם עם עיניים פתוחות. אחרי ההחלה אפשר לשנות כל מספר ב־− / +.</p>' +
        '<div class="ca-list">' + res.map(function (r, i) {
          var n = r.verdict === 'closed' ? 0 : r.verdict === 'ok' ? r.copies : (r.p.copies == null ? 1 : r.p.copies);
          return '<div class="ca-row ' + r.verdict + '"><img src="' + esc(r.p.src) + '" alt=""><div class="ca-t"><b>' + esc(String(r.p.name || '').replace(/\.[^.]+$/, '')) + '</b><span>' + line(r) + '</span></div><span class="ca-n" title="עותקים">' + n + '</span>' +
            (r.alt ? '<img class="ca-alt" src="' + esc(r.alt.src) + '" alt="" title="התמונה החלופית">' : '') + '</div>';
        }).join('') + '</div>' +
        '<label class="mt-chk-l"><input type="checkbox" id="ca-alt" checked> להוסיף את התמונות החלופיות להדפסה (במקום אלה עם העיניים העצומות)</label>' +
        '<div class="mt-row"><button class="mt-btn primary" id="ca-go">✔ להחיל את ההמלצה</button><button class="mt-btn" id="ca-x">ביטול</button></div></div>', true);
      b.classList.add('ca-dlg');
      b.querySelector('#ca-x').addEventListener('click', function () { FS.closeDialog(); });
      b.querySelector('#ca-go').addEventListener('click', function () {
        var alt = b.querySelector('#ca-alt').checked;
        res.forEach(function (r) {
          if (r.verdict === 'ok') r.p.copies = r.copies;
          else if (r.verdict === 'closed') { r.p.copies = 0; if (alt && r.alt) { r.alt.copies = Math.max(r.alt.copies || 0, r.alt.cadv.copies); FS.state.marked[r.alt.id] = true; } }
        });
        FS.closeDialog(); FS.emit('doc'); if (done) done(res);
        FS.toast('🧮 ההמלצה הוחלה: ' + total + ' מגנטים. אפשר לשנות כל מספר ב־− / +, ואז 🖨️.', 5000);
      });
    }).catch(function (e) { FS.busy && FS.busy(); FS.toast('זיהוי הפנים לא נטען (' + ((e && e.message) || '') + ').', 5000); });
  };
})();
