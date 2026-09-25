/**
 * GH-559 — WHY `soilTemp` IS NULL IN THIRTEEN STORED ROWS OUT OF FOURTEEN.
 *
 * THE FINDING THAT RAISED IT. Applying GH-557's rule to the rows on the stand
 * would turn all fourteen `complete` rows into `partial`, and eleven of them for
 * one key alone: `soilTemp`. The schema declares it required; it has a value in
 * exactly ONE row — `Federal Golf / migrated-8`, 20.1 — and that row predates
 * the current producer.
 *
 * The question is not "is it required" but "is it computed", and those are
 * answered in different places. So: run the engines, look at what each place
 * holds, and see which of them the metric is read from.
 *
 * NO LIVE TEST, NO STAND WRITE. The bench (`tests/lib/orchestrator-bench.js`)
 * runs the page's own scripts; the stand appears only as numbers read with
 * SELECT and written down here.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, computeAll } = require('./lib/orchestrator-bench');

const FIXTURE = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'q31-federal-golf-climate.json'), 'utf8'));

const FEDERAL_GOLF = {
    turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
    site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
};

/**
 * Read from the stand with SELECT on 22.09.2026, and written down rather than
 * queried, because a test must not depend on a database.
 */
const STAND = {
    rows: 14,
    soilTempNull: 13,
    theOneWithAValue: { id: 2, runId: 'migrated-8', soilTemp: 20.1, metricKeys: ['et', 'gdd', 'soilTemp', 'timestamp', 'growthPotential'] },
    // Both fresh rows: the metric is null and the physics block is present.
    fresh: [
        { id: 13, site: 'Federal Golf', metricSoilTemp: null, physicsCurrent100mm: 18.2 },
        { id: 14, site: 'Russley', metricSoilTemp: null, physicsCurrent100mm: 10.5 },
    ],
    // `computed.soilTempPhysics.summary.depths` in rows 13 and 14.
    physicsDepthKeys: {
        '20mm': 'current + mean', '50mm': 'current + mean',
        '100mm': 'current + mean', '200mm': 'current + mean',
    },
    // `computed.climate.soilTemp` in rows 2, 13 and 14: absent in all three.
    climateSoilTemp: 'ABSENT',
};

jest.setTimeout(60000);

describe('GH-559 — the value is computed', () => {
    test('the physics model produces a soil temperature, and the stored rows carry it', () => {
        // Not an argument from the code: these are the numbers in the rows. The
        // engine ran and its answer is in the database — under another name.
        STAND.fresh.forEach((r) => {
            expect(typeof r.physicsCurrent100mm).toBe('number');
            expect(r.metricSoilTemp).toBeNull();
        });
    });

    test('the depth keys the model emits are the ones the rows carry', () => {
        // Taken from the stored rows rather than from a bench run: the bench
        // does NOT reproduce the physics model — measured below — so the only
        // honest source for what the model emits is what it emitted.
        expect(Object.keys(STAND.physicsDepthKeys)).toEqual(['20mm', '50mm', '100mm', '200mm']);
        expect(STAND.physicsDepthKeys['100mm']).toBe('current + mean');
    });

    test('the bench does NOT reproduce the physics model, and says so rather than answering', async () => {
        // A boundary, not a finding. The model needs more of a page than a
        // stubbed DOM gives it, so every claim here about the model comes from
        // the stand's rows; the branch measurements below need no model at all,
        // which is why they are the ones that carry this file.
        const bench = load();
        await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));

        const soil = bench.ctx.GAIP_SOIL_TEMP;
        process.stdout.write('[q31] bench GAIP_SOIL_TEMP: '
            + JSON.stringify(soil && soil.summary && soil.summary.available) + '\n');
        process.stdout.write('[q31] bench canonical soilTemp: '
            + JSON.stringify(bench.ctx.GAIP_CANONICAL_STATE.soilTemp).slice(0, 140) + '\n');

        expect(soil === undefined || !soil.summary || soil.summary.available !== true).toBe(true);
    });
});

describe('GH-559 — and the metric is read from somewhere it is not', () => {
    /** `collectDashboardMetrics` is internal; the export line is spliced, as eleven other files do. */
    function metricsFrom(globals) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');
        const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
        expect(src).toContain(exportLine);
        const testSrc = src.replace(exportLine,
            exportLine + '\n    global.__test_collectDashboardMetrics = collectDashboardMetrics;');

        const sandbox = {
            console: { log() {}, warn() {}, error() {} },
            localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
            setTimeout: () => 0, clearTimeout() {}, Date, Math, JSON, Object, Array, String, Number,
            parseFloat, parseInt, isNaN, isFinite, Promise, URLSearchParams,
            document: { readyState: 'complete', addEventListener() {}, getElementById: () => null,
                        querySelector: () => null, querySelectorAll: () => [],
                        body: { appendChild() {}, removeChild() {} } },
            location: { search: '' },
        };
        sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
        Object.assign(sandbox, globals);
        const ctx = vm.createContext(sandbox);
        vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });

        return ctx.__test_collectDashboardMetrics();
    }

    test('the orchestrator branch now finds the value the run computed', () => {
        // The shape of a modern run: no `global.climateMetrics`, so the
        // collector falls to the orchestrator's computed climate — which does
        // not carry a soil temperature — and then to the model's own global,
        // which does. GH-561 corrected WHERE that is after a live run.
        // GH-734 (delivery 3): the third home was the panel's global and it is gone; the run hands
        // its own result out under `getComputed`, which is what this branch falls to now.
        const m = metricsFrom({
            GaipOrchestrator: {
                getState: () => ({ computed: { climate: { growth: { weighted: 61 }, temperature: { mean: 14.8 } } } }),
                getComputed: (k) => (k === 'soilTempPhysics'
                    ? { summary: { available: true, depths: { '100mm': { current: 18.2 } } } } : null),
            },
        });

        process.stdout.write('[q31] metrics.soilTemp on the orchestrator branch: ' + JSON.stringify(m.soilTemp) + '\n');
        expect(m.soilTemp).toBe(18.2);
        expect(m.growthPotential).toBe(61);
    });

    test('MEASUREMENT: given the key it looks for, it reads a number', () => {
        // The positive control for the case above: the collector is not broken,
        // it is looking in a place nothing fills.
        const m = metricsFrom({
            GaipOrchestrator: {
                getState: () => ({
                    computed: {
                        climate: {
                            growth: { weighted: 61 }, temperature: { mean: 14.8 },
                            soilTemp: { depths: { d100mm: 17.3 } },
                        },
                    },
                }),
            },
        });
        expect(m.soilTemp).toBe(17.3);
    });

    test('both spellings of the depth are read, and neither invents one', () => {
        // `100mm` against `d100mm` — the mine that would have gone off the day
        // the overwrite was fixed, leaving a repair that looks finished. Both
        // are read; a source with neither still yields null.
        const withPhysicsName = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 },
                soilTemp: { depths: { '100mm': { current: 18.2 } } },
            } } }) },
        });
        expect(withPhysicsName.soilTemp).toBe(18.2);

        const withCanonicalName = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 },
                soilTemp: { depths: { d100mm: 17.3 } },
            } } }) },
        });
        expect(withCanonicalName.soilTemp).toBe(17.3);

        // Nothing anywhere stays nothing. No default, no estimate, no falling
        // back to air temperature — that is what the third outcome is for, and
        // the owner's instruction was explicit: do not repair this with a
        // substitute.
        //
        // Four shapes, because a reader that bails on the first one never
        // reaches the end of the function — measured: a mutation planting `20`
        // as the last statement went UNDETECTED until the object-shaped cases
        // below were added. An absent source and a source that has nothing in it
        // are different paths to the same answer.
        const nothingAtAll = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 },
            } } }) },
        });
        expect(nothingAtAll.soilTemp).toBeNull();

        const emptyObject = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 }, soilTemp: {},
            } } }) },
        });
        expect(emptyObject.soilTemp).toBeNull();

        const emptyDepths = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 }, soilTemp: { depths: {} },
            } } }) },
        });
        expect(emptyDepths.soilTemp).toBeNull();

        // And the depth that exists but was not measured is not rounded up to
        // the depth next to it.
        const otherDepthsOnly = metricsFrom({
            GaipOrchestrator: { getState: () => ({ computed: { climate: {
                growth: { weighted: 61 }, temperature: { mean: 14.8 },
                soilTemp: { depths: { d20mm: 15.1, d200mm: 14.0 } },
            } } }) },
        });
        expect(otherDepthsOnly.soilTemp).toBeNull();

        // Air temperature is right there and must not be used for it.
        expect(nothingAtAll.growthPotential).toBe(61);
    });

    /**
     * GH-561 — WHERE THE PHYSICS RESULT ACTUALLY LIVES, corrected by a live run.
     *
     * GH-560 read it from `GaipOrchestrator.getState().computed.soilTempPhysics`
     * and every bench case agreed, because the bench was handed that shape. The
     * live run on Russley measured `null` anyway: the model is run by
     * `climate-module-v2-ui.js` and its answer NEVER enters the orchestrator's
     * state. `cacheAnalysisResults` copies it into `cache.computed.soilTempPhysics`
     * later in the same function, after this collector has returned — so the row
     * carries the number and the metric beside it is null.
     *
     * The bench agreed with a fixture instead of with the page. These cases use
     * the global the page actually sets.
     */
    /**
     * TURNED OVER BY GH-734 (queue item 3az, delivery 3), and kept rather than deleted.
     *
     * The claim is unchanged: when the climate the collector reads carries no soil temperature, the
     * physics result is still found, and a summary without the depth asked for yields null rather
     * than something else. What changed is WHERE that result lives. The panel used to publish its own
     * calculation on `GAIP_SOIL_TEMP`, which is how one model came to be computed twice on different
     * inputs; the run computes it once now and hands it out under the orchestrator's own accessor,
     * and the global does not exist any more. So the bench supplies it the way a run does.
     */
    test('GH-734: the run’s own physics result is read when the climate carries nothing', () => {
        const runWith = (depths) => ({
            GaipOrchestrator: {
                getState: () => ({ computed: {
                    climate: { growth: { weighted: 61 }, temperature: { mean: 14.8 } },
                } }),
                getComputed: (k) => (k === 'soilTempPhysics'
                    ? { summary: { available: true, depths: depths } } : null),
            },
        });

        const withPhysics = metricsFrom(runWith({ '100mm': { current: 18.2, mean: 15.0 } }));
        expect(withPhysics.soilTemp).toBe(18.2);

        const physicsWithoutThatDepth = metricsFrom(runWith({ '20mm': { current: 19.9 } }));
        expect(physicsWithoutThatDepth.soilTemp).toBeNull();
    });

    /**
     * TURNED OVER BY GH-734 (queue item 3az, delivery 1 of 3), and kept rather than deleted so the
     * reversal can be read.
     *
     * It asserted that the orchestrator's state NEVER carries the physics result, and it was right
     * about the tree of the day: GH-560 had read a key nothing wrote. The item's whole point is that
     * the run computes the soil temperature once, on its own inputs, and puts it there — so the
     * measurement reverses BY DECISION, and what was a warning ("do not read that key") is now the
     * contract ("that key is where the run's result lives").
     *
     * The second half of the old case still holds and is kept: the metric collector reads the
     * global, because the readers inside the run move in delivery 2 and the global goes in
     * delivery 3. Removing it first would give them nothing for one run (the analyst's 24.3).
     */
    test('GH-734: the orchestrator’s state carries the physics result, and the collector still reads the global', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-orchestrator.js'), 'utf8');
        expect(src).toMatch(/_hubState\.computed\.soilTempPhysics = \{/);
        // The inputs travel with it, or "which moisture was it computed on" has no answer.
        expect(src).toMatch(/inputs: \{\s*\n\s*moisture: soilMoisture,/);

        const producer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');
        const collector = producer.indexOf('function collectDashboardMetrics()');
        expect(collector).toBeGreaterThan(-1);
        const body = producer.slice(collector, collector + 3000);
        expect(body).toMatch(/GAIP_SOIL_TEMP/);
    });

    test('MEASUREMENT: on the live-globals branch it reads a number, which is the one row that has one', () => {
        // `Federal Golf / migrated-8` carries `et` and `gdd` — the signature of
        // the `_cm` branch, which reads `global.climateMetrics`. That branch
        // finds a soil temperature where the other does not, and that row is the
        // only one on the stand with a value.
        const m = metricsFrom({
            climateMetrics: {
                growth: { weighted: 55 }, gdd: { today: 7 }, et: { daily: 3 },
                soilTemp: { estimated: 20.1 },
            },
        });

        process.stdout.write('[q31] metrics.soilTemp on the climateMetrics branch: ' + JSON.stringify(m.soilTemp) + '\n');
        expect(m.soilTemp).toBe(20.1);
        expect(Object.keys(m).sort()).toEqual(STAND.theOneWithAValue.metricKeys.sort());
    });
});

describe('GH-559 — what the stand says, written down', () => {
    test('thirteen of fourteen rows have no soil temperature, and the fourteenth is the old branch', () => {
        expect(STAND.rows - STAND.soilTempNull).toBe(1);
        expect(STAND.theOneWithAValue.soilTemp).toBe(20.1);
        // et + gdd: the `_cm` branch, which is the branch that reads a value.
        expect(STAND.theOneWithAValue.metricKeys).toEqual(expect.arrayContaining(['et', 'gdd']));
    });
});

/**
 * Where the value is lost between being computed and being read.
 *
 * The canonical state holds it under exactly the name the metric asks for —
 * `depths.d100mm` — and `getAuthoritativeClimate()` copies `canonical.soilTemp`
 * onto the climate it returns, which the orchestrator stores as
 * `computed.climate`. On that reading the metric should find it.
 *
 * It does not, and the stored rows say why: `computed.climate` in every row on
 * the stand has the shape of the CLIMATE ENGINE's own output — `growth`,
 * `moisture`, `monthlyTemps`, `_validated` — and not of
 * `getAuthoritativeClimate()`, whose shape is `source`, `humidity`, `dewpoint`,
 * `solar`, `quality`, `soilTemp`. Something replaces it between the two.
 */
describe('GH-559 — where it is lost', () => {
    const CANONICAL_DEPTH_KEYS = ['d20mm', 'd40mm', 'd50mm', 'd100mm', 'd200mm'];

    test('the canonical state holds it under the very name the metric asks for', async () => {
        const bench = load();
        await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));

        const canon = bench.ctx.GAIP_CANONICAL_STATE.soilTemp;
        expect(Object.keys(canon.depths)).toEqual(CANONICAL_DEPTH_KEYS);
        expect(typeof canon.depths.d100mm).toBe('number');
        // So the metric's `soilTemp?.depths?.d100mm` is not a typo — it is the
        // right question asked of the wrong object.
    });

    /**
     * MEASUREMENT, and it corrected the guess it was written to confirm.
     *
     * Step 2 of `computeAll` stores `getAuthoritativeClimate()`, which copies
     * `canonical.soilTemp` onto its result — so the expectation was that the
     * orchestrator's climate carries it and the loss happens later, in the
     * producer. It does not. After a pass, `computed.climate` has the CLIMATE
     * ENGINE's shape and no `soilTemp` at all, which is exactly the shape every
     * row on the stand carries.
     */
    test('after a pass in the bench the climate still has no soilTemp — a boundary, not a result', async () => {
        const bench = load();
        await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));

        const climate = bench.ctx.GaipOrchestrator.getState().computed.climate;
        process.stdout.write('[q31] orchestrator computed.climate keys: '
            + JSON.stringify(Object.keys(climate || {}).sort()) + '\n');

        expect(climate).toBeTruthy();
        // NOT ESTABLISHED, and recorded as such rather than explained: in the
        // bench `getAuthoritativeClimate()` does not take its canonical branch,
        // so the climate it stores has the engine's shape with or without the
        // overwrite. What the overwrite cost is therefore asserted on the source
        // (below) and what the collector now finds is asserted directly (above);
        // this case exists to stop the bench being read as evidence either way.
        expect(climate.soilTemp).toBeUndefined();
        expect(Object.keys(climate)).toEqual(expect.arrayContaining(['growth', 'moisture', 'monthlyTemps']));
    });

    /**
     * WHY, and it is inside the orchestrator rather than in the producer: two
     * state-synchronisation handlers REPLACE `computed.climate` wholesale with
     * the page's `climateMetrics`, discarding everything step 2 had added to it
     * — `soilTemp`, `quality`, `humidity`, `dewpoint`, `solar`.
     *
     * Asserted on the source because it is a sequence of events, not a value:
     * the assignment is `=`, not a merge, and it is the shape that survives.
     */
    test('the page’s climate is merged in, and no longer put in place of the run’s', () => {
        // The measurement that found this read: TWO wholesale replacements,
        // `computed.climate = state.climateMetrics`, discarding everything step
        // 2 had added — `soilTemp`, `quality`, `humidity`, `dewpoint`, `solar`.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-orchestrator.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

        const overwrites = code.match(/_hubState\.computed\.climate = state\.climateMetrics;/g) || [];
        process.stdout.write('[q31] wholesale overwrites of computed.climate: ' + overwrites.length + '\n');
        expect(overwrites.length).toBe(0);

        // Both handlers go through the merge, and the merge keeps what the
        // incoming object does not mention.
        expect((code.match(/mergeClimateFromHub\(state\.climateMetrics\)/g) || []).length).toBe(2);
        const merge = code.slice(code.indexOf('function mergeClimateFromHub'), code.indexOf('function getAuthoritativeClimate'));
        expect(merge).toMatch(/Object\.assign\(\{\}, existing, incoming\)/);
    });

    test('MEASUREMENT: but the shape stored on the stand is not that object', () => {
        // Read with SELECT on 22.09.2026. `getAuthoritativeClimate()` returns
        // `source / humidity / dewpoint / solar / quality / soilTemp`; the rows
        // carry the climate ENGINE's own shape instead, and no `soilTemp`.
        const storedClimateKeys = ['growth', 'stress', '_issues', 'forecast', 'moisture',
            '_timestamp', '_validated', 'temperature', 'monthlyTemps',
            'monthlyTempsPeriod', 'monthlyTempsSource'];

        expect(storedClimateKeys).not.toContain('soilTemp');
        expect(storedClimateKeys).not.toContain('quality');
        expect(storedClimateKeys).toContain('monthlyTemps');
        expect(STAND.climateSoilTemp).toBe('ABSENT');
    });

    test('MEASUREMENT: cacheAnalysisResults takes the orchestrator’s computed and then the page overwrites the climate', () => {
        // The two statements, in order, in the producer. The first copies the
        // orchestrator's computed state — `soilTemp` included. The later ones
        // merge the page's own climate globals over `computed.climate`, and
        // `validateClimateMetrics` has already stripped that object down to the
        // engine's fields. Asserted as an ORDER, because that is the defect.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');

        const copy = src.indexOf('cache.computed = state.computed;');
        const overwrite = src.indexOf('cache.computed.climate.temperature = _liveClimate.temperature;');
        expect(copy).toBeGreaterThan(-1);
        expect(overwrite).toBeGreaterThan(copy);

        // And nothing in the producer ever puts the physics result where the
        // metric looks for it.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/climate\.soilTemp\s*=/);
        /**
         * GH-734: the producer no longer WRITES this key from a global of its own — it narrows the
         * one the run put in `computed` to what the row carries. The old assertion was that the
         * producer writes it; the fact that replaced it is that the producer does not invent it.
         */
        expect(code).not.toMatch(/soilTempPhysics: \{\s*summary:\s*global\.GAIP_SOIL_TEMP/);
        expect(code).toMatch(/cache\.computed && cache\.computed\.soilTempPhysics/);
    });
});
