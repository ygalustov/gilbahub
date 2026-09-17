/**
 * The resolver's answer for a site with NOTHING resolved: the site exists and
 * nothing else does.
 *
 * It lives here, and not in the test that first needed it, because two tests
 * now run against it — the export's empty-inputs run (GH-465, gh461-export-
 * turf-keys) and the inventory of substitutions for emptiness (GH-477) — and
 * "what empty means" has to be one shape for both of them to be about the same
 * thing.
 */
'use strict';

const EMPTY = Object.freeze({
    site: Object.freeze({
        id: 'site-empty', name: '',
        location: Object.freeze({ name: '', lat: null, lon: null }),
        timezone: null, areaHa: null
    }),
    turf: Object.freeze({
        type: '', subCategory: '', species: '', speciesKey: '', speciesDisplay: '',
        variety: '', construction: '', hoc: null, percentC3: null,
        warmBase: '', coolOverseed: '', overseedSpecies: '', overseedVariety: '',
        overseedVarietyDisplay: null, summerIntent: '', isC4: false
    }),
    program: null,
    samples: Object.freeze({ soil: null, tissue: null, water: null }),
    climateNormals: null, climateReason: 'unresolved',
    sources: Object.freeze({ species: 'unresolved' })
});

/**
 * The same site with its coordinates known and its PLACE NAME still empty.
 *
 * This is the shape the living example is about: the site card prints
 * `lat,lon` exactly here, where a name is missing and coordinates are not. The
 * all-empty shape above cannot show it — with no coordinates to print, a guard
 * against printing coordinates passes for the wrong reason.
 */
const EMPTY_LOCATED = Object.freeze(Object.assign({}, EMPTY, {
    site: Object.freeze(Object.assign({}, EMPTY.site, {
        location: Object.freeze({ name: '', lat: -36.8508827, lon: 174.7644881 }),
        timezone: 'Pacific/Auckland'
    }))
}));

module.exports = { EMPTY: EMPTY, EMPTY_LOCATED: EMPTY_LOCATED };
