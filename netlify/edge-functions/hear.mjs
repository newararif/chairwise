// POST /api/hear  (body: audio/wav, 16 kHz mono 16-bit)  ->  { text, model, ms }
// Muse Voice Transcribe turns the barber's recording into text.
import { config as muse, reply, transcribeWav, MuseError } from '../lib/muse.mjs';
import { mockTranscript } from '../lib/mocks.mjs';

export default async function hear(request) {
  if (request.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const started = Date.now();
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    const isWav = bytes.length > 44 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF';
    if (!isWav) return reply({ error: 'Send a WAV recording' }, 400);
    if (bytes.length > 10_000_000) return reply({ error: 'Recording is too long' }, 413);

    if (muse.mock) return reply({ text: mockTranscript, model: 'mock', ms: Date.now() - started });

    const { text, model, audioMs } = await transcribeWav(bytes);
    return reply({ text, model, audioMs, ms: Date.now() - started });
  } catch (err) {
    console.error('[hear]', err);
    return reply({ error: err.message }, err instanceof MuseError ? err.status : 500);
  }
}

export const config = { path: '/api/hear' };
