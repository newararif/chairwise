// Small DOM and formatting helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const usd = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const usd0 = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// Dates are stored as local YYYY-MM-DD strings.
const two = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => toISO(new Date());
export const shiftDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');

export function niceDay(iso) {
  if (iso === today()) return 'Today';
  if (iso === shiftDays(today(), -1)) return 'Yesterday';
  const d = fromISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
export const clock = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const buzz = (ms = 15) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

let toastTimer;
export function toast(message, action) {
  const box = $('#toast');
  $('#toast-text').textContent = message;
  const btn = $('#toast-action');
  btn.hidden = !action;
  if (action) { btn.textContent = action.label; btn.onclick = () => { box.classList.remove('show'); action.run(); }; }
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), action ? 5000 : 2600);
}

// Bottom sheet
let onSheetClose = null;
export function openSheet(html, { onClose } = {}) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="handle" aria-hidden="true"></div>${html}`;
  sheet.hidden = false; $('#veil').hidden = false;
  onSheetClose = onClose || null;
  requestAnimationFrame(() => { sheet.classList.add('open'); $('#veil').classList.add('open'); });
  return sheet;
}
export function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('open'); $('#veil').classList.remove('open');
  const done = onSheetClose; onSheetClose = null;
  setTimeout(() => { sheet.hidden = true; $('#veil').hidden = true; sheet.innerHTML = ''; }, 260);
  done?.();
}
export const sheetIsOpen = () => !$('#sheet').hidden;

// Images
export async function shrinkPhoto(file, maxSide = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob((b) => ok(b || file), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}
export const blobToDataURL = (blob) => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(blob); });
export const dataURLToBlob = async (url) => (await fetch(url)).blob();

// Share a file (phone share sheet) or download it.
export async function handOver(file, label) {
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return; }
  } catch (err) { if (err?.name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`${label} downloaded`);
}
