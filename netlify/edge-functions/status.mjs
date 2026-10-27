// GET /api/status -> is Meta AI configured on this server?
import { config as muse, reply } from '../lib/muse.mjs';

export default function status() {
  return reply({ ready: muse.mock || Boolean(muse.key()), mock: muse.mock, models: { text: muse.textModel, voice: muse.voiceModel } });
}

export const config = { path: '/api/status' };
