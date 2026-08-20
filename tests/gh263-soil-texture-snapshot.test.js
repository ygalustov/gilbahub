/**
 * Test GH-263 — the general soil-texture Settings field now actually reaches
 * mlsnEngine() (D07, found while diagnosing GH-262: a site with Settings
 * "Soil texture" = Sand still computed the generic "others" AA range).
 *
 * ROOT CAUSE: `.gaip-soil-texture` -- the DOM field mlsnEngine()'s state
 * collector reads for the general soil-texture value -- is a static "loam"
 * default baked into legacy-hub-markup.blade.php:
 *   <option value="loam" selected>Loam</option>
 * with no build-time binding and, until this fix, no JS sync path from the
 * site's real `sites.soil_texture_override` either. The server already
 * computes the correct value at sample-creation time
 * (SampleController.php: site.soil_texture_override ?: account.soil_texture,
 * same for methodology_override/methodology) and returns it on every sample
 * API response as `methodology_snapshot`/`soil_texture_snapshot` -- but
 * `sample-persistence.js`'s server-sample sync discarded both fields,
 * keeping only the lab-value payload (`values`).
 *
 * FIX (three files, one chain):
 *  1. sample-persistence.js -- carries `methodology_snapshot`/
 *     `soil_texture_snapshot` through as `methodologySnapshot`/
 *     `soilTextureSnapshot` on the client-side sample object.
 *  2. sample-manager.js -- `loadSample()` now restores `.gaip-soil-texture`'s
 *     DOM value from `sample.soilTextureSnapshot` when present, fixing the
 *     primary mlsnEngine() path (GH-260) for real sample loads.
 *  3. hub-persistence.js -- the "empty hub form" fallback (GH-262) now
 *     prefers `_smSample.methodologySnapshot`/`.soilTextureSnapshot` over
 *     its own DOM-read fallback, since that DOM field turned out to be the
 *     same always-"loam" static default.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');

describe('GH-263 — soil texture / methodology snapshot reaches mlsnEngine()', () => {
    describe('sample-persistence.js — snapshot fields carried through server sync', () => {
        let src;
        beforeAll(() => {
            src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
        });

        test('methodologySnapshot/soilTextureSnapshot are set from the API sample object', () => {
            expect(src).toMatch(/methodologySnapshot:\s*sample\.methodology_snapshot\s*\|\|\s*null/);
            expect(src).toMatch(/soilTextureSnapshot:\s*sample\.soil_texture_snapshot\s*\|\|\s*null/);
        });

        test('the existing values/label/date/zoneType fields are untouched (additive change only)', () => {
            const objStart = src.indexOf('serverSnap.allSites[siteId][sample.sample_type][sampleId] = {');
            const objEnd = src.indexOf('};', objStart);
            const obj = src.slice(objStart, objEnd);
            expect(obj).toMatch(/label:\s*pld\._label \|\| pld\.label \|\| sampleId/);
            expect(obj).toMatch(/date:\s*sample\.lab_date \|\| sample\.sample_date \|\| null/);
            expect(obj).toMatch(/values:\s*pld/);
        });
    });

    describe('sample-manager.js — loadSample() no longer restores .gaip-soil-texture from a per-sample snapshot (GH-272)', () => {
        let src;
        beforeAll(() => {
            src = fs.readFileSync(path.join(__dirname, '../assets/sample-manager.js'), 'utf8');
        });

        // GH-272: this restore (added here in GH-263) actively regressed
        // GH-270's fix -- it unconditionally overwrote the page's correct
        // live-initialised .gaip-soil-texture value with whichever sample's
        // (potentially stale, per GH-269) soilTextureSnapshot happened to
        // auto-load. Texture is a site property, not a sample property, so
        // restoring it per-sample was never right even before that regression.
        test('the old per-sample texture restore is gone', () => {
            expect(src).not.toMatch(/texInput\.value = sample\.soilTextureSnapshot/);
            expect(src).not.toMatch(/if \(dataType === 'soil' && sample\.soilTextureSnapshot\)/);
        });

        test('file has no syntax errors after the removal', () => {
            expect(() => new Function(src)).not.toThrow();
        });
    });

    describe('hub-persistence.js fallback — behavioural, snapshot wins over DOM', () => {
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
                while ((cm = cellRe.exec(m[3]))) cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
                rows.push({ className: m[1], querySelectorAll: (sel) => (sel === 'td' ? cells : []) });
            }
            return rows;
        }
        function DOMParserStub() {
            this.parseFromString = (html) => ({
                querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(html) : []),
            });
        }

        function extractBlock() {
            const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
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

        function runFallback({ methodologyDomValue, textureDomValue, sampleExtra, sampleRaw }) {
            const engineCtx = buildEngineContext();
            const block = extractBlock();
            const cache = { computed: {} };
            const domValues = {
                '.gaip-soil-methodology': methodologyDomValue,
                '.gaip-soil-texture': textureDomValue,
            };
            const sandbox = {
                cache,
                _gaipState: {},
                _mlsnHtml: '',
                _soilIn: null,
                DOMParser: DOMParserStub,
                document: { querySelector: (sel) => (domValues[sel] !== undefined ? { value: domValues[sel] } : null) },
                global: {
                    GAIP_SampleManager: {
                        getAllSamples: () => ({
                            allSites: {
                                site1: {
                                    soil: {
                                        sample_1: Object.assign({ date: '2026-01-01', label: 'Sample 1', rawData: sampleRaw }, sampleExtra),
                                    },
                                },
                            },
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

        test('GH-265/273: both methodology and soilTexture now trust live DOM over a stale snapshot', () => {
            // This is the real, live scenario that surfaced GH-265 (methodology) and
            // later GH-273 (the same class of bug, for soilTexture, once GH-270/272
            // made .gaip-soil-texture live too): a real sample's methodologySnapshot
            // ("mlsn") and soilTextureSnapshot ("loam") were both frozen at sample-
            // creation time, before the site was switched to AA / Sand -- but both
            // DOM fields are correctly live now (methodology via ammonium-acetate-
            // methodology.js's region auto-select; texture via hub.blade.php's
            // GH-270 initial value). Both snapshots are stale here on purpose, to
            // prove DOM wins for both fields, not just methodology.
            const sn = runFallback({
                methodologyDomValue: 'ammonium_acetate', // live-correct
                textureDomValue: 'sand',                 // live-correct (GH-270/272)
                sampleExtra: { methodologySnapshot: 'mlsn', soilTextureSnapshot: 'loam' }, // both stale
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0'); // "sands" bucket via live DOM texture, not "others" (stale snapshot) or MLSN's literal 37
            expect(k.status).toBe('HIGH');
        });

        test('falls back to DOM when snapshot is absent (older sample, pre-GH-263)', () => {
            const sn = runFallback({
                methodologyDomValue: 'ammonium_acetate',
                textureDomValue: 'sand',
                sampleExtra: {}, // no snapshot fields
                sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });
            expect(sn.methodology).toBe('ammonium_acetate');
            const k = sn.nutrients.find((n) => n.nutrient === 'K');
            expect(k.mlsn).toBe('75.0-175.0');
            expect(k.status).toBe('HIGH');
        });
    });
});
