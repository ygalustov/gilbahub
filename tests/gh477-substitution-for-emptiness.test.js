/**
 * GH-477 (PLAN-GH439 section 10.6, fifteenth refinement, point 3) —
 * a plausible substitute for an empty site fact is a CLASS, and this is its
 * guard.
 *
 * One shape, found four times in this section under four different names: a
 * field is empty, and something plausible is printed or saved in its place.
 * The report's Location line printed "Not specified" where a site had no place
 * name (10.8(10)); the region defaulted to 'uk_ireland' where a site had no
 * coordinates (fourteenth refinement); the timezone defaulted to
 * 'Australia/Sydney' (2.5); the species defaults to "Not specified" and the
 * variety to "generic" (10.8(7)); and the site card on /morning-briefing
 * prints the site's coordinates where it has no name for the place. Each was
 * found by looking, and each was fixed, or left, one at a time.
 *
 * What a page SHOULD print instead of a missing name, species or variety is a
 * domain question and the owner's: 10.8(7), 10.8(10), and 10.8(12) for the
 * site card and everything else in this list. Until she answers, the list is
 * recorded rather than emptied, and this file is a ratchet: it may shrink and
 * it may not grow. A NEW substitution is a new instance of a class the owner
 * is already deciding about, and it reddens here.
 *
 * What counts, exactly:
 *   - the emptiness of a SITE FACT is being replaced — the fields the
 *     ownership table declares (FIELD_PATHS in nutrition-program-inputs.js),
 *     not any `||` in the codebase;
 *   - the substitute is not itself empty (`x || ''` prints empty, which is
 *     what "no substitution" looks like);
 *   - and the substituted value reaches something the client sees or the
 *     server stores: `.textContent`, `.innerHTML`, `.innerText`, a docx
 *     `TextRun`, or the body of a PATCH/POST/PUT.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { inventory, inventoryOf, watchedFields, WATCH_ALIASES, WATCH_EXCLUDED } =
    require('./lib/substitution-inventory');
const { loadPage, poisonPage } = require('./helpers/export-page-sandbox');
const { EMPTY, EMPTY_LOCATED } = require('./lib/empty-inputs');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const RECORDED = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'substitution-inventory.json'), 'utf8'));

const FIELDS = watchedFields(fs.readFileSync(path.join(ASSETS, 'nutrition-program-inputs.js'), 'utf8'));
const CURRENT = inventory(ASSETS, FIELDS);

describe('GH-477 — the watched fields are the owned fields, not a list of their own', () => {
    test('every field the ownership table names is watched, under both of its names', () => {
        const src = fs.readFileSync(path.join(ASSETS, 'nutrition-program-inputs.js'), 'utf8');
        // Two of the table's own entries, one per store, checked by hand so
        // that a derivation that quietly stopped deriving is visible.
        expect(src).toMatch(/locationName: \['site-row', 'location_name'\]/);
        expect(FIELDS).toContain('locationName');
        expect(FIELDS).toContain('location_name');
        expect(src).toMatch(/species: \['site-config', 'turf\.species'\]/);
        expect(FIELDS).toContain('species');
        // and the two that are watched without being in the table say why
        Object.keys(WATCH_ALIASES).forEach((a) => {
            expect(FIELDS).toContain(a);
            expect(typeof WATCH_ALIASES[a]).toBe('string');
        });
        WATCH_EXCLUDED.forEach((x) => expect(FIELDS).not.toContain(x));
    });

    test('the recorded list was taken with these fields', () => {
        expect(RECORDED._fields).toEqual(FIELDS);
    });
});

describe('GH-477 — the guard finds what it is for', () => {
    test('positive control: a planted substitution reaching innerHTML is found', () => {
        const planted = [
            'function render(site) {',
            "    var place = site.location_name || 'Somewhere Plausible';",
            '    document.getElementById("x").innerHTML = place;',
            '}'
        ].join('\n');
        const found = inventoryOf('planted.js', planted, FIELDS);
        expect(found.map((f) => f.text)).toEqual(["'Somewhere Plausible'"]);
        expect(found[0].field).toBe('location_name');
        expect(found[0].sink).toBe('innerHTML');
    });

    /**
     * GH-728 (queue item 3bs, the reviewer's return) — THE CENSUS MUST NOT ANSWER BY THE ORDER OF THE
     * FILE.
     *
     * Her planted case, and it is here because it was measured before the repair: the values were
     * keyed by Babel's bindings while the map of CALLEES was still keyed by name, so two functions of
     * one name in different scopes shared one entry and the last one parsed won. Measured then — the
     * silent twin declared BELOW hid a substitution that reaches `innerHTML` (the census answered
     * `[]`), and the same twin declared ABOVE did not. A ratchet that misses a new substitution
     * because of where a same-named function happens to sit is not a ratchet.
     *
     * Both orders are planted, because each is a different failure: one loses a real substitution,
     * the other would record one that is not there.
     */
    /**
     * GH-728, THE REVIEWER'S SECOND RETURN — AND IN EVERY FORM A FUNCTION CAN BE DECLARED IN.
     *
     * Her mutation on the first repair: key `const fill = function` by name again, and the case
     * stayed green — it planted only `function fill(…)`, so the other two doors were unwatched. A
     * declaration form is not a detail here: the map is filled by three different visitors
     * (`FunctionDeclaration`, `VariableDeclarator`, and a property on an object literal), and each
     * one can be keyed correctly or by name on its own.
     *
     * So the twin is planted in all three forms, in both orders. The sink and the caller stay the
     * same text in every arrangement, so what differs between the rows is only the form.
     */
    const CALLER = 'function paint(site) { var place = site.location_name || "Somewhere Plausible"; fill(place); }';
    const FORMS = {
        'function declaration': {
            sink: 'function fill(value) { document.getElementById("a").innerHTML = value; }',
            silent: '(function () { function fill(x) { return x; } fill("nothing"); }());',
        },
        'const function expression': {
            sink: 'const fill = function (value) { document.getElementById("a").innerHTML = value; };',
            silent: '(function () { const fill = function (x) { return x; }; fill("nothing"); }());',
        },
        'arrow function': {
            sink: 'const fill = (value) => { document.getElementById("a").innerHTML = value; };',
            silent: '(function () { const fill = (x) => x; fill("nothing"); }());',
        },
    };

    test('GH-728: a same-named function in another scope hides nothing — every form, both orders', () => {
        const rows = [];
        Object.entries(FORMS).forEach(([form, { sink, silent }]) => {
            rows.push({ form, order: 'twin BELOW',
                found: inventoryOf('below.js', [sink, CALLER, silent].join('\n'), FIELDS).map((r) => r.text) });
            rows.push({ form, order: 'twin ABOVE',
                found: inventoryOf('above.js', [silent, sink, CALLER].join('\n'), FIELDS).map((r) => r.text) });
            rows.push({ form, order: 'no twin',
                found: inventoryOf('plain.js', [sink, CALLER].join('\n'), FIELDS).map((r) => r.text) });
        });
        process.stdout.write('[gh728] the same planted substitution, every declaration form:\n'
            + rows.map((r) => '[gh728]    ' + r.form.padEnd(26) + r.order.padEnd(12) + ' -> '
                + JSON.stringify(r.found)).join('\n') + '\n');

        // Nine arrangements, and not one of them may decide the answer.
        const blind = rows.filter((r) => JSON.stringify(r.found) !== JSON.stringify(['"Somewhere Plausible"']))
            .map((r) => r.form + ' / ' + r.order + ' -> ' + JSON.stringify(r.found));
        expect(blind).toEqual([]);
    });

    test('GH-728: a method on an object literal is matched by NAME, and the census says so', () => {
        /**
         * The boundary, printed rather than remembered: a key on an object literal is a property, not
         * a name in a scope, so there is no binding to key it by. Such a callee is matched by name and
         * appears in `callsKeyedByNameOnly`, which is how a reader learns where the scope-aware
         * matching stops.
         */
        const viaMethod = [
            'var ui = { fill: function (value) { document.getElementById("a").innerHTML = value; } };',
            'function paint(site) { var place = site.location_name || "Somewhere Plausible"; ui.fill(place); }',
        ].join('\n');
        const byMethodName = [
            'var ui = { fill: function (value) { document.getElementById("a").innerHTML = value; } };',
            'function paint(site) { var place = site.location_name || "Somewhere Plausible"; fill(place); }',
        ].join('\n');
        const a = inventoryOf('method.js', viaMethod, FIELDS);
        const b = inventoryOf('method-bare.js', byMethodName, FIELDS);
        process.stdout.write('[gh728] through `ui.fill(...)`  -> ' + JSON.stringify(a.map((r) => r.text))
            + ' | by name only: ' + JSON.stringify(a.callsKeyedByNameOnly) + '\n'
            + '[gh728] through a bare `fill(...)` that only an object literal declares -> '
            + JSON.stringify(b.map((r) => r.text)) + ' | by name only: '
            + JSON.stringify(b.callsKeyedByNameOnly) + '\n');

        // The boundary is real and named: the property-keyed function is reached by name.
        expect(b.callsKeyedByNameOnly).toEqual(['fill']);
        expect(b.map((r) => r.text)).toEqual(['"Somewhere Plausible"']);
    });

    test('negative control: the same substitution that reaches nothing is not found', () => {
        const unprinted = [
            'function render(site) {',
            "    var place = site.location_name || 'Somewhere Plausible';",
            '    return place.length;',
            '}'
        ].join('\n');
        expect(inventoryOf('unprinted.js', unprinted, FIELDS)).toEqual([]);
    });

    test('negative control: an empty substitute is not a substitution', () => {
        const empties = [
            'function render(site) {',
            "    document.getElementById('x').innerHTML = site.location_name || '';",
            '}'
        ].join('\n');
        expect(inventoryOf('empties.js', empties, FIELDS)).toEqual([]);
    });

    test('the living example is in the list: the site card prints coordinates for a missing place name', () => {
        // gaip-morning-briefing.js, buildSiteCard(): `location.name ||
        // (location.lat ? … .toFixed(3) + ',' + … : '')`. It is the reader the
        // copy guard could not see either, and it is still there on purpose:
        // what the card should say instead is 10.8(12).
        const card = CURRENT.filter((f) => f.file === 'gaip-morning-briefing.js'
            && f.field === 'name' && /toFixed\(3\)/.test(f.text));
        expect(card.length).toBe(1);
        expect(card[0].sink).toBe('innerHTML');
    });
});

describe('GH-477 — the ratchet: the list of substitutions may shrink and may not grow', () => {
    test('no substitution exists that is not in the recorded list', () => {
        const recorded = new Set(RECORDED.substitutions);
        const added = CURRENT.map((f) => f.signature).filter((s) => !recorded.has(s));
        // Named in full when this fails: a signature says the file, the field
        // whose emptiness is replaced, how, where it ends up, and the
        // substitute's own text.
        expect(added).toEqual([]);
    });

    test('the recorded list is real — it is not empty, and what it says is measured', () => {
        expect(RECORDED.substitutions.length).toBe(RECORDED._count);
        expect(RECORDED.substitutions.length).toBeGreaterThan(0);
        expect(CURRENT.length).toBeLessThanOrEqual(RECORDED.substitutions.length);
    });

    test('a removed substitution does not redden — that is the direction this ratchet allows', () => {
        const recorded = new Set(RECORDED.substitutions);
        const gone = RECORDED.substitutions.filter((s) => CURRENT.every((f) => f.signature !== s));
        // Today nothing has been removed since the list was taken; the
        // assertion is that removal is not an error, stated so that the
        // direction is part of the file and not an accident of the check above.
        expect(gone.every((s) => recorded.has(s))).toBe(true);
    });
});

describe('GH-477 — with every site fact empty, the document invents nothing', () => {
    let strings;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        // The page is poisoned, so a value that came from the page rather than
        // from the inputs is a sentinel and not a plausible default.
        poisonPage(page.sandbox);
        const data = page.sandbox.GAIP_WordExport.collectData(EMPTY);
        strings = [];
        (function walk(v, at) {
            if (v == null) return;
            if (typeof v === 'string') { strings.push({ at: at, value: v }); return; }
            if (typeof v !== 'object') return;
            Object.keys(v).forEach((k) => walk(v[k], at ? at + '.' + k : k));
        })(data, '');
        // A floor under the walk itself: the empty run still prints tens of
        // strings, and a walk that stopped finding them would pass the three
        // checks below by finding nothing. Measured at 62.
        expect(strings.length).toBeGreaterThan(50);
    });

    test('no coordinates are printed anywhere — not as a place name, not as anything else', () => {
        const coords = strings.filter((s) => /-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}/.test(s.value));
        expect(coords).toEqual([]);
    });

    test('no timezone is printed for a site that has none', () => {
        const zones = strings.filter((s) => /^[A-Z][A-Za-z_]+\/[A-Z][A-Za-z_]+$/.test(s.value));
        expect(zones).toEqual([]);
    });

    test('a site with coordinates and no place name prints no coordinates either', () => {
        // The all-empty run above cannot show this: with no coordinates in the
        // inputs, a check that none are printed passes for the wrong reason.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        poisonPage(page.sandbox);
        const data = page.sandbox.GAIP_WordExport.collectData(EMPTY_LOCATED);
        const printed = [];
        (function walk(v, at) {
            if (v == null) return;
            if (typeof v === 'string') { printed.push({ at: at, value: v }); return; }
            if (typeof v !== 'object') return;
            Object.keys(v).forEach((k) => walk(v[k], at ? at + '.' + k : k));
        })(data, '');
        expect(printed.length).toBeGreaterThan(50);
        expect(printed.filter((s) => /-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}/.test(s.value))).toEqual([]);
        // and the Location line is empty, which is the owner's decision on
        // 10.8(10) seen from the other side
        expect(data.site.location).toBe('');
    });

    test('no region name is printed for a site with no coordinates to derive one from', () => {
        // The fourteenth refinement deleted the 'uk_ireland' default; this is
        // the assertion that it, or another like it, has not come back by
        // another route.
        const regionish = strings.filter((s) => /^(uk_ireland|australia_nz|new_zealand|usa|europe)$/i.test(s.value));
        expect(regionish).toEqual([]);
    });
});
