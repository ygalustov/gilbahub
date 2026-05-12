/**
 * GAIP Pre-Emergent Timing Integration & UI
 * v1.1.0
 *
 * Listens for gaip:orchestrator-complete, reads window.GAIP_PRE_EMERGENT_RESULT,
 * and renders a timing card into the results section.
 *
 * v1.1.0 changes:
 *   - Tropical region support: southeast_asia, australia_tropical, australia_subtropical
 *   - PERSISTENT_PRESSURE status rendering (programme-interval card)
 *   - ADVISORY_ONLY status for Cyperus nutsedge spp. (pre-emergent ineffective)
 *   - resistanceWarning, sedgeNote, tropicalNote fields surfaced
 *   - Cool-season GREEN species suppressed when isTropicalRegion: true
 *   - Tropical summary strip shows persistentPressureCount and advisoryOnlyCount
 *   - Season section logic replaced with tropical/temperate routing
 *
 * Gilba Solutions | March 2026
 */

(function () {
    'use strict';

    var VERSION = '1.1.0';
    var CONTAINER_ID = 'gaip-pre-emergent-container';

    var CONFIG = { debug: false };

    function log()  { if (CONFIG.debug) { var a = Array.prototype.slice.call(arguments); console.log.apply(console, ['[PreEmergent]'].concat(a)); } }
    function warn() { var a = Array.prototype.slice.call(arguments); console.warn.apply(console, ['[PreEmergent]'].concat(a)); }

    // =========================================================================
    // COLOURS & LABELS
    // =========================================================================

    var STATUS_CONFIG = {
        GREEN:               { colour: '#22c55e', bg: 'var(--gaip-good-bg)', border: 'var(--gaip-good-bg)', label: 'No action',            icon: '●' },
        AMBER:               { colour: '#f59e0b', bg: 'var(--gaip-warning-bg)', border: 'var(--gaip-warning-border)', label: 'Apply now',            icon: '●' },
        RED_EARLY:           { colour: '#ef4444', bg: 'var(--gaip-critical-bg)', border: 'var(--gaip-critical-border)', label: 'Closing fast',         icon: '●' },
        RED_MISSED:          { colour: '#7c3aed', bg: 'var(--gaip-info-bg)', border: 'var(--gaip-info-bg)', label: 'Timing passed',        icon: '●' },
        PERSISTENT_PRESSURE: { colour: '#ea580c', bg: 'var(--gaip-warning-bg)', border: 'var(--gaip-warning-border)', label: 'Persistent pressure',  icon: '●' },
        ADVISORY_ONLY:       { colour: 'var(--gaip-text-secondary)', bg: 'var(--gaip-surface-muted)', border: 'var(--gaip-border)', label: 'Post-emergent only',   icon: '●' }
    };

    var CONFIDENCE_LABEL = { H: 'High confidence', M: 'Medium confidence', L: 'Low confidence, informational only' };

    // Cool-season temperate species to suppress in tropical regions
    var COOL_SEASON_KEYS = [
        'poa_annua', 'stellaria_media', 'soliva_sessilis', 'taraxacum_officinale',
        'trifolium_repens', 'lamium_amplexicaule', 'hypochoeris_radicata', 'oxalis_corniculata'
    ];

    // =========================================================================
    // ORCHESTRATOR LISTENER
    // =========================================================================

    function initOrchestratorListener() {
        document.addEventListener('gaip:orchestrator-complete', function () {
            renderFromResult();
        });

        // b35fix236: blank panel immediately on site-switch so stale data
        // from the prior site doesn't persist until the new run completes.
        document.addEventListener('gaip:site-data-invalidated', function () {
            var container = document.getElementById(CONTAINER_ID);
            if (container) container.innerHTML = '';
            log('Site switched, pre-emergent panel cleared, awaiting new run');
        });

        if (window.GAIP_PRE_EMERGENT_RESULT) {
            log('Late init, result already available');
            setTimeout(renderFromResult, 0);
        }
    }

    function renderFromResult() {
        var result = window.GAIP_PRE_EMERGENT_RESULT;
        if (!result || !result.success) {
            log('No valid result available');
            return;
        }

        var container = document.getElementById(CONTAINER_ID);
        if (!container) container = createContainer();
        if (!container) {
            warn('Could not create container');
            return;
        }

        try {
            container.innerHTML = buildCardHTML(result);
            bindToggleEvents(container);
            log('Card rendered, aggregate status:', result.aggregateStatus, 'tropical:', result.isTropicalRegion);
        } catch (e) {
            warn('Render error:', e);
        }
    }

    // =========================================================================
    // CONTAINER CREATION
    // =========================================================================

    function createContainer() {
        var resultsSection = document.getElementById('gaip-results') ||
                             document.querySelector('.gaip-results') ||
                             document.querySelector('.gaip-output');

        if (!resultsSection) {
            warn('Results section not found');
            return null;
        }

        var container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.className = 'gaip-result-block';
        container.setAttribute('data-section', 'pre-emergent');
        container.style.marginTop = '16px';

        var anchor = resultsSection.querySelector('[data-section="trajectory"]') ||
                     resultsSection.querySelector('[data-section="disease"]');

        if (anchor) {
            var parent = anchor.parentNode || resultsSection;
            if (anchor.nextSibling) {
                parent.insertBefore(container, anchor.nextSibling);
            } else {
                parent.appendChild(container);
            }
        } else {
            resultsSection.appendChild(container);
        }

        return container;
    }

    // =========================================================================
    // HTML BUILDER — TOP LEVEL
    // =========================================================================

    function buildCardHTML(result) {
        var isTropical = !!result.isTropicalRegion;
        var agg = result.aggregateStatus;
        var sc  = STATUS_CONFIG[agg] || STATUS_CONFIG.GREEN;
        var sum = result.summary || {};
        var results = result.results || [];

        // Filter out error entries
        var valid = results.filter(function (r) { return !r.error; });

        // In tropical regions: suppress ALL cool-season species from display regardless of alert status.
        // These species require declining/cool soil temps to germinate — they cannot fire meaningfully
        // in SE Asia / tropical AU where soils stay warm year-round. Showing AMBER/RED for them
        // is misleading (the declining-threshold logic fires spuriously on warm stable temps).
        var displayResults = isTropical
            ? valid.filter(function (r) {
                return COOL_SEASON_KEYS.indexOf(r.speciesKey) === -1;
              })
            : valid;

        var active = displayResults.filter(function (r) {
            return r.alertStatus !== 'GREEN' && r.alertStatus !== 'ADVISORY_ONLY';
        });

        var cardId = 'gaip-pe-body';
        var html = '';

        html += '<div class="gaip-pe-card">';

        // ── Header ──────────────────────────────────────────────────────────
        html += '<div class="gaip-pe-header" onclick="var b=document.getElementById(\'' + cardId + '\');' +
                'b.style.display=b.style.display===\'none\'?\'block\':\'none\';' +
                'this.querySelector(\'.gaip-pe-chevron\').textContent=b.style.display===\'none\'?\'▶\':\'▼\';" ' +
                'style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:10px 12px; ' +
                'background:var(--gaip-surface-muted); border-radius:6px 6px 0 0; border-bottom:1px solid var(--gaip-border); user-select:none;">';

        html += '<span style="font-size:14px;">🌿</span>';
        html += '<span style="flex:1; font-size:13px; font-weight:600; color:var(--gaip-text);">Pre-Emergent Timing</span>';

        if (isTropical) {
            html += '<span style="font-size:10px; color:#ea580c; font-weight:500; margin-right:4px;">🌴 Tropical</span>';
        }

        // Badge
        html += '<span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; ' +
                'background:' + sc.bg + '; color:' + sc.colour + '; border:1px solid ' + sc.border + ';">' +
                '<span style="color:' + sc.colour + ';">● </span>' + sc.label + '</span>';

        if (active.length > 0) {
            html += '<span style="font-size:11px; color:var(--gaip-text-secondary); margin-left:4px;">' +
                    active.length + ' alert' + (active.length !== 1 ? 's' : '') + '</span>';
        }

        html += '<span class="gaip-pe-chevron" style="font-size:11px; color:var(--gaip-text-muted); margin-left:4px;">▼</span>';
        html += '</div>'; // end header

        // ── Body ────────────────────────────────────────────────────────────
        html += '<div id="' + cardId + '" style="padding:12px;">';

        // Soil temp summary strip
        html += buildSummaryStrip(sum, isTropical);

        if (displayResults.length === 0) {
            html += '<p style="font-size:12px; color:var(--gaip-text-secondary);">No species data available for this region.</p>';
        } else {
            html += isTropical
                ? buildTropicalSections(displayResults)
                : buildTemperateSections(displayResults);
        }

        html += '</div>'; // end body
        html += '</div>'; // end card

        return html;
    }

    // =========================================================================
    // SUMMARY STRIP
    // =========================================================================

    function buildSummaryStrip(sum, isTropical) {
        var html = '<div style="display:flex; gap:16px; padding:8px 10px; background:var(--gaip-surface-muted); ' +
                   'border-radius:4px; margin-bottom:12px; font-size:11px; color:var(--gaip-text); flex-wrap:wrap;">';

        if (sum.soilTemp5cm != null) {
            var soilTempLabel = sum.soilTempSource === 'derived_from_air_temp'
                ? sum.soilTemp5cm.toFixed(1) + '°C <span style="color:var(--gaip-text-muted);">(est. from air temp)</span>'
                : sum.soilTemp5cm.toFixed(1) + '°C';
            html += '<span><strong>Soil temp:</strong> ' + soilTempLabel + '</span>';
        }
        if (sum.rollingAvg10d != null) {
            html += '<span><strong>10-day avg:</strong> ' + sum.rollingAvg10d.toFixed(1) + '°C</span>';
        }
        if (sum.trendDirection) {
            var trendIcon = sum.trendDirection === 'warming' ? '↑' : sum.trendDirection === 'cooling' ? '↓' : '→';
            html += '<span><strong>Trend:</strong> ' + trendIcon + ' ' + sum.trendDirection + '</span>';
        }

        if (isTropical) {
            if (sum.persistentPressureCount != null && sum.persistentPressureCount > 0) {
                html += '<span style="color:#ea580c;"><strong>' + sum.persistentPressureCount +
                        '</strong> species at persistent pressure</span>';
            }
            if (sum.advisoryOnlyCount != null && sum.advisoryOnlyCount > 0) {
                html += '<span style="color:var(--gaip-text-secondary);"><strong>' + sum.advisoryOnlyCount +
                        '</strong> post-emergent only</span>';
            }
            if (sum.region) {
                var regionLabel = { southeast_asia: 'SE Asia', australia_tropical: 'AU Tropical', australia_subtropical: 'AU Subtropical' };
                html += '<span style="color:var(--gaip-text-secondary);">Region: <strong>' + (regionLabel[sum.region] || sum.region) + '</strong></span>';
            }
        }

        html += '</div>';
        return html;
    }

    // =========================================================================
    // TEMPERATE SECTION LAYOUT (unchanged from v1.0.0)
    // =========================================================================

    function buildTemperateSections(results) {
        var html = '';
        var autumnSpecies = results.filter(function (r) { return !r.springOnly; });
        var springSpecies = results.filter(function (r) { return r.springOnly; });

        if (autumnSpecies.length > 0) {
            html += buildSeasonSection('🍂 Autumn window', autumnSpecies, 'gaip-pe-autumn', true);
        }
        if (springSpecies.length > 0) {
            html += buildSeasonSection('🌱 Spring window', springSpecies, 'gaip-pe-spring', false);
        }
        return html;
    }

    // =========================================================================
    // TROPICAL SECTION LAYOUT (new in v1.1.0)
    // =========================================================================

    function buildTropicalSections(results) {
        var html = '';

        // Split into: actionable (PERSISTENT_PRESSURE, AMBER, RED_*), advisory (ADVISORY_ONLY), green
        var pressureSpecies  = results.filter(function (r) {
            return r.alertStatus === 'PERSISTENT_PRESSURE' || r.alertStatus === 'AMBER' ||
                   r.alertStatus === 'RED_EARLY' || r.alertStatus === 'RED_MISSED';
        });
        var advisorySpecies  = results.filter(function (r) { return r.alertStatus === 'ADVISORY_ONLY'; });
        var greenSpecies     = results.filter(function (r) { return r.alertStatus === 'GREEN'; });

        if (pressureSpecies.length > 0) {
            html += buildSeasonSection('🌴 Active pressure, programme window', pressureSpecies, 'gaip-pe-tropical-active', true);
        }
        if (advisorySpecies.length > 0) {
            html += buildSeasonSection('⚠ Post-emergent strategy only', advisorySpecies, 'gaip-pe-tropical-advisory', true);
        }
        if (greenSpecies.length > 0) {
            html += buildSeasonSection('✓ Below threshold', greenSpecies, 'gaip-pe-tropical-green', false);
        }
        return html;
    }

    // =========================================================================
    // SHARED SEASON SECTION BUILDER
    // =========================================================================

    function buildSeasonSection(title, results, sectionId, expandedByDefault) {
        var html = '';
        var hasAlerts = results.some(function (r) {
            return r.alertStatus !== 'GREEN' && r.alertStatus !== 'ADVISORY_ONLY';
        });
        var isSpring = sectionId === 'gaip-pe-spring';
        var display  = expandedByDefault ? 'block' : 'none';
        var chevron  = expandedByDefault ? '▼' : '▶';

        html += '<div style="margin-bottom:6px;">';
        html += '<div class="gaip-pe-sec-toggle" data-target="' + sectionId + '" ' +
                'style="cursor:pointer; display:flex; align-items:center; gap:6px; ' +
                'padding:5px 0; user-select:none;">';
        html += '<span style="font-size:12px; font-weight:600; color:var(--gaip-text); flex:1;">' + esc(title) + '</span>';
        if (isSpring) {
            html += '<span style="font-size:10px; color:var(--gaip-text-muted); margin-right:4px;">Next window: Aug–Sep</span>';
        } else if (!hasAlerts && sectionId === 'gaip-pe-autumn') {
            html += '<span style="font-size:10px; color:var(--gaip-text-muted); margin-right:4px;">No active alerts</span>';
        }
        html += '<span class="gaip-pe-sec-chev" style="font-size:10px; color:var(--gaip-text-muted);">' + chevron + '</span>';
        html += '</div>';
        html += '<div id="' + sectionId + '" style="display:' + display + ';">';
        html += buildSpeciesRows(results);
        html += '</div>';
        html += '</div>';

        return html;
    }

    // =========================================================================
    // SPECIES ROWS
    // =========================================================================

    function buildSpeciesRows(results) {
        var html = '<div style="display:flex; flex-direction:column; gap:6px;">';
        results.forEach(function (r) {
            html += r.alertStatus === 'ADVISORY_ONLY'
                ? buildAdvisoryRow(r)
                : buildSpeciesRow(r);
        });
        html += '</div>';
        return html;
    }

    // Standard species row (temperate + tropical PERSISTENT_PRESSURE / AMBER / RED)
    function buildSpeciesRow(r) {
        var sc = STATUS_CONFIG[r.alertStatus] || STATUS_CONFIG.GREEN;
        var rowId = 'gaip-pe-row-' + r.speciesKey.replace(/[^a-z0-9]/gi, '_');

        var html = '<div style="border:1px solid ' + sc.border + '; border-radius:6px; overflow:hidden; background:' + sc.bg + ';">';

        // Row header
        html += '<div onclick="var b=document.getElementById(\'' + rowId + '\');' +
                'b.style.display=b.style.display===\'none\'?\'block\':\'none\';' +
                'this.querySelector(\'.gaip-pe-row-chevron\').textContent=b.style.display===\'none\'?\'▶\':\'▼\';" ' +
                'style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:5px 8px; font-size:12px;">';

        html += '<span style="color:' + sc.colour + '; font-size:10px; flex-shrink:0;">●</span>';
        html += '<span style="flex:1; font-size:12px; font-weight:500; color:var(--gaip-text); line-height:1.2;">' +
                esc(r.commonName) + '</span>';
        html += '<span style="font-size:11px; color:var(--gaip-text-muted); font-style:italic; margin-right:4px;">' +
                esc(r.scientificName || r.speciesKey) + '</span>';

        // Persistent pressure badge
        if (r.alertStatus === 'PERSISTENT_PRESSURE') {
            html += '<span style="font-size:10px; padding:1px 5px; border-radius:999px; ' +
                    'background:var(--gaip-warning-bg); color:#ea580c; border:1px solid var(--gaip-warning-border); margin-right:4px;">Programme</span>';
        }

        // Days to threshold (applicable for temperate AMBER/RED_EARLY)
        if (r.alertStatus !== 'GREEN' && r.alertStatus !== 'RED_MISSED' &&
            r.alertStatus !== 'PERSISTENT_PRESSURE' && r.daysToThreshold != null) {
            html += '<span style="font-size:11px; color:' + sc.colour + '; font-weight:600; margin-right:6px;">' +
                    r.daysToThreshold + 'd</span>';
        }

        // Confidence badge
        var confColour = r.confidenceRating === 'H' ? '#10b981' : r.confidenceRating === 'M' ? '#f59e0b' : 'var(--gaip-text-muted)';
        html += '<span style="font-size:10px; padding:1px 5px; border-radius:999px; ' +
                'background:rgba(0,0,0,0.05); color:' + confColour + '; margin-right:4px;">' +
                r.confidenceRating + '</span>';

        html += '<span class="gaip-pe-row-chevron" style="font-size:10px; color:var(--gaip-text-muted);">▶</span>';
        html += '</div>'; // end row header

        // Row detail
        html += '<div id="' + rowId + '" style="display:none; padding:8px 10px 10px; ' +
                'border-top:1px solid ' + sc.border + '; background:var(--gaip-surface);">';

        // Recommended action
        html += '<div style="font-size:12px; color:var(--gaip-text); margin-bottom:6px;">' +
                esc(r.recommendedAction) + '</div>';

        // Tropical note (programme context)
        if (r.tropicalNote) {
            html += '<div style="font-size:11px; color:#9a3412; background:var(--gaip-warning-bg); ' +
                    'border:1px solid var(--gaip-warning-border); border-radius:4px; padding:4px 8px; margin-bottom:6px;">🌴 ' +
                    esc(r.tropicalNote) + '</div>';
        }

        // Resistance warning
        if (r.resistanceWarning) {
            html += '<div style="font-size:11px; color:#b91c1c; background:var(--gaip-critical-bg); ' +
                    'border:1px solid var(--gaip-critical-border); border-radius:4px; padding:4px 8px; margin-bottom:6px;">⚠ ' +
                    esc(r.resistanceWarning) + '</div>';
        }

        // Moisture warning
        if (r.moistureWarning) {
            html += '<div style="font-size:11px; color:#b45309; background:var(--gaip-warning-bg); ' +
                    'border:1px solid var(--gaip-warning-border); border-radius:4px; padding:4px 8px; margin-bottom:6px;">💧 ' +
                    esc(r.moistureWarning) + '</div>';
        }

        // Perennial warning
        if (r.perennialWarning) {
            html += '<div style="font-size:11px; color:var(--gaip-text-secondary); background:var(--gaip-surface-muted); ' +
                    'border-radius:4px; padding:4px 8px; margin-bottom:6px;">⚠ ' +
                    esc(r.perennialWarning) + '</div>';
        }

        // Broadleaf / sedge note
        var chemiNote = r.broadleafNote || r.sedgeNote || null;
        if (chemiNote) {
            html += '<div style="font-size:11px; color:#1e40af; background:var(--gaip-info-bg); ' +
                    'border-radius:4px; padding:4px 8px; margin-bottom:6px;">ℹ ' +
                    esc(chemiNote) + '</div>';
        }

        // Stats row
        html += '<div style="display:flex; gap:12px; flex-wrap:wrap; font-size:11px; color:var(--gaip-text-secondary); margin-top:4px;">';
        html += '<span>Threshold: <strong>' + r.germinationThreshold + '°C</strong></span>';
        if (r.applyAt != null) {
            html += '<span>Apply at: <strong>' + r.applyAt + '°C</strong></span>';
        }
        if (r.rollingAvg10d != null) {
            html += '<span>10-day avg: <strong>' + r.rollingAvg10d.toFixed(1) + '°C</strong></span>';
        }
        html += '<span>Confidence: <strong>' + r.confidenceScore + '%</strong> (' + (CONFIDENCE_LABEL[r.confidenceRating] || r.confidenceRating) + ')</span>';
        html += '</div>';

        if (r.notes) {
            html += '<div style="font-size:10px; color:var(--gaip-text-muted); margin-top:6px; font-style:italic;">' +
                    esc(r.notes) + '</div>';
        }

        html += '</div>'; // end detail
        html += '</div>'; // end row card

        return html;
    }

    // Advisory-only row for pre-emergent ineffective species (nutsedge)
    function buildAdvisoryRow(r) {
        var sc = STATUS_CONFIG.ADVISORY_ONLY;
        var rowId = 'gaip-pe-row-' + r.speciesKey.replace(/[^a-z0-9]/gi, '_');

        var html = '<div style="border:1px solid ' + sc.border + '; border-radius:6px; overflow:hidden; background:' + sc.bg + ';">';

        // Row header
        html += '<div onclick="var b=document.getElementById(\'' + rowId + '\');' +
                'b.style.display=b.style.display===\'none\'?\'block\':\'none\';' +
                'this.querySelector(\'.gaip-pe-row-chevron\').textContent=b.style.display===\'none\'?\'▶\':\'▼\';" ' +
                'style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:5px 8px; font-size:12px;">';

        html += '<span style="color:' + sc.colour + '; font-size:10px; flex-shrink:0;">●</span>';
        html += '<span style="flex:1; font-size:12px; font-weight:500; color:var(--gaip-text); line-height:1.2;">' +
                esc(r.commonName) + '</span>';
        html += '<span style="font-size:11px; color:var(--gaip-text-muted); font-style:italic; margin-right:4px;">' +
                esc(r.scientificName || r.speciesKey) + '</span>';
        html += '<span style="font-size:10px; padding:1px 5px; border-radius:999px; ' +
                'background:var(--gaip-surface-hover); color:var(--gaip-text-secondary); border:1px solid var(--gaip-border); margin-right:4px;">POST only</span>';
        html += '<span class="gaip-pe-row-chevron" style="font-size:10px; color:var(--gaip-text-muted);">▶</span>';
        html += '</div>';

        // Detail
        html += '<div id="' + rowId + '" style="display:none; padding:8px 10px 10px; border-top:1px solid var(--gaip-border); background:var(--gaip-surface);">';

        html += '<div style="font-size:12px; color:var(--gaip-text); margin-bottom:6px;">' +
                esc(r.recommendedAction) + '</div>';

        if (r.tropicalNote) {
            html += '<div style="font-size:11px; color:#9a3412; background:var(--gaip-warning-bg); ' +
                    'border:1px solid var(--gaip-warning-border); border-radius:4px; padding:4px 8px; margin-bottom:6px;">🌴 ' +
                    esc(r.tropicalNote) + '</div>';
        }

        if (r.sedgeNote) {
            html += '<div style="font-size:11px; color:#1e40af; background:var(--gaip-info-bg); ' +
                    'border-radius:4px; padding:4px 8px; margin-bottom:6px;">ℹ ' +
                    esc(r.sedgeNote) + '</div>';
        }

        if (r.perennialWarning) {
            html += '<div style="font-size:11px; color:#b91c1c; background:var(--gaip-critical-bg); ' +
                    'border-radius:4px; padding:4px 8px; margin-bottom:6px;">⚠ ' +
                    esc(r.perennialWarning) + '</div>';
        }

        if (r.notes) {
            html += '<div style="font-size:10px; color:var(--gaip-text-muted); margin-top:6px; font-style:italic;">' +
                    esc(r.notes) + '</div>';
        }

        html += '</div>';
        html += '</div>';

        return html;
    }

    // =========================================================================
    // TOGGLE BINDING
    // =========================================================================

    function bindToggleEvents(container) {
        var secToggles = container.querySelectorAll('.gaip-pe-sec-toggle');
        for (var i = 0; i < secToggles.length; i++) {
            secToggles[i].addEventListener('click', function () {
                var targetId = this.getAttribute('data-target');
                var body = document.getElementById(targetId);
                if (!body) return;
                var open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                var chev = this.querySelector('.gaip-pe-sec-chev');
                if (chev) chev.textContent = open ? '▶' : '▼';
            });
        }
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        log('Pre-Emergent Integration v' + VERSION + ' init');
        initOrchestratorListener();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[PreEmergent] Integration v' + VERSION + ' loaded');

})();
