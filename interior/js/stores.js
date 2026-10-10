/* Store directory — Israeli retailers only.
   Phones and addresses were collected from the chains' public pages and business
   directories in September 2026. Branches move and hours change, so every card
   also links to the chain's own branch page. */
(function () {
  'use strict';

  const REGIONS = {
    north: 'חיפה והצפון',
    sharon: 'השרון',
    center: 'תל אביב והמרכז',
    jerusalem: 'ירושלים והסביבה',
    south: 'באר שבע והדרום'
  };

  // Distance order between regions, used to pick the nearest branch.
  const NEAR = {
    north: ['north', 'sharon', 'center', 'jerusalem', 'south'],
    sharon: ['sharon', 'center', 'north', 'jerusalem', 'south'],
    center: ['center', 'sharon', 'jerusalem', 'south', 'north'],
    jerusalem: ['jerusalem', 'center', 'south', 'sharon', 'north'],
    south: ['south', 'center', 'jerusalem', 'sharon', 'north']
  };

  const STORES = {
    ikea: {
      name: 'איקאה',
      latin: 'IKEA',
      kind: 'רהיטים, מטבחים, ארונות, טקסטיל ותאורה',
      hotline: '09-8928888',
      hotlineNote: 'שירות לקוחות, גם בוואטסאפ',
      site: 'https://www.ikea.com/il/he/',
      branchesUrl: 'https://www.ikea.com/il/he/stores/',
      branches: [
        { region: 'center', city: 'ראשון לציון', addr: 'היוזמה 1, מרכז עסקים שורק (כביש פלמחים)' },
        { region: 'sharon', city: 'נתניה', addr: 'גיבורי ישראל 1' },
        { region: 'north', city: 'קריית אתא', addr: 'דרך חיפה 52, קניון שער הצפון' },
        { region: 'south', city: 'באר שבע', addr: 'הירדן 24' },
        { region: 'jerusalem', city: 'אשתאול', addr: 'אזור התעשייה אשתאול, ליד בית שמש' }
      ]
    },
    homecenter: {
      name: 'הום סנטר',
      latin: 'Home Center',
      kind: 'כלים סניטריים, ברזים, תאורה, צמחים, אחסון ופתרונות מטבח',
      hotline: '03-9687800',
      hotlineNote: 'מוקד שירות (0 לנציג)',
      site: 'https://www.homecenter.co.il/',
      branchesUrl: 'https://www.homecenter.co.il/pages/branches',
      branches: [
        { region: 'center', city: 'ראשון לציון', addr: 'לח״י 4' },
        { region: 'sharon', city: 'נתניה', addr: 'האורזים 4, אזור תעשייה צפון' },
        { region: 'jerusalem', city: 'ירושלים', addr: 'האומן 9, תלפיות' },
        { region: 'north', city: 'חיפה', addr: 'האצטדיון 1, מפרץ חיפה' }
      ]
    },
    ace: {
      name: 'אייס',
      latin: 'ACE',
      kind: 'כלים סניטריים, מקלחונים, תאורה, ריהוט גן ומרפסת',
      hotline: '079-3002400',
      hotlineNote: 'מוקד ארצי',
      extra: [['וואטסאפ', '054-1510885']],
      site: 'https://www.ace.co.il/',
      branchesUrl: 'https://www.ace.co.il/stores',
      branches: [
        { region: 'center', city: 'תל אביב', addr: 'יגאל אלון 59' },
        { region: 'center', city: 'ראשון לציון', addr: 'ילדי טהרן 5' },
        { region: 'north', city: 'חיפה', addr: 'החרושת 10' },
        { region: 'jerusalem', city: 'ירושלים', addr: 'האומן 17, תלפיות' }
      ]
    },
    beitili: {
      name: 'ביתילי',
      latin: 'Beitili',
      kind: 'ספות, פינות אוכל, חדרי שינה ומזנונים',
      hotline: '073-2821922',
      hotlineNote: 'סניף ראשון לציון',
      site: 'https://www.betili-shop.com/',
      branchesUrl: 'https://www.betili-shop.com/contact-us/',
      branches: [
        { region: 'center', city: 'ראשון לציון', addr: 'אצ״ל 2', phone: '073-2821922' }
      ]
    },
    hollandia: {
      name: 'הולנדיה',
      latin: 'Hollandia',
      kind: 'מזרנים, מיטות ובסיסים מתכווננים',
      hotline: '1-800-744-944',
      hotlineNote: 'מוקד ארצי',
      site: 'https://hollandia.co.il/',
      branchesUrl: 'https://hollandia.co.il/pages/%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D',
      branches: [
        { region: 'sharon', city: 'הרצליה פיתוח', addr: 'שד׳ אבא אבן 15', phone: '077-9964711' },
        { region: 'center', city: 'בני ברק', addr: 'לח״י 2, דן דיזיין סנטר, קומה ב׳', phone: '077-9964712' },
        { region: 'south', city: 'באר שבע', addr: 'דרך חברון 48, מתחם +Design', phone: '077-9964716' }
      ]
    },
    aminach: {
      name: 'עמינח',
      latin: 'Aminach',
      kind: 'ספות, מזרנים, מיטות וחדרי שינה',
      hotline: '077-9976555',
      hotlineNote: 'מוקד מכירות',
      extra: [['שירות לקוחות', '077-9966630']],
      site: 'https://www.aminach.co.il/',
      branchesUrl: 'https://www.aminach.co.il/%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D/',
      branches: [
        { region: 'center', city: 'בני ברק', addr: 'לח״י 28, ליד דן דיזיין סנטר', phone: '077-2307744' },
        { region: 'center', city: 'ניר צבי', addr: 'אזור התעשייה ניר צבי', phone: '077-2316688' },
        { region: 'south', city: 'באר שבע', addr: 'הפועלים 34, עמק שרה', phone: '077-2316111' }
      ]
    },
    tollmans: {
      name: 'טולמנ׳ס',
      latin: "Tollman's",
      kind: 'ריהוט יוקרה, שטיחים, תאורה ואקססוריז',
      hotline: '09-8899000',
      hotlineNote: 'מוקד ראשי',
      site: 'https://www.tollmans.co.il/',
      branchesUrl: 'https://www.tollmans.co.il/en/locations/',
      branches: [
        { region: 'center', city: 'בני ברק', addr: 'לח״י 27', phone: '03-7443781' },
        { region: 'sharon', city: 'בית יהושע', addr: 'מתחם טולמנ׳ס ליד תחנת הרכבת בית יהושע' }
      ]
    },
    natuzzi: {
      name: 'נטוצ׳י',
      latin: 'Natuzzi',
      kind: 'ספות וכורסאות עור ובד איטלקיות',
      hotline: '08-6420300',
      hotlineNote: 'סניף באר שבע',
      site: 'https://www.natuzzi.com/',
      branchesUrl: 'https://www.natuzzi.com/',
      branches: [
        { region: 'south', city: 'באר שבע', addr: 'דרך חברון 48, מתחם השדרה השביעית', phone: '08-6420300' }
      ]
    },
    kastiel: {
      name: 'קסטיאל',
      latin: 'Kastiel',
      kind: 'ריהוט מעצבים, פינות אוכל וספות',
      hotline: '072-3225484',
      hotlineNote: 'קסטיאל סטודיו',
      site: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%A8%D7%94%D7%99%D7%98%D7%99%D7%9D',
      branchesUrl: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%A1%D7%98%D7%95%D7%93%D7%99%D7%95+%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D',
      branches: [
        { region: 'center', city: 'ראשון לציון', addr: 'אצ״ל 4 (קסטיאל סטודיו)', phone: '072-3225484' }
      ]
    },
    foxhome: {
      name: 'פוקס הום',
      latin: 'Fox Home',
      kind: 'טקסטיל, שטיחים, מצעים, כלי בית ואקססוריז',
      hotline: '03-7133000',
      hotlineNote: 'שירות לקוחות',
      office: 'החרמון 6, קריית שדה התעופה',
      site: 'https://www.foxhome.co.il/',
      branchesUrl: 'https://www.foxhome.co.il/pages/branches',
      branches: []
    },
    golf: {
      name: 'גולף אנד קו',
      latin: 'Golf & Co',
      kind: 'טקסטיל, שטיחים, כלי מטבח ועיצוב',
      hotline: '073-7099999',
      hotlineNote: 'שירות לקוחות',
      office: 'המלאכה 5, נתניה',
      site: 'https://www.golfco.co.il/',
      branchesUrl: 'https://www.golfco.co.il/contacts',
      branches: []
    },
    regba: {
      name: 'מטבחי רגבה',
      latin: 'Regba',
      kind: 'מטבחים בהתאמה אישית, ארונות ואיים',
      hotline: '04-6088888',
      hotlineNote: 'משרדים',
      extra: [['שירות לקוחות', '04-6088876']],
      site: 'https://www.regba.co.il/',
      branchesUrl: 'https://www.regba.co.il/contact/',
      branches: [
        { region: 'north', city: 'רגבה', addr: 'מפעל ואולם תצוגה, מושב רגבה, גליל מערבי', phone: '04-6088888' }
      ]
    },
    yagur: {
      name: 'משתלות יגור',
      latin: 'Yagur Nurseries',
      kind: 'משתלה: עצים בוגרים, שיחים, עציצים, כדים, השקיה ותכנון גינות',
      hotline: '04-9848108',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://www.yagurgan.co.il/',
      branchesUrl: 'https://www.yagurgan.co.il/',
      branches: [{ region: 'north', city: 'קיבוץ יגור', addr: 'משתלות יגור', phone: '04-9848108' }]
    },
    azur: {
      name: 'משתלת אזור',
      latin: 'Azur Nursery',
      kind: 'משתלה: צמחים, עצים, אדניות וציוד גינה',
      hotline: '03-5568916',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://azurflowers.co.il/',
      branchesUrl: 'https://azurflowers.co.il/',
      branches: [{ region: 'center', city: 'חולון', addr: 'דרך השבעה 104', phone: '03-5568916' }]
    },
    hadarnoy: {
      name: 'הדר נוי משתלות',
      latin: 'Hadar Noy',
      kind: 'משתלה אונליין: עצי זית מעוצבים, עצי פרי ושיחים, משלוח עד הבית',
      hotline: '',
      hotlineNote: 'הזמנה באתר',
      site: 'https://www.hadarnoy.co.il/',
      branchesUrl: 'https://www.hadarnoy.co.il/',
      branches: []
    },
    adel: {
      name: 'אדל בריכות שחייה',
      latin: 'Adel Pools',
      kind: 'תכנון והקמה של בריכות בטון, פיברגלס ומתועשות',
      hotline: '077-9973313',
      hotlineNote: 'סניף אשקלון',
      site: 'https://www.adelpool.co.il/',
      branchesUrl: 'https://www.adelpool.co.il/',
      branches: [
        { region: 'south', city: 'אשקלון', addr: 'אוסישקין 5', phone: '077-9973313' },
        { region: 'center', city: 'אשדוד', addr: 'היהלומים 23', phone: '055-4522997' }
      ]
    },
    hagag: {
      name: 'חג׳ג׳ בריכות',
      latin: 'Hagag Pools',
      kind: 'בריכות ביתיות, פיתוח נוף, דקים ופרגולות',
      hotline: '04-6490000',
      hotlineNote: 'משרדים',
      site: 'https://hagag-pools.co.il/',
      branchesUrl: 'https://hagag-pools.co.il/',
      branches: [{ region: 'north', city: 'צרופה', addr: 'הזית 17', phone: '04-6490000' }]
    },
    // more nurseries: `local` stores are listed only for buyers in their own region
    bialik: {
      name: 'משתלת ביאליק',
      latin: 'Bialik Nursery',
      kind: 'משתלה: צמחים, עצים, עציצים וציוד לגינה בצפון (פועלת יותר מ-25 שנה)',
      hotline: '052-5448803',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://www.bialik-mashtelot.com/',
      branchesUrl: 'https://www.bialik-mashtelot.com/contact.asp',
      branches: [{ region: 'north', city: 'קריית ביאליק', addr: 'ג׳ורג׳ לנדאור 24', phone: '052-5448803' }]
    },
    beithai: {
      name: 'משתלת בית חי',
      latin: 'Beit Hai Nursery',
      kind: 'משתלה ומתחם גינה גדול בעמק יזרעאל',
      hotline: '04-6419271',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://www.google.com/search?q=%D7%9E%D7%A9%D7%AA%D7%9C%D7%AA+%D7%91%D7%99%D7%AA+%D7%97%D7%99',
      branchesUrl: 'https://www.google.com/maps/search/%D7%9E%D7%A9%D7%AA%D7%9C%D7%AA+%D7%91%D7%99%D7%AA+%D7%97%D7%99',
      branches: [{ region: 'north', city: 'עמק יזרעאל', addr: 'כביש 77, בין צומת בית רימון לצומת גולני', phone: '04-6419271' }]
    },
    ganod: {
      name: 'משתלת גן עד',
      latin: 'Gan Ad Nursery',
      kind: 'משתלה: צמחי גינה ובית, עציצים ואדניות',
      hotline: '072-3126177',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://www.d.co.il/12036370/32940/',
      branchesUrl: 'https://www.d.co.il/12036370/32940/',
      branches: [{ region: 'sharon', city: 'רמת השרון', addr: 'משתלת גן עד', phone: '072-3126177' }]
    },
    rgnursery: {
      name: 'משתלת רמת גן',
      latin: 'Ramat Gan Nursery',
      kind: 'משתלה: צמחים, עציצים, כלי גינון והשקיה, משלוחים בגוש דן',
      hotline: '03-7509080',
      hotlineNote: 'המשתלה',
      extra: [['וואטסאפ', '050-4447565']],
      local: true,
      site: 'https://mashtelatramatgan.co.il/',
      branchesUrl: 'https://mashtelatramatgan.co.il/',
      branches: [{ region: 'center', city: 'רמת גן', addr: 'אלוף שדה 101, ליד תחנת סונול המכבים', phone: '03-7509080' }]
    },
    ganyarak: {
      name: 'משתלת גן ירק',
      latin: 'Gan Yarak',
      kind: 'משתלה גדולה במרכז, הזמנה אונליין ומשלוחים מהצפון עד באר שבע',
      hotline: '03-5331771',
      hotlineNote: 'המשתלה',
      extra: [['מכירות', '053-5556777']],
      site: 'https://www.gan-yarak.co.il/',
      branchesUrl: 'https://www.gan-yarak.co.il/',
      branches: [{ region: 'center', city: 'מושב חמד', addr: 'התמר 29', phone: '03-5331771' }]
    },
    kaduri: {
      name: 'משתלת כדורי',
      latin: 'Kaduri Nursery',
      kind: 'משתלה בנגב מאז 1985: צמחים, השקיה ובריכות נוי',
      hotline: '08-6232941',
      hotlineNote: 'המשתלה',
      local: true,
      site: 'https://www.instagram.com/greenhousekaduri/',
      branchesUrl: 'https://www.d.co.il/5063860/32940/',
      branches: [{ region: 'south', city: 'באר שבע', addr: 'המנוף 6', phone: '08-6232941' }]
    },
    shilav: {
      name: 'שילב',
      latin: 'Shilav',
      kind: 'חדרי תינוקות וילדים: מיטות, שידות החתלה, ארונות ומזרנים (כ-70 סניפים)',
      hotline: '03-5775111',
      hotlineNote: 'מוקד שירות',
      site: 'https://www.shilav.co.il/',
      branchesUrl: 'https://www.shilav.co.il/pages/%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D',
      branches: [
        { region: 'center', city: 'יהוד', addr: 'דרך משה דיין 3', phone: '03-5365097' },
        { region: 'center', city: 'רמלה', addr: 'קניון רמלה', phone: '08-9168520' },
        { region: 'jerusalem', city: 'ירושלים', addr: 'קניון ירושלים, אגודת ספורט בית״ר 1', phone: '02-6793319' },
        { region: 'north', city: 'חיפה', addr: 'קניון סינמול, שד׳ ההסתדרות 55' },
        { region: 'south', city: 'באר שבע', addr: 'שד׳ יצחק רגר 151', phone: '08-6625338' }
      ]
    },
    iddesign: {
      name: 'IDdesign',
      latin: 'IDdesign',
      kind: 'רהיטים מעוצבים: ספות, פינות אוכל, חדרי שינה ומזנונים',
      hotline: '*5814',
      hotlineNote: 'שירות לקוחות',
      extra: [['וואטסאפ', '050-8670035']],
      site: 'https://iddesign-shop.co.il/',
      branchesUrl: 'https://iddesign-shop.co.il/stores',
      branches: [{ region: 'sharon', city: 'נתניה', addr: 'שדרות גיבורי ישראל 5' }]
    },
    kuka: {
      name: 'KUKA HOME',
      latin: 'KUKA HOME',
      kind: 'ספות ומערכות ישיבה, כורסאות ריקליינר (קבוצת קאופמן)',
      hotline: '073-3822999',
      hotlineNote: 'חנות הדגל',
      extra: [['וואטסאפ', '052-8552929']],
      site: 'https://www.kuka-home.co.il/',
      branchesUrl: 'https://www.kuka-home.co.il/%D7%A1%D7%A0%D7%99%D7%A4%D7%99%D7%9D',
      branches: [{ region: 'north', city: 'קריית אתא', addr: 'דרך חיפה 44, מתחם רידיזיין', phone: '073-3822999' }]
    },
    shekem: {
      name: 'שקם אלקטריק',
      latin: 'Shekem Electric',
      kind: 'טלוויזיות, מקררים, תנורים, מדיחים ומכונות כביסה',
      hotline: '*4984',
      hotlineNote: 'שלוחה 1 מכירות, 2 שירות',
      site: 'https://www.shekem-electric.co.il/',
      branchesUrl: 'https://www.shekem-electric.co.il/branches',
      branches: []
    },
    payngo: {
      name: 'מחסני חשמל',
      latin: 'Mahsanei Hashmal',
      kind: 'טלוויזיות, מוצרי חשמל גדולים ומזגנים',
      hotline: '*5018',
      hotlineNote: 'שלוחה 1 מכירות, 2 שירות',
      site: 'https://www.payngo.co.il/',
      branchesUrl: 'https://www.payngo.co.il/branches',
      branches: []
    }
  };

  function nearestBranch(storeId, region) {
    const s = STORES[storeId];
    if (!s || !s.branches.length) return null;
    const order = NEAR[region] || NEAR.center;
    for (const r of order) {
      const b = s.branches.find((x) => x.region === r);
      if (b) return b;
    }
    return s.branches[0];
  }

  function wazeUrl(storeId, branch) {
    const s = STORES[storeId];
    return 'https://waze.com/ul?q=' + encodeURIComponent(s.name + ' ' + branch.addr + ' ' + branch.city) + '&navigate=yes';
  }

  function mapsUrl(storeId, branch) {
    const s = STORES[storeId];
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.name + ' ' + branch.addr + ' ' + branch.city);
  }

  window.IH = window.IH || {};
  Object.assign(window.IH, {
    STORES, REGIONS, nearestBranch, wazeUrl, mapsUrl,
    STORES_CHECKED: 'ספטמבר 2026'
  });
})();
