// Voice logging: Muse Voice Transcribe hears -> Muse Spark understands -> saved on the phone.
// Falls back to the browser's speech recognition and the on-device parser when Meta AI isn't available.
import { state, saveEntry, deleteEntry, rerender } from '../state.js';
import { category } from '../categories.js';
import { meta, entryFromModel } from '../ai.js';
import { MicCapture } from '../recorder.js';
import { understandOnDevice } from '../fallback.js';
import { openEditor } from './editor.js';
import { $, $$, esc, usd, buzz, toast } from '../ui.js';

const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" style="fill:var(--gold)"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:#fff"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const BrowserSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;

let mic = null, speech = null, mode = 'idle', startedAt = 0, ticker = null;
const useMetaVoice = () => meta.on && MicCapture.supported();

function shell() {
  const box = $('#capture');
  box.innerHTML = `
    <div class="row"><span class="eyebrow">${meta.on ? 'Voice log · Meta AI' : 'Voice log'}</span><button type="button" class="close" id="cap-close" aria-label="Close">×</button></div>
    <div class="stage" id="cap-stage">
      <button type="button" class="orb" id="cap-orb" aria-label="Start or stop"><span class="ring" id="cap-ring"></span>${MIC}</button>
      <div class="status" id="cap-status">Tap to talk</div>
      <div class="pipeline" id="cap-pipe" ${meta.on ? '' : 'hidden'}><span data-step="hear">Muse Voice · hear</span><span data-step="think">Muse Spark · understand</span><span data-step="save">Saved on phone</span></div>
      <div class="timer" id="cap-timer"></div>
      <p class="heard" id="cap-heard" aria-live="polite"></p>
    </div>
    <div class="results" id="cap-results" hidden></div>
    <form class="typebox" id="cap-form">
      <label for="cap-input" id="cap-hint">Or type it like a text:</label>
      <div><input id="cap-input" autocomplete="off" enterkeyhint="done" placeholder="40 cash on guards at Sally's"><button class="btn" type="submit">Log</button></div>
    </form>`;
  $('#cap-close').onclick = closeCapture;
  $('#cap-orb').onclick = () => (mode === 'listening' ? stopListening() : mode === 'idle' || mode === 'done' ? startListening() : null);
  $('#cap-form').onsubmit = (ev) => {
    ev.preventDefault();
    const v = $('#cap-input').value.trim();
    if (!v) return;
    $('#cap-input').value = ''; $('#cap-input').blur();
    cancelListening();
    handleWords(v, 'typed');
  };
}

function setMode(next, status) {
  mode = next;
  $('#cap-stage').className = `stage ${next}`;
  if (status) $('#cap-status').textContent = status;
}
function pipeline(now, did = []) {
  $$('#cap-pipe span').forEach((s) => { s.className = s.dataset.step === now ? 'now' : did.includes(s.dataset.step) ? 'did' : ''; });
}
function startTimer() { startedAt = performance.now(); clearInterval(ticker); ticker = setInterval(() => { $('#cap-timer').textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)}s`; }, 100); }
const stopTimer = () => clearInterval(ticker);

export function openCapture({ listen = true, words = null } = {}) {
  shell();
  $('#capture').hidden = false;
  mode = 'idle';
  if (words) return handleWords(words, 'typed');
  if (listen && (useMetaVoice() || BrowserSpeech)) startListening();
  else if (!useMetaVoice() && !BrowserSpeech) { $('#cap-status').textContent = 'Type it'; $('#cap-hint').textContent = "Voice isn't available in this browser. Type it, or use your keyboard's mic:"; }
}

export function closeCapture() {
  cancelListening();
  stopTimer();
  $('#capture').hidden = true;
  $('#capture').innerHTML = '';
  mode = 'idle';
  rerender();
}

async function startListening() {
  $('#cap-results').hidden = true;
  $('#cap-heard').textContent = '';
  $('#cap-orb').innerHTML = `<span class="ring" id="cap-ring"></span>${MIC}`;
  if (useMetaVoice()) {
    mic = new MicCapture({
      onLevel: (lvl) => { const r = $('#cap-ring'); if (r) r.style.setProperty('--lvl', String(1 + Math.min(0.35, lvl * 4))); },
      onPause: () => { if (mode === 'listening') stopListening(); }
    });
    try { await mic.start(); } catch {
      setMode('idle', 'Tap to talk');
      $('#cap-hint').textContent = 'The microphone is blocked. Allow it in Settings, or type here:';
      return;
    }
    setMode('listening', 'Listening…');
    pipeline('hear');
    $('#cap-heard').textContent = 'Say it like a text. I stop when you pause.';
    startTimer();
    return;
  }
  if (!BrowserSpeech) return;
  speech = new BrowserSpeech();
  Object.assign(speech, { lang: 'en-US', interimResults: true, continuous: false });
  let finalText = '', latest = '';
  speech.onstart = () => { setMode('listening', 'Listening…'); startTimer(); };
  speech.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
    latest = (finalText + interim).trim();
    $('#cap-heard').textContent = latest;
  };
  speech.onerror = (ev) => { if (ev.error === 'not-allowed') $('#cap-hint').textContent = 'The microphone is blocked. Allow it in Settings, or type here:'; };
  speech.onend = () => {
    stopTimer();
    const words = (finalText || latest).trim();
    speech = null;
    if (words) handleWords(words, 'voice'); else setMode('idle', 'Tap to talk');
  };
  try { speech.start(); } catch { setMode('idle', 'Tap to talk'); }
}

async function stopListening() {
  if (speech) { try { speech.stop(); } catch { /* ended */ } return; }
  if (!mic) return;
  const wav = mic.stop();
  mic = null;
  if (!wav) { stopTimer(); setMode('idle', 'Tap to talk'); pipeline(null); $('#cap-heard').textContent = "Didn't catch anything. Tap and try again."; return; }
  setMode('thinking', 'Hearing…');
  try {
    const { text } = await meta.hear(wav);
    if (!text) throw new Error('empty');
    await handleWords(text, 'voice', ['hear']);
  } catch {
    stopTimer(); pipeline(null);
    setMode('idle', 'Tap to talk');
    $('#cap-heard').textContent = '';
    $('#cap-hint').textContent = "Couldn't hear that clearly. Try again, or type it:";
  }
}

function cancelListening() {
  if (mic) { mic.cancel(); mic = null; }
  if (speech) { try { speech.abort(); } catch { /* ended */ } speech = null; }
}

async function handleWords(said, how, done = []) {
  $('#cap-heard').textContent = said;
  if (!startedAt || how === 'typed') startTimer();
  let entries = null, unclear = null;
  if (meta.on) {
    setMode('thinking', 'Understanding…');
    pipeline('think', done);
    try {
      const r = await meta.understand(said);
      unclear = r.unclear;
      entries = (r.entries || []).map((raw) => entryFromModel(raw, said, how));
    } catch (err) {
      console.warn('Meta AI unavailable, understanding on the phone', err);
      entries = null;
    }
  }
  if (!entries) entries = [understandOnDevice(said, how)];
  stopTimer();

  const ready = entries.filter((e) => e.amount > 0);
  if (!ready.length) {
    if (unclear && entries.length === 0) {
      setMode('idle', 'Nothing to log'); pipeline(null);
      $('#cap-hint').textContent = `${unclear} Try again, or type it:`;
      return;
    }
    const { id, fresh, ...first } = entries[0] || {};
    closeCapture();
    openEditor(null, { preset: { ...first, amount: '', needsCheck: false } });
    return;
  }

  for (const e of ready) await saveEntry(e);
  buzz(18);
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  setMode('done', `Saved in ${seconds}s${ready.length > 1 ? ` · ${ready.length} entries` : ''}`);
  pipeline(null, meta.on && ready[0].by === 'Muse Spark' ? [...done, 'think', 'save'] : []);
  $('#cap-orb').innerHTML = CHECK;
  showResults(ready);
}

function showResults(saved) {
  const single = saved.length === 1;
  const tags = (e) => [
    e.type === 'trip' ? '<span class="tag ok">Miles</span>' : e.payment ? `<span class="tag">${e.payment}</span>` : '<span class="tag warn">Cash or card?</span>',
    e.type === 'income' ? '<span class="tag ok">Income</span>' : `<span class="tag ok">Line ${category(e.category).line}</span>`,
    e.needsCheck ? '<span class="tag warn">Check</span>' : ''
  ].join('');
  const sub = (e) => (e.type === 'trip' ? `${e.miles} mi × 72.5¢ · ${e.purpose || e.description}` : e.description || (e.type === 'income' ? 'Service income' : category(e.category).name));
  const box = $('#cap-results');
  box.innerHTML = `
    <div class="${single ? 'single' : ''}">${saved.map((e) => `<div class="result"><b>${esc(e.payee || (e.type === 'income' ? 'Income' : 'Who was paid?'))}</b><span class="num${e.type === 'income' ? ' in' : ''}">${e.type === 'income' ? '+' : ''}${usd(e.amount)}</span><span class="sub">${esc(sub(e))}</span><span class="tags">${tags(e)}</span></div>`).join('')}</div>
    ${saved.filter((e) => e.warning).map((e) => `<p class="warning">${esc(e.warning)}</p>`).join('')}
    <p class="note">${saved[0].by === 'Muse Spark' ? 'Understood by Muse Spark · your words are saved with each entry' : 'Understood on the phone · give it a quick check'}</p>
    <div class="three-btn"><button type="button" class="btn quiet" id="cap-undo">Undo</button><button type="button" class="btn quiet" id="cap-fix">${single ? 'Fix' : 'Review'}</button><button type="button" class="btn" id="cap-again">Another</button></div>`;
  box.hidden = false;
  $('#cap-undo').onclick = async () => { for (const e of saved) await deleteEntry(e.id); closeCapture(); toast(single ? 'Removed' : `Removed ${saved.length} entries`); };
  $('#cap-fix').onclick = () => { closeCapture(); if (single) openEditor(state.entries.find((x) => x.id === saved[0].id)); else { state.filter = 'all'; state.view = 'ledger'; rerender(); } };
  $('#cap-again').onclick = () => { $('#cap-results').hidden = true; pipeline(null); $('#cap-timer').textContent = ''; startListening(); };
}
