/**
 * Gilba Shade Integration v2.1.0
 * Progressive disclosure UI integration for shade engine
 * 
 * v2.1.0 - Overseed-aware DLI thresholds: when C3 overseed is dominant (>50%),
 *          uses C3 species thresholds instead of base C4 thresholds
 * 
 * @requires shade-engine.js
 * @provides gssh_shade_render(shadeResult) → HTML string
 */

(function(global) {
    'use strict';

    /* ============================================================
       UI STATE MANAGEMENT
    ============================================================ */

    var expandedStates = {
        shadeMain: false,
        shadeFungal: false,
        shadeStress: false,
        shadeLED: false,
        shadeRecovery: false,
        shadeSensitivity: false
    };

    function toggleSection(sectionId) {
        expandedStates[sectionId] = !expandedStates[sectionId];
        var el = document.getElementById(sectionId + '-content');
        if (el) {
            el.style.display = expandedStates[sectionId] ? 'block' : 'none';
        }
        var chevron = document.getElementById(sectionId + '-chevron');
        if (chevron) {
            chevron.textContent = expandedStates[sectionId] ? '▼' : '▶';
        }
    }

    // Expose toggle function globally
    global.gssh_shade_toggle = toggleSection;

    /* ============================================================
       SEVERITY STYLING
    ============================================================ */

    function getSeverityClass(severity) {
        var classes = {
            'good': 'gssh-severity-good',
            'watch': 'gssh-severity-watch',
            'concern': 'gssh-severity-concern',
            'critical': 'gssh-severity-critical'
        };
        return classes[severity] || 'gssh-severity-watch';
    }

    function getSeverityIcon(severity) {
        var icons = {
            'good': '✓',
            'watch': '◐',
            'concern': '⚠',
            'critical': '✕'
        };
        return icons[severity] || '•';
    }

    function getStatusLabel(status) {
        var labels = {
            'OPTIMAL': 'Optimal light',
            'ADEQUATE': 'Adequate light',
            'MARGINAL': 'Marginal light',
            'DEFICIENT': 'Light deficient',
            'CRITICAL': 'Critical deficit',
            'NO_DATA': 'No shade data'
        };
        return labels[status] || status;
    }

    /* ============================================================
       RENDER FUNCTIONS
    ============================================================ */

    /**
     * Render the compact verdict header (State 1)
     */
    function renderVerdict(data) {
        if (!data || data.status === 'NO_DATA') {
            return '<div class="gssh-shade-verdict gssh-severity-watch">' +
                '<span class="gssh-verdict-icon">○</span>' +
                '<span class="gssh-verdict-text">No shade data provided</span>' +
                '</div>';
        }

        var severityClass = getSeverityClass(data.statusSeverity);
        var icon = getSeverityIcon(data.statusSeverity);
        var label = getStatusLabel(data.status);
        var confidence = Math.round((data.confidence || 0.8) * 100);

        return '<div class="gssh-shade-verdict ' + severityClass + '">' +
            '<span class="gssh-verdict-icon">' + icon + '</span>' +
            '<span class="gssh-verdict-text">' + label + '</span>' +
            '<span class="gssh-verdict-metrics">' +
                '<span class="gssh-metric-chip">DLI: ' + data.dliShaded + ' mol/m²/d</span>' +
                '<span class="gssh-metric-chip">Deficit: ' + data.deficitPct + '%</span>' +
                '<span class="gssh-metric-chip">' + confidence + '% conf</span>' +
            '</span>' +
            '</div>';
    }

    /**
     * Render the "Why" explanation (State 2)
     */
    function renderWhy(data) {
        if (!data || data.status === 'NO_DATA') return '';

        var html = '<div class="gssh-shade-why">';
        
        // Primary driver
        html += '<div class="gssh-why-row">' +
            '<span class="gssh-why-label">Primary driver:</span>' +
            '<span class="gssh-why-value">' + (data.primaryDriver || 'Light assessment') + '</span>' +
            '</div>';

        // DLI context
        html += '<div class="gssh-why-row">' +
            '<span class="gssh-why-label">Open-field DLI:</span>' +
            '<span class="gssh-why-value">' + data.dliOpen + ' mol/m²/d (' + data.monthName + ')</span>' +
            '</div>';

        html += '<div class="gssh-why-row">' +
            '<span class="gssh-why-label">Shaded DLI:</span>' +
            '<span class="gssh-why-value">' + data.dliShaded + ' mol/m²/d (' + data.transmissionPct + '% transmission)</span>' +
            '</div>';

        // Species thresholds
        html += '<div class="gssh-why-row">' +
            '<span class="gssh-why-label">Species minimum:</span>' +
            '<span class="gssh-why-value">' + data.dliMin + ' mol/m²/d (' + data.species + ')</span>' +
            '</div>';

        html += '<div class="gssh-why-row">' +
            '<span class="gssh-why-label">Target DLI:</span>' +
            '<span class="gssh-why-value">' + data.dliTarget + ' mol/m²/d</span>' +
            '</div>';

        // C3/C4 mix if relevant
        if (data.c3Fraction > 0 && data.c4Fraction > 0) {
            html += '<div class="gssh-why-row">' +
                '<span class="gssh-why-label">Sward mix:</span>' +
                '<span class="gssh-why-value">C3: ' + Math.round(data.c3Fraction * 100) + '% / C4: ' + Math.round(data.c4Fraction * 100) + '%</span>' +
                '</div>';
        }

        // Species decision
        if (data.speciesDecision) {
            html += '<div class="gssh-why-row">' +
                '<span class="gssh-why-label">Recommendation:</span>' +
                '<span class="gssh-why-value">' + data.speciesDecision.mode + '</span>' +
                '</div>';
            html += '<div class="gssh-why-row gssh-why-reason">' +
                '<span class="gssh-why-value">' + data.speciesDecision.reason + '</span>' +
                '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Get species-specific disease warnings for shade/moisture conditions
     */
    function getSpeciesDiseaseWarning(species, c3Fraction, c4Fraction) {
        var speciesLower = (species || '').toLowerCase();
        
        // C4 warm-season diseases
        if (c4Fraction > 0.5 || speciesLower.includes('couch') || speciesLower.includes('bermuda')) {
            return 'Monitor for large patch (Rhizoctonia), Pythium, spring dead spot.';
        }
        if (speciesLower.includes('kikuyu')) {
            return 'Monitor for kikuyu yellows, Pythium.';
        }
        if (speciesLower.includes('zoysia')) {
            return 'Monitor for large patch (Rhizoctonia), Pythium.';
        }
        if (speciesLower.includes('buffalo') || speciesLower.includes('stenotaphrum')) {
            return 'Monitor for Pythium, leaf spot.';
        }
        
        // C3 cool-season diseases (species-specific)
        if (speciesLower.includes('bentgrass') || speciesLower.includes('bent')) {
            return 'Monitor for dollar spot, brown patch, Pythium.';
        }
        if (speciesLower.includes('bluegrass') || speciesLower.includes('poa')) {
            return 'Monitor for dollar spot, brown patch, leaf spot.';
        }
        if (speciesLower.includes('fine fescue') || speciesLower.includes('chewings') || speciesLower.includes('creeping red')) {
            return 'Monitor for dollar spot, red thread.';
        }
        if (speciesLower.includes('ryegrass') || speciesLower.includes('rye')) {
            return 'Monitor for brown patch, Pythium, gray leaf spot, red thread.';
        }
        if (speciesLower.includes('tall fescue') || speciesLower.includes('fescue')) {
            return 'Monitor for brown patch, Pythium.';
        }
        
        // Default based on C3/C4 fraction
        if (c3Fraction > 0.5) {
            return 'Monitor for brown patch, Pythium in cool-season turf.';
        }
        return 'Monitor for Pythium, fungal leaf diseases.';
    }

    /**
     * Render fungal risk panel
     */
    function renderFungalRisk(data) {
        if (!data || !data.fungalClass) return '';

        var severityClass = getSeverityClass(data.fungalClass.severity);
        var diseaseWarning = getSpeciesDiseaseWarning(data.species, data.c3Fraction, data.c4Fraction);

        return '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeFungal\')">' +
                '<span id="shadeFungal-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">Fungal Risk</span>' +
                '<span class="gssh-panel-badge ' + severityClass + '">' + data.fungalClass.label + '</span>' +
            '</div>' +
            '<div id="shadeFungal-content" class="gssh-panel-content" style="display:none;">' +
                '<div class="gssh-metric-row">' +
                    '<span class="gssh-metric-chip">Index: ' + data.fungalRisk + '/100</span>' +
                    '<span class="gssh-metric-chip">DLI factor: ' + (data.dliShaded < 12 ? 'Elevated' : 'Normal') + '</span>' +
                '</div>' +
                '<div class="gssh-hint">Low DLI + extended dew increases fungal pressure. ' + diseaseWarning + '</div>' +
            '</div>' +
            '</div>';
    }

    /**
     * Render stress forecast panel
     */
    function renderStressForecast(data) {
        if (!data || !data.stressClass) return '';

        var severityClass = getSeverityClass(data.stressClass.severity);

        return '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeStress\')">' +
                '<span id="shadeStress-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">Stress Forecast</span>' +
                '<span class="gssh-panel-badge ' + severityClass + '">' + data.stressClass.label + '</span>' +
            '</div>' +
            '<div id="shadeStress-content" class="gssh-panel-content" style="display:none;">' +
                '<div class="gssh-metric-row">' +
                    '<span class="gssh-metric-chip">Index: ' + data.stressIndex + '/100</span>' +
                    '<span class="gssh-metric-chip">Light deficit: ' + data.deficitPct + '%</span>' +
                    '<span class="gssh-metric-chip">Fungal load: ' + data.fungalRisk + '</span>' +
                '</div>' +
                '<div class="gssh-hint">Combined assessment of light, ET, traffic, and disease pressure.</div>' +
            '</div>' +
            '</div>';
    }

    /**
     * Render LED supplementation panel (v2.0: EUE-aware)
     */
    function renderLED(data) {
        if (!data || !data.led) return '';

        var led = data.led;
        var badge = led.required ? 'Required' : 'Not needed';
        var severityClass = led.required ? 'gssh-severity-watch' : 'gssh-severity-good';

        // Upgrade severity if EUE indicates environmental problems
        if (led.eue && led.eue.compositeEUE < 0.6) {
            severityClass = 'gssh-severity-concern';
            badge = 'Required (env. constrained)';
        }

        var content = '';
        if (led.required) {
            // Core metrics
            content = '<div class="gssh-metric-row">' +
                    '<span class="gssh-metric-chip">Deficit: ' + led.deficitMol + ' mol</span>' +
                    '<span class="gssh-metric-chip">Hours: ' + led.hours + '/day</span>' +
                    '<span class="gssh-metric-chip">Energy: ' + led.kWh + ' kWh/day</span>' +
                    '<span class="gssh-metric-chip">Cost: $' + led.costPerDay + '/day</span>' +
                '</div>';

            // Target source
            if (led.targetSource === 'hoc_adjusted') {
                content += '<div class="gssh-hint">DLI target: ' + led.targetDLI + ' mol/m²/day (adjusted for mowing height)</div>';
            }

            // EUE breakdown (if available)
            if (led.eue && led.eue.compositeEUE < 1.0) {
                content += renderEUESection(led.eue, led);
            }
            
            // Spectral prescription (if available)
            if (led.spectral) {
                content += renderSpectralSection(led.spectral);
            }

            // Warnings
            if (led.warnings && led.warnings.length > 0) {
                for (var i = 0; i < led.warnings.length; i++) {
                    content += '<div class="gssh-hint gssh-hint-warn">' + led.warnings[i] + '</div>';
                }
            } else if (led.warning) {
                content += '<div class="gssh-hint gssh-hint-warn">' + led.warning + '</div>';
            }
        } else {
            content = '<div class="gssh-hint">' + (led.warning || 'DLI sufficient') + '</div>';
        }

        return '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeLED\')">' +
                '<span id="shadeLED-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">LED Supplementation</span>' +
                '<span class="gssh-panel-badge ' + severityClass + '">' + badge + '</span>' +
            '</div>' +
            '<div id="shadeLED-content" class="gssh-panel-content" style="display:none;">' +
                content +
            '</div>' +
            '</div>';
    }

    /**
     * Render Environmental Utilisation Efficiency breakdown
     */
    function renderEUESection(eue, led) {
        if (!eue) return '';

        var html = '<div class="gssh-eue-section" style="margin-top:8px; padding:10px; background:var(--gaip-surface-muted); border-radius:6px; border-left:3px solid ' +
            (eue.compositeEUE < 0.3 ? '#dc3545' : eue.compositeEUE < 0.6 ? '#fd7e14' : eue.compositeEUE < 0.85 ? '#ffc107' : '#28a745') + ';">';

        // Venue Readiness header
        if (eue.venueReadiness) {
            var vr = eue.venueReadiness;
            html += '<div style="font-weight:600; margin-bottom:6px;">' +
                    'Environmental Readiness: ' + vr.score + '/100' +
                    '<span class="gssh-panel-badge gssh-severity-' + vr.colour + '" style="margin-left:8px;">' + vr.label + '</span>' +
                '</div>';
        }

        // Effective utilisation summary
        html += '<div class="gssh-metric-row">' +
                '<span class="gssh-metric-chip">Env. Utilisation: ' + Math.round(eue.compositeEUE * 100) + '%</span>' +
                '<span class="gssh-metric-chip">Wasted photons: ~' + (led.wastedPhotonPct || 0) + '%</span>';
        if (led.effectiveHours && led.effectiveHours !== led.hours) {
            html += '<span class="gssh-metric-chip">Effective hours needed: ' + led.effectiveHours + '</span>';
        }
        html += '</div>';

        // Factor breakdown (progressive disclosure)
        if (eue.limitingFactors && eue.limitingFactors.length > 0) {
            html += '<div style="margin-top:8px; font-size:0.9em;">' +
                    '<strong>Limiting factors (Growth Environment Stack):</strong><ul style="margin:4px 0; padding-left:20px;">';
            
            var factorLabels = {
                rootZoneTemp: 'Root-zone temperature',
                leafTemp: 'Leaf/air temperature',
                vpd: 'VPD (moisture balance)',
                airflow: 'Airflow',
                co2: 'CO₂ concentration',
                rhizosphere: 'Rhizosphere health'
            };

            for (var i = 0; i < eue.limitingFactors.length; i++) {
                var lf = eue.limitingFactors[i];
                var severityColour = lf.severity === 'critical' ? '#dc3545' : 
                                     lf.severity === 'significant' ? '#fd7e14' : '#ffc107';
                html += '<li style="margin-bottom:4px;">' +
                        '<span style="color:' + severityColour + '; font-weight:600;">' + 
                            (factorLabels[lf.factor] || lf.factor) + '</span>: ' +
                        lf.value + ' ' + (lf.unit || '') + 
                        ' (optimal: ' + (lf.optimalRange || 'N/A') + ')' +
                        ' — ' + lf.efficiencyLoss + ' efficiency loss' +
                    '</li>';
            }
            html += '</ul></div>';
        }

        // Advisory actions
        if (eue.advisory && eue.advisory.actions && eue.advisory.actions.length > 0) {
            html += '<div style="margin-top:8px; font-size:0.88em; color:var(--gaip-text-secondary);">' +
                    '<strong>Recommended actions:</strong>';
            for (var j = 0; j < eue.advisory.actions.length; j++) {
                var action = eue.advisory.actions[j];
                html += '<div style="margin:4px 0; padding:4px 8px; background:var(--gaip-surface); border-radius:4px; border-left:2px solid ' +
                    (action.severity === 'critical' ? '#dc3545' : action.severity === 'significant' ? '#fd7e14' : '#ffc107') + ';">' +
                    action.action + '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Render spectral prescription section
     */
    function renderSpectralSection(spectral) {
        if (!spectral) return '';

        var html = '<div style="margin-top:8px; padding:10px; background:#f0f4f8; border-radius:6px;">' +
            '<div style="font-weight:600; margin-bottom:6px;">Spectral Prescription: ' + spectral.label + '</div>';

        // Spectrum bar visualisation
        var s = spectral.spectrum;
        html += '<div style="display:flex; height:20px; border-radius:4px; overflow:hidden; margin-bottom:6px;">' +
                '<div style="width:' + s.red660 + '%; background:#e53935;" title="Red 660nm: ' + s.red660 + '%"></div>' +
                '<div style="width:' + s.blue450 + '%; background:#1e88e5;" title="Blue 450nm: ' + s.blue450 + '%"></div>' +
                '<div style="width:' + s.green520 + '%; background:#43a047;" title="Green 520nm: ' + s.green520 + '%"></div>' +
                '<div style="width:' + s.farRed730 + '%; background:#880e4f;" title="Far-red 730nm: ' + s.farRed730 + '%"></div>' +
            '</div>';

        // Labels
        html += '<div style="display:flex; justify-content:space-between; font-size:0.8em; color:var(--gaip-text-secondary);">' +
                '<span>🔴 Red ' + s.red660 + '%</span>' +
                '<span>🔵 Blue ' + s.blue450 + '%</span>' +
                '<span>🟢 Green ' + s.green520 + '%</span>' +
                '<span>🟣 FR ' + s.farRed730 + '%</span>' +
            '</div>';

        // Phytochrome note
        if (spectral.phytochromeNote) {
            html += '<div style="margin-top:6px; font-size:0.85em; color:var(--gaip-text-secondary);">' + spectral.phytochromeNote + '</div>';
        }

        // Equipment capability note
        if (spectral.equipmentNote) {
            html += '<div style="margin-top:4px; font-size:0.82em; color:#868e96; font-style:italic;">' + spectral.equipmentNote + '</div>';
        }

        // Source
        html += '<div style="margin-top:4px; font-size:0.78em; color:#adb5bd;">Source: ' + spectral.source + '</div>';

        html += '</div>';
        return html;
    }

    /**
     * Render recovery window panel
     */
    function renderRecovery(data) {
        if (!data || !data.recoveryWindow) return '';

        var recovery = data.recoveryWindow;
        var severityClass = getSeverityClass(recovery.severity);

        var windowText = '';
        if (recovery.windowStart && recovery.windowEnd) {
            windowText = '<span class="gssh-metric-chip">Window: ' + recovery.windowStart + ' – ' + recovery.windowEnd + '</span>';
        }

        return '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeRecovery\')">' +
                '<span id="shadeRecovery-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">Recovery Window</span>' +
                '<span class="gssh-panel-badge ' + severityClass + '">' + recovery.flag + '</span>' +
            '</div>' +
            '<div id="shadeRecovery-content" class="gssh-panel-content" style="display:none;">' +
                '<div class="gssh-metric-row">' + windowText + '</div>' +
                '<div class="gssh-hint">' + recovery.detail + '</div>' +
            '</div>' +
            '</div>';
    }

    /**
     * Render sensitivity analysis (State 3)
     */
    function renderSensitivity(data) {
        if (!data || data.status === 'NO_DATA') return '';

        // Calculate what-if scenarios
        var currentDLI = data.dliShaded;
        var deficit = data.deficitPct;

        // +20% light improvement
        var improvedDLI = currentDLI * 1.2;
        var improvedDeficit = Math.max(0, deficit - 20);

        // -20% light degradation
        var degradedDLI = currentDLI * 0.8;
        var degradedDeficit = Math.min(100, deficit + 20);

        return '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeSensitivity\')">' +
                '<span id="shadeSensitivity-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">Sensitivity Analysis</span>' +
            '</div>' +
            '<div id="shadeSensitivity-content" class="gssh-panel-content" style="display:none;">' +
                '<div class="gssh-sensitivity-scenario">' +
                    '<span class="gssh-scenario-label">If +20% light (tree pruning):</span>' +
                    '<span class="gssh-scenario-value">DLI → ' + improvedDLI.toFixed(1) + ' mol, deficit → ' + improvedDeficit.toFixed(0) + '%</span>' +
                '</div>' +
                '<div class="gssh-sensitivity-scenario">' +
                    '<span class="gssh-scenario-label">If -20% light (canopy growth):</span>' +
                    '<span class="gssh-scenario-value">DLI → ' + degradedDLI.toFixed(1) + ' mol, deficit → ' + degradedDeficit.toFixed(0) + '%</span>' +
                '</div>' +
                '<div class="gssh-sensitivity-scenario">' +
                    '<span class="gssh-scenario-label">LED to reach target:</span>' +
                    '<span class="gssh-scenario-value">' + (data.led && data.led.required ? data.led.hours + ' hrs/day' : 'Not required') + '</span>' +
                '</div>' +
            '</div>' +
            '</div>';
    }

    /* ============================================================
       MAIN RENDER FUNCTION
    ============================================================ */

    /**
     * Main render entry point for shade analysis
     * @param {object} shadeResult - output from gssh_shade_engine()
     * @returns {string} HTML string
     */
    function gssh_shade_render(shadeResult) {
        if (!shadeResult) {
            return '<div class="gssh-shade-result gssh-shade-empty">' +
                '<div class="gssh-empty-message">No shade analysis available. Enter DLI or shade parameters.</div>' +
                '</div>';
        }

        var html = '<div class="gssh-shade-result">';

        // State 1: Verdict
        html += renderVerdict(shadeResult);

        // Expandable "Why" section
        html += '<div class="gssh-shade-panel">' +
            '<div class="gssh-panel-header" onclick="gssh_shade_toggle(\'shadeMain\')">' +
                '<span id="shadeMain-chevron" class="gssh-chevron">▶</span>' +
                '<span class="gssh-panel-title">Why this assessment?</span>' +
            '</div>' +
            '<div id="shadeMain-content" class="gssh-panel-content" style="display:none;">' +
                renderWhy(shadeResult) +
            '</div>' +
            '</div>';

        // Risk panels
        html += renderFungalRisk(shadeResult);
        html += renderStressForecast(shadeResult);
        html += renderLED(shadeResult);
        html += renderRecovery(shadeResult);

        // State 3: Sensitivity
        html += renderSensitivity(shadeResult);

        html += '</div>';

        return html;
    }

    /* ============================================================
       EXPORTS
    ============================================================ */

    global.gssh_shade_render = gssh_shade_render;

    // Export sub-renderers for customisation
    global.GSSH_ShadeUI = {
        render: gssh_shade_render,
        renderVerdict: renderVerdict,
        renderWhy: renderWhy,
        renderFungalRisk: renderFungalRisk,
        renderStressForecast: renderStressForecast,
        renderLED: renderLED,
        renderRecovery: renderRecovery,
        renderSensitivity: renderSensitivity,
        toggle: toggleSection
    };

    /* ============================================================
       TURF PROFILE & OVERSEED STATE LISTENER
       Updates DLI thresholds based on turf type selection AND
       overseed state. When C3 overseed is dominant (>50%), uses
       C3 thresholds instead of base C4 thresholds.
       
       v2.1.0: Added overseed awareness
    ============================================================ */

    // Current turf context for shade engine
    var currentTurfContext = {
        dliMinimum: 18,
        dliOptimal: 28,
        turfType: null,
        subCategory: null,
        // v2.1.0: Track overseed state
        effectiveSpecies: null,
        c3Fraction: 0,
        isOverseedDominant: false
    };

    // Store base thresholds from turf profile (before overseed adjustment)
    var baseTurfThresholds = {
        dliMinimum: 18,
        dliOptimal: 28,
        turfType: null,
        subCategory: null
    };

    /**
     * Get C3 thresholds for common cool-season species
     * Used when overseed is dominant
     */
    function getC3Thresholds(turfType, subCategory, species) {
        var speciesLower = (species || '').toLowerCase();
        
        // Golf greens have lower thresholds
        if (turfType === 'golf' && subCategory === 'greens') {
            // Bentgrass greens
            if (speciesLower.includes('bent')) {
                return { dliMinimum: 10, dliOptimal: 18 };
            }
            // Poa annua greens
            if (speciesLower.includes('poa')) {
                return { dliMinimum: 8, dliOptimal: 15 };
            }
            // Default C3 greens
            return { dliMinimum: 10, dliOptimal: 18 };
        }
        
        // Golf fairways/tees
        if (turfType === 'golf') {
            if (speciesLower.includes('bent')) {
                return { dliMinimum: 12, dliOptimal: 20 };
            }
            if (speciesLower.includes('ryegrass') || speciesLower.includes('rye')) {
                return { dliMinimum: 12, dliOptimal: 22 };
            }
            if (speciesLower.includes('fescue')) {
                return { dliMinimum: 10, dliOptimal: 18 };
            }
            return { dliMinimum: 12, dliOptimal: 20 };
        }
        
        // Sports fields - PRG is most common overseed
        if (turfType === 'sports') {
            if (speciesLower.includes('ryegrass') || speciesLower.includes('rye')) {
                return { dliMinimum: 12, dliOptimal: 22 };
            }
            if (speciesLower.includes('fescue')) {
                return { dliMinimum: 10, dliOptimal: 20 };
            }
            if (speciesLower.includes('bluegrass') || speciesLower.includes('kbg')) {
                return { dliMinimum: 14, dliOptimal: 24 };
            }
            // Default C3 sports
            return { dliMinimum: 12, dliOptimal: 22 };
        }
        
        // Lawns/general
        if (speciesLower.includes('fescue')) {
            return { dliMinimum: 8, dliOptimal: 16 };
        }
        if (speciesLower.includes('ryegrass') || speciesLower.includes('rye')) {
            return { dliMinimum: 10, dliOptimal: 20 };
        }
        
        // Default C3
        return { dliMinimum: 12, dliOptimal: 20 };
    }

    /**
     * Recalculate thresholds based on current overseed state
     */
    function recalculateThresholds() {
        var overseedState = global.GSSH_OVERSEED_STATE;
        
        // Check if overseed is dominant (>50% C3)
        if (overseedState && overseedState.c3Fraction > 0.5 && overseedState.overseedSpecies) {
            var c3Thresholds = getC3Thresholds(
                baseTurfThresholds.turfType,
                baseTurfThresholds.subCategory,
                overseedState.overseedSpecies
            );
            
            currentTurfContext.dliMinimum = c3Thresholds.dliMinimum;
            currentTurfContext.dliOptimal = c3Thresholds.dliOptimal;
            currentTurfContext.effectiveSpecies = overseedState.overseedSpecies;
            currentTurfContext.c3Fraction = overseedState.c3Fraction;
            currentTurfContext.isOverseedDominant = true;
        } else {
            // Use base turf thresholds (C4 or pure C3)
            currentTurfContext.dliMinimum = baseTurfThresholds.dliMinimum;
            currentTurfContext.dliOptimal = baseTurfThresholds.dliOptimal;
            currentTurfContext.effectiveSpecies = null;
            currentTurfContext.c3Fraction = overseedState ? overseedState.c3Fraction : 0;
            currentTurfContext.isOverseedDominant = false;
            
            if (overseedState && overseedState.c3Fraction > 0) {
            }
        }
    }

    /**
     * Handle turf profile changes
     * Updates the shade engine's DLI thresholds based on turf type
     */
    function handleTurfProfileChange(event) {
        var detail = event.detail;
        var thresholds = detail.thresholds;
        
        if (thresholds) {
            // Store base thresholds
            baseTurfThresholds.dliMinimum = thresholds.dliMinimum || 18;
            baseTurfThresholds.dliOptimal = thresholds.dliOptimal || 28;
            baseTurfThresholds.turfType = detail.turfType;
            baseTurfThresholds.subCategory = detail.subCategory;
            
            // Also update current context turf type
            currentTurfContext.turfType = detail.turfType;
            currentTurfContext.subCategory = detail.subCategory;
            
            // Recalculate with overseed state
            recalculateThresholds();
            
        }
    }

    /**
     * Handle overseed state changes
     * v2.1.0: Recalculate thresholds when overseed fraction changes
     */
    function handleOverseedStateUpdate(event) {
        var detail = event.detail;

        // Recalculate thresholds based on new overseed state
        recalculateThresholds();
    }

    /**
     * Get current turf context for shade calculations
     */
    function getTurfContext() {
        return currentTurfContext;
    }

    // Listen for turf profile changes
    document.addEventListener('gssh:turf-profile-change', handleTurfProfileChange);
    
    // v2.1.0: Listen for overseed state changes
    document.addEventListener('gssh:overseed-state-update', handleOverseedStateUpdate);

    // Expose context getter - attach to both global and window to be safe
    global.gssh_shade_getTurfContext = getTurfContext;
    if (typeof window !== 'undefined') {
        window.gssh_shade_getTurfContext = getTurfContext;
    }
    
    // v2.1.0: Expose recalculate function for manual triggering if needed
    global.gssh_shade_recalculateThresholds = recalculateThresholds;


})(typeof window !== 'undefined' ? window : this);
