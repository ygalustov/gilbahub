/**
 * =============================================================================
 * GILBA SALINITY GROWTH PENALTY v1.0
 * =============================================================================
 * 
 * Calculates yield/growth reduction from irrigation water salinity.
 * Uses Maas-Hoffman (1977) threshold-slope model.
 * 
 * Scientific Basis:
 * - Maas & Hoffman (1977) - Crop salt tolerance, current assessment
 * - FAO Irrigation and Drainage Paper 29 Rev 1
 * - Harivandi et al. - Turfgrass salinity tolerance
 * - Carrow & Duncan - Salt-affected turfgrass sites
 * 
 * Integration:
 * - Adds growth penalty card to water quality progressive disclosure
 * - Reads ECw from water quality state
 * - Species-aware based on turf selection
 * 
 * =============================================================================
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const SALINITY_CONFIG = {
        version: '1.0.0'
    };

    // ========================================================================
    // TURFGRASS SALINITY TOLERANCE PARAMETERS
    // threshold_ecw: EC below which no yield loss (dS/m)
    // slope: Percent yield reduction per dS/m above threshold
    // ========================================================================

    const SPECIES_TOLERANCE = {
        // Highly tolerant (> 8 dS/m threshold)
        seashore_paspalum: {
            thresholdECw: 12.0,
            slope: 4.0,
            toleranceClass: 'excellent',
            notes: 'Most salt-tolerant turfgrass; can use seawater blends'
        },

        // Tolerant (4-8 dS/m threshold)
        bermudagrass: {
            thresholdECw: 6.0,
            slope: 5.0,
            toleranceClass: 'good',
            notes: 'Good salt tolerance - common sports turf choice'
        },
        couch: {
            thresholdECw: 5.5,
            slope: 5.5,
            toleranceClass: 'good',
            notes: 'Good salinity tolerance'
        },
        zoysiagrass: {
            thresholdECw: 4.5,
            slope: 6.0,
            toleranceClass: 'good',
            notes: 'Moderate-good tolerance; japonica types vary'
        },
        kikuyu: {
            thresholdECw: 4.0,
            slope: 6.5,
            toleranceClass: 'moderate',
            notes: 'Moderate tolerance - common in Australia'
        },
        buffalo: {
            thresholdECw: 5.0,
            slope: 5.5,
            toleranceClass: 'good',
            notes: 'Good tolerance and low water use'
        },
        tall_fescue: {
            thresholdECw: 4.0,
            slope: 6.0,
            toleranceClass: 'moderate',
            notes: 'Most salt-tolerant cool-season grass'
        },
        fine_fescue: {
            thresholdECw: 1.5,
            slope: 9.0,
            toleranceClass: 'sensitive',
            notes: 'Chewings, creeping red, hard fescue - lower salt tolerance than tall fescue'
        },

        // Moderately tolerant (2-4 dS/m threshold)
        perennial_ryegrass: {
            thresholdECw: 3.5,
            slope: 7.5,
            toleranceClass: 'moderate',
            notes: 'Moderate tolerance; commonly used for overseed'
        },
        ryegrass: {
            thresholdECw: 3.5,
            slope: 7.5,
            toleranceClass: 'moderate',
            notes: 'Moderate tolerance; commonly used for overseed'
        },
        kentucky_bluegrass: {
            thresholdECw: 2.5,
            slope: 9.0,
            toleranceClass: 'low',
            notes: 'Poor salt tolerance - avoid saline irrigation'
        },
        bentgrass: {
            thresholdECw: 3.0,
            slope: 8.0,
            toleranceClass: 'moderate',
            notes: 'Putting greens - moderate tolerance, leaching critical'
        },

        // Sensitive (< 2 dS/m threshold)
        annual_bluegrass: {
            thresholdECw: 2.0,
            slope: 10.0,
            toleranceClass: 'poor',
            notes: 'Poa annua - salt sensitive, first to show damage'
        },

        // Generic fallback
        generic: {
            thresholdECw: 4.0,
            slope: 6.0,
            toleranceClass: 'moderate',
            notes: 'Default moderate tolerance assumed'
        }
    };

    // ========================================================================
    // TOLERANCE CLASS DESCRIPTIONS
    // ========================================================================

    const TOLERANCE_CLASSES = {
        excellent: {
            label: 'Excellent',
            ecwRange: '> 8 dS/m',
            description: 'Can tolerate seawater blends and highly saline recycled water',
            statusClass: 'status-adequate'
        },
        good: {
            label: 'Good',
            ecwRange: '4-8 dS/m',
            description: 'Suitable for moderately saline recycled water',
            statusClass: 'status-adequate'
        },
        moderate: {
            label: 'Moderate',
            ecwRange: '2-4 dS/m',
            description: 'Some tolerance; may require leaching and amendments',
            statusClass: 'status-borderline'
        },
        low: {
            label: 'Low',
            ecwRange: '1-2 dS/m',
            description: 'Limited tolerance; avoid saline sources if possible',
            statusClass: 'status-borderline'
        },
        poor: {
            label: 'Poor',
            ecwRange: '< 1 dS/m',
            description: 'Salt sensitive; use only high-quality irrigation water',
            statusClass: 'status-deficient'
        },
        sensitive: {
            label: 'Sensitive',
            ecwRange: '1-2 dS/m',
            description: 'Salt sensitive; requires high-quality water and active leaching',
            statusClass: 'status-deficient'
        }
    };

    // ========================================================================
    // CORE CALCULATION FUNCTIONS
    // ========================================================================

    /**
     * Get species key from input string
     */
    function getSpeciesKey(species) {
        const speciesLower = (species || '').toLowerCase().replace(/\s+/g, '_');
        
        if (speciesLower.includes('paspalum')) return 'seashore_paspalum';
        if (speciesLower.includes('bermuda')) return 'bermudagrass';
        if (speciesLower.includes('couch')) return 'couch';
        if (speciesLower.includes('kikuyu')) return 'kikuyu';
        if (speciesLower.includes('zoysia')) return 'zoysiagrass';
        if (speciesLower.includes('buffalo')) return 'buffalo';
        if (speciesLower.includes('tall') && speciesLower.includes('fescue')) return 'tall_fescue';
        if (speciesLower.includes('fescue') || speciesLower.includes('chewing')) return 'fine_fescue';
        if (speciesLower.includes('perennial') && speciesLower.includes('ryegrass')) return 'perennial_ryegrass';
        if (speciesLower.includes('ryegrass') || speciesLower.includes('rye')) return 'perennial_ryegrass';
        if (speciesLower.includes('bent')) return 'bentgrass';
        // Check poa/annual BEFORE bluegrass (Annual Bluegrass contains both)
        if (speciesLower.includes('poa') || speciesLower.includes('annual')) return 'annual_bluegrass';
        if (speciesLower.includes('kentucky') || speciesLower.includes('bluegrass')) return 'kentucky_bluegrass';
        
        return 'generic';
    }
    
    /**
     * Get display name for species
     */
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
        'ryegrass': 'Perennial Ryegrass',
        'kentucky_bluegrass': 'Kentucky Bluegrass',
        'bentgrass': 'Bentgrass',
        'annual_bluegrass': 'Poa annua',
        'generic': 'Turfgrass'
    };

    /**
     * Calculate growth/yield reduction from salinity
     * 
     * Maas-Hoffman model:
     * Y = 100 - slope × (ECw - threshold)  when ECw > threshold
     * Y = 100                               when ECw ≤ threshold
     * 
     * Enhanced to include:
     * - Soil ECe impact (rootzone salinity)
     * - Fertiliser timing guidance based on soil EC
     * 
     * @param {number} ecwDsm - Irrigation water EC in dS/m
     * @param {string} species - Turf species
     * @param {number} soilECe - Soil saturated paste EC in dS/m (optional)
     * @returns {object} Growth penalty analysis
     */
    function calculateGrowthPenalty(ecwDsm, species, soilECe) {
        const speciesKey = getSpeciesKey(species);
        const params = SPECIES_TOLERANCE[speciesKey];

        if (!params) {
            return {
                error: true,
                message: 'Unknown species: ' + species
            };
        }

        const threshold = params.thresholdECw;
        const slope = params.slope;
        
        // Soil ECe thresholds (approximate ECe = 1.5 × ECw at steady state)
        // These are rootzone thresholds - more directly relevant than water EC
        const soilThreshold = threshold * 1.5;

        // Calculate relative yield from WATER EC (traditional Maas-Hoffman)
        let relativeYieldWater, penaltyPctWater;

        if (ecwDsm <= threshold) {
            relativeYieldWater = 100.0;
            penaltyPctWater = 0.0;
        } else {
            const excessEC = ecwDsm - threshold;
            penaltyPctWater = Math.min(100, slope * excessEC);  // Clamp to 100% max
            relativeYieldWater = Math.max(0, 100 - penaltyPctWater);
        }
        
        // Calculate relative yield from SOIL EC (if provided)
        let relativeYieldSoil = 100.0;
        let penaltyPctSoil = 0.0;
        let soilStatus = 'unknown';
        
        if (soilECe && soilECe > 0) {
            if (soilECe <= soilThreshold) {
                relativeYieldSoil = 100.0;
                penaltyPctSoil = 0.0;
                soilStatus = 'safe';
            } else {
                // Soil EC penalty - use same slope but against soil threshold
                const excessSoilEC = soilECe - soilThreshold;
                penaltyPctSoil = Math.min(100, slope * excessSoilEC);  // Clamp to 100% max
                relativeYieldSoil = Math.max(0, 100 - penaltyPctSoil);
                
                if (penaltyPctSoil <= 10) soilStatus = 'minor';
                else if (penaltyPctSoil <= 25) soilStatus = 'moderate';
                else if (penaltyPctSoil <= 50) soilStatus = 'severe';
                else soilStatus = 'critical';
            }
        }
        
        // Use the WORSE of water or soil penalty (actual rootzone stress)
        const effectivePenalty = Math.max(penaltyPctWater, penaltyPctSoil);
        const effectiveYield = Math.min(relativeYieldWater, relativeYieldSoil);
        
        // Determine overall status
        let status;
        if (effectivePenalty <= 0) status = 'safe';
        else if (effectivePenalty <= 10) status = 'minor';
        else if (effectivePenalty <= 25) status = 'moderate';
        else if (effectivePenalty <= 50) status = 'severe';
        else status = 'critical';

        // Calculate safety margin
        const safetyMargin = threshold - ecwDsm;
        const marginStatus = getMarginStatus(safetyMargin, threshold);

        // Get tolerance class info
        const toleranceInfo = TOLERANCE_CLASSES[params.toleranceClass];
        
        // Fertiliser timing guidance based on soil EC
        const fertGuidance = getFertiliserGuidance(soilECe, speciesKey, params);

        return {
            species: speciesKey,
            speciesLabel: SPECIES_DISPLAY_NAMES[speciesKey] || speciesKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            ecwInput: ecwDsm,
            soilECe: soilECe || null,

            thresholdECw: threshold,
            thresholdECe: soilThreshold,
            slopePctPerDsm: slope,
            toleranceClass: params.toleranceClass,
            toleranceLabel: toleranceInfo.label,

            // Water-based penalty
            relativeYieldWater: Math.round(relativeYieldWater * 10) / 10,
            penaltyWater: Math.round(penaltyPctWater * 10) / 10,
            
            // Soil-based penalty
            relativeYieldSoil: Math.round(relativeYieldSoil * 10) / 10,
            penaltySoil: Math.round(penaltyPctSoil * 10) / 10,
            soilStatus: soilStatus,
            
            // Effective (worst case)
            relativeYieldPct: Math.round(effectiveYield * 10) / 10,
            growthPenaltyPct: Math.round(effectivePenalty * 10) / 10,
            status: status,
            statusLabel: getStatusLabel(status),
            statusClass: getStatusClass(status),

            safetyMarginDsm: Math.round(safetyMargin * 100) / 100,
            marginStatus: marginStatus,

            speciesNotes: params.notes,
            
            // Fertiliser guidance
            fertGuidance: fertGuidance,

            managementAdvice: getManagementAdvice(status, ecwDsm, threshold, speciesKey, soilECe, fertGuidance)
        };
    }
    
    /**
     * Get fertiliser timing guidance based on soil EC
     * High soil EC = osmotic stress = avoid adding more salts via fertiliser
     */
    function getFertiliserGuidance(soilECe, speciesKey, params) {
        if (!soilECe || soilECe <= 0) {
            return {
                status: 'unknown',
                canFertilise: true,
                message: 'Soil EC not measured - monitor EC if using saline water',
                recommendation: 'Test soil EC before high-rate fertiliser applications'
            };
        }
        
        // Species-specific EC thresholds for fertiliser application
        // C4 grasses tolerate higher EC before fertiliser becomes risky
        const isC4 = ['seashore_paspalum', 'bermudagrass', 'couch', 'zoysiagrass', 'kikuyu', 'buffalo'].includes(speciesKey);
        
        const fertThresholds = isC4 ? {
            safe: 3.0,      // < 3 dS/m: fertilise normally
            caution: 5.0,   // 3-5 dS/m: reduce rates, time with irrigation
            restrict: 7.0,  // 5-7 dS/m: minimal fertiliser, foliar only
            avoid: 10.0     // > 7 dS/m: no granular fertiliser
        } : {
            safe: 2.0,      // < 2 dS/m: fertilise normally
            caution: 3.0,   // 2-3 dS/m: reduce rates
            restrict: 4.5,  // 3-4.5 dS/m: minimal, foliar preferred
            avoid: 6.0      // > 4.5 dS/m: avoid granular fertiliser
        };
        
        let status, canFertilise, message, recommendation;
        
        if (soilECe < fertThresholds.safe) {
            status = 'safe';
            canFertilise = true;
            message = 'Soil EC low - fertiliser application safe';
            recommendation = 'Apply fertiliser as per program. Monitor EC after application.';
        } else if (soilECe < fertThresholds.caution) {
            status = 'caution';
            canFertilise = true;
            message = 'Soil EC moderate - reduce fertiliser rates';
            recommendation = 'Reduce granular rates by 25-50%. Apply before irrigation to flush. Consider foliar applications.';
        } else if (soilECe < fertThresholds.restrict) {
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
            status: status,
            canFertilise: canFertilise,
            message: message,
            recommendation: recommendation,
            soilECe: soilECe,
            thresholds: fertThresholds,
            grassType: isC4 ? 'warm-season' : 'cool-season'
        };
    }

    /**
     * Calculate penalty for blended water sources
     */
    function calculateBlendedPenalty(waterSources, species) {
        // Calculate blended EC
        let blendedEC = 0;
        let totalProportion = 0;

        for (const source of waterSources) {
            blendedEC += source.ecDsm * source.proportion;
            totalProportion += source.proportion;
        }

        // Normalize if proportions don't sum to 1
        if (totalProportion > 0 && Math.abs(totalProportion - 1.0) > 0.01) {
            blendedEC = blendedEC / totalProportion;
        }

        // Calculate penalty for blended water
        const result = calculateGrowthPenalty(blendedEC, species);

        // Add source comparison
        const sourceAnalysis = waterSources.map((source, i) => {
            const sourceResult = calculateGrowthPenalty(source.ecDsm, species);
            return {
                sourceIndex: i + 1,
                ecDsm: source.ecDsm,
                proportionPct: Math.round(source.proportion * 100),
                individualPenalty: sourceResult.growthPenaltyPct
            };
        });

        result.blendedECDsm = Math.round(blendedEC * 100) / 100;
        result.sourceAnalysis = sourceAnalysis;
        result.isBlend = true;

        return result;
    }

    /**
     * Find maximum safe EC for a target yield percentage
     */
    function findMaxSafeEC(species, targetYieldPct = 90) {
        const speciesKey = getSpeciesKey(species);
        const params = SPECIES_TOLERANCE[speciesKey];

        if (!params) {
            return { error: true, message: 'Unknown species' };
        }

        const threshold = params.thresholdECw;
        const slope = params.slope;

        // Maximum allowed penalty
        const maxPenalty = 100 - targetYieldPct;

        // Solve for EC: penalty = slope × (EC - threshold)
        // EC = (penalty / slope) + threshold
        const maxEC = (maxPenalty / slope) + threshold;

        return {
            species: speciesKey,
            targetYieldPct: targetYieldPct,
            thresholdECw: threshold,
            maxSafeECw: Math.round(maxEC * 100) / 100,
            allowablePenalty: maxPenalty,
            interpretation: `To maintain ${targetYieldPct}% yield, irrigation EC should not exceed ${maxEC.toFixed(1)} dS/m`
        };
    }

    /**
     * Compare species tolerance at a given EC
     */
    function compareSpeciesTolerance(ecwDsm, speciesList = null) {
        const species = speciesList || Object.keys(SPECIES_TOLERANCE).filter(k => k !== 'generic');
        
        const comparisons = species.map(sp => {
            const result = calculateGrowthPenalty(ecwDsm, sp);
            if (!result.error) {
                return {
                    species: sp,
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

        // Sort by penalty (best performers first)
        comparisons.sort((a, b) => a.growthPenaltyPct - b.growthPenaltyPct);

        return {
            ecwInput: ecwDsm,
            comparisons: comparisons,
            bestChoice: comparisons[0] || null,
            worstChoice: comparisons[comparisons.length - 1] || null
        };
    }

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

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

    function getMarginStatus(margin, threshold) {
        if (margin >= threshold * 0.5) return 'comfortable';
        if (margin >= 0) return 'tight';
        if (margin >= -(threshold * 0.5)) return 'exceeded';
        return 'greatly_exceeded';
    }

    function getManagementAdvice(status, ecw, threshold, species, soilECe, fertGuidance) {
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
        
        // Add soil EC specific advice if provided
        if (soilECe && soilECe > 0) {
            if (soilECe > threshold * 2) {
                advice.push('SOIL EC CRITICAL: Prioritise leaching before any fertiliser');
            } else if (soilECe > threshold * 1.5) {
                advice.push('Soil EC elevated - reduce fertiliser rates, apply with irrigation');
            }
        }
        
        // Add fertiliser guidance if provided
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

    // ========================================================================
    // UI RENDERING
    // ========================================================================

    /**
     * Render salinity penalty card for water quality display
     */
    function renderSalinityPenaltyCard(result) {
        if (!result || result.error) {
            return '';
        }

        const cardId = `salinity-penalty-${Date.now()}`;
        
        // Fertiliser status indicator
        const fertStatus = result.fertGuidance?.status || 'unknown';
        const fertColor = fertStatus === 'safe' ? '#16a34a' : 
                         fertStatus === 'caution' ? '#ca8a04' :
                         fertStatus === 'restrict' ? '#ea580c' :
                         fertStatus === 'avoid' ? '#dc2626' : 'var(--gaip-text-secondary)';
        const fertIcon = fertStatus === 'safe' ? '✓' : 
                        fertStatus === 'caution' ? '⚠' :
                        fertStatus === 'restrict' ? '⛔' :
                        fertStatus === 'avoid' ? '🚫' : '?';

        return `
            <div class="gaip-diagnostic-card salinity-penalty-card">
                <div class="gaip-verdict">
                    <span class="gaip-status-indicator ${result.statusClass}"></span>
                    <span class="gaip-status-text">Growth Impact: ${result.statusLabel}</span>
                </div>
                
                <div class="gaip-primary-value">
                    <span class="gaip-value">${result.relativeYieldPct}%</span>
                    <span class="gaip-unit">relative yield</span>
                </div>
                
                <div class="gaip-salinity-summary">
                    <p><strong>${result.speciesLabel}</strong> tolerance: ${result.toleranceLabel}</p>
                    ${result.growthPenaltyPct > 0 
                        ? `<p class="gaip-penalty-highlight">Yield reduced by ${result.growthPenaltyPct}%</p>` 
                        : `<p class="gaip-safe-highlight">EC below damage threshold</p>`
                    }
                </div>
                
                ${result.soilECe ? `
                <div class="gaip-fert-guidance" style="margin: 8px 0; padding: 8px; background: ${fertColor}15; border-left: 3px solid ${fertColor}; border-radius: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">${fertIcon}</span>
                        <strong style="color: ${fertColor};">Fertiliser: ${result.fertGuidance?.message || 'Unknown'}</strong>
                    </div>
                    <p style="margin: 4px 0 0 22px; font-size: 11px; color: var(--gaip-text);">${result.fertGuidance?.recommendation || ''}</p>
                </div>
                ` : ''}
                
                <button class="gaip-expand-btn" data-target="why-${cardId}">
                    Why? <span class="gaip-icon">▼</span>
                </button>
                
                <div id="why-${cardId}" class="gaip-why-section gaip-collapsed" style="max-height: 0; overflow: hidden; opacity: 0; transition: all 0.3s ease;">
                    <div class="gaip-why-content">
                        <div class="gaip-salinity-detail">
                            <p><strong>Water ECw:</strong> ${result.ecwInput} dS/m</p>
                            ${result.soilECe ? `<p><strong>Soil ECe:</strong> ${result.soilECe} dS/m</p>` : ''}
                            <p><strong>Species Threshold (water):</strong> ${result.thresholdECw} dS/m</p>
                            ${result.thresholdECe ? `<p><strong>Species Threshold (soil):</strong> ${result.thresholdECe.toFixed(1)} dS/m</p>` : ''}
                            <p><strong>Safety Margin:</strong> ${result.safetyMarginDsm > 0 ? '+' : ''}${result.safetyMarginDsm} dS/m</p>
                            <p><strong>Slope:</strong> ${result.slopePctPerDsm}% per dS/m above threshold</p>
                            
                            ${result.soilECe && result.penaltySoil > 0 ? `
                            <p style="margin-top: 8px; padding: 6px; background: var(--gaip-warning-bg); border-radius: 4px;">
                                <strong>Note:</strong> Soil EC (${result.soilECe} dS/m) contributing ${result.penaltySoil}% penalty.
                                ${result.penaltySoil > result.penaltyWater ? ' Soil salinity is the limiting factor.' : ''}
                            </p>
                            ` : ''}
                        </div>
                        
                        <p class="gaip-species-note"><em>${result.speciesNotes}</em></p>
                        
                        ${result.managementAdvice.length > 0 ? `
                            <div class="gaip-recommendations">
                                <p><strong>Management:</strong></p>
                                <ul>
                                    ${result.managementAdvice.map(a => `<li>${a}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Toggle detail panel
     */
    window.gaip_toggle_salinity_detail = function(cardId) {
        const panel = document.getElementById(cardId);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    };

    // ========================================================================
    // INTEGRATION WITH WATER MODULE
    // ========================================================================

    /**
     * Hook into water quality progressive disclosure
     * Adds salinity penalty after EC card
     */
    function integrateWithWaterModule() {
        // Store original render function if it exists
        const originalRender = window.renderWaterProgressiveDisclosure;

        if (typeof originalRender === 'function') {
            window.renderWaterProgressiveDisclosure = function(waterResults, state) {
                // Call original
                let html = originalRender(waterResults, state);

                // Add salinity penalty card if we have EC data
                const ecw = state?.water?.ecw;
                const soilEC1_5 = state?.soil?.EC1_5;  // Measured 1:5 extract EC
                const soilECe = state?.soil?.ECe;      // Calculated equivalent saturated paste EC
                const soilTexture = state?.soil?.soilTexture || 'loam';
                const species = state?.turf?.grassSpecies;

                if (ecw && ecw > 0 && species) {
                    // Pass soil ECe (calculated from EC1:5) to penalty calculation
                    const penalty = calculateGrowthPenalty(ecw, species, soilECe);
                    
                    // Store globally for word export - include EC1:5 and texture
                    window.GAIP_SALINITY_RESULT = {
                        ...penalty,
                        soilEC1_5: soilEC1_5 || null,
                        soilTexture: soilTexture
                    };
                    
                    const penaltyCard = renderSalinityPenaltyCard(penalty);

                    // Insert after the EC card (before closing container)
                    if (penaltyCard && html.includes('gaip-water-cards-grid')) {
                        html = html.replace(
                            '</div><!-- end cards grid -->',
                            penaltyCard + '</div><!-- end cards grid -->'
                        );
                    }
                }

                return html;
            };

        } else {
            // Create helper for manual integration
            window.gaip_salinity_get_card = function(state) {
                const ecw = state?.water?.ecw;
                const species = state?.turf?.grassSpecies;

                if (ecw && ecw > 0 && species) {
                    const penalty = calculateGrowthPenalty(ecw, species);
                    return renderSalinityPenaltyCard(penalty);
                }
                return '';
            };

        }
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    window.gaip_salinity_penalty = calculateGrowthPenalty;
    window.gaip_salinity_blended = calculateBlendedPenalty;
    window.gaip_salinity_max_ec = findMaxSafeEC;
    window.gaip_salinity_compare = compareSpeciesTolerance;
    window.gaip_salinity_render_card = renderSalinityPenaltyCard;

    window.GAIP_SALINITY_TOLERANCE = SPECIES_TOLERANCE;
    window.GAIP_SALINITY_CLASSES = TOLERANCE_CLASSES;
    window.GAIP_SALINITY_CONFIG = SALINITY_CONFIG;

    // Initialize integration
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', integrateWithWaterModule);
    } else {
        integrateWithWaterModule();
    }


})();
