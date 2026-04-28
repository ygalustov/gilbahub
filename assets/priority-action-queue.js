/**
 * Gilba Hub — Priority Action Queue
 * Version: 1.1.1
 * 
 * Sits between the Daily Dashboard scorecards and the module detail panels.
 * Reads from existing Hub globals — no engine changes required.
 * 
 * DATA SOURCES (all read-only):
 *   window.GAIP_DISEASE_RESULT      — disease engine output
 *   window.GAIP_DISEASE_FORECAST    — disease forecast (multi-day)
 *   window.GAIP_PGR_RESULT          — PGR module output
 *   window.GAIP_IrrigationResults   — irrigation scheduler output
 *   window.GAIP_TRAJECTORY_RESULT   — stress trajectory output
 *   window.climateMetrics           — climate engine processed metrics
 *   window.rawWeatherData           — raw Open-Meteo response
 *   window.GAIP_CANONICAL_STATE     — canonical state (turf, sensor, soilTemp)
 *   window.GAIP_STATE               — hub state (turf, pgr, soil inputs)
 * 
 * INSTALLATION:
 * 1. priority-action-queue.js + .css in /assets/
 * 2. Enqueue in PHP after daily-dashboard.js
 * 3. daily-dashboard.js calls GilbaPriorityQueue.init() after init,
 *    and GilbaPriorityQueue.refresh() after each updateDashboard()
 */

(function(global) {
    'use strict';

    // ══════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════

    var URGENCY = {
        CRITICAL: { level: 0, label: 'Urgent',   cssClass: 'gpq-critical' },
        WARNING:  { level: 1, label: 'Soon',     cssClass: 'gpq-warning'  },
        ADVISORY: { level: 2, label: 'Advisory', cssClass: 'gpq-advisory' },
        INFO:     { level: 3, label: 'Info',     cssClass: 'gpq-info'     }
    };

    var ENGINE_META = {
        disease:    { icon: '🔬', label: 'Disease',    cssClass: 'gpq-engine-disease'    },
        pgr:        { icon: '📐', label: 'PGR',        cssClass: 'gpq-engine-pgr'        },
        climate:    { icon: '🌡️', label: 'Climate',     cssClass: 'gpq-engine-climate'    },
        soil:       { icon: '🧪', label: 'Soil',       cssClass: 'gpq-engine-soil'       },
        water:      { icon: '💧', label: 'Water',      cssClass: 'gpq-engine-water'      },
        irrigation: { icon: '🚿', label: 'Irrigation', cssClass: 'gpq-engine-irrigation' },
        stress:     { icon: '⚡', label: 'Stress',     cssClass: 'gpq-engine-stress'     }
    };

    var DEBUG = false;
    function log(msg, data) {
        if (!DEBUG) return;
        if (data) ;
        else ;
    }

    // ══════════════════════════════════════════════
    // BETA DETECTION (mirrors daily-dashboard.js)
    // ══════════════════════════════════════════════

    function isBetaDisease(d) {
        if (d.beta === true || d.validationStatus === 'beta') return true;
        var name = (d.displayName || d.name || d.fullName || '').toLowerCase();
        if (name.includes('beta')) return true;
        var key = (d.key || d.id || d.disease || '').toLowerCase();
        if (key.includes('bipolaris') || name.includes('bipolaris')) return true;
        if (key.includes('curvularia') || name.includes('curvularia')) return true;
        if (key.includes('drechslera') || name.includes('drechslera') || name.includes('melting-out') || name.includes('melting out')) return true;
        if (key.includes('waitea') || name.includes('waitea')) return true;
        return false;
    }

    // ══════════════════════════════════════════════
    // COLLECTORS
    // ══════════════════════════════════════════════

    var collectors = {};

    /**
     * DISEASE COLLECTOR
     * Source: window.GAIP_DISEASE_RESULT
     */
    collectors.disease = function() {
        var actions = [];
        var result = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
        if (!result || !result.diseases || !Array.isArray(result.diseases)) return actions;

        result.diseases.forEach(function(d) {
            if (isBetaDisease(d)) return;

            var risk = d.adjustedRisk || d.riskScore || d.risk || d.riskPercent || d.pressure || 0;
            var name = d.displayName || d.name || d.disease || 'Unknown';

            var detail = 'Risk: ' + Math.round(risk) + '%';
            if (d.riskLevel) detail += ' (' + d.riskLevel + ')';
            if (d.varietyModifier) detail += ' · Variety resistance: ' + d.varietyModifier;

            if (risk >= 70) {
                actions.push({
                    engine: 'disease',
                    urgency: URGENCY.CRITICAL,
                    title: name + ' risk is HIGH — preventive action recommended',
                    detail: detail,
                    timeframe: '24–48h',
                    confidence: d.confidence || null
                });
            } else if (risk >= 50) {
                actions.push({
                    engine: 'disease',
                    urgency: URGENCY.WARNING,
                    title: name + ' risk is MODERATE — monitor closely',
                    detail: detail,
                    timeframe: '2–4 days',
                    confidence: d.confidence || null
                });
            }
        });

        // Check forecast for rising risk when current risk is low
        var forecast = global.GAIP_DISEASE_FORECAST || global._diseaseForecastData;
        if (forecast && forecast.peakRisk && forecast.peakRisk > 70 && actions.length === 0) {
            actions.push({
                engine: 'disease',
                urgency: URGENCY.WARNING,
                title: 'Disease risk forecast to peak at ' + Math.round(forecast.peakRisk) + '%',
                detail: (forecast.peakDisease || 'Highest risk') + ' · ' + (forecast.peakDay || 'coming days'),
                timeframe: forecast.peakDay || '2–5 days',
                confidence: null
            });
        }

        return actions;
    };

    /**
     * PGR COLLECTOR
     * Source: window.GAIP_PGR_RESULT || window.lastPGRStatus
     */
    collectors.pgr = function() {
        var actions = [];
        var result = global.GAIP_PGR_RESULT || global.lastPGRStatus;
        if (!result || result.success === false) return actions;
        if (result.status === 'No application') return actions;

        var gddData = result.gdd || {};
        var effectData = result.effect || {};
        var gddAccumulated = gddData.accumulated != null ? gddData.accumulated : result.gddAccumulated;
        var gddThreshold = gddData.threshold || result.gddThreshold;
        var gddRemaining = gddData.remaining != null ? gddData.remaining : (gddThreshold - gddAccumulated);
        var avgDailyGDD = result.avgDailyGDD || gddData.avgDaily || 15;
        var suppressionPct = effectData.suppressionPct != null ? effectData.suppressionPct : Math.round((effectData.suppression || 0) * 100);

        var pgrState = (global.GAIP_STATE && global.GAIP_STATE.pgr) ? global.GAIP_STATE.pgr : {};
        var product = pgrState.productType 
            || (result.product && typeof result.product === 'object' ? (result.product.name || result.product.code || 'PGR') : result.product)
            || 'PGR';

        if (gddAccumulated == null || !gddThreshold) return actions;

        var pctComplete = Math.round((gddAccumulated / gddThreshold) * 100);
        var pctRemaining = Math.max(0, 100 - pctComplete);
        var daysRemaining = avgDailyGDD > 0 ? Math.ceil(gddRemaining / avgDailyGDD) : null;

        var detail = product + ' — ' + Math.round(gddAccumulated) + ' / ' + gddThreshold + ' GDD (' + pctComplete + '%)';
        if (suppressionPct > 0) detail += ' · ' + suppressionPct + '% suppression';

        var reappStatus = effectData.reapplicationStatus || '';

        if (reappStatus === 'expired' || pctRemaining <= 0) {
            actions.push({
                engine: 'pgr',
                urgency: URGENCY.CRITICAL,
                title: product + ' has expired — reapply if needed',
                detail: detail,
                timeframe: 'Now',
                confidence: null
            });
        } else if (pctRemaining <= 20 || (daysRemaining !== null && daysRemaining <= 2)) {
            actions.push({
                engine: 'pgr',
                urgency: URGENCY.WARNING,
                title: product + ' reapplication due' + (daysRemaining !== null ? ' in ~' + daysRemaining + 'd' : ' soon'),
                detail: detail,
                timeframe: daysRemaining !== null ? daysRemaining + 'd' : 'Soon',
                confidence: null
            });
        } else if (pctComplete >= 70) {
            actions.push({
                engine: 'pgr',
                urgency: URGENCY.ADVISORY,
                title: product + ' at ' + pctComplete + '% of reapplication interval',
                detail: detail,
                timeframe: daysRemaining !== null ? '~' + daysRemaining + 'd' : 'Monitor',
                confidence: null
            });
        }

        return actions;
    };

    /**
     * CLIMATE COLLECTOR
     * Source: window.climateMetrics
     * Uses: climateMetrics.stress (heat, cold, drought, disease, growth)
     *       climateMetrics.forecast (precip, irrigation timing)
     */
    collectors.climate = function() {
        var actions = [];
        var metrics = global.climateMetrics;
        if (!metrics) return actions;

        var stress = metrics.stress;
        if (stress) {
            if (stress.heat) {
                actions.push({
                    engine: 'climate',
                    urgency: (stress.heat.days || 0) >= 3 ? URGENCY.WARNING : URGENCY.ADVISORY,
                    title: 'Heat stress' + (stress.heat.days > 1 ? ' — ' + stress.heat.days + ' days above ' + stress.heat.threshold + '°C' : ' — ' + stress.heat.maxTemp + '°C forecast'),
                    detail: stress.heat.recommendation || 'Consider syringing, raised HOC, wetting agent.',
                    timeframe: 'This week',
                    confidence: null
                });
            }

            if (stress.cold && stress.cold.frostDays > 0) {
                actions.push({
                    engine: 'climate',
                    urgency: URGENCY.WARNING,
                    title: 'Frost risk — ' + stress.cold.frostDays + ' night' + (stress.cold.frostDays > 1 ? 's' : '') + ' near 0°C',
                    detail: stress.cold.recommendation || 'Delay mowing until thaw. Avoid traffic on frosted turf.',
                    timeframe: 'This week',
                    confidence: null
                });
            }

            if (stress.drought) {
                actions.push({
                    engine: 'irrigation',
                    urgency: stress.drought.deficit > 15 ? URGENCY.WARNING : URGENCY.ADVISORY,
                    title: 'Moisture deficit: ' + stress.drought.deficit + 'mm',
                    detail: stress.drought.recommendation || 'Schedule supplemental irrigation.',
                    timeframe: 'Monitor',
                    confidence: null
                });
            }
        }

        // Rain forecast — irrigation hold opportunity
        var fi = metrics.forecast;
        if (fi && fi.precip && fi.precip.days > 0 && fi.irrigation) {
            var timing = fi.irrigation.timing || '';
            if (timing.indexOf('No rain') === -1) {
                actions.push({
                    engine: 'irrigation',
                    urgency: URGENCY.ADVISORY,
                    title: 'Rain forecast — consider deferring irrigation',
                    detail: fi.precip.total + 'mm over ' + fi.precip.days + ' day(s). ' + timing,
                    timeframe: timing || 'This week',
                    confidence: null
                });
            }
        }

        return actions;
    };

    /**
     * IRRIGATION COLLECTOR
     * Source: window.GAIP_IrrigationResults
     */
    collectors.irrigation = function() {
        var actions = [];
        var result = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
        if (!result) return actions;

        var deficit = result.currentDeficit != null ? result.currentDeficit :
                      (result.waterBalance ? result.waterBalance.deficit : 0);

        if (deficit > 10) {
            actions.push({
                engine: 'irrigation',
                urgency: deficit > 20 ? URGENCY.CRITICAL : URGENCY.WARNING,
                title: 'Irrigate: ' + Math.round(deficit) + 'mm deficit',
                detail: 'Water balance deficit exceeds threshold. Schedule irrigation cycle.',
                timeframe: deficit > 20 ? 'Today' : '1–2 days',
                confidence: null
            });
        }

        return actions;
    };

    /**
     * STRESS TRAJECTORY COLLECTOR
     * Source: window.GAIP_TRAJECTORY_RESULT
     */
    collectors.stress = function() {
        var actions = [];
        var result = global.GAIP_TRAJECTORY_RESULT || global.GAIP_StressTrajectory;
        if (!result) return actions;

        var score = (result.summary ? result.summary.currentScore : null) || result.currentStress || 0;

        if (score > 70) {
            actions.push({
                engine: 'stress',
                urgency: URGENCY.CRITICAL,
                title: 'Turf stress index is HIGH (' + Math.round(score) + '%)',
                detail: 'Multiple stress factors converging. Review mitigation strategies.',
                timeframe: 'Now',
                confidence: null
            });
        } else if (score > 50) {
            actions.push({
                engine: 'stress',
                urgency: URGENCY.WARNING,
                title: 'Turf stress index is ELEVATED (' + Math.round(score) + '%)',
                detail: 'Review stress trajectory and mitigation options.',
                timeframe: 'This week',
                confidence: null
            });
        }

        return actions;
    };

    /**
     * SENSOR STALENESS COLLECTOR
     * Source: window.GAIP_CANONICAL_STATE.sensor
     */
    collectors.sensor = function() {
        var actions = [];
        var canonical = global.GAIP_CANONICAL_STATE;
        if (!canonical || !canonical.sensor || !canonical.sensor.available) return actions;

        var importDate = canonical.sensor.importDate;
        if (!importDate) return actions;

        var daysSinceImport = Math.floor((Date.now() - new Date(importDate).getTime()) / 86400000);
        if (daysSinceImport > 7) {
            actions.push({
                engine: 'soil',
                urgency: URGENCY.ADVISORY,
                title: 'Sensor data is ' + daysSinceImport + ' days old — reimport recommended',
                detail: 'Last import: ' + new Date(importDate).toLocaleDateString() + ' (' + (canonical.sensor.source || 'sensor') + ').',
                timeframe: 'When convenient',
                confidence: null
            });
        }

        return actions;
    };

    /**
     * PHYTOTOXICITY COLLECTOR (v1.2.0)
     * Source: window.GAIP_PHYTOTOXICITY_RESULT
     */
    collectors.phytotoxicity = function() {
        var actions = [];
        var result = global.GAIP_PHYTOTOXICITY_RESULT;
        if (!result || !result.overallRisk) return actions;
        if (result.overallRisk === 'low' || result.overallRisk === 'none') return actions;

        // Find the highest-risk ion
        var riskIon = 'ions';
        if (result.assessments && result.assessments.length > 0) {
            var highRisk = null;
            for (var i = 0; i < result.assessments.length; i++) {
                if (result.assessments[i].status === 'high') {
                    highRisk = result.assessments[i];
                    break;
                }
            }
            if (!highRisk) highRisk = result.assessments[0];
            if (highRisk && highRisk.parameter) {
                riskIon = highRisk.parameter.split(' ')[0];
            }
        }

        if (result.overallRisk === 'high') {
            actions.push({
                engine: 'water',
                urgency: URGENCY.CRITICAL,
                title: riskIon + ' phytotoxicity risk — irrigate at night',
                detail: 'Foliar damage likely with daytime irrigation. Switch to night cycles.',
                timeframe: 'Now',
                confidence: null
            });
        } else if (result.overallRisk === 'moderate') {
            actions.push({
                engine: 'water',
                urgency: URGENCY.WARNING,
                title: riskIon + ' approaching foliar damage threshold',
                detail: 'Monitor for leaf tip burn. Consider night irrigation.',
                timeframe: 'This week',
                confidence: null
            });
        }

        return actions;
    };

    // ══════════════════════════════════════════════
    // DEDUPLICATION
    // ══════════════════════════════════════════════

    function deduplicate(actions) {
        // If direct irrigation deficit exists, remove the climate-sourced moisture deficit
        var hasDirectDeficit = actions.some(function(a) {
            return a.engine === 'irrigation' && a.title.indexOf('Irrigate:') >= 0;
        });
        if (hasDirectDeficit) {
            actions = actions.filter(function(a) {
                return !(a.engine === 'irrigation' && a.title.indexOf('Moisture deficit') >= 0);
            });
        }
        return actions;
    }

    // ══════════════════════════════════════════════
    // SORTER
    // ══════════════════════════════════════════════

    function collectAndSort() {
        var allActions = [];

        Object.keys(collectors).forEach(function(key) {
            try {
                var engineActions = collectors[key]();
                if (Array.isArray(engineActions)) {
                    allActions = allActions.concat(engineActions);
                }
            } catch (e) {
                log('Collector "' + key + '" threw: ' + e.message);
            }
        });

        allActions = deduplicate(allActions);

        allActions.sort(function(a, b) {
            if (a.urgency.level !== b.urgency.level) return a.urgency.level - b.urgency.level;
            return (a.engine || '').localeCompare(b.engine || '');
        });

        log('Collected ' + allActions.length + ' actions', allActions);
        return allActions;
    }

    // ══════════════════════════════════════════════
    // RENDERER
    // ══════════════════════════════════════════════

    function render(actions) {
        var container = document.getElementById('gpq-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'gpq-container';

            // v1.2.0: Insert into dashboard actions slot (merged with dashboard)
            var dashboardSlot = document.getElementById('gaip-dashboard-actions-slot');
            
            if (dashboardSlot) {
                dashboardSlot.appendChild(container);
            } else {
                // Fallback: insert after dashboard element
                var insertAfter = document.querySelector('.gaip-daily-dashboard')
                               || document.querySelector('#gaip-daily-dashboard')
                               || document.querySelector('[data-section="daily-dashboard"]');

                if (insertAfter) {
                    insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);
                } else {
                    var hubContent = document.querySelector('.gaip-hub-content')
                                  || document.querySelector('#gaip-hub-content')
                                  || document.querySelector('.gaip-content-area');
                    if (hubContent) {
                        hubContent.insertBefore(container, hubContent.firstChild);
                    } else {
                        log('Could not find insertion point');
                        return;
                    }
                }
            }
        }

        if (!actions || actions.length === 0) {
            container.innerHTML = renderEmptyState();
            return;
        }

        var html = '<div class="gpq-queue">';
        html += '<div class="gpq-header"><div class="gpq-header-left">';
        html += '<span class="gpq-header-icon">⚡</span>';
        html += '<span class="gpq-header-title">Actions Needed</span>';
        html += '<span class="gpq-header-count">' + actions.length + '</span>';
        html += '</div><div class="gpq-header-right">';

        var critCount = actions.filter(function(a) { return a.urgency.level === 0; }).length;
        var warnCount = actions.filter(function(a) { return a.urgency.level === 1; }).length;
        if (critCount > 0) html += '<span class="gpq-summary-badge gpq-critical">' + critCount + ' urgent</span>';
        if (warnCount > 0) html += '<span class="gpq-summary-badge gpq-warning">' + warnCount + ' soon</span>';
        html += '</div></div>';

        html += '<div class="gpq-items">';
        // Group: render non-disease actions first, then add greens label before disease block
        var nonDiseaseActions = actions.filter(function(a) { return a.engine !== 'disease'; });
        var diseaseActions    = actions.filter(function(a) { return a.engine === 'disease'; });
        nonDiseaseActions.forEach(function(action) { html += renderAction(action); });
        if (diseaseActions.length > 0) {
            var speciesLabel = '';
            var surfaceLabel = 'Greens';
            try {
                var turf = window.GAIP_CANONICAL_STATE && window.GAIP_CANONICAL_STATE.turf;
                if (turf && turf.species) {
                    var cleaned = turf.species.replace(' (Greens)', '').replace(' (greens)', '').trim();
                    // Only use the species name as prefix if it's not itself 'Greens'
                    // (avoids "Greens Greens" when species resolves to 'Greens' or is unavailable)
                    if (cleaned && cleaned.toLowerCase() !== 'greens') {
                        speciesLabel = cleaned + ' ';
                    }
                }
                // b35fix150: derive surface label from turfType — sportsgrounds/ovals are not "Greens"
                var turfType = (turf && turf.turfType) || (window.GAIP_STATE && window.GAIP_STATE.turfType) || '';
                var ttLower = turfType.toLowerCase();
                if (ttLower.indexOf('sport') >= 0 || ttLower.indexOf('oval') >= 0 || ttLower.indexOf('field') >= 0 || ttLower.indexOf('pitch') >= 0) {
                    surfaceLabel = 'Playing Surface';
                } else if (ttLower.indexOf('fairway') >= 0 || ttLower.indexOf('tee') >= 0) {
                    surfaceLabel = 'Fairway/Tee';
                } else if (ttLower.indexOf('lawn') >= 0 || ttLower.indexOf('council') >= 0) {
                    surfaceLabel = 'Lawn';
                }
            } catch(e) {}
            html += '<div style="font-weight:600; font-size:12px; color:#1e40af; padding:6px 12px 2px; margin-top:4px;">🌿 ' + speciesLabel + surfaceLabel + ' — Disease Alerts</div>';
            diseaseActions.forEach(function(action) { html += renderAction(action); });
        }
        html += '</div></div>';

        container.innerHTML = html;
        bindInteractions(container);
    }

    function renderAction(action) {
        var meta = ENGINE_META[action.engine] || { icon: '📋', label: action.engine, cssClass: '' };
        var html = '<div class="gpq-item ' + action.urgency.cssClass + '">';
        html += '<div class="gpq-urgency-bar ' + action.urgency.cssClass + '"></div>';
        html += '<div class="gpq-item-icon"><span class="gpq-icon-inner ' + meta.cssClass + '">' + meta.icon + '</span></div>';
        html += '<div class="gpq-item-content">';
        html += '<div class="gpq-item-title">' + escapeHtml(action.title) + '</div>';
        html += '<div class="gpq-item-detail">' + escapeHtml(action.detail) + '</div>';
        html += '</div>';
        html += '<div class="gpq-item-meta">';
        html += '<span class="gpq-engine-badge ' + meta.cssClass + '">' + escapeHtml(meta.label) + '</span>';
        html += '<span class="gpq-timeframe">' + escapeHtml(action.timeframe) + '</span>';
        if (action.confidence !== null && action.confidence !== undefined) {
            html += '<span class="gpq-confidence">' + action.confidence + '% conf</span>';
        }
        html += '</div></div>';
        return html;
    }

    function renderEmptyState() {
        return '<div class="gpq-queue gpq-empty">' +
            '<div class="gpq-empty-content">' +
            '<span class="gpq-empty-icon">✓</span>' +
            '<span class="gpq-empty-text">No actions needed right now</span>' +
            '<span class="gpq-empty-sub">All engines reporting nominal</span>' +
            '</div></div>';
    }

    function bindInteractions(container) {
        var items = container.querySelectorAll('.gpq-item');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function() {
                var badge = this.querySelector('.gpq-engine-badge');
                if (!badge) return;
                var label = badge.textContent.toLowerCase().replace(/\s+/g, '-');
                var panel = document.querySelector('[data-engine="' + label + '"]')
                         || document.querySelector('#gaip-' + label)
                         || document.querySelector('.gaip-card-' + label)
                         || document.querySelector('[class*="' + label + '"][class*="card"]');
                if (panel) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    panel.classList.add('gpq-highlight');
                    setTimeout(function() { panel.classList.remove('gpq-highlight'); }, 2000);
                }
            });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ══════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════

    global.GilbaPriorityQueue = {
        version: '1.2.0',

        init: function() {
            var actions = collectAndSort();
            render(actions);
            log('Initialized with ' + actions.length + ' action(s)');
        },

        refresh: function() {
            var actions = collectAndSort();
            render(actions);
        },

        registerCollector: function(name, collectorFn, meta) {
            collectors[name] = collectorFn;
            if (meta) ENGINE_META[name] = meta;
        },

        getActions: function() {
            return collectAndSort();
        },

        setDebug: function(on) {
            DEBUG = !!on;
        }
    };

})(window);
