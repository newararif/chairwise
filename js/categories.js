// IRS Schedule C categories, in the words a barber uses.

export const MILEAGE_RATE = 0.725; // 2026 IRS standard mileage rate, dollars per business mile
export const SE_TAX = 0.9235 * 0.153; // self-employment tax on net profit

export const CATEGORIES = {
  supplies:    { name: 'Supplies & products',  line: '22',  purpose: 'Supplies used on clients' },
  tools:       { name: 'Tools & equipment',    line: '22',  purpose: 'Tools used to serve clients' },
  rent:        { name: 'Booth or suite rent',  line: '20b', purpose: 'Rent for the chair where I work' },
  repairs:     { name: 'Repairs & sharpening', line: '21',  purpose: 'Keeping my tools working' },
  fees:        { name: 'Card fees',            line: '10',  purpose: 'Payment processing on client services' },
  advertising: { name: 'Advertising',          line: '8',   purpose: 'Bringing in new clients' },
  software:    { name: 'Booking & apps',       line: '27a', purpose: 'Booking and business software' },
  licenses:    { name: 'Licenses & permits',   line: '23',  purpose: 'Required professional license' },
  insurance:   { name: 'Insurance',            line: '15',  purpose: 'Liability coverage for my work' },
  education:   { name: 'Classes & shows',      line: '27a', purpose: 'Keeping my skills current' },
  mileage:     { name: 'Business miles',       line: '9',   purpose: 'Business driving' },
  travel:      { name: 'Travel',               line: '24a', purpose: 'Business travel' },
  meals:       { name: 'Business meals (50%)', line: '24b', purpose: 'Meal with a business contact' },
  phone:       { name: 'Phone & internet',     line: '25',  purpose: 'Business use of my phone' },
  laundry:     { name: 'Laundry & cleaning',   line: '27a', purpose: 'Cleaning towels and capes' },
  other:       { name: 'Other business cost',  line: '27a', purpose: 'Ordinary and necessary business cost' }
};

export const LINES = {
  '8': 'Advertising', '9': 'Car and truck expenses', '10': 'Commissions and fees', '15': 'Insurance (other than health)',
  '20b': 'Rent or lease: other business property', '21': 'Repairs and maintenance', '22': 'Supplies', '23': 'Taxes and licenses',
  '24a': 'Travel', '24b': 'Deductible meals', '25': 'Utilities', '27a': 'Other expenses'
};
export const LINE_ORDER = ['8', '9', '10', '15', '20b', '21', '22', '23', '24a', '24b', '25', '27a'];

export const category = (id) => CATEGORIES[id] || CATEGORIES.other;

/** The part of an entry that counts as a deduction. */
export function deductible(entry) {
  if (entry.type === 'income') return 0;
  return entry.category === 'meals' ? entry.amount * 0.5 : entry.amount;
}
