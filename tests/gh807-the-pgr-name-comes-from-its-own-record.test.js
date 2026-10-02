/**
 * GH-807 (queue item 3vya) — THE PGR'S NAME COMES FROM THE RECORD OF THAT PRODUCT, AND THE CALCULATION
 * DOES NOT MOVE.
 *
 * WHAT THE OWNER SAW: "Primo Maxx 120", applied on `Hoxton Soccer - Kate's test`, printed as "Indigo
 * Amigo (TE 120g/L)" on the dashboard and on `/plan`. The trade name was mapped to `TE120`, which is the
 * catalogue's record for Indigo Amigo at the same strength; the catalogue has had `PRIMO_MAXX` all along.
 *
 * THIS FILE HOLDS TWO THINGS, and they are two different subjects:
 *   1. THE BROWSER'S COPY of the name→record map (`PGR_PRODUCT_MAP` in `spray-log-cascade.js`). There
 *      are two copies of that map, and the reviewer's requirement of 02.10.2026 is that each is mutated
 *      on its own. This file reads only the browser's; the server's is read only by
 *      `app/tests/Feature/Gh807ThePgrNameComesFromItsOwnRecordTest.php`, through the route's answer.
 *      Break one copy and exactly one of the two files reddens — that is how "both are fixed" is told
 *      from "one is fixed and the test is looking at the other".
 *   2. THE MODULE'S ANSWER on a state this file declares: the name changes and NOTHING else does.
 *
 * WHERE THE NAME IS CHECKED AND WHERE IT IS NOT. Checked: the code the server answers with (the PHP case),
 * the map the browser falls back to (here), and the name the module computes (here). NOT checked: the Word
 * export, which takes the whole PGR section — the name included — from the page's own `GAIP_PGR_RESULT`
 * rather than from the stored row. That is the class of GH-459 and it is carried as queue item 3gt; this
 * file does not read that global, so the reviewer's M11 must leave it green.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CASCADE = fs.readFileSync(path.join(__dirname, '../assets/spray-log-cascade.js'), 'utf8');

/** The browser's own copy of the map, read out of the file as it stands. */
function theBrowsersMap() {
    const start = CASCADE.indexOf('    var PGR_PRODUCT_MAP = {');
    const end = CASCADE.indexOf('};', start);
    if (start === -1 || end === -1) throw new Error('PGR_PRODUCT_MAP moved in spray-log-cascade.js');
    const sandbox = {};
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(CASCADE.slice(start, end + 2) + '\nvar __map = PGR_PRODUCT_MAP;', ctx);

    return ctx.__map;
}

/** The PGR module, loaded the way the plan's own measurement loaded it: in a `vm` with a window. */
function theModule() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/gilba-pgr-module-v3.js'), 'utf8');
    const sandbox = { console: { log() {}, warn() {}, error() {} } };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(src, ctx);

    return ctx.gaip_pgr_calculate;
}

/**
 * THE STATE THE NUMBERS BELOW ARE TAKEN ON, declared here rather than quoted from a run — the reviewer's
 * requirement of 02.10.2026: a number read off an output describes that output, and only its state makes
 * it a statement about behaviour.
 *
 * Creeping bentgrass greens, 3.2 mm of cut, an application 30 days before the day the case pins, and the
 * module's own temperature estimation (no measured series is handed in, which is what `source` reports).
 */
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
const THE_STATE = (productType, appliedDaysAgo) => ({
    turf: { grassSpecies: 'creeping bentgrass', hoc: 3.2, surfaceType: 'greens' },
    pgr: { productType: productType, applicationDate: daysAgo(appliedDaysAgo) },
    location: { lat: -36.85, lon: 174.76 },
});

/**
 * TWO STATES, and the dates are relative to the day the case runs on purpose: the module takes "today"
 * from the clock when the state does not name it, so a fixed date would make these numbers drift with
 * the calendar and the case would go red on its own one day (the class of GH-791). Twenty days is an
 * effect still in force; a hundred and twenty is one long spent — a comparison over a single expired
 * answer would be made where half the fields sit at their limits.
 *
 * AND THE NUMBERS BELOW ARE PRINTED, NOT ASSERTED. What is asserted is that the two answers are the
 * same but for the name, which holds on any day. The figures are in the output so that a reader can see
 * what was compared.
 */
const IN_FORCE = 20;
const LONG_SPENT = 120;

describe('GH-807 — the browser\'s copy of the name map', () => {
    test('both keys of Primo Maxx lead to the record of Primo MAXX', () => {
        const map = theBrowsersMap();
        process.stdout.write('[gh807] the browser map for Primo: '
            + JSON.stringify({ 'primo maxx': map['primo maxx'], 'primo maxx 120': map['primo maxx 120'],
                'primo maxx 1ec': map['primo maxx 1ec'], 'primo 250ec': map['primo 250ec'] }) + '\n');

        expect(map['primo maxx']).toBe('PRIMO_MAXX');
        expect(map['primo maxx 120']).toBe('PRIMO_MAXX');
    });

    test('and the names around them are untouched', () => {
        const map = theBrowsersMap();
        // Each with its reason: `1EC` is another formulation with no record of its own; `250EC` always
        // had one; `indigo amigo 120` is the product `TE120` is actually about.
        expect(map['primo maxx 1ec']).toBe('TE175');
        expect(map['primo 250ec']).toBe('TE250');
        expect(map['primo 250 ec']).toBe('TE250');
        expect(map['indigo amigo 120']).toBe('TE120');
        expect(map['amigo 120']).toBe('TE120');
    });

    test('this file reads the BROWSER copy only — it cannot see the server map at all', () => {
        // The distinguishing instrument the reviewer asked for, said as a fact about this file: the
        // server's map lives in PHP and nothing here loads it.
        expect(CASCADE).toContain('PGR_PRODUCT_MAP');
        expect(fs.existsSync(path.join(__dirname, '../app/app/Http/Controllers/SprayLogController.php')))
            .toBe(true);
        const mine = fs.readFileSync(__filename, 'utf8');
        expect(mine).not.toMatch(/SprayLogController\.php['"]\s*\)\s*,\s*['"]utf8/);
        // And it does not read the page global the Word export takes its section from.
        expect(mine).not.toMatch(/GAIP_PGR_RESULT\s*[=.[]/);
    });
});

describe('GH-807 — the module names the product and changes nothing else', () => {
    test('the name is "Primo MAXX", and every other field equals the TE120 answer on the same state', () => {
        const pgr = theModule();
        expect(typeof pgr).toBe('function');

        const asPrimoMaxx = pgr(THE_STATE('PRIMO_MAXX', IN_FORCE));
        const asTe120 = pgr(THE_STATE('TE120', IN_FORCE));

        process.stdout.write('[gh807] the state: ' + JSON.stringify(THE_STATE('<code>', IN_FORCE))
            + '\n[gh807] as PRIMO_MAXX: ' + JSON.stringify({
                name: asPrimoMaxx.product.name, code: asPrimoMaxx.product.code,
                gdd: asPrimoMaxx.gdd.accumulated, threshold: asPrimoMaxx.gdd.threshold,
                base: asPrimoMaxx.gdd.base, source: asPrimoMaxx.gdd.source,
                suppressionPct: asPrimoMaxx.effect.suppressionPct, phase: asPrimoMaxx.effect.phase,
            })
            + '\n[gh807] as TE120:      ' + JSON.stringify({
                name: asTe120.product.name, code: asTe120.product.code,
                gdd: asTe120.gdd.accumulated, threshold: asTe120.gdd.threshold,
                base: asTe120.gdd.base, source: asTe120.gdd.source,
                suppressionPct: asTe120.effect.suppressionPct, phase: asTe120.effect.phase,
            }) + '\n');

        // THE NAME, exactly — "PRIMO_MAXX" in the name's place is the code, and is not this repair.
        expect(asPrimoMaxx.product.name).toBe('Primo MAXX');
        expect(asPrimoMaxx.product.code).toBe('PRIMO_MAXX');
        expect(asTe120.product.name).toBe('Indigo Amigo (TE 120g/L)');

        // AND NOTHING ELSE MOVED: everything but the product's own name and code, compared whole rather
        // than field by field, so a figure nobody thought of is compared too.
        const withoutTheName = (answer) => {
            const copy = JSON.parse(JSON.stringify(answer));
            delete copy.product.name;
            delete copy.product.code;

            return copy;
        };
        expect(withoutTheName(asPrimoMaxx)).toEqual(withoutTheName(asTe120));

        // And on a state where the effect is long spent, which is a different half of the module.
        const spentA = pgr(THE_STATE('PRIMO_MAXX', LONG_SPENT));
        const spentB = pgr(THE_STATE('TE120', LONG_SPENT));
        process.stdout.write('[gh807] long spent, as PRIMO_MAXX: ' + JSON.stringify({
            gdd: spentA.gdd.accumulated, phase: spentA.effect.phase,
            suppressionPct: spentA.effect.suppressionPct }) + '\n');
        expect(withoutTheName(spentA)).toEqual(withoutTheName(spentB));
        expect(spentA.product.name).toBe('Primo MAXX');
        // The active ingredient and the type are the same in both records, which is why the figures are.
        expect(asPrimoMaxx.product.activeIngredient).toBe(asTe120.product.activeIngredient);
        expect(asPrimoMaxx.product.type).toBe(asTe120.product.type);
    });

    test('a code the catalogue does not carry is answered with the code itself, as before', () => {
        const pgr = theModule();
        const unknown = pgr(THE_STATE('NOT_A_PRODUCT', IN_FORCE));
        process.stdout.write('[gh807] an unknown code: '
            + JSON.stringify({ name: unknown.product.name, code: unknown.product.code }) + '\n');

        // The module's own fallback, untouched by this hand-in and named so that it is not mistaken for
        // the repair: with no record, the code stands in the name's place.
        expect(unknown.product.name).toBe('NOT_A_PRODUCT');
    });
});
