/**
 * =============================================================================
 * GILBA HUB CONTRADICTION DETECTOR v1.0.0
 * =============================================================================
 * 
 * Meta-engine oversight layer that identifies internal contradictions
 * between engine outputs. Part of Phase 1 epistemic infrastructure.
 * 
 * Detects conflicts such as:
 * - High N demand + low recovery probability
 * - Overseed recommendation under DLI infeasibility
 * - Disease pressure conflicting with climate stress
 * - Nutrient recommendations conflicting with water quality
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const DETECTOR_VERSION = '1.0.0';

    // =========================================================================
    // CONTRADICTION RULES
    // =========================================================================

    /**
     * Each rule defines a potential contradiction between engine outputs.
     * Rules are evaluated against the hub state and return warnings if triggered.
     */
    const CONTRADICTION_RULES = [
        
        // =====================================================================
        // NUTRITION vs RECOVERY
        // =====================================================================
        {
            id: 'high-n-low-recovery',
            category: 'nutrition-recovery',
            severity: 'warning',
            title: 'High N Demand vs Low Recovery',
            check: function(state) {
                const nRate = state.computed?.nutrientDemand?.nRateKgHaYear || 
                             state.inputs?.tissue?.nRateMonthly * 10;
                const recoveryProb = state.derived?.recoveryProbability;
                
                if (nRate > 250 && recoveryProb !== null && recoveryProb < 0.5) {
                    return {
                        triggered: true,
                        message: `High N program (${nRate} kg/ha/year) conflicts with low recovery probability (${Math.round(recoveryProb * 100)}%). Consider reducing N until recovery conditions improve.`,
                        recommendation: 'Reduce N applications during periods of compromised turf recovery to avoid exacerbating stress.',
                        conflictingModules: ['nutrient-demand-engine', 'wear-recovery-engine']
                    };
                }
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // OVERSEED vs DLI
        // =====================================================================
        {
            id: 'overseed-insufficient-dli',
            category: 'overseed-light',
            severity: 'critical',
            title: 'Overseed Recommendation Under DLI Infeasibility',
            check: function(state) {
                const overseedActive = state.inputs?.turf?.overseedFraction > 0 ||
                                      state.inputs?.turf?.coolOverseed;
                const dli = state.computed?.shade?.effectiveDLI || 
                           state.computed?.shade?.dailyLightIntegral?.dli;
                const dliThreshold = 15; // mol/m²/day minimum for establishment
                
                if (overseedActive && dli !== null && dli < dliThreshold) {
                    return {
                        triggered: true,
                        message: `Overseed program active but DLI (${dli.toFixed(1)} mol/m²/day) is below establishment threshold (${dliThreshold}). Overseed establishment will likely fail.`,
                        recommendation: 'Consider delaying overseed until light conditions improve, or implement LED supplementation.',
                        conflictingModules: ['turf-profile', 'shade-engine']
                    };
                }
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // DISEASE vs CLIMATE STRESS
        // =====================================================================
        {
            id: 'disease-climate-conflict',
            category: 'disease-climate',
            severity: 'warning',
            title: 'Disease Pressure Conflicts with Climate Stress',
            check: function(state) {
                const diseaseResults = state.computed?.disease;
                const climateMetrics = state.computed?.climate;
                
                if (!diseaseResults || !climateMetrics) {
                    return { triggered: false };
                }
                
                const highDiseaseRisk = diseaseResults.diseases?.some(d => 
                    d.riskLevel === 'high' || d.riskLevel === 'severe'
                );
                const highHeatStress = climateMetrics.temperature?.max > 35 ||
                                       climateMetrics.growthPotential?.c3 < 0.3;
                
                // Pythium risk + heat stress = compounding problem
                const pythiumHigh = diseaseResults.diseases?.find(d => 
                    d.disease === 'pythiumBlight' && 
                    (d.riskLevel === 'high' || d.riskLevel === 'severe')
                );
                
                if (pythiumHigh && highHeatStress) {
                    return {
                        triggered: true,
                        message: `High Pythium risk (${pythiumHigh.adjustedRisk}%) combined with heat stress creates compounding damage potential. Both conditions favour rapid turf decline.`,
                        recommendation: 'Priority: preventive fungicide application. Reduce irrigation to minimum, improve air circulation.',
                        conflictingModules: ['disease-engine', 'climate-engine']
                    };
                }
                
                // Fusarium + low temps + high N
                const fusariumHigh = diseaseResults.diseases?.find(d => 
                    d.disease === 'fusarium' && 
                    (d.riskLevel === 'high' || d.riskLevel === 'severe')
                );
                const lowTemp = climateMetrics.temperature?.mean < 12;
                const highN = (state.inputs?.tissue?.nRateMonthly || 0) > 20;
                
                if (fusariumHigh && lowTemp && highN) {
                    return {
                        triggered: true,
                        message: `Fusarium risk elevated by combination of cool temperatures (${climateMetrics.temperature?.mean?.toFixed(1)}°C) and high N program. Excess N in cold conditions dramatically increases Fusarium severity.`,
                        recommendation: 'Reduce or suspend N applications during cool weather. Monitor for patch development.',
                        conflictingModules: ['disease-engine', 'climate-engine', 'nutrient-demand-engine']
                    };
                }
                
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // NUTRIENT RECOMMENDATIONS vs WATER QUALITY
        // =====================================================================
        {
            id: 'nutrition-water-conflict',
            category: 'nutrition-water',
            severity: 'warning',
            title: 'Nutrient Recommendation Conflicts with Water Quality',
            check: function(state) {
                const waterQuality = state.computed?.water || state.inputs?.water;
                const soilData = state.inputs?.soil;
                
                if (!waterQuality || !soilData) {
                    return { triggered: false };
                }
                
                // High bicarbonate water reducing Ca availability
                const highBicarb = waterQuality.HCO3 > 180;
                const lowSoilCa = soilData.Ca < 400;
                
                if (highBicarb && lowSoilCa) {
                    return {
                        triggered: true,
                        message: `High bicarbonate water (${waterQuality.HCO3} ppm) will precipitate calcium, exacerbating low soil Ca (${soilData.Ca} ppm). Ca applications via irrigation water will be partially lost.`,
                        recommendation: 'Apply gypsum directly to soil rather than through irrigation. Consider acidifying water source.',
                        conflictingModules: ['water-quality', 'mlsn-calculator']
                    };
                }
                
                // High Na water + Na-sensitive grass
                const highSAR = waterQuality.SAR > 6;
                const sodiumSensitive = ['bentgrass', 'creepingBentgrass', 'kentuckyBluegrass', 'perennialRyegrass']
                    .includes(state.inputs?.turf?.species || state.inputs?.turf?.warmBase);
                
                if (highSAR && sodiumSensitive) {
                    return {
                        triggered: true,
                        message: `High SAR water (${waterQuality.SAR?.toFixed(1)}) being applied to sodium-sensitive species. Na accumulation will impair turf quality.`,
                        recommendation: 'Implement gypsum amendment program. Consider blending with cleaner water source.',
                        conflictingModules: ['water-quality', 'turf-profile']
                    };
                }
                
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // PGR vs STRESS
        // =====================================================================
        {
            id: 'pgr-high-stress',
            category: 'pgr-stress',
            severity: 'warning',
            title: 'PGR Application During High Stress',
            check: function(state) {
                const pgrActive = state.computed?.pgr?.active || 
                                 state.inputs?.pgr?.lastApplication;
                const stressIndex = state.derived?.environmentalStressIndex;
                const recoveryProb = state.derived?.recoveryProbability;
                
                if (pgrActive && stressIndex > 0.7) {
                    return {
                        triggered: true,
                        message: `PGR program active during high environmental stress (index: ${(stressIndex * 100).toFixed(0)}%). Growth regulation may impair stress recovery.`,
                        recommendation: 'Consider suspending PGR applications until stress conditions moderate.',
                        conflictingModules: ['pgr-module', 'stress-trajectory-engine']
                    };
                }
                
                if (pgrActive && recoveryProb !== null && recoveryProb < 0.4) {
                    return {
                        triggered: true,
                        message: `PGR active but recovery probability very low (${Math.round(recoveryProb * 100)}%). Growth suppression may prevent recovery from wear/damage.`,
                        recommendation: 'Suspend PGR program and focus on recovery management.',
                        conflictingModules: ['pgr-module', 'wear-recovery-engine']
                    };
                }
                
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // IRRIGATION vs DISEASE
        // =====================================================================
        {
            id: 'irrigation-disease-conflict',
            category: 'irrigation-disease',
            severity: 'warning',
            title: 'Irrigation Schedule Conflicts with Disease Risk',
            check: function(state) {
                const diseaseResults = state.computed?.disease;
                const irrigationSchedule = state.computed?.irrigation;
                
                if (!diseaseResults || !irrigationSchedule) {
                    return { triggered: false };
                }
                
                // Check for leaf wetness-driven diseases
                const wetnessDiseases = ['dollarSpot', 'brownPatch', 'pythiumBlight'];
                const highWetnessDisease = diseaseResults.diseases?.find(d => 
                    wetnessDiseases.includes(d.disease) && 
                    (d.riskLevel === 'high' || d.riskLevel === 'severe')
                );
                
                // Check if irrigation is scheduled for evening/night
                const eveningIrrigation = irrigationSchedule?.preferredTime === 'evening' ||
                                         irrigationSchedule?.preferredTime === 'night';
                
                if (highWetnessDisease && eveningIrrigation) {
                    return {
                        triggered: true,
                        message: `Evening/night irrigation will extend leaf wetness duration, exacerbating ${highWetnessDisease.displayName} risk (${highWetnessDisease.adjustedRisk}%).`,
                        recommendation: 'Shift irrigation to early morning (predawn to dawn) to minimize leaf wetness duration.',
                        conflictingModules: ['irrigation-scheduler', 'disease-engine']
                    };
                }
                
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // K DEFICIENCY vs DISEASE SUSCEPTIBILITY
        // =====================================================================
        {
            id: 'k-deficiency-disease',
            category: 'nutrition-disease',
            severity: 'warning',
            title: 'Potassium Deficiency Increasing Disease Risk',
            check: function(state) {
                const tissueK = state.inputs?.tissue?.K;
                const soilK = state.inputs?.soil?.K;
                const diseaseResults = state.computed?.disease;
                
                const kDeficient = (tissueK && tissueK < 1.8) || (soilK && soilK < 50);
                
                if (kDeficient && diseaseResults?.diseases?.length > 0) {
                    const highRiskDiseases = diseaseResults.diseases.filter(d => 
                        d.riskLevel === 'high' || d.riskLevel === 'severe'
                    );
                    
                    if (highRiskDiseases.length > 0) {
                        return {
                            triggered: true,
                            message: `Low potassium (tissue: ${tissueK || 'N/A'}%, soil: ${soilK || 'N/A'} ppm) is increasing susceptibility to ${highRiskDiseases.map(d => d.displayName).join(', ')}.`,
                            recommendation: 'Priority K application recommended. K strengthens cell walls and improves disease resistance.',
                            conflictingModules: ['tissue-engine', 'disease-engine']
                        };
                    }
                }
                
                return { triggered: false };
            }
        },
        
        // =====================================================================
        // SHADE vs SPECIES SUITABILITY
        // =====================================================================
        {
            id: 'shade-species-mismatch',
            category: 'shade-species',
            severity: 'info',
            title: 'Species Not Suited to Shade Level',
            check: function(state) {
                const shadeDLI = state.computed?.shade?.effectiveDLI ||
                                state.computed?.shade?.dailyLightIntegral?.dli;
                const species = state.inputs?.turf?.species || state.inputs?.turf?.warmBase;
                
                if (!shadeDLI || !species) {
                    return { triggered: false };
                }
                
                // C4 grasses need more light
                const c4Species = ['bermuda', 'couch', 'kikuyu', 'zoysia', 'paspalum', 'buffalo'];
                const isC4 = c4Species.some(s => species.toLowerCase().includes(s));
                
                if (isC4 && shadeDLI < 25) {
                    return {
                        triggered: true,
                        message: `${species} (C4) receiving only ${shadeDLI.toFixed(1)} mol/m²/day DLI. C4 grasses typically require >30 mol/m²/day for acceptable quality.`,
                        recommendation: 'Consider transitioning shaded areas to shade-tolerant C3 species or implement supplemental lighting.',
                        conflictingModules: ['shade-engine', 'turf-profile']
                    };
                }
                
                return { triggered: false };
            }
        }
    ];

    // =========================================================================
    // DETECTOR ENGINE
    // =========================================================================

    /**
     * Run all contradiction checks against current hub state
     * @param {object} hubState - Full hub state from orchestrator
     * @returns {object} Detection results
     */
    function detectContradictions(hubState) {
        if (!hubState) {
            console.warn('[ContradictionDetector] No hub state provided');
            return { contradictions: [], summary: null };
        }

        const results = [];
        
        CONTRADICTION_RULES.forEach(rule => {
            try {
                const result = rule.check(hubState);
                if (result.triggered) {
                    results.push({
                        id: rule.id,
                        category: rule.category,
                        severity: rule.severity,
                        title: rule.title,
                        ...result
                    });
                }
            } catch (err) {
                console.warn(`[ContradictionDetector] Rule ${rule.id} failed:`, err);
            }
        });

        // Sort by severity
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
            contradictions: results,
            summary: {
                total: results.length,
                critical: results.filter(r => r.severity === 'critical').length,
                warnings: results.filter(r => r.severity === 'warning').length,
                info: results.filter(r => r.severity === 'info').length,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Render contradictions as HTML for UI display
     * @param {array} contradictions 
     * @returns {string} HTML
     */
    function renderContradictions(contradictions) {
        if (!contradictions || contradictions.length === 0) {
            return '';
        }

        const severityConfig = {
            critical: { icon: '🔴', bg: 'var(--gaip-critical-bg)', border: '#dc2626', text: '#991b1b' },
            warning: { icon: '⚠️', bg: 'var(--gaip-warning-bg)', border: '#f59e0b', text: '#92400e' },
            info: { icon: 'ℹ️', bg: 'var(--gaip-info-bg)', border: '#3b82f6', text: '#1e40af' }
        };

        let html = '<div class="gaip-contradictions-panel" style="margin: 16px 0;">';
        html += '<h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--gaip-text);">⚡ Consistency Checks</h4>';

        contradictions.forEach(c => {
            const config = severityConfig[c.severity] || severityConfig.info;
            html += `
                <div class="gaip-contradiction-item" style="
                    background: ${config.bg};
                    border: 1px solid ${config.border};
                    border-left: 4px solid ${config.border};
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 8px;
                ">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        <span style="font-size: 16px;">${config.icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: ${config.text}; font-size: 13px; margin-bottom: 4px;">
                                ${c.title}
                            </div>
                            <div style="font-size: 12px; color: ${config.text}; line-height: 1.4;">
                                ${c.message}
                            </div>
                            ${c.recommendation ? `
                                <div style="font-size: 11px; color: ${config.text}; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${config.border}40;">
                                    <strong>→</strong> ${c.recommendation}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Get contradictions for a specific category
     * @param {array} contradictions 
     * @param {string} category 
     * @returns {array}
     */
    function filterByCategory(contradictions, category) {
        return contradictions.filter(c => c.category === category);
    }

    /**
     * Check if any critical contradictions exist
     * @param {array} contradictions 
     * @returns {boolean}
     */
    function hasCritical(contradictions) {
        return contradictions.some(c => c.severity === 'critical');
    }

    // =========================================================================
    // INTEGRATION WITH ORCHESTRATOR
    // =========================================================================

    /**
     * Hook into orchestrator's computeAll to run contradiction detection
     */
    function integrateWithOrchestrator() {
        if (!global.GaipOrchestrator) {
            console.warn('[ContradictionDetector] Orchestrator not found, deferring integration');
            return false;
        }

        const originalComputeAll = global.GaipOrchestrator.computeAll;
        
        global.GaipOrchestrator.computeAll = async function() {
            const result = await originalComputeAll.apply(this, arguments);
            
            // Run contradiction detection after compute
            const state = global.GaipOrchestrator.getState();
            const detection = detectContradictions(state);
            
            // Store results
            state.contradictions = detection;
            
            // Emit event
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('gaip:contradictions-detected', {
                    detail: detection
                }));
            }
            
            if (detection.contradictions.length > 0) {
            }
            
            return result;
        };

        return true;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        // Try to integrate with orchestrator
        if (global.GaipOrchestrator) {
            integrateWithOrchestrator();
        } else {
            // Wait for orchestrator
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(integrateWithOrchestrator, 100);
            });
        }
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaContradictionDetector = {
        version: DETECTOR_VERSION,
        
        // Core detection
        detectContradictions: detectContradictions,
        
        // Rendering
        renderContradictions: renderContradictions,
        
        // Utilities
        filterByCategory: filterByCategory,
        hasCritical: hasCritical,
        
        // Integration
        integrateWithOrchestrator: integrateWithOrchestrator,
        
        // Rules access (for testing/extension)
        RULES: CONTRADICTION_RULES
    };

    // Initialize
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }


})(typeof window !== 'undefined' ? window : this);
