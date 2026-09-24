'use strict';

/**
 * GH-628 — WHAT THE STORED ROW CALLS EACH READING, MEASURED FROM THE SAMPLE'S
 * OWN LAB ROW, ACROSS THE WHOLE DECLARED UNIVERSE, ONCE PER PROCESS.
 *
 * THE PROBLEM IT ANSWERS. A sample says `Na`; the stored row calls the same
 * reading `soilNa`. A sample says `EC`; the row carries `ECe`, which is that
 * reading multiplied by a texture factor of five to ten. The restoration judge
 * compares the two by name, so the first pair looked like a reading the row had
 * lost, and the second would have looked like a disagreement of sevenfold over
 * a correct row. A judge that cries wolf is switched off.
 *
 * WHY MEASURED AND NOT WRITTEN DOWN. A table of `{Na: 'soilNa'}` is a second
 * place where the name is written, and second places drift. It also cannot
 * express the derived case at all. The correspondence is a property of the
 * producer's BEHAVIOUR, so it is asked of the producer: change one reading in
 * the lab row by a known amount, run the chain from that row to the stored row,
 * and see which field of the surface moved.
 *
 *   moved by exactly the same amount   -> the same reading under that name
 *   moved by something else            -> derived from it
 *   nothing moved                      -> the row does not carry it
 *
 * WHAT CHANGED FROM GH-626/627, AND WHY IT HAD TO. The first version shifted a
 * field of the READY SOIL STATE, which meant the test itself had to say which
 * state field carries which reading — `{pH: 'pH_water', EC: 'EC1_5', OM: 'LOI'}`
 * — and that is the second table all over again, one link earlier. Two things
 * followed from it: `EC` could not be measured at all (the row's `ECe` is
 * computed by the assembly, which a hand-written state skips, so `EC` came back
 * "not carried" on the 41 live samples that have it), and the universe was three
 * readings chosen by hand.
 *
 * So the shift now happens where the reading actually enters the product — the
 * lab row — and the chain runs whole:
 *
 *   values of the sample
 *     -> GAIP_SampleManager.readingsOf('soil', …)   the declared normaliser
 *     -> gaip_soilFromActiveSample()                the product's reader
 *     -> gaip_soilStateFrom(sample, form)           the product's assembly (GH-628)
 *     -> GilbaCascadeOrchestrator.runCascade(…)
 *     -> cacheAnalysisResults()                     the producer of the row
 *
 * Nothing between the two ends names a field. The names come back as answers.
 *
 * THE UNIVERSE IS DECLARED, NOT CHOSEN: `readingKeysFor('soil')`, the same map
 * `readingsOf` normalises against. A reading added to that map is measured
 * without anyone remembering, and a reading the row starts carrying appears by
 * itself.
 *
 * THE COST, MEASURED RATHER THAN FEARED: one bench load plus one chain run per
 * reading, 16 in all, and the set that uses it prints the total. It is built
 * ONCE PER PROCESS — the map is a property of the producer, not of a site or a
 * press — so a live probe that presses a button pays it once. There is no map
 * file in the tree, and no cache: the measurement turned out to cost seconds,
 * which is the one thing that decided it.
 */

const { load } = require('./orchestrator-bench');

/** Reach `cacheAnalysisResults`, which is private to its module. */
const EXPOSE = {
    'hub-persistence.js': (src) => src.replace(
        'global.GilbaPersistence = GilbaPersistence;',
        'global.GilbaPersistence = GilbaPersistence;\n'
        + '    global.__cacheAnalysisResults = cacheAnalysisResults;'),
};

/**
 * VALUES, not names. The names come from `readingKeysFor('soil')`; these are
 * plausible magnitudes for the ones where magnitude matters — a pH of 40 is not
 * a pH — taken from the `Burns` soil sample. A reading in the universe with no
 * entry here is still measured, at `FALLBACK_VALUE`: that is why a new reading
 * cannot be lost here quietly.
 */
const BASE_VALUES = {
    pH: 6, EC: 0.16, CEC: 5.9, OM: 3,
    P: 40, K: 40, Ca: 803, Mg: 129, S: 75,
    Fe: 168, Mn: 28.3, Zn: 5.7, Cu: 1.3, B: 0.2, Na: 11.5,
};
const FALLBACK_VALUE = 10;

/**
 * What the page supplies to the assembly, stated rather than measured — these
 * are SITE properties and form fields, not readings of the sample: the
 * methodology, the soil texture behind the `ECe` factor, the sampling depth.
 * `/hub` reads them off its own markup (`gaip_readSoilForm`); a bench has no
 * markup, so they are named here, in one place, where they can be read.
 */
const FORM = {
    testDate: null,
    depthCm: 10,
    bulkDensityOnTheForm: 1.4,
    methodology: 'ammonium_acetate',
    surfaceType: 'sports',
    soilTexture: 'loam',
    samplingDepth: '',
    LOI_0_2: 0, LOI_2_4: 0, LOI_4_6: 0,
};

function freshBench() {
    const bench = load({ expose: EXPOSE });
    if (bench.failed.length) {
        throw new Error('the bench did not load /hub: ' + bench.failed.join('; '));
    }
    return bench;
}

/** The readings a soil sample CAN carry, from the declared map. */
function universe() {
    const bench = freshBench();
    const SM = bench.ctx.GAIP_SampleManager;
    const keys = SM && typeof SM.readingKeysFor === 'function' ? SM.readingKeysFor('soil') : null;
    if (!keys || !keys.length) {
        throw new Error('the sample manager declared no soil readings — readingKeysFor gave nothing');
    }
    return keys;
}

/** A lab row carrying every reading of the universe. */
function baseRow(keys) {
    const row = {};
    keys.forEach((k) => {
        row[k] = BASE_VALUES[k] !== undefined ? BASE_VALUES[k] : FALLBACK_VALUE;
    });
    return row;
}

/**
 * The soil surface of the stored row, for one lab row, on a bench of its own.
 *
 * A fresh load per row on purpose: `/hub`'s scripts keep state in globals, and a
 * second run in the same context would be measuring the first one's leftovers.
 */
function surfaceForRow(row) {
    const bench = freshBench();
    const SM = bench.ctx.GAIP_SampleManager;
    // The sample the product's own reader will find. Nothing else about the
    // sample manager is replaced — `readingsOf`, the declared normaliser, is
    // the real one, and it is the first link of the chain being measured.
    SM.getActiveSample = (kind) => (kind === 'soil' ? { id: 'bench', values: row } : null);

    const sample = bench.ctx.gaip_soilFromActiveSample();
    if (!sample) throw new Error('the product read no sample from the lab row — the chain stopped at its first link');
    const soil = bench.ctx.gaip_soilStateFrom(sample, FORM);
    if (!soil) throw new Error('the product assembled no soil state — the chain stopped at gaip_soilStateFrom');

    const state = {
        inputs: {
            climate: { lat: -43.5, lon: 172.5 },
            turf: {
                warmBase: '', percentC3Cover: 100, construction: 'native_soil',
                species: 'Perennial Ryegrass', grassSpecies: 'perennialRyegrass',
            },
            soil: soil,
            water: {}, schedule: {}, site: {},
        },
        computed: {}, derived: {},
    };
    const run = bench.ctx.GilbaCascadeOrchestrator.runCascade(state, {}, { fullRecompute: true });
    const computed = (run && run.state && run.state.computed) || {};
    // The producer reads `global.GAIP_STATE` — measured, not assumed, and it
    // took two attempts: the cascade's result left where it was gave a surface
    // of five scalars with an empty `nutrients`, and so did handing it to
    // `GaipOrchestrator.getState()`. Every reading would then have answered
    // `absent` for a reason that has nothing to do with the producer's names.
    bench.ctx.GAIP_STATE = { inputs: state.inputs, computed: computed };
    const snap = bench.ctx.__cacheAnalysisResults();
    const surface = (snap && snap.computed && snap.computed.soilNutrition) || null;
    if (!surface) throw new Error('the bench reached no soil surface — it did not get as far as the producer');
    return surface;
}

/**
 * Numeric fields of a surface, with the nutrient cards flattened in UNDER THE
 * NAME THE ROW GIVES THEM — `K`, not `nutrients.K`.
 *
 * Measured, and it is why this is written down: GH-626 prefixed them, and the
 * prefix is this library's invention, not the producer's name. The stored row
 * calls the card's reading `K` (`{nutrient: 'K', actual: …}`) and so does the
 * screen the judge compares against, so a map answering `nutrients.K` sent the
 * judge looking for a field nothing has — it called all ten nutrients lost on a
 * row that carries them, the exact false red this whole question is closing.
 *
 * A card whose name collides with a scalar of the same surface is said out loud
 * rather than silently overwriting it: two different readings under one name is
 * something the caller has to know about.
 */
function numbersOf(surface) {
    const out = {};
    Object.keys(surface).forEach((k) => {
        const v = surface[k];
        if (typeof v === 'number') out[k] = v;
        else if (typeof v === 'string' && v !== '' && !isNaN(parseFloat(v))) out[k] = parseFloat(v);
    });
    (surface.nutrients || []).forEach((row) => {
        const n = parseFloat(row.actual);
        if (isNaN(n)) return;
        if (out[row.nutrient] !== undefined) {
            throw new Error('the surface states `' + row.nutrient + '` both as a scalar and as a nutrient card'
                + ' — one name, two readings, and the map cannot answer for it');
        }
        out[row.nutrient] = n;
    });
    return out;
}

function shiftOf(value) {
    return Math.abs(value) > 1 ? 10 : 0.5;
}

/** Which field of the surface answered to a shift of one reading, and how. */
function verdict(before, after, delta) {
    const movers = Object.keys(after).filter((k) =>
        before[k] !== undefined && Math.abs(after[k] - before[k]) > 1e-9);
    const same = movers.filter((k) => Math.abs((after[k] - before[k]) - delta) < 1e-6);
    if (same.length) return { field: same[0], kind: 'same', delta, moved: after[same[0]] - before[same[0]] };
    if (movers.length) return { field: movers[0], kind: 'derived', delta, moved: after[movers[0]] - before[movers[0]] };
    return { field: null, kind: 'absent', delta, moved: 0 };
}

let MEMO = null;

/**
 * The producer's name for every reading a soil sample can carry.
 *
 * Built once per process, from the declared universe, by measurement. The
 * report it returns says what it looked at, not only what it concluded: a map
 * that reached three readings of fifteen and a map that reached all fifteen are
 * otherwise indistinguishable from outside.
 *
 * @param {{rebuild?: boolean, say?: function(string)}} [options]
 * @returns {{map: Object, keys: string[], ms: number, runs: number}}
 */
function producerNameMap(options) {
    const say = (options && options.say) || (() => {});
    if (MEMO && !(options && options.rebuild)) {
        say('[name-map] already measured this process: ' + Object.keys(MEMO.map).length + ' readings');
        return MEMO;
    }

    const started = Date.now();
    const keys = universe();
    const row = baseRow(keys);
    const before = numbersOf(surfaceForRow(row));
    let runs = 1;

    const map = {};
    keys.forEach((name) => {
        const from = Number(row[name]);
        const delta = shiftOf(from);
        const shifted = Object.assign({}, row, { [name]: from + delta });
        const after = numbersOf(surfaceForRow(shifted));
        runs += 1;
        map[name] = verdict(before, after, delta);
    });

    MEMO = { map, keys, ms: Date.now() - started, runs };
    // The report survives an INCOMPLETE map on purpose. A reading the
    // measurement never reached prints as `not measured` instead of throwing
    // here: a tool that dies in its own printing reddens every case with a
    // TypeError, and red-by-TypeError is indistinguishable from "the check
    // never reached its subject". Completeness is asserted by a case, which is
    // where it belongs.
    say('[name-map] measured ' + keys.length + ' declared readings in ' + runs
        + ' chain runs, ' + MEMO.ms + ' ms: '
        + keys.map((k) => k + '->' + ((map[k] && map[k].field) || 'absent')
            + '/' + (map[k] ? map[k].kind : 'not measured')).join(' '));
    return MEMO;
}

module.exports = {
    producerNameMap, universe, baseRow, surfaceForRow, numbersOf, verdict,
    BASE_VALUES, FORM,
};
