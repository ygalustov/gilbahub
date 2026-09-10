/**
 * Test nitrate product Word export fix (b35fix379)
 *
 * Bug: Nitrate fertiliser products (SOL-KNO3, SOL-CANO3, SOL-MGNO3) appear in
 * web interface but not in Word exports.
 *
 * Root cause: nutrition-au-fertiliser-integration.js only accumulated N, P, K
 * in totalDelivered for liquid products, missing Ca, Mg, S.
 *
 * GH-399 — the four source pins below used to read the accumulator loop inside
 * nutrition-au-fertiliser-integration.js literally (`totalDelivered.Ca +=
 * p.delivers.Ca || 0`). That loop no longer exists: it was one of five
 * hand-maintained copies of the same accumulation and moved to the shared
 * assets/nutrition-delivery-core.js. The pins move with it and are now
 * BEHAVIOURAL rather than textual — they run the module on a calcium-nitrate
 * and a magnesium-nitrate application and assert the secondary macros come out,
 * which is what b35fix379 was actually protecting. A regex over a loop that has
 * been deleted can only ever fail; a regex over its replacement would break
 * again at the next refactor.
 */

const fs = require('fs');
const path = require('path');
const delivery = require('../assets/nutrition-delivery-core.js');

describe('Nitrate Products Word Export', () => {
    let nutritionIntegrationCode;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js');
        nutritionIntegrationCode = fs.readFileSync(filePath, 'utf8');
    });

    test('liquid products should accumulate Ca, Mg, S in totalDelivered structure', () => {
        // SOL-CANO3 (Calcium Nitrate, 15.5-0-0 with 19% Ca) and SOL-MGNO3
        // (Magnesium Nitrate, 11-0-0 with 9.5% Mg) as the AU recommender emits
        // them: `delivers` carries N/P/K only, so Ca/Mg/S must come from the
        // analysis — the very gap b35fix379 closed.
        const acc = delivery.accumulate([{
            month: 'January',
            granular: [],
            liquid: [
                { id: 'SOL-CANO3', name: 'Calcium Nitrate', form: 'soluble', rateLHa: 20,
                  analysis: { N: 15.5, Ca: 19 }, delivers: { N: 3.1, P: 0, K: 0 } },
                { id: 'SOL-MGNO3', name: 'Magnesium Nitrate', form: 'soluble', rateLHa: 10,
                  analysis: { N: 11, Mg: 9.5, S: 2 }, delivers: { N: 1.1, P: 0, K: 0 } }
            ]
        }]);
        expect(acc.products['SOL-CANO3'].totalDelivered.Ca).toBeCloseTo(3.8, 6);
        expect(acc.products['SOL-MGNO3'].totalDelivered.Mg).toBeCloseTo(0.95, 6);
        expect(acc.products['SOL-MGNO3'].totalDelivered.S).toBeCloseTo(0.2, 6);
        // And the declared N is used as declared, not re-derived.
        expect(acc.products['SOL-CANO3'].totalDelivered.N).toBe(3.1);
    });

    test('granular products should accumulate Ca, Mg, S for consistency', () => {
        const acc = delivery.accumulate([{
            month: 'January',
            granular: [
                { id: 'GRAN-GYP', name: 'Gypsum blend', rateKgHa: 200,
                  analysis: { N: 5, Ca: 12, S: 8, Mg: 1.5 }, delivers: { N: 10, P: 0, K: 0 } }
            ],
            liquid: []
        }]);
        const d = acc.products['GRAN-GYP'].totalDelivered;
        expect(d.Ca).toBeCloseTo(24, 6);
        expect(d.S).toBeCloseTo(16, 6);
        expect(d.Mg).toBeCloseTo(3, 6);
    });

    test('should handle null/undefined delivers values safely', () => {
        const acc = delivery.accumulate([{
            month: 'January',
            granular: [{ id: 'X', name: 'No delivers at all', rateKgHa: 100, analysis: { N: 10, Ca: 2 } }],
            liquid: [{ id: 'Y', name: 'Null delivers', rateLHa: 10, analysis: { N: 20 }, delivers: null }]
        }]);
        expect(acc.products.X.totalDelivered).toEqual({ N: 10, P: 0, K: 0, Ca: 2, Mg: 0, S: 0 });
        expect(acc.products.Y.totalDelivered.N).toBeCloseTo(2, 6);
        Object.keys(acc.totals).forEach((k) => expect(Number.isNaN(acc.totals[k])).toBe(false));
    });

    test('should include b35fix379 comment explaining the change', () => {
        // The reason the secondary macros are accumulated at all still has to be
        // written down somewhere a reader will find it — now at the call site
        // that replaced the loop.
        expect(nutritionIntegrationCode).toMatch(/b35fix379[\s\S]{0,200}Ca\/Mg\/S/);
        const moduleCode = fs.readFileSync(
            path.join(__dirname, '../assets/nutrition-delivery-core.js'), 'utf8');
        expect(moduleCode).toMatch(/mass \* _num\(analysis\[n\]\) \/ 100/);
    });
});

describe('Nitrate Product Database Integration', () => {
    let auFertiliserProducts;
    
    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/au-fertiliser-products.js');
        const productsCode = fs.readFileSync(filePath, 'utf8');

        // Default to raw-content checks; the AU file uses a non-standard export
        // shape that the eval path below doesn't recognise, but raw-content
        // regex matches are sufficient for these assertions.
        auFertiliserProducts = { _rawContent: productsCode };

        // Optional: try to eval the products array if the shape matches.
        const match = productsCode.match(/products:\s*\[([\s\S]*)\]/);
        if (match) {
            const productsString = `[${match[1]}]`;
            try {
                auFertiliserProducts = eval(`(${productsString})`);
            } catch (e) {
                // Keep _rawContent fallback already assigned.
            }
        }
    });

    test('SOL-KNO3 should be present with correct analysis (b35fix380: elemental K)', () => {
        // b35fix380: K converted from oxide (44) to elemental (38.67),
        // N adjusted to 13.85 to match KNO3 stoichiometry and UK audit row 395.
        if (auFertiliserProducts._rawContent) {
            expect(auFertiliserProducts._rawContent).toMatch(/SOL-KNO3.*Potassium Nitrate/);
            expect(auFertiliserProducts._rawContent).toMatch(/N:\s*13\.85.*K:\s*38\.67/);
        } else {
            const kno3 = auFertiliserProducts.find(p => p.id === 'SOL-KNO3');
            expect(kno3).toBeDefined();
            expect(kno3.name).toMatch(/Potassium Nitrate/);
            expect(kno3.analysis.N).toBe(13.85);
            expect(kno3.analysis.K).toBe(38.67);
        }
    });

    test('SOL-CANO3 should be present with correct analysis', () => {
        if (auFertiliserProducts._rawContent) {
            expect(auFertiliserProducts._rawContent).toMatch(/SOL-CANO3.*Calcium Nitrate/);
            expect(auFertiliserProducts._rawContent).toMatch(/N:\s*15\.5.*Ca:\s*19/);
        } else {
            const cano3 = auFertiliserProducts.find(p => p.id === 'SOL-CANO3');
            expect(cano3).toBeDefined();
            expect(cano3.name).toMatch(/Calcium Nitrate/);
            expect(cano3.analysis.N).toBe(15.5);
            expect(cano3.analysis.Ca).toBe(19);
        }
    });

    test('SOL-MGNO3 should be present with correct analysis', () => {
        if (auFertiliserProducts._rawContent) {
            expect(auFertiliserProducts._rawContent).toMatch(/SOL-MGNO3.*Magnesium Nitrate/);
            expect(auFertiliserProducts._rawContent).toMatch(/N:\s*11.*Mg:\s*9\.5/);
        } else {
            const mgno3 = auFertiliserProducts.find(p => p.id === 'SOL-MGNO3');
            expect(mgno3).toBeDefined();
            expect(mgno3.name).toMatch(/Magnesium Nitrate/);
            expect(mgno3.analysis.N).toBe(11);
            expect(mgno3.analysis.Mg).toBe(9.5);
        }
    });

    test('all nitrate products should be form: soluble', () => {
        if (auFertiliserProducts._rawContent) {
            // Anchor on `id: 'SOL-...NO3'` so the regex doesn't match bare
            // mentions of SOL-KNO3 in the changelog comment block at the top
            // of the file (which would then match the next `form:` line many
            // products later — see b35fix380 audit-reconciliation header).
            const nitrateMatches = auFertiliserProducts._rawContent.match(
                /id:\s*['"]SOL-[A-Z]+NO3['"][\s\S]*?form:\s*['"](.*?)['"]/g
            );
            expect(nitrateMatches).toBeTruthy();
            nitrateMatches.forEach(match => {
                expect(match).toMatch(/form:\s*['"]soluble['"]/);
            });
        } else {
            const nitrateProducts = auFertiliserProducts.filter(p =>
                /^SOL-[A-Z]+NO3$/.test(p.id)
            );
            expect(nitrateProducts.length).toBeGreaterThan(0);
            nitrateProducts.forEach(p => {
                expect(p.form).toBe('soluble');
            });
        }
    });
});
