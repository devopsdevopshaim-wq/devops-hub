/* Garden planner for a private house (בית פרטי).
   Runs after the house plan: wraps the house in a yard, and lays out the front garden
   the way landscape architects zone it: a deck off the living room, outdoor dining and
   grill near the kitchen, the pool in the sunny far end with its own paving, trees at a
   distance from the water, planting beds along the boundary walls, paths and lights.
   Coordinates are the plan's (meters, y grows away from the garden front). */
(function () {
  'use strict';
  const R = (v) => Math.round(v * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.d + pad && b.y < a.y + a.d + pad;

  const GARDEN_STYLES = {
    med: { name: 'ים-תיכוני', ground: 'lawn', tree: 'oliveTree', accentTree: 'citrusTree', shrubs: ['#8e7cc3', '#c2185b', '#7a9a5a'], blurb: 'זית, הדרים, לבנדר ובוגנוויליה, אבן טבעית ומדשאה קטנה.' },
    modern: { name: 'מודרני', ground: 'lawn', tree: 'oliveTree', accentTree: 'oliveTree', shrubs: ['#6f8f5f', '#9fb59a', '#556b4a'], blurb: 'קווים ישרים, אריחי בטון גדולים, דשא מדויק ועצי זית מעוצבים.' },
    tropical: { name: 'טרופי', ground: 'lawn', tree: 'palmTree', accentTree: 'palmTree', shrubs: ['#2e7d32', '#e65100', '#43a047'], blurb: 'דקלים, עלווה גדולה וירוקה, צבעים חמים ליד הבריכה.' },
    dry: { name: 'חסכוני במים', ground: 'gravel', tree: 'oliveTree', accentTree: 'citrusTree', shrubs: ['#9e9d24', '#a1887f', '#8e7cc3'], blurb: 'חצץ וחלוקי נחל, סוקולנטים וצמחי בר, בלי מדשאה.' }
  };

  function planGarden(plan) {
    const q = plan.q;
    const gs = GARDEN_STYLES[q.gardenStyle] || GARDEN_STYLES.med;
    const W = plan.W, D = plan.D;
    const S = 2.2; // side and back strips around the house
    const yardW = W + 2 * S;
    const ringArea = 2 * S * D + yardW * S;
    const Yd = R(clamp((q.yard - ringArea) / yardW, 5, 24));
    const x0 = -S, x1 = W + S, y0 = -Yd, y1 = D + S;
    plan.yard = { x0, y0, x1, y1, Yd, S, style: q.gardenStyle, styleName: gs.name, blurb: gs.blurb, shrubColors: gs.shrubs, ground: gs.ground, area: R(yardW * (Yd + D + S) - W * D) };
    plan.bounds = { x0, y0, x1, y1 };

    const room = { id: 'r' + plan.rooms.length, kind: 'yard', name: 'החצר', x: x0, y: y0, w: R(yardW), d: Yd, frame: 'bottom', outdoor: true, yard: true };
    plan.rooms.push(room);
    let seq = 0;
    const placed = [];
    const items = plan.items;
    const add = (type, rect, extra, solid) => {
      const it = Object.assign({ id: 'g' + (seq++), type, room: room.id, x: R(rect.x), y: R(rect.y), w: R(rect.w), d: R(rect.d), face: rect.face || 'N', z: 0, h: 0.5 }, extra || {});
      items.push(it);
      if (solid !== false) placed.push(it);
      return it;
    };
    const free = (r, pad) => r.x >= x0 + 0.2 && r.x + r.w <= x1 - 0.2 && r.y >= y0 + 0.2 && r.y + r.d <= -0.05 && !placed.some((p) => overlap(r, p, pad || 0));
    const check = (ok, text) => plan.checks.push({ room: room.id, ok, text });

    // ground cover for the whole front yard (lawn or gravel), priced by the net planted area
    const living = plan.rooms.find((r) => r.kind === 'living');
    const slider = plan.slider || [living.x + 0.5, living.x + living.w - 0.5];

    // 1. deck off the living-room slider
    const deckX0 = clamp(Math.min(living.x, slider[0] - 0.6), x0 + 0.4, x1 - 4);
    const deckX1 = clamp(Math.max(living.x + living.w, slider[1] + 0.6), deckX0 + 3.5, x1 - 0.4);
    const deckD = clamp(Yd * 0.3, 2.8, 4.2);
    const deck = add('deck', { x: deckX0, y: -deckD, w: deckX1 - deckX0, d: deckD, face: 'N' }, { h: 0.12, area: R((deckX1 - deckX0) * deckD) }, false);
    if (q.pergola) add('pergola', { x: deck.x, y: deck.y, w: deck.w, d: deck.d, face: 'N' }, { h: 2.6, z: 0, area: deck.area }, false);
    // lounge on the deck facing the garden, dining next to it on the kitchen side
    const lounge = add('outdoorSofa', { x: deck.x + deck.w - 2.6, y: -deckD + 0.35, w: 2.2, d: 1.6, face: 'N' }, { h: 0.75 });
    const dinW = 2.4, dinD = 1.9;
    let dining = null;
    if (lounge.x - deck.x >= dinW + 0.3) dining = add('outdoorDining', { x: deck.x + 0.25, y: -deckD + (deckD - dinD) / 2, w: dinW, d: dinD, face: 'N' }, { h: 0.75 });
    else {
      const r = { x: deck.x - dinW - 0.5, y: -dinD - 0.5, w: dinW, d: dinD, face: 'N' };
      if (free(r, 0.2)) dining = add('outdoorDining', r, { h: 0.75 });
    }
    if (q.grill) {
      const g = { x: (dining ? Math.min(dining.x, deck.x) : deck.x) - 2.0, y: -0.75, w: 1.7, d: 0.65, face: 'N' };
      if (!free(g, 0.1)) { g.x = deck.x + deck.w + 0.4; }
      if (free(g, 0.1)) {
        add('grill', g, { h: 0.95 });
        check(true, 'גריל בפינת האוכל, צמוד לבית ובמרחק מהחלונות: הדרך מהמטבח קצרה והעשן לא נכנס לסלון.');
      }
    }
    check(true, `דק ${R(deck.w)}×${R(deck.d)} מ׳ מול יציאת הסלון: חדר מגורים נוסף בחוץ, בשיפוע 1% מהבית.`);

    // 2. pool in the far, sunny part of the yard
    let pool = null;
    const farD = Yd - deckD;
    if (q.pool) {
      let pw = 0, pl = 0, kind = '';
      if (farD >= 6.4) { pl = clamp(yardW - 6, 5, 9); pw = pl >= 7 ? 3.5 : 3.0; kind = 'בריכת שחייה'; }
      else if (farD >= 5.3) { pl = clamp(yardW - 6, 5, 8); pw = 3.0; kind = 'בריכת שחייה'; }
      else if (farD >= 4.6) { pl = clamp(yardW - 6, 3.5, 5); pw = 2.4; kind = 'בריכת טבילה'; }
      if (pw) {
        const px = R((x0 + x1) / 2 - pl / 2 + (yardW > 14 ? 1 : 0));
        const py = R(y0 + 1.1);
        const surround = add('poolDeck', { x: px - 1.2, y: py - 0.9, w: pl + 2.4, d: pw + 2.1, face: 'N' }, { h: 0.04, area: R((pl + 2.4) * (pw + 2.2) - pl * pw) }, false);
        pool = add('pool', { x: px, y: py, w: pl, d: pw, face: 'N' }, { h: 0.02, note: `${R(pl)}×${R(pw)} מ׳`, kind }, true);
        placed.push(surround);
        // two sun loungers on the house side of the pool
        for (let i = 0; i < 2; i++) {
          const r = { x: px + 0.2 + i * 0.95, y: py + pw + 0.25, w: 0.75, d: 1.9, face: 'N' };
          if (r.y + r.d < -deckD - 0.3) add('sunLounger', r, { h: 0.45 }, false);
        }
        check(true, `${kind} ${R(pl)}×${R(pw)} מ׳ בקצה החצר, בשמש רוב היום, עם שטח ריצוף מחוספס (מונע החלקה) של 1.2 מ׳ סביבה.`);
        check(q.kids === 0, q.kids ? 'יש ילדים בבית: גדר בטיחות לבריכה בגובה 1.2 מ׳ לפחות עם שער שנסגר וננעל מעצמו, וכיסוי בטיחות כשלא בשימוש.' : 'בלי ילדים קטנים גדר אינה חובה בבית פרטי, אבל כיסוי בטיחות מומלץ ומגן גם על המים.');
      } else {
        plan.notes.push('החצר קצרה מדי לבריכה (צריך כ-4.6 מ׳ עומק מעבר לדק). הגדילו את שטח החצר, או שקלו ג׳קוזי.');
      }
    }

    // 3. water: a waterfall into the pool, or a free-standing wall fountain
    if (q.water) {
      if (pool) {
        add('waterfall', { x: pool.x + pool.w - 1.6, y: pool.y - 0.75, w: 1.4, d: 0.7, face: 'S' }, { h: 1.3 });
        check(true, 'מפל מים על דופן הבריכה הרחוקה: נקודת מבט מהסלון, צליל שמסתיר רעש רחוב, ומשאבה במחזור סגור.');
      } else {
        const r = { x: x0 + 0.3, y: R(y0 + Yd * 0.35), w: 0.7, d: 1.4, face: 'E' };
        if (free(r, 0.2)) add('fountain', r, { h: 1.4 });
      }
    }

    // 4. planting beds along both side walls of the front yard
    const bedTop = y0 + 0.3, bedBottom = -deckD - 0.6;
    if (bedBottom - bedTop > 2) {
      [x0 + 0.25, x1 - 1.15].forEach((bx) => {
        const r = { x: bx, y: bedTop, w: 0.9, d: bedBottom - bedTop, face: bx < 0 ? 'E' : 'W' };
        if (free(r, 0.1)) add('planterBed', r, { h: 0.35, len: R(r.d), colors: gs.shrubs });
      });
      check(true, 'ערוגות לאורך קירות הגבול מרככות את הגדר ומסתירות אותה. צמחים חסכוניים במים על טפטוף.');
    }

    // 5. trees: a feature tree in the lawn, accent trees in the corners, at least 3 m from the pool
    const treeOk = (r) => free(r, 0.3) && (!pool || !overlap(r, pool, 3));
    // candidate spots on a 0.5 m grid, preferring the corners and the lawn's edges
    const cands = [];
    for (let tx = x0 + 1.3; tx < x1 - 1.3; tx += 0.5) {
      for (let ty = y0 + 0.4; ty < -deckD - 1.2; ty += 0.5) {
        const edge = Math.min(tx - x0, x1 - tx);
        cands.push({ tx, ty, score: -edge * 0.6 - (ty - y0) * 0.2 });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    let trees = 0;
    const got = [];
    for (const { tx, ty } of cands) {
      if (trees >= Math.min(5, 2 + Math.floor(yardW * Yd / 60))) break;
      const type = trees === 0 ? gs.tree : gs.accentTree;
      const size = type === 'oliveTree' ? 1.6 : type === 'palmTree' ? 1.4 : 1.2;
      const r = { x: tx, y: ty, w: size, d: size, face: 'N' };
      if (!treeOk(r) || got.some((g) => Math.hypot(g.x - tx, g.y - ty) < 3)) continue;
      add(type, r, { h: type === 'palmTree' ? 5.5 : type === 'oliveTree' ? 3.6 : 2.6 });
      got.push({ x: tx, y: ty });
      trees++;
    }
    if (pool) check(true, 'העצים נשתלו 3 מ׳ לפחות משפת הבריכה: פחות עלים במים, ושורשים רחוקים ממבנה הבריכה.');

    // 6. play area when there are children
    if (q.kids > 0) {
      const spots = [[x1 - 3.8, -deckD - 3.4], [x0 + 0.5, -deckD - 3.4], [x1 - 3.8, y0 + 0.5], [x0 + 0.5, y0 + 0.5]];
      for (const [px, py] of spots) {
        const r = { x: px, y: py, w: 3.2, d: 2.6, face: 'N' };
        if (free(r, 0.3) && (!pool || !overlap(r, pool, 1.5))) {
          add('playSet', r, { h: 2.2 });
          check(true, 'פינת משחק על דשא או משטח גומי בולם, בקו ראייה מהדק והסלון.');
          break;
        }
      }
    }

    // 7. stepping-stone path from the deck to the pool, with low path lights
    if (pool) {
      const px = R(clamp(pool.x + pool.w / 2 - 0.4, deck.x + 0.3, deck.x + deck.w - 1.1));
      const py0 = pool.y + pool.d + 1.25, py1 = -deckD;
      if (py1 - py0 > 0.6) {
        add('path', { x: px, y: py0, w: 0.8, d: py1 - py0, face: 'N' }, { h: 0.03, len: R(py1 - py0) }, false);
        for (let yy = py0 + 0.4; yy < py1 - 0.3; yy += 2.2) add('gardenLight', { x: px - 0.45, y: yy, w: 0.2, d: 0.2, face: 'E' }, { h: 0.6 }, false);
      }
    }
    // entrance path along the side of the house to the front door
    add('path', { x: x0 + 0.4, y: -0.2, w: 1.0, d: D * 0.6, face: 'N' }, { h: 0.03, len: R(D * 0.6), side: true }, false);

    // 8. ground cover and irrigation
    const hard = items.filter((it) => it.room === room.id && ['deck', 'poolDeck', 'pool', 'planterBed', 'path'].includes(it.type)).reduce((s, it) => s + (it.area || it.w * it.d), 0);
    const groundArea = R(Math.max(0, yardW * Yd - hard));
    items.splice(items.findIndex((it) => it.room === room.id), 0,
      Object.assign({ id: 'g' + (seq++), type: gs.ground, room: room.id, x: x0, y: y0, w: R(yardW), d: Yd, face: 'N', z: 0, h: 0.01, area: groundArea }));
    add('irrigation', { x: x0 + 0.3, y: -0.35, w: 0.3, d: 0.15, face: 'N' }, { h: 0.3, z: 0.9 }, false);
    check(true, gs.ground === 'lawn'
      ? `מדשאה של כ-${Math.round(groundArea)} מ״ר: דשא טבעי צריך 6 שעות שמש; דשא סינטטי חוסך מים והשקיה.`
      : `חצץ וחלוקים על כ-${Math.round(groundArea)} מ״ר במקום מדשאה: חוסך עד 70% מים.`);

    // walls around the plot (not priced; used by the drawing and the 3D walk)
    plan.yard.walls = [
      { x1: x0, y1: y0, x2: x1, y2: y0 }, { x1: x0, y1: y0, x2: x0, y2: y1 },
      { x1: x1, y1: y0, x2: x1, y2: y1 }, { x1: x0, y1: y1, x2: x1, y2: y1 }
    ];
  }

  window.IH = window.IH || {};
  Object.assign(window.IH, { planGarden, GARDEN_STYLES });
})();
