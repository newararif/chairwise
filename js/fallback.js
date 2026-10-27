// On-device understanding for when Meta AI is off, offline or slow.
// Deliberately simple: one entry per sentence, flagged for a quick check.
import { MILEAGE_RATE } from './categories.js';
import { today, shiftDays, round2, newId } from './ui.js';

const WORD_NUMBERS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "two seventy five" -> 275, "forty two" -> 42, "one hundred twenty" -> 120 */
export function spokenNumber(words) {
  const nums = words.map((w) => WORD_NUMBERS[w]);
  if (words.includes('hundred')) {
    const i = words.indexOf('hundred');
    const head = words.slice(0, i).reduce((a, w) => a + (WORD_NUMBERS[w] ?? 0), 0) || 1;
    const tail = words.slice(i + 1).reduce((a, w) => a + (WORD_NUMBERS[w] ?? 0), 0);
    return head * 100 + tail;
  }
  if (nums.length >= 2 && nums[0] < 10 && nums[1] >= 20) return nums[0] * 100 + nums.slice(1).reduce((a, n) => a + n, 0);
  return nums.reduce((a, n) => a + n, 0);
}

function findAmount(text) {
  const digits = text.match(/\$?\s?(\d{1,5}(?:\.\d{1,2})?)/);
  if (digits) return parseFloat(digits[1]);
  const word = [...Object.keys(WORD_NUMBERS), 'hundred', 'and'].sort((a, b) => b.length - a.length).join('|');
  const run = text.match(new RegExp(`\\b((?:(?:${word})\\b\\s*)+)`));
  if (!run) return null;
  const words = run[1].trim().split(/\s+/).filter((w) => w !== 'and');
  const n = spokenNumber(words);
  return n > 0 ? n : null;
}

const KEYWORDS = [
  ['rent', /\b(booth|chair|suite) rent|\brent\b/], ['repairs', /sharpen|repair/], ['fees', /processing|square fee|stripe/],
  ['advertising', /instagram|tiktok|facebook|boost|flyer|business card/], ['software', /booksy|vagaro|squire|glossgenius|styleseat/],
  ['licenses', /license|permit|state board/], ['insurance', /insurance/], ['education', /class|course|expo|hair show/],
  ['phone', /phone bill|internet/], ['laundry', /laundr|dry clean/], ['tools', /clipper|trimmer|shear|scissor|cape|comb|guard|dryer|razor\b/],
  ['supplies', /strip|barbicide|blade|foil|shampoo|pomade|gel|towel|glove|oil|spray|product|supplies|wax|color/]
];
const STORES = ['Sally Beauty', 'CosmoProf', 'Barber Depot', 'Amazon', 'Walmart', 'Target', 'Ulta', 'Costco', 'Home Depot', 'Booksy', 'Square', 'Instagram', 'Verizon', 'T-Mobile', 'Sheetz', 'Wawa', 'CVS'];

export function understandOnDevice(said, how) {
  const t = said.toLowerCase().replace(/-/g, ' ');
  const isTrip = /\b(drove|driving|drive)\b/.test(t) && /\bmiles?\b/.test(t);
  const isIncome = !isTrip && /\b(made|earned|cleared|took in|tips|got paid|collected)\b/.test(t);
  const n = findAmount(t);
  let date = today();
  if (/\byesterday\b/.test(t)) date = shiftDays(date, -1);
  const flat = t.replace(/\s/g, '');
  const payee = STORES.find((s) => flat.includes(s.toLowerCase().replace(/\s/g, ''))) || (t.match(/\bsally'?s\b/) ? 'Sally Beauty' : '');
  const category = isTrip ? 'mileage' : isIncome ? null : (KEYWORDS.find(([, re]) => re.test(t))?.[0] || 'other');
  return {
    id: newId(),
    type: isTrip ? 'trip' : isIncome ? 'income' : 'expense',
    miles: isTrip ? n : null,
    amount: n === null ? null : round2(isTrip ? n * MILEAGE_RATE : n),
    payee, description: said.slice(0, 60), purpose: '',
    payment: /\bcash\b/.test(t) ? 'cash' : /\b(card|debit|credit|apple pay|venmo|zelle|cash app)\b/.test(t) ? 'card' : null,
    category, date, said, how, by: 'on-device', warning: null, needsCheck: true, receiptId: null, fresh: true
  };
}
