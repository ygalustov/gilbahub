/**
 * Test GH-260 — hub-persistence.js's DOMParser scraper reads the new
 * data-range-min/max attributes (D07 item 3, second half).
 *
 * mlsnEngine() emits its result as an HTML string (GAIP_STATE.computed.mlsn);
 * hub-persistence.js re-parses that HTML with DOMParser and scrapes specific
 * <td> cells into cache.computed.soilNutrition.nutrients[] — that array is
 * what soil-nutrition-analysis.js's renderNutrientCards()/
 * renderAnnualRequirements() actually read. Before GH-260, rangeMin/rangeMax
 * were never in the HTML at all, so this scrape step silently dropped them;
 * this test proves the scraper now carries them through for AA rows and
 * leaves them undefined (not a crash) for MLSN/SLAN rows.
 *
 * No jsdom/DOMParser is available in this repo's Node test environment, so
 * this test extracts the REAL scraping block verbatim from hub-persistence.js
 * (regex, bounded by the `new DOMParser()` line and the closing of the
 * `_rows.forEach(...)` call — pinned separately below so this extraction
 * can't silently start matching the wrong code) and runs it via `vm` against
 * a minimal DOMParser polyfill built only for the exact `<table
 * class="gaip-mlsn-table"><tbody><tr class="..." data-range-min="..."
 * data-range-max="..."><td>...</td>...</tr></tbody></table>` shape
 * mlsnEngine's own template produces (verified in gh260-mlsn-engine-aa-
 * branch.test.js) — not a general-purpose HTML parser.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { buildContext, run } = require('./helpers/mlsn-engine-harness');

function extractScraperBlock(src) {
    const start = src.indexOf('var _parser = new DOMParser();');
    const forEachStart = src.indexOf('_rows.forEach(function(row) {', start);
    // Find the matching close of the forEach call by brace counting from forEachStart.
    let depth = 0;
    let i = src.indexOf('{', forEachStart);
    const bodyStart = i;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) break;
        }
    }
    // i now at the closing '}' of the function body; forEach call closes shortly after with ');'
    const closeParen = src.indexOf(');', i);
    return src.slice(start, closeParen + 2);
}

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
        while ((cm = cellRe.exec(m[3]))) {
            cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
        }
        rows.push({
            className: m[1],
            dataset: Object.keys(dataset).length ? dataset : undefined,
            querySelectorAll: (sel) => (sel === 'td' ? cells : []),
        });
    }
    return rows;
}

function runScraper(html) {
    const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
    const block = extractScraperBlock(src);
    const sandbox = {
        DOMParser: function() {
            this.parseFromString = (h) => ({
                querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(h) : []),
            });
        },
        _mlsnHtml: html,
        _nutrients: [],
        console: { warn: () => {} },
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(block, ctx);
    return ctx._nutrients;
}

describe('GH-260 — hub-persistence.js scraper carries rangeMin/rangeMax', () => {
    test('the extracted block still matches the real, current source (extraction sanity check)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        const block = extractScraperBlock(src);
        expect(block).toContain('new DOMParser()');
        expect(block).toContain("row.dataset ? row.dataset.rangeMin : undefined");
        expect(block).toContain('_rows.forEach(function(row) {');
        expect(block.trim().endsWith(');')).toBe(true);
    });

    let engineCtx;
    beforeAll(() => {
        engineCtx = buildContext();
    });

    test('AA row (HIGH, certificate-backed): rangeMin/rangeMax land as parsed floats', () => {
        const { html } = run(engineCtx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        const nutrients = runScraper(html);
        const k = nutrients.find((n) => n.nutrient === 'K');
        expect(k).toBeDefined();
        expect(k.status).toBe('HIGH');
        expect(k.rangeMin).toBeCloseTo(78.2, 1);
        expect(k.rangeMax).toBeCloseTo(195.5, 1);
        expect(typeof k.rangeMin).toBe('number');
    });

    test('MLSN row: rangeMin/rangeMax are undefined, no crash', () => {
        const { html } = run(engineCtx, { methodology: 'mlsn', soilTexture: 'loam', ppm: { K: 50 } });
        const nutrients = runScraper(html);
        const k = nutrients.find((n) => n.nutrient === 'K');
        expect(k).toBeDefined();
        expect(k.rangeMin).toBeUndefined();
        expect(k.rangeMax).toBeUndefined();
    });

    test('SLAN row: rangeMin/rangeMax are undefined, no crash', () => {
        const { html } = run(engineCtx, { methodology: 'slan', soilTexture: 'loam', ppm: { K: 45 } });
        const nutrients = runScraper(html);
        const k = nutrients.find((n) => n.nutrient === 'K');
        expect(k).toBeDefined();
        expect(k.rangeMin).toBeUndefined();
        expect(k.rangeMax).toBeUndefined();
    });

    test('all other scraped fields survive alongside the new range fields (no regression in the existing scrape)', () => {
        const { html } = run(engineCtx, {
            methodology: 'ammonium_acetate', species: 'perennialRyegrass',
            construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
        });
        const nutrients = runScraper(html);
        const k = nutrients.find((n) => n.nutrient === 'K');
        expect(k.actual).toBe('199.0');
        expect(k.statusClass).toBe('high');
        expect(typeof k.recommendation).toBe('string');
        expect(k.recommendation.length).toBeGreaterThan(0);
    });
});
