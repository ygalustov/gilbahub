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

/**
 * The converter, executed — the one function this file is about.
 *
 * GH-725: it also takes the config the SERVER delivers to the frame, because one of the values it
 * assembles comes from there rather than from the state. Passing nothing leaves the config absent,
 * which is its own case.
 */
function transform(domState, gaipConfig, lastPGR) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    if (arguments.length > 1) sandbox.GAIP_HUB_CONFIG = { gaipConfig };
    // GH-780: the journal's answer and the engine that owns the question, both as the page has them.
    if (arguments.length > 2) sandbox.GAIP_LAST_PGR = lastPGR;
    sandbox.GAIP_PGR = require('./lib/pgr-engine').engine();
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    // The chooser of whose application this is, lifted from the product beside the converter.
    ['gaip_lastPgrForThisRun'].forEach((name) => {
        const from = SRC.indexOf('function ' + name + '(');
        expect(from).toBeGreaterThan(-1);
        let d = 0;
        for (let i = SRC.indexOf('{', from); i < SRC.length; i += 1) {
            if (SRC[i] === '{') d += 1;
            else if (SRC[i] === '}') {
                d -= 1;
                if (!d) { vm.runInContext(SRC.slice(from, i + 1), ctx, { filename: name }); break; }
            }
        }
    });
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
/**
 * GH-782 (queue item 3ga): the converter carries three more fields the engine reads - `methodology`,
 * `soilTexture` and `depthCm` - which its hand-written list had dropped, so every site set to ammonium acetate
 * was computed by the SLAN table while its row declared AA. They are in these fixtures because this file's claim
 * is that what the converter builds and what a state supplies agree, and they now must.
 */
const SOIL_FIELDS_THE_ENGINE_READS = { methodology: 'ammonium_acetate', soilTexture: 'sand', depthCm: 75 };
const STATE_WITHOUT_OM = { soil: Object.assign({ LOI: null, OM_pct: null, CEC: 5.9, pH_water: 6.1 },
    SOIL_FIELDS_THE_ENGINE_READS), water: {}, turf: {} };
/** And for one that has it. */
const STATE_WITH_OM = { soil: Object.assign({ LOI: 2.9, OM_pct: 2.9, CEC: 5.9, pH_water: 6.1 },
    SOIL_FIELDS_THE_ENGINE_READS), water: {}, turf: {} };

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

    /**
     * GH-725 (queue item 3bo) — TWO MORE SUBSTITUTIONS ON THIS SAME LAYER, AND NEITHER MOVES A
     * NUMBER TODAY, WHICH IS WHY THEY ARE TRAPS RATHER THAN DEFECTS.
     *
     * `water.SAR` came through as `|| 0`, and zero is the safest-looking sodium hazard there is —
     * the shape of GH-707's manufactured zero ions. Measured on the stand: none of the eight live
     * water samples carries a SAR, so nothing changes for anyone now; the first report that carries
     * one would have been reported as zero.
     *
     * `turf.pgrActive` came through as `|| false` over a state field NOTHING fills: the person's
     * answer is the PGR switch, stored as `pgr.enabled` in the site's own config and delivered to
     * this frame by the server. PGR is off on all twelve configured sites, so again nothing moves;
     * the first site to switch it on would have been judged as though it had not.
     */
    test('GH-725: an absent SAR stays absent, and a supplied one arrives unchanged', () => {
        const absent = transform({ soil: {}, water: {}, turf: {} }).inputs.water.SAR;
        const supplied = transform({ soil: {}, water: { SAR: 3.4 }, turf: {} }).inputs.water.SAR;
        process.stdout.write('[gh725] water.SAR — absent: ' + JSON.stringify(absent)
            + ' | supplied 3.4: ' + JSON.stringify(supplied) + '\n');
        expect(absent).toBeNull();
        expect(supplied).toBe(3.4);
        // A real zero is a reading, not an absence, and must survive as one.
        expect(transform({ soil: {}, water: { SAR: 0 }, turf: {} }).inputs.water.SAR).toBe(0);
    });

    test('GH-780: the converter CARRIES the PGR answer of the state, and works out nothing itself', () => {
        /**
         * WHERE THE ANSWER IS MADE, and why this case no longer asks the converter to make it. The owner
         * removed the PGR switch on 29.09.2026: a site is using one when its journal holds an application
         * within the engine's ninety-day window. The first version of that repair computed the answer HERE --
         * and the shade advice that reaches a stored row comes from the orchestrator's pass, which reads
         * `GAIP_STATE.turf` and never saw it. Measured live on `Russley`, 71 days: the row said
         * `currentlyActive: false` before and after, for the same reason.
         *
         * So the flag has one producer, the `turf` block of `gaip_build_state`, and this converter carries
         * it. What it must not do is invent one: absence stays absence, and the config's old switch is not
         * consulted at all.
         */
        const carried = (turfBlock, cfg) => transform({ soil: {}, water: {}, turf: turfBlock }, cfg)
            .inputs.turf.pgrActive;

        const inUse = carried({ pgrActive: true }, {});
        const notInUse = carried({ pgrActive: false }, {});
        const unknown = carried({ pgrActive: null }, {});
        const absent = carried({}, {});
        const switchOn = carried({}, { pgr: { enabled: true } });
        process.stdout.write('[gh780] the converter carries — true: ' + JSON.stringify(inUse)
            + ' | false: ' + JSON.stringify(notInUse)
            + ' | null: ' + JSON.stringify(unknown)
            + ' | absent from the state: ' + JSON.stringify(absent)
            + ' | config switch on, state silent: ' + JSON.stringify(switchOn) + '\n');

        expect(inUse).toBe(true);
        expect(notInUse).toBe(false);
        expect(unknown).toBeNull();
        // Absent in the state is not `false`: the shade advice then neither asserts nor denies a conflict.
        expect(absent).toBeNull();
        // And the switch cannot bring the old behaviour back through this door.
        expect(switchOn).toBeNull();
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
            // GH-782 (queue item 3ga): three fields the engine reads and the converter used to drop, so a site
            // on ammonium acetate was computed by the SLAN table while its row declared AA.
            methodology: 'ammonium_acetate', soilTexture: 'sand', depthCm: 75,
        },
        water: {
            ecw: 0.5, EC: 1.2, pH: 7.1,
            ions: { Na: 31 }, SAR: 1.5, adjSAR: 1.8,
        },
    };

    /**
     * GH-619 (queue item 3x, the reviewer's return) — AND THE SAME UNIVERSE, FED NOTHING.
     *
     * The case below sends every field WITH a value, so it says that a reading arrives as itself and
     * nothing at all about an absence; absence was checked by the hand-written list two cases above.
     * A guard that fills its own list cannot find the field nobody added to it — which is how
     * `adjSAR` kept `|| 0` while its neighbour `SAR` was repaired one line above it.
     *
     * So the universe is the converter's own keys again, and the state sent is EMPTY. Every field
     * must arrive `null`, with the exceptions declared here rather than discovered:
     *   - `bulkDensity` — its default is the owner's open decision, recorded in the defects document;
     *   - `ppm`, `meq`, `ions` — containers, and an empty container is not a manufactured value.
     * A field that starts substituting reddens by itself, naming itself and what it invented.
     */
    const ABSENCE_EXCEPTIONS = {
        'soil.bulkDensity': 'the default is the owner\'s open decision, not this layer\'s to remove',
        'soil.ppm': 'a container; an empty one invents no value',
        'soil.meq': 'a container; an empty one invents no value',
        'water.ions': 'a container; an empty one invents no value',
    };

    test('and fed NOTHING, every field the converter builds arrives as an absence', () => {
        const out = transform({ soil: {}, water: {}, turf: {} });
        const rows = [];
        ['soil', 'water'].forEach((half) => {
            Object.keys((out.inputs && out.inputs[half]) || {}).forEach((k) => {
                const at = half + '.' + k;
                rows.push({ at, got: out.inputs[half][k], excepted: at in ABSENCE_EXCEPTIONS });
            });
        });
        process.stdout.write('[gh619] fed nothing, the converter builds ' + rows.length + ' fields:\n'
            + rows.map((r) => '[gh619]   ' + r.at.padEnd(20) + ' -> ' + JSON.stringify(r.got)
                + (r.excepted ? '   (declared exception: ' + ABSENCE_EXCEPTIONS[r.at] + ')' : '')).join('\n') + '\n');

        // The universe is real, and it is the same one the case below walks.
        expect(rows.length).toBeGreaterThan(12);
        const invented = rows.filter((r) => !r.excepted && r.got !== null)
            .map((r) => r.at + ' invented ' + JSON.stringify(r.got));
        // Both directions: an exception that no longer invents anything has to go, or the list
        // becomes an excuse for code that has already been repaired.
        const idleExceptions = Object.keys(ABSENCE_EXCEPTIONS).filter((at) => {
            const row = rows.find((r) => r.at === at);

            return !row || row.got === null;
        });
        expect({ invented, idleExceptions }).toEqual({ invented: [], idleExceptions: [] });
    });

    /**
     * GH-619 (queue item 3x, the reviewer's SECOND return) — ONE FIELD AT A TIME, WITH THE REST FULL.
     *
     * Her words about the case above, and they are right: from an empty state there is nothing to
     * substitute WITH, so a field that takes its value from ANOTHER field passes it. Her mutation —
     * a site with no water takes the water `pH` from the soil one — stayed green on all eleven.
     *
     * So each field is removed on its own while every other field is present, and what arrives in its
     * place has to be an absence. A substitution that borrows from a neighbour is then red, because
     * the neighbour is there to borrow from.
     *
     * ONE BORROWING IS DELIBERATE AND DECLARED: `EC` falls back to `ecw`, the same reading under
     * another name, and the chain is stated in the converter's own comment. It is named here rather
     * than left to be discovered, which is the difference between a chain and a substitution.
     */
    /**
     * GH-619 (queue item 3x, the reviewer's THIRD return) — A DECLARED BORROWING NAMES WHAT IT BORROWS.
     *
     * The first version of this allowance asserted only that something arrived where `EC` had been
     * removed, which is less than it promised: `EC` could have taken a reading from anywhere, or a
     * substituted constant, and the case would have nodded. `GH-673` caught this very file for the
     * same shape — six named in prose, five asserted — and the cure is the same: the allowance carries
     * the field it borrows FROM, and the value that arrives has to be that field's own.
     */
    const BORROWING_ALLOWED = {
        'water.EC': {
            from: 'water.ecw',
            why: 'declared chain: `EC ?? ecw`, the same reading under the name the older payloads use',
        },
    };

    test('and with every other field present, a field removed on its own still arrives as an absence', () => {
        const rows = [];
        ['soil', 'water'].forEach((half) => {
            Object.keys(ALL_READINGS[half]).forEach((missing) => {
                const at = half + '.' + missing;
                if (at in ABSENCE_EXCEPTIONS) return;
                const sent = { soil: { ...ALL_READINGS.soil }, water: { ...ALL_READINGS.water }, turf: {} };
                delete sent[half][missing];
                const got = transform(sent).inputs[half][missing];
                const allowance = BORROWING_ALLOWED[at] || null;
                const owed = allowance
                    ? ALL_READINGS[allowance.from.split('.')[0]][allowance.from.split('.')[1]]
                    : undefined;
                rows.push({ at, got, allowed: !!allowance, from: allowance && allowance.from, owed });
            });
        });
        process.stdout.write('[gh619] each field removed on its own, the rest full:\n'
            + rows.map((r) => '[gh619]   without ' + r.at.padEnd(20) + ' -> ' + JSON.stringify(r.got)
                + (r.allowed ? '   (borrows ' + r.from + ', which holds ' + JSON.stringify(r.owed) + ')' : '')).join('\n') + '\n');

        // The universe is the same one the other two cases walk, minus what they declare.
        expect(rows.length).toBeGreaterThan(8);
        const borrowed = rows.filter((r) => !r.allowed && r.got !== null)
            .map((r) => r.at + ' arrived as ' + JSON.stringify(r.got) + ' with the field removed');
        const idleBorrowings = Object.keys(BORROWING_ALLOWED).filter((at) => {
            const row = rows.find((r) => r.at === at);

            return !row || row.got === null;
        });
        // And a borrowing arrives with the value of the field it declares it borrows from — not
        // merely with something. The third return: less was asserted than the allowance promised.
        const borrowedFromElsewhere = rows.filter((r) => r.allowed)
            .filter((r) => JSON.stringify(r.got) !== JSON.stringify(r.owed))
            .map((r) => r.at + ' says it borrows ' + r.from + ' (' + JSON.stringify(r.owed)
                + ') and arrived as ' + JSON.stringify(r.got));
        expect({ borrowed, idleBorrowings, borrowedFromElsewhere })
            .toEqual({ borrowed: [], idleBorrowings: [], borrowedFromElsewhere: [] });
    });

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
