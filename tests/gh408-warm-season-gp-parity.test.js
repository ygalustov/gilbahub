/**
 * GH-408 — the export scores a warm-season site on the warm-season curve.
 *
 * `nutrition-requirement-engine.js`'s compute() hardcoded
 * `{ isOverseed: false, baseIsC4: false, summerIntent: 'transition' }` as the
 * default overseed config, and nothing anywhere supplies `inputs.overseedConfig`
 * — so every site this engine served was scored on the C3 growth-potential
 * curve whatever grass was configured. The Plan page never had the bug:
 * nutrition-calendar.js passes `isC4` into the same shared monthlyC3Fractions().
 *
 * Reported live on a Christchurch golf site set to Couch — Plan GP 16% for
 * January, document 90%, and the document went on to schedule the full
 * 250 kg N/ha across nine "active" months a warm-season sward does not have at
 * that latitude. Two of eleven development sites are warm-season (Couch,
 * Buffalograss), and couch is ordinary on Australian golf and sports turf.
 *
 * This is an input-side divergence, not an arithmetic one: both surfaces call
 * the same shared monthlyGP(), and were handed different C3 fractions. The same
 * shape as the three input-side divergences D31 closed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const assetPath = (f) => path.join(__dirname, '../assets', f);
const readAsset = (f) => fs.readFileSync(assetPath(f), 'utf8');

function loadEngine() {
    // These modules publish onto `window`, so window and the sandbox global
    // must be the same object or the exports land somewhere nothing reads.
    const sandbox = { console: { warn() {}, log() {}, error() {} } };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ['growth-potential-engine.js', 'nutrition-requirement-core.js',
        'nutrition-monthly-distribution.js', 'nutrition-program-inputs.js',
        'nutrition-requirement-engine.js']) {
        vm.runInContext(readAsset(f), sandbox, { filename: f });
    }
    return sandbox;
}

// Christchurch monthly means, the site the defect was reported on.
const CHRISTCHURCH = { 1: 17.4, 2: 17.0, 3: 15.3, 4: 12.4, 5: 9.4, 6: 6.7,
                       7: 6.1, 8: 7.5, 9: 9.9, 10: 11.9, 11: 14.0, 12: 16.2 };

describe('GH-408 — base species reaches the growth-potential curve', () => {
    const sandbox = loadEngine();
    const D = sandbox.GAIP_NutritionMonthlyDistribution;
    const core = sandbox.NutritionRequirementCore;

    test('the modules load and the classifier knows the warm-season names', () => {
        expect(D).toBeTruthy();
        expect(core).toBeTruthy();
        for (const s of ['Couch', 'Buffalograss', 'Kikuyu', 'Zoysia', 'Bermuda']) {
            expect(core._isC4Species(s)).toBe(true);
        }
        for (const s of ['Creeping Bentgrass (Greens)', 'Perennial Ryegrass', 'Browntop Bent (Greens)']) {
            expect(core._isC4Species(s)).toBe(false);
        }
    });

    test('the two curves really differ, or this ticket would be about nothing', () => {
        const temps = D.fromMonthMap(CHRISTCHURCH);
        const c3 = D.monthlyGP(temps, D.monthlyC3Fractions({ isOverseed: false, baseIsC4: false }, 'south'));
        const c4 = D.monthlyGP(temps, D.monthlyC3Fractions({ isOverseed: false, baseIsC4: true }, 'south'));
        const jan = { c3: Math.round(c3[0] * 100), c4: Math.round(c4[0] * 100) };
        process.stdout.write('[gh408] Christchurch January GP — C3 ' + jan.c3 + '%, C4 ' + jan.c4 + '%\n');
        expect(jan.c3).toBeGreaterThan(jan.c4 + 40);
    });

    test('the default overseed config is no longer a hardcoded false', () => {
        const src = readAsset('nutrition-requirement-engine.js');
        expect(src).not.toMatch(/\{ isOverseed: false, baseIsC4: false, summerIntent: 'transition' \}/);
        expect(src).toMatch(/baseIsC4: isC4Species\(turf\.species\)/);
    });

    test('an explicitly supplied overseedConfig still wins', () => {
        const src = readAsset('nutrition-requirement-engine.js');
        expect(src).toMatch(/const overseedConfig = inputs\.overseedConfig \|\| \{/);
    });

    test('the Plan page keeps deriving it the way it always did', () => {
        const cal = readAsset('nutrition-calendar.js');
        expect(cal).toMatch(/\{ isOverseed: false, baseIsC4: !!isC4 \}/);
        expect(cal).toMatch(/inputs\.monthlyTemps, inputs\.isC4, inputs\.overseedConfig, inputs\.hemisphere/);
    });

    test('the engine itself now returns the warm-season curve for a Couch site', () => {
        // Not a source pin: run compute() the way the export path does, with no
        // overseedConfig supplied — which is what every real caller does — and
        // read the monthly GP it publishes.
        const engine = sandbox.NutritionRequirementEngine_Pure;
        expect(engine).toBeTruthy();

        const run = (species) => engine.compute({
            soil: {},
            turf: { species, turfType: 'golf', methodology: 'ammonium_acetate' },
            climate: { monthlyTemps: CHRISTCHURCH, hemisphere: 'south' }
        });

        const couch = run('Couch');
        const bent = run('Creeping Bentgrass (Greens)');
        const jan = (r) => Math.round(r.facility.monthlyGP[1] * 100);

        process.stdout.write('[gh408] compute() January GP — Couch ' + jan(couch)
            + '%, Bentgrass ' + jan(bent) + '%\n');

        // The reported symptom was a Couch site scoring like bentgrass.
        expect(jan(couch)).toBeLessThan(30);
        expect(jan(bent)).toBeGreaterThan(80);
        expect(jan(bent) - jan(couch)).toBeGreaterThan(40);

        // Buffalograss is the other warm-season site in the database today.
        expect(jan(run('Buffalograss'))).toBe(jan(couch));
    });

    test('the two export paths no longer hardcode a cool-season base either', () => {
        // The engine default is a backstop; both exports pass an overseedConfig
        // of their own, and each carried the same `baseIsC4: false`. Fixing only
        // the engine left the Monthly N Distribution table still wrong, which is
        // how this was caught — one table right, the next one not.
        const wx = readAsset('word-export.js');
        const wxc = readAsset('word-export-combined.js');

        expect(wx).toMatch(/baseIsC4: _defBaseIsC4/);
        expect(wx).toMatch(/_SC0\.isC4Species\(_species\)/);
        expect(wx).not.toMatch(/overseedSpecies: null,\s*\n\s*summerIntent: 'transition',\s*\n\s*baseIsC4: false/);

        expect(wxc).toMatch(/baseIsC4: _gh408IsC4\(_turfCfg \? _turfCfg\.species : null\)/);
        expect(wxc).not.toMatch(/_overseedCfg \|\| \{ isOverseed: false, baseIsC4: false/);
    });

    test('the per-sample override branch, which was always right, is untouched', () => {
        const wx = readAsset('word-export.js');
        expect(wx).toMatch(/_SC2\.isC4Species\(_baseSp\)/);
    });

    test('the reasoning survives in place', () => {
        const src = readAsset('nutrition-requirement-engine.js');
        expect(src).toMatch(/GH-408/);
        expect(src).toMatch(/instead of assuming cool-season/);
    });
});
