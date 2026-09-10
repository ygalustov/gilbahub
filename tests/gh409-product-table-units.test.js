/**
 * GH-409 — the document's product tables print the Plan's columns and the
 * Plan's units.
 *
 * Two reports, one complaint: the .docx did not match the screen.
 *
 *   1. COLUMNS. The Annual Product Summary rendered "N | P | K | Mg | S" on one
 *      site and something else on the next, because b35fix328 turned a column
 *      on whenever some product in the table happened to carry that nutrient
 *      above 0.05 kg/ha. The Plan page has only ever had N, P and K.
 *
 *   2. UNITS. On a golf greens site the Plan's "Total Rate" column reads
 *      40 g/m², 90 L/ha, 61.6 g/m², 2 g/m², 90 L/ha; the document printed the
 *      same quantities as 400, 616 and 20 under a header that said "Total
 *      kg/ha". Ten times the figure, for every mass rate on every fine-turf
 *      site. The Fertiliser Purchasing Summary had it too.
 *
 * WHAT THIS FILE PINS. The rate rule and the column set, as behaviour, over the
 * REAL persisted programmes of the three sites that show the interesting cases
 * — read out of the development database into
 * tests/fixtures/gh409-product-rates.json, accumulated through the same shared
 * accumulator the export uses, and asserted against the exact strings the Plan
 * page prints. tests/e2e/gh409-product-table-units-live.test.js then reads both
 * surfaces for real: the painted Plan table, and the cells of a generated
 * .docx.
 *
 * THE THIRD SITE IS THE POINT. Federal Golf is Australian, and the Australian
 * panel used to print a soluble powder in kilograms on a greens surface where
 * the New Zealand panel printed it in g/m² — one row in a foreign unit in a
 * table of g/m² rows, which is what the product owner read as an error. Settled
 * by the owner: THE SURFACE DECIDES, everywhere. Urea Tech on Federal Golf's
 * greens is `6 g/m²` now, not `60 kg/ha`; the quantity is identical, and the
 * fixture below records both so the conversion is visible rather than asserted
 * from memory.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const delivery = require('../assets/nutrition-delivery-core.js');
const fixture = require('./fixtures/gh409-product-rates.json');

function readAsset(name) {
    return fs.readFileSync(path.join(__dirname, '../assets/', name), 'utf8');
}

/** The export's own resolution, from the fixture's stored surface type. The
 *  renderer that drew the page is recorded in the fixture and deliberately NOT
 *  consulted: the unit is a property of the surface. */
function optsFor(site) {
    return { useGM2: delivery.usesGM2(site.surfaceType) };
}

function productsOf(site) {
    return delivery.catalogueProducts(delivery.accumulate(site.monthly).products);
}

describe('GH-409 — which surfaces print g/m²', () => {
    test('exactly the five the Plan renderers list, and nothing near them', () => {
        ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets'].forEach((s) => {
            expect(delivery.usesGM2(s)).toBe(true);
        });
        ['sports', 'fairways', 'lawns', 'golf', 'rough', ''].forEach((s) => {
            expect(delivery.usesGM2(s)).toBe(false);
        });
    });

    test('the list is matched after normalising case and spacing, not by guessing at meaning', () => {
        expect(delivery.usesGM2('Golf Greens')).toBe(true);
        expect(delivery.usesGM2('golf-greens')).toBe(true);
        // Not in the Plan's list, so not here either: the document must not
        // print a unit the Plan page did not.
        expect(delivery.usesGM2('cotula_bowling_green')).toBe(false);
    });

    test('meta.useGM2 wins outright, as it does on the AU and UK panels', () => {
        expect(delivery.usesGM2('fairways', true)).toBe(true);
    });

    test('an unresolvable surface is not a greens surface', () => {
        expect(delivery.usesGM2(null)).toBe(false);
        expect(delivery.usesGM2(undefined)).toBe(false);
    });
});

describe('GH-409 — the rate a product row prints, on real programmes', () => {
    fixture.sites.forEach((site) => {
        describe(site.label + ' (' + site.surfaceType + ', drawn by ' + site.renderer + ')', () => {
            const opts = optsFor(site);
            const products = productsOf(site);

            test('every product the programme uses has a row', () => {
                expect(Object.keys(products).length).toBe(Object.keys(site.planRates).length);
            });

            test('each row prints the string the Plan page prints', () => {
                const bad = [];
                Object.values(products).forEach((p) => {
                    const want = site.planRates[p.name];
                    const got = delivery.productRate(p, opts).text;
                    if (want === undefined) { bad.push({ product: p.name, why: 'not in the fixture' }); return; }
                    if (got !== want) bad.push({ product: p.name, got: got, want: want });
                });
                expect(bad).toEqual([]);
            });

            test('the table\'s own bottom line keeps litres out of the kilograms', () => {
                expect(delivery.programmeTotalRate(Object.values(products), opts)).toBe(site.totalRate);
            });
        });
    });

    test('the two New Zealand greens sites are the reported defect, to the digit', () => {
        // The product owner reported the Plan showing these and the document
        // showing 400 / 616 / 20 kg/ha for the same three rows.
        const site = fixture.sites.find((s) => s.label === 'Test - GC - NZ - delivery');
        const rates = Object.values(productsOf(site)).map((p) => delivery.productRate(p, optsFor(site)).text);
        expect(rates.sort()).toEqual(['2 g/m²', '40 g/m²', '61.6 g/m²', '90 L/ha', '90 L/ha']);
    });

    test('a soluble powder on greens takes the surface\'s unit, whoever drew the page', () => {
        // THE CASE THE FOUR RENDERERS DISAGREED ABOUT, settled by the owner: the
        // surface decides. MAP Tech (20 kg/ha, New Zealand) and Urea Tech
        // (60 kg/ha, Australia) are the same shape of row on the same shape of
        // surface, and they print the same way now.
        const nz = fixture.sites.find((s) => s.label === 'Test - GC - NZ - delivery');
        const au = fixture.sites.find((s) => s.label === 'Federal Golf');
        expect(delivery.productRate(productsOf(nz).MAPTECH, { useGM2: true }).text).toBe('2 g/m²');
        expect(delivery.productRate(productsOf(au)['SOL-UREA'], { useGM2: true }).text).toBe('6 g/m²');
        // The quantity did not move — 60 kg/ha IS 6 g/m². Both cells, off the
        // same entry, so this is arithmetic and not a restated expectation.
        expect(delivery.productRate(productsOf(au)['SOL-UREA'], { useGM2: false }).text).toBe('60 kg/ha');
        expect(au.supersededRates['Urea Tech (soluble)']).toBe('60 kg/ha');
    });

    test('a true liquid is litres on every surface — litres do not become grams per m²', () => {
        const site = fixture.sites.find((s) => s.label === 'Test - GC - NZ - delivery');
        const ammos = productsOf(site).AMMOS;
        [{ useGM2: true }, { useGM2: false }, {}].forEach((o) => {
            expect(delivery.productRate(ammos, o).text).toBe('90 L/ha');
        });
    });

    test('a soluble powder is never litres — b35fix281\'s point, kept', () => {
        // The half of the old guard that was right. A soluble listed in the
        // liquid column carries kilograms, whatever field they arrived in.
        const soluble = { name: 'Sportsmaster WSF High N', form: 'soluble',
                          isLiquid: true, totalKg: 50, totalKgHa: 50, totalLHa: 0 };
        expect(delivery.productRate(soluble, { useGM2: false }).text).toBe('50 kg/ha');
        expect(delivery.productRate(soluble, { useGM2: true }).text).toBe('5 g/m²');
    });

    test('the same programme on a fairway prints kilograms, unchanged from before this ticket', () => {
        const site = fixture.sites.find((s) => s.label === 'Test - GC - NZ - delivery');
        const rates = {};
        Object.values(productsOf(site)).forEach((p) => {
            rates[p.name] = delivery.productRate(p, { useGM2: false }).text;
        });
        expect(rates['CC MD IV Greens']).toBe('400 kg/ha');
        expect(rates['Andersons Nutri DG 20-0-13']).toBe('616 kg/ha');
        expect(rates['MAP Tech (soluble)']).toBe('20 kg/ha');
        expect(rates['Ammos 22 (Nitro 22)']).toBe('90 L/ha');
    });
});

describe('GH-409 — g/m² keeps its decimal', () => {
    test('616 kg/ha is 61.6 g/m², not 62', () => {
        // Rounding it to a whole gram restates the programme by 4 kg/ha.
        expect(delivery.formatRate(616, 'g/m²')).toBe('61.6 g/m²');
        expect(delivery.formatRate(400, 'g/m²')).toBe('40 g/m²');
        expect(delivery.formatRate(20, 'g/m²')).toBe('2 g/m²');
    });

    test('kilograms and litres stay whole, as the Plan prints them', () => {
        expect(delivery.formatRate(616.4, 'kg/ha')).toBe('616 kg/ha');
        expect(delivery.formatRate(89.6, 'L/ha')).toBe('90 L/ha');
    });
});

describe('GH-409 — a soluble is recognised however its form is recorded', () => {
    test('the catalogue field, the New Zealand label, and the accumulator flag all count', () => {
        expect(delivery.isSolubleProduct({ form: 'soluble' })).toBe(true);
        expect(delivery.isSolubleProduct({ product: { form: 'soluble' } })).toBe(true);
        expect(delivery.isSolubleProduct({ isSoluble: true })).toBe(true);
        expect(delivery.isSolubleProduct({ id: 'MAPTECH', name: 'MAP Tech' })).toBe(true);
        expect(delivery.isSolubleProduct({ name: 'Urea Tech (soluble)' })).toBe(true);
        expect(delivery.isSolubleProduct({ name: 'Ammos 22 (Nitro 22)', form: 'liquid' })).toBe(false);
        expect(delivery.isSolubleProduct(null)).toBe(false);
    });
});

describe('GH-409 — the columns are the Plan\'s three', () => {
    // The renderer is a browser module; the decision itself is a plain function
    // and is read out of the source rather than loading the whole export.
    const src = readAsset('word-export.js');
    const fn = new Function('return ' + src.slice(
        src.indexOf('function _detectActiveNutrientColumns'),
        src.indexOf('function _rateDisplayOptions')).trim().replace(/\/\*\*[\s\S]*$/, ''))();

    test('N, P and K, whatever the rows happen to carry', () => {
        const heavy = [{ N: 100, P: 20, K: 80, Ca: 210, Mg: 115, S: 60 }];
        expect(fn(heavy)).toEqual({ P: true, Ca: false, Mg: false, S: false });
    });

    test('phosphorus is unconditional — an N-only programme still shows the column', () => {
        expect(fn([{ N: 100, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 }])).toEqual(
            { P: true, Ca: false, Mg: false, S: false });
        expect(fn([])).toEqual({ P: true, Ca: false, Mg: false, S: false });
        expect(fn(null)).toEqual({ P: true, Ca: false, Mg: false, S: false });
    });

    test('the two product tables ask the SAME function', () => {
        // The Purchasing Summary imported it and then never called it — its
        // columns came from a second threshold of its own, and the two could
        // disagree about the same products.
        const combined = readAsset('word-export-combined.js');
        expect(combined).toMatch(/_wxDetect\(aggNames\.map\(/);
        expect(combined).not.toMatch(/_absThreshold/);
    });
});

describe('GH-409 — the renderers print through the shared helper', () => {
    const single = readAsset('word-export.js');
    const combined = readAsset('word-export-combined.js');

    test('the Annual Product Summary header is the Plan\'s, and the unit is on the row', () => {
        expect(single).toMatch(/text: 'Total Rate', bold: true/);
        expect(single).not.toMatch(/text: 'Total kg\/ha', bold: true/);
        expect(single).toMatch(/_delivery\.productRate\(p, _rateOpts\)\.text/);
    });

    test('the total row is built from the entries, so litres are never added to kilograms', () => {
        expect(single).toMatch(/_delivery\.programmeTotalRate\(/);
        expect(single).not.toMatch(/text: String\(_round0\(_totalKg\)\), bold: true/);
    });

    test('both exports resolve the surface the same way, through one function', () => {
        expect(single).toMatch(/function _rateDisplayOptions\(data\)/);
        expect(single).toMatch(/_rateDisplayOptions: _rateDisplayOptions/);
        expect(combined).toMatch(/global\.GAIP_WordExport\._rateDisplayOptions/);
    });

    test('the surface comes from the programme the Plan drew, then the site record', () => {
        const at = single.indexOf('function _rateDisplayOptions');
        const body = single.slice(at, at + 1200);
        expect(body).toMatch(/meta\.surfaceType \|\| soil\.surfaceType \|\| turf\.subCategory/);
    });

    test('an unresolvable surface is reported, not quietly printed as kg/ha', () => {
        const at = single.indexOf('function _rateDisplayOptions');
        const body = single.slice(at, at + 2000);
        expect(body).toMatch(/console\.error\('\[WordExport\] GH-409: no surface type/);
    });

    test('both export paths carry the programme\'s own meta, and nothing about the region', () => {
        expect(combined).toMatch(/meta: perSampleProgram\.meta \|\| \{\}/);
        expect(single).toMatch(/data\.nutritionProgram\.meta = prog\.meta \|\| \{\}/);
        // The unit is a property of the surface. Nothing anywhere may reach for
        // the recommender, the region or the integration to decide it.
        [single, combined].forEach((src) => {
            expect(src).not.toMatch(/solubleUnit/);
            expect(src).not.toMatch(/_rateConvention/);
        });
    });

    test('all four renderers ask the shared helper — there is one copy of the rule', () => {
        const panels = ['nutrition-prebble-integration.js', 'nutrition-au-fertiliser-integration.js',
                        'nutrition-uk-fertiliser-integration.js'];
        panels.forEach((name) => {
            const src = readAsset(name);
            expect(src).toMatch(/GAIP_NutritionDelivery/);
            expect(src).toMatch(/usesGM2\(meta\.surfaceType, meta\.useGM2\)/);
            expect(src).toMatch(/productRate\(/);
            // The soluble exception that made one row print in a foreign unit.
            expect(src).not.toMatch(/useGM2 && !isSoluble/);
        });
    });
});
