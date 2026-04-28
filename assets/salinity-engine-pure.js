/**
 * =============================================================================
 * GILBA SALINITY ENGINE (Pure) v2.0.0
 * =============================================================================
 * 
 * Pure function salinity assessment engine.
 * No window/DOM/global reads - all state passed via input object.
 * 
 * Combines:
 *   - Maas-Hoffman (1977) threshold-slope yield model
 *   - Soil ECe rootzone salinity (worst-of water/soil)
 *   - Temperature-dependent tolerance shift (Carrow & Duncan 1998)
 *   - Compound heat×salinity stress (Mittler 2006; Munns & Tester 2008)
 *   - ET-driven salt concentration adjustment
 *   - Leaching requirement (climate-adjusted)
 *   - Fertiliser timing guidance
 *   - Water blending analysis
 * 
 * Scientific Basis:
 *   - Maas & Hoffman (1977) - Crop salt tolerance, current assessment
 *   - FAO Irrigation and Drainage Paper 29 Rev 1
 *   - Harivandi et al. (1992) - Turfgrass salinity tolerance
 *   - Carrow & Duncan (1998) - Salt-affected turfgrass sites
 *   - Marcum (2006) - Warm-season grass salinity tolerance
 *   - Mittler (2006) - Abiotic stress combinations
 *   - Munns & Tester (2008) - Salinity tolerance mechanisms
 * 
 * Input contract (all fields optional except ecw):
 *   {
 *     ecw:            number,   // Irrigation water EC (dS/m) - REQUIRED
 *     soilECe:        number,   // Soil saturated paste EC (dS/m)
 *     soilEC1_5:      number,   // Measured 1:5 extract EC (dS/m)
 *     soilTexture:    string,   // e.g. 'loam', 'sand', 'clay'
 *     species:        string,   // Turf species name (human-readable)
 *     speciesKey:     string,   // Normalised species key (from canonical state)
 *     grassType:      string,   // 'C3' or 'C4'
 *     c3Fraction:     number,   // 0-1
 *     c4Fraction:     number,   // 0-1
 *     temperature:    number,   // Current air temperature (°C) - enables climate adjustment
 *     et0:            number,   // Reference ET (mm/day) - optional, overrides temp-based estimate
 *     irrigationMM:   number,   // Daily irrigation depth (mm) - for accumulation calc
 *   }
 * 
 * Output: Full salinity assessment object (see analyse() return)
 * 
 * =============================================================================
 */

(function(root) {
    'use strict';

    // =========================================================================
    // SPECIES TOLERANCE DATABASE
    // Maas-Hoffman thresholds and slopes for turfgrass species
    // =========================================================================

    const SPECIES_TOLERANCE = {
        // Highly tolerant (> 8 dS/m threshold)
        seashore_paspalum: {
            thresholdECw: 12.0, slope: 4.0,
            toleranceClass: 'excellent', isC4: true,
            notes: 'Most salt-tolerant turfgrass; can use seawater blends'
        },

        // Tolerant (4-8 dS/m threshold)
        bermudagrass: {
            thresholdECw: 6.0, slope: 5.0,
            toleranceClass: 'good', isC4: true,
            notes: 'Good salt tolerance - common sports turf choice'
        },
        couch: {
            thresholdECw: 5.5, slope: 5.5,
            toleranceClass: 'good', isC4: true,
            notes: 'Good salinity tolerance'
        },
        zoysiagrass: {
            thresholdECw: 4.5, slope: 6.0,
            toleranceClass: 'good', isC4: true,
            notes: 'Moderate-good tolerance; japonica types vary'
        },
        kikuyu: {
            thresholdECw: 4.0, slope: 6.5,
            toleranceClass: 'moderate', isC4: true,
            notes: 'Moderate tolerance - common in Australia'
        },
        buffalo: {
            thresholdECw: 5.0, slope: 5.5,
            toleranceClass: 'good', isC4: true,
            notes: 'Good tolerance and low water use'
        },
        tall_fescue: {
            thresholdECw: 4.0, slope: 6.0,
            toleranceClass: 'moderate', isC4: false,
            notes: 'Most salt-tolerant cool-season grass'
        },
        fine_fescue: {
            thresholdECw: 1.5, slope: 9.0,
            toleranceClass: 'sensitive', isC4: false,
            notes: 'Chewings, creeping red, hard fescue - lower salt tolerance than tall fescue'
        },

        // Moderately tolerant (2-4 dS/m threshold)
        perennial_ryegrass: {
            thresholdECw: 3.5, slope: 7.5,
            toleranceClass: 'moderate', isC4: false,
            notes: 'Moderate tolerance; commonly used for overseed'
        },
        kentucky_bluegrass: {
            thresholdECw: 2.5, slope: 9.0,
            toleranceClass: 'low', isC4: false,
            notes: 'Poor salt tolerance - avoid saline irrigation'
        },
        bentgrass: {
            thresholdECw: 3.0, slope: 8.0,
            toleranceClass: 'moderate', isC4: false,
            notes: 'Putting greens - moderate tolerance, leaching critical'
        },

        // Sensitive (< 2 dS/m threshold)
        annual_bluegrass: {
            thresholdECw: 2.0, slope: 10.0,
            toleranceClass: 'poor', isC4: false,
            notes: 'Poa annua - salt sensitive, first to show damage'
        },

        // Generic fallback
        generic: {
            thresholdECw: 4.0, slope: 6.0,
            toleranceClass: 'moderate', isC4: false,
            notes: 'Default moderate tolerance assumed'
        }
    };

    const SPECIES_DISPLAY_NAMES = {
        'seashore_paspalum': 'Seashore Paspalum',
        'bermudagrass': 'Bermudagrass',
        'couch': 'Couch',
        'kikuyu': 'Kikuyu',
        'zoysiagrass': 'Zoysiagrass',
        'buffalo': 'Buffalo Grass',
        'tall_fescue': 'Tall Fescue',
        'fine_fescue': 'Fine Fescue',
        'perennial_ryegrass': 'Perennial Ryegrass',
        'kentucky_bluegrass': 'Kentucky Bluegrass',
        'bentgrass': 'Bentgrass',
        'annual_bluegrass': 'Poa annua',
        'generic': 'Turfgrass'
    };

    const TOLERANCE_CLASSES = {
        excellent: { label: 'Excellent', ecwRange: '> 8 dS/m',  description: 'Can tolerate seawater blends and highly saline recycled water' },
        good:      { label: 'Good',      ecwRange: '4-8 dS/m',  description: 'Suitable for moderately saline recycled water' },
        moderate:  { label: 'Moderate',  ecwRange: '2-4 dS/m',  description: 'Some tolerance; may require leaching and amendments' },
        low:       { label: 'Low',       ecwRange: '1-2 dS/m',  description: 'Limited tolerance; avoid saline sources if possible' },
        poor:      { label: 'Poor',      ecwRange: '< 1 dS/m',  description: 'Salt sensitive; use only high-quality irrigation water' },
        sensitive: { label: 'Sensitive', ecwRange: '1-2 dS/m',  description: 'Salt sensitive; requires high-quality water and active leaching' }
    };

    // =========================================================================
    // TEMPERATURE-SALINITY INTERACTION COEFFICIENTS
    // Carrow & Duncan (1998)
    // Coefficient > 1 = more tolerant, < 1 = less tolerant
    // =========================================================================

    const TEMP_SALINITY_MODIFIERS = {
        C3: [
            { maxTemp: 10, modifier: 1.15, note: 'Cool conditions - enhanced tolerance' },
            { maxTemp: 15, modifier: 1.10, note: 'Optimal cool-season temps' },
            { maxTemp: 22, modifier: 1.00, note: 'Reference conditions' },
            { maxTemp: 26, modifier: 0.90, note: 'Mild heat - reduced tolerance' },
            { maxTemp: 30, modifier: 0.75, note: 'Heat stress - significantly reduced tolerance' },
            { maxTemp: 35, modifier: 0.55, note: 'Severe heat - salinity damage accelerated' },
            { maxTemp: Infinity, modifier: 0.40, note: 'Critical heat - minimal salinity tolerance' }
        ],
        C4: [
            { maxTemp: 15, modifier: 0.85, note: 'Cool stress - reduced tolerance' },
            { maxTemp: 20, modifier: 0.95, note: 'Sub-optimal temps' },
            { maxTemp: 30, modifier: 1.00, note: 'Reference conditions' },
            { maxTemp: 35, modifier: 0.90, note: 'Mild heat - slight reduction' },
            { maxTemp: 40, modifier: 0.75, note: 'Heat stress - reduced tolerance' },
            { maxTemp: Infinity, modifier: 0.60, note: 'Extreme heat - significantly compromised' }
        ]
    };

    // ET reference for salt concentration estimation
    const ET_REFERENCE_MM = 5.0; // mm/day at ~25°C moderate conditions
    const ET_TEMP_MULTIPLIERS = [
        { maxTemp: 10, multiplier: 0.4 },
        { maxTemp: 15, multiplier: 0.6 },
        { maxTemp: 20, multiplier: 0.8 },
        { maxTemp: 25, multiplier: 1.0 },
        { maxTemp: 30, multiplier: 1.3 },
        { maxTemp: 35, multiplier: 1.6 },
        { maxTemp: 40, multiplier: 1.9 },
        { maxTemp: Infinity, multiplier: 2.2 }
    ];

    // Compound stress config (Mittler 2006)
    const COMPOUND_INTERACTION_FACTOR = 1.25; // 25% synergistic penalty
    const NEGLIGIBLE_STRESS = 0.05;

    // =========================================================================
    // SPECIES RESOLUTION
    // =========================================================================

    /**
     * Resolve species key from input.
     * Accepts either a normalised key (e.g. 'perennial_ryegrass') or
     * a human-readable string (e.g. 'Perennial Ryegrass (Fairway)').
     */
    function resolveSpeciesKey(input) {
        if (!input) return 'generic';

        // If it's already a valid key, use it
        const asKey = String(input).toLowerCase().replace(/[\s-]+/g, '_');
        if (SPECIES_TOLERANCE[asKey]) return asKey;

        // Fuzzy match from display string
        const s = String(input).toLowerCase();
        if (s.includes('paspalum'))                            return 'seashore_paspalum';
        if (s.includes('bermuda'))                             return 'bermudagrass';
        if (s.includes('couch'))                               return 'couch';
        if (s.includes('kikuyu'))                              return 'kikuyu';
        if (s.includes('zoysia'))                              return 'zoysiagrass';
        if (s.includes('buffalo'))                             return 'buffalo';
        if (s.includes('tall') && s.includes('fescue'))        return 'tall_fescue';
        if (s.includes('fescue') || s.includes('chewing'))     return 'fine_fescue';
        if (s.includes('perennial') && s.includes('ryegrass')) return 'perennial_ryegrass';
        if (s.includes('ryegrass') || s.includes('rye'))       return 'perennial_ryegrass';
        if (s.includes('bent'))                                return 'bentgrass';
        // Check poa/annual BEFORE bluegrass (Annual Bluegrass contains both)
        if (s.includes('poa') || s.includes('annual'))         return 'annual_bluegrass';
        if (s.includes('kentucky') || s.includes('bluegrass')) return 'kentucky_bluegrass';

        return 'generic';
    }

    /**
     * Determine C3/C4 from inputs.
     * Priority: explicit grassType > species DB > c4Fraction > default C3
     */
    function resolveGrassType(inputs, speciesParams) {
        if (inputs.grassType) {
            const gt = String(inputs.grassType).toUpperCase();
            if (gt === 'C3' || gt === 'C4') return gt;
        }
        if (speciesParams && typeof speciesParams.isC4 === 'boolean') {
            return speciesParams.isC4 ? 'C4' : 'C3';
        }
        if (typeof inputs.c4Fraction === 'number') {
            return inputs.c4Fraction > 0.5 ? 'C4' : 'C3';
        }
        return 'C3';
    }

    // =========================================================================
    // CORE CALCULATION: MAAS-HOFFMAN YIELD MODEL
    // =========================================================================

    /**
     * Calculate yield reduction from EC using Maas-Hoffman threshold-slope.
     * Returns { relativeYield, penaltyPct } both as percentages 0-100.
     */
    function maasHoffman(ec, threshold, slope) {
        if (ec <= threshold) {
            return { relativeYield: 100, penaltyPct: 0 };
        }
        const penalty = Math.min(100, slope * (ec - threshold));
        return {
            relativeYield: Math.max(0, 100 - penalty),
            penaltyPct: penalty
        };
    }

    // =========================================================================
    // TEMPERATURE ADJUSTMENT FUNCTIONS
    // =========================================================================

    function lookupRange(ranges, temperature) {
        for (let i = 0; i < ranges.length; i++) {
            if (temperature < ranges[i].maxTemp) return ranges[i];
        }
        return ranges[ranges.length - 1];
    }

    /**
     * Get temperature modifier for salinity tolerance.
     * Returns { modifier, note }
     */
    function getTempSalinityModifier(temperature, grassType) {
        const ranges = TEMP_SALINITY_MODIFIERS[grassType] || TEMP_SALINITY_MODIFIERS.C3;
        const range = lookupRange(ranges, temperature);
        return { modifier: range.modifier, note: range.note };
    }

    /**
     * Get ET-based concentration factor from temperature.
     * Returns { etMultiplier, estimatedET }
     */
    function getETFactor(temperature) {
        const range = lookupRange(ET_TEMP_MULTIPLIERS, temperature);
        return {
            etMultiplier: range.multiplier,
            estimatedET: ET_REFERENCE_MM * range.multiplier
        };
    }

    /**
     * Calculate effective EC (what the plant "experiences" under heat stress).
     * When modifier < 1, effective EC > measured EC.
     */
    function calculateEffectiveEC(measuredEC, tempModifier) {
        const effective = measuredEC / tempModifier;
        let increase;
        if (tempModifier < 1) {
            increase = Math.round((1 / tempModifier - 1) * 100) + '% more damaging';
        } else if (tempModifier > 1) {
            increase = Math.round((1 - 1 / tempModifier) * 100) + '% less damaging';
        } else {
            increase = 'Reference conditions';
        }
        return {
            measured: measuredEC,
            effective: round2(effective),
            modifier: tempModifier,
            increase: increase
        };
    }

    /**
     * Calculate compound stress (temperature x salinity synergistic).
     * Both inputs 0-1 scale.
     */
    function calculateCompoundStress(temperatureStress, salinityStress) {
        const tS = clamp01(temperatureStress);
        const sS = clamp01(salinityStress);

        if (tS < NEGLIGIBLE_STRESS && sS < NEGLIGIBLE_STRESS) {
            return {
                compound: 0,
                individual: { temperature: tS, salinity: sS },
                synergy: 0,
                severity: 'none',
                percentReduction: 0
            };
        }

        const multiplicative = 1 - (1 - tS) * (1 - sS);
        const synergisticBoost = tS * sS * (COMPOUND_INTERACTION_FACTOR - 1);
        const compound = Math.min(1, multiplicative + synergisticBoost);

        let severity;
        if (compound < 0.15) severity = 'mild';
        else if (compound < 0.30) severity = 'moderate';
        else if (compound < 0.50) severity = 'significant';
        else if (compound < 0.70) severity = 'severe';
        else severity = 'critical';

        return {
            compound: round2(compound),
            individual: { temperature: round2(tS), salinity: round2(sS) },
            synergy: round2(synergisticBoost),
            severity: severity,
            percentReduction: Math.round(compound * 100)
        };
    }

    /**
     * Calculate salt accumulation rate in root zone.
     */
    function calculateAccumulationRate(waterEC, irrigationMM, temperature, et0Override) {
        const etFactor = getETFactor(temperature);
        const etMM = (typeof et0Override === 'number' && et0Override > 0) ? et0Override : etFactor.estimatedET;

        // Daily salt load = EC (dS/m) x irrigation (mm) x 0.64 (kg/ha conversion)
        const dailySaltLoad = waterEC * irrigationMM * 0.64;
        const concentrationFactor = (irrigationMM > 0) ? (etMM / irrigationMM) : 0;
        const netAccumulation = dailySaltLoad * concentrationFactor;

        return {
            dailySaltLoadKgHa: round1(dailySaltLoad),
            etMM: round1(etMM),
            netAccumulationKgHa: round1(netAccumulation),
            concentrationFactor: round2(concentrationFactor),
            note: etFactor.etMultiplier > 1.2
                ? 'High ET accelerating salt accumulation'
                : 'Normal accumulation rate'
        };
    }

    /**
     * Calculate climate-adjusted leaching requirement.
     */
    function calculateAdjustedLeachingReq(baseLR, tempModifier, etMultiplier) {
        const toleranceAdj = 1 / tempModifier;
        const etAdj = Math.sqrt(etMultiplier);
        const adjusted = Math.min(0.40, baseLR * toleranceAdj * etAdj);

        return {
            baseLR_pct: Math.round(baseLR * 100),
            adjustedLR_pct: Math.round(adjusted * 100),
            toleranceAdjustment: round2(toleranceAdj),
            etAdjustment: round2(etAdj),
            percentIncrease: Math.round((adjusted / Math.max(baseLR, 0.001) - 1) * 100),
            note: adjusted > baseLR * 1.2
                ? 'Significant increase in leaching needed due to temperature conditions'
                : 'Standard leaching requirement'
        };
    }

    // =========================================================================
    // FERTILISER GUIDANCE
    // =========================================================================

    function getFertiliserGuidance(soilECe, isC4) {
        if (!soilECe || soilECe <= 0) {
            return {
                status: 'unknown',
                canFertilise: true,
                message: 'Soil EC not measured - monitor EC if using saline water',
                recommendation: 'Test soil EC before high-rate fertiliser applications',
                soilECe: null,
                grassType: isC4 ? 'warm-season' : 'cool-season'
            };
        }

        const thresholds = isC4
            ? { safe: 3.0, caution: 5.0, restrict: 7.0 }
            : { safe: 2.0, caution: 3.0, restrict: 4.5 };

        let status, canFertilise, message, recommendation;

        if (soilECe < thresholds.safe) {
            status = 'safe';
            canFertilise = true;
            message = 'Soil EC low - fertiliser application safe';
            recommendation = 'Apply fertiliser as per program. Monitor EC after application.';
        } else if (soilECe < thresholds.caution) {
            status = 'caution';
            canFertilise = true;
            message = 'Soil EC moderate - reduce fertiliser rates';
            recommendation = 'Reduce granular rates by 25-50%. Apply before irrigation to flush. Consider foliar applications.';
        } else if (soilECe < thresholds.restrict) {
            status = 'restrict';
            canFertilise = false;
            message = 'Soil EC elevated - restrict fertiliser';
            recommendation = 'Avoid granular fertiliser. Use foliar-only at reduced rates. Prioritise leaching.';
        } else {
            status = 'avoid';
            canFertilise = false;
            message = 'Soil EC high - do not fertilise';
            recommendation = 'Do not apply fertiliser until EC reduced through leaching. Foliar iron/micronutrients only if essential.';
        }

        return {
            status, canFertilise, message, recommendation,
            soilECe,
            thresholds,
            grassType: isC4 ? 'warm-season' : 'cool-season'
        };
    }

    // =========================================================================
    // MANAGEMENT ADVICE
    // =========================================================================

    function getManagementAdvice(status, ecw, threshold, speciesKey, soilECe, fertGuidance) {
        const advice = [];

        switch (status) {
            case 'safe':
                advice.push('Current water quality within acceptable range for this species');
                if (ecw > threshold * 0.8) {
                    advice.push('Approaching threshold - monitor EC trends');
                }
                break;
            case 'minor':
                advice.push('Implement leaching fraction (10-15% over ET)');
                advice.push('Monitor soil EC monthly during growing season');
                break;
            case 'moderate':
                advice.push('Increase leaching fraction to 15-20%');
                advice.push('Consider gypsum amendment to maintain soil structure');
                advice.push('Blend with lower EC source if available');
                advice.push('Increase mowing height to reduce plant stress');
                break;
            case 'severe':
                advice.push('Seek alternative water source or blending options');
                advice.push('Apply gypsum at 1-2 t/ha seasonally');
                advice.push('Maintain high leaching fraction (20-25%)');
                advice.push('Consider species conversion to more tolerant variety');
                break;
            case 'critical':
                advice.push('Water quality unsuitable for this species');
                const tolerant = findTolerantAlternatives(ecw);
                if (tolerant.length > 0) {
                    advice.push('Consider conversion to: ' + tolerant.slice(0, 3).join(', '));
                }
                advice.push('Investigate alternative water sources as priority');
                break;
        }

        if (soilECe && soilECe > 0) {
            if (soilECe > threshold * 2) {
                advice.push('SOIL EC CRITICAL: Prioritise leaching before any fertiliser');
            } else if (soilECe > threshold * 1.5) {
                advice.push('Soil EC elevated - reduce fertiliser rates, apply with irrigation');
            }
        }

        if (fertGuidance && fertGuidance.status !== 'unknown') {
            advice.push('FERTILISER: ' + fertGuidance.recommendation);
        }

        return advice;
    }

    function findTolerantAlternatives(ecwDsm) {
        const alternatives = [];
        for (const [species, params] of Object.entries(SPECIES_TOLERANCE)) {
            if (species !== 'generic' && params.thresholdECw >= ecwDsm) {
                alternatives.push(species.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            }
        }
        return alternatives;
    }

    // =========================================================================
    // CLIMATE-AWARE RECOMMENDATIONS
    // =========================================================================

    function generateClimateRecommendations(effectiveEC, compoundStress, adjustedLR, temperature, grassType) {
        const recs = [];

        if (effectiveEC.modifier < 0.85) {
            recs.push({
                priority: 'high',
                action: 'Increase irrigation frequency',
                detail: 'High temperatures reducing salt tolerance by ' +
                    Math.round((1 - effectiveEC.modifier) * 100) +
                    '%. More frequent, lighter irrigations will help flush salts.'
            });
        }

        if (compoundStress.severity === 'severe' || compoundStress.severity === 'critical') {
            recs.push({
                priority: 'urgent',
                action: 'Emergency stress management',
                detail: 'Combined heat + salinity stress at ' + compoundStress.percentReduction +
                    '% reduction. Consider shade cloth, syringing, and temporary traffic restrictions.'
            });
        } else if (compoundStress.severity === 'significant') {
            recs.push({
                priority: 'high',
                action: 'Enhanced monitoring',
                detail: 'Significant compound stress. Monitor tissue EC and increase leaching events.'
            });
        }

        if (adjustedLR && adjustedLR.percentIncrease > 20) {
            recs.push({
                priority: 'medium',
                action: 'Increase leaching fraction',
                detail: 'Temperature conditions require ' + adjustedLR.adjustedLR_pct +
                    '% leaching fraction (up from ' + adjustedLR.baseLR_pct + '% base requirement).'
            });
        }

        if (temperature > 30) {
            recs.push({
                priority: 'medium',
                action: 'Compensate for high ET',
                detail: 'Elevated ET concentrating salts faster. Consider gypsum application and acidifying irrigation.'
            });
        }

        if (temperature < 18 && grassType === 'C3') {
            recs.push({
                priority: 'info',
                action: 'Favourable conditions',
                detail: 'Cool temperatures providing improved salt tolerance. Good window for recovery.'
            });
        }

        if (recs.length === 0) {
            recs.push({
                priority: 'info',
                action: 'Standard management',
                detail: 'Current conditions within normal parameters. Continue standard salinity management.'
            });
        }

        return recs;
    }

    // =========================================================================
    // MAIN ANALYSIS FUNCTION (PURE)
    // =========================================================================

    /**
     * analyse(inputs) - Single entry point for salinity assessment.
     * 
     * @param {object} inputs - See input contract in file header
     * @returns {object} Complete salinity assessment
     */
    function analyse(inputs) {
        if (!inputs || typeof inputs.ecw !== 'number' || inputs.ecw <= 0) {
            return {
                error: true,
                message: 'ECw (irrigation water EC in dS/m) is required and must be > 0',
                success: false
            };
        }

        const ecw = inputs.ecw;
        const soilECe = (typeof inputs.soilECe === 'number' && inputs.soilECe > 0) ? inputs.soilECe : null;
        const temperature = (typeof inputs.temperature === 'number') ? inputs.temperature : null;

        // --- Species resolution ---
        const speciesKey = resolveSpeciesKey(inputs.speciesKey || inputs.species);
        const params = SPECIES_TOLERANCE[speciesKey];
        const isC4 = params.isC4;
        const grassType = resolveGrassType(inputs, params);
        const toleranceInfo = TOLERANCE_CLASSES[params.toleranceClass] || {};

        // --- Base Maas-Hoffman: WATER EC ---
        const waterResult = maasHoffman(ecw, params.thresholdECw, params.slope);

        // --- Base Maas-Hoffman: SOIL ECe ---
        // Soil ECe threshold ~ 1.5x water ECw threshold at steady state
        const soilThreshold = params.thresholdECw * 1.5;
        let soilResult = { relativeYield: 100, penaltyPct: 0 };
        let soilStatus = 'unknown';
        if (soilECe) {
            soilResult = maasHoffman(soilECe, soilThreshold, params.slope);
            if (soilResult.penaltyPct <= 0) soilStatus = 'safe';
            else if (soilResult.penaltyPct <= 10) soilStatus = 'minor';
            else if (soilResult.penaltyPct <= 25) soilStatus = 'moderate';
            else if (soilResult.penaltyPct <= 50) soilStatus = 'severe';
            else soilStatus = 'critical';
        }

        // --- Effective penalty: worst of water or soil ---
        const effectivePenalty = Math.max(waterResult.penaltyPct, soilResult.penaltyPct);
        const effectiveYield = Math.min(waterResult.relativeYield, soilResult.relativeYield);

        // --- Overall status ---
        let status;
        if (effectivePenalty <= 0) status = 'safe';
        else if (effectivePenalty <= 10) status = 'minor';
        else if (effectivePenalty <= 25) status = 'moderate';
        else if (effectivePenalty <= 50) status = 'severe';
        else status = 'critical';

        // --- Safety margin ---
        const safetyMargin = params.thresholdECw - ecw;
        let marginStatus;
        if (safetyMargin >= params.thresholdECw * 0.5) marginStatus = 'comfortable';
        else if (safetyMargin >= 0) marginStatus = 'tight';
        else if (safetyMargin >= -(params.thresholdECw * 0.5)) marginStatus = 'exceeded';
        else marginStatus = 'greatly_exceeded';

        // --- Fertiliser guidance ---
        const fertGuidance = getFertiliserGuidance(soilECe, isC4);

        // --- Base leaching requirement (simplified) ---
        // LR = ECw / (5 * ECe_threshold - ECw)  [FAO 29]
        const baseLR = (soilThreshold > 0 && (5 * soilThreshold - ecw) > 0)
            ? ecw / (5 * soilThreshold - ecw)
            : 0;

        // --- Climate enhancement (only when temperature provided) ---
        let climateEnhanced = false;
        let effectiveEC = null;
        let tempModResult = null;
        let compoundStress = null;
        let adjustedThreshold = null;
        let adjustedLR = null;
        let accumulation = null;
        let climateImpact = null;
        let climateRecommendations = [];
        let adjustedReduction = null;

        if (temperature !== null) {
            climateEnhanced = true;

            // Temperature modifier
            tempModResult = getTempSalinityModifier(temperature, grassType);

            // Effective EC
            effectiveEC = calculateEffectiveEC(ecw, tempModResult.modifier);

            // Adjusted threshold
            adjustedThreshold = {
                base: params.thresholdECw,
                adjusted: round2(params.thresholdECw * tempModResult.modifier),
                modifier: tempModResult.modifier,
                note: tempModResult.note
            };

            // Compound stress
            const temperatureStress = tempModResult.modifier < 1 ? (1 - tempModResult.modifier) : 0;
            const salinityStress = effectivePenalty / 100;
            compoundStress = calculateCompoundStress(temperatureStress, salinityStress);
            adjustedReduction = compoundStress.percentReduction;

            // ET factor and adjusted leaching
            const etFactor = getETFactor(temperature);
            adjustedLR = calculateAdjustedLeachingReq(
                Math.max(baseLR, 0.001),
                tempModResult.modifier,
                etFactor.etMultiplier
            );

            // Accumulation rate (if irrigation data provided)
            if (typeof inputs.irrigationMM === 'number' && inputs.irrigationMM > 0) {
                accumulation = calculateAccumulationRate(ecw, inputs.irrigationMM, temperature, inputs.et0);
            }

            // Climate impact assessment
            const originalStress = effectivePenalty / 100;
            const additionalStress = compoundStress.compound - originalStress;
            if (additionalStress < 0.05) {
                climateImpact = { level: 'minimal', description: 'Temperature conditions have minimal impact on salinity stress.', additionalReduction: 0 };
            } else if (additionalStress < 0.15) {
                climateImpact = { level: 'moderate', description: 'Temperature conditions moderately increasing salinity impact.', additionalReduction: Math.round(additionalStress * 100) };
            } else if (additionalStress < 0.25) {
                climateImpact = { level: 'significant', description: 'Temperature stress significantly compounding salinity damage.', additionalReduction: Math.round(additionalStress * 100) };
            } else {
                climateImpact = { level: 'severe', description: 'Combined heat and salinity stress causing severe growth limitation.', additionalReduction: Math.round(additionalStress * 100) };
            }

            // Climate recommendations
            climateRecommendations = generateClimateRecommendations(
                effectiveEC, compoundStress, adjustedLR, temperature, grassType
            );
        }

        // --- Management advice ---
        const managementAdvice = getManagementAdvice(status, ecw, params.thresholdECw, speciesKey, soilECe, fertGuidance);

        // --- Assemble result ---
        const result = {
            success: true,
            error: false,

            // Species
            species: speciesKey,
            speciesLabel: SPECIES_DISPLAY_NAMES[speciesKey] || speciesKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            grassType: grassType,
            isC4: isC4,

            // Inputs echoed
            ecwInput: ecw,
            soilECe: soilECe,
            soilEC1_5: inputs.soilEC1_5 || null,
            soilTexture: inputs.soilTexture || null,

            // Thresholds
            thresholdECw: params.thresholdECw,
            thresholdECe: soilThreshold,
            slopePctPerDsm: params.slope,
            toleranceClass: params.toleranceClass,
            toleranceLabel: toleranceInfo.label || params.toleranceClass,

            // Water-based penalty
            relativeYieldWater: round1(waterResult.relativeYield),
            penaltyWater: round1(waterResult.penaltyPct),

            // Soil-based penalty
            relativeYieldSoil: round1(soilResult.relativeYield),
            penaltySoil: round1(soilResult.penaltyPct),
            soilStatus: soilStatus,

            // Effective (worst of water/soil, before climate adjustment)
            relativeYieldPct: round1(effectiveYield),
            growthPenaltyPct: round1(effectivePenalty),
            growthModifier: round2(effectiveYield / 100), // 0-1 scale for orchestrator
            status: status,
            statusLabel: getStatusLabel(status),
            statusClass: getStatusClass(status),

            // Safety margin
            safetyMarginDsm: round2(safetyMargin),
            marginStatus: marginStatus,

            // Leaching
            baseLR_pct: Math.round(baseLR * 100),

            // Fertiliser
            fertGuidance: fertGuidance,

            // Species notes
            speciesNotes: params.notes,

            // Management
            managementAdvice: managementAdvice,

            // Climate enhancement
            climateEnhanced: climateEnhanced,
            temperature: temperature,
            temperatureModifier: tempModResult,
            effectiveEC: effectiveEC,
            adjustedThreshold: adjustedThreshold,
            compoundStress: compoundStress,
            adjustedReduction: adjustedReduction,
            adjustedLeachingRequirement: adjustedLR,
            accumulation: accumulation,
            climateImpact: climateImpact,
            climateRecommendations: climateRecommendations,

            // Metadata
            _engine: 'salinity-engine-pure',
            _version: '2.0.0'
        };

        return result;
    }

    // =========================================================================
    // BLENDED WATER ANALYSIS (PURE)
    // =========================================================================

    /**
     * Calculate penalty for blended water sources.
     * 
     * @param {Array} sources - [{ ecDsm, proportion }, ...]
     * @param {object} inputs - Same as analyse() but ecw is calculated from blend
     * @returns {object} Blended analysis result
     */
    function analyseBlend(sources, inputs) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return { error: true, message: 'Water sources array required' };
        }

        let blendedEC = 0;
        let totalProportion = 0;
        for (const source of sources) {
            blendedEC += (source.ecDsm || 0) * (source.proportion || 0);
            totalProportion += (source.proportion || 0);
        }
        if (totalProportion > 0 && Math.abs(totalProportion - 1.0) > 0.01) {
            blendedEC = blendedEC / totalProportion;
        }

        const result = analyse({ ...inputs, ecw: blendedEC });

        // Add source comparison
        const sourceAnalysis = sources.map((source, i) => {
            const sourceResult = analyse({ ...inputs, ecw: source.ecDsm });
            return {
                sourceIndex: i + 1,
                ecDsm: source.ecDsm,
                proportionPct: Math.round((source.proportion || 0) * 100),
                individualPenalty: sourceResult.error ? null : sourceResult.growthPenaltyPct
            };
        });

        result.blendedECDsm = round2(blendedEC);
        result.sourceAnalysis = sourceAnalysis;
        result.isBlend = true;

        return result;
    }

    // =========================================================================
    // SPECIES COMPARISON (PURE)
    // =========================================================================

    /**
     * Compare species tolerance at a given EC.
     */
    function compareSpecies(ecwDsm, speciesList) {
        const species = speciesList || Object.keys(SPECIES_TOLERANCE).filter(k => k !== 'generic');

        const comparisons = species.map(sp => {
            const result = analyse({ ecw: ecwDsm, speciesKey: sp });
            if (!result.error) {
                return {
                    species: result.species,
                    speciesLabel: result.speciesLabel,
                    toleranceClass: result.toleranceClass,
                    thresholdECw: result.thresholdECw,
                    growthPenaltyPct: result.growthPenaltyPct,
                    relativeYieldPct: result.relativeYieldPct,
                    status: result.status
                };
            }
            return null;
        }).filter(Boolean);

        comparisons.sort((a, b) => a.growthPenaltyPct - b.growthPenaltyPct);

        return {
            ecwInput: ecwDsm,
            comparisons: comparisons,
            bestChoice: comparisons[0] || null,
            worstChoice: comparisons[comparisons.length - 1] || null
        };
    }

    /**
     * Find maximum safe EC for a target yield percentage.
     */
    function findMaxSafeEC(species, targetYieldPct) {
        targetYieldPct = targetYieldPct || 90;
        const speciesKey = resolveSpeciesKey(species);
        const params = SPECIES_TOLERANCE[speciesKey];

        if (!params) return { error: true, message: 'Unknown species' };

        const maxPenalty = 100 - targetYieldPct;
        const maxEC = (maxPenalty / params.slope) + params.thresholdECw;

        return {
            species: speciesKey,
            targetYieldPct: targetYieldPct,
            thresholdECw: params.thresholdECw,
            maxSafeECw: round2(maxEC),
            allowablePenalty: maxPenalty,
            interpretation: 'To maintain ' + targetYieldPct + '% yield, irrigation EC should not exceed ' + maxEC.toFixed(1) + ' dS/m'
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function round1(n) { return Math.round(n * 10) / 10; }
    function round2(n) { return Math.round(n * 100) / 100; }
    function clamp01(n) { return Math.max(0, Math.min(1, n || 0)); }

    function getStatusLabel(status) {
        const labels = {
            safe: 'No Penalty',
            minor: 'Minor Reduction (< 10%)',
            moderate: 'Moderate Reduction (10-25%)',
            severe: 'Severe Reduction (25-50%)',
            critical: 'Critical Damage (> 50%)'
        };
        return labels[status] || status;
    }

    function getStatusClass(status) {
        const classes = {
            safe: 'status-adequate',
            minor: 'status-borderline',
            moderate: 'status-borderline',
            severe: 'status-deficient',
            critical: 'status-deficient'
        };
        return classes[status] || 'status-borderline';
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const SalinityEnginePure = {
        analyse:        analyse,
        analyseBlend:   analyseBlend,
        compareSpecies: compareSpecies,
        findMaxSafeEC:  findMaxSafeEC,

        // Expose internals for unit testing
        _internals: {
            resolveSpeciesKey:        resolveSpeciesKey,
            resolveGrassType:         resolveGrassType,
            maasHoffman:              maasHoffman,
            getTempSalinityModifier:  getTempSalinityModifier,
            getETFactor:              getETFactor,
            calculateEffectiveEC:     calculateEffectiveEC,
            calculateCompoundStress:  calculateCompoundStress,
            calculateAccumulationRate: calculateAccumulationRate,
            calculateAdjustedLeachingReq: calculateAdjustedLeachingReq,
            getFertiliserGuidance:    getFertiliserGuidance,
            SPECIES_TOLERANCE:        SPECIES_TOLERANCE,
            TEMP_SALINITY_MODIFIERS:  TEMP_SALINITY_MODIFIERS
        },

        VERSION: '2.0.0'
    };

    // Universal export: browser global + CommonJS/Node
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SalinityEnginePure;
    }
    if (typeof root !== 'undefined') {
        root.SalinityEnginePure = SalinityEnginePure;
    }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
