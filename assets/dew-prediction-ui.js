/**
 * =============================================================================
 * GILBA DEW PREDICTION UI v1.0.0
 * =============================================================================
 * 
 * Progressive disclosure UI for dew forecasting on sports turf.
 * Only renders when turfType === 'sports'.
 * 
 * FEATURES:
 * - Summary card for quick glance
 * - Match-day specific forecasting (when match details entered)
 * - 7-day daily forecast view
 * - Hourly detail expansion
 * - Preparation recommendations
 * 
 * INTEGRATION:
 * - Reads from GAIP_DewPrediction engine
 * - Updates via hub state dispatch system
 * - Coordinates with disease and stress modules
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // UI STATE
    // =========================================================================

    const UI_STATE = {
        expanded: false,
        selectedDay: null,
        matchMode: false
    };

    // =========================================================================
    // RENDER FUNCTIONS
    // =========================================================================

    /**
     * Get severity color class
     */
    function getSeverityColor(intensity) {
        switch (intensity) {
            case 'severe': return '#dc2626';  // Red
            case 'heavy': return '#ea580c';   // Orange
            case 'moderate': return '#ca8a04'; // Yellow
            case 'light': return '#65a30d';   // Lime
            default: return '#22c55e';        // Green
        }
    }

    /**
     * Get severity background class
     */
    function getSeverityBg(intensity) {
        switch (intensity) {
            case 'severe': return 'rgba(220, 38, 38, 0.1)';
            case 'heavy': return 'rgba(234, 88, 12, 0.1)';
            case 'moderate': return 'rgba(202, 138, 4, 0.1)';
            case 'light': return 'rgba(101, 163, 13, 0.1)';
            default: return 'rgba(34, 197, 94, 0.1)';
        }
    }

    /**
     * Format hour for display
     */
    function formatHour(hour) {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    }

    /**
     * Render probability bar
     */
    function renderProbabilityBar(probability, width = 100) {
        const color = probability >= 75 ? '#ea580c' :
                     probability >= 50 ? '#ca8a04' :
                     probability >= 30 ? '#65a30d' : '#22c55e';
        
        return `
            <div class="gaip-dew-prob-bar" style="width: ${width}px; height: 8px; background: var(--gaip-border); border-radius: 4px; overflow: hidden;">
                <div style="width: ${probability}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
            </div>
        `;
    }

    /**
     * Render summary card (collapsed view)
     */
    function renderSummaryCard(dewData) {
        if (!dewData?.applicable) {
            return '';
        }

        if (dewData.error) {
            return `
                <div class="gaip-dew-card gaip-dew-card-error">
                    <div class="gaip-dew-header">
                        <span class="gaip-dew-icon">💧</span>
                        <span class="gaip-dew-title">Dew Forecast</span>
                    </div>
                    <p class="gaip-dew-error">${dewData.error}</p>
                    ${dewData.recommendation ? `<p class="gaip-dew-hint">${dewData.recommendation}</p>` : ''}
                </div>
            `;
        }

        const summary = dewData.summary;
        const tomorrow = dewData.forecast?.dailyForecasts?.[1];
        const today = dewData.forecast?.dailyForecasts?.[0];
        
        const currentRisk = today || tomorrow;
        const riskLevel = currentRisk?.peakIntensity || 'none';
        const riskColor = getSeverityColor(riskLevel);
        
        return `
            <div class="gaip-dew-card" style="border-left: 4px solid ${riskColor};">
                <div class="gaip-dew-header" onclick="GAIP_DewUI.toggleExpanded()">
                    <div class="gaip-dew-header-left">
                        <span class="gaip-dew-icon">💧</span>
                        <span class="gaip-dew-title">Dew Forecast</span>
                        <span class="gaip-dew-badge" style="background: ${getSeverityBg(riskLevel)}; color: ${riskColor};">
                            ${riskLevel === 'none' ? 'Low Risk' : riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                        </span>
                    </div>
                    <span class="gaip-dew-expand">${UI_STATE.expanded ? '▼' : '▶'}</span>
                </div>
                
                <div class="gaip-dew-summary">
                    <div class="gaip-dew-stat">
                        <span class="gaip-dew-stat-value">${currentRisk?.peakProbability || 0}%</span>
                        <span class="gaip-dew-stat-label">Tonight's Peak</span>
                    </div>
                    <div class="gaip-dew-stat">
                        <span class="gaip-dew-stat-value">${summary?.weekAhead?.daysWithDew || 0}</span>
                        <span class="gaip-dew-stat-label">Dew Days (7d)</span>
                    </div>
                    <div class="gaip-dew-stat">
                        <span class="gaip-dew-stat-value">${dewData.leafWetness?.dewWetHours ?? dewData.leafWetness?.totalWetHours ?? 0}h</span>
                        <span class="gaip-dew-stat-label">Leaf Wetness</span>
                    </div>
                </div>
                
                ${currentRisk?.peakProbability >= 50 ? `
                    <div class="gaip-dew-alert">
                        <strong>⚠️ Action:</strong> ${currentRisk.peakProbability >= 75 ? 
                            'Heavy dew expected, remove before morning activities' :
                            'Moderate dew likely, consider morning dew removal'}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render expanded detail view
     */
    function renderExpandedView(dewData) {
        if (!UI_STATE.expanded || !dewData?.forecast) return '';

        const dailyForecasts = dewData.forecast.dailyForecasts || [];
        
        return `
            <div class="gaip-dew-expanded">
                <h4 class="gaip-dew-section-title">7-Day Dew Forecast</h4>
                
                <div class="gaip-dew-daily-grid">
                    ${dailyForecasts.slice(0, 7).map((day, idx) => `
                        <div class="gaip-dew-daily-card ${UI_STATE.selectedDay === idx ? 'selected' : ''}"
                             onclick="GAIP_DewUI.selectDay(${idx})"
                             style="border-left: 3px solid ${getSeverityColor(day.peakIntensity)};">
                            <div class="gaip-dew-daily-date">
                                ${idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : formatDate(day.date)}
                            </div>
                            <div class="gaip-dew-daily-peak">
                                <span class="gaip-dew-daily-prob">${day.peakProbability}%</span>
                                ${renderProbabilityBar(day.peakProbability, 60)}
                            </div>
                            <div class="gaip-dew-daily-meta">
                                <span>${day.dewHours}h dew</span>
                                ${day.heavyDewHours > 0 ? `<span class="gaip-dew-heavy">${day.heavyDewHours}h heavy</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${UI_STATE.selectedDay !== null ? renderHourlyDetail(dewData, UI_STATE.selectedDay) : ''}
                
                ${renderDiseaseIntegration(dewData.leafWetness)}
            </div>
        `;
    }

    /**
     * Render hourly detail for selected day
     */
    function renderHourlyDetail(dewData, dayIndex) {
        const daily = dewData.forecast.dailyForecasts[dayIndex];
        if (!daily) return '';

        const hourlyForecasts = dewData.forecast.hourlyForecasts.filter(h => h.date === daily.date);
        
        // Focus on evening through morning (dew formation window)
        const dewWindowForecasts = hourlyForecasts.filter(h => 
            h.hour >= 18 || h.hour <= 9
        );
        
        // Get diagnostic data from peak dew hour
        const peakHour = dewWindowForecasts.reduce((max, h) => 
            h.probability > (max?.probability || 0) ? h : max, null);
        const diagConditions = peakHour?.conditions || {};
        const diagFactors = peakHour?.factors || {};

        return `
            <div class="gaip-dew-hourly-section">
                <h5 class="gaip-dew-section-subtitle">${formatDate(daily.date)} - Hourly Breakdown</h5>
                
                <div class="gaip-dew-hourly-chart">
                    ${dewWindowForecasts.map(h => `
                        <div class="gaip-dew-hourly-bar" title="${formatHour(h.hour)}: ${h.probability}% probability">
                            <div class="gaip-dew-hourly-fill" style="
                                height: ${h.probability}%;
                                background: ${getSeverityColor(h.intensity)};
                            "></div>
                            <span class="gaip-dew-hourly-label">${h.hour}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="gaip-dew-hourly-legend">
                    <span>6 PM</span>
                    <span>← Peak Window →</span>
                    <span>9 AM</span>
                </div>
                
                <div class="gaip-dew-key-times">
                    ${daily.eveningOnsetRisk ? `
                        <div class="gaip-dew-key-time">
                            <span class="gaip-dew-time-label">Evening (6-9 PM):</span>
                            <span class="gaip-dew-time-value">${daily.eveningOnsetRisk}% onset risk</span>
                        </div>
                    ` : ''}
                    ${daily.earlyMorningRisk ? `
                        <div class="gaip-dew-key-time">
                            <span class="gaip-dew-time-label">Early Morning (5-8 AM):</span>
                            <span class="gaip-dew-time-value">${daily.earlyMorningRisk}% dew</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Diagnostic data (peak hour) -->
                ${peakHour ? `
                <details style="margin-top: 12px; font-size: 11px; color: var(--gaip-text);">
                    <summary style="cursor: pointer; font-weight: 500;">📊 Diagnostic: Peak Hour (${formatHour(peakHour.hour)})</summary>
                    <div style="padding: 8px; background: var(--gaip-surface-muted); border-radius: 4px; margin-top: 4px;">
                        <div><strong>Air Temp:</strong> ${diagConditions.temperature?.toFixed(1) || '?'}°C</div>
                        <div><strong>Humidity:</strong> ${diagConditions.humidity?.toFixed(0) || '?'}%</div>
                        <div><strong>Dew Point:</strong> ${diagFactors.dewPoint?.toFixed(1) || '?'}°C</div>
                        <div><strong>Surface Temp:</strong> ${diagFactors.surfaceTemp?.toFixed(1) || '?'}°C</div>
                        <div><strong>Surface-Dewpoint Gap:</strong> ${diagFactors.surfaceDepression?.toFixed(1) || '?'}°C</div>
                        <div><strong>Wind:</strong> ${diagConditions.windSpeed?.toFixed(1) || '?'} km/h</div>
                        <div><strong>Cloud:</strong> ${diagConditions.cloudCover?.toFixed(0) || '?'}%</div>
                        <div style="margin-top: 4px; font-style: italic;">
                            ${diagFactors.surfaceDepression <= 2 ? '⚠️ Surface near/below dew point → heavy dew' :
                              diagFactors.surfaceDepression <= 4 ? '⚠️ Close to dew point → moderate dew' :
                              diagFactors.surfaceDepression <= 6 ? 'Marginal conditions' :
                              diagFactors.surfaceDepression <= 10 ? 'Low dew probability' :
                              '✓ Surface well above dew point → unlikely'}
                        </div>
                    </div>
                </details>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render match day forecast (when match details available)
     */
    function renderMatchDayForecast(matchForecast) {
        if (!matchForecast || matchForecast.error) return '';

        const { matchDetails, conditions, impact, recommendations } = matchForecast;
        const severityColor = getSeverityColor(impact.severity);

        return `
            <div class="gaip-dew-match-section" style="border-left: 4px solid ${severityColor};">
                <h4 class="gaip-dew-section-title">
                    🏟️ Match Day: ${formatDate(matchDetails.date)} @ ${formatHour(matchDetails.kickoffHour)}
                </h4>
                
                <div class="gaip-dew-match-grid">
                    <div class="gaip-dew-match-stat">
                        <span class="gaip-dew-match-value">${conditions.atKickoff?.dewProbability || 0}%</span>
                        <span class="gaip-dew-match-label">At Kickoff</span>
                    </div>
                    <div class="gaip-dew-match-stat">
                        <span class="gaip-dew-match-value">${conditions.duringMatch?.peakProbability || 0}%</span>
                        <span class="gaip-dew-match-label">Peak During Match</span>
                    </div>
                    <div class="gaip-dew-match-stat">
                        <span class="gaip-dew-match-value" style="color: ${severityColor};">${impact.severity}</span>
                        <span class="gaip-dew-match-label">Impact Level</span>
                    </div>
                </div>
                
                <div class="gaip-dew-match-impact">
                    <p><strong>Conditions:</strong> ${impact.playingConditions}</p>
                    ${impact.tractionReduction > 10 ? `
                        <p><strong>Traction:</strong> ~${impact.tractionReduction}% reduction expected</p>
                    ` : ''}
                    ${impact.ballGripReduction > 15 ? `
                        <p><strong>Ball Handling:</strong> ~${impact.ballGripReduction}% grip reduction (${matchDetails.sport})</p>
                    ` : ''}
                </div>
                
                ${recommendations.length > 0 ? `
                    <div class="gaip-dew-recommendations">
                        <h5>Preparation Actions</h5>
                        ${recommendations.map(rec => `
                            <div class="gaip-dew-rec ${rec.priority}">
                                <span class="gaip-dew-rec-priority">${rec.priority.toUpperCase()}</span>
                                <div class="gaip-dew-rec-content">
                                    <strong>${rec.action}</strong>
                                    <span class="gaip-dew-rec-timing">${rec.timing}</span>
                                    <p>${rec.method}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render disease integration panel
     */
    function renderDiseaseIntegration(leafWetness) {
        if (!leafWetness) return '';

        const diseases = leafWetness.diseaseConditions || {};
        const activeConditions = Object.entries(diseases).filter(([, v]) => v);

        if (activeConditions.length === 0 && (leafWetness.dewWetHours ?? leafWetness.totalWetHours) < 30) {
            return '';
        }

        const hasDewBreakdown = typeof leafWetness.dewWetHours === 'number';
        const dewH = leafWetness.dewWetHours ?? leafWetness.totalWetHours ?? 0;
        const rainH = leafWetness.rainWetHours ?? 0;
        const totalH = leafWetness.totalWetHours ?? 0;

        return `
            <div class="gaip-dew-disease-section">
                <h5 class="gaip-dew-section-subtitle">🦠 Disease Risk Factors</h5>
                
                <div class="gaip-dew-disease-stats">
                    <div class="gaip-dew-disease-stat">
                        <span>${totalH}h</span>
                        <label>Total Leaf Wetness</label>
                    </div>
                    ${hasDewBreakdown && rainH > 0 ? `
                    <div class="gaip-dew-disease-stat">
                        <span>${dewH}h / ${rainH}h</span>
                        <label>Dew / Rain</label>
                    </div>` : ''}
                    <div class="gaip-dew-disease-stat">
                        <span>${leafWetness.consecutiveWetHours}h</span>
                        <label>Max Consecutive</label>
                    </div>
                    <div class="gaip-dew-disease-stat">
                        <span>${leafWetness.averageNightWetness}%</span>
                        <label>Avg Night Wetness</label>
                    </div>
                </div>
                
                ${activeConditions.length > 0 ? `
                    <div class="gaip-dew-disease-alert">
                        <strong>⚠️ Conducive conditions for:</strong>
                        ${activeConditions.map(([disease]) => 
                            `<span class="gaip-dew-disease-tag">${formatDiseaseName(disease)}</span>`
                        ).join('')}
                        <p class="gaip-dew-disease-hint">Check Disease Risk module for full assessment</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    /**
     * Format disease name for display
     */
    function formatDiseaseName(key) {
        const names = {
            dollarSpot: 'Dollar Spot',
            brownPatch: 'Brown Patch',
            pythium: 'Pythium',
            grayLeafSpot: 'Gray Leaf Spot'
        };
        return names[key] || key;
    }

    // =========================================================================
    // MAIN RENDER
    // =========================================================================

    /**
     * Main render function - call from hub update cycle
     */
    function render(state, containerId = 'gaip-dew-container') {
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn('Dew UI: Container not found:', containerId);
            return;
        }

        // Check if applicable (sports turf only)
        const turfType = state?.turfType || state?.turf?.turfType;
        
        if (turfType !== 'sports') {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        // Get dew data from engine
        let dewData;
        
        if (global.GAIP_DewPrediction) {
            const climateData = state?.climateData || state?.climate?.data;
            dewData = global.GAIP_DewPrediction.analyze(state, climateData);
        } else {
            dewData = { applicable: true, error: 'Dew prediction engine not loaded' };
        }

        // Render UI
        container.innerHTML = `
            <div class="gaip-dew-module">
                ${renderSummaryCard(dewData)}
                ${renderExpandedView(dewData)}
                ${dewData?.matchForecast ? renderMatchDayForecast(dewData.matchForecast) : ''}
            </div>
        `;
    }

    // =========================================================================
    // UI INTERACTIONS
    // =========================================================================

    function toggleExpanded() {
        UI_STATE.expanded = !UI_STATE.expanded;
        if (!UI_STATE.expanded) {
            UI_STATE.selectedDay = null;
        }
        // Re-render (assumes hub will call render on state change)
        if (global.gaipHubState) {
            render(global.gaipHubState);
        }
    }

    function selectDay(index) {
        UI_STATE.selectedDay = UI_STATE.selectedDay === index ? null : index;
        if (global.gaipHubState) {
            render(global.gaipHubState);
        }
    }

    // =========================================================================
    // CSS STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-dew-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'gaip-dew-styles';
        styles.textContent = `
            .gaip-dew-module {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .gaip-dew-card {
                background: var(--gaip-surface);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .gaip-dew-card-error {
                border-left: 4px solid var(--gaip-text-muted);
            }
            
            .gaip-dew-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                margin-bottom: 12px;
            }
            
            .gaip-dew-header-left {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .gaip-dew-icon {
                font-size: 1.25rem;
            }
            
            .gaip-dew-title {
                font-weight: 600;
                font-size: 1rem;
                color: var(--gaip-text);
            }
            
            .gaip-dew-badge {
                font-size: 0.75rem;
                font-weight: 500;
                padding: 2px 8px;
                border-radius: 12px;
            }
            
            .gaip-dew-expand {
                color: var(--gaip-text);
                font-size: 0.75rem;
            }
            
            .gaip-dew-summary {
                display: flex;
                gap: 24px;
                margin-bottom: 12px;
            }
            
            .gaip-dew-stat {
                display: flex;
                flex-direction: column;
            }
            
            .gaip-dew-stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--gaip-text);
            }
            
            .gaip-dew-stat-label {
                font-size: 0.75rem;
                color: var(--gaip-text);
            }
            
            .gaip-dew-alert {
                background: var(--gaip-warning-bg);
                border-radius: 6px;
                padding: 10px 12px;
                font-size: 0.875rem;
                color: #92400e;
            }
            
            .gaip-dew-error {
                color: var(--gaip-text);
                font-size: 0.875rem;
            }
            
            .gaip-dew-hint {
                color: var(--gaip-text);
                font-size: 0.75rem;
                margin-top: 4px;
            }
            
            /* Expanded View */
            .gaip-dew-expanded {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid var(--gaip-border);
            }
            
            .gaip-dew-section-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--gaip-text);
                margin: 0 0 12px 0;
            }
            
            .gaip-dew-section-subtitle {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--gaip-text);
                margin: 16px 0 8px 0;
            }
            
            .gaip-dew-daily-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
                margin-bottom: 16px;
            }
            
            .gaip-dew-daily-card {
                background: var(--gaip-surface-muted);
                border-radius: 6px;
                padding: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .gaip-dew-daily-card:hover {
                background: var(--gaip-surface-hover);
            }
            
            .gaip-dew-daily-card.selected {
                background: var(--gaip-info-bg);
                box-shadow: 0 0 0 2px #3b82f6;
            }
            
            .gaip-dew-daily-date {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--gaip-text);
                margin-bottom: 6px;
            }
            
            .gaip-dew-daily-peak {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .gaip-dew-daily-prob {
                font-size: 1.1rem;
                font-weight: 700;
                color: var(--gaip-text);
                min-width: 40px;
            }
            
            .gaip-dew-daily-meta {
                font-size: 0.7rem;
                color: var(--gaip-text);
                margin-top: 4px;
                display: flex;
                gap: 8px;
            }
            
            .gaip-dew-heavy {
                color: #ea580c;
                font-weight: 500;
            }
            
            /* Hourly Chart */
            .gaip-dew-hourly-section {
                background: var(--gaip-surface-muted);
                border-radius: 6px;
                padding: 12px;
                margin-top: 12px;
            }
            
            .gaip-dew-hourly-chart {
                display: flex;
                align-items: flex-end;
                height: 80px;
                gap: 2px;
                padding: 0 4px;
            }
            
            .gaip-dew-hourly-bar {
                flex: 1;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                align-items: center;
            }
            
            .gaip-dew-hourly-fill {
                width: 100%;
                border-radius: 2px 2px 0 0;
                min-height: 2px;
                transition: height 0.3s;
            }
            
            .gaip-dew-hourly-label {
                font-size: 0.6rem;
                color: var(--gaip-text);
                margin-top: 4px;
            }
            
            .gaip-dew-hourly-legend {
                display: flex;
                justify-content: space-between;
                font-size: 0.7rem;
                color: var(--gaip-text);
                margin-top: 8px;
                padding: 0 4px;
            }
            
            .gaip-dew-key-times {
                display: flex;
                gap: 16px;
                margin-top: 12px;
                flex-wrap: wrap;
            }
            
            .gaip-dew-key-time {
                font-size: 0.8rem;
            }
            
            .gaip-dew-time-label {
                color: var(--gaip-text);
            }
            
            .gaip-dew-time-value {
                font-weight: 600;
                color: var(--gaip-text);
            }
            
            /* Match Day Section */
            .gaip-dew-match-section {
                background: var(--gaip-surface);
                border-radius: 8px;
                padding: 16px;
                margin-top: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .gaip-dew-match-grid {
                display: flex;
                gap: 24px;
                margin: 12px 0;
            }
            
            .gaip-dew-match-stat {
                text-align: center;
            }
            
            .gaip-dew-match-value {
                font-size: 1.5rem;
                font-weight: 700;
                display: block;
            }
            
            .gaip-dew-match-label {
                font-size: 0.75rem;
                color: var(--gaip-text);
            }
            
            .gaip-dew-match-impact {
                font-size: 0.875rem;
                color: var(--gaip-text);
                margin: 12px 0;
            }
            
            .gaip-dew-match-impact p {
                margin: 4px 0;
            }
            
            .gaip-dew-recommendations {
                margin-top: 16px;
                padding-top: 12px;
                border-top: 1px solid var(--gaip-border);
            }
            
            .gaip-dew-recommendations h5 {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--gaip-text);
                margin: 0 0 8px 0;
            }
            
            .gaip-dew-rec {
                display: flex;
                gap: 12px;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 8px;
            }
            
            .gaip-dew-rec.high {
                background: var(--gaip-critical-bg);
            }
            
            .gaip-dew-rec.medium {
                background: var(--gaip-warning-bg);
            }
            
            .gaip-dew-rec.info {
                background: var(--gaip-info-bg);
            }
            
            .gaip-dew-rec-priority {
                font-size: 0.65rem;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                height: fit-content;
            }
            
            .gaip-dew-rec.high .gaip-dew-rec-priority {
                background: #dc2626;
                color: var(--gaip-surface);
            }
            
            .gaip-dew-rec.medium .gaip-dew-rec-priority {
                background: #ca8a04;
                color: var(--gaip-surface);
            }
            
            .gaip-dew-rec.info .gaip-dew-rec-priority {
                background: #3b82f6;
                color: var(--gaip-surface);
            }
            
            .gaip-dew-rec-content {
                flex: 1;
            }
            
            .gaip-dew-rec-content strong {
                display: block;
                color: var(--gaip-text);
                font-size: 0.875rem;
            }
            
            .gaip-dew-rec-timing {
                font-size: 0.75rem;
                color: var(--gaip-text);
            }
            
            .gaip-dew-rec-content p {
                margin: 4px 0 0 0;
                font-size: 0.8rem;
                color: var(--gaip-text);
            }
            
            /* Disease Integration */
            .gaip-dew-disease-section {
                margin-top: 16px;
                padding: 12px;
                background: var(--gaip-warning-bg);
                border-radius: 6px;
            }
            
            .gaip-dew-disease-stats {
                display: flex;
                gap: 16px;
                margin: 8px 0;
            }
            
            .gaip-dew-disease-stat {
                text-align: center;
            }
            
            .gaip-dew-disease-stat span {
                font-size: 1.1rem;
                font-weight: 700;
                color: #92400e;
                display: block;
            }
            
            .gaip-dew-disease-stat label {
                font-size: 0.7rem;
                color: var(--gaip-text);
            }
            
            .gaip-dew-disease-alert {
                margin-top: 12px;
                font-size: 0.85rem;
                color: #92400e;
            }
            
            .gaip-dew-disease-tag {
                display: inline-block;
                background: var(--gaip-warning-border);
                padding: 2px 8px;
                border-radius: 4px;
                margin: 4px 4px 0 0;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .gaip-dew-disease-hint {
                font-size: 0.75rem;
                color: var(--gaip-text-muted);
                margin-top: 8px;
            }
        `;
        
        document.head.appendChild(styles);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        injectStyles();
    }

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const DewUI = {
        render,
        toggleExpanded,
        selectDay,
        init,
        getState: () => UI_STATE
    };

    global.GAIP_DewUI = DewUI;

})(typeof window !== 'undefined' ? window : this);
