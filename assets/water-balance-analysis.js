/**
 * Water Balance Analysis — /analysis#water-balance tab
 * Mirrors structure of soil-nutrition-analysis.js
 */

(function (global) {
    'use strict';

    if (global.GAIP_WaterBalanceAnalysis) return;

    // ─── Sample selector state ────────────────────────────────────────────────
    var _wbSoilSamples    = [];
    var _wbWaterSamples   = [];
    var _wbSoilActiveIdx  = -1;
    var _wbWaterActiveIdx = -1;

    function _wbSaveActiveId(type, id) {
        try { localStorage.setItem('gilba_wb_active_' + type, id); } catch(e) {}
    }
    function _wbLoadActiveId(type) {
        try { return localStorage.getItem('gilba_wb_active_' + type) || null; } catch(e) { return null; }
    }
    function _wbShowToast(msg, type) {
        var el = document.createElement('div');
        var bg = type === 'error' ? '#dc2626' : type === 'info' ? '#1d4ed8' : '#166534';
        el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + bg + ';color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;z-index:9999;font-family:inherit;box-shadow:0 4px 12px rgba(0,0,0,.2);max-width:360px;line-height:1.4';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function() { el.parentNode && el.parentNode.removeChild(el); }, 5000);
    }

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
            /* Sample selectors (reuse sn-drop-* pattern from soil-nutrition) */
            '.sn-drop-wrap{position:relative;display:block;font-family:inherit}',
            '.sn-drop-btn{display:flex;align-items:center;gap:7px;padding:7px 12px;background:#fff;border:1px solid #d8e0dc;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#17231f;width:100%;box-sizing:border-box;max-width:560px;font-family:inherit;text-align:left}',
            '.sn-drop-btn:hover{border-color:#2da85e}',
            '.sn-drop-open .sn-drop-btn{border-color:#2da85e;border-bottom-left-radius:0;border-bottom-right-radius:0}',
            '.sn-drop-panel{display:none;position:absolute;top:100%;left:0;z-index:200;background:#fff;border:1px solid #2da85e;border-top:none;border-radius:0 8px 8px 8px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:560px;max-width:min(720px,90vw)}',
            '.sn-drop-open .sn-drop-panel{display:block}',
            '.sn-drop-search{display:block;width:100%;box-sizing:border-box;padding:8px 12px;border:none;border-bottom:1px solid #e5e7eb;font-size:13px;outline:none;color:#17231f;font-family:inherit}',
            '.sn-drop-search::placeholder{color:#9ca3af}',
            '.sn-drop-header{display:grid;grid-template-columns:110px 60px 1fr 100px;gap:8px;padding:5px 12px;background:#f5f7f6;border-bottom:1px solid #e5e7eb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5b6a65}',
            '.sn-drop-list{max-height:240px;overflow-y:auto}',
            '.sn-drop-row{display:grid;grid-template-columns:110px 60px 1fr 100px;gap:8px;padding:9px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;align-items:center}',
            '.sn-drop-row:last-child{border-bottom:none}',
            '.sn-drop-row:hover{background:#f0fdf4}',
            '.sn-drop-row.active{background:#f0fdf4}',
            '.sn-drop-cell-zone{font-size:12px;font-weight:600;color:#17231f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.sn-drop-row.active .sn-drop-cell-zone::before{content:"● ";color:#2da85e}',
            '.sn-drop-cell-ref{font-size:12px;color:#5b6a65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.sn-drop-cell-file{font-size:11px;color:#5b6a65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.sn-drop-cell-date{font-size:11px;color:#5b6a65;white-space:nowrap}',
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
        if (wb.sourceLabel || wb.testDate) {
            var parts = [];
            if (wb.sourceLabel) parts.push(wb.sourceLabel);
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
            '<div class="gl-subtitle" style="margin-bottom:8px">Select soil and water samples to view irrigation quality, salinity impact &amp; moisture balance.</div>',
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">',
            '<div id="wb-soil-selector"></div>',
            '<div id="wb-water-selector"></div>',
            '<span id="wb-water-status" style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:5px;padding-bottom:4px"></span>',
            '</div>',
            sourceInfo ? '<div style="margin-top:6px">'+sourceInfo+'</div>' : '',
            '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:12px">'+cards.join('')+'</div>',
            '</div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // 2. WATER QUALITY CARDS
    // =========================================================================

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
            // depletionFraction is stored as 0–100 (already a percentage) by irrigation-scheduler.js
            var depPct = wbal.depletionFraction != null ? Math.round(wbal.depletionFraction) : null;
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
    // SOIL STRUCTURE RISK
    // =========================================================================

    function renderSoilStructureRisk(wb) {
        var sar    = parseFloat(wb.SAR);
        var saradj = parseFloat(wb.SARadj);
        var ecw    = parseFloat(wb.ecw);
        var rsc    = parseFloat(wb.RSC);

        if (isNaN(sar) && isNaN(saradj)) return '';

        var effSar = (!isNaN(saradj) && saradj > sar) ? saradj : sar;

        // Risk classification
        var riskLevel, riskColor, riskBg, riskBorder, gypsumRange, timeline, infiltration;
        if (effSar >= 18) {
            riskLevel = 'Severe'; riskColor = '#7f1d1d'; riskBg = '#fef2f2'; riskBorder = '#f87171';
            gypsumRange = '3–6'; timeline = 'Rapid — structural collapse within months without treatment';
            infiltration = 'Severely impaired — waterlogging and surface ponding likely';
        } else if (effSar >= 9) {
            riskLevel = 'High'; riskColor = '#991b1b'; riskBg = '#fef2f2'; riskBorder = '#fca5a5';
            gypsumRange = '2–4'; timeline = 'Progressive — measurable degradation within 6–18 months';
            infiltration = 'Impaired — reduced infiltration rate, compaction risk elevated';
        } else if (effSar >= 3) {
            riskLevel = 'Moderate'; riskColor = '#854d0e'; riskBg = '#fffbeb'; riskBorder = '#fde68a';
            gypsumRange = '0.5–2'; timeline = 'Slow — gradual degradation over 2–5 years';
            infiltration = 'Minor restriction — monitor infiltration rates seasonally';
        } else {
            riskLevel = 'Low'; riskColor = '#15803d'; riskBg = '#f0fdf4'; riskBorder = '#86efac';
            gypsumRange = null; timeline = 'No structural risk at current sodium levels';
            infiltration = 'No restriction';
        }

        // Bicarbonate aggravation note
        var bicarbNote = (!isNaN(saradj) && !isNaN(sar) && (saradj - sar) > 0.5)
            ? 'SARadj (' + fmt(saradj, 1) + ') > SAR (' + fmt(sar, 1) + '): bicarbonate aggravates sodium hazard — effective risk is higher than basic SAR suggests.'
            : null;

        // RSC note
        var rscNote = (!isNaN(rsc) && rsc > 0)
            ? 'RSC ' + fmt(rsc, 2) + ' meq/L — residual sodium carbonate positive; acidification may be needed alongside gypsum.'
            : null;

        var gypsumHtml = '';
        if (gypsumRange) {
            gypsumHtml = '<div style="margin-top:12px;padding:10px 12px;background:#f5f3ff;border:1px solid #c4b5fd;border-radius:8px">' +
                '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b21b6;margin-bottom:4px">Gypsum Recommendation</div>' +
                '<div style="font-size:14px;font-weight:700;color:#4c1d95">' + gypsumRange + ' t/ha</div>' +
                '<div style="font-size:11px;color:#6d28d9;margin-top:2px">Apply as surface broadcast, water in immediately (≥10mm). Retest SAR 3 months after application.</div>' +
                '</div>';
        }

        var metaRows = [
            { label: 'Effective SAR', value: fmt(effSar, 1), sub: effSar !== sar ? 'Adjusted for bicarbonate' : 'Standard SAR' },
            { label: 'Structural Risk', value: riskLevel, sub: timeline },
            { label: 'Infiltration', value: infiltration, sub: null },
        ];
        var metaHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:12px">' +
            metaRows.map(function (r) {
                return '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px">' +
                    '<div style="font-size:11px;color:#6b7280;margin-bottom:2px">' + esc(r.label) + '</div>' +
                    '<div style="font-size:14px;font-weight:700;color:#111827">' + esc(r.value) + '</div>' +
                    (r.sub ? '<div style="font-size:11px;color:#9ca3af;margin-top:2px">' + esc(r.sub) + '</div>' : '') +
                    '</div>';
            }).join('') + '</div>';

        var notesHtml = [bicarbNote, rscNote].filter(Boolean).map(function (n) {
            return '<div style="font-size:12px;color:#6b7280;padding:6px 0;border-top:1px solid #f3f4f6">' + esc(n) + '</div>';
        }).join('');

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:' + riskColor + '"></div>' +
            '<div class="gl-block-title">Soil Structure Risk</div>' +
            '<div class="gl-block-sub">Sodium-driven degradation outlook based on SAR — ' + riskLevel + '</div>' +
            '</div>' +
            '<div class="gl-block-body">' +
            metaHtml +
            gypsumHtml +
            (notesHtml ? '<div style="margin-top:8px">' + notesHtml + '</div>' : '') +
            '</div></div>';
    }

    // =========================================================================
    // 6. RECOMMENDATIONS
    // =========================================================================

    // =========================================================================
    // DIAGNOSTIC CARDS (from calculateWaterDiagnostics — same data as Hub page)
    // =========================================================================

    function _buildFallbackDiagnostics(wb) {
        var out = [];
        var ions = wb.ions || {};
        // ions stored as meq/L — convert to mg/L for per-ion cards (matches old hub thresholds)
        var caMgL  = (ions.Ca  || 0) * 20.04;
        var mgMgL  = (ions.Mg  || 0) * 12.15;
        var naMgL  = (ions.Na  || 0) * 23.0;
        var kMgL   = (ions.K   || 0) * 39.1;
        var clMgL  = (ions.Cl  || 0) * 35.45;
        var so4MgL = (ions.SO4 || 0) * 48.0;

        function push(label, value, unit, st, driver, rec) {
            out.push({ label: label, value: String(value), unit: unit,
                       status: st.label, statusClass: 'status-' + st.cls,
                       driver: driver || null, recommendation: rec || null });
        }

        // Order mirrors old hub's calculateWaterDiagnostics
        if (wb.SAR != null) {
            var st = sarStatus(wb.SAR);
            push('Sodium Hazard (SAR)', fmt(wb.SAR, 2), '', st,
                 'Low sodium hazard',
                 wb.SAR >= 9 ? 'Apply gypsum 1.0–2.0 t/ha, monitor infiltration.'
               : wb.SAR >= 6 ? 'Apply gypsum 1.0–2.0 t/ha, monitor infiltration.'
               : wb.SAR >= 3 ? 'Consider preventative gypsum (0.5–1.0 t/ha).'
               : 'No sodium management required.');
        }
        if (wb.SARadj != null) {
            var st = sarStatus(wb.SARadj);
            var adjDiff = wb.SAR != null ? ((wb.SARadj / Math.max(wb.SAR, 0.01) - 1) * 100).toFixed(0) : null;
            push('Adjusted SAR (SARadj)', fmt(wb.SARadj, 2), '', st,
                 adjDiff !== null && Math.abs(Number(adjDiff)) > 2
                     ? (Number(adjDiff) > 0 ? '+' : '') + adjDiff + '% vs basic SAR — bicarbonate-corrected (Suarez 1981)'
                     : 'No significant adjustment — bicarbonate in equilibrium',
                 null);
        }
        if (wb.ecw != null) {
            var ecSt = wb.ecw < 0.7  ? { label:'Low Risk',   cls:'adequate'   }
                     : wb.ecw < 1.5  ? { label:'Medium Risk', cls:'borderline' }
                     : wb.ecw < 3.0  ? { label:'High Risk',   cls:'deficient'  }
                     :                 { label:'Very High',    cls:'deficient'  };
            push('Salinity (ECw)', fmt(wb.ecw, 2), 'dS/m', ecSt,
                 wb.ecw < 0.7 ? 'Minimal salt accumulation' : wb.ecw < 1.5 ? 'Monitor salt levels' : 'Salt stress likely',
                 wb.ecw >= 3.0 ? 'Leaching >25%, consider water treatment.'
               : wb.ecw >= 1.5 ? 'Leaching 20–25%, salt-tolerant cultivars.'
               : wb.ecw >= 0.7 ? 'Increase leaching to 15–20%.'
               : 'Standard leaching (10–15%).');
        }
        if (wb.RSC != null) {
            var st = rscStatus(wb.RSC);
            push('Residual Sodium Carbonate', fmt(wb.RSC, 2), 'meq/L', st,
                 wb.RSC < 0 ? 'No carbonate precipitation' : wb.RSC < 1.25 ? 'Some Ca/Mg precipitation' : 'Significant precipitation',
                 wb.RSC >= 2.5 ? 'Acidification or heavy gypsum required.'
               : wb.RSC >= 1.25 ? 'Regular gypsum applications.'
               : wb.RSC >= 0   ? 'Monitor Ca/Mg availability.'
               : 'Ca/Mg remain available.');
        }
        if (clMgL > 0) {
            var clSt = clMgL >= 350 ? { label:'High Risk', cls:'deficient'  }
                     : clMgL >= 100 ? { label:'Caution',   cls:'borderline' }
                     :                { label:'Safe',       cls:'adequate'   };
            push('Chloride Toxicity', fmt(clMgL, 1), 'mg/L', clSt,
                 clMgL >= 350 ? 'Foliar damage likely' : clMgL >= 100 ? 'Monitor sensitive species' : 'No toxicity risk',
                 clMgL >= 350 ? 'Avoid overhead irrigation, increase leaching.'
               : clMgL >= 100 ? 'Avoid foliar irrigation during heat stress.'
               : 'No chloride management required.');
        }
        if (naMgL > 0) {
            var naSt = naMgL >= 150 ? { label:'High Risk', cls:'deficient'  }
                     : naMgL >= 70  ? { label:'Caution',   cls:'borderline' }
                     :                { label:'Safe',       cls:'adequate'   };
            push('Sodium Toxicity', fmt(naMgL, 1), 'mg/L', naSt,
                 naMgL >= 150 ? 'Direct toxicity risk' : naMgL >= 70 ? 'Monitor sensitive species' : 'No toxicity risk',
                 naMgL >= 150 ? 'Gypsum applications, increase leaching.'
               : naMgL >= 70  ? 'Maintain adequate soil calcium levels.'
               : 'No sodium management required.');
        }
        if (wb.B != null && wb.B > 0) {
            var bSt = wb.B >= 2.0 ? { label:'High Risk', cls:'deficient'  }
                    : wb.B >= 0.5 ? { label:'Caution',   cls:'borderline' }
                    :               { label:'Safe',       cls:'adequate'   };
            push('Boron Toxicity', fmt(wb.B, 2), 'mg/L', bSt,
                 wb.B >= 2.0 ? 'Toxicity likely' : wb.B >= 0.5 ? 'Sensitive turf affected' : 'No toxicity risk',
                 wb.B >= 2.0 ? 'Water blending or treatment system required.'
               : wb.B >= 0.5 ? 'Monitor sensitive species, increase leaching.'
               : 'No boron management required.');
        }
        if (wb.Fe != null && wb.Fe > 0) {
            var feSt = wb.Fe >= 2.0 ? { label:'Severe',    cls:'deficient'  }
                     : wb.Fe >= 1.0 ? { label:'High Risk', cls:'deficient'  }
                     : wb.Fe >= 0.3 ? { label:'Caution',   cls:'borderline' }
                     :                { label:'Safe',       cls:'adequate'   };
            push('Iron (Staining Risk)', fmt(wb.Fe, 2), 'mg/L', feSt,
                 wb.Fe >= 2.0 ? 'Severe staining expected' : wb.Fe >= 1.0 ? 'Staining likely' : wb.Fe >= 0.3 ? 'Moderate staining possible' : 'No staining risk',
                 wb.Fe >= 1.0 ? 'Install iron filtration system.'
               : wb.Fe >= 0.3 ? 'Monitor surfaces, consider filtration if needed.'
               : 'No iron management required.');
        }
        if (wb.pH != null) {
            var phSt = wb.pH > 8.4 ? { label:'Alkaline',  cls:'deficient'  }
                     : wb.pH < 6.5 ? { label:'Acidic',    cls:'borderline' }
                     :               { label:'Suitable',   cls:'adequate'   };
            push('pH', fmt(wb.pH, 1), '', phSt,
                 wb.pH > 8.4 ? 'High pH promotes calcite precipitation, raises soil pH, reduces P availability'
               : wb.pH < 6.5 ? 'Low pH may increase metal solubility and equipment corrosion'
               : 'pH within normal irrigation range (6.5–8.4)',
                 wb.pH > 8.4 ? 'Acidify water to pH 6.5–7.0; inject sulphuric or phosphoric acid.'
               : wb.pH < 6.5 ? 'Check bicarbonate alkalinity; monitor equipment. pH <6.0 may require buffering.'
               : 'No adjustment required.');
        }
        if (caMgL > 0) {
            var caSt = caMgL > 200 ? { label:'High',     cls:'borderline' }
                     : caMgL >= 20 ? { label:'Adequate', cls:'adequate'   }
                     :               { label:'Low',       cls:'borderline' };
            push('Calcium (Ca)', fmt(caMgL, 1), 'mg/L', caSt,
                 caMgL > 200 ? 'Elevated Ca may contribute to scale and calcite deposition'
               : caMgL >= 20 ? 'Adequate Ca, good buffering capacity'
               : 'Low Ca, reduced buffering against sodium-induced sodicity',
                 caMgL > 200 ? 'Check LSI; consider water treatment if scale is present.'
               : caMgL >= 20 ? 'No action required.'
               : 'Monitor SAR closely; consider Ca-containing amendments (gypsum).');
        }
        if (mgMgL > 0) {
            var mgSt = mgMgL > 60 ? { label:'Elevated', cls:'borderline' }
                     : mgMgL >= 5 ? { label:'Adequate', cls:'adequate'   }
                     :              { label:'Low',       cls:'borderline' };
            push('Magnesium (Mg)', fmt(mgMgL, 1), 'mg/L', mgSt,
                 mgMgL > 60 ? 'High Mg relative to Ca can displace Ca on exchange sites'
               : mgMgL >= 5 ? 'Adequate Mg, no concerns'
               : 'Low Mg may limit plant uptake if soil Mg is borderline',
                 mgMgL > 60 ? 'Check Ca:Mg ratio in soil; apply gypsum if Ca:Mg < 3:1.'
               : mgMgL >= 5 ? 'No action required.'
               : 'Supplement with MgSO₄ (Epsom salt) if soil Mg is also low.');
        }
        if (kMgL > 0) {
            var kSt = kMgL >= 200 ? { label:'High',     cls:'deficient'  }
                    : kMgL >= 78  ? { label:'Elevated', cls:'borderline' }
                    :               { label:'Normal',    cls:'adequate'   };
            push('Potassium (K)', fmt(kMgL, 1), 'mg/L', kSt,
                 kMgL >= 200 ? 'High K can displace Ca/Mg on exchange sites'
               : kMgL >= 78  ? 'Elevated K may contribute to K accumulation in soils'
               : 'K within normal irrigation range',
                 kMgL >= 200 ? 'Consider water blending; monitor Ca:K and Mg:K ratios in soil.'
               : kMgL >= 78  ? 'Reduce K fertiliser inputs; monitor soil K levels.'
               : 'No action required.');
        }
        if (so4MgL > 0) {
            var soSt = so4MgL > 1000 ? { label:'High',     cls:'deficient'  }
                     : so4MgL > 600  ? { label:'Elevated', cls:'borderline' }
                     :                 { label:'Normal',    cls:'adequate'   };
            push('Sulphate (SO₄)', fmt(so4MgL, 1), 'mg/L', soSt,
                 so4MgL > 1000 ? 'High sulphate contributes significantly to EC and total salt load'
               : so4MgL > 600  ? 'Elevated SO₄, monitor total salinity (EC)'
               : 'Low to moderate sulphate, no concerns',
                 so4MgL > 1000 ? 'Increase leaching fraction; consider water blending or treatment.'
               : so4MgL > 600  ? 'Monitor ECw; ensure adequate leaching fraction.'
               : 'No action required.');
        }
        if (wb.LSI != null) {
            var st = lsiStatus(wb.LSI);
            push('Langelier SI', fmt(wb.LSI, 2), '', st,
                 'CaCO₃ scale or corrosion tendency',
                 wb.LSI > 0.5  ? 'Inject acid to lower LSI below +0.5.'
               : wb.LSI < -0.5 ? 'Consider calcium injection or blending with harder water.'
               : 'No scale or corrosion concern.');
        }
        return out;
    }

    function renderDiagnostics(wb) {
        var diags = wb.diagnostics;
        if (!Array.isArray(diags) || !diags.length) {
            diags = _buildFallbackDiagnostics(wb);
        }
        if (!diags.length) return '';

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
    // 7. SOIL × WATER CROSS-ANALYSIS
    // =========================================================================

    function analyzeSoilWaterInteraction(sn, wb) {
        if (!sn || !wb) return null;

        var soilPH = parseFloat(sn.pH)     || 0;
        var soilNa = parseFloat(sn.soilNa) || 0;

        // Need at least soil pH or soil Na to run any check
        if (soilPH === 0 && soilNa === 0) return null;

        // ions stored as meq/L — convert to mg/L for assessPHWaterInteraction thresholds
        // (matches hub-tissue-v3.js assessPHWaterInteraction: Ca > 60 mg/L, HCO3 > 100 mg/L)
        var ions     = wb.ions || {};
        var wCaMgL   = (ions.Ca   || 0) * 20.04;
        var wHCO3MgL = (ions.HCO3 || 0) * 61.0;

        var issues        = [];
        var overallStatus = 'adequate';
        var priority      = 0;

        // 1. pH × Water Chemistry — assessPHWaterInteraction (hub-tissue-v3.js exact match)
        var isDepositing = (wCaMgL > 60 && wHCO3MgL > 100);
        if (soilPH > 7.5 && isDepositing) {
            issues.push({ type:'pH × Depositing Water', severity:'high',
                description:'Alkaline soil (pH ' + soilPH.toFixed(1) + ') + Ca/HCO₃-rich water → Progressive pH increase',
                impact:'Each irrigation deposits calcium carbonate, raising soil pH further. Long-term risk: pH 8.0–8.5+ without intervention.',
                action:'Acidify irrigation water to pH 6.5–7.0. Apply elemental sulphur to soil. Use acidifying fertilisers exclusively. Monitor soil pH quarterly.' });
            overallStatus = 'deficient'; priority = Math.max(priority, 3);
        } else if (soilPH > 7.0 && isDepositing) {
            issues.push({ type:'pH × Depositing Water', severity:'moderate',
                description:'Slightly alkaline soil (pH ' + soilPH.toFixed(1) + ') + depositing water → monitor for pH drift',
                impact:'Water will deposit calcium carbonate over time.',
                action:'Consider water acidification or sulphur applications to prevent pH increase.' });
            overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
            priority = Math.max(priority, 2);
        }

        // 2. pH × Sodium interaction (hub-tissue-v3.js lines 1684-1692 exact match)
        if (soilPH > 0 && soilNa > 0) {
            if (soilPH > 7.5 && soilNa > 60) {
                issues.push({ type:'pH × Sodium — Critical', severity:'high',
                    description:'High pH (' + soilPH.toFixed(1) + ') + elevated Na (' + soilNa.toFixed(0) + ' ppm) = Increased sodicity risk',
                    impact:'Alkaline conditions favour sodium displacement of calcium on exchange sites. Progressive structure degradation and infiltration decline.',
                    action:'Gypsum application (1.5–2.5 t/ha) + acidification program. Acidify to pH 6.5–7.0. Monitor SAR in irrigation water.' });
                overallStatus = 'deficient'; priority = Math.max(priority, 3);
            } else if (soilPH > 7.0 && soilNa > 45) {
                issues.push({ type:'pH × Sodium', severity:'moderate',
                    description:'Elevated pH (' + soilPH.toFixed(1) + ') + Na (' + soilNa.toFixed(0) + ' ppm)',
                    impact:'Monitor for sodicity risk. Alkaline conditions increase sensitivity to sodium in irrigation water.',
                    action:'Preventative gypsum. Monitor SAR in irrigation water.' });
                overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
                priority = Math.max(priority, 1);
            }
        }

        // 3. Soil Na assessment (hub-tissue-v3.js assessSodiumStatus thresholds exact match)
        if (soilNa >= 100) {
            issues.push({ type:'Soil Sodium — High', severity:'high',
                description:'Soil Na: ' + soilNa.toFixed(0) + ' ppm (Mehlich-3) — High sodium. Significant risk of sodicity, poor infiltration, and turf stress.',
                impact:'Significant risk of sodicity, poor infiltration, and turf stress.',
                action:'URGENT: Apply gypsum 2.0–3.0 t/ha in split applications. Aggressive leaching program. Test for true ESP (exchangeable Na required). May need drainage improvements. Evaluate irrigation water source.' });
            overallStatus = 'deficient'; priority = Math.max(priority, 2);
        } else if (soilNa >= 60) {
            issues.push({ type:'Soil Sodium — Elevated', severity:'high',
                description:'Soil Na: ' + soilNa.toFixed(0) + ' ppm (Mehlich-3) — Elevated sodium levels. Potential for structure/infiltration issues.',
                impact:'Potential for structure and infiltration issues.',
                action:'Apply gypsum 1.0–1.5 t/ha. Increase leaching fraction (LF 0.20–0.25). Test irrigation water SAR. Consider lab test for exchangeable Na and ESP.' });
            overallStatus = 'deficient'; priority = Math.max(priority, 2);
        } else if (soilNa >= 30) {
            issues.push({ type:'Soil Sodium — Slightly Elevated', severity:'moderate',
                description:'Soil Na: ' + soilNa.toFixed(0) + ' ppm (Mehlich-3) — Slightly elevated. Monitor for early signs of sodium stress.',
                impact:'Monitor for early signs of sodium stress.',
                action:'Monitor turf closely. Check irrigation water quality (SAR). Consider preventative gypsum (0.5 t/ha) if using high-Na water.' });
            overallStatus = overallStatus === 'adequate' ? 'borderline' : overallStatus;
            priority = Math.max(priority, 1);
        }

        if (issues.length === 0) {
            return { statusLabel: 'All Clear', statusClass: 'status-adequate',
                     issues: [], recommendation: 'Continue current practices. No corrective action required at current levels.',
                     priority: 0 };
        }

        var statusLabel, statusClass;
        if (overallStatus === 'deficient') {
            statusLabel = 'High Risk'; statusClass = 'status-deficient';
        } else if (overallStatus === 'borderline') {
            statusLabel = 'Monitor';   statusClass = 'status-borderline';
        } else {
            statusLabel = 'Acceptable'; statusClass = 'status-adequate';
        }

        var highIssues = issues.filter(function(i) { return i.severity === 'high'; });
        var recommendation = (highIssues.length > 0 ? highIssues[0] : issues[0]).action;

        return { statusLabel: statusLabel, statusClass: statusClass,
                 issues: issues, recommendation: recommendation, priority: priority };
    }

    function renderSoilWaterInteraction(sn, wb) {
        var result = analyzeSoilWaterInteraction(sn, wb);

        // Header is always shown; body differs between results and missing-data hints
        var header = '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#6b7280"></div>' +
            '<div class="gl-block-title">Soil × Water Interaction</div>';

        // --- case: result found → render normally ---
        if (result) {
            var colMap = {
                'status-deficient':  { border:'#dc2626', bg:'#fef2f2', text:'#991b1b' },
                'status-borderline': { border:'#f59e0b', bg:'#fffbeb', text:'#92400e' },
                'status-adequate':   { border:'#10b981', bg:'#f0fdf4', text:'#065f46' },
            };
            var col    = colMap[result.statusClass] || colMap['status-adequate'];
            var sevClr = { high:'#dc2626', moderate:'#f59e0b', low:'#10b981' };
            var count  = result.issues.length;

            // All-clear: no issues, show a simple OK summary
            if (count === 0) {
                return header.replace('background:#6b7280', 'background:' + col.border) +
                    '<div class="gl-block-sub" style="color:' + col.text + '">' + esc(result.statusLabel) + '</div>' +
                    '</div>' +
                    '<div class="gl-block-body">' +
                    '<div style="padding:10px 12px;border-radius:8px;background:' + col.bg + ';border:1px solid ' + col.border +
                    ';font-size:12px;color:' + col.text + '">' + esc(result.recommendation) + '</div>' +
                    '</div></div>';
            }

            var issuesHtml = result.issues.map(function(issue) {
                return '<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;' +
                    'border-left:3px solid ' + (sevClr[issue.severity] || '#6b7280') + ';background:#f9fafb">' +
                    '<div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px">' + esc(issue.type) + '</div>' +
                    '<div style="font-size:12px;color:#374151;margin-bottom:3px">' + esc(issue.description) + '</div>' +
                    '<div style="font-size:11px;color:#6b7280;font-style:italic;margin-bottom:3px">' + esc(issue.impact) + '</div>' +
                    '<div style="font-size:11px;color:#1d4ed8;font-weight:600">Action: ' + esc(issue.action) + '</div>' +
                    '</div>';
            }).join('');

            return header.replace('background:#6b7280', 'background:' + col.border) +
                '<div class="gl-block-sub" style="color:' + col.text + '">' + esc(result.statusLabel) +
                ' — ' + count + ' interaction' + (count > 1 ? 's' : '') + ' detected</div>' +
                '</div>' +
                '<div class="gl-block-body">' +
                issuesHtml +
                '<div style="margin-top:8px;padding:8px 12px;background:' + col.bg + ';border:1px solid ' + col.border +
                ';border-radius:8px;font-size:12px;color:' + col.text + '">' +
                '<strong>Recommendation:</strong> ' + esc(result.recommendation) + '</div>' +
                '</div></div>';
        }

        // --- case: incomplete data → show what needs to be added ---
        var hints = [];

        // Soil side — pH and Na are the required inputs
        if (!sn || (!parseFloat(sn.pH) && !parseFloat(sn.soilNa))) {
            hints.push({ icon: 'soil', text: 'Add a soil test with pH and/or Na (Mehlich-3) to enable interaction checks.' });
        } else {
            if (!parseFloat(sn.pH))    hints.push({ icon: 'soil', text: 'Add soil pH to enable pH × water chemistry and pH × sodium checks.' });
            if (!parseFloat(sn.soilNa)) hints.push({ icon: 'soil', text: 'Add soil Na (Mehlich-3) to enable sodium status and pH × sodium checks.' });
        }

        // Water side — Ca and HCO3 needed for pH × depositing water check
        var ions  = (wb && wb.ions) || {};
        var hasCa = parseFloat(ions.Ca)   > 0;
        var hasHCO3 = parseFloat(ions.HCO3) > 0;

        if (!hasCa)   hints.push({ icon: 'water', text: 'Add Ca to irrigation water test to enable pH × depositing water check.' });
        if (!hasHCO3) hints.push({ icon: 'water', text: 'Add HCO₃ to irrigation water test to enable pH × depositing water check.' });

        // If hints is empty, data is complete but no thresholds triggered
        if (hints.length === 0) {
            hints.push({ icon: 'ok', text: 'All data present. No significant soil–water interactions detected at current levels.' });
        }

        var hintRows = hints.map(function(h) {
            var iconSvg = h.icon === 'water'
                ? '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6b7280" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2C12 2 5 10 5 14a7 7 0 0014 0c0-4-7-12-7-12z"/></svg>'
                : h.icon === 'ok'
                ? '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
                : '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6b7280" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 12h18M3 17h18"/></svg>';
            return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;color:#374151">' +
                iconSvg + '<span>' + esc(h.text) + '</span></div>';
        }).join('');

        return header +
            '<div class="gl-block-sub" style="color:#6b7280">Incomplete data — see below</div>' +
            '</div>' +
            '<div class="gl-block-body">' +
            '<div style="padding:10px 12px;border-radius:8px;border:1px dashed #d1d5db;background:#f9fafb;margin-bottom:4px">' +
            '<div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">To enable full analysis, add:</div>' +
            hintRows +
            '</div></div></div>';
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
    // SAMPLE SELECTORS (soil + water, same pattern as sn-drop in soil-nutrition)
    // =========================================================================

    function _wbBuildDropRows(samples, activeIdx, type) {
        if (!samples.length) return '<div style="padding:8px 12px;font-size:12px;color:#9ca3af">No samples</div>';
        return samples.map(function(s, i) {
            var pl   = s.payload || {};
            var zone = type === 'water'
                ? esc(s.client_uid || pl._label || ('Sample ' + (i + 1)))
                : esc(pl._label || s.client_uid || ('Sample ' + (i + 1)));
            var ref  = esc(s.lab_ref || '');
            var file = esc(s.file_name || '');
            var date = esc((s.lab_date || s.sample_date || '').substring(0, 10));
            return '<div class="sn-drop-row' + (i === activeIdx ? ' active' : '') + '" data-wb-idx="' + i + '">' +
                '<div class="sn-drop-cell-zone">' + zone + '</div>' +
                '<div class="sn-drop-cell-ref">'  + ref  + '</div>' +
                '<div class="sn-drop-cell-file">' + file + '</div>' +
                '<div class="sn-drop-cell-date">' + date + '</div>' +
                '</div>';
        }).join('');
    }

    function _wbInjectDropdown(type) {
        var elId   = type === 'soil' ? 'wb-soil-selector' : 'wb-water-selector';
        var wrapId = 'wb-drop-wrap-' + type;
        var selector = document.getElementById(elId);
        if (!selector) return;

        var samples   = type === 'soil' ? _wbSoilSamples : _wbWaterSamples;
        var activeIdx = type === 'soil' ? _wbSoilActiveIdx : _wbWaterActiveIdx;
        if (!samples.length) { selector.innerHTML = ''; return; }

        var active   = activeIdx >= 0 ? samples[activeIdx] : null;
        var pl       = active ? (active.payload || {}) : {};
        var btnLabel = active
            ? (type === 'water' ? esc(active.client_uid || pl._label || 'Sample') : esc(pl._label || active.client_uid || 'Sample'))
            : 'Select…';
        var typeLabel = type === 'soil' ? 'Soil Sample' : 'Water Sample';

        var svgSearch  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:#9ca3af"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
        var svgChevron = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:auto;flex-shrink:0"><path d="M6 9l6 6 6-6"/></svg>';

        selector.innerHTML =
            '<div class="sn-drop-wrap" id="' + wrapId + '">' +
            '<div style="font-size:11px;font-weight:700;color:#5b6a65;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">' + typeLabel + '</div>' +
            '<button class="sn-drop-btn" id="wb-drop-btn-' + type + '" type="button">' + svgSearch + '<span id="wb-drop-label-' + type + '">' + btnLabel + '</span>' + svgChevron + '</button>' +
            '<div class="sn-drop-panel" id="wb-drop-panel-' + type + '">' +
            '<input class="sn-drop-search" id="wb-drop-search-' + type + '" type="text" placeholder="Filter…" autocomplete="off">' +
            '<div class="sn-drop-header"><span>' + (type === 'water' ? 'Name' : 'Zone Name') + '</span><span>Ref</span><span>File</span><span>Date</span></div>' +
            '<div class="sn-drop-list" id="wb-drop-list-' + type + '">' + _wbBuildDropRows(samples, activeIdx, type) + '</div>' +
            '</div></div>';

        document.getElementById('wb-drop-btn-' + type).addEventListener('click', function(e) {
            e.stopPropagation();
            var wrap = document.getElementById(wrapId);
            wrap.classList.toggle('sn-drop-open');
            if (wrap.classList.contains('sn-drop-open')) {
                var s = document.getElementById('wb-drop-search-' + type);
                if (s) { s.value = ''; s.focus(); }
                var list = document.getElementById('wb-drop-list-' + type);
                var curIdx = type === 'soil' ? _wbSoilActiveIdx : _wbWaterActiveIdx;
                if (list) list.innerHTML = _wbBuildDropRows(type === 'soil' ? _wbSoilSamples : _wbWaterSamples, curIdx, type);
                _wbWireRows(type);
            }
        });

        document.getElementById('wb-drop-search-' + type).addEventListener('input', function() {
            var q   = this.value.toLowerCase();
            var all = type === 'soil' ? _wbSoilSamples : _wbWaterSamples;
            var cur = type === 'soil' ? _wbSoilActiveIdx : _wbWaterActiveIdx;
            var filtered = !q ? all : all.filter(function(s) {
                var pl = s.payload || {};
                return (pl._label || '').toLowerCase().indexOf(q) !== -1 ||
                       (s.client_uid || '').toLowerCase().indexOf(q) !== -1 ||
                       (s.lab_date || s.sample_date || '').indexOf(q) !== -1 ||
                       (s.file_name || '').toLowerCase().indexOf(q) !== -1;
            });
            var list = document.getElementById('wb-drop-list-' + type);
            if (list) list.innerHTML = _wbBuildDropRows(filtered, cur, type);
            _wbWireRows(type);
        });

        document.addEventListener('click', function(e) {
            var wrap = document.getElementById(wrapId);
            if (wrap && !wrap.contains(e.target)) wrap.classList.remove('sn-drop-open');
        }, { once: false });

        _wbWireRows(type);
    }

    function _wbWireRows(type) {
        var list = document.getElementById('wb-drop-list-' + type);
        if (!list) return;
        list.querySelectorAll('.sn-drop-row[data-wb-idx]').forEach(function(row) {
            row.addEventListener('click', function() {
                var idx = parseInt(this.dataset.wbIdx, 10);
                var samples = type === 'soil' ? _wbSoilSamples : _wbWaterSamples;
                var sample  = samples[idx];
                if (!sample) return;
                var wrap = document.getElementById('wb-drop-wrap-' + type);
                if (wrap) wrap.classList.remove('sn-drop-open');
                if (type === 'soil') { _wbSoilActiveIdx = idx; }
                else {
                    _wbWaterActiveIdx = idx;
                    global._gilbaActiveWaterSample = sample;
                }
                _wbSaveActiveId(type, sample.id);
                _wbSwitchSample(type, sample);
            });
        });
    }

    function _wbSwitchSample(type, sample) {
        if (type === 'soil') {
            // Re-fetch soil nutrition analysis, update GAIP_DASHBOARD_DATA, re-render
            fetch('/api/samples/' + encodeURIComponent(sample.id) + '/analyse', {
                headers: { 'Accept': 'application/json' },
            })
            .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function(res) {
                var snData = res && res.data;
                if (snData && global.GAIP_DASHBOARD_DATA) {
                    if (!global.GAIP_DASHBOARD_DATA.computed) global.GAIP_DASHBOARD_DATA.computed = {};
                    var existing = global.GAIP_DASHBOARD_DATA.computed.soilNutrition || {};
                    global.GAIP_DASHBOARD_DATA.computed.soilNutrition = Object.assign({}, existing, snData);
                }
                render();
                _wbInjectDropdown('soil');
                _wbInjectDropdown('water');
            })
            .catch(function() {
                _wbInjectDropdown('soil');
                _wbInjectDropdown('water');
            });
        } else {
            // Water sample: write an override key to localStorage, then Re-run.
            //
            // Why not SM allActive in gilba_samples:
            //   fetchSamplesFromServer in the old-hub iframe calls SM.getAllSamples()
            //   when SM is still empty (async restore hasn't run yet), so serverSnap.allActive={}
            //   and restoreFromPersistence wipes allActive[site].water.  If the server had
            //   any samples, restoreFromLocalFallback is never called, so our allActive write
            //   is never seen.
            //
            // Fix: use a separate one-shot key 'gilba_wb_water_override' that hub-persistence
            // reads SYNCHRONOUSLY at the top of cacheAnalysisResults(), before any async SP
            // init can interfere.  It is deleted after first use so stale overrides never
            // accumulate.
            var siteId = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId;
            try {
                var wpl = sample.payload || {};
                localStorage.setItem('gilba_wb_water_override', JSON.stringify({
                    siteId:  siteId,
                    id:      sample.id,
                    label:   wpl._label || sample.client_uid || String(sample.id),
                    payload: wpl
                }));
            } catch(e) {}
            // Show inline status next to the water selector
            var waterStatus = document.getElementById('wb-water-status');
            if (waterStatus) waterStatus.innerHTML =
                '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:db-spin 0.8s linear infinite;flex-shrink:0"><path d="M4 12a8 8 0 018-8v4l4-4-4-4v4a10 10 0 100 10"/></svg>' +
                'Recalculating analysis…';
            var rerunBtn = document.getElementById('db-rerun-btn');
            if (rerunBtn) rerunBtn.click();
        }
    }

    function initWbSamples() {
        var siteId = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId;
        if (!siteId) return;

        var data = global.GAIP_DASHBOARD_DATA;
        var wb   = data && data.computed && data.computed.waterBalance;

        function sortSamples(samples) {
            return samples.sort(function(a, b) {
                var dA = a.lab_date || a.sample_date || '';
                var dB = b.lab_date || b.sample_date || '';
                if (dB !== dA) return dB.localeCompare(dA);
                var lA = (a.payload && a.payload._label) || a.client_uid || '';
                var lB = (b.payload && b.payload._label) || b.client_uid || '';
                return lA.localeCompare(lB, undefined, { numeric: true });
            });
        }

        function findActiveIdx(samples, savedId, currentLabel, currentDate) {
            if (savedId) {
                // Compare as strings: server returns numeric id, localStorage stores as string
                var savedStr = String(savedId);
                for (var j = 0; j < samples.length; j++) {
                    if (String(samples[j].id) === savedStr) return j;
                }
            }
            if (currentLabel) {
                for (var i = 0; i < samples.length; i++) {
                    var pl = samples[i].payload || {};
                    if ((pl._label || samples[i].client_uid) === currentLabel) return i;
                }
            }
            if (currentDate) {
                for (var k = 0; k < samples.length; k++) {
                    var sd = (samples[k].lab_date || samples[k].sample_date || '').substring(0, 10);
                    if (sd && sd === currentDate.substring(0, 10)) return k;
                }
            }
            return samples.length > 0 ? 0 : -1;
        }

        // Fetch soil samples
        fetch('/api/samples?site_id=' + encodeURIComponent(siteId) + '&sample_type=soil&limit=100', {
            headers: { 'Accept': 'application/json' },
        })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(res) {
            var samples = sortSamples((res && res.data) || []);
            if (!samples.length) return;
            _wbSoilSamples = samples;
            // Read fresh sn at completion time (not from stale closure captured at call time)
            var freshSn = global.GAIP_DASHBOARD_DATA && global.GAIP_DASHBOARD_DATA.computed && global.GAIP_DASHBOARD_DATA.computed.soilNutrition;
            var savedSoilId = _wbLoadActiveId('soil');
            _wbSoilActiveIdx = findActiveIdx(
                samples,
                savedSoilId,
                freshSn && freshSn.sampleLabel,
                freshSn && freshSn.sampleDate ? String(freshSn.sampleDate) : null
            );
            _wbInjectDropdown('soil');
            // Auto-fetch if persisted selection differs from cached page data (mirrors S&N pattern)
            var activeSoil = _wbSoilActiveIdx >= 0 ? samples[_wbSoilActiveIdx] : null;
            if (activeSoil && savedSoilId && String(activeSoil.id) === String(savedSoilId) &&
                (activeSoil.client_uid || '') !== ((freshSn && freshSn.sampleLabel) || '')) {
                _wbSwitchSample('soil', activeSoil);
            }
        })
        .catch(function() {});

        // Fetch water samples
        fetch('/api/samples?site_id=' + encodeURIComponent(siteId) + '&sample_type=water&limit=100', {
            headers: { 'Accept': 'application/json' },
        })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(res) {
            var samples = sortSamples((res && res.data) || []);
            if (!samples.length) return;
            _wbWaterSamples = samples;
            _wbWaterActiveIdx = findActiveIdx(
                samples,
                _wbLoadActiveId('water'),
                wb && wb.sourceLabel,
                wb && wb.testDate ? String(wb.testDate) : null
            );
            // Expose for Re-run handler in dashboard-ui.js so repeated Re-runs
            // (without changing the dropdown) still use the correct water sample.
            global._gilbaActiveWaterSample = _wbWaterActiveIdx >= 0 ? samples[_wbWaterActiveIdx] : null;
            _wbInjectDropdown('water');
        })
        .catch(function() {});
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById('wb-page-content');
        if (!container) return;

        var data = global.GAIP_DASHBOARD_DATA;
        var wb   = data && data.computed && data.computed.waterBalance;
        var sn   = data && data.computed && data.computed.soilNutrition;

        injectStyles();

        if (!wb) { renderEmpty(container); return; }

        initInfoPopovers();

        var headerHtml     = renderPageHeader(wb);
        var verdictHtml    = renderWbVerdict(wb);
        var recHtml        = renderRecommendations(wb);

        var ionHtml        = renderIons(wb);
        var salHtml        = renderSalinity(wb);
        var diagHtml       = renderDiagnostics(wb);
        var irrHtml        = renderIrrigationBalance(wb);
        var structHtml     = renderSoilStructureRisk(wb);
        var soilWaterHtml  = renderSoilWaterInteraction(sn, wb);

        var bodyContent = verdictHtml + recHtml + soilWaterHtml + diagHtml + ionHtml + salHtml + structHtml + irrHtml;

        container.innerHTML =
            '<div class="wb-page">'+
            headerHtml+
            '<div class="gl-body">'+
            bodyContent+
            '</div>'+
            '</div>';

        initWbSamples();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_WaterBalanceAnalysis = {
        init: function() { render(); }
    };

}(typeof window !== 'undefined' ? window : this));
