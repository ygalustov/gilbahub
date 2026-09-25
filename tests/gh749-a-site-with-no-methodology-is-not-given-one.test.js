/**
 * GH-749 (queue item 3ay) — A SITE WITH NO METHODOLOGY IS NOT GIVEN ONE.
 *
 * The methodology has exactly one owner, `config.turf.methodology`, and nothing is ever filled with
 * `mlsn` for a site that has none. Two places did exactly that, both spelled `|| 'mlsn'`:
 *   - `nutrition-program-inputs.js` `resolveSufficiencyRanges()`, where the sufficiency ranges are
 *     decided — so a site that never finished its wizard was answered with MLSN thresholds;
 *   - `nutrition-calendar.js` `computeProgram()`, which is what hands the methodology to that
 *     resolver on the Plan page, so repairing only the first would have left the second deciding.
 *
 * MEASURED BEFORE THE WORK, and it is why the first one was worth the second: GH-521 took this same
 * substitution out of `resolveSiteProgramInputs()` one function below, and the comment there names
 * it. That function resolves an absent methodology honestly, as `null` — and the next call turned
 * the null back into `mlsn`.
 *
 * THE OUTCOME IS A REFUSAL, not a substitute and not a reason — the analyst's decision for item 3ay:
 * writing a reason for this case would admit it as an allowed one, while a required setting with one
 * owner has no allowed absence. The resolver throws, in the form it already uses for a core that is
 * not loaded; the calendar returns the error shape it already returns when a module it needs is
 * missing, so no caller meets anything new.
 *
 * WHAT NO ASSERTION HERE MEASURES, said so this file is not read wider than it is: what a person
 * sees on `/plan` in that state. `{ error: … }` reaches a `console.warn` and leaves the panel empty,
 * and measuring the page needs a real page with a site selected — item 3ay does not close on it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const NUTRIENTS = ['P', 'K', 'Ca', 'Mg', 'S'];
const Inputs = require(path.join(ROOT, 'assets/nutrition-program-inputs.js'));
const Core = require(path.join(ROOT, 'assets/nutrition-requirement-core.js'));
const Distribution = require(path.join(ROOT, 'assets/nutrition-monthly-distribution.js'));

/** The calendar, loaded as a page loads it, with the core it asks for. */
function calendarIn() {
    const sb = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        Math, JSON, Date, Array, Object, String, Number, isNaN, parseFloat, parseInt, isFinite,
        RegExp, Promise, Error, setTimeout: () => 0, clearTimeout: () => 0,
        NutritionRequirementCore: Core,
        GAIP_NutritionProgramInputs: Inputs,
        GAIP_NutritionMonthlyDistribution: Distribution,
        document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
            getElementById: () => null, readyState: 'complete', body: {} },
        addEventListener() {},
    };
    sb.window = sb; sb.global = sb; sb.globalThis = sb; sb.self = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/nutrition-calendar.js'), 'utf8'), sb,
        { filename: 'nutrition-calendar.js' });

    return sb;
}

describe('GH-749 — the resolver answers an absent methodology with no ranges', () => {
    test('POSITIVE CONTROL: the three declared methodologies still resolve, so an empty resolver cannot pass', () => {
        const mlsn = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn', pH: 8.3 });
        const slan = Inputs.resolveSufficiencyRanges({ methodology: 'slan', pH: 6.5 });
        process.stdout.write('[gh749] mlsn P: ' + JSON.stringify(mlsn.ranges.P)
            + '\n[gh749] slan P: ' + JSON.stringify(slan.ranges.P) + '\n');
        expect(mlsn.ranges.P.min).toBe(40);
        expect(slan.ranges.P.min).toBe(27);
        expect(mlsn.sources.P).toBe('certificate');
    });

    test('with no methodology it REFUSES, and the refusal names the site rather than a nutrient', () => {
        /**
         * The analyst's decision for item 3ay, and the reason is in her words: a reason written for
         * this case would admit it as an allowed one. So there is no `methodology-absent` source and
         * no phrase — the resolver refuses, in the form this file already refuses a config it cannot
         * resolve for the site it was asked about.
         */
        [undefined, null, '', '   '].forEach((value) => {
            const call = () => Inputs.resolveSufficiencyRanges(value === undefined ? {} : { methodology: value });
            let message = null;
            try { call(); } catch (e) { message = e.message; }
            process.stdout.write('[gh749] methodology ' + JSON.stringify(value) + ' -> ' + message + '\n');
            expect(message).toMatch(/no methodology/i);
            expect(message).toMatch(/refusing/i);
        });
    });

    test('the refusal is the RANGES\' and not every field\'s: the site resolver still answers', () => {
        /**
         * Measured while making the refusal, and it is why this case exists: calling the range
         * resolver unconditionally made `resolveSiteProgramInputs` throw for a site with no
         * methodology, and three cases of `gh383` — about CLIPPING and about the GH-521 rule, neither
         * about a range — went red. A refusal that takes unrelated fields with it is a second defect,
         * not a stricter version of the first.
         */
        const r = Inputs.resolveSiteProgramInputs({
            siteId: 'gh749-site',
            siteConfig: { turf: { turfType: 'golf', grassSpecies: 'creepingBentgrass' } },
            planForm: null,
        });
        process.stdout.write('[gh749] the site resolver, with no methodology: methodology '
            + JSON.stringify(r.methodology) + ' | sources.methodology ' + r.sources.methodology
            + ' | ranges ' + JSON.stringify(r.ranges) + ' | turfType ' + r.turfType
            + ' | annualN ' + r.annualN + '\n');

        expect(r.methodology).toBeNull();
        expect(r.sources.methodology).toBe('empty');
        // The ranges are not resolved, and the field that says why is the one already there.
        expect(r.ranges).toBeNull();
        expect(r.rangeSources).toBeNull();
        // And the fields that have nothing to do with a methodology are still answered.
        expect(r.turfType).toBe('golf');
        expect(typeof r.annualN).toBe('number');
        expect(r.clippingManagement).toBe('collected');
    });

    test('BOUNDARY, measured and not endorsed: a value the project never declared still takes MLSN', () => {
        /**
         * The two shapes are not the same defect and this one is NOT this item's subject, so it is
         * printed rather than asserted as correct: the final branch of the resolver is "MLSN
         * (default)" and anything that is not `slan` or `ammonium_acetate` lands in it. The
         * coordinator decides whether it joins this item. Naming it here means the next reader of
         * this file does not have to rediscover it.
         */
        const r = Inputs.resolveSufficiencyRanges({ methodology: 'something_nobody_declared' });
        process.stdout.write('[gh749] an undeclared value -> P ' + JSON.stringify(r.ranges.P)
            + ' | source ' + r.sources.P + '\n');
        expect(r.ranges.P).not.toBeNull();
    });
});

describe('GH-749 — the calendar does not supply a methodology either', () => {
    const inputs = () => ({
        species: 'creepingBentgrass', soilPpm: { P: 20, K: 60 }, annualNOverride: 200,
        soilTexture: 'sand', pH: 6.5, CEC: 8, bulkDensity: 1.4, soilDepth: 100,
        monthlyTemps: Array.from({ length: 12 }, () => 15),
    });

    test('with no methodology it refuses instead of building a programme on MLSN', () => {
        const sb = calendarIn();
        const NC = sb.GilbaNutritionCalendar;
        expect(typeof NC.computeProgram).toBe('function');

        const out = NC.computeProgram(inputs());
        process.stdout.write('[gh749] computeProgram with no methodology -> ' + JSON.stringify(out) + '\n');

        expect(out.error).toMatch(/no soil methodology/i);
        expect(out.program).toBeUndefined();
        expect(out.annual_totals).toBeUndefined();
        // And nothing was computed against MLSN on the way to that answer.
        expect(JSON.stringify(out)).not.toMatch(/mlsn/i);
    });

    test('a methodology that IS set still builds a programme, so the refusal is not the only answer', () => {
        const sb = calendarIn();
        const NC = sb.GilbaNutritionCalendar;
        const out = NC.computeProgram(Object.assign(inputs(), { methodology: 'mlsn' }));
        process.stdout.write('[gh749] with mlsn set -> error: ' + JSON.stringify(out.error)
            + ' | meta.methodology: ' + JSON.stringify(out.meta && out.meta.methodology) + '\n');
        expect(out.error).toBeUndefined();
        expect(out.meta.methodology).toBe('MLSN');
    });

    test('the panel is left empty and no phrase is invented for it — the boundary, asserted', () => {
        /**
         * The banner this delivery first wrote was removed: the words were the developer's and the
         * decision is that this case gets none. What is asserted instead is that the refusal reaches
         * the caller's existing error path and that no sentence about methodology was planted in the
         * render — so the day the third link is built, there is nothing of mine to unpick.
         */
        const src = fs.readFileSync(path.join(ROOT, 'assets/nutrition-calendar.js'), 'utf8');
        const rendered = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        process.stdout.write('[gh749] the drafted sentence is still in the file: '
            + rendered.includes('No soil methodology is set for this site') + '\n');
        expect(rendered).not.toContain('No soil methodology is set for this site');
        expect(rendered).toContain("error: 'this site has no soil methodology");
    });
});
