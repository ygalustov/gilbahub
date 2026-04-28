/**
 * Gilba Coverage Slider v2.0.0
 * 
 * Updates on slider change:
 * 1. SVG rig visibility (deployed + ghost)
 * 2. Summary metrics (rigs required, coverage %, area, est. health)
 * 3. Rotation schedule
 * 4. Health trajectory chart (interpolates between without/with supplement data)
 * 
 * Reads PHP-generated trajectory data from data-health-projection attribute
 * and interpolates to produce the chart for any slider value.
 */
(function() {
    'use strict';

    console.log('[GilbaSlider] Coverage slider v2.0.0 loading...');

    // =========================================================================
    // ROTATION SCHEDULE
    // =========================================================================

    function generateRotationSchedule(rigsNeeded, config) {
        var container = document.getElementById('gssh-dynamic-rotation');
        var content = document.getElementById('gssh-rotation-content');
        if (!container || !content) return;

        var zones = config.zones || [];
        if (zones.length <= 1 || rigsNeeded <= 0) {
            container.style.display = 'none';
            return;
        }

        if (rigsNeeded >= zones.length) {
            container.style.display = 'block';
            content.innerHTML = '<div style="color: #22c55e;">\u2713 ' + rigsNeeded +
                ' rigs cover all ' + zones.length + ' deficit zones continuously. No rotation required.</div>';
            return;
        }

        var rotationDays = config.rotationDays || 5;
        var daysInMonth = 31;
        var numRotations = Math.ceil(daysInMonth / rotationDays);
        var positionsChange = false;
        var firstPositions = '';
        var rotationsHtml = '';

        for (var r = 0; r < numRotations; r++) {
            var startDay = r * rotationDays + 1;
            var endDay = Math.min((r + 1) * rotationDays, daysInMonth);
            var placements = [];
            for (var i = 0; i < rigsNeeded; i++) {
                var zi = (r * rigsNeeded + i) % zones.length;
                placements.push({ rig: i + 1, x: zones[zi].x, y: zones[zi].y });
            }
            var posKey = placements.map(function(p) { return p.x + ',' + p.y; }).sort().join('|');
            if (r === 0) firstPositions = posKey;
            else if (posKey !== firstPositions) positionsChange = true;

            var tags = placements.map(function(p) {
                return '<span style="background:#3b82f6;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:4px;">Rig ' +
                    p.rig + ': (' + p.x + ', ' + p.y + ')</span>';
            }).join('');
            rotationsHtml += '<div style="background:#1a1a2e;padding:8px 12px;border-radius:6px;margin-bottom:6px;">' +
                '<div style="color:#a1a1aa;margin-bottom:4px;font-size:12px;"><strong style="color:#fff;">Rotation ' +
                (r + 1) + '</strong> \u2014 Days ' + startDay + '-' + endDay + '</div><div>' + tags + '</div></div>';
        }

        if (!positionsChange) {
            container.style.display = 'block';
            var sp = [];
            for (var j = 0; j < rigsNeeded && j < zones.length; j++) {
                sp.push('Rig ' + (j + 1) + ': (' + zones[j].x + ', ' + zones[j].y + ')');
            }
            content.innerHTML = '<div style="color:#a1a1aa;font-size:13px;">' +
                '<div style="margin-bottom:8px;">With ' + rigsNeeded + ' rig' + (rigsNeeded > 1 ? 's' : '') +
                ' for ' + zones.length + ' zones, positions remain constant:</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                sp.map(function(p) {
                    return '<span style="background:#3b82f6;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;">' + p + '</span>';
                }).join('') + '</div></div>';
            return;
        }

        container.style.display = 'block';
        content.innerHTML = '<div style="margin-bottom:10px;color:#c084fc;font-size:12px;">' +
            (config.monthName || 'This Month') + ' \u2014 ' + rigsNeeded + ' rigs rotating across ' +
            zones.length + ' zones (' + rotationDays + '-day cycles)</div>' + rotationsHtml;
    }

    // =========================================================================
    // HEALTH TRAJECTORY CHART (client-side SVG re-render)
    // =========================================================================

    function renderHealthChart(newCoverageRatio, config) {
        var container = document.getElementById('gssh-health-trajectory-container');
        if (!container) return;

        var hp = config.healthProjection;
        if (!hp || !hp.without_trajectory || !hp.with_trajectory) return;

        var without = hp.without_trajectory;
        var withBase = hp.with_trajectory;
        var baseCoverage = hp.coverage_ratio || 0.2;
        var days = without.length;
        if (days === 0) return;

        // Interpolate between no-coverage and base-coverage trajectories
        var interpolated = [];
        for (var d = 0; d < days; d++) {
            var w = without[d];
            var b = withBase[d];

            // Covered zone health comes from the base "with" trajectory
            var coveredH = b.covered !== undefined ? b.covered : b.health;
            // Uncovered zone health = without supplement
            var uncoveredH = w.health;

            // Overall = weighted average by actual coverage ratio
            var overall = coveredH * newCoverageRatio + uncoveredH * (1 - newCoverageRatio);
            overall = Math.max(0, Math.min(100, overall));

            interpolated.push({
                day: d,
                health: Math.round(overall * 10) / 10,
                covered: Math.round(Math.min(100, coveredH) * 10) / 10,
                uncovered: Math.round(Math.max(0, uncoveredH) * 10) / 10
            });
        }

        // Build SVG
        var W = 900, H = 300;
        var pad = { top: 40, right: 30, bottom: 50, left: 50 };
        var cW = W - pad.left - pad.right;
        var cH = H - pad.top - pad.bottom;
        var xS = function(i) { return pad.left + (i / Math.max(1, days - 1)) * cW; };
        var yS = function(h) { return pad.top + cH - (h / 100) * cH; };

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="gssh-health-trajectory-svg">';
        svg += '<rect width="100%" height="100%" fill="#f1f5f9"/>';
        svg += '<text x="' + (W / 2) + '" y="20" text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">' +
            'Projected Turf Health Over ' + days + ' Days' +
            '<tspan fill="#9ca3af" font-size="11"> (' + Math.round(newCoverageRatio * 100) + '% coverage)</tspan></text>';

        // Threshold zones
        svg += '<rect x="' + pad.left + '" y="' + yS(100) + '" width="' + cW + '" height="' + (yS(70) - yS(100)) + '" fill="rgba(34,197,94,0.1)"/>';
        svg += '<rect x="' + pad.left + '" y="' + yS(70) + '" width="' + cW + '" height="' + (yS(40) - yS(70)) + '" fill="rgba(234,179,8,0.1)"/>';
        svg += '<rect x="' + pad.left + '" y="' + yS(40) + '" width="' + cW + '" height="' + (yS(0) - yS(40)) + '" fill="rgba(220,38,38,0.1)"/>';

        // Grid
        for (var h = 0; h <= 100; h += 25) {
            svg += '<line x1="' + pad.left + '" y1="' + yS(h) + '" x2="' + (W - pad.right) + '" y2="' + yS(h) + '" stroke="#cbd5e1" stroke-width="1"/>';
            svg += '<text x="' + (pad.left - 8) + '" y="' + (yS(h) + 4) + '" text-anchor="end" fill="#6b7280" font-size="10">' + h + '%</text>';
        }

        // Without supplement (red)
        var pts = [];
        for (var i = 0; i < days; i++) pts.push(xS(i).toFixed(1) + ',' + yS(without[i].health).toFixed(1));
        svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';

        // Partial coverage lines
        if (newCoverageRatio < 0.95 && newCoverageRatio > 0.01) {
            // Uncovered (orange dashed)
            pts = [];
            for (var j = 0; j < days; j++) pts.push(xS(j).toFixed(1) + ',' + yS(interpolated[j].uncovered).toFixed(1));
            svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#fb923c" stroke-width="2" stroke-dasharray="8,4" stroke-linecap="round"/>';
            // Covered (cyan)
            pts = [];
            for (var k = 0; k < days; k++) pts.push(xS(k).toFixed(1) + ',' + yS(interpolated[k].covered).toFixed(1));
            svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round"/>';
        }

        // Overall with supplement (green)
        pts = [];
        for (var m = 0; m < days; m++) pts.push(xS(m).toFixed(1) + ',' + yS(interpolated[m].health).toFixed(1));
        svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';

        // X-axis
        var step = Math.max(1, Math.floor(days / 7));
        for (var d2 = 0; d2 < days; d2 += step) {
            svg += '<text x="' + xS(d2).toFixed(1) + '" y="' + (H - pad.bottom + 20) + '" text-anchor="middle" fill="#6b7280" font-size="10">Day ' + d2 + '</text>';
        }
        svg += '<text x="' + (W / 2) + '" y="' + (H - 10) + '" text-anchor="middle" fill="#6b7280" font-size="11">Days</text>';
        svg += '<text x="15" y="' + (H / 2) + '" text-anchor="middle" fill="#6b7280" font-size="11" transform="rotate(-90,15,' + (H / 2) + ')">Turf Health %</text>';

        // Legend
        var ly = H - pad.bottom + 38;
        svg += '<circle cx="' + (pad.left + 10) + '" cy="' + ly + '" r="4" fill="#ef4444"/>';
        svg += '<text x="' + (pad.left + 20) + '" y="' + (ly + 4) + '" fill="#6b7280" font-size="9">Without supplemental light</text>';
        svg += '<circle cx="' + (pad.left + 190) + '" cy="' + ly + '" r="4" fill="#4ade80"/>';
        svg += '<text x="' + (pad.left + 200) + '" y="' + (ly + 4) + '" fill="#6b7280" font-size="9">With supplemental light (overall)</text>';
        if (newCoverageRatio < 0.95 && newCoverageRatio > 0.01) {
            svg += '<circle cx="' + (pad.left + 390) + '" cy="' + ly + '" r="4" fill="#06b6d4"/>';
            svg += '<text x="' + (pad.left + 400) + '" y="' + (ly + 4) + '" fill="#6b7280" font-size="9">Covered zones</text>';
            svg += '<circle cx="' + (pad.left + 490) + '" cy="' + ly + '" r="4" fill="#fb923c"/>';
            svg += '<text x="' + (pad.left + 500) + '" y="' + (ly + 4) + '" fill="#6b7280" font-size="9">Uncovered zones</text>';
        }

        svg += '</svg>';
        container.innerHTML = svg;

        // Update Est. Health metric from trajectory endpoint
        var finalDay = interpolated[interpolated.length - 1];
        var estHealthEl = document.getElementById('gssh-est-health');
        if (estHealthEl && finalDay) {
            var estH = Math.round(finalDay.health);
            estHealthEl.textContent = estH + '%';
            estHealthEl.style.color = estH >= 70 ? '#22c55e' : estH >= 40 ? '#eab308' : '#ef4444';
        }

        // Update SVG summary metrics below the placement map
        if (finalDay) {
            updateSvgMetric('gssh-svg-covered-zones', Math.round(finalDay.covered), '%');
            updateSvgSeverityLabel('gssh-svg-uncovered-zones', Math.round(finalDay.uncovered));
        }
    }

    function updateSvgMetric(id, value, unit) {
        var el = document.getElementById(id);
        if (!el) return;
        // SVG text elements use textContent, handle tspan for unit
        el.textContent = '';
        el.appendChild(document.createTextNode(value));
        if (unit) {
            var tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('font-size', '12');
            tspan.textContent = unit;
            el.appendChild(tspan);
        }
    }

    // Convert a health percentage to a severity label and update an SVG text element.
    // Scale matches class-rig-placement-visualiser.php: low health = worse outcome.
    // uncovered/without-light: lower % remaining = more critical.
    function updateSvgSeverityLabel(id, pct) {
        var el = document.getElementById(id);
        if (!el) return;
        var label, color;
        if (pct <= 10) {
            label = 'CRITICAL'; color = '#dc2626';
        } else if (pct <= 35) {
            label = 'SEVERE';   color = '#f97316';
        } else if (pct <= 65) {
            label = 'MODERATE'; color = '#eab308';
        } else if (pct <= 85) {
            label = 'LOW RISK'; color = '#84cc16';
        } else {
            label = 'STABLE';   color = '#22c55e';
        }
        el.setAttribute('font-size', '11');
        el.setAttribute('fill', color);
        el.textContent = label;
    }

    // =========================================================================
    // RIG PLACEMENT DETAILS TABLE (dynamic rebuild)
    // =========================================================================

    function rebuildRigTable(rigsForTarget, config) {
        var tbody = document.getElementById('gssh-rig-table-body');
        if (!tbody) return;

        var zones = config.zones || [];
        var html = '';

        for (var i = 0; i < Math.min(rigsForTarget, zones.length); i++) {
            var z = zones[i];
            var isDeployed = z.type === 'deployed';
            var priority = i + 1;
            var badgeColor = isDeployed ? '#1e40af' : '#d97706';
            var idColor = isDeployed ? '#9333ea' : '#d97706';
            var statusHtml;

            if (z.status === 'warning') {
                statusHtml = '<span style="color:#ef4444;">\u26A0\uFE0F -' + (z.shortfall || 0) + ' mol</span>';
            } else if (z.status === 'recommended') {
                statusHtml = '<span style="color:#d97706;">\u2795 Recommended</span>';
            } else {
                statusHtml = '<span style="color:#22c55e;">\u2713 OK</span>';
            }

            html += '<tr style="border-bottom:1px solid #e5e7eb;">' +
                '<td style="padding:8px;"><span style="display:inline-block;width:24px;height:24px;' +
                'background:' + badgeColor + ';border-radius:50%;text-align:center;line-height:24px;color:#fff;font-size:12px;">' +
                priority + '</span></td>' +
                '<td style="padding:8px;color:' + idColor + ';font-weight:bold;">' + (z.rig_id || 'RIG ' + priority) + '</td>' +
                '<td style="padding:8px;text-align:center;">(' + z.x + 'm, ' + z.y + 'm)</td>' +
                '<td style="padding:8px;text-align:center;color:#eab308;">' + (z.deficit || '\u2014') + ' mol</td>' +
                '<td style="padding:8px;text-align:center;color:#60a5fa;font-weight:bold;">' + (z.hours || '\u2014') + 'h</td>' +
                '<td style="padding:8px;text-align:center;">' + statusHtml + '</td>' +
                '</tr>';
        }

        tbody.innerHTML = html;
    }

    // =========================================================================
    // MAIN UPDATE
    // =========================================================================

    window.gsshUpdateCoverage = function(targetPercent) {
        targetPercent = parseInt(targetPercent);

        if (!window.gsshSliderConfig) {
            var configEl = document.getElementById('gssh-slider-config');
            if (!configEl) { console.warn('[GilbaSlider] Config element not found'); return; }

            var zones = [];
            try { zones = JSON.parse(configEl.dataset.zones || '[]'); } catch(e) {}
            var healthProjection = null;
            try { healthProjection = JSON.parse(configEl.dataset.healthProjection || 'null'); } catch(e) {}

            window.gsshSliderConfig = {
                deficitArea: parseInt(configEl.dataset.deficitArea) || 7000,
                rigCoverage: parseInt(configEl.dataset.rigCoverage) || 460,
                currentRigs: parseInt(configEl.dataset.currentRigs) || 2,
                ghostRigs: parseInt(configEl.dataset.ghostRigs) || 8,
                zones: zones,
                monthName: configEl.dataset.monthName || 'This Month',
                rotationDays: parseInt(configEl.dataset.rotationDays) || 5,
                healthProjection: healthProjection,
                supplementDli: parseFloat(configEl.dataset.supplementDli) || 14.7
            };
            console.log('[GilbaSlider] Config loaded:', window.gsshSliderConfig);
        }

        var config = window.gsshSliderConfig;
        var totalAvailableRigs = config.currentRigs + config.ghostRigs;
        var targetArea = config.deficitArea * (targetPercent / 100);
        var rigsForTarget = Math.ceil(targetArea / config.rigCoverage);
        var newCoverageRatio = Math.min(1, targetPercent / 100);

        // 1. Metrics
        var coverageValue = document.getElementById('gssh-coverage-value');
        var rigsNeeded = document.getElementById('gssh-rigs-needed');
        var areaCovered = document.getElementById('gssh-area-covered');
        if (coverageValue) coverageValue.textContent = targetPercent + '%';
        if (rigsNeeded) {
            rigsNeeded.textContent = rigsForTarget;
            rigsNeeded.style.color = rigsForTarget <= config.currentRigs ? '#22c55e' :
                rigsForTarget <= totalAvailableRigs ? '#eab308' : '#ef4444';
        }
        if (areaCovered) areaCovered.textContent = (rigsForTarget * config.rigCoverage).toLocaleString() + 'm\u00B2';

        // 2. SVG rigs
        var rigGroups = document.querySelectorAll('.rig-group');
        var ghostGroups = document.querySelectorAll('.ghost-rig-group');
        var deployedToShow = Math.min(rigsForTarget, config.currentRigs);
        var ghostToShow = Math.max(0, rigsForTarget - config.currentRigs);

        console.log('[GilbaSlider] SVG: ' + rigGroups.length + ' deployed, ' + ghostGroups.length +
            ' ghost. Need: ' + deployedToShow + ' + ' + ghostToShow);

        for (var i = 0; i < rigGroups.length; i++) {
            rigGroups[i].style.opacity = (i < deployedToShow) ? '1' : '0.3';
        }
        for (var j = 0; j < ghostGroups.length; j++) {
            ghostGroups[j].style.opacity = (j < ghostToShow) ? '0.7' : '0.2';
        }

        // 3. Rotation
        generateRotationSchedule(rigsForTarget, config);

        // 4. Health chart
        renderHealthChart(newCoverageRatio, config);

        // 5. Rig placement details table
        rebuildRigTable(rigsForTarget, config);

        // 6. SVG summary metrics below the placement map
        updateSvgMetric('gssh-svg-rigs-required', rigsForTarget, '');
        updateSvgMetric('gssh-svg-coverage', Math.round(newCoverageRatio * 100), '%');

        console.log('[GilbaSlider] Updated: ' + targetPercent + '% coverage, ' + rigsForTarget + ' rigs');
    };

    window.gsshSetCoverage = function(percent) {
        var slider = document.getElementById('gssh-coverage-slider');
        if (slider && window.gsshUpdateCoverage) {
            slider.value = percent;
            window.gsshUpdateCoverage(percent);
        }
    };

    // Watch for AJAX-loaded slider
    var observer = new MutationObserver(function() {
        var configEl = document.getElementById('gssh-slider-config');
        var slider = document.getElementById('gssh-coverage-slider');
        if (configEl && slider && !slider.dataset.initialized) {
            console.log('[GilbaSlider] Slider detected in DOM, initializing...');
            window.gsshSliderConfig = null;
            slider.dataset.initialized = 'true';
            window.gsshUpdateCoverage(slider.value);
            console.log('[GilbaSlider] Slider initialized successfully');
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[GilbaSlider] v2.0.0 ready');
})();
