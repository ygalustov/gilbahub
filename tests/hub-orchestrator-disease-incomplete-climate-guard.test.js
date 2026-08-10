/**
 * computeAll() Step 6 (disease block) — targeted handling of incomplete climate data
 *
 * History of this fix (kept in the header because both versions matter for
 * understanding why the final shape looks like this):
 *
 * v1 (wrong premise): computeAll() can fire multiple times within one /hub
 * page session (gaip:analysis-complete, gaip:site-changed, gaip:weather-ready
 * retry, a "fast-path" rerun timer, etc.). Production log showed a pass where
 * climate.moisture.humidity.mean was null and Red Thread's coupling
 * amplification (47% -> 54%) from an earlier, complete pass got silently
 * overwritten by a data-starved recompute. The first fix skipped the ENTIRE
 * disease block whenever climate.moisture.humidity.mean was null.
 *
 * That was too broad. A second production log (with the temperature-only fix
 * still in place, i.e. the bug not yet fixed for humidity) showed the SAME
 * "humidity: n/a" condition on a pass where Fusarium, BrownPatch, Anthracnose
 * and DrechsleraPoae all computed legitimate, non-degraded results anyway —
 * because those models' real moisture signal is dewData.leafWetness
 * (dew-prediction-engine), read via getLeafWetnessHours(), which is entirely
 * independent of climate.moisture.humidity.mean. Only RedThreadModel has no
 * such fallback — its humidityFactor is computed directly from that scalar,
 * with dewData only multiplying it (LWD gate), never replacing it. Gating the
 * whole block on humidity would have discarded 7 valid disease results to
 * protect the 1 that actually needed the missing field.
 *
 * v2 (this version): temperature-only gate for the whole block (kept — a
 * real, separate historical concern per the original stale comment "Running
 * with null/default temps produces false positives"). Red Thread specifically
 * is checked post-coupling via its own drivers.humidity.value (RedThreadModel
 * already exposes the raw humidity it used at
 * assets/red-thread-model.js:465-470) — when null, and a previous session
 * result with valid humidity exists, that previous Red Thread entry is kept
 * instead of the data-starved one. Every other disease in the pass still
 * writes normally.
 *
 * hub-orchestrator.js is a large non-module IIFE with heavy DOM/global
 * dependencies (matches the existing test style in
 * tests/hub-orchestrator-climate-recovery.test.js) — these are static
 * source-structure assertions, not a behavioural execution test.
 *
 * Spec: tests/hub-orchestrator-disease-incomplete-climate-guard.test.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/hub-orchestrator.js'),
    'utf8'
);

function extractStep6() {
    const start = src.indexOf('log("main", "Step 6: Disease analysis")');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('// 7b. COMPANION SURFACE DISEASE', start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

describe('computeAll Step 6 — temperature gate (block-wide)', () => {
    const step6 = extractStep6();

    test('checks temperature presence before running the disease engine', () => {
        expect(step6).toMatch(/_dxHasTemp/);
        expect(step6).toContain('_dxClimate.temperature.mean != null');
    });

    test('does NOT gate the whole block on humidity (v1 regression guard)', () => {
        // The whole-block humidity gate was the wrong scope — see file header.
        // This must not come back as a block-wide skip condition.
        expect(step6).not.toMatch(/if\s*\(\s*!_dxHasTemp\s*\|\|\s*!_dxHasHumidity\s*\)/);
    });

    test('runDiseaseAnalysis is only reachable when the temperature check passes (inside the else branch)', () => {
        const guardPos = step6.indexOf('if (!_dxHasTemp)');
        const elsePos = step6.indexOf('} else {', guardPos);
        const runCallPos = step6.indexOf('runDiseaseAnalysis(diseaseInputs)');
        expect(guardPos).toBeGreaterThan(-1);
        expect(elsePos).toBeGreaterThan(guardPos);
        expect(runCallPos).toBeGreaterThan(elsePos);
    });

    test('skip branch logs a warning and does not write _hubState.computed.disease', () => {
        const guardPos = step6.indexOf('if (!_dxHasTemp)');
        const elsePos = step6.indexOf('} else {', guardPos);
        const skipBranch = step6.slice(guardPos, elsePos);
        expect(skipBranch).toContain('warn(');
        expect(skipBranch).not.toContain('_hubState.computed.disease =');
    });
});

describe('computeAll Step 6 — Red Thread-specific humidity fallback', () => {
    const step6 = extractStep6();

    test('reads the humidity value RedThreadModel actually used, via drivers.humidity.value', () => {
        expect(step6).toContain("d.disease === \"redThread\"");
        expect(step6).toContain('drivers?.humidity?.value == null');
    });

    test('only swaps in the previous result when it has a valid (non-null) humidity reading', () => {
        expect(step6).toContain('drivers?.humidity?.value != null');
    });

    test('reads the previous result from _hubState.computed.disease (this-session history), not a hardcoded default', () => {
        expect(step6).toContain('_hubState.computed.disease?.diseases');
    });

    test('the merge runs after coupling and before the write, so coupling never double-applies to the restored entry', () => {
        const couplingApplyPos = step6.indexOf('GAIP_DiseaseStressCoupling.apply(');
        const mergePos = step6.indexOf('_rtHumidityMissing');
        const writePos = step6.indexOf('_hubState.computed.disease = wrapWithConfidence("disease", coupledResult)');
        expect(couplingApplyPos).toBeGreaterThan(-1);
        expect(mergePos).toBeGreaterThan(couplingApplyPos);
        expect(writePos).toBeGreaterThan(mergePos);
    });

    test('other diseases in the pass are untouched — only the redThread array entry is replaced', () => {
        // The fix indexes into coupledResult.diseases and replaces exactly one
        // entry (coupledResult.diseases[_rtIdx] = _prevRT), not the whole array.
        expect(step6).toMatch(/coupledResult\.diseases\[_rtIdx\]\s*=\s*_prevRT/);
    });

    test('merge failures are caught and non-fatal (does not abort the rest of the disease write)', () => {
        const mergePos = step6.indexOf('_rtHumidityMissing');
        const catchPos = step6.indexOf('catch (rtErr)', mergePos);
        expect(catchPos).toBeGreaterThan(mergePos);
    });
});

describe('computeAll Step 6 — overallScore/topThreats recompute after the Red Thread swap', () => {
    // Bug found via live testing: apply() computes overallScore/topThreats
    // (b35fix353b's MAX-of-validated formula) BEFORE the Red Thread merge
    // above runs. If Red Thread's fresh, data-starved value was the reason it
    // *wasn't* the max, restoring its real reading afterward silently left
    // overallScore/topThreats pointing at the second-highest disease instead
    // — e.g. dashboard showed "Overall Disease Risk 27% Low" while Red
    // Thread sat at 59% at the top of Active Threats. Fix: recompute both,
    // using the identical formula/shape disease-stress-climate-coupling.js's
    // own post-coupling recompute step already uses, inside the `if
    // (_prevRT)` branch — only when the swap actually happened.
    const step6 = extractStep6();

    function extractPrevRTBranch() {
        const prevRTIfPos = step6.indexOf('if (_prevRT) {');
        expect(prevRTIfPos).toBeGreaterThan(-1);
        let depth = 0, begun = false, end = -1;
        for (let i = prevRTIfPos; i < step6.length; i++) {
            if (step6[i] === '{') { depth++; begun = true; }
            if (step6[i] === '}') depth--;
            if (begun && depth === 0) { end = i + 1; break; }
        }
        expect(end).toBeGreaterThan(prevRTIfPos);
        return step6.slice(prevRTIfPos, end);
    }

    test('recompute lives inside the if (_prevRT) branch, after the swap, not unconditionally every pass', () => {
        const branch = extractPrevRTBranch();
        const swapPos = branch.indexOf('coupledResult.diseases[_rtIdx] = _prevRT;');
        const recomputePos = branch.indexOf('coupledResult.overallScore = _newOverall;');
        expect(swapPos).toBeGreaterThan(-1);
        expect(recomputePos).toBeGreaterThan(swapPos);
    });

    test('re-sorts diseases by adjustedRisk descending before deriving topThreats (array order may be stale after the swap)', () => {
        const branch = extractPrevRTBranch();
        expect(branch).toMatch(/coupledResult\.diseases\.sort\(\(a,\s*b\)\s*=>\s*\(b\.adjustedRisk \|\| 0\)\s*-\s*\(a\.adjustedRisk \|\| 0\)\)/);
    });

    test('validated pool excludes beta AND fusarium (#91), matching disease-engine-pure.js / disease-stress-climate-coupling.js exactly', () => {
        const branch = extractPrevRTBranch();
        expect(branch).toContain("d.validationStatus !== \"beta\"");
        expect(branch).toContain("d.disease !== \"fusarium\"");
    });

    test('overallScore is MAX of the validated pool (falls back to all diseases if none validated)', () => {
        const branch = extractPrevRTBranch();
        expect(branch).toMatch(/const _pool = _validated\.length > 0 \? _validated : coupledResult\.diseases;/);
        expect(branch).toMatch(/Math\.max\(\.\.\._pool\.map\(_safeRisk\)\)/);
    });

    test('overallRisk is reclassified via DiseaseEnginePure.utils.classifyRisk, not left stale', () => {
        const branch = extractPrevRTBranch();
        expect(branch).toContain('global.DiseaseEnginePure?.utils?.classifyRisk');
        expect(branch).toContain('coupledResult.overallRisk = global.DiseaseEnginePure.utils.classifyRisk(_newOverall);');
    });

    test('topThreats is rebuilt from the same (now-correct) pool, top 3, same field shape as the coupling layer', () => {
        const branch = extractPrevRTBranch();
        const topThreatsPos = branch.indexOf('coupledResult.topThreats = _pool.slice(0, 3).map(');
        expect(topThreatsPos).toBeGreaterThan(-1);
        const shapeBlock = branch.slice(topThreatsPos, topThreatsPos + 400);
        expect(shapeBlock).toContain('disease: d.displayName');
        expect(shapeBlock).toContain('risk: d.adjustedRisk');
        expect(shapeBlock).toContain('level: d.riskLevel');
    });
});

describe('RedThreadModel exposes the humidity value it used (dependency for the merge check above)', () => {
    const rtSrc = fs.readFileSync(
        path.join(__dirname, '../assets/red-thread-model.js'),
        'utf8'
    );

    test('drivers.humidity.value is set from the raw humidity input', () => {
        const driversPos = rtSrc.indexOf('const drivers = {');
        expect(driversPos).toBeGreaterThan(-1);
        const humidityBlockPos = rtSrc.indexOf('humidity: {', driversPos);
        const valuePos = rtSrc.indexOf('value: humidity', humidityBlockPos);
        expect(humidityBlockPos).toBeGreaterThan(driversPos);
        expect(valuePos).toBeGreaterThan(humidityBlockPos);
    });
});
