// Add or fix one entry by hand.
import { state, saveEntry, deleteEntry, linkedTrip, receiptURL, saveReceiptPhoto, dropReceiptIfUnused, rerender } from '../state.js';
import { CATEGORIES, category, MILEAGE_RATE } from '../categories.js';
import { $, $$, esc, openSheet, closeSheet, toast, buzz, today, shiftDays, niceDay, clock, round2, newId, shrinkPhoto, isISODate } from '../ui.js';

let draft = null;

export function openEditor(entry, { preset, photo } = {}) {
  draft = entry
    ? { ...entry }
    : { id: newId(), type: 'expense', amount: '', miles: null, payee: '', description: '', purpose: '', payment: null, category: 'supplies', date: today(), said: '', how: 'manual', by: null, warning: null, needsCheck: false, receiptId: null, isNew: true };
  if (preset) Object.assign(draft, preset);
  const trip = entry ? linkedTrip(entry) : null;
  if (trip) Object.assign(draft, { tripOn: true, tripMiles: trip.miles, tripId: trip.id });
  if (photo) { draft.newPhoto = photo; draft.previewURL = URL.createObjectURL(photo); }
  draw();
}

function collect() {
  const val = (id) => $(`#${id}`)?.value;
  if (val('ed-amount') !== undefined) draft.amount = val('ed-amount');
  if (val('ed-miles') !== undefined) { const m = parseFloat(val('ed-miles')); draft.miles = m > 0 ? m : null; }
  if (val('ed-trip-miles') !== undefined) { const m = parseFloat(val('ed-trip-miles')); draft.tripMiles = m > 0 ? m : null; }
  draft.date = val('ed-date') || draft.date;
  for (const [id, key] of [['ed-payee', 'payee'], ['ed-desc', 'description'], ['ed-purpose', 'purpose'], ['ed-cat', 'category']]) {
    if (val(id) !== undefined) draft[key] = val(id).trim();
  }
}

async function draw() {
  const d = draft;
  const isTrip = d.type === 'trip', isIncome = d.type === 'income';
  const photo = d.previewURL || (d.receiptId && !d.removePhoto ? await receiptURL(d.receiptId) : null);
  const heading = isIncome ? (d.isNew ? 'Log income' : 'Fix income') : isTrip ? (d.isNew ? 'Log a trip' : 'Fix trip') : (d.isNew ? 'Add expense' : 'Fix expense');
  openSheet(`
    <h3>${heading}</h3>
    ${d.warning ? `<p class="warning">${esc(d.warning)}</p>` : ''}
    ${isIncome
      ? `<p class="note">Optional. Logging what you make lets Chairwise tell you what to set aside for taxes, and gives you proof of income for an apartment or a loan.</p>`
      : isTrip ? `<p class="note">For drives with no purchase, like a house call or a bank deposit.</p>` : ''}
    <div class="split">
      ${isTrip
        ? `<div class="field"><label for="ed-miles">Business miles</label><input id="ed-miles" class="money-input" inputmode="decimal" value="${d.miles ?? ''}" placeholder="12"></div>`
        : `<div class="field"><label for="ed-amount">Amount</label><input id="ed-amount" class="money-input" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="${d.amount === '' || d.amount == null ? '' : Number(d.amount).toFixed(2)}"></div>`}
      <div class="field"><label for="ed-date">Date</label><input id="ed-date" type="date" value="${esc(d.date)}" max="${shiftDays(today(), 1)}"></div>
    </div>
    ${isTrip ? `<p class="note">${d.miles ? `${d.miles} mi × 72.5¢ = <b>$${round2(d.miles * MILEAGE_RATE).toFixed(2)}</b>` : '2026 IRS rate: 72.5¢ a mile.'} Driving from home to your usual shop is commuting and doesn't count.</p>`
      : `<div class="field"><span class="label">Paid with</span><div class="seg" role="group" aria-label="Paid with"><button type="button" data-pay="cash" aria-pressed="${d.payment === 'cash'}">Cash</button><button type="button" data-pay="card" aria-pressed="${d.payment === 'card'}">Card / app</button></div></div>`}
    <div class="field"><label for="ed-payee">${isIncome ? 'From (optional)' : isTrip ? 'Where to' : 'Paid to'}</label><input id="ed-payee" autocomplete="off" value="${esc(d.payee)}" placeholder="${isIncome ? 'Walk-ins, regulars' : 'Sally Beauty'}"></div>
    ${d.type === 'expense' ? tripBlock(d) : ''}
    <div class="field"><label for="ed-desc">${isIncome ? 'Note' : isTrip ? 'Trip' : 'What for'}</label><input id="ed-desc" autocomplete="off" value="${esc(d.description)}" placeholder="${isIncome ? 'Saturday cuts' : isTrip ? 'Supply run' : 'Clipper guards'}"></div>
    ${d.type === 'expense' ? `<div class="field"><label for="ed-cat">Tax category</label><select id="ed-cat">${Object.entries(CATEGORIES).filter(([k]) => k !== 'mileage').map(([k, c]) => `<option value="${k}"${k === d.category ? ' selected' : ''}>Line ${c.line} · ${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    ${isIncome ? '' : `<div class="field"><label for="ed-purpose">Business purpose</label><input id="ed-purpose" autocomplete="off" value="${esc(d.purpose)}" placeholder="${esc(category(isTrip ? 'mileage' : d.category).purpose)}"></div>`}
    ${d.type === 'expense' ? `<div class="field"><span class="label">Receipt photo</span><div class="photo-row">${photo ? `<img src="${photo}" alt="Receipt">` : '<span class="none">No photo</span>'}<div class="two-btn"><label class="btn quiet picker">${photo ? 'Replace' : 'Add photo'}<input type="file" id="ed-photo" accept="image/*"></label>${photo ? '<button type="button" class="btn quiet" id="ed-nophoto">Remove</button>' : ''}</div></div></div>` : ''}
    ${d.said ? `<div class="quote">“${esc(d.said)}”<small><span>${d.how === 'voice' ? 'Said' : d.how === 'receipt' ? 'Receipt' : 'Typed'}${d.createdAt ? ` ${niceDay(d.createdAt.slice(0, 10))}, ${clock(d.createdAt)}` : ''}${d.by ? ` · read by ${esc(d.by)}` : ''}</span><span>original, kept</span></small></div>` : ''}
    ${d.isNew && !isIncome ? `<p class="switch-kind"><button type="button" class="linkish" data-type="${isTrip ? 'expense' : 'trip'}">${isTrip ? '← Bought something? Add an expense instead' : 'No purchase, just driving? Log a trip'}</button></p>` : ''}
    <p class="note" id="ed-error" role="alert" hidden style="color:var(--red)"></p>
    <div class="two-btn">${d.isNew ? '<button type="button" class="btn quiet" id="ed-cancel">Cancel</button>' : '<button type="button" class="btn danger" id="ed-delete">Delete</button>'}<button type="button" class="btn" id="ed-save">${d.needsCheck && !d.isNew ? 'Looks right' : 'Save'}</button></div>`,
  { onClose: () => { if (draft?.previewURL) URL.revokeObjectURL(draft.previewURL); draft = null; } });

  const sheet = $('#sheet');
  $$('[data-type]', sheet).forEach((b) => (b.onclick = () => { collect(); draft.type = b.dataset.type; if (draft.type === 'trip') draft.category = 'mileage'; else if (draft.category === 'mileage') draft.category = 'other'; draw(); }));
  $$('[data-pay]', sheet).forEach((b) => (b.onclick = () => { draft.payment = b.dataset.pay; $$('[data-pay]', sheet).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  const miles = $('#ed-miles'); if (miles) miles.onchange = () => { collect(); draw(); };
  const trip = $('#ed-trip'); if (trip) trip.onchange = () => { collect(); draft.tripOn = trip.checked; draw(); if (trip.checked) setTimeout(() => $('#ed-trip-miles')?.focus(), 50); };
  const tripMiles = $('#ed-trip-miles');
  if (tripMiles) tripMiles.oninput = () => { const m = parseFloat(tripMiles.value); $('#ed-trip-worth').textContent = m > 0 ? `= $${round2(m * MILEAGE_RATE).toFixed(2)} write-off at 72.5¢ a mile` : '72.5¢ a mile (2026 IRS rate)'; };
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
  const addTrip = d.type === 'expense' && d.tripOn;
  if (addTrip && !(d.tripMiles > 0)) return fail('Enter the miles you drove, like 12. Or untick "Drove there".', '#ed-trip-miles');

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
  const oldTrip = entry.type === 'expense' ? linkedTrip(entry) : null;
  if (oldTrip && !addTrip) await deleteEntry(oldTrip.id);
  if (addTrip) {
    // The miles are an optional detail of the expense. They're stored as a linked trip entry so the
    // IRS mileage log (date, destination, purpose, miles) and Schedule C line 9 stay correct.
    const miles = Math.round(d.tripMiles * 10) / 10;
    await saveEntry({
      id: oldTrip?.id || newId(), forId: entry.id, type: 'trip', amount: round2(miles * MILEAGE_RATE), miles,
      payee: entry.payee, description: entry.payee ? `Trip to ${entry.payee}` : 'Business trip',
      purpose: entry.description ? `Bought ${entry.description}` : 'Business purchase',
      payment: null, category: 'mileage', date: entry.date, said: entry.said, how: entry.how, by: null,
      warning: null, needsCheck: false, receiptId: null, fresh: true
    });
  }
  closeSheet(); buzz();
  if (wasNew && state.view === 'home') state.view = 'ledger';
  rerender();
  toast(addTrip ? `${wasNew ? 'Saved' : 'Updated'} with ${Math.round(d.tripMiles * 10) / 10} mi` : wasNew ? 'Saved' : 'Updated');
}

function tripBlock(d) {
  const worth = d.tripMiles > 0 ? `= $${round2(d.tripMiles * MILEAGE_RATE).toFixed(2)} write-off at 72.5¢ a mile` : '72.5¢ a mile (2026 IRS rate)';
  return `<div class="trip-add${d.tripOn ? ' on' : ''}">
    <label class="trip-toggle"><input type="checkbox" id="ed-trip" ${d.tripOn ? 'checked' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2M3 11h18"/><circle cx="8" cy="13.5" r="1"/><circle cx="16" cy="13.5" r="1"/></svg>
      <span><b>Drove there for this?</b><small>Optional: add the miles, worth 72.5¢ each</small></span></label>
    ${d.tripOn ? `<div class="field"><label for="ed-trip-miles">Business miles (there and back)</label><input id="ed-trip-miles" inputmode="decimal" autocomplete="off" value="${d.tripMiles ?? ''}" placeholder="12"><p class="note" id="ed-trip-worth">${worth}</p></div>` : ''}
  </div>`;
}
