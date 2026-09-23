/**
 * GH-575 — THE CHAIN, WALKED WHOLE.
 *
 * WHY THIS FILE EXISTS, and it is the point rather than the fix. Three defects
 * were found on this chain in one evening, each one only after the previous had
 * been repaired and the next Re-run still showed nothing:
 *
 *   1. measurements stored as text, so the engine threw  (GH-574);
 *   2. `CEC` with no path from the sample                (GH-574);
 *   3. the cascade's results reaching nobody             (GH-575).
 *
 * Every one of them had tests. Every one of those tests passed. They tested
 * LINKS — this function returns the right thing, that file writes the right
 * shape — and nothing tested the CHAIN, so a break between two sound links was
 * invisible until a person opened the page. That is the class recorded as
 * that class in a chain of data instead of a chain of rules: a tool guards what
 * its author declared, and what nobody declared is guarded by nobody. Named by
 * its shape rather than by a number — the numbering of the open questions was
 * regrouped on 23.09.2026 and a number in a comment ages in silence, which is
 * the same defect as an address without an anchor.
 *
 * So this walks it: the sample's own numbers in at one end, the nutrient rows
 * out at the other, through the real cascade adapter, the real engine and the
 * real hub state. It names each link it crossed, so a green run says which
 * links it saw rather than only that it was happy.
 *
 * WHAT IT CANNOT REACH, said plainly rather than left as a gap: links 3 and 4 —
 * the sample being written into the `/hub` form fields and read back out of them
 * by `collectGridValues` — need a page with real inputs. The bench has a DOM
 * stub, so this file enters the chain at link 5, with the values the form would
 * have produced. Those two links are exercised on a live press and nowhere else,
 * and that is a hole this file does not fill.
 */

'use strict';

const { load } = require('./lib/orchestrator-bench');

/** `samples` id 141, Test5 - NZ, as the column holds it after GH-574. */
const SAMPLE = {
    B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16,
    Fe: 168, Mg: 129, Mn: 28.3, OM: 3.7, Zn: 5.7, pH: 6, CEC: 5.9,
};

const CASCADE_STATE = {
    inputs: {
        climate: { lat: -43.5, lon: 172.5 },
        turf: {
            warmBase: '', percentC3Cover: 100, construction: 'native_soil',
            species: 'Perennial Ryegrass', grassSpecies: 'perennialRyegrass',
        },
        soil: { methodology: 'ammonium_acetate', ppm: SAMPLE, CEC: 5.9, pH_water: 6, bulkDensity: 1.4 },
        water: {}, schedule: {}, site: {},
    },
    computed: {}, derived: {},
};

jest.setTimeout(60000);

describe('GH-575 — from the sample to the nutrient rows, every link', () => {
    let bench, cascadeComputed, hubComputed;

    beforeAll(() => {
        bench = load();
        // Link 0, the positive control this whole file rests on: a bench where
        // a script failed to load answers every question below with silence.
        expect(bench.failed).toEqual([]);

        const result = bench.ctx.GilbaCascadeOrchestrator.runCascade(CASCADE_STATE, {}, { fullRecompute: true });
        cascadeComputed = (result && result.state && result.state.computed) || {};
        hubComputed = bench.ctx.GaipOrchestrator.getState().computed;

        process.stdout.write('[chain] cascade produced: '
            + JSON.stringify(Object.keys(cascadeComputed).sort()) + '\n');
        process.stdout.write('[chain] hub state holds : '
            + JSON.stringify(Object.keys(hubComputed).sort()) + '\n');
    });

    test('link 5→6: the engine is reached, and it answers with rows', () => {
        // The sample's numbers go in as the form would have supplied them.
        expect(typeof cascadeComputed.mlsn).toBe('string');
        expect(cascadeComputed.mlsn.length).toBeGreaterThan(1000);
        expect(Array.isArray(cascadeComputed.mlsnRows)).toBe(true);
        expect(cascadeComputed.mlsnRows.map((r) => r.nutrient))
            .toEqual(['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B']);
    });

    test('link 6→7: the rows carry the sample’s own numbers, not placeholders', () => {
        // A row per nutrient is not the same as a row that knows anything. K is
        // 40 in the sample and must be 40 here.
        const by = (n) => cascadeComputed.mlsnRows.filter((r) => r.nutrient === n)[0];
        expect(parseFloat(by('K').actual)).toBeCloseTo(40, 1);
        expect(parseFloat(by('Ca').actual)).toBeCloseTo(803, 1);
        expect(parseFloat(by('P').actual)).toBeCloseTo(40, 1);
        by === undefined && expect(true).toBe(false);
    });

    test('link 8: the cascade’s results reach the state the rest of the run reads', () => {
        // THE BREAK THIS TICKET IS ABOUT. `hub-persistence.js` builds the stored
        // result out of `GAIP_STATE`, which is the hub orchestrator's state. The
        // cascade used to build a local object and hand it back to nobody, so
        // twelve results a run were dropped — `mlsn` among them.
        expect(hubComputed.mlsn).toBe(cascadeComputed.mlsn);
        expect(hubComputed.mlsnRows).toBe(cascadeComputed.mlsnRows);
    });

    test('link 8: and nothing the cascade made is dropped on the way', () => {
        // Named as a set rather than one key, because one key arriving is what
        // this looked like for months.
        const lost = Object.keys(cascadeComputed).filter((k) => !(k in hubComputed));
        expect({ resultsTheCascadeMadeAndNobodyKept: lost })
            .toEqual({ resultsTheCascadeMadeAndNobodyKept: [] });
    });

    test('link 8: a result the hub computed itself is not replaced, and the swap is said out loud', () => {
        // The orchestrator is the primary and computes its own `shade`, `wear`
        // and `stressTrajectory`. Overwriting them with another pass's would
        // swap what reaches the row today, silently. It fills gaps only — and a
        // key it declined is recorded rather than forgotten.
        const hub = bench.ctx.GaipOrchestrator.getState();
        hub.computed.firmness = { mine: true };
        const out = bench.ctx.GaipOrchestrator.mergeComputed({ firmness: { theirs: true }, brandNew: 1 });

        expect(hub.computed.firmness).toEqual({ mine: true });
        expect(out.kept).toContain('firmness');
        expect(out.added).toContain('brandNew');
        expect((hub.computed.warnings || []).some((w) => /already had/.test(w.message || ''))).toBe(true);
    });

    test('link 9: the producer builds nutrient rows out of what the hub state now holds', () => {
        // The last link this bench can reach. The producer reads
        // `GAIP_STATE.computed.mlsnRows`; the rows are there now, so the cards
        // have something to be built from.
        expect(Array.isArray(hubComputed.mlsnRows)).toBe(true);
        expect(hubComputed.mlsnRows.length).toBe(10);
        const producer = require('fs').readFileSync(
            require('path').join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');
        expect(producer).toMatch(/_gaipState\.computed\.mlsnRows/);
    });

    test('the walk says which links it crossed, so a green run is not mistaken for a whole chain', () => {
        // A tool that prints "fine" without printing what it looked at is
        // indistinguishable from one that never got there.
        const crossed = [
            '5 cascade state -> engine inputs',
            '6 mlsnEngine -> nutrientResults',
            '7 engine -> cascade computed.mlsn / mlsnRows',
            '8 cascade computed -> hub state computed',
            '9 hub state -> producer reads mlsnRows',
        ];
        process.stdout.write('[chain] links crossed by this file:\n  ' + crossed.join('\n  ') + '\n');
        process.stdout.write('[chain] links NOT crossed: 1 db payload, 2 api -> sample manager, '
            + '3 sample -> hub form fields, 4 form fields -> domState.soil.ppm, '
            + '10 POST -> analysis_results, 11 row -> screen\n');
        expect(crossed).toHaveLength(5);
    });
});
