/**
 * GH-768 (queue item 3vm) — WHAT THE SERVER ANSWERS FOR A LIVE AA SAMPLE, THROUGH A REAL LOGIN.
 *
 * The server's AA table carried five nutrients of ten, so Fe, Mn, Zn, Cu and B on an AA site were
 * graded by MLSN's single thresholds. All ten now come from `assets/aa-ranges.json`, the engine's own
 * numbers. The grade grid holds the two equal on invented inputs; this asks the running server about
 * the samples a client actually has, through the same route the soil page calls.
 *
 * WHAT THIS MEASURES AND WHAT IT DOES NOT. It measures the answer of `GET /api/samples/{id}/analyse`
 * in a real session: the status, the class and the threshold label per nutrient. It does NOT measure
 * the rendered card. That the soil page prints these fields is established by reading
 * `assets/soil-nutrition-analysis.js`, not by this test, and the distinction is kept rather than
 * blurred.
 *
 * THE STAND IS READ ONLY HERE: this test logs in and issues GETs. It does not move the active-site
 * pointer, does not write a sample and does not touch `Hoxton Soccer - Kate's test`, which is one of
 * the sites left alone by instruction -- its samples are read through the API like any other.
 *
 * WHAT THE STAND-SITE CENSUS SEES OF THIS FILE, named because a partial entry reads as a whole one:
 * the inventory (`tests/fixtures/gh703-stand-site-references.json`) lists `Test5 - NZ` alone, and
 * that is not an omission. The census's universe of names is the names DECLARED BY FIXTURES, and
 * `Test - GC - NZ - delivery`, `Test - GC - NZ - warm season grass test` and
 * `Hoxton Soccer - Kate's test` are declared by none, so it cannot see them named here. This file
 * names all four, and only reads them.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH768=1 npx jest tests/e2e/gh768-aa-micronutrients-on-screen-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { guardStand } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH768 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH)
    ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The AA samples on the stand that carry a micronutrient reading, and what the engine says. */
const CASES = [
    { sample: 141, site: 'Test5 - NZ', nutrient: 'Fe', reading: 168, engine: 'High', label: '40-100' },
    { sample: 141, site: 'Test5 - NZ', nutrient: 'Zn', reading: 5.7, engine: 'High', label: '1-5' },
    { sample: 154, site: 'Test - GC - NZ - warm season grass test', nutrient: 'B', reading: 0.3, engine: 'Low', label: '0.4-1.5' },
    { sample: 155, site: 'Test - GC - NZ - delivery', nutrient: 'Fe', reading: 48, engine: 'Sufficient', label: '40-100' },
];

(ENABLED ? describe : describe.skip)('GH-768 — the live server grades an AA micronutrient as the engine does', () => {
    let browser, page, held;

    beforeAll(async () => {
        browser = await chromium.launch();
        const context = await browser.newContext();
        // GH-519's remedy, named rather than assumed: this test issues GETs only, so the guard
        // should hold nothing -- and that is exactly why it is here. "It only reads" is a claim
        // about the code I wrote; the guard is what makes it a measurement, and it prints what it
        // held and what it let through.
        held = await guardStand(context);
        page = await context.newPage();
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
            page.click('form.login-form button[type=submit]'),
        ]);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
    }, 120000);

    afterAll(async () => { if (browser) await browser.close(); });

    test('each live AA micronutrient comes back with the engine range, not an MLSN threshold', async () => {
        const rows = [];
        for (const c of CASES) {
            const got = await page.evaluate(async (id) => {
                const r = await fetch('/api/samples/' + id + '/analyse', {
                    credentials: 'same-origin', headers: { Accept: 'application/json' },
                });
                return { status: r.status, body: r.ok ? await r.json() : (await r.text()).slice(0, 200) };
            }, c.sample);
            const list = (got.body && (got.body.nutrients || (got.body.data || {}).nutrients)) || [];
            const row = list.find((n) => n.nutrient === c.nutrient) || null;
            rows.push({
                sample: c.sample, site: c.site, nutrient: c.nutrient, http: got.status,
                actual: row && row.actual, status: row && row.status,
                statusClass: row && row.statusClass, label: row && row.mlsn,
                expected: { status: c.engine, label: c.label },
            });
        }
        rows.forEach((r) => process.stdout.write('[gh768] ' + r.site + ' #' + r.sample + ' ' + r.nutrient
            + ': HTTP ' + r.http + ' | actual ' + JSON.stringify(r.actual)
            + ' | server ' + JSON.stringify(r.status) + ' / ' + JSON.stringify(r.label)
            + ' | engine ' + r.expected.status + ' / ' + r.expected.label + '\n'));

        // The list, not a count: four rows of the wrong four would count the same.
        expect(rows.map((r) => [r.sample, r.nutrient, r.status, r.label]))
            .toEqual(CASES.map((c) => [c.sample, c.nutrient, c.engine, c.label]));

        // And the stand is where it was, said by the guard rather than by me.
        process.stdout.write('[gh768] ' + held.report() + '\n');
        expect(held.held).toEqual([]);
    }, 120000);
});
