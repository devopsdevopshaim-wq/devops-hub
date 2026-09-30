// "הוספת פרויקט": builds a GitHub issue from the form. The portfolio-add
// workflow reads the ```json block, adds the project and closes the issue.
(function () {
  'use strict';

  var form = document.getElementById('add-form');
  if (!form) return;
  var err = document.getElementById('add-error');
  var steps = document.getElementById('file-steps');
  var preview = document.getElementById('add-preview');
  var catSel = document.getElementById('add-cat');
  var data = null;

  function values() {
    var f = new FormData(form);
    var list = function (v, sep) { return String(v || '').split(sep).map(function (x) { return x.trim(); }).filter(Boolean); };
    return {
      kind: f.get('kind'),
      title: String(f.get('title') || '').trim(),
      url: String(f.get('url') || '').trim(),
      desc: String(f.get('desc') || '').trim(),
      category: f.get('category') || 'web',
      tech: list(f.get('tech'), ','),
      features: list(f.get('features'), '\n'),
      story: String(f.get('story') || '').trim()
    };
  }

  function drawPreview() {
    var v = values();
    var cat = data ? data.categories[v.category] : '';
    preview.innerHTML = '';
    var card = document.createElement('article');
    card.className = 'card in cat-' + v.category;
    card.innerHTML = '<div class="media cat-' + v.category + '">' + window.PORTFOLIO_ART(v.category) + '</div><div class="body"><span class="cat"></span><h3></h3><p></p><div class="row"><span class="link open">פתיחה</span></div></div><div class="card-foot"><span class="addr"><span></span></span></div>';
    card.querySelector('.cat').textContent = cat;
    card.querySelector('h3').textContent = v.title || 'שם הפרויקט';
    card.querySelector('p').textContent = v.desc || 'משפט אחד שמסביר מה הפרויקט עושה.';
    card.querySelector('.addr span').textContent = v.url.replace(/^https?:\/\//, '') || 'כתובת';
    preview.appendChild(card);
  }

  function fail(msg, field) {
    err.textContent = msg;
    err.hidden = false;
    if (field) form.elements[field].focus();
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'kind') {
      steps.hidden = e.target.value !== 'file';
      form.elements.url.placeholder = e.target.value === 'site' ? 'https://' : 'https://github.com/…';
    }
    drawPreview();
  });
  form.addEventListener('input', drawPreview);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var v = values();
    if (!/^https?:\/\/\S+\.\S+/.test(v.url)) return fail('צריך כתובת מלאה שמתחילה ב־https://', 'url');
    if (!v.title) return fail('צריך שם לפרויקט', 'title');
    if (v.kind !== 'site' && !/github\.(com|io)/.test(v.url)) return fail('זה לא נראה כמו קישור ל־GitHub. אם זה אתר רגיל, בחרו "אתר שכבר באוויר".', 'url');

    var payload = { title: v.title, url: v.url, desc: v.desc, category: v.category, tech: v.tech, features: v.features, story: v.story };
    var body = 'בקשה מהאתר להוסיף פרויקט. אפשר לערוך את הפרטים כאן לפני השליחה.\n\n```json\n' + JSON.stringify(payload, null, 2) + '\n```\n';
    var owner = (data && data.owner) || 'devopsdevopshaim-wq';
    var url = 'https://github.com/' + owner + '/devops-hub/issues/new?title=' + encodeURIComponent('הוספת פרויקט: ' + v.title) + '&body=' + encodeURIComponent(body);
    window.open(url, '_blank', 'noopener');
  });

  fetch('projects.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    Object.keys(d.categories).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = d.categories[k];
      catSel.appendChild(o);
    });
    drawPreview();
  });
})();
