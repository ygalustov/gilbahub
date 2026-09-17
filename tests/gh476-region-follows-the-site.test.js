/**
 * GH-476 (PLAN-GH439 section 10.6, fourteenth refinement) — the region a
 * client's catalogue comes from is the SITE's region.
 *
 * The defect, measured on the stand before the fix: a site moved from Sydney
 * to Auckland had −36.85 in its row, −36.85 in the config copy and −36.85 in
 * the server's own injection, while `.gaip-lat` on the page still held
 * −33.8688 — a form field in the hidden /hub runner, left from whatever it
 * last restored. `detectRegionFromHub()` read that field first, answered
 * `australia_temperate`, and every source that answers by site id sat below it
 * unreached. The client was offered the old country's products.
 *
 * The owner settled the question behind it (10.8(11)): the region comes from
 * the site's coordinates, and there is no separate country setting. So the
 * region is a derived fact about a site, like every other, and it is derived
 * from the owner of the coordinates — the site row, by id.
 *
 * The 'uk_ireland' answer for "the fields are missing" is deleted rather than
 * moved down the chain: it was a default printed as a fact about a client's
 * turf, which is the class of 10.8(7). Underivable is `null` now, and the
 * callers fall through to their own later methods instead of being told
 * Ireland.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID, poisonPage, POISON_SENTINEL } = require('./helpers/export-page-sandbox');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const code = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** The files that answer a region question. */
const REGION_CHAIN = [
    'regional-profiles.js',
    'ammonium-acetate-methodology.js',
    'cotula-bowling-green.js',
    'fungicide-filter.js',
    'gilba-soil-interpretation.js',
    'nutrition-au-fertiliser-integration.js',
    'nutrition-nz-fertiliser-integration.js',
    'nutrition-prebble-integration.js',
    'nutrition-uk-fertiliser-integration.js',
    'spray-log-ui.js'
];

describe('GH-476 — the region comes from the site, by id', () => {
    let RP;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        RP = page.sandbox.GAIP_RegionalProfiles;
        expect(RP).toBeTruthy();
    });

    test('the function that read the page is gone, not renamed or demoted', () => {
        expect(RP.detectRegionFromHub).toBeUndefined();
        expect(typeof RP.detectRegionForSite).toBe('function');
    });

    test('a site in New Zealand is New Zealand, by its own coordinates', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SC = page.sandbox.GAIP_SiteConfig;
        const row = SC.getSite(SITE_ID);
        expect(Number(row.latitude)).toBeCloseTo(-36.85, 1);
        expect(page.sandbox.GAIP_RegionalProfiles.detectRegionForSite(SITE_ID)).toBe('new_zealand');
    });

    test('a site that moved to Australia answers Australia in the same page load', () => {
        // The defect in one assertion: nothing about the page changed, only
        // the site's own coordinates.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SC = page.sandbox.GAIP_SiteConfig;
        const moved = Object.assign({}, SC.getSite(SITE_ID), { latitude: -33.8688, longitude: 151.2093 });
        SC.getSite = (id) => (id === SITE_ID ? moved : null);
        expect(page.sandbox.GAIP_RegionalProfiles.detectRegionForSite(SITE_ID))
            .toMatch(/^australia/);
    });

    test('a site with no coordinates is unknown, not Ireland', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SC = page.sandbox.GAIP_SiteConfig;
        const blank = Object.assign({}, SC.getSite(SITE_ID), { latitude: null, longitude: null });
        SC.getSite = (id) => (id === SITE_ID ? blank : null);
        expect(page.sandbox.GAIP_RegionalProfiles.detectRegionForSite(SITE_ID)).toBeNull();
    });

    test('a site nobody asked about is not answered for', () => {
        expect(RP.detectRegionForSite('no-such-site')).toBeNull();
        expect(RP.detectRegionForSite(null)).toBeNull();
        expect(RP.detectRegionForSite()).toBeNull();
    });

    test('a poisoned page does not change the answer — it comes from the site', () => {
        // The page's own coordinate fields answer with the poisoning's shifted
        // number; the site's row is untouched. Before the fix that field WAS
        // the answer.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        poisonPage(page.sandbox);
        const domLat = page.sandbox.document.querySelector('.gaip-lat');
        expect(String(domLat.value)).toContain(POISON_SENTINEL);
        expect(page.sandbox.GAIP_RegionalProfiles.detectRegionForSite(SITE_ID)).toBe('new_zealand');
    });

    test('real coordinates of ANOTHER country in the page\'s fields do not answer', () => {
        // The measured defect, reproduced as a value rather than as a text
        // scan: the page's field holds a perfectly usable Sydney latitude —
        // the previous site's, which is exactly how it happens — and the site
        // is in New Zealand. A chain that asks the DOM first answers
        // Australia; one that asks the site answers New Zealand.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        page.sandbox.document.querySelector = (sel) => {
            const s = String(sel);
            if (s.indexOf('gaip-lat') >= 0) return { value: '-33.8688' };
            if (s.indexOf('gaip-lon') >= 0) return { value: '151.2093' };
            return null;
        };
        expect(page.sandbox.GAIP_RegionalProfiles.detectRegionForSite(SITE_ID)).toBe('new_zealand');
    });

    test('the two sites in the store are told apart', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SC = page.sandbox.GAIP_SiteConfig;
        const here = SC.getSite(SITE_ID);
        const rows = { elsewhere: Object.assign({}, here, { id: 'elsewhere', latitude: -33.8688, longitude: 151.2093 }) };
        rows[SITE_ID] = here;
        SC.getSite = (id) => rows[id] || null;
        const RP2 = page.sandbox.GAIP_RegionalProfiles;
        expect(RP2.detectRegionForSite('elsewhere')).toMatch(/^australia/);
        expect(RP2.detectRegionForSite(SITE_ID)).toBe('new_zealand');
    });
});

describe('GH-476 — nothing in the region chain reads the page\'s coordinate fields', () => {
    /**
     * Reads of the page's coordinate fields left standing in the chain's
     * files, each with what it is for and why it is not this ticket's.
     *
     * The count is the ratchet: it can only go down, and it is stated per file
     * so that a NEW read is visible even where one already stands.
     */
    const DOM_COORDINATE_READS = {
        // Not a region question. `getLatitude()` answers "how far from the
        // equator is this turf" for the seasonal and hemisphere logic, and
        // ends in a hardcoded -35 — the same class as the region's old
        // 'uk_ireland', one question over. Converting it changes seasonal
        // behaviour, which is not what the owner answered, so it stays named
        // here and belongs to the remaining inventory of section 10.5.
        'nutrition-prebble-integration.js': 1
    };

    test.each(REGION_CHAIN)('%s asks the site, not the DOM', (file) => {
        const src = code(read(file));
        const reads = (src.match(/\.gaip-lat|\.gaip-lon/g) || []);
        const allowed = DOM_COORDINATE_READS[file] || 0;
        expect({ file: file, domCoordinateReads: reads.length })
            .toEqual({ file: file, domCoordinateReads: allowed });
    });

    test('every read still standing is one that is named, and the names are used', () => {
        const idle = Object.keys(DOM_COORDINATE_READS).filter((f) =>
            (code(read(f)).match(/\.gaip-lat|\.gaip-lon/g) || []).length === 0);
        expect({ idle: idle }).toEqual({ idle: [] });
    });

    test('every file in the chain calls the by-id function', () => {
        const notConverted = REGION_CHAIN
            .filter((f) => f !== 'regional-profiles.js')
            .filter((f) => !/detectRegionForSite/.test(code(read(f))));
        expect({ notConverted: notConverted }).toEqual({ notConverted: [] });
    });

    test('no file anywhere still calls the function that read the page', () => {
        const callers = fs.readdirSync(ASSETS)
            .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
            .filter((f) => /detectRegionFromHub\s*\(/.test(code(read(f))));
        expect({ callers: callers }).toEqual({ callers: [] });
    });
});
