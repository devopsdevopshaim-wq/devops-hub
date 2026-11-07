/* Furniture catalog: what each piece is, the professional rule behind where it goes,
   an estimated price range per budget tier (NIS, September 2026 market estimate)
   and which Israeli chains carry it at that tier. */
(function () {
  'use strict';

  const E = 'eco', M = 'mid', P = 'prem';

  // nurseries near the buyer (stores marked `local` are kept only in their own region)
  const NURSERY = ['azur', 'ganyarak', 'rgnursery', 'ganod', 'bialik', 'beithai', 'kaduri'];

  // stores per tier: { eco: [...], mid: [...], prem: [...] }
  const S = {
    sofa: { [E]: ['ikea', 'beitili'], [M]: ['aminach', 'beitili', 'iddesign'], [P]: ['natuzzi', 'kuka', 'tollmans', 'kastiel'] },
    table: { [E]: ['ikea', 'beitili'], [M]: ['beitili', 'iddesign', 'kastiel'], [P]: ['kastiel', 'tollmans'] },
    casegood: { [E]: ['ikea'], [M]: ['beitili', 'iddesign', 'ikea'], [P]: ['tollmans', 'kastiel'] },
    bed: { [E]: ['ikea', 'aminach'], [M]: ['aminach', 'hollandia'], [P]: ['hollandia', 'tollmans'] },
    kidbed: { [E]: ['ikea', 'shilav'], [M]: ['shilav', 'aminach', 'ikea'], [P]: ['hollandia', 'aminach', 'shilav'] },
    wardrobe: { [E]: ['ikea', 'homecenter'], [M]: ['ikea', 'beitili'], [P]: ['regba', 'tollmans'] },
    kitchen: { [E]: ['ikea', 'homecenter'], [M]: ['ikea', 'regba'], [P]: ['regba'] },
    appliance: { [E]: ['payngo', 'shekem'], [M]: ['shekem', 'payngo'], [P]: ['shekem', 'payngo'] },
    sanitary: { [E]: ['homecenter', 'ace'], [M]: ['ace', 'homecenter'], [P]: ['ace', 'homecenter'] },
    light: { [E]: ['ikea', 'homecenter'], [M]: ['ikea', 'ace'], [P]: ['tollmans', 'ace'] },
    textile: { [E]: ['ikea', 'golf'], [M]: ['foxhome', 'golf'], [P]: ['tollmans', 'foxhome'] },
    office: { [E]: ['ikea'], [M]: ['ikea', 'beitili'], [P]: ['tollmans', 'kastiel'] },
    outdoor: { [E]: ['ace', 'homecenter'], [M]: ['ace', 'ikea'], [P]: ['tollmans', 'ace'] },
    plant: { [E]: ['homecenter', 'ikea'].concat(NURSERY), [M]: NURSERY.concat(['homecenter']), [P]: NURSERY.concat(['ace']) },
    tree: { [E]: NURSERY.concat(['hadarnoy']), [M]: NURSERY.concat(['yagur', 'hadarnoy']), [P]: ['yagur', 'hadarnoy'].concat(NURSERY) },
    pool: { [E]: ['adel', 'hagag'], [M]: ['adel', 'hagag'], [P]: ['hagag', 'adel'] },
    hardscape: { [E]: ['homecenter', 'ace'], [M]: ['ace', 'homecenter', 'hagag'], [P]: ['hagag', 'ace'] },
    gardenFurniture: { [E]: ['homecenter', 'ace', 'ikea'], [M]: ['ace', 'homecenter', 'ikea'], [P]: ['tollmans', 'ace'] }
  };

  const CATALOG = {
    sofa3: { name: 'ספה תלת-מושבית', cat: 'ישיבה', stores: S.sofa, price: [2200, 5500, 14000],
      rule: 'ספה ״צפה״ עם הגב לפינת האוכל מחלקת את החלל הפתוח בלי קירות. משאירים מאחוריה מעבר של 90 ס״מ לפחות.' },
    sofa2: { name: 'ספה דו-מושבית', cat: 'ישיבה', stores: S.sofa, price: [1600, 4200, 11000],
      rule: 'בסלון קטן ספה של 180 ס״מ משאירה מעבר נוח של 90 ס״מ. ספה עם רגליים חשופות גורמת לחדר להיראות גדול יותר.' },
    sofaL: { name: 'ספה פינתית (L)', cat: 'ישיבה', stores: S.sofa, price: [3500, 8000, 22000],
      rule: 'פינתית מתאימה כשיש 4 יושבים ויותר. השזלונג פונה לחלון ולא למעבר, כדי לא לחסום את הדרך למרפסת.' },
    armchair: { name: 'כורסה', cat: 'ישיבה', stores: S.sofa, price: [700, 2200, 7000],
      rule: 'כורסה בזווית לספה סוגרת ״מעגל שיחה״. המרחק בין מושבים שמשוחחים ביניהם: עד 2.5 מ׳.' },
    coffeeTable: { name: 'שולחן סלון', cat: 'שולחנות', stores: S.table, price: [300, 1200, 4500],
      rule: 'אורך השולחן כשני שלישים מאורך הספה, 40–45 ס״מ ממנה. כך מגיעים אליו ביד ועדיין יש מקום לרגליים.' },
    sideTable: { name: 'שולחן צד', cat: 'שולחנות', stores: S.table, price: [150, 600, 2200],
      rule: 'גובה שולחן הצד בגובה משענת היד של הספה (בערך 55–60 ס״מ).' },
    tvConsole: { name: 'מזנון טלוויזיה', cat: 'אחסון', stores: S.casegood, price: [500, 2000, 7500],
      rule: 'המזנון רחב מהמסך ב-30 ס״מ לפחות. גובה 40–50 ס״מ שומר את מרכז המסך בגובה העיניים של היושבים.' },
    tv: { name: 'טלוויזיה', cat: 'חשמל', stores: S.appliance, price: [2000, 4500, 12000],
      rule: 'גודל המסך נקבע לפי מרחק הצפייה: המרחק מהעיניים למסך ≈ 1.2–1.6 × האלכסון (זווית צפייה של 30°–40° לפי SMPTE ו-THX). מרכז המסך בגובה 100–110 ס״מ.' },
    rug: { name: 'שטיח', cat: 'טקסטיל', stores: S.textile, price: [400, 1500, 6000],
      rule: 'לפחות הרגליים הקדמיות של הספה והכורסאות עומדות על השטיח. שטיח קטן מדי ״צף״ ומקטין את החדר.' },
    floorLamp: { name: 'מנורה עומדת', cat: 'תאורה', stores: S.light, price: [200, 700, 3000],
      rule: 'תאורת קריאה ליד הספה: שכבת תאורה שנייה אחרי התאורה הכללית. גוון חם 2700K לסלון.' },
    pendant: { name: 'מנורה תלויה', cat: 'תאורה', stores: S.light, price: [200, 800, 3500],
      rule: 'מעל שולחן אוכל: תחתית הגוף 75–85 ס״מ מעל משטח השולחן, ורוחבה עד שני שלישים מרוחב השולחן.' },
    plant: { name: 'צמח גדול', cat: 'עיצוב', stores: S.plant, price: [120, 350, 900],
      rule: 'צמח גבוה בפינה ליד החלון ״ממלא״ פינה ריקה ומוסיף ירוק. פיקוס כינורי ומונסטרה מתאימים לאור עקיף.' },
    bookshelf: { name: 'ספרייה', cat: 'אחסון', stores: S.casegood, price: [300, 1200, 4500],
      rule: 'ספרייה פתוחה בעומק 30–35 ס״מ לא ״אוכלת״ את החדר. חפצים כבדים במדפים התחתונים.' },

    diningTable: { name: 'שולחן אוכל', cat: 'שולחנות', stores: S.table, price: [900, 3000, 12000],
      rule: '60 ס״מ רוחב לכל סועד, ו-90 ס״מ פנויים מסביב לשולחן כדי להזיז כיסא ולעבור מאחוריו.' },
    chair: { name: 'כיסא אוכל', cat: 'ישיבה', stores: S.table, price: [150, 450, 1600],
      rule: 'גובה מושב 45–47 ס״מ ל-75 ס״מ גובה שולחן: 28–30 ס״מ בין המושב למשטח.' },
    stool: { name: 'כיסא בר', cat: 'ישיבה', stores: S.table, price: [150, 450, 1400],
      rule: 'לדלפק בגובה 90 ס״מ מתאים כיסא בגובה מושב 65 ס״מ. 60 ס״מ רוחב לכל יושב.' },

    kitchenBase: { name: 'ארונות מטבח תחתונים + משטח', cat: 'מטבח', stores: S.kitchen, unit: 'm', price: [1400, 3200, 7000],
      rule: 'גובה משטח 90 ס״מ ועומק 60 ס״מ. לפי NKBA כדאי 40 ס״מ משטח פנוי ליד הכיריים ו-60 ס״מ ליד הכיור.' },
    kitchenUpper: { name: 'ארונות מטבח עליונים', cat: 'מטבח', stores: S.kitchen, unit: 'm', price: [700, 1600, 3800],
      rule: 'תחתית הארונות העליונים 55–60 ס״מ מעל המשטח. מעל הכיור שליד החלון משאירים פתוח לאור.' },
    island: { name: 'אי מטבח', cat: 'מטבח', stores: S.kitchen, price: [4500, 11000, 26000],
      rule: 'מעבר של 105–120 ס״מ בין האי לארונות. אי מתאים רק כשרוחב אזור המטבח 3.4 מ׳ ומעלה.' },
    fridge: { name: 'מקרר', cat: 'חשמל', stores: S.appliance, price: [2800, 5500, 14000],
      rule: 'המקרר בקצה הריצה, ליד הכניסה למטבח, כדי שמי שלוקח משקה לא ייכנס לאזור הבישול.' },
    cooktop: { name: 'כיריים + תנור מתחת', cat: 'חשמל', stores: S.appliance, price: [2400, 4800, 11000],
      rule: 'לא מציבים כיריים צמוד לקיר צד או למקרר. הכיריים, הכיור והמקרר יוצרים ״משולש עבודה״.' },
    hood: { name: 'קולט אדים', cat: 'חשמל', stores: S.appliance, price: [700, 1800, 5000],
      rule: 'רוחב הקולט כרוחב הכיריים או יותר, 65–75 ס״מ מעל כיריים גז ו-55–65 ס״מ מעל כיריים אינדוקציה.' },
    sink: { name: 'כיור מטבח + ברז', cat: 'מטבח', stores: S.sanitary, price: [500, 1400, 3800],
      rule: 'כיור מתחת לחלון כשאפשר, והמדיח צמוד לכיור, לצד שמאל או ימין לפי היד הדומיננטית.' },
    dishwasher: { name: 'מדיח כלים', cat: 'חשמל', stores: S.appliance, price: [1800, 3200, 6500],
      rule: 'צמוד לכיור (עד 90 ס״מ ממנו), כדי שהצינורות קצרים והכלים עוברים ישר מהכיור.' },

    bedDouble: { name: 'מיטה זוגית + מזרן', cat: 'שינה', stores: S.bed, price: [2500, 6500, 18000],
      rule: 'ראש המיטה על קיר מלא ולא מתחת לחלון. 60–75 ס״מ פנויים משני הצדדים, ו-90 ס״מ מול ארון עם דלתות ציר.' },
    nightstand: { name: 'שידת לילה', cat: 'אחסון', stores: S.casegood, price: [150, 600, 2200],
      rule: 'גובה השידה בגובה המזרן או עד 5 ס״מ מעליו. רוחב 40–50 ס״מ.' },
    wardrobe: { name: 'ארון בגדים', cat: 'אחסון', stores: S.wardrobe, unit: 'm', price: [1200, 2600, 6500],
      rule: 'עומק 60 ס״מ לקולב. 120 ס״מ לאדם כמינימום. במעבר צר מ-90 ס״מ עדיף ארון עם דלתות הזזה.' },
    dresser: { name: 'קומודה + מראה', cat: 'אחסון', stores: S.casegood, price: [500, 1800, 5500],
      rule: 'מולה נשארים 80 ס״מ לפחות כדי לפתוח מגירות.' },
    bedSingle: { name: 'מיטת יחיד + מזרן', cat: 'שינה', stores: S.kidbed, price: [900, 2400, 5500],
      rule: 'מיטה לאורך הקיר בפינה משחררת את מרכז החדר למשחק. לא מתחת למזגן.' },
    bunk: { name: 'מיטת קומותיים', cat: 'שינה', stores: S.kidbed, price: [1400, 3200, 6500],
      rule: 'לשני ילדים בחדר קטן. 90 ס״מ לפחות בין המזרן העליון לתקרה, ומעקה בגובה 16 ס״מ מעל המזרן.' },
    desk: { name: 'שולחן כתיבה', cat: 'עבודה', stores: S.office, price: [300, 1100, 3800],
      rule: 'השולחן בניצב לחלון: אור טבעי מהצד, בלי סנוור במסך. גובה 72–75 ס״מ ו-90 ס״מ פנויים לכיסא מאחור.' },
    officeChair: { name: 'כיסא עבודה ארגונומי', cat: 'עבודה', stores: S.office, price: [350, 1300, 4200],
      rule: 'כיסא עם כיוון גובה ותמיכה למותניים. כף הרגל שטוחה על הרצפה, הברכיים ב-90°.' },
    sofaBed: { name: 'ספה נפתחת (לאורחים)', cat: 'שינה', stores: S.sofa, price: [1500, 3800, 9000],
      rule: 'בחדר עבודה או ממ״ד: ספה נפתחת נותנת מיטה לאורחים בלי לוותר על החדר ביום-יום.' },

    toilet: { name: 'אסלה תלויה + מיכל סמוי', cat: 'רחצה', stores: S.sanitary, price: [900, 1900, 4500],
      rule: '60 ס״מ פנויים מול האסלה ו-40–45 ס״מ ממרכזה לקיר הצד.' },
    vanity: { name: 'ארון אמבטיה + כיור + מראה', cat: 'רחצה', stores: S.sanitary, price: [900, 2400, 6500],
      rule: 'גובה כיור 85–90 ס״מ. תאורה מעל המראה או משני צדיה, לא רק מהתקרה, כדי שלא יהיו צללים על הפנים.' },
    shower: { name: 'מקלחון', cat: 'רחצה', stores: S.sanitary, price: [1200, 2800, 7000],
      rule: 'מינימום 80×80 ס״מ, מומלץ 90×90 ומעלה. זכוכית שקופה משאירה את החדר פתוח.' },
    bathtub: { name: 'אמבטיה', cat: 'רחצה', stores: S.sanitary, price: [900, 2600, 7500],
      rule: 'אמבטיה של 170 ס״מ מתאימה למשפחה עם ילדים קטנים. מעליה אפשר מוט וזכוכית למקלחת.' },
    washer: { name: 'מכונת כביסה + מייבש', cat: 'חשמל', stores: S.appliance, price: [2600, 4800, 9000],
      rule: 'מייבש מעל המכונה בעזרת מתקן הערמה חוסך 60 ס״מ רוחב. צריך נקודת מים, ניקוז ואוורור.' },

    shoeCabinet: { name: 'ארון נעליים', cat: 'אחסון', stores: S.casegood, price: [250, 800, 2600],
      rule: 'ארון רדוד (עד 30 ס״מ) בכניסה שומר על מעבר של 90 ס״מ במסדרון.' },
    outdoorSet: { name: 'פינת ישיבה למרפסת', cat: 'חוץ', stores: S.outdoor, price: [700, 2200, 7000],
      rule: 'שולחן קטן ושני כיסאות או ספסל. חומרים עמידים לשמש: אלומיניום, טיק, חבל סינתטי.' },

    /* ----- garden ----- */
    lawn: { name: 'מדשאה', cat: 'גינה', stores: S.tree, unit: 'm2', price: [45, 150, 250],
      rule: 'דשא טבעי צריך 6 שעות שמש והשקיה סדירה. דשא סינטטי חוסך מים ועולה כ-130–250 ₪ למ״ר כולל התקנה.' },
    gravel: { name: 'חצץ וחלוקי נחל', cat: 'גינה', stores: S.hardscape, unit: 'm2', price: [60, 120, 220],
      rule: 'גינה חסכונית: יריעה נגד עשבים, חצץ וחלוקים, וצמחים עמידים ליובש. חוסכת עד 70% מים לעומת מדשאה.' },
    deck: { name: 'דק עץ', cat: 'גינה', stores: S.hardscape, unit: 'm2', price: [350, 650, 1100],
      rule: 'דק מול יציאת הסלון מרחיב את חלל המגורים החוצה. שיפוע 1% מהבית לניקוז. איפאה (מ-600 ₪ למ״ר מותקן) או דק מרוכב שלא צריך שמן.' },
    pergola: { name: 'פרגולה', cat: 'גינה', stores: S.hardscape, unit: 'm2', price: [490, 800, 1500],
      rule: 'גובה 2.4–2.7 מ׳ והצללה של 50–70% שומרת על אור בחורף. אלומיניום לא צריך תחזוקה; עץ חם יותר למראה.' },
    outdoorSofa: { name: 'פינת ישיבה לגינה', cat: 'גינה', stores: S.gardenFurniture, price: [600, 1000, 6000],
      rule: 'פינת ישיבה על הדק, עם הגב לבית והפנים לגינה. ראטן סינטטי ואלומיניום עמידים לשמש ולגשם.' },
    outdoorDining: { name: 'פינת אוכל בחוץ', cat: 'גינה', stores: S.gardenFurniture, price: [1200, 3000, 9000],
      rule: 'שולחן לשישה צריך כ-2.4×1.9 מ׳ כולל מקום לכיסאות. קרוב למטבח ולגריל, בצל הפרגולה.' },
    grill: { name: 'גריל גז / מטבח חוץ', cat: 'גינה', stores: S.gardenFurniture, price: [1500, 4500, 15000],
      rule: 'צמוד לבית ליד המטבח, 3 מ׳ לפחות מחלונות פתוחים ומחומרים דליקים, כשהרוח מרחיקה את העשן מהבית.' },
    pool: { name: 'בריכת שחייה', cat: 'בריכה', stores: S.pool, price: [65000, 110000, 180000],
      rule: 'בריכה ביתית נפוצה 3.5×7 מ׳ בעומק 1.2–1.5. בשמש רוב היום, רחוק מעצים נשירים. עם ילדים: גדר 1.2 מ׳ ושער ננעל.' },
    poolDeck: { name: 'ריצוף סביב הבריכה', cat: 'בריכה', stores: S.hardscape, unit: 'm2', price: [250, 450, 800],
      rule: 'אבן או אריח מחוספס נגד החלקה, 1.2 מ׳ לפחות סביב המים, בשיפוע הרחק מהבריכה.' },
    sunLounger: { name: 'מיטת שיזוף', cat: 'בריכה', stores: S.gardenFurniture, price: [430, 640, 2500],
      rule: 'שתיים לפחות בצד הבריכה שפונה לשמש אחר הצהריים, עם 60 ס״מ ביניהן לשולחן צד.' },
    waterfall: { name: 'מפל מים', cat: 'בריכה', stores: S.pool, price: [5000, 12000, 30000],
      rule: 'מפל על דופן הבריכה הרחוקה נראה מהסלון. משאבה במחזור סגור וחשמל מוגן במפסק פחת.' },
    fountain: { name: 'מזרקת קיר', cat: 'גינה', stores: S.hardscape, price: [800, 2500, 6000],
      rule: 'מזרקה קטנה במחזור סגור בקצה הגינה: צליל מים בלי בריכה. צריך נקודת חשמל מוגנת.' },
    oliveTree: { name: 'עץ זית בוגר', cat: 'עצים', stores: S.tree, price: [800, 1500, 2900],
      rule: 'עמיד ליובש ומתאים לאקלים הים-תיכוני. שותלים 3 מ׳ לפחות מבריכה ומיסודות, וטפטוף בשנה הראשונה.' },
    citrusTree: { name: 'עץ הדר (לימון/קלמנטינה)', cat: 'עצים', stores: S.tree, price: [180, 450, 1400],
      rule: 'שמש מלאה והשקיה בטפטוף. פרי וריח פריחה ליד פינת הישיבה.' },
    palmTree: { name: 'דקל', cat: 'עצים', stores: S.tree, price: [600, 1500, 4000],
      rule: 'דקל נותן מראה טרופי ולא מפיל עלים לבריכה כמו עצים נשירים.' },
    planterBed: { name: 'ערוגת שיחים לאורך הגדר', cat: 'עצים', stores: S.tree, unit: 'm', price: [250, 450, 800],
      rule: 'לבנדר, רוזמרין, בוגנוויליה ודשא נוי: שיחים חסכוניים שמרככים את הגדר. בוגנוויליה 10 ליטר עולה כ-75 ₪.' },
    path: { name: 'שביל אבני דריכה', cat: 'גינה', stores: S.hardscape, unit: 'm', price: [120, 250, 450],
      rule: 'אבן כל 60–65 ס״מ (צעד), שקועה בגובה הדשא כדי שלא יפריע לכיסוח.' },
    playSet: { name: 'מתקן משחקים', cat: 'גינה', stores: S.gardenFurniture, price: [1500, 4000, 9000],
      rule: 'על משטח בולם (דשא או גומי), בקו ראייה מהבית, 2 מ׳ פנויים סביב.' },
    gardenLight: { name: 'פנס שביל', cat: 'תאורה', stores: S.hardscape, price: [60, 250, 700],
      rule: 'תאורה נמוכה בגוון חם (2700K) כל 2–3 מ׳ לאורך השביל. סולארית חוסכת חיווט.' },
    irrigation: { name: 'מחשב השקיה וטפטוף', cat: 'גינה', stores: S.hardscape, price: [400, 900, 2000],
      rule: 'טפטוף לערוגות ולעצים וממטירים למדשאה בלבד, בשעות הבוקר המוקדמות. חוסך עד 50% מים.' }
  };

  /* Real models with a published price where one was found (September 2026 web search;
     prices change, confirm with the seller). `seller` is a store id from stores.js or a name. */
  const MODELS = {
    sofa3: [
      { seller: 'beitili', name: 'ספה תלת-מושבית 255 ס״מ דגם קלינטון', price: 3499, url: 'https://www.betili-shop.com/catalogsearch/result/?q=%D7%A7%D7%9C%D7%99%D7%A0%D7%98%D7%95%D7%9F' },
      { seller: 'beitili', name: 'ספה תלת-מושבית דגם פיראוס', price: 3051, url: 'https://www.betili-shop.com/catalogsearch/result/?q=%D7%A4%D7%99%D7%A8%D7%90%D7%95%D7%A1' },
      { seller: 'beitili', name: 'ספה תלת-מושבית 260 ס״מ ירוק זית דגם ג׳ולי', url: 'https://www.betili-shop.com/500383.html' },
      { seller: 'natuzzi', name: 'מערכת ישיבה מעור דגם ברונו', price: 7600, from: true, url: 'https://www.natuzzi.com/' },
      { seller: 'tollmans', name: 'ספה מודולרית VESTA', price: 39693, url: 'https://www.tollmansdot.co.il/product/vesta-2/' }
    ],
    sofaBed: [
      { seller: 'aminach', name: 'ספת אירוח נפתחת דגם ג׳נסיס', price: 3289, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316' },
      { seller: 'aminach', name: 'ספת אירוח נפתחת דגם יופיטר', price: 3989, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316' },
      { seller: 'aminach', name: 'ספה נפתחת למיטה דגם קליק', url: 'https://www.aminach.co.il/product/sleeping-sofas/open-sofas/click/' }
    ],
    bedDouble: [
      { seller: 'hollandia', name: 'מזרן Butterfly 160×200', price: 3440, url: 'https://hollandia.co.il/%D7%9E%D7%96%D7%A8%D7%95%D7%A0%D7%99%D7%9D/' },
      { seller: 'hollandia', name: 'מזרן Wings 160×200', price: 6502, url: 'https://hollandia.co.il/%D7%9E%D7%96%D7%A8%D7%9F-WINGS-2/' },
      { seller: 'hollandia', name: 'מזרן TEMPUR PRO 160×200', price: 14938, url: 'https://hollandia.co.il/%D7%9E%D7%96%D7%A8%D7%95%D7%A0%D7%99%D7%9D/' }
    ],
    diningTable: [
      { seller: 'beitili', name: 'שולחן אוכל נפתח 98×200 דגם אוסקר', price: 3730, url: 'https://www.betili-shop.com/catalogsearch/result/?q=%D7%90%D7%95%D7%A1%D7%A7%D7%A8' },
      { seller: 'beitili', name: 'שולחן נפתח 180 פורניר אלון דגם אימפלה', price: 4554, url: 'https://www.betili-shop.com/catalogsearch/result/?q=%D7%90%D7%99%D7%9E%D7%A4%D7%9C%D7%94' },
      { seller: 'kastiel', name: 'שולחנות אוכל קסטיאל', price: 3900, from: true, url: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%A9%D7%95%D7%9C%D7%97%D7%9F+%D7%90%D7%95%D7%9B%D7%9C' }
    ],
    chair: [{ seller: 'kastiel', name: 'כיסאות אוכל קסטיאל', price: 700, from: true, url: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%9B%D7%99%D7%A1%D7%90%D7%95%D7%AA' }],
    dishwasher: [
      { seller: 'TopMarket', name: 'Bosch SMS4HTI03E (סדרה 4)', price: 2444, url: 'https://www.topmarket.co.il/' },
      { seller: 'TopMarket', name: 'Bosch SMS6ZCI08E', price: 5525, url: 'https://www.topmarket.co.il/en/bosch-sms6zci08e-dishwasher-60cm/' }
    ],
    tv: [{ seller: 'payngo', name: 'Samsung 65" UE65U8000F UHD 4K', url: 'https://www.payngo.co.il/354814.html' }],
    fridge: [{ seller: 'Zabilo', name: 'Samsung 4 דלתות RF65A9011SL עם מצב שבת', url: 'https://zabilo.com/en/multi-doors-refrigerators/9104-rf65a9011sl.html' }],
    outdoorSofa: [
      { seller: 'homecenter', name: 'כתר: פינת ישיבה קורפו אפור (4 חלקים)', price: 999.9, url: 'https://www.homecenter.co.il/products/1214506331' },
      { seller: 'homecenter', name: 'כתר: פינת ישיבה אמילי אפור', price: 599.9, url: 'https://www.homecenter.co.il/products/1710838478663' },
      { seller: 'tollmans', name: 'ספות חוץ טולמנ׳ס דוט', url: 'https://www.tollmansdot.co.il/product_cat/seating-systems-outdoor/' }
    ],
    outdoorDining: [{ seller: 'ace', name: 'פינות אוכל לגינה באייס', url: 'https://www.ace.co.il/garden-furniture-outdoor-products/garden-furniture' }],
    sunLounger: [
      { seller: 'homecenter', name: 'כתר: מיטת שיזוף אטלנטיק ראטן אפור', price: 429.9, url: 'https://www.homecenter.co.il/products/1112000336' },
      { seller: 'homecenter', name: 'כתר: מיטת שיזוף אטלנטיק ראטן לבן', price: 499.9, url: 'https://www.homecenter.co.il/products/1214506990' },
      { seller: 'כתר', name: 'כתר: מיטת שיזוף דייטונה', price: 639, url: 'https://www.keter.com/he-il/daytona-deluxe-sun-lounger-252223.html' }
    ],
    pool: [
      { seller: 'adel', name: 'בריכת בטון כולל תכנון ובנייה', price: 65000, from: true, url: 'https://www.adelpool.co.il/' },
      { seller: 'hagag', name: 'בריכה מתועשת או בטון, כולל פיתוח נוף', url: 'https://hagag-pools.co.il/' }
    ],
    pergola: [
      { seller: 'UniKit', name: 'פרגולת אלומיניום (למ״ר)', price: 490, from: true, url: 'https://www.unikit.co.il/%D7%A4%D7%A8%D7%92%D7%95%D7%9C%D7%95%D7%AA-%D7%90%D7%9C%D7%95%D7%9E%D7%99%D7%A0%D7%99%D7%95%D7%9D-%D7%9E%D7%97%D7%99%D7%A8%D7%95%D7%9F/' },
      { seller: 'לִידָר', name: 'פרגולת אלומיניום (למ״ר)', price: 599, from: true, url: 'https://www.lidar.co.il/%D7%A4%D7%A8%D7%92%D7%95%D7%9C%D7%95%D7%AA-%D7%90%D7%9C%D7%95%D7%9E%D7%99%D7%A0%D7%99%D7%95%D7%9D/' }
    ],
    deck: [{ seller: 'GSOL', name: 'דק איפאה כולל התקנה (למ״ר)', price: 600, from: true, url: 'https://gsol.co.il/%D7%93%D7%A7-%D7%90%D7%99%D7%A4%D7%90%D7%94-%D7%9E%D7%97%D7%99%D7%A8/' }],
    lawn: [
      { seller: 'נטע גינון', name: 'דשא סינטטי כולל התקנה (למ״ר)', price: 130, from: true, url: 'https://www.neta-ginun.co.il/%D7%94%D7%AA%D7%A7%D7%A0%D7%AA-%D7%93%D7%A9%D7%90-%D7%A1%D7%99%D7%A0%D7%98%D7%98%D7%99-%D7%9E%D7%97%D7%99%D7%A8/' },
      { seller: 'דשא קבוע', name: 'דשא סינטטי מהיבואן, חומר בלבד (למ״ר)', price: 20, from: true, url: 'https://www.deshe-kavua.co.il/prices-synthetic-grass/' }
    ],
    oliveTree: [{ seller: 'hadarnoy', name: 'עצי זית מעוצבים ומאוקלמים', url: 'https://www.hadarnoy.co.il/%D7%A7%D7%98%D7%92%D7%95%D7%A8%D7%99%D7%AA-%D7%94%D7%A7%D7%98%D7%9C%D7%95%D7%92/%D7%A2%D7%A6%D7%99-%D7%96%D7%99%D7%AA-%D7%9C%D7%9E%D7%9B%D7%99%D7%A8%D7%94/' }],
    citrusTree: [
      { seller: 'הכל בו לגן', name: 'עץ לימון בעציץ 25 ליטר', url: 'https://www.kolbogan.co.il/product/%D7%A2%D7%A5-%D7%9C%D7%99%D7%9E%D7%95%D7%9F-25-%D7%9C%D7%99%D7%98%D7%A8' },
      { seller: 'אורגניקו', name: 'עץ לימון', price: 200, from: true, url: 'https://www.organi-co.co.il/product/lemon-tree-sale' }
    ],
    planterBed: [
      { seller: 'hadarnoy', name: 'בוגנוויליה מיני תאי 10 ליטר', price: 75, url: 'https://www.hadarnoy.co.il/%D7%97%D7%A0%D7%95%D7%AA/%D7%91%D7%95%D7%92%D7%A0%D7%95%D7%95%D7%99%D7%9C%D7%99%D7%94-%D7%9E%D7%99%D7%A0%D7%99-%D7%AA%D7%90%D7%99-%D7%A0%D7%A0%D7%A1%D7%99%D7%AA/' },
      { seller: 'אורגניקו', name: 'בוגנוויליה 10 ליטר', url: 'https://www.organi-co.co.il/product/bougainvillea' }
    ],
    grill: [
      { seller: 'ג. חיון', name: 'מטבח חוץ Weber Spirit עם גריל E-320', url: 'https://ghaun.online/product-category/%D7%94%D7%9B%D7%9C-%D7%9C%D7%92%D7%99%D7%A0%D7%94/%D7%92%D7%A8%D7%99%D7%9C%D7%99%D7%9D-%D7%95%D7%91%D7%99%D7%A9%D7%95%D7%9C-%D7%9C%D7%92%D7%99%D7%A0%D7%94-%D7%94%D7%9B%D7%9C-%D7%9C%D7%92%D7%99%D7%A0%D7%94/%D7%9E%D7%98%D7%91%D7%97%D7%99-%D7%92%D7%99%D7%A0%D7%94-1/' },
      { seller: 'כרמל דיירקט', name: 'גרילי גז Napoleon', url: 'https://carmeldirect.com/brand/napoleon-grill/' }
    ],
    waterfall: [{ seller: 'מידרג', name: 'מפל מים לגינה: מדריך מחירים', price: 5000, from: true, url: 'https://www.midrag.co.il/Content/Tip/12364' }],
    fountain: [{ seller: 'rocks.co.il', name: 'מזרקות ובריכות נוי', url: 'https://www.rocks.co.il/%D7%91%D7%A8%D7%99%D7%9B%D7%95%D7%AA-%D7%9E%D7%99%D7%9D-%D7%95%D7%9E%D7%96%D7%A8%D7%A7%D7%95%D7%AA/' }]
  };


  /* Real products. `url` entries were checked against ikea.com/il in September 2026;
     the rest open the product line in the IKEA Israel catalog search. */
  const IKEA_P = 'https://www.ikea.com/il/he/p/';
  const IKEA_Q = 'https://www.ikea.com/il/he/search/?q=';
  const PRODUCTS = {
    sofa3: [{ name: 'KIVIK ספה תלת-מושבית', url: IKEA_P + 'kivik-3-seat-sofa-tibbleby-beige-grey-s49440597/' }, { name: 'KIVIK ספה תלת-מושבית, Tresund בז׳ בהיר', url: IKEA_P + 'kivik-3-seat-sofa-tresund-light-beige-s89482830/' }],
    sofa2: [{ name: 'KIVIK ספה דו-מושבית', q: 'KIVIK' }, { name: 'LANDSKRONA ספה דו-מושבית', q: 'LANDSKRONA' }],
    sofaL: [{ name: 'KIVIK ספה תלת-מושבית כולל שזלונג', url: IKEA_P + 'kivik-3-seat-sofa-with-chaise-longue-tibbleby-beige-grey-s99440590/' }],
    armchair: [{ name: 'STRANDMON כורסה', q: 'STRANDMON' }, { name: 'POÄNG כורסה', q: 'POÄNG' }],
    coffeeTable: [{ name: 'LACK שולחן סלון', q: 'LACK' }, { name: 'LISTERBY שולחן סלון', q: 'LISTERBY' }],
    sideTable: [{ name: 'GLADOM שולחן מגש', q: 'GLADOM' }],
    tvConsole: [{ name: 'LACK מעמד לטלוויזיה 90×26×45', url: IKEA_P + 'lack-tv-bench-white-00450088/' }, { name: 'BESTÅ מזנונים לטלוויזיה', url: 'https://www.ikea.com/il/he/cat/tv-media-storage-14885/' }],
    rug: [{ name: 'STOCKHOLM שטיח', q: 'STOCKHOLM rug' }],
    floorLamp: [{ name: 'HEKTAR מנורה עומדת', q: 'HEKTAR' }],
    pendant: [{ name: 'NYMÅNE מנורה תלויה', q: 'NYMÅNE' }],
    plant: [{ name: 'FEJKA צמח מלאכותי', q: 'FEJKA' }],
    bookshelf: [{ name: 'BILLY ספרייה', q: 'BILLY' }, { name: 'KALLAX מדפים', q: 'KALLAX' }],
    diningTable: [{ name: 'EKEDALEN שולחן נפתח', q: 'EKEDALEN' }],
    chair: [{ name: 'EKEDALEN כיסא', q: 'EKEDALEN chair' }, { name: 'LISABO כיסא', q: 'LISABO' }],
    stool: [{ name: 'INGOLF כיסא בר', q: 'INGOLF' }],
    kitchenBase: [{ name: 'METOD מערכת מטבח', q: 'METOD' }],
    kitchenUpper: [{ name: 'METOD ארון עליון', q: 'METOD wall cabinet' }],
    island: [{ name: 'METOD אי מטבח', q: 'METOD island' }],
    bedDouble: [{ name: 'MALM מסגרת מיטה גבוהה 160×200', url: IKEA_P + 'malm-bed-frame-high-white-stained-oak-veneer-40263103/' }, { name: 'MALM מיטה עם אחסון 160×200', url: IKEA_P + 'malm-ottoman-bed-white-20404806/' }],
    nightstand: [{ name: 'HEMNES שידת לילה', q: 'HEMNES nightstand' }, { name: 'MALM שידת לילה', q: 'MALM nightstand' }],
    wardrobe: [{ name: 'PAX ארון בגדים', url: IKEA_P + 'pax-wardrobe-combination-s09503134/' }, { name: 'PAX מערכת ארונות בהתאמה', url: 'https://www.ikea.com/il/he/cat/pax-system-19086/' }],
    dresser: [{ name: 'HEMNES שידת מגירות', q: 'HEMNES chest' }, { name: 'MALM שידה', q: 'MALM chest' }],
    bedSingle: [{ name: 'SLÄKT מיטת יחיד', q: 'SLÄKT' }, { name: 'מיטות ילדים', url: 'https://www.ikea.com/il/he/cat/beds-bm003/' }],
    bunk: [{ name: 'SMÅSTAD מיטת קומותיים', q: 'SMÅSTAD bunk' }],
    desk: [{ name: 'MICKE שולחן כתיבה', q: 'MICKE' }, { name: 'ALEX שולחן כתיבה', q: 'ALEX desk' }],
    officeChair: [{ name: 'MARKUS כיסא משרדי', q: 'MARKUS' }],
    sofaBed: [{ name: 'FRIHETEN ספה נפתחת', q: 'FRIHETEN' }],
    vanity: [{ name: 'ENHET ארון לכיור', q: 'ENHET' }],
    shoeCabinet: [{ name: 'TRONES ארון נעליים', q: 'TRONES' }, { name: 'HEMNES ארון נעליים', q: 'HEMNES shoe' }],
    outdoorSet: [{ name: 'ÄPPLARÖ ריהוט מרפסת', q: 'ÄPPLARÖ' }]
  };
  Object.values(PRODUCTS).forEach((list) => list.forEach((p) => { if (!p.url) p.url = IKEA_Q + encodeURIComponent(p.q); p.store = 'ikea'; p.direct = !p.q; }));

  // each chain's own site, for a site search of the piece's Hebrew name
  const STORE_DOMAIN = {
    homecenter: 'homecenter.co.il', ace: 'ace.co.il', beitili: 'betili-shop.com', hollandia: 'hollandia.co.il',
    aminach: 'aminach.co.il', tollmans: 'tollmans.co.il', natuzzi: 'natuzzi.com', kastiel: 'kastiel', foxhome: 'foxhome.co.il',
    golf: 'golfco.co.il', regba: 'regba.co.il', shekem: 'shekem-electric.co.il', payngo: 'payngo.co.il',
    yagur: 'yagurgan.co.il', azur: 'azurflowers.co.il', hadarnoy: 'hadarnoy.co.il', adel: 'adelpool.co.il', hagag: 'hagag-pools.co.il',
    bialik: 'bialik-mashtelot.com', rgnursery: 'mashtelatramatgan.co.il', ganyarak: 'gan-yarak.co.il', shilav: 'shilav.co.il', iddesign: 'iddesign-shop.co.il', kuka: 'kuka-home.co.il'
  };
  function storeSearchUrl(storeId, query) {
    const d = STORE_DOMAIN[storeId];
    if (!d) return null;
    const q = d.includes('.') ? `site:${d} ${query}` : `${d} ${query}`;
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }

  const TIERS = { eco: 'חסכוני', mid: 'בינוני', prem: 'פרימיום' };
  const TIER_INDEX = { eco: 0, mid: 1, prem: 2 };

  window.IH = window.IH || {};
  MODELS.sofaL = MODELS.sofa3;
  MODELS.sofa2 = MODELS.sofa3.filter((m) => !/255|260/.test(m.name));
  Object.assign(window.IH, { CATALOG, TIERS, TIER_INDEX, PRODUCTS, MODELS, storeSearchUrl });
})();
