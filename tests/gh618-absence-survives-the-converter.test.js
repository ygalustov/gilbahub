/**
 * GH-618 — ABSENCE SURVIVES THE LAYER BETWEEN THE STATE AND THE ENGINES.
 *
 * WHAT WAS WRONG, AND IT IS THE SAME DEFAULT TWICE. GH-615 stopped the run
 * state reading `.gaip-loi` — a form field of the old hub — so a site whose
 * sample carries no organic matter now leaves the reading absent instead of
 * calling it zero. `gaip_transformToCascadeFormat`, which stands between that
 * state and every engine, then wrote `domState.soil?.LOI || 0` and turned the
 * absence back into a zero before any engine saw it. Measured in a sandbox by
 * the reviewer:
 *
 *     state.soil.LOI = null  ->  cascade inputs.soil.LOI = 0
 *
 * So the repair one layer up changed nothing a calculation could notice, and
 * the five cases of GH-615 stayed green because they measure THE STATE. This
 * file measures what the ENGINE IS HANDED, which is the thing that matters.
 *
 * WHY THE FALLBACK IS WRONG HERE AND RIGHT ELSEWHERE. This layer carries a
 * fact; the engines decide what to do when the fact is missing, and they
 * already do: the recovery engine asks `!e.soil?.LOI && !e.soil?.OM_pct`, which
 * is true for `null` exactly as it was for `0`, and the thatch and irrigation
 * paths take `safeNum(soil.LOI, 0)` at the point of use. A default belongs
 * where a number is needed, not where a reading is being passed along.
 *
 * WHAT THIS FILE DOES NOT SETTLE, and the reviewer named it: he measured the
 * OUTPUT OF THE CONVERTER, not the stored row. Whether the absence survives all
 * the way into `analysis_results` is a separate question and is not answered
 * here.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');

/** The converter, executed — the one function this file is about. */
function transform(domState) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    const at = SRC.indexOf('function gaip_transformToCascadeFormat(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    const open = SRC.indexOf('{', at);
    let body = null;
    for (let j = open; j < SRC.length; j++) {
        if (SRC[j] === '{') depth++;
        else if (SRC[j] === '}') { depth--; if (!depth) { body = SRC.slice(at, j + 1); break; } }
    }
    vm.runInContext(body, ctx, { filename: 'gaip_transformToCascadeFormat' });
    expect(typeof ctx.gaip_transformToCascadeFormat).toBe('function');

    return ctx.gaip_transformToCascadeFormat(domState, null);
}

/** What `gaip_build_state()` produces for a sample with no organic matter. */
const STATE_WITHOUT_OM = { soil: { LOI: null, OM_pct: null, CEC: 5.9, pH_water: 6.1 }, water: {}, turf: {} };
/** And for one that has it. */
const STATE_WITH_OM = { soil: { LOI: 2.9, OM_pct: 2.9, CEC: 5.9, pH_water: 6.1 }, water: {}, turf: {} };

describe('GH-618 — what the engines are handed', () => {
    test('the converter ran and produced a soil block at all', () => {
        // Positive control: an absence below must be the absence of a value,
        // not of the whole block.
        const out = transform(STATE_WITH_OM);
        expect(out).toBeTruthy();
        expect(out.inputs).toBeTruthy();
        expect(out.inputs.soil).toBeTruthy();
        process.stdout.write('[gh618] soil handed to the engines: '
            + JSON.stringify({ LOI: out.inputs.soil.LOI, CEC: out.inputs.soil.CEC }) + '\n');
    });

    test('a measured reading arrives unchanged', () => {
        expect(transform(STATE_WITH_OM).inputs.soil.LOI).toBe(2.9);
    });

    test('an unmeasured reading arrives ABSENT, not as zero', () => {
        // The subject. `0` here is a number nobody measured, handed to engines
        // that compute organic-matter programmes from it.
        const out = transform(STATE_WITHOUT_OM);
        process.stdout.write('[gh618] with no organic matter measured, the engines see LOI = '
            + JSON.stringify(out.inputs.soil.LOI) + '\n');

        expect(out.inputs.soil.LOI).toBeNull();
        expect(out.inputs.soil.LOI).not.toBe(0);
    });

    test('and a measured zero still arrives as zero, which is a different fact', () => {
        // `?? null` keeps it; `|| 0` could not tell the two apart in the other
        // direction either, and the distinction is the whole of GH-608/611/616.
        const out = transform({ soil: { LOI: 0, OM_pct: 0 }, water: {}, turf: {} });
        expect(out.inputs.soil.LOI).toBe(0);
    });

    test('GH-619: the neighbours on this layer carry absence too, now', () => {
        // This case is REWRITTEN, not repaired. It used to pin the fact that
        // the neighbours still defaulted — true when it was written, and made
        // false by a decision, which is the one reason a case may change. Five
        // of them were settled with GH-619: `pH_water`, `pH_cacl2`, `CEC` on
        // the soil side, `ecw`, `EC` and `pH` on the water side.
        const out = transform({ soil: {}, water: {}, turf: {} });

        expect(out.inputs.soil.pH_water).toBeNull();
        expect(out.inputs.soil.pH_cacl2).toBeNull();
        expect(out.inputs.soil.CEC).toBeNull();
        expect(out.inputs.water.ecw).toBeNull();
        // GH-673 (queue item 3ts, the reviewer's finding) — `EC` WAS NAMED IN THE
        // COMMENT ABOVE AND ASSERTED NOWHERE. Six were listed, five were claimed,
        // and he measured what that was worth: the mutation at
        // `hub-tissue-v3.js:519` reddened nothing. A list in prose is wider than a
        // list in assertions, and the prose is what a reader believes.
        expect(out.inputs.water.EC).toBeNull();
        expect(out.inputs.water.pH).toBeNull();
    });

    /**
     * GH-695 (queue item 3x, the reviewer's return) — THE UNIVERSE IS WHAT THE CONVERTER BUILDS, NOT
     * A LIST WRITTEN HERE.
     *
     * The case this replaces sent six readings and asserted five, and the case before it named six in
     * prose and asserted five of those. Both were repaired one field at a time — `EC` under GH-673,
     * `pH_cacl2` under GH-693 — and this file had meanwhile written down the very danger it was
     * living with: "a list in prose is wider than a list in assertions, and the prose is what a
     * reader believes." It said so while keeping a hand-written list.
     *
     * HIS CURE, AND IT IS CHECKABLE: the fixture carries every field of the soil and water halves,
     * and the universe compared against it is `Object.keys` OF THE CONVERTER'S OWN OUTPUT. A seventh
     * field added to either half then appears in the output with nothing sent for it and reddens by
     * itself, naming itself — no one has to remember to come back here.
     *
     * BOTH DIRECTIONS, because each catches a different mistake: a field the converter builds and the
     * fixture does not send is a hole in the fixture; a field the fixture sends and the converter does
     * not build is a field that was removed, or misspelled, while this file went on claiming it.
     */
    const ALL_READINGS = {
        soil: {
            bulkDensity: 1.55, surfaceType: 'sand carpet',
            pH_water: 6.1, pH_cacl2: 5.4, CEC: 5.9, LOI: 4.2,
            ppm: { K: 41 }, meq: { K: 0.11 },
        },
        water: {
            ecw: 0.5, EC: 1.2, pH: 7.1,
            ions: { Na: 31 }, SAR: 1.5, adjSAR: 1.8,
        },
    };

    test('every field the converter builds is sent, and arrives as itself', () => {
        const out = transform({ soil: ALL_READINGS.soil, water: ALL_READINGS.water, turf: {} });
        const rows = [];
        ['soil', 'water'].forEach((half) => {
            const built = Object.keys((out.inputs && out.inputs[half]) || {});
            built.forEach((k) => rows.push({
                at: half + '.' + k,
                sent: Object.prototype.hasOwnProperty.call(ALL_READINGS[half], k) ? ALL_READINGS[half][k] : undefined,
                got: out.inputs[half][k],
                inTheFixture: Object.prototype.hasOwnProperty.call(ALL_READINGS[half], k),
            }));
            Object.keys(ALL_READINGS[half]).forEach((k) => {
                if (built.includes(k)) return;
                rows.push({ at: half + '.' + k, sent: ALL_READINGS[half][k], got: '<NOT BUILT>', inTheFixture: true });
            });
        });
        process.stdout.write('[gh695] the converter builds ' + rows.length + ' fields across the two halves:\n'
            + rows.map((r) => '[gh695]   ' + r.at.padEnd(20)
                + ' sent ' + JSON.stringify(r.sent)
                + ' -> got ' + JSON.stringify(r.got)).join('\n') + '\n');

        // The universe is real: an output with no fields would satisfy everything below.
        expect(rows.length).toBeGreaterThan(12);

        const notSent = rows.filter((r) => !r.inTheFixture).map((r) => r.at);
        const notBuilt = rows.filter((r) => r.got === '<NOT BUILT>').map((r) => r.at);
        const changed = rows
            .filter((r) => r.inTheFixture && r.got !== '<NOT BUILT>')
            .filter((r) => JSON.stringify(r.got) !== JSON.stringify(r.sent))
            .map((r) => r.at + ': sent ' + JSON.stringify(r.sent) + ', got ' + JSON.stringify(r.got));

        expect({
            builtButTheFixtureSendsNothing: notSent,
            sentButTheConverterBuildsNothing: notBuilt,
            arrivedAsSomethingElse: changed,
        }).toEqual({
            builtButTheFixtureSendsNothing: [],
            sentButTheConverterBuildsNothing: [],
            arrivedAsSomethingElse: [],
        });
    });

    test('and a measured ZERO survives, which `|| 0` could never distinguish', () => {
        expect(transform({ soil: { CEC: 0 }, water: {}, turf: {} }).inputs.soil.CEC).toBe(0);
    });

    test('bulkDensity is LEFT substituting, deliberately, and this says so', () => {
        // Not an oversight and not the same thing. Measured: NONE of the 48
        // live soil samples carries a bulk density, the field it would come
        // from is a form of the old hub, and `input-range-validator.js:276`
        // already calls it a structural default rather than a lab result — 61
        // of the 65 stored rows carry 1.4. So this is a constant of the model,
        // not a substitution for a fact, and removing it would take a number
        // out of a calculation that has no other source for it. It is named for
        // a decision rather than settled in passing.
        expect(transform({ soil: {}, water: {}, turf: {} }).inputs.soil.bulkDensity).toBe(1.4);
    });
});
