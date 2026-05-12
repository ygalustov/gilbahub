/**
 * =============================================================================
 * GILBA DISEASE ENGINE UI v1.0
 * =============================================================================
 * 
 * Progressive disclosure UI for disease risk visualization
 * Integrates with hub output pattern
 * =============================================================================
 */

const DiseaseUI = {
    
    /**
     * Render disease results into hub output
     */
    render(containerId, diseaseResults, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const { showForecast = false, compact = false, state = null } = options;
        
        container.innerHTML = this.buildHTML(diseaseResults, { showForecast, compact });
        this.attachEventListeners(container);
        
        // Render forecast chart if DiseaseForecast module is available
        // Use passed state if available, otherwise fall back to window.GAIP_STATE
        const forecastState = state || window.GAIP_STATE;
        if (typeof DiseaseForecast !== 'undefined' && forecastState) {
            const forecastContainer = container.querySelector('#gaip-disease-forecast-chart');
            if (forecastContainer) {
                // Small delay to ensure container is rendered
                setTimeout(function() {
                    DiseaseForecast.render(forecastContainer, forecastState);
                }, 50);
            }
        }
    },
    
    /**
     * Build complete HTML output
     */
    buildHTML(results, options) {
        if (!results || !results.diseases) {
            return '<div class="gaip-disease-empty">No disease analysis available. Run climate analysis first.</div>';
        }
        
        const { compact, showForecast } = options;
        
        return `
            <div class="gaip-disease-dashboard">
                ${this.buildSummaryCard(results)}
                ${this.buildAlertsSection(results.alerts)}
                ${this.buildForecastSection(showForecast)}
                ${compact ? '' : this.buildDiseaseCards(results.diseases)}
                ${compact ? '' : this.buildSprayTimingCard(results)}
            </div>
        `;
    },
    
    /**
     * Build forecast chart section (progressive disclosure)
     */
    buildForecastSection(showForecast) {
        const expanded = showForecast ? 'open' : '';
        return `
            <details class="gaip-forecast-section" ${expanded} style="margin: 16px 0;">
                <summary style="cursor: pointer; padding: 12px 16px; background: linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%); border: 1px solid var(--gaip-info-bg); border-radius: 8px; font-weight: 600; color: #1e40af; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📊</span>
                    <span>Disease Risk Forecast</span>
                    <span style="font-size: 11px; font-weight: 400; color: #3b82f6; margin-left: auto;">7-14 day projection</span>
                </summary>
                <div id="gaip-disease-forecast-chart" style="margin-top: 8px;"></div>
            </details>
        `;
    },
    
    /**
     * Summary card with overall risk
     */
    buildSummaryCard(results) {
        const riskClass = `gaip-risk-${results.overallRisk}`;
        const riskIcon = this.getRiskIcon(results.overallRisk);
        
        // Get confidence if available
        let confidenceHTML = '';
        if (window.GilbaEngineConfidence && window.GAIP_STATE) {
            const confidence = window.GilbaEngineConfidence.assessConfidence('disease-engine', window.GAIP_STATE);
            confidenceHTML = window.GilbaEngineConfidence.renderCompactConfidence(confidence.score);
        }
        
        const topThreatsHTML = results.topThreats.map(t => {
            const betaBadge = t.validationBadge ? 
                `<span class="gaip-beta-badge" style="font-size: 9px; background: var(--gaip-warning-bg); color: #92400e; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${t.validationBadge}</span>` : '';
            return `
            <div class="gaip-threat-item">
                <span class="gaip-threat-name">${t.disease}${betaBadge}</span>
                <span class="gaip-threat-score gaip-risk-${t.level}">${(typeof t.risk === 'number' && isFinite(t.risk)) ? t.risk : 0}%</span>
            </div>
        `;
        }).join('');
        
        return `
            <div class="gaip-card gaip-disease-summary ${riskClass}">
                <div class="gaip-card-header">
                    <span class="gaip-risk-icon">${riskIcon}</span>
                    <h3>Disease Pressure: <span class="gaip-risk-label">${results.overallRisk.toUpperCase()}</span>${results.betaExcluded ? `<span style="font-size:10px;font-weight:400;color:#92400e;background:var(--gaip-warning-bg);border:1px solid var(--gaip-warning-border);border-radius:4px;padding:1px 6px;margin-left:8px;vertical-align:middle;" title="One or more beta (experimental) disease models show higher risk but are excluded from the validated overall score">🧪 beta models excluded</span>` : ''}</h3>
                    <span class="gaip-overall-score">${(typeof results.overallScore === 'number' && isFinite(results.overallScore)) ? results.overallScore : 0}%</span>
                </div>
                <div class="gaip-card-body">
                    <div class="gaip-top-threats">
                        <h4>Top Threats</h4>
                        ${topThreatsHTML}
                    </div>
                    <div class="gaip-species-note" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Analysis for: <strong>${this.formatSpecies(results.species)}</strong></span>
                        ${confidenceHTML}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Alerts section for high/critical risks
     */
    buildAlertsSection(alerts) {
        if (!alerts || alerts.length === 0) return '';
        
        const alertsHTML = alerts.map(a => {
            const alertClass = a.urgency === 'critical' ? 'gaip-alert-critical' : 'gaip-alert-high';
            const icon = a.urgency === 'critical' ? '🚨' : '⚠️';
            
            return `
                <div class="gaip-alert ${alertClass}">
                    <span class="gaip-alert-icon">${icon}</span>
                    <div class="gaip-alert-content">
                        <div class="gaip-alert-message">${a.message}</div>
                        <div class="gaip-alert-action">${a.action}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="gaip-alerts-section">
                ${alertsHTML}
            </div>
        `;
    },
    
    /**
     * Individual disease cards with progressive disclosure
     */
    buildDiseaseCards(diseases) {
        const cardsHTML = diseases.map(d => this.buildDiseaseCard(d)).join('');
        
        return `
            <div class="gaip-disease-cards">
                <h4>Disease Risk Details</h4>
                ${cardsHTML}
            </div>
        `;
    },
    
    /**
     * Single disease card
     */
    buildDiseaseCard(disease) {
        const riskClass = `gaip-risk-${disease.riskLevel}`;
        const expanded = disease.riskLevel === 'high' || disease.riskLevel === 'severe';
        
        // Drivers summary
        const driversHTML = this.buildDriversSummary(disease.drivers);
        
        // Interventions
        const interventionsHTML = this.buildInterventions(disease.interventions, disease.riskLevel, disease.disease);
        
        // Beta/validation badge
        const validationBadge = disease.validationBadge ? 
            `<span class="gaip-validation-badge" title="Model biology verified from research. Risk calibration in progress." style="font-size: 10px; background: var(--gaip-warning-bg); color: #92400e; padding: 2px 6px; border-radius: 4px; margin-left: 8px; cursor: help;">${disease.validationBadge}</span>` : '';
        
        // Severity note for phase-dependent diseases
        const severityNote = disease.severityNote ? 
            `<div class="gaip-severity-note" style="margin: 8px 0; padding: 8px; background: ${disease.diseasePhase === 'critical' ? 'var(--gaip-critical-bg)' : 'var(--gaip-warning-bg)'}; border-left: 3px solid ${disease.diseasePhase === 'critical' ? '#ef4444' : '#f59e0b'}; font-size: 12px; color: ${disease.diseasePhase === 'critical' ? '#dc2626' : '#92400e'};">${disease.severityNote}</div>` : '';
        
        // Disease phase indicator
        const phaseIndicator = disease.diseasePhase && disease.diseasePhase !== 'leaf_spot' ? 
            `<span class="gaip-phase-indicator" style="font-size: 10px; background: ${disease.diseasePhase === 'critical' ? 'var(--gaip-critical-bg)' : 'var(--gaip-info-bg)'}; color: ${disease.diseasePhase === 'critical' ? '#dc2626' : '#0c4a6e'}; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${this.formatPhase(disease.diseasePhase)}</span>` : '';
        
        return `
            <div class="gaip-disease-card ${riskClass}" data-disease="${disease.disease}">
                <div class="gaip-disease-header" data-toggle="disease-detail">
                    <div class="gaip-disease-name">
                        <span class="gaip-expand-icon">${expanded ? '▼' : '▶'}</span>
                        ${disease.displayName}${validationBadge}${phaseIndicator}
                    </div>
                    <div class="gaip-disease-score">
                        <span class="gaip-score-value">${(typeof disease.adjustedRisk === 'number' && isFinite(disease.adjustedRisk)) ? disease.adjustedRisk : 0}%</span>
                        <span class="gaip-score-label">${disease.riskLevel}</span>
                    </div>
                </div>
                <div class="gaip-disease-detail" style="display: ${expanded ? 'block' : 'none'}">
                    ${severityNote}
                    <div class="gaip-drivers-section">
                        <h5>Risk Drivers</h5>
                        ${driversHTML}
                    </div>
                    ${disease.warmSeasonCaveat ? `<div class="gaip-warm-season-caveat" style="margin: 8px 0; padding: 6px 8px; background: var(--gaip-warning-bg); border-left: 3px solid #d97706; font-size: 11px; color: #92400e;">⚠️ Indicative only: ${disease.warmSeasonCaveat}</div>` : ''}
                    ${disease.urgencyNote ? `<div class="gaip-urgency-note" style="margin: 8px 0; padding: 8px; background: var(--gaip-critical-bg); border-left: 3px solid #ef4444; font-size: 12px; font-weight: 600; color: #dc2626;">⚠️ ${disease.urgencyNote}</div>` : ''}
                    ${disease.soilPathway?.note ? `<div class="gaip-soil-pathway-note" style="margin: 8px 0; padding: 8px; background: var(--gaip-good-bg); border-left: 3px solid #16a34a; font-size: 12px; color: #15803d;">🌱 Root/Crown: ${disease.soilPathway.note}</div>` : ''}
                    ${disease.speciesScope ? `<div class="gaip-species-scope" style="margin: 8px 0; padding: 6px 8px; background: var(--gaip-surface-muted); border-left: 2px solid var(--gaip-text-muted); font-size: 11px; color: var(--gaip-text-secondary); font-style: italic;">Scope: ${disease.speciesScope}</div>` : ''}
                    ${disease.poaNote ? `<div class="gaip-poa-note" style="margin: 8px 0; padding: 8px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; font-size: 12px; color: #92400e;">🌿 ${disease.poaNote}</div>` : ''}
                    ${disease.note ? `<div class="gaip-disease-note" style="margin: 8px 0; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #0ea5e9; font-size: 12px; color: #0c4a6e;">ℹ️ ${disease.note}</div>` : ''}
                    ${disease.keyMessage ? `<div class="gaip-key-message">${disease.keyMessage}</div>` : ''}
                    ${this.buildRecommendationBlock(disease.recommendation)}
                    ${interventionsHTML}
                    <div class="gaip-source">Source: ${disease.source}</div>
                </div>
            </div>
        `;
    },
    
    /**
     * Build drivers visualization
     */
    buildDriversSummary(drivers) {
        if (!drivers) return '';
        
        const driverItems = Object.entries(drivers).map(([key, data]) => {
            if (!data || typeof data !== 'object') return '';
            
            const label = this.formatDriverLabel(key);
            // Handle Pythium's 'wetness' driver which uses leafWetnessHours + nightHumidity
            let value;
            if (key === 'wetness') {
                value = data.leafWetnessHours != null
                    ? `${data.leafWetnessHours}h wet / RH ${data.nightHumidity}%`
                    : `RH ${data.nightHumidity}%`;
            } else {
                value = data.value !== undefined ? data.value : data.status || '';
            }
            const contribution = data.contribution || 0;
            const status = data.status || 'normal';
            
            return `
                <div class="gaip-driver-item">
                    <div class="gaip-driver-label">${label}</div>
                    <div class="gaip-driver-bar">
                        <div class="gaip-driver-fill" style="width: ${Math.min(100, contribution)}%"></div>
                    </div>
                    <div class="gaip-driver-value">${value}${data.contribution ? ` (${contribution}%)` : ''}</div>
                </div>
            `;
        }).filter(Boolean).join('');
        
        return `<div class="gaip-drivers-list">${driverItems}</div>`;
    },
    
    /**
     * Build recommendation block from disease.recommendation object.
     * Sits between drivers and interventions. Only renders when action != 'none'.
     */
    buildRecommendationBlock(rec) {
        if (!rec || rec.action === 'none') return '';

        // Colour palette keyed to action
        const PALETTE = {
            monitor:    { bg: 'var(--gaip-info-bg)', border: '#38bdf8', text: '#0c4a6e', badge: '#0ea5e9', badgeBg: 'var(--gaip-info-bg)' },
            prepare:    { bg: 'var(--gaip-warning-bg)', border: '#f59e0b', text: '#78350f', badge: '#d97706', badgeBg: 'var(--gaip-warning-bg)' },
            preventive: { bg: 'var(--gaip-warning-bg)', border: '#f97316', text: '#7c2d12', badge: '#ea580c', badgeBg: 'var(--gaip-warning-bg)' },
            curative:   { bg: 'var(--gaip-critical-bg)', border: '#ef4444', text: '#7f1d1d', badge: '#dc2626', badgeBg: 'var(--gaip-critical-bg)' },
        };
        const ACTION_LABELS = {
            monitor:    'Monitor',
            prepare:    'Prepare',
            preventive: 'Apply, Preventive',
            curative:   'Apply, Curative',
        };

        const p      = PALETTE[rec.action] || PALETTE.monitor;
        const label  = ACTION_LABELS[rec.action] || rec.action;
        const icon   = rec.action === 'curative' ? '🚨' : rec.action === 'preventive' ? '⚠️' : rec.action === 'prepare' ? '🔶' : '👁️';

        // Products block
        let productsHtml = '';
        if (rec.products && rec.products.length > 0) {
            const rows = rec.products.map(p =>
                `<li style="margin: 2px 0; font-size: 0.78rem;">${p}</li>`
            ).join('');
            productsHtml = `
                <div style="margin-top: 8px;">
                    <div style="font-size: 0.72rem; font-weight: 600; color: ${p.text}; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em;">
                        ${rec.productsLabel || 'Registered products'}
                    </div>
                    <ul style="margin: 0; padding-left: 16px; list-style: disc;">${rows}</ul>
                </div>`;
        } else if (rec.productWarnings && rec.productWarnings.length > 0) {
            productsHtml = `<div style="margin-top: 6px; font-size: 0.75rem; color: ${p.text}; font-style: italic;">${rec.productWarnings[0]}</div>`;
        }

        // Resistance note
        const resistanceHtml = rec.resistanceNote
            ? `<div style="margin-top: 8px; padding: 5px 8px; background: rgba(0,0,0,0.04); border-left: 2px solid ${p.border}; font-size: 0.72rem; color: ${p.text};">⚠ ${rec.resistanceNote}</div>`
            : '';

        // Caveat (SDS, anthracnose, etc.)
        const caveatHtml = rec.caveat
            ? `<div style="margin-top: 6px; font-size: 0.72rem; color: ${p.text}; font-style: italic;">ℹ ${rec.caveat}</div>`
            : '';

        return `
            <div class="gaip-recommendation-block" style="margin: 10px 0; padding: 10px 12px; background: ${p.bg}; border: 1px solid ${p.border}; border-radius: 6px;">
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                    <span style="font-size: 1rem; line-height: 1.3;">${icon}</span>
                    <div style="flex: 1;">
                        <span style="display: inline-block; font-size: 0.68rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: ${p.badgeBg}; color: ${p.badge}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${label}</span>
                        <div style="font-size: 0.82rem; font-weight: 600; color: ${p.text}; line-height: 1.4;">${rec.headline}</div>
                        ${rec.timing ? `<div style="font-size: 0.77rem; color: ${p.text}; margin-top: 3px; font-weight: 500;">${rec.timing}</div>` : ''}
                        ${rec.trendText && rec.trendText !== 'stable' ? `<div style="font-size: 0.72rem; color: ${p.text}; margin-top: 2px; opacity: 0.8;">Trend: ${rec.trendText}</div>` : ''}
                        ${rec.residualNote ? `<div style="font-size: 0.72rem; color: ${p.text}; margin-top: 4px; padding: 3px 6px; background: rgba(0,0,0,0.05); border-radius: 3px;">🛡 ${rec.residualNote}</div>` : ''}
                    </div>
                </div>
                ${productsHtml}
                ${resistanceHtml}
                ${caveatHtml}
            </div>
        `;
    },

    /**
     * Build interventions section
     * Note: Always shows timing for SDS regardless of risk level
     */
    buildInterventions(interventions, riskLevel, disease) {
        if (!interventions) return '';
        
        // Always show timing for Spring Dead Spot (treatment window is critical info)
        const isSDS = disease === 'springDeadSpot';
        
        // For low risk, only show timing for SDS
        if (riskLevel === 'low' && !isSDS) return '';
        if (riskLevel === 'low' && isSDS && !interventions.timing) return '';
        
        let html = '<div class="gaip-interventions">';
        
        if (interventions.timing) {
            const urgencyClass = interventions.urgency === 'CRITICAL' ? 'gaip-urgent-critical' : 
                                interventions.urgency === 'HIGH' ? 'gaip-urgent-high' : '';
            const windowClass = interventions.timing.includes('WINDOW OPEN') ? 'gaip-window-open' : '';
            html += `<div class="gaip-timing ${urgencyClass} ${windowClass}"><strong>Timing:</strong> ${interventions.timing}</div>`;
        }
        
        if (interventions.cultural && interventions.cultural.length > 0) {
            html += `
                <div class="gaip-intervention-group">
                    <h6>Cultural Practices</h6>
                    <ul>${interventions.cultural.map(c => `<li>${c}</li>`).join('')}</ul>
                </div>
            `;
        }
        
        if (interventions.preventive && interventions.preventive.length > 0) {
            html += `
                <div class="gaip-intervention-group">
                    <h6>Preventive Options</h6>
                    <ul>${interventions.preventive.map(p => `<li>${p}</li>`).join('')}</ul>
                </div>
            `;
        }
        
        if (interventions.curative && interventions.curative.length > 0) {
            html += `
                <div class="gaip-intervention-group">
                    <h6>Curative Options</h6>
                    <ul>${interventions.curative.map(c => `<li>${c}</li>`).join('')}</ul>
                </div>
            `;
        }
        
        if (interventions.regionalWarning) {
            html += `<div class="gaip-regional-warning" style="background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-radius: 4px; padding: 8px; margin-top: 10px; font-size: 11px; color: #92400e;">⚠️ ${interventions.regionalWarning}</div>`;
        }
        
        if (interventions.regionalNotes) {
            html += `<div class="gaip-regional-notes" style="background: var(--gaip-info-bg); border: 1px solid #3b82f6; border-radius: 4px; padding: 8px; margin-top: 10px; font-size: 11px; color: #1e40af;">ℹ️ ${interventions.regionalNotes}</div>`;
        }
        
        if (interventions.useContextWarning) {
            html += `<div class="gaip-use-context-warning" style="background: var(--gaip-critical-bg); border: 1px solid #ef4444; border-radius: 4px; padding: 8px; margin-top: 10px; font-size: 11px; color: #dc2626;">${interventions.useContextWarning}</div>`;
        }
        
        if (interventions.resistanceNote) {
            html += `<div class="gaip-resistance-note">⚠️ ${interventions.resistanceNote}</div>`;
        }
        
        if (interventions.emergencyNote) {
            html += `<div class="gaip-emergency-note">🚨 ${interventions.emergencyNote}</div>`;
        }
        
        html += '</div>';
        return html;
    },
    
    /**
     * Spray timing card
     */
    buildSprayTimingCard(results) {
        // Placeholder - would integrate with forecast data
        return `
            <div class="gaip-card gaip-spray-timing">
                <div class="gaip-card-header">
                    <h4>🗓️ Spray Timing</h4>
                </div>
                <div class="gaip-card-body">
                    <p class="gaip-spray-note">Check weather forecast for optimal application windows:</p>
                    <ul class="gaip-spray-conditions">
                        <li>Temperature: 10-30°C</li>
                        <li>Rain-free: 4+ hours after application</li>
                        <li>Wind: &lt;15 km/h</li>
                    </ul>
                </div>
            </div>
        `;
    },
    
    /**
     * Attach event listeners for progressive disclosure
     */
    attachEventListeners(container) {
        const headers = container.querySelectorAll('[data-toggle="disease-detail"]');
        
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.gaip-disease-card');
                const detail = card.querySelector('.gaip-disease-detail');
                const icon = header.querySelector('.gaip-expand-icon');
                
                if (detail.style.display === 'none') {
                    detail.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    detail.style.display = 'none';
                    icon.textContent = '▶';
                }
            });
        });
    },
    
    /**
     * Utility: Format species name
     */
    formatSpecies(species) {
        const names = {
            bentgrass: 'Bentgrass',
            perennialRyegrass: 'Perennial Ryegrass',
            kentuckyBluegrass: 'Kentucky Bluegrass',
            tallFescue: 'Tall Fescue',
            poaAnnua: 'Poa annua',
            bermuda: 'Bermudagrass',
            couch: 'Couch',
            kikuyu: 'Kikuyu',
            zoysia: 'Zoysia',
            buffalo: 'Buffalo'
        };
        return names[species] || species;
    },
    
    /**
     * Utility: Format driver label
     */
    formatDriverLabel(key) {
        const labels = {
            temperature: 'Temperature',
            nightTemperature: 'Night Temp',
            dayTemperature: 'Day Temp',
            humidity: 'Humidity',
            nightHumidity: 'Night Humidity',
            wetness: 'Leaf Wetness',
            leafWetness: 'Leaf Wetness',
            nitrogen: 'Nitrogen',
            recentRain: 'Recent Rain',
            pH: 'Soil pH',
            manganese: 'Manganese',
            moisture: 'Soil Moisture',
            soilTemperature: 'Soil Temp',
            coldExposure: 'Cold Exposure',
            establishment: 'Establishment',
            thatch: 'Thatch',
            potassium: 'Potassium',
            heat: 'Heat Stress',
            mowingHeight: 'Mowing Height',
            shade: 'Shade',
            traffic: 'Traffic'
        };
        return labels[key] || key;
    },
    
    /**
     * Utility: Format disease phase
     */
    formatPhase(phase) {
        const phases = {
            leaf_spot: 'Leaf Spot',
            leaf_blight: 'BLIGHT',
            crown_root_rot: 'Crown/Root',
            critical: 'CRITICAL',
            inactive: 'Inactive'
        };
        return phases[phase] || phase;
    },
    
    /**
     * Utility: Get risk icon
     */
    getRiskIcon(level) {
        const icons = {
            minimal: '✅',
            low: '✅',
            moderate: '⚡',
            high: '⚠️',
            severe: '🚨'
        };
        return icons[level] || '❓';
    }
};

// Export
if (typeof window !== 'undefined') {
    window.DiseaseUI = DiseaseUI;
}
