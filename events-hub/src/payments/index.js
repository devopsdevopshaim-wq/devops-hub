// תשתית סליקה. כל ספק מממש:
//   createPayment({ payment, order, successUrl, failUrl, notifyUrl }) -> { redirectUrl, providerRef }
//   parseCallback(req) -> { paymentId, approved, providerRef, raw }
// פרטי כרטיס אשראי לעולם אינם עוברים בשרת שלנו - הלקוח מועבר לדף תשלום מאובטח (PCI) של חברת הסליקה.
const config = require('../config');
const PROVIDERS = require('./providers');

function notConfigured(name) {
  return () => {
    throw new Error(`ספק הסליקה "${name}" עדיין לא חובר. יש להשלים את המימוש בקובץ src/payments/index.js ` +
      'לפי התיעוד שתקבלו מחברת הסליקה, ולהגדיר PAYMENT_TERMINAL / PAYMENT_API_KEY בקובץ .env');
  };
}

const adapters = {
  mock: {
    createPayment({ payment }) {
      return { redirectUrl: `/pay/mock/${payment.id}`, providerRef: `MOCK-${payment.id}` };
    },
    parseCallback(req) {
      const body = { ...req.query, ...req.body };
      return { paymentId: body.paymentId, approved: body.result === 'approved', providerRef: `MOCK-${body.paymentId}`, raw: body };
    },
  },
  // TODO: לחבר לאחר פתיחת חשבון. שלד מוכן - יש לממש לפי תיעוד ה-API שתקבלו.
  tranzila: { createPayment: notConfigured('tranzila'), parseCallback: notConfigured('tranzila') },
  cardcom: { createPayment: notConfigured('cardcom'), parseCallback: notConfigured('cardcom') },
  grow: { createPayment: notConfigured('grow'), parseCallback: notConfigured('grow') },
  payplus: { createPayment: notConfigured('payplus'), parseCallback: notConfigured('payplus') },
};

function activeProviderId() {
  return adapters[config.payment.provider] ? config.payment.provider : 'mock';
}

function adapter() {
  return adapters[activeProviderId()];
}

function providerInfo() {
  const id = activeProviderId();
  return {
    active: id,
    configured: id === 'mock' || Boolean(config.payment.terminal || config.payment.apiKey),
    providers: PROVIDERS,
  };
}

module.exports = { adapter, activeProviderId, providerInfo };
