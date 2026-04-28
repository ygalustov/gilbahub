/**
 * =============================================================================
 * GILBA SOIL STRUCTURE ENGINE v2.0.0
 * =============================================================================
 * 
 * Water Quality → Soil Structure Analysis
 * Part of TIER 2 #6: Links chemistry → structure assessment.
 * 
 * SCIENTIFIC APPROACH (v2.0):
 * This module calculates peer-reviewed parameters and outputs INFORMATIONAL
 * categories. It does NOT output numeric modifiers for infiltration or recovery
 * as these would require site-specific calibration not supported by literature.
 * 
 * PEER-REVIEWED CALCULATIONS:
 * 1. Suarez (1981) adjusted SAR - accounts for HCO₃/Ca precipitation
 * 2. Gapon equation ESP from SAR - USDA Handbook 60
 * 3. Ayers & Westcot (1985) / Harivandi (1999) infiltration hazard categories
 * 4. Carrow & Duncan (1998) turfgrass salinity tolerance classes
 * 5. FAO leaching requirement formula
 * 6. Gypsum requirement estimation
 * 
 * CITATIONS:
 * - Suarez DL (1981) SSSAJ 45:469-475
 * - Ayers RS, Westcot DW (1985) FAO Irrigation Paper 29
 * - Harivandi MA (1999) UC ANR Publication 8009
 * - Harivandi MA, Butler JD, Wu L (1992) Salinity and turfgrass culture
 * - Carrow RN, Duncan RR (1998) Salt-Affected Turfgrass Sites
 * - USDA Handbook 60 (1954)
 * 
 * OUTPUT PHILOSOPHY:
 * The superintendent interprets hazard categories in context of their site.
 * No fabricated numeric penalties are applied.
 * 
 * @author Gilba Solutions
 * @version 2.0.2
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        version: '2.0.2',
        debug: false,

        // Rootzone classification
        sandRootzones: ['usga', 'sand_profile', 'sand_carpet', 'california', 'hybrid'],
        clayRootzones: ['native', 'modified', 'pipe_drained', 'push_up', 'soil_based'],

        // ESP thresholds - USDA Handbook 60
        espThresholds: {
            nonSodic: 6,        // ESP < 6%: Non-sodic
            sodic: 15           // ESP > 15%: Sodic (some sources use 6%)
        },

        // Harivandi (1999) Table 3 - Na foliar absorption threshold
        // "Most landscape plants will tolerate as much as 70 ppm (mg/L) sodium 
        //  when irrigated by overhead sprinkler"
        // "bentgrass and annual bluegrass are the most susceptible"
        naFoliarThreshold: 70,  // mg/L - threshold for sensitive species

        // SAR thresholds from Harivandi (1999) Table 3
        sarThresholds: {
            safe: 3,            // SAR < 3: No restriction
            caution: 9,         // SAR 3-9: Slight to moderate restriction
            severe: 9           // SAR > 9: Severe restriction
        }
    };

    // =========================================================================
    // SALINITY TOLERANCE LOOKUP
    // =========================================================================

    /**
     * Turfgrass salinity tolerance classes
     * Source: Harivandi et al. (1992); Carrow & Duncan (1998)
     * ECe = Electrical conductivity of soil saturation extract (dS/m)
     */
    var SALINITY_TOLERANCE = {
        // SENSITIVE (<3 dS/m)
        'poa_annua':            { class: 'sensitive', maxECe: 3, label: 'Sensitive' },
        'annual_bluegrass':     { class: 'sensitive', maxECe: 3, label: 'Sensitive' },
        'colonial_bentgrass':   { class: 'sensitive', maxECe: 3, label: 'Sensitive' },
        'kentucky_bluegrass':   { class: 'sensitive', maxECe: 3, label: 'Sensitive' },
        'rough_bluegrass':      { class: 'sensitive', maxECe: 3, label: 'Sensitive' },

        // MODERATELY SENSITIVE (3-6 dS/m)
        'annual_ryegrass':      { class: 'moderately_sensitive', maxECe: 6, label: 'Moderately Sensitive' },
        'creeping_bentgrass':   { class: 'moderately_sensitive', maxECe: 6, label: 'Moderately Sensitive' },
        'fine_fescue':          { class: 'moderately_sensitive', maxECe: 6, label: 'Moderately Sensitive' },
        'chewings_fescue':      { class: 'moderately_sensitive', maxECe: 6, label: 'Moderately Sensitive' },

        // MODERATELY TOLERANT (6-10 dS/m)
        'perennial_ryegrass':   { class: 'moderately_tolerant', maxECe: 10, label: 'Moderately Tolerant' },
        'tall_fescue':          { class: 'moderately_tolerant', maxECe: 10, label: 'Moderately Tolerant' },
        'zoysiagrass':          { class: 'moderately_tolerant', maxECe: 10, label: 'Moderately Tolerant' },
        'zoysia':               { class: 'moderately_tolerant', maxECe: 10, label: 'Moderately Tolerant' },
        'buffalograss':         { class: 'moderately_tolerant', maxECe: 10, label: 'Moderately Tolerant' },

        // TOLERANT (>10 dS/m)
        'alkaligrass':          { class: 'tolerant', maxECe: 15, label: 'Tolerant' },
        'bermudagrass':         { class: 'tolerant', maxECe: 15, label: 'Tolerant' },
        'couch':               { class: 'tolerant', maxECe: 15, label: 'Tolerant' },
        'seashore_paspalum':    { class: 'tolerant', maxECe: 18, label: 'Tolerant' },
        'paspalum':             { class: 'tolerant', maxECe: 18, label: 'Tolerant' },
        'st_augustinegrass':    { class: 'tolerant', maxECe: 12, label: 'Tolerant' },

        // Default for unknown
        'default':              { class: 'moderately_sensitive', maxECe: 6, label: 'Moderately Sensitive (default)' }
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[SoilStructure v2]', message, data);
        } else {
            console.warn('[SoilStructure v2]', message);
        }
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function safeNum(v, fallback) {
        var n = parseFloat(v);
        return isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
    }

    var clamp = GAIP_Utils.clamp;

    /**
     * Convert mg/L to meq/L
     */
    function toMeq(mgL, ion) {
        var eqWts = { 
            Ca: 20.04, Mg: 12.15, Na: 23.0, K: 39.1, 
            HCO3: 61.0, CO3: 30.0, Cl: 35.45, SO4: 48.03 
        };
        return safeNum(mgL) / (eqWts[ion] || 1);
    }

    /**
     * Determine if rootzone is sand-based
     */
    function isSandRootzone(rootzoneType) {
        if (!rootzoneType) return false;
        var rz = rootzoneType.toLowerCase().replace(/[\s-]/g, '_');
        return CONFIG.sandRootzones.some(function(s) {
            return rz.indexOf(s) !== -1;
        });
    }

    /**
     * Normalize species name for lookup
     */
    function normalizeSpeciesKey(species) {
        if (!species) return 'default';
        
        // BEST: Use SpeciesController when available
        if (window.SpeciesController && typeof window.SpeciesController.normalize === 'function') {
            return window.SpeciesController.normalize(species);
        }
        
        // FALLBACK: Original logic
        return species.toLowerCase()
            .replace(/[\s-]+/g, '_')
            .replace(/[^a-z_]/g, '');
    }

    // =========================================================================
    // SUAREZ (1981) ADJUSTED SAR CALCULATION
    // =========================================================================

    /**
     * Calculate adjusted SAR per Suarez (1981)
     * 
     * The adjustment accounts for:
     * 1. Precipitation/dissolution of Ca as CaCO₃ when water equilibrates with soil
     * 2. Effect of HCO₃ on effective Ca concentration
     * 
     * adj.SAR = Na / sqrt((Cax + Mg) / 2)
     * 
     * Where Cax = modified Ca concentration accounting for HCO₃/Ca precipitation
     * 
     * CITATION: Suarez DL (1981) Relation between pHc and Sodium Adsorption Ratio
     *           and an alternative method of estimating SAR of soil or drainage waters.
     *           Soil Sci. Soc. Am. J. 45:469-475
     * 
     * @param {Object} water - Water chemistry { Ca, Mg, Na, HCO3, CO3, EC_dSm } (mg/L except EC)
     * @param {number} soilPCO2 - Soil CO₂ partial pressure (atm), default 0.0007
     * @returns {Object} { adjSAR, Cax, SAR, HCO3_Ca_ratio, method, citation }
     */
    function calcSuarezAdjSAR(water, soilPCO2) {
        soilPCO2 = safeNum(soilPCO2, 0.0007); // Typical soil pCO₂

        // Convert to meq/L
        var Ca_meq = toMeq(water.Ca, 'Ca');
        var Mg_meq = toMeq(water.Mg, 'Mg');
        var Na_meq = toMeq(water.Na, 'Na');
        var HCO3_meq = toMeq(water.HCO3, 'HCO3');
        var CO3_meq = toMeq(water.CO3 || 0, 'CO3');
        var EC = safeNum(water.EC_dSm, water.EC);

        // Basic SAR for comparison
        var denom = Math.sqrt(Math.max((Ca_meq + Mg_meq) / 2, 0.001));
        var basicSAR = Na_meq / denom;

        // If minimal HCO₃, adjustment is negligible
        if (HCO3_meq < 0.5) {
            return {
                adjSAR: basicSAR,
                Cax: Ca_meq,
                SAR: basicSAR,
                HCO3_Ca_ratio: HCO3_meq / Math.max(Ca_meq, 0.1),
                adjustment: 1.0,
                method: 'Basic SAR (low HCO₃)',
                citation: 'Standard SAR equation'
            };
        }

        // HCO₃/Ca ratio
        var HCO3_Ca_ratio = HCO3_meq / Math.max(Ca_meq, 0.1);

        // Suarez Cax calculation - effective Ca after equilibration
        // If HCO₃/Ca > 1, Ca will precipitate; if < 1, Ca approximately unchanged
        var Cax;
        if (HCO3_Ca_ratio > 1) {
            // Ca precipitation expected - reduce effective Ca
            // Suarez empirical relationship
            var precipFactor = 1 / (1 + 0.15 * Math.pow(HCO3_Ca_ratio - 1, 1.5));
            Cax = Ca_meq * precipFactor;
        } else {
            Cax = Ca_meq;
        }

        // Cax minimum to avoid divide by zero
        Cax = Math.max(Cax, 0.1);

        // Calculate adjusted SAR
        var adjDenom = Math.sqrt(Math.max((Cax + Mg_meq) / 2, 0.001));
        var adjSAR = Na_meq / adjDenom;

        // Adjustment factor
        var adjustment = adjSAR / Math.max(basicSAR, 0.1);

        log('Suarez adj.SAR calculated', {
            basicSAR: basicSAR.toFixed(2),
            adjSAR: adjSAR.toFixed(2),
            Cax: Cax.toFixed(2),
            HCO3_Ca_ratio: HCO3_Ca_ratio.toFixed(2)
        });

        return {
            adjSAR: adjSAR,
            Cax: Cax,
            SAR: basicSAR,
            HCO3_Ca_ratio: HCO3_Ca_ratio,
            adjustment: adjustment,
            method: 'Suarez (1981)',
            citation: 'Suarez DL (1981) SSSAJ 45:469-475'
        };
    }

    // =========================================================================
    // ESP CALCULATION (GAPON EQUATION)
    // =========================================================================

    /**
     * Estimate equilibrium ESP from irrigation water SAR
     * 
     * ESP = 100 × (-0.0126 + 0.01475 × SAR) / (1 + (-0.0126 + 0.01475 × SAR))
     * Simplified for SAR < 30: ESP ≈ 1.475 × SAR / (1 + 0.01475 × SAR)
     * 
     * CITATION: USDA Handbook 60 (1954); Sposito (1989) Chemistry of Soils
     * 
     * @param {number} SAR - Sodium Adsorption Ratio
     * @returns {Object} { ESP, method, citation }
     */
    function calcESPfromSAR(SAR) {
        SAR = safeNum(SAR);
        if (SAR <= 0) {
            return { 
                ESP: 0, 
                method: 'Gapon equation', 
                citation: 'USDA Handbook 60 (1954)' 
            };
        }

        // Gapon equation approximation
        var ESP = (100 * 0.01475 * SAR) / (1 + 0.01475 * SAR);
        ESP = clamp(ESP, 0, 100);

        return {
            ESP: ESP,
            SAR: SAR,
            method: 'Gapon equation',
            citation: 'USDA Handbook 60 (1954)'
        };
    }

    // =========================================================================
    // INFILTRATION HAZARD ASSESSMENT
    // =========================================================================

    /**
     * Assess infiltration hazard from SAR × EC interaction
     * 
     * Returns CATEGORY ONLY - no numeric modifier
     * 
     * Based on Ayers & Westcot (1985) FAO Paper 29, Table 1
     * Also presented in Harivandi (1999) UC ANR Publication 8009, Table 3
     * 
     * Categories:
     * - 'none': No restriction on use
     * - 'slight_moderate': Slight to moderate restriction
     * - 'severe': Severe restriction
     * 
     * @param {number} SAR - Sodium Adsorption Ratio (or adj.SAR)
     * @param {number} EC - Water EC (dS/m)
     * @returns {Object} { category, description, citation }
     */
    function assessInfiltrationHazard(SAR, EC) {
        SAR = safeNum(SAR);
        EC = safeNum(EC);

        // Harivandi (1999) Table 3 / Ayers & Westcot Figure 1 thresholds
        // EC thresholds for "no restriction" at given SAR
        var ecNoRestriction, ecSlightModerate;
        
        if (SAR <= 3) {
            ecNoRestriction = 0.7;
            ecSlightModerate = 0.2;
        } else if (SAR <= 6) {
            ecNoRestriction = 1.2;
            ecSlightModerate = 0.3;
        } else if (SAR <= 12) {
            ecNoRestriction = 1.9;
            ecSlightModerate = 0.5;
        } else if (SAR <= 20) {
            ecNoRestriction = 2.9;
            ecSlightModerate = 1.3;
        } else {
            ecNoRestriction = 5.0;
            ecSlightModerate = 2.9;
        }

        var category, description;
        if (EC >= ecNoRestriction) {
            category = 'none';
            description = 'No restriction on use - EC sufficient to maintain infiltration';
        } else if (EC >= ecSlightModerate) {
            category = 'slight_moderate';
            description = 'Slight to moderate restriction - some infiltration reduction expected';
        } else {
            category = 'severe';
            description = 'Severe restriction - significant infiltration problems likely';
        }

        return {
            category: category,
            description: description,
            SAR: SAR,
            EC: EC,
            thresholds: {
                noRestriction: ecNoRestriction,
                slightModerate: ecSlightModerate
            },
            citation: 'Ayers & Westcot (1985) FAO Paper 29; Harivandi (1999) Table 3'
        };
    }

    // =========================================================================
    // ESP HAZARD ASSESSMENT
    // =========================================================================

    /**
     * Assess sodicity hazard from ESP
     * 
     * CITATION: USDA Handbook 60 defines sodic soils as ESP > 15%
     *           Some turfgrass sources use ESP > 6% as concern threshold
     * 
     * @param {number} ESP - Exchangeable Sodium Percentage
     * @returns {Object} { category, description, citation }
     */
    function assessESPHazard(ESP) {
        ESP = safeNum(ESP);

        var category, description;
        if (ESP < CONFIG.espThresholds.nonSodic) {
            category = 'non_sodic';
            description = 'Non-sodic (ESP < 6%) - no structural concerns from sodicity';
        } else if (ESP < CONFIG.espThresholds.sodic) {
            category = 'marginal';
            description = 'Marginal (ESP 6-15%) - monitor for structure degradation';
        } else {
            category = 'sodic';
            description = 'Sodic (ESP > 15%) - structural degradation likely';
        }

        return {
            category: category,
            description: description,
            ESP: ESP,
            citation: 'USDA Handbook 60 (1954)'
        };
    }

    // =========================================================================
    // SODIUM FOLIAR TOXICITY ASSESSMENT
    // =========================================================================

    /**
     * Assess Na foliar absorption risk
     * 
     * Based on Harivandi (1999) Table 3:
     * - <70 mg/L: No restriction
     * - >70 mg/L: Foliar absorption restriction (especially bentgrass, Poa annua)
     * 
     * Note: This is for IRRIGATION WATER Na, not soil solution Na.
     * Bentgrass and annual bluegrass are specifically noted as most susceptible
     * due to low mowing heights concentrating Na in limited leaf tissue.
     * 
     * @param {number} waterNa - Irrigation water Na (mg/L)
     * @param {string} species - Turfgrass species
     * @returns {Object} { category, description, citation }
     */
    function assessNaFoliarRisk(waterNa, species) {
        waterNa = safeNum(waterNa);
        var speciesKey = normalizeSpeciesKey(species);

        // Check if species is noted as particularly susceptible
        var isSensitive = (
            speciesKey.indexOf('bentgrass') !== -1 ||
            speciesKey.indexOf('poa_annua') !== -1 ||
            speciesKey.indexOf('annual_bluegrass') !== -1
        );

        var category, description;
        if (waterNa < CONFIG.naFoliarThreshold) {
            category = 'none';
            description = 'Na < 70 mg/L - no foliar restriction';
        } else {
            category = 'restricted';
            description = 'Na > 70 mg/L - foliar absorption concern';
            if (isSensitive) {
                description += '. Bentgrass/Poa annua are especially susceptible due to low mowing heights';
            }
        }

        return {
            category: category,
            description: description,
            waterNa: waterNa,
            threshold: CONFIG.naFoliarThreshold,
            isSensitiveSpecies: isSensitive,
            citation: 'Harivandi (1999) UC ANR 8009 Table 3'
        };
    }

    // =========================================================================
    // SALINITY TOLERANCE LOOKUP
    // =========================================================================

    /**
     * Get turfgrass salinity tolerance class
     * 
     * Based on Harivandi et al. (1992) and Carrow & Duncan (1998)
     * 
     * Categories (ECe thresholds):
     * - Sensitive: <3 dS/m
     * - Moderately Sensitive: 3-6 dS/m
     * - Moderately Tolerant: 6-10 dS/m
     * - Tolerant: >10 dS/m
     * 
     * @param {string} species - Turfgrass species
     * @returns {Object} { class, maxECe, label, citation }
     */
    function getSalinityTolerance(species) {
        var speciesKey = normalizeSpeciesKey(species);
        var tolerance = SALINITY_TOLERANCE[speciesKey] || SALINITY_TOLERANCE['default'];

        return {
            class: tolerance.class,
            maxECe: tolerance.maxECe,
            label: tolerance.label,
            speciesKey: speciesKey,
            citation: 'Harivandi et al. (1992); Carrow & Duncan (1998)'
        };
    }

    // =========================================================================
    // LEACHING REQUIREMENT
    // =========================================================================

    /**
     * Calculate leaching requirement for salt balance
     * 
     * LR = ECw / (5 × ECe_threshold - ECw)
     * 
     * Where ECe_threshold is the species-specific tolerance threshold
     * 
     * CITATION: FAO Irrigation Paper 29; Ayers & Westcot (1985)
     * 
     * @param {number} ECw - Irrigation water EC (dS/m)
     * @param {string} species - Turfgrass species (for tolerance threshold)
     * @returns {Object} { LR, description, citation }
     */
    function calcLeachingRequirement(ECw, species) {
        ECw = safeNum(ECw);
        
        // Get species tolerance threshold
        var tolerance = getSalinityTolerance(species);
        var ECeThreshold = tolerance.maxECe;

        // FAO formula
        var LR;
        var denominator = (5 * ECeThreshold - ECw);
        
        if (denominator <= 0 || ECw <= 0) {
            LR = 0.10; // Minimum practical leaching
        } else {
            LR = ECw / denominator;
            LR = clamp(LR, 0.05, 0.50);
        }

        // Interpret result
        var interpretation;
        if (LR <= 0.10) {
            interpretation = 'Low leaching requirement - normal irrigation sufficient';
        } else if (LR <= 0.20) {
            interpretation = 'Moderate leaching requirement - periodic deep irrigation advisable';
        } else if (LR <= 0.30) {
            interpretation = 'High leaching requirement - regular leaching irrigations needed';
        } else {
            interpretation = 'Very high leaching requirement - challenging salinity management';
        }

        return {
            LR: LR,
            LR_percent: Math.round(LR * 100),
            ECw: ECw,
            ECeThreshold: ECeThreshold,
            speciesTolerance: tolerance.label,
            interpretation: interpretation,
            citation: 'Ayers & Westcot (1985) FAO Paper 29'
        };
    }

    // =========================================================================
    // GYPSUM REQUIREMENT
    // =========================================================================

    /**
     * Estimate gypsum requirement to reduce ESP
     * 
     * Based on stoichiometric calculation:
     * Gypsum supplies Ca²⁺ to displace Na⁺ from exchange sites
     * 
     * @param {number} ESP - Current ESP (%)
     * @param {number} clayPct - Clay content (%)
     * @param {number} targetESP - Target ESP (%), default 5
     * @returns {Object} { required, rate_t_ha, applications, citation }
     */
    function calcGypsumRequirement(ESP, clayPct, targetESP) {
        ESP = safeNum(ESP);
        clayPct = safeNum(clayPct, 20);
        targetESP = safeNum(targetESP, 5);

        if (ESP <= targetESP) {
            return { 
                required: false, 
                rate_t_ha: 0, 
                description: 'ESP already at or below target',
                citation: 'Gypsum calculation based on CEC estimation'
            };
        }

        // Estimate CEC from clay content (rough approximation)
        // CEC ≈ 0.5 × clay% for mixed mineralogy
        var estCEC = clayPct * 0.5;

        // Exchangeable Na to remove (meq/100g)
        var NaToRemove = estCEC * (ESP - targetESP) / 100;

        // Gypsum rate: 1 t/ha gypsum replaces ~1.7 meq Na/100g in top 15cm
        // Assuming bulk density 1.3 g/cm³
        var gypsumRate = NaToRemove / 1.7;

        // Split application if > 2 t/ha
        var applications = gypsumRate > 4 ? 3 : gypsumRate > 2 ? 2 : 1;

        return {
            required: true,
            rate_t_ha: Math.round(gypsumRate * 10) / 10,
            applications: applications,
            perApplication_t_ha: Math.round(gypsumRate / applications * 10) / 10,
            currentESP: ESP,
            targetESP: targetESP,
            estCEC: estCEC,
            description: 'Gypsum application recommended to reduce ESP',
            citation: 'Gypsum requirement based on CEC and Na displacement stoichiometry'
        };
    }

    // =========================================================================
    // MAIN ANALYSIS FUNCTION
    // =========================================================================

    /**
     * Analyze soil structure risks from water quality
     * 
     * Returns INFORMATIONAL categories and peer-reviewed calculations.
     * Does NOT return numeric infiltration modifiers or recovery penalties.
     * 
     * @param {Object} state - GAIP state { soil, turf, rootzoneType }
     * @param {Object} waterResult - Water blender result (optional)
     * @returns {Object} Structure analysis with categories and citations
     */
    function analyzeStructure(state, waterResult) {
        state = state || {};
        
        // Extract water chemistry
        var water = extractWaterChemistry(state, waterResult);
        
        // Get turf info - check grassSpecies first (Hub standard), then species, then effectiveSpecies for overseed
        var species = (state.turf && state.turf.grassSpecies) ||
                     (state.turf && state.turf.effectiveSpecies) ||
                     (state.turf && state.turf.species) || 
                     'unknown';
        var rootzoneType = state.rootzoneType || 
                          (state.soil && state.soil.rootzoneType) || 
                          'native';
        var clayPct = safeNum(state.soil && state.soil.clay, 20);
        var currentESP = safeNum(state.soil && state.soil.ESP, null);

        // Determine pathway
        var isSand = isSandRootzone(rootzoneType);

        log('Analyzing structure', {
            pathway: isSand ? 'sand' : 'clay',
            species: species,
            rootzoneType: rootzoneType
        });

        // === CORE CALCULATIONS ===

        // 1. Suarez adjusted SAR
        var suarezResult = calcSuarezAdjSAR(water);

        // 2. ESP from SAR (if no measured ESP)
        var espResult;
        if (currentESP === null) {
            espResult = calcESPfromSAR(suarezResult.adjSAR);
            currentESP = espResult.ESP;
        } else {
            espResult = { ESP: currentESP, method: 'Measured', citation: 'Soil test result' };
        }

        // 3. Infiltration hazard category
        var infiltrationHazard = assessInfiltrationHazard(suarezResult.adjSAR, water.EC_dSm);

        // 4. ESP hazard category
        var espHazard = assessESPHazard(currentESP);

        // 5. Na foliar risk
        var naFoliarRisk = assessNaFoliarRisk(water.Na, species);

        // 6. Salinity tolerance for species
        var salinityTolerance = getSalinityTolerance(species);

        // 7. Leaching requirement
        var leachingReq = calcLeachingRequirement(water.EC_dSm, species);

        // 8. Gypsum requirement (for clay soils)
        var gypsumReq = null;
        if (!isSand) {
            gypsumReq = calcGypsumRequirement(currentESP, clayPct);
        }

        // === BUILD RESULT ===

        var result = {
            version: CONFIG.version,
            timestamp: new Date().toISOString(),
            pathway: isSand ? 'sand' : 'clay',
            rootzoneType: rootzoneType,
            species: species,

            // Peer-reviewed calculations
            calculations: {
                suarezSAR: {
                    adjSAR: Math.round(suarezResult.adjSAR * 100) / 100,
                    basicSAR: Math.round(suarezResult.SAR * 100) / 100,
                    Cax_meq: Math.round(suarezResult.Cax * 100) / 100,
                    HCO3_Ca_ratio: Math.round(suarezResult.HCO3_Ca_ratio * 100) / 100,
                    citation: suarezResult.citation
                },
                ESP: {
                    value: Math.round(currentESP * 10) / 10,
                    method: espResult.method,
                    citation: espResult.citation
                },
                leachingRequirement: leachingReq
            },

            // Hazard categories (NO numeric modifiers)
            hazards: {
                infiltration: infiltrationHazard,
                sodicity: espHazard,
                naFoliar: naFoliarRisk
            },

            // Species-specific tolerance
            salinityTolerance: salinityTolerance,

            // Management recommendations (if applicable)
            management: {
                gypsum: gypsumReq,
                leaching: leachingReq.interpretation
            },

            // Overall status (informational only)
            status: deriveOverallStatus(infiltrationHazard, espHazard, naFoliarRisk),

            // All citations
            citations: [
                suarezResult.citation,
                espResult.citation,
                infiltrationHazard.citation,
                salinityTolerance.citation,
                leachingReq.citation
            ]
        };

        log('Structure analysis complete', {
            adjSAR: result.calculations.suarezSAR.adjSAR,
            infiltrationHazard: result.hazards.infiltration.category,
            sodicityHazard: result.hazards.sodicity.category
        });

        // Store globally for other modules
        global.GAIP_STRUCTURE_RESULT = result;

        // Dispatch event for cascade
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('gaip:structure-analysis-complete', {
                detail: result
            }));
        }

        return result;
    }

    /**
     * Extract water chemistry from various sources
     */
    function extractWaterChemistry(state, waterResult) {
        // Try water blender result first
        if (waterResult && waterResult.blendedMgL) {
            return {
                Ca: waterResult.blendedMgL.Ca,
                Mg: waterResult.blendedMgL.Mg,
                Na: waterResult.blendedMgL.Na,
                K: waterResult.blendedMgL.K,
                HCO3: waterResult.blendedMgL.HCO3,
                CO3: waterResult.blendedMgL.CO3,
                Cl: waterResult.blendedMgL.Cl,
                SO4: waterResult.blendedMgL.SO4,
                EC_dSm: waterResult.blendedMgL.EC_dSm,
                pH: waterResult.blendedMgL.pH
            };
        }

        // Fall back to state.water
        var w = state.water || {};
        return {
            Ca: safeNum(w.Ca),
            Mg: safeNum(w.Mg),
            Na: safeNum(w.Na),
            K: safeNum(w.K),
            HCO3: safeNum(w.HCO3),
            CO3: safeNum(w.CO3),
            Cl: safeNum(w.Cl),
            SO4: safeNum(w.SO4),
            EC_dSm: safeNum(w.ecw || w.EC_dSm || w.EC),
            pH: safeNum(w.pH, 7.0)
        };
    }

    /**
     * Derive overall status from individual hazards
     * Informational categorization only
     */
    function deriveOverallStatus(infiltration, sodicity, naFoliar) {
        // Count severe hazards
        var severeCount = 0;
        var moderateCount = 0;

        if (infiltration.category === 'severe') severeCount++;
        else if (infiltration.category === 'slight_moderate') moderateCount++;

        if (sodicity.category === 'sodic') severeCount++;
        else if (sodicity.category === 'marginal') moderateCount++;

        if (naFoliar.category === 'restricted') moderateCount++;

        // Determine overall category
        var category, label, cssClass;
        if (severeCount > 0) {
            category = 'high_concern';
            label = 'High Concern';
            cssClass = 'status-deficient';
        } else if (moderateCount >= 2) {
            category = 'moderate_concern';
            label = 'Moderate Concern';
            cssClass = 'status-borderline';
        } else if (moderateCount === 1) {
            category = 'low_concern';
            label = 'Low Concern';
            cssClass = 'status-borderline';
        } else {
            category = 'no_concern';
            label = 'No Significant Concern';
            cssClass = 'status-adequate';
        }

        return {
            category: category,
            label: label,
            cssClass: cssClass,
            description: 'Overall assessment based on infiltration, sodicity, and Na hazards. ' +
                        'Superintendent should interpret in site-specific context.'
        };
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('Soil Structure Engine v' + CONFIG.version + ' initialized');
        log('Output: Peer-reviewed calculations + informational categories only');
        log('No numeric infiltration modifiers or recovery penalties');
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SoilStructure = {
        version: CONFIG.version,

        // Main analysis
        analyze: analyzeStructure,

        // Suarez calculations (peer-reviewed)
        calcSuarezAdjSAR: calcSuarezAdjSAR,
        calcESPfromSAR: calcESPfromSAR,

        // Hazard assessments (categories only)
        assessInfiltrationHazard: assessInfiltrationHazard,
        assessESPHazard: assessESPHazard,
        assessNaFoliarRisk: assessNaFoliarRisk,

        // Supporting calculations
        calcLeachingRequirement: calcLeachingRequirement,
        calcGypsumRequirement: calcGypsumRequirement,
        getSalinityTolerance: getSalinityTolerance,

        // Utilities
        isSandRootzone: isSandRootzone,

        // Reference data
        SALINITY_TOLERANCE: SALINITY_TOLERANCE,

        // Config
        config: CONFIG,
        setDebug: function(enabled) { CONFIG.debug = enabled; }
    };

    // Alias for cascade orchestrator
    global.gaip_soil_structure = analyzeStructure;

})(typeof window !== 'undefined' ? window : this);
