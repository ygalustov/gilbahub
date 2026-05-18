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

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function gpColor(pct) {
        if (pct === null || pct === undefined) return '#9ca3af';
        if (pct >= 70) return '#16a34a';
        if (pct >= 40) return '#d97706';
        return '#dc2626';
    }

    function dliColor(status) {
        if (!status) return '#9ca3af';
        switch (status.toLowerCase().split('(')[0].trim()) {
            case 'optimal':    return '#16a34a';
            case 'adequate':   return '#65a30d';
            case 'suboptimal': return '#d97706';
            case 'marginal':   return '#ea580c';
            case 'deficient':  return '#dc2626';
            case 'critical':   return '#9f1239';
            default:           return '#9ca3af';
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

    function keyInsight(climateMetrics, grassType) {
        var t = (climateMetrics && climateMetrics.temperature && climateMetrics.temperature.todayMean) || 0;
        var heatActive = climateMetrics && climateMetrics.stress && climateMetrics.stress.heat && climateMetrics.stress.heat.days > 0;
        var heatMax = (climateMetrics && climateMetrics.stress && climateMetrics.stress.heat && climateMetrics.stress.heat.maxTemp) || t;
        var gt = grassType || 'mixed';

        // Returns {text, color, bg, border}
        function ins(text, tone) {
            var palettes = {
                green:  { color: '#14532d', bg: '#f0fdf4', border: '#bbf7d0' },
                amber:  { color: '#78350f', bg: '#fffbeb', border: '#fde68a' },
                orange: { color: '#7c2d12', bg: '#fff7ed', border: '#fed7aa' },
                red:    { color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
                blue:   { color: '#1e3a5f', bg: '#eff6ff', border: '#bfdbfe' },
                grey:   { color: '#374151', bg: '#f9fafb', border: '#e5e7eb' }
            };
            return Object.assign({ text: text }, palettes[tone] || palettes.grey);
        }

        if (heatActive && heatMax > 30) {
            if (gt === 'c4') return ins('Heat event forecast (' + Number(heatMax).toFixed(1) + '°C peak) — monitor warm-season grass for heat stress.', 'orange');
            return ins('Heat event forecast (' + Number(heatMax).toFixed(1) + '°C peak) — cool-season grass growth will slow significantly.', 'red');
        }

        if (gt === 'c3') {
            if (t > 30)        return ins('Heat stress — growth has nearly stopped.', 'red');
            if (t >= 25)       return ins('Warm conditions — grass growth is slowing.', 'orange');
            if (t >= 15)       return ins('Optimal conditions — expect strong growth.', 'green');
            if (t >= 10)       return ins('Cool conditions — growth is slower, improving as it warms.', 'amber');
            if (t >= 5)        return ins('Cold — growth is very slow.', 'blue');
            return ins('Very cold — growth has nearly stopped.', 'blue');
        }

        if (gt === 'c4') {
            if (t > 38)        return ins('Extreme heat — growth is starting to suffer.', 'red');
            if (t >= 28)       return ins('Optimal conditions — expect strong growth.', 'green');
            if (t >= 20)       return ins('Warm conditions — growth is picking up.', 'amber');
            if (t >= 10)       return ins('Cool conditions — warm-season grass growth is suppressed.', 'blue');
            return ins('Cold — grass is dormant.', 'blue');
        }

        // Mixed
        if (t > 30)            return ins('Heat stress — cool-season varieties struggling, warm-season growing well.', 'red');
        if (t >= 25)           return ins('Warm conditions — cool-season growth slowing, warm-season thriving.', 'orange');
        if (t >= 15)           return ins('Optimal conditions — cool-season grass growing well, warm-season moderate.', 'green');
        if (t >= 10)           return ins('Cool conditions — both types growing slowly.', 'amber');
        return ins('Cold — warm-season grass dormant, cool-season growing slowly.', 'blue');
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
            '.gl-header{background:var(--panel);border-bottom:1px solid var(--border);padding:0}',
            '.gl-header-inner{max-width:1100px;margin:0 auto;padding:18px 20px}',
            '.gl-title{font-size:18px;font-weight:700;color:var(--text);margin:0 0 2px}',
            '.gl-subtitle{font-size:12px;color:var(--muted);margin:0 0 16px}',
            '.gl-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}',
            '.gl-kpi-card{border-radius:8px;padding:14px 18px 13px;border:1px solid var(--border);border-left-width:4px}',
            '.gl-kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;gap:4px}',
            '.gl-kpi-value{font-size:36px;font-weight:800;line-height:1;margin-bottom:4px}',
            '.gl-kpi-unit{font-size:12px;color:var(--muted);margin-bottom:2px}',
            '.gl-kpi-status{font-size:11px;font-weight:700;display:inline-block;padding:2px 8px;border-radius:20px;letter-spacing:.03em}',
            '.gl-kpi-insight{padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;display:flex;align-items:flex-start;gap:8px}',
            '.gl-weather-live{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#16a34a;flex-shrink:0}',
            '.db-info-icon{display:inline-flex;width:15px;height:15px;border-radius:50%;background:#eef2f0;color:#6b8878;font-size:10px;font-weight:700;font-style:italic;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;user-select:none;border:none;line-height:1;vertical-align:middle}',
            '.db-info-icon:hover{background:#ccd9d2;color:#1a2b23}',
            '.gl-body{max-width:1100px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:28px}',
            '.gl-block{background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden}',
            '.gl-soil-mini{display:flex;align-items:center;gap:0;border-top:1px solid var(--border);margin-top:16px;padding-top:14px;flex-wrap:wrap;row-gap:8px}',
            '.gl-soil-mini-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-right:16px;flex-shrink:0;align-self:center}',
            '.gl-soil-mini-item{display:flex;flex-direction:column;align-items:center;padding:0 14px;border-right:1px solid var(--border)}',
            '.gl-soil-mini-item:last-of-type{border-right:none}',
            '.gl-soil-mini-depth{font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}',
            '.gl-soil-mini-val{font-size:18px;font-weight:800}',
            '.gl-soil-mini-status{font-size:11px;color:var(--muted);margin-left:auto;align-self:center;padding-left:16px}',
            '.gl-reno-box{border-radius:8px;padding:12px 16px;display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}',
            '.gl-reno-icon{font-size:22px;line-height:1;flex-shrink:0}',
            '.gl-reno-status{font-size:14px;font-weight:700;margin-bottom:3px}',
            '.gl-reno-detail{font-size:13px;line-height:1.5}',
            '.gl-block-header{padding:16px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}',
            '.gl-block-accent{width:4px;height:22px;border-radius:2px;background:var(--brand);flex-shrink:0}',
            '.gl-block-title{font-size:16px;font-weight:700;color:var(--text)}',
            '.gl-block-sub{font-size:12px;color:var(--muted);margin-left:auto}',
            '.gl-conf-badge{margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;border:1.5px solid;background:transparent;letter-spacing:.02em}',
            '.gl-block-body{padding:20px}',
            '.gl-status-row{display:flex;align-items:stretch;gap:16px;flex-wrap:wrap;margin-bottom:20px}',
            '.gl-gp-big{font-size:32px;font-weight:800;line-height:1;display:flex;align-items:center}',
            '.gl-mixed-banner{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#f0f9f4;border:1px solid #c3dfd0;border-radius:8px;font-size:13px;color:#1a3a2a;margin-bottom:12px;flex-wrap:wrap}',
            '.gl-mixed-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;background:#236b4a;color:#fff;border-radius:4px;padding:2px 7px;flex-shrink:0}',
            '.gl-mixed-sep{color:#9ca3af;margin:0 2px}',
            '.gl-dual-insight{display:flex;flex-direction:column;gap:6px;flex:1;min-width:200px}',
            '.gl-gp-status{font-size:11px;font-weight:700;display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;letter-spacing:.03em}',
            '.gl-gp-temp{font-size:14px;color:var(--muted)}',
            '.gl-insight-box{flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:13px;color:#14532d;min-width:200px}',
            '.gl-insight-box.amber{background:#fffbeb;border-color:#fde68a;color:#78350f}',
            '.gl-insight-box.red{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}',
            '.gl-chart-wrap{margin-bottom:20px}',
            '.gl-chart-label{font-size:12px;color:var(--muted);margin-bottom:14px;font-weight:500;text-align:center}',
            'svg.gl-svg{display:block;width:100%;overflow:visible}',
            '.gl-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}',
            '.gl-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px}',
            '.gl-card-label{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}',
            '.gl-card-value{font-size:20px;font-weight:700;color:var(--text)}',
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
            '.gl-dli-headline{font-size:22px;font-weight:700;margin-bottom:4px}',
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
            '.gl-hero-row{display:flex;gap:24px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap}',
            '.gl-hero-left{flex:0 0 auto;min-width:180px;display:flex;flex-direction:column;gap:10px}',
            '.gl-hero-right{flex:1;min-width:240px}',
            '.gl-hero-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:2px}',
            '.gl-gp-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap}',
            '.gl-gp-row-left{flex:0 0 auto;min-width:160px}',
            '.gl-gp-row-right{flex:1;min-width:200px;display:flex;flex-direction:column;gap:6px;justify-content:center}',
            '.gl-section-sep{border:none;border-top:1px solid var(--border);margin:20px 0}',
            '.gl-avg-summary{display:flex;align-items:flex-start;gap:24px;padding:16px;background:var(--bg);border-radius:8px;border:1px solid var(--border);margin-bottom:16px;flex-wrap:wrap}',
            '.gl-day-strip{display:flex;gap:6px;margin-bottom:16px}',
            '.gl-day-chip{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:44px;flex:1;padding:8px 6px;border-radius:8px;background:var(--bg);border:1px solid var(--border);flex-shrink:0}',
            '.gl-day-chip-today{background:#f0f9f4;border-color:#c3dfd0}',
            '.gl-day-chip-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}',
            '.gl-day-chip-today .gl-day-chip-label{color:var(--brand)}',
            '.gl-day-chip-bar-wrap{width:24px;height:36px;display:flex;align-items:flex-end;justify-content:center}',
            '.gl-day-chip-bar{width:18px;border-radius:2px 2px 0 0;min-height:3px}',
            '.gl-day-chip-val{font-size:11px;font-weight:700}',
            '.gl-day-chip-temp{font-size:10px;color:var(--muted)}',
            '.gl-conf-dots{position:relative}',
            '.gl-conf-dots::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1f2937;color:#f9fafb;font-size:11px;font-weight:500;padding:5px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:100;line-height:1.4}',
            '.gl-conf-dots::before{content:"";position:absolute;bottom:calc(100% + 1px);left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1f2937;pointer-events:none;opacity:0;transition:opacity .15s;z-index:100}',
            '.gl-conf-dots:hover::after,.gl-conf-dots:hover::before{opacity:1}',
            '@media(max-width:768px){',
            '  .gl-two-col,.gl-three-col,.gl-four-col{grid-template-columns:1fr}',
            '  .gl-header-inner{padding:14px 12px}',
            '  .gl-kpi-grid{grid-template-columns:1fr;gap:8px}',
            '  .gl-kpi-value{font-size:28px}',
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

        // Orchestrator stores growth under 'growthPotential'; legacy path uses 'growth'
        var growth = climate.growth || climate.growthPotential || shade.growthData || {};
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

        // dailyPattern from climate.growth.dailyPattern (calculateGrowthMetrics output)
        // Format already matches renderDailyStrip: {date, temp, weighted, c3, c4}
        var dailyPattern = (climate.growth && Array.isArray(climate.growth.dailyPattern) && climate.growth.dailyPattern.length > 0)
                           ? climate.growth.dailyPattern : [];

        // Trend text from forecast.temp.insight (calculateForecastInsights output)
        var trendInsight = (climate.forecast && climate.forecast.temp && climate.forecast.temp.insight)
                           ? climate.forecast.temp.insight : null;

        var liveCm = global.climateMetrics;
        var todayTemp = typeof shade.temperature === 'number'
                        ? shade.temperature
                        : (climate.temperature ? climate.temperature.todayMean
                          : (liveCm && liveCm.temperature ? liveCm.temperature.todayMean : null));

        return {
            growth: {
                c3:           growth.c3,
                c4:           growth.c4,
                weighted:     gp,
                status:       gpStatus,
                dailyPattern: dailyPattern,
                gdd:          null
            },
            temperature: {
                todayMean: todayTemp,
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
            forecast:   { temp: { insight: trendInsight } },
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

    // =========================================================================
    // INFO POPOVER GLOSSARY
    // =========================================================================

    var GL_GLOSSARY = {
        'gl-gp': {
            title: '16-Day Average Growth Potential',
            body:  'Growth Potential (GP) is a 0–100% index of how favourable current temperature and moisture conditions are for your grass to grow. A high GP means the turf is in its ideal growth window; a low GP means growth has slowed or stalled.\n\nThis figure is the average GP across the full 16-day weather forecast — smoothing out single-day spikes to reveal the underlying trend: whether growth is building or easing over the coming weeks. Use it to plan fertiliser applications, overseeding, and recovery work.'
        },
        'gl-gp-today': {
            title: 'Current Growth Potential',
            body:  'Growth potential at today\'s current air temperature. Cool-season grasses grow best around 20°C, warm-season grasses around 31°C. This value reflects conditions right now and may differ from the forecast average if warmer or cooler weather is on the way.'
        },
        'gl-c3c4': {
            title: 'C3 vs C4 Grass Types',
            body:  'All grasses are classified by their photosynthesis pathway. C3 (cool-season) grasses — bentgrass, fescue, ryegrass, poa — grow best at 15–25°C and struggle in summer heat. C4 (warm-season) grasses — bermuda, kikuyu, couch, zoysia — thrive at 28–35°C and go dormant when soil temperature drops below ~10°C. The bell curve shows how growth potential changes with temperature for your specific grass type.'
        },
        'gl-dli': {
            title: 'Daily Light Integral (DLI)',
            body:  'Total photosynthetically active light received per day, measured in mol/m²/day. Most turfgrass needs 20–35 mol/m²/day. Below the species threshold = slower growth, weaker roots, higher disease risk.'
        },
        'gl-shade': {
            title: 'Shade Status',
            body:  'How much sunlight reaches the turf surface after obstruction from trees, buildings or structures. Ranges from Optimal (full sun) through Adequate → Suboptimal → Marginal → Deficient → Critical as shading increases.'
        },
        'gl-shade-optimal': {
            title: 'Shade: Optimal',
            body:  'Full sun — turf is receiving excellent light with no shade restriction. Ideal conditions for growth, recovery and root development.'
        },
        'gl-shade-adequate': {
            title: 'Shade: Adequate',
            body:  'Minor shading present but light levels are sufficient for healthy growth and recovery. No intervention needed.'
        },
        'gl-shade-suboptimal': {
            title: 'Shade: Suboptimal',
            body:  'Moderate shading is reducing available light below the ideal range. Expect slower growth, reduced turf density and slower recovery from wear. Consider canopy thinning or supplemental LED lighting.'
        },
        'gl-shade-marginal': {
            title: 'Shade: Marginal',
            body:  'Light is borderline adequate — just below the threshold where measurable growth impact begins. Recovery from stress or divots will be noticeably slow. Canopy management is recommended.'
        },
        'gl-shade-deficient': {
            title: 'Shade: Deficient',
            body:  'Heavy shading is significantly limiting photosynthesis. Turf will struggle to recover and disease pressure is elevated. Canopy reduction or LED supplementation is strongly recommended.'
        },
        'gl-shade-critical': {
            title: 'Shade: Critical',
            body:  'Severe shade is preventing adequate photosynthesis — turf survival is at risk. Immediate canopy management and/or LED supplementation is required.'
        },
        'gl-c3': {
            title: 'C3 Species Growth Potential',
            body:  'Growth potential for the C3 (cool-season) component of the stand, calculated at current temperature. C3 grasses — bentgrass, fescue, ryegrass, poa — peak at ~20°C and slow sharply above 28°C. This value represents their theoretical maximum at today\'s conditions.'
        },
        'gl-c4': {
            title: 'C4 Species Growth Potential',
            body:  'Growth potential for the C4 (warm-season) component of the stand, calculated at current temperature. C4 grasses — bermuda, kikuyu, couch, zoysia — peak at ~31°C and go dormant below ~10°C. In cooler months this value will be near 0%.'
        },
        'gl-weighted': {
            title: 'Overall Growth Potential',
            body:  'Blended growth potential for the whole stand, weighted by the proportion of C3 and C4 grass present. Formula: (C3 GP × C3 fraction) + (C4 GP × C4 fraction). This is the headline number that best represents actual turf performance across the mixed stand.'
        }
    };

    function initInfoPopovers() {
        var popover  = document.getElementById('db-info-popover');
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');
        if (!popover) return;

        var currentAnchor = null;

        function showPopover(anchor) {
            var entry = GL_GLOSSARY[anchor.dataset.info];
            if (!entry) return;
            popTitle.textContent = entry.title;
            popBody.textContent  = entry.body;
            popover.style.visibility = 'hidden';
            popover.style.display    = 'block';

            var rect  = anchor.getBoundingClientRect();
            var pw    = popover.offsetWidth;
            var ph    = popover.offsetHeight;
            var viewW = window.innerWidth;
            var viewH = window.innerHeight;

            var left = Math.round(rect.left + rect.width / 2 - pw / 2);
            left = Math.max(8, Math.min(left, viewW - pw - 8));

            var top, flipped = false;
            if (rect.bottom + 10 + ph > viewH - 8) {
                top = Math.round(rect.top - 10 - ph);
                flipped = true;
            } else {
                top = Math.round(rect.bottom + 10);
            }

            popover.style.left       = left + 'px';
            popover.style.top        = top  + 'px';
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

        function hidePopover() {
            popover.style.display = 'none';
            currentAnchor = null;
        }

        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) {
                e.stopPropagation();
                if (currentAnchor === icon) { hidePopover(); } else { showPopover(icon); }
                return;
            }
            if (!popover.contains(e.target)) hidePopover();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hidePopover();
        });

        if (popClose) popClose.addEventListener('click', function (e) {
            e.stopPropagation();
            hidePopover();
        });
    }

    function infoBtn(key) {
        return '<button class="db-info-icon" data-info="' + key + '" tabindex="0" aria-label="Learn more">i</button>';
    }

    function getDLI(shade) {
        if (!shade) return null;
        return shade.DLI_total || shade.dliShaded || null;
    }

    // =========================================================================
    // BLOCK — HEADER
    // =========================================================================

    function renderHeader(cm, shade) {
        var gp        = cm && cm.growth ? cm.growth.weighted : null;
        var gpStatus  = cm && cm.growth ? cm.growth.status   : null;
        var dli       = getDLI(shade);
        var dliStatus = shade ? shade.effectiveStatus : null;
        var shadeShort = dliStatus ? dliStatus.split('(')[0].trim() : null;

        function hexToRgb(hex) {
            var h = hex.replace('#', '');
            return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
        }

        function kpiCard(label, value, unit, statusText, color, infoKey) {
            var rgb = hexToRgb(color);
            var bg     = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.07)';
            var border = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.25)';
            return [
                '<div class="gl-kpi-card" style="background:' + bg + ';border-color:' + border + ';border-left-color:' + color + '">',
                '  <div class="gl-kpi-label">' + label + ' ' + infoBtn(infoKey) + '</div>',
                '  <div class="gl-kpi-value" style="color:' + color + '">' + value + '</div>',
                unit       ? '  <div class="gl-kpi-unit">' + unit + '</div>' : '',
                statusText ? '  <div class="gl-kpi-status">' + statusBadge(statusText, color) + '</div>' : '',
                '</div>'
            ].join('\n');
        }

        var cards = [];
        if (gp !== null) {
            cards.push(kpiCard('16-Day Avg GP', fmt(gp, 0) + '%', '', esc(gpStatus || ''), gpColor(gp), 'gl-gp'));
        }
        if (dli !== null) {
            cards.push(kpiCard('Light (DLI)', fmt(dli, 1), 'mol/m²/day', esc(dliStatus || ''), dliColor(dliStatus), 'gl-dli'));
        }
        if (shadeShort) {
            var shadeKey = 'gl-shade';
            var shadeStatuses = ['suboptimal','deficient','critical','marginal','adequate','optimal'];
            var sl = dliStatus ? dliStatus.toLowerCase().split('(')[0].trim() : '';
            for (var si = 0; si < shadeStatuses.length; si++) {
                if (sl === shadeStatuses[si]) { shadeKey = 'gl-shade-' + shadeStatuses[si]; break; }
            }
            cards.push(kpiCard('Shade Status', esc(shadeShort), '', '', dliColor(dliStatus), shadeKey));
        }

        return [
            '<div class="gl-header">',
            '  <div class="gl-header-inner">',
            '    <div style="display:flex;align-items:center;margin-bottom:2px">',
            '      <h1 class="gl-title">Growth Potential &amp; Light Analysis</h1>',
            '      <span class="gl-weather-live" style="margin-left:auto">&#9679; Live weather</span>',
            '    </div>',
            '    <div class="gl-subtitle">Current growing conditions, light availability and temperature outlook</div>',
            '    <div class="gl-kpi-grid">',
            cards.join('\n'),
            '    </div>',
            '',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 1 — GROWTH POTENTIAL
    // =========================================================================

    var C3_KEYS = ['bent','bentgrass','fescue','ryegrass','rye','poa','bluegrass','kentucky','creeping','annual'];
    var C4_KEYS = ['bermuda','couch','kikuyu','zoysia','buffalo','st aug','paspalum','seashore','warm'];

    function detectGrassType(shade) {
        var cfg = global.GAIP_HUB_CONFIG || {};
        var methodology = (cfg.turfMethodology || '').toLowerCase();

        // Explicit mixed/overseeded always wins
        if (methodology === 'mixed' || methodology === 'overseeded') return 'mixed';

        // Pure stand: trust methodology, then fall back to species name
        if (methodology === 'c3') return 'c3';
        if (methodology === 'c4') return 'c4';
        var speciesKey = (cfg.turfSpecies || (shade && shade.speciesKey) || '').toLowerCase();
        for (var i = 0; i < C3_KEYS.length; i++) { if (speciesKey.indexOf(C3_KEYS[i]) !== -1) return 'c3'; }
        for (var i = 0; i < C4_KEYS.length; i++) { if (speciesKey.indexOf(C4_KEYS[i]) !== -1) return 'c4'; }
        return 'mixed';
    }

    function renderGrowthBlock(cm, soilTemp, shade) {
        if (!cm) return emptyBlock('Growth Potential', 'No climate data available.');

        var growth = cm.growth || {};
        var temp   = cm.temperature || {};
        var gp       = growth.weighted;
        var gpStatus = growth.status || 'Unknown';
        var avgTemp  = temp.todayMean;
        var grassType = detectGrassType(shade);
        var dailyPattern = (growth.dailyPattern || []).slice(0, 16);
        var cfg = global.GAIP_HUB_CONFIG || {};
        var speciesLabel = cfg.turfSpecies ? capitalize(cfg.turfSpecies) : (shade && shade.speciesKey ? capitalize(shade.speciesKey) : null);
        var tempPrefix = avgTemp !== null && avgTemp !== undefined ? '<strong>' + fmt(avgTemp, 1) + '°C</strong> &mdash; ' : '';

        // Species banner — shown for all grass types
        var mixedBannerHtml = '';
        if (grassType === 'mixed') {
            var c3pct = cfg.percentC3Cover != null ? Math.round(cfg.percentC3Cover) : null;
            var c4pct = c3pct != null ? 100 - c3pct : null;
            mixedBannerHtml = [
                '<div class="gl-mixed-banner">',
                '  <span class="gl-mixed-tag">Mixed stand</span>',
                c3pct != null
                    ? '  <span>' + c3pct + '% ' + esc(speciesLabel || 'cool-season') + ' &mdash; cool-season grass</span><span class="gl-mixed-sep">·</span><span>' + c4pct + '% warm-season grass</span>'
                    : '  <span>' + esc(speciesLabel || 'Cool-season') + ' &mdash; cool-season grass</span><span class="gl-mixed-sep">·</span><span>Warm-season grass</span>',
                '</div>'
            ].join('');
        } else if (speciesLabel) {
            var seasonTag = grassType === 'c4' ? 'C4 warm-season grass' : 'C3 cool-season grass';
            mixedBannerHtml = [
                '<div class="gl-mixed-banner" style="background:#f5f7f6;border-color:#d8e0dc;margin-bottom:20px">',
                '  <span style="font-weight:600;color:#17231f">' + esc(speciesLabel) + '</span>',
                '  <span class="gl-mixed-sep">·</span>',
                '  <span style="color:#5b6a65">' + seasonTag + '</span>',
                '</div>'
            ].join('');
        }

        // Today's GP value
        var todayVal, todayColor;
        if (grassType === 'c3') {
            todayVal = growth.c3 != null ? growth.c3 : gp;
        } else if (grassType === 'c4') {
            todayVal = growth.c4 != null ? growth.c4 : gp;
        } else {
            todayVal = gp;
        }
        todayColor = gpColor(todayVal);

        // Today left: number + badge
        var todayLeftHtml;
        if (grassType === 'mixed') {
            var c3v = growth.c3 != null ? growth.c3 : 0;
            var c4v = growth.c4 != null ? growth.c4 : 0;
            todayLeftHtml = [
                '<div class="gl-hero-section-label">Current Growth Potential</div>',
                '<div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-top:4px">',
                '  <div>',
                '    <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:2px">' + esc(speciesLabel || 'C3') + '</div>',
                '    <span class="gl-gp-big" style="color:' + gpColor(c3v) + '">' + fmt(c3v, 0, '—') + '%</span>',
                '  </div>',
                '  <div>',
                '    <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:2px">C4 warm-season</div>',
                '    <span class="gl-gp-big" style="color:' + gpColor(c4v) + '">' + fmt(c4v, 0, '—') + '%</span>',
                '  </div>',
                '</div>'
            ].join('\n');
        } else {
            todayLeftHtml = [
                '<div class="gl-hero-section-label">Current Growth Potential ' + infoBtn('gl-gp-today') + '</div>',
                '<div style="display:flex;align-items:center;gap:10px;margin-top:4px">',
                '  <span class="gl-gp-big" style="color:' + todayColor + '">' + fmt(todayVal, 0, '—') + (todayVal != null ? '%' : '') + '</span>',
                '  ' + statusBadge(esc(gpStatus), todayColor),
                '</div>'
            ].join('\n');
        }

        // Today right: insight
        var todayRightHtml;
        if (grassType === 'mixed') {
            var insC3 = keyInsight(cm, 'c3');
            var insC4 = keyInsight(cm, 'c4');
            todayRightHtml = [
                '<div class="gl-insight-box" style="background:' + insC3.bg + ';border-color:' + insC3.border + ';color:' + insC3.color + '">' + tempPrefix + esc(insC3.text) + '</div>',
                '<div class="gl-insight-box" style="background:' + insC4.bg + ';border-color:' + insC4.border + ';color:' + insC4.color + '">' + tempPrefix + esc(insC4.text) + '</div>'
            ].join('\n');
        } else {
            var insight = keyInsight(cm, grassType);
            todayRightHtml = '<div class="gl-insight-box" style="background:' + insight.bg + ';border-color:' + insight.border + ';color:' + insight.color + '">' + tempPrefix + esc(insight.text) + '</div>';
        }

        // SECTION 1: Today row + bell curve
        var todaySectionHtml = [
            '<div class="gl-gp-row">',
            '  <div class="gl-gp-row-left">' + todayLeftHtml + '</div>',
            '  <div class="gl-gp-row-right">' + todayRightHtml + '</div>',
            '</div>',
            renderBellCurve(cm, shade, grassType)
        ].join('\n');

        // SECTION 2: 16-day average row + daily chips
        var avgSectionHtml = '';
        if (gp != null) {
            // GP trend: compare today's GP to the forecast average
            var trendRightHtml = '';
            if (dailyPattern.length > 1) {
                var todayGP = grassType === 'c3' ? (dailyPattern[0].c3 != null ? dailyPattern[0].c3 : dailyPattern[0].weighted) :
                              grassType === 'c4' ? (dailyPattern[0].c4 != null ? dailyPattern[0].c4 : dailyPattern[0].weighted) :
                              dailyPattern[0].weighted;
                var forecastSum = 0, forecastCount = 0;
                for (var fi = 1; fi < dailyPattern.length; fi++) {
                    var fv = grassType === 'c3' ? (dailyPattern[fi].c3 != null ? dailyPattern[fi].c3 : dailyPattern[fi].weighted) :
                             grassType === 'c4' ? (dailyPattern[fi].c4 != null ? dailyPattern[fi].c4 : dailyPattern[fi].weighted) :
                             dailyPattern[fi].weighted;
                    if (fv != null) { forecastSum += fv; forecastCount++; }
                }
                var forecastAvg = forecastCount > 0 ? forecastSum / forecastCount : null;
                if (todayGP != null && forecastAvg != null) {
                    var delta = Math.round(forecastAvg - todayGP);
                    var absChange = Math.abs(delta);
                    var isC4 = grassType === 'c4';
                    var species = isC4 ? 'warm-season' : 'cool-season';
                    var trendText, trendBg, trendBorder, trendColor;
                    if (delta >= 5) {
                        trendText = absChange >= 15
                            ? 'Significant improvement expected (+' + delta + '% GP) - excellent ' + species + ' growth conditions ahead'
                            : 'Conditions improving (+' + delta + '% GP) - growth will increase over the forecast period';
                        trendBg = '#f0fdf4'; trendBorder = '#86efac'; trendColor = '#166534';
                    } else if (delta <= -5) {
                        trendText = absChange >= 15
                            ? 'Significant decline expected (' + delta + '% GP) - prepare for reduced ' + species + ' growth'
                            : 'Conditions declining (' + delta + '% GP) - growth will slow over the forecast period';
                        trendBg = '#fef2f2'; trendBorder = '#fca5a5'; trendColor = '#991b1b';
                    } else {
                        trendText = 'Stable conditions expected - growth potential relatively consistent over forecast period';
                        trendBg = '#f8fafc'; trendBorder = '#cbd5e1'; trendColor = '#334155';
                    }
                    trendRightHtml = '<div class="gl-insight-box" style="background:' + trendBg + ';border-color:' + trendBorder + ';color:' + trendColor + '">' + esc(trendText) + '</div>';
                }
            }

            var stripHtml = dailyPattern.length > 0 ? renderDailyStrip(dailyPattern.slice(0, 8), grassType) : '';

            avgSectionHtml = [
                '<hr class="gl-section-sep">',
                '<div class="gl-gp-row">',
                '  <div class="gl-gp-row-left">',
                '    <div class="gl-hero-section-label">16-Day Average GP ' + infoBtn('gl-gp') + '</div>',
                '    <div style="display:flex;align-items:center;gap:10px;margin-top:4px">',
                '      <span class="gl-gp-big" style="color:' + gpColor(gp) + '">' + fmt(gp, 0, '—') + '%</span>',
                '      ' + statusBadge(esc(gpStatus), gpColor(gp)),
                '    </div>',
                '  </div>',
                '  <div class="gl-gp-row-right">' + trendRightHtml + '</div>',
                '</div>',
                stripHtml
            ].join('\n');
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent"></div>',
            '    <div class="gl-block-title">Growth &amp; Temperature</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            mixedBannerHtml,
            todaySectionHtml,
            avgSectionHtml,
            renderCompactSoilTemp(soilTemp),
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderCompactSoilTemp(soilTemp) {
        var depths = [
            { key: 'd20mm',  label: '20 mm' },
            { key: 'd50mm',  label: '50 mm' },
            { key: 'd100mm', label: '100 mm' }
        ];

        if (!soilTemp || !soilTemp.summary || !soilTemp.summary.depths) {
            return '<div class="gl-soil-mini"><span class="gl-soil-mini-label">Soil Temp</span><span style="font-size:12px;color:var(--muted);font-style:italic">Data not yet available — will show once sensor data is cached</span></div>';
        }

        var depthData = soilTemp.summary.depths;
        var items = depths.map(function(dk) {
            var d = depthData[dk.key];
            if (!d) return '';
            var val = d.mean !== undefined ? d.mean : d.current;
            var color = val === null || val === undefined ? '#9ca3af' : (val < 10 ? '#0ea5e9' : val < 20 ? '#16a34a' : '#f97316');
            return [
                '<div class="gl-soil-mini-item">',
                '  <span class="gl-soil-mini-depth">' + dk.label + '</span>',
                '  <span class="gl-soil-mini-val" style="color:' + color + '">' + fmt(val, 1, '—') + (val !== null && val !== undefined ? '°' : '') + '</span>',
                '</div>'
            ].join('');
        }).filter(Boolean).join('');

        // Overall status
        var refDepth = depthData['d50mm'] || depthData['d20mm'] || null;
        var refVal = refDepth ? (refDepth.mean !== undefined ? refDepth.mean : refDepth.current) : null;
        var status = refVal === null ? '' : (refVal < 10 ? 'Cold — C4 dormancy likely' : refVal < 15 ? 'Cool' : refVal < 22 ? 'Optimal for roots' : 'Warm');

        return '<div class="gl-soil-mini"><span class="gl-soil-mini-label">Soil Temp</span>' + items + (status ? '<span class="gl-soil-mini-status">' + esc(status) + '</span>' : '') + '</div>';
    }

    function renderBellCurve(cm, shade, grassType) {
        var temp   = cm && cm.temperature ? cm.temperature : {};
        var currentTemp = temp.todayMean;
        var showC3 = grassType !== 'c4';
        var showC4 = grassType !== 'c3';
        var cfg = global.GAIP_HUB_CONFIG || {};
        var speciesLabel = cfg.turfSpecies ? capitalize(cfg.turfSpecies) : (shade && shade.speciesKey ? capitalize(shade.speciesKey) : null);

        // Chart is always shown — curves are mathematical

        // Must match climate-engine.js calculateC3Growth / calculateC4Growth
        var C3_PEAK = 20.0, C3_SIGMA = 10.0;
        var C4_PEAK = 31.0, C4_SIGMA = 8.0;
        var T_MIN = -5, T_MAX = 45;
        var W = 600, H = 180, padL = 40, padR = 20, padT = 22, padB = 40;
        var innerW = W - padL - padR;
        var innerH = H - padT - padB;

        function gaus(t, peak, sigma) { return Math.exp(-0.5 * Math.pow((t - peak) / sigma, 2)); }
        function tX(t) { return padL + ((t - T_MIN) / (T_MAX - T_MIN)) * innerW; }
        function gpY(gp) { return padT + innerH - (gp / 100) * innerH; }

        var steps = [], t;
        for (t = T_MIN; t <= T_MAX; t += 0.5) steps.push(t);

        function curvePath(peak, sigma) {
            var pts = steps.map(function(t) { return tX(t).toFixed(1) + ',' + gpY(gaus(t, peak, sigma) * 100).toFixed(1); });
            return 'M ' + pts.join(' L ');
        }
        function areaPath(peak, sigma) {
            var p = curvePath(peak, sigma);
            var lastX = tX(T_MAX).toFixed(1), firstX = tX(T_MIN).toFixed(1), baseY = (padT + innerH).toFixed(1);
            return p + ' L ' + lastX + ',' + baseY + ' L ' + firstX + ',' + baseY + ' Z';
        }

        var c3Path = curvePath(C3_PEAK, C3_SIGMA);
        var c4Path = curvePath(C4_PEAK, C4_SIGMA);

        // Grid lines
        var grid = [0, 25, 50, 75, 100].map(function(pct) {
            var y = gpY(pct).toFixed(1);
            return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e5e7eb" stroke-width="1"/>' +
                   '<text x="' + (padL - 5) + '" y="' + (parseFloat(y) + 4) + '" text-anchor="end" font-size="10" fill="#9ca3af">' + pct + '</text>';
        }).join('');

        // X axis labels
        var xLabels = [];
        for (var xt = T_MIN; xt <= T_MAX; xt += 5) {
            xLabels.push('<text x="' + tX(xt).toFixed(1) + '" y="' + (padT + innerH + 14) + '" text-anchor="middle" font-size="10" fill="#9ca3af">' + xt + '°</text>');
        }

        // Current temp indicator — vertical line + pill badge on the curve
        var tempMarkup = '';
        if (currentTemp !== null && currentTemp !== undefined) {
            var tx = parseFloat(tX(currentTemp).toFixed(1));
            var badgeLabel = fmt(currentTemp, 1) + '°C now';
            var badgeW = badgeLabel.length * 6.2 + 14;
            var badgeH = 18;
            var badgeX = tx - badgeW / 2;
            var badgeY = padT - badgeH - 2;
            if (badgeX < 2) badgeX = 2;
            if (badgeX + badgeW > W - 2) badgeX = W - badgeW - 2;
            // Small dot on curve
            tempMarkup = [
                '<line x1="' + tx + '" y1="' + padT + '" x2="' + tx + '" y2="' + (padT + innerH) + '" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="4,3" opacity=".5"/>',
                '<rect x="' + badgeX.toFixed(1) + '" y="' + badgeY.toFixed(1) + '" width="' + badgeW.toFixed(1) + '" height="' + badgeH + '" rx="9" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1"/>',
                '<text x="' + tx.toFixed(1) + '" y="' + (badgeY + badgeH * 0.68).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#374151" font-weight="700">' + badgeLabel + '</text>'
            ].join('');
        }

        var peakLabels = '';

        // Legend — only shown curves
        var legY = padT + innerH + 30;
        var legParts = [];
        if (showC3 && showC4) {
            legParts.push('<circle cx="' + (W/2 - 100) + '" cy="' + legY + '" r="5" fill="#0ea5e9"/><text x="' + (W/2 - 92) + '" y="' + (legY+4) + '" font-size="11" fill="#374151">C3 cool-season</text>');
            legParts.push('<circle cx="' + (W/2 + 30) + '" cy="' + legY + '" r="5" fill="#f97316"/><text x="' + (W/2 + 38) + '" y="' + (legY+4) + '" font-size="11" fill="#374151">C4 warm-season</text>');
        } else {
            var legColor = showC3 ? '#0ea5e9' : '#f97316';
            var legName  = speciesLabel || (showC3 ? 'C3 cool-season grass' : 'C4 warm-season grass');
            legParts.push('<circle cx="' + (W/2 - 50) + '" cy="' + legY + '" r="5" fill="' + legColor + '"/><text x="' + (W/2 - 42) + '" y="' + (legY+4) + '" font-size="11" fill="#374151">' + esc(legName) + '</text>');
        }
        var legend = legParts.join('');

        var subtitle = '— how temperature drives growth potential' + (speciesLabel ? ' for ' + speciesLabel : '');

        // SVG curves — only draw what's needed
        var curveSvg = [];
        if (showC3) {
            curveSvg.push('<path d="' + areaPath(C3_PEAK, C3_SIGMA) + '" fill="url(#bc-c3)"/>');
            curveSvg.push('<path d="' + c3Path + '" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round"/>');
        }
        if (showC4) {
            curveSvg.push('<path d="' + areaPath(C4_PEAK, C4_SIGMA) + '" fill="url(#bc-c4)"/>');
            curveSvg.push('<path d="' + c4Path + '" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linejoin="round"/>');
        }

        return [
            '<div class="gl-chart-wrap">',
            '<div class="gl-chart-label">Growth Potential vs Temperature ' + infoBtn('gl-c3c4') + ' &nbsp;<span style="font-weight:400;font-style:italic">' + subtitle + '</span></div>',
            '<svg class="gl-svg" viewBox="0 0 ' + W + ' ' + (H + 16) + '" height="' + (H + 16) + '">',
            '<defs>',
            '<linearGradient id="bc-c3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0ea5e9" stop-opacity=".2"/><stop offset="100%" stop-color="#0ea5e9" stop-opacity=".01"/></linearGradient>',
            '<linearGradient id="bc-c4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f97316" stop-opacity=".2"/><stop offset="100%" stop-color="#f97316" stop-opacity=".01"/></linearGradient>',
            '</defs>',
            grid,
            xLabels.join(''),
            peakLabels,
            curveSvg.join(''),
            tempMarkup,
            legend,
            '</svg>',
            '</div>'
        ].join('\n');
    }

    function renderDailyStrip(dailyPattern, grassType) {
        if (!dailyPattern || dailyPattern.length === 0) return '';
        var monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var todayStr = new Date().toISOString().slice(0, 10);
        var items = dailyPattern.map(function (d, i) {
            var val = grassType === 'c3' ? (d.c3 != null ? d.c3 : d.weighted) :
                      grassType === 'c4' ? (d.c4 != null ? d.c4 : d.weighted) :
                      d.weighted;
            var color = gpColor(val);
            var dayLabel;
            if (i === 0 || d.date === todayStr) {
                dayLabel = 'Today';
            } else if (d.date) {
                var parts = d.date.split('-');
                dayLabel = parseInt(parts[2], 10) + ' ' + monthShort[parseInt(parts[1], 10) - 1];
            } else {
                dayLabel = 'D+' + i;
            }
            var barH = val != null ? Math.round(clamp(val / 100, 0, 1) * 36) : 2;
            var isToday = i === 0;
            var tempHtml = d.temp != null ? '<div class="gl-day-chip-temp">' + d.temp + '° avg</div>' : '';
            // Forecast confidence drops with each day: 95% → 50% over 8 days
            var conf = Math.round(Math.max(50, 95 - i * 6));
            var confDots = isToday ? '' : (function() {
                var filled = Math.round(conf / 20); // 0-5 dots
                var dots = '';
                for (var k = 0; k < 5; k++) {
                    dots += '<span style="display:inline-block;width:4px;height:4px;border-radius:50%;margin:0 1px;background:' + (k < filled ? '#9ca3af' : '#e5e7eb') + '"></span>';
                }
                var tipText = 'Forecast confidence: ' + conf + '%';
                return '<div class="gl-conf-dots" data-tip="' + esc(tipText) + '" style="display:flex;align-items:center;justify-content:center;margin-top:2px;cursor:default">' + dots + '</div>';
            })();
            return [
                '<div class="gl-day-chip' + (isToday ? ' gl-day-chip-today' : '') + '">',
                '  <div class="gl-day-chip-label">' + esc(dayLabel) + '</div>',
                '  <div class="gl-day-chip-bar-wrap">',
                '    <div class="gl-day-chip-bar" style="height:' + barH + 'px;background:' + color + '"></div>',
                '  </div>',
                '  <div class="gl-day-chip-val" style="color:' + color + '">' + (val != null ? fmt(val, 0) + '%' : '—') + '</div>',
                tempHtml,
                confDots,
                '</div>'
            ].join('');
        }).join('');
        return '<div class="gl-day-strip">' + items + '</div>';
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
            '    <div class="gl-block-title">Light Conditions</div>',
            '    <div class="gl-block-sub">Daily Light Integral (DLI)</div>',
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
        var items = [];
        if (seasonal.peakMonth !== undefined) items.push('Peak month: <strong>Month ' + seasonal.peakMonth + '</strong>');
        if (seasonal.troughMonth !== undefined) items.push('Trough month: <strong>Month ' + seasonal.troughMonth + '</strong>');
        if (seasonal.stressMonths && seasonal.stressMonths.length) items.push('Stress months: <strong>' + seasonal.stressMonths.join(', ') + '</strong>');
        if (seasonal.renovationMonths && seasonal.renovationMonths.length) items.push('Renovation window: <strong>' + seasonal.renovationMonths.join(', ') + '</strong>');
        if (seasonal.range !== undefined) items.push('Annual DLI range: <strong>' + fmt(seasonal.range, 1) + ' mol/m²/day</strong>');

        return [
            '<div class="gl-research-section">',
            '<div class="gl-section-label">Seasonal Trajectory</div>',
            '<ul style="margin:6px 0 0;padding-left:20px;font-size:13px;line-height:1.8">' + items.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // BLOCK 3 — TEMPERATURE STRESSES
    // =========================================================================

    function renderStressBlock(cm) {
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
        var heatActive = heat.days > 0;
        var heatCard = renderStressCard('Heat Stress',
            heatActive ? [
                heat.days + ' day' + (heat.days !== 1 ? 's' : '') + ' forecast',
                heat.maxTemp ? 'Peak: ' + fmt(heat.maxTemp, 1) + '°C' : ''
            ].filter(Boolean) : null,
            heatActive ? '#dc2626' : '#16a34a',
            heatActive ? null : 'No heat events forecast');

        // Cold card
        var coldActive = cold.days > 0 || cold.frostDays > 0;
        var coldCard = renderStressCard('Cold & Frost',
            coldActive ? [
                cold.days ? cold.days + ' cold day' + (cold.days !== 1 ? 's' : '') : '',
                cold.frostDays ? cold.frostDays + ' frost day' + (cold.frostDays !== 1 ? 's' : '') : '',
                cold.minTemp !== undefined ? 'Min: ' + fmt(cold.minTemp, 1) + '°C' : ''
            ].filter(Boolean) : null,
            cold.frostDays > 0 ? '#0ea5e9' : (coldActive ? '#d97706' : '#16a34a'),
            coldActive ? null : 'No frost risk forecast');

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#f97316"></div>',
            '    <div class="gl-block-title">Stress Conditions</div>',
            '    <div class="gl-block-sub">Direct factors reducing Growth Potential</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-four-col">',
            overallCard, shadeCard, heatCard, coldCard,
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderStressCard(title, lines, accentColor, okMsg) {
        var color = accentColor || '#9ca3af';
        var content;
        if (lines && lines.length) {
            content = lines.map(function (l) { return '<div class="gl-stress-detail">' + esc(l) + '</div>'; }).join('');
        } else if (okMsg) {
            content = '<div class="gl-stress-detail" style="color:#16a34a;font-weight:500">&#10003; ' + esc(okMsg) + '</div>';
        } else {
            content = '<div class="gl-stress-detail">—</div>';
        }
        return [
            '<div class="gl-stress-card" style="border-top:3px solid ' + color + '">',
            '  <div class="gl-stress-label">' + esc(title) + '</div>',
            content,
            '</div>'
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
            '    <div class="gl-block-title">Shade Management</div>',
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

        var renoHtml = renderRenovationStatus(shade);

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#236b4a"></div>',
            '    <div class="gl-block-title">Recommendations</div>',
            '    <div class="gl-block-sub">' + recs.length + ' action' + (recs.length !== 1 ? 's' : '') + '</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            renoHtml,
            recs.length ? '<div class="gl-rec-list">' + allHtml + '</div>' : '',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function renderRenovationStatus(shade) {
        var rw = shade && shade.recoveryWindow;
        if (!rw || !rw.windowStart) return '';

        var suitable = rw.severity === 'good';
        var approaching = rw.flag === 'approaching';

        var bg, border, color, icon, statusText;
        if (suitable) {
            bg = '#f0fdf4'; border = '#86efac'; color = '#14532d'; icon = '✓'; statusText = 'Renovation Conditions: Suitable';
        } else if (approaching) {
            bg = '#fffbeb'; border = '#fde68a'; color = '#78350f'; icon = '◷'; statusText = 'Renovation Conditions: Window Approaching';
        } else {
            bg = '#f9fafb'; border = '#d1d5db'; color = '#374151'; icon = '✕'; statusText = 'Renovation Conditions: Not Suitable';
        }

        var detail = rw.detail ? esc(rw.detail) : '';
        var window = (rw.windowStart || '') + (rw.windowEnd && rw.windowEnd !== rw.windowStart ? ' – ' + rw.windowEnd : '');

        return [
            '<div class="gl-reno-box" style="background:' + bg + ';border:1px solid ' + border + ';color:' + color + ';margin-bottom:16px">',
            '  <div class="gl-reno-icon">' + icon + '</div>',
            '  <div>',
            '    <div class="gl-reno-status">' + statusText + '</div>',
            window ? '<div class="gl-reno-detail" style="margin-bottom:4px;font-weight:500">' + esc(window) + '</div>' : '',
            detail ? '<div class="gl-reno-detail">' + detail + '</div>' : '',
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

            // Renovation window
            var rw = shade.recoveryWindow;
            if (rw && rw.windowStart && rw.windowEnd) {
                var rwSeverity = rw.severity || '';
                if (rwSeverity === 'good') {
                    recs.push({ priority: 'monitor', text: 'Renovation window open: ' + rw.windowStart + ' – ' + rw.windowEnd + '. ' + (rw.detail || 'Conditions are favourable for renovation and overseeding.') });
                } else if (rw.flag && rw.flag !== 'outside') {
                    recs.push({ priority: 'week', text: 'Renovation planning: ' + rw.windowStart + ' – ' + rw.windowEnd + '. ' + (rw.detail || '') });
                }
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
            renderHeader(cm, shade),
            '<div class="gl-body">',
            renderGrowthBlock(cm, soilTemp, shade),
            renderLightBlock(cm, shade),
            renderStressBlock(cm),
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
                notice.style.display = 'flex';
                if (noticeDismiss) {
                    noticeDismiss.onclick = function () { notice.style.display = 'none'; };
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
        initInfoPopovers();
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
