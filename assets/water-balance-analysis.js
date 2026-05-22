/**
 * Water Balance Analysis — /analysis#water-balance tab
 * Mirrors structure of soil-nutrition-analysis.js
 */

(function (global) {
    'use strict';

    if (global.GAIP_WaterBalanceAnalysis) return;

    // =========================================================================
    // GLOSSARY (i-icons)
    // =========================================================================

    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, {
        'wb-ecw': {
            title: 'ECw — Electrical Conductivity of Water',
            body:  'Measure of dissolved salts in irrigation water (dS/m).\n\n' +
                   '< 0.75 dS/m — Excellent, no restrictions\n' +
                   '0.75–1.5 — Good, minor restrictions on sensitive species\n' +
                   '1.5–3.0 — Moderate, increasing salt load in soil\n' +
                   '> 3.0 — High risk, leaching programme essential',
        },
        'wb-sar': {
            title: 'SAR — Sodium Adsorption Ratio',
            body:  'Relative proportion of sodium to calcium and magnesium. High SAR degrades soil structure by displacing Ca/Mg on exchange sites, causing compaction and poor infiltration.\n\n' +
                   'Formula: Na / √((Ca + Mg) / 2)   [all in meq/L]\n\n' +
                   '< 3 — Low sodium hazard\n' +
                   '3–9 — Medium — monitor infiltration\n' +
                   '9–18 — High — gypsum likely needed\n' +
                   '> 18 — Very high — corrective action urgent',
        },
        'wb-saradj': {
            title: 'SARadj — Adjusted SAR',
            body:  'Accounts for bicarbonate precipitation: when HCO₃ > Ca + Mg, calcium precipitates as calcite, raising the effective sodium hazard beyond what basic SAR shows.\n\n' +
                   'Calculated using Suarez (1981) pHc method. SARadj > SAR indicates a bicarbonate aggravation of sodium risk.',
        },
        'wb-rsc': {
            title: 'RSC — Residual Sodium Carbonate',
            body:  'RSC = (HCO₃ + CO₃) − (Ca + Mg)   [meq/L]\n\n' +
                   'Positive RSC means bicarbonate exceeds hardness — after soil drying, remaining Na₂CO₃ raises soil pH and sodium hazard.\n\n' +
                   '< 0 — Safe\n' +
                   '0–1.25 — Marginal\n' +
                   '> 1.25 — Unsuitable without acidification',
        },
        'wb-lf': {
            title: 'Leaching Fraction (LF)',
            body:  'Fraction of irrigation water that must pass through the root zone to prevent salt accumulation.\n\n' +
                   'LF = ECw / (5 × ECe_threshold − ECw)   [FAO 29]\n\n' +
                   'Applied as extra water beyond crop ET. Higher ECw = higher LF required. Recycled or poor-quality water may need 25–30%.',
        },
        'wb-lsi': {
            title: 'Langelier Saturation Index (LSI)',
            body:  'Indicates whether water will deposit or dissolve calcium carbonate scale in irrigation lines and nozzles.\n\n' +
                   'LSI = pH − pHs  (where pHs = saturation pH)\n\n' +
                   '> +0.5 — Scale-forming (CaCO₃ deposits, blocked nozzles)\n' +
                   '−0.5 to +0.5 — Balanced\n' +
                   '< −0.5 — Corrosive (dissolves calcium, aggressive to pipes)',
        },
        'wb-napct': {
            title: 'Sodium Percentage (Na%)',
            body:  'Na% = Na / (Na + Ca + Mg + K) × 100   [meq/L]\n\n' +
                   'Complements SAR. High Na% with low total ionic strength (soft water) can damage soil structure even at low SAR.\n\n' +
                   '< 20% — Safe\n' +
                   '20–40% — Marginal\n' +
                   '> 40% — Concern',
        },
        'wb-cl': {
            title: 'Chloride Toxicity',
            body:  'Chloride accumulates in leaf tissue causing marginal scorch, especially under sprinkler irrigation where foliage is wetted.\n\n' +
                   '< 4 meq/L — No restriction\n' +
                   '4–10 meq/L — Slight to moderate restriction\n' +
                   '> 10 meq/L — Severe restriction',
        },
        'wb-b': {
            title: 'Boron Toxicity',
            body:  'Boron is essential in trace amounts but toxic at levels >1 mg/L for sensitive species. It accumulates in older leaves causing tip and marginal necrosis.\n\n' +
                   '< 0.5 mg/L — Safe for all grasses\n' +
                   '0.5–1.0 mg/L — Caution with sensitive species\n' +
                   '> 1.0 mg/L — Restriction required',
        },
        'wb-fe': {
            title: 'Iron — Staining Risk',
            body:  'Iron in irrigation water causes orange-brown surface staining of turf, infrastructure and playing surfaces. It also clogs nozzles and promotes iron bacteria.\n\n' +
                   '< 0.2 mg/L — Safe\n' +
                   '0.2–1.0 mg/L — Staining possible\n' +
                   '> 1.0 mg/L — High staining and clogging risk',
        },
        'wb-salinity': {
            title: 'Salinity Growth Impact',
            body:  'Growth penalty calculated using the Maas-Hoffman (1977) model:\n\n' +
                   'Penalty = slope × (EC − threshold)\n\n' +
                   'Threshold varies by species: Seashore Paspalum 12 dS/m (excellent), Bermudagrass 6 dS/m, Tall Fescue 4 dS/m, Poa annua 2 dS/m.\n\n' +
                   'Takes the worst of ECw (water) and ECe (soil).',
        },
        'wb-deficit': {
            title: 'Net Water Deficit',
            body:  'Cumulative balance of crop water use (ETc) minus effective rainfall over the forecast period.\n\n' +
                   'Positive deficit = irrigation required to maintain soil moisture above the Readily Available Water (RAW) threshold and prevent turf stress.',
        },
        'wb-taw': {
            title: 'Total Available Water (TAW)',
            body:  'TAW = Available Water Capacity (AWC) × Root Zone Depth\n\n' +
                   'Maximum water the root zone can store between field capacity and wilting point. Depends on soil texture and root depth.\n\n' +
                   'Readily Available Water (RAW) = TAW × Management Allowable Depletion (MAD). Irrigation is triggered when depletion reaches RAW.',
        },
    });

    // =========================================================================
    // HELPERS
    // =========================================================================

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }
    function fmt(v, dec) {
        if (v == null || isNaN(v)) return '—';
        return Number(v).toFixed(dec == null ? 1 : dec);
    }
    function fmtDate(str) {
        if (!str) return null;
        try {
            var d = new Date(str);
            if (isNaN(d)) return str;
            return d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
        } catch(e) { return str; }
    }
    function infoBtn(key) {
        return '<button class="db-info-icon" data-info="'+esc(key)+'" tabindex="0" aria-label="Learn more">i</button>';
    }

    // =========================================================================
    // STATUS HELPERS
    // =========================================================================

    function ecwStatus(v) {
        if (v == null) return { label:'No data', cls:'no-data', color:'#6b7280' };
        if (v < 0.75)  return { label:'Excellent', cls:'adequate', color:'#15803d' };
        if (v < 1.5)   return { label:'Good',      cls:'adequate', color:'#166534' };
        if (v < 3.0)   return { label:'Moderate',  cls:'borderline', color:'#854d0e' };
        return               { label:'High risk',  cls:'deficient',  color:'#991b1b' };
    }
    function sarStatus(v) {
        if (v == null) return { label:'No data', cls:'no-data', color:'#6b7280' };
        if (v < 3)     return { label:'Low',     cls:'adequate', color:'#15803d' };
        if (v < 9)     return { label:'Medium',  cls:'borderline', color:'#854d0e' };
        if (v < 18)    return { label:'High',    cls:'deficient',  color:'#991b1b' };
        return               { label:'Very high',cls:'deficient',  color:'#7f1d1d' };
    }
    function rscStatus(v) {
        if (v == null)   return { label:'No data',  cls:'no-data',    color:'#6b7280' };
        if (v <= 0)      return { label:'Safe',      cls:'adequate',   color:'#15803d' };
        if (v <= 1.25)   return { label:'Marginal',  cls:'borderline', color:'#854d0e' };
        return                 { label:'Unsuitable', cls:'deficient',  color:'#991b1b' };
    }
    function lsiStatus(v) {
        if (v == null)  return { label:'No data',    cls:'no-data',    color:'#6b7280' };
        if (v > 0.5)    return { label:'Scale risk',  cls:'borderline', color:'#854d0e' };
        if (v < -0.5)   return { label:'Corrosive',   cls:'borderline', color:'#854d0e' };
        return                 { label:'Balanced',     cls:'adequate',   color:'#15803d' };
    }
    function lfStatus(v) {
        if (v == null)  return { label:'No data', cls:'no-data', color:'#6b7280' };
        if (v <= 12)    return { label:'Low',     cls:'adequate',   color:'#15803d' };
        if (v <= 20)    return { label:'Moderate',cls:'borderline', color:'#854d0e' };
        return                { label:'High',     cls:'deficient',  color:'#991b1b' };
    }

    function badgeHtml(label, cls) {
        var bg  = cls==='adequate'?'#dcfce7':cls==='borderline'?'#fef9c3':cls==='deficient'?'#fee2e2':'#f3f4f6';
        var clr = cls==='adequate'?'#166534':cls==='borderline'?'#854d0e':cls==='deficient'?'#991b1b':'#6b7280';
        return '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:'+bg+';color:'+clr+'">'+esc(label)+'</span>';
    }

    // =========================================================================
    // VERDICT
    // =========================================================================

    var WB_VERDICT_META = {
        ACCEPTABLE: {
            cls:'acceptable', title:'Irrigation Water Quality: Acceptable',
            sub:'No restrictions. Continue standard irrigation practices.',
            observation:'Water chemistry analysed for salinity, sodium hazard, and toxicity risks.',
            mechanism:'Poor water quality causes soil sodicity, reduced infiltration, and direct turf damage.',
            consequence:'Water quality is manageable with standard practices.',
            determination:'Monitor and maintain current practices.',
        },
        MONITOR: {
            cls:'monitor', title:'Irrigation Water Quality: Monitor',
            sub:'Borderline quality detected. Review and schedule corrective program.',
            observation:'Water chemistry analysed for salinity, sodium hazard, and toxicity risks.',
            mechanism:'Poor water quality causes soil sodicity, reduced infiltration, and direct turf damage.',
            consequence:'Continued use without monitoring may progressively degrade soil structure.',
            determination:'Schedule preventative gypsum and adjust leaching fraction.',
        },
        HIGH_RISK: {
            cls:'high_risk', title:'Irrigation Water Quality: High Risk',
            sub:'Action required. Performance degrading. Action within 30–90 days.',
            observation:'Water chemistry analysed for salinity, sodium hazard, and toxicity risks.',
            mechanism:'Poor water quality causes soil sodicity, reduced infiltration, and direct turf damage.',
            consequence:'Continued use without treatment will progressively damage soil structure.',
            determination:'Apply gypsum and increase leaching fraction.',
        },
        IMMINENT_FAILURE: {
            cls:'imminent_failure', title:'Irrigation Water Quality: Critical',
            sub:'Severe risk. Immediate intervention required to prevent turf loss.',
            observation:'Water chemistry analysed for salinity, sodium hazard, and toxicity risks.',
            mechanism:'Poor water quality causes soil sodicity, reduced infiltration, and direct turf damage.',
            consequence:'Severe water quality issues will cause rapid turf decline and unplayable conditions.',
            determination:'Implement water treatment system immediately or source alternative water.',
        },
        NO_DATA: {
            cls:'no_data', title:'Irrigation Water Quality: No Data',
            sub:'No water quality data available.',
            observation:null, mechanism:null, consequence:null, determination:null,
        },
    };

    function wbVerdict(wb) {
        var sar = parseFloat(wb.sar);
        var ecw = parseFloat(wb.ecw);
        if (isNaN(sar) && isNaN(ecw)) return 'NO_DATA';
        sar = isNaN(sar) ? 0 : sar;
        ecw = isNaN(ecw) ? 0 : ecw;
        if (sar >= 18)              return 'IMMINENT_FAILURE';
        if (sar >= 9 || ecw >= 3)   return 'HIGH_RISK';
        if (sar >= 3 || ecw >= 1.5) return 'MONITOR';
        return 'ACCEPTABLE';
    }

    function renderWbVerdict(wb) {
        var v    = wbVerdict(wb);
        var meta = WB_VERDICT_META[v] || WB_VERDICT_META.NO_DATA;
        if (!meta.observation) return '';
        var rows =
            '<div class="sn-verdict-rows">'+
            '<div class="sn-verdict-row"><strong>Observation</strong>'+esc(meta.observation)+'</div>'+
            '<div class="sn-verdict-row"><strong>Mechanism</strong>'+esc(meta.mechanism)+'</div>'+
            '<div class="sn-verdict-row"><strong>Consequence</strong>'+esc(meta.consequence)+'</div>'+
            '<div class="sn-verdict-row"><strong>Determination</strong>'+esc(meta.determination)+'</div>'+
            '</div>';
        return '<div class="sn-verdict '+meta.cls+'">'+
            '<div style="flex:1">'+
            '<div class="sn-verdict-title">'+esc(meta.title)+'</div>'+
            '<div class="sn-verdict-sub">'+esc(meta.sub)+'</div>'+
            rows+
            '</div></div>';
    }

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('wb-styles')) return;
        var el = document.createElement('style');
        el.id = 'wb-styles';
        el.textContent = [
            /* Layout */
            '.wb-page{min-height:100%}',
            /* Sections */
            '.wb-section{padding:20px 0 0}',
            '.wb-section-title{font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;border-bottom:1px solid #e5e7eb;margin-bottom:12px}',
            /* Quality cards grid */
            '.wb-quality-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;padding:0 0 16px}',
            '.wb-quality-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:4px}',
            '.wb-quality-card.deficient{border-color:#fca5a5;background:#fef2f2}',
            '.wb-quality-card.borderline{border-color:#fde68a;background:#fffbeb}',
            '.wb-quality-card.adequate{border-color:#bbf7d0;background:#f0fdf4}',
            '.wb-quality-label{font-size:11px;font-weight:600;color:#6b7280;display:flex;align-items:center;gap:4px}',
            '.wb-quality-value{font-size:22px;font-weight:700;color:#111827;line-height:1.1}',
            '.wb-quality-unit{font-size:11px;color:#6b7280}',
            '.wb-quality-status{margin-top:2px}',
            /* Ion table */
            '.wb-ion-table{width:100%;border-collapse:collapse;font-size:12px}',
            '.wb-ion-table th{background:#f9fafb;font-weight:600;color:#374151;padding:7px 10px;text-align:left;border-bottom:1px solid #e5e7eb}',
            '.wb-ion-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#374151}',
            '.wb-ion-table tr:last-child td{border-bottom:none}',
            '.wb-ion-table tr:hover td{background:#f9fafb}',
            /* Irrigation balance */
            '.wb-balance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px}',
            '.wb-balance-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center}',
            '.wb-balance-card.alert{background:#fef2f2;border-color:#fca5a5}',
            '.wb-balance-card.warn{background:#fffbeb;border-color:#fde68a}',
            '.wb-balance-label{font-size:11px;color:#6b7280;margin-bottom:4px}',
            '.wb-balance-value{font-size:20px;font-weight:700;color:#111827}',
            '.wb-balance-unit{font-size:11px;color:#9ca3af}',
            /* Schedule table */
            '.wb-schedule-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}',
            '.wb-schedule-table th{background:#f9fafb;font-weight:600;color:#374151;padding:6px 8px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:11px}',
            '.wb-schedule-table td{padding:6px 8px;text-align:center;border-bottom:1px solid #f3f4f6;color:#374151}',
            '.wb-schedule-table tr.irr-day td{background:#eff6ff}',
            '.wb-schedule-table tr.stress-day td{background:#fef2f2}',
            /* Empty state — matches sn-empty pattern */
            '.wb-empty{padding:40px 20px;text-align:center;color:#5b6a65}',
            '.wb-empty-title{font-size:15px;font-weight:600;color:#374151;margin-bottom:6px}',
            '.wb-empty-body{font-size:13px;line-height:1.6;max-width:420px;margin:0 auto}',
            /* Diagnostic cards — same CSS as sn-card in soil-nutrition */
            '.sn-card{background:#fff;border:1px solid #d8e0dc;border-radius:10px;padding:14px 16px;position:relative}',
            '.sn-card.deficient{border-color:#fca5a5;background:#fff8f8}',
            '.sn-card.borderline{border-color:#fde68a;background:#fffdf0}',
            '.sn-card.adequate,.sn-card.sufficient{border-color:#86efac;background:#f8fdf9}',
            '.sn-card.no-data{border-color:#e5e7eb;background:#f9fafb}',
            '.sn-card-nutrient{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65;margin-bottom:6px}',
            '.sn-card-value{font-size:26px;font-weight:700;line-height:1;color:#17231f;margin-bottom:2px}',
            '.sn-card-value span{font-size:13px;font-weight:400;color:#5b6a65}',
            '.sn-card-threshold{font-size:12px;color:#5b6a65;margin-bottom:8px}',
            '.sn-card-bar{height:5px;border-radius:3px;background:#e5e7eb;margin:8px 0;overflow:hidden}',
            '.sn-card-bar-fill{height:100%;border-radius:3px}',
            '.sn-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em}',
            '.sn-badge.deficient{background:#fee2e2;color:#991b1b}',
            '.sn-badge.borderline{background:#fef9c3;color:#854d0e}',
            '.sn-badge.adequate{background:#dcfce7;color:#166534}',
            '.sn-badge.no-data{background:#f3f4f6;color:#6b7280}',
            '.sn-why-btn{font-size:11px;color:#5b6a65;background:none;border:1px solid #d8e0dc;cursor:pointer;padding:3px 8px;border-radius:4px;margin-top:8px;display:inline-flex;align-items:center;gap:4px}',
            '.sn-why-btn:hover{background:#f3f4f6}',
            '.sn-why{margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:12px;color:#374151;line-height:1.5}',
            '.sn-why-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f3f4f6;gap:8px}',
            '.sn-why-row:last-child{border-bottom:none}',
            '.sn-why-label{color:#5b6a65;flex-shrink:0}',
            '.sn-why-val{font-weight:600;text-align:right}',
            '.sn-why-action{margin-top:6px;padding:6px 10px;background:#f5f7f6;border-radius:6px;border-left:3px solid #d8e0dc;font-size:11px;color:#374151}',
            '.sn-nutrients{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}',
            /* Verdict block — same as soil-nutrition sn-verdict */
            '.sn-verdict{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-radius:10px;border:1px solid;margin-bottom:4px}',
            '.sn-verdict.acceptable{background:#f0fdf4;border-color:#86efac;color:#14532d}',
            '.sn-verdict.monitor{background:#fffbeb;border-color:#fde68a;color:#78350f}',
            '.sn-verdict.high_risk{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d}',
            '.sn-verdict.imminent_failure{background:#fff1f2;border-color:#f87171;color:#7f1d1d}',
            '.sn-verdict-title{font-size:18px;font-weight:700;line-height:1.2;margin-bottom:4px}',
            '.sn-verdict-sub{font-size:13px;opacity:.85;line-height:1.5}',
            '.sn-verdict-rows{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}',
            '@media(max-width:600px){.sn-verdict-rows{grid-template-columns:1fr}}',
            '.sn-verdict-row{font-size:12px;line-height:1.5}',
            '.sn-verdict-row strong{text-transform:uppercase;font-size:10px;letter-spacing:.06em;opacity:.7;display:block}',
        ].join('\n');
        document.head.appendChild(el);
    }

    // =========================================================================
    // KPI CARD (mirrors gl-kpi-card from soil page)
    // =========================================================================

    function hexToRgb(hex) {
        var h = (hex || '#2d6a4f').replace('#', '');
        return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
    }
    function kpiCard(label, value, unit, statusHtml, color, infoKey) {
        var rgb    = hexToRgb(color);
        var bg     = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.07)';
        var border = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.25)';
        return [
            '<div class="gl-kpi-card" style="background:'+bg+';border-color:'+border+';border-left-color:'+color+'">',
            '  <div class="gl-kpi-label">'+esc(label)+(infoKey?' '+infoBtn(infoKey):'')+'</div>',
            '  <div class="gl-kpi-value" style="color:'+color+'">'+esc(value)+'</div>',
            '  <div class="gl-kpi-unit">'+esc(unit)+'</div>',
            '  <div>'+statusHtml+'</div>',
            '</div>',
        ].join('');
    }

    // =========================================================================
    // 1. PAGE HEADER
    // =========================================================================

    function renderPageHeader(wb) {
        var cards = [];

        // Card 1: ECw
        var ecwSt = ecwStatus(wb.ecw);
        cards.push(kpiCard(
            'Water EC', wb.ecw != null ? fmt(wb.ecw, 2) : '—', 'dS/m',
            '<div>'+badgeHtml(ecwSt.label, ecwSt.cls)+'</div>',
            ecwSt.cls === 'adequate' ? '#15803d' : ecwSt.cls === 'borderline' ? '#d97706' : '#dc2626',
            'wb-ecw'
        ));

        // Card 2: SAR
        var sarSt = sarStatus(wb.SAR);
        cards.push(kpiCard(
            'Sodium (SAR)', wb.SAR != null ? fmt(wb.SAR, 1) : '—', 'meq/L ratio',
            '<div>'+badgeHtml(sarSt.label, sarSt.cls)+'</div>',
            sarSt.cls === 'adequate' ? '#15803d' : sarSt.cls === 'borderline' ? '#d97706' : '#dc2626',
            'wb-sar'
        ));

        // Card 3: Weekly Irrigation Need
        var irrColor = '#1d4ed8';
        var irrVal   = wb.weeklyNeed != null ? Math.round(wb.weeklyNeed) + '' : '—';
        var irrBadge = wb.weeklyNeed != null
            ? (wb.weeklyNeed > 30 ? badgeHtml('High demand','deficient') : wb.weeklyNeed > 15 ? badgeHtml('Moderate','borderline') : badgeHtml('Low','adequate'))
            : '<div></div>';
        cards.push(kpiCard('Weekly Irrigation', irrVal, 'mm/week', '<div>'+irrBadge+'</div>', irrColor, 'wb-deficit'));

        // Card 4: Salinity status
        var salSt = wb.salinity && wb.salinity.statusClass
            ? { label: wb.salinity.statusLabel || wb.salinity.status || 'Unknown', cls: wb.salinity.statusClass }
            : ecwStatus(wb.ecw);
        var salColor = salSt.cls === 'adequate' ? '#15803d' : salSt.cls === 'borderline' ? '#d97706' : '#dc2626';
        cards.push(kpiCard(
            'Salinity Status', wb.ecw != null ? fmt(wb.ecw, 2) : '—', 'dS/m ECw',
            '<div>'+badgeHtml(salSt.label, salSt.cls)+'</div>',
            salColor,
            'wb-salinity'
        ));

        // Source info line
        var sourceInfo = '';
        if (wb.sourceLabel || wb.source || wb.testDate) {
            var parts = [];
            if (wb.sourceLabel) parts.push(wb.sourceLabel);
            if (wb.source)      parts.push(wb.source);
            if (wb.testDate)    parts.push('Tested ' + (fmtDate(wb.testDate) || wb.testDate));
            if (wb.recycled)    parts.push('Recycled water');
            sourceInfo = '<div style="font-size:12px;color:#6b7280;margin-top:2px">'+esc(parts.join(' · '))+'</div>';
        }

        return [
            '<div class="gl-header">',
            '<div class="gl-header-inner">',
            '<div style="display:flex;align-items:center;margin-bottom:2px">',
            '<h1 class="gl-title">Water Balance Analysis</h1>',
            '</div>',
            '<div class="gl-subtitle">Irrigation water quality, salinity impact &amp; soil moisture balance</div>',
            sourceInfo,
            '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+cards.join('')+'</div>',
            '</div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // 2. WATER QUALITY CARDS
    // =========================================================================

    function renderWaterQuality(wb) {
        var rows = [];

        function qcard(label, value, unit, st, infoKey) {
            return '<div class="wb-quality-card '+st.cls+'">'+
                '<div class="wb-quality-label">'+esc(label)+' '+infoBtn(infoKey)+'</div>'+
                '<div class="wb-quality-value">'+esc(value != null ? value : '—')+'</div>'+
                '<div class="wb-quality-unit">'+esc(unit)+'</div>'+
                '<div class="wb-quality-status">'+badgeHtml(st.label, st.cls)+'</div>'+
                '</div>';
        }

        var cards = [
            qcard('ECw', wb.ecw != null ? fmt(wb.ecw, 2) : null, 'dS/m', ecwStatus(wb.ecw), 'wb-ecw'),
            qcard('SAR', wb.SAR != null ? fmt(wb.SAR, 1) : null, 'meq/L ratio', sarStatus(wb.SAR), 'wb-sar'),
        ];

        if (wb.SARadj != null) {
            var adjDiff = wb.SARadj - wb.SAR;
            var adjNote = adjDiff > 0.5 ? 'borderline' : 'adequate';
            cards.push(qcard('SARadj', fmt(wb.SARadj, 1), 'bicarbonate-adjusted',
                { label: adjDiff > 0.5 ? '+'+fmt(adjDiff,1)+' vs SAR' : 'Minimal adjustment', cls: adjNote }, 'wb-saradj'));
        }
        if (wb.RSC != null) {
            cards.push(qcard('RSC', fmt(wb.RSC, 2), 'meq/L', rscStatus(wb.RSC), 'wb-rsc'));
        }
        if (wb.pH != null) {
            var phSt = wb.pH < 6.5 ? {label:'Acidic',cls:'borderline'} : wb.pH > 8.5 ? {label:'Alkaline',cls:'borderline'} : {label:'OK',cls:'adequate'};
            cards.push(qcard('pH', fmt(wb.pH, 1), '', phSt, 'wb-lsi'));
        }
        if (wb.leachingFraction != null) {
            cards.push(qcard('Leaching Req.', wb.leachingFraction+'%', 'of irrigation volume', lfStatus(wb.leachingFraction), 'wb-lf'));
        }
        if (wb.LSI != null) {
            cards.push(qcard('LSI', fmt(wb.LSI, 2), '', lsiStatus(wb.LSI), 'wb-lsi'));
        }
        if (wb.naPct != null) {
            var naSt = wb.naPct < 20 ? {label:'Safe',cls:'adequate'} : wb.naPct < 40 ? {label:'Marginal',cls:'borderline'} : {label:'Concern',cls:'deficient'};
            cards.push(qcard('Na%', fmt(wb.naPct, 1), '%', naSt, 'wb-napct'));
        }

        if (!cards.length) return '';
        return '<div class="wb-section">'+
            '<div class="wb-section-title">Water Quality Parameters</div>'+
            '</div>'+
            '<div class="wb-quality-grid">'+cards.join('')+'</div>';
    }

    // =========================================================================
    // 3. ION ANALYSIS TABLE
    // =========================================================================

    function renderIons(wb) {
        var ions = wb.ions || {};
        var hasIons = Object.keys(ions).some(function(k){ return ions[k] > 0; });
        if (!hasIons && wb.B == null && wb.Fe == null) return '';

        // Cations table
        var rows = '';
        function ionRow(name, meq, thLo, thHi, unit, tip) {
            if (!meq && meq !== 0) return '';
            var st = meq > thHi ? 'deficient' : meq > thLo ? 'borderline' : 'adequate';
            return '<tr><td>'+esc(name)+(tip?' '+infoBtn(tip):'')+'</td>'+
                '<td>'+fmt(meq, 2)+'</td>'+
                '<td>'+fmt(meq * (unit==='Ca'?20.04:unit==='Mg'?12.15:unit==='Na'?23:unit==='K'?39.1:unit==='HCO3'?61:unit==='Cl'?35.45:unit==='SO4'?48:1), 1)+'</td>'+
                '<td>'+badgeHtml(st==='adequate'?'Normal':st==='borderline'?'Elevated':'High',st)+'</td>'+
                '</tr>';
        }

        var tbl = '<table class="wb-ion-table">'+
            '<thead><tr><th>Ion</th><th>meq/L</th><th>mg/L</th><th>Status</th></tr></thead><tbody>';

        // Cations
        if (ions.Ca)  tbl += '<tr><td>Calcium (Ca)</td><td>'+fmt(ions.Ca,2)+'</td><td>'+fmt(ions.Ca*20.04,1)+'</td><td>'+badgeHtml('Normal','adequate')+'</td></tr>';
        if (ions.Mg)  tbl += '<tr><td>Magnesium (Mg)</td><td>'+fmt(ions.Mg,2)+'</td><td>'+fmt(ions.Mg*12.15,1)+'</td><td>'+badgeHtml('Normal','adequate')+'</td></tr>';
        if (ions.Na) {
            var naSt2 = ions.Na > 3 ? 'deficient' : ions.Na > 1.5 ? 'borderline' : 'adequate';
            tbl += '<tr><td>Sodium (Na) '+infoBtn('wb-napct')+'</td><td>'+fmt(ions.Na,2)+'</td><td>'+fmt(ions.Na*23,1)+'</td><td>'+badgeHtml(naSt2==='adequate'?'Normal':naSt2==='borderline'?'Elevated':'High',naSt2)+'</td></tr>';
        }
        if (ions.K)   tbl += '<tr><td>Potassium (K)</td><td>'+fmt(ions.K,2)+'</td><td>'+fmt(ions.K*39.1,1)+'</td><td>'+badgeHtml('Normal','adequate')+'</td></tr>';
        // Anions
        if (ions.HCO3) tbl += '<tr><td>Bicarbonate (HCO₃)</td><td>'+fmt(ions.HCO3,2)+'</td><td>'+fmt(ions.HCO3*61,1)+'</td><td>'+badgeHtml(ions.HCO3>4?'High':ions.HCO3>1.5?'Moderate':'Normal',ions.HCO3>4?'deficient':ions.HCO3>1.5?'borderline':'adequate')+'</td></tr>';
        if (ions.CO3)  tbl += '<tr><td>Carbonate (CO₃)</td><td>'+fmt(ions.CO3,2)+'</td><td>'+fmt(ions.CO3*30,1)+'</td><td>'+badgeHtml(ions.CO3>0.5?'Elevated':'Trace',ions.CO3>0.5?'borderline':'adequate')+'</td></tr>';
        if (ions.Cl) {
            var clSt = ions.Cl > 10 ? 'deficient' : ions.Cl > 4 ? 'borderline' : 'adequate';
            tbl += '<tr><td>Chloride (Cl) '+infoBtn('wb-cl')+'</td><td>'+fmt(ions.Cl,2)+'</td><td>'+fmt(ions.Cl*35.45,1)+'</td><td>'+badgeHtml(clSt==='adequate'?'Safe':clSt==='borderline'?'Caution':'Toxic',clSt)+'</td></tr>';
        }
        if (ions.SO4)  tbl += '<tr><td>Sulphate (SO₄)</td><td>'+fmt(ions.SO4,2)+'</td><td>'+fmt(ions.SO4*48,1)+'</td><td>'+badgeHtml('Normal','adequate')+'</td></tr>';
        // Trace
        if (wb.B != null) {
            var bSt = wb.B > 1 ? 'deficient' : wb.B > 0.5 ? 'borderline' : 'adequate';
            tbl += '<tr><td>Boron (B) '+infoBtn('wb-b')+'</td><td>—</td><td>'+fmt(wb.B,2)+'</td><td>'+badgeHtml(bSt==='adequate'?'Safe':bSt==='borderline'?'Caution':'Toxic',bSt)+'</td></tr>';
        }
        if (wb.Fe != null) {
            var feSt = wb.Fe > 1 ? 'deficient' : wb.Fe > 0.2 ? 'borderline' : 'adequate';
            tbl += '<tr><td>Iron (Fe) '+infoBtn('wb-fe')+'</td><td>—</td><td>'+fmt(wb.Fe,2)+'</td><td>'+badgeHtml(feSt==='adequate'?'Safe':feSt==='borderline'?'Staining risk':'High risk',feSt)+'</td></tr>';
        }

        tbl += '</tbody></table>';

        return '<div class="wb-section">'+
            '<div class="wb-section-title">Ion Analysis</div>'+
            '</div>'+tbl;
    }

    // =========================================================================
    // 4. SALINITY IMPACT
    // =========================================================================

    function renderSalinity(wb) {
        var s = wb.salinity;
        if (!s && wb.ecw == null) return '';

        // Compute Maas-Hoffman penalty from ECw if no engine result
        var penaltyPct = null, threshold = null;
        if (s) {
            penaltyPct = s.growthPenaltyPct;
            threshold  = s.thresholdECw;
        }

        var rows = '';
        if (penaltyPct != null) {
            var pSt = penaltyPct < 5 ? 'adequate' : penaltyPct < 20 ? 'borderline' : 'deficient';
            rows += '<tr><td>Growth penalty '+infoBtn('wb-salinity')+'</td>'+
                '<td><strong>'+fmt(penaltyPct,1)+'%</strong></td>'+
                '<td>'+badgeHtml(penaltyPct<5?'Negligible':penaltyPct<20?'Minor':'Significant',pSt)+'</td></tr>';
        }
        if (threshold != null) {
            rows += '<tr><td>Species tolerance threshold</td><td>'+fmt(threshold,1)+' dS/m</td><td></td></tr>';
        }
        if (wb.ecw != null) {
            rows += '<tr><td>Water EC (ECw)</td><td>'+fmt(wb.ecw,2)+' dS/m</td><td></td></tr>';
        }
        if (s && s.effectiveEC != null) {
            rows += '<tr><td>Effective EC (heat-adjusted)</td><td>'+fmt(s.effectiveEC,2)+' dS/m</td><td>'+badgeHtml('Climate corrected','borderline')+'</td></tr>';
        }
        if (s && s.adjustedReduction != null) {
            rows += '<tr><td>Combined stress penalty</td><td>'+fmt(s.adjustedReduction,1)+'%</td><td>'+badgeHtml('Heat × salinity','borderline')+'</td></tr>';
        }
        if (wb.leachingFraction != null) {
            rows += '<tr><td>Leaching fraction required '+infoBtn('wb-lf')+'</td><td>'+wb.leachingFraction+'%</td><td></td></tr>';
        }

        if (!rows) return '';

        return '<div class="wb-section">'+
            '<div class="wb-section-title">Salinity Impact (Maas-Hoffman)</div>'+
            '</div>'+
            '<table class="wb-ion-table" style="margin-bottom:16px"><thead><tr><th>Parameter</th><th>Value</th><th></th></tr></thead>'+
            '<tbody>'+rows+'</tbody></table>';
    }

    // =========================================================================
    // 5. IRRIGATION BALANCE
    // =========================================================================

    function renderIrrigationBalance(wb) {
        var hasBalance = wb.weeklyNeed != null || wb.netDeficit != null || wb.waterBalance;
        if (!hasBalance) return '';

        var cards = '';
        var wbal = wb.waterBalance || {};

        if (wb.netDeficit != null) {
            var defSt = wb.netDeficit > 30 ? 'alert' : wb.netDeficit > 10 ? 'warn' : '';
            cards += '<div class="wb-balance-card '+defSt+'">'+
                '<div class="wb-balance-label">Net Deficit '+infoBtn('wb-deficit')+'</div>'+
                '<div class="wb-balance-value">'+Math.round(wb.netDeficit)+'</div>'+
                '<div class="wb-balance-unit">mm</div></div>';
        }
        if (wb.weeklyNeed != null) {
            cards += '<div class="wb-balance-card">'+
                '<div class="wb-balance-label">Weekly Irrigation</div>'+
                '<div class="wb-balance-value">'+Math.round(wb.weeklyNeed)+'</div>'+
                '<div class="wb-balance-unit">mm/week</div></div>';
        }
        if (wbal.taw) {
            cards += '<div class="wb-balance-card">'+
                '<div class="wb-balance-label">TAW '+infoBtn('wb-taw')+'</div>'+
                '<div class="wb-balance-value">'+Math.round(wbal.taw)+'</div>'+
                '<div class="wb-balance-unit">mm</div></div>';
        }
        if (wbal.raw) {
            cards += '<div class="wb-balance-card">'+
                '<div class="wb-balance-label">RAW</div>'+
                '<div class="wb-balance-value">'+Math.round(wbal.raw)+'</div>'+
                '<div class="wb-balance-unit">mm</div></div>';
        }
        if (wbal.currentDepletion != null) {
            var depPct = wbal.depletionFraction != null ? Math.round(wbal.depletionFraction * 100) : null;
            var depSt2 = depPct != null && depPct > 70 ? 'alert' : depPct != null && depPct > 40 ? 'warn' : '';
            cards += '<div class="wb-balance-card '+depSt2+'">'+
                '<div class="wb-balance-label">Current Depletion</div>'+
                '<div class="wb-balance-value">'+(depPct != null ? depPct+'%' : Math.round(wbal.currentDepletion)+' mm')+'</div>'+
                '<div class="wb-balance-unit">'+(depPct != null ? 'of TAW' : 'mm')+'</div></div>';
        }

        var schedHtml = '';
        if (wb.schedule7 && wb.schedule7.length) {
            schedHtml = '<table class="wb-schedule-table"><thead><tr>'+
                '<th>Date</th><th>ET₀</th><th>ETc</th><th>Rain</th><th>Net</th><th>Depletion</th><th>Irrigation</th>'+
                '</tr></thead><tbody>';
            wb.schedule7.forEach(function(d) {
                var irr = d.irrigation;
                var dep = d.depletionPct != null ? Math.round(d.depletionPct)+'%' : '—';
                var cls = irr ? 'irr-day' : (d.status === 'stressed' || d.status === 'critical') ? 'stress-day' : '';
                schedHtml += '<tr class="'+cls+'">'+
                    '<td>'+(d.dayName || d.date || '')+'</td>'+
                    '<td>'+(d.et0 != null ? fmt(d.et0,1) : '—')+'</td>'+
                    '<td>'+(d.etc != null ? fmt(d.etc,1) : '—')+'</td>'+
                    '<td>'+(d.precipitation != null ? fmt(d.precipitation,1) : '—')+'</td>'+
                    '<td>'+(d.netChange != null ? fmt(d.netChange,1) : '—')+'</td>'+
                    '<td>'+dep+'</td>'+
                    '<td>'+(irr ? '<strong>'+Math.round(irr.totalDepth)+'mm</strong>' : '—')+'</td>'+
                    '</tr>';
            });
            schedHtml += '</tbody></table>'+
                '<div style="font-size:11px;color:#6b7280;margin-top:4px">'+
                '<span style="display:inline-block;width:10px;height:10px;background:#eff6ff;border:1px solid #93c5fd;margin-right:4px;vertical-align:middle"></span>Irrigation day &nbsp;'+
                '<span style="display:inline-block;width:10px;height:10px;background:#fef2f2;border:1px solid #fca5a5;margin-right:4px;vertical-align:middle"></span>Stress day'+
                '</div>';
        }

        return '<div class="wb-section">'+
            '<div class="wb-section-title">Irrigation Balance</div>'+
            '</div>'+
            '<div class="wb-balance-grid">'+cards+'</div>'+
            schedHtml;
    }

    // =========================================================================
    // 6. RECOMMENDATIONS
    // =========================================================================

    // =========================================================================
    // DIAGNOSTIC CARDS (from calculateWaterDiagnostics — same data as Hub page)
    // =========================================================================

    function renderDiagnostics(wb) {
        var diags = wb.diagnostics;
        if (!Array.isArray(diags) || !diags.length) return '';

        // Bar percentage based on status tier
        var BAR_PCT = { adequate: 85, borderline: 42, deficient: 12 };
        var BAR_CLR = { adequate: '#22c55e', borderline: '#f59e0b', deficient: '#ef4444' };

        function diagCard(d, idx) {
            var cls = d.statusClass === 'status-deficient' ? 'deficient'
                    : d.statusClass === 'status-borderline' ? 'borderline' : 'adequate';
            var barPct = BAR_PCT[cls] || 85;
            var barClr = BAR_CLR[cls] || '#22c55e';

            var whyId = 'wb-why-' + idx;
            var whyRows = '';
            if (d.driver) {
                whyRows += '<div class="sn-why-row"><span class="sn-why-label">Assessment</span><span class="sn-why-val">'+esc(d.driver)+'</span></div>';
            }
            var actionHtml = d.recommendation
                ? '<div class="sn-why-action">'+esc(d.recommendation)+'</div>' : '';
            var whyHtml = (whyRows || actionHtml)
                ? '<button class="sn-why-btn" onclick="(function(b){var el=document.getElementById(\''+whyId+'\');var open=el.style.display===\'block\';el.style.display=open?\'none\':\'block\';b.textContent=open?\'Why? ▼\':\'▲ Hide\'})(this)">Why? &#9660;</button>'+
                  '<div id="'+whyId+'" class="sn-why" style="display:none">'+whyRows+actionHtml+'</div>'
                : '';

            return '<div class="sn-card '+cls+'">'+
                '<div class="sn-card-nutrient">'+esc(d.label)+'</div>'+
                '<div class="sn-card-value">'+esc(d.value)+(d.unit ? ' <span>'+esc(d.unit)+'</span>' : '')+'</div>'+
                '<div class="sn-card-bar"><div class="sn-card-bar-fill" style="width:'+barPct+'%;background:'+barClr+'"></div></div>'+
                '<div><span class="sn-badge '+cls+'">'+esc(d.status)+'</span></div>'+
                whyHtml+
                '</div>';
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#236b4a"></div>',
            '    <div class="gl-block-title">Water Quality Analysis</div>',
            '    <div class="gl-block-sub">'+diags.length+' parameter'+(diags.length !== 1 ? 's' : '')+'</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="sn-nutrients">'+diags.map(diagCard).join('')+'</div>',
            '  </div>',
            '</div>',
        ].join('\n');
    }

    function renderRecommendations(wb) {
        var recs = [];

        // SAR / Sodium
        if (wb.SAR != null) {
            if (wb.SAR >= 9) {
                recs.push({ sev:'high', title:'High Sodium Hazard', body:'Apply gypsum (CaSO₄) to displace Na from exchange sites. Typical rate 1–3 t/ha depending on severity. Irrigate immediately after application. Check infiltration rates monthly.' });
            } else if (wb.SAR >= 3) {
                recs.push({ sev:'medium', title:'Moderate Sodium Risk', body:'Monitor soil infiltration. Consider periodic gypsum applications and acidification if pH > 7.5. Review irrigation scheduling to avoid over-wetting.' });
            }
        }
        // SARadj aggravation
        if (wb.SARadj != null && wb.SAR != null && (wb.SARadj - wb.SAR) > 1) {
            recs.push({ sev:'medium', title:'Bicarbonate Aggravating Sodium Risk', body:'Bicarbonate is precipitating calcium, raising effective sodium hazard. Consider acid injection (sulphuric or phosphoric acid) to neutralise HCO₃ and maintain Ca in solution.' });
        }
        // RSC
        if (wb.RSC != null && wb.RSC > 1.25) {
            recs.push({ sev:'high', title:'High Residual Sodium Carbonate', body:'Water is unsuitable without acidification. Inject acid to reduce alkalinity below 1.25 meq/L before applying to turf. Blending with lower-alkalinity source water is an alternative.' });
        }
        // ECw
        if (wb.ecw != null && wb.ecw > 3) {
            recs.push({ sev:'high', title:'High Salinity — Leaching Critical', body:'Maintain leaching fraction of '+( wb.leachingFraction || 25)+'%+ to prevent soil salt accumulation. Monitor soil ECe regularly. Avoid fertiliser applications during heat stress.' });
        } else if (wb.ecw != null && wb.ecw > 1.5) {
            recs.push({ sev:'medium', title:'Moderate Salinity', body:'Apply leaching fractions of '+(wb.leachingFraction || 15)+'% periodically to flush accumulated salts. Monitor soil EC at root zone depth.' });
        }
        // LSI
        if (wb.LSI != null && wb.LSI > 0.5) {
            recs.push({ sev:'medium', title:'Scale-Forming Water', body:'CaCO₃ scale risk in irrigation lines and nozzles. Inject acid to lower LSI below +0.5. Flush lines periodically.' });
        } else if (wb.LSI != null && wb.LSI < -0.5) {
            recs.push({ sev:'medium', title:'Corrosive Water', body:'Water may dissolve calcium from soil and infrastructure. Consider calcium injection or blending with harder water source.' });
        }
        // Fe staining
        if (wb.Fe != null && wb.Fe > 0.2) {
            recs.push({ sev: wb.Fe > 1 ? 'high' : 'medium', title:'Iron Staining Risk', body:'Install aeration or oxidation treatment to precipitate Fe before delivery. Flush lines weekly. Consider citric acid treatment of affected areas.' });
        }
        // B toxicity
        if (wb.B != null && wb.B > 0.5) {
            recs.push({ sev: wb.B > 1 ? 'high' : 'medium', title:'Boron Toxicity Risk', body:'Boron accumulates in leaf tissue. Leaching is the primary management tool — apply excess water periodically. Avoid boron-containing fertilisers.' });
        }
        // Net deficit
        if (wb.netDeficit != null && wb.netDeficit > 20) {
            recs.push({ sev:'medium', title:'Irrigation Deficit', body:'Cumulative water deficit of '+Math.round(wb.netDeficit)+'mm. Increase irrigation frequency or run times to maintain soil moisture above RAW threshold.' });
        }

        if (!recs.length) {
            recs.push({ sev:'low', title:'Water quality within acceptable limits', body:'Continue monitoring. Re-test water annually or when source changes.' });
        }

        function recHtml(r) {
            var cls   = r.sev === 'high' ? 'critical' : r.sev === 'medium' ? 'week' : 'monitor';
            var label = r.sev === 'high' ? 'Critical'  : r.sev === 'medium' ? 'This Week' : 'Monitor';
            return '<div class="gl-rec '+cls+'">'+
                '<div class="gl-rec-priority">'+label+'</div>'+
                '<strong>'+esc(r.title)+'</strong> — '+esc(r.body)+
                '</div>';
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#236b4a"></div>',
            '    <div class="gl-block-title">Recommendations</div>',
            '    <div class="gl-block-sub">'+recs.length+' action'+(recs.length !== 1 ? 's' : '')+'</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="gl-rec-list">'+recs.map(recHtml).join('')+'</div>',
            '  </div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // EMPTY STATE
    // =========================================================================

    function renderEmpty(container) {
        container.innerHTML =
            '<div class="wb-empty">'+
            '<div class="wb-empty-title">No Water Balance Data</div>'+
            '<div class="wb-empty-body">Add Water Quality data in the Hub and run the analysis to see results here.</div>'+
            '</div>';
    }

    // =========================================================================
    // INFO POPOVERS (same pattern as soil-nutrition-analysis.js)
    // =========================================================================

    function initInfoPopovers() {
        var popover = document.getElementById('db-info-popover');
        if (!popover || popover._gaipReady) return;
        popover._gaipReady = true;

        function positionPopover(anchor) {
            var ar = anchor.getBoundingClientRect();
            var pr = popover.getBoundingClientRect();
            var top = ar.bottom + 8;
            var left = ar.left + ar.width / 2 - pr.width / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
            popover.style.top  = top + 'px';
            popover.style.left = left + 'px';
            var arrow = document.getElementById('db-info-popover-arrow');
            if (arrow) arrow.style.left = (ar.left + ar.width / 2 - left) + 'px';
        }

        function showPopover(anchor) {
            var key   = anchor.dataset.info;
            var entry = (global.GAIP_GLOSSARY || {})[key];
            if (!entry) return;
            document.getElementById('db-info-popover-title').textContent = entry.title || '';
            document.getElementById('db-info-popover-body').textContent  = entry.body  || '';
            popover.style.display = 'block';
            positionPopover(anchor);
        }
        function hidePopover() { popover.style.display = 'none'; }

        document.addEventListener('click', function(e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) { e.stopPropagation(); showPopover(icon); return; }
            if (!popover.contains(e.target)) hidePopover();
        });
        var closeBtn = document.getElementById('db-info-popover-close');
        if (closeBtn) closeBtn.addEventListener('click', hidePopover);
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById('wb-page-content');
        if (!container) return;

        var data = global.GAIP_DASHBOARD_DATA;
        var wb   = data && data.computed && data.computed.waterBalance;

        injectStyles();

        if (!wb) { renderEmpty(container); return; }

        initInfoPopovers();

        var headerHtml  = renderPageHeader(wb);
        var verdictHtml = renderWbVerdict(wb);
        var recHtml     = renderRecommendations(wb);
        var qualityHtml = renderWaterQuality(wb);
        var ionHtml     = renderIons(wb);
        var salHtml     = renderSalinity(wb);
        var diagHtml    = renderDiagnostics(wb);
        var irrHtml     = renderIrrigationBalance(wb);

        var bodyContent = verdictHtml + recHtml + diagHtml + qualityHtml + ionHtml + salHtml + irrHtml;

        container.innerHTML =
            '<div class="wb-page">'+
            headerHtml+
            '<div class="gl-body">'+
            bodyContent+
            '</div>'+
            '</div>';
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_WaterBalanceAnalysis = {
        init: function() { render(); }
    };

}(typeof window !== 'undefined' ? window : this));
