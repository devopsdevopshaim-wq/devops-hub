/* ארון־פלאן — קריאת ה-PDF: כל עמוד לתמונה, והטקסט עם המיקום של כל מילה (לשליפה ולסימון על התכנית). */
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';

let pdfjsPromise = null;
function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS + 'pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
      return m;
    }).catch((e) => { pdfjsPromise = null; throw new Error('לא הצלחתי לטעון את קורא ה-PDF (' + e.message + ')'); });
  }
  return pdfjsPromise;
}

function canvasBlob(canvas, type = 'image/jpeg', q = 0.9) {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

/* מחזיר לכל עמוד: תמונה, גודל, ופריטי טקסט עם x,y,w,h יחסיים (0..1) ביחס לעמוד */
export async function readPdf(blob, { maxPages = 40, width = 2200, onPage } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const pages = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, width / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const tx = lib.Util.transform(viewport.transform, it.transform);
      const fh = Math.hypot(tx[2], tx[3]) || 10;
      const w = (it.width || 0) * scale;
      /* טקסט מסובב (אנכי בשרטוט) — שומרים את התיבה הכללית */
      const rot = Math.abs(tx[1]) > Math.abs(tx[0]);
      const x = tx[4], y = tx[5];
      const box = rot ? { x: x - fh, y: y - w, w: fh, h: w } : { x, y: y - fh, w, h: fh };
      items.push({ s: it.str, x: box.x / canvas.width, y: box.y / canvas.height, w: box.w / canvas.width, h: box.h / canvas.height, r: rot ? 1 : 0 });
    }
    const img = await canvasBlob(canvas);
    pages.push({ page: i, w: canvas.width, h: canvas.height, items, img });
    if (onPage) onPage(i, n);
  }
  return { pages, total: doc.numPages };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
