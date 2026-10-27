// App state + the ledger operations every view uses.
import { store, askForDurableStorage } from './store.js';
import { deductible, category, SE_TAX, LINES, LINE_ORDER } from './categories.js';
import { today } from './ui.js';

export const state = {
  entries: [],
  settings: { key: 'settings', name: '', bracket: 0.12, useAI: true },
  view: 'home',
  filter: 'all',
  taxYear: new Date().getFullYear()
};

let renderer = () => {};
export const onRender = (fn) => { renderer = fn; };
export const rerender = () => renderer();

export async function loadState() {
  await store.init();
  const saved = await store.get('settings', 'settings').catch(() => null);
  if (saved) Object.assign(state.settings, saved);
  state.entries = (await store.all('entries').catch(() => [])) || [];
}

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await store.put('settings', state.settings);
}

/*
 Entry shape:
 { id, type: 'expense'|'income'|'trip', amount, miles, payee, description, payment: 'cash'|'card'|null,
   category, date, purpose, said, how: 'voice'|'typed'|'receipt'|'manual', by: 'Muse Spark'|'on-device'|null,
   warning, needsCheck, receiptId, createdAt, updatedAt, sample }
*/
export async function saveEntry(entry) {
  entry.updatedAt = new Date().toISOString();
  entry.createdAt ||= entry.updatedAt;
  const { fresh, ...stored } = entry;
  await store.put('entries', stored);
  const i = state.entries.findIndex((e) => e.id === entry.id);
  if (i >= 0) state.entries[i] = entry; else state.entries.push(entry);
  askForDurableStorage();
  return entry;
}

const photoURLs = new Map();
export async function receiptURL(receiptId) {
  if (!receiptId) return null;
  if (photoURLs.has(receiptId)) return photoURLs.get(receiptId);
  const r = await store.get('receipts', receiptId);
  if (!r?.blob) return null;
  const url = URL.createObjectURL(r.blob);
  photoURLs.set(receiptId, url);
  return url;
}

export async function saveReceiptPhoto(blob) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  await store.put('receipts', { id, blob, type: blob.type || 'image/jpeg', createdAt: new Date().toISOString() });
  return id;
}

/** Delete a receipt photo unless another entry still points at it (one receipt can feed several entries). */
export async function dropReceiptIfUnused(receiptId, exceptEntryId) {
  if (!receiptId) return;
  if (state.entries.some((e) => e.receiptId === receiptId && e.id !== exceptEntryId)) return;
  await store.remove('receipts', receiptId);
  const url = photoURLs.get(receiptId);
  if (url) URL.revokeObjectURL(url);
  photoURLs.delete(receiptId);
}

export async function deleteEntry(id) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;
  await dropReceiptIfUnused(entry.receiptId, id);
  await store.remove('entries', id);
  state.entries = state.entries.filter((e) => e.id !== id);
}

export async function wipeEverything() {
  await store.clear('entries');
  await store.clear('receipts');
  photoURLs.forEach((u) => URL.revokeObjectURL(u));
  photoURLs.clear();
  state.entries = [];
}

// Money math
export function summarize(list) {
  const s = { income: 0, cash: 0, card: 0, spent: 0, deductions: 0, miles: 0 };
  for (const e of list) {
    if (e.type === 'income') {
      s.income += e.amount;
      if (e.payment === 'cash') s.cash += e.amount; else s.card += e.amount;
    } else {
      s.spent += e.amount;
      s.deductions += deductible(e);
      if (e.type === 'trip') s.miles += e.miles || 0;
    }
  }
  s.profit = s.income - s.deductions;
  s.seTax = Math.max(0, s.profit) * SE_TAX;
  return s;
}

export const inYear = (y) => state.entries.filter((e) => e.date.startsWith(String(y)));
export const inMonth = (iso = today()) => state.entries.filter((e) => e.date.slice(0, 7) === iso.slice(0, 7));

export function scheduleC(year) {
  const list = inYear(year);
  const byLine = {};
  for (const e of list) {
    if (e.type === 'income') continue;
    const line = category(e.category).line;
    byLine[line] = (byLine[line] || 0) + deductible(e);
  }
  const lines = LINE_ORDER.filter((l) => byLine[l]).map((l) => ({ line: l, name: LINES[l], amount: byLine[l] }));
  const s = summarize(list);
  return {
    year, lines,
    gross: s.income,
    total: lines.reduce((a, l) => a + l.amount, 0),
    net: s.income - lines.reduce((a, l) => a + l.amount, 0),
    miles: s.miles,
    count: list.length,
    withPhoto: list.filter((e) => e.receiptId).length
  };
}
