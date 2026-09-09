/**
 * GH-386 — the sample pickers never restored the remembered selection.
 *
 * Both pickers in `assets/soil-nutrition-analysis.js` (the Analysis page's zone
 * selector, and the reusable `mountSampleDropdown()` that Plan > Nutrition uses
 * to choose which soil sample the Nutrition Program is generated for) stored
 * the chosen `sample.id` in `localStorage` and then compared it back with:
 *
 *     if (samples[j].id === persistedId) { ... }
 *
 * `/api/samples` returns `id` as a JSON **number**; everything that comes back
 * out of `localStorage` is a **string**. `123 === '123'` is false, so the match
 * never succeeded and the picker silently reopened on the first sample in the
 * list — every page load, for every user.
 *
 * User-visible consequence: on a multi-sample site the Plan page opens on a
 * sample the user did not choose, and clicking Generate computes and PERSISTS a
 * nutrition programme against that sample, with nothing on screen saying so.
 * Found while adding GH-384's MLSN and SLAN E2E fixtures: the harness had the
 * Plan page on Burns' "Green 2" while the export used "12th Fairway", so the
 * two surfaces were being compared on different samples.
 *
 * CANONICAL IDENTIFIER — decided deliberately, because two schemes are in play:
 *
 *   `samples.id` (the database primary key) is canonical here, compared as a
 *   string on both sides. It is what `/api/samples` returns, what
 *   `/api/samples/{id}/analyse` is addressed by, and it exists for every sample.
 *
 *   `client_uid` is NOT used: it is nullable (several tissue samples in the dev
 *   data have none), client-supplied rather than allocated, and not unique
 *   across sites.
 *
 *   The Word export's picker uses a third scheme entirely —
 *   `data-sample-uid = "<siteId>::<client_uid | payload label | sample_<id>>"`,
 *   built by sample-persistence.js for the client-side store. That answers a
 *   different question (identity within the offline store, across sites) and is
 *   deliberately left alone; conflating the two would be worse than the bug.
 *
 * Existing stored values are already the DB id stringified, so nothing needs
 * migrating — a user's remembered selection starts working on the next load.
 */

'use strict';

function loadModule() {
    jest.resetModules();
    global.window = global;
    global.document = {
        readyState: 'complete',
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getElementById() { return null; },
        head: { appendChild() {} },
        createElement() { return { style: {} }; },
    };
    global.localStorage = { getItem() { return null; }, setItem() {} };
    global.console = { log() {}, warn() {}, error() {}, info() {} };
    require('../assets/soil-nutrition-analysis.js');
    return global.GAIP_SoilNutritionAnalysis;
}

describe('GH-386 — a remembered sample id matches the sample it names', () => {
    let SN;
    beforeAll(() => { SN = loadModule(); });

    test('the live failure: a numeric API id against the string localStorage gives back', () => {
        // Test5 - NZ's soil sample 141, the exact shape that never matched.
        expect(SN._sampleIdMatches({ id: 141 }, '141')).toBe(true);
    });

    test('a string id on both sides matches too — the rule does not depend on which side is coerced', () => {
        expect(SN._sampleIdMatches({ id: '141' }, '141')).toBe(true);
        expect(SN._sampleIdMatches({ id: 141 }, 141)).toBe(true);
    });

    test('different samples still do not match, including the numeric-prefix trap', () => {
        expect(SN._sampleIdMatches({ id: 142 }, '141')).toBe(false);
        expect(SN._sampleIdMatches({ id: 14 }, '141')).toBe(false);
        expect(SN._sampleIdMatches({ id: 1411 }, '141')).toBe(false);
    });

    test('a missing id on either side is never a match — "no selection" must not select sample 0', () => {
        expect(SN._sampleIdMatches({ id: null }, '141')).toBe(false);
        expect(SN._sampleIdMatches({ id: undefined }, '141')).toBe(false);
        expect(SN._sampleIdMatches({}, '141')).toBe(false);
        expect(SN._sampleIdMatches({ id: 141 }, null)).toBe(false);
        expect(SN._sampleIdMatches({ id: 141 }, '')).toBe(false);
        expect(SN._sampleIdMatches(null, '141')).toBe(false);
    });

    test('the key helper stringifies, and refuses to invent one', () => {
        expect(SN._sampleIdKey(141)).toBe('141');
        expect(SN._sampleIdKey('141')).toBe('141');
        expect(SN._sampleIdKey(null)).toBeNull();
        expect(SN._sampleIdKey(undefined)).toBeNull();
    });

    test('picking the right sample out of a real list, by its remembered id', () => {
        // Burns' fairway/green samples: the harness case, where the list order
        // put "Green 2" first and "12th Fairway" is the one that was chosen.
        const samples = [
            { id: 124, client_uid: 'Soil_2_3cbo', payload: { _label: 'Green 2' } },
            { id: 52, client_uid: 'Soil_25_zo0t', payload: { _label: '12th Fairway' } },
            { id: 123, client_uid: 'Soil_1_3cbn', payload: { _label: 'Putter Green' } },
        ];
        const pick = (persisted) => samples.findIndex((s) => SN._sampleIdMatches(s, persisted));
        expect(pick('52')).toBe(1);
        expect(pick('123')).toBe(2);
        expect(pick('124')).toBe(0);
        expect(pick('999')).toBe(-1);   // caller falls back to its own default
        expect(pick(null)).toBe(-1);
    });
});

describe('GH-386 — both pickers route through the one rule, and it is the DB id that is stored', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    test('no raw `=== persistedId` comparison survives in either picker', () => {
        expect(code).not.toMatch(/\.id === persistedId/);
        const matches = code.match(/_snSampleIdMatches\(samples\[j\], persistedId\)/g) || [];
        expect(matches.length).toBe(2); // the zone selector and the reusable mount
    });

    test('the stored value is stringified at the point of writing, not left to implicit coercion', () => {
        expect(code).toMatch(/function _snSaveActiveId\(sampleId\) \{\s*var key = _snSampleIdKey\(sampleId\);/);
        const calendar = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
        expect(calendar).toMatch(/localStorage\.setItem\(storageKey\(\), String\(sample\.id\)\);/);
    });

    test('the export picker\'s own identity scheme is untouched — the two are not conflated', () => {
        const persistence = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
        // sample-persistence.js keys the offline store by client_uid/label/id;
        // this ticket changed nothing there.
        expect(persistence).toMatch(/client_uid/);
        expect(code).not.toMatch(/data-sample-uid/);
    });
});
