/* plan-ui.js — Plan page data rendering
 * Reads from window.GAIP_DASHBOARD_DATA.computed (analysis cache)
 * and window.GAIP_SITE_CONFIG (full gaip config)
 * No external engine dependencies — all rendering is self-contained.
 */
(function (global) {
    'use strict';

    // ── Glossary entries for ⓘ icons ──────────────────────────────────────────

    global.GAIP_GLOSSARY = Object.assign(global.GAIP_GLOSSARY || {}, {
        'pre-emergent': {
            title: 'Pre-emergent Timing',
            body:  'Pre-emergent herbicides must be applied BEFORE weed seeds germinate. Germination is triggered by soil temperature reaching a species-specific threshold (e.g. 10°C for Annual Poa). Apply at the right window — too early and the residual activity runs out before peak pressure; too late and seedlings are already established.'
        },
        'pgr-schedule': {
            title: 'PGR Reapplication Schedule',
            body:  'Plant Growth Regulators (PGRs) suppress grass growth using Growing Degree Days (GDD) — accumulated heat units from the application date. Reapplication is due at 75% of the product-specific GDD threshold (the "window"), before suppression rebounds. Waiting past 100% GDD risks a growth surge.'
        },
        'pgr-gdd': {
            title: 'Growing Degree Days (GDD)',
            body:  'GDD = Σ max(0, (Tmax + Tmin) / 2 − BaseTemp) per day since application. C3 grasses use base 0°C; C4 use 10°C. GDD measures how much heat the turf has accumulated — a proxy for how far through the PGR suppression curve you are.'
        },
        'pgr-suppression': {
            title: 'Suppression %',
            body:  'Estimated reduction in clipping yield (growth rate) relative to untreated turf. Follows a sinewave decay curve — suppression peaks around 40–60% GDD, then declines as the product degrades. Values above 20% represent meaningful growth control.'
        },
        'recovery-calendar': {
            title: 'Recovery Calendar',
            body:  'Shows how quickly the turf can recover from traffic stress, and identifies safe windows for maintenance (aeration, topdressing, verticutting). Recovery window is adjusted by Growth Potential, variety wear-resistance score, soil OM, and shade/stress factors.'
        },
        'compaction-risk': {
            title: 'Compaction Risk',
            body:  'Risk of soil compaction based on effective traffic load relative to the soil\'s maximum hourly capacity (determined by construction type: USGA, sand-based, loam, etc.). High compaction risk accelerates surface degradation and reduces infiltration.'
        },
        'wear-resistance': {
            title: 'Wear Resistance Score',
            body:  'Composite 0–10 rating for how well the current turf can withstand traffic. Calculated from variety NTEP rating modified by mowing height (HOC), growth rate, shade, and overseed percentage. Higher = more durable.'
        },
        'nutrition-program': {
            title: 'Nutrition Program',
            body:  'Annual fertiliser programme distributed across 12 months. Nitrogen is weighted by monthly Growth Potential (GP) — high-GP months receive more N to match plant demand. Other nutrients (P, K, Ca, Mg, S) are calculated as ratios of the N requirement based on MLSN/SLAN targets.'
        },
        'annual-n-target': {
            title: 'Annual N Target',
            body:  'Total kg of nitrogen per hectare per year. Typical ranges:\n• Fine turf (greens/bowls): 80–150 kg N/ha\n• Tees / pitches: 120–180 kg N/ha\n• Sports pitches: 180–350 kg N/ha\n• Lawns: 60–120 kg N/ha'
        },
        'max-n-app': {
            title: 'Max N per Application',
            body:  'Upper limit of nitrogen that can be safely applied in a single application without risk of burn, flush growth, or disease pressure. Typical limits: liquid 2–5 kg N/ha; granular 10–20 kg N/ha; slow-release up to 30 kg N/ha.'
        },
        'seasonal-n': {
            title: 'Seasonal N Plan',
            body:  'Quarterly N requirement based on current Growth Potential, C3/C4 species blend, and N diagnostics from the last soil test. Complements the Nutrition Program — the Program sets the annual budget, the Seasonal Plan shows how demand varies by quarter given current climate conditions.'
        }
    });

    // ── Utilities ─────────────────────────────────────────────────────────────

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var SEASONS_S = [
        { name: 'Summer', months: 'Dec–Feb', monthRange: [11,0,1],  avgTemp: 25 },
        { name: 'Autumn', months: 'Mar–May', monthRange: [2,3,4],   avgTemp: 18 },
        { name: 'Winter', months: 'Jun–Aug', monthRange: [5,6,7],   avgTemp: 10 },
        { name: 'Spring', months: 'Sep–Nov', monthRange: [8,9,10],  avgTemp: 18 }
    ];
    var SEASONS_N = [
        { name: 'Winter', months: 'Dec–Feb', monthRange: [11,0,1],  avgTemp:  5 },
        { name: 'Spring', months: 'Mar–May', monthRange: [2,3,4],   avgTemp: 15 },
        { name: 'Summer', months: 'Jun–Aug', monthRange: [5,6,7],   avgTemp: 25 },
        { name: 'Autumn', months: 'Sep–Nov', monthRange: [8,9,10],  avgTemp: 15 }
    ];

    function safeNum(v, fallback) {
        var n = parseFloat(v);
        return isFinite(n) ? n : (fallback || 0);
    }

    function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Growth potential for a given temperature (C3 species, Gaussian)
    function gpC3(temp) {
        var t = safeNum(temp, 15);
        return Math.round(Math.exp(-0.5 * Math.pow((t - 20) / 5.5, 2)) * 100);
    }

    function gpC4(temp) {
        var t = safeNum(temp, 25);
        return Math.round(Math.exp(-0.5 * Math.pow((t - 31) / 7, 2)) * 100);
    }

    function nowMonth() { return new Date().getMonth(); }

    // ── Badge / status helpers ────────────────────────────────────────────────

    var PE_STATUS_MAP = {
        'GREEN':               { cls: 'green', label: 'Monitor',    dot: 'green' },
        'AMBER':               { cls: 'amber', label: 'Upcoming',   dot: 'amber' },
        'RED_EARLY':           { cls: 'red',   label: 'Apply Now',  dot: 'red'   },
        'RED_MISSED':          { cls: 'red',   label: 'Missed',     dot: 'red'   },
        'PERSISTENT_PRESSURE': { cls: 'red',   label: 'Active',     dot: 'red'   },
        'ADVISORY_ONLY':       { cls: 'grey',  label: 'Advisory',   dot: 'grey'  }
    };

    var PGR_STATUS_MAP = {
        'recently_applied': { cls: 'green', label: 'Recently Applied' },
        'active':           { cls: 'green', label: 'Active'           },
        'approaching':      { cls: 'amber', label: 'Approaching Window' },
        'due':              { cls: 'red',   label: 'Reapply Now'      },
        'expired':          { cls: 'red',   label: 'Window Expired'   }
    };

    function makeBadge(cls, label) {
        return '<span class="plan-badge ' + cls + '">' + esc(label) + '</span>';
    }

    // ── Empty state HTML ──────────────────────────────────────────────────────

    var EMPTY_ICONS = {
        'pre-emergent': '<svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/></svg>',
        'pgr':          '<svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M9 9h1.5a1.5 1.5 0 010 3H9m0 3h4"/></svg>',
        'recovery':     '<svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        'nutrition':    '<svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    };

    function emptyState(iconKey, title, body, steps) {
        var stepsHtml = '';
        if (steps && steps.length) {
            stepsHtml = '<ul class="plan-empty-steps">' +
                steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
                '</ul>';
        }
        var iconHtml = EMPTY_ICONS[iconKey] || EMPTY_ICONS['nutrition'];
        return '<div class="plan-empty">' +
            '<div class="plan-empty-icon" style="color:#c8d5cf">' + iconHtml + '</div>' +
            '<div class="plan-empty-title">' + esc(title) + '</div>' +
            '<div class="plan-empty-body">' + body + stepsHtml + '</div>' +
            '</div>';
    }

    // ── SECTION: Pre-emergent ─────────────────────────────────────────────────

    function renderPreEmergent(computed) {
        var body   = document.getElementById('plan-pe-body');
        var badge  = document.getElementById('plan-pe-badge');
        if (!body) return;

        var pe = computed && computed.preEmergent;

        if (!pe || !pe.success || !pe.results || !pe.results.length) {
            body.innerHTML = emptyState('pre-emergent', 'No pre-emergent data',
                'Pre-emergent timing calculates automatically when analysis is run.',
                ['Run the Hub analysis to generate pre-emergent timing recommendations.']
            );
            return;
        }

        var summary = pe.summary || {};
        var results = pe.results.slice().sort(function (a, b) {
            var order = { RED_MISSED: 0, RED_EARLY: 1, PERSISTENT_PRESSURE: 2, AMBER: 3, ADVISORY_ONLY: 4, GREEN: 5 };
            return (order[a.alertStatus] || 5) - (order[b.alertStatus] || 5);
        });

        // Aggregate badge
        var aggMap = { GREEN: 'green', AMBER: 'amber', RED_EARLY: 'red', RED_MISSED: 'red', PERSISTENT_PRESSURE: 'red' };
        var aggCls = aggMap[pe.aggregateStatus] || 'green';
        var aggCount = summary.activeAlerts || 0;
        var aggLabel = aggCount > 0 ? aggCount + ' alert' + (aggCount > 1 ? 's' : '') : 'All clear';
        badge.className = 'plan-badge ' + aggCls;
        badge.textContent = aggLabel;
        badge.style.display = '';

        // Species cards
        var speciesHtml = results.map(function (r) {
            var st = PE_STATUS_MAP[r.alertStatus] || PE_STATUS_MAP['GREEN'];
            var daysText = '';
            if (r.alertStatus === 'GREEN' && r.daysToThreshold != null) {
                daysText = r.daysToThreshold + 'd to window';
            } else if (r.alertStatus === 'AMBER' && r.daysToThreshold != null) {
                daysText = 'Window in ~' + r.daysToThreshold + ' days';
            } else if (r.alertStatus === 'RED_EARLY') {
                daysText = 'Apply within ' + (r.daysToThreshold || 1) + ' day' + (r.daysToThreshold > 1 ? 's' : '');
            } else if (r.alertStatus === 'RED_MISSED') {
                daysText = 'Window passed';
            } else if (r.alertStatus === 'PERSISTENT_PRESSURE') {
                daysText = 'Ongoing pressure';
            } else if (r.alertStatus === 'ADVISORY_ONLY') {
                daysText = 'Advisory only';
            }

            var tempText = '';
            if (r.soilTemp5cm != null && r.germinationThreshold != null) {
                tempText = 'Soil: ' + safeNum(r.soilTemp5cm, 0).toFixed(1) + '°C · Threshold: ' + r.germinationThreshold + '°C';
            }

            var conf = r.confidenceRating ? ' <span style="opacity:0.6;font-size:10px">Confidence: ' + r.confidenceRating + '</span>' : '';

            return '<div class="plan-pe-species ' + st.cls + '">' +
                '<div class="plan-pe-dot ' + st.dot + '"></div>' +
                '<div style="flex:1;min-width:0">' +
                '<div class="plan-pe-name">' + esc(r.commonName || r.scientificName) + '</div>' +
                '<div class="plan-pe-sci">' + esc(r.scientificName) + '</div>' +
                (tempText ? '<div class="plan-pe-temp">' + esc(tempText) + '</div>' : '') +
                (daysText ? '<div class="plan-pe-temp" style="font-weight:600;color:inherit">' + esc(daysText) + '</div>' : '') +
                (r.recommendedAction ? '<div class="plan-pe-action">' + esc(r.recommendedAction) + conf + '</div>' : '') +
                '</div>' +
                '</div>';
        }).join('');

        // Footer with soil temp + trend
        var trendArrow = summary.trendDirection === 'warming' ? '↑ Warming' :
                         summary.trendDirection === 'cooling' ? '↓ Cooling' : '→ Stable';
        var footerHtml = '<div class="plan-pe-footer">' +
            '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 3v9.5M8.5 12a4 4 0 105 0"/></svg>' +
            'Soil temp: ' + (summary.soilTemp5cm != null ? safeNum(summary.soilTemp5cm,0).toFixed(1) + '°C' : '—') +
            ' · ' + trendArrow +
            (summary.region ? ' · Region: ' + esc(summary.region) : '') +
            '</div>';

        body.innerHTML = '<div class="plan-pe-list">' + speciesHtml + '</div>' + footerHtml;
    }

    // ── PGR INPUT FORM ───────────────────────────────────────────────────────

    var PGR_PRODUCTS = [
        { value:'TE250',  label:'TE 250g/L (Primo)',              group:'Trinexapac-ethyl' },
        { value:'TE175',  label:'TE 175g/L (Amigo 175 / Marvel)', group:'Trinexapac-ethyl' },
        { value:'TE120',  label:'TE 120g/L (Primo Maxx 120)',     group:'Trinexapac-ethyl' },
        { value:'PBZ200', label:'Paclobutrazol 200g/L',           group:'Paclobutrazol' },
        { value:'PBZ250', label:'Paclobutrazol 250g/L',           group:'Paclobutrazol' },
        { value:'ETH',    label:'Ethephon 480g/L',                group:'Ethephon' },
    ];

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

    function renderPgrInputForm(saved, compact) {
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
            opts += '<optgroup label="' + esc(g) + '">';
            groups[g].forEach(function(p) {
                opts += '<option value="' + esc(p.value) + '"' + (p.value === product ? ' selected' : '') + '>' + esc(p.label) + '</option>';
            });
            opts += '</optgroup>';
        });

        var inputStyle = 'padding:7px 10px;border:1px solid var(--gaip-border);border-radius:var(--gaip-radius-sm);background:var(--gaip-surface);color:var(--gaip-text);font-size:13px;font-family:var(--gaip-font);width:100%;box-sizing:border-box';

        return '<div id="plan-pgr-input" style="' + (compact ? 'margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--gaip-border-light)' : '') + '">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:' + (enabled ? '10px' : '0') + '">' +
            '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--gaip-text)">' +
            '<input type="checkbox" id="plan-pgr-enable-cb"' + (enabled ? ' checked' : '') + ' style="width:15px;height:15px;cursor:pointer">' +
            'PGR Applied</label></div>' +
            '<div id="plan-pgr-fields" style="display:' + (enabled ? 'grid' : 'none') + ';grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
            '<div><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-muted);display:block;margin-bottom:4px">Product</label>' +
            '<select id="plan-pgr-product-sel" style="' + inputStyle + '">' + opts + '</select></div>' +
            '<div><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-muted);display:block;margin-bottom:4px">Rate (L/ha)</label>' +
            '<input type="number" id="plan-pgr-rate-inp" step="0.1" min="0" placeholder="e.g. 0.4" value="' + esc(rate) + '" style="' + inputStyle + '"></div>' +
            '<div style="grid-column:1/-1"><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gaip-text-muted);display:block;margin-bottom:4px">Last application date</label>' +
            '<input type="date" id="plan-pgr-date-inp" value="' + esc(date) + '" style="' + inputStyle + '"></div>' +
            '</div>' +
            '<button id="plan-pgr-save-btn" style="width:100%;padding:9px 20px;border-radius:var(--gaip-radius-pill);border:none;background:var(--gaip-accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Save &amp; Re-run Analysis</button>' +
            '<div id="plan-pgr-save-msg" style="display:none;margin-top:6px;font-size:12px;color:var(--gaip-text-muted);text-align:center"></div>' +
            '</div>';
    }

    function initPgrInputForm() {
        var cb      = document.getElementById('plan-pgr-enable-cb');
        var fields  = document.getElementById('plan-pgr-fields');
        var saveBtn = document.getElementById('plan-pgr-save-btn');
        var msg     = document.getElementById('plan-pgr-save-msg');
        if (!cb || !saveBtn) return;

        cb.addEventListener('change', function() {
            fields.style.display = cb.checked ? 'grid' : 'none';
        });

        saveBtn.addEventListener('click', function() {
            var enabled = cb.checked;
            var pgr = {
                enabled:         enabled,
                productType:     enabled ? ((document.getElementById('plan-pgr-product-sel') || {}).value || '') : '',
                applicationDate: enabled ? ((document.getElementById('plan-pgr-date-inp') || {}).value || '') : null,
                rateLperHa:      enabled ? ((document.getElementById('plan-pgr-rate-inp') || {}).value || '') : null,
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
            if (rerunBtn) rerunBtn.click();
            else setTimeout(function() { global.location.reload(); }, 3000);
        });
    }

    // ── SECTION: PGR ─────────────────────────────────────────────────────────

    function renderPGR(computed) {
        var body  = document.getElementById('plan-pgr-body');
        var badge = document.getElementById('plan-pgr-badge');
        if (!body) return;

        var pgr = computed && computed.pgr;

        if (!pgr || !pgr.success) {
            var saved = readSavedPgr();
            var hasPartial = saved && saved.productType;
            body.innerHTML =
                '<div style="padding:10px 0 6px">' +
                '<div style="font-size:13px;color:var(--gaip-text-secondary);margin-bottom:14px;line-height:1.5">' +
                (hasPartial
                    ? 'Last saved: <strong>' + esc(saved.productType) + '</strong>' + (saved.applicationDate ? ' applied ' + esc(saved.applicationDate) : '') + '. Re-run analysis to update the schedule.'
                    : 'Enter your last PGR application to track GDD accumulation and get a reapplication forecast.') +
                '</div>' +
                renderPgrInputForm(saved, false) +
                '</div>';
            initPgrInputForm();
            return;
        }

        var gdd    = pgr.gdd    || {};
        var effect = pgr.effect || {};
        var prod   = pgr.product || {};
        var inp    = pgr.inputs  || {};

        var statusKey = effect.reapplicationStatus || 'active';
        var statusInfo = PGR_STATUS_MAP[statusKey] || PGR_STATUS_MAP['active'];

        badge.className = 'plan-badge ' + statusInfo.cls;
        badge.textContent = statusInfo.label;
        badge.style.display = '';

        // GDD progress
        var progress  = clamp(safeNum(gdd.progress, 0) * 100, 0, 100);
        var remaining = safeNum(gdd.remaining, 0);
        var thresh    = safeNum(gdd.threshold, 0);
        var accum     = safeNum(gdd.accumulated, 0);

        var barColor = progress >= 75 ? 'var(--gaip-critical)' :
                       progress >= 60 ? 'var(--gaip-warning)'  : 'var(--gaip-accent)';

        var suppression = safeNum(effect.suppression, 0);
        var adjSupp     = safeNum(effect.adjustedSuppression || suppression, 0);
        var hasAdj      = (effect.adjustedSuppression != null) && (Math.abs(adjSupp - suppression) > 0.5);

        // Application date display
        var appDate = inp.applicationDate || pgr.applicationDate || '';
        var appDateFmt = appDate ? appDate : '—';

        // Days estimate to reapplication
        var dailyGDD    = gdd.dailyGDDRate || gdd.avgDailyGDD || null;
        var daysToWin   = (dailyGDD && remaining > 0) ? Math.ceil(remaining / dailyGDD) : null;
        var reapplyText = daysToWin != null ? '~' + daysToWin + ' day' + (daysToWin !== 1 ? 's' : '') : '—';

        // Phase label
        var phaseLabels = {
            onset: 'Building', peak: 'Peak suppression', declining: 'Declining',
            rebound: 'Rebound phase', expired: 'Expired'
        };
        var phaseLabel = phaseLabels[effect.phase] || effect.phase || '—';

        var html = '';

        // Source line
        if (prod.name || inp.productType) {
            html += '<div class="plan-pgr-source">' +
                esc(prod.name || inp.productType || '—') +
                (prod.activeIngredient ? ' <span style="opacity:0.7">(' + esc(prod.activeIngredient) + ')</span>' : '') +
                (appDate ? ' · Applied ' + esc(appDateFmt) : '') +
                (inp.rateLperHa ? ' · ' + esc(inp.rateLperHa) + ' L/ha' : '') +
                '</div>';
        }

        // Metrics row
        html += '<div class="plan-metrics-row">' +
            '<div class="plan-metric">' +
            '<div class="plan-metric-value' + (progress >= 75 ? ' bad' : progress >= 60 ? ' warning' : '') + '">' + Math.round(progress) + '%</div>' +
            '<div class="plan-metric-label">GDD Progress</div>' +
            '<div class="plan-metric-sub">' + Math.round(accum) + ' / ' + Math.round(thresh) + ' GDD</div>' +
            '</div>' +
            '<div class="plan-metric">' +
            '<div class="plan-metric-value">' + Math.round(suppression) + '%' + (hasAdj ? '<span style="font-size:12px;opacity:0.6"> (' + Math.round(adjSupp) + '%)</span>' : '') + '</div>' +
            '<div class="plan-metric-label">Suppression' + (hasAdj ? ' <span class="db-info-icon" data-info="pgr-suppression" tabindex="0" role="button" style="font-size:9px">i</span>' : '') + '</div>' +
            '<div class="plan-metric-sub">' + esc(phaseLabel) + '</div>' +
            '</div>' +
            '<div class="plan-metric">' +
            '<div class="plan-metric-value' + (statusKey === 'due' || statusKey === 'expired' ? ' bad' : statusKey === 'approaching' ? ' warning' : '') + '">' + reapplyText + '</div>' +
            '<div class="plan-metric-label">To Reapply Window <span class="db-info-icon" data-info="pgr-gdd" tabindex="0" role="button" style="font-size:9px">i</span></div>' +
            '<div class="plan-metric-sub">' + Math.round(remaining) + ' GDD remaining</div>' +
            '</div>' +
            '</div>';

        // GDD progress bar with 75% tick
        html += '<div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gaip-text-muted);margin-bottom:3px">' +
            '<span>0 GDD</span>' +
            '<span style="font-weight:700;color:var(--gaip-text-muted)">Reapply window (75%)</span>' +
            '<span>' + Math.round(thresh) + ' GDD</span>' +
            '</div>' +
            '<div class="plan-gdd-bar-wrap">' +
            '<div class="plan-gdd-bar-fill" style="width:' + progress + '%;background:' + barColor + '"></div>' +
            '<div class="plan-gdd-bar-tick" style="left:75%">' +
            '<div class="plan-gdd-bar-tick-label">75%</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        // Reapplication callout
        var calloutCls = statusKey === 'due' || statusKey === 'expired' ? 'red' :
                         statusKey === 'approaching' ? 'amber' : 'green';
        html += '<div class="plan-pgr-reapply ' + calloutCls + '">' +
            '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
            (statusKey === 'due' || statusKey === 'expired'
                ? 'Reapplication window reached — apply now'
                : statusKey === 'approaching'
                    ? 'Approaching window · ' + reapplyText + ' remaining' + (dailyGDD ? ' (' + safeNum(dailyGDD,0).toFixed(1) + ' GDD/day)' : '')
                    : 'Active — next window in ' + reapplyText) +
            '</div>';

        // DMI combined suppression warning
        var combined = global.GAIP_COMBINED_SUPPRESSION;
        if (!combined && computed && computed.pgr && computed.pgr.dmi) {
            combined = computed.pgr.dmi;
        }
        if (combined && combined.combinedSuppressionPct >= 70) {
            html += '<div style="margin-top:10px;padding:8px 12px;background:var(--gaip-critical-bg);border:1px solid var(--gaip-critical-border);border-radius:var(--gaip-radius-sm);font-size:11px;color:var(--gaip-critical);font-weight:600">' +
                'Combined PGR + DMI suppression: ' + Math.round(combined.combinedSuppressionPct) + '% — monitor for phytotoxicity' +
                '</div>';
        }

        body.innerHTML = renderPgrInputForm(readSavedPgr(), true) + html;
        initPgrInputForm();
    }

    // ── SECTION: Recovery Calendar ────────────────────────────────────────────

    function renderRecovery(computed, siteConfig) {
        var body = document.getElementById('plan-rec-body');
        var settingsLink = document.getElementById('plan-rec-settings-link');
        if (!body) return;

        var wear = computed && computed.wear;
        var turf = siteConfig && siteConfig.turf;
        var matchesPerWeek = safeNum(turf && (turf.matchesPerWeek || turf.matches_per_week || turf.matchesWeek), 0);
        var sessionsPerWeek = safeNum(turf && (turf.sessionsPerWeek || turf.sessions_per_week || turf.sessionsWeek), 0);

        if (!wear && !matchesPerWeek && !sessionsPerWeek) {
            body.innerHTML = emptyState('recovery', 'No traffic data configured',
                'Recovery windows calculate from match and training schedule.',
                [
                    'Enter weekly matches and sessions in <a href="/settings">Site Profile → Settings</a>',
                    'LOI / OM soil test improves the estimate (optional)'
                ]
            );
            return;
        }

        if (settingsLink) settingsLink.hidden = false;

        var html = '';

        // Key metrics
        if (wear) {
            var compRisk  = wear.compactionRisk || {};
            var wearRes   = wear.wearResistance || {};
            var recov     = wear.recoveryCapacity || {};
            var riskPct   = safeNum(compRisk.riskPercent, 0);
            var riskLabel = riskPct >= 70 ? 'High' : riskPct >= 40 ? 'Moderate' : 'Low';
            var riskCls   = riskPct >= 70 ? 'bad' : riskPct >= 40 ? 'warning' : 'good';
            var wearScore = safeNum(wearRes.score, 0);
            var wearLabel = wearScore >= 8.5 ? 'Excellent' : wearScore >= 7 ? 'Good' : wearScore >= 5.5 ? 'Moderate' : wearScore >= 4 ? 'Poor' : 'Very Poor';
            var wearCls   = wearScore >= 7 ? 'good' : wearScore >= 5.5 ? 'warning' : 'bad';
            var recovDays = safeNum(recov.days || wear.recoveryWindow, 0);
            var recovProb = safeNum(wear.recoveryProbability, 0);
            var aerWks    = wear.aerationSchedule && wear.aerationSchedule.recommendedWeeks;

            html += '<div class="plan-rec-metrics">' +
                '<div class="plan-metric">' +
                '<div class="plan-metric-value ' + riskCls + '">' + Math.round(riskPct) + '%</div>' +
                '<div class="plan-metric-label">Compaction Risk <span class="db-info-icon" data-info="compaction-risk" tabindex="0" role="button" style="font-size:9px">i</span></div>' +
                '<div class="plan-metric-sub">' + esc(riskLabel) + (compRisk.maxHours ? ' · Max ' + compRisk.maxHours + ' hrs/wk' : '') + '</div>' +
                '</div>' +
                '<div class="plan-metric">' +
                '<div class="plan-metric-value ' + wearCls + '">' + wearScore.toFixed(1) + ' / 10</div>' +
                '<div class="plan-metric-label">Wear Resistance <span class="db-info-icon" data-info="wear-resistance" tabindex="0" role="button" style="font-size:9px">i</span></div>' +
                '<div class="plan-metric-sub">' + esc(wearLabel) + '</div>' +
                '</div>' +
                '<div class="plan-metric">' +
                '<div class="plan-metric-value">' + (recovDays > 0 ? recovDays + 'd' : '—') + '</div>' +
                '<div class="plan-metric-label">Recovery Window</div>' +
                '<div class="plan-metric-sub">' + (recovProb > 0 ? recovProb + '% probability' : '') + (aerWks ? ' · Aerate every ' + aerWks + 'wk' : '') + '</div>' +
                '</div>' +
                '</div>';

            // Effective load table
            var loadBreakdown = (wear.effectiveLoad && wear.effectiveLoad.breakdown) || [];
            var totalLoad = wear.effectiveLoad && wear.effectiveLoad.totalEffectiveHours;
            if (loadBreakdown.length) {
                html += '<table class="plan-load-table">' +
                    '<thead><tr><th>Activity</th><th>Raw hrs</th><th>Factor</th><th>Effective</th></tr></thead><tbody>' +
                    loadBreakdown.map(function (b) {
                        var factor = safeNum(b.factor, 1);
                        if (b.rotationFactor) factor = (factor * safeNum(b.rotationFactor, 1));
                        return '<tr><td>' + esc(b.name) + '</td><td>' + safeNum(b.rawHours,0).toFixed(1) + '</td><td>' + factor.toFixed(2) + '</td><td>' + safeNum(b.effectiveHours,0).toFixed(1) + '</td></tr>';
                    }).join('') +
                    (totalLoad != null ? '<tr><td colspan="3">Total effective load</td><td>' + safeNum(totalLoad,0).toFixed(1) + ' hrs/wk</td></tr>' : '') +
                    '</tbody></table>';
            }

            // Stress factors
            var adj = wear.adjustedRecovery;
            if (adj && adj.adjustments && adj.adjustments.length) {
                var icons = { shade: '—', salinity: '—', temperature: '—', compound: '—' };
                html += '<div class="plan-stress-factors">' +
                    '<div class="plan-stress-title">Stress Factors Affecting Recovery</div>' +
                    adj.adjustments.map(function (a) {
                        return '<div class="plan-stress-item">' +
                            (icons[a.factor] || '•') + ' ' + esc(a.modification || a.factor) +
                            '<span class="plan-stress-effect">' + esc(a.effect) + '</span>' +
                            '</div>';
                    }).join('') +
                    (adj.baseProbability && adj.adjustedProbability
                        ? '<div style="font-size:11px;margin-top:6px;color:var(--gaip-text-muted)">Recovery probability: ' + adj.baseProbability + '% → ' + adj.adjustedProbability + '%</div>'
                        : '') +
                    '</div>';
            }
        }

        // 4-week traffic grid
        var matches  = Math.round(matchesPerWeek)  || (wear && wear.effectiveLoad && wear.effectiveLoad.breakdown
            ? wear.effectiveLoad.breakdown.filter(function(b){ return /match/i.test(b.name); }).length : 0);
        var sessions = Math.round(sessionsPerWeek) || 0;

        if (matches > 0 || sessions > 0) {
            html += '<div style="font-size:12px;font-weight:700;color:var(--gaip-text);margin:14px 0 8px">4-Week Traffic Schedule</div>';
            html += '<div style="font-size:11px;color:var(--gaip-text-muted);margin-bottom:10px">' + matches + ' match' + (matches !== 1 ? 'es' : '') + ' · ' + sessions + ' training session' + (sessions !== 1 ? 's' : '') + ' per week</div>';

            // Build match/training day patterns
            var matchDays = [], trainingDays = [];
            var matchPatterns = { 7:[0,1,2,3,4,5,6], 6:[0,1,2,3,4,5], 5:[0,1,2,4,6], 4:[0,2,4,6], 3:[0,3,5], 2:[0,3], 1:[0] };
            matchDays = (matchPatterns[matches] || []).slice(0, matches);
            if (sessions > 0) {
                var restDays = [0,1,2,3,4,5,6].filter(function (d) { return matchDays.indexOf(d) === -1; });
                trainingDays = restDays.slice(0, sessions);
            }

            var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            html += '<div class="plan-traffic-grid">';
            html += '<div class="plan-traffic-header"></div>';
            dayNames.forEach(function (d) {
                html += '<div class="plan-traffic-header">' + d + '</div>';
            });

            for (var w = 0; w < 4; w++) {
                html += '<div class="plan-traffic-week-label">W' + (w + 1) + '</div>';
                for (var d = 0; d < 7; d++) {
                    var type = matchDays.indexOf(d) >= 0 ? 'match' :
                               trainingDays.indexOf(d) >= 0 ? 'training' : 'rest';
                    var cellLabel = type === 'match' ? 'M' : type === 'training' ? 'T' : '—';
                    html += '<div class="plan-traffic-cell ' + type + '">' + cellLabel + '</div>';
                }
            }
            html += '</div>';

            html += '<div class="plan-traffic-legend">' +
                '<span><div class="plan-traffic-legend-dot" style="background:#fca5a5"></div> Match</span>' +
                '<span><div class="plan-traffic-legend-dot" style="background:var(--gaip-warning-border)"></div> Training</span>' +
                '<span><div class="plan-traffic-legend-dot" style="background:var(--gaip-good-bg);border:1px solid var(--gaip-good-border)"></div> Rest</span>' +
                '</div>';
        } else if (!wear) {
            html += '<div style="font-size:12px;color:var(--gaip-text-muted);padding:10px 0">No traffic data — enter matches and training sessions in <a href="/settings" style="color:var(--gaip-accent)">Settings</a></div>';
        }

        // Maintenance windows
        if (wear) {
            var aer = wear.aerationSchedule || {};
            html += '<div style="font-size:12px;font-weight:700;color:var(--gaip-text);margin:14px 0 8px">Maintenance Windows</div>' +
                '<div class="plan-maint-list">' +
                '<div class="plan-maint-item"><div class="plan-maint-name">Aeration</div><div class="plan-maint-detail">Based on compaction risk and recovery window</div><div class="plan-maint-window">' + (aer.recommendedWeeks ? 'Every ' + aer.recommendedWeeks + ' weeks' : 'See recommendations') + '</div></div>' +
                '<div class="plan-maint-item"><div class="plan-maint-name">Topdressing</div><div class="plan-maint-detail">Schedule with aeration where possible</div><div class="plan-maint-window">With aeration</div></div>' +
                '<div class="plan-maint-item"><div class="plan-maint-name">Verticutting</div><div class="plan-maint-detail">Complete during high-GP periods for faster recovery</div><div class="plan-maint-window">High GP window</div></div>' +
                '</div>';

            // Recommendations
            var recs = wear.recommendations || [];
            if (recs.length) {
                html += '<div style="font-size:12px;font-weight:700;color:var(--gaip-text);margin:10px 0 6px">Recommendations</div>';
                html += recs.map(function (r) {
                    return '<div style="font-size:12px;color:var(--gaip-text-secondary);padding:5px 0;border-bottom:1px solid var(--gaip-border-light)">' +
                        esc(r.text || r) + (r.action ? ' <strong>→ ' + esc(r.action) + '</strong>' : '') + '</div>';
                }).join('');
            }

            // Wear resistance modifiers (collapsible)
            var mods = wearRes.modifiers || wearRes;
            if (mods && (mods.hoc || mods.growth || mods.shade)) {
                html += '<details class="plan-details"><summary>Wear Resistance Modifiers</summary>' +
                    '<div class="plan-modifiers-grid">';
                if (mods.hoc && mods.hoc.value != null) html += '<div><strong>Mowing height (HOC):</strong> ' + Math.round(mods.hoc.value * 100) + '%</div>';
                if (mods.growth != null) html += '<div><strong>Growth rate:</strong> ' + Math.round(mods.growth * 100) + '%</div>';
                if (mods.shade != null)  html += '<div><strong>Shade:</strong> ' + Math.round(mods.shade * 100) + '%</div>';
                if (mods.rootDepth != null) html += '<div><strong>Root depth:</strong> ' + Math.round(mods.rootDepth * 100) + '%</div>';
                if (mods.overseed && mods.overseed.value != null) html += '<div><strong>Overseed:</strong> ' + Math.round(mods.overseed.value * 100) + '%' + (mods.overseed.status ? ' (' + esc(mods.overseed.status) + ')' : '') + '</div>';
                html += '<div><strong>Base NTEP:</strong> ' + (wearRes.baseNTEP || wearScore).toFixed(1) + '</div>';
                html += '</div></details>';
            }
        }

        body.innerHTML = html || '<div class="plan-empty"><div class="plan-empty-title">No wear data available — run analysis first.</div></div>';
    }

    // ── SECTION: Nutrition Program ────────────────────────────────────────────

    // Default GP by month (temperate southern hemisphere, C3-dominant)
    var DEFAULT_GP_MONTHLY = [85,80,65,50,35,22,18,25,42,58,72,82];

    function getMonthlyGP(computed) {
        // Try to get from dualMetrics monthly GP values
        var dm = computed && computed.climate && computed.climate.dualMetrics;
        if (dm && dm.monthly && dm.monthly.length === 12) {
            return dm.monthly.map(function (m) { return safeNum(m.gp || m.weighted, 0); });
        }
        // Try to get from computed climate growth
        var cg = computed && computed.climate && computed.climate.growth;
        if (cg && cg.monthlyGP && cg.monthlyGP.length === 12) {
            return cg.monthlyGP.map(function (v) { return safeNum(v, 0); });
        }
        return DEFAULT_GP_MONTHLY;
    }

    function generateNutritionTable(annualN, maxN, distribution, clipping, gpMonthly) {
        // Clipping recycling: returned clippings provide ~20% N back
        var clippingFactor = clipping === 'returned' ? 0.80 : 1.0;
        var effectiveN = annualN * clippingFactor;

        // Monthly N distribution
        var gpTotal = gpMonthly.reduce(function (s, v) { return s + v; }, 0);
        var monthlyN = [];

        if (distribution === 'even') {
            monthlyN = gpMonthly.map(function () { return effectiveN / 12; });
        } else if (distribution === 'front') {
            // Front-loaded: double weight on spring/autumn (months 8-10, 2-4 SH)
            var weights = gpMonthly.map(function (gp, i) {
                var base = gp / gpTotal;
                var isShoulder = (i >= 8 && i <= 10) || (i >= 2 && i <= 4);
                return isShoulder ? base * 1.5 : base * 0.75;
            });
            var wTotal = weights.reduce(function (s, v) { return s + v; }, 0);
            monthlyN = weights.map(function (w) { return effectiveN * (w / wTotal); });
        } else {
            // GP-weighted
            monthlyN = gpMonthly.map(function (gp) { return effectiveN * (gp / Math.max(gpTotal, 1)); });
        }

        // Apply max N cap per month
        if (maxN > 0) {
            monthlyN = monthlyN.map(function (n) { return Math.min(n, maxN); });
        }

        // Nutrient ratios (MLSN-derived) as % of N
        var ratios = { P: 0.10, K: 0.55, Ca: 0.17, Mg: 0.08, S: 0.05 };

        var months = monthlyN.map(function (n, i) {
            var gp = gpMonthly[i];
            return {
                month: MONTHS[i],
                season: i >= 11 || i <= 1 ? 'Summer' : i <= 4 ? 'Autumn' : i <= 7 ? 'Winter' : 'Spring',
                gp: Math.round(gp),
                N:  Math.round(n * 10) / 10,
                P:  Math.round(n * ratios.P  * 10) / 10,
                K:  Math.round(n * ratios.K  * 10) / 10,
                Ca: Math.round(n * ratios.Ca * 10) / 10,
                Mg: Math.round(n * ratios.Mg * 10) / 10,
                S:  Math.round(n * ratios.S  * 10) / 10
            };
        });

        var totals = { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 };
        months.forEach(function (m) {
            totals.N  += m.N;  totals.P  += m.P;
            totals.K  += m.K;  totals.Ca += m.Ca;
            totals.Mg += m.Mg; totals.S  += m.S;
        });
        Object.keys(totals).forEach(function (k) { totals[k] = Math.round(totals[k] * 10) / 10; });

        return { months: months, totals: totals, clippingFactor: clippingFactor };
    }

    function renderNutritionResults(result, annualN, distribution, clipping, species, methodology) {
        var container = document.getElementById('plan-nut-results');
        var divider   = document.getElementById('plan-nut-divider');
        var csvBtn    = document.getElementById('plan-nut-csv-btn');
        if (!container) return;

        var months  = result.months;
        var totals  = result.totals;
        var curMo   = nowMonth();

        var distLabel = { gp: 'GP-Weighted', even: 'Even distribution', front: 'Front-loaded' }[distribution] || distribution;
        var clipLabel = clipping === 'returned' ? 'Returned (mulched)' : 'Collected';

        var html = '';

        // Summary bar
        html += '<div class="plan-nutrition-summary">' +
            '<div class="plan-nutrition-summary-item"><div class="plan-nutrition-summary-key">Species</div><div class="plan-nutrition-summary-val">' + esc(species || '—') + '</div></div>' +
            '<div class="plan-nutrition-summary-item"><div class="plan-nutrition-summary-key">Methodology</div><div class="plan-nutrition-summary-val">' + esc(methodology || '—') + '</div></div>' +
            '<div class="plan-nutrition-summary-item"><div class="plan-nutrition-summary-key">Distribution</div><div class="plan-nutrition-summary-val">' + esc(distLabel) + '</div></div>' +
            '<div class="plan-nutrition-summary-item"><div class="plan-nutrition-summary-key">Clippings</div><div class="plan-nutrition-summary-val">' + esc(clipLabel) + '</div></div>' +
            '</div>';

        if (clipping === 'returned') {
            html += '<div style="font-size:11px;color:var(--gaip-text-muted);margin-bottom:12px;padding:8px 12px;background:var(--gaip-info-bg);border:1px solid var(--gaip-info-border);border-radius:var(--gaip-radius-sm)">Returned clippings provide ~20% N recycling — effective annual requirement reduced to ' + Math.round(annualN * 0.8) + ' kg N/ha</div>';
        }

        // Annual totals
        html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--gaip-text-muted);margin-bottom:8px">Annual Totals (kg/ha)</div>';
        html += '<div class="plan-nutrition-totals">' +
            ['N','P','K','Ca','Mg','S'].map(function (n) {
                return '<div class="plan-nut-total">' +
                    '<div class="plan-nut-total-val">' + totals[n] + '</div>' +
                    '<div class="plan-nut-total-label">' + n + '</div>' +
                    '<div class="plan-nut-total-unit">kg/ha/yr</div>' +
                    '</div>';
            }).join('') +
            '</div>';

        // Monthly calendar table
        html += '<div style="overflow-x:auto">' +
            '<table class="plan-cal-table">' +
            '<thead><tr><th>Month</th><th>Season</th><th>GP%</th><th>N</th><th>P</th><th>K</th><th>Ca</th><th>Mg</th><th>S</th></tr></thead>' +
            '<tbody>';
        months.forEach(function (m, i) {
            html += '<tr' + (i === curMo ? ' class="current-month"' : '') + '>' +
                '<td>' + m.month + (i === curMo ? ' ●' : '') + '</td>' +
                '<td>' + m.season + '</td>' +
                '<td>' + m.gp + '%</td>' +
                '<td>' + m.N + '</td><td>' + m.P + '</td><td>' + m.K + '</td>' +
                '<td>' + m.Ca + '</td><td>' + m.Mg + '</td><td>' + m.S + '</td>' +
                '</tr>';
        });
        html += '<tr><td><strong>Total</strong></td><td></td><td></td>' +
            '<td><strong>' + totals.N + '</strong></td>' +
            '<td><strong>' + totals.P + '</strong></td>' +
            '<td><strong>' + totals.K + '</strong></td>' +
            '<td><strong>' + totals.Ca + '</strong></td>' +
            '<td><strong>' + totals.Mg + '</strong></td>' +
            '<td><strong>' + totals.S + '</strong></td></tr>';
        html += '</tbody></table></div>';

        container.innerHTML = html;
        container.style.display = '';
        if (divider) divider.style.display = '';
        if (csvBtn) {
            csvBtn.style.display = '';
            csvBtn.onclick = function () { exportCSV(months, totals, species, methodology); };
        }

        // Store for iCal export
        global._GAIP_NUTRITION_RESULT = { months: months, totals: totals };
    }

    function exportCSV(months, totals, species, methodology) {
        var lines = ['Month,Season,GP%,N (kg/ha),P (kg/ha),K (kg/ha),Ca (kg/ha),Mg (kg/ha),S (kg/ha)'];
        months.forEach(function (m) {
            lines.push([m.month, m.season, m.gp, m.N, m.P, m.K, m.Ca, m.Mg, m.S].join(','));
        });
        lines.push(['Total','','', totals.N, totals.P, totals.K, totals.Ca, totals.Mg, totals.S].join(','));
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href   = url;
        a.download = 'nutrition-program-' + (species || 'site').replace(/\s+/g,'-').toLowerCase() + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    function initNutritionForm(computed, siteConfig) {
        var form    = document.getElementById('plan-nut-form');
        var btn     = document.getElementById('plan-nut-generate-btn');
        if (!form) return;

        // Pre-fill from site config if available
        var turf = siteConfig && siteConfig.turf;
        var savedN = turf && (turf.nProgramKgHaYr || turf.annualN);
        if (savedN) {
            var inputN = document.getElementById('plan-nut-annual-n');
            if (inputN && !inputN.value) inputN.value = Math.round(savedN);
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var annualN = safeNum(document.getElementById('plan-nut-annual-n').value, 0);
            var maxN    = safeNum(document.getElementById('plan-nut-max-n').value, 0);
            var dist    = document.getElementById('plan-nut-distribution').value;
            var clip    = document.getElementById('plan-nut-clipping').value;

            if (annualN <= 0) {
                document.getElementById('plan-nut-annual-n').focus();
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Generating…';

            var gpMonthly  = getMonthlyGP(computed);
            var result     = generateNutritionTable(annualN, maxN, dist, clip, gpMonthly);
            var species    = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.turfSpecies) || (turf && turf.species) || '';
            var methodology= (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.turfMethodology) || (turf && turf.methodology) || '';

            setTimeout(function () {
                renderNutritionResults(result, annualN, dist, clip, species, methodology);
                btn.disabled = false;
                btn.textContent = 'Re-calculate';
            }, 50);
        });
    }

    // ── SECTION: Seasonal N Plan ──────────────────────────────────────────────

    function renderSeasonalN(computed, siteConfig) {
        var body = document.getElementById('plan-seasonal-body');
        if (!body) return;

        var sn  = computed && computed.soilNutrition;
        var turf = siteConfig && siteConfig.turf;

        // Determine hemisphere
        var hemi = (turf && turf.hemi) || (siteConfig && siteConfig.location && siteConfig.location.hemisphere) || 'southern';
        var seasons = hemi === 'northern' ? SEASONS_N : SEASONS_S;

        // Get N diagnostics
        var baseOptimum = sn && sn.annualDemand && sn.annualDemand.baseOptimum;
        var opt         = sn && sn.annualDemand && sn.annualDemand.opt;

        if (!baseOptimum && !opt) {
            body.innerHTML = emptyState('nutrition', 'Soil test required',
                'Seasonal N plan calculates from N diagnostics in the soil test.',
                ['Import soil test results in the Soil Tests section',
                 'After import, run analysis to generate the seasonal plan']
            );
            return;
        }

        var annualN  = safeNum(opt || baseOptimum, 100);
        var c3Frac   = safeNum(turf && turf.percentC3Cover, 70) / 100;
        var curMo    = nowMonth();

        // Compute seasonal averages using actual GP
        var gpMonthly = getMonthlyGP(computed);

        var html = '<div style="font-size:11px;color:var(--gaip-text-muted);margin-bottom:14px">' +
            'Annual N optimum: <strong style="color:var(--gaip-text)">' + Math.round(annualN) + ' kg N/ha</strong>' +
            (c3Frac < 1 ? ' · C3/C4 blend ' + Math.round(c3Frac*100) + '/' + Math.round((1-c3Frac)*100) + '%' : '') +
            '</div>';

        html += '<div class="plan-seasonal-grid">';

        seasons.forEach(function (s, idx) {
            var isCurrentQ = s.monthRange.indexOf(curMo) >= 0;
            // Average GP for this quarter
            var qGP = s.monthRange.reduce(function (sum, m) { return sum + gpMonthly[m]; }, 0) / s.monthRange.length;
            // N target for quarter proportional to GP
            var allGP = seasons.reduce(function (sum, q) {
                return sum + q.monthRange.reduce(function (qs, m) { return qs + gpMonthly[m]; }, 0) / q.monthRange.length;
            }, 0);
            var quarterN = annualN * (qGP / Math.max(allGP, 1));

            // C3/C4 blend effect
            var c3gp = gpC3(s.avgTemp);
            var c4gp = gpC4(s.avgTemp);
            var isDominant = c3Frac >= 0.7 ? (c3gp > c4gp ? 'C3' : 'C4') : 'Mixed';

            var note = quarterN < 5
                ? 'Minimal demand — turf dormant or very slow growth'
                : quarterN > annualN * 0.4
                    ? 'Peak demand — prioritise quality controlled-release products'
                    : isDominant === 'C4'
                        ? 'Warm-season dominant — apply in split doses'
                        : 'Cool-season growth — steady application schedule';

            html += '<div class="plan-seasonal-quarter' + (isCurrentQ ? ' current' : '') + '">' +
                '<div class="plan-seasonal-name">' + esc(s.name) + (isCurrentQ ? ' <span style="color:var(--gaip-accent)">●</span>' : '') + '</div>' +
                '<div class="plan-seasonal-temp">' + esc(s.months) + ' · avg GP: ' + Math.round(qGP) + '%</div>' +
                '<div><span class="plan-seasonal-n">' + Math.round(quarterN * 10) / 10 + '</span><span class="plan-seasonal-n-unit">kg N/ha</span></div>' +
                '<div class="plan-seasonal-note">' + esc(note) + '</div>' +
                '</div>';
        });

        html += '</div>';

        // Source footer
        var src = sn && sn.annualDemand && sn.annualDemand.source;
        html += '<div style="font-size:10px;color:var(--gaip-text-muted);margin-top:8px">' +
            'Based on: MLSN/SLAN N diagnostics' +
            (src ? ' · ' + esc(src) : '') +
            ' · <a href="/analysis#soil-nutrition" style="color:var(--gaip-accent)">View full soil analysis →</a>' +
            '</div>';

        body.innerHTML = html;
    }

    // ── PAGE HEADER (gl-header pattern matching Analysis tabs) ────────────────

    function renderPlanHeader(computed, siteConfig) {
        var el = document.getElementById('plan-header-content');
        if (!el) return;

        function hexToRgb(hex) {
            var h = (hex || '#2d6a4f').replace('#','');
            return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
        }
        function kpi(label, value, unit, badgeHtml, color) {
            var rgb = hexToRgb(color);
            var bg     = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.07)';
            var border = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.25)';
            return '<div class="gl-kpi-card" style="background:'+bg+';border-color:'+border+';border-left-color:'+color+'">' +
                '<div class="gl-kpi-label">'+esc(label)+'</div>' +
                '<div class="gl-kpi-value" style="color:'+color+'">'+esc(String(value))+'</div>' +
                '<div class="gl-kpi-unit">'+esc(unit)+'</div>' +
                '<div>'+badgeHtml+'</div>' +
                '</div>';
        }
        function badge(text, cls) {
            var colors = {
                green:  { bg:'#f0fdf4', color:'#15803d', border:'#86efac' },
                amber:  { bg:'#fffbeb', color:'#854d0e', border:'#fde68a' },
                red:    { bg:'#fef2f2', color:'#991b1b', border:'#fca5a5' },
                grey:   { bg:'#f9fafb', color:'#6b7280', border:'#e5e7eb' },
            };
            var c = colors[cls] || colors.grey;
            return '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+c.bg+';color:'+c.color+';border:1px solid '+c.border+'">'+esc(text)+'</span>';
        }

        var cards = [];

        // Card 1: PGR status
        var pgr = computed.pgr;
        if (pgr && pgr.success && pgr.gdd) {
            var pgrPct = Math.round((pgr.gdd.progress || 0) * 100);
            var pgrStatus = pgr.effect && pgr.effect.reapplicationStatus || 'active';
            var pgrCls = pgrStatus === 'due_now' ? 'red' : pgrStatus === 'approaching' ? 'amber' : 'green';
            var pgrLabel = pgrStatus === 'due_now' ? 'Reapply now' : pgrStatus === 'approaching' ? 'Due soon' : 'On track';
            cards.push(kpi('PGR Progress', pgrPct+'%', 'GDD consumed', badge(pgrLabel, pgrCls),
                pgrCls === 'red' ? '#dc2626' : pgrCls === 'amber' ? '#d97706' : '#15803d'));
        } else {
            cards.push(kpi('PGR', 'No data', '', badge('Not set', 'grey'), '#6b7280'));
        }

        // Card 2: Pre-emergent
        var pe = computed.preEmergent;
        if (pe && pe.success) {
            var peAlerts = (pe.summary && pe.summary.activeAlerts) || 0;
            var peAggCls = pe.aggregateStatus === 'RED_EARLY' || pe.aggregateStatus === 'RED_MISSED' ? 'red'
                : pe.aggregateStatus === 'AMBER' ? 'amber' : 'green';
            cards.push(kpi('Pre-emergent', peAlerts > 0 ? peAlerts : '✓', peAlerts > 0 ? 'active alert'+(peAlerts>1?'s':'') : 'All clear',
                badge(peAlerts > 0 ? peAlerts+' alert'+(peAlerts>1?'s':'') : 'All clear', peAggCls),
                peAggCls === 'red' ? '#dc2626' : peAggCls === 'amber' ? '#d97706' : '#15803d'));
        } else {
            cards.push(kpi('Pre-emergent', '—', '', badge('No data', 'grey'), '#6b7280'));
        }

        // Card 3: Recovery / wear
        var wear = computed.wear;
        if (wear) {
            var recovDays = Math.round((wear.recoveryCapacity && wear.recoveryCapacity.days) || wear.recoveryWindow || 0);
            var wearScore = Math.round(((wear.wearResistance && wear.wearResistance.score) || 0) * 10) / 10;
            var wearCls   = wearScore >= 7 ? 'green' : wearScore >= 5 ? 'amber' : 'red';
            cards.push(kpi('Wear Resistance', wearScore.toFixed(1)+'/10', recovDays > 0 ? 'Recovery: '+recovDays+'d' : '',
                badge(wearScore >= 7 ? 'Good' : wearScore >= 5 ? 'Moderate' : 'Poor', wearCls),
                wearCls === 'red' ? '#dc2626' : wearCls === 'amber' ? '#d97706' : '#15803d'));
        } else {
            cards.push(kpi('Wear / Recovery', '—', '', badge('No traffic data', 'grey'), '#6b7280'));
        }

        // Card 4: Seasonal N this quarter
        var gp = computed.growthLight || computed.growth;
        var soilN = computed.soilNutrition;
        if (soilN && soilN.annualDemand) {
            var monthlyN = safeNum(soilN.annualDemand.n, 0) / 12;
            var nCls = monthlyN > 20 ? 'red' : monthlyN > 10 ? 'amber' : 'green';
            cards.push(kpi('Monthly N Need', Math.round(monthlyN)+'', 'kg N/ha this month',
                badge(monthlyN > 20 ? 'High demand' : monthlyN > 10 ? 'Moderate' : 'Low', nCls),
                nCls === 'red' ? '#dc2626' : nCls === 'amber' ? '#d97706' : '#15803d'));
        } else {
            cards.push(kpi('Nutrition', '—', 'Run analysis for N demand', badge('No soil data', 'grey'), '#6b7280'));
        }

        el.innerHTML = [
            '<div class="gl-header">',
            '<div class="gl-header-inner">',
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">',
            '<h1 class="gl-title">Management Plan</h1>',
            '<button class="plan-ical-btn" id="plan-ical-btn" title="Export planning schedule to calendar app">',
            '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
            'Export to Calendar',
            '</button>',
            '</div>',
            '<div class="gl-subtitle">Timely windows, recovery schedule and annual nutrition programme</div>',
            '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+cards.join('')+'</div>',
            '</div>',
            '</div>',
        ].join('\n');
    }

    // ── iCal Export ───────────────────────────────────────────────────────────

    function initICalExport(computed) {
        var btn = document.getElementById('plan-ical-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var events = [];
            var now = new Date();

            function icalDate(d) {
                return d.getFullYear() +
                    String(d.getMonth() + 1).padStart(2, '0') +
                    String(d.getDate()).padStart(2, '0');
            }
            function icalEsc(s) { return String(s || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
            function nextDay(d) { var n = new Date(d); n.setDate(n.getDate() + 1); return n; }
            function makeUID() { return 'gaip-' + Date.now() + '-' + Math.random().toString(36).substr(2,6) + '@gilba'; }

            function addEvent(dt, summary, desc, categories) {
                var uid = makeUID();
                events.push(
                    'BEGIN:VEVENT',
                    'UID:' + uid,
                    'DTSTART;VALUE=DATE:' + icalDate(dt),
                    'DTEND;VALUE=DATE:' + icalDate(nextDay(dt)),
                    'SUMMARY:' + icalEsc(summary),
                    'DESCRIPTION:' + icalEsc(desc || ''),
                    (categories ? 'CATEGORIES:' + icalEsc(categories) : ''),
                    'DTSTAMP:' + now.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z',
                    'END:VEVENT'
                ).filter(Boolean);
            }

            // PGR reapplication
            var pgr = computed && computed.pgr;
            if (pgr && pgr.success && pgr.gdd) {
                var dailyGDD = pgr.gdd.dailyGDDRate || pgr.gdd.avgDailyGDD;
                var remaining = safeNum(pgr.gdd.remaining, 0);
                if (dailyGDD && remaining > 0) {
                    var reapplyDate = new Date();
                    reapplyDate.setDate(reapplyDate.getDate() + Math.ceil(remaining / dailyGDD));
                    var pgrName = (pgr.product && pgr.product.name) || 'PGR';
                    addEvent(
                        reapplyDate,
                        'PGR Reapplication — ' + pgrName,
                        'GDD threshold reached (' + Math.round(safeNum(pgr.gdd.threshold,0)) + ' GDD). Apply ' + pgrName + '.',
                        'PGR'
                    );
                }
            }

            // Pre-emergent alerts (AMBER and RED only)
            var pe = computed && computed.preEmergent;
            if (pe && pe.results) {
                pe.results.forEach(function (r) {
                    if (r.alertStatus === 'GREEN' || r.alertStatus === 'ADVISORY_ONLY') return;
                    var dt = new Date();
                    if (r.daysToThreshold != null && r.daysToThreshold > 0) {
                        dt.setDate(dt.getDate() + r.daysToThreshold);
                    }
                    addEvent(
                        dt,
                        'Pre-emergent — ' + (r.commonName || r.scientificName),
                        (r.recommendedAction || '') + ' Soil temp: ' + (r.soilTemp5cm || '—') + '°C',
                        'Pre-emergent'
                    );
                });
            }

            if (!events.length) {
                alert('No upcoming events to export. Run analysis first to generate PGR and pre-emergent recommendations.');
                return;
            }

            var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gilba Hub//Plan//EN', 'CALSCALE:GREGORIAN']
                .concat(events)
                .concat(['END:VCALENDAR'])
                .join('\r\n');

            var blob = new Blob([ics], { type: 'text/calendar' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href     = url;
            a.download = 'gilba-plan.ics';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // ── INIT ──────────────────────────────────────────────────────────────────

    function init() {
        var data       = global.GAIP_DASHBOARD_DATA || {};
        var computed   = data.computed  || {};
        var siteConfig = global.GAIP_SITE_CONFIG || {};

        renderPlanHeader(computed, siteConfig);
        initICalExport(computed);

        // ── Tab routing (mirrors analysis-router.js pattern) ──────────────
        var TABS = ['timing', 'recovery', 'nutrition'];
        var currentTab = null;
        var rendered   = {};

        function getHash() {
            var h = (global.location.hash || '').slice(1);
            return TABS.indexOf(h) !== -1 ? h : 'timing';
        }

        function showTab(tabId) {
            if (TABS.indexOf(tabId) === -1) tabId = 'timing';
            if (tabId === currentTab) return;
            currentTab = tabId;

            if (global.location.hash !== '#' + tabId) {
                global.history.pushState(null, '', '#' + tabId);
            }

            document.querySelectorAll('.gl-tab[data-tab]').forEach(function (el) {
                el.classList.toggle('active', el.dataset.tab === tabId);
            });

            TABS.forEach(function (id) {
                var w = document.getElementById('plan-tab-' + id);
                if (w) w.style.display = id === tabId ? 'block' : 'none';
            });

            if (!rendered[tabId]) {
                rendered[tabId] = true;
                if (tabId === 'timing') {
                    renderPreEmergent(computed);
                    renderPGR(computed);
                } else if (tabId === 'recovery') {
                    renderRecovery(computed, siteConfig);
                } else if (tabId === 'nutrition') {
                    initNutritionForm(computed, siteConfig);
                    renderSeasonalN(computed, siteConfig);
                }
            }
        }

        document.addEventListener('click', function (e) {
            var tab = e.target.closest('.gl-tab[data-tab]');
            if (!tab) return;
            e.preventDefault();
            showTab(tab.dataset.tab);
        });

        global.addEventListener('popstate', function () {
            showTab(getHash());
        });

        showTab(getHash());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}(window));
