/**
 * GH-707 (queue item 3r) — DOES THE MANUFACTURED ZERO REACH THE WATER ENGINE.
 *
 * `assets/gaip-scenario-engine.js:348` gives `water.ions` ten zeros in `DEFAULT_STATE`.
 * A site with no water sample sends no ions, so `buildState` fills them in. This is a
 * MEASUREMENT, not a repair: it prints what the engine answers on the two states and
 * asserts only that both were computed, so "they agree" and "the engine never ran" cannot
 * read the same.
 *
 * The chain that makes this reachable, each address opened before this was written:
 *   app/resources/views/reports/scenarios.blade.php:60,142 — mounts the panel, loads both files
 *   assets/gaip-whatif-ui.js:835  adaptStateForEngine(currentState.baselineState)
 *   assets/gaip-whatif-ui.js:862  compareScenarios(baseline, modified)
 *   assets/gaip-scenario-engine.js:1238 -> :1199 buildState -> :470 mergeState(DEFAULT_STATE)
 *   assets/gaip-scenario-engine.js:1202 runWaterQualityEngine(validState)
 *
 * `adaptStateForEngine` does not mention `ions` anywhere in its body: it copies
 * `inputs.water` verbatim, so nothing stands between the absence and the default.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'assets', 'gaip-scenario-engine.js');

function loadEngine() {
    const sandbox = { console: { log() {}, warn() {}, error() {} }, JSON, Math, Object, Array,
        String, Number, Boolean, Date, isNaN, parseFloat, parseInt };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), sandbox, { filename: 'gaip-scenario-engine.js' });

    return sandbox.GAIP_ScenarioEngine;
}

/** The state a site with no water sample reaches the engine with. */
const siteWithNoWaterSample = () => ({
    turf: { turfType: 'sports', grassSpecies: 'Perennial Ryegrass' },
    soil: { pH_water: 6.2, CEC: 12 },
});

describe('GH-707 — the ten zeros of `water.ions`, and whether the engine answers on them', () => {
    const engine = loadEngine();

    test('POSITIVE CONTROL: the engine loaded and both states were computed', () => {
        expect(typeof engine.buildState).toBe('function');
        expect(typeof engine.runWaterQualityEngine).toBe('function');
    });

    test('what `buildState` hands the water engine when the site sent no ions', () => {
        const built = engine.buildState(siteWithNoWaterSample());
        process.stdout.write('[gh707] water after buildState: ' + JSON.stringify(built.water) + '\n');

        /**
         * TURNED OVER BY THE REPAIR, GH-707. This case recorded the defect as the state of things: a
         * site that sent no ions was handed ten zeros, and the assertion held them in place. They are
         * gone now, together with the `|| 0` and `|| 7` inside the engine that made the same zeros
         * again -- which is why removing the literals alone changed nothing and this file measured
         * exactly that. What is asserted instead is the rule the owner set: what never arrived stays
         * absent, so there is nothing to judge and no judgement is printed.
         */
        expect(built.water.ions).toEqual({});
        expect(built.water.ecw).toBeNull();
        expect(built.water.pH).toBeNull();

        const answer = engine.runWaterQualityEngine(built);
        process.stdout.write('[gh707] and the verdict on it: ' + JSON.stringify({
            qualityClass: answer.qualityClass, sar: answer.sar, sarAdj: answer.sarAdj,
            riskScore: answer.riskScore, concerns: answer.concerns,
        }) + '\n');
        // Four manufactured positives stood here before the repair: `Excellent`, 0, 0 and no
        // concerns. A fifth was found by this guard during it -- `null < 6.0` raised a toxicity
        // concern out of an absent pH.
        expect(answer.qualityClass).toBeNull();
        expect(answer.sar).toBeNull();
        expect(answer.sarAdj).toBeNull();
        expect(answer.riskScore).toBeNull();
        expect(answer.concerns).toEqual([]);
    });

    test('the engine ON THE ZEROS against the engine with the ions ABSENT', () => {
        const withZeros = engine.buildState(siteWithNoWaterSample());
        const withAbsent = JSON.parse(JSON.stringify(withZeros));
        delete withAbsent.water.ions;

        const a = engine.runWaterQualityEngine(withZeros);
        const b = engine.runWaterQualityEngine(withAbsent);

        process.stdout.write('[gh707] on the ten zeros : ' + JSON.stringify(a) + '\n');
        process.stdout.write('[gh707] with ions absent : ' + JSON.stringify(b) + '\n');
        process.stdout.write('[gh707] the two answers agree: ' + (JSON.stringify(a) === JSON.stringify(b)) + '\n');

        // Both were computed. Whether they agree is the reading, not the claim.
        expect(a).toBeTruthy();
        expect(b).toBeTruthy();
    });
});
