/**
 * GH-422 live check — the CEC the Plan scores products against is the sample's
 * own, on the screen and on the paper, and where there is none both surfaces
 * say so.
 *
 * WHAT WAS WRONG. `NutritionPrebbleIntegration.getSoilCEC()` resolved the
 * cation exchange capacity by re-reading the page: `GAIP_STATE.soil.cec` (a
 * slot nothing on plan.blade.php writes), then a `.gaip-cec` input (which lives
 * in partials/legacy-hub-markup.blade.php, so it exists on /reports/export and
 * never on /plan), then a construction-type guess, and finally a hardcoded 8.
 * Every New Zealand site therefore reached the recommender with CEC 8 on the
 * Plan whatever the certificate said, while the export passed the real figure.
 * It now reads the CEC the calendar computed the programme against, and returns
 * null — never a substitute number — where the sample has no reading.
 *
 * WHY A LIVE FILE AND NOT ONLY A SOURCE PIN. tests/gh422-soil-cec-input.test.js
 * pins the getter and pins what the recommender does with a CEC. This one
 * proves the value reaches both surfaces: it drives a real browser, reads the
 * figure the NZ panel painted, generates a real document, and reads the figure
 * word/document.xml carries for the same sample.
 *
 * THE TWO SITES, chosen as the two answers this getter can give:
 *
 *   Test5 - NZ / Soccer      — samples.payload CEC "5.9". The row that exposed
 *                              the bug: Plan 8 against the document's 5.9.
 *   Russley / Green 18       — no CEC on the sample at all. Both surfaces must
 *                              name it as missing rather than print a number.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh422-soil-cec-live.test.js --runInBand --testTimeout=600000
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const SITES = [
    {
        key: 'test5',
        siteId: '019e96f3-9294-72be-a13c-7fa7427afd5a',
        siteName: 'Test5 - NZ',
        sampleLabel: 'Soccer',
        expectedCEC: 5.9          // samples.payload -> CEC "5.9"
    },
    {
        key: 'russley',
        siteId: '019f35f0-d912-73e5-82bd-3de0bfd4f6ce',
        siteName: 'Russley',
        sampleLabel: 'Green 18',
        expectedCEC: null         // no CEC on this sample
    },
    // The other two New Zealand sites on the development database, so every
    // site the change can reach is read rather than reasoned about.
    {
        key: 'nz-delivery',
        siteId: '01a08b0b-4d6a-736d-a184-2fa1e04394b6',
        siteName: 'Test - GC - NZ - delivery',
        sampleLabel: '18th Green',
        expectedCEC: 8.5
    },
    {
        key: 'nz-warm',
        siteId: '01a08ae6-8a43-7004-99a6-8cddfc69b9cb',
        siteName: 'Test - GC - NZ - warm season grass test',
        sampleLabel: 'Main Oval',
        expectedCEC: 9.2
    }
];

const ONLY = process.env.GILBA_E2E_SITE;
const RUN = ONLY ? SITES.filter((s) => s.key === ONLY) : SITES;

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}
function docxText(xml) {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) parts.push(m[1]);
    return decodeEntities(parts.join(''));
}

/** The CEC the NZ recommendations panel painted, and whether it flagged it missing. */
/* istanbul ignore next — evaluated in the page, not in node */
function readPanelCecInPage() {
    const panel = document.querySelector('[data-nz-fertiliser-recommendations]')
        || document.querySelector('[data-prebble-recommendations]');
    if (!panel || panel.offsetParent === null) return { found: false };
    const items = Array.from(panel.querySelectorAll('.prebble-meta .meta-item'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
    const cecItem = items.find((t) => /^CEC:/.test(t)) || null;
    const banner = Array.from(panel.querySelectorAll('.gilba-nut-banner'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /No CEC on this soil sample/i.test(t)) || null;
    return {
        found: true,
        metaItems: items,
        cecItem: cecItem,
        missingFlagged: !!(panel.querySelector('.prebble-meta-missing')),
        banner: banner,
        programSoilCEC: (window.GAIP_NUTRITION_PROGRAM || {}).soilCEC,
        calendarCEC: (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.program
            && window.GilbaNutritionCalendar.program.soil
            && window.GilbaNutritionCalendar.program.soil.CEC)
    };
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh422-soil-cec-live skipped (needs the live stack)\n');
    test.skip('GH-422 live CEC check (disabled)', () => {});
} else {

RUN.forEach((site) => {
describe('GH-422 live — ' + site.siteName + ' / ' + site.sampleLabel, () => {
    let browser, page, previousActiveSiteId = null;
    let panel = null;
    let docxBody = '';
    const consoleLines = [];
    const out = (s) => process.stdout.write('[gh422][' + site.key + '] ' + s + '\n');

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); }
        catch (e) { throw new Error('`unzip` is not on PATH (used to read word/document.xml out of the .docx)'); }

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        page.on('console', (m) => {
            const t = m.text();
            if (/is not loaded|GH-42\d/i.test(t)) consoleLines.push(m.type() + ': ' + t.slice(0, 240));
        });
        page.on('pageerror', (e) => { consoleLines.push('pageerror: ' + (e && e.message)); });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

        const sites = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sites.active_site_id;
        await page.evaluate(async ({ id }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            await fetch('/api/active-site', {
                method: 'PATCH',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
            });
        }, { id: site.siteId });

        // ── Plan page ───────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
        await page.waitForTimeout(2500);
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1200);
        await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
        const picked = await page.evaluate((label) => {
            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
            if (!btn) return { ok: false, reason: 'no picker' };
            btn.click();
            const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
            const labels = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim());
            const i = labels.indexOf(label);
            if (i < 0) { btn.click(); return { ok: false, reason: 'label not in picker', available: labels }; }
            rows[i].click();
            return { ok: true, label: labels[i] };
        }, site.sampleLabel);
        if (!picked.ok) throw new Error('could not pin "' + site.sampleLabel + '": ' + JSON.stringify(picked));
        await page.waitForTimeout(1500);

        await page.evaluate(() => {
            window.__gh422 = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh422++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => window.__gh422 > 0
            && document.querySelectorAll('tr.gilba-nut-row').length === 12, null, { timeout: 90000 });
        await page.waitForTimeout(3000);
        panel = await page.evaluate(readPanelCecInPage);
        out('panel: ' + JSON.stringify(panel));

        // ── Word export, that one sample ────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // The settle the audit harness waits for: until this site's annual N is
        // resolved, the per-sample recompute has no soil to work from and the
        // export falls back to the programme collectData() carried — a document
        // with no Annual Nutrient Requirements table at all.
        await page.waitForFunction(() => {
            const el = document.querySelector('.gaip-nutrition-annual-n');
            return !!(el && el.value);
        }, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await page.click('text=Generate & Download Word');
        await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
        await page.waitForTimeout(500);
        await page.click('text=Deselect all');
        await page.waitForTimeout(300);
        const pick = await page.evaluate(({ id, label }) => {
            const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
            // The label lives in a sibling <td class="gaip-bulk-sample-label">,
            // not inside the checkbox's own cell — read the row.
            const rowText = (c) => (((c.closest('tr') || c.parentElement) || {}).textContent || '')
                .trim().replace(/\s+/g, ' ');
            const mine = boxes.filter((c) => String(c.getAttribute('data-sample-uid') || '').indexOf(id) === 0);
            let cb = mine.find((c) => rowText(c).indexOf(label) >= 0) || (mine.length === 1 ? mine[0] : null);
            if (!cb) return { found: false, available: mine.map((c) => c.getAttribute('data-sample-uid') + ' | ' + rowText(c)) };
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, text: rowText(cb),
                     checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
        }, { id: site.siteId, label: site.sampleLabel });
        if (!pick.found) throw new Error('no sample checkbox for ' + site.siteName + ': ' + JSON.stringify(pick));
        if (pick.checked !== 1) throw new Error('expected exactly one ticked sample, got ' + pick.checked);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const docxPath = path.join(os.tmpdir(), 'gilba-gh422-' + site.key + '-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        docxBody = docxText(execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
            { maxBuffer: 64 * 1024 * 1024 }).toString());
        try { fs.unlinkSync(docxPath); } catch (e) { /* */ }

        out('docx has the Nutrition Program intro: '
            + /Monthly fertiliser recommendations based on growth potential/.test(docxBody));
        out('docx CEC sentences: ' + JSON.stringify(
            (docxBody.match(/[^.]*(meq\/100g|No cation exchange capacity was recorded)[^.]*\./g) || []).slice(0, 4)));
        consoleLines.slice(0, 8).forEach((l) => out('console: ' + l));
    }, 600000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                    });
                }, { id: previousActiveSiteId });
            } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('the NZ panel names the CEC its product selection was scored against', () => {
        expect(panel && panel.found).toBe(true);
        expect(panel.cecItem).toBeTruthy();
    });

    test('the programme carries the sample\'s own CEC, not a substitute', () => {
        // The calendar's resolved value and the recommender's input are the
        // same number — that is the whole fix, expressed as an equality rather
        // than as a constant this file carries.
        if (site.expectedCEC === null) {
            expect(panel.programSoilCEC).toBeNull();
            expect(panel.calendarCEC == null).toBe(true);
        } else {
            expect(panel.programSoilCEC).toBeCloseTo(site.expectedCEC, 3);
            expect(parseFloat(panel.calendarCEC)).toBeCloseTo(site.expectedCEC, 3);
        }
    });

    test('the panel prints the figure, or says there is no reading — never 8', () => {
        if (site.expectedCEC === null) {
            expect(panel.cecItem).toMatch(/no reading on this sample/i);
            expect(panel.missingFlagged).toBe(true);
            expect(panel.banner).toMatch(/No CEC on this soil sample/i);
        } else {
            expect(panel.cecItem).toBe('CEC: ' + site.expectedCEC + ' meq/100g');
            expect(panel.missingFlagged).toBe(false);
            expect(panel.banner).toBeNull();
        }
    });

    test('the document states the same CEC the page did', () => {
        expect(docxBody).toMatch(/Nutrition Program/);
        if (site.expectedCEC === null) {
            expect(docxBody).toMatch(/No cation exchange capacity was recorded for this sample/i);
        } else {
            expect(docxBody).toMatch(
                new RegExp('cation exchange capacity, ' + String(site.expectedCEC).replace('.', '\\.') + ' meq/100g'));
            expect(docxBody).not.toMatch(/No cation exchange capacity was recorded/i);
        }
    });
});
});

}
