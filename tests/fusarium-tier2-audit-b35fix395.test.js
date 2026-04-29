/**
 * Fusarium Tier 2 Audit Verification - b35fix395
 * Tests provenance corrections and citation updates after tier 2 audit
 * Validates temperature thresholds, nitrogen relationships, and citation format
 */

// Mock DOM environment for Node.js testing
global.window = global.window || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {} };
global.console = global.console || { group: () => {}, log: () => {}, groupEnd: () => {} };

// Load disease engine
const fs = require('fs');
const path = require('path');
const diseaseEngineCode = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
eval(diseaseEngineCode);

describe('Fusarium Tier 2 Audit (b35fix395)', () => {
    test('Citation format corrected to academic standard', () => {
        // Test all return paths have updated citation
        const mockClimate = {
            temperature: { mean: 10, min: 5, max: 15 },
            moisture: { humidity: { mean: 85 } },
            precipitation: { total: 8 }
        };
        
        const result = FusariumModel.calculate(mockClimate, { status: 'adequate' }, {});
        expect(result.source).toBe('Smith, Jackson & Woolhouse 1989');
        
        // Test no-temperature fallback
        const noTempResult = FusariumModel.calculate({}, { status: 'adequate' }, {});
        expect(noTempResult.source).toBe('Smith, Jackson & Woolhouse 1989');
        
        // Test too-warm fallback
        const warmClimate = { temperature: { mean: 25 } };
        const warmResult = FusariumModel.calculate(warmClimate, { status: 'adequate' }, {});
        expect(warmResult.source).toBe('Smith, Jackson & Woolhouse 1989');
    });
    
    test('Temperature thresholds remain scientifically verified', () => {
        const baseClimate = {
            moisture: { humidity: { mean: 90 } },
            precipitation: { total: 10 }
        };
        
        // Optimal range: 0-12°C should show highest risk
        const optimalResult = FusariumModel.calculate({
            ...baseClimate,
            temperature: { mean: 6, min: 3, max: 9 }
        }, { status: 'adequate' }, {});
        
        // Too warm: >18°C should return 0 risk
        const warmResult = FusariumModel.calculate({
            ...baseClimate,
            temperature: { mean: 20 }
        }, { status: 'adequate' }, {});
        
        // Too cold: below active range
        const coldResult = FusariumModel.calculate({
            ...baseClimate,
            temperature: { mean: -5, min: -8, max: -2 }
        }, { status: 'adequate' }, {});
        
        expect(optimalResult.riskScore).toBeGreaterThan(0);
        expect(warmResult.riskScore).toBe(0);
        expect(warmResult.drivers.temperature.note).toContain('Too warm for Fusarium development');
        expect(coldResult.riskScore).toBe(0); // Below active range
    });
    
    test('Nitrogen modifiers align with literature', () => {
        const baseClimate = {
            temperature: { mean: 8, min: 5, max: 11 },
            moisture: { humidity: { mean: 85 } },
            precipitation: { total: 5 }
        };
        
        // Test base N modifiers
        const deficientResult = FusariumModel.calculate(baseClimate, { status: 'deficient' }, {});
        const adequateResult = FusariumModel.calculate(baseClimate, { status: 'adequate' }, {});
        const highResult = FusariumModel.calculate(baseClimate, { status: 'high' }, {});
        const excessiveResult = FusariumModel.calculate(baseClimate, { status: 'excessive' }, {});
        
        expect(deficientResult.riskScore).toBeLessThan(adequateResult.riskScore);
        expect(highResult.riskScore).toBeGreaterThan(adequateResult.riskScore);
        expect(excessiveResult.riskScore).toBeGreaterThan(highResult.riskScore);
        
        // Test winter amplification (temp ≤ 15°C)
        expect(highResult.drivers.nitrogen.winterRisk).toBe(true);
        expect(highResult.drivers.nitrogen.modifier).toBeGreaterThan(1.3); // Should include winter amplification
        expect(excessiveResult.drivers.nitrogen.modifier).toBeGreaterThan(highResult.drivers.nitrogen.modifier);
    });
    
    test('Freeze-thaw cycles correctly identified and weighted', () => {
        const baseClimate = {
            temperature: { mean: 2 },
            moisture: { humidity: { mean: 90 } }
        };
        
        // Freeze-thaw cycle: min < -1°C, max > 2°C
        const freezeThawClimate = {
            ...baseClimate,
            temperature: { mean: 2, min: -2, max: 6 }
        };
        
        // No freeze-thaw
        const noFreezeClimate = {
            ...baseClimate,
            temperature: { mean: 5, min: 3, max: 7 }
        };
        
        const freezeResult = FusariumModel.calculate(freezeThawClimate, { status: 'adequate' }, {});
        const normalResult = FusariumModel.calculate(noFreezeClimate, { status: 'adequate' }, {});
        
        expect(freezeResult.drivers.freezeThaw.active).toBe(true);
        expect(freezeResult.drivers.freezeThaw.contribution).toBeGreaterThan(0);
        expect(normalResult.drivers.freezeThaw.active).toBe(false);
        expect(normalResult.drivers.freezeThaw.contribution).toBe(0);
        
        // Severe freeze-thaw should have higher contribution
        const severeClimate = {
            ...baseClimate,
            temperature: { mean: 3, min: -4, max: 10 }
        };
        const severeResult = FusariumModel.calculate(severeClimate, { status: 'adequate' }, {});
        
        expect(severeResult.drivers.freezeThaw.severity).toBe('severe');
        expect(severeResult.drivers.freezeThaw.contribution).toBe(100); // Should be 1.0 factor = 100 contribution
    });
    
    test('Humidity handling with null fallback works correctly', () => {
        const baseClimate = {
            temperature: { mean: 8, min: 5, max: 11 },
            precipitation: { total: 20 } // High precip should compensate for missing humidity
        };
        
        // No humidity data - should fall back to precip-only
        const noHumidityResult = FusariumModel.calculate(baseClimate, { status: 'adequate' }, {});
        
        // With humidity data
        const withHumidityResult = FusariumModel.calculate({
            ...baseClimate,
            moisture: { humidity: { mean: 95 } }
        }, { status: 'adequate' }, {});
        
        expect(noHumidityResult.drivers.moisture.humidity).toBe(null);
        expect(noHumidityResult.drivers.moisture.humiditySource).toBe('no data');
        expect(noHumidityResult.riskScore).toBeGreaterThan(0); // High precip should still drive risk
        
        expect(withHumidityResult.drivers.moisture.humidity).toBe(95);
        expect(withHumidityResult.drivers.moisture.humiditySource).toBe('period mean');
    });
    
    test('Unverified parameters flagged with provenance comments', () => {
        // This test verifies the source code contains appropriate provenance comments
        // for parameters identified as unverified in the audit
        
        const sourceCode = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
        
        // Check for diurnal range provenance comments
        expect(sourceCode).toContain('PROVENANCE NOTE: Specific diurnal range thresholds');
        expect(sourceCode).toContain('UNVERIFIED threshold');
        
        // Check for snow duration provenance comments
        expect(sourceCode).toContain('PROVENANCE NOTE: Specific day thresholds (7, 14) lack direct peer-reviewed citation');
        
        // Verify citations are corrected
        expect(sourceCode).not.toContain('Smiley, Vargas, Smith et al. 1989');
        expect(sourceCode).toContain('Smith, Jackson & Woolhouse 1989');
    });
    
    test('Model maintains backward compatibility', () => {
        // Test that audit changes don't break existing functionality
        const testClimate = {
            temperature: { mean: 10, min: 5, max: 15 },
            moisture: { humidity: { mean: 85 } },
            precipitation: { total: 8 }
        };
        
        const result = FusariumModel.calculate(testClimate, { status: 'high' }, { variety: 'bentgrass' });
        
        // Should return all expected fields
        expect(result).toHaveProperty('disease', 'fusarium');
        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('riskLevel');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('drivers');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('primaryDriver');
        
        // Drivers should contain all expected components
        expect(result.drivers).toHaveProperty('temperature');
        expect(result.drivers).toHaveProperty('moisture');
        expect(result.drivers).toHaveProperty('nitrogen');
        expect(result.drivers).toHaveProperty('freezeThaw');
        
        expect(typeof result.riskScore).toBe('number');
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
    });
});
