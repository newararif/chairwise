// Records the mic as raw PCM and hands back a 16 kHz mono 16-bit WAV,
// the format Muse Voice Transcribe accepts. Stops by itself after a pause.

const TARGET_RATE = 16000;
const SPEECH_LEVEL = 0.02;   // RMS above this counts as talking
const PAUSE_SECONDS = 1.3;   // stop after this much quiet once speech started
const MAX_SECONDS = 15;

export class MicCapture {
  constructor({ onLevel, onPause } = {}) {
    this.onLevel = onLevel;
    this.onPause = onPause;
    this.context = null;
    this.running = false;
  }

  static supported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context ||= new Ctx();
    if (this.context.state === 'suspended') await this.context.resume();
    this.rate = this.context.sampleRate;
    this.buffers = [];
    this.spoke = false;
    this.quietFor = 0;
    this.elapsed = 0;
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => this.#take(event.inputBuffer.getChannelData(0));
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.running = true;
  }

  #take(samples) {
    if (!this.running) return;
    this.buffers.push(new Float32Array(samples));
    let energy = 0;
    for (let i = 0; i < samples.length; i += 2) energy += samples[i] * samples[i];
    const level = Math.sqrt(energy / (samples.length / 2));
    this.onLevel?.(level);
    const seconds = samples.length / this.rate;
    this.elapsed += seconds;
    if (level > SPEECH_LEVEL) { this.spoke = true; this.quietFor = 0; } else if (this.spoke) { this.quietFor += seconds; }
    if ((this.spoke && this.quietFor >= PAUSE_SECONDS) || this.elapsed >= MAX_SECONDS) this.onPause?.();
  }

  /** Stop and return a WAV Blob, or null if nobody spoke. */
  stop() {
    if (!this.running && !this.stream) return null;
    this.running = false;
    try { this.processor?.disconnect(); this.source?.disconnect(); } catch { /* already disconnected */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const pieces = this.buffers || [];
    this.buffers = [];
    if (!this.spoke || !pieces.length) return null;
    const length = pieces.reduce((n, p) => n + p.length, 0);
    const joined = new Float32Array(length);
    let at = 0;
    for (const p of pieces) { joined.set(p, at); at += p.length; }
    return encodeWav(resample(joined, this.rate, TARGET_RATE), TARGET_RATE);
  }

  cancel() { this.spoke = false; this.stop(); }
}

/** Box-filter resampling: average the source samples that fall in each output slot. */
export function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const step = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / step));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(input.length, Math.floor((i + 1) * step));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

export function encodeWav(samples, rate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(bytes);
  const ascii = (offset, s) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ascii(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}
