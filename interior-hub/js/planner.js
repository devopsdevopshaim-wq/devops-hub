/* Layout engine.
   Turns the household's requirements into a floor plan (rooms, walls, openings)
   and places every piece of furniture by the clearances interior designers work to.
   Units are meters. Plan axes: x to the left-to-right of the drawing, y downward.
   An item's `face` is the direction its front looks: N (-y), S (+y), E (+x), W (-x). */
(function () {
  'use strict';

  const WALL_H = 2.7;
  const CORR = 1.2;

  const STYLES = {
    scandi: { name: 'סקנדינבי', wall: '#f1f1ee', floor: '#d9c4a3', floorKind: 'wood', tile: '#e4e2dc',
      wood: '#c9a77c', fabric: '#c9c7c1', fabric2: '#8fa39a', accent: '#56705f', metal: '#2b2b2b', rug: '#dcd6ca',
      blurb: 'עץ אלון בהיר, קירות לבנים, טקסטיל אפור-בז׳ ונגיעות ירוק מרווה.' },
    modern: { name: 'מודרני', wall: '#ecebe8', floor: '#c9c6c0', floorKind: 'tile', tile: '#d8d6d1',
      wood: '#6d4c35', fabric: '#8d8e8c', fabric2: '#34393b', accent: '#2f3a3d', metal: '#1c1c1c', rug: '#b9b6ae',
      blurb: 'קווים נקיים, אריחים גדולים באפור בהיר, עץ אגוז כהה ושחור מט.' },
    japandi: { name: 'ג׳פנדי', wall: '#eeebe4', floor: '#cfb58e', floorKind: 'wood', tile: '#e1dcd2',
      wood: '#b89468', fabric: '#d8cfbf', fabric2: '#7c6f5e', accent: '#3a3632', metal: '#2a2724', rug: '#e0d7c6',
      blurb: 'שילוב יפני-סקנדינבי: פשתן טבעי, עץ אפר, רהיטים נמוכים ומעט חפצים.' },
    industrial: { name: 'תעשייתי', wall: '#d9d7d3', floor: '#8f8a83', floorKind: 'concrete', tile: '#a5a19b',
      wood: '#5a3e2b', fabric: '#8a5a3c', fabric2: '#3e4447', accent: '#b0602e', metal: '#1f1f1f', rug: '#6f6a64',
      blurb: 'בטון מוחלק, עור קוניאק, עץ ממוחזר ומתכת שחורה.' },
    classic: { name: 'קלאסי מודרני', wall: '#efe9df', floor: '#a8835d', floorKind: 'wood', tile: '#e7e0d3',
      wood: '#7a5536', fabric: '#d9cfbd', fabric2: '#2e3f5c', accent: '#b08d4f', metal: '#b08d4f', rug: '#c8bba3',
      blurb: 'פרקט אגוז, בדים בגווני שמנת וכחול עמוק, פליז מוברש.' },
    boho: { name: 'בוהו', wall: '#f2ede4', floor: '#c4a17a', floorKind: 'wood', tile: '#e6d9c6',
      wood: '#a67b4f', fabric: '#d9c3a3', fabric2: '#b5643f', accent: '#6e7d4a', metal: '#6b4a2e', rug: '#c98f65',
      blurb: 'ראטן וקש, טרקוטה וחרדל, הרבה צמחים ושטיחים בשכבות.' }
  };

  const R = (v) => Math.round(v * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function normalize(q) {
    const n = (v, d) => (Number.isFinite(+v) && v !== '' ? +v : d);
    return {
      area: clamp(n(q.area, 100), 35, 260),
      rooms: clamp(Math.round(n(q.rooms, 4)), 2, 7),
      adults: clamp(Math.round(n(q.adults, 2)), 1, 6),
      kids: clamp(Math.round(n(q.kids, 2)), 0, 8),
      style: STYLES[q.style] ? q.style : 'scandi',
      budget: ['eco', 'mid', 'prem'].includes(q.budget) ? q.budget : 'mid',
      region: q.region || 'center',
      office: !!q.office,
      mamad: q.mamad !== false,
      balcony: q.balcony !== false,
      kitchen: ['auto', 'linear', 'L', 'parallel', 'island'].includes(q.kitchen) ? q.kitchen : 'auto',
      seats: q.seats === 'auto' || !q.seats ? 'auto' : clamp(+q.seats, 2, 12)
    };
  }

  /* ---------- program: which rooms the household needs ---------- */
  function program(q) {
    const bedrooms = Math.max(1, q.rooms - 1);
    const notes = [];
    const units = [];
    const master = { kind: 'master', w: q.area / q.rooms > 30 ? 3.7 : 3.5, sleepers: Math.min(2, q.adults) };
    if (bedrooms === 1 && q.mamad) master.mamad = true;
    const ensuite = q.rooms >= 4 && q.area >= 90 ? { kind: 'ensuite', w: 1.9 } : null;
    const tight = q.area / q.rooms < 22;

    const queue = [];
    for (let i = 0; i < Math.max(0, q.adults - 2); i++) queue.push('adult');
    for (let i = 0; i < q.kids; i++) queue.push('kid');
    if (bedrooms === 1 && queue.length) notes.push('יש יותר נפשות מחדרים: בדירת 2 חדרים כדאי ספה נפתחת בסלון לאורח או לילד.');

    const others = [];
    let officeDone = false;
    const nOthers = bedrooms - 1;
    for (let i = 0; i < nOthers; i++) {
      const left = nOthers - i;
      const take = Math.min(2, Math.ceil(queue.length / left));
      const people = queue.splice(0, take);
      if (people.length) {
        const kid = people.includes('kid');
        others.push({ kind: kid ? 'kid' : 'adult', sleepers: people.length, w: tight ? (people.length === 2 ? 3.0 : 2.8) : people.length === 2 ? 3.3 : kid ? 3.0 : 3.2 });
      } else if (q.office && !officeDone) {
        officeDone = true;
        others.push({ kind: 'office', w: tight ? 2.7 : 2.9 });
      } else {
        others.push({ kind: 'guest', w: tight ? 2.7 : 2.9 });
      }
    }
    if (queue.length) notes.push('מספר הנפשות גדול מקיבולת החדרים (עד 2 בחדר). שקלו חדר נוסף או מיטה נפתחת בחדר העבודה.');
    if (q.mamad && others.length) {
      // The safe room is usually the smallest bedroom; take the last one assigned.
      others[others.length - 1].mamad = true;
    }
    const bath = { kind: 'bath', w: 2.3 };
    const wc = (q.rooms >= 5 && !tight) || q.area >= 125 ? { kind: 'wc', w: 1.4 } : null;
    return { master, ensuite, others, bath, wc, officeCorner: q.office && !officeDone, notes };
  }

  /* ---------- footprint search ----------
     Rooms line the corridor on its far side (the "bottom" strip). Rooms that do not
     fit there go into a block on the near side of the corridor, next to the living
     area (a double-loaded corridor, the most common Israeli apartment layout). */
  function publicMode(Wp, Dp, corr) {
    const Kw = clamp(Wp * 0.3, 2.4, 4.0);
    const Rw = Wp - Kw;
    if (Rw >= 5.4 && Dp >= 4.0 && corr) return { mode: 'row', cost: 0 };
    if (Rw >= 3.4 && Dp >= 5.6 && corr) return { mode: 'stacked', cost: 0.6 };
    if (Wp - 2.9 >= 2.6 && Dp >= (corr ? 3.7 : 3.5)) return { mode: 'compact', cost: 1.6 };
    return null;
  }

  function footprint(q, prog) {
    const Dr0 = q.area < 75 || q.area / q.rooms < 22 ? 3.3 : q.area < 115 ? 3.6 : 3.9;
    const masterUnit = { kind: 'masterUnit', w: prog.master.w + (prog.ensuite ? prog.ensuite.w : 0) };
    const units = [masterUnit, prog.bath];
    if (prog.wc) units.push(prog.wc);
    prog.others.forEach((o) => units.push(o));

    let best = null;
    // small apartments may drop the corridor: bedroom doors then open onto the living space
    const corrs = q.area < 75 ? [CORR, 0] : [CORR];
    const Drs = q.area < 60 ? [Dr0, 3.0, 3.6] : [Dr0, 3.3, 3.6, 3.9, 3.1];
    corrs.forEach((corr) => Drs.forEach((Dr, di) => {
      if (di > 0 && Dr === Dr0) return;
      for (let W = 5.5; W <= 26; W += 0.1) {
        const D = q.area / W;
        const Dp = D - Dr - corr;
        if (Dp < 3.4) continue;
        let used = 0;
        const bottom = [], top = [];
        units.forEach((u) => {
          const w = u.mamad ? Math.max(u.w, 9.2 / Dr) : u.w;
          if (used + w <= W + 1e-6) { bottom.push(u); used += w; } else top.push(u);
        });
        if (!bottom.includes(prog.bath)) continue;
        const topW = top.map((u) => Math.max(2.7, (u.w * Dr) / Dp, u.mamad ? 9.2 / Dp : 0));
        const colW = topW.reduce((a, b) => a + b, 0);
        const Wp = W - colW;
        if (Wp < 5.4) continue;
        const pm = publicMode(Wp, Dp, corr);
        if (!pm) continue;
        const leftover = W - used;
        const publicArea = Wp * Dp;
        let score = Math.abs(W / D - 1.45) * 0.8 + (leftover / W) * 5 + top.length * 0.25 + pm.cost + (di > 0 ? 0.4 : 0) + (corr ? 0 : 1.2);
        if (Dp < 4.4) score += (4.4 - Dp) * 1.2;
        if (publicArea < q.area * 0.3) score += (q.area * 0.3 - publicArea) / 8;
        if (Wp < 7.5) score += (7.5 - Wp) * 0.3;
        if (!best || score < best.score) best = { W, D, Dp, Dr, corr, bottom, top, topW, colW, Wp, used, score, mode: pm.mode };
      }
    }));
    return best;
  }

  /* ---------- geometry helpers ----------
     Every room is furnished in a canonical frame: the door wall on top (v = 0),
     the far/window wall at v = cd, u running along the door wall. `frame` maps it
     back to the plan: bottom = as is, top = turned 180°, side = turned 90°
     (the far wall on the right). `mirror` flips u first. */
  const ROT180 = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const ROT90 = { N: 'W', W: 'S', S: 'E', E: 'N' };

  function roomFrame(room) {
    return room.frame === 'side' ? { cw: room.d, cd: room.w } : { cw: room.w, cd: room.d };
  }

  function toWorld(room, u, v, w, d, face) {
    const { cw, cd } = roomFrame(room);
    if (room.mirror) {
      u = cw - u - w;
      face = face === 'E' ? 'W' : face === 'W' ? 'E' : face;
    }
    if (room.frame === 'side') {
      return { x: room.x + v, y: room.y + room.d - (u + w), w: d, d: w, face: face && ROT90[face] };
    }
    if (room.frame === 'top') {
      return { x: room.x + cw - (u + w), y: room.y + cd - (v + d), w, d, face: face && ROT180[face] };
    }
    return { x: room.x + u, y: room.y + v, w, d, face };
  }

  function overlap(a, b, pad = 0) {
    return a.x < b.x + b.w + pad - 1e-6 && b.x < a.x + a.w + pad - 1e-6 &&
      a.y < b.y + b.d + pad - 1e-6 && b.y < a.y + a.d + pad - 1e-6;
  }

  /* ---------- main ---------- */
  function planHome(input) {
    const q = normalize(input || {});
    const prog = program(q);
    const fp = footprint(q, prog);
    if (!fp) {
      return { error: 'השטח קטן מדי למספר החדרים שנבחר. הגדילו את השטח או הורידו חדר.' , q };
    }
    const { W, D, Dp, Dr, Wp } = fp;
    const corr = fp.corr;
    const style = STYLES[q.style];
    const rooms = [];
    const items = [];
    const checks = [];
    const notes = prog.notes.slice();
    let seq = 0;

    function addRoom(r) { r.id = 'r' + rooms.length; rooms.push(r); return r; }
    function add(type, room, rect, extra) {
      const it = Object.assign({ id: 'i' + (seq++), type, room: room.id, x: R(rect.x), y: R(rect.y), w: R(rect.w), d: R(rect.d), face: rect.face || 'S', z: 0, h: 0.75 }, extra || {});
      items.push(it);
      return it;
    }
    function addC(type, room, u, v, w, d, face, extra) {
      return add(type, room, toWorld(room, u, v, w, d, face), extra);
    }
    function check(room, ok, text) { checks.push({ room: room ? room.id : null, ok, text }); }

    /* ----- rooms: private strip ----- */
    const expand = [];
    fp.bottom.forEach((u) => {
      if (u.kind === 'masterUnit') {
        if (prog.ensuite) expand.push(prog.ensuite);
        expand.push(prog.master);
      } else expand.push(u);
    });
    const order = { office: 0, guest: 1, adult: 2, kid: 3, bath: 4, utility: 4.5, wc: 5, ensuite: 6, master: 7 };
    // keep the safe room next to the kids; bathrooms in the middle, parents at the far end
    expand.sort((a, b) => (order[a.kind] - order[b.kind]) || ((a.mamad ? 1 : 0) - (b.mamad ? 1 : 0)));

    expand.forEach((u) => { if (u.mamad) u.w = Math.max(u.w, 9.2 / Dr); });
    let extra = W - fp.used;
    let utility = null;
    if (extra >= 1.4) {
      // a wide leftover becomes a laundry and storage room instead of an oversized bedroom
      utility = { kind: 'utility', w: Math.min(extra, 2.0) };
      extra -= utility.w;
      const bi = expand.findIndex((u) => u.kind === 'bath');
      expand.splice(bi + 1, 0, utility);
    }
    const flexible = expand.filter((u) => ['master', 'kid', 'adult', 'office', 'guest'].includes(u.kind));
    const flexSum = flexible.reduce((a, u) => a + u.w, 0) || 1;
    const widths = expand.map((u) => u.w + (flexible.includes(u) ? extra * (u.w / flexSum) : 0));
    if (!flexible.length) widths[widths.length - 1] += extra;

    const yB = Dp + corr;
    let cx = 0;
    let kidN = 0;
    const kidTotal = expand.filter((u) => u.kind === 'kid').length + fp.top.filter((u) => u.kind === 'kid').length;
    const nameOf = (u) => {
      switch (u.kind) {
        case 'master': return 'חדר שינה הורים' + (u.mamad ? ' (ממ״ד)' : '');
        case 'ensuite': return 'מקלחת הורים';
        case 'kid': kidN++; return 'חדר ילדים' + (kidTotal > 1 ? ' ' + kidN : '') + (u.mamad ? ' (ממ״ד)' : '');
        case 'adult': return 'חדר שינה' + (u.mamad ? ' (ממ״ד)' : '');
        case 'office': return 'חדר עבודה' + (u.mamad ? ' (ממ״ד)' : '');
        case 'guest': return 'חדר אורחים' + (u.mamad ? ' (ממ״ד)' : '');
        case 'bath': return 'חדר רחצה';
        case 'wc': return 'שירותי אורחים';
        case 'utility': return 'חדר כביסה ואחסון';
        default: return 'חדר';
      }
    };
    const privRooms = [];
    expand.forEach((u, i) => {
      const r = addRoom({ kind: u.kind, name: nameOf(u), x: R(cx), y: R(yB), w: R(widths[i]), d: R(Dr), frame: 'bottom', mirror: i === 0 && u.kind !== 'ensuite', sleepers: u.sleepers || 0, mamad: !!u.mamad });
      cx += widths[i];
      privRooms.push(r);
    });

    // rooms on the near side of the corridor, beside the living area
    const topRooms = [];
    let tx = Wp;
    fp.top.forEach((u, i) => {
      const r = addRoom({ kind: u.kind, name: nameOf(u), x: R(tx), y: 0, w: R(fp.topW[i]), d: R(Dp), frame: 'top', mirror: false, sleepers: u.sleepers || 0, mamad: !!u.mamad });
      tx += fp.topW[i];
      topRooms.push(r);
    });

    /* ----- public zone: kitchen, dining, living ----- */
    const corridor = corr ? addRoom({ kind: 'corridor', name: 'כניסה ומסדרון', x: 0, y: R(Dp), w: R(W), d: corr, frame: 'bottom' }) : null;
    const mode = fp.mode;
    let Kw = mode === 'compact' ? clamp(Wp * 0.45, 2.9, 3.3) : clamp(Wp * 0.3, 2.4, 4.0);
    const Rw = Wp - Kw;
    const stacked = mode === 'stacked';
    let Dw = 0, Lw = Rw;
    if (mode === 'row') { Dw = Rw >= 6.8 ? clamp(Rw * 0.4, 2.8, 4.0) : clamp(Rw - 3.0, 2.5, 2.9); Lw = Rw - Dw; }

    const kitchen = addRoom({ kind: 'kitchen', name: mode === 'compact' ? 'מטבח ודלפק אוכל' : 'מטבח', x: 0, y: 0, w: R(Kw), d: R(Dp), frame: 'bottom', open: true });
    let dining = null, living;
    // TV wall: the solid wall on the right ("side" frame) or a partition toward the
    // corridor ("bottom" frame). Pick the one with the better viewing distance.
    const vE = Lw - 1.55, vS = Dp - 1.55;
    const good = (v) => (v >= 2.1 ? 10 - Math.abs(v - 2.9) : v);
    const tvFrame = corr && good(vS) > good(vE) + 0.2 ? 'bottom' : 'side';
    if (mode === 'row') {
      dining = addRoom({ kind: 'dining', name: 'פינת אוכל', x: R(Kw), y: 0, w: R(Dw), d: R(Dp), frame: 'bottom', open: true });
      living = addRoom({ kind: 'living', name: 'סלון', x: R(Kw + Dw), y: 0, w: R(Lw), d: R(Dp), frame: tvFrame, open: true });
    } else if (stacked) {
      const dd = clamp(Dp - 3.6, 2.2, 2.8);
      living = addRoom({ kind: 'living', name: 'סלון', x: R(Kw), y: 0, w: R(Lw), d: R(Dp - dd), frame: 'side', open: true });
      dining = addRoom({ kind: 'dining', name: 'פינת אוכל', x: R(Kw), y: R(Dp - dd), w: R(Lw), d: R(dd), frame: 'bottom', open: true });
    } else {
      living = addRoom({ kind: 'living', name: 'סלון', x: R(Kw), y: 0, w: R(Lw), d: R(Dp), frame: tvFrame, open: true });
      notes.push('בדירה בגודל הזה דלפק בר במטבח מחליף פינת אוכל. לאירוח: שולחן מתקפל שנפתח בסלון.');
    }
    let balcony = null;
    if (q.balcony) {
      balcony = addRoom({ kind: 'balcony', name: 'מרפסת שמש', x: living.x, y: -1.8, w: living.w, d: 1.8, frame: 'bottom', outdoor: true });
    }

    /* ----- kitchen ----- */
    const K = kitchen;
    let shape = q.kitchen;
    if (mode === 'compact') shape = 'parallel';
    if (shape === 'auto') shape = Kw >= 3.4 && Dp >= 4.6 ? 'island' : Kw >= 2.7 ? 'L' : 'linear';
    if (shape === 'island' && (Kw < 3.2 || Dp < 4.2)) { notes.push('אין מספיק רוחב לאי מטבח (צריך 3.2 מ׳ לפחות), לכן תוכנן מטבח L.'); shape = Kw >= 2.7 ? 'L' : 'linear'; }
    if (shape === 'parallel' && Kw < 2.9) { notes.push('מטבח מקביל דורש 2.9 מ׳ רוחב, לכן תוכנן מטבח ישר.'); shape = 'linear'; }
    if (shape === 'L' && Kw < 2.4) shape = 'linear';
    const kItems = {};
    let counterLen = 0;
    let kitchenWindow = null; // [x1, x2] on the top wall

    // run along a wall: axis 'y' => along left wall facing E, axis 'x' => along top wall facing S
    function run(axis, fixed, start, mods, face, wallKey) {
      let p = start;
      mods.forEach((m) => {
        const rect = axis === 'y'
          ? { x: fixed, y: p, w: m.d || 0.6, d: m.w, face }
          : { x: p, y: fixed, w: m.w, d: m.d || 0.6, face };
        const it = add(m.type, K, rect, { h: m.h || 0.9, len: m.w, wall: wallKey });
        if (m.key) kItems[m.key] = it;
        if (m.type !== 'fridge') counterLen += m.w;
        p += m.w;
      });
      return p;
    }
    function fitMods(mods, length) {
      const fixed = mods.filter((m) => !m.flex).reduce((a, m) => a + m.w, 0);
      let rest = length - fixed;
      if (rest < 0.3) {
        const dw = mods.findIndex((m) => m.type === 'dishwasher');
        if (dw >= 0) { mods.splice(dw, 1); rest += 0.6; }
      }
      if (rest < 0.3) mods.forEach((m) => { if (m.type === 'cooktop' || m.type === 'sink') { rest += m.w - 0.6; m.w = 0.6; } });
      const flex = mods.filter((m) => m.flex);
      flex.forEach((m) => { m.w = Math.max(0, rest / flex.length); });
      return mods.filter((m) => m.w > 0.05);
    }
    const base = (w, flex) => ({ type: 'kitchenBase', w, flex });
    const upperRuns = [];

    if (shape === 'linear' || shape === 'parallel') {
      const Lk = Math.min(Dp - (corr ? 0.3 : 1.2), shape === "parallel" ? 3.6 : 3.9);
      let mods = shape === 'linear'
        ? [base(0.45), { type: 'cooktop', w: 0.8, key: 'cook' }, base(0.6, true), { type: 'sink', w: 0.8, key: 'sink' }, { type: 'dishwasher', w: 0.6 }, { type: 'fridge', w: 0.75, d: 0.7, h: 1.85, key: 'fridge' }]
        : [base(0.45), { type: 'cooktop', w: 0.8, key: 'cook' }, base(0.6, true), { type: 'fridge', w: 0.75, d: 0.7, h: 1.85, key: 'fridge' }];
      mods = fitMods(mods, Lk);
      run('y', 0.02, 0.02, mods, 'E', 'left');
      upperRuns.push({ axis: 'y', from: 0.02, to: 0.02 + Lk - 0.75, fixed: 0.02 });
      kitchenWindow = [clamp(Kw / 2 - 0.5, 0.9, Kw - 1.2), clamp(Kw / 2 + 0.5, 1.9, Kw - 0.2)];
      if (shape === 'parallel') {
        const px = 1.8;
        const len = Math.min(Lk - 0.6, 2.6);
        let pm = fitMods([base(0.3, true), { type: 'sink', w: 0.8, key: 'sink' }, { type: 'dishwasher', w: 0.6 }, base(0.3, true)], len);
        run('y', px, 0.9, pm, 'W', 'peninsula');
        const nSt = Math.floor(len / 0.6);
        for (let i = 0; i < nSt && px + 0.95 < Kw + 0.4; i++) add('stool', K, { x: px + 0.62, y: 0.9 + 0.1 + i * 0.6, w: 0.42, d: 0.42, face: 'W' }, { h: 0.65 });
      }
    } else {
      // L (and island, which is an L plus a free-standing island)
      const bEnd = Math.min(Kw - 0.15, 3.4);
      let bm = fitMods([{ type: 'kitchenBase', w: 0.9, corner: true }, { type: 'sink', w: 0.8, key: 'sink' }, { type: 'dishwasher', w: 0.6 }, base(0.4, true)], bEnd - 0.02);
      run('x', 0.02, 0.02, bm, 'S', 'top');
      const sink = kItems.sink;
      if (sink) kitchenWindow = [sink.x - 0.1, sink.x + sink.w + 0.1];
      // keep the fridge within 2.7 m of the sink (NKBA work triangle)
      const aLen = Math.min(Dp - 0.62 - (corr ? (shape === 'island' ? 0.2 : 0.3) : 1.2), 2.6);
      let am = fitMods([base(0.45), { type: 'cooktop', w: 0.8, key: 'cook' }, base(0.5, true), { type: 'fridge', w: 0.75, d: 0.7, h: 1.85, key: 'fridge' }], aLen);
      run('y', 0.02, 0.62, am, 'E', 'left');
      upperRuns.push({ axis: 'y', from: 0.62, to: 0.62 + aLen - 0.75, fixed: 0.02 });
      upperRuns.push({ axis: 'x', from: 0.62, to: kitchenWindow ? kitchenWindow[0] : bEnd, fixed: 0.02 });
      if (kitchenWindow && kitchenWindow[1] < bEnd - 0.3) upperRuns.push({ axis: 'x', from: kitchenWindow[1], to: bEnd, fixed: 0.02 });
      if (shape === 'island') {
        const ix = 0.62 + 1.1;
        const iy = 0.62 + 1.1;
        const len = clamp(Dp - iy - 1.0, 1.2, 2.4);
        const isl = add('island', K, { x: ix, y: iy, w: 0.95, d: len, face: 'E' }, { h: 0.9 });
        kItems.island = isl;
        counterLen += len;
        const nSt = Math.max(1, Math.floor(len / 0.6));
        for (let i = 0; i < nSt; i++) add('stool', K, { x: ix + 0.95 + 0.05, y: iy + 0.09 + i * 0.6, w: 0.42, d: 0.42, face: 'W' }, { h: 0.65 });
      }
    }
    // upper cabinets and hood
    upperRuns.forEach((u) => {
      const len = u.to - u.from;
      if (len < 0.3) return;
      const rect = u.axis === 'y' ? { x: u.fixed, y: u.from, w: 0.35, d: len, face: 'E' } : { x: u.from, y: u.fixed, w: len, d: 0.35, face: 'S' };
      add('kitchenUpper', K, rect, { z: 1.45, h: 0.75, len, wall: u.axis === 'y' ? 'left' : 'top' });
    });
    if (kItems.cook) {
      const c = kItems.cook;
      add('hood', K, { x: c.x, y: c.y, w: c.face === 'E' ? 0.5 : c.w, d: c.face === 'E' ? c.d : 0.5, face: c.face }, { z: 1.55, h: 0.6 });
    }
    // work triangle (NKBA): each leg 1.2–2.7 m, total up to 7.9 m
    const ctr = (it) => ({ x: it.x + it.w / 2, y: it.y + it.d / 2 });
    let triangle = null;
    if (kItems.sink && kItems.cook && kItems.fridge) {
      const a = ctr(kItems.sink), b = ctr(kItems.cook), c = ctr(kItems.fridge);
      const dist = (p, r) => Math.hypot(p.x - r.x, p.y - r.y);
      const legs = [dist(a, b), dist(b, c), dist(c, a)];
      const total = legs.reduce((s, v) => s + v, 0);
      triangle = { pts: [a, b, c], legs, total };
      const okLegs = legs.every((l) => l >= 1.0 && l <= 2.75);
      check(K, total <= 7.9 && okLegs, `משולש עבודה: ${legs.map((l) => l.toFixed(1)).join(' + ')} = ${total.toFixed(1)} מ׳ (NKBA: כל צלע 1.2–2.7 מ׳, סה״כ עד 7.9 מ׳)`);
    }
    check(K, counterLen >= 3.0, `אורך משטחי עבודה: ${counterLen.toFixed(1)} מ׳ (${counterLen >= 4 ? 'מצוין' : counterLen >= 3 ? 'סביר למשפחה קטנה' : 'קצר, שקלו עגלת עבודה או אי נייד'})`);
    const kShapeName = { linear: 'מטבח ישר (קיר אחד)', L: 'מטבח בצורת L', parallel: 'מטבח מקביל עם דלפק', island: 'מטבח L עם אי' }[shape];

    /* ----- living -----
       Canonical frame: the sofa's back toward v = 0 (window or dining side),
       the TV on the wall at v = cd, u along the sofa. */
    const L = living;
    const people = q.adults + q.kids;
    const { cw: Lcw, cd: Lcd } = roomFrame(L);
    const eye = 0.55;
    let vb = 0.9;
    let view = Lcd - 0.1 - (vb + eye);
    if (view > 3.3) { vb = Lcd - 0.1 - 3.3 - eye; view = 3.3; }
    if (view < 1.9) { vb = Math.max(0.1, Lcd - 0.1 - 1.9 - eye); view = Lcd - 0.1 - (vb + eye); }
    let sofaType = people >= 4 && Lcw >= 3.9 ? 'sofaL' : (people >= 3 || Lcw >= 3.3) ? 'sofa3' : 'sofa2';
    const sofaLen = { sofaL: 2.8, sofa3: 2.2, sofa2: 1.8 };
    while (sofaLen[sofaType] > Lcw - (corr ? 0.7 : 1.3) && sofaType !== 'sofa2') sofaType = sofaType === 'sofaL' ? 'sofa3' : 'sofa2';
    const sLen = sofaLen[sofaType];
    // in the side frame u = cw is the window wall: shift the sofa away from it
    const uMin = corr ? 0.3 : 0.9;
    const uc = clamp(Lcw / 2 - (L.frame === 'side' && corr ? 0.2 : 0), sLen / 2 + uMin, Math.max(sLen / 2 + uMin, Lcw - sLen / 2 - 0.3));
    const u0 = uc - sLen / 2, u1 = uc + sLen / 2;
    const sofaExtra = { h: 0.85, len: sLen };
    if (sofaType === 'sofaL') sofaExtra.parts = [toWorld(L, u0, vb + 0.95, 0.9, 0.7, 'S')];
    addC(sofaType, L, u0, vb, sLen, 0.95, 'S', sofaExtra);
    const front = vb + 0.95;
    check(L, vb >= 0.85, `מעבר מאחורי הספה: ${Math.round(vb * 100)} ס״מ (מומלץ 90 ס״מ לפחות)`);

    // TV size from viewing distance (THX 40° ≈ 1.2×, SMPTE 30° ≈ 1.6× the diagonal)
    const sizes = [43, 50, 55, 65, 75, 85];
    const ideal = view / 1.55 / 0.0254;
    const tvIn = sizes.reduce((a, sz) => (Math.abs(sz - ideal) < Math.abs(a - ideal) ? sz : a), sizes[0]);
    const tvW = tvIn * 0.0254 * 0.8716, tvH = tvIn * 0.0254 * 0.49;
    const consoleW = clamp(Math.max(1.6, tvW + 0.3), 1.2, Lcw - 0.4);
    addC('tvConsole', L, uc - consoleW / 2, Lcd - 0.42, consoleW, 0.42, 'N', { h: 0.48, len: consoleW });
    addC('tv', L, uc - tvW / 2, Lcd - 0.07, tvW, 0.06, 'N', { z: 1.05 - tvH / 2, h: tvH, note: `${tvIn}״`, size: tvIn });
    check(L, view >= 1.9, `טלוויזיה ${tvIn}״ במרחק צפייה ${view.toFixed(1)} מ׳ (${(view / (tvIn * 0.0254)).toFixed(2)}× האלכסון, הטווח המומלץ 1.2–1.6)`);

    // coffee table: two thirds of the sofa, 42 cm in front of it
    const ctLen = R(clamp((sofaType === 'sofaL' ? 1.9 : sLen) * 2 / 3, 0.8, 1.4));
    const ctV = front + 0.42;
    const ctFree = Lcd - 0.42 - (ctV + 0.6);
    let ctU = uc - ctLen / 2;
    if (sofaType === 'sofaL') ctU = Math.max(ctU, u0 + 0.9 + 0.4);
    if (ctFree >= 0.6) addC('coffeeTable', L, ctU, ctV, ctLen, 0.6, 'N', { h: 0.4 });
    if (ctFree >= 0.6) check(L, ctFree >= 0.75, `מעבר בין שולחן הסלון למזנון: ${Math.round(ctFree * 100)} ס״מ (מומלץ 75 ס״מ ומעלה)`);
    else check(L, false, 'אין מקום לשולחן סלון מול הספה בלי לחסום מעבר. עדיף שולחן צד או שולחן קפה נפתח.');

    // rug: at least the front legs of the seating stand on it
    const rugOpts = [[2.4, 3.4], [2.0, 2.9], [1.6, 2.3], [1.4, 2.0]];
    const rug = rugOpts.find(([a, b]) => a <= Lcd - 0.5 - (front - 0.25) && b <= Lcw - 0.3 && b <= sLen + 1.3) || rugOpts[3];
    addC('rug', L, uc - rug[1] / 2, front - 0.25, rug[1], rug[0], 'S', { h: 0.01, note: `${Math.round(rug[0] * 100)}×${Math.round(rug[1] * 100)}` });

    if (Lcw - u1 >= 0.55) addC('sideTable', L, u1 + 0.05, vb + 0.25, 0.45, 0.45, 'S', { h: 0.55 });
    if (u0 >= 0.5) addC('floorLamp', L, u0 - 0.45, vb + 0.2, 0.4, 0.4, 'S', { h: 1.6 });
    if (Lcw - u1 >= 1.2 && ctFree >= 0.6 && ctV + 0.7 <= Lcd - 0.75) addC('armchair', L, u1 + 0.3, ctV - 0.1, 0.8, 0.8, 'W', { h: 0.8 });
    if (uc + consoleW / 2 <= Lcw - 0.6) addC('plant', L, Lcw - 0.5, Lcd - 0.5, 0.45, 0.45, 'N', { h: 1.5 });

    // the balcony / big window on the outer wall of the living area
    const sliderW = clamp(L.w - 1.4, 1.6, 3.0);
    const sliderC = L.x + L.w / 2 + (L.frame === 'side' ? 0.2 : 0);
    const slider = [sliderC - sliderW / 2, sliderC + sliderW / 2];

    /* ----- dining ----- */
    let seats = 0;
    if (dining) {
    const Dz = dining;
    seats = q.seats === 'auto' ? (people <= 2 ? 4 : people <= 4 ? 6 : 8) : q.seats;
    const TABLES = { 2: [0.8, 0.8], 4: [1.2, 0.8], 6: [1.8, 0.9], 8: [2.2, 1.0], 10: [2.6, 1.0], 12: [3.0, 1.05] };
    seats = Math.min(12, seats + (seats % 2));
    const long = Math.max(Dz.w, Dz.d), short = Math.min(Dz.w, Dz.d);
    const want = seats;
    while (seats > 2 && (TABLES[seats][0] + 1.7 > long || TABLES[seats][1] + 1.7 > short)) seats -= 2;
    if (seats < want) notes.push(`בפינת האוכל נכנס שולחן ל-${seats} סועדים. לאירוח של ${want} כדאי שולחן נפתח.`);
    const [tl, tw] = TABLES[seats];
    const alongY = Dz.d >= Dz.w;
    const tcx = Dz.x + Dz.w / 2 + (stacked ? 0 : 0);
    const tcy = Dz.y + Dz.d / 2 + (stacked ? 0 : -0.1);
    const table = add('diningTable', Dz, alongY ? { x: tcx - tw / 2, y: tcy - tl / 2, w: tw, d: tl, face: 'S' } : { x: tcx - tl / 2, y: tcy - tw / 2, w: tl, d: tw, face: 'S' }, { h: 0.75, note: `${seats} מקומות` });
    const ends = seats >= 6 ? 2 : 0;
    const per = (seats - ends) / 2;
    const cw = 0.46, cd = 0.5;
    for (let i = 0; i < per; i++) {
      const t = (i + 0.5) / per;
      if (alongY) {
        const yy = table.y + t * tl - cw / 2;
        add('chair', Dz, { x: table.x - cd + 0.15, y: yy, w: cd, d: cw, face: 'E' }, { h: 0.85 });
        add('chair', Dz, { x: table.x + tw - 0.15, y: yy, w: cd, d: cw, face: 'W' }, { h: 0.85 });
      } else {
        const xx = table.x + t * tl - cw / 2;
        add('chair', Dz, { x: xx, y: table.y - cd + 0.15, w: cw, d: cd, face: 'S' }, { h: 0.85 });
        add('chair', Dz, { x: xx, y: table.y + tw - 0.15, w: cw, d: cd, face: 'N' }, { h: 0.85 });
      }
    }
    if (ends) {
      if (alongY) {
        add('chair', Dz, { x: tcx - cw / 2, y: table.y - cd + 0.15, w: cw, d: cd, face: 'S' }, { h: 0.85 });
        add('chair', Dz, { x: tcx - cw / 2, y: table.y + tl - 0.15, w: cw, d: cd, face: 'N' }, { h: 0.85 });
      } else {
        add('chair', Dz, { x: table.x - cd + 0.15, y: tcy - cw / 2, w: cd, d: cw, face: 'E' }, { h: 0.85 });
        add('chair', Dz, { x: table.x + tl - 0.15, y: tcy - cw / 2, w: cd, d: cw, face: 'W' }, { h: 0.85 });
      }
    }
    add('pendant', Dz, { x: tcx - 0.25, y: tcy - 0.25, w: 0.5, d: 0.5, face: 'S' }, { z: 1.55, h: 0.35 });
    const clrX = alongY ? (Dz.w - tw) / 2 : (Dz.w - tl) / 2;
    const clrY = alongY ? (Dz.d - tl) / 2 : (Dz.d - tw) / 2;
    const clr = Math.min(clrX, clrY + (stacked ? 0 : 0.1));
    check(Dz, clr >= 0.85, `שולחן ${Math.round(tl * 100)}×${Math.round(tw * 100)} ל-${seats}: ${Math.round(clr * 100)} ס״מ סביב השולחן (מומלץ 90 ס״מ להזזת כיסא ומעבר)`);
    } else {
      seats = items.filter((it) => it.type === 'stool').length;
    }

    // office corner when no room was free for it: by the living-room window
    if (prog.officeCorner) {
      const cands = [L.x + 0.1, L.x + L.w - 1.3].concat(dining ? [dining.x + 0.1] : []);
      let placed = false;
      for (const x0 of cands) {
        const room = dining && x0 === dining.x + 0.1 ? dining : L;
        const zone = { x: x0, y: 0.05, w: 1.2, d: 1.5 };
        const onSlider = x0 < slider[1] && slider[0] < x0 + 1.2 && room === L;
        const clash = items.some((it) => it.type !== 'rug' && it.z < 1 && overlap(zone, it));
        if (!clash && !onSlider && x0 + 1.2 <= room.x + room.w) {
          add('desk', room, { x: x0, y: 0.05, w: 1.2, d: 0.6, face: 'S' }, { h: 0.74 });
          add('officeChair', room, { x: x0 + 0.33, y: 0.7, w: 0.55, d: 0.55, face: 'N' }, { h: 0.9 });
          check(room, true, 'פינת עבודה ליד החלון: אור טבעי בלי לוותר על חדר.');
          placed = true;
          break;
        }
      }
      if (!placed) notes.push('לא נמצא מקום לפינת עבודה בחלל הציבורי בלי לחסום מעבר. שקלו שולחן מתקפל על הקיר בחדר השינה.');
    }

    /* ----- private rooms ----- */
    const DOOR = { master: 0.9, kid: 0.9, adult: 0.9, office: 0.9, guest: 0.9, bath: 0.8, wc: 0.7, ensuite: 0.75, utility: 0.8 };

    function furnishBedroom(r) {
      const { cw, cd } = roomFrame(r);
      const area = r.w * r.d;
      const doorEnd = 0.15 + DOOR[r.kind] + 0.1;
      // wardrobe along the door wall, beside the door
      const wLen = cw - doorEnd - 0.05;
      let topOcc = 0;
      let leftWardrobe = false;
      if (r.kind !== 'office' && r.kind !== 'guest') {
        if (wLen >= 1.0) {
          addC('wardrobe', r, doorEnd, 0.02, wLen, 0.6, 'S', { h: 2.4, len: wLen });
          topOcc = 0.62;
        } else {
          leftWardrobe = true;
          addC('wardrobe', r, 0.02, doorEnd, 0.6, Math.min(1.8, cd - doorEnd - 1.4), 'E', { h: 2.4, len: Math.min(1.8, cd - doorEnd - 1.4) });
        }
      }
      if (r.kind === 'master' || (r.kind === 'adult' && r.sleepers === 2)) {
        const bedW = cw >= 3.8 && cd >= 3.9 ? 1.8 : 1.6;
        const bedL = 2.1;
        let sideFree = (cd - topOcc - bedW) / 2;
        const hasEnsuiteDoor = r.kind === 'master' && !!prog.ensuite;
        if (sideFree < 0.58 && topOcc && cw - bedL - 0.62 >= 0.9 && (cd - bedW) / 2 >= 0.58) {
          // shallow but wide room: move the wardrobe to the side wall and free the whole depth for the bed
          items.splice(items.findIndex((it) => it.room === r.id && it.type === 'wardrobe'), 1);
          const wl = cd - 1.1;
          addC('wardrobe', r, 0.02, 1.05, 0.6, wl, 'E', { h: 2.4, len: wl });
          topOcc = 0;
          leftWardrobe = true;
        }
        const sideFree2 = (cd - topOcc - bedW) / 2;
        if (sideFree2 >= 0.58 && cw - bedL >= 0.9) {
          const vc = topOcc + (cd - topOcc) / 2;
          addC('bedDouble', r, cw - bedL, vc - bedW / 2, bedL, bedW, 'W', { h: 0.5, note: `${Math.round(bedW * 100)}×200` });
          addC('nightstand', r, cw - 0.42, vc - bedW / 2 - 0.5, 0.4, 0.45, 'W', { h: 0.55 });
          addC('nightstand', r, cw - 0.42, vc + bedW / 2 + 0.05, 0.4, 0.45, 'W', { h: 0.55 });
          addC('rug', r, cw - bedL - 0.6, vc - bedW / 2 - 0.55, Math.min(1.9, cw - 0.9), bedW + 1.1, 'W', { h: 0.01 });
          const footGap = cw - bedL - 0.5;
          const dv = Math.max(hasEnsuiteDoor ? 1.6 : topOcc + 0.5, vc - 0.6);
          if (footGap >= 0.85 && !leftWardrobe && dv + 1.2 <= cd - 0.05) addC('dresser', r, 0.02, dv, 0.5, 1.2, 'E', { h: 0.8 });
          check(r, true, `מיטה ${Math.round(bedW * 100)} עם ${Math.round(sideFree2 * 100)} ס״מ בכל צד ו-${Math.round((cw - bedL) * 100)} ס״מ מול כף הרגל. ${topOcc && sideFree2 < 0.9 ? 'מול הארון פחות מ-90 ס״מ: דלתות הזזה.' : ''}`);
        } else {
          const bw = Math.min(bedW, cw - 1.3);
          const u0 = (cw - bw) / 2;
          addC('bedDouble', r, u0, cd - bedL, bw, bedL, 'N', { h: 0.5, note: `${Math.round(bw * 100)}×200` });
          addC('nightstand', r, u0 - 0.47, cd - 0.44, 0.45, 0.4, 'N', { h: 0.55 });
          addC('nightstand', r, u0 + bw + 0.02, cd - 0.44, 0.45, 0.4, 'N', { h: 0.55 });
          check(r, false, 'החדר צר: ראש המיטה נשען על קיר החלון. בחרו וילון האפלה ומיטה עם ראש מרופד נמוך מאדן החלון.');
        }
      } else if (r.kind === 'kid' || r.kind === 'adult') {
        const two = r.sleepers === 2;
        const bedType = two && cw < 3.4 ? 'bunk' : 'bedSingle';
        const bl = 2.02, bw = 0.95;
        addC(bedType, r, cw - bw - 0.03, cd - bl - 0.03, bw, bl, 'W', { h: bedType === 'bunk' ? 1.75 : 0.45 });
        let deskPlaced = false;
        if (two && bedType === 'bedSingle') {
          addC('bedSingle', r, 0.03, cd - bl - 0.03, bw, bl, 'E', { h: 0.45 });
          const gap = cw - 2 * bw - 0.06;
          if (gap >= 0.55) addC('nightstand', r, bw + 0.03 + (gap - 0.45) / 2, cd - 0.45, 0.45, 0.4, 'N', { h: 0.55 });
        } else if (!leftWardrobe) {
          const dl = Math.min(1.2, cd - topOcc - 1.2);
          if (dl >= 0.9) {
            addC('desk', r, 0.02, cd - dl - 0.05, 0.6, dl, 'E', { h: 0.74 });
            addC('officeChair', r, 0.65, cd - dl / 2 - 0.3, 0.5, 0.5, 'W', { h: 0.9 });
            deskPlaced = true;
            const shelfL = cd - dl - 0.15 - (topOcc + 0.9);
            if (shelfL >= 0.6) addC('bookshelf', r, 0.02, topOcc + 0.9, 0.35, Math.min(0.9, shelfL), 'E', { h: 1.8 });
          }
        }
        const freeU = cw - bw - (deskPlaced ? 1.2 : two ? bw : 0.1);
        if (freeU >= 1.1) addC('rug', r, (deskPlaced ? 1.2 : two ? bw + 0.1 : 0.2), topOcc + 0.35, Math.min(1.6, freeU - 0.1), Math.min(1.2, cd - topOcc - 1.2), 'S', { h: 0.01 });
        check(r, area >= 9, `${Math.round(area * 10) / 10} מ״ר ל-${r.sleepers} ${r.sleepers === 2 ? 'ילדים' : 'ילד/ה'}${bedType === 'bunk' ? ', מיטת קומותיים משחררת רצפה למשחק' : ''}.`);
      } else if (r.kind === 'office' || r.kind === 'guest') {
        // desk perpendicular to the window: daylight from the side, no glare on the screen
        const dl = 1.4;
        addC('desk', r, 0.02, cd - dl - 0.1, 0.7, dl, 'E', { h: 0.74 });
        addC('officeChair', r, 0.75, cd - dl / 2 - 0.38, 0.55, 0.55, 'W', { h: 0.95 });
        const shelf = cw - doorEnd - 0.05;
        if (shelf >= 0.8) addC('bookshelf', r, doorEnd, 0.02, Math.min(1.8, shelf), 0.35, 'S', { h: 2.0 });
        if (cw >= 2.6) addC('sofaBed', r, cw - 0.93, Math.max(0.6, cd / 2 - 1.0), 0.9, 2.0, 'W', { h: 0.85 });
        check(r, true, 'שולחן בניצב לחלון (אור מהצד, בלי סנוור) וספה נפתחת לאורחים.');
      }
      if (r.mamad) {
        check(r, true, 'ממ״ד: משאירים פנויים את פתח דלת ההדף, את חלון הפלדה ואת מסנן האוורור. לא תולים מדפים כבדים מעל המיטה (הנחיות פיקוד העורף).');
      }
    }

    function furnishBath(r) {
      const { cw, cd } = roomFrame(r);
      if (r.kind === 'wc') {
        addC('toilet', r, cw / 2 - 0.2, cd - 0.62, 0.4, 0.6, 'N', { h: 0.8 });
        addC('vanity', r, cw - 0.38, 1.1, 0.36, 0.5, 'W', { h: 0.85, small: true });
        return;
      }
      if (r.kind === 'utility') {
        addC('washer', r, cw - 0.62, cd - 0.65, 0.6, 0.6, 'N', { h: 1.7 });
        addC('bookshelf', r, 0.02, 1.0, 0.4, Math.min(1.8, cd - 1.2), 'E', { h: 2.2, note: 'מדפי אחסון' });
        check(r, true, 'חדר כביסה ואחסון: מכונה ומייבש בטור, מדפים עמוקים לשואב, קרש גיהוץ ומלאי.');
        return;
      }
      if (r.kind === 'ensuite') {
        addC('vanity', r, 0.25, 0.02, Math.min(1.0, cw - 0.5), 0.5, 'S', { h: 0.85 });
        addC('toilet', r, 0.02, Math.min(1.5, cd - 1.5), 0.6, 0.4, 'E', { h: 0.8 });
        addC('shower', r, cw - 0.93, cd - 0.93, 0.9, 0.9, 'N', { h: 2.0 });
        check(r, true, 'מקלחת הורים: מקלחון 90×90 בפינה הרחוקה מהדלת, אסלה עם 60 ס״מ פנויים מולה.');
        return;
      }
      const tub = cw >= 1.75 && q.kids > 0;
      const wetD = tub ? 0.72 : 0.92;
      if (tub) addC('bathtub', r, 0.02, cd - wetD, 1.7, 0.7, 'N', { h: 0.55 });
      else addC('shower', r, 0.02, cd - wetD, 0.9, 0.9, 'E', { h: 2.0 });
      const tv = cd - wetD - 0.55;
      addC('toilet', r, 0.02, tv, 0.6, 0.4, 'E', { h: 0.8 });
      const vl = Math.min(1.0, tv - 1.05);
      if (vl >= 0.6) addC('vanity', r, 0.02, tv - vl - 0.1, 0.5, vl, 'E', { h: 0.85 });
      if (!utility) addC('washer', r, cw - 0.62, 0.05, 0.6, 0.6, 'W', { h: 1.7 });
      check(r, true, `${tub ? 'אמבטיה (נוחה לילדים קטנים)' : 'מקלחון 90×90'}${utility ? '' : ', פינת כביסה עם מייבש מעל המכונה'}.`);
    }

    [...privRooms, ...topRooms].forEach((r) => {
      if (['bath', 'wc', 'ensuite', 'utility'].includes(r.kind)) furnishBath(r); else furnishBedroom(r);
    });

    // entrance: shallow shoe cabinet
    const first = privRooms[0];
    if (corridor && first && first.w >= 2.2) add('shoeCabinet', corridor, { x: 0.1, y: yB - 0.32, w: 0.9, d: 0.3, face: 'N' }, { h: 1.0 });
    if (balcony) {
      add('outdoorSet', balcony, { x: balcony.x + balcony.w / 2 - 0.7, y: -1.45, w: 1.4, d: 0.9, face: 'S' }, { h: 0.75 });
      add('plant', balcony, { x: balcony.x + 0.15, y: -1.65, w: 0.45, d: 0.45, face: 'S' }, { h: 1.2 });
    }

    /* ----- walls and openings ----- */
    const segs = [];
    function seg(x1, y1, x2, y2, ext) {
      const s = { x1: R(x1), y1: R(y1), x2: R(x2), y2: R(y2), ext: !!ext, open: [] };
      segs.push(s);
      return s;
    }
    function opening(s, a, b, type, sill, head, swing) {
      // a,b are absolute coords along the segment axis; swing = { into: N|S|E|W, hinge: 'start'|'end' }
      const horiz = s.y1 === s.y2;
      const o0 = horiz ? s.x1 : s.y1;
      s.open.push(Object.assign({ t0: R(Math.min(a, b) - o0), t1: R(Math.max(a, b) - o0), type, sill: sill || 0, head: head || 2.1 }, swing || {}));
    }
    const top = seg(0, 0, W, 0, true);
    const bottomW = seg(0, D, W, D, true);
    const left = seg(0, 0, 0, D, true);
    const right = seg(W, 0, W, D, true);
    if (corr) opening(left, Dp + 0.12, Dp + 1.07, 'entry', 0, 2.15, { into: 'E', hinge: 'end' }); else opening(left, Dp - 1.05, Dp - 0.1, 'entry', 0, 2.15, { into: 'E', hinge: 'end' });

    // top wall openings
    if (kitchenWindow) opening(top, kitchenWindow[0], kitchenWindow[1], 'window', 1.05, 2.1);
    if (mode === 'row') { const c = dining.x + dining.w / 2; opening(top, c - 0.8, c + 0.8, 'window', 0.6, 2.2); }
    opening(top, slider[0], slider[1], q.balcony ? 'slider' : 'window', q.balcony ? 0 : 0.5, 2.3);
    if (L.frame === 'bottom') seg(L.x, Dp, L.x + L.w, Dp); // TV partition toward the corridor
    // private rooms
    privRooms.forEach((r, i) => {
      const t = seg(r.x, yB, r.x + r.w, yB);
      if (r.kind !== 'ensuite') {
        const dw = DOOR[r.kind];
        const a = toWorld(r, 0.15, 0, dw, 0.1);
        opening(t, a.x, a.x + a.w, 'door', 0, 2.1, { into: 'S', hinge: r.mirror ? 'end' : 'start' });
      }
      if (i > 0) {
        const s = seg(r.x, yB, r.x, D);
        if (r.kind === 'master' && privRooms[i - 1].kind === 'ensuite') opening(s, yB + 0.75, yB + 1.5, 'door', 0, 2.1, { into: 'W', hinge: 'start' });
      }
      const winW = { master: 1.6, kid: 1.4, adult: 1.4, office: 1.4, guest: 1.4, bath: 0.6, wc: 0.5, ensuite: 0.6, utility: 0.6 }[r.kind] * (r.mamad ? 0.7 : 1);
      const wet = ['bath', 'wc', 'ensuite', 'utility'].includes(r.kind);
      const c = r.x + r.w / 2;
      opening(bottomW, c - winW / 2, c + winW / 2, 'window', wet ? 1.5 : 0.9, 2.1);
      if (r.mamad) r.steel = true;
    });
    topRooms.forEach((r, i) => {
      const t = seg(r.x, Dp, r.x + r.w, Dp);
      const dw = DOOR[r.kind];
      const a = toWorld(r, 0.15, 0, dw, 0.1);
      opening(t, a.x, a.x + a.w, 'door', 0, 2.1, { into: 'N', hinge: 'end' });
      seg(r.x, 0, r.x, Dp);
      const winW = { master: 1.6, kid: 1.4, adult: 1.4, office: 1.4, guest: 1.4 }[r.kind] * (r.mamad ? 0.7 : 1);
      const c = r.x + r.w / 2;
      opening(top, c - winW / 2, c + winW / 2, 'window', 0.9, 2.1);
    });
    segs.forEach((sg) => sg.open.sort((a, b) => a.t0 - b.t0));

    /* ----- sanity: overlapping furniture ----- */
    const solid = [];
    items.forEach((it) => {
      if (it.type === 'rug' || it.z >= 1 || ['kitchenUpper', 'hood', 'tv', 'pendant'].includes(it.type)) return;
      solid.push(it);
      (it.parts || []).forEach((p) => solid.push(Object.assign({ id: it.id, type: it.type }, p)));
    });
    const clashes = [];
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i], b = solid[j];
        if (a.type === 'chair' && b.type === 'diningTable' || b.type === 'chair' && a.type === 'diningTable') continue;
        if (a.type === 'stool' || b.type === 'stool') continue;
        if (a.id !== b.id && overlap(a, b, -0.02)) clashes.push([a.id, b.id]);
      }
    }

    const totalArea = rooms.filter((r) => !r.outdoor).reduce((s, r) => s + r.w * r.d, 0);
    return {
      q, style, W: R(W), D: R(D), Dp: R(Dp), rooms, items, segs, checks, notes, triangle,
      kitchenShape: shape, kitchenShapeName: kShapeName, tvIn, seats, clashes,
      area: R(totalArea), wallH: WALL_H
    };
  }

  window.IH = window.IH || {};
  Object.assign(window.IH, { planHome, STYLES, normalize });
})();
