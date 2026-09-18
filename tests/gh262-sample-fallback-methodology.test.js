/**
 * Test GH-262 — hub-persistence.js's "empty hub form" sample-store fallback
 * computes with the site's real methodology and soil texture, and the label it
 * writes beside the number is the same value the number was computed from.
 *
 * BUG (GH-262, unchanged): `cacheAnalysisResults()` has TWO independent calls
 * into mlsnEngine(). The primary one is driven by the DOM soil form and is
 * covered by gh260-hub-persistence-range-scrape.test.js. The SECOND one —
 * `if (!cache.computed.soilNutrition && global.GAIP_SampleManager && ...)` —
 * fires whenever the primary path found no soil data yet, a real race during
 * Re-run (confirmed live: `soilNutrition from sample: sample_141` on an AA
 * site). That fallback built its own `_smState.soil` with
 * `methodology: _smRaw.methodology || 'mlsn'` — and methodology is a site
 * setting, never present on a sample's lab payload — so every real AA site
 * that hit this path computed as MLSN. Confirmed live: a K=199ppm AA/Sand card
 * showed "AA: 37 ppm" (37 is the literal MLSN_THRESHOLDS.K) under an "AA:"
 * label, because the label was read separately from the number.
 *
 * WHAT THIS FILE GUARDED BEFORE, AND WHAT IT GUARDS NOW: the defect has two
 * halves and only one of them moved.
 *   1. The literal 'mlsn' must not stand in for a methodology nobody set.
 *      Unchanged — and now stricter: GH-520/521 give the methodology one
 *      owner and no default at all, so a site without one produces null and
 *      the card says so, instead of silently computing as MLSN.
 *   2. The methodology fed to mlsnEngine and the methodology written to
 *      `cache.computed.soilNutrition.methodology` must be the same value, so
 *      the label cannot disagree with the number. Unchanged.
 * What moved is where half 1 gets its answer: `.gaip-soil-methodology` on the
 * page (GH-262/265) -> the site's own configuration record, read by the site's
 * id (GH-521). The reason is GH-459: a page field carries whatever site the
 * page last painted, so it answers correctly right up until two sites are in
 * play, which is exactly when it matters. The source of that decision is the
 * per-site read guarded in gh265-methodology-dom-priority.test.js; this file
 * takes it as given and guards its own two halves on top of it.
 *
 * soilTexture is not affected: it still resolves DOM-first (GH-270/272/273).
 */

const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');
const { runSampleFallback, stripLineComments } = require('./helpers/sample-fallback-harness');

describe('GH-262 — sample-store fallback computes with the site\'s real methodology/soilTexture', () => {
    let src;
    let code;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        code = stripLineComments(src);
    });

    describe('structural', () => {
        test('the original pattern (methodology off the lab payload, defaulting to the literal "mlsn") is gone', () => {
            expect(code).not.toMatch(/methodology:\s*_smRaw\.methodology\s*\|\|\s*'mlsn'/);
        });

        test('no literal "mlsn" is substituted for a methodology at all on this path', () => {
            // GH-520/521: the methodology has one owner and no default. A site
            // that has none is a site that has none; it is not an MLSN site.
            expect(code).not.toMatch(/methodology:[^\n]*'mlsn'/);
        });

        test('methodology comes from the site config resolver', () => {
            // The resolver itself, and the id it reads by, are guarded in
            // gh265-methodology-dom-priority.test.js.
            expect(code).toMatch(/methodology:\s*_smConfigMethodology,/);
        });

        test('soilTexture is set on _smState.soil (was entirely absent before GH-262)', () => {
            // GH-273: DOM-first over the sample snapshot for this field, unchanged
            // by GH-521 — see gh273-texture-dom-priority.test.js.
            expect(code).toMatch(/soilTexture:\s*_smTexDom\s*\|\|\s*_smSample\.soilTextureSnapshot\s*\|\|\s*'loam'/);
        });

        test('CEC is set on _smState.soil (needed for AA %BS-axis conversions, e.g. S81/Fescue)', () => {
            const stateBlockStart = code.indexOf('var _smState = {');
            const stateBlockEnd = code.indexOf('var _smHtml = global.mlsnEngine', stateBlockStart);
            const stateBlock = code.slice(stateBlockStart, stateBlockEnd);
            expect(stateBlock).toMatch(/CEC:\s*parseFloat\(_smRaw\.CEC \|\| _smRaw\.cec\)/);
        });

        test('the cache metadata methodology reads the same value fed to mlsnEngine', () => {
            expect(code).not.toMatch(/methodology:\s*_smRaw\.methodology\s*\|\|\s*null,/);
            expect(code).toMatch(/methodology:\s*_smState\.soil\.methodology,/);
        });

        test('_smTexDom is declared once (hoisted before _smState) and reused for the later ECe DOM fallback', () => {
            expect((code.match(/var _smTexDom\s*=/g) || []).length).toBe(1);
        });
    });

    describe('behavioural — the real fallback block via vm, against the real mlsnEngine', () => {
        let engineCtx;
        beforeAll(() => { engineCtx = buildEngineContext(); });

        test('AA site, methodology present only in the site config: resolves AA, not MLSN', () => {
            // The original GH-262 case, with the source it has now. Nothing but the
            // site record says "ammonium_acetate" — the lab payload does not carry a
            // methodology at all, which was the whole point of the defect.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.status).toBe('HIGH');
            expect(k.mlsn).not.toBe('37'); // not the MLSN literal
        });

        test('the label beside the number is the value the number was computed from', () => {
            // The second half of GH-262: the card said "AA:" over an MLSN figure
            // because the two were read separately. One value, read once.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: 'ammonium_acetate',
                textureDom: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(sn.methodology).toBe('ammonium_acetate');
            expect(k.mlsn).toBe('75.0-175.0'); // an AA range, matching the AA label
            expect(k.rangeMin).toBeCloseTo(75, 1);
        });

        test('site with no methodology set: null reaches the card, the literal "mlsn" does not', () => {
            // This assertion is the one that changed direction. It used to read
            // `expect(sn.methodology).toBe('mlsn')` and was called a regression
            // guard against a crash. It was guarding the substitution instead: a
            // site with no methodology was being printed as an MLSN site, and the
            // number under that label was MLSN's. Now the absence travels.
            const sn = runSampleFallback(engineCtx, {
                siteId: 'site1',
                configMethodology: null,
                textureDom: 'sand',
                sampleRaw: { K_ppm: 50, P_ppm: 25 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBeNull();
            expect(Array.isArray(sn.nutrients)).toBe(true);
        });
    });
});
