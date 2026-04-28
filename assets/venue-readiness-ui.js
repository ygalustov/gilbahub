/**
 * =============================================================================
 * VENUE READINESS UI v1.0.0
 * =============================================================================
 * 
 * Renders the Growth Environment Stack assessment in the stadium tab.
 * 
 * Displays:
 *   1. Venue Readiness status badge (READY / PARTIALLY_READY / NOT_READY)
 *   2. Environmental factor gauges (root-zone temp, leaf temp, VPD, airflow, CO₂, rhizosphere)
 *   3. Limiting factor callouts with remediation advice
 *   4. LED effectiveness estimate (EUE coefficient)
 *   5. Spectral prescription (for multi-channel LED equipment)
 *   6. Irrigation recalibration advisory
 *   7. Venue environment configuration form
 * 
 * Design: Progressive disclosure. Summary card always visible.
 * Factor details expand on click. Config form in slide-down panel.
 * 
 * Scientific basis:
 *   - Environmental factor assessment with colour-coded status indicators
 *   - Sodick Growth Equation Framework (2026)
 *   - Lawn Growth Under Artificial Light (technical compendium)
 * 
 * @requires eue-integration-bridge.js (GSSH_EUE_Bridge)
 * @requires environmental-utilisation-engine.js (GSSH_EUE)
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';
    var CONTAINER_ID = 'gssh-venue-readiness';

    function log(msg) {
        console.log('[VenueReadinessUI] ' + msg);
    }

    /* =========================================================================
       STATUS COLOURS — match GSSH design system
    ========================================================================= */

    var STATUS_STYLES = {
        READY:           { bg: 'var(--gaip-good-bg)', border: '#16a34a', text: '#166534', icon: '✓', label: 'Environment Ready' },
        READY_WITH_NOTES:{ bg: 'var(--gaip-warning-bg)', border: '#ca8a04', text: '#854d0e', icon: '◐', label: 'Ready — Minor Constraints' },
        PARTIALLY_READY: { bg: 'var(--gaip-warning-bg)', border: '#ea580c', text: '#9a3412', icon: '⚠', label: 'Environmental Constraints' },
        NOT_READY:       { bg: 'var(--gaip-critical-bg)', border: '#dc2626', text: '#991b1b', icon: '✕', label: 'Poor LED Conditions' }
    };

    var FACTOR_ICONS = {
        rootZoneTemp: '🌡️',
        leafTemp:     '🍃',
        vpd:          '💧',
        airflow:      '🌬️',
        co2:          '🫧',
        rhizosphere:  '🌱'
    };

    var FACTOR_NAMES = {
        rootZoneTemp: 'Root-Zone Temperature',
        leafTemp:     'Leaf / Air Temperature',
        vpd:          'VPD (Vapour Pressure Deficit)',
        airflow:      'Airflow',
        co2:          'CO₂ Concentration',
        rhizosphere:  'Rhizosphere Health'
    };

    /* =========================================================================
       RENDER — MAIN CARD
    ========================================================================= */

    function render(eueResult, container) {
        if (!container) {
            container = document.getElementById(CONTAINER_ID);
        }
        if (!container) return;

        if (!eueResult) {
            container.innerHTML = renderPlaceholder();
            return;
        }

        var readiness = eueResult.venueReadiness || {};
        var style = STATUS_STYLES[readiness.status] || STATUS_STYLES.PARTIALLY_READY;

        var html = '';

        // --- Summary badge ---
        html += '<div class="gssh-vr-card" style="border-left:4px solid ' + style.border + '; background:' + style.bg + ';">';
        html += '  <div class="gssh-vr-header">';
        html += '    <div class="gssh-vr-badge" style="color:' + style.text + ';">';
        html += '      <span class="gssh-vr-icon">' + style.icon + '</span>';
        html += '      <span class="gssh-vr-label">' + style.label + '</span>';
        html += '      <span class="gssh-vr-score">' + (readiness.score || 0) + '%</span>';
        html += '    </div>';
        html += '    <button class="gssh-vr-config-btn" onclick="GSSH_VenueReadinessUI.toggleConfig()" title="Venue Environment Settings">⚙️</button>';
        html += '  </div>';

        // Config panel renders directly below header so it appears near the gear button
        html += renderConfigPanel(eueResult.venueConfig || {});

        // EUE coefficient
        html += '  <div class="gssh-vr-eue-bar">';
        html += '    <div class="gssh-vr-eue-label">LED Utilisation Efficiency</div>';
        html += '    <div class="gssh-vr-eue-track">';
        html += '      <div class="gssh-vr-eue-fill" style="width:' + Math.round(eueResult.compositeEUE * 100) + '%; background:' + getEUEColour(eueResult.compositeEUE) + ';"></div>';
        html += '    </div>';
        html += '    <div class="gssh-vr-eue-value">' + Math.round(eueResult.compositeEUE * 100) + '% of delivered photons utilisable</div>';
        if (eueResult.wastedPhotonPct > 15) {
            html += '    <div class="gssh-vr-eue-waste" style="color:' + style.text + ';">~' + eueResult.wastedPhotonPct + '% wasted due to environmental limits</div>';
        }
        html += '  </div>';

        // --- Factor gauges (progressive disclosure) ---
        html += '  <div class="gssh-vr-factors">';
        html += '    <div class="gssh-vr-factors-header" onclick="GSSH_VenueReadinessUI.toggleFactors()">';
        html += '      <span>Growth Environment Stack</span>';
        html += '      <span class="gssh-vr-expand-icon" id="gssh-vr-expand-icon">▸</span>';
        html += '    </div>';
        html += '    <div class="gssh-vr-factors-summary">';
        html += renderFactorDots(eueResult.factors);
        html += '    </div>';
        html += '    <div class="gssh-vr-factors-detail" id="gssh-vr-factors-detail" style="display:none;">';
        html += renderFactorDetails(eueResult.factors, eueResult.pathway);
        html += '    </div>';
        html += '  </div>';

        // --- Limiting factors callout ---
        if (eueResult.limitingFactors && eueResult.limitingFactors.length > 0) {
            html += renderLimitingFactors(eueResult);
        }

        // --- b35fix176 G7: per-zone EUE breakdown ---
        if (eueResult.zoneEUE && eueResult.zoneEUE.length > 1) {
            html += renderZoneBreakdown(eueResult.zoneEUE, eueResult.compositeEUE);
        }

        // --- What-if projections ---
        if (eueResult.projections && eueResult.projections.steps.length > 0) {
            html += renderProjections(eueResult.projections, eueResult.compositeEUE);
        }

        // --- Advisory ---
        if (eueResult.advisory && eueResult.advisory.actions && eueResult.advisory.actions.length > 0) {
            html += renderAdvisory(eueResult.advisory);
        }

        // --- b35fix173 G2: wear auto-switch notice ---
        if (eueResult.managementGoalAutoSwitch) {
            var sw = eueResult.managementGoalAutoSwitch;
            var goalLabels = { recovery: 'Post-Event Recovery', strengthening: 'Strengthening', maintenance: 'Maintenance', establishment: 'Establishment' };
            html += '  <div class=\"gssh-vr-wear-switch\" style=\"margin:8px 0;padding:8px 12px;background:var(--gaip-warning-bg);border-left:3px solid #d97706;border-radius:4px;font-size:0.82rem;\">';
            html += '    <strong>⚡ Spectral Goal Auto-Adjusted:</strong> ';
            html += (goalLabels[sw.from] || sw.from) + ' → <strong>' + (goalLabels[sw.to] || sw.to) + '</strong>';
            html += '    <span style=\"color:#92400e;\"> (' + sw.reason + ' — wear-driven override)</span>';
            html += '    <div style=\"font-size:0.75rem;color:#78350f;margin-top:2px;\">Manual goal restored when recovery window clears. Change via ⚙️ to override.</div>';
            html += '  </div>';
        }

        // --- b35fix173 G3: PGR/DMI LED hours advisory ---
        if (eueResult.pgrDmiLEDAdvisory && eueResult.pgrDmiLEDAdvisory.active) {
            var pgAdv = eueResult.pgrDmiLEDAdvisory;
            html += '  <div class=\"gssh-vr-pgr-led\" style=\"margin:8px 0;padding:8px 12px;background:var(--gaip-info-bg);border-left:3px solid #3b82f6;border-radius:4px;font-size:0.82rem;\">';
            html += '    <strong>💊 Growth Regulator Detected:</strong> ' + pgAdv.message;
            if (pgAdv.citation) {
                html += '    <div style=\"font-size:0.72rem;color:var(--gaip-text-secondary);margin-top:2px;font-style:italic;\">Ref: ' + pgAdv.citation + '</div>';
            }
            html += '  </div>';
        }

        // --- Spectral prescription ---
        if (eueResult.spectral) {
            html += renderSpectral(eueResult.spectral);
        }

        // --- HOC-aware DLI target ---
        if (eueResult.hocTarget) {
            html += renderHOCTarget(eueResult.hocTarget, eueResult.venueConfig, eueResult._effectiveManagementGoal);
        }

        // --- Irrigation advisory ---
        if (eueResult.irrigationAdvisory && eueResult.irrigationAdvisory.recalibrationRequired) {
            html += renderIrrigationAdvisory(eueResult.irrigationAdvisory);
        }

        // --- Confidence note ---
        html += '  <div class="gssh-vr-confidence">Data confidence: ' + Math.round(eueResult.confidence * 100) + '%';
        if (eueResult.confidence < 0.5) {
            html += ' — <em>Limited sensor data. Provide venue environment details for more accurate assessment.</em>';
        }
        html += '</div>';

        html += '</div>'; // end card

        // --- Config panel (hidden by default) ---
        html += renderChemistryPanel(eueResult.chemistry || null);

        container.innerHTML = html;
    }

    /* =========================================================================
       RENDER — FACTOR SUMMARY DOTS
       Compact row of coloured dots showing status at a glance
    ========================================================================= */

    function renderFactorDots(factors) {
        if (!factors) return '';
        var html = '';
        var keys = ['rootZoneTemp', 'leafTemp', 'vpd', 'airflow', 'co2', 'rhizosphere'];
        for (var i = 0; i < keys.length; i++) {
            var f = factors[keys[i]];
            if (!f) continue;
            var colour = getEfficiencyColour(f.efficiency);
            html += '<span class="gssh-vr-dot" style="background:' + colour + ';" title="' + FACTOR_NAMES[keys[i]] + ': ' + Math.round(f.efficiency * 100) + '%">';
            html += FACTOR_ICONS[keys[i]];
            html += '</span>';
        }
        return html;
    }

    /* =========================================================================
       RENDER — FACTOR DETAILS (expanded view)
    ========================================================================= */

    function renderFactorDetails(factors, pathway) {
        if (!factors) return '';
        var html = '<div class="gssh-vr-factor-grid">';
        var keys = ['rootZoneTemp', 'leafTemp', 'vpd', 'airflow', 'co2', 'rhizosphere'];
        var pathwayLabel = pathway === 'c4' ? 'C4' : 'C3';

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var f = factors[key];
            if (!f) continue;

            var colour = getEfficiencyColour(f.efficiency);
            var pct = Math.round(f.efficiency * 100);

            html += '<div class="gssh-vr-factor-row">';
            html += '  <div class="gssh-vr-factor-label">';
            html += '    <span class="gssh-vr-factor-icon">' + FACTOR_ICONS[key] + '</span>';
            html += '    ' + FACTOR_NAMES[key];
            html += '  </div>';
            html += '  <div class="gssh-vr-factor-bar-wrap">';
            html += '    <div class="gssh-vr-factor-bar">';
            html += '      <div class="gssh-vr-factor-fill" style="width:' + pct + '%; background:' + colour + ';"></div>';
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="gssh-vr-factor-value">';
            if (f.value != null && f.source !== 'no_data' && f.source !== 'default') {
                html += f.value + ' ' + (f.unit || '');
            } else {
                html += '<em>est.</em>';
            }
            html += '</div>';
            html += '  <div class="gssh-vr-factor-pct" style="color:' + colour + ';">' + pct + '%</div>';
            html += '  <div class="gssh-vr-factor-range">Optimal (' + pathwayLabel + '): ' + (f.optimalRange || '—') + '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — PER-ZONE DLI BREAKDOWN (b35fix176 G7 — Option B)

       Shows zone-by-zone light delivery from the radial obstruction profile.
       EUE is a venue-level metric (climate uniform across the pitch); DLI is
       the zone-level metric that matters for large stadia where end-zones
       receive materially less light than the centre circle.

       Each zone shows:
         - DLI received (mol/m²/day)
         - Sufficiency % vs species DLI target (from shade engine thresholds)
         - Transmission % (fraction of ambient that reaches the zone)
         - Shaded hours
         - Status band (adequate / suboptimal / stressed / critical)

       Zones below the stress threshold are flagged ⚠.
    ========================================================================= */

    function renderZoneBreakdown(zoneEUE, compositeEUE) {
        // zoneEUE is kept as the parameter name for API compatibility but we
        // use zone.dli — the EUE scores are ignored in this view.
        if (!zoneEUE || zoneEUE.length < 2) return '';

        // Resolve DLI target from the shade orchestrator thresholds (species-aware)
        var dliTarget = null;
        var dliStress = null;
        var dliSurvival = null;
        try {
            var shade = (window.GSSH_ShadeOrchestrator || {}).currentShade;
            if (shade && shade.thresholds) {
                dliTarget   = shade.thresholds.target   || null;
                dliStress   = shade.thresholds.stress   || null;
                dliSurvival = shade.thresholds.survival || null;
            }
            // Fallback: EUE HOC target (no HOC provided → midpoint of default band)
            if (!dliTarget && window.GSSH_EUE && window.GSSH_EUE.getDLIForHOC) {
                var lastEUE = window.GSSH_EUE_Bridge && window.GSSH_EUE_Bridge.getLastEUE
                    ? window.GSSH_EUE_Bridge.getLastEUE() : null;
                var species  = lastEUE ? lastEUE.species  : 'couch';
                var goal     = lastEUE && lastEUE._effectiveManagementGoal
                    ? lastEUE._effectiveManagementGoal : 'maintenance';
                var hocResult = window.GSSH_EUE.getDLIForHOC(species, null, goal);
                if (hocResult) {
                    dliTarget   = hocResult.midpoint;
                    dliStress   = hocResult.min;
                    dliSurvival = hocResult.min * 0.7;
                }
            }
        } catch(e) {}

        var panelId = 'gssh-zone-breakdown-' + Date.now();

        // Classify each zone against thresholds
        var zones = zoneEUE.map(function(z) {
            var dli = z.dli;
            var suffPct = (dliTarget && dli != null) ? Math.round(dli / dliTarget * 100) : null;
            var status, statusColour, flagged;
            if (dli == null) {
                status = '—'; statusColour = 'var(--gaip-text-muted)'; flagged = false;
            } else if (!dliTarget) {
                status = dli + ' mol'; statusColour = 'var(--gaip-text-secondary)'; flagged = false;
            } else if (dli >= dliTarget) {
                status = 'Adequate'; statusColour = '#2e7d32'; flagged = false;
            } else if (dliStress && dli >= dliStress) {
                status = 'Suboptimal'; statusColour = '#f57c00'; flagged = true;
            } else if (dliSurvival && dli >= dliSurvival) {
                status = 'Stressed'; statusColour = '#d32f2f'; flagged = true;
            } else {
                status = 'Critical'; statusColour = '#b71c1c'; flagged = true;
            }
            return {
                zoneId:          z.zoneId,
                zoneName:        z.zoneName || z.zoneId,
                dli:             dli,
                shadeFactor:     z.shadeFactor,
                transmissionPct: z.transmissionPct,
                shadedHours:     null, // available on shadeData.zones if needed
                suffPct:         suffPct,
                status:          status,
                statusColour:    statusColour,
                flagged:         flagged
            };
        });

        var hasFlag = zones.some(function(z) { return z.flagged; });

        var html = '<div class="gssh-vr-section gssh-zone-breakdown">';
        html += '<div class="gssh-vr-section-header gssh-collapsible-trigger" ' +
                'onclick="GSSH_VenueReadinessUI.togglePanel(\'' + panelId + '\',this)" ' +
                'style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;">';
        html += '<span style="font-weight:600;font-size:13px;">📍 Zone Light Delivery' +
                (hasFlag ? ' <span style="color:#e05a2b;font-size:11px;margin-left:6px;">⚠ deficit zones</span>' : '') +
                '</span>';
        html += '<span class="gssh-collapse-arrow" style="font-size:11px;color:var(--gaip-text-muted);">▼ show</span>';
        html += '</div>';

        html += '<div id="' + panelId + '" class="gssh-collapsible-body" style="display:none;margin-top:8px;">';

        if (dliTarget) {
            html += '<p style="font-size:11px;color:var(--gaip-text-muted);margin:0 0 8px;">' +
                    'DLI per pitch zone from radial obstruction profile. ' +
                    'Target: <strong>' + dliTarget.toFixed(1) + ' mol/m²/day</strong> ' +
                    (dliStress ? '(stress threshold: ' + dliStress.toFixed(1) + ' mol).' : '.') +
                    ' Zones below target indicate LED supplementation priority areas.</p>';
        }

        html += '<table class="gssh-zone-table" style="width:100%;border-collapse:collapse;font-size:12px;">';
        html += '<thead><tr style="border-bottom:1px solid var(--gaip-border);">' +
                '<th style="text-align:left;padding:4px 6px;font-weight:600;">Zone</th>' +
                '<th style="text-align:right;padding:4px 6px;font-weight:600;">DLI</th>' +
                '<th style="text-align:right;padding:4px 6px;font-weight:600;">Sufficiency</th>' +
                '<th style="text-align:right;padding:4px 6px;font-weight:600;">Transmission</th>' +
                '<th style="text-align:left;padding:4px 6px;font-weight:600;">Status</th>' +
                '</tr></thead><tbody>';

        zones.forEach(function(z) {
            var rowBg = z.flagged ? 'background:var(--gaip-critical-bg);' : '';

            // Sufficiency bar (small inline bar)
            var barWidth = z.suffPct != null ? Math.min(100, z.suffPct) : 0;
            var barColour = z.statusColour;
            var suffBar = z.suffPct != null
                ? '<div style="display:inline-block;width:40px;height:6px;' +
                  'background:var(--gaip-surface-hover);border-radius:3px;vertical-align:middle;margin-left:4px;">' +
                  '<div style="width:' + barWidth + '%;height:100%;background:' + barColour +
                  ';border-radius:3px;"></div></div>'
                : '';

            html += '<tr style="border-bottom:1px solid var(--gaip-surface-hover);' + rowBg + '">';
            html += '<td style="padding:5px 6px;">' +
                    (z.flagged ? '<span style="color:#e05a2b;">⚠</span> ' : '') +
                    '<strong>' + (z.zoneName || z.zoneId) + '</strong></td>';
            html += '<td style="text-align:right;padding:5px 6px;font-variant-numeric:tabular-nums;">' +
                    (z.dli != null ? z.dli.toFixed(1) + ' mol' : '—') + '</td>';
            html += '<td style="text-align:right;padding:5px 6px;">' +
                    (z.suffPct != null ? z.suffPct + '%' : '—') + suffBar + '</td>';
            html += '<td style="text-align:right;padding:5px 6px;">' +
                    (z.transmissionPct != null ? z.transmissionPct.toFixed(0) + '%' : '—') + '</td>';
            html += '<td style="padding:5px 6px;color:' + z.statusColour + ';font-weight:600;">' +
                    z.status + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';

        // Spread callout
        var dlisWithValues = zones.filter(function(z) { return z.dli != null; });
        if (dlisWithValues.length >= 2) {
            var dlis   = dlisWithValues.map(function(z) { return z.dli; });
            var minDLI = Math.min.apply(null, dlis);
            var maxDLI = Math.max.apply(null, dlis);
            var spread = maxDLI - minDLI;
            if (spread >= 1) {
                html += '<p style="font-size:11px;margin:8px 0 0;color:var(--gaip-text-secondary);">' +
                        'DLI range across zones: <strong>' + minDLI.toFixed(1) +
                        ' – ' + maxDLI.toFixed(1) + ' mol/m²/day</strong> (' +
                        spread.toFixed(1) + ' mol spread). ' +
                        (spread >= 8
                            ? 'High within-pitch variation — end-zone LED coverage should be prioritised.'
                            : spread >= 4
                                ? 'Moderate variation — consider targeted supplemental placement.'
                                : 'Low variation — uniform coverage is appropriate.') +
                        '</p>';
            }
        }

        html += '</div>'; // collapsible body
        html += '</div>'; // section

        return html;
    }
    /* =========================================================================
       RENDER — LIMITING FACTORS
    ========================================================================= */

    function renderLimitingFactors(eueResult) {
        var factors = eueResult.limitingFactors;
        var html = '<div class="gssh-vr-limiting">';
        html += '<div class="gssh-vr-limiting-title">Limiting Factors</div>';

        for (var i = 0; i < Math.min(factors.length, 3); i++) {
            var lf = factors[i];
            var colour = lf.severity === 'critical' ? '#dc2626' : lf.severity === 'significant' ? '#ea580c' : '#ca8a04';
            html += '<div class="gssh-vr-limiting-item" style="border-left:3px solid ' + colour + ';">';
            html += '  <div class="gssh-vr-limiting-name">' + (FACTOR_ICONS[lf.factor] || '') + ' ' + (FACTOR_NAMES[lf.factor] || lf.factor) + '</div>';
            html += '  <div class="gssh-vr-limiting-detail">';
            html += '    Current: ' + (lf.value || '?') + ' ' + (lf.unit || '') + ' — Optimal: ' + (lf.optimalRange || '—');
            html += '    <span class="gssh-vr-limiting-loss">' + Math.round((1 - lf.efficiency) * 100) + '% efficiency loss</span>';
            html += '  </div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — WHAT-IF PROJECTIONS
       Shows cascading improvement from addressing limiting factors
    ========================================================================= */

    function renderProjections(projections, currentEUE) {
        if (!projections || !projections.steps || projections.steps.length === 0) return '';

        var html = '<div class="gssh-vr-projections">';
        html += '<div class="gssh-vr-projections-title">If you addressed these constraints</div>';

        // Progress chain visualisation
        html += '<div class="gssh-vr-projection-chain">';
        
        // Current state marker
        html += '<div class="gssh-vr-proj-current">';
        html += '  <div class="gssh-vr-proj-eue-val" style="color:' + getEUEColour(currentEUE) + ';">' + Math.round(currentEUE * 100) + '%</div>';
        html += '  <div class="gssh-vr-proj-eue-label">Current</div>';
        html += '</div>';

        for (var i = 0; i < projections.steps.length; i++) {
            var step = projections.steps[i];
            var isLast = (i === projections.steps.length - 1);

            // Arrow connector
            html += '<div class="gssh-vr-proj-arrow">\u2192</div>';

            // Step card
            html += '<div class="gssh-vr-proj-step' + (isLast ? ' gssh-vr-proj-step-final' : '') + '">';
            html += '  <div class="gssh-vr-proj-eue-val" style="color:' + getEUEColour(step.projectedEUE) + ';">' + Math.round(step.projectedEUE * 100) + '%</div>';
            html += '  <div class="gssh-vr-proj-intervention">' + step.intervention + '</div>';
            html += '  <div class="gssh-vr-proj-detail">' + step.detail + '</div>';
            html += '  <div class="gssh-vr-proj-gain">+' + step.improvementPct + '% efficiency</div>';
            if (step.newLimiter && !isLast) {
                var limiterName = (FACTOR_NAMES[step.newLimiter]) || step.newLimiterLabel || step.newLimiter;
                html += '  <div class="gssh-vr-proj-next-limiter">Next constraint: ' + limiterName + '</div>';
            }
            html += '</div>';
        }

        html += '</div>'; // end chain

        // Summary
        var best = projections.bestCaseEUE;
        var totalGain = Math.round(projections.totalImprovement * 100);
        html += '<div class="gssh-vr-proj-summary">';
        html += '  Addressing ' + projections.stepsCount + ' constraint' + (projections.stepsCount > 1 ? 's' : '');
        html += '  would raise LED utilisation from ' + Math.round(currentEUE * 100) + '% to ' + Math.round(best * 100) + '%';
        html += '  — recovering ~' + totalGain + '% of currently wasted photons.';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — ADVISORY ACTIONS
    ========================================================================= */

    function renderAdvisory(advisory) {
        var html = '<div class="gssh-vr-advisory">';
        html += '<div class="gssh-vr-advisory-title">Recommended Actions</div>';

        for (var i = 0; i < advisory.actions.length; i++) {
            var action = advisory.actions[i];
            var priorityColour = action.severity === 'critical' ? '#dc2626' : action.severity === 'significant' ? '#ea580c' : '#2563eb';
            html += '<div class="gssh-vr-advisory-item">';
            html += '  <div class="gssh-vr-advisory-factor" style="color:' + priorityColour + ';">' + action.factor + '</div>';
            html += '  <div class="gssh-vr-advisory-action">' + action.action + '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — SPECTRAL PRESCRIPTION
    ========================================================================= */

    function renderSpectral(spectral) {
        if (!spectral || !spectral.spectrum) return '';

        var html = '<div class="gssh-vr-spectral">';
        html += '<div class="gssh-vr-spectral-title">Spectral Prescription: ' + (spectral.label || '') + '</div>';

        // Spectrum bar visualisation
        var s = spectral.spectrum;
        var total = (s.red660 || 0) + (s.blue450 || 0) + (s.green520 || 0) + (s.farRed730 || 0);
        if (total > 0) {
            html += '<div class="gssh-vr-spectrum-bar">';
            if (s.blue450) html += '<div class="gssh-vr-spectrum-segment" style="width:' + (s.blue450 / total * 100) + '%; background:#3b82f6;" title="Blue 450nm: ' + s.blue450 + '%">' + s.blue450 + '%</div>';
            if (s.green520) html += '<div class="gssh-vr-spectrum-segment" style="width:' + (s.green520 / total * 100) + '%; background:#22c55e;" title="Green 520nm: ' + s.green520 + '%">' + s.green520 + '%</div>';
            if (s.red660) html += '<div class="gssh-vr-spectrum-segment" style="width:' + (s.red660 / total * 100) + '%; background:#ef4444;" title="Red 660nm: ' + s.red660 + '%">' + s.red660 + '%</div>';
            if (s.farRed730) html += '<div class="gssh-vr-spectrum-segment" style="width:' + (s.farRed730 / total * 100) + '%; background:#7c3aed;" title="Far-red 730nm: ' + s.farRed730 + '%">' + s.farRed730 + '%</div>';
            html += '</div>';

            html += '<div class="gssh-vr-spectrum-legend">';
            html += '<span style="color:#3b82f6;">Blue 450nm</span> · ';
            html += '<span style="color:#22c55e;">Green 520nm</span> · ';
            html += '<span style="color:#ef4444;">Red 660nm</span> · ';
            html += '<span style="color:#7c3aed;">Far-red 730nm</span>';
            html += '</div>';
        }

        // Phytochrome note
        if (spectral.phytochromeNote) {
            html += '<div class="gssh-vr-spectral-note">' + spectral.phytochromeNote + '</div>';
        }

        // Overseed blend note
        if (spectral.blendNote) {
            html += '<div class="gssh-vr-spectral-blend" style="margin-top:6px;padding:6px 8px;background:var(--gaip-info-bg);border-left:3px solid #3b82f6;border-radius:3px;font-size:12px;color:#1e40af;">🌱 ' + spectral.blendNote + '</div>';
        }

        // Seasonal adjustment note
        if (spectral.seasonalNote) {
            html += '<div class="gssh-vr-spectral-seasonal">' + spectral.seasonalNote + '</div>';
        }

        // Equipment compatibility
        if (spectral.equipmentNote) {
            html += '<div class="gssh-vr-spectral-compat">' + spectral.equipmentNote + '</div>';
        }

        // Far-red warning
        if (spectral.maxFarRedWarning) {
            html += '<div class="gssh-vr-spectral-warn">\u26a0 ' + spectral.maxFarRedWarning + '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — HOC-AWARE DLI TARGET
    ========================================================================= */

    function renderHOCTarget(hocTarget, venueConfig, effectiveGoal) {
        if (!hocTarget) return '';

        var html = '<div class="gssh-vr-hoc">';
        html += '<div class="gssh-vr-hoc-title">DLI Target (HOC-adjusted)</div>';
        html += '<div class="gssh-vr-hoc-range">';
        html += '  <span class="gssh-vr-hoc-values">' + hocTarget.min + '–' + hocTarget.max + ' mol/m²/day</span>';
        html += '  <span class="gssh-vr-hoc-band">' + hocTarget.band + '</span>';
        html += '  <span class="gssh-vr-hoc-goal">' + (effectiveGoal || (venueConfig ? venueConfig.managementGoal : 'maintenance')) + '</span>';
        html += '</div>';
        if (hocTarget.warning) {
            html += '<div class="gssh-vr-hoc-warn">⚠ ' + hocTarget.warning + '</div>';
        }
        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — IRRIGATION ADVISORY
    ========================================================================= */

    function renderIrrigationAdvisory(advisory) {
        if (!advisory || !advisory.recalibrationRequired) return '';

        var borderColour = advisory.urgency === 'critical' ? '#dc2626' : '#2563eb';

        var html = '<div class="gssh-vr-irrigation" style="border-left:3px solid ' + borderColour + ';">';
        html += '<div class="gssh-vr-irrigation-title">💧 Irrigation Recalibration Required</div>';

        for (var i = 0; i < advisory.actions.length; i++) {
            var action = advisory.actions[i];
            html += '<div class="gssh-vr-irrigation-action">';
            html += '  <div class="gssh-vr-irrigation-action-text">' + action.action + '</div>';
            html += '  <div class="gssh-vr-irrigation-detail">' + action.detail + '</div>';
            html += '  <div class="gssh-vr-irrigation-source">' + action.source + '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — CONFIG PANEL
    ========================================================================= */

    function renderChemistryPanel(chemistry) {
        if (!chemistry) return '';

        var html = '<div class="gssh-chem-panel">';

        // Tissue test missing advisory (Pathway B unknown)
        if (chemistry.pathwayB && chemistry.pathwayB.unknown) {
            html += '<div class="gssh-chem-tissue-advisory">' +
                '<span class="gssh-chem-icon">🔬</span>' +
                '<div>' +
                    '<div class="gssh-chem-advisory-title">Tissue Test Required</div>' +
                    '<div class="gssh-chem-advisory-text">' + chemistry.pathwayB.message + '</div>' +
                '</div>' +
            '</div>';
        }

        // Chemistry modifier summary (if active)
        if (chemistry.modifier != null && chemistry.modifier < 0.98) {
            var modPct = Math.round(chemistry.modifier * 100);
            var modColour = chemistry.modifier >= 0.85 ? '#ca8a04' : chemistry.modifier >= 0.65 ? '#ea580c' : '#dc2626';
            html += '<div class="gssh-chem-modifier" style="border-left: 3px solid ' + modColour + ';">' +
                '<span style="font-weight:700;color:' + modColour + ';">' +
                    'Chemistry modifier: ' + modPct + '%' +
                '</span>' +
                '<span class="gssh-chem-modifier-label"> — photon utilisation reduced by root zone and/or foliar chemistry</span>' +
            '</div>';
        }

        // Juvenile overseed flag
        if (chemistry.isJuvenile) {
            html += '<div class="gssh-chem-juvenile">' +
                '🌱 <strong>Juvenile overseed window</strong> — elevated sensitivity to EC and Na stress (28-day establishment period). ' +
                'Salt thresholds reduced. Monitor water EC closely.' +
            '</div>';
        }

        // Chemistry warnings
        var warnings = chemistry.warnings || [];
        if (warnings.length > 0) {
            html += '<div class="gssh-chem-warnings">';
            for (var i = 0; i < warnings.length; i++) {
                var isIrrigation = warnings[i].indexOf('Irrigation schedule') !== -1 ||
                                   warnings[i].indexOf('recalibrated') !== -1;
                html += '<div class="gssh-chem-warning' + (isIrrigation ? ' gssh-chem-warning-irr' : '') + '">' +
                    warnings[i] + '</div>';
            }
            html += '</div>';
        }

        html += '</div>';

        // If no content generated, return empty
        if (chemistry.modifier >= 0.98 && (!chemistry.pathwayB || !chemistry.pathwayB.unknown) &&
            warnings.length === 0 && !chemistry.isJuvenile) {
            return '';
        }
        return html;
    }

    function renderConfigPanel(config) {
        var html = '<div class="gssh-vr-config" id="gssh-vr-config" style="display:none;">';
        html += '<div class="gssh-vr-config-title">Venue Environment Configuration</div>';
        html += '<div class="gssh-vr-config-desc">Configure environmental parameters for accurate LED utilisation assessment. Parameters the Hub cannot derive from weather data.</div>';

        // Enclosure type
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Stadium Enclosure</label>';
        html += '  <select id="gssh-vr-enclosure" class="gssh-vr-select">';
        var enclosureOptions = [
            ['open', 'Open air / no roof'],
            ['partial', 'Partial roof (stands only)'],
            ['retractable_open', 'Retractable roof — open'],
            ['retractable_closed', 'Retractable roof — closed'],
            ['fixed_roof', 'Fixed roof / fully covered'],
            ['enclosed', 'Fully enclosed (indoor)'],
            ['enclosed_enriched', 'Enclosed with CO₂ enrichment']
        ];
        for (var i = 0; i < enclosureOptions.length; i++) {
            var sel = config.enclosureType === enclosureOptions[i][0] ? ' selected' : '';
            html += '<option value="' + enclosureOptions[i][0] + '"' + sel + '>' + enclosureOptions[i][1] + '</option>';
        }
        html += '  </select>';
        html += '</div>';

        // Drainage
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Drainage Quality</label>';
        html += '  <select id="gssh-vr-drainage" class="gssh-vr-select">';
        var drainageOptions = [
            [1.0, 'Excellent (USGA spec / sand-based)'],
            [0.85, 'Good (standard professional)'],
            [0.65, 'Moderate (clay-based / older construction)'],
            [0.45, 'Poor (known drainage issues)'],
            [0.25, 'Very poor (waterlogging common)']
        ];
        for (var j = 0; j < drainageOptions.length; j++) {
            var dSel = Math.abs((config.drainageRating || 0.85) - drainageOptions[j][0]) < 0.1 ? ' selected' : '';
            html += '<option value="' + drainageOptions[j][0] + '"' + dSel + '>' + drainageOptions[j][1] + '</option>';
        }
        html += '  </select>';
        html += '</div>';

        // Manual ECe override
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Root-Zone ECe (dS/m) <span style="font-weight:400;font-size:11px;">(optional — overrides automatic EC conversion)</span></label>';
        html += '  <input type="number" id="gssh-vr-manual-ece" class="gssh-vr-input" min="0" max="50" step="0.1" value="' + (config.manualECe || '') + '" placeholder="Leave blank for automatic">';
        html += '</div>';

        // Overseed application date
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Overseed Application Date <span style="font-weight:400;font-size:11px;">(for 28-day juvenile EC sensitivity window)</span></label>';
        html += '  <input type="date" id="gssh-vr-overseed-date" class="gssh-vr-input" value="' + (config.overseedApplicationDate || '') + '">';
        html += '</div>';

        // HOC
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Height of Cut (mm)</label>';
        html += '  <input type="number" id="gssh-vr-hoc" class="gssh-vr-input" min="3" max="60" step="1" value="' + (config.hocMM || '') + '" placeholder="Species default">';
        html += '  <div class="gssh-vr-config-help">DLI requirement varies significantly with mowing height. Lower HOC = higher DLI needed.</div>';
        html += '</div>';

        // Management goal
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Management Goal</label>';
        html += '  <select id="gssh-vr-goal" class="gssh-vr-select">';
        var goalOptions = [
            ['maintenance', 'Maintenance — sustain current quality'],
            ['strengthening', 'Strengthening — build density/recovery'],
            ['recovery', 'Post-event recovery'],
            ['establishment', 'Establishment / renovation']
        ];
        for (var g = 0; g < goalOptions.length; g++) {
            var gSel = config.managementGoal === goalOptions[g][0] ? ' selected' : '';
            html += '<option value="' + goalOptions[g][0] + '"' + gSel + '>' + goalOptions[g][1] + '</option>';
        }
        html += '  </select>';
        html += '</div>';

        // Airflow
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Active Air Management</label>';
        html += '  <div class="gssh-vr-checkbox-row">';
        html += '    <input type="checkbox" id="gssh-vr-fans" ' + (config.hasFans ? 'checked' : '') + '>';
        html += '    <span>Venue has active fan / air circulation system</span>';
        html += '  </div>';
        html += '</div>';

        // Sub-soil heating
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Sub-soil Heating</label>';
        html += '  <div class="gssh-vr-checkbox-row">';
        html += '    <input type="checkbox" id="gssh-vr-heating" ' + (config.hasSubSoilHeating ? 'checked' : '') + '>';
        html += '    <span>Under-pitch heating system installed</span>';
        html += '  </div>';
        html += '</div>';

        // Irrigation recalibration
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Irrigation Status</label>';
        html += '  <div class="gssh-vr-checkbox-row">';
        html += '    <input type="checkbox" id="gssh-vr-irrigation" ' + (config.irrigationAdjustedForLED ? 'checked' : '') + '>';
        html += '    <span>Irrigation schedule recalibrated for LED operation</span>';
        html += '  </div>';
        html += '</div>';

        // ── G1: Electricity tariff ──────────────────────────────────
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Electricity Tariff ($/kWh)</label>';
        html += '  <input type="number" id="gssh-vr-kwh-rate" class="gssh-vr-input" min="0" max="5" step="0.01" value="' + (config.kwhRate || '') + '" placeholder="e.g. 0.28">';
        html += '  <div class="gssh-vr-config-help">Used for seasonal operating cost calculation in the LED export report. Leave blank to use default ($0.30/kWh).</div>';
        html += '</div>';

        // ── G2: LED session start time ──────────────────────────────
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Typical LED Session Start Time</label>';
        var sessionHour = config.sessionStartHour != null ? config.sessionStartHour : '';
        html += '  <select id="gssh-vr-session-hour" class="gssh-vr-select">';
        html += '  <option value="">Not specified (auto-detect from solar DLI)</option>';
        for (var sh = 0; sh < 24; sh++) {
            var shLabel = sh === 0 ? '00:00 (midnight)' :
                          sh < 12 ? sh + ':00 am' :
                          sh === 12 ? '12:00 noon' :
                          (sh - 12) + ':00 pm';
            var shSel = (sessionHour === sh || sessionHour === String(sh)) ? ' selected' : '';
            html += '  <option value="' + sh + '"' + shSel + '>' + shLabel + '</option>';
        }
        html += '  </select>';
        html += '  <div class="gssh-vr-config-help">Determines spectral prescription. Overnight sessions (after sunset) receive elevated blue fraction for stomatal regulation when solar contribution is absent.</div>';
        html += '</div>';

        // ── G3: Equipment type (HPS → LED transition detection) ─────
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Light System Type</label>';
        html += '  <select id="gssh-vr-equipment-type" class="gssh-vr-select">';
        var eqOptions = [
            ['led', 'LED supplemental lighting'],
            ['hps', 'HPS (High Pressure Sodium) — legacy'],
            ['hps_to_led', 'Transitioning HPS → LED'],
            ['none', 'No supplemental lighting']
        ];
        for (var eq = 0; eq < eqOptions.length; eq++) {
            var eqSel = config.equipmentSystemType === eqOptions[eq][0] ? ' selected' : '';
            html += '  <option value="' + eqOptions[eq][0] + '"' + eqSel + '>' + eqOptions[eq][1] + '</option>';
        }
        html += '  </select>';
        html += '</div>';

        // ── b35fix177: Overseed toggle ───────────────────────────────
        var _month = new Date().getMonth();
        var _calendarOverseed = (_month >= 1 && _month <= 8);
        var _overseedChecked = config.overseedActive === true ||
                               (config.overseedActive == null && _calendarOverseed);
        var _overseedAuto = config.overseedActive == null;
        html += '<div class="gssh-vr-config-row">';
        html += '  <label>Ryegrass Overseed Active</label>';
        html += '  <div style="display:flex;align-items:center;gap:10px;">';
        html += '    <input type="checkbox" id="gssh-vr-overseed" ' + (_overseedChecked ? 'checked' : '') + '>';
        html += '    <span style="font-size:12px;color:var(--gaip-text-secondary);">Zone DLI sufficiency scored against ryegrass target (25 mol/m²/day)</span>';
        html += '  </div>';
        html += '  <div class="gssh-vr-config-help">' +
                (_overseedAuto
                    ? 'Auto (calendar): ryegrass thresholds active Feb–Sep. Manually override if your overseed programme differs.'
                    : 'Manual override active. Tick/untick to change, then save.') +
                '</div>';
        html += '</div>';

        // Save button
        html += '<div class="gssh-vr-config-actions">';
        html += '  <button class="gssh-vr-save-btn" onclick="GSSH_VenueReadinessUI.saveConfig()">Save &amp; Recalculate</button>';
        html += '  <button class="gssh-vr-cancel-btn" onclick="GSSH_VenueReadinessUI.toggleConfig()">Cancel</button>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* =========================================================================
       RENDER — PLACEHOLDER (no EUE data yet)
    ========================================================================= */

    function renderPlaceholder() {
        return '<div class="gssh-vr-card gssh-vr-placeholder">' +
            '<div class="gssh-vr-badge" style="color:var(--gaip-text-secondary);">' +
            '  <span class="gssh-vr-icon">◯</span>' +
            '  <span class="gssh-vr-label">Growth Environment Assessment</span>' +
            '</div>' +
            '<div class="gssh-vr-placeholder-text">' +
            'Waiting for climate data and venue configuration. ' +
            'Select a venue and ensure weather data is available to see the environmental utilisation assessment.' +
            '</div>' +
            '</div>';
    }

    /* =========================================================================
       UTILITY — COLOUR SCALES
    ========================================================================= */

    function getEfficiencyColour(eff) {
        if (eff >= 0.85) return '#16a34a';
        if (eff >= 0.6)  return '#ca8a04';
        if (eff >= 0.3)  return '#ea580c';
        return '#dc2626';
    }

    function getEUEColour(eue) {
        if (eue >= 0.85) return '#16a34a';
        if (eue >= 0.6)  return '#ca8a04';
        if (eue >= 0.3)  return '#ea580c';
        return '#dc2626';
    }

    /* =========================================================================
       TOGGLE / INTERACTION
    ========================================================================= */

    function toggleFactors() {
        var detail = document.getElementById('gssh-vr-factors-detail');
        var icon = document.getElementById('gssh-vr-expand-icon');
        if (detail) {
            var show = detail.style.display === 'none';
            detail.style.display = show ? 'block' : 'none';
            if (icon) icon.textContent = show ? '▾' : '▸';
        }
    }

    function toggleConfig() {
        var panel = document.getElementById('gssh-vr-config');
        if (panel) {
            var opening = panel.style.display === 'none';
            panel.style.display = opening ? 'block' : 'none';
            if (opening) {
                setTimeout(function() {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }
    }

    function saveConfig() {
        var config = {
            enclosureType: getVal('gssh-vr-enclosure'),
            drainageRating: parseFloat(getVal('gssh-vr-drainage')) || 0.85,
            hocMM: parseInt(getVal('gssh-vr-hoc'), 10) || null,
            managementGoal: getVal('gssh-vr-goal') || 'maintenance',
            hasFans: getChecked('gssh-vr-fans'),
            hasSubSoilHeating: getChecked('gssh-vr-heating'),
            irrigationAdjustedForLED: getChecked('gssh-vr-irrigation')
        };

        // b35fix177: overseed toggle — store as explicit boolean (manual override)
        // The checkbox was pre-ticked based on either the saved value or the calendar
        // default. On save we always store the explicit boolean so subsequent loads
        // respect the user's choice rather than reverting to auto.
        var overseedEl = document.getElementById('gssh-vr-overseed');
        config.overseedActive = overseedEl ? overseedEl.checked : null;

        // Sub-soil heating adjusts root-zone temp estimate
        // (not modelled directly, but flags it for the EUE engine)

        // G1: Electricity tariff
        var kwhEl = document.getElementById('gssh-vr-kwh-rate');
        config.kwhRate = (kwhEl && kwhEl.value) ? parseFloat(kwhEl.value) || null : null;

        // G2: Session start hour
        var sessionHourEl = document.getElementById('gssh-vr-session-hour');
        config.sessionStartHour = (sessionHourEl && sessionHourEl.value !== '')
            ? parseInt(sessionHourEl.value, 10) : null;

        // G3: Equipment system type + HPS→LED transition warning
        var eqTypeEl = document.getElementById('gssh-vr-equipment-type');
        var prevType = config.equipmentSystemType;
        config.equipmentSystemType = eqTypeEl ? eqTypeEl.value : 'led';
        if (prevType === 'hps' && config.equipmentSystemType === 'led') {
            // Transition just flagged — inject persistent warning banner
            var existing = document.getElementById('gssh-hps-led-banner');
            if (!existing) {
                var banner = document.createElement('div');
                banner.id = 'gssh-hps-led-banner';
                banner.className = 'gssh-hps-led-banner';
                banner.textContent = '';
                var strong = document.createElement('strong');
                strong.textContent = 'HPS → LED Transition Detected';
                var msg = document.createTextNode(
                    ' HPS systems deliver significant radiant heat to the canopy (~30-40% of input power ' +
                    'as near-infrared), which raises leaf temperature and which the plant physiology adapts to over time. ' +
                    'Switching to LED removes this heat source without changing photon delivery. ' +
                    'Expect: lower canopy temperature (may require root-zone heating review in winter), ' +
                    'increased irrigation demand (no IR drying effect), and possible initial growth rate reduction ' +
                    'as the plant adjusts enzyme kinetics to cooler leaf temperatures. ' +
                    'Re-assess EUE root-zone and leaf temperature factors after first full season under LED.'
                );
                var closeBtn = document.createElement('button');
                closeBtn.textContent = '✕';
                closeBtn.style.cssText = 'float:right;margin-top:-2px;background:none;border:none;cursor:pointer;font-size:14px;';
                closeBtn.onclick = function() { this.parentNode.style.display = 'none'; };
                banner.appendChild(closeBtn);
                banner.appendChild(strong);
                banner.appendChild(document.createElement('br'));
                banner.appendChild(msg);
                var container = document.getElementById('gssh-venue-readiness');
                if (container && container.parentNode) {
                    container.parentNode.insertBefore(banner, container);
                }
            }
        }
        // If transitioning HPS→LED is set, also mark in config
        if (config.equipmentSystemType === 'hps_to_led') {
            config._hpsToLedTransition = true;
        }

        // New chemistry coupling fields
        var manualECeEl = document.getElementById('gssh-vr-manual-ece');
        if (manualECeEl && manualECeEl.value) config.manualECe = parseFloat(manualECeEl.value) || null;
        var overseedDateEl = document.getElementById('gssh-vr-overseed-date');
        if (overseedDateEl && overseedDateEl.value) config.overseedApplicationDate = overseedDateEl.value || null;

        if (global.GSSH_EUE_Bridge && typeof global.GSSH_EUE_Bridge.setVenueEnvConfig === 'function') {
            global.GSSH_EUE_Bridge.setVenueEnvConfig(config);
        }

        toggleConfig();
        log('Config saved: ' + JSON.stringify(config));
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? el.value : null;
    }

    function getChecked(id) {
        var el = document.getElementById(id);
        return el ? el.checked : false;
    }

    /* =========================================================================
       EVENT LISTENER — auto-render when EUE calculates
    ========================================================================= */

    function setupListeners() {
        document.addEventListener('gssh:eueCalculated', function(e) {
            render(e.detail);
        });
    }

    /* =========================================================================
       INJECT CSS
    ========================================================================= */

    function injectStyles() {
        if (document.getElementById('gssh-vr-styles')) return;

        var css = '' +
            '.gssh-vr-card { padding: 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; line-height: 1.5; }' +
            '.gssh-vr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }' +
            '.gssh-vr-badge { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }' +
            '.gssh-vr-icon { font-size: 18px; }' +
            '.gssh-vr-score { font-size: 20px; font-weight: 700; margin-left: 8px; }' +
            '.gssh-vr-config-btn { background: none; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 16px; }' +
            '.gssh-vr-config-btn:hover { background: rgba(0,0,0,0.05); }' +

            '.gssh-vr-eue-bar { margin-bottom: 12px; }' +
            '.gssh-vr-eue-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gaip-text-secondary); margin-bottom: 4px; }' +
            '.gssh-vr-eue-track { height: 8px; background: var(--gaip-border); border-radius: 4px; overflow: hidden; }' +
            '.gssh-vr-eue-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }' +
            '.gssh-vr-eue-value { font-size: 12px; color: var(--gaip-text); margin-top: 3px; }' +
            '.gssh-vr-eue-waste { font-size: 11px; font-weight: 600; margin-top: 2px; }' +

            '.gssh-vr-factors { margin-bottom: 12px; }' +
            '.gssh-vr-factors-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 6px 0; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gaip-text); }' +
            '.gssh-vr-expand-icon { font-size: 14px; }' +
            '.gssh-vr-factors-summary { display: flex; gap: 6px; margin: 4px 0; }' +
            '.gssh-vr-dot { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.9; }' +

            '.gssh-vr-factor-grid { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }' +
            '.gssh-vr-factor-row { display: grid; grid-template-columns: 180px 1fr 80px 45px; gap: 8px; align-items: center; font-size: 12px; }' +
            '.gssh-vr-factor-label { display: flex; align-items: center; gap: 6px; }' +
            '.gssh-vr-factor-icon { font-size: 14px; }' +
            '.gssh-vr-factor-bar-wrap { width: 100%; }' +
            '.gssh-vr-factor-bar { height: 6px; background: var(--gaip-border); border-radius: 3px; overflow: hidden; }' +
            '.gssh-vr-factor-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }' +
            '.gssh-vr-factor-value { text-align: right; color: var(--gaip-text-secondary); font-size: 11px; }' +
            '.gssh-vr-factor-pct { font-weight: 600; text-align: right; }' +
            '.gssh-vr-factor-range { grid-column: 1 / -1; font-size: 10px; color: var(--gaip-text-muted); padding-left: 26px; margin-top: -4px; }' +

            '.gssh-vr-limiting { margin-bottom: 12px; }' +
            '.gssh-vr-limiting-title { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gaip-text); margin-bottom: 6px; }' +
            '.gssh-vr-limiting-item { padding: 8px 12px; background: rgba(0,0,0,0.03); border-radius: 6px; margin-bottom: 6px; }' +
            '.gssh-vr-limiting-name { font-weight: 600; font-size: 13px; }' +
            '.gssh-vr-limiting-detail { font-size: 11px; color: var(--gaip-text-secondary); margin-top: 2px; }' +
            '.gssh-vr-limiting-loss { font-weight: 600; color: #ea580c; margin-left: 8px; }' +

            '.gssh-vr-advisory { margin-bottom: 12px; }' +
            '.gssh-vr-advisory-title { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gaip-text); margin-bottom: 6px; }' +
            '.gssh-vr-advisory-item { padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }' +
            '.gssh-vr-advisory-factor { font-size: 11px; font-weight: 600; }' +
            '.gssh-vr-advisory-action { font-size: 12px; color: var(--gaip-text); }' +

            '.gssh-vr-spectral { margin-bottom: 12px; padding: 10px 12px; background: rgba(0,0,0,0.02); border-radius: 6px; }' +
            '.gssh-vr-spectral-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }' +
            '.gssh-vr-spectrum-bar { display: flex; height: 24px; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }' +
            '.gssh-vr-spectrum-segment { display: flex; align-items: center; justify-content: center; color: var(--gaip-surface); font-size: 10px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3); min-width: 30px; }' +
            '.gssh-vr-spectrum-legend { font-size: 10px; color: var(--gaip-text-secondary); }' +
            '.gssh-vr-spectral-note { font-size: 11px; color: var(--gaip-text); margin-top: 6px; }' +
            '.gssh-vr-spectral-seasonal { font-size: 11px; color: #92400e; background: var(--gaip-warning-bg); padding: 6px 10px; border-radius: 4px; margin-top: 6px; }' +
            '.gssh-vr-projections { margin-top: 14px; padding: 12px; background: var(--gaip-good-bg); border: 1px solid var(--gaip-good-bg); border-radius: 8px; }' +
            '.gssh-vr-projections-title { font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 10px; }' +
            '.gssh-vr-projection-chain { display: flex; align-items: flex-start; gap: 6px; overflow-x: auto; padding-bottom: 4px; }' +
            '.gssh-vr-proj-current { text-align: center; min-width: 56px; flex-shrink: 0; }' +
            '.gssh-vr-proj-arrow { color: var(--gaip-text-muted); font-size: 18px; line-height: 32px; flex-shrink: 0; }' +
            '.gssh-vr-proj-step { background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 6px; padding: 8px 10px; min-width: 130px; max-width: 180px; flex-shrink: 0; }' +
            '.gssh-vr-proj-step-final { border-color: #22c55e; background: var(--gaip-good-bg); }' +
            '.gssh-vr-proj-eue-val { font-size: 20px; font-weight: 700; }' +
            '.gssh-vr-proj-eue-label { font-size: 10px; color: var(--gaip-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }' +
            '.gssh-vr-proj-intervention { font-size: 11px; font-weight: 600; color: var(--gaip-text); margin-top: 4px; }' +
            '.gssh-vr-proj-detail { font-size: 10px; color: var(--gaip-text-secondary); margin-top: 2px; }' +
            '.gssh-vr-proj-gain { font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 3px; }' +
            '.gssh-vr-proj-next-limiter { font-size: 9px; color: var(--gaip-text-muted); margin-top: 3px; font-style: italic; }' +
            '.gssh-vr-proj-summary { font-size: 12px; color: #166534; margin-top: 10px; line-height: 1.5; }' +
            '.gssh-vr-spectral-compat { font-size: 10px; color: var(--gaip-text-muted); margin-top: 4px; font-style: italic; }' +
            '.gssh-vr-spectral-warn { font-size: 11px; color: #dc2626; margin-top: 4px; }' +
            '.gssh-vr-spectral-source { font-size: 10px; color: var(--gaip-text-muted); margin-top: 4px; }' +

            '.gssh-vr-hoc { margin-bottom: 12px; padding: 8px 12px; background: rgba(37,99,235,0.05); border-radius: 6px; }' +
            '.gssh-vr-hoc-title { font-weight: 600; font-size: 12px; color: #1e40af; margin-bottom: 4px; }' +
            '.gssh-vr-hoc-range { display: flex; gap: 12px; align-items: baseline; }' +
            '.gssh-vr-hoc-values { font-size: 16px; font-weight: 700; color: #1e40af; }' +
            '.gssh-vr-hoc-band { font-size: 11px; color: var(--gaip-text-secondary); }' +
            '.gssh-vr-hoc-goal { font-size: 10px; color: var(--gaip-text-muted); text-transform: uppercase; }' +
            '.gssh-vr-hoc-warn { font-size: 10px; color: #ea580c; margin-top: 4px; }' +

            '.gssh-vr-irrigation { margin-bottom: 12px; padding: 10px 12px; background: rgba(37,99,235,0.04); border-radius: 6px; }' +
            '.gssh-vr-irrigation-title { font-weight: 600; font-size: 13px; color: #1e40af; margin-bottom: 6px; }' +
            '.gssh-vr-irrigation-action { padding: 6px 0; }' +
            '.gssh-vr-irrigation-action-text { font-weight: 600; font-size: 12px; }' +
            '.gssh-vr-irrigation-detail { font-size: 11px; color: var(--gaip-text); margin-top: 2px; }' +
            '.gssh-vr-irrigation-source { font-size: 10px; color: var(--gaip-text-muted); margin-top: 2px; font-style: italic; }' +

            '.gssh-vr-confidence { font-size: 10px; color: var(--gaip-text-muted); padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05); }' +

            '.gssh-vr-placeholder { background: var(--gaip-surface-muted); border-left: 4px solid var(--gaip-border); }' +
            '.gssh-vr-placeholder-text { font-size: 12px; color: var(--gaip-text-muted); margin-top: 8px; }' +

            /* Config panel */
            '.gssh-vr-config { padding: 16px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 8px; margin-bottom: 16px; }' +
            '.gssh-vr-config-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }' +
            '.gssh-vr-config-desc { font-size: 11px; color: var(--gaip-text-secondary); margin-bottom: 12px; }' +
            '.gssh-vr-config-row { margin-bottom: 12px; }' +
            '.gssh-vr-config-row label { display: block; font-weight: 600; font-size: 12px; margin-bottom: 4px; color: var(--gaip-text); }' +
            '.gssh-vr-select, .gssh-vr-input { width: 100%; padding: 7px 10px; border: 1px solid var(--gaip-border); border-radius: 6px; font-size: 12px; background: var(--gaip-surface); color: var(--gaip-text); }' +
            '.gssh-vr-input::placeholder { color: var(--gaip-text-muted); }' +
            '.gssh-vr-config-help { font-size: 10px; color: var(--gaip-text-muted); margin-top: 3px; }' +
            '.gssh-vr-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }' +
            '.gssh-vr-config-actions { display: flex; gap: 8px; margin-top: 16px; }' +
            '.gssh-vr-save-btn { padding: 8px 20px; background: #2563eb; color: var(--gaip-surface); border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }' +
            '.gssh-vr-save-btn:hover { background: #1d4ed8; }' +
            '.gssh-vr-cancel-btn { padding: 8px 16px; background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 6px; font-size: 13px; cursor: pointer; }' +
            '';

        // HPS→LED transition banner style
        css +=
            '.gssh-hps-led-banner { background: var(--gaip-warning-bg); border: 2px solid #d97706; border-radius: 8px; ' +
            'padding: 12px 16px; margin-bottom: 10px; font-size: 12px; color: var(--gaip-text); line-height: 1.5; }' +
            '.gssh-hps-led-banner strong { color: #92400e; }';

        // Chemistry panel styles
        css +=
            '.gssh-chem-panel { margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }' +
            '.gssh-chem-tissue-advisory { display: flex; gap: 10px; align-items: flex-start; background: var(--gaip-info-bg); border: 1.5px solid #3b82f6; border-radius: 8px; padding: 10px 12px; }' +
            '.gssh-chem-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }' +
            '.gssh-chem-advisory-title { font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 2px; }' +
            '.gssh-chem-advisory-text { font-size: 11px; color: var(--gaip-text); line-height: 1.4; }' +
            '.gssh-chem-modifier { background: var(--gaip-warning-bg); border-radius: 6px; padding: 8px 12px; font-size: 12px; }' +
            '.gssh-chem-modifier-label { color: var(--gaip-text-secondary); }' +
            '.gssh-chem-juvenile { background: var(--gaip-good-bg); border: 1px solid #86efac; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #166534; }' +
            '.gssh-chem-warnings { display: flex; flex-direction: column; gap: 4px; }' +
            '.gssh-chem-warning { background: var(--gaip-warning-bg); border-left: 3px solid #ea580c; padding: 7px 10px; font-size: 11px; color: var(--gaip-text); border-radius: 0 4px 4px 0; line-height: 1.4; }' +
            '.gssh-chem-warning-irr { background: var(--gaip-warning-bg); border-left-color: #d97706; font-weight: 500; }';

        var style = document.createElement('style');
        style.id = 'gssh-vr-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* =========================================================================
       RETRACTABLE ROOF STATE BANNER
       Injected above the venue readiness card for any venue whose structures
       include a retractable_roof entry. Provides a persistent open/closed
       toggle that immediately updates enclosureType and triggers EUE re-calc.
    ========================================================================= */

    var ROOF_BANNER_ID = 'gssh-roof-state-banner';
    var _currentRoofVenueId = null;
    var _currentRoofState = 'retractable_open'; // default open until user says otherwise

    /**
     * Check whether a venue has a retractable roof in its structures list.
     * Works from the raw venue object passed via gssh:venueSelect event.
     */
    function venueHasRetractableRoof(venue) {
        if (!venue || !Array.isArray(venue.structures)) return false;
        return venue.structures.some(function(s) {
            return s.type === 'roof' &&
                   (s.structure_id || '').toLowerCase().indexOf('retractable') !== -1;
        });
    }

    /**
     * Render or update the roof state banner.
     * Inserts before #gssh-venue-readiness (or the readiness container).
     */
    function renderRoofBanner(venueName, currentState) {
        var existing = document.getElementById(ROOF_BANNER_ID);
        var isOpen = currentState !== 'retractable_closed';

        var html =
            '<div id="' + ROOF_BANNER_ID + '" class="gssh-roof-banner">' +
                '<div class="gssh-roof-banner-left">' +
                    '<span class="gssh-roof-icon">' + (isOpen ? '☀️' : '🏟️') + '</span>' +
                    '<div>' +
                        '<div class="gssh-roof-title">Retractable Roof — ' + (isOpen ? 'Open' : 'Closed') + '</div>' +
                        '<div class="gssh-roof-desc">' +
                            (isOpen
                                ? 'Full natural light and ambient CO₂. Shade analysis uses stand geometry only.'
                                : 'Roof closed. DLI reduced to ~30% of ambient. CO₂ depletion and airflow constraints applied.') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="gssh-roof-toggle-wrap">' +
                    '<button class="gssh-roof-btn' + (isOpen ? ' gssh-roof-btn-active' : '') + '" ' +
                        "onclick=\"GSSH_VenueReadinessUI.setRoofState('retractable_open')\" " +
                        'title="Roof is open — full sky exposure">&#9728; Open</button>' +
                    '<button class="gssh-roof-btn' + (!isOpen ? ' gssh-roof-btn-active gssh-roof-btn-closed' : '') + '" ' +
                        "onclick=\"GSSH_VenueReadinessUI.setRoofState('retractable_closed')\" " +
                        'title="Roof is closed — DLI reduced, CO₂ depleted">&#127967; Closed</button>' +
                '</div>' +
            '</div>';

        if (existing) {
            existing.outerHTML = html;
        } else {
            // Inject before the venue readiness container
            var container = document.getElementById(CONTAINER_ID);
            if (container && container.parentNode) {
                var wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                container.parentNode.insertBefore(wrapper.firstChild, container);
            }
        }
    }

    /**
     * Remove the banner (venue with no retractable roof selected).
     */
    function removeRoofBanner() {
        var existing = document.getElementById(ROOF_BANNER_ID);
        if (existing) existing.parentNode.removeChild(existing);
        _currentRoofVenueId = null;
    }

    /**
     * Called by toggle buttons. Updates enclosureType and triggers re-calc.
     */
    function setRoofState(state) {
        _currentRoofState = state;

        // Re-render banner immediately with new state
        if (_currentRoofVenueId) {
            renderRoofBanner(_currentRoofVenueId, state);
        }

        // Push to EUE bridge — this triggers full EUE recalculation
        if (global.GSSH_EUE_Bridge && typeof global.GSSH_EUE_Bridge.setVenueEnvConfig === 'function') {
            // Merge with existing config so other params (drainage, fans etc.) are preserved
            var existingConfig = {};
            if (global.GSSH_EUE_Bridge.getVenueEnvConfig) {
                existingConfig = global.GSSH_EUE_Bridge.getVenueEnvConfig() || {};
            }
            existingConfig.enclosureType = state;
            global.GSSH_EUE_Bridge.setVenueEnvConfig(existingConfig);
        }

        // Also sync the enclosure dropdown in the config panel if it's open
        var encSel = document.getElementById('gssh-vr-enclosure');
        if (encSel) encSel.value = state;

        // b35fix249: notify shade-orchestrator to re-run AJAX with new roof_state.
        // shade-orchestrator.js reads enclosureType from GSSH_EUE_Bridge at POST time.
        document.dispatchEvent(new CustomEvent('gssh:venueEnvConfigChanged', {
            detail: { enclosureType: state }
        }));

        log('Roof state set to: ' + state);
    }

    /**
     * Handle venue change — show/hide banner, restore saved state.
     */
    function onVenueSelected(venue, venueId) {
        if (venueHasRetractableRoof(venue)) {
            _currentRoofVenueId = venueId;

            // Check if there's already a saved enclosure state for this venue
            var savedState = 'retractable_open'; // default to open
            if (global.GSSH_EUE_Bridge && global.GSSH_EUE_Bridge.getVenueEnvConfig) {
                var saved = global.GSSH_EUE_Bridge.getVenueEnvConfig();
                if (saved && (saved.enclosureType === 'retractable_open' ||
                              saved.enclosureType === 'retractable_closed')) {
                    savedState = saved.enclosureType;
                }
            }
            _currentRoofState = savedState;

            // Ensure EUE bridge has the correct enclosure type set
            if (global.GSSH_EUE_Bridge && global.GSSH_EUE_Bridge.setVenueEnvConfig) {
                var cfg = (global.GSSH_EUE_Bridge.getVenueEnvConfig &&
                           global.GSSH_EUE_Bridge.getVenueEnvConfig()) || {};
                // Only override if it's not already a retractable state
                if (cfg.enclosureType !== 'retractable_open' &&
                    cfg.enclosureType !== 'retractable_closed') {
                    cfg.enclosureType = savedState;
                    global.GSSH_EUE_Bridge.setVenueEnvConfig(cfg);
                }
            }

            renderRoofBanner(venue.name || venueId, _currentRoofState);
        } else {
            removeRoofBanner();
            _currentRoofState = 'retractable_open';
        }
    }

    /**
     * Inject roof banner CSS into the existing injectStyles call.
     */
    function injectRoofBannerStyles() {
        var style = document.getElementById('gssh-roof-banner-styles');
        if (style) return;
        var css =
            '#gssh-roof-state-banner, .gssh-roof-banner {' +
                'display: flex; align-items: center; justify-content: space-between;' +
                'background: var(--gaip-good-bg); border: 1.5px solid #16a34a; border-radius: 10px;' +
                'padding: 12px 16px; margin-bottom: 10px; gap: 12px;' +
            '}' +
            '.gssh-roof-banner-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }' +
            '.gssh-roof-icon { font-size: 22px; flex-shrink: 0; }' +
            '.gssh-roof-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 2px; }' +
            '.gssh-roof-desc { font-size: 11px; color: var(--gaip-text-secondary); line-height: 1.4; }' +
            '.gssh-roof-toggle-wrap { display: flex; gap: 6px; flex-shrink: 0; }' +
            '.gssh-roof-btn {' +
                'padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer;' +
                'border: 1.5px solid var(--gaip-border); border-radius: 6px; background: var(--gaip-surface); color: var(--gaip-text);' +
                'transition: all 0.15s;' +
            '}' +
            '.gssh-roof-btn:hover { border-color: var(--gaip-text-secondary); background: var(--gaip-surface-muted); }' +
            '.gssh-roof-btn-active { background: var(--gaip-good-bg) !important; border-color: #16a34a !important; color: #166534 !important; }' +
            '.gssh-roof-btn-closed.gssh-roof-btn-active { background: var(--gaip-warning-bg) !important; border-color: #d97706 !important; color: #92400e !important; }' +
            // Closed state — change banner colour to amber
            '.gssh-roof-banner:has(.gssh-roof-btn-closed.gssh-roof-btn-active) {' +
                'background: var(--gaip-warning-bg); border-color: #d97706;' +
            '}';
        var el = document.createElement('style');
        el.id = 'gssh-roof-banner-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    /* =========================================================================
       INIT
    ========================================================================= */

    function init() {
        injectStyles();
        injectRoofBannerStyles();
        setupListeners();

        // Listen for venue selection to show/hide roof banner
        document.addEventListener('gssh:venueSelect', function(e) {
            var detail = e.detail || {};
            var venue = (typeof GilbaStadiumData !== 'undefined' && GilbaStadiumData.stadiums)
                ? GilbaStadiumData.stadiums[detail.venue_id]
                : null;
            // Also try GSSH_STADIUM_CONFIG
            if (!venue && typeof GSSH_STADIUM_CONFIG !== 'undefined' && GSSH_STADIUM_CONFIG.venues) {
                venue = GSSH_STADIUM_CONFIG.venues[detail.venue_id];
            }
            if (venue) onVenueSelected(venue, detail.venue_id);
        });

        log('Venue Readiness UI v' + VERSION + ' initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */

    global.GSSH_VenueReadinessUI = {
        render: render,
        toggleFactors: toggleFactors,
        toggleConfig: toggleConfig,
        togglePanel: function(panelId, trigger) {
            var body = document.getElementById(panelId);
            if (!body) return;
            var open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            var arrow = trigger ? trigger.querySelector('.gssh-collapse-arrow') : null;
            if (arrow) arrow.textContent = open ? '▼ show' : '▲ hide';
        },
        saveConfig: saveConfig,
        setRoofState: setRoofState,
        onVenueSelected: onVenueSelected,
        getRoofState: function() { return _currentRoofState; },
        version: VERSION
    };

})(typeof window !== 'undefined' ? window : this);
