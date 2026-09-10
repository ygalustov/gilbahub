/**
 * GH-403 — one "Required", and a table whose caption agrees with its own rows.
 *
 * ===========================================================================
 * DEFECT 1 — "Required" was two different quantities under one column name
 * ===========================================================================
 *
 * Measured live by GH-401, Plan page against the rendered .docx:
 *
 *     New test - location   P   plan 14.0   document 14.2
 *     Federal Golf          P   plan 11.9   document 12.0
 *                           K   plan 63.9   document 64.0
 *     Burns                 P   plan 14.0   document 14.1
 *     Test5 - NZ            K   plan 136.0  document 136.1
 *
 * TWO causes, not one — and this is the correction to the brief this ticket was
 * written from, which named only the first and called it "the sole cause".
 *
 *   (a) nutrition-calendar.js rounded the shared core's annual requirement to a
 *       WHOLE KILOGRAM before distributing it across the twelve months. That is
 *       the intermediate rounding of a value used in further arithmetic that
 *       GH-401 removed everywhere else, and it moved the whole programme by up
 *       to 0.5 kg/ha (Westview's sulphur was scheduled as 13 against a true
 *       12.5).
 *
 *   (b) all three regional panels re-derived Required by SUMMING the twelve
 *       monthly rows, each of which is rounded to 1 dp for display. That sum is
 *       not the annual requirement and cannot be made into it: whatever is
 *       distributed, twelve independent roundings do not add back. Removing (a)
 *       alone leaves Burns at plan 14.0 / document 14.1, unchanged, and moves
 *       New test - location's phosphorus to plan 14.3 / document 14.2 — the same
 *       defect with the sign flipped. Measured, in the before/after block below.
 *
 * So both went. `annual_totals` is the core's canonical 0.1 kg/ha figure now,
 * and the panels print THAT — the same number, from the same shared function
 * (nutrition-requirement-core.js), that the document's Annual Nutrient
 * Requirements table has always printed. The twelve monthly rows keep their 1 dp
 * display: they are the schedule, and nothing sums them into Required any more.
 *
 * ===========================================================================
 * DEFECT 2 — a caption that contradicted the rows printed above it
 * ===========================================================================
 *
 * Burns' Annual Product Summary caption read 126 kg N over rows reading
 * 113 + 7 + 5 = 125. The true total is 125.5: rounding it once gives 126,
 * rounding each row once and adding gives 125. Both correct, and on one page a
 * contradiction.
 *
 * The alternative — print the sum of the ROUNDED rows — was measured on every
 * development site and rejected, because rounding bias accumulates with the
 * number of rows while the true total does not (Test6 - UK potassium: rows 127,
 * true 125.4, in the same document as an ANR table printing 125.4). So the rows
 * gained the decimal instead. At 1 dp they add up to the caption exactly on
 * every development site, and the figure matches the two other tables that have
 * printed this quantity at 1 dp all along.
 *
 * WHAT THE FIXTURES ARE. `gh403-calendar-programmes.json` holds the ten
 * development sites' real programme INPUTS, read off their persisted
 * nutritionCalendarProgram. The before/after below loads nutrition-calendar.js
 * twice — once as it stands, once from a copy with the whole-kilogram rounding
 * put back — and runs both over those inputs, so "what moved" is measured
 * against the old code rather than transcribed from a note. The delivery half
 * runs GH-400's captured requirement rows through the real recommender and reads
 * the printed cells out of the rendered panel, exactly as GH-401 does.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const ASSETS = path.join(__dirname, '../assets');
const FIXTURES = path.join(__dirname, 'fixtures');

const delivery = require('../assets/nutrition-delivery-core.js');
const balance = require('../assets/nutrient-balance-status.js');

function readAsset(name) {
    return fs.readFileSync(path.join(ASSETS, name), 'utf8');
}

/** Source with comments stripped, so a pin cannot be satisfied by prose. */
function code(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ─────────────────────────────────────────────────────────────────────────────
// The calendar, loaded twice: as it is, and as it was.
// ─────────────────────────────────────────────────────────────────────────────

const RAW_LINE = 'annualRequirements[nutrient] = r.annualRequirement;';
const ROUND_LINE = 'annualRequirements[nutrient] = Math.round(r.annualRequirement);';

/**
 * nutrition-calendar.js in its own function scope, with the four modules it
 * pulls in and a `require` bound to assets/, so a PATCHED copy of the source can
 * be run beside the real one without either touching the other's globals.
 */
function loadCalendar(src) {
    const win = {};
    win.window = win;
    const doc = {
        readyState: 'complete', addEventListener() {}, getElementById() { return null; },
        querySelector() { return null; }, querySelectorAll() { return []; }
    };
    const quiet = { log() {}, warn() {}, error() {}, info() {} };
    const req = Module.createRequire(path.join(ASSETS, 'anything.js'));
    win.NutritionRequirementCore = req('./nutrition-requirement-core.js');
    win.GAIP_NutritionProgramInputs = req('./nutrition-program-inputs.js');
    win.GilbaGrowthPotentialEngine = req('./growth-potential-engine.js');
    win.GAIP_MonthlyDistribution = req('./nutrition-monthly-distribution.js');
    const fn = new Function('module', 'exports', 'require', 'window', 'document',
        'console', 'localStorage', 'setTimeout', 'globalThis', src);
    const mod = { exports: {} };
    fn(mod, mod.exports, req, win, doc, quiet,
        { getItem() { return null; }, setItem() {} }, () => {}, win);
    if (!win.GilbaNutritionCalendar) throw new Error('GH-403: nutrition-calendar.js did not publish itself');
    return win.GilbaNutritionCalendar;
}

const CAL_SRC = readAsset('nutrition-calendar.js');
if (CAL_SRC.indexOf(RAW_LINE) === -1) {
    throw new Error('GH-403: the unrounded `annualRequirements[nutrient] = r.annualRequirement;` was not '
        + 'found in nutrition-calendar.js — if it was reworded, reword the anchor here too, do not '
        + 'delete this test.');
}
const After = loadCalendar(CAL_SRC);
const Before = loadCalendar(CAL_SRC.replace(RAW_LINE, ROUND_LINE));

const SITES = JSON.parse(fs.readFileSync(
    path.join(FIXTURES, 'gh403-calendar-programmes.json'), 'utf8')).sites;
const SLUGS = SITES.map((s) => s.slug);

function inputsFor(rec) {
    const i = rec.inputs;
    const temps = {};
    Object.keys(i.monthlyTemps).forEach((k) => { temps[Number(k)] = i.monthlyTemps[k]; });
    return {
        annualNOverride: i.annualNOverride,
        trafficModifier: i.trafficModifier,
        traffic: i.traffic,
        clippingManagement: i.clippingManagement,
        methodology: i.methodology,
        species: i.species,
        speciesDisplay: i.speciesDisplay,
        surfaceType: i.surfaceType,
        hemisphere: i.hemisphere,
        distribution: i.distribution,
        maxNPerMonth: i.maxNPerMonth,
        soilPpm: i.soilPpm,
        bulkDensity: i.bulkDensity,
        soilDepth: i.soilDepth,
        monthlyTemps: temps,
        isC4: After.isC4Species(i.species),
        ranges: i.ranges,
        rangeSources: i.rangeSources,
        tissuePercent: i.tissuePercent || null
    };
}

const bySlug = {};
SITES.forEach((rec) => {
    const inp = inputsFor(rec);
    bySlug[rec.slug] = { rec, before: Before.computeProgram(inp), after: After.computeProgram(inp) };
});

const NUTRIENTS = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. The calendar: one quantity, at the core's own precision.
// ─────────────────────────────────────────────────────────────────────────────

describe.each(SLUGS)('GH-403 — %s, on its real persisted programme inputs', (slug) => {
    test('every site computed — a fixture that stopped computing proves nothing', () => {
        const { after, before } = bySlug[slug];
        expect(after.error).toBeUndefined();
        expect(after.climateDataUnavailable).toBeUndefined();
        expect(before.error).toBeUndefined();
    });

    test('annual_totals IS the shared core\'s annualRequirement, to the last decimal', () => {
        // Rule A in one assertion: the quantity the Plan prints and the quantity
        // the document prints are the same function's same output on the same
        // inputs. The document reads perSample[n].annualRequirement off
        // nutrition-requirement-engine.js, which delegates here; the Plan reads
        // annual_totals. If anything ever rounds, scales or clamps one of them
        // on its way to a renderer, this is where it shows.
        const { rec, after } = bySlug[slug];
        const i = rec.inputs;
        const core = require('../assets/nutrition-requirement-core.js').compute({
            soilValues: i.soilPpm,
            species: i.species,
            methodology: i.methodology,
            ranges: i.ranges,
            tissuePercent: i.tissuePercent || null,
            annualN: Math.round(i.annualNOverride * i.trafficModifier),
            bulkDensity: i.bulkDensity,
            soilDepth: i.soilDepth,
            clippingManagement: i.clippingManagement
        });
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(after.annual_totals[n]).toBe(core.perSample[n].annualRequirement);
        });
    });

    test('and it is not the whole-kilogram copy of it the calendar used to publish', () => {
        const { before, after } = bySlug[slug];
        NUTRIENTS.forEach((n) => {
            // Rounding the new figure reproduces the old one exactly, which is
            // what makes this the SAME quantity at a finer precision rather than
            // a different computation.
            expect(Math.round(after.annual_totals[n])).toBe(before.annual_totals[n]);
            // ...and it is canonical at 0.1 kg/ha: a tenth is the last digit
            // anything prints, so the value read back at 1 dp is lossless.
            expect(Math.round(after.annual_totals[n] * 10) / 10).toBeCloseTo(after.annual_totals[n], 6);
        });
    });

    test('the monthly rows move by at most one display step, except where they cannot', () => {
        const { before, after } = bySlug[slug];
        const moves = [];
        NUTRIENTS.forEach((n) => {
            before.program.monthly.forEach((m, i) => {
                const d = Math.round(Math.abs(m[n] - after.program.monthly[i][n]) * 10) / 10;
                if (d > 0.1) moves.push({ nutrient: n, month: m.month_name, before: m[n], after: after.program.monthly[i][n] });
            });
        });
        // ONE cell on ten sites exceeds a single 0.1 step, and it is arithmetic,
        // not a surprise: a whole-kilogram rounding can shift an annual by up to
        // 0.5 kg, and Westview's sulphur is the case where it did (13 against a
        // true 12.5, -3.8%). January carries 27% of that programme, so its raw
        // figure moves 0.13 — enough to cross two 0.05 display boundaries. Any
        // month that moves further than this is NOT explained by the rounding
        // being removed and should be investigated, not re-pinned.
        const expected = slug === 'westview'
            ? [{ nutrient: 'S', month: 'Jan', before: 3.5, after: 3.3 }]
            : [];
        expect(moves).toEqual(expected);
    });

    test('the monthly N cap binds exactly as it did', () => {
        // N never went through the removed rounding — `annual N x clipping
        // factor` is a whole number on every development site — so the cap sees
        // the same series and must clamp and redistribute identically.
        const { before, after } = bySlug[slug];
        expect(after.adjustments.n_cap_applied).toBe(before.adjustments.n_cap_applied);
        expect(after.adjustments.max_n_per_month).toBe(before.adjustments.max_n_per_month);
        expect(after.adjustments.n_redistributed).toBeCloseTo(before.adjustments.n_redistributed, 6);
        expect(after.adjustments.n_unschedulable).toBeCloseTo(before.adjustments.n_unschedulable, 6);
        expect(after.adjustments.scheduled_n_total).toBeCloseTo(before.adjustments.scheduled_n_total, 6);
        expect(after.program.monthly.map((m) => m.N)).toEqual(before.program.monthly.map((m) => m.N));
    });
});

test('GH-403 — the cap still binds on the four sites it bound on, and only those', () => {
    const capped = SLUGS.filter((s) => bySlug[s].after.adjustments.n_cap_applied);
    expect(capped.sort()).toEqual(['federal-golf', 'new-test-location']);
    // Two of the four sites carrying a cap of 15 (Federal Golf, New test -
    // location) reach it; Burns (50), Test5 - NZ (50) and Westview (100) carry
    // one that their programme never touches. `n_cap_applied` is "did it
    // actually clamp", not "is one configured".
    const configured = SLUGS.filter((s) => bySlug[s].rec.inputs.maxNPerMonth != null);
    expect(configured.sort()).toEqual(['burns', 'federal-golf', 'new-test-location', 'test5-nz', 'westview']);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The resolver: one Required, with the old behaviour as its fallback.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-403 — annualRequired() resolves the engine\'s figure, and degrades to what it replaced', () => {
    const monthly = [
        { requirements: { N: 10, P: 1.1, K: 5.4, Ca: 2, Mg: 1, S: 0.5 } },
        { requirements: { N: 10.1, P: 1.2, K: 5.5, Ca: 2, Mg: 1, S: 0.5 } }
    ];

    test('the engine\'s annual requirement wins whenever the programme carries it', () => {
        const r = balance.annualRequired({
            annual_requirements: { N: 120, P: 14.2, K: 103.4, Ca: 139.2, Mg: 21.3, S: 7.9 },
            targets: { N: 119.9, P: 14.0, K: 103.1 },
            monthly: monthly
        });
        expect(r.P).toBeCloseTo(14.2, 6);
        expect(r.K).toBeCloseTo(103.4, 6);
        expect(r.S).toBeCloseTo(7.9, 6);
    });

    test('a programme persisted before this ticket falls back to the recommender\'s targets', () => {
        const r = balance.annualRequired({ targets: { N: 119.9, P: 14.0, K: 103.1 }, monthly: monthly });
        expect(r.P).toBeCloseTo(14.0, 6);
        expect(r.K).toBeCloseTo(103.1, 6);
    });

    test('and to the monthly sum when there is no targets vector either', () => {
        const r = balance.annualRequired({ monthly: monthly });
        expect(r.N).toBeCloseTo(20.1, 6);
        expect(r.P).toBeCloseTo(2.3, 6);
        expect(r.K).toBeCloseTo(10.9, 6);
    });

    test('nothing at all is zeros, not NaN in a printed cell', () => {
        expect(balance.annualRequired(null)).toEqual({ N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 });
        expect(balance.annualRequired({})).toEqual({ N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 });
    });

    test('all three panels resolve it through the one shared function', () => {
        ['nutrition-au-fertiliser-integration.js', 'nutrition-prebble-integration.js',
            'nutrition-uk-fertiliser-integration.js'].forEach((f) => {
            const src = code(readAsset(f));
            expect(src).toMatch(/mod\.annualRequired\(program\)/);
            expect(src).toMatch(/GAIP_NutrientBalanceStatus/);
            // ...and none of them still sums the monthly requirement rows.
            expect(src).not.toMatch(/nutrientRequired\.[NPK] \+= /);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. What the two surfaces print, per site.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Plan panel prints `formatDelivered(annual_requirements[n])` and the Word
 * document prints `_round1dpForDisplay(perSample[n].annualRequirement)`. Both
 * are one rounding of the same core output at 1 dp, so on real inputs they must
 * produce the identical STRING — not a value within a tolerance.
 */
describe.each(SLUGS)('GH-403 — Required is one string on both surfaces, %s', (slug) => {
    test('plan cell === document cell, per nutrient', () => {
        const { after } = bySlug[slug];
        const required = balance.annualRequired({ annual_requirements: after.annual_totals });
        const documentCell = (v) => delivery.roundAtOutput(v, 1).toFixed(1);
        ['N', 'P', 'K'].forEach((n) => {
            expect(delivery.formatDelivered(required[n])).toBe(documentCell(after.annual_totals[n]));
        });
    });

    test('N is unmoved — it never went through the rounding that was removed', () => {
        const { before, after } = bySlug[slug];
        expect(after.annual_totals.N).toBe(before.annual_totals.N);
    });

    test('and it is no longer the sum of the twelve rows the panel used to add up', () => {
        // The pre-GH-403 figure, computed the pre-GH-403 way from the SAME
        // programme, so the divergence is demonstrated rather than asserted.
        const { after } = bySlug[slug];
        const summed = balance.annualRequired({ monthly: after.program.monthly.map((m) => ({ requirements: m })) });
        const drift = {};
        ['P', 'K'].forEach((n) => {
            const d = Math.round((summed[n] - after.annual_totals[n]) * 10) / 10;
            if (d !== 0) drift[n] = d;
        });
        // Measured on 2026-09-10 by running the real calendar over each site's
        // own inputs. Zero here means the two happened to coincide on that site
        // — which is exactly why the old code looked correct on some sites and
        // wrong on others.
        const EXPECTED_DRIFT = {
            'burns': { P: -0.1 },
            'canberra': { P: -0.2 },
            'federal-golf': { P: -0.2, K: 0.1 },
            'new-test-location': { P: 0.1, K: 0.1 },
            'russley': { K: -0.1 },
            'test1-sports': {},
            'test4-usa': { P: 0.1, K: 0.1 },
            'test5-nz': {},
            'test6-uk': { P: 0.1 },
            'westview': { K: -0.1 }
        };
        expect(drift).toEqual(EXPECTED_DRIFT[slug]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Defect 2 — the caption is the sum of the rows above it.
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
            head: stubEl(), body: stubEl(), getElementById: () => null,
            querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: stubEl
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
const AU_SITES = ['burns', 'new-test-location', 'federal-golf', 'canberra', 'test1-sports', 'westview'];

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

function renderAu(slug, annualRequirements) {
    const sandbox = makeSandbox(AU_FILES);
    const fx = JSON.parse(fs.readFileSync(
        path.join(FIXTURES, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));
    const raw = sandbox.AuFertiliserRecommender.generateAnnualProgram(fx.requirements, fx.options);
    const acc = sandbox.GAIP_NutritionDelivery.accumulate(raw.monthly);
    const html = sandbox.NutritionAuFertiliserIntegration.buildRecommendationsHTML({
        meta: {
            surfaceType: fx.options.surfaceType, methodology: fx.options.methodology,
            useGM2: ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets']
                .indexOf(fx.options.surfaceType) !== -1
        },
        monthly: raw.monthly,
        annualSummary: { products: acc.products },
        // GH-403: `annual_requirements` is what generateProgram() carries
        // through from the calendar. Passing it alongside the recommender's own
        // `targets` is the point — the two differ, and the panel must print the
        // former.
        annual_requirements: annualRequirements || undefined,
        targets: raw.targets,
        delivered: raw.delivered,
        balance: raw.balance
    });
    return { html, acc, errors: sandbox.__errors };
}

function productRows(html) {
    return [...html.matchAll(/<tr>\s*<td class="au-fert-cell au-fert-cell--left">[\s\S]*?<\/tr>/g)]
        .map((m) => cells(m[0])).filter((c) => c.length === 6);
}

describe.each(AU_SITES)('GH-403 — the Annual Product Summary adds up, %s', (slug) => {
    let html;
    let acc;
    let errors;
    beforeAll(() => {
        const r = renderAu(slug);
        html = r.html;
        acc = r.acc;
        errors = r.errors;
    });

    test('nothing reported a missing module while rendering', () => {
        expect(errors).toEqual([]);
    });

    test('the printed rows sum to the printed caption, digit for digit', () => {
        const rows = productRows(html);
        expect(rows.length).toBeGreaterThan(0);
        const caption = rowAfter(html, 'Total Delivered').slice(3, 6);
        ['N', 'P', 'K'].forEach((n, i) => {
            const col = 3 + i;
            rows.forEach((c) => expect(c[col]).toMatch(/^-?\d+\.\d$/));
            const sum = rows.reduce((a, c) => a + parseFloat(c[col]), 0);
            expect(Math.round(sum * 10) / 10).toBeCloseTo(parseFloat(caption[i]), 6);
        });
    });

    test('the caption is still the TRUE total, not the sum of the roundings', () => {
        // The half of Rule B the sum-of-rows alternative would have broken. The
        // caption must remain a rounding of the accumulator's own figure, so it
        // cannot drift upward as rows are added.
        const caption = rowAfter(html, 'Total Delivered').slice(3, 6);
        ['N', 'P', 'K'].forEach((n, i) => {
            expect(caption[i]).toBe(delivery.formatDelivered(acc.totals[n]));
        });
    });

    test('and it is the same figure the Nutrient Delivery Summary prints', () => {
        const caption = rowAfter(html, 'Total Delivered').slice(3, 6);
        const summary = {};
        [...html.matchAll(/<tr class="nutrient-[a-z-]+">([\s\S]*?)<\/tr>/g)].forEach((m) => {
            const c = cells(m[0]);
            if (c.length >= 8) summary[c[0]] = c[4];
        });
        ['N', 'P', 'K'].forEach((n, i) => expect(summary[n]).toBe(caption[i]));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The RENDERED Required cell — the figure a reader sees, per site.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The panel is handed a programme carrying BOTH `annual_requirements` (the
 * engine's figure, as generateProgram() now carries it through) and the
 * recommender's `targets` (the sum of the twelve rounded monthly rows). They
 * differ on most of these sites, so the printed cell says which one the panel
 * actually read — a source pin alone would not.
 */
describe.each(AU_SITES)('GH-403 — the rendered Required cell, %s', (slug) => {
    let engineRequired;
    let printed;
    let printedFromOldProgramme;

    beforeAll(() => {
        engineRequired = bySlug[slug].after.annual_totals;
        printed = rowAfter(renderAu(slug, engineRequired).html, '<em>Required (kg/ha)</em>');
        printedFromOldProgramme = rowAfter(renderAu(slug).html, '<em>Required (kg/ha)</em>');
    });

    test('it prints the engine\'s annual requirement, at the document\'s precision', () => {
        expect(printed).not.toBeNull();
        ['N', 'P', 'K'].forEach((n, i) => {
            expect(printed[1 + i]).toBe(delivery.roundAtOutput(engineRequired[n], 1).toFixed(1));
        });
    });

    test('a programme with no annual_requirements still renders, the old way', () => {
        // The graceful-degradation branch: a programme persisted before this
        // ticket and restored from the site config falls back to `targets`, so
        // an old panel keeps rendering its old figure rather than blanking.
        expect(printedFromOldProgramme).not.toBeNull();
        ['N', 'P', 'K'].forEach((i) => expect(printedFromOldProgramme[1]).toMatch(/^\d+\.\d$/));
    });
});

test('GH-403 — the four cells GH-401 measured live now print the document\'s figure', () => {
    // The claim in one place: the Plan cell a client looked at, and the .docx
    // cell beside it. `was` is the panel rendering the recommender's `targets`
    // — the sum of the twelve rounded monthly rows, i.e. the pre-GH-403 code
    // over the pre-GH-403 persisted programme — and it reproduces GH-401's live
    // Plan readings exactly. `now` is the same panel handed the engine's annual
    // requirement, and it reproduces GH-401's live DOCUMENT readings exactly.
    //
    // Restricted to the sites whose two fixtures were captured from the same
    // programme generation. Canberra's persisted recommender programme predates
    // GH-398/400 and no longer reproduces under today's calendar at all
    // (K 110 stored against 106.7 recomputed), which is a fixture-age question
    // and not this ticket's.
    const CASES = [
        { slug: 'burns', nutrient: 'P', planWas: '14.0', document: '14.1' },
        { slug: 'federal-golf', nutrient: 'P', planWas: '11.9', document: '12.0' },
        { slug: 'federal-golf', nutrient: 'K', planWas: '63.9', document: '64.0' },
        { slug: 'new-test-location', nutrient: 'P', planWas: '14.0', document: '14.2' }
    ];
    const observed = CASES.map((c) => {
        const i = ['N', 'P', 'K'].indexOf(c.nutrient);
        const was = rowAfter(renderAu(c.slug).html, '<em>Required (kg/ha)</em>')[1 + i];
        const now = rowAfter(renderAu(c.slug, bySlug[c.slug].after.annual_totals).html,
            '<em>Required (kg/ha)</em>')[1 + i];
        return { slug: c.slug, nutrient: c.nutrient, was: was, now: now };
    });
    expect(observed).toEqual(CASES.map((c) => ({
        slug: c.slug, nutrient: c.nutrient, was: c.planWas, now: c.document
    })));
});

/**
 * The other two panels, on GH-399's captured programmes. Same claim, different
 * renderer: New Zealand's table merges its first three columns into a colspan
 * and the UK's is built by string concatenation, so "the caption is the sum of
 * the rows" has to be shown in each of the three, not inferred from one.
 */
describe.each([
    ['nutrition-prebble-integration.js', 'NutritionPrebbleIntegration', 'test5-nz-soccer',
        /<tr>\s*<td class="prebble-cell prebble-cell--left">[\s\S]*?<\/tr>/g, '>Total Delivered<', 1],
    ['nutrition-uk-fertiliser-integration.js', 'NutritionUkFertiliserIntegration', 'test6-uk-mlsn',
        /<tr>\s*<td class="uk-fert-cell uk-fert-cell--left">[\s\S]*?<\/tr>/g, '>Total Delivered<', 1]
])('GH-403 — %s, rendered', (file, globalName, fixture, rowRe, captionAnchor, captionOffset) => {
    let html;
    let acc;
    let errors;

    beforeAll(() => {
        const sandbox = makeSandbox([
            'nutrition-delivery-core.js', 'nutrient-balance-status.js', 'gp-status.js',
            file === 'nutrition-uk-fertiliser-integration.js' ? 'uk-fertiliser-products.js' : null,
            file
        ].filter(Boolean));
        const fx = JSON.parse(fs.readFileSync(
            path.join(FIXTURES, 'gh399-delivery-programme-' + fixture + '.json'), 'utf8'));
        acc = sandbox.GAIP_NutritionDelivery.accumulate(fx.monthly);
        html = sandbox[globalName].buildRecommendationsHTML({
            meta: fx.meta, monthly: fx.monthly, annualSummary: { products: acc.products },
            delivered: fx.delivered, targets: fx.targets
        });
        errors = sandbox.__errors;
    });

    test('nothing reported a missing module while rendering', () => {
        expect(errors).toEqual([]);
    });

    test('the printed rows sum to the printed caption', () => {
        const rows = [...html.matchAll(rowRe)].map((m) => cells(m[0])).filter((c) => c.length === 6);
        expect(rows.length).toBeGreaterThan(0);
        const caption = rowAfter(html, captionAnchor).slice(captionOffset, captionOffset + 3);
        ['N', 'P', 'K'].forEach((n, i) => {
            const printed = rows.map((c) => c[3 + i]);
            printed.forEach((v) => expect(v).toMatch(/^-?\d+\.\d$/));
            const sum = printed.reduce((a, v) => a + parseFloat(v), 0);
            expect(Math.round(sum * 10) / 10).toBeCloseTo(parseFloat(caption[i]), 6);
            // ...and the caption is still a rounding of the true total.
            expect(caption[i]).toBe(delivery.formatDelivered(acc.totals[n]));
        });
    });
});

test('GH-403 — the rejected alternative, measured: whole-kilogram rows drift upward', () => {
    // Why the caption did not simply become the sum of the printed rows. Six
    // Test6 - UK potassium rows all round up; their whole-kilogram sum is 127
    // against a true 125.4, and the same document's Annual Nutrient Requirements
    // table prints 125.4 for that quantity. The bias grows with the row count,
    // which is what makes it the wrong half of the pair to give up.
    const uk = JSON.parse(fs.readFileSync(
        path.join(FIXTURES, 'gh399-delivery-programme-test6-uk-mlsn.json'), 'utf8'));
    const acc = delivery.accumulate(uk.monthly);
    const rows = Object.values(acc.products);
    const wholeKgRows = { N: 0, P: 0, K: 0 };
    const onedpRows = { N: 0, P: 0, K: 0 };
    ['N', 'P', 'K'].forEach((n) => {
        rows.forEach((p) => {
            wholeKgRows[n] += Math.round(p.nutrients[n] || 0);
            onedpRows[n] += parseFloat(delivery.formatDelivered(p.nutrients[n] || 0));
        });
    });
    expect(wholeKgRows.K).toBe(127);
    expect(wholeKgRows.P).toBe(29);
    expect(acc.totals.K).toBeCloseTo(125.4, 6);
    expect(acc.totals.P).toBeCloseTo(27.8, 6);
    // At one decimal the same rows land exactly on the true total.
    ['N', 'P', 'K'].forEach((n) => {
        expect(Math.round(onedpRows[n] * 10) / 10).toBeCloseTo(delivery.roundAtOutput(acc.totals[n], 1), 6);
    });
});

test('GH-403 — Burns, the case that exposed it: 113.1 + 7.0 + 5.4 under a caption of 125.5', () => {
    const { html } = renderAu('burns');
    const rows = productRows(html);
    expect(rows.map((c) => c[3])).toEqual(['113.1', '7.0', '5.4']);
    expect(rowAfter(html, 'Total Delivered')[3]).toBe('125.5');
    // The two figures the reader used to be handed instead.
    expect(rows.map((c) => Math.round(parseFloat(c[3]))).reduce((a, b) => a + b, 0)).toBe(125);
    expect(delivery.roundAtOutput(125.5)).toBe(126);
});

test('GH-403 — the precision is stated once, and the export reads it', () => {
    expect(delivery.DELIVERED_DP).toBe(1);
    expect(delivery.formatDelivered(125.5)).toBe('125.5');
    expect(delivery.formatDelivered(0)).toBe('0.0');
    expect(delivery.formatDelivered('nonsense')).toBe('0.0');
    const wx = code(readAsset('word-export.js'));
    expect(wx).toMatch(/_dmFmt\.formatDelivered\(v\)/);
    expect(wx).toMatch(/GH-403: nutrition-delivery-core\.js is not loaded/);
});
