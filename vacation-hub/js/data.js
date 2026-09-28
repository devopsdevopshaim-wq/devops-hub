/* ===========================================================
   נתוני יעדים — מסע | מערכת ניהול חופשות
   כל המחירים בש"ח ומשוערים. יש לאמת מול הספקים לפני הזמנה.
   climate = טמפ' מקסימום ממוצעת לכל חודש (ינו׳–דצמ׳)
   =========================================================== */

window.APP_DATA = (function () {

  /* יציאה מישראל — נמל התעופה בן גוריון */
  const origin = {
    airport: 'נתב"ג — נמל התעופה בן גוריון',
    code: 'TLV',
    terminals: [
      { name: 'טרמינל 3', use: 'רוב הטיסות הבינלאומיות', arrive: 180 },
      { name: 'טרמינל 1', use: 'חלק מחברות הלואו-קוסט וטיסות פנים', arrive: 150 }
    ],
    checkinCloses: 60,
    gateCloses: 25,
    info: 'מוקד מידע רשות שדות התעופה: 6663*',
    cities: [
      { name: 'תל אביב', car: 25, train: 20, taxi: 110 },
      { name: 'ירושלים', car: 45, train: 25, taxi: 250 },
      { name: 'חיפה', car: 75, train: 80, taxi: 450 },
      { name: 'באר שבע', car: 70, train: 75, taxi: 420 },
      { name: 'ראשון לציון', car: 20, train: 30, taxi: 100 },
      { name: 'פתח תקווה', car: 20, train: 35, taxi: 100 },
      { name: 'נתניה', car: 40, train: 50, taxi: 220 },
      { name: 'אשדוד', car: 35, train: 45, taxi: 200 },
      { name: 'מודיעין', car: 20, train: 15, taxi: 120 },
      { name: 'נצרת', car: 95, train: 0, taxi: 550 },
      { name: 'אילת', car: 270, train: 0, taxi: 0 }
    ]
  };

  /* חגים ומועדים (תאריכים משוערים — לבדיקה מול לוח שנה עברי) */
  const holidays = [
    { date: '2026-10-03', name: 'הושענא רבה' },
    { date: '2026-10-04', name: 'שמחת תורה' },
    { date: '2026-12-05', name: 'חנוכה (נר ראשון)' },
    { date: '2026-12-12', name: 'חנוכה (נר אחרון)' },
    { date: '2027-01-23', name: 'ט״ו בשבט' },
    { date: '2027-03-23', name: 'פורים' },
    { date: '2027-04-22', name: 'פסח' },
    { date: '2027-04-28', name: 'שביעי של פסח' },
    { date: '2027-05-12', name: 'יום העצמאות' },
    { date: '2027-06-11', name: 'שבועות' },
    { date: '2027-07-01', name: 'חופש גדול' },
    { date: '2027-10-02', name: 'ראש השנה' },
    { date: '2027-10-11', name: 'יום כיפור' },
    { date: '2027-10-16', name: 'סוכות' }
  ];

  /* אתרי הזמנה — קישורים עמוקים מקבלים תאריכים ויעד */
  const bookingSites = [
    { id: 'skyscanner', name: 'Skyscanner', kind: 'flight', desc: 'השוואת טיסות' },
    { id: 'gflights', name: 'Google Flights', kind: 'flight', desc: 'לוח מחירי טיסות' },
    { id: 'kayak', name: 'Kayak', kind: 'flight', desc: 'טיסות וחבילות' },
    { id: 'booking', name: 'Booking.com', kind: 'hotel', desc: 'מלונות ודירות' },
    { id: 'airbnb', name: 'Airbnb', kind: 'hotel', desc: 'דירות ובתים' },
    { id: 'expedia', name: 'Expedia', kind: 'hotel', desc: 'מלונות וחבילות' },
    { id: 'kayakcars', name: 'Kayak Cars', kind: 'car', desc: 'השוואת השכרת רכב' },
    { id: 'rentalcars', name: 'Rentalcars', kind: 'car', desc: 'השכרת רכב' },
    { id: 'tripadvisor', name: 'Tripadvisor', kind: 'info', desc: 'ביקורות ואטרקציות' },
    { id: 'issta', name: 'איסתא', kind: 'package', desc: 'חבילות נופש מישראל' },
    { id: 'gulliver', name: 'גוליבר', kind: 'package', desc: 'חבילות וטיסות' },
    { id: 'elal', name: 'אל על', kind: 'flight', desc: 'טיסות ישירות' }
  ];

  const D = [
    /* ------------------------------ ישראל ------------------------------ */
    {
      id: 'eilat', name: 'אילת', nameEn: 'Eilat', country: 'ישראל', region: 'il',
      iata: 'ETM', coords: [29.5577, 34.9519], zoom: 12,
      tagline: 'שמש כל השנה, שוניות אלמוגים ומדבר אדום',
      about: 'עיר הנופש הדרומית של ישראל, על חוף מפרץ אילת. חורף חמים, צלילה ושנורקלינג בשמורת האלמוגים, טיולי מדבר בהרי אילת ופטור ממע"מ בקניות.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית', tzDiff: 0, flightTime: 1,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [21, 23, 26, 31, 35, 38, 40, 40, 37, 32, 27, 22], bestMonths: [10, 11, 12, 1, 2, 3, 4],
      costs: { flight: 450, hotel: { budget: 450, mid: 850, lux: 1800 }, car: 180, food: 220, transport: 30 },
      airport: {
        name: 'נמל התעופה רמון', code: 'ETM',
        toCity: [
          { mode: 'מונית', time: '20 דק׳', cost: '₪90–₪120' },
          { mode: 'אוטובוס קו 30', time: '30 דק׳', cost: '₪5–₪8' },
          { mode: 'רכב שכור (דלפקים בטרמינל)', time: '20 דק׳', cost: 'לפי הזמנה' }
        ],
        note: 'טיסות פנים מנתב"ג (טרמינל 1) ומחיפה. חלופה: נסיעה של כ-4 שעות מהמרכז בכביש 90 או 40.'
      },
      hotels: [
        { name: 'Isrotel Royal Beach', area: 'הטיילת הצפונית', tier: 'lux', price: 1900, note: 'על קו המים, ספא וברכות' },
        { name: 'Dan Eilat', area: 'החוף הצפוני', tier: 'lux', price: 1600, note: 'מתאים למשפחות' },
        { name: 'Leonardo Plaza Eilat', area: 'הלגונה', tier: 'mid', price: 850, note: 'קרוב לטיילת ולקניון' },
        { name: 'Isrotel Yam Suf', area: 'חוף האלמוגים', tier: 'mid', price: 950, note: 'גישה ישירה לשונית' }
      ],
      car: { need: 'מומלץ לטיולי מדבר', companies: ['שלמה סיקסט', 'אלדן', 'Hertz', 'Avis'], tips: ['אילת אזור סחר חופשי — הדלק זול יותר', 'רכב 4×4 רק במסלולים מסומנים', 'מים בכמות גדולה ברכב בקיץ'] },
      kosherNote: 'רוב המלונות הגדולים ומסעדות הטיילת בעלי תעודת כשרות. חפשו תעודה בתוקף בכניסה.',
      kosher: [
        { name: 'מסעדות המלונות (רויאל ביץ׳, דן, הרודס)', area: 'הטיילת', note: 'כשרות רבנות' },
        { name: 'מסעדות בשריות במרינה', area: 'המרינה', note: 'לבדוק תעודה עדכנית' }
      ],
      food: [
        { name: 'המפלט האחרון (The Last Refuge)', type: 'דגים ופירות ים', area: 'חוף האלמוגים', price: '₪₪₪' },
        { name: 'דוכני הטיילת', type: 'אוכל רחוב', area: 'הטיילת', price: '₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן. אלה מסעדות שף מוערכות באזור.',
      michelin: [],
      transit: { system: 'אוטובוסים עירוניים', card: 'רב-קו / אפליקציות תשלום', single: '₪5.5', day: '₪12', apps: ['Moovit', 'רב-פס'], notes: 'קווים לאורך הטיילת ולחופים הדרומיים. בקיץ עדיף מונית או רכב.' },
      routes: [
        { name: 'סוף שבוע של ים', days: 3, stops: ['שמורת האלמוגים', 'המצפה התת-ימי', 'חוף מוש', 'שייט זכוכית במפרץ'], desc: 'ימים רגועים על המים, מתאים למשפחות.' },
        { name: 'מדבר והרים', days: 2, stops: ['הר שלמה', 'הקניון האדום', 'פארק תמנע', 'עמודי עמרם'], desc: 'מסלולי הליכה של 2–4 שעות. לצאת מוקדם בבוקר.' }
      ],
      pois: [
        { name: 'שמורת האלמוגים', c: [29.5089, 34.9208] },
        { name: 'המצפה התת-ימי', c: [29.5042, 34.9175] },
        { name: 'הטיילת והמרינה', c: [29.5518, 34.9582] },
        { name: 'פארק תמנע', c: [29.7869, 34.9867] },
        { name: 'הקניון האדום', c: [29.7803, 34.9531] }
      ],
      poster: { sky: ['#F7B267', '#F4845F'], sun: '#FFE5A8', land: '#B5543C', far: '#D9774F', icon: 'palms', ink: '#3B1F1A' }
    },
    {
      id: 'jerusalem', name: 'ירושלים', nameEn: 'Jerusalem', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [31.7767, 35.2345], zoom: 13,
      tagline: 'אבן, היסטוריה ושווקים',
      about: 'העיר העתיקה, הכותל המערבי, מוזיאון ישראל ושוק מחנה יהודה. עיר של הליכה ברגל, עם סצנת קולינריה חזקה ואווירה מיוחדת בשבת.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית, ערבית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [12, 13, 16, 21, 25, 27, 29, 29, 28, 24, 18, 14], bestMonths: [3, 4, 5, 9, 10, 11],
      costs: { flight: 0, hotel: { budget: 350, mid: 750, lux: 2200 }, car: 170, food: 200, transport: 25 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכבת ישירה לתחנת יצחק נבון', time: '25 דק׳', cost: '₪20 בערך' },
          { mode: 'מונית שירות (נשר)', time: '50 דק׳', cost: '₪70 בערך' },
          { mode: 'מונית', time: '45 דק׳', cost: '₪230–₪280' }
        ],
        note: 'הרכבת אינה פועלת בשבת ובחגים.'
      },
      hotels: [
        { name: 'King David', area: 'רחוב המלך דוד', tier: 'lux', price: 2600, note: 'מלון היסטורי מול חומות העיר' },
        { name: 'Mamilla Hotel', area: 'ממילא', tier: 'lux', price: 2100, note: 'דקות משער יפו' },
        { name: 'Harmony Hotel', area: 'מדרחוב נחלת שבעה', tier: 'mid', price: 800, note: 'בוטיק במרכז העיר' },
        { name: 'Abraham Hostel', area: 'דוידקה', tier: 'budget', price: 350, note: 'הוסטל עם סיורים מאורגנים' }
      ],
      car: { need: 'לא נחוץ בתוך העיר', companies: ['שלמה סיקסט', 'אלדן', 'באדג׳ט'], tips: ['חניה במרכז יקרה ומוגבלת', 'חניוני חנה וסע ליד הרכבת הקלה', 'רכב שימושי לים המלח ולמדבר יהודה'] },
      kosherNote: 'רוב המסעדות במערב העיר כשרות. בשבת רוב המסעדות הכשרות סגורות.',
      kosher: [
        { name: 'Eucalyptus', area: 'חוצות היוצר', note: 'מטבח ישראלי-תנ״כי, כשר' },
        { name: 'Angelica', area: 'מרכז העיר', note: 'מסעדת שף, כשרה' },
        { name: 'דוכני שוק מחנה יהודה', area: 'מחנה יהודה', note: 'רובם בכשרות רבנות' }
      ],
      food: [
        { name: 'מחניודה', type: 'מסעדת שף', area: 'מחנה יהודה', price: '₪₪₪' },
        { name: 'אזורה', type: 'אוכל ביתי עיראקי-כורדי', area: 'מחנה יהודה', price: '₪₪' },
        { name: 'חומוס לינא', type: 'חומוס', area: 'העיר העתיקה', price: '₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן. אלה מסעדות שף מוערכות.',
      michelin: [],
      transit: { system: 'רכבת קלה (קו אדום) ואוטובוסים', card: 'רב-קו', single: '₪5.5', day: '₪12.5', apps: ['Moovit', 'רב-פס', 'Google Maps'], notes: 'אין תחבורה ציבורית בשבת. הרכבת הקלה חוצה את העיר מצפון לדרום.' },
      routes: [
        { name: 'העיר העתיקה ביום אחד', days: 1, stops: ['שער יפו', 'מגדל דוד', 'הרובע היהודי', 'הכותל המערבי', 'כנסיית הקבר', 'שוק הרובע המוסלמי'], desc: 'כ-6 ק״מ הליכה על אבן. נעליים נוחות.' },
        { name: 'מוזיאונים ושוק', days: 2, stops: ['מוזיאון ישראל', 'יד ושם', 'מחנה יהודה', 'נחלאות', 'המושבה הגרמנית'], desc: 'שילוב של תרבות ואוכל.' }
      ],
      pois: [
        { name: 'הכותל המערבי', c: [31.7767, 35.2345] },
        { name: 'מגדל דוד', c: [31.7762, 35.2283] },
        { name: 'מחנה יהודה', c: [31.7853, 35.2125] },
        { name: 'מוזיאון ישראל', c: [31.7722, 35.2045] },
        { name: 'יד ושם', c: [31.7741, 35.1754] }
      ],
      poster: { sky: ['#F3D9A4', '#E8B26A'], sun: '#FFF3D1', land: '#A8763E', far: '#C99A5B', icon: 'walls', ink: '#3F2A12' }
    },
    {
      id: 'telaviv', name: 'תל אביב', nameEn: 'Tel Aviv', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [32.0853, 34.7818], zoom: 13,
      tagline: 'חוף, באוהאוס ולילות ארוכים',
      about: 'העיר הלבנה: 14 ק״מ של חופים, בנייני באוהאוס, יפו העתיקה, שוק הכרמל וסצנת מסעדות ובילוי שלא נגמרת.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [18, 19, 21, 24, 27, 29, 31, 31, 30, 28, 24, 20], bestMonths: [4, 5, 6, 9, 10, 11],
      costs: { flight: 0, hotel: { budget: 400, mid: 950, lux: 2500 }, car: 170, food: 250, transport: 25 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכבת לתחנות תל אביב', time: '15–20 דק׳', cost: '₪13 בערך' },
          { mode: 'מונית', time: '25 דק׳', cost: '₪100–₪150' },
          { mode: 'אוטובוס', time: '45 דק׳', cost: '₪6 בערך' }
        ],
        note: 'רכבת ישראל אינה פועלת בשבת. בשבת יש קווי "נעים בסופ״ש" עירוניים.'
      },
      hotels: [
        { name: 'The Norman', area: 'שדרות רוטשילד', tier: 'lux', price: 3000, note: 'מלון בוטיק יוקרתי' },
        { name: 'The Setai', area: 'יפו', tier: 'lux', price: 2600, note: 'בניין עות׳מאני משוחזר' },
        { name: 'Brown TLV', area: 'מרכז העיר', tier: 'mid', price: 950, note: 'בר גג וסטייל' },
        { name: 'Abraham Tel Aviv', area: 'לוינסקי', tier: 'budget', price: 400, note: 'הוסטל חברתי' }
      ],
      car: { need: 'לא נחוץ', companies: ['שלמה סיקסט', 'אלדן', 'AutoTel (שיתופי)'], tips: ['חניה קשה ויקרה — העדיפו חניונים', 'אופניים וקורקינטים שיתופיים בכל העיר'] },
      kosherNote: 'יש עשרות מסעדות כשרות; חפשו תעודת כשרות. באזור הבורסה ברמת גן ריכוז גבוה.',
      kosher: [
        { name: 'מסעדות המלונות על הטיילת', area: 'הירקון', note: 'רובן בכשרות רבנות' },
        { name: 'דוכני שוק הכרמל', area: 'הכרם', note: 'חלק כשרים — לבדוק' }
      ],
      food: [
        { name: 'OCD', type: 'תפריט טעימות', area: 'לבונטין', price: '₪₪₪₪' },
        { name: 'טאיזו', type: 'אסייתי מודרני', area: 'מנחם בגין', price: '₪₪₪' },
        { name: 'אבו חסן', type: 'חומוס', area: 'יפו', price: '₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן. אלה מסעדות שף מוערכות.',
      michelin: [],
      transit: { system: 'רכבת קלה (קו אדום), אוטובוסים, רכבת ישראל', card: 'רב-קו', single: '₪5.5', day: '₪12.5', apps: ['Moovit', 'רב-פס', 'Tel-O-Fun'], notes: 'הקו האדום מחבר את פתח תקווה, מרכז העיר ובת ים.' },
      routes: [
        { name: 'יפו עד נמל תל אביב', days: 1, stops: ['שעון יפו', 'פשפשים', 'נווה צדק', 'שוק הכרמל', 'רוטשילד', 'נמל תל אביב'], desc: 'כ-8 ק״מ, רובם לאורך הים.' },
        { name: 'באוהאוס וגלריות', days: 1, stops: ['כיכר דיזנגוף', 'מרכז הבאוהאוס', 'מוזיאון תל אביב', 'שרונה'], desc: 'סיור אדריכלות ואמנות.' }
      ],
      pois: [
        { name: 'יפו העתיקה', c: [32.0543, 34.7519] },
        { name: 'שוק הכרמל', c: [32.0684, 34.7686] },
        { name: 'שדרות רוטשילד', c: [32.0637, 34.7747] },
        { name: 'נמל תל אביב', c: [32.0973, 34.7735] },
        { name: 'שרונה', c: [32.0719, 34.7867] }
      ],
      poster: { sky: ['#9ED8DB', '#F6E3B4'], sun: '#FFF7E0', land: '#2B7A78', far: '#DEC49A', icon: 'city-sea', ink: '#153B3A' }
    },
    {
      id: 'galilee', name: 'הגליל והגולן', nameEn: 'Galilee', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [32.8, 35.55], zoom: 10,
      tagline: 'כנרת, יקבים ומסלולי מים',
      about: 'צפון ירוק: כנרת, צפת העתיקה, נחלים זורמים בגולן, יקבים, צימרים ורמת הגולן המושלגת בחורף בחרמון.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית, ערבית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [17, 18, 21, 26, 31, 34, 36, 36, 34, 30, 24, 19], bestMonths: [3, 4, 5, 10, 11],
      costs: { flight: 0, hotel: { budget: 450, mid: 900, lux: 2000 }, car: 170, food: 220, transport: 40 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכב', time: '2 שעות לכנרת', cost: 'דלק כ-₪120' },
          { mode: 'רכבת לבית שאן / כרמיאל ואוטובוס', time: '2.5–3 שעות', cost: '₪40–₪60' }
        ],
        note: 'רכב הוא הדרך הנוחה ביותר לטייל בצפון.'
      },
      hotels: [
        { name: 'The Scots Hotel', area: 'טבריה', tier: 'lux', price: 2000, note: 'בית חולים סקוטי היסטורי על הכנרת' },
        { name: 'Pina Barosh', area: 'ראש פינה', tier: 'mid', price: 1100, note: 'בוטיק במושבה הוותיקה' },
        { name: 'כפר הנופש עין גב', area: 'חוף מזרחי של הכנרת', tier: 'mid', price: 800, note: 'חוף פרטי' },
        { name: 'צימרים בגולן', area: 'רמת הגולן', tier: 'budget', price: 550, note: 'מגוון רחב — להזמין מראש בחגים' }
      ],
      car: { need: 'חיוני', companies: ['שלמה סיקסט', 'אלדן', 'Hertz', 'Avis'], tips: ['כבישים הרריים — לנהוג בזהירות בלילה', 'בחורף לבדוק פתיחת כביש החרמון', 'חניונים בתשלום בשמורות'] },
      kosherNote: 'בטבריה, צפת וראש פינה ריכוז גבוה של מסעדות כשרות.',
      kosher: [
        { name: 'מסעדות טיילת טבריה', area: 'טבריה', note: 'רובן כשרות' },
        { name: 'מסעדות העיר העתיקה בצפת', area: 'צפת', note: 'כשרות מהדרין נפוצה' }
      ],
      food: [
        { name: 'אורי בורי', type: 'דגים ופירות ים', area: 'עכו', price: '₪₪₪' },
        { name: 'מסעדות דרוזיות', type: 'מטבח דרוזי', area: 'מג׳דל שמס / בוקעאתא', price: '₪₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן. אלה מסעדות שף מוערכות.',
      michelin: [],
      transit: { system: 'אוטובוסים בין-עירוניים', card: 'רב-קו', single: '₪5.5–₪30', day: '—', apps: ['Moovit', 'רב-פס'], notes: 'תדירות נמוכה ביישובים הקטנים. אין תחבורה בשבת.' },
      routes: [
        { name: 'סובב כנרת', days: 2, stops: ['טבריה', 'כפר נחום', 'טבחה', 'עין גב', 'חמת גדר'], desc: 'כ-60 ק״מ נסיעה עם עצירות חוף.' },
        { name: 'גולן ומים', days: 3, stops: ['נחל עיון', 'בניאס', 'נמרוד', 'יקב רמת הגולן', 'נחל זוויתן'], desc: 'מסלולי מים — להביא נעלי מים.' }
      ],
      pois: [
        { name: 'טבריה', c: [32.7922, 35.5312] },
        { name: 'צפת העתיקה', c: [32.9646, 35.4960] },
        { name: 'בניאס', c: [33.2486, 35.6947] },
        { name: 'כפר נחום', c: [32.8810, 35.5750] },
        { name: 'ראש פינה', c: [32.9689, 35.5421] }
      ],
      poster: { sky: ['#BFE0C8', '#F2E8C9'], sun: '#FFFBEA', land: '#4E7F52', far: '#8DB38B', icon: 'hills-lake', ink: '#1F3A22' }
    },

    /* ------------------------------ חו"ל ------------------------------ */
    {
      id: 'paris', name: 'פריז', nameEn: 'Paris', country: 'צרפת', region: 'abroad',
      iata: 'CDG', coords: [48.8566, 2.3522], zoom: 12,
      tagline: 'שדרות, מוזיאונים ומאפיות בכל פינה',
      about: 'הלובר, מגדל אייפל, מונמרטר ולה מארה. עיר של הליכה, בתי קפה ומסעדות מישלן, עם רכבת תחתית צפופה שמגיעה לכל מקום.',
      currency: { code: 'EUR', name: 'אירו', rate: 4.1 }, language: 'צרפתית', tzDiff: -1, flightTime: 5,
      visa: 'פטור לבעלי דרכון ישראלי (שנגן, עד 90 יום). מערכת ETIAS צפויה להידרש.', plug: 'C / E', emergency: '112', drivingSide: 'ימין', tipping: 'השירות כלול; עיגול כלפי מעלה מקובל',
      climate: [8, 9, 13, 16, 20, 23, 26, 25, 21, 16, 11, 8], bestMonths: [4, 5, 6, 9, 10],
      costs: { flight: 1700, hotel: { budget: 550, mid: 1100, lux: 4000 }, car: 220, food: 320, transport: 45 },
      airport: {
        name: 'שארל דה גול', code: 'CDG',
        toCity: [
          { mode: 'RER B למרכז', time: '35–45 דק׳', cost: '€13 בערך' },
          { mode: 'Roissybus לאופרה', time: '60–75 דק׳', cost: '€16 בערך' },
          { mode: 'מונית (מחיר קבוע)', time: '45–60 דק׳', cost: '€56–€65' }
        ],
        note: 'חלק מהטיסות נוחתות באורלי (ORY) — משם קו מטרו 14 למרכז.'
      },
      hotels: [
        { name: 'Le Meurice', area: 'רחוב ריבולי', tier: 'lux', price: 6000, note: 'מול גני טווילרי' },
        { name: 'Hôtel des Grands Boulevards', area: 'הרובע ה-2', tier: 'mid', price: 1300, note: 'בוטיק עם מסעדה' },
        { name: 'Hôtel Fabric', area: 'הרובע ה-11', tier: 'mid', price: 950, note: 'לופט תעשייתי שקט' },
        { name: 'Generator Paris', area: 'הרובע ה-10', tier: 'budget', price: 450, note: 'הוסטל עם חדרים פרטיים' }
      ],
      car: { need: 'לא בעיר; כן לטיולים לנורמנדי ולעמק הלואר', companies: ['Europcar', 'Sixt', 'Hertz', 'Avis'], tips: ['אזורי ZFE — נדרש מדבקת Crit\'Air', 'כבישי אגרה (Péage) — כרטיס אשראי', 'רישיון ישראלי תקף; מומלץ רישיון בינלאומי'] },
      kosherNote: 'בפריז יש קהילה יהודית גדולה. ריכוזים: רחוב רוזייה בלה מארה, הרובע ה-17 וה-19.',
      kosher: [
        { name: 'Chez Marianne ורחוב רוזייה', area: 'לה מארה (הרובע ה-4)', note: 'לבדוק תעודה — חלק מהמקומות אינם כשרים' },
        { name: 'מסעדות כשרות ברובע ה-17', area: 'Rue de Levis', note: 'ריכוז גבוה של מסעדות בפיקוח בית הדין' },
        { name: 'בית חב״ד', area: 'מספר סניפים', note: 'ארוחות שבת בהרשמה מראש' }
      ],
      food: [
        { name: 'Bouillon Chartier', type: 'ביסטרו צרפתי קלאסי', area: 'הרובע ה-9', price: '€' },
        { name: 'L\'As du Fallafel', type: 'פלאפל', area: 'לה מארה', price: '€' },
        { name: 'Le Comptoir du Relais', type: 'ביסטרו', area: 'סן ז׳רמן', price: '€€' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Guy Savoy', stars: 3, cuisine: 'צרפתי עכשווי', area: 'מטבעה של פריז' },
        { name: 'Arpège', stars: 3, cuisine: 'ירקות מהגן', area: 'הרובע ה-7' },
        { name: 'Le Cinq', stars: 3, cuisine: 'צרפתי קלאסי', area: 'Four Seasons George V' }
      ],
      transit: { system: 'מטרו (16 קווים), RER, אוטובוסים, טראם', card: 'Navigo Easy / כרטיס בטלפון', single: '€2.5 בערך', day: '€12 בערך (Paris Visite)', apps: ['Bonjour RATP', 'Citymapper', 'Google Maps'], notes: 'המטרו פועל עד כ-01:00 (עד 02:00 בסופ״ש).' },
      routes: [
        { name: 'קלאסיקות ב-3 ימים', days: 3, stops: ['מגדל אייפל', 'שאנז אליזה', 'הלובר', 'נוטרדאם', 'לה מארה', 'מונמרטר'], desc: 'יום לכל גדה של הסן ויום למונמרטר.' },
        { name: 'טיול יום לוורסאי', days: 1, stops: ['ארמון ורסאי', 'הגנים', 'הכפר של מארי אנטואנט'], desc: 'RER C מהמרכז, כ-40 דק׳.' }
      ],
      pois: [
        { name: 'מגדל אייפל', c: [48.8584, 2.2945] },
        { name: 'הלובר', c: [48.8606, 2.3376] },
        { name: 'נוטרדאם', c: [48.853, 2.3499] },
        { name: 'מונמרטר', c: [48.8867, 2.3431] },
        { name: 'לה מארה', c: [48.8575, 2.3622] }
      ],
      poster: { sky: ['#C7D3E8', '#F4D6C6'], sun: '#FFF1E6', land: '#3E4E6C', far: '#8A9BBB', icon: 'eiffel', ink: '#1E2A40' }
    },
    {
      id: 'london', name: 'לונדון', nameEn: 'London', country: 'בריטניה', region: 'abroad',
      iata: 'LHR', coords: [51.5074, -0.1278], zoom: 12,
      tagline: 'מוזיאונים בחינם, פארקים ומחזות זמר',
      about: 'הביג בן, המוזיאון הבריטי, הווסט אנד ושווקים כמו בורו וקמדן. רוב המוזיאונים הגדולים בחינם.',
      currency: { code: 'GBP', name: 'ליש״ט', rate: 4.8 }, language: 'אנגלית', tzDiff: -2, flightTime: 5.5,
      visa: 'נדרש אישור ETA אלקטרוני לפני הטיסה', plug: 'G', emergency: '999 / 112', drivingSide: 'שמאל', tipping: '10%–12.5% (לעיתים כלול בחשבון)',
      climate: [8, 9, 12, 15, 18, 21, 24, 23, 20, 16, 11, 9], bestMonths: [5, 6, 7, 8, 9],
      costs: { flight: 1800, hotel: { budget: 600, mid: 1300, lux: 4500 }, car: 240, food: 350, transport: 55 },
      airport: {
        name: 'הית׳רו', code: 'LHR',
        toCity: [
          { mode: 'Elizabeth line', time: '35–45 דק׳', cost: '£13 בערך' },
          { mode: 'Heathrow Express לפדינגטון', time: '15 דק׳', cost: '£25 בערך' },
          { mode: 'Piccadilly line', time: '50–60 דק׳', cost: '£6 בערך' },
          { mode: 'מונית שחורה', time: '60 דק׳', cost: '£70–£100' }
        ],
        note: 'טיסות לואו-קוסט נוחתות גם בלוטון ובסטנסטד — משם רכבות ואוטובוסים.'
      },
      hotels: [
        { name: 'The Savoy', area: 'סטרנד', tier: 'lux', price: 5500, note: 'אייקון על התמזה' },
        { name: 'citizenM Tower of London', area: 'טאוור היל', tier: 'mid', price: 1100, note: 'חדרים קומפקטיים ונוף' },
        { name: 'The Hoxton Holborn', area: 'הולבורן', tier: 'mid', price: 1300, note: 'מרכזי ותוסס' },
        { name: 'Generator London', area: 'קינגס קרוס', tier: 'budget', price: 500, note: 'הוסטל ליד תחנת הרכבת' }
      ],
      car: { need: 'לא בעיר (אגרת גודש ו-ULEZ); כן לקוטסוולדס', companies: ['Enterprise', 'Hertz', 'Sixt', 'Europcar'], tips: ['נהיגה בצד שמאל', 'Congestion Charge במרכז', 'כיכרות — זכות קדימה מימין'] },
      kosherNote: 'קהילה יהודית גדולה. ריכוזים: גולדרס גרין, הנדון, סטמפורד היל, אדג׳וור.',
      kosher: [
        { name: 'מסעדות Golders Green Road', area: 'גולדרס גרין', note: 'עשרות מסעדות בפיקוח KLBD / בית דין' },
        { name: 'מסעדות כשרות במרכז', area: 'West End / St John\'s Wood', note: 'לבדוק תעודה עדכנית' }
      ],
      food: [
        { name: 'Borough Market', type: 'שוק אוכל', area: 'סאות׳וורק', price: '£' },
        { name: 'Dishoom', type: 'הודי בומבאי', area: 'מספר סניפים', price: '££' },
        { name: 'Padella', type: 'פסטה טרייה', area: 'בורו', price: '£' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Core by Clare Smyth', stars: 3, cuisine: 'בריטי מודרני', area: 'נוטינג היל' },
        { name: 'Restaurant Gordon Ramsay', stars: 3, cuisine: 'צרפתי', area: 'צ׳לסי' },
        { name: 'The Ledbury', stars: 2, cuisine: 'מודרני', area: 'נוטינג היל' }
      ],
      transit: { system: 'Tube (11 קווים), Overground, אוטובוסים דו-קומתיים', card: 'Oyster או תשלום באשראי ללא מגע', single: '£2.8 בערך (אזור 1)', day: 'תקרה יומית כ-£8.5', apps: ['TfL Go', 'Citymapper'], notes: 'תשלום בכרטיס אשראי מגבלה אוטומטית לתקרה יומית.' },
      routes: [
        { name: 'לונדון הקלאסית', days: 3, stops: ['ווסטמינסטר וביג בן', 'ארמון בקינגהאם', 'המוזיאון הבריטי', 'קובנט גארדן', 'גשר המצודה', 'שוק בורו'], desc: 'שילוב של הליכה ושייט בתמזה.' },
        { name: 'שווקים ושכונות', days: 2, stops: ['קמדן', 'נוטינג היל ופורטובלו', 'שורדיץ׳', 'בריק ליין'], desc: 'סופ״ש הוא הזמן הטוב לשווקים.' }
      ],
      pois: [
        { name: 'ביג בן', c: [51.5007, -0.1246] },
        { name: 'המוזיאון הבריטי', c: [51.5194, -0.127] },
        { name: 'גשר המצודה', c: [51.5055, -0.0754] },
        { name: 'שוק בורו', c: [51.5055, -0.091] },
        { name: 'קמדן', c: [51.5416, -0.1462] }
      ],
      poster: { sky: ['#B8C4CC', '#E6D5C3'], sun: '#F5EDE3', land: '#6B2E2E', far: '#8C9AA5', icon: 'bigben', ink: '#2A1616' }
    },
    {
      id: 'rome', name: 'רומא', nameEn: 'Rome', country: 'איטליה', region: 'abroad',
      iata: 'FCO', coords: [41.9028, 12.4964], zoom: 13,
      tagline: 'אלפיים שנה של היסטוריה בכל רחוב',
      about: 'הקולוסיאום, הוותיקן, מזרקת טרווי וטרסטוורה. רובע הגטו היהודי הוותיק באירופה עם מסעדות כשרות.',
      currency: { code: 'EUR', name: 'אירו', rate: 4.1 }, language: 'איטלקית', tzDiff: -1, flightTime: 3.5,
      visa: 'פטור (שנגן, עד 90 יום). מערכת ETIAS צפויה להידרש.', plug: 'C / F / L', emergency: '112', drivingSide: 'ימין', tipping: 'לא חובה; Coperto נגבה בחשבון',
      climate: [12, 13, 16, 19, 23, 28, 31, 31, 27, 22, 16, 13], bestMonths: [4, 5, 6, 9, 10],
      costs: { flight: 1300, hotel: { budget: 450, mid: 950, lux: 3500 }, car: 200, food: 280, transport: 35 },
      airport: {
        name: 'פיומיצ׳ינו (ליאונרדו דה וינצ׳י)', code: 'FCO',
        toCity: [
          { mode: 'Leonardo Express לטרמיני', time: '32 דק׳', cost: '€14 בערך' },
          { mode: 'אוטובוס (Terravision וכד׳)', time: '50–60 דק׳', cost: '€6–€7' },
          { mode: 'מונית (מחיר קבוע)', time: '45 דק׳', cost: '€55 בערך' }
        ],
        note: 'חלק מהלואו-קוסט נוחתות בצ׳מפינו (CIA).'
      },
      hotels: [
        { name: 'Hotel Hassler Roma', area: 'ראש המדרגות הספרדיות', tier: 'lux', price: 4500, note: 'נוף על העיר' },
        { name: 'Hotel Artemide', area: 'Via Nazionale', tier: 'mid', price: 1000, note: 'קרוב לטרמיני' },
        { name: 'Hotel Santa Maria', area: 'טרסטוורה', tier: 'mid', price: 1050, note: 'חצר פנימית שקטה' },
        { name: 'The Beehive', area: 'טרמיני', tier: 'budget', price: 400, note: 'אכסניה ידידותית' }
      ],
      car: { need: 'לא בעיר (אזורי ZTL); כן לטוסקנה', companies: ['Europcar', 'Hertz', 'Sixt', 'Maggiore'], tips: ['ZTL — קנסות אוטומטיים על כניסה למרכז', 'אגרות בכבישים המהירים', 'לתעד את הרכב בווידאו באיסוף'] },
      kosherNote: 'הגטו היהודי ליד בית הכנסת הגדול — רחוב Via del Portico d\'Ottavia.',
      kosher: [
        { name: 'Ba\'Ghetto', area: 'הגטו היהודי', note: 'מטבח רומאי-יהודי, כשר' },
        { name: 'Nonna Betta', area: 'הגטו היהודי', note: 'ארטישוק יהודי — לבדוק סטטוס כשרות' },
        { name: 'מסעדות Via del Portico d\'Ottavia', area: 'הגטו', note: 'ריכוז של מסעדות כשרות' }
      ],
      food: [
        { name: 'Roscioli', type: 'טרטוריה ומעדנייה', area: 'קמפו דה פיורי', price: '€€' },
        { name: 'Da Enzo al 29', type: 'רומאי מסורתי', area: 'טרסטוורה', price: '€€' },
        { name: 'Pizzarium Bonci', type: 'פיצה אל טאליו', area: 'ליד הוותיקן', price: '€' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'La Pergola', stars: 3, cuisine: 'ים-תיכוני', area: 'Rome Cavalieri' },
        { name: 'Il Pagliaccio', stars: 2, cuisine: 'איטלקי יצירתי', area: 'מרכז היסטורי' },
        { name: 'Enoteca La Pergola', stars: 1, cuisine: 'איטלקי', area: 'מרכז' }
      ],
      transit: { system: 'מטרו (3 קווים), אוטובוסים, טראם', card: 'כרטיס BIT / תשלום באשראי ללא מגע', single: '€1.5 (100 דק׳)', day: '€7 (24 שעות)', apps: ['Moovit', 'MyCicero', 'Google Maps'], notes: 'המטרו מוגבל במרכז ההיסטורי — הרבה הליכה.' },
      routes: [
        { name: 'רומא העתיקה', days: 2, stops: ['הקולוסיאום', 'הפורום הרומי', 'הפלטין', 'הפנתאון', 'פיאצה נבונה', 'מזרקת טרווי'], desc: 'להזמין כרטיסים לקולוסיאום מראש.' },
        { name: 'ותיקן וטרסטוורה', days: 1, stops: ['מוזיאוני הוותיקן', 'הקפלה הסיסטינית', 'בזיליקת פטרוס', 'טרסטוורה בערב'], desc: 'מוזיאוני הוותיקן סגורים בימי ראשון (למעט הראשון בחודש).' }
      ],
      pois: [
        { name: 'הקולוסיאום', c: [41.8902, 12.4922] },
        { name: 'הפנתאון', c: [41.8986, 12.4769] },
        { name: 'מזרקת טרווי', c: [41.9009, 12.4833] },
        { name: 'הוותיקן', c: [41.9022, 12.4539] },
        { name: 'הגטו היהודי', c: [41.8925, 12.4777] }
      ],
      poster: { sky: ['#F5C98B', '#E9A26B'], sun: '#FFF0CF', land: '#9A4A2F', far: '#C98760', icon: 'colosseum', ink: '#3A1B10' }
    },
    {
      id: 'barcelona', name: 'ברצלונה', nameEn: 'Barcelona', country: 'ספרד', region: 'abroad',
      iata: 'BCN', coords: [41.3874, 2.1686], zoom: 13,
      tagline: 'גאודי, חוף וטאפאס עד חצות',
      about: 'סגרדה פמיליה, פארק גואל, הרובע הגותי והברצלונטה. עיר חוף עם תרבות לילה וקולינריה קטלאנית.',
      currency: { code: 'EUR', name: 'אירו', rate: 4.1 }, language: 'ספרדית, קטלאנית', tzDiff: -1, flightTime: 4.5,
      visa: 'פטור (שנגן, עד 90 יום). מערכת ETIAS צפויה להידרש.', plug: 'C / F', emergency: '112', drivingSide: 'ימין', tipping: '5%–10% לא חובה',
      climate: [14, 15, 17, 19, 22, 26, 29, 29, 26, 22, 17, 14], bestMonths: [5, 6, 9, 10],
      costs: { flight: 1400, hotel: { budget: 450, mid: 1000, lux: 3500 }, car: 190, food: 270, transport: 35 },
      airport: {
        name: 'אל פראט', code: 'BCN',
        toCity: [
          { mode: 'Aerobús לפלאסה קטלוניה', time: '35 דק׳', cost: '€7 בערך' },
          { mode: 'מטרו L9 Sud', time: '45 דק׳', cost: '€5.5 בערך' },
          { mode: 'מונית', time: '25–35 דק׳', cost: '€35–€40' }
        ],
        note: 'כרטיס T-casual אינו תקף לתחנת השדה במטרו — צריך כרטיס Aeroport.'
      },
      hotels: [
        { name: 'Hotel Arts Barcelona', area: 'הנמל האולימפי', tier: 'lux', price: 3800, note: 'מגדל על הים' },
        { name: 'Casa Bonay', area: 'אישמפלה', tier: 'mid', price: 1100, note: 'בוטיק עם בר גג' },
        { name: 'Hotel Neri', area: 'הרובע הגותי', tier: 'lux', price: 2200, note: 'ארמון מהמאה ה-12' },
        { name: 'Generator Barcelona', area: 'גרסיה', tier: 'budget', price: 400, note: 'הוסטל מעוצב' }
      ],
      car: { need: 'לא בעיר; כן לקוסטה בראבה', companies: ['Europcar', 'Sixt', 'Hertz', 'Centauro'], tips: ['גניבות מרכבים — לא להשאיר חפצים גלויים', 'אזור פליטה נמוכה (ZBE)', 'חניה במרכז יקרה'] },
      kosherNote: 'קהילה קטנה. מסעדות כשרות בודדות ובתי חב״ד.',
      kosher: [
        { name: 'בית חב״ד ברצלונה', area: 'מרכז העיר', note: 'ארוחות ומידע על מקומות כשרים' },
        { name: 'מסעדות כשרות בודדות', area: 'Sant Gervasi / מרכז', note: 'לבדוק באתר הקהילה' }
      ],
      food: [
        { name: 'La Boqueria', type: 'שוק', area: 'לה רמבלה', price: '€' },
        { name: 'Cervecería Catalana', type: 'טאפאס', area: 'אישמפלה', price: '€€' },
        { name: 'Bar Cañete', type: 'טאפאס', area: 'אל ראבל', price: '€€' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Disfrutar', stars: 3, cuisine: 'יצירתי', area: 'אישמפלה' },
        { name: 'Lasarte', stars: 3, cuisine: 'יצירתי', area: 'Hotel Monument' },
        { name: 'ABaC', stars: 3, cuisine: 'קטלאני מודרני', area: 'טיבידאבו' }
      ],
      transit: { system: 'מטרו (12 קווים), אוטובוסים, טראם, רכבל', card: 'T-casual (10 נסיעות)', single: '€2.6 בערך', day: 'Hola Barcelona — 48 שעות', apps: ['TMB App', 'Moovit', 'Citymapper'], notes: 'המטרו פועל כל הלילה בשבת.' },
      routes: [
        { name: 'גאודי וברצלונה המודרניסטית', days: 2, stops: ['סגרדה פמיליה', 'קאסה באטיו', 'לה פדררה', 'פארק גואל'], desc: 'להזמין כרטיסים מראש — נמכרים מהר.' },
        { name: 'העיר העתיקה והים', days: 1, stops: ['הרובע הגותי', 'אל בורן', 'מוזיאון פיקאסו', 'ברצלונטה'], desc: 'לסיים בשקיעה על החוף.' }
      ],
      pois: [
        { name: 'סגרדה פמיליה', c: [41.4036, 2.1744] },
        { name: 'פארק גואל', c: [41.4145, 2.1527] },
        { name: 'הרובע הגותי', c: [41.3833, 2.1777] },
        { name: 'לה בוקריה', c: [41.3817, 2.1716] },
        { name: 'ברצלונטה', c: [41.3784, 2.1925] }
      ],
      poster: { sky: ['#F9D56E', '#F28F3B'], sun: '#FFF6D5', land: '#C8553D', far: '#588B8B', icon: 'sagrada', ink: '#3A1A12' }
    },
    {
      id: 'athens', name: 'אתונה והאיים', nameEn: 'Athens', country: 'יוון', region: 'abroad',
      iata: 'ATH', coords: [37.9838, 23.7275], zoom: 13,
      tagline: 'האקרופוליס וקפיצה לאיים',
      about: 'שעתיים טיסה מישראל: אקרופוליס, פלאקה, מונסטירקי ומעבורות לאיים — אגינה, הידרה, מיקונוס וסנטוריני.',
      currency: { code: 'EUR', name: 'אירו', rate: 4.1 }, language: 'יוונית', tzDiff: 0, flightTime: 2,
      visa: 'פטור (שנגן, עד 90 יום). מערכת ETIAS צפויה להידרש.', plug: 'C / F', emergency: '112', drivingSide: 'ימין', tipping: '5%–10%',
      climate: [13, 14, 16, 20, 25, 30, 33, 33, 29, 24, 19, 15], bestMonths: [4, 5, 6, 9, 10],
      costs: { flight: 900, hotel: { budget: 350, mid: 750, lux: 2800 }, car: 170, food: 220, transport: 25 },
      airport: {
        name: 'אלפתריוס ונזילוס', code: 'ATH',
        toCity: [
          { mode: 'מטרו קו 3 לסינטגמה', time: '40 דק׳', cost: '€9 בערך' },
          { mode: 'אוטובוס X95', time: '60–90 דק׳', cost: '€5.5 בערך' },
          { mode: 'מונית (מחיר קבוע)', time: '35–45 דק׳', cost: '€40–€55' }
        ],
        note: 'לנמל פיראוס (מעבורות לאיים): אוטובוס X96 או מטרו.'
      },
      hotels: [
        { name: 'Hotel Grande Bretagne', area: 'כיכר סינטגמה', tier: 'lux', price: 3000, note: 'מרפסת גג עם נוף לאקרופוליס' },
        { name: 'Electra Metropolis', area: 'פלאקה', tier: 'mid', price: 1200, note: 'בריכת גג' },
        { name: 'Herodion Hotel', area: 'מקרייאני', tier: 'mid', price: 900, note: 'למרגלות האקרופוליס' },
        { name: 'City Circus', area: 'פסירי', tier: 'budget', price: 350, note: 'הוסטל מעוצב' }
      ],
      car: { need: 'כן באיים ולטיולי יום לסוניון ולדלפי', companies: ['Avis', 'Hertz', 'Sixt', 'חברות מקומיות באיים'], tips: ['באיים — טרקטורונים ורכב קטן', 'רישיון בינלאומי נדרש לעיתים', 'לבדוק ביטוח צמיגים וחלון'] },
      kosherNote: 'מסעדה כשרה ובית חב״ד באתונה; באיים הגדולים לרוב בתי חב״ד עונתיים.',
      kosher: [
        { name: 'Gostijo', area: 'פסירי', note: 'מסעדה כשרה ותיקה' },
        { name: 'בית חב״ד אתונה', area: 'מרכז', note: 'ארוחות שבת בהרשמה' },
        { name: 'בתי חב״ד עונתיים', area: 'רודוס, כרתים, סנטוריני', note: 'בדרך כלל בקיץ' }
      ],
      food: [
        { name: 'Kostas Souvlaki', type: 'סובלאקי', area: 'סינטגמה', price: '€' },
        { name: 'Ta Karamanlidika tou Fani', type: 'מזטים ומעדנייה', area: 'פסירי', price: '€€' },
        { name: 'Diporto', type: 'טברנה עממית', area: 'השוק המרכזי', price: '€' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Delta', stars: 2, cuisine: 'נורדי-יווני', area: 'מרכז התרבות סטברוס ניארכוס' },
        { name: 'Hervé', stars: 1, cuisine: 'תפריט טעימות', area: 'פטראלונה' },
        { name: 'Spondi', stars: 2, cuisine: 'צרפתי-ים תיכוני', area: 'פנגרטי' }
      ],
      transit: { system: 'מטרו (3 קווים), טראם, אוטובוסים, מעבורות', card: 'ATH.ENA Card / אשראי ללא מגע', single: '€1.2 (90 דק׳)', day: '€4.1', apps: ['OASA Telematics', 'Ferryhopper', 'Google Maps'], notes: 'מעבורות מהירות לאיים — להזמין מראש בקיץ.' },
      routes: [
        { name: 'אתונה ב-2 ימים', days: 2, stops: ['האקרופוליס', 'מוזיאון האקרופוליס', 'פלאקה', 'מונסטירקי', 'גבעת ליקבטוס בשקיעה'], desc: 'לעלות לאקרופוליס בפתיחה, לפני החום.' },
        { name: 'קפיצת איים', days: 4, stops: ['פיראוס', 'אגינה', 'הידרה', 'פורוס'], desc: 'איי הסרוניק — קרובים וללא טיסה.' }
      ],
      pois: [
        { name: 'האקרופוליס', c: [37.9715, 23.7257] },
        { name: 'פלאקה', c: [37.9728, 23.7302] },
        { name: 'מונסטירקי', c: [37.9761, 23.7255] },
        { name: 'ליקבטוס', c: [37.9819, 23.7437] },
        { name: 'נמל פיראוס', c: [37.9425, 23.6466] }
      ],
      poster: { sky: ['#A7D3F2', '#FBE8C6'], sun: '#FFFBEF', land: '#1F5F8B', far: '#E8D5A9', icon: 'parthenon', ink: '#10304A' }
    },
    {
      id: 'prague', name: 'פראג', nameEn: 'Prague', country: 'צ׳כיה', region: 'abroad',
      iata: 'PRG', coords: [50.0755, 14.4378], zoom: 13,
      tagline: 'מגדלים, גשרים ושווקי חג המולד',
      about: 'גשר קארל, הטירה, הרובע היהודי יוזפוב ושוקי חורף. עיר יפה, נגישה וזולה יחסית.',
      currency: { code: 'CZK', name: 'קורונה צ׳כית', rate: 0.16 }, language: 'צ׳כית', tzDiff: -1, flightTime: 4,
      visa: 'פטור (שנגן, עד 90 יום). מערכת ETIAS צפויה להידרש.', plug: 'C / E', emergency: '112', drivingSide: 'ימין', tipping: '10%',
      climate: [2, 4, 9, 15, 19, 23, 25, 25, 19, 13, 7, 3], bestMonths: [5, 6, 9, 12],
      costs: { flight: 1300, hotel: { budget: 300, mid: 650, lux: 2500 }, car: 170, food: 180, transport: 25 },
      airport: {
        name: 'ואצלב האבל', code: 'PRG',
        toCity: [
          { mode: 'Airport Express לתחנה הראשית', time: '35 דק׳', cost: '100 קורונה בערך' },
          { mode: 'אוטובוס 119 + מטרו A', time: '45 דק׳', cost: '40 קורונה בערך' },
          { mode: 'מונית / Uber / Bolt', time: '25–30 דק׳', cost: '600–700 קורונה' }
        ],
        note: 'להזמין מונית דרך אפליקציה או דלפק רשמי.'
      },
      hotels: [
        { name: 'Four Seasons Prague', area: 'גדת הוולטבה', tier: 'lux', price: 3000, note: 'נוף לגשר קארל' },
        { name: 'Hotel Josef', area: 'העיר העתיקה', tier: 'mid', price: 800, note: 'עיצוב מינימליסטי' },
        { name: 'Hotel Paris Prague', area: 'כיכר הרפובליקה', tier: 'mid', price: 950, note: 'בניין אר נובו' },
        { name: 'Czech Inn', area: 'וינוהראדי', tier: 'budget', price: 300, note: 'הוסטל ומלון' }
      ],
      car: { need: 'לא בעיר; כן לצ׳סקי קרומלוב וקרלובי וארי', companies: ['Europcar', 'Sixt', 'Hertz'], tips: ['מדבקת כביש מהיר (Vignette) אלקטרונית', 'אורות דלוקים ביום חובה', 'אפס אלכוהול בנהיגה'] },
      kosherNote: 'הרובע היהודי יוזפוב — בתי כנסת עתיקים ומסעדות כשרות.',
      kosher: [
        { name: 'King Solomon', area: 'יוזפוב', note: 'מסעדה כשרה ותיקה' },
        { name: 'Dinitz', area: 'מרכז', note: 'לבדוק סטטוס כשרות עדכני' },
        { name: 'בית חב״ד פראג', area: 'יוזפוב', note: 'ארוחות ומינימרקט' }
      ],
      food: [
        { name: 'Lokál', type: 'צ׳כי מסורתי ובירה', area: 'העיר העתיקה', price: 'Kč' },
        { name: 'Café Savoy', type: 'בית קפה וינאי', area: 'מאלה סטראנה', price: 'Kč Kč' },
        { name: 'Manifesto Market', type: 'שוק אוכל', area: 'אנדל', price: 'Kč' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Field', stars: 1, cuisine: 'צ׳כי מודרני', area: 'העיר העתיקה' },
        { name: 'La Degustation Bohême Bourgeoise', stars: 1, cuisine: 'תפריט טעימות צ׳כי', area: 'העיר העתיקה' }
      ],
      transit: { system: 'מטרו (3 קווים), טראם, אוטובוסים, רכבל פטרין', card: 'כרטיס באפליקציה / אשראי', single: '30 קורונה (30 דק׳)', day: '120 קורונה (24 שעות)', apps: ['PID Lítačka', 'Google Maps'], notes: 'הטראם 22 עובר ליד רוב האתרים ועולה לטירה.' },
      routes: [
        { name: 'פראג הקלאסית', days: 2, stops: ['כיכר העיר העתיקה', 'השעון האסטרונומי', 'גשר קארל', 'מאלה סטראנה', 'טירת פראג', 'רובע יוזפוב'], desc: 'לחצות את הגשר מוקדם בבוקר.' },
        { name: 'יום בצ׳סקי קרומלוב', days: 1, stops: ['העיר העתיקה', 'הטירה', 'שייט על הוולטבה'], desc: 'כ-3 שעות נסיעה מפראג.' }
      ],
      pois: [
        { name: 'גשר קארל', c: [50.0865, 14.4114] },
        { name: 'טירת פראג', c: [50.0901, 14.4] },
        { name: 'כיכר העיר העתיקה', c: [50.0875, 14.4213] },
        { name: 'רובע יוזפוב', c: [50.0904, 14.4185] },
        { name: 'גבעת פטרין', c: [50.0833, 14.3954] }
      ],
      poster: { sky: ['#D6C6E1', '#F3D7C0'], sun: '#FFF4EA', land: '#4A3B5C', far: '#9C87B3', icon: 'castle', ink: '#241B30' }
    },
    {
      id: 'newyork', name: 'ניו יורק', nameEn: 'New York', country: 'ארה״ב', region: 'abroad',
      iata: 'JFK', coords: [40.7128, -74.006], zoom: 12,
      tagline: 'העיר שלא ישנה לעולם',
      about: 'מנהטן, סנטרל פארק, ברודווי, מוזיאונים ברמה עולמית ושכונות ברוקלין. יעד עם מבחר עצום של אוכל כשר.',
      currency: { code: 'USD', name: 'דולר', rate: 3.6 }, language: 'אנגלית', tzDiff: -7, flightTime: 12,
      visa: 'פטור ויזה לישראלים — נדרש אישור ESTA לפני הטיסה', plug: 'A / B (110V)', emergency: '911', drivingSide: 'ימין', tipping: '18%–22% במסעדות',
      climate: [4, 6, 10, 17, 22, 27, 29, 29, 25, 19, 13, 7], bestMonths: [4, 5, 6, 9, 10, 12],
      costs: { flight: 3800, hotel: { budget: 800, mid: 1600, lux: 5000 }, car: 280, food: 450, transport: 50 },
      airport: {
        name: 'ג׳ון פ. קנדי', code: 'JFK',
        toCity: [
          { mode: 'AirTrain + רכבת תחתית', time: '60–75 דק׳', cost: '$11 בערך' },
          { mode: 'AirTrain + LIRR לפן סטיישן', time: '45 דק׳', cost: '$17–$19' },
          { mode: 'מונית צהובה (מחיר קבוע למנהטן)', time: '45–70 דק׳', cost: '$70 + אגרות וטיפ' }
        ],
        note: 'טיסות מסוימות נוחתות בניוארק (EWR) — משם AirTrain ורכבת NJ Transit.'
      },
      hotels: [
        { name: 'The Plaza', area: 'סנטרל פארק דרום', tier: 'lux', price: 5500, note: 'אייקון ניו יורקי' },
        { name: 'Arlo SoHo', area: 'סוהו', tier: 'mid', price: 1400, note: 'חדרים קטנים, מיקום מעולה' },
        { name: 'citizenM Times Square', area: 'טיימס סקוור', tier: 'mid', price: 1500, note: 'בר גג' },
        { name: 'Pod Times Square', area: 'מידטאון', tier: 'budget', price: 800, note: 'חדרי מיקרו' }
      ],
      car: { need: 'לא במנהטן; כן לטיולים מחוץ לעיר', companies: ['Hertz', 'Avis', 'Enterprise', 'National'], tips: ['חניה במנהטן $40+ ליום', 'אגרות גשרים ומנהרות — E-ZPass', 'מע״מ מקומי ומיסים לא כלולים במחיר המוצג'] },
      kosherNote: 'מאות מסעדות כשרות: מידטאון, אפר ווסט סייד, ברוקלין (בורו פארק, קראון הייטס), קווינס.',
      kosher: [
        { name: 'Abigael\'s', area: 'מידטאון', note: 'כשר, מסעדה ותיקה' },
        { name: 'Mike\'s Bistro', area: 'מידטאון איסט', note: 'כשר, מטבח אמריקאי' },
        { name: 'מסעדות כשרות בברוקלין', area: 'בורו פארק / קראון הייטס', note: 'עשרות אפשרויות' }
      ],
      food: [
        { name: 'Katz\'s Delicatessen', type: 'דלי (לא כשר)', area: 'לואר איסט סייד', price: '$$' },
        { name: 'Joe\'s Pizza', type: 'פיצה ניו יורקית', area: 'גריניץ׳ וילג׳', price: '$' },
        { name: 'Chelsea Market', type: 'שוק אוכל', area: 'צ׳לסי', price: '$$' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Le Bernardin', stars: 3, cuisine: 'דגים', area: 'מידטאון' },
        { name: 'Per Se', stars: 3, cuisine: 'אמריקאי-צרפתי', area: 'קולומבוס סירקל' },
        { name: 'Masa', stars: 3, cuisine: 'סושי', area: 'קולומבוס סירקל' }
      ],
      transit: { system: 'סאבוויי (24/7), אוטובוסים, מעבורות', card: 'OMNY — אשראי או טלפון ללא מגע', single: '$2.9 בערך', day: 'תקרה שבועית כ-$34', apps: ['MTA', 'Citymapper', 'Google Maps'], notes: 'הסאבוויי פועל 24 שעות. המעבורת לסטטן איילנד בחינם.' },
      routes: [
        { name: 'מנהטן הקלאסית', days: 3, stops: ['טיימס סקוור', 'סנטרל פארק', 'המטרופוליטן', 'האמפייר סטייט', 'הליין הגבוה', 'אנדרטת 11/9', 'גשר ברוקלין'], desc: 'יום למידטאון, יום לפארק ולמוזיאונים, יום לדאונטאון.' },
        { name: 'ברוקלין וקווינס', days: 1, stops: ['דאמבו', 'וויליאמסבורג', 'פרוספקט פארק', 'קוני איילנד'], desc: 'שכונות, שווקים ואוכל.' }
      ],
      pois: [
        { name: 'טיימס סקוור', c: [40.758, -73.9855] },
        { name: 'סנטרל פארק', c: [40.7829, -73.9654] },
        { name: 'אמפייר סטייט', c: [40.7484, -73.9857] },
        { name: 'גשר ברוקלין', c: [40.7061, -73.9969] },
        { name: 'פסל החירות', c: [40.6892, -74.0445] }
      ],
      poster: { sky: ['#F6B38E', '#6C7FB8'], sun: '#FFE3C2', land: '#23263F', far: '#4B5580', icon: 'skyline', ink: '#15172A' }
    },
    {
      id: 'dubai', name: 'דובאי', nameEn: 'Dubai', country: 'איחוד האמירויות', region: 'abroad',
      iata: 'DXB', coords: [25.2048, 55.2708], zoom: 11,
      tagline: 'מגדלים במדבר ושמש בחורף',
      about: 'בורג׳ ח׳ליפה, המרינה, השווקים הישנים ומדבר הדיונות. יעד חורף חמים, שלוש שעות טיסה מישראל.',
      currency: { code: 'AED', name: 'דירהם', rate: 0.98 }, language: 'ערבית, אנגלית', tzDiff: 1, flightTime: 3.5,
      visa: 'ויזה בהגעה / מראש — לבדוק הנחיות עדכניות והמלצות המל״ל', plug: 'G', emergency: 'משטרה 999 · אמבולנס 998', drivingSide: 'ימין', tipping: '10%–15%',
      climate: [24, 25, 29, 33, 38, 40, 41, 41, 39, 35, 30, 26], bestMonths: [11, 12, 1, 2, 3],
      costs: { flight: 1500, hotel: { budget: 450, mid: 950, lux: 4000 }, car: 170, food: 300, transport: 35 },
      airport: {
        name: 'נמל התעופה הבינלאומי דובאי', code: 'DXB',
        toCity: [
          { mode: 'מטרו הקו האדום', time: '20–45 דק׳', cost: '5–8 דירהם' },
          { mode: 'מונית', time: '20–40 דק׳', cost: '60–100 דירהם' }
        ],
        note: 'לפני נסיעה לאמירויות — לבדוק את אזהרות המסע של המטה לביטחון לאומי.'
      },
      hotels: [
        { name: 'Burj Al Arab', area: 'ג׳ומיירה', tier: 'lux', price: 7000, note: 'המלון בצורת מפרש' },
        { name: 'Atlantis The Palm', area: 'פאלם ג׳ומיירה', tier: 'lux', price: 3500, note: 'פארק מים ואקווריום' },
        { name: 'Rove Downtown', area: 'דאונטאון', tier: 'mid', price: 650, note: 'נוף לבורג׳ ח׳ליפה' },
        { name: 'Premier Inn Dubai', area: 'מספר סניפים', tier: 'budget', price: 400, note: 'רשת נוחה ונקייה' }
      ],
      car: { need: 'שימושי; מוניות זולות יחסית', companies: ['Hertz', 'Avis', 'Sixt', 'Europcar'], tips: ['רישיון נהיגה בינלאומי', 'אגרת Salik אוטומטית', 'מצלמות מהירות רבות'] },
      kosherNote: 'יש מסעדות כשרות ומשלוחי אוכל כשר; בית חב״ד פעיל.',
      kosher: [
        { name: 'Elli\'s Kosher Kitchen', area: 'דובאי', note: 'מסעדה ומשלוחים' },
        { name: 'Armani/Kaf', area: 'בורג׳ ח׳ליפה', note: 'מסעדה כשרה במלון ארמני — לבדוק זמינות' },
        { name: 'בית חב״ד דובאי', area: 'דובאי', note: 'ארוחות שבת' }
      ],
      food: [
        { name: 'Al Ustad Special Kebab', type: 'קבב פרסי', area: 'בר דובאי', price: 'AED' },
        { name: 'Arabian Tea House', type: 'אמירתי', area: 'אל פהידי', price: 'AED AED' },
        { name: 'Time Out Market', type: 'שוק אוכל', area: 'סוק אל בחאר', price: 'AED AED' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Trèsind Studio', stars: 3, cuisine: 'הודי יצירתי', area: 'Nakheel Mall' },
        { name: 'Il Ristorante – Niko Romito', stars: 2, cuisine: 'איטלקי', area: 'Bvlgari Resort' },
        { name: 'Ossiano', stars: 1, cuisine: 'דגים', area: 'אטלנטיס' }
      ],
      transit: { system: 'מטרו (קו אדום וירוק), טראם, אוטובוסים, אבראס', card: 'Nol Card', single: '3–8 דירהם', day: '22 דירהם', apps: ['RTA Dubai', 'Careem', 'Uber'], notes: 'קרון Gold ואזורים לנשים וילדים במטרו.' },
      routes: [
        { name: 'דובאי המודרנית', days: 2, stops: ['בורג׳ ח׳ליפה', 'דובאי מול', 'המזרקה', 'המרינה', 'פאלם ג׳ומיירה'], desc: 'להזמין תצפית At the Top בשקיעה.' },
        { name: 'דובאי הישנה ומדבר', days: 2, stops: ['אל פהידי', 'שוק הזהב', 'שוק התבלינים', 'ספארי דיונות'], desc: 'ספארי מדבר אחה״צ עם ארוחת ערב.' }
      ],
      pois: [
        { name: 'בורג׳ ח׳ליפה', c: [25.1972, 55.2744] },
        { name: 'המרינה', c: [25.0805, 55.1403] },
        { name: 'פאלם ג׳ומיירה', c: [25.1124, 55.139] },
        { name: 'שוק הזהב', c: [25.2702, 55.3024] },
        { name: 'אל פהידי', c: [25.2637, 55.2995] }
      ],
      poster: { sky: ['#FAD7A0', '#E59866'], sun: '#FFF5E1', land: '#B9770E', far: '#D4AC6E', icon: 'burj', ink: '#3B2506' }
    },
    {
      id: 'bangkok', name: 'בנגקוק ותאילנד', nameEn: 'Bangkok', country: 'תאילנד', region: 'abroad',
      iata: 'BKK', coords: [13.7563, 100.5018], zoom: 12,
      tagline: 'מקדשים, אוכל רחוב ואיים טרופיים',
      about: 'שער לתאילנד: מקדשים מוזהבים, שווקים צפים, אוכל רחוב מהטובים בעולם, ומשם לאיים בדרום ולצפון ההררי.',
      currency: { code: 'THB', name: 'באט', rate: 0.11 }, language: 'תאית', tzDiff: 4, flightTime: 11,
      visa: 'פטור מוויזה לתיירות קצרה לבעלי דרכון ישראלי — לבדוק את משך השהייה המותר', plug: 'A / B / C', emergency: 'משטרת תיירים 1155 · 191', drivingSide: 'שמאל', tipping: 'לא חובה; עיגול מקובל',
      climate: [32, 33, 34, 35, 34, 33, 33, 32, 32, 32, 32, 31], bestMonths: [11, 12, 1, 2],
      costs: { flight: 3000, hotel: { budget: 150, mid: 400, lux: 1500 }, car: 130, food: 120, transport: 25 },
      airport: {
        name: 'סוברנבומי', code: 'BKK',
        toCity: [
          { mode: 'Airport Rail Link לפאיה תאי', time: '30 דק׳', cost: '45 באט' },
          { mode: 'מונית (מונה + אגרה + 50 באט)', time: '45–60 דק׳', cost: '350–450 באט' },
          { mode: 'Grab / Bolt', time: '45–60 דק׳', cost: '400–500 באט' }
        ],
        note: 'טיסות לואו-קוסט פנימיות יוצאות לרוב מדון מואנג (DMK).'
      },
      hotels: [
        { name: 'Mandarin Oriental Bangkok', area: 'גדת הצ׳או פראיה', tier: 'lux', price: 2500, note: 'מהמלונות הוותיקים באסיה' },
        { name: 'Siam Kempinski', area: 'סיאם', tier: 'lux', price: 1600, note: 'בריכה בלב העיר' },
        { name: 'Novotel Bangkok Sukhumvit', area: 'סוקומוויט', tier: 'mid', price: 450, note: 'קרוב ל-BTS' },
        { name: 'Lub d Bangkok', area: 'סילום / סיאם', tier: 'budget', price: 180, note: 'הוסטל רשת' }
      ],
      car: { need: 'לא בבנגקוק; קטנוע באיים (רק עם רישיון!)', companies: ['Avis', 'Hertz', 'Sixt', 'Thai Rent A Car'], tips: ['נהיגה בצד שמאל', 'ביטוח נסיעות לרוב לא מכסה קטנוע ללא רישיון אופנוע', 'קסדה חובה'] },
      kosherNote: 'בתי חב״ד בבנגקוק (ח׳או סאן), קופנגן, קוסמוי, צ׳יאנג מאי ופוקט עם מסעדות כשרות.',
      kosher: [
        { name: 'בית חב״ד ח׳או סאן', area: 'בנגקוק', note: 'מסעדה כשרה ובית כנסת' },
        { name: 'בתי חב״ד באיים', area: 'קופנגן / סמוי / פוקט', note: 'מסעדה כשרה בכל אחד' }
      ],
      food: [
        { name: 'Jay Fai', type: 'אוכל רחוב (כוכב מישלן)', area: 'העיר העתיקה', price: '฿฿฿' },
        { name: 'Yaowarat Road', type: 'אוכל רחוב בצ׳יינה טאון', area: 'צ׳יינה טאון', price: '฿' },
        { name: 'Or Tor Kor Market', type: 'שוק', area: 'צ׳אטוצ׳אק', price: '฿' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Sorn', stars: 3, cuisine: 'דרום תאילנדי', area: 'סוקומוויט' },
        { name: 'Le Normandie by Alain Roux', stars: 2, cuisine: 'צרפתי', area: 'מנדרין אוריינטל' },
        { name: 'Jay Fai', stars: 1, cuisine: 'אוכל רחוב', area: 'העיר העתיקה' }
      ],
      transit: { system: 'BTS Skytrain, MRT, סירות על הנהר, טוק-טוק', card: 'Rabbit Card (BTS) / אשראי ב-MRT', single: '17–60 באט', day: '150 באט (BTS)', apps: ['Grab', 'Bolt', 'ViaBus'], notes: 'סירת Chao Phraya Express — דרך יפה וזולה להגיע לארמון המלכותי.' },
      routes: [
        { name: 'בנגקוק ב-3 ימים', days: 3, stops: ['הארמון המלכותי', 'וואט פו', 'וואט ארון', 'צ׳יינה טאון', 'שוק צ׳אטוצ׳אק', 'בר גג בסילום'], desc: 'לבוש צנוע (כתפיים וברכיים מכוסות) במקדשים.' },
        { name: 'צפון ואיים', days: 10, stops: ['צ׳יאנג מאי', 'פאי', 'קופנגן', 'קו טאו', 'קראבי'], desc: 'טיסות פנים זולות בין האזורים.' }
      ],
      pois: [
        { name: 'הארמון המלכותי', c: [13.75, 100.4913] },
        { name: 'וואט ארון', c: [13.7437, 100.4889] },
        { name: 'צ׳יינה טאון', c: [13.7398, 100.5097] },
        { name: 'שוק צ׳אטוצ׳אק', c: [13.7999, 100.5502] },
        { name: 'ח׳או סאן', c: [13.7589, 100.4974] }
      ],
      poster: { sky: ['#F7C873', '#E4724B'], sun: '#FFF1C9', land: '#7A2E3B', far: '#C1664C', icon: 'temple', ink: '#2F0F15' }
    },
    {
      id: 'tokyo', name: 'טוקיו', nameEn: 'Tokyo', country: 'יפן', region: 'abroad',
      iata: 'HND', coords: [35.6762, 139.6503], zoom: 11,
      tagline: 'ניאון, מקדשים ופריחת הדובדבן',
      about: 'שינג׳וקו, שיבויה, אסקוסה ורכבות שמגיעות בדקה. אביב של סאקורה וסתיו אדום. בסיס לקיוטו ולהר פוג׳י.',
      currency: { code: 'JPY', name: 'ין', rate: 0.024 }, language: 'יפנית', tzDiff: 6, flightTime: 13,
      visa: 'פטור לתיירות קצרה (עד 90 יום)', plug: 'A / B (100V)', emergency: 'משטרה 110 · אמבולנס 119', drivingSide: 'שמאל', tipping: 'לא נהוג',
      climate: [10, 10, 14, 19, 23, 26, 30, 31, 27, 22, 17, 12], bestMonths: [3, 4, 5, 10, 11],
      costs: { flight: 4200, hotel: { budget: 350, mid: 800, lux: 3500 }, car: 250, food: 250, transport: 45 },
      airport: {
        name: 'הנדה (ונריטה)', code: 'HND',
        toCity: [
          { mode: 'Keikyu / מונורייל (מהנדה)', time: '20–30 דק׳', cost: '¥500–¥700' },
          { mode: 'Narita Express (מנריטה)', time: '60 דק׳', cost: '¥3,000 בערך' },
          { mode: 'Limousine Bus', time: '40–90 דק׳', cost: '¥1,300–¥3,200' }
        ],
        note: 'יש טיסות ישירות מתל אביב לנריטה (NRT) בחלק מהתקופות.'
      },
      hotels: [
        { name: 'Park Hyatt Tokyo', area: 'שינג׳וקו', tier: 'lux', price: 4000, note: 'מהסרט "אבודים בטוקיו"' },
        { name: 'Hotel Gracery Shinjuku', area: 'קבוקיצ׳ו', tier: 'mid', price: 750, note: 'עם ראש גודזילה על הגג' },
        { name: 'MUJI Hotel Ginza', area: 'גינזה', tier: 'mid', price: 1100, note: 'מינימליזם יפני' },
        { name: 'Khaosan Tokyo', area: 'אסקוסה', tier: 'budget', price: 250, note: 'הוסטל ליד המקדש' }
      ],
      car: { need: 'לא בטוקיו; אולי לאזור פוג׳י והוקאידו', companies: ['Toyota Rent a Car', 'Times', 'Nippon Rent-A-Car'], tips: ['נדרש רישיון בינלאומי (אמנת ז׳נבה)', 'נהיגה בצד שמאל', 'אגרות כבישים גבוהות'] },
      kosherNote: 'בית חב״ד טוקיו מציע ארוחות ומשלוחים; מעט מסעדות כשרות.',
      kosher: [
        { name: 'בית חב״ד טוקיו', area: 'מרכז', note: 'ארוחות, משלוחים ומינימרקט' },
        { name: 'בית חב״ד קיוטו / אוסקה', area: 'קנסאי', note: 'בתיאום מראש' }
      ],
      food: [
        { name: 'Ichiran', type: 'ראמן', area: 'שיבויה / שינג׳וקו', price: '¥' },
        { name: 'Tsukiji Outer Market', type: 'שוק דגים ואוכל', area: 'צוקיג׳י', price: '¥¥' },
        { name: 'Omoide Yokocho', type: 'יקיטורי בסמטאות', area: 'שינג׳וקו', price: '¥' }
      ],
      michelinNote: 'דירוג הכוכבים מתעדכן מדי שנה — אמתו במדריך מישלן לפני הזמנה.',
      michelin: [
        { name: 'Sézanne', stars: 3, cuisine: 'צרפתי', area: 'מרונואוצ׳י' },
        { name: 'Kanda', stars: 3, cuisine: 'יפני (קאיסקי)', area: 'מינאטו' },
        { name: 'Den', stars: 2, cuisine: 'יפני יצירתי', area: 'ג׳ינגומאה' }
      ],
      transit: { system: 'JR, מטרו טוקיו, Toei, שינקנסן', card: 'Suica / Pasmo (גם בטלפון)', single: '¥180–¥330', day: '¥800 (Tokyo Subway Ticket 24h)', apps: ['Google Maps', 'Japan Travel by Navitime', 'Suica'], notes: 'רכבות מדויקות לדקה. לשינקנסן לקיוטו — כ-2:15 שעות.' },
      routes: [
        { name: 'טוקיו ב-4 ימים', days: 4, stops: ['אסקוסה וסנסוג׳י', 'אקיהברה', 'שיבויה קרוסינג', 'הרג׳וקו ומקדש מייג׳י', 'שינג׳וקו בלילה', 'teamLab'], desc: 'יום לכל אזור, לילה בשינג׳וקו.' },
        { name: 'טוקיו–קיוטו', days: 5, stops: ['הקונה והר פוג׳י', 'קיוטו — פושימי אינרי', 'ארשיאמה', 'נארה'], desc: 'שינקנסן בין הערים.' }
      ],
      pois: [
        { name: 'סנסוג׳י, אסקוסה', c: [35.7148, 139.7967] },
        { name: 'שיבויה קרוסינג', c: [35.6595, 139.7005] },
        { name: 'מקדש מייג׳י', c: [35.6764, 139.6993] },
        { name: 'שינג׳וקו', c: [35.6938, 139.7034] },
        { name: 'טוקיו טאוור', c: [35.6586, 139.7454] }
      ],
      poster: { sky: ['#F9D3D8', '#F4A6A8'], sun: '#D64545', land: '#2E2A3A', far: '#6D6A8A', icon: 'pagoda', ink: '#1B1822' }
    }
  ];

  return { origin, holidays, bookingSites, destinations: D };
})();
