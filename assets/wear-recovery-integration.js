/**
 * ============================================================================
 * GILBA WEAR & RECOVERY ENGINE - HUB INTEGRATION
 * ============================================================================
 * 
 * This file provides:
 * 1. HTML form inputs for the Traffic & Wear section
 * 2. State reading function for wear/recovery inputs
 * 3. Results rendering function
 * 4. Integration with existing hub
 * 
 * ============================================================================
 */

(function() {
    'use strict';

    // ========================================================================
    // HTML FORM TEMPLATE
    // Insert this into the hub's Traffic & Wear section
    // ========================================================================

    const WEAR_RECOVERY_HTML = `
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- TRAFFIC & WEAR INPUTS - Enhanced v1.0 -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->

<section class="gaip-card">
    <div class="gaip-card-header">
        <h3>Traffic & Wear</h3>
        <span class="gaip-card-toggle">▼</span>
    </div>
    <div class="gaip-card-body">
        
        <!-- Site Construction -->
        <div class="gaip-form-row">
            <label>Field Construction</label>
            <select class="gaip-construction">
                <option value="soil">Native Soil (with/without drains)</option>
                <option value="pipe_drained">Pipe/Slit Drained</option>
                <option value="sand_profile">Sand Profile with Drains</option>
                <option value="sand_carpet">Sand Carpet Construction</option>
                <option value="hybrid">Hybrid (reinforced turf)</option>
            </select>
        </div>
        
        <div class="gaip-form-row">
            <label>Current Soil Moisture</label>
            <select class="gaip-soil-moisture">
                <option value="dry">Dry</option>
                <option value="slightly_dry">Slightly Dry</option>
                <option value="optimal" selected>Optimal</option>
                <option value="moist">Moist</option>
                <option value="wet">Wet</option>
                <option value="saturated">Saturated</option>
            </select>
        </div>

        <!-- Match Schedule -->
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gaip-border);">
            <strong style="color: #2c5f2d;">Match Schedule</strong>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid">
            <div>
                <label>Sport</label>
                <select class="gaip-match-sport">
                    <option value="soccer">Soccer</option>
                    <option value="afl">AFL</option>
                    <option value="rugby_union">Rugby Union</option>
                    <option value="rugby_league">Rugby League</option>
                </select>
            </div>
            <div>
                <label>Matches/Week</label>
                <input type="number" class="gaip-matches-week" value="2" min="0" max="14" step="1">
            </div>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid">
            <div>
                <label>Match Duration (hrs)</label>
                <input type="number" class="gaip-match-duration" value="1.5" min="0.5" max="3" step="0.5">
            </div>
            <div>
                <label>Player Age Group</label>
                <select class="gaip-age-group">
                    <option value="junior">Junior (U12)</option>
                    <option value="youth">Youth (12-17)</option>
                    <option value="adult" selected>Adult (18-35)</option>
                    <option value="masters">Masters (35+)</option>
                </select>
            </div>
        </div>
        
        <div class="gaip-form-row">
            <label>Typical Squad Size</label>
            <select class="gaip-team-size">
                <option value="small">Small (&lt;15 players)</option>
                <option value="medium" selected>Medium (15-30 players)</option>
                <option value="large">Large (30+ players)</option>
            </select>
        </div>

        <!-- Training Schedule -->
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gaip-border);">
            <strong style="color: #2c5f2d;">Training Schedule</strong>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid">
            <div>
                <label>Training Type</label>
                <select class="gaip-training-type">
                    <option value="training_full">Full Training (match sim)</option>
                    <option value="training_drills" selected>Skills & Drills</option>
                    <option value="training_light">Light Training</option>
                </select>
            </div>
            <div>
                <label>Sessions/Week</label>
                <input type="number" class="gaip-sessions-week" value="3" min="0" max="14" step="1">
            </div>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid">
            <div>
                <label>Session Duration (hrs)</label>
                <input type="number" class="gaip-session-duration" value="1.5" min="0.5" max="3" step="0.5">
            </div>
            <div>
                <label>Field Rotation %</label>
                <input type="number" class="gaip-training-rotation" value="100" min="10" max="100" step="5"
                       title="100% = full field used, rotated. 50% = half field used, concentrated wear.">
            </div>
        </div>
        
        <div class="gaip-form-row">
            <label>Rest Days Available/Week</label>
            <input type="number" class="gaip-rest-days" value="2" min="0" max="7" step="1">
        </div>

        <!-- Cumulative Stress History -->
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gaip-border);">
            <strong style="color: #2c5f2d;">Prior Stress (Last 4 Weeks)</strong>
            <span style="font-size: 11px; color: var(--gaip-text); display: block; margin-top: 4px;">
                Enter actual hours from prior weeks to calculate cumulative stress
            </span>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid gaip-prior-weeks">
            <div>
                <label>Week -1 (hrs)</label>
                <input type="number" class="gaip-prior-week-1" value="" min="0" max="50" step="0.5" placeholder=",">
            </div>
            <div>
                <label>Week -2 (hrs)</label>
                <input type="number" class="gaip-prior-week-2" value="" min="0" max="50" step="0.5" placeholder=",">
            </div>
        </div>
        <div class="gaip-form-row gaip-form-row-grid gaip-prior-weeks">
            <div>
                <label>Week -3 (hrs)</label>
                <input type="number" class="gaip-prior-week-3" value="" min="0" max="50" step="0.5" placeholder=",">
            </div>
            <div>
                <label>Week -4 (hrs)</label>
                <input type="number" class="gaip-prior-week-4" value="" min="0" max="50" step="0.5" placeholder=",">
            </div>
        </div>

        <!-- Turf Condition Factors -->
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gaip-border);">
            <strong style="color: #2c5f2d;">Turf Condition Factors</strong>
        </div>
        
        <div class="gaip-form-row gaip-form-row-grid">
            <div>
                <label>Height of Cut (mm)</label>
                <input type="number" class="gaip-hoc" value="30" min="3" max="100" step="1">
            </div>
            <div>
                <label>Est. Root Depth (mm)</label>
                <input type="number" class="gaip-root-depth" value="100" min="10" max="300" step="10">
            </div>
        </div>
        
        <div class="gaip-form-row">
            <label>Overseed Status</label>
            <select class="gaip-overseed-status">
                <option value="none" selected>None / Pure Stand</option>
                <option value="pre_seed">Pre-seed (planning)</option>
                <option value="germinating">Germinating (0-2 weeks)</option>
                <option value="establishing">Establishing (2-4 weeks)</option>
                <option value="immature">Immature (4-8 weeks)</option>
                <option value="maturing">Maturing (8-12 weeks)</option>
                <option value="mature">Mature (12+ weeks)</option>
                <option value="transitioning">Transitioning (spring)</option>
                <option value="fading">Fading</option>
                <option value="dead">Dead (warm-season only)</option>
            </select>
        </div>
        
    </div>
</section>
`;

    // ========================================================================
    // CSS ADDITIONS
    // ========================================================================

    const WEAR_RECOVERY_CSS = `
/* Wear & Recovery Engine Styles */
.gaip-form-row-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.gaip-prior-weeks input::placeholder {
    color: var(--gaip-text-muted);
    font-style: italic;
}

/* Risk bar */
.gaip-risk-bar-container {
    width: 100%;
    background: var(--gaip-surface-hover);
    border-radius: 6px;
    height: 18px;
    margin-top: 10px;
    overflow: hidden;
}

.gaip-risk-bar {
    height: 18px;
    width: 0%;
    background: #4caf50;
    transition: width 300ms ease, background 300ms ease;
}

/* Action priority badge */
.gaip-priority-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
}

.gaip-priority-low { background: var(--gaip-good-bg); color: #2e7d32; }
.gaip-priority-medium { background: var(--gaip-warning-bg); color: #f57f17; }
.gaip-priority-high { background: var(--gaip-critical-bg); color: #c62828; }

/* Stress status indicator */
.gaip-stress-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.gaip-stress-recovering { background: var(--gaip-good-bg); color: #2e7d32; }
.gaip-stress-stable { background: var(--gaip-info-bg); color: #1565c0; }
.gaip-stress-stressed { background: var(--gaip-warning-bg); color: #f57f17; }
.gaip-stress-critical { background: var(--gaip-critical-bg); color: #c62828; }

/* Load breakdown table */
.gaip-load-breakdown {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;
    margin-top: 8px;
}

.gaip-load-breakdown th,
.gaip-load-breakdown td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--gaip-surface-hover);
}

.gaip-load-breakdown th {
    background: var(--gaip-surface-muted);
    font-weight: 600;
}

/* Recommendations */
.gaip-recommendation {
    padding: 10px 12px;
    margin: 8px 0;
    border-radius: 6px;
    font-size: 13px;
}

.gaip-recommendation-critical {
    background: var(--gaip-critical-bg);
    border-left: 4px solid #c62828;
}

.gaip-recommendation-warning {
    background: var(--gaip-warning-bg);
    border-left: 4px solid #f57f17;
}

.gaip-recommendation-positive {
    background: var(--gaip-good-bg);
    border-left: 4px solid #2e7d32;
}

.gaip-recommendation .rec-title {
    font-weight: 600;
    margin-bottom: 4px;
}

.gaip-recommendation .rec-action {
    color: var(--gaip-text);
    font-size: 12px;
}
`;

    // ========================================================================
    // STATE READING FUNCTION
    // ========================================================================

    function readWearRecoveryState(root) {
        if (!root) root = document;
        
        const safeNum = (el, fallback) => {
            if (!el) return fallback;
            const n = parseFloat(el.value);
            return isFinite(n) ? n : fallback;
        };
        
        const safeVal = (el, fallback) => {
            return el ? el.value : fallback;
        };

        // Build prior weeks array
        const priorWeeks = [];
        const maxHours = {
            soil: 3.0,
            sand_profile: 7.8,
            sand_carpet: 12.5
        };
        const construction = safeVal(root.querySelector('.gaip-construction'), 'soil');
        const capacity = maxHours[construction] || 3.0;
        
        for (let i = 1; i <= 4; i++) {
            const hours = safeNum(root.querySelector(`.gaip-prior-week-${i}`), null);
            if (hours !== null) {
                priorWeeks.push({
                    load: hours,
                    capacity: capacity
                });
            }
        }

        return {
            site: {
                construction: construction,
                soilMoisture: safeVal(root.querySelector('.gaip-soil-moisture'), 'optimal')
            },
            traffic: {
                // Matches
                matchCode: safeVal(root.querySelector('.gaip-match-sport'), 'soccer'),
                matchesPerWeek: safeNum(root.querySelector('.gaip-matches-week'), 0),
                matchDuration: safeNum(root.querySelector('.gaip-match-duration'), 1.5),
                
                // Training
                trainingCode: safeVal(root.querySelector('.gaip-training-type'), 'training_drills'),
                sessionsPerWeek: safeNum(root.querySelector('.gaip-sessions-week'), 0),
                sessionDuration: safeNum(root.querySelector('.gaip-session-duration'), 1.5),
                trainingRotation: safeNum(root.querySelector('.gaip-training-rotation'), 100),
                
                // Common
                ageGroup: safeVal(root.querySelector('.gaip-age-group'), 'adult'),
                teamSize: safeVal(root.querySelector('.gaip-team-size'), 'medium'),
                restDays: safeNum(root.querySelector('.gaip-rest-days'), 2),
                
                // Prior weeks for cumulative stress
                priorWeeks: priorWeeks
            },
            turf: {
                // These would come from existing turf inputs
                // Adding wear-specific ones here
                heightOfCut: safeNum(root.querySelector('.gaip-hoc'), 30),
                rootDepth: safeNum(root.querySelector('.gaip-root-depth'), 100),
                overseedStatus: safeVal(root.querySelector('.gaip-overseed-status'), 'none')
            }
        };
    }

    // ========================================================================
    // RESULTS RENDERING FUNCTION
    // ========================================================================

    function renderWearRecoveryResults(results, container) {
        if (!container) return;
        
        const r = results;
        
        // Determine risk color
        let riskColor = '#4caf50';
        let riskLabel = 'Low';
        if (r.compactionRisk.riskPercent >= 70) {
            riskColor = '#e53935';
            riskLabel = 'High';
        } else if (r.compactionRisk.riskPercent >= 40) {
            riskColor = '#ffc107';
            riskLabel = 'Moderate';
        }
        
        // Wear resistance label
        const wearLabel = r.wearResistance.score >= 8.5 ? 'Excellent' :
                          r.wearResistance.score >= 7.0 ? 'Good' :
                          r.wearResistance.score >= 5.5 ? 'Moderate' :
                          r.wearResistance.score >= 4.0 ? 'Poor' : 'Very Poor';
        
        // Build load breakdown table
        let breakdownHTML = '';
        if (r.effectiveLoad.breakdown.length > 0) {
            breakdownHTML = `
                <table class="gaip-load-breakdown">
                    <thead>
                        <tr>
                            <th>Activity</th>
                            <th>Raw Hrs</th>
                            <th>Factor</th>
                            <th>Effective</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${r.effectiveLoad.breakdown.map(b => `
                            <tr>
                                <td>${b.name}</td>
                                <td>${b.rawHours.toFixed(1)}</td>
                                <td>${b.factor.toFixed(2)}${b.rotationFactor ? ` × ${b.rotationFactor.toFixed(2)}` : ''}</td>
                                <td><strong>${b.effectiveHours.toFixed(1)}</strong></td>
                            </tr>
                        `).join('')}
                        <tr style="border-top: 2px solid var(--gaip-border);">
                            <td colspan="3"><strong>Total Effective Load</strong></td>
                            <td><strong>${r.effectiveLoad.totalEffectiveHours.toFixed(1)} hrs/wk</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
        
        // Build recommendations HTML
        let recsHTML = '';
        if (r.recommendations.length > 0) {
            recsHTML = r.recommendations.map(rec => `
                <div class="gaip-recommendation gaip-recommendation-${rec.type}">
                    <div class="rec-title">${rec.text}</div>
                    <div class="rec-action">→ ${rec.action}</div>
                </div>
            `).join('');
        }
        
        // Build stress impact section from orchestrator data
        let stressImpactHTML = '';
        const orchestratorWear = window.GaipOrchestrator?.getComputed?.('wear');
        const adjustedRecovery = orchestratorWear?.adjustedRecovery || r.adjustedRecovery;
        
        if (adjustedRecovery && adjustedRecovery.adjustments && adjustedRecovery.adjustments.length > 0) {
            const baseProb = adjustedRecovery.baseProbability || 80;
            const adjProb = adjustedRecovery.adjustedProbability || r.recoveryProbability;
            const baseDays = adjustedRecovery.baseDays || 5;
            const adjDays = adjustedRecovery.adjustedDays || r.recoveryWindow;
            
            const stressFactorItems = adjustedRecovery.adjustments.map(adj => {
                let icon = '•';
                let color = '#d97706';
                if (adj.factor === 'shade') { icon = '☁️'; color = '#6366f1'; }
                else if (adj.factor === 'salinity') { icon = '💧'; color = '#0891b2'; }
                else if (adj.factor === 'temperature') { icon = '🌡️'; color = '#dc2626'; }
                else if (adj.factor === 'compound') { icon = '⚠️'; color = '#7c3aed'; }
                
                return `<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gaip-surface-hover);">
                    <span>${icon}</span>
                    <span style="flex: 1; color: var(--gaip-text);">${adj.modification || adj.factor}</span>
                    <span style="color: ${color}; font-weight: 500;">${adj.effect}</span>
                </div>`;
            }).join('');
            
            stressImpactHTML = `
                <div style="margin-top: 16px; padding: 12px; background: var(--gaip-warning-bg); border-left: 4px solid #f59e0b; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #92400e;">⚠️ Stress Factors Affecting Recovery</strong>
                        <span style="font-size: 12px; color: var(--gaip-text);">
                            ${baseProb}% → ${adjProb}% probability | ${baseDays}d → ${adjDays}d window
                        </span>
                    </div>
                    <div style="font-size: 13px;">
                        ${stressFactorItems}
                    </div>
                    ${adjustedRecovery.warning ? `
                        <div style="margin-top: 8px; padding: 8px; background: var(--gaip-critical-bg); border-radius: 4px; font-size: 12px; color: #dc2626;">
                            ${adjustedRecovery.warning}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Modifiers detail (collapsed by default)
        const modifiersHTML = `
            <details style="margin-top: 12px;">
                <summary style="cursor: pointer; font-weight: 500; color: var(--gaip-text);">
                    View Wear Resistance Modifiers
                </summary>
                <div style="padding: 10px; background: var(--gaip-surface-muted); border-radius: 4px; margin-top: 8px; font-size: 12px;">
                    <div><strong>Base NTEP Rating:</strong> ${r.wearResistance.baseNTEP.toFixed(1)}</div>
                    <div><strong>HOC Modifier:</strong> ${(r.wearResistance.modifiers.hoc.value * 100).toFixed(0)}% 
                        (${r.wearResistance.modifiers.hoc.actual}mm vs ${r.wearResistance.modifiers.hoc.optimal}mm optimal)</div>
                    <div><strong>Growth Modifier:</strong> ${(r.wearResistance.modifiers.growth * 100).toFixed(0)}%</div>
                    <div><strong>Shade Modifier:</strong> ${(r.wearResistance.modifiers.shade * 100).toFixed(0)}%</div>
                    <div><strong>Overseed Modifier:</strong> ${(r.wearResistance.modifiers.overseed.value * 100).toFixed(0)}% 
                        (${r.wearResistance.modifiers.overseed.status})</div>
                    ${r.wearResistance.modifiers.overseed.enhanced ? `
                        <div style="margin: 8px 0; padding: 8px; background: ${r.wearResistance.modifiers.overseed.impactLevel === 'severe' ? 'var(--gaip-critical-bg)' : r.wearResistance.modifiers.overseed.impactLevel === 'significant' ? 'var(--gaip-warning-bg)' : 'var(--gaip-good-bg)'}; border-radius: 4px; border-left: 3px solid ${r.wearResistance.modifiers.overseed.impactLevel === 'severe' ? '#ef4444' : r.wearResistance.modifiers.overseed.impactLevel === 'significant' ? '#f59e0b' : '#22c55e'};">
                            <div><strong>Overseed Impact:</strong> ${r.wearResistance.modifiers.overseed.impactLevel.charAt(0).toUpperCase() + r.wearResistance.modifiers.overseed.impactLevel.slice(1)} 
                                (${r.wearResistance.modifiers.overseed.reductionPercent}% wear tolerance reduction)</div>
                            ${r.wearResistance.modifiers.overseed.managementNotes && r.wearResistance.modifiers.overseed.managementNotes.length > 0 ? `
                                <div style="margin-top: 6px; font-size: 11px;">
                                    <strong>Management Notes:</strong>
                                    <ul style="margin: 4px 0 0 0; padding-left: 16px;">
                                        ${r.wearResistance.modifiers.overseed.managementNotes.map(note => '<li>' + note + '</li>').join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div><strong>Root Depth Modifier:</strong> ${(r.wearResistance.modifiers.rootDepth * 100).toFixed(0)}%</div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gaip-border);">
                        <strong>Final Score:</strong> ${r.wearResistance.score.toFixed(1)} / 10
                    </div>
                </div>
            </details>
        `;
        
        // Get adjusted recovery values
        const displayRecoveryProb = adjustedRecovery?.adjustedProbability ?? r.recoveryProbability;
        const displayRecoveryDays = adjustedRecovery?.adjustedDays ?? r.recoveryWindow;
        const hasStressAdjustment = adjustedRecovery?.adjustments?.length > 0;
        const baseRecoveryProb = adjustedRecovery?.baseProbability ?? r.recoveryProbability;
        const baseRecoveryDays = adjustedRecovery?.baseDays ?? r.recoveryWindow;
        
        // Main output HTML
        const html = `
            <div class="gaip-wear-recovery-results">
                <!-- Header metrics -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                    <div style="background: var(--gaip-surface-muted); padding: 12px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: ${riskColor};">
                            ${r.compactionRisk.riskPercent}%
                        </div>
                        <div style="font-size: 11px; color: var(--gaip-text);">Compaction Risk</div>
                    </div>
                    <div style="background: var(--gaip-surface-muted); padding: 12px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: ${r.wearResistance.score >= 7 ? '#2e7d32' : r.wearResistance.score >= 5 ? '#f57f17' : '#c62828'};">
                            ${r.wearResistance.score.toFixed(1)}
                        </div>
                        <div style="font-size: 11px; color: var(--gaip-text);">Wear Tolerance (${wearLabel})</div>
                    </div>
                    <div style="background: ${hasStressAdjustment ? 'var(--gaip-warning-bg)' : 'var(--gaip-surface-muted)'}; padding: 12px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: ${displayRecoveryProb >= 70 ? '#2e7d32' : displayRecoveryProb >= 40 ? '#f57f17' : '#c62828'};">
                            ${displayRecoveryProb}%
                        </div>
                        <div style="font-size: 11px; color: var(--gaip-text);">
                            Recovery Probability
                            ${hasStressAdjustment ? `<br><span style="color: #92400e;">(was ${baseRecoveryProb}%)</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Risk bar -->
                <div class="gaip-risk-bar-container">
                    <div class="gaip-risk-bar" style="width: ${r.compactionRisk.riskPercent}%; background: ${riskColor};"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--gaip-text); margin-top: 4px;">
                    <span>0% (Under capacity)</span>
                    <span>Max: ${r.compactionRisk.maxHours} hrs/wk (${r.compactionRisk.construction})</span>
                </div>
                
                <!-- Secondary metrics -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0;">
                    <div>
                        <strong>Action Priority:</strong>
                        <span class="gaip-priority-badge gaip-priority-${r.actionPriority.priority.toLowerCase()}">
                            ${r.actionPriority.priority}
                        </span>
                    </div>
                    <div>
                        <strong>Cumulative Stress:</strong>
                        <span class="gaip-stress-status gaip-stress-${r.cumulativeStress.status}">
                            ${r.cumulativeStress.status.charAt(0).toUpperCase() + r.cumulativeStress.status.slice(1)}
                            ${r.cumulativeStress.debtHours > 0 ? `(${r.cumulativeStress.debtHours.toFixed(1)} hrs debt)` : ''}
                        </span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                    <div>
                        <strong>Recovery Window:</strong> ${displayRecoveryDays} days
                        ${hasStressAdjustment && displayRecoveryDays !== baseRecoveryDays ? 
                            `<span style="color: #92400e; font-size: 12px;"> (was ${baseRecoveryDays}d)</span>` : ''}
                    </div>
                    <div>
                        <strong>Aeration Interval:</strong> Every ${r.aerationSchedule.recommendedWeeks} weeks
                    </div>
                </div>
                
                <!-- Load breakdown -->
                <div style="margin-top: 16px;">
                    <strong>Weekly Load Analysis</strong>
                    <div style="font-size: 12px; color: var(--gaip-text);">
                        Effective load: ${r.effectiveLoad.totalEffectiveHours.toFixed(1)} hrs/wk 
                        (${Math.round(r.compactionRisk.usageRatio * 100)}% of ${r.compactionRisk.maxHours} hr capacity)
                    </div>
                    ${breakdownHTML}
                </div>
                
                ${r.wearResistance.modifiers.overseed.enhanced && 
                  (r.wearResistance.modifiers.overseed.impactLevel === 'severe' || 
                   r.wearResistance.modifiers.overseed.impactLevel === 'significant') ? `
                    <div style="margin-top: 16px; padding: 12px; background: ${r.wearResistance.modifiers.overseed.impactLevel === 'severe' ? 'var(--gaip-critical-bg)' : 'var(--gaip-warning-bg)'}; border-left: 4px solid ${r.wearResistance.modifiers.overseed.impactLevel === 'severe' ? '#ef4444' : '#f59e0b'}; border-radius: 6px;">
                        <strong style="color: ${r.wearResistance.modifiers.overseed.impactLevel === 'severe' ? '#dc2626' : '#d97706'};">
                            ⚠ Overseed Impact: ${r.wearResistance.modifiers.overseed.impactLevel.charAt(0).toUpperCase() + r.wearResistance.modifiers.overseed.impactLevel.slice(1)}
                        </strong>
                        <p style="margin: 8px 0 0 0; font-size: 13px;">
                            Wear tolerance reduced by ${r.wearResistance.modifiers.overseed.reductionPercent}% due to ${r.wearResistance.modifiers.overseed.status} overseed stage.
                        </p>
                        ${r.wearResistance.modifiers.overseed.managementNotes && r.wearResistance.modifiers.overseed.managementNotes.length > 0 ? `
                            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px;">
                                ${r.wearResistance.modifiers.overseed.managementNotes.map(note => '<li>' + note + '</li>').join('')}
                            </ul>
                        ` : ''}
                    </div>
                ` : ''}
                
                <!-- Modifiers detail -->
                ${modifiersHTML}
                
                <!-- Stress Impact from Orchestrator -->
                ${stressImpactHTML}
                
                <!-- Recommendations -->
                ${recsHTML.length > 0 ? `
                    <div style="margin-top: 16px;">
                        <strong>Recommendations</strong>
                        ${recsHTML}
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = html;
    }

    // ========================================================================
    // INTEGRATION WITH EXISTING HUB
    // ========================================================================

    /**
     * Wrapper function to run wear/recovery analysis
     * Call this from the main hub runHub() function
     */
    function runWearRecoveryAnalysis(state, weather, shadeData, FIobj) {
        // Check if engine is loaded
        if (typeof gaip_wear_recovery_engine !== 'function') {
            console.warn('⚠️ Wear/Recovery Engine not loaded');
            return null;
        }
        
        // Merge wear-specific state with main state
        const root = document.getElementById('gaip-hub');
        const wearState = readWearRecoveryState(root);
        
        // Combine states
        const combinedState = {
            ...state,
            site: {
                ...state.site,
                ...wearState.site
            },
            traffic: {
                ...state.traffic,
                ...wearState.traffic
            },
            turf: {
                ...state.turf,
                ...wearState.turf
            },
            monthIndex: state.monthIndex ?? new Date().getMonth()  // pure engine requires explicit date
        };
        
        // =====================================================================
        // DLI-RECOVERY BRIDGE INTEGRATION (v1.1.0)
        // Enhances shadeData with species-specific recovery modifiers
        // =====================================================================
        let enhancedShadeData = shadeData || {};
        
        if (typeof window.GAIP_DLI_Recovery !== 'undefined' && window.GAIP_DLI_Recovery.calculate) {
            try {
                const dliRecovery = window.GAIP_DLI_Recovery.calculate(shadeData, combinedState);
                
                if (dliRecovery && dliRecovery.available) {
                    // Merge DLI recovery data into shade data
                    enhancedShadeData = {
                        ...shadeData,
                        // Core recovery modifier from DLI bridge
                        stressFactor: dliRecovery.stressFactor,
                        dliRecoveryFactor: dliRecovery.factor,
                        
                        // DLI metrics for display/debugging
                        dliActual: dliRecovery.dliActual,
                        dliMin: dliRecovery.dliMin,
                        dliTarget: dliRecovery.dliTarget,
                        dliOptimal: dliRecovery.dliOptimal,
                        dliDeficitPct: dliRecovery.deficitPct,
                        
                        // Category and severity
                        dliCategory: dliRecovery.category,
                        dliSeverity: dliRecovery.severity,
                        dliColour: dliRecovery.colour,
                        dliImpactDescription: dliRecovery.impactDescription,
                        
                        // LED requirement flag
                        ledRequired: dliRecovery.ledRequired,
                        ledDeficitMol: dliRecovery.ledDeficitMol,
                        
                        // Source tracking
                        _dliRecoveryBridge: true,
                        _dliRecoveryVersion: dliRecovery.version
                    };
                } else {
                }
            } catch (dliErr) {
                console.warn('[WearRecovery] DLI-Recovery Bridge error:', dliErr);
            }
        } else {
        }
        
        // Run analysis with enhanced shade data
        try {
            const results = gaip_wear_recovery_engine(combinedState, weather, enhancedShadeData, FIobj);
            
            // Attach DLI recovery info to results for UI display
            if (enhancedShadeData._dliRecoveryBridge) {
                results.dliRecovery = {
                    applied: true,
                    stressFactor: enhancedShadeData.stressFactor,
                    recoveryFactor: enhancedShadeData.dliRecoveryFactor,
                    category: enhancedShadeData.dliCategory,
                    severity: enhancedShadeData.dliSeverity,
                    colour: enhancedShadeData.dliColour,
                    impactDescription: enhancedShadeData.dliImpactDescription,
                    dliActual: enhancedShadeData.dliActual,
                    dliTarget: enhancedShadeData.dliTarget,
                    ledRequired: enhancedShadeData.ledRequired,
                    ledDeficitMol: enhancedShadeData.ledDeficitMol
                };
            }
            
            return results;
        } catch (err) {
            console.error('❌ Wear/Recovery analysis failed:', err);
            return null;
        }
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    window.GAIP_WEAR_RECOVERY_HTML = WEAR_RECOVERY_HTML;
    window.GAIP_WEAR_RECOVERY_CSS = WEAR_RECOVERY_CSS;
    window.gaip_read_wear_state = readWearRecoveryState;
    window.gaip_render_wear_results = renderWearRecoveryResults;
    window.gaip_run_wear_analysis = runWearRecoveryAnalysis;

    // ========================================================================
    // TURF PROFILE LISTENER
    // ========================================================================
    // Shows/hides Traffic & Wear card based on turf type selection.
    // Only Sports Fields need wear/recovery analysis.
    // ========================================================================

    function findTrafficWearCard() {
        // Try multiple selectors to find the card
        return document.querySelector('[data-card="traffic"]') ||
               document.querySelector('.gaip-card-traffic') ||
               document.querySelector('.gaip-card:has(.gaip-matches-week)') ||
               Array.from(document.querySelectorAll('.gaip-card')).find(card => {
                   const header = card.querySelector('.gaip-card-header h3, .gaip-card-header');
                   return header && header.textContent.includes('Traffic');
               });
    }

    function handleTurfProfileChange(event) {
        const { turfType, thresholds } = event.detail;
        const trafficCard = findTrafficWearCard();
        
        if (!trafficCard) {
            console.warn('[WearRecovery] Traffic & Wear card not found');
            return;
        }
        
        // Show card only for sports fields (where wearRecoveryActive is true)
        const shouldShow = thresholds && thresholds.wearRecoveryActive === true;
        
        if (shouldShow) {
            trafficCard.style.display = '';
            trafficCard.classList.remove('gaip-card-hidden');
        } else {
            trafficCard.style.display = 'none';
            trafficCard.classList.add('gaip-card-hidden');
        }
    }

    // Listen for turf profile changes
    document.addEventListener('gaip:turf-profile-change', handleTurfProfileChange);

    // Also handle initial state on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        // If GaipTurfProfile exists and has state, check initial visibility
        if (window.GaipTurfProfile && window.GaipTurfProfile.state) {
            const ctx = window.GaipTurfProfile.getThresholdContext();
            if (ctx && ctx.wearRecoveryActive === false) {
                const trafficCard = findTrafficWearCard();
                if (trafficCard) {
                    trafficCard.style.display = 'none';
                    trafficCard.classList.add('gaip-card-hidden');
                }
            }
        }
    });


})();
