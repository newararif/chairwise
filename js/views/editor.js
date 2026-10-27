// Add or fix one entry by hand.
import { state, saveEntry, deleteEntry, receiptURL, saveReceiptPhoto, dropReceiptIfUnused, rerender } from '../state.js';
import { CATEGORIES, category, MILEAGE_RATE } from '../categories.js';
import { $, $$, esc, openSheet, closeSheet, toast, buzz, today, shiftDays, niceDay, clock, round2, newId, shrinkPhoto, isISODate } from '../ui.js';

let draft = null;

export function openEditor(entry, { preset, photo } = {}) {
  draft = entry
    ? { ...entry }
    : { id: newId(), type: 'expense', amount: '', miles: null, payee: '', description: '', purpose: '', payment: null, category: 'supplies', date: today(), said: '', how: 'manual', by: null, warning: null, needsCheck: false, receiptId: null, isNew: true };
  if (preset) Object.assign(draft, preset);
  if (photo) { draft.newPhoto = photo; draft.previewURL = URL.createObjectURL(photo); }
  draw();
}

function collect() {
  const val = (id) => $(`#${id}`)?.value;
  if (val('ed-amount') !== undefined) draft.amount = val('ed-amount');
  if (val('ed-miles') !== undefined) { const m = parseFloat(val('ed-miles')); draft.miles = m > 0 ? m : null; }
  draft.date = val('ed-date') || draft.date;
  for (const [id, key] of [['ed-payee', 'payee'], ['ed-desc', 'description'], ['ed-purpose', 'purpose'], ['ed-cat', 'category']]) {
    if (val(id) !== undefined) draft[key] = val(id).trim();
  }
}

async function draw() {
  const d = draft;
  const isTrip = d.type === 'trip', isIncome = d.type === 'income';
  const photo = d.previewURL || (d.receiptId && !d.removePhoto ? await receiptURL(d.receiptId) : null);
  const heading = `${d.isNew ? 'Add' : 'Fix'} ${isIncome ? 'income' : isTrip ? 'trip' : 'expense'}`;
  openSheet(`
    <h3>${heading}</h3>
    ${d.warning ? `<p class="warning">${esc(d.warning)}</p>` : ''}
    <div class="seg" role="group" aria-label="Kind">${[['expense', 'Expense'], ['trip', 'Miles'], ['income', 'Income']].map(([k, l]) => `<button type="button" data-type="${k}" aria-pressed="${d.type === k}">${l}</button>`).join('')}</div>
    <div class="split">
      ${isTrip
        ? `<div class="field"><label for="ed-miles">Business miles</label><input id="ed-miles" class="money-input" inputmode="decimal" value="${d.miles ?? ''}" placeholder="12"></div>`
        : `<div class="field"><label for="ed-amount">Amount</label><input id="ed-amount" class="money-input" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="${d.amount === '' || d.amount == null ? '' : Number(d.amount).toFixed(2)}"></div>`}
      <div class="field"><label for="ed-date">Date</label><input id="ed-date" type="date" value="${esc(d.date)}" max="${shiftDays(today(), 1)}"></div>
    </div>
    ${isTrip ? `<p class="note">${d.miles ? `${d.miles} mi × 72.5¢ = <b>$${round2(d.miles * MILEAGE_RATE).toFixed(2)}</b>` : '2026 IRS rate: 72.5¢ a mile.'} Driving from home to your usual shop is commuting and doesn't count.</p>`
      : `<div class="field"><span class="label">Paid with</span><div class="seg" role="group" aria-label="Paid with"><button type="button" data-pay="cash" aria-pressed="${d.payment === 'cash'}">Cash</button><button type="button" data-pay="card" aria-pressed="${d.payment === 'card'}">Card / app</button></div></div>`}
    <div class="field"><label for="ed-payee">${isIncome ? 'From (optional)' : isTrip ? 'Where to' : 'Paid to'}</label><input id="ed-payee" autocomplete="off" value="${esc(d.payee)}" placeholder="${isIncome ? 'Walk-ins, regulars' : 'Sally Beauty'}"></div>
    <div class="field"><label for="ed-desc">${isIncome ? 'Note' : isTrip ? 'Trip' : 'What for'}</label><input id="ed-desc" autocomplete="off" value="${esc(d.description)}" placeholder="${isIncome ? 'Saturday cuts' : isTrip ? 'Supply run' : 'Clipper guards'}"></div>
    ${d.type === 'expense' ? `<div class="field"><label for="ed-cat">Tax category</label><select id="ed-cat">${Object.entries(CATEGORIES).filter(([k]) => k !== 'mileage').map(([k, c]) => `<option value="${k}"${k === d.category ? ' selected' : ''}>Line ${c.line} · ${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    ${isIncome ? '' : `<div class="field"><label for="ed-purpose">Business purpose</label><input id="ed-purpose" autocomplete="off" value="${esc(d.purpose)}" placeholder="${esc(category(isTrip ? 'mileage' : d.category).purpose)}"></div>`}
    ${d.type === 'expense' ? `<div class="field"><span class="label">Receipt photo</span><div class="photo-row">${photo ? `<img src="${photo}" alt="Receipt">` : '<span class="none">No photo</span>'}<div class="two-btn"><label class="btn quiet picker">${photo ? 'Replace' : 'Add photo'}<input type="file" id="ed-photo" accept="image/*"></label>${photo ? '<button type="button" class="btn quiet" id="ed-nophoto">Remove</button>' : ''}</div></div></div>` : ''}
    ${d.said ? `<div class="quote">“${esc(d.said)}”<small><span>${d.how === 'voice' ? 'Said' : d.how === 'receipt' ? 'Receipt' : 'Typed'}${d.createdAt ? ` ${niceDay(d.createdAt.slice(0, 10))}, ${clock(d.createdAt)}` : ''}${d.by ? ` · read by ${esc(d.by)}` : ''}</span><span>original, kept</span></small></div>` : ''}
    <p class="note" id="ed-error" role="alert" hidden style="color:var(--red)"></p>
    <div class="two-btn">${d.isNew ? '<button type="button" class="btn quiet" id="ed-cancel">Cancel</button>' : '<button type="button" class="btn danger" id="ed-delete">Delete</button>'}<button type="button" class="btn" id="ed-save">${d.needsCheck && !d.isNew ? 'Looks right' : 'Save'}</button></div>`,
  { onClose: () => { if (draft?.previewURL) URL.revokeObjectURL(draft.previewURL); draft = null; } });

  const sheet = $('#sheet');
  $$('[data-type]', sheet).forEach((b) => (b.onclick = () => { collect(); draft.type = b.dataset.type; if (draft.type === 'trip') draft.category = 'mileage'; else if (draft.category === 'mileage') draft.category = 'other'; draw(); }));
  $$('[data-pay]', sheet).forEach((b) => (b.onclick = () => { draft.payment = b.dataset.pay; $$('[data-pay]', sheet).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  const miles = $('#ed-miles'); if (miles) miles.onchange = () => { collect(); draw(); };
  const cat = $('#ed-cat'); if (cat) cat.onchange = () => { draft.category = cat.value; $('#ed-purpose').placeholder = category(cat.value).purpose; };
  const pick = $('#ed-photo');
  if (pick) pick.onchange = async () => {
    const f = pick.files?.[0]; if (!f) return;
    collect();
    try {
      const blob = await shrinkPhoto(f);
      if (draft.previewURL) URL.revokeObjectURL(draft.previewURL);
      Object.assign(draft, { newPhoto: blob, previewURL: URL.createObjectURL(blob), removePhoto: false });
      draw();
    } catch { toast("Couldn't open that photo."); }
  };
  const nophoto = $('#ed-nophoto'); if (nophoto) nophoto.onclick = () => { collect(); if (draft.previewURL) URL.revokeObjectURL(draft.previewURL); Object.assign(draft, { newPhoto: null, previewURL: null, removePhoto: true }); draw(); };
  const cancel = $('#ed-cancel'); if (cancel) cancel.onclick = closeSheet;
  const del = $('#ed-delete');
  if (del) { let armed = false; del.onclick = async () => { if (!armed) { armed = true; del.textContent = 'Tap again to delete'; return; } await deleteEntry(draft.id); closeSheet(); rerender(); toast('Deleted'); }; }
  $('#ed-save').onclick = save;
  if (d.isNew && !d.amount && !isTrip) setTimeout(() => $('#ed-amount')?.focus(), 300);
}

async function save() {
  collect();
  const d = draft;
  const fail = (msg, field) => { const e = $('#ed-error'); e.hidden = false; e.textContent = msg; if (field) { $(field)?.setAttribute('aria-invalid', 'true'); $(field)?.focus(); } };
  let amount;
  if (d.type === 'trip') {
    if (!(d.miles > 0)) return fail('Enter the business miles, like 12.', '#ed-miles');
    amount = round2(d.miles * MILEAGE_RATE);
  } else {
    amount = parseFloat(String(d.amount).replace(/[$,\s]/g, ''));
    if (!(amount > 0)) return fail('Enter an amount, like 24.99.', '#ed-amount');
  }
  if (!isISODate(d.date)) return fail('Pick a date.', '#ed-date');

  const entry = {
    id: d.id, type: d.type, amount: round2(amount), miles: d.type === 'trip' ? d.miles : null,
    payee: d.payee, description: d.description, purpose: d.type === 'income' ? '' : d.purpose,
    payment: d.type === 'trip' ? null : d.payment, category: d.type === 'income' ? null : d.type === 'trip' ? 'mileage' : (d.category || 'other'),
    date: d.date, said: d.said || '', how: d.how || 'manual', by: d.by || null, warning: null, needsCheck: false,
    receiptId: d.receiptId || null, createdAt: d.createdAt, sample: Boolean(d.sample), fresh: true
  };
  if (entry.type !== 'expense' || d.removePhoto || d.newPhoto) {
    if (entry.receiptId) await dropReceiptIfUnused(entry.receiptId, entry.id);
    entry.receiptId = null;
  }
  if (d.newPhoto && entry.type === 'expense') entry.receiptId = await saveReceiptPhoto(d.newPhoto);
  const wasNew = d.isNew;
  await saveEntry(entry);
  closeSheet(); buzz();
  if (wasNew && state.view === 'home') state.view = 'ledger';
  rerender();
  toast(wasNew ? 'Saved' : 'Updated');
}
