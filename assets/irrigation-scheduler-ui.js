/**
 * ============================================================================
 * GILBA IRRIGATION SCHEDULER UI v1.2.0
 * ============================================================================
 * 
 * Progressive disclosure UI for irrigation scheduler integration.
 * Displays schedule, water balance, and recommendations.
 * 
 * v1.2.0: Fixed property mapping from scheduler to UI
 *   - FIX: Map scheduler's currentDepletion/raw to UI's etDeficit/deficitThreshold
 *   - FIX: Calculate deficitRemaining from scheduler output
 *   - FIX: Derive strategy label from MAD value when not provided
 *   - Added support for 'critical' and 'stressed' status classes
 * 
 * v1.1.0: Added organic matter effect display
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CSS
    // ========================================================================

    const IRRIGATION_CSS = `
        .irrigation-scheduler {
            background: var(--gaip-surface-muted);
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
        }
        
        .irrigation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .irrigation-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--gaip-text);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .water-balance-card {
            background: var(--gaip-surface);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            border-left: 4px solid #3b82f6;
        }
        
        .water-balance-card.critical {
            border-left-color: #ef4444;
            background: var(--gaip-critical-bg);
        }
        
        .water-balance-card.stressed {
            border-left-color: #f59e0b;
            background: var(--gaip-warning-bg);
        }
        
        .water-balance-meter {
            height: 12px;
            background: var(--gaip-border);
            border-radius: 6px;
            overflow: hidden;
            margin: 12px 0;
        }
        
        .water-balance-fill {
            height: 100%;
            border-radius: 6px;
            transition: width 0.3s ease;
        }
        
        .water-balance-fill.optimal { background: #22c55e; }
        .water-balance-fill.adequate { background: #84cc16; }
        .water-balance-fill.stressed { background: #f59e0b; }
        .water-balance-fill.critical { background: #ef4444; }
        
        .irrigation-schedule {
            display: grid;
            gap: 8px;
        }
        
        .schedule-day {
            display: grid;
            grid-template-columns: 60px 1fr auto;
            gap: 12px;
            align-items: center;
            padding: 12px;
            background: var(--gaip-surface);
            border-radius: 8px;
            border: 1px solid var(--gaip-border);
        }
        
        .schedule-day.irrigate {
            border-color: #3b82f6;
            background: var(--gaip-info-bg);
        }
        
        .schedule-day.critical {
            border-color: #ef4444;
            background: var(--gaip-critical-bg);
        }
        
        .day-name {
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .day-date {
            font-size: 11px;
            color: var(--gaip-text);
        }
        
        .day-metrics {
            display: flex;
            gap: 16px;
            font-size: 13px;
        }
        
        .metric {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .metric-icon {
            font-size: 14px;
        }
        
        .irrigation-action {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .irrigation-action.irrigate {
            background: #3b82f6;
            color: var(--gaip-surface);
        }
        
        .irrigation-action.wait {
            background: var(--gaip-border);
            color: var(--gaip-text);
        }
        
        .irrigation-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--gaip-border);
        }
        
        .summary-item {
            text-align: center;
        }
        
        .summary-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--gaip-text);
        }
        
        .summary-label {
            font-size: 11px;
            color: var(--gaip-text);
            text-transform: uppercase;
        }
        
        .variety-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: var(--gaip-info-bg);
            color: #1e40af;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .leaching-warning {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 12px;
            background: var(--gaip-warning-bg);
            border-radius: 8px;
            margin-top: 12px;
            font-size: 13px;
            color: #92400e;
        }
        
        .et-data-warning {
            animation: fadeInWarning 0.3s ease-out;
        }
        
        @keyframes fadeInWarning {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .et-data-warning.reliability-low {
            animation: pulseWarning 2s ease-in-out infinite;
        }
        
        @keyframes pulseWarning {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2); }
            50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
        }
    `;

    // ========================================================================
    // INJECT CSS
    // ========================================================================

    function injectCSS() {
        if (document.getElementById('irrigation-scheduler-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'irrigation-scheduler-styles';
        style.textContent = IRRIGATION_CSS;
        document.head.appendChild(style);
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    /**
     * Render irrigation schedule results
     */
    function renderIrrigationSchedule(result) {
        if (!result || result.error) {
            return `<div class="irrigation-scheduler">
                <p style="color: #ef4444;">${result?.error || 'No irrigation data available'}</p>
            </div>`;
        }
        
        injectCSS();
        
        // Handle dormancy response
        if (result.dormant) {
            return `<div class="irrigation-scheduler">
                <div class="irrigation-header">
                    <div class="irrigation-title">💧 Irrigation Schedule</div>
                </div>
                <div style="padding: 20px; background: linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%); border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 12px 0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <span style="font-size: 32px;">❄️</span>
                        <div>
                            <div style="font-weight: 600; font-size: 16px; color: #0c4a6e;">Dormant - No Irrigation Required</div>
                            <div style="font-size: 13px; color: #0369a1; margin-top: 4px;">${result.message}</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #0c4a6e; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <strong>💡 Recommendation:</strong> ${result.recommendation}
                    </div>
                </div>
                <div class="irrigation-summary" style="opacity: 0.6;">
                    <div class="summary-item">
                        <div class="summary-value">0</div>
                        <div class="summary-label">ET (mm)</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${result.summary?.totalPrecipitation || 0}</div>
                        <div class="summary-label">Rainfall (mm)</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">0</div>
                        <div class="summary-label">Irrigation Days</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">0</div>
                        <div class="summary-label">Applied (mm)</div>
                    </div>
                </div>
            </div>`;
        }
        
        const wb = result.waterBalance;
        const schedule = result.schedule || [];
        const summary = result.summary || {};
        const variety = result.variety;
        const speciesInfo = result.species || {};
        
        // v1.2.0: Map scheduler output to UI fields
        // Scheduler returns: currentDepletion, raw, depletionFraction, needsIrrigation
        // UI expects: etDeficit, deficitThreshold, deficitRemaining, strategy
        const etDeficit = wb.currentDepletion ?? 0;
        const deficitThreshold = wb.raw ?? 0;
        const deficitRemaining = Math.round(Math.max(0, deficitThreshold - etDeficit) * 10) / 10;
        const strategyLabel = result.strategy?.label || 
                              (wb.mad <= 0.3 ? 'Conservative' : 
                               wb.mad <= 0.5 ? 'Moderate' : 
                               wb.mad <= 0.65 ? 'Efficient' : 'Deficit');
        
        let html = `<div class="irrigation-scheduler">`;
        
        // Header - show effective species when overseed is being used
        let speciesDisplay = '';
        if (speciesInfo.usingOverseed) {
            speciesDisplay = `<span class="variety-badge" style="background: #059669; color: var(--gaip-surface);">
                ${speciesInfo.effectiveVariety || 'Perennial Ryegrass'} (overseed)
            </span>`;
        } else if (variety?.name) {
            speciesDisplay = `<span class="variety-badge">${variety.name}</span>`;
        }
        
        html += `
            <div class="irrigation-header">
                <div class="irrigation-title">
                    💧 Irrigation Schedule
                    ${speciesDisplay}
                </div>
            </div>
        `;
        
        // Water balance card
        const statusClass = wb.status === 'irrigate' ? 'critical' : 
                           wb.status === 'approaching' ? 'stressed' :
                           wb.status === 'critical' ? 'critical' :
                           wb.status === 'stressed' ? 'stressed' : '';
        
        // Calculate progress bar - show deficit relative to threshold
        const deficitPct = deficitThreshold > 0 ? 
            Math.min(100, Math.round((etDeficit / deficitThreshold) * 100)) : 0;
        
        html += `
            <div class="water-balance-card ${statusClass}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Cumulative ET Deficit</strong>
                        <div style="font-size: 13px; color: var(--gaip-text); margin-top: 4px;">
                            ${etDeficit}mm of ${deficitThreshold}mm threshold
                            <span style="font-size: 11px; color: var(--gaip-text); margin-left: 4px;">
                                (${wb.depletionSource === 'sensor' ? '📡 sensor' : wb.depletionSource === 'days' ? '📅 estimated' : '⚙️ default'})
                            </span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: 700; color: ${getStatusColor(wb.status)}">
                            ${etDeficit}mm
                        </div>
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--gaip-text);">
                            ET Deficit
                        </div>
                    </div>
                </div>
                <div class="water-balance-meter">
                    <div class="water-balance-fill ${wb.status}" 
                         style="width: ${deficitPct}%"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--gaip-text);">
                    <span>Strategy: ${strategyLabel} (trigger @ ${deficitThreshold}mm)</span>
                    <span>${wb.needsIrrigation ? '⚠️ Irrigation needed' : `✓ ${deficitRemaining}mm until trigger`}</span>
                </div>
            </div>
        `;
        
        // OM Effect info card
        if (wb.omEffect && wb.omEffect.applied) {
            const om = wb.omEffect;
            const omStatusColors = {
                'low': '#f59e0b',
                'optimal': '#22c55e',
                'elevated': '#f59e0b',
                'excessive': '#ef4444'
            };
            const omStatusBg = {
                'low': 'var(--gaip-warning-bg)',
                'optimal': 'var(--gaip-good-bg)',
                'elevated': 'var(--gaip-warning-bg)',
                'excessive': 'var(--gaip-critical-bg)'
            };
            
            html += `
                <div style="margin-top: 12px; padding: 12px; background: ${omStatusBg[om.status] || 'var(--gaip-surface-muted)'}; border-radius: 8px; border-left: 3px solid ${omStatusColors[om.status] || 'var(--gaip-text-secondary)'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <strong style="font-size: 12px; color: var(--gaip-text);">🧪 Organic Matter Effect</strong>
                            <div style="font-size: 11px; color: var(--gaip-text); margin-top: 2px;">
                                ${om.omPct.toFixed(1)}% OM (${om.status})
                            </div>
                        </div>
                        <div style="text-align: right; font-size: 11px; color: var(--gaip-text);">
                            AWC: ${om.awcChange > 0 ? '+' : ''}${om.awcChange.toFixed(1)}%<br>
                            Infiltration: ${om.infiltrationMultiplier < 1 ? '' : '+'}${Math.round((om.infiltrationMultiplier - 1) * 100)}%
                        </div>
                    </div>
                    ${om.note ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.08); font-size: 11px; color: var(--gaip-text);">
                            💡 ${om.note}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Leaching warning if applicable
        if (result.leachingRequirement) {
            html += `
                <div class="leaching-warning">
                    <span>⚠️</span>
                    <div>
                        <strong>Salinity Leaching Required</strong><br>
                        ${result.leachingRequirement.reason}
                    </div>
                </div>
            `;
        }
        
        // ET Data Quality Warning - critical for reliable irrigation scheduling
        if (result.dataQuality && result.dataQuality.warning) {
            const reliability = result.dataQuality.reliability || 'unknown';
            const warningColors = {
                'low': { bg: 'var(--gaip-critical-bg)', border: '#ef4444', text: '#991b1b', icon: '🚨' },
                'medium': { bg: 'var(--gaip-warning-bg)', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
                'unknown': { bg: 'var(--gaip-surface-hover)', border: 'var(--gaip-text-secondary)', text: 'var(--gaip-text)', icon: '❓' }
            };
            const colors = warningColors[reliability] || warningColors.unknown;
            
            html += `
                <div class="et-data-warning" style="
                    margin: 12px 0;
                    padding: 12px 16px;
                    background: ${colors.bg};
                    border: 1px solid ${colors.border};
                    border-left: 4px solid ${colors.border};
                    border-radius: 8px;
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                ">
                    <span style="font-size: 20px;">${colors.icon}</span>
                    <div>
                        <strong style="color: ${colors.text}; font-size: 13px;">ET Data Quality: ${reliability.toUpperCase()}</strong>
                        <div style="font-size: 12px; color: ${colors.text}; margin-top: 4px;">
                            ${result.dataQuality.warning}
                        </div>
                        ${reliability === 'low' ? `
                            <div style="font-size: 11px; color: var(--gaip-text); margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
                                💡 <strong>Recommendation:</strong> Check Open-Meteo API status or enter manual climate data for more accurate irrigation scheduling.
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // 7-day schedule
        html += `<div class="irrigation-schedule" style="margin-top: 16px;">`;
        
        // Forecast timeline chart (progressive disclosure)
        html += `
            <details class="irrigation-forecast-section" style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%); border: 1px solid var(--gaip-good-border); border-radius: 8px; font-weight: 600; color: #047857; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📈</span>
                    <span>Water Balance Timeline</span>
                    <span style="font-size: 11px; font-weight: 400; color: #10b981; margin-left: auto;">Forecast visualization</span>
                </summary>
                <div id="gaip-irrigation-forecast-chart" style="margin-top: 8px;"></div>
            </details>
        `;
        
        // Check for stale data - if first date is more than 1 day in the past
        if (schedule.length > 0 && schedule[0].date) {
            const firstDate = new Date(schedule[0].date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            firstDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff > 1) {
                html += `
                    <div style="background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                        <strong style="color: #92400e;">⚠️ Stale Weather Data</strong>
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: #92400e;">
                            Forecast data is ${daysDiff} days old (starts ${formatDate(schedule[0].date)}). 
                            Clear your browser cache and WordPress caches, then refresh to get current forecast.
                        </p>
                    </div>
                `;
            }
        }
        
        for (const day of schedule.slice(0, 7)) {
            const irrigateClass = day.irrigation?.recommended ? 
                (day.irrigation.priority === 'high' ? 'critical' : 'irrigate') : '';
            
            html += `
                <div class="schedule-day ${irrigateClass}">
                    <div>
                        <div class="day-name">${day.dayName}</div>
                        <div class="day-date">${formatDate(day.date)}</div>
                    </div>
                    <div class="day-metrics">
                        <div class="metric">
                            <span class="metric-icon">☀️</span>
                            <span>ET: ${Math.round(day.etc * 10) / 10}mm</span>
                        </div>
                        <div class="metric">
                            <span class="metric-icon">🌧️</span>
                            <span>${Math.round(day.precipitation * 10) / 10}mm</span>
                        </div>
                        <div class="metric">
                            <span class="metric-icon">📊</span>
                            <span>${Math.round(day.depletionPct)}%</span>
                        </div>
                    </div>
                    <div>
                        ${day.irrigation?.recommended ? 
                            `<span class="irrigation-action irrigate">
                                ${Math.round(day.irrigation.totalDepth * 10) / 10}mm${day.irrigation.leachingDepth > 0 ? ` <span style="font-size: 11px; opacity: 0.85;">(${Math.round(day.irrigation.netDepth * 10) / 10}mm + ${Math.round(day.irrigation.leachingDepth * 10) / 10}mm LR)</span>` : ''} (${formatDuration(day.irrigation.runtime.totalRuntime)})
                            </span>` :
                            `<span class="irrigation-action wait">No irrigation</span>`
                        }
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Summary
        html += `
            <div class="irrigation-summary">
                <div class="summary-item">
                    <div class="summary-value">${summary.totalET}</div>
                    <div class="summary-label">Total ET (mm)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.totalPrecipitation}</div>
                    <div class="summary-label">Rainfall (mm)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.irrigationEvents}</div>
                    <div class="summary-label">Irrigation Days</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.totalIrrigation}</div>
                    <div class="summary-label">Total Applied (mm)</div>
                </div>
            </div>
        `;
        
        // Water cost estimate (if cost per KL is set)
        if (summary.estimatedCost && summary.estimatedCost > 0) {
            html += `
                <div style="margin-top: 12px; padding: 12px 16px; background: linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%); border-radius: 8px; border-left: 3px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="font-size: 13px; color: #047857;">💰 Estimated Water Cost</strong>
                            <div style="font-size: 11px; color: var(--gaip-text); margin-top: 2px;">
                                ${summary.costNote || 'Per 1000m² (0.1 ha)'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: #047857;">
                                $${summary.estimatedCost.toFixed(2)}
                            </div>
                            <div style="font-size: 10px; color: var(--gaip-text);">
                                @ $${summary.costPerKL}/kL
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Variety modifier note
        if (variety?.modifier?.varietyModifier && variety.modifier.varietyModifier !== 1.0) {
            const pct = Math.round((1 - variety.modifier.varietyModifier) * 100);
            html += `
                <div style="margin-top: 12px; padding: 10px; background: var(--gaip-info-bg); border-radius: 6px; font-size: 12px; color: #1e40af;">
                    ℹ️ <strong>${variety.name}</strong> uses ${pct}% less water than baseline 
                    (${variety.modifier.varietyConfidence} confidence)
                </div>
            `;
        }
        
        html += `</div>`;
        
        return html;
    }

    /**
     * Render quick irrigation recommendation
     */
    function renderQuickIrrigation(result) {
        if (!result || result.error) {
            return `<div class="irrigation-scheduler">
                <p style="color: #ef4444;">${result?.error || 'No data'}</p>
            </div>`;
        }
        
        injectCSS();
        
        const rec = result.recommendation;
        const wb = result.waterBalance;
        
        let html = `<div class="irrigation-scheduler">`;
        
        html += `
            <div class="irrigation-header">
                <div class="irrigation-title">💧 Today's Irrigation</div>
            </div>
            
            <div class="water-balance-card ${wb.status === 'irrigate' || wb.status === 'critical' ? 'critical' : ''}">
                <div style="font-size: 18px; font-weight: 600; color: ${getStatusColor(wb.status)};">
                    ${rec.action === 'irrigate' ? '⚠️ Irrigation Recommended' : '✓ No Irrigation Needed'}
                </div>
                <div style="margin-top: 8px; font-size: 14px;">
                    ${rec.message}
                </div>
                ${rec.action === 'irrigate' ? `
                    <div style="margin-top: 12px; padding: 12px; background: var(--gaip-info-bg); border-radius: 6px;">
                        <div style="font-size: 20px; font-weight: 700; color: #1e40af;">
                            ${rec.runtime.totalRuntime} min
                        </div>
                        <div style="font-size: 12px; color: #1e40af;">
                            Apply ${rec.depth}mm at ${rec.runtime.precipRate}mm/hr
                            ${rec.runtime.cycles > 1 ? ` (${rec.runtime.cycles} cycles)` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px;">
                <div style="text-align: center; padding: 12px; background: var(--gaip-surface); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: 600;">${result.et0}</div>
                    <div style="font-size: 11px; color: var(--gaip-text);">ET₀ (mm)</div>
                </div>
                <div style="text-align: center; padding: 12px; background: var(--gaip-surface); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: 600;">${result.etc.etc}</div>
                    <div style="font-size: 11px; color: var(--gaip-text);">ETc (mm)</div>
                </div>
                <div style="text-align: center; padding: 12px; background: var(--gaip-surface); border-radius: 8px;">
                    <div style="font-size: 18px; font-weight: 600;">${wb.etDeficit || wb.currentDepletion}</div>
                    <div style="font-size: 11px; color: var(--gaip-text);">Deficit (mm)</div>
                </div>
            </div>
        `;
        
        // OM Effect note (compact version for quick view)
        if (wb.omEffect && wb.omEffect.applied && wb.omEffect.note) {
            html += `
                <div style="margin-top: 12px; padding: 10px; background: var(--gaip-surface-muted); border-radius: 6px; font-size: 11px; color: var(--gaip-text); border-left: 3px solid var(--gaip-text-secondary);">
                    🧪 <strong>OM ${wb.omEffect.omPct.toFixed(1)}%:</strong> ${wb.omEffect.note}
                </div>
            `;
        }
        
        html += `</div>`;
        
        return html;
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    function getStatusColor(status) {
        switch (status) {
            case 'optimal': return '#22c55e';
            case 'adequate': return '#84cc16';
            case 'approaching': return '#f59e0b';  // New: approaching threshold
            case 'stressed': return '#f59e0b';      // Legacy
            case 'irrigate': return '#ef4444';      // New: needs irrigation
            case 'critical': return '#ef4444';      // Legacy
            default: return 'var(--gaip-text-secondary)';
        }
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    }

    function formatDuration(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs === 0) return `${mins}m`;
        if (mins === 0) return `${hrs}h`;
        return `${hrs}h${mins}m`;
    }
    
    /**
     * Render forecast chart into container (called after schedule renders)
     */
    function renderForecastChart(result) {
        if (typeof IrrigationForecast === 'undefined') {
            return;
        }
        
        const container = document.getElementById('gaip-irrigation-forecast-chart');
        if (!container) {
            return;
        }
        
        IrrigationForecast.render(container, result);
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    global.GAIP_IrrigationUI = {
        renderSchedule: renderIrrigationSchedule,
        renderQuick: renderQuickIrrigation,
        renderForecastChart: renderForecastChart
    };

})(typeof window !== 'undefined' ? window : this);
