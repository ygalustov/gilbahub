/**
 * ============================================================================
 * NZ FINE FESCUE INTEGRATION PATCH v1.0.0
 * ============================================================================
 * 
 * This file integrates the NZ Fine Fescue traits database into the Hub.
 * Load AFTER nz-fine-fescue-traits.js and variety-traits-integration.js
 * 
 * INTEGRATION POINTS:
 * 1. Species normalization mapping
 * 2. Variety dropdown population for NZ region
 * 3. Disease modifier routing
 * 4. Wear/shade/salinity modifier routing
 * 5. DLI requirements for fine fescues
 * 
 * @requires nz-fine-fescue-traits.js
 * @requires variety-traits-integration.js
 * @requires turf-profile-controller.js
 * @author Gilba Solutions
 * @version 1.0.0
 * ============================================================================
 */

(function(global) {
    'use strict';


    // ========================================================================
    // SPECIES NORMALIZATION EXTENSION
    // ========================================================================

    /**
     * Extended species normalization map for fine fescues
     * These get added to the existing normalizeSpecies function
     */
    const FINE_FESCUE_SPECIES_MAP = {
        // Chewings Fescue
        'chewings': 'chewingsFescue',
        'chewingsfescue': 'chewingsFescue',
        'chewings fescue': 'chewingsFescue',
        'festuca rubra commutata': 'chewingsFescue',
        'f. rubra commutata': 'chewingsFescue',
        'chewings fescue (greens)': 'chewingsFescue',
        'chewings fescue (fairways)': 'chewingsFescue',
        
        // Slender Creeping Red Fescue
        'slender creeping red': 'slenderCreepingRedFescue',
        'slendercreepingred': 'slenderCreepingRedFescue',
        'slender creeping red fescue': 'slenderCreepingRedFescue',
        'slendercreepingredfescue': 'slenderCreepingRedFescue',
        'festuca rubra litoralis': 'slenderCreepingRedFescue',
        'f. rubra litoralis': 'slenderCreepingRedFescue',
        'slender crf': 'slenderCreepingRedFescue',
        'slender creeping red fescue (greens)': 'slenderCreepingRedFescue',
        'slender creeping red fescue (fairways)': 'slenderCreepingRedFescue',
        
        // Strong Creeping Red Fescue
        'strong creeping red': 'strongCreepingRedFescue',
        'strongcreepingred': 'strongCreepingRedFescue',
        'strong creeping red fescue': 'strongCreepingRedFescue',
        'strongcreepingredfescue': 'strongCreepingRedFescue',
        'festuca rubra rubra': 'strongCreepingRedFescue',
        'f. rubra rubra': 'strongCreepingRedFescue',
        'strong crf': 'strongCreepingRedFescue',
        'creeping red fescue': 'strongCreepingRedFescue',  // Default CRF = strong
        'creepingredfescue': 'strongCreepingRedFescue',
        'crf': 'strongCreepingRedFescue',
        'strong creeping red fescue (fairways)': 'strongCreepingRedFescue',
        
        // Generic fine fescue (default to chewings for greens context)
        'fine fescue': 'chewingsFescue',
        'finefescue': 'chewingsFescue',
        'fine fescue (greens)': 'chewingsFescue',
        'fine fescue (fairways)': 'chewingsFescue'
    };

    /**
     * Check if species is a fine fescue type
     */
    function isFineFescueSpecies(species) {
        if (!species) return false;
        const normalized = species.toLowerCase().replace(/\s+/g, '');
        return normalized.includes('chewings') || 
               normalized.includes('slendercreeping') ||
               normalized.includes('strongcreeping') ||
               normalized.includes('finefescue') ||
               normalized.includes('creepingredfescue') ||
               ['chewingsFescue', 'slenderCreepingRedFescue', 'strongCreepingRedFescue'].includes(species);
    }

    /**
     * Normalize fine fescue species name
     */
    function normalizeFineFescueSpecies(species) {
        if (!species) return null;
        const key = species.toLowerCase().replace(/\s+/g, '');
        return FINE_FESCUE_SPECIES_MAP[key] || 
               FINE_FESCUE_SPECIES_MAP[species.toLowerCase()] ||
               null;
    }

    // ========================================================================
    // VARIETY LOOKUP FUNCTIONS
    // ========================================================================

    /**
     * Get fine fescue varieties for dropdown
     * Only for NZ region
     */
    function getFineFescueVarieties(species, region) {
        // Only show fine fescues for NZ
        if (region !== 'new_zealand' && region !== 'ntep') {
            // For non-NZ, only show if explicitly in NZ context
            const currentRegion = region || detectCurrentRegion();
            if (currentRegion !== 'new_zealand') {
                return [];
            }
        }

        const normalizedSpecies = normalizeFineFescueSpecies(species);
        if (!normalizedSpecies) return [];

        if (typeof global.NZ_FINE_FESCUE_TRAITS === 'undefined') {
            console.warn('[FineFescue] NZ_FINE_FESCUE_TRAITS not loaded');
            return [];
        }

        const speciesData = global.NZ_FINE_FESCUE_TRAITS[normalizedSpecies];
        if (!speciesData) return [];

        const varieties = [];
        Object.keys(speciesData).forEach(name => {
            const v = speciesData[name];
            varieties.push({
                value: name,
                label: v.displayName || name,
                region: 'nz_fine_fescue',
                dataTier: v.dataTier,
                nzAvailable: v.nzAvailable,
                greensCapable: normalizedSpecies !== 'strongCreepingRedFescue',
                // Add tier badge to label
                displayLabel: `${v.displayName || name}${v.dataTier === 1 ? ' ★★★' : v.dataTier === 2 ? ' ★★' : ' ★'}${v.nzAvailable ? '' : ' (import)'}`
            });
        });

        // Sort: NZ available first, then by tier
        varieties.sort((a, b) => {
            if (a.nzAvailable !== b.nzAvailable) return b.nzAvailable - a.nzAvailable;
            return a.dataTier - b.dataTier;
        });

        return varieties;
    }

    /**
     * Get fine fescue variety trait data
     */
    function getFineFescueTraits(species, varietyName) {
        const normalizedSpecies = normalizeFineFescueSpecies(species);
        if (!normalizedSpecies) return null;

        if (typeof global.gaip_getNZFineFescueTraits === 'function') {
            return global.gaip_getNZFineFescueTraits(normalizedSpecies, varietyName);
        }

        // Direct lookup fallback
        const speciesData = global.NZ_FINE_FESCUE_TRAITS?.[normalizedSpecies];
        return speciesData?.[varietyName] || null;
    }

    // ========================================================================
    // MODIFIER FUNCTIONS
    // ========================================================================

    /**
     * Get wear modifier for fine fescue variety
     */
    function getFineFescueWearModifier(species, varietyName) {
        const traits = getFineFescueTraits(species, varietyName);
        
        if (traits?.traits?.wear) {
            return {
                multiplier: traits.traits.wear.multiplier || 1.0,
                confidence: traits.traits.wear.confidence || 'medium',
                source: traits.traits.wear.source || 'NZ Fine Fescue Database',
                recoveryMultiplier: traits.traits.recovery?.multiplier || 1.0,
                region: 'nz_fine_fescue'
            };
        }

        // Species defaults
        const normalizedSpecies = normalizeFineFescueSpecies(species);
        const defaults = global.FINE_FESCUE_SPECIES_DEFAULTS?.[normalizedSpecies];
        
        return {
            multiplier: 1.0,
            confidence: 'low',
            source: 'Fine fescue species baseline',
            recoveryMultiplier: normalizedSpecies === 'strongCreepingRedFescue' ? 0.85 : 1.0,
            region: 'nz_fine_fescue'
        };
    }

    /**
     * Get disease modifier for fine fescue variety
     */
    function getFineFescueDiseaseModifier(species, varietyName, disease) {
        // Use dedicated function if available
        if (typeof global.gaip_getNZFineFescueDiseaseModifier === 'function') {
            const result = global.gaip_getNZFineFescueDiseaseModifier(
                normalizeFineFescueSpecies(species), 
                varietyName, 
                disease
            );
            return {
                riskMultiplier: result.multiplier,
                confidence: result.confidence,
                source: result.source,
                region: 'nz_fine_fescue'
            };
        }

        // Direct lookup
        const traits = getFineFescueTraits(species, varietyName);
        if (traits?.traits?.disease?.[disease]) {
            return {
                riskMultiplier: traits.traits.disease[disease].riskMultiplier || 1.0,
                confidence: traits.traits.disease[disease].confidence || 'medium',
                source: traits.traits.disease[disease].source || 'NZ Fine Fescue Database',
                region: 'nz_fine_fescue'
            };
        }

        // Species baseline
        const normalizedSpecies = normalizeFineFescueSpecies(species);
        const diseaseData = global.NZ_FINE_FESCUE_DISEASE_MODIFIERS?.[disease];
        if (diseaseData?.speciesBaseline?.[normalizedSpecies]) {
            return {
                riskMultiplier: diseaseData.speciesBaseline[normalizedSpecies],
                confidence: 'low',
                source: 'Fine fescue species baseline',
                region: 'nz_fine_fescue'
            };
        }

        return {
            riskMultiplier: 1.0,
            confidence: 'none',
            source: 'No fine fescue data',
            region: 'nz_fine_fescue'
        };
    }

    /**
     * Get shade modifier for fine fescue variety
     */
    function getFineFescueShadeModifier(species, varietyName) {
        const traits = getFineFescueTraits(species, varietyName);
        
        if (traits?.traits?.shade) {
            return {
                thresholdModifier: traits.traits.shade.multiplier || 0.90,
                minimumDLI: traits.traits.shade.minimumDLI || 12,
                confidence: traits.traits.shade.confidence || 'medium',
                source: traits.traits.shade.source || 'NZ Fine Fescue Database'
            };
        }

        // Fine fescues are shade specialists - default excellent shade tolerance
        return {
            thresholdModifier: 0.90,
            minimumDLI: 12,
            confidence: 'medium',
            source: 'Fine fescue species characteristic'
        };
    }

    /**
     * Get salinity modifier for fine fescue variety
     */
    function getFineFescueSalinityModifier(species, varietyName) {
        const traits = getFineFescueTraits(species, varietyName);
        
        if (traits?.traits?.salinity) {
            return {
                multiplier: traits.traits.salinity.multiplier || 1.0,
                ecThreshold: traits.traits.salinity.ecThreshold || 4.0,
                confidence: traits.traits.salinity.confidence || 'medium',
                source: traits.traits.salinity.source || 'NZ Fine Fescue Database'
            };
        }

        // Slender creeping red is salt specialist
        const normalizedSpecies = normalizeFineFescueSpecies(species);
        if (normalizedSpecies === 'slenderCreepingRedFescue') {
            return {
                multiplier: 0.75,
                ecThreshold: 6.0,
                confidence: 'medium',
                source: 'Slender creeping red fescue - salt tolerant subspecies'
            };
        }

        return {
            multiplier: 1.0,
            ecThreshold: 4.0,
            confidence: 'low',
            source: 'Fine fescue species baseline'
        };
    }

    // ========================================================================
    // REGION DETECTION HELPER
    // ========================================================================

    function detectCurrentRegion() {
        // Check state first
        if (global.currentState?.location?.region) {
            return global.currentState.location.region;
        }

        // Check GAIP_RegionalProfiles
        if (typeof global.GAIP_RegionalProfiles?.detectRegion === 'function') {
            const lat = global.currentState?.location?.lat;
            const lon = global.currentState?.location?.lon;
            if (lat !== undefined && lon !== undefined) {
                return global.GAIP_RegionalProfiles.detectRegion(lat, lon);
            }
        }

        // Check lat/lon for NZ (roughly -34 to -47 lat, 166 to 179 lon)
        const lat = parseFloat(document.querySelector('.gaip-lat')?.value);
        const lon = parseFloat(document.querySelector('.gaip-lon')?.value);
        if (!isNaN(lat) && !isNaN(lon)) {
            if (lat < -34 && lat > -47 && lon > 166 && lon < 179) {
                return 'new_zealand';
            }
        }

        return 'unknown';
    }

    // ========================================================================
    // HOOK INTO EXISTING INTEGRATION
    // ========================================================================

    /**
     * Extend the existing GAIP_VarietyTraits object
     */
    let varietyTraitsRetries = 0;
    const MAX_VARIETY_TRAITS_RETRIES = 50;
    
    function extendVarietyTraits() {
        if (!global.GAIP_VarietyTraits) {
            varietyTraitsRetries++;
            if (varietyTraitsRetries < MAX_VARIETY_TRAITS_RETRIES) {
                setTimeout(extendVarietyTraits, 100);
            } else {
                console.warn('[FineFescue] GAIP_VarietyTraits not found after 5s');
            }
            return;
        }

        const VT = global.GAIP_VarietyTraits;

        // Store original functions
        const originalBuildVarietyOptions = VT.buildVarietyOptions;
        const originalGetVarietySummary = VT.getVarietySummary;

        // Extend buildVarietyOptions
        VT.buildVarietyOptions = function(species, region) {
            // Check if fine fescue
            if (isFineFescueSpecies(species)) {
                const currentRegion = region || detectCurrentRegion();
                if (currentRegion === 'new_zealand') {
                    return getFineFescueVarieties(species, 'new_zealand');
                }
            }
            // Fall through to original
            return originalBuildVarietyOptions.call(this, species, region);
        };

        // Extend getVarietySummary
        VT.getVarietySummary = function(species, variety) {
            if (isFineFescueSpecies(species)) {
                const traits = getFineFescueTraits(species, variety);
                if (traits) {
                    return {
                        name: traits.displayName || variety,
                        species: species,
                        source: traits.dataTier === 1 ? 'NTEP + BSPB' : 
                                traits.dataTier === 2 ? traits.ntepData ? 'NTEP' : 'BSPB' : 
                                'Supplier data',
                        confidence: traits.dataTier === 1 ? 'high' : 
                                   traits.dataTier === 2 ? 'medium' : 'low',
                        nzAvailable: traits.nzAvailable,
                        nzSupplier: traits.nzSupplier,
                        greensCapable: normalizeFineFescueSpecies(species) !== 'strongCreepingRedFescue',
                        traits: {
                            wear: traits.traits?.wear ? {
                                value: traits.traits.wear.multiplier,
                                label: traits.traits.wear.multiplier < 0.95 ? 'Good wear tolerance' :
                                       traits.traits.wear.multiplier > 1.05 ? 'Below average wear' : 'Average wear',
                                confidence: traits.traits.wear.confidence
                            } : null,
                            shade: traits.traits?.shade ? {
                                value: traits.traits.shade.multiplier,
                                label: 'Good shade tolerance',  // Fine fescues are shade specialists
                                confidence: traits.traits.shade.confidence
                            } : null,
                            salinity: traits.traits?.salinity ? {
                                value: traits.traits.salinity.multiplier,
                                label: traits.traits.salinity.multiplier < 0.85 ? 'Excellent salt tolerance' : 'Average salt tolerance',
                                confidence: traits.traits.salinity.confidence
                            } : null
                        },
                        warnings: traits.dataTier === 3 ? ['Supplier data only - verify performance locally'] : 
                                  !traits.nzAvailable ? ['May require import'] : []
                    };
                }
            }
            return originalGetVarietySummary.call(this, species, variety);
        };

    }

    /**
     * Extend regional wear modifier function
     */
    function extendRegionalModifiers() {
        // Extend gaip_getRegionalWearModifier
        const originalWearModifier = global.gaip_getRegionalWearModifier;
        if (originalWearModifier) {
            global.gaip_getRegionalWearModifier = function(species, variety, region) {
                if (isFineFescueSpecies(species) && detectCurrentRegion() === 'new_zealand') {
                    return getFineFescueWearModifier(species, variety);
                }
                return originalWearModifier(species, variety, region);
            };
        }

        // Extend gaip_getRegionalDiseaseModifier
        const originalDiseaseModifier = global.gaip_getRegionalDiseaseModifier;
        if (originalDiseaseModifier) {
            global.gaip_getRegionalDiseaseModifier = function(species, variety, disease, region) {
                if (isFineFescueSpecies(species) && detectCurrentRegion() === 'new_zealand') {
                    return getFineFescueDiseaseModifier(species, variety, disease);
                }
                return originalDiseaseModifier(species, variety, disease, region);
            };
        }

    }

    // ========================================================================
    // TURF PROFILE CONTROLLER EXTENSION
    // ========================================================================
    // NZ fine fescue species are now seeded in the DB (species_definitions table)
    // and delivered via window.GAIP_SpeciesData — no runtime injection needed.
    // This block extends TPC with DLI requirements, profile restoration, and
    // the getVarietiesForSpecies patch.

    let turfProfileRetries = 0;
    const MAX_TURF_PROFILE_RETRIES = 50; // 5 seconds max

    function extendTurfProfileController() {
        const TPC = global.GaipTurfProfile;

        if (!TPC) {
            turfProfileRetries++;
            if (turfProfileRetries < MAX_TURF_PROFILE_RETRIES) {
                setTimeout(extendTurfProfileController, 100);
            } else {
                console.warn('[FineFescue] GaipTurfProfile not found after 5s - fine fescue trait data will not be available.');
            }
            return;
        }

        // Add DLI requirements for fine fescues
        if (TPC.speciesDLI) {
            Object.assign(TPC.speciesDLI, {
                // Chewings - excellent shade tolerance
                'chewingsFescue': { min: 8, target: 12, optimal: 16 },
                'Chewings Fescue': { min: 8, target: 12, optimal: 16 },
                'Chewings Fescue (Greens)': { min: 8, target: 12, optimal: 16 },
                'Chewings Fescue (Fairways)': { min: 8, target: 12, optimal: 16 },
                
                // Slender creeping red - excellent shade tolerance
                'slenderCreepingRedFescue': { min: 7, target: 11, optimal: 15 },
                'Slender Creeping Red Fescue': { min: 7, target: 11, optimal: 15 },
                'Slender Creeping Red Fescue (Greens)': { min: 7, target: 11, optimal: 15 },
                'Slender Creeping Red Fescue (Fairways)': { min: 7, target: 11, optimal: 15 },
                
                // Strong creeping red - good shade tolerance
                'strongCreepingRedFescue': { min: 8, target: 12, optimal: 18 },
                'Strong Creeping Red Fescue': { min: 8, target: 12, optimal: 18 },
                'Strong Creeping Red Fescue (Fairways)': { min: 8, target: 12, optimal: 18 }
            });
        }

        // Re-apply saved profile species if it was a fine fescue (profile loaded before page was ready)
        var savedProfiles = typeof TPC.getSavedProfiles === 'function' ? TPC.getSavedProfiles() : {};
        var currentSiteId = null;
        if (global.GAIP_STATE && global.GAIP_STATE.site) {
            currentSiteId = global.GAIP_STATE.site.siteId || global.GAIP_STATE.site.id;
        }
        if (!currentSiteId) {
            var siteSelect = document.querySelector('.gaip-site-select, [data-site-selector]');
            if (siteSelect) currentSiteId = siteSelect.value;
        }
        if (currentSiteId && savedProfiles[currentSiteId]) {
            var savedSpecies = savedProfiles[currentSiteId].species;
            if (savedSpecies && isFineFescueSpecies(savedSpecies)) {
                var speciesEl = TPC.elements && TPC.elements.speciesSelect;
                if (speciesEl && speciesEl.value !== savedSpecies) {
                    speciesEl.value = savedSpecies;
                    TPC.selectSpecies(savedSpecies);
                    var savedVariety = savedProfiles[currentSiteId].variety;
                    if (savedVariety && TPC.elements.varietySelect) {
                        setTimeout(function() {
                            TPC.elements.varietySelect.value = savedVariety;
                            TPC.state.variety = savedVariety;
                        }, 100);
                    }
                }
            }
        }

        // Patch getVarietiesForSpecies to return fine fescue varieties
        const originalGetVarietiesForSpecies = TPC.getVarietiesForSpecies.bind(TPC);
        TPC.getVarietiesForSpecies = function(species) {
            // Check if this is a fine fescue species
            if (isFineFescueSpecies(species)) {
                const currentRegion = region || detectCurrentRegion();
                if (currentRegion === 'new_zealand') {
                    const varieties = getFineFescueVarieties(species, 'new_zealand');
                    if (varieties && varieties.length > 0) {
                        // Add generic option at the end
                        const result = [
                            { value: 'generic', label: 'Generic / Unknown' },
                            ...varieties.map(v => ({
                                value: v.value,
                                label: v.displayLabel || v.label,
                                dataTier: v.dataTier,
                                nzAvailable: v.nzAvailable
                            }))
                        ];
                        return result;
                    }
                }
            }
            // Fall through to original
            return originalGetVarietiesForSpecies(species);
        };
    }

    // ========================================================================
    // DISEASE ENGINE EXTENSION
    // ========================================================================

    /**
     * Add fine fescue disease susceptibility data
     */
    function extendDiseaseEngine() {
        // Check if disease engine exists
        if (!global.GAIP_DiseaseEngine && !global.DiseaseRiskEngine) {
            // Disease engine may not be loaded yet, that's OK
            return;
        }

        // Register fine fescue susceptibility data with disease engine
        // This will be used when the engine looks up variety-specific modifiers
        const susceptibilityData = {
            chewingsFescue: {
                redThread: 1.10,
                dollarSpot: 1.05,
                microdochiumPatch: 1.00,
                leafSpot: 1.15,
                summerPatch: 0.90  // Good resistance
            },
            slenderCreepingRedFescue: {
                redThread: 1.15,
                dollarSpot: 1.10,
                microdochiumPatch: 1.00,
                leafSpot: 1.10
            },
            strongCreepingRedFescue: {
                redThread: 1.25,  // High susceptibility
                dollarSpot: 1.15,
                microdochiumPatch: 1.00,
                leafSpot: 1.20
            }
        };

        // Store for disease engine to access
        global.FINE_FESCUE_DISEASE_SUSCEPTIBILITY = susceptibilityData;

    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    // Export functions for external use
    global.gaip_isFineFescueSpecies = isFineFescueSpecies;
    global.gaip_normalizeFineFescueSpecies = normalizeFineFescueSpecies;
    global.gaip_getFineFescueVarieties = getFineFescueVarieties;
    global.gaip_getFineFescueTraits = getFineFescueTraits;
    global.gaip_getFineFescueWearModifier = getFineFescueWearModifier;
    global.gaip_getFineFescueDiseaseModifier = getFineFescueDiseaseModifier;
    global.gaip_getFineFescueShadeModifier = getFineFescueShadeModifier;
    global.gaip_getFineFescueSalinityModifier = getFineFescueSalinityModifier;

    // Species map for external use
    global.FINE_FESCUE_SPECIES_MAP = FINE_FESCUE_SPECIES_MAP;

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function init() {
        // Extend existing systems
        extendVarietyTraits();
        extendRegionalModifiers();
        extendTurfProfileController();
        extendDiseaseEngine();
    }

    // Run on DOM ready or immediately if already ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to ensure other scripts have loaded
        setTimeout(init, 50);
    }

    // ========================================================================
    // MOBILE RACE CONDITION SAFETY NET
    // ========================================================================
    // On mobile, turf-profile-controller.js calls updateSpeciesOptions() before
    // this script has finished injecting fine fescue species into speciesByType.
    // This means a user's saved fine fescue species silently fails to restore
    // (the <option> doesn't exist yet when loadProfile() sets select.value).
    //
    // We listen for the 'gaip:species-options-updated' event which fires after
    // every updateSpeciesOptions() call. If the saved species is a fine fescue
    // that isn't in the updated list, we inject species + restore immediately.
    var _fineFescueUpdating = false;
    document.addEventListener('gaip:species-options-updated', function(e) {
        if (_fineFescueUpdating) return; // Prevent re-entry loop
        var TPC = global.GaipTurfProfile;
        if (!TPC) return;

        // Only act if the current selection is missing but we know a better one
        var savedSpecies = null;
        try {
            var lastProfile = localStorage.getItem((TPC.STORAGE_KEY || 'gaip_turf_profiles') + '_last');
            if (lastProfile) {
                var profiles = JSON.parse(localStorage.getItem(TPC.STORAGE_KEY || 'gaip_turf_profiles') || '{}');
                if (profiles[lastProfile]) savedSpecies = profiles[lastProfile].species;
            }
        } catch(ex) { /* ignore */ }

        if (!savedSpecies || !isFineFescueSpecies(savedSpecies)) return;

        var detail = e.detail || {};
        var available = detail.availableSpecies || [];
        var alreadyPresent = available.some(function(s) { return s.value === savedSpecies; });
        if (alreadyPresent) return; // Already in list, nothing to do

        // Fine fescue not in list yet - inject now and re-apply
        if (TPC.speciesByType && TPC.speciesByType.golf && TPC.speciesByType.golf.greens) {
            var greensC3 = TPC.speciesByType.golf.greens.c3;
            if (greensC3) {
                var hasChewings = greensC3.some(function(s) { return s.value.includes('Chewings'); });
                if (!hasChewings) {
                    greensC3.push(
                        { value: 'Chewings Fescue (Greens)', label: 'Chewings Fescue', type: 'C3', regions: ['new_zealand'] },
                        { value: 'Slender Creeping Red Fescue (Greens)', label: 'Slender Creeping Red Fescue', type: 'C3', regions: ['new_zealand'] }
                    );
                }
            }
        }

        // Re-run updateSpeciesOptions so the new options appear in the DOM
        if (typeof TPC.updateSpeciesOptions === 'function') {
            // Temporarily set state.species so our fix in updateSpeciesOptions preserves it
            TPC.state.species = savedSpecies;
            _fineFescueUpdating = true;
            TPC.updateSpeciesOptions();
            _fineFescueUpdating = false;
        }
    });

})(typeof window !== 'undefined' ? window : this);
