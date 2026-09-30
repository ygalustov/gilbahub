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

/**
 * GH-789 (queue item 7) — THE GATE MOVED TO THE SERVER, AND THIS IS WHAT IT LOOKS LIKE NOW.
 *
 * What GH-404 decided is unchanged and is still the reason for everything above: a site must not be saved
 * without coordinates, because five engines substitute a hardcoded Sydney latitude when they cannot resolve
 * one and the site then gets a full, confident report computed for somewhere it is not.
 *
 * WHAT CHANGED IS WHO REFUSES. The gate was two paragraphs of the page's own words, and it was the fourth
 * hand-written answer to "which inputs are required" -- beside the template's `required` attribute, the
 * browser's list of five identity fields and this controller's list. It also refused without marking the
 * field. `location.lat` and `location.lon` are required inputs of the list and the Site tab is their
 * declared place, so the server refuses the save and names them, and the tab frames the field and prints
 * one sentence from the list's own words. The server half is
 * `app/tests/Feature/Gh789TheServerRefusesByPlaceTest.php`.
 */
describe('GH-789 — the coordinates are refused by the server, and this page shows which field', () => {
    const src = readAsset('settings-init.js');
    const { codeOf } = require('./lib/source-without-comments');
    const code = codeOf(src, 'settings-init.js');

    test('the page no longer carries a gate of its own', () => {
        // Read as CODE: the reasoning above stays in the file as a comment, and a sentence about a gate
        // counted as the gate is the class GH-788 built this reader for.
        process.stdout.write('[gh789] the page still tests the coordinates itself: '
            + /_lat === ''/.test(code) + '\n');

        expect(code).not.toMatch(/_lat === ''/);
        expect(code).not.toMatch(/Location is required/);
        expect(code).not.toMatch(/no coordinates yet/);
    });

    test('the tab names its place, so the server judges it by the inputs this tab collects', () => {
        expect(code).toMatch(/patchGaipConfig\(_sections, 'settings\.site'\)/);
    });

    test('a refusal that names fields is shown through the shared marker, not as a network error', () => {
        const handler = code.slice(code.indexOf('function showRefusal'), code.indexOf('function showRefusal') + 700);
        process.stdout.write('[gh789] the refusal handler: ' + handler.replace(/\s+/g, ' ').slice(0, 220) + '\n');

        expect(handler).toMatch(/err\.body\.missing/);
        expect(handler).toMatch(/marker\.mark\(form, missing\)/);
        // And the site form uses it rather than the one sentence it used to answer everything with. The
        // Zones tab still says "Network error." and is not this item's subject, so the absence is asserted
        // where it belongs: inside the site form's own handler.
        expect(code).toMatch(/showRefusal\('stg-site-form', siteMsg, err\)/);
        const siteSave = code.slice(code.indexOf("apiFetch('PATCH', '/sites/' + siteId, payload)"));
        expect(siteSave.slice(0, 900)).not.toMatch(/'Network error\.'/);
    });

    test('the reasoning survives in place, so nobody removes the gate without meeting it', () => {
        expect(src).toMatch(/GH-404/);
        expect(src).toMatch(/hardcoded Sydney latitude/);
    });
});

describe('GH-404 — the form marks Location required, and leaves the coordinates editable', () => {
    const view = readView('settings.blade.php');

    test('Location carries the required mark, drawn from the list rather than typed in', () => {
        /**
         * GH-789: the `required` attribute went with the page's gate -- it sat on forms that all carry
         * `novalidate`, so it was a mark and nothing else. The mark is now derived per site from the list,
         * and it stands beside Location because that is the field a person answers.
         *
         * THIS IS A STRUCTURAL PIN AND NOT THE PROOF, said out loud because the reviewer caught the same
         * shape one layer over: an assertion about the TEXT of a template survives a rename of the helper
         * and misses a mark arriving another way. What is RENDERED is asserted where it can be rendered --
         * `app/tests/Feature/Gh789TheFormAsksByTheListTest.php` draws this page for every turf type and
         * every editing role and reads the marks and the bindings back off the page. This file is jest and
         * has no server to render with, so it pins the wiring and names where the behaviour is held.
         */
        const at = view.indexOf('id="stg-location-name"');
        const label = view.slice(Math.max(0, at - 700), at);
        expect(label).toMatch(/\$requiredNote\('location\.lat'\)/);
        // And the control states which input it answers, which is how the marker finds it.
        expect(view.slice(at, at + 260)).toMatch(/\$inputAttr\('location\.lat'\)/);
    });

    test('latitude and longitude carry no mark of their own — they are filled by the picker', () => {
        // GH-789: unchanged in substance. The word is drawn once, beside Location, and these two boxes stay
        // editable for the case where a search result is close but not exact. They do state which input
        // each one answers, so a refusal frames the box the value lands in.
        for (const id of ['stg-latitude', 'stg-longitude']) {
            const at = view.indexOf('id="' + id + '"');
            expect(at).toBeGreaterThan(-1);
            const block = view.slice(at, view.indexOf('</div>', at));
            expect(block).not.toMatch(/\srequired[\s=>]/);
            expect(block).not.toMatch(/requiredNote/);
        }
        expect(view).toMatch(/id="stg-latitude" name="latitude" \{!! \$inputAttr\('location\.lat'\)/);
        expect(view).toMatch(/id="stg-longitude" name="longitude" \{!! \$inputAttr\('location\.lon'\)/);
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
