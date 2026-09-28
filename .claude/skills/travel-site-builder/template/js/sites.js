/* ===========================================================
   כל אתרי החופשות במקום אחד
   deep — פונקציה שבונה קישור עם היעד והתאריכים (אם האתר תומך).
   בלי deep — הקישור פותח את דף הבית של האתר.
   =========================================================== */

window.APP_SITES = [
  { cat: 'טיסות', items: [
    { n: 'Skyscanner', u: 'https://www.skyscanner.co.il/', d: 'השוואת טיסות מכל החברות', deep: 'skyscanner' },
    { n: 'Google Flights', u: 'https://www.google.com/travel/flights', d: 'לוח מחירים לפי תאריך', deep: 'gflights' },
    { n: 'Kayak', u: 'https://www.kayak.com/flights', d: 'טיסות, מלונות ורכב', deep: 'kayak' },
    { n: 'Momondo', u: 'https://www.momondo.co.il/', d: 'השוואת מחירי טיסות' },
    { n: 'אל על', u: 'https://www.elal.com/he/', d: 'טיסות ישירות מישראל' },
    { n: 'ישראייר', u: 'https://www.israir.co.il/', d: 'טיסות וחבילות' },
    { n: 'ארקיע', u: 'https://www.arkia.co.il/', d: 'טיסות לאילת ולחו״ל' },
    { n: 'Wizz Air', u: 'https://wizzair.com/', d: 'לואו-קוסט לאירופה' },
    { n: 'Ryanair', u: 'https://www.ryanair.com/', d: 'לואו-קוסט לאירופה' },
    { n: 'easyJet', u: 'https://www.easyjet.com/', d: 'לואו-קוסט לאירופה' }
  ]},
  { cat: 'מלונות ודירות', items: [
    { n: 'Booking.com', u: 'https://www.booking.com/', d: 'מלונות, דירות וצימרים', deep: 'booking' },
    { n: 'Airbnb', u: 'https://www.airbnb.com/', d: 'דירות ובתים', deep: 'airbnb' },
    { n: 'Expedia', u: 'https://www.expedia.com/', d: 'מלונות וחבילות', deep: 'expedia' },
    { n: 'Hotels.com', u: 'https://www.hotels.com/', d: 'מלונות עם צבירת לילות' },
    { n: 'Agoda', u: 'https://www.agoda.com/', d: 'חזק במיוחד באסיה' },
    { n: 'Trivago', u: 'https://www.trivago.co.il/', d: 'השוואת מחירי מלונות' }
  ]},
  { cat: 'חבילות נופש מישראל', items: [
    { n: 'איסתא', u: 'https://www.issta.co.il/', d: 'טיסות, חבילות ונופש' },
    { n: 'גוליבר', u: 'https://www.gulliver.co.il/', d: 'חבילות וטיסות' },
    { n: 'אופיר טורס', u: 'https://www.ophirtours.co.il/', d: 'טיולים מאורגנים וחבילות' },
    { n: 'דקה 90', u: 'https://www.daka90.co.il/', d: 'דילים של הרגע האחרון' },
    { n: 'אשת טורס', u: 'https://www.eshet.com/', d: 'טיולים מאורגנים וחבילות' }
  ]},
  { cat: 'השכרת רכב', items: [
    { n: 'Discover Cars', u: 'https://www.discovercars.com/', d: 'השוואת השכרת רכב', deep: 'discovercars' },
    { n: 'Kayak Cars', u: 'https://www.kayak.com/cars', d: 'השוואת מחירים', deep: 'kayakcars' },
    { n: 'Rentalcars', u: 'https://www.rentalcars.com/', d: 'השכרת רכב בעולם' },
    { n: 'Sixt', u: 'https://www.sixt.com/', d: 'השכרה בשדות תעופה' },
    { n: 'Hertz', u: 'https://www.hertz.com/', d: 'השכרה בשדות תעופה' },
    { n: 'Avis', u: 'https://www.avis.com/', d: 'השכרה בשדות תעופה' },
    { n: 'Europcar', u: 'https://www.europcar.com/', d: 'השכרה באירופה' },
    { n: 'שלמה סיקסט', u: 'https://www.shlomo.co.il/', d: 'השכרה בישראל' },
    { n: 'אלדן', u: 'https://www.eldan.co.il/', d: 'השכרה בישראל' }
  ]},
  { cat: 'אטרקציות וסיורים', items: [
    { n: 'GetYourGuide', u: 'https://www.getyourguide.com/', d: 'כרטיסים וסיורים', deep: 'getyourguide' },
    { n: 'Viator', u: 'https://www.viator.com/', d: 'סיורים ואטרקציות' },
    { n: 'Klook', u: 'https://www.klook.com/', d: 'חזק באסיה' },
    { n: 'Tripadvisor', u: 'https://www.tripadvisor.com/', d: 'ביקורות ודירוגים', deep: 'tripadvisor' }
  ]},
  { cat: 'ביטוח, גלישה וכסף', items: [
    { n: 'PassportCard', u: 'https://www.passportcard.co.il/', d: 'ביטוח נסיעות' },
    { n: 'Airalo', u: 'https://www.airalo.com/', d: 'eSIM לגלישה בחו״ל' },
    { n: 'אזהרות מסע (מל״ל)', u: 'https://www.gov.il/he/departments/news/travel-warnings', d: 'לפני כל נסיעה' },
    { n: 'רשות שדות התעופה', u: 'https://www.iaa.gov.il/', d: 'המראות ונחיתות בזמן אמת' }
  ]}
];
