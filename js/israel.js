/* ===========================================================
   ישראל: יישובים לניווט, קווי אוטובוס ורכבת בין ערים
   קווי האוטובוס נבדקו מול Moovit, אגד ואתרי מידע (2026).
   קווים ולוחות זמנים משתנים — יש לאמת ב-Moovit או באתר המפעיל לפני נסיעה.
   =========================================================== */

window.APP_IL = {
  regions: [
    ['north', 'גליל, גולן ועמקים'],
    ['haifa', 'חיפה, הכרמל והשרון הצפוני'],
    ['center', 'תל אביב, המרכז והשפלה'],
    ['jerusalem', 'ירושלים והסביבה'],
    ['deadsea', 'ים המלח ומדבר יהודה'],
    ['negev', 'הנגב ומצפה רמון'],
    ['eilat', 'אילת והערבה']
  ],

  /* id, שם, קואורדינטות, אזור, תחנת רכבת (true/false), יעד באתר (אם יש) */
  places: [
    { id: 'tlv', name: 'תל אביב', c: [32.0853, 34.7818], r: 'center', rail: true, dest: 'telaviv' },
    { id: 'jlm', name: 'ירושלים', c: [31.7683, 35.2137], r: 'jerusalem', rail: true, dest: 'jerusalem' },
    { id: 'haifa', name: 'חיפה', c: [32.7940, 34.9896], r: 'haifa', rail: true, dest: 'haifa' },
    { id: 'eilat', name: 'אילת', c: [29.5577, 34.9519], r: 'eilat', dest: 'eilat' },
    { id: 'tlvairport', name: 'נתב״ג', c: [32.0055, 34.8854], r: 'center', rail: true },
    { id: 'herzliya', name: 'הרצליה', c: [32.1624, 34.8447], r: 'center', rail: true },
    { id: 'netanya', name: 'נתניה', c: [32.3215, 34.8532], r: 'center', rail: true },
    { id: 'petahtikva', name: 'פתח תקווה', c: [32.0870, 34.8870], r: 'center', rail: true },
    { id: 'rishon', name: 'ראשון לציון', c: [31.9730, 34.7925], r: 'center', rail: true },
    { id: 'rehovot', name: 'רחובות', c: [31.8940, 34.8110], r: 'center', rail: true },
    { id: 'modiin', name: 'מודיעין', c: [31.8980, 35.0100], r: 'center', rail: true },
    { id: 'ashdod', name: 'אשדוד', c: [31.8040, 34.6550], r: 'center', rail: true },
    { id: 'ashkelon', name: 'אשקלון', c: [31.6688, 34.5743], r: 'center', rail: true },
    { id: 'hadera', name: 'חדרה', c: [32.4340, 34.9190], r: 'haifa', rail: true },
    { id: 'caesarea', name: 'קיסריה', c: [32.5000, 34.8920], r: 'haifa' },
    { id: 'zichron', name: 'זכרון יעקב', c: [32.5700, 34.9540], r: 'haifa' },
    { id: 'yokneam', name: 'יקנעם', c: [32.6590, 35.1100], r: 'haifa', rail: true },
    { id: 'akko', name: 'עכו', c: [32.9281, 35.0818], r: 'north', rail: true },
    { id: 'nahariya', name: 'נהריה', c: [33.0059, 35.0941], r: 'north', rail: true },
    { id: 'karmiel', name: 'כרמיאל', c: [32.9190, 35.2950], r: 'north', rail: true },
    { id: 'nazareth', name: 'נצרת', c: [32.6996, 35.3035], r: 'north' },
    { id: 'afula', name: 'עפולה', c: [32.6100, 35.2900], r: 'north', rail: true },
    { id: 'beitshean', name: 'בית שאן', c: [32.4970, 35.4960], r: 'north', rail: true },
    { id: 'tiberias', name: 'טבריה', c: [32.7959, 35.5300], r: 'north', dest: 'galilee' },
    { id: 'eingev', name: 'עין גב', c: [32.7820, 35.6420], r: 'north' },
    { id: 'safed', name: 'צפת', c: [32.9646, 35.4960], r: 'north' },
    { id: 'roshpina', name: 'ראש פינה', c: [32.9690, 35.5420], r: 'north' },
    { id: 'kiryatshmona', name: 'קריית שמונה', c: [33.2073, 35.5700], r: 'north' },
    { id: 'metula', name: 'מטולה', c: [33.2780, 35.5780], r: 'north' },
    { id: 'katzrin', name: 'קצרין', c: [32.9900, 35.6900], r: 'north' },
    { id: 'majdalshams', name: 'מג׳דל שמס (החרמון)', c: [33.2690, 35.7710], r: 'north' },
    { id: 'eingedi', name: 'עין גדי', c: [31.4613, 35.3890], r: 'deadsea' },
    { id: 'masada', name: 'מצדה', c: [31.3156, 35.3536], r: 'deadsea' },
    { id: 'einbokek', name: 'עין בוקק (ים המלח)', c: [31.2000, 35.3625], r: 'deadsea', dest: 'deadsea' },
    { id: 'arad', name: 'ערד', c: [31.2610, 35.2140], r: 'deadsea' },
    { id: 'bsheva', name: 'באר שבע', c: [31.2520, 34.7915], r: 'negev', rail: true },
    { id: 'dimona', name: 'דימונה', c: [31.0700, 35.0330], r: 'negev', rail: true },
    { id: 'sdeboker', name: 'שדה בוקר', c: [30.8740, 34.7940], r: 'negev' },
    { id: 'mitzpe', name: 'מצפה רמון', c: [30.6100, 34.8010], r: 'negev', dest: 'mitzperamon' }
  ],

  /* קווי אוטובוס בין-עירוניים. a/b = מזהי יישובים (b יכול להיות רשימה של עצירות בדרך) */
  bus: [
    { a: 'tlv', b: ['eilat'], lines: '394 (וגם 390)', op: 'אגד', from: 'התחנה המרכזית החדשה, תל אביב', time: 'כ-5 ש׳', note: 'הקו הפופולרי לאילת. מומלץ להזמין מקום מראש באתר אגד.' },
    { a: 'jlm', b: ['eilat'], lines: '444', op: 'אגד', from: 'התחנה המרכזית, ירושלים', time: 'כ-4.5–5 ש׳', note: 'דרך ים המלח והערבה. הזמנת מקום מראש.' },
    { a: 'bsheva', b: ['eilat'], lines: '397', op: 'אגד', from: 'התחנה המרכזית, באר שבע', time: 'כ-3.5 ש׳', note: 'הזמנת מקום מראש.' },
    { a: 'jlm', b: ['eingedi', 'masada', 'einbokek'], lines: '486 (וגם 487)', op: 'אגד', from: 'התחנה המרכזית, ירושלים (רציף 5)', time: 'כ-1.5–2 ש׳', note: 'כ-₪19. מעט נסיעות ביום, לא בשבת.' },
    { a: 'tlv', b: ['eingedi', 'masada', 'einbokek'], lines: '421', op: 'אגד', from: 'מסוף ארלוזורוב (רכבת סבידור)', time: 'כ-2.5–3 ש׳', note: 'פעמיים ביום בערך, כ-₪17. לא בשבת.' },
    { a: 'tlvairport', b: ['jlm'], lines: '485', op: 'אפיקים', from: 'נתב״ג טרמינל 3', time: 'כ-1 ש׳', note: 'פעם בשעה, גם בלילה. לא בשבת. כ-₪16.' },
    { a: 'jlm', b: ['tlv'], lines: '405, 480', op: 'אגד / דן', from: 'התחנה המרכזית, ירושלים', time: 'כ-1 ש׳', note: '405 לתחנה המרכזית בתל אביב, 480 למסוף ארלוזורוב. תדירות גבוהה.' },
    { a: 'tlv', b: ['tiberias'], lines: '836', op: 'אגד', from: 'התחנה המרכזית החדשה, קומה 7', time: 'כ-2 ש׳', note: 'פעם בשעה בערך.' },
    { a: 'jlm', b: ['tiberias'], lines: '962 (מהיר), 961, 959', op: 'אגד', from: 'התחנה המרכזית, ירושלים (רציפים 20–21)', time: 'כ-2.5 ש׳', note: 'קווים 953 ו-963 עוברים דרך עפולה.' },
    { a: 'haifa', b: ['tiberias'], lines: '430', op: 'אגד', from: 'מרכזית המפרץ, חיפה', time: 'כ-1.25 ש׳', note: 'כל 20–30 דקות.' },
    { a: 'tiberias', b: ['nazareth'], lines: '431', op: 'נתיב תחבורה (NTT)', from: 'התחנה המרכזית, טבריה', time: 'כ-50 דק׳', note: '' },
    { a: 'jlm', b: ['haifa'], lines: '940, 960 (947 איטי)', op: 'אגד', from: 'התחנה המרכזית, ירושלים (רציף 19)', time: 'כ-2 ש׳', note: '940 למסוף חוף הכרמל, 960 ללב המפרץ.' },
    { a: 'tlv', b: ['kiryatshmona'], lines: '845', op: 'אגד', from: 'התחנה המרכזית החדשה, תל אביב', time: 'כ-2.5 ש׳', note: 'פעם בשעה בערך.' },
    { a: 'tlv', b: ['katzrin'], lines: '843', op: 'אגד', from: 'התחנה המרכזית החדשה, תל אביב', time: 'כ-3.5 ש׳', note: 'יציאה יומית אחת בערך (16:00), דרך חופי הכנרת.' },
    { a: 'bsheva', b: ['mitzpe'], lines: '64, 60', op: 'מטרופולין', from: 'התחנה המרכזית, באר שבע', time: 'כ-1–1.5 ש׳', note: '64 מהיר יותר.' }
  ],

  /* רכבת ישראל — זמני נסיעה משוערים (הרכבת לא פועלת בשבת) */
  rail: [
    ['tlv', 'jlm', 'כ-35 דק׳', 'לתחנת ירושלים–יצחק נבון'],
    ['tlv', 'tlvairport', 'כ-15 דק׳', ''],
    ['jlm', 'tlvairport', 'כ-25 דק׳', ''],
    ['tlv', 'haifa', 'כ-1 ש׳', ''],
    ['tlv', 'bsheva', 'כ-1–1.25 ש׳', ''],
    ['tlv', 'nahariya', 'כ-1.75 ש׳', 'דרך חיפה ועכו'],
    ['haifa', 'karmiel', 'כ-45 דק׳', ''],
    ['haifa', 'beitshean', 'כ-1 ש׳', 'קו העמק, דרך עפולה']
  ],

  links: {
    moovit: 'https://moovitapp.com/',
    egged: 'https://www.egged.co.il/',
    rail: 'https://www.rail.co.il/'
  }
};
