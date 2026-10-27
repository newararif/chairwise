// Sample data so judges and new users can look around. Marked sample=true and removable in one tap.
import { state, saveEntry, deleteEntry } from './state.js';
import { MILEAGE_RATE } from './categories.js';
import { today, shiftDays, round2, newId, fromISO } from './ui.js';

const EXPENSES = [
  // daysAgo, payee, description, amount, payment, category
  [0, 'Sally Beauty', 'Neck strips, 5 pack', 12.99, 'cash', 'supplies'],
  [1, 'Booksy', 'Monthly booking plan', 29.99, 'card', 'software'],
  [3, 'Salon Suites', 'Weekly suite rent', 275, 'card', 'rent'],
  [4, 'CosmoProf', 'Barbicide and razor blades', 41.37, 'card', 'supplies'],
  [6, 'Instagram', 'Boosted post', 15, 'card', 'advertising'],
  [8, 'Edge Sharpening', 'Shear sharpening, 2 pair', 50, 'cash', 'repairs'],
  [10, 'Salon Suites', 'Weekly suite rent', 275, 'card', 'rent'],
  [11, 'Amazon', 'Andis T-Outliner trimmer', 89.99, 'card', 'tools'],
  [13, 'Square', 'Card processing fees', 41.22, 'card', 'fees'],
  [17, 'Salon Suites', 'Weekly suite rent', 275, 'card', 'rent'],
  [22, 'State Board', 'Barber license renewal', 75, 'card', 'licenses'],
  [24, 'Salon Suites', 'Weekly suite rent', 275, 'card', 'rent'],
  [33, 'Barber Depot', 'Wahl Magic Clip cordless', 129.99, 'card', 'tools'],
  [41, 'Verizon', 'Phone bill, business share', 51, 'card', 'phone']
];
const TRIPS = [[2, 'Sally Beauty', 'Supply run', 12], [16, 'CosmoProf', 'Supply run', 18], [29, 'Edge Sharpening', 'Dropped off shears', 9]];

export async function loadSample() {
  const t = today();
  const at = (days, hour) => new Date(fromISO(shiftDays(t, -days)).getTime() + hour * 3600e3).toISOString();
  const all = [];
  for (const [d, payee, description, amount, payment, category] of EXPENSES) {
    all.push({ id: newId(), type: 'expense', amount, miles: null, payee, description, purpose: '', payment, category, date: shiftDays(t, -d), said: `${description}, ${amount} ${payment}, ${payee}`, how: 'voice', by: 'Muse Spark', warning: null, needsCheck: false, receiptId: null, createdAt: at(d, 10), sample: true });
  }
  for (const [d, payee, purpose, miles] of TRIPS) {
    all.push({ id: newId(), type: 'trip', amount: round2(miles * MILEAGE_RATE), miles, payee, description: payee, purpose, payment: null, category: 'mileage', date: shiftDays(t, -d), said: `Drove ${miles} miles to ${payee}`, how: 'voice', by: 'Muse Spark', warning: null, needsCheck: false, receiptId: null, createdAt: at(d, 13), sample: true });
  }
  all.push({ id: newId(), type: 'expense', amount: 8, miles: null, payee: '', description: 'Clipper oil', purpose: '', payment: 'cash', category: 'supplies', date: shiftDays(t, -5), said: 'uh eight bucks clipper oil', how: 'voice', by: 'on-device', warning: null, needsCheck: true, receiptId: null, createdAt: at(5, 15), sample: true });
  const card = [1240, 1310, 1180, 1290, 1350, 1220, 1160], cash = [310, 360, 290, 340, 380, 320, 300];
  card.forEach((amount, w) => {
    const d = w * 7 + 1;
    all.push({ id: newId(), type: 'income', amount, miles: null, payee: 'Card payments', description: 'Week of cuts', purpose: '', payment: 'card', category: null, date: shiftDays(t, -d), said: '', how: 'manual', by: null, warning: null, needsCheck: false, receiptId: null, createdAt: at(d, 20), sample: true });
    all.push({ id: newId(), type: 'income', amount: cash[w], miles: null, payee: 'Cash and tips', description: 'Week of cuts', purpose: '', payment: 'cash', category: null, date: shiftDays(t, -d), said: `made ${cash[w]} cash this week`, how: 'voice', by: 'Muse Spark', warning: null, needsCheck: false, receiptId: null, createdAt: at(d, 21), sample: true });
  });
  for (const e of all) await saveEntry(e);
}

export async function clearSample() {
  for (const e of state.entries.filter((x) => x.sample)) await deleteEntry(e.id);
}
