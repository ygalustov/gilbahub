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
    const sandbox = {
        window: {},
        document: { querySelector: () => null, readyState: 'complete', addEventListener() {},
            querySelectorAll: () => [], getElementById: () => null },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        Date: Date,
        Math: Math,
        JSON: JSON,
        setTimeout: () => 0,
        clearTimeout: () => {},
        parseFloat: parseFloat,
        parseInt: parseInt,
        isNaN: isNaN,
        isFinite: isFinite,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    /**
     * GH-782 (queue item 3ga) - THE SERVICE RUNS IN THIS CONTEXT, as it does on a page.
     *
     * It used to be `require`d, so its closure saw NODE's globals: a function of the service that asks the page
     * for the site's config could not see the config this harness sets, and the case read a texture-only range
     * while the product resolved a certificate. Measured while turning these cases over. The species normaliser
     * comes in the same way, because `deriveCode` spells the certificate's keys and asks it for the rest.
     */
    ['species-controller.js', 'hill-labs-sample-types.js'].forEach((file) => {
        try {
            vm.runInContext(fs.readFileSync(path.join(__dirname, '../../assets/', file), 'utf8'), ctx,
                { filename: file });
        } catch (e) {
            // A service that wires itself to a page may throw on a stub document; its API is defined first.
        }
    });
    /**
     * WHERE THE SERVICES PUT THEMSELVES: each file is an IIFE taking `window` and publishing onto THAT object, so
     * in this context they land on `sandbox.window` rather than on the sandbox. Read from there and mirrored, so
     * both spellings the product uses (`window.X` and a bare `X`) resolve.
     */
    sandbox.HillLabsSampleTypes = sandbox.window.HillLabsSampleTypes;
    sandbox.SpeciesController = sandbox.window.SpeciesController;
    /**
     * AND IT SAYS SO IF IT DID NOT LOAD. A swallowed failure here leaves the overlay without its service, the
     * cases read texture-only ranges, and the red points at the product instead of at this harness - which is
     * exactly what happened while these cases were being turned over.
     */
    if (!sandbox.HillLabsSampleTypes || typeof sandbox.HillLabsSampleTypes.speciesOfTheSite !== 'function') {
        throw new Error('mlsn harness: the Hill Labs service did not load into the context'
            + ' (HillLabsSampleTypes=' + typeof sandbox.HillLabsSampleTypes
            + ', SpeciesController=' + typeof sandbox.SpeciesController + ')');
    }
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
            /**
             * GH-782 (queue item 3ga): the AA certificate overlay no longer reads the species off this state -
             * it was assembled from the `/hub` form field, and on the stand that key is empty in all five sites
             * set to ammonium acetate while their species sits in the site's CONFIG. The harness keeps it here
             * because the rest of the engine reads it, and supplies the config below, which is what the overlay
             * now asks (`HillLabsSampleTypes.speciesOfTheSite`).
             */
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
/**
 * GH-574: the rows come from the engine's result, not from a regex over its
 * markup.
 *
 * This harness used to recover each row by matching the rendered `<tr>` — the
 * same read-the-page-instead-of-the-data shape that `hub-persistence.js` had,
 * in test clothes. It proved the TABLE said something, which is one step away
 * from proving the ENGINE decided something, and it went blind whenever the
 * markup changed shape. `mlsnEngine` returns `{ html, nutrients }` now;
 * `row()` reads `nutrients` and `html` stays available for the few assertions
 * that really are about the markup.
 */
function run(ctx, opts) {
    /**
     * GH-782 (queue item 3ga) - THE SITE'S OWN SETTINGS, where the AA overlay now asks for the species.
     *
     * It used to read the species off the state this harness builds, and that state is the `/hub` form: on the
     * stand the form's key is empty for every ammonium-acetate site while the species sits in the config, so no
     * certificate resolved and potassium stood on texture-only ranges. The harness supplies the config the page
     * would have, from the same `opts.species` it already uses, so the cases measure the product's own path.
     */
    const species = (opts && opts.species) || 'perennialRyegrass';
    ctx.window.GAIP_HUB_CONFIG = { gaipConfig: { turf: { species: species } } };
    ctx.GAIP_HUB_CONFIG = ctx.window.GAIP_HUB_CONFIG;
    const out = ctx.mlsnEngine(buildState(opts), null);
    const html = typeof out === 'string' ? out : (out && out.html) || '';
    const rows = (out && out.nutrients) || [];
    return {
        html,
        rows,
        row(nutrient) {
            const r = rows.filter((x) => x.nutrient === nutrient)[0];
            if (!r) return null;
            return {
                statusClass: r.statusClass,
                actual: r.actual,
                // The threshold column: what the table printed under the
                // methodology heading.
                col: String(r.mlsn),
                status: r.status,
                rangeMin: r.rangeMin,
                rangeMax: r.rangeMax,
                rangeSource: r.rangeSource,
                hasRangeAttrs: r.rangeMin != null && r.rangeMax != null,
                recommendation: r.recommendation,
            };
        },
    };
}

module.exports = { buildContext, buildState, run };
