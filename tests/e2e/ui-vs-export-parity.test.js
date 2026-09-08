/**
 * E2E parity harness — drives the real app and compares what the USER SEES on
 * the Plan page against what the CLIENT RECEIVES in the Word export.
 *
 * Why this exists: every engine fix in the GH-352..368 range was verified with
 * unit tests and console logs, which repeatedly turned out not to be the same
 * thing as verifying the rendered output. Two defects in that range
 * (GH-363's cached-programme fallback, GH-366's Plan-page tissue gap) produced
 * perfectly green unit tests while the two surfaces silently disagreed. This is
 * also the Hoxton audit's own assertion 20: "UI and export return identical
 * annual N, P and K requirements for the same site."
 *
 * It is OPT-IN: it needs a running stack and real credentials, so `npx jest`
 * stays green and offline without it. Run it with:
 *
 *   GILBA_E2E=1 \
 *   GILBA_E2E_EMAIL=you@example.com \
 *   GILBA_E2E_PASSWORD='...' \
 *   npx jest tests/e2e --testTimeout=180000
 *
 * Optional: GILBA_E2E_URL (default http://127.0.0.1:8080),
 *           GILBA_E2E_SAMPLE (sample search term, default "Soccer"),
 *           GILBA_E2E_KEEP=1 to leave the generated .docx on disk.
 *
 * playwright is resolved lazily and the suite skips with a clear message if it
 * isn't installed, so it never becomes a hard dependency of the repo.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';
const BASE_URL = process.env.GILBA_E2E_URL || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL;
const PASSWORD = process.env.GILBA_E2E_PASSWORD;
const SAMPLE = process.env.GILBA_E2E_SAMPLE || 'Soccer';

let chromium = null;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    chromium = null;
}

const canRun = ENABLED && chromium && EMAIL && PASSWORD;

if (ENABLED && !canRun) {
    // Say why rather than skipping silently — a harness that quietly does
    // nothing is worse than no harness.
    // eslint-disable-next-line no-console
    console.warn('[e2e] GILBA_E2E=1 but the run is not possible: ' +
        (!chromium ? 'playwright is not installed. ' : '') +
        (!EMAIL || !PASSWORD ? 'GILBA_E2E_EMAIL / GILBA_E2E_PASSWORD are not set. ' : ''));
}

/** Reads a .docx as plain text without adding a dependency. */
function docxToText(file) {
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString();
    return xml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/[ \t]+\n/g, '\n');
}

/**
 * "P\n0\nkg/ha/yr" style cards on the Plan page, and "Phosphorus (P) 0.0 kg/ha"
 * style rows in the export, both reduce to a nutrient -> number map.
 */
function annualFromPlanText(text) {
    // The cards render as: <value>\n<NUTRIENT>\nkg/ha/yr
    const out = {};
    const lines = text.split('\n').map((l) => l.trim());
    for (let i = 1; i < lines.length - 1; i++) {
        const nutrient = lines[i].replace(/GENERIC|CERTIFICATE/i, '').trim().toUpperCase();
        if (!['N', 'P', 'K', 'CA', 'MG', 'S'].includes(nutrient)) continue;
        if (!/^kg\/ha/i.test(lines[i + 1])) continue;
        const value = parseFloat(lines[i - 1].replace(/[^0-9.\-]/g, ''));
        if (!isNaN(value)) out[nutrient] = value;
    }
    return out;
}

function annualFromExportText(text) {
    // The Annual Nutrient Requirements table renders one cell per line:
    //   Sample | N kg/ha | P ppm | P req | K ppm | K req | S ppm | S req
    //   Soccer |   250   |  40   |  0.0  |  276  |  0.0  |  75   |  0.0
    // so the values are read positionally off the row after the header, not by
    // matching a label and a number on the same line (the labels live in their
    // own cells and the same "Phosphorus (P)" text also appears in the soil and
    // tissue panels above).
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const headerAt = lines.findIndex((l, i) =>
        l === 'Sample' && lines[i + 1] && /^N kg\/ha$/i.test(lines[i + 1]));
    if (headerAt === -1) return {};
    // Skip the 8 header cells, then the sample name, then the numbers.
    const row = lines.slice(headerAt + 8);
    const nums = [];
    for (let i = 1; i < row.length && nums.length < 7; i++) {
        const v = parseFloat(row[i]);
        if (isNaN(v)) break;
        nums.push(v);
    }
    if (nums.length < 6) return {};
    return { N: nums[0], P: nums[2], K: nums[4], S: nums[6] != null ? nums[6] : undefined };
}

/** Product names appearing in the export's Annual Product Summary. */
function productsFromExportText(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const start = lines.indexOf('Annual Product Summary');
    if (start === -1) return [];
    const end = lines.indexOf('Monthly Schedule', start);
    const slice = lines.slice(start, end === -1 ? start + 60 : end);
    // Product rows are the non-numeric, non-header cells.
    const headers = new Set(['Annual Product Summary', 'Product', 'Applications', 'Total kg/ha',
        'Total L/ha', 'N', 'P', 'K', 'S', 'Ca', 'Mg']);
    return slice.filter((l) => !headers.has(l) && isNaN(parseFloat(l)));
}

/** Every product name in the NZ catalogues (PGG Wrightson + Prebbles). */
function nzCatalogueNames() {
    const prevWindow = global.window;
    const prevDocument = global.document;
    global.window = {};
    global.document = { readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    try {
        jest.isolateModules(() => {
            require('../../assets/nz-fertiliser-products.js');
            require('../../assets/prebbles-products.js');
        });
        const nz = global.window.GAIP_NZ_FERTILISER;
        const pb = global.window.PrebbleProducts;
        return []
            .concat((nz && nz.products && nz.products.granular) || [])
            .concat((nz && nz.products && nz.products.liquid) || [])
            .concat((pb && pb.granular) || [])
            .concat((pb && pb.liquid) || [])
            .map((prod) => prod.name)
            .filter(Boolean);
    } finally {
        global.window = prevWindow;
        global.document = prevDocument;
    }
}

(canRun ? describe : describe.skip)('E2E — Plan page and Word export agree (Hoxton audit assertion 20)', () => {
    jest.setTimeout(180000);

    let browser, page, planText, exportText, docxPath;
    const consoleErrors = [];

    beforeAll(async () => {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
        page = await context.newPage();
        page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
        page.on('console', (m) => {
            const t = m.text();
            // Surface the engines' own fail-loud signals — a run where these
            // fire is not a clean run even if the numbers happen to match.
            if (/GH-36[0-9]:|climate data unavailable|per-sample programme failed/.test(t)) {
                consoleErrors.push('console: ' + t);
            }
        });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await page.click('form.login-form button[type=submit]');
        await page.waitForTimeout(2500);

        // Plan page: generate the programme and read what is on screen.
        await page.goto(BASE_URL + '/data', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1500);
        await page.click('#plan-nut-generate-btn');
        await page.waitForTimeout(6000);
        planText = await page.evaluate(() => {
            const el = document.querySelector('#plan-nut-results');
            return el ? el.innerText : '';
        });

        // Export: same site, same sample.
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await page.click('text=Generate & Download Word');
        await page.waitForTimeout(800);
        await page.click('text=Deselect all');
        await page.waitForTimeout(300);
        await page.fill('#csp-search', SAMPLE);
        await page.waitForTimeout(700);
        for (const cb of await page.$$('input[type="checkbox"]:visible')) {
            if (!(await cb.isChecked())) await cb.check();
        }
        await page.waitForTimeout(300);
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 120000 }),
            page.locator('button:has-text("Generate & Download")').last().click(),
        ]);
        docxPath = path.join(os.tmpdir(), 'gilba-e2e-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        exportText = docxToText(docxPath);
    });

    afterAll(async () => {
        if (browser) await browser.close();
        if (docxPath && fs.existsSync(docxPath) && process.env.GILBA_E2E_KEEP !== '1') {
            fs.unlinkSync(docxPath);
        }
    });

    test('the Plan page actually rendered a programme (not an empty or errored panel)', () => {
        expect(planText).toMatch(/ANNUAL REQUIREMENTS/i);
        expect(planText).toMatch(/MONTHLY NUTRIENT PROGRAM/i);
    });

    test('the export actually contains a nutrition section', () => {
        expect(exportText).toMatch(/Annual Nutrient Requirements|Nutrition Program/i);
    });

    test('no fail-loud signal fired during the run', () => {
        expect(consoleErrors).toEqual([]);
    });

    test('annual N/P/K on screen match the export (assertion 20)', () => {
        const ui = annualFromPlanText(planText);
        const ex = annualFromExportText(exportText);
        const compared = {};
        ['N', 'P', 'K'].forEach((n) => {
            if (ui[n] != null && ex[n] != null) compared[n] = { ui: ui[n], export: ex[n] };
        });
        // If neither surface exposed a number the harness could read, that is a
        // harness failure, not a pass.
        expect(Object.keys(compared).length).toBeGreaterThan(0);
        Object.keys(compared).forEach((n) => {
            // 1 kg/ha of rounding drift between the two renderers is tolerable;
            // anything larger is a real divergence.
            expect(Math.abs(compared[n].ui - compared[n].export)).toBeLessThanOrEqual(1);
        });
    });

    test('every product in the export exists in this region\'s own catalogue (assertion 14)', () => {
        const isNZ = /Prebble|NZ Fertiliser|Hill Labs|New Zealand/i.test(exportText);
        if (!isNZ) return; // an AU/UK site needs its own fixture for the inverse
        const inExport = productsFromExportText(exportText);
        expect(inExport.length).toBeGreaterThan(0);
        const catalogue = nzCatalogueNames();
        expect(catalogue.length).toBeGreaterThan(0);
        // Name-for-name, not a hand-written list of "foreign-looking" brands:
        // FoliMAX, for one, reads Australian but is a PGG Wrightson NZ line,
        // which is exactly the sort of attribution the audit itself flagged as
        // unverified recall.
        const missing = inExport.filter((name) =>
            !catalogue.some((c) => c === name || name.indexOf(c) === 0 || c.indexOf(name) === 0));
        expect(missing).toEqual([]);
    });
});
