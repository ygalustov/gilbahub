/**
 * Bulk Turf Profile Modal — b35fix368
 * ============================================================================
 * Set turf profile (species + companion) across many samples at once. Mirrors
 * the b35fix311 GaipBulkAreaModal pattern: lists all soil samples grouped by
 * zoneType, lets the user set a value at the group level (applies to all in
 * that zone) or per-row (overrides group), and writes via setSampleTurfProfile.
 *
 * Cuts a 45-click council workflow to ~3 clicks.
 *
 * Field set is intentionally minimal: species + companion. Variety, turf type,
 * and sub-category are NOT here — council operators don't track those per-
 * sample. Sports species list filtered to: Couch, Kikuyu, Perennial Ryegrass,
 * Kentucky Bluegrass, Tall Fescue. No paspalum (no AU paspalum sports grounds).
 *
 * Public API:
 *   GaipBulkTurfProfileModal.open(dataType, triggerWrapper)
 *   GaipBulkTurfProfileModal.close()
 *   GaipBulkTurfProfileModal.applyAssignments(dataType, assignments)
 *
 * Pure helpers exposed for testing:
 *   _getSportsSpeciesOptions()
 *   _buildAssignments(rows, groups)
 */
(function (global) {
    'use strict';

    var MODAL_ID = 'gaip-bulk-turf-profile-modal';
    var _lastWrapper = null;

    // =========================================================================
    // PURE HELPERS
    // =========================================================================

    /**
     * Returns the sports-cohort species list, filtered to AU council-relevant
     * species. Reads from GaipTurfProfile.speciesByType.sports if present,
     * otherwise returns a hard-coded fallback list. The hard-coded list omits
     * Seashore Paspalum even when GaipTurfProfile would have included it,
     * because there are no paspalum sports grounds in Australia (paspalum's
     * sports placement is wrong; it belongs to golf greens or coastal lawns).
     */
    function _getSportsSpeciesOptions() {
        var hardcoded = [
            { value: 'Couch',                label: 'Couch (Bermudagrass)',  type: 'C4' },
            { value: 'Kikuyu',               label: 'Kikuyu',                 type: 'C4' },
            { value: 'Perennial Ryegrass',   label: 'Perennial Ryegrass',     type: 'C3' },
            { value: 'Kentucky Bluegrass',   label: 'Kentucky Bluegrass',     type: 'C3' },
            { value: 'Tall Fescue',          label: 'Tall Fescue',            type: 'C3' }
        ];
        var tp = global.GaipTurfProfile;
        if (!tp || !tp.speciesByType || !tp.speciesByType.sports) {
            return hardcoded;
        }
        // Build from GaipTurfProfile.speciesByType.sports BUT filter out
        // paspalum (defensive — even if it ever gets added there, council
        // sports use case excludes it).
        var sports = tp.speciesByType.sports;
        var c4 = sports.c4 || [];
        var c3 = sports.c3 || [];
        var combined = c4.concat(c3).filter(function (s) {
            var v = (s.value || '').toLowerCase();
            return v.indexOf('paspalum') === -1;
        });
        // If the source list is missing one of the council-relevant species
        // (regression guard), fall back to the hard-coded list.
        var hardNames = hardcoded.map(function (h) { return h.value; });
        var combinedNames = combined.map(function (c) { return c.value; });
        var allPresent = hardNames.every(function (n) { return combinedNames.indexOf(n) !== -1; });
        return allPresent ? combined : hardcoded;
    }

    /**
     * Pure: compute the {sampleId, profile} assignments from current modal
     * state. Per-row override beats group value; unchecked rows skipped.
     * If both row AND group are empty for a field, that field is omitted
     * from the profile (rather than written as null).
     *
     * @param {Array<{sampleId, included, rowSpecies, rowCompanion, zoneType}>} rows
     * @param {Object<string, {species, companion}>} groups - keyed by zoneType
     * @returns {Array<{sampleId, profile: {species?, companionSpecies?}}>}
     */
    function _buildAssignments(rows, groups) {
        var out = [];
        groups = groups || {};
        rows = rows || [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!r || !r.included) continue;
            var grp = groups[r.zoneType] || {};
            var species   = (r.rowSpecies   && r.rowSpecies.trim())   || (grp.species   && grp.species.trim())   || '';
            var companion = (r.rowCompanion && r.rowCompanion.trim()) || (grp.companion && grp.companion.trim()) || '';
            // Drop assignment entirely if there's nothing to write
            if (!species && !companion) continue;
            var profile = {};
            if (species)   profile.species          = species;
            if (companion) profile.companionSpecies = companion;
            out.push({ sampleId: r.sampleId, profile: profile });
        }
        return out;
    }

    /**
     * Apply a list of assignments by writing each through SampleManager.
     * Returns {applied, failed} counts. Never throws.
     *
     * b35fix369: auto-enable multi-site turf toggle on the active site if
     * any assignments are about to be applied. Pre-b35fix369 it was possible
     * for a user to set 45 overrides via the bulk modal, then have all of
     * them silently ignored by the engines because the toggle was off for
     * the active site. Surfaced in production: Heathmoor Oval override
     * (Kikuyu) was stored on the sample but the engines saw site-level Couch
     * because isMultiSiteTurfEnabled('demo') was false. The bulk modal is a
     * deliberate council action — applying it is implicit consent that
     * multi-site turf should be on for that site.
     */
    function applyAssignments(dataType, assignments) {
        var applied = 0;
        var failed = 0;
        var sm = global.GAIP_SampleManager;
        if (!sm || typeof sm.setSampleTurfProfile !== 'function') {
            return { applied: 0, failed: (assignments || []).length };
        }
        // b35fix369: if any assignment is about to land, auto-enable the
        // toggle for the active site so the engines actually consume the
        // overrides. No-op when the toggle is already on or when the
        // assignments list is empty.
        if ((assignments || []).length > 0) {
            try {
                var sc = global.GAIP_SiteConfig;
                var siteId = typeof sm.getActiveSiteId === 'function'
                    ? sm.getActiveSiteId() : null;
                if (sc && siteId
                    && typeof sc.isMultiSiteTurfEnabled === 'function'
                    && typeof sc.setMultiSiteTurfEnabled === 'function'
                    && !sc.isMultiSiteTurfEnabled(siteId)) {
                    sc.setMultiSiteTurfEnabled(siteId, true);
                    console.log('[BulkTurfProfileModal] b35fix369: auto-enabled ' +
                        'multi-site turf for "' + siteId + '" because bulk apply ' +
                        'implies the user wants overrides to take effect.');
                }
            } catch (e) { /* defensive — never block apply on toggle error */ }
        }
        (assignments || []).forEach(function (a) {
            try {
                if (!a || !a.sampleId) { failed++; return; }
                // Verify sample exists; setSampleTurfProfile throws on missing
                sm.setSampleTurfProfile(dataType, a.sampleId, a.profile || null);
                applied++;
            } catch (e) {
                failed++;
            }
        });
        return { applied: applied, failed: failed };
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function _ensureModalEl() {
        var modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'gaip-bulk-area-backdrop';   // reuse bulk-area-modal.css backdrop styles
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.style.display = 'none';
        document.body.appendChild(modal);
        return modal;
    }

    function _close() {
        var modal = document.getElementById(MODAL_ID);
        if (modal) modal.style.display = 'none';
    }

    function _zoneLabel(zt) {
        var sm = global.GAIP_SampleManager;
        if (sm && sm.AREA_GUIDANCE && sm.AREA_GUIDANCE[zt] && sm.AREA_GUIDANCE[zt].label) {
            return sm.AREA_GUIDANCE[zt].label;
        }
        // Fallback labels for the council-relevant zones
        var fallback = {
            sports_pitch: 'Sports field',
            goal_area:    'Goal area',
            centre:       'Centre / midfield',
            green:        'Green',
            fairway:      'Fairway',
            tee:          'Tee',
            rough:        'Rough',
            other:        'Other'
        };
        return fallback[zt] || zt;
    }

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function _speciesOptionsHtml(currentValue) {
        var opts = _getSportsSpeciesOptions();
        var html = '<option value="">(no change)</option>';
        for (var i = 0; i < opts.length; i++) {
            var o = opts[i];
            var sel = (currentValue === o.value) ? ' selected' : '';
            html += '<option value="' + _esc(o.value) + '"' + sel + '>' +
                _esc(o.label) + ' (' + _esc(o.type) + ')</option>';
        }
        return html;
    }

    function _render(modal, samples) {
        // Group by zoneType (sports_pitch / goal_area / etc.)
        var grouped = {};
        samples.forEach(function (s) {
            var zt = s.zoneType || 'other';
            if (!grouped[zt]) grouped[zt] = [];
            grouped[zt].push(s);
        });
        var zoneTypes = Object.keys(grouped);

        // Count samples that already carry a turfProfile override
        var withOverride = samples.filter(function (s) { return !!s.turfProfile; }).length;

        var groupsHtml = zoneTypes.map(function (zt) {
            var label = _zoneLabel(zt);
            var rowsHtml = grouped[zt].map(function (s) {
                var existing = s.turfProfile || {};
                var existingDisplay = '';
                if (existing.species) {
                    existingDisplay = _esc(existing.species);
                    if (existing.companionSpecies) {
                        existingDisplay += ' / ' + _esc(existing.companionSpecies);
                    }
                } else {
                    existingDisplay = '\u2014'; // em-dash
                }
                return '<tr data-sample-id="' + _esc(s.id) + '" data-zone-type="' + _esc(zt) + '">' +
                    '<td><input type="checkbox" class="gaip-btp-row-check" checked aria-label="Include this sample"></td>' +
                    '<td class="gaip-bulk-sample-label">' + _esc(s.label || s.id) + '</td>' +
                    '<td class="gaip-bulk-current">' + existingDisplay + '</td>' +
                    '<td>' +
                        '<select class="gaip-btp-row-species" aria-label="Species for this sample">' +
                            _speciesOptionsHtml(existing.species || '') +
                        '</select>' +
                    '</td>' +
                    '<td>' +
                        '<input type="text" class="gaip-btp-row-companion" ' +
                        'placeholder="(no change)" aria-label="Companion species for this sample" ' +
                        'value="' + _esc(existing.companionSpecies || '') + '">' +
                    '</td>' +
                '</tr>';
            }).join('');

            return '<section class="gaip-bulk-group" data-zone-type="' + _esc(zt) + '">' +
                '<header class="gaip-bulk-group-head">' +
                    '<h4 class="gaip-bulk-group-title">' + _esc(label) +
                        ' <span class="gaip-bulk-group-count">(' + grouped[zt].length + ')</span></h4>' +
                    '<div class="gaip-bulk-group-all" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
                        '<span style="font-size:12px;color:var(--gaip-text-secondary,#9ca3af);">Apply to all in group:</span>' +
                        '<select class="gaip-btp-group-species" aria-label="Species for all ' + _esc(label) + '">' +
                            _speciesOptionsHtml('') +
                        '</select>' +
                        '<input type="text" class="gaip-btp-group-companion" ' +
                            'placeholder="companion (optional)" aria-label="Companion for all ' + _esc(label) + '" ' +
                            'style="width:160px;">' +
                    '</div>' +
                '</header>' +
                '<table class="gaip-bulk-table">' +
                    '<thead><tr>' +
                        '<th style="width:28px;"><input type="checkbox" class="gaip-btp-group-check" checked aria-label="Include all in group"></th>' +
                        '<th>Sample</th>' +
                        '<th style="width:140px;">Current override</th>' +
                        '<th style="width:200px;">Species</th>' +
                        '<th style="width:170px;">Companion</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                '</table>' +
            '</section>';
        }).join('');

        modal.innerHTML =
            '<div class="gaip-bulk-dialog" role="document">' +
                '<header class="gaip-bulk-dialog-head">' +
                    '<h3 class="gaip-bulk-dialog-title">' +
                        '🌱 Set turf profile in bulk' +
                    '</h3>' +
                    '<button type="button" class="gaip-bulk-close" aria-label="Close">&times;</button>' +
                '</header>' +
                '<div class="gaip-bulk-intro">' +
                    '<p>' +
                        samples.length + ' soil sample' + (samples.length === 1 ? '' : 's') + ' across ' +
                        zoneTypes.length + ' zone type' + (zoneTypes.length === 1 ? '' : 's') + '. ' +
                        (withOverride > 0
                            ? '<strong>' + withOverride + ' already have an override.</strong> '
                            : '') +
                        'Set values for an entire group, or override specific samples. Uncheck any sample to skip.' +
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

    // =========================================================================
    // COLLECT + WIRE
    // =========================================================================

    function _collectFromDom(modal) {
        var rows = [];
        var groups = {};
        var groupEls = modal.querySelectorAll('.gaip-bulk-group');
        for (var g = 0; g < groupEls.length; g++) {
            var ge = groupEls[g];
            var zt = ge.getAttribute('data-zone-type');
            var grpSpecies = (ge.querySelector('.gaip-btp-group-species') || {}).value || '';
            var grpComp    = (ge.querySelector('.gaip-btp-group-companion') || {}).value || '';
            groups[zt] = { species: grpSpecies, companion: grpComp };
            var rowEls = ge.querySelectorAll('tr[data-sample-id]');
            for (var r = 0; r < rowEls.length; r++) {
                var re = rowEls[r];
                var check = re.querySelector('.gaip-btp-row-check');
                rows.push({
                    sampleId: re.getAttribute('data-sample-id'),
                    included: !!(check && check.checked),
                    rowSpecies:   (re.querySelector('.gaip-btp-row-species')   || {}).value || '',
                    rowCompanion: (re.querySelector('.gaip-btp-row-companion') || {}).value || '',
                    zoneType: zt
                });
            }
        }
        return { rows: rows, groups: groups };
    }

    function _wire(modal, dataType) {
        modal.querySelector('.gaip-bulk-close').onclick = _close;
        modal.querySelector('.gaip-bulk-cancel').onclick = _close;
        modal.onclick = function (e) { if (e.target === modal) _close(); };

        // Group check toggles all rows in its group
        var groupEls = modal.querySelectorAll('.gaip-bulk-group');
        for (var g = 0; g < groupEls.length; g++) {
            (function (ge) {
                var groupCheck = ge.querySelector('.gaip-btp-group-check');
                if (groupCheck) {
                    groupCheck.onchange = function () {
                        var rowChecks = ge.querySelectorAll('.gaip-btp-row-check');
                        for (var k = 0; k < rowChecks.length; k++) {
                            rowChecks[k].checked = groupCheck.checked;
                        }
                    };
                }
            })(groupEls[g]);
        }

        // Apply
        modal.querySelector('.gaip-bulk-apply').onclick = function () {
            var status = modal.querySelector('.gaip-bulk-status');
            var collected = _collectFromDom(modal);
            var assignments = _buildAssignments(collected.rows, collected.groups);
            if (assignments.length === 0) {
                status.textContent = 'Nothing to apply — set a group species or per-row override.';
                status.className = 'gaip-bulk-status gaip-bulk-status-warn';
                return;
            }
            var result = applyAssignments(dataType, assignments);
            status.textContent = 'Applied to ' + result.applied + ' sample' +
                (result.applied === 1 ? '' : 's') +
                (result.failed > 0 ? ' (' + result.failed + ' failed)' : '') + '.';
            status.className = 'gaip-bulk-status ' +
                (result.failed === 0 ? 'gaip-bulk-status-ok' : 'gaip-bulk-status-warn');
            document.dispatchEvent(new CustomEvent('gaip:bulk-turf-profile-applied', {
                detail: { dataType: dataType, applied: result.applied, failed: result.failed }
            }));
            setTimeout(_close, result.failed === 0 ? 600 : 1500);
        };
    }

    function open(dataType, triggerWrapper) {
        if (dataType !== 'soil') {
            console.warn('[BulkTurfProfileModal] only supports soil dataType');
            return;
        }
        var sm = global.GAIP_SampleManager;
        if (!sm || typeof sm.getSamples !== 'function') {
            console.warn('[BulkTurfProfileModal] GAIP_SampleManager not available');
            return;
        }
        var samples = sm.getSamples(dataType) || [];
        if (samples.length === 0) return;
        _lastWrapper = triggerWrapper || null;
        var modal = _ensureModalEl();
        _render(modal, samples);
        _wire(modal, dataType);
        modal.style.display = 'flex';
    }

    global.GaipBulkTurfProfileModal = {
        version: '1.0.0',
        open: open,
        close: _close,
        applyAssignments: applyAssignments,
        // Pure helpers exposed for testing
        _getSportsSpeciesOptions: _getSportsSpeciesOptions,
        _buildAssignments: _buildAssignments
    };
})(typeof window !== 'undefined' ? window : this);
