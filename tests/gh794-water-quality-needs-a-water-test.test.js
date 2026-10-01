'use strict';

/**
 * GH-794 (queue item 3gh) — WATER QUALITY IS NOT CALCULATED WITHOUT A WATER TEST, AND A RUN THAT HAD NONE
 * SAYS SO INSTEAD OF ANSWERING "LOW SALINITY RISK".
 *
 * WHAT IS IN THE DATABASE, measured by `SELECT` before this change. 51 stored rows across 6 sites carry a
 * water quality letter although the site had no water sample in effect when the run happened -- and the
 * letter is the SAME letter in all 51: one value of `COUNT(DISTINCT MD5(computed.water))`, for six sites in
 * three countries. Its substituted numbers are visible inside it -- `Actual pH: 7.0`, `SAR 0.00`,
 * `ESP 0.0%`, `Fe: Safe (0.00 mg/L)` -- because the engine reads `safeNum(e.water.ecw, 0)` and
 * `safeNum(e.water.pH, 7)` and answers on zeros as if they were measurements. Sliced the other way, "no
 * water sample ever, including deleted ones" gives 5 sites and 44 rows; the difference is one site whose
 * five water samples were deleted on 02.07 and 15.07.2026, before every run it has. The leading slice is
 * therefore the one that asks about the run's own moment, not about the site's history.
 *
 * THE DECLARATION IS THE GRAPH'S, and it is the shape `GH-777` already established for soil and tissue:
 * the node says `requires: ["samples.water"]`, the gate asks the sample THIS RUN WAS GIVEN through
 * `gaip_sampleReadings` -- the same function the engine's own body asks -- and a module that cannot run is
 * recorded by name with the input it lacked. Nothing new is built here: the input `samples.water` is already
 * in the calculation input list, the gate and the record are shared, and the panel composes its sentence
 * from the record.
 *
 * WHAT THIS SET ASSERTS IS THE CONSEQUENCE, on the real orchestrator and the real adapter loaded the way
 * `/hub` loads them: whether the engine ran, what the pass recorded for it, and whether the word "salinity"
 * appears anywhere in what the pass produced.
 *
 * DECLARED BOUNDARIES:
 *   - what the RENDERER does with the absent letter is asserted by `GH-793`'s set and not here. Measured
 *     why it cannot be added to this one: handed a whole pass that had no soil and no tissue either, the
 *     renderer ends at `hub-tissue-v3.js:6902` on `l.temperature.toFixed(1)` -- the shade letter, a separate
 *     finding of its own. A case of this set would have gone red for that and said nothing about water.
 *   - what a person READS for a not-computed water section is one sentence, and the owner has
 *     not settled it yet, so no case here states its words. The record this set does assert -- the module
 *     named, `samples.water` as its missing input -- is what that sentence is composed from, whichever
 *     wording she chooses.
 */

const fs = require('fs');
const path = require('path');
const { load, withSamples } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));

/**
 * Two water tests, one on each side of the engine's first threshold (`ecw < 0.7`).
 *
 * EACH CARRIES A `serverId` AND IS ADDRESSED BY IT, because that is how the product resolves a named
 * sample. Written with an `id` alone first, and the gate then opened on `not-found` -- the delivery branch --
 * so "the module applies" would have been proved by a sample that was never found. The readings have to be
 * the reason.
 */
const LOW_SALINITY = { id: 'sample_140', serverId: 140, rawData: { EC: 0.35, pH: 7.2, Na: 12, Cl: 18, HCO3: 60, Ca: 20, Mg: 8 } };
const VERY_HIGH_SALINITY = { id: 'sample_141', serverId: 141, rawData: { EC: 3.4, pH: 7.6, Na: 320, Cl: 480, HCO3: 140, Ca: 90, Mg: 40 } };
/** The same two, in the shape the engine reads them in (`water.ecw`, `water.pH`, `water.ions`). */
const LOW_READING = { ecw: 0.35, pH: 7.2, ions: { Na: 12, Cl: 18, HCO3: 60, Ca: 20, Mg: 8 } };
const VERY_HIGH_READING = { ecw: 3.4, pH: 7.6, ions: { Na: 320, Cl: 480, HCO3: 140, Ca: 90, Mg: 40 } };

/**
 * One cascade pass, with the frame's address, the samples this run was given, and -- when the caller passes
 * one -- the water reading on the state, which is where the engine reads from.
 *
 * MEASURED, and the reason this parameter exists: `withSamples` makes the SAMPLE answerable, which is what
 * the gate asks; it does not put readings on `state.inputs.water`, which is what the engine reads. A pass
 * given only a sample therefore produced the identical letter for a 0.35 dS/m sample, a 3.4 dS/m sample and
 * no sample at all -- "Low salinity risk" in all three, on `safeNum(..., 0)` zeros. A positive control built
 * that way would have asserted nothing about the sample, which is the very thing this item is about.
 */
function cascadePass({ search, rows, water }) {
    const bench = load();
    if (bench.failed.length) throw new Error('the bench did not load: ' + JSON.stringify(bench.failed));
    bench.ctx.location.search = search;
    withSamples(bench, rows || {});
    const inputs = water ? { water: water } : {};
    const out = bench.ctx.GilbaCascadeOrchestrator.runCascade({ inputs: inputs, turf: {}, soil: {} }, {});
    const state = bench.ctx.GaipOrchestrator.getState();
    const computed = state.computed || {};
    const recorded = computed.notApplicable || [];
    const letter = computed.water;

    process.stdout.write('[gh794] address ' + JSON.stringify(search)
        + ' -> ran: ' + JSON.stringify(out.executionOrder || [])
        + '\n[gh794]   computed.water is ' + (('water' in computed) ? 'a ' + typeof letter : 'NOT THERE AT ALL')
        + (typeof letter === 'string' ? ': ' + JSON.stringify(letter.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 90)) : '')
        + '\n[gh794]   not applicable: ' + JSON.stringify(recorded) + '\n');

    return { out, computed, recorded, letter, ran: out.executionOrder || [], bench };
}

const entryFor = (recorded, module) => recorded.find((e) => e && e.module === module) || null;
/** The class the engine states, read out of its own letter rather than recomputed here. */
const salinityClassIn = (letter) => {
    const m = String(letter).match(/Salinity class:<\/strong>\s*([^<]+)/);

    return m ? m[1].trim() : null;
};

describe('GH-794 — water quality needs a water test', () => {
    test('POSITIVE CONTROL: the graph declares the requirement, of the sample-key kind', () => {
        const requiring = Object.entries(GRAPH.nodes)
            .filter(([, n]) => (n.requires || []).length)
            .map(([id, n]) => id + ' -> ' + JSON.stringify(n.requires));
        process.stdout.write('[gh794] nodes with a requirement: ' + JSON.stringify(requiring) + '\n');

        expect(GRAPH.nodes['water-blender'].requires).toEqual(['samples.water']);
        // Without a name nothing can be recorded against the module, which the gate refuses to do.
        expect(GRAPH.nodes['water-blender'].module).toBe('water');
    });

    test('POSITIVE CONTROL: with a water sample the engine runs, and its answer follows the sample', () => {
        const low = cascadePass({ search: '?water=140&soil=none&tissue=none',
            rows: { water: LOW_SALINITY }, water: LOW_READING });
        const high = cascadePass({ search: '?water=141&soil=none&tissue=none',
            rows: { water: VERY_HIGH_SALINITY }, water: VERY_HIGH_READING });

        // The gate must have opened because the sample was FOUND and READ, not because it had not arrived.
        expect(typeof low.bench.ctx.gaip_namedSample('water')).toBe('object');
        expect(low.bench.ctx.gaip_sampleReadings('water')).not.toBeNull();
        expect(low.ran).toContain('water-blender');

        process.stdout.write('[gh794] salinity class stated: low sample -> '
            + JSON.stringify(salinityClassIn(low.letter))
            + ', high sample -> ' + JSON.stringify(salinityClassIn(high.letter)) + '\n');

        expect(typeof low.letter).toBe('string');
        expect(typeof high.letter).toBe('string');
        expect(entryFor(low.recorded, 'water')).toBeNull();
        // Two different samples, two different answers: the letter is not a constant that happens to fit.
        expect(salinityClassIn(low.letter)).toBe('Low salinity risk');
        expect(salinityClassIn(high.letter)).not.toBe('Low salinity risk');
    });

    test('told there is NO water sample: the engine is not run and the module is named, with its input', () => {
        const { ran, recorded } = cascadePass({ search: '?water=none&soil=none&tissue=none' });

        expect(ran).not.toContain('water-blender');
        expect(entryFor(recorded, 'water'))
            .toEqual({ module: 'water', missing: ['samples.water'], producer: 'cascade', door: 'notApplicable', pass: null });
    });

    test('and nothing about salinity is produced: no key, and no verdict under another name', () => {
        const { computed } = cascadePass({ search: '?water=none&soil=none&tissue=none' });

        // The shape the 51 stored rows have: a letter where there was no sample.
        expect('water' in computed).toBe(false);
        expect('waterBlend' in computed).toBe(false);
        /**
         * AND NO VERDICT UNDER ANOTHER NAME. The marker is the one the engine itself prints at the head of
         * its letter, and the one this file parses the class out of -- one anchor, used both ways.
         *
         * Measured why it is not the word "salinity": the pass legitimately contains that word once the gate
         * has spoken -- `"this site has no water.ecw, so salinity does not apply to it"` -- which is the
         * product saying it did NOT compute. A check on the bare word would have called that a defect.
         */
        expect(JSON.stringify(computed)).not.toContain('Salinity class');
    });

    test('a water sample the site owns but the run was NOT given is absent, which is the stand\'s own case', () => {
        // One stand site holds five water samples, all deleted before any of its runs; its runs are given
        // `water=none` and its 7 rows carry a letter all the same. The gate judges the run, not the history.
        const { ran, recorded, computed } = cascadePass({
            search: '?water=none&soil=none&tissue=none',
            rows: { water: LOW_SALINITY }, water: LOW_READING,
        });

        expect(ran).not.toContain('water-blender');
        expect(entryFor(recorded, 'water').missing).toEqual(['samples.water']);
        expect('water' in computed).toBe(false);
    });

    /**
     * THE SECOND OUTCOME, PINNED WHERE IT LIVES -- INSIDE THE ENGINE -- AND NOT CLAIMED TO BE CLOSED.
     *
     * The gate above asks whether the run was given a WATER TEST. It does not ask whether that test carries
     * the reading the engine reads, and the engine substitutes for two of them: `safeNum(e.water.ecw, 0)`
     * and `safeNum(e.water.pH, 7)`. A water test with no pH in it therefore still yields a Langelier index
     * of 0.00 and "Balanced", composed on a 7 that nobody measured.
     *
     * THE NUMBERS. Of 9 live water tests, 1 carries no pH (`Russley`, sampled 19.07.2026, `EC` and `Na`
     * only); every run of that site reads its other test, so no stored row prints a substituted pH today.
     * The path is open and the input for it exists.
     *
     * WHY THIS SET DOES NOT CLOSE IT, measured rather than argued. The obvious closure is to declare the two
     * readings as requirements -- the second kind of name the gate already understands, the way
     * `salinity-penalty-engine` declares `water.ecw`. That kind is judged against the RUN'S STATE, and the
     * run's state is not a mirror of the sample: of the 13 stored rows of a site that HAS a water test
     * (`Hoxton Soccer - Kate's test`), 8 record `water.ecw` as absent. Declaring it would therefore have
     * switched the water section off on runs of sites that do have a test. Closing this outcome means
     * deciding where the engine reads its readings from, which is a decision about the calculation.
     *
     * SO WHAT IS ASSERTED HERE is the substitution itself, by the values it puts on the screen. Nothing here
     * says those values are right; they are pinned so that they cannot change or spread unnoticed, and so
     * that the day the reading is required, this case is what has to be rewritten.
     */
    test('THE OPEN HALF: a water reading that is absent is answered on a substituted number', () => {
        const bench = load();
        if (bench.failed.length) throw new Error('the bench did not load: ' + JSON.stringify(bench.failed));
        const letter = bench.ctx.waterEngine({ water: { ions: { Na: 12 } } });
        const flat = String(letter).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

        process.stdout.write('[gh794] the engine, given a water input with neither conductivity nor pH, states:'
            + '\n[gh794]   ' + JSON.stringify(flat.slice(0, 120))
            + '\n[gh794]   and further down: ' + JSON.stringify((flat.match(/Actual pH: [^|]*/) || [''])[0].trim())
            + '\n');

        // It answers at all, which is the outcome: no reading, and a verdict nonetheless.
        expect(typeof letter).toBe('string');
        // The two substituted numbers, by what they print. A change to either turns this case red.
        expect(flat).toContain('Salinity class: Low salinity risk');
        expect(flat).toContain('Actual pH: 7.0');
        expect(flat).toContain('pHs (saturation pH): 7.00');
    });

    test('a water sample with nothing readable in it: not applicable, and honestly so', () => {
        /**
         * THE ADDRESS CARRIES THE ROW ID AND THE STORE KEEPS IT IN `serverId` -- measured, not assumed: a row
         * given only an `id` answers `not-found`, and the gate then OPENS on purpose (`hub-orchestrator.js`,
         * `if (told === 'not-found') return true;`), because a sample that has not arrived yet is delivery,
         * not an absence. A case built that way would have run the engine and blamed this item for it.
         */
        const rows = { water: { id: 'sample_144', serverId: 144, rawData: { somethingNobodyDeclared: 1 } } };
        const { ran, recorded, bench } = cascadePass({ search: '?water=144&soil=none&tissue=none', rows: rows });

        process.stdout.write('[gh794] a sample with nothing declared in it -> the named sample is '
            + (typeof bench.ctx.gaip_namedSample('water') === 'object' ? 'the row itself'
                : JSON.stringify(bench.ctx.gaip_namedSample('water')))
            + ', the reader answers ' + JSON.stringify(bench.ctx.gaip_sampleReadings('water'))
            + ', water-blender ran: ' + (ran.indexOf('water-blender') > -1) + '\n');

        expect(ran).not.toContain('water-blender');
        expect(entryFor(recorded, 'water').missing).toEqual(['samples.water']);
    });

});
