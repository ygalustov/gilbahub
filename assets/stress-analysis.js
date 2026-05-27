/**
 * Stress Index Analysis — /analysis#stress tab
 * Data sources:
 *   computed.stress            → environmentalStressIndex, severity, factors[], combinedGrowthModifier
 *   computed.stressTrajectory  → trajectory[], summary (currentScore, peakScore, interventionWindows, …)
 */

(function (global) {
    'use strict';

    if (global.GAIP_StressAnalysis) return;

    // =========================================================================
    // GLOSSARY
    // =========================================================================

    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, {
        'stress-esi': {
            title: 'Environmental Stress Index (ESI)',
            body:  'Combined 0–100 score summarising how much current conditions are limiting turf performance.\n\n' +
                   '0–30 Normal — conditions favourable, minimal stress\n' +
                   '31–50 Caution — some stress, monitor closely\n' +
                   '51–65 Warning — significant limitation, intervention recommended\n' +
                   '66–80 Critical — immediate action required\n' +
                   '81–100 Failure — surface damage imminent\n\n' +
                   'Components: Thermal 20%, Light 15%, Moisture 20%, Traffic 20%, Nutrition 15%, Biotic 10%.',
        },
        'stress-compound': {
            title: 'Compound Stress Effects',
            body:  'When two or more stressors exceed 35%, they interact multiplicatively:\n\n' +
                   'Heat + Drought → ×1.5\n' +
                   'Shade + Traffic → ×1.4\n' +
                   'Disease + Heat → ×1.4\n' +
                   'Disease + Wet → ×1.6\n' +
                   'Heat + Traffic → ×1.35\n' +
                   'Shade + Low N → ×1.25\n\n' +
                   'The growth modifier reflects the combined drag on turf growth rate.',
        },
        'stress-thermal': {
            title: 'Thermal Stress',
            body:  'Temperature-driven limitation on growth potential.\n\n' +
                   'Calculated from Growth Potential (GP): when GP < 50% the temperature is outside the species optimal range.\n\n' +
                   'C3 grasses (cool-season): optimal 15–24°C, stressed above 28°C or below 5°C.\n' +
                   'C4 grasses (warm-season): optimal 27–35°C, stressed below 15°C.',
        },
        'stress-light': {
            title: 'Light Stress (DLI Deficit)',
            body:  'Stress caused by insufficient Daily Light Integral (DLI) relative to species minimum requirement.\n\n' +
                   'Calculated only from structural shade (SVF < 1, facade, or tree obstruction). Open-sky DLI variation is not counted as stress.\n\n' +
                   'Fine turf minimum: 18–22 mol/m²/day. Below threshold, recovery from stress or traffic slows significantly.',
        },
        'stress-moisture': {
            title: 'Moisture Stress',
            body:  'Stress from soil water deficit (drought) or excess (waterlogging).\n\n' +
                   'Drought stress activates when soil moisture depletion exceeds RAW (Readily Available Water). Waterlogging activates when VWC exceeds field capacity.\n\n' +
                   'Drought + Heat compound effect (×1.5) is the most damaging combination in summer.',
        },
        'stress-traffic': {
            title: 'Traffic Stress',
            body:  'Mechanical wear stress from match play, training, and maintenance traffic.\n\n' +
                   'Calculated from scheduled events × surface capacity. High traffic on heat-stressed or shade-limited turf compounds the wear damage (×1.35–1.4 multiplier).',
        },
        'stress-nutrition': {
            title: 'Nutrition Stress',
            body:  'Growth limitation from nutrient deficiencies (MLSN/SLAN analysis).\n\n' +
                   'Stress is activated when one or more primary nutrients (N, K, P) fall below threshold. Combined with shade, nutrition stress amplifies weakness (Shade + Low N → ×1.25).',
        },
        'stress-biotic': {
            title: 'Biotic Stress',
            body:  'Stress from active disease pressure.\n\n' +
                   'Calculated from the overall disease risk score. Biotic stress compounds with Heat (×1.4) and Wet conditions (×1.6), making disease management critical under those scenarios.',
        },
        'stress-trajectory': {
            title: '14-Day Stress Trajectory',
            body:  'Forward projection of the combined stress index over 14 days, using the weather forecast and current site state.\n\n' +
                   'Each bar represents the projected ESI score for that day, coloured by severity level. Intervention windows are periods when the score drops below the Normal threshold — the best times to schedule maintenance.',
        },
        'stress-intervention': {
            title: 'Intervention Windows',
            body:  'Periods over the next 14 days when projected stress falls below the Normal threshold (score < 30).\n\n' +
                   'These are the optimal windows for stress-inducing maintenance operations: aeration, verticutting, topdressing, overseeding. Scheduling these during low-stress windows minimises setback.',
        },
    });

    // =========================================================================
    // HELPERS
    // =========================================================================

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function fmt(v, dec) {
        if (v == null || isNaN(v)) return '—';
        return Number(v).toFixed(dec == null ? 0 : dec);
    }
    function fmtDate(str) {
        if (!str) return '—';
        try {
            var d = new Date(str + 'T12:00:00');
            return isNaN(d) ? str : d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
        } catch (e) { return str; }
    }
    function infoBtn(key) {
        return '<button class="db-info-icon" data-info="' + esc(key) + '" tabindex="0" aria-label="Learn more">i</button>';
    }

    // =========================================================================
    // LEVEL META
    // =========================================================================

    var LEVEL_META = {
        normal:   { label: 'Normal',   cls: 'acceptable', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
        caution:  { label: 'Caution',  cls: 'monitor',    color: '#854d0e', bg: '#fffbeb', border: '#fde68a' },
        warning:  { label: 'Warning',  cls: 'high_risk',  color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
        critical: { label: 'Critical', cls: 'high_risk',  color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
        failure:  { label: 'Failure',  cls: 'high_risk',  color: '#7f1d1d', bg: '#fef2f2', border: '#f87171' },
    };

    var SEVERITY_LEVEL = { low: 'normal', moderate: 'caution', high: 'warning', critical: 'critical' };

    function levelMeta(level) {
        return LEVEL_META[level] || LEVEL_META.normal;
    }

    // =========================================================================
    // CSS
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('stress-styles')) return;
        var el = document.createElement('style');
        el.id = 'stress-styles';
        el.textContent = [
            /* Factor grid */
            '.st-factor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
            '@media(max-width:700px){.st-factor-grid{grid-template-columns:repeat(2,1fr)}}',
            '@media(max-width:480px){.st-factor-grid{grid-template-columns:1fr}}',
            '.st-factor-card{border-radius:8px;padding:12px 14px;border:1px solid}',
            '.st-factor-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6a65;margin-bottom:6px;display:flex;align-items:center;gap:4px}',
            '.st-factor-val{font-size:22px;font-weight:800;line-height:1;margin-bottom:3px}',
            '.st-factor-bar-track{height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;margin-bottom:4px}',
            '.st-factor-bar-fill{height:100%;border-radius:3px}',
            '.st-factor-note{font-size:11px;color:#6b7280;line-height:1.4}',
            /* Trajectory chart */
            '.st-traj-grid{display:grid;gap:3px;align-items:end;height:80px}',
            '.st-traj-bar{border-radius:3px 3px 0 0;min-height:4px;transition:opacity .15s;cursor:default}',
            '.st-traj-bar:hover{opacity:.8}',
            '.st-traj-labels{display:grid;gap:3px;margin-top:4px}',
            '.st-traj-label{font-size:9px;color:#9ca3af;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            /* Intervention windows */
            '.st-window{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;margin-bottom:6px}',
            '.st-window-dot{width:8px;height:8px;border-radius:50%;background:#15803d;flex-shrink:0}',
            '.st-window-text{font-size:12px;color:#14532d;font-weight:600}',
            '.st-window-sub{font-size:11px;color:#166534;margin-top:1px}',
            /* Component breakdown */
            '.st-component-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f3f4f6}',
            '.st-component-row:last-child{border-bottom:none}',
            '.st-component-name{font-size:12px;font-weight:600;color:#374151;min-width:90px}',
            '.st-component-track{flex:1;height:8px;border-radius:4px;background:#e5e7eb;overflow:hidden}',
            '.st-component-fill{height:100%;border-radius:4px}',
            '.st-component-val{font-size:11px;font-weight:700;min-width:32px;text-align:right}',
        ].join('\n');
        document.head.appendChild(el);
    }

    // =========================================================================
    // VERDICT BLOCK (gl-header + gl-kpi-grid — mirrors water-balance pattern)
    // =========================================================================

    function hexToRgb(hex) {
        var h = (hex || '#2d6a4f').replace('#', '');
        return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
    }

    function kpiCard(label, value, unit, statusHtml, color) {
        var rgb    = hexToRgb(color);
        var bg     = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.07)';
        var border = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.25)';
        return [
            '<div class="gl-kpi-card" style="background:'+bg+';border-color:'+border+';border-left-color:'+color+'">',
            '  <div class="gl-kpi-label">'+esc(label)+'</div>',
            '  <div class="gl-kpi-value" style="color:'+color+'">'+esc(String(value))+'</div>',
            '  <div class="gl-kpi-unit">'+esc(unit)+'</div>',
            '  <div>'+statusHtml+'</div>',
            '</div>',
        ].join('');
    }

    function levelBadge(meta) {
        return '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;' +
            'background:'+meta.bg+';color:'+meta.color+';border:1px solid '+meta.border+'">'+esc(meta.label)+'</span>';
    }

    function renderVerdict(stress, traj) {
        var score = (traj && traj.summary && traj.summary.currentScore != null)
            ? Math.round(traj.summary.currentScore)
            : (stress && stress.environmentalStressIndex != null ? Math.round(stress.environmentalStressIndex) : null);
        var levelKey = (traj && traj.summary && traj.summary.currentLevel)
            || (stress && SEVERITY_LEVEL[stress.severity])
            || 'normal';
        var meta = levelMeta(levelKey);

        var peakScore = traj && traj.summary && traj.summary.peakScore != null ? Math.round(traj.summary.peakScore) : null;
        var peakDate  = traj && traj.summary && traj.summary.peakDate ? fmtDate(traj.summary.peakDate) : null;
        var peakMeta  = traj && traj.summary && traj.summary.peakLevel ? levelMeta(traj.summary.peakLevel) : meta;

        var primary = traj && traj.summary && traj.summary.primaryStressor ? traj.summary.primaryStressor : null;
        var rec     = traj && traj.summary && traj.summary.recommendation
            ? (typeof traj.summary.recommendation === 'string'
                ? traj.summary.recommendation
                : (traj.summary.recommendation.message || ''))
            : null;
        var growthPct = stress && stress.combinedGrowthModifier != null
            ? Math.round(stress.combinedGrowthModifier * 100)
            : null;

        var cards = [
            kpiCard('Stress Index',      score != null ? score : '—',                  '/100',      levelBadge(meta),                   meta.color),
            kpiCard('14-Day Peak',       peakScore != null ? peakScore : '—',          '/100',      levelBadge(peakMeta),                peakMeta.color),
            kpiCard('Primary Stressor',  primary ? capitalize(primary) : '—',          '',          '',                                  '#6b7280'),
            kpiCard('Growth Modifier',   growthPct != null ? growthPct + '%' : '—',    'of potential', '',                              growthPct != null && growthPct < 70 ? '#d97706' : '#15803d'),
        ];

        return [
            '<div class="gl-header">',
            '<div class="gl-header-inner">',
            '<div style="display:flex;align-items:center;margin-bottom:2px">',
            '<h1 class="gl-title">Stress Index Analysis</h1>',
            '</div>',
            '<div class="gl-subtitle">Environmental stress index, contributing factors and 14-day trajectory</div>',
            '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+cards.join('')+'</div>',
            rec ? '<div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:'+meta.bg+
                ';border:1px solid '+meta.border+';font-size:13px;color:'+meta.color+';font-weight:500">'+esc(rec)+'</div>' : '',
            '</div>',
            '</div>',
        ].join('\n');
    }

    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    // =========================================================================
    // FACTOR CARDS
    // =========================================================================

    var FACTOR_META = {
        thermal:   { label: 'Thermal',   infoKey: 'stress-thermal',   weight: 20, color: '#dc2626', okColor: '#15803d' },
        light:     { label: 'Light',     infoKey: 'stress-light',     weight: 15, color: '#7c3aed', okColor: '#15803d' },
        moisture:  { label: 'Moisture',  infoKey: 'stress-moisture',  weight: 20, color: '#2563eb', okColor: '#15803d' },
        traffic:   { label: 'Traffic',   infoKey: 'stress-traffic',   weight: 20, color: '#d97706', okColor: '#15803d' },
        nutrition: { label: 'Nutrition', infoKey: 'stress-nutrition', weight: 15, color: '#7c3aed', okColor: '#15803d' },
        biotic:    { label: 'Disease',   infoKey: 'stress-biotic',    weight: 10, color: '#991b1b', okColor: '#15803d' },
    };

    function factorBg(score) {
        if (score >= 66) return { bg: '#fef2f2', border: '#fca5a5' };
        if (score >= 51) return { bg: '#fff7ed', border: '#fed7aa' };
        if (score >= 31) return { bg: '#fffbeb', border: '#fde68a' };
        return { bg: '#f9fafb', border: '#e5e7eb' };
    }

    function renderFactorCards(stress, traj) {
        var components = traj && traj.currentComponents ? traj.currentComponents : null;
        var factors    = (stress && stress.factors) ? stress.factors : [];

        var factorByType = {};
        factors.forEach(function (f) { factorByType[f.type] = f; });

        var keys = ['thermal', 'light', 'moisture', 'traffic', 'nutrition', 'biotic'];
        var cards = keys.map(function (key) {
            var meta  = FACTOR_META[key];
            var score = components ? (components[key] || 0) : 0;
            var fac   = factorByType[key] || null;
            var colors = factorBg(score);
            var barColor = score >= 66 ? '#ef4444' : score >= 51 ? '#f97316' : score >= 31 ? '#f59e0b' : '#22c55e';
            var valColor = score >= 51 ? '#991b1b' : score >= 31 ? '#854d0e' : '#15803d';

            var noteText = '';
            if (fac && fac.note) {
                noteText = fac.note;
            } else if (score === 0) {
                noteText = 'No stress detected';
            }

            return '<div class="st-factor-card" style="background:' + colors.bg + ';border-color:' + colors.border + '">' +
                '<div class="st-factor-label">' + esc(meta.label) + ' <span style="opacity:.6">(' + meta.weight + '%)</span>' + infoBtn(meta.infoKey) + '</div>' +
                '<div class="st-factor-val" style="color:' + valColor + '">' + score + '</div>' +
                '<div class="st-factor-bar-track"><div class="st-factor-bar-fill" style="width:' + Math.min(score, 100) + '%;background:' + barColor + '"></div></div>' +
                (noteText ? '<div class="st-factor-note">' + esc(noteText) + '</div>' : '') +
                '</div>';
        });

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#f97316"></div>' +
            '<div class="gl-block-title">Stress Factors ' + infoBtn('stress-esi') + '</div>' +
            '<div class="gl-block-sub">Current component scores (0–100) · Weighted to ESI</div>' +
            '</div>' +
            '<div class="gl-block-body"><div class="st-factor-grid">' + cards.join('') + '</div></div>' +
            '</div>';
    }

    // =========================================================================
    // COMPOUND EFFECTS
    // =========================================================================

    function renderCompound(stress, traj) {
        var trajDay0 = traj && traj.trajectory && traj.trajectory[0];
        var compound = trajDay0 && trajDay0.compound;
        if (!compound || compound.multiplier <= 1.0) return '';

        var multiplier = compound.multiplier || 1;
        var active     = compound.activeEffects || [];

        var effectsHtml = active.map(function (e) {
            return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #fde68a;display:flex;justify-content:space-between">' +
                '<span>' + esc(e.replace(/_/g, ' + ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + '</span>' +
                '</div>';
        }).join('');

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#dc2626"></div>' +
            '<div class="gl-block-title">Compound Stress Active ' + infoBtn('stress-compound') + '</div>' +
            '<div class="gl-block-sub">Multiple stressors interacting — combined effect amplified</div>' +
            '</div>' +
            '<div class="gl-block-body">' +
            '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">' +
            '<div style="font-size:36px;font-weight:900;color:#991b1b">' + multiplier.toFixed(2) + '×</div>' +
            '<div>' +
            '<div style="font-size:14px;font-weight:700;color:#7f1d1d">Compound multiplier</div>' +
            '<div style="font-size:12px;color:#991b1b">Growth modifier reduced to ' + (stress && stress.combinedGrowthModifier != null ? Math.round(stress.combinedGrowthModifier * 100) : '—') + '% of potential</div>' +
            '</div></div>' +
            (effectsHtml ? '<div style="border-top:1px solid #fde68a;padding-top:8px">' + effectsHtml + '</div>' : '') +
            '</div></div>';
    }

    // =========================================================================
    // 14-DAY TRAJECTORY CHART
    // =========================================================================

    function renderTrajectory(traj) {
        if (!traj || !traj.trajectory || !traj.trajectory.length) return '';

        var days = traj.trajectory;
        var maxScore = Math.max.apply(null, days.map(function (d) { return d.totalScore; })) || 100;
        maxScore = Math.max(maxScore, 30);

        var LEVEL_COLORS = {
            normal:   '#22c55e',
            caution:  '#f59e0b',
            warning:  '#f97316',
            critical: '#ef4444',
            failure:  '#991b1b',
        };

        var barWidth = 'calc((100% - ' + (days.length - 1) * 3 + 'px) / ' + days.length + ')';

        var barsHtml = days.map(function (d, i) {
            var pct     = Math.round(d.totalScore / maxScore * 100);
            var color   = LEVEL_COLORS[d.level] || '#9ca3af';
            var dayDate = new Date(d.date + 'T12:00:00');
            var dayLabel = isNaN(dayDate.getTime()) ? d.date :
                dayDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
            var title = dayLabel + ': ' + d.totalScore + ' (' + (d.level || '') + ')';
            return '<div class="st-traj-bar" style="height:' + pct + '%;background:' + color + ';width:' + barWidth + '" title="' + esc(title) + '"></div>';
        }).join('');

        var labelsHtml = days.map(function (d) {
            var dayDate = new Date(d.date + 'T12:00:00');
            var label = isNaN(dayDate.getTime()) ? '' :
                dayDate.toLocaleDateString('en-AU', { weekday: 'short' });
            return '<div class="st-traj-label" style="width:' + barWidth + '">' + esc(label) + '</div>';
        }).join('');

        var legendItems = [
            { color: '#22c55e', label: 'Normal' },
            { color: '#f59e0b', label: 'Caution' },
            { color: '#f97316', label: 'Warning' },
            { color: '#ef4444', label: 'Critical' },
        ];
        var legendHtml = '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#6b7280">' +
            legendItems.map(function (l) {
                return '<span style="display:flex;align-items:center;gap:5px">' +
                    '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + l.color + '"></span>' + esc(l.label) +
                    '</span>';
            }).join('') + '</div>';

        var summary = traj.summary || {};
        var subText = 'Peak: ' + fmt(summary.peakScore, 0) +
            (summary.peakDate ? ' on ' + fmtDate(summary.peakDate) : '') +
            (summary.daysAboveWarning ? ' · ' + summary.daysAboveWarning + ' day' + (summary.daysAboveWarning !== 1 ? 's' : '') + ' at Warning+' : '');

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#6366f1"></div>' +
            '<div class="gl-block-title">14-Day Stress Trajectory ' + infoBtn('stress-trajectory') + '</div>' +
            '<div class="gl-block-sub">' + esc(subText) + '</div>' +
            '</div>' +
            '<div class="gl-block-body">' +
            '<div class="st-traj-grid" style="grid-template-columns:repeat(' + days.length + ',1fr)">' + barsHtml + '</div>' +
            '<div class="st-traj-labels" style="grid-template-columns:repeat(' + days.length + ',1fr)">' + labelsHtml + '</div>' +
            legendHtml +
            '</div></div>';
    }

    // =========================================================================
    // INTERVENTION WINDOWS
    // =========================================================================

    function renderInterventionWindows(traj) {
        var windows = traj && traj.summary && traj.summary.interventionWindows;
        if (!Array.isArray(windows) || !windows.length) return '';

        var windowsHtml = windows.map(function (w) {
            var startFmt = fmtDate(w.start);
            var endFmt   = fmtDate(w.end);
            return '<div class="st-window">' +
                '<div class="st-window-dot"></div>' +
                '<div>' +
                '<div class="st-window-text">' + esc(startFmt) + (endFmt !== startFmt ? ' → ' + endFmt : '') + '</div>' +
                '<div class="st-window-sub">' + (w.days || 1) + ' day' + (w.days !== 1 ? 's' : '') + ' — suitable for aeration, verticutting, topdressing</div>' +
                '</div></div>';
        }).join('');

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#15803d"></div>' +
            '<div class="gl-block-title">Intervention Windows ' + infoBtn('stress-intervention') + '</div>' +
            '<div class="gl-block-sub">Low-stress periods — best times for maintenance operations</div>' +
            '</div>' +
            '<div class="gl-block-body">' + windowsHtml + '</div>' +
            '</div>';
    }

    // =========================================================================
    // COMPONENT BREAKDOWN (from trajectory day 0)
    // =========================================================================

    function renderComponentBreakdown(traj) {
        var day0 = traj && traj.trajectory && traj.trajectory[0];
        if (!day0 || !day0.components) return '';

        var comps = day0.components;
        var keys = ['thermal', 'light', 'moisture', 'traffic', 'nutrition', 'biotic'];

        var rowsHtml = keys.map(function (key) {
            var meta  = FACTOR_META[key];
            var score = comps[key] || 0;
            var color = score >= 66 ? '#ef4444' : score >= 51 ? '#f97316' : score >= 31 ? '#f59e0b' : '#22c55e';
            return '<div class="st-component-row">' +
                '<div class="st-component-name">' + esc(meta.label) + '</div>' +
                '<div style="font-size:11px;color:#9ca3af;min-width:30px;text-align:right">' + meta.weight + '%</div>' +
                '<div class="st-component-track"><div class="st-component-fill" style="width:' + Math.min(score, 100) + '%;background:' + color + '"></div></div>' +
                '<div class="st-component-val" style="color:' + color + '">' + score + '</div>' +
                '</div>';
        }).join('');

        return '<div class="gl-block">' +
            '<div class="gl-block-header">' +
            '<div class="gl-block-accent" style="background:#6b7280"></div>' +
            '<div class="gl-block-title">Component Breakdown</div>' +
            '<div class="gl-block-sub">Weighted contribution to today\'s ESI score</div>' +
            '</div>' +
            '<div class="gl-block-body">' + rowsHtml + '</div>' +
            '</div>';
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
        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) { e.stopPropagation(); showPopover(icon); return; }
            if (!popover.contains(e.target)) hidePopover();
        });
        var closeBtn = document.getElementById('db-info-popover-close');
        if (closeBtn) closeBtn.addEventListener('click', hidePopover);
    }

    // =========================================================================
    // EMPTY STATE
    // =========================================================================

    function renderEmpty(container) {
        container.innerHTML =
            '<div class="wb-page"><div class="gl-page-header">' +
            '<div class="gl-page-title">Stress Index</div>' +
            '</div>' +
            '<div class="gl-body">' +
            '<div style="padding:40px 20px;text-align:center;color:#5b6a65">' +
            '<div style="font-size:15px;font-weight:600;color:#374151;margin-bottom:8px">No stress data yet</div>' +
            '<div style="font-size:13px;line-height:1.6;max-width:380px;margin:0 auto">Run the analysis to compute the Environmental Stress Index from climate, shade, moisture, traffic, nutrition, and disease data.</div>' +
            '</div></div></div>';
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function render() {
        var container = document.getElementById('stress-page-content');
        if (!container) return;

        var data   = global.GAIP_DASHBOARD_DATA;
        var stress = data && data.computed && data.computed.stress;
        var traj   = data && data.computed && data.computed.stressTrajectory;

        injectStyles();

        if (!stress && !traj) { renderEmpty(container); return; }

        initInfoPopovers();

        container.innerHTML =
            '<div class="wb-page">' +
            renderVerdict(stress, traj) +
            '<div class="gl-body">' +
            renderFactorCards(stress, traj) +
            renderCompound(stress, traj) +
            renderTrajectory(traj) +
            renderInterventionWindows(traj) +
            renderComponentBreakdown(traj) +
            '</div></div>';
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_StressAnalysis = {
        init: function () { render(); }
    };

}(typeof window !== 'undefined' ? window : this));
