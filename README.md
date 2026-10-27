# Chairwise

**Say what you spent between haircuts. Meta AI turns it into tax-ready records.**

Chairwise is a voice-first bookkeeping app for self-employed U.S. barbers and stylists: booth renters, suite owners and 1099 workers. About 80% of U.S. barbers work for themselves. They pay for blades and neck strips in cash, lose the receipts, and miss deductions at tax time. Bank-linked apps don't see cash, and nobody opens three apps between cuts.

Built for the **Meta Global AI Developer Hackathon 2026** · Indie track · theme *Build for Your World*.

## Three Meta models, one 3-second flow

| Step | Meta model | What happens |
|---|---|---|
| **Hear** | Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | The phone records the mic as raw audio, resamples it to 16 kHz mono WAV on the device, and Muse Voice returns the text. Recording stops by itself when the barber pauses. |
| **Understand** | Muse Spark (`muse-spark-1.3`, JSON-schema structured output) | One sentence becomes one or more ledger entries: amount ("two seventy five" = $275), payee, cash or card, date ("last Friday"), IRS Schedule C line, and a business purpose. It fixes speech slips ("barber side" → Barbicide), logs **business miles** at the 2026 IRS rate (72.5¢), and warns about things that may be personal or are commuting. |
| **Read** | Muse Spark vision | A receipt photo is read line by line. On a mixed Walmart run, only the shop items become write-offs, with their share of sales tax. The barber taps to keep or drop any item, and the list of what was left out is saved for the accountant. |

The app checks every model answer before saving it (amount ranges, valid dates, known categories), keeps the barber's original words on each entry, and flags anything uncertain for a quick look. When Meta AI is off, offline or slow, a small on-device parser keeps logging working.

## Privacy

- The ledger and receipt photos stay **on the phone** (IndexedDB). No bank login, no account.
- Only the words or photo being logged go to Meta's API, through Edge Functions that hold the API key. The server stores nothing.
- Meta AI can be switched off in Settings.

## Also in the app

Home dashboard (write-offs and estimated tax saved, take-home, self-employment tax set-aside, business miles), ledger with filters, receipt gallery, Schedule C estimate, one-tap **CPA packet** (ledger CSV + Schedule C summary + receipt photos, zipped on the phone), backup and restore, offline mode, install to home screen, iPhone Action Button shortcut (`/?voice=1`).

## Code map

```
index.html, css/app.css         app shell and styles (no framework, no build step)
js/main.js                      routing and startup
js/ai.js                        Meta AI client + validation of model output
js/recorder.js                  mic -> 16 kHz mono WAV with pause detection
js/fallback.js                  on-device understanding when AI is unavailable
js/state.js, js/store.js        ledger operations, IndexedDB storage
js/categories.js                Schedule C categories, 2026 mileage rate
js/export.js                    CSV, Schedule C summary, ZIP writer
js/views/*                      home, capture, editor, ledger, receipts, taxes
netlify/edge-functions/         hear, understand, read-receipt, status
netlify/lib/                    Meta Model API client, JSON schemas, prompts, mocks
tests/e2e.mjs                   end-to-end test (Playwright, mocked models, fake mic)
```

## Run it

**Deploy:** connect this repo to Netlify (no build command, publish directory `.`), add the environment variable `MODEL_API_KEY` with a Meta Model API key, and deploy.

**Locally:**
```bash
MODEL_API_KEY=your_key node tools/serve.mjs     # real Meta models
MOCK_META=1 node tools/serve.mjs                # canned answers, no key
# open http://localhost:8888

MOCK_META=1 PORT=8890 node tools/serve.mjs & node tests/e2e.mjs   # tests (needs playwright)
```

## Built during the hackathon

All code in this repository was written from scratch starting October 27, 2026, during the hackathon window (see the commit history). The idea and customer research come from my earlier work on Chairwise; no code from earlier prototypes was reused.

## Limits

Estimates, not tax advice; the barber's accountant makes the final call. Chairwise helps honest barbers prove what they spent. It can't protect anyone who lies.

---
Arif Saari · Penn State
