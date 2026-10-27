// POST /api/understand  { text, today }  ->  { entries, unclear, model, ms }
// Muse Spark turns a spoken sentence into ledger entries.
import { config as muse, reply, sparkStructured, isoDateOr, MuseError } from '../lib/muse.mjs';
import { spokenEntries } from '../lib/schemas.mjs';
import { spokenInstructions } from '../lib/prompts.mjs';
import { mockSpoken } from '../lib/mocks.mjs';

export default async function understand(request) {
  if (request.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text ?? '').trim().slice(0, 1200);
    const today = isoDateOr(body.today, new Date().toISOString().slice(0, 10));
    if (!text) return reply({ error: 'Nothing to understand' }, 400);

    if (muse.mock) return reply({ ...mockSpoken(text, today), model: 'mock', ms: Date.now() - started });

    const { value, model, usage } = await sparkStructured({
      instructions: spokenInstructions(today),
      content: text,
      schema: spokenEntries,
      schemaName: 'spoken_entries'
    });
    return reply({
      entries: Array.isArray(value.entries) ? value.entries.slice(0, 10) : [],
      unclear: value.unclear ?? null,
      model, usage, ms: Date.now() - started
    });
  } catch (err) {
    console.error('[understand]', err);
    return reply({ error: err.message }, err instanceof MuseError ? err.status : 500);
  }
}

export const config = { path: '/api/understand' };
