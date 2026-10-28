// Chairwise: say what you spent between cuts; Meta AI turns it into tax-ready records.
import { state, loadState, onRender, rerender } from './state.js';
import { meta } from './ai.js';
import { $, $$, toast, closeSheet, sheetIsOpen } from './ui.js';
import { renderHome } from './views/home.js';
import { renderLedger } from './views/ledger.js';
import { renderReceipts } from './views/receipts.js';
import { renderTaxes } from './views/taxes.js';
import { openCapture, closeCapture } from './views/capture.js';
import { openEditor } from './views/editor.js';
import { loadSample as addSample, clearSample as removeSample } from './sample.js';

const VIEWS = ['home', 'ledger', 'receipts', 'taxes'];

function go(view) {
  state.view = view;
  $('#screen').scrollTop = 0;
  render();
}

function refreshChip() {
  const chip = $('#ai-chip');
  if (meta.on) { chip.textContent = 'Meta AI'; chip.className = 'ai-chip live'; chip.title = 'Muse Voice + Muse Spark are on'; }
  else if (meta.ready === null) { chip.textContent = 'Checking…'; chip.className = 'ai-chip'; }
  else { chip.textContent = navigator.onLine === false ? 'Offline' : 'On-device'; chip.className = 'ai-chip'; chip.title = 'Understanding runs on the phone'; }
}

async function loadSample() { await addSample(); toast('Sample data loaded. Clear it in Taxes.'); render(); }
async function clearSample() { await removeSample(); toast('Sample data cleared'); render(); }

function snapReceipt() {
  go('receipts');
  setTimeout(() => $('#rc-camera')?.click(), 50);
}

function render() {
  VIEWS.forEach((v) => { $(`#${v}`).hidden = v !== state.view; });
  $$('.dock-btn').forEach((b) => (b.dataset.go === state.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  refreshChip();
  const actions = { go, talk: () => openCapture(), typeLine: (words) => openCapture({ words }), snapReceipt, loadSample, clearSample, refreshChip, edit: (e, opts) => openEditor(e, opts), logIncome: () => openEditor(null, { preset: { type: 'income', category: null } }) };
  ({ home: renderHome, ledger: renderLedger, receipts: renderReceipts, taxes: renderTaxes })[state.view](actions);
}
onRender(render);

// Wiring
$$('.dock-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
$('#talk').addEventListener('click', () => openCapture());
$('#ai-chip').addEventListener('click', () => toast(meta.on ? 'Meta AI is on: Muse Voice hears, Muse Spark understands.' : 'Running on the phone. Turn on Meta AI in Taxes → Settings.'));
$('#veil').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (sheetIsOpen()) closeSheet(); else if (!$('#capture').hidden) closeCapture();
});
window.addEventListener('online', refreshChip);
window.addEventListener('offline', refreshChip);

async function boot() {
  await loadState();
  render();
  const checked = meta.checkServer().then(() => { if ($('#capture').hidden && !sheetIsOpen()) render(); else refreshChip(); });
  const params = new URLSearchParams(location.search);
  if (params.has('voice')) {
    // iPhone Action Button / home-screen shortcut: wait briefly so Meta voice is used if it's ready.
    await Promise.race([checked, new Promise((r) => setTimeout(r, 1500))]);
    openCapture();
  } else if (params.has('receipt')) {
    go('receipts');
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.chairwise = { state, meta, rerender };
boot();
