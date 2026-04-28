/**
 * =============================================================================
 * GILBA OUTCOME CAPTURE UI v1.2.0
 * =============================================================================
 * 
 * Phase 2 of the Outcome Logging & Empirical Calibration system.
 * 
 * v1.2.0 CHANGES (b35fix138):
 * - Individual prediction buttons now submit immediately on click
 * - Inline saved/error/saving state per prediction row
 * - No longer requires module batch button to submit individual overrides
 *
 * v1.1.0 CHANGES:
 * - "All tracked as expected" one-click bulk action at top
 * - Batch capture per module group (one qualitative click captures all in group)
 * - Individual card override: expand any prediction to record a different outcome
 * - Debounced reload to prevent duplicate fetches from near-simultaneous events
 * 
 * WORKFLOW:
 * 1. Fetches GET /gilba/v1/predictions/pending/{site_id}
 * 2. Groups by module, shows count per module
 * 3. Quick path: "All as expected" captures everything in one click
 * 4. Module path: qualitative buttons on each module group header
 * 5. Override path: expand individual predictions to record different outcomes
 * 6. POST /gilba/v1/outcomes for each prediction (batched sequentially)
 * 
 * @author  Gilba Solutions
 * @version 1.2.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.2.0',
        debug: false,
        containerId: 'gaip-outcome-capture',
        moduleLabels: {
            soil:    { icon: '🧪', label: 'Soil & Nutrition' },
            disease: { icon: '🦠', label: 'Disease Risk' },
            pgr:     { icon: '📐', label: 'PGR Timing' },
            stress:  { icon: '🌡️', label: 'Stress Forecast' },
            water:   { icon: '💧', label: 'Water Quality' },
            climate: { icon: '☁️', label: 'Climate' }
        },
        moduleOrder: ['disease', 'stress', 'pgr', 'soil', 'water', 'climate'],
        qualitativeOptions: [
            { value: 'better_than_expected', label: 'Better', icon: '✅' },
            { value: 'as_expected',          label: 'As predicted', icon: '🎯' },
            { value: 'worse_than_expected',  label: 'Worse',  icon: '⚠️' }
        ],
        actionOptions: [
            { value: 'followed',       label: 'Followed recommendation' },
            { value: 'modified',       label: 'Modified approach' },
            { value: 'ignored',        label: 'Did not act' },
            { value: 'not_applicable', label: 'N/A' }
        ]
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let _pendingPredictions = [];
    let _isExpanded = false;
    let _isSubmitting = false;
    let _isLoading = false;
    let _loadTimer = null;
    let _container = null;
    // Track individual overrides: predictionId -> { qualitative, action_taken, action_notes }
    let _overrides = {};

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(msg, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) ;
        else ;
    }

    function warn(msg, data) {
        if (data !== undefined) console.warn('[OutcomeCapture]', msg, data);
        else console.warn('[OutcomeCapture]', msg);
    }

    // =========================================================================
    // SITE IDENTIFIER (mirrors prediction-logger.js)
    // =========================================================================

    function getSiteIdentifier() {
        const config = global.GAIP_HUB_CONFIG || {};
        const location = config.savedLocation || {};
        const lat = location.lat ? Math.round(location.lat * 1000) / 1000 : 0;
        const lon = location.lon ? Math.round(location.lon * 1000) / 1000 : 0;
        const locationName = location.name || 'unknown';
        return lat + '_' + lon + '_' + hashString(locationName);
    }

    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // =========================================================================
    // REST API
    // =========================================================================

    function getRestConfig() {
        const config = global.GAIP_HUB_CONFIG || {};
        return {
            baseUrl: config.restUrl || '/wp-json/gilba/v1/',
            nonce: config.restNonce || config.nonce || ''
        };
    }

    async function fetchPending() {
        const siteId = getSiteIdentifier();
        if (!siteId || siteId === '0_0_0') return [];

        const rest = getRestConfig();
        const url = rest.baseUrl + 'predictions/pending/' + encodeURIComponent(siteId);

        try {
            const response = await fetch(url, {
                headers: { 'X-WP-Nonce': rest.nonce }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            log('Fetched ' + (data.count || 0) + ' pending predictions');
            return data.pending || [];
        } catch (err) {
            warn('Failed to fetch pending:', err);
            return [];
        }
    }

    /**
     * Submit a single outcome. Returns true on success, false on failure.
     */
    async function submitOne(predictionId, outcomeData) {
        const rest = getRestConfig();
        const payload = Object.assign({ prediction_id: predictionId }, outcomeData);

        try {
            const response = await fetch(rest.baseUrl + 'outcomes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': rest.nonce
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // 409 = already captured, treat as success
                if (response.status === 409) return true;
                const err = await response.json().catch(function() { return {}; });
                throw new Error(err.error || 'HTTP ' + response.status);
            }
            return true;
        } catch (err) {
            warn('Submit failed for prediction ' + predictionId + ':', err);
            return false;
        }
    }

    /**
     * Submit outcomes for multiple predictions.
     * Checks _overrides for individual values, falls back to provided default.
     */
    async function submitBatch(predictionIds, defaultOutcome, progressCallback) {
        let succeeded = 0;
        let failed = 0;

        for (let i = 0; i < predictionIds.length; i++) {
            const id = predictionIds[i];
            const data = _overrides[id] || defaultOutcome;
            const ok = await submitOne(id, data);
            if (ok) succeeded++;
            else failed++;

            if (progressCallback) {
                progressCallback(i + 1, predictionIds.length, succeeded, failed);
            }
        }

        return { succeeded: succeeded, failed: failed };
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + months[d.getMonth()];
    }

    function daysAgo(isoString) {
        if (!isoString) return '';
        const diff = Math.floor((new Date() - new Date(isoString)) / 86400000);
        if (diff === 0) return 'today';
        if (diff === 1) return '1 day ago';
        return diff + ' days ago';
    }

    function groupByModule(predictions) {
        const groups = {};
        predictions.forEach(function(p) {
            var mod = p.module || 'other';
            if (!groups[mod]) groups[mod] = [];
            groups[mod].push(p);
        });
        return groups;
    }

    // =========================================================================
    // STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-outcome-capture-styles')) return;

        var css = [
'/* OUTCOME CAPTURE UI v1.1.0 */',
'',
'#' + CONFIG.containerId + ' { margin-bottom: 16px; }',
'',
'/* Summary bar */',
'.gaip-oc-summary {',
'  display:flex; align-items:center; gap:10px;',
'  padding:12px 16px; background:var(--gaip-warning-bg); border:1px solid var(--gaip-warning-border);',
'  border-radius:var(--gaip-radius,10px); cursor:pointer;',
'  transition:all .15s; user-select:none;',
'}',
'.gaip-oc-summary:hover { background:var(--gaip-warning-bg); border-color:#f59e0b; }',
'.gaip-oc-summary.gaip-oc-empty {',
'  background:var(--gaip-good-bg); border-color:var(--gaip-good-bg); cursor:default;',
'}',
'.gaip-oc-summary-icon { font-size:20px; flex-shrink:0; }',
'.gaip-oc-summary-text { flex:1; font-size:14px; font-weight:500; color:#92400e; }',
'.gaip-oc-summary.gaip-oc-empty .gaip-oc-summary-text { color:#166534; }',
'.gaip-oc-summary-count {',
'  min-width:24px; height:24px; padding:0 7px;',
'  background:#f59e0b; color:var(--gaip-surface); font-size:12px; font-weight:700;',
'  line-height:24px; text-align:center; border-radius:12px; flex-shrink:0;',
'}',
'.gaip-oc-summary-chevron {',
'  font-size:12px; color:var(--gaip-text-muted); transition:transform .2s; flex-shrink:0;',
'}',
'.gaip-oc-summary-chevron.expanded { transform:rotate(180deg); }',
'',
'/* Expanded body */',
'.gaip-oc-body { display:none; padding:12px 0 0; }',
'.gaip-oc-body.visible { display:block; }',
'',
'/* Quick action bar */',
'.gaip-oc-quick-bar {',
'  display:flex; align-items:center; gap:10px; flex-wrap:wrap;',
'  padding:12px 16px; margin-bottom:12px;',
'  background:var(--gaip-surface-muted); border:1px solid var(--gaip-border); border-radius:var(--gaip-radius,10px);',
'}',
'.gaip-oc-quick-label {',
'  font-size:13px; font-weight:500; color:var(--gaip-text-secondary); white-space:nowrap;',
'}',
'.gaip-oc-quick-btn {',
'  display:inline-flex; align-items:center; gap:5px;',
'  padding:7px 16px; border:1px solid var(--gaip-border); border-radius:8px;',
'  background:var(--gaip-surface); font-size:13px; font-weight:600; color:#334155;',
'  cursor:pointer; transition:all .15s; white-space:nowrap;',
'}',
'.gaip-oc-quick-btn:hover { border-color:var(--gaip-text-muted); background:var(--gaip-surface-hover); }',
'.gaip-oc-quick-btn.primary {',
'  background:var(--gaip-accent,#2d7a4f); color:var(--gaip-surface); border-color:var(--gaip-accent,#2d7a4f);',
'}',
'.gaip-oc-quick-btn.primary:hover { background:var(--gaip-accent-hover,var(--gaip-accent-hover)); }',
'.gaip-oc-quick-btn:disabled { opacity:.5; cursor:not-allowed; }',
'',
'/* Progress bar */',
'.gaip-oc-progress { display:none; align-items:center; gap:10px; padding:8px 0; }',
'.gaip-oc-progress.visible { display:flex; }',
'.gaip-oc-progress-bar {',
'  flex:1; height:6px; background:var(--gaip-border); border-radius:3px; overflow:hidden;',
'}',
'.gaip-oc-progress-fill {',
'  height:100%; background:var(--gaip-accent,#2d7a4f);',
'  border-radius:3px; transition:width .2s; width:0;',
'}',
'.gaip-oc-progress-text { font-size:12px; color:var(--gaip-text-secondary); white-space:nowrap; }',
'',
'/* Module group */',
'.gaip-oc-module {',
'  background:var(--gaip-surface); border:1px solid var(--gaip-border);',
'  border-radius:var(--gaip-radius,10px); margin-bottom:8px;',
'  overflow:hidden;',
'}',
'.gaip-oc-module-header {',
'  display:flex; align-items:center; gap:8px; flex-wrap:wrap;',
'  padding:12px 16px;',
'}',
'.gaip-oc-module-icon { font-size:16px; }',
'.gaip-oc-module-label { font-size:14px; font-weight:600; color:var(--gaip-text); }',
'.gaip-oc-module-count {',
'  font-size:12px; color:var(--gaip-text-secondary); font-weight:400; margin-right:auto;',
'}',
'',
'/* Qualitative buttons (shared between module header and individual rows) */',
'.gaip-oc-qual-btns { display:flex; gap:4px; flex-wrap:wrap; }',
'.gaip-oc-qual-btn {',
'  display:inline-flex; align-items:center; gap:4px;',
'  padding:4px 10px; border:1px solid var(--gaip-border); border-radius:6px;',
'  background:var(--gaip-surface); font-size:12px; color:var(--gaip-text); cursor:pointer;',
'  transition:all .15s; white-space:nowrap;',
'}',
'.gaip-oc-qual-btn:hover { border-color:var(--gaip-text-muted); background:var(--gaip-surface-muted); }',
'.gaip-oc-qual-btn.selected {',
'  border-color:var(--gaip-accent,#2d7a4f);',
'  background:var(--gaip-accent-light,var(--gaip-accent-light));',
'  color:var(--gaip-accent,#2d7a4f); font-weight:600;',
'}',
'.gaip-oc-qual-btn.submitting { opacity:.6; pointer-events:none; }',
'.gaip-oc-qual-btn.done {',
'  border-color:var(--gaip-good-bg); background:var(--gaip-good-bg); color:#166534;',
'  pointer-events:none;',
'}',
'',
'/* Expandable prediction list */',
'.gaip-oc-predictions { display:none; padding:0 16px 12px; }',
'.gaip-oc-predictions.visible { display:block; }',
'.gaip-oc-expand-link {',
'  font-size:12px; color:var(--gaip-text-secondary); cursor:pointer; padding:4px 16px 8px;',
'  display:inline-block;',
'}',
'.gaip-oc-expand-link:hover { color:var(--gaip-accent,#2d7a4f); }',
'',
'/* Individual prediction row */',
'.gaip-oc-pred-row {',
'  display:flex; align-items:center; gap:8px; flex-wrap:wrap;',
'  padding:8px 0; border-top:1px solid var(--gaip-surface-hover);',
'}',
'.gaip-oc-pred-label { flex:1; font-size:13px; color:var(--gaip-text); min-width:180px; }',
'.gaip-oc-pred-meta { font-size:11px; color:var(--gaip-text-muted); }',
'.gaip-oc-pred-override { display:flex; gap:4px; }',
'.gaip-oc-pred-override .gaip-oc-qual-btn { font-size:11px; padding:3px 8px; }',
'.gaip-oc-pred-saved {',
'  font-size:11px; color:#166534; font-weight:600; padding:2px 8px;',
'  background:var(--gaip-good-bg); border:1px solid var(--gaip-good-bg); border-radius:6px;',
'  white-space:nowrap; flex-shrink:0;',
'}',
'.gaip-oc-pred-saving {',
'  font-size:11px; color:var(--gaip-text-muted); padding:2px 8px; white-space:nowrap; flex-shrink:0;',
'}',
'.gaip-oc-pred-error {',
'  font-size:11px; color:#dc2626; padding:2px 8px; white-space:nowrap; flex-shrink:0;',
'}',
'',
'/* Module captured state */',
'.gaip-oc-module.captured { opacity:.5; transition:opacity .3s; }',
'.gaip-oc-module.captured .gaip-oc-qual-btn { pointer-events:none; }',
'',
'/* Status */',
'.gaip-oc-status { font-size:12px; color:var(--gaip-text-secondary); padding:2px 8px; }',
'.gaip-oc-status.error { color:#dc2626; }',
'',
'@media (max-width:640px) {',
'  .gaip-oc-quick-bar { flex-direction:column; align-items:stretch; }',
'  .gaip-oc-qual-btns { justify-content:center; }',
'  .gaip-oc-module-header { flex-direction:column; align-items:flex-start; gap:10px; }',
'  .gaip-oc-module-count { margin-right:0; }',
'}'
        ].join('\n');

        var style = document.createElement('style');
        style.id = 'gaip-outcome-capture-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    function buildSummaryBar(count) {
        var bar = document.createElement('div');
        bar.className = 'gaip-oc-summary' + (count === 0 ? ' gaip-oc-empty' : '');
        bar.id = 'gaip-oc-summary';

        if (count === 0) {
            bar.innerHTML =
                '<span class="gaip-oc-summary-icon">✅</span>' +
                '<span class="gaip-oc-summary-text">No predictions awaiting review</span>';
        } else {
            bar.innerHTML =
                '<span class="gaip-oc-summary-icon">📋</span>' +
                '<span class="gaip-oc-summary-text">' +
                    count + ' prediction' + (count !== 1 ? 's' : '') +
                    ' ready for outcome review' +
                '</span>' +
                '<span class="gaip-oc-summary-count">' + count + '</span>' +
                '<span class="gaip-oc-summary-chevron" id="gaip-oc-chevron">▼</span>';
            bar.addEventListener('click', toggleExpanded);
        }

        return bar;
    }

    function buildQuickBar() {
        var bar = document.createElement('div');
        bar.className = 'gaip-oc-quick-bar';
        bar.id = 'gaip-oc-quick-bar';

        bar.innerHTML =
            '<span class="gaip-oc-quick-label">Quick review:</span>' +
            '<button class="gaip-oc-quick-btn primary" id="gaip-oc-all-expected">' +
                '🎯 All tracked as expected' +
            '</button>' +
            '<button class="gaip-oc-quick-btn" id="gaip-oc-dismiss-all">' +
                'Skip all for now' +
            '</button>' +
            '<div class="gaip-oc-progress" id="gaip-oc-progress">' +
                '<div class="gaip-oc-progress-bar">' +
                    '<div class="gaip-oc-progress-fill" id="gaip-oc-progress-fill"></div>' +
                '</div>' +
                '<span class="gaip-oc-progress-text" id="gaip-oc-progress-text"></span>' +
            '</div>';

        bar.querySelector('#gaip-oc-all-expected').addEventListener('click', handleAllAsExpected);
        bar.querySelector('#gaip-oc-dismiss-all').addEventListener('click', handleDismissAll);

        return bar;
    }

    function buildModuleGroup(moduleName, predictions) {
        var modConfig = CONFIG.moduleLabels[moduleName] || { icon: '📊', label: moduleName };
        var group = document.createElement('div');
        group.className = 'gaip-oc-module';
        group.id = 'gaip-oc-module-' + moduleName;
        group.dataset.module = moduleName;

        // --- Header with inline qualitative buttons ---
        var header = document.createElement('div');
        header.className = 'gaip-oc-module-header';

        var qualBtnsHtml = '<div class="gaip-oc-qual-btns" data-module="' + moduleName + '">';
        CONFIG.qualitativeOptions.forEach(function(opt) {
            qualBtnsHtml +=
                '<button class="gaip-oc-qual-btn" data-value="' + opt.value +
                '" data-module="' + moduleName + '">' +
                    opt.icon + ' ' + opt.label +
                '</button>';
        });
        qualBtnsHtml += '</div>';

        header.innerHTML =
            '<span class="gaip-oc-module-icon">' + modConfig.icon + '</span>' +
            '<span class="gaip-oc-module-label">' + modConfig.label + '</span>' +
            '<span class="gaip-oc-module-count">(' + predictions.length + ')</span>' +
            qualBtnsHtml +
            '<span class="gaip-oc-status" id="gaip-oc-mod-status-' + moduleName + '"></span>';

        group.appendChild(header);

        // Wire module-level qualitative buttons
        header.querySelectorAll('.gaip-oc-qual-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                handleModuleBatch(moduleName, btn.dataset.value);
            });
        });

        // --- Expand link for individual overrides ---
        var expandLink = document.createElement('div');
        expandLink.className = 'gaip-oc-expand-link';
        expandLink.textContent = '▸ Show individual predictions to override';
        expandLink.addEventListener('click', function() {
            var predList = document.getElementById('gaip-oc-preds-' + moduleName);
            if (!predList) return;
            var isVis = predList.classList.contains('visible');
            predList.classList.toggle('visible', !isVis);
            expandLink.textContent = isVis
                ? '▸ Show individual predictions to override'
                : '▾ Hide individual predictions';
        });
        group.appendChild(expandLink);

        // --- Individual prediction rows ---
        var predList = document.createElement('div');
        predList.className = 'gaip-oc-predictions';
        predList.id = 'gaip-oc-preds-' + moduleName;

        predictions.forEach(function(pred) {
            var row = document.createElement('div');
            row.className = 'gaip-oc-pred-row';
            row.id = 'gaip-oc-pred-' + pred.id;

            var overrideBtns = '<div class="gaip-oc-pred-override">';
            CONFIG.qualitativeOptions.forEach(function(opt) {
                overrideBtns +=
                    '<button class="gaip-oc-qual-btn" data-value="' + opt.value +
                    '" data-pred-id="' + pred.id + '" title="' + opt.label + '">' +
                        opt.icon +
                    '</button>';
            });
            overrideBtns += '</div>';

            row.innerHTML =
                '<span class="gaip-oc-pred-label">' +
                    escapeHtml(pred.predicted_label || pred.sub_key) +
                '</span>' +
                '<span class="gaip-oc-pred-meta">' + formatDate(pred.predicted_at) +
                    ' (' + daysAgo(pred.predicted_at) + ')' +
                '</span>' +
                overrideBtns +
                '<span class="gaip-oc-pred-status"></span>';

            // Wire individual override buttons — b35fix138: submit immediately on click,
            // show inline saved/error state. No longer requires module batch to submit.
            row.querySelectorAll('.gaip-oc-qual-btn').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    if (btn.disabled) return;
                    var predId = btn.dataset.predId;
                    var overrideDiv = btn.closest('.gaip-oc-pred-override');
                    var allBtns = overrideDiv ? overrideDiv.querySelectorAll('.gaip-oc-qual-btn') : [];

                    // Visual: mark selected, disable all buttons in row
                    allBtns.forEach(function(s) { s.classList.remove('selected'); s.disabled = true; });
                    btn.classList.add('selected');

                    // Show saving indicator
                    var statusEl = row.querySelector('.gaip-oc-pred-status');
                    if (statusEl) { statusEl.className = 'gaip-oc-pred-saving'; statusEl.textContent = 'Saving…'; }

                    // Submit immediately
                    var outcome = { qualitative: btn.dataset.value, action_taken: 'not_applicable' };
                    _overrides[predId] = outcome;
                    var ok = await submitOne(predId, outcome);

                    if (ok) {
                        if (statusEl) { statusEl.className = 'gaip-oc-pred-saved'; statusEl.textContent = '✓ Saved'; }
                        // Remove from pending list
                        _pendingPredictions = _pendingPredictions.filter(function(p) { return p.id != predId; });
                        updateSummaryCount();
                        if (_pendingPredictions.length === 0) setTimeout(renderComplete, 600);
                    } else {
                        // Re-enable on failure so user can retry
                        if (statusEl) { statusEl.className = 'gaip-oc-pred-error'; statusEl.textContent = '✗ Failed — retry'; }
                        allBtns.forEach(function(s) { s.disabled = false; });
                        btn.classList.remove('selected');
                        delete _overrides[predId];
                    }
                });
            });

            predList.appendChild(row);
        });

        group.appendChild(predList);
        return group;
    }

    function buildBody(predictions) {
        var body = document.createElement('div');
        body.className = 'gaip-oc-body';
        body.id = 'gaip-oc-body';

        body.appendChild(buildQuickBar());

        var groups = groupByModule(predictions);

        CONFIG.moduleOrder.forEach(function(mod) {
            if (!groups[mod] || groups[mod].length === 0) return;
            body.appendChild(buildModuleGroup(mod, groups[mod]));
        });

        // Any modules not in the predefined order
        Object.keys(groups).forEach(function(mod) {
            if (CONFIG.moduleOrder.indexOf(mod) === -1 && groups[mod].length > 0) {
                body.appendChild(buildModuleGroup(mod, groups[mod]));
            }
        });

        return body;
    }

    // =========================================================================
    // ACTIONS
    // =========================================================================

    function toggleExpanded() {
        _isExpanded = !_isExpanded;
        var body = document.getElementById('gaip-oc-body');
        var chevron = document.getElementById('gaip-oc-chevron');
        if (body) body.classList.toggle('visible', _isExpanded);
        if (chevron) chevron.classList.toggle('expanded', _isExpanded);
    }

    /**
     * "All tracked as expected" — submit every pending prediction
     */
    async function handleAllAsExpected() {
        if (_isSubmitting) return;
        _isSubmitting = true;

        var allIds = _pendingPredictions.map(function(p) { return p.id; });
        var defaultOutcome = {
            qualitative: 'as_expected',
            action_taken: 'not_applicable'
        };

        setQuickBarEnabled(false);
        showProgress(true);

        var result = await submitBatch(allIds, defaultOutcome, function(done, total) {
            updateProgress(done, total);
        });

        log('All-as-expected complete:', result);

        if (result.failed === 0) {
            _pendingPredictions = [];
            renderComplete();
        } else {
            showProgress(false);
            setQuickBarEnabled(true);
            await loadAndRender();
        }

        _isSubmitting = false;
    }

    /**
     * Module-level batch — submit all predictions in a module
     */
    async function handleModuleBatch(moduleName, qualitative) {
        if (_isSubmitting) return;
        _isSubmitting = true;

        var modulePreds = _pendingPredictions.filter(function(p) { return p.module === moduleName; });
        var ids = modulePreds.map(function(p) { return p.id; });

        if (ids.length === 0) {
            _isSubmitting = false;
            return;
        }

        var outcomeData = {
            qualitative: qualitative,
            action_taken: 'not_applicable'
        };

        // Visual feedback
        var group = document.getElementById('gaip-oc-module-' + moduleName);
        var btns = group ? group.querySelectorAll('.gaip-oc-module-header .gaip-oc-qual-btn') : [];
        btns.forEach(function(btn) {
            if (btn.dataset.value === qualitative) btn.classList.add('submitting');
        });
        setModuleStatus(moduleName, 'Saving ' + ids.length + '...');

        var result = await submitBatch(ids, outcomeData);

        if (result.failed === 0) {
            // Mark module done
            btns.forEach(function(btn) {
                btn.classList.remove('submitting');
                if (btn.dataset.value === qualitative) btn.classList.add('done');
            });
            if (group) group.classList.add('captured');
            setModuleStatus(moduleName, '✓ ' + result.succeeded + ' captured');

            _pendingPredictions = _pendingPredictions.filter(function(p) {
                return p.module !== moduleName;
            });
            updateSummaryCount();

            if (_pendingPredictions.length === 0) {
                setTimeout(renderComplete, 600);
            }
        } else {
            btns.forEach(function(btn) { btn.classList.remove('submitting'); });
            setModuleStatus(moduleName, result.failed + ' failed', true);
        }

        _isSubmitting = false;
    }

    function handleDismissAll() {
        _isExpanded = false;
        var body = document.getElementById('gaip-oc-body');
        var chevron = document.getElementById('gaip-oc-chevron');
        if (body) body.classList.remove('visible');
        if (chevron) chevron.classList.remove('expanded');
    }

    // =========================================================================
    // PROGRESS & STATUS HELPERS
    // =========================================================================

    function showProgress(visible) {
        var el = document.getElementById('gaip-oc-progress');
        if (el) el.classList.toggle('visible', visible);
    }

    function updateProgress(done, total) {
        var fill = document.getElementById('gaip-oc-progress-fill');
        var text = document.getElementById('gaip-oc-progress-text');
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = done + ' / ' + total;
    }

    function setQuickBarEnabled(enabled) {
        var bar = document.getElementById('gaip-oc-quick-bar');
        if (!bar) return;
        bar.querySelectorAll('button').forEach(function(btn) {
            btn.disabled = !enabled;
        });
    }

    function setModuleStatus(moduleName, msg, isError) {
        var el = document.getElementById('gaip-oc-mod-status-' + moduleName);
        if (!el) return;
        el.textContent = msg;
        el.className = 'gaip-oc-status' + (isError ? ' error' : '');
    }

    function updateSummaryCount() {
        var count = _pendingPredictions.length;
        var countEl = document.querySelector('.gaip-oc-summary-count');
        var textEl = document.querySelector('.gaip-oc-summary-text');
        if (countEl) countEl.textContent = count;
        if (textEl) {
            textEl.textContent = count + ' prediction' + (count !== 1 ? 's' : '') +
                ' ready for outcome review';
        }
        updateBadge();
    }

    function renderComplete() {
        var summary = document.getElementById('gaip-oc-summary');
        if (summary) {
            summary.className = 'gaip-oc-summary gaip-oc-empty';
            summary.innerHTML =
                '<span class="gaip-oc-summary-icon">✅</span>' +
                '<span class="gaip-oc-summary-text">All predictions reviewed</span>';
            summary.removeEventListener('click', toggleExpanded);
        }
        var body = document.getElementById('gaip-oc-body');
        if (body) body.classList.remove('visible');
        updateBadge();
    }

    function updateBadge() {
        var badge = document.getElementById('gaip-tab-badge-today');
        if (!badge) return;
        var count = _pendingPredictions.length;
        if (count > 0) {
            badge.textContent = count;
            badge.style.cssText = '';
            badge.classList.add('visible');
        }
    }

    // =========================================================================
    // MOUNT
    // =========================================================================

    function mount(predictions) {
        _pendingPredictions = predictions;
        _overrides = {};

        var existing = document.getElementById(CONFIG.containerId);
        if (existing) existing.remove();

        _container = document.createElement('div');
        _container.id = CONFIG.containerId;

        _container.appendChild(buildSummaryBar(predictions.length));

        if (predictions.length > 0) {
            _container.appendChild(buildBody(predictions));
        }

        // Insert before daily dashboard
        var dashboard = document.getElementById('gaip-daily-dashboard');
        if (dashboard && dashboard.parentNode) {
            dashboard.parentNode.insertBefore(_container, dashboard);
        } else {
            var hub = document.getElementById('gaip-hub');
            if (hub) {
                var first = hub.querySelector('.gaip-inputs-section, .gaip-result-cards, .gaip-grid');
                if (first) hub.insertBefore(_container, first);
                else hub.appendChild(_container);
            }
        }

        updateBadge();
        log('Mounted with ' + predictions.length + ' pending predictions');
    }

    // =========================================================================
    // LOAD & INIT
    // =========================================================================

    async function loadAndRender() {
        if (_isLoading) return;
        _isLoading = true;
        try {
            var predictions = await fetchPending();
            mount(predictions);
        } catch (err) {
            warn('loadAndRender failed:', err);
        } finally {
            _isLoading = false;
        }
    }

    /** Debounced reload — collapses near-simultaneous events into one fetch */
    function debouncedReload() {
        if (_loadTimer) clearTimeout(_loadTimer);
        _loadTimer = setTimeout(loadAndRender, 3000);
    }

    function init() {
        injectStyles();
        setTimeout(loadAndRender, 2000);

        document.addEventListener('gaip:cascade-complete', debouncedReload);
        document.addEventListener('gaip:disease-updated', debouncedReload);

        log('Outcome Capture UI initialized', { version: CONFIG.version });
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaOutcomeCapture = {
        version: CONFIG.version,
        init: init,
        refresh: loadAndRender,
        getPendingCount: function() { return _pendingPredictions.length; },
        setDebug: function(enabled) { CONFIG.debug = enabled; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(typeof window !== 'undefined' ? window : this);
