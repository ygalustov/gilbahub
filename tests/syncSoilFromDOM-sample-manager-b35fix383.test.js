/**
 * Test b35fix383 — syncSoilFromDOM reads SampleManager active sample first
 *
 * Pre-fix bug: syncSoilFromDOM only read DOM `[data-mlsn="K"]` inputs.
 * When the user wasn't on the soil tab those inputs were empty, so
 * GAIP_STATE.soil.ppm.K ended up undefined → live preview computed
 * annual K = 105 (deficit-correction inflated) instead of the correct
 * removal-only ~52, causing the recommender to spuriously select SOL-KNO3.
 *
 * Post-fix: the sample's `normalized` values are the source of truth; DOM inputs are a fallback for
 * in-progress manual edits.
 *
 * GH-796 (queue item 3vyu) RENAMED THE QUESTION, not the rule. The sample a programme is computed from is
 * the one the server names for the site, not the one a visitor has selected on the page, so this block now
 * asks `SM.calculationSample('soil')`. What these cases are about -- the sample before the DOM, the
 * normalised lab values, the try/catch, the DOM as a fallback -- is unchanged, and only the name of the
 * method moved.
 *
 * WHAT THESE CASES DO NOT DO, said plainly: they read the SOURCE TEXT of the file, comments included, and
 * they say nothing about what it computes. A rename keeps them honest only because somebody updates them.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix383 — syncSoilFromDOM SampleManager priority', () => {
    let calendarSrc;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/nutrition-calendar.js');
        calendarSrc = fs.readFileSync(filePath, 'utf8');
    });

    test('syncSoilFromDOM reads the calculation\'s sample from GAIP_SampleManager', () => {
        // The fix MUST ask the manager before falling back to DOM inputs.
        expect(calendarSrc).toMatch(/GAIP_SampleManager/);
        expect(calendarSrc).toMatch(/calculationSample\(['"]soil['"]\)/);
        // And it must not go back to the page's selection here: that is the defect GH-796 closed.
        expect(calendarSrc).not.toMatch(/getActiveSample\(['"]soil['"]\)/);
    });

    test('SampleManager read uses normalized values (lab data)', () => {
        // The b35fix383 block must read activeSoil.normalized (or rawData
        // fallback) — that's where lab values live, not DOM-derived inputs.
        expect(calendarSrc).toMatch(/activeSoil\.normalized/);
    });

    test('SampleManager values come BEFORE DOM input scan (priority order)', () => {
        // Ensure the SampleManager block appears earlier in the function
        // than the DOM `[data-mlsn=...]` query loop. If the order reverses,
        // empty DOM inputs will overwrite valid SampleManager values.
        const sampleManagerIdx = calendarSrc.indexOf('GAIP_SampleManager');
        const domQueryIdx = calendarSrc.indexOf("document.querySelector(`[data-mlsn=");
        expect(sampleManagerIdx).toBeGreaterThan(0);
        expect(domQueryIdx).toBeGreaterThan(sampleManagerIdx);
    });

    test('SampleManager block is wrapped in try/catch (defensive)', () => {
        // SampleManager may not be available in all contexts (e.g. early
        // page load before sample-manager.js loads). The block must not
        // throw on missing global — fall back to DOM-only behaviour.
        const re = /try\s*\{\s*var SM = window\.GAIP_SampleManager;[\s\S]*?\}\s*catch/;
        expect(calendarSrc).toMatch(re);
    });

    test('DOM scan still runs as fallback (preserves manual edits)', () => {
        // The DOM input loop must still execute so that values typed into
        // the soil panel by the user override stale SampleManager values.
        // Match the DOM nutrient scan loop pattern.
        expect(calendarSrc).toMatch(/nutrients\.forEach[\s\S]*?\[data-mlsn=/);
    });

    test('SampleManager guard rejects zero/negative values', () => {
        // The SampleManager read block must skip values where v <= 0
        // (treating them as "no data" rather than overwriting with zero).
        // Without this guard, a sample with explicit zero K would zero out
        // a valid DOM-typed value below.
        expect(calendarSrc).toMatch(/!isNaN\(v\)\s*&&\s*v\s*>\s*0/);
    });

    test('b35fix384: DOM scan rejects zero values (preserves SampleManager)', () => {
        // Pre-fix b35fix383 the DOM scan accepted parseFloat('0') = 0, which
        // overwrote the SampleManager's K=141 with 0. The DOM scan must
        // require value > 0 to honour the SampleManager's pre-loaded value
        // when the soil tab DOM has empty/zero placeholders.
        // Look for the post-SampleManager DOM scan (the second nutrients loop).
        const m = calendarSrc.match(
            /PRIORITY 2[\s\S]*?nutrients\.forEach[\s\S]*?\}\);/
        );
        expect(m).toBeTruthy();
        // The matched block must contain `value > 0` to gate writes.
        expect(m[0]).toMatch(/value\s*>\s*0/);
    });

    test('b35fix383 changelog comment present', () => {
        expect(calendarSrc).toMatch(/b35fix383/);
        expect(calendarSrc).toMatch(/SampleManager/);
    });

    test('b35fix384 changelog comment present', () => {
        expect(calendarSrc).toMatch(/b35fix384/);
    });
});
