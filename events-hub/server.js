const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const config = require('./src/config');
const db = require('./src/db');
const { seedIfEmpty } = require('./src/seed');
const payments = require('./src/payments');
const { upload, rateLimit, UPLOAD_DIR } = require('./src/util');

db.load();
seedIfEmpty();

const { router: publicRouter, applyPaymentResult } = require('./src/routes/public');
const adminRouter = require('./src/routes/admin');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);

// ---------- AI: הסרת רקע (remove.bg) ----------
app.post('/api/ai/remove-bg', rateLimit({ windowMs: 60_000, max: 10 }), upload.single('file'), async (req, res) => {
  const cleanup = () => req.file && fs.unlink(req.file.path, () => {});
  if (!config.ai.removeBgKey) { cleanup(); return res.status(501).json({ error: 'הסרת רקע AI לא הוגדרה (REMOVE_BG_API_KEY)' }); }
  if (!req.file) return res.status(400).json({ error: 'לא התקבל קובץ' });
  try {
    const form = new FormData();
    form.append('image_file', new Blob([fs.readFileSync(req.file.path)], { type: req.file.mimetype }), 'image');
    form.append('size', 'auto');
    const r = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': config.ai.removeBgKey }, body: form });
    if (!r.ok) throw new Error(`remove.bg ${r.status}`);
    res.type('image/png').send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'שירות ה-AI נכשל', detail: e.message });
  } finally {
    cleanup();
  }
});

// ---------- דפי תשלום ----------
// דף סליקת בדיקה - פעיל רק כאשר PAYMENT_PROVIDER=mock
app.get('/pay/mock/:paymentId', (req, res) => {
  if (payments.activeProviderId() !== 'mock') return res.status(404).end();
  const pay = db.get('payments', req.params.paymentId);
  if (!pay) return res.status(404).send('תשלום לא נמצא');
  res.send(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>סליקת בדיקה</title><link rel="stylesheet" href="/css/app.css"></head><body><main class="wrap narrow">
<div class="card"><div class="badge warn">מצב בדיקה - אין חיוב אמיתי</div><h1>תשלום מאובטח</h1>
<p>סכום לתשלום: <b>₪${pay.amount}</b></p>
<p class="muted">כאן יוצג דף התשלום של חברת הסליקה לאחר החיבור. פרטי האשראי מוזנים אצל חברת הסליקה בלבד ולא נשמרים אצלנו.</p>
<form method="post" action="/pay/mock/${pay.id}"><button class="btn" name="result" value="approved">אישור תשלום (בדיקה)</button>
<button class="btn ghost" name="result" value="declined">דחיית תשלום (בדיקה)</button></form></div></main></body></html>`);
});

app.post('/pay/mock/:paymentId', express.urlencoded({ extended: false }), (req, res) => {
  if (payments.activeProviderId() !== 'mock') return res.status(404).end();
  const r = applyPaymentResult({ paymentId: req.params.paymentId, approved: req.body.result === 'approved', raw: { mock: true } });
  if (!r) return res.status(404).send('תשלום לא נמצא');
  res.redirect(`/pay/return?paymentId=${req.params.paymentId}`);
});

// חזרה מדף התשלום -> מעבר לדף מעקב ההזמנה
app.get('/pay/return', (req, res) => {
  const pay = db.get('payments', String(req.query.paymentId || ''));
  if (!pay) return res.redirect('/');
  const order = db.get('orders', pay.orderId);
  res.redirect(`/track.html?id=${order.id}&t=${order.trackToken}&new=1`);
});

// ---------- קבצים סטטיים ----------
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.get('/admin.html', (req, res) => res.redirect(301, '/admin/'));
app.get('/e/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'event.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'לא נמצא' }));
app.use((err, req, res, _next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || 400);
  res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי' : err.message });
});

if (require.main === module) {
  app.listen(config.port, () => console.log(`השרת פועל: ${config.publicUrl}  |  ניהול: ${config.publicUrl}/admin/`));
}

module.exports = app;
