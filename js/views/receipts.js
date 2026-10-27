// Receipts: snap a photo; Muse Spark reads every line and keeps only the business items.
import { state, saveEntry, saveReceiptPhoto, rerender } from '../state.js';
import { category } from '../categories.js';
import { meta, cleanReceipt } from '../ai.js';
import { openEditor } from './editor.js';
import { fillPhotos } from './ledger.js';
import { $, $$, esc, usd, openSheet, closeSheet, toast, buzz, today, shiftDays, niceDay, round2, newId, shrinkPhoto, blobToDataURL } from '../ui.js';

export function renderReceipts() {
  const el = $('#receipts');
  const withPhoto = state.entries.filter((e) => e.receiptId);
  const seen = new Set();
  const photos = withPhoto.filter((e) => (seen.has(e.receiptId) ? false : seen.add(e.receiptId))).sort((a, b) => b.date.localeCompare(a.date));
  const missing = state.entries.filter((e) => e.type === 'expense' && !e.receiptId && e.amount >= 75);
  el.innerHTML = `
    <h2 class="title">Receipts</h2>
    <p class="lede">Keep a receipt for anything $75 or more, and for equipment.</p>
    <div class="snap">
      <h3>Snap a receipt</h3>
      <p>${meta.on ? 'Muse Spark reads every line, keeps the shop items and leaves out the personal ones, even on a mixed Walmart run.' : 'Take the photo and type the total. The photo goes into your CPA packet.'}</p>
      <div class="two-btn" style="width:100%"><label class="btn picker">Take photo<input type="file" id="rc-camera" accept="image/*" capture="environment"></label><label class="btn quiet picker">From photos<input type="file" id="rc-library" accept="image/*"></label></div>
      ${meta.on ? '<button type="button" class="btn quiet wide" id="rc-sample">Try a sample receipt</button>' : ''}
    </div>
    ${missing.length ? `<button type="button" class="flagbar" id="rc-missing"><span>${missing.length} purchase${missing.length === 1 ? '' : 's'} of $75+ without a receipt</span><span>Show →</span></button>` : ''}
    ${photos.length ? `<div class="eyebrow">Saved · ${photos.length}</div><div class="grid">${photos.slice(0, 60).map((e) => `<button type="button" data-id="${e.id}" aria-label="${esc(e.payee || 'Receipt')}"><img data-photo="${e.receiptId}" alt=""><span>${esc(e.payee || niceDay(e.date))}</span></button>`).join('')}</div>` : ''}`;

  const onPick = async (input) => {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    let blob;
    try { blob = await shrinkPhoto(file); } catch { toast("Couldn't open that photo."); return; }
    handlePhoto(blob);
  };
  $('#rc-camera', el).onchange = (e) => onPick(e.target);
  $('#rc-library', el).onchange = (e) => onPick(e.target);
  const sample = $('#rc-sample', el);
  if (sample) sample.onclick = async () => { try { handlePhoto(await (await fetch('sample-receipt.jpg')).blob()); } catch { toast("Couldn't load the sample."); } };
  const miss = $('#rc-missing', el);
  if (miss) miss.onclick = () => { state.filter = 'expense'; state.view = 'ledger'; rerender(); };
  $$('.grid button', el).forEach((b) => (b.onclick = () => openEditor(state.entries.find((e) => e.id === b.dataset.id))));
  fillPhotos(el);
}

export function handlePhoto(blob) {
  if (meta.on) readWithMeta(blob);
  else openEditor(null, { photo: blob, preset: { how: 'receipt' } });
}

let review = null; // { blob, url, receipt, keep: boolean[] }

async function readWithMeta(blob) {
  const url = URL.createObjectURL(blob);
  const mine = { blob, url };
  review = mine;
  openSheet(`<div class="reading"><div class="scanner"><img src="${url}" alt="Your receipt"></div><h3>Reading your receipt</h3><p class="note">Muse Spark is reading each line and sorting business from personal…</p></div>`,
    { onClose: () => { if (review === mine) { URL.revokeObjectURL(url); review = null; } } });
  try {
    const { receipt } = await meta.readReceipt(await blobToDataURL(blob));
    if (review !== mine) return; // closed while reading
    const r = cleanReceipt(receipt);
    if (!r.readable) { toast("Couldn't read that one. Enter it by hand."); return byHand(r); }
    Object.assign(mine, { receipt: r, keep: r.lines.map((l) => l.business) });
    drawReview();
  } catch {
    if (review !== mine) return;
    toast("Couldn't reach Meta AI. Enter it by hand.");
    byHand({});
  }
}

function byHand(r) {
  const blob = review?.blob;
  const preset = { how: 'receipt', payee: r.store || '', amount: r.total ?? '', payment: r.payment || null };
  if (r.date && r.date <= today()) preset.date = r.date;
  review = null;
  openEditor(null, { photo: blob, preset });
}

function totals() {
  const { receipt: r, keep } = review;
  const itemsSum = r.lines.reduce((a, l) => a + l.price, 0);
  const base = r.subtotal || itemsSum;
  const taxRate = r.tax && base ? r.tax / base : 0;
  const business = r.lines.reduce((a, l, i) => a + (keep[i] ? l.price : 0), 0);
  return { taxRate, business, tax: business * taxRate, writeOff: round2(business * (1 + taxRate)), count: keep.filter(Boolean).length };
}

function drawReview() {
  const { receipt: r, keep, url } = review;
  const t = totals();
  const sheet = openSheet(`
    <div class="rc-top"><img src="${url}" alt="Receipt"><div><span class="eyebrow">Read by Muse Spark</span><b>${esc(r.store || 'Receipt')}</b><small>${r.date ? niceDay(r.date) : ''}${r.total ? ` · ${usd(r.total)} total` : ''}${r.payment ? ` · ${r.payment}` : ''}</small></div></div>
    <p class="note">${esc(r.headline)} Tap an item to keep it or leave it out.</p>
    <div class="lines">${r.lines.map((l, i) => `<label class="line${keep[i] ? '' : ' out'}" data-i="${i}"><input type="checkbox" ${keep[i] ? 'checked' : ''} aria-label="Business: ${esc(l.label)}"><span><b>${esc(l.label)}</b><small>${keep[i] ? `Line ${category(l.category).line} · ` : ''}${esc(l.why)}</small></span><span class="num">${usd(l.price)}</span></label>`).join('')}</div>
    <div class="card"><div class="writeoff"><span class="eyebrow">Write-off · ${t.count} of ${r.lines.length} items</span><span class="num">${usd(t.writeOff)}</span></div>
      <p class="note" style="margin-top:6px">${t.taxRate ? `Includes ${usd(t.tax)} of sales tax on the business items. ` : ''}Personal items stay out of your books, and the list of what was left out is saved for your accountant.</p></div>
    <div class="two-btn"><button type="button" class="btn quiet" id="rv-hand">Enter by hand</button><button type="button" class="btn" id="rv-save"${t.count ? '' : ' disabled'}>Save write-off</button></div>`,
  { onClose: () => { if (review) { URL.revokeObjectURL(review.url); review = null; } } });

  $$('.line input', sheet).forEach((box) => (box.onchange = () => {
    review.keep[Number(box.closest('.line').dataset.i)] = box.checked;
    const y = sheet.scrollTop; drawReview(); $('#sheet').scrollTop = y;
  }));
  $('#rv-hand').onclick = () => byHand(review.receipt);
  $('#rv-save').onclick = saveReview;
}

async function saveReview() {
  const { receipt: r, keep, blob, url } = review;
  const t = totals();
  if (!t.count) return;
  const date = r.date && r.date <= shiftDays(today(), 1) && r.date >= shiftDays(today(), -400) ? r.date : today();
  const kept = r.lines.filter((_, i) => keep[i]);
  const left = r.lines.filter((_, i) => !keep[i]);
  const said = `Receipt read by Muse Spark. Kept: ${kept.map((l) => `${l.label} ${usd(l.price)}`).join('; ')}.${left.length ? ` Left out as personal: ${left.map((l) => `${l.label} ${usd(l.price)}`).join('; ')}.` : ''}`;

  // One entry per tax category, all pointing at the same photo.
  const groups = new Map();
  for (const l of kept) groups.set(l.category, [...(groups.get(l.category) || []), l]);
  const receiptId = await saveReceiptPhoto(blob);
  const createdAt = new Date().toISOString();
  for (const [cat, lines] of groups) {
    await saveEntry({
      id: newId(), type: 'expense', amount: round2(lines.reduce((a, l) => a + l.price, 0) * (1 + t.taxRate)), miles: null,
      payee: r.store, description: lines.map((l) => l.label).join(', ').slice(0, 80), purpose: category(cat).purpose,
      payment: r.payment, category: cat, date, said, how: 'receipt', by: 'Muse Spark', warning: null, needsCheck: false,
      receiptId, createdAt, fresh: true
    });
  }
  URL.revokeObjectURL(url);
  review = null;
  closeSheet(); buzz();
  state.filter = 'all'; state.view = 'ledger'; rerender();
  toast(`Saved ${usd(t.writeOff)} write-off${groups.size > 1 ? ` in ${groups.size} categories` : ''}`);
}
