/* מכלול — הפיכת שרטוטים (PDF ותמונות) לתמונות עמוד: לתצוגה ולניתוח על ידי Claude. */
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

function canvasBlob(canvas, type = 'image/jpeg', q = 0.92) {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

/* כל עמוד ב-PDF לתמונה ברוחב של כ-2400 פיקסלים (מספיק לקרוא טקסט קטן בשרטוט) */
export async function pdfPages(blob, maxPages = 12, width = 2400) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const out = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, width / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const text = (await page.getTextContent()).items.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim();
    out.push({ page: i, blob: await canvasBlob(canvas), text });
  }
  return { pages: out, total: doc.numPages };
}

/* תמונה מוקטנת כ-data URL, לשליחה ל-Claude */
export async function toDataUrl(blob, max = 1600) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}
