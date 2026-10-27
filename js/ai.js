// Client for Chairwise's Meta AI endpoints, plus strict checks on everything the models return.
import { state } from './state.js';
import { CATEGORIES, MILEAGE_RATE } from './categories.js';
import { today, shiftDays, isISODate, round2, newId } from './ui.js';

export const meta = {
  ready: null, // null = not checked yet
  get on() { return state.settings.useAI !== false && this.ready === true && navigator.onLine !== false; },

  async checkServer() {
    if (window.__CHAIRWISE_AI !== undefined) { this.ready = window.__CHAIRWISE_AI; return this.ready; }
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      this.ready = res.ok && (await res.json()).ready === true;
    } catch { this.ready = false; }
    return this.ready;
  },

  async post(path, body, { timeout, type = 'application/json' }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': type },
        body: type === 'application/json' ? JSON.stringify(body) : body,
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } finally { clearTimeout(timer); }
  },

  hear: (wav) => meta.post('/api/hear', wav, { timeout: 20000, type: 'audio/wav' }),
  understand: (text) => meta.post('/api/understand', { text, today: today() }, { timeout: 20000 }),
  readReceipt: (dataURL) => meta.post('/api/read-receipt', { image: dataURL, today: today() }, { timeout: 50000 })
};

const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < max ? v : null);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const safeDate = (d) => (isISODate(d) && d <= shiftDays(today(), 1) && d >= shiftDays(today(), -400) ? d : today());

/** Turn one Muse Spark entry into a ledger entry. Nothing is trusted blindly. */
export function entryFromModel(raw, said, how) {
  const type = ['expense', 'income', 'trip'].includes(raw.type) ? raw.type : 'expense';
  const miles = type === 'trip' ? num(raw.miles, 3000) : null;
  let amount = num(raw.amount, 100000);
  if (type === 'trip') amount = miles ? round2(miles * MILEAGE_RATE) : null;
  const cat = type === 'trip' ? 'mileage' : type === 'income' ? null : (CATEGORIES[raw.category] ? raw.category : 'other');
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.6;
  const warning = text(raw.warning, 220) || null;
  return {
    id: newId(), type, amount: amount === null ? null : round2(amount), miles: miles === null ? null : Math.round(miles * 10) / 10,
    payee: text(raw.payee, 60), description: text(raw.description, 80), purpose: text(raw.purpose, 120),
    payment: raw.payment === 'cash' || raw.payment === 'card' ? raw.payment : null,
    category: cat, date: safeDate(raw.date), said, how, by: 'Muse Spark',
    warning, needsCheck: confidence < 0.75 || Boolean(warning), receiptId: null, fresh: true
  };
}

/** Check a receipt reading before showing it. */
export function cleanReceipt(raw) {
  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .map((l) => ({ label: text(l.label, 80) || 'Item', price: num(l.price, 100000), business: l.business === true, category: CATEGORIES[l.category] ? l.category : 'other', why: text(l.why, 60) }))
    .filter((l) => l.price !== null)
    .slice(0, 80);
  return {
    readable: raw?.readable === true && lines.length > 0,
    store: text(raw?.store, 60),
    date: isISODate(raw?.date) ? raw.date : null,
    payment: raw?.payment === 'cash' || raw?.payment === 'card' ? raw.payment : null,
    subtotal: num(raw?.subtotal, 100000),
    tax: typeof raw?.tax === 'number' && raw.tax >= 0 && raw.tax < 10000 ? raw.tax : null,
    total: num(raw?.total, 100000),
    headline: text(raw?.headline, 140),
    lines
  };
}
