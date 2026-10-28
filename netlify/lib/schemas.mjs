// JSON schemas Muse Spark must answer in (strict structured output:
// every object closed, every property required, nulls spelled out).

export const CATEGORY_IDS = [
  'supplies', 'tools', 'rent', 'repairs', 'fees', 'advertising', 'software',
  'licenses', 'insurance', 'education', 'mileage', 'travel', 'meals', 'phone', 'laundry', 'other'
];

const maybe = (type, description) => ({ type: [type, 'null'], description });

export const spokenEntries = {
  type: 'object',
  additionalProperties: false,
  required: ['entries', 'unclear'],
  properties: {
    unclear: maybe('string', 'If nothing loggable was said, a short reason; else null.'),
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'miles', 'payee', 'description', 'payment', 'category', 'date', 'purpose', 'confidence', 'warning'],
        properties: {
          type: { type: 'string', enum: ['expense', 'income', 'trip'] },
          amount: maybe('number', 'US dollars as said. null for trips and when no amount was said.'),
          miles: maybe('number', 'Business miles, only for type=trip.'),
          payee: maybe('string', 'Store, company or person paid (or who paid, for income). Proper capitalization.'),
          description: { type: 'string', description: '2 to 6 words: what was bought, the income, or the trip destination.' },
          payment: { type: 'string', enum: ['cash', 'card', 'unknown'] },
          category: { type: 'string', enum: CATEGORY_IDS },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          purpose: { type: 'string', description: 'Short business purpose an accountant would accept.' },
          confidence: { type: 'number', description: '0..1' },
          warning: maybe('string', 'One plain sentence if the barber should double-check (unclear amount, may be personal, commuting). Else null.')
        }
      }
    }
  }
};

export const receiptReading = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'store', 'date', 'payment', 'subtotal', 'tax', 'total', 'lines', 'headline'],
  properties: {
    readable: { type: 'boolean', description: 'false if this is not a legible receipt or invoice' },
    store: maybe('string', 'Store name'),
    date: maybe('string', 'YYYY-MM-DD if printed'),
    payment: { type: 'string', enum: ['cash', 'card', 'unknown'] },
    subtotal: maybe('number', 'Printed subtotal'),
    tax: maybe('number', 'Printed sales tax'),
    total: maybe('number', 'Printed total'),
    headline: { type: 'string', description: 'One short sentence for the barber, e.g. "4 of 7 items are shop supplies."' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'price', 'business', 'category', 'why'],
        properties: {
          label: { type: 'string', description: 'Readable item name, abbreviations expanded' },
          price: { type: 'number', description: 'Printed line price before tax' },
          business: { type: 'boolean' },
          category: { type: 'string', enum: CATEGORY_IDS },
          why: { type: 'string', description: 'Under 8 words' }
        }
      }
    }
  }
};

export const statementReading = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'bank', 'period', 'headline', 'transactions'],
  properties: {
    readable: { type: 'boolean', description: 'false if this is not a legible bank or card statement' },
    bank: maybe('string', 'Bank or card issuer name'),
    period: maybe('string', 'Statement period as printed, e.g. "Oct 1 - Oct 31, 2026"'),
    headline: { type: 'string', description: 'One short sentence for the barber, e.g. "Found 6 likely write-offs and 3 to check."' },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'merchant', 'printed', 'amount', 'direction', 'business', 'category', 'why'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          merchant: { type: 'string', description: 'Clean merchant name, e.g. "Sally Beauty"' },
          printed: { type: 'string', description: 'The description as printed, without any account or card numbers' },
          amount: { type: 'number', description: 'Positive dollar amount' },
          direction: { type: 'string', enum: ['debit', 'credit'], description: 'debit = money out, credit = money in or refund' },
          business: { type: 'string', enum: ['yes', 'maybe', 'no'] },
          category: { type: 'string', enum: CATEGORY_IDS },
          why: { type: 'string', description: 'Under 10 words' }
        }
      }
    }
  }
};
