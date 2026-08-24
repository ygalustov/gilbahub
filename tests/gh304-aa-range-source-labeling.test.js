/**
 * Test GH-304 — AA range-source labeling (D07 item 7, "label, don't remove"
 * decision, 2026-08-24).
 *
 * BACKGROUND: mlsnEngine()'s AA branch (GH-260) and SampleAnalysisController.
 * php's AA branch (GH-268) both overlay certificate-backed ranges (Hill Labs
 * SSOT, GH-258) on top of a texture-only sands/others fallback, but neither
 * path told any consumer WHICH source a given nutrient's range actually came
 * from. Confirmed live: an S277 (Hagley Oval, Perennial Ryegrass/Sand) site
 * correctly resolves certificate ranges for P/K/Ca/Mg, but S277's own
 * certificate prints no Sulphur range at all -- so the Soil page silently
 * showed a generic "sands" texture-only range (30.0-60.0 ppm) for S labelled
 * just "AA:", indistinguishable from the certificate-backed K/Ca/Mg ranges
 * sitting right next to it.
 *
 * DECISION (user, 2026-08-24): label the generic number, don't replace it
 * with a message (revisiting an earlier, stricter draft of item 7). The
 * figure stays; a small "Generic" badge/note makes clear it's a soil-texture
 * estimate, not a printed certificate value.
 *
 * FIX (this file covers all four pieces):
 *  1. hub-tissue-v3.js: mlsnEngine()'s isAA branch now tags each nutrient
 *     result with rangeSource ('certificate' | 'texture-fallback'), carried
 *     through the HTML round-trip as a data-range-source attribute.
 *  2. hub-persistence.js: both DOMParser scrapers (primary + GH-266 sample-
 *     switch fallback) read data-range-source into nutrients[].
 *  3. soil-nutrition-analysis.js: renderNutrientCards()/renderAnnualRequirements()
 *     render a "Generic" badge next to the figure when rangeSource is
 *     'texture-fallback' -- number unchanged, framing changes.
 *  4. site-settings-panel.js: an inline note on the Settings panel warns,
 *     before the user looks at any result page, when the selected AA
 *     species/texture combination has no certificate at all.
 *
 * (SampleAnalysisController.php's own rangeSource tagging is covered
 * separately by app/tests/Unit/SampleAnalysisControllerRangeSourceTest.php.)
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext, run } = require('./helpers/mlsn-engine-harness');

// ---------------------------------------------------------------------------
// 1. hub-tissue-v3.js — rangeSource tagging
// ---------------------------------------------------------------------------

describe('GH-304 — mlsnEngine() tags rangeSource per nutrient', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-tissue-v3.js'), 'utf8');
    });

    test('structural: aaRangeSource map is built and defaults every nutrient to texture-fallback', () => {
        expect(src).toMatch(/const aaRangeSource = \{\};/);
        expect(src).toMatch(/aaRangeSource\[nut\] = "texture-fallback";/);
    });

    test('structural: overlay loop flips a nutrient to certificate only when getRangesPpm() actually resolves', () => {
        const overlayMatch = src.match(/\["P", "K", "Ca", "Mg", "S"\]\.forEach\(\(nut\) => \{[\s\S]*?\n            \}\);/);
        expect(overlayMatch).not.toBeNull();
        expect(overlayMatch[0]).toMatch(/aaRangeSource\[nut\] = "certificate";/);
    });

    test('structural: rangeSource is attached to the nutrient result and carried via data-range-source', () => {
        expect(src).toMatch(/rangeSource: rangeSource,/);
        expect(src).toMatch(/data-range-source="\$\{r\.rangeSource\}"/);
    });

    test('structural: SLAN branch does not set rangeSource (AA-only)', () => {
        const start = src.indexOf('// SLAN range-based assessment (unchanged)');
        const end = src.indexOf('// GH-260', start);
        const slanBranch = src.slice(start, end);
        expect(slanBranch).not.toMatch(/rangeSource/);
    });

    let ctx;
    beforeAll(() => {
        ctx = buildContext();
    });

    test('behavioural: certificate-matched nutrient (S277 K) is tagged certificate', () => {
        const { row } = run(ctx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        expect(row('K').rangeSource).toBe('certificate');
    });

    test('behavioural: S277 site with Sulphur (no certificate range for S) tags S as texture-fallback, K still certificate', () => {
        const { row } = run(ctx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5,
            ppm: { K: 199, S: 75 },
        });
        const k = row('K');
        const s = row('S');
        expect(k.rangeSource).toBe('certificate');
        expect(s.rangeSource).toBe('texture-fallback');
        // S277 prints no Sulphur range at all -- confirms this really is the
        // generic "sands" bucket (30-60), not a certificate value.
        expect(s.rangeMin).toBeCloseTo(30, 0);
        expect(s.rangeMax).toBeCloseTo(60, 0);
    });

    test('behavioural: uncovered species (Kikuyu) tags K as texture-fallback', () => {
        const { row } = run(ctx, {
            methodology: 'ammonium_acetate', species: 'kikuyu', warmBase: true,
            construction: 'soil', soilTexture: 'loam', ppm: { K: 150 },
        });
        expect(row('K').rangeSource).toBe('texture-fallback');
    });

    test('regression: MLSN/SLAN rows never carry a rangeSource attribute', () => {
        expect(run(ctx, { methodology: 'mlsn', soilTexture: 'loam', ppm: { K: 50 } }).row('K').rangeSource).toBeUndefined();
        expect(run(ctx, { methodology: 'slan', soilTexture: 'loam', ppm: { K: 45 } }).row('K').rangeSource).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 2. hub-persistence.js — scraper reads data-range-source
// ---------------------------------------------------------------------------

function extractPrimaryScraperBlock(src) {
    const start = src.indexOf('var _parser = new DOMParser();');
    const forEachStart = src.indexOf('_rows.forEach(function(row) {', start);
    let depth = 0;
    let i = src.indexOf('{', forEachStart);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    const closeParen = src.indexOf(');', i);
    return src.slice(start, closeParen + 2);
}

function parseMlsnTableHtml(html) {
    const tbodyMatch = html.match(/<table class="gaip-mlsn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return [];
    const rowRe = /<tr class="([^"]*)"((?:\s+data-[\w-]+="[^"]*")*)>([\s\S]*?)<\/tr>/g;
    const rows = [];
    let m;
    while ((m = rowRe.exec(tbodyMatch[1]))) {
        const dataset = {};
        const attrRe = /data-([\w-]+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(m[2]))) {
            const camelKey = am[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            dataset[camelKey] = am[2];
        }
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells = [];
        let cm;
        while ((cm = cellRe.exec(m[3]))) {
            cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
        }
        rows.push({
            className: m[1],
            dataset: Object.keys(dataset).length ? dataset : undefined,
            querySelectorAll: (sel) => (sel === 'td' ? cells : []),
        });
    }
    return rows;
}

function runPrimaryScraper(html) {
    const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
    const block = extractPrimaryScraperBlock(src);
    const sandbox = {
        DOMParser: function() {
            this.parseFromString = (h) => ({
                querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(h) : []),
            });
        },
        _mlsnHtml: html,
        _nutrients: [],
        console: { warn: () => {} },
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(block, ctx);
    return ctx._nutrients;
}

describe('GH-304 — hub-persistence.js scraper carries rangeSource', () => {
    test('structural: primary scraper reads row.dataset.rangeSource', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        const block = extractPrimaryScraperBlock(src);
        expect(block).toContain('row.dataset ? row.dataset.rangeSource : undefined');
        expect(block).toContain('rangeSource:    _rangeSource || undefined');
    });

    test('structural: GH-266 sample-switch fallback scraper also reads rangeSource (both paths must agree)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        const smIdx = src.indexOf('_smD.querySelectorAll(\'.gaip-mlsn-table tbody tr\')');
        expect(smIdx).toBeGreaterThan(-1);
        const smBlock = src.slice(smIdx, smIdx + 3200);
        expect(smBlock).toContain('row.dataset ? row.dataset.rangeSource : undefined');
        expect(smBlock).toContain('rangeSource: _smRangeSource || undefined');
    });

    let engineCtx;
    beforeAll(() => {
        engineCtx = buildContext();
    });

    test('behavioural: certificate row -> rangeSource "certificate" survives the scrape', () => {
        const { html } = run(engineCtx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        const k = runPrimaryScraper(html).find((n) => n.nutrient === 'K');
        expect(k.rangeSource).toBe('certificate');
    });

    test('behavioural: texture-fallback row (S on S277) -> rangeSource "texture-fallback" survives the scrape', () => {
        const { html } = run(engineCtx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199, S: 75 },
        });
        const s = runPrimaryScraper(html).find((n) => n.nutrient === 'S');
        expect(s.rangeSource).toBe('texture-fallback');
    });

    test('regression: MLSN row has no rangeSource, no crash', () => {
        const { html } = run(engineCtx, { methodology: 'mlsn', soilTexture: 'loam', ppm: { K: 50 } });
        const k = runPrimaryScraper(html).find((n) => n.nutrient === 'K');
        expect(k.rangeSource).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. soil-nutrition-analysis.js — generic-range label rendering
// ---------------------------------------------------------------------------

function loadSoilNutritionAnalysis() {
    const realSrc = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
    expect(realSrc).toContain(exportLine);
    const testSrc = realSrc.replace(
        exportLine,
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, ' +
        '__test_renderNutrientCards: renderNutrientCards, __test_renderAnnualRequirements: renderAnnualRequirements };'
    );

    const sandbox = {
        window: {},
        document: { createElement: () => ({ textContent: '' }), querySelector: () => null },
        console: { log: () => {}, warn: () => {} },
        localStorage: { getItem: () => null },
    };
    sandbox.window.GAIP_DASHBOARD_DATA = {};
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'soil-nutrition-analysis.js' });
    return ctx.window.GAIP_SoilNutritionAnalysis;
}

describe('GH-304 — soil-nutrition-analysis.js labels generic-range figures', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    });

    test('structural: sn-generic-badge CSS class is defined', () => {
        expect(src).toMatch(/\.sn-generic-badge\{/);
    });

    test('structural: isGenericRange gate checks rangeSource === texture-fallback, AA-gated', () => {
        expect(src).toMatch(/var isGenericRange = isAA && n\.rangeSource === 'texture-fallback';/);
    });

    let mod;
    beforeAll(() => {
        mod = loadSoilNutritionAnalysis();
    });

    describe('renderNutrientCards()', () => {
        function snWith(nutrients) {
            return { methodology: 'ammonium_acetate', depthCm: 10, bulkDensity: 1.4, nutrients };
        }

        test('certificate-backed nutrient: no generic badge', () => {
            const html = mod.__test_renderNutrientCards(snWith([
                { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', targetPpm: '78.2', status: 'HIGH', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5, rangeSource: 'certificate' },
            ]));
            expect(html).not.toMatch(/sn-generic-badge/);
        });

        test('texture-fallback nutrient (S on S277): generic badge rendered next to the figure', () => {
            const html = mod.__test_renderNutrientCards(snWith([
                { nutrient: 'S', actual: '75.0', mlsn: '30.0-60.0', targetPpm: '30.0', status: 'HIGH', statusClass: 'high', rangeMin: 30, rangeMax: 60, rangeSource: 'texture-fallback' },
            ]));
            expect(html).toMatch(/sn-generic-badge/);
            expect(html).toMatch(/Generic/);
            // The figure itself is still shown, not replaced.
            expect(html).toMatch(/AA: 30\.0-60\.0 ppm/);
        });

        test('follow-up fix: badge click actually opens the Why? panel (not just a hover title with no action)', () => {
            const html = mod.__test_renderNutrientCards(snWith([
                { nutrient: 'S', actual: '75.0', mlsn: '30.0-60.0', targetPpm: '30.0', status: 'HIGH', statusClass: 'high', rangeMin: 30, rangeMax: 60, rangeSource: 'texture-fallback' },
            ]));
            // A Why? button with an id exists, and the badge's onclick invokes it.
            const btnIdMatch = html.match(/<button id="(sn-whybtn-\d+)" class="sn-why-btn"/);
            expect(btnIdMatch).not.toBeNull();
            const badgeMatch = html.match(/<span class="sn-generic-badge"[^>]*onclick="document\.getElementById\('([^']+)'\)\.click\(\)"[^>]*>Generic<\/span>/);
            expect(badgeMatch).not.toBeNull();
            expect(badgeMatch[1]).toBe(btnIdMatch[1]);
        });

        test('follow-up fix: badge no longer has the misleading cursor:help with no click action -- CSS base rule has no cursor property', () => {
            const cssRule = src.match(/'\.sn-generic-badge\{[^']*\}'/)[0];
            expect(cssRule).not.toMatch(/cursor:\s*help/);
        });

        test('MLSN site: never shows a generic badge, even without rangeSource', () => {
            const html = mod.__test_renderNutrientCards({
                methodology: 'mlsn', depthCm: 10, bulkDensity: 1.4,
                nutrients: [{ nutrient: 'K', actual: '50', mlsn: '37', status: 'ADEQUATE', statusClass: 'adequate' }],
            });
            expect(html).not.toMatch(/sn-generic-badge/);
        });
    });

    describe('renderAnnualRequirements()', () => {
        test('texture-fallback nutrient gets the generic badge next to its label', () => {
            const sn = {
                methodology: 'ammonium_acetate',
                annualDemand: { S: 10 },
                nutrients: [
                    { nutrient: 'S', actual: '75', mlsn: '30.0-60.0', status: 'HIGH', statusClass: 'high', rangeMin: 30, rangeMax: 60, rangeSource: 'texture-fallback' },
                ],
            };
            const html = mod.__test_renderAnnualRequirements(sn);
            expect(html).toMatch(/sn-generic-badge/);
        });

        test('certificate-backed nutrient does not get the generic badge', () => {
            const sn = {
                methodology: 'ammonium_acetate',
                annualDemand: { K: 40 },
                nutrients: [
                    { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', status: 'HIGH', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5, rangeSource: 'certificate' },
                ],
            };
            const html = mod.__test_renderAnnualRequirements(sn);
            expect(html).not.toMatch(/sn-generic-badge/);
        });
    });
});

// ---------------------------------------------------------------------------
// 4. site-settings-panel.js — inline Settings coverage note (structural)
// ---------------------------------------------------------------------------

describe('GH-304 — site-settings-panel.js AA coverage note', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/site-settings-panel.js'), 'utf8');
    });

    test('updateMethodNote() gains an AA branch that resolves deriveCode() from live DOM fields', () => {
        expect(src).toMatch(/\} else if \(method === 'ammonium_acetate'\) \{/);
        expect(src).toMatch(/var aaSpecies = domVal\('\.gaip-species'\);/);
        expect(src).toMatch(/var aaSoilTexture = domVal\('\.gaip-soil-texture'\);/);
        expect(src).toMatch(/hlst\.deriveCode\(aaSpecies, aaSoilTexture\)/);
    });

    test('note only shows when deriveCode() resolves no code (covered combos show nothing)', () => {
        const aaBranch = src.slice(src.indexOf("} else if (method === 'ammonium_acetate') {"), src.indexOf('} else {\n            noteEl.style.display'));
        expect(aaBranch).toMatch(/if \(!aaCode\) \{/);
        expect(aaBranch).toMatch(/noteEl\.style\.display = 'block';/);
        expect(aaBranch).toMatch(/noteEl\.style\.display = 'none';/);
    });

    test('species-change handler re-invokes updateMethodNote() (coverage depends on species, not just methodology)', () => {
        const changeHandlerIdx = src.indexOf("spSelect.addEventListener('change', function() {");
        expect(changeHandlerIdx).toBeGreaterThan(-1);
        const handlerBlock = src.slice(changeHandlerIdx, changeHandlerIdx + 2500);
        expect(handlerBlock).toContain('updateMethodNote();');
    });

    test('regression: existing MLSN notes are untouched', () => {
        expect(src).toMatch(/MLSN was developed for sand-based golf putting greens\./);
        expect(src).toMatch(/MLSN was validated primarily for putting greens\./);
    });
});
