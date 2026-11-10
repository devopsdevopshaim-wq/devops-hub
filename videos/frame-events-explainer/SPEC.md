GOAL:    the viewer understands, in a minute, what "פריים אירועים" does for a guest (scan, edit inside the event frame, get a magnet,
         keep the app) and for the owner (frames, QR codes, photos with name and phone), and wants the app.
OUTPUT:  HyperFrames, 1080 x 1920 (9:16, WhatsApp / Stories / Reels), 30 fps
TIME:    60.0 s x 30 = 1800 frames. Music: assets/music/bed.m4a (the owner's own bed from earlier promos), 0-48.35 s,
         then a second pass from 6 s for the last 12.4 s; fade-in 0.4 s, fade-out 1.5 s.
LOOK:    the app's own light luxury. Ground #FBF7F0 with one warm radial (#FFF1D6, top right, 0 -> 60%). Ink #2B1B30.
         Accent: champagne gold #B8872E on one word per title and on the tap rings only.
         Display: Frank Ruhl Libre 900, 86 px (4.5% of 1920), line-height 1.08, right-aligned (RTL).
         Body: Heebo 500, 44 px, #6B584D. Step numbers are part of the title ("1. סורקים…"), never a separate label.
         Medium: the real product UI captured from the app (assets/shots, 1170 x 1992) inside a phone: bezel #1B1218, 18 px,
         radius 76 px, screen radius 60 px, shadow 0 50 90 -30 rgba(80,56,30,.55). Real event photos only (assets/img).
OBJECTS: a phone (black bezel, rounded screen) showing the real app; the printed QR sign on the table (ivory card, gold rules);
         the finished magnet = the photo inside the wedding frame "נועה & דניאל" (ivory card, gold lines);
         a computer screen (dark bezel 16 px, radius 26 px) showing Frame Studio's customer photos.
MOTION:  enter power3.out 0.5 s; move power2.inOut; exit power2.in 0.25 s; titles reveal by a clip-path wipe from the right
         (RTL reading direction) in 0.45 s, each line 0.12 s after the previous; phone enters from y +90, rotate 3 deg -> 0;
         screens change by a 0.35 s slide (old up -40 px and out, new from +60 px); taps: a gold ring 0.3 -> 1.5 scale, 0.55 s,
         with a click 1 frame after the ring starts. One slow push (1.00 -> 1.04) per shot on the phone.
SHOTS:   s1 0-4     hook: the finished magnet, tilted -4 deg, already on screen at frame 0 | "התמונה מהאירוע, / מודפסת עם המסגרת שלכם" | whoosh out
         s2 4-9     the QR sign on the table, a scan sweep; the phone rises with the guest page; tap "כניסה" | "1. סורקים את ה-QR"
         s3 9-14.5  tap "מהגלריה"; the editor opens with the photo inside the event frame | "2. בוחרים תמונה / והיא נכנסת ישר למסגרת"
         s4 14.5-19.5 the AI tab; three tool chips pop beside the phone | "3. עורכים כמו שרוצים"
         s5 19.5-24.5 confirm, then "נשלחה להדפסה" | "4. שולחים להדפסה"
         s6 24.5-31 the computer: customer photos grouped by guest; the magnet drops out, printed | "ואצלך במחשב / כל תמונה עם שם, טלפון וסדר"
         s7 31-37   the store, then shop by event | "אחרי האירוע / האפליקציה נשארת בטלפון"
         s8 37-42   product sizes, tap 6x9 | "מזמינים עוד עותקים"
         s9 42-47   the club card, 79 points | "10% חוזרים בנקודות"
         s10 47-55  admin on the phone: event card + QR, the frame upload, QR for every task | "ואתה מנהל הכול מהטלפון"
         s11 55-60  the logo, the app's QR, the address; holds 3 s
BANNED:  a dark void; glow, flares, particles; purple/blue gradients, glass cards; everything centred and fading in at once;
         text moving while it is read; corner brackets, HUD labels; three cards in a row; a title over a dimmed screenshot;
         the logo docked in a corner; the localhost address from the test capture (cropped out).
QA:      0.0 (hook already readable), 6.5 (sign + phone), 12.5 (photo inside the frame), 17 (chips), 23 (sent), 28 (computer),
         34, 40, 45, 50, 53, 58 (end card readable, QR scannable).
