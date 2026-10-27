import { state, receiptURL } from '../state.js';
import { category } from '../categories.js';
import { $, $$, esc, usd, niceDay } from '../ui.js';

const FILTERS = [
  ['all', 'All'], ['check', 'Needs a look'], ['expense', 'Expenses'], ['trip', 'Miles'],
  ['income', 'Income'], ['photo', 'With receipt'], ['ai', 'By Meta AI']
];
const matches = {
  all: () => true,
  check: (e) => e.needsCheck,
  expense: (e) => e.type === 'expense',
  trip: (e) => e.type === 'trip',
  income: (e) => e.type === 'income',
  photo: (e) => Boolean(e.receiptId),
  ai: (e) => e.by === 'Muse Spark'
};

export function entryRow(e) {
  const income = e.type === 'income';
  const c = income ? null : category(e.category);
  const tags = [];
  if (e.needsCheck) tags.push('<span class="tag warn">Check</span>');
  if (e.by === 'Muse Spark') tags.push('<span class="tag ai">Meta AI</span>');
  if (e.receiptId) tags.push('<span class="tag ok">Receipt</span>');
  else if (e.type === 'expense' && e.amount >= 75) tags.push('<span class="tag">Add receipt</span>');
  if (e.sample) tags.push('<span class="tag">Sample</span>');
  const badge = e.receiptId
    ? `<span class="badge"><img data-photo="${e.receiptId}" alt=""></span>`
    : income ? '<span class="badge in"><span><small>IN</small>$</span></span>'
    : `<span class="badge"><span><small>LINE</small>${c.line}</span></span>`;
  const title = e.payee || (income ? 'Income' : e.type === 'trip' ? 'Business trip' : 'Who was paid?');
  const sub = e.type === 'trip' ? `${e.miles} mi · ${e.description || e.purpose}` : (e.description || (income ? 'Service income' : c.name));
  return `<button type="button" class="item${e.fresh ? ' fresh' : ''}" data-id="${e.id}">${badge}
    <span class="item-main"><b>${esc(title)}</b><span>${esc(sub)}</span><span class="tags">${tags.join('')}</span></span>
    <span class="amount${income ? ' in' : ''}">${income ? '+' : ''}${usd(e.amount)}<small>${e.type === 'trip' ? 'miles' : e.payment || '—'}</small></span></button>`;
}

export async function fillPhotos(root) {
  for (const img of $$('img[data-photo]', root)) {
    const url = await receiptURL(img.dataset.photo);
    if (url) img.src = url; else img.remove();
  }
}

export async function renderLedger({ edit }) {
  const el = $('#ledger');
  const test = matches[state.filter] || matches.all;
  const list = state.entries.filter(test).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const days = [];
  for (const e of list) { const last = days.at(-1); if (last?.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); }

  el.innerHTML = `
    <div class="row"><h2 class="title">Ledger</h2><button type="button" class="btn quiet" id="add" style="padding:9px 14px;font-size:14px">+ Add</button></div>
    <p class="lede">${state.entries.length} entries · tap one to fix it</p>
    <div class="chips" role="group" aria-label="Filter">${FILTERS.map(([k, label]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${state.filter === k}">${label}</button>`).join('')}</div>
    ${days.length ? days.slice(0, 90).map((d) => {
      const out = d.items.filter((e) => e.type !== 'income').reduce((a, e) => a + e.amount, 0);
      return `<div class="day"><span>${niceDay(d.date)}</span><span class="num">${out ? usd(out) : ''}</span></div><div class="list">${d.items.map(entryRow).join('')}</div>`;
    }).join('') : `<div class="card empty"><h3>${state.entries.length ? 'Nothing here' : 'No entries yet'}</h3><p>${state.entries.length ? 'Try another filter.' : 'Tap the mic and say your first expense.'}</p></div>`}`;

  $$('[data-filter]', el).forEach((b) => (b.onclick = () => { state.filter = b.dataset.filter; renderLedger({ edit }); }));
  $$('.item', el).forEach((b) => (b.onclick = () => edit(state.entries.find((e) => e.id === b.dataset.id))));
  $('#add', el).onclick = () => edit(null);
  await fillPhotos(el);
  state.entries.forEach((e) => { e.fresh = false; });
}
