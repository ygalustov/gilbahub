/**
 * =============================================================================
 * RED THREAD MODEL INTEGRATION PATCH v1.0.0
 * =============================================================================
 * 
 * Wires the red thread heuristic model into:
 * - Disease Engine (main risk calculation)
 * - Disease Forecast (daily timeline)
 * - Disease UI (display)
 * 
 * LOAD ORDER:
 * 1. red-thread-model.js
 * 2. disease-engine.js
 * 3. disease-forecast.js
 * 4. red-thread-integration.js (this file)
 * 
 * @requires red-thread-model.js
 * @requires disease-engine.js
 * @requires disease-forecast.js
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';


    // =========================================================================
    // VERIFY DEPENDENCIES
    // =========================================================================
    
    if (!global.GAIP_RedThreadModel) {
        console.warn('⚠️ Red Thread Integration: red-thread-model.js not loaded');
        return;
    }

    const RedThread = global.GAIP_RedThreadModel;

    // =========================================================================
    // INTEGRATE INTO DISEASE ENGINE
    // =========================================================================
    
    /**
     * Add red thread to species susceptibility if not present
     */
    function patchSpeciesSusceptibility() {
        if (!global.SPECIES_SUSCEPTIBILITY) {
            console.warn('⚠️ Red Thread Integration: SPECIES_SUSCEPTIBILITY not found');
            return;
        }
        
        const species = global.SPECIES_SUSCEPTIBILITY;
        
        // Add redThread susceptibility to each species
        const redThreadSusceptibility = {
            bentgrass: 0.9,
            perennialRyegrass: 1.3,
            kentuckyBluegrass: 1.1,
            tallFescue: 0.7,
            poaAnnua: 1.0,
            bermuda: 0.3,
            couch: 0.3,
            kikuyu: 0.2,
            zoysia: 0.4,
            buffalo: 0.3,
            fineFescue: 1.5
        };
        
        Object.keys(species).forEach(sp => {
            if (!species[sp].redThread) {
                species[sp].redThread = redThreadSusceptibility[sp] || 1.0;
            }
        });
        
    }

    /**
     * Add red thread to disease models registry
     */
    function patchDiseaseModels() {
        if (!global.DISEASE_MODELS) {
            // Try to find it on DiseaseEngine
            if (global.DiseaseEngine && global.DiseaseEngine.models) {
                global.DiseaseEngine.models.redThread = RedThread.RedThreadModel;
            }
            return;
        }
        
        global.DISEASE_MODELS.redThread = RedThread.RedThreadModel;
    }

    /**
     * Add red thread to fungicide targets where applicable
     */
    function patchFungicideTargets() {
        // UK fungicides that target red thread
        const redThreadFungicides = [
            'tebuconazole',
            'penthiopyrad', 
            'fludioxonil',
            'azoxystrobin',
            'trifloxystrobin',
            'propiconazole'
        ];
        
        // Patch FUNGICIDES_UK if available
        if (global.FUNGICIDES_UK) {
            redThreadFungicides.forEach(ai => {
                if (global.FUNGICIDES_UK[ai] && !global.FUNGICIDES_UK[ai].targets.includes('redThread')) {
                    global.FUNGICIDES_UK[ai].targets.push('redThread');
                }
            });
        }
        
        // Patch FUNGICIDES_EXTENDED (Scandinavia) if available
        if (global.FUNGICIDES_EXTENDED) {
            ['fludioxonil', 'tebuconazole'].forEach(ai => {
                if (global.FUNGICIDES_EXTENDED[ai] && !global.FUNGICIDES_EXTENDED[ai].targets.includes('redThread')) {
                    global.FUNGICIDES_EXTENDED[ai].targets.push('redThread');
                }
            });
        }
    }

    // =========================================================================
    // INTEGRATE INTO DISEASE FORECAST
    // =========================================================================

    /**
     * Patch DiseaseForecast to include red thread in timeline
     *
     * b35fix459 (C64): RETIRED. This function previously wrapped
     * `global.DiseaseForecast.getDiseaseCalculators` which never existed on
     * disease-forecast.js, so the wrap was a no-op since this module shipped.
     * Red Thread is now natively registered in `DISEASE_CALCULATORS` at
     * disease-forecast.js line ~580 with a thin `calcRedThreadDaily` wrapper
     * delegating to GAIP_RedThreadModel.calculateDaily, and dispatched
     * inside the main pure engine via disease-engine-pure.js analyse() loop
     * at line ~4980. The legacy integration patch is retained as a guarded
     * no-op for the case where window.GILBA_USE_PURE_DISEASE is explicitly
     * set to false and the legacy `disease-engine.js` analyse() path is
     * re-enabled (in which case patchSpeciesSusceptibility +
     * patchDiseaseModels are still needed to backfill the legacy table).
     */
    function patchDiseaseForecast() {
        // No-op since b35fix459 (C64). Native wire-in in disease-forecast.js
        // and disease-engine-pure.js replaces this dead wrapper. See
        // assets/disease-forecast.js calcRedThreadDaily and
        // assets/disease-engine-pure.js Red Thread dispatcher block.
        return;
    }

    /**
     * Alternative: Direct injection into DISEASE_CALCULATIONS if that's the pattern
     */
    function patchDiseaseCalculations() {
        // Check for common forecast calculation registry patterns
        const registries = [
            'DISEASE_CALCULATIONS',
            'FORECAST_DISEASES', 
            'DiseaseForecast.DISEASES'
        ];
        
        registries.forEach(path => {
            const parts = path.split('.');
            let obj = global;
            
            for (const part of parts) {
                if (obj && obj[part]) {
                    obj = obj[part];
                } else {
                    obj = null;
                    break;
                }
            }
            
            if (obj && typeof obj === 'object') {
                obj.redThread = {
                    name: 'Red Thread',
                    calc: RedThread.calculateDaily,
                    beta: false,
                    confidence: 'low'
                };
            }
        });
    }

    // =========================================================================
    // REGIONAL ACTIVATION
    // =========================================================================

    /**
     * Determine if red thread should be included in disease analysis
     * Based on region and species
     */
    function shouldIncludeRedThread() {
        const state = global.GAIP_STATE;
        if (!state) return true; // Default to include
        
        const region = state.location?.region || state.location?.detected || 'uk_ireland';
        const species = state.turf?.grassSpecies || state.turf?.species || 'perennialRyegrass';
        
        return RedThread.shouldUseRedThreadModel(region, species);
    }

    /**
     * Get red thread priority for UK regions
     * Returns priority level for disease display ordering
     */
    function getRedThreadPriority(region) {
        const priorities = {
            'uk_ireland': 2,      // High priority - signature UK disease
            'scandinavia': 4,    // Lower priority
            'continental_europe': 3,
            'us_north': 3,
            'new_zealand': 3
        };
        
        return priorities[region] || 5;
    }

    // =========================================================================
    // VARIETY TRAIT INTEGRATION
    // =========================================================================

    /**
     * Extract red thread risk multiplier from UK variety traits
     */
    function getVarietyRedThreadModifier(species, variety) {
        // Try UK variety traits first
        if (global.gaip_getUKDiseaseModifier) {
            const mod = global.gaip_getUKDiseaseModifier(species, variety, 'redThread');
            if (mod && mod.riskMultiplier) {
                return mod;
            }
        }
        
        // Try BSPB rating conversion
        if (global.GAIP_UK_VARIETY_TRAITS) {
            const speciesData = global.GAIP_UK_VARIETY_TRAITS[species];
            if (speciesData && speciesData[variety]) {
                const bspbRating = speciesData[variety].bspbRatings?.redThreadResistance;
                if (bspbRating) {
                    return {
                        riskMultiplier: RedThread.bspbToRiskMultiplier(bspbRating),
                        confidence: 'high',
                        source: `BSPB 2025 - Rating ${bspbRating}/9`
                    };
                }
            }
        }
        
        return { riskMultiplier: 1.0, confidence: 'none' };
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    /**
     * Get display configuration for red thread in disease UI
     */
    function getRedThreadDisplayConfig() {
        return {
            name: 'Red Thread',
            shortName: 'Red Thread',
            pathogen: 'Laetisaria fuciformis',
            color: '#e91e63',  // Pink/red - matches disease appearance
            icon: '🔴',
            
            // Flag as heuristic model
            badge: {
                text: 'Heuristic',
                tooltip: 'Risk index based on observational thresholds, not a validated predictive model',
                class: 'gaip-badge-heuristic'
            },
            
            // Key message for UI
            keyMessage: 'Nitrogen deficiency is the primary driver. Adequate N typically prevents outbreaks.',
            
            // Links
            infoUrl: 'https://extension.psu.edu/turfgrass-diseases-red-thread-causal-fungus-laetisaria-fuciformis',
            
            // Confidence display
            showConfidenceWarning: true,
            confidenceWarning: 'This model uses observational thresholds. Use for general risk awareness.'
        };
    }

    /**
     * Format red thread result for display
     */
    function formatRedThreadResult(result) {
        if (!result) return null;
        
        const formatted = {
            ...result,
            displayConfig: getRedThreadDisplayConfig(),
            
            // Emphasize N status
            nitrogenEmphasis: result.drivers?.nitrogen?.modifier >= 1.5,
            
            // Action summary
            primaryAction: result.drivers?.nitrogen?.modifier >= 1.5 ?
                'Apply nitrogen fertiliser (25-35 kg N/ha)' :
                'Monitor conditions',
            
            // Simplified risk message
            riskMessage: getRiskMessage(result.riskLevel, result.drivers?.nitrogen?.status)
        };
        
        return formatted;
    }

    function getRiskMessage(riskLevel, nStatus) {
        if (nStatus === 'deficient' || nStatus === 'low') {
            return `${riskLevel.toUpperCase()} RISK - Low nitrogen is enabling red thread. Fertilise to suppress.`;
        }
        
        const messages = {
            'severe': 'Conditions highly favorable for red thread activity',
            'high': 'Elevated risk - monitor for symptoms',
            'moderate': 'Some risk factors present',
            'low': 'Limited risk at current conditions',
            'minimal': 'Conditions unfavorable for red thread'
        };
        
        return messages[riskLevel] || 'Risk assessment unavailable';
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function initialize() {
        // Wait for DOM and other modules
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runPatches);
        } else {
            // Small delay to ensure other modules loaded
            setTimeout(runPatches, 100);
        }
    }

    function runPatches() {
        try {
            patchSpeciesSusceptibility();
            patchDiseaseModels();
            patchFungicideTargets();
            patchDiseaseForecast();
            patchDiseaseCalculations();
            
        } catch (e) {
            console.error('❌ Red Thread Integration error:', e);
        }
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const RedThreadIntegration = {
        version: '1.0.0',
        
        // Status check
        shouldIncludeRedThread: shouldIncludeRedThread,
        getRedThreadPriority: getRedThreadPriority,
        
        // Variety integration
        getVarietyRedThreadModifier: getVarietyRedThreadModifier,
        
        // UI helpers
        getRedThreadDisplayConfig: getRedThreadDisplayConfig,
        formatRedThreadResult: formatRedThreadResult,
        
        // Manual initialization
        initialize: runPatches
    };

    // Export
    global.GAIP_RedThreadIntegration = RedThreadIntegration;
    
    // Auto-initialize
    initialize();

})(typeof window !== 'undefined' ? window : this);
