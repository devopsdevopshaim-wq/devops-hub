// רשימת חברות סליקה ישראליות + קישורי כניסה/הרשמה ("קיצורי דרך").
// הקישורים מוצגים בממשק המנהל בכפתור "כניסה לחברת הסליקה".
export default [
  {
    id: 'mock',
    name: 'סליקת בדיקה (ללא כסף אמיתי)',
    website: '',
    signupUrl: '',
    dashboardUrl: '',
    notes: 'למצב פיתוח ובדיקות. אין חיוב אמיתי.',
  },
  {
    id: 'tranzila',
    name: 'טרנזילה (Tranzila)',
    website: 'https://www.tranzila.com/',
    signupUrl: 'https://www.tranzila.com/',
    dashboardUrl: 'https://my.tranzila.com/',
    notes: 'דרוש: שם מסוף (terminal). עובד עם דף תשלום מאובטח (iframe/redirect).',
  },
  {
    id: 'cardcom',
    name: 'קארדקום (Cardcom)',
    website: 'https://www.cardcom.solutions/',
    signupUrl: 'https://www.cardcom.solutions/',
    dashboardUrl: 'https://secure.cardcom.solutions/',
    notes: 'דרוש: מספר מסוף ושם משתמש API. דף סליקה "Low Profile".',
  },
  {
    id: 'grow',
    name: 'גרואו / משולם (Grow)',
    website: 'https://grow.business/',
    signupUrl: 'https://grow.business/',
    dashboardUrl: 'https://grow.business/',
    notes: 'דרוש: pageCode ו-userId. תומך גם ב-Bit, Apple Pay ו-Google Pay.',
  },
  {
    id: 'payplus',
    name: 'פיי פלוס (PayPlus)',
    website: 'https://www.payplus.co.il/',
    signupUrl: 'https://www.payplus.co.il/',
    dashboardUrl: 'https://www.payplus.co.il/',
    notes: 'דרוש: API Key, Secret Key ו-Payment Page UID.',
  },
];
