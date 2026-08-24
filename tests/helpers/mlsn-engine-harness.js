/**
 * Shared test harness for exercising the real mlsnEngine() (assets/hub-
 * tissue-v3.js) under Node via `vm`, since the file has no module.exports
 * and reads `window`/`document` at the top level.
 *
 * GH-260 (D07 item 3): used by the mlsnEngine AA-branch tests and by the
 * hub-persistence.js HTML-scraper tests, both of which need real HTML output
 * from the actual (unmocked) engine rather than a hand-built fixture, since
 * the whole point of these tests is to catch drift between what mlsnEngine
 * emits and what the scraper/downstream renderers expect.
 *
 * Top-level code in hub-tissue-v3.js outside function declarations throws in
 * this stub DOM (e.g. `document.addEventListener is not a function`) — that's
 * expected and caught; function declarations are hoisted before it runs, so
 * `mlsnEngine` (and its sibling helpers) are still defined on the context
 * afterwards.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function buildContext() {
    const hlst = require('../../assets/hill-labs-sample-types.js');
    const sandbox = {
        window: {},
        document: { querySelector: () => null },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        Date: Date,
        Math: Math,
    };
    sandbox.window.HillLabsSampleTypes = hlst;
    sandbox.HillLabsSampleTypes = hlst;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    const src = fs.readFileSync(path.join(__dirname, '../../assets/hub-tissue-v3.js'), 'utf8');
    try {
        vm.runInContext(src, ctx, { filename: 'hub-tissue-v3.js' });
    } catch (e) {
        // Expected: top-level DOM-dependent code (event listeners etc.) throws
        // in this stub environment. Function declarations are hoisted before
        // any statement executes, so mlsnEngine is still defined afterwards.
    }
    return ctx;
}

/**
 * @param {object} opts
 * @param {string} opts.methodology - 'ammonium_acetate' | 'slan' | 'mlsn'
 * @param {string} [opts.species] - grassSpecies, canonical key (e.g. 'perennialRyegrass')
 * @param {string} [opts.construction] - turf.construction (e.g. 'sand_profile')
 * @param {string} [opts.soilTexture] - general 6-value texture (sand/loamy_sand/sandy_loam/loam/clay_loam/clay)
 * @param {object} [opts.ppm] - soil ppm values, e.g. { K: 199, P: 25, ... }
 * @param {number} [opts.cec]
 * @param {number} [opts.monthlyN] - defaults to 0 (disables the N-programme table branch, simpler output to parse)
 */
function buildState(opts) {
    return {
        soil: {
            ppm: Object.assign({ P: 25, K: 100, Ca: 400, Mg: 60, S: 10, Fe: 60, Mn: 20, Zn: 2, Cu: 1, B: 0.6 }, opts.ppm || {}),
            methodology: opts.methodology,
            soilTexture: opts.soilTexture || 'loam',
            CEC: opts.cec != null ? opts.cec : 15,
            pH_water: 6,
            depthCm: 10,
            bulkDensity: 1.4,
        },
        turf: {
            grassSpecies: opts.species || 'perennialRyegrass',
            construction: opts.construction || 'soil',
            warmBase: !!opts.warmBase,
            percentC3Cover: opts.warmBase ? 0 : 100,
            turfType: 'green',
        },
        fertility: { monthlyN: opts.monthlyN != null ? opts.monthlyN : 0 },
        climate: { latitude: -43 },
    };
}

/**
 * Runs mlsnEngine and returns { html, row(nutrient) } where row() parses out
 * the <tr> for a given nutrient from the no-N-programme table (5 columns:
 * Nutrient/Actual/Range-or-MLSN/Status/Recommendation).
 */
function run(ctx, opts) {
    const html = ctx.mlsnEngine(buildState(opts), null);
    return {
        html,
        row(nutrient) {
            const re = new RegExp(
                `<tr class="status-([a-z]+)"([^>]*)>\\s*<td><strong>${nutrient}</strong></td>\\s*<td>([\\d.-]+)</td>\\s*<td>([^<]+)</td>[\\s\\S]{0,300}?<span class="status-badge [a-z]+">([A-Z ]+)</span>`
            );
            const m = html.match(re);
            if (!m) return null;
            const attrs = m[2];
            const rMin = attrs.match(/data-range-min="([\d.]+)"/);
            const rMax = attrs.match(/data-range-max="([\d.]+)"/);
            const rSrc = attrs.match(/data-range-source="([a-z-]+)"/);
            return {
                statusClass: m[1],
                actual: m[3],
                col: m[4],
                status: m[5],
                rangeMin: rMin ? parseFloat(rMin[1]) : undefined,
                rangeMax: rMax ? parseFloat(rMax[1]) : undefined,
                rangeSource: rSrc ? rSrc[1] : undefined,
                hasRangeAttrs: /data-range-min/.test(attrs),
            };
        },
    };
}

module.exports = { buildContext, buildState, run };
