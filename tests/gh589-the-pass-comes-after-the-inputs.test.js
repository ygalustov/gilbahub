/**
 * GH-589 (link 4) — THE PASS COMES AFTER THE INPUTS, AND THE ROW SHOWS IT.
 *
 * WHAT WAS WRONG, measured inside the runner's own frame on 23.09.2026: the
 * cascade ran ONCE per press, inside the run button's handler, on a state built
 * at the top of that handler. The site's samples arrive about two seconds
 * later. So the nutrient list was fixed to the moment of the PRESS and the
 * engine answered with ten rows of "NOT MEASURED" over a soil sample holding
 * K 40, Ca 803, CEC 5.9 — and the producer, which reads the sample store again
 * at assembly time, put that same sample's pH and CEC in the row beside them.
 * One row, two moments, and the halves disagreed.
 *
 * GH-588 had already made the runner WAIT for the sample before it writes. That
 * is the wrong end of the run: the writing was never early, the computing was.
 *
 * WHAT THIS FILE ASSERTS IS THE ROW, not the fact that something ran twice. A
 * repeat pass handed the previous state would satisfy "it ran again" and
 * produce the same ten dashes, so "a second pass happened" is not the claim —
 * "the stored row carries the sample's ten numbers" is.
 *
 * EXECUTED, not matched. The chain runs on the orchestrator bench: every script
 * `/hub` loads, the real cascade adapter, the real MLSN engine, the real hub
 * state and the real producer. Expected values come from the sample fixture,
 * which is `samples` id 141 as the column holds it — not from numbers typed
 * into this file.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { hubScripts, makeSandbox } = require('./lib/orchestrator-bench');
const { giveItTheChooser } = require('./lib/sample-chooser');
const { realReadingsOf } = require('./lib/sample-readings');

const RealDate = Date;
const ASSETS = path.join(__dirname, '..', 'assets');

/** `samples` id 141, Test5 - NZ, as the column holds it. */
const SOIL_141 = {
    B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16,
    Fe: 168, Mg: 129, Mn: 28.3, OM: 3.7, Zn: 5.7, pH: 6, CEC: 5.9,
};

/** A water sample of the shape the store holds, and a tissue one. */
const WATER_SAMPLE = { pH: 7.4, EC_dSm: 0.42, Ca_mgL: 31, Mg_mgL: 12, Na_mgL: 55, K_mgL: 4, Cl_mgL: 70, HCO3_mgL: 90 };
const TISSUE_SAMPLE = { N_Percent: 4.1, P_Percent: 0.42, K_Percent: 2.8, Ca_Percent: 0.55, Mg_Percent: 0.22, S_Percent: 0.31, Fe_mgkg: 120, Mn_mgkg: 45 };

/** What the `/hub` grids would be holding — deliberately DIFFERENT numbers. */
const GRID_SOIL = { P: 999, K: 999, Ca: 999 };
const GRID_WATER = { Ca: 111, Mg: 111, Na: 111 };
const GRID_TISSUE = { N: 9.9, P: 9.9, K: 9.9 };

/**
 * The bench, with the producer's own `cacheAnalysisResults` exposed.
 *
 * `load()` from the shared bench cannot reach it — it is module-private — so
 * the scripts are run here with the one export line spliced, which is the shape
 * eleven other files in this suite use. The assertion that nothing failed to
 * load is the positive control: a bench where a script threw answers every
 * question below with silence.
 */
function benchWithProducer({ grids }) {
    const sandbox = makeSandbox();
    // A clock this file holds. The shared bench makes `setTimeout` a no-op,
    // which is right for a pass measured in one go and useless for a claim about
    // something scheduled — the orchestrator's re-run is a scheduled thing.
    const timers = [];
    sandbox.setTimeout = (fn, ms, ...args) => { timers.push({ fn, args }); return timers.length; };
    sandbox.clearTimeout = () => {};
    const said = [];
    sandbox.console.warn = (...a) => said.push('WARN ' + a.map(String).join(' '));
    sandbox.console.error = (...a) => said.push('ERR  ' + a.map(String).join(' '));

    // A `/hub` whose grids are FULL. If any of the readings below came off the
    // page, these are the numbers that would arrive — which is what makes the
    // sample's numbers arriving proof of where they came from.
    const gridNodes = (map, attr) => Object.keys(map).map((k) => ({
        value: String(map[k]), getAttribute: () => k, dataset: { [attr]: k },
    }));
    const hubRoot = {
        querySelector: (sel) => {
            if (!grids) return null;
            if (sel === '.gaip-soil-grid') return { querySelectorAll: () => gridNodes(GRID_SOIL, 'mlsn') };
            if (sel === '.gaip-water-grid') return { querySelectorAll: () => gridNodes(GRID_WATER, 'ion') };
            const val = /^\[data-val="([^"]+)"\]$/.exec(sel);
            if (val && GRID_TISSUE[val[1]] !== undefined) return { value: String(GRID_TISSUE[val[1]]) };
            return null;
        },
        querySelectorAll: () => [],
    };
    sandbox.document.querySelector = (sel) => hubRoot.querySelector(sel);

    const failed = [];
    const ctx = vm.createContext(sandbox);
    // GH-778: the write path asks one function which sample this run computes on, and that function lives
    // in `hub-tissue-v3.js`. A bench executing the producer alone has none, and every such place answers
    // `null`. The product's own chooser is lifted in, not stubbed.
    giveItTheChooser(ctx);
    hubScripts().forEach((name) => {
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file)) { failed.push(name + ': missing'); return; }
        let src = fs.readFileSync(file, 'utf8');
        if (name === 'hub-persistence.js') {
            const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
            expect(src).toContain(exportLine);
            src = src.replace(exportLine, exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
        }
        try { vm.runInContext(src, ctx, { filename: name }); }
        catch (e) { failed.push(name + ': ' + String(e && e.message).slice(0, 120)); }
    });
    expect(failed).toEqual([]);
    expect(typeof ctx.__test_cacheAnalysisResults).toBe('function');
    expect(typeof ctx.gaip_runCascadePass).toBe('function');

    /** The sample store, with whatever this case says has arrived so far. */
    const store = { soil: null, water: null, tissue: null };
    const realReadingsOf = ctx.GAIP_SampleManager.readingsOf;
    ctx.GAIP_SampleManager = {
        readingsOf: realReadingsOf,
        getActiveSample: (kind) => (store[kind]
            ? { id: kind + '_sample', rawData: store[kind] } : null),
        getActiveSampleId: (kind) => (store[kind] ? kind + '_sample' : null),
        getSamples: () => [],
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSiteId: () => 'site-1',
    };
    expect(typeof ctx.GAIP_SampleManager.readingsOf).toBe('function');

    /** Run everything scheduled, repeatedly, until nothing new is scheduled. */
    const runTimers = async (rounds) => {
        for (let i = 0; i < (rounds || 6); i += 1) {
            const due = timers.splice(0, timers.length);
            if (!due.length) return;
            for (const t of due) {
                try { await t.fn(...t.args); } catch (e) { /* a stub DOM is not a page */ }
            }
        }
    };

    return {
        ctx, said, hubRoot, store, timers, runTimers,
        deliver: (kind, payload) => { store[kind] = payload; },
        fire: (type, detail) => ctx.document.dispatchEvent(new ctx.CustomEvent(type, { detail: detail || {} })),
    };
}

const WEATHER = { forecast: null, historical: null };

/** The ten nutrients the MLSN engine reports, in its own order. */
const actualsOf = (rows) => (rows || []).map((r) => [r.nutrient, r.actual]);

describe('GH-589 — case 1: the sample arrives after the press', () => {
    jest.setTimeout(60000);

    test('THE ROW CARRIES THE SAMPLE’S TEN NUMBERS, not the ten dashes the first pass produced', () => {
        const b = benchWithProducer({ grids: true });

        // The press. The store is empty, exactly as it is ~150 ms in.
        const first = b.ctx.gaip_runCascadePass('run-button', b.hubRoot, WEATHER, null);
        expect(first.result.success).toBe(true);
        // The control this whole case is read against: at this point the row
        // WOULD have said nothing, and the grids were full while it did.
        expect(actualsOf(first.result.state.computed.mlsnRows).every(([, a]) => a === '-')).toBe(true);

        // ~2,100 ms later the sample lands.
        b.deliver('soil', SOIL_141);
        const second = b.ctx.gaip_runCascadePass('samples-arrived', b.hubRoot, WEATHER, first.state);
        expect(second.result.success).toBe(true);
        b.ctx.gaip_republishCascadePass(second);

        // AND THE ROW, which is the claim. Every nutrient the sample carries
        // appears in the stored result with the sample's own value.
        const snap = b.ctx.__test_cacheAnalysisResults();
        const sn = snap.computed.soilNutrition;
        expect(sn).toBeTruthy();

        const stored = {};
        sn.nutrients.forEach((n) => { stored[n.nutrient] = n.actual; });
        const expected = {};
        Object.keys(SOIL_141).forEach((k) => {
            if (['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'].indexOf(k) >= 0) {
                expected[k] = SOIL_141[k];
            }
        });
        expect(Object.keys(expected)).toHaveLength(10);
        Object.keys(expected).forEach((k) => {
            expect([k, Number(stored[k])]).toEqual([k, expected[k]]);
        });
        // and not one of them is the page's 999
        expect(Object.values(stored).map(Number)).not.toContain(999);
        // no numbers, no verdict was the rule GH-576 put here; numbers, a verdict
        expect(sn.verdict).not.toBe('NO DATA');

        process.stdout.write('[GH-589] pass 1 actuals: ' + JSON.stringify(actualsOf(first.result.state.computed.mlsnRows))
            + '\n[GH-589] stored actuals: ' + JSON.stringify(actualsOf(sn.nutrients)) + '\n');
    });
});

describe('GH-589 — case 4: the list and the four readings come out of ONE pass', () => {
    jest.setTimeout(60000);

    test('pH, CEC, ECe and the nutrient list all describe the state that pass computed on', () => {
        const b = benchWithProducer({ grids: true });

        b.ctx.gaip_runCascadePass('run-button', b.hubRoot, WEATHER, null);
        b.deliver('soil', SOIL_141);
        const second = b.ctx.gaip_runCascadePass('samples-arrived', b.hubRoot, WEATHER, null);
        b.ctx.gaip_republishCascadePass(second);

        const sn = b.ctx.__test_cacheAnalysisResults().computed.soilNutrition;

        // The four readings, compared with the SAMPLE rather than with each
        // other: two of our own surfaces agreeing proves only that they agree.
        expect(sn.pH).toBe(SOIL_141.pH);
        expect(sn.CEC).toBe(SOIL_141.CEC);
        expect(sn.ECe).toBeCloseTo(SOIL_141.EC * 7, 5);
        // and the list beside them describes the same sample
        const k = sn.nutrients.filter((n) => n.nutrient === 'K')[0];
        expect([k.nutrient, Number(k.actual)]).toEqual(['K', SOIL_141.K]);

        // THE DISTINGUISHER. Before this repair the readings came from a second
        // read of the store at assembly time, so they were the sample's while
        // the list was the empty form's. Run the producer with a pass that never
        // saw the sample and both halves must be empty TOGETHER — a row where
        // pH is 6 and the cards are dashes is the defect, not a partial repair.
        const c = benchWithProducer({ grids: true });
        const only = c.ctx.gaip_runCascadePass('run-button', c.hubRoot, WEATHER, null);
        c.ctx.gaip_republishCascadePass(only);
        c.deliver('soil', SOIL_141);          // arrives, but no pass runs on it
        const cold = c.ctx.__test_cacheAnalysisResults().computed.soilNutrition;
        expect([cold.pH, cold.CEC, cold.ECe]).toEqual([null, null, null]);
        expect(cold.nutrients.every((n) => n.actual === '-')).toBe(true);
        expect(cold.verdict).toBe('NO DATA');
    });
});

describe('GH-589 — case 5: the tissue block and the water are the store’s samples', () => {
    jest.setTimeout(60000);

    test('the row’s tissue and water come from the samples, and the grids and the window snapshot are not read', () => {
        const b = benchWithProducer({ grids: true });

        b.deliver('soil', SOIL_141);
        b.deliver('water', WATER_SAMPLE);
        b.deliver('tissue', TISSUE_SAMPLE);
        const pass = b.ctx.gaip_runCascadePass('run-button', b.hubRoot, WEATHER, null);
        expect(pass.result.success).toBe(true);
        b.ctx.gaip_republishCascadePass(pass);

        // THE SNAPSHOT IS PLANTED HERE — AFTER THE PASS AND BEFORE THE ROW IS
        // ASSEMBLED — AND THE ORDER IS THE WHOLE POINT.
        //
        // The first version of this case planted it before the pass, and the
        // case was worthless: the cascade's tissue engine writes this same
        // variable with its own result (`cascade-orchestrator.js:520`), so by
        // the time the producer read it the plant was gone and "read the
        // snapshot" and "read the pass" were the same instruction. Found by the
        // reviewer's mutation — the producer put back to
        // `__GAIP_TISSUE_LAST__ || _cascadeTissueOfThisRun()` and all ten cases
        // stayed green.
        //
        // AFTER the pass is the order that actually happens: `tissue-ui.js`
        // writes this on a click of the hub's own tissue Run button, which can
        // land at any moment, including after an analysis has finished. That is
        // the second author, and this is where it overwrites.
        b.ctx.__GAIP_TISSUE_LAST__ = {
            testDate: '1999-01-01',
            normalized: { N: 9.9 },
            status: { N: { value: 9.9 } },
            headline: 'from the window snapshot, not from a sample',
        };
        // and it IS there when the row is assembled — without this, "the row
        // carries the sample's numbers" could hold because nothing was planted.
        expect(b.ctx.__GAIP_TISSUE_LAST__.headline).toBe('from the window snapshot, not from a sample');

        // WATER: the state the engines computed on carries the sample's ions,
        // and the grid's 111s are nowhere in it.
        expect(pass.state.water.ions.Na).toBe(WATER_SAMPLE.Na_mgL);
        expect(pass.state.water.ions.Ca).toBe(WATER_SAMPLE.Ca_mgL);
        expect(pass.state.water.ecw).toBe(WATER_SAMPLE.EC_dSm);
        expect(Object.values(pass.state.water.ions)).not.toContain(111);

        // TISSUE: the row's block is the pass's own result, and the 9.9s in the
        // window snapshot and in the form reach it nowhere.
        const sn = b.ctx.__test_cacheAnalysisResults().computed.soilNutrition;
        expect(sn.tissue).toBeTruthy();
        expect(sn.tissue.headline).not.toBe('from the window snapshot, not from a sample');
        expect(sn.tissue.normalized.N).toBe(TISSUE_SAMPLE.N_Percent);
        expect(sn.tissue.normalized.K).toBe(TISSUE_SAMPLE.K_Percent);
        expect(JSON.stringify(sn.tissue)).not.toContain('9.9');

        process.stdout.write('[GH-589] water ions from the sample: ' + JSON.stringify(pass.state.water.ions)
            + '\n[GH-589] tissue normalized in the row: ' + JSON.stringify(sn.tissue.normalized) + '\n');
    });

    test('with no sample of a kind, the run carries no readings of it — the grid does not stand in', () => {
        // Point 3: the form was the source "when there is no sample at all", and
        // it is not one. The grids are full here and every reading is absent.
        const b = benchWithProducer({ grids: true });
        /**
         * GH-777 (the live measurement of 29.09.2026): THE RUN IS TOLD THERE IS NO SAMPLE, in the words the
         * opener uses. The gate of slice 3 distinguishes three answers -- told `none`, named but not in the
         * store yet, and told nothing at all -- because the cascade's first pass runs before the store is
         * filled, and reading "not in the store yet" as "the client entered none" gated MLSN out of a live
         * run on a site with three soil samples. A bench whose address names no sample measures the third
         * answer, so this one says `none`, which is what the dashboard's opener sends for a site with none.
         */
        b.ctx.location = { search: '?rerun=r1&site=site-1&soil=none&tissue=none' };
        const pass = b.ctx.gaip_runCascadePass('run-button', b.hubRoot, WEATHER, null);

        expect(pass.state.soil.ppm).toEqual({});
        expect(pass.state.soil.pH_water).toBeNull();
        expect(pass.state.soil.CEC).toBeNull();
        expect(pass.state.soil.ECe).toBeNull();
        expect(pass.state.water.ions).toEqual({});

        /**
         * GH-777 (queue item 4, slice 3) — AND NOW THE TISSUE IS NOT COMPUTED AT ALL, WHICH IS STRONGER
         * THAN COMPUTED-TO-NULL.
         *
         * This used to assert `computed.tissue === null`: the engine ran over a site with no tissue sample,
         * asked for readings, received none and returned nothing. The node declares `samples.tissue` now,
         * so the gate does not run it and the pass records WHY -- which is what a client needs and what a
         * null in a row could never say. The consequence asserted is the same one, in the shape the run
         * writes it.
         */
        expect(pass.result.state.computed.tissue).toBeFalsy();
        const recorded = (b.ctx.GaipOrchestrator.getState().computed.notApplicable || [])
            .filter((e) => e && e.module === 'tissue');
        process.stdout.write('[GH-589] with no tissue sample the pass recorded: '
            + JSON.stringify(recorded) + '\n');
        // GH-781: the entry names its producer, which is how it survives the next pass of the orchestrator.
        // GH-781 (delivery 6): the entry also names the DOOR it came through, because a record's list and
        // level cannot tell the outside door from the orchestrator's internal one.
        expect(recorded).toEqual([{ module: 'tissue', missing: ['samples.tissue'], producer: 'cascade',
            door: 'notApplicable', pass: expect.any(Number) }]);
    });
});

describe('GH-589 — case 3: the orchestrator runs again when the samples arrive after its pass', () => {
    jest.setTimeout(60000);

    test('a computeAll pass that began before the samples is not the last one', async () => {
        // The weather's retry had this and was a ONE-SHOT ("once per page
        // load"); the samples had none at all. On a site whose weather comes
        // from cache the weather can land BEFORE the samples, so the one pass
        // the latch allowed was also a pass on empty samples — the tissue and
        // disease steps then get what the nutrient list got.
        const b = benchWithProducer({ grids: false });
        const seq = () => b.ctx.GaipOrchestrator.getState().computeSequence;

        // A first pass, so there is something to be older than.
        b.ctx.climateMetrics = { temperature: { mean: 14, max: 18, min: 9 }, growth: { weighted: 60 } };
        await b.ctx.GaipOrchestrator.computeAll().catch(() => {});
        const afterFirst = seq();
        expect(afterFirst).toBeGreaterThan(0);
        const passStartedAt = b.ctx.GaipOrchestrator.getState().computed.passStartedAt;
        expect(typeof passStartedAt).toBe('number');

        // The samples land. The announcement alone changes nothing this
        // orchestrator reads — its soil comes from `GAIP_STATE`, which a cascade
        // pass publishes — so it does not run on an event.
        b.deliver('soil', SOIL_141);
        b.fire('gaip:site-samples-ready', { siteId: 'site-1' });
        await b.runTimers();
        expect([afterFirst, seq()]).toEqual([afterFirst, afterFirst]);

        // The cascade pass that carries the sample into the state. THAT is the
        // arrival, and this pass must not be the last one either.
        const late = b.ctx.gaip_runCascadePass('samples-arrived', b.hubRoot, WEATHER, null);
        b.ctx.gaip_republishCascadePass(late);
        b.fire('gaip:cascade-complete', { passStartedAt: late.passStartedAt });
        await b.runTimers();

        const afterArrival = seq();
        expect([afterFirst, afterArrival]).toEqual([afterFirst, afterFirst + 1]);
        expect(b.ctx.GaipOrchestrator.getState().computed.passStartedAt).toBeGreaterThanOrEqual(passStartedAt);
        // and the pass read the sample's soil, not the empty state it had
        expect(b.ctx.GaipOrchestrator.getState().inputs.soil.CEC).toBe(SOIL_141.CEC);

        // AND IT STOPS. A second announcement with nothing new arriving does not
        // run a third pass: the question is about the inputs, and they are the
        // ones the last pass read.
        b.fire('gaip:site-samples-ready', { siteId: 'site-1' });
        b.fire('gaip:cascade-complete', { passStartedAt: late.passStartedAt });
        await b.runTimers();
        expect([afterArrival, seq()]).toEqual([afterArrival, afterArrival]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 2 — the runner. Driven with the run's own budget and a clock this file
// controls, the shape `gh588` established.
// ─────────────────────────────────────────────────────────────────────────────

function runRunner({ soilParam }) {
    const src = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(src).toContain(exportLine);

    const listeners = {};
    const timers = [];
    const skipped = [];
    const posted = [];
    let now = 0;
    let sampleThere = false;

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; },
        clearTimeout() {},
        setInterval: (fn, ms) => { timers.push({ fn, at: now + (ms || 0), every: ms || 100 }); return 0; },
        clearInterval() {},
        Date: Object.assign(function (...a) { return new RealDate(...a); }, {
            now: () => now, parse: RealDate.parse, UTC: RealDate.UTC, prototype: RealDate.prototype,
        }),
        document: {
            readyState: 'complete',
            addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
            dispatchEvent() {},
        },
        location: { search: '?rerun=r1&site=site-1' + (soilParam === undefined ? '' : '&soil=' + soilParam) },
        URLSearchParams, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise,
        fetch: (url, opts) => {
            if (/analysis-cache\/runs$/.test(url)) posted.push(['failure', JSON.parse(opts.body)]);
            else if (/analysis-cache$/.test(url)) posted.push(['result', JSON.parse(opts.body)]);
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    // The DECLARED form of a result, from the file that owns it.
    sandbox.GAIP_ANALYSIS_SCHEMA = (function () {
        const schema = JSON.parse(fs.readFileSync(path.join(ASSETS, 'analysis-result.schema.json'), 'utf8'));
        return { version: schema.version, metrics: { required: schema.metrics.required } };
    })();
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    // GH-604: the product's normaliser. The runner's arrival check reads a
    // sample through `readingsOf`, so a stub without it answers "no sample" for
    // every run and this bench would measure its own gap.
    sandbox.GAIP_SampleManager = {
        readingsOf: realReadingsOf(),
        getSamples: () => [],
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        // GH-778: a store's key and a sample's row id are two things; the address names the row.
        getActiveSample: (t) => (t === 'soil' && sampleThere
            ? { id: 'sample_141', serverId: 141, rawData: SOIL_141 } : null),
        getSamples: (t) => ((t === 'soil' && sampleThere)
            ? [{ id: 'sample_141', serverId: 141, rawData: SOIL_141 }] : []),
    };
    sandbox.GaipOrchestrator = { noteSkipped: (...a) => skipped.push(a), recordProblem() {}, getState: () => ({ computed: {} }) };

    const ctx = vm.createContext(sandbox);
    // GH-778: this bench executes the row producer too, so it needs the product's chooser of a sample.
    giveItTheChooser(ctx);
    vm.runInContext(src, ctx, { filename: 'hub-persistence.js' });

    const fire = (name, detail) => (listeners[name] || []).forEach((f) => f({ detail: detail || {} }));
    const advance = (ms) => {
        const target = now + ms;
        for (let guard = 0; guard < 5000 && now < target; guard += 1) {
            const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
            if (!due) break;
            timers.splice(timers.indexOf(due), 1);
            now = Math.max(now, due.at);
            if (due.every) timers.push({ fn: due.fn, at: now + due.every, every: due.every });
            try { due.fn(); } catch (e) { /* the runner's own guards */ }
        }
        now = target;
    };

    return {
        fire, advance, posted, skipped, nowOf: () => now,
        deliverSample: () => { sampleThere = true; },
    };
}

async function settle() {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
}

describe('GH-589 — case 2: the runner counts the pass, not the arrival', () => {
    test('CONTROL: a cascade pass that began after the sample completes the run', async () => {
        const h = runRunner({ soilParam: '141' });
        h.advance(100);
        h.deliverSample();
        h.advance(200);                                   // the poll finds it
        h.fire('gaip:weather-ready');
        h.advance(10);
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
        h.fire('gaip:analysis-complete', {});
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
    });

    test('a cascade pass that began BEFORE the sample does not complete the run', async () => {
        // The distinguisher against the control above: same three completion
        // events, same arrival, only the pass is older than the sample. Before
        // this the row was written and carried ten dashes over a sample holding
        // K 40 and Ca 803.
        const h = runRunner({ soilParam: '141' });
        h.advance(100);
        h.fire('gaip:weather-ready');
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });   // the press-time pass
        h.advance(2000);
        h.deliverSample();
        h.advance(200);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
        h.fire('gaip:analysis-complete', {});
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual([]);
    });

    test('and a later pass, on the sample, releases it', async () => {
        const h = runRunner({ soilParam: '141' });
        h.advance(100);
        h.fire('gaip:weather-ready');
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });
        h.advance(2000);
        h.deliverSample();
        h.advance(200);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
        h.fire('gaip:analysis-complete', {});
        await settle();
        expect(h.posted.map((p) => p[0])).toEqual([]);

        // The repeat pass, on the state collected after the arrival.
        h.advance(50);
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
    });

    test('the sample arrived and no pass ran on it — the run is PARTIAL with a reason, not nothing', async () => {
        // The third outcome, which exists for exactly this: the rest of the run
        // is real and is stored, the soil part is named as not computed, and the
        // previous complete numbers are not replaced by a partial one.
        const h = runRunner({ soilParam: '141' });
        h.advance(100);
        h.fire('gaip:weather-ready');
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });
        h.advance(2000);
        h.deliverSample();
        h.advance(200);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
        h.fire('gaip:analysis-complete', {});
        await settle();
        expect(h.posted.map((p) => p[0])).toEqual([]);

        h.advance(20000);                                 // past the run's own budget
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
        /**
         * GH-781 (delivery 5): the runner no longer writes this reason. It wrote it unnamed, so the
         * orchestrator's next pass removed it, and after the capture of the journal it could not reach the
         * row at all. The pass that ran before the sample is what names it now -- it can see that the sample
         * it was given is not in the store -- and that is measured in
         * `gh781-a-producer-that-names-itself-is-also-cleared-by-itself.test.js`.
         *
         * THIS HARNESS RUNS NO PASS, so there is nothing to find here, and the case holds what it is named
         * for: the run WRITES rather than hanging, and it writes after its own budget.
         *
         * AND THE HONEST EDGE, named rather than left to be discovered: a run in which no pass ran at all
         * has nobody to name the gap now. Whether that is reachable in the product, and what should name it,
         * is carried to the analyst rather than decided here.
         */
        expect(h.skipped.map((s) => s.slice(0, 3)))
            .not.toContainEqual(['mlsn', 'mlsn', 'soil-sample-not-loaded']);
    });

    test('a run nobody told about a sample is not gated on a pass either', async () => {
        // The export and report pages open `/hub` without the parameter. Gating
        // on a fact nobody supplied means never completing — measured the hard
        // way in GH-588, where twenty-four runner tests stopped writing.
        const h = runRunner({ soilParam: undefined });
        h.advance(100);
        h.fire('gaip:weather-ready');
        h.fire('gaip:cascade-complete', { passStartedAt: h.nowOf() });
        h.advance(10);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
        h.fire('gaip:analysis-complete', {});
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
    });
});
