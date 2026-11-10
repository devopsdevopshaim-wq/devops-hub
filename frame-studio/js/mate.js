/* The fast workspace (סביבת עבודה מהירה), the way a photo lab works at an event:
   - ראשי: every photo as a tile with its print size, copies (− / +), a check mark and its name; bars for adding photos,
     the print size (fit or crop), copies, and the business details;
   - ערוך תמונה: colour correction (brightness, contrast, exposure, saturation, warmth, red / green / blue, sharpness) on
     big live tiles, plus title, frames, effects and clipart, for the marked photos or all of them;
   - עורך מלא: one photo on a big canvas with a folder browser beside it and the tools underneath (general, objects,
     crop, AI), like a classic desktop photo editor;
   - AI: what runs on this computer at once, smart edits, viral looks and styles (cloud or the local engine);
   - הדפסה: printer, paper, DPI, true size (margins, cut marks) or page size (fit / crop), a page-by-page preview,
     print the current page or all, and saved settings.
   It is a view over the same photos (FS.state) as the studio: "🎨 הסטודיו המלא" opens the photo in the full editor.
   Everything here works offline except the cloud AI. Thumbnails are drawn lazily, a few per frame, from small copies. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state, esc = FS.esc;
  if (!$('#view')) return;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
  function byId(id) { for (var i = 0; i < S.photos.length; i++) if (S.photos[i].id === id) return S.photos[i]; return null; }
  function idx(p) { return S.photos.indexOf(p); }
  function marked() { return FS.marked(); }
  function copies(p) { return p.copies == null ? 1 : p.copies; }
  function trim(v) { return String(Math.round(v * 10) / 10).replace(/\.0$/, ''); }
  function sizeTxt(p) { var mm = FS.mmOf(p.doc); return trim(mm[0] / 10) + 'X' + trim(mm[1] / 10); }

  /* ---------- the shell ---------- */
  var root = document.createElement('div'); root.id = 'mt'; root.hidden = true; root.setAttribute('dir', 'rtl');
  root.innerHTML =
    '<header class="mt-top"><nav class="mt-tabs" aria-label="מסכי העבודה המהירה">' +
      '<button data-v="main" class="on">🗂️ ראשי</button><button data-v="edit">🎚️ ערוך תמונה</button><button data-v="design">🖌️ עורך מלא</button><button data-v="ai">🤖 AI</button><button data-v="print">🖨️ הדפסה</button></nav>' +
      '<div class="mt-qp"><button class="mt-btn primary" id="mt-qprint" title="ישר למדפסת, בלי חלונות (Ctrl+P)">⚡ הדפסה מיידית</button><button class="mt-ic" id="mt-qset" title="הגדרת ההדפסה המיידית">⚙</button></div><div class="mt-swslot"></div>' +
      '<div class="mt-stat" id="mt-stat"></div>' +
      '<div class="mt-acts"><label class="mt-btn">📂 תמונות<input type="file" id="mt-files" multiple hidden accept="image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.rw2,.raw,.pef,.srw,.x3f,.3fr,.erf,.kdc,.mrw,.rwl,.iiq,.heic,.heif"></label>' +
      '<button class="mt-btn" id="mt-folder">📁 תיקייה</button></div></header>' +
    /* main */
    '<section class="mt-view" data-view="main">' +
      '<div class="mt-sub"><button data-bar="size" class="on">📐 גודל</button><button data-bar="files">📁 תמונות</button><button data-bar="copies">🧾 הדפסים</button><button data-bar="biz">🏷️ פרטי העסק</button>' +
        '<span class="mt-sp"></span><button data-go="advise" class="mt-adv-btn" title="כמה עותקים לכל תמונה, לפי האנשים שמסתכלים למצלמה; עיניים עצומות לא יוצאות">🧮 כמה להדפיס?</button><button data-go="edit">🎚️ ערוך תמונה</button><button data-go="design">🖌️ עיצוב</button><button data-go="print" class="mt-pr-btn">🖨️ הדפסה</button></div>' +
      '<div class="mt-bar" data-b="size"><label>גודל:</label><select id="mt-size"></select><button class="mt-ic" id="mt-size-edit" title="ניהול הגדלים">✏️</button>' +
        '<div class="mt-seg" id="mt-fit"><button data-f="contain">להתאים</button><button data-f="cover">לחתוך</button></div>' +
        '<label class="mt-chk-l"><input type="checkbox" id="mt-orient"> לפי כיוון התמונה</label>' +
        '<button class="mt-btn" id="mt-size-sel">החל על המסומנות</button><button class="mt-btn" id="mt-size-all">החל על כולן</button><span class="mt-hint mt-snew" id="mt-snew"></span></div>' +
      '<div class="mt-bar" data-b="files" hidden><button class="mt-btn" id="mt-all">✔ סימון הכל</button><button class="mt-btn" id="mt-none">ניקוי סימון</button><button class="mt-btn" id="mt-inv">היפוך</button>' +
        '<div class="mt-seg mt-ori"><button data-ori="all">הכל <i></i></button><button data-ori="tall">↕ לאורך <i></i></button><button data-ori="wide">↔ לרוחב <i></i></button></div>' +
        '<select id="mt-show"><option value="all">הכל</option><option value="sel">רק המסומנות</option><option value="todo">שלא הודפסו</option><option value="done">שהודפסו</option><option value="edited">שנערכו</option></select>' +
        '<select id="mt-sort"><option value="">הסדר שנכנסו</option><option value="name">לפי שם</option></select><button class="mt-btn danger" id="mt-del">🗑 הסרה מהעבודה</button></div>' +
      '<div class="mt-bar" data-b="copies" hidden><span class="mt-cptip">💡 עכבר על תמונה ומקלידים 0–9 · לחיצה על המספר מקלידה · − / + על תמונה מסומנת משנים את כל המסומנות · 👥 על התמונה: לפי האנשים</span><label>הדפסים למסומנות:</label><button class="mt-ic" data-cpa="-1">−</button><b id="mt-cpn">1</b><button class="mt-ic" data-cpa="1">+</button>' +
        '<button class="mt-btn primary" id="mt-cadv">🧮 המלצה לפי האנשים בתמונה</button><label class="mt-chk-l" title="כל תמונה חדשה מקבלת עותקים לפי המבוגרים שמסתכלים למצלמה; עיניים עצומות = 0"><input type="checkbox" id="mt-cauto"> אוטומטי לכל תמונה חדשה</label><button class="mt-btn" id="mt-cp-set">קביעה</button><button class="mt-btn" id="mt-cp-1">1 לכולן</button><button class="mt-btn" id="mt-cp-0">0 לכולן</button><span class="mt-hint">0 = לא מודפסת</span></div>' +
      '<div class="mt-bar" data-b="biz" hidden><span class="mt-hint" id="mt-biz-txt"></span><button class="mt-btn" id="mt-biz-on">➕ הוספה לתמונות</button><button class="mt-btn" id="mt-biz-off">➖ הסרה מהתמונות</button><button class="mt-btn" id="mt-biz-edit">✏️ עריכת הפרטים</button></div>' +
      '<div class="mt-grid" id="mt-grid"></div>' +
      '<div class="mt-empty" id="mt-empty"><h2>מתחילים</h2><p>בוחרים תמונות או תיקייה שלמה. כל תמונה מקבלת גודל הדפסה ומספר עותקים, ואפשר לערוך, לעצב ולהדפיס.</p>' +
        '<div><label class="mt-btn big">📂 בחירת תמונות<input type="file" id="mt-files2" multiple hidden accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.heic,.heif"></label><button class="mt-btn big" id="mt-folder2">📁 תיקייה</button></div></div>' +
      '<footer class="mt-foot"><span id="mt-foot"></span><label>גודל תצוגה <input type="range" id="mt-zoom" min="120" max="420" step="10"></label></footer>' +
    '</section>' +
    /* edit (colour correction and the rest, on big tiles) */
    '<section class="mt-view" data-view="edit" hidden>' +
      '<aside class="mt-panel"><nav class="mt-ptabs"><button data-pt="color" class="on">תיקון צבע</button><button data-pt="title">כותרת</button><button data-pt="frames">מסגרות</button><button data-pt="fx">אפקטים</button><button data-pt="clip">קליפארט</button><button data-pt="looks">💾 שמורים</button></nav>' +
        '<div class="mt-pp" data-pp="color"><div id="mt-sliders"></div><div class="mt-row"><button class="mt-btn" id="mt-auto">✨ אוטומטי</button><button class="mt-btn" id="mt-reset">↺ איפוס תיקון</button></div></div>' +
        '<div class="mt-pp" data-pp="title" hidden><textarea id="mt-tt" rows="2" placeholder="למשל: נועה ומשה · 4.12.25"></textarea>' +
          '<div class="mt-row"><select id="mt-tfont"></select><input type="color" id="mt-tcol" value="#ffffff"></div>' +
          '<label class="mt-l">גודל <input type="range" id="mt-tsize" min="2" max="14" step="0.5" value="6"></label>' +
          '<div class="mt-seg" id="mt-tpos"><button data-p="top">למעלה</button><button data-p="mid">באמצע</button><button data-p="bottom" class="on">למטה</button></div>' +
          '<label class="mt-chk-l"><input type="checkbox" id="mt-tsh" checked> צל לקריאות</label>' +
          '<div class="mt-row"><button class="mt-btn primary" id="mt-tadd">➕ הוספת כותרת</button><button class="mt-btn" id="mt-tdel">🗑 הסרה</button></div></div>' +
        '<div class="mt-pp" data-pp="frames" hidden><button class="mt-btn primary mt-fmgo" data-fm-open>🖌️ עורך מסגרות מקצועי · דוגמאות מההזמנה</button><div class="mt-row"><label>צבע</label><input type="color" id="mt-fcol" value="#ffffff"></div><div class="mt-row"><label class="mt-btn">➕ מסגרות משלי (כמה ביחד)<input type="file" id="mt-fpng" accept="image/*" multiple hidden></label><label class="mt-btn">📁 תיקיית מסגרות<input type="file" id="mt-fdir" webkitdirectory multiple hidden></label></div>' +
          '<div class="mt-fori"><h4>מסגרת לפי כיוון</h4><div class="mt-row"><label>↕ לאורך <i data-oc="tall"></i></label><select id="mt-ftall"></select><button class="mt-btn" data-fori="tall">החל</button></div>' +
          '<div class="mt-row"><label>↔ לרוחב <i data-oc="wide"></i></label><select id="mt-fwide"></select><button class="mt-btn" data-fori="wide">החל</button></div><p class="mt-hint">כל מסגרת עולה רק על התמונות בכיוון שלה. מסגרת PNG לאורך לא תהפוך תמונה לרוחב.</p></div>' +
          '<p class="mt-hint">PNG עם חלון שקוף הכי טוב. מסגרת אחת חדשה מולבשת מיד על התמונות שבמסך.</p><div class="mt-chips mt-frl" id="mt-frames"></div></div>' +
        '<div class="mt-pp" data-pp="fx" hidden><div class="mt-chips small" id="mt-fxcat"></div><div class="mt-fx" id="mt-fx"></div><h4>סגנון</h4><div class="mt-chips" id="mt-styles"></div></div>' +
        '<div class="mt-pp" data-pp="clip" hidden><div class="mt-emo" id="mt-emo"></div><label class="mt-btn">🖼️ לוגו / תמונה<input type="file" id="mt-logo" accept="image/*" hidden></label><button class="mt-btn" id="mt-clipdel">🗑 הסרת הקליפארט</button></div>' +
        '<div class="mt-pp" data-pp="looks" hidden><h4>העתקת עריכה</h4><div class="mt-row"><button class="mt-btn" id="mt-lcopy" title="Ctrl+Shift+C">📋 העתקת העריכה</button><button class="mt-btn" id="mt-lpaste" title="Ctrl+Shift+V">📥 הדבקה</button></div>' +
          '<div class="mt-row"><button class="mt-btn" id="mt-lprev">⤺ כמו התמונה הקודמת</button></div><p class="mt-hint" id="mt-lclip"></p>' +
          '<h4>מצבי עריכה שמורים</h4><p class="mt-hint">שומרים את התיקון, האפקט, הסגנון, הרקע, המסגרת, הכותרת והקליפארט, ומחילים בלחיצה גם בפעמים הבאות.</p>' +
          '<div class="mt-row"><input id="mt-lname" placeholder="שם, למשל: חתונה חמימה"><button class="mt-btn primary" id="mt-lsave">💾 שמירה</button></div><div class="mt-looks" id="mt-looks"></div></div>' +
        '<div class="mt-pfoot"><p class="mt-hint" id="mt-target"></p><button class="mt-btn" id="mt-apply-all">החל את התיקון על כל התמונות</button></div>' +
      '</aside><div class="mt-ework"><div class="mt-ebar"><label>תמונות במסך:</label><div class="mt-seg" id="mt-en"><button data-n="1">1</button><button data-n="2">2</button><button data-n="4">4</button><button data-n="6">6</button><button data-n="9">9</button></div>' +
        '<div class="mt-seg mt-ori"><button data-ori="all">הכל <i></i></button><button data-ori="tall">↕ לאורך <i></i></button><button data-ori="wide">↔ לרוחב <i></i></button></div>' +
        '<label class="mt-chk-l" title="כל שינוי חל על כל התמונות שבמסך (כשאין תמונות מסומנות ✓)"><input type="checkbox" id="mt-etog"> 🔗 כל המסך יחד</label><button class="mt-btn mt-cmpb" id="mt-cmp" title="התמונה המקורית ליד העריכה">◧ לפני|אחרי</button><span class="mt-sp"></span>' +
        '<span class="mt-sel"><b id="mt-selc"></b><button class="mt-btn" id="mt-selp" title="מסמן את כל התמונות שבמסך">✓ המסך</button><button class="mt-btn" id="mt-sela" title="Ctrl+A">✓ הכל</button><button class="mt-btn" id="mt-seln" title="Esc">✕ ניקוי</button><button class="mt-btn" id="mt-eall" title="נכנסתם לעריכה עם התמונות המסומנות בלבד" hidden>📚 כל התמונות</button></span>' +
        '<span class="mt-sp"></span>' +
        '<button class="mt-ic" id="mt-eprev" title="הקודמות (PageUp)">▶</button><b id="mt-epg">1 / 1</b><button class="mt-ic" id="mt-enext" title="הבאות (PageDown)">◀</button></div>' +
        '<div class="mt-estage"><div class="mt-egrid" id="mt-egrid"></div><button class="mt-nav prev" id="mt-enavp" title="הקודמות (→)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="mt-nav next" id="mt-enavn" title="הבאות (←)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
        '<div class="mt-strip" id="mt-estrip"></div></div>' +
    '</section>' +
    /* the full editor */
    '<section class="mt-view" data-view="design" hidden>' +
      '<aside class="mt-browser"><div class="mt-row"><button class="mt-btn" id="mt-dir">📁 פתיחת תיקייה</button></div><div class="mt-tree" id="mt-tree"></div><div class="mt-files" id="mt-flist"></div><h4>בעבודה</h4><div class="mt-proj" id="mt-proj"></div></aside>' +
      '<div class="mt-dz"><div class="mt-cvw" id="mt-cvw"><figure class="mt-cv0" id="mt-cv0f"><canvas id="mt-cv0"></canvas><figcaption>לפני</figcaption></figure><figure class="mt-cv1"><canvas id="mt-cv"></canvas><figcaption>אחרי</figcaption></figure><button class="mt-nav prev" id="mt-dnavp" title="הקודמת (→)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="mt-nav next" id="mt-dnavn" title="הבאה (←)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
        '<div class="mt-dinfo"><span id="mt-dname"></span><span id="mt-dsize"></span><span class="mt-sp"></span><button class="mt-btn mt-cmpb" id="mt-dcmp" title="התמונה המקורית ליד העריכה">◧ לפני | אחרי</button><button class="mt-ic" id="mt-prev" title="הקודמת">▶</button><button class="mt-ic" id="mt-next" title="הבאה">◀</button></div>' +
        '<div class="mt-dtools"><nav class="mt-ptabs"><button data-dt="gen" class="on">כללי</button><button data-dt="obj">עצמים</button><button data-dt="crop">חיתוך</button><button data-dt="ai">כלים AI</button></nav>' +
          '<div class="mt-dp" data-dp="gen"><div class="mt-dgrid">' +
            '<select id="mt-dframe" title="מסגרת"></select><button class="mt-btn" data-d="auto">רמה אוטומטית</button><button class="mt-btn" data-d="sharp">חידוד</button><button class="mt-btn" data-d="clear">הברקה</button>' +
            '<button class="mt-btn" data-d="back">תאורה אחורית</button><select id="mt-dfilm" title="אפקט פילם"></select><select id="mt-dpre" title="מסננים"></select><select id="mt-dsz" title="שינוי גודל"></select>' +
            '<button class="mt-ic" data-d="lock" id="mt-dlock" title="נעילת התמונה במקומה">🔒</button><button class="mt-ic" data-d="keep" id="mt-dkeep" title="התמונה לא יוצאת מגבולות הדף">📐</button><button class="mt-ic" data-d="rl" title="סיבוב שמאלה">⟲</button><button class="mt-ic" data-d="rr" title="סיבוב ימינה">⟳</button><button class="mt-ic" data-d="fh" title="היפוך">⇋</button><button class="mt-ic" data-d="fv" title="היפוך אנכי">⇵</button></div>' +
            '<div class="mt-dsl" id="mt-dsl"></div></div>' +
          '<div class="mt-dp" data-dp="obj" hidden><div class="mt-row"><input id="mt-otext" placeholder="טקסט להוספה"><select id="mt-ofont"></select><input type="color" id="mt-ocol" value="#ffffff"><button class="mt-btn" id="mt-oadd">➕ טקסט</button></div>' +
            '<div class="mt-emo" id="mt-oemo"></div><div class="mt-row"><label class="mt-btn">🖼️ לוגו / תמונה<input type="file" id="mt-ologo" accept="image/*" hidden></label><button class="mt-btn" id="mt-odel">🗑 מחיקת העצם המסומן</button><span class="mt-hint">גוררים עצם על התמונה כדי להזיז, גלגלת משנה גודל</span></div></div>' +
          '<div class="mt-dp" data-dp="crop" hidden><div class="mt-chips" id="mt-crops"></div><div class="mt-row"><div class="mt-seg" id="mt-cfit"><button data-f="contain">להתאים</button><button data-f="cover" class="on">לחתוך</button></div><button class="mt-btn" id="mt-cface">🎯 מרכוז לפי הפנים</button><span class="mt-hint">גוררים את התמונה כדי לבחור מה נכנס, גלגלת לזום</span></div></div>' +
          '<div class="mt-dp" data-dp="ai" hidden><div class="mt-chips" id="mt-dai"></div></div>' +
          '<div class="mt-dacts"><button class="mt-btn" id="mt-dsave">💾 שמירה</button><button class="mt-btn" id="mt-dprint">🖨️ הדפסה</button><button class="mt-btn" id="mt-dundo">↶ ביטול</button><button class="mt-btn" id="mt-dredo">↷ חזרה</button><button class="mt-btn" id="mt-dall">↺ ביטול הכל</button><button class="mt-btn" id="mt-dcopy" title="Ctrl+Shift+C">📋 העתקת העריכה</button><button class="mt-btn" id="mt-dpaste" title="Ctrl+Shift+V">📥 הדבקה</button></div>' +
        '</div></div>' +
    '</section>' +
    /* AI */
    '<section class="mt-view" data-view="ai" hidden><div class="mt-ai">' +
      '<p class="mt-hint" id="mt-ai-target"></p>' +
      '<div class="mt-card mt-aibac"><h3>◧ לפני | אחרי <small>התמונות שה־AI עובד עליהן: המקור מימין, התוצאה משמאל · לחיצה מגדילה</small></h3><div class="mt-aiba" id="mt-aiba"></div><p class="mt-hint" id="mt-aiba-more"></p></div>' +
      '<div class="mt-card cr-card-box" id="mt-crafts"></div>' +
      '<div class="mt-card"><h3>🖥️ מיד, על המחשב · עובד גם בלי אינטרנט</h3><div class="mt-chips" id="mt-ai-local"></div></div>' +
      '<div class="mt-card mt-func"><h3>😜 אפקטים מצחיקים <small>על הצילום האמיתי, לכל פרצוף בתמונה · על המחשב, בלי אינטרנט</small></h3><div class="mt-chips" id="mt-ai-fun"></div></div>' +
      '<div class="mt-card"><h3>⚙️ מנוע ה־AI</h3><div class="mt-chips" id="mt-ai-eng"></div><label class="mt-chk-l" style="margin-top:8px"><input type="checkbox" id="mt-keep"> 🙂 שמירת הפנים המקוריות (בלי עיוות) בעיצובים על אדם אמיתי</label><label class="mt-chk-l"><input type="checkbox" id="mt-one"> 👤 רק על אדם אחד: בתמונה עם כמה אנשים בוחרים את מי לעצב, והשאר נשארים כמו בצילום</label><label class="mt-chk-l"><input type="checkbox" id="mt-only"> 🎯 רק על הדמות: הרקע והמקום נשארים מהצילום המקורי, ה־AI משנה רק את האדם</label></div>' +
      '<div class="mt-card"><h3>🦸 גיבורי על <small>על האנשים האמיתיים, כמו סצנה מסרט</small></h3><div class="mt-ai-g" id="mt-ai-heroes"></div></div>' +
      '<div class="mt-card"><h3>🧑 על אדם אמיתי <small>נשאר צילום אמיתי של אותם אנשים, משתנים הלבוש והמקום</small></h3><div class="mt-ai-g" id="mt-ai-real"></div></div>' +
      '<div class="mt-card"><h3>🪄 עריכות חכמות <small>התמונה נשארת, משתנה דבר אחד</small></h3><div class="mt-ai-g" id="mt-ai-edits"></div></div>' +
      '<div class="mt-card"><h3>🔥 טרנדים ויראליים</h3><div class="mt-ai-g" id="mt-ai-viral"></div></div>' +
      '<div class="mt-card mt-wowc"><h3>✨ אפקטים מהממים <small>עובד גם בלי אינטרנט, במנוע המקומי</small></h3><div class="mt-ai-g" id="mt-ai-wow"></div></div>' +
      '<div class="mt-card"><h3>🎨 סגנונות</h3><div class="mt-ai-g" id="mt-ai-styles"></div></div>' +
      '<div class="mt-card"><h3>✍️ לתאר במילים</h3><div class="mt-row"><input id="mt-ai-text" placeholder="למשל: להלביש את כולם בתחפושות פיראטים על ספינה"><button class="mt-btn primary" id="mt-ai-go">✨ לעשות</button></div>' +
        '<div class="mt-row"><button class="mt-btn" id="mt-ai-back">↶ ביטול ה־AI האחרון</button><button class="mt-btn" id="mt-ai-orig">↩ החזרת המקור</button></div></div>' +
    '</div></section>';
  document.body.appendChild(root);
  root.insertAdjacentHTML('beforeend', '<button type="button" class="mt-fab" id="mt-fab" hidden><span>🖨️ להדפסה</span><b id="mt-fab-n"></b></button>');
  root.querySelector('#mt-fab').addEventListener('click', function () { qpRun(); });

  /* line icons instead of emoji on the workspace's own buttons (24px grid, stroke 1.8, like the studio's tool rail) */
  var ICON = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    brush: '<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z"/>',
    spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M21 5h-4"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.1-3.1a2 2 0 00-2.8 0L6 21"/>',
    folder: '<path d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.9a2 2 0 01-1.7-.9l-.8-1.2A2 2 0 007.9 3H4a2 2 0 00-2 2v13c0 1.1.9 2 2 2z"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.41 2.41 0 010-3.4l2.6-2.6a2.41 2.41 0 013.4 0z"/><path d="M14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
    copies: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0011.2 2H4a2 2 0 00-2 2v7.2a2 2 0 00.6 1.4l8.7 8.7a2.4 2.4 0 003.4 0l6.6-6.6a2.4 2.4 0 000-3.4z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    pencil: '<path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'
  };
  var EMOJI = { '🗂️': 'grid', '🎚️': 'sliders', '🖌️': 'brush', '🤖': 'spark', '🖨️': 'print', '📂': 'image', '📁': 'folder', '📐': 'ruler', '🧾': 'copies', '🏷️': 'tag', '✏️': 'pencil', '🗑': 'trash' };
  function svg(n) { return '<svg class="mt-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; }
  $$('.mt-tabs button, .mt-sub button, .mt-acts .mt-btn, .mt-empty .mt-btn, #mt-size-edit, #mt-del', root).forEach(function (b) {
    var t = b.firstChild; if (!t || t.nodeType !== 3) return;
    var m = /^\s*(\S+?)\s+/.exec(t.nodeValue); if (!m || !EMOJI[m[1]]) { if (b.id === 'mt-size-edit') b.innerHTML = svg('pencil'); return; }
    t.nodeValue = t.nodeValue.slice(m[0].length); b.insertAdjacentHTML('afterbegin', svg(EMOJI[m[1]]));
  });
  /* a mark of the program (no name) at the start of the top bar, and the drop zone's icon */
  $('.mt-top', root).insertAdjacentHTML('afterbegin', '<div class="mt-mark" title="אופטימוס"><img src="optimus.svg" alt="אופטימוס"></div>');
  $('.mt-empty', root).insertAdjacentHTML('afterbegin', '<div class="mt-drop-ic">' + svg('upload') + '</div>');
  $('.mt-empty p', root).insertAdjacentHTML('afterend', '<small class="mt-drop-hint">או גוררים לכאן תמונות מהמחשב · JPG · PNG · HEIC · RAW</small>');

  var view = 'main', bar = ls('fs-mate-bar') || 'size', focusId = null;
  function on() { return !root.hidden; }
  function show(v) {
    if (v === 'print') { openPrint(); return; }
    if (v === 'edit' && view !== 'edit') eSet = null;   /* entering the edit screen: its photos are decided now (below) */
    view = v || view;
    $$('.mt-tabs [data-v]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.v === view); });
    $$('.mt-view', root).forEach(function (s) { s.hidden = s.dataset.view !== view; });
    if (view === 'main') buildGrid(); else if (view === 'edit') buildEdit(); else if (view === 'design') buildDesign(); else if (view === 'ai') buildAI();
    stat(); FS.emit('mate-view', view);
  }
  function open(v) {
    root.hidden = false; document.body.classList.add('mt-on'); ls('fs-mate', 'on'); if (typeof sw === 'function') sw();
    if (FS.gridMode && FS.gridMode() && FS.showGrid) { /* the studio's own photos screen stays behind */ }
    show(v || view);
  }
  function close() {
    root.hidden = true; document.body.classList.remove('mt-on'); ls('fs-mate', 'off'); sw();
    var p = focus();
    requestAnimationFrame(function () {
      if (p && idx(p) !== S.cur) FS.select(idx(p)); else if (FS.render) FS.render();
      FS.emit('doc'); if (FS.refreshStrip) FS.refreshStrip();
    });
  }
  function toggle() { if (on()) close(); else open(); }
  /* the switch between the two, always in the same place (and F2) */
  var swEl = document.createElement('div'); swEl.id = 'mt-switch'; swEl.setAttribute('dir', 'rtl');
  swEl.innerHTML = '<button data-sw="mt" title="סביבת עבודה מהירה (F2)">⚡ עבודה מהירה</button><button data-sw="studio" title="סטודיו עיצוב מלא (F2)">🎨 סטודיו עיצוב</button>';
  document.body.appendChild(swEl);
  /* in the quick workspace the switch sits inside its top bar (so it never covers the instant print); in the studio it floats */
  function sw() { var slot = $('.mt-swslot', root), want = on() && slot ? slot : document.body; if (swEl.parentNode !== want) want.appendChild(swEl); $$('#mt-switch [data-sw]').forEach(function (b) { b.classList.toggle('on', (b.dataset.sw === 'mt') === on()); }); }
  swEl.addEventListener('click', function (e) { var b = e.target.closest('[data-sw]'); if (!b) return; if (b.dataset.sw === 'mt') { if (!on()) open(); } else if (on()) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'F2' && !document.body.classList.contains('gated')) { e.preventDefault(); toggle(); } });
  FS.mate = { open: open, close: function () { close(); }, toggle: function () { toggle(); }, isOn: on, print: function () { openPrint(); },
    show: function (v) { if (!on()) open(v); else show(v); }, view: function () { return view; }, root: root };
  /* the full editor: the editing tools in a panel on the right, the photos in a strip along the bottom, the photo big in between */
  (function () {
    var dv = $('[data-view="design"]', root), br = dv && $('.mt-browser', dv), dz = dv && $('.mt-dz', dv), tools = dv && $('.mt-dtools', dv);
    if (!dv || !br || !dz || !tools) return;
    var side = document.createElement('aside'); side.className = 'mt-dside'; side.appendChild(tools);
    dv.insertBefore(side, dv.firstChild);
    br.classList.add('mt-bstrip'); dz.appendChild(br);
  })();
  $$('.mt-tabs [data-v]', root).forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.v); }); });
  $$('[data-go]', root).forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.go === 'advise') advise(); else show(b.dataset.go); }); });


  /* photos in */
  function addFiles(fl) { if (fl && fl.length) FS.addFiles(fl); }
  ['#mt-files', '#mt-files2'].forEach(function (s) { $(s, root).addEventListener('change', function () { addFiles(this.files); this.value = ''; }); });
  function pickFolder() {
    if (!window.showDirectoryPicker) {
      var i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.webkitdirectory = true;
      i.addEventListener('change', function () { addFiles(i.files); }); i.click(); return;
    }
    window.showDirectoryPicker({ id: 'frame-studio-photos' }).then(function (dir) { return filesOf(dir, true); }).then(addFiles).catch(function () {});
  }
  var IMG_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;
  function isImg(n) { return IMG_RE.test(n) || FS.RAW_EXT.test(n); }
  function filesOf(dir, deep) {
    var out = [];
    function walk(d, depth) {
      var it = d.values(), all = [];
      function step() { return it.next().then(function (r) { if (r.done) return; all.push(r.value); return step(); }); }
      return step().then(function () {
        return all.reduce(function (ch, h) {
          return ch.then(function () {
            if (h.kind === 'file' && isImg(h.name)) return h.getFile().then(function (f) { out.push(f); });
            if (h.kind === 'directory' && deep && depth < 2) return walk(h, depth + 1);
          });
        }, Promise.resolve());
      });
    }
    return walk(dir, 0).then(function () { out.sort(function (a, b) { return a.name.localeCompare(b.name, 'he', { numeric: true }); }); return out; });
  }
  $('#mt-folder', root).addEventListener('click', pickFolder);
  $('#mt-folder2', root).addEventListener('click', pickFolder);

  /* ---------- thumbnails: a page drawn small, with its own small cache, a few per frame ---------- */
  var DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  function pageCanvas(p, size, fast) {
    var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k * DPR, d.h * k * DPR);
    var proxy = { src: p.src, doc: d, cache: p._mc || {}, mask: p.mask, maskV: p.maskV };
    FS.draw(c.getContext('2d'), proxy, { scale: k * DPR, max: Math.round(size * 1.5 * DPR), fast: fast !== false, export: true });
    c.style.width = Math.round(d.w * k) + 'px'; c.style.height = Math.round(d.h * k) + 'px';
    p._mc = proxy.cache; return c;
  }
  /* "before": the photo as it came in (before AI and every edit), whole, in a box of the page's shape */
  function origCanvas(p, size) {
    var im = FS.img(p.origSrc || p.src), d = p.doc, k = size / Math.max(d.w, d.h) * DPR, c = FS.canvas(d.w * k, d.h * k), x = c.getContext('2d');
    c.style.width = Math.round(d.w * k / DPR) + 'px'; c.style.height = Math.round(d.h * k / DPR) + 'px';
    x.fillStyle = '#0c0d10'; x.fillRect(0, 0, c.width, c.height); if (!im) return c;
    var s = Math.min(c.width / im.naturalWidth, c.height / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    x.imageSmoothingQuality = 'high'; x.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h); return c;
  }
  var cmp = ls('fs-mate-cmp2') === '1';
  function sig(p, size) { return size + '|' + p.src + '|' + JSON.stringify(p.doc); }
  var queue = [], qOn = false;
  function enqueue(el) { if (queue.indexOf(el) < 0) queue.push(el); if (!qOn) { qOn = true; requestAnimationFrame(pump); } }
  function pump() {
    var t0 = performance.now();
    while (queue.length && performance.now() - t0 < 14) drawTile(queue.shift());
    if (queue.length) requestAnimationFrame(pump); else qOn = false;
  }
  function drawTile(el) {
    var p = byId(el.dataset.id), box = el.querySelector('.mt-th'); if (!p || !box || !el.isConnected) return;
    if (!FS.img(p.src)) { FS.loadImg(p.src).then(function () { enqueue(el); }, function () {}); return; }
    if (p.origSrc && !FS.img(p.origSrc)) { FS.loadImg(p.origSrc).then(function () { enqueue(el); }, function () {}); }
    var size = Number(el.dataset.px) || 220, s = sig(p, size); if (el._sig === s) return;
    var ba = box.querySelector('.mt-ba');
    if (ba) {   /* before | after, side by side */
      var half = Math.round(size * 0.62), bs = (p.origSrc || p.src) + '|' + half + '|' + p.doc.w + 'x' + p.doc.h;
      var A = $('.mt-a', ba), B = $('.mt-b', ba), ca = pageCanvas(p, half), oa = A.querySelector('canvas'); if (oa) A.replaceChild(ca, oa); else A.insertBefore(ca, A.firstChild);
      if (B._s !== bs) { var cb = origCanvas(p, half), ob = B.querySelector('canvas'); if (ob) B.replaceChild(cb, ob); else B.insertBefore(cb, B.firstChild); B._s = bs; }
    } else { var c = pageCanvas(p, size), old = box.querySelector('canvas'); if (old) box.replaceChild(c, old); else box.insertBefore(c, box.firstChild); }
    el._sig = s;
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) enqueue(e.target); }); }, { rootMargin: '300px' }) : null;
  function watch(el) { if (io) io.observe(el); else enqueue(el); }

  /* ---------- ראשי ---------- */
  var zoom = Number(ls('fs-mate-zoom')) || 190, lastClick = -1;
  $('#mt-zoom', root).value = zoom;
  $('#mt-zoom', root).addEventListener('input', function () { zoom = Number(this.value); ls('fs-mate-zoom', zoom); root.style.setProperty('--mt-tile', zoom + 'px'); buildGrid(); });
  root.style.setProperty('--mt-tile', zoom + 'px');
  /* tall and wide photos in their own sections: a filter shows one side, "all" shows tall first, then wide */
  var ori = ls('fs-mate-ori') || 'all', ORI_ORDER = { tall: 0, wide: 1, sq: 2 }, ORI_NAME = { tall: '↕ לאורך', wide: '↔ לרוחב', sq: '◻ ריבוע' };
  function oriOf(p) { var d = p.doc; return d.w > d.h * 1.02 ? 'wide' : d.h > d.w * 1.02 ? 'tall' : 'sq'; }
  function byOri(l) {
    if (ori !== 'all') return l.filter(function (p) { return oriOf(p) === ori; });
    return l.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return ORI_ORDER[oriOf(a[0])] - ORI_ORDER[oriOf(b[0])] || a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  function oriSync() {
    var n = { all: S.photos.length, tall: 0, wide: 0, sq: 0 }; S.photos.forEach(function (p) { n[oriOf(p)]++; });
    $$('.mt-ori button', root).forEach(function (b) { b.classList.toggle('on', b.dataset.ori === ori); $('i', b).textContent = '(' + n[b.dataset.ori] + ')'; });
    $$('[data-oc]', root).forEach(function (x) { x.textContent = '(' + n[x.dataset.oc] + ')'; });
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('.mt-ori [data-ori]'); if (!b) return;
    ori = b.dataset.ori; ls('fs-mate-ori', ori); ePage = 0; oriSync();
    if (view === 'edit') { $('#mt-egrid', root).innerHTML = ''; buildEdit(); } else buildGrid();
  });
  function shown() {
    var f = $('#mt-show', root).value, l = S.photos.slice();
    if (f === 'sel') l = l.filter(function (p) { return S.marked[p.id]; });
    else if (f === 'todo') l = l.filter(function (p) { return !p.printed; });
    else if (f === 'done') l = l.filter(function (p) { return p.printed; });
    else if (f === 'edited') l = l.filter(function (p) { return FS.isEdited ? FS.isEdited(p) : true; });
    if ($('#mt-sort', root).value === 'name') l.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he', { numeric: true }); });
    return byOri(l);
  }
  /* what the copies advice (copies.js) found on this photo */
  function advTag(p) {
    var a = p.cadv; if (!a || a.verdict === 'error') return '';
    if (a.verdict === 'closed') return '<em class="mt-adv bad" title="מישהו עוצם עיניים: לא להדפיס">😑 עיניים עצומות</em>';
    if (a.verdict === 'none') return '';
    return '<em class="mt-adv' + (a.doubt ? ' doubt' : '') + '" data-advset="' + a.copies + '" role="button" tabindex="0" title="לחיצה: ' + a.copies + ' הדפסים לפי האנשים · ' + a.adults + ' מבוגרים מסתכלים' + (a.kids ? ', ' + a.kids + ' ילדים' : '') + (a.doubt ? '. כדאי לבדוק: אולי מישהו בחצי עצימה' : '') + '">' + (a.doubt ? '👀 ' : '👥 ') + a.copies + '</em>';
  }
  function tileHTML(p, px) {
    return '<div class="mt-tile' + (S.marked[p.id] ? ' sel' : '') + (p.id === focusId ? ' focus' : '') + '" data-id="' + p.id + '" data-px="' + px + '"><div class="mt-th">' +
      '<button class="mt-chk" title="סימון">✓</button><button class="mt-zoomb" title="הגדלה">🔍</button>' +
      '<div class="mt-band"><b>' + sizeTxt(p) + '</b><span class="mt-cp"><button data-cp="-1" title="פחות (על כל המסומנות, כשהתמונה מסומנת)" aria-label="פחות הדפסים">−</button><i data-cpn title="לחיצה: להקליד מספר · או מקלידים 0–9 כשהעכבר על התמונה">' + copies(p) + ' הדפסים</i><button data-cp="1" title="עוד (על כל המסומנות, כשהתמונה מסומנת)" aria-label="עוד הדפסים">+</button></span>' +
      (p.printed ? '<small>הודפסו ' + p.printed + '</small>' : '') + '</div>' + advTag(p) + '</div><div class="mt-name" title="' + esc(p.name || '') + '">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '</div></div>';
  }
  /* a rebuilt grid keeps the canvases already drawn (by photo and size); drawTile then redraws only photos that changed */
  /* the drawn part of a tile: its before|after pair, or its one canvas; it goes back only into a tile of the same kind
     (a plain canvas put into a before|after tile left the pair undrawn: black boxes) */
  function drawn(el) {
    var box = el.querySelector('.mt-th'), ba = box && box.querySelector('.mt-ba'), c = box && box.querySelector(':scope > canvas');
    return ba ? (ba.querySelector('.mt-a canvas') ? { ba: ba } : null) : c ? { c: c } : null;
  }
  function put(el, o, sig) {
    var box = el.querySelector('.mt-th'), ba = box.querySelector('.mt-ba');
    if (o.ba && ba) box.replaceChild(o.ba, ba); else if (o.c && !ba) box.insertBefore(o.c, box.firstChild); else return;
    el._sig = sig;
  }
  function keepCanvases(g) { var k = {}; $$('.mt-tile', g).forEach(function (el) { var o = el._sig && drawn(el); if (o) { o.sig = el._sig; k[el.dataset.id + '|' + el.dataset.px] = o; } }); return k; }
  function reuse(g, k) { $$('.mt-tile', g).forEach(function (el) { var o = k[el.dataset.id + '|' + el.dataset.px]; if (o) put(el, o, o.sig); watch(el); }); }
  function buildGrid() {
    var g = $('#mt-grid', root), l = shown(), k = keepCanvases(g);
    $('#mt-empty', root).hidden = !!S.photos.length; g.hidden = !S.photos.length;
    var last = null, cnt = {}; l.forEach(function (p) { var o = oriOf(p); cnt[o] = (cnt[o] || 0) + 1; });
    g.innerHTML = l.map(function (p) { var o = oriOf(p), h = ''; if (o !== last) { last = o; h = '<h3 class="mt-orih" data-orih="' + o + '">' + ORI_NAME[o] + ' <i>' + cnt[o] + ' תמונות</i><button class="mt-btn" data-orisel="' + o + '">✔ סימון כולן</button></h3>'; } return h + tileHTML(p, zoom); }).join('');
    reuse(g, k);
    oriSync(); foot(); stat();
  }
  function refreshTile(p) {
    $$('.mt-tile[data-id="' + p.id + '"]', root).forEach(function (el) {
      if (el.classList.contains('mt-pj') || el.closest('#mt-aiba')) { el._sig = null; enqueue(el); return; }
      var big = el.closest('#mt-egrid'), n = document.createElement('div');
      n.innerHTML = big ? eTileHTML(p) : tileHTML(p, Number(el.dataset.px) || zoom);
      var ne = n.firstChild, o = el._sig && drawn(el);
      if (o) put(ne, o, el._sig);
      el.parentNode.replaceChild(ne, el); watch(ne);
    });
  }
  function refreshAll() { if (!on()) return; if (view === 'main') buildGrid(); else if (view === 'edit') buildEdit(); else if (view === 'design') drawDesign(); else if (view === 'ai') { aiTarget(); aiBA(); } stat(); }
  function mark(p, v) { if (v) S.marked[p.id] = true; else delete S.marked[p.id]; }
  /* copies made quick: a marked photo speaks for all the marked ones; the number is typed in place; 0–9 on the keyboard */
  function group(p) { var m = marked(); return S.marked[p.id] && m.length > 1 ? m : [p]; }
  function setCopies(list, f) {
    list.forEach(function (q) { q.copies = FS.clamp(Math.round(Number(f(q)) || 0), 0, 999); refreshTile(q); });
    foot(); stat(); FS.emit('doc');
    if (list.length > 1) FS.toast('🧾 ' + list.length + ' תמונות מסומנות עודכנו', 2000);
  }
  function typeCopies(p, el) {
    var inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.max = '999'; inp.value = copies(p); inp.className = 'mt-cpin'; inp.setAttribute('aria-label', 'מספר הדפסים');
    el.replaceWith(inp); inp.focus(); inp.select();
    var done = false, end = function (save) { if (done) return; done = true; if (save && inp.value !== '') setCopies(group(p), function () { return inp.value; }); else refreshTile(p); };
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); });
    inp.addEventListener('blur', function () { end(true); });
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  var hoverId = null;
  $('#mt-grid', root).addEventListener('mouseover', function (e) { var t = e.target.closest('.mt-tile'); hoverId = t ? t.dataset.id : null; });
  $('#mt-grid', root).addEventListener('mouseleave', function () { hoverId = null; });
  /* 0–9, + and − on the photo under the mouse (or the one in focus): called from the workspace's key handler below */
  function copyKey(e) {
    if (view !== 'main' || e.ctrlKey || e.metaKey || e.altKey) return false;
    var p = byId(hoverId || focusId); if (!p) return false;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); setCopies(group(p), function () { return Number(e.key); }); return true; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setCopies(group(p), function (q) { return copies(q) + 1; }); return true; }
    if (e.key === '-') { e.preventDefault(); setCopies(group(p), function (q) { return copies(q) - 1; }); return true; }
    return false;
  }
  $('#mt-grid', root).addEventListener('click', function (e) {
    var os = e.target.closest('[data-orisel]'); if (os) { var all = S.photos.filter(function (p) { return oriOf(p) === os.dataset.orisel; }), on = all.some(function (p) { return !S.marked[p.id]; }); all.forEach(function (p) { mark(p, on); }); buildGrid(); return; }
    var t = e.target.closest('.mt-tile'); if (!t) return; var p = byId(t.dataset.id); if (!p) return;
    var cp = e.target.closest('[data-cp]');
    if (cp) { setCopies(group(p), function (q) { return copies(q) + Number(cp.dataset.cp); }); return; }
    if (e.target.closest('[data-cpn]')) { typeCopies(p, e.target.closest('[data-cpn]')); return; }
    var av = e.target.closest('[data-advset]'); if (av) { setCopies([p], function () { return Number(av.dataset.advset); }); FS.toast('👥 ' + av.dataset.advset + ' הדפסים, לפי האנשים בתמונה', 2500); return; }
    if (e.target.closest('.mt-zoomb')) { big(p); return; }
    var l = shown(), i = l.indexOf(p);
    if (e.shiftKey && lastClick >= 0) { var a = Math.min(i, lastClick), b = Math.max(i, lastClick); for (var k = a; k <= b; k++) mark(l[k], true); buildGrid(); }
    else { mark(p, !S.marked[p.id]); t.classList.toggle('sel', !!S.marked[p.id]); }
    focusId = p.id; lastClick = i; $$('.mt-tile.focus', root).forEach(function (x) { x.classList.toggle('focus', x === t); }); t.classList.add('focus'); foot(); stat();
  });
  $('#mt-grid', root).addEventListener('dblclick', function (e) { var t = e.target.closest('.mt-tile'); if (!t || e.target.closest('button')) return; focusId = t.dataset.id; show('design'); });
  function big(p) {
    var px = Math.min(1100, Math.round(Math.max(innerWidth, innerHeight) * 0.55)), c = pageCanvas(p, px, false);
    var b = FS.dialog(esc(p.name || ''), '<div class="mt-big mt-big2"><figure><figcaption>לפני</figcaption></figure><figure><figcaption>אחרי</figcaption></figure></div><div class="mt-row"><button class="mt-btn" id="mt-big-edit">🖌️ לעורך המלא</button></div>', true);
    var figs = $$('.mt-big figure', b); FS.loadImg(p.origSrc || p.src).then(function () { figs[0].insertBefore(origCanvas(p, px), figs[0].firstChild); }, function () {}); figs[1].insertBefore(c, figs[1].firstChild); $('#mt-big-edit', b).addEventListener('click', function () { FS.closeDialog(); focusId = p.id; show('design'); });
  }
  function foot() {
    var n = S.photos.length, m = marked().length, prints = S.photos.reduce(function (a, p) { return a + copies(p); }, 0), done = S.photos.filter(function (p) { return p.printed; }).length;
    $('#mt-foot', root).textContent = n + ' תמונות · ' + m + ' מסומנות · ' + prints + ' הדפסים · ' + done + ' הודפסו';
  }
  function stat() { var m = marked().length; $('#mt-stat', root).textContent = S.photos.length ? (m ? m + ' מסומנות מתוך ' + S.photos.length : S.photos.length + ' תמונות') : ''; foot(); fab(); }
  /* 🖨️ always at hand: one button, in every view, prints the marked photos (or the one in focus) with their copies */
  function fab() {
    var b = $('#mt-fab', root); if (!b) return;
    var l = S.photos.length ? qpList() : [], n = l.reduce(function (s, p) { return s + copies(p); }, 0);
    b.hidden = !S.photos.length; $('#mt-fab-n', root).textContent = n ? n + (n === 1 ? ' מגנט' : ' מגנטים') : '';
    b.title = marked().length ? 'הדפסת ' + marked().length + ' המסומנות (Ctrl+P)' : 'הדפסת התמונה שבפוקוס (Ctrl+P)';
  }

  /* sub bars */
  function setBar(b) { bar = b; ls('fs-mate-bar', b); $$('.mt-sub [data-bar]', root).forEach(function (x) { x.classList.toggle('on', x.dataset.bar === b); }); $$('.mt-bar', root).forEach(function (x) { x.hidden = x.dataset.b !== b; }); if (b === 'biz') bizTxt(); }
  $$('.mt-sub [data-bar]', root).forEach(function (x) { x.addEventListener('click', function () { setBar(x.dataset.bar); }); });
  setBar(bar);
  ['#mt-show', '#mt-sort'].forEach(function (s) { $(s, root).addEventListener('change', buildGrid); });
  $('#mt-all', root).addEventListener('click', function () { shown().forEach(function (p) { mark(p, true); }); buildGrid(); });
  $('#mt-none', root).addEventListener('click', function () { S.marked = {}; buildGrid(); });
  $('#mt-inv', root).addEventListener('click', function () { shown().forEach(function (p) { mark(p, !S.marked[p.id]); }); buildGrid(); });
  $('#mt-del', root).addEventListener('click', function () {
    var l = marked(); if (!l.length) return FS.toast('מסמנים קודם את התמונות להסרה');
    if (!confirm('להסיר ' + l.length + ' תמונות מהעבודה? (הקבצים במחשב לא נמחקים)')) return;
    S.photos = S.photos.filter(function (p) { return !S.marked[p.id]; }); S.marked = {}; S.cur = Math.min(Math.max(S.cur, 0), S.photos.length - 1); S.sel = null;
    FS.buildStrip(); FS.emit('doc'); FS.emit('history'); buildGrid();
  });

  /* size: fit or crop, for the marked photos or all */
  var fit = ls('fs-mate-fit') || 'cover';
  function sizes() {
    var cur = ls('fs-mate-size') || '';
    $('#mt-size', root).innerHTML = FS.mySizes().map(function (z) { return '<option value="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</option>'; }).join('');
    if (cur && $('#mt-size option[value="' + cur + '"]', root)) $('#mt-size', root).value = cur; else { var t = $('#mt-size option[value="my:b100x150"]', root); if (t) $('#mt-size', root).value = 'my:b100x150'; }
  }
  sizes(); FS.on('sizes', sizes);
  $('#mt-size', root).addEventListener('change', function () { ls('fs-mate-size', this.value); });
  $('#mt-size-edit', root).addEventListener('click', function () { FS.manageSizes(); });
  function seg(sel, val, attr) { $$(sel + ' button', root).forEach(function (b) { b.classList.toggle('on', b.dataset[attr] === val); }); }
  seg('#mt-fit', fit, 'f');
  $('#mt-fit', root).addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; fit = b.dataset.f; ls('fs-mate-fit', fit); seg('#mt-fit', fit, 'f'); });
  /* one photo to a print size: the layers keep their place, a frame is rebuilt for the new shape, the photo fills or fits */
  function toSize(p, z, mode, orient) {
    var im = FS.img(p.src); if (!im) return;
    var w = z.w, h = z.h, d = p.doc;
    if (orient) { var land = (im.naturalWidth > im.naturalHeight) !== (Math.abs(Math.round(d.photo.r / 90)) % 2 === 1); if (land !== (w > h) && w !== h) { var t = w; w = h; h = t; } }
    var oldW = d.w, oldH = d.h;
    FS.applyFormat(d, 'cm', im, w, h);
    d.layers.forEach(function (L) { L.x = L.x / oldW * d.w; L.y = L.y / oldH * d.h; });
    if (d.frame) FS.setFrame(p, d.frame, { quiet: true, noTexts: true });
    FS.fitPhoto(d, im, mode); p.fit = mode;
    p.cache = {}; p._pt = null; p._gt = null; FS.snap(p);
  }
  /* also how new photos come in: wide stays wide, tall stays tall (on unless turned off) */
  $('#mt-orient', root).checked = FS.prefs.keepOrient !== false;
  $('#mt-orient', root).addEventListener('change', function () { FS.prefs.keepOrient = this.checked; FS.savePrefs(); });
  function applySize(list) {
    var z = FS.sizeOf($('#mt-size', root).value); if (!z) return FS.toast('בוחרים גודל');
    if (!list.length) return FS.toast('אין תמונות');
    var o = $('#mt-orient', root).checked;
    Promise.all(list.map(function (p) { return FS.loadImg(p.src).catch(function () {}); })).then(function () {
      list.forEach(function (p) { toSize(p, z, fit, o); });
      FS.prefs.fmt = $('#mt-size', root).value; FS.prefs.fitNew = fit; FS.savePrefs(); snewTxt();
      FS.emit('doc'); buildGrid(); FS.toast('📐 ' + FS.sizeLabel(z) + ' · ' + (fit === 'cover' ? 'לחתוך' : 'להתאים') + ' · ' + list.length + ' תמונות');
    });
  }
  /* new photos come in at the last size applied here (core.js reads FS.prefs.fmt), filling or fitting the same way */
  function snewTxt() { var z = /^my:/.test(FS.prefs.fmt || '') && FS.sizeOf(FS.prefs.fmt), el = $('#mt-snew', root); if (el) el.textContent = z ? '📌 תמונות חדשות נכנסות ב־' + FS.sizeLabel(z) + (FS.prefs.fitNew === 'contain' ? ' (להתאים)' : '') : ''; }
  (function () { var v = FS.prefs.fmt; if (/^my:/.test(v || '') && $('#mt-size option[value="' + v + '"]', root) && !ls('fs-mate-size')) $('#mt-size', root).value = v; snewTxt(); FS.on('sizes', snewTxt); })();
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (FS.prefs.fitNew !== 'contain' || !/^my:/.test(FS.prefs.fmt || '')) return; var im = FS.img(p.src); if (im) { FS.fitPhoto(p.doc, im, 'contain'); p.fit = 'contain'; } });
  $('#mt-size-sel', root).addEventListener('click', function () { var l = marked(); if (!l.length) return FS.toast('מסמנים תמונות, או "החל על כולן"'); applySize(l); });
  $('#mt-size-all', root).addEventListener('click', function () { applySize(S.photos.slice()); });

  /* copies */
  var cpn = 1;
  $$('[data-cpa]', root).forEach(function (b) { b.addEventListener('click', function () { cpn = FS.clamp(cpn + Number(b.dataset.cpa), 0, 999); $('#mt-cpn', root).textContent = cpn; }); });
  $('#mt-cp-set', root).addEventListener('click', function () { var l = marked(); if (!l.length) return FS.toast('מסמנים תמונות קודם'); l.forEach(function (p) { p.copies = cpn; }); buildGrid(); });
  function advise() { var l = marked().length ? marked() : S.photos.slice(); if (FS.openCopiesAdvisor) FS.openCopiesAdvisor(l, function () { buildGrid(); stat(); }); }
  $('#mt-cadv', root).addEventListener('click', advise);
  (function () { var c = $('#mt-cauto', root); if (!c) return; c.checked = ls('fs-auto-copies') !== '0'; c.addEventListener('change', function () { ls('fs-auto-copies', c.checked ? '1' : '0'); FS.toast(c.checked ? '🧮 כל תמונה חדשה תקבל עותקים לפי האנשים בה' : 'העותקים האוטומטיים כבויים'); }); })();
  FS.mateAdvise = advise;
  $('#mt-cp-1', root).addEventListener('click', function () { S.photos.forEach(function (p) { p.copies = 1; }); buildGrid(); });
  $('#mt-cp-0', root).addEventListener('click', function () { S.photos.forEach(function (p) { p.copies = 0; }); buildGrid(); FS.toast('כל התמונות על 0. מוסיפים + לתמונות שרוצים להדפיס.'); });

  /* the business details: never added by themselves; added here when wanted, and removed the same way */
  function bizTxt() { var t = FS.creditText ? FS.creditText() : ''; $('#mt-biz-txt', root).textContent = t ? 'הפרטים: ' + t : 'עוד לא הוזנו פרטי עסק'; }
  function bizSet(onOff) {
    var list = marked().length ? marked() : S.photos.slice(); if (!list.length) return;
    var keep = FS.BIZ.credit.on; FS.BIZ.credit.on = onOff;
    list.forEach(function (p) { if (onOff) { delete p.noCredit; FS.applyCredit(p); } else { p.doc.layers = p.doc.layers.filter(function (L) { return L.link !== 'biz'; }); } p.cache = {}; FS.snap(p); });
    FS.BIZ.credit.on = keep; buildGrid(); FS.toast(onOff ? '🏷️ הפרטים נוספו ל־' + list.length + ' תמונות' : 'הפרטים הוסרו מ־' + list.length + ' תמונות');
  }
  $('#mt-biz-on', root).addEventListener('click', function () { if (!FS.creditText()) { var b = $('#biz-btn'); if (b) b.click(); return; } bizSet(true); });
  $('#mt-biz-off', root).addEventListener('click', function () { bizSet(false); });
  $('#mt-biz-edit', root).addEventListener('click', function () { var b = $('#biz-btn'); if (b) b.click(); });

  /* ---------- ערוך תמונה ---------- */
  var SL = [['brightness', 'בהירות', '☀️'], ['contrast', 'ניגודיות', '◐'], ['exposure', 'חשיפה', '🔆'], ['saturation', 'רוויה', '🎨'], ['temp', 'חום', '🌡️'],
    ['cr', 'אדום', 'R'], ['cg', 'ירוק', 'G'], ['cb', 'כחול', 'B'], ['sharpen', 'חדות', '🔍']];
  $('#mt-sliders', root).innerHTML = SL.map(function (s) {
    var lo = s[0] === 'sharpen' ? 0 : -100;
    return '<div class="mt-sl" data-k="' + s[0] + '"><span class="mt-sli ' + (/^c[rgb]$/.test(s[0]) ? s[0] : '') + '">' + s[2] + '</span><label>' + s[1] + '</label><input type="range" min="' + lo + '" max="100" value="0"><input type="number" min="' + lo + '" max="100" value="0"><button class="mt-ic" title="איפוס">↺</button></div>';
  }).join('');
  function focus() { var p = focusId && byId(focusId); return p || FS.cur() || S.photos[0] || null; }
  /* the photos of the edit screen: the marked ones when it opened (or all), and they stay while ✓ marks change what a change reaches */
  var eSet = null;
  function editList() {
    if (!eSet) { var m = marked(); eSet = m.length && m.length < S.photos.length ? m.map(function (p) { return p.id; }) : 'all'; }
    if (eSet === 'all') return byOri(S.photos.slice());
    var l = eSet.map(byId).filter(Boolean); if (!l.length) { eSet = 'all'; return byOri(S.photos.slice()); } return byOri(l);
  }
  /* the edit screen shows 4, 6 or 9 photos at a time, filling the screen; "together" makes every change reach all of them */
  /* photos per screen: 6 on a computer, one at a time on a phone (until the owner chooses otherwise) */
  var eN = Number(ls('fs-mate-en2')) || (innerWidth < 700 ? 1 : 6), ePage = 0, eTog = ls('fs-mate-etog') !== '0';
  function eCols() { return eN === 1 ? 1 : eN <= 4 ? 2 : 3; }
  function ePages() { return Math.max(1, Math.ceil(editList().length / eN)); }
  function pageList() { var l = editList(); ePage = Math.min(ePage, ePages() - 1); return l.slice(ePage * eN, ePage * eN + eN); }
  /* what a change reaches: all the photos on the edit screen (together), else the marked photos (with the focused one), or the focused one */
  function targets() {
    var f = focus(), m = marked();
    if (view === 'edit' && m.length) return m;                     /* the photos with ✓ (on any page) */
    if (eTog && view === 'edit') return pageList();
    if (f && m.length && S.marked[f.id]) return m; if (!f && m.length) return m; return f ? [f] : [];
  }
  function eTileHTML(p) {
    return '<div class="mt-tile big' + (S.marked[p.id] ? ' sel' : '') + (p.id === (focus() || {}).id ? ' focus' : '') + '" data-id="' + p.id + '" data-px="' + etile + '"><div class="mt-th">' + (cmp ? '<div class="mt-ba"><div class="mt-b"><span>לפני</span></div><div class="mt-a"><span>אחרי</span></div></div>' : '') + '<button class="mt-chk" title="סימון">✓</button></div><div class="mt-name">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '<button class="mt-dl" title="שמירת התמונה">⬇</button></div></div>';
  }
  var etile = 420;
  function buildEdit() {
    var g = $('#mt-egrid', root), l = pageList(), k = keepCanvases(g), cols = eCols(), rows = Math.ceil(eN / cols);
    var cw = (g.clientWidth || innerWidth * 0.7) / cols, ch = (g.clientHeight || innerHeight * 0.75) / rows;
    etile = Math.round(Math.max(200, Math.min(eN <= 2 ? 1600 : 900, Math.max(cw, ch) * 1.1)));
    g.style.setProperty('--ec', cols); g.style.setProperty('--er', rows);
    if (l.length && !l.some(function (p) { return p.id === focusId; })) focusId = l[0].id;
    g.innerHTML = l.length ? l.map(eTileHTML).join('') : '<p class="mt-hint">אין תמונות עדיין.</p>';
    reuse(g, k);
    seg('#mt-en', String(eN), 'n'); $('#mt-etog', root).checked = eTog; $('#mt-eall', root).hidden = eSet === 'all'; var tot = editList().length, a0 = ePage * eN; $('#mt-epg', root).textContent = tot ? (a0 + 1) + (eN > 1 ? '–' + Math.min(tot, a0 + eN) : '') + ' מתוך ' + tot : '0';
    $('#mt-eprev', root).disabled = ePage <= 0; $('#mt-enext', root).disabled = ePage >= ePages() - 1;
    $('#mt-enavp', root).disabled = ePage <= 0; $('#mt-enavn', root).disabled = ePage >= ePages() - 1;
    syncSliders(); targetTxt(); buildFrames(); buildFx(); buildLooks(); oriSync(); eStrip(); stat();
  }
  /* a page slides in from the side it comes from (right to left: the next page comes from the left) */
  function slide(el, n) { el.classList.remove('sl-n', 'sl-p'); void el.offsetWidth; el.classList.add(n > 0 ? 'sl-n' : 'sl-p'); }
  function ePageGo(n, to) { to = FS.clamp(to != null ? to : ePage + n, 0, ePages() - 1); if (to === ePage) return; n = to > ePage ? 1 : -1; ePage = to; buildEdit(); slide($('#mt-egrid', root), n); }
  /* the strip under the photos: every photo small, the ones on screen lit; a click goes to its page */
  function eStrip() {
    var box = $('#mt-estrip', root), l = editList(), on = pageList().map(function (p) { return p.id; });
    box.hidden = l.length < 2;
    if (box._ids !== l.map(function (p) { return p.id; }).join()) {
      box._ids = l.map(function (p) { return p.id; }).join();
      box.innerHTML = l.map(function (p, i) { return '<button class="mt-pj mt-tile" data-id="' + p.id + '" data-i="' + i + '" data-px="90"><span class="mt-th"></span><i>' + (i + 1) + '</i></button>'; }).join('');
      $$('.mt-pj', box).forEach(watch);
    }
    $$('.mt-pj', box).forEach(function (b) { b.classList.toggle('on', on.indexOf(b.dataset.id) >= 0); b.classList.toggle('focus', b.dataset.id === focusId); b.classList.toggle('sel', !!S.marked[b.dataset.id]); });
    var f = $('.mt-pj.on', box); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  $('#mt-estrip', root).addEventListener('click', function (e) { var b = e.target.closest('.mt-pj'); if (!b) return; focusId = b.dataset.id; var to = Math.floor(Number(b.dataset.i) / eN); if (to === ePage) { buildEdit(); return; } ePageGo(0, to); });
  $('#mt-enavp', root).addEventListener('click', function () { ePageGo(-1); });
  $('#mt-enavn', root).addEventListener('click', function () { ePageGo(1); });
  /* a swipe on the photos turns the page (right to left: a swipe to the right shows the next) */
  (function () {
    var g = $('#mt-egrid', root), sx = 0, sy = 0, st = 0;
    g.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; st = Date.now(); });
    g.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Date.now() - st < 700 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.6) { ePageGo(dx > 0 ? 1 : -1); g._swiped = Date.now(); } });
  })();
  /* holding a photo a moment shows it as it came in; letting go shows the edit again */
  (function () {
    var g = $('#mt-egrid', root), tm = null, peek = null;
    function off() { clearTimeout(tm); tm = null; if (peek) { peek.remove(); peek = null; } }
    g.addEventListener('pointerdown', function (e) {
      if (e.button || e.target.closest('button') || cmp) return; var t = e.target.closest('.mt-tile'), box = t && $('.mt-th', t), p = t && byId(t.dataset.id); if (!p || !box) return;
      tm = setTimeout(function () { var c = box.querySelector('canvas'); if (!c) return; var o = origCanvas(p, Number(t.dataset.px) || 600); o.className = 'mt-peek'; o.style.width = c.style.width || c.clientWidth + 'px'; o.style.height = c.style.height || c.clientHeight + 'px'; peek = document.createElement('div'); peek.className = 'mt-peekw'; peek.appendChild(o); peek.insertAdjacentHTML('beforeend', '<span>המקור</span>'); box.appendChild(peek); }, 260);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (k) { g.addEventListener(k, off); });
  })();
  function targetTxt() {
    var n = targets().length, m = marked().length;
    $('#mt-target', root).textContent = view === 'edit' && m ? '✓ השינויים חלים על ' + m + ' התמונות המסומנות' : eTog ? 'השינויים חלים יחד על ' + n + ' התמונות שבמסך' : n ? 'השינויים חלים על התמונה המודגשת · מסמנים ✓ כדי לערוך כמה יחד' : '';
    var sc = $('#mt-selc', root); if (sc) sc.textContent = m ? '✓ ' + m + ' מסומנות' : 'לא סומנו תמונות';
    if (view === 'edit') $$('#mt-estrip .mt-pj', root).forEach(function (b) { b.classList.toggle('sel', !!S.marked[b.dataset.id]); });
  }
  $('#mt-en', root).addEventListener('click', function (e) { var b = e.target.closest('[data-n]'); if (!b) return; var first = ePage * eN; eN = Number(b.dataset.n); ls('fs-mate-en2', eN); ePage = Math.floor(first / eN); buildEdit(); });
  function cmpSync() { $$('.mt-cmpb', root).forEach(function (b) { b.classList.toggle('on', cmp); }); }
  function setCmp(v) { cmp = v; ls('fs-mate-cmp2', v ? '1' : '0'); cmpSync(); if (view === 'edit') { $('#mt-egrid', root).innerHTML = ''; buildEdit(); } else if (view === 'design') drawDesign(); }
  $('#mt-cmp', root).addEventListener('click', function () { setCmp(!cmp); });
  $('#mt-etog', root).addEventListener('change', function () { eTog = this.checked; ls('fs-mate-etog', eTog ? '1' : '0'); targetTxt(); });
  /* choosing which photos the changes reach: the screen, all of them, none */
  function selMany(list, v) { list.forEach(function (p) { mark(p, v); }); $$('#mt-egrid .mt-tile', root).forEach(function (t) { t.classList.toggle('sel', !!S.marked[t.dataset.id]); }); targetTxt(); stat(); syncSliders(); }
  $('#mt-selp', root).addEventListener('click', function () { selMany(pageList(), true); });
  $('#mt-sela', root).addEventListener('click', function () { selMany(editList(), true); });
  $('#mt-seln', root).addEventListener('click', function () { selMany(editList(), false); });
  $('#mt-eall', root).addEventListener('click', function () { eSet = 'all'; ePage = 0; buildEdit(); });
  /* the keyboard on the edit screen: arrows move between the photos (and on to the next page), space marks, Enter opens the full editor */
  function eMove(d) {
    var l = editList(), f = focus(), i = Math.max(0, l.indexOf(f)), to = FS.clamp(i + d, 0, l.length - 1); if (!l.length || to === i) return;
    focusId = l[to].id; var pg = Math.floor(to / eN);
    if (pg !== ePage) ePageGo(0, pg); else { $$('#mt-egrid .mt-tile', root).forEach(function (x) { x.classList.toggle('focus', x.dataset.id === focusId); }); syncSliders(); targetTxt(); buildFx(); eStrip(); }
  }
  FS.mateKeys = function (k, e) {
    if (view !== 'edit') return false;
    var c = eCols();
    if (k === 'arrowleft') eMove(1); else if (k === 'arrowright') eMove(-1);
    else if (k === 'arrowdown') eMove(c); else if (k === 'arrowup') eMove(-c);
    else if (k === 'home') eMove(-1e6); else if (k === 'end') eMove(1e6);
    else if (k === ' ' || k === 'spacebar') { var p = focus(); if (!p) return true; mark(p, !S.marked[p.id]); $$('#mt-egrid .mt-tile[data-id="' + p.id + '"]', root).forEach(function (t) { t.classList.toggle('sel', !!S.marked[p.id]); }); targetTxt(); stat(); }
    else if (k === 'enter') show('design');
    else return false;
    e.preventDefault(); return true;
  };
  $('#mt-eprev', root).addEventListener('click', function () { ePageGo(-1); });
  $('#mt-enext', root).addEventListener('click', function () { ePageGo(1); });
  $('#mt-egrid', root).addEventListener('click', function (e) {
    var t = e.target.closest('.mt-tile'); if (!t) return; var p = byId(t.dataset.id);
    if (e.target.closest('.mt-dl')) { saveOne(p); return; }
    if (e.target.closest('.mt-chk')) { mark(p, !S.marked[p.id]); t.classList.toggle('sel', !!S.marked[p.id]); targetTxt(); stat(); return; }
    focusId = p.id; $$('#mt-egrid .mt-tile', root).forEach(function (x) { x.classList.toggle('focus', x === t); }); syncSliders(); targetTxt(); buildFx();
  });
  $('#mt-egrid', root).addEventListener('dblclick', function (e) { var t = e.target.closest('.mt-tile'); if (!t || e.target.closest('button')) return; focusId = t.dataset.id; show('design'); });
  function syncSliders() {
    var p = focus(), a = p ? p.doc.photo.adj : FS.ADJ0;
    $$('.mt-sl', root).forEach(function (r) { var v = a[r.dataset.k] || 0; $('input[type=range]', r).value = v; $('input[type=number]', r).value = v; });
  }
  var liveT = 0, endT = 0;
  function setAdj(k, v, final) {
    var list = targets(); if (!list.length) return;
    list.forEach(function (p) { p.doc.photo.adj[k] = v; p.doc.photo.preset = null; });
    cancelAnimationFrame(liveT);
    liveT = requestAnimationFrame(function () { var ids = view === 'edit' ? list.map(function (p) { return p.id; }) : [(focus() || {}).id]; ids.forEach(function (id) { $$('#mt-egrid .mt-tile[data-id="' + id + '"]', root).forEach(function (el) { el._sig = null; drawTile(el); }); }); });
    clearTimeout(endT);
    endT = setTimeout(function () { list.forEach(function (p) { p.cache = {}; $$('.mt-tile[data-id="' + p.id + '"]', root).forEach(function (el) { el._sig = null; enqueue(el); }); }); }, final ? 0 : 260);
    if (final) list.forEach(function (p) { FS.snap(p); });
  }
  $$('.mt-sl', root).forEach(function (r) {
    var k = r.dataset.k, rg = $('input[type=range]', r), nb = $('input[type=number]', r);
    rg.addEventListener('input', function () { nb.value = rg.value; setAdj(k, Number(rg.value)); });
    rg.addEventListener('change', function () { setAdj(k, Number(rg.value), true); });
    nb.addEventListener('change', function () { var v = FS.clamp(Number(nb.value) || 0, Number(nb.min), 100); nb.value = rg.value = v; setAdj(k, v, true); });
    $('button', r).addEventListener('click', function () { nb.value = rg.value = 0; setAdj(k, 0, true); });
    rg.addEventListener('dblclick', function () { nb.value = rg.value = 0; setAdj(k, 0, true); });
  });
  function redraw(list) { list.forEach(function (p) { p.cache = {}; FS.snap(p); refreshTile(p); }); FS.emit('doc'); }
  $('#mt-auto', root).addEventListener('click', function () { var l = targets(); Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { l.forEach(function (p) { p.doc.photo.adj = Object.assign({}, p.doc.photo.adj, FS.autoAdjust(p)); }); redraw(l); syncSliders(); FS.toast('✨ תיקון אוטומטי · ' + l.length + ' תמונות'); }); });
  $('#mt-reset', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.photo.adj = Object.assign({}, FS.ADJ0); p.doc.photo.preset = null; }); redraw(l); syncSliders(); });
  $('#mt-apply-all', root).addEventListener('click', function () {
    var f = focus(); if (!f) return; var a = JSON.stringify(f.doc.photo.adj);
    S.photos.forEach(function (p) { if (p !== f) { p.doc.photo.adj = JSON.parse(a); p.doc.photo.preset = f.doc.photo.preset || null; } }); redraw(S.photos.slice()); FS.toast('התיקון הוחל על ' + S.photos.length + ' התמונות');
  });
  $$('.mt-ptabs [data-pt]', root).forEach(function (b) { b.addEventListener('click', function () { $$('.mt-ptabs [data-pt]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); $$('[data-pp]', root).forEach(function (x) { x.hidden = x.dataset.pp !== b.dataset.pt; }); }); });

  /* title: one linked text layer on each target, replaced when added again */
  var fonts = FS.FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('');
  $('#mt-tfont', root).innerHTML = fonts; $('#mt-tfont', root).value = 'Frank Ruhl Libre';
  var tpos = 'bottom';
  $('#mt-tpos', root).addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; tpos = b.dataset.p; seg('#mt-tpos', tpos, 'p'); });
  $('#mt-tadd', root).addEventListener('click', function () {
    var text = $('#mt-tt', root).value.trim(); if (!text) return FS.toast('כותבים כותרת');
    var l = targets(); l.forEach(function (p) {
      var d = p.doc, H = FS.hole(d), size = Math.round(Math.min(d.w, d.h) * Number($('#mt-tsize', root).value) / 100);
      d.layers = d.layers.filter(function (L) { return L.link !== 'mt-title'; });
      var y = tpos === 'top' ? H.y + size * 1.1 : tpos === 'mid' ? H.y + H.h / 2 : H.y + H.h - size * 1.1;
      d.layers.push({ id: FS.uid(), link: 'mt-title', type: 'text', text: text, size: size, font: $('#mt-tfont', root).value, weight: 700, color: $('#mt-tcol', root).value, shadow: $('#mt-tsh', root).checked, x: d.w / 2, y: y, r: 0, opacity: 1, align: 'center', strokeW: 0, stroke: '#000000', spacing: 0 });
    });
    redraw(l); FS.toast('🔤 הכותרת נוספה ל־' + l.length + ' תמונות');
  });
  $('#mt-tdel', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.layers = p.doc.layers.filter(function (L) { return L.link !== 'mt-title'; }); }); redraw(l); });

  /* frames */
  function frameRef(v, col) { if (!v) return null; return v[0] === 'u' ? { kind: 'png', id: v.slice(2), opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false } : { kind: 'gen', id: v.slice(2), opacity: 1, thick: 1, color: col }; }
  function frameOptions() {
    var base = FS.GEN_FRAMES.filter(function (f) { return (FS.BASE_FRAMES || []).indexOf(f.id) >= 0; });
    return [['', 'בלי מסגרת']].concat(base.map(function (f) { return ['g:' + f.id, f.name]; }), Object.keys(FS.USER_FRAMES || {}).map(function (id) { return ['u:' + id, FS.USER_FRAMES[id].name, FS.USER_FRAMES[id].src]; }));
  }
  /* a PNG frame has its own direction; a drawn frame fits any page */
  function frameOri(v) { var u = v && v[0] === 'u' && (FS.USER_FRAMES || {})[v.slice(2)]; return !u || !u.aspect ? null : u.aspect > 1.02 ? 'wide' : u.aspect < 0.98 ? 'tall' : null; }
  function buildFrames() {
    ['tall', 'wide'].forEach(function (o) {
      var sel = $('#mt-f' + o, root), keep = sel.value || ls('fs-mate-f' + o) || '';
      sel.innerHTML = frameOptions().filter(function (f) { var fo = frameOri(f[0]); return !fo || fo === o; }).map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('');
      if ($('option[value="' + keep.replace(/"/g, '') + '"]', sel)) sel.value = keep;
    });
    var p = focus(), fr = p && p.doc.frame, cur = !fr ? '' : (fr.kind === 'png' ? 'u:' : 'g:') + fr.id;
    $('#mt-frames', root).innerHTML = frameOptions().map(function (f) { return '<button data-fr="' + esc(f[0]) + '"' + (f[0] === cur ? ' class="on"' : '') + ' title="' + esc(f[1]) + '">' + (f[2] ? '<img src="' + esc(f[2]) + '" alt="">' : '') + '<em>' + esc(f[1]) + '</em>' + (f[0][0] === 'u' ? '<b class="mt-frx" data-frx="' + esc(f[0].slice(2)) + '" title="מחיקת המסגרת">✕</b>' : '') + '</button>'; }).join('');
  }
  FS.on('frames', function () { if (on() && view === 'edit') buildFrames(); });
  function setFrames(list, v) {
    var ref = frameRef(v, $('#mt-fcol', root).value);
    list.forEach(function (p) { FS.setFrame(p, ref ? JSON.parse(JSON.stringify(ref)) : null, { quiet: true }); if (p.fit) FS.fitPhoto(p.doc, FS.img(p.src), p.fit); p.cache = {}; FS.snap(p); refreshTile(p); });
    FS.emit('doc');
  }
  $('#mt-frames', root).addEventListener('click', function (e) {
    var x = e.target.closest('[data-frx]'); if (x) { var id = x.dataset.frx, f = FS.USER_FRAMES[id]; if (f && confirm('למחוק את המסגרת "' + f.name + '"?')) FS.deleteUserFrame(id).then(function () { buildFrames(); if (FS.buildFrames) FS.buildFrames(); }); return; }
    var b = e.target.closest('[data-fr]'); if (!b) return; var l = targets(), fo = frameOri(b.dataset.fr), all = l.length;
    if (fo) l = l.filter(function (p) { return oriOf(p) === fo; });
    if (!l.length) return FS.toast('המסגרת ' + ORI_NAME[fo] + ', ואין תמונות ' + ORI_NAME[fo] + ' בבחירה');
    Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { setFrames(l, b.dataset.fr); buildFrames(); if (l.length < all) FS.toast('המסגרת עלתה על ' + l.length + ' התמונות ' + ORI_NAME[fo] + ' · ' + (all - l.length) + ' בכיוון השני נשארו בלי שינוי'); }); });
  $$('[data-fori]', root).forEach(function (b) { b.addEventListener('click', function () {
    var o = b.dataset.fori, v = $('#mt-f' + o, root).value, l = S.photos.filter(function (p) { return oriOf(p) === o; });
    ls('fs-mate-f' + o, v); if (!l.length) return FS.toast('אין תמונות ' + ORI_NAME[o]);
    Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { setFrames(l, v); buildFrames(); FS.toast((v ? '🖼️ המסגרת עלתה על ' : 'המסגרת הוסרה מ־') + l.length + ' תמונות ' + ORI_NAME[o]); });
  }); });
  function addFrames(input) {
    var f = Array.prototype.slice.call(input.files || []); input.value = ''; if (!f.length || !FS.addFrameFiles) return;
    Promise.resolve(FS.addFrameFiles(f, { noUse: true })).then(function (added) {
      buildFrames(); added = added || [];
      if (added.length === 1) { var l = targets(); Promise.all(l.map(function (p) { return FS.loadImg(p.src); })).then(function () { setFrames(l, 'u:' + added[0].id); buildFrames(); }); }
    });
  }
  $('#mt-fpng', root).addEventListener('change', function () { addFrames(this); });
  $('#mt-fdir', root).addEventListener('change', function () { addFrames(this); });

  /* effects: the presets with small previews of the focused photo, and the instant styles */
  var fxCat = '';
  $('#mt-fxcat', root).innerHTML = FS.PRESET_CATS.map(function (c) { return '<button data-c="' + c[0] + '"' + (c[0] === fxCat ? ' class="on"' : '') + '>' + esc(c[1]) + '</button>'; }).join('');
  $('#mt-fxcat', root).addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (!b) return; fxCat = b.dataset.c; seg('#mt-fxcat', fxCat, 'c'); buildFx(); });
  var fxBase = null;
  function fxThumb(adj) {
    var p = focus(); if (!p || !FS.img(p.src)) return null;
    if (!fxBase || fxBase.src !== p.src) { var sm = FS.smallOf(p, 120), c = FS.canvas(sm.width || sm.naturalWidth, sm.height || sm.naturalHeight), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(sm, 0, 0, c.width, c.height); fxBase = { src: p.src, w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height) }; }
    var o = FS.canvas(fxBase.w, fxBase.h), ox = o.getContext('2d'), id = new ImageData(new Uint8ClampedArray(fxBase.d.data), fxBase.w, fxBase.h);
    FS.adjustPixels(id.data, fxBase.w, fxBase.h, adj, true); ox.putImageData(id, 0, 0); return o;
  }
  function buildFx() {
    var box = $('#mt-fx', root); if (!box) return;
    var list = FS.PRESETS.filter(function (q) { return !fxCat || q[3] === fxCat; });
    box.innerHTML = list.map(function (q) { return '<button data-pre="' + q[0] + '"><span></span>' + esc(q[1]) + '</button>'; }).join('');
    var i = 0, btns = $$('[data-pre]', box);
    (function step() { var t0 = performance.now(); while (i < btns.length && performance.now() - t0 < 12) { var q = FS.PRESETS.filter(function (x) { return x[0] === btns[i].dataset.pre; })[0], c = q && fxThumb(FS.presetAdj(q[2], 1)); if (c) btns[i].firstChild.appendChild(c); i++; } if (i < btns.length && box.isConnected) requestAnimationFrame(step); })();
    $('#mt-styles', root).innerHTML = '<button data-st="">בלי סגנון</button>' + FS.LOCAL_STYLES.filter(function (s) { return (FS.PRO_STYLES || []).indexOf(s[0]) >= 0; }).map(function (s) { return '<button data-st="' + s[0] + '">' + s[2] + ' ' + esc(s[1]) + '</button>'; }).join('');
  }
  $('#mt-fx', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-pre]'); if (!b) return; var q = FS.PRESETS.filter(function (x) { return x[0] === b.dataset.pre; })[0]; if (!q) return;
    var l = targets(); l.forEach(function (p) { p.doc.photo.adj = FS.presetAdj(q[2], 1); p.doc.photo.preset = q[0] === 'original' ? null : q[0]; }); redraw(l); syncSliders(); FS.toast('🎨 ' + q[1] + ' · ' + l.length + ' תמונות');
  });
  $('#mt-styles', root).addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (!b) return; var l = targets(); l.forEach(function (p) { p.doc.photo.style = b.dataset.st ? { id: b.dataset.st, amt: 100 } : null; }); redraw(l); });

  /* clipart: emoji stickers and a logo, as linked layers in a corner */
  var EMO = '❤️ 💖 💍 👰 🤵 🎂 🎈 🎉 🎁 🥂 🍾 🌹 🌸 🌼 🌿 ⭐ ✨ 🌟 💫 ☀️ 🌙 🌈 🦋 🕊️ 👑 🕶️ 🎩 💋 😍 🥳 😎 👶 🍼 🧸 ✡️ 🕎 🍷 🍯 🍎 ⚽ 🏆 📸 🎵 💯 💐'.split(' ');
  function emoRow(sel) { $(sel, root).innerHTML = EMO.map(function (e) { return '<button data-em="' + e + '">' + e + '</button>'; }).join(''); }
  emoRow('#mt-emo'); emoRow('#mt-oemo');
  function addClip(list, L0) {
    var link = 'mt-clip-' + FS.uid();
    list.forEach(function (p) { var d = p.doc, H = FS.hole(d), m = Math.min(d.w, d.h); var L = Object.assign({ id: FS.uid(), link: link, mtClip: true, x: H.x + H.w - m * 0.12, y: H.y + H.h - m * 0.12, r: 0, opacity: 1 }, L0); if (L.type === 'emoji') L.size = Math.round(m * 0.14); if (L.type === 'image') L.s = m * 0.22 / (L.w0 || 400); d.layers.push(L); });
    redraw(list);
  }
  $('#mt-emo', root).addEventListener('click', function (e) { var b = e.target.closest('[data-em]'); if (b) addClip(targets(), { type: 'emoji', ch: b.dataset.em }); });
  function logoFile(f, list) { FS.fileToDataURL(f).then(function (u) { return FS.loadImg(u); }).then(function (im) { addClip(list, { type: 'image', src: im.src, w0: Math.max(im.naturalWidth, im.naturalHeight) }); }); }
  $('#mt-logo', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) logoFile(f, targets()); });
  $('#mt-clipdel', root).addEventListener('click', function () { var l = targets(); l.forEach(function (p) { p.doc.layers = p.doc.layers.filter(function (L) { return !L.mtClip; }); }); redraw(l); });

  /* ---------- saved edits: copy / paste, "like the previous photo", and named looks kept for next time ----------
     A look is what an edit is, without what belongs to one picture (crop, faces, blur spots, AI): the colour correction,
     the effect, the instant style, the background mode, the frame, the title and the clipart (placed by share of the page).
     The looks live in localStorage 'fs-mate-looks'; the copied edit in 'fs-mate-clip', so it also crosses sessions. */
  function lookOf(p) {
    var d = p.doc, ph = d.photo, m = Math.min(d.w, d.h), bg = ph.bg && ph.bg.mode !== 'none' && ph.bg.mode !== 'image' ? { mode: ph.bg.mode, color: ph.bg.color, amount: ph.bg.amount } : null;
    var layers = d.layers.filter(function (L) { return L.link === 'mt-title' || L.mtClip; }).map(function (L) {
      var n = JSON.parse(JSON.stringify(L)); delete n.id; n.fx = L.x / d.w; n.fy = L.y / d.h; if (L.size != null) n.fsize = L.size / m; if (L.s != null) n.fs = L.s / m; return n;
    });
    return { adj: Object.assign({}, ph.adj), preset: ph.preset || null, style: ph.style || null, bg: bg, frame: d.frame ? JSON.parse(JSON.stringify(d.frame)) : null, layers: layers };
  }
  function lookOn(list, k) {
    if (!k || !list.length) return Promise.resolve();
    return Promise.all(list.map(function (p) { return FS.loadImg(p.src).catch(function () {}); })).then(function () {
      return Promise.all(list.map(function (p) {
        var d = p.doc, ph = d.photo, m = Math.min(d.w, d.h);
        ph.adj = Object.assign({}, FS.ADJ0, k.adj); ph.preset = k.preset || null; ph.style = k.style ? JSON.parse(JSON.stringify(k.style)) : null;
        var fr = k.frame && k.frame.kind === 'png' && !(FS.USER_FRAMES || {})[k.frame.id] ? null : k.frame;
        FS.setFrame(p, fr ? JSON.parse(JSON.stringify(fr)) : null, { quiet: true, noTexts: true }); if (p.fit) FS.fitPhoto(d, FS.img(p.src), p.fit);
        d.layers = d.layers.filter(function (L) { return !(L.link === 'mt-title' || L.mtClip); });
        (k.layers || []).forEach(function (L) {
          var n = JSON.parse(JSON.stringify(L)); n.id = FS.uid(); n.x = L.fx * d.w; n.y = L.fy * d.h; if (L.fsize != null) n.size = L.fsize * m; if (L.fs != null) n.s = L.fs * m;
          delete n.fx; delete n.fy; delete n.fsize; delete n.fs; d.layers.push(n);
        });
        if (k.bg) return bgSet(p, k.bg.mode, { color: k.bg.color, amount: k.bg.amount }).catch(function () {});
        if (ph.bg && ph.bg.mode !== 'none') ph.bg = Object.assign({}, ph.bg, { mode: 'none' });
      }));
    }).then(function () { redraw(list); syncSliders(); });
  }
  function looks() { return lsj('fs-mate-looks', []); }
  function looksSave(l) { try { localStorage.setItem('fs-mate-looks', JSON.stringify(l)); return true; } catch (e) { FS.toast('אין מקום לשמור. מוחקים מצב ישן או לוגו גדול.'); return false; } }
  function buildLooks() {
    var l = looks(), c = lsj('fs-mate-clip', null);
    $('#mt-looks', root).innerHTML = l.length ? l.map(function (k, i) { return '<div class="mt-look"><button class="mt-btn" data-look="' + i + '">✨ ' + esc(k.name) + '</button><button class="mt-ic" data-lookx="' + i + '" title="מחיקה">✕</button></div>'; }).join('') : '<p class="mt-hint">עוד אין מצבים שמורים.</p>';
    $('#mt-lclip', root).textContent = c ? '📋 מועתקת עריכה של "' + (c.from || 'תמונה') + '"' : '';
  }
  $('#mt-lcopy', root).addEventListener('click', function () { var p = focus(); if (!p) return; var k = lookOf(p); k.from = String(p.name || '').replace(/\.[^.]+$/, ''); try { localStorage.setItem('fs-mate-clip', JSON.stringify(k)); } catch (e) { FS.toast('העריכה גדולה מדי להעתקה'); return; } buildLooks(); FS.toast('📋 העריכה הועתקה · בוחרים תמונות ולוחצים "הדבקה"'); });
  $('#mt-lpaste', root).addEventListener('click', function () { var k = lsj('fs-mate-clip', null); if (!k) return FS.toast('קודם מעתיקים עריכה'); var l = targets(); lookOn(l, k).then(function () { FS.toast('📥 העריכה הודבקה על ' + l.length + ' תמונות'); }); });
  $('#mt-lprev', root).addEventListener('click', function () {
    var l = targets(), done = 0;
    l.reduce(function (ch, p) { return ch.then(function () { var i = idx(p); if (i < 1) return; done++; return lookOn([p], lookOf(S.photos[i - 1])); }); }, Promise.resolve())
      .then(function () { FS.toast(done ? '⤺ ' + done + ' תמונות קיבלו את העריכה של התמונה שלפניהן' : 'אין תמונה קודמת'); });
  });
  $('#mt-lsave', root).addEventListener('click', function () {
    var p = focus(); if (!p) return; var n = $('#mt-lname', root).value.trim() || 'מצב ' + (looks().length + 1), l = looks().filter(function (k) { return k.name !== n; });
    var k = lookOf(p); k.name = n; k.at = Date.now(); l.unshift(k);
    if (looksSave(l.slice(0, 40))) { $('#mt-lname', root).value = ''; buildLooks(); FS.toast('💾 מצב העריכה "' + n + '" נשמר'); }
  });
  $('#mt-looks', root).addEventListener('click', function (e) {
    var x = e.target.closest('[data-lookx]'), b = e.target.closest('[data-look]'), l = looks();
    if (x) { var k0 = l[Number(x.dataset.lookx)]; if (k0 && confirm('למחוק את "' + k0.name + '"?')) { l.splice(Number(x.dataset.lookx), 1); looksSave(l); buildLooks(); } return; }
    if (!b) return; var k = l[Number(b.dataset.look)], t = targets(); lookOn(t, k).then(function () { FS.toast('✨ "' + k.name + '" הוחל על ' + t.length + ' תמונות'); });
  });
  FS.mateLooks = { of: lookOf, apply: lookOn };
  $('#mt-dcopy', root).addEventListener('click', function () { $('#mt-lcopy', root).click(); });
  $('#mt-dpaste', root).addEventListener('click', function () { var k = lsj('fs-mate-clip', null), p = focus(); if (!k) return FS.toast('קודם מעתיקים עריכה'); if (p) lookOn([p], k).then(function () { drawDesign(); FS.toast('📥 העריכה הודבקה'); }); });

  function saveOne(p) {
    var keep = S.cur; S.cur = idx(p); try { FS.saveCurrent(); } finally { S.cur = keep; }
  }

  /* ---------- עורך מלא: one photo, a folder browser, tools underneath ---------- */
  var cv = $('#mt-cv', root), cvx = cv.getContext('2d'), dk = 1, drag = null, selL = null, dfit = 'cover';
  function dcur() { return focus(); }
  function localChips() { return LOCAL.concat(FS.LOCAL_PLUS || []).map(function (x) { return '<button data-la="' + x[0] + '">' + x[1] + '</button>'; }).join('') + (FS.FUN_FX ? '<span class="mt-chsep">😜 מצחיקים</span>' + FS.FUN_FX.map(function (x) { return '<button data-fun="' + x[0] + '">' + x[1] + '</button>'; }).join('') : ''); }
  function buildDesign() {
    var dai = $('#mt-dai', root); if (dai && !dai.children.length) dai.innerHTML = localChips();
    var p = dcur(); if (p) { focusId = p.id; S.cur = idx(p); }
    $('#mt-dframe', root).innerHTML = frameOptions().map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[0] ? f[1] : 'מסגרת: בלי') + '</option>'; }).join('');
    var fr = p && p.doc.frame; $('#mt-dframe', root).value = !fr ? '' : (fr.kind === 'png' ? 'u:' : 'g:') + fr.id;
    $('#mt-dfilm', root).innerHTML = [['', 'אפקט פילם'], ['portra', 'פורטרה'], ['fuji', 'פוג׳י'], ['kodak', 'קודאק'], ['airy', 'אוורירי'], ['moody', 'מלנכולי'], ['sepia', 'ספיה'], ['bwwarm', 'שחור־לבן חם'], ['none', 'בלי']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    $('#mt-dpre', root).innerHTML = '<option value="">מסננים</option>' + FS.PRESETS.map(function (q) { return '<option value="' + q[0] + '">' + esc(q[1]) + '</option>'; }).join('');
    $('#mt-dsz', root).innerHTML = '<option value="">שינוי גודל</option>' + FS.mySizes().map(function (z) { return '<option value="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</option>'; }).join('');
    $('#mt-crops', root).innerHTML = FS.mySizes().map(function (z) { return '<button data-cz="my:' + z.id + '">' + esc(FS.sizeLabel(z)) + '</button>'; }).join('') + '<button data-cz="orig">כמו המקור</button>';
    $('#mt-ofont', root).innerHTML = fonts;
    dsliders(); proj(); drawDesign();
  }
  var DSL = [['brightness', 'בהירות'], ['contrast', 'ניגודיות'], ['saturation', 'רוויה'], ['temp', 'חום'], ['highlights', 'אורות'], ['shadows', 'צללים']];
  function dsliders() {
    var p = dcur(), a = p ? p.doc.photo.adj : FS.ADJ0;
    $('#mt-dsl', root).innerHTML = DSL.map(function (s) { return '<label><span>' + s[1] + '</span><input type="range" min="-100" max="100" data-dk="' + s[0] + '" value="' + (a[s[0]] || 0) + '"></label>'; }).join('');
  }
  $('#mt-dsl', root).addEventListener('input', function (e) { var r = e.target.closest('[data-dk]'); var p = dcur(); if (!r || !p) return; p.doc.photo.adj[r.dataset.dk] = Number(r.value); drawDesign(true); });
  $('#mt-dsl', root).addEventListener('change', function () { var p = dcur(); if (p) { FS.snap(p); drawDesign(); } });
  function drawDesign(fast) {
    if (view !== 'design' || !on()) return;
    var p = dcur(), wrap = $('#mt-cvw', root), W = wrap.clientWidth || 800, H = wrap.clientHeight || 500;
    var lk = $('#mt-dlock', root), kp = $('#mt-dkeep', root); if (lk) { lk.textContent = FS.photoLocked(p) ? '🔓' : '🔒'; lk.classList.toggle('on', FS.photoLocked(p)); lk.title = FS.photoLocked(p) ? 'שחרור התמונה' : 'נעילת התמונה במקומה'; } if (kp) kp.classList.toggle('on', FS.prefs.keepIn !== false);
    $('#mt-dname', root).textContent = p ? (p.name || '') + ' · ' + (idx(p) + 1) + '/' + S.photos.length : 'אין תמונה. פותחים תיקייה או מוסיפים תמונות.';
    $('#mt-dnavp', root).disabled = !p || idx(p) <= 0; $('#mt-dnavn', root).disabled = !p || idx(p) >= S.photos.length - 1;
    $('#mt-dsize', root).textContent = p ? sizeTxt(p) + ' ס״מ' : '';
    if (!p) { cv.width = 10; cv.height = 10; return; }
    if (!FS.img(p.src)) { FS.loadImg(p.src).then(function () { drawDesign(); }); return; }
    var d = p.doc, f0 = $('#mt-cv0f', root); f0.hidden = !cmp; wrap.classList.toggle('two', cmp);
    dk = Math.min(((cmp ? W / 2 : W) - 36) / d.w, (H - 52) / d.h);
    var dpr = window.devicePixelRatio || 1; cv.width = Math.round(d.w * dk * dpr); cv.height = Math.round(d.h * dk * dpr); cv.style.width = Math.round(d.w * dk) + 'px'; cv.style.height = Math.round(d.h * dk) + 'px';
    FS.draw(cvx, p, { scale: dk * dpr, max: fast ? 900 : 2200, fast: !!fast, sel: selL });
    if (cmp && !fast) {
      var o = p.origSrc || p.src;
      if (!FS.img(o)) FS.loadImg(o).then(function () { drawDesign(); }, function () {});
      else { var oc = origCanvas(p, Math.max(d.w, d.h) * dk * dpr), c0 = $('#mt-cv0', root); c0.width = oc.width; c0.height = oc.height; c0.style.width = cv.style.width; c0.style.height = cv.style.height; c0.getContext('2d').drawImage(oc, 0, 0); }
    }
  }
  function proj() {
    var box = $('#mt-proj', root), f = dcur();
    box.innerHTML = S.photos.map(function (p) { return '<button class="mt-pj' + (f === p ? ' on' : '') + '" data-id="' + p.id + '" data-px="96"><span class="mt-th"></span><i>' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '</i></button>'; }).join('');
    $$('.mt-pj', box).forEach(function (b) { b.classList.add('mt-tile'); watch(b); });
  }
  $('#mt-proj', root).addEventListener('click', function (e) { var b = e.target.closest('.mt-pj'); if (!b) return; focusId = b.dataset.id; selL = null; buildDesign(); });
  function step(n) { var p = dcur(), i = idx(p) + n; if (i < 0 || i >= S.photos.length) return; focusId = S.photos[i].id; selL = null; buildDesign(); slide($('#mt-cvw', root), n); }
  $('#mt-dnavp', root).addEventListener('click', function () { step(-1); });
  $('#mt-dnavn', root).addEventListener('click', function () { step(1); });
  $('#mt-dcmp', root).addEventListener('click', function () { setCmp(!cmp); });
  $('#mt-prev', root).addEventListener('click', function () { step(-1); });
  $('#mt-next', root).addEventListener('click', function () { step(1); });
  window.addEventListener('resize', function () { if (on() && view === 'design') drawDesign(); });
  function docXY(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / dk, y: (e.clientY - r.top) / dk }; }
  cv.addEventListener('pointerdown', function (e) {
    var p = dcur(); if (!p) return; var q = docXY(e), L = FS.hitLayer(p.doc, q.x, q.y);
    if (!L && FS.photoLocked(p)) { selL = null; FS.lockToast(); drawDesign(true); return; }
    selL = L || null; drag = { x: q.x, y: q.y, L: L, px: p.doc.photo.x, py: p.doc.photo.y, lx: L ? L.x : 0, ly: L ? L.y : 0 };
    cv.setPointerCapture(e.pointerId); drawDesign(true);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return; var p = dcur(), q = docXY(e), dx = q.x - drag.x, dy = q.y - drag.y;
    if (drag.L) { drag.L.x = drag.lx + dx; drag.L.y = drag.ly + dy; } else { p.doc.photo.x = drag.px + dx; p.doc.photo.y = drag.py + dy; FS.keepIn(p.doc, FS.img(p.src)); }
    drawDesign(true);
  });
  cv.addEventListener('pointerup', function () { if (!drag) return; drag = null; var p = dcur(); if (p) { FS.snap(p); drawDesign(); } });
  cv.addEventListener('wheel', function (e) {
    var p = dcur(); if (!p) return; e.preventDefault(); var f = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    if (selL) { if (selL.type === 'text' || selL.type === 'emoji') selL.size = Math.max(6, selL.size * f); else if (selL.s) selL.s *= f; }
    else if (FS.photoLocked(p)) return FS.lockToast();
    else { p.doc.photo.s *= f; FS.keepIn(p.doc, FS.img(p.src)); }
    drawDesign(true); clearTimeout(endT); endT = setTimeout(function () { FS.snap(p); drawDesign(); }, 300);
  }, { passive: false });
  function dchange(fn) { var p = dcur(); if (!p) return; return Promise.resolve(FS.loadImg(p.src)).then(function () { fn(p, p.doc.photo.adj); p.cache = {}; FS.snap(p); dsliders(); drawDesign(); }); }
  $$('[data-d]', root).forEach(function (b) { b.addEventListener('click', function () {
    var k = b.dataset.d;
    dchange(function (p, a) {
      var d = p.doc, im = FS.img(p.src);
      if (k === 'auto') p.doc.photo.adj = Object.assign({}, a, FS.autoAdjust(p));
      else if (k === 'sharp') a.sharpen = Math.min(100, (a.sharpen || 0) + 20);
      else if (k === 'clear') { a.clarity = Math.min(100, (a.clarity || 0) + 15); a.dehaze = Math.min(100, (a.dehaze || 0) + 10); }
      else if (k === 'back') { a.shadows = Math.min(100, (a.shadows || 0) + 35); a.highlights = Math.max(-100, (a.highlights || 0) - 20); a.exposure = Math.min(100, (a.exposure || 0) + 6); }
      else if (k === 'rl' || k === 'rr') { d.photo.r = ((d.photo.r || 0) + (k === 'rr' ? 90 : -90)) % 360; FS.fitPhoto(d, im, p.fit || dfit); }
      else if (k === 'lock') { var on = !d.photo.lock; (marked().length ? marked() : [p]).forEach(function (q) { q.doc.photo.lock = on; if (q !== p) FS.snap(q); }); FS.toast(on ? '🔒 התמונה נעולה במקומה' : '🔓 התמונה משוחררת', 2200); }
      else if (k === 'keep') { FS.prefs.keepIn = FS.prefs.keepIn === false; FS.savePrefs(); if (FS.prefs.keepIn) FS.keepIn(d, im); FS.toast(FS.prefs.keepIn ? '📐 התמונה לא תצא מגבולות הדף' : 'התמונה חופשית לצאת מהדף', 2500); }
      else if (k === 'fh') d.photo.fh = !d.photo.fh;
      else if (k === 'fv') d.photo.fv = !d.photo.fv;
    });
  }); });
  $('#mt-dframe', root).addEventListener('change', function () { var v = this.value; dchange(function (p) { FS.setFrame(p, frameRef(v, $('#mt-fcol', root).value), { quiet: true }); if (p.fit) FS.fitPhoto(p.doc, FS.img(p.src), p.fit); }); });
  $('#mt-dfilm', root).addEventListener('change', function () { var v = this.value; if (!v) return; dchange(function (p, a) { a.tone = v; }); this.value = ''; });
  $('#mt-dpre', root).addEventListener('change', function () { var v = this.value; if (!v) return; var q = FS.PRESETS.filter(function (x) { return x[0] === v; })[0]; dchange(function (p) { p.doc.photo.adj = FS.presetAdj(q[2], 1); p.doc.photo.preset = v === 'original' ? null : v; }); this.value = ''; });
  $('#mt-dsz', root).addEventListener('change', function () { var z = FS.sizeOf(this.value); this.value = ''; if (z) dchange(function (p) { toSize(p, z, p.fit || dfit, true); }); });
  $('#mt-crops', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-cz]'); if (!b) return;
    dchange(function (p) { if (b.dataset.cz === 'orig') { var im = FS.img(p.src); FS.applyFormat(p.doc, 'orig', im); if (p.doc.frame) FS.setFrame(p, p.doc.frame, { quiet: true, noTexts: true }); } else toSize(p, FS.sizeOf(b.dataset.cz), dfit, false); });
  });
  $('#mt-cfit', root).addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; dfit = b.dataset.f; seg('#mt-cfit', dfit, 'f'); dchange(function (p) { FS.fitPhoto(p.doc, FS.img(p.src), dfit); p.fit = dfit; }); });
  $('#mt-cface', root).addEventListener('click', function () { var p = dcur(); if (!p) return; FS.smartFit(p).then(function (n) { p.cache = {}; FS.snap(p); drawDesign(); FS.toast(n ? '🎯 ' + n + ' פנים במרכז' : 'לא נמצאו פנים'); }); });
  $('#mt-oadd', root).addEventListener('click', function () {
    var t = $('#mt-otext', root).value.trim(); if (!t) return FS.toast('כותבים טקסט');
    dchange(function (p) { var d = p.doc; var L = { id: FS.uid(), type: 'text', text: t, size: Math.round(Math.min(d.w, d.h) * 0.07), font: $('#mt-ofont', root).value, weight: 700, color: $('#mt-ocol', root).value, shadow: true, x: d.w / 2, y: d.h * 0.85, r: 0, opacity: 1, align: 'center', strokeW: 0, stroke: '#000000', spacing: 0 }; d.layers.push(L); selL = L; });
  });
  $('#mt-oemo', root).addEventListener('click', function (e) { var b = e.target.closest('[data-em]'); if (!b) return; dchange(function (p) { var d = p.doc, L = { id: FS.uid(), type: 'emoji', ch: b.dataset.em, size: Math.round(Math.min(d.w, d.h) * 0.14), x: d.w / 2, y: d.h / 2, r: 0, opacity: 1 }; d.layers.push(L); selL = L; }); });
  $('#mt-ologo', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; var p = dcur(); if (f && p) logoFile(f, [p]); setTimeout(drawDesign, 300); });
  $('#mt-odel', root).addEventListener('click', function () { if (!selL) return FS.toast('לוחצים על עצם בתמונה כדי לבחור אותו'); var L = selL; dchange(function (p) { p.doc.layers = p.doc.layers.filter(function (x) { return x !== L; }); selL = null; }); });
  $$('.mt-dtools [data-dt]', root).forEach(function (b) { b.addEventListener('click', function () { $$('.mt-dtools [data-dt]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); $$('[data-dp]', root).forEach(function (x) { x.hidden = x.dataset.dp !== b.dataset.dt; }); }); });
  $('#mt-dsave', root).addEventListener('click', function () { var p = dcur(); if (p) saveOne(p); });
  $('#mt-dprint', root).addEventListener('click', function () { var p = dcur(); if (p) openPrint([p]); });
  function hist(fn) { var p = dcur(); if (!p) return; var keep = S.marked; S.marked = {}; S.cur = idx(p); try { fn(); } finally { S.marked = keep; } selL = null; dsliders(); drawDesign(); }
  $('#mt-dundo', root).addEventListener('click', function () { hist(FS.undo); });
  $('#mt-dredo', root).addEventListener('click', function () { hist(FS.redo); });
  $('#mt-dall', root).addEventListener('click', function () { if (confirm('לבטל את כל העריכות של התמונה?')) hist(FS.resetEdits); });

  /* the folder browser: subfolders open in place, the photos in a folder show as thumbnails; a click brings one in */
  var dirRoot = null;
  $('#mt-dir', root).addEventListener('click', function () {
    if (!window.showDirectoryPicker) { pickFolder(); return; }
    window.showDirectoryPicker({ id: 'frame-studio-photos' }).then(function (d) { dirRoot = d; $('#mt-tree', root).innerHTML = ''; tree($('#mt-tree', root), d, 0); listDir(d); }).catch(function () {});
  });
  function tree(box, dir, depth) {
    var row = document.createElement('div'); row.className = 'mt-node'; row.style.paddingInlineStart = depth * 14 + 'px';
    row.innerHTML = '<button class="mt-tw">▸</button><button class="mt-dn">📁 ' + esc(dir.name) + '</button><div class="mt-kids" hidden></div>'; box.appendChild(row);
    var kids = row.lastChild, loaded = false;
    row.children[0].addEventListener('click', function () {
      kids.hidden = !kids.hidden; row.children[0].textContent = kids.hidden ? '▸' : '▾'; if (loaded) return; loaded = true;
      var it = dir.values(), subs = [];
      (function next() { it.next().then(function (r) { if (r.done) { subs.sort(function (a, b) { return a.name.localeCompare(b.name, 'he', { numeric: true }); }).forEach(function (s) { tree(kids, s, depth + 1); }); return; } if (r.value.kind === 'directory') subs.push(r.value); next(); }); })();
    });
    row.children[1].addEventListener('click', function () { $$('.mt-dn.on', root).forEach(function (x) { x.classList.remove('on'); }); this.classList.add('on'); listDir(dir); });
  }
  var urls = [];
  function listDir(dir) {
    var box = $('#mt-flist', root); box.innerHTML = '<p class="mt-hint">טוען…</p>'; urls.forEach(URL.revokeObjectURL); urls = [];
    filesOf(dir, false).then(function (files) {
      box.innerHTML = files.length ? '' : '<p class="mt-hint">אין כאן תמונות</p>';
      files.slice(0, 400).forEach(function (f) {
        var b = document.createElement('button'); b.className = 'mt-fi'; b.title = f.name;
        if (IMG_RE.test(f.name) && !/\.(heic|heif)$/i.test(f.name)) { var u = URL.createObjectURL(f); urls.push(u); b.innerHTML = '<img loading="lazy" decoding="async" src="' + u + '" alt=""><i>' + esc(f.name) + '</i>'; }
        else b.innerHTML = '<span>RAW</span><i>' + esc(f.name) + '</i>';
        b.addEventListener('click', function () { var n = S.photos.length; FS.addFiles([f]); var t = setInterval(function () { if (S.photos.length > n) { clearInterval(t); focusId = S.photos[S.photos.length - 1].id; buildDesign(); } }, 120); setTimeout(function () { clearInterval(t); }, 30000); });
        box.appendChild(b);
      });
      if (files.length > 1) { var all = document.createElement('button'); all.className = 'mt-btn'; all.textContent = '➕ כל ' + files.length + ' התמונות לעבודה'; all.addEventListener('click', function () { FS.addFiles(files); }); box.insertBefore(all, box.firstChild); }
    });
  }

  /* ---------- AI ---------- */
  var LOCAL = [
    ['auto', '✨ שיפור אוטומטי'], ['light', '💡 תאורת פנים'], ['skin', '🙂 ריטוש עור'], ['center', '🎯 מרכוז לפי הפנים'], ['full', '🌟 שיפור מלא (תאורה + ריטוש + מרכוז)'],
    ['blur', '🌫️ טשטוש רקע'], ['white', '⬜ רקע לבן'], ['bw', '⚫ רקע שחור־לבן'], ['cut', '✂️ הסרת רקע (שקוף)'], ['nobg', '↩ רקע מקורי'],
    ['faceblur', '🫥 טשטוש פנים'], ['check', '👁️ בדיקת עיניים וחדות'], ['best', '🏆 סימון הטובות']
  ];
  function aiList() { var m = marked(); if (m.length) return m; var f = focus(); return f ? [f] : []; }
  function aiTarget() { var n = aiList().length; $('#mt-ai-target', root).textContent = n ? 'חל על ' + n + (n > 1 ? ' התמונות המסומנות' : ' תמונה (המודגשת)') + '. לסימון כמה, לוחצים ✓ במסך הראשי.' : 'אין תמונות עדיין.'; }
  /* before | after of the photos the AI works on (up to 6), redrawn as results come in */
  function aiBA() {
    var g = $('#mt-aiba', root); if (!g) return; var l = aiList(), shownL = l.slice(0, 6), px = 520;
    var k = {}; $$('.mt-tile', g).forEach(function (el) { k[el.dataset.id + '|' + el.dataset.px] = el; });
    g.style.setProperty('--n', Math.min(3, Math.max(1, shownL.length)));
    var frag = document.createDocumentFragment();
    shownL.forEach(function (p) {
      var el = k[p.id + '|' + px];
      if (!el) { var d = document.createElement('div'); d.innerHTML = '<div class="mt-tile big" data-id="' + p.id + '" data-px="' + px + '"><div class="mt-th"><div class="mt-ba"><div class="mt-b"><span>לפני</span></div><div class="mt-a"><span>אחרי</span></div></div></div><div class="mt-name">' + esc(String(p.name || '').replace(/\.[^.]+$/, '')) + '<i class="mt-aist"></i></div></div>'; el = d.firstChild; }
      frag.appendChild(el);
    });
    g.innerHTML = ''; g.appendChild(frag); $$('.mt-tile', g).forEach(function (el) { el._sig = el._sig || null; watch(el); enqueue(el); });
    $('#mt-aiba-more', root).textContent = l.length > shownL.length ? 'ועוד ' + (l.length - shownL.length) + ' תמונות. רואים את כולן ב"ערוך תמונה" עם לפני | אחרי.' : (l.length ? '' : 'מסמנים תמונות במסך הראשי, או לוחצים על תמונה כדי שתהיה המודגשת.');
  }
  $('#mt-aiba', root).addEventListener('click', function (e) { var t = e.target.closest('.mt-tile'), p = t && byId(t.dataset.id); if (p) big(p); });
  FS.on('doc', function () { if (on() && view === 'ai') $$('#mt-aiba .mt-tile', root).forEach(function (el) { enqueue(el); }); });
  /* every category of the AI view closes; a click on its heading opens it (fold.js) */
  setTimeout(function () { if (FS.foldify) FS.foldify($('.mt-ai', root), 'mate-ai', '.mt-aibac'); }, 0);
  function buildAI() {
    setTimeout(function () { if (FS.foldCount) FS.foldCount($('.mt-ai', root)); }, 50);
    aiTarget(); aiBA();
    $('#mt-ai-local', root).innerHTML = LOCAL.concat(FS.LOCAL_PLUS || []).map(function (x) { return '<button data-la="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    function cards(list, sel, kind) { $(sel, root).innerHTML = list.map(function (v, i) { return '<button data-ai="' + kind + ':' + i + '"><i>' + (kind === 'st' || kind === 'wo' ? v[2] : v[1]) + '</i><span>' + esc(kind === 'st' || kind === 'wo' ? v[1] : v[0]) + '</span></button>'; }).join(''); }
    cards(FS.AI_HEROES || [], '#mt-ai-heroes', 'he'); cards(FS.AI_REAL || [], '#mt-ai-real', 're'); cards(FS.AI_EDITS || [], '#mt-ai-edits', 'ed'); cards(FS.AI_VIRAL || [], '#mt-ai-viral', 'vi'); cards(FS.AI_STYLES || [], '#mt-ai-styles', 'st'); cards(FS.AI_WOW || [], '#mt-ai-wow', 'wo');
    $('#mt-dai', root).innerHTML = localChips();
    $('#mt-ai-fun', root).innerHTML = (FS.FUN_FX || []).map(function (x) { return '<button data-fun="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    engines();
  }
  function engines() {
    var box = $('#mt-ai-eng', root);
    (FS.aiEngines ? FS.aiEngines() : Promise.resolve({})).then(function (av) {
      var cur = FS.aiEngine(), keys = [''].concat(['gemini', 'flux', 'free', 'openai'].filter(function (k) { return av[k]; })); if (FS.localAI) keys.push('local');
      box.innerHTML = keys.map(function (k) { return '<button data-eng="' + k + '"' + (k === cur ? ' class="on"' : '') + '>' + esc((FS.ENGINE_NAMES || {})[k] || k || 'אוטומטי') + '</button>'; }).join('');
    });
  }
  var m1 = $('#mt-one', root); if (m1 && FS.aiOnePerson) { m1.checked = FS.aiOnePerson(); m1.addEventListener('change', function () { FS.aiOnePerson(m1.checked); var o2 = document.getElementById('ax-one'); if (o2) o2.checked = m1.checked; }); }
  var mo = $('#mt-only', root); if (mo && FS.aiOnlyPerson) { mo.checked = FS.aiOnlyPerson(); mo.addEventListener('change', function () { FS.aiOnlyPerson(mo.checked); var o2 = document.getElementById('ax-only'); if (o2) o2.checked = mo.checked; }); }
  var mk = $('#mt-keep', root); if (mk && FS.keepFacesOn) { mk.checked = FS.keepFacesOn(); mk.addEventListener('change', function () { FS.keepFacesOn(mk.checked); var k2 = document.getElementById('ax-keep'); if (k2) k2.checked = mk.checked; }); }
  $('#mt-ai-eng', root).addEventListener('click', function (e) { var b = e.target.closest('[data-eng]'); if (!b) return; if (b.dataset.eng === 'local' && !(FS.localAI && FS.localAI.isReady())) { FS.toast('מנוע ה־AI המקומי עוד לא מותקן'); if (FS.localAI) FS.localAI.open(); return; } FS.aiEngine(b.dataset.eng); engines(); });
  function after(list) { list.forEach(function (p) { p.cache = {}; p._mc = null; }); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); refreshAll(); }
  /* 🧩 puzzles and cubes (crafts.js): from the photos the AI view works on; the pages join the project */
  if (FS.craftsCard) FS.craftsCard($('#mt-crafts', root), { list: function () { return aiList(); }, one: function () { return aiList()[0] || FS.cur(); } });
  function runAI(prompt, label) {
    var l = aiList(); if (!l.length) return FS.toast('אין תמונות');
    $('.mt-aibac', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
    /* each photo's result shows in its pair as soon as it is back */
    var tick = setInterval(function () { if (view === 'ai') $$('#mt-aiba .mt-tile', root).forEach(function (el) { enqueue(el); }); }, 900);
    Promise.resolve(FS.runAI(prompt, label, l)).then(function () { clearInterval(tick); after(l); }, function () { clearInterval(tick); after(l); });
  }
  $('.mt-ai', root).addEventListener('click', function (e) {
    var b = e.target.closest('[data-ai]'); if (!b) return; var k = b.dataset.ai.split(':'), i = Number(k[1]);
    if (k[0] === 'he') runAI(FS.AI_HEROES[i][2], FS.AI_HEROES[i][0]);
    else if (k[0] === 're') runAI(FS.AI_REAL[i][2], FS.AI_REAL[i][0]);
    else if (k[0] === 'ed') runAI(FS.AI_EDITS[i][2], FS.AI_EDITS[i][0]);
    else if (k[0] === 'vi') runAI(FS.AI_VIRAL[i][2] + '.' + (FS.AI_KEEP_FREE || ''), FS.AI_VIRAL[i][0]);
    else if (k[0] === 'st') runAI(FS.AI_STYLES[i][3] + (FS.AI_KEEP || ''), FS.AI_STYLES[i][1]);
    else if (k[0] === 'wo') runAI(FS.AI_WOW[i][3] + (FS.AI_KEEP || ''), FS.AI_WOW[i][1]);
  });
  $('#mt-ai-go', root).addEventListener('click', function () { var t = $('#mt-ai-text', root).value.trim(); if (!t) return FS.toast('כותבים מה לעשות'); runAI('Edit this photo: ' + t + '.' + (FS.AI_KEEP || ''), 'עריכת AI'); });
  $('#mt-ai-back', root).addEventListener('click', function () { var l = aiList(), n = 0; l.forEach(function (p) { if (FS.unstyleStep(p)) n++; }); after(l); FS.toast(n ? '↶ בוטל ב־' + n + ' תמונות' : 'אין עיצוב AI לבטל'); });
  $('#mt-ai-orig', root).addEventListener('click', function () { var l = aiList(), n = 0; l.forEach(function (p) { if (FS.unstyle(p)) n++; }); after(l); FS.toast(n ? '↩ המקור הוחזר ל־' + n + ' תמונות' : 'אין מה להחזיר'); });
  /* the tools that run here, one photo after another, with a stop button */
  function local(k, list) {
    if (!list.length) return FS.toast('אין תמונות');
    if (k === 'best') { if (!FS.scoreAll) return; FS.busy('בוחר את הטובות…'); return Promise.resolve(FS.scoreAll(list)).then(function () { FS.busy(); S.marked = {}; list.forEach(function (p) { if (p.rate && !(p.rate.why || []).length && p.rate.score >= 55) S.marked[p.id] = true; }); after(list); FS.toast('🏆 ' + marked().length + ' תמונות טובות סומנו'); }, function () { FS.busy(); }); }
    var plus = FS.localPlus && FS.localPlus[k];
    if (plus && plus.single) return plus.run(list[0]);   /* one photo at a time (the living photo opens its own viewer) */
    var stop = false, done = 0, bad = 0;
    return list.reduce(function (ch, p, i) {
      return ch.then(function () {
        if (stop) return;
        FS.busy('🖥️ ' + (i + 1) + ' מתוך ' + list.length + '…', function () { stop = true; });
        return FS.loadImg(p.src).then(function () { return plus ? plus(p, i, list.length, function () { return stop; }) : one(k, p); }).then(function (r) { if (r === false) bad++; else done++; }, function () { bad++; });
      });
    }, Promise.resolve()).then(function () {
      FS.busy(); after(list);
      if (k === 'check') { var weak = list.filter(function (p) { return p.quality && !p.quality.ok; }); S.marked = {}; weak.forEach(function (p) { S.marked[p.id] = true; }); refreshAll(); FS.toast(weak.length ? '👁️ ' + weak.length + ' תמונות עם עיניים עצומות או טשטוש סומנו' : '👁️ כל התמונות תקינות', 6000); return; }
      FS.toast((stop ? '⏹ נעצר · ' : '✔ ') + done + ' תמונות' + (bad ? ' · ' + bad + ' בלי פנים או שלא הצליחו' : ''), 5000);
    });
  }
  function bgSet(p, mode, extra) { return FS.ensureMask(p).then(function () { p.doc.photo.bg = Object.assign({ mode: 'none', color: '#ffffff', src: '' }, p.doc.photo.bg, extra || {}, { mode: mode }); FS.snap(p); }); }
  function one(k, p) {
    var a = p.doc.photo.adj;
    if (k === 'auto') { p.doc.photo.adj = Object.assign({}, a, FS.autoAdjust(p)); FS.snap(p); return Promise.resolve(); }
    if (k === 'light') return FS.faceLight(p).then(function (ok) { FS.snap(p); return ok; });
    if (k === 'skin') return FS.findFaces(p, true).then(function (f) { if (!f.length) return false; p.doc.photo.skin = { amt: 40, faces: f.map(function (x) { return { x: x.x, y: x.y, w: x.w, h: x.h }; }) }; FS.snap(p); });
    if (k === 'center') return FS.smartFit(p, true).then(function (n) { FS.snap(p); return n ? true : false; });
    if (k === 'full') return FS.faceLight(p).then(function (ok) { if (!ok) return false; p.doc.photo.skin = { amt: 40, faces: p.faces.map(function (x) { return { x: x.x, y: x.y, w: x.w, h: x.h }; }) }; a.sharpen = Math.max(a.sharpen || 0, 15); return FS.smartFit(p, true).then(function () { FS.snap(p); }); });
    if (k === 'blur') return bgSet(p, 'blur', { amount: 45 });
    if (k === 'white') return bgSet(p, 'color', { color: '#ffffff' });
    if (k === 'bw') return bgSet(p, 'bw');
    if (k === 'cut') return bgSet(p, 'remove');
    if (k === 'nobg') { p.doc.photo.bg = Object.assign({}, p.doc.photo.bg, { mode: 'none' }); FS.snap(p); return Promise.resolve(); }
    if (k === 'faceblur') return FS.findFaces(p, true).then(function (f) { if (!f.length) return false; p.doc.photo.blurs = f.map(function (x) { return { x: x.x - x.w * 0.15, y: x.y - x.h * 0.3, w: x.w * 1.3, h: x.h * 1.45 }; }); FS.snap(p); });
    if (k === 'check') return FS.quality(p);
    return Promise.resolve(false);
  }
  $('#mt-ai-local', root).addEventListener('click', function (e) { var b = e.target.closest('[data-la]'); if (b) local(b.dataset.la, aiList()); });
  /* 😜 the funny effects: each marked photo (or the one on screen), the result in place of the photo (undo / back to the original) */
  function fun(id, list) {
    if (!list.length) return Promise.resolve(FS.toast('אין תמונות'));
    if (!FS.funFx || !FS.putCanvas) return Promise.resolve();
    var stop = false, done = 0, err = null;
    return list.reduce(function (ch, p, i) {
      return ch.then(function () {
        if (stop) return;
        FS.busy('😜 ' + (i + 1) + ' מתוך ' + list.length + '…', function () { stop = true; });
        return FS.loadImg(p.src).then(function (im) { return FS.funFx(id, im); }).then(function (c) { return FS.putCanvas(p, c); }).then(function () { done++; }, function (e) { err = e; });
      });
    }, Promise.resolve()).then(function () {
      FS.busy(); after(list);
      FS.toast(done ? '😜 ' + done + ' תמונות' + (err ? ' · בחלק: ' + FS.funFxMsg(err) : '') : FS.funFxMsg(err), 5000);
    });
  }
  $('#mt-ai-fun', root).addEventListener('click', function (e) { var b = e.target.closest('[data-fun]'); if (b) fun(b.dataset.fun, aiList()); });
  $('#mt-dai', root).addEventListener('click', function (e) {
    var p = dcur(); if (!p) return;
    var f = e.target.closest('[data-fun]'); if (f) return fun(f.dataset.fun, [p]).then(function () { drawDesign(); });
    var b = e.target.closest('[data-la]'); if (b) Promise.resolve(local(b.dataset.la, [p])).then(function () { drawDesign(); });
  });

  /* ---------- print ---------- */
  var PS = Object.assign({ paper: '10x15', dpi: 300, mode: 'real', margin: 0, marginOn: false, marks: false, pfit: 'cover', which: 'auto', msize: '' }, lsj('fs-mate-print', {}));
  /* the magnet's printed size (mm), whatever the photo's own size; '' = the photo's size */
  var MSIZES = [['', 'לפי גודל התמונה'], ['75x100', '7.5×10 ס״מ'], ['50x75', '5×7.5 ס״מ'], ['60x90', '6×9 ס״מ'], ['100x150', '10×15 ס״מ'], ['100x100', '10×10 ס״מ']];
  /* ready layouts: [paper, magnet size, label] */
  var MPRESETS = [['15x20', '75x100', '🧲 4 × 7.5×10 בדף 15×20'], ['10x15', '75x100', '🧲 2 × 7.5×10 בדף 10×15'], ['A4', '75x100', '🧲 4 × 7.5×10 בדף A4'], ['10x15', '50x75', '🧲 4 × 5×7.5 בדף 10×15']];
  function printList(which, only) {
    if (only) return only;
    var l = which === 'all' ? S.photos.slice() : which === 'todo' ? S.photos.filter(function (p) { return !p.printed; }) : which === 'sel' ? marked() : (marked().length ? marked() : S.photos.slice());
    return l.filter(function (p) { return copies(p) > 0; });
  }
  /* page size: each copy alone on a sheet, filling it (crop) or whole inside it (fit); turned to the sheet's direction */
  function pagePlan(list, paperId, pfit, marks) {
    var paper = FS.PAPERS.filter(function (x) { return x[0] === paperId; })[0] || FS.PAPERS[0], pw = paper[2], ph = paper[3], pages = [], total = 0;
    list.forEach(function (p) {
      var n = copies(p), mm = FS.mmOf(p.doc), rot = (mm[0] > mm[1]) !== (pw > ph) && Math.abs(mm[0] - mm[1]) > 1, iw = rot ? mm[1] : mm[0], ih = rot ? mm[0] : mm[1];
      for (var i = 0; i < n; i++) {
        var w = pw, h = ph, cover = pfit === 'cover';
        if (!cover) { var k = Math.min(pw / iw, ph / ih); w = iw * k; h = ih * k; }
        pages.push([{ p: p, x: (pw - w) / 2, y: (ph - h) / 2, w: w, h: h, rot: rot, cover: cover }]); total++;
      }
    });
    return { paper: paper, pages: pages, total: total, marks: marks };
  }
  /* ⚡ the instant print: the printer and the layout are chosen once; then one click prints the marked photos (or the one on
     screen) straight to the printer, no window, at the exact size (the desktop program; a browser still shows its print window) */
  function qpGet() { return lsj('fs-qprint', null); }
  /* the print window's ⭐ saved settings, offered in the instant print too: [{name, o:{paper, msize, …}, printer}] */
  function myPrints() { return lsj('fs-mate-print-my', []).filter(function (m) { return m && m.o && m.o.paper; }); }
  function myChips(id, q) { var l = myPrints(); return l.length ? '<label>⭐ ההגדרות השמורות שלי</label><div class="mp-my" id="' + id + '">' + l.map(function (m, i) { return '<button type="button" class="mt-btn' + (q && m.o.paper === q.paper && (m.o.msize || '') === (q.msize || '') && (m.printer || '') === (q.printer || '') ? ' on' : '') + '" data-qm="' + i + '" title="' + esc(m.printer || 'חלון ההדפסה של המחשב') + '">' + esc(m.name) + '</button>'; }).join('') + '</div>' : ''; }
  function qpList() { var m = marked(); if (m.length) return m; var f = focus(); return f ? [f] : []; }
  function qpPlan(q, list, copies) { return FS.planPrint({ list: list, paper: q.paper, layout: 'fill', margin: 0, gap: 0, copies: copies || 1, size: q.msize ? q.msize.split('x').map(Number) : null }); }
  function qpRun(direct) {
    var q = qpGet(); if (!q) return qpSetup(true);
    var list = qpList(); if (!list.length) return FS.toast('אין תמונה להדפסה');
    if (!direct && !q.noPreview) return qpPreview(q, list);
    qpSend(q, qpPlan(q, list, 1));
  }
  /* the preview before printing: the sheets as they come out (each magnet with its real size), the layout, copies, Enter prints */
  function qpPreview(q, list) {
    var copies = 1, pg = 0, plan = null;
    var b = FS.dialog('🖨️ תצוגה לפני הדפסה', '<div class="qv"><div class="qv-stage"><div class="qv-cv" id="qv-cv"></div><div class="qv-nav"><button class="mt-ic" id="qv-prev" title="הדף הקודם">▶</button><b id="qv-pg"></b><button class="mt-ic" id="qv-next" title="הדף הבא">◀</button></div></div>' +
      '<div class="qv-side"><p class="qv-pr">🖨️ <b>' + esc(q.printer || 'חלון ההדפסה של המחשב') + '</b></p><label>פריסה</label><div class="mp-pre" id="qv-lay">' + MPRESETS.map(function (m, i) { return '<button type="button" class="mt-btn' + (m[0] === q.paper && m[1] === q.msize ? ' on' : '') + '" data-l="' + i + '">' + m[2] + '</button>'; }).join('') + '</div>' + myChips('qv-my', q) +
      '<label>עותקים מכל תמונה</label><div class="qv-cp"><button class="mt-ic" id="qv-minus">−</button><b id="qv-n">1</b><button class="mt-ic" id="qv-plus">+</button></div>' +
      '<div class="qv-sum" id="qv-sum"></div><label class="mt-chk-l"><input type="checkbox" id="qv-skip"> להדפיס מעכשיו בלי התצוגה הזו</label>' +
      '<button class="mt-btn primary qv-go" id="qv-go">🖨️ הדפסה <small>Enter</small></button><button class="mt-btn" id="qv-cancel">ביטול</button></div></div>', true);
    b.classList.add('qv-dlg'); document.getElementById('dlg').addEventListener('close', function () { b.classList.remove('qv-dlg'); done(); }, { once: true });
    function paint() {
      plan = qpPlan(q, list, copies); pg = Math.min(pg, Math.max(0, plan.pages.length - 1));
      var box = $('#qv-cv', b); box.innerHTML = ''; box.appendChild(drawPv(plan, plan.pages[pg], Math.max(300, box.clientWidth - 10 || 520), Math.max(360, (innerHeight * 0.66) | 0)));
      $('#qv-pg', b).textContent = 'דף ' + (plan.pages.length ? pg + 1 : 0) + ' מתוך ' + plan.pages.length; $('#qv-n', b).textContent = copies;
      $('#qv-prev', b).disabled = pg <= 0; $('#qv-next', b).disabled = pg >= plan.pages.length - 1;
      $('#qv-sum', b).innerHTML = '<b>' + plan.total + '</b> מגנטים · <b>' + plan.pages.length + '</b> דפים<br>נייר ' + esc(plan.paper[1]) + ' · מגנט ' + (q.msize ? q.msize.split('x').map(function (v) { return Number(v) / 10; }).join('×') + ' ס״מ' : 'בגודל התמונה');
    }
    $$('[data-l]', b).forEach(function (x) { x.addEventListener('click', function () { var m = MPRESETS[Number(x.dataset.l)]; q = Object.assign({}, q, { paper: m[0], msize: m[1] }); ls('fs-qprint', JSON.stringify(q)); qpBtn(); $$('[data-l]', b).forEach(function (y) { y.classList.toggle('on', y === x); }); pg = 0; paint(); }); });
    $$('[data-qm]', b).forEach(function (x) { x.addEventListener('click', function () {
      var m = myPrints()[Number(x.dataset.qm)]; if (!m) return;
      q = Object.assign({}, q, { paper: m.o.paper, msize: m.o.msize || '', printer: m.printer || '' }); ls('fs-qprint', JSON.stringify(q)); qpBtn();
      $$('[data-qm]', b).forEach(function (y) { y.classList.toggle('on', y === x); }); $$('[data-l]', b).forEach(function (y) { var mm = MPRESETS[Number(y.dataset.l)]; y.classList.toggle('on', mm[0] === q.paper && mm[1] === q.msize); });
      $('.qv-pr b', b).textContent = q.printer || 'חלון ההדפסה של המחשב'; pg = 0; paint(); FS.toast('⭐ ' + m.name);
    }); });
    $('#qv-minus', b).addEventListener('click', function () { copies = Math.max(1, copies - 1); paint(); });
    $('#qv-plus', b).addEventListener('click', function () { copies = Math.min(50, copies + 1); paint(); });
    $('#qv-prev', b).addEventListener('click', function () { pg--; paint(); });
    $('#qv-next', b).addEventListener('click', function () { pg++; paint(); });
    function done() { document.removeEventListener('keydown', key, true); }
    function go() { if ($('#qv-skip', b).checked) { q.noPreview = true; ls('fs-qprint', JSON.stringify(q)); } done(); FS.closeDialog(); qpSend(q, plan); }
    function key(e) {
      if (!document.getElementById('dlg').open) { done(); return; }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); }
      else if (e.key === 'ArrowLeft' && pg < plan.pages.length - 1) { pg++; paint(); }
      else if (e.key === 'ArrowRight' && pg > 0) { pg--; paint(); }
    }
    document.addEventListener('keydown', key, true);
    $('#qv-go', b).addEventListener('click', go);
    $('#qv-cancel', b).addEventListener('click', function () { done(); FS.closeDialog(); });
    setTimeout(paint, 30);
  }
  function qpSend(q, plan) {
    if (!plan.total) return FS.toast('אין מה להדפיס');
    if (window.FSDesktop && FSDesktop.print && q.printer) { if (FS.choosePrinter) FS.choosePrinter(q.printer); else FS.printerChoice(q.printer); }
    else FS.toast('בדפדפן נפתח חלון ההדפסה. בתוכנה למחשב ההדפסה יוצאת ישר למדפסת.', 5000);
    FS.toast('⚡ ' + plan.total + ' מגנטים · ' + plan.pages.length + ' דפים ' + plan.paper[1] + (q.printer ? ' → ' + q.printer : ''), 4000);
    Promise.resolve(FS.doPrint(plan)).then(function () { setTimeout(refreshAll, 400); });
  }
  function qpSetup(thenPrint) {
    var q = qpGet() || { paper: '15x20', msize: '75x100', printer: '' }, pr = FS.printers ? FS.printers() : { up: false, list: [] };
    var b = FS.dialog('⚡ הגדרת הדפסה מיידית', '<p class="mt-hint">בוחרים פעם אחת: מדפסת ופריסה. מעכשיו "⚡ הדפסה מיידית" (או Ctrl+P) מדפיס ישר, בלי חלונות.</p>' +
      '<label>מדפסת</label><select id="qp-printer">' + (pr.up ? pr.list : []).map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.name) + (x.default ? ' ★' : '') + '</option>'; }).join('') + '<option value="">חלון ההדפסה של המחשב</option></select>' +
      (pr.up ? '' : '<p class="mt-hint">⚠️ המדפסות מופיעות בתוכנה למחשב (Windows). בדפדפן ייפתח חלון ההדפסה.</p>') +
      '<label>פריסה</label><div class="mp-pre" id="qp-pre">' + MPRESETS.map(function (m, i) { return '<button type="button" class="mt-btn" data-q="' + i + '">' + m[2] + '</button>'; }).join('') + '</div>' +
      myChips('qp-my', q) + '<p class="mt-hint" id="qp-cur"></p><label class="mt-chk-l"><input type="checkbox" id="qp-pv"' + (q.noPreview ? '' : ' checked') + '> תצוגה מקדימה לפני כל הדפסה</label><div class="mt-row"><button class="mt-btn primary" id="qp-save">' + (thenPrint ? '💾 שמירה והדפסה' : '💾 שמירה') + '</button></div>');
    var cur = { paper: q.paper, msize: q.msize };
    function show() { var m = MPRESETS.filter(function (x) { return x[0] === cur.paper && x[1] === cur.msize; })[0]; $('#qp-cur', b).textContent = m ? 'נבחר: ' + m[2] : 'נבחר: נייר ' + cur.paper + ', מגנט ' + cur.msize; $$('[data-q]', b).forEach(function (x) { var mm = MPRESETS[Number(x.dataset.q)]; x.classList.toggle('on', mm[0] === cur.paper && mm[1] === cur.msize); }); }
    $('#qp-printer', b).value = q.printer && (pr.list || []).some(function (x) { return x.name === q.printer; }) ? q.printer : (pr.chosen ? pr.chosen.name : ((pr.list || []).filter(function (x) { return x.default; })[0] || { name: '' }).name);
    $$('[data-q]', b).forEach(function (x) { x.addEventListener('click', function () { var m = MPRESETS[Number(x.dataset.q)]; cur = { paper: m[0], msize: m[1] }; $$('[data-qm]', b).forEach(function (y) { y.classList.remove('on'); }); show(); }); });
    $$('[data-qm]', b).forEach(function (x) { x.addEventListener('click', function () {
      var m = myPrints()[Number(x.dataset.qm)]; if (!m) return; cur = { paper: m.o.paper, msize: m.o.msize || '' };
      var sel = $('#qp-printer', b); if ($$('option', sel).some(function (o) { return o.value === (m.printer || ''); })) sel.value = m.printer || '';
      $$('[data-qm]', b).forEach(function (y) { y.classList.toggle('on', y === x); }); show();
    }); });
    $('#qp-save', b).addEventListener('click', function () { ls('fs-qprint', JSON.stringify({ printer: $('#qp-printer', b).value, paper: cur.paper, msize: cur.msize, noPreview: !$('#qp-pv', b).checked })); FS.closeDialog(); FS.toast('⚡ ההדפסה המיידית מוכנה'); qpBtn(); if (thenPrint) qpRun(); });
    show();
  }
  /* for other parts of the program (the event hub's automatic line): these photos straight out with the instant print's
     settings, each with its own copies; false when the instant print is not set up yet */
  FS.mate.printList = function (list) { var q = qpGet(); if (!q) { qpSetup(); return false; } list = (list || []).filter(function (p) { return copies(p) > 0; }); if (!list.length) return false; qpSend(q, qpPlan(q, list, 1)); return true; };
  FS.mate.quickReady = function () { return !!qpGet(); };
  function qpBtn() { var q = qpGet(), btn = $('#mt-qprint', root); if (btn) btn.title = q ? 'ישר ל' + (q.printer || 'חלון ההדפסה') + ' · ' + q.paper + ' · מגנט ' + q.msize + ' (Ctrl+P)' : 'הגדרה ראשונה, ואז ישר למדפסת'; }
  $('#mt-qprint', root).addEventListener('click', function () { qpRun(); });
  $('#mt-qset', root).addEventListener('click', function () { qpSetup(false); });
  qpBtn();
  function makePlan(o, only) {
    var list = printList(o.which, only);
    var plan = o.mode === 'page' ? pagePlan(list, o.paper, o.pfit, o.marks)
      : FS.planPrint({ list: list, paper: o.paper, layout: 'fill', margin: o.marginOn ? o.margin : 0, gap: o.marginOn ? 2 : 0, copies: 1, marks: o.marks, size: o.msize ? o.msize.split('x').map(Number) : null });
    plan.dpi = Number(o.dpi) || 300; return plan;
  }
  function drawPv(plan, page, maxW, maxH) {
    var pw = plan.paper[2], ph = plan.paper[3], k = Math.min(maxW / pw, maxH / ph), c = FS.canvas(pw * k, ph * k), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    (page || []).forEach(function (it) {
      var t = it.p._pv && it.p._pvs === sig(it.p, 360) ? it.p._pv : (it.p._pv = pageCanvas(it.p, 360), it.p._pvs = sig(it.p, 360), it.p._pv);
      x.save(); x.beginPath(); x.rect(it.x * k, it.y * k, it.w * k, it.h * k); x.clip();
      x.translate((it.x + it.w / 2) * k, (it.y + it.h / 2) * k); if (it.rot) x.rotate(Math.PI / 2);
      var w = (it.rot ? it.h : it.w) * k, h = (it.rot ? it.w : it.h) * k;
      if (it.cover) { var s = Math.max(w / t.width, h / t.height); x.drawImage(t, -t.width * s / 2, -t.height * s / 2, t.width * s, t.height * s); } else x.drawImage(t, -w / 2, -h / 2, w, h);
      x.restore();
      if (plan.marks) { x.strokeStyle = '#8a8a8a'; x.setLineDash([4, 3]); x.strokeRect(it.x * k, it.y * k, it.w * k, it.h * k); x.setLineDash([]); }
      /* the real printed size on each one, so what comes out is clear before printing */
      var lt = (Math.round(Math.min(it.w, it.h)) / 10) + '×' + (Math.round(Math.max(it.w, it.h)) / 10) + ' ס״מ', fz = Math.max(10, Math.min(15, it.w * k / 8));
      x.font = '700 ' + fz + 'px Heebo, Arial, sans-serif'; var lw = x.measureText(lt).width + 10; x.fillStyle = 'rgba(29,22,51,.78)'; x.fillRect(it.x * k + 4, it.y * k + 4, lw, fz + 8); x.fillStyle = '#fff'; x.textBaseline = 'top'; x.fillText(lt, it.x * k + 9, it.y * k + 8);
    });
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    return c;
  }
  function openPrint(only) {
    if (!S.photos.length) return FS.toast('אין תמונות להדפסה');
    var pr = FS.printers ? FS.printers() : { up: false, list: [] };
    var printers = (pr.up ? pr.list : []).map(function (x) { return '<option value="' + esc(x.name) + '"' + (pr.chosen && pr.chosen.name === x.name ? ' selected' : '') + '>' + esc(x.name) + (x.default ? ' ★' : '') + '</option>'; }).join('') + '<option value=""' + (pr.chosen ? '' : ' selected') + '>חלון ההדפסה של המחשב</option>';
    var papers = FS.PAPERS.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + ' · ' + trim(x[2] / 25.4) + '×' + trim(x[3] / 25.4) + '״</option>'; }).join('');
    /* the window reads top to bottom: what comes out (and the print button), then 1-2-3, then the rarely used settings folded */
    var b = FS.dialog('🖨️ הדפסה', '<div class="mp"><div class="mp-side">' +
      '<div class="mp-sum" id="mp-sum"></div>' +
      '<div class="mp-gos"><button class="mt-btn primary mp-go" id="mp-go">🖨️ הדפסה</button><button class="mt-btn" id="mp-cur" title="רק הדף שבתצוגה">הדף הזה בלבד</button></div>' +
      '<div class="mp-myrow"><span class="mp-k">⭐ ההגדרות שלי</span><div class="mp-my" id="mp-my"></div></div>' +
      (only ? '' : '<section class="mp-step"><h4><i>1</i> מה מדפיסים</h4><select id="mp-which"><option value="auto">המסומנות (ואם אין, כולן)</option><option value="all">כל התמונות</option><option value="todo">רק מה שעוד לא הודפס</option><option value="sel">רק המסומנות</option></select></section>') +
      '<section class="mp-step"><h4><i>' + (only ? 1 : 2) + '</i> מדפסת</h4><select id="mp-printer">' + printers + '</select>' + (pr.up ? '' : '<p class="mt-hint">המדפסות מופיעות בתוכנה למחשב. בדפדפן ייפתח חלון ההדפסה של המחשב.</p>') + '</section>' +
      '<section class="mp-step"><h4><i>' + (only ? 2 : 3) + '</i> גודל ופריסה</h4><div class="mp-pre">' + MPRESETS.map(function (m, i) { return '<button type="button" class="mt-btn" data-mpre="' + i + '">' + m[2] + '</button>'; }).join('') + '</div>' +
        '<div class="mp-two"><label>נייר<select id="mp-paper">' + papers + '</select></label><label>מגנט<select id="mp-msize">' + MSIZES.map(function (z) { return '<option value="' + z[0] + '">' + z[1] + '</option>'; }).join('') + '</select></label></div></section>' +
      '<details class="mp-adv"><summary>⚙️ הגדרות מתקדמות <small>שוליים, קווי חיתוך, התאמה לעמוד, איכות</small></summary>' +
        '<fieldset><legend>איך התמונה יושבת על הדף</legend>' +
          '<label class="mt-chk-l"><input type="radio" name="mp-mode" value="real"> בגודל המגנט האמיתי</label>' +
          '<div class="mp-in"><label class="mt-chk-l"><input type="checkbox" id="mp-mon"> שוליים</label><select id="mp-margin"><option value="2">2 מ״מ</option><option value="3">3 מ״מ</option><option value="5">5 מ״מ</option><option value="8">8 מ״מ</option></select>' +
          '<label>סימוני חיתוך</label><select id="mp-marks"><option value="0">בלי</option><option value="1">קווי חיתוך</option></select></div>' +
          '<label class="mt-chk-l"><input type="radio" name="mp-mode" value="page"> על כל הדף</label>' +
          '<div class="mp-in"><label class="mt-chk-l"><input type="radio" name="mp-fit" value="contain"> כל התמונה נכנסת</label><label class="mt-chk-l"><input type="radio" name="mp-fit" value="cover"> ממלאת את הדף (חיתוך קל)</label></div></fieldset>' +
        '<label class="mp-dpil">איכות<select id="mp-dpi"><option value="300">300 DPI · רגילה</option><option value="600">600 DPI · גבוהה (איטית יותר)</option></select></label>' +
        '<div class="mp-saverow"><input id="mp-name" class="mp-name" placeholder="שם להגדרה, למשל: מגנטים 7.5×10" maxlength="40"><button class="mt-btn" id="mp-save">⭐ שמירה</button></div>' +
      '</details></div>' +
      '<div class="mp-pv"><div class="mp-pvh"><b>תצוגה לפני הדפסה</b><span>כך ייצא הדף מהמדפסת</span></div><div class="mp-cv" id="mp-cv"></div><div class="mp-nav"><button data-nav="first" title="הדף הראשון">|&lt;</button><button data-nav="prev" title="הקודם">&lt;</button><b id="mp-pg">1 / 1</b><button data-nav="next" title="הבא">&gt;</button><button data-nav="last" title="האחרון">&gt;|</button></div></div></div>' +
      '<div class="mp-foot"><button class="mt-btn" id="mp-cancel">סגירה</button></div>', true);
    b.classList.add('mp-dlg');
    $('#mp-paper', b).value = PS.paper; $('#mp-msize', b).value = PS.msize || '';
    $$('[data-mpre]', b).forEach(function (btn) { btn.addEventListener('click', function () { var m = MPRESETS[Number(btn.dataset.mpre)]; $('#mp-paper', b).value = m[0]; $('#mp-msize', b).value = m[1]; $$('[name=mp-mode]', b).forEach(function (r) { r.checked = r.value === 'real'; }); $('#mp-mon', b).checked = false; paint(); }); }); $('#mp-dpi', b).value = String(PS.dpi); $('#mp-margin', b).value = String(PS.margin || 3); $('#mp-mon', b).checked = !!PS.marginOn; $('#mp-marks', b).value = PS.marks ? '1' : '0';
    $$('[name=mp-mode]', b).forEach(function (r) { r.checked = r.value === PS.mode; }); $$('[name=mp-fit]', b).forEach(function (r) { r.checked = r.value === PS.pfit; });
    if ($('#mp-which', b)) $('#mp-which', b).value = PS.which || 'auto';
    var plan = null, pg = 0;
    function read() {
      var mode = ($('[name=mp-mode]:checked', b) || {}).value || 'real';
      return { paper: $('#mp-paper', b).value, msize: $('#mp-msize', b).value, dpi: Number($('#mp-dpi', b).value), mode: mode, margin: Number($('#mp-margin', b).value), marginOn: $('#mp-mon', b).checked, marks: $('#mp-marks', b).value === '1', pfit: ($('[name=mp-fit]:checked', b) || {}).value || 'cover', which: $('#mp-which', b) ? $('#mp-which', b).value : 'auto' };
    }
    function paint() {
      var o = read(); $$('.mp-in', b)[0].classList.toggle('off', o.mode !== 'real'); $$('.mp-in', b)[1].classList.toggle('off', o.mode !== 'page');
      plan = makePlan(o, only); pg = Math.min(pg, Math.max(0, plan.pages.length - 1));
      var box = $('#mp-cv', b); box.innerHTML = ''; box.appendChild(drawPv(plan, plan.pages[pg], Math.max(260, box.clientWidth - 20 || 420), Math.max(320, (innerHeight * 0.62) | 0)));
      $('#mp-pg', b).textContent = (plan.pages.length ? pg + 1 : 0) + ' / ' + plan.pages.length;
      var prn = ($('#mp-printer', b).value || 'חלון ההדפסה של המחשב'), per = plan.pages[0] ? plan.pages[0].length : 0;
      $('#mp-sum', b).innerHTML = plan.total ? '<div class="mp-nums"><div><b>' + plan.total + '</b><small>הדפסים</small></div><div><b>' + plan.pages.length + '</b><small>' + (plan.pages.length === 1 ? 'דף' : 'דפים') + '</small></div><div><b>' + per + '</b><small>בכל דף</small></div></div>' +
        '<p>נייר ' + esc(plan.paper[1]) + (o.msize ? ' · מגנט ' + o.msize.split('x').map(function (v) { return Number(v) / 10; }).join('×') + ' ס״מ' : ' · בגודל התמונה') + '<br>🖨️ ' + esc(prn) + '</p>'
        : '<p class="mp-none">אין מה להדפיס. בוחרים תמונות, או "כל התמונות" למטה.</p>';
      $$('[data-mpre]', b).forEach(function (x) { var m = MPRESETS[Number(x.dataset.mpre)]; x.classList.toggle('on', m[0] === o.paper && m[1] === o.msize && o.mode === 'real'); });
      $('#mp-go', b).textContent = plan.total ? '🖨️ הדפסה · ' + plan.pages.length + (plan.pages.length === 1 ? ' דף' : ' דפים') : '🖨️ הדפסה';
      $('#mp-go', b).disabled = $('#mp-cur', b).disabled = !plan.total;
      PS = o; ls('fs-mate-print', JSON.stringify(PS));   /* remembered as it is, for the next time */
    }
    function myList() { return lsj('fs-mate-print-my', []); }
    function myDraw() {
      var l = myList(), box = $('#mp-my', b);
      box.innerHTML = l.length ? l.map(function (m, i) { return '<span class="mp-mi"><button type="button" class="mt-btn" data-my="' + i + '" title="' + esc(m.printer || 'חלון ההדפסה של המחשב') + '">' + esc(m.name) + '</button><button type="button" class="mp-mx" data-myx="' + i + '" title="מחיקה">×</button></span>'; }).join('') : '<p class="mt-hint">עוד אין. בוחרים הגדרות, ושומרים אותן בשם תחת "⚙️ הגדרות מתקדמות".</p>';
    }
    function setForm(o) {
      $('#mp-paper', b).value = o.paper; $('#mp-msize', b).value = o.msize || ''; $('#mp-dpi', b).value = String(o.dpi || 300); $('#mp-margin', b).value = String(o.margin || 3); $('#mp-mon', b).checked = !!o.marginOn; $('#mp-marks', b).value = o.marks ? '1' : '0';
      $$('[name=mp-mode]', b).forEach(function (r) { r.checked = r.value === (o.mode || 'real'); }); $$('[name=mp-fit]', b).forEach(function (r) { r.checked = r.value === (o.pfit || 'cover'); });
      if ($('#mp-which', b) && o.which) $('#mp-which', b).value = o.which;
    }
    $('#mp-my', b).addEventListener('click', function (e) {
      var x = e.target.closest('[data-myx]'), u = e.target.closest('[data-my]'), l = myList();
      if (x) { l.splice(Number(x.dataset.myx), 1); ls('fs-mate-print-my', JSON.stringify(l)); myDraw(); return; }
      if (!u) return; var m = l[Number(u.dataset.my)]; if (!m) return;
      setForm(m.o); var sel = $('#mp-printer', b);
      if (m.printer !== undefined && sel && $$('option', sel).some(function (op) { return op.value === m.printer; })) { sel.value = m.printer; if (FS.choosePrinter) FS.choosePrinter(m.printer); }
      $$('[data-my]', b).forEach(function (y) { y.classList.toggle('on', y === u); }); pg = 0; paint(); FS.toast('⭐ ' + m.name);
    });
    myDraw();
    $$('select, input', $('.mp-side', b)).forEach(function (el) { el.addEventListener('change', function () { if (el.id === 'mp-printer' && FS.choosePrinter) FS.choosePrinter(el.value); paint(); }); });
    $('.mp-nav', b).addEventListener('click', function (e) { var n = e.target.closest('[data-nav]'); if (!n || !plan) return; var k = n.dataset.nav, L = plan.pages.length - 1; pg = k === 'first' ? 0 : k === 'last' ? L : FS.clamp(pg + (k === 'next' ? 1 : -1), 0, Math.max(0, L)); paint(); });
    function go(one) {
      var o = read(); PS = o; var pl = plan; if (one) pl = { paper: plan.paper, pages: [plan.pages[pg]], total: plan.pages[pg].length, marks: plan.marks, dpi: plan.dpi };
      FS.closeDialog(); Promise.resolve(FS.doPrint(pl)).then(function () { setTimeout(refreshAll, 400); });
    }
    $('#mp-go', b).addEventListener('click', function () { go(false); });
    $('#mp-cur', b).addEventListener('click', function () { go(true); });
    $('#mp-save', b).addEventListener('click', function () {
      PS = read(); ls('fs-mate-print', JSON.stringify(PS));
      var name = ($('#mp-name', b).value || '').trim(); if (!name) { $('#mp-name', b).focus(); return FS.toast('כותבים שם להגדרה'); }
      var l = myList().filter(function (m) { return m.name !== name; }); l.push({ name: name, o: PS, printer: $('#mp-printer', b).value }); ls('fs-mate-print-my', JSON.stringify(l.slice(-12)));
      $('#mp-name', b).value = ''; myDraw(); FS.toast('⭐ נשמר: ' + name);
    });
    $('#mp-cancel', b).addEventListener('click', function () { FS.closeDialog(); });
    requestAnimationFrame(paint);
  }

  /* ---------- keys, events, start ---------- */
  window.addEventListener('keydown', function (e) {
    /* the command bar (hub.js) keeps its own keys: Ctrl+K, and everything typed in it */
    if (((e.ctrlKey || e.metaKey) && e.code === 'KeyK') || (e.target && e.target.closest && e.target.closest('#cmdk'))) return;
    if (e.key === 'F2' || !on() || ($('#dlg') && $('#dlg').open) || document.body.classList.contains('gated') || document.body.classList.contains('fm-on')) return;
    var typing = /input|textarea|select/i.test(e.target.tagName || ''), k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (typing) { if (e.target.classList && e.target.classList.contains('mt-cpin')) return; e.stopImmediatePropagation(); return; }   /* the copies field handles its own keys */
    if (copyKey(e)) { e.stopImmediatePropagation(); return; }
    if (mod && k === 'a') { e.preventDefault(); shown().forEach(function (p) { mark(p, true); }); refreshAll(); }
    else if (mod && k === 'p') { e.preventDefault(); if (e.shiftKey || !qpGet()) openPrint(); else qpRun(); }
    else if (mod && e.shiftKey && k === 'c') { e.preventDefault(); $('#mt-lcopy', root).click(); }
    else if (mod && e.shiftKey && k === 'v') { e.preventDefault(); $(view === 'design' ? '#mt-dpaste' : '#mt-lpaste', root).click(); }
    else if (mod && k === 'z') { e.preventDefault(); if (view === 'design') hist(FS.undo); else { FS.undo(); refreshAll(); } }
    else if (mod && k === 'y') { e.preventDefault(); if (view === 'design') hist(FS.redo); else { FS.redo(); refreshAll(); } }
    else if (k === 'escape') { S.marked = {}; refreshAll(); if (view === 'edit') targetTxt(); }
    else if (view === 'edit' && (k === 'pagedown' || k === 'pageup')) { e.preventDefault(); ePageGo(k === 'pagedown' ? 1 : -1); }
    else if (view === 'edit' && FS.mateKeys && FS.mateKeys(k, e)) { /* handled */ }
    else if (view === 'design' && (k === 'arrowleft' || k === 'arrowright')) step(k === 'arrowleft' ? 1 : -1);
    else if (view === 'design' && (k === 'delete' || k === 'backspace') && selL) $('#mt-odel', root).click();
    e.stopImmediatePropagation();
  }, true);
  FS.on('photos-added', function () { if (on()) refreshAll(); else if (ls('fs-mate') !== 'off') open('main'); });
  FS.on('print-job', function () { if (on()) setTimeout(refreshAll, 300); });
  FS.on('sizes', function () { if (on() && view === 'design') buildDesign(); });
  /* the workspace is where the studio opens, unless the owner closed it last time */
  cmpSync();
  if (ls('fs-mate') !== 'off') open('main');
})();
