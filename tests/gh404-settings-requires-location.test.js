/**
 * GH-404 — Settings must not save a site without coordinates.
 *
 * `sites.latitude` is a nullable column; both `store()` and `update()` validate
 * it as `nullable`; and `syncRegistry()` creates a site without touching it at
 * all. So a site could be saved, and used, with no location.
 *
 * Nothing downstream then fails loudly. Each of these substitutes a hardcoded
 * Sydney-ish latitude when it cannot resolve one:
 *
 *   climate-module-v2.js:682      -33.87
 *   disease-integration.js:376    -33.87
 *   hub-orchestrator.js:1455      -33.87
 *   irrigation-scheduler.js:263   -33
 *   hub-tissue-v3.js:385, 2294    -35, -33
 *
 * The site therefore gets a full, confident report — climate, disease risk,
 * growth potential, irrigation — computed for somewhere it is not. For a UK or
 * NZ site that is the wrong hemisphere and the wrong season, with nothing in the
 * document saying so.
 *
 * Removing those fallbacks is separate work. This is the gate in front of them,
 * in the one place a user sets a location. The gate tests the coordinates,
 * because they are what the rest of the product reads; the message points at the
 * Location search, because picking a result is what fills them in.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const readAsset = (f) => fs.readFileSync(path.join(__dirname, '../assets', f), 'utf8');
const readView = (f) => fs.readFileSync(path.join(__dirname, '../app/resources/views', f), 'utf8');

describe('GH-404 — the Site form refuses to save without coordinates', () => {
    const src = readAsset('settings-init.js');

    test('the submit handler gates on both coordinates before building the payload', () => {
        const gate = src.match(/if \(_lat === ''[^{]*\{/);
        expect(gate).not.toBeNull();
        // Both fields, and both must be real numbers — an empty string parses to
        // NaN, but so does anything else a paste could put there.
        expect(src).toMatch(/_lat === ''\s*\|\|\s*_lon === ''/);
        expect(src).toMatch(/!isFinite\(parseFloat\(_lat\)\)\s*\|\|\s*!isFinite\(parseFloat\(_lon\)\)/);
    });

    test('the gate runs before the payload is assembled, not after', () => {
        const gateAt = src.indexOf("_lat === ''");
        const payloadAt = src.indexOf('var payload = {');
        expect(gateAt).toBeGreaterThan(-1);
        expect(payloadAt).toBeGreaterThan(-1);
        expect(gateAt).toBeLessThan(payloadAt);
    });

    test('it stops the save rather than warning and carrying on', () => {
        const slice = src.slice(src.indexOf("_lat === ''"), src.indexOf("_lat === ''") + 900);
        expect(slice).toMatch(/setMsg\(siteMsg,/);
        expect(slice).toMatch(/return;/);
    });

    test('the message sends the user to the Location search, not to a latitude box', () => {
        const slice = src.slice(src.indexOf("_lat === ''"), src.indexOf("_lat === ''") + 900);
        expect(slice).toMatch(/Location/);
        // Two cases: nothing typed at all, and a name that never resolved.
        expect(slice).toMatch(/Location is required/);
        expect(slice).toMatch(/no coordinates yet/);
    });

    test('the reasoning survives in place, so nobody removes the gate without meeting it', () => {
        expect(src).toMatch(/GH-404/);
        expect(src).toMatch(/hardcoded Sydney latitude/);
    });
});

describe('GH-404 — the form marks Location required, and leaves the coordinates editable', () => {
    const view = readView('settings.blade.php');

    test('Location carries the required attribute, like the site name does', () => {
        const block = view.slice(view.indexOf('id="stg-location-name"'), view.indexOf('id="stg-location-name"') + 260);
        expect(block).toMatch(/required/);
    });

    test('latitude and longitude are NOT marked required — they are filled by the picker', () => {
        for (const id of ['stg-latitude', 'stg-longitude']) {
            const at = view.indexOf('id="' + id + '"');
            expect(at).toBeGreaterThan(-1);
            const block = view.slice(at, view.indexOf('</div>', at));
            expect(block).not.toMatch(/\srequired/);
        }
    });

    test('the picker still writes into both coordinate fields', () => {
        const src = readAsset('settings-init.js');
        expect(src).toMatch(/getElementById\('stg-latitude'\)/);
        expect(src).toMatch(/getElementById\('stg-longitude'\)/);
    });
});

describe('GH-404 — the fallbacks this gate stands in front of are still there', () => {
    // If someone removes them later, this test should fail and be deleted along
    // with the reasoning above — not quietly left asserting a stale claim.
    const cases = [
        ['climate-module-v2.js', /state\.location\?\.lat \|\| -33\.87/],
        ['disease-integration.js', /state\.location\?\.lat \|\| -33\.87/],
        ['irrigation-scheduler.js', /location\?\.lat \|\| -33/],
    ];
    test.each(cases)('%s still substitutes a hardcoded latitude', (file, pattern) => {
        expect(readAsset(file)).toMatch(pattern);
    });
});
