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

    function gpC3(temp) {
        var GPE = global.GilbaGrowthPotentialEngine;
        var gp = GPE ? GPE.compute(safeNum(temp, 15), { model: 'pace', species: 'c3' }) : null;
        return gp != null ? Math.round(gp * 100) : 0;
    }

    function gpC4(temp) {
        var GPE = global.GilbaGrowthPotentialEngine;
        var gp = GPE ? GPE.compute(safeNum(temp, 25), { model: 'pace', species: 'c4' }) : null;
        return gp != null ? Math.round(gp * 100) : 0;
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

    // ── SECTION: PGR ─────────────────────────────────────────────────────────

    function renderPGR(computed) {
        var body  = document.getElementById('plan-pgr-body');
        var badge = document.getElementById('plan-pgr-badge');
        if (!body) return;

        var pgr = computed && computed.pgr;

        if (!pgr || !pgr.gdd) {
            body.innerHTML = emptyState(
                'pgr',
                'No PGR application recorded',
                'Log a PGR application in <a href="/data/spray-log" style="color:var(--gaip-accent)">Data → Spray Log</a> — select <strong>PGR</strong> as the category, then re-run the analysis. The GDD schedule will appear here.',
                []
            );
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

        // Update tab-level badge
        var tabBadge = document.getElementById('gl-badge-pgr');
        if (tabBadge) {
            if (statusKey === 'due' || statusKey === 'expired') {
                tabBadge.textContent = '!';
                tabBadge.style.display = '';
                tabBadge.className = 'gl-tab-badge critical';
            } else if (statusKey === 'approaching') {
                tabBadge.textContent = '!';
                tabBadge.style.display = '';
                tabBadge.className = 'gl-tab-badge warning';
            } else {
                tabBadge.style.display = 'none';
            }
        }

        // GDD progress — hub-persistence saves progressPct (0-100); fall back to progress*100 (0-1 legacy)
        var progress  = clamp(
            gdd.progressPct != null ? safeNum(gdd.progressPct, 0)
                                    : safeNum(gdd.progress, 0) * 100,
            0, 100
        );
        var remaining = safeNum(gdd.remaining, 0);
        var thresh    = safeNum(gdd.threshold, 0);
        var accum     = safeNum(gdd.accumulated, 0);
        // Reapplication window opens at 75% of threshold (Kreuser & Soldat 2011)
        var remaining75 = Math.max(0, thresh * 0.75 - accum);

        var barColor = progress >= 75 ? 'var(--gaip-critical)' :
                       progress >= 60 ? 'var(--gaip-warning)'  : 'var(--gaip-accent)';

        // hub-persistence saves suppressionPct (0-100); fall back to suppression*100 (0-1 legacy)
        var suppression = safeNum(
            effect.suppressionPct != null ? effect.suppressionPct
                                          : (effect.suppression || 0) * 100,
            0
        );
        var adjSupp     = safeNum(effect.adjustedSuppression || suppression, 0);
        var hasAdj      = (effect.adjustedSuppression != null) && (Math.abs(adjSupp - suppression) > 0.5);

        // Application date display
        var appDate = inp.applicationDate || pgr.applicationDate || '';
        var appDateFmt = appDate ? appDate : '—';

        // Days estimate to reapplication window (75% threshold) — derive daily rate from accumulated/days
        var dailyGDD    = gdd.dailyGDDRate || gdd.avgDailyGDD ||
                          (gdd.days > 0 && accum > 0 ? accum / gdd.days : null);
        var daysToWin   = (dailyGDD && remaining75 > 0) ? Math.ceil(remaining75 / dailyGDD) : null;
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
            '<div class="plan-metric-sub">' + Math.round(remaining75) + ' GDD to window</div>' +
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

        // PGR Response Curve chart container
        html += '<div id="plan-pgr-chart-container" style="margin-top:16px"></div>';

        // Log button
        html += '<div class="plan-card-footer">' +
            '<a href="/data/spray-log?category=pgr" class="plan-action-btn">' +
            '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>' +
            'Log PGR application' +
            '</a>' +
            '</div>';

        body.innerHTML = html;

        // Render PGR Response Curve chart
        if (typeof global.PGRForecast !== 'undefined') {
            var chartEl = body.querySelector('#plan-pgr-chart-container');
            if (chartEl) {
                setTimeout(function () {
                    global.PGRForecast.render(chartEl, pgr, global.GAIP_DASHBOARD_DATA || {});
                }, 50);
            }
        }
    }

    // ── SECTION: Recovery Calendar ────────────────────────────────────────────

    function renderRecovery(computed, siteConfig) {
        var body = document.getElementById('plan-rec-body');
        var settingsLink = document.getElementById('plan-rec-settings-link');
        if (!body) return;

        var wear = computed && computed.wear;
        var turf = siteConfig && siteConfig.turf;

        // Read from the traffic form's localStorage save (new hub data path)
        var _trafficSaved = {};
        try {
            var _tsid = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId) || 'default';
            _trafficSaved = JSON.parse(localStorage.getItem('gilba_traffic_state_' + _tsid) || '{}');
        } catch(_) {}

        var matchesPerWeek  = safeNum(_trafficSaved.matchesPerWeek  || (turf && (turf.matchesPerWeek  || turf.matches_per_week  || turf.matchesWeek)),  0);
        var sessionsPerWeek = safeNum(_trafficSaved.sessionsPerWeek || (turf && (turf.sessionsPerWeek || turf.sessions_per_week || turf.sessionsWeek)), 0);

        if (!wear && !matchesPerWeek && !sessionsPerWeek) {
            var _turfType = turf && turf.turfType;
            body.innerHTML = emptyState('recovery', 'No traffic data configured',
                'Recovery windows calculate from match and training schedule.',
                _turfType === 'sports'
                    ? [
                        'Traffic &amp; Wear analysis applies to sports fields only',
                        'Open <a href="/settings#traffic" style="color:var(--gaip-link,#2563eb)">Settings → Traffic &amp; Wear</a> to configure your match and training schedule, then re-run the analysis',
                        'LOI / OM soil test improves the estimate (optional)'
                      ]
                    : [
                        'Traffic &amp; Wear analysis applies to sports fields only',
                        'Set turf type to “Sports Field” in Site Settings to enable'
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
            html += '<div style="font-size:12px;color:var(--gaip-text-muted);padding:10px 0">Open <a href="/settings#traffic" style="color:var(--gaip-link,#2563eb)">Settings → Traffic &amp; Wear</a> to configure your match and training schedule, then re-run analysis to generate wear forecasts.</div>';
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

    function initNutritionForm(computed, siteConfig) {
        var form = document.getElementById('plan-nut-form');
        if (!form) return;

        // Pre-fill Annual N from saved site config
        var turf   = siteConfig && siteConfig.turf;
        var savedN = turf && (turf.nProgramKgHaYr || turf.annualN);
        if (savedN) {
            var inputN = document.getElementById('plan-nut-annual-n');
            if (inputN && !inputN.value) inputN.value = Math.round(savedN);
        }

        // Prevent accidental form submit on Enter — generate button handles clicks
        form.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    // ── SECTION: Seasonal N Plan ──────────────────────────────────────────────

    function renderSeasonalN(computed, siteConfig) {
        var body = document.getElementById('plan-seasonal-body');
        if (!body) return;

        var turf  = siteConfig && siteConfig.turf;
        var hub   = window.GAIP_HUB_CONFIG || {};

        // Determine hemisphere
        var hemi = (turf && turf.hemi) || (siteConfig && siteConfig.location && siteConfig.location.hemisphere) || 'southern';
        var seasons = hemi === 'northern' ? SEASONS_N : SEASONS_S;

        // Annual N rate — from saved site config (nProgramKgHaYr or nProgram or annualN)
        // This is the user-entered N programme from Settings, not from any analysis engine.
        var annualN = safeNum(
            (turf && (turf.nProgramKgHaYr || turf.nProgram || turf.annualN)) ||
            (hub.nProgram) ||
            null,
            0
        );

        if (!annualN) {
            body.innerHTML = emptyState('nutrition', 'N programme not set',
                'Seasonal N plan distributes your annual N budget across quarters by growth potential.',
                ['Set your annual N programme rate in <a href="/settings#turf" style="color:var(--gaip-accent);text-decoration:underline">Settings → Turf</a>',
                 'The seasonal plan will calculate automatically']
            );
            return;
        }

        var c3Frac   = safeNum(turf && (turf.c3Cover !== undefined ? turf.c3Cover : turf.percentC3Cover), 70) / 100;
        var curMo    = nowMonth();

        // Compute seasonal averages using actual GP from analysis cache (or default)
        var gpMonthly = getMonthlyGP(computed);

        var html = '<div style="font-size:11px;color:var(--gaip-text-muted);margin-bottom:14px">' +
            'Annual N programme: <strong style="color:var(--gaip-text)">' + Math.round(annualN) + ' kg N/ha</strong>' +
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
        var hasClimatGP = !!(computed && computed.climate && (computed.climate.dualMetrics || computed.climate.growth));
        html += '<div style="font-size:10px;color:var(--gaip-text-muted);margin-top:8px">' +
            'N distributed by monthly Growth Potential' +
            (hasClimatGP ? ' · <span style="color:var(--gaip-good)">Using site climate data</span>' : ' · Using default GP curve') +
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
            // progressPct is 0-100 scale; progress is 0-1 fraction — use same logic as renderPGR
            // Cap at 100 — same as renderPGR; "Reapply now" badge communicates overdue state
            var pgrPct = clamp(
                pgr.gdd.progressPct != null ? Math.round(safeNum(pgr.gdd.progressPct, 0))
                                            : Math.round(safeNum(pgr.gdd.progress, 0) * 100),
                0, 100
            );
            var pgrGdd   = pgr.gdd;
            var pgrAccum = Math.round(safeNum(pgrGdd.accumulated, 0));
            var pgrThresh = Math.round(safeNum(pgrGdd.threshold, 0));
            var pgrStatus = (pgr.effect && pgr.effect.reapplicationStatus) || 'active';
            // Status values from module: 'active', 'approaching', 'due', 'expired'
            var pgrIsUrgent = pgrStatus === 'due' || pgrStatus === 'expired';
            var pgrCls   = pgrIsUrgent ? 'red' : pgrStatus === 'approaching' ? 'amber' : 'green';
            var pgrLabel = pgrIsUrgent ? 'Reapply now' : pgrStatus === 'approaching' ? 'Due soon' : 'On track';
            cards.push(kpi('PGR Progress', pgrPct + '%', pgrAccum + ' / ' + pgrThresh + ' GDD', badge(pgrLabel, pgrCls),
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
            '<h1 class="gl-title">Management Plan</h1>',
            '<div class="gl-subtitle">Timely windows, recovery schedule and annual nutrition programme</div>',
            '<div class="gl-kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+cards.join('')+'</div>',
            '</div>',
            '</div>',
        ].join('\n');
    }

    // ── INIT ──────────────────────────────────────────────────────────────────

    function init() {
        var data       = global.GAIP_DASHBOARD_DATA || {};
        var computed   = data.computed  || {};
        var siteConfig = global.GAIP_SITE_CONFIG || {};

        renderPlanHeader(computed, siteConfig);

        // ── Tab routing (mirrors analysis-router.js pattern) ──────────────
        var TABS = ['pre-emergent', 'pgr', 'recovery', 'nutrition'];
        var currentTab = null;
        var rendered   = {};

        function getHash() {
            var h = (global.location.hash || '').slice(1);
            // legacy #timing → redirect to pre-emergent
            if (h === 'timing') return 'pre-emergent';
            return TABS.indexOf(h) !== -1 ? h : 'pre-emergent';
        }

        function showTab(tabId) {
            if (TABS.indexOf(tabId) === -1) tabId = 'pre-emergent';
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
                if (tabId === 'pre-emergent') {
                    renderPreEmergent(computed);
                } else if (tabId === 'pgr') {
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
        document.addEventListener('DOMContentLoaded', function () {
            init();
        });
    } else {
        init();
    }

}(window));
