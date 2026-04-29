/**
 * Test b35fix386 — syncSoilFromDOM writeback + collectFromState read routed
 * through the hub-store's `inputs.soil` slot (not legacy top-level `.soil`).
 *
 * Pre-fix bug: `window.GAIP_STATE` is a getter/setter pair installed by the
 * hub-store, not a plain data property. The getter synthesises a fresh
 * object on every read from `c.peek('inputs')`, `c.peek('computed')`,
 * `c.peek('inputs.turf')`, etc.; assignments to top-level `.soil` land on
 * that ephemeral object and are GC'd. Only the setter's `e.inputs` branch
 * routes writes into the actual store via `c.transaction((t) => t.set(
 * 'inputs.<key>', val, 'legacy-state-write'))`.
 *
 * Net effect of the pre-fix `window.GAIP_STATE.soil = soilState` writeback:
 * silently dropped on every call. `collectFromState` then read `state.soil`
 * → undefined → `extractPpm(soil, 'K')` returned 0 across the board,
 * producing the soilSeenK=0 / annualK=108 production symptom (b35fix382
 * production logs gilbasolutions_com-1777411515258).
 *
 * Diagnosed via console probes 2026-04-29:
 *   - `Object.getOwnPropertyDescriptor(window, 'GAIP_STATE')` showed
 *     `{enumerable:false, configurable:true, get:ƒ, set:ƒ}`
 *   - direct `window.GAIP_STATE.soil = {...}` from console produced
 *     `window.GAIP_STATE.soil === undefined` afterwards — confirms drop
 *   - `window.GAIP_STATE = { inputs: { soil: {...} } }` produced
 *     `window.GAIP_STATE.inputs.soil` carrying the written object — confirms
 *     the setter route works
 *   - `_gilbaAnalysisRunCount` unchanged after the routed write — no
 *     analysis-cascade re-trigger, safe to call from inside `generate()`
 *
 * Fix:
 *   1. Writeback in syncSoilFromDOM: `window.GAIP_STATE = { inputs: {
 *      soil: soilState } }` (triggers setter's e.inputs transaction branch)
 *   2. Carry-over read at top of syncSoilFromDOM: prefer
 *      `state.inputs.soil` over the legacy `state.soil`
 *   3. Read in collectFromState: prefer `state.inputs.soil` over
 *      `state.soil` (the synthesised state never has top-level `.soil`)
 *   4. surfaceType resolution in collectFromState: read from the locally
 *      resolved `soil` const, not `state.soil` directly
 *
 * Three other modules carry the same proxy bug (cotula-bowling-green,
 * site-settings-panel, ammonium-acetate-methodology) — flagged for
 * separate audits; not in scope for b35fix386.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix386 — writeback routed through hub-store inputs.soil', () => {
    let calendarSrc;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/nutrition-calendar.js');
        calendarSrc = fs.readFileSync(filePath, 'utf8');
    });

    test('writeback uses the setter contract { inputs: { soil: ... } }', () => {
        // The exact write that triggers the hub-store's e.inputs branch.
        // Pre-fix was `window.GAIP_STATE.soil = soilState` which the proxy
        // setter ignored. Pattern-match the post-fix write directly so a
        // regression to the legacy form blocks the build.
        expect(calendarSrc).toMatch(
            /window\.GAIP_STATE\s*=\s*\{\s*inputs\s*:\s*\{\s*soil\s*:\s*soilState\s*\}\s*\}/
        );
    });

    test('legacy top-level writeback is gone', () => {
        // The pre-fix `window.GAIP_STATE.soil = soilState` line must be
        // removed. Its presence indicates a partial fix that will silently
        // drop writes on the production proxy.
        expect(calendarSrc).not.toMatch(/window\.GAIP_STATE\.soil\s*=\s*soilState/);
    });

    test('collectFromState reads from inputs.soil first, state.soil fallback', () => {
        // The canonical read path. Pattern is intentionally tolerant of
        // optional-chaining vs explicit-and to allow style refactors.
        expect(calendarSrc).toMatch(
            /const\s+soil\s*=\s*\(\s*state\.inputs\s*&&\s*state\.inputs\.soil\s*\)\s*\|\|\s*state\.soil\s*\|\|\s*\{\s*\}/
        );
    });

    test('syncSoilFromDOM carry-over read also prefers inputs.soil', () => {
        // The top-of-function carry-over branch. Same proxy issue applies:
        // `state.soil` alone is undefined, so the carry-over silently
        // falls through. After fix it reads from inputs.soil first.
        expect(calendarSrc).toMatch(
            /var\s+existing\s*=\s*\(\s*window\.GAIP_STATE\.inputs\s*&&\s*window\.GAIP_STATE\.inputs\.soil\s*\)\s*\|\|\s*window\.GAIP_STATE\.soil/
        );
    });

    test('surfaceType resolution uses local soil const, not state.soil', () => {
        // The `surfaceType` line in collectFromState. Pre-fix read
        // `state.soil?.surfaceType` which is undefined under the proxy
        // (synthesiser doesn't expose top-level `.soil`); post-fix reads
        // `soil.surfaceType` from the locally resolved const above.
        expect(calendarSrc).toMatch(
            /const\s+surfaceType\s*=\s*soil\.surfaceType\s*\|\|\s*state\.turf\?\.subCategory/
        );
        // Pre-fix form must be gone.
        expect(calendarSrc).not.toMatch(/state\.soil\?\.surfaceType/);
    });

    test('writeback wrapped in try/catch with diagnostic warn', () => {
        // The setter could throw if the store rejects the write (it
        // currently doesn't, but defensive code should not mutate the
        // function's caller path). On failure, log a warn — never silent.
        const re = /try\s*\{\s*window\.GAIP_STATE\s*=\s*\{\s*inputs\s*:[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\(/;
        expect(calendarSrc).toMatch(re);
    });

    test('b35fix385 diagnostic instrumentation has been removed', () => {
        // The diagnostic served its purpose (localised the proxy bug).
        // It must be removed in b35fix386 to keep the file clean. No
        // _b35fix385_dbg variable, no [NutritionCalendar b35fix385] log.
        expect(calendarSrc).not.toMatch(/_b35fix385_dbg/);
        expect(calendarSrc).not.toMatch(/\[NutritionCalendar b35fix385\]/);
    });

    test('b35fix386 changelog comment present', () => {
        expect(calendarSrc).toMatch(/b35fix386/);
    });

    test('b35fix383 SampleManager-priority block preserved', () => {
        // b35fix386 is a writeback fix only — must not regress b35fix383's
        // SampleManager-priority read. SM block must still appear before
        // DOM scan; activeSoil.normalized must still be the source.
        expect(calendarSrc).toMatch(/GAIP_SampleManager/);
        expect(calendarSrc).toMatch(/getActiveSample\(['"]soil['"]\)/);
        expect(calendarSrc).toMatch(/activeSoil\.normalized/);
        const smIdx = calendarSrc.indexOf('GAIP_SampleManager');
        const domIdx = calendarSrc.indexOf("document.querySelector(`[data-mlsn=");
        expect(smIdx).toBeGreaterThan(0);
        expect(domIdx).toBeGreaterThan(smIdx);
    });

    test('b35fix384 DOM-scan zero-rejection guard preserved', () => {
        // The DOM scan after the SM block must still gate writes on
        // `value > 0` so empty/zero placeholders cannot zero out the
        // SampleManager-set value. b35fix386 changes the writeback path
        // but does not relax this guard.
        const m = calendarSrc.match(
            /PRIORITY 2[\s\S]*?nutrients\.forEach[\s\S]*?\}\);/
        );
        expect(m).toBeTruthy();
        expect(m[0]).toMatch(/value\s*>\s*0/);
    });
});
