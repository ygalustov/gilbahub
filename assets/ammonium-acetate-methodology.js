/**
 * AMMONIUM ACETATE METHODOLOGY v1.1.0
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
 *   - NH4OAc at pH 8.1 gives different extraction efficiency than Mehlich III
 *   - Soil texture (sands vs others) affects K and Mg sufficiency ranges
 *   - P reported in mg/L (equivalent to ppm for soil extracts)
 *
 * v1.1.0, b35fix443 / C53: methodology VALUE routed-write through hub-store
 * proxy. b35fix393 closed methodologyExplicit + aaSoilTexture writes; the
 * methodology value itself was never routed, so engines reading
 * state.soil.methodology (mlsnEngine, nutrition-calendar, nutrition-requirement-
 * engine, hub-tissue-v3 lines 5349/5351, gilba-soil-interpretation,
 * mlsn-progressive-disclosure, AU/UK fertiliser integrations, prebble
 * integration) silently received the prior cascade value or default 'slan'.
 * Routed at four sources: init-time sync (guarded), gaip:stateRestored handler,
 * updateMethodologyVisibility auto-AA + non-NZ revert branches, plus a
 * change-listener catch-all on .gaip-soil-methodology.
 *
 * @author Gilba Solutions
 * @version 1.1.0
 */

(function(global) {
    'use strict';

    // b35fix393: helper for routed soil writes through the hub-store proxy.
    // Pre-fix, this module wrote `window.GAIP_STATE.soil.<key> = value` at three
    // sites (lines 412, 512). All silently dropped through the proxy installed at
    // gilba-hub-v2.js:1393, the getter synthesises a fresh object per read; only
    // the setter's e.inputs branch routes writes via c.set("inputs.soil", ...).
    // Same bug class as b35fix386 / b35fix388 / b35fix391. The setter REPLACES
    // inputs.soil wholesale, so writers must merge with existing fields first.
    //
    // setSoilField(key, value): merges {[key]: value} into the canonical
    // inputs.soil slot. Reads existing state from inputs.soil (post-fix canonical)
    // or .soil (legacy fallback for any module still writing to top-level slot).
    function _b35fix393_setSoilField(key, value) {
        if (!global.GAIP_STATE) return;
        try {
            var existingSoil = (global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.soil)
                || global.GAIP_STATE.soil
                || {};
            var patch = {};
            patch[key] = value;
            global.GAIP_STATE = {
                inputs: {
                    soil: Object.assign({}, existingSoil, patch)
                }
            };
        } catch (e) {
            console.warn('[AmmoniumAcetate b35fix393] state writeback failed for', key, ':', e && e.message);
        }
    }

    // getSoilField(key): tolerant read, prefers canonical inputs.soil, falls
    // back to legacy top-level .soil. Returns undefined if neither has the key.
    function _b35fix393_getSoilField(key) {
        if (!global.GAIP_STATE) return undefined;
        var canonical = global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.soil;
        if (canonical && canonical[key] !== undefined) return canonical[key];
        var legacy = global.GAIP_STATE.soil;
        if (legacy && legacy[key] !== undefined) return legacy[key];
        return undefined;
    }


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
            description: `Olsen P + NH₄OAc extraction, calibrated for NZ soils (${soilType === 'sands' ? 'sand-based rootzone' : 'native soil'})`,
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

        // b35fix443 / C53: route the methodology VALUE itself through the
        // hub-store proxy at every change, so engines reading state.soil.methodology
        // (mlsnEngine at hub-tissue-v3.js:2205, the AA/SLAN branch at lines
        // 5349/5351, nutrition-calendar.js:332, nutrition-requirement-engine.js:656,
        // gilba-soil-interpretation.js:245, mlsn-progressive-disclosure.js:952, the
        // AU + UK fertiliser integrations, the prebble integration) all observe
        // the user's actual choice. Pre-fix the methodology value was never
        // routed; only methodologyExplicit + aaSoilTexture were, via b35fix393.
        // This catch-all listener fires for every trigger path: site-settings
        // panel button click (setDomVal dispatches change), auto-AA at line ~500,
        // non-NZ revert at line ~509, direct legacy DOM-select interaction.
        // Using addEventListener (not onchange=) avoids clobbering any other
        // listener; grep confirmed no other module attaches to this selector
        // pre-b35fix443.
        methodologySelect.addEventListener('change', function() {
            _b35fix393_setSoilField('methodology', methodologySelect.value);
        });

        // Check if already has ammonium_acetate option
        if (methodologySelect.querySelector('option[value="ammonium_acetate"]')) {
            // b35fix443 / C53: initial sync, route the current DOM value if the
            // canonical slot is empty. Guard against polluting a restored value:
            // if inputs.soil.methodology is already populated (state restoration
            // ran before init), do not overwrite. Empty-or-undefined slot
            // populated from DOM covers fresh-page-load.
            var _existingMethod = _b35fix393_getSoilField('methodology');
            if (!_existingMethod && methodologySelect.value) {
                _b35fix393_setSoilField('methodology', methodologySelect.value);
            }
            updateMethodologyVisibility();
            return;
        }

        // Add option
        const option = document.createElement('option');
        option.value = 'ammonium_acetate';
        option.textContent = 'Ammonium Acetate (Hill Labs NZ)';
        methodologySelect.appendChild(option);

        // b35fix443 / C53: initial sync (post option-add path), same guard.
        var _existingMethod2 = _b35fix393_getSoilField('methodology');
        if (!_existingMethod2 && methodologySelect.value) {
            _b35fix393_setSoilField('methodology', methodologySelect.value);
        }

        // Initial visibility check
        updateMethodologyVisibility();

        // Listen for location changes
        document.addEventListener('gaip:turf-profile-change', updateMethodologyVisibility);
        document.addEventListener('gaip:stateRestored', function() {
            // If restored state already has a methodology set, mark it as explicit
            const methodologySelect = document.querySelector('.gaip-soil-methodology');
            if (methodologySelect && methodologySelect.value && methodologySelect.value !== 'mlsn') {
                // b35fix393: route through hub-store proxy (was direct .soil.X assignment, dropped)
                _b35fix393_setSoilField('methodologyExplicit', true);
            }
            // b35fix443 / C53: route the methodology VALUE on stateRestored.
            // Pre-fix only the explicit flag was routed; the value was lost
            // when the persistence layer rehydrated through DOM but did not
            // write to inputs.soil.methodology. Routing here closes the loop
            // before any engine reads state.soil.methodology in the next compute
            // cycle.
            if (methodologySelect && methodologySelect.value) {
                _b35fix393_setSoilField('methodology', methodologySelect.value);
            }
            updateMethodologyVisibility();
        });

        // On site switch the explicit-choice flag from the previous site must not
        // block NZ auto-detection for the incoming site. Clear it so
        // updateMethodologyVisibility can re-run cleanly after the new site's
        // state is restored. Delay lets sample-persistence and site-config-
        // persistence finish restoring the new site's config first.
        document.addEventListener('gaip:site-changed', function() {
            _b35fix393_setSoilField('methodologyExplicit', false);
            setTimeout(updateMethodologyVisibility, 300);
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
                // b35fix393: tolerant read, prefers canonical inputs.soil, falls
                // back to legacy top-level .soil. Pre-fix the legacy-only read
                // returned undefined post-analysis-run because the proxy synthesiser
                // doesn't expose top-level .soil; explicit choice was lost on every
                // updateMethodologyVisibility fire (route change, profile change,
                // state restore), and NZ users were force-switched to AA on every
                // re-fire even after they explicitly chose otherwise.
                const explicitChoice = _b35fix393_getSoilField('methodologyExplicit');
                if (!explicitChoice) {
                    methodologySelect.value = 'ammonium_acetate';
                    // b35fix443 / C53: route the value at source. The change-event
                    // catch-all below will also fire and route, but routing here
                    // first guarantees the canonical slot reflects the new value
                    // before any synchronous listener on the change event runs.
                    _b35fix393_setSoilField('methodology', 'ammonium_acetate');
                    methodologySelect.dispatchEvent(new Event('change'));
                    console.log('[AmmoniumAcetate] Auto-selected for NZ region');
                }
            }
        } else {
            // If currently selected but not NZ, switch to SLAN
            if (methodologySelect.value === 'ammonium_acetate') {
                methodologySelect.value = 'slan';
                // b35fix443 / C53: route the value at source for the non-NZ
                // revert path as well, same rationale as the auto-AA branch.
                _b35fix393_setSoilField('methodology', 'slan');
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
                // b35fix393: route through hub-store proxy (was direct .soil.X assignment, dropped).
                // Symptom: gilba-soil-interpretation.js:249, hub-tissue-v3.js:2360, and
                // word-export.js:6477 fall back to DOM-element value when state.soil
                // is empty, so single-export hides this. Combined export iterates saved
                // sites with their DOM cleared; falls through to 'others' default and
                // every saved site's K/Mg threshold ranges are wrong.
                _b35fix393_setSoilField('aaSoilTexture', this.value);
                
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
