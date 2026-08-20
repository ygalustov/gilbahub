/**
 * Test GH-262 — hub-persistence.js's "empty hub form" sample-store fallback
 * now reads the real methodology + soil texture (D07, found while diagnosing
 * a live report that GH-260's fix showed no difference in the UI).
 *
 * BUG: `cacheAnalysisResults()` has TWO independent calls into mlsnEngine():
 * the primary one (driven by GAIP_STATE.inputs.soil / the DOM soil form,
 * already covered by gh260-hub-persistence-range-scrape.test.js), and a
 * SECOND, previously-unaudited fallback (`if (!cache.computed.soilNutrition
 * && global.GAIP_SampleManager && ...)`) that fires whenever the primary
 * path found no soil data on the DOM form yet (a real race during Re-run:
 * confirmed via a live browser console log where `soilNutrition from
 * sample: sample_141` fired for an AA site). This fallback built its own
 * `_smState.soil` object with `methodology: _smRaw.methodology || 'mlsn'`
 * -- but methodology is a site/turf SETTING, never present on a sample's
 * raw lab-value payload (confirmed: sample-manager.js only ever writes it
 * to the `.gaip-soil-methodology` DOM select, never into sample data) --
 * so this defaulted to 'mlsn' for every real AA site that hit this path,
 * regardless of GH-260's mlsnEngine fix. `soilTexture` wasn't read at all
 * either, so even a correctly-detected AA site would've missed the GH-259
 * sand-bucket fix on this path. Confirmed live: a K=199ppm AA/Ryegrass/Sand
 * card showed "AA: 37 ppm" (37 is the literal MLSN_THRESHOLDS.K constant)
 * with MLSN's generic recommendation text, while the card's "AA:" label
 * (driven by the separately-read `cache.computed.soilNutrition.methodology`
 * field) still said AA -- the fix also makes that label read from the same
 * value actually fed to mlsnEngine, so the two can no longer disagree.
 *
 * FIX: read `.gaip-soil-methodology` / `.gaip-soil-texture` from the DOM as
 * a fallback (same "race condition as primary path" pattern the adjacent
 * pH/EC/texture DOM reads in this same block already use), and set
 * `cache.computed.soilNutrition.methodology` from the same resolved value
 * used to call mlsnEngine, not a separate read of `_smRaw.methodology`.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');

// Minimal DOMParser polyfill for mlsnEngine's own table-shape HTML (same
// approach as gh260-hub-persistence-range-scrape.test.js) -- this fallback
// block parses its own mlsnEngine() HTML output with `new DOMParser()`.
function parseMlsnTableHtml(html) {
    const tbodyMatch = html.match(/<table class="gaip-mlsn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return [];
    const rowRe = /<tr class="([^"]*)"((?:\s+data-[\w-]+="[^"]*")*)>([\s\S]*?)<\/tr>/g;
    const rows = [];
    let m;
    while ((m = rowRe.exec(tbodyMatch[1]))) {
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells = [];
        let cm;
        while ((cm = cellRe.exec(m[3]))) {
            cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
        }
        rows.push({ className: m[1], querySelectorAll: (sel) => (sel === 'td' ? cells : []) });
    }
    return rows;
}

function DOMParserStub() {
    this.parseFromString = (html) => ({
        querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(html) : []),
    });
}

describe('GH-262 — sample-store fallback reads real methodology/soilTexture', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
    });

    describe('structural', () => {
        test('old pattern (methodology always defaulting to the literal "mlsn") is gone', () => {
            expect(src).not.toMatch(/methodology:\s*_smRaw\.methodology\s*\|\|\s*'mlsn'/);
        });

        test('methodology now resolves via a DOM fallback, same pattern as the adjacent pH/EC/texture reads', () => {
            expect(src).toMatch(/var _smMethodDom\s*=\s*\(document\.querySelector\(['"]\.gaip-soil-methodology['"]\)\s*\|\|\s*\{\}\)\.value;/);
            // GH-265: DOM now takes priority for methodology specifically -- unlike
            // soilTexture, .gaip-soil-methodology is live-correct (auto-selected per
            // region by ammonium-acetate-methodology.js on every load), while the
            // sample's methodologySnapshot is frozen at sample-creation time and goes
            // stale the moment a site's methodology changes afterwards. See
            // gh263-soil-texture-snapshot.test.js / gh265-methodology-dom-priority.test.js.
            expect(src).toMatch(/methodology:\s*_smMethodDom\s*\|\|\s*_smSample\.methodologySnapshot\s*\|\|\s*_smRaw\.methodology\s*\|\|\s*'mlsn'/);
        });

        test('soilTexture is now set on _smState.soil (was entirely absent before)', () => {
            // GH-263: sample.soilTextureSnapshot now takes priority over the DOM fallback -- see gh263-soil-texture-snapshot.test.js.
            expect(src).toMatch(/soilTexture:\s*_smSample\.soilTextureSnapshot\s*\|\|\s*_smTexDom/);
        });

        test('CEC is now set on _smState.soil (needed for AA %BS-axis conversions, e.g. S81/Fescue)', () => {
            const stateBlockStart = src.indexOf('var _smState = {');
            const stateBlockEnd = src.indexOf('var _smHtml = global.mlsnEngine', stateBlockStart);
            const stateBlock = src.slice(stateBlockStart, stateBlockEnd);
            expect(stateBlock).toMatch(/CEC:\s*parseFloat\(_smRaw\.CEC \|\| _smRaw\.cec\)/);
        });

        test('the outer cache metadata methodology now reads from the same value fed to mlsnEngine (label can no longer disagree with the computed number)', () => {
            expect(src).not.toMatch(/methodology:\s*_smRaw\.methodology\s*\|\|\s*null,/);
            expect(src).toMatch(/methodology:\s*_smState\.soil\.methodology,/);
        });

        test('_smTexDom is declared once (hoisted before _smState) and reused for the later ECe DOM fallback, not redeclared', () => {
            const occurrences = (src.match(/var _smTexDom\s*=/g) || []).length;
            expect(occurrences).toBe(1);
        });
    });

    describe('behavioural — real fallback block via vm, against the real mlsnEngine', () => {
        function extractBlock() {
            const start = src.indexOf('var _turfState = (_gaipState && _gaipState.turf)');
            const fallbackStart = src.indexOf('if (!cache.computed.soilNutrition && global.GAIP_SampleManager', start);
            const braceOpen = src.indexOf('{', fallbackStart);
            let depth = 0;
            let i = braceOpen;
            for (; i < src.length; i++) {
                if (src[i] === '{') depth++;
                else if (src[i] === '}') { depth--; if (depth === 0) break; }
            }
            return src.slice(start, i + 1);
        }

        function runFallback({ methodologyDomValue, textureDomValue, sampleRaw }) {
            const engineCtx = buildEngineContext();
            const block = extractBlock();
            const cache = { computed: {} };
            const domValues = {
                '.gaip-soil-methodology': methodologyDomValue,
                '.gaip-soil-texture': textureDomValue,
                '.gaip-soil-ph': undefined,
                '.gaip-soil-ec': undefined,
                '[data-mlsn="Na"]': undefined,
            };
            const sandbox = {
                cache: cache,
                _gaipState: {},
                // Both falsy so the primary (untouched, out of scope here) block's
                // `if (_gaipState && (_mlsnHtml || _soilIn))` short-circuits and this
                // fallback's `!cache.computed.soilNutrition` guard fires, same as the
                // real "empty hub form" race this fallback exists for.
                _mlsnHtml: '',
                _soilIn: null,
                DOMParser: DOMParserStub,
                document: { querySelector: (sel) => (domValues[sel] !== undefined ? { value: domValues[sel] } : null) },
                global: {
                    GAIP_SampleManager: {
                        getAllSamples: () => ({
                            allSites: { site1: { soil: { sample_1: { date: '2026-01-01', label: 'Sample 1', rawData: sampleRaw } } } },
                        }),
                    },
                    mlsnEngine: engineCtx.mlsnEngine,
                    rawWeatherData: null,
                    climateMetrics: null,
                    __GAIP_TISSUE_LAST__: null,
                },
                window: { GAIP_HUB_CONFIG: { activeSiteId: 'site1' } },
                console: { log: () => {}, warn: () => {} },
            };
            sandbox.globalThis = sandbox;
            const ctx = vm.createContext(sandbox);
            vm.runInContext(block, ctx);
            return ctx.cache.computed.soilNutrition;
        }

        test('AA site with methodology only on the DOM select (typical real case): resolves AA, not MLSN', () => {
            const sn = runFallback({
                methodologyDomValue: 'ammonium_acetate',
                textureDomValue: 'sand',
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.status).toBe('HIGH');
            // Certificate range (S277, perennialRyegrass+sand), not the MLSN literal 37.
            expect(k.mlsn).not.toBe('37');
        });

        test('regression: methodology absent everywhere still safely defaults to mlsn (not a crash)', () => {
            const sn = runFallback({
                methodologyDomValue: undefined,
                textureDomValue: undefined,
                sampleRaw: { K_ppm: 50, P_ppm: 25 },
            });
            expect(sn).toBeDefined();
            expect(sn.methodology).toBe('mlsn');
        });
    });
});
