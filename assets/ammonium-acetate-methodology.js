/**
 * AMMONIUM ACETATE METHODOLOGY v1.0.0
 * Hill Labs (NZ) extractant method support for Gilba Agronomic Intelligence Hub
 * 
 * Extractants:
 *   - Phosphorus: Olsen (sodium bicarbonate)
 *   - K, Ca, Mg, S: NH₄OAc (pH 8.1)
 * 
 * Data source: Hill Labs NZ standard soil test interpretation ranges
 * Reference: RJ Hill Laboratories Ltd, Hamilton NZ
 * 
 * Key differences from MLSN/SLAN (Mehlich III):
 *   - Olsen P extracts less than Mehlich III (lower numbers, different ranges)
 *   - NH₄OAc at pH 8.1 gives different extraction efficiency than Mehlich III
 *   - Soil texture (sands vs others) affects K and Mg sufficiency ranges
 *   - P reported in mg/L (equivalent to ppm for soil extracts)
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';


    // ═══════════════════════════════════════════════════════════════════════════
    // SUFFICIENCY RANGES - AMMONIUM ACETATE / OLSEN EXTRACTANTS
    // Units: mg/L for P (Olsen), ppm for others
    // ═══════════════════════════════════════════════════════════════════════════

    const AMMONIUM_ACETATE_RANGES = {
        // Phosphorus - Olsen extraction (NaHCO₃)
        // Note: Olsen P reported in mg/L by Hill Labs
        P: {
            extractant: 'Olsen',
            unit: 'mg/L',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 12], medium: [12, 28], high: [28, Infinity] }
            },
            // kg/Ha elemental conversion (for fertiliser calc)
            // Olsen doesn't use P2O5, these are direct elemental values
            kgHaRanges: {
                all: { low: [0, 26.4], medium: [26.4, 62.6], high: [62.6, Infinity] }
            }
        },

        // Potassium - NH₄OAc (pH 8.1)
        // Soil texture dependent
        K: {
            extractant: 'NH₄OAc (pH 8.1)',
            unit: 'ppm',
            soilTypeDependent: true,
            ranges: {
                sands: { low: [0, 75], medium: [75, 175], high: [175, Infinity] },
                others: { low: [0, 100], medium: [100, 235], high: [235, Infinity] }
            },
            kgHaRanges: {
                sands: { low: [0, 168.1], medium: [168.1, 392.1], high: [392.1, Infinity] },
                others: { low: [0, 224.2], medium: [224.2, 526.8], high: [526.8, Infinity] }
            }
        },

        // Calcium - NH₄OAc (pH 8.1)
        Ca: {
            extractant: 'NH₄OAc (pH 8.1)',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 500], medium: [500, 750], high: [750, Infinity] }
            },
            kgHaRanges: {
                all: { low: [0, 1121], medium: [1121, 1681], high: [1681, Infinity] }
            }
        },

        // Magnesium - NH₄OAc (pH 8.1)
        // Soil texture dependent
        Mg: {
            extractant: 'NH₄OAc (pH 8.1)',
            unit: 'ppm',
            soilTypeDependent: true,
            ranges: {
                sands: { low: [0, 100], medium: [100, 200], high: [200, Infinity] },
                others: { low: [0, 140], medium: [140, 250], high: [250, Infinity] }
            },
            kgHaRanges: {
                sands: { low: [0, 224.2], medium: [224.2, 448.3], high: [448.3, Infinity] },
                others: { low: [0, 314.8], medium: [314.8, 560.4], high: [560.4, Infinity] }
            }
        },

        // Sulphur - NH₄OAc (pH 8.1)
        S: {
            extractant: 'NH₄OAc (pH 8.1)',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 30], medium: [30, 60], high: [60, Infinity] }
            },
            kgHaRanges: {
                all: { low: [0, 67.3], medium: [67.3, 134.5], high: [134.5, Infinity] }
            }
        },

        // Micronutrients - use MLSN/SLAN ranges as baseline
        // Hill Labs doesn't publish specific turf ranges for these
        Fe: {
            extractant: 'DTPA',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 40], medium: [40, 100], high: [100, Infinity] }
            },
            note: 'Using standard DTPA ranges - verify with lab'
        },

        Mn: {
            extractant: 'DTPA',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 10], medium: [10, 50], high: [50, Infinity] }
            },
            note: 'Using standard DTPA ranges - verify with lab'
        },

        Cu: {
            extractant: 'DTPA',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 0.5], medium: [0.5, 3], high: [3, Infinity] }
            },
            note: 'Using standard DTPA ranges - verify with lab'
        },

        Zn: {
            extractant: 'DTPA',
            unit: 'ppm',
            soilTypeDependent: false,
            ranges: {
                all: { low: [0, 1], medium: [1, 5], high: [5, Infinity] }
            },
            note: 'Using standard DTPA ranges - verify with lab'
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERPRETATION ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get the sufficiency range for a nutrient
     * @param {string} nutrient - Nutrient code (P, K, Ca, Mg, S, etc.)
     * @param {string} soilType - 'sands' or 'others' (only used for K, Mg)
     * @returns {object} Range object with low, medium, high bounds
     */
    function getSufficiencyRange(nutrient, soilType = 'others') {
        const config = AMMONIUM_ACETATE_RANGES[nutrient];
        if (!config) {
            console.warn(`[AmmoniumAcetate] Unknown nutrient: ${nutrient}`);
            return null;
        }

        const typeKey = config.soilTypeDependent ? soilType : 'all';
        return {
            nutrient: nutrient,
            extractant: config.extractant,
            unit: config.unit,
            soilType: typeKey,
            ranges: config.ranges[typeKey] || config.ranges.all,
            kgHaRanges: config.kgHaRanges?.[typeKey] || config.kgHaRanges?.all,
            note: config.note
        };
    }

    /**
     * Interpret a soil test value against Ammonium Acetate ranges
     * @param {string} nutrient - Nutrient code
     * @param {number} value - Test result value
     * @param {string} soilType - 'sands' or 'others'
     * @returns {object} Interpretation result
     */
    function interpretValue(nutrient, value, soilType = 'others') {
        const rangeData = getSufficiencyRange(nutrient, soilType);
        if (!rangeData || value === null || value === undefined || isNaN(value)) {
            return {
                nutrient: nutrient,
                value: value,
                status: 'NO DATA',
                statusClass: 'status-no-data',
                confidence: 0
            };
        }

        const ranges = rangeData.ranges;
        let status, statusClass, recommendation;

        if (value < ranges.low[1]) {
            status = 'LOW';
            statusClass = 'status-deficient';
            recommendation = `${nutrient} below sufficiency range. Consider fertiliser application.`;
        } else if (value >= ranges.medium[0] && value < ranges.medium[1]) {
            status = 'SUFFICIENT';
            statusClass = 'status-adequate';
            recommendation = `${nutrient} within medium sufficiency range. Maintenance applications adequate.`;
        } else {
            status = 'HIGH';
            statusClass = 'status-high';
            recommendation = `${nutrient} above sufficiency range. No application needed.`;
        }

        return {
            nutrient: nutrient,
            value: value,
            actual: value,
            unit: rangeData.unit,
            extractant: rangeData.extractant,
            soilType: rangeData.soilType,
            status: status,
            statusClass: statusClass,
            recommendation: recommendation,
            mlsn: `${ranges.medium[0]}-${ranges.medium[1]}`,  // Display range
            rangeMin: ranges.medium[0],
            rangeMax: ranges.medium[1],
            confidence: 85,  // Base confidence for Hill Labs methodology
            methodology: 'ammonium_acetate',
            note: rangeData.note
        };
    }

    /**
     * Interpret all soil test values
     * @param {object} soilData  - Object with nutrient values {K: 120, P: 25, ...}
     * @param {string} soilType  - 'sands' or 'others'
     * @param {string} surfaceType - Optional surface key; 'cotula_bowling_green' routes to S78
     * @returns {object} Full interpretation result
     */
    function interpretSoilTest(soilData, soilType = 'others', surfaceType = null) {

        // ── Cotula bowling green → delegate to S78 module ──────────────────
        const isCotula = surfaceType === 'cotula_bowling_green'
            || (window.GAIP_STATE?.turf?.cotula === true)
            || (window.GAIP_STATE?.turf?.speciesKey === 'cotula');

        if (isCotula) {
            if (window.GAIP_CotulaBowling?.interpretCotulaSoilTest) {
                return window.GAIP_CotulaBowling.interpretCotulaSoilTest(soilData);
            }
            console.warn('[AmmoniumAcetate] Cotula surface detected but GAIP_CotulaBowling not loaded.');
            // Fall through to standard AA if module missing
        }
        // ───────────────────────────────────────────────────────────────────
        const nutrients = [];
        const nutrientList = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn'];

        nutrientList.forEach(nutrient => {
            const value = soilData[nutrient];
            if (value !== undefined && value !== null && value !== '') {
                nutrients.push(interpretValue(nutrient, parseFloat(value), soilType));
            }
        });

        return {
            methodology: 'ammonium_acetate',
            methodologyLabel: 'Ammonium Acetate (Hill Labs)',
            extractants: {
                P: 'Olsen',
                cations: 'NH₄OAc (pH 8.1)'
            },
            soilType: soilType,
            nutrients: nutrients,
            context: {
                methodology: 'ammonium_acetate',
                soilType: soilType,
                dataSource: 'Hill Labs NZ',
                note: 'Ranges calibrated for NZ conditions using Olsen P and NH₄OAc extraction'
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // METHODOLOGY HEADER RENDERER
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Render methodology header for Ammonium Acetate
     * Matches style of MLSN/SLAN headers
     */
    function renderMethodologyHeader(soilType) {
        const config = {
            label: 'Ammonium Acetate',
            fullName: 'Hill Labs NZ Method',
            description: `Olsen P + NH₄OAc extraction — calibrated for NZ soils (${soilType === 'sands' ? 'sand-based rootzone' : 'native soil'})`,
            bgColor: 'var(--gaip-warning-bg)',
            borderColor: '#f59e0b',
            textColor: '#92400e',
            icon: '🧪'
        };

        let confidenceHTML = '';
        if (window.GilbaEngineConfidence && window.GAIP_STATE) {
            const confidence = window.GilbaEngineConfidence.assessConfidence('mlsn-calculator', window.GAIP_STATE);
            confidenceHTML = window.GilbaEngineConfidence.renderCompactConfidence(confidence.score);
        }

        return `
            <div class="gaip-methodology-header" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                margin-bottom: 12px;
                background: ${config.bgColor};
                border: 1px solid ${config.borderColor};
                border-radius: 8px;
            ">
                <div style="font-size: 20px;">${config.icon}</div>
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="
                            font-weight: 700;
                            font-size: 14px;
                            color: ${config.textColor};
                            background: var(--gaip-surface);
                            padding: 2px 8px;
                            border-radius: 4px;
                            border: 1px solid ${config.borderColor};
                        ">${config.label}</span>
                        <span style="font-size: 12px; color: ${config.textColor}; opacity: 0.85;">
                            ${config.fullName}
                        </span>
                        ${confidenceHTML}
                    </div>
                    <div style="font-size: 11px; color: ${config.textColor}; margin-top: 4px; opacity: 0.8;">
                        ${config.description}
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NZ REGION CHECK
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Check if current location is New Zealand
     * Used to conditionally show Ammonium Acetate option
     */
    function isNewZealand() {
        // Method 1: RegionalProfiles
        if (window.GAIP_RegionalProfiles?.detectRegionFromHub) {
            return window.GAIP_RegionalProfiles.detectRegionFromHub() === 'new_zealand';
        }

        // Method 2: GAIP_STATE
        if (window.GAIP_STATE?.location?.region) {
            return window.GAIP_STATE.location.region === 'new_zealand';
        }

        // Method 3: Coordinate bounds
        const lat = window.GAIP_STATE?.location?.lat ||
            window.GAIP_HUB_CONFIG?.savedLocation?.lat;
        const lon = window.GAIP_STATE?.location?.lon ||
            window.GAIP_HUB_CONFIG?.savedLocation?.lon;

        if (lat && lon) {
            return (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34);
        }

        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Initialize methodology dropdown enhancement
     * Adds Ammonium Acetate option for NZ users
     */
    function initMethodologyDropdown() {
        const methodologySelect = document.querySelector('.gaip-soil-methodology');
        if (!methodologySelect) {
            return;
        }

        // Check if already has ammonium_acetate option
        if (methodologySelect.querySelector('option[value="ammonium_acetate"]')) {
            updateMethodologyVisibility();
            return;
        }

        // Add option
        const option = document.createElement('option');
        option.value = 'ammonium_acetate';
        option.textContent = 'Ammonium Acetate (Hill Labs NZ)';
        methodologySelect.appendChild(option);

        // Initial visibility check
        updateMethodologyVisibility();

        // Listen for location changes
        document.addEventListener('gaip:turf-profile-change', updateMethodologyVisibility);
        document.addEventListener('gaip:stateRestored', function() {
            // If restored state already has a methodology set, mark it as explicit
            const methodologySelect = document.querySelector('.gaip-soil-methodology');
            if (methodologySelect && methodologySelect.value && methodologySelect.value !== 'mlsn') {
                if (window.GAIP_STATE?.soil) {
                    window.GAIP_STATE.soil.methodologyExplicit = true;
                }
            }
            updateMethodologyVisibility();
        });

    }

    /**
     * Show/hide Ammonium Acetate option based on region
     * Auto-selects AA when NZ detected and methodology is still default (MLSN/SLAN)
     */
    function updateMethodologyVisibility() {
        const methodologySelect = document.querySelector('.gaip-soil-methodology');
        const aaOption = methodologySelect?.querySelector('option[value="ammonium_acetate"]');

        if (!aaOption) return;

        const showOption = isNewZealand();
        aaOption.style.display = showOption ? '' : 'none';

        if (showOption) {
            // Auto-select AA for NZ when methodology hasn't been explicitly set to AA yet
            // Only auto-switch from default methods (mlsn/slan), not if user has already chosen
            const currentMethod = methodologySelect.value;
            if (currentMethod !== 'ammonium_acetate') {
                // Check if user has explicitly chosen their methodology via site settings
                // If no explicit choice stored, auto-select AA for NZ
                const explicitChoice = window.GAIP_STATE?.soil?.methodologyExplicit;
                if (!explicitChoice) {
                    methodologySelect.value = 'ammonium_acetate';
                    methodologySelect.dispatchEvent(new Event('change'));
                    console.log('[AmmoniumAcetate] Auto-selected for NZ region');
                }
            }
        } else {
            // If currently selected but not NZ, switch to SLAN
            if (methodologySelect.value === 'ammonium_acetate') {
                methodologySelect.value = 'slan';
                methodologySelect.dispatchEvent(new Event('change'));
            }
        }

    }

    /**
     * Initialize soil texture selector for Ammonium Acetate
     * Shows/hides based on methodology selection
     */
    function initSoilTextureSelector() {
        const methodologySelect = document.querySelector('.gaip-soil-methodology');
        if (!methodologySelect) return;

        // Find the container that should already exist in the PHP
        let textureContainer = document.querySelector('.gaip-aa-soil-texture-container');
        
        // If container exists but is empty, populate it
        if (textureContainer && !textureContainer.querySelector('select')) {
            textureContainer.innerHTML = `
                <label style="font-weight: 500; font-size: 13px; color: var(--gaip-text);">
                    Rootzone Type (for K/Mg ranges)
                </label>
                <select class="gaip-aa-soil-texture" style="margin-top: 4px; width: 100%;">
                    <option value="others">Native soil / Soil-based</option>
                    <option value="sands">Sand-based rootzone (USGA spec)</option>
                </select>
                <small style="display: block; color: var(--gaip-text); font-size: 11px; margin-top: 4px;">
                    Sand-based rootzones have different K and Mg sufficiency thresholds
                </small>
            `;
        }

        // Toggle visibility based on methodology
        function updateTextureVisibility() {
            const isAA = methodologySelect.value === 'ammonium_acetate';
            if (textureContainer) {
                textureContainer.style.display = isAA ? 'block' : 'none';
            }
            
            // Update the method note visibility
            const aaNote = document.querySelector('.gaip-aa-method-note');
            if (aaNote) {
                aaNote.style.display = isAA ? 'block' : 'none';
            }
            
            // Update extractant note based on methodology
            updateExtractantNote(methodologySelect.value);
            
            // Dispatch event for other modules
            document.dispatchEvent(new CustomEvent('gaip:methodology-change', {
                detail: { methodology: methodologySelect.value }
            }));
        }
        
        // Handle soil texture change
        const textureSelect = textureContainer?.querySelector('.gaip-aa-soil-texture');
        if (textureSelect) {
            textureSelect.addEventListener('change', function() {
                // Update GAIP_STATE if available
                if (window.GAIP_STATE && window.GAIP_STATE.soil) {
                    window.GAIP_STATE.soil.aaSoilTexture = this.value;
                }
                
                // Dispatch event to trigger recalculation
                document.dispatchEvent(new CustomEvent('gaip:soil-texture-change', {
                    detail: { soilTexture: this.value }
                }));
                
            });
        }

        methodologySelect.addEventListener('change', updateTextureVisibility);
        updateTextureVisibility();

    }
    
    /**
     * Update the extractant note based on methodology
     */
    function updateExtractantNote(methodology) {
        const note = document.querySelector('.gaip-soil-method-note');
        if (!note) return;
        
        if (methodology === 'ammonium_acetate') {
            note.textContent = 'Olsen P (mg/L) + NH₄OAc (pH 8.1) cations';
        } else {
            note.textContent = 'Mehlich 3 extractant (Olsen for P)';
        }
    }

    /**
     * Get current soil texture selection
     */
    function getSoilTextureSelection() {
        const select = document.querySelector('.gaip-aa-soil-texture');
        return select?.value || 'others';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    function init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        initMethodologyDropdown();
        initSoilTextureSelector();

        // Retry after a delay in case elements load late
        setTimeout(() => {
            initMethodologyDropdown();
            initSoilTextureSelector();
        }, 1000);
    }

    init();

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    const AmmoniumAcetateMethodology = {
        // Core data
        RANGES: AMMONIUM_ACETATE_RANGES,

        // Interpretation functions
        getSufficiencyRange,
        interpretValue,
        interpretSoilTest,

        // UI helpers
        renderMethodologyHeader,
        isNewZealand,
        getSoilTextureSelection,

        // Initialization
        init,
        initMethodologyDropdown,
        initSoilTextureSelector,
        updateMethodologyVisibility
    };

    // Export to global scope
    global.GAIP_AmmoniumAcetate = AmmoniumAcetateMethodology;
    global.AmmoniumAcetateMethodology = AmmoniumAcetateMethodology;

})(typeof window !== 'undefined' ? window : this);
