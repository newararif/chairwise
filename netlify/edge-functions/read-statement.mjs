// POST /api/read-statement  { file: "data:application/pdf;base64,…" | "data:image/…", name, today }  ->  { statement, model, ms }
// Muse Spark reads a bank or card statement (PDF or screenshot) and picks out the likely business write-offs.
import { config as muse, reply, sparkStructured, isoDateOr, MuseError } from '../lib/muse.mjs';
import { statementReading } from '../lib/schemas.mjs';
import { statementInstructions } from '../lib/prompts.mjs';
import { mockStatement } from '../lib/mocks.mjs';

const PDF = /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/;
const IMAGE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export default async function readStatement(request) {
  if (request.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const file = String(body.file ?? '');
    const today = isoDateOr(body.today, new Date().toISOString().slice(0, 10));
    const isPdf = PDF.test(file);
    if (!isPdf && !IMAGE.test(file)) return reply({ error: 'Send the statement as a PDF or a screenshot (JPEG/PNG)' }, 400);
    if (file.length > 12_000_000) return reply({ error: 'Statement file is too large. Try one month at a time.' }, 413);

    if (muse.mock) return reply({ statement: mockStatement, model: 'mock', ms: Date.now() - started });

    const filePart = isPdf
      ? { type: 'file', file: { filename: String(body.name || 'statement.pdf').slice(0, 80), file_data: file } }
      : { type: 'image_url', image_url: { url: file } };

    const { value, model, usage } = await sparkStructured({
      instructions: statementInstructions(today),
      content: [{ type: 'text', text: 'Read this bank or card statement. List every transaction and mark which are business write-offs for a barber.' }, filePart],
      schema: statementReading,
      schemaName: 'statement_reading',
      ms: 60000
    });
    return reply({ statement: value, model, usage, ms: Date.now() - started });
  } catch (err) {
    console.error('[read-statement]', err);
    return reply({ error: err.message }, err instanceof MuseError ? err.status : 500);
  }
}

export const config = { path: '/api/read-statement' };
