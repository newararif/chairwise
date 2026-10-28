// Bank or card statement import: Muse Spark reads the statement (PDF or screenshot)
// and suggests which charges are business write-offs. The barber decides; nothing is saved without a tap.
import { state, saveEntry, rerender } from '../state.js';
import { category } from '../categories.js';
import { meta, cleanStatement } from '../ai.js';
import { $, $$, esc, usd, openSheet, closeSheet, toast, buzz, niceDay, round2, newId, shrinkPhoto, blobToDataURL } from '../ui.js';

let job = null; // { statement, pick: boolean[], dupes: boolean[], showPersonal }

const MAX_BYTES = 8_000_000;

export async function importStatement(file) {
  if (!meta.on) { toast('Reading statements needs Meta AI. Turn it on in Taxes → Settings.'); return; }
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf && !file.type.startsWith('image/')) { toast('Use a PDF or a screenshot of your statement.'); return; }
  if (file.size > MAX_BYTES) { toast('That file is too big. Try one month at a time.'); return; }
  const mine = {};
  job = mine;
  openSheet(`<div class="reading"><div class="scanner statement-scan" aria-hidden="true"><div class="fake-lines">${'<i></i>'.repeat(9)}</div></div>
    <h3>Reading your statement</h3><p class="note">Muse Spark is going through each charge and picking out the ones that look like business costs. This takes up to a minute for a long statement.</p></div>`,
    { onClose: () => { if (job === mine) job = null; } });
  try {
    const dataURL = isPdf ? await blobToDataURL(file) : await blobToDataURL(await shrinkPhoto(file, 2200, 0.85));
    const { statement } = await meta.readStatement(dataURL, file.name);
    if (job !== mine) return;
    const s = cleanStatement(statement);
    if (!s.readable) { closeSheet(); toast("Couldn't find any charges. Try a clearer PDF or screenshot."); return; }
    const dupes = s.rows.map(isAlreadyLogged);
    Object.assign(mine, { statement: s, dupes, pick: s.rows.map((r, i) => r.business === 'yes' && !dupes[i]), showPersonal: false });
    draw();
  } catch (err) {
    if (job !== mine) return;
    closeSheet();
    toast("Couldn't read that statement. Try again, or a screenshot instead.");
  }
}

// Same amount within 3 days of something already in the ledger = probably logged by voice or receipt already.
function isAlreadyLogged(row) {
  const day = (iso) => new Date(`${iso}T12:00:00`).getTime();
  return state.entries.some((e) => e.type !== 'income' && Math.abs(e.amount - row.amount) < 0.01 && Math.abs(day(e.date) - day(row.date)) <= 3 * 864e5);
}

function rowHTML(r, i) {
  const { pick, dupes } = job;
  const tags = [];
  if (dupes[i]) tags.push('<span class="tag ok">Already logged</span>');
  if (r.business === 'maybe') tags.push('<span class="tag warn">Check</span>');
  return `<label class="line${pick[i] ? '' : ' out'}" data-i="${i}"><input type="checkbox" ${pick[i] ? 'checked' : ''} aria-label="Write off ${esc(r.merchant)} ${usd(r.amount)}">
    <span><b>${esc(r.merchant)}</b><small>${niceDay(r.date)}${r.business !== 'no' ? ` · Line ${category(r.category).line}` : ''} · ${esc(r.why)}</small>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</span>
    <span class="num">${usd(r.amount)}</span></label>`;
}

function draw() {
  const { statement: s, pick, showPersonal } = job;
  const groups = { yes: [], maybe: [], no: [] };
  s.rows.forEach((r, i) => groups[r.business].push(i));
  const chosen = s.rows.filter((_, i) => pick[i]);
  const total = chosen.reduce((a, r) => a + r.amount, 0);
  const section = (title, note, idx) => (idx.length ? `<div class="eyebrow" style="margin-top:4px">${title} · ${idx.length}</div>${note ? `<p class="note">${note}</p>` : ''}<div class="lines">${idx.map((i) => rowHTML(s.rows[i], i)).join('')}</div>` : '');
  const sheet = openSheet(`
    <div><span class="eyebrow">Read by Muse Spark</span><h3>${esc(s.bank || 'Your statement')}</h3><p class="note">${esc(s.period || '')}${s.period ? ' · ' : ''}${s.rows.length} charges</p></div>
    <p class="note">${esc(s.headline)} Tap any charge to include it or leave it out.</p>
    ${section('Looks like business', '', groups.yes)}
    ${section('Check these', 'Stores that sell personal things too, or bills where only part is business. If you include one, lower the amount to just the business part.', groups.maybe)}
    ${groups.no.length ? `<button type="button" class="btn quiet" id="st-personal">${showPersonal ? 'Hide' : 'Show'} ${groups.no.length} personal or not deductible</button>${showPersonal ? section('Personal or not deductible', 'Gas is left out on purpose: if you log business miles, the mileage rate already covers gas.', groups.no) : ''}` : ''}
    <div class="card"><div class="writeoff"><span class="eyebrow">Adding · ${chosen.length} charges</span><span class="num">${usd(total)}</span></div>
      <p class="note" style="margin-top:6px">A bank statement proves you paid, not what you bought. Keep receipts for anything over $75 and for mixed stores. Your statement file isn't saved anywhere.</p></div>
    <div class="two-btn"><button type="button" class="btn quiet" id="st-cancel">Cancel</button><button type="button" class="btn" id="st-save"${chosen.length ? '' : ' disabled'}>Add ${chosen.length || ''} to ledger</button></div>`,
  { onClose: () => { job = null; } });

  $$('.line input', sheet).forEach((box) => (box.onchange = () => {
    job.pick[Number(box.closest('.line').dataset.i)] = box.checked;
    const y = sheet.scrollTop; draw(); $('#sheet').scrollTop = y;
  }));
  const tog = $('#st-personal', sheet);
  if (tog) tog.onclick = () => { job.showPersonal = !job.showPersonal; const y = sheet.scrollTop; draw(); $('#sheet').scrollTop = y; };
  $('#st-cancel', sheet).onclick = closeSheet;
  $('#st-save', sheet).onclick = save;
}

async function save() {
  const { statement: s, pick } = job;
  const chosen = s.rows.filter((_, i) => pick[i]);
  if (!chosen.length) return;
  const createdAt = new Date().toISOString();
  for (const r of chosen) {
    const check = r.business !== 'yes';
    await saveEntry({
      id: newId(), type: 'expense', amount: round2(r.amount), miles: null, payee: r.merchant,
      description: r.printed || r.merchant, purpose: category(r.category).purpose, payment: 'card',
      category: r.category, date: r.date, said: `From ${s.bank || 'bank'} statement: ${r.printed || r.merchant}, ${usd(r.amount)} on ${r.date}`,
      how: 'statement', by: 'Muse Spark',
      warning: check ? 'From a statement: keep the receipt, and lower the amount if only part was for the business.' : null,
      needsCheck: check, receiptId: null, createdAt, fresh: true
    });
  }
  const total = chosen.reduce((a, r) => a + r.amount, 0);
  job = null;
  closeSheet(); buzz();
  state.filter = 'all'; state.view = 'ledger'; rerender();
  toast(`Added ${chosen.length} charges · ${usd(total)}`);
}
