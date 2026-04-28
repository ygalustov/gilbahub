/**
 * =============================================================================
 * GILBA EVENT PLANNER UI v1.0.0
 * =============================================================================
 *
 * Calendar input, SVG timeline chart, event impact cards, intervention panel.
 * Renders as a modal panel (same pattern as What-If UI).
 *
 * @requires event-planner-engine.js
 * @author  Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';
    var ENGINE = null;
    var panelVisible = false;
    var currentEvents = [];
    var lastResult = null;

    function log() {
        var args = ['[EventPlannerUI]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function getEngine() {
        if (!ENGINE && global.GSSH_EventPlannerEngine) ENGINE = global.GSSH_EventPlannerEngine;
        return ENGINE;
    }

    // =========================================================================
    // HUB STATE INTEGRATION
    // =========================================================================

    function getHubState() {
        if (global.GSSH_STATE) return global.GSSH_STATE;
        if (global.GilbaHubOrchestrator && typeof global.GilbaHubOrchestrator.getState === 'function') {
            return global.GilbaHubOrchestrator.getState();
        }
        if (global.GSSH_CANONICAL_STATE) return global.GSSH_CANONICAL_STATE;
        return null;
    }

    function getShadeData() {
        var state = global.GSSH_CANONICAL_STATE;
        if (state && state.computed && state.computed.shade) {
            return {
                dli: state.computed.shade.DLI_total || 25,
                shadeFactor: state.computed.shade.shadeFactor || 1.0
            };
        }
        return { dli: 25, shadeFactor: 1.0 };
    }

    function getClimateData() {
        return global.rawWeatherData || null;
    }

    function getLatitude() {
        var state = getHubState();
        if (state && state.climate && state.climate.lat) return state.climate.lat;
        if (global.GSSH_HUB_CONFIG && global.GSSH_HUB_CONFIG.lat) return global.GSSH_HUB_CONFIG.lat;
        return -33.8;
    }

    // =========================================================================
    // PANEL MANAGEMENT
    // =========================================================================

    function showPanel() {
        var existing = document.getElementById('gssh-event-planner-panel');
        if (existing) {
            existing.style.display = 'block';
            var bd = document.getElementById('gssh-event-planner-backdrop');
            if (bd) bd.style.display = 'block';
            panelVisible = true;
            return;
        }

        var panel = document.createElement('div');
        panel.id = 'gssh-event-planner-panel';
        panel.className = 'gssh-event-planner-panel';
        panel.innerHTML = buildPanelHTML();

        // Use fixed overlay — avoids all tab-navigation visibility issues
        // Add backdrop
        var backdrop = document.createElement('div');
        backdrop.id = 'gssh-event-planner-backdrop';
        backdrop.className = 'gssh-event-planner-backdrop';
        backdrop.addEventListener('click', hidePanel);
        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        panelVisible = true;
        bindEvents();
        log('Panel opened');
    }

    function hidePanel() {
        var panel = document.getElementById('gssh-event-planner-panel');
        if (panel) panel.style.display = 'none';
        var backdrop = document.getElementById('gssh-event-planner-backdrop');
        if (backdrop) backdrop.style.display = 'none';
        panelVisible = false;
    }

    function togglePanel() {
        panelVisible ? hidePanel() : showPanel();
    }

    // =========================================================================
    // PANEL HTML
    // =========================================================================

    function buildPanelHTML() {
        var E = getEngine();
        var typeOptions = '';
        if (E) {
            var cats = {};
            Object.keys(E.EVENT_TYPES).forEach(function(key) {
                var t = E.EVENT_TYPES[key];
                var cat = t.category || 'other';
                if (!cats[cat]) cats[cat] = [];
                cats[cat].push({ key: key, label: t.icon + ' ' + t.label });
            });
            var catLabels = { sport: 'Sport', training: 'Training', non_sport: 'Non-Sport', logistics: 'Logistics' };
            Object.keys(catLabels).forEach(function(cat) {
                if (cats[cat]) {
                    typeOptions += '<optgroup label="' + catLabels[cat] + '">';
                    cats[cat].forEach(function(t) {
                        typeOptions += '<option value="' + t.key + '">' + t.label + '</option>';
                    });
                    typeOptions += '</optgroup>';
                }
            });
        }

        return '' +
        '<div class="gssh-ep-header">' +
            '<h3>📅 Event Planner</h3>' +
            '<button class="gssh-ep-close" onclick="GSSH_EventPlannerUI.hide()">&times;</button>' +
        '</div>' +

        '<div class="gssh-ep-body">' +
            '<div class="gssh-ep-intro">' +
                '<p>Plan events and see their cumulative impact on turf health. ' +
                'The simulation models damage from each event, recovery between events, ' +
                'and flags where the turf may not recover in time.</p>' +
            '</div>' +

            // Add event form
            '<div class="gssh-ep-add-form">' +
                '<div class="gssh-ep-form-row">' +
                    '<div class="gssh-ep-field">' +
                        '<label>Date</label>' +
                        '<input type="date" id="gssh-ep-date">' +
                    '</div>' +
                    '<div class="gssh-ep-field" style="flex:2">' +
                        '<label>Event Name</label>' +
                        '<input type="text" id="gssh-ep-name" placeholder="e.g. NRL Round 5">' +
                    '</div>' +
                    '<div class="gssh-ep-field">' +
                        '<label>Type</label>' +
                        '<select id="gssh-ep-type">' + typeOptions + '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="gssh-ep-form-row">' +
                    '<div class="gssh-ep-field">' +
                        '<label>Duration (hrs)</label>' +
                        '<input type="number" id="gssh-ep-duration" value="2" min="0.5" max="48" step="0.5">' +
                    '</div>' +
                    '<div class="gssh-ep-field">' +
                        '<label>Attendance</label>' +
                        '<input type="number" id="gssh-ep-crowd" value="0" min="0" step="1000">' +
                    '</div>' +
                    '<div class="gssh-ep-field">' +
                        '<label>Setup days</label>' +
                        '<input type="number" id="gssh-ep-setup" value="0" min="0" max="14">' +
                    '</div>' +
                    '<div class="gssh-ep-field">' +
                        '<label>Bumpout days</label>' +
                        '<input type="number" id="gssh-ep-bumpout" value="0" min="0" max="14">' +
                    '</div>' +
                    '<div class="gssh-ep-field" style="align-self:flex-end">' +
                        '<button id="gssh-ep-add-btn" class="gssh-ep-btn-primary">+ Add Event</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Event list
            '<div id="gssh-ep-event-list" class="gssh-ep-event-list"></div>' +

            // Starting health
            '<div class="gssh-ep-form-row" style="margin-top:12px; align-items:center">' +
                '<div class="gssh-ep-field">' +
                    '<label>Starting turf health</label>' +
                    '<input type="number" id="gssh-ep-start-health" value="85" min="10" max="100" step="5">' +
                '</div>' +
                '<div style="flex:1"></div>' +
                '<button id="gssh-ep-run-btn" class="gssh-ep-btn-run" disabled>Run Simulation</button>' +
            '</div>' +

            // Results
            '<div id="gssh-ep-results" class="gssh-ep-results" style="display:none"></div>' +
        '</div>';
    }

    // =========================================================================
    // EVENT LIST MANAGEMENT
    // =========================================================================

    function renderEventList() {
        var container = document.getElementById('gssh-ep-event-list');
        if (!container) return;

        var E = getEngine();
        if (!E || currentEvents.length === 0) {
            container.innerHTML = '<p class="gssh-ep-empty">No events added yet. Add events above to start planning.</p>';
            updateRunButton();
            return;
        }

        var html = '<div class="gssh-ep-events">';
        currentEvents.forEach(function(evt, idx) {
            var type = E.EVENT_TYPES[evt.type] || {};
            var conf = type.confidence === 'low' ? ' <span class="gssh-ep-tag gssh-ep-tag-low">low confidence</span>' : '';
            html += '<div class="gssh-ep-event-item">' +
                '<div class="gssh-ep-event-icon">' + (type.icon || '📅') + '</div>' +
                '<div class="gssh-ep-event-info">' +
                    '<strong>' + E.formatDateShort(evt.date) + '</strong> ' + esc(evt.name) + conf +
                    '<div class="gssh-ep-event-meta">' +
                        (type.label || evt.type) + ' · ' + evt.duration + 'h' +
                        (evt.crowd > 0 ? ' · ' + evt.crowd.toLocaleString() + ' attendance' : '') +
                        (evt.setupDays > 0 ? ' · setup ' + evt.setupDays + 'd' : '') +
                        (evt.bumpoutDays > 0 ? ' · bumpout ' + evt.bumpoutDays + 'd' : '') +
                    '</div>' +
                '</div>' +
                '<button class="gssh-ep-event-remove" data-idx="' + idx + '">&times;</button>' +
            '</div>';
        });
        html += '</div>';
        container.innerHTML = html;

        // Bind remove buttons
        container.querySelectorAll('.gssh-ep-event-remove').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var i = parseInt(this.getAttribute('data-idx'));
                currentEvents.splice(i, 1);
                renderEventList();
            });
        });

        updateRunButton();
    }

    function updateRunButton() {
        var btn = document.getElementById('gssh-ep-run-btn');
        if (btn) btn.disabled = currentEvents.length === 0;
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // =========================================================================
    // BIND EVENTS
    // =========================================================================

    function bindEvents() {
        var addBtn = document.getElementById('gssh-ep-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                var date = document.getElementById('gssh-ep-date').value;
                var name = document.getElementById('gssh-ep-name').value.trim();
                var type = document.getElementById('gssh-ep-type').value;
                var duration = parseFloat(document.getElementById('gssh-ep-duration').value) || 2;
                var crowd = parseInt(document.getElementById('gssh-ep-crowd').value) || 0;
                var setup = parseInt(document.getElementById('gssh-ep-setup').value) || 0;
                var bumpout = parseInt(document.getElementById('gssh-ep-bumpout').value) || 0;

                if (!date) { alert('Please select a date'); return; }
                if (!name) { name = (getEngine().EVENT_TYPES[type] || {}).label || type; }

                currentEvents.push({
                    date: date,
                    name: name,
                    type: type,
                    duration: duration,
                    crowd: crowd,
                    setupDays: setup,
                    bumpoutDays: bumpout
                });

                // Reset form
                document.getElementById('gssh-ep-name').value = '';
                document.getElementById('gssh-ep-crowd').value = '0';
                document.getElementById('gssh-ep-setup').value = '0';
                document.getElementById('gssh-ep-bumpout').value = '0';

                renderEventList();
                log('Event added:', name, date);
            });
        }

        var runBtn = document.getElementById('gssh-ep-run-btn');
        if (runBtn) {
            runBtn.addEventListener('click', runSimulation);
        }

        // Set default date to tomorrow
        var dateInput = document.getElementById('gssh-ep-date');
        if (dateInput) {
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 7);
            dateInput.value = tomorrow.toISOString().split('T')[0];
        }

        renderEventList();
    }

    // =========================================================================
    // RUN SIMULATION
    // =========================================================================

    function runSimulation() {
        var E = getEngine();
        if (!E) { log('Engine not loaded'); return; }
        if (currentEvents.length === 0) return;

        var hubState = getHubState();
        var shade = getShadeData();
        var startHealth = parseInt(document.getElementById('gssh-ep-start-health').value) || 85;

        var config = {
            events: currentEvents,
            speciesKey: E.resolveSpeciesKey(hubState),
            startHealth: startHealth,
            startReserves: startHealth,
            dli: shade.dli,
            shadeFactor: shade.shadeFactor,
            lat: getLatitude(),
            climateData: getClimateData(),
            interventions: []
        };

        log('Running simulation:', config.speciesKey, config.events.length, 'events');
        lastResult = E.simulate(config);
        log('Simulation complete:', lastResult.summary);

        renderResults(lastResult);
    }

    // =========================================================================
    // RENDER RESULTS
    // =========================================================================

    function renderResults(result) {
        var container = document.getElementById('gssh-ep-results');
        if (!container) return;

        var html = '';

        // Summary banner
        var s = result.summary;
        var riskColor = s.risk === 'HIGH' ? '#dc2626' : s.risk === 'MODERATE' ? '#d97706' : '#059669';
        var confLabel = s.confidence === 'high' ? 'High' : s.confidence === 'low' ? 'Low' : 'Medium';

        html += '<div class="gssh-ep-summary" style="border-left-color:' + riskColor + '">' +
            '<div class="gssh-ep-summary-header">' +
                '<span class="gssh-ep-summary-risk" style="background:' + riskColor + '">' + s.risk + ' RISK</span>' +
                '<span class="gssh-ep-summary-conf">Confidence: ' + confLabel + '</span>' +
            '</div>' +
            '<div class="gssh-ep-summary-metrics">' +
                '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + s.eventCount + '</span><span class="gssh-ep-metric-label">Events</span></div>' +
                '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + s.minHealth + '%</span><span class="gssh-ep-metric-label">Min health</span></div>' +
                '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + s.daysBelow60 + '</span><span class="gssh-ep-metric-label">Days &lt;60%</span></div>' +
                '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + s.pinchPointCount + '</span><span class="gssh-ep-metric-label">Pinch points</span></div>' +
                '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + s.insufficientGaps + '</span><span class="gssh-ep-metric-label">Short gaps</span></div>' +
            '</div>' +
        '</div>';

        // Timeline chart
        html += '<div class="gssh-ep-chart-container">' +
            '<h4>Health Trajectory</h4>' +
            '<div id="gssh-ep-chart"></div>' +
        '</div>';

        // Event impact cards
        html += '<h4 style="margin:16px 0 8px">Event Impact</h4>';
        result.eventResults.forEach(function(evt) {
            var E = getEngine();
            var type = E.EVENT_TYPES[evt.type] || {};
            var healthDrop = evt.healthAtEntry - evt.healthAfter;
            var entryColor = evt.healthAtEntry >= 70 ? '#059669' : evt.healthAtEntry >= 50 ? '#d97706' : '#dc2626';
            var exitColor = evt.healthAfter >= 70 ? '#059669' : evt.healthAfter >= 50 ? '#d97706' : '#dc2626';

            html += '<div class="gssh-ep-event-card">' +
                '<div class="gssh-ep-event-card-header">' +
                    '<span>' + (type.icon || '📅') + ' ' + esc(evt.name) + '</span>' +
                    '<span class="gssh-ep-event-card-date">' + E.formatDateShort(evt.date) + '</span>' +
                '</div>' +
                '<div class="gssh-ep-event-card-metrics">' +
                    '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val" style="color:' + entryColor + '">' + evt.healthAtEntry + '%</span><span class="gssh-ep-metric-label">Entry</span></div>' +
                    '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val" style="color:' + exitColor + '">' + evt.healthAfter + '%</span><span class="gssh-ep-metric-label">Exit</span></div>' +
                    '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">-' + healthDrop.toFixed(1) + '%</span><span class="gssh-ep-metric-label">Damage</span></div>' +
                    '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + evt.gp + '%</span><span class="gssh-ep-metric-label">GP</span></div>' +
                    '<div class="gssh-ep-metric"><span class="gssh-ep-metric-val">' + evt.dli + '</span><span class="gssh-ep-metric-label">DLI</span></div>' +
                '</div>' +
            '</div>';
        });

        // Pinch points
        if (result.pinchPoints.length > 0) {
            html += '<h4 style="margin:16px 0 8px">Pinch Points</h4>';
            result.pinchPoints.forEach(function(pp) {
                var E = getEngine();
                var sevColor = pp.severity === 'critical' ? '#dc2626' : '#d97706';
                html += '<div class="gssh-ep-pinch" style="border-left-color:' + sevColor + '">' +
                    '<strong>' + pp.severity.toUpperCase() + ':</strong> ' + pp.message +
                '</div>';
            });
        }

        // Recovery gaps with recommendations
        if (result.recoveryGaps.length > 0) {
            result.recoveryGaps.forEach(function(gap) {
                html += '<div class="gssh-ep-gap-warning">';

                if (!gap.sufficient) {
                    html += '<div class="gssh-ep-gap-header">Recovery Gap: ' +
                        esc(gap.afterEvent) + ' → ' + esc(gap.beforeEvent) +
                        ' (' + gap.gapDays + ' days)' +
                    '</div>' +
                    '<p>Projected health at next event: <strong>' + gap.projectedHealthAtNext + '%</strong> ' +
                    '(below 65% target)</p>';
                }

                if (gap.recommendations && gap.recommendations.length > 0) {
                    // Split into pre-event and post-event
                    var preRecs = gap.recommendations.filter(function(r) { return r.category === 'pre_event'; });
                    var postRecs = gap.recommendations.filter(function(r) { return r.category === 'post_event'; });
                    var warnings = gap.recommendations.filter(function(r) { return r.priority === 'critical'; });

                    // Warnings first
                    if (warnings.length > 0) {
                        html += '<div class="gssh-ep-recs-section gssh-ep-recs-warning">';
                        warnings.forEach(function(r) {
                            html += '<p style="color:#dc2626;font-weight:600;margin:4px 0">⚠️ ' + r.label + '</p>';
                        });
                        html += '</div>';
                    }

                    // Pre-event recommendations
                    var preRecsNoWarn = preRecs.filter(function(r) { return r.priority !== 'critical'; });
                    if (preRecsNoWarn.length > 0) {
                        html += '<div class="gssh-ep-recs"><strong>Pre-event preparation:</strong><ul>';
                        preRecsNoWarn.forEach(function(r) {
                            html += '<li><strong>' + r.timing + ':</strong> ' + r.label + '</li>';
                        });
                        html += '</ul></div>';
                    }

                    // Post-event recommendations
                    if (postRecs.length > 0) {
                        html += '<div class="gssh-ep-recs" style="margin-top:6px"><strong>Post-event recovery:</strong><ul>';
                        postRecs.forEach(function(r) {
                            html += '<li><strong>' + r.timing + ':</strong> ' + r.label + '</li>';
                        });
                        html += '</ul></div>';
                    }
                }
                html += '</div>';
            });
        }

        // Confidence disclosure
        html += '<div class="gssh-ep-confidence-note">' +
            'Simulation based on species-specific carbohydrate reserve modelling ' +
            '(Carrow & Petrovic 1992). Sport wear factors from Gelernter et al. 2005. ' +
            'Concert/festival factors are operational estimates (low confidence). ' +
            'Pre-event management protocols from Gilba Solutions (2025). ' +
            'Climate projections beyond 8 days use climatological normals.' +
        '</div>';

        container.innerHTML = html;
        container.style.display = 'block';

        // Render SVG chart after DOM update
        setTimeout(function() { renderChart(result); }, 50);
    }

    // =========================================================================
    // SVG TIMELINE CHART
    // =========================================================================

    function renderChart(result) {
        var container = document.getElementById('gssh-ep-chart');
        if (!container || !result.trajectory || result.trajectory.length === 0) return;

        var E = getEngine();
        var traj = result.trajectory;
        var W = Math.min(container.clientWidth || 700, 900);
        var H = 220;
        var padL = 38, padR = 12, padT = 12, padB = 28;
        var plotW = W - padL - padR;
        var plotH = H - padT - padB;

        var n = traj.length;
        var xScale = plotW / Math.max(1, n - 1);

        // Build SVG
        var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" ' +
                  'style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:10px">';

        // Threshold bands
        svg += '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + (plotH * 0.4) + '" fill="var(--gaip-good-bg)" opacity="0.5"/>';
        svg += '<rect x="' + padL + '" y="' + (padT + plotH * 0.4) + '" width="' + plotW + '" height="' + (plotH * 0.2) + '" fill="var(--gaip-warning-bg)" opacity="0.5"/>';
        svg += '<rect x="' + padL + '" y="' + (padT + plotH * 0.6) + '" width="' + plotW + '" height="' + (plotH * 0.4) + '" fill="var(--gaip-critical-bg)" opacity="0.5"/>';

        // Grid lines
        [100, 80, 60, 40, 20, 0].forEach(function(v) {
            var y = padT + plotH - (v / 100 * plotH);
            var dash = (v === 60) ? '' : 'stroke-dasharray="3,3"';
            var sw = (v === 60) ? '1' : '0.5';
            var col = (v === 60) ? '#d97706' : 'var(--gaip-border)';
            svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + plotW) + '" y2="' + y + '" stroke="' + col + '" stroke-width="' + sw + '" ' + dash + '/>';
            svg += '<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" fill="var(--gaip-text-secondary)" font-size="9">' + v + '</text>';
        });

        // Event markers (background bands)
        traj.forEach(function(t, i) {
            if (t.phase === 'event') {
                var x = padL + i * xScale;
                svg += '<rect x="' + (x - 2) + '" y="' + padT + '" width="4" height="' + plotH + '" fill="#ef4444" opacity="0.2"/>';
            } else if (t.phase === 'setup' || t.phase === 'bumpout') {
                var x2 = padL + i * xScale;
                svg += '<rect x="' + (x2 - 2) + '" y="' + padT + '" width="4" height="' + plotH + '" fill="var(--gaip-text-secondary)" opacity="0.15"/>';
            }
        });

        // Health line
        var pathD = '';
        traj.forEach(function(t, i) {
            var x = padL + i * xScale;
            var y = padT + plotH - (t.health / 100 * plotH);
            pathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
        });
        svg += '<path d="' + pathD + '" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>';

        // Event date labels
        result.eventResults.forEach(function(evt) {
            for (var i = 0; i < traj.length; i++) {
                if (traj[i].date === evt.date) {
                    var x = padL + i * xScale;
                    var y = padT + plotH + 14;
                    svg += '<text x="' + x + '" y="' + y + '" text-anchor="middle" fill="var(--gaip-text)" font-size="9" font-weight="500">' +
                           E.formatDateShort(evt.date) + '</text>';
                    // Marker dot
                    var dotY = padT + plotH - (evt.healthAfter / 100 * plotH);
                    svg += '<circle cx="' + x + '" cy="' + dotY + '" r="4" fill="#ef4444" stroke="white" stroke-width="1.5"/>';
                    break;
                }
            }
        });

        // Y axis label
        svg += '<text x="10" y="' + (padT + plotH / 2) + '" text-anchor="middle" fill="var(--gaip-text-secondary)" font-size="9" transform="rotate(-90,10,' + (padT + plotH / 2) + ')">Health %</text>';

        svg += '</svg>';
        container.innerHTML = svg;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GSSH_EventPlannerUI = {
        VERSION: VERSION,
        show: showPanel,
        hide: hidePanel,
        toggle: togglePanel,
        getLastResult: function() { return lastResult; },
        getEvents: function() { return currentEvents; }
    };

    // Wire the button via addEventListener only.
    // No inline onclick — tab-navigation's appendChild can trigger inline handlers.
    function wireButton() {
        var btn = document.getElementById('gssh-event-planner-btn');
        if (btn && !btn._epWired) {
            btn._epWired = true;
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                log('Button clicked');
                togglePanel();
            });
            log('Button wired via addEventListener');
        }
    }

    // Wire immediately, on DOMContentLoaded, and after delays
    // (tab-navigation moves button at various times)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireButton);
    } else {
        wireButton();
    }
    setTimeout(wireButton, 500);
    setTimeout(wireButton, 1500);
    setTimeout(wireButton, 4000);

    console.log('[EventPlannerUI] v' + VERSION + ' loaded');

})(typeof window !== 'undefined' ? window : this);
