/* מעגל סגור — עורך כרטיסים: תבניות, הוספת רכיבים, חיבור חוטים, בדיקה אוטומטית ותכנון/בדיקה עם Claude. */
(function () {
  'use strict';

  var N = window.Netlist, P = window.FixParts, FP = window.FixPrompts, Store = window.DesignStore, A = window.FixApp;
  var esc = A.esc;

  var TYPE_HE = {
    resistor: 'נגד', capacitor: 'קבל', inductor: 'סליל', led: 'נורית LED', diode: 'דיודה', transistor: 'טרנזיסטור',
    regulator: 'רגולטור', mcu: 'מיקרו-בקר', ic: 'רכיב משולב', crystal: 'גביש', fuse: 'נתיך', source: 'מקור הזנה',
    connector: 'מחבר', button: 'לחצן', switch: 'מפסק', relay: 'ממסר', motor: 'מנוע', sensor: 'חיישן', lamp: 'נורה',
    breaker: 'מפסק זרם', rcd: 'ממסר פחת', contactor: 'מגען', overload: 'ממסר תרמי', selector: 'בורר', plc: 'PLC',
    psu: 'ספק כוח', vfd: 'ממיר תדר', terminal: 'מהדק', socket: 'שקע', smart: 'רכיב חכם', load: 'עומס', other: 'אחר'
  };

  var AI_EXAMPLES = [
    'כרטיס ESP32 עם 4 ממסרים 5V והזנה מ-12V',
    'Arduino Nano עם חיישן DHT22 ותצוגת OLED ב-I2C',
    '4 כניסות 24V מבודדות לבקר 3.3V',
    'ספק 5V 2A מ-24V עם ממיר ממותג',
    'מגבר שמע קטן עם LM386 מסוללה 9V'
  ];

  var st = { d: null, sel: {}, pin: null, undo: [], zoom: null, mounted: false, busy: null, check: null, ai: null, aiMode: 'create', timer: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function sch() { return st.d.schematic; }
  function comp(id) { return sch().components.filter(function (c) { return c.id === id; })[0]; }

  /* ---------- מצב ושמירה ---------- */

  function clean(s) {
    s = s || {};
    s.needed = true;
    s.title = s.title || '';
    s.notes = Array.isArray(s.notes) ? s.notes : [];
    s.components = Array.isArray(s.components) ? s.components : [];
    s.wires = Array.isArray(s.wires) ? s.wires : [];
    s.components.forEach(function (c) {
      c.terminals = Array.isArray(c.terminals) ? c.terminals : [];
      c.value = c.value || '';
      c.label = c.label || '';
      c.type = c.type || 'other';
    });
    s.wires.forEach(function (w) { w.color = w.color || ''; w.section = w.section || ''; w.label = w.label == null ? '' : String(w.label); });
    return normalize(s);
  }

  // עמודה ושורה ראשונות תמיד 0
  function normalize(s) {
    var cs = s.components;
    if (!cs.length) return s;
    var mc = Math.min.apply(null, cs.map(function (c) { return c.col | 0; }));
    var mr = Math.min.apply(null, cs.map(function (c) { return c.row | 0; }));
    cs.forEach(function (c) { c.col = (c.col | 0) - mc; c.row = (c.row | 0) - mr; });
    return s;
  }

  function snapshot() {
    st.undo.push(JSON.stringify(sch()));
    if (st.undo.length > 60) st.undo.shift();
    $('#dUndo').disabled = false;
  }

  function change(fn) {
    snapshot();
    fn(sch());
    normalize(sch());
    refresh();
    scheduleSave();
  }

  function undo() {
    if (!st.undo.length) return;
    st.d.schematic = JSON.parse(st.undo.pop());
    st.sel = {}; st.pin = null;
    $('#dUndo').disabled = !st.undo.length;
    refresh();
    scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(st.timer);
    $('#dSaved').textContent = '';
    st.timer = setTimeout(function () {
      Store.save(st.d).then(function () { $('#dSaved').textContent = 'נשמר'; fillOpen(); });
    }, 400);
  }

  function open(d) {
    st.d = d;
    clean(d.schematic);
    st.undo = []; st.sel = {}; st.pin = null; st.ai = null; st.zoom = null;
    $('#dUndo').disabled = true;
    $('#dAiPanel').innerHTML = '';
    $('#dName').value = d.name || '';
    $('#dNotes').value = d.schematic.notes.join('\n');
    refresh();
    fillOpen();
  }

  function create(schematic, name) {
    var s = clean(schematic);
    s.title = name || s.title || 'כרטיס חדש';
    var d = { id: uid(), created: Date.now(), name: s.title, schematic: s };
    open(d);
    return Store.save(d).then(fillOpen);
  }

  function fillOpen() {
    Store.all().then(function (list) {
      var sel = $('#dOpen');
      sel.innerHTML = '<option value="">העיצובים שלי (' + list.length + ')</option>' + list.map(function (d) {
        return '<option value="' + d.id + '"' + (st.d && d.id === st.d.id ? ' selected' : '') + '>' + esc(d.name || 'ללא שם') + ' · ' + esc(new Date(d.updated).toLocaleDateString('he-IL')) + '</option>';
      }).join('');
    });
  }

  /* ---------- ציור ---------- */

  function refresh() {
    var s = sch();
    st.check = N.check(s);
    var host = $('#dCanvas');
    if (!s.components.length) {
      host.innerHTML = '<div class="canvas-empty"><p><b>הכרטיס ריק.</b></p><p>הוסיפו רכיבים מהרשימה, בחרו תבנית, או בקשו מ-Claude לתכנן מעגל.</p></div>';
    } else {
      host.innerHTML = '<div class="sch-inner">' + N.render(s, { issues: st.check.issues, interactive: true, selected: { comp: st.sel.comp, wire: st.sel.wire, pin: st.pin } }) + '</div>';
      applyZoom();
    }
    $('#dHint').textContent = st.pin
      ? 'נבחר הפין ' + st.pin + '. לחצו על פין נוסף כדי לחבר חוט (Esc לביטול).'
      : 'לחצו על פין ואז על פין אחר כדי לחבר חוט. גררו רכיב כדי להזיז אותו. Delete מוחק את הנבחר.';
    inspector();
    checks();
    bom();
  }

  function applyZoom() {
    var svg = $('#dCanvas svg');
    if (!svg) return;
    var w = +svg.getAttribute('width');
    var z = st.zoom;
    if (z == null) {
      var avail = $('#dCanvas').clientWidth - 8;
      z = avail > 0 ? Math.min(1, avail / w) : 1;
    }
    svg.style.width = (w * z) + 'px';
    svg.style.height = 'auto';
  }

  function currentZoom() {
    var svg = $('#dCanvas svg');
    return svg ? svg.getBoundingClientRect().width / +svg.getAttribute('width') : 1;
  }

  /* ---------- עריכה בקנבס ---------- */

  function svgPoint(svg, ev) {
    var pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function bindCanvas() {
    var host = $('#dCanvas'), drag = null;

    host.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var g = ev.target.closest('.comp');
      if (!g || ev.target.closest('[data-pin]')) return;
      var svg = host.querySelector('svg');
      drag = { id: g.dataset.id, g: g, svg: svg, start: svgPoint(svg, ev), moved: false, pid: ev.pointerId };
      g.setPointerCapture(ev.pointerId);
    });
    host.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var p = svgPoint(drag.svg, ev), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      drag.moved = true; drag.dx = dx; drag.dy = dy;
      drag.g.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
      drag.g.classList.add('dragging');
    });
    host.addEventListener('pointerup', function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      st.dragEnd = Date.now();
      if (!d.moved) { st.sel = { comp: d.id }; st.pin = null; refresh(); return; }
      var box = N.layout(sch()).comps.filter(function (b) { return b.c.id === d.id; })[0];
      if (box) dropTo(d.id, box.x + d.dx, box.y + d.dy);
    });
    host.addEventListener('pointercancel', function () { drag = null; refresh(); });

    host.addEventListener('click', function (ev) {
      if (Date.now() - (st.dragEnd || 0) < 350) return;
      var pin = ev.target.closest('[data-pin]');
      if (pin) { pinClick(pin.dataset.pin); return; }
      var w = ev.target.closest('.wire');
      if (w) { st.sel = { wire: +w.dataset.w }; st.pin = null; refresh(); return; }
      if (!ev.target.closest('.comp') && (st.sel.comp || st.sel.wire != null || st.pin)) { st.sel = {}; st.pin = null; refresh(); }
    });

    document.addEventListener('keydown', function (ev) {
      if ($('#view-design').hidden || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if ($('dialog[open]')) return;
      if (ev.key === 'Escape' && (st.pin || st.sel.comp || st.sel.wire != null)) { st.pin = null; st.sel = {}; refresh(); }
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && (st.sel.comp || st.sel.wire != null)) { ev.preventDefault(); removeSelected(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); }
    });
  }

  // מיקום חדש לפי נקודת השחרור: עמודה ושורה ברשת
  function dropTo(id, x, y) {
    var L = N.layout(sch()), G = N.GEOM;
    var ci = Math.round((x - G.EDGE) / (G.BOX_W + G.GAP_X));
    var cv = L.colVals, rv = L.rowVals;
    var col = ci < 0 ? cv[0] + ci : ci < cv.length ? cv[ci] : cv[cv.length - 1] + (ci - cv.length + 1);
    var ri = 0, best = Infinity;
    L.rowY.forEach(function (ry, i) { var dd = Math.abs(ry - y); if (dd < best) { best = dd; ri = i; } });
    var row = rv[ri];
    if (y < L.rowY[0] - 70) row = rv[0] - 1;
    if (y > L.rowBottom[L.rowBottom.length - 1] + 30) row = rv[rv.length - 1] + 1;
    st.sel = { comp: id };
    change(function () { var c = comp(id); c.col = col; c.row = row; });
  }

  function pinClick(key) {
    if (!st.pin) { st.pin = key; st.sel = {}; refresh(); return; }
    if (st.pin === key) { st.pin = null; refresh(); return; }
    var a = st.pin, b = key;
    var dup = sch().wires.some(function (w) { return (w.from === a && w.to === b) || (w.from === b && w.to === a); });
    st.pin = null;
    if (dup) { A.toast('החוט הזה כבר קיים'); refresh(); return; }
    var color = pickColor(a, b);
    change(function (s) {
      s.wires.push({ from: a, to: b, color: color, section: '', label: nextLabel() });
      st.sel = { wire: s.wires.length - 1 };
    });
  }

  function nextLabel() {
    var max = 0;
    sch().wires.forEach(function (w) { var n = parseInt(w.label, 10); if (n > max) max = n; });
    return String(max + 1);
  }

  function netName(key) {
    var net = (st.check.nets || []).filter(function (n) { return n.terminals.indexOf(key) >= 0; })[0];
    var own = key.split('.'), c = comp(own[0]), t = c && c.terminals.filter(function (x) { return x.id === own.slice(1).join('.'); })[0];
    return ((net && net.name) || '') + '/' + N.normPotential(t && t.potential);
  }

  function pickColor(a, b) {
    var v = $('#dWireColor').value;
    if (v !== 'auto') return v;
    var n = netName(a) + '/' + netName(b);
    if (/(^|\/)PE(\/|$)/.test(n)) return 'ירוק-צהוב';
    if (/(^|\/)N(\/|$)/.test(n)) return 'כחול';
    if (/(^|\/)L[123]?(\/|$)/.test(n)) return 'חום';
    if (/0V/.test(n)) return 'שחור';
    if (/\+/.test(n)) return 'אדום';
    return 'צהוב';
  }

  function removeSelected() {
    if (st.sel.wire != null) {
      var i = st.sel.wire;
      st.sel = {};
      change(function (s) { s.wires.splice(i, 1); });
    } else if (st.sel.comp) {
      var id = st.sel.comp;
      st.sel = {};
      change(function (s) {
        s.components = s.components.filter(function (c) { return c.id !== id; });
        s.wires = s.wires.filter(function (w) { return w.from.split('.')[0] !== id && w.to.split('.')[0] !== id; });
      });
    }
  }

  /* ---------- לוח רכיבים ---------- */

  function buildPalette() {
    var groups = {};
    Object.keys(P.PARTS).forEach(function (k) { (groups[P.PARTS[k].group] = groups[P.PARTS[k].group] || []).push(k); });
    $('#palette').innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="pal-group"><span class="pal-title">' + g + '</span><div class="pal-items">' + groups[g].map(function (k) {
        return '<button type="button" class="chip" data-part="' + k + '" title="' + esc(P.PARTS[k].value) + '">' + esc(P.PARTS[k].name) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
    $$('#palette [data-part]').forEach(function (b) {
      b.addEventListener('click', function () { addPart(b.dataset.part); });
    });
  }

  function addPart(key) {
    var s = sch(), col = 0, row = 0;
    var from = st.sel.comp && comp(st.sel.comp);
    if (from) { col = from.col + 1; row = from.row; }
    else if (s.components.length) {
      col = Math.max.apply(null, s.components.map(function (c) { return c.col; }));
      row = Math.max.apply(null, s.components.filter(function (c) { return c.col === col; }).map(function (c) { return c.row; })) + 1;
    }
    var c = P.newComponent(s, key, col, row);
    st.pin = null;
    change(function (x) { x.components.push(c); st.sel = { comp: c.id }; });
    A.toast('נוסף ' + c.id + ' — ' + P.PARTS[key].name);
  }

  /* ---------- עריכת רכיב / חוט ---------- */

  function inspector() {
    var host = $('#dInspector');
    if (st.sel.comp && comp(st.sel.comp)) return compInspector(host, comp(st.sel.comp));
    if (st.sel.wire != null && sch().wires[st.sel.wire]) return wireInspector(host, st.sel.wire);
    host.innerHTML = '<h3>עריכה</h3><p class="muted small">לחצו על רכיב או על חוט כדי לערוך אותו. לחיבור: לחצו על פין, ואז על פין אחר.</p>';
  }

  function typeOptions(cur) {
    return FP.COMPONENT_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === cur ? ' selected' : '') + '>' + (TYPE_HE[t] || t) + '</option>'; }).join('');
  }

  function compInspector(host, c) {
    host.innerHTML = '<h3>רכיב ' + esc(c.id) + '</h3>' +
      '<div class="ins-grid">' +
      '<label>מזהה<input data-f="id" value="' + esc(c.id) + '" dir="ltr"></label>' +
      '<label>סוג<select data-f="type">' + typeOptions(c.type) + '</select></label>' +
      '<label class="span-2">תיאור<input data-f="label" value="' + esc(c.label) + '"></label>' +
      '<label class="span-2">ערך / דגם<input data-f="value" value="' + esc(c.value) + '" dir="auto"></label>' +
      '</div>' +
      '<table class="pins"><thead><tr><th>פין</th><th>שם</th><th>צד</th><th>מתח קבוע</th><th></th></tr></thead><tbody>' +
      c.terminals.map(function (t, i) {
        return '<tr data-t="' + i + '"><td><input data-tf="id" value="' + esc(t.id) + '" dir="ltr" aria-label="מזהה פין"></td>' +
          '<td><input data-tf="name" value="' + esc(t.name) + '" aria-label="שם פין"></td>' +
          '<td><select data-tf="side" aria-label="צד"><option value="left"' + (t.side !== 'right' ? ' selected' : '') + '>שמאל</option><option value="right"' + (t.side === 'right' ? ' selected' : '') + '>ימין</option></select></td>' +
          '<td><input data-tf="potential" value="' + esc(t.potential) + '" list="railList" dir="ltr" aria-label="מתח קבוע"></td>' +
          '<td><button type="button" class="x-btn" data-del="' + i + '" aria-label="מחיקת פין ' + esc(t.id) + '">×</button></td></tr>';
      }).join('') + '</tbody></table>' +
      '<datalist id="railList">' + P.RAILS.map(function (r) { return '<option value="' + r + '">'; }).join('') + '</datalist>' +
      '<p class="muted small">"מתח קבוע" רק לפיני הזנה (‎+5V, ‎+3.3V, 0V…). כך הבודק מזהה קצרים ומתח שגוי.</p>' +
      '<div class="ins-actions"><button class="btn ghost small" type="button" data-act="pin">+ פין</button>' +
      '<button class="btn ghost small" type="button" data-act="dup">שכפול</button>' +
      '<button class="btn ghost small danger-text" type="button" data-act="del">מחיקה</button></div>';

    $$('[data-f]', host).forEach(function (el) {
      el.addEventListener('change', function () {
        var f = el.dataset.f, v = el.value.trim();
        if (f === 'id') {
          if (!v || v === c.id) { el.value = c.id; return; }
          if (comp(v)) { A.toast('המזהה ' + v + ' כבר קיים', true); el.value = c.id; return; }
          var old = c.id;
          change(function (s) {
            comp(old).id = v;
            s.wires.forEach(function (w) {
              if (w.from.split('.')[0] === old) w.from = v + w.from.slice(old.length);
              if (w.to.split('.')[0] === old) w.to = v + w.to.slice(old.length);
            });
            st.sel = { comp: v };
          });
        } else change(function () { comp(c.id)[f] = v; });
      });
    });
    $$('[data-tf]', host).forEach(function (el) {
      el.addEventListener('change', function () {
        var i = +el.closest('tr').dataset.t, f = el.dataset.tf, v = el.value.trim();
        var t = c.terminals[i];
        if (f === 'id') {
          if (!v || v === t.id) { el.value = t.id; return; }
          if (c.terminals.some(function (x) { return x.id === v; })) { A.toast('הפין ' + v + ' כבר קיים ברכיב', true); el.value = t.id; return; }
          var oldKey = c.id + '.' + t.id, newKey = c.id + '.' + v;
          change(function (s) {
            comp(c.id).terminals[i].id = v;
            s.wires.forEach(function (w) { if (w.from === oldKey) w.from = newKey; if (w.to === oldKey) w.to = newKey; });
          });
        } else change(function () { comp(c.id).terminals[i][f] = v; });
      });
    });
    $$('[data-del]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.del, key = c.id + '.' + c.terminals[i].id;
        change(function (s) {
          comp(c.id).terminals.splice(i, 1);
          s.wires = s.wires.filter(function (w) { return w.from !== key && w.to !== key; });
        });
      });
    });
    $('[data-act="pin"]', host).addEventListener('click', function () {
      change(function () {
        var x = comp(c.id), n = x.terminals.length + 1;
        while (x.terminals.some(function (t) { return t.id === String(n); })) n++;
        x.terminals.push({ id: String(n), name: '', side: 'right', potential: '' });
      });
    });
    $('[data-act="dup"]', host).addEventListener('click', function () {
      var copy = JSON.parse(JSON.stringify(c));
      copy.id = P.nextId(sch(), c.id.replace(/\d+$/, '') || 'X');
      copy.row = c.row + 1;
      change(function (s) { s.components.push(copy); st.sel = { comp: copy.id }; });
    });
    $('[data-act="del"]', host).addEventListener('click', removeSelected);
  }

  function wireInspector(host, i) {
    var w = sch().wires[i];
    host.innerHTML = '<h3>חוט ' + esc(w.label || i + 1) + '</h3>' +
      '<p class="mono wire-ends" dir="ltr">' + esc(w.from) + ' → ' + esc(w.to) + '</p>' +
      '<div class="ins-grid">' +
      '<label>צבע<select data-w="color">' + P.WIRE_COLORS.concat(P.WIRE_COLORS.indexOf(w.color) < 0 && w.color ? [w.color] : []).map(function (c) { return '<option' + (c === w.color ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label>מספר<input data-w="label" value="' + esc(w.label) + '" dir="ltr"></label>' +
      '<label class="span-2">חתך / רוחב מסלול<input data-w="section" value="' + esc(w.section) + '" dir="ltr" placeholder="למשל 0.5mm או 1 ממ״ר"></label>' +
      '</div>' +
      '<div class="ins-actions"><button class="btn ghost small danger-text" type="button" data-act="del">מחיקת החוט</button></div>';
    $$('[data-w]', host).forEach(function (el) {
      el.addEventListener('change', function () { var f = el.dataset.w, v = el.value.trim(); change(function (s) { s.wires[i][f] = v; }); });
    });
    $('[data-act="del"]', host).addEventListener('click', removeSelected);
  }

  /* ---------- בדיקה ורשימת חלקים ---------- */

  function checks() {
    var c = st.check, host = $('#dChecks'), badge = $('#dCheckBadge');
    if (!sch().components.length) { host.innerHTML = '<p class="muted small">אין עדיין מה לבדוק.</p>'; badge.innerHTML = ''; return; }
    badge.innerHTML = c.stats.errors ? '<span class="chk bad">' + c.stats.errors + ' שגיאות</span>' : c.stats.warnings ? '<span class="chk warn">' + c.stats.warnings + ' הערות</span>' : '<span class="chk good">תקין</span>';
    host.innerHTML = (c.issues.length
      ? '<ul class="issues">' + c.issues.map(function (i, n) { return '<li class="' + i.level + '"><button type="button" data-issue="' + n + '">' + esc(i.message) + '</button></li>'; }).join('') + '</ul>'
      : '<p class="small good-text">לא נמצאו קצרים, קוטביות הפוכה, רכיבים בלי נגד או קבל, או פינים לא מחוברים.</p>') +
      '<p class="muted small">' + c.stats.components + ' רכיבים · ' + c.stats.wires + ' חוטים · ' + c.stats.nets + ' צמתים</p>';
    $$('[data-issue]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var ref = (c.issues[+b.dataset.issue].refs || [])[0];
        if (!ref) return;
        var id = ref.split('.')[0];
        if (comp(id)) { st.sel = { comp: id }; st.pin = null; refresh(); }
      });
    });
  }

  function bomRows() {
    var groups = {};
    sch().components.forEach(function (c) {
      if (c.type === 'source' && !c.value) return;
      var k = c.type + '|' + (c.value || '') + '|' + (c.type === 'connector' || c.type === 'mcu' || c.type === 'ic' ? c.label : '');
      (groups[k] = groups[k] || { type: c.type, value: c.value, label: c.label, ids: [] }).ids.push(c.id);
    });
    return Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.ids[0].localeCompare(b.ids[0], 'en', { numeric: true }); });
  }

  function bom() {
    var rows = bomRows();
    $('#dBom').innerHTML = rows.length ? '<div class="table-wrap"><table class="table bom"><thead><tr><th>כמות</th><th>רכיב</th><th>ערך</th><th>מזהים</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="mono">' + r.ids.length + '</td><td>' + esc(TYPE_HE[r.type] || r.type) + '</td><td class="mono" dir="auto">' + esc(r.value) + '</td><td class="mono" dir="ltr">' + esc(r.ids.join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted small">אין רכיבים.</p>';
  }

  /* ---------- תבניות ---------- */

  function buildTemplates() {
    $('#tplGrid').innerHTML = P.TEMPLATES.map(function (t, i) {
      var s = t.build(), c = N.check(s);
      return '<article class="tpl card"><div class="tpl-prev">' + N.render(s) + '</div>' +
        '<h3>' + esc(t.name) + '</h3><p>' + esc(t.desc) + '</p>' +
        '<footer><span class="muted small">' + s.components.length + ' רכיבים</span>' +
        (t.id !== 'blank' ? '<span class="chk ' + (c.stats.errors ? 'bad' : 'good') + '">' + (c.stats.errors ? 'שגיאות' : 'נבדק') + '</span>' : '') +
        '<button class="btn primary small" type="button" data-tpl="' + i + '">שימוש בתבנית</button></footer></article>';
    }).join('');
    $$('#tplGrid [data-tpl]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = P.TEMPLATES[+b.dataset.tpl];
        $('#tplDlg').close();
        create(t.build(), t.name).then(function () { A.toast('נפתח עיצוב חדש: ' + t.name); });
      });
    });
  }

  /* ---------- ייצוא וייבוא ---------- */

  function exportAs(kind) {
    var name = (st.d.name || 'circuit').replace(/[\\/:*?"<>|]+/g, '-');
    $('.design-bar details.menu').open = false;
    if (kind === 'svg' || kind === 'png') {
      if (!sch().components.length) return A.toast('אין מה לייצא', true);
      var svg = new DOMParser().parseFromString(N.render(sch()), 'image/svg+xml').documentElement;
      return A.download(svg, kind, name);
    }
    if (kind === 'bom') {
      var csv = '﻿כמות,רכיב,ערך,מזהים\n' + bomRows().map(function (r) {
        return [r.ids.length, TYPE_HE[r.type] || r.type, r.value, r.ids.join(' ')].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      return A.save(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name + '-bom.csv');
    }
    if (kind === 'json') {
      return A.save(new Blob([JSON.stringify({ format: 'electro-fix-circuit', version: 1, name: st.d.name, schematic: sch() }, null, 1)], { type: 'application/json' }), name + '.json');
    }
    if (kind === 'delete') {
      if (!confirm('למחוק את העיצוב "' + (st.d.name || '') + '" לצמיתות?')) return;
      Store.remove(st.d.id).then(function () { st.d = null; return Store.all(); }).then(function (list) {
        if (list.length) open(list[0]); else create(P.TEMPLATES[0].build(), 'כרטיס חדש');
        A.toast('העיצוב נמחק');
      });
    }
  }

  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result);
        var s = j.schematic || j;
        if (!Array.isArray(s.components)) throw new Error();
        create(s, j.name || j.title || s.title || file.name.replace(/\.json$/i, '')).then(function () { A.toast('המעגל יובא'); });
      } catch (e) { A.toast('הקובץ אינו מעגל תקין', true); }
    };
    r.readAsText(file);
  }

  /* ---------- Claude ---------- */

  function openAi(mode) {
    if (mode === 'review' && !sch().components.length) return A.toast('אין מעגל לבדוק. הוסיפו רכיבים או בחרו תבנית.', true);
    st.aiMode = mode;
    var manual = !A.state.ai;
    $('#aiTitle').textContent = mode === 'create' ? 'Claude יתכנן לי' : 'בדיקה של Claude';
    $('#aiIntro').textContent = mode === 'create'
      ? 'תארו מה הכרטיס צריך לעשות: מתח הזנה, בקר, כניסות ויציאות, עומסים ומגבלות. Claude יבנה מעגל שלם עם ערכים מחושבים, יבדוק אותו ויציע הנחיות לעימוד הכרטיס. המעגל החדש יחליף את מה שבעורך (אפשר לבטל).'
      : 'Claude יעבור על המעגל שבעורך: ערכים, זרמים והספקים, קוטביות, רמות לוגיות ופינים צפים, יחד עם הממצאים של הבודק האוטומטי. תראו את השינויים המוצעים לפני שמחילים אותם.';
    $('#aiRequest').placeholder = mode === 'create' ? 'למשל: כרטיס ESP32 שמפעיל 4 ממסרים 5V, הזנה מ-12V, עם נוריות חיווי' : 'שאלות או דגשים (לא חובה). למשל: האם הטרנזיסטור יחזיק ממסר 12V?';
    $('#aiRequest').value = '';
    $('#aiExamples').innerHTML = mode === 'create' ? AI_EXAMPLES.map(function (e) { return '<button type="button" class="chip">' + esc(e) + '</button>'; }).join('') : '';
    $$('#aiExamples .chip').forEach(function (b) { b.addEventListener('click', function () { $('#aiRequest').value = b.textContent; }); });
    $('#aiManual').hidden = !manual;
    $('#aiPaste').value = '';
    $('#aiError').textContent = '';
    $('#aiSend').textContent = manual ? 'טעינת התשובה' : (mode === 'create' ? 'תכנון המעגל' : 'בדיקת המעגל');
    $('#aiDlg').showModal();
  }

  function sendAi() {
    var mode = st.aiMode, request = $('#aiRequest').value.trim();
    if (!A.state.ai) {
      var res;
      try { res = FP.parseDesign($('#aiPaste').value); } catch (e) { $('#aiError').textContent = 'לא הצלחנו לקרוא את התשובה: ' + e.message; return; }
      $('#aiDlg').close();
      return aiDone(mode, { result: res, checks: N.check(res.schematic), model: 'claude.ai (העתק-הדבק)', revisions: 0 });
    }
    if (mode === 'create' && !request) { $('#aiError').textContent = 'תארו מה המעגל צריך לעשות.'; return; }
    $('#aiDlg').close();
    runAi(mode, request);
  }

  function runAi(mode, request) {
    var panel = $('#dAiPanel'), ctl = new AbortController(), started = Date.now();
    st.busy = ctl;
    panel.innerHTML = '<div class="card progress"><div class="pulse" aria-hidden="true"><span></span></div><div class="progress-body">' +
      '<b id="dpTitle">' + (mode === 'create' ? 'Claude מתכנן את המעגל…' : 'Claude בודק את המעגל…') + '</b><p id="dpText">מתחיל</p>' +
      '<details class="thinking" id="dpThinkBox" hidden><summary>מהלך החשיבה</summary><p id="dpThink"></p></details></div>' +
      '<button class="btn ghost small" type="button" id="dpStop">עצירה</button></div>';
    $('#dpStop').addEventListener('click', function () { ctl.abort(); });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var tick = setInterval(function () { var t = $('#dpTitle'); if (t) t.textContent = (mode === 'create' ? 'Claude מתכנן את המעגל… ' : 'Claude בודק את המעגל… ') + Math.round((Date.now() - started) / 1000) + ' שנ׳'; }, 1000);
    var headers = { 'content-type': 'application/json' };
    if (A.state.code) headers['x-access-code'] = A.state.code;
    var final = null, failed = null;

    fetch('api/design', { method: 'POST', headers: headers, signal: ctl.signal, body: JSON.stringify({ mode: mode, request: request, schematic: mode === 'review' || sch().components.length > 1 ? sch() : null }) })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { if (j.needCode) A.askCode(); throw new Error(j.error || 'שגיאת שרת ' + r.status); });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (ln) { if (ln.trim()) handle(JSON.parse(ln)); });
            return pump();
          });
        }
        return pump();
      })
      .then(function () { if (!final && !failed) throw new Error('החיבור נסגר לפני שהתקבלה תשובה'); })
      .catch(function (e) { failed = failed || (ctl.signal.aborted ? 'הבקשה נעצרה' : e.message); })
      .then(function () {
        clearInterval(tick);
        st.busy = null;
        if (failed) { panel.innerHTML = '<div class="card retry"><p><b>הבקשה לא הושלמה.</b> ' + esc(failed) + '</p></div>'; A.toast(failed, true); return; }
        aiDone(mode, final);
      });

    function handle(m) {
      if (m.error) { failed = m.error; return; }
      if (m.thinking) { $('#dpThinkBox').hidden = false; var t = $('#dpThink'); t.textContent = (t.textContent + m.thinking).slice(-4000); }
      if (m.chars) $('#dpText').textContent = 'כותב… ' + m.chars.toLocaleString('he-IL') + ' תווים';
      if (m.phase === 'revise') $('#dpText').textContent = 'הבודק האוטומטי מצא ' + m.issues.filter(function (i) { return i.level === 'error'; }).length + ' שגיאות — Claude מתקן';
      if (m.phase === 'done') final = m;
    }
  }

  function applyResult(res) {
    var s = clean(JSON.parse(JSON.stringify(res.schematic)));
    snapshot();
    st.d.schematic = s;
    if (res.title && (!st.d.name || st.aiMode === 'create')) { st.d.name = res.title; $('#dName').value = res.title; }
    s.title = st.d.name;
    $('#dNotes').value = s.notes.join('\n');
    st.sel = {}; st.pin = null; st.zoom = null;
    refresh();
    scheduleSave();
  }

  function aiDone(mode, out) {
    var r = out.result;
    st.ai = { mode: mode, out: out };
    if (mode === 'create') applyResult(r);
    var icon = { ok: '✓', warning: '!', fail: '✕' };
    var html = '<div class="card ai-result"><header class="rhead"><div><span class="who">' + (mode === 'create' ? 'תכנון של Claude' : 'בדיקה של Claude') + (out.revisions ? ' · תוקן אחרי בדיקה אוטומטית' : '') + '</span>' +
      '<h3 class="rtitle">' + esc(r.title) + '</h3></div><button class="btn ghost small" type="button" data-ai="close">סגירה</button></header>' +
      '<p class="summary">' + esc(r.summary) + '</p>';
    if (mode === 'review') {
      html += r.changes.length
        ? '<section class="rsec"><h3>שינויים מוצעים</h3><ul class="bullets">' + r.changes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
          '<div class="tpl-prev review-prev">' + N.render(r.schematic, { issues: out.checks.issues }) + '</div>' +
          '<div class="ins-actions"><button class="btn primary small" type="button" data-ai="apply">החלת התיקונים בעורך</button><span class="muted small">אפשר לבטל אחר כך עם "ביטול פעולה".</span></div></section>'
        : '<p class="good-text"><b>Claude לא מצא מה לתקן.</b></p>';
    }
    if (r.verification.length) html += '<section class="rsec"><h3>בדיקת המעגל</h3><ul class="verify">' + r.verification.map(function (v) {
      return '<li class="' + esc(v.result) + '"><span class="vi">' + (icon[v.result] || '?') + '</span><div><b>' + esc(v.check) + '</b>' + (v.note ? '<p>' + esc(v.note) + '</p>' : '') + '</div></li>';
    }).join('') + '</ul></section>';
    if (r.pcb_notes.length) html += '<section class="rsec"><h3>הנחיות לעימוד הכרטיס (PCB)</h3><ul class="bullets">' + r.pcb_notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section>';
    if (r.parts.length) html += '<section class="rsec"><h3>חלקים מומלצים</h3><div class="table-wrap"><table class="table"><thead><tr><th>פריט</th><th>מפרט</th><th>כמות</th></tr></thead><tbody>' +
      r.parts.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="mono" dir="auto">' + esc(p.spec) + '</td><td>' + esc(p.qty) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    html += '<p class="rmeta">' + esc(out.model || '') + '</p></div>';
    var panel = $('#dAiPanel');
    panel.innerHTML = html;
    var close = $('[data-ai="close"]', panel);
    close.addEventListener('click', function () { panel.innerHTML = ''; });
    var apply = $('[data-ai="apply"]', panel);
    if (apply) apply.addEventListener('click', function () { applyResult(r); apply.disabled = true; apply.textContent = 'הוחל'; A.toast('התיקונים הוחלו בעורך'); });
    if (mode === 'create') A.toast('המעגל נבנה בעורך');
  }

  /* ---------- הרכבה ---------- */

  function mount() {
    if (st.mounted) return;
    st.mounted = true;
    buildPalette();
    buildTemplates();
    $('#dWireColor').innerHTML = '<option value="auto">אוטומטי</option>' + P.WIRE_COLORS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    bindCanvas();
    $('#dUndo').addEventListener('click', undo);
    $('#dTemplates').addEventListener('click', function () { $('#tplDlg').showModal(); });
    $('#dOpen').addEventListener('change', function () {
      var id = this.value;
      if (!id) return;
      Store.get(id).then(function (d) { if (d) open(d); });
    });
    $('#dName').addEventListener('input', function () { st.d.name = this.value; sch().title = this.value; scheduleSave(); });
    $('#dName').addEventListener('change', refresh);
    $('#dNotes').addEventListener('change', function () {
      var v = this.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      change(function (s) { s.notes = v; });
    });
    $$('[data-exp]').forEach(function (b) { b.addEventListener('click', function () { exportAs(b.dataset.exp); }); });
    $('#dImport').addEventListener('change', function () { if (this.files[0]) importFile(this.files[0]); this.value = ''; $('.design-bar details.menu').open = false; });
    $$('[data-dz]').forEach(function (b) {
      b.addEventListener('click', function () {
        var z = +b.dataset.dz;
        st.zoom = z ? Math.max(0.3, Math.min(2.5, currentZoom() * (z > 0 ? 1.25 : 0.8))) : null;
        applyZoom();
      });
    });
    $('#dAiCreate').addEventListener('click', function () { openAi('create'); });
    $('#dAiReview').addEventListener('click', function () { openAi('review'); });
    $('#aiSend').addEventListener('click', sendAi);
    $('#aiCopy').addEventListener('click', function () {
      A.copy(FP.manualDesignPrompt(st.aiMode, $('#aiRequest').value.trim(), sch(), st.check.issues), 'ההנחיה הועתקה. הדביקו אותה ב-claude.ai.');
    });
    window.addEventListener('resize', function () { if (st.zoom == null && !$('#view-design').hidden) applyZoom(); });
  }

  window.FixDesign = {
    show: function () {
      mount();
      if (st.d) { refresh(); return; }
      Store.all().then(function (list) {
        if (st.d) return;
        if (list.length) open(list[0]);
        else create(P.TEMPLATES[0].build(), 'כרטיס חדש').then(function () { $('#tplDlg').showModal(); });
      });
    },
    load: function (schematic, name) {
      mount();
      create(schematic, name);
    }
  };

  if (location.hash === '#design') window.FixDesign.show();
})();
