/**
 * ============================================================================
 * GAIP GROWTH & LIGHT ANALYSIS  v1.0.0
 * ============================================================================
 *
 * Main renderer for /analysis/growth-light.
 * Consolidates Climate/Weather + Growth/Light data from two engines into one
 * unified view.
 *
 * DATA SOURCE: window.GAIP_DASHBOARD_DATA = {
 *   metrics:  window.climateMetrics,       // from climate-engine.js
 *   computed: {
 *     shade:    window.GAIP_SHADE_RESULT,  // from shade-engine.js
 *     soilTemp: window.GAIP_SOIL_TEMP      // from climate-module-v2-ui.js
 *   },
 *   analyzedAt: ISO string
 * }
 *
 * EXPORT: window.GAIP_GrowthLightAnalysis = { render, init }
 * ============================================================================
 */

(function (global) {
    'use strict';

    // =========================================================================
    // CONSTANTS & HELPERS
    // =========================================================================

    var CSS_INJECTED = false;

    function fmt(val, decimals, fallback) {
        if (val === null || val === undefined || isNaN(val)) return fallback !== undefined ? fallback : '—';
        return Number(val).toFixed(decimals !== undefined ? decimals : 0);
    }

    function fmtDate(isoStr) {
        if (!isoStr) return '—';
        try {
            var d = new Date(isoStr);
            return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        } catch (e) { return isoStr; }
    }

    function timeAgo(isoStr) {
        if (!isoStr) return null;
        try {
            var diffMs = Date.now() - new Date(isoStr).getTime();
            var mins = Math.round(diffMs / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return mins + ' min ago';
            var hrs = Math.round(mins / 60);
            return hrs + ' hr ago';
        } catch (e) { return null; }
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function gpColor(pct) {
        if (pct === null || pct === undefined) return '#9ca3af';
        if (pct >= 70) return '#16a34a';
        if (pct >= 40) return '#d97706';
        return '#dc2626';
    }

    function dliColor(status) {
        if (!status) return '#9ca3af';
        switch (status.toLowerCase()) {
            case 'optimal':   return '#16a34a';
            case 'adequate':  return '#d97706';
            case 'deficient': return '#d97706';
            case 'critical':  return '#dc2626';
            default:          return '#9ca3af';
        }
    }

    function statusBadge(label, color) {
        return '<span class="gl-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' + label + '</span>';
    }

    function fungalBadge(cls) {
        var s, c;
        if (cls && typeof cls === 'object') {
            s = cls.severity || cls.label || '';
            c = cls.colour || null;
        } else {
            s = (cls && typeof cls === 'string') ? cls : '';
            c = null;
        }
        var map = { good: '#16a34a', watch: '#d97706', concern: '#ea580c', critical: '#dc2626' };
        var color = c || map[s.toLowerCase()] || '#9ca3af';
        return statusBadge(s ? s.charAt(0).toUpperCase() + s.slice(1) : '—', color);
    }

    function fungalLabel(cls) {
        if (cls && typeof cls === 'object') return cls.label || capitalize(cls.severity) || '—';
        return capitalize(cls) || '—';
    }

    function keyInsight(climateMetrics) {
        var t = (climateMetrics && climateMetrics.temperature && climateMetrics.temperature.todayMean) || 0;
        var heatActive = climateMetrics && climateMetrics.stress && climateMetrics.stress.heat && climateMetrics.stress.heat.days > 0;
        var heatMax = (climateMetrics && climateMetrics.stress && climateMetrics.stress.heat && climateMetrics.stress.heat.maxTemp) || t;
        if (heatActive && heatMax > 30) return 'Heat event forecast (' + Number(heatMax).toFixed(1) + '°C peak) — C3 stress expected.';
        if (t < 10) return 'C4 grasses are dormant — C3 dominant in mixed stands.';
        if (t > 30) return 'C3 grasses are heat-stressed — C4 grasses dominating.';
        if (t >= 15 && t <= 25) return 'Optimal C3 growth range — cool-season grasses thriving.';
        return 'Transition zone — both grass types moderately active.';
    }

    // =========================================================================
    // CSS INJECTION
    // =========================================================================

    function injectCSS() {
        if (CSS_INJECTED) return;
        CSS_INJECTED = true;
        var style = document.createElement('style');
        style.id = 'gl-analysis-styles';
        style.textContent = [
            ':root{--brand:#236b4a;--brand-dark:#185139;--bg:#f5f7f6;--panel:#ffffff;--border:#d8e0dc;--text:#17231f;--muted:#5b6a65}',
            '#gl-page-content{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;color:var(--text);background:var(--bg);padding:0 0 48px}',
            '.gl-header{background:var(--panel);border-bottom:1px solid var(--border);padding:20px 24px 16px}',
            '.gl-header-top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}',
            '.gl-header-title-group{flex:1}',
            '.gl-title{font-size:22px;font-weight:700;color:var(--text);margin:0 0 4px;display:flex;align-items:center;gap:10px}',
            '.gl-validated{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 8px;vertical-align:middle}',
            '.gl-subtitle{font-size:13px;color:var(--muted);margin:0}',
            '.gl-header-kpis{display:flex;gap:12px;flex-wrap:wrap;align-items:center}',
            '.gl-kpi{display:inline-flex;align-items:baseline;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 14px;font-size:20px;font-weight:700}',
            '.gl-kpi-label{font-size:11px;font-weight:400;color:var(--muted)}',
            '.gl-weather-live{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#0ea5e9;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:3px 10px;margin-left:auto}',
            '.gl-body{max-width:1100px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:28px}',
            '.gl-block{background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden}',
            '.gl-block-header{padding:16px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}',
            '.gl-block-accent{width:4px;height:22px;border-radius:2px;background:var(--brand);flex-shrink:0}',
            '.gl-block-title{font-size:16px;font-weight:700;color:var(--text)}',
            '.gl-block-sub{font-size:12px;color:var(--muted);margin-left:auto}',
            '.gl-block-body{padding:20px}',
            '.gl-status-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}',
            '.gl-gp-big{font-size:48px;font-weight:800;line-height:1}',
            '.gl-gp-status{font-size:22px;font-weight:700}',
            '.gl-gp-temp{font-size:14px;color:var(--muted)}',
            '.gl-insight-box{flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:13px;color:#14532d;min-width:200px}',
            '.gl-insight-box.amber{background:#fffbeb;border-color:#fde68a;color:#78350f}',
            '.gl-insight-box.red{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}',
            '.gl-chart-wrap{margin-bottom:20px}',
            '.gl-chart-label{font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:500}',
            'svg.gl-svg{display:block;width:100%;overflow:visible}',
            '.gl-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}',
            '.gl-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px}',
            '.gl-card-label{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}',
            '.gl-card-value{font-size:24px;font-weight:700;color:var(--text)}',
            '.gl-card-sub{font-size:12px;color:var(--muted);margin-top:3px}',
            '.gl-arrow{font-size:24px;color:var(--muted);align-self:center;text-align:center}',
            '.gl-table{width:100%;border-collapse:collapse;font-size:13px}',
            '.gl-table th{text-align:left;font-weight:600;color:var(--muted);padding:6px 10px;border-bottom:1px solid var(--border);font-size:11px;text-transform:uppercase;letter-spacing:.04em}',
            '.gl-table td{padding:7px 10px;border-bottom:1px solid var(--border)}',
            '.gl-table tr:last-child td{border-bottom:none}',
            '.gl-gdd-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border);margin-top:12px;font-size:13px}',
            '.gl-gdd-label{color:var(--muted);font-weight:500}',
            '.gl-trend-box{margin-top:12px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;color:#0c4a6e}',
            '.gl-badge{display:inline-block;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600}',
            '.gl-dli-headline{font-size:32px;font-weight:800;margin-bottom:4px}',
            '.gl-dli-target{font-size:13px;color:var(--muted);margin-bottom:16px}',
            '.gl-three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}',
            '.gl-four-col{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}',
            '.gl-stress-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px}',
            '.gl-stress-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;color:var(--muted)}',
            '.gl-stress-val{font-size:20px;font-weight:700}',
            '.gl-stress-detail{font-size:12px;color:var(--muted);margin-top:4px}',
            '.gl-section-label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:18px 0 10px}',
            '.gl-research-section{border-top:1px solid var(--border);padding-top:16px;margin-top:4px}',
            '.gl-research-title{font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px}',
            '.gl-rec-list{display:flex;flex-direction:column;gap:10px}',
            '.gl-rec{border-radius:8px;padding:12px 16px;font-size:13px;border-left:4px solid}',
            '.gl-rec.critical{background:#fef2f2;border-color:#dc2626;color:#7f1d1d}',
            '.gl-rec.week{background:#fffbeb;border-color:#d97706;color:#78350f}',
            '.gl-rec.monitor{background:#f0fdf4;border-color:#16a34a;color:#14532d}',
            '.gl-rec-priority{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;opacity:.7}',
            '.gl-no-data{color:var(--muted);font-style:italic;padding:20px 0;text-align:center}',
            '.gl-collapse-toggle{cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--brand);font-weight:500;padding:6px 0}',
            '.gl-collapse-toggle::before{content:"▶";font-size:10px;transition:transform .2s}',
            '.gl-collapse-toggle.open::before{transform:rotate(90deg)}',
            '.gl-collapsible{display:none}',
            '.gl-collapsible.open{display:block}',
            '.gl-led-box{margin-top:14px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px}',
            '.gl-led-title{font-size:13px;font-weight:700;color:#78350f;margin-bottom:8px}',
            '.gl-shade-ctx{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;margin-bottom:12px}',
            '.gl-shade-item{font-size:13px}',
            '.gl-shade-item span{color:var(--muted)}',
            '.gl-tabs-bar{display:flex;align-items:stretch;background:#fff;border-bottom:1px solid #d8e0dc;padding:0 24px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}',
            '.gl-tabs-bar::-webkit-scrollbar{display:none}',
            '.gl-tab{display:inline-flex;align-items:center;gap:5px;padding:0 16px;height:42px;font-size:13px;font-weight:500;color:#5b6a65;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;text-decoration:none;transition:color 0.15s,border-color 0.15s}',
            '.gl-tab:hover{color:#17231f;border-bottom-color:#d8e0dc}',
            '.gl-tab.active{color:#236b4a;border-bottom-color:#236b4a;font-weight:600}',
            '.gl-tab-badge{display:inline-flex;align-items:center;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:2px}',
            '.gl-tab-badge.high{background:#fef2f2;color:#dc2626}',
            '.gl-tab-badge.moderate{background:#fffbeb;color:#d97706}',
            '.gl-tab-badge.ok{background:#f0fdf4;color:#16a34a}',
            '.gl-tab-accuracy{margin-left:auto;display:inline-flex;align-items:center;height:42px;font-size:13px;font-weight:700;color:#236b4a;white-space:nowrap}',
            '@media(max-width:768px){',
            '  .gl-two-col,.gl-three-col,.gl-four-col{grid-template-columns:1fr}',
            '  .gl-header-kpis{gap:8px}',
            '  .gl-gp-big{font-size:36px}',
            '  .gl-dli-headline{font-size:24px}',
            '  .gl-body{padding:16px 12px}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // =========================================================================
    // DATA ACCESSORS
    // =========================================================================

    function getData() {
        return global.GAIP_DASHBOARD_DATA || null;
    }

    function buildClimateView(data) {
        var computed = data && data.computed;
        if (!computed) return global.climateMetrics || null;

        var climate  = computed.climate  || {};
        var shade    = computed.shade    || {};
        var stressObj = computed.stress  || {};
        var diseaseObj = computed.disease || {};
        var conf     = computed.confidence || {};

        var growth = climate.growth || shade.growthData || {};
        if (growth.weighted === undefined && growth.weighted !== 0) return global.climateMetrics || null;

        var gp = growth.weighted;
        var gpStatus = gp >= 70 ? 'High' : gp >= 40 ? 'Moderate' : 'Low';

        var stressFactors = Array.isArray(stressObj.factors) ? stressObj.factors : [];
        var heatFactor = null, coldFactor = null, droughtFactor = null;
        stressFactors.forEach(function (f) {
            if (f.type === 'heat')    heatFactor    = f;
            if (f.type === 'cold')    coldFactor    = f;
            if (f.type === 'drought') droughtFactor = f;
        });

        var confScore = (conf.overall && conf.overall.score)
            || (climate._meta && climate._meta.confidence && climate._meta.confidence.score)
            || null;

        return {
            growth: {
                c3:           growth.c3,
                c4:           growth.c4,
                weighted:     gp,
                status:       gpStatus,
                dailyPattern: [],
                gdd:          null
            },
            temperature: {
                todayMean: typeof shade.temperature === 'number' ? shade.temperature : null,
                optimal:   null
            },
            stress: {
                heat:    heatFactor    ? { days: heatFactor.days    || 0, maxTemp: heatFactor.maxTemp    || null } : { days: 0 },
                cold:    coldFactor    ? { days: coldFactor.days    || 0, frostDays: coldFactor.frostDays || 0, minTemp: coldFactor.minTemp || null } : { days: 0, frostDays: 0 },
                drought: droughtFactor || null,
                level:   stressObj.severity || null,
                index:   shade.stressIndex  || null,
                stressClass: shade.stressClass || null,
                factors: stressFactors,
                environmentalStressIndex: stressObj.environmentalStressIndex || null
            },
            disease: {
                riskLevel:    diseaseObj.overallRisk  || null,
                overallScore: diseaseObj.overallScore || null,
                topThreats:   diseaseObj.topThreats   || [],
                diseases:     diseaseObj.diseases     || []
            },
            forecast:   climate.forecast || {},
            historical: {},
            confidence: confScore,
            _meta:      climate._meta || {}
        };
    }

    function getClimate(data) {
        return buildClimateView(data) || global.climateMetrics || null;
    }

    function getShade(data) {
        return (data && data.computed && data.computed.shade) || global.GAIP_SHADE_RESULT || null;
    }

    function getSoilTemp(data) {
        return (data && data.computed && data.computed.soilTemp) || global.GAIP_SOIL_TEMP || null;
    }

    function getSiteName() {
        if (global.currentState && global.currentState.label) return global.currentState.label;
        if (global.currentState && global.currentState.name) return global.currentState.name;
        if (global.currentState && global.currentState.siteName) return global.currentState.siteName;
        return null;
    }

    function getDLI(shade) {
        if (!shade) return null;
        return shade.DLI_total || shade.dliShaded || null;
    }

    // =========================================================================
    // BLOCK — HEADER
    // =========================================================================

    function renderHeader(data, cm, shade) {
        var gp = cm && cm.growth ? cm.growth.weighted : null;
        var gpStatus = cm && cm.growth ? cm.growth.status : null;
        var dli = getDLI(shade);
        var dliStatus = shade ? shade.effectiveStatus : null;
        var insight = keyInsight(cm);
        var insightClass = gp === null ? '' : (gp >= 70 ? '' : (gp >= 40 ? ' amber' : ' red'));

        return [
            '<div class="gl-header">',
            '  <div class="gl-header-top">',
            '    <div class="gl-header-title-group">',
            '      <h1 class="gl-title">Growth Potential &amp; Light Analysis</h1>',
            '      <div class="gl-subtitle">Daily Light Integral (DLI) and Growth Potential (GP) with 14-day trajectory</div>',
            '    </div>',
            '  </div>',
            '  <div class="gl-header-kpis">',
            gp !== null ? '<span class="gl-kpi" style="color:' + gpColor(gp) + '">GP ' + fmt(gp, 0) + '% <span class="gl-kpi-label">' + esc(gpStatus || 'Unknown') + '</span></span>' : '',
            dli !== null ? '<span class="gl-kpi" style="color:' + dliColor(dliStatus) + '">DLI ' + fmt(dli, 1) + ' <span class="gl-kpi-label">mol/m²/day &middot; ' + esc(capitalize(dliStatus || 'Unknown')) + '</span></span>' : '',
            '    <div class="gl-insight-box' + insightClass + '"><strong>Key insight:</strong> ' + esc(insight) + '</div>',
            '    <span class="gl-weather-live">&#9679; Live weather</span>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 1 — GROWTH POTENTIAL
    // =========================================================================

    function renderGrowthBlock(cm) {
        if (!cm) return emptyBlock('Growth Potential', 'No climate data available.');

        var growth = cm.growth || {};
        var temp   = cm.temperature || {};
        var forecast = cm.forecast || {};
        var gp       = growth.weighted;
        var gpStatus = growth.status || 'Unknown';
        var avgTemp  = temp.todayMean;
        var insight  = keyInsight(cm);
        var insightClass = gp >= 70 ? '' : (gp >= 40 ? 'amber' : 'red');
        var dailyPattern = (growth.dailyPattern || []).slice(0, 16);

        // GP trajectory SVG (only if we have forecast data)
        var chartHtml = '';
        if (dailyPattern.length >= 2) {
            chartHtml = '<div class="gl-chart-wrap"><div class="gl-chart-label">14-Day Growth Potential Trajectory (%)</div>' + renderGPLineSvg(dailyPattern) + '</div>';
        }

        // KPI cards — Current / C3 / C4
        var firstDay = dailyPattern[0] || {};
        var lastDay  = dailyPattern[dailyPattern.length - 1] || {};
        var hasOutlook = lastDay.weighted !== undefined;
        var kpiHtml = [
            '<div class="gl-' + (hasOutlook ? 'three' : 'three') + '-col" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:20px">',
            '  <div class="gl-card">',
            '    <div class="gl-card-label">Weighted GP</div>',
            '    <div class="gl-card-value" style="color:' + gpColor(gp) + '">' + fmt(gp, 0, '—') + (gp !== null && gp !== undefined ? '%' : '') + '</div>',
            '    <div class="gl-card-sub">' + esc(gpStatus) + '</div>',
            avgTemp !== null && avgTemp !== undefined ? '<div class="gl-card-sub">' + fmt(avgTemp, 1) + '°C avg temp</div>' : '',
            '  </div>',
            growth.c3 !== undefined && growth.c3 !== null ? [
                '<div class="gl-card">',
                '  <div class="gl-card-label">C3 Cool-season</div>',
                '  <div class="gl-card-value" style="color:' + gpColor(growth.c3) + '">' + fmt(growth.c3, 0) + '%</div>',
                '  <div class="gl-card-sub">Fescue, Rye, Bent</div>',
                '</div>'
            ].join('\n') : '',
            growth.c4 !== undefined && growth.c4 !== null ? [
                '<div class="gl-card">',
                '  <div class="gl-card-label">C4 Warm-season</div>',
                '  <div class="gl-card-value" style="color:' + gpColor(growth.c4) + '">' + fmt(growth.c4, 0) + '%</div>',
                '  <div class="gl-card-sub">Bermuda, Kikuyu, Couch</div>',
                '</div>'
            ].join('\n') : '',
            hasOutlook ? [
                '<div class="gl-card">',
                '  <div class="gl-card-label">8-Day Outlook</div>',
                '  <div class="gl-card-value" style="color:' + gpColor(lastDay.weighted) + '">' + fmt(lastDay.weighted, 0) + '%</div>',
                lastDay.date ? '<div class="gl-card-sub">' + fmtDate(lastDay.date) + '</div>' : '',
                '</div>'
            ].join('\n') : '',
            '</div>'
        ].join('\n');

        // Trend insight from forecast
        var trendHtml = '';
        var tempInsight = forecast.temp ? forecast.temp.insight : null;
        if (tempInsight) {
            trendHtml = '<div class="gl-trend-box"><strong>Trend:</strong> ' + esc(tempInsight) + '</div>';
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent"></div>',
            '    <div class="gl-block-title">Growth Potential</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-status-row">',
            '      <span class="gl-gp-big" style="color:' + gpColor(gp) + '">' + fmt(gp, 0, '—') + (gp !== null && gp !== undefined ? '%' : '') + '</span>',
            '      <span class="gl-gp-status" style="color:' + gpColor(gp) + '">' + esc(gpStatus) + '</span>',
            '      <div class="gl-insight-box ' + insightClass + '"><strong>Key Insight:</strong> ' + esc(insight) + '</div>',
            '    </div>',
            chartHtml,
            kpiHtml,
            trendHtml,
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderGPLineSvg(dailyPattern) {
        var W = 700, H = 200, padL = 40, padR = 16, padT = 20, padB = 40;
        var innerW = W - padL - padR;
        var innerH = H - padT - padB;
        var n = dailyPattern.length;
        var points = dailyPattern.map(function (d, i) {
            var x = padL + (i / (n - 1)) * innerW;
            var y = padT + innerH - clamp((d.weighted || 0) / 100, 0, 1) * innerH;
            return { x: x, y: y, d: d, i: i };
        });

        // Area path
        var pathD = 'M ' + points[0].x + ',' + points[0].y;
        for (var i = 1; i < points.length; i++) pathD += ' L ' + points[i].x + ',' + points[i].y;
        var areaD = pathD + ' L ' + points[points.length - 1].x + ',' + (padT + innerH) + ' L ' + points[0].x + ',' + (padT + innerH) + ' Z';

        // Today marker (index 0)
        var todayX = points[0].x;

        // Y axis lines at 0, 50, 100
        var yLines = [0, 25, 50, 75, 100].map(function (pct) {
            var y = padT + innerH - (pct / 100) * innerH;
            return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e5e7eb" stroke-width="1"/>' +
                '<text x="' + (padL - 5) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#9ca3af">' + pct + '</text>';
        }).join('');

        // X axis date labels (every other)
        var xLabels = points.filter(function (p, i) { return i % 2 === 0; }).map(function (p) {
            return '<text x="' + p.x + '" y="' + (padT + innerH + 16) + '" text-anchor="middle" font-size="10" fill="#9ca3af">' + esc(fmtDate(p.d.date)) + '</text>';
        }).join('');

        // Dots
        var dots = points.map(function (p) {
            var fill = gpColor(p.d.weighted);
            return '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="' + fill + '" stroke="white" stroke-width="1.5"/>';
        }).join('');

        return [
            '<svg class="gl-svg" viewBox="0 0 ' + W + ' ' + H + '" height="200">',
            '<defs><linearGradient id="gp-grad" x1="0" y1="0" x2="0" y2="1">',
            '  <stop offset="0%" stop-color="#236b4a" stop-opacity="0.25"/>',
            '  <stop offset="100%" stop-color="#236b4a" stop-opacity="0.03"/>',
            '</linearGradient></defs>',
            yLines,
            '<path d="' + areaD + '" fill="url(#gp-grad)"/>',
            '<path d="' + pathD + '" fill="none" stroke="#236b4a" stroke-width="2.5" stroke-linejoin="round"/>',
            dots,
            '<line x1="' + todayX + '" y1="' + padT + '" x2="' + todayX + '" y2="' + (padT + innerH) + '" stroke="#236b4a" stroke-width="1.5" stroke-dasharray="4,3" opacity=".5"/>',
            '<text x="' + todayX + '" y="' + (padT - 5) + '" text-anchor="middle" font-size="10" fill="#236b4a" font-weight="600">Today</text>',
            xLabels,
            '</svg>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 2 — LIGHT / DLI
    // =========================================================================

    function renderLightBlock(cm, shade) {
        var dli = getDLI(shade);
        var dliStatus = shade ? shade.effectiveStatus : null;
        var dliTarget = shade ? shade.dliTarget : null;
        var shadePercent = shade ? shade.shadePercent : null;
        var skyView = shade ? shade.skyView : null;
        var seasonal = shade ? shade.seasonalTrajectory : null;
        var led = shade ? shade.ledRecommendation : null;
        var solarDailyTotals = cm && cm.solar ? (cm.solar.dailyTotals || []) : [];
        var color = dliColor(dliStatus);

        // DLI bar chart from solar.dailyTotals or shade pattern
        var dliChartHtml = '';
        if (solarDailyTotals.length >= 2) {
            dliChartHtml = '<div class="gl-chart-wrap"><div class="gl-chart-label">14-Day DLI (mol/m²/day)</div>' + renderDLIBarSvg(solarDailyTotals, dliTarget) + '</div>';
        }

        // Species thresholds from shade
        var speciesHtml = '';
        if (shade && shade.speciesKey) {
            speciesHtml = renderSpeciesThresholds(shade);
        }

        // Shade context
        var shadeCtxHtml = '';
        if (shadePercent !== null && shadePercent !== undefined && shadePercent > 0) {
            shadeCtxHtml = '<div class="gl-shade-ctx">' +
                '<div class="gl-shade-item"><span>Shade Factor:</span> <strong>' + fmt(shadePercent, 0) + '%</strong></div>' +
                (skyView !== null && skyView !== undefined ? '<div class="gl-shade-item"><span>Sky View:</span> <strong>' + fmt(skyView, 2) + '</strong></div>' : '') +
                '</div>';
        }

        // Seasonal trajectory (collapsed)
        var seasonalHtml = '';
        if (seasonal) {
            seasonalHtml = renderSeasonalTrajectory(seasonal);
        }

        // LED recommendation
        var ledHtml = '';
        if (led) {
            if (led.required && led.deficitMol > 0) {
                ledHtml = [
                    '<div class="gl-led-box">',
                    '  <div class="gl-led-title">&#9889; LED Supplementation Recommended</div>',
                    '  <div class="gl-four-col" style="grid-template-columns:repeat(3,1fr);margin-top:10px">',
                    '    <div class="gl-card"><div class="gl-card-label">Deficit</div><div class="gl-card-value">' + fmt(led.deficitMol, 1) + '</div><div class="gl-card-sub">mol/m²/day</div></div>',
                    '    <div class="gl-card"><div class="gl-card-label">Hours / Day</div><div class="gl-card-value">' + fmt(led.hours, 1, '—') + '</div></div>',
                    '    <div class="gl-card"><div class="gl-card-label">Energy</div><div class="gl-card-value">' + fmt(led.kWh, 2, '—') + '</div><div class="gl-card-sub">kWh/day</div></div>',
                    '  </div>',
                    led.warning ? '<div style="margin-top:8px;font-size:12px;color:#78350f">' + esc(led.warning) + '</div>' : '',
                    '</div>'
                ].join('\n');
            } else {
                var ledNote = led.warning || 'Current light levels meet species requirements.';
                ledHtml = [
                    '<div class="gl-led-box" style="background:#f0fdf4;border-color:#bbf7d0">',
                    '  <div class="gl-led-title" style="color:#14532d">&#10003; LED Supplementation Not Required</div>',
                    '  <div style="margin-top:6px;font-size:13px;color:#166534">' + esc(ledNote) + '</div>',
                    '</div>'
                ].join('\n');
            }
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#0ea5e9"></div>',
            '    <div class="gl-block-title">Light / DLI</div>',
            '    <div class="gl-block-sub">Daily Light Integral</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            dli !== null ? '<div class="gl-dli-headline" style="color:' + color + '">' + fmt(dli, 1) + ' mol/m²/day &middot; ' + statusBadge(capitalize(dliStatus || 'Unknown'), color) + '</div>' : '<div class="gl-dli-headline" style="color:#9ca3af">— mol/m²/day</div>',
            dliTarget !== null && dliTarget !== undefined ? '<div class="gl-dli-target">Species target: ' + fmt(dliTarget, 1) + ' mol/m²/day</div>' : '',
            dliChartHtml,
            speciesHtml,
            shadeCtxHtml,
            seasonalHtml,
            ledHtml,
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderDLIBarSvg(dailyTotals, dliTarget) {
        var days = dailyTotals.slice(0, 16);
        var W = 700, H = 160, padL = 40, padR = 16, padT = 16, padB = 36;
        var innerW = W - padL - padR;
        var innerH = H - padT - padB;
        var n = days.length;
        var maxVal = Math.max.apply(null, days.map(function (d) { return d.MJ || 0; }).concat([dliTarget || 0, 20]));
        var barW = Math.max(2, (innerW / n) - 4);

        var bars = days.map(function (d, i) {
            var v = d.MJ || 0;
            var barH = (v / maxVal) * innerH;
            var x = padL + i * (innerW / n) + 2;
            var y = padT + innerH - barH;
            // Status based on target
            var bColor = '#9ca3af';
            if (dliTarget) {
                if (v >= dliTarget) bColor = '#16a34a';
                else if (v >= dliTarget * 0.7) bColor = '#d97706';
                else bColor = '#dc2626';
            }
            return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="2" fill="' + bColor + '" opacity="0.85"/>' +
                '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (padT + innerH + 16) + '" text-anchor="middle" font-size="10" fill="#9ca3af">' + esc(fmtDate(d.date)) + '</text>';
        }).join('');

        // Target dashed line
        var targetLine = '';
        if (dliTarget) {
            var ty = padT + innerH - (dliTarget / maxVal) * innerH;
            targetLine = '<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) + '" stroke="#236b4a" stroke-width="1.5" stroke-dasharray="6,3"/>' +
                '<text x="' + (W - padR - 2) + '" y="' + (ty - 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#236b4a">target</text>';
        }

        // Y axis
        var yAxis = '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + innerH) + '" stroke="#e5e7eb"/>';
        var yLabel = '<text x="8" y="' + (padT + innerH / 2) + '" text-anchor="middle" font-size="10" fill="#9ca3af" transform="rotate(-90 8 ' + (padT + innerH / 2) + ')">mol/m²</text>';

        return [
            '<svg class="gl-svg" viewBox="0 0 ' + W + ' ' + H + '" height="160">',
            yAxis, yLabel, bars, targetLine,
            '</svg>'
        ].join('\n');
    }

    function renderSpeciesThresholds(shade) {
        var rows = [
            ['Species / Mode', esc(shade.speciesKey || '—')],
            ['Min DLI', fmt(shade.minDLI !== undefined ? shade.minDLI : (shade.dliThresholds && shade.dliThresholds.min), 1, '—') + ' mol/m²/day'],
            ['Optimal DLI', fmt(shade.dliTarget, 1, '—') + ' mol/m²/day'],
            ['Status', shade.effectiveStatus ? capitalize(shade.effectiveStatus) : '—'],
        ];
        return '<div class="gl-section-label">Species Thresholds</div>' + renderSimpleTable(['Parameter', 'Value'], rows);
    }

    function renderSeasonalTrajectory(seasonal) {
        var toggleId = 'gl-seasonal-toggle';
        var contentId = 'gl-seasonal-content';
        var items = [];
        if (seasonal.peakMonth !== undefined) items.push('Peak month: <strong>Month ' + seasonal.peakMonth + '</strong>');
        if (seasonal.troughMonth !== undefined) items.push('Trough month: <strong>Month ' + seasonal.troughMonth + '</strong>');
        if (seasonal.stressMonths && seasonal.stressMonths.length) items.push('Stress months: <strong>' + seasonal.stressMonths.join(', ') + '</strong>');
        if (seasonal.renovationMonths && seasonal.renovationMonths.length) items.push('Renovation window: <strong>' + seasonal.renovationMonths.join(', ') + '</strong>');
        if (seasonal.range !== undefined) items.push('Annual DLI range: <strong>' + fmt(seasonal.range, 1) + ' mol/m²/day</strong>');

        return [
            '<div class="gl-research-section">',
            '<div class="gl-collapse-toggle" id="' + toggleId + '" onclick="(function(t){var c=document.getElementById(\'' + contentId + '\');c.classList.toggle(\'open\');t.classList.toggle(\'open\');})(this)">Seasonal Trajectory</div>',
            '<div class="gl-collapsible" id="' + contentId + '">',
            '<ul style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.8">' + items.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>',
            '</div>',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 3 — TEMPERATURE STRESSES
    // =========================================================================

    function renderStressBlock(cm, soilTemp) {
        var stress = cm ? (cm.stress || {}) : {};
        var heat   = stress.heat   || {};
        var cold   = stress.cold   || {};
        var stressClass = stress.stressClass || null;
        var stressIndex = stress.index;
        var factors = stress.factors || [];

        // Overall stress card (from shade engine)
        var overallColor = stressClass ? (stressClass.colour || '#9ca3af') : '#9ca3af';
        var overallLabel = stressClass ? stressClass.label : (stress.level ? capitalize(stress.level) : null);
        var overallCard = [
            '<div class="gl-stress-card" style="border-top:3px solid ' + overallColor + '">',
            '  <div class="gl-stress-label">Overall Stress</div>',
            overallLabel ? '<div class="gl-stress-val" style="color:' + overallColor + '">' + esc(overallLabel) + '</div>' : '<div class="gl-stress-val">—</div>',
            stressIndex !== null && stressIndex !== undefined ? '<div class="gl-stress-detail">Index: ' + fmt(stressIndex, 0) + '</div>' : '',
            stress.environmentalStressIndex ? '<div class="gl-stress-detail">ESI: ' + fmt(stress.environmentalStressIndex, 1) + '</div>' : '',
            '</div>'
        ].join('\n');

        // Shade stress factors
        var shadeFactor = factors.filter(function (f) { return f.type === 'shade'; })[0] || null;
        var shadeCard = [
            '<div class="gl-stress-card" style="border-top:3px solid ' + (shadeFactor ? '#a855f7' : '#9ca3af') + '">',
            '  <div class="gl-stress-label">Shade Stress</div>',
            shadeFactor ? [
                '<div class="gl-stress-val" style="color:#a855f7">' + fmt(shadeFactor.deficitPct || shadeFactor.severity * 100, 0) + '% deficit</div>',
                '<div class="gl-stress-detail">' + esc(shadeFactor.status || '') + '</div>',
                shadeFactor.note ? '<div class="gl-stress-detail" style="font-size:11px">' + esc(shadeFactor.note) + '</div>' : ''
            ].join('\n') : '<div class="gl-stress-detail">No shade stress</div>',
            '</div>'
        ].join('\n');

        // Heat stress card
        var heatCard = renderStressCard('Heat Stress',
            heat.days > 0 ? [
                heat.days + ' day' + (heat.days !== 1 ? 's' : '') + ' forecast',
                heat.maxTemp ? 'Peak: ' + fmt(heat.maxTemp, 1) + '°C' : ''
            ].filter(Boolean) : ['None detected'],
            heat.days > 0 ? '#dc2626' : '#9ca3af');

        // Cold card
        var coldCard = renderStressCard('Cold & Frost',
            cold.days > 0 || cold.frostDays > 0 ? [
                cold.days ? cold.days + ' cold day' + (cold.days !== 1 ? 's' : '') : '',
                cold.frostDays ? cold.frostDays + ' frost day' + (cold.frostDays !== 1 ? 's' : '') : '',
                cold.minTemp !== undefined ? 'Min: ' + fmt(cold.minTemp, 1) + '°C' : ''
            ].filter(Boolean) : ['None detected'],
            cold.frostDays > 0 ? '#0ea5e9' : '#9ca3af');

        // Soil Temperature Profile
        var soilHtml = '';
        if (soilTemp && soilTemp.summary && soilTemp.summary.depths) {
            soilHtml = renderSoilProfile(soilTemp);
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#f97316"></div>',
            '    <div class="gl-block-title">Stress Conditions</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-four-col">',
            overallCard, shadeCard, heatCard, coldCard,
            '    </div>',
            soilHtml,
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderStressCard(title, lines, accentColor) {
        var color = accentColor || '#9ca3af';
        var content = lines && lines.length ?
            lines.map(function (l) { return '<div class="gl-stress-detail">' + esc(l) + '</div>'; }).join('') :
            '<div class="gl-stress-detail">—</div>';
        return [
            '<div class="gl-stress-card" style="border-top:3px solid ' + color + '">',
            '  <div class="gl-stress-label">' + esc(title) + '</div>',
            content,
            '</div>'
        ].join('\n');
    }

    function renderSoilProfile(soilTemp) {
        var depths = soilTemp.summary.depths || {};
        var profileType = soilTemp.profileType || null;
        var depthKeys = [
            { key: 'd20mm', label: '20 mm' },
            { key: 'd50mm', label: '50 mm' },
            { key: 'd100mm', label: '100 mm' },
            { key: 'd200mm', label: '200 mm' },
        ];
        var cards = depthKeys.map(function (dk) {
            var d = depths[dk.key];
            if (!d) return '<div class="gl-card"><div class="gl-card-label">' + dk.label + '</div><div class="gl-card-value">—</div></div>';
            return [
                '<div class="gl-card">',
                '<div class="gl-card-label">' + dk.label + '</div>',
                '<div class="gl-card-value">' + fmt(d.mean !== undefined ? d.mean : d.current, 1, '—') + '°C</div>',
                d.current !== undefined && d.mean !== undefined ? '<div class="gl-card-sub">Now: ' + fmt(d.current, 1) + '°C &middot; Mean: ' + fmt(d.mean, 1) + '°C</div>' : '',
                '</div>'
            ].join('\n');
        }).join('');

        return [
            '<div class="gl-section-label">Soil Temperature Profile' + (profileType ? ' &mdash; ' + esc(profileType) : '') + '</div>',
            '<div class="gl-four-col">', cards, '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 4 — RESEARCH GUIDANCE
    // =========================================================================

    function renderResearchBlock(shade) {
        if (!shade) return '';

        var sections = [];

        // Fungal Risk
        if (shade.fungalClass) {
            sections.push(renderFungalSection(shade));
        }

        // Recovery Window
        if (shade.recoveryWindow) {
            sections.push(renderRecoverySection(shade.recoveryWindow));
        }

        // N Adjustment (only if shaded)
        var sp = shade.shadePercent;
        if (shade.nAdjustment && sp !== null && sp !== undefined && sp > 0) {
            sections.push(renderNAdjSection(shade.nAdjustment));
        }

        // Mowing Guidance
        if (shade.mowingGuidance && sp !== null && sp !== undefined && sp > 0) {
            sections.push(renderMowingSection(shade.mowingGuidance));
        }

        // PGR Warning
        if (shade.pgrGuidance) {
            sections.push(renderPGRSection(shade.pgrGuidance));
        }

        if (!sections.length) return '';

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#7c3aed"></div>',
            '    <div class="gl-block-title">Research Guidance</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            sections.join('\n'),
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderFungalSection(shade) {
        var risk = shade.fungalRisk !== undefined ? fmt(shade.fungalRisk, 0) + '/100' : '—';
        var cls = shade.fungalClass;
        var clsColor = (cls && typeof cls === 'object' && cls.colour) ? cls.colour : '#9ca3af';
        return [
            '<div class="gl-research-section">',
            '<div class="gl-research-title">Fungal Risk ' + fungalBadge(cls) + '</div>',
            '<div class="gl-two-col">',
            '<div class="gl-card"><div class="gl-card-label">Risk Score</div><div class="gl-card-value">' + risk + '</div></div>',
            '<div class="gl-card"><div class="gl-card-label">Class</div><div class="gl-card-value" style="color:' + clsColor + '">' + fungalLabel(cls) + '</div></div>',
            '</div>',
            '</div>'
        ].join('\n');
    }

    function renderRecoverySection(rw) {
        var flagColor = rw.severity === 'good' ? '#16a34a' : rw.severity === 'watch' ? '#d97706' : '#9ca3af';
        var flagLabel = rw.flag || rw.class || '—';
        return [
            '<div class="gl-research-section">',
            '<div class="gl-research-title">Recovery Window ' + statusBadge(flagLabel, flagColor) + '</div>',
            rw.detail ? '<div class="gl-card" style="margin-bottom:12px"><div class="gl-card-sub">' + esc(rw.detail) + '</div></div>' : '',
            renderSimpleTable(['', ''], [
                ['Window', esc((rw.windowStart || '—') + ' – ' + (rw.windowEnd || '—'))],
            ]),
            '</div>'
        ].join('\n');
    }

    function renderNAdjSection(nAdj) {
        return [
            '<div class="gl-research-section">',
            '<div class="gl-research-title">Nitrogen Adjustment</div>',
            renderSimpleTable(['Parameter', 'Value'], [
                ['Reduction', fmt(nAdj.reductionPct, 0, '—') + (nAdj.reductionPct !== undefined ? '%' : '')],
                ['Application Factor', fmt(nAdj.factor, 2, '—')],
            ]),
            '</div>'
        ].join('\n');
    }

    function renderMowingSection(mow) {
        return [
            '<div class="gl-research-section">',
            '<div class="gl-research-title">Mowing Height</div>',
            renderSimpleTable(['Parameter', 'Value'], [
                ['Current HOC', fmt(mow.currentHOC, 0, '—') + (mow.currentHOC !== undefined ? ' mm' : '')],
                ['Recommended HOC', fmt(mow.recommendedHOC, 0, '—') + (mow.recommendedHOC !== undefined ? ' mm' : '')],
                ['Max Shade Tolerance', fmt(mow.maxShade, 0, '—') + (mow.maxShade !== undefined ? '%' : '')],
            ]),
            '</div>'
        ].join('\n');
    }

    function renderPGRSection(pgr) {
        var sevColor = pgr.severity === 'critical' ? '#dc2626' : (pgr.severity === 'caution' ? '#d97706' : '#236b4a');
        var message = pgr.warning || pgr.recommendation || '—';
        var rows = [];
        if (pgr.suspend) rows.push(['Suspend PGR', 'Yes — do not apply']);
        if (pgr.reference) rows.push(['Reference', esc(pgr.reference)]);
        return [
            '<div class="gl-research-section">',
            '<div class="gl-research-title">PGR Guidance ' + statusBadge(capitalize(pgr.severity || 'Good'), sevColor) + '</div>',
            '<div class="gl-card" style="margin-bottom:' + (rows.length ? '12px' : '0') + '"><div class="gl-card-sub">' + esc(message) + '</div></div>',
            rows.length ? renderSimpleTable(['', ''], rows) : '',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 5 — RECOMMENDATIONS
    // =========================================================================

    function renderRecommendations(cm, shade) {
        var recs = collectRecommendations(cm, shade);

        if (!recs.length) {
            return [
                '<div class="gl-block">',
                '  <div class="gl-block-header">',
                '    <div class="gl-block-accent" style="background:#236b4a"></div>',
                '    <div class="gl-block-title">Recommendations</div>',
                '  </div>',
                '  <div class="gl-block-body">',
                '    <div class="gl-no-data">Run analysis first to see recommendations.</div>',
                '  </div>',
                '</div>'
            ].join('\n');
        }

        var critical = recs.filter(function (r) { return r.priority === 'critical'; });
        var week = recs.filter(function (r) { return r.priority === 'week'; });
        var monitor = recs.filter(function (r) { return r.priority === 'monitor'; });

        function recHtml(r) {
            var cls = r.priority === 'critical' ? 'critical' : (r.priority === 'week' ? 'week' : 'monitor');
            var label = r.priority === 'critical' ? 'Critical' : (r.priority === 'week' ? 'This Week' : 'Monitor');
            return '<div class="gl-rec ' + cls + '"><div class="gl-rec-priority">' + label + '</div>' + esc(r.text) + '</div>';
        }

        var allHtml = critical.concat(week, monitor).map(recHtml).join('\n');

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#236b4a"></div>',
            '    <div class="gl-block-title">Recommendations</div>',
            '    <div class="gl-block-sub">' + recs.length + ' action' + (recs.length !== 1 ? 's' : '') + '</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-rec-list">', allHtml, '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function collectRecommendations(cm, shade) {
        var recs = [];
        var growth = cm ? (cm.growth || {}) : {};
        var stress = cm ? (cm.stress || {}) : {};
        var gp = growth.weighted;
        var heat = stress.heat || {};
        var cold = stress.cold || {};

        // GP-based
        if (gp !== null && gp !== undefined) {
            if (gp < 40) {
                recs.push({ priority: 'critical', text: 'Growth potential is critically low (' + fmt(gp, 0) + '%). Defer aggressive cultural practices. Focus on stress recovery.' });
            } else if (gp < 70) {
                recs.push({ priority: 'week', text: 'Growth potential is moderate (' + fmt(gp, 0) + '%). Reduce nitrogen applications and monitor recovery.' });
            } else {
                recs.push({ priority: 'monitor', text: 'Growth potential is good (' + fmt(gp, 0) + '%). Maintain current program.' });
            }
        }

        // Heat stress
        if (heat.days > 0) {
            var msg = 'Heat event forecast (' + heat.days + ' day' + (heat.days !== 1 ? 's' : '') + ', peak ' + fmt(heat.maxTemp, 1) + '°C). Increase irrigation frequency and reduce traffic.';
            recs.push({ priority: heat.maxTemp > 35 ? 'critical' : 'week', text: msg });
        }

        // Cold / frost
        if (cold.frostDays > 0) {
            recs.push({ priority: 'week', text: 'Frost risk detected (' + cold.frostDays + ' day' + (cold.frostDays !== 1 ? 's' : '') + ', min ' + fmt(cold.minTemp, 1) + '°C). Avoid mowing or traffic during frost events.' });
        }

        // Shade / DLI
        if (shade) {
            var dliStatus = shade.effectiveStatus;
            var dli = getDLI(shade);
            if (dliStatus === 'critical') {
                recs.push({ priority: 'critical', text: 'DLI critically deficient (' + fmt(dli, 1) + ' mol/m²/day). Consider canopy management or LED supplementation.' });
            } else if (dliStatus === 'deficient') {
                recs.push({ priority: 'week', text: 'DLI below species minimum (' + fmt(dli, 1) + ' mol/m²/day). Review shading sources and reduce nitrogen load.' });
            }

            // PGR caution
            if (shade.pgrGuidance && shade.pgrGuidance.severity === 'critical') {
                recs.push({ priority: 'critical', text: 'PGR Warning: ' + (shade.pgrGuidance.warning || 'Avoid PGR application under current light deficit.') });
            } else if (shade.pgrGuidance && shade.pgrGuidance.warning) {
                recs.push({ priority: 'week', text: 'PGR Caution: ' + shade.pgrGuidance.warning });
            }

            // Fungal risk
            if (shade.fungalClass === 'critical') {
                recs.push({ priority: 'critical', text: 'Fungal risk is critical. Apply preventative fungicide and improve air circulation.' });
            } else if (shade.fungalClass === 'concern') {
                recs.push({ priority: 'week', text: 'Fungal risk is elevated. Monitor canopy moisture and consider curative application.' });
            }

            // Mowing HOC
            if (shade.mowingGuidance && shade.mowingGuidance.recommendedHOC && shade.mowingGuidance.currentHOC) {
                var diff = shade.mowingGuidance.recommendedHOC - shade.mowingGuidance.currentHOC;
                if (diff > 0) {
                    recs.push({ priority: 'week', text: 'Raise mowing height to ' + shade.mowingGuidance.recommendedHOC + ' mm (currently ' + shade.mowingGuidance.currentHOC + ' mm) to support leaf area under shade.' });
                }
            }

            // N reduction
            if (shade.nAdjustment && shade.nAdjustment.reductionPct > 0 && shade.shadePercent > 0) {
                recs.push({ priority: 'monitor', text: 'Reduce nitrogen application by ' + fmt(shade.nAdjustment.reductionPct, 0) + '% due to light deficit (factor: ' + fmt(shade.nAdjustment.factor, 2) + ').' });
            }
        }

        return recs;
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function capitalize(str) {
        if (!str || typeof str !== 'string') return '—';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function emptyBlock(title, msg) {
        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent"></div>',
            '    <div class="gl-block-title">' + esc(title) + '</div>',
            '  </div>',
            '  <div class="gl-block-body"><div class="gl-no-data">' + esc(msg) + '</div></div>',
            '</div>'
        ].join('\n');
    }

    function renderSimpleTable(headers, rows) {
        var thead = '<thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead>';
        var tbody = '<tbody>' + rows.map(function (row) {
            return '<tr>' + row.map(function (cell) { return '<td>' + (cell !== null && cell !== undefined ? cell : '—') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>';
        return '<table class="gl-table">' + thead + tbody + '</table>';
    }

    // =========================================================================
    // MAIN RENDER
    // =========================================================================

    function render(container) {
        if (!container) return;

        injectCSS();

        var data = getData();
        var cm = getClimate(data);
        var shade = getShade(data);
        var soilTemp = getSoilTemp(data);

        var html = [
            renderHeader(data, cm, shade),
            '<div class="gl-body">',
            renderGrowthBlock(cm),
            renderLightBlock(cm, shade),
            renderStressBlock(cm, soilTemp),
            renderResearchBlock(shade),
            renderRecommendations(cm, shade),
            '</div>'
        ].join('\n');

        container.innerHTML = html;

        // --- Topbar: analysis timestamp ---
        var tsEl = document.getElementById('db-analysis-ts');
        if (tsEl && data && data.analyzedAt) {
            try {
                var d = new Date(data.analyzedAt);
                tsEl.textContent = 'Analysis: ' + d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
            } catch (e) {}
        }

        // --- Notification bar ---
        var notice = document.getElementById('db-analysis-notice');
        var noticeText = document.getElementById('db-analysis-notice-text');
        var noticeDismiss = document.getElementById('db-analysis-notice-dismiss');
        if (notice && noticeText) {
            var msg = null;
            if (!data || !cm) {
                msg = 'No analysis data found — run analysis from the hub to populate this page.';
                notice.className = 'db-verdict warning';
            } else if (data.analyzedAt) {
                var ageMs = Date.now() - new Date(data.analyzedAt).getTime();
                var ageDays = ageMs / (1000 * 60 * 60 * 24);
                if (ageDays > 2) {
                    msg = 'Analysis data is ' + Math.floor(ageDays) + ' days old — re-run for the latest conditions.';
                    notice.className = 'db-verdict warning';
                }
            }
            if (msg) {
                noticeText.textContent = msg;
                notice.hidden = false;
                if (noticeDismiss) {
                    noticeDismiss.onclick = function () { notice.hidden = true; };
                }
            }
        }

        // --- Tab badges (Disease Risk, Stress) from climate data ---
        if (cm) {
            var diseaseBadge = document.getElementById('gl-badge-disease');
            var stressBadge = document.getElementById('gl-badge-stress');
            var accEl = document.getElementById('gl-tab-accuracy');

            if (diseaseBadge) {
                var disease = cm.disease || {};
                var diseaseRisk = disease.riskLevel || null;
                if (diseaseRisk) {
                    diseaseBadge.textContent = diseaseRisk.charAt(0).toUpperCase() + diseaseRisk.slice(1);
                    diseaseBadge.className = 'gl-tab-badge ' + (diseaseRisk === 'high' ? 'high' : diseaseRisk === 'moderate' ? 'moderate' : 'ok');
                    diseaseBadge.hidden = false;
                }
            }
            if (stressBadge) {
                var stress = cm.stress || {};
                var stressLevel = stress.level || null;
                if (stressLevel) {
                    stressBadge.textContent = stressLevel.charAt(0).toUpperCase() + stressLevel.slice(1);
                    stressBadge.className = 'gl-tab-badge ' + (stressLevel === 'high' ? 'high' : stressLevel === 'moderate' ? 'moderate' : 'ok');
                    stressBadge.hidden = false;
                }
            }
            if (accEl && cm.confidence) {
                accEl.textContent = 'Accuracy ' + fmt(cm.confidence, 0) + '%';
                accEl.hidden = false;
            }
        }
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function initRerun() {
        var btn = document.getElementById('db-rerun-btn');
        if (!btn) return;

        // Inject spin keyframe once
        if (!document.getElementById('db-spin-style')) {
            var s = document.createElement('style');
            s.id = 'db-spin-style';
            s.textContent = '@keyframes db-spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(s);
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (btn.dataset.running === '1') return;
            btn.dataset.running = '1';
            btn.disabled = true;
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:db-spin 0.8s linear infinite"><path d="M4 12a8 8 0 018-8v4l4-4-4-4v4a10 10 0 100 10"/></svg> Running…';

            var iframe = document.createElement('iframe');
            iframe.src = '/hub';
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
            iframe.setAttribute('aria-hidden', 'true');
            document.body.appendChild(iframe);

            var done = false;
            function finish() {
                if (done) return;
                done = true;
                try { document.body.removeChild(iframe); } catch (e) {}
                window.location.reload();
            }

            window.addEventListener('message', function onMsg(e) {
                if (e.data === 'gilba:analysis-complete') {
                    window.removeEventListener('message', onMsg);
                    finish();
                }
            });

            setTimeout(finish, 30000);
        });
    }

    function init() {
        var el = document.getElementById('gl-page-content');
        if (el) {
            render(el);
        }
        initRerun();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    global.GAIP_GrowthLightAnalysis = { render: render, init: init };

}(window));
