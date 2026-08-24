/**
 * GH-302 (D07 item 6 follow-up) — syncSoilFromDOM() falls back to
 * window.GAIP_HUB_CONFIG.soilTexture when the carried-over
 * GAIP_STATE.inputs.soil.soilTexture is missing.
 *
 * Confirmed live via debug instrumentation (since removed): plan.blade.php's
 * page-load bridge correctly sets soilTexture: 'sand' on
 * window.GAIP_HUB_CONFIG AND window.GAIP_STATE.inputs.soil (GH-294/301) —
 * but by the time the user clicks "Generate Nutrition Program", a later
 * soil-sample load (site-selector-ui.js's "Loaded soil sample" cascade,
 * which rebuilds GAIP_STATE.inputs.soil from the sample's own P/K/Ca/Mg/S
 * values — a sample has no concept of site-level soil texture) has silently
 * dropped the field. GH-300/301's AA ceiling (HillLabsSampleTypes.
 * deriveCode()) then saw soilTexture: null and correctly (per its own
 * graceful-degradation contract) found no certificate match — not a bug in
 * GH-300/301 itself, but an upstream data-loss bug that made every AA site
 * with a real soil texture behave as if it had none.
 *
 * FIX: window.GAIP_HUB_CONFIG.soilTexture is a more stable source for the
 * same value — a plain top-level config object set once by the page bridge,
 * never touched by sample-load code — so syncSoilFromDOM() falls back to it
 * when the carried-over value is missing, rather than trying to make every
 * sample-load call site preserve a field it doesn't know exists.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-302 — syncSoilFromDOM() falls back to GAIP_HUB_CONFIG.soilTexture', () => {
    let calendarSrc;

    beforeAll(() => {
        calendarSrc = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
    });

    test('fallback assignment is present and reads GAIP_HUB_CONFIG.soilTexture', () => {
        expect(calendarSrc).toMatch(
            /if \(!soilState\.soilTexture && window\.GAIP_HUB_CONFIG && window\.GAIP_HUB_CONFIG\.soilTexture\)\s*\{\s*soilState\.soilTexture\s*=\s*window\.GAIP_HUB_CONFIG\.soilTexture;/
        );
    });

    test('the fallback sits AFTER the existing carry-over (only fires when carry-over left it empty)', () => {
        const carryOverIdx = calendarSrc.indexOf('soilState = Object.assign({}, existing,');
        const fallbackIdx = calendarSrc.indexOf('if (!soilState.soilTexture && window.GAIP_HUB_CONFIG');
        expect(carryOverIdx).toBeGreaterThan(-1);
        expect(fallbackIdx).toBeGreaterThan(-1);
        expect(fallbackIdx).toBeGreaterThan(carryOverIdx);
    });

    test('the fallback sits BEFORE the writeback (so the recovered value is actually persisted back to GAIP_STATE)', () => {
        const fallbackIdx = calendarSrc.indexOf('if (!soilState.soilTexture && window.GAIP_HUB_CONFIG');
        const writebackIdx = calendarSrc.indexOf("Object.assign({}, _gs.inputs || {}, { soil: soilState })");
        expect(fallbackIdx).toBeGreaterThan(-1);
        expect(writebackIdx).toBeGreaterThan(-1);
        expect(writebackIdx).toBeGreaterThan(fallbackIdx);
    });

    test('does not clobber an already-present soilTexture (guarded by !soilState.soilTexture)', () => {
        const idx = calendarSrc.indexOf('if (!soilState.soilTexture && window.GAIP_HUB_CONFIG');
        expect(calendarSrc.slice(idx, idx + 30)).toMatch(/!soilState\.soilTexture/);
    });
});
