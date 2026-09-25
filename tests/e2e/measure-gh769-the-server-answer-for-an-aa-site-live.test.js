/**
 * GH-769 (queue item 3vs, position 3) — WHAT THE SERVER ANSWERS FOR AN AA SITE WHOSE SAMPLE IS
 * PICKED FROM THE LIST, MEASURED BEFORE ANYTHING IS CHANGED.
 *
 * The owner saw AA thresholds after a run and "generic" after picking another soil sample, and said
 * it may be GH-768's subject. GH-768 was about the server grading AA micronutrients by MLSN's single
 * thresholds, and it closed at 17:35. So the first question is whether the report still reproduces,
 * and this file answers it by reading, not by repairing.
 *
 * WHAT IS ASSERTED, and it is the report's own claim: for a site whose methodology is AA, every
 * nutrient the server grades carries an AA RANGE (`rangeMin`/`rangeMax`), not a single MLSN number.
 * The `rangeSource` is printed beside it, because "Generic" on the page is that field's
 * `texture-fallback` value and not a missing range.
 *
 * READ ONLY, and held to it by the GH-519 stand guard: the owner's site is read through the same GET
 * the soil page issues. Nothing is created, nothing is run, no pointer is moved.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH769=1 npx jest tests/e2e/measure-gh769-the-server-answer-for-an-aa-site-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { guardStand } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH769 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The owner's two soil samples on the AA site of the report. Read, never written. */
const SAMPLES = [324, 325];

(ENABLED ? describe : describe.skip)('GH-769 position 3 — the server answer for an AA site, measured', () => {
    let browser, page, held;

    beforeAll(async () => {
        browser = await chromium.launch();
        const context = await browser.newContext();
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

    test('every nutrient of an AA sample comes back with an AA range, and the range source is printed', async () => {
        const single = [];
        for (const id of SAMPLES) {
            const got = await page.evaluate(async (sid) => {
                const r = await fetch('/api/samples/' + sid + '/analyse', {
                    credentials: 'same-origin', headers: { Accept: 'application/json' },
                });
                return { status: r.status, body: r.ok ? await r.json() : (await r.text()).slice(0, 200) };
            }, id);
            const rows = (got.body && (got.body.nutrients || (got.body.data || {}).nutrients)) || [];
            process.stdout.write('[gh769] sample ' + id + ': HTTP ' + got.status + ', ' + rows.length + ' nutrients\n');
            rows.forEach((r) => {
                const hasRange = r.rangeMin != null && r.rangeMax != null;
                process.stdout.write('[gh769]   ' + r.nutrient + ': actual ' + JSON.stringify(r.actual)
                    + ' | status ' + JSON.stringify(r.status) + ' | label ' + JSON.stringify(r.mlsn)
                    + ' | range ' + (hasRange ? r.rangeMin + '-' + r.rangeMax : 'NONE')
                    + ' | source ' + JSON.stringify(r.rangeSource) + '\n');
                if (!hasRange) single.push(id + ' ' + r.nutrient + ' -> ' + JSON.stringify(r.mlsn));
            });
        }
        process.stdout.write('[gh769] ' + held.report() + '\n');

        // The list, not a count: which nutrient fell through matters, not how many.
        expect(single).toEqual([]);
        expect(held.held).toEqual([]);
    }, 120000);
});
