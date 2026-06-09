/**
 * ============================================================================
 * GAIP SOIL & NUTRITION ANALYSIS  v2.0.0
 * ============================================================================
 *
 * Renderer for /analysis#soil-nutrition tab.
 * Reads from window.GAIP_DASHBOARD_DATA.computed.soilNutrition.
 *
 * Sections (top → bottom):
 *   1.  Methodology badge
 *   2.  Validation banner
 *   3.  Verdict card
 *   4.  Zone alert list
 *   5.  Zone comparison charts
 *   6.  Nutrient cards  (with Why? → soil reserve, classification, action)
 *   7.  Mulder interactions
 *   8.  Nutrient ratios
 *   9.  pH & CEC
 *  10.  Annual nutrient requirements
 *  11.  Monthly N distribution
 *  12.  Tissue test results
 *  13.  Soil–tissue cross-validation
 *  14.  Analysis context  (collapsed)
 *  15.  Cross-module patterns button + Plan link
 *
 * DATA: window.GAIP_DASHBOARD_DATA.computed.soilNutrition = {
 *   verdict, methodology, pH, CEC, sampleDate, sampleLabel,
 *   depthCm, bulkDensity, turfType,
 *   nutrients[], ratios[], annualDemand{}, monthlyN[],
 *   zones[], mulders, species, tissue{}, validation{}
 * }
 * ============================================================================
 */

(function (global) {
    'use strict';

    // =========================================================================
    // STYLES
    // =========================================================================

    var CSS_INJECTED = false;

    function injectCSS() {
        if (CSS_INJECTED) return;
        CSS_INJECTED = true;
        var s = document.createElement('style');
        s.textContent = [
            /* page */
            '.sn-page{padding-bottom:48px}',
            /* section wrappers */
            '.sn-section{padding:20px 0 0}',
            '.sn-section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5b6a65;margin-bottom:12px;display:flex;align-items:center;gap:8px}',
            '.sn-section-title::after{content:"";flex:1;height:1px;background:#e5e7eb}',
            /* verdict */
            '.sn-verdict{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-radius:10px;border:1px solid;margin-bottom:4px}',
            '.sn-verdict.acceptable{background:#f0fdf4;border-color:#86efac;color:#14532d}',
            '.sn-verdict.monitor{background:#fffbeb;border-color:#fde68a;color:#78350f}',
            '.sn-verdict.high_risk{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d}',
            '.sn-verdict.no_data{background:#f9fafb;border-color:#e5e7eb;color:#6b7280}',
            '.sn-verdict-title{font-size:18px;font-weight:700;line-height:1.2;margin-bottom:4px}',
            '.sn-verdict-sub{font-size:13px;opacity:.85;line-height:1.5}',
            '.sn-verdict-rows{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}',
            '@media(max-width:600px){.sn-verdict-rows{grid-template-columns:1fr}}',
            '.sn-verdict-row{font-size:12px;line-height:1.5}',
            '.sn-verdict-row strong{text-transform:uppercase;font-size:10px;letter-spacing:.06em;opacity:.7;display:block}',
            /* zone alert list */
            '.sn-alerts{padding:0 0 16px}',
            '.sn-alert-item{display:flex;align-items:baseline;gap:8px;padding:6px 12px;border-left:3px solid #fca5a5;background:#fef2f2;border-radius:0 6px 6px 0;margin-bottom:5px;font-size:12px;color:#7f1d1d}',
            '.sn-alert-zone{font-weight:700;flex-shrink:0}',
            '.sn-alert-nuts{opacity:.85}',
            /* zone comparison */
            '.sn-zone-tabs{display:flex;gap:4px;flex-wrap:wrap;padding:0 0 10px}',
            '.sn-zone-tab{padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #d8e0dc;background:#fff;color:#5b6a65;transition:background .15s}',
            '.sn-zone-tab.active{background:#17231f;color:#fff;border-color:#17231f}',
            /* sample zone selector chips */
            '.sn-sample-chips{display:flex;gap:4px;flex-wrap:wrap;padding:0 0 12px}',
            '.sn-sample-chip{padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #d8e0dc;background:#fff;color:#5b6a65;transition:background .15s;white-space:nowrap}',
            '.sn-sample-chip:hover{border-color:#2da85e;color:#166534}',
            '.sn-sample-chip.active{background:#2da85e;color:#fff;border-color:#2da85e}',
            '.sn-sample-chip-all{padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #d8e0dc;background:#f9fafb;color:#5b6a65;transition:background .15s}',
            '.sn-sample-chip-all.active{background:#17231f;color:#fff;border-color:#17231f}',
            '.sn-sample-more{padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px dashed #d8e0dc;background:transparent;color:#5b6a65}',
            '.sn-section-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}',
            '.sn-zone-label{font-size:11px;color:#6b8878;font-weight:400;margin-left:4px}',
            '.sn-zone-chart{padding:0 0 4px;display:none}',
            '.sn-zone-chart.active{display:block}',
            '.sn-zone-chart-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65;margin-bottom:8px;display:flex;align-items:center;gap:8px}',
            '.sn-zone-threshold-label{font-size:10px;color:#ef4444;font-weight:600}',
            '.sn-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;min-height:22px}',
            '.sn-bar-label{font-size:11px;color:#374151;width:100px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}',
            '.sn-bar-track{flex:1;background:#f3f4f6;border-radius:3px;height:14px;position:relative;max-width:360px}',
            '.sn-bar-fill{height:100%;border-radius:3px;transition:width .3s}',
            '.sn-bar-fill.adequate{background:#3b82f6}',
            '.sn-bar-fill.borderline{background:#f59e0b}',
            '.sn-bar-fill.deficient{background:#ef4444}',
            '.sn-bar-threshold{position:absolute;top:-3px;bottom:-3px;width:2px;background:#ef4444;opacity:.7}',
            '.sn-bar-value{font-size:11px;color:#374151;width:44px;flex-shrink:0;text-align:right}',
            /* nutrient cards grid */
            '.sn-nutrients{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;padding:0 0 20px}',
            '.sn-card{background:#fff;border:1px solid #d8e0dc;border-radius:10px;padding:14px 16px;position:relative}',
            '.sn-card.deficient{border-color:#fca5a5;background:#fff8f8}',
            '.sn-card.borderline{border-color:#fde68a;background:#fffdf0}',
            '.sn-card.adequate,.sn-card.sufficient{border-color:#86efac;background:#f8fdf9}',
            '.sn-card.high{border-color:#93c5fd;background:#f0f6ff}',
            '.sn-card.no-data{border-color:#e5e7eb;background:#f9fafb}',
            '.sn-card-nutrient{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65;margin-bottom:6px}',
            '.sn-card-value{font-size:26px;font-weight:700;line-height:1;color:#17231f;margin-bottom:2px}',
            '.sn-card-value span{font-size:13px;font-weight:400;color:#5b6a65}',
            '.sn-card-threshold{font-size:12px;color:#5b6a65;margin-bottom:8px}',
            '.sn-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em}',
            '.sn-badge.deficient,.sn-badge.critical{background:#fee2e2;color:#991b1b}',
            '.sn-badge.borderline,.sn-badge.warning{background:#fef9c3;color:#854d0e}',
            '.sn-badge.adequate,.sn-badge.sufficient,.sn-badge.good{background:#dcfce7;color:#166534}',
            '.sn-badge.high,.sn-badge.info{background:#dbeafe;color:#1e40af}',
            '.sn-badge.no-data{background:#f3f4f6;color:#6b7280}',
            /* card progress bar */
            '.sn-card-bar{height:5px;border-radius:3px;background:#e5e7eb;margin:8px 0;overflow:hidden}',
            '.sn-card-bar-fill{height:100%;border-radius:3px;background:#22c55e}',
            /* Why? disclosure in card */
            '.sn-why-btn{font-size:11px;color:#5b6a65;background:none;border:1px solid #d8e0dc;cursor:pointer;padding:3px 8px;border-radius:4px;margin-top:8px;display:inline-flex;align-items:center;gap:4px}',
            '.sn-why-btn:hover{background:#f3f4f6}',
            '.sn-why{margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:12px;color:#374151;line-height:1.5}',
            '.sn-why-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f3f4f6;gap:8px}',
            '.sn-why-row:last-child{border-bottom:none}',
            '.sn-why-label{color:#5b6a65;flex-shrink:0}',
            '.sn-why-val{font-weight:600;text-align:right}',
            '.sn-why-action{margin-top:6px;padding:6px 10px;background:#f5f7f6;border-radius:6px;border-left:3px solid #d8e0dc;font-size:11px;color:#374151}',
            '.sn-why-note{margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6;font-size:11px;color:#5b6a65;line-height:1.5}',
            '.sn-why-source{margin-top:8px;padding-top:6px;border-top:1px dashed #e5e7eb;font-size:10px;color:#9ca3af;line-height:1.6}',
            /* mulder banner */
            '.sn-mulder{padding:10px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;margin:0}',
            /* ratios */
            '.sn-ratios{display:flex;flex-direction:column;gap:1px;padding:0 0 4px}',
            '.sn-ratio-row{display:grid;grid-template-columns:80px 60px 90px 1fr;align-items:baseline;gap:12px;padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:4px;font-size:13px}',
            '.sn-ratio-name{font-weight:700;color:#17231f}',
            '.sn-ratio-value{font-size:16px;font-weight:700;color:#1e40af;text-align:right}',
            '.sn-ratio-status.balanced{color:#166534;font-weight:600}',
            '.sn-ratio-status.caution{color:#854d0e;font-weight:600}',
            '.sn-ratio-status.low{color:#991b1b;font-weight:600}',
            '.sn-ratio-interp{font-size:11px;color:#6b7280;line-height:1.4}',
            '.sn-ratios-note{font-size:11px;color:#9ca3af;padding:4px 0 12px;font-style:italic}',
            /* ph bar */
            '.sn-ph-bar{position:relative;height:10px;border-radius:5px;background:linear-gradient(to right,#ef4444 0%,#f97316 15%,#eab308 30%,#22c55e 45%,#22c55e 65%,#eab308 80%,#ef4444 100%);margin:10px 0}',
            '.sn-ph-marker{position:absolute;top:-5px;width:4px;height:20px;border-radius:2px;background:#17231f;transform:translateX(-50%)}',
            '.sn-ph-labels{display:flex;justify-content:space-between;font-size:10px;color:#5b6a65;margin-top:2px}',
            '.sn-ph-optimal{position:absolute;top:0;height:100%;background:rgba(34,197,94,.3);border-radius:5px}',
            /* annual requirements */
            '.sn-annual{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:0 0 20px}',
            '.sn-annual-card{background:#fff;border:1px solid #d8e0dc;border-radius:8px;padding:12px;text-align:center}',
            '.sn-annual-nutrient{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65;margin-bottom:4px}',
            '.sn-annual-value{font-size:24px;font-weight:700;color:#17231f;line-height:1}',
            '.sn-annual-unit{font-size:11px;color:#5b6a65;margin-bottom:6px}',
            '.sn-annual-status{font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;display:inline-block}',
            '.sn-annual-note{font-size:10px;color:#9ca3af;margin-top:4px;line-height:1.3}',
            /* monthly N chart */
            '.sn-monthly{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;padding:0 0 4px;align-items:end}',
            '.sn-month-col{display:flex;flex-direction:column;align-items:center;gap:3px}',
            '.sn-month-bar-wrap{width:100%;display:flex;align-items:flex-end;height:60px}',
            '.sn-month-bar{width:100%;border-radius:3px 3px 0 0;min-height:2px;transition:opacity .2s}',
            '.sn-month-val{font-size:10px;font-weight:700;color:#374151}',
            '.sn-month-label{font-size:9px;color:#9ca3af;text-align:center}',
            '.sn-month-col.current .sn-month-bar{opacity:1;outline:2px solid #17231f;outline-offset:1px}',
            '.sn-month-col:not(.current) .sn-month-bar{opacity:.7}',
            '.sn-monthly-meta{font-size:11px;color:#5b6a65;padding:6px 0 12px}',
            /* tissue */
            '.sn-table{width:100%;border-collapse:collapse;font-size:13px}',
            '.sn-table th{text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65;border-bottom:2px solid #e5e7eb;font-weight:700}',
            '.sn-table td{padding:8px 12px;border-bottom:1px solid #f3f4f6}',
            '.sn-table tr:last-child td{border-bottom:none}',
            '.sn-tissue-summary{padding:14px 16px;background:#f5f7f6;border:1px solid #d8e0dc;border-radius:10px;margin:0 0 16px;font-size:13px;line-height:1.6}',
            '.sn-tissue-headline{font-weight:700;font-size:14px;margin-bottom:6px;color:#17231f}',
            '.sn-tissue-bias{font-style:italic;color:#5b6a65;margin-top:6px;font-size:12px}',
            /* cross-validation */
            '.sn-crossval{padding:12px 16px;border-radius:8px;margin:0 0 10px;font-size:12px;line-height:1.5}',
            '.sn-crossval.high{background:#fef2f2;border:1px solid #fca5a5;color:#7f1d1d}',
            '.sn-crossval.moderate{background:#fffbeb;border:1px solid #fde68a;color:#78350f}',
            /* analysis context (collapsible) */
            '.sn-context-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;padding:16px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5b6a65;border-top:1px solid #e5e7eb}',
            '.sn-context-body{padding:0 0 16px;display:none}',
            '.sn-context-body.open{display:block}',
            '.sn-context-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px}',
            '.sn-context-row:last-child{border-bottom:none}',
            '.sn-context-label{color:#5b6a65}',
            '.sn-context-val{font-weight:600;text-align:right}',
            /* empty state */
            '.sn-empty{padding:40px 20px;text-align:center;color:#5b6a65}',
            '.sn-empty-title{font-size:15px;font-weight:600;color:#374151;margin-bottom:6px}',
            '.sn-empty-body{font-size:13px;line-height:1.6;max-width:420px;margin:0 auto}',
            /* sample dropdown selector */
            '.sn-drop-wrap{position:relative;display:block;font-family:inherit}',
            '.sn-drop-btn{display:flex;align-items:center;gap:7px;padding:7px 12px;background:#fff;border:1px solid #d8e0dc;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#17231f;width:100%;box-sizing:border-box;max-width:480px;font-family:inherit;text-align:left}',
            '.sn-drop-btn:hover{border-color:#2da85e}',
            '.sn-drop-open .sn-drop-btn{border-color:#2da85e;border-bottom-left-radius:0;border-bottom-right-radius:0}',
            '.sn-drop-panel{display:none;position:absolute;top:100%;left:0;z-index:200;background:#fff;border:1px solid #2da85e;border-top:none;border-radius:0 8px 8px 8px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:480px;max-width:min(640px,90vw)}',
            '.sn-drop-open .sn-drop-panel{display:block}',
            '.sn-drop-search{display:block;width:100%;box-sizing:border-box;padding:8px 12px;border:none;border-bottom:1px solid #e5e7eb;font-size:13px;outline:none;color:#17231f;font-family:inherit}',
            '.sn-drop-search::placeholder{color:#9ca3af}',
            '.sn-drop-header{display:grid;grid-template-columns:1fr 1fr 110px;gap:8px;padding:5px 12px;background:#f5f7f6;border-bottom:1px solid #e5e7eb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65}',
            '.sn-drop-list{max-height:240px;overflow-y:auto}',
            '.sn-drop-row{display:grid;grid-template-columns:1fr 1fr 110px;gap:8px;padding:9px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;align-items:center}',
            '.sn-drop-row:last-child{border-bottom:none}',
            '.sn-drop-row:hover{background:#f0fdf4}',
            '.sn-drop-row.active{background:#f0fdf4}',
            '.sn-drop-cell-zone{font-size:12px;font-weight:600;color:#17231f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.sn-drop-row.active .sn-drop-cell-zone::before{content:"● ";color:#2da85e}',
            '.sn-drop-cell-ref{font-size:12px;color:#5b6a65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.sn-drop-cell-date{font-size:11px;color:#5b6a65;white-space:nowrap}',
        ].join('');
        document.head.appendChild(s);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function capitalize(s) {
        if (!s) return '';
        return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
    }

    var NUTRIENT_NAMES = {
        P:'Phosphorus', K:'Potassium', Ca:'Calcium', Mg:'Magnesium',
        S:'Sulphur', Fe:'Iron', Mn:'Manganese', Zn:'Zinc', Cu:'Copper', B:'Boron',
        N:'Nitrogen', Na:'Sodium'
    };

    var MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var STATUS_ICONS = {
        deficient:'▼', borderline:'⚠', adequate:'✓', sufficient:'✓',
        good:'✓', high:'▲', 'no-data':'—', 'NO DATA':'—'
    };

    var NUTRIENT_NOTES = {
        K:  'Leaches readily from sand profiles — monitor frequently during wet periods and after heavy irrigation. High demand during active growth phases.',
        P:  'Soil P is rarely limiting on established turf with regular fertility programs. Avoid excessive rates; P buildup increases runoff risk.',
        Ca: 'High CEC soils often supply adequate Ca despite low ppm readings. True deficiency is uncommon on established turf.',
        Mg: 'Antagonised by high K applications. Deficiency is most common where K rates are elevated or on low-CEC sandy soils.',
        S:  'Leaches freely in sandy soils. Availability decreases in dry conditions; best assessed after wet periods.',
        Fe: 'Availability drops sharply above pH 6.5. Soil test values may not fully reflect plant-available Fe — foliar applications are often more effective.',
        Mn: 'Unavailable above pH 7.0; toxicity possible below pH 5.5. Strongly affected by soil oxygen status and drainage.',
        Zn: 'Fixed by high pH and elevated phosphorus. Competition with Cu at elevated application rates.',
        Cu: 'Accumulates in soil over time — avoid excessive rates. Low mobility means the soil test reflects long-term status well.',
        B:  'Mobile in plants but relatively immobile in soil. Deficiency is rare on established turf with normal irrigation and fertility.',
    };

    function statusClass(raw) {
        var s = (raw || '').toLowerCase().replace(/\s+/g,'-');
        if (s==='low'||s==='very-low'||s==='insufficient'||s==='critical') return 'deficient';
        if (s==='warning') return 'borderline';
        if (s==='within-range') return 'adequate';
        return s || 'no-data';
    }

    function fmtDate(str) {
        if (!str) return null;
        try {
            var d = new Date(str);
            if (isNaN(d)) return str;
            return d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
        } catch(e) { return str; }
    }

    function daysAgo(str) {
        if (!str) return null;
        try {
            var d = new Date(str);
            if (isNaN(d)) return null;
            var diff = Math.round((Date.now()-d.getTime())/86400000);
            if (diff<=0) return 'today';
            if (diff===1) return '1 day ago';
            return diff+' days ago';
        } catch(e) { return null; }
    }

    // =========================================================================
    // 1. PAGE HEADER (matches gl-header pattern from disease / growth-light pages)
    // =========================================================================

    // Register glossary entries for info popovers
    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, {
        'sn-status': {
            title: 'Soil Nutrition Status',
            body:  'Overall assessment based on MLSN/SLAN thresholds across all measured nutrients.\n\n' +
                   'Acceptable — all nutrients above minimum threshold.\n' +
                   'Monitor — one or more nutrients borderline; corrective action within 2–4 weeks.\n' +
                   'Deficiency Detected — one or more nutrients below threshold; immediate action required.',
        },
        'sn-compliance': {
            title: 'Growth Potential',
            body:  'Current growth potential (GP) used to scale MLSN nutrient demand calculations. ' +
                   'MLSN targets are adjusted proportionally — lower GP means lower nutrient demand.\n\n' +
                   '≥80% — High growth, full nutrient programme required.\n' +
                   '40–79% — Moderate growth, reduced demand.\n' +
                   '<40% — Low/dormant, minimal nutrient application needed.',
        },
    });

    function hexToRgb(hex) {
        var h = hex.replace('#', '');
        return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
    }

    function kpiCard(label, value, unit, statusHtml, color, infoKey) {
        var rgb = hexToRgb(color);
        var bg     = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.07)';
        var border = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.25)';
        var infoBtn = infoKey
            ? ' <button class="db-info-icon" data-info="' + infoKey + '" tabindex="0" aria-label="Learn more">i</button>'
            : '';
        return [
            '<div class="gl-kpi-card" style="background:' + bg + ';border-color:' + border + ';border-left-color:' + color + '">',
            '  <div class="gl-kpi-label">' + label + infoBtn + '</div>',
            '  <div class="gl-kpi-value" style="color:' + color + '">' + value + '</div>',
            unit       ? '  <div class="gl-kpi-unit">' + unit + '</div>' : '',
            statusHtml ? '  <div>' + statusHtml + '</div>' : '',
            '</div>'
        ].join('');
    }

    function badgeSpan(text, bgClr, txtClr, borderClr) {
        return '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;' +
            'background:' + bgClr + ';color:' + txtClr + ';border:1px solid ' + borderClr + '">' +
            esc(text) + '</span>';
    }

    // Renders KPI cards grid — called on initial render and re-called on sample switch
    function renderKpiCards(sn) {
        var v = (sn.verdict || 'NO_DATA').replace('-', '_');
        var VERDICT = {
            ACCEPTABLE: { label:'Acceptable',         color:'#16a34a', bg:'#dcfce7', txt:'#15803d', brd:'#86efac' },
            MONITOR:    { label:'Monitor',             color:'#d97706', bg:'#fef9c3', txt:'#854d0e', brd:'#fde68a' },
            HIGH_RISK:  { label:'Deficiency Detected', color:'#dc2626', bg:'#fee2e2', txt:'#991b1b', brd:'#fca5a5' },
            NO_DATA:    { label:'No Data',             color:'#9ca3af', bg:'#f3f4f6', txt:'#6b7280', brd:'#d1d5db' },
        };
        var vc = VERDICT[v] || VERDICT.NO_DATA;
        var age = daysAgo(sn.sampleDate);
        var ageUnit = age ? esc(age) + (sn.sampleLabel ? ' · ' + esc(sn.sampleLabel) : '') : '';
        var alertZones = (sn.zones || []).filter(function(z){ return z.alerts && z.alerts.length; });
        var totalZones = sn.zones ? sn.zones.length : 0;
        var cards = [];

        cards.push(kpiCard('Soil Nutrition Status', esc(vc.label), ageUnit,
            badgeSpan(vc.label, vc.bg, vc.txt, vc.brd), vc.color, 'sn-status'));

        if (totalZones > 0) {
            var zColor = alertZones.length > 0 ? '#dc2626' : '#16a34a';
            var zBadge = alertZones.length > 0
                ? badgeSpan(alertZones.length + ' zone' + (alertZones.length === 1 ? '' : 's') + ' requiring attention', '#fee2e2', '#991b1b', '#fca5a5')
                : badgeSpan('All zones OK', '#dcfce7', '#15803d', '#86efac');
            cards.push(kpiCard('Zones',
                alertZones.length > 0 ? alertZones.length + ' / ' + totalZones : String(totalZones),
                alertZones.length > 0 ? 'require attention' : 'zones — all within threshold',
                zBadge, zColor));
        }

        var phVal = parseFloat(sn.pH);
        if (!isNaN(phVal)) {
            var phOk  = phVal >= 5.8 && phVal <= 6.5;
            var phLow = phVal < 5.8;
            var phColor  = phOk ? '#16a34a' : '#d97706';
            var phStatus = phOk ? 'Optimal' : phLow ? 'Below optimal' : 'Above optimal';
            cards.push(kpiCard('Soil pH', phVal.toFixed(1), 'Optimal range 5.8–6.5',
                phOk ? badgeSpan(phStatus, '#dcfce7', '#15803d', '#86efac')
                     : badgeSpan(phStatus, '#fef9c3', '#854d0e', '#fde68a'),
                phColor));
        }

        return '<div class="gl-kpi-grid">' + cards.join('') + '</div>';
    }

    function renderPageHeader(sn) {
        var m = (sn.methodology || 'mlsn').toLowerCase();
        var methLabel = m === 'slan' ? 'SLAN'
            : m === 'ammonium_acetate' ? 'Ammonium Acetate'
            : 'MLSN';
        var methName = m === 'slan' ? 'Sufficiency Level of Available Nutrients'
            : m === 'ammonium_acetate' ? 'Hill Labs NZ Method'
            : 'Minimum Levels for Sustainable Nutrition';
        var methDesc = m === 'slan' ? 'Traditional sufficiency-range approach, widely used across all turf types'
            : m === 'ammonium_acetate' ? 'Olsen P + NH₄OAc extraction, calibrated for NZ soils'
            : 'Threshold-based approach, validated primarily on golf putting greens';

        var data = global.GAIP_DASHBOARD_DATA;
        var gpVal = data && data.computed && data.computed.climate &&
                    data.computed.climate.growth && data.computed.climate.growth.weighted;
        var gpPct = (gpVal != null) ? Math.round(gpVal) : null;
        var complianceHtml = gpPct !== null
            ? ' <span style="font-size:12px;font-weight:700;color:#374151">' + gpPct + '%</span>' +
              ' <button class="db-info-icon" data-info="sn-compliance" tabindex="0" aria-label="Learn more">i</button>'
            : '';

        var methBlock =
            '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">' +
            '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid #d1d5db;background:#fff;color:#374151;flex-shrink:0">' + esc(methLabel) + '</span>' +
            '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:600;color:#374151;display:flex;align-items:center;gap:6px">' + esc(methName) + complianceHtml + '</div>' +
            '<div style="font-size:11px;color:#6b7280;margin-top:1px">' + esc(methDesc) + '</div>' +
            '</div>' +
            '</div>';

        return [
            '<div class="gl-header">',
            '  <div class="gl-header-inner">',
            '    <h1 class="gl-title">Soil &amp; Nutrition Analysis</h1>',
            '    <div class="gl-subtitle" style="margin-bottom:6px">Select a soil sample to view nutrient status, zone comparison and fertiliser programme.</div>',
            '    <div id="sn-sample-selector"></div>',
            '    <div id="sn-kpi-wrap" style="margin-top:16px">',
            renderKpiCards(sn),
            '    </div>',
            methBlock,
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // =========================================================================
    // 2. VALIDATION BANNER
    // =========================================================================

    function renderValidation(sn) {
        var v = sn.validation;
        if (!v) return '';
        var errors = v.errors || [], warnings = v.warnings || [];
        if (!errors.length && !warnings.length) return '';
        var analyzedAt = (global.GAIP_DASHBOARD_DATA && global.GAIP_DASHBOARD_DATA.analyzedAt) || '';
        if (analyzedAt && sessionStorage.getItem('sn_val_dismissed') === analyzedAt) return '';
        var hasErrors = errors.length > 0;
        var title     = hasErrors ? 'Input Data Issues Detected' : 'Unusual Values Detected';
        var accent    = hasErrors ? '#dc2626' : '#d97706';
        var titleClr  = hasErrors ? '#991b1b' : '#92400e';
        var itemClr   = hasErrors ? '#b91c1c' : '#78350f';
        var border    = hasErrors ? '#fca5a5' : '#fde68a';
        var bg        = hasErrors ? '#fef2f2' : '#fffbeb';
        var dot       = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+accent+';margin-right:8px;flex-shrink:0;margin-top:5px"></span>';
        var safeAt    = analyzedAt.replace(/'/g,'');
        var svgWarn   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-right:6px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        var html = '<div data-sn-val="1" style="margin:0 0 12px;border-radius:8px;border:1px solid '+border+';border-left:3px solid '+accent+';background:'+bg+';overflow:hidden">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;border-bottom:1px solid '+border+'">';
        html += '<div style="display:flex;align-items:center;color:'+titleClr+';font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em">'+svgWarn+title+'</div>';
        html += '<button onclick="sessionStorage.setItem(\'sn_val_dismissed\',\''+safeAt+'\');this.closest(\'[data-sn-val]\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;color:'+titleClr+';opacity:.5;padding:0;font-size:15px;line-height:1" aria-label="Dismiss">×</button>';
        html += '</div><div style="padding:8px 12px">';
        errors.forEach(function(e){ html+='<div style="display:flex;align-items:flex-start;color:'+itemClr+';font-size:12px;margin:4px 0">'+dot+esc(e)+'</div>'; });
        warnings.slice(0,5).forEach(function(w){ html+='<div style="display:flex;align-items:flex-start;color:'+itemClr+';font-size:12px;margin:4px 0">'+dot+esc(w)+'</div>'; });
        if (warnings.length>5) html+='<div style="font-size:11px;margin-top:4px;color:#9ca3af">+'+(warnings.length-5)+' more unusual values</div>';
        html+='<div style="margin-top:8px;padding-top:8px;border-top:1px solid '+border+';font-size:11px;color:#9ca3af">Verify these values before relying on recommendations.</div>';
        html+='</div></div>';
        return html;
    }

    // =========================================================================
    // 3. VERDICT CARD
    // =========================================================================

    var VERDICT_META = {
        ACCEPTABLE: {
            cls:'acceptable', title:'Soil Nutrition: Acceptable',
            sub:'Operate normally. Routine monitoring only. No immediate action required.',
            decision:'Continue routine fertilisation program.',
            mechanism:'Nutrient levels determine turf recovery capacity, wear tolerance, and disease resistance.',
            consequence:'Adequate nutrient supply supports consistent quality.',
            determination:'Continue routine monitoring.',
        },
        MONITOR: {
            cls:'monitor', title:'Soil Nutrition: Monitor',
            sub:'Borderline nutrient levels detected. Review and schedule corrective applications.',
            decision:'Schedule corrective fertilisation for borderline nutrients.',
            mechanism:'Borderline levels may become limiting under peak-demand conditions.',
            consequence:'Risk of quality deterioration under stress if not addressed.',
            determination:'Apply corrective amendments within 2–4 weeks.',
        },
        HIGH_RISK: {
            cls:'high_risk', title:'Soil Nutrition: Deficiency Detected',
            sub:'One or more nutrients below minimum threshold. Corrective action required.',
            decision:'Apply deficient nutrients immediately to restore sufficiency.',
            mechanism:'Nutrient deficiency reduces turf recovery capacity and increases disease susceptibility.',
            consequence:'Continued deficiency will compromise turf quality and wear tolerance.',
            determination:'Immediate corrective application required.',
        },
        NO_DATA: {
            cls:'no_data', title:'Soil Nutrition: No Data',
            sub:'No soil test data available. Add soil test data and run the analysis to see results.',
            decision:null, mechanism:null, consequence:null, determination:null,
        },
    };

    function renderVerdict(sn) {
        var v    = (sn.verdict||'NO_DATA').replace('-','_');
        var meta = VERDICT_META[v] || VERDICT_META.NO_DATA;
        var meth = sn.methodology ? ' <span style="font-size:11px;opacity:.7">('+esc(sn.methodology.toUpperCase())+')</span>' : '';
        var rows = meta.decision ? (
            '<div class="sn-verdict-rows">'+
            '<div class="sn-verdict-row"><strong>Decision</strong>'+esc(meta.decision)+'</div>'+
            '<div class="sn-verdict-row"><strong>Mechanism</strong>'+esc(meta.mechanism)+'</div>'+
            '<div class="sn-verdict-row"><strong>Consequence</strong>'+esc(meta.consequence)+'</div>'+
            '<div class="sn-verdict-row"><strong>Determination</strong>'+esc(meta.determination)+'</div>'+
            '</div>'
        ) : '';
        return meta.decision
            ? '<div class="sn-verdict '+meta.cls+'">'+
              '<div style="flex:1">'+
              '<div class="sn-verdict-title">'+meta.title+meth+'</div>'+
              '<div class="sn-verdict-sub">'+esc(meta.sub)+'</div>'+
              rows+'</div></div>'
            : '';
    }

    // =========================================================================
    // 4. ZONE ALERT LIST
    // =========================================================================

    function renderZoneAlerts(zones) {
        var alerts = (zones || []).filter(function(z){ return z.alerts && z.alerts.length; });
        if (!alerts.length) return '';
        return '<div class="sn-section"><div class="sn-section-title">Zones Requiring Attention</div></div>'+
            '<div class="sn-alerts">'+
            alerts.map(function(z){
                return '<div class="sn-alert-item">'+
                    '<span class="sn-alert-zone">'+esc(z.label)+'</span>'+
                    '<span class="sn-alert-nuts">'+esc(z.alerts.join(', '))+' at/below threshold</span>'+
                    '</div>';
            }).join('')+'</div>';
    }

    // =========================================================================
    // 5. ZONE COMPARISON CHARTS
    // =========================================================================

    function renderZoneComparison(sn) {
        var zones = sn.zones;
        if (!zones || zones.length < 2) return '';

        // Nutrients to chart — those with at least some zone data
        var CHART_NUTS = ['K','P','Ca','Mg','S','Fe','Mn','Zn'];
        // Build threshold map from primary nutrients
        var threshMap = {};
        (sn.nutrients || []).forEach(function(n){ threshMap[n.nutrient] = parseFloat(n.mlsn)||0; });

        // Latest date label from zones
        var latestDate = zones.reduce(function(mx,z){ return (z.date||'') > mx ? (z.date||'') : mx; }, '');
        var dateLabel = latestDate ? (function(){
            try{
                var d=new Date(latestDate);
                if(isNaN(d)) return '';
                return d.toLocaleDateString('en-AU',{month:'short',year:'2-digit'});
            }catch(e){return '';}
        })() : '';

        // Filter to nuts that have data across zones
        var activeNuts = CHART_NUTS.filter(function(nut){
            return zones.some(function(z){ return z.ppm && z.ppm[nut] != null; });
        });
        if (!activeNuts.length) return '';

        var firstNut = activeNuts[0];

        var tabs = activeNuts.map(function(nut){
            var hasAlert = zones.some(function(z){ return z.alerts && z.alerts.indexOf(nut) >= 0; });
            return '<button class="sn-zone-tab'+(nut===firstNut?' active':'')+'" onclick="snZoneTab(this,\''+nut+'\')">'+
                esc(nut)+(hasAlert?' <span style="color:#ef4444">▲</span>':'')+
                '</button>';
        }).join('');

        var charts = activeNuts.map(function(nut){
            var thresh = threshMap[nut] || 0;
            var vals = zones.map(function(z){ return { label:z.label, val:z.ppm&&z.ppm[nut]!=null?z.ppm[nut]:null, alert:z.alerts&&z.alerts.indexOf(nut)>=0 }; })
                            .filter(function(r){ return r.val != null; });
            if (!vals.length) return '';

            var maxVal = Math.max(thresh * 1.1, vals.reduce(function(mx,r){ return Math.max(mx,r.val); },0));

            var bars = vals.map(function(r){
                var pct   = maxVal > 0 ? Math.min(100, r.val / maxVal * 100) : 0;
                var tPct  = maxVal > 0 && thresh > 0 ? Math.min(100, thresh / maxVal * 100) : 0;
                var sc    = r.alert ? 'deficient' : (thresh > 0 && r.val < thresh * 1.2 ? 'borderline' : 'adequate');
                return '<div class="sn-bar-row">'+
                    '<div class="sn-bar-label" title="'+esc(r.label)+'">'+esc(r.label)+'</div>'+
                    '<div class="sn-bar-track">'+
                    (tPct>0?'<div class="sn-bar-threshold" style="left:'+tPct.toFixed(1)+'%"></div>':'')+
                    '<div class="sn-bar-fill '+sc+'" style="width:'+pct.toFixed(1)+'%"></div>'+
                    '</div>'+
                    '<div class="sn-bar-value">'+r.val+'</div>'+
                    '</div>';
            }).join('');

            return '<div class="sn-zone-chart'+(nut===firstNut?' active':'')+'" data-nut="'+nut+'">'+
                '<div class="sn-zone-chart-title">'+esc(nut)+
                (thresh>0?' <span class="sn-zone-threshold-label">'+thresh+' (MLSN)</span>':'')+
                '</div>'+bars+'</div>';
        }).join('');

        return '<div class="sn-section"><div class="sn-section-title">Soil Zone Comparison'+
            (dateLabel?' <span style="font-size:10px;font-weight:400;opacity:.7">'+esc(zones.length)+' zones · '+esc(dateLabel)+'</span>':'')+
            '</div></div>'+
            '<div class="sn-zone-tabs">'+tabs+'</div>'+
            '<div style="padding-bottom:20px">'+charts+'</div>';
    }

    // =========================================================================
    // 6. NUTRIENT CARDS
    // =========================================================================

    function renderNutrientCards(sn) {
        var nutrients = sn.nutrients || [];
        if (!nutrients.length) {
            return '<div class="sn-empty" style="padding:20px"><div class="sn-empty-body">No nutrient data. Add soil test data and run the analysis.</div></div>';
        }
        var depth = sn.depthCm || 10;
        var bd    = sn.bulkDensity || 1.4;
        var depthFactor = depth * bd * 0.1; // ppm → kg/ha

        return nutrients.map(function(n, idx){
            var sc    = statusClass(n.statusClass||n.status||'');
            var icon  = STATUS_ICONS[sc]||'';
            var name  = NUTRIENT_NAMES[n.nutrient]||n.nutrient;
            var actual = parseFloat(n.actual);
            var mlsnV  = parseFloat(n.mlsn);
            var targetV = parseFloat(n.targetPpm);
            if ((isNaN(targetV) || !targetV) && mlsnV > 0) targetV = Math.round(mlsnV * 1.5 * 10) / 10;
            var uptakeV = parseFloat(n.uptakePpm);

            // Progress bar: actual / (1.5 × mlsn), capped 0–100%
            var barPct = (mlsnV > 0 && !isNaN(actual))
                ? Math.min(100, actual / (mlsnV * 1.5) * 100) : 0;
            var barClr = sc==='deficient'?'#ef4444':sc==='borderline'?'#f59e0b':'#22c55e';

            // MLSN multiplier classification
            var multiplier = (mlsnV > 0 && !isNaN(actual)) ? (actual / mlsnV) : null;
            var classLabel = null;
            if (multiplier != null) {
                if (multiplier < 1)      classLabel = multiplier.toFixed(1)+'× MLSN minimum (deficient)';
                else if (multiplier < 1.2) classLabel = multiplier.toFixed(1)+'× MLSN minimum (borderline)';
                else if (multiplier < 2)   classLabel = multiplier.toFixed(1)+'× MLSN minimum (adequate)';
                else                       classLabel = multiplier.toFixed(1)+'× MLSN minimum (excessive)';
            }

            // Soil reserve kg/ha
            var reserveKgHa = (!isNaN(actual) && depthFactor) ? (actual * depthFactor) : null;
            var mlsnKgHa    = (!isNaN(mlsnV) && depthFactor) ? (mlsnV * depthFactor) : null;
            var surplusKgHa = (reserveKgHa!=null && mlsnKgHa!=null) ? Math.max(0, reserveKgHa - mlsnKgHa) : null;
            var demandKgHa  = (sn.annualDemand && sn.annualDemand[n.nutrient]) ? sn.annualDemand[n.nutrient] : null;
            if (!demandKgHa && !isNaN(uptakeV) && depthFactor) demandKgHa = uptakeV * depthFactor;

            // Why? content
            var whyId  = 'sn-why-'+idx;
            var whyRows = '';
            if (classLabel)    whyRows += '<div class="sn-why-row"><span class="sn-why-label">Classification</span><span class="sn-why-val">'+esc(classLabel)+'</span></div>';
            if (classLabel && !isNaN(targetV) && targetV) whyRows += '<div style="height:1px;background:#e5e7eb;margin:4px 0"></div>';
            if (!isNaN(targetV) && targetV) whyRows += '<div class="sn-why-row"><span class="sn-why-label">Target level (1.5× MLSN)</span><span class="sn-why-val">'+targetV+' ppm</span></div>';
            if (reserveKgHa!=null) whyRows += '<div class="sn-why-row"><span class="sn-why-label">Soil reserve</span><span class="sn-why-val">'+reserveKgHa.toFixed(1)+' kg/ha</span></div>';
            if (surplusKgHa!=null) whyRows += '<div class="sn-why-row"><span class="sn-why-label">Reserve above threshold</span><span class="sn-why-val">'+surplusKgHa.toFixed(1)+' kg/ha</span></div>';
            if (demandKgHa!=null)  whyRows += '<div class="sn-why-row"><span class="sn-why-label">Est. annual demand</span><span class="sn-why-val">'+demandKgHa.toFixed(1)+' kg/ha</span></div>';
            var actionHtml = (n.recommendation && n.recommendation !== 'No reference value')
                ? '<div class="sn-why-action">'+esc(n.recommendation)+'</div>' : '';
            var noteText = NUTRIENT_NOTES[n.nutrient] || '';
            var noteHtml = noteText ? '<div class="sn-why-note">'+esc(noteText)+'</div>' : '';
            var sourceHtml =
                '<div class="sn-why-source">'+
                'Source: MLSN thresholds from Pace Turf research (Woods &amp; Stowell) &middot; '+
                'Assumptions: '+depth+'&thinsp;cm depth &middot; '+bd+'&thinsp;g/cm&sup3; bulk density &middot; '+
                'Apply fertiliser only when below the MLSN minimum &middot; '+
                'Validated primarily on golf putting greens'+
                '</div>';
            var whyHtml = (whyRows || actionHtml || noteText)
                ? '<button class="sn-why-btn" onclick="(function(b){var d=document.getElementById(\''+whyId+'\');var open=d.style.display===\'block\';d.style.display=open?\'none\':\'block\';b.textContent=open?\'Why? ▼\':\'▲ Hide\'})(this)">Why? ▼</button>'+
                  '<div id="'+whyId+'" class="sn-why" style="display:none">'+whyRows+actionHtml+noteHtml+sourceHtml+'</div>'
                : '';

            return '<div class="sn-card '+sc+'">'+
                '<div class="sn-card-nutrient">'+esc(n.nutrient)+' — '+esc(name)+'</div>'+
                '<div class="sn-card-value">'+esc(n.actual)+' <span>ppm</span></div>'+
                '<div class="sn-card-threshold">MLSN: '+esc(n.mlsn||'—')+' ppm</div>'+
                '<div class="sn-card-bar"><div style="width:'+barPct.toFixed(1)+'%;background:'+barClr+'" class="sn-card-bar-fill"></div></div>'+
                '<div><span class="sn-badge '+sc+'">'+icon+' '+esc(n.status||sc)+'</span></div>'+
                whyHtml+'</div>';
        }).join('');
    }

    // =========================================================================
    // 7. MULDER INTERACTIONS
    // =========================================================================

    function renderMulder(sn) {
        if (!sn.mulders) return '';
        // mulders is an HTML summary banner from GilbaMulders.analyse()
        // strip tags to get plain text, then render clean
        var plain = String(sn.mulders).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (!plain) return '';
        return '<div class="sn-mulder" style="margin-top:16px">'+
            '<strong>Mulder interactions detected:</strong> '+esc(plain)+
            '</div>';
    }

    // =========================================================================
    // 8. NUTRIENT RATIOS
    // =========================================================================

    var RATIO_DEFS = [
        {
            name: 'Ca:Mg', nutA: 'Ca', nutB: 'Mg',
            lo: 3, hi: 10,
            interp: 'Ideal 3–10. Very high Ca:Mg may restrict Mg uptake and cause deficiency symptoms.',
        },
        {
            name: 'K:Mg', nutA: 'K', nutB: 'Mg',
            lo: 1, hi: 3,
            interp: 'Ideal 1–3. High K:Mg suppresses Mg uptake — common cause of Mg deficiency on high-K soils.',
        },
        {
            name: 'K:Ca', nutA: 'K', nutB: 'Ca',
            lo: 0.1, hi: 0.3,
            interp: 'Ideal 0.1–0.3. Elevated K:Ca may interfere with Ca availability and cell wall integrity.',
        },
    ];

    function calcRatiosFromNutrients(nutrients) {
        var ppm = {};
        nutrients.forEach(function(n) { ppm[n.nutrient] = parseFloat(n.actual); });
        return RATIO_DEFS.map(function(def) {
            var a = ppm[def.nutA], b = ppm[def.nutB];
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            var value = a / b;
            var balanced = value >= def.lo && value <= def.hi;
            var low = value < def.lo;
            return {
                name: def.name,
                value: value,
                status: balanced ? 'Balanced' : low ? 'Low' : 'Caution',
                statusClass: balanced ? 'balanced' : low ? 'low' : 'caution',
                interpretation: def.interp,
            };
        }).filter(Boolean);
    }

    function renderRatios(sn) {
        var ratios = sn.ratios;

        // Fallback: compute from nutrients ppm when cache lacks ratios
        if ((!ratios || !ratios.length) && sn.nutrients && sn.nutrients.length) {
            ratios = calcRatiosFromNutrients(sn.nutrients);
        }
        if (!ratios || !ratios.length) return '';

        var rows = ratios.map(function(r){
            var sc = (r.statusClass||'').replace('ratio-','');
            var statusCls = sc==='balanced'?'balanced':sc==='caution'?'caution':'low';
            var interp = r.interpretation ? String(r.interpretation).replace(/<[^>]+>/g,' ').trim() : '';
            return '<div class="sn-ratio-row">'+
                '<span class="sn-ratio-name">'+esc(r.name)+'</span>'+
                '<span class="sn-ratio-value">'+esc(r.value!=null?r.value.toFixed(2):'—')+'</span>'+
                '<span class="sn-ratio-status '+statusCls+'">'+esc(r.status||'')+'</span>'+
                '<span class="sn-ratio-interp">'+esc(interp)+'</span>'+
                '</div>';
        }).join('');

        return '<div class="sn-section"><div class="sn-section-title">Nutrient Ratios</div></div>'+
            '<div class="sn-ratios">'+rows+'</div>'+
            '<div class="sn-ratios-note">Ratios help identify potential antagonisms. High K:Mg can limit Mg uptake; very high Ca:Mg may also restrict Mg availability.</div>';
    }

    // =========================================================================
    // 9. pH & CEC
    // =========================================================================

    function renderPhCec(sn) {
        var pH  = parseFloat(sn.pH);
        var cec = sn.CEC;
        if (!pH || isNaN(pH)) {
            return '<div style="padding:0 20px 16px;font-size:13px;color:#5b6a65">No pH / CEC data available.</div>';
        }
        var scaleMin=4.5, scaleMax=8.5;
        var pct = Math.max(0,Math.min(100,(pH-scaleMin)/(scaleMax-scaleMin)*100));
        var optLo=5.8, optHi=6.5;
        var optLoPct=(optLo-scaleMin)/(scaleMax-scaleMin)*100;
        var optHiPct=(optHi-scaleMin)/(scaleMax-scaleMin)*100;
        var phStatus = pH>=optLo&&pH<=optHi?'Within optimal range ✓':pH<optLo?'Below optimal (consider liming)':'Above optimal (consider acidification)';
        var cecHtml = cec
            ? '<div style="display:flex;gap:24px;margin-top:12px"><div>'+
              '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6a65">CEC</div>'+
              '<div style="font-size:20px;font-weight:700">'+esc(String(cec))+' <span style="font-size:13px;font-weight:400;color:#5b6a65">meq/100g</span></div></div></div>'
            : '';
        return '<div style="padding-bottom:20px">'+
            '<div style="background:#fff;border:1px solid #d8e0dc;border-radius:10px;padding:16px">'+
            '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'+
            '<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6a65">Soil pH</div>'+
            '<div style="font-size:32px;font-weight:700;line-height:1">'+pH.toFixed(1)+'</div>'+
            '<div style="font-size:12px;color:#5b6a65;margin-top:2px">'+esc(phStatus)+'</div></div>'+
            '<div style="flex:1;min-width:200px">'+
            '<div class="sn-ph-bar">'+
            '<div class="sn-ph-optimal" style="left:'+optLoPct.toFixed(1)+'%;width:'+(optHiPct-optLoPct).toFixed(1)+'%"></div>'+
            '<div class="sn-ph-marker" style="left:'+pct.toFixed(1)+'%"></div>'+
            '</div>'+
            '<div class="sn-ph-labels"><span>'+scaleMin+'</span><span>Optimal '+optLo+'–'+optHi+'</span><span>'+scaleMax+'</span></div>'+
            '</div></div>'+cecHtml+'</div></div>';
    }

    // =========================================================================
    // 10. ANNUAL NUTRIENT REQUIREMENTS
    // =========================================================================

    // Mirrors calculateAnnualDemand() from mlsn-progressive-disclosure.js
    var ANNUAL_RATIOS = {
        'cool-season': { K:0.8, P:0.10, Ca:0.20, Mg:0.10, S:0.12, Fe:0.025, Mn:0.012, Zn:0.004, Cu:0.002, B:0.0015 },
        'warm-season': { K:1.0, P:0.08, Ca:0.25, Mg:0.12, S:0.10, Fe:0.020, Mn:0.010, Zn:0.003, Cu:0.002, B:0.001  },
    };

    function calcAnnualDemand(turfType, gp, nProgram) {
        var baseN = (turfType === 'warm-season') ? 180 : 150;
        if (nProgram && nProgram > 0) baseN = nProgram;
        var gpFactor  = gp ? Math.max(0.3, gp / 100) : 0.7;
        var effectiveN = baseN * gpFactor;
        var ratios    = ANNUAL_RATIOS[turfType] || ANNUAL_RATIOS['cool-season'];
        var demand    = { N: effectiveN };
        Object.keys(ratios).forEach(function(nut) { demand[nut] = effectiveN * ratios[nut]; });
        return demand;
    }

    function readNProgramFromStorage() {
        try {
            var uid = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.userId;
            var key = 'gilba_hub_state' + (uid ? '_' + uid : '');
            var saved = JSON.parse(localStorage.getItem(key) || 'null');
            var nProg = saved && saved.turf && parseFloat(saved.turf.nProgram);
            return (nProg && nProg > 0) ? nProg : null;
        } catch(e) { return null; }
    }

    function renderAnnualRequirements(sn) {
        var demand = sn.annualDemand;
        var nutrients = sn.nutrients || [];

        // Fallback: same algorithm as calculateAnnualDemand() in mlsn-progressive-disclosure.js
        if (!demand && nutrients.length) {
            var data = global.GAIP_DASHBOARD_DATA;
            var gp   = data && data.computed && data.computed.climate &&
                       data.computed.climate.growth && data.computed.climate.growth.weighted;
            var nProg = readNProgramFromStorage();
            demand = calcAnnualDemand(sn.turfType || 'cool-season', gp || null, nProg);
        }

        if (!demand || !nutrients.length) return '';

        var ANNUAL_NUTS = ['P','K','Ca','Mg','S'];
        var cards = ANNUAL_NUTS.map(function(nut){
            var demandVal = demand[nut];
            if (demandVal == null) return '';
            // Find status from primary nutrients
            var nObj   = nutrients.filter(function(n){ return n.nutrient===nut; })[0];
            var actual = nObj ? parseFloat(nObj.actual) : NaN;
            var mlsnV  = nObj ? parseFloat(nObj.mlsn)   : NaN;

            // If actual ≥ target (1.5× MLSN) → soil is well above threshold, no application needed
            var targetV = nObj ? parseFloat(nObj.targetPpm) : NaN;
            if (isNaN(targetV) || !targetV) targetV = mlsnV > 0 ? mlsnV * 1.5 : NaN;
            var isHigh = !isNaN(actual) && !isNaN(targetV) && actual >= targetV;

            var rounded     = isHigh ? 0 : Math.round(demandVal * 10) / 10;
            var sc          = isHigh ? 'high' : (nObj ? statusClass(nObj.statusClass||nObj.status||'') : 'no-data');
            var badgeBg     = sc==='deficient'?'#fee2e2':sc==='borderline'?'#fef9c3':sc==='adequate'||sc==='sufficient'?'#dcfce7':sc==='high'?'#dbeafe':'#f3f4f6';
            var badgeClr    = sc==='deficient'?'#991b1b':sc==='borderline'?'#854d0e':sc==='adequate'||sc==='sufficient'?'#166534':sc==='high'?'#1e40af':'#6b7280';
            var statusText  = isHigh ? 'High' : capitalize(nObj ? (nObj.status || sc) : sc);
            var noteText    = isHigh
                ? 'Soil level exceeds MLSN target, no application required this season. Monitor annually.'
                : 'Application required to meet annual demand.';
            return '<div class="sn-annual-card">'+
                '<div class="sn-annual-nutrient">'+esc(nut)+'</div>'+
                '<div class="sn-annual-value">'+rounded+'</div>'+
                '<div class="sn-annual-unit">kg/ha/yr</div>'+
                '<span class="sn-annual-status" style="background:'+badgeBg+';color:'+badgeClr+'">'+esc(statusText)+'</span>'+
                '<div class="sn-annual-note">'+esc(noteText)+'</div>'+
                '</div>';
        }).filter(Boolean).join('');

        if (!cards) return '';
        return '<div class="sn-section"><div class="sn-section-title">Annual Nutrient Requirements (MLSN)</div></div>'+
            '<div class="sn-annual">'+cards+'</div>';
    }

    // =========================================================================
    // 10b. CORRECTION PROGRAM
    // =========================================================================

    var CORRECTION_SOURCES = {
        K:  { product: 'Muriate of Potash (MOP)',    pct: 41.5, unit: 'kg/ha', note: '0-0-60, granular. Alternatively Sulfate of Potash (SOP) where chloride sensitivity is a concern.' },
        P:  { product: 'Monoammonium Phosphate (MAP)', pct: 26.5, unit: 'kg/ha', note: '12-26-0, granular. Also supplies nitrogen — account for N contribution in annual budget.' },
        Ca: { product: 'Agricultural Lime (CaCO₃)',  pct: 40,   unit: 'kg/ha', note: 'Also raises pH. Use gypsum (CaSO₄, 23% Ca) when pH correction is not needed.' },
        Mg: { product: 'Kieserite (MgSO₄)',          pct: 13,   unit: 'kg/ha', note: 'Also supplies sulfur. Dolomite (12% Mg, 22% Ca) is an option if Ca is also needed.' },
        S:  { product: 'Elemental Sulfur',            pct: 90,   unit: 'kg/ha', note: 'Apply early season — requires oxidation by soil bacteria. Gypsum is a faster-acting option.' },
        Fe: { product: 'Iron Sulfate (FeSO₄·7H₂O)', pct: 20,   unit: 'kg/ha', note: 'Apply as foliar for rapid greening. Also available as chelated iron (EDTA/DTPA) for liquid programs.' },
        Mn: { product: 'Manganese Sulfate',           pct: 26,   unit: 'kg/ha', note: 'Foliar application preferred at 2–5 kg Mn/ha. Soil apply at higher rates when pH > 6.5.' },
        Cu: { product: 'Copper Sulfate',              pct: 25,   unit: 'kg/ha', note: 'Apply with caution — Cu accumulates in soil. Do not exceed 0.5 kg Cu/ha/yr on fine turf.' },
        Zn: { product: 'Zinc Sulfate',                pct: 23,   unit: 'kg/ha', note: 'Foliar preferred for rapid correction. Soil apply at 1–3 kg Zn/ha for longer residual.' },
        B:  { product: 'Borax (Na₂B₄O₇·10H₂O)',     pct: 11,   unit: 'kg/ha', note: 'Very narrow safe range — excess causes toxicity. Apply at 0.2–0.5 kg B/ha maximum.' },
    };

    function renderCorrectionProgram(sn) {
        var nutrients  = sn.nutrients || [];
        var depthFactor = (sn.depthCm || 10) * (sn.bulkDensity || 1.4) * 0.1;

        var deficient = nutrients.filter(function(n) {
            var sc = statusClass(n.statusClass || n.status || '');
            return sc === 'deficient' || sc === 'borderline';
        });

        if (!deficient.length) return '';

        var rows = deficient.map(function(n) {
            var src   = CORRECTION_SOURCES[n.nutrient];
            if (!src) return '';

            var actual = parseFloat(n.actual);
            var mlsn   = parseFloat(n.mlsn);
            var deficit = (!isNaN(actual) && !isNaN(mlsn) && mlsn > actual)
                ? Math.max(0, mlsn - actual) : null;

            // Correction dose: deficit ppm × depthFactor / (src.pct / 100)
            var deficitKgHa = (deficit != null && depthFactor) ? deficit * depthFactor : null;
            var productKgHa = (deficitKgHa != null) ? Math.ceil(deficitKgHa / (src.pct / 100)) : null;

            var sc = statusClass(n.statusClass || n.status || '');
            var scColor = sc === 'deficient' ? '#991b1b' : '#854d0e';
            var scBg    = sc === 'deficient' ? '#fef2f2' : '#fffbeb';
            var scBd    = sc === 'deficient' ? '#fca5a5' : '#fde68a';

            return '<div style="border:1px solid ' + scBd + ';background:' + scBg + ';border-radius:8px;padding:12px 14px;margin-bottom:8px">' +
                '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px">' +
                '<div style="font-size:13px;font-weight:700;color:' + scColor + '">' + esc(n.nutrient) + ' — ' + esc(NUTRIENT_NAMES[n.nutrient] || n.nutrient) + '</div>' +
                '<div style="font-size:11px;color:' + scColor + ';font-weight:600">' + esc(capitalize(n.status || sc)) + '</div>' +
                (deficit != null ? '<div style="font-size:11px;color:#6b7280;margin-left:auto">Deficit: ' + deficit.toFixed(1) + ' ppm (' + (deficitKgHa ? deficitKgHa.toFixed(1) : '—') + ' kg/ha)</div>' : '') +
                '</div>' +
                '<div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:2px">' + esc(src.product) + '</div>' +
                (productKgHa != null ? '<div style="font-size:14px;font-weight:800;color:#1e3a2f;margin-bottom:4px">' + productKgHa + ' kg/ha <span style="font-size:11px;font-weight:400;color:#6b7280">to reach MLSN threshold</span></div>' : '') +
                '<div style="font-size:11px;color:#6b7280;line-height:1.5">' + esc(src.note) + '</div>' +
                '</div>';
        }).filter(Boolean).join('');

        if (!rows) return '';

        return '<div class="sn-section"><div class="sn-section-title">Correction Program</div>' +
            '<div style="font-size:12px;color:#5b6a65;margin-top:4px;margin-bottom:12px">Deficient nutrients only · Doses calculated to reach MLSN threshold from current levels</div></div>' +
            rows;
    }

    // =========================================================================
    // 11. MONTHLY N DISTRIBUTION
    // =========================================================================

    function renderMonthlyN(sn) {
        var monthly = sn.monthlyN;

        // Fallback: distribute annualDemand.N by month using climate daily GP pattern.
        // Mirrors distributeNGPWeighted() from nutrition-requirement-engine.js:
        //   - use average daily GP per month (not sum, to normalize for month length)
        //   - months with avg GP < 0.10 receive 0 (MIN_GP_THRESHOLD)
        //   - distribute proportionally among active months
        if (!monthly || !Array.isArray(monthly) || monthly.length !== 12) {
            var annualN = sn.annualDemand && sn.annualDemand.N;
            var data = global.GAIP_DASHBOARD_DATA;
            var dailyPattern = data && data.computed && data.computed.climate &&
                               data.computed.climate.growth && data.computed.climate.growth.dailyPattern;
            if (annualN && dailyPattern && dailyPattern.length) {
                var monthSum   = new Array(12).fill(0);
                var monthCount = new Array(12).fill(0);
                dailyPattern.forEach(function(day) {
                    try {
                        var mo = new Date(day.date).getMonth();
                        if (mo >= 0 && mo < 12) {
                            monthSum[mo]   += (day.gp || day.weighted || day.value || 0);
                            monthCount[mo] += 1;
                        }
                    } catch(e) {}
                });
                // Average GP per month, apply 0.10 threshold
                var MIN_GP = 0.10;
                var monthAvg = monthSum.map(function(s, i){ return monthCount[i] > 0 ? s / monthCount[i] : 0; });
                var totalActive = monthAvg.reduce(function(a, v){ return a + (v >= MIN_GP ? v : 0); }, 0);
                if (totalActive > 0) {
                    monthly = monthAvg.map(function(gp){
                        var n = gp >= MIN_GP ? Math.round(annualN * (gp / totalActive) * 10) / 10 : 0;
                        return { n: n, gp: gp };
                    });
                }
            }
        }

        if (!monthly || !Array.isArray(monthly) || monthly.length !== 12) return '';

        var vals = monthly.map(function(m){ return typeof m === 'object' ? (m.n||0) : (parseFloat(m)||0); });
        var maxVal = Math.max.apply(null, vals) || 1;
        var total  = vals.reduce(function(a,b){ return a+b; }, 0);
        var active = vals.filter(function(v){ return v > 0; }).length;
        var nowMonth = new Date().getMonth(); // 0-indexed

        // Determine hemisphere from latitude or saved data
        var lat = null;
        try {
            var _dd = global.GAIP_DASHBOARD_DATA;
            lat = (_dd && _dd.computed && _dd.computed.climate && _dd.computed.climate.temperature && _dd.computed.climate.temperature.latitude) || null;
        } catch(e) {}
        var isSouth = lat === null ? true : lat < 0; // default southern hemisphere

        // Season → background color (1-indexed month)
        var SEASON_SOUTH = { 12:'Summer',1:'Summer',2:'Summer', 3:'Autumn',4:'Autumn',5:'Autumn', 6:'Winter',7:'Winter',8:'Winter', 9:'Spring',10:'Spring',11:'Spring' };
        var SEASON_NORTH = { 12:'Winter',1:'Winter',2:'Winter', 3:'Spring',4:'Spring',5:'Spring', 6:'Summer',7:'Summer',8:'Summer', 9:'Autumn',10:'Autumn',11:'Autumn' };
        var SEASON_BG    = { Summer:'#fef9c3', Autumn:'#ffedd5', Winter:'#eff6ff', Spring:'#f0fdf4' };

        var cols = vals.map(function(v, i){
            var pct = (v / maxVal * 100).toFixed(1);
            var mon1 = i + 1; // 1-indexed
            var season = (isSouth ? SEASON_SOUTH : SEASON_NORTH)[mon1] || 'Spring';
            var bg     = v > 0 ? SEASON_BG[season]     : '#f9fafb';
            var isCurrent = (i === nowMonth);
            var barClr = v > 0 ? '#22c55e' : '#d1d5db';
            return '<div class="sn-month-col'+(isCurrent?' current':'')+'" style="background:'+bg+';border-radius:6px;padding:6px 2px;opacity:'+(v>0?1:0.5)+';">'+
                '<div class="sn-month-bar-wrap">'+
                '<div class="sn-month-bar" style="height:'+pct+'%;background:'+barClr+'"></div>'+
                '</div>'+
                '<div class="sn-month-val" style="color:'+(v>0?'#166534':'#9ca3af')+'">'+(v > 0 ? Math.round(v) : '-')+'</div>'+
                '<div class="sn-month-label">'+MONTH_LABELS[i]+'</div>'+
                '</div>';
        }).join('');

        return '<div class="sn-section"><div class="sn-section-title">Monthly N Distribution (GP-Weighted)</div></div>'+
            '<div class="sn-monthly">'+cols+'</div>'+
            '<div class="sn-monthly-meta">Total: '+Math.round(total)+' kg N/ha/yr · '+active+' active growing months</div>';
    }

    // =========================================================================
    // 12. TISSUE TEST RESULTS
    // =========================================================================

    var TISSUE_RANGES = {
        N:{lo:4.0,hi:5.0,unit:'%'}, P:{lo:0.30,hi:0.60,unit:'%'}, K:{lo:2.20,hi:3.50,unit:'%'},
        Ca:{lo:0.40,hi:0.80,unit:'%'}, Mg:{lo:0.15,hi:0.35,unit:'%'}, S:{lo:0.20,hi:0.50,unit:'%'},
        Fe:{lo:50,hi:100,unit:'mg/kg'}, Mn:{lo:25,hi:100,unit:'mg/kg'}, Zn:{lo:20,hi:55,unit:'mg/kg'},
        Cu:{lo:5,hi:20,unit:'mg/kg'}, B:{lo:5,hi:30,unit:'mg/kg'}, Na:{lo:0,hi:1000,unit:'mg/kg'},
    };

    function tissueBand(nutrient, value) {
        var r = TISSUE_RANGES[nutrient];
        if (!r||value==null||isNaN(value)) return {band:'No data',cls:'no-data'};
        if (value<r.lo*0.9) return {band:'Deficient',cls:'deficient'};
        if (value<r.lo)     return {band:'Marginal',cls:'borderline'};
        if (value>r.hi*1.1) return {band:'High',cls:'high'};
        if (value>r.hi)     return {band:'Elevated',cls:'borderline'};
        return                     {band:'Sufficient',cls:'adequate'};
    }

    function renderTissue(tissue) {
        if (!tissue) {
            return '<div style="padding-bottom:16px">'+
                '<div class="sn-empty" style="padding:20px;background:#f5f7f6;border-radius:10px;border:1px solid #d8e0dc">'+
                '<div class="sn-empty-title">No Tissue Test Data</div>'+
                '<div class="sn-empty-body">Add tissue test data and run the analysis to see results here.</div>'+
                '</div></div>';
        }
        var headline = tissue.headline ? '<div class="sn-tissue-headline">'+esc(tissue.headline)+'</div>' : '';
        var summaryLines = (tissue.summary||[]).map(function(l){ return '<div>• '+esc(l)+'</div>'; }).join('');
        var bias = tissue.decisionBias ? '<div class="sn-tissue-bias">'+esc(tissue.decisionBias)+'</div>' : '';
        var speciesLine = tissue.speciesGroup
            ? '<div style="font-size:11px;color:#5b6a65;margin-bottom:8px">Species: '+esc(capitalize(tissue.speciesGroup))+
              (tissue.growthState?' · '+esc(tissue.growthState):'')+
              (tissue.testDate?' · Tested: '+esc(fmtDate(tissue.testDate)):'')+
              '</div>' : '';
        var summaryBlock = (headline||summaryLines||bias)
            ? '<div class="sn-tissue-summary">'+speciesLine+headline+summaryLines+bias+'</div>' : '';

        var normalized = tissue.normalized||{};
        var statusMap  = tissue.status||{};
        var TISSUE_ORDER = ['N','P','K','Ca','Mg','S','Fe','Mn','Zn','Cu','B','Na'];
        var rows = TISSUE_ORDER.map(function(nut){
            var val = normalized[nut];
            if (val==null) return '';
            var r   = TISSUE_RANGES[nut]||{};
            var band = (statusMap[nut]&&statusMap[nut].band)||tissueBand(nut,val).band;
            var cls  = (statusMap[nut]&&statusMap[nut].cls)||tissueBand(nut,val).cls;
            var sc   = statusClass(cls);
            var icon = STATUS_ICONS[sc]||'';
            return '<tr>'+
                '<td><strong>'+esc(nut)+'</strong> <span style="color:#5b6a65">'+esc(NUTRIENT_NAMES[nut]||'')+'</span></td>'+
                '<td>'+esc(String(val))+' '+esc(r.unit||'')+'</td>'+
                '<td>'+(r.lo!=null?r.lo+'–'+r.hi+' '+r.unit:'—')+'</td>'+
                '<td><span class="sn-badge '+sc+'">'+icon+' '+esc(band)+'</span></td>'+
                '</tr>';
        }).filter(Boolean).join('');
        var table = rows
            ? '<div style="overflow-x:auto">'+
              '<table class="sn-table"><thead><tr><th>Nutrient</th><th>Value</th><th>Optimal Range</th><th>Status</th></tr></thead>'+
              '<tbody>'+rows+'</tbody></table></div>'
            : '<div style="padding-bottom:16px;color:#5b6a65;font-size:13px">No tissue values found.</div>';
        return summaryBlock+table;
    }

    // =========================================================================
    // 13. SOIL–TISSUE CROSS-VALIDATION
    // =========================================================================

    function renderCrossValidation(sn) {
        var soilNutrients = sn.nutrients||[];
        var tissue = sn.tissue;
        if (!tissue||!tissue.normalized||!soilNutrients.length) return '';
        var findings = [];
        soilNutrients.forEach(function(sn_n){
            var nut = sn_n.nutrient;
            var tissueVal = tissue.normalized&&tissue.normalized[nut];
            if (tissueVal==null) return;
            var soilSC = statusClass(sn_n.statusClass||sn_n.status||'');
            var tb = tissueBand(nut,tissueVal);
            if ((soilSC==='adequate'||soilSC==='sufficient')&&tb.cls==='deficient') {
                findings.push({severity:'high',msg:'Soil '+nut+' adequate ('+sn_n.actual+' ppm) but tissue deficient ('+tissueVal+' '+(TISSUE_RANGES[nut]?TISSUE_RANGES[nut].unit:'')+') — Uptake constraint. Check pH, compaction, root health or irrigation water.'});
            }
            if (soilSC==='deficient'&&(tb.cls==='adequate'||tb.cls==='sufficient')) {
                findings.push({severity:'moderate',msg:'Soil '+nut+' below threshold but tissue sufficient — Recent fertiliser effect or luxury consumption. Continue soil correction program.'});
            }
        });
        (tissue.antagonisms||[]).forEach(function(ant){
            findings.push({severity:'moderate',msg:'Antagonism: '+(ant.element||ant.pair||JSON.stringify(ant))+' interaction detected in tissue.'});
        });
        if (!findings.length) return '';
        return '<div class="sn-section"><div class="sn-section-title">Soil–Tissue Cross-Validation</div></div>'+
            findings.map(function(f){
                return '<div class="sn-crossval '+f.severity+'">'+esc(f.msg)+'</div>';
            }).join('');
    }

    // =========================================================================
    // 14. ANALYSIS CONTEXT (collapsible)
    // =========================================================================

    function renderContext(sn) {
        var rows = '';
        var meth = sn.methodology||'mlsn';
        rows += '<div class="sn-context-row"><span class="sn-context-label">Methodology</span><span class="sn-context-val">'+(meth==='slan'?'SLAN (Sufficiency Levels)':meth==='ammonium_acetate'?'Ammonium Acetate':'MLSN (Minimum Levels)')+'</span></div>';
        if (sn.turfType) rows += '<div class="sn-context-row"><span class="sn-context-label">Turf type</span><span class="sn-context-val">'+esc(sn.turfType)+'</span></div>';
        if (sn.depthCm)  rows += '<div class="sn-context-row"><span class="sn-context-label">Rootzone depth</span><span class="sn-context-val">'+esc(String(sn.depthCm))+' cm</span></div>';
        if (sn.bulkDensity) rows += '<div class="sn-context-row"><span class="sn-context-label">Bulk density</span><span class="sn-context-val">'+esc(String(sn.bulkDensity))+' g/cm³</span></div>';
        if (!rows) return '';
        return '<button class="sn-context-toggle" onclick="(function(b){var body=b.nextElementSibling;var open=body.classList.toggle(\'open\');b.querySelector(\'.sn-ctx-arrow\').textContent=open?\'▲\':\'▼\'})(this)">'+
            'Analysis Context <span class="sn-ctx-arrow">▲</span>'+
            '</button>'+
            '<div class="sn-context-body open"><div style="background:#fff;border:1px solid #d8e0dc;border-radius:10px;padding:4px 16px">'+rows+'</div></div>';
    }

    // =========================================================================
    // EMPTY STATE
    // =========================================================================

    function renderEmpty() {
        return '<div class="sn-empty">'+
            '<div class="sn-empty-title">No Soil &amp; Nutrition Data</div>'+
            '<div class="sn-empty-body">Add soil test data and run the analysis to see results here.</div>'+
            '</div>';
    }

    // =========================================================================
    // MAIN RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById('sn-page-content');
        if (!container) return;

        var data = global.GAIP_DASHBOARD_DATA;
        var sn   = data && data.computed && data.computed.soilNutrition;

        if (!sn || (!sn.nutrients && !sn.tissue)) {
            container.innerHTML = renderEmpty();
            return;
        }

        var validationHtml  = sn.validation ? renderValidation(sn) : '';
        var methodHtml      = renderPageHeader(sn);
        var verdictHtml     = renderVerdict(sn);
        var zoneAlertHtml   = sn.zones ? renderZoneAlerts(sn.zones)  : '';
        var zoneChartHtml   = sn.zones ? renderZoneComparison(sn)    : '';
        var nutrientsHtml   = (sn.nutrients && sn.nutrients.length)
            ? '<div class="sn-section"><div class="sn-section-title">Nutrient Status</div></div>'+
              '<div id="sn-nutrients-grid" class="sn-nutrients">'+renderNutrientCards(sn)+'</div>' : '';
        var mulderHtml      = renderMulder(sn);
        var ratiosHtml      = renderRatios(sn);
        var phHtml          = (sn.pH || sn.CEC)
            ? '<div class="sn-section"><div class="sn-section-title">pH &amp; CEC</div></div>'+renderPhCec(sn) : '';
        var correctionHtml  = renderCorrectionProgram(sn);
        var annualHtml      = renderAnnualRequirements(sn);
        var monthlyHtml     = renderMonthlyN(sn);
        var tissueHtml      = '<div class="sn-section"><div class="sn-section-title">Tissue Test Results</div></div>'+renderTissue(sn.tissue);
        var crossValHtml    = renderCrossValidation(sn);
        var contextHtml     = renderContext(sn);

        var planLink = '<div style="padding:16px 0;text-align:right">'+
            '<a href="/plan" style="font-size:13px;color:#236b4a;text-decoration:none;font-weight:500">→ View Nutrition Plan</a></div>';

        var bodyContent =
            (validationHtml ? '<div style="padding-top:16px">'+validationHtml+'</div>' : '')+
            '<div id="sn-verdict-wrap">'+(verdictHtml ? '<div style="padding:16px 0 4px">'+verdictHtml+'</div>' : '')+'</div>'+
            zoneAlertHtml+
            zoneChartHtml+
            nutrientsHtml+
            '<div id="sn-mulder-wrap">'+(mulderHtml ? '<div style="padding-bottom:12px">'+mulderHtml+'</div>' : '')+'</div>'+
            '<div id="sn-ratios-wrap">'+ratiosHtml+'</div>'+
            '<div id="sn-ph-wrap">'+phHtml+'</div>'+
            '<div id="sn-correction-wrap">'+correctionHtml+'</div>'+
            '<div id="sn-annual-wrap">'+annualHtml+'</div>'+
            monthlyHtml+
            tissueHtml+
            '<div id="sn-crossval-wrap">'+crossValHtml+'</div>'+
            contextHtml+
            planLink;

        container.innerHTML = '<div class="sn-page">'+
            methodHtml+
            '<div style="max-width:1100px;margin:0 auto;padding:0 20px 48px">'+
            bodyContent+
            '</div>'+
            '</div>';
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    function initInfoPopovers() {
        var popover = document.getElementById('db-info-popover');
        if (!popover || popover._gaipReady) return;
        popover._gaipReady = true;
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');
        var currentAnchor = null;

        function showPopover(anchor) {
            var entry = (global.GAIP_GLOSSARY || {})[anchor.dataset.info];
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

        document.addEventListener('click', function(e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) { e.stopPropagation(); if (currentAnchor === icon) hidePopover(); else showPopover(icon); return; }
            if (!popover.contains(e.target)) hidePopover();
        });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hidePopover(); });
        if (popClose) popClose.addEventListener('click', function(e) { e.stopPropagation(); hidePopover(); });
    }

    // ── Sample selector state ─────────────────────────────────────────────────
    var _snSamples   = [];
    var _snActiveIdx = -1;

    function buildDropdownRows(samples, activeIdx) {
        if (!samples.length) {
            return '<div style="padding:14px 12px;text-align:center;color:#9ca3af;font-size:12px">No samples found</div>';
        }
        return samples.map(function(s) {
            var origIdx = _snSamples.indexOf(s);
            var zone = esc(s.client_uid || ('Zone ' + (origIdx + 1)));
            var ref  = esc(s.lab_ref || s.lab_name || '—');
            var date = esc(fmtDate(s.lab_date || s.sample_date || '') || '—');
            return '<div class="sn-drop-row' + (origIdx === activeIdx ? ' active' : '') + '" data-sn-idx="' + origIdx + '">' +
                '<div class="sn-drop-cell-zone">' + zone + '</div>' +
                '<div class="sn-drop-cell-ref">'  + ref  + '</div>' +
                '<div class="sn-drop-cell-date">' + date + '</div>' +
                '</div>';
        }).join('');
    }

    function injectSampleDropdown() {
        var selector = document.getElementById('sn-sample-selector');
        if (!selector || !_snSamples.length) return;

        var active   = _snActiveIdx >= 0 ? _snSamples[_snActiveIdx] : null;
        var btnLabel = active
            ? esc(active.client_uid || ('Zone ' + (_snActiveIdx + 1)))
            : 'Select sample…';

        var svgSearch  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:#9ca3af"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
        var svgChevron = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:auto;flex-shrink:0"><path d="M6 9l6 6 6-6"/></svg>';

        var html =
            '<div class="sn-drop-wrap" id="sn-drop-wrap">' +
            '<button class="sn-drop-btn" id="sn-drop-btn" type="button">' + svgSearch + '<span id="sn-drop-label">' + btnLabel + '</span>' + svgChevron + '</button>' +
            '<div class="sn-drop-panel" id="sn-drop-panel">' +
            '<input class="sn-drop-search" id="sn-drop-search" type="text" placeholder="Filter by zone or date…" autocomplete="off">' +
            '<div class="sn-drop-header"><span>Zone</span><span>Lab Ref</span><span>Date</span></div>' +
            '<div class="sn-drop-list" id="sn-drop-list">' + buildDropdownRows(_snSamples, _snActiveIdx) + '</div>' +
            '</div></div>';

        selector.innerHTML = html;

        document.getElementById('sn-drop-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            var wrap = document.getElementById('sn-drop-wrap');
            wrap.classList.toggle('sn-drop-open');
            if (wrap.classList.contains('sn-drop-open')) {
                var s = document.getElementById('sn-drop-search');
                if (s) { s.value = ''; s.focus(); }
                var list = document.getElementById('sn-drop-list');
                if (list) list.innerHTML = buildDropdownRows(_snSamples, _snActiveIdx);
                wireRows();
            }
        });

        document.addEventListener('click', function(e) {
            var wrap = document.getElementById('sn-drop-wrap');
            if (wrap && !wrap.contains(e.target)) wrap.classList.remove('sn-drop-open');
        });

        document.getElementById('sn-drop-search').addEventListener('input', function() {
            var q = this.value.toLowerCase();
            var filtered = !q ? _snSamples : _snSamples.filter(function(s) {
                return (s.client_uid || '').toLowerCase().indexOf(q) >= 0 ||
                       (s.lab_ref   || '').toLowerCase().indexOf(q) >= 0 ||
                       (fmtDate(s.lab_date || s.sample_date || '') || '').toLowerCase().indexOf(q) >= 0;
            });
            var list = document.getElementById('sn-drop-list');
            if (list) { list.innerHTML = buildDropdownRows(filtered, _snActiveIdx); wireRows(); }
        });

        wireRows();
    }

    function snShowToast(msg, type) {
        var el = document.createElement('div');
        var bg = type === 'error' ? '#dc2626' : '#166534';
        el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:'+bg+';color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;z-index:9999;font-family:inherit;box-shadow:0 4px 12px rgba(0,0,0,.2);max-width:340px;line-height:1.4';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function(){ el.parentNode && el.parentNode.removeChild(el); }, 4000);
    }

    // ─── Sample persistence ───────────────────────────────────────────────────

    function _snStorageKey() {
        var sid = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId;
        return 'gilba_sn_sample' + (sid ? '_' + sid : '');
    }

    function _snSaveActiveId(sampleId) {
        try { localStorage.setItem(_snStorageKey(), sampleId); } catch(e) {}
    }

    function _snLoadActiveId() {
        try { return localStorage.getItem(_snStorageKey()); } catch(e) { return null; }
    }

    // Fetches analysis for `sample` via the server API, merges the result into
    // GAIP_DASHBOARD_DATA.computed.soilNutrition, and re-renders the section.
    // Non-soil-nutrition fields (annualDemand, tissue, zones, etc.) are preserved.
    function _snFetchAndRender(sample) {
        fetch('/api/samples/' + encodeURIComponent(sample.id) + '/analyse', {
            headers: { 'Accept': 'application/json' },
        })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(res) {
            var snData = res && res.data;
            if (!snData) return;
            if (global.GAIP_DASHBOARD_DATA) {
                if (!global.GAIP_DASHBOARD_DATA.computed) global.GAIP_DASHBOARD_DATA.computed = {};
                var existing = global.GAIP_DASHBOARD_DATA.computed.soilNutrition || {};
                global.GAIP_DASHBOARD_DATA.computed.soilNutrition = Object.assign({}, existing, snData);
            }
            render();
            injectSampleDropdown();
        })
        .catch(function() {
            snShowToast('Could not load analysis for this sample.', 'error');
            injectSampleDropdown();
        });
    }

    function wireRows() {
        var list = document.getElementById('sn-drop-list');
        if (!list) return;
        list.querySelectorAll('.sn-drop-row[data-sn-idx]').forEach(function(row) {
            row.addEventListener('click', function() {
                var idx    = parseInt(this.dataset.snIdx, 10);
                var sample = _snSamples[idx];
                if (!sample) return;

                var wrap = document.getElementById('sn-drop-wrap');
                if (wrap) wrap.classList.remove('sn-drop-open');

                _snActiveIdx = idx;
                _snSaveActiveId(sample.id);
                _snFetchAndRender(sample);
            });
        });
    }

    // Fetches soil samples for the active site and injects the sample selector.
    // Shown when ≥1 sample exists, pre-selects the currently displayed sample.
    // On page reload, restores the last user-selected sample automatically.
    function initZoneSamples() {
        var data = global.GAIP_DASHBOARD_DATA;
        var sn   = data && data.computed && data.computed.soilNutrition;
        if (!sn || !sn.nutrients || !sn.nutrients.length) return;

        var siteId = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId;
        if (!siteId) return;

        fetch('/api/samples?site_id=' + encodeURIComponent(siteId) + '&sample_type=soil&limit=100', {
            headers: { 'Accept': 'application/json' },
        })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(res) {
            var samples = (res && res.data) || [];
            if (!samples.length) return;
            samples.sort(function(a, b) {
                return (b.lab_date || b.sample_date || '').localeCompare(a.lab_date || a.sample_date || '');
            });
            _snSamples = samples;

            // Try persisted selection first
            var persistedId  = _snLoadActiveId();
            var persistedIdx = -1;
            if (persistedId) {
                for (var j = 0; j < samples.length; j++) {
                    if (samples[j].id === persistedId) { persistedIdx = j; break; }
                }
            }

            if (persistedIdx >= 0) {
                _snActiveIdx = persistedIdx;
            } else {
                // Fall back to matching by current page data
                _snActiveIdx = 0;
                var curLabel = sn.sampleLabel;
                var curDate  = sn.sampleDate ? String(sn.sampleDate).substring(0, 10) : null;
                for (var i = 0; i < samples.length; i++) {
                    var s = samples[i];
                    if (curLabel && s.client_uid === curLabel) { _snActiveIdx = i; break; }
                    if (curDate) {
                        var sd = (s.lab_date || s.sample_date || '').substring(0, 10);
                        if (sd && sd === curDate) { _snActiveIdx = i; break; }
                    }
                }
            }

            injectSampleDropdown();

            // If the persisted selection differs from what the page currently shows,
            // auto-fetch the correct analysis so all blocks reflect the right sample.
            if (persistedIdx >= 0 && (samples[persistedIdx].client_uid || '') !== (sn.sampleLabel || '')) {
                _snFetchAndRender(samples[persistedIdx]);
            }
        })
        .catch(function() {});
    }

    function init() {
        injectCSS();
        render();
        initInfoPopovers();
        initZoneSamples();
        // Register tab switcher on window for inline onclick handlers
        global.snZoneTab = function(btn, nut) {
            var wrap = btn.closest('.sn-page');
            if (!wrap) return;
            wrap.querySelectorAll('.sn-zone-tab').forEach(function(b){ b.classList.remove('active'); });
            wrap.querySelectorAll('.sn-zone-chart').forEach(function(c){ c.classList.remove('active'); });
            btn.classList.add('active');
            var chart = wrap.querySelector('.sn-zone-chart[data-nut="'+nut+'"]');
            if (chart) chart.classList.add('active');
        };
    }

    global.GAIP_SoilNutritionAnalysis = { init: init };

}(window));
