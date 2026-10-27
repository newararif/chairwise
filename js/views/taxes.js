import { state, scheduleC, saveSettings, wipeEverything, rerender } from '../state.js';
import { store } from '../store.js';
import { meta } from '../ai.js';
import { cpaPacket, downloadCSV, printSummary } from '../export.js';
import { $, esc, usd, toast, handOver, blobToDataURL, dataURLToBlob, today } from '../ui.js';

export function renderTaxes({ loadSample, clearSample, refreshChip }) {
  const el = $('#taxes');
  const years = [...new Set([new Date().getFullYear(), ...state.entries.map((e) => Number(e.date.slice(0, 4)))])].sort((a, b) => b - a);
  if (!years.includes(state.taxYear)) state.taxYear = years[0];
  const s = scheduleC(state.taxYear);
  const hasSample = state.entries.some((e) => e.sample);

  el.innerHTML = `
    <div class="row"><h2 class="title">Taxes</h2>
      <select id="tx-year" aria-label="Tax year" style="border:1px solid var(--rule);background:var(--card);border-radius:10px;padding:7px 10px;font-weight:600">${years.map((y) => `<option${y === state.taxYear ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
    <p class="lede">Schedule C estimate · ${s.count} entries · ${s.withPhoto} with receipt photos</p>
    <div class="card"><table class="sched">
      <tr><td>1</td><td>Gross receipts<small>Cash and card income you logged</small></td><td>${usd(s.gross)}</td></tr>
      ${s.lines.map((l) => `<tr><td>${l.line}</td><td>${esc(l.name)}${l.line === '9' && s.miles ? `<small>${s.miles.toLocaleString()} business miles × 72.5¢</small>` : ''}</td><td>${usd(l.amount)}</td></tr>`).join('')}
      <tr class="total"><td>28</td><td>Total expenses</td><td>${usd(s.total)}</td></tr>
      <tr><td>31</td><td>Net profit (estimate)</td><td>${usd(s.net)}</td></tr>
    </table><p class="note" style="margin-top:8px">Meals at 50%. Your accountant makes the final call; this is not tax advice.</p></div>

    <div class="eyebrow">Send to your accountant</div>
    <div class="actions">
      <button type="button" class="action main" id="tx-packet"><span class="ext">ZIP</span><span><b>CPA packet</b><small>Ledger + Schedule C summary + every receipt photo</small></span><span>›</span></button>
      <button type="button" class="action" id="tx-csv"><span class="ext">CSV</span><span><b>Ledger spreadsheet</b><small>Excel, Google Sheets, Numbers</small></span><span>›</span></button>
      <button type="button" class="action" id="tx-print"><span class="ext">PDF</span><span><b>Schedule C summary</b><small>Print or save as PDF</small></span><span>›</span></button>
    </div>

    <div class="eyebrow">Settings</div>
    <div class="card" style="display:grid;gap:14px">
      <div class="switch"><span><b>Meta AI</b>${meta.ready ? '' : ' <span class="tag">not set up on server</span>'}<br><small class="note">Muse Voice hears you; Muse Spark understands what you said and reads receipts. Only the words or photo you're logging are sent. Your ledger stays on this phone. Off: everything runs on the phone.</small></span><input type="checkbox" id="tx-ai" aria-label="Use Meta AI" ${state.settings.useAI !== false ? 'checked' : ''}></div>
      <div class="field"><label for="tx-name">Name or business (shown on the summary)</label><input id="tx-name" value="${esc(state.settings.name)}" placeholder="Marcus Lee, Fresh Cutz" autocomplete="name"></div>
      <div class="field"><label for="tx-bracket">Federal tax bracket (for the savings estimate)</label><select id="tx-bracket">${[0.1, 0.12, 0.22, 0.24, 0.32].map((b) => `<option value="${b}"${Math.abs(b - state.settings.bracket) < 0.001 ? ' selected' : ''}>${Math.round(b * 100)}%</option>`).join('')}</select></div>
    </div>

    <div class="eyebrow">Your data</div>
    <div class="card" style="display:grid;gap:12px">
      <p class="note">Everything lives on this phone: no bank login, no account. Save a backup now and then.</p>
      <div class="two-btn"><button type="button" class="btn quiet" id="tx-backup">Save backup</button><label class="btn quiet picker">Restore<input type="file" id="tx-restore" accept=".json,application/json"></label></div>
      <button type="button" class="btn quiet" id="tx-sample">${hasSample ? 'Clear sample data' : 'Load sample data'}</button>
      <button type="button" class="btn danger" id="tx-wipe">Delete everything on this phone</button>
      ${store.durable ? '' : '<p class="note" style="color:var(--red)">This browser isn\'t keeping data between visits. Open Chairwise in Safari or Chrome and add it to your home screen.</p>'}
    </div>
    <p class="note" style="text-align:center">Chairwise · built for the Meta Global AI Developer Hackathon 2026 · estimates, not tax advice</p>`;

  $('#tx-year').onchange = (e) => { state.taxYear = Number(e.target.value); renderTaxes({ loadSample, clearSample, refreshChip }); };
  $('#tx-packet').onclick = async (e) => { const b = e.currentTarget.querySelector('b'); b.textContent = 'Building packet…'; try { await cpaPacket(state.taxYear); } catch { toast("Couldn't build the packet."); } b.textContent = 'CPA packet'; };
  $('#tx-csv').onclick = () => downloadCSV(state.taxYear);
  $('#tx-print').onclick = () => printSummary(state.taxYear);
  $('#tx-ai').onchange = async (e) => { await saveSettings({ useAI: e.target.checked }); refreshChip(); toast(e.target.checked ? 'Meta AI on' : 'Meta AI off: everything runs on the phone'); };
  $('#tx-name').onchange = (e) => saveSettings({ name: e.target.value.trim() }).then(() => toast('Saved'));
  $('#tx-bracket').onchange = (e) => saveSettings({ bracket: Number(e.target.value) }).then(() => toast('Saved'));
  $('#tx-backup').onclick = backup;
  $('#tx-restore').onchange = (e) => restore(e.target);
  $('#tx-sample').onclick = hasSample ? clearSample : loadSample;
  const wipe = $('#tx-wipe');
  let armed = false;
  wipe.onclick = async () => {
    if (!armed) { armed = true; wipe.textContent = 'Tap again to delete everything'; return; }
    await wipeEverything(); toast('Everything deleted'); state.view = 'home'; rerender();
  };
}

async function backup() {
  const receipts = [];
  for (const r of await store.all('receipts')) if (r.blob) receipts.push({ id: r.id, type: r.type, createdAt: r.createdAt, data: await blobToDataURL(r.blob) });
  const data = { app: 'chairwise', format: 1, savedAt: new Date().toISOString(), settings: state.settings, entries: state.entries.map(({ fresh, ...e }) => e), receipts };
  await handOver(new File([JSON.stringify(data)], `Chairwise backup ${today()}.json`, { type: 'application/json' }), 'Backup');
}

async function restore(input) {
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'chairwise' || !Array.isArray(data.entries)) throw new Error('not a backup');
    for (const r of data.receipts || []) await store.put('receipts', { id: r.id, type: r.type, createdAt: r.createdAt, blob: await dataURLToBlob(r.data) });
    for (const e of data.entries) if (e?.id && e.date && typeof e.amount === 'number') await store.put('entries', e);
    if (data.settings) await saveSettings({ ...data.settings, key: 'settings' });
    state.entries = await store.all('entries');
    toast(`Restored ${data.entries.length} entries`);
    state.view = 'home'; rerender();
  } catch { toast("That file isn't a Chairwise backup."); }
}
