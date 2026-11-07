// The engines that work with no AI at all. When the AI is off, out of quota or unreachable, each site still answers:
// the same sections as the AI's plan, computed here from the numbers the person entered.
// (module.exports: health, finance, marketing, aia). Everything is educational, never medical or financial advice.

const n0 = (v) => { const x = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return Number.isFinite(x) ? x : 0; };
const fmt = (x) => Math.round(x).toLocaleString('he-IL');
const has = (arr, re) => (arr || []).some((x) => re.test(x));

// ======================================================================= health
function health(d) {
  d = d || {};
  const age = n0(d.age), h = n0(d.height), w = n0(d.weight), waist = n0(d.waist), goal = n0(d.goalWeight);
  const male = d.sex === 'male', female = d.sex === 'female';
  const L = [];
  const bmi = h > 100 && w > 20 ? w / Math.pow(h / 100, 2) : 0;
  const cls = !bmi ? '' : bmi < 18.5 ? 'תת־משקל' : bmi < 25 ? 'משקל תקין' : bmi < 30 ? 'עודף משקל' : bmi < 35 ? 'השמנה דרגה 1' : bmi < 40 ? 'השמנה דרגה 2' : 'השמנה דרגה 3';
  const wr = !waist ? '' : male ? (waist >= 102 ? 'סיכון גבוה' : waist >= 94 ? 'סיכון מוגבר' : 'בטווח') : (waist >= 88 ? 'סיכון גבוה' : waist >= 80 ? 'סיכון מוגבר' : 'בטווח');
  const concern = d.concern || [], cond = d.condition || [], flags = d.flags || [];

  L.push('**1. תמונת מצב**');
  if (bmi) L.push(`- BMI ${bmi.toFixed(1)} · ${cls}.` + (waist ? ` היקף מותן ${waist} ס״מ · ${wr}.` : ''));
  else L.push('- חסרים גובה ומשקל, ולכן אי אפשר לחשב BMI. כדאי להשלים בשלב "איסוף נתונים".');
  if (concern.length) L.push(`- מה מטריד: ${concern.join(', ')}.`);
  if (cond.length && !cond.includes('אין')) L.push(`- רקע: ${cond.join(', ')}.`);
  if (d.sleep) L.push(`- שינה: ${d.sleep} שעות. ${n0(d.sleep) < 7 ? 'פחות מהמומלץ (7 עד 9), וזה משפיע על תיאבון ועל משקל.' : 'בטווח הטוב.'}`);
  if (d.stress === 'גבוהה') L.push('- מתח גבוה: משפיע על תיאבון, שינה ועיכול.');

  L.push('', '**2. דגלים אדומים**');
  if (flags.length) {
    L.push('סימנת סימנים שמצריכים בירור רפואי לפני תוכנית עצמאית:');
    flags.forEach((f) => L.push('- ' + f));
    L.push('**מומלץ לפנות לרופא/ה משפחה (או למיון אם הסימן חריף) לפני שמתחילים דיאטה.** התוכנית למטה היא כללית ואינה תחליף לבירור.');
  } else L.push('לא סומנו דגלים אדומים. עדיין, אם יופיעו דם בצואה, ירידה לא מוסברת במשקל, כאב חמור או הקאות מתמשכות, יש לפנות לרופא/ה.');

  L.push('', '**3. תזונה**');
  let tdee = 0, target = 0;
  if (h > 100 && w > 20 && age > 10) {
    const bmr = 10 * w + 6.25 * h - 5 * age + (male ? 5 : female ? -161 : -78);
    const aero = n0(d.aerobic), steps = n0(d.steps);
    const af = (steps >= 10000 || aero >= 300) ? 1.55 : (aero >= 150 || steps >= 7000) ? 1.45 : aero >= 60 ? 1.35 : 1.25;
    tdee = bmr * af;
    const floor = female ? 1200 : male ? 1500 : 1350;
    target = Math.max(floor, tdee - 500);
    const refW = goal > 0 ? goal : (bmi > 27 ? 25 * Math.pow(h / 100, 2) : w);
    const pLo = Math.round(refW * 1.2), pHi = Math.round(refW * 1.6);
    const fat = Math.round(target * 0.28 / 9), carb = Math.round((target - pHi * 4 - fat * 9) / 4);
    L.push(`- הוצאה יומית משוערת: ~${fmt(tdee)} קק״ל. יעד לירידה איטית ובת־קיימא (גירעון ~500): **~${fmt(target)} קק״ל ליום**, כחצי ק״ג בשבוע.`);
    L.push(`- חלבון ${pLo} עד ${pHi} גרם ליום, שומן ~${fat} גרם, והשאר פחמימות (~${Math.max(carb, 80)} גרם), עם 25 עד 30 גרם סיבים.`);
    if (goal && w > goal) L.push(`- עד משקל היעד (${goal} ק״ג) נשארו ${(w - goal).toFixed(1)} ק״ג: בערך ${Math.ceil((w - goal) / 0.5)} שבועות בקצב הזה.`);
  } else L.push('- כדי לחשב יעד קלורי צריך גיל, מין, גובה ומשקל.');
  L.push('- להפחית קודם: משקאות ממותקים, אלכוהול, סוכר ופחמימות מזוקקות. בסיס ים־תיכוני: ירקות, קטניות, דגנים מלאים, דגים, שמן זית.');
  if (d.window) L.push(`- חלון האכילה שלך (${d.window}): אפשר להתייצב על 10 עד 12 שעות, בלי להקפיד על צום ארוך.`);
  if (d.upf === 'הרבה / רוב הארוחות') L.push('- מזון אולטרה־מעובד ברוב הארוחות: זה השינוי הגדול ביותר. להחליף ארוחה אחת ביום במזון מלא בשבוע הראשון.');
  if (d.drinks === 'יומי') L.push('- משקאות ממותקים/אלכוהול יומיים: להפחית בהדרגה, כי זה מקור קלוריות שקט.');
  L.push('- דוגמת יום: **בוקר** יוגורט/קוטג׳ עם פרי ושקדים · **צהריים** צלחת: חצי ירקות, רבע חלבון (דג/עוף/קטניות), רבע דגנים מלאים · **ערב** ביצים או טופו עם סלט ושמן זית · **נשנוש** פרי או חופן אגוזים.');

  L.push('', '**4. פעילות גופנית (4 שבועות)**');
  const lowImpact = /ברך|גב|דיסק|פריקה|מפרק|כאב/.test(String(d.limits || '') + String(d.history || ''));
  const aero0 = n0(d.aerobic), str0 = n0(d.strength);
  const w1 = Math.max(90, Math.round(aero0 * 1.1 / 5) * 5 || 120);
  L.push(`- שבוע 1: ${w1} דקות אירובי מתון (${lowImpact ? 'הליכה, אופניים, שחייה, בלי קפיצות' : 'הליכה מהירה, אופניים או שחייה'}) ו־${Math.max(2, str0)} ימי כוח בגוף מלא.`);
  L.push(`- שבוע 2: ${Math.round(w1 * 1.1 / 5) * 5} דקות · שבוע 3: ${Math.round(w1 * 1.21 / 5) * 5} דקות · שבוע 4: ${Math.round(w1 * 1.33 / 5) * 5} דקות. תוספת של כ־10% בשבוע.`);
  L.push('- כוח (45 דק׳, פעמיים–שלוש בשבוע): סקווט/כיסא, חתירה, שכיבות סמיכה על הקיר או הברכיים, גשר ישבן, פלנק. 3 סטים של 8 עד 12 חזרות.');
  L.push(`- צעדים: ${n0(d.steps) >= 7000 ? 'להגיע ל־10,000' : 'יעד 7,000 בשבוע 1 עד 2 ואז 8,500 עד 10,000'}. 10 עד 15 דקות הליכה אחרי כל ארוחה עיקרית מורידות סוכר ועוזרות לעיכול.`);

  L.push('', '**5. נפיחות ועיכול**');
  const gut = concern.filter((c) => /נפיחות|גזים|מלאות|עצירות|שלשולים|צרבת|כאבי בטן|בצקת/.test(c));
  if (!gut.length) L.push('לא סומנו תסמיני עיכול, ולכן אין המלצות ממוקדות כאן.');
  else {
    L.push('- ארוחות קבועות ולא גדולות, אכילה לאט, פחות משקאות מוגזים, מסטיק וקשיות.');
    if (has(gut, /נפיחות|גזים|מלאות|כאבי בטן/)) L.push('- נפיחות וגזים הם בדרך כלל תפקודיים. קו ראשון מקובל: דיאטת FODMAP נמוכה בשלושה שלבים (הפחתה, החזרה, התאמה), רצוי בליווי דיאטנית. אפשר לנסות שמן מנטה, והליכה אחרי ארוחה.');
    if (has(gut, /עצירות/)) L.push('- עצירות: סיבים 25 עד 30 גרם, מים, ותנועה. טיפול בעצירות משפר מאוד את הנפיחות.');
    if (has(gut, /שלשולים/)) L.push('- שלשולים מתמשכים: כדאי בירור (כולל צליאק) לפני שינוי תזונתי רחב.');
    if (has(gut, /צרבת/)) L.push('- צרבת: ארוחות קטנות, ארוחה אחרונה 3 שעות לפני השינה, והפחתת אלכוהול וקפה.');
    if (has(gut, /בצקת/)) L.push('- בצקת: אם היא אסימטרית, חדשה או מלווה בקוצר נשימה, יש לבדוק לב, כליה, כבד וורידים. להפחית מלח.');
    L.push('- אם הנפיחות מהירה, מתמשכת ומלווה בתחושת שובע מוקדמת, חשוב לבדוק אצל רופא/ה (בנשים גם הערכה גינקולוגית).');
  }

  L.push('', '**6. גורמים נוספים**');
  L.push('- שינה 7 עד 9 שעות, ניהול מתח (הליכה, נשימות, שגרה), הפחתת אלכוהול.');
  if (d.meds) L.push(`- תרופות שציינת (${d.meds}): כדאי לבדוק עם הרופא/ה אם אחת מהן מעלה משקל או גורמת לבצקת. אין להפסיק תרופה בלי ייעוץ.`);
  if (cond.length && !cond.includes('אין')) L.push('- יש לך רקע רפואי: כדאי לתאם את התוכנית עם הרופא/ה המטפל/ת.');
  L.push('- בדיקות שכדאי לשקול עם רופא/ה: ספירת דם, סוכר וHbA1c, שומני דם, תפקודי בלוטת התריס, ברזל וויטמין D.');
  if (bmi >= 30 || (bmi >= 27 && cond.length && !cond.includes('אין'))) L.push('- ב־BMI כזה, ובמיוחד עם מחלה נלווית, יש טיפולים נוספים במרשם ובמעקב רפואי. כדאי לשוחח על כך עם הרופא/ה.');

  L.push('', '**7. מעקב (4 עד 8 שבועות)**');
  L.push('- שקילה פעם בשבוע באותו תנאי, מדידת היקף מותן פעם בשבועיים, ויומן קצר של תסמינים.');
  L.push('- יעדים: ירידה של רבע עד שלושה רבעי ק״ג בשבוע, 150+ דקות פעילות, שני ימי כוח, ושיפור בתסמינים. אם אין שינוי אחרי 4 שבועות, מעדכנים את התוכנית.');
  L.push('', '**8. סייג**', 'זו תוכנית כללית שחושבה מהנתונים שהזנת, בלי AI, ואינה המלצה רפואית ואינה מחליפה רופא/ה או דיאטנית.');
  return { ok: true, text: L.join('\n'), source: 'חישוב מקומי (בלי AI)' };
}

// ======================================================================= finance
function finance(d, m) {
  d = d || {};
  const L = [], inc = m.income, mo = (v) => fmt(v) + ' ₪';
  L.push('**1. תמונת מצב**');
  if (!inc) L.push('- כדי לבנות תוכנית צריך לפחות הכנסה חודשית נטו.');
  else {
    L.push(`- הכנסה ${mo(inc)} · הוצאות ${mo(m.totalOut)} · ${m.surplus >= 0 ? 'עודף' : 'גירעון'} חודשי ${mo(Math.abs(m.surplus))}.`);
    if (m.savingsRate != null) L.push(`- שיעור חיסכון ${m.savingsRate}% (היעד 15 עד 20%).`);
    if (m.emergencyMonths != null) L.push(`- קרן חירום: ${m.emergencyMonths} חודשי הוצאות (היעד 3 עד 6, כלומר ~${mo(m.emergencyTarget)}).`);
    if (m.dti != null) L.push(`- יחס חוב להכנסה: ${m.dti}% (בריא עד 36%).`);
    L.push(`- שווי נקי משוער: ${mo(m.netWorth)}.`);
  }
  if (m.flags && m.flags.length) m.flags.forEach((f) => L.push('- ⚠️ ' + f.text));

  L.push('', '**2. סדר עדיפויות**');
  const steps = [];
  if (m.surplus < 0) steps.push(`לסגור את הגירעון: לקצץ ${mo(-m.surplus)} בחודש, קודם מההוצאות המשתנות (${mo(n0(d.variableExpenses))} כיום).`);
  if (n0(d.expensiveDebt) > 0) steps.push(`לכסות חוב יקר (${mo(n0(d.expensiveDebt))}${n0(d.expensiveDebtRate) ? ` בריבית ~${n0(d.expensiveDebtRate)}%` : ''}) לפני חיסכון ארוך־טווח.`);
  if (m.emergencyMonths != null && m.emergencyMonths < 3) steps.push(`להקים קרן חירום של 3 חודשי הוצאות (${mo(m.emergencyTarget * 0.75)}) בפיקדון נזיל.`);
  steps.push('להפקיד אוטומטית בתחילת כל חודש, לפני ההוצאות.');
  if (m.savingsRate != null && m.savingsRate < 15) steps.push('להעלות את שיעור החיסכון בהדרגה ב־1 עד 2 נקודות אחוז כל רבעון, עד 15 עד 20%.');
  steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));

  L.push('', '**3. תקציב מוצע (50/30/20)**');
  if (inc) {
    L.push(`- צרכים (50%): ${mo(inc * 0.5)} · רצונות (30%): ${mo(inc * 0.3)} · חיסכון והחזר חוב (20%): ${mo(inc * 0.2)}.`);
    const needs = n0(d.fixedExpenses) + n0(d.mortgagePayment) + n0(d.otherDebtPayment);
    L.push(`- אצלך כרגע: צרכים ${mo(needs)} (${Math.round(needs / inc * 100)}%), רצונות ${mo(n0(d.variableExpenses))} (${Math.round(n0(d.variableExpenses) / inc * 100)}%).`);
    if (needs / inc > 0.55) L.push('- הצרכים מעל 50%: כדאי לבדוק ביטוחים, מנויים, חשמל ותקשורת, ולהתמקח על הקבועות.');
  }

  L.push('', '**4. חוב**');
  const B = n0(d.expensiveDebt), r = n0(d.expensiveDebtRate) / 1200;
  if (B > 0) {
    const pay = Math.max(0, m.surplus) + n0(d.monthlySavings) * 0;
    if (pay > B * r) {
      const months = r > 0 ? Math.ceil(-Math.log(1 - r * B / pay) / Math.log(1 + r)) : Math.ceil(B / pay);
      L.push(`- שיטת "מפולת": קודם החוב עם הריבית הגבוהה ביותר. אם תפנה ${mo(pay)} בחודש, החוב ייסגר בערך תוך ${months} חודשים.`);
    } else L.push('- התשלום החודשי הפנוי נמוך מהריבית. כדאי לשקול איחוד הלוואות או משא ומתן עם הבנק, ולהקטין הוצאות.');
    L.push('- לא ליטול חוב חדש בזמן ההחזר.');
  } else L.push('- אין חוב יקר. מצוין. הלוואות בריבית נמוכה (משכנתא, רכב) פחות דחופות.');

  L.push('', '**5. קרן חירום**');
  if (m.emergencyTarget) {
    const need = Math.max(0, m.emergencyTarget - n0(d.cashSavings)), per = Math.max(m.savings, 1);
    L.push(`- יעד ~${mo(m.emergencyTarget)}. חסרים ${mo(need)}.`);
    if (need > 0) L.push(`- בהפקדה של ${mo(per)} בחודש, תגיע לזה בעוד ~${Math.ceil(need / per)} חודשים.`);
  }
  L.push('', '**6. חיסכון ארוך־טווח**', '- אחרי קרן חירום וחוב יקר: הפקדה קבועה, מפוזרת ובעלות נמוכה, באופק של שנים. אין כאן המלצה על מוצר.');
  L.push('', '**7. מעקב**', '- פעם בחודש: הכנסות מול הוצאות, יתרת חוב, קרן חירום ושיעור חיסכון. לעדכן את התוכנית ברבעון.');
  L.push('', '**8. סייג**', 'חישוב מקומי חינוכי בלבד, בלי AI. אינו ייעוץ השקעות או פנסיה ואינו תחליף ליועץ מורשה.');
  return { ok: true, plan: L.join('\n'), source: 'חישוב מקומי (בלי AI)' };
}

// ======================================================================= marketing
function marketing(b) {
  b = b || {};
  const biz = String(b.business || '').trim(), offer = String(b.offer || '').trim().replace(/\s+/g, ' ');
  const tone = String(b.tone || '').trim();
  const goal = b.goal || 'sale', plat = b.platform || 'facebook';
  const industry = String(b.industry || '').trim(), aud = String(b.audience || '').trim();
  const short = offer.length > 70 ? offer.slice(0, 70).replace(/\s+\S*$/, '') + '…' : offer;
  const H = {
    launch: [`הכירו: ${short}`, `${biz} משיק, ואתם הראשונים לדעת`, `חדש אצל ${biz}: ${short}`, `זה מה שחיכיתם לו`, `השקה שלא רוצים לפספס`],
    sale: [`${short}: רק לזמן מוגבל`, `מבצע אצל ${biz}, כל עוד המלאי קיים`, `למה לשלם יותר? ${short}`, `ההזדמנות שלכם מתחילה כאן`, `${biz}: המבצע שמדברים עליו`],
    awareness: [`${biz}: כך עושים את זה נכון`, `מי אנחנו, ולמה לקוחות חוזרים`, `${short}, בדרך שלנו`, `האיכות שמרגישים מהרגע הראשון`, `גם אתם תתאהבו ב־${biz}`],
    event: [`מזמינים אתכם: ${short}`, `${biz} מארח, ואתם מוזמנים`, `שמרו את התאריך`, `אירוע שלא רוצים להחמיץ`, `נתראה אצלנו, ${biz}`],
    loyalty: [`תודה שאתם איתנו, ${biz}`, `מתנה קטנה ללקוחות שלנו: ${short}`, `כי אתם חשובים לנו`, `הטבה בלעדית ללקוחות ${biz}`, `חוזרים אלינו? יש מה לחגוג`]
  }[goal] || [];
  const ctaBy = {
    facebook: ['שלחו הודעה', 'לפרטים והזמנות', 'הירשמו עכשיו', 'שתפו עם חבר/ה'],
    instagram: ['קישור בביו', 'שלחו DM', 'שמרו לפוסט', 'תייגו מישהו/י'],
    google: ['לפרטים נוספים', 'קבלו הצעת מחיר', 'התקשרו עכשיו', 'הזמינו אונליין'],
    whatsapp: ['שלחו "מעוניין/ת"', 'לחצו לשיחה', 'הזמינו בווטסאפ', 'ספרו לחברים'],
    flyer: ['התקשרו להזמנה', 'סרקו את הקוד', 'הציגו את הפלייר וקבלו הטבה', 'בואו לבקר'],
    email: ['לחצו להזמנה', 'למימוש ההטבה', 'לפרטים המלאים', 'ענו למייל הזה']
  }[plat] || ['לפרטים', 'צרו קשר', 'הזמינו עכשיו', 'שתפו'];
  const toneLine = tone ? ` (בטון ${tone})` : '';
  const bodyShort = `${biz}: ${offer}. ${ctaBy[0]}!`;
  const bodyMedium = `${H[0]}\n\n${offer}. ב־${biz} אנחנו עושים את זה עם תשומת לב לפרטים, ובשירות שמרגיש אישי${toneLine}.\n\n${ctaBy[1]}, או ${ctaBy[0].replace(/^./, (c) => c)}.`;
  const bodyLong = `שלום,\n\nרצינו לשתף אתכם במשהו חדש ב־${biz}: ${offer}.\n\nלמה זה שווה את הזמן שלכם? כי ${industry ? 'בתחום ' + industry + ' ' : ''}ההבדל נמצא בפרטים: שירות אישי, אמינות, ותוצאה שאפשר לסמוך עליה.\n\nמה עושים עכשיו? ${ctaBy[1]}, ואנחנו נחזור אליכם בהקדם.\n\nבברכה,\nצוות ${biz}`;
  const clean = (s) => String(s || '').replace(/[^֐-׿a-zA-Z0-9]/g, '');
  const tags = ['#' + clean(biz), industry && '#' + clean(industry), '#ישראל', '#עסקיםקטנים', '#קנוישראלי', '#מבצע', '#שירותאישי', '#SmallBusiness', '#Israel'].filter((x) => x && x.length > 2);
  const styleEn = { launch: 'a bright, optimistic launch scene with soft sunrise light', sale: 'bold promotional composition with energetic colors', awareness: 'warm lifestyle photography with natural light', event: 'festive evening atmosphere with warm bokeh lights', loyalty: 'friendly, heartfelt scene with a gift and warm tones' }[goal] || 'clean premium commercial photography';
  return {
    headlines: H, bodyShort, bodyMedium, bodyLong, cta: ctaBy, hashtags: tags.join(' '),
    audience: aud || `לקוחות באזור שמחפשים ${industry || 'שירות איכותי'} ואכפת להם מאיכות ומשירות אישי.`,
    imageBrief: `תמונה נקייה ומזמינה שמציגה את ${offer}, עם הרבה אור טבעי, צבעים חמים והרבה מקום לטקסט. אפשר להוסיף את הלוגו של ${biz} בפינה.`,
    imagePrompt: `Premium commercial photograph for a small business ad: ${offer}. ${styleEn}, shallow depth of field, soft natural light, rich warm colors, space for text on one side, 4k, no text, no watermark`,
    source: 'תבנית מקומית (בלי AI)'
  };
}

// ======================================================================= AIA studio
function aia(brief, assets) {
  brief = brief || {};
  const dur = Number(brief.duration) || 8;
  const title = brief.title || 'חבילת הפקה';
  const style = brief.style || 'קולנועי';
  const mood = brief.mood || 'מרשים';
  const aspect = brief.aspect || '16:9';
  const text = String(brief.text || brief.title || '').trim();
  const TYPE = { animation: 'אנימציה קצרה', video: 'סרטון קצר', images: 'סדרת תמונות סטילס', logo_reveal: 'לוגו רוול' }[brief.type] || 'סרטון קצר';
  const PAL = [
    [/כהה|דרמט|מסתור|לילה/, ['#0b0b14', '#2a2d4a', '#c8a15a', '#8a1c2b']],
    [/שמח|חג|צבע|עליז/, ['#ffd166', '#ef476f', '#06d6a0', '#118ab2']],
    [/רגוע|טבע|שלו/, ['#e9f1e4', '#9fc5a0', '#3d6b5a', '#c9a96e']],
    [/יוקר|זהב|מרשים/, ['#0c0a09', '#d4af37', '#f5efe0', '#6b4a2a']]
  ];
  const palette = (PAL.find(([re]) => re.test(mood + ' ' + style)) || [0, ['#0f172a', '#38bdf8', '#f1f5f9', '#f59e0b']])[1];
  const concept = `${TYPE} באורך ${dur} שניות ביחס ${aspect}, בסגנון ${style} ובאווירה ${mood}. ${text ? 'הסצנה: ' + text + '. ' : ''}` +
    `הפתיחה בפריים רחב שמציג את המקום והאור, ואז מצלמה שמתקרבת לפרט המרכזי, עם תנועה איטית ואחידה. ` +
    `באמצע יש רגע שיא ויזואלי ברור, ובסיום חוזרים לפריים רחב נקי, עם מקום לכותרת. ` +
    `${(assets || []).length ? 'תמונות הייחוס משמשות כעוגן לדמויות, לצבעים ולסגנון. ' : ''}האווירה הכללית: ${mood}.`;
  const en = text || title;
  const imagePrompts = [
    `${style} wide establishing shot, ${en}, ${mood} mood, cinematic lighting, rich color grading, ${aspect} frame, ultra detailed, 8k`,
    `${style} medium shot focusing on the main subject of: ${en}, shallow depth of field, soft rim light, film grain, ${aspect}`,
    `${style} close-up detail shot, ${en}, macro texture, dramatic contrast, ${mood} atmosphere, ${aspect}`,
    `${style} final hero frame, ${en}, balanced composition with clean negative space for the title, golden hour light, ${aspect}`
  ];
  const t = [0.3, 0.3, 0.25, 0.15].map((x) => Math.max(1, Math.round(dur * x)));
  const storyboard = [
    { shot: 1, description: 'פתיחה: פריים רחב שמציג את המקום והאור', camera: 'רחב (24mm)', motion: 'פאן איטי', seconds: t[0] },
    { shot: 2, description: 'התקרבות לנושא המרכזי', camera: 'בינוני (50mm)', motion: 'דוליי פנימה', seconds: t[1] },
    { shot: 3, description: 'רגע השיא: פרט מרשים בקלוז־אפ', camera: 'קלוז־אפ (85mm)', motion: 'תנועה עדינה בעקבות הנושא', seconds: t[2] },
    { shot: 4, description: 'סיום: חזרה לפריים נקי עם מקום לכותרת', camera: 'רחב', motion: 'התרחקות איטית', seconds: t[3] }
  ];
  const vp = `A ${style} ${TYPE === 'סרטון קצר' ? 'short film' : 'animated sequence'} of ${en}, ${mood} mood, slow smooth camera push-in, cinematic lighting, ${aspect}, ${dur} seconds, high detail, natural motion`;
  return {
    title, concept, imagePrompts, storyboard,
    videoPrompts: [{ engine: 'Seedance', prompt: vp }, { engine: 'Runway Gen-3', prompt: vp + ', consistent subject, stable camera' }, { engine: 'Kling', prompt: vp + ', realistic physics' }],
    styleNotes: { palette, lighting: 'אור רך מכוון מהצד עם תאורת קצה עדינה', keywords: [style, mood, 'קולנועי', 'פירוט גבוה'], negative: 'טקסט על המסך, סימני מים, ידיים מעוותות, פנים מעוותות' },
    durationSec: dur
  };
}

module.exports = { health, finance, marketing, aia };
