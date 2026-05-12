/**
 * =============================================================================
 * GSSH Operational Summary v1.0.0
 * =============================================================================
 *
 * Plain-language summary card for stadium turf managers.
 * Converts hub engine outputs into 3–5 actionable sentences covering:
 *   1. Turf status (growth potential, stress)
 *   2. LED environment (EUE composite, limiting factor)
 *   3. Water / irrigation priority
 *   4. Disease risk (top flag only)
 *   5. Immediate action recommendation
 *
 * Renders into #gssh-operational-summary in the Stadium overview sub-tab.
 * Updates on gaip:analysis-complete and gssh:venue-profile-restored.
 *
 * @requires eue-integration-bridge.js (GSSH_EUE_Bridge)
 * @requires hub-tissue-v3.js (GAIP_STATE, climateMetrics)
 * @version 1.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    var VERSION = '1.0.0';
    var CONTAINER_ID = 'gssh-operational-summary';

    // =========================================================================
    // SENTENCE BUILDERS
    // =========================================================================

    function buildGrowthSentence(state) {
        if (!state) return null;
        var cm = state.climateMetrics;
        var turf = state.turf;
        if (!cm || !turf) return null;

        var species = turf.grassSpecies || turf.species || 'Turf';
        var gp = null;
        var pathway = 'C3';

        // Determine pathway and GP from climate metrics
        if (cm.growth) {
            var c4Frac = turf.speciesFractions ? turf.speciesFractions.c4Fraction : null;
            if (c4Frac === null || c4Frac === undefined) {
                // Infer from species name
                var sp = species.toLowerCase();
                c4Frac = (sp.indexOf('couch') >= 0 || sp.indexOf('bermuda') >= 0 ||
                          sp.indexOf('kikuyu') >= 0 || sp.indexOf('zoysia') >= 0 ||
                          sp.indexOf('buffalo') >= 0 || sp.indexOf('paspalum') >= 0) ? 1 : 0;
            }
            if (c4Frac > 0.5) {
                gp = cm.growth.gpC4;
                pathway = 'C4';
            } else {
                gp = cm.growth.gpC3;
                pathway = 'C3';
            }
        }

        if (gp === null || gp === undefined) return null;

        var gpPct = Math.round(gp);
        var temp = cm.temperature ? Math.round(cm.temperature.current || cm.temperature.mean || 20) : null;
        var tempStr = temp !== null ? ' at ' + temp + '°C' : '';

        if (gpPct >= 90) {
            return species + ' is growing at ' + gpPct + '% of potential' + tempStr + ', conditions are near-optimal.';
        } else if (gpPct >= 70) {
            return species + ' growth is at ' + gpPct + '%' + tempStr + '. Good conditions with minor temperature constraints.';
        } else if (gpPct >= 50) {
            return species + ' growth is reduced to ' + gpPct + '%' + tempStr + '. Temperature stress is limiting recovery.';
        } else if (gpPct >= 25) {
            return species + ' growth is significantly suppressed (' + gpPct + '%)' + tempStr + '. Expect slow recovery after events.';
        } else {
            return species + ' growth is near-dormant (' + gpPct + '%)' + tempStr + '. Focus on cover maintenance rather than recovery.';
        }
    }

    function buildEUESentence(eue) {
        if (!eue) return null;

        var composite = Math.round(eue.compositeEUE * 100);
        var status = eue.venueReadiness ? eue.venueReadiness.status : null;
        var limiting = eue.limitingFactor;

        var FACTOR_NAMES = {
            rootZoneTemp: 'root-zone temperature',
            leafTemp:     'air/leaf temperature',
            vpd:          'vapour pressure deficit',
            airflow:      'airflow',
            co2:          'CO₂ concentration',
            rhizosphere:  'rhizosphere health'
        };
        var limitingLabel = limiting && FACTOR_NAMES[limiting] ? FACTOR_NAMES[limiting] : null;

        if (status === 'READY' || composite >= 90) {
            return 'LED environment is optimal, supplemental lighting at ' + composite + '% effectiveness.';
        } else if (status === 'READY_WITH_NOTES' || composite >= 70) {
            var constraint = limitingLabel ? ' Main constraint: ' + limitingLabel + '.' : '';
            return 'LED effectiveness is ' + composite + '%, minor environmental constraints present.' + constraint;
        } else if (status === 'PARTIALLY_READY' || composite >= 45) {
            var limit2 = limitingLabel ? ' ' + limitingLabel.charAt(0).toUpperCase() + limitingLabel.slice(1) + ' is the primary limiting factor.' : '';
            return 'LED conditions are suboptimal at ' + composite + '% effectiveness.' + limit2 + ' Check venue environment configuration.';
        } else {
            var limit3 = limitingLabel ? ' Critical factor: ' + limitingLabel + '.' : '';
            return 'Poor LED conditions, only ' + composite + '% effectiveness.' + limit3 + ' Environmental intervention needed before supplemental lighting is worthwhile.';
        }
    }

    function buildWaterSentence(state) {
        if (!state) return null;
        var water = state.waterResults;
        var sal = state.salinityPenalty;

        // Check salinity first — most actionable
        if (sal && sal.active && sal.penaltyPct >= 10) {
            var pen = Math.round(sal.penaltyPct);
            return 'Irrigation water quality is reducing growth by ' + pen + '% due to salinity (ECw ' + (sal.ecw || '?') + ' dS/m). Consider leaching or blending.';
        }

        if (!water) return null;

        // Check for sodium / bicarbonate flags
        if (water.sar && water.sar.risk === 'high') {
            return 'High sodium in irrigation water (SAR ' + (water.sar.value ? water.sar.value.toFixed(1) : '?') + '). Apply gypsum to protect soil structure.';
        }
        if (water.bicarbonate && water.bicarbonate.status === 'high') {
            return 'High bicarbonate levels in irrigation water. Acidify to pH 6.0–6.5 before applying to sports turf.';
        }

        // Default: no concern
        return null;
    }

    function buildDiseaseSentence(state) {
        if (!state) return null;

        var dr = global.GAIP_DISEASE_RESULT;
        if (!dr || !dr.diseases || !dr.diseases.length) return null;

        // diseases is an array of { name, riskScore, riskLevel, ... }
        var diseases = dr.diseases.slice().sort(function(a, b) {
            return (b.riskScore || 0) - (a.riskScore || 0);
        });
        var top = diseases[0];
        if (!top || !top.name) return null;

        var risk = top.riskScore || 0;
        var name = top.name;

        if (risk >= 70) {
            return 'High ' + name + ' risk (' + risk + '%). Apply preventative fungicide now, do not wait for symptoms.';
        } else if (risk >= 40) {
            return name + ' risk is elevated (' + risk + '%). Scout surfaces daily and be ready to spray.';
        } else if (risk >= 20) {
            return name + ' pressure is moderate (' + risk + '%). Monitor conditions, risk may rise with continued warm/humid weather.';
        }
        return null;
    }

    function buildWearSentence(state) {
        if (!state || !state.wearMetrics) return null;
        var w = state.wearMetrics;

        if (w.recoveryDays !== undefined && w.recoveryDays !== null) {
            var days = Math.round(w.recoveryDays);
            if (days <= 2) {
                return 'Surface recovery is fast, pitch ready within ' + days + ' days of heavy use.';
            } else if (days <= 5) {
                return 'Allow ' + days + ' days recovery between intensive events given current growth conditions.';
            } else if (days <= 10) {
                return 'Recovery is slow (' + days + ' days). Schedule events carefully and consider growth stimulation.';
            } else {
                return 'Very slow recovery expected (' + days + '+ days). Limit traffic and prioritise turf restoration.';
            }
        }
        return null;
    }

    function buildActionSentence(state, eue) {
        // Determine the single most important action right now
        if (!state) return null;

        var cm = state.climateMetrics;
        var sal = state.salinityPenalty;
        var turf = state.turf;

        // Salinity > everything else in irrigation context
        if (sal && sal.active && sal.penaltyPct >= 20) {
            return 'Priority action: address irrigation water quality before the next application.';
        }

        // Very poor LED conditions
        if (eue && eue.compositeEUE < 0.45 && eue.limitingFactor) {
            var FACTOR_ACTIONS = {
                rootZoneTemp: 'Improve root-zone temperature (heating or soil insulation) before running LED rigs.',
                leafTemp:     'Wait for cooler ambient temperatures, LED supplementation is inefficient above/below optimal leaf temperature range.',
                airflow:      'Improve air circulation in the venue before the next LED session.',
                vpd:          'Manage humidity levels, high VPD is reducing leaf efficiency under artificial light.',
                rhizosphere:  'Address root health (aeration, drainage) before investing in LED hours.'
            };
            var action = FACTOR_ACTIONS[eue.limitingFactor];
            if (action) return 'Priority action: ' + action;
        }

        // Stress
        if (cm && cm.stress) {
            if (cm.stress.heatStress) return 'Priority action: apply cooling irrigation during peak heat to protect root-zone temperature.';
            if (cm.stress.droughtStress) return 'Priority action: increase irrigation frequency, moisture stress is the main growth limiter.';
            if (cm.stress.coldStress) return 'Priority action: use covers or heating to maintain minimum root-zone temperature for active recovery.';
        }

        return null;
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        var state = global.GAIP_STATE;
        var eue = global.GSSH_EUE_Bridge ? global.GSSH_EUE_Bridge.getLastEUE() : null;
        var venue = global.GSSH_UnifiedVenueSelector ? global.GSSH_UnifiedVenueSelector.getCurrentVenue() : null;

        if (!state && !eue) {
            container.innerHTML = '<p class="gssh-ops-placeholder">Run analysis to see the operational summary.</p>';
            return;
        }

        var sentences = [];

        var growth = buildGrowthSentence(state);
        if (growth) sentences.push({ icon: '🌱', text: growth });

        var water = buildWaterSentence(state);
        if (water) sentences.push({ icon: '💧', text: water });

        var disease = buildDiseaseSentence(state);
        if (disease) sentences.push({ icon: '🦠', text: disease });

        var wear = buildWearSentence(state);
        if (wear) sentences.push({ icon: '⚽', text: wear });

        var eueS = buildEUESentence(eue);
        if (eueS) sentences.push({ icon: '💡', text: eueS });

        var action = buildActionSentence(state, eue);
        if (action) sentences.push({ icon: '▶', text: action, highlight: true });

        if (!sentences.length) {
            container.innerHTML = '<p class="gssh-ops-placeholder">Analysis complete, no significant issues detected.</p>';
            return;
        }

        // Venue + timestamp header
        var venueName = venue ? venue.name : (state && state.turf ? (state.turf.grassSpecies || '') + ' surface' : 'Venue');
        var now = new Date();
        var timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        var dateStr = now.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

        var html = '<div class="gssh-ops-summary">';
        html += '<div class="gssh-ops-header">';
        html += '<span class="gssh-ops-venue">' + escHtml(venueName) + '</span>';
        html += '<span class="gssh-ops-time">' + dateStr + ' ' + timeStr + '</span>';
        html += '</div>';
        html += '<ul class="gssh-ops-list">';

        sentences.forEach(function(s) {
            var cls = s.highlight ? ' gssh-ops-action' : '';
            html += '<li class="gssh-ops-item' + cls + '">';
            html += '<span class="gssh-ops-icon">' + s.icon + '</span>';
            html += '<span class="gssh-ops-text">' + escHtml(s.text) + '</span>';
            html += '</li>';
        });

        html += '</ul>';
        html += '<div class="gssh-ops-footer">Updated ' + timeStr + ' · Gilba Hub v' + VERSION + '</div>';
        html += '</div>';

        container.innerHTML = html;
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gssh-ops-summary-styles')) return;
        var style = document.createElement('style');
        style.id = 'gssh-ops-summary-styles';
        style.textContent = `
            #gssh-operational-summary {
                margin-top: 12px;
            }
            .gssh-ops-placeholder {
                color: var(--gaip-text-secondary);
                font-size: 13px;
                font-style: italic;
                padding: 12px 0;
            }
            .gssh-ops-summary {
                background: var(--gaip-surface);
                border: 1px solid var(--gaip-border);
                border-radius: 10px;
                padding: 16px;
                font-size: 13px;
            }
            .gssh-ops-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--gaip-surface-hover);
            }
            .gssh-ops-venue {
                font-weight: 700;
                font-size: 14px;
                color: var(--gaip-text);
            }
            .gssh-ops-time {
                font-size: 11px;
                color: var(--gaip-text-muted);
            }
            .gssh-ops-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .gssh-ops-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 6px 0;
                border-bottom: 1px solid var(--gaip-surface-muted);
                line-height: 1.5;
                color: var(--gaip-text);
            }
            .gssh-ops-item:last-child {
                border-bottom: none;
            }
            .gssh-ops-item.gssh-ops-action {
                background: var(--gaip-good-bg);
                border-radius: 6px;
                padding: 8px 10px;
                margin-top: 6px;
                border: 1px solid var(--gaip-good-bg);
                color: #166534;
                font-weight: 500;
            }
            .gssh-ops-icon {
                flex-shrink: 0;
                width: 20px;
                text-align: center;
                font-size: 14px;
                margin-top: 1px;
            }
            .gssh-ops-text {
                flex: 1;
            }
            .gssh-ops-footer {
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid var(--gaip-surface-hover);
                font-size: 11px;
                color: var(--gaip-border);
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // INJECT CONTAINER INTO STADIUM TAB
    // =========================================================================

    function injectContainer() {
        if (document.getElementById(CONTAINER_ID)) return true;

        // Find the venue readiness div in the overview sub-tab — insert after it
        var readiness = document.getElementById('gssh-venue-readiness');
        if (!readiness) return false;

        var card = document.createElement('div');
        card.className = 'gssh-card gssh-stadium-card';
        card.innerHTML =
            '<div class="gssh-card-header">' +
                '<h3>Operational Summary</h3>' +
                '<span style="font-size:11px;color:var(--gaip-text-muted);font-weight:400;">Plain-language action brief</span>' +
            '</div>' +
            '<div class="gssh-card-body">' +
                '<div id="' + CONTAINER_ID + '">' +
                    '<p class="gssh-ops-placeholder">Run analysis to see the operational summary.</p>' +
                '</div>' +
            '</div>';

        readiness.parentNode.insertBefore(card, readiness.nextSibling);
        return true;
    }

    // =========================================================================
    // INITIALISE
    // =========================================================================

    function init() {
        injectStyles();

        if (!injectContainer()) {
            // Stadium tab DOM not yet rendered — retry when it appears
            var observer = new MutationObserver(function(mutations, obs) {
                if (document.getElementById('gssh-venue-readiness')) {
                    obs.disconnect();
                    injectContainer();
                    render();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Update on every analysis complete
        document.addEventListener('gaip:analysis-complete', function() {
            if (injectContainer()) render();
        });

        // Also update when venue profile restores (species may have changed)
        document.addEventListener('gssh:venue-profile-restored', function() {
            setTimeout(function() {
                if (injectContainer()) render();
            }, 200);
        });

        // Update when EUE recalculates (venue climate fetch completes)
        document.addEventListener('gssh:eue-updated', function() {
            if (injectContainer()) render();
        });

        console.log('[OperationalSummary] v' + VERSION + ' loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 300);
    }

    global.GSSH_OperationalSummary = { render: render, version: VERSION };

})(typeof window !== 'undefined' ? window : this);
