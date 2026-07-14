/* Disease Risk Analysis Page
 * Layout: alert bar → master-detail split → forecast chart → application window
 */
(function (global) {
    'use strict';

    // ── Styles ───────────────────────────────────────────────────────────────

    var style = document.createElement('style');
    style.textContent = [
        /* master-detail split */
        '.dr-split{display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start}',
        '@media(max-width:800px){.dr-split{grid-template-columns:1fr}}',
        /* disease list buttons */
        '.dr-disease-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 14px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid var(--border,#d8e0dc);background:#fff;text-align:left;font:inherit;transition:border-color .15s,background .15s}',
        '.dr-disease-btn:hover{border-color:#9ca3af;background:#f9fafb}',
        '.dr-disease-btn.active{border-color:var(--activeBorder,#236b4a);background:var(--activeBg,#f0fdf4)}',
        /* driver bars */
        '.dr-driver-bar{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin-top:4px}',
        '.dr-driver-fill{height:100%;border-radius:3px;transition:width .3s}',
        /* alert banner */
        '.dr-alert-bar{display:flex;align-items:center;gap:12px;padding:14px 20px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;color:#7f1d1d}',
        '.dr-alert-name{font-weight:700;font-size:14px;flex:1}',
        '.dr-alert-action{font-size:12px;opacity:.8}',
        /* validation badges */
        '.dr-val-badge{display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.03em;flex-shrink:0;margin-left:4px}',
        '.dr-val-badge.validated{background:#dcfce7;color:#15803d;border:1px solid #86efac}',
        '.dr-val-badge.beta{background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd}',
        /* forecast chart */
        '.dr-forecast-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;padding:0 4px}',
        '.dr-forecast-legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#374151}',
        '.dr-forecast-legend-line{width:18px;height:3px;border-radius:2px;flex-shrink:0}',
        '.dr-forecast-peak{font-size:12px;color:#5b6a65;margin-top:8px}',
        /* forecast tooltip */
        '.dr-chart-wrap{position:relative}',
        '.dr-chart-tooltip{position:absolute;background:#fff;color:#17231f;border-radius:8px;padding:9px 13px;font-size:12px;white-space:nowrap;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.12);border:1px solid #d8e0dc;z-index:60;display:none;line-height:1.5}',
        '.dr-chart-tooltip-day{font-weight:700;font-size:11px;color:#5b6a65;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em}',
        '.dr-chart-tooltip-row{display:flex;align-items:center;gap:7px;margin-bottom:2px}',
        '.dr-chart-tooltip-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
        '.dr-chart-tooltip-name{flex:1;color:#374151}',
        '.dr-chart-tooltip-val{font-weight:700;color:#17231f}',
        /* application window */
        '.dr-app-status{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:16px}',
        '.dr-app-status.ok{background:#f0fdf4;color:#15803d;border:1px solid #86efac}',
        '.dr-app-status.warn{background:#fff7ed;color:#c2410c;border:1px solid #fdba74}',
        '.dr-app-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
        '@media(max-width:600px){.dr-app-grid{grid-template-columns:1fr 1fr}}',
        '.dr-app-item{background:#f5f7f6;border:1px solid #d8e0dc;border-radius:8px;padding:12px 14px}',
        '.dr-app-item-label{font-size:11px;font-weight:700;color:#5b6a65;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}',
        '.dr-app-item-value{font-size:16px;font-weight:700;color:#17231f}',
        '.dr-app-item-note{font-size:11px;color:#5b6a65;margin-top:2px}',
    ].join('');
    document.head.appendChild(style);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function capitalize(s) {
        if (!s) return '';
        return String(s).charAt(0).toUpperCase() + String(s).slice(1);
    }

    function driverLabel(key) {
        return capitalize(
            key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
        );
    }

    var RISK_COLORS = {
        severe:   { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', badge: '#ef4444', label: 'Severe' },
        high:     { bg: '#fff7ed', border: '#fdba74', text: '#7c2d12', badge: '#f97316', label: 'High' },
        moderate: { bg: '#fffbeb', border: '#fde68a', text: '#78350f', badge: '#eab308', label: 'Moderate' },
        low:      { bg: '#f0fdf4', border: '#86efac', text: '#14532d', badge: '#22c55e', label: 'Low' },
        none:     { bg: '#f5f7f6', border: '#d8e0dc', text: '#5b6a65', badge: '#9ca3af', label: 'None' },
    };

    function riskColor(level) {
        return RISK_COLORS[(level || '').toLowerCase()] || RISK_COLORS.none;
    }

    function riskBadge(level) {
        var c = riskColor(level);
        return '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;' +
            'background:' + c.badge + '22;color:' + c.badge + ';border:1px solid ' + c.badge + '44">' +
            esc(c.label) + '</span>';
    }

    function trajectoryArrow(trend) {
        if (!trend) return '';
        var t = String(trend).toLowerCase();
        if (t === 'worsening' || t === 'rising' || t === 'increasing')
            return '<span style="color:#ef4444;font-weight:700">↑ worsening</span>';
        if (t === 'improving' || t === 'decreasing' || t === 'falling')
            return '<span style="color:#22c55e;font-weight:700">↓ improving</span>';
        return '<span style="color:#6b7280">→ stable</span>';
    }

    function valBadge(status) {
        if (!status) return '';
        var s = String(status).toLowerCase();
        if (s === 'validated' || s === 'verified')
            return '<span class="dr-val-badge validated">✓ Validated</span>';
        if (s === 'beta')
            return '<span class="dr-val-badge beta">Beta</span>';
        return '';
    }

    // ── Glossary & info popovers ──────────────────────────────────────────────

    var DR_GLOSSARY = {
        'dr-overall': {
            title: 'Overall Disease Risk Score',
            body:  'A 0–100% index representing combined pressure from all monitored fungal and bacterial diseases. Calculated from current and forecast temperature, humidity, leaf wetness duration, dew periods, and night temperatures.\n\nLow (<30%): No action required — scout regularly.\nModerate (30–60%): Conditions developing — prepare preventive products.\nHigh (60–80%): Apply preventive fungicide within 48–72 hours.\nSevere (>80%): Curative action required — conditions are critical.'
        },
        'dr-drivers': {
            title: 'Environmental Drivers',
            body:  'The environmental conditions contributing to disease pressure for this specific pathogen. Each driver shows its current value and its percentage contribution to the overall risk score for that disease.\n\nHigh-contribution drivers are the key levers — improving them (e.g. reducing leaf wetness through timing of irrigation, improving air circulation) will reduce disease risk most effectively.'
        },
        'dr-leaf-wetness': {
            title: 'Leaf Wetness',
            body:  'The number of consecutive hours the leaf surface remains wet (dew, rain, irrigation). Most fungal pathogens require a minimum continuous wet period to germinate and infect — typically 6–12 hours for dollar spot, 4–8 hours for brown patch.\n\nReducing leaf wetness duration through early-morning irrigation, improved drainage, and air movement is one of the most effective cultural controls.'
        },
        'dr-humidity': {
            title: 'Relative Humidity',
            body:  'Atmospheric moisture content as a percentage. High relative humidity (>85%) promotes fungal spore germination and mycelial growth. Combined with warm temperatures and extended leaf wetness, sustained high humidity is the primary driver of most turfgrass diseases.'
        },
        'dr-temperature': {
            title: 'Temperature',
            body:  'Air temperature at the time of assessment. Each pathogen has an optimal infection temperature range — dollar spot favours 15–25°C, brown patch 21–30°C, pythium 30–35°C. Temperatures outside a pathogen\'s range reduce risk even when other conditions are favourable.'
        },
        'dr-night-temp': {
            title: 'Night Temperature',
            body:  'Minimum overnight air temperature. Warm nights (above 15°C) allow fungal pathogens to remain active, preventing natural die-back that would otherwise occur during cooler periods. Sustained warm nights are a key indicator for diseases like dollar spot and brown patch.'
        },
        'dr-recommendation': {
            title: 'Recommended Action',
            body:  'Monitor: Risk is low — scout regularly but no spray action required.\n\nPreventive: Conditions are developing — apply a preventive fungicide before symptoms appear. This is the most cost-effective intervention window.\n\nCurative: Disease is present or imminent — apply a curative product immediately. Effectiveness drops sharply if delayed.\n\nProducts listed are registered for Australian conditions. Rotate modes of action (FRAC codes) to prevent resistance.'
        },
        'dr-forecast': {
            title: '7–14 Day Risk Forecast',
            body:  'Projected disease pressure over the coming days based on weather forecast data. Lines show the top disease threats — higher values indicate increasing risk.\n\nUse this chart to plan fungicide timing: apply preventive products before risk peaks, not after. A 2–3 day lead time before a forecast peak is the optimal intervention window.'
        },
        'dr-app-window': {
            title: 'Spray Application Window',
            body:  'Ideal conditions for fungicide application to maximise efficacy and minimise drift or wash-off risk.\n\nTemperature: 10–30°C. Very cold or very hot conditions reduce uptake and increase evaporation.\n\nRain-free period: 4+ hours after application. Rain before the product dries washes it off the leaf surface.\n\nWind speed: below 15 km/h. Higher wind causes drift, reducing coverage and potentially impacting neighbouring areas.'
        },
    };

    function infoBtn(key) {
        return '<button class="db-info-icon" data-info="' + key + '" tabindex="0" aria-label="Learn more">i</button>';
    }

    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, DR_GLOSSARY);

    function initInfoPopovers() {
        var popover  = document.getElementById('db-info-popover');
        if (!popover || popover._gaipReady) return;
        popover._gaipReady = true;
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');

        var currentAnchor = null;

        function showPopover(anchor) {
            var entry = (global.GAIP_GLOSSARY || DR_GLOSSARY)[anchor.dataset.info];
            if (!entry) return;
            popTitle.textContent = entry.title;
            popBody.textContent  = entry.body;
            popover.style.visibility = 'hidden';
            popover.style.display    = 'block';
            var rect = anchor.getBoundingClientRect();
            var pw = popover.offsetWidth, ph = popover.offsetHeight;
            var viewW = window.innerWidth, viewH = window.innerHeight;
            var left = Math.round(rect.left + rect.width / 2 - pw / 2);
            left = Math.max(8, Math.min(left, viewW - pw - 8));
            var top, flipped = false;
            if (rect.bottom + 10 + ph > viewH - 8) { top = Math.round(rect.top - 10 - ph); flipped = true; }
            else { top = Math.round(rect.bottom + 10); }
            popover.style.left = left + 'px';
            popover.style.top  = top  + 'px';
            popover.style.visibility = '';
            if (popArrow) {
                var arrowLeft = Math.round(rect.left + rect.width / 2 - left - 5);
                arrowLeft = Math.max(12, Math.min(arrowLeft, pw - 22));
                popArrow.style.left      = arrowLeft + 'px';
                popArrow.style.top       = flipped ? ''     : '-6px';
                popArrow.style.bottom    = flipped ? '-6px' : '';
                popArrow.style.transform = flipped ? 'rotate(225deg)' : 'rotate(45deg)';
            }
            currentAnchor = anchor;
        }

        function hidePopover() { popover.style.display = 'none'; currentAnchor = null; }

        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) { e.stopPropagation(); if (currentAnchor === icon) hidePopover(); else showPopover(icon); return; }
            if (!popover.contains(e.target)) hidePopover();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePopover(); });
        if (popClose) popClose.addEventListener('click', function (e) { e.stopPropagation(); hidePopover(); });
    }

    // ── Data extraction ───────────────────────────────────────────────────────

    function getDiseaseData() {
        var data = global.GAIP_DASHBOARD_DATA;
        if (!data) return null;
        var computed   = data.computed || {};
        var diseaseObj = computed.disease || null;
        if (!diseaseObj) return null;
        var rawScore = diseaseObj.overallScore != null ? diseaseObj.overallScore : null;
        var rawLevel = (diseaseObj.overallRisk || diseaseObj.riskLevel || '').toLowerCase() || null;
        var _knownLevels = { severe: 1, high: 1, moderate: 1, low: 1 };
        if ((!rawLevel || rawLevel === 'none' || !_knownLevels[rawLevel]) && rawScore != null && rawScore > 0) {
            rawLevel = rawScore >= 70 ? 'high' : rawScore >= 50 ? 'moderate' : 'low';
        }
        return {
            riskLevel:         rawLevel,
            overallScore:      rawScore,
            trajectory:        diseaseObj.trajectory   || null,
            diseases:          Array.isArray(diseaseObj.diseases)   ? diseaseObj.diseases   : [],
            topThreats:        Array.isArray(diseaseObj.topThreats) ? diseaseObj.topThreats : [],
            environment:       diseaseObj.environment  || computed.climate || {},
            forecast:          Array.isArray(diseaseObj.forecast)   ? diseaseObj.forecast   : [],
            applicationWindow: diseaseObj.applicationWindow || computed.applicationWindow || null,
        };
    }

    function filterDiseases(diseases) {
        return diseases.filter(function (d) {
            // diseases[] uses riskLevel; topThreats[] uses level
            var r     = ((d.riskLevel || d.level) || '').toLowerCase();
            // diseases[] uses adjustedRisk/riskScore; topThreats[] uses risk
            var score = d.adjustedRisk != null ? d.adjustedRisk
                      : (d.riskScore   != null ? d.riskScore
                      : (d.risk        != null ? d.risk : 0));
            // inWindow alone is not enough to show a disease: require score > 0
            // to avoid showing 0% diseases (e.g. Spring Dead Spot on bentgrass)
            // that have a stale treatment window in the cache
            return r !== 'none' && r !== '' && score > 0;
        });
    }

    // ── Alert banner ──────────────────────────────────────────────────────────

    function renderAlertBar(diseases) {
        var severe = diseases.filter(function (d) {
            return (d.riskLevel || '').toLowerCase() === 'severe';
        });
        if (severe.length === 0) return '';

        var names = severe.map(function (d) {
            return d.displayName || d.disease || d.name || 'Unknown';
        }).join(', ');
        var score = severe[0].adjustedRisk != null ? Math.round(severe[0].adjustedRisk) : null;

        return '<div class="dr-alert-bar">' +
            '<span style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:#dc2626;display:inline-block;margin-top:2px"></span>' +
            '<span class="dr-alert-name">' + esc(names) + ' — Severe risk' +
                (score != null ? ' (' + score + '%)' : '') + '</span>' +
            '<span class="dr-alert-action">Action required</span>' +
            '</div>';
    }

    // ── Forecast Peak KPI card ────────────────────────────────────────────────
    // Injected into gl-kpi-grid when forecast peak exceeds current risk by ≥20 points.

    function renderForecastAlertCard(forecastSummary, currentScore) {
        if (!forecastSummary || forecastSummary.peakRisk == null) return '';
        var peak    = Math.round(forecastSummary.peakRisk);
        var current = currentScore != null ? Math.round(currentScore) : 0;
        if (peak <= current + 20) return '';

        var name     = forecastSummary.topThreat || 'Disease';
        var peakDay  = forecastSummary.peakDay;   // 0-indexed
        var color    = peak >= 85 ? '#dc2626' : '#d97706';
        var rgb      = peak >= 85 ? '220,38,38' : '217,119,6';

        var dayLabel = peakDay === 0 ? 'Today'
                     : peakDay === 1 ? 'Tomorrow'
                     : 'In ' + (peakDay + 1) + ' days';
        var badgeBg  = peak >= 85 ? '#fef2f2' : '#fff7ed';
        var badgeCol = peak >= 85 ? '#dc2626' : '#d97706';
        var badgeBdr = peak >= 85 ? '#fca5a5' : '#fcd34d';

        var dayBadge = '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;' +
            'background:' + badgeBg + ';color:' + badgeCol + ';border:1px solid ' + badgeBdr + '">' + dayLabel + '</span>';

        return '<div class="gl-kpi-card" style="background:rgba(' + rgb + ',0.07);border-color:rgba(' + rgb + ',0.25);border-left-color:' + color + '">' +
            '<div class="gl-kpi-label">Forecast Peak</div>' +
            '<div class="gl-kpi-value" style="color:' + color + '">' + peak + '%</div>' +
            '<div class="gl-kpi-unit">' + esc(name) + '</div>' +
            '<div>' + dayBadge + '</div>' +
            '</div>';
    }

    // ── Render: left panel ────────────────────────────────────────────────────

    function renderLeft(d, selected) {
        var score    = d.overallScore != null ? Math.round(d.overallScore) : null;
        var _lvl     = (d.riskLevel || 'none').toLowerCase();
        if ((_lvl === 'none' || !_lvl) && score != null && score > 0) {
            _lvl = score >= 70 ? 'high' : score >= 50 ? 'moderate' : 'low';
        }
        var c        = riskColor(_lvl);
        var diseases = filterDiseases(d.diseases.length ? d.diseases : d.topThreats);
        var html     = '';

        // Overall risk hero
        html += '<div class="gl-block" style="background:' + c.bg + ';border-color:' + c.border + ';margin-bottom:16px">';
        html += '  <div class="gl-block-body">';
        html += '    <div class="gl-section-label" style="color:' + c.text + ';margin-top:0">Overall Disease Risk ' + infoBtn('dr-overall') + '</div>';
        html += '    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
        html += '      <span style="font-size:36px;font-weight:800;color:' + c.badge + ';line-height:1">' +
                        (score != null ? score + '%' : (capitalize(_lvl) || '—')) + '</span>';
        html += '      ' + riskBadge(_lvl);
        html += '    </div>';
        if (d.trajectory) {
            html += '    <div style="font-size:12px">' + trajectoryArrow(d.trajectory) + '</div>';
        }
        html += '  </div>';
        html += '</div>';

        // Disease list
        if (diseases.length === 0) {
            html += '<div style="padding:20px;text-align:center;color:#5b6a65;font-size:13px">No active disease threats detected.</div>';
        } else {
            html += '<div class="gl-section-label">Active Threats</div>';
            diseases.forEach(function (disease, idx) {
                var name    = disease.displayName || disease.disease || disease.name || 'Unknown';
                var level   = disease.riskLevel || disease.level || '';
                var dscore  = disease.adjustedRisk != null ? Math.round(disease.adjustedRisk)
                            : (disease.riskScore   != null ? Math.round(disease.riskScore)
                            : (disease.risk        != null ? Math.round(disease.risk) : null));
                var dc         = riskColor(level);
                var isSelected = selected === idx;
                var vbadge     = valBadge(disease.validationStatus || disease.validation);

                html += '<button onclick="drSelectDisease(' + idx + ')" class="dr-disease-btn' +
                    (isSelected ? ' active' : '') + '"' +
                    (isSelected ? ' style="border-color:' + dc.badge + ';background:' + dc.bg + '"' : '') + '>';
                html += '  <div style="display:flex;align-items:center;gap:8px;min-width:0">';
                html += '    <span style="width:8px;height:8px;border-radius:50%;background:' + dc.badge + ';flex-shrink:0"></span>';
                html += '    <span style="font-size:13px;font-weight:600;color:#17231f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span>';
                if (vbadge) html += vbadge;
                html += '  </div>';
                html += '  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">';
                if (dscore != null) html += '<span style="font-size:13px;font-weight:700;color:' + dc.badge + '">' + dscore + '%</span>';
                html += '  </div>';
                html += '</button>';
            });
        }

        return html;
    }

    // ── Render: right panel ───────────────────────────────────────────────────

    var ACTION_REC_CLASS = { curative: 'critical', preventive: 'week', prepare: 'week', monitor: 'monitor' };
    var ACTION_ICON      = { curative: '⚠', preventive: '◷', prepare: '◷', monitor: '✓' };

    function renderRight(disease) {
        if (!disease) {
            return '<div class="gl-block"><div class="gl-block-body" style="padding:60px 20px;text-align:center;color:#9ca3af;font-size:13px">' +
                   'Select a disease from the list to see details.</div></div>';
        }

        var name  = disease.displayName || disease.disease || disease.name || 'Unknown';
        var level = disease.riskLevel || disease.level || '';
        var score = disease.adjustedRisk != null ? Math.round(disease.adjustedRisk)
                  : (disease.riskScore   != null ? Math.round(disease.riskScore)
                  : (disease.risk        != null ? Math.round(disease.risk) : null));
        var dc    = riskColor(level);
        var vbadge = valBadge(disease.validationStatus || disease.validation);
        var html  = '';

        html += '<div class="gl-block">';
        html += '  <div class="gl-block-header">';
        html += '    <div class="gl-block-accent"></div>';
        html += '    <div class="gl-block-title">' + esc(name) + '</div>';
        if (vbadge) html += vbadge;
        if (disease.severityNote || disease.diseasePhase) {
            html += '    <span style="font-size:12px;color:#5b6a65">' +
                    esc(disease.severityNote || driverLabel(disease.diseasePhase || '')) + '</span>';
        }
        html += '    <div class="gl-block-sub" style="display:flex;align-items:center;gap:8px">';
        if (score != null) html += '<span style="font-size:22px;font-weight:800;color:' + dc.badge + ';line-height:1">' + score + '%</span>';
        html += '      ' + riskBadge(level);
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="gl-block-body">';

        // Environmental Drivers
        var drivers = disease.drivers;
        if (drivers && typeof drivers === 'object' && Object.keys(drivers).length > 0) {
            html += '<div class="gl-section-label">Environmental Drivers ' + infoBtn('dr-drivers') + '</div>';
            var suppressedNotes1 = [];
            Object.keys(drivers).forEach(function (key) {
                var dv      = drivers[key];
                if (dv.suppressed) {
                    if (dv.suppressedNote) suppressedNotes1.push(dv.suppressedNote);
                    return;
                }
                var contrib = dv.contribution != null ? Math.round(dv.contribution) : null;
                var val     = dv.value != null ? dv.value : null;
                var valStr  = val != null ? (typeof val === 'number' ? Math.round(val) : String(val)) : null;
                var label   = driverLabel(key);
                if (contrib == null && val == null) return;
                var barColor = contrib >= 70 ? '#ef4444' : contrib >= 40 ? '#f97316' : '#eab308';
                html += '<div style="margin-bottom:12px">';
                html += '  <div style="display:flex;justify-content:space-between;margin-bottom:4px">';
                html += '    <span style="font-size:12px;color:#374151">' + esc(label) + '</span>';
                html += '    <span style="font-size:12px;font-weight:600;color:#17231f">';
                if (valStr != null) html += esc(valStr);
                if (contrib != null) html += (valStr != null ? ' · ' : '') + contrib + '% contribution';
                html += '    </span>';
                html += '  </div>';
                if (contrib != null) {
                    html += '  <div class="dr-driver-bar"><div class="dr-driver-fill" style="width:' +
                            Math.min(contrib, 100) + '%;background:' + barColor + '"></div></div>';
                }
                html += '</div>';
            });
            if (suppressedNotes1.length) {
                html += '<div style="font-size:11px;color:#6b7280;margin-bottom:8px">' + suppressedNotes1.map(esc).join(' · ') + '</div>';
            }
            html += '<hr class="gl-section-sep">';
        }

        // Recommendation
        var rec = disease.recommendation;
        if (rec) {
            var action   = (rec.action || '').toLowerCase();
            var headline = rec.headline || rec.text || '';
            var timing   = rec.timing  || '';
            var products = Array.isArray(rec.products) ? rec.products.filter(function(p, i, a) { return a.indexOf(p) === i; }) : [];
            var recClass = ACTION_REC_CLASS[action] || 'monitor';
            var recIcon  = ACTION_ICON[action]  || '✓';

            html += '<div class="gl-section-label">Recommendation ' + infoBtn('dr-recommendation') + '</div>';
            html += '<div class="gl-rec ' + recClass + '">';
            html += '  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:700">';
            html += '    <span>' + recIcon + ' ' + capitalize(rec.action || 'Monitor') + '</span>';
            if (timing) html += '    <span style="font-weight:400;opacity:.75">· ' + esc(timing) + '</span>';
            html += '  </div>';
            if (headline) html += '<div style="line-height:1.5' + (products.length ? ';margin-bottom:8px' : '') + '">' + esc(headline) + '</div>';
            if (products.length) {
                html += '<div style="font-size:12px;opacity:.8"><strong>Products:</strong> ' + esc(products.join(', ')) + '</div>';
            }
            html += '</div>';
        }

        if (disease.urgencyNote) {
            html += '<div style="font-size:12px;color:#6b7280;font-style:italic;padding:12px 0 0;border-top:1px solid #e5e7eb;margin-top:12px">' +
                    esc(disease.urgencyNote) + '</div>';
        }

        html += '  </div></div>';
        return html;
    }

    // ── Render: forecast chart ────────────────────────────────────────────────

    var CHART_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#f97316', '#7c3aed', '#0891b2', '#ca8a04'];

    function buildForecastSeries(diseases) {
        var series = [];

        // Try per-disease forecast arrays first
        var hasDiseaseForecasts = diseases.some(function (d) {
            return Array.isArray(d.forecast) && d.forecast.length > 1;
        });

        if (hasDiseaseForecasts) {
            diseases.slice(0, 5).forEach(function (disease, i) {
                if (!Array.isArray(disease.forecast) || disease.forecast.length < 2) return;
                series.push({
                    name:   disease.displayName || disease.disease || disease.name || 'Disease',
                    color:  CHART_COLORS[i % CHART_COLORS.length],
                    values: disease.forecast.map(function (v) { return Math.min(100, Math.max(0, Number(v) || 0)); }),
                });
            });
            return series;
        }

        // Note: the global d.forecast array from DB is intentionally skipped here.
        // It may contain stale data from a previous analysis run (e.g. diseases that
        // are no longer active after a re-run). Skipping it forces renderForecastChart
        // to return '' (numPoints < 2 from the synthesis fallback below), which inserts
        // the dr-forecast-wrap placeholder and causes initForecastChart to call
        // generateForecast dynamically with fresh OM weather data.

        // Fallback: synthesise from current scores (flat line, at least show something)
        diseases.slice(0, 4).forEach(function (disease, i) {
            var cur = disease.adjustedRisk != null ? disease.adjustedRisk : (disease.riskScore || 0);
            series.push({
                name:   disease.displayName || disease.disease || disease.name || 'Disease',
                color:  CHART_COLORS[i % CHART_COLORS.length],
                values: [cur],
            });
        });
        return series;
    }

    function renderForecastChart(d) {
        var diseases   = filterDiseases(d.diseases.length ? d.diseases : d.topThreats);
        if (diseases.length === 0) return '';

        var series     = buildForecastSeries(diseases);
        if (series.length === 0) return '';

        var numPoints  = series[0].values.length;
        if (numPoints < 2) return '';   // nothing meaningful to chart

        // SVG geometry
        var VW = 600, VH = 180;
        var PL = 38, PR = 16, PT = 14, PB = 36;
        var CW = VW - PL - PR;
        var CH = VH - PT - PB;

        function xPos(i)   { return PL + (numPoints === 1 ? CW / 2 : i * CW / (numPoints - 1)); }
        function yPos(val) { return PT + CH - (val / 100) * CH; }

        // Grid lines & labels
        var gridLines = '';
        [25, 50, 75].forEach(function (pct) {
            var y = yPos(pct);
            gridLines += '<line x1="' + PL + '" y1="' + y + '" x2="' + (PL + CW) + '" y2="' + y +
                '" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,3"/>';
            gridLines += '<text x="' + (PL - 4) + '" y="' + (y + 4) + '" text-anchor="end" ' +
                'font-size="10" fill="#9ca3af">' + pct + '%</text>';
        });

        // X-axis labels
        var xLabels = '';
        var labelEvery = Math.ceil(numPoints / 7);
        for (var i = 0; i < numPoints; i++) {
            if (i % labelEvery !== 0 && i !== numPoints - 1) continue;
            var lbl = d.forecast[i] ? (d.forecast[i].label || (i === 0 ? 'Today' : '+' + i + 'd')) : (i === 0 ? 'Today' : '+' + i + 'd');
            xLabels += '<text x="' + xPos(i) + '" y="' + (VH - 4) + '" text-anchor="middle" ' +
                'font-size="10" fill="#9ca3af">' + esc(lbl) + '</text>';
        }

        // Series lines + dots
        var seriesSvg = '';
        series.forEach(function (s) {
            var pts = s.values.map(function (v, i) { return xPos(i) + ',' + yPos(v); }).join(' ');
            seriesSvg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color +
                '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
            // Highlight peak dot
            var peakVal = Math.max.apply(null, s.values);
            var peakIdx = s.values.indexOf(peakVal);
            if (peakVal > 0) {
                seriesSvg += '<circle cx="' + xPos(peakIdx) + '" cy="' + yPos(peakVal) +
                    '" r="3.5" fill="' + s.color + '"/>';
            }
        });

        // Peak annotation text
        var allVals = series.map(function (s) {
            var peak = Math.max.apply(null, s.values);
            var idx  = s.values.indexOf(peak);
            return { name: s.name, peak: peak, day: idx };
        }).sort(function (a, b) { return b.peak - a.peak; });
        var topPeak = allVals[0];
        var peakNote = topPeak
            ? 'Peak: ' + topPeak.name + ' ' + Math.round(topPeak.peak) + '%' +
              (topPeak.day === 0 ? ' today' : ' on day ' + topPeak.day)
            : '';

        // Legend
        var legend = '<div class="dr-forecast-legend">';
        series.forEach(function (s) {
            legend += '<div class="dr-forecast-legend-item">' +
                '<span class="dr-forecast-legend-line" style="background:' + s.color + '"></span>' +
                esc(s.name) + '</div>';
        });
        legend += '</div>';
        if (peakNote) legend += '<div class="dr-forecast-peak">' + esc(peakNote) + '</div>';

        var svg = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" style="width:100%;height:auto;display:block" aria-hidden="true">' +
            gridLines + xLabels + seriesSvg + '</svg>';

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '  <div class="gl-block-accent"></div>' +
            '  <div class="gl-block-title">Disease Risk Forecast</div>' +
            '  <span class="gl-block-sub">7–14 day projection</span>' +
            '  ' + infoBtn('dr-forecast') +
            '</div>' +
            '<div class="gl-block-body">' + svg + legend + '</div>' +
            '</div>';
    }

    // ── Render: application window ────────────────────────────────────────────

    // climate stores temperature as {current, min, max, mean} object — normalise to number
    function numVal(v) {
        if (v == null) return null;
        if (typeof v === 'number') return v;
        if (typeof v === 'object') return v.current != null ? v.current : (v.mean != null ? v.mean : null);
        return null;
    }

    function renderAppWindow(d) {
        var aw  = d.applicationWindow;
        var env = d.environment || {};

        var tempMin  = (aw && aw.tempMin     != null) ? aw.tempMin     : 10;
        var tempMax  = (aw && aw.tempMax     != null) ? aw.tempMax     : 30;
        var rainFree = (aw && aw.rainFreeHours != null) ? aw.rainFreeHours : (aw && aw.rainFreePeriod != null ? aw.rainFreePeriod : 4);
        var windMax  = (aw && aw.windMaxKph  != null) ? aw.windMaxKph  : (aw && aw.windMax != null ? aw.windMax : 15);
        var isOptimal     = aw && aw.currentlyOptimal != null ? aw.currentlyOptimal : null;
        var nextWindowLabel = (aw && (aw.nextWindowLabel || aw.nextWindow)) || null;

        // env.temperature may be an object {current, min, max, mean}
        // env.wind may be an object {mean, max}
        var curTemp = numVal(env.temperature);
        var curWind = numVal(env.wind) != null ? numVal(env.wind) : numVal(env.windSpeed);
        var precipProb = env.precipProbability != null ? env.precipProbability
                       : (env.precipProb       != null ? env.precipProb : null);

        if (isOptimal === null && curTemp != null) {
            isOptimal = curTemp >= tempMin && curTemp <= tempMax &&
                        (precipProb == null || precipProb <= 50) &&
                        (curWind    == null || curWind < windMax);
        }

        var statusHtml = '';
        if (isOptimal === true) {
            statusHtml = '<div class="dr-app-status ok">✓ Conditions currently suitable for application</div>';
        } else if (isOptimal === false) {
            statusHtml = '<div class="dr-app-status warn">⚠ Conditions not ideal — check forecast' +
                (nextWindowLabel ? ': next window ' + esc(nextWindowLabel) : '') + '</div>';
        }

        var curTempStr = curTemp != null ? Math.round(curTemp) + '°C now' : null;
        var curWindStr = curWind != null ? Math.round(curWind) + ' km/h now' : null;

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '  <div class="gl-block-accent"></div>' +
            '  <div class="gl-block-title">Spray Application Window</div>' +
            '  ' + infoBtn('dr-app-window') +
            '</div>' +
            '<div class="gl-block-body">' +
            statusHtml +
            '<div class="dr-app-grid">' +
            appItem('Temperature', tempMin + '–' + tempMax + '°C', curTempStr) +
            appItem('Rain-free period', rainFree + '+ hours after spray', null) +
            appItem('Wind speed', '&lt;' + windMax + ' km/h', curWindStr) +
            '</div>' +
            '</div></div>';
    }

    function appItem(label, value, note) {
        return '<div class="dr-app-item">' +
            '<div class="dr-app-item-label">' + label + '</div>' +
            '<div class="dr-app-item-value">' + value + '</div>' +
            (note ? '<div class="dr-app-item-note">' + esc(note) + '</div>' : '') +
            '</div>';
    }

    // ── Render: fungicide residual protection block ──────────────────────────

    function renderResidualBlock() {
        var protection  = global._sprayResidualProtection;
        var fracWarnings = global._sprayFRACWarnings;
        var hasData = (protection && protection.productName) || (fracWarnings && fracWarnings.length > 0);

        var fracHtml = '';
        if (fracWarnings && fracWarnings.length > 0) {
            fracHtml = fracWarnings.map(function(w) {
                return '<div style="padding:8px 12px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px;color:#92400e;margin-bottom:6px;">' + esc(w.message || '') + '</div>';
            }).join('');
        }

        var protHtml = '';
        if (protection && protection.productName) {
            var uvR = protection.uvResidual;
            var pct = uvR ? uvR.residualPct : protection.pctRemaining;
            var pctColor = pct >= 70 ? '#16a34a' : (pct >= 40 ? '#d97706' : '#dc2626');
            var reapply = uvR ? uvR.reapplyFlag : (pct < 30);

            var metaParts = [];
            if (protection.daysSince != null) metaParts.push('Applied ' + protection.daysSince + 'd ago');
            if (protection.fracGroup)          metaParts.push('FRAC ' + esc(String(protection.fracGroup)));
            if (protection.activeIngredient)   metaParts.push(esc(protection.activeIngredient));

            protHtml =
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-size:14px;font-weight:600;color:#17231f;">' + esc(protection.productName) + '</span>' +
                '<span style="font-size:14px;font-weight:700;color:' + pctColor + ';">' + pct + '% active</span>' +
                '</div>' +
                (metaParts.length ? '<div style="font-size:12px;color:#5b6a65;margin-bottom:8px;">' + metaParts.join(' · ') + '</div>' : '') +
                '<div style="height:6px;background:#e5e7eb;border-radius:3px;margin-bottom:8px;">' +
                '<div style="height:6px;background:' + pctColor + ';border-radius:3px;width:' + Math.min(pct, 100) + '%;transition:width .3s"></div>' +
                '</div>' +
                (reapply ? '<div style="font-size:12px;font-weight:600;color:#b45309;margin-bottom:4px;">Residual below 70% — consider reapplication before the next risk window</div>' : '') +
                (uvR && uvR.breakdown
                    ? '<div style="font-size:11px;color:#9ca3af;">Photolysis model: UV ' + uvR.breakdown.uvSurvival + '% · Rain ' + uvR.breakdown.rainSurvival + '% · Bio ' + uvR.breakdown.bioSurvival + '%' +
                      (uvR.confidence ? ' · Confidence: ' + esc(uvR.confidence) : '') + '</div>'
                    : '');
        }

        var emptyHtml = !hasData
            ? '<p style="font-size:13px;color:#9ca3af;margin:0;">No fungicide on record for this zone. Log a spray in <a href="/data?section=spray-log" style="color:#236b4a;">Spray Log</a>.</p>'
            : '';

        return '<div class="gl-block" id="dr-residual-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent"></div>' +
            '<div class="gl-block-title">Fungicide Residual Protection</div>' +
            '</div>' +
            '<div class="gl-block-body" id="dr-residual-body">' +
            fracHtml + protHtml + emptyHtml +
            '</div></div>';
    }

    function refreshResidualBlock() {
        var body = document.getElementById('dr-residual-body');
        if (!body) return;
        var protection  = global._sprayResidualProtection;
        var fracWarnings = global._sprayFRACWarnings;

        var fracHtml = '';
        if (fracWarnings && fracWarnings.length > 0) {
            fracHtml = fracWarnings.map(function(w) {
                return '<div style="padding:8px 12px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px;color:#92400e;margin-bottom:6px;">' + esc(w.message || '') + '</div>';
            }).join('');
        }

        var protHtml = '';
        if (protection && protection.productName) {
            var uvR = protection.uvResidual;
            var pct = uvR ? uvR.residualPct : protection.pctRemaining;
            var pctColor = pct >= 70 ? '#16a34a' : (pct >= 40 ? '#d97706' : '#dc2626');
            var reapply = uvR ? uvR.reapplyFlag : (pct < 30);
            var metaParts = [];
            if (protection.daysSince != null) metaParts.push('Applied ' + protection.daysSince + 'd ago');
            if (protection.fracGroup)          metaParts.push('FRAC ' + esc(String(protection.fracGroup)));
            if (protection.activeIngredient)   metaParts.push(esc(protection.activeIngredient));
            protHtml =
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-size:14px;font-weight:600;color:#17231f;">' + esc(protection.productName) + '</span>' +
                '<span style="font-size:14px;font-weight:700;color:' + pctColor + ';">' + pct + '% active</span>' +
                '</div>' +
                (metaParts.length ? '<div style="font-size:12px;color:#5b6a65;margin-bottom:8px;">' + metaParts.join(' · ') + '</div>' : '') +
                '<div style="height:6px;background:#e5e7eb;border-radius:3px;margin-bottom:8px;">' +
                '<div style="height:6px;background:' + pctColor + ';border-radius:3px;width:' + Math.min(pct, 100) + '%;transition:width .3s"></div>' +
                '</div>' +
                (reapply ? '<div style="font-size:12px;font-weight:600;color:#b45309;margin-bottom:4px;">Residual below 70% — consider reapplication before the next risk window</div>' : '') +
                (uvR && uvR.breakdown
                    ? '<div style="font-size:11px;color:#9ca3af;">Photolysis model: UV ' + uvR.breakdown.uvSurvival + '% · Rain ' + uvR.breakdown.rainSurvival + '% · Bio ' + uvR.breakdown.bioSurvival + '%</div>'
                    : '');
        }

        body.innerHTML = fracHtml + protHtml ||
            '<p style="font-size:13px;color:#9ca3af;margin:0;">No fungicide on record. Log a spray in <a href="/data?section=spray-log" style="color:#236b4a;">Spray Log</a>.</p>';
    }

    // ── Render: page header (summary KPI panel) ───────────────────────────────

    function renderDiseaseHeader(d, diseases) {
        var score   = d.overallScore != null ? Math.round(d.overallScore) : null;
        var level   = (d.riskLevel || 'none').toLowerCase();
        if ((level === 'none' || !level) && score != null && score > 0) {
            level = score >= 70 ? 'high' : score >= 50 ? 'moderate' : 'low';
        }
        var c       = riskColor(level);

        var topThreat  = diseases[0] || null;
        var topName    = topThreat ? (topThreat.displayName || topThreat.disease || topThreat.name || '') : null;
        var topScore   = topThreat ? (topThreat.adjustedRisk != null ? Math.round(topThreat.adjustedRisk) : (topThreat.riskScore != null ? Math.round(topThreat.riskScore) : (topThreat.risk != null ? Math.round(topThreat.risk) : null))) : null;
        var topLevel   = topThreat ? (topThreat.riskLevel || topThreat.level || '') : '';
        var tc         = riskColor(topLevel);

        var aw         = d.applicationWindow;
        var env        = d.environment || {};
        var curTemp    = numVal(env.temperature);
        var precipProb = env.precipProbability != null ? env.precipProbability : (env.precipProb != null ? env.precipProb : null);
        var curWind    = numVal(env.wind) != null ? numVal(env.wind) : numVal(env.windSpeed);
        var tempMin    = aw ? (aw.tempMin != null ? aw.tempMin : 10) : 10;
        var tempMax    = aw ? (aw.tempMax != null ? aw.tempMax : 30) : 30;
        var windMax    = aw ? (aw.windMaxKph != null ? aw.windMaxKph : (aw.windMax != null ? aw.windMax : 15)) : 15;
        var appOptimal = aw ? (aw.currentlyOptimal != null ? aw.currentlyOptimal : (curTemp != null ? curTemp >= tempMin && curTemp <= tempMax && (precipProb == null || precipProb <= 50) && (curWind == null || curWind < windMax) : null)) : null;

        function hexToRgb(hex) {
            var h = hex.replace('#', '');
            return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
        }

        function kpiCard(label, value, unit, statusHtml, color) {
            var rgb = hexToRgb(color);
            var bg     = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.07)';
            var border = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.25)';
            return [
                '<div class="gl-kpi-card" style="background:' + bg + ';border-color:' + border + ';border-left-color:' + color + '">',
                '  <div class="gl-kpi-label">' + label + ' ' + infoBtn('dr-overall') + '</div>',
                '  <div class="gl-kpi-value" style="color:' + color + '">' + value + '</div>',
                unit       ? '  <div class="gl-kpi-unit">' + unit + '</div>' : '',
                statusHtml ? '  <div>' + statusHtml + '</div>' : '',
                '</div>'
            ].join('');
        }

        function kpiCardPlain(label, value, unit, statusHtml, color) {
            var rgb = hexToRgb(color);
            var bg     = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.07)';
            var border = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.25)';
            return [
                '<div class="gl-kpi-card" style="background:' + bg + ';border-color:' + border + ';border-left-color:' + color + '">',
                '  <div class="gl-kpi-label">' + label + '</div>',
                '  <div class="gl-kpi-value" style="color:' + color + '">' + value + '</div>',
                unit       ? '  <div class="gl-kpi-unit">' + unit + '</div>' : '',
                statusHtml ? '  <div>' + statusHtml + '</div>' : '',
                '</div>'
            ].join('');
        }

        var cards = [];
        cards.push(kpiCard(
            'Overall Risk',
            score != null ? score + '%' : (capitalize(level) || '—'),
            '',
            riskBadge(level),
            c.badge || '#9ca3af'
        ));

        if (topThreat) {
            cards.push(kpiCardPlain(
                'Top Threat',
                topScore != null ? topScore + '%' : '—',
                esc(topName || ''),
                riskBadge(topLevel),
                tc.badge || '#9ca3af'
            ));
        }

        if (aw || appOptimal !== null) {
            var appColor  = appOptimal === true ? '#16a34a' : appOptimal === false ? '#d97706' : '#9ca3af';
            var appValue  = appOptimal === true ? 'Open' : appOptimal === false ? 'Watch' : '—';
            var appStatus = appOptimal === true
                ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#dcfce7;color:#15803d;border:1px solid #86efac">Suitable</span>'
                : appOptimal === false
                ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#fff7ed;color:#c2410c;border:1px solid #fdba74">Check forecast</span>'
                : '';
            cards.push(kpiCardPlain('Application Window', appValue, '', appStatus, appColor));
        }

        return [
            '<div class="gl-header">',
            '  <div class="gl-header-inner">',
            '    <div style="display:flex;align-items:center;margin-bottom:2px">',
            '      <h1 class="gl-title">Disease Risk Analysis</h1>',
            '    </div>',
            '    <div class="gl-subtitle">Disease pressure, pathogen models and spray timing</div>',
            '    <div class="gl-kpi-grid">',
            cards.join(''),
            '      <div id="dr-forecast-kpi-slot"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // ── Render: recommendations block ─────────────────────────────────────────

    function renderDiseaseRecommendations(diseases) {
        var dd = global.GAIP_DASHBOARD_DATA;
        var currentCompanion = (global.GAIP_SITE_CONFIG && global.GAIP_SITE_CONFIG.turf && global.GAIP_SITE_CONFIG.turf.companionSpecies) || null;
        var cd = (currentCompanion && dd && dd.metrics && dd.metrics.companionDisease) ? dd.metrics.companionDisease : null;
        var companionDiseases = cd && cd.diseases ? cd.diseases.filter(function(d) { return d.risk > 0 || d.inWindow; }) : [];
        var companionLabel = cd ? esc(cd.speciesLabel || cd.species || 'Fairway / Tee') : '';

        var hasGreens    = diseases && diseases.length > 0;
        var hasCompanion = companionDiseases.length > 0;

        if (!hasGreens && !hasCompanion) {
            return [
                '<div class="gl-block">',
                '  <div class="gl-block-header">',
                '    <div class="gl-block-accent"></div>',
                '    <div class="gl-block-title">Recommendations</div>',
                '  </div>',
                '  <div class="gl-block-body" style="color:#5b6a65;font-style:italic;text-align:center;padding:24px 20px">',
                '    No active disease threats — continue regular scouting.',
                '  </div>',
                '</div>'
            ].join('\n');
        }

        function buildRecItem(name, level, rec, labelPrefix) {
            var action, headline, timing;
            if (rec) {
                action   = (rec.action || '').toLowerCase();
                headline = rec.headline || rec.text || '';
                timing   = rec.timing || '';
            } else {
                action   = (level === 'severe' || level === 'high') ? 'curative'
                         : level === 'moderate' ? 'preventive' : 'monitor';
                headline = '';
                timing   = '';
            }
            var cls      = ACTION_REC_CLASS[action] || 'monitor';
            var icon     = ACTION_ICON[action] || '✓';
            var products = rec && Array.isArray(rec.products) && rec.products.length ? rec.products.filter(function(p, i, a) { return a.indexOf(p) === i; }) : [];
            var prefix   = labelPrefix ? '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin-right:4px">' + labelPrefix + ' · </span>' : '';
            return '<div class="gl-rec ' + cls + '">' +
                '<div class="gl-rec-priority">' + prefix + esc(name) + '</div>' +
                icon + ' ' + capitalize(rec ? (rec.action || 'Monitor') : action) +
                (timing ? ' <span style="font-weight:400;opacity:.75">· ' + esc(timing) + '</span>' : '') +
                (headline ? '<div style="margin-top:4px;opacity:.85">' + esc(headline) + '</div>' : '') +
                (products.length ? '<div style="margin-top:4px;font-size:12px;opacity:.8"><strong>Products:</strong> ' + esc(products.join(', ')) + '</div>' : '') +
                '</div>';
        }

        var items = [];

        function isActionable(rec) {
            return !rec || (rec.action || '').toLowerCase() !== 'none';
        }

        var greensItems = [];
        if (hasGreens) {
            diseases.forEach(function (disease) {
                if (!isActionable(disease.recommendation)) return;
                var name  = disease.displayName || disease.disease || disease.name || 'Unknown';
                var level = (disease.riskLevel || disease.level || '').toLowerCase();
                greensItems.push(buildRecItem(name, level, disease.recommendation || null, null));
            });
        }

        var companionItems = [];
        if (hasCompanion) {
            companionDiseases.forEach(function (d) {
                if (!isActionable(d.recommendation)) return;
                var level = _companionRiskLevel(d.risk || 0);
                companionItems.push(buildRecItem(d.name || '', level, d.recommendation || null, null));
            });
        }

        var showGreensLabel = greensItems.length > 0 && companionItems.length > 0;

        if (greensItems.length > 0) {
            if (showGreensLabel) {
                items.push('<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-secondary);margin-bottom:8px">Greens</div>');
            }
            greensItems.forEach(function(i) { items.push(i); });
        }

        if (companionItems.length > 0) {
            items.push('<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-secondary);margin-top:12px;margin-bottom:8px;padding-top:12px;border-top:1px solid var(--gaip-border-light,#e8eeeb)">' + companionLabel + ' — Fairway / Tee</div>');
            companionItems.forEach(function(i) { items.push(i); });
        }

        var totalCount = greensItems.length + companionItems.length;

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent"></div>',
            '    <div class="gl-block-title">Recommendations</div>',
            totalCount > 0 ? '    <div class="gl-block-sub">' + totalCount + ' action' + (totalCount !== 1 ? 's' : '') + '</div>' : '',
            '  </div>',
            '  <div class="gl-block-body">',
            totalCount > 0
                ? '    <div class="gl-rec-list">' + items.join('\n') + '    </div>'
                : '    <div style="color:#5b6a65;font-style:italic;text-align:center;padding:24px 20px">No action required — continue regular scouting.</div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // ── State & render ────────────────────────────────────────────────────────

    var _selectedIdx  = 0;
    var _diseases     = [];
    var _cachedForecastHtml = null;  // cached after first initForecastChart() load

    global.drSelectDisease = function (idx) {
        _selectedIdx = idx;
        renderPage();
        // After renderPage() the placeholder #dr-forecast-wrap reappears — restore cached chart
        if (_cachedForecastHtml) {
            var wrap = document.getElementById('dr-forecast-wrap');
            if (wrap) wrap.outerHTML = _cachedForecastHtml;
        }
    };

    function renderPage() {
        var container = document.getElementById('dr-page-content');
        if (!container) return;

        var data = global.GAIP_DASHBOARD_DATA;
        var d = getDiseaseData();

        // Notification bar
        var notice = document.getElementById('db-analysis-notice');
        var noticeText = document.getElementById('db-analysis-notice-text');
        var noticeDismiss = document.getElementById('db-analysis-notice-dismiss');
        if (notice && noticeText) {
            var msg = null;
            if (!data || !d) {
                msg = 'No analysis data found — run analysis from the hub to populate this page.';
            } else if (data.analyzedAt) {
                var ageMs = Date.now() - new Date(data.analyzedAt).getTime();
                if (ageMs / (1000 * 60 * 60 * 24) > 2) {
                    msg = 'Analysis data is ' + Math.floor(ageMs / (1000 * 60 * 60 * 24)) + ' days old — re-run for the latest conditions.';
                }
            }
            if (msg) {
                noticeText.textContent = msg;
                notice.style.display = 'flex';
                if (noticeDismiss) noticeDismiss.onclick = function () { notice.style.display = 'none'; };
            }
        }

        if (!d) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:#5b6a65">No analysis data. Run analysis first.</div>';
            return;
        }

        _diseases = filterDiseases(d.diseases.length ? d.diseases : d.topThreats);
        if (_selectedIdx >= _diseases.length) _selectedIdx = 0;
        var selectedDisease = _diseases[_selectedIdx] || null;

        var headerHtml   = renderDiseaseHeader(d, _diseases);
        var recsHtml     = renderDiseaseRecommendations(_diseases);
        var alertHtml    = renderAlertBar(_diseases);
        var forecastHtml = renderForecastChart(d);
        var appHtml      = renderAppWindow(d);

        // If no static forecast data, render a placeholder that initForecastChart() will fill
        var forecastBlock = forecastHtml ||
            '<div id="dr-forecast-wrap" class="gl-block">' +
            '<div class="gl-block-header"><div class="gl-block-accent"></div>' +
            '<div class="gl-block-title">Disease Risk Forecast</div>' +
            '<span class="gl-block-sub">7–14 day projection</span>' +
            '</div>' +
            '<div class="gl-block-body" style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">Loading forecast…</div>' +
            '</div>';

        container.innerHTML =
            headerHtml +
            '<div class="gl-body">' +
            recsHtml +
            appHtml +
            renderResidualBlock() +
            (alertHtml ? alertHtml : '') +
            '<div class="dr-split">' +
            '  <div id="dr-left">'  + renderLeft(d, _selectedIdx) + '</div>' +
            '  <div id="dr-right">' + renderRight(selectedDisease) + '</div>' +
            '</div>' +
            forecastBlock +
            renderCultivarBlock() +
            renderDewForecastBlock() +
            renderCompanionDiseaseBlock() +
            '</div>';

    }

    // ── Cultivar performance block ───────────────────────────────────────────

    function renderCultivarBlock() {
        var siteConfig = global.GAIP_SITE_CONFIG || {};
        var turf       = siteConfig.turf || {};
        var hubCfg     = global.GAIP_HUB_CONFIG || {};
        var species    = turf.species || hubCfg.turfSpecies || '';
        var variety    = turf.variety || 'generic';
        var vt         = global.GAIP_VARIETY_TRAITS;

        if (!species) return '';

        // Map species to traits key
        var speciesKeyMap = {
            'Creeping Bentgrass (Greens)': 'bentgrass', 'Creeping Bentgrass (Fairway)': 'bentgrass',
            'Creeping Bentgrass': 'bentgrass', 'Colonial Bentgrass': 'bentgrass',
            'Browntop Bent': 'browntopBent', 'Browntop Bent (Greens)': 'browntopBent',
            'Browntop Bent (Fairways)': 'browntopBent', 'Browntop Bent / Colonial': 'browntopBent',
            'Perennial Ryegrass': 'perennialRyegrass',
            'Kentucky Bluegrass': 'kentuckyBluegrass', 'Tall Fescue': 'tallFescue',
            'Fine Fescue': 'fineFescue', 'Chewings Fescue': 'chewingsFescue',
            'Poa annua': null, 'Couch': 'couch', 'Bermuda': 'couch', 'Kikuyu': 'kikuyu',
            'Zoysia': 'zoysia', 'Seashore Paspalum': 'seashore_paspalum', 'Buffalo': 'buffalo',
        };
        var speciesKey = speciesKeyMap[species] || null;
        var traitData  = (vt && speciesKey && vt[speciesKey] && vt[speciesKey][variety]) ? vt[speciesKey][variety] : null;
        if (!traitData && vt && speciesKey && vt[speciesKey]) traitData = vt[speciesKey]['_default'] || null;

        var diseaseResist = traitData && traitData.diseaseResistance;

        function makeResistChip(name, pct) {
            var color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
            var label = pct >= 70 ? 'Resistant' : pct >= 40 ? 'Moderate' : 'Susceptible';
            return '<div style="background:' + color + '15;border:1px solid ' + color + '40;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:6px">' +
                '<span style="font-size:12px;color:var(--gaip-text)">' + esc(name) + '</span>' +
                '<span style="font-size:11px;font-weight:600;color:' + color + '">' + label + '</span>' +
                '</div>';
        }

        var rows = '';
        if (diseaseResist && typeof diseaseResist === 'object') {
            // GEVES format: diseaseResistance: { dollarSpot: { rating: 7.5 }, ... }
            var chips = '';
            Object.keys(diseaseResist).forEach(function (disease) {
                var val = diseaseResist[disease];
                var rating = typeof val === 'number' ? val : (val && val.rating);
                if (typeof rating !== 'number') return;
                chips += makeResistChip(disease, Math.round(rating * 10));
            });
            if (chips) rows = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chips + '</div>';
        }

        if (!rows && traitData) {
            // NTEP/regional format: use getDiseaseModifier to resolve regionalTraits
            var getDM = typeof window !== 'undefined' && (
                (window.GAIP_VarietyTraits && window.GAIP_VarietyTraits.getDiseaseModifier) ||
                window.gaip_getRegionalDiseaseModifier ||
                window.gaip_getDiseaseModifier
            );
            var diseaseLabels = {
                dollarSpot: 'Dollar Spot', brownPatch: 'Brown Patch', pythium: 'Pythium',
                pythiumRootRot: 'Pythium Root Rot', anthracnose: 'Anthracnose',
                grayLeafSpot: 'Gray Leaf Spot', springDeadSpot: 'Spring Dead Spot',
                redThread: 'Red Thread', fusarium: 'Fusarium Patch', largePatch: 'Large Patch'
            };
            var diseaseList = ['dollarSpot', 'brownPatch', 'pythium', 'pythiumRootRot',
                               'anthracnose', 'grayLeafSpot', 'springDeadSpot',
                               'redThread', 'fusarium', 'largePatch'];
            if (typeof getDM === 'function') {
                var chips = '';
                diseaseList.forEach(function (disease) {
                    var mod = getDM(speciesKey, variety, disease);
                    if (!mod || mod.confidence === 'none') return;
                    var risk = mod.riskMultiplier || 1.0;
                    // Convert riskMultiplier to 0-100: 0.75→75 (Resistant), 1.0→55 (Moderate), 1.5→25 (Susceptible)
                    var pct = Math.round(Math.max(0, Math.min(100, (2 - risk) * 60)));
                    chips += makeResistChip(diseaseLabels[disease] || disease, pct);
                });
                if (chips) rows = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chips + '</div>';
            }
        }

        if (!rows) {
            rows = '<div style="font-size:13px;color:var(--gaip-text-secondary);padding:8px 0">Detailed resistance data not available for ' + esc(variety === 'generic' ? species : variety) + '. Check product literature for disease susceptibility notes.</div>';
        }

        // Trait performance cards (Wear, Water Use, Drought, Winter Hardiness)
        var traitCards = '';
        var VT = typeof window !== 'undefined' && window.GAIP_VarietyTraits;
        if (VT && variety && variety !== 'generic') {
            var wear  = VT.getWearModifier(species, variety);
            var water = VT.getWaterUseModifier(species, variety);
            var heat  = VT.getHeatDroughtModifier(species, variety);
            var cold  = VT.getColdModifier(species, variety);

            function traitCard(title, value, source, confidence) {
                var borderColor = confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#f59e0b' : 'var(--gaip-border)';
                return '<div style="background:var(--gaip-surface-alt,#f3f7f5);padding:10px 12px;border-radius:8px;border-left:3px solid ' + borderColor + '">' +
                    '<div style="font-size:10px;text-transform:uppercase;color:var(--gaip-text-secondary);letter-spacing:.04em;margin-bottom:4px">' + title + '</div>' +
                    '<div style="font-size:14px;font-weight:600;color:var(--gaip-text)">' + value + '</div>' +
                    '<div style="font-size:11px;color:var(--gaip-text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(source || '') + '">' + esc((source || '').substring(0, 38) + ((source || '').length > 38 ? '…' : '')) + '</div>' +
                    '</div>';
            }
            function wearLabel(m) { return m < 0.85 ? 'Excellent' : m < 0.95 ? 'Good' : m > 1.15 ? 'Poor' : m > 1.05 ? 'Below avg' : 'Average'; }
            function waterLabel(m) { return m < 0.85 ? 'Excellent drought tol.' : m < 0.95 ? 'Good drought tol.' : m > 1.15 ? 'High water needs' : m > 1.05 ? 'Above avg needs' : 'Average'; }
            function droughtLabel(m) { return m < 0.85 ? 'Excellent' : m < 0.95 ? 'Good' : m > 1.05 ? 'Below avg' : 'Average'; }

            var cards = '';
            if (wear.confidence !== 'none') {
                cards += traitCard('Wear Tolerance', wearLabel(wear.multiplier || 1), wear.source, wear.confidence);
            } else {
                cards += traitCard('Wear Tolerance', 'No data', 'No ' + (VT.getCurrentRegion ? VT.getCurrentRegion().toUpperCase() : '') + ' data', 'none');
            }
            if (water.confidence !== 'none') {
                cards += traitCard('Water Use', waterLabel(water.multiplier || 1), water.source, water.confidence);
            } else {
                cards += traitCard('Water Use', 'No data', 'No water use data', 'none');
            }
            if (heat.confidence !== 'none') {
                cards += traitCard('Drought Tolerance', droughtLabel(heat.droughtMultiplier || 1), heat.source, heat.confidence);
            }
            if (cold.confidence !== 'none') {
                var winterkill = cold.winterkillRisk || 1;
                var winterLabel = winterkill < 0.9 ? Math.round((1 - winterkill) * 100) + '% lower winterkill risk vs generic'
                                : winterkill > 1.1 ? Math.round((winterkill - 1) * 100) + '% higher winterkill risk vs generic'
                                : 'Average winter hardiness';
                cards += traitCard('Winter Hardiness', winterLabel, cold.source, cold.confidence);
            }

            if (cards) {
                traitCards = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:14px">' + cards + '</div>';
            }

            // Data note if any key trait is missing
            var missing = [];
            if (wear.confidence  === 'none') missing.push('Wear');
            if (water.confidence === 'none') missing.push('Water Use');
            if (heat.confidence  === 'none') missing.push('Shade');
            if (missing.length > 0) {
                traitCards += '<div style="font-size:11px;color:var(--gaip-warning,#d97706);padding:6px 10px;background:var(--gaip-warning-bg,#fffbeb);border-radius:6px;margin-bottom:10px">Data Note: No trial data available for ' + missing.join(', ') + '.</div>';
            }
        }

        return '<div class="gl-block" style="margin-top:16px">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:var(--gaip-info)"></div>' +
            '<div class="gl-block-title">Cultivar Performance' +
            '<button class="db-info-icon" data-info="cultivar-performance" tabindex="0" style="margin-left:6px">i</button>' +
            '</div>' +
            '<span class="gl-block-sub">' + esc(variety === 'generic' ? species : variety) + ' — performance profile</span>' +
            '</div>' +
            '<div class="gl-block-body">' +
            traitCards +
            '<div style="font-weight:600;font-size:12px;color:var(--gaip-text);margin-bottom:8px">Disease Resistance</div>' +
            '<p style="font-size:12px;color:var(--gaip-text-secondary);margin:0 0 10px">Resistance ratings for your selected cultivar across key diseases. A low rating means your turf is genetically susceptible — this raises the risk threshold used in the model.</p>' +
            rows +
            '</div></div>';
    }

    // ── Dew forecast block ───────────────────────────────────────────────────

    function renderDewForecastBlock() {
        var siteConfig = global.GAIP_SITE_CONFIG || {};
        var turf       = siteConfig.turf || {};
        var turfType   = turf.turfType || (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.siteType) || '';

        var dew = global.GAIP_DEW_RESULT;

        var hasForecast = dew && Array.isArray(dew.forecast) && dew.forecast.length > 0;

        // Show block for golf/sports (with or without data).
        // If we have real forecast data, show it for any turf type.
        if (!hasForecast && turfType !== 'golf' && turfType !== 'sports') return '';

        var forecast = hasForecast ? dew.forecast : [];
        var rows = '';
        forecast.slice(0, 7).forEach(function (day) {
            var risk    = day.risk || 'low';
            var cls     = risk === 'high' ? 'critical' : risk === 'moderate' ? 'warning' : 'good';
            var wetHrs  = typeof day.wetHours === 'number' ? day.wetHours.toFixed(1) + ' hrs' : '—';
            rows += '<div style="display:grid;grid-template-columns:1fr 90px 80px;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gaip-border-light,#e8eeeb)">' +
                '<span style="font-size:12px;font-weight:600;color:var(--gaip-text)">' + esc(day.label || '') + '</span>' +
                '<span style="font-size:11px;color:var(--gaip-text-secondary)">' + esc(wetHrs) + '</span>' +
                '<span style="font-size:11px;font-weight:700;color:var(--gaip-' + cls + ');text-transform:capitalize">' + esc(risk) + '</span>' +
                '</div>';
        });

        if (!rows) {
            rows = '<div style="font-size:13px;color:var(--gaip-text-secondary);padding:8px 0">Dew forecast unavailable — run analysis with live weather to populate.</div>';
        }

        return '<div id="dr-dew-block" class="gl-block" style="margin-top:16px">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:var(--gaip-info)"></div>' +
            '<div class="gl-block-title">Dew Forecast &amp; Match Conditions' +
            '<button class="db-info-icon" data-info="dew-forecast" tabindex="0" style="margin-left:6px">i</button>' +
            '</div>' +
            '<span class="gl-block-sub">Leaf wetness risk for the next 7 days</span>' +
            '</div>' +
            '<div class="gl-block-body">' +
            '<p style="font-size:12px;color:var(--gaip-text-secondary);margin:0 0 10px">Dew periods create ideal conditions for fungal infection spread. Schedule early-morning irrigation and improve air movement to reduce risk on high-pressure days.</p>' +
            rows +
            '</div></div>';
    }

    // ── Companion disease block (fairway/tee parallel analysis) ─────────────

    var _companionSelectedIdx = 0;

    // Derive risk level string from a numeric percentage
    function _companionRiskLevel(pct) {
        if (pct >= 70) return 'high';
        if (pct >= 50) return 'moderate';
        if (pct > 0)   return 'low';
        return 'low';
    }

    function _renderCompanionLeft(diseases, overallScore, overallRisk) {
        var html = '';
        if (overallScore != null || overallRisk) {
            var oc = riskColor(overallRisk || '');
            html += '<div class="gl-block" style="background:' + oc.bg + ';border-color:' + oc.border + ';margin-bottom:16px">' +
                '<div class="gl-block-body">' +
                '<div class="gl-section-label" style="color:' + oc.text + ';margin-top:0">Overall Disease Risk ' + infoBtn('dr-overall') + '</div>' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
                '<span style="font-size:36px;font-weight:800;color:' + oc.badge + ';line-height:1">' +
                (overallScore != null ? overallScore + '%' : (capitalize(overallRisk) || '—')) + '</span>' +
                riskBadge(overallRisk || '') +
                '</div>' +
                '</div></div>';
        }
        if (!diseases || !diseases.length) {
            return html + '<div style="padding:20px;text-align:center;color:#5b6a65;font-size:13px">No active disease threats detected.</div>';
        }
        html += '<div class="gl-section-label">Active Threats</div>';
        diseases.forEach(function (d, idx) {
            var level = _companionRiskLevel(d.risk || 0);
            var dc    = riskColor(level);
            var isSelected = _companionSelectedIdx === idx;
            html += '<button onclick="drSelectCompanion(' + idx + ')" class="dr-disease-btn' +
                (isSelected ? ' active' : '') + '"' +
                (isSelected ? ' style="border-color:' + dc.badge + ';background:' + dc.bg + '"' : '') + '>';
            html += '<div style="display:flex;align-items:center;gap:8px;min-width:0">' +
                '<span style="width:8px;height:8px;border-radius:50%;background:' + dc.badge + ';flex-shrink:0"></span>' +
                '<span style="font-size:13px;font-weight:600;color:#17231f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.name || '') + '</span>' +
                '</div>';
            html += '<span style="font-size:13px;font-weight:700;color:' + dc.badge + ';flex-shrink:0;margin-left:8px">' + (d.risk || 0) + '%</span>';
            html += '</button>';
        });
        return html;
    }

    function _renderCompanionRight(d) {
        if (!d) return '<div class="gl-block"><div class="gl-block-body" style="padding:60px 20px;text-align:center;color:#9ca3af;font-size:13px">Select a disease from the list.</div></div>';

        var risk  = d.risk || 0;
        var level = _companionRiskLevel(risk);
        var dc    = riskColor(level);

        var html = '<div class="gl-block">';
        html += '<div class="gl-block-header">';
        html += '<div class="gl-block-accent" style="background:' + dc.badge + '"></div>';
        html += '<div class="gl-block-title">' + esc(d.name || '') + '</div>';
        html += '<div class="gl-block-sub" style="display:flex;align-items:center;gap:8px">';
        html += '<span style="font-size:22px;font-weight:800;color:' + dc.badge + ';line-height:1">' + risk + '%</span>';
        html += riskBadge(level);
        html += '</div>';
        html += '</div>';
        html += '<div class="gl-block-body">';

        // Environmental Drivers
        var drivers = d.drivers;
        if (drivers && typeof drivers === 'object' && Object.keys(drivers).length > 0) {
            html += '<div class="gl-section-label">Environmental Drivers</div>';
            var suppressedNotes2 = [];
            Object.keys(drivers).forEach(function(key) {
                var dv      = drivers[key];
                if (dv.suppressed) {
                    if (dv.suppressedNote) suppressedNotes2.push(dv.suppressedNote);
                    return;
                }
                var contrib = dv.contribution != null ? Math.round(dv.contribution) : null;
                var val     = dv.value != null ? dv.value : null;
                var valStr  = val != null ? (typeof val === 'number' ? Math.round(val) : String(val)) : null;
                var label   = driverLabel(key);
                if (contrib == null && val == null) return;
                var barColor = contrib >= 70 ? '#ef4444' : contrib >= 40 ? '#f97316' : '#eab308';
                html += '<div style="margin-bottom:12px">';
                html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
                html += '<span style="font-size:12px;color:#374151">' + esc(label) + '</span>';
                html += '<span style="font-size:12px;font-weight:600;color:#17231f">';
                if (valStr != null) html += esc(valStr);
                if (contrib != null) html += (valStr != null ? ' · ' : '') + contrib + '% contribution';
                html += '</span>';
                html += '</div>';
                if (contrib != null) {
                    html += '<div class="dr-driver-bar"><div class="dr-driver-fill" style="width:' +
                            Math.min(contrib, 100) + '%;background:' + barColor + '"></div></div>';
                }
                html += '</div>';
            });
            if (suppressedNotes2.length) {
                html += '<div style="font-size:11px;color:#6b7280;margin-bottom:8px">' + suppressedNotes2.map(esc).join(' · ') + '</div>';
            }
            html += '<hr class="gl-section-sep">';
        }

        // Recommendation (same format as main analysis)
        var rec = d.recommendation;
        if (rec) {
            var action   = (rec.action || '').toLowerCase();
            var recClass = ACTION_REC_CLASS[action] || 'monitor';
            var recIcon  = ACTION_ICON[action]  || '✓';
            html += '<div class="gl-section-label">Recommendation</div>';
            html += '<div class="gl-rec ' + recClass + '">';
            html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:700">';
            html += '<span>' + recIcon + ' ' + capitalize(rec.action || 'Monitor') + '</span>';
            if (rec.timing) html += '<span style="font-weight:400;opacity:.75">· ' + esc(rec.timing) + '</span>';
            html += '</div>';
            if (rec.headline) html += '<div style="line-height:1.5' + (rec.products && rec.products.length ? ';margin-bottom:8px' : '') + '">' + esc(rec.headline) + '</div>';
            if (rec.products && rec.products.length) {
                var uniqueProds = rec.products.filter(function(p, i, a) { return a.indexOf(p) === i; });
                html += '<div style="font-size:12px;opacity:.8"><strong>Products:</strong> ' + esc(uniqueProds.join(', ')) + '</div>';
            }
            html += '</div>';
        }

        // Treatment window (when no recommendation or as supplement)
        if (d.inWindow && !rec) {
            var st = d.soilTemp != null ? ' · Soil ' + d.soilTemp + '°C' : '';
            html += '<div class="gl-section-label">Treatment Window</div>';
            html += '<div class="gl-rec week" style="margin-bottom:12px">';
            html += '<div style="font-weight:700;margin-bottom:4px">⚠ Window Open' + esc(st) + '</div>';
            html += '<div style="line-height:1.5">Apply a preventive fungicide now — conditions are within the treatment window.</div>';
            html += '</div>';
        } else if (d.timing && !rec) {
            html += '<div class="gl-section-label">Timing</div>';
            html += '<div style="font-size:13px;color:var(--gaip-text);margin-bottom:12px">' + esc(d.timing) + (d.soilTemp != null ? ' · Soil ' + d.soilTemp + '°C' : '') + '</div>';
        }

        html += '<div style="font-size:11px;color:var(--gaip-text-secondary);padding-top:12px;border-top:1px solid var(--gaip-border-light,#e8eeeb)">';
        html += 'Calculated from the same weather data as the greens analysis. Greens soil and tissue inputs are not applied.';
        html += '</div>';
        html += '</div></div>';
        return html;
    }

    function renderCompanionDiseaseBlock() {
        var dd = global.GAIP_DASHBOARD_DATA;
        var currentCompanion = (global.GAIP_SITE_CONFIG && global.GAIP_SITE_CONFIG.turf && global.GAIP_SITE_CONFIG.turf.companionSpecies) || null;
        var cd = (currentCompanion && dd && dd.metrics && dd.metrics.companionDisease) ? dd.metrics.companionDisease : null;
        if (!cd || !cd.diseases || !cd.diseases.length) return '';

        var speciesLabel = esc(cd.speciesLabel || cd.species || 'Fairway / Tee');
        var diseases = cd.diseases
            .filter(function (d) { return d.risk > 0 || d.inWindow; })
            .sort(function(a, b) { return (b.risk || 0) - (a.risk || 0); });

        var divider =
            '<div style="display:flex;align-items:center;gap:16px;margin:32px 0 20px">' +
            '<div style="flex:1;height:1px;background:var(--gaip-border-light,#e8eeeb)"></div>' +
            '<span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-secondary,#6b7280);white-space:nowrap">Fairway / Tee — ' + speciesLabel + '</span>' +
            '<div style="flex:1;height:1px;background:var(--gaip-border-light,#e8eeeb)"></div>' +
            '</div>';

        if (!diseases.length) {
            return divider +
                '<div style="padding:20px;text-align:center;color:var(--gaip-text-secondary,#6b7280);font-size:13px">' +
                'No active disease threats detected for ' + speciesLabel + ' under current conditions.' +
                '</div>';
        }

        if (_companionSelectedIdx >= diseases.length) _companionSelectedIdx = 0;

        var overallScore = cd.overallScore != null ? Math.round(cd.overallScore) : null;
        var overallRisk  = cd.overallRisk  || (overallScore != null ? (overallScore >= 70 ? 'high' : overallScore >= 50 ? 'moderate' : overallScore > 0 ? 'low' : 'none') : '');

        return divider +
            '<div class="dr-split" id="dr-companion-split">' +
            '<div id="dr-companion-left">' + _renderCompanionLeft(diseases, overallScore, overallRisk) + '</div>' +
            '<div id="dr-companion-right">' + _renderCompanionRight(diseases[_companionSelectedIdx]) + '</div>' +
            '</div>';
    }

    global.drSelectCompanion = function (idx) {
        var dd = global.GAIP_DASHBOARD_DATA;
        var cd = dd && dd.metrics && dd.metrics.companionDisease;
        if (!cd || !cd.diseases) return;
        var diseases = cd.diseases
            .filter(function (d) { return d.risk > 0 || d.inWindow; })
            .sort(function(a, b) { return (b.risk || 0) - (a.risk || 0); });
        var overallScore = cd.overallScore != null ? Math.round(cd.overallScore) : null;
        var overallRisk  = cd.overallRisk  || (overallScore != null ? (overallScore >= 70 ? 'high' : overallScore >= 50 ? 'moderate' : overallScore > 0 ? 'low' : 'none') : '');
        _companionSelectedIdx = idx;
        var leftEl  = document.getElementById('dr-companion-left');
        var rightEl = document.getElementById('dr-companion-right');
        if (leftEl)  leftEl.innerHTML  = _renderCompanionLeft(diseases, overallScore, overallRisk);
        if (rightEl) rightEl.innerHTML = _renderCompanionRight(diseases[idx] || null);
    };

    // ── Forecast chart (async, Open Meteo + DiseaseForecast) ─────────────────

    function initForecastChart() {
        var diseaseData = getDiseaseData();
        if (!diseaseData) return;

        // staticChart = static forecast was already rendered (no placeholder needed),
        // but we still fetch Open-Meteo to compute dew forecast.
        var staticChart = !document.getElementById('dr-forecast-wrap');

        var cfg = global.GAIP_HUB_CONFIG || {};
        var loc = cfg.savedLocation;
        if (!loc || !loc.lat || !loc.lon) {
            if (!staticChart) {
                var wrapEl = document.getElementById('dr-forecast-wrap');
                if (wrapEl) wrapEl.innerHTML =
                    '<div class="gl-block-body" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">No location set — forecast unavailable.</div>';
            }
            return;
        }

        var url = 'https://api.open-meteo.com/v1/forecast' +
            '?latitude='  + loc.lat +
            '&longitude=' + loc.lon +
            '&hourly=temperature_2m,relative_humidity_2m,precipitation' +
            '&timezone=auto' +
            '&forecast_days=8';

        fetch(url)
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) {
                if (!data.hourly || !data.hourly.time) return;

                var hourly = data.hourly;
                // NOTE: rawWeatherData is intentionally NOT set here.
                // The fresh OM hourly data is instead passed via state.forecastHourly (below)
                // and consumed by buildDailyPatternFallback Try 0, which uses Math.min() of
                // each 24-h slice to get true overnight minimums — consistent with getFidanzaE2
                // in Active Threats. Previously Try 1 relied on window.rawWeatherData set by
                // hub-tissue (race condition), and Try 2 fell back to climateMetrics.temperature.min
                // (hub-tissue historical, could be 12°C NZ July) → Brown Patch 25% in forecast /
                // 0% in Active Threats. Try 0 eliminates both problems.

                var rh     = hourly.relative_humidity_2m || [];
                var times  = hourly.time || [];
                var hoursPerDay = 24;
                var numForecastDays = Math.min(Math.ceil(times.length / hoursPerDay), 8);

                // Build per-day humidity averages for moisture.dailyPattern
                // (matches what the climate engine does with live hourly data)
                var moistureDaily = [];
                var allRhSum = 0, allRhCount = 0;
                for (var di = 0; di < numForecastDays; di++) {
                    var start = di * hoursPerDay;
                    var end   = Math.min(start + hoursPerDay, rh.length);
                    var dayRhSum = 0, dayRhCount = 0;
                    for (var hi = start; hi < end; hi++) {
                        if (rh[hi] != null) {
                            dayRhSum   += rh[hi];
                            dayRhCount++;
                            allRhSum   += rh[hi];
                            allRhCount++;
                        }
                    }
                    moistureDaily.push({ humidity: dayRhCount > 0 ? dayRhSum / dayRhCount : null });
                }
                var meanHumidity = allRhCount > 0 ? allRhSum / allRhCount : null;

                // Use stored climate from the analysis run — same as what the old site
                // passes as window.GAIP_STATE.climateMetrics (= computed.climate from
                // getAuthoritativeClimate).
                var storedClimate = (global.GAIP_DASHBOARD_DATA &&
                                     global.GAIP_DASHBOARD_DATA.computed &&
                                     global.GAIP_DASHBOARD_DATA.computed.climate) || {};

                // Expose stored dew result for leaf-wetness-sensitive diseases.
                if (global.GAIP_DASHBOARD_DATA && global.GAIP_DASHBOARD_DATA.computed && global.GAIP_DASHBOARD_DATA.computed.dew) {
                    global.GAIP_DEW_RESULT = global.GAIP_DEW_RESULT || global.GAIP_DASHBOARD_DATA.computed.dew;
                }

                // Shallow-copy stored climate so we can strip temperature.dailyPattern.
                // hub-persistence.js adds dailyPattern to the saved cache (from rawWeatherData),
                // but the old site's window.climateMetrics never has it. If dailyPattern is
                // present, generateForecast uses it directly instead of calling
                // buildDailyPatternFallback — which would use stale saved per-day temperatures
                // instead of generating a pattern from climateForForecast.temperature (stored
                // historical climate, same period as the active threats analysis).
                var climateForForecast = Object.assign({}, storedClimate);
                if (climateForForecast.temperature) {
                    climateForForecast.temperature = Object.assign({}, climateForForecast.temperature);
                    delete climateForForecast.temperature.dailyPattern;
                }
                // Humidity: use the period mean (from stored analysis climate) for ALL forecast
                // days so that buildDailyClimate falls back to climateMetrics.moisture.humidity.mean.
                // Per-day OM humidity makes Forecast "Today" diverge from Active Threats because
                // today's 24-h average (e.g. 74%) is drier than the multi-day period mean (e.g. 85%),
                // causing moisture-sensitive diseases (Fusarium) to show much lower scores in the
                // "Today" column than in Active Threats.  The old hub always used period-mean humidity
                // for all forecast days — dailyPattern: null restores that behaviour.
                climateForForecast.moisture = Object.assign({}, climateForForecast.moisture || {}, {
                    humidity: climateForForecast.moisture && climateForForecast.moisture.humidity
                        ? climateForForecast.moisture.humidity
                        : (climateForForecast.humidity || { mean: meanHumidity }),
                    dailyPattern: null,
                });

                // Build full state mirroring buildDiseaseInputs() in hub-orchestrator.js
                // so that generateForecast() uses complete site data (tissue, soil, shade,
                // wear, nitrogen) — not just climate + species.
                var _dd        = global.GAIP_DASHBOARD_DATA || {};
                var _ddInputs  = _dd.inputs  || {};
                var _ddComp    = _dd.computed || {};
                var _ddTurf    = _ddInputs.turf || {};
                var _ddTissue  = _ddComp.tissue || _ddInputs.tissue || null;
                var _isC4      = (global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.turf && global.GAIP_CANONICAL_STATE.turf.isC4) || false;

                // Nitrogen status — mirrors buildDiseaseInputs() C3/C4 thresholds
                var _nitrogenStatus = { status: 'adequate' };
                if (_ddTissue && _ddTissue.N != null) {
                    var _tissueN = parseFloat(_ddTissue.N);
                    var _nRanges = _isC4
                        ? { deficient: 2.5, low: 3.0, optimal: 3.65, high: 4.3, excessive: 5.0 }
                        : { deficient: 3.0, low: 3.5, optimal: 4.25, high: 5.0, excessive: 5.5 };
                    var _nStat;
                    if (_tissueN < _nRanges.deficient)       _nStat = 'deficient';
                    else if (_tissueN < _nRanges.low)        _nStat = 'low';
                    else if (_tissueN < _nRanges.optimal)    _nStat = 'adequate';
                    else if (_tissueN <= _nRanges.high)      _nStat = 'optimal';
                    else if (_tissueN <= _nRanges.excessive) _nStat = 'high';
                    else                                     _nStat = 'excessive';
                    _nitrogenStatus = { status: _nStat, value: _tissueN, thresholds: _nRanges };
                }

                // Tissue nutrient modifiers — mirrors buildDiseaseInputs() K/Ca/KN logic
                var _tissueNutrients = null;
                if (_ddTissue) {
                    _tissueNutrients = { hasData: true, modifiers: {} };
                    if (_ddTissue.K != null) {
                        var _K = parseFloat(_ddTissue.K);
                        if (_K < (_isC4 ? 1.6 : 2.0))
                            _tissueNutrients.modifiers.K = { status: 'deficient', factor: 1.2, value: _K };
                    }
                    if (_ddTissue.Ca != null) {
                        var _Ca = parseFloat(_ddTissue.Ca);
                        if (_Ca < 0.3)
                            _tissueNutrients.modifiers.Ca = { status: 'deficient', factor: 1.15, value: _Ca };
                    }
                    if (_ddTissue.K != null && _ddTissue.N != null) {
                        var _KN = parseFloat(_ddTissue.K) / parseFloat(_ddTissue.N);
                        if (_KN < 0.6)
                            _tissueNutrients.modifiers.KN_ratio = { status: 'poor', factor: 1.15, value: _KN };
                    }
                }

                var state = {
                    climateMetrics:  climateForForecast,
                    turf: {
                        grassSpecies:    cfg.turfSpecies || _ddTurf.grassSpecies || 'perennialRyegrass',
                        heightOfCut:     _ddTurf.heightOfCut     || null,
                        mowingFrequency: _ddTurf.mowingFrequency || null,
                    },
                    tissue:          _ddTissue,
                    nitrogenStatus:  _nitrogenStatus,
                    tissueNutrients: _tissueNutrients,
                    soilMetrics:     _ddInputs.soil   || null,
                    shadeMetrics:    _ddComp.shade    || null,
                    wearMetrics:     _ddComp.wear     || null,
                    mowingData: {
                        height:    _ddTurf.heightOfCut     || 25,
                        frequency: _ddTurf.mowingFrequency || 'regular',
                    },
                    siteHistory:     _ddComp.siteHistory || _ddInputs.siteHistory || null,
                    region:          cfg.region
                                     || (loc && !isNaN(loc.lat) && !isNaN(loc.lon)
                                         ? (loc.lat < 0 && loc.lon > 165 && loc.lon < 180 ? 'NZ'
                                           : loc.lat < 0 && loc.lon >= 113 && loc.lon <= 165 ? 'AU'
                                           : null)
                                         : null)
                                     || (global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.region)
                                     || 'AU',
                    forecastHourly:  { temperature_2m: hourly.temperature_2m || [] },
                };

                // ── 1. Dew forecast (always, independent of chart) ──────────────
                // Primary: physics engine dailyForecasts.dewHours (prob >= 30%) — matches old hub.
                // Fallback: RH >= 90% per day — matches old hub last-resort (no precipitation).
                // Physics engine writes forecast as an object {dailyForecasts:[...]}, never an array,
                // so the old Array.isArray guard was always true and always ignored the engine.
                {
                    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                    var dewForecast = [];
                    var totalWet = 0, totalDays = 0;
                    var physicsDaily = (global.GAIP_DEW_RESULT &&
                                        global.GAIP_DEW_RESULT.forecast &&
                                        !Array.isArray(global.GAIP_DEW_RESULT.forecast) &&
                                        Array.isArray(global.GAIP_DEW_RESULT.forecast.dailyForecasts))
                                        ? global.GAIP_DEW_RESULT.forecast.dailyForecasts : null;
                    for (var fd = 0; fd < Math.min(numForecastDays, 7); fd++) {
                        var fdStart = fd * hoursPerDay;
                        var wetHrs;
                        if (physicsDaily && physicsDaily[fd] != null) {
                            wetHrs = physicsDaily[fd].dewHours || 0;
                        } else {
                            var fdEnd = Math.min(fdStart + hoursPerDay, rh.length);
                            wetHrs = 0;
                            for (var fh = fdStart; fh < fdEnd; fh++) {
                                if ((rh[fh] || 0) >= 90) wetHrs++;
                            }
                        }
                        var risk = wetHrs >= 8 ? 'high' : wetHrs >= 4 ? 'moderate' : 'low';
                        var dateTs = times[fdStart] ? new Date(times[fdStart]) : new Date(Date.now() + fd * 86400000);
                        var dayLabel = fd === 0 ? 'Today' : fd === 1 ? 'Tomorrow' : dayNames[dateTs.getDay()];
                        dewForecast.push({ label: dayLabel, wetHours: wetHrs, risk: risk });
                        totalWet += wetHrs; totalDays++;
                    }
                    // Write forecast array for renderDewForecastBlock without discarding
                    // leafWetness already set by the physics engine for disease modules.
                    if (!global.GAIP_DEW_RESULT) {
                        global.GAIP_DEW_RESULT = { applicable: true };
                    }
                    global.GAIP_DEW_RESULT.forecast = dewForecast;
                    if (!global.GAIP_DEW_RESULT.leafWetness) {
                        global.GAIP_DEW_RESULT.leafWetness = { averageWetHours: totalDays > 0 ? totalWet / totalDays : 0 };
                    }
                    var dewHtml = renderDewForecastBlock();
                    if (dewHtml) {
                        var tmp = document.createElement('div');
                        tmp.innerHTML = dewHtml;
                        var newNode = tmp.firstChild;
                        var existing = document.getElementById('dr-dew-block');
                        if (existing) {
                            existing.replaceWith(newNode);
                        } else {
                            var glBody = document.querySelector('.gl-body');
                            if (glBody) glBody.appendChild(newNode);
                        }
                    }
                }

                // ── 2. Disease forecast chart (only when placeholder exists) ────
                if (staticChart) return;
                if (typeof global.DiseaseForecast === 'undefined') return;
                var result = global.DiseaseForecast.generateForecast(state);
                if (result.error || !result.diseases || result.diseases.length === 0) {
                    var fw = document.getElementById('dr-forecast-wrap');
                    if (fw) fw.innerHTML = '<div class="gl-block-body" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">No significant disease risk forecast.</div>';
                    return;
                }

                var series = [];
                result.diseases.forEach(function (disease, i) {
                    if (!Array.isArray(disease.forecast) || disease.forecast.length < 2) return;
                    var values = disease.forecast.map(function (f) { return f.risk; });
                    series.push({
                        name:   disease.name,
                        color:  CHART_COLORS[series.length % CHART_COLORS.length],
                        values: values,
                        beta:   !!disease.beta,
                    });
                });
                if (series.length === 0) {
                    var noActiveFw = document.getElementById('dr-forecast-wrap');
                    if (noActiveFw) noActiveFw.innerHTML = '<div class="gl-block-body" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">No significant active threat forecast.</div>';
                    return;
                }

                var activePeak = null;
                series.forEach(function (s) {
                    var peak = Math.max.apply(null, s.values);
                    var day = s.values.indexOf(peak);
                    if (!activePeak || peak > activePeak.peakRisk) {
                        activePeak = {
                            topThreat: s.name,
                            peakRisk: peak,
                            peakDay: day,
                        };
                    }
                });

                var forecastArr = result.diseases[0].forecast;
                var labels      = forecastArr.map(function (f) { return f.day === 0 ? 'Today' : '+' + f.day + 'd'; });
                var chartHtml   = renderForecastChartFromSeries(series, labels, result.forecastDays || forecastArr.length, activePeak);
                _cachedForecastHtml = chartHtml;  // cache so drSelectDisease() can restore without re-fetch
                var wrap = document.getElementById('dr-forecast-wrap');
                if (wrap) {
                    wrap.outerHTML = chartHtml;
                    attachForecastTooltip(renderForecastChartFromSeries._pending);
                }

                // Inject forecast peak KPI card into header grid when peak >> current risk
                var kpiSlot = document.getElementById('dr-forecast-kpi-slot');
                if (kpiSlot && activePeak) {
                    var currentScore = (getDiseaseData() || {}).overallScore;
                    var cardHtml = renderForecastAlertCard(activePeak, currentScore);
                    if (cardHtml) kpiSlot.outerHTML = cardHtml;
                }
            })
            .catch(function () {
                var wrap = document.getElementById('dr-forecast-wrap');
                if (wrap) wrap.innerHTML =
                    '<div class="gl-block-body" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">Forecast unavailable.</div>';
            });
    }

    var _chartSeq = 0;

    function renderForecastChartFromSeries(series, forecastLabels, numDays, peakData) {
        var numPoints = series[0].values.length;
        var days      = numDays || numPoints;
        var chartId   = 'dr-fc-' + (++_chartSeq);

        // Peak text for header
        var peakHtml = '';
        if (peakData && peakData.topThreat && peakData.peakRisk > 0) {
            var peakDay = peakData.peakDay != null ? peakData.peakDay : null;
            var peakStr = 'Peak: <strong>' + esc(peakData.topThreat) + ' ' + Math.round(peakData.peakRisk) + '%</strong>' +
                (peakDay === 0 ? ' today' : peakDay != null ? ' on day ' + peakDay : '');
            peakHtml = '<span class="gl-block-sub" style="margin-left:auto">' + peakStr + '</span>';
        }

        var VW = 620, VH = 190;
        var PL = 52, PR = 16, PT = 14, PB = 36;
        var CW = VW - PL - PR, CH = VH - PT - PB;

        function xPos(i)   { return PL + (numPoints === 1 ? CW / 2 : i * CW / (numPoints - 1)); }
        function yPos(val) { return PT + CH - (val / 100) * CH; }

        // Y-axis: 25%, 50%, 70%, 85% — matching old site
        var gridLines = '';
        [25, 50, 70, 85].forEach(function (pct) {
            var y = yPos(pct);
            gridLines += '<line x1="' + PL + '" y1="' + y + '" x2="' + (PL + CW) + '" y2="' + y +
                '" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,3"/>';
            gridLines += '<text x="' + (PL - 6) + '" y="' + (y + 4) + '" text-anchor="end" ' +
                'font-size="10" fill="#9ca3af">' + pct + '%</text>';
        });

        // Y-axis label "Disease Risk" (rotated)
        var yAxisLabel = '<text x="' + (-VH / 2) + '" y="13" text-anchor="middle" ' +
            'font-size="10" fill="#9ca3af" transform="rotate(-90)">Disease Risk</text>';

        // X-axis labels — show every 2 days
        var xLabels = '';
        var labelEvery = Math.max(1, Math.ceil(numPoints / 5));
        for (var i = 0; i < numPoints; i++) {
            if (i % labelEvery !== 0 && i !== numPoints - 1) continue;
            var lbl = forecastLabels[i] || (i === 0 ? 'Today' : '+' + i + 'd');
            xLabels += '<text x="' + xPos(i) + '" y="' + (VH - 4) + '" text-anchor="middle" font-size="10" fill="#9ca3af">' + esc(lbl) + '</text>';
        }

        // Series lines — dashed for beta
        var seriesSvg = '';
        series.forEach(function (s) {
            var pts = s.values.map(function (v, i) { return xPos(i) + ',' + yPos(v); }).join(' ');
            var dash = s.beta ? ' stroke-dasharray="6,4"' : '';
            seriesSvg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color +
                '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + dash + '/>';
        });

        // Vertical cursor line (shown on hover via JS)
        var cursorLine = '<line id="' + chartId + '-cur" x1="' + PL + '" y1="' + PT + '" x2="' + PL + '" y2="' + (PT + CH) +
            '" stroke="#6b7280" stroke-width="1" stroke-dasharray="3,3" style="display:none" pointer-events="none"/>';

        // Transparent hover overlay for mouse tracking
        var overlay = '<rect id="' + chartId + '-ov" x="' + PL + '" y="' + PT +
            '" width="' + CW + '" height="' + CH + '" fill="transparent" style="cursor:crosshair"/>';

        var svg = '<svg id="' + chartId + '" viewBox="0 0 ' + VW + ' ' + VH +
            '" style="width:100%;height:auto;display:block;overflow:visible" aria-hidden="true">' +
            yAxisLabel + gridLines + xLabels + seriesSvg + cursorLine + overlay + '</svg>';

        // Legend — asterisk for beta
        var legend = '<div class="dr-forecast-legend">';
        series.forEach(function (s) {
            var dashStyle = s.beta
                ? 'background:none;border-top:2px dashed ' + s.color + ';height:0;margin-top:6px'
                : 'background:' + s.color;
            legend += '<div class="dr-forecast-legend-item">' +
                '<span class="dr-forecast-legend-line" style="' + dashStyle + '"></span>' +
                esc(s.name) + (s.beta ? '<sup style="font-size:9px;color:#9ca3af"> *</sup>' : '') +
                '</div>';
        });
        legend += '</div>';

        // Store params for tooltip attachment keyed by chartId
        renderForecastChartFromSeries._pending = {
            chartId: chartId, series: series, forecastLabels: forecastLabels,
            numPoints: numPoints, VW: VW, VH: VH, PL: PL, PR: PR, PT: PT, PB: PB, CW: CW, CH: CH
        };

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '  <div class="gl-block-accent"></div>' +
            '  <div class="gl-block-title">Disease Risk Forecast (' + days + ' days)</div>' +
            '  ' + infoBtn('dr-forecast') +
            peakHtml +
            '</div>' +
            '<div class="gl-block-body">' +
            '  <div class="dr-chart-wrap">' + svg + '</div>' +
            legend +
            '</div>' +
            '</div>';
    }

    function attachForecastTooltip(p) {
        var svg = document.getElementById(p.chartId);
        var ov  = document.getElementById(p.chartId + '-ov');
        var cur = document.getElementById(p.chartId + '-cur');
        if (!svg || !ov) return;

        var wrap = svg.closest('.dr-chart-wrap');
        if (!wrap) return;

        // Tooltip element
        var tip = document.createElement('div');
        tip.className = 'dr-chart-tooltip';
        wrap.appendChild(tip);

        function getActiveDay(e) {
            var rect   = svg.getBoundingClientRect();
            var scaleX = p.VW / rect.width;
            var svgX   = (e.clientX - rect.left) * scaleX;
            if (svgX < p.PL || svgX > p.PL + p.CW) return -1;
            var frac   = (svgX - p.PL) / p.CW;
            return Math.max(0, Math.min(p.numPoints - 1, Math.round(frac * (p.numPoints - 1))));
        }

        ov.addEventListener('mousemove', function (e) {
            var day = getActiveDay(e);
            if (day < 0) { tip.style.display = 'none'; if (cur) cur.style.display = 'none'; return; }

            // Move cursor line
            if (cur) {
                var cx = p.PL + (p.numPoints === 1 ? p.CW / 2 : day * p.CW / (p.numPoints - 1));
                cur.setAttribute('x1', cx);
                cur.setAttribute('x2', cx);
                cur.style.display = '';
            }

            // Build tooltip
            var label = p.forecastLabels[day] || (day === 0 ? 'Today' : '+' + day + 'd');
            var html  = '<div class="dr-chart-tooltip-day">' + esc(label) + '</div>';
            p.series.forEach(function (s) {
                var val = Math.round(s.values[day] || 0);
                html += '<div class="dr-chart-tooltip-row">' +
                    '<span class="dr-chart-tooltip-dot" style="background:' + s.color + '"></span>' +
                    '<span class="dr-chart-tooltip-name">' + esc(s.name) + '</span>' +
                    '<span class="dr-chart-tooltip-val">' + val + '%</span>' +
                    '</div>';
            });
            tip.innerHTML = html;
            tip.style.display = 'block';

            // Position — prefer right of cursor, flip left if too close to edge
            var wrapRect = wrap.getBoundingClientRect();
            var tx = e.clientX - wrapRect.left + 14;
            var ty = e.clientY - wrapRect.top  - tip.offsetHeight / 2;
            if (tx + tip.offsetWidth > wrapRect.width - 4) tx = e.clientX - wrapRect.left - tip.offsetWidth - 14;
            ty = Math.max(4, Math.min(ty, wrapRect.height - tip.offsetHeight - 4));
            tip.style.left = tx + 'px';
            tip.style.top  = ty + 'px';
        });

        ov.addEventListener('mouseleave', function () {
            tip.style.display = 'none';
            if (cur) cur.style.display = 'none';
        });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    function boot() {
        // Pre-populate GAIP_DEW_RESULT from cached analysis so renderDewForecastBlock()
        // has data on first render (initForecastChart sets it again after the async fetch).
        if (!global.GAIP_DEW_RESULT &&
            global.GAIP_DASHBOARD_DATA &&
            global.GAIP_DASHBOARD_DATA.computed &&
            global.GAIP_DASHBOARD_DATA.computed.dew) {
            global.GAIP_DEW_RESULT = global.GAIP_DASHBOARD_DATA.computed.dew;
        }
        renderPage();
        initInfoPopovers();
        initForecastChart();
        // Cascade loads async (600ms + API). Refresh residual block once it's ready.
        setTimeout(refreshResidualBlock, 1200);
        setTimeout(refreshResidualBlock, 2500);
    }

    document.addEventListener('gaip:spray-context-loaded', function() {
        refreshResidualBlock();
    });

    if (!global.GAIP_ANALYSIS_ROUTER) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    }

    global.GAIP_DiseaseAnalysis = { boot: boot };

}(window));
