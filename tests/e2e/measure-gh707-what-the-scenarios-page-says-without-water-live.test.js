/**
 * GH-707 (queue item 3r) — WHAT THE SCENARIOS PAGE SAYS FOR A SITE WITH NO WATER SAMPLE.
 *
 * The scenario engine answers `qualityClass: "Excellent", sar: 0, riskScore: 0, concerns: []` when it
 * is handed no ions, and it manufactures the zeros itself: measured, its output on ten literal zeros
 * and on absent ions agrees byte for byte. What was NOT established is whether that verdict reaches a
 * person. The analyst said so plainly -- "I did not open the screen" -- and the page's own view
 * mentions neither `summary` nor `qualityClass`.
 *
 * So this reads the page. It prints what the page says about water for a site that has no water
 * sample at all, and it asserts the one thing the owner's rule settles: a positive verdict about
 * water must not be printed for a site whose water was never measured.
 *
 * READ ONLY, held to it by the GH-519 stand guard. The site is chosen by SQL and only read; no
 * pointer is moved and nothing is created.
 *
 * Run: GILBA_E2E=1 GILBA_E2E_GH707=1 npx jest tests/e2e/measure-gh707-what-the-scenarios-page-says-without-water-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { guardStand } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_GH707 === '1' && !!chromium;
const CREDENTIALS_PATH = process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json');
const credentials = fs.existsSync(CREDENTIALS_PATH) ? JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) : {};
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

(ENABLED ? describe : describe.skip)('GH-707 — the scenarios page for a site with no water sample', () => {
    let browser, page, held, site = null, seen = null;

    beforeAll(async () => {
        const row = query("SELECT CONCAT(st.id,'|',st.name) FROM sites st WHERE st.deleted_at IS NULL "
            + "AND NOT EXISTS (SELECT 1 FROM samples s WHERE s.site_id=st.id AND s.sample_type='water' "
            + "AND s.deleted_at IS NULL) AND EXISTS (SELECT 1 FROM site_configs c WHERE c.site_id=st.id "
            + "AND c.namespace='gaip') ORDER BY st.created_at LIMIT 1")[0];
        if (!row) throw new Error('no site without a water sample on the stand');
        const [id, name] = row.split('|');
        site = { id, name };

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

        await page.goto(BASE_URL + '/reports/scenarios?site=' + site.id, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(12000);
        seen = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const engine = typeof window.GAIP_ScenarioEngine === 'object' ? window.GAIP_ScenarioEngine : null;
            let fromEngine = null;
            try {
                if (engine && typeof engine.runWaterQualityEngine === 'function') {
                    fromEngine = engine.runWaterQualityEngine({});
                }
            } catch (e) { fromEngine = 'threw: ' + e.message; }
            return {
                waterWords: (text.match(/[^\n]*(Water quality|qualityClass|Excellent|SAR|water)[^\n]*/gi) || []).slice(0, 12),
                saysExcellent: /Excellent/i.test(text),
                engineOnScreen: !!engine,
                engineAnswerForNoWater: fromEngine && fromEngine.qualityClass ? {
                    qualityClass: fromEngine.qualityClass, sar: fromEngine.sar,
                    riskScore: fromEngine.riskScore, concerns: fromEngine.concerns,
                } : fromEngine,
            };
        });
    }, 180000);

    afterAll(async () => { if (browser) await browser.close(); });

    test('a site whose water was never measured is not told its water is excellent', () => {
        process.stdout.write('[gh707] site read: ' + JSON.stringify(site) + '\n'
            + '[gh707] the scenario engine is on the page: ' + JSON.stringify(seen.engineOnScreen) + '\n'
            + '[gh707] what it answers for no water: ' + JSON.stringify(seen.engineAnswerForNoWater) + '\n'
            + '[gh707] the page says, lines mentioning water: ' + JSON.stringify(seen.waterWords) + '\n'
            + '[gh707] ' + held.report() + '\n');

        expect(held.held).toEqual([]);
        expect(seen.saysExcellent).toBe(false);
    }, 60000);
});
