/**
 * Test GH-266 — the "empty hub form" sample-fallback's OWN DOMParser scraper
 * (a second, independent copy of the GH-260 scraper) never read
 * data-range-min/max, so rangeMin/rangeMax were silently absent from every
 * nutrient this path produced.
 *
 * BUG: hub-persistence.js has TWO separate DOMParser-based scrapers that
 * both parse mlsnEngine()'s HTML table output into a nutrients[] array:
 *   1. The primary one (~line 1073, cacheAnalysisResults' main path) --
 *      fixed for rangeMin/rangeMax in GH-260, covered by
 *      gh260-hub-persistence-range-scrape.test.js.
 *   2. This one, inside the "empty hub form" sample fallback (GH-262/263/
 *      264/265) -- NEVER fixed. GH-260 only ever touched the first one;
 *      nobody noticed the second, structurally-identical copy existed.
 *
 * Confirmed live: a real K row had `status: "HIGH"` and the correct AA
 * recommendation text ("4 ppm above AA sufficiency range..."), proving it
 * went through mlsnEngine()'s AA branch (which always sets rangeMin/
 * rangeMax on the result) -- but the scraped nutrient object had no
 * rangeMin/rangeMax at all. Downstream, `renderAnnualRequirements()`'s
 * isHigh check needs `rangeMax` for AA; with it silently undefined, isHigh
 * fell through to the non-ceiling branch -- producing the exact reported
 * inconsistency: status badge says "High" but the kg/ha figure is non-zero
 * and the note text says "Application required to meet annual demand"
 * (the non-ceiling wording) instead of the AA-exceeded wording.
 *
 * FIX: added the same data-range-min/max read this scraper's primary
 * sibling already had, producing an identically-shaped nutrient object.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext: buildEngineContext } = require('./helpers/mlsn-engine-harness');

function parseMlsnTableHtml(html) {
    const tbodyMatch = html.match(/<table class="gaip-mlsn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return [];
    const rowRe = /<tr class="([^"]*)"((?:\s+data-[\w-]+="[^"]*")*)>([\s\S]*?)<\/tr>/g;
    const rows = [];
    let m;
    while ((m = rowRe.exec(tbodyMatch[1]))) {
        const dataset = {};
        const attrRe = /data-([\w-]+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(m[2]))) {
            const camelKey = am[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            dataset[camelKey] = am[2];
        }
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells = [];
        let cm;
        while ((cm = cellRe.exec(m[3]))) cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
        rows.push({
            className: m[1],
            dataset: Object.keys(dataset).length ? dataset : undefined,
            querySelectorAll: (sel) => (sel === 'td' ? cells : []),
        });
    }
    return rows;
}

function DOMParserStub() {
    this.parseFromString = (html) => ({
        querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(html) : []),
    });
}

function extractFallbackBlock() {
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

function runFallback(engineCtx, opts) {
    const block = extractFallbackBlock();
    const cache = { computed: {} };
    const sandbox = {
        cache,
        _gaipState: {},
        _mlsnHtml: '',
        _soilIn: null,
        DOMParser: DOMParserStub,
        document: { querySelector: () => null },
        global: {
            GAIP_SampleManager: {
                getAllSamples: () => ({
                    allSites: {
                        site1: {
                            soil: {
                                sample_1: {
                                    date: '2026-01-01', label: 'Sample 1', rawData: opts.sampleRaw,
                                    methodologySnapshot: opts.methodologySnapshot,
                                    soilTextureSnapshot: opts.soilTextureSnapshot,
                                },
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

describe('GH-266 — fallback scraper carries rangeMin/rangeMax', () => {
    test('structural: this scraper now reads data-range-min/max, same as its primary sibling', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        const start = src.indexOf('_smD.querySelectorAll');
        const end = src.indexOf('} catch(e) {}', start);
        const block = src.slice(start, end);
        expect(block).toMatch(/var _smRangeMin = row\.dataset \? row\.dataset\.rangeMin : undefined;/);
        expect(block).toMatch(/var _smRangeMax = row\.dataset \? row\.dataset\.rangeMax : undefined;/);
        expect(block).toMatch(/rangeMin:\s*_smRangeMin != null \? parseFloat\(_smRangeMin\) : undefined/);
        expect(block).toMatch(/rangeMax:\s*_smRangeMax != null \? parseFloat\(_smRangeMax\) : undefined/);
    });

    let engineCtx;
    beforeAll(() => {
        engineCtx = buildEngineContext();
    });

    test('behavioural: real live scenario — AA/HIGH K row now carries rangeMin/rangeMax through this scraper', () => {
        // No species reaches _smState.turf on this fallback path (it only ever
        // gets `_turfState || {}` from the enclosing function, out of scope for
        // this fix -- same caveat as gh263-soil-texture-snapshot.test.js), so
        // this lands on the texture-only "sands" fallback range (75.0-175.0)
        // rather than the certificate S277 range -- the point here is proving
        // rangeMin/rangeMax now survive the scrape at all, not proving
        // certificate resolution (already covered by gh260's tests).
        const sn = runFallback(engineCtx, {
            methodologySnapshot: 'ammonium_acetate',
            soilTextureSnapshot: 'sand',
            sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
        });
        const k = sn.nutrients.find((n) => n.nutrient === 'K');
        expect(k.status).toBe('HIGH');
        expect(k.rangeMin).toBeCloseTo(75, 1);
        expect(k.rangeMax).toBeCloseTo(175, 1);
        expect(typeof k.rangeMin).toBe('number');
        expect(typeof k.rangeMax).toBe('number');
    });

    test('behavioural: MLSN row still has no rangeMin/rangeMax (no leakage), no crash', () => {
        const sn = runFallback(engineCtx, {
            methodologySnapshot: 'mlsn',
            soilTextureSnapshot: 'loam',
            sampleRaw: { K_ppm: 45, P_ppm: 25 },
        });
        const k = sn.nutrients.find((n) => n.nutrient === 'K');
        expect(k).toBeDefined();
        expect(k.rangeMin).toBeUndefined();
        expect(k.rangeMax).toBeUndefined();
    });
});
