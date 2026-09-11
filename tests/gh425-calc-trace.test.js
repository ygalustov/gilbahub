/**
 * GH-425 — the temporary "How this was calculated" block under the Plan page's
 * Nutrient Delivery Summary.
 *
 * WHAT THIS FILE IS FOR. The block's only real risk is that it becomes a second
 * implementation of the calculation, agreeing with itself while disagreeing with
 * the product. So the tests below are mostly not about wording: they assert that
 *
 *   1. the engines now publish the intermediates the derivation is made of, and
 *      that those intermediates reproduce the engine's OWN answer when the
 *      printed working is carried out (so the block cannot print a chain that
 *      lands somewhere other than the figure beside it);
 *   2. the block READS them — proved by mutating an engine value and watching
 *      the printed figure follow it, which a local recomputation could not do;
 *   3. it is one file with one entry point, reachable only from the Plan page.
 *
 * Ammonium Acetate is covered here because every AA site on the development
 * database is in New Zealand, and the live harness
 * (tests/e2e/gh425-calc-trace-live.test.js) deliberately does not open a Plan
 * page for one. The AA inputs are the real, DB-verified Russley / Green 18
 * fixture; the delivery ledger is the real Test5 - NZ recommender programme,
 * which is also the one fixture whose applications carry no `delivers` vector
 * and therefore exercise the mass x analysis branch the Australian programmes
 * never reach.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    head: { appendChild: function () {} },
    createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; }
};
const _realConsole = global.console;
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
require('../assets/species-controller.js');
require('../assets/hill-labs-sample-types.js');
require('../assets/ammonium-acetate-methodology.js');
require('../assets/gaip-classification-constants.js');
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;
const Balance = require('../assets/nutrient-balance-status.js');
global.window.GAIP_NutrientBalanceStatus = Balance;
const Delivery = require('../assets/nutrition-delivery-core.js');
global.window.GAIP_NutritionDelivery = Delivery;
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const Calendar = global.window.GilbaNutritionCalendar;
const Trace = require('../assets/plan-calc-trace.js');

global.console = _realConsole;

const AA = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh414-russley-green18-aa-sand.json'), 'utf8'));
const NZ_PROGRAMME = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh399-delivery-programme-test5-nz-soccer.json'), 'utf8'));
// The one live-verified below-floor pass through an Ammonium Acetate site in
// the development database (GH-370). Russley's own P sits above its certificate
// ceiling, so the lift branch needs this fixture rather than an invented ppm.
const BELOW_FLOOR = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/test5-soccer-sample141-belowfloor-gh370.json'), 'utf8'));

const MONTHLY_TEMPS = { 0: 17.5, 1: 17.1, 2: 15.1, 3: 11.9, 4: 9.2, 5: 6.6,
                        6: 5.9, 7: 7.1, 8: 8.9, 9: 10.8, 10: 13.3, 11: 15.8 };

function aaRanges(soilTexture) {
    return NPI.resolveSufficiencyRanges({
        methodology: AA.inputs.methodology,
        speciesDisplay: AA.inputs.species,
        speciesKey: 'bentgrass',
        soilTexture: soilTexture || AA.expected.soilTexture,
        CEC: null,
        pH: null
    });
}

/** A real programme, through the real Plan-page entry point. */
function programme(overrides) {
    const resolved = aaRanges();
    return Calendar.computeProgram(Object.assign({
        annualNOverride: AA.inputs.annualN,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: AA.inputs.clippingManagement,
        bulkDensity: AA.inputs.bulkDensity,
        soilDepth: AA.inputs.soilDepth,
        methodology: AA.inputs.methodology,
        species: 'bentgrass',
        speciesDisplay: AA.inputs.species,
        soilTexture: AA.expected.soilTexture,
        pH: null,
        CEC: null,
        isC4: false,
        hemisphere: 'south',
        latitude: -43.495388,
        longitude: 172.5560607,
        distribution: 'gp_weighted',
        maxNPerMonth: 25,
        monthlyTemps: MONTHLY_TEMPS,
        monthlyTempsSource: 'nasa-power',
        monthlyTempsPeriod: '20-year (January 2001 - December 2020)',
        soilPpm: AA.inputs.soilPpm,
        tissuePercent: AA.inputs.tissuePercent,
        ranges: resolved.ranges,
        rangeSources: resolved.sources,
        inputSources: { annualN: 'plan', methodology: 'sample', clippingManagement: 'plan' },
        surfaceType: 'greens'
    }, overrides));
}

/** The GH-370 below-floor pass, through the same entry point. */
function belowFloorProgramme() {
    const i = BELOW_FLOOR.inputs;
    const resolved = NPI.resolveSufficiencyRanges({
        methodology: i.methodology, speciesDisplay: i.species, speciesKey: i.speciesKey,
        soilTexture: i.soilTexture, CEC: i.CEC, pH: i.pH
    });
    return Calendar.computeProgram({
        annualNOverride: i.annualN, traffic: 'moderate', trafficModifier: 1.0,
        clippingManagement: 'collected', bulkDensity: i.bulkDensity, soilDepth: i.soilDepth,
        methodology: i.methodology, species: i.speciesKey, speciesDisplay: i.species,
        soilTexture: i.soilTexture, pH: i.pH, CEC: i.CEC, isC4: false, hemisphere: 'south',
        distribution: 'gp_weighted', maxNPerMonth: 50, monthlyTemps: MONTHLY_TEMPS,
        monthlyTempsSource: 'nasa-power', soilPpm: i.soilPpm, tissuePercent: i.tissuePercent,
        ranges: resolved.ranges, rangeSources: resolved.sources, surfaceType: 'sports'
    });
}

function trace(cal, recProgramme) {
    return Trace.buildTrace({
        calendar: cal,
        program: recProgramme || NZ_PROGRAMME,
        // GH-428: buildTrace() no longer takes a `context`. The one row that
        // read it printed the recommender's discarded INPUT value; the soil
        // temperature now comes off `program.soilTempSeries`, which is what the
        // recommender recorded itself using.
        deliveryModule: Delivery,
        balanceModule: Balance
    });
}

/**
 * The cells the rendered Nutrient Delivery Summary would carry for this
 * programme — built the way the NZ and AU panels build them (the shared
 * classifier's own strings, the shared rounder for Required and Delivered), so
 * that the self-check is exercised against a faithful stand-in for the table.
 */
function panelRowsFrom(cal, recProgramme) {
    const acc = Delivery.accumulate((recProgramme || NZ_PROGRAMME).monthly);
    const rows = {};
    ['N', 'P', 'K'].forEach((n) => {
        const b = Balance.classify({
            nutrient: n, required: cal.annual_totals[n], delivered: acc.totals[n],
            currentPpm: cal.soil.ppm[n], removal: cal.annual_removal[n],
            range: cal.annual_totals_range[n],
            bulkDensity: cal.soil.bulkDensity, soilDepth: cal.soil.soilDepth,
            missingSoilData: !!cal.missing_soil_data[n]
        });
        rows[n] = {
            Current: String(b.currentDisplay),
            Removal: (typeof cal.annual_removal[n] === 'number') ? String(cal.annual_removal[n]) : '—',
            Required: Delivery.roundAtOutput(cal.annual_totals[n], 1).toFixed(1),
            Delivered: Delivery.roundAtOutput(acc.totals[n], 1).toFixed(1),
            Range: String(b.rangeDisplay),
            Balance: b.diff.toFixed(1),
            Status: String(b.statusLabel)
        };
    });
    return rows;
}

function stepsFor(t, nutrient) {
    return (t.nutrients.find((n) => n.nutrient === nutrient) || {}).steps || [];
}
function stepLike(t, nutrient, re) {
    return stepsFor(t, nutrient).find((s) => re.test(s.label));
}

// ===========================================================================
describe('GH-425 — the engines publish the working, and the working reproduces their own answer', () => {
    const round1 = (v) => Math.round(v * 10) / 10;

    test('the requirement core carries the unit, the correction period and the removal ratio it used', () => {
        const p = programme();
        const d = p.requirement_detail;
        expect(d).toBeTruthy();
        ['P', 'K'].forEach((n) => {
            expect(d[n].ppmToKgHaFactor).toBeCloseTo(AA.inputs.bulkDensity * AA.inputs.soilDepth * 0.1, 9);
            expect(d[n].yearsToCorrect).toBe(Core.YEARS_TO_CORRECT[n]);
            expect(d[n].bulkDensityUsed).toBe(AA.inputs.bulkDensity);
            expect(d[n].soilDepthUsed).toBe(AA.inputs.soilDepth);
            expect(typeof d[n].removalRatio).toBe('number');
            expect(['tissue', 'species-table']).toContain(d[n].removalRatioSource);
            expect(d[n].annualNUsed).toBe(AA.inputs.annualN);
            expect(d[n].speciesKeyUsed).toBe('bentgrass');
        });
    });

    test('the tissue gate names itself as the source of the P and K removal ratio', () => {
        const p = programme();
        expect(p.tissue_gate_applied).toBe(true);
        expect(p.tissue_percent).toEqual(AA.inputs.tissuePercent);
        expect(p.requirement_detail.P.removalRatioSource).toBe('tissue');
        expect(p.requirement_detail.P.removalRatio)
            .toBeCloseTo(AA.inputs.tissuePercent.P / AA.inputs.tissuePercent.N, 9);
        expect(p.requirement_detail.K.removalRatio)
            .toBeCloseTo(AA.inputs.tissuePercent.K / AA.inputs.tissuePercent.N, 9);
    });

    test('the below-floor working, carried out, lands on the engine\'s own annual requirement', () => {
        // Test5 - NZ / Soccer as GH-370 verified it live: P 10 and K 40 against
        // the S277 certificate's {20,30} and {78.2,195.5}.
        const p = belowFloorProgramme();
        ['P', 'K'].forEach((n) => {
            const d = p.requirement_detail[n];
            expect(d.intent).toBe('lift-to-floor');
            expect(d.liftPpmGap).toBeCloseTo(d.floor - d.currentLevel, 9);
            expect(d.liftKgHaBeforeSpread).toBeCloseTo(d.liftPpmGap * d.ppmToKgHaFactor, 9);
            expect(d.correctionRequired).toBeCloseTo(d.liftKgHaBeforeSpread / d.yearsToCorrect, 9);
            expect(round1(d.removal + d.correctionRequired)).toBeCloseTo(d.annualRequirement, 9);
        });
        // And the block prints that chain, with those figures.
        const s = stepLike(trace(p), 'K', /^Requirement — branch/);
        expect(s.label).toMatch(/lift to floor/);
        expect(s.working).toContain('spread over ' + p.requirement_detail.K.yearsToCorrect + ' years');
        expect(parseFloat(s.result)).toBeCloseTo(p.requirement_detail.K.annualRequirement, 6);
    });

    test('the above-ceiling working, carried out, lands on the engine\'s own annual requirement', () => {
        const p = programme({ soilPpm: { P: 200, K: 400 } });
        ['P', 'K'].forEach((n) => {
            const d = p.requirement_detail[n];
            expect(['maintain-floor', 'suppress-above-ceiling']).toContain(d.intent);
            expect(d.headroomPpm).toBeCloseTo(d.currentLevel - d.floor, 9);
            expect(d.headroomKgHa).toBeCloseTo(d.headroomPpm * d.ppmToKgHaFactor, 9);
            expect(round1(Math.max(0, d.removal - d.headroomKgHa))).toBeCloseTo(d.annualRequirement, 9);
            expect(d.maintainRaw).toBeCloseTo(Math.max(0, d.removal - d.headroomKgHa), 9);
        });
    });

    test('a nutrient with no reading is returned, flagged, with the branch fields left null', () => {
        const p = programme({ soilPpm: { P: null, K: 156.4 } });
        const d = p.requirement_detail.P;
        expect(p.missing_soil_data.P).toBe(true);
        expect(d.intent).toBe('removal-only-no-soil-data');
        expect(d.currentLevel).toBeNull();
        expect(d.liftPpmGap).toBeNull();
        expect(d.headroomKgHa).toBeNull();
        expect(d.annualRequirement).toBe(d.removal);
    });

    test('the balance classifier publishes the three terms it compared and the verdict\'s branch', () => {
        const p = programme();
        const r = Balance.classify({
            nutrient: 'K', required: p.annual_totals.K, delivered: 120,
            currentPpm: p.soil.ppm.K, removal: p.annual_removal.K,
            range: p.annual_totals_range.K,
            bulkDensity: p.soil.bulkDensity, soilDepth: p.soil.soilDepth,
            missingSoilData: false
        });
        expect(['within-range', 'above-ceiling', 'below-floor']).toContain(r.branch);
        expect(r.unit).toBeCloseTo(p.soil.bulkDensity * p.soil.soilDepth * 0.1, 9);
        expect(r.delivered).toBe(120);
        expect(r.removal).toBe(p.annual_removal.K);
        expect(r.balanceKgHa).toBeCloseTo(r.currentKgHa + r.delivered - r.removal, 9);
        expect(r.floorKgHa).toBeCloseTo(p.annual_totals_range.K.min * r.unit, 9);
        expect(r.ceilingKgHa).toBeCloseTo(p.annual_totals_range.K.max * r.unit, 9);
        expect(r.diff).toBe(r.balanceKgHa);
    });

    test('the no-range branch publishes the delivery ratio the verdict was read off', () => {
        const r = Balance.classify({ nutrient: 'N', required: 200, delivered: 150 });
        expect(r.branch).toBe('no-range-delivery-ratio');
        expect(r.pct).toBe(75);
        expect(r.statusLabel).toMatch(/^Monitor/);
        const z = Balance.classify({ nutrient: 'N', required: 0, delivered: 0 });
        expect(z.branch).toBe('no-range-nothing-required');
        const m = Balance.classify({ nutrient: 'P', required: 12, delivered: 0, missingSoilData: true });
        expect(m.branch).toBe('missing-soil-data');
    });

    test('the delivery ledger carries the analysis it multiplied the mass by', () => {
        const acc = Delivery.accumulate(NZ_PROGRAMME.monthly);
        const analysisLines = acc.applications.filter((a) => a.source.N === 'analysis');
        expect(analysisLines.length).toBeGreaterThan(0);
        analysisLines.forEach((a) => {
            expect(a.analysisPct).toBeTruthy();
            expect(a.mass).toBeCloseTo(a.rate * a.count, 9);
            ['N', 'P', 'K'].forEach((n) => {
                if (a.source[n] !== 'analysis') return;
                expect(a.nutrients[n]).toBeCloseTo(a.mass * (a.analysisPct[n] || 0) / 100, 9);
            });
        });
        // Every non-amendment line adds up to the published total.
        ['N', 'P', 'K'].forEach((n) => {
            const sum = acc.applications.reduce((s, a) => s + (a.isAmendment ? 0 : a.nutrients[n]), 0);
            expect(sum).toBeCloseTo(acc.totals[n], 6);
        });
    });

    test('the programme carries the two range-selecting inputs it never used to', () => {
        const p = programme({ pH: 6.4 });
        expect(p.soil.pH).toBe(6.4);
        expect(p.soil.soilTexture).toBe('sand');
        expect(p.meta.monthlyTempsSource).toBe('nasa-power');
        expect(p.meta.monthlyTempsPeriod).toMatch(/2001/);
        expect(p.meta.maxNPerMonth).toBe(25);
    });
});

// ===========================================================================
describe('GH-425 — the block reads those values rather than working them out', () => {
    test('a changed engine figure changes the printed figure', () => {
        const p = programme();
        const before = stepLike(trace(p), 'P', /^Requirement — branch/);
        expect(parseFloat(before.result)).toBeCloseTo(p.requirement_detail.P.annualRequirement, 6);

        // A local recomputation could not follow this.
        p.requirement_detail.P.annualRequirement = 123.45;
        const after = stepLike(trace(p), 'P', /^Requirement — branch/);
        expect(after.result).toBe('123.45 kg/ha');
    });

    test('a changed unit changes the printed conversion', () => {
        const p = programme();
        p.requirement_detail.K.ppmToKgHaFactor = 9.99;
        const s = stepLike(trace(p), 'K', /^Soil reading/);
        expect(s.working).toContain('9.99 kg/ha per ppm');
    });

    test('a changed removal ratio changes the printed removal working', () => {
        const p = programme();
        p.requirement_detail.K.removalRatio = 0.4242;
        p.requirement_detail.K.removalBase = 84.84;
        const s = stepLike(trace(p), 'K', /^Removal/);
        expect(s.working).toContain('0.4242');
        expect(s.working).toContain('84.84');
    });

    test('the delivered lines are the shared accumulator\'s ledger, and add up to its total', () => {
        const t = trace(programme());
        const acc = Delivery.accumulate(NZ_PROGRAMME.monthly);
        ['N', 'P', 'K'].forEach((n) => {
            const s = stepLike(t, n, /^Delivered/);
            expect(parseFloat(s.result)).toBeCloseTo(acc.totals[n], 6);
            const sum = (s.lines || []).reduce(
                (a, l) => a + (l.excluded ? 0 : parseFloat(l.value)), 0);
            expect(sum).toBeCloseTo(acc.totals[n], 4);
        });
    });

    test('an analysis-derived contribution shows the mass and the percentage it came from', () => {
        const t = trace(programme());
        const s = stepLike(t, 'N', /^Delivered/);
        const acc = Delivery.accumulate(NZ_PROGRAMME.monthly);
        const first = acc.applications.find((a) => a.source.N === 'analysis' && a.nutrients.N);
        const line = (s.lines || []).find((l) => l.name === first.name);
        expect(line).toBeTruthy();
        expect(line.rate).toBe(Trace._fmt(first.rate) + ' ' + first.rateUnit + ' x ' +
            Trace._fmt(first.count) + ' = ' + Trace._fmt(first.mass));
        expect(line.how).toBe(Trace._fmt(first.mass) + ' x ' +
            Trace._fmt(first.analysisPct.N) + '% = ' + Trace._fmt(first.nutrients.N));
    });

    test('a declared contribution says it was declared, and does not restate it as arithmetic', () => {
        const t = trace(programme());
        const acc = Delivery.accumulate(NZ_PROGRAMME.monthly);
        const declared = acc.applications.find((a) => a.source.N === 'declared' && a.nutrients.N);
        if (!declared) return;                        // fixture-dependent
        const line = (stepLike(t, 'N', /^Delivered/).lines || [])
            .find((l) => l.name === declared.name);
        expect(line.how).toBe('declared by the recommender: ' + Trace._fmt(declared.nutrients.N));
    });

    test('the nitrogen chain is the programme\'s own adjustments block, step by step', () => {
        const p = programme();
        const t = trace(p);
        expect(stepLike(t, 'N', /^Annual N target/).result)
            .toBe(Trace._fmt(p.meta.annualNBase) + ' kg/ha');
        expect(stepLike(t, 'N', /^Traffic/).result)
            .toBe(Trace._fmt(p.adjustments.target_n) + ' kg/ha');
        expect(stepLike(t, 'N', /^Clipping/).result)
            .toBe(Trace._fmt(p.adjustments.applied_n) + ' kg/ha');
        expect(stepLike(t, 'N', /^Required/).result)
            .toBe(Trace._fmt(p.annual_totals.N) + ' kg/ha');
        expect(stepLike(t, 'N', /^Spread over/).working)
            .toContain(String(p.meta.maxNPerMonth));
    });

    test('the Ammonium Acetate range step names the certificate the range came from', () => {
        const p = programme();
        const s = stepLike(t0(p), 'P', /^Sufficiency range/);
        expect(s.result).toBe(Trace._fmt(p.requirement_detail.P.floor) + '–' +
            Trace._fmt(p.requirement_detail.P.ceiling) + ' ppm');
        expect(s.note).toContain(AA.expected.certificateCode);
        expect(s.note).toContain('Hill Labs certificate');
        function t0(prog) { return trace(prog); }
    });

    test('a non-AA methodology is NOT described as a Hill Labs certificate', () => {
        // `annual_totals_range_source` reads 'certificate' on MLSN and SLAN by
        // design (it exists to stop the AA "Generic" badge firing), so a block
        // that printed the flag verbatim would invent a certificate.
        const p = programme({ methodology: 'mlsn', ranges: null, rangeSources: null, pH: 6.8 });
        expect(p.annual_totals_range_source.P).toBe('certificate');
        const s = stepLike(trace(p), 'P', /^Sufficiency range/);
        expect(s.note).not.toMatch(/Hill Labs/);
        expect(s.note).toContain('the published range for this methodology');
    });

    test('a nutrient with no soil reading says so on every step that would need one', () => {
        const p = programme({ soilPpm: { P: null, K: 156.4 } });
        const t = trace(p);
        expect(stepLike(t, 'P', /^Soil reading/).result).toMatch(/no reading for P/);
        expect(stepLike(t, 'P', /^Balance and status/).result).toBe('No Soil Data');
        expect(stepLike(t, 'P', /^Requirement — branch/).result)
            .toBe(Trace._fmt(p.requirement_detail.P.annualRequirement) + ' kg/ha');
    });

    test('a programme with no published working says so instead of reconstructing it', () => {
        const p = programme();
        delete p.requirement_detail;
        const t = trace(p);
        expect(t.detailAvailable).toBe(false);
        const s = stepLike(t, 'P', /^Requirement working/);
        expect(s.result).toBe('not available');
        expect(s.note).toMatch(/deliberately not reconstructed/);
    });

    test('the self-check against the rendered summary can actually fail', () => {
        // The block is only worth having if a disagreement with the table above
        // it is loud. Red-check: hand it a summary row that says something else
        // and confirm the warning appears rather than the green line.
        const p = programme();
        const good = Trace.buildTrace({
            calendar: p, program: NZ_PROGRAMME, context: null,
            deliveryModule: Delivery, balanceModule: Balance,
            panelRows: panelRowsFrom(p)
        });
        expect(good.checks.ran).toBe(true);
        expect(good.checks.allOk).toBe(true);
        expect(good.checks.rows.length).toBe(21);
        expect(Trace.renderHtml(good)).toMatch(/All 21 figures match/);

        const rows = panelRowsFrom(p);
        rows.K.Required = '999.9';
        const bad = Trace.buildTrace({
            calendar: p, program: NZ_PROGRAMME, context: null,
            deliveryModule: Delivery, balanceModule: Balance, panelRows: rows
        });
        expect(bad.checks.allOk).toBe(false);
        const offender = bad.checks.rows.filter((r) => !r.ok);
        expect(offender).toHaveLength(1);
        expect(offender[0]).toMatchObject({ nutrient: 'K', column: 'Required', panel: '999.9' });
        const html = Trace.renderHtml(bad);
        expect(html).toMatch(/do NOT match the summary above/);
        expect(html).toMatch(/Trust the summary, not this block/);
        expect(html).not.toMatch(/figures match the Nutrient Delivery Summary/);
    });

    test('no programme at all, or a missing engine module, is reported and not guessed', () => {
        expect(Trace.buildTrace({}).available).toBe(false);
        const bad = Trace.buildTrace({ calendar: programme(), program: NZ_PROGRAMME });
        expect(bad.available).toBe(false);
        expect(bad.reason).toMatch(/nutrition-delivery-core\.js/);
    });
});

// ===========================================================================
describe('GH-425 — it says it is temporary, and it is removable in two steps', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/plan-calc-trace.js'), 'utf8');
    const planView = fs.readFileSync(
        path.join(__dirname, '../app/resources/views/plan.blade.php'), 'utf8');

    test('the rendered block carries a plain-words temporary notice', () => {
        const html = Trace.renderHtml(trace(programme()));
        expect(html).toMatch(/Temporary — this panel will be removed/);
        expect(html).toMatch(/verification aid/);
        expect(html).toMatch(/does not appear in the Word document/);
        // Also on the unavailable path, where a reader has least context.
        expect(Trace.renderHtml({ available: false, reason: 'x' }))
            .toMatch(/Temporary — this panel will be removed/);
    });

    test('the removal instructions are in the file, and the file has exactly one entry point', () => {
        expect(src).toMatch(/TO REMOVE IT/);
        expect(src).toMatch(/delete the single <script> tag/);
        const planRefs = (planView.match(/<script src="\{\{ \$legacyAssetUrl\('plan-calc-trace\.js'\)/g) || []).length;
        expect(planRefs).toBe(1);
    });

    test('nothing but the Plan view loads it — the Word export never sees it', () => {
        const views = path.join(__dirname, '../app/resources/views');
        const hits = [];
        (function walk(dir) {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) return walk(full);
                if (!/\.blade\.php$/.test(e.name)) return;
                if (/plan-calc-trace/.test(fs.readFileSync(full, 'utf8'))) hits.push(e.name);
            });
        })(views);
        expect(hits).toEqual(['plan.blade.php']);
        ['word-export.js', 'word-export-combined.js'].forEach((f) => {
            expect(fs.readFileSync(path.join(__dirname, '../assets/' + f), 'utf8'))
                .not.toMatch(/PlanCalcTrace|plan-calc-trace/);
        });
    });

    test('it calls the shared modules rather than carrying its own copy of them', () => {
        expect(src).toMatch(/D\.accumulate\(/);
        expect(src).toMatch(/B\.classify\(/);
        // None of the thresholds, ratios or unit constants the engines own may
        // appear here. A block that held any of them could disagree with the
        // product while looking internally consistent.
        const model = src.slice(0, src.indexOf('var STYLE_ID'));
        expect(model).not.toMatch(/\*\s*0\.1\b/);
        expect(model).not.toMatch(/MLSN_THRESHOLDS|SLAN_RANGES|REMOVAL_RATES|CLIPPING_FACTORS/);
        expect(model).not.toMatch(/\bbulkDensity\s*\*/);
        expect(model).not.toMatch(/yearsToCorrect\s*[*/]/);
    });

    test('no Russian anywhere in the module or its tests', () => {
        // Cyrillic, and emoji, in the module and in the live harness. (This
        // file itself necessarily contains the character class below.)
        const CYRILLIC = /[Ѐ-ӿ]/;
        const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
        [src, fs.readFileSync(path.join(__dirname, 'e2e/gh425-calc-trace-live.test.js'), 'utf8')]
            .forEach((s) => {
                expect(CYRILLIC.test(s)).toBe(false);
                expect(EMOJI.test(s)).toBe(false);
            });
    });
});
