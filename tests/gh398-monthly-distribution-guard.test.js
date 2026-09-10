/**
 * GH-398 — source-text guard: per-month distribution arithmetic must not
 * reappear outside assets/nutrition-monthly-distribution.js.
 *
 * Modelled on tests/gh383-input-contract-guard.test.js, which has already
 * caught two reverts of the input contract. The failure mode is the same one:
 * a second, private implementation of something that already has a shared one.
 * It agrees with the shared copy on whatever fixture is under test and diverges
 * on the site that is not — which is exactly how the Word export came to print
 * an uncapped monthly series for four sites whose Plan programme was clamped,
 * for as long as it did, with a green parity harness the whole time (that
 * fixture's peak is ~35 kg against a cap of 50, so the cap never bound).
 *
 * Deliberately structural: it asserts that the loop, the threshold and the cap
 * are ABSENT from the calendar and the two export files, and PRESENT once in
 * the shared module. No behavioural test can do that.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function read(file) {
    return fs.readFileSync(path.join(__dirname, '../assets/' + file), 'utf8');
}

/**
 * Comments stripped. The retired arithmetic is described in the comments that
 * replaced it — which is the documentation a reader needs, and exactly what a
 * naive text search would trip over. This file asserts about CODE.
 */
function code(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const SHARED = 'nutrition-monthly-distribution.js';

describe('GH-398 — the weighting, the threshold and the cap exist exactly once', () => {
    const shared = code(read(SHARED));

    test('the shared module holds the one activity threshold and the one weighting loop', () => {
        expect(shared).toMatch(/const MIN_GP_THRESHOLD = 0\.10;/);
        // The weighting itself: total the active months' GP, then take each
        // month's share of it.
        expect(shared).toMatch(/totalGP \+= gp\[m\]/);
        expect(shared).toMatch(/annualAmount \* \(gp\[m\] \/ totalGP\)/);
        // And the cap with its overflow redistribution.
        expect(shared).toMatch(/function applyNCap\(allocations, maxN\)/);
        expect(shared).toMatch(/unschedulable/);
    });

    test('it is pure — no site config, no DOM, no state', () => {
        // The GP engine is a computation dependency, not a source of inputs,
        // and is the one global this module resolves. Anything else would make
        // it a second input path beside nutrition-program-inputs.js.
        expect(shared).not.toMatch(/document\./);
        expect(shared).not.toMatch(/GAIP_STATE/);
        expect(shared).not.toMatch(/GAIP_SITE_CONFIG|GAIP_SiteConfig/);
        expect(shared).not.toMatch(/localStorage/);
        expect(shared).toMatch(/GilbaGrowthPotentialEngine/);
    });
});

describe('GH-398 — nutrition-calendar.js no longer distributes anything itself', () => {
    const calendar = code(read('nutrition-calendar.js'));

    test('the threshold is gone from CONFIG — it was the third copy of one number', () => {
        expect(calendar).not.toMatch(/minGpThreshold/);
    });

    test('the GP-weighted loop is gone', () => {
        expect(calendar).not.toMatch(/totalGP/);
        expect(calendar).not.toMatch(/annualAmount \* \(monthlyGP\[m\] \/ totalGP\)/);
        // The two mode branches went with it.
        expect(calendar).not.toMatch(/method === 'even'/);
        expect(calendar).not.toMatch(/method === 'front_loaded'/);
    });

    test('the N cap and its overflow redistribution are gone', () => {
        expect(calendar).not.toMatch(/overflow \+= alloc - cap/);
        expect(calendar).not.toMatch(/totalHeadroom/);
        expect(calendar).not.toMatch(/let unschedulable/);
    });

    test('the two season tables are gone — they were the engine\'s, written in 0-11', () => {
        expect(calendar).not.toMatch(/seasonsSouth:/);
        expect(calendar).not.toMatch(/seasonsNorth:/);
    });

    test('what it does instead is one call into the shared module', () => {
        expect(calendar).toMatch(/require\('\.\/nutrition-monthly-distribution\.js'\)/);
        expect(calendar).toMatch(/GAIP_NutritionMonthlyDistribution/);
        expect(calendar).toMatch(/_dist\.distributeProgram\(\{/);
        expect(calendar).toMatch(/_monthlyDistribution\(\)\.distribute\(annualAmount, monthlyGP, method\)/);
        expect(calendar).toMatch(/_monthlyDistribution\(\)\.applyNCap\(nAllocations, maxN\)/);
        expect(calendar).toMatch(/_dist\.seasons\(inputs\.hemisphere\)/);
    });

    test('the per-nutrient loop that called distributeByGP once per nutrient is gone', () => {
        // Replaced by ONE distributeProgram() call taking the whole map, so
        // there is a single place that decides how a nutrient is spread and a
        // single place the cap is applied (decision 4).
        expect(calendar).not.toMatch(/Object\.keys\(annualRequirements\)\.forEach/);
        expect(calendar).not.toMatch(/this\.applyNCap\(distributions\.N/);
    });
});

describe('GH-398 — nutrition-requirement-engine.js keeps its API and none of the arithmetic', () => {
    const engine = code(read('nutrition-requirement-engine.js'));

    test('the second threshold, the second weighting and the second season table are gone', () => {
        expect(engine).not.toMatch(/const MIN_GP_THRESHOLD/);
        expect(engine).not.toMatch(/totalGP/);
        expect(engine).not.toMatch(/const SUMMER_INTENT_PROFILES = \{/);
        expect(engine).not.toMatch(/seasonsNorth = \{/);
        expect(engine).not.toMatch(/seasonsSouth = \{/);
        // The pre-allocation GP rounding that caused the drift (decision 2).
        expect(engine).not.toMatch(/Math\.round\(gp \* 100\) \/ 100/);
    });

    test('it delegates, and re-exports rather than redeclaring', () => {
        expect(engine).toMatch(/require\('\.\/nutrition-monthly-distribution\.js'\)/);
        expect(engine).toMatch(/get SUMMER_INTENT_PROFILES\(\) \{ return _distribution\(\)\.SUMMER_INTENT_PROFILES; \}/);
        expect(engine).toMatch(/get MIN_GP_THRESHOLD\(\) \{ return _distribution\(\)\.MIN_GP_THRESHOLD; \}/);
        expect(engine).toMatch(/_dist\.distributeProgram\(\{/);
        const Engine = require('../assets/nutrition-requirement-engine.js');
        const Shared = require('../assets/nutrition-monthly-distribution.js');
        expect(Engine.SUMMER_INTENT_PROFILES).toBe(Shared.SUMMER_INTENT_PROFILES);
        expect(Engine.MIN_GP_THRESHOLD).toBe(Shared.MIN_GP_THRESHOLD);
    });

    test('it APPLIES the cap — the whole point of the ticket', () => {
        // A revert that dropped `distribution` from the compute contract would
        // silently restore the uncapped table.
        expect(engine).toMatch(/inputs\.distribution \|\| \{\}/);
        // Anchored INSIDE the distributeProgram() call, not just anywhere in
        // the file: `facility.maxNPerMonth: maxNPerMonth` is a separate line
        // that would keep a loose match green while the cap was passed as null.
        expect(engine).toMatch(
            /distributeProgram\(\{[\s\S]{0,400}?mode: distributionMode,\s*\n\s*maxNPerMonth: maxNPerMonth\s*\n\s*\}\)/);
        expect(engine).toMatch(/nCap: distributed \? distributed\.nCap : null,/);
    });

    test('the 1-12 / 0-11 reindex goes through the shared converters, never inline', () => {
        // GH-363 was an inline reindex of this exact pair.
        expect(engine).toMatch(/D\.fromMonthMap|_dist\.fromMonthMap|_distribution\(\)\.fromMonthMap/);
        expect(engine).toMatch(/toMonthMap/);
        expect(engine).not.toMatch(/for \(let month = 1; month <= 12; month\+\+\) \{\s*if \(monthlyGP/);
    });
});

describe('GH-398 — the export files render the series, they do not compute it', () => {
    const wordExport = code(read('word-export.js'));
    const combined = code(read('word-export-combined.js'));

    test('neither export file distributes anything per month itself', () => {
        [['word-export.js', wordExport], ['word-export-combined.js', combined]].forEach(function (pair) {
            const src = pair[1];
            expect(src).not.toMatch(/MIN_GP_THRESHOLD/);
            expect(src).not.toMatch(/minGpThreshold/);
            expect(src).not.toMatch(/totalGP/);
            expect(src).not.toMatch(/applyNCap/);
            // The N cap's own signature: clamping a month and carrying the
            // remainder somewhere else. `_cap.redistributed` is READ in
            // word-export.js to print the shared module's own figure, which is
            // the opposite of computing it — the accumulation is what must not
            // come back.
            // (`overflow:hidden` is CSS on a progress bar — anchor on the
            // accumulator, not the word.)
            expect(src).not.toMatch(/overflow \+=/);
            expect(src).not.toMatch(/redistributed \+=/);
            expect(src).not.toMatch(/unschedulable =/);
        });
    });

    test('word-export.js passes the site\'s mode and cap into the engine instead', () => {
        expect(wordExport).toMatch(/distribution: \{\s*\n\s*mode: _programInputs \? _programInputs\.distributionMode : null,/);
        expect(wordExport).toMatch(/maxNPerMonth: _programInputs \? _programInputs\.maxNPerMonth : null/);
        expect(wordExport).toMatch(/distribution: _inputs\.distribution/);
        // and carries the cap result through to the renderer
        expect(wordExport).toMatch(/data\.nutritionSummary\.nCap = _engineResult\.facility\.nCap;/);
        expect(wordExport).toMatch(/data\.nutritionSummary\.distributionMode = _engineResult\.facility\.distributionMode;/);
    });

    test('the Monthly N Distribution table states the cap in the Plan page\'s own words', () => {
        // Mirrored, not invented: the Plan page renders these same two
        // banners, and a cap that leaves nitrogen unschedulable makes the
        // months sum to less than the annual target — which has to be said.
        expect(wordExport).toMatch(/Monthly N cap too low: target /);
        expect(wordExport).toMatch(/cannot be scheduled within the /);
        expect(wordExport).toMatch(/Monthly N cap applied \(/);
        expect(wordExport).toMatch(/redistributed to shoulder months/);
        // and the heading names the mode that actually ran
        expect(wordExport).toMatch(/'Monthly N Distribution \(' \+ _modeLabel \+ '\)'/);
    });

    test('word-export-combined.js resolves the cap and the mode per site, from the adapter', () => {
        expect(combined).toMatch(/perSampleInputs\.maxNPerMonth = _siteInputs\.maxNPerMonth;/);
        expect(combined).toMatch(/perSampleInputs\.distribution = _siteInputs\.distributionMode;/);
        // The two private reads it used to make are gone — a per-site read is
        // still a second resolution when the same concept has a resolver.
        expect(combined).not.toMatch(/_siteCfg\.maxNPerMonth/);
        expect(combined).not.toMatch(/_persistedCal\.meta\.distribution/);
        expect(combined).toMatch(/distribution: _ei\.distribution/);
        expect(combined).toMatch(/distributionMode: siteNutritionSummary\.distributionMode,/);
        expect(combined).toMatch(/nCap: siteNutritionSummary\.nCap/);
    });
});

describe('GH-398 — the shared module is enqueued everywhere both engines are', () => {
    const views = path.join(__dirname, '../app/resources/views');

    // Every blade that loads nutrition-calendar.js or
    // nutrition-requirement-engine.js must load this one too, and BEFORE them:
    // both resolve it lazily and throw with a message naming the cause, but a
    // page that reached that message would have no nutrition programme at all.
    const BLADES = [
        'plan.blade.php',
        'hub.blade.php',
        'reports/export.blade.php',
        'reports/scenarios.blade.php',
        'reports/forensic.blade.php'
    ];

    BLADES.forEach(function (blade) {
        test(blade + ' enqueues nutrition-monthly-distribution.js before the engines', () => {
            const src = fs.readFileSync(path.join(views, blade), 'utf8');
            const shared = src.indexOf(SHARED);
            expect(shared).toBeGreaterThan(-1);
            ['nutrition-calendar.js', 'nutrition-requirement-engine.js'].forEach(function (dep) {
                // Only the LOAD reference matters; prose mentions of the file
                // name appear in comments on some of these pages, so anchor on
                // the quoted asset name as the enqueue lists write it.
                const m = src.match(new RegExp("['\"]" + dep.replace('.', '\\.') + "['\"]"));
                if (!m) return;
                expect(src.indexOf(m[0])).toBeGreaterThan(shared);
            });
        });
    });
});
