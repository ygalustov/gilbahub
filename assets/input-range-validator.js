/**
 * =============================================================================
 * GILBA INPUT RANGE VALIDATOR v1.0.0
 * =============================================================================
 * 
 * Validates input values against expected agronomic ranges.
 * Flags implausible values WITHOUT blocking - advisory warnings only.
 * 
 * Purpose: Catch garbage-in scenarios before they produce plausible-looking
 * but incorrect outputs.
 * 
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION = '1.1.1';

    // Format a number for display — strips floating-point noise (e.g. 0.49699999999999994 → 0.497)
    function formatNum(n) {
        if (n === null || n === undefined || isNaN(n)) return n;
        // Use toPrecision(4) to cap significant figures, then parseFloat to remove trailing zeros
        return parseFloat(n.toPrecision(4));
    }

    /**
     * Expected ranges for soil test values (ppm unless noted)
     * Based on typical agronomic soil test ranges from commercial labs
     * Values outside these ranges are flagged as "verify this value"
     */
    const SOIL_RANGES = {
        // Macronutrients
        P: { min: 1, max: 200, typical: [10, 80], unit: 'ppm', name: 'Phosphorus' },
        K: { min: 10, max: 800, typical: [50, 300], unit: 'ppm', name: 'Potassium' },
        Ca: { min: 100, max: 10000, typical: [500, 3000], unit: 'ppm', name: 'Calcium' },
        Mg: { min: 20, max: 2000, typical: [50, 500], unit: 'ppm', name: 'Magnesium' },
        S: { min: 1, max: 200, typical: [5, 50], unit: 'ppm', name: 'Sulphur' },
        
        // Micronutrients
        Fe: { min: 1, max: 500, typical: [20, 200], unit: 'ppm', name: 'Iron' },
        Mn: { min: 1, max: 200, typical: [5, 100], unit: 'ppm', name: 'Manganese' },
        Zn: { min: 0.1, max: 50, typical: [1, 20], unit: 'ppm', name: 'Zinc' },
        Cu: { min: 0.1, max: 20, typical: [0.5, 5], unit: 'ppm', name: 'Copper' },
        B: { min: 0.1, max: 10, typical: [0.5, 3], unit: 'ppm', name: 'Boron' },
        
        // Sodium and salinity
        Na: { min: 0, max: 2000, typical: [0, 200], unit: 'ppm', name: 'Sodium', highWarning: 'High Na can indicate salinity issues' },
        
        // pH and EC
        pH_water: { min: 3.5, max: 10, typical: [5.5, 7.5], unit: '', name: 'Soil pH (water)' },
        pH_CaCl2: { min: 3.0, max: 9.5, typical: [5.0, 7.0], unit: '', name: 'Soil pH (CaCl₂)' },
        EC1_5: { min: 0, max: 10, typical: [0.1, 2], unit: 'dS/m', name: 'EC (1:5)' },
        ECe: { min: 0, max: 30, typical: [0.5, 4], unit: 'dS/m', name: 'ECe (sat. extract)' },
        
        // Physical
        CEC: { min: 1, max: 60, typical: [5, 25], unit: 'meq/100g', name: 'CEC' },
        ite: { min: 0, max: 100, typical: [0, 20], unit: '%', name: 'Loss on Ignition' },
        clay: { min: 0, max: 100, typical: [5, 40], unit: '%', name: 'Clay content' },
        sand: { min: 0, max: 100, typical: [40, 95], unit: '%', name: 'Sand content' },
        
        // Depth and density
        depthCm: { min: 1, max: 30, typical: [5, 15], unit: 'cm', name: 'Sample depth' },
        bulkDensity: { min: 0.8, max: 2.0, typical: [1.2, 1.6], unit: 'g/cm³', name: 'Bulk density' }
    };

    /**
     * Expected ranges for water quality values
     */
    const WATER_RANGES = {
        // Core parameters
        ECw: { min: 0, max: 15, typical: [0.2, 3], unit: 'dS/m', name: 'Water EC' },
        pH: { min: 4, max: 10, typical: [6.5, 8.5], unit: '', name: 'Water pH' },
        
        // Cations (mg/L)
        Ca: { min: 0, max: 500, typical: [20, 150], unit: 'mg/L', name: 'Calcium' },
        Mg: { min: 0, max: 300, typical: [5, 80], unit: 'mg/L', name: 'Magnesium' },
        Na: { min: 0, max: 2000, typical: [10, 300], unit: 'mg/L', name: 'Sodium', highWarning: 'High Na increases SAR' },
        K: { min: 0, max: 100, typical: [1, 20], unit: 'mg/L', name: 'Potassium' },
        
        // Anions (mg/L)
        Cl: { min: 0, max: 2000, typical: [10, 300], unit: 'mg/L', name: 'Chloride', highWarning: 'High Cl may cause leaf burn' },
        HCO3: { min: 0, max: 1000, typical: [50, 400], unit: 'mg/L', name: 'Bicarbonate' },
        CO3: { min: 0, max: 100, typical: [0, 20], unit: 'mg/L', name: 'Carbonate' },
        SO4: { min: 0, max: 1000, typical: [10, 300], unit: 'mg/L', name: 'Sulfate' },
        
        // Toxicity concerns
        B: { min: 0, max: 10, typical: [0, 1], unit: 'mg/L', name: 'Boron', highWarning: 'B > 1 mg/L can cause toxicity' },
        
        // Calculated
        SAR: { min: 0, max: 50, typical: [0, 10], unit: '', name: 'SAR' },
        adjSAR: { min: 0, max: 60, typical: [0, 15], unit: '', name: 'Adjusted SAR' }
    };

    /**
     * Expected ranges for tissue test values (% or ppm)
     */
    const TISSUE_RANGES = {
        // Macros (%)
        N: { min: 0.5, max: 8, typical: [2.5, 5], unit: '%', name: 'Nitrogen' },
        P: { min: 0.1, max: 1.5, typical: [0.2, 0.6], unit: '%', name: 'Phosphorus' },
        K: { min: 0.5, max: 6, typical: [1.5, 3.5], unit: '%', name: 'Potassium' },
        Ca: { min: 0.1, max: 2, typical: [0.3, 1], unit: '%', name: 'Calcium' },
        Mg: { min: 0.05, max: 1, typical: [0.15, 0.5], unit: '%', name: 'Magnesium' },
        S: { min: 0.1, max: 1, typical: [0.2, 0.5], unit: '%', name: 'Sulphur' },
        
        // Micros (ppm)
        Fe: { min: 20, max: 1000, typical: [50, 300], unit: 'ppm', name: 'Iron' },
        Mn: { min: 10, max: 500, typical: [25, 200], unit: 'ppm', name: 'Manganese' },
        Zn: { min: 10, max: 200, typical: [20, 80], unit: 'ppm', name: 'Zinc' },
        Cu: { min: 1, max: 50, typical: [5, 20], unit: 'ppm', name: 'Copper' },
        B: { min: 1, max: 100, typical: [5, 40], unit: 'ppm', name: 'Boron' },
        Mo: { min: 0.1, max: 10, typical: [0.5, 3], unit: 'ppm', name: 'Molybdenum' },
        
        // Na is concerning in tissue
        Na: { min: 0, max: 20000, typical: [100, 3000], unit: 'ppm', name: 'Sodium', highWarning: 'High tissue Na indicates uptake issues' }
    };

    /**
     * Validate a single value against its expected range
     * @param {number} value - The value to check
     * @param {object} range - Range definition from constants above
     * @param {string} key - The parameter key (for logging)
     * @returns {object} { valid: boolean, level: 'ok'|'unusual'|'implausible', message: string|null }
     */
    function validateValue(value, range, key) {
        if (value === null || value === undefined || value === '') {
            return { valid: true, level: 'missing', message: null };
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            return { 
                valid: false, 
                level: 'invalid', 
                message: `${range.name}: "${value}" is not a valid number`
            };
        }

        // Check absolute bounds (implausible)
        if (num < range.min) {
            return {
                valid: false,
                level: 'implausible',
                message: `${range.name} (${formatNum(num)}${range.unit ? ' ' + range.unit : ''}) is below minimum expected (${range.min}${range.unit ? ' ' + range.unit : ''}), verify this value`
            };
        }
        if (num > range.max) {
            return {
                valid: false,
                level: 'implausible',
                message: `${range.name} (${formatNum(num)}${range.unit ? ' ' + range.unit : ''}) exceeds maximum expected (${range.max}${range.unit ? ' ' + range.unit : ''}), verify this value`
            };
        }

        // Check typical range (unusual but possible)
        const [typLo, typHi] = range.typical;
        if (num < typLo || num > typHi) {
            let msg = `${range.name} (${formatNum(num)}${range.unit ? ' ' + range.unit : ''}) is outside typical range (${typLo}–${typHi}${range.unit ? ' ' + range.unit : ''})`;
            if (num > typHi && range.highWarning) {
                msg += `, ${range.highWarning}`;
            }
            return {
                valid: true,  // Valid but unusual
                level: 'unusual',
                message: msg
            };
        }

        return { valid: true, level: 'ok', message: null };
    }

    /**
     * Validate soil data object
     * @param {object} soil - Soil data with ppm values
     * @returns {object} { valid: boolean, warnings: [], errors: [] }
     */
    function validateSoil(soil) {
        if (!soil) return { valid: true, warnings: [], errors: [] };

        const warnings = [];
        const errors = [];

        // Check ppm values (may be nested under soil.ppm or flat)
        const ppm = soil.ppm || soil;

        // Skip validation if no soil data was actually entered (all zeros/empty = empty form)
        // Only check lab-result keys, not structural defaults (depthCm, bulkDensity are always populated)
        const labKeys = ['P','K','Ca','Mg','S','Fe','Mn','Zn','Cu','B','Na','pH_water','CEC'];
        const hasAnyData = labKeys.some(k => {
            const v = ppm[k] !== undefined ? ppm[k] : soil[k];
            return v !== undefined && v !== null && v !== '' && v !== 0 && !isNaN(v);
        });
        if (!hasAnyData) return { valid: true, warnings: [], errors: [] };

        Object.keys(SOIL_RANGES).forEach(key => {
            const value = ppm[key] !== undefined ? ppm[key] : soil[key];
            if (value !== undefined && value !== null && value !== '') {
                const result = validateValue(value, SOIL_RANGES[key], key);
                if (result.level === 'implausible' || result.level === 'invalid') {
                    errors.push(result.message);
                } else if (result.level === 'unusual') {
                    warnings.push(result.message);
                }
            }
        });

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Validate water data object
     * @param {object} water - Water quality data
     * @returns {object} { valid: boolean, warnings: [], errors: [] }
     */
    function validateWater(water) {
        if (!water) return { valid: true, warnings: [], errors: [] };

        const warnings = [];
        const errors = [];

        // Check ions (may be nested under water.ions or flat)
        const ions = water.ions || water;

        // Skip validation if no water data was actually entered (all zeros/empty = empty form)
        // Only check ion lab-result keys, not calculated fields
        const labKeys = ['Ca','Mg','Na','K','Cl','HCO3','CO3','SO4','B'];
        const hasAnyData = labKeys.some(k => {
            const v = ions[k] !== undefined ? ions[k] : water[k];
            return v !== undefined && v !== null && v !== '' && v !== 0 && !isNaN(v);
        });
        if (!hasAnyData) return { valid: true, warnings: [], errors: [] };

        Object.keys(WATER_RANGES).forEach(key => {
            const value = ions[key] !== undefined ? ions[key] : water[key];
            if (value !== undefined && value !== null && value !== '') {
                const result = validateValue(value, WATER_RANGES[key], key);
                if (result.level === 'implausible' || result.level === 'invalid') {
                    errors.push(result.message);
                } else if (result.level === 'unusual') {
                    warnings.push(result.message);
                }
            }
        });

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Validate tissue data object
     * @param {object} tissue - Tissue analysis data
     * @returns {object} { valid: boolean, warnings: [], errors: [] }
     */
    function validateTissue(tissue) {
        if (!tissue) return { valid: true, warnings: [], errors: [] };

        const warnings = [];
        const errors = [];

        // Handle various tissue data structures
        const values = tissue.normalized || tissue.values || tissue;

        // Skip validation if no tissue data was actually entered (all zeros/empty = empty form)
        const tissueKeys = Object.keys(TISSUE_RANGES);
        const hasAnyData = tissueKeys.some(k => {
            const v = values[k];
            return v !== undefined && v !== null && v !== '' && v !== 0 && !isNaN(v);
        });
        if (!hasAnyData) return { valid: true, warnings: [], errors: [] };

        Object.keys(TISSUE_RANGES).forEach(key => {
            const value = values[key];
            if (value !== undefined && value !== null && value !== '') {
                const result = validateValue(value, TISSUE_RANGES[key], key);
                if (result.level === 'implausible' || result.level === 'invalid') {
                    errors.push(result.message);
                } else if (result.level === 'unusual') {
                    warnings.push(result.message);
                }
            }
        });

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Validate full hub state
     * @param {object} state - GAIP_STATE or similar
     * @returns {object} { valid: boolean, soil: {...}, water: {...}, tissue: {...}, summary: {...} }
     */
    function validateState(state) {
        if (!state) {
            return {
                valid: true,
                soil: { valid: true, warnings: [], errors: [] },
                water: { valid: true, warnings: [], errors: [] },
                tissue: { valid: true, warnings: [], errors: [] },
                summary: { totalWarnings: 0, totalErrors: 0 }
            };
        }

        const soil = validateSoil(state.soil);
        const water = validateWater(state.water);
        const tissue = validateTissue(state.tissue);

        const totalWarnings = soil.warnings.length + water.warnings.length + tissue.warnings.length;
        const totalErrors = soil.errors.length + water.errors.length + tissue.errors.length;

        return {
            valid: totalErrors === 0,
            soil,
            water,
            tissue,
            summary: {
                totalWarnings,
                totalErrors,
                hasIssues: totalWarnings > 0 || totalErrors > 0
            }
        };
    }

    /**
     * Render validation warnings as HTML banner
     * @param {object} validation - Result from validateState()
     * @returns {string} HTML string
     */
    function renderValidationBanner(validation) {
        if (!validation.summary.hasIssues) {
            return '';
        }

        const allErrors = [
            ...validation.soil.errors,
            ...validation.water.errors,
            ...validation.tissue.errors
        ];
        const allWarnings = [
            ...validation.soil.warnings,
            ...validation.water.warnings,
            ...validation.tissue.warnings
        ];

        let html = '<div class="gaip-validation-banner" style="';
        html += 'margin: 12px 0; padding: 12px 16px; border-radius: 8px; ';
        
        if (allErrors.length > 0) {
            html += 'background: linear-gradient(135deg, var(--gaip-critical-bg) 0%, var(--gaip-critical-bg) 100%); ';
            html += 'border: 1px solid #fca5a5; border-left: 4px solid #dc2626;';
        } else {
            html += 'background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-bg) 100%); ';
            html += 'border: 1px solid var(--gaip-warning-border); border-left: 4px solid #f59e0b;';
        }
        html += '">';

        // Header
        const icon = allErrors.length > 0 ? '⚠️' : '⚡';
        const title = allErrors.length > 0 ? 'Input Data Issues Detected' : 'Unusual Values Detected';
        html += `<div style="font-weight: 600; color: ${allErrors.length > 0 ? '#991b1b' : '#92400e'}; margin-bottom: 8px; font-size: 14px;">`;
        html += `${icon} ${title}</div>`;

        // Errors first
        if (allErrors.length > 0) {
            html += '<div style="margin-bottom: 8px;">';
            allErrors.forEach(err => {
                html += `<div style="color: #dc2626; font-size: 13px; margin: 4px 0; padding-left: 20px;">`;
                html += `🔴 ${err}</div>`;
            });
            html += '</div>';
        }

        // Then warnings
        if (allWarnings.length > 0) {
            html += '<div>';
            allWarnings.slice(0, 5).forEach(warn => {  // Limit to 5 warnings
                html += `<div style="color: #92400e; font-size: 13px; margin: 4px 0; padding-left: 20px;">`;
                html += `🟡 ${warn}</div>`;
            });
            if (allWarnings.length > 5) {
                html += `<div style="color: var(--gaip-text); font-size: 12px; margin-top: 4px; padding-left: 20px;">`;
                html += `...and ${allWarnings.length - 5} more unusual values</div>`;
            }
            html += '</div>';
        }

        // Footer
        html += '<div style="margin-top: 8px; font-size: 12px; color: var(--gaip-text);">';
        html += 'Please verify these values before relying on recommendations.</div>';

        html += '</div>';
        return html;
    }

    /**
     * Hook into analysis complete event to show validation
     */
    function init() {
        // Listen for analysis complete
        document.addEventListener('gaip:analysis-complete', function(e) {
            const state = e.detail?.state || global.GAIP_STATE;
            if (!state) return;

            const validation = validateState(state);
            
            // Store for export/audit
            global.GAIP_INPUT_VALIDATION = validation;

            // Log summary
            if (validation.summary.hasIssues) {
                if (validation.summary.totalErrors > 0) {
                    console.warn('[InputValidator] Errors:', [
                        ...validation.soil.errors,
                        ...validation.water.errors,
                        ...validation.tissue.errors
                    ]);
                }
            }

            // Inject banner if issues found, remove if clean
            if (validation.summary.hasIssues) {
                const banner = renderValidationBanner(validation);
                const resultsSection = document.querySelector('.gaip-results');
                if (resultsSection) {
                    // Check if banner already exists
                    const existing = resultsSection.querySelector('.gaip-validation-banner');
                    if (existing) {
                        existing.outerHTML = banner;
                    } else {
                        // Insert at top of results
                        resultsSection.insertAdjacentHTML('afterbegin', banner);
                    }
                }
            } else {
                // No issues — remove any stale banner from previous run
                const resultsSection = document.querySelector('.gaip-results');
                if (resultsSection) {
                    const existing = resultsSection.querySelector('.gaip-validation-banner');
                    if (existing) {
                        existing.remove();
                    }
                }
            }
        });

    }

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export API
    global.GilbaInputValidator = {
        version: VERSION,
        validateSoil,
        validateWater,
        validateTissue,
        validateState,
        renderValidationBanner,
        SOIL_RANGES,
        WATER_RANGES,
        TISSUE_RANGES
    };

})(typeof window !== 'undefined' ? window : this);
