// End-to-end test with canned Meta answers.
//   MOCK_META=1 PORT=8890 node tools/serve.mjs &   then   node tests/e2e.mjs
// Uses a fake microphone so the Muse Voice path runs too.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:8890';
const SHOTS = process.env.SHOTS || '';

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const entries = () => page.evaluate(() => window.chairwise.state.entries.map((e) => ({ type: e.type, payee: e.payee, amount: e.amount, miles: e.miles, category: e.category, by: e.by, receipt: Boolean(e.receiptId) })));

await page.goto(BASE);
await page.waitForFunction(() => document.querySelector('#ai-chip').textContent === 'Meta AI');
await shot('1-empty');

// 1. Voice: Muse Voice hears, Muse Spark splits one sentence into two entries.
await page.click('#talk');
await page.waitForSelector('.stage.listening');
await page.waitForTimeout(1200);
await page.click('#cap-orb');
await page.waitForSelector('#cap-results:not([hidden])');
assert.match(await page.textContent('#cap-status'), /2 entries/);
await shot('2-voice');

// 2. Typed mileage.
await page.click('#cap-again');
await page.waitForTimeout(200);
await page.click('#cap-orb');
await page.fill('#cap-input', 'drove 12 miles to sallys for supplies');
await page.press('#cap-input', 'Enter');
await page.waitForSelector('#cap-results:not([hidden])');
await shot('3-miles');
await page.click('#cap-close');

// 3. Receipt reader with the sample receipt.
await page.click('[data-go=receipts]');
await page.click('#rc-sample');
await page.waitForSelector('.line');
assert.equal((await page.textContent('.writeoff .num')).trim(), '$37.66');
await shot('4-receipt');
await page.click('.line[data-i="6"]');
assert.equal((await page.textContent('.writeoff .num')).trim(), '$43.00');
await page.click('.line[data-i="6"]');
await page.click('#rv-save');
await page.waitForSelector('#ledger:not([hidden]) .item');
await shot('5-ledger');

const list = await entries();
assert.deepEqual(list.map((e) => [e.type, e.payee, e.amount]).sort(), [
  ['expense', 'CosmoProf', 12], ['expense', 'Sally Beauty', 40], ['expense', 'Valley Mart', 37.66], ['trip', 'Sally Beauty', 8.7]
].sort());
assert.ok(list.every((e) => e.by === 'Muse Spark'));

// 4. Home and taxes render.
await page.click('[data-go=home]');
await shot('6-home');
await page.click('[data-go=taxes]');
assert.match(await page.textContent('.sched'), /Car and truck expenses/);
await shot('7-taxes');

// 5. Meta AI off -> on-device understanding still logs.
await page.click('#tx-ai');
await page.click('#talk');
await page.fill('#cap-input', 'booth rent two seventy five by card');
await page.press('#cap-input', 'Enter');
await page.waitForSelector('#cap-results:not([hidden])');
assert.match(await page.textContent('#cap-results'), /\$275\.00/);
await page.click('#cap-close');

assert.deepEqual(errors, []);
console.log('All checks passed:', (await entries()).length, 'entries');
await browser.close();
