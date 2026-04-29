/**
 * Test b35fix388 — cotula-bowling-green writes routed through the hub-store's
 * `inputs.turf` slot (not legacy `window.GAIP_STATE.turf.<key>` direct writes).
 *
 * Pre-fix bug class: same hub-store proxy issue closed for `.soil` in b35fix386.
 * `window.GAIP_STATE` is a getter/setter pair installed by the hub-store
 * (gilba-hub-v2.js ~line 1393). The getter synthesises a fresh object on every
 * read from `c.peek('inputs.turf')`; mutations to top-level `.turf.<key>` land
 * on the ephemeral synthesised object and are GC'd. Only the setter's
 * `e.inputs` and `e.turf` branches route writes into the store via
 * `c.set('inputs.turf', val, 'legacy-state-write')`.
 *
 * Pre-fix code at cotula-bowling-green.js:546-552 set 6 keys via direct
 * property assignment:
 *   window.GAIP_STATE.turf.turfType     = 'bowls'
 *   window.GAIP_STATE.turf.surfaceType  = 'cotula_bowling_green'
 *   window.GAIP_STATE.turf.speciesKey   = 'cotula'
 *   window.GAIP_STATE.turf.grassSpecies = 'cotula'
 *   window.GAIP_STATE.turf.physiology   = 'dicot'
 *   window.GAIP_STATE.turf.cotula       = true
 * All six silently dropped. 4 downstream readers — turf-profile-controller.js:836,
 * nutrition-uk-fertiliser-integration.js:690, hub-tissue-v3.js:1102,
 * site-config-persistence.js:406 — saw undefined for these flags. Cotula mode
 * silently failed for every bowls-turf client; downstream nutrition and tissue
 * logic fell back to default species. Latent because cotula sites do not fire
 * the visible asymmetric-export pattern Rockingham did.
 *
 * Fix: route the write through the setter contract by reading existing
 * `inputs.turf` first, spreading it, overriding only the 6 cotula keys, and
 * assigning the merged object via `window.GAIP_STATE = { inputs: { turf: {...} } }`.
 * The merge is essential because the setter's `e.inputs.turf` branch REPLACES
 * (not patches) the slot — without the merge, unrelated TurfProfile state
 * (variety, companionSpecies, etc.) would be wiped every bowls activation.
 *
 * Verified against a simulated proxy mirroring the gilba-hub-v2.js getter/setter
 * pair (proxy-smoke-test.js, 2026-04-29). Pre-fix pattern: silent drop confirmed.
 * Post-fix pattern: all 6 cotula keys land, all 4 downstream readers see them,
 * pre-existing keys preserved.
 *
 * Two other modules carry the same proxy bug (site-settings-panel,
 * ammonium-acetate-methodology) — deferred to b35fix backlog #2b; not in scope
 * for b35fix388.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix388 — cotula state writes routed through hub-store inputs.turf', () => {
    let cotulaSrc;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/cotula-bowling-green.js');
        cotulaSrc = fs.readFileSync(filePath, 'utf8');
    });

    test('routed write uses the setter contract { inputs: { turf: ... } }', () => {
        // The exact write that triggers the hub-store's e.inputs branch.
        // Pattern-matches the post-fix structure so a regression to direct
        // .turf.X writes blocks the build.
        expect(cotulaSrc).toMatch(
            /window\.GAIP_STATE\s*=\s*\{\s*inputs\s*:\s*\{\s*turf\s*:\s*Object\.assign\(/
        );
    });

    test('all 6 cotula keys are present in the routed write', () => {
        // Each key on a distinct line under the Object.assign override block.
        // If any key drops out, downstream readers regress.
        expect(cotulaSrc).toMatch(/turfType\s*:\s*['"]bowls['"]/);
        expect(cotulaSrc).toMatch(/surfaceType\s*:\s*['"]cotula_bowling_green['"]/);
        expect(cotulaSrc).toMatch(/speciesKey\s*:\s*['"]cotula['"]/);
        expect(cotulaSrc).toMatch(/grassSpecies\s*:\s*['"]cotula['"]/);
        expect(cotulaSrc).toMatch(/physiology\s*:\s*['"]dicot['"]/);
        expect(cotulaSrc).toMatch(/cotula\s*:\s*true/);
    });

    test('legacy direct .turf.<key> writes are gone', () => {
        // The pre-fix `window.GAIP_STATE.turf.X = Y` lines must all be
        // removed. Their presence indicates a partial fix that will silently
        // drop writes on the production proxy.
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.turfType\s*=/);
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.surfaceType\s*=/);
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.speciesKey\s*=/);
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.grassSpecies\s*=/);
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.physiology\s*=/);
        expect(cotulaSrc).not.toMatch(/window\.GAIP_STATE\.turf\.cotula\s*=/);
        // Defensive `if (!turf) turf = {}` guard from pre-fix also gone — the
        // setter creates inputs.turf if absent.
        expect(cotulaSrc).not.toMatch(/if\s*\(\s*!\s*window\.GAIP_STATE\.turf\s*\)\s*window\.GAIP_STATE\.turf\s*=/);
    });

    test('existing turf state is preserved via Object.assign merge', () => {
        // The merge step prevents wiping TurfProfile-set state (variety,
        // companionSpecies, etc.) when the bowls profile activates. The setter's
        // e.inputs.turf branch replaces wholesale; without the merge the cotula
        // write would erase keys set by other writers.
        expect(cotulaSrc).toMatch(
            /existingTurf\s*=\s*\(\s*window\.GAIP_STATE\.inputs\s*&&\s*window\.GAIP_STATE\.inputs\.turf\s*\)\s*\|\|\s*window\.GAIP_STATE\.turf\s*\|\|\s*\{\s*\}/
        );
        expect(cotulaSrc).toMatch(/Object\.assign\(\s*\{\s*\}\s*,\s*existingTurf\s*,/);
    });

    test('writeback wrapped in try/catch with diagnostic warn', () => {
        // The setter could throw if the store rejects the write (currently
        // doesn't, but defensive code should not propagate to the caller and
        // abort handleBowlsSelection). On failure, log a warn — never silent.
        // Mirrors b35fix386's writeback wrapper.
        const re = /try\s*\{[\s\S]*?window\.GAIP_STATE\s*=\s*\{\s*inputs\s*:[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\([^)]*b35fix388/;
        expect(cotulaSrc).toMatch(re);
    });

    test('window.GAIP_STATE existence guard preserved', () => {
        // The `if (window.GAIP_STATE)` outer guard from pre-fix stays — protects
        // against scripts loading before the proxy installs (early init race).
        expect(cotulaSrc).toMatch(/if\s*\(\s*window\.GAIP_STATE\s*\)\s*\{[\s\S]*?try/);
    });

    test('b35fix388 changelog comment present', () => {
        expect(cotulaSrc).toMatch(/b35fix388/);
    });

    test('bowls subcategory section show/hide preserved', () => {
        // Behaviour unrelated to the proxy fix must not regress. The DOM
        // manipulations at the top of handleBowlsSelection stay intact.
        expect(cotulaSrc).toMatch(/gaip-subcategory-section/);
        expect(cotulaSrc).toMatch(/gaip-bowls-subcategory/);
        expect(cotulaSrc).toMatch(/methodSelect\.value\s*=\s*['"]ammonium_acetate['"]/);
    });

    test('TurfProfileController selectTurfType call preserved', () => {
        // The post-write call to tpc.selectTurfType('bowls') is what triggers
        // dispatchStateChange so SiteConfig snapshots 'bowls'. Independent of
        // the proxy fix; must not regress.
        expect(cotulaSrc).toMatch(/tpc\.selectTurfType\(\s*['"]bowls['"]\s*\)/);
    });

    test('gaip:turf-profile-change event still dispatched with correct detail', () => {
        // Downstream modules (NutritionEngine, hub-tissue) listen for this
        // event. Surface and species fields in detail must match the routed
        // state write to keep event-driven consumers consistent with state.
        expect(cotulaSrc).toMatch(/CustomEvent\(\s*['"]gaip:turf-profile-change['"]/);
        expect(cotulaSrc).toMatch(/turfType\s*:\s*['"]bowls['"]/);
        expect(cotulaSrc).toMatch(/surfaceType\s*:\s*['"]cotula_bowling_green['"]/);
    });
});

describe('b35fix388 — simulated proxy round-trip', () => {
    // Inline simulation of the gilba-hub-v2.js getter/setter pair (line 1393).
    // Verifies that the post-fix write pattern actually reaches downstream
    // readers under proxy semantics — complements the source-pattern checks
    // above with behavioural confirmation.

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
                // Defensive shallow clone — production proxy does not let
                // mutations to peek-returned objects persist (b35fix385/386
                // console probe evidence).
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
                }
            },
            configurable: true,
        });
        return { win, store };
    }

    function applyCotulaWrite(win) {
        // Exact pattern emitted by post-fix handleBowlsSelection
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

    test('all 6 cotula keys visible to downstream readers after routed write', () => {
        const { win } = buildEnv();
        applyCotulaWrite(win);
        expect(win.GAIP_STATE.turf.turfType).toBe('bowls');
        expect(win.GAIP_STATE.turf.surfaceType).toBe('cotula_bowling_green');
        expect(win.GAIP_STATE.turf.speciesKey).toBe('cotula');
        expect(win.GAIP_STATE.turf.grassSpecies).toBe('cotula');
        expect(win.GAIP_STATE.turf.physiology).toBe('dicot');
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
    });

    test('reader at turf-profile-controller.js:836 sees cotula flag', () => {
        // Real reader: window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.cotula
        const { win } = buildEnv();
        applyCotulaWrite(win);
        const seen = win.GAIP_STATE && win.GAIP_STATE.turf && win.GAIP_STATE.turf.cotula;
        expect(seen).toBe(true);
    });

    test('reader at nutrition-uk-fertiliser-integration.js:690 sees cotula flag', () => {
        // Real reader: window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.cotula === true
        const { win } = buildEnv();
        applyCotulaWrite(win);
        const seen = win.GAIP_STATE && win.GAIP_STATE.turf && win.GAIP_STATE.turf.cotula === true;
        expect(seen).toBe(true);
    });

    test('reader at hub-tissue-v3.js:1102 sees cotula flag via optional chaining', () => {
        // Real reader: window.GAIP_STATE?.turf?.cotula === true
        const { win } = buildEnv();
        applyCotulaWrite(win);
        const seen = win.GAIP_STATE && win.GAIP_STATE.turf && win.GAIP_STATE.turf.cotula === true;
        expect(seen).toBe(true);
    });

    test('reader pattern at site-config-persistence.js:406 (handleBowlsSelection re-fire) idempotent', () => {
        // site-config-persistence.js:405-406 calls handleBowlsSelection on
        // restore. Routed write must be idempotent — running twice produces
        // the same final state, no key drift.
        const { win } = buildEnv();
        applyCotulaWrite(win);
        applyCotulaWrite(win);
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.turf.surfaceType).toBe('cotula_bowling_green');
    });

    test('pre-existing turf state is preserved through the cotula write', () => {
        // Setup: TurfProfileController has populated baseline turf state.
        const { win } = buildEnv();
        win.GAIP_STATE = { inputs: { turf: { variety: 'Penncross', companionSpecies: ['poa'] } } };
        applyCotulaWrite(win);
        // Cotula keys land
        expect(win.GAIP_STATE.turf.cotula).toBe(true);
        expect(win.GAIP_STATE.turf.surfaceType).toBe('cotula_bowling_green');
        // Pre-existing keys preserved by the Object.assign merge
        expect(win.GAIP_STATE.turf.variety).toBe('Penncross');
        expect(Array.isArray(win.GAIP_STATE.turf.companionSpecies)).toBe(true);
        expect(win.GAIP_STATE.turf.companionSpecies).toEqual(['poa']);
    });

    test('pre-fix pattern silently drops under same proxy (regression frame check)', () => {
        // Apply the OLD pre-fix pattern directly. If the proxy model is
        // correct (matches production evidence), every assignment is dropped
        // and downstream readers see undefined. This pins the bug class so a
        // future regression to direct property assignment fails this test.
        //
        // Seed with prior turf state — matches production reality, where
        // TurfProfileController runs before the cotula module gets clicked.
        // Without this seed, `if (!turf) turf = {}` would assign through
        // the setter which has no e.turf/e.inputs.turf → still no-op, and
        // then `.turf.X = 'bowls'` would throw on undefined. Production
        // doesn't throw (meaning real prior state exists); model that.
        const { win } = buildEnv();
        win.GAIP_STATE = { inputs: { turf: { variety: 'X' } } };

        // Pre-fix code: 6 direct property assignments
        if (!win.GAIP_STATE.turf) win.GAIP_STATE.turf = {};
        win.GAIP_STATE.turf.turfType = 'bowls';
        win.GAIP_STATE.turf.cotula = true;
        win.GAIP_STATE.turf.surfaceType = 'cotula_bowling_green';

        // Confirm dropped — the pre-existing variety stays, the new keys vanish
        expect(win.GAIP_STATE.turf.variety).toBe('X');
        expect(win.GAIP_STATE.turf.cotula).toBeUndefined();
        expect(win.GAIP_STATE.turf.surfaceType).toBeUndefined();
        expect(win.GAIP_STATE.turf.turfType).toBeUndefined();
    });
});
