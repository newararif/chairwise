// POST /api/read-receipt  { image: "data:image/jpeg;base64,…", today }  ->  { receipt, model, ms }
// Muse Spark (vision) reads every line of a receipt and sorts business from personal.
import { config as muse, reply, sparkStructured, isoDateOr, MuseError } from '../lib/muse.mjs';
import { receiptReading } from '../lib/schemas.mjs';
import { receiptInstructions } from '../lib/prompts.mjs';
import { mockReceipt } from '../lib/mocks.mjs';

const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export default async function readReceipt(request) {
  if (request.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const image = String(body.image ?? '');
    const today = isoDateOr(body.today, new Date().toISOString().slice(0, 10));
    if (!DATA_URL.test(image)) return reply({ error: 'Send the photo as a JPEG, PNG or WebP data URL' }, 400);
    if (image.length > 10_000_000) return reply({ error: 'Photo is too large' }, 413);

    if (muse.mock) return reply({ receipt: mockReceipt, model: 'mock', ms: Date.now() - started });

    const { value, model, usage } = await sparkStructured({
      instructions: receiptInstructions(today),
      content: [
        { type: 'text', text: 'Read this receipt. List each item and whether it is a business expense for a barber.' },
        { type: 'image_url', image_url: { url: image } }
      ],
      schema: receiptReading,
      schemaName: 'receipt_reading',
      ms: 45000
    });
    return reply({ receipt: value, model, usage, ms: Date.now() - started });
  } catch (err) {
    console.error('[read-receipt]', err);
    return reply({ error: err.message }, err instanceof MuseError ? err.status : 500);
  }
}

export const config = { path: '/api/read-receipt' };
