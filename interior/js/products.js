/* Product catalog: real products from Israeli stores that a planned piece can be swapped for,
   or added to a room. Prices were read from the stores' sites and price-comparison pages in
   October 2026; they change, so every product links to the store. Sizes are in meters.
   `look` decides how the product shows in 3D: a real model key, a fabric colour and a finish
   (white, oak, walnut, black, grey, natural). */
(function () {
  'use strict';
  const IK = 'https://www.ikea.com/il/he/p/';
  const IKC = 'https://www.ikea.com/il/he/cat/';
  const BT = 'https://www.betili-shop.com/';

  const P = [
    /* ----- sofas ----- */
    { type: 'sofa3', name: 'KIVIK ספה תלת-מושבית', seller: 'ikea', price: 1950, url: IK + 'kivik-3-seat-sofa-frame-00519361/', w: 2.28, d: 0.95, h: 0.83, look: { model: 'linenSofa', color: '#b9b2a6' }, tags: ['scandi', 'japandi', 'modern'] },
    { type: 'sofa3', name: 'SÖDERHAMN ספה תלת-מושבית, Fridtuna בז׳ בהיר', seller: 'ikea', price: 2995, url: IKC + 'soederhamn-series-22178/', w: 1.98, d: 0.99, h: 0.69, look: { model: 'linenSofa', color: '#e3dccd' }, tags: ['scandi', 'japandi', 'boho'] },
    { type: 'sofa3', name: 'ספה תלת-מושבית לאונג׳', seller: 'aminach', price: 2390, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316', w: 2.2, d: 0.95, h: 0.85, look: { model: 'linenSofa', color: '#a59a8b' }, tags: ['modern', 'scandi'] },
    { type: 'sofa3', name: 'ספה תלת-מושבית 255 ס״מ דגם קלינטון', seller: 'beitili', price: 3499, url: BT + 'catalogsearch/result/?q=%D7%A7%D7%9C%D7%99%D7%A0%D7%98%D7%95%D7%9F', w: 2.55, d: 0.95, h: 0.86, look: { model: 'linenSofa', color: '#8b8f90' }, tags: ['modern', 'industrial'] },
    { type: 'sofa3', name: 'ספה תלת-מושבית דגם פיראוס', seller: 'beitili', price: 3051, url: BT + 'catalogsearch/result/?q=%D7%A4%D7%99%D7%A8%D7%90%D7%95%D7%A1', w: 2.3, d: 0.95, h: 0.85, look: { model: 'linenSofa', color: '#6f7d74' }, tags: ['scandi', 'boho'] },
    { type: 'sofa3', name: 'ספות קטיפה בקטלוג טולמנ׳ס', seller: 'tollmans', price: null, url: 'https://www.tollmansdot.co.il/', w: 2.3, d: 0.95, h: 0.8, look: { model: 'velvetSofa' }, tags: ['classic', 'boho'] },
    { type: 'sofa3', name: 'מערכת ישיבה מעור דגם ברונו', seller: 'natuzzi', price: 7600, from: true, url: 'https://www.natuzzi.com/', w: 2.3, d: 0.98, h: 0.84, look: { model: 'leatherSofa' }, tags: ['classic', 'industrial'] },
    { type: 'sofa3', name: 'ספה מעור דגם אדיסון', seller: 'natuzzi', price: 15375, from: true, url: 'https://www.natuzzi.com/', w: 2.35, d: 1.0, h: 0.86, look: { model: 'leatherSofa' }, tags: ['classic', 'industrial'] },
    { type: 'sofa3', name: 'ספה מודולרית VESTA', seller: 'tollmans', price: 39693, url: 'https://www.tollmansdot.co.il/product/vesta-2/', w: 2.6, d: 1.05, h: 0.8, look: { model: 'linenSofa', color: '#cfc8bb' }, tags: ['modern', 'japandi'] },
    { type: 'sofaL', name: 'KIVIK ספה תלת-מושבית עם שזלונג, Tibbleby בז׳/אפור', seller: 'ikea', price: 3890, url: IK + 'kivik-3-seat-sofa-with-chaise-longue-tibbleby-beige-grey-s99440590/', w: 2.8, d: 1.63, h: 0.83, look: { color: '#bdb5a8' }, tags: ['scandi', 'japandi'] },
    { type: 'sofaL', name: 'KIVIK ספה עם שזלונג, Kelinge אפור-טורקיז', seller: 'ikea', price: 4040, url: IK + 'kivik-3-seat-sofa-with-chaise-longue-kelinge-grey-turquoise-s39443054/', w: 2.8, d: 1.63, h: 0.83, look: { color: '#7e9d9c' }, tags: ['boho', 'scandi'] },
    { type: 'sofaL', name: 'KIVIK ספה עם שזלונג, Grann/Bomstad שחור', seller: 'ikea', price: 6990, url: IK + 'kivik-3-seat-sofa-with-chaise-longue-grann-bomstad-black-s89443184/', w: 2.8, d: 1.63, h: 0.83, look: { color: '#2b2b2c' }, tags: ['industrial', 'modern'] },
    { type: 'sofaL', name: 'ספה פינתית 270 ס״מ בגוון אבן דגם ריילי', seller: 'beitili', price: 4799, url: BT + '505221.html', w: 2.7, d: 1.7, h: 0.85, look: { color: '#b7aea0' }, tags: ['modern', 'japandi'] },
    { type: 'sofaL', name: 'ספה פינתית 300 ס״מ כחולה דגם ג׳ניס', seller: 'beitili', price: 4099, url: BT + '503817.html', w: 3.0, d: 1.7, h: 0.85, look: { color: '#3d4e6c' }, tags: ['classic', 'modern'] },
    { type: 'sofaL', name: 'ספה פינתית 300 ס״מ אפור בהיר דגם ג׳ניס', seller: 'beitili', price: 4099, url: BT + '504244.html', w: 3.0, d: 1.7, h: 0.85, look: { color: '#a9aaa7' }, tags: ['scandi', 'modern'] },
    { type: 'sofaL', name: 'ספה פינתית משולבת דמוי עור דגם ליה', seller: 'beitili', price: 9513, url: BT + '505314.html', w: 3.0, d: 1.7, h: 0.85, look: { color: '#9d927f' }, tags: ['industrial', 'classic'] },
    { type: 'sofaBed', name: 'FRIHETEN ספה נפתחת, Skiftebo אפור כהה', seller: 'ikea', price: 2795, url: IK + 'friheten-three-seat-sofa-bed-skiftebo-dark-grey-50341148/', w: 2.13, d: 1.05, h: 0.66, look: { color: '#4b4e51' }, tags: ['modern', 'industrial'] },
    { type: 'sofaBed', name: 'ספת אירוח נפתחת דגם ג׳נסיס', seller: 'aminach', price: 3289, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316', w: 2.1, d: 0.95, h: 0.85, look: { color: '#8e8b84' }, tags: ['scandi', 'modern'] },
    { type: 'sofaBed', name: 'ספת אירוח נפתחת דגם יופיטר', seller: 'aminach', price: 3989, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316', w: 2.2, d: 1.0, h: 0.85, look: { color: '#6e6a62' }, tags: ['classic', 'modern'] },
    { type: 'sofaBed', name: 'ספת אירוח דגם ריקסט כחול', seller: 'aminach', price: 6980, url: 'https://www.zap.co.il/models.aspx?sog=h-livingroomset&db137868=11574316', w: 2.2, d: 1.0, h: 0.85, look: { color: '#344f78' }, tags: ['classic', 'boho'] },

    /* ----- armchairs ----- */
    { type: 'armchair', name: 'EKERÖ כורסה, Skiftebo כחול כהה', seller: 'ikea', price: 795, url: IK + 'ekeroe-armchair-skiftebo-dark-blue-20262878/', w: 0.7, d: 0.73, h: 0.76, look: { model: 'armchair', color: '#2f3f5c' }, tags: ['modern', 'scandi'] },
    { type: 'armchair', name: 'EKERÖ כורסה, Skiftebo צהוב', seller: 'ikea', price: 795, url: IK + 'ekeroe-armchair-skiftebo-yellow-00262879/', w: 0.7, d: 0.73, h: 0.76, look: { model: 'armchair', color: '#d6a43c' }, tags: ['boho', 'scandi'] },
    { type: 'armchair', name: 'EKERÖ כורסה, Skiftebo כתום', seller: 'ikea', price: 795, url: IK + 'ekeroe-armchair-skiftebo-orange-80262880/', w: 0.7, d: 0.73, h: 0.76, look: { model: 'armchair', color: '#c4673a' }, tags: ['boho', 'industrial'] },
    { type: 'armchair', name: 'EKERÖ כורסה, Skiftebo אפור כהה', seller: 'ikea', price: 795, url: IK + 'ekeroe-armchair-skiftebo-dark-grey-60494584/', w: 0.7, d: 0.73, h: 0.76, look: { model: 'armchair', color: '#55585b' }, tags: ['modern', 'industrial'] },
    { type: 'armchair', name: 'POÄNG כורסה, ליבנה/Knisa בז׳ בהיר', seller: 'ikea', price: 490, url: IKC + 'armchairs-chaise-longues-fu006/', w: 0.68, d: 0.82, h: 1.0, look: { model: 'armchair', color: '#ddd0b8' }, tags: ['scandi', 'japandi'] },
    { type: 'armchair', name: 'STRANDMON כורסה, Skiftebo צהוב', seller: 'ikea', price: 1195, url: IKC + 'armchairs-chaise-longues-fu006/', w: 0.82, d: 0.96, h: 1.01, look: { model: 'damaskChair' }, tags: ['classic', 'boho'] },
    { type: 'armchair', name: 'STRANDMON כורסה, Grann/Bomstad חום כהה', seller: 'ikea', price: 1995, url: IKC + 'leather-armchairs-10696/', w: 0.82, d: 0.96, h: 1.01, look: { model: 'leatherArmchair', color: '#6b4c39' }, tags: ['industrial', 'classic'] },
    { type: 'armchair', name: 'כורסאות בקטלוג ביתילי', seller: 'beitili', price: null, url: BT + 'rihvt.html', w: 0.95, d: 0.85, h: 0.84, look: { model: 'leatherArmchair' }, tags: ['modern', 'scandi'] },

    /* ----- tables ----- */
    { type: 'coffeeTable', name: 'LACK שולחן קפה, לבן, ‎118x78', seller: 'ikea', price: 245, url: IK + 'lack-coffee-table-white-80449901/', w: 1.18, d: 0.78, h: 0.45, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'coffeeTable', name: 'LACK שולחן קפה, לבן, ‎90x55', seller: 'ikea', price: 125, url: IKC + 'lack-series-09063/', w: 0.9, d: 0.55, h: 0.45, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'coffeeTable', name: 'VITTSJÖ שולחן קפה עגול, לבן/זכוכית, 75 ס״מ', seller: 'ikea', price: 295, url: IKC + 'vittsjoe-serie-22584/', w: 0.75, d: 0.75, h: 0.45, look: { model: 'roundTable', finish: 'white' }, tags: ['modern'] },
    { type: 'coffeeTable', name: 'שולחנות סלון בקטלוג ביתילי', seller: 'beitili', price: 370, from: true, url: BT + 'rihvt/tables/wvlhnvt-slvn.html', w: 1.21, d: 0.53, h: 0.45, look: { model: 'coffeeTable' }, tags: ['scandi', 'modern', 'japandi'] },
    { type: 'coffeeTable', name: 'שולחנות סלון עגולים בקטלוג ביתילי', seller: 'beitili', price: 370, from: true, url: BT + 'rihvt/tables/wvlhnvt-slvn.html', w: 0.9, d: 0.9, h: 0.5, look: { model: 'roundTable', finish: 'natural' }, tags: ['classic', 'boho'] },
    { type: 'tvConsole', name: 'BESTÅ מעמד לטלוויזיה, לבן, ‎120x40x38', seller: 'ikea', price: 435, url: IK + 'besta-tv-bench-white-80294503/', w: 1.2, d: 0.4, h: 0.38, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'tvConsole', name: 'BESTÅ מעמד לטלוויזיה, לבן, ‎180x40x38', seller: 'ikea', price: 595, url: IK + 'besta-tv-bench-white-00474070/', w: 1.8, d: 0.4, h: 0.38, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'tvConsole', name: 'BESTÅ מעמד לטלוויזיה, לבן, ‎180x40x64', seller: 'ikea', price: 795, url: IK + 'besta-tv-bench-white-70299879/', w: 1.8, d: 0.4, h: 0.64, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'tvConsole', name: 'BESTÅ מעמד לטלוויזיה עם דלתות Selsviken מבריק', seller: 'ikea', price: 1165, url: IK + 'besta-tv-bench-with-doors-white-selsviken-high-gloss-white-s19330703/', w: 1.8, d: 0.42, h: 0.38, look: { finish: 'white' }, tags: ['modern'] },
    { type: 'tvConsole', name: 'מזנון 200 ס״מ פורניר אלון, 2 מגירות, דגם ברודווי', seller: 'beitili', price: 1499, url: BT + 'rihvt/mznvnim.html', w: 2.0, d: 0.45, h: 0.5, look: { finish: 'oak' }, tags: ['scandi', 'japandi', 'boho'] },
    { type: 'tvConsole', name: 'מזנון 220 ס״מ שחור מט דגם אופל', seller: 'beitili', price: 2379, url: BT + 'rihvt/mznvnim.html', w: 2.2, d: 0.45, h: 0.48, look: { finish: 'black' }, tags: ['industrial', 'modern'] },
    { type: 'diningTable', name: 'EKEDALEN שולחן נפתח, לבן, ‎180/240x90', seller: 'ikea', price: 995, url: IK + 'ekedalen-extendable-table-white-70340765/', w: 1.8, d: 0.9, h: 0.75, look: { model: 'oakTable', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'diningTable', name: 'LISABO שולחן, פורניר אש, ‎140x78', seller: 'ikea', price: 895, url: IKC + 'lisabo-series-30662/', w: 1.4, d: 0.78, h: 0.74, look: { model: 'oakTable', finish: 'natural' }, tags: ['scandi', 'japandi'] },
    { type: 'diningTable', name: 'שולחן אוכל נפתח 98x200 דגם אוסקר', seller: 'beitili', price: 3730, url: BT + 'catalogsearch/result/?q=%D7%90%D7%95%D7%A1%D7%A7%D7%A8', w: 2.0, d: 0.98, h: 0.76, look: { model: 'oakTable', finish: 'walnut' }, tags: ['classic', 'industrial'] },
    { type: 'diningTable', name: 'שולחן נפתח 180 פורניר אלון דגם אימפלה', seller: 'beitili', price: 4554, url: BT + 'catalogsearch/result/?q=%D7%90%D7%99%D7%9E%D7%A4%D7%9C%D7%94', w: 1.8, d: 0.95, h: 0.76, look: { model: 'oakTable', finish: 'oak' }, tags: ['scandi', 'japandi', 'boho'] },
    { type: 'diningTable', name: 'שולחן אוכל זכוכית עם מסגרת מתכת', seller: 'kastiel', price: 3900, from: true, url: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%A9%D7%95%D7%9C%D7%97%D7%9F+%D7%90%D7%95%D7%9B%D7%9C', w: 1.8, d: 1.0, h: 0.76, look: { model: 'glassTable' }, tags: ['modern', 'industrial'] },

    /* ----- chairs ----- */
    { type: 'chair', name: 'SANDSBERG כיסא, לבן', seller: 'ikea', price: 69, url: IKC + 'dining-chairs-all-25220/', w: 0.44, d: 0.5, h: 0.8, look: { model: 'shellChair' }, tags: ['scandi', 'modern'] },
    { type: 'chair', name: 'TEODORES כיסא, לבן', seller: 'ikea', price: 195, url: IKC + 'dining-chairs-all-25220/', w: 0.46, d: 0.54, h: 0.8, look: { model: 'shellChair' }, tags: ['scandi', 'modern'] },
    { type: 'chair', name: 'JANINGE כיסא, אפור', seller: 'ikea', price: 245, url: IKC + 'dining-chairs-all-25220/', w: 0.5, d: 0.48, h: 0.76, look: { model: 'tubChair', color: '#9a9c9c' }, tags: ['modern', 'industrial'] },
    { type: 'chair', name: 'PINNTORP כיסא, צבוע לבן', seller: 'ikea', price: 245, url: IKC + 'dining-chairs-all-25220/', w: 0.42, d: 0.51, h: 0.84, look: { model: 'ladderChair' }, tags: ['classic', 'boho', 'scandi'] },
    { type: 'chair', name: 'TOBIAS כיסא, שקוף/כרום', seller: 'ikea', price: 450, url: IKC + 'dining-chairs-all-25220/', w: 0.55, d: 0.56, h: 0.82, look: { model: 'shellChair' }, tags: ['modern'] },
    { type: 'chair', name: 'SKANSNÄS כיסא', seller: 'ikea', price: 495, url: IKC + 'upholstered-chairs-25221/', w: 0.52, d: 0.54, h: 0.79, look: { model: 'ladderChair' }, tags: ['scandi', 'japandi'] },
    { type: 'chair', name: 'כיסא פינת אוכל דמוי עור שחור דגם קולין', seller: 'beitili', price: 413, url: BT + 'rihvt/kisavt/dining-chairs.html', w: 0.5, d: 0.58, h: 0.86, look: { model: 'tubChair' }, tags: ['modern', 'industrial'] },
    { type: 'chair', name: 'כיסא פינת אוכל דגם נאפולי', seller: 'beitili', price: 444, url: BT + 'rihvt/kisavt/dining-chairs.html', w: 0.5, d: 0.58, h: 0.86, look: { model: 'tubChair', color: '#7a6250' }, tags: ['classic', 'industrial'] },
    { type: 'chair', name: 'כיסא פינת אוכל אפור בהיר דגם מרסי', seller: 'beitili', price: 199, url: BT + 'rihvt/kisavt/dining-chairs.html', w: 0.48, d: 0.55, h: 0.84, look: { model: 'shellChair', color: '#c9c9c6' }, tags: ['scandi', 'modern'] },
    { type: 'chair', name: 'כיסא פינת אוכל עור חום דגם ג׳ייד', seller: 'beitili', price: 903, url: BT + '306330.html', w: 0.5, d: 0.6, h: 0.88, look: { model: 'tubChair', color: '#7b5236' }, tags: ['classic', 'industrial'] },
    { type: 'chair', name: 'כיסאות אוכל קסטיאל', seller: 'kastiel', price: 700, from: true, url: 'https://www.google.com/search?q=%D7%A7%D7%A1%D7%98%D7%99%D7%90%D7%9C+%D7%9B%D7%99%D7%A1%D7%90%D7%95%D7%AA', w: 0.5, d: 0.56, h: 0.84, look: { model: 'ladderChair' }, tags: ['classic'] },
    { type: 'officeChair', name: 'MARKUS כיסא משרדי, Vissle אפור כהה', seller: 'ikea', price: 895, url: IK + 'markus-office-chair-vissle-dark-grey-70261150/', w: 0.62, d: 0.6, h: 1.3, look: { color: '#3d4043' }, tags: ['modern', 'industrial', 'scandi'] },

    /* ----- desks ----- */
    { type: 'desk', name: 'MICKE שולחן כתיבה, לבן, ‎105x50', seller: 'ikea', price: 595, url: IKC + 'desks-for-home-20651/', w: 1.05, d: 0.5, h: 0.75, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'desk', name: 'MICKE שולחן כתיבה, לבן, ‎73x50', seller: 'ikea', price: 395, url: IKC + 'desks-for-home-20651/', w: 0.73, d: 0.5, h: 0.75, look: { finish: 'white' }, tags: ['scandi'] },
    { type: 'desk', name: 'ALEX שולחן כתיבה, לבן, ‎132x58', seller: 'ikea', price: 850, url: IK + 'alex-desk-white-80483438/', w: 1.32, d: 0.58, h: 0.76, look: { finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'desk', name: 'ALEX שולחן כתיבה, לבן/גוון אלון, ‎132x58', seller: 'ikea', price: 895, url: IKC + 'desks-for-home-20651/', w: 1.32, d: 0.58, h: 0.76, look: { finish: 'oak' }, tags: ['scandi', 'japandi'] },

    /* ----- bedroom ----- */
    { type: 'bedDouble', name: 'MALM מסגרת מיטה גבוהה, לבן, ‎160x200', seller: 'ikea', price: 1095, url: IK + 'malm-bed-frame-high-white-40249471/', w: 1.76, d: 2.09, h: 1.0, look: { model: 'bed', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'bedDouble', name: 'MALM מסגרת מיטה גבוהה, אלון מולבן, ‎160x200', seller: 'ikea', price: 1095, url: IK + 'malm-bed-frame-high-white-stained-oak-veneer-40263103/', w: 1.76, d: 2.09, h: 1.0, look: { model: 'bed', finish: 'oak' }, tags: ['scandi', 'japandi'] },
    { type: 'bedDouble', name: 'MALM מיטה עם אחסון, לבן, ‎160x200', seller: 'ikea', price: 2950, url: IK + 'malm-ottoman-bed-white-20404806/', w: 1.76, d: 2.09, h: 1.0, look: { model: 'bed', finish: 'white' }, tags: ['modern'] },
    { type: 'bedDouble', name: 'מיטות זוגיות בקטלוג עמינח', seller: 'aminach', price: null, url: 'https://www.aminach.co.il/', w: 1.7, d: 2.1, h: 1.1, look: { model: 'bed', finish: 'walnut' }, tags: ['classic', 'industrial'] },
    { type: 'bedDouble', name: 'מזרן Wings ‎160x200', seller: 'hollandia', price: 6502, url: 'https://hollandia.co.il/%D7%9E%D7%96%D7%A8%D7%9F-WINGS-2/', w: 1.7, d: 2.1, h: 0.9, look: { model: 'bed' }, tags: ['classic', 'modern', 'scandi'] },
    { type: 'nightstand', name: 'HEMNES שידת לילה, ‎46x35', seller: 'ikea', price: 295, url: IK + 'hemnes-bedside-table-grey-green-light-brown-stained-50610739/', w: 0.46, d: 0.35, h: 0.7, look: { model: 'nightstand', finish: 'grey' }, tags: ['scandi', 'classic'] },
    { type: 'nightstand', name: 'שידת לילה 3 מגירות דגם GF19A030', seller: 'beitili', price: 799, url: BT + '104121.html', w: 0.5, d: 0.4, h: 0.6, look: { model: 'nightstand', finish: 'walnut' }, tags: ['classic', 'industrial'] },
    { type: 'dresser', name: 'MALM שידת 3 מגירות, לבן, ‎80x78', seller: 'ikea', price: 595, url: IK + 'malm-chest-of-3-drawers-white-20403562/', w: 0.8, d: 0.48, h: 0.78, look: { model: 'dresser', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'dresser', name: 'MALM שידת 6 מגירות, לבן, ‎160x78', seller: 'ikea', price: 995, url: IK + 'malm-chest-of-6-drawers-white-60403584/', w: 1.6, d: 0.48, h: 0.78, look: { model: 'dresser', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'dresser', name: 'שידה 35x100 ס״מ 3 מגירות עץ טבעי דגם הומי', seller: 'beitili', price: null, url: BT + '502518.html', w: 1.0, d: 0.35, h: 0.8, look: { model: 'dresser', finish: 'natural' }, tags: ['japandi', 'boho'] },
    { type: 'wardrobe', name: 'KLEPPSTAD ארון 2 דלתות, לבן, ‎79x55x176', seller: 'ikea', price: 595, url: IKC + 'wardrobes-19053/', w: 0.79, d: 0.55, h: 1.76, look: { model: 'wardrobe', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'wardrobe', name: 'KLEPPSTAD ארון דלתות הזזה, לבן, ‎117x55x176', seller: 'ikea', price: 945, url: IKC + 'wardrobes-19053/', w: 1.17, d: 0.55, h: 1.76, look: { model: 'wardrobe', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'wardrobe', name: 'BRIMNES ארון 3 דלתות, לבן, ‎117x50x190', seller: 'ikea', price: 1100, url: IKC + 'wardrobes-19053/', w: 1.17, d: 0.5, h: 1.9, look: { model: 'wardrobe', finish: 'white' }, tags: ['scandi', 'modern'] },
    { type: 'wardrobe', name: 'PAX ארון בגדים, לבן, ‎150x58x236', seller: 'ikea', price: 1580, url: IK + 'pax-wardrobe-combination-white-s59502740/', w: 1.5, d: 0.58, h: 2.36, look: { model: 'wardrobe', finish: 'white' }, tags: ['scandi', 'modern', 'japandi'] },
    { type: 'wardrobe', name: 'PAX / ÅHEIM ארון בגדים, לבן/מראה, ‎150x60x201', seller: 'ikea', price: null, url: IK + 'pax-aheim-wardrobe-combination-white-mirror-glass-s99502781/', w: 1.5, d: 0.6, h: 2.01, look: { model: 'wardrobe', finish: 'white' }, tags: ['modern', 'classic'] },
    { type: 'wardrobe', name: 'PAX ארון בגדים, לבן, ‎375x58x236', seller: 'ikea', price: 5460, url: IK + 'pax-wardrobe-combination-white-s39502543/', w: 3.75, d: 0.58, h: 2.36, look: { model: 'wardrobe', finish: 'white' }, tags: ['modern', 'scandi'] },

    /* ----- textiles, lighting, plants ----- */
    { type: 'rug', name: 'STOENSE שטיח סיבים קצרים, אפור, ‎200x300', seller: 'ikea', price: 895, url: IK + 'stoense-rug-low-pile-medium-grey-30426836/', w: 3.0, d: 2.0, h: 0.01, look: { color: '#8f8d88' }, tags: ['modern', 'industrial', 'scandi'] },
    { type: 'rug', name: 'MORUM שטיח פנים וחוץ, בז׳, ‎200x300', seller: 'ikea', price: 595, url: IKC + 'large-medium-rugs-10692/', w: 3.0, d: 2.0, h: 0.01, look: { color: '#cdbfa6' }, tags: ['boho', 'japandi'] },
    { type: 'rug', name: 'LOKALTÅG שטיח, ‎200x300', seller: 'ikea', price: 595, url: IKC + 'large-medium-rugs-10692/', w: 3.0, d: 2.0, h: 0.01, look: { color: '#d8d2c6' }, tags: ['scandi'] },
    { type: 'rug', name: 'TÅGSPÅR שטיח בעבודת יד, ‎200x300', seller: 'ikea', price: 2795, url: IKC + 'handmade-rugs-39267/', w: 3.0, d: 2.0, h: 0.01, look: { color: '#b98d6a' }, tags: ['boho', 'classic'] },
    { type: 'floorLamp', name: 'HEKTAR מנורה עומדת, אפור כהה', seller: 'ikea', price: 295, url: IK + 'hektar-floor-lamp-dark-grey-00215307/', w: 0.4, d: 0.4, h: 1.81, look: { model: 'floorLamp' }, tags: ['industrial', 'modern'] },
    { type: 'pendant', name: 'HEKTAR מנורת תלייה, אפור כהה, 22 ס״מ', seller: 'ikea', price: 145, url: IK + 'hektar-pendant-lamp-dark-grey-80390359/', w: 0.22, d: 0.22, h: 0.3, look: {}, tags: ['industrial', 'modern', 'scandi'] },
    { type: 'pendant', name: 'נברשות בקטלוג אייס', seller: 'ace', price: null, url: 'https://www.ace.co.il/', w: 0.62, d: 0.62, h: 0.45, look: { model: 'chandelier' }, tags: ['classic', 'boho'] },
    { type: 'plant', name: 'עציצים גדולים בהום סנטר', seller: 'homecenter', price: null, url: 'https://www.homecenter.co.il/', w: 0.5, d: 0.5, h: 1.3, look: { model: 'plant' }, tags: ['scandi', 'boho', 'modern'] },
    { type: 'plant', name: 'צמחי בית ועציצים במשתלת גן ירק', seller: 'ganyarak', price: null, url: 'https://www.gan-yarak.co.il/', w: 0.6, d: 0.6, h: 0.8, look: { model: 'fern' }, tags: ['japandi', 'boho', 'scandi'] }
  ];

  // the earlier per-type models from catalog.js join the list (each a real product with a price or a link)
  const IH = window.IH = window.IH || {};
  Object.entries(IH.MODELS || {}).forEach(([type, list]) => list.forEach((m) => {
    if (P.some((p) => p.name === m.name)) return;
    P.push({ type, name: m.name, seller: m.seller, price: m.price || null, from: !!m.from, url: m.url, look: {}, tags: [] });
  }));
  P.forEach((p, i) => { p.id = 'p' + (i + 1); });
  const BY_ID = {};
  P.forEach((p) => { BY_ID[p.id] = p; });

  // pieces that can stand in for each other when swapping
  const SWAP = [
    ['sofa3', 'sofa2', 'sofaL', 'sofaBed'], ['armchair'], ['coffeeTable', 'sideTable'], ['tvConsole'], ['diningTable'],
    ['chair', 'stool'], ['officeChair'], ['desk'], ['bedDouble'], ['bedSingle', 'bunk'], ['nightstand'], ['dresser'],
    ['wardrobe'], ['bookshelf'], ['rug'], ['floorLamp'], ['pendant'], ['plant']
  ];
  function swapGroup(type) { return SWAP.find((g) => g.includes(type)) || [type]; }

  // what can be added from the catalog, by section
  const ADD_SECTIONS = [
    ['ספות וכורסאות', ['sofa3', 'sofaL', 'sofaBed', 'armchair']],
    ['שולחנות', ['coffeeTable', 'sideTable', 'diningTable', 'desk']],
    ['כיסאות', ['chair', 'officeChair', 'stool']],
    ['שינה', ['bedDouble', 'bedSingle', 'nightstand']],
    ['אחסון', ['wardrobe', 'dresser', 'bookshelf', 'tvConsole']],
    ['תאורה, שטיחים וצמחים', ['floorLamp', 'pendant', 'rug', 'plant']]
  ];

  Object.assign(IH, { PRODUCT_DB: P, PRODUCT_BY_ID: BY_ID, swapGroup, ADD_SECTIONS, PRODUCTS_CHECKED: 'אוקטובר 2026' });
})();
