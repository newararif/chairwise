import { state, summarize, inYear, inMonth } from '../state.js';
import { category, SE_TAX } from '../categories.js';
import { $, $$, esc, usd, usd0 } from '../ui.js';
import { meta } from '../ai.js';

export const TRY_LINES = [
  'Spent forty cash on Wahl guards at Sally Beauty and twelve on foils at CosmoProf with my card',
  'Drove 12 miles to Sally Beauty for supplies',
  'Made four twenty cash today'
];

export function renderHome({ go, talk, typeLine, snapReceipt, loadSample }) {
  const el = $('#home');
  const year = summarize(inYear(new Date().getFullYear()));
  const month = summarize(inMonth());
  const toCheck = state.entries.filter((e) => e.needsCheck).length;
  const saved = year.deductions * (state.settings.bracket + SE_TAX);

  if (!state.entries.length) {
    el.innerHTML = `
      <div class="card empty">
        <h3>Say it. Chairwise books it.</h3>
        <p>Tap the mic and say what you spent, like you'd text it. ${meta.on ? 'Meta AI handles the rest: the amount, the store, cash or card, and the tax line.' : 'Chairwise fills in the amount, store and tax line.'}</p>
        <div class="tries">${TRY_LINES.map((t) => `<button type="button" data-try="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <button type="button" class="btn quiet" id="sample">Look around with sample data</button>
      </div>`;
    $$('[data-try]', el).forEach((b) => (b.onclick = () => typeLine(b.dataset.try)));
    $('#sample', el).onclick = loadSample;
    return;
  }

  const spentBy = {};
  for (const e of inYear(new Date().getFullYear())) if (e.type !== 'income') spentBy[e.category] = (spentBy[e.category] || 0) + e.amount;
  const top = Object.entries(spentBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] || 1;

  el.innerHTML = `
    <div class="card hero">
      <div class="eyebrow">Write-offs in ${new Date().getFullYear()}</div>
      <div class="big">${usd0(year.deductions)}</div>
      <div class="small">That's about <b>${usd0(saved)}</b> less tax at your ${Math.round(state.settings.bracket * 100)}% bracket plus self-employment tax.</div>
    </div>
    ${toCheck ? `<button type="button" class="flagbar" id="check"><span>${toCheck} ${toCheck === 1 ? 'entry needs' : 'entries need'} a quick look</span><span>Review →</span></button>` : ''}
    <div class="quick">
      <button type="button" id="q-talk"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><b>Say an expense</b><small>Several at once is fine</small></button>
      <button type="button" id="q-snap"><svg viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.3"/></svg><b>Snap a receipt</b><small>${meta.on ? 'Meta AI keeps the business items' : 'Photo goes in your CPA packet'}</small></button>
    </div>
    <div class="pair">
      <div class="card stat"><div class="eyebrow">Take-home · ${new Date().toLocaleDateString('en-US', { month: 'long' })}</div><div class="value">${usd0(month.income - month.spent)}</div><div class="hint">${usd0(month.income)} in · ${usd0(month.cash)} of it cash</div></div>
      <div class="card stat"><div class="eyebrow">Set aside</div><div class="value">${usd0(year.seTax)}</div><div class="hint">Self-employment tax on this year's profit</div></div>
    </div>
    ${year.miles ? `<div class="card stat"><div class="eyebrow">Business miles this year</div><div class="value">${year.miles.toLocaleString()} mi</div><div class="hint">Worth ${usd(year.miles * 0.725)} at the 2026 IRS rate of 72.5¢</div></div>` : ''}
    ${top.length ? `<div class="card"><div class="eyebrow">Where it went this year</div><div class="bars">${top.map(([c, v]) => `<div class="bar"><span>${esc(category(c).name)}<em>Line ${category(c).line}</em></span><span class="num">${usd(v)}</span><i><b style="width:${(v / max) * 100}%"></b></i></div>`).join('')}</div></div>` : ''}`;

  $('#q-talk', el).onclick = () => talk();
  $('#q-snap', el).onclick = () => snapReceipt();
  const check = $('#check', el);
  if (check) check.onclick = () => { state.filter = 'check'; go('ledger'); };
}
