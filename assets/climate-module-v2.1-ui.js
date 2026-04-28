/**
 * ============================================================================
 * GILBA CLIMATE MODULE v2.1 UI - DUAL METRICS DISPLAY
 * ============================================================================
 * 
 * Progressive disclosure UI for dual metrics (Current vs 8-Day Outlook).
 * Displays side-by-side comparison cards with trajectory indicators.
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CSS
    // ========================================================================

    const DUAL_METRICS_CSS = `
        /* Dual Metrics Container */
        .climate-dual-metrics {
            background: linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%);
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            border: 1px solid #bae6fd;
        }
        
        .dual-metrics-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .dual-metrics-title {
            font-size: 14px;
            font-weight: 600;
            color: #0369a1;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .dual-metrics-headline {
            font-size: 12px;
            color: #0c4a6e;
            padding: 4px 10px;
            background: rgba(14, 165, 233, 0.15);
            border-radius: 12px;
        }
        
        /* Comparison Cards Grid */
        .dual-metrics-comparison {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 12px;
            align-items: stretch;
        }
        
        .metric-card {
            background: var(--gaip-surface);
            border-radius: 10px;
            padding: 16px;
            text-align: center;
            border: 2px solid transparent;
            transition: border-color 0.2s ease;
        }
        
        .metric-card.current {
            border-color: #22c55e;
        }
        
        .metric-card.outlook {
            border-color: #3b82f6;
        }
        
        .metric-card-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--gaip-text);
            margin-bottom: 8px;
        }
        
        .metric-card-value {
            font-size: 32px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 4px;
        }
        
        .metric-card.current .metric-card-value {
            color: #16a34a;
        }
        
        .metric-card.outlook .metric-card-value {
            color: #2563eb;
        }
        
        .metric-card-unit {
            font-size: 14px;
            font-weight: 500;
            color: var(--gaip-text);
        }
        
        .metric-card-temp {
            font-size: 12px;
            color: var(--gaip-text);
            margin-top: 8px;
        }
        
        .metric-card-confidence {
            font-size: 10px;
            color: var(--gaip-border);
            margin-top: 4px;
        }
        
        /* Trajectory Arrow */
        .trajectory-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 8px;
        }
        
        .trajectory-arrow {
            font-size: 28px;
            line-height: 1;
        }
        
        .trajectory-arrow.improving {
            color: #22c55e;
        }
        
        .trajectory-arrow.declining {
            color: #ef4444;
        }
        
        .trajectory-arrow.stable {
            color: var(--gaip-text);
        }
        
        .trajectory-delta {
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
        }
        
        .trajectory-delta.positive {
            color: #16a34a;
        }
        
        .trajectory-delta.negative {
            color: #dc2626;
        }
        
        .trajectory-delta.neutral {
            color: var(--gaip-text);
        }
        
        /* Trajectory Description */
        .trajectory-description {
            margin-top: 12px;
            padding: 10px 14px;
            background: var(--gaip-surface-muted);
            border-radius: 8px;
            font-size: 12px;
            color: var(--gaip-text);
            line-height: 1.4;
        }
        
        /* Daily Forecast Strip */
        .daily-forecast-strip {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--gaip-info-bg);
        }
        
        .daily-forecast-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--gaip-text);
            margin-bottom: 8px;
        }
        
        .daily-forecast-days {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding-bottom: 4px;
        }
        
        .forecast-day {
            flex: 0 0 auto;
            min-width: 52px;
            padding: 8px 6px;
            background: var(--gaip-surface);
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--gaip-border);
        }
        
        .forecast-day.today {
            border-color: #22c55e;
            background: var(--gaip-good-bg);
        }
        
        .forecast-day-name {
            font-size: 10px;
            color: var(--gaip-text);
            margin-bottom: 4px;
        }
        
        .forecast-day.today .forecast-day-name {
            color: #16a34a;
            font-weight: 600;
        }
        
        .forecast-day-gp {
            font-size: 16px;
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .forecast-day-temp {
            font-size: 10px;
            color: var(--gaip-text);
            margin-top: 2px;
        }
        
        .forecast-day-confidence {
            margin-top: 4px;
            height: 3px;
            background: var(--gaip-border);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .forecast-day-confidence-fill {
            height: 100%;
            background: #3b82f6;
            transition: width 0.2s ease;
        }
        
        /* Stress Outlook Section */
        .stress-outlook-section {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--gaip-info-bg);
        }
        
        .stress-outlook-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--gaip-text);
            margin-bottom: 10px;
        }
        
        .stress-outlook-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
        }
        
        .stress-outlook-item {
            background: var(--gaip-surface);
            border-radius: 8px;
            padding: 10px;
            text-align: center;
        }
        
        .stress-outlook-type {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--gaip-text);
            margin-bottom: 6px;
        }
        
        .stress-outlook-values {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .stress-value {
            font-size: 14px;
            font-weight: 600;
        }
        
        .stress-value.current {
            color: var(--gaip-text);
        }
        
        .stress-value.outlook {
            color: var(--gaip-text);
        }
        
        .stress-arrow {
            font-size: 12px;
            color: var(--gaip-text);
        }
        
        .stress-change {
            font-size: 10px;
            margin-top: 4px;
        }
        
        .stress-change.increasing {
            color: #dc2626;
        }
        
        .stress-change.decreasing {
            color: #16a34a;
        }
        
        .stress-change.stable {
            color: var(--gaip-text);
        }
        
        /* Alerts */
        .stress-alerts {
            margin-top: 12px;
        }
        
        .stress-alert {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--gaip-critical-bg);
            border-radius: 6px;
            margin-bottom: 6px;
            border-left: 3px solid #ef4444;
        }
        
        .stress-alert.warning {
            background: var(--gaip-warning-bg);
            border-left-color: #f59e0b;
        }
        
        .stress-alert-icon {
            font-size: 14px;
        }
        
        .stress-alert-message {
            font-size: 12px;
            color: var(--gaip-text);
            flex: 1;
        }
        
        /* Responsive */
        @media (max-width: 500px) {
            .dual-metrics-comparison {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .trajectory-indicator {
                flex-direction: row;
                gap: 8px;
                padding: 8px 0;
            }
            
            .trajectory-arrow {
                transform: rotate(90deg);
            }
            
            .daily-forecast-days {
                overflow-x: auto;
            }
            
            .forecast-day {
                min-width: 48px;
            }
        }
    `;

    // ========================================================================
    // INJECT CSS
    // ========================================================================

    function injectCSS() {
        if (document.getElementById('climate-dual-metrics-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'climate-dual-metrics-styles';
        style.textContent = DUAL_METRICS_CSS;
        document.head.appendChild(style);
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    /**
     * Render full dual metrics display
     * @param {object} result - Climate analysis result with dualMetrics
     * @returns {string} HTML string
     */
    function renderDualMetrics(result) {
        if (!result?.dualMetrics?.available) {
            return ''; // Don't render if no dual metrics
        }
        
        injectCSS();
        
        const dm = result.dualMetrics;
        const stressOutlook = result.stressOutlook;
        
        let html = `<div class="climate-dual-metrics">`;
        
        // Header with headline
        html += `
            <div class="dual-metrics-header">
                <div class="dual-metrics-title">
                    📊 Growth Outlook
                    <span style="font-weight: 400; font-size: 12px; color: var(--gaip-text);">
                        ${dm.isC4 ? 'Warm-season' : 'Cool-season'}
                    </span>
                </div>
                ${result.outlookHeadline ? `
                    <div class="dual-metrics-headline">${result.outlookHeadline}</div>
                ` : ''}
            </div>
        `;
        
        // Comparison cards
        html += renderComparisonCards(dm);
        
        // Trajectory description
        if (dm.trajectory?.description) {
            html += `
                <div class="trajectory-description">
                    ${dm.trajectory.description}
                </div>
            `;
        }
        
        // Daily forecast strip
        if (dm.daily && dm.daily.length > 1) {
            html += renderDailyForecastStrip(dm.daily);
        }
        
        // Stress outlook
        if (stressOutlook?.available) {
            html += renderStressOutlook(stressOutlook, dm.isC4);
        }
        
        html += `</div>`;
        
        return html;
    }

    /**
     * Render comparison cards (Current | Arrow | Outlook)
     */
    function renderComparisonCards(dm) {
        const trajectoryArrow = getTrajectoryArrow(dm.trajectory.direction);
        const deltaClass = dm.trajectory.delta > 0 ? 'positive' : 
                          (dm.trajectory.delta < 0 ? 'negative' : 'neutral');
        const deltaSign = dm.trajectory.delta > 0 ? '+' : '';
        
        return `
            <div class="dual-metrics-comparison">
                <!-- Current Card -->
                <div class="metric-card current">
                    <div class="metric-card-label">${dm.current.label}</div>
                    <div class="metric-card-value">${dm.current.growthPotential ?? '--'}</div>
                    <div class="metric-card-unit">% GP</div>
                    ${dm.current.temperature !== null ? `
                        <div class="metric-card-temp">${dm.current.temperature}°C avg</div>
                    ` : ''}
                </div>
                
                <!-- Trajectory Arrow -->
                <div class="trajectory-indicator">
                    <div class="trajectory-arrow ${dm.trajectory.direction}">${trajectoryArrow}</div>
                    ${dm.trajectory.delta !== 0 ? `
                        <div class="trajectory-delta ${deltaClass}">${deltaSign}${dm.trajectory.delta}%</div>
                    ` : ''}
                </div>
                
                <!-- Outlook Card -->
                <div class="metric-card outlook">
                    <div class="metric-card-label">${dm.outlook.label}</div>
                    <div class="metric-card-value">${dm.outlook.growthPotential ?? '--'}</div>
                    <div class="metric-card-unit">% GP</div>
                    ${dm.outlook.temperature !== null ? `
                        <div class="metric-card-temp">${dm.outlook.temperature}°C avg</div>
                    ` : ''}
                    ${dm.outlook.confidence !== null ? `
                        <div class="metric-card-confidence">${dm.outlook.confidence}% confidence</div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Get trajectory arrow character
     */
    function getTrajectoryArrow(direction) {
        switch (direction) {
            case 'improving': return '→';  // or ↗
            case 'declining': return '→';  // or ↘
            default: return '→';
        }
    }

    /**
     * Render daily forecast strip
     */
    function renderDailyForecastStrip(daily) {
        const dayNames = ['Today', 'Tom', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6', 'D+7', 'D+8'];
        
        let html = `
            <div class="daily-forecast-strip">
                <div class="daily-forecast-label">Daily Growth Potential</div>
                <div class="daily-forecast-days">
        `;
        
        for (let i = 0; i < Math.min(daily.length, 9); i++) {
            const day = daily[i];
            const dayName = dayNames[i] || `D+${i}`;
            const confidencePct = Math.round((day.confidence || 0) * 100);
            
            html += `
                <div class="forecast-day${day.isToday ? ' today' : ''}">
                    <div class="forecast-day-name">${dayName}</div>
                    <div class="forecast-day-gp">${day.gp !== null ? day.gp : '--'}</div>
                    ${day.temperature?.mean !== undefined ? `
                        <div class="forecast-day-temp">${Math.round(day.temperature.mean)}°</div>
                    ` : ''}
                    <div class="forecast-day-confidence">
                        <div class="forecast-day-confidence-fill" style="width: ${confidencePct}%"></div>
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * Render stress outlook section
     */
    function renderStressOutlook(stressOutlook, isC4) {
        let html = `
            <div class="stress-outlook-section">
                <div class="stress-outlook-label">Stress Outlook</div>
                <div class="stress-outlook-grid">
        `;
        
        // Heat stress
        html += renderStressOutlookItem('Heat', 
            stressOutlook.current.heat, 
            stressOutlook.outlook.heat, 
            stressOutlook.change.heat);
        
        // Drought stress
        html += renderStressOutlookItem('Drought', 
            stressOutlook.current.drought, 
            stressOutlook.outlook.drought, 
            stressOutlook.change.drought);
        
        // Winterkill (C4 only)
        if (isC4 && stressOutlook.current.winterkill !== null) {
            html += renderStressOutlookItem('Cold', 
                stressOutlook.current.winterkill, 
                stressOutlook.outlook.winterkill, 
                stressOutlook.change.winterkill);
        }
        
        html += `</div>`;
        
        // Alerts
        if (stressOutlook.alerts && stressOutlook.alerts.length > 0) {
            html += `<div class="stress-alerts">`;
            for (const alert of stressOutlook.alerts) {
                const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
                html += `
                    <div class="stress-alert ${alert.severity}">
                        <span class="stress-alert-icon">${icon}</span>
                        <span class="stress-alert-message">${alert.message}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }
        
        html += `</div>`;
        
        return html;
    }

    /**
     * Render individual stress outlook item
     */
    function renderStressOutlookItem(type, current, outlook, change) {
        const changeClass = change > 5 ? 'increasing' : (change < -5 ? 'decreasing' : 'stable');
        const changeSign = change > 0 ? '+' : '';
        
        return `
            <div class="stress-outlook-item">
                <div class="stress-outlook-type">${type}</div>
                <div class="stress-outlook-values">
                    <span class="stress-value current">${current}</span>
                    <span class="stress-arrow">→</span>
                    <span class="stress-value outlook">${outlook}</span>
                </div>
                <div class="stress-change ${changeClass}">
                    ${changeSign}${change} forecast
                </div>
            </div>
        `;
    }

    // ========================================================================
    // INTEGRATION WITH CLIMATE V2 UI
    // ========================================================================

    /**
     * Inject dual metrics into existing climate v2 panel
     * Call this after renderClimateV2() or integrate directly
     */
    function injectIntoPanelAfterHeader(result) {
        if (!result?.dualMetrics?.available) return;
        
        // Find climate v2 panel header
        const panel = document.querySelector('.climate-v2-panel');
        if (!panel) return;
        
        const header = panel.querySelector('.climate-v2-header');
        if (!header) return;
        
        // Create dual metrics element
        const dmDiv = document.createElement('div');
        dmDiv.innerHTML = renderDualMetrics(result);
        
        // Insert after header
        header.insertAdjacentElement('afterend', dmDiv.firstElementChild);
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    global.GAIP_ClimateV2_DualMetricsUI = {
        render: renderDualMetrics,
        injectIntoPanel: injectIntoPanelAfterHeader,
        renderComparisonCards,
        renderDailyForecastStrip,
        renderStressOutlook
    };


})(typeof window !== 'undefined' ? window : this);
