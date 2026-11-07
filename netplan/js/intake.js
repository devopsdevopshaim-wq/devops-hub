// Reads a free-text building description (Hebrew or English) and turns it into config fields.
// Example: "מלון של 10 קומות עם 30 חדרים בכל קומה, מרתף, 6 מצלמות בקומה, אינטרנט 2 גיגה"

const num = (re, t) => { const m = t.match(re); return m ? Number(m[1]) : null; };

export function parseDescription(text) {
  const t = ` ${String(text || '').replace(/[״"']/g, '').replace(/\s+/g, ' ').toLowerCase()} `;
  const patch = { perRoom: {} };
  const found = [];

  const profiles = [
    [/מלון|hotel|אכסני|צימר/, 'hotel', 'מלון'],
    [/בית חולים|מרפא|קליניק|hospital|clinic/, 'hospital', 'בית חולים / מרפאה'],
    [/בית ספר|בית־ספר|כית|קמפוס אקדמי|מכללה|school|classroom/, 'school', 'מוסד חינוך'],
    [/מגורים|דירות|דירה|מעונות|residential|apartment|dorm/, 'residential', 'מגורים'],
    [/משרד|office|הייטק|חברה/, 'office', 'משרדים'],
  ];
  for (const [re, key, he] of profiles) if (re.test(t)) { patch.profile = key; found.push(`סוג מבנה: ${he}`); break; }

  const buildings = num(/(\d+)\s*(?:מבנים|בניינים|אגפים|buildings)/, t);
  const floors = num(/(\d+)\s*(?:קומות|floors|stories)/, t) ?? num(/קומות\s*:?\s*(\d+)/, t);
  const rooms = num(/(\d+)\s*(?:חדרים|משרדים|כיתות|דירות|rooms|offices)\s*(?:ב?כל|לכל|ב|ל|per|in each)\s*(?:קומה|floor)/, t)
    ?? num(/(?:בכל|לכל)\s*קומה\s*(\d+)/, t);
  const totalRooms = rooms == null ? num(/(\d+)\s*(?:חדרים|משרדים|כיתות|דירות|rooms)/, t) : null;
  let firstFloor = null;
  if (/מרתף|basement/.test(t)) firstFloor = -(num(/(\d+)\s*(?:קומות\s*)?מרתף/, t) || 1);
  else if (/קומת קרקע|קרקע|ground floor/.test(t)) firstFloor = 0;

  if (floors || rooms || totalRooms || buildings) {
    const f = floors || 1;
    const rpf = rooms || (totalRooms ? Math.ceil(totalRooms / f) : 20);
    const n = Math.min(9, buildings || 1);
    patch.buildings = Array.from({ length: n }, (_, i) => ({
      name: n > 1 ? `בניין ${'ABCDEFGHI'[i]}` : 'בניין A',
      code: 'ABCDEFGHI'[i],
      floors: f,
      firstFloor: firstFloor ?? 1,
      roomsPerFloor: rpf,
    }));
    if (floors) found.push(`${floors} קומות`);
    if (rooms) found.push(`${rooms} חדרים בקומה`);
    if (totalRooms) found.push(`${totalRooms} חדרים בסך הכול (≈${rpf} בקומה)`);
    if (buildings) found.push(`${n} מבנים`);
    if (firstFloor != null) found.push(firstFloor < 0 ? `מתחיל במרתף (B${-firstFloor})` : 'מתחיל בקומת קרקע');
  }

  const perIdf = num(/(\d+)\s*חדרים\s*(?:ל|לכל\s*)ארון/, t);
  if (perIdf) { patch.roomsPerIdf = perIdf; found.push(`עד ${perIdf} חדרים לארון`); }

  const data = num(/(\d+)\s*(?:נקודות רשת|נקודות|עמדות|מחשבים|שקעים)\s*(?:ב?כל|לכל|ב)?\s*(?:חדר)/, t);
  if (data != null) { patch.perRoom.data = data; found.push(`${data} נקודות רשת לחדר`); }
  if (/(?:בלי|ללא|אין)\s*טלפו/.test(t)) { patch.perRoom.voice = 0; found.push('ללא טלפונים'); }
  else if (/טלפו|phone|voip/.test(t)) { patch.perRoom.voice = num(/(\d+)\s*טלפונים/, t) ?? 1; found.push(`${patch.perRoom.voice} טלפון לחדר`); }
  if (/(?:בלי|ללא|אין)\s*(?:טלוויז|iptv)/.test(t)) patch.perRoom.iptv = 0;
  else if (/טלוויז|iptv|מסך|מקרן/.test(t)) { patch.perRoom.iptv = 1; found.push('טלוויזיה / מסך בחדר'); }

  const camFloor = num(/(\d+)\s*מצלמות\s*(?:ב?כל|לכל|ב)\s*קומה/, t);
  const camTotal = camFloor == null ? num(/(\d+)\s*מצלמות/, t) : null;
  if (camFloor != null) { patch.camerasPerFloor = camFloor; found.push(`${camFloor} מצלמות בקומה`); }
  else if (camTotal != null) {
    const f = floors || 1;
    patch.camerasPerFloor = Math.ceil(camTotal / f / (buildings || 1));
    found.push(`${camTotal} מצלמות (≈${patch.camerasPerFloor} בקומה)`);
  }
  const prn = num(/(\d+)\s*מדפסות/, t);
  if (prn != null) { patch.printersPerFloor = prn; found.push(`${prn} מדפסות בקומה`); }

  const gig = num(/(\d+(?:\.\d+)?)\s*(?:ג׳יגה|גיגה|gbps|gb|ג'יגה)/, t);
  const meg = num(/(\d+)\s*(?:מגה|mbps|mb)/, t);
  if (gig) { patch.wanMbps = Math.round(gig * 1000); found.push(`אינטרנט ${gig} Gbps`); }
  else if (meg) { patch.wanMbps = meg; found.push(`אינטרנט ${meg} Mbps`); }
  if (/(?:שני|2)\s*ספקי/.test(t)) { patch.isps = 2; found.push('שני ספקי אינטרנט'); }

  if (/wi-?fi\s*7|וויפי\s*7/.test(t)) { patch.wifiGen = 'wifi7'; found.push('Wi-Fi 7'); }
  else if (/wi-?fi\s*6e/.test(t)) { patch.wifiGen = 'wifi6e'; found.push('Wi-Fi 6E'); }
  else if (/wi-?fi\s*6/.test(t)) { patch.wifiGen = 'wifi6'; found.push('Wi-Fi 6'); }

  if (/בידוד|מבודד|רשת לכל חדר|isolat/.test(t)) { patch.addressing = { mode: 'room' }; found.push('רשת מבודדת לכל חדר'); }
  if (/(?:בלי|ללא)\s*(?:שרידות|גיבוי)/.test(t)) { patch.redundancy = false; found.push('ללא שרידות'); }

  if (!Object.keys(patch.perRoom).length) delete patch.perRoom;
  return { patch, found };
}
