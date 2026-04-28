/**
 * =============================================================================
 * GILBA HUB DAILY DASHBOARD v1.8.1
 * =============================================================================
 * 
 * At-a-glance dashboard showing key turf management metrics.
 * Displays above the main hub grid with live-updating widgets.
 * 
 * CHANGELOG:
 * v1.8.1 - DMI combined risk warning band on PGR card. Reads pgrResult.dmi
 *          (orchestrator pure path) with fallback to window.GAIP_COMBINED_SUPPRESSION
 *          (hub-tissue legacy path). Colour-coded danger/warning/caution.
 * v1.8.0 - Disease widget: "Forecast Peak" label when showing forecast-driven data
 *        - Disease severity colour now uses max(current, forecast) for visual urgency
 *        - Stress widget: headline always shows CURRENT stress, not max
 *        - Stress trajectory labelled "today → day X" to remove ambiguity
 *        - Progress bars on both widgets track their headline value
 * v1.6.0 - b35fix166: Fix disease card showing "Run analysis to see disease risk"
 *        - speciesMatch now passes when currentTurfSpecies is empty (TurfProfile race)
 *        - speciesMatch now passes when diseaseResult._writtenAt < 60s old
 *        - Both GAIP_DISEASE_RESULT write sites stamp _writtenAt for recency check
 * v1.5.9 - Climate stress forecast integration, stress trajectory display in widget
 * v1.5.8 - Added heat stress warnings to action items (critical >35°C C3, >42°C C4)
 * v1.5.7 - Only show validated (non-beta) diseases in dashboard
 *        - Never fall back to beta diseases (Bipolaris, Curvularia, Drechslera, Waitea)
 *        - Check DOM data for beta diseases before using
 *        - Use validated forecast disease for trajectory display
 * v1.5.6 - Comprehensive beta disease filtering fix
 *        - Add Waitea Patch (Rhizoctonia zeae) to beta disease list
 *        - Move isDiseaseModelBeta() helper earlier, use for BOTH current results AND forecast
 *        - Previously only forecast used name-based beta detection; current results only
 *          checked validationStatus flag which disease engine doesn't always set
 *        - Beta list: Bipolaris (all), Curvularia, Drechslera (Melting-Out), Waitea Patch
 *        - Prevents any beta disease from appearing as validated in dashboard
 * v1.5.5 - Fix browntop bent disease dashboard showing nothing
 *        - Species comparison now normalizes both turf and disease result species
 *        - "Browntop Bent (Greens)" → "bentgrass" matches disease engine output
 *        - Fixes NZ/UK greens not showing disease risk after analysis
 * v1.5.4 - Fix beta detection for Curvularia and Drechslera (Melting-Out)
 *        - Previous check only looked for explicit beta flags and "BETA" in name
 *        - Now checks disease key/name patterns for all leaf spot beta models
 *        - Prevents beta diseases from appearing as "validated" forecast peaks
 * v1.5.3 - Exclude BETA diseases from forecast trajectory
 *        - Finds top non-beta disease in forecast for peak display
 *        - Prevents beta diseases like Bipolaris from driving the trajectory
 * v1.5.2 - Fix disease widget showing wrong disease for trajectory
 *        - When forecast peak is from different disease (e.g., Bipolaris on couch),
 *          now shows that disease instead of current day's top disease
 *        - Prevents misleading "Dollar Spot 19% → 100%" when 100% is Bipolaris
 * v1.5.1 - Fix stale forecast data when species changes
 *        - Validates forecast species matches current turf species
 *        - Uses forecast summary data directly (avoids name matching bugs)
 *        - Prevents showing Dollar Spot for Couch, etc.
 * v1.5.0 - Disease widget now shows current → peak trajectory from forecast
 *        - Displays "44% → 78%" format showing risk progression
 *        - Pulls forecast peak from GAIP_DISEASE_FORECAST
 *        - Overall severity based on MAX of current and peak
 * v1.3.0 - Fixed PGR widget: now reads from nested gdd/effect objects
 *        - Shows suppression % as primary metric (not just "Active")
 *        - Added days remaining as sublabel
 * v1.2.0 - Fixed RH: fallback to rawWeatherData.hourly.relative_humidity_2m
 *        - PGR widget shows when product selected (prompts to set date)
 * v1.1.0 - Added conditional PGR widget (shows when PGR program active)
 *        - Fixed RH display (moisture.humidity.mean path)
 * v1.0.2 - Fixed GP display: Hub stores as percentage (74), not decimal (0.74)
 * v1.0.1 - Fixed Growth Potential (climateMetrics.growth not .growthPotential)
 *        - Fixed Irrigation NaN (use summary.totalIrrigation, .irrigation?.totalDepth)
 * 
 * WIDGETS:
 * - Growth Potential: Current GP with C3/C4 breakdown
 * - Disease Risk: Top risk with color-coded severity + forecast trajectory
 * - Stress Index: Compound stress with trend indicator
 * - Weather: Current conditions + 3-day outlook
 * - Irrigation: Weekly need + next event countdown
 * - Action Items: Priority tasks requiring attention
 * - PGR Status: (conditional) Days remaining, suppression status
 * 
 * FEATURES:
 * - Loads cached data instantly on page load
 * - Updates automatically when analysis runs
 * - Collapsible for minimal footprint
 * - Responsive grid layout
 * 
 * @author Gilba Solutions
 * @version 1.5.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.9.0',  // v1.9.0: Stress per-factor breakdown bars, data quality footer
        debug: false,
        
        // Dashboard update interval (ms) - 0 = only on events
        updateInterval: 0,
        
        // Show dashboard by default
        defaultExpanded: true,
        
        // Widget definitions (pgr is conditional)
        widgets: ['growth', 'disease', 'stress', 'weather', 'irrigation', 'pgr']
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let _dashboardEl = null;
    let _isExpanded = CONFIG.defaultExpanded;
    let _lastUpdate = null;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // SPECIES NORMALIZATION (for matching disease results to turf species)
    // =========================================================================
    
    /**
     * Normalize species name to canonical form for comparison
     * Must match disease-integration.js normalization
     */
    function normalizeSpeciesForComparison(species) {
        if (!species || typeof species !== 'string') return '';
        const s = species.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Bentgrass variants (including browntop)
        if (s.includes('bent')) return 'bentgrass';
        if (s.includes('rye')) return 'perennialryegrass';
        if (s.includes('poa') || s.includes('annual')) return 'poaannua';
        if (s.includes('fescue')) return 'fescue';
        if (s.includes('blue') && !s.includes('annual')) return 'bluegrass';
        if (s.includes('couch') || s.includes('bermuda')) return 'couch';
        if (s.includes('kikuyu')) return 'kikuyu';
        if (s.includes('zoysia')) return 'zoysia';
        if (s.includes('buffalo')) return 'buffalo';
        if (s.includes('paspalum')) return 'paspalum';
        
        return s; // Return cleaned string if no match
    }

    // =========================================================================
    // DASHBOARD HTML GENERATION
    // =========================================================================

    function createDashboardHTML() {
        return `
            <div id="gaip-daily-dashboard" class="gaip-dashboard ${_isExpanded ? '' : 'collapsed'}">
                <div class="gaip-dashboard-header">
                    <div class="gaip-dashboard-title">
                        <span class="gaip-dashboard-icon">📊</span>
                        <h3>Daily Dashboard</h3>
                        <span class="gaip-dashboard-updated"></span>
                    </div>
                    <button class="gaip-dashboard-toggle" aria-label="Toggle dashboard">
                        <span class="gaip-toggle-icon">${_isExpanded ? '▼' : '▲'}</span>
                    </button>
                </div>
                <div class="gaip-dashboard-body">
                    <div class="gaip-dashboard-grid">
                        ${createWidgetHTML('growth', 'Growth Potential', '🌱')}
                        ${createWidgetHTML('disease', 'Disease Risk', '🦠')}
                        ${createWidgetHTML('stress', 'Stress Index', '⚡')}
                        ${createWidgetHTML('weather', 'Weather', '🌤️')}
                        ${createWidgetHTML('irrigation', 'Irrigation', '💧')}
                    </div>
                    <div id="gaip-dashboard-actions-slot"></div>
                    <div id="gaip-dashboard-footer" class="gaip-dashboard-footer" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    function createWidgetHTML(id, title, icon) {
        return `
            <div class="gaip-widget gaip-widget-${id}" data-widget="${id}">
                <div class="gaip-widget-header">
                    <span class="gaip-widget-icon">${icon}</span>
                    <span class="gaip-widget-title">${title}</span>
                </div>
                <div class="gaip-widget-content">
                    <div class="gaip-widget-loading">Loading...</div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // DASHBOARD CSS
    // =========================================================================

    function injectDashboardStyles() {
        if (document.getElementById('gaip-dashboard-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'gaip-dashboard-styles';
        styles.textContent = `
            /* Dashboard Container — visual weight matches result cards below */
            .gaip-dashboard {
                margin-bottom: 20px;
                overflow: hidden;
                width: 100%;
                box-sizing: border-box;
                background: var(--gaip-surface);
                border: 1px solid var(--gaip-border);
                border-radius: 10px;
                padding: 16px;
            }
            
            /* Dashboard Header */
            .gaip-dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 0 12px 0;
                cursor: pointer;
                user-select: none;
            }
            
            .gaip-dashboard-title {
                display: flex;
                align-items: center;
                gap: 10px;
                color: var(--gaip-text);
            }
            
            .gaip-dashboard-title h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            
            .gaip-dashboard-icon {
                font-size: 20px;
            }
            
            .gaip-dashboard-updated {
                font-size: 11px;
                color: var(--gaip-text);
                font-weight: 400;
            }
            
            .gaip-dashboard-toggle {
                background: var(--gaip-border);
                border: none;
                border-radius: 6px;
                color: var(--gaip-text);
                padding: 6px 12px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            
            .gaip-dashboard-toggle:hover {
                background: var(--gaip-border);
            }
            
            /* Dashboard Body */
            .gaip-dashboard-body {
                padding: 0;
                display: block;
            }
            
            .gaip-dashboard.collapsed .gaip-dashboard-body {
                display: none;
            }
            
            /* Widget Grid — 3 fixed columns, 2 rows of 3 */
            .gaip-dashboard-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 14px;
            }
            
            /* Slot for priority action queue below the scorecard grid */
            #gaip-dashboard-actions-slot {
                margin-top: 14px;
            }
            
            /* Individual Widget — lighter borders inside the dashboard container */
            .gaip-widget {
                background: var(--gaip-surface-muted);
                border: 1px solid var(--gaip-surface-hover);
                border-radius: 10px;
                padding: 16px;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .gaip-widget:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border-color: var(--gaip-border);
            }
            
            .gaip-widget-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--gaip-border);
            }
            
            .gaip-widget-icon {
                font-size: 16px;
            }
            
            .gaip-widget-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--gaip-text);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .gaip-widget-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            
            .gaip-widget-loading {
                color: var(--gaip-text);
                font-size: 12px;
                text-align: center;
            }
            
            /* Widget Value Display */
            .gaip-widget-value {
                font-size: 36px;
                font-weight: 700;
                line-height: 1.1;
                margin-bottom: 4px;
            }
            
            .gaip-widget-unit {
                font-size: 18px;
                font-weight: 400;
                color: var(--gaip-text);
            }
            
            .gaip-widget-label {
                font-size: 13px;
                color: var(--gaip-text);
                margin-top: 4px;
            }
            
            .gaip-widget-sublabel {
                font-size: 12px;
                color: var(--gaip-text);
            }
            
            /* Severity Colors */
            .gaip-severity-low { color: #10b981; }
            .gaip-severity-moderate { color: #f59e0b; }
            .gaip-severity-high { color: #ef4444; }
            .gaip-severity-critical { color: #dc2626; }
            
            /* Trend Indicators */
            .gaip-trend {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 4px;
                margin-left: 6px;
            }
            
            .gaip-trend-up {
                background: var(--gaip-critical-bg);
                color: #dc2626;
            }
            
            .gaip-trend-down {
                background: var(--gaip-good-bg);
                color: #059669;
            }
            
            .gaip-trend-stable {
                background: var(--gaip-border);
                color: var(--gaip-text);
            }
            
            /* Progress Bars */
            .gaip-progress-bar {
                height: 6px;
                background: var(--gaip-border);
                border-radius: 3px;
                overflow: hidden;
                margin-top: 8px;
            }
            
            .gaip-progress-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.5s ease;
            }
            
            .gaip-progress-green { background: linear-gradient(90deg, #10b981, #34d399); }
            .gaip-progress-yellow { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .gaip-progress-red { background: linear-gradient(90deg, #ef4444, #f87171); }
            
            /* Weather Mini Forecast */
            .gaip-mini-forecast {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .gaip-forecast-day {
                flex: 1;
                text-align: center;
                font-size: 10px;
                color: var(--gaip-text);
            }
            
            .gaip-forecast-day strong {
                display: block;
                font-size: 12px;
                color: var(--gaip-text);
            }
            
            /* Action Items */
            .gaip-action-list {
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
            }
            
            .gaip-action-list li {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 5px 0;
                border-bottom: 1px solid var(--gaip-surface-hover);
                line-height: 1.3;
            }
            
            .gaip-action-list li:last-child {
                border-bottom: none;
            }
            
            .gaip-action-priority {
                flex-shrink: 0;
                margin-top: 1px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                padding: 1px 5px;
                border-radius: 3px;
                line-height: 1.4;
            }
            
            .gaip-priority-high { background: var(--gaip-critical-bg); color: #dc2626; border: 1px solid var(--gaip-critical-border); }
            .gaip-priority-medium { background: var(--gaip-warning-bg); color: #d97706; border: 1px solid var(--gaip-warning-border); }
            .gaip-priority-low { background: var(--gaip-good-bg); color: #16a34a; border: 1px solid var(--gaip-good-bg); }
            
            /* No Data State */
            .gaip-no-data {
                color: var(--gaip-text);
                font-size: 12px;
                text-align: center;
                padding: 10px 0;
            }
            
            /* Responsive */
            @media (max-width: 900px) {
                .gaip-dashboard-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .gaip-widget-value {
                    font-size: 30px;
                }
            }
            
            @media (max-width: 600px) {
                .gaip-dashboard-grid {
                    grid-template-columns: 1fr;
                }
            }
            
            /* Stress Factor Breakdown Bars */
            .gaip-stress-factors {
                display: flex;
                flex-direction: column;
                gap: 3px;
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px solid var(--gaip-surface-hover);
            }
            
            .gaip-stress-factor-row {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 10px;
                color: var(--gaip-text-secondary);
            }
            
            .gaip-stress-factor-label {
                width: 52px;
                flex-shrink: 0;
                text-align: right;
                font-weight: 500;
            }
            
            .gaip-stress-factor-bar {
                flex: 1;
                height: 4px;
                background: var(--gaip-surface-hover);
                border-radius: 2px;
                overflow: hidden;
            }
            
            .gaip-stress-factor-fill {
                height: 100%;
                border-radius: 2px;
                transition: width 0.4s ease;
            }
            
            .gaip-stress-factor-value {
                width: 28px;
                flex-shrink: 0;
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            
            /* Data Quality Footer */
            .gaip-dashboard-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0 0 0;
                margin-top: 12px;
                border-top: 1px solid var(--gaip-surface-hover);
                font-size: 11px;
                color: var(--gaip-text-muted);
            }
            
            .gaip-dq-sources {
                display: flex;
                gap: 12px;
                align-items: center;
            }
            
            .gaip-dq-dot {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                margin-right: 4px;
            }
            
            .gaip-dq-fresh { background: #10b981; }
            .gaip-dq-stale { background: #f59e0b; }
            .gaip-dq-missing { background: var(--gaip-border); }
        `;
        
        document.head.appendChild(styles);
    }

    // =========================================================================
    // WIDGET UPDATE FUNCTIONS
    // =========================================================================

    function updateGrowthWidget(data) {
        const widget = document.querySelector('.gaip-widget-growth .gaip-widget-content');
        if (!widget) return;

        const gpRaw = data?.growthPotential ?? null;
        const c3Raw = data?.c3 ?? null;
        const c4Raw = data?.c4 ?? null;
        const c3Frac = data?.c3Fraction ?? null;
        const c4Frac = data?.c4Fraction ?? null;

        if (gpRaw === null) {
            widget.innerHTML = '<div class="gaip-no-data">Run analysis to see growth data</div>';
            return;
        }

        // Hub stores GP as percentage (0-100), not decimal (0-1)
        // Detect format: if value > 1, it's already a percentage
        const gpPercent = Math.round(gpRaw > 1 ? gpRaw : gpRaw * 100);
        const c3Percent = c3Raw !== null ? Math.round(c3Raw > 1 ? c3Raw : c3Raw * 100) : null;
        const c4Percent = c4Raw !== null ? Math.round(c4Raw > 1 ? c4Raw : c4Raw * 100) : null;

        // Only show C3/C4 breakdown for genuine mixed stands.
        // c4Frac and c3Frac represent the SPECIES COMPOSITION (0-1), not the GP value.
        // A pure C3 grass has c3Frac=1, c4Frac=0 — never show C4 GP for it.
        // climateMetrics.growth.c4 is always calculated at every temperature, but that
        // is the hypothetical C4 GP, not an indication the sward contains C4 grass.
        const isPureC3 = c3Frac !== null && c3Frac >= 1;
        const isPureC4 = c4Frac !== null && c4Frac >= 1;
        const isMixed = !isPureC3 && !isPureC4 && c3Frac !== null && c4Frac !== null && c3Frac > 0 && c4Frac > 0;
        const showBoth = isMixed;

        let breakdownLabel = '';
        if (isPureC3 && c3Percent !== null) {
            // Pure C3: show thermal GP with context
            breakdownLabel = `Thermal (cool-season): ${c3Percent}%`;
        } else if (isPureC4 && c4Percent !== null) {
            // Pure C4: show thermal GP with context
            breakdownLabel = `Thermal (warm-season): ${c4Percent}%`;
        } else if (showBoth && c3Percent !== null && c4Percent !== null) {
            breakdownLabel = `Thermal — C3: ${c3Percent}% · C4: ${c4Percent}%`;
        }

        const severityClass = gpPercent >= 70 ? 'gaip-severity-low' :
                             gpPercent >= 40 ? 'gaip-severity-moderate' : 'gaip-severity-high';
        const barClass = gpPercent >= 70 ? 'gaip-progress-green' :
                        gpPercent >= 40 ? 'gaip-progress-yellow' : 'gaip-progress-red';

        widget.innerHTML = `
            <div class="gaip-widget-value ${severityClass}" title="Weighted growth potential — accounts for temperature, day length and variety adjustment">${gpPercent}<span class="gaip-widget-unit">%</span></div>
            <div class="gaip-progress-bar">
                <div class="gaip-progress-fill ${barClass}" style="width: ${Math.min(gpPercent, 100)}%"></div>
            </div>
            ${breakdownLabel ? `<div class="gaip-widget-label" title="Thermal GP: temperature-only component before weighting">${breakdownLabel}</div>` : ''}
        `;
    }

    function updateDiseaseWidget(data) {
        const widget = document.querySelector('.gaip-widget-disease .gaip-widget-content');
        if (!widget) return;
        
        const overall = data?.overall ?? null;
        const topDisease = data?.topDisease ?? null;
        const topRisk = data?.topRisk ?? null;
        const forecastPeak = data?.forecastPeak ?? null;
        const forecastDisease = data?.forecastDisease ?? null;
        const peakDay = data?.peakDay ?? null;
        
        if (overall === null) {
            widget.innerHTML = '<div class="gaip-no-data">Run analysis to see disease risk</div>';
            return;
        }
        
        // v2.10.2: Use CURRENT risk for severity classification, not forecast peak
        // Forecast peak shown as trajectory info only
        const currentRisk = overall || 0;
        
        const severityClass = currentRisk < 50 ? 'gaip-severity-low' :
                             currentRisk < 70 ? 'gaip-severity-moderate' : 'gaip-severity-high';
        const riskLabel = currentRisk < 50 ? 'Low' :
                         currentRisk < 70 ? 'Moderate' : 'High';
        
        // v1.8.0: Build trajectory display with clear labelling
        // When showing forecast peak, label explicitly as "Forecast Peak"
        // to distinguish from current-day pressure shown in Disease Risk panel
        let trajectoryHTML = '';
        let titleSuffix = '';  // Appended to widget title when forecast drives the display
        const forecastIsSameDisease = !forecastDisease || forecastDisease === topDisease;
        
        if (forecastPeak && forecastIsSameDisease && forecastPeak > currentRisk + 5) {
            // Same disease rising - show trajectory with forecast label
            titleSuffix = ' <span style="font-size: 10px; font-weight: 400; opacity: 0.7;">Forecast Peak</span>';
            trajectoryHTML = `
                <div class="gaip-widget-sublabel" style="color: #ef4444; font-weight: 500;">
                    ${topRisk}% → ${forecastPeak}% 
                    <span style="font-size: 10px; opacity: 0.8;">day ${peakDay || '?'}</span>
                </div>
            `;
        } else if (forecastPeak && !forecastIsSameDisease && forecastPeak > currentRisk + 10) {
            // Different disease projected to peak higher - show as secondary warning
            titleSuffix = ' <span style="font-size: 10px; font-weight: 400; opacity: 0.7;">Forecast Peak</span>';
            trajectoryHTML = `
                <div class="gaip-widget-sublabel">${topRisk}% today</div>
                <div class="gaip-widget-sublabel" style="font-size: 10px; color: #ef4444; margin-top: 1px;">
                    ⚠ ${formatDiseaseName(forecastDisease)} → ${forecastPeak}% day ${peakDay || '?'}
                </div>
            `;
        } else if (forecastPeak && forecastPeak < currentRisk - 5) {
            // Risk falling
            trajectoryHTML = `
                <div class="gaip-widget-sublabel" style="color: #22c55e; font-weight: 500;">
                    ${topRisk}% → ${forecastPeak}% ↓
                </div>
            `;
        } else {
            // Stable - no forecast label needed
            trajectoryHTML = `<div class="gaip-widget-sublabel">${topRisk}% risk</div>`;
        }
        
        // v1.8.0: Use severity based on the HIGHER of current and forecast peak
        // so the card colour reflects the worst-case scenario being shown
        const displayRisk = (forecastPeak && forecastPeak > currentRisk + 5) ? forecastPeak : currentRisk;
        const displaySeverityClass = displayRisk < 50 ? 'gaip-severity-low' :
                             displayRisk < 70 ? 'gaip-severity-moderate' :
                             displayRisk < 85 ? 'gaip-severity-high' : 'gaip-severity-severe';
        const displayRiskLabel = displayRisk < 50 ? 'Low' :
                         displayRisk < 70 ? 'Moderate' :
                         displayRisk < 85 ? 'High' : 'Severe';
        
        widget.innerHTML = `
            <div class="gaip-widget-value ${displaySeverityClass}">${displayRiskLabel}</div>
            ${topDisease ? `
                <div class="gaip-widget-label">${formatDiseaseName(topDisease)}${titleSuffix}</div>
                ${trajectoryHTML}
            ` : ''}
            <div class="gaip-progress-bar">
                <div class="gaip-progress-fill ${displayRisk < 50 ? 'gaip-progress-green' : displayRisk < 70 ? 'gaip-progress-yellow' : 'gaip-progress-red'}" style="width: ${Math.min(displayRisk, 100)}%"></div>
            </div>
        `;
    }

    function updateStressWidget(data) {
        const widget = document.querySelector('.gaip-widget-stress .gaip-widget-content');
        if (!widget) return;
        
        const index = data?.stressIndex ?? null;
        const trend = data?.trend ?? null;
        const peakStress = data?.peakStress ?? null;
        const peakDay = data?.peakDay ?? null;
        const factors = data?.factors ?? null;
        
        if (index === null) {
            widget.innerHTML = '<div class="gaip-no-data">Run analysis to see stress data</div>';
            return;
        }
        
        // v1.8.0: Always show CURRENT stress as the headline number
        const currentStress = Math.round(index);
        
        const severityClass = currentStress <= 30 ? 'gaip-severity-low' :
                             currentStress <= 60 ? 'gaip-severity-moderate' : 'gaip-severity-high';
        
        const trendIcon = trend === 'improving' || trend === 'FALLING' ? '↓' : 
                          trend === 'worsening' || trend === 'RISING' ? '↑' : '→';
        const trendClass = trend === 'improving' || trend === 'FALLING' ? 'gaip-trend-down' : 
                          trend === 'worsening' || trend === 'RISING' ? 'gaip-trend-up' : 'gaip-trend-stable';
        
        // v1.8.0: Show forecast trajectory
        let trajectoryHTML = '';
        if (peakStress !== null && peakStress > index + 10) {
            trajectoryHTML = `
                <div class="gaip-widget-sublabel" style="color: #ef4444; font-weight: 500;">
                    ${currentStress}% today → ${Math.round(peakStress)}% 
                    <span style="font-size: 10px; opacity: 0.8;">day ${(peakDay || 0) + 1}</span>
                </div>
            `;
        } else if (peakStress !== null && peakStress < index - 10) {
            trajectoryHTML = `
                <div class="gaip-widget-sublabel" style="color: #22c55e; font-weight: 500;">
                    ${currentStress}% today → ${Math.round(peakStress)}% ↓
                </div>
            `;
        } else {
            trajectoryHTML = `<div class="gaip-widget-sublabel">${currentStress}% today</div>`;
        }
        
        // v1.9.0: Per-factor breakdown bars from stress trajectory components
        let factorHTML = '';
        if (factors) {
            const factorDefs = [
                { key: 'thermal',   label: 'Heat',      color: '#ef4444' },
                { key: 'moisture',  label: 'Moisture',   color: '#3b82f6' },
                { key: 'light',     label: 'Light',      color: '#f59e0b' },
                { key: 'traffic',   label: 'Traffic',    color: '#8b5cf6' },
                { key: 'nutrition', label: 'Nutrition',  color: '#10b981' },
                { key: 'biotic',    label: 'Disease',    color: '#ec4899' }
            ];
            
            // Only show factors that contribute (> 5%)
            const activeDefs = factorDefs.filter(f => {
                const val = Math.abs(factors[f.key] || 0);
                return val > 5;
            });
            
            if (activeDefs.length > 0) {
                factorHTML = '<div class="gaip-stress-factors">';
                activeDefs.forEach(f => {
                    const val = Math.round(Math.abs(factors[f.key] || 0));
                    const barWidth = Math.min(val, 100);
                    factorHTML += `
                        <div class="gaip-stress-factor-row">
                            <span class="gaip-stress-factor-label">${f.label}</span>
                            <div class="gaip-stress-factor-bar">
                                <div class="gaip-stress-factor-fill" style="width: ${barWidth}%; background: ${f.color};"></div>
                            </div>
                            <span class="gaip-stress-factor-value">${val}%</span>
                        </div>
                    `;
                });
                factorHTML += '</div>';
            }
        }
        
        widget.innerHTML = `
            <div class="gaip-widget-value ${severityClass}">
                ${currentStress}
                <span class="gaip-trend ${trendClass}">${trendIcon}</span>
            </div>
            <div class="gaip-widget-label">Climate Stress</div>
            ${trajectoryHTML}
            <div class="gaip-progress-bar">
                <div class="gaip-progress-fill ${currentStress <= 30 ? 'gaip-progress-green' : currentStress <= 60 ? 'gaip-progress-yellow' : 'gaip-progress-red'}" style="width: ${Math.min(currentStress, 100)}%"></div>
            </div>
            ${factorHTML}
        `;
    }

    function updateWeatherWidget(data) {
        const widget = document.querySelector('.gaip-widget-weather .gaip-widget-content');
        if (!widget) return;
        
        const temp = data?.temp ?? null;
        const humidity = data?.humidity ?? null;
        const forecast = data?.forecast ?? [];
        
        if (temp === null) {
            widget.innerHTML = '<div class="gaip-no-data">Weather data loading...</div>';
            return;
        }
        
        widget.innerHTML = `
            <div class="gaip-widget-value">${Math.round(temp)}<span class="gaip-widget-unit">°C</span></div>
            <div class="gaip-widget-label">Current · RH: ${humidity ? Math.round(humidity) + '%' : '--'}</div>
            ${forecast.length > 0 ? `
                <div class="gaip-mini-forecast">
                    ${forecast.slice(0, 3).map((day, i) => `
                        <div class="gaip-forecast-day">
                            <strong>${Math.round(day.max)}°</strong>
                            ${getDayName(i + 1)}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    function updateIrrigationWidget(data) {
        const widget = document.querySelector('.gaip-widget-irrigation .gaip-widget-content');
        if (!widget) return;
        
        const weeklyNeed = data?.weeklyNeed ?? null;
        const deficit = data?.deficit ?? null;
        
        if (weeklyNeed === null) {
            widget.innerHTML = '<div class="gaip-no-data">Run analysis to see irrigation needs</div>';
            return;
        }
        
        const needClass = weeklyNeed <= 5 ? 'gaip-severity-low' :
                         weeklyNeed <= 20 ? 'gaip-severity-moderate' : 'gaip-severity-high';
        
        widget.innerHTML = `
            <div class="gaip-widget-value ${needClass}">${Math.round(weeklyNeed)}<span class="gaip-widget-unit">mm</span></div>
            <div class="gaip-widget-label">Weekly requirement</div>
            ${deficit !== null ? `
                <div class="gaip-widget-sublabel">Deficit: ${Math.round(deficit)}mm</div>
            ` : ''}
        `;
    }

    function updateActionsWidget(data) {
        const widget = document.querySelector('.gaip-widget-actions .gaip-widget-content');
        if (!widget) return;
        
        const actions = data?.actions ?? [];
        
        if (actions.length === 0) {
            widget.innerHTML = '<div class="gaip-no-data">No urgent actions</div>';
            return;
        }
        
        widget.innerHTML = `
            <ul class="gaip-action-list">
                ${actions.slice(0, 4).map(action => {
                    const label = action.priority === 'high' ? 'Act' : action.priority === 'medium' ? 'Watch' : 'OK';
                    return `
                    <li>
                        <span class="gaip-action-priority gaip-priority-${action.priority}">${label}</span>
                        <span>${action.text}</span>
                    </li>
                `}).join('')}
            </ul>
        `;
    }

    function updatePGRWidget(data) {
        // Get or create PGR widget
        let widget = document.querySelector('.gaip-widget-pgr');
        const grid = document.querySelector('.gaip-dashboard-grid');
        
        // If no PGR data or no active program, remove widget if it exists
        if (!data || !data.isActive) {
            if (widget) {
                widget.remove();
            }
            return;
        }
        
        // Create widget if it doesn't exist
        if (!widget && grid) {
            const pgrWidget = document.createElement('div');
            pgrWidget.className = 'gaip-widget gaip-widget-pgr';
            pgrWidget.setAttribute('data-widget', 'pgr');
            pgrWidget.innerHTML = `
                <div class="gaip-widget-header">
                    <span class="gaip-widget-icon">🧪</span>
                    <span class="gaip-widget-title">PGR Status</span>
                </div>
                <div class="gaip-widget-content">
                    <div class="gaip-widget-loading">Loading...</div>
                </div>
            `;
            // Insert as last widget in grid
            grid.appendChild(pgrWidget);
            widget = pgrWidget;
        }
        
        const content = widget?.querySelector('.gaip-widget-content');
        if (!content) return;
        
        const daysRemaining = data.daysRemaining ?? null;
        const percentRemaining = data.percentRemaining ?? null;
        const suppressionPct = data.suppressionPct ?? null;
        const status = data.status ?? 'Unknown';
        const product = data.product ?? '';
        
        // Determine status class
        let statusClass = 'gaip-severity-low';
        if (status === 'Set Date') {
            statusClass = 'gaip-severity-moderate';
        } else if (status === 'Declining' || (suppressionPct !== null && suppressionPct < 20)) {
            statusClass = 'gaip-severity-moderate';
        } else if (status === 'Expired' || suppressionPct === 0) {
            statusClass = 'gaip-severity-high';
        }
        
        // Build display - prioritise suppression %, then days remaining
        let valueDisplay = '';
        let sublabelDisplay = '';
        
        if (status === 'Set Date') {
            valueDisplay = '⚙️';
        } else if (suppressionPct !== null) {
            // Show suppression as primary metric
            valueDisplay = `${suppressionPct}<span class="gaip-widget-unit">%</span>`;
            // Show days remaining as sublabel if available
            if (daysRemaining !== null && daysRemaining > 0) {
                sublabelDisplay = `~${daysRemaining} days remaining`;
            }
        } else if (daysRemaining !== null && daysRemaining > 0) {
            valueDisplay = `${daysRemaining}<span class="gaip-widget-unit">days</span>`;
        } else if (percentRemaining !== null) {
            valueDisplay = `${Math.round(percentRemaining)}<span class="gaip-widget-unit">%</span>`;
        } else {
            valueDisplay = status;
        }
        
        // Build label
        let labelDisplay = status;
        if (status === 'Set Date') {
            labelDisplay = 'Enter application date';
        } else if (suppressionPct !== null) {
            labelDisplay = status;  // Active, Declining, Expired
        }
        
        content.innerHTML = `
            <div class="gaip-widget-value ${statusClass}">${valueDisplay}</div>
            <div class="gaip-widget-label">${labelDisplay}</div>
            ${sublabelDisplay ? `<div class="gaip-widget-sublabel">${sublabelDisplay}</div>` : ''}
            ${product ? `<div class="gaip-widget-sublabel">${product}</div>` : ''}
            ${(function() {
                // v1.5.9: DMI combined risk warning band
                const dmi = data.dmiWarning;
                if (!dmi) return '';
                const colours = {
                    danger:  'background:var(--gaip-critical-bg);border-left:3px solid #dc2626;color:#991b1b;',
                    warning: 'background:var(--gaip-warning-bg);border-left:3px solid #d97706;color:#92400e;',
                    caution: 'background:var(--gaip-info-bg);border-left:3px solid #2563eb;color:#1e40af;'
                };
                const style = colours[dmi.level] || colours.caution;
                const rec = dmi.recommendation
                    ? `<div style="margin-top:4px;font-size:0.78em;">${dmi.recommendation}</div>`
                    : '';
                return `<div style="${style}padding:5px 7px;margin-top:6px;border-radius:3px;font-size:0.8em;line-height:1.35;">
                    <strong>DMI interaction</strong> — ${dmi.product || 'Active DMI'} (${dmi.pgrSuppression}% PGR suppression)
                    ${rec}
                </div>`;
            })()}
        `;
    }

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    function formatDiseaseName(name) {
        if (!name) return '';
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    function getDayName(daysFromNow) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return days[date.getDay()];
    }

    function generateActionItems() {
        const actions = [];
        
        // Check disease risk - use correct variable name
        const diseaseResult = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
        if (diseaseResult) {
            const overall = diseaseResult.overall ?? 0;
            if (overall > 50) {
                // Find top disease name
                let topDisease = 'disease';
                if (diseaseResult.diseases && diseaseResult.diseases.length > 0) {
                    topDisease = diseaseResult.diseases[0].name || 'disease';
                }
                actions.push({
                    priority: overall > 75 ? 'high' : 'medium',
                    text: `Preventive fungicide for ${formatDiseaseName(topDisease)}`
                });
            }
        }
        
        // Check stress - use correct variable name
        const trajectoryResult = global.GAIP_TRAJECTORY_RESULT || global.GAIP_StressTrajectory;
        if (trajectoryResult) {
            const stressIndex = trajectoryResult.summary?.currentScore ?? trajectoryResult.currentStress ?? 0;
            if (stressIndex > 50) {
                const stressAction = stressIndex > 75 
                    ? 'High stress (' + Math.round(stressIndex) + '%) - raise HOC, reduce N, syringe' 
                    : 'Stress elevated (' + Math.round(stressIndex) + '%) - monitor recovery rate';
                actions.push({
                    priority: stressIndex > 75 ? 'high' : 'medium',
                    text: stressAction
                });
            }
        }
        
        // Check irrigation
        const irrigResult = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
        if (irrigResult) {
            const deficit = irrigResult.currentDeficit ?? irrigResult.waterBalance?.deficit ?? 0;
            if (deficit > 10) {
                actions.push({
                    priority: 'high',
                    text: `Irrigate: ${Math.round(deficit)}mm deficit`
                });
            }
        }
        
        // Check PGR status
        const pgrResult = global.GAIP_PGR_RESULT || global.lastPGRStatus;
        if (pgrResult && pgrResult.status !== 'No application') {
            let pgrWarning = false;
            
            if (pgrResult.gddAccumulated !== undefined && pgrResult.gddThreshold) {
                const percentRemaining = ((pgrResult.gddThreshold - pgrResult.gddAccumulated) / pgrResult.gddThreshold) * 100;
                if (percentRemaining <= 20 && percentRemaining > 0) {
                    actions.push({
                        priority: 'medium',
                        text: 'PGR effect declining - plan reapplication'
                    });
                    pgrWarning = true;
                } else if (percentRemaining <= 0) {
                    actions.push({
                        priority: 'high',
                        text: 'PGR expired - reapply if needed'
                    });
                    pgrWarning = true;
                }
            } else if (pgrResult.projection?.effectEndsDate) {
                const endDate = new Date(pgrResult.projection.effectEndsDate);
                const today = new Date();
                const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining <= 3 && daysRemaining > 0) {
                    actions.push({
                        priority: 'medium',
                        text: `PGR expires in ${daysRemaining} days`
                    });
                    pgrWarning = true;
                } else if (daysRemaining <= 0) {
                    actions.push({
                        priority: 'high',
                        text: 'PGR expired - reapply if needed'
                    });
                    pgrWarning = true;
                }
            }
        }
        
        // Check growth potential
        if (global.climateMetrics && global.climateMetrics.growthPotential?.weighted < 0.3) {
            actions.push({
                priority: 'low',
                text: 'Low growth - reduce traffic if possible'
            });
        }
        
        // Check heat stress (v1.5.8) - critical for C3 turf survival
        const tempData = global.climateMetrics?.temperature || {};
        const maxTemp = tempData.max ?? tempData.maximum ?? null;
        const forecastMax = global.rawWeatherData?.daily?.temperature_2m_max?.slice(0, 3) || [];
        const peakForecastMax = forecastMax.length > 0 ? Math.max(...forecastMax) : null;
        const highestTemp = Math.max(maxTemp || 0, peakForecastMax || 0);
        
        // C3 grasses: critical above 35°C, severe damage above 40°C
        // C4 grasses: more tolerant but still stressed above 40°C
        const isC4 = global.GAIP_STATE?.turf?.isC4 || global.GAIP_STATE?.species?.isC4 || false;
        const criticalThreshold = isC4 ? 42 : 35;
        const severeThreshold = isC4 ? 45 : 40;
        
        if (highestTemp >= severeThreshold) {
            actions.push({
                priority: 'high',
                text: `🔥 CRITICAL: ${Math.round(highestTemp)}°C forecast - syringe cooling essential`
            });
        } else if (highestTemp >= criticalThreshold) {
            actions.push({
                priority: 'high',
                text: `Heat stress: ${Math.round(highestTemp)}°C - monitor closely, prepare syringing`
            });
        } else if (highestTemp >= 32 && !isC4) {
            actions.push({
                priority: 'medium',
                text: `Elevated temps (${Math.round(highestTemp)}°C) - ensure adequate irrigation`
            });
        }
        
        // Check phytotoxicity risk (v1.3.0)
        const phytoResult = global.GAIP_PHYTOTOXICITY_RESULT;
        if (phytoResult && phytoResult.overallRisk && phytoResult.overallRisk !== 'low' && phytoResult.overallRisk !== 'none') {
            // Get the highest-risk ion for specific messaging
            let riskIon = 'ions';
            if (phytoResult.assessments && phytoResult.assessments.length > 0) {
                // Find the highest-risk assessment
                const highRisk = phytoResult.assessments.find(a => a.status === 'high') || phytoResult.assessments[0];
                if (highRisk && highRisk.parameter) {
                    riskIon = highRisk.parameter.split(' ')[0]; // Get just "Sodium" or "Chloride"
                }
            }
            
            if (phytoResult.overallRisk === 'high') {
                actions.push({
                    priority: 'high',
                    text: `${riskIon} phytotoxicity risk - irrigate at night`
                });
            } else if (phytoResult.overallRisk === 'moderate') {
                actions.push({
                    priority: 'medium',
                    text: `${riskIon} approaching foliar damage threshold`
                });
            }
        }
        
        // If no actions, show a positive summary with context
        if (actions.length === 0) {
            const gp = global.climateMetrics?.growthPotential?.weighted ?? null;
            const gpText = gp !== null ? Math.round(gp * 100) + '% GP' : '';
            actions.push({
                priority: 'low',
                text: gpText ? 'On track - ' + gpText + ', no alerts' : 'All parameters within acceptable range'
            });
        }
        
        return actions;
    }

    // =========================================================================
    // DASHBOARD UPDATE
    // =========================================================================

    function updateDashboard() {
        log('Updating dashboard...');
        
        // Collect data from various sources
        const data = {
            growth: null,
            disease: null,
            stress: null,
            weather: null,
            irrigation: null,
            actions: null
        };
        
        // Growth data from climateMetrics
        // Note: climateMetrics uses .growth (not .growthPotential)
        //
        // v1.8.1 FIX: The Climate Engine v2 legacy shim overwrites the entire
        // window.climateMetrics object when computed.climate changes, wiping
        // the corrected GP values that hub-tissue synced. The shim writes
        // growthPotential.weighted = 0% (the pre-override value from the engine)
        // instead of the 99% that hub-tissue corrected.
        //
        // Fallback chain:
        //   1. climateMetrics.growth (correct if shim hasn't fired yet)
        //   2. GAIP_CLIMATE_V2_RESULT (set by hub-tissue, never wiped by shim)
        //   3. Give up — show placeholder
        if (global.climateMetrics || global.GAIP_CLIMATE_V2_RESULT) {
            const turfState = global.GAIP_STATE?.turf || global._hubState?.turf || {};
            const c3Frac = turfState.c3Fraction ?? (turfState.species?.c3Fraction) ??
                           (turfState.speciesFractions?.c3Fraction) ?? null;
            const c4Frac = turfState.c4Fraction ?? (turfState.species?.c4Fraction) ??
                           (turfState.speciesFractions?.c4Fraction) ?? null;

            // Primary: climateMetrics.growth (set by hub-tissue GP sync)
            let gpWeighted = global.climateMetrics?.growth?.weighted;
            let gpC3 = global.climateMetrics?.growth?.c3;
            let gpC4 = global.climateMetrics?.growth?.c4;

            // Fallback: GAIP_CLIMATE_V2_RESULT (stable — never overwritten by shim)
            if (gpWeighted == null || gpWeighted === 0) {
                const v2 = global.GAIP_CLIMATE_V2_RESULT;
                if (v2) {
                    const gp = v2.growthPotential;
                    const dr = v2.drought;
                    if (gp && typeof gp.adjustedGrowthPotential === 'number') {
                        gpWeighted = gp.adjustedGrowthPotential;
                        gpC3 = dr ? dr.gpC3 : (!gp.isC4 ? gp.baseGrowthPotential : null);
                        gpC4 = dr ? dr.gpC4 : (gp.isC4 ? gp.baseGrowthPotential : null);
                        // Respect species fractions — null out irrelevant species
                        if (c4Frac === 0) gpC4 = null;
                        if (c3Frac === 0) gpC3 = null;
                    } else if (dr && typeof dr.growthPotential === 'number') {
                        gpWeighted = dr.growthPotential;
                        gpC3 = dr.gpC3;
                        gpC4 = dr.gpC4;
                        if (c4Frac === 0) gpC4 = null;
                        if (c3Frac === 0) gpC3 = null;
                    }
                    if (gpWeighted != null) {
                        log('GP fallback: using GAIP_CLIMATE_V2_RESULT (' + gpWeighted + '%)');
                    }
                }
            }

            data.growth = {
                growthPotential: gpWeighted,
                c3: gpC3,
                c4: gpC4,
                c3Fraction: c3Frac,
                c4Fraction: c4Frac,
                gdd: global.climateMetrics?.gdd?.today
            };
            
            data.weather = {
                // FIX v10.9.6: prefer rawWeatherData current hour over climateMetrics.current
                temp: (function() { var raw = window.rawWeatherData; if (raw && raw.forecast && raw.forecast.hourly && raw.forecast.hourly.temperature_2m) { var h = new Date().getHours(); var arr = raw.forecast.hourly.temperature_2m; if (h < arr.length && arr[h] != null) return arr[h]; } return global.climateMetrics.temperature?.current ?? global.climateMetrics.temperature?.mean; })(),
                humidity: global.climateMetrics.moisture?.humidity?.mean 
                    ?? global.climateMetrics.humidity?.mean 
                    ?? global.climateMetrics.humidity
                    ?? null,
                forecast: global.climateMetrics.forecast?.daily || []
            };
        }
        
        // Also check rawWeatherData for weather if climateMetrics isn't populated
        if (!data.weather?.temp && global.rawWeatherData?.daily) {
            const daily = global.rawWeatherData.daily;
            data.weather = {
                temp: daily.temperature_2m_max?.[0] ?? null,
                humidity: global.rawWeatherData.hourly?.relative_humidity_2m?.[12] ?? null,
                forecast: daily.temperature_2m_max?.slice(1, 4).map((max, i) => ({
                    max: max,
                    min: daily.temperature_2m_min?.[i + 1]
                })) || []
            };
        }
        
        // Ensure humidity is populated from rawWeatherData if still missing
        if (data.weather && data.weather.humidity == null && global.rawWeatherData?.hourly?.relative_humidity_2m) {
            const rhData = global.rawWeatherData.hourly.relative_humidity_2m;
            // Get current hour's RH or calculate today's mean
            const now = new Date();
            const currentHour = now.getHours();
            data.weather.humidity = rhData[currentHour] ?? (rhData.slice(0, 24).reduce((a, b) => a + b, 0) / 24);
        }
        
        // Disease data - Hub uses GAIP_DISEASE_RESULT
        // v1.4.4: Also check DOM for rendered values to ensure dashboard matches disease card
        // v1.5.1: Validate species to prevent stale data after species switch
        // v1.5.5: Fix browntop bent matching - normalize both species before comparing
        // v1.5.6: Use effectiveSpecies for overseed scenarios (60% PRG on couch should match PRG diseases)
        const diseaseResult = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
        
        // Get current species for validation - use effectiveSpecies if overseed is dominant
        // v1.5.6: When overseed > 50%, disease engine uses overseed species, so dashboard should too
        let rawTurfSpecies;
        // Read effectiveSpecies directly from GAIP_STATE.turf first — this is always
        // current because hub-tissue writes it synchronously before dispatching events.
        // SpeciesController cache has 100ms stale tolerance which can cause mismatch
        // when the dashboard fires within that window after a species change.
        if (global.GAIP_STATE?.turf?.effectiveSpecies) {
            rawTurfSpecies = global.GAIP_STATE.turf.effectiveSpecies;
        } else if (global.SpeciesController && typeof global.SpeciesController.getEffectiveSpecies === 'function') {
            if (typeof global.SpeciesController.refresh === 'function') {
                global.SpeciesController.refresh();
            }
            rawTurfSpecies = global.SpeciesController.getEffectiveSpecies();
        } else {
            rawTurfSpecies = global.GAIP_STATE?.turf?.grassSpecies || global.GAIP_STATE?.turf?.species || '';
        }
        const currentTurfSpecies = normalizeSpeciesForComparison(rawTurfSpecies);
        const diseaseResultSpecies = normalizeSpeciesForComparison(diseaseResult?.species || '');
        
        // v1.5.5: Compare normalized species (bentgrass === bentgrass for both creeping and browntop)
        // b35fix166: Also treat empty currentTurfSpecies as a match — TurfProfile may not have
        // initialised yet when dashboard fires within 350ms of analysis-complete.
        // Also treat as match if result was written very recently (within 60s) — transient
        // species lag during first page load should never suppress the card.
        const _resultAge = diseaseResult?._writtenAt ? (Date.now() - diseaseResult._writtenAt) : Infinity;
        const _recentResult = _resultAge < 60000;
        const speciesMatch = !diseaseResultSpecies ||
            !currentTurfSpecies ||
            diseaseResultSpecies === currentTurfSpecies ||
            _recentResult;
        
        if (!speciesMatch) {
            log('Disease species mismatch - skipping stale data:', { diseaseResultSpecies, currentTurfSpecies });
        }
        
        // v2.10.2: Removed DOM scraping for disease data
        // DOM was showing forecast-pass values that differed from GAIP_DISEASE_RESULT (current analysis)
        // GAIP_DISEASE_RESULT is the authoritative source for current disease risk
        
        if (diseaseResult && speciesMatch) {
            // v1.5.6: Helper to check if a disease is beta (moved earlier to use for both current and forecast)
            // Beta diseases: Bipolaris (all species), Curvularia, Drechslera (Melting-Out), Waitea Patch
            function isDiseaseModelBeta(disease) {
                // Check explicit flags first
                if (disease.beta === true || disease.validationStatus === 'beta') {
                    return true;
                }
                // Check display name for BETA tag
                const displayName = disease.displayName || disease.name || disease.fullName || '';
                if (displayName.includes('BETA')) {
                    return true;
                }
                // Check disease key/id for known beta model patterns
                const diseaseKey = (disease.key || disease.id || disease.disease || '').toLowerCase();
                const diseaseName = displayName.toLowerCase();
                
                // Bipolaris models (all species: cynodontis, sorokiniana, etc.)
                if (diseaseKey.includes('bipolaris') || diseaseName.includes('bipolaris')) {
                    return true;
                }
                // Curvularia model
                if (diseaseKey.includes('curvularia') || diseaseName.includes('curvularia')) {
                    return true;
                }
                // Drechslera model (Melting-Out)
                if (diseaseKey.includes('drechslera') || diseaseName.includes('drechslera') || diseaseName.includes('melting-out') || diseaseName.includes('melting out')) {
                    return true;
                }
                // Waitea Patch (Rhizoctonia zeae) - beta model
                if (diseaseKey.includes('waitea') || diseaseName.includes('waitea')) {
                    return true;
                }
                
                return false;
            }
            
            // Find the highest risk disease
            // Disease engine uses: disease (id), displayName, riskScore, riskLevel, validationStatus
            // FIX v1.4.2: Exclude BETA diseases from overall pressure calculation
            let topDisease = null;
            let topRisk = 0;
            let topValidatedDisease = null;
            let topValidatedRisk = 0;
            
            if (diseaseResult.diseases && Array.isArray(diseaseResult.diseases)) {
                diseaseResult.diseases.forEach(d => {
                    // v1.4.5: Use adjustedRisk first (final calculated risk from disease engine)
                    const risk = d.adjustedRisk ?? d.riskScore ?? d.risk ?? d.riskPercent ?? d.pressure ?? 0;
                    // v1.5.6: Use comprehensive beta detection (includes name-based checks)
                    const isBeta = isDiseaseModelBeta(d);
                    
                    // Track top disease overall (for display)
                    if (risk > topRisk) {
                        topRisk = risk;
                        topDisease = d.displayName || d.name || d.disease;
                    }
                    
                    // Track top VALIDATED disease (for overall pressure rating)
                    if (!isBeta && risk > topValidatedRisk) {
                        topValidatedRisk = risk;
                        topValidatedDisease = d.displayName || d.name || d.disease;
                    }
                });
            }
            
            // Use validated disease risk for overall pressure (determines Low/Moderate/High/Critical)
            // v1.5.7: Only show VALIDATED (non-beta) diseases in display - never show beta diseases
            let overall = topValidatedRisk;
            
            // If no validated diseases have risk, fall back to 0 (Low)
            if (!overall) {
                overall = 0;
            }
            
            // v2.10.2: Use only GAIP_DISEASE_RESULT validated diseases - no DOM scraping
            let finalRisk = topValidatedRisk || 0;
            let finalDisease = topValidatedDisease || null;
            
            // v1.5.0: Extract forecast peak from disease forecast
            // v1.5.1: Validate forecast species matches current species to avoid stale data
            let forecastPeak = null;
            let peakDay = null;
            let forecastDisease = null;
            
            // First try the simplified _diseaseForecastData (set by disease-forecast.js v1.5.0)
            if (global._diseaseForecastData?.peakRisk) {
                // Validate species match - forecast stores species
                // v1.5.5: Use normalization for proper browntop bent matching
                // v1.5.6: Use effectiveSpecies for overseed scenarios
                const forecastSpecies = normalizeSpeciesForComparison(global.GAIP_DISEASE_FORECAST?.species || '');
                let currentSpeciesRaw;
                if (global.SpeciesController && typeof global.SpeciesController.getEffectiveSpecies === 'function') {
                    currentSpeciesRaw = global.SpeciesController.getEffectiveSpecies();
                } else if (global.GAIP_STATE?.turf?.effectiveSpecies) {
                    currentSpeciesRaw = global.GAIP_STATE.turf.effectiveSpecies;
                } else {
                    currentSpeciesRaw = global.GAIP_STATE?.turf?.grassSpecies || global.GAIP_STATE?.turf?.species || '';
                }
                const currentSpecies = normalizeSpeciesForComparison(currentSpeciesRaw);
                
                if (!forecastSpecies || forecastSpecies === currentSpecies) {
                    forecastPeak = global._diseaseForecastData.peakRisk;
                    peakDay = global._diseaseForecastData.peakDay;
                    forecastDisease = global._diseaseForecastData.topThreat;
                } else {
                    log('Forecast species mismatch:', { forecastSpecies, currentSpecies });
                }
            }
            
            // Fallback: Parse GAIP_DISEASE_FORECAST if summary data not available
            const forecastResult = global.GAIP_DISEASE_FORECAST;
            if (!forecastPeak && forecastResult?.diseases && Array.isArray(forecastResult.diseases)) {
                // Use the forecast's own top threat (already calculated correctly for current species)
                if (forecastResult.summary?.peakRisk) {
                    forecastPeak = forecastResult.summary.peakRisk;
                    peakDay = (forecastResult.summary.peakDay ?? 0) + 1;
                    forecastDisease = forecastResult.summary.topThreat;
                }
            }
            
            // v1.5.2: If forecast has a different top disease than current analysis,
            // AND that disease has a higher peak, show the forecast's top threat instead
            // This handles cases like Bipolaris on couch peaking later while Dollar Spot is current
            // v1.5.3: Exclude BETA diseases from forecast trajectory (use validated diseases only)
            let displayDisease = finalDisease;
            let displayCurrentRisk = finalRisk;
            
            // Find the top NON-BETA disease in the forecast
            let forecastValidatedPeak = null;
            let forecastValidatedDay = null;
            let forecastValidatedDisease = null;
            
            // v1.5.6: isDiseaseModelBeta() is now defined earlier and reused here
            
            if (global.GAIP_DISEASE_FORECAST?.diseases && Array.isArray(global.GAIP_DISEASE_FORECAST.diseases)) {
                global.GAIP_DISEASE_FORECAST.diseases.forEach(d => {
                    // Check if disease is beta using comprehensive detection
                    const isBeta = isDiseaseModelBeta(d);
                    
                    if (!isBeta && d.peakRisk > (forecastValidatedPeak || 0)) {
                        forecastValidatedPeak = d.peakRisk;
                        forecastValidatedDay = d.peakDay !== undefined ? d.peakDay + 1 : null;
                        forecastValidatedDisease = d.name || d.fullName;
                    }
                });
            }
            
            // Use validated forecast data instead of raw summary (which may include beta diseases)
            if (forecastValidatedPeak !== null) {
                forecastPeak = forecastValidatedPeak;
                peakDay = forecastValidatedDay;
                forecastDisease = forecastValidatedDisease;
                log('Forecast validated (non-beta) peak:', { forecastValidatedDisease, forecastValidatedPeak, forecastValidatedDay });
            }
            
            if (forecastValidatedDisease && forecastValidatedPeak > (finalRisk || 0) + 10) {
                // Forecast peak is significantly higher - show as warning alongside current disease
                // v2.10.2: Do NOT switch the primary display disease. Keep current top validated disease
                // as primary and show forecast as secondary trajectory warning.
                log('Forecast top threat differs:', { forecastValidatedDisease, forecastValidatedPeak, currentDisease: finalDisease, currentRisk: finalRisk });
            }
            
            // DOM fallback - read peak from disease forecast chart tooltip or data attributes
            if (!forecastPeak) {
                const chartContainer = document.querySelector('#gaip-disease-forecast-chart, .gaip-disease-forecast-chart');
                if (chartContainer) {
                    // Check for data attribute
                    const peakData = chartContainer.getAttribute('data-peak-risk');
                    const peakDayData = chartContainer.getAttribute('data-peak-day');
                    if (peakData) {
                        forecastPeak = parseInt(peakData, 10);
                        peakDay = peakDayData ? parseInt(peakDayData, 10) : null;
                    }
                }
            }
            
            log('Disease data:', { 
                overallRisk: diseaseResult.overallRisk, 
                topRisk: topRisk, 
                topDisease: topDisease,
                topValidatedRisk: topValidatedRisk,
                topValidatedDisease: topValidatedDisease,
                // domData removed in v2.10.2
                forecastPeak: forecastPeak,
                peakDay: peakDay,
                displayDisease: displayDisease,
                displayCurrentRisk: displayCurrentRisk,
                usingOverall: finalRisk 
            });
            
            data.disease = {
                overall: finalRisk,
                topDisease: displayDisease,
                topRisk: displayCurrentRisk,
                forecastPeak: forecastPeak,
                forecastDisease: forecastValidatedDisease || null,  // v2.10.2: Track which disease peaks in forecast
                peakDay: peakDay,
                isForecastOverride: false  // v2.10.2: No longer override - always show current disease
            };
        }
        
        // Stress data - Hub uses GAIP_TRAJECTORY_RESULT or GAIP_CLIMATE_STRESS_RESULT
        const trajectoryResult = global.GAIP_TRAJECTORY_RESULT || global.GAIP_StressTrajectory;
        const climateStressResult = global.GAIP_CLIMATE_STRESS_RESULT;
        
        if (trajectoryResult) {
            data.stress = {
                stressIndex: trajectoryResult.summary?.currentScore ?? trajectoryResult.currentStress ?? null,
                trend: trajectoryResult.summary?.trend ?? trajectoryResult.trend ?? null,
                peakStress: trajectoryResult.summary?.peakScore ?? null,
                peakDay: trajectoryResult.summary?.peakDay ?? null,
                factors: trajectoryResult.currentComponents ?? null
            };
        }
        
        // v1.5.9: Also check climate stress result (for golf turf)
        if (climateStressResult && (!data.stress?.stressIndex || climateStressResult.currentStress > (data.stress?.stressIndex || 0))) {
            data.stress = {
                stressIndex: climateStressResult.currentStress,
                trend: climateStressResult.peakStress > climateStressResult.currentStress + 10 ? 'RISING' : 
                       climateStressResult.peakStress < climateStressResult.currentStress - 10 ? 'FALLING' : 'STABLE',
                peakStress: climateStressResult.peakStress,
                peakDay: climateStressResult.peakDay
            };
            log('Using climate stress result:', data.stress);
        }
        
        // Also check orchestrator state for stress (fallback)
        if (!data.stress?.stressIndex && global.GaipOrchestrator) {
            const orchState = global.GaipOrchestrator.getState?.();
            if (orchState?.derived) {
                data.stress = {
                    stressIndex: orchState.derived.environmentalStressIndex ?? null,
                    trend: null,
                    peakStress: null,
                    peakDay: null
                };
            }
        }
        
        // Irrigation data - check multiple sources
        // IrrigationScheduler returns: { schedule: [...], summary: { totalIrrigation, ... }, waterBalance: { deficit, ... } }
        const irrigResult = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
        if (irrigResult) {
            // Prefer summary.totalIrrigation, fallback to summing schedule
            let weeklyNeed = irrigResult.weeklyNeed 
                ?? irrigResult.summary?.totalIrrigation 
                ?? (irrigResult.schedule?.reduce((sum, d) => sum + (d.irrigation?.totalDepth || 0), 0));
            
            data.irrigation = {
                weeklyNeed: weeklyNeed,
                deficit: irrigResult.currentDeficit ?? irrigResult.waterBalance?.deficit ?? irrigResult.summary?.netDeficit
            };
        }
        
        // PGR data - check GAIP_STATE and PGR module results
        const pgrResult = global.GAIP_PGR_RESULT || global.lastPGRStatus;
        const pgrState = global.GAIP_STATE?.pgr;
        
        // Fallback: read PGR product directly from DOM if GAIP_STATE not ready
        const pgrProductFromDOM = document.querySelector('.gaip-pgr-product')?.value || 
                                  document.querySelector('[name="pgr_product"]')?.value ||
                                  document.querySelector('select[class*="pgr"]')?.value;
        const pgrProduct = pgrState?.productType || pgrProductFromDOM;
        
        log('PGR detection:', { 
            pgrResult: !!pgrResult, 
            pgrState: !!pgrState,
            pgrProduct: pgrProduct,
            fromDOM: pgrProductFromDOM,
            fromState: pgrState?.productType
        });
        
        if (pgrResult && pgrResult.success !== false) {
            // Calculate days remaining from GDD if available
            // PGR module returns: { gdd: { accumulated, threshold, remaining, progressPct }, effect: { suppression, suppressionPct, reapplicationStatus } }
            let daysRemaining = null;
            let percentRemaining = null;
            let suppressionPct = null;
            let status = 'Active';
            
            // Extract from nested gdd object (PGR module v2 structure)
            const gddData = pgrResult.gdd || {};
            const effectData = pgrResult.effect || {};
            const gddAccumulated = gddData.accumulated ?? pgrResult.gddAccumulated;
            const gddThreshold = gddData.threshold ?? pgrResult.gddThreshold;
            const gddRemaining = gddData.remaining ?? (gddThreshold - gddAccumulated);
            
            // Get suppression directly from effect object
            suppressionPct = effectData.suppressionPct ?? Math.round((effectData.suppression || 0) * 100);
            
            if (gddAccumulated !== undefined && gddThreshold) {
                percentRemaining = Math.max(0, Math.min(100, (gddRemaining / gddThreshold) * 100));
                
                // Estimate days remaining based on recent GDD rate
                const avgDailyGDD = pgrResult.avgDailyGDD || gddData.avgDaily || 15; // Default ~15 GDD/day
                if (avgDailyGDD > 0) {
                    daysRemaining = Math.ceil(gddRemaining / avgDailyGDD);
                }
                
                // Determine status from effect.reapplicationStatus or calculate
                const reappStatus = effectData.reapplicationStatus;
                if (reappStatus === 'expired' || percentRemaining <= 0) {
                    status = 'Expired';
                } else if (reappStatus === 'approaching' || percentRemaining < 30 || suppressionPct < 20) {
                    status = 'Declining';
                } else if (reappStatus === 'recent') {
                    status = 'Active';
                } else {
                    status = 'Active';
                }
            } else if (pgrResult.projection?.effectEndsDate) {
                // Calculate days from end date
                const endDate = new Date(pgrResult.projection.effectEndsDate);
                const today = new Date();
                daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining <= 0) {
                    status = 'Expired';
                    daysRemaining = 0;
                } else if (daysRemaining <= 3) {
                    status = 'Declining';
                }
            }
            
            // Get product name - handle both object and string forms
            const productObj = pgrResult.product;
            const productName = (productObj && typeof productObj === 'object')
                ? (productObj.name || productObj.code || pgrProduct || '')
                : (productObj || pgrProduct || '');
            
            data.pgr = {
                isActive: true,
                status: status,
                daysRemaining: daysRemaining,
                percentRemaining: percentRemaining,
                suppressionPct: suppressionPct,
                product: productName
            };

            // v1.5.9: DMI combined risk warning — reads from pgrResult.dmi (set by
            // hub-orchestrator v1.10.0 pure-function path) or falls back to
            // window.GAIP_COMBINED_SUPPRESSION (set by hub-tissue-v3.js legacy path).
            // Both paths produce identical combinedRisk shape from GAIP_DMI.assessCombinedRisk().
            const dmiCombined = pgrResult.dmi?.combinedRisk || global.GAIP_COMBINED_SUPPRESSION;
            const dmiStatus   = pgrResult.dmi?.status      || global.GAIP_DMI_RESULT;
            if (dmiCombined?.hasCombinedRisk) {
                data.pgr.dmiWarning = {
                    level:          dmiCombined.warningLevel,    // 'caution' | 'warning' | 'danger'
                    message:        dmiCombined.message,
                    recommendation: dmiCombined.recommendation,
                    product:        dmiStatus?.product?.name || null,
                    pgrSuppression: dmiCombined.pgrSuppression   // integer %
                };
            }

            log('PGR data mapped:', data.pgr);
        } else if (pgrProduct && pgrState?.applicationDate) {
            // PGR configured but no result yet - show as pending
            data.pgr = {
                isActive: true,
                status: 'Pending',
                daysRemaining: null,
                percentRemaining: null,
                product: pgrProduct
            };
        } else if (pgrProduct) {
            // Product selected but no application date - prompt user
            data.pgr = {
                isActive: true,
                status: 'Set Date',
                daysRemaining: null,
                percentRemaining: null,
                product: pgrProduct
            };
        } else {
            data.pgr = { isActive: false };
        }
        
        // Generate action items (v1.8.0: retired - now handled by Priority Queue)
        // data.actions removed - PriorityQueue collectors are the SSOT
        
        log('Data collected:', data);
        
        // Update each widget
        updateGrowthWidget(data.growth);
        updateDiseaseWidget(data.disease);
        updateStressWidget(data.stress);
        updateWeatherWidget(data.weather);
        updateIrrigationWidget(data.irrigation);
        updatePGRWidget(data.pgr);
        
        // Update timestamp
        _lastUpdate = new Date();
        const updatedEl = document.querySelector('.gaip-dashboard-updated');
        if (updatedEl) {
            updatedEl.textContent = `Updated ${formatTime(_lastUpdate)}`;
        }
        
        // v1.9.0: Update data quality footer
        updateDataQualityFooter();
        
        log('Dashboard updated');
        
        // v1.0.0: Refresh priority action queue after dashboard update
        if (global.GilbaPriorityQueue && global.GilbaPriorityQueue.refresh) {
            try {
                global.GilbaPriorityQueue.refresh();
            } catch (e) {
                log('Priority queue refresh error: ' + e.message);
            }
        }

        // SDS autumn treatment window alert
        updateSDSAlert();

        // Companion surface disease alerts (fairway/tee)
        injectCompanionSelector();
        updateCompanionDiseaseAlert();
    }

    // =========================================================================
    // SDS AUTUMN TREATMENT WINDOW ALERT
    // Surfaces when soil temp is 16-24°C (falling in autumn) and a C4 species
    // is active. Spring Dead Spot must be prevented — no curative options.
    // =========================================================================

    function updateSDSAlert() {
        const slot = document.getElementById('gaip-dashboard-actions-slot');
        if (!slot) return;

        // Find existing SDS alert or create container
        let sdsAlert = document.getElementById('gaip-sds-window-alert');

        const diseaseResult = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
        if (!diseaseResult || !diseaseResult.diseases) {
            if (sdsAlert) sdsAlert.remove();
            return;
        }

        const sds = diseaseResult.diseases.find(d =>
            d.disease === 'springDeadSpot' || d.displayName === 'Spring Dead Spot'
        );
        if (!sds) {
            if (sdsAlert) sdsAlert.remove();
            return;
        }

        const tw = sds.treatmentWindow;
        if (!tw) {
            if (sdsAlert) sdsAlert.remove();
            return;
        }

        const soilTemp = tw.soilTemp;
        const inWindow = tw.inWindow;
        const estimated = tw.soilTempEstimated;

        // Only show alert when within or approaching the window (soil < 28°C, C4 species)
        // Don't show in summer when soil is >28°C — not relevant yet
        if (soilTemp == null || soilTemp > 28) {
            if (sdsAlert) sdsAlert.remove();
            return;
        }

        // Colour scheme based on window state
        let bg, border, icon, title, message;
        if (inWindow) {
            // 16–24°C: window is open — AMBER urgent
            bg = 'var(--gaip-warning-bg)'; border = '#f59e0b'; icon = '⚠️';
            title = 'Spring Dead Spot — Treatment Window Open';
            message = `Soil temperature ${soilTemp}°C${estimated ? ' (est.)' : ''} is within the preventive application window (16–24°C). Apply fungicide now — SDS cannot be treated curatively. Two applications 28 days apart for high-risk sites.`;
        } else if (soilTemp > 24 && soilTemp <= 28) {
            // 24–28°C: approaching — informational
            bg = 'var(--gaip-good-bg)'; border = '#22c55e'; icon = 'ℹ️';
            title = 'Spring Dead Spot — Window Approaching';
            message = `Soil temperature ${soilTemp}°C${estimated ? ' (est.)' : ''}. Window opens at 24°C (soil falling). Monitor soil temperature — plan fungicide program now for high-risk sites.`;
        } else {
            // <16°C: window has closed
            bg = 'var(--gaip-info-bg)'; border = '#7c3aed'; icon = '📅';
            title = 'Spring Dead Spot — Window Has Closed';
            message = `Soil temperature ${soilTemp}°C${estimated ? ' (est.)' : ''} — below treatment threshold (16°C). Next opportunity: autumn when soil cools to 24°C.`;
        }

        const html = `
            <div id="gaip-sds-window-alert" style="
                background: ${bg};
                border-left: 4px solid ${border};
                border-radius: 6px;
                padding: 12px 16px;
                margin-top: 12px;
                font-size: 13px;
                line-height: 1.5;
            ">
                <div style="font-weight: 600; margin-bottom: 4px;">${icon} ${title}</div>
                <div style="color: var(--gaip-text);">${message}</div>
                <div style="font-size: 11px; color: var(--gaip-text-secondary); margin-top: 6px;">
                    Source: Tredway et al. 2020; Hutchens et al. 2024 — <em>Ophiosphaerella narmari</em> (AU primary pathogen)
                </div>
            </div>`;

        if (sdsAlert) {
            sdsAlert.outerHTML = html;
        } else {
            slot.insertAdjacentHTML('beforeend', html);
        }
    }

    // =========================================================================
    // COMPANION SURFACE SELECTOR
    // Appears below the golf subcategory selector when greens is selected.
    // Lets user pick fairway/tee species for parallel disease analysis.
    // =========================================================================

    // b35fix122: hoisted to outer IIFE scope from injectCompanionSelector() so both
    // _registerRestoreOnce() and the gaip:site-changed handler can reference these
    // without a ReferenceError. Previously all three were defined inside
    // injectCompanionSelector() — fine for calls within that function, but the
    // site-changed handler at outer scope could not reach them.
    var _companionRestoring = false;

    function restoreCompanionSpecies() {
        var siteId = null;
        // b35fix272: GAIP_SiteContext is the single source of truth
        siteId = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId ? global.GAIP_SampleManager.getActiveSiteId() : null);
        if (!siteId) {
            var siteEl = document.querySelector('.gaip-site-option.active[data-site-id]');
            siteId = siteEl ? siteEl.dataset.siteId : null;
        }
        if (siteId && global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getConfig === 'function') {
            var saved = global.GAIP_SiteConfig.getConfig(siteId);
            var el = document.getElementById('gaip-companion-species');
            if (el && saved && saved.turf) {
                // b35fix112: set value without firing change event to avoid
                // triggering computeAll → orchestrator-complete → restore loop
                _companionRestoring = true;
                el.value = saved.turf.companionSpecies || '';
                _companionRestoring = false;
            }
        }
    }

    function _registerRestoreOnce() {
        document.addEventListener('gaip:orchestrator-complete', function _restoreOnce() {
            restoreCompanionSpecies();
            document.removeEventListener('gaip:orchestrator-complete', _restoreOnce);
        });
    }

    function injectCompanionSelector() {
        const turfTypeEl = document.querySelector('.gaip-turf-type-option.selected');
        const turfType = turfTypeEl ? turfTypeEl.dataset.type : '';
        const subCatEl = document.querySelector('.gaip-subcategory-option.selected');
        const subCat = subCatEl ? (subCatEl.dataset.surface || subCatEl.dataset.sport || '') : '';

        const shouldShow = (turfType === 'golf' && subCat === 'greens');
        const existing = document.getElementById('gaip-companion-selector');

        // Remove if no longer on golf greens
        if (!shouldShow) {
            if (existing) existing.remove();
            global.GAIP_COMPANION_DISEASE_RESULT = null;
            return;
        }

        // Already injected
        if (existing) return;

        // Find anchor: insert AFTER the turf profile card (not inside it — card body is collapsed)
        const anchor = document.querySelector('.gaip-turf-profile-card');
        if (!anchor) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'gaip-companion-selector';
        wrapper.style.cssText = 'margin-top:10px; margin-bottom:4px; padding:10px 12px; background:var(--gaip-good-bg); border:1px solid var(--gaip-good-bg); border-radius:6px; font-size:13px;';
        wrapper.innerHTML = `
            <label style="font-weight:600; color:#166534; display:block; margin-bottom:6px;">
                ⛳ Fairway / Tee Species (companion disease analysis)
            </label>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
                <select id="gaip-companion-species" style="flex:1; padding:6px 10px; border:1px solid var(--gaip-border); border-radius:4px; font-size:13px; background:var(--gaip-surface); color:var(--gaip-text);">
                    <option value="">— None (greens only) —</option>
                    <option value="couch">Couch (Bermudagrass)</option>
                    <option value="kikuyu">Kikuyu</option>
                    <option value="zoysia">Zoysia</option>
                    <option value="buffalo">Buffalo (St Augustine)</option>
                </select>
                <button type="button" id="gaip-companion-save-btn" style="padding:6px 12px; background:var(--gaip-accent); color:#fff; border:none; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;">Save</button>
            </div>
            <div style="font-size:11px; color:var(--gaip-text-secondary); margin-top:2px;">
                Select species then click Save to persist. Greens analysis is unaffected.
            </div>
        `;

        anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);


        // _companionRestoring and restoreCompanionSpecies are defined at outer IIFE
        // scope (b35fix122) so _registerRestoreOnce() and the site-changed handler
        // can call restoreCompanionSpecies() without a ReferenceError.
        // Try immediately (page load — persistence already ready)
        restoreCompanionSpecies();
        // b35fix112: restore on first gaip:orchestrator-complete only — selector is injected
        // _registerRestoreOnce() is defined at outer IIFE scope (b35fix122 hoist).
        // Registers a one-shot orchestrator-complete listener to restore companion species.
        _registerRestoreOnce();
        // Trigger re-analysis when species changes
        const sel = document.getElementById('gaip-companion-species');
        if (sel) {
            sel.addEventListener('change', function() {
                // Skip if we're restoring (value set programmatically)
                if (_companionRestoring) return;
                // Re-run hub orchestrator so companion disease pass fires
                if (global.GaipOrchestrator && typeof global.GaipOrchestrator.computeAll === 'function') {
                    global.GaipOrchestrator.computeAll();
                } else if (global.HubOrchestrator && typeof global.HubOrchestrator.computeAll === 'function') {
                    global.HubOrchestrator.computeAll();
                }
                // Write companionSpecies directly to localStorage — bypasses all timing guards.
                // GAIP_SiteConfig event system has too many race conditions for this use case.
                var value = sel.value || '';
                var siteId = global.GAIP_SiteContext
                    ? global.GAIP_SiteContext.getSiteId()
                    : (global.GAIP_SampleManager ? global.GAIP_SampleManager.getActiveSiteId() : null);
                if (siteId && siteId !== 'default') {
                    try {
                        var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;
                        var raw = _ls.getItem('gilba_hub_site_configs');
                        var configs = raw ? JSON.parse(raw) : {};
                        if (!configs[siteId]) configs[siteId] = { turf: {} };
                        if (!configs[siteId].turf) configs[siteId].turf = {};
                        configs[siteId].turf.companionSpecies = value;
                        _ls.setItem('gilba_hub_site_configs', JSON.stringify(configs));
                        console.log('[companion] saved "' + value + '" for site', siteId);
                    } catch(e) {
                        console.warn('[companion] save failed:', e);
                    }
                }
            });
        }

        // Save button — direct save bypassing all timing guards
        var saveBtn = document.getElementById('gaip-companion-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                var compEl = document.getElementById('gaip-companion-species');
                if (!compEl) return;
                var value = compEl.value || '';
                var SM = global.GAIP_SampleManager;
                var siteId = global.GAIP_SiteContext
                    ? global.GAIP_SiteContext.getSiteId()
                    : (SM ? SM.getActiveSiteId() : null);
                if (!siteId || siteId === 'default') return;
                // Write directly into SiteConfig store
                if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.setCompanionSpecies === 'function') {
                    global.GAIP_SiteConfig.setCompanionSpecies(siteId, value);
                } else {
                    // Fallback: dispatch save event (may be blocked by timing guards)
                    document.dispatchEvent(new CustomEvent('gaip:config-save-requested'));
                }
                // Visual feedback
                saveBtn.textContent = '✓ Saved';
                saveBtn.style.background = 'var(--gaip-good)';
                setTimeout(function() {
                    saveBtn.textContent = 'Save';
                    saveBtn.style.background = 'var(--gaip-accent)';
                }, 1500);
                log('Companion species saved directly: "' + value + '" for site', siteId);
            });
        }

        // b35fix118a: element now exists — restore immediately so page-load case
        // (where the early immediate call above found no element) always works.
        restoreCompanionSpecies();
        var _restored = document.getElementById('gaip-companion-species');
        if (_restored) {
            console.log('[companion] restore result:', _restored.value || '(none)');
        }
        log('Companion selector injected + restore attempted');
    }

    // b35fix118a: on site-switch the selector element SURVIVES (only removed when
    // shouldShow → false).  injectCompanionSelector() returns early at
    // `if (existing) return` so restoreCompanionSpecies() is never called from
    // the inject path.  The _registerRestoreOnce listener handles it, but to
    // guarantee restore even if orchestrator-complete fires before SiteConfig
    // is ready, we also call restoreCompanionSpecies() directly from the
    // gaip:site-changed handler after a short delay.
    document.addEventListener('gaip:site-changed', function() {
        setTimeout(function() {
            var el = document.getElementById('gaip-companion-species');
            if (el) {
                // Selector already exists — restore now (site-switch survivor path)
                var siteId = null;
                // b35fix272: GAIP_SiteContext is the single source of truth
                siteId = global.GAIP_SiteContext ? global.GAIP_SiteContext.getSiteId() : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId ? global.GAIP_SampleManager.getActiveSiteId() : null);
                if (!siteId) {
                    var siteEl = document.querySelector('.gaip-site-option.active[data-site-id]');
                    siteId = siteEl ? siteEl.dataset.siteId : null;
                }
                if (siteId && global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getConfig === 'function') {
                    var saved = global.GAIP_SiteConfig.getConfig(siteId);
                    if (saved && saved.turf) {
                        el.value = saved.turf.companionSpecies || '';
                        console.log('[companion] site-switch restore:', el.value || '(none)', 'for site', siteId);
                    }
                }
            }
            // Also queue one-shot for after orchestrator-complete in case SiteConfig
            // wasn't ready at the 300ms mark above.
            _registerRestoreOnce();
        }, 300);
    });

    // =========================================================================
    // COMPANION SURFACE DISEASE ALERTS
    // Renders fairway/tee disease alerts from GAIP_COMPANION_DISEASE_RESULT.
    // Displayed below the greens SDS alert in gaip-dashboard-actions-slot.
    // =========================================================================

    function updateCompanionDiseaseAlert() {
        const slot = document.getElementById('gaip-dashboard-actions-slot');
        if (!slot) return;

        const result = global.GAIP_COMPANION_DISEASE_RESULT;

        if (!result || !result.diseases || !result._companionSurface) {
            const wrapper = document.getElementById('gaip-companion-disease-wrapper');
            if (wrapper) wrapper.innerHTML = '';
            return;
        }

        const speciesLabel = result._companionDisplayName || result._companionSpecies || 'Fairway/Tee';

        // Filter to diseases worth showing — risk > 0 or treatment windows open
        const relevant = result.diseases.filter(d => {
            const risk = d.adjustedRisk ?? d.riskScore ?? 0;
            const windowOpen = d.treatmentWindow?.inWindow === true;
            return risk > 15 || windowOpen || d.disease === 'springDeadSpot';
        });

        if (relevant.length === 0) {
            if (block) block.remove();
            return;
        }

        // Sort: treatment windows first, then by risk descending
        relevant.sort((a, b) => {
            const aWindow = a.treatmentWindow?.inWindow ? 1 : 0;
            const bWindow = b.treatmentWindow?.inWindow ? 1 : 0;
            if (bWindow !== aWindow) return bWindow - aWindow;
            return (b.adjustedRisk ?? b.riskScore ?? 0) - (a.adjustedRisk ?? a.riskScore ?? 0);
        });

        const riskColour = r => r >= 70 ? '#ef4444' : r >= 40 ? '#f59e0b' : '#22c55e';
        const riskLabel  = r => r >= 70 ? 'High' : r >= 40 ? 'Moderate' : 'Low';

        let rows = '';
        relevant.forEach(d => {
            const risk = d.adjustedRisk ?? d.riskScore ?? 0;
            const colour = riskColour(risk);
            const label  = riskLabel(risk);
            const tw = d.treatmentWindow;
            let windowNote = '';
            if (tw) {
                if (tw.inWindow) {
                    windowNote = `<span style="color:#b45309; font-weight:600;"> ⚠️ Treatment window open — soil ${tw.soilTemp}°C${tw.soilTempEstimated ? ' (est.)' : ''}</span>`;
                } else if (tw.soilTemp != null && tw.soilTemp > 16 && tw.soilTemp < 24) {
                    windowNote = `<span style="color:var(--gaip-text-secondary);"> Soil ${tw.soilTemp}°C${tw.soilTempEstimated ? ' (est.)' : ''} — ${tw.timing || ''}</span>`;
                }
                if (tw.timing && !tw.inWindow) {
                    windowNote = `<span style="color:var(--gaip-text-secondary); font-size:11px;"> ${tw.timing}</span>`;
                }
            }
            rows += `
                <div style="display:flex; align-items:baseline; gap:8px; padding:5px 0; border-bottom:1px solid var(--gaip-surface-hover);">
                    <span style="min-width:16px; height:16px; border-radius:50%; background:${colour}; display:inline-block; margin-top:2px; flex-shrink:0;"></span>
                    <div>
                        <span style="font-weight:600;">${d.displayName || d.name}</span>
                        <span style="color:var(--gaip-text-secondary); font-size:12px;"> — ${label} (${Math.round(risk)}%)</span>
                        ${windowNote}
                    </div>
                </div>`;
        });

        const html = `
            <div id="gaip-companion-disease-block" style="
                background:var(--gaip-info-bg);
                border-left:4px solid #6366f1;
                border-radius:6px;
                padding:12px 16px;
                margin-top:10px;
                font-size:13px;
            ">
                <div style="font-weight:600; margin-bottom:8px; color:#3730a3;">
                    ⛳ ${speciesLabel} Fairway/Tee — Disease Alerts
                </div>
                ${rows}
                <div style="font-size:11px; color:var(--gaip-text-muted); margin-top:8px;">
                    Based on current weather conditions. Greens soil/tissue data not applied to this assessment.
                </div>
            </div>`;

        // Use a wrapper div to avoid stale outerHTML reference
        let wrapper = document.getElementById('gaip-companion-disease-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'gaip-companion-disease-wrapper';
            slot.appendChild(wrapper);
        }
        wrapper.innerHTML = html;
    }

    // =========================================================================
    // DATA QUALITY FOOTER
    // =========================================================================
    
    function updateDataQualityFooter() {
        const footer = document.getElementById('gaip-dashboard-footer');
        if (!footer) return;
        
        const sources = [];
        
        // Weather data freshness
        const weatherTs = global.rawWeatherData?.generatedAt || global.rawWeatherData?.timestamp;
        if (weatherTs) {
            const age = getDataAge(weatherTs);
            sources.push({ label: 'Weather', fresh: age < 60, stale: age < 360 });
        } else if (global.rawWeatherData) {
            sources.push({ label: 'Weather', fresh: true, stale: true });
        }
        
        // Soil data
        const soilData = global.GAIP_STATE?.soil?.ppm;
        const hasSoil = soilData && Object.values(soilData).some(v => v > 0);
        if (hasSoil) {
            sources.push({ label: 'Soil', fresh: true, stale: true });
        }
        
        // Tissue data
        const tissueData = global.GAIP_STATE?.tissue?.results;
        const hasTissue = tissueData && Object.values(tissueData).some(v => v > 0);
        if (hasTissue) {
            sources.push({ label: 'Tissue', fresh: true, stale: true });
        }
        
        // Water data
        const waterData = global.GAIP_STATE?.water;
        const hasWater = waterData && (waterData.ec > 0 || waterData.sar > 0);
        if (hasWater) {
            sources.push({ label: 'Water', fresh: true, stale: true });
        }
        
        // Sensor data
        const sensorData = global.GAIP_CANONICAL_STATE?.sensor;
        if (sensorData && sensorData.soilTemp != null) {
            sources.push({ label: 'Sensor', fresh: true, stale: true });
        }
        
        if (sources.length === 0) {
            footer.style.display = 'none';
            return;
        }
        
        footer.style.display = 'flex';
        
        let sourcesHTML = '<div class="gaip-dq-sources">';
        sources.forEach(s => {
            const dotClass = s.fresh ? 'gaip-dq-fresh' : (s.stale ? 'gaip-dq-stale' : 'gaip-dq-missing');
            sourcesHTML += `<span><span class="gaip-dq-dot ${dotClass}"></span>${s.label}</span>`;
        });
        sourcesHTML += '</div>';
        
        const timeStr = _lastUpdate ? formatTime(_lastUpdate) : '--';
        footer.innerHTML = `
            ${sourcesHTML}
            <span>Last analysis: ${timeStr}</span>
        `;
    }
    
    function getDataAge(timestamp) {
        // Returns age in minutes
        if (!timestamp) return Infinity;
        const ts = new Date(timestamp);
        if (isNaN(ts.getTime())) return Infinity;
        return Math.round((Date.now() - ts.getTime()) / 60000);
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function initDashboard() {
        log('Initializing Daily Dashboard v' + CONFIG.version);
        
        // Inject styles
        injectDashboardStyles();

        // Delegated click handler for companion save button — survives re-renders
        document.addEventListener('click', function(e) {
            if (!e.target || e.target.id !== 'gaip-companion-save-btn') return;
            var compEl = document.getElementById('gaip-companion-species');
            if (!compEl) return;
            var value = compEl.value || '';
            var siteId = global.GAIP_SiteContext
                ? global.GAIP_SiteContext.getSiteId()
                : (global.GAIP_SampleManager ? global.GAIP_SampleManager.getActiveSiteId() : null);
            if (!siteId || siteId === 'default') return;
            if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.setCompanionSpecies === 'function') {
                global.GAIP_SiteConfig.setCompanionSpecies(siteId, value);
            }
            e.target.textContent = '✓ Saved';
            e.target.style.background = 'var(--gaip-good)';
            setTimeout(function() {
                var btn = document.getElementById('gaip-companion-save-btn');
                if (btn) { btn.textContent = 'Save'; btn.style.background = 'var(--gaip-accent)'; }
            }, 1500);
            log('Companion species saved (delegated): "' + value + '" for site', siteId);
        });
        
        // Find insertion point (before the main grid)
        const hub = document.getElementById('gaip-hub');
        const grid = document.querySelector('.gaip-grid');
        
        if (!hub || !grid) {
            log('Hub or grid not found - deferring initialization');
            return;
        }
        
        // Check for existing dashboard
        if (document.getElementById('gaip-daily-dashboard')) {
            log('Dashboard already exists');
            return;
        }
        
        // Insert dashboard HTML before the grid
        const dashboardWrapper = document.createElement('div');
        dashboardWrapper.innerHTML = createDashboardHTML();
        const dashboard = dashboardWrapper.firstElementChild;
        
        hub.insertBefore(dashboard, grid);
        _dashboardEl = dashboard;
        
        // Bind toggle
        const toggleBtn = dashboard.querySelector('.gaip-dashboard-toggle');
        const header = dashboard.querySelector('.gaip-dashboard-header');
        
        if (header) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.gaip-dashboard-toggle') || e.target === header) {
                    toggleDashboard();
                }
            });
        }
        
        // Load cached data immediately
        loadCachedData();
        
        // Bind to analysis events (hub uses hyphenated event names)
        // v1.4.3: Increased delay to 350ms to wait for DiseaseForecast completion (~300ms)
        document.addEventListener('gaip:analysis-complete', () => {
            log('Received gaip:analysis-complete event');
            setTimeout(updateDashboard, 350);
        });
        
        // Listen for disease-specific updates - use event detail for freshest data
        document.addEventListener('gaip:disease-updated', (e) => {
            log('Received gaip:disease-updated event');
            // v1.4.3: If event contains result, update GAIP_DISEASE_RESULT to ensure consistency
            if (e.detail?.result) {
                global.GAIP_DISEASE_RESULT = e.detail.result;
            }
            setTimeout(updateDashboard, 50);
        });
        
        document.addEventListener('gaip:weather-updated', () => {
            setTimeout(updateDashboard, 100);
        });
        
        document.addEventListener('gaip:weather-updated', () => {
            setTimeout(updateDashboard, 100);
        });

        // Refresh when live sensor data arrives (Hydrosight async fetch completes after page load)
        // Also trigger a full recompute so canonical state and pre-emergent engine pick up sensor data.
        document.addEventListener('gaip:hydrosight:updated', () => {
            setTimeout(function() {
                // Recompute canonical state so sensor soilTemp reaches pre-emergent engine
                if (global.GilbaCascadeOrchestrator && typeof global.GilbaCascadeOrchestrator.computeAll === 'function') {
                    try { global.GilbaCascadeOrchestrator.computeAll(); } catch(e) {}
                } else if (global.GAIP_HubOrchestrator && typeof global.GAIP_HubOrchestrator.computeAll === 'function') {
                    try { global.GAIP_HubOrchestrator.computeAll(); } catch(e) {}
                }
                updateDashboard();
            }, 200);
        });
        
        // Also check for orchestrator completion
        if (global.GaipOrchestrator) {
            const origComplete = global.GaipOrchestrator.onComplete;
            global.GaipOrchestrator.onComplete = function(results) {
                if (origComplete) origComplete.call(this, results);
                setTimeout(updateDashboard, 100);
            };
        }
        
        log('Dashboard initialized');
        
        // v1.0.0: Initialize priority action queue
        if (global.GilbaPriorityQueue && global.GilbaPriorityQueue.init) {
            try {
                global.GilbaPriorityQueue.init();
            } catch (e) {
                log('Priority queue init error: ' + e.message);
            }
        }
    }

    function toggleDashboard() {
        if (!_dashboardEl) return;
        
        _isExpanded = !_isExpanded;
        _dashboardEl.classList.toggle('collapsed', !_isExpanded);
        
        const toggleIcon = _dashboardEl.querySelector('.gaip-toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = _isExpanded ? '▼' : '▲';
        }
        
        // Save preference
        try {
            localStorage.setItem('gilba_dashboard_expanded', _isExpanded);
        } catch (e) {
            // Ignore
        }
    }

    function loadCachedData() {
        // Try to load from persistence cache
        if (global.GilbaPersistence && typeof global.GilbaPersistence.getCachedDashboard === 'function') {
            const cached = global.GilbaPersistence.getCachedDashboard();
            if (cached && cached.timestamp) {
                log('Loading cached dashboard data', cached);
                
                // Update widgets with cached data
                if (cached.growthPotential !== undefined) {
                    updateGrowthWidget({ growthPotential: cached.growthPotential });
                }
                if (cached.diseaseRisk !== undefined) {
                    updateDiseaseWidget({ overall: cached.diseaseRisk, topDisease: cached.topDisease });
                }
                if (cached.stressIndex !== undefined) {
                    updateStressWidget({ stressIndex: cached.stressIndex, trend: cached.trendDirection });
                }
                
                // Update timestamp
                const updatedEl = document.querySelector('.gaip-dashboard-updated');
                if (updatedEl) {
                    const cacheTime = new Date(cached.timestamp);
                    updatedEl.textContent = `Cached ${formatTime(cacheTime)}`;
                }
            }
        }
        
        // Load expanded preference
        try {
            const savedExpanded = localStorage.getItem('gilba_dashboard_expanded');
            if (savedExpanded !== null) {
                _isExpanded = savedExpanded === 'true';
                if (_dashboardEl) {
                    _dashboardEl.classList.toggle('collapsed', !_isExpanded);
                    const toggleIcon = _dashboardEl.querySelector('.gaip-toggle-icon');
                    if (toggleIcon) {
                        toggleIcon.textContent = _isExpanded ? '▼' : '▲';
                    }
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    const GilbaDashboard = {
        version: CONFIG.version,

        /**
         * Initialize the dashboard
         */
        init: function() {
            initDashboard();
        },

        /**
         * Force update the dashboard
         */
        update: function() {
            updateDashboard();
        },

        /**
         * Toggle dashboard visibility
         */
        toggle: function() {
            toggleDashboard();
        },

        /**
         * Check if dashboard is expanded
         */
        isExpanded: function() {
            return _isExpanded;
        }
    };

    // =========================================================================
    // AUTO-INITIALIZE
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay to let hub render first
            setTimeout(initDashboard, 400);
        });
    } else {
        setTimeout(initDashboard, 400);
    }

    // Export to global
    global.GilbaDashboard = GilbaDashboard;

})(typeof window !== 'undefined' ? window : this);
