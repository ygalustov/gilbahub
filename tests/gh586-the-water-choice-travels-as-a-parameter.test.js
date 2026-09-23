/**
 * WHAT THIS FILE IS ABOUT, AND WHAT IT BECAME. The subject is WHICH water
 * sample the run computes on and how that choice travels — a parameter, not a
 * copy through the browser. GH-595 recorded here that the producer resolved the
 * chosen sample's ions by a literal name list of its own and that this file did
 * not touch it. **That is no longer true: GH-598 replaced both lists with the
 * declared reader**, so the naming of a sample's columns IS this file's subject
 * now, and the last two cases below are what holds it. A note left saying
 * "not changed here" would send the next reader hunting for a list that is
 * gone, which is worse than no note at all.
 *
 * GH-586 (D6) — THE CHOSEN WATER SAMPLE COMES FROM THE SERVER, AND THE
 * CHOICE TRAVELS AS A RUN PARAMETER.
 *
 * `gilba_wb_water_override` was never a store. It was a MESSAGE from the page
 * that opened the runner — "compute on this water sample" — and it went through
 * `localStorage` because until GH-547 the runner was opened as a bare `/hub`
 * with nowhere to put a parameter. What travelled was the sample's id AND A COPY
 * OF ITS PAYLOAD: the server's own numbers, carried through the browser.
 *
 * WHAT IS ASSERTED HERE IS THE EFFECT, NOT THE SHAPE OF THE SOURCE. The producer
 * is EXECUTED with a run parameter and a sample store, and what it builds is
 * compared with the SAMPLE'S OWN NUMBERS — an external fact, not a literal
 * written into this file. The first version of this file read the source with
 * `readFileSync` and matched regular expressions; it would have stayed green
 * against code that had been renamed into uselessness, and it compared the
 * product against a copy of itself.
 *
 * `localStorage` is not stubbed at all: a producer that still reached for it
 * throws here rather than quietly finding nothing.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { pressRerun, queryOf } = require('./lib/rerun-opener');
const { realReadingsOf } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');

/**
 * `samples` id 141's water sibling, as the store holds it — the external fact
 * every assertion below is measured against.
 */
const WATER_141 = {
    id: 'sample_w1',
    rawData: { _label: 'Bore water', EC: '0.5', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2' },
};
const WATER_OTHER = {
    id: 'sample_w2',
    rawData: { _label: 'Dam', EC: '2.4', Ca: '40', Mg: '18', Na: '90', pH: '8.2' },
};

/**
 * The producer, executed. `cacheAnalysisResults()` is internal, so it is
 * exposed beside the module's own export line — the shape eleven other test
 * files use — and the assertion on that line is the positive control.
 */
function produce({ search, waterSamples }) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const skipped = [];
    const problems = [];
    // `null` means the store has not loaded for this site — no entry at all,
    // which is what the runner sees during the first seconds. An EMPTY map is a
    // different fact: the store loaded and the site has no water samples.
    const store = waterSamples === null ? null : {};
    (waterSamples || []).forEach((s, i) => { if (store) store['w' + i] = s; });

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        // localStorage is DELIBERATELY ABSENT: a producer that still reads the
        // old key throws instead of finding nothing and passing.
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    sandbox.GAIP_SampleManager = {
        // GH-598: the PRODUCT's normaliser, not a stub of one. The producer
        // resolves a water sample's readings through `readingsOf` now, and a
        // bench that hands it a hand-written sample manager would be testing
        // the bench — the same way these cases were green while their samples
        // carried no `normalized` at all (GH-595).
        readingsOf: realReadingsOf(),
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({
            allSites: store === null ? {} : { 'site-1': { water: store } },
            allActive: {}, allMeta: {}, sites: {},
        }),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped: (...a) => skipped.push(a),
        recordProblem: (...a) => problems.push(a),
        getState: () => ({ computed: {} }),
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return { snap, skipped, problems, water: (snap.computed && snap.computed.waterBalance) || null };
}

describe('GH-586 — the run parameter names the sample, and the sample supplies the numbers', () => {
    test('the harness reaches the block at all', () => {
        // Positive control. Without it every assertion below could pass on a
        // producer that never got as far as the water.
        const { snap } = produce({ search: '?rerun=r&site=site-1&water=sample_w1', waterSamples: [WATER_141] });
        expect(snap).toBeTruthy();
        expect(snap.computed).toBeTruthy();
    });

    test('the sample the parameter names is the one that is used', () => {
        // TWO samples in the store, and the parameter picks the second. If the
        // producer took "the site's last water sample" instead, this is where it
        // shows — and the numbers come from `WATER_OTHER`, not from a literal.
        const { snap } = produce({
            search: '?rerun=r&site=site-1&water=sample_w2',
            waterSamples: [WATER_141, WATER_OTHER],
        });

        const used = JSON.stringify(snap.computed || {});
        expect(used).toContain('Dam');
        expect(used).not.toContain('Bore water');
    });

    test('the numbers are the sample’s own, not a copy carried through the browser', () => {
        const { snap } = produce({ search: '?rerun=r&site=site-1&water=sample_w1', waterSamples: [WATER_141] });
        const printed = JSON.stringify(snap.computed || {});

        // Measured against the fixture, which is where the numbers come from.
        expect(printed).toContain(WATER_141.rawData._label);
        expect(printed).toMatch(new RegExp(String(parseFloat(WATER_141.rawData.EC))));
    });

    test('an id that names nothing is an OUTCOME, and it is not another sample', () => {
        // The substitution this ticket removes: a run asked for sample A, could
        // not find it, and answered with sample B under the same numbers.
        const { snap, skipped, problems } = produce({
            search: '?rerun=r&site=site-1&water=sample_missing',
            waterSamples: [WATER_141, WATER_OTHER],
        });

        expect(skipped.map((s) => s.slice(0, 3))).toContainEqual(['water', 'water', 'water-sample-not-found']);
        expect(problems.length).toBeGreaterThan(0);
        const printed = JSON.stringify(snap.computed || {});
        expect(printed).not.toContain('Bore water');
        expect(printed).not.toContain('Dam');
    });

    test('a store that has not loaded is a DIFFERENT outcome from an id that is not there', () => {
        // Two facts, two reasons: "it is not on this site" and "its list had not
        // arrived". Collapsing them would tell a person to go and add a sample
        // they already have.
        const { skipped } = produce({ search: '?rerun=r&site=site-1&water=sample_w1', waterSamples: null });
        expect(skipped.map((s) => s.slice(0, 3))).toContainEqual(['water', 'water', 'water-samples-not-loaded']);
    });

    test('with no parameter the producer does not go looking in the browser', () => {
        // `localStorage` is absent from the sandbox: the old read would throw.
        // This passing IS the assertion that nothing reaches for it.
        const { snap } = produce({ search: '?rerun=r&site=site-1', waterSamples: [WATER_141] });
        expect(snap).toBeTruthy();
    });

    test('the two reasons are words a person can read, taken from where they live', () => {
        // Not a phrase copied into this file: the sentence is looked up through
        // the map that owns it, so a rewording there travels here instead of
        // breaking here.
        const notice = fs.readFileSync(
            path.join(__dirname, '..', 'app', 'app', 'Support', 'AnalysisNotice.php'), 'utf8');
        const reasons = {};
        const block = notice.slice(notice.indexOf('private const REASONS'), notice.indexOf('];', notice.indexOf('private const REASONS')));
        for (const m of block.matchAll(/'([a-z-]+)'\s*=>\s*'((?:[^'\\]|\\.)*)'/g)) reasons[m[1]] = m[2];

        ['water-sample-not-found', 'water-samples-not-loaded'].forEach((code) => {
            expect([code, typeof reasons[code]]).toEqual([code, 'string']);
            expect([code, reasons[code].length > 20]).toEqual([code, true]);
        });
    });
});

/**
 * THE JOIN. Every case above hands the runner an address this file wrote.
 *
 * Found by the reviewer, 23.09.2026: nothing executed the step between the page
 * and the runner. `&water=` appears five times in this file and all five are in
 * strings it builds itself, so an opener that stopped appending the parameter —
 * or appended somebody else's id — left all seven cases green while the run in
 * the product computed on the wrong water.
 *
 * So the address here is not written. It is PRESSED OUT OF THE PRODUCT and
 * handed on unchanged.
 */
describe('GH-586 — the join: the chosen sample becomes the parameter the runner reads', () => {
    test('a chosen sample reaches the producer THROUGH the address the opener built', async () => {
        // The page has chosen the second of two samples. Nothing below names it
        // again: what travels is whatever the opener put in the address.
        const pressed = await pressRerun({
            siteId: 'site-1',
            serverAnswer: { data: [{ id: 'sample_141' }] },
            chosenWaterId: WATER_OTHER.id,
        });
        // Positive control: a press that built no address would make every
        // claim below vacuous.
        expect(typeof pressed.url).toBe('string');

        const { snap } = produce({
            search: '?' + queryOf(pressed.url).toString(),
            waterSamples: [WATER_141, WATER_OTHER],
        });

        // And the producer used the sample the PAGE chose, with that sample's
        // own numbers — the choice survived the journey intact.
        const printed = JSON.stringify(snap.computed || {});
        expect(printed).toContain(WATER_OTHER.rawData._label);
        expect(printed).not.toContain(WATER_141.rawData._label);
        expect(printed).toMatch(new RegExp(String(parseFloat(WATER_OTHER.rawData.EC))));

        process.stdout.write('[GH-586 join] the opener built: ' + pressed.url + '\n');
    });

    test('with nothing chosen the parameter is ABSENT, not empty', async () => {
        // The second branch of the ternary, and it needs its own case: an opener
        // that always appended `&water=` with an empty value would behave
        // identically to this one — `if (_wbRequestedId)` is false either way —
        // so no claim about the producer can tell them apart. The address can.
        const pressed = await pressRerun({
            siteId: 'site-1',
            serverAnswer: { data: [{ id: 'sample_141' }] },
            chosenWaterId: null,
        });
        expect(typeof pressed.url).toBe('string');

        const query = queryOf(pressed.url);
        expect(query.has('water')).toBe(false);
        // and the run still happens — an absent choice is not a broken address
        expect(query.get('rerun')).toBeTruthy();
        expect(query.get('site')).toBe('site-1');

        // The producer, given that same address, says nothing about water at
        // all: no choice was made, so there is no unresolved choice to report.
        const { skipped } = produce({
            search: '?' + query.toString(),
            waterSamples: [WATER_141],
        });
        expect(skipped.map((s) => s[0])).not.toContain('water');
    });
});

/**
 * GH-602 — THE TWO CASES WITHOUT WHICH GH-598 GUARDS NOTHING.
 *
 * Measured by the reviewer: both defects GH-598 removed were put back — the
 * literal ion list and the `> 0` that dropped a measured zero — and the whole
 * suite stayed green, 3,326 passing, nothing to paste as a failure. The fixtures
 * spell their columns `Ca`, `Mg`, `EC`, which the old list resolved too, and no
 * fixture carried a zero. The bench was handed the product's own normaliser and
 * then asked it nothing.
 *
 * Both cases below are measured AGAINST THE MAP, not against a literal written
 * here: the alias is taken from `WATER_FIELD_MAP` itself, so a map that stops
 * carrying it makes the case red rather than quietly vacuous.
 */
describe('GH-602 — the naming of a sample’s columns, and a measured zero', () => {
    /** An alias the sample manager's own map declares for this reading. */
    function aliasFor(reading) {
        const src = fs.readFileSync(path.join(ASSETS, 'sample-manager.js'), 'utf8');
        const block = src.slice(src.indexOf('const WATER_FIELD_MAP'), src.indexOf('};', src.indexOf('const WATER_FIELD_MAP')));
        const re = new RegExp("'([A-Za-z0-9_]+)':\\s*'\\[data-ion=\\x22" + reading + "\\x22\\]'", 'g');
        const names = [...block.matchAll(re)].map((m) => m[1]).filter((n) => n !== reading);
        expect(names.length).toBeGreaterThan(0);
        return names[0];
    }

    test('a lab that spells its columns the map’s other way gives the SAME ions', () => {
        // The trap GH-598 closed: the producer matched the key exactly, so a
        // column named the way the map's alias names it was dropped — silently,
        // because a missing ion looks like an ion the lab did not measure.
        const plain = { id: 'sample_w1', rawData: { _label: 'Bore', EC: '0.5', Ca: '3', Mg: '5' } };
        const alias = { id: 'sample_w1', rawData: { _label: 'Bore' } };
        alias.rawData[aliasFor('Ca')] = '3';
        alias.rawData[aliasFor('Mg')] = '5';
        alias.rawData.EC_dSm = '0.5';

        const a = produce({ search: '?rerun=r&site=site-1&water=sample_w1', waterSamples: [plain] });
        const b = produce({ search: '?rerun=r&site=site-1&water=sample_w1', waterSamples: [alias] });

        const ionsOf = (r) => (r.water && r.water.ions) || {};
        // Positive control: the plain spelling reaches the row at all.
        expect(Object.keys(ionsOf(a)).length).toBeGreaterThan(0);
        // And the other spelling of the same readings reaches the same place.
        expect(ionsOf(b)).toEqual(ionsOf(a));
        expect(b.water.ecw).toEqual(a.water.ecw);
    });

    test('a reading of ZERO reaches the record where the record can still tell', () => {
        // THE OWNER'S RULE: a reading that arrived is printed whatever it is; no
        // key means nobody measured it. Two states, and they must not collapse.
        //
        // THE HALF THAT USED TO BE OUT OF REACH IS NOW HELD — GH-611.
        // `CO3` — the example the rule was stated on — is one of the eight the
        // ionic balance converts, and `_meq` returns `(parseFloat(x) || 0) / f`,
        // so a missing carbonate and a measured zero both come out 0 in `ions`
        // and an assertion about `ions.CO3` passes whatever the producer does.
        // That is still true of `ions`, and correctly so: it is a derived view
        // for SAR, RSC and LSI, which need a number for every term. The
        // difference is now carried beside it in `measuredIons`, which states
        // what the sample itself held among those eight — and that is what this
        // case asks.
        //
        // The other half is a reading the balance has no factor for: those
        // travel in `traceIons` in the sample's own units. BOTH are asserted,
        // because either one alone leaves the collapse standing somewhere.
        const withZero = produce({
            search: '?rerun=r&site=site-1&water=sample_w1',
            waterSamples: [{ id: 'sample_w1', rawData: { _label: 'Bore', EC: '0.5', Ca: '3', B: '0' } }],
        });
        const without = produce({
            search: '?rerun=r&site=site-1&water=sample_w1',
            waterSamples: [{ id: 'sample_w1', rawData: { _label: 'Bore', EC: '0.5', Ca: '3' } }],
        });

        // Positive control: both runs reached the water block at all.
        expect(withZero.water).toBeTruthy();
        expect(without.water).toBeTruthy();

        // The lab measured zero — the record says zero.
        expect(Object.keys(withZero.water.traceIons)).toContain('B');
        expect(withZero.water.traceIons.B).toBe(0);
        // Nobody measured it — the record says nothing, and that is a different
        // answer from zero.
        expect(Object.keys(without.water.traceIons)).not.toContain('B');

        // AND THE SAME TWO STATES AMONG THE EIGHT BALANCE IONS — the half that
        // could not be asserted before. `CO3` is the reading the owner's rule
        // was stated on, and it is a real zero on six of the eight live water
        // samples.
        const co3Zero = produce({
            search: '?rerun=r&site=site-1&water=sample_w1',
            waterSamples: [{ id: 'sample_w1', rawData: { _label: 'Bore', EC: '0.5', Ca: '3', CO3: '0' } }],
        });
        const co3Absent = produce({
            search: '?rerun=r&site=site-1&water=sample_w1',
            waterSamples: [{ id: 'sample_w1', rawData: { _label: 'Bore', EC: '0.5', Ca: '3' } }],
        });

        // The lab measured zero — the record says zero.
        expect(co3Zero.water.measuredIons.CO3).toBe(0);
        // Nobody measured it — the record says nothing about it.
        expect(Object.keys(co3Absent.water.measuredIons)).not.toContain('CO3');
        // And the two answers are different, which is the whole rule. Stated
        // on its own because both sides above are falsy in JavaScript.
        expect(co3Zero.water.measuredIons.CO3)
            .not.toBe(co3Absent.water.measuredIons.CO3);

        // The derived view is UNCHANGED and still says 0 for both — asserted so
        // that a later reader does not "fix" it into agreement and break the
        // arithmetic that needs a number for every term.
        expect(co3Zero.water.ions.CO3).toBe(0);
        expect(co3Absent.water.ions.CO3).toBe(0);
    });

});
