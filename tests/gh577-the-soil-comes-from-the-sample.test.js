/**
 * GH-577 — THE SOIL VALUES COME FROM THE SAMPLE, NOT FROM THE PAGE.
 *
 * `gaip_build_state()` read the `/hub` soil grid with `collectGridValues`, and
 * that was its only source. Measured with a probe inside the runner's own frame
 * on 22.09.2026: the sample IS written into those fields — K 40, P 40, Ca 803,
 * Mg 129, S 75, Fe 168, Mn 28.3, Cu 1.3, Zn 5.7, B 0.2 — but 2,091 ms after the
 * press, and the state is built before that. The engine was handed an empty
 * `ppm`, answered with ten rows of "NOT MEASURED", and the owner was shown ten
 * dashes where her lab values belong.
 *
 * The race is the symptom. The page read is the defect — the class the project
 * banned after GH-459, where the same shape printed one site's climate under
 * another site's name with every annual total still matching. Waiting for the
 * fields to fill would have cured the symptom and kept the defect.
 *
 * HOW THIS FILE BITES: empty the form and leave the sample in place — which is
 * the state the runner is really in at the moment it builds. Read the page and
 * every value is missing; read the sample and they are all there.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { stubSampleManager } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');

/** `samples` id 141, Test5 - NZ, as the store holds it. */
const SAMPLE_141 = {
    B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16,
    Fe: 168, Mg: 129, Mn: 28.3, OM: 3.7, Zn: 5.7, pH: 6, CEC: 5.9,
};

/**
 * `gaip_build_state` and its new helper, lifted out of the real file and run.
 *
 * They are top-level function declarations, so the file is executed in a
 * context with the globals they touch and the two are taken off it. The
 * assertion that both are functions is the positive control: a rename would
 * otherwise leave every case below testing an empty sandbox.
 */
function buildState({ sample, formValues }) {
    const fields = {};
    Object.keys(formValues || {}).forEach((k) => { fields['[data-mlsn="' + k + '"]'] = String(formValues[k]); });

    const el = (value) => ({ value, checked: false, dataset: {} });
    const gridNodes = Object.keys(formValues || {}).map((k) => ({
        value: String(formValues[k]), dataset: { mlsn: k }, getAttribute: () => k,
    }));

    const container = {
        querySelector: (sel) => {
            if (sel === '.gaip-soil-grid') {
                return { querySelectorAll: () => gridNodes };
            }
            return null;
        },
        querySelectorAll: () => [],
    };

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            querySelector: (sel) => (sel === '.gaip-soil-grid' ? { querySelectorAll: () => gridNodes } : null),
            querySelectorAll: () => [],
        },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    // GH-591: the stub carries the PRODUCT's normaliser. The reader takes its
    // readings through `GAIP_SampleManager.readingsOf` now, so a hand-written
    // stub of the sample manager would be a bench testing its own name table —
    // which is exactly the defect that cost a measured pH on the stand.
    sandbox.GAIP_SampleManager = stubSampleManager(sample ? { soil: sample } : {});

    const ctx = vm.createContext(sandbox);
    // Only the two functions this file is about, so a change elsewhere in a
    // 9,000-line file does not decide whether this test can run.
    const slice = (name) => {
        const at = SRC.indexOf('function ' + name + '(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0, i = SRC.indexOf('{', at);
        for (let j = i; j < SRC.length; j++) {
            if (SRC[j] === '{') depth++;
            else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(at, j + 1); }
        }
        throw new Error('unbalanced ' + name);
    };
    vm.runInContext(slice('safeNum'), ctx, { filename: 'safeNum' });
    vm.runInContext(slice('collectGridValues'), ctx, { filename: 'collectGridValues' });
    vm.runInContext(slice('gaip_soilFromActiveSample'), ctx, { filename: 'gaip_soilFromActiveSample' });
    expect(typeof ctx.collectGridValues).toBe('function');
    expect(typeof ctx.gaip_soilFromActiveSample).toBe('function');

    return { ctx, container };
}

describe('GH-577 — where the soil block gets its numbers', () => {
    test('the sample reader returns the sample’s own values', () => {
        const { ctx } = buildState({ sample: SAMPLE_141, formValues: {} });
        const soil = ctx.gaip_soilFromActiveSample();

        expect(soil).not.toBeNull();
        expect(soil.ppm).toEqual({ P: 40, K: 40, Ca: 803, Mg: 129, S: 75, Fe: 168, Mn: 28.3, Zn: 5.7, Cu: 1.3, B: 0.2 });
        expect(soil.pH_water).toBe(6);
        expect(soil.CEC).toBe(5.9);
        expect(soil.OM).toBe(3.7);
    });

    test('THE LIVE CASE: the form is empty and the values are there anyway', () => {
        // The state the runner is really in 2,091 ms before the fields fill.
        const { ctx, container } = buildState({ sample: SAMPLE_141, formValues: {} });

        // What the page would have given: nothing.
        expect(ctx.collectGridValues.call(ctx, '.gaip-soil-grid', 'data-mlsn')).toEqual({});
        // What the sample gives: everything.
        const soil = ctx.gaip_soilFromActiveSample();
        expect(Object.keys(soil.ppm)).toHaveLength(10);
        expect(soil.ppm.K).toBe(40);
        expect(soil.ppm.Ca).toBe(803);
        container === undefined && expect(true).toBe(false);
    });

    test('a nutrient the sample does not carry stays absent — the form does not fill it', () => {
        // The rule this repair had to be careful of. A value on the page that
        // is not in the sample came from somewhere else, and putting it in
        // would be exactly the plausible-looking number this question removes.
        const without = Object.assign({}, SAMPLE_141);
        delete without.Ca;
        const { ctx } = buildState({ sample: without, formValues: { Ca: '999' } });

        const soil = ctx.gaip_soilFromActiveSample();
        expect(soil.ppm.Ca).toBeUndefined();
        expect(soil.ppm.K).toBe(40);
    });

    test('with no sample at all the reader says so — and since GH-589 nothing takes over', () => {
        const { ctx } = buildState({ sample: null, formValues: { K: '55' } });
        expect(ctx.gaip_soilFromActiveSample()).toBeNull();
        // GH-577 ended here with "and the form stays the source", asserting that
        // the grid would have answered K 55. The grid still would — it is filled
        // from the store, which is the whole reason that fallback looked
        // harmless — but GH-589 took it out of `gaip_build_state`, so a run
        // with no sample now carries no readings and says why. That claim is
        // executed in `gh589-the-pass-comes-after-the-inputs.test.js`, against
        // the built state rather than against this helper.
        expect(ctx.collectGridValues.call(ctx, '.gaip-soil-grid', 'data-mlsn')).toEqual({ K: 55 });
    });

    test('an empty sample is not a sample', () => {
        const { ctx } = buildState({ sample: {}, formValues: { K: '55' } });
        expect(ctx.gaip_soilFromActiveSample()).toBeNull();
    });

    test('the soil block consults the sample for every reading it has', () => {
        // Structural, over the real source: each reading that was subject to the
        // same race consults the sample. GH-589 added EC to the list and removed
        // the form from the other side of every one of them, so this no longer
        // asserts what happens WITHOUT a sample — that is executed in
        // `gh589-the-pass-comes-after-the-inputs.test.js` against the built
        // state.
        // Anchored on the line itself, not on "the soil block": this file has
        // two `soil: {` literals and the other one belongs to the cascade
        // transform.
        const at = SRC.indexOf('ppm: _gaipSoilSample ?');
        expect(at).toBeGreaterThan(-1);
        const block = SRC.slice(at - 400, at + 1400);
        expect(block).toMatch(/ppm: _gaipSoilSample \? _gaipSoilSample\.ppm :/);
        expect(block).toMatch(/pH_water: _gaipSoilSample \? _gaipSoilSample\.pH_water :/);
        expect(block).toMatch(/CEC: _gaipSoilSample \? _gaipSoilSample\.CEC :/);
        expect(block).toMatch(/EC1_5: _gaipSoilSample \? _gaipSoilSample\.EC :/);
    });

    test('GH-591: a sample that carries `normalized` still gives up its pH', () => {
        // THE CASE THAT WAS MISSING, and its absence cost a measured value on the
        // stand. Every case above hands the reader a sample with `rawData` only.
        // A sample the store has actually loaded ALSO carries `normalized`, and
        // the reader preferred it — where soil pH is keyed `soil_ph`, because the
        // normaliser derives the key from the form selector and pH is
        // deliberately absent from the three canonical-key overrides
        // (`sample-manager.js`, b35fix409). `CEC` IS overridden. So the store's
        // own sample answered CEC and not pH, and the bench never noticed
        // because the bench's samples had no `normalized` at all.
        //
        // Measured: `analysis_results` row 53, `Test5 - NZ`, 23.09.2026 —
        // ten nutrients restored, `pH: null`, over a payload saying `pH: 6`.
        const stored = Object.assign({}, SAMPLE_141);
        const { ctx } = buildState({ sample: stored, formValues: {} });
        // The shape the real normaliser produces for this row: lossy keys, pH
        // under `soil_ph`, and it must not become the source.
        const withNormalized = {
            id: 'sample_141',
            rawData: stored,
            normalized: { soil_ph: 6, CEC: 5.9, EC: 0.16, OM: 3.7, K: 40, Ca: 803 },
        };
        const SM = ctx.GAIP_SampleManager;
        ctx.GAIP_SampleManager = Object.assign({}, SM, {
            getActiveSample: (t) => (t === 'soil' ? withNormalized : null),
        });

        const soil = ctx.gaip_soilFromActiveSample();
        expect(soil).not.toBeNull();
        // Compared with the sample's own payload, which is where the number is.
        expect(soil.pH_water).toBe(parseFloat(stored.pH));
        expect(soil.CEC).toBe(parseFloat(stored.CEC));
        expect(soil.EC).toBe(parseFloat(stored.EC));
        // and the ten nutrients are all still there, not just the two the
        // `normalized` block happens to carry
        expect(Object.keys(soil.ppm)).toHaveLength(10);
    });

    test('methodology is NOT taken from the sample', () => {
        // It has exactly one owner, `config.turf.methodology`, settled by the
        // owner on 18.09.2026. A sample's stamp is written FROM the config and
        // is never read back to interpret anything — so this repair must not
        // quietly turn the sample into a second opinion about it.
        const { ctx } = buildState({ sample: Object.assign({ methodology: 'slan' }, SAMPLE_141), formValues: {} });
        const soil = ctx.gaip_soilFromActiveSample();
        expect(soil.methodology).toBeUndefined();

        const at = SRC.indexOf('ppm: _gaipSoilSample ?');
        const block = SRC.slice(at - 400, at + 1400);
        expect(block).toMatch(/methodology: e\.querySelector\("\.gaip-soil-methodology"\)/);
    });
});
