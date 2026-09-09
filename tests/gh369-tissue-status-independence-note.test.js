/**
 * GH-369 — tissue-ratio-informed removal figure vs. tissue plant-status flag:
 * make the two independent signals visible together instead of contradicting
 * each other several pages apart.
 *
 * Background (decided with the client, not re-litigated here): the GH-361/
 * 362/366/368 tissue-ratio gate can legitimately LOWER a nutrient's removal
 * figure (e.g. K req 100 -> ~46 kg/ha when measured K/N sits well under the
 * generic 0.55/0.556), while word-export.js's separate tissue-sufficiency
 * check independently flags the SAME reading as critically low ("apply
 * foliar potassium immediately") -- both true, answering different
 * questions (replacement dose vs. plant status). The fix explicitly does
 * NOT reconcile the two numerically (that would reintroduce the
 * over-application risk this project's D06/D07 fixes guard against, when
 * the real cause is an uptake restriction rather than undersupply) -- it
 * makes both signals appear together, in the same row/unit, with an inline
 * explanation, and gives the tissue-critical advisory an honest "no
 * verified generic foliar rate" note instead of a fabricated dose.
 *
 * This repo's own Test5-NZ / Soccer tissue sample (N 4.57%, P 0.62%,
 * K 1.05%) is the real fixture GH-361 verified the ratio gate against, and
 * is used again here: K/N = 0.230, well under the generic 0.556 (ratio gate
 * fires, tissueInformed=true), and 1.05% is below the C3 sufficiency floor's
 * critical threshold (2.00 * 0.8 = 1.6%) -- so this one real sample exercises
 * both signals at once, exactly the case this fix is for.
 *
 * REVISION (independent Opus review, same session): the first pass had five
 * real bugs, fixed here and covered by the tests below:
 *   1. tissueInformed described the REMOVAL component, not the PRINTED
 *      figure -- the AA suppress-above-ceiling branch forces the printed
 *      annualRequirement to 0 while still reporting tissueInformed=true, so
 *      the independence sentence could claim a ceiling-suppressed "0.0" was
 *      itself tissue-derived. Fixed via the shared _isTissueContradictionRow()
 *      gate (tissueInformed AND intent !== 'suppress-above-ceiling' AND
 *      tissue-sufficiency critical).
 *   2. nutrition-requirement-engine.js decided P/K tissue eligibility
 *      independently per-nutrient; nutrition-calendar.js requires ALL of
 *      N/P/K present and BOTH ratios in-band or the WHOLE gate is off. Fixed
 *      by resolveTissueGate(), which now applies the identical all-or-nothing
 *      rule in this engine too.
 *   3. The explanation only reached the K Reconciliation table, which is
 *      gated behind `_facilityKDelivered != null` -- absent on exactly the
 *      branches (climate/catalogue/distributor-unavailable) most likely to
 *      leave a tissue-lowered figure unexplained. Fixed by also marking the
 *      always-rendered Annual Nutrient Requirements table (‡ marker).
 *   4. P had the analysis (pTissueInformed) but no treatment. Fixed: P now
 *      gets the identical row-level explanation as K.
 *   5. `if (data.nutritionSummary.annualK)` skipped the whole K row (and any
 *      note) when the req was exactly 0 -- the audit's own headline "K req
 *      0.0" case. Fixed to `!= null`.
 * Also: coercion consistency (#7) between the two shared helpers, and the
 * uncited legacy K-sulphate soil dose (#10) brought in line with the new
 * honest tissue-side wording.
 */

'use strict';

const Engine = require('../assets/nutrition-requirement-engine.js');

const TISSUE_TEST5 = { N: 4.57, P: 0.62, K: 1.05 }; // real Test5-NZ/Soccer tissue sample
const C3_RANGES = { K: { lo: 2.00, hi: 3.42, unit: '%' }, P: { lo: 0.33, hi: 0.55, unit: '%' } };

describe('GH-369 — nutrition-requirement-engine.js: tissueInformed flag on every methodology branch', () => {
    test('AMMONIUM_ACETATE lift-to-floor branch reports tissueInformed=true when the K/N ratio is in-band', () => {
        const r = Engine.compute({
            soil: { K: 50, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: { K: { min: 78.2, max: 195.5 } },
            tissuePercent: TISSUE_TEST5,
        });
        expect(r.perSample.K.intent).toBe('lift-to-floor');
        expect(r.perSample.K.tissueInformed).toBe(true);
    });

    test('AMMONIUM_ACETATE suppress-above-ceiling branch still reports tissueInformed=true (removal is tissue-derived even though annualRequirement is forced to 0)', () => {
        const r = Engine.compute({
            soil: { K: 199, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: { K: { min: 78.2, max: 195.5 } },
            tissuePercent: TISSUE_TEST5,
        });
        expect(r.perSample.K.intent).toBe('suppress-above-ceiling');
        expect(r.perSample.K.annualRequirement).toBe(0);
        expect(r.perSample.K.tissueInformed).toBe(true);
    });

    test('MLSN branch reports tissueInformed=true for K, and independently for P (different ratio, both in-band)', () => {
        const r = Engine.compute({
            soil: { K: 50, P: 15 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            tissuePercent: TISSUE_TEST5,
        });
        expect(r.perSample.K.tissueInformed).toBe(true);
        expect(r.perSample.P.tissueInformed).toBe(true);
    });

    test('SLAN branch reports tissueInformed=false when no tissue sample is supplied (generic ratio used)', () => {
        const r = Engine.compute({
            soil: { K: 50 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            tissuePercent: null,
        });
        expect(r.perSample.K.tissueInformed).toBe(false);
    });

    test('Ca/Mg/S are never tissue-informed -- D07a scopes the gate to P/K only', () => {
        const r = Engine.compute({
            soil: { Ca: 400, Mg: 60, S: 20 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            tissuePercent: TISSUE_TEST5,
        });
        expect(r.perSample.Ca.tissueInformed).toBe(false);
        expect(r.perSample.Mg.tissueInformed).toBe(false);
        expect(r.perSample.S.tissueInformed).toBe(false);
    });
});

describe('GH-369 follow-up (bug 2) — resolveTissueGate() matches nutrition-calendar.js\'s all-or-nothing eligibility rule', () => {
    test('a fully plausible tissue sample makes BOTH P and K eligible', () => {
        const gate = Engine._resolveTissueGate(TISSUE_TEST5);
        expect(gate.eligible).toBe(true);
        expect(gate.pRatio).toBeCloseTo(0.62 / 4.57, 6);
        expect(gate.kRatio).toBeCloseTo(1.05 / 4.57, 6);
    });

    test('regression for the reviewer\'s exact scenario: P entered in mg/kg (implausible) disables the WHOLE gate, including K, which is plausible on its own', () => {
        const gate = Engine._resolveTissueGate({ N: 4.57, P: 6200, K: 1.05 });
        expect(gate.eligible).toBe(false);
        const r = Engine.compute({
            soil: { K: 50 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            tissuePercent: { N: 4.57, P: 6200, K: 1.05 },
        });
        // Pre-fix this was tissueInformed=true (K decided independently);
        // post-fix it must fall back to the generic ratio like the calendar does.
        expect(r.perSample.K.tissueInformed).toBe(false);
        expect(r.perSample.K.removal).toBe(100); // perennialRyegrass generic K
    });

    test('missing K alone (only N and P present) disables the gate entirely, not just K', () => {
        const gate = Engine._resolveTissueGate({ N: 4.57, P: 0.62 });
        expect(gate.eligible).toBe(false);
    });

    test('real cross-engine check: nutrition-calendar.js\'s own tissue_gate_applied agrees with this engine\'s resolveTissueGate() on the exact mixed-unit sample that used to disagree', () => {
        // Loads the actual sibling engine (not a re-implementation of its
        // rule) and runs the identical tissue reading through both, the
        // real regression guard for bug 2 -- confirms the two engines now
        // reject the same implausible sample rather than one accepting a
        // per-nutrient partial match the other rejects wholesale.
        jest.resetModules();
        const prevWindow = global.window, prevDocument = global.document;
        global.window = {};
        global.document = { addEventListener: function () {}, readyState: 'complete',
            querySelector: () => null, querySelectorAll: () => [] };
        try {
            require('../assets/nutrition-calendar.js');
            const NC = global.window.GilbaNutritionCalendar;
            expect(typeof NC.computeProgram).toBe('function');
            const mixedUnitTissue = { N: 4.57, P: 6200, K: 1.05 }; // P in mg/kg
            const program = NC.computeProgram({
                hemisphere: 'south', species: 'perennialRyegrass', isC4: false,
                soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 },
                bulkDensity: 1.4, soilDepth: 10,
                monthlyTemps: Array(12).fill(15),
                annualNOverride: 200,
                tissuePercent: mixedUnitTissue,
                distribution: 'gp-weighted', clippingManagement: 'collected',
                traffic: 'moderate', maxNPerMonth: 50,
            });
            expect(program.tissue_gate_applied).toBe(false);

            const engineGate = Engine._resolveTissueGate(mixedUnitTissue);
            expect(engineGate.eligible).toBe(false);
            // Both engines land on the identical verdict for the identical input.
            expect(engineGate.eligible).toBe(program.tissue_gate_applied);
        } finally {
            global.window = prevWindow;
            global.document = prevDocument;
        }
    });

    test('_calculateNutrientRequirement() called directly (no pre-resolved tissueGate) still resolves it correctly from config.tissuePercent', () => {
        const r = Engine._calculateNutrientRequirement('K', 1, {
            methodology: 'MLSN', species: 'perennialRyegrass', tissuePercent: TISSUE_TEST5,
        });
        expect(r.tissueInformed).toBe(true);
    });
});

describe('GH-369 — word-export.js: shared tissue helpers and honest no-dose advisory', () => {
    let WE;
    beforeAll(() => {
        // Same technique GH-365's real-data-test5-soccer.test.js already
        // established for reaching word-export.js's pure internals in a
        // sandbox: a docx stub (word-export.js requires the `docx` global at
        // load time to destructure Paragraph/TextRun/etc., but none of the
        // functions under test here call into it) plus minimal DOM shims for
        // the module's own load-time side effects (initLogoUpload()).
        global.docx = new Proxy({}, { get: () => function () {} });
        global.window = global.window || {};
        global.document = global.document || {
            readyState: 'complete',
            addEventListener: function () {},
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
        };
        global.document.getElementById = function () { return null; };
        global.localStorage = global.localStorage ||
            { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        jest.resetModules();
        require('../assets/word-export.js');
        WE = global.window.GAIP_WordExport;
    });

    test('the helpers are reachable (guards against this block silently testing nothing)', () => {
        expect(typeof WE._tissuePercentFromData).toBe('function');
        expect(typeof WE._tissueSufficiencyState).toBe('function');
        expect(typeof WE._isTissueContradictionRow).toBe('function');
        expect(typeof WE.generatePriorityActions).toBe('function');
    });

    test('_tissuePercentFromData() parses a collectData()-shaped data.tissue object, same shape both engines expect', () => {
        expect(WE._tissuePercentFromData({ tissue: TISSUE_TEST5 })).toEqual(TISSUE_TEST5);
    });

    test('_tissuePercentFromData() returns null (not a NaN-filled object) when nothing parses -- tells the engine "no tissue sample", not "garbage tissue sample"', () => {
        expect(WE._tissuePercentFromData({ tissue: {} })).toBeNull();
        expect(WE._tissuePercentFromData({})).toBeNull();
    });

    test('_tissueSufficiencyState: Test5-NZ real tissue K (1.05%) is both low and critical against the C3 ryegrass floor', () => {
        const state = WE._tissueSufficiencyState('K', {
            tissue: { K: 1.05, ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass' },
        });
        expect(state.low).toBe(true);
        expect(state.critical).toBe(true); // 1.05 < 2.00 * 0.8 = 1.6
        expect(state.rangeSource).toBe('Perennial Ryegrass');
    });

    test('_tissueSufficiencyState: a K reading between the critical threshold and the floor is low but not critical', () => {
        const state = WE._tissueSufficiencyState('K', { tissue: { K: 1.8, ranges: C3_RANGES } });
        expect(state.low).toBe(true);
        expect(state.critical).toBe(false); // 1.8 > 1.6 (0.8x floor), but still < 2.00 floor
    });

    test('_tissueSufficiencyState: a sufficient K reading is neither low nor critical', () => {
        const state = WE._tissueSufficiencyState('K', { tissue: { K: 3.05, ranges: C3_RANGES } });
        expect(state.low).toBe(false);
        expect(state.critical).toBe(false);
    });

    test('_tissueSufficiencyState: for P, critical === low (no 0.8 discount) -- below sufficiency is itself the critical case for P', () => {
        const state = WE._tissueSufficiencyState('P', { tissue: { P: 0.20, ranges: C3_RANGES } });
        expect(state.low).toBe(true);
        expect(state.critical).toBe(true);
    });

    test('_tissueSufficiencyState: returns null when there is no tissue sample or no range for this nutrient', () => {
        expect(WE._tissueSufficiencyState('K', {})).toBeNull();
        expect(WE._tissueSufficiencyState('K', { tissue: { ranges: {} } })).toBeNull();
    });

    test('bug 7 regression: _tissueSufficiencyState accepts a string tissue value, matching _tissuePercentFromData\'s parseFloat coercion', () => {
        const state = WE._tissueSufficiencyState('K', { tissue: { K: '1.05', ranges: C3_RANGES } });
        expect(state).not.toBeNull();
        expect(state.value).toBe(1.05);
        expect(state.critical).toBe(true);
    });

    describe('_isTissueContradictionRow() -- the shared SSOT gate (bug 1)', () => {
        const criticalData = { tissue: { K: 1.05, ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass' } };

        test('true when tissueInformed, intent is NOT suppress-above-ceiling, and tissue is critical', () => {
            expect(WE._isTissueContradictionRow('K', true, 'lift-to-floor', criticalData)).toBe(true);
            expect(WE._isTissueContradictionRow('K', true, 'removal-only', criticalData)).toBe(true);
        });

        test('regression for bug 1: false when intent is suppress-above-ceiling, even though tissueInformed is true and tissue is critical', () => {
            expect(WE._isTissueContradictionRow('K', true, 'suppress-above-ceiling', criticalData)).toBe(false);
        });

        test('false when not tissueInformed, regardless of intent or tissue status', () => {
            expect(WE._isTissueContradictionRow('K', false, 'lift-to-floor', criticalData)).toBe(false);
        });

        test('false when tissue is not critical (adequate)', () => {
            const adequateData = { tissue: { K: 3.05, ranges: C3_RANGES } };
            expect(WE._isTissueContradictionRow('K', true, 'lift-to-floor', adequateData)).toBe(false);
        });

        test('false on a tissue-free sample (no tissue data at all)', () => {
            expect(WE._isTissueContradictionRow('K', true, 'lift-to-floor', {})).toBe(false);
        });

        test('works identically for P (bug 4 -- P gets the same treatment as K)', () => {
            const pCriticalData = { tissue: { P: 0.20, ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass' } };
            expect(WE._isTissueContradictionRow('P', true, 'lift-to-floor', pCriticalData)).toBe(true);
            expect(WE._isTissueContradictionRow('P', true, 'suppress-above-ceiling', pCriticalData)).toBe(false);
        });
    });

    test('generatePriorityActions() on the real Test5-NZ tissue reading fires the K-critical advisory with no fabricated dose figure', () => {
        const actions = WE.generatePriorityActions({
            turf: { species: 'Perennial Ryegrass' },
            tissue: { K: 1.05, ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass' },
        });
        const immediateText = actions.immediate.join(' | ');
        expect(immediateText).toMatch(/Tissue K critically low \(1\.05%\)/);
        expect(immediateText).toMatch(/apply foliar potassium immediately\./);
        // No dose figure of any kind: none is citable anywhere in this
        // codebase, and the advisory must not editorialise about that gap
        // in a client-facing report either — see word-export.js's own
        // comment where the removed constant used to live.
        expect(immediateText).not.toMatch(/\d+(\.\d+)?\s*(kg|L)\s*K?\s*\/\s*ha/i);
        expect(immediateText).not.toMatch(/verified in this system|label rate/i);
    });

    test('generatePriorityActions() does not fire the K-critical advisory for a sufficient tissue reading', () => {
        const actions = WE.generatePriorityActions({
            turf: { species: 'Perennial Ryegrass' },
            tissue: { K: 3.05, ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass' },
        });
        expect(actions.immediate.join(' | ')).not.toMatch(/Tissue K critically low/);
    });

    test('GH-375 regression: the soil-side severe-K-deficiency advisory prints a plain instruction, no uncited dose and no meta-commentary about the hub\'s own data gaps', () => {
        const actions = WE.generatePriorityActions({
            turf: { species: 'Perennial Ryegrass' },
            soil: { K: 10, thresholds: { K: { min: 100 } } },
        });
        const immediateText = actions.immediate.join(' | ');
        expect(immediateText).toMatch(/Severe K deficiency/);
        expect(immediateText).not.toMatch(/20-40 kg K\/ha|48-96 kg product/);
        // GH-373 removed exactly this class of "surfacing the hub's own data
        // gap" commentary from the tissue-side advisory; GH-375 applies the
        // same standard here -- the soil-side line must no longer editorialise
        // about there being no verified rate, matching the tissue-side
        // negative assertion above.
        expect(immediateText).not.toMatch(/verified in this system|label rate/i);
    });
});

describe('GH-369 — word-export.js buildSections(): real rendering-level proof (bugs 1 and 5)', () => {
    // Smarter docx stub than the plain no-op Proxy other tests in this repo
    // use: captures each stubbed docx class's constructor argument so the
    // resulting element tree can actually be inspected for text content,
    // not just "did it throw". This is the same class of proof the standing
    // "verify against rendered output" project rule asks for, run inside
    // Jest instead of against a live download.
    //
    // A Proxy-based catch-all stub (tried first) reproducibly crashes Jest's
    // own end-of-file global-leak detector (`getProtectedKeys` in
    // jest-util, a bare TypeError unrelated to anything under test —
    // confirmed with a minimal repro outside this file) once buildSections()
    // touches enough distinct docx.* properties through it. A plain object
    // naming every docx export word-export.js actually destructures
    // (grepped from its own `var X = docx.X;` block) avoids the Proxy
    // entirely and does not trigger it.
    function makeCtor(name) {
        return function (arg) { this.__type = name; this.__props = arg; };
    }
    function makeCapturingDocxStub() {
        return {
            Document: makeCtor('Document'), Packer: {}, Paragraph: makeCtor('Paragraph'),
            TextRun: makeCtor('TextRun'), Table: makeCtor('Table'), TableRow: makeCtor('TableRow'),
            TableCell: makeCtor('TableCell'), Header: makeCtor('Header'), Footer: makeCtor('Footer'),
            AlignmentType: { LEFT: 'left', CENTER: 'center', RIGHT: 'right' },
            PageNumber: {}, PageBreak: makeCtor('PageBreak'),
            BorderStyle: { SINGLE: 'single', NONE: 'none' },
            WidthType: { DXA: 'dxa', PERCENTAGE: 'pct', AUTO: 'auto' },
            HeadingLevel: { HEADING_1: 'h1', HEADING_2: 'h2' },
            ShadingType: { CLEAR: 'clear' }, VerticalAlign: {}, ImageRun: makeCtor('ImageRun'),
            TableOfContents: makeCtor('TableOfContents'), PageOrientation: {},
        };
    }

    function extractTexts(node, out) {
        out = out || [];
        if (!node || typeof node !== 'object') return out;
        if (typeof node.text === 'string') out.push(node.text);
        var props = node.__props;
        if (props && typeof props === 'object') {
            if (typeof props.text === 'string') out.push(props.text);
            if (Array.isArray(props.children)) props.children.forEach(function (c) { extractTexts(c, out); });
            if (Array.isArray(props.rows)) props.rows.forEach(function (c) { extractTexts(c, out); });
        }
        if (Array.isArray(node)) node.forEach(function (c) { extractTexts(c, out); });
        return out;
    }

    // jest.resetModules() + re-require inside every test (rather than once)
    // was found to confuse Jest's own end-of-file global-leak detector
    // (unrelated to anything under test — a bare TypeError inside
    // jest-util's teardown, reproducible even with a trivial stub) — load
    // the module once here instead. buildSections() itself is pure with
    // respect to the data argument (no cross-call state retained that these
    // tests depend on), so a single load serves every test in this block.
    var WE;
    beforeAll(() => {
        global.docx = makeCapturingDocxStub();
        global.window = global.window || {};
        delete global.window.GAIP_WordExport;
        global.document = {
            readyState: 'complete',
            addEventListener: function () {},
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            getElementById: function () { return null; },
        };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        jest.resetModules();
        require('../assets/word-export.js');
        WE = global.window.GAIP_WordExport;
    });

    function renderAndExtract(nutritionSummaryOverrides, tissueOverride) {
        var data = {
            site: { name: 'Test Site', location: 'Auckland, NZ', date: '2026-09-08' },
            turf: { species: 'Perennial Ryegrass' },
            soil: { methodology: 'AMMONIUM_ACETATE', hasData: false, thresholds: {} },
            nutritionSummary: Object.assign({
                hasData: true, monthlyN: [], totalN: 0, activeMonths: 0, climateDataUnavailable: false,
            }, nutritionSummaryOverrides),
        };
        if (tissueOverride !== null) {
            data.tissue = Object.assign({
                ranges: C3_RANGES, rangeSpecies: 'Perennial Ryegrass', hasData: true,
            }, tissueOverride);
        }

        var sections = WE.buildSections(data, {});
        var texts = [];
        sections.forEach(function (s) { extractTexts(s, texts); });
        return texts.join(' ┃ ');
    }

    test('bug 5 regression: K req of exactly 0 still renders the Potassium row (annualK != null, not truthy)', () => {
        const joined = renderAndExtract({
            annualP: 5, pStatus: 'Adequate',
            annualK: 0, kStatus: 'High', kTissueInformed: true, kIntent: 'suppress-above-ceiling',
            annualS: 10, sStatus: 'Adequate',
        }, { K: 1.05, P: 0.62 });
        expect(joined).toMatch(/Potassium \(K\)/);
        expect(joined).toMatch(/0\.0 kg\/ha\/yr/);
    });

    test('bug 1 regression: the audit\'s exact case (K req 0.0, suppress-above-ceiling, tissueInformed) does NOT print the "tissue-derived" explanation next to the K row, but the Priority Actions critical flag still fires', () => {
        const joined = renderAndExtract({
            annualP: 5, pStatus: 'Adequate',
            annualK: 0, kStatus: 'High', kTissueInformed: true, kIntent: 'suppress-above-ceiling',
            annualS: 10, sStatus: 'Adequate',
        }, { K: 1.05, P: 0.62 });
        expect(joined).not.toMatch(/this figure is a replacement-dose estimate/);
        expect(joined).toMatch(/Tissue K critically low/);
        expect(joined).toMatch(/apply foliar potassium immediately\./i);
    });

    test('the explanation DOES print when the same critical tissue reading sits next to a genuinely tissue-derived, non-ceiling K figure', () => {
        const joined = renderAndExtract({
            annualP: 5, pStatus: 'Adequate',
            annualK: 46, kStatus: 'Low', kTissueInformed: true, kIntent: 'lift-to-floor',
            annualS: 10, sStatus: 'Adequate',
        }, { K: 1.05, P: 0.62 });
        expect(joined).toMatch(/46\.0 kg\/ha\/yr/);
        expect(joined).toMatch(/this figure is a replacement-dose estimate/);
    });

    test('P gets the identical treatment (bug 4): a tissue-derived, non-ceiling P figure next to a below-sufficiency P reading prints the explanation', () => {
        const joined = renderAndExtract({
            annualP: 27, pStatus: 'Low', pTissueInformed: true, pIntent: 'lift-to-floor',
            annualK: 100, kStatus: 'Adequate',
            annualS: 10, sStatus: 'Adequate',
        }, { P: 0.20, K: 3.05 });
        expect(joined).toMatch(/Phosphorus \(P\)/);
        expect(joined).toMatch(/27\.0 kg\/ha\/yr/);
        expect(joined).toMatch(/this figure is a replacement-dose estimate/);
        expect(joined).toMatch(/apply phosphorus fertiliser or foliar MAP\/MKP promptly\./i);
    });

    test('tissue-free export (bug 8\'s single-export analogue): no tissue data at all renders the plain K row with no note, and does not crash', () => {
        const joined = renderAndExtract({
            annualP: 18, pStatus: 'Adequate',
            annualK: 100, kStatus: 'Adequate',
            annualS: 10, sStatus: 'Adequate',
        }, null);
        expect(joined).toMatch(/Potassium \(K\)/);
        expect(joined).toMatch(/100\.0 kg\/ha\/yr/);
        expect(joined).not.toMatch(/this figure is a replacement-dose estimate/);
        expect(joined).not.toMatch(/Tissue K critically low/);
    });
});

describe('GH-369 — word-export-combined.js: structural pins for the shared-SSOT routing', () => {
    let src;
    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
    });

    // Structural pins, matching this repo's established convention for
    // word-export-combined.js (GH-290/291/292/306/350 precedent) -- the
    // module has too many docx/DOM/global dependencies to functionally
    // exercise its render loop in a unit-test sandbox. The decision logic
    // itself (bugs 1, 2, 4) is covered functionally above via the shared
    // word-export.js helpers this file now routes through -- these pins
    // exist to catch the routing itself silently reverting to an inline
    // duplicate.
    test('the ANR compute() call threads tissuePercent via the shared GAIP_WordExport helper', () => {
        expect(src).toMatch(/tissuePercent:\s*\(window\.GAIP_WordExport &&\s*\n\s*window\.GAIP_WordExport\._tissuePercentFromData\)\s*\n\s*\?\s*window\.GAIP_WordExport\._tissuePercentFromData\(r\.data\)/);
    });

    test('_shapeAnr() carries tissueInformed through onto r._anr.<nutrient>', () => {
        expect(src).toMatch(/tissueInformed:\s*!!perSampleNut\.tissueInformed/);
    });

    test('the K Reconciliation table gained a Tissue K status column', () => {
        expect(src).toMatch(/_mkHdr\('Tissue K status',\s*2200\)/);
    });

    test('bug 1 fix: the K Reconciliation row and the ANR table\'s ‡ marker both route through the shared _isTissueContradictionRow SSOT, not their own inline critical/intent checks', () => {
        expect(src).toMatch(/_wxTissue\._isTissueContradictionRow\('K', anrK\.tissueInformed, anrK\.intent, r\.data\)/);
        expect(src).toMatch(/_wxTissueForAnr\._isTissueContradictionRow\(nut, anrResult\.tissueInformed, anrResult\.intent, r\.data\)/);
    });

    test('bug 3 fix: the always-rendered Annual Nutrient Requirements table marks tissue-contradiction rows independently of the K-Reconciliation table\'s _facilityKDelivered gate', () => {
        const anrMarkerIdx = src.indexOf("reqVal = reqVal + ' ‡'");
        const facilityGateIdx = src.indexOf('if (_facilityKDelivered != null) {');
        expect(anrMarkerIdx).toBeGreaterThan(-1);
        expect(facilityGateIdx).toBeGreaterThan(-1);
        expect(anrMarkerIdx).toBeLessThan(facilityGateIdx);
    });

    test('bug 4 fix: the ANR-table marker check covers both P and K, not K only', () => {
        expect(src).toMatch(/\(nut === 'P' \|\| nut === 'K'\) && _isTissueMarked\(nut, r\)/);
    });

    test('bug 6 fix: the calendar tissue overlay routes through the shared helper and no longer unconditionally overwrites with an all-null object', () => {
        expect(src).toMatch(/_resolvedSampleTissue = \(window\.GAIP_WordExport && window\.GAIP_WordExport\._tissuePercentFromData\)/);
        expect(src).toMatch(/if \(_resolvedSampleTissue\) \{\s*\n\s*perSampleInputs\.tissuePercent = _resolvedSampleTissue;/);
    });

    test('bug 8 fix: the K Reconciliation table\'s explanatory caption is gated on at least one row actually having tissue data', () => {
        expect(src).toMatch(/if \(_anyTissueDataInReconTable\) \{/);
    });

    test('the new column\'s advisory carries no dose figure and no commentary about the system\'s own data gaps', () => {
        // Both render sites in this file must print the plain instruction.
        const advisories = src.match(/Apply foliar potassium[^']*/g) || [];
        expect(advisories.length).toBeGreaterThan(0);
        advisories.forEach((line) => {
            expect(line).toMatch(/Apply foliar potassium immediately\./);
            expect(line).not.toMatch(/verified in this system|label rate/i);
            expect(line).not.toMatch(/\d+(\.\d+)?\s*(kg|L)\s*K?\s*\/\s*ha/i);
        });
    });
});
