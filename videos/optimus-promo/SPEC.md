GOAL:    an event photographer or magnet business owner sees their own wedding night get easy, and searches "פריים מגנטים" / calls.
OUTPUT:  HyperFrames, 1080x1920 (Instagram Reels) and 1080x1080 (LinkedIn feed), 30 fps; Hebrew (RTL) and English. Built by gen.py into out/<ig|li>-<he|en>/.
TIME:    33.0 s x 30 = 990 frames; music: assets/music/site.m4a (steady level), fade-in 0.4 s, fade-out 1.2 s.
LOOK:    ground #14110F (warm graphite), ink #F4EEE2, accent #E3C48A (gold) on one word per title, the logo, the CTA only;
         display Frank Ruhl Libre 700, 92 px vertical / 66 px square, tracking 0; body Heebo 500, 34 px / 26 px;
         medium: real photographs and the program's real screens (captured 2x), shown at 1.6-2x; prints with a 14 px white border,
         shadow 0 24px 48px rgba(0,0,0,.45); the fridge is brushed steel #D9DAD5 -> #BFC1BB.
OBJECTS: a phone (black bezel 28 px, 64 px corner radius, notch) with the program's guests' photos; the Optimus aperture (optimus.svg);
         a photo printer (dark body, light slot); a fridge door with a handle; a magnet print.
MOTION:  enter power3.out 0.5 s; moves power2.inOut 0.6 s; camera expo.inOut 0.8 s; titles wipe in by clip-path along the reading
         direction 0.45 s and then hold still; stagger 3 frames.
SHOTS:   s1 0-3.2 hook: phone with "21:40", three notifications ping in (pop) | title "ערב חתונה. 21:40"
         s2 3.2-6.2 tension: 14 real photos burst from the phone into a pile, counter 1->100 | "100 אורחים מחכים למגנט"
         s3 6.2-9.4 reveal: shutter blades close over the pile (whoosh), open on the aperture logo (bass) | "אופטימוס"
         s4 9.4-13.6 proof 1: the real edit screen, cursor clicks "✨ אוטומטי", the "after" halves brighten (click) | "כל התמונות. תיקון אחד."
         s5 13.6-18.6 proof 2: the real invitation -> the 16 real AI frames build a grid -> the Art Deco one opens in the real editor
         s6 18.6-22.6 proof 3: the real couple -> a gold wipe reveals the real AI red-carpet result | "AI על האורחים האמיתיים"
         s7 22.6-26.0 output: a print slides out of the printer, two more stack (whoosh-short) | "מודפס וממוסגר. במקום."
         s8 26.0-29.0 payoff: the magnet snaps onto a fridge door (pop) | "ונשאר על המקרר"
         s9 29.0-33.0 end card: aperture turns open, OPTIMUS wipes in, CTA + phone, hold 2.2 s
BANNED:  dark void with small floating things; glow/particles/lens flares; three cards in a row; title over a dimmed screenshot;
         fade-and-slide-up on everything; text that moves after it lands; logo docked in a corner; invented UI or numbers.
QA:      0.1 (hook readable, not black), 4.6 (pile + counter), 7.6 (shutter closed), 8.8 (logo), 11.9 (after brighter), 16.0 (grid),
         20.8 (wipe), 24.5 (prints), 27.5 (magnet on fridge), 31.5 (end card).
