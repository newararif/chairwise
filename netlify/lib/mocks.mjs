// Canned answers for MOCK_META=1 (local development and automated tests without spending credits).

export function mockSpoken(text, today) {
  const t = text.toLowerCase();
  if (t.includes('drove')) {
    return { unclear: null, entries: [{ type: 'trip', amount: null, miles: 12, payee: 'Sally Beauty', description: 'Sally Beauty', payment: 'unknown', category: 'mileage', date: today, purpose: 'Supply run for client products', confidence: 0.93, warning: null }] };
  }
  if (t.includes('made') || t.includes('cleared')) {
    return { unclear: null, entries: [{ type: 'income', amount: 420, miles: null, payee: null, description: 'Saturday cuts', payment: 'cash', category: 'other', date: today, purpose: 'Haircut services', confidence: 0.9, warning: null }] };
  }
  return { unclear: null, entries: [
    { type: 'expense', amount: 40, miles: null, payee: 'Sally Beauty', description: 'Wahl clipper guards', payment: 'cash', category: 'tools', date: today, purpose: 'Tools used on clients', confidence: 0.95, warning: null },
    { type: 'expense', amount: 12, miles: null, payee: 'CosmoProf', description: 'Foils', payment: 'card', category: 'supplies', date: today, purpose: 'Supplies used on clients', confidence: 0.92, warning: null }
  ] };
}

export const mockTranscript = 'Spent forty cash on Wahl guards at Sally Beauty and twelve on foils at CosmoProf with my card';

export const mockReceipt = {
  readable: true, store: 'Valley Mart', date: '2026-10-25', payment: 'card', subtotal: 58.4, tax: 2.18, total: 60.58,
  headline: '4 of 7 items look like shop supplies.',
  lines: [
    { label: 'Spray bottles, 2 pack', price: 4.97, business: true, category: 'supplies', why: 'Used at the station' },
    { label: 'Disinfectant spray', price: 6.48, business: true, category: 'supplies', why: 'Sanitizing tools' },
    { label: 'Neck strips, 5 pack', price: 11.97, business: true, category: 'supplies', why: 'Single-use client supply' },
    { label: 'Hand towels, 6 pack', price: 12.88, business: true, category: 'supplies', why: 'Shop towels' },
    { label: 'Frozen pepperoni pizza', price: 6.98, business: false, category: 'other', why: 'Food is personal' },
    { label: 'Kids socks, 6 pair', price: 9.97, business: false, category: 'other', why: 'Clothing is personal' },
    { label: 'Energy drinks, 4 pack', price: 5.15, business: false, category: 'other', why: 'Drinks are personal' }
  ]
};

export const mockStatement = {
  readable: true, bank: 'Nittany Valley Bank', period: 'Oct 1 - Oct 27, 2026',
  headline: 'Found 5 likely write-offs and 2 to check.',
  transactions: [
    { date: '2026-10-02', merchant: 'Salon Suites', printed: 'SALON SUITES RENT ACH', amount: 275, direction: 'debit', business: 'yes', category: 'rent', why: 'Weekly suite rent' },
    { date: '2026-10-03', merchant: 'Booksy', printed: 'BOOKSY INC SUBSCRIPTION', amount: 29.99, direction: 'debit', business: 'yes', category: 'software', why: 'Booking app' },
    { date: '2026-10-06', merchant: 'Sally Beauty', printed: 'SALLY BEAUTY #1234 STATE COLLEGE', amount: 41.37, direction: 'debit', business: 'yes', category: 'supplies', why: 'Barber supplier' },
    { date: '2026-10-08', merchant: 'Walmart', printed: 'WAL-MART #2286', amount: 60.58, direction: 'debit', business: 'maybe', category: 'supplies', why: 'Mixed store: check the receipt' },
    { date: '2026-10-10', merchant: 'Square', printed: 'SQUARE FEES OCT', amount: 38.7, direction: 'debit', business: 'yes', category: 'fees', why: 'Card processing fees' },
    { date: '2026-10-12', merchant: 'Verizon', printed: 'VERIZON WIRELESS', amount: 85, direction: 'debit', business: 'maybe', category: 'phone', why: 'Only the business share counts' },
    { date: '2026-10-14', merchant: 'Instagram', printed: 'META ADS FACEBK', amount: 15, direction: 'debit', business: 'yes', category: 'advertising', why: 'Promoting your services' },
    { date: '2026-10-15', merchant: 'Sheetz', printed: 'SHEETZ 0412', amount: 38.2, direction: 'debit', business: 'no', category: 'other', why: 'Log the miles instead' },
    { date: '2026-10-18', merchant: 'Chipotle', printed: 'CHIPOTLE 1820', amount: 12.45, direction: 'debit', business: 'no', category: 'meals', why: 'Personal meal' },
    { date: '2026-10-20', merchant: 'Netflix', printed: 'NETFLIX.COM', amount: 15.49, direction: 'debit', business: 'no', category: 'other', why: 'Personal streaming' },
    { date: '2026-10-24', merchant: 'Square deposit', printed: 'SQUARE INC TRANSFER', amount: 1240, direction: 'credit', business: 'no', category: 'other', why: 'Money in, not an expense' }
  ]
};
