// תשתית סליקה. כל ספק מממש:
//   createPayment({ payment, order, apiBase, successUrl, failUrl, notifyUrl }) -> { redirectUrl, providerRef }
//   parseCallback(body) -> { paymentId, approved, providerRef, raw }   (body = שדות הטופס/JSON שחברת הסליקה שלחה)
// פרטי כרטיס אשראי לעולם אינם עוברים בשרת שלנו - הלקוח מועבר לדף תשלום מאובטח (PCI) של חברת הסליקה.
import config from '../config.js';
import PROVIDERS from './providers.js';

function notConfigured(name) {
  return () => {
    throw new Error(`ספק הסליקה "${name}" עדיין לא חובר. יש להשלים את המימוש בקובץ src/payments/index.js ` +
      'לפי התיעוד שתקבלו מחברת הסליקה, ולהוסיף ב-GitHub את הסודות EVENTS_PAYMENT_TERMINAL / EVENTS_PAYMENT_API_KEY');
  };
}

const adapters = {
  mock: {
    createPayment({ payment, apiBase }) {
      return { redirectUrl: `${apiBase}/pay/mock/${payment.id}`, providerRef: `MOCK-${payment.id}` };
    },
    parseCallback(body) {
      return { paymentId: body.paymentId, approved: body.result === 'approved', providerRef: `MOCK-${body.paymentId}`, raw: body };
    },
  },
  // TODO: לחבר לאחר פתיחת חשבון. שלד מוכן - יש לממש לפי תיעוד ה-API שתקבלו.
  tranzila: { createPayment: notConfigured('tranzila'), parseCallback: notConfigured('tranzila') },
  cardcom: { createPayment: notConfigured('cardcom'), parseCallback: notConfigured('cardcom') },
  grow: { createPayment: notConfigured('grow'), parseCallback: notConfigured('grow') },
  payplus: { createPayment: notConfigured('payplus'), parseCallback: notConfigured('payplus') },
};

export function activeProviderId() {
  return adapters[config.payment.provider] ? config.payment.provider : 'mock';
}

export function adapter() {
  return adapters[activeProviderId()];
}

export function providerInfo() {
  const id = activeProviderId();
  return {
    active: id,
    configured: id === 'mock' || Boolean(config.payment.terminal || config.payment.apiKey),
    providers: PROVIDERS,
  };
}

