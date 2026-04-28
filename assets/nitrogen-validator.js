/**
 * =============================================================================
 * GILBA NITROGEN PROGRAM VALIDATOR v1.1.0
 * =============================================================================
 * 
 * Compares applied nitrogen rates against growth-limited demand.
 * Uses PACE Turf Growth Potential model as physiological ceiling.
 * 
 * v1.1.0 - Added subtle hint showing Nutrition Calendar suggestion for current month
 * 
 * Scientific Basis:
 * - PACE Turf Growth Potential model (Gelernter & Stowell)
 * - Temperature-limited nitrogen uptake (Carrow, Christians, Hull & Skogley)
 * - FAO crop nutrient guidelines
 * 
 * Integration:
 * - Reads growth potential from Climate Engine
 * - Adds N validation output to climate module display
 * - Shows Nutrition Calendar suggestion if available
 * 
 * =============================================================================
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const N_VALIDATOR_CONFIG = {
        version: '1.1.0'
    };
    
    // ========================================================================
    // HELPER: GET NUTRITION CALENDAR SUGGESTION
    // ========================================================================
    
    /**
     * Get the suggested N rate from Nutrition Calendar for current month
     * @returns {object|null} { rate: number, month: string } or null if unavailable
     */
    function getCalendarSuggestion() {
        try {
            const calendar = window.GilbaNutritionCalendar;
            if (!calendar || !calendar.program || !calendar.program.program) {
                return null;
            }
            
            const monthly = calendar.program.program.monthly;
            if (!monthly || !Array.isArray(monthly) || monthly.length !== 12) {
                return null;
            }
            
            // Get current month (0-11)
            const now = new Date();
            const currentMonth = now.getMonth();
            
            const monthData = monthly[currentMonth];
            if (!monthData || typeof monthData.N !== 'number') {
                return null;
            }
            
            return {
                rate: Math.round(monthData.N * 10) / 10,
                month: monthData.month_name || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][currentMonth]
            };
        } catch (e) {
            return null;
        }
    }

    // ========================================================================
    // MAXIMUM N UPTAKE BY SPECIES
    // Values in kg N/ha/month at GP = 1.0 (100% growth potential)
    // ========================================================================

    const MAX_N_UPTAKE = {
        // Warm-season (C4)
        bermudagrass:   50,   // High N user at peak growth
        couch:          45,   // Hybrid bermuda types
        kikuyu:         55,   // Aggressive grower, high N demand
        zoysiagrass:    35,   // Moderate N requirement
        buffalo:        25,   // Low input species
        
        // Cool-season (C3)
        perennial_rye:  40,   // Active in winter
        ryegrass:       40,
        tall_fescue:    35,
        kentucky_blue:  40,
        bentgrass:      45,   // Putting greens - intensive management
        
        // Default
        generic:        40
    };

    // ========================================================================
    // EFFICIENCY FACTORS
    // Applied as multipliers to theoretical maximum
    // ========================================================================

    const EFFICIENCY_FACTORS = {
        soilTemperature: {
            cold:    0.4,   // Soil < 10°C
            cool:    0.7,   // Soil 10-15°C
            optimal: 1.0,   // Soil 15-25°C
            warm:    0.9,   // Soil 25-30°C
            hot:     0.6    // Soil > 30°C
        },
        soilMoisture: {
            drought_stress: 0.5,
            dry:            0.7,
            adequate:       1.0,
            wet:            0.8,
            saturated:      0.6   // Reduced root function
        },
        mowingFrequency: {
            infrequent: 0.7,    // Less than weekly
            weekly:     0.85,
            frequent:   1.0     // 2-3x per week - clipping stimulates growth
        }
    };

    // ========================================================================
    // CORE CALCULATION FUNCTIONS
    // ========================================================================

    /**
     * Get species key from input string
     */
    function getSpeciesKey(species) {
        const speciesLower = (species || '').toLowerCase().replace(/\s+/g, '');
        if (speciesLower.includes('couch') || speciesLower.includes('bermuda')) return 'couch';
        if (speciesLower.includes('kikuyu')) return 'kikuyu';
        if (speciesLower.includes('ryegrass')) return 'ryegrass';
        if (speciesLower.includes('tall') && speciesLower.includes('fescue')) return 'tall_fescue';
        if (speciesLower.includes('fescue') || speciesLower.includes('chewing')) return 'fine_fescue';
        if (speciesLower.includes('buffalo')) return 'buffalo';
        if (speciesLower.includes('zoysia')) return 'zoysiagrass';
        if (speciesLower.includes('bentgrass')) return 'bentgrass';
        if (speciesLower.includes('bluegrass')) return 'kentucky_blue';
        return 'generic';
    }

    /**
     * Get soil temperature category from value
     */
    function getSoilTempCategory(soilTempC) {
        if (soilTempC < 10) return 'cold';
        if (soilTempC < 15) return 'cool';
        if (soilTempC < 25) return 'optimal';
        if (soilTempC < 30) return 'warm';
        return 'hot';
    }

    /**
     * Calculate N uptake capacity for current conditions
     * 
     * @param {string} species - Turf species
     * @param {number} growthPotential - GP as decimal (0-1)
     * @param {object} conditions - Optional soil temp, moisture, mowing
     * @returns {object} Capacity analysis
     */
    function calculateNCapacity(species, growthPotential, conditions = {}) {
        const speciesKey = getSpeciesKey(species);
        const maxN = MAX_N_UPTAKE[speciesKey] || MAX_N_UPTAKE.generic;

        // Apply growth potential as primary limiter
        const gpLimitedN = maxN * growthPotential;

        // Apply efficiency factors if provided
        let efficiencyMultiplier = 1.0;
        const appliedFactors = {};

        if (conditions.soilTempC !== undefined) {
            const category = getSoilTempCategory(conditions.soilTempC);
            const factor = EFFICIENCY_FACTORS.soilTemperature[category];
            efficiencyMultiplier *= factor;
            appliedFactors.soilTemperature = { category, factor };
        }

        if (conditions.soilMoisture) {
            const factor = EFFICIENCY_FACTORS.soilMoisture[conditions.soilMoisture] || 1.0;
            efficiencyMultiplier *= factor;
            appliedFactors.soilMoisture = { category: conditions.soilMoisture, factor };
        }

        if (conditions.mowingFrequency) {
            const factor = EFFICIENCY_FACTORS.mowingFrequency[conditions.mowingFrequency] || 1.0;
            efficiencyMultiplier *= factor;
            appliedFactors.mowingFrequency = { category: conditions.mowingFrequency, factor };
        }

        const effectiveCapacity = gpLimitedN * efficiencyMultiplier;

        return {
            speciesMaxN: maxN,
            growthPotential: growthPotential,
            gpLimitedN: Math.round(gpLimitedN * 10) / 10,
            efficiencyMultiplier: Math.round(efficiencyMultiplier * 1000) / 1000,
            effectiveCapacity: Math.round(effectiveCapacity * 10) / 10,
            appliedFactors: appliedFactors,
            species: speciesKey
        };
    }

    /**
     * Validate N program against growth-limited demand
     * 
     * @param {number} appliedNKgHa - Applied N rate (kg/ha/month)
     * @param {string} species - Turf species
     * @param {number} growthPotential - GP as decimal (0-1) or percentage
     * @param {object} conditions - Optional efficiency factors
     * @returns {object} Validation result
     */
    function validateNProgram(appliedNKgHa, species, growthPotential, conditions = {}) {
        // Normalize GP to decimal
        const gp = growthPotential > 1 ? growthPotential / 100 : growthPotential;

        // Calculate capacity
        const capacity = calculateNCapacity(species, gp, conditions);
        const effectiveCapacity = capacity.effectiveCapacity;

        // Calculate surplus/deficit
        const difference = appliedNKgHa - effectiveCapacity;
        const utilizationPct = effectiveCapacity > 0 ? (appliedNKgHa / effectiveCapacity) * 100 : 0;

        // Determine verdict
        const verdict = getVerdict(utilizationPct, difference);

        // Calculate waste or deficit
        const wasteKgHa = Math.max(0, difference);
        const deficitKgHa = Math.max(0, -difference);

        // Efficiency rating (100 at optimal, lower if over or under)
        const efficiencyRating = Math.min(100, utilizationPct <= 100 ? utilizationPct : (200 - utilizationPct));

        return {
            verdict: verdict.level,
            verdictLabel: verdict.label,
            verdictMessage: verdict.message,
            verdictClass: verdict.class,

            appliedNKgHa: appliedNKgHa,
            capacityKgHa: effectiveCapacity,
            differenceKgHa: Math.round(difference * 10) / 10,
            utilizationPct: Math.round(utilizationPct),
            efficiencyRating: Math.round(efficiencyRating),

            wasteKgHa: Math.round(wasteKgHa * 10) / 10,
            deficitKgHa: Math.round(deficitKgHa * 10) / 10,

            growthPotential: Math.round(gp * 100),
            species: capacity.species,

            capacityDetail: capacity,

            recommendations: getRecommendations(verdict.level, difference, appliedNKgHa, gp)
        };
    }

    /**
     * Get verdict based on utilization percentage
     */
    function getVerdict(utilizationPct, difference) {
        if (utilizationPct >= 85 && utilizationPct <= 100) {
            return {
                level: 'optimal',
                label: 'Optimal',
                message: 'N rate well-matched to growth capacity',
                class: 'status-adequate'
            };
        } else if (utilizationPct >= 70 && utilizationPct < 85) {
            return {
                level: 'acceptable_low',
                label: 'Acceptable (Low)',
                message: 'Slightly conservative - acceptable for low-input management',
                class: 'status-adequate'
            };
        } else if (utilizationPct > 100 && utilizationPct <= 120) {
            return {
                level: 'acceptable_high',
                label: 'Acceptable (High)',
                message: 'Slightly above capacity - minor luxury consumption',
                class: 'status-borderline'
            };
        } else if (utilizationPct < 70 && utilizationPct >= 50) {
            return {
                level: 'deficient',
                label: 'Deficient',
                message: 'N rate below growth potential - limiting performance',
                class: 'status-borderline'
            };
        } else if (utilizationPct < 50) {
            return {
                level: 'severely_deficient',
                label: 'Severely Deficient',
                message: 'N rate significantly limiting growth and recovery',
                class: 'status-deficient'
            };
        } else if (utilizationPct > 120 && utilizationPct <= 150) {
            return {
                level: 'excessive',
                label: 'Excessive',
                message: 'N exceeds uptake capacity - waste and environmental risk',
                class: 'status-deficient'
            };
        } else {
            return {
                level: 'severely_excessive',
                label: 'Severely Excessive',
                message: 'Major N surplus - significant waste and pollution risk',
                class: 'status-deficient'
            };
        }
    }

    /**
     * Get recommendations based on verdict
     */
    function getRecommendations(verdictLevel, difference, applied, gp) {
        const recommendations = [];

        switch (verdictLevel) {
            case 'excessive':
            case 'severely_excessive':
                recommendations.push(`Reduce N rate by ${Math.round(Math.abs(difference))} kg/ha to match uptake capacity`);
                if (gp < 0.5) {
                    recommendations.push('Growth potential is low - defer N application to warmer period');
                }
                recommendations.push('Consider spoon-feeding smaller rates more frequently');
                break;

            case 'deficient':
            case 'severely_deficient':
                recommendations.push(`Increase N rate by ${Math.round(Math.abs(difference))} kg/ha to support growth potential`);
                if (gp > 0.7) {
                    recommendations.push('High growth potential - turf can utilise more N');
                }
                break;

            case 'optimal':
                recommendations.push('Current rate well-matched to conditions - maintain program');
                break;

            case 'acceptable_low':
                recommendations.push('Rate is conservative but acceptable for current conditions');
                break;

            case 'acceptable_high':
                recommendations.push('Minor over-application - reduce slightly for optimal efficiency');
                break;
        }

        return recommendations;
    }

    /**
     * Validate annual N program (12 months)
     */
    function validateAnnualProgram(monthlyNRates, species, monthlyGPs) {
        const monthlyResults = [];
        let totalApplied = 0;
        let totalCapacity = 0;
        let totalWaste = 0;
        let totalDeficit = 0;
        let monthsOver = 0;
        let monthsUnder = 0;

        for (let i = 0; i < 12; i++) {
            const result = validateNProgram(
                monthlyNRates[i] || 0,
                species,
                monthlyGPs[i] || 0.5
            );

            monthlyResults.push(result);

            totalApplied += result.appliedNKgHa;
            totalCapacity += result.capacityKgHa;
            totalWaste += result.wasteKgHa;
            totalDeficit += result.deficitKgHa;

            if (result.differenceKgHa > 5) monthsOver++;
            if (result.differenceKgHa < -5) monthsUnder++;
        }

        const annualUtilization = totalCapacity > 0 ? (totalApplied / totalCapacity) * 100 : 0;
        const annualEfficiency = Math.min(100, annualUtilization <= 100 ? annualUtilization : (200 - annualUtilization));

        return {
            annualSummary: {
                totalAppliedKgHa: Math.round(totalApplied),
                totalCapacityKgHa: Math.round(totalCapacity),
                totalWasteKgHa: Math.round(totalWaste),
                totalDeficitKgHa: Math.round(totalDeficit),
                annualUtilizationPct: Math.round(annualUtilization),
                annualEfficiency: Math.round(annualEfficiency),
                monthsOverCapacity: monthsOver,
                monthsUnderCapacity: monthsUnder
            },
            monthlyResults: monthlyResults,
            verdict: getAnnualVerdict(annualUtilization, monthsOver, totalWaste)
        };
    }

    /**
     * Get annual program verdict
     */
    function getAnnualVerdict(annualUtilization, monthsOver, totalWaste) {
        const issues = [];

        if (monthsOver >= 4) {
            issues.push('Frequent over-application throughout year');
        }
        if (totalWaste > 50) {
            issues.push(`Significant annual waste: ${Math.round(totalWaste)} kg N/ha`);
        }
        if (annualUtilization < 70) {
            issues.push('Annual N program under-feeding turf');
        }

        if (issues.length === 0) {
            return {
                level: 'good',
                label: 'Well-Balanced Program',
                message: 'Annual N rates align well with seasonal growth capacity',
                issues: []
            };
        }

        return {
            level: issues.length > 1 ? 'poor' : 'moderate',
            label: issues.length > 1 ? 'Needs Revision' : 'Minor Issues',
            message: 'N program timing or rates need adjustment',
            issues: issues
        };
    }

    // ========================================================================
    // UI RENDERING
    // ========================================================================

    /**
     * Render N validation card for climate module display
     */
    function renderNValidationCard(result, state) {
        const appliedN = state?.fertility?.monthlyN || 0;
        
        // Get calendar suggestion for hint
        const calendarSuggestion = getCalendarSuggestion();
        
        if (!appliedN || appliedN <= 0) {
            // Build hint HTML if calendar data available
            let hintHTML = '';
            if (calendarSuggestion) {
                hintHTML = `
                    <p class="gaip-calendar-hint" style="margin-top: 8px; padding: 8px 10px; background: var(--gaip-good-bg); border-left: 3px solid #22c55e; font-size: 12px; color: #166534;">
                        💡 Your Nutrition Calendar suggests <strong>${calendarSuggestion.rate} kg/ha</strong> for ${calendarSuggestion.month}
                    </p>
                `;
            }
            
            return `
                <div class="gaip-n-validator-prompt">
                    <p class="gaip-note">
                        <strong>N Program Validation Available</strong><br>
                        Enter your monthly N rate (kg/ha) to compare against growth-limited capacity.
                    </p>
                    ${hintHTML}
                </div>
            `;
        }

        const cardId = `n-validator-${Date.now()}`;
        
        return `
            <div class="gaip-diagnostic-card n-validator-card">
                <div class="gaip-verdict">
                    <span class="gaip-status-indicator ${result.verdictClass}"></span>
                    <span class="gaip-status-text">${result.verdictLabel}</span>
                </div>
                
                <div class="gaip-primary-value">
                    <span class="gaip-value">${result.utilizationPct}%</span>
                    <span class="gaip-unit">of capacity used</span>
                </div>
                
                <div class="gaip-n-comparison">
                    <div class="gaip-n-applied">
                        <span class="gaip-label">Applied:</span>
                        <span class="gaip-value">${result.appliedNKgHa} kg N/ha</span>
                    </div>
                    <div class="gaip-n-capacity">
                        <span class="gaip-label">Capacity:</span>
                        <span class="gaip-value">${result.capacityKgHa} kg N/ha</span>
                    </div>
                </div>
                
                <button class="gaip-expand-btn" onclick="gaip_toggle_n_detail('${cardId}')">
                    Why? ▼
                </button>
                
                <div id="${cardId}" class="gaip-detail-panel" style="display: none;">
                    <p class="gaip-driver">${result.verdictMessage}</p>
                    
                    <div class="gaip-n-detail">
                        <p><strong>Growth Potential:</strong> ${result.growthPotential}%</p>
                        <p><strong>Efficiency Rating:</strong> ${result.efficiencyRating}%</p>
                        ${result.wasteKgHa > 0 ? `<p><strong>Wasted N:</strong> ${result.wasteKgHa} kg/ha</p>` : ''}
                        ${result.deficitKgHa > 0 ? `<p><strong>N Deficit:</strong> ${result.deficitKgHa} kg/ha</p>` : ''}
                    </div>
                    
                    ${result.recommendations.length > 0 ? `
                        <div class="gaip-recommendations">
                            <p><strong>Recommendations:</strong></p>
                            <ul>
                                ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                ${renderCalendarComparison(appliedN, calendarSuggestion)}
            </div>
        `;
    }
    
    /**
     * Render subtle comparison to Nutrition Calendar suggestion
     */
    function renderCalendarComparison(appliedN, calendarSuggestion) {
        if (!calendarSuggestion) return '';
        
        const diff = appliedN - calendarSuggestion.rate;
        const absDiff = Math.abs(diff);
        
        // Only show if there's a meaningful difference (>1 kg/ha)
        if (absDiff < 1) {
            return `
                <div class="gaip-calendar-match" style="margin-top: 10px; padding: 6px 10px; background: var(--gaip-good-bg); border-radius: 4px; font-size: 11px; color: #166534;">
                    ✓ Matches your Nutrition Calendar for ${calendarSuggestion.month} (${calendarSuggestion.rate} kg/ha)
                </div>
            `;
        }
        
        const direction = diff > 0 ? 'above' : 'below';
        const color = diff > 0 ? '#92400e' : '#1e40af';
        const bg = diff > 0 ? 'var(--gaip-warning-bg)' : 'var(--gaip-info-bg)';
        
        return `
            <div class="gaip-calendar-diff" style="margin-top: 10px; padding: 6px 10px; background: ${bg}; border-radius: 4px; font-size: 11px; color: ${color};">
                📊 ${Math.round(absDiff * 10) / 10} kg/ha ${direction} your Nutrition Calendar for ${calendarSuggestion.month} (${calendarSuggestion.rate} kg/ha)
            </div>
        `;
    }

    /**
     * Toggle detail panel
     */
    window.gaip_toggle_n_detail = function(cardId) {
        const panel = document.getElementById(cardId);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    };

    // ========================================================================
    // INTEGRATION WITH CLIMATE ENGINE
    // ========================================================================

    /**
     * Hook into climate module to add N validation
     */
    function integrateWithClimateEngine() {
        // Store reference to add N validation when climate data updates
        window.gaip_n_validate_from_climate = function(climateData, state) {
            const gp = climateData?.growth?.weighted || 50;
            const species = state?.turf?.grassSpecies || 'couch';
            const appliedN = state?.fertility?.monthlyN;

            if (!appliedN) {
                return null;
            }

            return validateNProgram(appliedN, species, gp);
        };

    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    window.gaip_n_validate = validateNProgram;
    window.gaip_n_capacity = calculateNCapacity;
    window.gaip_n_annual = validateAnnualProgram;
    window.gaip_n_render_card = renderNValidationCard;

    window.GAIP_N_MAX_UPTAKE = MAX_N_UPTAKE;
    window.GAIP_N_EFFICIENCY_FACTORS = EFFICIENCY_FACTORS;
    window.GAIP_N_CONFIG = N_VALIDATOR_CONFIG;

    // Initialize integration
    integrateWithClimateEngine();


})();
