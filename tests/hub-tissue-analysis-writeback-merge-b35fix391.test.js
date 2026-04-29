/**
 * Test b35fix391 — hub-tissue-v3.js analysis-end writeback merges fresh
 * inputs.turf instead of using stale local snapshot.
 *
 * BUG CLASS: stale-snapshot clobber via wholesale slot replace.
 *
 * The hub-store proxy in gilba-hub-v2.js:1393–1420 installs a getter/setter
 * pair on window.GAIP_STATE. The setter's `e.turf` and `e.inputs.turf`
 * branches both REPLACE (not patch) `inputs.turf` via
 *   c.set("inputs.turf", e.turf, "legacy-state-write")
 *
 * hub-tissue-v3.js:6952 (post-b35fix391; was 6926) emits an analysis-end
 * writeback:
 *   window.GAIP_STATE = { soil: t.soil, ..., turf: t.turf, ... }
 *
 * Pre-fix, `t.turf` was the LOCAL run-snapshot built at run-start. If a
 * routed write to `inputs.turf` happened DURING the run — e.g.
 * cotula-bowling-green.js:571 routed write per b35fix388, fired by
 * handleBowlsSelection in response to the user clicking the bowls turf-type
 * tile — that routed write was clobbered by the analysis-end writeback's
 * stale `t.turf`. Symptom in production (X Cotula BC, Christchurch NZ,
 * 2026-04-29): all live-UI consumers (top-bar chips, SiteSelector tile,
 * Prebble live preview) read TurfProfileController.state and showed `bowls`
 * correctly, but Word export's collectData (word-export.js:5957–5959) read
 * window.GAIP_STATE.turf and got the post-clobber `sports` value. Site
 * Information section in every cotula bowls report rendered
 * `Turf Type: Sports Field`.
 *
 * DevTools probes (b35fix391 diagnostic, 2026-04-29) confirmed:
 *  - storeInputsTurfType: 'sports', storeInputsCotula: undefined — six b35fix388
 *    keys absent from the store post-analysis-run
 *  - tpcStateTurfType: 'bowls', tpcStateSpecies: 'cotula' — TPC has the right
 *    values; that's where chips read
 *  - afterRefire: { before: 'sports', after: 'bowls' } — routed write contract
 *    works when fired manually post-run; setter is not the broken part
 *  - afterFakeRun (writing { turf: { turfType: 'sports' } } over an inputs.turf
 *    that contained { turfType: 'bowls', cotula: true, ... }): produced
 *    { turfType: 'sports', cotula: undefined, speciesKey: undefined } —
 *    direct evidence that the analysis-end writeback wholesale-replaces.
 *
 * FIX (hub-tissue-v3.js:6946–6949): before the writeback, read fresh
 * `window.GAIP_STATE.inputs.turf` and merge it OVER the local `t.turf`
 * snapshot. Engine-computed extras on `t.turf` (e.g. ambientDLI,
 * effectiveSpecies set during the run) survive; routed-write keys
 * (cotula flag, turfType=bowls, speciesKey, etc.) survive.
 *
 * This is the CORRECT direction: the in-store value is more recent than the
 * run-start snapshot for any field the run engines did not themselves touch
 * during the run. `t.turf` is the snapshot input, not the source of truth.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix391 — hub-tissue analysis-end writeback merges fresh inputs.turf', () => {
    let hubTissueSrc;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/hub-tissue-v3.js');
        hubTissueSrc = fs.readFileSync(filePath, 'utf8');
    });

    // -------------------------------------------------------------------------
    // SOURCE-PATTERN PINS — guard the structural fix from regression
    // -------------------------------------------------------------------------

    test('hub-tissue:6952 writeback uses _b35fix391_mergedTurf, not raw t.turf', () => {
        // The pre-fix line was:
        //   turf: t.turf,
        // Post-fix it must be:
        //   turf: _b35fix391_mergedTurf,
        // Pinning by literal substring catches any reversion that drops the merge.
        expect(hubTissueSrc).toMatch(/turf:\s*_b35fix391_mergedTurf,/);
    });

    test('hub-tissue defines _b35fix391_freshTurf reading inputs.turf', () => {
        expect(hubTissueSrc).toMatch(
            /var\s+_b35fix391_freshTurf\s*=\s*\(window\.GAIP_STATE\s*&&\s*window\.GAIP_STATE\.inputs\s*&&\s*window\.GAIP_STATE\.inputs\.turf\)/
        );
    });

    test('hub-tissue _b35fix391_mergedTurf overlays freshTurf onto t.turf (correct precedence)', () => {
        // Object.assign({}, t.turf || {}, _b35fix391_freshTurf)
        // — `_b35fix391_freshTurf` MUST be the LAST argument so its keys win
        // when both objects have the same key. This is the asymmetry that
        // distinguishes correct from incorrect: t.turf is the snapshot,
        // freshTurf is the SSOT.
        expect(hubTissueSrc).toMatch(
            /Object\.assign\(\s*\{\}\s*,\s*t\.turf\s*\|\|\s*\{\}\s*,\s*_b35fix391_freshTurf\s*\)/
        );
    });

    test('hub-tissue does NOT contain the pre-fix raw t.turf assignment in the analysis-end writeback', () => {
        // Locate the analysis-end writeback block by its preceding marker.
        const idx = hubTissueSrc.indexOf('GAIP: Preparing state dispatch');
        expect(idx).toBeGreaterThan(-1);
        // Window the next 800 chars — wide enough to cover the whole writeback object.
        const window800 = hubTissueSrc.slice(idx, idx + 800);
        // The pre-fix raw assignment must not appear inside the writeback object.
        // (It can still appear elsewhere in the file — the merge sets up `_b35fix391_mergedTurf`
        //  outside this window.)
        expect(window800).not.toMatch(/\bturf:\s*t\.turf\b/);
    });

    // -------------------------------------------------------------------------
    // BEHAVIOURAL SIMULATION — pin the production scenario end to end
    // -------------------------------------------------------------------------
    //
    // Replicates the proxy contract from gilba-hub-v2.js:1393–1420 and runs
    // through the production sequence:
    //   1. User has clicked sports earlier (pre-existing inputs.turf)
    //   2. User clicks bowls — cotula routed write lands inputs.turf bowls keys
    //   3. Analysis run completes — hub-tissue:6952 writeback fires
    //   4. Word export reads window.GAIP_STATE.turf — must see bowls keys
    //
    // Pre-fix this sequence ends with the bowls keys gone. Post-fix they survive.

    function buildEnv() {
        const store = { inputs: {}, computed: {}, derived: {} };
        const c = {
            peek(key) {
                const parts = key.split('.');
                let cur = store;
                for (const p of parts) {
                    if (cur == null) return undefined;
                    cur = cur[p];
                }
                if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
                    return Object.assign({}, cur);
                }
                return cur;
            },
            set(key, val) {
                const parts = key.split('.');
                let cur = store;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (cur[p] == null) cur[p] = {};
                    cur = cur[p];
                }
                cur[parts[parts.length - 1]] = val;
            },
            transaction(fn) { fn(this); },
            _syncing: false,
        };
        const win = {};
        let t = {};
        Object.defineProperty(win, 'GAIP_STATE', {
            get() {
                const e = {
                    inputs: c.peek('inputs'),
                    computed: c.peek('computed'),
                    derived: c.peek('derived'),
                    turf: c.peek('inputs.turf'),
                };
                return Object.assign(e, t);
            },
            set(e) {
                if (e && typeof e === 'object' && !c._syncing) {
                    t = e;
                    if (e.inputs) {
                        c.transaction((tx) => {
                            for (const [s, a] of Object.entries(e.inputs)) {
                                if (a != null) tx.set(`inputs.${s}`, a, 'legacy-state-write');
                            }
                        });
                    }
                    if (e.turf) c.set('inputs.turf', e.turf, 'legacy-state-write');
                    if (e.soil) c.set('inputs.soil', e.soil, 'legacy-state-write');
                    if (e.water) c.set('inputs.water', e.water, 'legacy-state-write');
                }
            },
            configurable: true,
        });
        return { win, store };
    }

    function applyCotulaRoutedWrite(win) {
        // Mirrors cotula-bowling-green.js:566–586 (b35fix388)
        const existingTurf = (win.GAIP_STATE.inputs && win.GAIP_STATE.inputs.turf)
            || win.GAIP_STATE.turf
            || {};
        win.GAIP_STATE = {
            inputs: {
                turf: Object.assign({}, existingTurf, {
                    turfType: 'bowls',
                    surfaceType: 'cotula_bowling_green',
                    speciesKey: 'cotula',
                    grassSpecies: 'cotula',
                    physiology: 'dicot',
                    cotula: true,
                }),
            },
        };
    }

    function applyAnalysisEndWriteback_PostFix(win, localT) {
        // Mirrors hub-tissue-v3.js:6946–6956 (post-b35fix391)
        const _freshTurf = (win.GAIP_STATE && win.GAIP_STATE.inputs && win.GAIP_STATE.inputs.turf) || null;
        const _mergedTurf = _freshTurf
            ? Object.assign({}, localT.turf || {}, _freshTurf)
            : localT.turf;
        win.GAIP_STATE = {
            soil: localT.soil,
            tissue: localT.tissue,
            water: localT.water,
            turf: _mergedTurf,
            traffic: localT.traffic,
            climate: localT.climate,
        };
    }

    function applyAnalysisEndWriteback_PreFix(win, localT) {
        // The OLD pattern — for the regression-frame test that pins the bug class.
        win.GAIP_STATE = {
            soil: localT.soil,
            tissue: localT.tissue,
            water: localT.water,
            turf: localT.turf,
            traffic: localT.traffic,
            climate: localT.climate,
        };
    }

    test('production sequence: sports → bowls → analysis run preserves cotula keys', () => {
        const { win } = buildEnv();

        // 1. Pre-existing turf state from earlier sports click + TurfProfile activity.
        //    `variety` and `c3Fraction` are TPC-set fields that should survive.
        win.GAIP_STATE = {
            inputs: {
                turf: { turfType: 'sports', subCategory: 'greens', variety: 'Penncross', c3Fraction: 1.0 },
            },
        };
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('sports');

        // 2. User clicks bowls → cotula routed write fires.
        applyCotulaRoutedWrite(win);
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.inputs.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.inputs.turf.variety).toBe('Penncross'); // merge preserves

        // 3. Analysis run starts — local `t` snapshots state. But for this test the
        //    snapshot was taken BEFORE the bowls click (race condition that produces
        //    the production bug). So localT.turf is the stale sports snapshot.
        const localT = {
            soil: { K: 141 },
            tissue: { N: 4.5 },
            water: { ec: 0.6 },
            turf: { turfType: 'sports', subCategory: 'greens', variety: 'Penncross', c3Fraction: 1.0 },
            traffic: {},
            climate: { lat: -43.5, lon: 172.6 },
        };

        // 4. Run completes → writeback fires (post-fix path).
        applyAnalysisEndWriteback_PostFix(win, localT);

        // 5. Word export reads window.GAIP_STATE.turf — must see bowls keys.
        //    This is the EXACT read that word-export.js:5957–5959 does.
        expect(win.GAIP_STATE.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.turf.speciesKey).toBe('cotula');
        expect(win.GAIP_STATE.turf.surfaceType).toBe('cotula_bowling_green');
        expect(win.GAIP_STATE.turf.physiology).toBe('dicot');
        // And TPC-set fields still survive (unchanged by the cotula keys, present in fresh inputs.turf).
        expect(win.GAIP_STATE.turf.variety).toBe('Penncross');
        expect(win.GAIP_STATE.turf.c3Fraction).toBe(1.0);
    });

    test('pre-fix path produces the production bug — frame check for regression', () => {
        // Replays the same scenario through the PRE-fix writeback. If this test ever
        // PASSES the cotula-keys assertions, the proxy simulation has drifted from
        // production reality; if it FAILS them as expected, the bug class is correctly
        // pinned and the post-fix test above is meaningful.
        const { win } = buildEnv();
        win.GAIP_STATE = { inputs: { turf: { turfType: 'sports', variety: 'Penncross' } } };
        applyCotulaRoutedWrite(win);
        expect(win.GAIP_STATE.inputs.turf.cotula).toBe(true);

        const localT = {
            soil: {}, tissue: {}, water: {},
            turf: { turfType: 'sports', variety: 'Penncross' },
            traffic: {}, climate: {},
        };
        applyAnalysisEndWriteback_PreFix(win, localT);

        // The clobber: cotula keys gone, sports back.
        expect(win.GAIP_STATE.turf.turfType).toBe('sports');
        expect(win.GAIP_STATE.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.turf.speciesKey).toBeUndefined();
        // And fresh inputs.turf is also clobbered, because the setter's e.turf
        // branch ran c.set("inputs.turf", localT.turf, ...) wholesale.
        expect(win.GAIP_STATE.inputs.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('sports');
    });

    test('engine-computed extras on t.turf survive when fresh inputs.turf does not have them', () => {
        // Some run engines write back to t.turf during the run — e.g. ambient DLI
        // (hub-tissue-v3.js:6427: t.turf.ambientDLI = s.current). These fields are
        // NOT in inputs.turf at run-start, so the merge must let them through.
        const { win } = buildEnv();
        win.GAIP_STATE = {
            inputs: { turf: { turfType: 'sports', variety: 'Penncross' } },
        };
        // Cotula click happens during the run too (worst case)
        applyCotulaRoutedWrite(win);

        // Engines populated t.turf with computed extras on top of the run-start snapshot
        const localT = {
            soil: {}, tissue: {}, water: {},
            turf: {
                turfType: 'sports',         // stale snapshot value
                variety: 'Penncross',       // unchanged
                ambientDLI: 28.4,           // engine-computed during run
                ambientDLISource: 'historical_daily', // engine-computed during run
            },
            traffic: {}, climate: {},
        };
        applyAnalysisEndWriteback_PostFix(win, localT);

        // Cotula keys (from fresh inputs.turf) win
        expect(win.GAIP_STATE.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
        // Engine-computed extras (only on t.turf) survive
        expect(win.GAIP_STATE.turf.ambientDLI).toBe(28.4);
        expect(win.GAIP_STATE.turf.ambientDLISource).toBe('historical_daily');
    });

    test('no fresh inputs.turf at writeback time → falls back to t.turf cleanly', () => {
        // First-ever analysis run on a brand-new session, no prior writes to inputs.turf.
        // The merge guard `_b35fix391_freshTurf ? merge : t.turf` must use t.turf intact.
        const { win } = buildEnv();
        // No prior write — store.inputs.turf is undefined
        const localT = {
            soil: {}, tissue: {}, water: {},
            turf: { turfType: 'sports', subCategory: 'football', variety: 'Penncross' },
            traffic: {}, climate: {},
        };
        applyAnalysisEndWriteback_PostFix(win, localT);
        expect(win.GAIP_STATE.turf.turfType).toBe('sports');
        expect(win.GAIP_STATE.turf.subCategory).toBe('football');
        expect(win.GAIP_STATE.turf.variety).toBe('Penncross');
    });

    test('null/empty t.turf with populated fresh inputs.turf — fresh wins, no crash', () => {
        const { win } = buildEnv();
        applyCotulaRoutedWrite(win); // seeds inputs.turf with cotula keys
        // Pathological: localT.turf is null (engines never set it for some reason)
        const localT = {
            soil: {}, tissue: {}, water: {}, turf: null, traffic: {}, climate: {},
        };
        applyAnalysisEndWriteback_PostFix(win, localT);
        // Cotula keys must still be there — Object.assign({}, null||{}, freshTurf)
        // is just freshTurf
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.turf.turfType).toBe('bowls');
    });
});
