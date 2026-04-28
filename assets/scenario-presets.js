/**
 * =============================================================================
 * GILBA HUB SCENARIO PRESETS v1.0.0
 * =============================================================================
 * 
 * Pre-configured scenario modifications for common "what-if" analyses.
 * Integrates with GilbaCascadeOrchestrator.runCascade() to produce
 * complete scenario comparisons.
 * 
 * PRESET CATEGORIES:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. METHODOLOGY: MLSN ↔ SLAN threshold switching
 * 2. GYPSUM: Soil sodicity remediation scenarios  
 * 3. WATER BLEND: Multi-source irrigation blending
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 *   // Get preset modifications
 *   const mods = GilbaScenarioPresets.gypsum.withAmendment(soilState);
 *   
 *   // Run through cascade
 *   const result = await GilbaCascadeOrchestrator.runCascade(baseState, mods);
 *   
 *   // Or use convenience wrapper
 *   const comparison = await GilbaScenarioPresets.compare('gypsum', baseState);
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const PRESETS_VERSION = '1.0.0';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        debug: false,
        
        // MLSN minimum thresholds (Michalski et al.)
        mlsnThresholds: {
            P: 21,      // ppm Mehlich-3
            K: 37,      // ppm
            Ca: 331,    // ppm
            Mg: 47,     // ppm
            S: 7        // ppm (some use 6)
        },
        
        // SLAN sufficiency ranges (traditional soil testing)
        slanRanges: {
            P:  { low: 25,  high: 50,   unit: 'ppm' },
            K:  { low: 75,  high: 150,  unit: 'ppm' },
            Ca: { low: 500, high: 1000, unit: 'ppm' },
            Mg: { low: 60,  high: 120,  unit: 'ppm' },
            S:  { low: 15,  high: 30,   unit: 'ppm' }
        },
        
        // Gypsum defaults
        gypsum: {
            defaultPurity: 0.90,        // 90% CaSO₄·2H₂O
            defaultDepth: 0.15,         // 15cm treatment depth
            defaultBulkDensity: 1.45,   // g/cm³ typical rootzone
            targetESP: 5,               // Target ESP %
            conversionConstant: 86,     // CaSO₄·2H₂O stoichiometry
            minECForEffectiveness: 0.3  // dS/m - below this gypsum less effective
        },
        
        // Common water blend scenarios
        waterBlendPresets: {
            'bore-mains-50-50': {
                label: '50% Bore + 50% Mains',
                fractions: [0.5, 0.5],
                sourceLabels: ['Bore Water', 'Town Mains']
            },
            'maximize-recycled': {
                label: 'Maximum Recycled Water',
                description: 'Use recycled water up to salinity threshold',
                targetEC: 2.0  // dS/m ceiling
            },
            'dilution-for-sar': {
                label: 'SAR Dilution Blend',
                description: 'Blend to achieve target SAR',
                targetSAR: 6
            }
        }
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(category, message, data) {
        if (!CONFIG.debug) return;
        const prefix = `[ScenarioPresets:${category}]`;
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function safeNum(val, fallback = 0) {
        const n = parseFloat(val);
        return isFinite(n) ? n : fallback;
    }

    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (Array.isArray(obj)) return obj.map(item => deepClone(item));
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    // =========================================================================
    // METHODOLOGY PRESETS: MLSN ↔ SLAN
    // =========================================================================

    const methodologyPresets = {
        
        /**
         * Get MLSN interpretation for soil values
         * @param {object} soilValues - { P, K, Ca, Mg, S } in ppm
         * @returns {object} Status for each nutrient
         */
        interpretMLSN(soilValues) {
            const results = {};
            const thresholds = CONFIG.mlsnThresholds;
            
            for (const [nutrient, threshold] of Object.entries(thresholds)) {
                const value = safeNum(soilValues[nutrient]);
                const ratio = value / threshold;
                
                let status, statusClass;
                if (ratio >= 1.5) {
                    status = 'Sufficient';
                    statusClass = 'adequate';
                } else if (ratio >= 1.0) {
                    status = 'Adequate';
                    statusClass = 'adequate';
                } else if (ratio >= 0.75) {
                    status = 'Marginal';
                    statusClass = 'borderline';
                } else {
                    status = 'Deficient';
                    statusClass = 'deficient';
                }
                
                results[nutrient] = {
                    value,
                    threshold,
                    ratio: Math.round(ratio * 100) / 100,
                    status,
                    statusClass,
                    methodology: 'MLSN'
                };
            }
            
            return results;
        },
        
        /**
         * Get SLAN interpretation for soil values
         * @param {object} soilValues - { P, K, Ca, Mg, S } in ppm
         * @returns {object} Status for each nutrient
         */
        interpretSLAN(soilValues) {
            const results = {};
            const ranges = CONFIG.slanRanges;
            
            for (const [nutrient, range] of Object.entries(ranges)) {
                const value = safeNum(soilValues[nutrient]);
                
                let status, statusClass;
                if (value >= range.high) {
                    status = 'High';
                    statusClass = 'adequate';
                } else if (value >= range.low) {
                    status = 'Sufficient';
                    statusClass = 'adequate';
                } else if (value >= range.low * 0.75) {
                    status = 'Low';
                    statusClass = 'borderline';
                } else {
                    status = 'Deficient';
                    statusClass = 'deficient';
                }
                
                results[nutrient] = {
                    value,
                    rangeLow: range.low,
                    rangeHigh: range.high,
                    status,
                    statusClass,
                    methodology: 'SLAN'
                };
            }
            
            return results;
        },
        
        /**
         * Generate modifications to switch from MLSN to SLAN methodology
         * @param {object} currentState - Current hub state
         * @returns {object} Modifications for cascade
         */
        toSLAN(currentState) {
            return {
                'inputs.soil.methodology': 'slan',
                'inputs.soil.thresholds': deepClone(CONFIG.slanRanges),
                'inputs.soil.interpretationMode': 'sufficiency'
            };
        },
        
        /**
         * Generate modifications to switch from SLAN to MLSN methodology
         * @param {object} currentState - Current hub state
         * @returns {object} Modifications for cascade
         */
        toMLSN(currentState) {
            return {
                'inputs.soil.methodology': 'mlsn',
                'inputs.soil.thresholds': deepClone(CONFIG.mlsnThresholds),
                'inputs.soil.interpretationMode': 'minimum'
            };
        },
        
        /**
         * Compare same soil data under both methodologies
         * @param {object} soilValues - { P, K, Ca, Mg, S } in ppm
         * @returns {object} Side-by-side comparison
         */
        compareBothMethodologies(soilValues) {
            const mlsn = this.interpretMLSN(soilValues);
            const slan = this.interpretSLAN(soilValues);
            
            const comparison = {};
            const nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
            
            for (const nutrient of nutrients) {
                comparison[nutrient] = {
                    value: soilValues[nutrient],
                    mlsn: mlsn[nutrient],
                    slan: slan[nutrient],
                    statusDiffers: mlsn[nutrient].status !== slan[nutrient].status
                };
            }
            
            // Count disagreements
            const disagreements = Object.values(comparison)
                .filter(c => c.statusDiffers).length;
            
            return {
                nutrients: comparison,
                summary: {
                    disagreements,
                    note: disagreements > 0 
                        ? `${disagreements} nutrient(s) have different status between methodologies`
                        : 'Both methodologies agree on all nutrient statuses'
                }
            };
        },

        /**
         * Get threshold comparison table
         */
        getThresholdComparison() {
            const nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
            return nutrients.map(n => ({
                nutrient: n,
                mlsnMin: CONFIG.mlsnThresholds[n],
                slanLow: CONFIG.slanRanges[n].low,
                slanHigh: CONFIG.slanRanges[n].high,
                difference: CONFIG.slanRanges[n].low - CONFIG.mlsnThresholds[n],
                differencePercent: Math.round(
                    ((CONFIG.slanRanges[n].low - CONFIG.mlsnThresholds[n]) / CONFIG.mlsnThresholds[n]) * 100
                )
            }));
        }
    };

    // =========================================================================
    // GYPSUM AMENDMENT PRESETS
    // =========================================================================

    const gypsumPresets = {
        
        /**
         * Calculate gypsum requirement based on ESP (primary method)
         * 
         * Formula: GR (t/ha) = (ESP_current - ESP_target) × CEC × ρb × d × 10 / (86 × purity)
         * 
         * @param {object} params - Calculation parameters
         * @param {number} params.espCurrent - Current ESP (%)
         * @param {number} params.espTarget - Target ESP (%), default 5%
         * @param {number} params.cec - Soil CEC (cmol(+)/kg)
         * @param {number} params.bulkDensity - Bulk density (g/cm³)
         * @param {number} params.depth - Treatment depth (m)
         * @param {number} params.purity - Gypsum purity (0-1)
         * @returns {object} Gypsum requirement and metadata
         */
        calculateESPBased(params) {
            const espCurrent = safeNum(params.espCurrent);
            const espTarget = safeNum(params.espTarget, CONFIG.gypsum.targetESP);
            const cec = safeNum(params.cec, 10);
            const bulkDensity = safeNum(params.bulkDensity, CONFIG.gypsum.defaultBulkDensity);
            const depth = safeNum(params.depth, CONFIG.gypsum.defaultDepth);
            const purity = safeNum(params.purity, CONFIG.gypsum.defaultPurity);
            
            // No gypsum needed if already at or below target
            if (espCurrent <= espTarget) {
                return {
                    required: false,
                    rate: 0,
                    unit: 't/ha',
                    reason: `Current ESP (${espCurrent}%) already at or below target (${espTarget}%)`,
                    method: 'ESP-based'
                };
            }
            
            const deltaESP = espCurrent - espTarget;
            const rate = (deltaESP * cec * bulkDensity * depth * 10) / 
                         (CONFIG.gypsum.conversionConstant * purity);
            
            return {
                required: true,
                rate: Math.round(rate * 100) / 100,
                unit: 't/ha',
                deltaESP,
                inputs: { espCurrent, espTarget, cec, bulkDensity, depth, purity },
                method: 'ESP-based',
                staging: this.calculateStaging(rate),
                caSupplied: Math.round(rate * 232), // kg Ca/ha (23.2% Ca in gypsum)
                sSupplied: Math.round(rate * 186)   // kg S/ha (18.6% S in gypsum)
            };
        },
        
        /**
         * Calculate gypsum for irrigation SAR management (secondary method)
         * Use when soil ESP is unknown - manages ongoing sodium loading
         * 
         * @param {object} params - Calculation parameters
         * @param {number} params.sarCurrent - Current irrigation water SAR
         * @param {number} params.sarTarget - Target SAR
         * @param {number} params.waterVolume - Annual irrigation volume (m³/ha)
         * @param {number} params.purity - Gypsum purity (0-1)
         * @returns {object} Gypsum requirement
         */
        calculateSARBased(params) {
            const sarCurrent = safeNum(params.sarCurrent);
            const sarTarget = safeNum(params.sarTarget, 6);
            const waterVolume = safeNum(params.waterVolume, 10000); // m³/ha default
            const purity = safeNum(params.purity, CONFIG.gypsum.defaultPurity);
            
            if (sarCurrent <= sarTarget) {
                return {
                    required: false,
                    rate: 0,
                    unit: 'kg/ha/year',
                    reason: `Current SAR (${sarCurrent}) already at or below target (${sarTarget})`,
                    method: 'SAR-based (irrigation offset)'
                };
            }
            
            const deltaSAR = sarCurrent - sarTarget;
            // 1 meq Ca ≈ 86 mg gypsum per litre
            const rateKg = (deltaSAR * waterVolume * 0.086) / purity;
            
            return {
                required: true,
                rate: Math.round(rateKg),
                unit: 'kg/ha/year',
                ratePerIrrigation: Math.round(rateKg / 52), // Weekly application
                deltaSAR,
                inputs: { sarCurrent, sarTarget, waterVolume, purity },
                method: 'SAR-based (irrigation offset)',
                note: 'Annual rate to offset sodium loading from irrigation'
            };
        },
        
        /**
         * Calculate application staging for large requirements
         * @param {number} totalRate - Total gypsum rate (t/ha)
         * @returns {object} Staging recommendation
         */
        calculateStaging(totalRate) {
            if (totalRate <= 2) {
                return {
                    applications: 1,
                    ratePerApplication: totalRate,
                    schedule: 'Single application',
                    note: 'Can be applied in one pass'
                };
            }
            
            if (totalRate <= 5) {
                return {
                    applications: 2,
                    ratePerApplication: Math.round(totalRate / 2 * 100) / 100,
                    schedule: 'Split: Autumn + Spring',
                    note: 'Split application improves dissolution and reduces surface crusting'
                };
            }
            
            // Large requirements: annual staging
            const yearsNeeded = Math.ceil(totalRate / 3);
            return {
                applications: yearsNeeded,
                ratePerApplication: Math.round(totalRate / yearsNeeded * 100) / 100,
                schedule: `${yearsNeeded}-year program (${Math.round(totalRate/yearsNeeded * 10)/10} t/ha/year)`,
                note: 'Staged remediation program - retest soil annually'
            };
        },
        
        /**
         * Check constraints for gypsum effectiveness
         * @param {object} soilData - Soil parameters
         * @returns {object} Constraint check results
         */
        checkConstraints(soilData) {
            const warnings = [];
            const blockers = [];
            
            const ec = safeNum(soilData.ec || soilData.EC);
            const sand = safeNum(soilData.sand);
            const cec = safeNum(soilData.cec || soilData.CEC);
            
            // Low EC warning
            if (ec > 0 && ec < CONFIG.gypsum.minECForEffectiveness) {
                warnings.push({
                    type: 'low-ec',
                    message: `EC (${ec} dS/m) below ${CONFIG.gypsum.minECForEffectiveness} dS/m — gypsum may not prevent dispersion`,
                    recommendation: 'Consider combining with organic matter or PAM'
                });
            }
            
            // Sand-dominant rootzone
            if (sand > 85) {
                warnings.push({
                    type: 'high-sand',
                    message: `High sand content (${sand}%) — limited CEC reduces gypsum retention`,
                    recommendation: 'Frequent light applications more effective than heavy single dose'
                });
            }
            
            // Very low CEC
            if (cec > 0 && cec < 3) {
                warnings.push({
                    type: 'low-cec',
                    message: `Very low CEC (${cec} cmol/kg) — limited exchange capacity`,
                    recommendation: 'Consider calcium chloride for faster response, gypsum for maintenance'
                });
            }
            
            return {
                canProceed: blockers.length === 0,
                warnings,
                blockers,
                summary: blockers.length > 0 
                    ? 'Gypsum application not recommended'
                    : warnings.length > 0
                        ? `Proceed with caution (${warnings.length} warning${warnings.length > 1 ? 's' : ''})`
                        : 'No constraints identified'
            };
        },
        
        /**
         * Generate modifications for "with gypsum" scenario
         * @param {object} currentState - Current hub state
         * @param {object} options - Amendment options
         * @returns {object} Modifications for cascade
         */
        withAmendment(currentState, options = {}) {
            const soil = currentState?.inputs?.soil || currentState?.soil || {};
            
            // Calculate requirement
            const requirement = this.calculateESPBased({
                espCurrent: soil.esp || soil.ESP || options.espCurrent || 10,
                espTarget: options.espTarget || CONFIG.gypsum.targetESP,
                cec: soil.cec || soil.CEC || options.cec || 10,
                bulkDensity: soil.bulkDensity || options.bulkDensity,
                depth: options.depth,
                purity: options.purity
            });
            
            if (!requirement.required) {
                return {
                    _noChange: true,
                    _reason: requirement.reason
                };
            }
            
            // Calculate post-amendment ESP
            const newESP = requirement.inputs.espTarget;
            
            // Estimate SAR reduction (simplified)
            const currentSAR = soil.sar || soil.SAR || 10;
            const sarReduction = (requirement.deltaESP / requirement.inputs.espCurrent) * currentSAR * 0.7;
            const newSAR = Math.max(1, currentSAR - sarReduction);
            
            return {
                'inputs.soil.gypsum': {
                    applied: true,
                    rate: requirement.rate,
                    unit: requirement.unit,
                    staging: requirement.staging,
                    caAdded: requirement.caSupplied,
                    sAdded: requirement.sSupplied
                },
                'inputs.soil.esp': newESP,
                'inputs.soil.sar': Math.round(newSAR * 10) / 10,
                'inputs.soil.ca': (soil.ca || soil.Ca || 500) + requirement.caSupplied * 0.5, // ~50% remains plant-available
                'inputs.soil.s': (soil.s || soil.S || 10) + requirement.sSupplied * 0.3,
                '_metadata': {
                    presetType: 'gypsum-amendment',
                    requirement,
                    label: `With Gypsum (${requirement.rate} ${requirement.unit})`
                }
            };
        },
        
        /**
         * Generate "without gypsum" baseline (essentially identity)
         */
        withoutAmendment(currentState) {
            return {
                'inputs.soil.gypsum': {
                    applied: false,
                    rate: 0
                },
                '_metadata': {
                    presetType: 'gypsum-baseline',
                    label: 'Current (No Gypsum)'
                }
            };
        }
    };

    // =========================================================================
    // WATER BLEND PRESETS
    // =========================================================================

    const waterBlendPresets = {
        
        /**
         * Calculate optimal blend ratio to achieve target EC
         * @param {Array} sources - Array of water source objects with EC
         * @param {number} targetEC - Target blended EC (dS/m)
         * @returns {object} Blend configuration
         */
        blendForTargetEC(sources, targetEC) {
            if (!sources || sources.length < 2) {
                return { error: 'Need at least 2 sources to blend' };
            }
            
            // Sort by EC
            const sorted = [...sources].sort((a, b) => 
                safeNum(a.EC_dSm || a.ec) - safeNum(b.EC_dSm || b.ec)
            );
            
            const lowEC = safeNum(sorted[0].EC_dSm || sorted[0].ec);
            const highEC = safeNum(sorted[sorted.length - 1].EC_dSm || sorted[sorted.length - 1].ec);
            
            // Check if target is achievable
            if (targetEC < lowEC) {
                return {
                    achievable: false,
                    error: `Target EC (${targetEC}) below lowest source (${lowEC})`,
                    recommendation: `Use 100% ${sorted[0].label || 'lowest EC source'}`
                };
            }
            
            if (targetEC > highEC) {
                return {
                    achievable: false,
                    error: `Target EC (${targetEC}) above highest source (${highEC})`,
                    recommendation: 'Target not achievable with available sources'
                };
            }
            
            // Two-source blend calculation
            // EC_blend = f1 * EC1 + f2 * EC2, where f1 + f2 = 1
            // f1 = (EC2 - EC_target) / (EC2 - EC1)
            const f1 = (highEC - targetEC) / (highEC - lowEC);
            const f2 = 1 - f1;
            
            return {
                achievable: true,
                fractions: [Math.round(f1 * 100) / 100, Math.round(f2 * 100) / 100],
                sources: [
                    { ...sorted[0], fraction: f1 },
                    { ...sorted[sorted.length - 1], fraction: f2 }
                ],
                targetEC,
                actualEC: f1 * lowEC + f2 * highEC,
                label: `${Math.round(f1 * 100)}% ${sorted[0].label || 'Source 1'} + ${Math.round(f2 * 100)}% ${sorted[sorted.length - 1].label || 'Source 2'}`
            };
        },
        
        /**
         * Calculate optimal blend ratio to achieve target SAR
         * @param {Array} sources - Array of water source objects with full chemistry
         * @param {number} targetSAR - Target blended SAR
         * @returns {object} Blend configuration
         */
        blendForTargetSAR(sources, targetSAR) {
            if (!sources || sources.length < 2) {
                return { error: 'Need at least 2 sources to blend' };
            }
            
            // Calculate SAR for each source
            const withSAR = sources.map(src => {
                const Ca_meq = safeNum(src.Ca) / 20.04;
                const Mg_meq = safeNum(src.Mg) / 12.15;
                const Na_meq = safeNum(src.Na) / 23.0;
                const sar = Na_meq / Math.sqrt(Math.max((Ca_meq + Mg_meq) / 2, 0.001));
                return { ...src, calculatedSAR: sar };
            });
            
            // Sort by SAR
            const sorted = withSAR.sort((a, b) => a.calculatedSAR - b.calculatedSAR);
            
            const lowSAR = sorted[0].calculatedSAR;
            const highSAR = sorted[sorted.length - 1].calculatedSAR;
            
            if (targetSAR < lowSAR || targetSAR > highSAR) {
                return {
                    achievable: false,
                    error: `Target SAR (${targetSAR}) outside achievable range (${lowSAR.toFixed(1)} - ${highSAR.toFixed(1)})`,
                    recommendation: targetSAR < lowSAR 
                        ? `Use 100% ${sorted[0].label || 'lowest SAR source'}`
                        : 'Consider gypsum injection or alternative source'
                };
            }
            
            // Note: SAR blending is non-linear, this is an approximation
            // For accurate results, use iterative calculation via water blender
            const f1 = (highSAR - targetSAR) / (highSAR - lowSAR);
            const f2 = 1 - f1;
            
            return {
                achievable: true,
                fractions: [Math.round(f1 * 100) / 100, Math.round(f2 * 100) / 100],
                sources: [
                    { ...sorted[0], fraction: f1 },
                    { ...sorted[sorted.length - 1], fraction: f2 }
                ],
                targetSAR,
                estimatedSAR: f1 * lowSAR + f2 * highSAR,
                note: 'SAR blending is non-linear — verify with full chemistry calculation',
                label: `${Math.round(f1 * 100)}% ${sorted[0].label || 'Low SAR'} + ${Math.round(f2 * 100)}% ${sorted[sorted.length - 1].label || 'High SAR'}`
            };
        },
        
        /**
         * Maximize use of a specific source (e.g., recycled water) within constraints
         * @param {object} primarySource - The source to maximize
         * @param {object} dilutionSource - The dilution source
         * @param {object} constraints - { maxEC, maxSAR, maxCl, maxB }
         * @returns {object} Maximum blend configuration
         */
        maximizeSource(primarySource, dilutionSource, constraints = {}) {
            const maxEC = constraints.maxEC || 3.0;
            const maxSAR = constraints.maxSAR || 9;
            const maxCl = constraints.maxCl || 350;
            
            const primary = {
                ec: safeNum(primarySource.EC_dSm || primarySource.ec),
                cl: safeNum(primarySource.Cl),
                label: primarySource.label || 'Primary'
            };
            
            const dilution = {
                ec: safeNum(dilutionSource.EC_dSm || dilutionSource.ec),
                cl: safeNum(dilutionSource.Cl),
                label: dilutionSource.label || 'Dilution'
            };
            
            // Find limiting constraint
            let maxFraction = 1.0;
            let limitingFactor = 'none';
            
            // EC constraint
            if (primary.ec > maxEC) {
                const ecFraction = (maxEC - dilution.ec) / (primary.ec - dilution.ec);
                if (ecFraction < maxFraction) {
                    maxFraction = ecFraction;
                    limitingFactor = 'EC';
                }
            }
            
            // Chloride constraint
            if (primary.cl > maxCl) {
                const clFraction = (maxCl - dilution.cl) / (primary.cl - dilution.cl);
                if (clFraction < maxFraction) {
                    maxFraction = clFraction;
                    limitingFactor = 'Chloride';
                }
            }
            
            maxFraction = Math.max(0, Math.min(1, maxFraction));
            
            return {
                maxPrimaryFraction: Math.round(maxFraction * 100) / 100,
                dilutionFraction: Math.round((1 - maxFraction) * 100) / 100,
                limitingFactor,
                blendedEC: maxFraction * primary.ec + (1 - maxFraction) * dilution.ec,
                blendedCl: maxFraction * primary.cl + (1 - maxFraction) * dilution.cl,
                label: `${Math.round(maxFraction * 100)}% ${primary.label} (max)`,
                savings: maxFraction > 0 
                    ? `Can use ${Math.round(maxFraction * 100)}% ${primary.label}`
                    : `Cannot use ${primary.label} — ${limitingFactor} constraint`
            };
        },
        
        /**
         * Generate modifications for a water blend scenario
         * @param {object} currentState - Current hub state
         * @param {object} blendConfig - Blend configuration from above functions
         * @returns {object} Modifications for cascade
         */
        applyBlend(currentState, blendConfig) {
            if (!blendConfig || !blendConfig.sources) {
                return { _error: 'Invalid blend configuration' };
            }
            
            return {
                'inputs.water.sources': blendConfig.sources,
                'inputs.water.fractions': blendConfig.fractions,
                'inputs.water.blendMode': 'custom',
                'inputs.water.targetEC': blendConfig.targetEC,
                'inputs.water.targetSAR': blendConfig.targetSAR,
                '_metadata': {
                    presetType: 'water-blend',
                    label: blendConfig.label,
                    limitingFactor: blendConfig.limitingFactor
                }
            };
        },
        
        /**
         * Common preset: 50/50 bore + mains
         */
        preset5050(boreSource, mainsSource) {
            return {
                fractions: [0.5, 0.5],
                sources: [
                    { ...boreSource, fraction: 0.5, label: boreSource.label || 'Bore Water' },
                    { ...mainsSource, fraction: 0.5, label: mainsSource.label || 'Town Mains' }
                ],
                label: '50% Bore + 50% Mains'
            };
        }
    };

    // =========================================================================
    // CONVENIENCE WRAPPERS
    // =========================================================================

    /**
     * Run a preset comparison through the cascade orchestrator
     * @param {string} presetType - 'methodology', 'gypsum', 'waterBlend'
     * @param {object} baseState - Current hub state
     * @param {object} options - Preset-specific options
     * @returns {Promise<object>} Comparison result
     */
    async function runPresetComparison(presetType, baseState, options = {}) {
        if (!global.GilbaCascadeOrchestrator) {
            return { error: 'Cascade orchestrator not available' };
        }
        
        let baselineMods = {};
        let scenarioMods = {};
        let baselineLabel = 'Current';
        let scenarioLabel = 'Modified';
        
        switch (presetType) {
            case 'methodology':
            case 'mlsn-to-slan':
                baselineMods = methodologyPresets.toMLSN(baseState);
                scenarioMods = methodologyPresets.toSLAN(baseState);
                baselineLabel = 'MLSN Interpretation';
                scenarioLabel = 'SLAN Interpretation';
                break;
                
            case 'slan-to-mlsn':
                baselineMods = methodologyPresets.toSLAN(baseState);
                scenarioMods = methodologyPresets.toMLSN(baseState);
                baselineLabel = 'SLAN Interpretation';
                scenarioLabel = 'MLSN Interpretation';
                break;
                
            case 'gypsum':
            case 'gypsum-amendment':
                baselineMods = gypsumPresets.withoutAmendment(baseState);
                scenarioMods = gypsumPresets.withAmendment(baseState, options);
                baselineLabel = 'Without Gypsum';
                scenarioLabel = scenarioMods._metadata?.label || 'With Gypsum Amendment';
                break;
                
            case 'water-blend':
                if (!options.blendConfig) {
                    return { error: 'blendConfig required for water-blend preset' };
                }
                baselineMods = {}; // Current water state
                scenarioMods = waterBlendPresets.applyBlend(baseState, options.blendConfig);
                baselineLabel = 'Current Water Source';
                scenarioLabel = options.blendConfig.label || 'Blended Water';
                break;
                
            default:
                return { error: `Unknown preset type: ${presetType}` };
        }
        
        // Handle no-change scenarios
        if (scenarioMods._noChange) {
            return {
                success: true,
                noChange: true,
                reason: scenarioMods._reason,
                baselineLabel,
                scenarioLabel
            };
        }
        
        // Run both cascades
        const [baselineResult, scenarioResult] = await Promise.all([
            global.GilbaCascadeOrchestrator.runCascade(baseState, baselineMods),
            global.GilbaCascadeOrchestrator.runCascade(baseState, scenarioMods)
        ]);
        
        // Generate diff if scenario engine available
        let diff = null;
        if (global.GilbaScenarioEngine?.generateDiffPayload) {
            diff = global.GilbaScenarioEngine.generateDiffPayload(
                baselineResult.state,
                scenarioResult.state,
                { baselineLabel, modifiedLabel: scenarioLabel }
            );
        }
        
        return {
            success: true,
            baseline: {
                label: baselineLabel,
                state: baselineResult.state,
                metadata: baselineResult.metadata
            },
            scenario: {
                label: scenarioLabel,
                state: scenarioResult.state,
                metadata: scenarioResult.metadata,
                modifications: scenarioMods
            },
            diff,
            presetType
        };
    }

    /**
     * Preview what a preset would modify (without running cascade)
     */
    function previewPreset(presetType, baseState, options = {}) {
        switch (presetType) {
            case 'methodology':
            case 'mlsn-to-slan':
                return {
                    type: 'methodology',
                    from: 'MLSN',
                    to: 'SLAN',
                    modifications: methodologyPresets.toSLAN(baseState),
                    thresholdComparison: methodologyPresets.getThresholdComparison()
                };
                
            case 'gypsum':
                const gypsumMods = gypsumPresets.withAmendment(baseState, options);
                const constraints = gypsumPresets.checkConstraints(baseState?.inputs?.soil || {});
                return {
                    type: 'gypsum',
                    modifications: gypsumMods,
                    requirement: gypsumMods._metadata?.requirement,
                    constraints
                };
                
            case 'water-blend':
                return {
                    type: 'water-blend',
                    modifications: options.blendConfig 
                        ? waterBlendPresets.applyBlend(baseState, options.blendConfig)
                        : { _error: 'blendConfig required' },
                    availablePresets: Object.keys(CONFIG.waterBlendPresets)
                };
                
            default:
                return { error: `Unknown preset type: ${presetType}` };
        }
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaScenarioPresets = {
        version: PRESETS_VERSION,
        
        // Methodology presets
        methodology: methodologyPresets,
        
        // Gypsum presets
        gypsum: gypsumPresets,
        
        // Water blend presets
        waterBlend: waterBlendPresets,
        
        // Convenience functions
        compare: runPresetComparison,
        preview: previewPreset,
        
        // Configuration access
        getConfig: () => deepClone(CONFIG),
        getMLSNThresholds: () => deepClone(CONFIG.mlsnThresholds),
        getSLANRanges: () => deepClone(CONFIG.slanRanges)
    };


})(typeof window !== 'undefined' ? window : this);
