/**
 * =============================================================================
 * GILBA OVERSEED WEAR MULTIPLIER v1.0
 * =============================================================================
 * 
 * Enhanced overseed wear tolerance adjustment with species-specific factors.
 * Extends the base OVERSEED_VULNERABILITY in wear-recovery-engine.js
 * 
 * Scientific Basis:
 * - Auburn University, Clemson overseed wear trials
 * - NTEP wear tolerance comparisons
 * - Gilba Solutions agronomic services data
 * 
 * =============================================================================
 */

(function() {
    'use strict';

    // ========================================================================
    // SPECIES-SPECIFIC OVERSEED FACTORS
    // Some warm-season bases tolerate overseeding competition better than others
    // ========================================================================

    const SPECIES_OVERSEED_FACTORS = {
        'tiftuf':            1.00,  // Excellent overseed tolerance
        'tahoma 31':         0.98,
        'wintergreen':       0.95,
        'santa ana':         0.95,
        'legend':            0.92,
        'ct-2':              0.90,
        'bermudagrass':      0.95,  // Generic hybrid bermuda
        'couch':             0.95,  // Australian couch = bermuda
        'kikuyu':            1.05,  // Vigorous recovery, handles competition
        'zoysia':            0.88,  // Slower recovery from overseed stress
        'buffalo':           0.85,  // Poor overseed candidate
        'generic':           0.95
    };

    // ========================================================================
    // SEEDING RATE MODIFIERS
    // Higher rates = more sacrificial cover but more warm-season stress
    // ========================================================================

    const SEEDING_RATE_MODIFIERS = {
        veryLight:  { range: [0, 200],     modifier: 1.08, label: 'Very Light (<200 kg/ha)' },
        light:      { range: [200, 350],   modifier: 1.05, label: 'Light (200-350 kg/ha)' },
        standard:   { range: [350, 500],   modifier: 1.00, label: 'Standard (350-500 kg/ha)' },
        heavy:      { range: [500, 700],   modifier: 0.92, label: 'Heavy (500-700 kg/ha)' },
        excessive:  { range: [700, 9999],  modifier: 0.85, label: 'Excessive (>700 kg/ha)' }
    };

    // ========================================================================
    // ENHANCED OVERSEED STAGES
    // More granular than base engine, with transition timing
    // ========================================================================

    const ENHANCED_OVERSEED_STAGES = {
        none:          { multiplier: 1.00, label: 'Pure Stand', weeksPost: null },
        pre_seed:      { multiplier: 1.00, label: 'Pre-Overseed', weeksPost: -1 },
        germinating:   { multiplier: 0.25, label: 'Germinating', weeksPost: [0, 2] },
        establishing:  { multiplier: 0.40, label: 'Establishing', weeksPost: [2, 4] },
        immature:      { multiplier: 0.65, label: 'Immature', weeksPost: [4, 8] },
        maturing:      { multiplier: 0.85, label: 'Maturing', weeksPost: [8, 12] },
        mature:        { multiplier: 0.90, label: 'Mature Overseed', weeksPost: [12, 20] },
        transitioning: { multiplier: 0.55, label: 'Spring Transition', weeksPost: 'spring' },
        fading:        { multiplier: 0.70, label: 'Ryegrass Fading', weeksPost: 'late_spring' },
        dead:          { multiplier: 1.00, label: 'Overseed Complete', weeksPost: null }
    };

    // ========================================================================
    // CORE CALCULATION
    // ========================================================================

    /**
     * Calculate enhanced overseed wear multiplier
     * Combines stage, species, and seeding rate factors
     * 
     * @param {string} overseedStatus - Current overseed stage key
     * @param {string} variety - Turf variety name
     * @param {string} species - Base species (couch, kikuyu, etc.)
     * @param {number} seedingRateKgHa - Optional ryegrass seeding rate
     * @returns {object} Multiplier and component analysis
     */
    function calculateOverseedMultiplier(overseedStatus, variety, species, seedingRateKgHa) {
        
        // Get stage multiplier
        const stage = ENHANCED_OVERSEED_STAGES[overseedStatus] || ENHANCED_OVERSEED_STAGES.none;
        const stageMultiplier = stage.multiplier;

        // Get species/variety factor
        const varietyKey = (variety || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const speciesKey = (species || '').toLowerCase();
        
        let speciesFactor = SPECIES_OVERSEED_FACTORS[varietyKey] || 
                           SPECIES_OVERSEED_FACTORS[speciesKey] || 
                           SPECIES_OVERSEED_FACTORS.generic;

        // Get seeding rate modifier
        let rateModifier = 1.0;
        let rateCategory = 'standard';
        
        if (seedingRateKgHa !== undefined && seedingRateKgHa !== null) {
            for (const [key, data] of Object.entries(SEEDING_RATE_MODIFIERS)) {
                if (seedingRateKgHa >= data.range[0] && seedingRateKgHa < data.range[1]) {
                    rateModifier = data.modifier;
                    rateCategory = key;
                    break;
                }
            }
        }

        // Calculate combined multiplier
        const combinedMultiplier = stageMultiplier * speciesFactor * rateModifier;

        // Calculate reduction percentage
        const reductionPercent = (1 - combinedMultiplier) * 100;

        // Determine impact level
        let impactLevel;
        if (reductionPercent <= 5) impactLevel = 'negligible';
        else if (reductionPercent <= 15) impactLevel = 'minor';
        else if (reductionPercent <= 30) impactLevel = 'moderate';
        else if (reductionPercent <= 50) impactLevel = 'significant';
        else impactLevel = 'severe';

        return {
            combinedMultiplier: Math.round(combinedMultiplier * 1000) / 1000,
            reductionPercent: Math.round(reductionPercent * 10) / 10,
            impactLevel: impactLevel,
            components: {
                stage: {
                    key: overseedStatus,
                    label: stage.label,
                    multiplier: stageMultiplier
                },
                species: {
                    key: varietyKey || speciesKey,
                    factor: speciesFactor
                },
                seedingRate: {
                    rateKgHa: seedingRateKgHa,
                    category: rateCategory,
                    modifier: rateModifier
                }
            },
            managementNotes: getManagementNotes(overseedStatus, impactLevel)
        };
    }

    /**
     * Quick multiplier lookup - just returns the number
     */
    function getOverseedMultiplier(overseedStatus, species) {
        const stage = ENHANCED_OVERSEED_STAGES[overseedStatus] || ENHANCED_OVERSEED_STAGES.none;
        const speciesKey = (species || '').toLowerCase();
        const speciesFactor = SPECIES_OVERSEED_FACTORS[speciesKey] || SPECIES_OVERSEED_FACTORS.generic;
        
        return Math.round(stage.multiplier * speciesFactor * 1000) / 1000;
    }

    /**
     * Auto-detect overseed status based on location and date
     * Only applies to:
     * - Southern Hemisphere (Australia, South Africa, etc.)
     * - US Transition Zone (lat 30-38°N)
     */
    function detectOverseedStatus(latitude, month) {
        const absLat = Math.abs(latitude);
        const isSouthern = latitude < 0;
        const isUSTransitionZone = latitude >= 30 && latitude <= 38;

        // Tropical - rarely overseed
        if (absLat < 23) {
            return {
                isOverseeded: false,
                stage: 'none',
                confidence: 'high',
                notes: 'Tropical latitude - overseeding uncommon'
            };
        }
        
        // Northern hemisphere outside transition zone - no overseed switching
        if (!isSouthern && !isUSTransitionZone) {
            return {
                isOverseeded: false,
                stage: 'none',
                confidence: 'high',
                notes: 'Northern latitude - pure C3 or C4 stand assumed'
            };
        }

        // Southern hemisphere timing (Australia, South Africa)
        if (isSouthern) {
            // April-May: establishment
            if (month >= 4 && month <= 5) {
                return {
                    isOverseeded: true,
                    stage: 'establishing',
                    confidence: 'medium',
                    notes: 'Autumn overseed establishment period'
                };
            }
            // June-August: mature
            if (month >= 6 && month <= 8) {
                return {
                    isOverseeded: true,
                    stage: 'mature',
                    confidence: 'medium',
                    notes: 'Winter - mature overseed period'
                };
            }
            // September-October: transition
            if (month >= 9 && month <= 10) {
                return {
                    isOverseeded: true,
                    stage: 'transitioning',
                    confidence: 'medium',
                    notes: 'Spring transition - critical weakness period'
                };
            }
        }
        
        // US Transition Zone timing
        if (isUSTransitionZone) {
            // October-November: establishment
            if (month >= 10 && month <= 11) {
                return {
                    isOverseeded: true,
                    stage: 'establishing',
                    confidence: 'medium',
                    notes: 'Fall overseed establishment period'
                };
            }
            // December-February: mature
            if (month === 12 || month <= 2) {
                return {
                    isOverseeded: true,
                    stage: 'mature',
                    confidence: 'medium',
                    notes: 'Winter - mature overseed period'
                };
            }
            // March-April: transition
            if (month >= 3 && month <= 4) {
                return {
                    isOverseeded: true,
                    stage: 'transitioning',
                    confidence: 'medium',
                    notes: 'Spring transition - critical weakness period'
                };
            }
        }

        // Default - pure stand (summer)
        return {
            isOverseeded: false,
            stage: 'none',
            confidence: 'medium',
            notes: 'Summer - C4 base species dominant'
        };
    }

    /**
     * Get management notes based on stage and impact
     */
    function getManagementNotes(stage, impactLevel) {
        const notes = [];

        switch (stage) {
            case 'germinating':
                notes.push('Limit all traffic during germination');
                notes.push('Consider temporary closure');
                notes.push('Maintain consistent moisture for establishment');
                break;
            case 'establishing':
                notes.push('Minimise traffic for 2-4 more weeks');
                notes.push('Light training only if essential');
                break;
            case 'transitioning':
                notes.push('Most vulnerable period - minimise all traffic');
                notes.push('Prioritise warm-season recovery over events');
                notes.push('Consider PGR management of ryegrass');
                notes.push('Increase mowing frequency to stress ryegrass');
                break;
            case 'mature':
                if (impactLevel === 'moderate' || impactLevel === 'significant') {
                    notes.push('Overseed provides sacrificial cover but recovery is limited');
                    notes.push('Monitor for divoting into dormant warm-season base');
                }
                break;
        }

        if (impactLevel === 'severe') {
            notes.push('Current conditions severely compromise wear tolerance');
            notes.push('Defer non-essential traffic where possible');
        }

        return notes;
    }

    // ========================================================================
    // INTEGRATION WITH WEAR-RECOVERY ENGINE
    // ========================================================================

    /**
     * Patch into existing wear resistance calculation
     * Call this after the wear engine loads
     */
    function integrateWithWearEngine() {
        // Check if wear engine exists
        if (typeof window.gaip_wear_resistance !== 'function') {
            console.warn('Overseed Multiplier: Wear engine not loaded yet');
            return false;
        }

        // Store original function
        const originalWearResistance = window.gaip_wear_resistance;

        // Override with enhanced version
        window.gaip_wear_resistance = function(state, weather, shadeData) {
            // Call original
            const result = originalWearResistance(state, weather, shadeData);

            // Apply enhanced overseed multiplier if applicable
            const overseedStatus = state.turf?.overseedStatus || 'none';
            if (overseedStatus !== 'none') {
                const variety = state.turf?.variety || '';
                const species = state.turf?.grassSpecies || 'couch';
                const seedingRate = state.turf?.overseedRate;

                const enhanced = calculateOverseedMultiplier(overseedStatus, variety, species, seedingRate);

                // Replace the simple overseed modifier with enhanced version
                const originalOverseedValue = result.modifiers.overseed.value;
                const enhancedValue = enhanced.combinedMultiplier;

                // Adjust the score
                if (originalOverseedValue > 0) {
                    const adjustment = enhancedValue / originalOverseedValue;
                    result.score = Math.max(1, Math.min(10, result.score * adjustment));
                }

                // Update the modifiers object with enhanced data
                result.modifiers.overseed = {
                    value: enhancedValue,
                    status: overseedStatus,
                    enhanced: true,
                    reductionPercent: enhanced.reductionPercent,
                    impactLevel: enhanced.impactLevel,
                    components: enhanced.components,
                    managementNotes: enhanced.managementNotes
                };
            }

            return result;
        };

        return true;
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    window.gaip_overseed_multiplier = calculateOverseedMultiplier;
    window.gaip_overseed_quick = getOverseedMultiplier;
    window.gaip_overseed_detect = detectOverseedStatus;
    window.gaip_overseed_integrate = integrateWithWearEngine;

    // Export constants for UI
    window.GAIP_OVERSEED_STAGES = ENHANCED_OVERSEED_STAGES;
    window.GAIP_OVERSEED_SPECIES_FACTORS = SPECIES_OVERSEED_FACTORS;
    window.GAIP_OVERSEED_RATE_MODIFIERS = SEEDING_RATE_MODIFIERS;

    // Auto-integrate when wear engine is ready
    if (typeof window.gaip_wear_resistance === 'function') {
        integrateWithWearEngine();
    } else {
        // Wait for wear engine to load
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(integrateWithWearEngine, 100);
        });
    }


})();
