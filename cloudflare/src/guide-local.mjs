// Maya's answer when no AI key works: still a real answer, built from the site's own knowledge (projects, services, prices) instead of "I could not answer".
const WA = '054-497-9771';
const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ"'׳״.,!?():;\-–—_/\\]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('של את עם על אני אתה את הוא היא זה זאת יש אין לי לך מה איך למה מי כמה האם או גם כל אבל רק לא כן אפשר רוצה רוצים צריך צריכה שלי שלך בבקשה היי שלום'.split(' '));
// Hebrew prefixes (ה ו ב ל מ ש כ) so "לשווק" and "שיווק" meet "marketing"-like words
const stem = (w) => w.replace(/^(וה|ול|וב|ומ|מה|שה|כש|ה|ו|ב|ל|מ|ש|כ)(?=.{3,})/, '');
const words = (q) => norm(q).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

export function localGuide(K, S, question, page) {
  const q = norm(question), W = words(question);
  const projects = (K && K.projects) || [], services = (S && S.services) || [], offers = (S && S.offers) || [];
  const has = (...xs) => xs.some((x) => q.includes(x));
  const next = [];
  const money = (n) => Number(n).toLocaleString('he-IL') + ' ₪';

  if (!W.length || has('שלום', 'היי', 'הי ', 'בוקר טוב', 'ערב טוב') && W.length < 2) {
    return { answer: 'היי, אני מאיה, העוזרת של חיים קריספין. אפשר לשאול אותי על כל פרויקט באתר, על שירותים ומחירים, או לקבוע שיחה עם חיים. מה מעניין אותך?', next: ['איזה שירותים יש לכם?', 'מה אפשר לבנות לעסק שלי?'] };
  }

  if (has('מחיר', 'עולה', 'עלות', 'כמה', 'תשלום', 'הצעה', 'שירות', 'לעסק', 'עסק', 'שיווק', 'לשווק', 'לבנות', 'לבנות לי', 'פרויקט שלי', 'אתר ל', 'אוטומציה ל')) {
    const list = services.slice(0, 5).map((s) => `${s.title}${s.from ? ' (מ־' + money(s.from) + (s.unit ? ' ' + s.unit : '') + ')' : ''}`);
    const offer = offers[0] ? ` יש גם ${offers[0].title}.` : '';
    if (list.length) {
      const pitch = /שיווק|לשווק|עצמי|סמך/.test(q) ? 'כדי לשווק את העסק בצורה חכמה בדרך כלל מתחילים מדף נחיתה מעוצב וממערכת שמקבלת כל פנייה ישר לוואטסאפ ולמייל, ואז מוסיפים אוטומציה ועוזר AI שעונה ללקוחות. ' : '';
      return { answer: `${pitch}השירותים של חיים: ${list.join('; ')}.${offer} הכי טוב לקבוע שיחת אפיון קצרה וחינמית, חיים יגיד לך בדיוק מה מתאים ובכמה. וואטסאפ וטלפון: ${WA}. מה העסק שלך עושה?`, next: ['איך נראית שיחת אפיון?', 'אילו פרויקטים כבר נבנו?'], project: null };
    }
  }

  // projects: score by words in title, description, features, tech
  const scored = projects.map((p) => {
    const hay = norm([p.title, p.desc, (p.features || []).join(' '), (p.tech || []).join(' '), p.story, p.field].join(' '));
    let sc = 0;
    for (const w of W) if (hay.includes(w)) sc += norm(p.title).includes(w) ? 4 : 1;
    if (page && p.id === page) sc += 3;
    return { p, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  if (scored.length) {
    const top = scored[0].p;
    const sent = String(top.desc || '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    const feats = (top.features || []).slice(0, 3).join(', ');
    const more = scored.slice(1, 3).map((x) => x.p.title);
    const a = `הכי קרוב למה ששאלת זה "${top.title}". ${sent}${feats ? ' מה יש בו: ' + feats + '.' : ''}${more.length ? ' יש גם ' + more.join(' ו־') + '.' : ''} רוצה שאראה לך אותו?`;
    return { answer: a, project: top.id, next: more.length ? ['ספרי לי על ' + more[0]] : ['איזה שירותים יש לכם?'] };
  }
  if (has('חיים', 'מי אתה', 'מי את', 'מי זה', 'מי הוא')) return { answer: 'חיים קריספין בונה אתרים, מערכות אוטומציה וסוכני AI לעסקים, והאתר הזה מציג את הפרויקטים שלו. אני העוזרת הדיגיטלית שלו. אפשר לדבר איתו ישירות בוואטסאפ: ' + WA + '. מה היית רוצה לבנות?', next: ['איזה שירותים יש לכם?'] };
  const titles = projects.filter((p) => p.featured).slice(0, 3).map((p) => p.title);
  return { answer: `לא מצאתי תשובה מדויקת לזה, ואני לא רוצה לנחש. אפשר לשאול אותי על פרויקט מסוים${titles.length ? ' (למשל ' + titles.join(', ') + ')' : ''}, על שירותים ומחירים, או לדבר עם חיים בוואטסאפ: ${WA}.`, next: ['איזה שירותים יש לכם?'] };
}
