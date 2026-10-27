// Thin client for the Meta Model API (https://dev.meta.ai/docs).
// Runs inside Netlify Edge Functions (Deno) and under Node for local tests.
// The API key never leaves the server.

const readEnv = (name) => globalThis.Netlify?.env?.get?.(name) ?? globalThis.process?.env?.[name];

export const config = {
  base: readEnv('META_BASE_URL') || 'https://api.meta.ai/v1',
  textModel: readEnv('SPARK_MODEL') || 'muse-spark-1.3',
  voiceModel: readEnv('VOICE_MODEL') || 'muse-voice-transcribe-1.0',
  mock: readEnv('MOCK_META') === '1',
  key: () => readEnv('MODEL_API_KEY')
};

export class MuseError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function requireKey() {
  const key = config.key();
  if (!key) throw new MuseError('MODEL_API_KEY is not set on the server. Add it in Netlify → Site configuration → Environment variables, then redeploy.', 503);
  return key;
}

async function timedFetch(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    throw new MuseError(err.name === 'AbortError' ? 'Meta API timed out' : `Network error: ${err.message}`, 504);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Muse Spark for JSON that matches a schema (Chat Completions + structured output).
 * `content` is a string or an array of content parts (text / image_url).
 */
export async function sparkStructured({ instructions, content, schema, schemaName, effort = 'low', ms = 30000 }) {
  const key = requireKey();
  const request = {
    model: config.textModel,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content }
    ],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    reasoning_effort: effort
  };
  const send = (body) => timedFetch(`${config.base}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  }, ms);

  let res = await send(request);
  if (res.status === 400) {
    // Some optional knobs may not be accepted on every model version: retry once with the minimum.
    console.warn('[muse] 400 on first try:', (await res.text()).slice(0, 400));
    const { reasoning_effort, ...plain } = request;
    plain.response_format = { type: 'json_schema', json_schema: { name: schemaName, schema } };
    res = await send(plain);
  }
  if (!res.ok) throw new MuseError(`Muse Spark returned ${res.status}: ${(await res.text()).slice(0, 400)}`);

  const data = await res.json();
  const msg = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(msg) ? msg.map((p) => p.text ?? '').join('') : String(msg ?? '');
  return { value: parseLooseJSON(text), model: data.model || config.textModel, usage: data.usage ?? null };
}

/** Muse Voice Transcribe: WAV (16 kHz mono PCM16) in, text out. */
export async function transcribeWav(wavBytes, ms = 25000) {
  const key = requireKey();
  const form = new FormData();
  const settings = { model: config.voiceModel, audioEncoding: 'WAV', mode: 'PUSH_TO_TALK', languageBias: ['English'] };
  form.append('request', new Blob([JSON.stringify(settings)], { type: 'application/json' }));
  form.append('audio', new Blob([wavBytes], { type: 'audio/wav' }), 'speech.wav');
  const res = await timedFetch(`${config.base}/asr/transcribe`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    body: form
  }, ms);
  if (!res.ok) throw new MuseError(`Muse Voice returned ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return { text: String(data.transcript ?? data.text ?? '').trim(), audioMs: data.audioDurationMs ?? null, model: config.voiceModel };
}

export function parseLooseJSON(text) {
  try { return JSON.parse(text); } catch { /* model wrapped it in prose or fences */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new MuseError('Muse Spark did not return JSON');
}

export function isoDateOr(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value : fallback;
}
