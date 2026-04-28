/**
 * =============================================================================
 * GILBA DLI-RECOVERY BRIDGE v1.0.0
 * =============================================================================
 * 
 * Connects Shade Engine DLI output → Wear Recovery Engine
 * 
 * PURPOSE:
 * The shade engine calculates DLI deficit. The wear-recovery engine needs to
 * know how that deficit affects recovery rate. This bridge:
 * 
 * 1. Takes shade engine output (dliShaded, species thresholds)
 * 2. Calculates species-appropriate recovery modifier
 * 3. Exposes structured data for wear-recovery integration
 * 
 * SCIENTIFIC BASIS:
 * - Below species DLI minimum: Recovery severely compromised (photosynthesis insufficient)
 * - Between min and target: Recovery impaired (suboptimal carbohydrate reserves)
 * - At/above target: Full recovery capacity
 * - At optimal: Enhanced recovery (surplus energy available)
 * 
 * References:
 * - Wherley et al. (2005) - Shade tolerance and recovery in warm-season grasses
 * - Trappe et al. (2011) - DLI effects on bermudagrass recovery
 * - Bunnell et al. (2005) - Light requirements for turf quality
 * - Bell & Danneberger (1999) - Shade effects on turfgrass physiology
 * 
 * @requires shade-engine.js (for DLI calculations)
 * @provides GSSH_DLI_Recovery.calculate(shadeResult, species) → recoveryModifier
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';

    /* =========================================================================
       SPECIES DLI THRESHOLDS
       Copied from shade-engine.js — canonical source is shade-engine.js:96
       If shade-engine values change, update this copy to match.
    ========================================================================= */

    var SPECIES_DLI = {
        // C3 grasses - lower light requirements
        'poa':              { min: 7,  target: 14, optimal: 20 },
        'browntopBent':     { min: 9,  target: 16, optimal: 22 },
        'colonialBentgrass':{ min: 9,  target: 16, optimal: 22 },
        'PRG':              { min: 9,  target: 16, optimal: 24 },
        'ryegrass':         { min: 9,  target: 16, optimal: 24 },
        'bentgrass':        { min: 11, target: 20, optimal: 27 },
        'creepingBentgrass':{ min: 11, target: 20, optimal: 27 },
        'fescue':           { min: 10, target: 16, optimal: 22 },
        'TFescue':          { min: 10, target: 16, optimal: 22 },
        
        // C4 grasses - higher light requirements
        'buffalo':          { min: 13, target: 22, optimal: 28 },
        'staugustine':      { min: 13, target: 22, optimal: 28 },
        'zoysia':           { min: 16, target: 24, optimal: 31 },
        'couch':            { min: 16, target: 26, optimal: 35 },
        'bermuda':          { min: 16, target: 26, optimal: 35 },
        'kikuyu':           { min: 17, target: 26, optimal: 36 },
        'paspalum':         { min: 15, target: 24, optimal: 32 },
        
        'default':          { min: 12, target: 20, optimal: 26 }
    };

    /* =========================================================================
       RECOVERY MODIFIER CURVES
       
       Research-based recovery rate modifiers based on DLI relative to thresholds
       
       Key points:
       - Critical (<50% of min): Recovery essentially stops (2.5× base time)
       - Severe (50-75% of min): Severely impaired (2.0× base time)
       - Poor (75-100% of min): Significantly impaired (1.5× base time)
       - Marginal (min to target): Moderately impaired (1.1-1.3× base time)
       - Adequate (target to optimal): Normal recovery (1.0× base time)
       - Optimal (>optimal): Enhanced recovery (0.9× base time)
    ========================================================================= */

    var RECOVERY_MODIFIERS = {
        critical: {
            threshold: 0.50,  // <50% of minimum DLI
            factor: 2.5,
            label: 'Critical - Recovery Halted',
            severity: 'critical',
            colour: '#dc2626'
        },
        severe: {
            threshold: 0.75,  // 50-75% of minimum DLI
            factor: 2.0,
            label: 'Severe - Recovery Severely Impaired',
            severity: 'critical',
            colour: '#ea580c'
        },
        poor: {
            threshold: 1.00,  // 75-100% of minimum DLI
            factor: 1.5,
            label: 'Poor - Recovery Significantly Impaired',
            severity: 'concern',
            colour: '#f59e0b'
        },
        marginal: {
            threshold: 'target', // min to target
            factor: 1.25,
            label: 'Marginal - Recovery Moderately Impaired',
            severity: 'watch',
            colour: '#eab308'
        },
        adequate: {
            threshold: 'optimal', // target to optimal
            factor: 1.0,
            label: 'Adequate - Normal Recovery',
            severity: 'good',
            colour: '#22c55e'
        },
        optimal: {
            threshold: null, // above optimal
            factor: 0.9,
            label: 'Optimal - Enhanced Recovery',
            severity: 'good',
            colour: '#16a34a'
        }
    };

    /* =========================================================================
       UTILITY FUNCTIONS
    ========================================================================= */

    var clamp = (window.GAIP_Utils || window.GSSH_Utils).clamp;

    function normaliseSpeciesKey(species) {
        if (!species) return 'default';
        var s = (species + '').toLowerCase().replace(/\s+/g, '');
        
        if (s.indexOf('rye') >= 0) return 'ryegrass';
        if (s.indexOf('browntop') >= 0 || s.indexOf('colonial') >= 0) return 'browntopBent';
        if (s.indexOf('bent') >= 0) return 'bentgrass';
        if (s.indexOf('couch') >= 0 || s.indexOf('bermuda') >= 0) return 'couch';
        if (s.indexOf('kikuyu') >= 0) return 'kikuyu';
        if (s.indexOf('zoysia') >= 0) return 'zoysia';
        if (s.indexOf('buffalo') >= 0 || s.indexOf('augustine') >= 0) return 'buffalo';
        if (s.indexOf('fescue') >= 0) return 'fescue';
        if (s.indexOf('poa') >= 0) return 'poa';
        if (s.indexOf('paspalum') >= 0) return 'paspalum';
        
        return SPECIES_DLI[s] ? s : 'default';
    }

    function isC4Species(speciesKey) {
        return ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'staugustine', 'paspalum'].indexOf(speciesKey) >= 0;
    }

    /* =========================================================================
       CORE CALCULATION FUNCTIONS
    ========================================================================= */

    /**
     * Calculate recovery modifier based on DLI relative to species thresholds
     * 
     * @param {number} dliActual - Actual DLI received (mol/m²/day)
     * @param {object} thresholds - Species thresholds { min, target, optimal }
     * @returns {object} Recovery modifier data
     */
    function calculateRecoveryModifier(dliActual, thresholds) {
        var min = thresholds.min;
        var target = thresholds.target;
        var optimal = thresholds.optimal;
        
        // Calculate ratio to minimum
        var ratioToMin = dliActual / min;
        
        // Determine category and calculate factor
        var category, factor, interpolated;
        
        if (ratioToMin < 0.50) {
            // Critical: <50% of minimum
            category = RECOVERY_MODIFIERS.critical;
            factor = category.factor;
            interpolated = false;
        }
        else if (ratioToMin < 0.75) {
            // Severe: 50-75% of minimum - interpolate between critical and severe
            category = RECOVERY_MODIFIERS.severe;
            var t = (ratioToMin - 0.50) / 0.25; // 0 at 50%, 1 at 75%
            factor = RECOVERY_MODIFIERS.critical.factor - t * (RECOVERY_MODIFIERS.critical.factor - RECOVERY_MODIFIERS.severe.factor);
            interpolated = true;
        }
        else if (ratioToMin < 1.00) {
            // Poor: 75-100% of minimum - interpolate between severe and poor
            category = RECOVERY_MODIFIERS.poor;
            var t = (ratioToMin - 0.75) / 0.25; // 0 at 75%, 1 at 100%
            factor = RECOVERY_MODIFIERS.severe.factor - t * (RECOVERY_MODIFIERS.severe.factor - RECOVERY_MODIFIERS.poor.factor);
            interpolated = true;
        }
        else if (dliActual < target) {
            // Marginal: min to target - interpolate between poor and marginal
            category = RECOVERY_MODIFIERS.marginal;
            var t = (dliActual - min) / (target - min); // 0 at min, 1 at target
            factor = RECOVERY_MODIFIERS.poor.factor - t * (RECOVERY_MODIFIERS.poor.factor - RECOVERY_MODIFIERS.marginal.factor);
            interpolated = true;
        }
        else if (dliActual < optimal) {
            // Adequate: target to optimal - interpolate between marginal and adequate
            category = RECOVERY_MODIFIERS.adequate;
            var t = (dliActual - target) / (optimal - target); // 0 at target, 1 at optimal
            factor = RECOVERY_MODIFIERS.marginal.factor - t * (RECOVERY_MODIFIERS.marginal.factor - RECOVERY_MODIFIERS.adequate.factor);
            interpolated = true;
        }
        else {
            // Optimal: above optimal DLI
            category = RECOVERY_MODIFIERS.optimal;
            factor = category.factor;
            interpolated = false;
        }
        
        // Calculate percentage impact
        var impactPct = Math.round((factor - 1) * 100);
        
        return {
            factor: +factor.toFixed(3),
            category: category.label,
            severity: category.severity,
            colour: category.colour,
            impactPct: impactPct,
            impactDescription: impactPct > 0 
                ? '+' + impactPct + '% recovery time'
                : impactPct + '% recovery time (faster)',
            interpolated: interpolated,
            
            // Raw metrics for debugging/display
            dliActual: dliActual,
            dliMin: min,
            dliTarget: target,
            dliOptimal: optimal,
            ratioToMin: +ratioToMin.toFixed(2),
            deficitFromTarget: +(target - dliActual).toFixed(1),
            deficitPctFromTarget: +((1 - dliActual / target) * 100).toFixed(1)
        };
    }

    /**
     * Calculate stress factor for wear resistance (0-1 scale)
     * This feeds into the existing wear-recovery engine's stressFactor pathway
     * 
     * @param {number} dliActual - Actual DLI received
     * @param {object} thresholds - Species thresholds
     * @returns {number} Stress factor 0-1 (0 = no stress, 1 = maximum stress)
     */
    function calculateStressFactor(dliActual, thresholds) {
        var min = thresholds.min;
        var target = thresholds.target;
        
        if (dliActual >= target) {
            return 0; // No stress at or above target
        }
        
        if (dliActual <= 0) {
            return 1; // Maximum stress at zero light
        }
        
        // Linear interpolation from 0 (at target) to 1 (at 0 DLI)
        // But with acceleration below minimum
        if (dliActual >= min) {
            // Between min and target: 0 to 0.35 stress
            return 0.35 * (1 - (dliActual - min) / (target - min));
        } else {
            // Below minimum: 0.35 to 1.0 stress (accelerating)
            var ratio = dliActual / min;
            return 0.35 + 0.65 * (1 - ratio);
        }
    }

    /* =========================================================================
       MAIN BRIDGE FUNCTION
    ========================================================================= */

    /**
     * Main bridge calculation - connects shade engine output to recovery modifiers
     * 
     * @param {object} shadeResult - Output from gssh_shade_engine() or GSSH_Shade.engine()
     * @param {object} state - Full state object (for species if not in shadeResult)
     * @returns {object} DLI recovery data for wear-recovery engine
     */
    function calculate(shadeResult, state) {
        // Handle missing shade data
        if (!shadeResult) {
            return {
                available: false,
                reason: 'No shade analysis available',
                factor: 1.0,
                stressFactor: 0,
                category: 'Unknown',
                severity: 'unknown'
            };
        }
        
        // Extract DLI value - try multiple paths
        var dliActual = null;
        
        // Path 1: Direct from modular shade engine
        if (typeof shadeResult.dliShaded === 'number') {
            dliActual = shadeResult.dliShaded;
        }
        // Path 2: From DLI_total (hub rendering format)
        else if (typeof shadeResult.DLI_total === 'number') {
            dliActual = shadeResult.DLI_total;
        }
        // Path 3: From DLI_adj + DLI_led
        else if (typeof shadeResult.DLI_adj === 'number') {
            dliActual = shadeResult.DLI_adj + (shadeResult.DLI_led || 0);
        }
        // Path 4: Direct dli property
        else if (typeof shadeResult.dli === 'number') {
            dliActual = shadeResult.dli;
        }
        
        if (dliActual === null || !isFinite(dliActual)) {
            return {
                available: false,
                reason: 'DLI value not found in shade result',
                factor: 1.0,
                stressFactor: 0,
                category: 'Unknown',
                severity: 'unknown'
            };
        }
        
        // Get species thresholds
        var speciesKey = shadeResult.species || 
                        normaliseSpeciesKey(state?.turf?.grassSpecies) ||
                        normaliseSpeciesKey(state?.turf?.species) ||
                        'default';
        
        // Check for modular shade engine thresholds first (most accurate)
        var thresholds;
        if (shadeResult.dliMin && shadeResult.dliTarget && shadeResult.dliOptimal) {
            thresholds = {
                min: shadeResult.dliMin,
                target: shadeResult.dliTarget,
                optimal: shadeResult.dliOptimal
            };
        } else {
            thresholds = SPECIES_DLI[speciesKey] || SPECIES_DLI['default'];
        }
        
        // Calculate recovery modifier
        var recoveryMod = calculateRecoveryModifier(dliActual, thresholds);
        
        // Calculate stress factor for wear resistance
        var stressFactor = calculateStressFactor(dliActual, thresholds);
        
        // Build enhanced shade data object for wear-recovery engine
        return {
            available: true,
            
            // Primary outputs for wear-recovery
            factor: recoveryMod.factor,
            stressFactor: +stressFactor.toFixed(3),
            
            // Category info
            category: recoveryMod.category,
            severity: recoveryMod.severity,
            colour: recoveryMod.colour,
            
            // Impact summary
            impactPct: recoveryMod.impactPct,
            impactDescription: recoveryMod.impactDescription,
            
            // DLI metrics
            dliActual: +dliActual.toFixed(1),
            dliMin: thresholds.min,
            dliTarget: thresholds.target,
            dliOptimal: thresholds.optimal,
            ratioToMin: recoveryMod.ratioToMin,
            deficitFromTarget: recoveryMod.deficitFromTarget,
            deficitPct: recoveryMod.deficitPctFromTarget,
            
            // Species context
            species: speciesKey,
            isC4: isC4Species(speciesKey),
            
            // LED requirement (if below target)
            ledRequired: dliActual < thresholds.target,
            ledDeficitMol: dliActual < thresholds.target 
                ? +(thresholds.target - dliActual).toFixed(1) 
                : 0,
            
            // Source tracking
            source: 'dli-recovery-bridge',
            version: VERSION
        };
    }

    /**
     * Quick helper to get just the recovery factor
     * @param {object} shadeResult - Shade engine output
     * @param {string} species - Species key (optional)
     * @returns {number} Recovery time multiplier (1.0 = normal, >1 = slower)
     */
    function getRecoveryFactor(shadeResult, species) {
        var result = calculate(shadeResult, { turf: { species: species } });
        return result.factor || 1.0;
    }

    /**
     * Quick helper to get stress factor for wear resistance
     * @param {object} shadeResult - Shade engine output
     * @param {string} species - Species key (optional)
     * @returns {number} Stress factor 0-1
     */
    function getStressFactor(shadeResult, species) {
        var result = calculate(shadeResult, { turf: { species: species } });
        return result.stressFactor || 0;
    }

    /* =========================================================================
       WEAR-RECOVERY ENGINE INTEGRATION HELPER
    ========================================================================= */

    /**
     * Wrapper to enhance shadeData before passing to wear-recovery engine
     * Call this in the hub before calling gssh_wear_recovery_engine()
     * 
     * @param {object} shadeResult - Raw shade engine output
     * @param {object} state - Full state object
     * @returns {object} Enhanced shade data with DLI recovery modifiers
     */
    function enhanceShadeData(shadeResult, state) {
        var dliRecovery = calculate(shadeResult, state);
        
        // Return merged object that works with existing wear-recovery paths
        return {
            // Original shade data (spread if exists)
            ...(shadeResult || {}),
            
            // DLI recovery bridge additions
            dliRecovery: dliRecovery,
            
            // Override stressFactor with DLI-aware value
            stressFactor: dliRecovery.stressFactor,
            
            // Add recovery modifier for direct use
            recoveryModifier: dliRecovery.factor,
            
            // Flag indicating bridge is active
            dliRecoveryBridgeActive: true
        };
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */

    var GSSH_DLI_Recovery = {
        VERSION: VERSION,
        
        // Main calculation
        calculate: calculate,
        
        // Quick helpers
        getRecoveryFactor: getRecoveryFactor,
        getStressFactor: getStressFactor,
        
        // Integration helper
        enhanceShadeData: enhanceShadeData,
        
        // Constants (for testing/reference)
        SPECIES_DLI: SPECIES_DLI,
        RECOVERY_MODIFIERS: RECOVERY_MODIFIERS
    };

    // Export to global
    global.GSSH_DLI_Recovery = GSSH_DLI_Recovery;
    
    // Also expose on GAIP namespace if exists
    if (global.GAIP) {
        global.GAIP.DLI_Recovery = GSSH_DLI_Recovery;
    }


})(typeof window !== 'undefined' ? window : this);
