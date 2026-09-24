/**
 * GH-626/628 — THE PRODUCER IS ASKED WHAT IT CALLS EACH READING, ACROSS THE
 * WHOLE DECLARED UNIVERSE, AND THE JUDGE STOPS GUESSING FROM SPELLING.
 *
 * WHY. The restoration judge compares a sample's readings with the stored row
 * by name. Two kinds of rename break that, and both were producing false
 * findings:
 *
 *   `Na`  — the same reading under another name. The row calls it `soilNa`, and
 *           on `Burns` both are 11.5. The judge called it a reading the row had
 *           lost, on a row that carries it.
 *   `EC`  — a DERIVED field. The row carries `ECe`, which is EC(1:5) times a
 *           texture factor of five to ten. Comparing those for equality would
 *           have reported a sevenfold disagreement about a correct row. 41 of
 *           the 48 live soil samples carry EC, so this one was waiting.
 *
 * NOTHING IS WRITTEN DOWN (the analyst's 9.6/9.7, and its point). A hand-written
 * `{Na: 'soilNa'}` is a second place the name lives, and second places drift.
 * So the correspondence is measured from the producer's behaviour: change one
 * reading IN THE SAMPLE'S LAB ROW, run the whole chain offline, see which field
 * of the stored row moved and by how much.
 *
 * WHAT GH-628 CHANGED HERE, AND WHY IT HAD TO. This set used to shift a field of
 * the READY soil state through `withPh`/`withNa`/`withK`/`withEc` helpers. Those
 * helpers WERE the second table, one link earlier: they said which state field
 * carries which reading. Two things followed. `withEc` computed `ECe = v * 7`
 * itself and the set then asserted that `ECe` is derived with a factor of five to
 * ten — both sides from the same author, so removing the product's own `ECe`
 * calculation would have left this green. And the universe was three readings
 * chosen by hand out of fifteen.
 *
 * Now: the universe is `readingKeysFor('soil')` — declared, 15 readings — the
 * shift happens in the lab row, and the chain runs whole, through the product's
 * own reader and its own assembly (`gaip_soilStateFrom`, extracted by GH-628 for
 * exactly this reason). The map is built ONCE PER PROCESS.
 *
 * COST, MEASURED AND PRINTED BY THE FIRST CASE BELOW: 16 chain runs, under a
 * second. That is what decided there is no cache and no map file in the tree.
 */

'use strict';

const { producerNameMap, universe, baseRow, surfaceForRow, numbersOf } = require('./lib/producer-name-map');
const { judge } = require('./lib/row-vs-sample');
const { load } = require('./lib/orchestrator-bench');

const say = (s) => process.stdout.write('[gh628] ' + s + '\n');

let MAP;
let KEYS;
let REPORT;

beforeAll(() => {
    REPORT = producerNameMap({ say });
    MAP = REPORT.map;
    KEYS = REPORT.keys;
});

describe('GH-628 — what the producer calls each reading, measured over the declared universe', () => {
    jest.setTimeout(300000);

    test('POSITIVE CONTROL: the chain reaches the producer, and pH comes back as itself', () => {
        // The analyst's condition for trusting anything else here. If this
        // fails the answer is "the chain did not get as far as the producer",
        // and there is no fallback map to fall back on. It prints the subject,
        // not only the verdict: a map that reached three readings and a map
        // that reached fifteen are otherwise indistinguishable from outside.
        say('reached ' + Object.keys(MAP).length + ' readings in ' + REPORT.runs
            + ' chain runs, ' + REPORT.ms + ' ms');
        say('verdicts: ' + KEYS.map((k) => k + '->' + ((MAP[k] && MAP[k].field) || 'absent')
            + '/' + (MAP[k] ? MAP[k].kind : 'not measured')).join(' '));

        expect(MAP.pH.kind).toBe('same');
        expect(MAP.pH.field).toBe('pH');
        expect(MAP.pH.moved).toBeCloseTo(MAP.pH.delta, 6);
    });

    test('the universe is the DECLARED one, not a choice: every reading readingKeysFor names gets a verdict', () => {
        // The guard against the shape this set had before: three readings
        // picked by hand. A reading added to `SOIL_FIELD_MAP` is measured
        // without anyone remembering, and a reading removed from it stops
        // being claimed.
        const declared = universe();
        expect(KEYS).toEqual(declared);
        expect(Object.keys(MAP).sort()).toEqual(declared.slice().sort());
        expect(declared.length).toBeGreaterThanOrEqual(15);
    });

    test('and it says which readings the row does NOT carry, by name', () => {
        // Named rather than counted. `OM` is absent from the stored row today —
        // GH-615 put it into the run, and whether the row states it is the
        // owner's open half — so this is the honest boundary of the map, not a
        // hole in it.
        const absent = KEYS.filter((k) => MAP[k] && MAP[k].kind === 'absent');
        say('the row does not carry: ' + JSON.stringify(absent));
        expect(absent).toEqual(['OM']);
    });

    test('sodium is the same reading under another name, and the name is measured', () => {
        expect(MAP.Na.kind).toBe('same');
        expect(MAP.Na.field).toBe('soilNa');
        expect(MAP.Na.moved).toBeCloseTo(MAP.Na.delta, 6);
    });

    test('EC is DERIVED, and the factor is the texture multiplier the PRODUCT applies', () => {
        // The case that could not be measured before GH-628: the `ECe`
        // calculation lives in the assembly, which a hand-written soil state
        // skips. Shifting the lab row runs it, so this asserts the product's
        // arithmetic and not the test's own.
        expect(MAP.EC.kind).toBe('derived');
        expect(MAP.EC.field).toBe('ECe');
        const factor = MAP.EC.moved / MAP.EC.delta;
        say('EC factor measured: ' + factor);
        // A RANGE, because the factor is a property of the texture table, not
        // of this case: five for sand, ten for clay, seven for the loam the
        // bench states.
        expect(factor).toBeGreaterThanOrEqual(5);
        expect(factor).toBeLessThanOrEqual(10);
    });

    test('CEC keeps its name, and each of the ten nutrients keeps its own inside the card list', () => {
        // Under its OWN name, not a path: the row's card says `{nutrient: 'K'}`
        // and the screen prints `K`, so a map answering `nutrients.K` would send
        // the judge looking for a field nothing has. It did, until this run
        // measured it — ten nutrients reported lost on a row carrying them.
        expect(MAP.CEC).toMatchObject({ kind: 'same', field: 'CEC' });
        ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'].forEach((n) => {
            expect(MAP[n]).toMatchObject({ kind: 'same', field: n });
        });
    });

    test('built once per process: the second caller pays nothing and gets the same object', () => {
        // The cost is 16 chain runs. A live probe that presses a button must not
        // pay it per press — the map is a property of the producer, not of the
        // site or the press.
        const again = producerNameMap();
        expect(again).toBe(REPORT);
        expect(again.runs).toBe(REPORT.runs);
    });
});

describe('GH-628 — and the judge, handed that map, stops calling a carried reading lost', () => {
    test('a name change and a derived field, against the judge itself', () => {
        // The whole point, stated against the judge. Without the map it reports
        // `Na` missing from a row that carries it under `soilNa`, and `EC`
        // missing from a row that carries `ECe`.
        const surface = { pH: '6.0', soilNa: '11.5', ECe: '1.12', K: '40.0' };
        const readings = { pH: 6, Na: 11.5, EC: 0.16, K: 40 };

        const blind = judge(surface, readings);
        expect(blind.dropped.sort()).toEqual(['EC', 'Na']);

        const measured = judge(surface, readings, MAP);
        expect(measured.dropped).toEqual([]);
        expect(measured.disagreed).toEqual([]);
        expect(measured.derived).toEqual(['EC']);
        expect(measured.derivedMissing).toEqual([]);
    });

    test('a derived field the row does not state is still reported missing', () => {
        // Presence is the one thing asked of a derived field, and it is asked.
        const out = judge({ pH: '6.0' }, { pH: 6, EC: 0.16 }, MAP);
        expect(out.derivedMissing).toEqual(['EC']);
    });

    test('a reading the producer does not carry is judged by its own name, as before the map', () => {
        // `OM` comes back `absent`, and an absent verdict must not quietly
        // become a field name: the judge falls back to the reading's own name,
        // so a row missing organic matter still says so.
        const out = judge({ pH: '6.0' }, { pH: 6, OM: 3 }, MAP);
        expect(out.dropped).toEqual(['OM']);
    });
});

describe('GH-628 — the judge against a REAL producer surface, not an invented one', () => {
    // THE REVIEWER'S POINT, AND IT IS WHY THIS EXISTS. The cases above hand the
    // judge a surface written here — `{pH: '6.0', soilNa: '11.5', …}` — so they
    // measure whether the map is PASSED, not whether it is RIGHT. A measurement
    // that broke and returned an empty map, or the wrong field, would leave them
    // green. So the judge is run against the surface the producer actually
    // builds, from the same lab row the map was measured from.
    //
    // THE BOUNDARY, NAMED: this is the STORED row's surface, not the screen's.
    // The live probe compares what the page prints, and no offline set can
    // reach that. What is executed here is the half that does not need a press.
    jest.setTimeout(300000);

    let surface;
    let readings;

    beforeAll(() => {
        const row = baseRow(universe());
        const bench = load();
        readings = bench.ctx.GAIP_SampleManager.readingsOf('soil', { values: row });
        surface = numbersOf(surfaceForRow(row));
        say('the producer surface carries: ' + JSON.stringify(Object.keys(surface)));
        say('the sample measured: ' + JSON.stringify(Object.keys(readings)));
    });

    test('POSITIVE CONTROL: both sides are real and non-trivial', () => {
        // Without this, every verdict below could be a verdict about two empty
        // objects, and empty agrees with empty.
        expect(Object.keys(readings).length).toBe(15);
        expect(Object.keys(surface).length).toBeGreaterThan(10);
    });

    test('handed the measured map, the judge finds no disagreement and loses only what the row does not carry', () => {
        const out = judge(surface, readings, producerNameMap().map);
        say('with the map: ' + JSON.stringify(out));

        expect(out.disagreed).toEqual([]);
        // `OM` by name, not by silence: the row does not carry organic matter,
        // which is the owner's open half of GH-615. This case MUST go red the
        // day she decides the row must carry it — that is what it is for.
        expect(out.dropped).toEqual(['OM']);
        expect(out.derived).toEqual(['EC']);
        expect(out.derivedMissing).toEqual([]);
    });

    test('and the map CHANGES that verdict — an empty one loses two readings the row carries', () => {
        // The reviewer named both outcomes in advance, and this is the measured
        // one: the map is not decoration on this data. Were it green, the honest
        // reading would be that the work changes nothing on today's data — a
        // finding, not a success.
        const blind = judge(surface, readings);
        say('with no map: ' + JSON.stringify(blind.dropped));

        expect(blind.dropped).toEqual(['EC', 'OM', 'Na']);
        expect(blind.derived).toEqual([]);
    });

    test('the DERIVED kind is what keeps `EC` out of the disagreement list, and swapping it proves the kind is used', () => {
        // `ECe` is `EC` times the texture factor: judged as the same reading, it
        // disagrees by sevenfold. This asserts that the distinction reaches the
        // verdict instead of merely being recorded in the map.
        const asSame = JSON.parse(JSON.stringify(producerNameMap().map));
        asSame.EC.kind = 'same';
        const out = judge(surface, readings, asSame);
        say('EC judged as the same reading: disagreed=' + JSON.stringify(out.disagreed)
            + ' (row ' + surface.ECe + ' against sample ' + readings.EC + ')');

        expect(out.disagreed).toEqual(['EC']);
    });
});
