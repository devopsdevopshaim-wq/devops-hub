// The spoken narration: one clip per scene (its title, then its lines), worded for the ear. Writes the script.json that
// .github/workflows/frame-tts.yml speaks (Gemini, a woman's voice; Microsoft "Hila" as the free stand-in).
import fs from 'node:fs';
import { SCENES } from './scenes.mjs';
const W = { '1': 'אחת', '2': 'שתיים', '3': 'שלוש', '4': 'ארבע', '5': 'חמש', '6': 'שש', '7': 'שבע', '8': 'שמונה', '9': 'תשע', '10': 'עשר', '13': 'שלוש עשרה', '15': 'חמש עשרה', '18': 'שמונה עשרה', '20': 'עשרים', '7.5': 'שבע וחצי' };
const num = (n) => W[n] || n;
export function ear(t) {
  return String(t)
    .replace(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/g, (m, a, b) => num(a) + ' על ' + num(b))
    .replace(/\bAI\b/g, 'איי איי').replace(/ה־AI|ה־איי איי/g, 'האיי איי').replace(/\bQR\b/g, 'קיו אר').replace(/\bEnter\b/g, 'אנטר').replace(/\bHome\b/g, 'הום')
    .replace(/1 עד 6/g, 'אחת עד שש').replace(/2 או 3/g, 'שתיים או שלוש').replace(/20 סגנונות/g, 'עשרים סגנונות').replace(/6 לחצנים/g, 'שישה לחצנים')
    .replace(/1, 2, 4, 6 או 9/g, 'אחת, שתיים, ארבע, שש או תשע').replace(/3, 2, 1/g, 'שלוש, שתיים, אחת').replace(/4 מגנטים/g, 'ארבעה מגנטים')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}↩✔⚡]/gu, '').replace(/["״]/g, '').replace(/\s*:\s*/g, ': ').replace(/\s{2,}/g, ' ').trim();
}
export const INTRO = 'ברוכים הבאים לאופטימוס, הסטודיו לעריכה ולהדפסה של מגנטים לאירועים. בסרטון הזה נעבור יחד על כל הלשוניות, עם דוגמאות מהמערכת עצמה.';
export const OUTRO = 'וזהו, אתם מוכנים לאירוע. אם יש שאלה, לחצן העזרה בסטודיו תמיד שם. בהצלחה!';
const end = (s) => /[.!?]$/.test(s) ? s : s + '.';
export const SPOKEN = SCENES.map((s) => [end(ear(s.title)), ...s.lines.map((l) => end(ear(l.t)))]);
if (process.argv[1] && process.argv[1].endsWith('narration.mjs')) {
  const scenes = [{ id: 'intro', he: INTRO }, ...SCENES.map((s, k) => ({ id: 's' + String(k).padStart(2, '0') + '-' + s.id, he: SPOKEN[k].join(' ') })), { id: 'outro', he: OUTRO }];
  const out = { _note: 'The narration of the Optimus guide video (videos/optimus-guide), made by videos/optimus-guide/narration.mjs.', slug: 'optimus-guide-2026-11', langs: ['he'], providers: ['gemini', 'edge'],
    voices: { gemini: { he: 'Sulafat' }, edge: { he: 'he-IL-HilaNeural' } },
    style: { he: 'את קריינית של סרטון הדרכה. קראי בעברית ברורה, חמה ונעימה, בקצב רגוע ומקצועי, עם הגייה מדויקת: ' }, scenes };
  fs.mkdirSync('../promo-src/optimus-guide-v2', { recursive: true });
  fs.writeFileSync('../promo-src/optimus-guide-v2/script.json', JSON.stringify(out, null, 1));
  console.log(scenes.length, 'clips'); scenes.slice(0, 4).forEach((x) => console.log(x.id, '|', x.he));
}
