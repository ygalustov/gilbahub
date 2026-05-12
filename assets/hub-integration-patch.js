/**
 * =============================================================================
 * GILBA HUB INTEGRATION PATCH v1.0.0
 * =============================================================================
 * 
 * Wires DLI-Recovery Bridge (#8) and Stress Trajectory Engine (#9) into the hub.
 * 
 * LOAD ORDER:
 * 1. shade-engine.js
 * 2. wear-recovery-engine.js
 * 3. climate-engine.js
 * 4. dli-recovery-bridge.js       <-- NEW
 * 5. stress-trajectory-engine.js  <-- NEW
 * 6. hub-integration-patch.js     <-- THIS FILE
 * 7. hub-tissue-v3.js
 * 
 * This patch:
 * - Hooks into the hub's calculation pipeline
 * - Enhances shadeData with DLI recovery modifiers before wear-recovery calc
 * - Adds stress trajectory projection after all modules complete
 * - Exposes results on GAIP_STATE for rendering
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';

    /* =========================================================================
       STATE STORAGE
    ========================================================================= */

    // Extend GAIP_STATE if it exists, or create it
    global.GAIP_STATE = global.GAIP_STATE || {};
    global.GAIP_STATE.dliRecovery = null;
    global.GAIP_STATE.stressTrajectory = null;

    /* =========================================================================
       INTEGRATION HOOKS
    ========================================================================= */

    /**
     * Enhanced wear-recovery wrapper
     * Injects DLI recovery data into shade parameter before calling wear engine
     */
    function enhancedWearRecoveryAnalysis(state, weather, shadeData, FIobj) {
        // Check dependencies
        if (typeof global.gaip_wear_recovery_engine !== 'function') {
            console.warn('[Integration] Wear/Recovery Engine not loaded');
            return null;
        }
        
        // Enhance shade data with DLI recovery modifiers
        var enhancedShade = shadeData;
        
        if (global.GAIP_DLI_Recovery) {
            try {
                enhancedShade = global.GAIP_DLI_Recovery.enhanceShadeData(shadeData, state);
                global.GAIP_STATE.dliRecovery = enhancedShade.dliRecovery;
            } catch (e) {
                console.warn('[Integration] DLI-Recovery Bridge error:', e);
                enhancedShade = shadeData;
            }
        }
        
        // Call original wear-recovery engine with enhanced shade data
        try {
            var result = global.gaip_wear_recovery_engine(state, weather, enhancedShade, FIobj);
            
            // Inject DLI recovery info into result for rendering
            if (result && global.GAIP_STATE.dliRecovery) {
                result.dliRecovery = global.GAIP_STATE.dliRecovery;
            }
            
            return result;
        } catch (e) {
            console.error('[Integration] Wear-Recovery analysis failed:', e);
            return null;
        }
    }

    /**
     * Run stress trajectory projection
     * Call this after all hub calculations complete
     */
    function runStressTrajectory(state, weather, options) {
        if (!global.GAIP_StressTrajectory) {
            console.warn('[Integration] Stress Trajectory Engine not loaded');
            return null;
        }
        
        try {
            // Enrich state with results from other modules
            var enrichedState = {
                ...state,
                shadeResult: global.GAIP_STATE.shadeResult || state.se,
                wearResult: global.GAIP_STATE.wearResult || state.le,
                diseaseResult: global.GAIP_STATE.diseaseResult,
                tissueResult: global.GAIP_STATE.tissueResult || state.de,
                dliRecovery: global.GAIP_STATE.dliRecovery,
                climateMetrics: global.GAIP_STATE.climateMetrics
            };
            
            var result = global.GAIP_StressTrajectory.project(enrichedState, weather, options);
            global.GAIP_STATE.stressTrajectory = result;
            
            return result;
        } catch (e) {
            console.error('[Integration] Stress Trajectory projection failed:', e);
            return null;
        }
    }

    /**
     * Simulate event impact
     */
    function simulateEventImpact(state, weather, event) {
        if (!global.GAIP_StressTrajectory) {
            console.warn('[Integration] Stress Trajectory Engine not loaded');
            return null;
        }
        
        try {
            return global.GAIP_StressTrajectory.simulateEvent(state, weather, event);
        } catch (e) {
            console.error('[Integration] Event simulation failed:', e);
            return null;
        }
    }

    /* =========================================================================
       RENDERING HELPERS
    ========================================================================= */

    /**
     * Render DLI Recovery panel
     */
    function renderDLIRecoveryPanel(dliRecovery) {
        if (!dliRecovery || !dliRecovery.available) {
            return '';
        }
        
        var severityColours = {
            critical: '#dc2626',
            concern: '#f97316',
            watch: '#eab308',
            good: '#22c55e'
        };
        
        var colour = severityColours[dliRecovery.severity] || 'var(--gaip-text-secondary)';
        
        return `
        <div class="gaip-dli-recovery-panel" style="margin-top: 12px; padding: 12px; background: ${colour}15; border-left: 4px solid ${colour}; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: ${colour};">Light-Based Recovery</strong>
                <span style="font-size: 12px; padding: 2px 8px; border-radius: 999px; background: ${colour}20; color: ${colour}; border: 1px solid ${colour}40;">
                    ${dliRecovery.category.split(' - ')[0]}
                </span>
            </div>
            
            <div style="font-size: 13px; color: var(--gaip-text);">
                <div style="margin-bottom: 4px;">
                    <strong>DLI:</strong> ${dliRecovery.dliActual} mol/m²/day 
                    (${dliRecovery.ratioToMin < 1 ? 'Below' : 'Above'} ${dliRecovery.dliMin} min)
                </div>
                <div style="margin-bottom: 4px;">
                    <strong>Recovery Impact:</strong> ${dliRecovery.impactDescription}
                </div>
                ${dliRecovery.ledRequired ? `
                <div style="margin-top: 8px; padding: 6px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 12px;">
                    💡 LED supplementation needed: ${dliRecovery.ledDeficitMol} mol/m²/day to reach target
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }

    /**
     * Render Stress Trajectory summary panel
     */
    function renderStressTrajectorySummary(trajectory) {
        if (!trajectory) {
            return '';
        }
        
        var summary = trajectory.summary;
        var levelColours = {
            'Normal': '#22c55e',
            'Caution': '#eab308',
            'Warning': '#f59e0b',
            'Critical': '#ea580c',
            'Failure': '#dc2626'
        };
        
        var currentColour = levelColours[summary.currentLevel] || 'var(--gaip-text-secondary)';
        var peakColour = levelColours[summary.peakLevel] || 'var(--gaip-text-secondary)';
        var urgencyColours = {
            normal: '#22c55e',
            caution: '#eab308',
            warning: '#f59e0b',
            critical: '#dc2626'
        };
        var urgencyColour = urgencyColours[summary.recommendation.urgency] || 'var(--gaip-text-secondary)';
        
        // Build mini trajectory visualization
        var miniChart = trajectory.trajectory.slice(0, 14).map(function(day, i) {
            var height = Math.max(4, day.totalScore * 0.4);
            var col = levelColours[day.level] || 'var(--gaip-text-secondary)';
            return `<div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 100%; height: ${height}px; background: ${col}; border-radius: 2px 2px 0 0;"></div>
                <div style="font-size: 8px; color: var(--gaip-text); margin-top: 2px;">${i === 0 ? 'Now' : (i === 7 ? '7d' : '')}</div>
            </div>`;
        }).join('');
        
        return `
        <div class="gaip-stress-trajectory-panel" style="margin-top: 16px; padding: 16px; background: #0f172a; border-radius: 8px; color: var(--gaip-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 14px; font-weight: 600;">📈 Stress Trajectory (${trajectory.projectionDays} days)</h4>
                <span style="font-size: 12px; padding: 2px 10px; border-radius: 999px; background: ${urgencyColour}30; color: ${urgencyColour}; border: 1px solid ${urgencyColour}50;">
                    ${summary.recommendation.urgency.toUpperCase()}
                </span>
            </div>
            
            <!-- Mini chart -->
            <div style="display: flex; gap: 2px; height: 50px; align-items: flex-end; margin-bottom: 12px; padding: 4px; background: var(--gaip-text); border-radius: 4px;">
                ${miniChart}
            </div>
            
            <!-- Stats row -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
                <div style="text-align: center; padding: 8px; background: var(--gaip-text); border-radius: 6px;">
                    <div style="font-size: 20px; font-weight: 700; color: ${currentColour};">${summary.currentScore}</div>
                    <div style="font-size: 10px; color: var(--gaip-text);">Current</div>
                </div>
                <div style="text-align: center; padding: 8px; background: var(--gaip-text); border-radius: 6px;">
                    <div style="font-size: 20px; font-weight: 700; color: ${peakColour};">${summary.peakScore}</div>
                    <div style="font-size: 10px; color: var(--gaip-text);">Peak (Day ${summary.peakDay})</div>
                </div>
                <div style="text-align: center; padding: 8px; background: var(--gaip-text); border-radius: 6px;">
                    <div style="font-size: 20px; font-weight: 700; color: #60a5fa;">${summary.primaryStressor || '-'}</div>
                    <div style="font-size: 10px; color: var(--gaip-text);">Primary Stressor</div>
                </div>
            </div>
            
            <!-- Recommendation -->
            <div style="padding: 10px; background: ${urgencyColour}15; border-left: 3px solid ${urgencyColour}; border-radius: 4px;">
                <div style="font-size: 13px; color: ${urgencyColour}; font-weight: 500; margin-bottom: 4px;">
                    ${summary.recommendation.message}
                </div>
                ${summary.recommendation.actions.length > 0 ? `
                <ul style="margin: 8px 0 0 0; padding-left: 16px; font-size: 12px; color: var(--gaip-text);">
                    ${summary.recommendation.actions.map(a => '<li>' + a + '</li>').join('')}
                </ul>
                ` : ''}
            </div>
            
            ${summary.interventionWindows.length > 0 ? `
            <div style="margin-top: 12px; font-size: 12px; color: #22c55e;">
                ✓ Intervention window: ${summary.interventionWindows[0].start} to ${summary.interventionWindows[0].end}
            </div>
            ` : ''}
            
            <div style="margin-top: 8px; font-size: 10px; color: var(--gaip-text); text-align: right;">
                Trend: ${summary.trend} | v${trajectory.version}
            </div>
        </div>
        `;
    }

    /* =========================================================================
       CASCADE ORCHESTRATOR INTEGRATION
    ========================================================================= */

    /**
     * Register with cascade orchestrator if available
     */
    function registerWithCascade() {
        if (!global.GilbaCascadeOrchestrator) {
            return;
        }
        
        // Register DLI-Recovery as a cascade step
        if (global.GilbaCascadeOrchestrator.registerEngine) {
            global.GilbaCascadeOrchestrator.registerEngine('dli-recovery-bridge', {
                execute: function(state) {
                    if (!global.GAIP_DLI_Recovery) return state;
                    
                    var shadeResult = state.computed?.shade || state.se;
                    if (!shadeResult) return state;
                    
                    var dliRecovery = global.GAIP_DLI_Recovery.calculate(shadeResult, state.inputs);
                    
                    state.computed = state.computed || {};
                    state.computed.dliRecovery = dliRecovery;
                    
                    return state;
                },
                dependencies: ['shade-engine'],
                provides: ['dliRecovery']
            });
            
            // Register Stress Trajectory as final step
            global.GilbaCascadeOrchestrator.registerEngine('stress-trajectory', {
                execute: function(state, weather) {
                    if (!global.GAIP_StressTrajectory) return state;
                    
                    var trajectoryState = {
                        shadeResult: state.computed?.shade,
                        wearResult: state.computed?.wearRecovery,
                        diseaseResult: state.computed?.disease,
                        tissueResult: state.computed?.tissue,
                        dliRecovery: state.computed?.dliRecovery,
                        climateMetrics: state.computed?.climate,
                        turf: state.inputs?.turf,
                        site: state.inputs?.site,
                        fertility: state.inputs?.fertility
                    };
                    
                    var trajectory = global.GAIP_StressTrajectory.project(trajectoryState, weather);
                    
                    state.computed = state.computed || {};
                    state.computed.stressTrajectory = trajectory;
                    
                    return state;
                },
                dependencies: ['wear-recovery-engine', 'disease-engine', 'dli-recovery-bridge'],
                provides: ['stressTrajectory']
            });
            
        }
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */

    global.GAIP_Integration = {
        VERSION: VERSION,
        
        // Enhanced wear-recovery with DLI bridge
        enhancedWearRecoveryAnalysis: enhancedWearRecoveryAnalysis,
        
        // Stress trajectory
        runStressTrajectory: runStressTrajectory,
        simulateEventImpact: simulateEventImpact,
        
        // Rendering helpers
        renderDLIRecoveryPanel: renderDLIRecoveryPanel,
        renderStressTrajectorySummary: renderStressTrajectorySummary,
        
        // Cascade registration
        registerWithCascade: registerWithCascade
    };

    // Auto-register with cascade on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerWithCascade);
    } else {
        registerWithCascade();
    }


})(typeof window !== 'undefined' ? window : this);
