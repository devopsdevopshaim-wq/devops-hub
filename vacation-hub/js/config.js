/* ===========================================================
   הגדרות העסק — כאן מחברים את האתר לסוכנות שלכם
   ----------------------------------------------------------
   agency   — פרטי הסוכן/הסוכנות. ברגע שממלאים וואטסאפ או מייל,
              כפתור "סגירת דיל דרך הסוכן" נדלק באתר ושולח את כל
              פרטי הדיל ישירות אליכם.
   partners — מזהי שותפים (Affiliate). כשהם מלאים, כל הזמנה שנסגרת
              דרך הכפתורים באתר נרשמת על שמכם ומזכה בעמלה.
              משאירים ריק = הקישורים עובדים רגיל, בלי עמלה.
   =========================================================== */

window.APP_CONFIG = {
  agency: {
    name: '',          // שם הסוכנות, לדוגמה: 'מסע תיירות'
    whatsapp: '',      // מספר בפורמט בינלאומי בלי + ובלי מקפים, לדוגמה: '972501234567'
    phone: '',         // לתצוגה, לדוגמה: '050-123-4567'
    email: '',         // לדוגמה: 'deals@example.co.il'
    license: ''        // מספר רישיון סוכן נסיעות (אם יש) — מוצג בתחתית האתר
  },

  partners: {
    bookingAid: '',          // Booking.com Affiliate Partner Program → מספר aid
    travelpayoutsMarker: '', // Travelpayouts (טיסות ומלונות ממאות ספקים) → marker
    expediaAffcid: '',       // Expedia Group Affiliate Program → affcid
    discoverCarsAid: '',     // Discover Cars Affiliate → a_aid
    getYourGuidePartner: ''  // GetYourGuide Partner Program → partner_id
  }
};
