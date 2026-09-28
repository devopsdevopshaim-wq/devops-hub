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
        { name: 'Isrotel Royal Beach', kind: 'resort', tags: ['pool', 'spa'],  addr: "North Beach, Eilat", phone: '+972 8 636 8888', web: 'https://www.isrotel.com/isrotel-hotels/eilat/royal-beach/', area: 'הטיילת הצפונית', tier: 'lux', price: 1900, note: 'על קו המים, ספא וברכות' },
        { name: 'Dan Eilat', kind: 'resort', tags: ['family', 'pool'],  addr: "North Beach, Eilat", phone: '+972 8 636 2222', web: 'https://www.danhotels.com/', area: 'החוף הצפוני', tier: 'lux', price: 1600, note: 'מתאים למשפחות' },
        { name: 'Leonardo Plaza Eilat', addr: "Tarshish St 8, Eilat", phone: '+972 8 636 1111', web: 'https://www.leonardo-hotels.com/eilat/leonardo-plaza-hotel-eilat', area: 'הלגונה', tier: 'mid', price: 850, note: 'קרוב לטיילת ולקניון' },
        { name: 'Isrotel Yam Suf', addr: "Coral Beach, Eilat", phone: '+972 8 638 2222', web: 'https://www.isrotel.com/isrotel-hotels/eilat/isrotel-yam-suf/', area: 'חוף האלמוגים', tier: 'mid', price: 950, note: 'גישה ישירה לשונית' },
        { name: 'Herods Palace', kind: 'resort', tags: ['pool', 'spa', 'family'], addr: 'HaYam St 7, Eilat', phone: '+972 8 638 0000', web: 'https://www.herods-hotels.com/herods-hotels/herods-eilat/herods-palace/', area: 'החוף הצפוני', tier: 'lux', price: 1700, note: 'מתחם ארמון עם בריכות וספא' }
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
      vibes: { family: 3, couple: 2, nature: 2, relax: 3, culture: 0, night: 2, food: 1, adventure: 3, religious: 2 },
      fun: [
        { name: 'המצפה התת-ימי (Coral World)', type: 'אטרקציה', tags: ['family', 'nature'], addr: 'Coral Beach, Eilat', phone: '+972 8 636 4200', web: 'https://coralworld.co.il/en/', note: 'מגדל תצפית מתחת למים, כרישים וצבי ים' },
        { name: 'חוף הדולפינים (Dolphin Reef)', type: 'מים וטבע', tags: ['family', 'couple', 'nature'], addr: 'Southern Beach, Eilat', phone: '+972 8 630 0111', web: 'https://www.dolphinreef.co.il/', note: 'צפייה ושחייה ליד דולפינים, בריכות מרגוע' },
        { name: 'Ice Park — קניון הקרח', type: 'אטרקציה', tags: ['family'], addr: 'Kampen St 8, Eilat', phone: '+972 8 637 9552', web: 'https://icemalleilat.co.il/en/home/', note: 'החלקה על קרח באמצע המדבר, פתוח גם בערב' },
        { name: 'פארק תמנע', type: 'טבע', tags: ['family', 'nature', 'adventure'], addr: 'Timna Park, Arava (25 km north of Eilat)', phone: '+972 8 631 6756', web: 'https://parktimna.co.il/en/', note: 'עמודי שלמה, הקשתות ואגם — להגיע בבוקר' },
        { name: 'טיילת אילת והמרינה', type: 'בילוי ולילה', tags: ['night', 'couple'], addr: 'North Beach promenade, Eilat', note: 'ברים, מסעדות ומופעי רחוב עד השעות הקטנות' }
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
        { name: 'King David', addr: "23 King David St, Jerusalem", phone: '+972 2 620 8888', web: 'https://www.danhotels.com/JerusalemHotels/KingDavidJerusalemHotel', area: 'רחוב המלך דוד', tier: 'lux', price: 2600, note: 'מלון היסטורי מול חומות העיר' },
        { name: 'Mamilla Hotel', addr: "11 Shlomo HaMelech St, Jerusalem", phone: '+972 2 548 2222', web: 'https://www.mamillahotel.com/', area: 'ממילא', tier: 'lux', price: 2100, note: 'דקות משער יפו' },
        { name: 'Harmony Hotel', addr: "6 Yoel Moshe Salomon St, Jerusalem", phone: '+972 73 337 0000', area: 'מדרחוב נחלת שבעה', tier: 'mid', price: 800, note: 'בוטיק במרכז העיר' },
        { name: 'Abraham Hostel', kind: 'hostel', tags: ['budget'],  addr: "67 HaNevi'im St, Jerusalem", phone: '+972 2 650 2200', web: 'https://www.abraham.travel/jerusalem/', area: 'דוידקה', tier: 'budget', price: 350, note: 'הוסטל עם סיורים מאורגנים' },
        { name: 'The David Citadel', kind: 'hotel', tags: ['pool', 'view'], addr: '7 King David St, Jerusalem', phone: '+972 2 621 1111', web: 'https://www.thedavidcitadel.com/', area: 'ממילא', tier: 'lux', price: 2800, note: 'נוף לחומות העיר העתיקה' },
        { name: 'The Inbal', kind: 'hotel', tags: ['pool', 'family'], addr: '3 Jabotinsky St, Jerusalem', phone: '+972 2 675 6666', web: 'https://www.inbalhotel.com/', area: 'גן הפעמון', tier: 'lux', price: 1900, note: 'מול גן הפעמון, קרוב לתחנה הראשונה' }
      ],
      car: { need: 'לא נחוץ בתוך העיר', companies: ['שלמה סיקסט', 'אלדן', 'באדג׳ט'], tips: ['חניה במרכז יקרה ומוגבלת', 'חניוני חנה וסע ליד הרכבת הקלה', 'רכב שימושי לים המלח ולמדבר יהודה'] },
      kosherNote: 'רוב המסעדות במערב העיר כשרות. בשבת רוב המסעדות הכשרות סגורות.',
      kosher: [
        { name: 'Eucalyptus', addr: "14 Hativat Yerushalayim St (Hutzot HaYotzer), Jerusalem", phone: '+972 2 624 4331', web: 'https://www.the-eucalyptus.com/', area: 'חוצות היוצר', note: 'מטבח ישראלי-תנ״כי, כשר' },
        { name: 'Angelica', addr: "4 George Washington St, Jerusalem", phone: '+972 2 623 0056', web: 'https://angelicarest.com/en/', area: 'מרכז העיר', note: 'מסעדת שף, כשרה' },
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
      vibes: { family: 2, couple: 2, nature: 1, relax: 1, culture: 3, night: 2, food: 3, adventure: 0, religious: 3 },
      fun: [
        { name: 'מוזיאון ישראל', type: 'מוזיאון', tags: ['culture', 'family'], addr: '11 Ruppin Blvd, Jerusalem', phone: '+972 2 670 8811', web: 'https://www.imj.org.il/en', note: 'היכל הספר (מגילות ים המלח) ודגם ירושלים' },
        { name: 'מופע הלילה במגדל דוד', type: 'בילוי ולילה', tags: ['couple', 'family', 'culture', 'night'], addr: 'Tower of David, Jaffa Gate, Jerusalem', phone: '+972 2 626 5333', web: 'https://www.tod.org.il/en/night-shows/', note: 'מופע אור-קולי על חומות המצודה, 45 דק׳ — להזמין מראש' },
        { name: 'הגן הזואולוגי התנ״כי', type: 'אטרקציה', tags: ['family', 'nature'], addr: 'Aharon Shulov 1, Jerusalem', phone: '+972 2 675 0111', web: 'https://www.jerusalemzoo.org.il/en/biblical-zoo', note: 'פתוח גם בשבת (בתשלום מראש)' },
        { name: 'התחנה הראשונה', type: 'בילוי ולילה', tags: ['family', 'couple', 'food', 'night'], addr: 'End of Emek Refaim, Jerusalem', web: 'https://www.firststation.co.il/en/', note: 'מתחם תחנת רכבת היסטורית עם מסעדות, הופעות ומסלול אופניים' },
        { name: 'מחנה יהודה בלילה', type: 'בילוי ולילה', tags: ['night', 'food', 'couple'], addr: 'Mahane Yehuda Market, Jerusalem', note: 'אחרי שהדוכנים נסגרים — ברים ומוזיקה בסמטאות השוק' }
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
        { name: 'The Norman', kind: 'boutique', tags: ['couple'],  addr: "23–25 Nachmani St, Tel Aviv", phone: '+972 3 543 5555', web: 'https://www.thenorman.com/', area: 'שדרות רוטשילד', tier: 'lux', price: 3000, note: 'מלון בוטיק יוקרתי' },
        { name: 'The Setai', addr: "22 David Raziel St, Jaffa", phone: '+972 3 601 6000', web: 'https://thesetaihotels.com/en/setai-tel-aviv/', area: 'יפו', tier: 'lux', price: 2600, note: 'בניין עות׳מאני משוחזר' },
        { name: 'Brown TLV', kind: 'boutique', tags: ['couple'],  addr: "25 Kalisher St, Tel Aviv", phone: '+972 3 717 0200', web: 'https://brownhotels.com/tlv', area: 'מרכז העיר', tier: 'mid', price: 950, note: 'בר גג וסטייל' },
        { name: 'Abraham Tel Aviv', kind: 'hostel', tags: ['budget'],  addr: "21 Levontin St, Tel Aviv", phone: '+972 3 624 9200', web: 'https://www.abraham.travel/tel-aviv/', area: 'לוינסקי', tier: 'budget', price: 400, note: 'הוסטל חברתי' },
        { name: 'Carlton Tel Aviv', kind: 'hotel', tags: ['pool', 'view'], addr: '10 Eliezer Peri St, Tel Aviv', phone: '+972 3 520 1818', web: 'https://www.carlton.co.il/en/', area: 'המרינה', tier: 'lux', price: 2000, note: 'בריכת גג מול הים' },
        { name: 'Dan Tel Aviv', kind: 'hotel', tags: ['pool', 'family', 'view'], addr: '99 HaYarkon St, Tel Aviv', phone: '+972 3 520 2525', web: 'https://www.danhotels.com/TelAvivHotels/DanTelAvivHotel', area: 'טיילת הירקון', tier: 'lux', price: 2400, note: 'מלון ותיק על קו החוף' }
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
      vibes: { family: 2, couple: 3, nature: 1, relax: 2, culture: 2, night: 3, food: 3, adventure: 1, religious: 1 },
      fun: [
        { name: 'לונה פארק תל אביב', type: 'אטרקציה', tags: ['family', 'adventure'], addr: 'Rokach Blvd 101, Tel Aviv', phone: '+972 3 642 7080', web: 'https://www.lunapark.co.il/', note: 'פארק שעשועים בגני התערוכה' },
        { name: 'הספארי ברמת גן', type: 'טבע', tags: ['family', 'nature'], addr: 'Sderat HaTzvi 1, Ramat Gan', phone: '+972 3 632 0222', web: 'https://www.safari.co.il/', note: 'נסיעה ברכב בין בעלי חיים אפריקאיים' },
        { name: 'מוזיאון תל אביב לאמנות', type: 'מוזיאון', tags: ['culture', 'couple'], addr: '27 Shaul HaMelech Blvd, Tel Aviv', phone: '+972 3 607 7000', web: 'https://www.tamuseum.org.il/en/', note: 'אמנות ישראלית ובינלאומית' },
        { name: 'שוק שרונה', type: 'אוכל', tags: ['food', 'couple', 'family'], addr: '3 Aluf Kalman Magen St, Tel Aviv', note: 'שוק אוכל מקורה גדול; שישי עד אחה״צ' },
        { name: 'רוטשילד, פלורנטין והנמל', type: 'בילוי ולילה', tags: ['night', 'couple'], addr: 'Rothschild Blvd / Florentin / Tel Aviv Port', note: 'ברים, מועדונים ומסעדות — העיר שלא נרדמת' }
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
        { name: 'The Scots Hotel', kind: 'boutique', tags: ['couple'],  addr: "1 Gdud Barak St, Tiberias", phone: '+972 4 671 0710', web: 'https://www.scotshotels.com/', area: 'טבריה', tier: 'lux', price: 2000, note: 'בית חולים סקוטי היסטורי על הכנרת' },
        { name: 'Pina Barosh', kind: 'boutique', tags: ['couple'],  addr: "8 HaChalutzim St, Rosh Pina", phone: '+972 4 848 7474', web: 'https://en.pina-barosh.com/', area: 'ראש פינה', tier: 'mid', price: 1100, note: 'בוטיק במושבה הוותיקה' },
        { name: 'כפר הנופש עין גב', kind: 'kibbutz', tags: ['family', 'nature'],  addr: "Kibbutz Ein Gev", phone: '+972 4 665 9800', web: 'https://eingev.com/en/', area: 'חוף מזרחי של הכנרת', tier: 'mid', price: 800, note: 'חוף פרטי' },,
        { name: 'Vered HaGalil', kind: 'farm', tags: ['couple', 'nature', 'view'], addr: 'Vered HaGalil, near Korazim', phone: '+972 4 693 5785', web: 'https://www.veredhagalil.com/', area: 'מעל הכנרת', tier: 'mid', price: 900, note: 'חוות אירוח עם בקתות עץ ורכיבה על סוסים' },
        { name: 'Mizpe Hayamim', kind: 'spa', tags: ['couple', 'spa', 'adults', 'view'], addr: 'Rosh Pina (Upper Galilee)', phone: '+972 4 699 4555', web: 'https://www.mizpe-hayamim.com/', area: 'ראש פינה', tier: 'lux', price: 2200, note: 'מלון ספא עם חווה אורגנית' },
        { name: 'Merom Golan Resort Village', kind: 'cabins', tags: ['family', 'nature', 'view'], addr: 'Kibbutz Merom Golan', phone: '+972 4 696 0267', web: 'https://english.meromgolantourism.co.il/', area: 'הגולן, מול הר בנטל', tier: 'mid', price: 750, note: 'בקתות עץ וסוויטות בקיבוץ' },
        { name: 'Ramot Resort', kind: 'cabins', tags: ['couple', 'nature', 'view'], web: 'https://ramot-nofesh.co.il/en/', area: 'רמות, מעל הכנרת', tier: 'mid', price: 1000, note: 'בקתות עץ וצ׳אלטים עם ג׳קוזי פרטי' },
        { name: 'Pastoral Kfar Blum', kind: 'kibbutz', tags: ['family', 'nature', 'pool'], addr: 'Kibbutz Kfar Blum', phone: '+972 4 683 6611', web: 'https://www.pastoral-hotel.com/', area: 'עמק החולה', tier: 'mid', price: 800, note: 'מלון קיבוץ ליד הקיאקים בירדן' }
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
      vibes: { family: 3, couple: 3, nature: 3, relax: 2, culture: 2, night: 0, food: 2, adventure: 3, religious: 2 },
      fun: [
        { name: 'חמת גדר', type: 'מים וספא', tags: ['family', 'couple', 'relax'], addr: 'Hamat Gader, southern Golan', phone: '+972 4 665 9999', web: 'https://hamat-gader.com/en/', note: 'מעיינות חמים, חוות תנינים ופארק' },
        { name: 'קיאקים כפר בלום', type: 'אקסטרים ומים', tags: ['family', 'adventure', 'nature'], addr: 'Kibbutz Kfar Blum', phone: '+972 4 690 2616', note: 'שייט קיאקים ורפטינג בירדן; קיץ בעיקר' },
        { name: 'יקב רמת הגולן', type: 'יין ואוכל', tags: ['couple', 'food'], addr: 'Derech HaYayin 4, Katzrin', phone: '+972 4 696 8435', note: 'סיורים וטעימות; סגור בשבת' },
        { name: 'אגמון החולה', type: 'טבע', tags: ['family', 'couple', 'nature'], addr: 'Agamon Hula, Hula Valley', phone: '+972 4 681 7137', note: 'צפרות ונדידת עגורים (סתיו–חורף), אופניים ועגלות גולף' }
      ],
      poster: { sky: ['#BFE0C8', '#F2E8C9'], sun: '#FFFBEA', land: '#4E7F52', far: '#8DB38B', icon: 'hills-lake', ink: '#1F3A22' }
    },

    /* ------------------------------ חו"ל ------------------------------ */
    {
      id: 'deadsea', name: 'ים המלח', nameEn: 'Dead Sea', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [31.33, 35.37], zoom: 10,
      tagline: 'הנקודה הנמוכה בעולם: ציפה, בוץ ומדבר',
      about: 'עין בוקק ומלונות הספא, קיבוץ עין גדי והשמורה, מצדה בזריחה ומדבר יהודה. חופשת רוגע והחלמה כמעט כל השנה, עם חורף חמים ונעים.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [20, 21, 25, 30, 34, 37, 39, 39, 36, 32, 26, 21], bestMonths: [11, 12, 1, 2, 3, 4],
      costs: { flight: 0, hotel: { budget: 450, mid: 1100, lux: 2600 }, car: 170, food: 230, transport: 40 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכב (דרך ירושלים וכביש 90)', time: 'שעה וחצי–שעתיים', cost: 'דלק כ-₪100' },
          { mode: 'אוטובוס בין-עירוני מירושלים', time: 'כשעתיים', cost: '₪25–₪40 בערך' }
        ],
        note: 'מירושלים כשעה נסיעה. אין רכבת לים המלח, והתחבורה הציבורית דלילה.'
      },
      hotels: [
        { name: 'Kayma by Isrotel', kind: 'spa', tags: ['couple', 'adults', 'spa', 'pool'], web: 'https://www.isrotel.com/isrotel-hotels/dead-sea/kayma/', area: 'עין בוקק', tier: 'lux', price: 7000, note: 'מלון בוטיק למבוגרים בלבד (נפתח 2025), בריכת אינסוף' },
        { name: 'Nevo by Isrotel (לשעבר Isrotel Dead Sea)', kind: 'resort', tags: ['family', 'spa', 'pool'], addr: 'Route 90, Ein Bokek', phone: '+972 8 668 9666', web: 'https://www.isrotel.com/isrotel-hotels/dead-sea/', area: 'עין בוקק', tier: 'mid', price: 1100, note: 'ספא ובריכות, קרוב לחוף הציבורי' },
        { name: 'David Dead Sea Resort & Spa', kind: 'spa', tags: ['family', 'spa', 'pool'], addr: 'Ein Bokek', phone: '+972 8 659 1234', web: 'https://www.grandhotels-israel.com/david-dead-sea-hotel-contact-us', area: 'עין בוקק', tier: 'mid', price: 1300, note: 'ספא גדול ובריכות גופרית' },
        { name: 'Ein Gedi Kibbutz Hotel', kind: 'kibbutz', tags: ['couple', 'nature', 'family'], addr: 'Kibbutz Ein Gedi', phone: '+972 8 659 4220', web: 'https://ngedi.co.il/en/contact-us/', area: 'קיבוץ עין גדי', tier: 'mid', price: 1100, note: 'מלון בתוך גן בוטני, קרוב לשמורה' },
        { name: 'HI Masada Hostel', kind: 'hostel', tags: ['budget', 'family'], web: 'https://en.iyha.org.il/masada-hostel', area: 'למרגלות מצדה', tier: 'budget', price: 400, note: 'אכסניה עם בריכה, מושלם לזריחה במצדה' }
      ],
      car: { need: 'מומלץ — המרחקים גדולים', companies: ['שלמה סיקסט', 'אלדן', 'Hertz', 'Avis'], tips: ['שתו הרבה מים — חם מאוד רוב השנה', 'במצדה: לעלות מוקדם בבוקר או ברכבל', 'לא לטבול את הראש ולא להתיז — המים צורבים בעיניים'] },
      kosherNote: 'רוב המלונות הגדולים בעין בוקק בכשרות רבנות — בדקו תעודה בתוקף.',
      kosher: [
        { name: 'חדרי האוכל במלונות עין בוקק', area: 'עין בוקק', note: 'ארוחות בוקר וערב כשרות ברוב המלונות' }
      ],
      food: [
        { name: 'מסעדות המלונות בעין בוקק', type: 'מזנונים ומסעדות', area: 'עין בוקק', price: '₪₪' },
        { name: 'חדר האוכל של קיבוץ עין גדי', type: 'אוכל ביתי', area: 'עין גדי', price: '₪₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן.', michelin: [],
      transit: { system: 'אוטובוסים בין-עירוניים', card: 'רב-קו', single: '₪25–₪40', day: '—', apps: ['Moovit', 'רב-פס'], notes: 'תדירות נמוכה ואין תחבורה בשבת. רכב נוח בהרבה.' },
      routes: [
        { name: 'זריחה במצדה ועין גדי', days: 1, stops: ['שביל הנחש במצדה בזריחה', 'המוזיאון במצדה', 'שמורת עין גדי — נחל דוד', 'ציפה בחוף עין בוקק'], desc: 'לצאת לפני הזריחה; בקיץ לסיים עד הצהריים.' },
        { name: 'סופ״ש ספא ורוגע', days: 2, stops: ['החוף הציבורי בעין בוקק', 'בריכות גופרית וטיפולים במלון', 'בוץ ים המלח', 'שקיעה מעל הרי מואב'], desc: 'חופשה בלי נהיגה ובלי לחץ.' }
      ],
      pois: [
        { name: 'מצדה', c: [31.3156, 35.3536] },
        { name: 'שמורת עין גדי', c: [31.4659, 35.3884] },
        { name: 'קיבוץ עין גדי', c: [31.4518, 35.3843] },
        { name: 'חוף עין בוקק', c: [31.2004, 35.3623] }
      ],
      fun: [
        { name: 'מצדה והרכבל', type: 'היסטוריה וטבע', tags: ['family', 'culture', 'adventure'], addr: 'Masada National Park, Route 90', web: 'https://en.parks.org.il/reserve-park/masada-national-park/', note: 'שביל הנחש בזריחה או רכבל; קיץ 8:00–17:00' },
        { name: 'שמורת עין גדי', type: 'טבע', tags: ['family', 'nature'], addr: 'Ein Gedi Nature Reserve, Route 90', phone: '+972 8 658 4285', web: 'https://en.parks.org.il/reserve-park/en-gedi-nature-reserve/', note: 'אחרי נזקי שיטפון רק חלק מהמסלולים פתוחים (נחל דוד עד המפל הראשון) — בדקו לפני' },
        { name: 'החוף הציבורי בעין בוקק', type: 'מים וספא', tags: ['family', 'couple', 'relax'], addr: 'Ein Bokek public beach', note: 'חוף חינם עם מקלחות וצל' }
      ],
      vibes: { family: 2, couple: 2, nature: 3, relax: 3, culture: 2, night: 0, food: 1, adventure: 1, religious: 2 },
      poster: { sky: ['#F6DDB4', '#E7B37A'], sun: '#FFF4DA', land: '#5E9EA0', far: '#C9A073', icon: 'mesa', sea: true, ink: '#3E2A18' }
    },
    {
      id: 'mitzperamon', name: 'מצפה רמון והנגב', nameEn: 'Mitzpe Ramon', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [30.6102, 34.8015], zoom: 12,
      tagline: 'המכתש הגדול, שקט מדברי ושמיים מלאי כוכבים',
      about: 'מצפה רמון יושבת על שפת מכתש רמון: טיולי ג׳יפים ורגליים, תצפית כוכבים, חוות אלפקות ולינה מדברית — ממלון יוקרה על שפת המכתש ועד סוכות במדבר.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [15, 17, 20, 25, 29, 32, 33, 33, 31, 27, 21, 17], bestMonths: [3, 4, 5, 10, 11],
      costs: { flight: 0, hotel: { budget: 400, mid: 800, lux: 3200 }, car: 170, food: 200, transport: 30 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכב (דרך באר שבע)', time: 'כשעתיים וחצי', cost: 'דלק כ-₪130' },
          { mode: 'רכבת לבאר שבע ואוטובוס', time: 'כשלוש שעות', cost: '₪45–₪60 בערך' }
        ],
        note: 'רכב מומלץ מאוד — המרחקים במכתש ובנגב גדולים.'
      },
      hotels: [
        { name: 'Beresheet by Isrotel', kind: 'resort', tags: ['couple', 'spa', 'pool', 'view'], addr: 'Derech Beresheet 1, Mitzpe Ramon', phone: '+972 8 659 8000', web: 'https://www.isrotel.com/isrotel-hotels/negev-desert/beresheet/', area: 'שפת המכתש', tier: 'lux', price: 3200, note: 'וילות על שפת המכתש, בריכת אינסוף' },
        { name: 'Daroma by Isrotel (לשעבר Ramon Inn)', kind: 'hotel', tags: ['family'], addr: '1 Ein Akev St, Mitzpe Ramon', phone: '+972 8 658 8822', area: 'מרכז העיירה', tier: 'mid', price: 800, note: 'מלון נוח לבסיס טיולים' },
        { name: 'Succah in the Desert', kind: 'lodge', tags: ['couple', 'nature'], phone: '+972 8 658 6280', web: 'https://www.succah.co.il/', area: 'מדבר ליד מצפה רמון', tier: 'mid', price: 700, note: 'סוכות אבן ועץ מבודדות — שקט וכוכבים' }
      ],
      car: { need: 'חיוני', companies: ['שלמה סיקסט', 'אלדן', 'Hertz'], tips: ['4×4 רק בדרכים מסומנות — או סיור ג׳יפים מאורגן', 'לא לנהוג בלילה בדרכי עפר', 'תדלקו ותצטיידו במים לפני היציאה למכתש'] },
      kosherNote: 'במלונות הגדולים יש כשרות — בדקו תעודה עדכנית. בעיירה מעט מסעדות.',
      kosher: [
        { name: 'חדרי האוכל במלונות', area: 'מצפה רמון', note: 'לבדוק תעודת כשרות עדכנית' }
      ],
      food: [
        { name: 'בתי הקפה והמסעדות בעיירה', type: 'בתי קפה ופיצה', area: 'מרכז מצפה רמון', price: '₪₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן.', michelin: [],
      transit: { system: 'אוטובוסים מבאר שבע', card: 'רב-קו', single: '₪15–₪25', day: '—', apps: ['Moovit', 'רב-פס'], notes: 'תדירות נמוכה ואין תחבורה בשבת.' },
      routes: [
        { name: 'סובב מכתש רמון', days: 2, stops: ['מרכז המבקרים', 'טיילת שפת המכתש', 'המנסרה (סלעי המנסרה)', 'עין סהרונים', 'חוות האלפקות', 'תצפית כוכבים בלילה'], desc: 'יום לתוך המכתש, ערב לכוכבים.' }
      ],
      pois: [
        { name: 'מרכז המבקרים מכתש רמון', c: [30.6118, 34.804] },
        { name: 'מרכז מצפה רמון', c: [30.6102, 34.8015] }
      ],
      fun: [
        { name: 'מרכז המבקרים מכתש רמון', type: 'מוזיאון וטבע', tags: ['family', 'culture', 'nature'], addr: "Ma'ale Ben Tur 1, Mitzpe Ramon", phone: '+972 8 658 8691', note: 'תערוכה אינטראקטיבית על שפת המכתש, סיור כשעה' },
        { name: 'חוות האלפקות', type: 'אטרקציה', tags: ['family', 'nature'], phone: '+972 8 658 8047', web: 'https://alpaca.co.il/en/', note: 'פתוח חמישי–ראשון ובחופשות; גם לינה' },
        { name: 'תצפית כוכבים', type: 'טבע ולילה', tags: ['couple', 'family', 'nature', 'night'], note: 'שמיים חשוכים במיוחד — מומלץ סיור מודרך עם טלסקופ' },
        { name: 'סיורי ג׳יפים במכתש', type: 'אקסטרים', tags: ['adventure', 'family', 'nature'], note: 'מסלולי שטח בליווי מדריך' }
      ],
      vibes: { family: 2, couple: 3, nature: 3, relax: 2, culture: 0, night: 0, food: 1, adventure: 3, religious: 1 },
      poster: { sky: ['#F2C99A', '#D9825B'], sun: '#FFEBD0', land: '#8C4B2F', far: '#C17A52', icon: 'mesa', ink: '#3A1D12' }
    },
    {
      id: 'haifa', name: 'חיפה והכרמל', nameEn: 'Haifa', country: 'ישראל', region: 'il',
      iata: 'TLV', coords: [32.8141, 34.9876], zoom: 12,
      tagline: 'גנים תלויים, הר וים, יערות ויין',
      about: 'הגנים הבהאיים, המושבה הגרמנית, הרכבל לסטלה מאריס, מדעטק ויערות הכרמל. בסביבה: עין הוד, זכרון יעקב והיקבים. עיר מעורבת שחלק מהתחבורה בה פועל גם בשבת.',
      currency: { code: 'ILS', name: 'שקל', rate: 1 }, language: 'עברית, ערבית', tzDiff: 0, flightTime: 0,
      visa: 'אין צורך', plug: 'H / C', emergency: 'משטרה 100 · מד"א 101', drivingSide: 'ימין', tipping: '10%–15% במסעדות',
      climate: [18, 19, 21, 25, 27, 30, 31, 32, 31, 28, 24, 20], bestMonths: [4, 5, 6, 9, 10, 11],
      costs: { flight: 0, hotel: { budget: 400, mid: 750, lux: 1800 }, car: 170, food: 200, transport: 25 },
      airport: {
        name: 'נתב"ג', code: 'TLV',
        toCity: [
          { mode: 'רכבת ישראל לחיפה', time: 'כשעה וחצי', cost: '₪30–₪45 בערך' },
          { mode: 'רכב', time: 'כשעה וחצי', cost: 'דלק כ-₪80' }
        ],
        note: 'רכבת ישירה לתחנות חיפה; משם כרמלית או אוטובוס לכרמל.'
      },
      hotels: [
        { name: 'Dan Carmel Haifa', kind: 'hotel', tags: ['view', 'pool'], addr: '85–87 HaNassi Ave, Haifa', phone: '+972 4 830 3030', web: 'https://www.danhotels.com/HaifaHotels/DanCarmelHaifaHotel', area: 'מרכז הכרמל', tier: 'lux', price: 1300, note: 'נוף למפרץ מראש הכרמל' },
        { name: 'The Colony Hotel', kind: 'boutique', tags: ['couple'], addr: '28 Ben Gurion Blvd, Haifa', phone: '+972 4 851 3344', web: 'https://colonyhaifa.com/', area: 'המושבה הגרמנית', tier: 'mid', price: 700, note: 'בניין בן יותר מ-100 שנה, למרגלות הגנים הבהאיים' },
        { name: 'Carmel Forest Spa Resort', kind: 'spa', tags: ['couple', 'spa', 'nature'], addr: 'Beit Oren, Carmel Forest', phone: '+972 8 638 7797', web: 'https://www.isrotel.com/isrotel-hotels/north-hotels/haifa/carmel-forest/', area: 'יערות הכרמל', tier: 'lux', price: 2600, note: 'ספא הבריאות הגדול בישראל, בלב היער' },
        { name: 'Elma Arts Complex Hotel', kind: 'boutique', tags: ['couple', 'culture', 'view'], addr: '1 Yair St, Zichron Yaakov', phone: '+972 4 630 0111', web: 'https://www.theelmahotel.com/', area: 'זכרון יעקב', tier: 'lux', price: 1600, note: 'מלון אמנות עם אולם קונצרטים ונוף לים' }
      ],
      car: { need: 'שימושי לכרמל ולזכרון; בעיר — תחבורה ציבורית', companies: ['שלמה סיקסט', 'אלדן', 'Hertz'], tips: ['העיר תלולה — חניה ברחובות הכרמל מאתגרת', 'הכרמלית חוסכת עליות', 'בשבת חלק מהקווים פועלים'] },
      kosherNote: 'יש מסעדות כשרות במרכז הכרמל ובמרכזי הקניות; חלק מהמסעדות בעיר אינן כשרות — בדקו תעודה.',
      kosher: [
        { name: 'מסעדות כשרות במרכז הכרמל', area: 'מרכז הכרמל', note: 'לבדוק תעודה בתוקף' }
      ],
      food: [
        { name: 'מסעדות המושבה הגרמנית', type: 'מגוון', area: 'שדרות בן גוריון', price: '₪₪' },
        { name: 'חומוס ומאפים בוואדי ניסנאס', type: 'מטבח ערבי מסורתי', area: 'ואדי ניסנאס', price: '₪' }
      ],
      michelinNote: 'בישראל אין מדריך מישלן.', michelin: [],
      transit: { system: 'כרמלית (רכבת תחתית), מטרונית, אוטובוסים, רכבל', card: 'רב-קו', single: '₪5.5', day: 'לפי תעריף רב-קו', apps: ['Moovit', 'רב-פס'], notes: 'הכרמלית עולה מהעיר התחתית לכרמל. חלק מהקווים בחיפה פועלים גם בשבת.' },
      routes: [
        { name: 'חיפה ביום אחד', days: 1, stops: ['הגנים הבהאיים (סיור מודרך)', 'המושבה הגרמנית', 'הרכבל לסטלה מאריס', 'חוף בת גלים'], desc: 'להזמין מראש סיור בגנים.' },
        { name: 'כרמל, עין הוד וזכרון', days: 2, stops: ['יערות הכרמל', 'כפר האמנים עין הוד', 'מדרחוב זכרון יעקב', 'יקב בזכרון'], desc: 'אווירה כפרית ויין.' }
      ],
      pois: [
        { name: 'הגנים הבהאיים', c: [32.8145, 34.987] },
        { name: 'המושבה הגרמנית', c: [32.8196, 34.9897] },
        { name: 'סטלה מאריס', c: [32.8267, 34.9713] },
        { name: 'מדעטק', c: [32.8083, 34.9938] }
      ],
      fun: [
        { name: 'הגנים הבהאיים', type: 'אתר וגנים', tags: ['couple', 'culture', 'family'], addr: '45 Yefe Nof St, Haifa', phone: '+972 4 831 3131', web: 'https://ganbahai.org.il/visit-us-haifa/', note: 'כניסה חופשית; סיור מודרך באנגלית (כ-50 דק׳)' },
        { name: 'מדעטק — המוזיאון הלאומי למדע', type: 'מוזיאון', tags: ['family', 'culture'], addr: '25 Shmaryahu Levin St, Haifa', phone: '+972 4 861 4444', web: 'https://www.madatech.org.il/en/', note: 'מוזיאון מדע אינטראקטיבי לכל המשפחה' },
        { name: 'הרכבל בת גלים — סטלה מאריס', type: 'אטרקציה', tags: ['family', 'couple'], phone: '+972 4 833 5970', note: 'נסיעה קצרה עם נוף למפרץ' },
        { name: 'המושבה הגרמנית בערב', type: 'בילוי ולילה', tags: ['couple', 'food', 'night'], addr: 'Ben Gurion Blvd, Haifa', note: 'מסעדות וברים מול המדרגות המוארות של הגנים' }
      ],
      vibes: { family: 2, couple: 2, nature: 2, relax: 1, culture: 2, night: 1, food: 2, adventure: 1, religious: 2 },
      poster: { sky: ['#BFE3DD', '#EAD9B0'], sun: '#FFF8E4', land: '#2F6F5E', far: '#7FB29B', icon: 'city-sea', ink: '#143A30' }
    },
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
        { name: 'Le Meurice', addr: "228 Rue de Rivoli, 75001 Paris", phone: '+33 1 44 58 10 10', web: 'https://www.dorchestercollection.com/paris/le-meurice', area: 'רחוב ריבולי', tier: 'lux', price: 6000, note: 'מול גני טווילרי' },
        { name: 'Hôtel des Grands Boulevards', kind: 'boutique', tags: ['couple'],  addr: "17 Bd Poissonnière, 75002 Paris", phone: '+33 1 85 73 33 33', web: 'https://www.grandsboulevardshotel.com/', area: 'הרובע ה-2', tier: 'mid', price: 1300, note: 'בוטיק עם מסעדה' },
        { name: 'Hôtel Fabric', addr: "31 Rue de la Folie Méricourt, 75011 Paris", phone: '+33 1 43 57 27 00', web: 'https://www.hotelfabric.com/', area: 'הרובע ה-11', tier: 'mid', price: 950, note: 'לופט תעשייתי שקט' },
        { name: 'Generator Paris', kind: 'hostel', tags: ['budget'],  addr: "9–11 Place du Colonel Fabien, 75010 Paris", phone: '+33 1 70 98 84 00', web: 'https://staygenerator.com/hostels/paris', area: 'הרובע ה-10', tier: 'budget', price: 450, note: 'הוסטל עם חדרים פרטיים' }
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
        { name: 'Guy Savoy', addr: "11 Quai de Conti, 75006 Paris", phone: '+33 1 43 80 40 61', web: 'https://www.guysavoy.com/en', stars: 3, cuisine: 'צרפתי עכשווי', area: 'מטבעה של פריז' },
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
      vibes: { family: 2, couple: 3, nature: 0, relax: 1, culture: 3, night: 2, food: 3, adventure: 0, religious: 2 },
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
        { name: 'The Savoy', addr: "Strand, London WC2R 0EZ", phone: '+44 20 7836 4343', web: 'https://www.thesavoylondon.com/', area: 'סטרנד', tier: 'lux', price: 5500, note: 'אייקון על התמזה' },
        { name: 'citizenM Tower of London', addr: "40 Trinity Square, London EC3N 4DJ", phone: '+44 20 3519 4830', web: 'https://www.citizenm.com/', area: 'טאוור היל', tier: 'mid', price: 1100, note: 'חדרים קומפקטיים ונוף' },
        { name: 'The Hoxton Holborn', addr: "199–206 High Holborn, London WC1V 7BD", phone: '+44 20 7661 3000', web: 'https://thehoxton.com/london/holborn/', area: 'הולבורן', tier: 'mid', price: 1300, note: 'מרכזי ותוסס' },
        { name: 'Generator London', kind: 'hostel', tags: ['budget'],  addr: "37 Tavistock Place, London WC1H 9SE", phone: '+44 20 7388 7666', web: 'https://staygenerator.com/hostels/london/kingscross', area: 'קינגס קרוס', tier: 'budget', price: 500, note: 'הוסטל ליד תחנת הרכבת' }
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
      vibes: { family: 2, couple: 2, nature: 1, relax: 1, culture: 3, night: 3, food: 2, adventure: 0, religious: 3 },
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
        { name: 'Hotel Hassler Roma', addr: "Piazza della Trinità dei Monti 6, 00187 Roma", phone: '+39 06 699340', web: 'https://www.hotelhasslerroma.com/', area: 'ראש המדרגות הספרדיות', tier: 'lux', price: 4500, note: 'נוף על העיר' },
        { name: 'Hotel Artemide', addr: "Via Nazionale 22, 00184 Roma", phone: '+39 06 489911', web: 'https://www.hotelartemide.it/', area: 'Via Nazionale', tier: 'mid', price: 1000, note: 'קרוב לטרמיני' },
        { name: 'Hotel Santa Maria', addr: "Vicolo del Piede 2, 00153 Roma", phone: '+39 06 589 4626', web: 'https://www.hotelsantamariatrastevere.it/', area: 'טרסטוורה', tier: 'mid', price: 1050, note: 'חצר פנימית שקטה' },
        { name: 'The Beehive', kind: 'hostel', tags: ['budget'],  addr: "Via Marghera 8, 00185 Roma", phone: '+39 06 4470 4553', web: 'https://www.the-beehive.com/', area: 'טרמיני', tier: 'budget', price: 400, note: 'אכסניה ידידותית' }
      ],
      car: { need: 'לא בעיר (אזורי ZTL); כן לטוסקנה', companies: ['Europcar', 'Hertz', 'Sixt', 'Maggiore'], tips: ['ZTL — קנסות אוטומטיים על כניסה למרכז', 'אגרות בכבישים המהירים', 'לתעד את הרכב בווידאו באיסוף'] },
      kosherNote: 'הגטו היהודי ליד בית הכנסת הגדול — רחוב Via del Portico d\'Ottavia.',
      kosher: [
        { name: 'Ba\'Ghetto', addr: "Via del Portico d'Ottavia 57, 00186 Roma", phone: '+39 06 6889 2868', web: 'https://www.baghetto.com/en/', area: 'הגטו היהודי', note: 'מטבח רומאי-יהודי, כשר' },
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
      vibes: { family: 2, couple: 3, nature: 0, relax: 1, culture: 3, night: 2, food: 3, adventure: 0, religious: 2 },
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
        { name: 'Hotel Arts Barcelona', addr: "Carrer de la Marina 19–21, 08005 Barcelona", phone: '+34 93 221 1000', web: 'https://www.ritzcarlton.com/en/hotels/bcnrz-hotel-arts-barcelona/overview/', area: 'הנמל האולימפי', tier: 'lux', price: 3800, note: 'מגדל על הים' },
        { name: 'Casa Bonay', kind: 'boutique', tags: ['couple'],  addr: "Gran Via de les Corts Catalanes 700, 08010 Barcelona", phone: '+34 935 458 050', web: 'https://casabonay.com/', area: 'אישמפלה', tier: 'mid', price: 1100, note: 'בוטיק עם בר גג' },
        { name: 'Hotel Neri', kind: 'boutique', tags: ['couple'],  addr: "Carrer de Sant Sever 5, 08002 Barcelona", phone: '+34 933 040 655', web: 'https://www.relaischateaux.com/us/hotel/hotel-neri/', area: 'הרובע הגותי', tier: 'lux', price: 2200, note: 'ארמון מהמאה ה-12' },
        { name: 'Generator Barcelona', kind: 'hostel', tags: ['budget'],  addr: "Carrer de Còrsega 373, 08037 Barcelona", phone: '+34 932 200 377', web: 'https://staygenerator.com/hostels/barcelona', area: 'גרסיה', tier: 'budget', price: 400, note: 'הוסטל מעוצב' }
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
      vibes: { family: 2, couple: 3, nature: 1, relax: 2, culture: 3, night: 3, food: 3, adventure: 1, religious: 1 },
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
        { name: 'Hotel Grande Bretagne', addr: "1 Vasileos Georgiou A', 105 64 Athens", phone: '+30 210 333 0000', web: 'https://www.marriott.com/en-us/hotels/athlc-hotel-grande-bretagne-a-luxury-collection-hotel-athens/overview/', area: 'כיכר סינטגמה', tier: 'lux', price: 3000, note: 'מרפסת גג עם נוף לאקרופוליס' },
        { name: 'Electra Metropolis', addr: "15 Mitropoleos St, 105 57 Athens", phone: '+30 214 100 6200', web: 'https://www.electrahotels.gr/hotels/electra-metropolis-athens/', area: 'פלאקה', tier: 'mid', price: 1200, note: 'בריכת גג' },
        { name: 'Herodion Hotel', addr: "4 Rovertou Galli St, 117 42 Athens", phone: '+30 210 923 6832', area: 'מקרייאני', tier: 'mid', price: 900, note: 'למרגלות האקרופוליס' },
        { name: 'City Circus', kind: 'hostel', tags: ['budget'],  addr: "16 Sarri St, 105 53 Athens", phone: '+30 213 023 7244', web: 'https://citycircus.gr/', area: 'פסירי', tier: 'budget', price: 350, note: 'הוסטל מעוצב' }
      ],
      car: { need: 'כן באיים ולטיולי יום לסוניון ולדלפי', companies: ['Avis', 'Hertz', 'Sixt', 'חברות מקומיות באיים'], tips: ['באיים — טרקטורונים ורכב קטן', 'רישיון בינלאומי נדרש לעיתים', 'לבדוק ביטוח צמיגים וחלון'] },
      kosherNote: 'מסעדה כשרה ובית חב״ד באתונה; באיים הגדולים לרוב בתי חב״ד עונתיים.',
      kosher: [
        { name: 'Gostijo', addr: "Esopou 10, 105 54 Athens", phone: '+30 210 323 3825', web: 'https://gostijo.gr/', area: 'פסירי', note: 'מסעדה כשרה ותיקה' },
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
      vibes: { family: 2, couple: 3, nature: 2, relax: 3, culture: 3, night: 2, food: 2, adventure: 1, religious: 1 },
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
        { name: 'Four Seasons Prague', addr: "Veleslavínova 2a/1098, 110 00 Praha 1", phone: '+420 221 427 000', web: 'https://www.fourseasons.com/prague/', area: 'גדת הוולטבה', tier: 'lux', price: 3000, note: 'נוף לגשר קארל' },
        { name: 'Hotel Josef', kind: 'boutique', tags: ['couple'],  addr: "Rybná 20, 110 00 Praha 1", phone: '+420 221 700 901', web: 'https://www.hoteljosef.com/', area: 'העיר העתיקה', tier: 'mid', price: 800, note: 'עיצוב מינימליסטי' },
        { name: 'Hotel Paris Prague', addr: "U Obecního domu 1, 110 00 Praha 1", phone: '+420 222 195 195', web: 'https://www.hotel-paris.cz/en/', area: 'כיכר הרפובליקה', tier: 'mid', price: 950, note: 'בניין אר נובו' },
        { name: 'Czech Inn', kind: 'hostel', tags: ['budget'],  addr: "Francouzská 76, 101 00 Praha 10", phone: '+420 210 011 100', web: 'https://czechinn.com/', area: 'וינוהראדי', tier: 'budget', price: 300, note: 'הוסטל ומלון' }
      ],
      car: { need: 'לא בעיר; כן לצ׳סקי קרומלוב וקרלובי וארי', companies: ['Europcar', 'Sixt', 'Hertz'], tips: ['מדבקת כביש מהיר (Vignette) אלקטרונית', 'אורות דלוקים ביום חובה', 'אפס אלכוהול בנהיגה'] },
      kosherNote: 'הרובע היהודי יוזפוב — בתי כנסת עתיקים ומסעדות כשרות.',
      kosher: [
        { name: '5th District by King Solomon', addr: 'Široká 8, 110 00 Praha 1', phone: '+420 224 818 752', area: 'יוזפוב', note: 'המסעדה הכשרה הוותיקה בצ׳כיה' },
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
      vibes: { family: 2, couple: 3, nature: 1, relax: 1, culture: 3, night: 2, food: 2, adventure: 0, religious: 2 },
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
        { name: 'The Plaza', addr: "768 Fifth Ave, New York, NY 10019", phone: '+1 212 759 3000', web: 'https://www.theplazany.com/', area: 'סנטרל פארק דרום', tier: 'lux', price: 5500, note: 'אייקון ניו יורקי' },
        { name: 'Arlo SoHo', addr: "231 Hudson St, New York, NY 10013", phone: '+1 212 342 7000', web: 'https://arlohotels.com/soho/', area: 'סוהו', tier: 'mid', price: 1400, note: 'חדרים קטנים, מיקום מעולה' },
        { name: 'citizenM Times Square', addr: "218 W 50th St, New York, NY 10019", phone: '+1 212 461 3638', web: 'https://www.citizenm.com/', area: 'טיימס סקוור', tier: 'mid', price: 1500, note: 'בר גג' },
        { name: 'Pod Times Square', kind: 'hotel', tags: ['budget'],  addr: "400 W 42nd St, New York, NY 10036", phone: '+1 212 273 9222', web: 'https://www.thepodhotel.com/pod-times-square', area: 'מידטאון', tier: 'budget', price: 800, note: 'חדרי מיקרו' }
      ],
      car: { need: 'לא במנהטן; כן לטיולים מחוץ לעיר', companies: ['Hertz', 'Avis', 'Enterprise', 'National'], tips: ['חניה במנהטן $40+ ליום', 'אגרות גשרים ומנהרות — E-ZPass', 'מע״מ מקומי ומיסים לא כלולים במחיר המוצג'] },
      kosherNote: 'מאות מסעדות כשרות: מידטאון, אפר ווסט סייד, ברוקלין (בורו פארק, קראון הייטס), קווינס.',
      kosher: [
        { name: 'Mike\'s Bistro', addr: "127 E 54th St, New York, NY 10022", phone: '+1 212 799 3911', web: 'https://www.mikesbistro.com/', area: 'מידטאון איסט', note: 'כשר, מטבח אמריקאי' },
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
      vibes: { family: 2, couple: 2, nature: 0, relax: 0, culture: 3, night: 3, food: 3, adventure: 0, religious: 3 },
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
        { name: 'Burj Al Arab', addr: "Jumeirah Beach Rd, Umm Suqeim 3, Dubai", phone: '+971 4 301 7777', web: 'https://www.jumeirah.com/', area: 'ג׳ומיירה', tier: 'lux', price: 7000, note: 'המלון בצורת מפרש' },
        { name: 'Atlantis The Palm', kind: 'resort', tags: ['family', 'pool'],  addr: "Crescent Rd, Palm Jumeirah, Dubai", phone: '+971 4 426 2000', web: 'https://www.atlantis.com/dubai/atlantis-the-palm', area: 'פאלם ג׳ומיירה', tier: 'lux', price: 3500, note: 'פארק מים ואקווריום' },
        { name: 'Rove Downtown', addr: "312 Al Mustaqbal St, Zabeel 2, Dubai", phone: '+971 4 561 9999', web: 'https://www.rovehotels.com/en/hotels/downtown/', area: 'דאונטאון', tier: 'mid', price: 650, note: 'נוף לבורג׳ ח׳ליפה' },
        { name: 'Premier Inn Dubai', area: 'מספר סניפים', tier: 'budget', price: 400, note: 'רשת נוחה ונקייה' }
      ],
      car: { need: 'שימושי; מוניות זולות יחסית', companies: ['Hertz', 'Avis', 'Sixt', 'Europcar'], tips: ['רישיון נהיגה בינלאומי', 'אגרת Salik אוטומטית', 'מצלמות מהירות רבות'] },
      kosherNote: 'יש מסעדות כשרות ומשלוחי אוכל כשר; בית חב״ד פעיל.',
      kosher: [
        { name: 'Elli\'s Kosher Kitchen', addr: "Galleria Golden Mile 4, Palm Jumeirah, Dubai", phone: '+971 52 876 7493', web: 'https://elliskosherkitchen.com/', area: 'דובאי', note: 'מסעדה ומשלוחים' },
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
      vibes: { family: 3, couple: 2, nature: 1, relax: 3, culture: 1, night: 1, food: 2, adventure: 2, religious: 1 },
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
        { name: 'Mandarin Oriental Bangkok', addr: "48 Oriental Ave, Bang Rak, Bangkok 10500", phone: '+66 2 659 9000', web: 'https://www.mandarinoriental.com/en/bangkok/chao-phraya-river', area: 'גדת הצ׳או פראיה', tier: 'lux', price: 2500, note: 'מהמלונות הוותיקים באסיה' },
        { name: 'Siam Kempinski', addr: "991/9 Rama 1 Rd, Pathumwan, Bangkok 10330", phone: '+66 2 162 9000', web: 'https://www.kempinski.com/en/siam-hotel', area: 'סיאם', tier: 'lux', price: 1600, note: 'בריכה בלב העיר' },
        { name: 'Novotel Bangkok Sukhumvit', addr: "19/9 Soi Sukhumvit 20, Khlong Toei, Bangkok 10110", phone: '+66 2 009 4999', web: 'https://www.novotelbangkoksukhumvit20.com/', area: 'סוקומוויט', tier: 'mid', price: 450, note: 'קרוב ל-BTS' },
        { name: 'Lub d Bangkok', kind: 'hostel', tags: ['budget'],  addr: "925/9 Rama 1 Rd, Pathumwan, Bangkok 10330", phone: '+66 2 612 4999', area: 'סילום / סיאם', tier: 'budget', price: 180, note: 'הוסטל רשת' }
      ],
      car: { need: 'לא בבנגקוק; קטנוע באיים (רק עם רישיון!)', companies: ['Avis', 'Hertz', 'Sixt', 'Thai Rent A Car'], tips: ['נהיגה בצד שמאל', 'ביטוח נסיעות לרוב לא מכסה קטנוע ללא רישיון אופנוע', 'קסדה חובה'] },
      kosherNote: 'בתי חב״ד בבנגקוק (ח׳או סאן), קופנגן, קוסמוי, צ׳יאנג מאי ופוקט עם מסעדות כשרות.',
      kosher: [
        { name: 'בית חב״ד ח׳או סאן', addr: "96 Rambuttri Rd, Banglamphu, Bangkok", phone: '+66 2 629 2770', web: 'https://www.jewishthailand.com/', area: 'בנגקוק', note: 'מסעדה כשרה ובית כנסת' },
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
      vibes: { family: 1, couple: 2, nature: 2, relax: 2, culture: 3, night: 3, food: 3, adventure: 2, religious: 1 },
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
        { name: 'Park Hyatt Tokyo', addr: "3-7-1-2 Nishi-Shinjuku, Shinjuku-ku, Tokyo 163-1055", phone: '+81 3 5322 1234', web: 'https://www.hyatt.com/park-hyatt/en-US/tyoph-park-hyatt-tokyo', area: 'שינג׳וקו', tier: 'lux', price: 4000, note: 'מהסרט "אבודים בטוקיו"' },
        { name: 'Hotel Gracery Shinjuku', addr: "1-19-1 Kabukicho, Shinjuku-ku, Tokyo 160-8466", phone: '+81 3 6833 2489', web: 'https://whgshinjuku.gracery.com/', area: 'קבוקיצ׳ו', tier: 'mid', price: 750, note: 'עם ראש גודזילה על הגג' },
        { name: 'MUJI Hotel Ginza', addr: "6F, 3-3-5 Ginza, Chuo-ku, Tokyo 104-0061", phone: '+81 3 3538 6101', web: 'https://hotel.muji.com/ginza/en/', area: 'גינזה', tier: 'mid', price: 1100, note: 'מינימליזם יפני' },
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
      vibes: { family: 2, couple: 2, nature: 1, relax: 1, culture: 3, night: 2, food: 3, adventure: 1, religious: 1 },
      poster: { sky: ['#F9D3D8', '#F4A6A8'], sun: '#D64545', land: '#2E2A3A', far: '#6D6A8A', icon: 'pagoda', ink: '#1B1822' }
    }
  ];

  return { origin, holidays, bookingSites, destinations: D };
})();
