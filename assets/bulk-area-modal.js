/**
 * =============================================================================
 * GILBA HUB — BULK AREA MODAL (b35fix311)
 * =============================================================================
 *
 * Lets the user assign area (ha) to multiple soil samples at once. Essential
 * at council scale: a parks manager with 121 pitches grouped into 20 precincts
 * doesn't want to edit each sample individually. The modal groups samples by
 * zone type (green/fairway/sports_pitch/etc.), accepts one area value per zone
 * type OR per-sample overrides, and applies in one commit.
 *
 * UX flow:
 *   1. Click 📐 Set area… from the sample switcher
 *   2. Modal opens with samples grouped by zone type
 *   3. Enter a single "apply to all in group" area, OR tick individual samples
 *      and override per-sample
 *   4. Preview shows before/after for each sample
 *   5. Click "Apply to N samples" — commits via GAIP_SampleManager.updateSample
 *   6. Modal closes, sample switcher refreshes, one gaip:sample-updated event
 *      per touched sample
 *
 * Exposes:
 *   global.GaipBulkAreaModal.open(dataType, wrapper)
 *   global.GaipBulkAreaModal.close()
 *
 * @author Gilba Solutions
 * @version 1.0.0 (b35fix311)
 * =============================================================================
 */

(function(global) {
    'use strict';

    const MODAL_ID = 'gaip-bulk-area-modal';
    let _lastWrapper = null;  // stashed so updateSampleSelector can refresh post-commit

    /**
     * b35fix311_1: area guidance now lives on GAIP_SampleManager as the single
     * source of truth (previously duplicated here and in sample-manager.js with
     * a "keep in sync" comment). If SampleManager isn't loaded yet — e.g.
     * enqueue order regression — fall back to a bare-minimum placeholder table
     * so the modal still renders. The fallback labels are friendly but the
     * placeholders/examples come from SampleManager when available.
     */
    function _guidance(zoneType) {
        const sm = global.GAIP_SampleManager;
        if (sm && typeof sm.getAreaGuidance === 'function') {
            const g = sm.getAreaGuidance(zoneType);
            // SampleManager entry has placeholder/minHa/maxHa/example — add a
            // human-readable label for the modal's group heading.
            return {
                label: FALLBACK_LABELS[zoneType] || FALLBACK_LABELS.other,
                placeholder: g.placeholder,
                example: g.example
            };
        }
        return Object.assign(
            { label: FALLBACK_LABELS[zoneType] || FALLBACK_LABELS.other },
            FALLBACK_GUIDANCE[zoneType] || FALLBACK_GUIDANCE.other
        );
    }

    // Labels for the modal's group headings (plural forms for the UI).
    // These are modal-specific — SampleManager only stores per-sample placeholder
    // and range, not a plural label string.
    const FALLBACK_LABELS = {
        green: 'Greens', fairway: 'Fairways', tee: 'Tees', rough: 'Rough',
        approach: 'Approaches', collar: 'Collars', bunker: 'Bunkers',
        sports_pitch: 'Sports pitches', goal_area: 'Goal areas',
        centre: 'Centres', other: 'Other'
    };

    // Minimal fallback used only if SampleManager.getAreaGuidance is unavailable
    // at render time. Keeps the modal functional; production should never use
    // this path.
    const FALLBACK_GUIDANCE = {
        green:        { placeholder: '0.06', example: 'typical golf green' },
        fairway:      { placeholder: '2.5',  example: 'typical fairway' },
        sports_pitch: { placeholder: '0.7',  example: 'soccer ~0.7, AFL ~1.4' },
        other:        { placeholder: '0.5',  example: 'varies' }
    };

    function _ensureModalEl() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'gaip-bulk-area-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'gaip-bulk-area-title');
        modal.style.display = 'none';
        document.body.appendChild(modal);
        return modal;
    }

    function _close() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.style.display = 'none';
    }

    /**
     * Build the modal content for the given soil samples, grouped by zone type.
     * Pure render — no side effects beyond setting innerHTML.
     */
    function _render(modal, samples) {
        // Group by zone type, preserving insertion order (samples already sorted)
        const grouped = {};
        samples.forEach(function(s) {
            const zt = s.zoneType || 'other';
            if (!grouped[zt]) grouped[zt] = [];
            grouped[zt].push(s);
        });
        const zoneTypes = Object.keys(grouped);

        // Count samples missing area (for the header)
        const missing = samples.filter(function(s) {
            const ha = s.rawData && s.rawData.areaHa;
            return !(ha != null && isFinite(ha) && ha > 0);
        }).length;

        const groupsHtml = zoneTypes.map(function(zt) {
            const g = _guidance(zt);
            const rowsHtml = grouped[zt].map(function(s) {
                const currentHa = s.rawData && s.rawData.areaHa;
                const currentDisplay = (currentHa != null && isFinite(currentHa) && currentHa > 0)
                    ? parseFloat(currentHa).toFixed(3).replace(/\.?0+$/, '') + ' ha'
                    : '\u2014';
                const badge = (currentHa != null && isFinite(currentHa) && currentHa > 0)
                    ? '<span class="gaip-bulk-badge gaip-bulk-badge-set">set</span>'
                    : '<span class="gaip-bulk-badge gaip-bulk-badge-missing">missing</span>';
                return '<tr data-sample-id="' + _escapeHtmlAttr(s.id) + '">' +
                    '<td><input type="checkbox" class="gaip-bulk-row-check" checked aria-label="Include this sample"></td>' +
                    '<td class="gaip-bulk-sample-label">' + _escapeHtml(s.label || s.id) + ' ' + badge + '</td>' +
                    '<td class="gaip-bulk-current">' + currentDisplay + '</td>' +
                    '<td><input type="number" step="0.01" min="0" class="gaip-bulk-row-area" ' +
                    'placeholder="per-sample override" aria-label="Override area for this sample"></td>' +
                '</tr>';
            }).join('');

            return '<section class="gaip-bulk-group" data-zone-type="' + _escapeHtmlAttr(zt) + '">' +
                '<header class="gaip-bulk-group-head">' +
                    '<h4 class="gaip-bulk-group-title">' + _escapeHtml(g.label) +
                    ' <span class="gaip-bulk-group-count">(' + grouped[zt].length + ')</span></h4>' +
                    '<label class="gaip-bulk-group-all">' +
                        'Apply to all in group: ' +
                        '<input type="number" step="0.01" min="0" class="gaip-bulk-group-area" ' +
                        'placeholder="e.g. ' + g.placeholder + '" aria-label="Area for all ' + _escapeHtmlAttr(g.label) + '"> ha' +
                    '</label>' +
                    '<span class="gaip-bulk-group-hint">' + _escapeHtml(g.example) + '</span>' +
                '</header>' +
                '<table class="gaip-bulk-table">' +
                    '<thead><tr>' +
                        '<th style="width:28px;"><input type="checkbox" class="gaip-bulk-group-check" checked aria-label="Include all in group"></th>' +
                        '<th>Sample</th>' +
                        '<th style="width:100px;">Current</th>' +
                        '<th style="width:170px;">Override (optional)</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                '</table>' +
            '</section>';
        }).join('');

        modal.innerHTML =
            '<div class="gaip-bulk-dialog" role="document">' +
                '<header class="gaip-bulk-dialog-head">' +
                    '<h3 id="gaip-bulk-area-title" class="gaip-bulk-dialog-title">' +
                        'Set area (ha) in bulk' +
                    '</h3>' +
                    '<button type="button" class="gaip-bulk-close" aria-label="Close">&times;</button>' +
                '</header>' +
                '<div class="gaip-bulk-intro">' +
                    '<p>' +
                        samples.length + ' soil sample' + (samples.length === 1 ? '' : 's') + ' across ' +
                        zoneTypes.length + ' zone type' + (zoneTypes.length === 1 ? '' : 's') + '. ' +
                        (missing > 0
                            ? '<strong>' + missing + ' missing area data.</strong> '
                            : 'All samples have area set. ') +
                        'Set a value for an entire group, or override specific samples. Uncheck any sample to skip it.' +
                    '</p>' +
                '</div>' +
                '<div class="gaip-bulk-groups">' + groupsHtml + '</div>' +
                '<footer class="gaip-bulk-dialog-foot">' +
                    '<span class="gaip-bulk-status" aria-live="polite"></span>' +
                    '<button type="button" class="gaip-bulk-cancel">Cancel</button>' +
                    '<button type="button" class="gaip-bulk-apply">Apply to selected</button>' +
                '</footer>' +
            '</div>';
    }

    function _escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function _escapeHtmlAttr(s) { return _escapeHtml(s); }

    /**
     * Compute the effective area for each sample given the current modal state.
     * Per-sample override beats group value. Unchecked rows are skipped.
     */
    function _collectAssignments(modal) {
        const assignments = [];
        const groups = modal.querySelectorAll('.gaip-bulk-group');
        groups.forEach(function(groupEl) {
            const groupAreaInput = groupEl.querySelector('.gaip-bulk-group-area');
            const groupArea = parseFloat(groupAreaInput.value);
            const hasGroupArea = isFinite(groupArea) && groupArea > 0;

            const rows = groupEl.querySelectorAll('tr[data-sample-id]');
            rows.forEach(function(rowEl) {
                const check = rowEl.querySelector('.gaip-bulk-row-check');
                if (!check || !check.checked) return;   // skipped
                const override = parseFloat(rowEl.querySelector('.gaip-bulk-row-area').value);
                const hasOverride = isFinite(override) && override > 0;
                let finalArea = null;
                if (hasOverride) finalArea = override;
                else if (hasGroupArea) finalArea = groupArea;
                if (finalArea != null) {
                    assignments.push({
                        sampleId: rowEl.getAttribute('data-sample-id'),
                        areaHa: finalArea
                    });
                }
            });
        });
        return assignments;
    }

    function _wireHandlers(modal, dataType) {
        // Close via X, Cancel, or backdrop click
        modal.querySelector('.gaip-bulk-close').onclick = _close;
        modal.querySelector('.gaip-bulk-cancel').onclick = _close;
        modal.onclick = function(e) { if (e.target === modal) _close(); };

        // Group-level check toggles all rows in its group
        modal.querySelectorAll('.gaip-bulk-group').forEach(function(groupEl) {
            const groupCheck = groupEl.querySelector('.gaip-bulk-group-check');
            if (groupCheck) {
                groupCheck.onchange = function() {
                    groupEl.querySelectorAll('.gaip-bulk-row-check').forEach(function(c) {
                        c.checked = groupCheck.checked;
                    });
                };
            }
        });

        // Apply
        modal.querySelector('.gaip-bulk-apply').onclick = function() {
            const status = modal.querySelector('.gaip-bulk-status');
            const assignments = _collectAssignments(modal);
            if (assignments.length === 0) {
                status.textContent = 'Nothing to apply — enter a group value or per-sample override.';
                status.className = 'gaip-bulk-status gaip-bulk-status-warn';
                return;
            }

            const sm = global.GAIP_SampleManager;
            if (!sm || typeof sm.updateSample !== 'function') {
                status.textContent = 'SampleManager unavailable — cannot apply.';
                status.className = 'gaip-bulk-status gaip-bulk-status-error';
                return;
            }

            let applied = 0;
            let failed = 0;
            assignments.forEach(function(a) {
                try {
                    // updateSample merges the passed object into sample.rawData.
                    // Pass { areaHa } at top level — NOT nested under rawData.
                    const result = sm.updateSample(dataType, a.sampleId, { areaHa: a.areaHa });
                    if (result) applied++;
                    else failed++;
                } catch (err) {
                    console.warn('[BulkAreaModal] updateSample failed for', a.sampleId, err);
                    failed++;
                }
            });

            status.textContent = 'Applied to ' + applied + ' sample' + (applied === 1 ? '' : 's') +
                                 (failed > 0 ? ' (' + failed + ' failed)' : '') + '.';
            status.className = 'gaip-bulk-status ' +
                               (failed === 0 ? 'gaip-bulk-status-ok' : 'gaip-bulk-status-warn');

            // Refresh happens via gaip:bulk-area-applied event listener in
            // sample-switcher-ui.js — no direct coupling needed.
            document.dispatchEvent(new CustomEvent('gaip:bulk-area-applied', {
                detail: { dataType, applied, failed, assignments }
            }));

            // Close after a short pause so the user sees the status
            setTimeout(_close, failed === 0 ? 600 : 1500);
        };
    }

    /**
     * Open the modal for the given dataType (soil only for now) and cache the
     * sample-switcher wrapper that triggered it so we can refresh it on commit.
     */
    function open(dataType, triggerWrapper) {
        if (dataType !== 'soil') {
            console.warn('[BulkAreaModal] open() called with non-soil dataType:', dataType);
            return;
        }
        const sm = global.GAIP_SampleManager;
        if (!sm || typeof sm.getSamples !== 'function') {
            console.warn('[BulkAreaModal] GAIP_SampleManager not available');
            return;
        }
        const samples = sm.getSamples(dataType) || [];
        if (samples.length === 0) {
            // No samples — silent no-op. Shouldn't happen because the button
            // is only visible when samples exist, but guard anyway.
            return;
        }
        _lastWrapper = triggerWrapper || null;
        const modal = _ensureModalEl();
        _render(modal, samples);
        _wireHandlers(modal, dataType);
        modal.style.display = 'flex';
        // Focus the first group-area input for keyboard users
        const firstInput = modal.querySelector('.gaip-bulk-group-area');
        if (firstInput) firstInput.focus();
    }

    global.GaipBulkAreaModal = { open: open, close: _close };
})(window);
