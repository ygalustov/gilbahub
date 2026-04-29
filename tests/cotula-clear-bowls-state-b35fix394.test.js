/**
 * Test b35fix394 — clearBowlsState strips cotula identity keys from
 * inputs.turf when restoring a non-bowls site, preventing state bleed
 * across site switches.
 *
 * BUG CLASS: stale identity-key persistence across site-switch via
 * non-symmetric routed-write infrastructure.
 *
 * The cotula triad (b35fix388/389/390/391) successfully routes cotula
 * identity keys (cotula:true, surfaceType:cotula_bowling_green,
 * speciesKey:cotula, grassSpecies:cotula, physiology:dicot, turfType:bowls)
 * into inputs.turf via handleBowlsSelection. b35fix391's analysis-end
 * writeback merge keeps these keys alive across analysis runs on the
 * SAME bowls site — fresh inputs.turf wins over the run-snapshot t.turf.
 *
 * UNINTENDED CONSEQUENCE (production-confirmed 2026-04-29 from Canturf
 * combined-export GAIP_Combined_Report_2026-04-29.docx +
 * gilbasolutions_com-1777429985062.log):
 * Switching from a bowls site (X Cotula BC, NZ) to a non-bowls site
 * (Canturf, Fyshwick AU, tall fescue) does NOT clear the cotula keys.
 * site-config-persistence.js:402-410 calls tp.selectTurfType('sports')
 * which updates DOM and tp.state.turfType but doesn't touch inputs.turf.
 * b35fix391's merge then preserves the stale cotula keys across the
 * Canturf analysis run because fresh inputs.turf still carries them.
 *
 * Symptoms in production:
 *   - b35fix365 species-resolution probe (line 49 of log):
 *     GAIP_STATE_turf_grassSpecies: "cotula"  ← stale
 *     SC_getBaseSpecies: "tallFescue"          ← TPC.state correct
 *   - Combined export report renders Turf Type:bowls, Species:cotula
 *     on every Canturf sample (10 occurrences of "cotula" in a tall
 *     fescue site report).
 *   - Tissue advice falls back to cotula sufficiency thresholds for
 *     tall fescue tissue analysis — agronomically wrong.
 *
 * Note: the recommender path correctly used Australian products because
 * geolocation-driven recommender selection reads from a different code
 * path that pulls species via TPC.state. The bug class is the divergence
 * between routed-state readers (Word export, b35fix365 probe, disease
 * engines) and TPC-state readers (recommender, chips). Same divergence
 * pattern as the original cotula triad — the proxy state and TPC state
 * can disagree.
 *
 * FIX: cotula-bowling-green.js exposes clearBowlsState() — inverse of
 * handleBowlsSelection. Strips the six cotula identity keys via routed
 * write. Called from site-config-persistence.js in two places:
 *   (a) restoreConfig() else branch — when restoring a non-bowls site
 *   (b) restoreNewSiteConfig() no-saved-config branch — when a site has
 *       never been configured on this device, so restoreConfig() doesn't
 *       fire at all and the bleed would otherwise persist.
 *
 * The clear uses delete (not Object.assign with undefined values) so the
 * keys are absent from the merged object. b35fix391's hub-tissue:6952
 * merge with `Object.assign({}, t.turf || {}, _b35fix391_freshTurf)`
 * cannot resurrect deleted keys from a stale snapshot — the only way
 * cotula keys can return is via an explicit handleBowlsSelection call.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix394 — clearBowlsState prevents cotula state bleed across site switches', () => {
    let cotulaSrc, sitePersistSrc;

    beforeAll(() => {
        cotulaSrc = fs.readFileSync(
            path.join(__dirname, '../assets/cotula-bowling-green.js'), 'utf8'
        );
        sitePersistSrc = fs.readFileSync(
            path.join(__dirname, '../assets/site-config-persistence.js'), 'utf8'
        );
    });

    // -------------------------------------------------------------------------
    // SOURCE PATTERNS — pin the structural fix
    // -------------------------------------------------------------------------

    test('cotula-bowling-green: clearBowlsState function defined', () => {
        expect(cotulaSrc).toMatch(/function\s+clearBowlsState\s*\(\s*\)/);
    });

    test('cotula-bowling-green: clearBowlsState exported on public API', () => {
        // The exports object literal must include clearBowlsState
        const exportsBlock = cotulaSrc.match(/const\s+CotulaBowlingGreen\s*=\s*\{[\s\S]*?\};/);
        expect(exportsBlock).not.toBeNull();
        expect(exportsBlock[0]).toMatch(/clearBowlsState/);
    });

    test('cotula-bowling-green: clearBowlsState uses routed-write contract via window.GAIP_STATE = { inputs: { turf: ... } }', () => {
        // Strip line comments before scanning so the comment block describing
        // the bug doesn't satisfy a literal-pattern check accidentally.
        const stripped = cotulaSrc.replace(/\/\/.*$/gm, '');
        // Locate the function body
        const fnMatch = stripped.match(/function\s+clearBowlsState\s*\(\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
        expect(fnMatch).not.toBeNull();
        const body = fnMatch[0];
        // Must merge with existing turf state first (preserve non-cotula fields)
        expect(body).toMatch(/var\s+existingTurf\s*=\s*\(global\.GAIP_STATE\.inputs\s*&&\s*global\.GAIP_STATE\.inputs\.turf\)/);
        expect(body).toMatch(/Object\.assign\(\{\}\s*,\s*existingTurf\)/);
        // Must use routed write (not direct .turf.X assignment)
        expect(body).toMatch(/global\.GAIP_STATE\s*=\s*\{[\s\S]*?inputs:\s*\{[\s\S]*?turf:\s*cleared/);
    });

    test('cotula-bowling-green: clearBowlsState strips all five cotula identity keys via delete', () => {
        const stripped = cotulaSrc.replace(/\/\/.*$/gm, '');
        const fnMatch = stripped.match(/function\s+clearBowlsState\s*\(\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
        const body = fnMatch[0];
        // delete (not undefined assignment) so the keys are ABSENT from the merged object,
        // and b35fix391's hub-tissue:6952 Object.assign merge can't resurrect them.
        expect(body).toMatch(/delete\s+cleared\.cotula/);
        expect(body).toMatch(/delete\s+cleared\.surfaceType/);
        expect(body).toMatch(/delete\s+cleared\.speciesKey/);
        expect(body).toMatch(/delete\s+cleared\.grassSpecies/);
        expect(body).toMatch(/delete\s+cleared\.physiology/);
    });

    test('cotula-bowling-green: clearBowlsState only strips turfType when it is bowls (preserves new turfType set by TPC)', () => {
        const stripped = cotulaSrc.replace(/\/\/.*$/gm, '');
        const fnMatch = stripped.match(/function\s+clearBowlsState\s*\(\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
        const body = fnMatch[0];
        // Conditional on cleared.turfType === 'bowls' — guards against deleting a
        // legitimate non-bowls turfType that was already set in inputs.turf.
        expect(body).toMatch(/if\s*\(\s*cleared\.turfType\s*===\s*'bowls'\s*\)\s*\{[\s\S]*?delete\s+cleared\.turfType/);
    });

    test('site-config-persistence: restoreConfig calls clearBowlsState in non-bowls else branch', () => {
        // Locate the turfType restore block
        const stripped = sitePersistSrc.replace(/\/\/.*$/gm, '');
        const blockMatch = stripped.match(
            /tp\.selectTurfType\(turf\.turfType\);[\s\S]{0,800}?(?=\n\s{8}\})/
        );
        expect(blockMatch).not.toBeNull();
        const block = blockMatch[0];
        // Bowls path still fires handleBowlsSelection
        expect(block).toMatch(/turf\.turfType\s*===\s*'bowls'[\s\S]*?handleBowlsSelection\(\)/);
        // Non-bowls path fires clearBowlsState
        expect(block).toMatch(/turf\.turfType\s*!==\s*'bowls'[\s\S]*?clearBowlsState\(\)/);
    });

    test('site-config-persistence: restoreNewSiteConfig clears bowls state on first-visit no-saved-config path', () => {
        const stripped = sitePersistSrc.replace(/\/\/.*$/gm, '');
        // The else branch where no saved config exists
        const fnMatch = stripped.match(/function\s+restoreNewSiteConfig\s*\([\s\S]*?\n\s{4}\}/);
        expect(fnMatch).not.toBeNull();
        const body = fnMatch[0];
        // Must include the clearBowlsState call inside the else (no-config) branch
        expect(body).toMatch(/}\s*else\s*\{[\s\S]*?clearBowlsState\(\)/);
    });

    // -------------------------------------------------------------------------
    // BEHAVIOURAL — proxy simulation matching gilba-hub-v2.js:1393–1420
    // -------------------------------------------------------------------------

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
                }
            },
            configurable: true,
        });
        return { win, store };
    }

    // Mirrors handleBowlsSelection's b35fix388 routed write
    function applyCotulaRoutedWrite(global) {
        const existingTurf = (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf)
            || global.GAIP_STATE.turf
            || {};
        global.GAIP_STATE = {
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

    // Mirrors clearBowlsState — must stay in sync with the production helper
    function applyClearBowlsState(global) {
        if (!global.GAIP_STATE) return;
        const existingTurf = (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf)
            || global.GAIP_STATE.turf
            || {};
        const cleared = Object.assign({}, existingTurf);
        delete cleared.cotula;
        delete cleared.surfaceType;
        delete cleared.speciesKey;
        delete cleared.grassSpecies;
        delete cleared.physiology;
        if (cleared.turfType === 'bowls') {
            delete cleared.turfType;
        }
        global.GAIP_STATE = {
            inputs: {
                turf: cleared
            }
        };
    }

    // Mirrors hub-tissue-v3.js:6946–6956 (post-b35fix391) — analysis-end writeback
    function applyAnalysisEndWriteback(global, localT) {
        const _freshTurf = (global.GAIP_STATE && global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf) || null;
        const _mergedTurf = _freshTurf
            ? Object.assign({}, localT.turf || {}, _freshTurf)
            : localT.turf;
        global.GAIP_STATE = {
            soil: localT.soil,
            tissue: localT.tissue,
            water: localT.water,
            turf: _mergedTurf,
            traffic: localT.traffic,
            climate: localT.climate,
        };
    }

    test('production scenario: bowls site → non-bowls site → analysis run preserves no cotula keys', () => {
        const { win } = buildEnv();

        // 1. User on X Cotula BC. Cotula routed write has fired (b35fix388).
        applyCotulaRoutedWrite(win);
        expect(win.GAIP_STATE.inputs.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.inputs.turf.speciesKey).toBe('cotula');

        // 2. User switches to Canturf. site-config-persistence.js calls
        //    tp.selectTurfType('sports') — mocked here as a write that doesn't
        //    touch inputs.turf at all (TPC only updates tp.state and DOM).
        //    Then site-config-persistence calls clearBowlsState (b35fix394).
        applyClearBowlsState(win);

        // 3. Verify cotula keys are GONE from inputs.turf
        expect(win.GAIP_STATE.inputs.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.surfaceType).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.speciesKey).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.grassSpecies).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.physiology).toBeUndefined();
        // turfType also stripped (it was 'bowls')
        expect(win.GAIP_STATE.inputs.turf.turfType).toBeUndefined();

        // 4. Canturf analysis run completes. localT was built mid-run, with
        //    species coming from TPC.state (tallFescue).
        const canturfT = {
            soil: { K: 84, P: 25 },
            tissue: { N: 2.23 },
            water: {},
            turf: {
                turfType: 'sports',
                subCategory: 'football',
                grassSpecies: 'tallFescue',
                speciesKey: 'tallFescue',
                variety: 'generic',
            },
            traffic: {},
            climate: { lat: -35.31, lon: 149.18 }, // Fyshwick, AU
        };
        applyAnalysisEndWriteback(win, canturfT);

        // 5. Word export reads window.GAIP_STATE.turf — must see TALL FESCUE,
        //    not cotula. This is the production symptom check.
        expect(win.GAIP_STATE.turf.grassSpecies).toBe('tallFescue');
        expect(win.GAIP_STATE.turf.speciesKey).toBe('tallFescue');
        expect(win.GAIP_STATE.turf.turfType).toBe('sports');
        // Cotula keys MUST NOT have resurrected via the merge
        expect(win.GAIP_STATE.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.turf.surfaceType).toBeUndefined();
        expect(win.GAIP_STATE.turf.physiology).toBeUndefined();
    });

    test('regression frame: WITHOUT the fix, cotula keys persist into the next site analysis run', () => {
        // Replays the same scenario but skips clearBowlsState — confirms that
        // the bug class is correctly framed and the fix's absence reproduces
        // the production symptom.
        const { win } = buildEnv();

        applyCotulaRoutedWrite(win);

        // Skip clearBowlsState — simulating pre-b35fix394 site-config-persistence.

        const canturfT = {
            soil: {}, tissue: {}, water: {},
            turf: {
                turfType: 'sports',
                grassSpecies: 'tallFescue',
                speciesKey: 'tallFescue',
            },
            traffic: {}, climate: {},
        };
        applyAnalysisEndWriteback(win, canturfT);

        // The production bug: stale cotula keys from inputs.turf override
        // the new site's species via Object.assign({}, t.turf, freshTurf)
        // because freshTurf carries the stale cotula keys.
        expect(win.GAIP_STATE.turf.cotula).toBe(true);              // ← bug
        expect(win.GAIP_STATE.turf.grassSpecies).toBe('cotula');     // ← bug
        expect(win.GAIP_STATE.turf.speciesKey).toBe('cotula');       // ← bug
        expect(win.GAIP_STATE.turf.turfType).toBe('bowls');          // ← bug
        // tallFescue from t.turf is OVERWRITTEN by stale cotula in freshTurf
    });

    test('clearBowlsState preserves non-cotula fields (variety, hoc, custom data)', () => {
        const { win } = buildEnv();
        // Seed turf with a mix of cotula keys + unrelated TPC-set fields
        win.GAIP_STATE = {
            inputs: {
                turf: {
                    turfType: 'bowls',
                    cotula: true,
                    surfaceType: 'cotula_bowling_green',
                    speciesKey: 'cotula',
                    grassSpecies: 'cotula',
                    physiology: 'dicot',
                    // Non-cotula fields that should survive
                    variety: 'Penncross',
                    hoc: 5.5,
                    companionSpecies: ['poa'],
                    customField: 'preserved',
                }
            }
        };
        applyClearBowlsState(win);

        // Cotula keys gone
        expect(win.GAIP_STATE.inputs.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.surfaceType).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.speciesKey).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.grassSpecies).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.physiology).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.turfType).toBeUndefined();
        // Non-cotula fields preserved
        expect(win.GAIP_STATE.inputs.turf.variety).toBe('Penncross');
        expect(win.GAIP_STATE.inputs.turf.hoc).toBe(5.5);
        expect(Array.isArray(win.GAIP_STATE.inputs.turf.companionSpecies)).toBe(true);
        expect(win.GAIP_STATE.inputs.turf.customField).toBe('preserved');
    });

    test('clearBowlsState preserves non-bowls turfType (does not strip sports/golf etc.)', () => {
        const { win } = buildEnv();
        // Edge case: cotula cleanup is fired but turfType is already 'sports'
        // (e.g. concurrent TPC update has already landed). Strip the cotula
        // identity keys but preserve the legitimate non-bowls turfType.
        win.GAIP_STATE = {
            inputs: {
                turf: {
                    turfType: 'sports',  // already updated to non-bowls
                    cotula: true,         // stale flag
                    grassSpecies: 'cotula',
                }
            }
        };
        applyClearBowlsState(win);
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('sports');  // PRESERVED
        expect(win.GAIP_STATE.inputs.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.inputs.turf.grassSpecies).toBeUndefined();
    });

    test('clearBowlsState is idempotent — running twice produces same result', () => {
        const { win } = buildEnv();
        applyCotulaRoutedWrite(win);
        applyClearBowlsState(win);
        const afterFirst = JSON.parse(JSON.stringify(win.GAIP_STATE.inputs.turf));
        applyClearBowlsState(win);
        const afterSecond = JSON.parse(JSON.stringify(win.GAIP_STATE.inputs.turf));
        expect(afterSecond).toEqual(afterFirst);
    });

    test('clearBowlsState handles missing global.GAIP_STATE gracefully (no throw)', () => {
        const win = {}; // no GAIP_STATE
        // Mirror the production guard: function returns early
        expect(() => applyClearBowlsState(win)).not.toThrow();
    });

    test('clearBowlsState handles empty inputs.turf (no-op, no throw)', () => {
        const { win } = buildEnv();
        // Don't seed anything — inputs.turf is undefined
        expect(() => applyClearBowlsState(win)).not.toThrow();
        // After clear, inputs.turf is the empty object resulting from Object.assign({}, {})
        expect(win.GAIP_STATE.inputs.turf).toEqual({});
    });

    test('handleBowlsSelection still works after clearBowlsState (round-trip)', () => {
        // Verify the inverse: user activates bowls → clears it (e.g. accidental
        // non-bowls click then back to bowls) → re-activates bowls. Final state
        // must match a fresh handleBowlsSelection.
        const { win } = buildEnv();
        applyCotulaRoutedWrite(win);
        applyClearBowlsState(win);
        applyCotulaRoutedWrite(win);
        expect(win.GAIP_STATE.inputs.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.inputs.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.inputs.turf.speciesKey).toBe('cotula');
        expect(win.GAIP_STATE.inputs.turf.surfaceType).toBe('cotula_bowling_green');
        expect(win.GAIP_STATE.inputs.turf.physiology).toBe('dicot');
    });
});
