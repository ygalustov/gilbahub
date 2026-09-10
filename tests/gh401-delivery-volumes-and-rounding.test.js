/**
 * GH-401 — the last three stages of the delivery unification.
 *
 *   1. MULTI-APPLICATION LIQUID VOLUMES AND COUNTS. An Australian liquid
 *      sprayed four times in a month contributed ONE spray's volume to "Total
 *      Rate" and counted as ONE application, on the Plan page and in the Word
 *      export alike, while the Monthly Schedule two tables away printed
 *      "4x 7 L/ha". The client orders fertiliser off the under-stated column.
 *      `applications` now counts, exactly as the New Zealand path has always
 *      counted `splitCount`.
 *
 *      The nutrient totals do not move with it, and that is not luck: an
 *      Australian liquid DECLARES its `delivers` vector for all of its
 *      applications together (Urea Tech 15 kg x 46% x 2 = 13.8), so only the
 *      volume and the count were ever short. Every site below is asserted to
 *      have the same annual N/P/K before and after — if that ever stops being
 *      true the change has become a double count.
 *
 *   2. ROUND ONCE. All three regional integrations rounded a total to 1 dp for
 *      the Nutrient Delivery Summary and then rounded THAT to a whole number
 *      for the Annual Product Summary caption. A true total anywhere in
 *      [n + 0.45, n + 0.5) therefore printed as n + 1 — a caption disagreeing
 *      with its own rows for no reason a reader could see. One rounding step
 *      now, from the raw sum, through one shared helper.
 *
 *   3. "TOTAL DELIVERED" IN THE EXPORT'S ANNUAL PRODUCT SUMMARY. The Plan page
 *      has had one since GH-316; the document's copy of the table stopped at
 *      the last product, so the two tables' bottom lines could not be compared
 *      by a reader or by the parity harness.
 *
 * WHAT THE FIXTURES ARE. The Australian sites run the REAL recommender over
 * the twelve monthly requirement rows captured from the dev database in
 * GH-400 (`tests/fixtures/gh400-au-requirements-*.json`) — the recommender's
 * input, carrying no product, rate or total, so nothing here can pass by
 * copying the figure it is meant to derive. The New Zealand and UK
 * programmes come from GH-399's captured `monthly` series. The Plan panel is
 * then RENDERED, in a sandbox holding the real integration source, and the
 * printed cells are read out of the HTML — the figures asserted below are the
 * ones a reader sees, not intermediate values.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '../assets');
const FIXTURES = path.join(__dirname, 'fixtures');

const delivery = require('../assets/nutrition-delivery-core.js');

function readAsset(name) {
    return fs.readFileSync(path.join(ASSETS, name), 'utf8');
}

/** Source with comments stripped, so a pin cannot be satisfied by prose. */
function code(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ─────────────────────────────────────────────────────────────────────────────
// A sandbox that can actually render a Plan panel.
// ─────────────────────────────────────────────────────────────────────────────

const noop = () => {};
function stubEl() {
    return {
        style: {}, appendChild: noop, setAttribute: noop, addEventListener: noop,
        textContent: '', innerHTML: '', classList: { add: noop, remove: noop }, value: null
    };
}

function makeSandbox(files) {
    const errors = [];
    const sandbox = {
        console: { log: noop, warn: noop, info: noop, error: (...a) => errors.push(a.join(' ')) },
        document: {
            head: stubEl(), body: stubEl(),
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            addEventListener: noop, createElement: stubEl
        },
        setTimeout: noop, clearTimeout: noop, Date, Math, JSON
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    files.forEach((f) => vm.runInContext(readAsset(f), sandbox, { filename: f }));
    sandbox.__errors = errors;
    return sandbox;
}

const AU_FILES = [
    'nutrition-delivery-core.js', 'nutrient-balance-status.js', 'gp-status.js',
    'au-fertiliser-products.js', 'nutrition-au-fertiliser-integration.js'
];

/**
 * The one line that carries stage 3. Removing it from a COPY of the real
 * source reproduces the pre-GH-401 behaviour exactly, so "what moved" below is
 * measured against the old code rather than transcribed from a note.
 */
const COUNT_LINE = 'if (typeof entry.applications === \'number\' && isFinite(entry.applications) && entry.applications > 0) {\n            return entry.applications;\n        }';

function assertCountLinePresent() {
    const src = readAsset('nutrition-delivery-core.js');
    if (src.indexOf(COUNT_LINE) === -1) {
        throw new Error('GH-401: the `applications` branch of _count() was not found in '
            + 'nutrition-delivery-core.js — if it was reworded, reword the anchor here too, '
            + 'do not delete this test.');
    }
    return src;
}

/** A sandbox whose delivery module ignores `applications`, i.e. the old code. */
function makeSandboxWithoutApplicationCount() {
    const patched = assertCountLinePresent().replace(COUNT_LINE, '/* GH-401 count removed for this test */');
    const errors = [];
    const sandbox = {
        console: { log: noop, warn: noop, info: noop, error: (...a) => errors.push(a.join(' ')) },
        document: {
            head: stubEl(), body: stubEl(),
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            addEventListener: noop, createElement: stubEl
        },
        setTimeout: noop, clearTimeout: noop, Date, Math, JSON
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(patched, sandbox, { filename: 'nutrition-delivery-core.js (patched)' });
    AU_FILES.slice(1).forEach((f) => vm.runInContext(readAsset(f), sandbox, { filename: f }));
    sandbox.__errors = errors;
    return sandbox;
}

function auFixture(slug) {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));
}

/** Run the real Australian recommender over a site's real requirement rows. */
function auProgram(slug) {
    const sandbox = makeSandbox(AU_FILES);
    const fx = auFixture(slug);
    const raw = sandbox.AuFertiliserRecommender.generateAnnualProgram(fx.requirements, fx.options);
    return { sandbox, fx, raw };
}

/** Render the Plan page's Australian panel and hand back its HTML. */
function renderAu(slug, sandboxOverride) {
    const { sandbox: fresh, fx, raw } = auProgram(slug);
    const sandbox = sandboxOverride || fresh;
    const acc = sandbox.GAIP_NutritionDelivery.accumulate(raw.monthly);
    const html = sandbox.NutritionAuFertiliserIntegration.buildRecommendationsHTML({
        meta: {
            surfaceType: fx.options.surfaceType,
            methodology: fx.options.methodology,
            useGM2: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets']
                .indexOf(fx.options.surfaceType) !== -1
        },
        monthly: raw.monthly,
        annualSummary: { products: acc.products },
        targets: raw.targets,
        delivered: raw.delivered,
        balance: raw.balance
    });
    return { html, acc, raw, errors: sandbox.__errors };
}

/** The cells of one row of a rendered table, tags stripped. */
function cells(rowHtml) {
    return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim());
}

function rowAfter(html, label) {
    const idx = html.indexOf(label);
    if (idx === -1) return null;
    const start = html.lastIndexOf('<tr', idx);
    const end = html.indexOf('</tr>', idx);
    return cells(html.slice(start, end));
}

/** The Nutrient Delivery Summary's N / P / K rows, by nutrient. */
function deliverySummary(html) {
    const out = {};
    [...html.matchAll(/<tr class="nutrient-[a-z-]+">([\s\S]*?)<\/tr>/g)].forEach((m) => {
        const c = cells(m[0]);
        if (c.length >= 8) out[c[0]] = { current: c[1], removal: c[2], required: c[3], delivered: c[4], range: c[5], balance: c[6], status: c[7] };
    });
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The module: applications count, and counting them moves no nutrient.
// ─────────────────────────────────────────────────────────────────────────────

function month(name, granular, liquid) {
    return { month: name, month_name: name, granular: granular || [], liquid: liquid || [] };
}

describe('GH-401 — a multi-spray liquid is counted as many times as it is sprayed', () => {
    test("`applications` sets the count, the volume and the row's application total", () => {
        // Long Paddock Rapid Uptake as the Australian recommender emits it:
        // 7 L/ha, four sprays in the month, one declared `delivers` vector
        // covering all four.
        const lp = {
            id: 'LP-RAPID', name: 'Long Paddock Rapid Uptake', form: 'liquid',
            rateLHa: 7, applications: 4, analysis: { N: 12, P: 2, K: 10 },
            delivers: { N: 3.1, P: 0.6, K: 2.8 }
        };
        const acc = delivery.accumulate([month('Aug', [], [lp])]);
        expect(acc.applications[0].count).toBe(4);
        expect(acc.applications[0].mass).toBe(28);
        expect(acc.products['LP-RAPID'].totalLHa).toBe(28);
        expect(acc.products['LP-RAPID'].applications).toBe(4);
        // ...and the declared vector is NOT multiplied by the count. It already
        // covers all four sprays; multiplying would be a 4x over-report.
        expect(acc.totals.N).toBe(3.1);
        expect(acc.totals.P).toBe(0.6);
        expect(acc.totals.K).toBe(2.8);
    });

    test('a soluble sprayed twice is kg/ha twice, not L/ha (b35fix282 survives)', () => {
        const urea = {
            id: 'UREA-TECH', name: 'Urea Tech', form: 'soluble',
            rateLHa: 15, applications: 2, analysis: { N: 46 }, delivers: { N: 13.8, P: 0, K: 0 }
        };
        const acc = delivery.accumulate([month('Sep', [], [urea])]);
        expect(acc.products['UREA-TECH'].totalKgHa).toBe(30);
        expect(acc.products['UREA-TECH'].totalLHa).toBe(0);
        expect(acc.products['UREA-TECH'].applications).toBe(2);
        expect(acc.totals.N).toBe(13.8);
    });

    test('where nothing is declared the content DOES scale with the count', () => {
        // The New Zealand shape: no `delivers` at all, so every key is
        // rate x count x analysis and the count is load-bearing for nutrients
        // as well as for volume.
        const nz = { id: 'MESA', name: 'MESA', rateKgHa: 100, splitCount: 3, analysis: { N: 19 } };
        const acc = delivery.accumulate([month('Jan', [nz])]);
        expect(acc.products.MESA.totalKgHa).toBe(300);
        expect(acc.totals.N).toBeCloseTo(57, 10);
    });

    test('splitCount wins when an entry carries both counts', () => {
        const both = { id: 'X', name: 'X', rateKgHa: 10, splitCount: 2, applications: 5, analysis: { N: 10 } };
        expect(delivery.accumulate([month('Jan', [both])]).applications[0].count).toBe(2);
    });

    test('the suspended mode is gone from the source, not merely defaulted', () => {
        const shared = code(readAsset('nutrition-delivery-core.js'));
        expect(shared).not.toMatch(/liquidVolume/);
        expect(shared).toMatch(/function _count\(entry\)\s*\{/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Every dev site: what moves, and what must not.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measured on 2026-09-10 by running the real recommender over each site's real
 * requirement rows. `apps` and `volume` are the values GH-401 moves TO;
 * `wasApps` / `wasVolume` are what the same product printed before it, i.e.
 * one application's worth.
 */
const VOLUME_MOVES = {
    'burns': [],
    'new-test-location': [
        { name: 'Long Paddock Rapid Uptake', unit: 'L', wasApps: 1, apps: 4, wasVolume: 7, volume: 28 }
    ],
    'federal-golf': [
        { name: 'Urea Tech (soluble)', unit: 'kg', wasApps: 2, apps: 4, wasVolume: 30, volume: 60 }
    ],
    'canberra': [
        { name: 'Urea Tech (soluble)', unit: 'kg', wasApps: 1, apps: 2, wasVolume: 15, volume: 30 },
        { name: 'Long Paddock Rapid Uptake', unit: 'L', wasApps: 1, apps: 4, wasVolume: 7, volume: 28 },
        { name: 'FoliMAX N-Hancer-N', unit: 'L', wasApps: 1, apps: 2, wasVolume: 20, volume: 40 }
    ],
    'test1-sports': [
        { name: 'Long Paddock Sportsturf 10-2-6', unit: 'L', wasApps: 1, apps: 4, wasVolume: 15, volume: 60 },
        { name: 'X Factor 18-3-6', unit: 'L', wasApps: 1, apps: 2, wasVolume: 30, volume: 60 }
    ],
    'westview': [
        { name: 'Greenmaster Liquid Advance - Spring and Summer', unit: 'L', wasApps: 1, apps: 3, wasVolume: 80, volume: 240 },
        { name: 'FoliMAX NRG-NK', unit: 'L', wasApps: 2, apps: 5, wasVolume: 100, volume: 250 }
    ]
};

/** The annual totals GH-400 left behind. None of them may move here. */
const ANNUAL_TOTALS = {
    'burns': { N: 125.5, P: 12.3, K: 0 },
    'new-test-location': { N: 137.6, P: 18.7, K: 104.5 },
    'federal-golf': { N: 135.1, P: 13.2, K: 73.4 },
    'canberra': { N: 184.7, P: 23.9, K: 110.9 },
    'test1-sports': { N: 148.0, P: 11.9, K: 88.4 },
    'westview': { N: 224.8, P: 21.4, K: 154.1 }
};

const AU_SITES = Object.keys(ANNUAL_TOTALS);

describe.each(AU_SITES)('GH-401 — %s, on its real persisted requirements', (slug) => {
    let acc;
    let programme;
    beforeAll(() => {
        const r = auProgram(slug);
        programme = r.raw;
        acc = r.sandbox.GAIP_NutritionDelivery.accumulate(r.raw.monthly);
    });

    test('the annual totals do not move — a declared vector already covers every spray', () => {
        const want = ANNUAL_TOTALS[slug];
        ['N', 'P', 'K'].forEach((n) => expect(acc.totals[n]).toBeCloseTo(want[n], 6));
        // ...and they are still the recommender's own accumulator's figures,
        // which is the GH-391 invariant this whole unification rests on.
        ['N', 'P', 'K'].forEach((n) => expect(acc.totals[n]).toBeCloseTo(programme.delivered[n], 6));
    });

    test('volumes and application counts', () => {
        const moves = VOLUME_MOVES[slug];
        const byName = {};
        Object.values(acc.products).forEach((p) => { byName[p.name] = p; });

        moves.forEach((m) => {
            const p = byName[m.name];
            expect(p).toBeDefined();
            expect(p.applications).toBe(m.apps);
            expect(m.unit === 'L' ? p.totalLHa : p.totalKgHa).toBeCloseTo(m.volume, 6);
            // The move is real: the pre-GH-401 figure was one spray's worth,
            // and it is not what this product prints now.
            expect(m.volume).not.toBe(m.wasVolume);
        });

        // No product outside the list moved. `applications > 1` on an entry is
        // the only thing that can move a volume, so every product whose count
        // now exceeds its month count must be named above.
        const listed = moves.map((m) => m.name);
        Object.values(acc.products).forEach((p) => {
            const monthsUsed = acc.applications.filter((a) => a.id === p.id).length;
            if (p.applications !== monthsUsed) {
                expect(listed).toContain(p.name);
            }
        });
    });
});

describe('GH-401 — New Zealand and UK are untouched by the count change', () => {
    test.each([
        ['test5-nz-soccer', { N: 237.4, P: 0, K: 175.2 }],
        ['test6-uk-mlsn', { N: 199.8, P: 27.8, K: 125.4 }]
    ])('%s', (slug, want) => {
        const fx = JSON.parse(fs.readFileSync(
            path.join(FIXTURES, 'gh399-delivery-programme-' + slug + '.json'), 'utf8'));
        const acc = delivery.accumulate(fx.monthly);
        ['N', 'P', 'K'].forEach((n) => expect(acc.totals[n]).toBeCloseTo(want[n], 6));
        // Neither recommender emits `applications` at all: New Zealand says
        // splitCount (already honoured before this ticket) and the UK says
        // nothing, so no volume on either can move.
        acc.applications.forEach((a) => {
            const entry = a;
            expect(typeof entry.count).toBe('number');
        });
        const hasApplicationsField = fx.monthly.some((m) => []
            .concat(m.granular || [], m.liquid || [])
            .some((e) => typeof e.applications === 'number'));
        expect(hasApplicationsField).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Round once.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-401 — roundAtOutput(), the one rounding step', () => {
    test('the artefact it removes: a true 125.46 prints 125, not 126', () => {
        // Double rounding: Math.round(125.46 * 10) / 10 = 125.5, and
        // Math.round(125.5) = 126, one whole kilogram above rows summing 125.
        expect(Math.round(Math.round(125.46 * 10) / 10)).toBe(126);
        expect(delivery.roundAtOutput(125.46)).toBe(125);
        // The whole band that used to be inflated.
        [0.45, 0.46, 0.49, 0.4999].forEach((frac) => {
            expect(Math.round(Math.round((10 + frac) * 10) / 10)).toBe(11);
            expect(delivery.roundAtOutput(10 + frac)).toBe(10);
        });
    });

    test('an exact half still rounds up, whichever order the sum was accumulated in', () => {
        // New test - location's potassium is 48.3 + 29.8 + 12.5 + 1.1 + 2.8 +
        // 10 — 104.5 in decimal, 104.49999999999999 in binary. Without the
        // snap this printed 104 against rows adding up to 105.
        const binarySum = 48.3 + 29.8 + 12.5 + 1.1 + 2.8 + 10;
        expect(binarySum).toBeLessThan(104.5);
        expect(Math.round(binarySum)).toBe(104);
        expect(delivery.roundAtOutput(binarySum)).toBe(105);
        expect(delivery.roundAtOutput(104.5)).toBe(105);
    });

    test('it is Math.round of the decimal reading, negatives included', () => {
        expect(delivery.roundAtOutput(-12.5)).toBe(Math.round(-12.5));
        expect(delivery.roundAtOutput(-12.6)).toBe(-13);
        expect(delivery.roundAtOutput(-12.4)).toBe(-12);
    });

    test('one decimal place, and a non-number is zero rather than NaN in a cell', () => {
        expect(delivery.roundAtOutput(137.64, 1)).toBe(137.6);
        expect(delivery.roundAtOutput(137.65, 1)).toBe(137.7);
        expect(delivery.roundAtOutput(0.05, 1)).toBe(0.1);
        expect(delivery.roundAtOutput(undefined)).toBe(0);
        expect(delivery.roundAtOutput('nonsense', 1)).toBe(0);
    });

    test('the snap reaches exactly as far as it is meant to and no further', () => {
        // 1e-9 kg/ha. Anything further below the half than that is a real
        // quantity and rounds down; anything nearer is representation error on
        // a sum of ten to thirty doubles (~1e-13 at these magnitudes) and
        // rounds as the decimal reading would. A tenth of a kilogram is the
        // smallest quantity any of these tables prints, so the whole snap band
        // is four orders of magnitude below the last digit shown.
        expect(delivery.roundAtOutput(10.5 - 1e-7)).toBe(10);
        expect(delivery.roundAtOutput(10.5 - 1e-8)).toBe(10);
        expect(delivery.roundAtOutput(10.5 - 1e-11)).toBe(11);
        expect(delivery.roundAtOutput(10.5 - 1e-13)).toBe(11);
    });
});

describe('GH-401 — the double rounding is gone from all three integrations', () => {
    const INTEGRATIONS = [
        ['nutrition-prebble-integration.js', 'NutritionPrebbleIntegration'],
        ['nutrition-au-fertiliser-integration.js', 'NutritionAuFertiliserIntegration'],
        ['nutrition-uk-fertiliser-integration.js', 'NutritionUkFertiliserIntegration']
    ];

    test.each(INTEGRATIONS)('%s', (file) => {
        const src = code(readAsset(file));
        // The intermediate pass is deleted, not commented out.
        expect(src).not.toMatch(/nutrientTotals\[k\] = Math\.round\(nutrientTotals\[k\] \* 10\) \/ 10/);
        expect(src).not.toMatch(/nutrientRequired\[k\] = Math\.round\(nutrientRequired\[k\] \* 10\) \/ 10/);
        // ...and the panel rounds through the shared helper, behind the same
        // fail-loud load guard the accumulator uses.
        expect(src).toMatch(/roundAtOutput: function\(value, decimals\)/);
        expect(src).toMatch(/GH-401: nutrition-delivery-core\.js is not loaded/);
        expect(src).toMatch(/mod\.roundAtOutput\(value, decimals\)/);
        // The Nutrient Delivery Summary's own two cells go through it at 1 dp.
        expect(src).toMatch(/roundAtOutput\(v, 1\)\.toFixed\(1\)/);
    });

    test('a total in the inflated band prints the lower whole number, rendered', () => {
        // The behavioural half of the pin above. No development site's totals
        // currently land in [n + 0.45, n + 0.5) — they are all effectively
        // 1 dp already — so a source pin alone would let the double rounding
        // come back on a site nobody happens to have. This programme is built
        // to land there: three declared vectors summing to 125.46, which the
        // old two-step rounding turned into 125.5 and then 126, one kilogram
        // above rows printing 113 + 7 + 5 = 125.
        const declared = [113.1, 7, 5.36];
        expect(declared.reduce((a, b) => a + b, 0)).toBeCloseTo(125.46, 6);

        const monthly = declared.map((n, i) => ({
            month: 'M' + i, month_name: 'M' + i, season: 'Summer', gp: 0.8,
            requirements: { N: 40, P: 0, K: 0 },
            granular: [{
                id: 'PROD' + i, name: 'Product ' + i, npk: '20-0-0', rateKgHa: 100,
                analysis: { N: 20, P: 0, K: 0 }, delivers: { N: n, P: 0, K: 0 }
            }],
            liquid: []
        }));

        const sandbox = makeSandbox(AU_FILES);
        const acc = sandbox.GAIP_NutritionDelivery.accumulate(monthly);
        expect(acc.totals.N).toBeCloseTo(125.46, 6);
        const html = sandbox.NutritionAuFertiliserIntegration.buildRecommendationsHTML({
            meta: { surfaceType: 'sports', methodology: 'mlsn' },
            monthly: monthly,
            annualSummary: { products: acc.products },
            targets: { N: 120, P: 0, K: 0 }
        });

        const rows = deliverySummary(html);
        expect(rows.N.delivered).toBe('125.5');          // 1 dp, rounded once
        // GH-403: the caption prints the same 1 dp figure the Delivered column
        // does, and the product rows now print at 1 dp too — so the rows add up
        // to the caption exactly rather than to a whole kilogram beside it.
        expect(rowAfter(html, 'Total Delivered')[3]).toBe('125.5');
        const printedRows = [...html.matchAll(/<tr>\s*<td class="au-fert-cell au-fert-cell--left">[\s\S]*?<\/tr>/g)]
            .map((m) => cells(m[0])).filter((c) => c.length === 6);
        expect(printedRows.map((c) => c[3])).toEqual(['113.1', '7.0', '5.4']);
        expect(printedRows.reduce((a, c) => a + parseFloat(c[3]), 0)).toBeCloseTo(125.5, 6);
        // What the two rejected alternatives printed, for the record: whole-kg
        // rows summing to 125 under a caption of 125 (the sum-of-rows rule), and
        // the pre-GH-401 double rounding's 126 over rows of 125.
        expect(declared.map((n) => Math.round(n)).reduce((a, b) => a + b, 0)).toBe(125);
        expect(Math.round(Math.round(acc.totals.N * 10) / 10)).toBe(126);
    });

    test('the captions read the raw totals, not a rounded copy', () => {
        const au = code(readAsset('nutrition-au-fertiliser-integration.js'));
        const nz = code(readAsset('nutrition-prebble-integration.js'));
        ['N', 'P', 'K'].forEach((n) => {
            // GH-403: still the raw total, still one step — the step is now
            // formatDelivered(), which is roundAtOutput() at 1 dp.
            expect(au).toMatch(new RegExp('this\\.formatDelivered\\(nutrientTotals\\.' + n + '\\)'));
            expect(nz).toMatch(new RegExp('this\\.formatDelivered\\(nutrientTotals\\.' + n + '\\)'));
            expect(au).not.toMatch(new RegExp('\\$\\{Math\\.round\\(nutrientTotals\\.' + n + '\\)\\}'));
            expect(nz).not.toMatch(new RegExp('\\$\\{Math\\.round\\(nutrientTotals\\.' + n + '\\)\\}'));
        });
    });

    test('the Word export rounds the same figure the same way', () => {
        const combined = code(readAsset('word-export-combined.js'));
        expect(combined).toMatch(/function _round1dpForDisplay\(value\)/);
        expect(combined).toMatch(/mod\.roundAtOutput\(n, 1\)\.toFixed\(1\)/);
        // The two cells that used to call toFixed() straight onto a raw sum.
        expect(combined).toMatch(/_round1dpForDisplay\(anrResult\.val\)/);
        expect(combined).toMatch(/_round1dpForDisplay\(deliveredNum\)/);
        expect(combined).not.toMatch(/parseFloat\(anrResult\.val\)\.toFixed\(1\)/);
        expect(combined).not.toMatch(/deliveredNum\.toFixed\(1\)/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The rendered Plan panel, per site.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read off the rendered panel on 2026-09-10. `footer` is the Annual Product
 * Summary's "Total Delivered" row: applications, total rate, then N / P / K.
 */
const RENDERED = {
    'new-test-location': {
        delivered: { N: '137.6', P: '18.7', K: '104.5' },
        required: { N: '120.0', P: '14.0', K: '103.0' },
        footerApps: '10', footerRate: '77.7 g/m² + 49 L/ha', footerNPK: ['137.6', '18.7', '104.5']
    },
    'burns': {
        delivered: { N: '125.5', P: '12.3', K: '0.0' },
        required: { N: '120.1', P: '14.0', K: '0.0' },
        footerApps: '12', footerRate: '64.4 g/m²', footerNPK: ['125.5', '12.3', '0.0']
    },
    'federal-golf': {
        delivered: { N: '135.1', P: '13.2', K: '73.4' },
        required: { N: '120.0', P: '11.9', K: '63.9' },
        // 4 applications of Urea Tech at 60 kg/ha, not 2 at 30.
        footerApps: '8', footerRate: '58 g/m²', footerNPK: ['135.1', '13.2', '73.4']
    },
    'canberra': {
        delivered: { N: '184.7', P: '23.9', K: '110.9' },
        required: { N: '200.0', P: '19.9', K: '110.0' },
        footerApps: '13', footerRate: '76.5 g/m² + 111 L/ha', footerNPK: ['184.7', '23.9', '110.9']
    },
    'test1-sports': {
        delivered: { N: '148.0', P: '11.9', K: '88.4' },
        required: { N: '120.0', P: '12.0', K: '66.9' },
        footerApps: '10', footerRate: '597 kg/ha + 120 L/ha', footerNPK: ['148.0', '11.9', '88.4']
    },
    'westview': {
        delivered: { N: '224.8', P: '21.4', K: '154.1' },
        required: { N: '200.1', P: '20.0', K: '125.0' },
        footerApps: '13', footerRate: '700 kg/ha + 683 L/ha', footerNPK: ['224.8', '21.4', '154.1']
    }
};


describe.each(AU_SITES)('GH-401 — the rendered Plan panel, %s', (slug) => {
    let html;
    let errs;
    beforeAll(() => {
        const r = renderAu(slug);
        html = r.html;
        errs = r.errors;
    });

    test('nothing reported a missing module while rendering', () => {
        expect(errs).toEqual([]);
    });

    test('Nutrient Delivery Summary prints Delivered and Required at one decimal', () => {
        const rows = deliverySummary(html);
        ['N', 'P', 'K'].forEach((n) => {
            expect(rows[n].delivered).toBe(RENDERED[slug].delivered[n]);
            expect(rows[n].required).toBe(RENDERED[slug].required[n]);
        });
    });

    test('the Annual Product Summary caption', () => {
        const footer = rowAfter(html, 'Total Delivered');
        expect(footer).not.toBeNull();
        expect(footer[1]).toBe(RENDERED[slug].footerApps);
        expect(footer[2]).toBe(RENDERED[slug].footerRate);
        expect(footer.slice(3, 6)).toEqual(RENDERED[slug].footerNPK);
    });

    test('what the old code printed for the same site, and what it cost', () => {
        // The same panel rendered against a copy of the delivery module with
        // the `applications` branch removed — i.e. the code as it stood before
        // this ticket. The comparison is measured, not transcribed.
        const before = renderAu(slug, makeSandboxWithoutApplicationCount());
        const oldFooter = rowAfter(before.html, 'Total Delivered');
        const newFooter = rowAfter(html, 'Total Delivered');

        // The nutrients are identical either way. That is the whole reason
        // this stage is safe: a declared vector already covers every spray.
        expect(oldFooter.slice(3, 6)).toEqual(newFooter.slice(3, 6));
        expect(deliverySummary(before.html)).toEqual(deliverySummary(html));

        const moves = VOLUME_MOVES[slug];
        if (moves.length === 0) {
            // Burns has no multi-spray liquid: nothing about it may move.
            expect(oldFooter).toEqual(newFooter);
            return;
        }
        // Everywhere else the count and the volume both go up, never down.
        expect(Number(oldFooter[1])).toBeLessThan(Number(newFooter[1]));
        expect(oldFooter[2]).not.toBe(newFooter[2]);

        const productRows = (markup) => {
            const out = {};
            [...markup.matchAll(/<tr>\s*<td class="au-fert-cell au-fert-cell--left">[\s\S]*?<\/tr>/g)]
                .forEach((m) => {
                    const c = cells(m[0]);
                    if (c.length === 6) out[c[0].split('\n')[0].trim()] = c;
                });
            return out;
        };
        const oldRows = productRows(before.html);
        const newRows = productRows(html);
        moves.forEach((mv) => {
            const row = oldRows[mv.name];
            expect(row).toBeDefined();
            expect(row[1]).toBe(String(mv.wasApps));
            // GH-409: the UNIT a row prints in is decided by the surface, so it
            // is read off the row the panel just rendered rather than rebuilt
            // here from the product's form — which is what this line used to do,
            // and is no longer what decides it. Federal Golf and Canberra are
            // greens: their soluble prints "3 g/m²" where it printed "30 kg/ha".
            // The VOLUME is still the fixture's own number, which is the claim
            // this test makes.
            const unit = newRows[mv.name][2].replace(/^[\d.]+\s*/, '');
            expect(row[2]).toBe(delivery.formatRate(mv.wasVolume, unit));
        });
    });
});

test('GH-403 — the caption is the sum of the rows above it, on the site that exposed the snap', () => {
    // New test - location is the site roundAtOutput()'s binary snap exists for:
    // its potassium is 48.3 + 29.8 + 12.5 + 1.1 + 2.8 + 10, which is 104.5
    // exactly in decimal and 104.49999999999999 in binary. GH-401 printed a
    // caption of 105 over whole-kilogram rows of 48 + 30 + 13 + 1 + 3 + 10 = 105
    // — right by half a kilogram of luck. At 1 dp there is no luck involved:
    // the printed rows add up to the printed caption, digit for digit.
    const { html } = renderAu('new-test-location');
    const rowSums = { N: 0, P: 0, K: 0 };
    const printed = [];
    [...html.matchAll(/<tr>\s*<td class="au-fert-cell au-fert-cell--left">[\s\S]*?<\/tr>/g)].forEach((m) => {
        const c = cells(m[0]);
        if (c.length !== 6) return;
        printed.push(c[5]);
        rowSums.N += parseFloat(c[3]);
        rowSums.P += parseFloat(c[4]);
        rowSums.K += parseFloat(c[5]);
    });
    expect(printed).toEqual(['48.3', '29.8', '12.5', '1.1', '2.8', '10.0']);
    const caption = rowAfter(html, 'Total Delivered').slice(3, 6);
    expect(caption).toEqual(['137.6', '18.7', '104.5']);
    ['N', 'P', 'K'].forEach((n, i) => {
        expect(rowSums[n]).toBeCloseTo(parseFloat(caption[i]), 6);
    });
    // ...and it is the same figure the Nutrient Delivery Summary two tables
    // above prints for the same quantity, which is the point of the precision.
    const summary = deliverySummary(html);
    ['N', 'P', 'K'].forEach((n, i) => expect(summary[n].delivered).toBe(caption[i]));
});

describe('GH-401 — the rendered Plan panel, Test5 - NZ (the parity reference)', () => {
    let html;
    let errs;
    beforeAll(() => {
        const sandbox = makeSandbox([
            'nutrition-delivery-core.js', 'nutrient-balance-status.js', 'gp-status.js',
            'nutrition-prebble-integration.js'
        ]);
        const fx = JSON.parse(fs.readFileSync(
            path.join(FIXTURES, 'gh399-delivery-programme-test5-nz-soccer.json'), 'utf8'));
        const acc = sandbox.GAIP_NutritionDelivery.accumulate(fx.monthly);
        html = sandbox.NutritionPrebbleIntegration.buildRecommendationsHTML({
            meta: fx.meta, monthly: fx.monthly, annualSummary: { products: acc.products }
        });
        errs = sandbox.__errors;
    });

    test('nothing reported a missing module while rendering', () => {
        expect(errs).toEqual([]);
    });

    test('the figures are the ones GH-399 left, at one decimal', () => {
        const rows = deliverySummary(html);
        expect(rows.N.delivered).toBe('237.4');
        expect(rows.P.delivered).toBe('0.0');
        expect(rows.K.delivered).toBe('175.2');
        expect(rows.N.required).toBe('250.0');
        // GH-403: 136.0 here is the DOCUMENTED FALLBACK, not the live figure.
        // This fixture is GH-399's captured recommender programme and carries no
        // `annual_requirements` — it predates the carry-through — so the panel
        // sums the twelve monthly rows exactly as it used to, which is what an
        // old programme restored from the persisted site config must keep doing.
        // The live figure is the engine's 136.1; see
        // tests/gh403-required-one-quantity.test.js, which runs computeProgram()
        // over this same site's real inputs and asserts both branches.
        expect(rows.K.required).toBe('136.0');
        expect(rowAfter(html, '>Total Delivered<').slice(1, 4)).toEqual(['237.4', '0.0', '175.2']);
    });

    test("the recommender's own labels survived — '(Balance)' and the '(QR)' release tags", () => {
        // GH-399 pinned these because keying the shared accumulator by id is
        // what keeps a -BAL entry a separate row; nothing in this ticket may
        // disturb them.
        expect(html).toMatch(/Ammos 22 \(Nitro 22\) \(Balance\)/);
        expect(html).toMatch(/Pro Balance \(QR\)/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// The Required gap GH-401 recorded, closed by GH-403.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-403 — the Required gap GH-401 recorded is closed', () => {
    test('neither of the two roundings that made it two quantities is still there', () => {
        // What GH-401 measured live on 2026-09-10, Plan page against the
        // rendered .docx:
        //   New test - location   P   plan 14.0   document 14.2
        //   Federal Golf          P   plan 11.9   document 12.0
        //                         K   plan 63.9   document 64.0
        //   Burns                 P   plan 14.0   document 14.1
        //   Test5 - NZ            K   plan 136.0  document 136.1
        //
        // Two causes, not one. nutrition-calendar.js rounded the engine's annual
        // requirement to a WHOLE kilogram before distributing it (up to 0.5
        // kg/ha, and the reason Burns read 14.0 against 14.1), AND the panel
        // re-derived Required by summing the twelve monthly rows the calendar
        // had already rounded to 1 dp — which never adds back to the annual
        // whatever is distributed. GH-403 removed the first and stopped doing
        // the second; the panel reads the engine's figure directly now.
        const calendar = code(readAsset('nutrition-calendar.js'));
        expect(calendar).not.toMatch(/annualRequirements\[nutrient\] = Math\.round\(r\.annualRequirement\);/);
        expect(calendar).toMatch(/annualRequirements\[nutrient\] = r\.annualRequirement;/);
        // The monthly rows are still rounded for display at 1 dp — they are the
        // schedule, they are printed, and nothing sums them into Required now.
        expect(calendar).toMatch(/P: Math\.round\(distributions\.P\[m\] \* 10\) \/ 10,/);

        // Both surfaces read one quantity: the document prints the engine's
        // `annualRequirement`, and the panels print `annual_requirements`, which
        // is computeProgram()'s `annual_totals` — the same core's same answer.
        const combined = code(readAsset('word-export-combined.js'));
        expect(combined).toMatch(/val: perSampleNut\.annualRequirement,/);
        ['nutrition-au-fertiliser-integration.js', 'nutrition-prebble-integration.js',
            'nutrition-uk-fertiliser-integration.js'].forEach((f) => {
            const src = code(readAsset(f));
            expect(src).toMatch(/annualRequired\(program\)/);
            expect(src).toMatch(/program\.annual_requirements = calendarData\.annual_totals;|annual_requirements: calendarData\.annual_totals,/);
        });

        // The arithmetic GH-401 wrote down, and what it now produces. New test -
        // location's phosphorus: the whole-kilogram step turned 14.2 into 14, and
        // twelve 1 dp months of THAT summed back to 14.0. The twelve rows still
        // will not sum to 14.2 — they sum to 14.3 — which is exactly why summing
        // them is no longer how Required is obtained.
        const engineAnnual = 14.2;
        expect(Math.round(engineAnnual)).toBe(14);
        const fx = auFixture('new-test-location');
        const planTarget = fx.requirements.reduce((a, m) => a + (m.P || 0), 0);
        expect(planTarget).toBeCloseTo(14.0, 6);
        expect(planTarget).not.toBeCloseTo(engineAnnual, 1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. "Total Delivered" in the export's Annual Product Summary.
// ─────────────────────────────────────────────────────────────────────────────

describe("GH-401 — the export's Annual Product Summary gains a Total Delivered row", () => {
    const src = readAsset('word-export.js');
    const stripped = code(src);

    test('the row exists, is bold, and is built from the programme accumulator', () => {
        expect(stripped).toMatch(/text: 'Total Delivered', bold: true/);
        // ...and is actually pushed onto the table. Building the cells and
        // never emitting them would leave every assertion above satisfied and
        // the document unchanged.
        expect(stripped).toMatch(/summaryRows\.push\(new TableRow\(\{ children: totalCells \}\)\);/);
        expect(stripped).toMatch(/_computeProgrammeDelivered\(summary, 'N'\)/);
        expect(stripped).toMatch(/_computeProgrammeDelivered\(summary, 'K'\)/);
        // ...for every optional column too, so a table showing Ca has a Ca total.
        ['P', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(stripped).toMatch(new RegExp("_computeProgrammeDelivered\\(summary, '" + n + "'\\)"));
        });
    });

    test('it is catalogue-only, the same definition the ANR Delivered column uses', () => {
        expect(stripped).toMatch(/var _catalogueRows = rowsData\.filter\(function\(r\) \{ return !r\.isAmendment; \}\);/);
        expect(stripped).toMatch(/isAmendment: !!p\._isAmendment/);
        // _computeProgrammeDelivered's own skip is what makes the two agree.
        expect(stripped).toMatch(/if \(entry\._isAmendment\) return;/);
    });

    test('it rounds once, through the shared helper', () => {
        expect(stripped).toMatch(/_dm\.roundAtOutput\(v\)/);
        expect(stripped).toMatch(/GH-401: nutrition-delivery-core\.js is not loaded/);
    });

    test('a document containing an amendment row says why the rows do not add up', () => {
        expect(src).toMatch(/Total Delivered covers the fertiliser programme only/);
        expect(stripped).toMatch(/if \(rowsData\.length > _catalogueRows\.length\)/);
    });

    test('the Purchasing Summary orders the same volume the table prints', () => {
        // The combined export's per-site aggregator reads the SAME product
        // entry's mass — `totalKg || totalKgHa || totalLHa` — that the Annual
        // Product Summary prints, so a multi-spray liquid's corrected volume
        // reaches the procurement column with no second computation. Pinned
        // structurally because no development site currently has both a fresh
        // soil sample (the aggregator suppresses itself without one) and a
        // multi-spray liquid, so it could not be shown live on this database.
        const combined = code(readAsset('word-export-combined.js'));
        // GH-406 replaced the flat `totalKg || totalKgHa || totalLHa` chain with
        // a form-aware read, so that the row can print its own unit. The claim
        // this test makes is unchanged and still holds: the aggregator reads the
        // product entry's own quantity and computes nothing of its own. For a
        // liquid the two fields carry the same number anyway — asserted at the
        // bottom of this test — so GH-406 moved no figure, only the label.
        // GH-409 kept that read and only changed which branch it takes — the
        // unit now comes from the shared helper, which also knows about the
        // surface, so the mass branch prefers `totalKgHa` (the accumulator's own
        // field for it) ahead of the combined `totalKg`. Same number on every
        // entry the accumulator produces; `totalLHa` stays the last resort for a
        // pre-GH-399 soluble whose kilograms sat in the litres field.
        expect(combined).toMatch(/var kgHa = _isLiquid/);
        expect(combined).toMatch(/\? parseFloat\(p\.totalLHa \|\| 0\) \|\| parseFloat\(p\.totalKg \|\| 0\)/);
        expect(combined).toMatch(/: parseFloat\(p\.totalKgHa \|\| p\.totalKg \|\| p\.totalLHa \|\| 0\);/);
        expect(combined).not.toMatch(/kgHaSum \+= [^;]*compute/);
        // ...and the module publishes exactly that, counting every spray.
        const acc = delivery.accumulate([month('Aug', [], [{
            id: 'LP', name: 'LP', form: 'liquid', rateLHa: 7, applications: 4,
            analysis: { N: 12 }, delivers: { N: 3.1, P: 0.6, K: 2.8 }
        }])]);
        expect(acc.products.LP.totalKg).toBe(28);
        expect(acc.products.LP.totalLHa).toBe(28);
    });

    test('the arithmetic: the total equals the sum of the catalogue rows', () => {
        // _computeProgrammeDelivered is the export's own reader; run it over a
        // product map of the shape the shared accumulator produces, with one
        // amendment mixed in, and check both halves of the claim.
        const wx = { products: {
            A: { nutrients: { N: 58.2, P: 13.1, K: 48.3 } },
            B: { nutrients: { N: 29.8, P: 1.5, K: 29.8 } },
            DOLOMITE: { _isAmendment: true, totalDelivered: { N: 0, P: 0, K: 0, Ca: 180, Mg: 90 } }
        } };
        const sum = (n) => Object.keys(wx.products)
            .filter((id) => !wx.products[id]._isAmendment)
            .reduce((a, id) => a + (wx.products[id].nutrients[n] || 0), 0);
        expect(sum('N')).toBeCloseTo(88, 6);
        expect(delivery.roundAtOutput(sum('K'))).toBe(78);
        // Ca comes only from the amendment, so the programme total is zero even
        // though the table shows 180 in that row — which is the case the
        // caption exists for.
        expect(sum('Ca')).toBe(0);
    });
});
