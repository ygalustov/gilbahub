/**
 * =============================================================================
 * GILBA HUB ENGINE CONFIDENCE v2.1.0
 * =============================================================================
 * 
 * Standardizes applicability and confidence assessment across all engines.
 * Required for Phase 2 A/B comparison to answer:
 * "Can I meaningfully compare these two scenarios?"
 * 
 * Features:
 * - Wraps engine outputs with standardized _meta object
 * - Assesses applicability per engine based on input state
 * - Assesses confidence based on input completeness and validation status
 * - Provides comparison eligibility check
 * 
 * v2.1.0: Fixed climate source detection
 *         - Checks window.climateMetrics, state.computed.climate, state.inputs.climate
 *         - Infers API source if real temperature data present
 * 
 * v2.0.0: Added safeSpecies() to handle species as object or string
 *         - Fixes TypeError when species is blend info object
 *         - Added input completeness checker
 *         - Added confidence accumulation
 *         - Added forecast day degradation
 *         - Added low confidence warnings
 * 
 * @author Gilba Solutions
 * @version 2.1.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const CONFIDENCE_VERSION = '2.1.1';

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /**
     * Safely extract species as a string from various input formats
     * Handles: string, object with grassSpecies/species/effectiveSpecies, null, undefined
     * @param {any} input - Species value (string or object)
     * @param {string} fallback - Default value if extraction fails
     * @returns {string}
     */
    function safeSpecies(input, fallback = '') {
        if (!input) return fallback;
        if (typeof input === 'string') return input;
        if (typeof input === 'object') {
            // Handle various object formats
            return input.grassSpecies || 
                   input.effectiveSpecies || 
                   input.baseSpecies ||
                   input.species ||
                   input.value || 
                   input.name ||
                   (typeof input.id === 'string' ? input.id : null) ||
                   fallback;
        }
        return fallback;
    }

    // =========================================================================
    // CONFIDENCE LEVELS
    // =========================================================================

    const CONFIDENCE_LEVELS = {
        HIGH: { level: 'high', score: 90, color: '#059669', label: 'High Confidence' },
        MEDIUM: { level: 'medium', score: 70, color: '#d97706', label: 'Medium Confidence' },
        LOW: { level: 'low', score: 40, color: '#dc2626', label: 'Low Confidence' },
        INSUFFICIENT: { level: 'insufficient', score: 10, color: 'var(--gaip-text-secondary)', label: 'Insufficient Data' }
    };

    /**
     * String-to-score mapping for backward compatibility
     * Maps string confidence levels (used throughout codebase) to numeric scores
     * @type {Object.<string, number>}
     */
    const CONFIDENCE_SCORES = {
        'high': 90,
        'medium': 70,
        'medium-high': 80,
        'medium-low': 55,
        'low': 40,
        'low-medium': 55,
        'indicative': 20,
        'insufficient': 10,
        'insufficient data': 10,
        'none': 0
    };

    /**
     * Convert a string confidence level to a numeric score (0-100)
     * Backward-compatible: accepts string, number, or object with level/score
     * @param {string|number|object} confidence - Confidence value in any format
     * @returns {number} Numeric score 0-100
     */
    function levelToScore(confidence) {
        // Already numeric
        if (typeof confidence === 'number') {
            return Math.max(0, Math.min(100, Math.round(confidence)));
        }
        
        // Object with score property
        if (confidence && typeof confidence === 'object') {
            if (typeof confidence.score === 'number') {
                return Math.max(0, Math.min(100, Math.round(confidence.score)));
            }
            if (typeof confidence.level === 'string') {
                return CONFIDENCE_SCORES[confidence.level.toLowerCase()] || 50;
            }
        }
        
        // String level
        if (typeof confidence === 'string') {
            const normalized = confidence.toLowerCase().trim();
            if (CONFIDENCE_SCORES.hasOwnProperty(normalized)) {
                return CONFIDENCE_SCORES[normalized];
            }
            // Handle conditional patterns like "P >= 0.7 ? high : medium" results
            if (normalized.includes('high')) return 90;
            if (normalized.includes('medium')) return 70;
            if (normalized.includes('low')) return 40;
        }
        
        // Default fallback
        return 50;
    }

    /**
     * Convert a numeric score to a string confidence level
     * @param {number} score - Numeric score 0-100
     * @returns {string} String level: 'high', 'medium', 'low', or 'insufficient'
     */
    function scoreToLevel(score) {
        if (typeof score !== 'number') return 'medium';
        if (score >= 80) return 'high';
        if (score >= 60) return 'medium';
        if (score >= 30) return 'low';
        return 'insufficient';
    }

    /**
     * Create a standardized confidence object with both string level and numeric score
     * Use this when returning confidence from any engine for consistency
     * @param {string|number|object} input - Confidence in any format
     * @returns {object} { level: string, score: number, color: string, label: string }
     */
    function normalizeConfidence(input) {
        const score = levelToScore(input);
        const level = scoreToLevel(score);
        const meta = CONFIDENCE_LEVELS[level.toUpperCase()] || CONFIDENCE_LEVELS.MEDIUM;
        
        return {
            level: level,
            score: score,
            color: meta.color,
            label: meta.label
        };
    }

    // =========================================================================
    // ENGINE APPLICABILITY RULES
    // =========================================================================

    /**
     * Each engine has rules defining when it's applicable and what affects confidence
     */
    const ENGINE_RULES = {
        
        'disease-engine': {
            requiredInputs: ['climate'],
            optionalInputs: ['tissue', 'turf', 'shade', 'dew'],
            applicabilityCheck: function(state) {
                const climate = state.inputs?.climate || state.computed?.climate;
                if (!climate) {
                    return { applicable: false, reason: 'No climate data available' };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 70; // Base score
                
                // Climate source
                if (state.inputs?.climate?.source === 'api') {
                    score += 10;
                    factors.push({ factor: 'Live weather data', impact: +10 });
                } else if (state.inputs?.climate?.source === 'manual') {
                    factors.push({ factor: 'Manual weather input', impact: 0 });
                }
                
                // Tissue data for nutrient-disease interactions
                if (state.inputs?.tissue || state.computed?.tissue) {
                    score += 10;
                    factors.push({ factor: 'Tissue data available', impact: +10 });
                } else {
                    score -= 10;
                    factors.push({ factor: 'No tissue data - nutrient interactions estimated', impact: -10 });
                }
                
                // Dew/leaf wetness
                if (state.computed?.dew?.leafWetness) {
                    score += 5;
                    factors.push({ factor: 'Leaf wetness calculated', impact: +5 });
                }
                
                // Species-specific susceptibility
                if (state.inputs?.turf?.species) {
                    score += 5;
                    factors.push({ factor: 'Species-specific susceptibility', impact: +5 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'mlsn-calculator': {
            requiredInputs: ['soil'],
            optionalInputs: ['tissue', 'turf'],
            applicabilityCheck: function(state) {
                const soil = state.inputs?.soil;
                if (!soil) {
                    return { applicable: false, reason: 'No soil test data' };
                }
                // Check for minimum required nutrients
                if (!soil.K && !soil.P && !soil.Ca && !soil.Mg) {
                    return { applicable: false, reason: 'Soil test missing nutrient values' };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 80; // MLSN is well-validated
                
                const soil = state.inputs?.soil;
                
                // Check CEC
                if (soil?.CEC) {
                    score += 5;
                    factors.push({ factor: 'CEC available for ratio calculations', impact: +5 });
                } else {
                    score -= 10;
                    factors.push({ factor: 'No CEC - base saturation estimated', impact: -10 });
                }
                
                // Tissue cross-validation
                if (state.inputs?.tissue) {
                    score += 10;
                    factors.push({ factor: 'Tissue data for soil-plant correlation', impact: +10 });
                }
                
                // Context (greens vs sports)
                const context = state.inputs?.turf?.turfType;
                if (context === 'greens' || context === 'putting_green') {
                    score += 5;
                    factors.push({ factor: 'Golf greens - MLSN well-validated', impact: +5 });
                } else if (context === 'sports' || context === 'sportsfield') {
                    factors.push({ factor: 'Sports turf - MLSN applicability moderate', impact: 0 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'nutrient-demand-engine': {
            requiredInputs: ['turf'],
            optionalInputs: ['tissue', 'climate'],
            applicabilityCheck: function(state) {
                // Always applicable if we have any turf context
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 60; // Base - demand models are estimates
                
                const turf = state.inputs?.turf;
                const species = safeSpecies(turf?.species || turf?.warmBase || turf?.grassSpecies, '');
                
                // Species-specific validation
                const validatedSpecies = ['creepingBentgrass', 'kentuckyBluegrass', 'perennialRyegrass'];
                const estimatedSpecies = ['bermuda', 'couch', 'zoysia'];
                const extrapolatedSpecies = ['kikuyu', 'buffalo', 'paspalum'];
                
                if (species && validatedSpecies.some(s => species.toLowerCase().includes(s.toLowerCase()))) {
                    score += 25;
                    factors.push({ factor: 'Validated species (Kussow et al.)', impact: +25 });
                } else if (species && estimatedSpecies.some(s => species.toLowerCase().includes(s.toLowerCase()))) {
                    score += 10;
                    factors.push({ factor: 'Estimated C4 parameters', impact: +10 });
                } else if (species && extrapolatedSpecies.some(s => species.toLowerCase().includes(s.toLowerCase()))) {
                    score -= 10;
                    factors.push({ factor: 'Extrapolated - limited published data', impact: -10 });
                }
                
                // Clipping data
                if (state.inputs?.clippingVolume) {
                    score += 15;
                    factors.push({ factor: 'Measured clipping volume', impact: +15 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'pgr-module': {
            requiredInputs: ['climate'],
            optionalInputs: ['turf', 'pgr'],
            applicabilityCheck: function(state) {
                const climate = state.inputs?.climate || state.computed?.climate;
                if (!climate) {
                    return { applicable: false, reason: 'No climate data for GDD calculation' };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 75;
                
                const turf = state.inputs?.turf;
                const species = safeSpecies(turf?.species || turf?.grassSpecies, '');
                const c4List = ['bermuda', 'couch', 'kikuyu', 'zoysia', 'paspalum', 'buffalo'];
                const isC3 = !species || !c4List.some(s => species.toLowerCase().includes(s.toLowerCase()));
                
                if (isC3) {
                    score += 15;
                    factors.push({ factor: 'C3 species - Kreuser model validated', impact: +15 });
                } else {
                    score += 5;
                    factors.push({ factor: 'C4 species - Reasor base temp applied', impact: +5 });
                }
                
                // Previous application data
                if (state.inputs?.pgr?.lastApplication) {
                    score += 10;
                    factors.push({ factor: 'Previous application data available', impact: +10 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'irrigation-scheduler': {
            requiredInputs: ['climate'],
            optionalInputs: ['soil', 'water', 'turf'],
            applicabilityCheck: function(state) {
                const climate = state.inputs?.climate || state.computed?.climate;
                if (!climate) {
                    return { applicable: false, reason: 'No climate data for ET₀ calculation' };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 80; // FAO-56 is well-validated
                
                // Soil data for water holding capacity
                if (state.inputs?.soil?.texture || state.inputs?.soil?.sandPercent) {
                    score += 10;
                    factors.push({ factor: 'Soil texture for WHC calculation', impact: +10 });
                } else {
                    score -= 10;
                    factors.push({ factor: 'Soil WHC estimated from defaults', impact: -10 });
                }
                
                // Water quality for leaching fraction
                if (state.inputs?.water?.EC) {
                    score += 5;
                    factors.push({ factor: 'Water EC for leaching calculation', impact: +5 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'wear-recovery-engine': {
            requiredInputs: ['turf'],
            optionalInputs: ['climate', 'shade', 'schedule'],
            applicabilityCheck: function(state) {
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 60; // Recovery is inherently variable
                
                if (state.computed?.climate?.growthPotential) {
                    score += 15;
                    factors.push({ factor: 'Growth potential calculated', impact: +15 });
                }
                
                if (state.computed?.shade?.effectiveDLI) {
                    score += 10;
                    factors.push({ factor: 'Shade impact quantified', impact: +10 });
                }
                
                if (state.inputs?.schedule?.events) {
                    score += 10;
                    factors.push({ factor: 'Event schedule available', impact: +10 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'shade-engine': {
            requiredInputs: ['site'],
            optionalInputs: ['climate'],
            applicabilityCheck: function(state) {
                const site = state.inputs?.site;
                if (!site?.latitude && !site?.shadePercent) {
                    return { applicable: false, reason: 'No site location or shade data' };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 70;
                
                if (state.inputs?.site?.shadePercent !== undefined) {
                    score += 10;
                    factors.push({ factor: 'Direct shade measurement', impact: +10 });
                }
                
                if (state.computed?.climate?.solarRadiation) {
                    score += 10;
                    factors.push({ factor: 'Solar radiation from weather API', impact: +10 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'climate-engine': {
            requiredInputs: [],
            optionalInputs: ['site'],
            applicabilityCheck: function(state) {
                return { applicable: true }; // Always applicable - can use defaults
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 50; // Base without data
                
                // Check multiple locations for climate source
                // Priority: window.climateMetrics > state.computed.climate > state.inputs.climate
                const climateMetrics = global.climateMetrics;
                const computedClimate = state.computed?.climate;
                const inputClimate = state.inputs?.climate;
                
                // Determine source from any available location
                const source = climateMetrics?.quality?.source ||
                               climateMetrics?.source ||
                               computedClimate?.source ||
                               computedClimate?.quality?.source ||
                               inputClimate?.source ||
                               null;
                
                if (source === 'api') {
                    score = 90;
                    factors.push({ factor: 'Live API weather data', impact: +40 });
                } else if (source === 'manual') {
                    score = 75;
                    factors.push({ factor: 'Manual weather input', impact: +25 });
                } else if (climateMetrics?.temperature || computedClimate?.temperature) {
                    // Has climate data but source not explicitly set - assume API if we have real data
                    score = 85;
                    factors.push({ factor: 'Weather data available (source inferred)', impact: +35 });
                } else {
                    factors.push({ factor: 'Default/estimated weather', impact: 0 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        },

        'bipolaris-curvularia': {
            requiredInputs: ['climate'],
            optionalInputs: ['tissue', 'turf'],
            applicabilityCheck: function(state) {
                const climate = state.inputs?.climate || state.computed?.climate;
                const temp = climate?.temperature?.mean;
                
                if (temp !== undefined && temp < 15) {
                    return { 
                        applicable: false, 
                        reason: `Temperature (${temp.toFixed(1)}°C) below Bipolaris activity threshold` 
                    };
                }
                return { applicable: true };
            },
            confidenceFactors: function(state) {
                const factors = [];
                let score = 55; // Beta models
                
                factors.push({ factor: 'Beta validation status', impact: -15 });
                
                if (state.computed?.dew?.leafWetness) {
                    score += 10;
                    factors.push({ factor: 'Leaf wetness data available', impact: +10 });
                }
                
                return { score: Math.min(100, Math.max(0, score)), factors };
            }
        }
    };

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * Assess applicability for an engine given current state
     * @param {string} engineId 
     * @param {object} state - Hub state
     * @returns {object} { applicable: boolean, reason?: string }
     */
    function assessApplicability(engineId, state) {
        const rules = ENGINE_RULES[engineId];
        if (!rules) {
            return { applicable: true, reason: 'No applicability rules defined' };
        }
        
        return rules.applicabilityCheck(state);
    }

    /**
     * Assess confidence for an engine given current state
     * @param {string} engineId 
     * @param {object} state - Hub state
     * @returns {object} { level, score, factors }
     */
    function assessConfidence(engineId, state) {
        const rules = ENGINE_RULES[engineId];
        if (!rules) {
            return { 
                level: 'medium', 
                score: 50, 
                factors: [{ factor: 'No confidence rules defined', impact: 0 }] 
            };
        }
        
        const { score, factors } = rules.confidenceFactors(state);
        
        let level;
        if (score >= 80) level = CONFIDENCE_LEVELS.HIGH;
        else if (score >= 60) level = CONFIDENCE_LEVELS.MEDIUM;
        else if (score >= 30) level = CONFIDENCE_LEVELS.LOW;
        else level = CONFIDENCE_LEVELS.INSUFFICIENT;
        
        return {
            level: level.level,
            score: score,
            label: level.label,
            color: level.color,
            factors: factors
        };
    }

    /**
     * Wrap an engine result with standardized metadata
     * @param {string} engineId 
     * @param {object} result - Engine output
     * @param {object} state - Hub state at time of computation
     * @returns {object} Result with _meta attached
     */
    function wrapEngineOutput(engineId, result, state) {
        if (!result) return result;
        
        const applicability = assessApplicability(engineId, state);
        const confidence = assessConfidence(engineId, state);
        
        // Get version from registry if available
        let version = 'unknown';
        if (global.GilbaCitationRegistry) {
            const versionInfo = global.GilbaCitationRegistry.getEngineVersion(engineId);
            if (versionInfo) version = versionInfo.version;
        }
        
        return {
            ...result,
            _meta: {
                engine: engineId,
                version: version,
                applicable: applicability.applicable,
                applicabilityReason: applicability.reason || null,
                confidence: confidence,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Check if two scenarios can be meaningfully compared
     * @param {object} scenarioA - First scenario state/results
     * @param {object} scenarioB - Second scenario state/results
     * @param {array} engineIds - Engines to compare
     * @returns {object} { comparable: boolean, warnings: [], blockers: [] }
     */
    function checkComparisonEligibility(scenarioA, scenarioB, engineIds = []) {
        const warnings = [];
        const blockers = [];
        
        engineIds.forEach(engineId => {
            const appA = assessApplicability(engineId, scenarioA);
            const appB = assessApplicability(engineId, scenarioB);
            
            // Check if either scenario has inapplicable engine
            if (!appA.applicable && !appB.applicable) {
                blockers.push({
                    engine: engineId,
                    reason: `${engineId} not applicable to either scenario`
                });
            } else if (!appA.applicable || !appB.applicable) {
                warnings.push({
                    engine: engineId,
                    reason: `${engineId} only applicable to one scenario`,
                    detail: !appA.applicable ? appA.reason : appB.reason
                });
            }
            
            // Check confidence disparity
            const confA = assessConfidence(engineId, scenarioA);
            const confB = assessConfidence(engineId, scenarioB);
            
            if (Math.abs(confA.score - confB.score) > 30) {
                warnings.push({
                    engine: engineId,
                    reason: `Large confidence disparity (${confA.score}% vs ${confB.score}%)`,
                    detail: 'Comparison may be misleading due to different data quality'
                });
            }
            
            // Warn on low confidence
            if (confA.score < 40 || confB.score < 40) {
                warnings.push({
                    engine: engineId,
                    reason: `Low confidence in ${confA.score < 40 && confB.score < 40 ? 'both scenarios' : 'one scenario'}`,
                    detail: 'Results should be treated as indicative only'
                });
            }
        });
        
        return {
            comparable: blockers.length === 0,
            warnings: warnings,
            blockers: blockers
        };
    }

    /**
     * Get summary confidence across multiple engines
     * @param {object} state 
     * @param {array} engineIds 
     * @returns {object}
     */
    function getOverallConfidence(state, engineIds = []) {
        if (engineIds.length === 0) {
            // Default to main engines
            engineIds = ['climate-engine', 'disease-engine', 'mlsn-calculator', 'nutrient-demand-engine'];
        }
        
        let totalScore = 0;
        let applicableCount = 0;
        const details = [];
        
        engineIds.forEach(engineId => {
            const app = assessApplicability(engineId, state);
            if (app.applicable) {
                const conf = assessConfidence(engineId, state);
                totalScore += conf.score;
                applicableCount++;
                details.push({ engine: engineId, ...conf });
            }
        });
        
        const avgScore = applicableCount > 0 ? Math.round(totalScore / applicableCount) : 0;
        
        let level;
        if (avgScore >= 80) level = CONFIDENCE_LEVELS.HIGH;
        else if (avgScore >= 60) level = CONFIDENCE_LEVELS.MEDIUM;
        else if (avgScore >= 30) level = CONFIDENCE_LEVELS.LOW;
        else level = CONFIDENCE_LEVELS.INSUFFICIENT;
        
        return {
            overall: {
                level: level.level,
                score: avgScore,
                label: level.label,
                color: level.color
            },
            engines: details
        };
    }

    /**
     * Render confidence badge HTML
     * @param {object} confidence 
     * @returns {string}
     */
    function renderConfidenceBadge(confidence) {
        const c = confidence.overall || confidence;
        return `
            <span class="gaip-confidence-badge" style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                background: ${c.color}20;
                color: ${c.color};
                border: 1px solid ${c.color}40;
            ">
                <span style="font-size: 10px;">${c.score}%</span>
                ${c.label}
            </span>
        `;
    }

    /**
     * Render compact confidence indicator (just score + color)
     * @param {number} score - Confidence score 0-100
     * @returns {string} HTML string
     */
    function renderCompactConfidence(score) {
        // Guard against undefined/null/NaN scores
        if (score === undefined || score === null || isNaN(score)) {
            return ''; // Return empty string - don't display anything
        }
        
        let color, label;
        if (score >= 80) {
            color = CONFIDENCE_LEVELS.HIGH.color;
            label = 'High';
        } else if (score >= 60) {
            color = CONFIDENCE_LEVELS.MEDIUM.color;
            label = 'Medium';
        } else if (score >= 30) {
            color = CONFIDENCE_LEVELS.LOW.color;
            label = 'Low';
        } else {
            color = CONFIDENCE_LEVELS.INSUFFICIENT.color;
            label = 'Limited';
        }
        
        return `
            <span class="gaip-confidence-compact" style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 600;
                background: ${color}15;
                color: ${color};
            ">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
                ${Math.round(score)}%
            </span>
        `;
    }

    /**
     * Get confidence summary for display
     * @param {object} state 
     * @param {array} engineIds 
     * @returns {object}
     */
    function getConfidenceSummary(state, engineIds) {
        return getOverallConfidence(state, engineIds);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaEngineConfidence = {
        version: CONFIDENCE_VERSION,
        
        // Core assessment
        assessApplicability: assessApplicability,
        assessConfidence: assessConfidence,
        wrapEngineOutput: wrapEngineOutput,
        
        // Comparison support
        checkComparisonEligibility: checkComparisonEligibility,
        getOverallConfidence: getOverallConfidence,
        getConfidenceSummary: getConfidenceSummary,
        
        // Rendering
        renderConfidenceBadge: renderConfidenceBadge,
        renderCompactConfidence: renderCompactConfidence,
        
        // Helpers
        safeSpecies: safeSpecies,
        
        // Phase 1: Numeric standardization utilities
        levelToScore: levelToScore,
        scoreToLevel: scoreToLevel,
        normalizeConfidence: normalizeConfidence,
        
        // Constants
        CONFIDENCE_LEVELS: CONFIDENCE_LEVELS,
        CONFIDENCE_SCORES: CONFIDENCE_SCORES,
        ENGINE_RULES: ENGINE_RULES
    };


})(typeof window !== 'undefined' ? window : this);
