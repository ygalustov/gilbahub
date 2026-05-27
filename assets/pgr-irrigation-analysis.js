/**
 * PGR & Irrigation Analysis — /analysis#pgr-irrigation tab
 * Mirrors structure of water-balance-analysis.js
 */

(function (global) {
    'use strict';

    if (global.GAIP_PGRIrrigationAnalysis) return;

    // =========================================================================
    // GLOSSARY
    // =========================================================================

    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, {
        'pgr-gdd': {
            title: 'GDD — Growing Degree Days',
            body:  'Accumulated heat units since PGR application. PGR activity declines as GDD accumulate.\n\n' +
                   'GDD = Σ max(0, T_avg − T_base)\n\n' +
                   'Reapplication is triggered when accumulated GDD reaches the product threshold (typically 200–400 GDD depending on product and species).',
        },
        'pgr-suppression': {
            title: 'Growth Suppression',
            body:  'Percentage reduction in clipping yield compared to an untreated control. Based on a sine-wave decay model calibrated per product type.\n\n' +
                   '0% — No suppression (expired or not applied)\n' +
                   '20–40% — Mild suppression\n' +
                   '40–70% — Moderate suppression (typical working range)\n' +
                   '>70% — Strong suppression (may cause excessive stress)',
        },
        'pgr-phase': {
            title: 'PGR Phase',
            body:  'Onset — PGR activity increasing, first 0–30% of GDD window\n' +
                   'Peak — Maximum suppression, 30–60% of GDD window\n' +
                   'Declining — Efficacy waning, 60–85% of GDD window\n' +
                   'Rebound — Growth rate exceeds untreated (common with trinexapac-ethyl)\n' +
                   'Expired — GDD threshold reached, reapplication required',
        },
        'pgr-reapply': {
            title: 'Reapplication Timing',
            body:  'Reapplication should occur when the GDD window is 75–90% complete — before the rebound phase begins.\n\n' +
                   'Applying too early causes stacked suppression.\n' +
                   'Applying too late allows uncontrolled rebound growth.\n\n' +
                   'Optimal window: overlap when current suppression is 20–40% and declining.',
        },
        'pgr-irr-timing': {
            title: 'Irrigation & PGR Timing',
            body:  'Irrigate 24–48 hours BEFORE application to ensure adequate soil moisture for foliar uptake and translocation.\n\n' +
                   'Avoid irrigation for 4–6 hours AFTER application to prevent wash-off.\n\n' +
                   'Light irrigation (2–3mm) 24h post-application can aid systemic uptake without reducing foliar contact time.',
        },
        'pgr-et': {
            title: 'ET₀ — Reference Evapotranspiration',
            body:  'Daily water loss from a reference grass surface under current weather conditions (Penman-Monteith, mm/day).\n\n' +
                   'ETc = ET₀ × Kc (crop coefficient per species).\n\n' +
                   'High ET₀ days accelerate GDD accumulation and increase the rate of PGR efficacy decline.',
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

    function phaseStatus(phase) {
        var map = {
            onset:     { label:'Onset',     cls:'adequate',   color:'#15803d' },
            peak:      { label:'Peak',      cls:'adequate',   color:'#166534' },
            declining: { label:'Declining', cls:'borderline', color:'#854d0e' },
            rebound:   { label:'Rebound',   cls:'deficient',  color:'#991b1b' },
            expired:   { label:'Expired',   cls:'deficient',  color:'#991b1b' },
        };
        return map[phase] || { label: phase || '—', cls:'no-data', color:'#6b7280' };
    }

    function reapplyStatus(pgr) {
        if (!pgr || !pgr.gdd) return { label:'No data', cls:'no-data', color:'#6b7280' };
        if (pgr.gdd.isOverdue)                           return { label:'Overdue',    cls:'deficient',  color:'#991b1b' };
        var rs = pgr.effect && pgr.effect.reapplicationStatus;
        if (rs === 'due')        return { label:'Due now',    cls:'deficient',  color:'#991b1b' };
        if (rs === 'approaching') return { label:'Approaching', cls:'borderline', color:'#854d0e' };
        return                           { label:'Active',     cls:'adequate',   color:'#15803d' };
    }

    // =========================================================================
    // VERDICT
    // =========================================================================

    var PGR_VERDICT_META = {
        ACTIVE: {
            cls:'acceptable', title:'PGR Program: Active',
            sub:'Growth suppression within target range. Continue current program.',
            observation:'PGR activity assessed from GDD accumulation since application.',
            mechanism:'Trinexapac-ethyl and similar compounds inhibit gibberellin biosynthesis, reducing internode elongation.',
            consequence:'Adequate suppression maintains surface quality and reduces mowing frequency.',
            determination:'Continue current program. Monitor GDD for reapplication window.',
        },
        APPROACHING: {
            cls:'monitor', title:'PGR Program: Reapplication Window Opening',
            sub:'GDD threshold approaching. Prepare for reapplication within days.',
            observation:'PGR activity assessed from GDD accumulation since application.',
            mechanism:'Efficacy declines as GDD accumulate — rebound growth begins near threshold.',
            consequence:'Missing the reapplication window causes uncontrolled rebound growth.',
            determination:'Schedule reapplication. Irrigate 24–48h before application.',
        },
        DUE: {
            cls:'high_risk', title:'PGR Program: Reapplication Due',
            sub:'GDD threshold reached. Reapplication required to prevent rebound.',
            observation:'PGR activity assessed from GDD accumulation since application.',
            mechanism:'Efficacy has declined — rebound growth likely exceeding untreated rate.',
            consequence:'Uncontrolled rebound increases mowing demand and surface inconsistency.',
            determination:'Apply immediately. Ensure adequate soil moisture for uptake.',
        },
        NO_DATA: {
            cls:'no_data', title:'PGR Program: No Data',
            sub:'No PGR application data found. Enter PGR details in the Hub and re-run.',
            observation:null, mechanism:null, consequence:null, determination:null,
        },
    };

    function pgrVerdictKey(pgr) {
        if (!pgr || !pgr.gdd) return 'NO_DATA';
        if (pgr.gdd.isOverdue) return 'DUE';
        var rs = pgr.effect && pgr.effect.reapplicationStatus;
        if (rs === 'due')         return 'DUE';
        if (rs === 'approaching') return 'APPROACHING';
        return 'ACTIVE';
    }

    function renderVerdict(pgr) {
        var v    = pgrVerdictKey(pgr);
        var meta = PGR_VERDICT_META[v] || PGR_VERDICT_META.NO_DATA;
        if (!meta.observation) return '';
        return '<div class="sn-verdict '+meta.cls+'">'+
            '<div style="flex:1">'+
            '<div class="sn-verdict-title">'+esc(meta.title)+'</div>'+
            '<div class="sn-verdict-sub">'+esc(meta.sub)+'</div>'+
            '<div class="sn-verdict-rows">'+
            '<div class="sn-verdict-row"><strong>Observation</strong>'+esc(meta.observation)+'</div>'+
            '<div class="sn-verdict-row"><strong>Mechanism</strong>'+esc(meta.mechanism)+'</div>'+
            '<div class="sn-verdict-row"><strong>Consequence</strong>'+esc(meta.consequence)+'</div>'+
            '<div class="sn-verdict-row"><strong>Determination</strong>'+esc(meta.determination)+'</div>'+
            '</div>'+
            '</div></div>';
    }

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('pgr-styles')) return;
        var el = document.createElement('style');
        el.id = 'pgr-styles';
        el.textContent = [
            /* Verdict */
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
            /* Empty */
            '.pgr-empty{padding:40px 20px;text-align:center;color:#5b6a65}',
            '.pgr-empty-title{font-size:15px;font-weight:600;color:#374151;margin-bottom:6px}',
            '.pgr-empty-body{font-size:13px;line-height:1.6;max-width:420px;margin:0 auto}',
            /* GDD progress bar */
            '.pgr-gdd-bar-wrap{margin:12px 0 4px}',
            '.pgr-gdd-bar-track{height:10px;border-radius:5px;background:#e5e7eb;overflow:hidden;position:relative}',
            '.pgr-gdd-bar-fill{height:100%;border-radius:5px;transition:width .3s}',
            '.pgr-gdd-labels{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-top:4px}',
            /* Irrigation schedule table */
            '.pgr-irr-table{width:100%;border-collapse:collapse;font-size:12px}',
            '.pgr-irr-table th{background:#f9fafb;font-weight:600;color:#374151;padding:7px 10px;text-align:left;border-bottom:1px solid #e5e7eb}',
            '.pgr-irr-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#374151}',
            '.pgr-irr-table tr:last-child td{border-bottom:none}',
            '.pgr-irr-table tr.irr-day td{background:#eff6ff}',
            '.pgr-irr-table tr:hover td{background:#f9fafb}',
            /* Timing grid */
            '.pgr-timing-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
            '@media(max-width:600px){.pgr-timing-grid{grid-template-columns:1fr}}',
            '.pgr-timing-card{background:#f8fdf9;border:1px solid #d8e0dc;border-radius:8px;padding:12px 14px}',
            '.pgr-timing-card.warn{background:#fffbeb;border-color:#fde68a}',
            '.pgr-timing-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6a65;margin-bottom:4px}',
            '.pgr-timing-text{font-size:12px;color:#374151;line-height:1.5}',
        ].join('\n');
        document.head.appendChild(el);
    }

    // =========================================================================
    // KPI CARD
    // =========================================================================

    function hexToRgb(hex) {
        var h = (hex || '#2563eb').replace('#', '');
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

    function badgeHtml(label, cls) {
        var bg  = cls==='adequate'?'#dcfce7':cls==='borderline'?'#fef9c3':cls==='deficient'?'#fee2e2':'#f3f4f6';
        var clr = cls==='adequate'?'#166534':cls==='borderline'?'#854d0e':cls==='deficient'?'#991b1b':'#6b7280';
        return '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:'+bg+';color:'+clr+'">'+esc(label)+'</span>';
    }

    // =========================================================================
    // PAGE HEADER
    // =========================================================================

    function renderPageHeader(pgr) {
        var appDate = pgr && pgr.applicationDate ? fmtDate(pgr.applicationDate) : null;
        var product = pgr && pgr.product && pgr.product.name ? pgr.product.name : null;
        var sub = [];
        if (product) sub.push(product);
        if (appDate)  sub.push('Applied ' + appDate);
        if (pgr && pgr.daysSince != null) sub.push(pgr.daysSince + ' days ago');
        return '<div class="gl-page-header">'+
            '<div class="gl-page-title">PGR &amp; Irrigation</div>'+
            (sub.length ? '<div class="gl-page-sub">'+esc(sub.join(' · '))+'</div>' : '')+
            '</div>';
    }

    // =========================================================================
    // KPI SECTION
    // =========================================================================

    function renderKpis(pgr) {
        var rs      = reapplyStatus(pgr);
        var phase   = pgr && pgr.effect ? phaseStatus(pgr.effect.phase) : phaseStatus(null);
        var pct     = pgr && pgr.gdd ? pgr.gdd.progressPct : null;
        var pctCls  = pct == null ? 'no-data' : pct >= 85 ? 'deficient' : pct >= 65 ? 'borderline' : 'adequate';
        var pctClr  = pct == null ? '#6b7280' : pct >= 85 ? '#991b1b'   : pct >= 65 ? '#854d0e'   : '#15803d';

        var daysCard = kpiCard(
            'Days Since App',
            pgr && pgr.daysSince != null ? String(pgr.daysSince) : '—',
            'days',
            badgeHtml(pgr && pgr.applicationDate ? fmtDate(pgr.applicationDate) : 'No date', 'no-data'),
            '#2563eb'
        );
        var gddCard = kpiCard(
            'GDD Progress',
            pct != null ? fmt(pct, 0) : '—',
            '%',
            badgeHtml(
                pgr && pgr.gdd ? fmt(pgr.gdd.accumulated,0)+' / '+fmt(pgr.gdd.threshold,0)+' GDD' : '—',
                pctCls
            ),
            pctClr,
            'pgr-gdd'
        );
        var suppCard = kpiCard(
            'Suppression',
            pgr && pgr.effect ? fmt(pgr.effect.suppressionPct, 0) : '—',
            '%',
            badgeHtml(phase.label, phase.cls),
            phase.color,
            'pgr-suppression'
        );
        var reapCard = kpiCard(
            'Reapplication',
            pgr && pgr.gdd && pgr.gdd.remaining != null
                ? (pgr.gdd.remaining > 0 ? fmt(pgr.gdd.remaining, 0) : '0')
                : '—',
            pgr && pgr.gdd && pgr.gdd.remaining > 0 ? 'GDD remaining' : 'GDD (due)',
            badgeHtml(rs.label, rs.cls),
            rs.color,
            'pgr-reapply'
        );

        return '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+
            daysCard + gddCard + suppCard + reapCard +
            '</div>';
    }

    // =========================================================================
    // GDD PROGRESS BLOCK
    // =========================================================================

    function renderGddProgress(pgr) {
        if (!pgr || !pgr.gdd) return '';
        var pct     = Math.min(pgr.gdd.progressPct || 0, 100);
        var overdue = pgr.gdd.isOverdue;
        var color   = overdue ? '#ef4444' : pct >= 85 ? '#f59e0b' : pct >= 65 ? '#f59e0b' : '#22c55e';
        var recHtml = pgr.recommendation
            ? '<div style="margin-top:10px;padding:8px 12px;background:#f5f7f6;border-left:3px solid #d8e0dc;border-radius:4px;font-size:12px;color:#374151">'+
              '<strong style="display:block;margin-bottom:2px">'+esc(pgr.recommendation.action || 'Recommendation')+'</strong>'+
              esc(pgr.recommendation.message || '')+'</div>'
            : '';
        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#2563eb"></div>',
            '    <div class="gl-block-title">GDD Progress '+infoBtn('pgr-gdd')+'</div>',
            '    <div class="gl-block-sub">'+esc(fmt(pgr.gdd.accumulated,0))+' of '+esc(fmt(pgr.gdd.threshold,0))+' GDD accumulated</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="pgr-gdd-bar-wrap">',
            '      <div class="pgr-gdd-bar-track">',
            '        <div class="pgr-gdd-bar-fill" style="width:'+pct+'%;background:'+color+'"></div>',
            '      </div>',
            '      <div class="pgr-gdd-labels">',
            '        <span>Application</span>',
            '        <span style="color:'+color+';font-weight:600">'+fmt(pct,0)+'%'+(overdue?' — OVERDUE':'')+'</span>',
            '        <span>Threshold ('+fmt(pgr.gdd.threshold,0)+' GDD)</span>',
            '      </div>',
            '    </div>',
            '    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;font-size:12px">',
            '      <div><div style="color:#6b7280;margin-bottom:2px">Base temp</div><strong>'+fmt(pgr.gdd.base,1)+'°C</strong></div>',
            '      <div><div style="color:#6b7280;margin-bottom:2px">Days since app</div><strong>'+fmt(pgr.daysSince,0)+'</strong></div>',
            '      <div><div style="color:#6b7280;margin-bottom:2px">GDD remaining</div><strong>'+(pgr.gdd.remaining > 0 ? fmt(pgr.gdd.remaining,0) : '0 (due)')+'</strong></div>',
            '    </div>',
            recHtml,
            '  </div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // IRRIGATION SCHEDULE
    // =========================================================================

    function renderIrrigationSchedule(wb) {
        var schedule = wb && wb.schedule7;
        if (!Array.isArray(schedule) || !schedule.length) return '';

        function dayRow(d) {
            var dayDate = new Date((d.date || '') + 'T12:00:00');
            var dayName = isNaN(dayDate.getTime()) ? (d.date || '') :
                dayDate.toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' });
            var etc  = d.etc  != null ? fmt(d.etc, 1)  : (d.et0 != null ? fmt(d.et0, 1) : '—');
            var rain = d.precipitation != null ? fmt(d.precipitation, 1) : '—';
            var irr  = d.irrigation
                ? (d.irrigation.totalDepth != null ? Math.round(d.irrigation.totalDepth) : 0)
                : 0;
            var dep  = d.depletion != null ? Math.round(d.depletion) : null;
            var cls  = irr > 0 ? ' class="irr-day"' : '';
            return '<tr'+cls+'><td>'+esc(dayName)+'</td>'+
                '<td style="text-align:right">'+esc(etc)+'</td>'+
                '<td style="text-align:right">'+esc(rain)+'</td>'+
                '<td style="text-align:right">'+(irr>0?irr+'mm':'—')+'</td>'+
                '<td style="text-align:right">'+(dep!=null?dep+'%':'—')+'</td>'+
                '</tr>';
        }

        var weeklyNeed = wb.weeklyNeed != null ? Math.round(wb.weeklyNeed) + ' mm' : '—';
        var netDeficit = wb.netDeficit != null ? (wb.netDeficit > 0 ? '+' : '') + fmt(wb.netDeficit, 0) + ' mm' : '—';

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#0369a1"></div>',
            '    <div class="gl-block-title">7-Day Irrigation Schedule '+infoBtn('pgr-et')+'</div>',
            '    <div class="gl-block-sub">Weekly need: '+esc(weeklyNeed)+' · Net deficit: '+esc(netDeficit)+'</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <table class="pgr-irr-table">',
            '      <thead><tr>',
            '        <th>Date</th>',
            '        <th style="text-align:right">ETc (mm)</th>',
            '        <th style="text-align:right">Rain (mm)</th>',
            '        <th style="text-align:right">Irrigation</th>',
            '        <th style="text-align:right">Depletion</th>',
            '      </tr></thead>',
            '      <tbody>'+schedule.map(dayRow).join('')+'</tbody>',
            '    </table>',
            '  </div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // SOIL CONDITIONS
    // =========================================================================

    function soilMoistureStatus(depletionPct) {
        if (depletionPct == null) return { label:'No data', cls:'no-data', color:'#6b7280' };
        if (depletionPct >= 70)  return { label:'Critical',  cls:'deficient',  color:'#991b1b' };
        if (depletionPct >= 50)  return { label:'Stressed',  cls:'borderline', color:'#854d0e' };
        if (depletionPct >= 30)  return { label:'Adequate',  cls:'adequate',   color:'#15803d' };
        return                          { label:'Optimal',   cls:'adequate',   color:'#15803d' };
    }

    function renderSoilConditions(wb, soilTemp) {
        var innerWb = wb && wb.waterBalance;
        var hasMoisture = innerWb && (innerWb.currentDepletion != null || innerWb.taw != null);
        var hasTempData = soilTemp && soilTemp.summary && soilTemp.summary.available;

        if (!hasMoisture && !hasTempData) return '';

        var rows = '';

        if (hasMoisture) {
            var taw  = innerWb.taw != null ? fmt(innerWb.taw, 0) : '—';
            var dep  = innerWb.currentDepletion != null ? fmt(innerWb.currentDepletion, 0) : '—';
            var pct  = (innerWb.taw > 0 && innerWb.currentDepletion != null)
                ? Math.round(innerWb.currentDepletion / innerWb.taw * 100) : null;
            var ms   = soilMoistureStatus(pct);
            var fc   = innerWb.soilProps && innerWb.soilProps.fieldCapacity != null
                ? (innerWb.soilProps.fieldCapacity * 100).toFixed(0) + '%' : '—';
            var awc  = innerWb.soilProps && innerWb.soilProps.awc != null
                ? (innerWb.soilProps.awc * 100).toFixed(0) + '%' : '—';

            rows += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:12px">';
            rows += soilStatCell('Current Depletion', pct != null ? pct + '%' : dep + ' mm', ms.label, ms.cls);
            rows += soilStatCell('Total Available Water', taw + ' mm', 'Rootzone capacity', 'no-data');
            rows += soilStatCell('Field Capacity', fc, 'Volumetric', 'adequate');
            rows += soilStatCell('Plant Available Water', awc, 'AWC', 'adequate');
            rows += '</div>';

            if (pct != null) {
                var barColor = ms.cls === 'deficient' ? '#ef4444' : ms.cls === 'borderline' ? '#f59e0b' : '#22c55e';
                rows += '<div class="pgr-gdd-bar-wrap">'+
                    '<div class="pgr-gdd-bar-track">'+
                    '<div class="pgr-gdd-bar-fill" style="width:'+Math.min(pct,100)+'%;background:'+barColor+'"></div>'+
                    '</div>'+
                    '<div class="pgr-gdd-labels">'+
                    '<span>Field Capacity</span>'+
                    '<span style="color:'+barColor+';font-weight:600">'+pct+'% depleted — '+ms.label+'</span>'+
                    '<span>Wilting Point</span>'+
                    '</div></div>';
            }
        }

        if (hasTempData) {
            var s   = soilTemp.summary;
            var d25 = s.d25mm  != null ? fmt(s.d25mm, 1) + '°C'  : null;
            var d50 = s.d50mm  != null ? fmt(s.d50mm, 1) + '°C'  : null;
            var d10 = s.d100mm != null ? fmt(s.d100mm, 1) + '°C' : null;
            if (d25 || d50 || d10) {
                rows += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;font-size:12px">';
                if (d25) rows += '<div><div style="color:#6b7280;margin-bottom:2px">Soil temp 25mm</div><strong>'+esc(d25)+'</strong></div>';
                if (d50) rows += '<div><div style="color:#6b7280;margin-bottom:2px">Soil temp 50mm</div><strong>'+esc(d50)+'</strong></div>';
                if (d10) rows += '<div><div style="color:#6b7280;margin-bottom:2px">Soil temp 100mm</div><strong>'+esc(d10)+'</strong></div>';
                rows += '</div>';
            }
        }

        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#92400e"></div>',
            '    <div class="gl-block-title">Soil Conditions</div>',
            '    <div class="gl-block-sub">Moisture status and temperature — affects PGR uptake and GDD accumulation</div>',
            '  </div>',
            '  <div class="gl-block-body">'+rows+'</div>',
            '</div>',
        ].join('\n');
    }

    function soilStatCell(label, value, subLabel, cls) {
        var bg  = cls==='adequate'?'#f0fdf4':cls==='borderline'?'#fffbeb':cls==='deficient'?'#fef2f2':'#f9fafb';
        var brd = cls==='adequate'?'#86efac':cls==='borderline'?'#fde68a':cls==='deficient'?'#fca5a5':'#e5e7eb';
        return '<div style="background:'+bg+';border:1px solid '+brd+';border-radius:8px;padding:10px 12px">'+
            '<div style="font-size:11px;color:#6b7280;margin-bottom:3px">'+esc(label)+'</div>'+
            '<div style="font-size:18px;font-weight:700;color:#111827;line-height:1">'+esc(value)+'</div>'+
            '<div style="font-size:11px;color:#6b7280;margin-top:3px">'+esc(subLabel)+'</div>'+
            '</div>';
    }

    // =========================================================================
    // PGR + IRRIGATION TIMING
    // =========================================================================

    function renderTiming(pgr) {
        var v = pgrVerdictKey(pgr);
        var cards = [
            {
                label: 'Before Application',
                text:  'Irrigate 24–48 hours before PGR application. Adequate soil moisture improves systemic uptake and translocation. Avoid drought-stressed turf.',
                warn:  false,
            },
            {
                label: 'After Application',
                text:  'Withhold irrigation for 4–6 hours post-application. Light irrigation (2–3mm) after 24 hours aids uptake without reducing foliar contact.',
                warn:  false,
            },
            {
                label: 'During Peak Phase',
                text:  'Maintain consistent soil moisture during peak suppression. Water stress combined with strong PGR suppression increases phytotoxicity risk.',
                warn:  false,
            },
            {
                label: v === 'DUE' || v === 'APPROACHING' ? 'Reapplication Window' : 'Next Reapplication',
                text:  v === 'DUE'
                    ? 'Reapplication overdue. Apply as soon as possible. Irrigate the day before and withhold for 4–6h after.'
                    : v === 'APPROACHING'
                    ? 'Prepare for reapplication: schedule irrigation 24–48h before the planned application date.'
                    : 'Monitor GDD accumulation. Plan next application when 65–75% of threshold is reached.',
                warn: v === 'DUE' || v === 'APPROACHING',
            },
        ];
        var cardsHtml = cards.map(function(c) {
            return '<div class="pgr-timing-card'+(c.warn?' warn':'')+'">'+
                '<div class="pgr-timing-label">'+esc(c.label)+'</div>'+
                '<div class="pgr-timing-text">'+esc(c.text)+'</div>'+
                '</div>';
        }).join('');
        return [
            '<div class="gl-block">',
            '  <div class="gl-block-header">',
            '    <div class="gl-block-accent" style="background:#7c3aed"></div>',
            '    <div class="gl-block-title">PGR + Irrigation Timing '+infoBtn('pgr-irr-timing')+'</div>',
            '    <div class="gl-block-sub">Sequencing recommendations</div>',
            '  </div>',
            '  <div class="gl-block-body">',
            '    <div class="pgr-timing-grid">'+cardsHtml+'</div>',
            '  </div>',
            '</div>',
        ].join('\n');
    }

    // =========================================================================
    // EMPTY STATE
    // =========================================================================

    function renderEmpty(container) {
        container.innerHTML =
            '<div class="wb-page"><div class="gl-page-header"><div class="gl-page-title">PGR &amp; Irrigation</div></div>'+
            '<div class="gl-body">'+renderPgrInputCard(readSavedPgr())+'</div></div>';
        initPgrInputCard(container);
    }

    // =========================================================================
    // PGR INPUT CARD
    // =========================================================================

    function getPgrStateKey() {
        var uid = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.userId;
        return 'gilba_hub_state' + (uid ? '_' + uid : '');
    }

    function readSavedPgr() {
        try {
            var raw = localStorage.getItem(getPgrStateKey());
            var state = raw ? JSON.parse(raw) : null;
            return (state && state.pgr) || null;
        } catch(e) { return null; }
    }

    var PGR_PRODUCTS = [
        { value:'TE250',  label:'TE 250g/L (Primo)',              group:'Trinexapac-ethyl' },
        { value:'TE175',  label:'TE 175g/L (Amigo 175 / Marvel)', group:'Trinexapac-ethyl' },
        { value:'TE120',  label:'TE 120g/L (Primo Maxx 120)',     group:'Trinexapac-ethyl' },
        { value:'PBZ200', label:'Paclobutrazol 200g/L',           group:'Paclobutrazol' },
        { value:'PBZ250', label:'Paclobutrazol 250g/L',           group:'Paclobutrazol' },
        { value:'ETH',    label:'Ethephon 480g/L',                group:'Ethephon' },
    ];

    function renderPgrInputCard(saved) {
        var enabled = saved && saved.enabled;
        var product = (saved && saved.productType) || '';
        var date    = (saved && saved.applicationDate) || '';
        var rate    = (saved && saved.rateLperHa) || '';

        var groups = {}, groupOrder = [];
        PGR_PRODUCTS.forEach(function(p) {
            if (!groups[p.group]) { groups[p.group] = []; groupOrder.push(p.group); }
            groups[p.group].push(p);
        });
        var opts = '<option value="">— Select product —</option>';
        groupOrder.forEach(function(g) {
            opts += '<optgroup label="'+esc(g)+'">';
            groups[g].forEach(function(p) {
                opts += '<option value="'+esc(p.value)+'"'+(p.value===product?' selected':'')+'>'+esc(p.label)+'</option>';
            });
            opts += '</optgroup>';
        });

        return '<div class="pgr-input-card" id="pgr-input-card" style="background:var(--db-card-bg,#1a2920);border:1px solid var(--db-border,#2d3d35);border-radius:10px;padding:16px 20px;margin-bottom:16px">'+
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--db-text,#d4e8de)">'+
            '<input type="checkbox" id="pgr-enable-cb"'+(enabled?' checked':'')+' style="width:15px;height:15px;cursor:pointer">'+
            'PGR Application</label></div>'+
            '<div id="pgr-fields" style="display:'+(enabled?'block':'none')+'">'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'+
            '<div><label style="font-size:11px;color:var(--db-text-muted,#8a9e95);display:block;margin-bottom:4px">Product</label>'+
            '<select id="pgr-product-sel" style="width:100%;background:var(--db-bg,#111c17);border:1px solid var(--db-border,#2d3d35);border-radius:6px;color:var(--db-text,#d4e8de);padding:6px 8px;font-size:13px">'+opts+'</select></div>'+
            '<div><label style="font-size:11px;color:var(--db-text-muted,#8a9e95);display:block;margin-bottom:4px">Rate (L/ha)</label>'+
            '<input type="number" id="pgr-rate-inp" step="0.1" min="0" placeholder="e.g. 0.4" value="'+esc(rate)+'" style="width:100%;background:var(--db-bg,#111c17);border:1px solid var(--db-border,#2d3d35);border-radius:6px;color:var(--db-text,#d4e8de);padding:6px 8px;font-size:13px;box-sizing:border-box"></div>'+
            '</div>'+
            '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--db-text-muted,#8a9e95);display:block;margin-bottom:4px">Last application date</label>'+
            '<input type="date" id="pgr-date-inp" value="'+esc(date)+'" style="width:100%;background:var(--db-bg,#111c17);border:1px solid var(--db-border,#2d3d35);border-radius:6px;color:var(--db-text,#d4e8de);padding:6px 8px;font-size:13px;box-sizing:border-box"></div>'+
            '</div>'+
            '<button id="pgr-save-btn" style="background:#166534;color:#d4e8de;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;width:100%">Save &amp; Re-run Analysis</button>'+
            '<div id="pgr-save-msg" style="display:none;margin-top:8px;font-size:12px;color:var(--db-text-muted,#8a9e95);text-align:center"></div>'+
            '</div>';
    }

    function initPgrInputCard(container) {
        var cb      = container.querySelector('#pgr-enable-cb');
        var fields  = container.querySelector('#pgr-fields');
        var saveBtn = container.querySelector('#pgr-save-btn');
        var msg     = container.querySelector('#pgr-save-msg');
        if (!cb || !saveBtn) return;

        cb.addEventListener('change', function() {
            fields.style.display = cb.checked ? 'block' : 'none';
        });

        saveBtn.addEventListener('click', function() {
            var enabled = cb.checked;
            var pgr = {
                enabled:         enabled,
                productType:     enabled ? (container.querySelector('#pgr-product-sel') || {}).value || '' : '',
                applicationDate: enabled ? (container.querySelector('#pgr-date-inp') || {}).value || '' : null,
                rateLperHa:      enabled ? (container.querySelector('#pgr-rate-inp') || {}).value || '' : null,
            };

            try {
                var key   = getPgrStateKey();
                var state = JSON.parse(localStorage.getItem(key) || '{}');
                state.pgr = pgr;
                localStorage.setItem(key, JSON.stringify(state));
            } catch(e) {}

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saved — running analysis…';
            if (msg) { msg.style.display = 'block'; msg.textContent = 'Analysis running in background. Page will reload when complete.'; }

            var rerunBtn = document.getElementById('db-rerun-btn');
            if (rerunBtn) {
                rerunBtn.click();
            } else {
                setTimeout(function() { global.location.reload(); }, 3000);
            }
        });
    }

    // =========================================================================
    // INFO POPOVERS
    // =========================================================================

    function initInfoPopovers() {
        var popover = document.getElementById('db-info-popover');
        if (!popover || popover._gaipReady) return;
        popover._gaipReady = true;
        function positionPopover(anchor) {
            var ar = anchor.getBoundingClientRect();
            var pr = popover.getBoundingClientRect();
            var top  = ar.bottom + 8;
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
        var container = document.getElementById('pgr-page-content');
        if (!container) return;

        var data      = global.GAIP_DASHBOARD_DATA;
        var pgr       = data && data.computed && data.computed.pgr;
        var wb        = data && data.computed && data.computed.waterBalance;
        var soilTemp  = data && data.computed && data.computed.soilTempPhysics;

        injectStyles();

        if (!pgr && !wb) { renderEmpty(container); return; }

        initInfoPopovers();

        var headerHtml = renderPageHeader(pgr);
        var soilHtml   = renderSoilConditions(wb, soilTemp);
        var irrHtml    = renderIrrigationSchedule(wb);

        var pgrHtml = renderPgrInputCard(readSavedPgr());
        if (pgr) {
            pgrHtml +=
                renderVerdict(pgr) +
                renderKpis(pgr) +
                renderGddProgress(pgr) +
                renderTiming(pgr);
        }

        container.innerHTML =
            '<div class="wb-page">'+
            headerHtml+
            '<div class="gl-body">'+
            pgrHtml +
            soilHtml +
            irrHtml +
            '</div>'+
            '</div>';

        initPgrInputCard(container);
        initInfoPopovers();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_PGRIrrigationAnalysis = {
        init: function() { render(); }
    };

}(typeof window !== 'undefined' ? window : this));
