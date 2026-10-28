// CPA packet: ledger CSV + Schedule C summary + receipt photos, zipped on the phone.
import { state, inYear, scheduleC } from './state.js';
import { category, deductible, MILEAGE_RATE } from './categories.js';
import { store } from './store.js';
import { esc, usd, handOver, toast } from './ui.js';

const cell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function ledgerCSV(year, photoNames = {}) {
  const header = ['Date', 'Type', 'Payee', 'Description', 'Business purpose', 'Amount', 'Deductible', 'Paid with', 'Schedule C line', 'Category', 'Miles', 'Receipt photo', 'How logged', 'Understood by', 'Original words', 'Logged at'];
  const rows = inYear(year)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((e) => {
      const c = e.type === 'income' ? null : category(e.category);
      return [
        e.date, e.type, e.payee, e.description, c ? (e.purpose || c.purpose) : 'Service income',
        e.amount.toFixed(2), deductible(e).toFixed(2), e.payment || '', c ? c.line : '1', c ? c.name : 'Gross receipts',
        e.miles ?? '', e.receiptId ? (photoNames[e.receiptId] || 'yes') : '', e.how, e.by || '', e.said || '',
        e.createdAt ? new Date(e.createdAt).toLocaleString('en-US') : ''
      ].map(cell).join(',');
    });
  return '﻿' + [header.join(','), ...rows].join('\r\n');
}

export function summaryHTML(year) {
  const s = scheduleC(year);
  const who = state.settings.name ? esc(state.settings.name) : 'Self-employed barber';
  return `<!doctype html><meta charset="utf-8"><title>Schedule C summary ${year}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 18px;color:#111}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:7px 4px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}tfoot td{font-weight:700;border-top:2px solid #111}small{color:#555}</style>
<h1>Schedule C expense summary, ${year}</h1>
<p>${who} · prepared with Chairwise on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
<p>${s.count} entries, ${s.withPhoto} with receipt photos. Each entry keeps the date, amount, payee, business purpose and the owner's original words.</p>
<table><thead><tr><th>Line</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
${s.gross > 0 ? `<tr><td>1</td><td>Gross receipts (logged income)</td><td class="r">${usd(s.gross)}</td></tr>` : ''}
${s.lines.map((l) => `<tr><td>${l.line}</td><td>${l.name}${l.line === '9' && s.miles ? ` <small>(${s.miles.toLocaleString()} business miles × $${MILEAGE_RATE})</small>` : ''}</td><td class="r">${usd(l.amount)}</td></tr>`).join('')}
</tbody><tfoot><tr><td>28</td><td>Total expenses</td><td class="r">${usd(s.total)}</td></tr>${s.gross > 0 ? `<tr><td>31</td><td>Net profit (estimate)</td><td class="r">${usd(s.net)}</td></tr>` : ''}</tfoot></table>
${s.gross > 0 ? '' : '<p>Income was not tracked in Chairwise; use payment-processor and bank records for Line 1.</p>'}
<p><small>Meals counted at 50%. Mileage at the 2026 IRS standard rate. These are the taxpayer's own records for a tax professional to review; not tax advice.</small></p>`;
}

// --- Minimal ZIP writer (no compression; photos are already JPEG) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
const crc32 = (bytes) => { let c = ~0; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return ~c >>> 0; };

export function zip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const out = []; const dir = []; let offset = 0;
  for (const { name, bytes } of files) {
    const n = enc.encode(name); const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, bytes.length, 4], [22, bytes.length, 4], [26, n.length, 2], [28, 0, 2]]
      .forEach(([o, v, size]) => (size === 4 ? local.setUint32(o, v, true) : local.setUint16(o, v, true)));
    out.push(local.buffer, n, bytes);
    const central = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, bytes.length, 4], [24, bytes.length, 4], [28, n.length, 2], [42, offset, 4]]
      .forEach(([o, v, size]) => (size === 4 ? central.setUint32(o, v, true) : central.setUint16(o, v, true)));
    dir.push(central.buffer, n);
    offset += 30 + n.length + bytes.length;
  }
  const dirSize = dir.reduce((a, p) => a + (p.byteLength ?? p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true); end.setUint32(16, offset, true);
  return new Blob([...out, ...dir, end.buffer], { type: 'application/zip' });
}

export async function cpaPacket(year) {
  const enc = new TextEncoder();
  const photos = []; const names = {};
  const withPhotos = inYear(year).filter((e) => e.receiptId).sort((a, b) => a.date.localeCompare(b.date));
  for (const e of withPhotos) {
    if (names[e.receiptId]) continue;
    const r = await store.get('receipts', e.receiptId);
    if (!r?.blob) continue;
    const name = `receipts/${e.date}_${(e.payee || 'receipt').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 28) || 'receipt'}_${photos.length + 1}.jpg`;
    names[e.receiptId] = name;
    photos.push({ name, bytes: new Uint8Array(await r.blob.arrayBuffer()) });
  }
  const files = [
    { name: `Chairwise ledger ${year}.csv`, bytes: enc.encode(ledgerCSV(year, names)) },
    { name: `Schedule C summary ${year}.html`, bytes: enc.encode(summaryHTML(year)) },
    ...photos
  ];
  await handOver(new File([zip(files)], `Chairwise CPA packet ${year}.zip`, { type: 'application/zip' }), 'CPA packet');
}

export async function downloadCSV(year) {
  await handOver(new File([ledgerCSV(year)], `Chairwise ledger ${year}.csv`, { type: 'text/csv' }), 'Ledger');
}

export function printSummary(year) {
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print, or use the CPA packet.'); return; }
  w.document.write(summaryHTML(year));
  w.document.close();
  setTimeout(() => w.print(), 300);
}
