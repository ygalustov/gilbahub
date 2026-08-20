/**
 * Test GH-275 — clearSoilData() no longer resets .gaip-soil-texture on a
 * site switch (domOnly=true).
 *
 * ROOT CAUSE: a FIFTH independent write path to `.gaip-soil-texture`, found
 * by patching HTMLSelectElement.prototype's value setter and reading the
 * resulting stack trace after GH-272/273/274 all failed to fix the live
 * symptom. `gaip-clear-data.js` listens for `gaip:site-changed` (fired by
 * `sample-manager.js`'s `setActiveSite()`, itself called during the normal
 * server-sample-sync flow in `sample-persistence.js`) and calls
 * `clearSoilData(btn, domOnly=true)` to wipe stale numeric sample fields
 * (pH/EC/CEC/nutrient grid) left over from the PREVIOUS site -- necessary,
 * since those are genuinely stale per-sample lab values that would otherwise
 * feed a phantom result for the new site. But the same function also called
 * `resetSelect(SELECTORS.soilTexture, 'loam')` completely unconditionally --
 * unlike the SampleManager-store clear a few lines below it (already
 * correctly gated behind `!domOnly`), the select reset ran on every site
 * switch too, silently overwriting `hub.blade.php`'s GH-270 live,
 * site-derived initial value with the hardcoded "loam" default moments
 * after page load, before mlsnEngine() or the hub-persistence.js fallback
 * ever got a chance to read the correct value. Confirmed live via a
 * captured stack trace (Russley, site 019f35f0...): `.gaip-soil-texture`
 * value SET to 'loam' at resetSelect <- clearSoilData <- (gaip:site-changed
 * listener) <- setActiveSite <- sample-persistence.js's server-sync flow --
 * on every single page load, explaining why GH-272/273/274 (all logically
 * correct, all unit-tested) never fixed the live symptom: none of them
 * touched this fifth mechanism.
 *
 * FIX: same reasoning as GH-272/274 -- soil texture is a site property, not
 * per-sample data, so a "clear stale sample data on site switch" routine has
 * no business touching it. Gated the reset behind `!domOnly`, mirroring the
 * SampleManager-clear line immediately below it. The reset still fires for
 * an explicit user-clicked Clear button (domOnly=false) -- that's an
 * intentional, unrelated "start this form over" action, not stale-data
 * cleanup, and is out of scope here.
 */

const fs = require('fs');
const path = require('path');

describe('GH-275 — clearSoilData() leaves .gaip-soil-texture alone on site switch', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/gaip-clear-data.js'), 'utf8');
    });

    function extractClearSoilData() {
        const start = src.indexOf('function clearSoilData(btn, domOnly)');
        const end = src.indexOf('\n    // =========', start + 10);
        return src.slice(start, end);
    }

    test('the old unconditional reset is gone', () => {
        const block = extractClearSoilData();
        expect(block).not.toMatch(/^\s*resetSelect\(SELECTORS\.soilTexture, 'loam'\);/m);
    });

    test('soilTexture reset is now gated behind !domOnly', () => {
        const block = extractClearSoilData();
        expect(block).toMatch(/if\s*\(\s*!domOnly\s*\)\s*resetSelect\(SELECTORS\.soilTexture,\s*'loam'\)/);
    });

    test('samplingDepth reset is untouched (still unconditional, scoped fix only)', () => {
        const block = extractClearSoilData();
        expect(block).toMatch(/^\s*resetSelect\(SELECTORS\.samplingDepth, ''\);/m);
    });

    test('the SampleManager-store clear a few lines below keeps its own existing !domOnly gate (unaffected)', () => {
        const block = extractClearSoilData();
        expect(block).toMatch(/if\s*\(!domOnly\s*&&\s*window\.GAIP_SampleManager\)/);
    });

    test('the gaip:site-changed listener still calls clearSoilData with domOnly=true (the case this fix targets)', () => {
        expect(src).toMatch(/clearSoilData\(silentBtn,\s*true\)/);
    });

    test('file has no syntax errors after the fix', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});
