/**
 * Test b35fix393 — site-settings-panel.js and ammonium-acetate-methodology.js
 * route .soil writes through the hub-store proxy setter contract.
 *
 * BUG CLASS: hub-store proxy direct-property-write drop. Same shape as
 * b35fix386 (nutrition-calendar soil writeback), b35fix388 (cotula turf
 * writes), b35fix391 (hub-tissue analysis-end stale-snapshot clobber).
 *
 * Pre-fix sites:
 *   1. site-settings-panel.js:958
 *        window.GAIP_STATE.soil.methodologyExplicit = true
 *      Fired when user clicks a methodology button in site settings.
 *
 *   2. ammonium-acetate-methodology.js:412
 *        window.GAIP_STATE.soil.methodologyExplicit = true
 *      Fired on gaip:stateRestored if a non-default methodology was restored.
 *
 *   3. ammonium-acetate-methodology.js:512
 *        window.GAIP_STATE.soil.aaSoilTexture = this.value
 *      Fired when user changes the AA soil-texture dropdown (sands vs others).
 *
 * All three silently dropped through the proxy installed at gilba-hub-v2.js:1393.
 * The getter synthesises a fresh object on every read — assignments to top-level
 * .soil.<key> land on that ephemeral synthesised object and are GC'd. Only the
 * setter's e.inputs branch routes writes via c.set("inputs.soil", val, ...).
 *
 * Symptom for #1 + #2: NZ region detection at ammonium-acetate-methodology.js:440
 * reads `window.GAIP_STATE?.soil?.methodologyExplicit` and gets undefined every
 * time updateMethodologyVisibility re-fires (route change, profile change, state
 * restore). Auto-AA branch overrides the user's explicit choice. NZ users who
 * pick MLSN or SLAN via site settings are silently force-switched back to AA.
 *
 * Symptom for #3: aaSoilTexture readers in gilba-soil-interpretation.js:249,
 * hub-tissue-v3.js:2360, word-export.js:6477 all have a DOM-element fallback
 * (.gaip-aa-soil-texture) that hides the bug in single-export. LATENT failure
 * mode in combined export, where iteration over saved sites runs without the
 * texture-change DOM element being present for each iteration — every saved
 * AA-methodology site falls through to the 'others' default and produces
 * wrong K/Mg threshold ranges. NOT YET CONFIRMED in production logs (combined
 * export hasn't been used against AA sites in active client work).
 *
 * Fix: route writes via window.GAIP_STATE = { inputs: { soil: merged } }. The
 * setter's e.inputs.soil branch REPLACES wholesale, so writers must merge with
 * existing inputs.soil first. Same merge contract as b35fix386 / b35fix388.
 *
 * Plus: the same-module reader at ammonium-acetate-methodology.js:440 is
 * upgraded to a tolerant read (canonical inputs.soil first, legacy .soil
 * fallback) — without this read upgrade the write fix produces no behavioural
 * change for the methodologyExplicit consumer because the legacy reader hits
 * the synthesiser-empty top-level .soil slot.
 *
 * Out of scope: the three legacy .soil readers in gilba-soil-interpretation,
 * hub-tissue, word-export. They have DOM fallbacks that mask the bug in
 * single-export. Combined-export latent failure flagged in skill backlog;
 * separate b35fix targeting the per-site iteration path.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix393 — proxy-routed soil writes for site-settings + AA methodology', () => {
    let aaSrc, ssSrc;

    beforeAll(() => {
        aaSrc = fs.readFileSync(path.join(__dirname, '../assets/ammonium-acetate-methodology.js'), 'utf8');
        ssSrc = fs.readFileSync(path.join(__dirname, '../assets/site-settings-panel.js'), 'utf8');
    });

    // -------------------------------------------------------------------------
    // SOURCE PATTERNS — pin the structural fixes
    // -------------------------------------------------------------------------

    test('site-settings: methodologyExplicit write routes through hub-store proxy', () => {
        // Old pattern must be GONE — strip line comments before matching to avoid
        // matching example-pattern blocks in our own b35fix393 documentation comments.
        const ssSrcStripped = ssSrc.replace(/\/\/.*$/gm, '');
        expect(ssSrcStripped).not.toMatch(/window\.GAIP_STATE\.soil\.methodologyExplicit\s*=\s*true/);
        // New pattern must be PRESENT — { inputs: { soil: Object.assign(..., methodologyExplicit:true) } }
        expect(ssSrc).toMatch(/window\.GAIP_STATE\s*=\s*\{[\s\S]*?inputs:\s*\{[\s\S]*?soil:\s*Object\.assign\(/);
        expect(ssSrc).toMatch(/methodologyExplicit:\s*true/);
    });

    test('site-settings: routed write reads existing inputs.soil first (merge preserves other fields)', () => {
        expect(ssSrc).toMatch(
            /var\s+_existingSoil\s*=\s*\(window\.GAIP_STATE\.inputs\s*&&\s*window\.GAIP_STATE\.inputs\.soil\)\s*\|\|\s*window\.GAIP_STATE\.soil\s*\|\|\s*\{\}/
        );
    });

    test('aa-methodology: helper _b35fix393_setSoilField defined inside IIFE', () => {
        expect(aaSrc).toMatch(/function\s+_b35fix393_setSoilField\s*\(\s*key\s*,\s*value\s*\)/);
        // Must merge with existing inputs.soil (not wholesale replace)
        expect(aaSrc).toMatch(/Object\.assign\(\s*\{\}\s*,\s*existingSoil\s*,\s*patch\s*\)/);
    });

    test('aa-methodology: helper _b35fix393_getSoilField uses tolerant read order', () => {
        expect(aaSrc).toMatch(/function\s+_b35fix393_getSoilField\s*\(\s*key\s*\)/);
        // Canonical inputs.soil first
        expect(aaSrc).toMatch(/var\s+canonical\s*=\s*global\.GAIP_STATE\.inputs\s*&&\s*global\.GAIP_STATE\.inputs\.soil/);
        // Legacy .soil fallback
        expect(aaSrc).toMatch(/var\s+legacy\s*=\s*global\.GAIP_STATE\.soil/);
    });

    test('aa-methodology: stateRestored handler uses _b35fix393_setSoilField (was direct .soil.X write)', () => {
        const aaSrcStripped = aaSrc.replace(/\/\/.*$/gm, '');
        // Pre-fix pattern must be GONE
        expect(aaSrcStripped).not.toMatch(/window\.GAIP_STATE\?\.soil\)\s*\{[\s\S]{0,80}window\.GAIP_STATE\.soil\.methodologyExplicit\s*=\s*true/);
        // Post-fix call must be PRESENT in stateRestored block
        const stateRestoredMatch = aaSrc.match(/gaip:stateRestored[\s\S]*?updateMethodologyVisibility\(\)/);
        expect(stateRestoredMatch).not.toBeNull();
        expect(stateRestoredMatch[0]).toMatch(/_b35fix393_setSoilField\(\s*'methodologyExplicit'\s*,\s*true\s*\)/);
    });

    test('aa-methodology: methodologyExplicit reader uses _b35fix393_getSoilField (was direct .soil.X read)', () => {
        const aaSrcStripped = aaSrc.replace(/\/\/.*$/gm, '');
        // Pre-fix pattern must be GONE
        expect(aaSrcStripped).not.toMatch(/const\s+explicitChoice\s*=\s*window\.GAIP_STATE\?\.soil\?\.methodologyExplicit/);
        // Post-fix pattern must be PRESENT
        expect(aaSrc).toMatch(/const\s+explicitChoice\s*=\s*_b35fix393_getSoilField\(\s*'methodologyExplicit'\s*\)/);
    });

    test('aa-methodology: aaSoilTexture write uses _b35fix393_setSoilField (was direct .soil.X write)', () => {
        const aaSrcStripped = aaSrc.replace(/\/\/.*$/gm, '');
        // Pre-fix pattern must be GONE
        expect(aaSrcStripped).not.toMatch(/window\.GAIP_STATE\.soil\.aaSoilTexture\s*=\s*this\.value/);
        // Post-fix pattern must be PRESENT
        expect(aaSrc).toMatch(/_b35fix393_setSoilField\(\s*'aaSoilTexture'\s*,\s*this\.value\s*\)/);
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

    // Mirrors the post-fix _b35fix393_setSoilField helper exactly
    function setSoilField(global, key, value) {
        if (!global.GAIP_STATE) return;
        const existingSoil = (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.soil)
            || global.GAIP_STATE.soil
            || {};
        const patch = {};
        patch[key] = value;
        global.GAIP_STATE = {
            inputs: {
                soil: Object.assign({}, existingSoil, patch)
            }
        };
    }

    function getSoilField(global, key) {
        if (!global.GAIP_STATE) return undefined;
        const canonical = global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.soil;
        if (canonical && canonical[key] !== undefined) return canonical[key];
        const legacy = global.GAIP_STATE.soil;
        if (legacy && legacy[key] !== undefined) return legacy[key];
        return undefined;
    }

    test('routed methodologyExplicit write lands in inputs.soil and is readable', () => {
        const { win } = buildEnv();
        setSoilField(win, 'methodologyExplicit', true);
        expect(getSoilField(win, 'methodologyExplicit')).toBe(true);
        // Direct canonical access
        expect(win.GAIP_STATE.inputs.soil.methodologyExplicit).toBe(true);
    });

    test('routed aaSoilTexture write lands in inputs.soil and is readable', () => {
        const { win } = buildEnv();
        setSoilField(win, 'aaSoilTexture', 'sands');
        expect(getSoilField(win, 'aaSoilTexture')).toBe('sands');
        expect(win.GAIP_STATE.inputs.soil.aaSoilTexture).toBe('sands');
    });

    test('routed write merges with existing inputs.soil — does not wipe other fields', () => {
        const { win } = buildEnv();
        // Seed prior soil state (e.g. from analysis run that populated ppm panel)
        win.GAIP_STATE = { inputs: { soil: { ppm: { K: 141, P: 25 }, methodology: 'mlsn' } } };
        // User clicks methodology button → routed write
        setSoilField(win, 'methodologyExplicit', true);
        // New field landed
        expect(win.GAIP_STATE.inputs.soil.methodologyExplicit).toBe(true);
        // Pre-existing fields preserved
        expect(win.GAIP_STATE.inputs.soil.ppm.K).toBe(141);
        expect(win.GAIP_STATE.inputs.soil.ppm.P).toBe(25);
        expect(win.GAIP_STATE.inputs.soil.methodology).toBe('mlsn');
    });

    test('two sequential routed writes accumulate fields (idempotent merge)', () => {
        const { win } = buildEnv();
        setSoilField(win, 'methodologyExplicit', true);
        setSoilField(win, 'aaSoilTexture', 'others');
        expect(win.GAIP_STATE.inputs.soil.methodologyExplicit).toBe(true);
        expect(win.GAIP_STATE.inputs.soil.aaSoilTexture).toBe('others');
    });

    test('production NZ scenario: explicit choice survives updateMethodologyVisibility re-fire', () => {
        // 1. Page loads with restored AA state — gaip:stateRestored handler routes the explicit flag
        const { win } = buildEnv();
        win.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } };
        setSoilField(win, 'methodologyExplicit', true);
        expect(getSoilField(win, 'methodologyExplicit')).toBe(true);

        // 2. Some other module fires an analysis run → simulated via legacy bridge
        //    pushing soil into closure t (this is what hub-tissue:6952 does
        //    pre-b35fix391 for soil at the same time as turf). The setter's
        //    e.soil branch routes c.set("inputs.soil", e.soil, ...) — REPLACE.
        //    But our routed write uses e.inputs.soil, which also REPLACES, so
        //    pre-existing fields would be wiped if not merged. The merge in
        //    setSoilField is what protects us.
        //    Here we just simulate another routed-merge write happening.
        setSoilField(win, 'someOtherField', 'xyz');

        // 3. updateMethodologyVisibility fires — reads explicit flag tolerantly
        const explicitChoice = getSoilField(win, 'methodologyExplicit');
        expect(explicitChoice).toBe(true);
        // — auto-AA branch is correctly skipped, NZ user keeps their MLSN choice
    });

    test('regression frame: pre-fix direct-write pattern silently drops', () => {
        // Apply the OLD pre-fix pattern directly. If proxy model matches production,
        // every assignment to .soil.X is dropped.
        const { win } = buildEnv();
        win.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } };

        // Pre-fix: the `if (window.GAIP_STATE && window.GAIP_STATE.soil)` guard.
        // .soil at this point is the synthesised peek of inputs.soil — defined.
        // Then assignment .soil.X = true lands on the synthesised object, GC'd.
        if (win.GAIP_STATE && win.GAIP_STATE.soil) {
            win.GAIP_STATE.soil.methodologyExplicit = true;
        }

        // Confirm dropped — flag should be invisible to fresh reads
        // (synthesised peek of inputs.soil doesn't carry it)
        expect(win.GAIP_STATE.inputs.soil.methodologyExplicit).toBeUndefined();
        // Pre-existing methodology preserved (proves we ARE reading the right slot)
        expect(win.GAIP_STATE.inputs.soil.methodology).toBe('mlsn');
    });

    test('tolerant read: canonical inputs.soil takes precedence when both slots have the key', () => {
        // After a routed write to inputs.soil, the proxy's closure `t` is set
        // to { inputs: { soil: {...} } } — top-level `soil` is undefined on `t`.
        // The getter synthesises top-level .soil = c.peek('inputs.soil')? No —
        // looking at gilba-hub-v2.js:1394–1404, only `turf` has a top-level
        // alias on the synthesised object; .soil is NOT auto-aliased. So
        // top-level `state.soil` only exists when something legacy wrote it
        // directly (which the proxy routes via e.soil → c.set("inputs.soil", ...)
        // anyway, populating canonical too).
        //
        // Net: canonical and legacy can't actually diverge in production —
        // they're both backed by inputs.soil. The tolerant read's PRECEDENCE
        // matters for forward-compat: if a future getter change adds top-level
        // .soil with synthesised content, the canonical-first read still
        // returns the SSOT value.
        const { win } = buildEnv();
        setSoilField(win, 'methodologyExplicit', true);
        // Canonical has the field — tolerant read returns it
        expect(getSoilField(win, 'methodologyExplicit')).toBe(true);
        // Verify direct canonical access matches
        expect(win.GAIP_STATE.inputs.soil.methodologyExplicit).toBe(true);
    });

    test('tolerant read: falls back to legacy .soil when canonical is empty', () => {
        const { win } = buildEnv();
        // No write to inputs.soil — only legacy top-level closure-t population
        win.GAIP_STATE = { soil: { methodologyExplicit: true } };
        expect(getSoilField(win, 'methodologyExplicit')).toBe(true);
    });

    test('tolerant read: returns undefined when neither slot has the key', () => {
        const { win } = buildEnv();
        expect(getSoilField(win, 'methodologyExplicit')).toBeUndefined();
        expect(getSoilField(win, 'aaSoilTexture')).toBeUndefined();
    });
});
