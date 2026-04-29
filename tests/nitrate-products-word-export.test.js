/**
 * Test nitrate product Word export fix (b35fix379)
 * 
 * Bug: Nitrate fertiliser products (SOL-KNO3, SOL-CANO3, SOL-MGNO3) appear in 
 * web interface but not in Word exports.
 * 
 * Root cause: nutrition-au-fertiliser-integration.js only accumulated N, P, K 
 * in totalDelivered for liquid products, missing Ca, Mg, S.
 */

const fs = require('fs');
const path = require('path');

describe('Nitrate Products Word Export', () => {
    let nutritionIntegrationCode;
    
    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js');
        nutritionIntegrationCode = fs.readFileSync(filePath, 'utf8');
    });

    test('liquid products should accumulate Ca, Mg, S in totalDelivered structure', () => {
        // Check that liquid processing includes Ca, Mg, S
        expect(nutritionIntegrationCode).toMatch(/totalDelivered:\s*\{\s*N:\s*0,\s*P:\s*0,\s*K:\s*0,\s*Ca:\s*0,\s*Mg:\s*0,\s*S:\s*0\s*\}/);
        expect(nutritionIntegrationCode).toMatch(/totalDelivered\.Ca\s*\+=\s*p\.delivers\.Ca/);
        expect(nutritionIntegrationCode).toMatch(/totalDelivered\.Mg\s*\+=\s*p\.delivers\.Mg/);
        expect(nutritionIntegrationCode).toMatch(/totalDelivered\.S\s*\+=\s*p\.delivers\.S/);
    });

    test('granular products should accumulate Ca, Mg, S for consistency', () => {
        // Check that granular processing includes Ca, Mg, S
        const granularSections = nutritionIntegrationCode.match(/m\.granular\.forEach[\s\S]*?}\);/g);
        expect(granularSections).toBeTruthy();
        expect(granularSections[0]).toMatch(/totalDelivered:\s*\{\s*N:\s*0,\s*P:\s*0,\s*K:\s*0,\s*Ca:\s*0,\s*Mg:\s*0,\s*S:\s*0\s*\}/);
        expect(granularSections[0]).toMatch(/totalDelivered\.Ca\s*\+=\s*p\.delivers\.Ca/);
        expect(granularSections[0]).toMatch(/totalDelivered\.Mg\s*\+=\s*p\.delivers\.Mg/);
        expect(granularSections[0]).toMatch(/totalDelivered\.S\s*\+=\s*p\.delivers\.S/);
    });

    test('should handle null/undefined delivers values safely', () => {
        // Check for || 0 defensive programming
        expect(nutritionIntegrationCode).toMatch(/p\.delivers\.Ca\s*\|\|\s*0/);
        expect(nutritionIntegrationCode).toMatch(/p\.delivers\.Mg\s*\|\|\s*0/);
        expect(nutritionIntegrationCode).toMatch(/p\.delivers\.S\s*\|\|\s*0/);
    });

    test('should include b35fix379 comment explaining the change', () => {
        expect(nutritionIntegrationCode).toMatch(/b35fix379.*nitrate.*SOL-CANO3.*SOL-MGNO3/i);
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
