/**
 * =============================================================================
 * GILBA BENCHMARK CHART — Client JS v1.1.0
 * =============================================================================
 * Config injected via window.GAIP_BenchmarkConfig[uid] by PHP shortcode.
 * Enqueued as a proper wp_enqueue_script asset — not inline — so browser
 * extensions cannot suppress execution.
 * =============================================================================
 */
(function() {
    'use strict';

    // ── Utilities ─────────────────────────────────────────────────────────────

    function formatSubKey(key) {
        return key
            .replace(/_risk$/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, function(c) { return c.toUpperCase(); })
            .replace('Microdochium', '(Microdochium)')
            .replace('Patch  ', 'Patch ');
    }

    function qualIcon(q) {
        if (q === 'better_than_expected') return '✓';
        if (q === 'worse_than_expected')  return '✗';
        if (q === 'as_expected')           return '◉';
        return '';
    }

    function toISO(dt) {
        if (!dt) return dt;
        return typeof dt === 'string' ? dt.replace(' ', 'T') : dt;
    }

    // ── Mock data ─────────────────────────────────────────────────────────────

    var MOCK_DATA = {
        outcomes: (function() {
            var rows = [];
            var diseases = ['dollar_spot_risk', 'fusarium_patch_microdochium_risk', 'brown_patch_risk'];
            var counts = [18, 10, 8];
            var quals = ['as_expected','as_expected','better_than_expected','as_expected','worse_than_expected','as_expected'];
            diseases.forEach(function(key, di) {
                for (var i = 0; i < counts[di]; i++) {
                    rows.push({
                        sub_key: key,
                        predicted_at: new Date(Date.now() - (44 - i * 2.5) * 86400000).toISOString(),
                        predicted_value: (0.25 + Math.sin(i/3) * 0.22 + Math.random() * 0.08).toFixed(3),
                        qualitative: quals[i % 6],
                    });
                }
            });
            return rows;
        })(),
        pending: (function() {
            var rows = [];
            for (var i = 0; i < 5; i++) {
                rows.push({
                    sub_key: 'dollar_spot_risk',
                    predicted_at: new Date(Date.now() - i * 86400000).toISOString(),
                    predicted_value: (0.45 + i * 0.04).toFixed(3),
                    status: 'pending',
                });
            }
            return rows;
        })(),
        accuracy: {
            dollar_spot_risk: { total: 18, as_expected: 13, better: 3, worse: 2, accuracy_pct: 89 },
            fusarium_patch_microdochium_risk: { total: 10, as_expected: 7, better: 2, worse: 1, accuracy_pct: 90 },
            brown_patch_risk: { total: 8, as_expected: 8, better: 0, worse: 0, accuracy_pct: 100 },
        },
        counts: { outcomes: 36, pending: 5 },
        _isMock: true,
    };

    // ── getSiteId ─────────────────────────────────────────────────────────────

    function getSiteId(cfg) {
        if (cfg.siteIdOverride) return cfg.siteIdOverride;
        var hubCfg = window.GAIP_HUB_CONFIG || {};
        var loc = hubCfg.savedLocation || {};
        var lat = loc.lat ? Math.round(loc.lat * 1000) / 1000 : 0;
        var lon = loc.lon ? Math.round(loc.lon * 1000) / 1000 : 0;
        var nm  = loc.name || 'unknown';
        var h = 0;
        for (var i = 0; i < nm.length; i++) { h = ((h << 5) - h) + nm.charCodeAt(i); h = h & h; }
        return lat + '_' + lon + '_' + Math.abs(h).toString(36);
    }

    // ── buildSkeleton ─────────────────────────────────────────────────────────

    function buildSkeleton(root, cfg, isMock, data) {
        var uid = cfg.rootId;
        root.innerHTML =
            '<div class="bmc-wrap">' +
                '<div class="bmc-header">' +
                    '<div class="bmc-title-block">' +
                        '<div class="bmc-eyebrow">GILBA · ENGINE ACCURACY</div>' +
                        '<h2 class="bmc-title">' + cfg.title + '</h2>' +
                    '</div>' +
                    '<div class="bmc-meta-block">' +
                        '<div class="bmc-meta-item" id="' + uid + '-count-outcomes">' + data.counts.outcomes + '</div>' +
                        '<div class="bmc-meta-label">outcomes captured</div>' +
                        '<div class="bmc-meta-item" id="' + uid + '-count-pending">' + data.counts.pending + '</div>' +
                        '<div class="bmc-meta-label">awaiting capture</div>' +
                    '</div>' +
                '</div>' +
                (isMock
                    ? '<div class="bmc-mock-banner">⚠ Demo data — no outcomes captured yet. Run the hub and capture outcomes to populate real history.</div>'
                    : (data.counts.outcomes === 0
                        ? '<div class="bmc-mock-banner" style="border-color:#1e40af40;color:#1e3a8a;background:#eff6ff10;">ℹ ' + data.counts.pending + ' predictions tracked — capture outcomes via the hub to build accuracy history.</div>'
                        : '')) +
                '<div class="bmc-accuracy-strip" id="' + uid + '-accuracy-strip"></div>' +
                '<div class="bmc-chart-wrap"><canvas id="' + uid + '-canvas" aria-label="' + cfg.title + '"></canvas></div>' +
                '<div class="bmc-legend" id="' + uid + '-legend"></div>' +
                '<div class="bmc-footer">' +
                    '<span class="bmc-footer-note">Predicted risk (%) vs captured field observations · ' + cfg.days + '-day window</span>' +
                    '<span class="bmc-footer-note" id="' + uid + '-site-id"></span>' +
                '</div>' +
            '</div>';
    }

    // ── renderAccuracyStrip ───────────────────────────────────────────────────

    function renderAccuracyStrip(uid, accuracy) {
        var strip = document.getElementById(uid + '-accuracy-strip');
        if (!strip) return;
        var entries = Object.keys(accuracy);
        if (!entries.length) { strip.style.display = 'none'; return; }
        strip.innerHTML = entries.map(function(key) {
            var acc = accuracy[key];
            var col = acc.accuracy_pct >= 80 ? '#22c55e' : acc.accuracy_pct >= 60 ? '#eab308' : '#ef4444';
            return '<div class="bmc-acc-card">' +
                '<div class="bmc-acc-name">' + formatSubKey(key) + '</div>' +
                '<div class="bmc-acc-score" style="color:' + col + '">' + (acc.accuracy_pct != null ? acc.accuracy_pct : '—') + '%</div>' +
                '<div class="bmc-acc-label">accurate</div>' +
                '<div class="bmc-acc-breakdown">' +
                    '<span class="bmc-acc-better" title="Better">✓' + acc.better + '</span>' +
                    '<span class="bmc-acc-match" title="As predicted">◉' + acc.as_expected + '</span>' +
                    '<span class="bmc-acc-worse" title="Worse">✗' + acc.worse + '</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ── buildChart ────────────────────────────────────────────────────────────

    function buildChart(uid, data) {
        var canvas = document.getElementById(uid + '-canvas');
        if (!canvas) return;

        var PALETTE = ['#f97316','#3b82f6','#22c55e','#a855f7','#06b6d4','#eab308','#ec4899','#14b8a6'];

        // Group by sub_key
        var byKey = {};
        data.outcomes.forEach(function(r) {
            if (!byKey[r.sub_key]) byKey[r.sub_key] = [];
            byKey[r.sub_key].push(r);
        });
        var pendingByKey = {};
        data.pending.forEach(function(r) {
            if (!pendingByKey[r.sub_key]) pendingByKey[r.sub_key] = [];
            pendingByKey[r.sub_key].push(r);
        });

        // Assign colours
        var allKeys = Object.keys(Object.assign({}, byKey, pendingByKey));
        var keyColour = {};
        allKeys.forEach(function(k, i) { keyColour[k] = PALETTE[i % PALETTE.length]; });

        var datasets = [];

        // Outcome lines (solid)
        Object.keys(byKey).forEach(function(key) {
            var rows = byKey[key];
            var col = keyColour[key];
            datasets.push({
                label: formatSubKey(key),
                data: rows.map(function(r) { return {
                    x: toISO(r.predicted_at),
                    y: Math.round(parseFloat(r.predicted_value) * 100),
                    qualitative: r.qualitative,
                }; }),
                borderColor: col,
                backgroundColor: col + '18',
                borderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: rows.map(function(r) {
                    return r.qualitative === 'worse_than_expected' ? '#ef4444'
                         : r.qualitative === 'better_than_expected' ? '#22c55e' : col;
                }),
                pointBorderColor: rows.map(function(r) {
                    return r.qualitative === 'worse_than_expected' ? '#ef4444'
                         : r.qualitative === 'better_than_expected' ? '#22c55e' : col;
                }),
                tension: 0.35,
                fill: false,
                _key: key,
            });
        });

        // Pending lines (dashed)
        Object.keys(pendingByKey).forEach(function(key) {
            var rows = pendingByKey[key];
            var col = keyColour[key];
            var stitch = byKey[key] ? [{
                x: toISO(byKey[key][byKey[key].length - 1].predicted_at),
                y: Math.round(parseFloat(byKey[key][byKey[key].length - 1].predicted_value) * 100),
            }] : [];
            datasets.push({
                label: formatSubKey(key) + ' (pending)',
                data: stitch.concat(rows.map(function(r) { return {
                    x: toISO(r.predicted_at),
                    y: Math.round(parseFloat(r.predicted_value) * 100),
                }; })),
                borderColor: col,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 3,
                pointBackgroundColor: col + '60',
                tension: 0.35,
                fill: false,
                _pending: true,
            });
        });

        // Risk zone annotations (if plugin available)
        var annotationPlugin = window.Chart && window.Chart.registry && window.Chart.registry.plugins.get('annotation');
        var annotations = {};
        if (annotationPlugin) {
            [
                { yMin: 85, yMax: 100, color: 'rgba(220,38,38,0.04)' },
                { yMin: 70, yMax: 85,  color: 'rgba(234,88,12,0.04)' },
                { yMin: 50, yMax: 70,  color: 'rgba(202,138,4,0.04)' },
            ].forEach(function(z, i) {
                annotations['zone' + i] = { type: 'box', yMin: z.yMin, yMax: z.yMax, backgroundColor: z.color, borderWidth: 0 };
            });
        }

        try {
            new window.Chart(canvas, {
                type: 'line',
                data: { datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0f172a',
                            titleColor: 'var(--gaip-text-muted)',
                            bodyColor: 'var(--gaip-border)',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                title: function(items) {
                                    var d = new Date(items[0].raw.x);
                                    return d.toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'});
                                },
                                label: function(item) {
                                    var q = item.raw.qualitative;
                                    var icon = qualIcon(q);
                                    var pending = item.dataset._pending ? ' (pending)' : '';
                                    return ' ' + icon + ' ' + item.dataset.label + pending + ': ' + item.raw.y + '%';
                                },
                            },
                        },
                        annotation: annotationPlugin ? { annotations: annotations } : undefined,
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: { unit: 'day', displayFormats: { day: 'd MMM' } },
                            grid: { color: 'var(--gaip-text)', drawBorder: false },
                            ticks: { color: 'var(--gaip-text-secondary)', font: { size: 11, family: "'IBM Plex Mono', monospace" } },
                        },
                        y: {
                            min: 0, max: 100,
                            grid: { color: 'var(--gaip-text)', drawBorder: false },
                            ticks: {
                                color: 'var(--gaip-text-secondary)',
                                font: { size: 11, family: "'IBM Plex Mono', monospace" },
                                callback: function(v) { return v + '%'; },
                                stepSize: 25,
                            },
                            title: {
                                display: true,
                                text: 'Risk Score (%)',
                                color: 'var(--gaip-text-secondary)',
                                font: { size: 11, family: "'IBM Plex Mono', monospace" },
                            },
                        },
                    },
                },
            });
        } catch(e) {
            console.error('[BenchmarkChart] Chart error:', e);
            canvas.insertAdjacentHTML('afterend',
                '<div style="color:#ef4444;font-size:0.75rem;padding:8px;">Chart error: ' + e.message + '</div>');
        }

        // Custom legend
        var legend = document.getElementById(uid + '-legend');
        if (legend) {
            legend.innerHTML = allKeys.map(function(k) {
                return '<div class="bmc-legend-item">' +
                    '<span class="bmc-legend-swatch" style="background:' + keyColour[k] + '"></span>' +
                    '<span class="bmc-legend-label">' + formatSubKey(k) + '</span>' +
                    (byKey[k] ? '<span class="bmc-legend-count">' + byKey[k].length + ' pts</span>' : '') +
                '</div>';
            }).join('') +
            '<div class="bmc-legend-key">' +
                '<span class="bmc-legend-dot bmc-dot-match">◉</span> As predicted &nbsp;' +
                '<span class="bmc-legend-dot bmc-dot-better">✓</span> Better &nbsp;' +
                '<span class="bmc-legend-dot bmc-dot-worse">✗</span> Worse &nbsp;' +
                '<span class="bmc-legend-dot bmc-dot-pending">╌</span> Pending' +
            '</div>';
        }
    }

    // ── init ─────────────────────────────────────────────────────────────────

    function initInstance(cfg) {
        var root = document.getElementById(cfg.rootId);
        if (!root) { console.warn('[BenchmarkChart] Root not found:', cfg.rootId); return; }

        var hubCfg = window.GAIP_HUB_CONFIG || {};
        var restUrl = (cfg.restUrl || hubCfg.restUrl || '/api/').replace(/\/+$/, '');
        var csrfToken = cfg.csrfToken || cfg.nonce || hubCfg.csrfToken || hubCfg.restNonce || hubCfg.nonce || '';
        var siteId  = getSiteId(cfg);
        var url     = restUrl + '/benchmark/' + encodeURIComponent(siteId) +
                      '?module=' + cfg.module + '&limit=' + cfg.limit + '&days=' + cfg.days;

        // Show site ID in footer
        var sidEl = document.getElementById(cfg.rootId + '-site-id');

        fetch(url, {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken
            }
        })
            .then(function(r) { return r.json(); })
            .then(function(json) {
                var data, isMock = false;
                if (!json.success || (json.counts.outcomes === 0 && json.counts.pending === 0)) {
                    data = MOCK_DATA; isMock = true;
                } else {
                    data = json;
                }
                buildSkeleton(root, cfg, isMock, data);
                if (sidEl) sidEl.textContent = 'Site: ' + siteId;
                renderAccuracyStrip(cfg.rootId, data.accuracy);
                buildChart(cfg.rootId, data);
            })
            .catch(function(err) {
                console.warn('[BenchmarkChart] Fetch failed, using mock:', err.message);
                buildSkeleton(root, cfg, true, MOCK_DATA);
                renderAccuracyStrip(cfg.rootId, MOCK_DATA.accuracy);
                buildChart(cfg.rootId, MOCK_DATA);
            });
    }

    // ── Boot — initialise all instances on the page ───────────────────────────
    // Config objects written by PHP shortcode to window.GAIP_BenchmarkConfig[uid]

    function bootAll() {
        var configs = window.GAIP_BenchmarkConfig || {};
        Object.keys(configs).forEach(function(uid) {
            initInstance(configs[uid]);
        });
    }

    // Register for boot — this file is enqueued in footer after Chart.js,
    // so Chart and GAIP_HUB_CONFIG are already available.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll);
    } else {
        bootAll();
    }

})();
