/* Disease Risk Analysis Page
 * Layout: alert bar → master-detail split → forecast chart → application window
 */
(function (global) {
    'use strict';

    // ── Styles ───────────────────────────────────────────────────────────────

    var style = document.createElement('style');
    style.textContent = [
        /* info icon */
        '.db-info-icon{display:inline-flex;width:15px;height:15px;border-radius:50%;background:#eef2f0;color:#6b8878;font-size:10px;font-weight:700;font-style:italic;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;user-select:none;border:none;line-height:1;vertical-align:middle}',
        '.db-info-icon:hover{background:#ccd9d2;color:#1a2b23}',
        /* header panel (shared pattern with growth-light) */
        '.gl-header{background:#fff;border-bottom:1px solid #d8e0dc;padding:0}',
        '.gl-header-inner{max-width:1100px;margin:0 auto;padding:18px 20px}',
        '.gl-title{font-size:18px;font-weight:700;color:#17231f;margin:0 0 2px}',
        '.gl-subtitle{font-size:12px;color:#5b6a65;margin:0 0 16px}',
        '.gl-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:4px}',
        '@media(max-width:700px){.gl-kpi-grid{grid-template-columns:1fr}}',
        '.gl-kpi-card{border-radius:8px;padding:14px 18px 13px;border:1px solid #d8e0dc;border-left-width:4px}',
        '.gl-kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#5b6a65;margin-bottom:8px}',
        '.gl-kpi-value{font-size:36px;font-weight:800;line-height:1;margin-bottom:4px}',
        '.gl-kpi-unit{font-size:12px;color:#5b6a65;margin-bottom:2px}',
        '.gl-weather-live{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#16a34a;flex-shrink:0}',
        /* layout */
        '.gl-body{max-width:1100px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:20px}',
        '.gl-block{background:var(--panel,#fff);border:1px solid var(--border,#d8e0dc);border-radius:10px;overflow:hidden}',
        '.gl-block-header{padding:16px 20px 12px;border-bottom:1px solid var(--border,#d8e0dc);display:flex;align-items:center;gap:10px}',
        '.gl-block-accent{width:4px;height:22px;border-radius:2px;background:var(--brand,#236b4a);flex-shrink:0}',
        '.gl-block-title{font-size:16px;font-weight:700;color:var(--text,#17231f)}',
        '.gl-block-sub{font-size:12px;color:var(--muted,#5b6a65);margin-left:auto}',
        '.gl-block-body{padding:20px}',
        '.gl-section-label{font-size:11px;font-weight:700;color:var(--muted,#5b6a65);text-transform:uppercase;letter-spacing:.05em;margin:16px 0 10px;display:flex;align-items:center;gap:4px}',
        '.gl-section-label:first-child{margin-top:0}',
        '.gl-section-sep{border:none;border-top:1px solid var(--border,#d8e0dc);margin:16px 0}',
        '.gl-rec-list{display:flex;flex-direction:column;gap:10px}',
        '.gl-rec{border-radius:8px;padding:12px 16px;font-size:13px;border-left:4px solid;line-height:1.5}',
        '.gl-rec.critical{background:#fef2f2;border-color:#dc2626;color:#7f1d1d}',
        '.gl-rec.week{background:#fff7ed;border-color:#f97316;color:#7c2d12}',
        '.gl-rec.monitor{background:#f0fdf4;border-color:#16a34a;color:#14532d}',
        '.gl-rec-priority{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;opacity:.7}',
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
        return '<button class="db-info-icon" data-info="' + key + '" tabindex="0" aria-label="Learn more" onclick="event.stopPropagation()">i</button>';
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
        var diseaseObj = computed.disease || {};
        return {
            riskLevel:         diseaseObj.overallRisk  || diseaseObj.riskLevel  || null,
            overallScore:      diseaseObj.overallScore != null ? diseaseObj.overallScore : null,
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
            '<span style="font-size:20px;flex-shrink:0">🚨</span>' +
            '<span class="dr-alert-name">' + esc(names) + ' — Severe risk' +
                (score != null ? ' (' + score + '%)' : '') + '</span>' +
            '<span class="dr-alert-action">Action required</span>' +
            '</div>';
    }

    // ── Render: left panel ────────────────────────────────────────────────────

    function renderLeft(d, selected) {
        var c        = riskColor(d.riskLevel);
        var score    = d.overallScore != null ? Math.round(d.overallScore) : null;
        var diseases = filterDiseases(d.diseases.length ? d.diseases : d.topThreats);
        var html     = '';

        // Overall risk hero
        html += '<div class="gl-block" style="background:' + c.bg + ';border-color:' + c.border + ';margin-bottom:16px">';
        html += '  <div class="gl-block-body">';
        html += '    <div class="gl-section-label" style="color:' + c.text + ';margin-top:0">Overall Disease Risk ' + infoBtn('dr-overall') + '</div>';
        html += '    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
        html += '      <span style="font-size:36px;font-weight:800;color:' + c.badge + ';line-height:1">' +
                        (score != null ? score + '%' : (capitalize(d.riskLevel) || '—')) + '</span>';
        html += '      ' + riskBadge(d.riskLevel);
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
            Object.keys(drivers).forEach(function (key) {
                var dv      = drivers[key];
                var contrib = dv.contribution != null ? Math.round(dv.contribution) : null;
                var val     = dv.value != null ? dv.value : null;
                var label   = driverLabel(key);
                if (contrib == null && val == null) return;
                var barColor = contrib >= 70 ? '#ef4444' : contrib >= 40 ? '#f97316' : '#eab308';
                html += '<div style="margin-bottom:12px">';
                html += '  <div style="display:flex;justify-content:space-between;margin-bottom:4px">';
                html += '    <span style="font-size:12px;color:#374151">' + esc(label) + '</span>';
                html += '    <span style="font-size:12px;font-weight:600;color:#17231f">';
                if (val != null) html += esc(String(val));
                if (contrib != null) html += (val != null ? ' · ' : '') + contrib + '% contribution';
                html += '    </span>';
                html += '  </div>';
                if (contrib != null) {
                    html += '  <div class="dr-driver-bar"><div class="dr-driver-fill" style="width:' +
                            Math.min(contrib, 100) + '%;background:' + barColor + '"></div></div>';
                }
                html += '</div>';
            });
            html += '<hr class="gl-section-sep">';
        }

        // Recommendation
        var rec = disease.recommendation;
        if (rec) {
            var action   = (rec.action || '').toLowerCase();
            var headline = rec.headline || rec.text || '';
            var timing   = rec.timing  || '';
            var products = Array.isArray(rec.products) ? rec.products : [];
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

    var CHART_COLORS = ['#ef4444', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#eab308', '#64748b'];

    function buildForecastSeries(diseases, forecastArr) {
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

        // Global forecast array: [{day, label, diseases:{name: score}}] or [{day, scores:{name: score}}]
        if (forecastArr.length > 1) {
            var diseaseNames = {};
            forecastArr.forEach(function (pt) {
                var scores = pt.diseases || pt.scores || {};
                Object.keys(scores).forEach(function (k) { diseaseNames[k] = true; });
            });
            var colorIdx = 0;
            Object.keys(diseaseNames).slice(0, 5).forEach(function (key) {
                var values = forecastArr.map(function (pt) {
                    var scores = pt.diseases || pt.scores || {};
                    return Math.min(100, Math.max(0, Number(scores[key]) || 0));
                });
                series.push({ name: driverLabel(key), color: CHART_COLORS[colorIdx++ % CHART_COLORS.length], values: values });
            });
            return series;
        }

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

        var series     = buildForecastSeries(diseases, d.forecast);
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

    // ── Render: page header (summary KPI panel) ───────────────────────────────

    function renderDiseaseHeader(d, diseases) {
        var score   = d.overallScore != null ? Math.round(d.overallScore) : null;
        var level   = d.riskLevel || 'none';
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
            '      <span class="gl-weather-live" style="margin-left:auto">&#9679; Live weather</span>',
            '    </div>',
            '    <div class="gl-subtitle">Disease pressure, pathogen models and spray timing</div>',
            '    <div class="gl-kpi-grid">',
            cards.join(''),
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // ── Render: recommendations block ─────────────────────────────────────────

    function renderDiseaseRecommendations(diseases) {
        if (!diseases || diseases.length === 0) {
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

        var items = [];
        diseases.forEach(function (disease) {
            var name  = disease.displayName || disease.disease || disease.name || 'Unknown';
            var level = (disease.riskLevel || disease.level || '').toLowerCase();
            var rec   = disease.recommendation;

            var action, headline, timing;
            if (rec) {
                action   = (rec.action || '').toLowerCase();
                headline = rec.headline || rec.text || '';
                timing   = rec.timing || '';
            } else {
                action   = (level === 'severe' || level === 'high') ? 'curative' : level === 'moderate' ? 'preventive' : 'monitor';
                headline = '';
                timing   = '';
            }

            var cls      = ACTION_REC_CLASS[action] || 'monitor';
            var icon     = ACTION_ICON[action] || '✓';
            var products = rec && Array.isArray(rec.products) && rec.products.length ? rec.products : [];

            items.push(
                '<div class="gl-rec ' + cls + '">' +
                '<div class="gl-rec-priority">' + esc(name) + '</div>' +
                icon + ' ' + capitalize(rec ? (rec.action || 'Monitor') : action) +
                (timing ? ' <span style="font-weight:400;opacity:.75">· ' + esc(timing) + '</span>' : '') +
                (headline ? '<div style="margin-top:4px;opacity:.85">' + esc(headline) + '</div>' : '') +
                (products.length ? '<div style="margin-top:4px;font-size:12px;opacity:.8"><strong>Products:</strong> ' + esc(products.join(', ')) + '</div>' : '') +
                '</div>'
            );
        });

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent"></div>',
            '    <div class="gl-block-title">Recommendations</div>',
            '    <div class="gl-block-sub">' + items.length + ' action' + (items.length !== 1 ? 's' : '') + '</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-rec-list">',
            items.join('\n'),
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // ── State & render ────────────────────────────────────────────────────────

    var _selectedIdx = 0;
    var _diseases    = [];

    global.drSelectDisease = function (idx) {
        _selectedIdx = idx;
        renderPage();
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

        container.innerHTML =
            headerHtml +
            '<div class="gl-body">' +
            recsHtml +
            (alertHtml ? alertHtml : '') +
            '<div class="dr-split">' +
            '  <div id="dr-left">'  + renderLeft(d, _selectedIdx) + '</div>' +
            '  <div id="dr-right">' + renderRight(selectedDisease) + '</div>' +
            '</div>' +
            forecastHtml +
            appHtml +
            '</div>';

        // Update analysis timestamp
        var ts = data && data.analyzedAt;
        if (ts) {
            var el = document.getElementById('db-analysis-ts');
            if (el) {
                var d2 = new Date(ts);
                el.textContent = 'Analysis: ' +
                    d2.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' ' +
                    d2.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
            }
        }
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    function boot() {
        renderPage();
        initInfoPopovers();
    }

    if (!global.GAIP_ANALYSIS_ROUTER) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    }

    global.GAIP_DiseaseAnalysis = { boot: boot };

}(window));
