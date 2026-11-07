#!/usr/bin/env python3
"""Builds the per-event pages search engines find (l/<event>.html) and sitemap.xml from business.json.
The pages carry real text and the packages at build time; js/landing.js refreshes the packages from business.json
when someone opens them, so prices changed from the studio show at once. Run after changing the texts here:

    python3 frame-studio/tools/build-landing.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/'
biz = json.loads((ROOT / 'business.json').read_text(encoding='utf-8'))
E = html.escape

EVENTS = [
    ('wedding', 'חתונה', '💍', 'מגנטים לחתונה', 'מגנטים לחתונה עם צילום והדפסה במקום',
     'כל זוג אורחים יוצא מהחתונה עם מגנט אישי: תמונה שצולמה באירוע, במסגרת שעוצבה במיוחד עם השמות שלכם והתאריך. תוך פחות מדקה המגנט ביד, ושנים אחר כך הוא עדיין על המקרר.',
     ['מסגרת בעיצוב אישי בצבעים של החתונה, עם שמות החתן והכלה והתאריך', 'צלם מקצועי שעובר בין השולחנות ועל רחבת הריקודים', 'עמדת הדפסה מעוצבת שמשתלבת בעיצוב האולם', 'אלבום מגנטים לזוג וגלריה דיגיטלית לכל האורחים'],
     [('כמה זמן לפני החתונה צריך להזמין?', 'בעונת החתונות תאריכים נסגרים מוקדם, ולכן כדאי לשריין כמה חודשים מראש. אפשר לבדוק באתר אם התאריך פנוי.'),
      ('אפשר להתאים את המסגרת להזמנה של החתונה?', 'כן. שולחים לנו את ההזמנה או את פלטת הצבעים, ואנחנו מעצבים מסגרת תואמת ושולחים הדמיה לאישור.')]),
    ('barmitzvah', 'בר/בת מצווה', '✡️', 'מגנטים לבר מצווה ובת מצווה', 'מגנטים לבר מצווה ובת מצווה',
     'המשפחה והחברים מצטלמים, ותוך דקה כל אחד מקבל מגנט עם השם של חתן או כלת המצווה. מזכרת שמחה שנשארת על המקרר, והילדים פשוט מתים על זה.',
     ['מסגרת עם השם, התאריך ועיצוב לפי סגנון האירוע', 'צילום של המשפחה, החברים מהכיתה והסבים והסבתות', 'הדפסה מהירה כך שאין תורים ליד העמדה', 'אפשרות לאירוע בוקר בבית הכנסת ולמסיבה בערב'],
     [('זה מתאים גם לאירוע קטן בבית?', 'כן. יש חבילות לאירועים קטנים, ואנחנו מגיעים עם עמדה קומפקטית.'),
      ('אפשר לשלב לוגו או דמות שהילד אוהב?', 'כן, מעצבים מסגרת אישית עם סמל, צבעים ותחביבים של חתן או כלת המצווה.')]),
    ('brit', 'ברית / בריתה', '👶', 'מגנטים לברית ולבריתה', 'מגנטים לברית ובריתה',
     'מזכרת מרגשת מהיום שבו התינוק או התינוקת מקבלים שם: כל אורח יוצא עם מגנט ובו השם, התאריך ותמונה מהשמחה.',
     ['מסגרת עדינה בצבעי תכלת, ורוד או לבחירתכם', 'צילום בזמן שמתאים לטקס ולסעודה', 'הקמה מהירה ושקטה, גם באולם קטן או בבית כנסת', 'מגנט מיוחד להורים ולסבים'],
     [('כמה זמן לוקח להקים את העמדה?', 'ההקמה קצרה, ואנחנו מגיעים מוקדם כדי שהכול יהיה מוכן לפני שהאורחים מגיעים.'),
      ('אפשר להזמין קרוב לתאריך?', 'ברית נקבעת לפעמים בהתראה קצרה. כתבו לנו, ואם התאריך פנוי נשמח להגיע.')]),
    ('birthday', 'יום הולדת', '🎂', 'מגנטים ליום הולדת', 'מגנטים ליום הולדת עם הדפסה במקום',
     'יום הולדת 30, 40, 70 או של ילדים: האורחים מצטלמים ויוצאים עם מגנט צבעוני ושמח בעיצוב של המסיבה.',
     ['מסגרת צבעונית עם הגיל, השם ומשפט אישי', 'אביזרי צילום שמוסיפים כיף', 'מתאים לגן אירועים, למסעדה או לבית', 'חבילות לפי משך המסיבה ומספר האורחים'],
     [('יש מינימום אורחים?', 'אין חובה. יש חבילות קטנות למסיבות אינטימיות.'),
      ('אפשר לעצב מסגרת לפי נושא המסיבה?', 'כן, לפי צבעים, דמויות או נושא שבחרתם.')]),
    ('henna', 'חינה', '🪔', 'מגנטים לחינה', 'מגנטים לחינה',
     'בגדי החינה, הזהב והצבעים העזים נראים מדהים על מגנט. האורחים מצטלמים בתלבושות ויוצאים עם מזכרת מהערב.',
     ['מסגרת בזהב ובצבעים של החינה', 'צילום של התלבושות והטקס', 'עמדה מעוצבת שמתאימה לאווירה', 'אפשר לשלב עם חבילה לחתונה'],
     [('אפשר להזמין חינה וחתונה יחד?', 'כן, ויש מחיר מיוחד לשני האירועים. כתבו לנו את שני התאריכים.'),
      ('המסגרת מתאימה לחינה מרוקאית, תימנית או אחרת?', 'כן, מעצבים לפי המסורת והצבעים של המשפחה.')]),
    ('company', 'אירוע חברה', '🏢', 'מגנטים לאירועי חברה', 'מגנטים לאירועי חברה וכנסים',
     'כנס, ערב גיבוש או השקה: העובדים והאורחים יוצאים עם מגנט ממותג עם הלוגו שלכם. מזכרת שנשארת על המקרר, וגם פרסום לחברה.',
     ['מסגרת ממותגת עם הלוגו, הצבעים ושם האירוע', 'הדפסה מהירה גם בכנסים גדולים', 'גלריה דיגיטלית לשיתוף ברשתות', 'חשבונית מסודרת ותיאום מול מחלקת הרכש'],
     [('אפשר להכניס לוגו ומיתוג מלא?', 'כן. שולחים קובץ לוגו ואנחנו מעצבים מסגרת לפי שפת המותג שלכם.'),
      ('אתם מגיעים לכנסים ברחבי הארץ?', 'כתבו לנו איפה האירוע ונבדוק.')]),
    ('engagement', 'אירוסין', '💞', 'מגנטים לאירוסין', 'מגנטים למסיבת אירוסין',
     'מסיבת אירוסין היא הפתיחה של כל השמחה: כל אורח יוצא עם מגנט ובו הזוג, השמות והתאריך.',
     ['מסגרת רומנטית עם הלבבות והשמות', 'מתאים לאירוע בבית, בגן או במסעדה', 'חבילות קצרות לאירועים קטנים', 'אפשר להמשיך באותו עיצוב גם לחתונה'],
     [('אפשר להזמין לאירוע קטן?', 'כן, יש חבילות לאירועים אינטימיים.'),
      ('אפשר לשמור על אותו עיצוב לחתונה?', 'בהחלט. שומרים את המסגרת ומתאימים אותה ליום החתונה.')]),
]


def pk_html(event_id):
    pks = [p for p in biz.get('packages', []) if not p.get('hidden') and (not p.get('for') or event_id in p.get('for'))]
    out = []
    for p in pks:
        meta = ' · '.join(E(x) for x in [p.get('hours'), p.get('magnets')] if x)
        out.append('<article class="pk' + (' star' if p.get('featured') else '') + '"><h3>' + E(p.get('name', '')) + '</h3>' +
                   ('<p class="price">' + E(p['price']) + '</p>' if p.get('price') else '') + ('<p class="meta">' + meta + '</p>' if meta else '') +
                   '<ul>' + ''.join('<li>' + E(f) + '</li>' for f in p.get('features', [])) + '</ul></article>')
    return ''.join(out)


def wa_number():
    n = ''.join(c for c in str(biz.get('whatsapp') or biz.get('phone') or '') if c.isdigit())
    return '972' + n[1:] if n.startswith('0') else n


PAGE = '''<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#1d1633" />
<title>{title} · {name}</title>
<meta name="description" content="{desc}" />
<link rel="canonical" href="{url}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="he_IL" />
<meta property="og:title" content="{title} · {name}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{url}" />
<link rel="icon" href="../icon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&family=Frank+Ruhl+Libre:wght@400;500;700;900&display=swap" />
<link rel="stylesheet" href="../css/site.css" />
<script type="application/ld+json">{ld}</script>
</head>
<body class="landing">
<a class="skip" href="#main">דילוג לתוכן</a>
<header class="nav" id="top">
  <a class="logo" href="../" aria-label="לדף הבית"><span class="mark" aria-hidden="true"><i></i></span><span><b>{name}</b><small>מגנטים לאירועים</small></span></a>
  <div class="nav-cta"><a class="btn gold" href="https://wa.me/{wa}?text={wa_text}" target="_blank" rel="noopener">בדיקת תאריך פנוי</a></div>
</header>
<main id="main">
  <section class="sec l-hero">
    <p class="eyebrow">{icon} {ev}</p>
    <h1>{h1}</h1>
    <p class="lead">{intro}</p>
    <div class="cta-row"><a class="btn gold big" href="https://wa.me/{wa}?text={wa_text}" target="_blank" rel="noopener">💬 לבדוק תאריך בוואטסאפ</a><a class="btn line big" href="../#designer">✨ לעצב מגנט לדוגמה</a></div>
  </section>
  <section class="sec cream">
    <h2>מה מקבלים</h2>
    <ul class="l-list">{bullets}</ul>
  </section>
  <section class="sec" id="packages">
    <h2>חבילות ל{ev}</h2>
    <div class="packages" id="pk" data-event="{id}">{pk}</div>
    <p class="note center"><a href="../#packages">לכל החבילות והתוספות</a></p>
  </section>
  <section class="sec cream" id="faq">
    <h2>שאלות על מגנטים ל{ev}</h2>
    <div class="faq">{faq}</div>
  </section>
  <section class="sec l-end">
    <h2>התאריך שלכם עוד פנוי?</h2>
    <p>{owner_line}</p>
    <div class="cta-row"><a class="btn gold big" href="https://wa.me/{wa}?text={wa_text}" target="_blank" rel="noopener">💬 וואטסאפ</a>{tel}<a class="btn line big" href="../">לאתר המלא</a></div>
  </section>
</main>
<footer class="foot">
  <div><b>{name}</b></div>
  <nav>{others}</nav>
  <nav><a href="../accessibility.html">הצהרת נגישות</a><a href="../">דף הבית</a></nav>
</footer>
<script src="../js/landing.js"></script>
</body>
</html>
'''

urls = [BASE, BASE + 'accessibility.html']
(ROOT / 'l').mkdir(exist_ok=True)
for (eid, ev, icon, title, h1, intro, bullets, faq) in EVENTS:
    url = BASE + 'l/' + eid + '.html'
    urls.append(url)
    desc = intro[:155]
    all_faq = faq + [tuple(q) for q in biz.get('faq', [])[:3]]
    ld = [{'@context': 'https://schema.org', '@type': 'Service', 'name': title, 'serviceType': 'מגנטים לאירועים', 'description': intro, 'url': url,
           'provider': {'@type': 'LocalBusiness', 'name': biz.get('name'), 'telephone': biz.get('phone'), 'email': biz.get('email'), 'url': BASE, 'areaServed': biz.get('areas') or 'ישראל'}},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in all_faq]}]
    wa_text = __import__('urllib.parse').parse.quote('שלום! אשמח לבדוק תאריך למגנטים ל' + ev + ' 🧲')
    others = ''.join('<a href="' + o[0] + '.html">' + E(o[3]) + '</a>' for o in EVENTS if o[0] != eid)
    page = PAGE.format(title=E(title), name=E(biz.get('name', '')), desc=E(desc), url=url, ld=json.dumps(ld, ensure_ascii=False).replace('</', '<\\/'),
                       wa=wa_number(), wa_text=wa_text, icon=icon, ev=E(ev), h1=E(h1), intro=E(intro), id=eid,
                       bullets=''.join('<li>' + E(b) + '</li>' for b in bullets), pk=pk_html(eid),
                       faq=''.join('<details' + ('' if i else ' open') + '><summary>' + E(q) + '</summary><p>' + E(a) + '</p></details>' for i, (q, a) in enumerate(all_faq)),
                       owner_line=E('כתבו או התקשרו ל' + (biz.get('owner') or biz.get('name', '')) + (', ' + biz['areas'] if biz.get('areas') else '') + '.'),
                       tel=('<a class="btn line big" href="tel:' + E(biz['phone']) + '">📞 ' + E(biz['phone']) + '</a>') if biz.get('phone') else '', others=others)
    (ROOT / 'l' / (eid + '.html')).write_text(page, encoding='utf-8')

sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>' + u + '</loc></url>\n' for u in urls) + '</urlset>\n'
(ROOT / 'sitemap.xml').write_text(sm, encoding='utf-8')
print('wrote', len(EVENTS), 'event pages and sitemap.xml')
