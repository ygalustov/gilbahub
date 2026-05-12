/**
 * ============================================================================
 * GILBA CLIMATE MODULE v2 UI v1.7.0
 * ============================================================================
 * 
 * Progressive disclosure UI for climate v2 analysis.
 * Displays winterkill risk, heat stress, dormancy status, and growth potential.
 * 
 * v1.7.0: Added overseed blend indication in GP display
 *         - Shows C3/C4 percentages when overseed is active
 *         - Displays "Overseed blend" label instead of just warm/cool season
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CSS
    // ========================================================================

    const CLIMATE_V2_CSS = `
        .climate-v2-panel {
            background: var(--gaip-surface-muted);
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
        }
        
        .climate-v2-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .climate-v2-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .climate-stress-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }
        
        .stress-card {
            background: var(--gaip-surface);
            border-radius: 8px;
            padding: 16px;
            border-left: 4px solid var(--gaip-border);
        }
        
        .stress-card.good { border-left-color: #22c55e; }
        .stress-card.watch { border-left-color: #f59e0b; }
        .stress-card.concern { border-left-color: #f97316; }
        .stress-card.critical { border-left-color: #ef4444; }
        
        .stress-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }
        
        .stress-card-title {
            font-weight: 600;
            color: var(--gaip-text);
            font-size: 13px;
        }
        
        .stress-score {
            font-size: 20px;
            font-weight: 700;
        }
        
        .stress-score.good { color: #22c55e; }
        .stress-score.watch { color: #f59e0b; }
        .stress-score.concern { color: #f97316; }
        .stress-score.critical { color: #ef4444; }
        
        .stress-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--gaip-text);
        }
        
        .stress-detail {
            font-size: 12px;
            color: var(--gaip-text);
            margin-top: 8px;
        }
        
        .variety-impact {
            margin-top: 4px;
            font-size: 11px;
            padding: 4px 8px;
            background: var(--gaip-info-bg);
            border-radius: 4px;
            color: #1e40af;
        }
        
        .dormancy-status {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: var(--gaip-surface);
            border-radius: 8px;
            margin-bottom: 12px;
        }
        
        .dormancy-icon {
            font-size: 32px;
        }
        
        .dormancy-info {
            flex: 1;
        }
        
        .dormancy-label {
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .dormancy-detail {
            font-size: 13px;
            color: var(--gaip-text);
        }
        
        .gdd-progress {
            margin-top: 8px;
        }
        
        .gdd-bar {
            height: 8px;
            background: var(--gaip-border);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .gdd-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #22c55e);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        
        .growth-potential-display {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background: var(--gaip-surface);
            border-radius: 8px;
            margin-top: 12px;
        }
        
        .gp-gauge {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: conic-gradient(
                #22c55e 0deg,
                #22c55e var(--gp-angle, 0deg),
                var(--gaip-border) var(--gp-angle, 0deg)
            );
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        .gp-gauge::after {
            content: '';
            width: 60px;
            height: 60px;
            background: var(--gaip-surface);
            border-radius: 50%;
            position: absolute;
        }
        
        .gp-value {
            position: relative;
            z-index: 1;
            font-size: 18px;
            font-weight: 700;
            color: var(--gaip-text);
        }
        
        .gp-info {
            flex: 1;
        }
        
        .gp-label {
            font-weight: 600;
            color: var(--gaip-text);
        }
        
        .gp-detail {
            font-size: 13px;
            color: var(--gaip-text);
            margin-top: 4px;
        }
        
        .recommendations-list {
            margin-top: 12px;
            padding: 12px;
            background: var(--gaip-warning-bg);
            border-radius: 8px;
        }
        
        .recommendations-list h4 {
            font-size: 13px;
            font-weight: 600;
            color: #92400e;
            margin: 0 0 8px 0;
        }
        
        .recommendations-list ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .recommendations-list li {
            font-size: 12px;
            color: #78350f;
            margin-bottom: 4px;
        }
        
        /* Soil Temperature Panel */
        .soil-temp-section {
            margin-top: 16px;
            padding: 16px;
            background: linear-gradient(to bottom, var(--gaip-warning-bg), var(--gaip-warning-bg));
            border-radius: 12px;
            border: 1px solid #fde047;
        }
        
        .soil-temp-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .soil-temp-title {
            font-size: 14px;
            font-weight: 600;
            color: #854d0e;
        }
        
        .soil-temp-badge {
            padding: 2px 8px;
            background: #a16207;
            color: var(--gaip-surface);
            border-radius: 10px;
            font-size: 10px;
            font-weight: 500;
        }
        
        .soil-temp-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }
        
        .soil-temp-depth-card {
            background: var(--gaip-surface);
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            border: 1px solid var(--gaip-warning-border);
        }
        
        .soil-temp-depth-label {
            font-size: 11px;
            color: #92400e;
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .soil-temp-depth-value {
            font-size: 18px;
            font-weight: 600;
            color: #78350f;
        }
        
        .soil-temp-depth-current {
            font-size: 10px;
            color: #a16207;
            margin-top: 2px;
        }
        
        .soil-temp-footer {
            font-size: 11px;
            color: #92400e;
            text-align: center;
        }
        
        @media (max-width: 600px) {
            .soil-temp-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    `;

    // ========================================================================
    // INJECT CSS
    // ========================================================================

    function injectCSS() {
        if (document.getElementById('climate-v2-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'climate-v2-styles';
        style.textContent = CLIMATE_V2_CSS;
        document.head.appendChild(style);
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    /**
     * Render full climate v2 analysis
     */
    function renderClimateV2(result) {
        if (!result || result.error) {
            return `<div class="climate-v2-panel">
                <p style="color: #ef4444;">${result?.error || 'No climate data available'}</p>
            </div>`;
        }
        
        injectCSS();
        
        // Get weather status badge
        let weatherBadge = '';
        if (typeof window.GAIP_WeatherResilience !== 'undefined') {
            weatherBadge = window.GAIP_WeatherResilience.renderStatusBadge();
        }
        
        let html = `<div class="climate-v2-panel">`;
        
        // Header with weather status badge
        html += `
            <div class="climate-v2-header">
                <div class="climate-v2-title" style="display: flex; align-items: center; gap: 10px;">
                    🌡️ Climate Analysis
                    ${result.variety ? `<span style="font-weight: 400; font-size: 13px; color: var(--gaip-text);">, ${result.variety}</span>` : ''}
                    ${weatherBadge}
                </div>
                ${result.primaryStress !== 'none' ? `
                    <div style="padding: 4px 12px; background: ${getSeverityBg(result.primarySeverity)}; 
                                border-radius: 12px; font-size: 12px; font-weight: 500; 
                                color: ${getSeverityColor(result.primarySeverity)};">
                        Primary stress: ${result.primaryStress}
                    </div>
                ` : ''}
            </div>
        `;
        
        // Dormancy status (for C4)
        if (result.dormancy?.applicable) {
            html += renderDormancyStatus(result.dormancy);
        }
        
        // Stress cards grid
        html += `<div class="climate-stress-grid">`;
        
        // Winterkill card (C4 only)
        if (result.winterkill?.applicable) {
            html += renderStressCard('Winterkill Risk', result.winterkill, '❄️', 
                `Min temp: ${result.winterkill.minTemp}°C`);
        }
        
        // Heat stress card
        if (result.heatStress && !result.heatStress.error) {
            html += renderStressCard('Heat Stress', result.heatStress, '🔥',
                `Max: ${result.heatStress.maxTemp}°C, Nights: ${result.heatStress.avgNightTemp}°C`);
        }
        
        // Drought stress card
        if (result.drought && !result.drought.error) {
            html += renderStressCard('Drought Stress', result.drought, '💧',
                `ET deficit: ${result.drought.etDeficit}mm/week`);
        }
        
        html += `</div>`; // end stress grid
        
        // Growth potential
        if (result.growthPotential && !result.growthPotential.error) {
            html += renderGrowthPotential(result.growthPotential);
        }
        
        // Combined recommendations
        const allRecs = [
            ...(result.winterkill?.recommendations || []),
            ...(result.heatStress?.recommendations || []),
            ...(result.drought?.recommendations || [])
        ];
        
        if (allRecs.length > 0) {
            html += `
                <div class="recommendations-list">
                    <h4>⚠️ Recommendations</h4>
                    <ul>
                        ${allRecs.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Soil temperature panel (GAIP physics model)
        html += renderSoilTempPanel(result);
        
        html += `</div>`;
        
        return html;
    }
    
    /**
     * Render soil temperature diagnostic panel
     * Uses GAIP physics-based model for multi-depth analysis
     */
    function renderSoilTempPanel(result) {
        // Try to compute GAIP physics model data
        if (typeof global.gaip_enhanced_soil_temp !== 'function' ||
            typeof global.gaip_soil_temp_summary !== 'function') {
            return ''; // Functions not available
        }
        
        // Get hourly data from rawWeatherData
        const rawWeather = global.rawWeatherData;
        const hourlyData = rawWeather?.hourly || rawWeather?.forecast?.hourly;
        
        if (!hourlyData?.temperature_2m) {
            return ''; // No hourly data available
        }
        
        try {
            // Get soil profile from state (currentState is more reliably populated for construction)
            const state = global.currentState || global.GAIP_STATE || {};
            const profileType = state.turf?.construction || 'sand-carpet';
            
            // Get CEC and OM from soil test if available (for texture inference on native soils)
            const soilCEC = state.soil?.CEC || null;
            const soilOM = state.soil?.LOI || state.soil?.OM || null;
            
            // Compute enhanced soil temperatures
            const soilResult = global.gaip_enhanced_soil_temp(
                hourlyData.temperature_2m,
                hourlyData.shortwave_radiation,
                hourlyData.soil_moisture_0_to_7cm ? 
                    hourlyData.soil_moisture_0_to_7cm.reduce((a,b) => a + (b||0), 0) / 
                    hourlyData.soil_moisture_0_to_7cm.filter(x => x !== null && x !== undefined).length : 0.25,
                { 
                    profileType: profileType,
                    cec: soilCEC,
                    om: soilOM
                }
            );
            
            if (!soilResult) return '';
            
            // Get summary for UI
            const soilData = global.gaip_soil_temp_summary(soilResult);
            if (!soilData || !soilData.available) return '';
            
            // STORE GLOBALLY for disease/overseed modules to use
            global.GAIP_SOIL_TEMP = {
                raw: soilResult,           // Full hourly arrays for each depth
                summary: soilData,         // Summary with means/current values
                profileType: profileType,
                computed: new Date().toISOString()
            };

            // Format profile name
            const profileNames = {
                'usga': 'USGA Sand',
                'native': 'Native Soil',
                'push-up': 'Push-up Green',
                'sand-carpet': 'Sand Carpet',
                'hybrid': 'Hybrid Pitch',
                'sand-profile': 'Sand Profile',
                'pipe-drained': 'Pipe Drained',
                'soil-field': 'Soil Field'
            };
            const profileName = profileNames[profileType] || profileType;
            
            // Build depth cards
            const depths = soilData.depths || {};
            const depthHTML = Object.entries(depths).map(([depth, data]) => `
                <div class="soil-temp-depth-card">
                    <div class="soil-temp-depth-label">${depth}</div>
                    <div class="soil-temp-depth-value">${data.mean?.toFixed(1) || '--'}°C</div>
                    <div class="soil-temp-depth-current">now: ${data.current?.toFixed(1) || '--'}°C</div>
                </div>
            `).join('');
            
            // Format kappa for display (raw value is in m²/s, display as ×10⁻⁶)
            const kappaDisplay = soilData.thermalProps?.kappa ? 
                (soilData.thermalProps.kappa * 1e6).toFixed(2) : null;
            
            return `
                <div class="soil-temp-section">
                    <div class="soil-temp-header">
                        <span class="soil-temp-title">🌡️ Soil Temperature Profile</span>
                        <span class="soil-temp-badge">Physics Model</span>
                    </div>
                    <div class="soil-temp-grid">
                        ${depthHTML}
                    </div>
                    <div class="soil-temp-footer">
                        Profile: <strong>${profileName}</strong>
                        ${kappaDisplay ? ` • κ = ${kappaDisplay} ×10⁻⁶ m²/s` : ''}
                    </div>
                </div>
            `;
        } catch (e) {
            console.warn('[ClimateV2UI] Soil temp calculation failed:', e);
            return '';
        }
    }

    /**
     * Render dormancy status
     */
    function renderDormancyStatus(dormancy) {
        const icons = {
            active: '🌱',
            greening: '🌿',
            transitional: '🍂',
            dormant: '❄️'
        };
        
        let html = `
            <div class="dormancy-status">
                <div class="dormancy-icon">${icons[dormancy.status] || '🌿'}</div>
                <div class="dormancy-info">
                    <div class="dormancy-label">${capitalise(dormancy.status)}</div>
                    <div class="dormancy-detail">${dormancy.statusDetail}</div>
                    ${dormancy.variety?.note ? `
                        <div class="variety-impact">${dormancy.variety.note}</div>
                    ` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 600;">${dormancy.avgSoilTemp}°C</div>
                    <div style="font-size: 11px; color: var(--gaip-text);">Soil temp${dormancy.soilTempSource && dormancy.soilTempSource !== 'estimated' ? ' (' + dormancy.soilTempSource + ')' : ' (est.)'}</div>
                </div>
            </div>
        `;
        
        // GDD progress for greenup
        if (dormancy.status === 'dormant' || dormancy.status === 'transitional') {
            html += `
                <div class="gdd-progress" style="margin-bottom: 12px; padding: 12px; background: var(--gaip-surface); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 12px; font-weight: 500;">${dormancy.headingToDormancy ? 'Dormancy Progress' : 'Spring Greenup Progress'}</span>
                        <span style="font-size: 12px; color: var(--gaip-text);">${dormancy.gdd} / 100 GDD</span>
                    </div>
                    <div class="gdd-bar">
                        <div class="gdd-fill" style="width: ${dormancy.greenupProgress}%"></div>
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Render stress card
     */
    function renderStressCard(title, data, icon, detail) {
        const severity = data.severity || 'good';
        const score = data.riskScore || data.stressScore || 0;
        
        return `
            <div class="stress-card ${severity}">
                <div class="stress-card-header">
                    <div class="stress-card-title">${icon} ${title}</div>
                    <div>
                        <div class="stress-score ${severity}">${score}</div>
                        <div class="stress-label">${data.risk || data.stress || 'Score'}</div>
                    </div>
                </div>
                <div class="stress-detail">${detail}</div>
                ${data.variety?.modifier && data.variety.modifier !== 1.0 ? `
                    <div class="variety-impact">
                        ${data.variety.name}: ${Math.round((1 - data.variety.modifier) * 100)}% 
                        ${data.variety.modifier < 1 ? 'better' : 'worse'} tolerance
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render growth potential gauge
     * v1.7.0: Added overseed blend indication
     */
    function renderGrowthPotential(gp) {
        const angle = (gp.adjustedGrowthPotential / 100) * 360;
        const varietyDiff = gp.adjustedGrowthPotential - gp.baseGrowthPotential;
        
        // v1.7.0: Check for overseed scenario
        // Fix: isOverseed must require an explicit overseed flag — c3Fraction alone is unreliable
        // because a pure C3 grass (bentgrass, ryegrass) also has c3Fraction=1.0 and would
        // falsely trigger "Overseed blend (100% C3)" on any C4 site with stale state.
        const state = global.GAIP_STATE || global.currentState || {};
        const c3Fraction = state.turf?.c3Fraction || state.turf?.percentC3Cover / 100 || 0;
        const c4Fraction = state.turf?.species?.c4Fraction || (1 - c3Fraction);
        const hasExplicitOverseed = !!(state.turf?.isOverseed || state.turf?.overseedSpecies || state.turf?.coolOverseed);
        const isOverseed = hasExplicitOverseed && c3Fraction > 0.2 && c3Fraction < 1.0 && gp.isC4 !== undefined;
        const overseedSpecies = state.turf?.overseedSpecies || state.turf?.coolOverseed || 'Perennial Ryegrass';
        
        // Determine what species label to show
        let speciesLabel = gp.isC4 ? 'Warm-season' : 'Cool-season';
        if (isOverseed && c3Fraction >= 0.3) {
            const c3Pct = Math.round(c3Fraction * 100);
            speciesLabel = `Overseed blend (${c3Pct}% C3)`;
        }
        
        // v10.9.9: For overseed blends, show both GP values.
        // For pure stands, show only the relevant species.
        let blendLine = '';
        if (isOverseed && c3Fraction >= 0.3) {
            blendLine = `<br><span style="font-size: 11px; color: #3b82f6;">C3: ${gp.c3GP || gp.baseGrowthPotential}% | C4: ${gp.c4GP || 0}%</span>`;
        }
        
        return `
            <div class="growth-potential-display">
                <div class="gp-gauge" style="--gp-angle: ${angle}deg;">
                    <span class="gp-value">${gp.adjustedGrowthPotential}%</span>
                </div>
                <div class="gp-info">
                    <div class="gp-label">Growth Potential</div>
                    <div class="gp-detail">
                        ${speciesLabel} at ${gp.avgTemp}°C
                        ${blendLine}
                        ${varietyDiff !== 0 && !isOverseed ? `<br>Variety adjustment: ${varietyDiff > 0 ? '+' : ''}${varietyDiff}%` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    function getSeverityColor(severity) {
        const colors = {
            good: '#166534',
            watch: '#92400e',
            concern: '#c2410c',
            critical: '#dc2626'
        };
        return colors[severity] || 'var(--gaip-text)';
    }

    function getSeverityBg(severity) {
        const colors = {
            good: 'var(--gaip-good-bg)',
            watch: 'var(--gaip-warning-bg)',
            concern: 'var(--gaip-warning-bg)',
            critical: 'var(--gaip-critical-bg)'
        };
        return colors[severity] || 'var(--gaip-surface-hover)';
    }

    function capitalise(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    global.GAIP_ClimateV2UI = {
        render: renderClimateV2
    };

})(typeof window !== 'undefined' ? window : this);
